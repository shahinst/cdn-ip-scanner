package com.shahinst.cdnscanner.ui

import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.os.LocaleListCompat
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Prefs
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.monitor.MonitorWorker
import com.shahinst.cdnscanner.net.Telegram
import com.shahinst.cdnscanner.scan.Ranges
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
    content()
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

private fun newerVersion(remote: String, local: String): Boolean {
    fun ver(v: String) = v.trim().split('.').map { it.toIntOrNull() ?: 0 }
    val r = ver(remote); val l = ver(local)
    for (i in 0 until maxOf(r.size, l.size)) {
        val a = r.getOrElse(i) { 0 }; val b = l.getOrElse(i) { 0 }
        if (a != b) return a > b
    }
    return false
}

@Composable
fun SettingsScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var theme by remember { mutableStateOf(Prefs.theme) }
    var language by remember { mutableStateOf(Prefs.language) }
    var debug by remember { mutableStateOf(Prefs.debugLog) }
    var speed by remember { mutableStateOf(Prefs.speedTest) }
    var speedSize by remember { mutableStateOf(Prefs.speedTestSize.toString()) }
    var speedCount by remember { mutableStateOf(Prefs.speedTestCount.toString()) }
    var speedUrl by remember { mutableStateOf(Prefs.speedTestUrl) }
    var cfgTest by remember { mutableStateOf(Prefs.configTest) }
    var cfgCount by remember { mutableStateOf(Prefs.configTestCount.toString()) }
    var monitor by remember { mutableStateOf(Prefs.monitorInterval.toString()) }
    var tgToken by remember { mutableStateOf(Prefs.telegramToken) }
    var tgChat by remember { mutableStateOf(Prefs.telegramChatId) }
    var tgProxy by remember { mutableStateOf(Prefs.telegramProxy) }
    var notify by remember { mutableStateOf(Prefs.notifyScanComplete) }
    var pingMin by remember { mutableStateOf(Prefs.pingMin.toString()) }
    val version = remember { appVersion(ctx) }

    fun save() {
        Prefs.theme = theme; Prefs.debugLog = debug; Prefs.pingMin = pingMin.toIntOrNull() ?: 0
        Prefs.speedTest = speed; Prefs.speedTestSize = speedSize.toIntOrNull() ?: 1024
        Prefs.speedTestCount = speedCount.toIntOrNull() ?: 5; Prefs.speedTestUrl = speedUrl
        Prefs.configTest = cfgTest; Prefs.configTestCount = cfgCount.toIntOrNull() ?: 20
        Prefs.monitorInterval = monitor.toIntOrNull() ?: 0; MonitorWorker.schedule(ctx, Prefs.monitorInterval)
        Prefs.telegramToken = tgToken.trim(); Prefs.telegramChatId = tgChat.trim(); Prefs.telegramProxy = tgProxy.trim()
        Prefs.notifyScanComplete = notify
        toast(ctx, ctx.getString(R.string.saved))
        if (language != Prefs.language) {
            Prefs.language = language
            AppCompatDelegate.setApplicationLocales(if (language == "system") LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(language))
        }
    }

    fun diagnostics(): String {
        val last = Store.sessions.value.firstOrNull()
        val lastLine = last?.let { "${fmtDateTime(it.id)} ${it.method}/${it.mode} ${it.status} found=${it.totalFound} scanned=${it.totalScanned} ${it.duration}s" } ?: "none"
        return "CDN IP Scanner Android $version\n" +
            "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) ${Build.MANUFACTURER} ${Build.MODEL}\n" +
            "mode=${Prefs.mode} target=${Prefs.targetCount} ping=${Prefs.pingMin}-${Prefs.pingMax} ports=${Prefs.ports} method=${Prefs.scanMethod}\n" +
            "speed_test=${Prefs.speedTest}/${Prefs.speedTestSize}KB/${Prefs.speedTestCount} config_test=${Prefs.configTest}/${Prefs.configTestCount}\n" +
            "monitor=${Prefs.monitorInterval}min telegram=${if (Prefs.telegramToken.isNotBlank()) "configured" else "off"} favorites=${Store.favorites.value.size}\n" +
            "last_scan=$lastLine\n"
    }

    fun checkUpdate() {
        scope.launch {
            val remote = try { withContext(Dispatchers.IO) { Ranges.get("https://raw.githubusercontent.com/shahinst/cdn-ip-scanner/main/version").trim() } } catch (e: Exception) { "" }
            toast(ctx, when {
                remote.isEmpty() -> ctx.getString(R.string.update_check_failed)
                newerVersion(remote, version) -> ctx.getString(R.string.update_available, remote)
                else -> ctx.getString(R.string.up_to_date)
            })
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Section(stringResource(R.string.settings_general)) {
            DropdownField(stringResource(R.string.theme), listOf("system" to stringResource(R.string.theme_system), "light" to stringResource(R.string.theme_light), "dark" to stringResource(R.string.theme_dark)), theme, { theme = it }, Modifier.fillMaxWidth())
            DropdownField(stringResource(R.string.language), listOf("system" to stringResource(R.string.lang_system), "en" to "English", "fa" to "فارسی", "zh" to "中文", "ru" to "Русский"), language, { language = it }, Modifier.fillMaxWidth())
            NumberField(stringResource(R.string.ping_min), pingMin, { pingMin = it }, Modifier.fillMaxWidth())
            SwitchRow(stringResource(R.string.debug_log), debug) { debug = it }
        }
        Section(stringResource(R.string.settings_speed)) {
            SwitchRow(stringResource(R.string.speed_enable), speed) { speed = it }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(stringResource(R.string.speed_size), speedSize, { speedSize = it }, Modifier.weight(1f))
                NumberField(stringResource(R.string.speed_count), speedCount, { speedCount = it }, Modifier.weight(1f))
            }
            OutlinedTextField(value = speedUrl, onValueChange = { speedUrl = it }, label = { Text(stringResource(R.string.speed_url)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
        Section(stringResource(R.string.settings_config_test)) {
            SwitchRow(stringResource(R.string.config_test_enable), cfgTest) { cfgTest = it }
            NumberField(stringResource(R.string.config_test_count), cfgCount, { cfgCount = it }, Modifier.fillMaxWidth())
        }
        Section(stringResource(R.string.settings_monitor)) {
            DropdownField(stringResource(R.string.monitor_interval), listOf("0" to stringResource(R.string.monitor_off), "15" to "15", "30" to "30", "60" to "60", "180" to "180"), monitor, { monitor = it }, Modifier.fillMaxWidth())
            Text(stringResource(R.string.monitor_note), style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(value = tgToken, onValueChange = { tgToken = it }, label = { Text(stringResource(R.string.tg_token)) }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = tgChat, onValueChange = { tgChat = it }, label = { Text(stringResource(R.string.tg_chat)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = tgProxy, onValueChange = { tgProxy = it }, label = { Text(stringResource(R.string.tg_proxy)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            SwitchRow(stringResource(R.string.notify_scan_complete), notify) { notify = it }
            OutlinedButton(onClick = {
                scope.launch {
                    val (ok, err) = withContext(Dispatchers.IO) { Telegram.send("CDN IP Scanner: test message", tgToken.trim(), tgChat.trim(), tgProxy.trim()) }
                    toast(ctx, if (ok) ctx.getString(R.string.tg_sent) else ctx.getString(R.string.tg_failed, err))
                }
            }) { Text(stringResource(R.string.tg_test)) }
        }
        Button(onClick = { save() }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.save)) }
        Section(stringResource(R.string.settings_about)) {
            Text(stringResource(R.string.version, version))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { openUrl(ctx, "https://github.com/shahinst/cdn-ip-scanner") }) { Text(stringResource(R.string.github)) }
                OutlinedButton(onClick = { checkUpdate() }) { Text(stringResource(R.string.check_update)) }
            }
            OutlinedButton(onClick = { shareText(ctx, diagnostics(), "text/plain", "cdn-ip-scanner-diagnostics.txt") }, modifier = Modifier.padding(bottom = 24.dp)) { Text(stringResource(R.string.diagnostics)) }
        }
    }
}
