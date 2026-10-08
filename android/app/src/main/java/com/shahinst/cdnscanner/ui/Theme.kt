package com.shahinst.cdnscanner.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shahinst.cdnscanner.data.Prefs

// Brand palette shared with the web UI (blue 600 / violet 600 / emerald 600).
private val Blue = Color(0xFF2563EB)
private val BlueDark = Color(0xFF1D4ED8)
private val BlueLight = Color(0xFF8AB4FF)
private val Violet = Color(0xFF7C3AED)
private val VioletLight = Color(0xFFC4B5FD)
private val Emerald = Color(0xFF059669)
private val EmeraldLight = Color(0xFF6EE7B7)
private val Red = Color(0xFFDC2626)

private val LightScheme = lightColorScheme(
    primary = Blue, onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E9FF), onPrimaryContainer = Color(0xFF0B2A7A),
    secondary = Violet, onSecondary = Color.White,
    secondaryContainer = Color(0xFFEDE9FE), onSecondaryContainer = Color(0xFF3B1D7A),
    tertiary = Emerald, onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD1FAE5), onTertiaryContainer = Color(0xFF064E3B),
    error = Red, onError = Color.White, errorContainer = Color(0xFFFEE2E2), onErrorContainer = Color(0xFF7F1D1D),
    background = Color(0xFFF4F6FB), onBackground = Color(0xFF0F172A),
    surface = Color(0xFFF8FAFF), onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFE8EDF7), onSurfaceVariant = Color(0xFF475569),
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFFFFFFF),
    surfaceContainer = Color(0xFFF1F4FA), surfaceContainerHigh = Color(0xFFE9EEF8), surfaceContainerHighest = Color(0xFFE1E7F3),
    outline = Color(0xFF94A3B8), outlineVariant = Color(0xFFD9E0EC),
)

private val DarkScheme = darkColorScheme(
    primary = BlueLight, onPrimary = Color(0xFF002A77),
    primaryContainer = BlueDark, onPrimaryContainer = Color(0xFFDCE6FF),
    secondary = VioletLight, onSecondary = Color(0xFF2E1065),
    secondaryContainer = Color(0xFF4C1D95), onSecondaryContainer = Color(0xFFEDE9FE),
    tertiary = EmeraldLight, onTertiary = Color(0xFF022C22),
    tertiaryContainer = Color(0xFF065F46), onTertiaryContainer = Color(0xFFD1FAE5),
    error = Color(0xFFFCA5A5), onError = Color(0xFF450A0A), errorContainer = Color(0xFF7F1D1D), onErrorContainer = Color(0xFFFEE2E2),
    background = Color(0xFF0B1220), onBackground = Color(0xFFE2E8F0),
    surface = Color(0xFF0F172A), onSurface = Color(0xFFE2E8F0),
    surfaceVariant = Color(0xFF1E293B), onSurfaceVariant = Color(0xFFA8B3C7),
    surfaceContainerLowest = Color(0xFF070C16), surfaceContainerLow = Color(0xFF131C2E),
    surfaceContainer = Color(0xFF172238), surfaceContainerHigh = Color(0xFF1C2941), surfaceContainerHighest = Color(0xFF23314D),
    outline = Color(0xFF64748B), outlineVariant = Color(0xFF2B3A52),
)

val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

private val AppTypography = Typography().let { t ->
    t.copy(
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 20.sp),
        titleMedium = t.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        titleSmall = t.titleSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.2.sp),
        labelLarge = t.labelLarge.copy(fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val changes by Prefs.changes.collectAsState()
    val theme = remember(changes) { Prefs.theme }
    val dark = when (theme) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme, shapes = AppShapes, typography = AppTypography, content = content)
}
