package com.velnox.velshop

import android.app.Application
import com.velnox.velshop.data.local.SessionManager
import com.velnox.velshop.data.tracking.EventTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class VelShopApp : Application() {

    lateinit var sessionManager: SessionManager
        private set

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        instance = this

        sessionManager = SessionManager(this)
        EventTracker.initialize(sessionManager, applicationScope)
    }

    companion object {
        lateinit var instance: VelShopApp
            private set
    }
}
