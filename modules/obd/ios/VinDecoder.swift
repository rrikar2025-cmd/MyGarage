import Foundation

/// Mode 09 response assembly; each ECU has an independent ordered stream.
enum VinDecoder {
    private struct Stream { var bytes: [UInt8] = []; var mode = ""; var next = 1; var valid = true }
    static func decode(_ response: String) -> String {
        var streams: [String: Stream] = [:]
        var results = Set<String>()
        let hex = Set("0123456789ABCDEF")
        for source in response.uppercased().replacingOccurrences(of: "SEARCHING...", with: "").components(separatedBy: .newlines) {
            var line = source.trimmingCharacters(in: .whitespaces)
            var index: Int?
            if let colon = line.firstIndex(of: ":") {
                let prefix = String(line[..<colon])
                if !prefix.isEmpty && prefix.allSatisfy({ hex.contains($0) }) {
                    index = Int(prefix, radix: 16)
                    line = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
                }
            }
            let tokens = line.split(whereSeparator: { $0.isWhitespace }).map(String.init)
            var ecu = "default"
            if tokens.count > 1, [3,8].contains(tokens[0].count), tokens[0].allSatisfy({ hex.contains($0) }) {
                ecu = tokens[0]; line = tokens.dropFirst().joined()
            }
            let compact = line.filter { !$0.isWhitespace }
            guard !compact.isEmpty, compact.count.isMultiple(of: 2), compact.allSatisfy({ hex.contains($0) }) else { continue }
            var bytes = stride(from: 0, to: compact.count, by: 2).compactMap { offset -> UInt8? in
                let start = compact.index(compact.startIndex, offsetBy: offset)
                return UInt8(compact[start..<compact.index(start, offsetBy: 2)], radix: 16)
            }
            let isoStart = bytes.first.map { $0 & 0xF0 == 0x10 } ?? false
            if isoStart { bytes = Array(bytes.dropFirst(2)) }
            var stream = streams[ecu] ?? Stream()
            if bytes.count >= 3 && bytes[0] == 0x49 && bytes[1] == 0x02 {
                let packet = Int(bytes[2])
                if packet == 1 {
                    stream.bytes = []; stream.valid = true
                    stream.mode = isoStart ? "iso" : index != nil ? "indexed" : "chunks"
                    stream.next = stream.mode == "indexed" ? (index ?? 0) + 1 : stream.mode == "chunks" ? 2 : 1
                } else if stream.mode != "chunks" || packet != stream.next {
                    stream.valid = false; streams[ecu] = stream; continue
                } else { stream.next += 1 }
                stream.bytes.append(contentsOf: bytes.dropFirst(3))
            } else if stream.mode == "indexed", let index {
                guard index == stream.next else { stream.valid = false; streams[ecu] = stream; continue }
                stream.next += 1; stream.bytes.append(contentsOf: bytes)
            } else if stream.mode == "iso", let first = bytes.first, first & 0xF0 == 0x20 {
                guard Int(first & 0x0F) == (stream.next & 0x0F) else { stream.valid = false; streams[ecu] = stream; continue }
                stream.next += 1; stream.bytes.append(contentsOf: bytes.dropFirst())
            }
            streams[ecu] = stream
            if stream.valid && stream.bytes.drop(while: { $0 == 0 }).count >= 17 {
                let vin = String(bytes: stream.bytes.drop(while: { $0 == 0 }).prefix(17), encoding: .ascii) ?? ""
                if vin.range(of: "^[A-HJ-NPR-Z0-9]{17}$", options: .regularExpression) != nil { results.insert(vin) }
            }
        }
        return results.count == 1 ? results.first! : ""
    }
}
