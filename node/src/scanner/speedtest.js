// Download speed test through a specific CDN IP (port of app/scanner/speedtest.py).
// Connects to the IP directly, sends the test URL's host as TLS SNI / HTTP Host
// (certificate verified) and measures how fast the body arrives.
import { performance } from 'node:perf_hooks';
import { connect, SocketReader } from './rawHttp.js';

export const DEFAULT_SPEED_TEST_URL = 'https://speed.cloudflare.com/__down?bytes={bytes}';

/**
 * Download `bytes` bytes from `url` (may contain `{bytes}`) through `ip`.
 * Returns the speed in KB/s, or null if the test failed.
 */
export async function measureDownload(ip, { url = DEFAULT_SPEED_TEST_URL, bytes = 1024 * 1024,
                                            timeout = 10.0, shouldStop = null } = {}) {
  const sizeBytes = Math.max(1, Math.trunc(Number(bytes) || 0));
  let u;
  try { u = new URL(String(url).replace('{bytes}', String(sizeBytes))); } catch { return null; }
  const scheme = u.protocol.replace(':', '');
  const host = u.hostname;
  if (!host || !['http', 'https'].includes(scheme)) return null;
  const port = u.port ? Number(u.port) : (scheme === 'https' ? 443 : 80);
  const path = (u.pathname || '/') + (u.search || '');

  const deadline = Date.now() + timeout * 1000;
  const sockTimeout = Math.min(5.0, timeout) * 1000;
  let sock = null;
  try {
    sock = await connect({ host: ip, port, tls: scheme === 'https', servername: host,
                           rejectUnauthorized: true, timeoutMs: sockTimeout });
    const reader = new SocketReader(sock);
    sock.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\n`
               + 'User-Agent: Mozilla/5.0\r\nAccept: */*\r\nConnection: close\r\n\r\n');

    let headEnd;
    while ((headEnd = reader.buf.indexOf('\r\n\r\n')) < 0) {
      if (Date.now() > deadline || reader.buf.length > 65536 || reader.ended) return null;
      await reader.wait(Date.now() + sockTimeout);
    }
    const statusLine = reader.buf.subarray(0, headEnd).toString('latin1').split('\r\n')[0];
    reader.buf = reader.buf.subarray(headEnd + 4);
    const parts = statusLine.split(' ');
    if (parts.length < 2 || !/^\d+$/.test(parts[1]) || Number(parts[1]) !== 200) return null;

    const start = performance.now();
    let received = reader.take().length;
    while (received < sizeBytes && Date.now() < deadline) {
      if (shouldStop && shouldStop()) return null;
      if (!reader.buf.length) {
        if (reader.ended) break;
        await reader.wait(Date.now() + sockTimeout);
        continue;
      }
      received += reader.take().length;
    }
    const elapsed = Math.max((performance.now() - start) / 1000, 0.001);
    // Too little data for a meaningful number (e.g. connection throttled to death)
    if (received < Math.min(sizeBytes, 64 * 1024)) return null;
    return Math.round((received / 1024.0 / elapsed) * 10) / 10;
  } catch {
    return null;
  } finally {
    if (sock) sock.destroy();
  }
}
