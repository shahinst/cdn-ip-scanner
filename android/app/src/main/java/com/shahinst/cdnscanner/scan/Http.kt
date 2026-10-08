package com.shahinst.cdnscanner.scan

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.SNIHostName
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/** Minimal HTTP/1.1 over raw sockets: lets us pick the IP, the SNI and the Host header freely. */
object Http {
    val HTTPS_PORTS = setOf(443, 8443, 2053, 2083, 2087, 2096)
    const val TRACE_PATH = "/cdn-cgi/trace"
    const val CF_HOST = "www.cloudflare.com"
    const val USER_AGENT = "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"

    class Response(val status: Int, val headers: Map<String, String>, val body: String, val keepAlive: Boolean)

    private val trustAllFactory: SSLSocketFactory by lazy {
        val tm = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
        SSLContext.getInstance("TLS").apply { init(null, arrayOf<TrustManager>(tm), SecureRandom()) }.socketFactory
    }

    /** Edge responses from Cloudflare or Fastly only; any random open port must NOT pass. */
    fun isCdnResponse(headers: Map<String, String>, body: String = ""): Boolean {
        if (body.contains("fl=") && body.contains("colo=")) return true
        val server = (headers["server"] ?: "").lowercase()
        val via = (headers["via"] ?: "").lowercase()
        if (headers.containsKey("cf-ray") || server.contains("cloudflare")) return true
        return headers.containsKey("x-fastly-request-id") || server.contains("fastly") ||
                via.contains("fastly") || via.contains("varnish") || headers.containsKey("x-served-by")
    }

    fun extractColo(headers: Map<String, String>, body: String = ""): String {
        for (line in body.lineSequence()) if (line.startsWith("colo=")) return line.substring(5).trim().uppercase().take(10)
        val ray = headers["cf-ray"] ?: ""
        if (ray.contains('-')) return ray.substringAfterLast('-').trim().uppercase().take(10)
        val served = (headers["x-served-by"] ?: "").split(',').last().trim()
        if (served.contains('-')) return served.substringAfterLast('-').trim().uppercase().take(10)
        return ""
    }

    /**
     * Connect to ip:port; with tls a handshake is done immediately. verify=false accepts any
     * certificate (the CDN edge serves a cert for the SNI we send, not for the raw IP).
     */
    fun connect(ip: String, port: Int, timeoutMs: Int, tls: Boolean, sni: String?, verify: Boolean = false): Socket {
        val plain = Socket()
        try {
            plain.connect(InetSocketAddress(ip, port), timeoutMs)
            plain.soTimeout = timeoutMs
            plain.tcpNoDelay = true
            if (!tls) return plain
            val factory = if (verify) SSLSocketFactory.getDefault() as SSLSocketFactory else trustAllFactory
            val ssl = factory.createSocket(plain, sni ?: ip, port, true) as SSLSocket
            val params = ssl.sslParameters
            if (!sni.isNullOrBlank()) params.serverNames = listOf(SNIHostName(sni))
            if (verify) params.endpointIdentificationAlgorithm = "HTTPS"
            ssl.sslParameters = params
            ssl.soTimeout = timeoutMs
            ssl.startHandshake()
            return ssl
        } catch (e: Exception) {
            try { plain.close() } catch (_: IOException) {}
            throw e
        }
    }

    fun request(path: String, host: String, keepAlive: Boolean): ByteArray =
        ("GET $path HTTP/1.1\r\nHost: $host\r\nUser-Agent: $USER_AGENT\r\nAccept: */*\r\n" +
                "Connection: ${if (keepAlive) "keep-alive" else "close"}\r\n\r\n").toByteArray()

    /** Reads head + body (content-length / chunked / until EOF). Returns null on a malformed response. */
    fun readResponse(input: InputStream, maxBody: Int = 65536): Response? {
        val head = ByteArrayOutputStream()
        var matched = 0
        val cr = 13
        val lf = 10
        while (matched < 4 && head.size() < 65536) {
            val b = input.read()
            if (b < 0) return null
            head.write(b)
            matched = when {
                (matched == 0 || matched == 2) && b == cr -> matched + 1
                (matched == 1 || matched == 3) && b == lf -> matched + 1
                b == cr -> 1
                else -> 0
            }
        }
        if (matched < 4) return null
        val lines = head.toString(Charsets.ISO_8859_1.name()).trimEnd().split("\r\n")
        val parts = lines[0].split(' ', limit = 3)
        if (parts.size < 2 || !parts[0].startsWith("HTTP/")) return null
        val status = parts[1].toIntOrNull() ?: return null
        val headers = HashMap<String, String>()
        for (l in lines.drop(1)) {
            val i = l.indexOf(':')
            if (i > 0) headers[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim()
        }
        val http11 = parts[0] == "HTTP/1.1"
        var keep = http11 && !(headers["connection"] ?: "").lowercase().contains("close")
        val out = ByteArrayOutputStream()
        val length = headers["content-length"]?.toIntOrNull()
        if ((headers["transfer-encoding"] ?: "").lowercase().contains("chunked")) {
            if (!readChunked(input, out, maxBody)) keep = false
        } else if (length != null) {
            readExact(input, out, minOf(length, maxBody))
            if (length > maxBody) keep = false
        } else {
            keep = false
            val buf = ByteArray(8192)
            while (out.size() < maxBody) { val n = input.read(buf); if (n < 0) break; out.write(buf, 0, n) }
        }
        return Response(status, headers, out.toString(Charsets.UTF_8.name()), keep)
    }

    private fun readExact(input: InputStream, out: ByteArrayOutputStream, n: Int) {
        val buf = ByteArray(8192)
        var left = n
        while (left > 0) { val r = input.read(buf, 0, minOf(buf.size, left)); if (r < 0) break; out.write(buf, 0, r); left -= r }
    }

    private fun readLine(input: InputStream): String? {
        val sb = StringBuilder()
        while (true) {
            val b = input.read()
            if (b < 0) return if (sb.isEmpty()) null else sb.toString()
            if (b == 10) return sb.toString().trimEnd('\r')
            sb.append(b.toChar())
            if (sb.length > 1024) return null
        }
    }

    /** True when the whole chunked body was consumed (connection reusable). */
    private fun readChunked(input: InputStream, out: ByteArrayOutputStream, maxBody: Int): Boolean {
        while (true) {
            val sizeLine = readLine(input) ?: return false
            val size = sizeLine.substringBefore(';').trim().toIntOrNull(16) ?: return false
            if (size == 0) { readLine(input); return true }
            if (out.size() + size > maxBody) return false
            readExact(input, out, size)
            readLine(input)
        }
    }
}
