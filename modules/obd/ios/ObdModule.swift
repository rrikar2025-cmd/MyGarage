import ExpoModulesCore

public class ObdModule: Module {
    private let manager = OBDManager()

    public func definition() -> ModuleDefinition {
        Name("Obd")

        AsyncFunction("startScan") { (promise: Promise) in
            DispatchQueue.main.async {
                do {
                    try self.manager.startScan()
                    promise.resolve(nil)
                } catch {
                    promise.reject("SCAN_FAIL", error.localizedDescription)
                }
            }
        }

        AsyncFunction("stopScan") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.stopScan()
                promise.resolve(nil)
            }
        }

        // Returns [{id, name, rssi}] — id is a UUID string on iOS
        AsyncFunction("getDevices") { (promise: Promise) in
            DispatchQueue.main.async {
                let list = self.manager.devices.map { dev -> [String: Any] in
                    ["id": dev.id.uuidString, "name": dev.name, "rssi": dev.rssi]
                }
                promise.resolve(list)
            }
        }

        // uuid is the UUID string returned by getDevices on iOS
        AsyncFunction("connect") { (uuid: String, promise: Promise) in
            DispatchQueue.main.async {
                guard let device = self.manager.devices.first(where: { $0.id.uuidString == uuid }) else {
                    promise.reject("CONNECT_FAIL", "Device not found: \(uuid)")
                    return
                }
                self.manager.connect(device) { result in
                    switch result {
                    case .success(let connected): promise.resolve(connected)
                    case .failure(let error): promise.reject("CONNECT_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("disconnect") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.disconnect()
                promise.resolve(nil)
            }
        }

        // Resolve only after the serialized PID poll has completed.
        AsyncFunction("getLiveValues") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.refreshLive { result in
                    switch result {
                    case .success(let live):
                        let values = live.map { value -> [String: Any] in
                            ["key": value.key.shortKey, "value": value.value]
                        }
                        promise.resolve(values)
                    case .failure(let error):
                        promise.reject("LIVE_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("readDTCs") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.readDTCs { result in
                    switch result {
                    case .success: promise.resolve(nil)
                    case .failure(let error): promise.reject("DTC_READ_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("readPendingDTCs") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.readPendingDTCs { result in
                    switch result {
                    case .success: promise.resolve(nil)
                    case .failure(let error): promise.reject("PENDING_DTC_READ_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("readPermanentDTCs") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.readPermanentDTCs { result in
                    switch result {
                    case .success: promise.resolve(nil)
                    case .failure(let error): promise.reject("PERMANENT_DTC_READ_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("clearDTCs") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.clearDTCs { result in
                    switch result {
                    case .success: promise.resolve(nil)
                    case .failure(let error): promise.reject("DTC_CLEAR_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("readVIN") { (promise: Promise) in
            DispatchQueue.main.async {
                self.manager.readVIN { result in
                    switch result {
                    case .success: promise.resolve(nil)
                    case .failure(let error): promise.reject("VIN_READ_FAIL", error.localizedDescription)
                    }
                }
            }
        }

        AsyncFunction("getDTCs") { (promise: Promise) in
            promise.resolve(self.manager.dtc)
        }

        AsyncFunction("getPendingDTCs") { (promise: Promise) in
            promise.resolve(self.manager.pendingDtc)
        }

        AsyncFunction("getPermanentDTCs") { (promise: Promise) in
            promise.resolve(self.manager.permanentDtc)
        }

        AsyncFunction("getVIN") { (promise: Promise) in
            promise.resolve(self.manager.vin)
        }

        AsyncFunction("isConnected") { (promise: Promise) in
            promise.resolve(self.manager.ready)
        }
    }
}
