package com.shahinst.cdnscanner.monitor

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.shahinst.cdnscanner.R
import com.shahinst.cdnscanner.data.Prefs
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.net.Telegram
import com.shahinst.cdnscanner.scan.CdnScanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** Periodic re-check of favorite IPs (port of app/monitor.py) with notification + Telegram alerts. */
class MonitorWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        checkFavorites(applicationContext, notify = true)
        return Result.success()
    }

    companion object {
        private const val WORK = "favorites-monitor"
        private const val HISTORY_MS = 30L * 24 * 3600 * 1000

        fun schedule(ctx: Context, minutes: Int) {
            val wm = WorkManager.getInstance(ctx)
            if (minutes <= 0) { wm.cancelUniqueWork(WORK); return }
            // WorkManager cannot run periodic work more often than every 15 minutes.
            val req = PeriodicWorkRequestBuilder<MonitorWorker>(maxOf(15, minutes).toLong(), TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req)
        }

        /** Checks every favorite once. Returns (went down, came back). */
        suspend fun checkFavorites(ctx: Context, notify: Boolean): Pair<List<String>, List<String>> {
            val favs = Store.favorites.value
            if (favs.isEmpty()) return emptyList<String>() to emptyList()
            val scanner = CdnScanner(workers = 8, maxLatencyMs = 5000)
            val now = System.currentTimeMillis()
            val wentDown = ArrayList<String>()
            val cameBack = ArrayList<String>()
            val updated = withContext(Dispatchers.IO) {
                favs.map { f ->
                    val r = try { scanner.check(f.ip, listOf(f.port)) } catch (e: Exception) { null }
                    val ok = r != null
                    if (f.lastOk == true && !ok) wentDown.add(f.ip)
                    if (f.lastOk == false && ok) cameBack.add(f.ip)
                    f.copy(lastOk = ok, lastPing = r?.ping ?: f.lastPing, lastColo = r?.colo?.ifEmpty { f.lastColo } ?: f.lastColo,
                        lastCheck = now, checks = (f.checks + (now to ok)).filter { it.first >= now - HISTORY_MS })
                }
            }
            Store.saveFavorites(updated)
            if (notify && (wentDown.isNotEmpty() || cameBack.isNotEmpty())) {
                val msg = (wentDown.map { ctx.getString(R.string.fav_went_down, it) } +
                        cameBack.map { ctx.getString(R.string.fav_came_back, it) }).joinToString("\n")
                Notify.post(ctx, Notify.ID_MONITOR, Notify.CHANNEL_MONITOR, ctx.getString(R.string.notif_monitor_title), msg)
                if (Prefs.telegramToken.isNotBlank()) Telegram.send("CDN IP Scanner\n$msg")
            }
            return wentDown to cameBack
        }
    }
}
