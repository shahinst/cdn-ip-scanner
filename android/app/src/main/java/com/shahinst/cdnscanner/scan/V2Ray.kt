package com.shahinst.cdnscanner.scan

import android.util.Base64
import org.json.JSONObject
import java.net.URLDecoder
import java.net.URLEncoder

/** A vless:// vmess:// or trojan:// link, split into its parts (port of V2RayConfigParser). */
data class ParsedConfig(
    val protocol: String,
    val uuid: String,
    val ip: String,
    val port: Int,
    val params: Map<String, String>,
    val fragment: String,
    val raw: String,
    val vmessJson: String? = null,
) {
    val name: String get() = try { URLDecoder.decode(fragment.ifEmpty { protocol }, "UTF-8") } catch (e: Exception) { fragment }
}

object V2Ray {
    fun parse(input: String?): ParsedConfig? {
        val s = (input ?: "").trim()
        if (s.isEmpty()) return null
        return try {
            when {
                s.startsWith("vless://") -> parseUri(s, "vless")
                s.startsWith("trojan://") -> parseUri(s, "trojan")
                s.startsWith("vmess://") -> parseVmess(s)
                else -> null
            }
        } catch (e: Exception) { null }
    }

    private fun splitHostPort(hp: String): Pair<String, Int> {
        if (hp.startsWith("[")) {
            val host = hp.substring(1).substringBefore(']')
            val rest = hp.substringAfter(']', "")
            return host to (if (rest.startsWith(":")) rest.substring(1).toInt() else 443)
        }
        if (hp.count { it == ':' } == 1) return hp.substringBeforeLast(':') to hp.substringAfterLast(':').toInt()
        return hp to 443
    }

    private fun parseQuery(q: String): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        if (q.isEmpty()) return out
        for (pair in q.split('&')) {
            if (pair.isEmpty()) continue
            val k = pair.substringBefore('=')
            val v = if (pair.contains('=')) pair.substringAfter('=') else ""
            out[URLDecoder.decode(k, "UTF-8")] = URLDecoder.decode(v, "UTF-8")
        }
        return out
    }

    private fun parseUri(s: String, protocol: String): ParsedConfig? {
        var rest = s.substring(protocol.length + 3)
        var fragment = ""
        if (rest.contains('#')) { fragment = rest.substringAfterLast('#'); rest = rest.substringBeforeLast('#') }
        var query = ""
        if (rest.contains('?')) { query = rest.substringAfter('?'); rest = rest.substringBefore('?') }
        if (!rest.contains('@')) return null
        val id = rest.substringBefore('@')
        val (host, port) = splitHostPort(rest.substringAfter('@'))
        return ParsedConfig(protocol, id, host, port, parseQuery(query), fragment, s)
    }

    private fun decodeBase64(s: String): ByteArray {
        var enc = s.trim()
        val pad = enc.length % 4
        if (pad != 0) enc += "=".repeat(4 - pad)
        return try { Base64.decode(enc, Base64.DEFAULT) } catch (e: IllegalArgumentException) { Base64.decode(enc, Base64.URL_SAFE) }
    }

    private fun parseVmess(s: String): ParsedConfig? {
        val json = String(decodeBase64(s.substring(8)), Charsets.UTF_8)
        val obj = JSONObject(json)
        val params = LinkedHashMap<String, String>()
        for (k in obj.keys()) params[k] = obj.opt(k)?.toString() ?: ""
        return ParsedConfig("vmess", obj.optString("id"), obj.optString("add"),
            obj.optString("port", "443").toIntOrNull() ?: 443, params, obj.optString("ps"), s, json)
    }

    private fun uriHost(ip: String) = if (ip.contains(':')) "[$ip]" else ip
    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")

    /** Same link with another server address; suffix is appended to the name. */
    fun rebuild(p: ParsedConfig, newIp: String, suffix: String = ""): String {
        if (p.protocol == "vmess") {
            val obj = JSONObject(p.vmessJson ?: "{}")
            obj.put("add", newIp)
            if (suffix.isNotEmpty()) obj.put("ps", obj.optString("ps") + suffix)
            return "vmess://" + Base64.encodeToString(obj.toString().toByteArray(), Base64.NO_WRAP)
        }
        val query = p.params.entries.joinToString("&") { enc(it.key) + "=" + enc(it.value) }
        var fragment = p.fragment
        if (suffix.isNotEmpty()) fragment += enc(suffix).replace("+", "%20")
        val sb = StringBuilder("${p.protocol}://${p.uuid}@${uriHost(newIp)}:${p.port}")
        if (query.isNotEmpty()) sb.append('?').append(query)
        if (fragment.isNotEmpty()) sb.append('#').append(fragment)
        return sb.toString()
    }

    /** Base64 subscription body understood by v2rayNG, Hiddify, NekoBox, ... */
    fun subscription(links: List<String>): String =
        Base64.encodeToString(links.joinToString("\n").toByteArray(), Base64.NO_WRAP)

    /**
     * Connect to ip with the config's SNI / Host and ask the edge for /cdn-cgi/trace.
     * Returns (ok, latencyMs, colo). A bare TCP/TLS handshake is not enough to pass.
     */
    fun testIpWithConfig(p: ParsedConfig, ip: String, timeoutMs: Int = 5000): Triple<Boolean, Double?, String> {
        val sni = p.params["sni"].orEmpty().ifEmpty { p.params["host"].orEmpty() }
        val hostHeader = p.params["host"].orEmpty().ifEmpty { sni.ifEmpty { ip } }
        val security = (p.params["security"] ?: p.params["tls"] ?: "").lowercase()
        val useTls = security == "tls" || (security.isEmpty() && p.port in Http.HTTPS_PORTS)
        val start = System.nanoTime()
        return try {
            Http.connect(ip, p.port, timeoutMs, useTls, sni.ifEmpty { null }).use { s ->
                val latency = (System.nanoTime() - start) / 1e6
                s.getOutputStream().apply { write(Http.request(Http.TRACE_PATH, hostHeader, false)); flush() }
                val resp = Http.readResponse(s.getInputStream(), 8192)
                if (resp == null || !Http.isCdnResponse(resp.headers, resp.body)) Triple(false, null, "")
                else Triple(true, latency, Http.extractColo(resp.headers, resp.body))
            }
        } catch (e: Exception) { Triple(false, null, "") }
    }
}
