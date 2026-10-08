package com.shahinst.cdnscanner.scan

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.shahinst.cdnscanner.monitor.Notify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.sample
import kotlinx.coroutines.launch

/** Foreground service: keeps the process alive during a scan and shows its progress. */
class ScanService : Service() {
    private var scope: CoroutineScope? = null

    override fun onBind(intent: Intent?): IBinder? = null

    @OptIn(FlowPreview::class)
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
        ServiceCompat.startForeground(this, Notify.ID_SCAN, Notify.scanProgress(this, ScanEngine.state.value), type)
        if (scope == null) {
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Main).also { s ->
                s.launch {
                    val nm = getSystemService(NotificationManager::class.java)
                    ScanEngine.state.sample(1000).collect { st ->
                        if (!st.running) {
                            ServiceCompat.stopForeground(this@ScanService, ServiceCompat.STOP_FOREGROUND_REMOVE)
                            stopSelf()
                        } else nm.notify(Notify.ID_SCAN, Notify.scanProgress(this@ScanService, st))
                    }
                }
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        scope?.cancel()
        scope = null
        super.onDestroy()
    }

    companion object {
        fun start(ctx: Context) {
            try { ContextCompat.startForegroundService(ctx, Intent(ctx, ScanService::class.java)) } catch (e: Exception) { /* background limits: scan still runs while the app is open */ }
        }
    }
}
