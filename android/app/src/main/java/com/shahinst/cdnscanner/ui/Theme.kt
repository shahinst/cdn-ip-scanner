package com.shahinst.cdnscanner.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.shahinst.cdnscanner.data.Prefs

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val changes by Prefs.changes.collectAsState()
    val theme = remember(changes) { Prefs.theme }
    val dark = when (theme) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val ctx = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        dark -> darkColorScheme(primary = Color(0xFF8AB4FF))
        else -> lightColorScheme(primary = Color(0xFF1E5BFF))
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
