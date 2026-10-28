import Foundation
var checks = 0
func check(_ value: @autoclosure () -> Bool, _ name: String) {
    precondition(value(), name); checks += 1
}
let notify = UARTChannel(id: "FFF1", canWrite: false, canNotify: true)
let uart = UARTChannel(id: "FFF2", canWrite: true, canNotify: false)
let configuration = UARTChannel(id: "FFF3", canWrite: true, canNotify: false)
// Regression: the old first-writable fallback wrote ELM commands to FFF3 configuration.
let selection = ConnectionPolicy.selectUART([UARTService(id: "FFF0", channels: [configuration, uart, notify])])
check(selection?.write == "FFF2", "ELM writes must use the FFF2 UART, not configuration")
check(selection?.notify == "FFF1", "ELM reads must use FFF1")
check(ConnectionPolicy.selectUART([UARTService(id: "0000fff0-0000-1000-8000-00805f9b34fb", channels: [configuration, uart, notify])])?.write == "FFF2", "128-bit Bluetooth base UUIDs normalize")
check(ConnectionPolicy.selectUART([UARTService(id: "CUSTOM", channels: [configuration, uart, notify])]) == nil, "ambiguous writable ports are not guessed")
check(ConnectionPolicy.selectUART([UARTService(id: "1801", channels: [uart, notify])]) == nil, "standard GATT service is not a serial port")
check(ConnectionPolicy.selectUART([UARTService(id: "CUSTOM", channels: [uart, notify])])?.write == "FFF2", "one unambiguous same-service pair remains supported")
check(ConnectionPolicy.selectUART([UARTService(id: "TX", channels: [uart]), UARTService(id: "RX", channels: [notify])]) == nil, "never combine unrelated services")
let hm10 = UARTChannel(id: "FFE1", canWrite: true, canNotify: true)
check(ConnectionPolicy.selectUART([UARTService(id: "FFE0", channels: [hm10])])?.write == "FFE1", "HM10 single characteristic remains supported")
let nordic = UARTService(id: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E", channels: [UARTChannel(id: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E", canWrite: true, canNotify: false), UARTChannel(id: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E", canWrite: false, canNotify: true)])
check(ConnectionPolicy.selectUART([nordic])?.write == nordic.channels[0].id, "Nordic UART preserved")
check(ConnectionPolicy.initializationTimeout > ConnectionPolicy.resetTimeout + 5 * ConnectionPolicy.commandTimeout + ConnectionPolicy.protocolTimeout, "initialization deadline covers every command plus overhead")
check(ConnectionPolicy.responseBeforePrompt(Data("ELM327\r".utf8)) == nil, "partial notification must not complete a command")
check(ConnectionPolicy.responseBeforePrompt(Data("ELM327\r>\r>".utf8)) == "ELM327\r", "extra reset prompts must not complete the next unsent command")
check(ConnectionPolicy.responseBeforePrompt(Data("41 00 BE 3F A8 13\r>".utf8)) == "41 00 BE 3F A8 13\r", "prompt terminates a complete ECU response")
print("PASS: \(checks) Swift UART selection, phase budget and notification regression checks")
