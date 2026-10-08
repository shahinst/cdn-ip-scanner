// Real connection test through Xray-core (port of app/scanner/xray.py).
// One Xray process tests a batch of IPs: every IP gets its own local SOCKS inbound
// routed to an outbound that uses that IP; a test URL is fetched through each.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { connect, SocketReader, readResponse } from './rawHttp.js';
import { zipRead } from './zip.js';

export const XRAY_VERSION = '26.3.27';
export const DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204';
const RELEASE_URL = (version, asset) => `https://github.com/XTLS/Xray-core/releases/download/v${version}/${asset}`;
const ASSETS = {
  'windows-x64': 'Xray-windows-64.zip',
  'windows-arm64': 'Xray-windows-arm64-v8a.zip',
  'macos-x64': 'Xray-macos-64.zip',
  'macos-arm64': 'Xray-macos-arm64-v8a.zip',
  'linux-x64': 'Xray-linux-64.zip',
  'linux-arm64': 'Xray-linux-arm64-v8a.zip',
};
const EXE = process.platform === 'win32' ? 'xray.exe' : 'xray';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Locating / installing the binary
// ---------------------------------------------------------------------------

export function platformKey() {
  const arch = ['arm64', 'aarch64'].includes(process.arch) ? 'arm64' : 'x64';
  const osname = { win32: 'windows', darwin: 'macos' }[process.platform] || 'linux';
  return [osname, arch];
}

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Path of the Xray binary, or null. Order: $XRAY_PATH, <dataDir>/bin, PATH. */
export function findXray(dataDir = null) {
  const candidates = [];
  if (process.env.XRAY_PATH) candidates.push(process.env.XRAY_PATH);
  if (dataDir) candidates.push(path.join(dataDir, 'bin', EXE));
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, EXE));
  }
  return candidates.find(isExecutable) || null;
}

/** 'Xray 26.3.27' (first two words of `xray version`), or ''. */
export function xrayVersion(binPath) {
  try {
    const out = spawnSync(binPath, ['version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    return (out.stdout || '').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
  } catch {
    return '';
  }
}

export function xrayStatus(dataDir = null) {
  const p = findXray(dataDir);
  return { available: Boolean(p), installed: Boolean(p), path: p, version: p ? xrayVersion(p) : '',
           latest: XRAY_VERSION, platform: platformKey().join('-') };
}

async function fetchOk(url, timeoutSec) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutSec * 1000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r;
}

/**
 * Download the official Xray-core release for this platform into <dataDir>/bin,
 * verifying the SHA-256 published with the release. Returns the binary path.
 */
export async function installXray(dataDir, { version = XRAY_VERSION, key = platformKey(), timeout = 120 } = {}) {
  const asset = ASSETS[key.join('-')];
  if (!asset) throw new Error(`No Xray build for ${key[0]}-${key[1]}`);
  const url = RELEASE_URL(version, asset);
  const data = Buffer.from(await (await fetchOk(url, timeout)).arrayBuffer());
  const digest = await (await fetchOk(url + '.dgst', 30)).text();
  let expected = '';
  for (const line of digest.split(/\r?\n/)) {
    if (line.startsWith('SHA2-256=')) expected = line.slice(line.indexOf('=') + 1).trim().toLowerCase();
  }
  if (!expected || crypto.createHash('sha256').update(data).digest('hex') !== expected) {
    throw new Error('Xray download failed checksum verification');
  }
  const destDir = path.join(dataDir, 'bin');
  fs.mkdirSync(destDir, { recursive: true });
  const exe = key[0] === 'windows' ? 'xray.exe' : 'xray';
  const target = path.join(destDir, exe);
  fs.writeFileSync(target, zipRead(data, exe));
  fs.chmodSync(target, 0o755);
  return target;
}

// ---------------------------------------------------------------------------
// Config generation
// ---------------------------------------------------------------------------

const truthy = (v) => ['1', 'true', 'yes'].includes(String(v).toLowerCase());

/** streamSettings for a parsed vless/vmess/trojan link. */
export function buildStreamSettings(parsed) {
  const p = parsed.params || {};
  const vmess = parsed.protocol === 'vmess';
  let network = (vmess ? p.net : p.type) || 'tcp';
  network = { splithttp: 'xhttp', raw: 'tcp' }[network] || network;
  const security = (vmess ? p.tls : p.security) || 'none';
  if (security === 'reality') throw new Error('REALITY configs are not served through a CDN and cannot be IP-scanned');

  const host = p.host || '';
  const pth = p.path || '/';
  const stream = { network, security: security === 'tls' ? 'tls' : 'none' };
  if (network === 'ws') stream.wsSettings = { path: pth, host };
  else if (network === 'grpc') stream.grpcSettings = { serviceName: p.serviceName || p.path || '', multiMode: p.mode === 'multi' };
  else if (network === 'httpupgrade') stream.httpupgradeSettings = { path: pth, host };
  else if (network === 'xhttp') stream.xhttpSettings = { path: pth, host, mode: p.mode || 'auto' };
  else if (network !== 'tcp') throw new Error(`Unsupported transport: ${network}`);

  if (security === 'tls') {
    const tls = { serverName: p.sni || host || parsed.ip || '', allowInsecure: truthy(p.allowInsecure ?? p.insecure ?? '') };
    if (p.alpn) tls.alpn = String(p.alpn).split(',').filter(Boolean);
    if (p.fp) tls.fingerprint = p.fp;
    stream.tlsSettings = tls;
  }
  return stream;
}

/** Xray outbound that connects to `ip` with everything else taken from the link. */
export function buildOutbound(parsed, ip, tag) {
  const proto = parsed.protocol;
  const p = parsed.params || {};
  const port = Number(parsed.port);
  let settings;
  if (proto === 'vless') {
    const user = { id: parsed.uuid, encryption: p.encryption || 'none' };
    if (p.flow) user.flow = p.flow;
    settings = { vnext: [{ address: ip, port, users: [user] }] };
  } else if (proto === 'vmess') {
    settings = { vnext: [{ address: ip, port, users: [{ id: parsed.uuid, alterId: Number(p.aid || 0), security: p.scy || 'auto' }] }] };
  } else if (proto === 'trojan') {
    settings = { servers: [{ address: ip, port, password: parsed.uuid }] };
  } else {
    throw new Error(`Unsupported protocol: ${proto}`);
  }
  return { tag, protocol: proto, settings, streamSettings: buildStreamSettings(parsed) };
}

/** Full Xray config: one SOCKS inbound per [ip, localPort], each routed to its own outbound. */
export function buildConfig(parsed, ipPorts) {
  const inbounds = [], outbounds = [], rules = [];
  ipPorts.forEach(([ip, port], i) => {
    inbounds.push({ tag: `in${i}`, listen: '127.0.0.1', port, protocol: 'socks', settings: { auth: 'noauth', udp: false } });
    outbounds.push(buildOutbound(parsed, ip, `out${i}`));
    rules.push({ type: 'field', inboundTag: [`in${i}`], outboundTag: `out${i}` });
  });
  return { log: { loglevel: 'warning' }, inbounds, outbounds, routing: { rules } };
}

export function buildXrayConfig(parsed, ips, basePort) {
  return buildConfig(parsed, ips.map((ip, i) => [ip, basePort + i]));
}

// ---------------------------------------------------------------------------
// Testing
// ---------------------------------------------------------------------------

export function freePorts(n) {
  return new Promise((resolve, reject) => {
    const servers = [], ports = [];
    const closeAll = () => servers.forEach((s) => s.close());
    const next = () => {
      if (servers.length === n) { closeAll(); return resolve(ports); }
      const s = net.createServer();
      s.once('error', (e) => { closeAll(); reject(e); });
      s.listen(0, '127.0.0.1', () => { servers.push(s); ports.push(s.address().port); next(); });
    };
    next();
  });
}

async function waitListening(ports, alive, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const pending = new Set(ports);
  while (pending.size && Date.now() < deadline) {
    if (!alive()) return false;
    for (const port of [...pending]) {
      try { (await connect({ host: '127.0.0.1', port, timeoutMs: 200 })).destroy(); pending.delete(port); } catch { /* not yet */ }
    }
    if (pending.size) await sleep(100);
  }
  return pending.size === 0;
}

/** Read exactly n bytes from a paused-mode socket. */
function readN(sock, n, deadline) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(t); sock.off('readable', tryRead); sock.off('end', onEnd); sock.off('error', onEnd); };
    const tryRead = () => { const b = sock.read(n); if (b) { cleanup(); resolve(b); } };
    const onEnd = () => { cleanup(); reject(new Error('socket closed')); };
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, Math.max(1, deadline - Date.now()));
    sock.on('readable', tryRead);
    sock.on('end', onEnd);
    sock.on('error', onEnd);
    tryRead();
  });
}

/** SOCKS5 CONNECT (remote DNS, like socks5h) through the local Xray inbound. */
async function socksConnect(socksPort, host, port, deadline) {
  const sock = await connect({ host: '127.0.0.1', port: socksPort, timeoutMs: deadline - Date.now() });
  try {
    sock.write(Buffer.from([5, 1, 0]));
    const greet = await readN(sock, 2, deadline);
    if (greet[0] !== 5 || greet[1] !== 0) throw new Error('SOCKS handshake failed');
    const h = Buffer.from(host, 'utf8');
    sock.write(Buffer.concat([Buffer.from([5, 1, 0, 3, h.length]), h, Buffer.from([port >> 8, port & 255])]));
    const rep = await readN(sock, 4, deadline);
    if (rep[1] !== 0) throw new Error(`SOCKS connect failed (${rep[1]})`);
    let len = rep[3] === 1 ? 4 : rep[3] === 4 ? 16 : (await readN(sock, 1, deadline))[0];
    await readN(sock, len + 2, deadline);
    return sock;
  } catch (e) {
    sock.destroy();
    throw e;
  }
}

/** Delay in ms of a GET through the local SOCKS port, or null on failure. */
export async function fetchThrough(socksPort, url, timeoutSec) {
  const u = new URL(url);
  const https = u.protocol === 'https:';
  const port = u.port ? Number(u.port) : (https ? 443 : 80);
  const deadline = Date.now() + timeoutSec * 1000;
  const start = performance.now();
  let sock = null;
  try {
    sock = await socksConnect(socksPort, u.hostname, port, deadline);
    if (https) {
      sock = await connect({ socket: sock, tls: true, servername: u.hostname, rejectUnauthorized: true,
                             timeoutMs: deadline - Date.now() });
    }
    const reader = new SocketReader(sock);
    sock.write(`GET ${u.pathname || '/'}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\n`
               + 'User-Agent: Mozilla/5.0\r\nAccept: */*\r\nConnection: close\r\n\r\n');
    const resp = await readResponse(reader, deadline);
    if (!resp || resp.status >= 400) return null;
    return Math.round((performance.now() - start) * 10) / 10;
  } catch {
    return null;
  } finally {
    if (sock) sock.destroy();
  }
}

function waitExit(proc, timeoutMs) {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) return resolve(true);
    const t = setTimeout(() => resolve(false), timeoutMs);
    proc.once('exit', () => { clearTimeout(t); resolve(true); });
  });
}

async function testBatch(bin, parsed, ips, testUrl, timeout, log) {
  const ports = await freePorts(ips.length);
  const config = buildConfig(parsed, ips.map((ip, i) => [ip, ports[i]]));
  const base = path.join(os.tmpdir(), `cdn-scanner-xray-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  const cfgPath = base + '.json', logPath = base + '.log';
  fs.writeFileSync(cfgPath, JSON.stringify(config));
  // Xray's output goes to a file: an unread pipe could fill up and block it.
  const logFd = fs.openSync(logPath, 'w+');
  let alive = true;
  const proc = spawn(bin, ['run', '-c', cfgPath], { stdio: ['ignore', logFd, logFd], windowsHide: true });
  proc.on('error', () => { alive = false; });
  proc.on('exit', () => { alive = false; });
  try {
    if (!(await waitListening(ports, () => alive, 10000))) {
      let err = '';
      try { err = fs.readFileSync(logPath, 'utf8').slice(-500).trim(); } catch { /* ignore */ }
      log('ERROR', 'Xray did not start: ' + err);
      return ips.map((ip) => [ip, null]);
    }
    const delays = await Promise.all(ports.map((port) => fetchThrough(port, testUrl, timeout)));
    return ips.map((ip, i) => [ip, delays[i]]);
  } finally {
    if (alive) proc.kill();
    if (!(await waitExit(proc, 5000))) proc.kill('SIGKILL');
    fs.closeSync(logFd);
    for (const f of [cfgPath, logPath]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
  }
}

/**
 * Real-delay test of every IP through Xray. Returns Map<ip, {ok, real_delay}>
 * (real_delay in ms, -1 when the config does not work through that IP).
 */
export async function testThroughXray(parsed, ips, { dataDir = null, xrayPath = null, timeout = 10.0,
                                                   batchSize = 10, testUrl = DEFAULT_TEST_URL,
                                                   shouldStop = null, onResult = null, log = null } = {}) {
  const bin = xrayPath || findXray(dataDir);
  if (!bin) throw new Error('Xray-core is not installed');
  const logFn = log || (() => {});
  batchSize = Math.max(1, batchSize);
  const results = new Map();
  for (let i = 0; i < ips.length; i += batchSize) {
    if (shouldStop && shouldStop()) break;
    const batch = ips.slice(i, i + batchSize);
    for (const [ip, delay] of await testBatch(bin, parsed, batch, testUrl || DEFAULT_TEST_URL, timeout, logFn)) {
      const r = { ok: delay !== null, real_delay: delay === null ? -1 : delay };
      results.set(ip, r);
      if (onResult) onResult(ip, r);
    }
  }
  return results;
}
