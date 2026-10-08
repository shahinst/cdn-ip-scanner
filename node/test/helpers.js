// Test helpers: a fake scanner library (same contract as src/scanner/) and an app runner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';

const COLOS = { FRA: 'Frankfurt, DE', AMS: 'Amsterdam, NL', IST: 'Istanbul, TR', LHR: 'London, GB' };

export const SPEED_MODES = {
  hyper: { resource_pct: 0.2, ips_per_24: 30, label: 'Hyper (20%)' },
  turbo: { resource_pct: 0.4, ips_per_24: 50, label: 'Turbo (40%)' },
  ultra: { resource_pct: 0.6, ips_per_24: 80, label: 'Ultra (60%)' },
  deep: { resource_pct: 0.8, ips_per_24: 120, label: 'Deep (80%)' },
};

/** Deterministic IPs: a bare IP yields itself, a /24 yields .1, .2, ... */
function generateScanIps(ranges, mode, maxTotal) {
  const out = [];
  for (const r of ranges) {
    const [base, bits] = String(r).split('/');
    if (!bits || Number(bits) >= 32) { out.push(base); continue; }
    const prefix = base.split('.').slice(0, 3).join('.');
    for (let i = 1; i < 255 && out.length < maxTotal; i++) out.push(`${prefix}.${i}`);
  }
  return out.slice(0, maxTotal);
}

/**
 * Build a fake library. `state.check(ip, ports)` is what Scanner.check returns
 * (mutable, so tests can swap it mid-run); `state.speed` is the download speed.
 */
export function makeFakeLib(state = {}) {
  state.check ??= async (ip, ports) => ({ ip, open_ports: ports, ping: 20, colo: 'FRA' });
  state.speed ??= 500;
  state.v2rayTest ??= async () => ({ ok: true, latency: 15, colo: 'FRA' });
  state.xray ??= { available: false, version: '' };

  class Scanner {
    constructor({ maxLatencyMs = 9999 } = {}) { this.maxLatencyMs = maxLatencyMs; this.stopped = false; }
    setMode() {}
    async check(ip, ports) { return state.check(ip, ports); }
    async batchScan(ips, ports, { onResult, onProgress, shouldStop } = {}) {
      const start = Date.now();
      for (let i = 0; i < ips.length; i++) {
        if (this.stopped || shouldStop?.()) break;
        const r = await this.check(ips[i], ports);
        if (r && r.ping <= this.maxLatencyMs) onResult?.(r);
        onProgress?.({ done: i + 1, total: ips.length, speed: 0, elapsed: (Date.now() - start) / 1000 });
      }
    }
    stop() { this.stopped = true; }
    static calcScore(r) {
      if (r.alive === false) return 0;
      let score = Math.max(0, 100 - (r.ping || 0)) * 0.6 + Math.min(4, (r.open_ports || []).length) * 5;
      if (r.speed >= 1000) score += 10;
      if (r.real_delay !== null && r.real_delay !== undefined) score = r.real_delay < 0 ? score * 0.25 : score + 15;
      return Math.max(0, Math.min(100, score));
    }
  }

  const parseConfig = (config) => {
    const m = /^(vless|vmess|trojan):\/\/([^@]+)@([^:/?#]+):(\d+)\??([^#]*)#?(.*)$/.exec(String(config || '').trim());
    if (!m) return null;
    const params = Object.fromEntries(new URLSearchParams(m[5]));
    return { protocol: m[1], uuid: m[2], ip: m[3], port: Number(m[4]), params, fragment: decodeURIComponent(m[6] || ''),
      raw: config };
  };
  const rebuildConfig = (p, ip, suffix = '') => {
    const q = new URLSearchParams(p.params).toString();
    return `${p.protocol}://${p.uuid}@${ip}:${p.port}${q ? '?' + q : ''}#${encodeURIComponent(p.fragment + suffix)}`;
  };

  return {
    COLO_NAMES: COLOS,
    coloName: (c) => COLOS[String(c || '').toUpperCase()] || '',
    coloLabel: (c) => (c ? (COLOS[c.toUpperCase()] ? `${c} (${COLOS[c.toUpperCase()]})` : c) : ''),
    SPEED_MODES,
    HTTPS_PORTS: [443, 8443, 2053, 2083, 2087, 2096],
    NetUtils: { generateScanIps, isIpv6: (ip) => ip.includes(':'), isValidRange: () => true },
    Scanner,
    parseConfig,
    rebuildConfig,
    testIpWithConfig: (parsed, ip, timeout) => state.v2rayTest(parsed, ip, timeout),
    buildSubscription: (configs) => Buffer.from(configs.join('\n')).toString('base64'),
    DEFAULT_SPEED_TEST_URL: 'https://speed.cloudflare.com/__down?bytes={bytes}',
    measureDownload: async () => state.speed,
    toClash: (parsed, results) => `proxies:\n${results.map((r) => `  - name: ${r.ip}\n    server: ${r.ip}\n`).join('')}`,
    toSingbox: (parsed, results) => JSON.stringify({ outbounds: results.map((r) => ({ server: r.ip })) }),
    fetchRanges: async (source) => ({ ranges: ['198.51.100.0/24'], source }),
    OPERATORS: { ir: { mci: { name: 'MCI', name_fa: 'همراه اول', asn: 'AS197207' } }, cn: {}, ru: {} },
    fetchOperatorRanges: async () => ['203.0.113.0/24'],
    fetchAllOperators: async () => ({ mci: ['203.0.113.0/24'] }),
    XRAY_VERSION: '26.3.27',
    xrayStatus: async () => state.xray,
    installXray: async () => { throw new Error('offline'); },
    testThroughXray: async (parsed, ips) => new Map(ips.map((ip) => [ip, { ok: true, real_delay: 120 }])),
    state,
  };
}

export function tmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-ip-scanner-test-'));
}

/** Start the app on a random port. Returns an API helper bound to it. */
export async function startApp(options = {}) {
  const state = options.state || {};
  const lib = options.lib || makeFakeLib(state);
  const dataDir = options.dataDir || tmpDataDir();
  const sent = [];
  const telegramRequest = options.telegramRequest || (async (url, body, proxy) => { sent.push({ url, body, proxy }); return { ok: true }; });
  const built = await createApp({ dataDir, lib, telegramRequest, corsOrigins: [], ...options });
  const { server, io, engine, store } = built;
  const events = [];
  const origEmit = io.emit.bind(io);
  io.emit = (event, payload) => { events.push({ event, payload }); return origEmit(event, payload); };
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const api = async (method, p, body, headers = {}) => {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(base + p, init);
    const buf = Buffer.from(await res.arrayBuffer());
    let json = null;
    try { json = JSON.parse(buf.toString('utf8')); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, buffer: buf, text: buf.toString('utf8'), json };
  };

  const waitScan = async () => { await engine.waitScan(); await engine.waitRetest(); };
  const close = async () => {
    await built.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { base, api, events, sent, engine, store, lib, state, dataDir, waitScan, close, ctx: built.ctx };
}
