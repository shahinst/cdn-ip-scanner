package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.scan.ScanEngine

@Composable
fun HistoryScreen(onLoaded: () -> Unit) {
    val sessions by Store.sessions.collectAsState()
    val state by ScanEngine.state.collectAsState()
    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        OutlinedButton(onClick = { Store.deleteAllSessions() }, enabled = sessions.isNotEmpty(), modifier = Modifier.padding(vertical = 8.dp)) { Text(stringResource(R.string.history_delete_all)) }
        if (sessions.isEmpty()) Text(stringResource(R.string.history_empty), modifier = Modifier.padding(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(sessions, key = { it.id }) { s ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
                    Row(Modifier.padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(fmtDateTime(s.id), fontWeight = FontWeight.Bold)
                            Text("${s.method} · ${s.mode} · ${s.status}" + (if (s.operator.isNotEmpty()) " · ${s.operator}" else ""), style = MaterialTheme.typography.bodySmall)
                            Text(stringResource(R.string.history_line, s.totalFound, s.totalScanned, s.duration), style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = { ScanEngine.loadSession(s); onLoaded() }, enabled = !state.running) { Text(stringResource(R.string.history_load)) }
                    }
                }
            }
        }
    }
}
