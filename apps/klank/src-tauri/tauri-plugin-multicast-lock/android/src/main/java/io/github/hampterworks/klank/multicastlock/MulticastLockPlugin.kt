package io.github.hampterworks.klank.multicastlock

import android.app.Activity
import android.content.Context
import android.net.wifi.WifiManager
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * Holds a Wi-Fi [WifiManager.MulticastLock] while a jam is hosting or
 * discovering. Android filters out inbound multicast/broadcast packets by
 * default to save power, so mDNS (advertise + browse) needs this lock to both
 * send and receive on the local network.
 *
 * The lock is reference-counted: each [acquire] must be matched by one
 * [release], and the OS only stops filtering once the count reaches zero. This
 * lets an overlapping host + discovery hold compose without releasing early.
 */
@TauriPlugin
class MulticastLockPlugin(private val activity: Activity) : Plugin(activity) {
    private val lock: WifiManager.MulticastLock by lazy {
        val wifi = activity.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifi.createMulticastLock("klank-jam").apply { setReferenceCounted(true) }
    }

    @Command
    fun acquire(invoke: Invoke) {
        try {
            lock.acquire()
            invoke.resolve(JSObject())
        } catch (e: Exception) {
            invoke.reject(e.message ?: "multicast acquire failed")
        }
    }

    @Command
    fun release(invoke: Invoke) {
        try {
            // Guard against under-locking: only release while a reference is held.
            if (lock.isHeld) lock.release()
            invoke.resolve(JSObject())
        } catch (e: Exception) {
            invoke.reject(e.message ?: "multicast release failed")
        }
    }
}
