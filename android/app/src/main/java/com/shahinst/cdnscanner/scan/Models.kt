package com.shahinst.cdnscanner.scan

/** One working CDN IP. Immutable: updates replace the item with a copy. */
data class FoundIp(
    val ip: String,
    val ping: Double?,
    val openPorts: List<Int>,
    val score: Double = 0.0,
    val colo: String = "",
    val operator: String = "",
    val speed: Double? = null,       // KB/s, null = not measured
    val realDelay: Double? = null,   // ms through the user's config; null = not tested, <0 = failed
    val alive: Boolean = true,       // false after a re-test that could not reach the IP
    val config: String? = null,      // V2Ray link rebuilt with this IP
)

data class ScanSession(
    val id: Long,                    // epoch millis of the start
    val method: String,              // cloud | v2ray
    val mode: String,
    val totalScanned: Int,
    val totalFound: Int,
    val duration: Double,
    val status: String,              // completed | stopped | error
    val v2rayConfig: String = "",
    val operator: String = "",
)

data class Favorite(
    val ip: String,
    val port: Int = 443,
    val label: String = "",
    val lastOk: Boolean? = null,
    val lastPing: Double? = null,
    val lastColo: String = "",
    val lastCheck: Long = 0,
    val checks: List<Pair<Long, Boolean>> = emptyList(),   // (epoch millis, ok), last 30 days
) {
    fun uptime24h(): Double? {
        val since = System.currentTimeMillis() - 24L * 3600 * 1000
        val recent = checks.filter { it.first >= since }
        if (recent.isEmpty()) return null
        return recent.count { it.second } * 100.0 / recent.size
    }
}

data class LogLine(val time: Long, val level: String, val message: String)

enum class ScanPhase { IDLE, SCANNING, CONFIG_TEST, SPEED_TEST, RETEST, DONE, STOPPED, ERROR }

data class ScanState(
    val phase: ScanPhase = ScanPhase.IDLE,
    val sessionId: Long = 0,
    val done: Int = 0,
    val total: Int = 0,
    val found: Int = 0,
    val target: Int = 0,
    val speed: Double = 0.0,        // IPs per second
    val elapsed: Double = 0.0,
    val error: String = "",
) {
    val running get() = phase == ScanPhase.SCANNING || phase == ScanPhase.CONFIG_TEST ||
            phase == ScanPhase.SPEED_TEST || phase == ScanPhase.RETEST
    val percent get() = if (total > 0) (done * 100.0 / total).coerceIn(0.0, 100.0) else 0.0
}

data class SpeedTestOptions(val enabled: Boolean, val sizeKb: Int, val count: Int, val url: String)
data class ConfigTestOptions(val enabled: Boolean, val count: Int)

data class ScanParams(
    val method: String,              // cloud | v2ray
    val ranges: List<String>,
    val mode: String,
    val targetCount: Int,
    val pingMin: Int,
    val pingMax: Int,
    val ports: List<Int>,
    val v2rayConfig: String,
    val operator: String,
    val speedTest: SpeedTestOptions,
    val configTest: ConfigTestOptions,
)
