package expo.modules.obd

internal object DiagnosticResponses {
    fun payloads(response: String, marker: Int): List<List<Int>> = response.uppercase(java.util.Locale.ROOT)
        .replace("SEARCHING...", "").lineSequence().mapNotNull { source ->
            var line = source.trim().removeSuffix(">").trim().replace(Regex("^[0-9A-F]+:\\s*"), "")
            val tokens = line.split(Regex("\\s+")).filter { it.isNotEmpty() }
            if (tokens.size > 1 && tokens[0].length in listOf(3,8) && tokens[0].all { it in "0123456789ABCDEF" }) line = tokens.drop(1).joinToString("")
            var compact = line.filterNot { it.isWhitespace() }
            if (compact.length % 2 != 0 && Regex("^7E[8-F]").containsMatchIn(compact)) compact = compact.drop(3)
            if ((compact.startsWith("18DA") || compact.startsWith("18DB")) && compact.length > 8) compact = compact.drop(8)
            if (compact.isEmpty() || compact.length % 2 != 0 || !compact.all { it in "0123456789ABCDEF" }) return@mapNotNull null
            var bytes = compact.chunked(2).map { it.toInt(16) }
            if (bytes.firstOrNull() != marker) {
                bytes = when {
                    bytes.size > 1 && bytes[0] in 0..15 && bytes[1] == marker -> bytes.drop(1)
                    bytes.size > 2 && bytes[0].and(0xF0) == 0x10 && bytes[2] == marker -> bytes.drop(2)
                    else -> return@mapNotNull null
                }
            }
            bytes
        }.toList()

    fun requireStopped(payloads: List<List<Int>>, pid: Int) {
        val readings = payloads.filter { it.getOrNull(0) == 0x41 && it.getOrNull(1) == pid }
        val bytes = if (pid == 0x0C) 2 else 1
        require(readings.isNotEmpty() && readings.all { it.size >= 2 + bytes && it.drop(2).take(bytes).all { b -> b == 0 } }) {
            "CLEAR_UNSAFE: ECU must report zero RPM and zero speed"
        }
    }
    fun requireAcknowledged(payloads: List<List<Int>>) {
        require(payloads.any { it.firstOrNull() == 0x44 }) { "CLEAR_UNCONFIRMED: no positive Mode 04 response" }
    }
    fun requireCodes(payloads: List<List<Int>>, marker: Int) {
        require(payloads.isNotEmpty() && payloads.all { it.firstOrNull() == marker && it.size >= 2 }) { "DTC response unavailable" }
        require(payloads.all { val data = it.drop(1); data.size % 2 == 0 || data[0] <= data.drop(1).size / 2 }) { "Incomplete DTC response" }
    }
}
