package com.shahinst.cdnscanner.scan

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import java.net.InetSocketAddress
import java.net.Socket
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Core scanner (port of SHScanner in app/scanner/core.py):
 *  1. quick TCP pre-filter on the primary port
 *  2. up to 5 sequential /cdn-cgi/trace requests on one connection, >= 3 must come from a CDN edge
 *  3. TCP check of the remaining ports
 */
class CdnScanner(var workers: Int = 64, var maxLatencyMs: Int = 9999) {
    @Volatile var stopped = false
    private val failed: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())
    var log: ((String, String) -> Unit)? = null

    companion object {
        const val TRACE_ATTEMPTS = 5
        const val TRACE_MIN_SUCCESS = 3
        /** Worker counts per speed mode: a phone cannot keep 800 sockets open like a server. */
        val MODE_WORKERS = mapOf("hyper" to 48, "turbo" to 96, "ultra" to 160, "deep" to 256)
        val MODE_IPS_PER_24 = mapOf("hyper" to 30, "turbo" to 50, "ultra" to 80, "deep" to 120)

        fun calcScore(r: FoundIp): Double {
            var score = 0.0
            val ping = r.ping
            if (ping != null) score += when {
                ping < 50 -> 35; ping < 100 -> 28; ping < 200 -> 20; ping < 500 -> 10; ping < 1000 -> 3; else -> 0
            }
            score += r.openPorts.size * 3
            if (443 in r.openPorts) score += 12
            if (80 in r.openPorts) score += 10
            if (8080 in r.openPorts) score += 4
            if (8443 in r.openPorts) score += 4
            val speed = r.speed ?: 0.0
            score += when { speed >= 5000 -> 20; speed >= 2000 -> 15; speed >= 1000 -> 10; speed >= 300 -> 5; else -> 0 }
            val real = r.realDelay
            if (real != null) { if (real < 0) score *= 0.25 else score += 15 }
            if (!r.alive) score = 0.0
            return score.coerceIn(0.0, 100.0)
        }
    }

    fun reset() { stopped = false; failed.clear() }
    fun stop() { stopped = true }

    fun tcpConnect(ip: String, port: Int, timeoutMs: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(ip, port), timeoutMs); true }
    } catch (e: Exception) { false }

    /** Returns (valid, avgLatencyMs, colo). */
    fun sequentialTraceCheck(ip: String, port: Int, maxLatencyMs: Int): Triple<Boolean, Double, String> {
        val multiply = when {
            maxLatencyMs <= 300 -> 2.0; maxLatencyMs <= 500 -> 1.8; maxLatencyMs <= 1000 -> 1.5
            maxLatencyMs <= 3000 -> 1.2; else -> 1.0
        }
        val factors = doubleArrayOf(1.5, 1.2, 1.0, 1.0, 1.0)
        val maxTotalMs = maxOf(8000.0, minOf(15000.0, maxLatencyMs * 3.0))
        val tls = port in Http.HTTPS_PORTS
        val start = System.nanoTime()
        var successes = 0
        var aborted = false
        var colo = ""
        var sock: Socket? = null
        try {
            for (i in 0 until TRACE_ATTEMPTS) {
                if (stopped || aborted) break
                if ((System.nanoTime() - start) / 1e6 > maxTotalMs) break
                val timeoutMs = if (maxLatencyMs > 3000) 3000
                                else (factors[i] * multiply * maxLatencyMs).toInt().coerceIn(1500, 4000)
                try {
                    val s = sock ?: Http.connect(ip, port, timeoutMs, tls, if (tls) Http.CF_HOST else null).also { sock = it }
                    s.soTimeout = timeoutMs
                    s.getOutputStream().apply { write(Http.request(Http.TRACE_PATH, Http.CF_HOST, true)); flush() }
                    val resp = Http.readResponse(s.getInputStream(), 4096)
                    if (resp == null) { aborted = true; continue }
                    if (Http.isCdnResponse(resp.headers, resp.body)) {
                        if (colo.isEmpty()) colo = Http.extractColo(resp.headers, resp.body)
                        successes++
                    } else aborted = true
                    if (!resp.keepAlive) { try { s.close() } catch (_: Exception) {}; sock = null }
                } catch (e: Exception) {
                    aborted = true
                    try { sock?.close() } catch (_: Exception) {}
                    sock = null
                }
            }
        } finally {
            try { sock?.close() } catch (_: Exception) {}
        }
        val avg = (System.nanoTime() - start) / 1e6 / TRACE_ATTEMPTS
        return Triple(successes >= TRACE_MIN_SUCCESS && avg <= maxLatencyMs, avg, colo)
    }

    /** Full check of one IP; null when it is not a usable CDN edge. Blocking. */
    fun check(ip: String, ports: List<Int>): FoundIp? {
        if (stopped || ip in failed) return null
        val primary = ports.firstOrNull() ?: 443
        val preTimeout = (maxLatencyMs * 0.5).toInt().coerceIn(1500, 2500)
        if (!tcpConnect(ip, primary, preTimeout)) { failed.add(ip); return null }
        val (valid, avg, colo) = sequentialTraceCheck(ip, primary, maxLatencyMs)
        if (!valid) { failed.add(ip); return null }
        val open = ArrayList<Int>().apply { add(primary) }
        val tcpTimeout = maxLatencyMs.coerceIn(1500, 3000)
        for (p in ports.drop(1)) { if (stopped) break; if (tcpConnect(ip, p, tcpTimeout)) open.add(p) }
        log?.invoke("DEBUG", "$ip: open=$open ping=${avg.toInt()}ms")
        return FoundIp(ip = ip, ping = avg, openPorts = open, colo = colo)
    }

    /** Scans ips with `workers` parallel connections; onResult fires as each IP is found. */
    @OptIn(ExperimentalCoroutinesApi::class)
    suspend fun batchScan(ips: List<String>, ports: List<Int>, onProgress: (Int, Int) -> Unit, onResult: (FoundIp) -> Unit) {
        val n = ips.size
        val done = AtomicInteger(0)
        val channel = Channel<String>(Channel.RENDEZVOUS)
        val dispatcher = Dispatchers.IO.limitedParallelism(workers)
        log?.invoke("INFO", "Batch: $n IPs, ${ports.size} ports, $workers workers")
        coroutineScope {
            repeat(workers) {
                launch(dispatcher) {
                    for (ip in channel) {
                        if (stopped) continue
                        val r = try { check(ip, ports) } catch (e: Exception) { null }
                        if (r != null) onResult(r)
                        onProgress(done.incrementAndGet(), n)
                    }
                }
            }
            for (ip in ips) { if (stopped) break; channel.send(ip) }
            channel.close()
        }
    }
}
