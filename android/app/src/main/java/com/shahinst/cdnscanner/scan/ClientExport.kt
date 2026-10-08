package com.shahinst.cdnscanner.scan

import org.json.JSONArray
import org.json.JSONObject

/** Clash (Mihomo) and sing-box configs: one proxy per found IP + an automatic "fastest" group. */
object ClientExport {
    const val TEST_URL = "https://www.gstatic.com/generate_204"

    private class Fields(val network: String, val tls: Boolean, val host: String, val path: String,
                         val serviceName: String, val sni: String, val alpn: List<String>, val fp: String,
                         val insecure: Boolean, val flow: String, val aid: Int, val cipher: String)

    private fun fields(p: ParsedConfig): Fields {
        val q = p.params
        val vmess = p.protocol == "vmess"
        var network = (if (vmess) q["net"] else q["type"]).orEmpty().ifEmpty { "tcp" }
        network = when (network) { "raw" -> "tcp"; "splithttp" -> "xhttp"; else -> network }
        val security = (if (vmess) q["tls"] else q["security"]).orEmpty().ifEmpty { "none" }
        if (security == "reality") throw IllegalArgumentException("REALITY configs are not served through a CDN")
        if (network !in listOf("tcp", "ws", "grpc", "httpupgrade")) throw IllegalArgumentException("Transport \"$network\" is not supported by this export")
        val host = q["host"].orEmpty()
        return Fields(
            network = network, tls = security == "tls", host = host, path = q["path"].orEmpty().ifEmpty { "/" },
            serviceName = q["serviceName"].orEmpty().ifEmpty { q["path"].orEmpty() }, sni = q["sni"].orEmpty().ifEmpty { host },
            alpn = q["alpn"].orEmpty().split(',').filter { it.isNotEmpty() }, fp = q["fp"].orEmpty(),
            insecure = (q["allowInsecure"] ?: q["insecure"] ?: "").lowercase() in listOf("1", "true"),
            flow = q["flow"].orEmpty(), aid = if (vmess) q["aid"]?.toIntOrNull() ?: 0 else 0,
            cipher = q["scy"].orEmpty().ifEmpty { "auto" },
        )
    }

    private fun name(p: ParsedConfig, ip: String) = "${p.name} | $ip"

    fun clashProxy(p: ParsedConfig, ip: String): JSONObject {
        val f = fields(p)
        val o = JSONObject().put("name", name(p, ip)).put("type", p.protocol).put("server", ip).put("port", p.port).put("udp", true)
        when (p.protocol) {
            "vless" -> { o.put("uuid", p.uuid); if (f.flow.isNotEmpty()) o.put("flow", f.flow) }
            "vmess" -> o.put("uuid", p.uuid).put("alterId", f.aid).put("cipher", f.cipher)
            else -> o.put("password", p.uuid)
        }
        if (f.tls) {
            o.put("tls", true).put(if (p.protocol == "trojan") "sni" else "servername", f.sni).put("skip-cert-verify", f.insecure)
            if (f.alpn.isNotEmpty()) o.put("alpn", JSONArray(f.alpn))
            if (f.fp.isNotEmpty()) o.put("client-fingerprint", f.fp)
        }
        when (f.network) {
            "ws", "httpupgrade" -> {
                val opts = JSONObject().put("path", f.path)
                if (f.host.isNotEmpty()) opts.put("headers", JSONObject().put("Host", f.host))
                if (f.network == "httpupgrade") opts.put("v2ray-http-upgrade", true)
                o.put("network", "ws").put("ws-opts", opts)
            }
            "grpc" -> o.put("network", "grpc").put("grpc-opts", JSONObject().put("grpc-service-name", f.serviceName))
        }
        return o
    }

    fun clash(p: ParsedConfig, ips: List<String>, testUrl: String = TEST_URL): String {
        val proxies = JSONArray(ips.map { clashProxy(p, it) })
        val names = JSONArray(ips.map { name(p, it) })
        val selectNames = JSONArray().put("Auto (fastest IP)")
        ips.forEach { selectNames.put(name(p, it)) }
        val config = JSONObject()
            .put("mixed-port", 7890).put("allow-lan", false).put("mode", "rule").put("log-level", "warning")
            .put("proxies", proxies)
            .put("proxy-groups", JSONArray()
                .put(JSONObject().put("name", "Auto (fastest IP)").put("type", "url-test").put("proxies", names)
                    .put("url", testUrl).put("interval", 300).put("tolerance", 50))
                .put(JSONObject().put("name", "PROXY").put("type", "select").put("proxies", selectNames)))
            .put("rules", JSONArray().put("MATCH,PROXY"))
        return config.toString(2)   // JSON is valid YAML
    }

    fun singboxOutbound(p: ParsedConfig, ip: String): JSONObject {
        val f = fields(p)
        val o = JSONObject().put("type", p.protocol).put("tag", name(p, ip)).put("server", ip).put("server_port", p.port)
        when (p.protocol) {
            "vless" -> { o.put("uuid", p.uuid); if (f.flow.isNotEmpty()) o.put("flow", f.flow) }
            "vmess" -> o.put("uuid", p.uuid).put("alter_id", f.aid).put("security", f.cipher)
            else -> o.put("password", p.uuid)
        }
        if (f.tls) {
            val tls = JSONObject().put("enabled", true).put("server_name", f.sni).put("insecure", f.insecure)
            if (f.alpn.isNotEmpty()) tls.put("alpn", JSONArray(f.alpn))
            if (f.fp.isNotEmpty()) tls.put("utls", JSONObject().put("enabled", true).put("fingerprint", f.fp))
            o.put("tls", tls)
        }
        when (f.network) {
            "ws" -> {
                val t = JSONObject().put("type", "ws").put("path", f.path)
                if (f.host.isNotEmpty()) t.put("headers", JSONObject().put("Host", f.host))
                o.put("transport", t)
            }
            "httpupgrade" -> o.put("transport", JSONObject().put("type", "httpupgrade").put("path", f.path).put("host", f.host))
            "grpc" -> o.put("transport", JSONObject().put("type", "grpc").put("service_name", f.serviceName))
        }
        return o
    }

    fun singbox(p: ParsedConfig, ips: List<String>, testUrl: String = TEST_URL): String {
        val tags = JSONArray(ips.map { name(p, it) })
        val selector = JSONArray().put("auto")
        ips.forEach { selector.put(name(p, it)) }
        val all = JSONArray()
            .put(JSONObject().put("type", "selector").put("tag", "proxy").put("outbounds", selector).put("default", "auto"))
            .put(JSONObject().put("type", "urltest").put("tag", "auto").put("outbounds", tags).put("url", testUrl).put("interval", "5m"))
        ips.forEach { all.put(singboxOutbound(p, it)) }
        all.put(JSONObject().put("type", "direct").put("tag", "direct"))
        val config = JSONObject()
            .put("log", JSONObject().put("level", "warn"))
            .put("inbounds", JSONArray().put(JSONObject().put("type", "mixed").put("tag", "mixed-in").put("listen", "127.0.0.1").put("listen_port", 2080)))
            .put("outbounds", all)
            .put("route", JSONObject().put("final", "proxy"))
        return config.toString(2)
    }
}
