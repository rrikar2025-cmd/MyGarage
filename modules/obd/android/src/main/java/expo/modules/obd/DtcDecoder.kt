package expo.modules.obd

import java.util.Locale

/** Decodes SAE J1979 Mode 03/07/0A response payloads into five-character DTCs. */
internal object DtcDecoder {
    fun decodePayload(payload: List<Int>, responseMode: Int): List<String> {
        if (payload.firstOrNull() != responseMode) return emptyList()

        val responseData = payload.drop(1)
        val dtcBytes = withoutCanDtcCount(responseData)

        return dtcBytes.chunked(2).mapNotNull { pair ->
            if (pair.size < 2 || pair[0] == 0 && pair[1] == 0) null
            else decode(pair[0], pair[1])
        }
    }

    /**
     * ISO 15765-4 (CAN) inserts a DTC-count byte before the two-byte DTC records.
     * Legacy OBD protocols do not. The resulting payload length is therefore odd
     * for CAN and even for legacy responses, including their optional zero padding.
     */
    private fun withoutCanDtcCount(responseData: List<Int>): List<Int> {
        if (responseData.size % 2 == 0) return responseData
        if (responseData.isEmpty()) return emptyList()

        val announcedCount = responseData.first()
        val availableBytes = responseData.drop(1)
        val availableCount = availableBytes.size / 2
        return availableBytes.take(minOf(announcedCount, availableCount) * 2)
    }

    private fun decode(high: Int, low: Int): String {
        val system = listOf("P", "C", "B", "U")[(high and 0xC0) shr 6]
        return String.format(
            Locale.US,
            "%s%01X%01X%01X%01X",
            system,
            (high and 0x30) shr 4,
            high and 0x0F,
            (low and 0xF0) shr 4,
            low and 0x0F,
        )
    }
}
