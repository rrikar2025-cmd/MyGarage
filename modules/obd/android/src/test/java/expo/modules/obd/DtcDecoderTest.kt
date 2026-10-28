package expo.modules.obd

import org.junit.Assert.assertEquals
import org.junit.Test

class DtcDecoderTest {
    @Test
    fun `decodes BMW CAN response after skipping DTC count`() {
        val payload = listOf(0x43, 0x02, 0x24, 0x0A, 0x24, 0x00)

        assertEquals(listOf("P240A", "P2400"), DtcDecoder.decodePayload(payload, 0x43))
    }

    @Test
    fun `uses announced CAN count and ignores padding`() {
        val payload = listOf(0x43, 0x02, 0x24, 0x00, 0x24, 0x0A, 0x00, 0x00)

        assertEquals(listOf("P2400", "P240A"), DtcDecoder.decodePayload(payload, 0x43))
    }

    @Test
    fun `keeps legacy response pairing when count byte is absent`() {
        val payload = listOf(0x43, 0x01, 0x33, 0x02, 0x34, 0x00, 0x00)

        assertEquals(listOf("P0133", "P0234"), DtcDecoder.decodePayload(payload, 0x43))
    }

    @Test
    fun `supports pending and permanent response modes`() {
        assertEquals(
            listOf("P240A"),
            DtcDecoder.decodePayload(listOf(0x47, 0x01, 0x24, 0x0A), 0x47),
        )
        assertEquals(
            listOf("P2400"),
            DtcDecoder.decodePayload(listOf(0x4A, 0x01, 0x24, 0x00), 0x4A),
        )
    }

    @Test
    fun `returns no codes for zero-count and zero-filled responses`() {
        assertEquals(emptyList<String>(), DtcDecoder.decodePayload(listOf(0x43, 0x00), 0x43))
        assertEquals(
            emptyList<String>(),
            DtcDecoder.decodePayload(listOf(0x43, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00), 0x43),
        )
    }
}
