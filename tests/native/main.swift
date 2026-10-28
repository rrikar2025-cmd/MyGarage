import Foundation
struct Fixture: Decodable { let name: String; let response: String; let expected: String }
let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
for fixture in fixtures {
    precondition(VinDecoder.decode(fixture.response) == fixture.expected, "VIN fixture failed: \(fixture.name)")
}
precondition(DiagnosticResponses.payloads("NO DATA", marker: 0x44).isEmpty)
precondition(DiagnosticResponses.payloads("18DAF144 03 7F 04 22", marker: 0x44).isEmpty)
precondition(DiagnosticResponses.payloads("7E8 01 44", marker: 0x44) == [[0x44]])
precondition(DiagnosticResponses.isStopped([[0x41,0x0C,0,0]], pid: 0x0C, byteCount: 2))
precondition(!DiagnosticResponses.isStopped([[0x41,0x0C,0,4]], pid: 0x0C, byteCount: 2))
precondition(!DiagnosticResponses.isStopped([], pid: 0x0D, byteCount: 1))
precondition(!DiagnosticResponses.hasCompleteCodes([[0x43,2,0x24,0x0A]]))
precondition(DiagnosticResponses.hasCompleteCodes([[0x43,0]]))
print("PASS: \(fixtures.count) VIN fixtures and 8 diagnostic response checks (Swift)")
