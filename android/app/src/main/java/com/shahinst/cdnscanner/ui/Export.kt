package com.shahinst.cdnscanner.ui

import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.scan.Colo
import com.shahinst.cdnscanner.scan.FoundIp
import org.json.JSONArray

/** Result exports in the same formats as the web app (/api/export/<txt|json|csv>). */
object Export {
    fun txt(list: List<FoundIp>) = list.joinToString("\n") { it.ip }

    fun json(list: List<FoundIp>): String = JSONArray(list.map { Store.foundToJson(it).put("colo_name", Colo.name(it.colo)) }).toString(2)

    fun csv(list: List<FoundIp>): String {
        fun q(s: String) = "\"" + s.replace("\"", "\"\"") + "\""
        val sb = StringBuilder("rank,ip,ping_ms,ports,score,colo,colo_name,operator,speed_kbs,real_delay_ms,alive\n")
        list.forEachIndexed { i, r ->
            sb.append(i + 1).append(',').append(r.ip).append(',').append(r.ping?.let { Math.round(it) } ?: "").append(',')
                .append(q(r.openPorts.joinToString(" "))).append(',').append(Math.round(r.score)).append(',')
                .append(r.colo).append(',').append(q(Colo.name(r.colo))).append(',').append(q(r.operator)).append(',')
                .append(r.speed?.let { Math.round(it) } ?: "").append(',')
                .append(r.realDelay?.let { if (it < 0) "failed" else Math.round(it).toString() } ?: "").append(',')
                .append(if (r.alive) "yes" else "no").append('\n')
        }
        return sb.toString()
    }
}

fun qrBitmap(text: String, size: Int = 640): Bitmap {
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 1))
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
    for (x in 0 until size) for (y in 0 until size) bmp.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
    return bmp
}

@Composable
fun QrDialog(text: String, onDismiss: () -> Unit) {
    val bmp = remember(text) { try { qrBitmap(text) } catch (e: Exception) { null } }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("OK") } },
        text = {
            Column {
                if (bmp != null) Image(bmp.asImageBitmap(), null, Modifier.fillMaxWidth().aspectRatio(1f))
                Text(text, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
            }
        },
    )
}
