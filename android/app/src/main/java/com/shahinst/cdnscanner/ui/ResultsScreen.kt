package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.scan.ClientExport
import com.shahinst.cdnscanner.scan.Colo
import com.shahinst.cdnscanner.scan.FoundIp
import com.shahinst.cdnscanner.scan.ScanEngine
import com.shahinst.cdnscanner.scan.V2Ray

@Composable
fun ResultsScreen() {
    val ctx = LocalContext.current
    val results by ScanEngine.results.collectAsState()
    val state by ScanEngine.state.collectAsState()
    val favs by Store.favorites.collectAsState()
    var filter by remember { mutableStateOf("") }
    var colo by remember { mutableStateOf("") }
    var sort by remember { mutableStateOf("score") }
    var hideFailed by remember { mutableStateOf(false) }
    var exportMenu by remember { mutableStateOf(false) }
    var qrText by remember { mutableStateOf<String?>(null) }
    val parsed = ScanEngine.parsedConfig
    val colos = remember(results) { results.map { it.colo }.filter { it.isNotEmpty() }.distinct().sorted() }
    val shown = remember(results, filter, colo, sort, hideFailed) {
        results.filter {
            (filter.isEmpty() || it.ip.contains(filter) || it.colo.contains(filter, true) || Colo.name(it.colo).contains(filter, true)) &&
            (colo.isEmpty() || it.colo == colo) &&
            (!hideFailed || (it.alive && (it.realDelay == null || it.realDelay >= 0)))
        }.sortedWith(when (sort) {
            "ping" -> compareBy { it.ping ?: 1e9 }
            "speed" -> compareByDescending { it.speed ?: -1.0 }
            else -> compareByDescending { it.score }
        })
    }
    val working = shown.filter { it.alive && (it.realDelay == null || it.realDelay >= 0) }
    val workingIps = working.map { it.ip }
    val configs = working.mapNotNull { it.config }

    fun share(text: String, mime: String, name: String) {
        try { shareText(ctx, text, mime, name) } catch (e: Exception) { toast(ctx, ctx.getString(R.string.export_error, e.message ?: "")) }
    }
    fun shareClient(build: () -> String, mime: String, name: String) {
        val text = try { build() } catch (e: Exception) { toast(ctx, ctx.getString(R.string.export_error, e.message ?: "")); return }
        share(text, mime, name)
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = filter, onValueChange = { filter = it }, label = { Text(stringResource(R.string.filter_hint)) }, singleLine = true, modifier = Modifier.weight(1.3f))
            DropdownField(stringResource(R.string.all_colos), listOf("" to stringResource(R.string.all_colos)) + colos.map { it to Colo.label(it) }, colo, { colo = it }, Modifier.weight(1f))
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf("score" to R.string.sort_score, "ping" to R.string.sort_ping, "speed" to R.string.sort_speed).forEach { (k, l) ->
                FilterChip(selected = sort == k, onClick = { sort = k }, label = { Text(stringResource(l)) })
            }
            Checkbox(checked = hideFailed, onCheckedChange = { hideFailed = it })
            Text(stringResource(R.string.hide_failed))
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box {
                OutlinedButton(onClick = { exportMenu = true }, enabled = shown.isNotEmpty()) { Text(stringResource(R.string.export)) }
                DropdownMenu(expanded = exportMenu, onDismissRequest = { exportMenu = false }) {
                    DropdownMenuItem(text = { Text(stringResource(R.string.export_txt)) }, onClick = { exportMenu = false; share(Export.txt(shown), "text/plain", "scan_ips.txt") })
                    DropdownMenuItem(text = { Text(stringResource(R.string.export_json)) }, onClick = { exportMenu = false; share(Export.json(shown), "application/json", "scan_results.json") })
                    DropdownMenuItem(text = { Text(stringResource(R.string.export_csv)) }, onClick = { exportMenu = false; share(Export.csv(shown), "text/csv", "scan_results.csv") })
                }
            }
            OutlinedButton(onClick = {
                val best = workingIps.take(10)
                copyText(ctx, best.joinToString("\n"))
                toast(ctx, ctx.getString(R.string.copied_best, best.size))
            }, enabled = working.isNotEmpty()) { Text(stringResource(R.string.copy_best)) }
            OutlinedButton(onClick = { ScanEngine.retest()?.let { toast(ctx, ctx.getString(it)) } }, enabled = results.isNotEmpty() && !state.running) { Text(stringResource(R.string.retest)) }
            if (parsed != null) {
                OutlinedButton(onClick = { copyText(ctx, V2Ray.subscription(configs)); toast(ctx, ctx.getString(R.string.sub_copied)) }, enabled = configs.isNotEmpty()) { Text(stringResource(R.string.subscription)) }
                OutlinedButton(onClick = { copyText(ctx, configs.joinToString("\n")); toast(ctx, ctx.getString(R.string.configs_copied, configs.size)) }, enabled = configs.isNotEmpty()) { Text(stringResource(R.string.copy_all_configs)) }
                OutlinedButton(onClick = { shareClient({ ClientExport.clash(parsed, workingIps) }, "text/yaml", "clash-cdn-ips.yaml") }, enabled = working.isNotEmpty()) { Text(stringResource(R.string.export_clash)) }
                OutlinedButton(onClick = { shareClient({ ClientExport.singbox(parsed, workingIps) }, "application/json", "singbox-cdn-ips.json") }, enabled = working.isNotEmpty()) { Text(stringResource(R.string.export_singbox)) }
            }
            OutlinedButton(onClick = { ScanEngine.clear() }, enabled = results.isNotEmpty() && !state.running) { Text(stringResource(R.string.clear_results)) }
        }
        if (shown.isEmpty()) Text(stringResource(R.string.results_empty), modifier = Modifier.padding(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxSize()) {
            items(shown, key = { it.ip }) { r ->
                ResultRow(r, shown.indexOf(r) + 1, favs.any { it.ip == r.ip }, parsed != null, onQr = { qrText = r.config })
            }
        }
    }
    qrText?.let { QrDialog(it) { qrText = null } }
}

@Composable
private fun ResultRow(r: FoundIp, rank: Int, isFav: Boolean, v2ray: Boolean, onQr: () -> Unit) {
    val ctx = LocalContext.current
    val dim = !r.alive || (r.realDelay != null && r.realDelay < 0)
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = if (dim) MaterialTheme.colorScheme.surfaceContainer else MaterialTheme.colorScheme.surfaceContainerLowest),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Row(Modifier.padding(start = 12.dp, end = 4.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).clickable { copyText(ctx, r.ip); toast(ctx, ctx.getString(R.string.ip_copied, r.ip)) }) {
                Text("#$rank  ${r.ip}", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                    color = if (dim) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onSurface)
                val parts = ArrayList<String>()
                r.ping?.let { parts.add(stringResource(R.string.ping_ms, Math.round(it))) }
                parts.add(stringResource(R.string.score_fmt, Math.round(r.score)))
                if (r.openPorts.isNotEmpty()) parts.add(r.openPorts.joinToString(" "))
                if (r.colo.isNotEmpty()) parts.add(Colo.label(r.colo))
                if (r.operator.isNotEmpty()) parts.add(r.operator)
                Text(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                val extra = ArrayList<String>()
                r.speed?.let { extra.add(stringResource(R.string.speed_fmt, it)) }
                r.realDelay?.let { extra.add(if (it < 0) stringResource(R.string.real_failed) else stringResource(R.string.real_ok, Math.round(it))) }
                if (!r.alive) Badge(stringResource(R.string.dead), MaterialTheme.colorScheme.error)
                if (extra.isNotEmpty()) Text(extra.joinToString(" · "), style = MaterialTheme.typography.bodySmall,
                    color = if (dim) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
            }
            if (v2ray && r.config != null) {
                TextButton(onClick = onQr) { Text(stringResource(R.string.qr)) }
                IconButton(onClick = { copyText(ctx, r.config); toast(ctx, ctx.getString(R.string.config_copied)) }) { Icon(Icons.Default.Share, stringResource(R.string.copy_config)) }
            }
            IconButton(onClick = {
                if (isFav) { Store.removeFavorite(r.ip); toast(ctx, ctx.getString(R.string.removed_favorite)) }
                else { Store.addFavorite(r.ip, r.openPorts.firstOrNull() ?: 443, r.ping, r.colo); toast(ctx, ctx.getString(R.string.added_favorite)) }
            }) { Icon(Icons.Default.Star, null, tint = if (isFav) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline) }
        }
    }
}
