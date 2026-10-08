package com.shahinst.cdnscanner.scan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanLogicTest {
    @Test
    fun ipv4RangeIsSplitIntoSlash24Blocks() {
        val blocks = IpGen.split24("104.16.0.0/22")
        assertEquals(listOf("104.16.0", "104.16.1", "104.16.2", "104.16.3"), blocks)
        assertTrue(IpGen.isValidRange("1.1.1.1"))
        assertFalse(IpGen.isValidRange("300.1.1.1/24"))
    }

    @Test
    fun generateScanIpsIsFairAndBounded() {
        val ips = IpGen.generateScanIps(listOf("104.16.0.0/24", "172.67.0.0/24"), perBlock = 10, maxTotal = 15)
        assertEquals(15, ips.size)
        assertEquals(ips.size, ips.toSet().size)
        assertTrue(ips.any { it.startsWith("104.16.0.") } && ips.any { it.startsWith("172.67.0.") })
    }

    @Test
    fun vlessConfigIsParsedAndRebuiltWithNewIp() {
        val uri = "vless://11111111-2222-3333-4444-555555555555@example.com:443?type=ws&security=tls&sni=example.com&host=example.com&path=%2Fws#My%20Server"
        val parsed = V2Ray.parse(uri)
        assertNotNull(parsed)
        assertEquals("vless", parsed!!.protocol)
        assertEquals(443, parsed.port)
        val rebuilt = V2Ray.rebuild(parsed, "104.16.1.2", "FRA")
        assertTrue(rebuilt.startsWith("vless://11111111-2222-3333-4444-555555555555@104.16.1.2:443"))
        assertTrue(rebuilt.contains("sni=example.com"))
        assertNull(V2Ray.parse("http://not-a-proxy"))
    }

    @Test
    fun scoreRewardsLowPingAndPunishesDeadIps() {
        val good = CdnScanner.calcScore(FoundIp(ip = "1.1.1.1", ping = 50.0, openPorts = listOf(443), score = 0.0))
        val slow = CdnScanner.calcScore(FoundIp(ip = "1.1.1.2", ping = 900.0, openPorts = listOf(443), score = 0.0))
        val dead = CdnScanner.calcScore(FoundIp(ip = "1.1.1.3", ping = 50.0, openPorts = listOf(443), score = 0.0, alive = false))
        assertTrue(good > slow)
        assertEquals(0.0, dead, 0.0)
    }

    @Test
    fun coloCodesMapToCityNames() {
        assertEquals("Frankfurt, DE", Colo.name("fra"))
        assertEquals("XYZ", Colo.label("XYZ"))
    }
}
