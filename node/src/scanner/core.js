// CDN IP Scanner - core scanner engine (port of app/scanner/core.py).
// Multi-attempt /cdn-cgi/trace verification: TCP prefilter, then 5 sequential
// trace requests over one reused connection, >= 3 successes + avg latency <= max.
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { connect, SocketReader, readResponse } from './rawHttp.js';
import { formatIpv4, formatIpv6, parseNetwork } from './ip.js';

export const TRACE_PATH = '/cdn-cgi/trace';
export const HTTPS_PORTS = new Set([443, 8443, 2053, 2083, 2087, 2096]);
export const HTTP_PORTS = new Set([80, 8080, 2052, 2082, 2086, 2095]);
export const TRACE_ATTEMPTS = 5;
export const TRACE_MIN_SUCCESS = 3;
export const HOST_HEADER = 'www.cloudflare.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export const SPEED_MODES = {
  hyper: { resource_pct: 0.20, ips_per_24: 30, label: 'Hyper (20%)' },
  turbo: { resource_pct: 0.40, ips_per_24: 50, label: 'Turbo (40%)' },
  ultra: { resource_pct: 0.60, ips_per_24: 80, label: 'Ultra (60%)' },
  deep: { resource_pct: 0.80, ips_per_24: 120, label: 'Deep (80%)' },
};

// IPv6 ranges are sampled through random aligned /120 blocks (the IPv6 "/24").
export const IPV6_BLOCK_PREFIX = 120;
export const IPV6_MAX_BLOCKS = 4096;

const has = (h, k) => Object.prototype.hasOwnProperty.call(h, k);

/** True if an HTTP response really comes from a CDN edge (Cloudflare or Fastly). */
export function isCdnResponse(headers, body = '') {
  headers = headers || {};
  body = body || '';
  if (body.includes('fl=') && body.includes('colo=')) return true;
  const server = String(headers.server || '').toLowerCase();
  const via = String(headers.via || '').toLowerCase();
  if (has(headers, 'cf-ray') || server.includes('cloudflare')) return true;
  if (has(headers, 'x-fastly-request-id') || server.includes('fastly') || via.includes('fastly')
      || via.includes('varnish') || has(headers, 'x-served-by')) return true;
  return false;
}

/** Edge data-center code ('FRA') of a CDN response, or ''. */
export function extractColo(headers, body = '') {
  headers = headers || {};
  for (const line of String(body || '').split(/\r\n|\r|\n/)) {
    if (line.startsWith('colo=')) return line.slice(5).trim().toUpperCase().slice(0, 10);
  }
  const ray = String(headers['cf-ray'] || '');
  if (ray.includes('-')) return ray.slice(ray.lastIndexOf('-') + 1).trim().toUpperCase().slice(0, 10);
  const parts = String(headers['x-served-by'] || '').split(',');
  const servedBy = parts[parts.length - 1].trim();
  if (servedBy.includes('-')) {
    // 'cache-fra19125-FRA' -> 'FRA'; some PoPs omit the suffix: 'cache-sof1510038' -> 'SOF'
    const code = servedBy.slice(servedBy.lastIndexOf('-') + 1).trim().toUpperCase().slice(0, 10);
    return code.replace(/\d+$/, '');
  }
  return '';
}

function sampleInts(lo, hi, count) {
  const pool = [];
  for (let i = lo; i < hi; i++) pool.push(i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomBigInt(n) {
  const bytes = Math.ceil(n.toString(2).length / 8) + 8;
  return BigInt('0x' + crypto.randomBytes(bytes).toString('hex')) % n;
}

/** CIDR splitting and random IP generation with round-robin over all ranges. */
export const NetUtils = {
  isIpv6(ip) {
    return String(ip).includes(':');
  },

  isValidRange(r) {
    return parseNetwork(r) !== null;
  },

  /** IPv4 CIDR -> /24 block prefixes like '104.16.0'. */
  splitTo24Blocks(cidr) {
    const net = parseNetwork(cidr);
    if (!net || net.version !== 4) return [];
    if (net.prefix >= 24) return [formatIpv4(net.address).split('.').slice(0, 3).join('.')];
    const end = (net.address | (0xffffffff >>> net.prefix)) >>> 0;
    const blocks = [];
    for (let cur = net.address; cur <= end; cur += 256) {
      blocks.push(`${(cur >>> 24) & 255}.${(cur >>> 16) & 255}.${(cur >>> 8) & 255}`);
    }
    return blocks;
  },

  /** Up to `count` distinct random /120 blocks (BigInt of the first address) inside an IPv6 CIDR. */
  ipv6Blocks(cidr, count = IPV6_MAX_BLOCKS) {
    const net = parseNetwork(cidr);
    if (!net || net.version !== 6) return [];
    if (net.prefix >= IPV6_BLOCK_PREFIX) return [net.address];
    const nBlocks = 1n << BigInt(IPV6_BLOCK_PREFIX - net.prefix);
    count = Number(nBlocks < BigInt(count) ? nBlocks : BigInt(count));
    let picks;
    if (nBlocks <= BigInt(count * 2)) {
      picks = sampleInts(0, Number(nBlocks), count).map(BigInt);
    } else {
      const set = new Set();
      while (set.size < count) set.add(randomBigInt(nBlocks));
      picks = [...set];
    }
    return picks.map((i) => net.address + (i << BigInt(128 - IPV6_BLOCK_PREFIX)));
  },

  /** Unique random IPs (host 1..254) from a /24 block ('a.b.c') or an IPv6 /120 block (BigInt). */
  randomIpsFromBlock(block, count = 30) {
    count = Math.min(count, 254);
    const numbers = sampleInts(1, 255, count);
    if (typeof block === 'bigint') return numbers.map((n) => formatIpv6(block + BigInt(n)));
    return numbers.map((n) => `${block}.${n}`);
  },

  /**
   * Scan IPs with fair representation of ALL ranges (round-robin block pick).
   * `mode` is a SPEED_MODES key or the number of IPs per block (default 30).
   */
  generateScanIps(ranges, mode = 30, maxTotal = null, shuffleResult = true) {
    const perBlock = typeof mode === 'string'
      ? (SPEED_MODES[mode] || SPEED_MODES.hyper).ips_per_24 : (Number(mode) || 30);
    const singleIps = [];
    const rangeBlockLists = [];
    let v6Count = maxTotal ? Math.floor(maxTotal / Math.max(perBlock, 1)) + 1 : IPV6_MAX_BLOCKS;
    v6Count = Math.min(v6Count, IPV6_MAX_BLOCKS);

    for (let cidr of ranges || []) {
      cidr = String(cidr).trim();
      if (!cidr) continue;
      if (!cidr.includes('/')) { singleIps.push(cidr); continue; }
      let blocks;
      if (cidr.includes(':')) blocks = NetUtils.ipv6Blocks(cidr, v6Count);  // already random
      else blocks = shuffle(NetUtils.splitTo24Blocks(cidr));
      if (blocks.length) rangeBlockLists.push(blocks);
    }
    if (!rangeBlockLists.length && !singleIps.length) return [];

    const selected = [];
    if (rangeBlockLists.length) {
      const maxRounds = Math.max(...rangeBlockLists.map((b) => b.length));
      for (let round = 0; round < maxRounds; round++) {
        for (const blocks of rangeBlockLists) {
          if (round < blocks.length) selected.push(blocks[round]);
        }
        if (maxTotal && selected.length * perBlock >= maxTotal) break;
      }
    }

    let all = [...singleIps];
    for (const block of selected) all.push(...NetUtils.randomIpsFromBlock(block, perBlock));
    if (shuffleResult) shuffle(all);
    if (maxTotal) all = all.slice(0, maxTotal);
    return all;
  },
};

/** Core IP scanner engine (port of SHScanner). */
export class Scanner {
  constructor({ maxWorkers = 800, timeout = 1.8, maxLatencyMs = 9999, logCallback = null } = {}) {
    this.maxWorkers = maxWorkers;
    this.timeout = timeout;
    this.maxLatencyMs = maxLatencyMs;
    this.logCallback = logCallback;
    this.failedCache = new Set();
    this.stopped = false;
  }

  /** Configure worker count from a speed mode's resource percentage. */
  setMode(key) {
    const mode = SPEED_MODES[key] || SPEED_MODES.hyper;
    const cpuCount = os.cpus().length || 4;
    const baseWorkers = Math.max(800, Math.min(2000, cpuCount * 200));
    this.maxWorkers = Math.max(150, Math.floor(baseWorkers * mode.resource_pct));
    this._log('INFO', `Mode set to ${key}: ${Math.floor(mode.resource_pct * 100)}% resources, ${this.maxWorkers} workers`);
  }

  stop() { this.stopped = true; }

  reset() { this.stopped = false; this.failedCache.clear(); }

  _log(level, message) {
    if (!this.logCallback) return;
    try { this.logCallback(level, message); } catch { /* ignore */ }
  }

  /** Quick TCP connect to check if a port is open. */
  async tcpConnect(ip, port, timeoutSec) {
    try {
      (await connect({ host: ip, port, timeoutMs: timeoutSec * 1000 })).destroy();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 5 sequential requests to /cdn-cgi/trace over one reused connection.
   * Returns {ok, latency (avg ms), colo}.
   */
  async sequentialTraceCheck(ip, port, maxLatencyMs) {
    let multiply;
    if (maxLatencyMs <= 300) multiply = 2.0;
    else if (maxLatencyMs <= 500) multiply = 1.8;
    else if (maxLatencyMs <= 1000) multiply = 1.5;
    else if (maxLatencyMs <= 3000) multiply = 1.2;
    else multiply = 1.0;
    const timeoutFactors = [1.5, 1.2, 1.0, 1.0, 1.0];
    const maxTotalSec = Math.max(8.0, Math.min(15.0, maxLatencyMs * 3.0 / 1000.0));
    const useTls = HTTPS_PORTS.has(port);
    const request = `GET ${TRACE_PATH} HTTP/1.1\r\nHost: ${HOST_HEADER}\r\nUser-Agent: ${USER_AGENT}\r\n\r\n`;

    const totalStart = performance.now();
    let successes = 0, aborted = false, colo = '';
    let sock = null, reader = null;
    const closeConn = () => { if (sock) sock.destroy(); sock = null; reader = null; };

    try {
      for (let i = 0; i < TRACE_ATTEMPTS; i++) {
        if (this.stopped || aborted) break;
        if (performance.now() - totalStart > maxTotalSec * 1000) break;
        const timeoutSec = maxLatencyMs > 3000
          ? 3.0 : Math.min(4.0, Math.max(1.5, timeoutFactors[i] * multiply * maxLatencyMs / 1000.0));
        const deadline = Date.now() + timeoutSec * 1000;

        let resp = null;
        try {
          for (let attempt = 0; attempt < 2 && !resp; attempt++) {
            let fresh = false;
            if (!sock || sock.destroyed || reader.ended) {
              closeConn();
              sock = await connect({ host: ip, port, tls: useTls, servername: HOST_HEADER,
                                     rejectUnauthorized: false, timeoutMs: deadline - Date.now() });
              reader = new SocketReader(sock);
              fresh = true;
            }
            sock.write(request);
            resp = await readResponse(reader, deadline);
            if (!resp) {
              // A pooled connection dropped by the server: retry once on a fresh one.
              const stale = !fresh && reader.ended && reader.buf.length === 0;
              closeConn();
              if (!stale) break;
            }
          }
        } catch {
          closeConn();
          aborted = true;  // timeout / connection failure: no point retrying this IP
          continue;
        }
        if (!resp) { aborted = true; continue; }
        if (isCdnResponse(resp.headers)) {
          colo = colo || extractColo(resp.headers, resp.body.slice(0, 4096));
          successes++;
        } else {
          aborted = true;  // not a CDN edge (some random server with the port open)
        }
        if (resp.close) closeConn();
      }
    } finally {
      closeConn();
    }

    const avgLatency = (performance.now() - totalStart) / TRACE_ATTEMPTS;
    const ok = successes >= TRACE_MIN_SUCCESS && avgLatency <= maxLatencyMs;
    return { ok, latency: avgLatency, colo };
  }

  /**
   * Check a single IP: TCP prefilter -> 5-sequential trace verification ->
   * TCP check of the remaining ports. Returns {ip, open_ports, ping, colo} or null.
   */
  async check(ip, ports) {
    if (this.stopped) return null;
    const ipStr = String(ip);
    if (this.failedCache.has(ipStr)) return null;
    ports = (ports || []).map(Number);
    const primaryPort = ports.length ? ports[0] : 443;

    const prefilterTimeout = Math.min(2.5, Math.max(1.5, this.maxLatencyMs / 1000.0 * 0.5));
    if (!(await this.tcpConnect(ipStr, primaryPort, prefilterTimeout))) {
      this.failedCache.add(ipStr);
      return null;
    }

    const result = { ip: ipStr, open_ports: [], ping: null, colo: '' };
    const { ok, latency, colo } = await this.sequentialTraceCheck(ipStr, primaryPort, this.maxLatencyMs);
    if (!ok) {
      this.failedCache.add(ipStr);
      return null;
    }
    result.ping = latency;
    result.colo = colo;
    result.open_ports.push(primaryPort);

    const tcpTimeout = Math.min(3.0, Math.max(1.5, this.maxLatencyMs / 1000.0));
    for (const port of ports.slice(1)) {
      if (this.stopped) break;
      if (await this.tcpConnect(ipStr, port, tcpTimeout)) result.open_ports.push(port);
    }
    this._log('DEBUG', `${ipStr}: open=[${result.open_ports.join(', ')}] ping=${Math.round(latency)}ms`);
    return result;
  }

  /**
   * Scan IPs with bounded concurrency (this.maxWorkers). onResult(result) is called
   * for every hit, onProgress(doneCount, total) after each check. Stops early when
   * shouldStop() is true or stop() was called; in-flight checks are abandoned.
   */
  async batchScan(ips, ports, { onResult = null, onProgress = null, shouldStop = null } = {}) {
    const results = [];
    const n = ips.length;
    let done = 0, idx = 0;
    const stop = () => this.stopped || (shouldStop ? Boolean(shouldStop()) : false);
    this._log('INFO', `Batch scan started: ${n} IPs, ${ports.length} ports, ${this.maxWorkers} workers`);

    await new Promise((resolve) => {
      let finished = false;
      const finish = () => { if (!finished) { finished = true; clearInterval(timer); resolve(); } };
      const timer = setInterval(() => { if (stop()) finish(); }, 200);
      const worker = async () => {
        while (!finished && idx < n && !stop()) {
          const ip = ips[idx++];
          let r = null;
          try { r = await this.check(ip, ports); } catch { r = null; }
          if (finished) return;
          done++;
          if (onProgress) { try { onProgress(done, n); } catch { /* ignore */ } }
          if (r) {
            results.push(r);
            if (onResult) { try { onResult(r); } catch { /* ignore */ } }
          }
        }
      };
      const workers = [];
      for (let i = 0; i < Math.min(Math.max(1, this.maxWorkers), n); i++) workers.push(worker());
      Promise.all(workers).then(finish);
    });

    this._log('INFO', `Batch scan completed: ${results.length}/${n} IPs found`);
    return results;
  }

  /** Score 0..100 from ping, open ports, measured speed and the Xray real test. */
  static calcScore(result) {
    if (result.alive === false) return 0.0;  // a re-test found the IP dead
    let score = 0.0;
    const ping = result.ping;
    if (ping !== null && ping !== undefined) {
      if (ping < 50) score += 35;
      else if (ping < 100) score += 28;
      else if (ping < 200) score += 20;
      else if (ping < 500) score += 10;
      else if (ping < 1000) score += 3;
    }
    const openPorts = result.open_ports || [];
    score += openPorts.length * 3;
    if (openPorts.includes(443)) score += 12;
    if (openPorts.includes(80)) score += 10;
    if (openPorts.includes(8080)) score += 4;
    if (openPorts.includes(8443)) score += 4;
    const speed = result.speed || 0;  // KB/s
    if (speed >= 5000) score += 20;
    else if (speed >= 2000) score += 15;
    else if (speed >= 1000) score += 10;
    else if (speed >= 300) score += 5;
    // Xray real test: null = not tested, < 0 = failed, else delay in ms
    const realDelay = result.real_delay;
    if (realDelay !== null && realDelay !== undefined) {
      if (realDelay < 0) score *= 0.25;
      else score += 15;
    }
    return Math.max(0.0, Math.min(100.0, score));
  }
}
