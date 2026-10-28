package expo.modules.obd

import java.util.Locale

/** Reassembles Mode 09 VINs without mixing ECU streams or accepting incomplete frames. */
internal object VinDecoder {
    private data class Stream(val bytes: MutableList<Int> = mutableListOf(), var mode: String = "", var next: Int = 1, var valid: Boolean = true)
    fun decode(response: String): String {
        val streams = mutableMapOf<String, Stream>()
        val results = mutableSetOf<String>()
        response.uppercase(Locale.ROOT).replace("SEARCHING...", "").lineSequence().forEach { source ->
            var line = source.trim()
            var index: Int? = null
            Regex("^([0-9A-F]+):").find(line)?.let { match ->
                index = match.groupValues[1].toIntOrNull(16)
                line = line.substring(match.value.length).trim()
            }
            val tokens = line.split(Regex("\\s+")).filter { it.isNotEmpty() }
            var ecu = "default"
            if (tokens.size > 1 && tokens[0].length in listOf(3, 8) && tokens[0].all { it in "0123456789ABCDEF" }) {
                ecu = tokens[0]
                line = tokens.drop(1).joinToString("")
            }
            val compact = line.filterNot { it.isWhitespace() }
            if (compact.isEmpty() || compact.length % 2 != 0 || !compact.all { it in "0123456789ABCDEF" }) return@forEach
            var bytes = compact.chunked(2).map { it.toInt(16) }
            val isoStart = bytes.firstOrNull()?.and(0xF0) == 0x10
            if (isoStart) bytes = bytes.drop(2)
            val stream = streams.getOrPut(ecu) { Stream() }
            when {
                bytes.size >= 3 && bytes[0] == 0x49 && bytes[1] == 0x02 -> {
                    val packet = bytes[2]
                    if (packet == 1) {
                        stream.bytes.clear(); stream.valid = true
                        stream.mode = if (isoStart) "iso" else if (index != null) "indexed" else "chunks"
                        stream.next = if (stream.mode == "indexed") (index ?: 0) + 1 else if (stream.mode == "chunks") 2 else 1
                    } else if (stream.mode != "chunks" || packet != stream.next) { stream.valid = false; return@forEach }
                    else stream.next++
                    stream.bytes.addAll(bytes.drop(3))
                }
                stream.mode == "indexed" && index != null -> {
                    if (index != stream.next) { stream.valid = false; return@forEach }
                    stream.next++; stream.bytes.addAll(bytes)
                }
                stream.mode == "iso" && bytes.firstOrNull()?.and(0xF0) == 0x20 -> {
                    if (bytes[0].and(0x0F) != stream.next.and(0x0F)) { stream.valid = false; return@forEach }
                    stream.next++; stream.bytes.addAll(bytes.drop(1))
                }
            }
            if (stream.valid && stream.bytes.dropWhile { it == 0 }.size >= 17) {
                val vin = stream.bytes.dropWhile { it == 0 }.take(17).map(Int::toChar).joinToString("")
                if (Regex("^[A-HJ-NPR-Z0-9]{17}$").matches(vin)) results.add(vin)
            }
        }
        return results.singleOrNull() ?: ""
    }
}
