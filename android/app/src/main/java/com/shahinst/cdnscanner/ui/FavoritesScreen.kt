package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import com.shahinst.cdnscanner.monitor.MonitorWorker
import com.shahinst.cdnscanner.scan.Colo
import kotlinx.coroutines.launch

@Composable
fun FavoritesScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val favs by Store.favorites.collectAsState()
    var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Button(onClick = {
            busy = true
            scope.launch {
                val (down, back) = MonitorWorker.checkFavorites(ctx, notify = false)
                toast(ctx, ctx.getString(R.string.fav_checked, down.size, back.size))
                busy = false
            }
        }, enabled = favs.isNotEmpty() && !busy, modifier = Modifier.padding(vertical = 8.dp)) { Text(stringResource(R.string.fav_check_now)) }
        if (favs.isEmpty()) Text(stringResource(R.string.fav_empty), modifier = Modifier.padding(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(favs, key = { it.ip }) { f ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(start = 12.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        val (status, color) = when (f.lastOk) {
                            true -> stringResource(R.string.fav_up) to MaterialTheme.colorScheme.primary
                            false -> stringResource(R.string.fav_down) to MaterialTheme.colorScheme.error
                            null -> stringResource(R.string.fav_unknown) to MaterialTheme.colorScheme.outline
                        }
                        Text(status, color = color, fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("${f.ip}:${f.port}", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                            val parts = ArrayList<String>()
                            f.lastPing?.let { parts.add(stringResource(R.string.ping_ms, Math.round(it))) }
                            if (f.lastColo.isNotEmpty()) parts.add(Colo.label(f.lastColo))
                            f.uptime24h()?.let { parts.add("${stringResource(R.string.fav_uptime)} ${Math.round(it)}%") }
                            parts.add("${stringResource(R.string.fav_last_check)}: " + if (f.lastCheck > 0) fmtDateTime(f.lastCheck) else stringResource(R.string.fav_never))
                            Text(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { Store.removeFavorite(f.ip) }) { Icon(Icons.Default.Delete, stringResource(R.string.delete)) }
                    }
                }
            }
        }
    }
}
