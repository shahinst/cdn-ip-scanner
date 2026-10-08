package com.shahinst.cdnscanner.scan

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Built-in CDN ranges and online fetchers (port of app/scanner/range_fetcher.py). */
object Ranges {
    val CLOUDFLARE_CORE = listOf(
        "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "104.16.0.0/13",
        "104.24.0.0/14", "108.162.192.0/18", "131.0.72.0/22", "141.101.64.0/18",
        "162.159.0.0/15", "172.64.0.0/13", "173.245.48.0/20", "188.114.96.0/20",
        "190.93.240.0/20", "197.234.240.0/22", "198.41.128.0/17",
    )
    val CLOUDFLARE_IPV6 = listOf(
        "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
        "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
    )
    val FASTLY = listOf(
        "23.235.32.0/20", "43.249.72.0/22", "103.244.50.0/24", "103.245.222.0/23",
        "103.245.224.0/24", "104.156.80.0/20", "140.248.64.0/18", "140.248.128.0/17",
        "146.75.0.0/17", "151.101.0.0/16", "157.52.64.0/18", "167.82.0.0/17",
        "167.82.128.0/20", "167.82.160.0/20", "167.82.224.0/20", "172.111.64.0/18",
        "185.31.16.0/22", "199.27.72.0/21", "199.232.0.0/16",
    )

    val SOURCES = listOf("builtin", "cloudflare", "cloudflare_v6", "fastly", "all")

    fun normalize(ranges: Iterable<String>): List<String> {
        val seen = LinkedHashSet<String>()
        for (r in ranges) {
            val s = r.trim()
            if (s.isNotEmpty() && !s.startsWith("#") && IpGen.isValidRange(s)) seen.add(s)
        }
        return seen.toList()
    }

    /** Parse a free-text list: one range per line, commas or spaces also accepted. */
    fun parseText(text: String): List<String> =
        normalize(text.split('\n', ',', ' ', '\t', ';').filter { it.isNotBlank() })

    fun get(url: String, timeoutMs: Int = 20000): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = timeoutMs
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) CDN-IP-Scanner")
        conn.setRequestProperty("Accept", "application/json, text/plain, */*")
        try {
            if (conn.responseCode != 200) throw IllegalStateException("HTTP ${conn.responseCode} from $url")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    fun fetchCloudflareV4(): List<String> = normalize(get("https://www.cloudflare.com/ips-v4").lines())
    fun fetchCloudflareV6(): List<String> = normalize(get("https://www.cloudflare.com/ips-v6").lines())

    fun fetchFastly(): List<String> {
        val json = JSONObject(get("https://api.fastly.com/public-ip-list"))
        val arr = json.optJSONArray("addresses") ?: return emptyList()
        return normalize((0 until arr.length()).map { arr.getString(it) })
    }

    /** Throws on network failure (the UI shows the error). */
    fun fetch(source: String): List<String> = when (source) {
        "builtin" -> normalize(CLOUDFLARE_CORE + FASTLY)
        "cloudflare" -> fetchCloudflareV4()
        "cloudflare_v6" -> fetchCloudflareV6()
        "fastly" -> fetchFastly()
        "all" -> {
            val out = ArrayList<String>()
            for (f in listOf({ fetchCloudflareV4() }, { fetchFastly() })) {
                try { out.addAll(f()) } catch (e: Exception) { /* one source down is not fatal */ }
            }
            if (out.isEmpty()) throw IllegalStateException("No source reachable")
            normalize(out + CLOUDFLARE_CORE)
        }
        else -> throw IllegalArgumentException("Unknown source: $source")
    }
}

/** Operator labels (same table as app/scanner/operators.py). The phone is already on the
 *  operator's network, so results are simply tagged with the chosen operator. */
object Operators {
    data class Operator(val key: String, val name: String, val nameFa: String)
    val BY_COUNTRY: Map<String, List<Operator>> = mapOf(
        "ir" to listOf(
            Operator("irancell", "Irancell", "ایرانسل"), Operator("mci", "MCI", "همراه اول"),
            Operator("rightel", "Rightel", "رایتل"), Operator("shuttle", "Shuttle", "شاتل"),
        ),
        "cn" to listOf(
            Operator("china_mobile", "China Mobile", "چاینا موبایل"), Operator("china_unicom", "China Unicom", "چاینا یونیکام"),
            Operator("china_telecom", "China Telecom", "چاینا تلکام"), Operator("china_broadnet", "China Broadnet", "چاینا برادنت"),
        ),
        "ru" to listOf(
            Operator("mts", "MTS", "ام‌تی‌اس"), Operator("megafon", "MegaFon", "مگافون"),
            Operator("beeline", "Beeline", "بیلاین"), Operator("tele2", "Tele2 Russia", "تله‌۲"),
        ),
    )
    val ALL: List<Operator> get() = BY_COUNTRY.values.flatten()
}
