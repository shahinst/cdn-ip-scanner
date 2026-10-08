package com.shahinst.cdnscanner.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File
import java.text.DateFormat
import java.util.Date

fun toast(ctx: Context, msg: String) = Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show()

fun copyText(ctx: Context, text: String) {
    ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("CDN IP Scanner", text))
}

/** Writes the text to a cache file and opens the system share sheet. */
fun shareText(ctx: Context, text: String, mime: String, filename: String) {
    val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
    val f = File(dir, filename).apply { writeText(text) }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, filename)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    ctx.startActivity(Intent.createChooser(intent, filename).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

fun openUrl(ctx: Context, url: String) {
    try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { toast(ctx, url) }
}

fun fmtDateTime(epoch: Long): String = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(epoch))

@Composable
fun DropdownField(label: String, options: List<Pair<String, String>>, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedTextField(
            value = options.firstOrNull { it.first == value }?.second ?: value, onValueChange = {}, readOnly = true,
            label = { Text(label) }, trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) }, modifier = Modifier.fillMaxWidth(),
        )
        // read-only text fields swallow taps: a transparent overlay opens the menu
        Box(Modifier.matchParentSize().clickable { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (k, v) -> DropdownMenuItem(text = { Text(v) }, onClick = { onChange(k); open = false }) }
        }
    }
}

@Composable
fun NumberField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(value = value, onValueChange = { s -> onChange(s.filter { it.isDigit() }.take(6)) }, label = { Text(label) },
        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = modifier)
}

/** Tiny line chart; `points` are (x, y) with x increasing. */
@Composable
fun Sparkline(points: List<Pair<Double, Double>>, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary) {
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val minX = points.first().first; val maxX = points.last().first
        val maxY = (points.maxOf { it.second }).coerceAtLeast(1.0)
        val path = Path()
        points.forEachIndexed { i, (x, y) ->
            val px = ((x - minX) / (maxX - minX).coerceAtLeast(1e-6) * size.width).toFloat()
            val py = (size.height - y / maxY * size.height * 0.9 - size.height * 0.05).toFloat()
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        drawPath(path, color, style = Stroke(width = 3.dp.toPx()))
        drawLine(color.copy(alpha = 0.3f), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
    }
}
