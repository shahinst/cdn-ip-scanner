package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Prefs
import com.shahinst.cdnscanner.scan.ConfigTestOptions
import com.shahinst.cdnscanner.scan.Operators
import com.shahinst.cdnscanner.scan.Ranges
import com.shahinst.cdnscanner.scan.ScanEngine
import com.shahinst.cdnscanner.scan.ScanParams
import com.shahinst.cdnscanner.scan.ScanPhase
import com.shahinst.cdnscanner.scan.SpeedTestOptions
import com.shahinst.cdnscanner.scan.V2Ray
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ScanScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by ScanEngine.state.collectAsState()
    val logs by ScanEngine.logs.collectAsState()
    val speedHist by ScanEngine.speedHistory.collectAsState()
    var method by remember { mutableStateOf(Prefs.scanMethod) }
    var config by remember { mutableStateOf(Prefs.v2rayConfig) }
    var source by remember { mutableStateOf(Prefs.rangeSource) }
    var rangesText by remember { mutableStateOf(Prefs.rangesText) }
    var profile by remember { mutableStateOf(Prefs.profile) }
    var mode by remember { mutableStateOf(Prefs.mode) }
    var target by remember { mutableStateOf(Prefs.targetCount.toString()) }
    var pingMax by remember { mutableStateOf(Prefs.pingMax.toString()) }
    var ports by remember { mutableStateOf(Prefs.ports) }
    var operator by remember { mutableStateOf(Prefs.operator) }
    var busy by remember { mutableStateOf(false) }
    val parsed = remember(config) { V2Ray.parse(config) }

    fun persist() {
        Prefs.scanMethod = method; Prefs.v2rayConfig = config; Prefs.rangeSource = source; Prefs.rangesText = rangesText
        Prefs.profile = profile; Prefs.mode = mode; Prefs.targetCount = target.toIntOrNull() ?: 10
        Prefs.pingMax = pingMax.toIntOrNull() ?: 1500; Prefs.ports = ports; Prefs.operator = operator
    }

    fun start() {
        persist()
        busy = true
        scope.launch {
            val ranges = try {
                withContext(Dispatchers.IO) { if (rangesText.isBlank()) Ranges.fetch(source) else Ranges.parseText(rangesText) }
            } catch (e: Exception) { toast(ctx, ctx.getString(R.string.fetch_failed, e.message ?: e.toString())); busy = false; return@launch }
            val opName = Operators.ALL.firstOrNull { it.key == operator }?.name ?: ""
            val params = ScanParams(method, ranges, mode, Prefs.targetCount, Prefs.pingMin, Prefs.pingMax, Prefs.portList(), config, opName,
                SpeedTestOptions(Prefs.speedTest, Prefs.speedTestSize, Prefs.speedTestCount, Prefs.speedTestUrl),
                ConfigTestOptions(Prefs.configTest, Prefs.configTestCount))
            ScanEngine.start(params)?.let { toast(ctx, ctx.getString(it)) }
            busy = false
        }
    }

    fun fetch() {
        busy = true
        scope.launch {
            try {
                val r = withContext(Dispatchers.IO) { Ranges.fetch(source) }
                rangesText = r.joinToString("\n")
                toast(ctx, ctx.getString(R.string.ranges_count, r.size))
            } catch (e: Exception) { toast(ctx, ctx.getString(R.string.fetch_failed, e.message ?: e.toString())) }
            busy = false
        }
    }

    val statusText = when (state.phase) {
        ScanPhase.IDLE -> stringResource(R.string.status_idle)
        ScanPhase.SCANNING -> stringResource(R.string.status_scanning, state.percent.toInt(), state.speed)
        ScanPhase.CONFIG_TEST -> stringResource(R.string.status_config_test, state.done, state.total)
        ScanPhase.SPEED_TEST -> stringResource(R.string.status_speed_test, state.done, state.total)
        ScanPhase.RETEST -> stringResource(R.string.status_retest, state.done, state.total)
        ScanPhase.DONE -> stringResource(R.string.status_done, state.found, state.elapsed.toInt())
        ScanPhase.STOPPED -> stringResource(R.string.status_stopped)
        ScanPhase.ERROR -> stringResource(R.string.status_error, state.error)
    }

    LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Column(Modifier.padding(12.dp)) {
                    LinearProgressIndicator(progress = { (state.percent / 100.0).toFloat() }, modifier = Modifier.fillMaxWidth())
                    Text(statusText, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${stringResource(R.string.found)}: ${state.found}")
                        Text("${stringResource(R.string.scanned)}: ${state.done}")
                        Text("${stringResource(R.string.elapsed)}: ${state.elapsed.toInt()}s")
                    }
                    if (speedHist.size >= 2) {
                        Text(stringResource(R.string.chart_speed), style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 6.dp))
                        Sparkline(speedHist, Modifier.fillMaxWidth().height(60.dp))
                    }
                    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { start() }, enabled = !state.running && !busy, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.start_scan)) }
                        OutlinedButton(onClick = { ScanEngine.stop() }, enabled = state.running, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.stop_scan)) }
                    }
                }
            }
        }
        item {
            Text(stringResource(R.string.method), style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = method == "cloud", onClick = { method = "cloud" }, label = { Text(stringResource(R.string.method_cloud)) })
                FilterChip(selected = method == "v2ray", onClick = { method = "v2ray" }, label = { Text(stringResource(R.string.method_v2ray)) })
            }
        }
        if (method == "v2ray") item {
            OutlinedTextField(value = config, onValueChange = { config = it }, label = { Text(stringResource(R.string.v2ray_config)) },
                minLines = 2, maxLines = 4, modifier = Modifier.fillMaxWidth())
            Text(if (parsed != null) stringResource(R.string.v2ray_parsed, parsed.protocol, parsed.params["host"] ?: parsed.ip, parsed.port)
                 else stringResource(R.string.v2ray_hint), style = MaterialTheme.typography.bodySmall)
        }
        item {
            Text(stringResource(R.string.ranges), style = MaterialTheme.typography.titleSmall)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DropdownField(stringResource(R.string.range_source), listOf(
                    "builtin" to stringResource(R.string.src_builtin), "cloudflare" to stringResource(R.string.src_cloudflare),
                    "cloudflare_v6" to stringResource(R.string.src_cloudflare_v6), "fastly" to stringResource(R.string.src_fastly),
                    "all" to stringResource(R.string.src_all)), source, { source = it }, Modifier.weight(1f))
                OutlinedButton(onClick = { fetch() }, enabled = !busy, modifier = Modifier.padding(top = 8.dp)) { Text(stringResource(R.string.fetch_ranges)) }
            }
            OutlinedTextField(value = rangesText, onValueChange = { rangesText = it }, label = { Text(stringResource(R.string.ranges_hint)) },
                minLines = 2, maxLines = 6, modifier = Modifier.fillMaxWidth(), textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace))
        }
        item {
            Text(stringResource(R.string.profile), style = MaterialTheme.typography.titleSmall)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("mobile" to R.string.profile_mobile, "quick" to R.string.profile_quick, "balanced" to R.string.profile_balanced,
                    "thorough" to R.string.profile_thorough, "custom" to R.string.profile_custom).forEach { (key, label) ->
                    FilterChip(selected = profile == key, onClick = {
                        profile = key
                        Prefs.PROFILES[key]?.let { mode = it.mode; target = it.target.toString(); pingMax = it.pingMax.toString(); ports = it.ports }
                    }, label = { Text(stringResource(label)) })
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DropdownField(stringResource(R.string.mode), listOf("hyper" to stringResource(R.string.mode_hyper), "turbo" to stringResource(R.string.mode_turbo),
                    "ultra" to stringResource(R.string.mode_ultra), "deep" to stringResource(R.string.mode_deep)), mode, { mode = it; profile = "custom" }, Modifier.weight(1f))
                NumberField(stringResource(R.string.target_count), target, { target = it; profile = "custom" }, Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField(stringResource(R.string.ping_max), pingMax, { pingMax = it; profile = "custom" }, Modifier.weight(1f))
                OutlinedTextField(value = ports, onValueChange = { ports = it; profile = "custom" }, label = { Text(stringResource(R.string.ports)) }, singleLine = true, modifier = Modifier.weight(1f))
            }
            DropdownField(stringResource(R.string.operator), listOf("" to stringResource(R.string.operator_none)) + Operators.ALL.map { it.key to it.name },
                operator, { operator = it }, Modifier.fillMaxWidth())
        }
        item {
            Text(stringResource(R.string.log), style = MaterialTheme.typography.titleSmall)
            Column(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                logs.takeLast(40).forEach { l ->
                    Text("[${l.level}] ${l.message}", style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        color = when (l.level) { "ERROR" -> MaterialTheme.colorScheme.error; "WARN" -> MaterialTheme.colorScheme.tertiary; else -> MaterialTheme.colorScheme.onSurfaceVariant })
                }
            }
            Spacer(Modifier.width(1.dp))
        }
    }
}
