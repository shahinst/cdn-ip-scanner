package com.shahinst.cdnscanner.scan

import android.app.Application
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Prefs
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.monitor.Notify
import com.shahinst.cdnscanner.net.Telegram
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicInteger

/**
 * Runs scans in the background (port of the scan loop in app/routes/api.py) and exposes
 * state flows for the UI. One scan at a time, like the server.
 */
object ScanEngine {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null
    private lateinit var app: Application
    private val scanner = CdnScanner()
    @Volatile private var userStop = false
    private const val MAX_TOTAL_SCANNED = 200_000

    val state = MutableStateFlow(ScanState())
    val results = MutableStateFlow<List<FoundIp>>(emptyList())
    val logs = MutableStateFlow<List<LogLine>>(emptyList())
    /** (elapsed seconds, IPs per second) samples for the live chart. */
    val speedHistory = MutableStateFlow<List<Pair<Double, Double>>>(emptyList())
    var parsedConfig: ParsedConfig? = null; private set
    var ports: List<Int> = listOf(443); private set

    fun init(application: Application) {
        app = application
        // Show the last finished scan again after the process was restarted.
        Store.sessions.value.firstOrNull()?.let { if (results.value.isEmpty()) loadSession(it) }
    }

    fun log(level: String, message: String) {
        if (level == "DEBUG" && !Prefs.debugLog) return
        logs.update { (it + LogLine(System.currentTimeMillis(), level, message)).takeLast(400) }
    }

    /** Starts a scan; returns a string resource id describing the problem, or null when started. */
    fun start(params: ScanParams): Int? {
        if (state.value.running) return R.string.scan_running
        val parsed = if (params.method == "v2ray") (V2Ray.parse(params.v2rayConfig) ?: return R.string.v2ray_invalid) else null
        if (params.ranges.isEmpty()) return R.string.no_ranges
        parsedConfig = parsed
        ports = if (parsed != null) listOf(parsed.port) else params.ports
        results.value = emptyList(); logs.value = emptyList(); speedHistory.value = emptyList()
        userStop = false
        scanner.reset()
        scanner.workers = CdnScanner.MODE_WORKERS[params.mode] ?: 48
        scanner.maxLatencyMs = params.pingMax
        scanner.log = { l, m -> log(l, m) }
        val sessionId = System.currentTimeMillis()
        state.value = ScanState(phase = ScanPhase.SCANNING, sessionId = sessionId, target = params.targetCount)
        ScanService.start(app)
        job = scope.launch { runScan(params, parsed, sessionId) }
        return null
    }

    fun stop() {
        userStop = true
        scanner.stop()
        log("INFO", "Stop requested")
    }

    private fun updateResult(ip: String, f: (FoundIp) -> FoundIp) {
        results.update { list -> list.map { if (it.ip == ip) f(it).let { r -> r.copy(score = CdnScanner.calcScore(r)) } else it } }
    }

    /** Generic worker pool used for the V2Ray scan, the config test and the re-test. */
    @OptIn(ExperimentalCoroutinesApi::class)
    private suspend fun <T> pool(items: List<T>, workers: Int, onProgress: (Int, Int) -> Unit, work: (T) -> Unit) {
        val ch = Channel<T>(Channel.RENDEZVOUS)
        val done = AtomicInteger(0)
        val dispatcher = Dispatchers.IO.limitedParallelism(workers)
        coroutineScope {
            repeat(workers) {
                launch(dispatcher) {
                    for (item in ch) {
                        if (!userStop) try { work(item) } catch (e: Exception) { log("WARN", "worker: $e") }
                        onProgress(done.incrementAndGet(), items.size)
                    }
                }
            }
            for (item in items) { if (userStop) break; ch.send(item) }
            ch.close()
        }
    }

    private suspend fun runScan(p: ScanParams, parsed: ParsedConfig?, sessionId: Long) {
        val start = System.nanoTime()
        fun elapsed() = (System.nanoTime() - start) / 1e9
        var totalScanned = 0
        val tried = HashSet<String>()
        val seen = HashSet<String>()
        val perBlock = CdnScanner.MODE_IPS_PER_24[p.mode] ?: 30
        val batchSize = (p.targetCount * 20).coerceIn(500, 5000)
        var lastSample = 0.0
        var status = "completed"
        try {
            log("INFO", "Scan started: method=${p.method} mode=${p.mode} ranges=${p.ranges.size} target=${p.targetCount}")
            if (parsed != null) log("INFO", "Config: ${parsed.protocol} ${parsed.params["host"] ?: ""}:${parsed.port}")
            var batch = 0
            while (!userStop) {
                if (p.targetCount > 0 && results.value.size >= p.targetCount) break
                if (totalScanned >= MAX_TOTAL_SCANNED) { log("INFO", "Reached max IPs to try ($MAX_TOTAL_SCANNED)"); break }
                batch++
                val ips = IpGen.generateScanIps(p.ranges, perBlock, batchSize).filter { it !in tried }
                if (ips.isEmpty()) { log("WARN", "No new IPs left in the selected ranges"); break }
                tried.addAll(ips)
                val base = totalScanned
                log("INFO", "Batch $batch: ${ips.size} IPs (found ${results.value.size} so far)")
                val onProgress = { done: Int, total: Int ->
                    val e = elapsed()
                    state.update { it.copy(done = base + done, total = base + total, elapsed = e, speed = if (e > 0) (base + done) / e else 0.0) }
                    if (e - lastSample >= 1.0) { lastSample = e; speedHistory.update { (it + (e to (base + done) / e)).takeLast(120) } }
                }
                val onResult = { r: FoundIp ->
                    val ping = r.ping ?: 0.0
                    if (ping >= p.pingMin && ping <= p.pingMax && synchronized(seen) { seen.add(r.ip) }) {
                        val cfg = parsed?.let { V2Ray.rebuild(it, r.ip, " | ${r.ip}") }
                        val f = r.copy(operator = p.operator, config = cfg)
                        val scored = f.copy(score = CdnScanner.calcScore(f))
                        results.update { it + scored }
                        state.update { it.copy(found = results.value.size) }
                        log("INFO", "Found ${r.ip} ping=${ping.toInt()}ms ports=${r.openPorts} ${Colo.label(r.colo)}")
                        if (p.targetCount > 0 && results.value.size >= p.targetCount) scanner.stop()
                    }
                }
                if (parsed != null) {
                    pool(ips, 32, onProgress) { ip ->
                        if (!scanner.stopped) {
                            val (ok, latency, colo) = V2Ray.testIpWithConfig(parsed, ip)
                            if (ok && latency != null) onResult(FoundIp(ip, latency, listOf(parsed.port), colo = colo))
                        }
                    }
                } else scanner.batchScan(ips, p.ports, onProgress, onResult)
                totalScanned += ips.size
                if (p.targetCount > 0 && results.value.size >= p.targetCount) { log("INFO", "Target reached: ${results.value.size} IPs"); break }
                if (!userStop) scanner.stopped = false
            }
            if (parsed != null && p.configTest.enabled && results.value.isNotEmpty() && !userStop) runConfigTests(parsed, p.configTest.count)
            if (p.speedTest.enabled && results.value.isNotEmpty() && !userStop) runSpeedTests(p.speedTest)
            if (userStop) status = "stopped"
        } catch (e: Exception) {
            status = "error"
            log("ERROR", "Scan error: $e")
            state.update { it.copy(error = e.toString()) }
        }
        val duration = elapsed()
        val found = results.value.sortedByDescending { it.score }
        results.value = found
        Store.saveSession(ScanSession(sessionId, p.method, p.mode, totalScanned, found.size, Math.round(duration * 10) / 10.0,
            status, p.v2rayConfig, p.operator), found)
        log("INFO", "Scan $status: ${found.size}/$totalScanned IPs in ${duration.toInt()}s")
        state.update { it.copy(phase = when (status) { "stopped" -> ScanPhase.STOPPED; "error" -> ScanPhase.ERROR; else -> ScanPhase.DONE },
            elapsed = duration, found = found.size) }
        notifyDone(found, duration)
    }

    private fun notifyDone(found: List<FoundIp>, duration: Double) {
        Notify.post(app, Notify.ID_DONE, Notify.CHANNEL_SCAN, app.getString(R.string.notif_done_title),
            app.getString(R.string.status_done, found.size, duration.toInt()))
        if (Prefs.notifyScanComplete && found.isNotEmpty()) {
            val top = found.take(10).joinToString("\n") { "${it.ip}  ${it.ping?.toInt() ?: "-"}ms  ${it.colo}" }
            val (ok, err) = Telegram.send("CDN IP Scanner: ${found.size} IPs found in ${duration.toInt()}s\n\n$top")
            if (!ok) log("WARN", "Telegram: $err")
        }
    }

    /** Test the best IPs through the user's config (TLS/SNI + Host of the config). */
    private suspend fun runConfigTests(parsed: ParsedConfig, count: Int) {
        val candidates = results.value.sortedBy { it.ping ?: 1e9 }.take(count)
        state.update { it.copy(phase = ScanPhase.CONFIG_TEST, done = 0, total = candidates.size) }
        log("INFO", "Config test: ${candidates.size} IPs")
        pool(candidates, 8, { d, t -> state.update { it.copy(done = d, total = t) } }) { r ->
            val (ok, latency, _) = V2Ray.testIpWithConfig(parsed, r.ip)
            updateResult(r.ip) { it.copy(realDelay = if (ok && latency != null) latency else -1.0) }
        }
    }

    /** Sequential downloads (parallel ones would share the bandwidth). */
    private fun runSpeedTests(opts: SpeedTestOptions) {
        val usable = results.value.filter { it.realDelay == null || it.realDelay >= 0 }
        val candidates = usable.sortedBy { it.ping ?: 1e9 }.take(opts.count)
        state.update { it.copy(phase = ScanPhase.SPEED_TEST, done = 0, total = candidates.size) }
        log("INFO", "Speed test: ${candidates.size} IPs, ${opts.sizeKb} KB each")
        candidates.forEachIndexed { i, r ->
            if (userStop) return
            val speed = SpeedTest.measure(r.ip, opts.sizeKb, opts.url) { userStop }
            updateResult(r.ip) { it.copy(speed = speed) }
            state.update { it.copy(done = i + 1) }
            log("INFO", "Speed ${r.ip}: " + (speed?.let { "${it.toInt()} KB/s" } ?: "failed"))
        }
    }

    /** Re-check every result of the loaded session; dead IPs get alive=false and score 0. */
    fun retest(): Int? {
        if (state.value.running) return R.string.scan_running
        val list = results.value
        if (list.isEmpty()) return R.string.results_empty
        userStop = false
        val sessionId = state.value.sessionId
        state.update { it.copy(phase = ScanPhase.RETEST, done = 0, total = list.size, error = "") }
        ScanService.start(app)
        job = scope.launch {
            val sc = CdnScanner(32, Prefs.pingMax)
            val parsed = parsedConfig
            log("INFO", "Re-test: ${list.size} IPs")
            pool(list, 32, { d, t -> state.update { it.copy(done = d, total = t) } }) { r ->
                if (parsed != null) {
                    val (ok, latency, colo) = V2Ray.testIpWithConfig(parsed, r.ip)
                    updateResult(r.ip) { it.copy(alive = ok, ping = if (ok) latency else it.ping, colo = if (ok && colo.isNotEmpty()) colo else it.colo) }
                } else {
                    val res = sc.check(r.ip, r.openPorts.ifEmpty { ports })
                    updateResult(r.ip) {
                        if (res != null) it.copy(alive = true, ping = res.ping, openPorts = res.openPorts, colo = res.colo.ifEmpty { it.colo })
                        else it.copy(alive = false)
                    }
                }
            }
            val sorted = results.value.sortedByDescending { it.score }
            results.value = sorted
            Store.updateResults(sessionId, sorted)
            val dead = sorted.count { !it.alive }
            log("INFO", "Re-test done: ${sorted.size - dead} working, $dead down")
            state.update { it.copy(phase = ScanPhase.DONE) }
        }
        return null
    }

    fun loadSession(s: ScanSession) {
        if (state.value.running) return
        results.value = Store.results(s.id)
        parsedConfig = V2Ray.parse(s.v2rayConfig)
        ports = parsedConfig?.let { listOf(it.port) } ?: Prefs.portList()
        state.value = ScanState(phase = ScanPhase.DONE, sessionId = s.id, found = results.value.size, elapsed = s.duration,
            done = s.totalScanned, total = s.totalScanned)
    }

    fun clear() {
        if (state.value.running) return
        results.value = emptyList(); logs.value = emptyList(); speedHistory.value = emptyList()
        state.value = ScanState()
    }
}
