package com.shahinst.cdnscanner.data

import android.content.Context
import android.content.SharedPreferences
import com.shahinst.cdnscanner.scan.SpeedTest
import kotlinx.coroutines.flow.MutableStateFlow

/** Settings (same keys and defaults as SETTINGS_DEFAULTS in app/routes/api.py). */
object Prefs {
    private lateinit var sp: SharedPreferences
    /** Bumped on every write so Compose screens re-read the values. */
    val changes = MutableStateFlow(0)

    fun init(ctx: Context) { sp = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE) }

    private fun str(key: String, def: String) = sp.getString(key, def) ?: def
    private fun put(key: String, value: String) { sp.edit().putString(key, value).apply(); changes.value++ }
    private fun bool(key: String, def: Boolean) = str(key, def.toString()) == "true"
    private fun int(key: String, def: Int, lo: Int, hi: Int) = (str(key, def.toString()).toIntOrNull() ?: def).coerceIn(lo, hi)

    var theme: String get() = str("theme", "system"); set(v) = put("theme", v)
    var language: String get() = str("language", "system"); set(v) = put("language", v)
    var mode: String get() = str("mode", "hyper"); set(v) = put("mode", v)
    var profile: String get() = str("profile", "mobile"); set(v) = put("profile", v)
    var targetCount: Int get() = int("target_count", 10, 1, 1000); set(v) = put("target_count", v.toString())
    var pingMin: Int get() = int("ping_min", 0, 0, 60000); set(v) = put("ping_min", v.toString())
    var pingMax: Int get() = int("ping_max", 1500, 1, 60000); set(v) = put("ping_max", v.toString())
    var ports: String get() = str("scan_ports", "443,8443"); set(v) = put("scan_ports", v)
    var scanMethod: String get() = str("scan_method", "cloud"); set(v) = put("scan_method", v)
    var rangesText: String get() = str("ranges_text", ""); set(v) = put("ranges_text", v)
    var rangeSource: String get() = str("range_source", "builtin"); set(v) = put("range_source", v)
    var v2rayConfig: String get() = str("v2ray_config", ""); set(v) = put("v2ray_config", v)
    var operator: String get() = str("operator", ""); set(v) = put("operator", v)
    var speedTest: Boolean get() = bool("speed_test", false); set(v) = put("speed_test", v.toString())
    var speedTestSize: Int get() = int("speed_test_size", 1024, 64, 51200); set(v) = put("speed_test_size", v.toString())
    var speedTestCount: Int get() = int("speed_test_count", 5, 1, 200); set(v) = put("speed_test_count", v.toString())
    var speedTestUrl: String get() = str("speed_test_url", SpeedTest.DEFAULT_URL); set(v) = put("speed_test_url", v)
    var configTest: Boolean get() = bool("config_test", true); set(v) = put("config_test", v.toString())
    var configTestCount: Int get() = int("config_test_count", 20, 1, 500); set(v) = put("config_test_count", v.toString())
    var monitorInterval: Int get() = int("monitor_interval", 0, 0, 1440); set(v) = put("monitor_interval", v.toString())
    var telegramToken: String get() = str("telegram_token", ""); set(v) = put("telegram_token", v)
    var telegramChatId: String get() = str("telegram_chat_id", ""); set(v) = put("telegram_chat_id", v)
    var telegramProxy: String get() = str("telegram_proxy", ""); set(v) = put("telegram_proxy", v)
    var notifyScanComplete: Boolean get() = bool("notify_scan_complete", false); set(v) = put("notify_scan_complete", v.toString())
    var debugLog: Boolean get() = bool("debug_enabled", false); set(v) = put("debug_enabled", v.toString())

    fun portList(): List<Int> = parsePorts(ports)

    fun parsePorts(text: String): List<Int> =
        text.split(",", " ", ";").mapNotNull { it.trim().toIntOrNull() }.filter { it in 1..65535 }.distinct().ifEmpty { listOf(443) }

    /** Scan profiles (same values as PROFILES in app/static/js/app.js). */
    data class Profile(val mode: String, val target: Int, val pingMax: Int, val ports: String)
    val PROFILES = mapOf(
        "quick" to Profile("hyper", 20, 1000, "443"),
        "balanced" to Profile("turbo", 50, 2000, "443,80,8443"),
        "thorough" to Profile("deep", 100, 9999, "443,80,8443,2053,2083,2087,2096"),
        "mobile" to Profile("hyper", 10, 1500, "443,8443"),
    )
}
