// V2Ray config parser / rebuilder and per-IP CDN test (port of app/scanner/v2ray.py).
import { performance } from 'node:perf_hooks';
import { connect, SocketReader, readHead, parseHttpResponse } from './rawHttp.js';
import { isCdnResponse, extractColo, HTTPS_PORTS } from './core.js';

const PY_SAFE = /[A-Za-z0-9_.\-~]/;

/** urllib.parse.quote: percent-encode everything but alnum, '_.-~' and `safe`. */
export function pyQuote(s, safe = '/') {
  let out = '';
  for (const b of Buffer.from(String(s), 'utf8')) {
    const ch = String.fromCharCode(b);
    if (b < 128 && (PY_SAFE.test(ch) || safe.includes(ch))) out += ch;
    else out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

function quotePlus(s) {
  return pyQuote(s, ' ').replace(/ /g, '+');
}

/** urllib.parse.unquote (invalid UTF-8 is replaced). */
export function pyUnquote(s) {
  const parts = String(s).split(/(%[0-9a-fA-F]{2})/);
  const bytes = [];
  for (const part of parts) {
    if (/^%[0-9a-fA-F]{2}$/.test(part)) bytes.push(parseInt(part.slice(1), 16));
    else if (part) bytes.push(...Buffer.from(part, 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** urllib.parse.parse_qs(keep_blank_values=True), single values unwrapped. */
function parseQs(str) {
  const grouped = {};
  for (const pair of str.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const name = pyUnquote((eq < 0 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
    const value = pyUnquote((eq < 0 ? '' : pair.slice(eq + 1)).replace(/\+/g, ' '));
    (grouped[name] ||= []).push(value);
  }
  const params = {};
  for (const [k, v] of Object.entries(grouped)) params[k] = v.length === 1 ? v[0] : v;
  return params;
}

/** urllib.parse.urlencode(params, doseq=True). */
function urlencode(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    for (const x of Array.isArray(v) ? v : [v]) parts.push(`${quotePlus(k)}=${quotePlus(String(x))}`);
  }
  return parts.join('&');
}

/** Python int(): integers and digit strings only; throws otherwise. */
function pyInt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return Number(v);
  throw new TypeError(`invalid int: ${v}`);
}

/** json.dumps() with Python's default separators and ensure_ascii=True. */
export function pyJsonDumps(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : JSON.stringify(v);
  if (typeof v === 'string') return pyJsonString(v);
  if (Array.isArray(v)) return '[' + v.map(pyJsonDumps).join(', ') + ']';
  return '{' + Object.entries(v).map(([k, x]) => `${pyJsonString(k)}: ${pyJsonDumps(x)}`).join(', ') + '}';
}

function pyJsonString(s) {
  return JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** '1.2.3.4:443' / '[2606:4700::1]:443' / 'host' -> [host, port]. */
function splitHostPort(hostPort) {
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    const host = end < 0 ? hostPort.slice(1) : hostPort.slice(1, end);
    const rest = end < 0 ? '' : hostPort.slice(end + 1);
    return [host, rest.startsWith(':') ? pyInt(rest.slice(1)) : 443];
  }
  if (hostPort.split(':').length === 2) {
    const i = hostPort.lastIndexOf(':');
    return [hostPort.slice(0, i), pyInt(hostPort.slice(i + 1))];
  }
  return [hostPort, 443];  // bare host (or bare IPv6 without port)
}

const uriHost = (ip) => (ip.includes(':') ? `[${ip}]` : ip);

function parseUriLike(configStr, protocol) {
  let rest = configStr.slice(protocol.length + 3);
  let fragment = '';
  const hash = rest.lastIndexOf('#');
  if (hash >= 0) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }
  let paramsStr = '';
  const q = rest.indexOf('?');
  if (q >= 0) { paramsStr = rest.slice(q + 1); rest = rest.slice(0, q); }
  const at = rest.indexOf('@');
  if (at < 0) return null;
  const [host, port] = splitHostPort(rest.slice(at + 1));
  return { protocol, uuid: rest.slice(0, at), ip: host, port,
           params: paramsStr ? parseQs(paramsStr) : {}, fragment, raw: configStr };
}

function parseVmess(configStr) {
  let encoded = configStr.slice('vmess://'.length);
  const padding = 4 - (encoded.length % 4);
  if (padding !== 4) encoded += '='.repeat(padding);
  const data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return { protocol: 'vmess', uuid: data.id ?? '', ip: data.add ?? '',
           port: pyInt(data.port ?? 443), params: data, fragment: data.ps ?? '', raw: configStr };
}

/**
 * Parse a vless:// / vmess:// / trojan:// link into
 * {protocol, uuid, ip, port, params, fragment, raw}, or null on failure.
 */
export function parseConfig(configStr) {
  configStr = String(configStr || '').trim();
  if (!configStr) return null;
  try {
    if (configStr.startsWith('vless://')) return parseUriLike(configStr, 'vless');
    if (configStr.startsWith('vmess://')) return parseVmess(configStr);
    if (configStr.startsWith('trojan://')) return parseUriLike(configStr, 'trojan');
    return null;
  } catch {
    return null;
  }
}

/** Rebuild the link with a new IP; `suffix` is appended to the config name. */
export function rebuildConfig(parsed, newIp, suffix = '') {
  if (!parsed) return null;
  const { protocol } = parsed;
  let fragment = parsed.fragment || '';
  if (suffix) fragment += pyQuote(suffix);

  if (protocol === 'vless' || protocol === 'trojan') {
    const hasParams = parsed.params && Object.keys(parsed.params).length;
    const paramsStr = hasParams ? urlencode(parsed.params) : '';
    let uri = `${protocol}://${parsed.uuid}@${uriHost(newIp)}:${parsed.port}`;
    if (paramsStr) uri += `?${paramsStr}`;
    if (fragment) uri += `#${fragment}`;
    return uri;
  }
  if (protocol === 'vmess') {
    const data = JSON.parse(JSON.stringify(parsed.params));
    data.add = newIp;
    if (suffix) data.ps = (data.ps || '') + suffix;
    return 'vmess://' + Buffer.from(pyJsonDumps(data), 'utf8').toString('base64');
  }
  return null;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);

/**
 * Connect to `ip` with the config's TLS SNI / HTTP Host, request /cdn-cgi/trace and
 * require a real CDN edge response. Returns {ok, latency (ms) | null, colo}.
 */
export async function testIpWithConfig(parsed, ip, timeout = 5) {
  const fail = { ok: false, latency: null, colo: '' };
  if (!parsed) return fail;
  const port = parsed.port;
  const p = parsed.params || {};
  const sni = String(first(p.sni) || first(p.host) || '');
  const hostHeader = String(first(p.host) || sni || ip);
  // vless/trojan use `security=tls`, vmess JSON uses `tls: "tls"`
  const security = String(first(p.security) || first(p.tls) || '').toLowerCase();
  const useTls = security === 'tls' || (!security && HTTPS_PORTS.has(port));

  const start = performance.now();
  let sock = null;
  try {
    sock = await connect({ host: ip, port, tls: useTls, servername: sni || undefined,
                           rejectUnauthorized: false, timeoutMs: timeout * 1000 });
    const latency = performance.now() - start;
    const reader = new SocketReader(sock);
    sock.write(`GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${hostHeader}\r\n`
               + 'User-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n');
    const { status, headers, body } = parseHttpResponse(await readHead(reader, Date.now() + timeout * 1000));
    if (status === null || !isCdnResponse(headers, body)) return fail;
    return { ok: true, latency, colo: extractColo(headers, body) };
  } catch {
    return fail;
  } finally {
    if (sock) sock.destroy();
  }
}

/** Subscription text for V2Ray clients: base64 of one config per line. */
export function buildSubscription(configs) {
  return Buffer.from((configs || []).join('\n'), 'utf8').toString('base64');
}
