package com.shahinst.cdnscanner.net

import com.shahinst.cdnscanner.data.Prefs
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.URL

object Telegram {
    private fun proxyOf(spec: String): Proxy {
        val s = spec.trim()
        if (s.isEmpty()) return Proxy.NO_PROXY
        val type = if (s.startsWith("socks")) Proxy.Type.SOCKS else Proxy.Type.HTTP
        val hp = s.substringAfter("://").substringAfter("@").trimEnd { it == '/' }
        val host = hp.substringBeforeLast(":")
        val port = hp.substringAfterLast(":").toIntOrNull() ?: (if (type == Proxy.Type.SOCKS) 1080 else 8080)
        return Proxy(type, InetSocketAddress(host, port))
    }

    /** Returns (ok, error). Never includes the token in the error text. */
    fun send(text: String, token: String = Prefs.telegramToken, chatId: String = Prefs.telegramChatId,
             proxy: String = Prefs.telegramProxy): Pair<Boolean, String> {
        if (token.isBlank() || chatId.isBlank()) return false to "not configured"
        return try {
            val conn = URL("https://api.telegram.org/bot$token/sendMessage").openConnection(proxyOf(proxy)) as HttpURLConnection
            conn.connectTimeout = 20000
            conn.readTimeout = 20000
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(JSONObject().put("chat_id", chatId).put("text", text).toString().toByteArray()) }
            val code = conn.responseCode
            val body = (if (code == 200) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            val json = try { JSONObject(body) } catch (e: Exception) { JSONObject() }
            if (code == 200 && json.optBoolean("ok")) true to ""
            else false to (json.optString("description").ifEmpty { "HTTP $code" })
        } catch (e: Exception) { false to (e::class.java.simpleName) }
    }
}
