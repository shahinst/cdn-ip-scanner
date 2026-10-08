package com.shahinst.cdnscanner.scan

import java.io.ByteArrayOutputStream
import java.net.URL

/** Download through a specific CDN IP with the test URL's hostname as SNI/Host (verified cert). */
object SpeedTest {
    const val DEFAULT_URL = "https://speed.cloudflare.com/__down?bytes={bytes}"

    /** Speed in KB/s or null when the test failed. */
    fun measure(ip: String, sizeKb: Int, url: String = DEFAULT_URL, timeoutMs: Int = 10000, stop: () -> Boolean = { false }): Double? {
        val sizeBytes = maxOf(1, sizeKb) * 1024
        val u = try { URL(url.replace("{bytes}", sizeBytes.toString())) } catch (e: Exception) { return null }
        val host = u.host ?: return null
        if (u.protocol != "http" && u.protocol != "https") return null
        val port = if (u.port > 0) u.port else if (u.protocol == "https") 443 else 80
        var path = u.path.ifEmpty { "/" }
        if (!u.query.isNullOrEmpty()) path += "?" + u.query
        val deadline = System.currentTimeMillis() + timeoutMs
        return try {
            Http.connect(ip, port, minOf(5000, timeoutMs), u.protocol == "https", host, verify = true).use { s ->
                s.getOutputStream().apply { write(Http.request(path, host, false)); flush() }
                val input = s.getInputStream()
                val head = ByteArrayOutputStream()
                val buf = ByteArray(16384)
                var headEnd = -1
                var received = 0L
                while (headEnd < 0) {
                    if (System.currentTimeMillis() > deadline || head.size() > 65536) return null
                    val n = input.read(buf); if (n < 0) return null
                    head.write(buf, 0, n)
                    val bytes = head.toByteArray()
                    headEnd = indexOf(bytes, "\r\n\r\n".toByteArray())
                    if (headEnd >= 0) received = (bytes.size - headEnd - 4).toLong()
                }
                val statusLine = String(head.toByteArray(), 0, headEnd, Charsets.ISO_8859_1).lineSequence().first()
                if (statusLine.split(' ').getOrNull(1) != "200") return null
                val start = System.nanoTime()
                while (received < sizeBytes && System.currentTimeMillis() < deadline) {
                    if (stop()) return null
                    val n = input.read(buf); if (n < 0) break
                    received += n
                }
                val elapsed = maxOf((System.nanoTime() - start) / 1e9, 0.001)
                if (received < minOf(sizeBytes.toLong(), 64L * 1024)) return null
                Math.round(received / 1024.0 / elapsed * 10) / 10.0
            }
        } catch (e: Exception) { null }
    }

    private fun indexOf(hay: ByteArray, needle: ByteArray): Int {
        outer@ for (i in 0..hay.size - needle.size) {
            for (j in needle.indices) if (hay[i + j] != needle[j]) continue@outer
            return i
        }
        return -1
    }
}
