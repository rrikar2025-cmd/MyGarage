package expo.modules.obd
import org.junit.Assert.*
import org.junit.Test
class DiagnosticResponsesTest {
 @Test fun `clear ack requires a real positive payload not an error or ECU header`() {
   DiagnosticResponses.requireAcknowledged(DiagnosticResponses.payloads("7E8 01 44",0x44))
   for (raw in listOf("NO DATA","ERROR","18DAF144 03 7F 04 22")) {
     assertThrows(IllegalArgumentException::class.java) { DiagnosticResponses.requireAcknowledged(DiagnosticResponses.payloads(raw,0x44)) }
   }
 }
 @Test fun `clear rejects moving running missing or conflicting ECU readings`() {
   DiagnosticResponses.requireStopped(listOf(listOf(0x41,0x0C,0,0)),0x0C)
   for (readings in listOf(emptyList(),listOf(listOf(0x41,0x0C,0,4)),listOf(listOf(0x41,0x0C,0)),listOf(listOf(0x41,0x0C,0,0),listOf(0x41,0x0C,0,4)))) {
     assertThrows(IllegalArgumentException::class.java) { DiagnosticResponses.requireStopped(readings,0x0C) }
   }
 }
 @Test fun `no data and incomplete counted response are not clean DTC results`() {
   DiagnosticResponses.requireCodes(listOf(listOf(0x43,0)),0x43)
   assertThrows(IllegalArgumentException::class.java) { DiagnosticResponses.requireCodes(emptyList(),0x43) }
   assertThrows(IllegalArgumentException::class.java) { DiagnosticResponses.requireCodes(listOf(listOf(0x43,2,0x24,0x0A)),0x43) }
 }
 @Test fun `VIN joins ordered ISO TP and rejects incomplete input`() {
   val raw="7E8 10 14 49 02 01 31 48 47\n7E8 21 43 4D 38 32 36 33 33\n7E8 22 41 30 30 34 33 35 32"
   assertEquals("1HGCM82633A004352",VinDecoder.decode(raw))
   assertEquals("",VinDecoder.decode(raw.replace("7E8 21","7E8 23")))
   assertEquals("",VinDecoder.decode("49 02 01 31 48 47"))
 }
}
