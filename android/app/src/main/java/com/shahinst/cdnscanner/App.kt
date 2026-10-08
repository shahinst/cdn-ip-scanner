package com.shahinst.cdnscanner

import android.app.Application
import com.shahinst.cdnscanner.data.Prefs
import com.shahinst.cdnscanner.data.Store
import com.shahinst.cdnscanner.monitor.MonitorWorker
import com.shahinst.cdnscanner.monitor.Notify
import com.shahinst.cdnscanner.scan.ScanEngine

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        Store.init(this)
        ScanEngine.init(this)
        Notify.createChannels(this)
        MonitorWorker.schedule(this, Prefs.monitorInterval)
    }
}
