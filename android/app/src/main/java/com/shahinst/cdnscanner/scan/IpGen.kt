package com.shahinst.cdnscanner.scan

import java.math.BigInteger
import java.net.InetAddress
import java.security.SecureRandom

/**
 * CIDR splitting and random IP generation. Port of SHNetUtils (app/scanner/core.py):
 * IPv4 ranges are split into /24 blocks, IPv6 ranges are sampled through random /120
 * blocks, and blocks are picked round-robin so every range is represented.
 */
object IpGen {
    private const val IPV6_BLOCK_PREFIX = 120
    private const val IPV6_MAX_BLOCKS = 4096
    private val rnd = SecureRandom()
    private val ipv4Re = Regex("""^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$""")

    fun isIpv4(s: String): Boolean {
        val m = ipv4Re.matchEntire(s) ?: return false
        return m.groupValues.drop(1).all { it.toInt() in 0..255 }
    }

    fun isIpv6(s: String): Boolean {
        if (!s.contains(':')) return false
        return try { InetAddress.getByName(s).address.size == 16 } catch (e: Exception) { false }
    }

    /** Valid single IP or CIDR (v4 or v6)? */
    fun isValidRange(s: String): Boolean {
        val parts = s.split('/')
        if (parts.size > 2) return false
        val len = if (parts.size == 2) parts[1].toIntOrNull() ?: return false else null
        return when {
            isIpv4(parts[0]) -> len == null || len in 0..32
            isIpv6(parts[0]) -> len == null || len in 0..128
            else -> false
        }
    }

    private fun ipv4ToLong(s: String): Long = s.split('.').fold(0L) { acc, p -> (acc shl 8) or p.toLong() }

    /** "104.16.0.0/13" -> ["104.16.0", "104.16.1", ...] */
    fun split24(cidr: String): List<String> {
        val parts = cidr.split('/')
        if (parts.size != 2 || !isIpv4(parts[0])) return emptyList()
        val len = parts[1].toIntOrNull() ?: return emptyList()
        if (len !in 0..32) return emptyList()
        val mask = if (len == 0) 0L else (0xFFFFFFFFL shl (32 - len)) and 0xFFFFFFFFL
        val base = ipv4ToLong(parts[0]) and mask
        fun prefix(v: Long) = "${(v shr 24) and 0xFF}.${(v shr 16) and 0xFF}.${(v shr 8) and 0xFF}"
        if (len >= 24) return listOf(prefix(base))
        val end = base or (mask.inv() and 0xFFFFFFFFL)
        val out = ArrayList<String>()
        var cur = base
        while (cur <= end) { out.add(prefix(cur)); cur += 256 }
        return out
    }

    private fun randomBelow(bound: BigInteger): BigInteger {
        var r: BigInteger
        do { r = BigInteger(bound.bitLength(), rnd) } while (r >= bound)
        return r
    }

    /** Up to `count` distinct random /120 blocks (first address as BigInteger) inside an IPv6 CIDR. */
    fun ipv6Blocks(cidr: String, count: Int): List<BigInteger> {
        val parts = cidr.split('/')
        if (parts.size != 2 || !isIpv6(parts[0])) return emptyList()
        val len = parts[1].toIntOrNull() ?: return emptyList()
        if (len !in 0..128) return emptyList()
        val full = BigInteger(1, InetAddress.getByName(parts[0]).address)
        val base = full.shiftRight(128 - len).shiftLeft(128 - len)
        if (len >= IPV6_BLOCK_PREFIX) return listOf(base)
        val nBlocks = BigInteger.ONE.shiftLeft(IPV6_BLOCK_PREFIX - len)
        val n = if (nBlocks > BigInteger.valueOf(count.toLong())) count else nBlocks.toInt()
        val picks = HashSet<BigInteger>()
        while (picks.size < n) picks.add(randomBelow(nBlocks))
        return picks.map { base.add(it.shiftLeft(128 - IPV6_BLOCK_PREFIX)) }
    }

    fun ipv6ToString(v: BigInteger): String {
        val raw = v.toByteArray()
        val bytes = ByteArray(16)
        val src = if (raw.size > 16) raw.copyOfRange(raw.size - 16, raw.size) else raw
        System.arraycopy(src, 0, bytes, 16 - src.size, src.size)
        return InetAddress.getByAddress(bytes).hostAddress ?: ""
    }

    private fun kotlinRandom() = kotlin.random.Random(rnd.nextLong())

    /** Unique random host IPs (.1 - .254) from a /24 ("a.b.c") or an IPv6 /120 block. */
    fun randomIpsFromBlock(block: Any, count: Int): List<String> {
        val numbers = (1..254).shuffled(kotlinRandom()).take(count.coerceIn(1, 254))
        return when (block) {
            is BigInteger -> numbers.map { ipv6ToString(block.add(BigInteger.valueOf(it.toLong()))) }
            else -> numbers.map { "$block.$it" }
        }
    }

    /**
     * Scan IPs with fair representation of ALL ranges (round-robin over the blocks of
     * every range, then shuffled and truncated to `maxTotal`). Entries without "/" are
     * single IPs and are always included.
     */
    fun generateScanIps(cidrs: List<String>, perBlock: Int, maxTotal: Int?): List<String> {
        val singles = ArrayList<String>()
        val blockLists = ArrayList<List<Any>>()
        var v6Count = if (maxTotal != null) maxTotal / maxOf(perBlock, 1) + 1 else IPV6_MAX_BLOCKS
        v6Count = minOf(v6Count, IPV6_MAX_BLOCKS)
        for (raw in cidrs) {
            val cidr = raw.trim()
            if (cidr.isEmpty()) continue
            if (!cidr.contains('/')) { singles.add(cidr); continue }
            val blocks: List<Any> = if (cidr.contains(':')) ipv6Blocks(cidr, v6Count)
                                    else split24(cidr).shuffled(kotlinRandom())
            if (blocks.isNotEmpty()) blockLists.add(blocks)
        }
        if (blockLists.isEmpty() && singles.isEmpty()) return emptyList()
        val selected = ArrayList<Any>()
        if (blockLists.isNotEmpty()) {
            val maxRounds = blockLists.maxOf { it.size }
            outer@ for (round in 0 until maxRounds) {
                for (blocks in blockLists) if (round < blocks.size) selected.add(blocks[round])
                if (maxTotal != null && selected.size * perBlock >= maxTotal) break@outer
            }
        }
        val all = ArrayList<String>(singles)
        for (b in selected) all.addAll(randomIpsFromBlock(b, perBlock))
        all.shuffle(kotlinRandom())
        return if (maxTotal != null && all.size > maxTotal) ArrayList(all.subList(0, maxTotal)) else all
    }
}
