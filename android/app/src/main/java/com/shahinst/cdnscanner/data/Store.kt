package com.shahinst.cdnscanner.data

import android.content.Context
import com.shahinst.cdnscanner.scan.Favorite
import com.shahinst.cdnscanner.scan.FoundIp
import com.shahinst.cdnscanner.scan.ScanSession
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Scan history and favorites as JSON files in the app's private storage. */
object Store {
    private lateinit var dir: File
    private const val MAX_SESSIONS = 50
    val favorites = MutableStateFlow<List<Favorite>>(emptyList())
    val sessions = MutableStateFlow<List<ScanSession>>(emptyList())

    fun init(ctx: Context) {
        dir = File(ctx.filesDir, "store").apply { mkdirs() }
        favorites.value = readFavorites()
        sessions.value = readSessions()
    }

    private fun file(name: String) = File(dir, name)
    private fun readJsonArray(name: String): JSONArray = try {
        val f = file(name); if (f.exists()) JSONArray(f.readText()) else JSONArray()
    } catch (e: Exception) { JSONArray() }
    private fun write(name: String, arr: JSONArray) {
        val tmp = file("$name.tmp"); tmp.writeText(arr.toString()); tmp.renameTo(file(name))
    }

    // ---- results ---------------------------------------------------------------------
    fun foundToJson(r: FoundIp): JSONObject = JSONObject()
        .put("ip", r.ip).put("ping", r.ping ?: JSONObject.NULL).put("open_ports", JSONArray(r.openPorts))
        .put("score", r.score).put("colo", r.colo).put("operator", r.operator)
        .put("speed", r.speed ?: JSONObject.NULL).put("real_delay", r.realDelay ?: JSONObject.NULL)
        .put("alive", r.alive).put("config", r.config ?: JSONObject.NULL)

    fun foundFromJson(o: JSONObject): FoundIp {
        val ports = o.optJSONArray("open_ports") ?: JSONArray()
        return FoundIp(
            ip = o.getString("ip"), ping = if (o.isNull("ping")) null else o.getDouble("ping"),
            openPorts = (0 until ports.length()).map { ports.getInt(it) }, score = o.optDouble("score", 0.0),
            colo = o.optString("colo"), operator = o.optString("operator"),
            speed = if (o.isNull("speed")) null else o.getDouble("speed"),
            realDelay = if (o.isNull("real_delay")) null else o.getDouble("real_delay"),
            alive = o.optBoolean("alive", true), config = if (o.isNull("config")) null else o.getString("config"),
        )
    }

    // ---- sessions --------------------------------------------------------------------
    private fun sessionFromJson(o: JSONObject) = ScanSession(
        id = o.getLong("id"), method = o.optString("method", "cloud"), mode = o.optString("mode", "hyper"),
        totalScanned = o.optInt("total_scanned"), totalFound = o.optInt("total_found"),
        duration = o.optDouble("duration", 0.0), status = o.optString("status", "completed"),
        v2rayConfig = o.optString("v2ray_config"), operator = o.optString("operator"),
    )

    private fun sessionToJson(s: ScanSession) = JSONObject()
        .put("id", s.id).put("method", s.method).put("mode", s.mode).put("total_scanned", s.totalScanned)
        .put("total_found", s.totalFound).put("duration", s.duration).put("status", s.status)
        .put("v2ray_config", s.v2rayConfig).put("operator", s.operator)

    private fun readSessions(): List<ScanSession> {
        val arr = readJsonArray("sessions.json")
        return (0 until arr.length()).map { sessionFromJson(arr.getJSONObject(it)) }.sortedByDescending { it.id }
    }

    @Synchronized
    fun saveSession(s: ScanSession, results: List<FoundIp>) {
        val list = sessions.value.filter { it.id != s.id }.toMutableList()
        list.add(0, s)
        while (list.size > MAX_SESSIONS) { val old = list.removeAt(list.size - 1); file("results-${old.id}.json").delete() }
        write("sessions.json", JSONArray(list.map { sessionToJson(it) }))
        write("results-${s.id}.json", JSONArray(results.map { foundToJson(it) }))
        sessions.value = list
    }

    fun results(sessionId: Long): List<FoundIp> {
        val arr = readJsonArray("results-$sessionId.json")
        return (0 until arr.length()).map { foundFromJson(arr.getJSONObject(it)) }
    }

    @Synchronized
    fun updateResults(sessionId: Long, results: List<FoundIp>) {
        if (sessions.value.none { it.id == sessionId }) return
        write("results-$sessionId.json", JSONArray(results.map { foundToJson(it) }))
    }

    @Synchronized
    fun deleteAllSessions() {
        dir.listFiles()?.filter { it.name.startsWith("results-") }?.forEach { it.delete() }
        write("sessions.json", JSONArray())
        sessions.value = emptyList()
    }

    // ---- favorites -------------------------------------------------------------------
    private fun readFavorites(): List<Favorite> {
        val arr = readJsonArray("favorites.json")
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val checks = o.optJSONArray("checks") ?: JSONArray()
            Favorite(
                ip = o.getString("ip"), port = o.optInt("port", 443), label = o.optString("label"),
                lastOk = if (o.isNull("last_ok")) null else o.getBoolean("last_ok"),
                lastPing = if (o.isNull("last_ping")) null else o.getDouble("last_ping"),
                lastColo = o.optString("last_colo"), lastCheck = o.optLong("last_check"),
                checks = (0 until checks.length()).map { val c = checks.getJSONArray(it); c.getLong(0) to c.getBoolean(1) },
            )
        }
    }

    @Synchronized
    fun saveFavorites(list: List<Favorite>) {
        val arr = JSONArray(list.map { f ->
            JSONObject().put("ip", f.ip).put("port", f.port).put("label", f.label)
                .put("last_ok", f.lastOk ?: JSONObject.NULL).put("last_ping", f.lastPing ?: JSONObject.NULL)
                .put("last_colo", f.lastColo).put("last_check", f.lastCheck)
                .put("checks", JSONArray(f.checks.map { JSONArray().put(it.first).put(it.second) }))
        })
        write("favorites.json", arr)
        favorites.value = list
    }

    fun addFavorite(ip: String, port: Int, ping: Double?, colo: String) {
        if (favorites.value.any { it.ip == ip }) return
        saveFavorites(favorites.value + Favorite(ip = ip, port = port, lastPing = ping, lastColo = colo))
    }

    fun removeFavorite(ip: String) = saveFavorites(favorites.value.filter { it.ip != ip })
}
