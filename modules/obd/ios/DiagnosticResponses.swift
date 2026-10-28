import Foundation

enum DiagnosticResponses {
    static func payloads(_ response: String, marker: UInt8) -> [[UInt8]] {
        let hex = Set("0123456789ABCDEF")
        return response.uppercased().replacingOccurrences(of: "SEARCHING...", with: "").components(separatedBy: .newlines).compactMap { source in
            var line = source.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ">", with: "")
            line = line.replacingOccurrences(of: "^[0-9A-F]+:\\s*", with: "", options: .regularExpression)
            let tokens = line.split(whereSeparator: { $0.isWhitespace }).map(String.init)
            if tokens.count > 1 && [3,8].contains(tokens[0].count) && tokens[0].allSatisfy({ hex.contains($0) }) { line = tokens.dropFirst().joined() }
            var compact = line.filter { !$0.isWhitespace }
            if !compact.count.isMultiple(of: 2), compact.range(of: "^7E[8-F]", options: .regularExpression) != nil { compact = String(compact.dropFirst(3)) }
            if (compact.hasPrefix("18DA") || compact.hasPrefix("18DB")) && compact.count > 8 { compact = String(compact.dropFirst(8)) }
            guard !compact.isEmpty, compact.count.isMultiple(of: 2), compact.allSatisfy({ hex.contains($0) }) else { return nil }
            var bytes = stride(from: 0, to: compact.count, by: 2).compactMap { offset -> UInt8? in
                let start = compact.index(compact.startIndex, offsetBy: offset)
                return UInt8(compact[start..<compact.index(start, offsetBy: 2)], radix: 16)
            }
            if bytes.first != marker {
                if bytes.count > 1 && bytes[0] <= 15 && bytes[1] == marker { bytes = Array(bytes.dropFirst()) }
                else if bytes.count > 2 && bytes[0] & 0xF0 == 0x10 && bytes[2] == marker { bytes = Array(bytes.dropFirst(2)) }
                else { return nil }
            }
            return bytes
        }
    }
    static func isStopped(_ readings: [[UInt8]], pid: UInt8, byteCount: Int) -> Bool {
        let matching = readings.filter { $0.count >= 2 && $0[0] == 0x41 && $0[1] == pid }
        return !matching.isEmpty && matching.allSatisfy { $0.count >= 2 + byteCount && $0.dropFirst(2).prefix(byteCount).allSatisfy { $0 == 0 } }
    }
    static func hasCompleteCodes(_ payloads: [[UInt8]]) -> Bool {
        !payloads.isEmpty && payloads.allSatisfy { payload in
            guard payload.count >= 2 else { return false }
            let data = Array(payload.dropFirst())
            return data.count.isMultiple(of: 2) || Int(data[0]) <= data.dropFirst().count / 2
        }
    }
}
