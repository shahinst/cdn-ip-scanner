// Export scan results as Clash (Mihomo) or sing-box configs (port of app/scanner/client_export.py).
// Every found IP becomes one proxy built from the user's own V2Ray link (only the
// address changes), plus an automatic "fastest" group.
import { pyUnquote } from './v2ray.js';

export const SUPPORTED = ['clash', 'singbox'];
const DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204';

/** Transport/TLS settings of a parsed vless/vmess/trojan link, normalized. */
function linkFields(parsed) {
  const p = parsed.params || {};
  const vmess = parsed.protocol === 'vmess';
  let network = (vmess ? p.net : p.type) || 'tcp';
  network = { raw: 'tcp', splithttp: 'xhttp' }[network] || network;
  const security = (vmess ? p.tls : p.security) || 'none';
  if (security === 'reality') throw new Error('REALITY configs are not served through a CDN');
  if (!['tcp', 'ws', 'grpc', 'httpupgrade'].includes(network)) {
    throw new Error(`Transport "${network}" is not supported by this export`);
  }
  const host = p.host || '';
  return {
    network,
    tls: security === 'tls',
    host,
    path: p.path || '/',
    service_name: p.serviceName || p.path || '',
    sni: p.sni || host,
    alpn: String(p.alpn || '').split(',').filter(Boolean),
    fp: p.fp || '',
    insecure: ['1', 'true'].includes(String(p.allowInsecure ?? p.insecure ?? '').toLowerCase()),
    flow: p.flow || '',
    aid: vmess ? Number(p.aid || 0) : 0,
    cipher: p.scy || 'auto',
  };
}

function name(parsed, ip) {
  let base = parsed.fragment || parsed.protocol;
  try { base = pyUnquote(base); } catch { /* keep raw */ }
  return `${base} | ${ip}`;
}

const ipOf = (r) => (typeof r === 'string' ? r : r.ip);

// ----------------------------------------------------------------- Clash ---

export function clashProxy(parsed, ip) {
  const f = linkFields(parsed);
  const proto = parsed.protocol;
  const proxy = { name: name(parsed, ip), type: proto, server: ip, port: Number(parsed.port), udp: true };
  if (proto === 'vless') {
    proxy.uuid = parsed.uuid;
    if (f.flow) proxy.flow = f.flow;
  } else if (proto === 'vmess') {
    Object.assign(proxy, { uuid: parsed.uuid, alterId: f.aid, cipher: f.cipher });
  } else {  // trojan
    proxy.password = parsed.uuid;
  }

  if (f.tls) {
    proxy.tls = true;
    proxy[proto === 'trojan' ? 'sni' : 'servername'] = f.sni;
    proxy['skip-cert-verify'] = f.insecure;
    if (f.alpn.length) proxy.alpn = f.alpn;
    if (f.fp) proxy['client-fingerprint'] = f.fp;
  }

  if (f.network === 'ws' || f.network === 'httpupgrade') {
    proxy.network = 'ws';
    const opts = { path: f.path };
    if (f.host) opts.headers = { Host: f.host };
    if (f.network === 'httpupgrade') opts['v2ray-http-upgrade'] = true;
    proxy['ws-opts'] = opts;
  } else if (f.network === 'grpc') {
    proxy.network = 'grpc';
    proxy['grpc-opts'] = { 'grpc-service-name': f.service_name };
  }
  return proxy;
}

export function clashConfig(parsed, ips, testUrl = DEFAULT_TEST_URL) {
  const proxies = ips.map((ip) => clashProxy(parsed, ip));
  const names = proxies.map((p) => p.name);
  const config = {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    proxies,
    'proxy-groups': [
      { name: 'Auto (fastest IP)', type: 'url-test', proxies: names, url: testUrl, interval: 300, tolerance: 50 },
      { name: 'PROXY', type: 'select', proxies: ['Auto (fastest IP)', ...names] },
    ],
    rules: ['MATCH,PROXY'],
  };
  // JSON is valid YAML, so Clash / Mihomo clients load this file as-is.
  return JSON.stringify(config, null, 2);
}

// -------------------------------------------------------------- sing-box ---

export function singboxOutbound(parsed, ip) {
  const f = linkFields(parsed);
  const proto = parsed.protocol;
  const out = { type: proto, tag: name(parsed, ip), server: ip, server_port: Number(parsed.port) };
  if (proto === 'vless') {
    out.uuid = parsed.uuid;
    if (f.flow) out.flow = f.flow;
  } else if (proto === 'vmess') {
    Object.assign(out, { uuid: parsed.uuid, alter_id: f.aid, security: f.cipher });
  } else {
    out.password = parsed.uuid;
  }

  if (f.tls) {
    const tls = { enabled: true, server_name: f.sni, insecure: f.insecure };
    if (f.alpn.length) tls.alpn = f.alpn;
    if (f.fp) tls.utls = { enabled: true, fingerprint: f.fp };
    out.tls = tls;
  }

  if (f.network === 'ws') {
    const transport = { type: 'ws', path: f.path };
    if (f.host) transport.headers = { Host: f.host };
    out.transport = transport;
  } else if (f.network === 'httpupgrade') {
    out.transport = { type: 'httpupgrade', path: f.path, host: f.host };
  } else if (f.network === 'grpc') {
    out.transport = { type: 'grpc', service_name: f.service_name };
  }
  return out;
}

export function singboxConfig(parsed, ips, testUrl = DEFAULT_TEST_URL) {
  const outbounds = ips.map((ip) => singboxOutbound(parsed, ip));
  const tags = outbounds.map((o) => o.tag);
  const config = {
    log: { level: 'warn' },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }],
    outbounds: [
      { type: 'selector', tag: 'proxy', outbounds: ['auto', ...tags], default: 'auto' },
      { type: 'urltest', tag: 'auto', outbounds: tags, url: testUrl, interval: '5m' },
      ...outbounds,
      { type: 'direct', tag: 'direct' },
    ],
    route: { final: 'proxy' },
  };
  return JSON.stringify(config, null, 2);
}

/** `results` may be IP strings or result objects with an `ip` field. */
export function toClash(parsed, results, testUrl = DEFAULT_TEST_URL) {
  return clashConfig(parsed, (results || []).map(ipOf), testUrl);
}

export function toSingbox(parsed, results, testUrl = DEFAULT_TEST_URL) {
  return singboxConfig(parsed, (results || []).map(ipOf), testUrl);
}

export function exportConfig(parsed, results, fmt, testUrl = DEFAULT_TEST_URL) {
  if (fmt === 'clash') return toClash(parsed, results, testUrl);
  if (fmt === 'singbox') return toSingbox(parsed, results, testUrl);
  throw new Error(`Unknown format: ${fmt}`);
}
