import Combine
import CoreBluetooth
import Foundation

enum OBDPID: String, CaseIterable, Identifiable {
    case engineRPM = "010C"
    case vehicleSpeed = "010D"
    case coolantTemp = "0105"
    case fuelLevel = "012F"
    case engineLoad = "0104"
    case controlVoltage = "0142"
    case intakeAirTemp = "010F"
    case intakeMAP = "010B"
    case mafRate = "0110"
    case throttle = "0111"
    case timingAdvance = "010E"
    case fuelRailPressure = "0123"
    case afr = "0144"
    case afrBank2 = "0128"
    case shortFuelTrimB1 = "0106"
    case longFuelTrimB1 = "0107"
    case shortFuelTrimB2 = "0108"
    case longFuelTrimB2 = "0109"
    case oilTemp = "015C"
    case pedalPosition = "0149"
    case baroPressure = "0133"
    case ambientTemp = "0146"
    case batteryVoltage = "ATRV"

    var id: String { rawValue }
}

struct OBDValue: Identifiable {
    let id = UUID()
    let key: OBDPID
    let value: String
    let ts: Date
}

struct BLEDevice: Identifiable, Equatable {
    let id: UUID
    var peripheral: CBPeripheral
    var name: String
    var rssi: Int
    var lastSeen: Date
}

private enum OBDManagerError: LocalizedError {
    case connectionTimedOut
    case initializationTimedOut
    case bluetoothUnavailable
    case disconnected
    case uartUnavailable
    case notificationsUnavailable
    case commandTimedOut(String)
    case protocolNotDetected(String)
    case invalidDiagnosticResponse
    case unsafeClear
    case unconfirmedClear

    var errorDescription: String? {
        switch self {
        case .invalidDiagnosticResponse: return "ECU diagnostic response unavailable"
        case .unsafeClear: return "CLEAR_UNSAFE: ECU must report zero RPM and zero speed"
        case .unconfirmedClear: return "CLEAR_UNCONFIRMED: no positive Mode 04 response"
        case .connectionTimedOut: return "OBD_BLE_TIMEOUT: Bluetooth connection timed out"
        case .initializationTimedOut: return "OBD_INIT_TIMEOUT: ELM/ECU initialization timed out"
        case .bluetoothUnavailable: return "OBD_BLUETOOTH_UNAVAILABLE: Bluetooth is unavailable"
        case .disconnected: return "OBD adapter disconnected"
        case .uartUnavailable: return "OBD_UART_UNAVAILABLE: No compatible UART service found"
        case .notificationsUnavailable: return "OBD_NOTIFY_FAILED: Could not enable UART notifications"
        case .commandTimedOut(let command): return "OBD_COMMAND_TIMEOUT_\(command): ELM327 command timed out"
        case .protocolNotDetected(let response):
            return "OBD_ECU_UNAVAILABLE: " + (response.isEmpty ? "Vehicle protocol was not detected" : response)
        }
    }
}

private struct QueuedCommand {
    let id = UUID()
    let command: String
    let timeout: TimeInterval
    let completion: (Result<String, Error>) -> Void
}

/**
 * Serial BLE/ELM327 session used by the Expo bridge.
 *
 * A command is completed only after the ELM prompt (`>`) is received. BLE
 * notifications are accumulated because a single response may span many packets.
 */
final class OBDManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    @Published private(set) var isPoweredOn = false
    @Published private(set) var scanning = false
    @Published private(set) var devices: [BLEDevice] = []
    @Published private(set) var connected: CBPeripheral?
    @Published private(set) var ready = false
    @Published private(set) var status = "Idle"
    @Published private(set) var servicesLog: [String] = []
    @Published private(set) var rawLog: [String] = []
    @Published private(set) var live: [OBDValue] = []
    @Published private(set) var dtc: [String] = []
    @Published private(set) var pendingDtc: [String] = []
    @Published private(set) var permanentDtc: [String] = []
    @Published private(set) var vin = ""

    private var central: CBCentralManager!
    private var rxChar: CBCharacteristic?
    private var txChar: CBCharacteristic?
    private var writeType: CBCharacteristicWriteType = .withResponse
    private var cleanupTimer: AnyCancellable?
    private var pendingServiceIDs = Set<CBUUID>()
    private var characteristicsByService: [CBUUID: [CBCharacteristic]] = [:]

    private var readBuffer = Data()
    private var commandQueue: [QueuedCommand] = []
    private var activeCommand: QueuedCommand?
    private var commandTimeout: DispatchWorkItem?
    private var connectionTimeout: DispatchWorkItem?
    private var connectCompletion: ((Result<Bool, Error>) -> Void)?
    private var refreshingLive = false
    private var connectionGeneration = 0
    private var initializationStarted = false
    private var connectionStage = "BLE"
    private var pendingConnection: (device: BLEDevice, completion: (Result<Bool, Error>) -> Void)?

    private let livePIDs: [OBDPID] = [
        .engineRPM, .vehicleSpeed, .coolantTemp, .fuelLevel,
        .engineLoad, .controlVoltage, .intakeAirTemp, .intakeMAP,
        .mafRate, .throttle, .timingAdvance, .fuelRailPressure,
        .afr, .afrBank2, .shortFuelTrimB1, .longFuelTrimB1,
        .shortFuelTrimB2, .longFuelTrimB2, .oilTemp, .pedalPosition,
        .baroPressure, .ambientTemp, .batteryVoltage
    ]

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
        cleanupTimer = Timer.publish(every: 2, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.dropStaleDevices() }
    }

    func startScan() throws {
        guard isPoweredOn else { throw OBDManagerError.bluetoothUnavailable }
        guard !scanning else { return }
        devices.removeAll()
        servicesLog.removeAll()
        scanning = true
        central.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )
        status = "Scanning…"
        log("BLE scan started")
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in self?.stopScan() }
    }

    func stopScan() {
        guard scanning else { return }
        central.stopScan()
        scanning = false
        status = "Scan stopped"
        log("BLE scan stopped")
    }

    func connect(_ device: BLEDevice, completion: @escaping (Result<Bool, Error>) -> Void) {
        disconnect()
        stopScan()
        guard isPoweredOn else { completion(.failure(OBDManagerError.bluetoothUnavailable)); return }
        if device.peripheral.state == .disconnecting {
            // CoreBluetooth can deliver the previous cancellation after a retry starts.
            pendingConnection = (device, completion)
            armConnectionTimeout(ConnectionPolicy.transportTimeout, error: .connectionTimedOut)
            return
        }
        beginConnection(device, completion: completion)
    }

    private func beginConnection(_ device: BLEDevice, completion: @escaping (Result<Bool, Error>) -> Void) {
        connectionGeneration += 1
        connectionStage = "BLE"
        connected = device.peripheral
        connected?.delegate = self
        connectCompletion = completion
        ready = false
        initializationStarted = false
        status = "Connecting to \(device.name)…"
        log("Connecting BLE adapter")
        armConnectionTimeout(ConnectionPolicy.transportTimeout, error: .connectionTimedOut)
        central.connect(device.peripheral, options: nil)
    }

    private func armConnectionTimeout(_ seconds: TimeInterval, error: OBDManagerError) {
        connectionTimeout?.cancel()
        let generation = connectionGeneration
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, generation == self.connectionGeneration, !self.ready,
                  self.connectCompletion != nil || self.pendingConnection != nil else { return }
            self.failConnection(error)
        }
        connectionTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: timeout)
    }

    func disconnect() {
        endSession(OBDManagerError.disconnected)
    }

    private func endSession(_ error: Error) {
        connectionGeneration += 1
        ready = false
        refreshingLive = false
        initializationStarted = false
        connectionTimeout?.cancel()
        connectionTimeout = nil
        let completion = connectCompletion
        connectCompletion = nil
        let pending = pendingConnection
        pendingConnection = nil
        let peripheral = connected
        connected = nil
        rxChar = nil
        txChar = nil
        pendingServiceIDs.removeAll()
        characteristicsByService.removeAll()
        failAllCommands(error)
        readBuffer.removeAll(keepingCapacity: true)
        if let peripheral { central.cancelPeripheralConnection(peripheral) }
        completion?(.failure(error))
        pending?.completion(.failure(error))
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        isPoweredOn = central.state == .poweredOn
        if !isPoweredOn && (connected != nil || pendingConnection != nil) { failConnection(OBDManagerError.bluetoothUnavailable) }
        status = isPoweredOn ? "Bluetooth On" : "Bluetooth Off"
        log("Bluetooth state: \(central.state.rawValue)")
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let id = peripheral.identifier
        let name = (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? peripheral.name
            ?? "Unknown"
        let now = Date()
        if let index = devices.firstIndex(where: { $0.id == id }) {
            devices[index].rssi = RSSI.intValue
            devices[index].lastSeen = now
            devices[index].name = name
            devices[index].peripheral = peripheral
        } else {
            devices.append(BLEDevice(
                id: id,
                peripheral: peripheral,
                name: name,
                rssi: RSSI.intValue,
                lastSeen: now
            ))
        }
        devices.sort { $0.rssi > $1.rssi }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard peripheral === connected else { return }
        connectionStage = "SERVICES"
        status = "Discovering services…"
        servicesLog.removeAll()
        log("BLE connected; discovering services")
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard peripheral === connected else { return }
        failConnection(error ?? OBDManagerError.disconnected)
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if let pending = pendingConnection, pending.device.peripheral === peripheral {
            pendingConnection = nil
            beginConnection(pending.device, completion: pending.completion)
            return
        }
        guard peripheral === connected else { return }
        status = "Disconnected"
        log("BLE transport disconnected")
        failConnection(error ?? OBDManagerError.disconnected)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral === connected else { return }
        if let error { failConnection(error); return }
        guard let services = peripheral.services, !services.isEmpty else {
            failConnection(OBDManagerError.uartUnavailable)
            return
        }
        pendingServiceIDs = Set(services.map(\.uuid))
        characteristicsByService.removeAll()
        servicesLog.append("Services:")
        services.forEach {
            servicesLog.append(" • \($0.uuid.uuidString)")
            peripheral.discoverCharacteristics(nil, for: $0)
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        guard peripheral === connected else { return }
        if let error { log("Characteristic discovery error: \(error.localizedDescription)") }
        let characteristics = service.characteristics ?? []
        characteristicsByService[service.uuid] = characteristics
        pendingServiceIDs.remove(service.uuid)
        servicesLog.append("Characteristics for \(service.uuid.uuidString):")
        characteristics.forEach {
            servicesLog.append(" • \($0.uuid.uuidString) props=\($0.properties.rawValue)")
        }
        if pendingServiceIDs.isEmpty { configureUART(on: peripheral) }
    }

    private func configureUART(on peripheral: CBPeripheral) {
        let services = characteristicsByService.map { id, channels in
            UARTService(id: id.uuidString, channels: channels.map { UARTChannel(id: $0.uuid.uuidString, canWrite: $0.canWrite, canNotify: $0.canNotify) })
        }
        guard let selected = ConnectionPolicy.selectUART(services),
              let channels = characteristicsByService[CBUUID(string: selected.service)],
              let write = channels.first(where: { $0.uuid == CBUUID(string: selected.write) }),
              let notify = channels.first(where: { $0.uuid == CBUUID(string: selected.notify) }) else {
            failConnection(OBDManagerError.uartUnavailable); return
        }
        let pair = (write, notify)
        txChar = pair.0
        rxChar = pair.1
        writeType = pair.0.properties.contains(.write) ? .withResponse : .withoutResponse
        connectionStage = "NOTIFY"
        status = "Enabling notifications…"
        log("UART TX=\(pair.0.uuid), RX=\(pair.1.uuid)")
        peripheral.setNotifyValue(true, for: pair.1)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard peripheral === connected, characteristic == rxChar else { return }
        if let error { failConnection(error); return }
        guard characteristic.isNotifying else {
            failConnection(OBDManagerError.notificationsUnavailable)
            return
        }
        guard !initializationStarted else { return }
        initializationStarted = true
        armConnectionTimeout(ConnectionPolicy.initializationTimeout, error: .initializationTimedOut)
        initializeELM()
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard peripheral === connected else { return }
        if let error { log("Notification error: \(error.localizedDescription)"); return }
        guard characteristic == rxChar, let data = characteristic.value else { return }
        readBuffer.append(data)
        processIncoming()
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard peripheral === connected, characteristic == txChar else { return }
        if let error {
            finishActiveCommand(.failure(error))
        }
    }

    private func initializeELM() {
        connectionStage = "ELM"
        status = "Initializing ELM327…"
        let commands: [(String, TimeInterval)] = [
            ("ATZ", ConnectionPolicy.resetTimeout), ("ATE0", ConnectionPolicy.commandTimeout),
            ("ATL0", ConnectionPolicy.commandTimeout), ("ATS1", ConnectionPolicy.commandTimeout),
            ("ATH0", ConnectionPolicy.commandTimeout), ("ATSP0", ConnectionPolicy.commandTimeout),
            ("0100", ConnectionPolicy.protocolTimeout)
        ]
        runSequence(commands, index: 0) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error): self.failConnection(error)
            case .success(let lastResponse):
                guard self.extractPayloads(lastResponse, marker: 0x41).contains(where: { $0[safe: 1] == 0x00 }) else {
                    self.failConnection(OBDManagerError.protocolNotDetected(self.elmError(lastResponse) ?? ""))
                    return
                }
                self.ready = true
                self.status = "Connected"
                self.log("ELM327 and vehicle protocol are ready")
                self.connectionTimeout?.cancel()
                self.connectionTimeout = nil
                self.connectCompletion?(.success(true))
                self.connectCompletion = nil
            }
        }
    }

    private func runSequence(
        _ commands: [(String, TimeInterval)],
        index: Int,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        guard index < commands.count else { completion(.success("")); return }
        let generation = connectionGeneration
        let item = commands[index]
        if item.0 == "0100" { connectionStage = "ECU" }
        execute(item.0, timeout: item.1) { [weak self] result in
            guard let self, self.connectionGeneration == generation else { return }
            switch result {
            case .failure: completion(result)
            case .success(let response):
                if index == commands.count - 1 { completion(.success(response)) }
                else { self.runSequence(commands, index: index + 1, completion: completion) }
            }
        }
    }

    private func execute(
        _ command: String,
        timeout: TimeInterval = 2.5,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        commandQueue.append(QueuedCommand(command: command, timeout: timeout, completion: completion))
        sendNextCommand()
    }

    private func sendNextCommand() {
        guard activeCommand == nil, !commandQueue.isEmpty else { return }
        guard let peripheral = connected, let txChar else {
            failAllCommands(OBDManagerError.uartUnavailable)
            return
        }
        let next = commandQueue.removeFirst()
        let generation = connectionGeneration
        activeCommand = next
        readBuffer.removeAll(keepingCapacity: true)
        guard let data = "\(next.command)\r".data(using: .ascii) else {
            finishActiveCommand(.failure(OBDManagerError.uartUnavailable))
            return
        }
        log("TX: \(next.command)")
        peripheral.writeValue(data, for: txChar, type: writeType)

        let timeoutWork = DispatchWorkItem { [weak self] in
            guard let self, self.connectionGeneration == generation, self.activeCommand?.id == next.id else { return }
            self.finishActiveCommand(.failure(OBDManagerError.commandTimedOut(next.command)))
        }
        commandTimeout = timeoutWork
        DispatchQueue.main.asyncAfter(deadline: .now() + next.timeout, execute: timeoutWork)
    }

    private func processIncoming() {
        guard let response = ConnectionPolicy.responseBeforePrompt(readBuffer) else { return }
        // Only one request was sent. Extra prompts in this notification predate the next request.
        readBuffer.removeAll(keepingCapacity: true)
        finishActiveCommand(.success(response))
    }

    private func finishActiveCommand(_ result: Result<String, Error>) {
        guard let command = activeCommand else { return }
        commandTimeout?.cancel()
        commandTimeout = nil
        activeCommand = nil
        if case .success = result {
            log("RX[\(command.command)]: response received")
        }
        command.completion(result)
        sendNextCommand()
    }

    private func failAllCommands(_ error: Error) {
        commandTimeout?.cancel()
        commandTimeout = nil
        let active = activeCommand
        activeCommand = nil
        let queued = commandQueue
        commandQueue.removeAll()
        active?.completion(.failure(error))
        queued.forEach { $0.completion(.failure(error)) }
    }

    func refreshLive(completion: @escaping (Result<[OBDValue], Error>) -> Void) {
        guard ready else { completion(.failure(OBDManagerError.disconnected)); return }
        guard !refreshingLive else { completion(.success(live)); return }
        refreshingLive = true
        live.removeAll()
        readLivePID(at: 0) { [weak self] in
            guard let self else { return }
            self.refreshingLive = false
            completion(.success(self.live))
        }
    }

    private func readLivePID(at index: Int, completion: @escaping () -> Void) {
        guard ready else { completion(); return }
        guard index < livePIDs.count else { completion(); return }
        let pid = livePIDs[index]
        execute(pid.rawValue) { [weak self] result in
            guard let self else { return }
            if case .success(let response) = result {
                if pid == .batteryVoltage { self.parseBattery(response) }
                else { self.parsePID(response) }
            }
            self.readLivePID(at: index + 1, completion: completion)
        }
    }

    func readDTCs(completion: @escaping (Result<[String], Error>) -> Void) {
        readCodes(command: "03", marker: 0x43, completion: completion) { self.dtc = $0 }
    }

    func readPendingDTCs(completion: @escaping (Result<[String], Error>) -> Void) {
        readCodes(command: "07", marker: 0x47, completion: completion) { self.pendingDtc = $0 }
    }

    func readPermanentDTCs(completion: @escaping (Result<[String], Error>) -> Void) {
        readCodes(command: "0A", marker: 0x4A, completion: completion) { self.permanentDtc = $0 }
    }

    private func readCodes(
        command: String,
        marker: UInt8,
        completion: @escaping (Result<[String], Error>) -> Void,
        store: @escaping ([String]) -> Void
    ) {
        guard ready else { completion(.failure(OBDManagerError.disconnected)); return }
        execute(command) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error): completion(.failure(error))
            case .success(let response):
                guard DiagnosticResponses.hasCompleteCodes(self.extractPayloads(response, marker: marker)) else {
                    completion(.failure(OBDManagerError.invalidDiagnosticResponse)); return
                }
                let codes = self.parseDTCResponse(response, marker: marker)
                store(codes)
                completion(.success(codes))
            }
        }
    }

    func clearDTCs(completion: @escaping (Result<Void, Error>) -> Void) {
        guard ready else { completion(.failure(OBDManagerError.disconnected)); return }
        requireZero(pid: 0x0C, command: "010C", byteCount: 2) { [weak self] rpmResult in
            guard let self else { return }
            if case .failure(let error) = rpmResult { completion(.failure(error)); return }
            self.requireZero(pid: 0x0D, command: "010D", byteCount: 1) { speedResult in
                if case .failure(let error) = speedResult { completion(.failure(error)); return }
                self.execute("04", timeout: 8) { result in
                    switch result {
                    case .failure(let error): completion(.failure(error))
                    case .success(let response):
                        guard !self.extractPayloads(response, marker: 0x44).isEmpty else {
                            completion(.failure(OBDManagerError.unconfirmedClear)); return
                        }
                        self.dtc.removeAll()
                        self.pendingDtc.removeAll()
                        // Permanent codes can remain until the ECU verifies the repair.
                        completion(.success(()))
                    }
                }
            }
        }
    }

    private func requireZero(pid: UInt8, command: String, byteCount: Int, completion: @escaping (Result<Void, Error>) -> Void) {
        execute(command) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error): completion(.failure(error))
            case .success(let response):
                let readings = self.extractPayloads(response, marker: 0x41).filter { $0.count >= 2 && $0[1] == pid }
                guard DiagnosticResponses.isStopped(readings, pid: pid, byteCount: byteCount) else {
                    completion(.failure(OBDManagerError.unsafeClear)); return
                }
                completion(.success(()))
            }
        }
    }

    func readVIN(completion: @escaping (Result<String, Error>) -> Void) {
        guard ready else { completion(.failure(OBDManagerError.disconnected)); return }
        execute("0902", timeout: 12) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error): completion(.failure(error))
            case .success(let response):
                self.vin = self.parseVIN(response)
                completion(.success(self.vin))
            }
        }
    }

    private func parsePID(_ response: String) {
        for bytes in extractPayloads(response, marker: 0x41) {
            guard let pid = bytes[safe: 1], let a = bytes[safe: 2] else { continue }
            let b = bytes[safe: 3] ?? 0
            switch pid {
            case 0x0C: set(.engineRPM, "\((Int(a) * 256 + Int(b)) / 4)")
            case 0x0D: set(.vehicleSpeed, "\(a)")
            case 0x05: set(.coolantTemp, "\(Int(a) - 40)")
            case 0x2F: set(.fuelLevel, format(Double(a) * 100 / 255, 1))
            case 0x04: set(.engineLoad, format(Double(a) * 100 / 255, 1))
            case 0x42: set(.controlVoltage, format(Double(Int(a) * 256 + Int(b)) / 1000, 3))
            case 0x0F: set(.intakeAirTemp, "\(Int(a) - 40)")
            case 0x0B: set(.intakeMAP, "\(a)")
            case 0x10: set(.mafRate, format(Double(Int(a) * 256 + Int(b)) / 100, 2))
            case 0x11: set(.throttle, format(Double(a) * 100 / 255, 1))
            case 0x0E: set(.timingAdvance, format(Double(a) / 2 - 64, 1))
            case 0x23: set(.fuelRailPressure, "\((Int(a) * 256 + Int(b)) * 10)")
            case 0x44: set(.afr, format(Double(Int(a) * 256 + Int(b)) / 32768 * 14.7, 2))
            case 0x28: set(.afrBank2, format(Double(Int(a) * 256 + Int(b)) / 32768 * 14.7, 2))
            case 0x06: set(.shortFuelTrimB1, format((Double(a) - 128) * 100 / 128, 1))
            case 0x07: set(.longFuelTrimB1, format((Double(a) - 128) * 100 / 128, 1))
            case 0x08: set(.shortFuelTrimB2, format((Double(a) - 128) * 100 / 128, 1))
            case 0x09: set(.longFuelTrimB2, format((Double(a) - 128) * 100 / 128, 1))
            case 0x5C: set(.oilTemp, "\(Int(a) - 40)")
            case 0x49: set(.pedalPosition, format(Double(a) * 100 / 255, 1))
            case 0x33: set(.baroPressure, "\(a)")
            case 0x46: set(.ambientTemp, "\(Int(a) - 40)")
            default: break
            }
        }
    }

    private func parseBattery(_ response: String) {
        let normalized = response.uppercased().replacingOccurrences(of: "V", with: " ")
        normalized.split(whereSeparator: { $0.isWhitespace })
            .compactMap { Double($0) }
            .first
            .map { set(.batteryVoltage, format($0, 1)) }
    }

    private func set(_ pid: OBDPID, _ value: String) {
        let item = OBDValue(key: pid, value: value, ts: Date())
        if let index = live.firstIndex(where: { $0.key == pid }) { live[index] = item }
        else { live.append(item) }
    }

    private func extractPayloads(_ response: String, marker: UInt8) -> [[UInt8]] { DiagnosticResponses.payloads(response, marker: marker) }

    private func parseDTCResponse(_ response: String, marker: UInt8) -> [String] {
        var result: [String] = []
        for payload in extractPayloads(response, marker: marker) {
            let data = dtcBytes(from: payload)
            var index = 0
            while index + 1 < data.count {
                let high = data[index]
                let low = data[index + 1]
                if high != 0 || low != 0 { result.append(decodeDTC(high, low)) }
                index += 2
            }
        }
        var seen = Set<String>()
        return result.filter { seen.insert($0).inserted }
    }

    /// ISO 15765-4 (CAN) inserts a count byte before its two-byte DTC records.
    /// Legacy protocols omit it, so their response data has an even byte count.
    private func dtcBytes(from payload: [UInt8]) -> [UInt8] {
        let responseData = Array(payload.dropFirst())
        guard !responseData.count.isMultiple(of: 2) else { return responseData }
        guard let announcedCount = responseData.first else { return [] }

        let availableBytes = Array(responseData.dropFirst())
        let availableCount = availableBytes.count / 2
        let codeCount = min(Int(announcedCount), availableCount)
        return Array(availableBytes.prefix(codeCount * 2))
    }

    private func decodeDTC(_ high: UInt8, _ low: UInt8) -> String {
        let system = ["P", "C", "B", "U"][Int((high & 0xC0) >> 6)]
        return String(
            format: "%@%01X%01X%01X%01X",
            system, (high & 0x30) >> 4, high & 0x0F, (low & 0xF0) >> 4, low & 0x0F
        )
    }

    private func parseVIN(_ response: String) -> String { VinDecoder.decode(response) }

    private func elmError(_ response: String) -> String? {
        let upper = response.uppercased()
        if upper.contains("UNABLE TO CONNECT") { return "ECU is not responding" }
        if upper.contains("NO DATA") { return "ECU returned NO DATA" }
        if upper.contains("STOPPED") { return "ELM327 command was interrupted" }
        if upper.contains("BUS ERROR") || upper.contains("CAN ERROR") { return "Vehicle bus error" }
        if upper.contains("?") { return "ELM327 rejected a command" }
        return nil
    }

    private func failConnection(_ error: Error) {
        status = "Connection failed"
        let message = error.localizedDescription
        let reason: Error = message.hasPrefix("OBD_") ? error : NSError(
            domain: "MyGarage.OBD", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "OBD_\(connectionStage)_FAILED: \(message)"]
        )
        log("Connection failed: \(reason.localizedDescription)")
        endSession(reason)
    }

    private func dropStaleDevices() {
        guard scanning else { return }
        let cutoff = Date().addingTimeInterval(-10)
        devices.removeAll { $0.lastSeen < cutoff }
        devices.sort { $0.rssi > $1.rssi }
    }

    private func log(_ message: String) {
        rawLog.append(message)
        if rawLog.count > 800 { rawLog.removeFirst(rawLog.count - 800) }
    }

    private func format(_ value: Double, _ decimals: Int) -> String {
        String(format: "%.*f", decimals, value)
    }
}

private extension CBCharacteristic {
    var canWrite: Bool { properties.contains(.write) || properties.contains(.writeWithoutResponse) }
    var canNotify: Bool { properties.contains(.notify) || properties.contains(.indicate) }
}

private extension Collection {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}

extension OBDPID {
    var shortKey: String {
        switch self {
        case .engineRPM: return "RPM"
        case .vehicleSpeed: return "Speed"
        case .coolantTemp: return "Coolant"
        case .fuelLevel: return "Fuel"
        case .engineLoad: return "EngineLoad"
        case .controlVoltage: return "ControlVoltage"
        case .intakeAirTemp: return "IntakeAir"
        case .intakeMAP: return "MAP"
        case .mafRate: return "MAF"
        case .throttle: return "Throttle"
        case .timingAdvance: return "TimingAdvance"
        case .fuelRailPressure: return "FuelRailPressure"
        case .afr: return "AFR"
        case .afrBank2: return "AFRBank2"
        case .shortFuelTrimB1: return "ShortFuelTrimB1"
        case .longFuelTrimB1: return "LongFuelTrimB1"
        case .shortFuelTrimB2: return "ShortFuelTrimB2"
        case .longFuelTrimB2: return "LongFuelTrimB2"
        case .oilTemp: return "OilTemp"
        case .pedalPosition: return "PedalPosition"
        case .baroPressure: return "BaroPressure"
        case .ambientTemp: return "Ambient"
        case .batteryVoltage: return "Battery"
        }
    }
}
