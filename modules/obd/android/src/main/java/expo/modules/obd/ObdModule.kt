package expo.modules.obd

import android.annotation.SuppressLint
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*

@SuppressLint("MissingPermission")
class ObdModule : Module() {

    private val manager by lazy {
        ObdManager(appContext.reactContext!!)
    }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun definition() = ModuleDefinition {

        Name("Obd")

        AsyncFunction("startScan") { promise: Promise ->
            scope.launch(Dispatchers.Main) {
                try {
                    manager.startScan()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("SCAN_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("stopScan") { promise: Promise ->
            scope.launch(Dispatchers.Main) {
                manager.stopScan()
                promise.resolve(null)
            }
        }

        // Returns devices found during the last scan as [{id, name, rssi}]
        AsyncFunction("getDevices") { promise: Promise ->
            try {
                val result = manager.getDevices().map { d ->
                    mapOf("id" to d.id, "name" to d.name, "rssi" to d.rssi)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("DEVICES_FAIL", e.message, e)
            }
        }

        AsyncFunction("connect") { uuid: String, promise: Promise ->
            scope.launch {
                try {
                    val device = manager.getDevices().find { it.id == uuid }?.device
                        ?: throw Exception("Device not found: $uuid")
                    promise.resolve(manager.connect(device))
                } catch (e: Exception) {
                    promise.reject("CONNECT_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("disconnect") { promise: Promise ->
            scope.launch(Dispatchers.Main) {
                manager.disconnect()
                promise.resolve(null)
            }
        }

        // Poll all PIDs serially and return the values after responses complete.
        AsyncFunction("getLiveValues") { promise: Promise ->
            scope.launch {
                try {
                    manager.requestLive()
                    val now = System.currentTimeMillis().toString()
                    val result = manager.live.map { (key, value) ->
                        mapOf("key" to key, "value" to value, "ts" to now)
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("LIVE_FAIL", e.message, e)
                }
            }
        }

        // Each read resolves only after ELM327 returns its complete `>` response.
        AsyncFunction("readDTCs") { promise: Promise ->
            scope.launch {
                try {
                    manager.readDTCs()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("DTC_READ_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("readPendingDTCs") { promise: Promise ->
            scope.launch {
                try {
                    manager.readPendingDTCs()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("PENDING_DTC_READ_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("readPermanentDTCs") { promise: Promise ->
            scope.launch {
                try {
                    manager.readPermanentDTCs()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("PERMANENT_DTC_READ_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("clearDTCs") { promise: Promise ->
            scope.launch {
                try {
                    manager.clearDTCs()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("DTC_CLEAR_FAIL", e.message, e)
                }
            }
        }

        AsyncFunction("readVIN") { promise: Promise ->
            scope.launch {
                try {
                    manager.readVIN()
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("VIN_READ_FAIL", e.message, e)
                }
            }
        }

        // Getters — return the cached values from the last read
        AsyncFunction("getDTCs") { promise: Promise ->
            promise.resolve(manager.dtc.toList())
        }

        AsyncFunction("getPendingDTCs") { promise: Promise ->
            promise.resolve(manager.pendingDtc.toList())
        }

        AsyncFunction("getPermanentDTCs") { promise: Promise ->
            promise.resolve(manager.permanentDtc.toList())
        }

        AsyncFunction("getVIN") { promise: Promise ->
            promise.resolve(manager.vin)
        }

        AsyncFunction("isConnected") { promise: Promise ->
            promise.resolve(manager.isConnected())
        }
    }
}
