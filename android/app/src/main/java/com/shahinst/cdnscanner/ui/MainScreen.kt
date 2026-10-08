package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.shahinst.cdnscanner.R

fun appVersion(ctx: android.content.Context): String =
    try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "" } catch (e: Exception) { "" }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val ctx = LocalContext.current
    val version = remember { appVersion(ctx) }
    val tabs = listOf(
        R.string.tab_scan to Icons.Default.Search, R.string.tab_results to Icons.Default.List,
        R.string.tab_favorites to Icons.Default.Star, R.string.tab_history to Icons.Default.DateRange,
        R.string.tab_settings to Icons.Default.Settings,
    )
    Scaffold(
        topBar = { TopAppBar(title = { Text("CDN IP Scanner $version") }) },
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { i, (label, icon) ->
                    NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(icon, null) },
                        label = { Text(stringResource(label), maxLines = 1) })
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (tab) {
                0 -> ScanScreen()
                1 -> ResultsScreen()
                2 -> FavoritesScreen()
                3 -> HistoryScreen(onLoaded = { tab = 1 })
                else -> SettingsScreen()
            }
        }
    }
}
