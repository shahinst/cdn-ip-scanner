package com.shahinst.cdnscanner.monitor

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.shahinst.cdnscanner.MainActivity
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.scan.ScanState

object Notify {
    const val CHANNEL_SCAN = "scan"
    const val CHANNEL_MONITOR = "monitor"
    const val ID_SCAN = 1
    const val ID_DONE = 2
    const val ID_MONITOR = 3

    fun createChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL_SCAN, ctx.getString(R.string.notif_channel_scan), NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CHANNEL_MONITOR, ctx.getString(R.string.notif_channel_monitor), NotificationManager.IMPORTANCE_DEFAULT))
    }

    private fun openApp(ctx: Context): PendingIntent = PendingIntent.getActivity(
        ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun canPost(ctx: Context) = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun scanProgress(ctx: Context, st: ScanState): Notification =
        NotificationCompat.Builder(ctx, CHANNEL_SCAN)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(ctx.getString(R.string.notif_scan_title))
            .setContentText(ctx.getString(R.string.notif_scan_text, st.percent.toInt(), st.found))
            .setProgress(100, st.percent.toInt(), st.total == 0)
            .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(openApp(ctx)).build()

    fun post(ctx: Context, id: Int, channel: String, title: String, text: String) {
        if (!canPost(ctx)) return
        val n = NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title).setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true).setContentIntent(openApp(ctx)).build()
        ctx.getSystemService(NotificationManager::class.java).notify(id, n)
    }
}
