package expo.modules.obd

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresPermission
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.Collections
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Owns the complete BLE -> ELM327 -> ECU session.
 *
 * ELM327 is a request/response device. Only one command may be in flight and a
 * response is complete only when the `>` prompt arrives. Keeping that invariant
 * here prevents callers from accidentally overlapping PID and DTC requests.
 */
@SuppressLint("MissingPermission")
class ObdManager(private val context: Context) {

    data class BleDevice(val id: String, val name: String, val rssi: Int, val device: BluetoothDevice)

    private data class UartProfile(val service: String, val write: String, val notify: String)

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val adapter: BluetoothAdapter? = bluetoothManager.adapter
    private val scanner get() = adapter?.bluetoothLeScanner
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val commandMutex = Mutex()
    private val livePollMutex = Mutex()
    private val bufferLock = Any()

    @Volatile private var scanning = false
    @Volatile private var ready = false
    @Volatile private var initializationStarted = false
    @Volatile private var gatt: BluetoothGatt? = null
    @Volatile private var writeChar: BluetoothGattCharacteristic? = null
    @Volatile private var notifyChar: BluetoothGattCharacteristic? = null
    @Volatile private var connectionResult: CompletableDeferred<Boolean>? = null
    @Volatile private var responseResult: CompletableDeferred<String>? = null

    private val responseBuffer = StringBuilder()
    private val found = ConcurrentHashMap<String, BleDevice>()

    val live = ConcurrentHashMap<String, String>()
    val dtc: MutableList<String> = Collections.synchronizedList(mutableListOf())
    val pendingDtc: MutableList<String> = Collections.synchronizedList(mutableListOf())
    val permanentDtc: MutableList<String> = Collections.synchronizedList(mutableListOf())
    @Volatile var vin: String = ""
        private set

    private val cccdUuid = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val uartProfiles = listOf(
        UartProfile("fff0", "fff2", "fff1"),
        UartProfile("ffe0", "ffe1", "ffe1"),
        UartProfile("6e400001", "6e400002", "6e400003")
    )

    private val liveCommands = listOf(
        "010C", "010D", "0105", "012F", "0104", "0142", "010F", "010B",
        "0110", "0111", "010E", "0123", "0144", "0128", "0106", "0107",
        "0108", "0109", "015C", "0149", "0133", "0146", "ATRV"
    )

    @RequiresPermission(allOf = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT])
    fun startScan() {
        val bleScanner = scanner ?: throw IllegalStateException("Bluetooth LE is unavailable")
        if (adapter?.isEnabled != true) throw IllegalStateException("Bluetooth is disabled")
        if (scanning) return
        found.clear()
        scanning = true
        bleScanner.startScan(scanCallback)
        println("OBD BLE scan started")
        scope.launch {
            delay(SCAN_DURATION_MS)
            stopScan()
        }
    }

    fun stopScan() {
        if (!scanning) return
        scanner?.stopScan(scanCallback)
        scanning = false
        println("OBD BLE scan stopped")
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device ?: return
            val address = device.address ?: return
            found[address] = BleDevice(address, device.name ?: "Unknown", result.rssi, device)
        }

        override fun onScanFailed(errorCode: Int) {
            scanning = false
            println("OBD BLE scan failed: $errorCode")
        }
    }

    fun getDevices(): List<BleDevice> = found.values.sortedByDescending { it.rssi }

    suspend fun connect(device: BluetoothDevice): Boolean {
        disconnect()
        val result = CompletableDeferred<Boolean>()
        connectionResult = result
        ready = false
        initializationStarted = false

        withContext(Dispatchers.Main) {
            println("Connecting to ${device.name} (${device.address})")
            gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        }

        return try {
            withTimeout(CONNECTION_TIMEOUT_MS) { result.await() }
        } catch (error: Exception) {
            failConnection(error)
            throw error
        } finally {
            connectionResult = null
        }
    }

    fun disconnect() {
        ready = false
        initializationStarted = false
        responseResult?.cancel()
        responseResult = null
        connectionResult?.cancel()
        connectionResult = null
        synchronized(bufferLock) { responseBuffer.clear() }
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (_: Exception) {
            // The GATT object may already be closed by the system.
        }
        gatt = null
        writeChar = null
        notifyChar = null
    }

    fun isConnected(): Boolean = ready

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnection(IllegalStateException("GATT connection failed: $status"))
                return
            }
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    println("BLE connected; discovering services")
                    if (!gatt.discoverServices()) {
                        failConnection(IllegalStateException("Could not start service discovery"))
                    }
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    ready = false
                    failConnection(IllegalStateException("OBD adapter disconnected"))
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnection(IllegalStateException("Service discovery failed: $status"))
                return
            }
            val pair = findUartPair(gatt.services)
            if (pair == null) {
                failConnection(IllegalStateException("No compatible UART service found"))
                return
            }
            writeChar = pair.first
            notifyChar = pair.second
            pair.first.writeType = if (
                pair.first.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0
            ) BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            else BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE

            if (!gatt.setCharacteristicNotification(pair.second, true)) {
                failConnection(IllegalStateException("Could not enable UART notifications"))
                return
            }
            val descriptor = pair.second.getDescriptor(cccdUuid)
            if (descriptor == null) {
                // Some HM-10 clones omit CCCD even though notifications work.
                beginInitialization()
                return
            }
            if (!writeDescriptor(gatt, descriptor)) {
                failConnection(IllegalStateException("Could not configure UART notifications"))
            }
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (descriptor.uuid != cccdUuid) return
            if (status == BluetoothGatt.GATT_SUCCESS) beginInitialization()
            else failConnection(IllegalStateException("Notification setup failed: $status"))
        }

        @Suppress("DEPRECATION")
        @Deprecated("Deprecated in Android 13")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            consumeIncoming(characteristic.value ?: return)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            consumeIncoming(value)
        }
    }

    private fun findUartPair(
        services: List<BluetoothGattService>
    ): Pair<BluetoothGattCharacteristic, BluetoothGattCharacteristic>? {
        services.forEach { service ->
            val serviceId = service.uuid.toString().lowercase(Locale.ROOT)
            uartProfiles.firstOrNull { serviceId.contains(it.service) }?.let { profile ->
                val write = service.characteristics.firstOrNull {
                    it.uuid.toString().lowercase(Locale.ROOT).contains(profile.write) && it.canWrite()
                }
                val notify = service.characteristics.firstOrNull {
                    it.uuid.toString().lowercase(Locale.ROOT).contains(profile.notify) && it.canNotify()
                }
                if (write != null && notify != null) return write to notify
            }
        }
        // Never combine unrelated characteristics from different services.
        services.forEach { service ->
            val write = service.characteristics.firstOrNull { it.canWrite() }
            val notify = service.characteristics.firstOrNull { it.canNotify() }
            if (write != null && notify != null) return write to notify
        }
        return null
    }

    private fun BluetoothGattCharacteristic.canWrite(): Boolean =
        properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 ||
            properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0

    private fun BluetoothGattCharacteristic.canNotify(): Boolean =
        properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 ||
            properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0

    private fun beginInitialization() {
        if (initializationStarted) return
        initializationStarted = true
        scope.launch {
            try {
                executeCommand("ATZ", RESET_TIMEOUT_MS, requireReady = false)
                executeCommand("ATE0", COMMAND_TIMEOUT_MS, requireReady = false)
                executeCommand("ATL0", COMMAND_TIMEOUT_MS, requireReady = false)
                executeCommand("ATS1", COMMAND_TIMEOUT_MS, requireReady = false)
                executeCommand("ATH0", COMMAND_TIMEOUT_MS, requireReady = false)
                executeCommand("ATSP0", COMMAND_TIMEOUT_MS, requireReady = false)
                val protocolResponse = executeCommand("0100", PROTOCOL_TIMEOUT_MS, requireReady = false)
                if (extractPayloads(protocolResponse, 0x41).none { it.getOrNull(1) == 0x00 }) {
                    throw IllegalStateException(elmError(protocolResponse) ?: "Vehicle protocol was not detected")
                }
                ready = true
                println("ELM327 and vehicle protocol are ready")
                connectionResult?.complete(true)
            } catch (error: Exception) {
                failConnection(error)
            }
        }
    }

    private fun failConnection(error: Throwable) {
        ready = false
        println("OBD connection error: ${error.message}")
        responseResult?.completeExceptionally(error)
        connectionResult?.completeExceptionally(error)
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (_: Exception) {
            // Already closed by Android.
        }
        gatt = null
        writeChar = null
        notifyChar = null
    }

    private suspend fun executeCommand(
        command: String,
        timeoutMs: Long = COMMAND_TIMEOUT_MS,
        requireReady: Boolean = true
    ): String = commandMutex.withLock {
        if (requireReady && !ready) throw IllegalStateException("ELM327 is not ready")
        val currentGatt = gatt ?: throw IllegalStateException("BLE is disconnected")
        val characteristic = writeChar ?: throw IllegalStateException("UART write characteristic is unavailable")
        val deferred = CompletableDeferred<String>()
        responseResult = deferred
        synchronized(bufferLock) { responseBuffer.clear() }

        val payload = "$command\r".toByteArray(Charsets.US_ASCII)
        if (!writeCharacteristic(currentGatt, characteristic, payload)) {
            responseResult = null
            throw IllegalStateException("BLE rejected command $command")
        }
        println("TX: $command")
        try {
            val response = withTimeout(timeoutMs) { deferred.await() }
            println("RX[$command]: response received")
            elmError(response)?.let { throw IllegalStateException("$command: $it") }
            response
        } finally {
            if (responseResult === deferred) responseResult = null
        }
    }

    private fun consumeIncoming(bytes: ByteArray) {
        if (bytes.isEmpty()) return
        synchronized(bufferLock) {
            responseBuffer.append(String(bytes, Charsets.US_ASCII))
            val promptIndex = responseBuffer.indexOf(">")
            if (promptIndex < 0) return
            val packet = responseBuffer.substring(0, promptIndex)
            responseBuffer.delete(0, promptIndex + 1)
            responseResult?.complete(packet)
        }
    }

    @Suppress("DEPRECATION")
    private fun writeDescriptor(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) ==
                BluetoothStatusCodes.SUCCESS
        } else {
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt.writeDescriptor(descriptor)
        }

    @Suppress("DEPRECATION")
    private fun writeCharacteristic(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        payload: ByteArray
    ): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        gatt.writeCharacteristic(characteristic, payload, characteristic.writeType) ==
            BluetoothStatusCodes.SUCCESS
    } else {
        characteristic.value = payload
        gatt.writeCharacteristic(characteristic)
    }

    private fun elmError(response: String): String? {
        val upper = response.uppercase(Locale.ROOT)
        return when {
            "UNABLE TO CONNECT" in upper -> "ECU is not responding"
            "STOPPED" in upper -> "Command was interrupted"
            "BUFFER FULL" in upper -> "ELM327 buffer is full"
            "BUS ERROR" in upper -> "Vehicle bus error"
            "CAN ERROR" in upper -> "Vehicle CAN error"
            "?" in upper -> "ELM327 rejected the command"
            else -> null
        }
    }

    suspend fun requestLive() {
        if (!livePollMutex.tryLock()) return
        try {
            live.clear()
            for (command in liveCommands) {
                try {
                    val response = executeCommand(command)
                    if (command == "ATRV") parseBattery(response) else parsePid(response)
                } catch (error: Exception) {
                    // Unsupported PIDs commonly return NO DATA.
                    println("Live command $command failed: ${error.message}")
                }
            }
        } finally {
            livePollMutex.unlock()
        }
    }

    suspend fun readDTCs(): List<String> {
        val codes = parseDtcResponse(executeCommand("03"), 0x43)
        replaceContents(dtc, codes)
        return codes
    }

    suspend fun readPendingDTCs(): List<String> {
        val codes = parseDtcResponse(executeCommand("07"), 0x47)
        replaceContents(pendingDtc, codes)
        return codes
    }

    suspend fun readPermanentDTCs(): List<String> {
        val codes = parseDtcResponse(executeCommand("0A"), 0x4A)
        replaceContents(permanentDtc, codes)
        return codes
    }

    suspend fun clearDTCs() {
        DiagnosticResponses.requireStopped(extractPayloads(executeCommand("010C"), 0x41), 0x0C)
        DiagnosticResponses.requireStopped(extractPayloads(executeCommand("010D"), 0x41), 0x0D)
        DiagnosticResponses.requireAcknowledged(extractPayloads(executeCommand("04", CLEAR_TIMEOUT_MS), 0x44))
        replaceContents(dtc, emptyList())
        replaceContents(pendingDtc, emptyList())
        // Permanent codes belong to the ECU's self-verification lifecycle, not Mode 04.
    }

    suspend fun readVIN(): String {
        vin = parseVin(executeCommand("0902", PROTOCOL_TIMEOUT_MS))
        return vin
    }

    private fun replaceContents(target: MutableList<String>, values: List<String>) {
        synchronized(target) {
            target.clear()
            target.addAll(values)
        }
    }

    private fun parsePid(response: String) {
        extractPayloads(response, 0x41).forEach { bytes ->
            val pid = bytes.getOrNull(1) ?: return@forEach
            val a = bytes.getOrNull(2) ?: return@forEach
            val b = bytes.getOrNull(3) ?: 0
            when (pid) {
                0x0C -> live["RPM"] = (((a * 256) + b) / 4).toString()
                0x0D -> live["Speed"] = a.toString()
                0x05 -> live["Coolant"] = (a - 40).toString()
                0x2F -> live["Fuel"] = format(a * 100.0 / 255.0, 1)
                0x04 -> live["EngineLoad"] = format(a * 100.0 / 255.0, 1)
                0x42 -> live["ControlVoltage"] = format(((a * 256) + b) / 1000.0, 3)
                0x0F -> live["IntakeAir"] = (a - 40).toString()
                0x0B -> live["MAP"] = a.toString()
                0x10 -> live["MAF"] = format(((a * 256) + b) / 100.0, 2)
                0x11 -> live["Throttle"] = format(a * 100.0 / 255.0, 1)
                0x0E -> live["TimingAdvance"] = format(a / 2.0 - 64.0, 1)
                0x23 -> live["FuelRailPressure"] = ((a * 256 + b) * 10).toString()
                0x44 -> live["AFR"] = format(((a * 256) + b) / 32768.0 * 14.7, 2)
                0x28 -> live["AFRBank2"] = format(((a * 256) + b) / 32768.0 * 14.7, 2)
                0x06 -> live["ShortFuelTrimB1"] = format((a - 128) * 100.0 / 128.0, 1)
                0x07 -> live["LongFuelTrimB1"] = format((a - 128) * 100.0 / 128.0, 1)
                0x08 -> live["ShortFuelTrimB2"] = format((a - 128) * 100.0 / 128.0, 1)
                0x09 -> live["LongFuelTrimB2"] = format((a - 128) * 100.0 / 128.0, 1)
                0x5C -> live["OilTemp"] = (a - 40).toString()
                0x49 -> live["PedalPosition"] = format(a * 100.0 / 255.0, 1)
                0x33 -> live["BaroPressure"] = a.toString()
                0x46 -> live["Ambient"] = (a - 40).toString()
            }
        }
    }

    private fun parseBattery(response: String) {
        Regex("(?i)([0-9]+(?:\\.[0-9]+)?)\\s*V").find(response)?.groupValues?.getOrNull(1)
            ?.toDoubleOrNull()?.let { live["Battery"] = format(it, 1) }
    }

    private fun parseDtcResponse(response: String, responseMode: Int): List<String> {
        val payloads = extractPayloads(response, responseMode)
        DiagnosticResponses.requireCodes(payloads, responseMode)
        return payloads.flatMap { payload -> DtcDecoder.decodePayload(payload, responseMode) }.distinct()
    }

    private fun extractPayloads(response: String, marker: Int): List<List<Int>> = DiagnosticResponses.payloads(response, marker)

    private fun parseVin(response: String): String = VinDecoder.decode(response)

    private fun format(value: Double, decimals: Int): String =
        String.format(Locale.US, "%.${decimals}f", value)

    private companion object {
        const val SCAN_DURATION_MS = 12_000L
        const val CONNECTION_TIMEOUT_MS = 70_000L
        const val RESET_TIMEOUT_MS = 8_000L
        const val COMMAND_TIMEOUT_MS = 2_500L
        const val PROTOCOL_TIMEOUT_MS = 20_000L
        const val CLEAR_TIMEOUT_MS = 8_000L
    }
}
