import Foundation

struct UARTChannel {
    let id: String
    let canWrite: Bool
    let canNotify: Bool
}
struct UARTService {
    let id: String
    let channels: [UARTChannel]
}
struct UARTSelection: Equatable {
    let service: String
    let write: String
    let notify: String
}
enum ConnectionPolicy {
    static let transportTimeout: TimeInterval = 25
    static let resetTimeout: TimeInterval = 8
    static let commandTimeout: TimeInterval = 3
    static let protocolTimeout: TimeInterval = 20
    // A distinct budget: the transport timer must not cut off a valid ELM/ECU search.
    static let initializationTimeout = resetTimeout + 5 * commandTimeout + protocolTimeout + 5
    private static let profiles = [
        UARTSelection(service: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E", write: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E", notify: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"),
        UARTSelection(service: "FFF0", write: "FFF2", notify: "FFF1"),
        UARTSelection(service: "FFE0", write: "FFE1", notify: "FFE1")
    ]
    static func responseBeforePrompt(_ data: Data) -> String? {
        guard let range = data.range(of: Data([UInt8(ascii: ">")])) else { return nil }
        return String(data: data.subdata(in: 0..<range.lowerBound), encoding: .ascii) ?? ""
    }
    static func normalized(_ id: String) -> String {
        let value = id.uppercased()
        if value.hasPrefix("0000"), value.hasSuffix("-0000-1000-8000-00805F9B34FB"), value.count == 36 {
            return String(value.dropFirst(4).prefix(4))
        }
        return value
    }
    static func selectUART(_ services: [UARTService]) -> UARTSelection? {
        for profile in profiles {
            guard let service = services.first(where: { normalized($0.id) == profile.service }) else { continue }
            let write = service.channels.first { normalized($0.id) == profile.write && $0.canWrite }
            let notify = service.channels.first { normalized($0.id) == profile.notify && $0.canNotify }
            if let write, let notify { return UARTSelection(service: service.id, write: write.id, notify: notify.id) }
        }
        // Never guess between a UART data port and another writable configuration port.
        let standardServices: Set<String> = ["1800", "1801", "180A", "180F"]
        for service in services.sorted(by: { $0.id < $1.id }) where !standardServices.contains(normalized(service.id)) {
            let writes = service.channels.filter(\.canWrite), notifies = service.channels.filter(\.canNotify)
            if writes.count == 1, notifies.count == 1 {
                return UARTSelection(service: service.id, write: writes[0].id, notify: notifies[0].id)
            }
        }
        return nil
    }
}
