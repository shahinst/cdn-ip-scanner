import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { COLO_NAMES, coloLabel, coloName } from '../src/scanner/colo.js';
import { NetUtils, Scanner, isCdnResponse, extractColo, HTTPS_PORTS, SPEED_MODES } from '../src/scanner/core.js';
import { parseIpv6, parseNetwork } from '../src/scanner/ip.js';
import { parseHttpResponse } from '../src/scanner/rawHttp.js';
import { normalizeIpRanges, BuiltinCDNRanges, fetchRanges } from '../src/scanner/rangeFetcher.js';
import { OPERATORS, fetchOperatorRanges } from '../src/scanner/operators.js';
import { parseConfig, rebuildConfig, testIpWithConfig, buildSubscription, pyJsonDumps } from '../src/scanner/v2ray.js';
import { measureDownload } from '../src/scanner/speedtest.js';
import * as clientExport from '../src/scanner/clientExport.js';
import * as xray from '../src/scanner/xray.js';
import { zipRead } from '../src/scanner/zip.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UUID = '11111111-2222-3333-4444-555555555555';
const servers = [];
after(() => { for (const s of servers) { s.closeAllConnections?.(); s.close(); } });

/** Local fake CDN server (like tests/conftest.py); resolves with its port. */
function startServer(headers, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let body;
      if (req.url.startsWith('/__down')) {
        const m = /bytes=(\d+)/.exec(req.url);
        body = Buffer.alloc(m ? Number(m[1]) : 0, '0');
      } else {
        body = Buffer.from('cf-ray' in headers ? 'fl=1\nh=www.cloudflare.com\ncolo=FRA\n' : 'hello');
      }
      res.writeHead(200, { ...headers, 'Content-Length': body.length });
      res.end(body);
    });
    srv.once('error', reject);
    srv.listen(0, host, () => { servers.push(srv); resolve(srv.address().port); });
  });
}

// ------------------------------------------------------------------ core ---

test('splitTo24Blocks', () => {
  assert.deepEqual(NetUtils.splitTo24Blocks('10.0.0.0/22'), ['10.0.0', '10.0.1', '10.0.2', '10.0.3']);
  assert.deepEqual(NetUtils.splitTo24Blocks('10.0.5.7/30'), ['10.0.5']);
  assert.deepEqual(NetUtils.splitTo24Blocks('garbage'), []);
});

test('generateScanIps represents every range', () => {
  const ips = NetUtils.generateScanIps(['10.0.0.0/16', '192.168.1.0/24'], 5, 40);
  assert.ok(ips.length <= 40);
  assert.ok(ips.some((ip) => ip.startsWith('192.168.1.')));
  assert.ok(ips.some((ip) => ip.startsWith('10.0.')));
  const byMode = NetUtils.generateScanIps(['192.168.1.0/24'], 'turbo');
  assert.equal(byMode.length, SPEED_MODES.turbo.ips_per_24);
  assert.deepEqual(NetUtils.generateScanIps(['1.2.3.4'], 5), ['1.2.3.4']);
});

test('generateScanIps ipv6', () => {
  const net = parseNetwork('2606:4700::/32');
  const ips = NetUtils.generateScanIps(['2606:4700::/32', '10.0.0.0/24'], 5, 60);
  const v6 = ips.filter((ip) => ip.includes(':'));
  assert.ok(v6.length);
  assert.ok(v6.every((ip) => (parseIpv6(ip) >> 96n) === (net.address >> 96n)));
  assert.ok(ips.some((ip) => ip.startsWith('10.0.0.')));
  assert.equal(new Set(ips).size, ips.length);
  assert.equal(NetUtils.ipv6Blocks('2606:4700::/120').length, 1);
  assert.equal(NetUtils.ipv6Blocks('2606:4700::/118', 10).length, 4);
  assert.ok(NetUtils.isIpv6('::1') && !NetUtils.isIpv6('1.2.3.4'));
});

test('isValidRange', () => {
  assert.ok(NetUtils.isValidRange('1.1.1.0/24') && NetUtils.isValidRange('8.8.8.8') && NetUtils.isValidRange('2606:4700::/32'));
  assert.ok(!NetUtils.isValidRange('1.1.1.0/33') && !NetUtils.isValidRange('evil') && !NetUtils.isValidRange('1.01.1.1'));
});

test('calcScore is bounded', () => {
  assert.equal(Scanner.calcScore({ ping: 10, open_ports: [443, 80, 8080, 8443, ...Array(30).keys()] }), 100.0);
  assert.equal(Scanner.calcScore({ ping: null, open_ports: [] }), 0.0);
  assert.equal(Scanner.calcScore({ ping: 10, open_ports: [443], alive: false }), 0.0);
  const base = { ping: 120, open_ports: [443] };
  assert.ok(Scanner.calcScore({ ...base, speed: 6000 }) > Scanner.calcScore(base));
  assert.ok(Scanner.calcScore({ ...base, real_delay: -1 }) < Scanner.calcScore(base));
  assert.ok(Scanner.calcScore({ ...base, real_delay: 300 }) > Scanner.calcScore(base));
});

test('isCdnResponse', () => {
  assert.ok(isCdnResponse({ 'cf-ray': 'abc-FRA' }));
  assert.ok(isCdnResponse({ server: 'cloudflare' }));
  assert.ok(isCdnResponse({ via: '1.1 varnish', 'x-served-by': 'cache-fra1' }));
  assert.ok(isCdnResponse({}, 'fl=1\ncolo=FRA\n'));
  assert.ok(!isCdnResponse({ server: 'nginx' }, '<html>hello</html>'));
});

test('extractColo', () => {
  assert.equal(extractColo({}, 'fl=1\ncolo=ams\n'), 'AMS');
  assert.equal(extractColo({ 'cf-ray': '8abc123-IST' }), 'IST');
  assert.equal(extractColo({ 'x-served-by': 'cache-fra19125-FRA' }), 'FRA');
  assert.equal(extractColo({ 'x-served-by': 'cache-sof1510038' }), 'SOF');
  assert.equal(extractColo({ server: 'nginx' }), '');
});

test('setMode scales workers', () => {
  const s = new Scanner();
  s.setMode('hyper');
  assert.ok(s.maxWorkers >= 150);
  const hyper = s.maxWorkers;
  s.setMode('deep');
  assert.ok(s.maxWorkers >= hyper);
});

test('trace check accepts CDN and rejects other servers', async () => {
  const scanner = new Scanner();
  const cdnPort = await startServer({ 'CF-RAY': '123-FRA', Server: 'cloudflare' });
  const plainPort = await startServer({ Server: 'nginx' });
  assert.ok(!HTTPS_PORTS.has(cdnPort));
  const r = await scanner.sequentialTraceCheck('127.0.0.1', cdnPort, 9999);
  assert.ok(r.ok && r.latency >= 0 && r.colo === 'FRA');
  assert.ok(!(await scanner.sequentialTraceCheck('127.0.0.1', plainPort, 9999)).ok);
});

test('batchScan reports results', async () => {
  const port = await startServer({ 'CF-RAY': '123-FRA' });
  const closed = await startServer({});
  servers.pop().close();  // `closed` port now refuses connections
  const scanner = new Scanner({ maxWorkers: 4 });
  const found = [], progress = [];
  const results = await scanner.batchScan(['127.0.0.1'], [port, closed], {
    onResult: (r) => found.push(r), onProgress: (n) => progress.push(n),
  });
  assert.deepEqual(results.map((r) => r.ip), ['127.0.0.1']);
  assert.ok(found.length && found[0].open_ports.length === 1 && found[0].open_ports[0] === port);
  assert.equal(found[0].colo, 'FRA');
  assert.deepEqual(progress, [1]);
  assert.equal(await scanner.check('127.0.0.1', [closed]), null);
  assert.ok(scanner.failedCache.has('127.0.0.1'));
});

test('batchScan honours shouldStop and stop()', async () => {
  const port = await startServer({ 'CF-RAY': '123-FRA' });
  const scanner = new Scanner({ maxWorkers: 2 });
  assert.deepEqual(await scanner.batchScan(['127.0.0.1'], [port], { shouldStop: () => true }), []);
  scanner.stop();
  assert.deepEqual(await scanner.batchScan(['127.0.0.1'], [port]), []);
  scanner.reset();
  assert.equal((await scanner.batchScan(['127.0.0.1'], [port])).length, 1);
});

test('scan over IPv6', async (t) => {
  let port;
  try { port = await startServer({ 'CF-RAY': '1-AMS' }, '::1'); } catch { return t.skip('IPv6 loopback not available'); }
  const scanner = new Scanner({ maxWorkers: 2 });
  const results = await scanner.batchScan(['::1'], [port]);
  assert.ok(results.length && results[0].ip === '::1' && results[0].colo === 'AMS');
});

// --------------------------------------------------------------- ranges ---

test('normalizeIpRanges', () => {
  assert.deepEqual(normalizeIpRanges(['1.1.1.0/24', '1.1.1.5/24', 'evil<script>', '2606:4700::1/32', null, '8.8.8.8']),
    ['1.1.1.0/24', '2606:4700::/32', '8.8.8.8/32']);
});

test('builtin ranges and sources', async () => {
  const ranges = BuiltinCDNRanges.getRanges();
  assert.equal(new Set(ranges).size, ranges.length);
  assert.ok(ranges.includes('104.16.0.0/13') && ranges.includes('141.101.127.0/24'));
  assert.equal(BuiltinCDNRanges.getCoreRanges().length, 15);
  const r = await fetchRanges('builtin');
  assert.equal(r.source, 'builtin');
  assert.equal(r.ranges.length, ranges.length);
  assert.ok(r.ranges.every((x) => parseNetwork(x)));
  assert.equal((await fetchRanges('fastly_asn')).ranges.length, 6);
  assert.equal((await fetchRanges('sh_asn')).ranges.length, 14);
});

test('operator tables', async () => {
  assert.equal(OPERATORS.ir.irancell.asn, 44244);
  assert.equal(OPERATORS.cn.china_mobile.asn.length, 11);
  assert.equal(OPERATORS.ru.tele2.name, 'Tele2 Russia');
  assert.deepEqual(await fetchOperatorRanges('nope'), { count: 0, prefixes: [], error: 'unknown operator' });
});

// ---------------------------------------------------------------- v2ray ---

const VLESS = 'vless://uuid-1234@1.2.3.4:443?encryption=none&security=tls&sni=example.com&type=ws&host=example.com#My%20Server';

test('vless parse and rebuild', () => {
  const parsed = parseConfig(VLESS);
  assert.equal(parsed.protocol, 'vless');
  assert.ok(parsed.ip === '1.2.3.4' && parsed.port === 443);
  assert.equal(parsed.params.sni, 'example.com');
  const rebuilt = rebuildConfig(parsed, '5.6.7.8');
  const reparsed = parseConfig(rebuilt);
  assert.equal(reparsed.ip, '5.6.7.8');
  assert.deepEqual(reparsed.params, parsed.params);
  assert.equal(reparsed.fragment, parsed.fragment);
  assert.ok(rebuildConfig(parsed, '5.6.7.8', ' | 5.6.7.8').endsWith('#My%20Server%20%7C%205.6.7.8'));
  const ws = parseConfig(`vless://${UUID}@1.1.1.1:80?type=ws&path=%2Fws%3Fed%3D2048&flag#x`);
  assert.equal(ws.params.path, '/ws?ed=2048');
  assert.equal(ws.params.flag, '');
  assert.ok(rebuildConfig(ws, '2.2.2.2').includes('path=%2Fws%3Fed%3D2048&flag='));
});

test('vmess roundtrip', () => {
  const cfg = 'vmess://' + Buffer.from(JSON.stringify({ add: '1.2.3.4', port: '8443', id: 'u', tls: 'tls' })).toString('base64');
  const parsed = parseConfig(cfg);
  assert.equal(parsed.port, 8443);
  assert.equal(parseConfig(rebuildConfig(parsed, '9.9.9.9')).ip, '9.9.9.9');
  assert.equal(pyJsonDumps({ a: [1, 'x'], b: 'é' }), '{"a": [1, "x"], "b": "\\u00e9"}');
});

test('invalid config', () => {
  assert.equal(parseConfig('ss://whatever'), null);
  assert.equal(parseConfig(''), null);
  assert.equal(parseConfig('vless://nouser'), null);
  assert.equal(parseConfig('vless://u@h:abc'), null);
  assert.equal(parseConfig('vmess://!!!'), null);
});

test('parseHttpResponse', () => {
  const r = parseHttpResponse('HTTP/1.1 200 OK\r\nCF-RAY: x\r\nServer: cloudflare\r\n\r\nfl=1');
  assert.ok(r.status === 200 && r.headers['cf-ray'] === 'x' && r.body === 'fl=1');
  assert.equal(parseHttpResponse('garbage').status, null);
});

const plainConfig = (port) => parseConfig(`vless://u@1.2.3.4:${port}?security=none&type=ws&host=example.com`);

test('testIpWithConfig requires a CDN response', async () => {
  const cdnPort = await startServer({ 'CF-RAY': '1-FRA' });
  const plainPort = await startServer({ Server: 'nginx' });
  const r = await testIpWithConfig(plainConfig(cdnPort), '127.0.0.1', 3);
  assert.ok(r.ok && r.latency !== null && r.colo === 'FRA');
  assert.ok(!(await testIpWithConfig(plainConfig(plainPort), '127.0.0.1', 3)).ok);
  assert.ok(!(await testIpWithConfig(plainConfig(1), '127.0.0.1', 2)).ok);
});

test('ipv6 addresses in links', () => {
  const parsed = parseConfig('vless://u@[2606:4700::1]:8443?security=tls#x');
  assert.ok(parsed.ip === '2606:4700::1' && parsed.port === 8443);
  const rebuilt = rebuildConfig(parsed, '2606:4700::6810:1');
  assert.ok(rebuilt.startsWith('vless://u@[2606:4700::6810:1]:8443?'));
  assert.equal(parseConfig(rebuilt).ip, '2606:4700::6810:1');
  const trojan = parseConfig('trojan://pw@[::1]:443#t');
  assert.ok(trojan.ip === '::1' && trojan.port === 443);
});

test('buildSubscription', () => {
  assert.equal(Buffer.from(buildSubscription(['a', 'b']), 'base64').toString(), 'a\nb');
});

// ------------------------------------------------------------ speedtest ---

test('measureDownload', async () => {
  const port = await startServer({ 'CF-RAY': '1-FRA' });
  const speed = await measureDownload('127.0.0.1', { url: `http://speed.example:${port}/__down?bytes={bytes}`, bytes: 256 * 1024, timeout: 10 });
  assert.ok(speed !== null && speed > 0);
});

test('measureDownload rejects tiny or failed responses', async () => {
  const port = await startServer({ 'CF-RAY': '1-FRA' });
  assert.equal(await measureDownload('127.0.0.1', { url: `http://x:${port}/cdn-cgi/trace`, bytes: 256 * 1024 }), null);
  assert.equal(await measureDownload('127.0.0.1', { url: 'http://x:1/__down?bytes={bytes}', bytes: 65536, timeout: 2 }), null);
  assert.equal(await measureDownload('127.0.0.1', { url: 'ftp://x/file' }), null);
});

// --------------------------------------------------------- clientExport ---

const VLESS_WS_TLS = `vless://${UUID}@1.1.1.1:443?encryption=none&security=tls&sni=sni.example.com&fp=chrome`
  + '&alpn=h2,http/1.1&type=ws&host=host.example.com&path=%2Fws#My%20Server';

test('clash vless ws tls', () => {
  const proxy = clientExport.clashProxy(parseConfig(VLESS_WS_TLS), '104.16.1.2');
  assert.equal(proxy.name, 'My Server | 104.16.1.2');
  assert.ok(proxy.type === 'vless' && proxy.server === '104.16.1.2' && proxy.port === 443);
  assert.ok(proxy.uuid === UUID && proxy.tls === true && proxy.servername === 'sni.example.com');
  assert.equal(proxy['client-fingerprint'], 'chrome');
  assert.deepEqual(proxy.alpn, ['h2', 'http/1.1']);
  assert.equal(proxy.network, 'ws');
  assert.deepEqual(proxy['ws-opts'], { path: '/ws', headers: { Host: 'host.example.com' } });
});

test('singbox trojan grpc and httpupgrade', () => {
  const trojan = parseConfig('trojan://pw@1.1.1.1:2053?security=tls&type=grpc&serviceName=svc&sni=a.example.com#t');
  let out = clientExport.singboxOutbound(trojan, '9.9.9.9');
  assert.ok(out.type === 'trojan' && out.password === 'pw' && out.server_port === 2053);
  assert.deepEqual(out.transport, { type: 'grpc', service_name: 'svc' });
  assert.equal(out.tls.server_name, 'a.example.com');
  const hu = parseConfig(`vless://${UUID}@1.1.1.1:80?security=none&type=httpupgrade&host=h.example.com&path=%2Fu#x`);
  out = clientExport.singboxOutbound(hu, '8.8.8.8');
  assert.deepEqual(out.transport, { type: 'httpupgrade', path: '/u', host: 'h.example.com' });
  assert.ok(!('tls' in out));
  assert.equal(clientExport.clashProxy(hu, '8.8.8.8')['ws-opts']['v2ray-http-upgrade'], true);
});

test('full configs group all ips', () => {
  const parsed = parseConfig(VLESS_WS_TLS);
  const clash = JSON.parse(clientExport.toClash(parsed, ['1.0.0.1', { ip: '1.0.0.2' }]));
  assert.deepEqual(clash.proxies.map((p) => p.server), ['1.0.0.1', '1.0.0.2']);
  const auto = clash['proxy-groups'][0];
  assert.ok(auto.type === 'url-test' && auto.proxies.length === 2);
  const sb = JSON.parse(clientExport.toSingbox(parsed, ['1.0.0.1', '1.0.0.2']));
  const tags = sb.outbounds.map((o) => o.tag);
  assert.ok(tags.includes('auto') && tags.includes('proxy') && sb.route.final === 'proxy');
  assert.equal(clientExport.exportConfig(parsed, ['1.0.0.1'], 'clash'), clientExport.toClash(parsed, ['1.0.0.1']));
  assert.throws(() => clientExport.exportConfig(parsed, [], 'other'));
});

test('unsupported transports are rejected', () => {
  for (const link of [`vless://${UUID}@1.1.1.1:443?security=reality&pbk=x&type=tcp#r`,
                      `vless://${UUID}@1.1.1.1:443?security=tls&type=xhttp#x`]) {
    assert.throws(() => clientExport.toClash(parseConfig(link), ['1.1.1.1']));
  }
});

// ----------------------------------------------------------------- xray ---

test('vless ws tls outbound', () => {
  const parsed = parseConfig(`vless://${UUID}@1.1.1.1:443?encryption=none&security=tls&sni=sni.example.com&fp=chrome`
    + '&alpn=h2,http/1.1&type=ws&host=host.example.com&path=%2Fws%3Fed%3D2048#x');
  const out = xray.buildOutbound(parsed, '104.16.1.2', 'o');
  assert.equal(out.settings.vnext[0].address, '104.16.1.2');
  assert.equal(out.settings.vnext[0].users[0].id, UUID);
  const stream = out.streamSettings;
  assert.equal(stream.network, 'ws');
  assert.deepEqual(stream.wsSettings, { path: '/ws?ed=2048', host: 'host.example.com' });
  assert.equal(stream.tlsSettings.serverName, 'sni.example.com');
  assert.deepEqual(stream.tlsSettings.alpn, ['h2', 'http/1.1']);
  assert.equal(stream.tlsSettings.fingerprint, 'chrome');
});

test('vmess grpc and trojan outbounds', () => {
  const vmess = 'vmess://' + Buffer.from(JSON.stringify({ v: '2', add: '1.1.1.1', port: '2053', id: UUID, aid: '0',
    net: 'grpc', path: 'svc', tls: 'tls', sni: 'a.example.com' })).toString('base64');
  let out = xray.buildOutbound(parseConfig(vmess), '9.9.9.9', 'o');
  assert.ok(out.protocol === 'vmess' && out.settings.vnext[0].port === 2053);
  assert.equal(out.streamSettings.grpcSettings.serviceName, 'svc');
  const trojan = parseConfig('trojan://secret@1.1.1.1:443?security=tls&type=ws&path=%2Ft&sni=b.example.com#t');
  out = xray.buildOutbound(trojan, '8.8.8.8', 'o');
  assert.deepEqual(out.settings.servers[0], { address: '8.8.8.8', port: 443, password: 'secret' });
});

test('reality is rejected', () => {
  const parsed = parseConfig(`vless://${UUID}@1.1.1.1:443?security=reality&pbk=x&type=tcp#r`);
  assert.throws(() => xray.buildOutbound(parsed, '1.1.1.1', 'o'));
});

test('buildConfig routes each inbound to its ip', () => {
  const parsed = parseConfig(`vless://${UUID}@1.1.1.1:443?security=none&type=ws#x`);
  const cfg = xray.buildConfig(parsed, [['1.0.0.1', 30001], ['1.0.0.2', 30002]]);
  assert.deepEqual(cfg.inbounds.map((i) => i.port), [30001, 30002]);
  assert.equal(cfg.outbounds[1].settings.vnext[0].address, '1.0.0.2');
  assert.deepEqual(cfg.routing.rules[1], { type: 'field', inboundTag: ['in1'], outboundTag: 'out1' });
  const byBase = xray.buildXrayConfig(parsed, ['1.0.0.1', '1.0.0.2'], 40000);
  assert.deepEqual(byBase.inbounds.map((i) => i.port), [40000, 40001]);
});

test('xrayStatus without a binary', () => {
  const saved = process.env.XRAY_PATH, savedPath = process.env.PATH;
  process.env.XRAY_PATH = '';
  process.env.PATH = '';
  try {
    const st = xray.xrayStatus(fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-xray-')));
    assert.ok(st.available === false && st.path === null && st.version === '');
    assert.equal(xray.XRAY_VERSION, '26.3.27');
  } finally {
    process.env.XRAY_PATH = saved ?? '';
    process.env.PATH = savedPath;
  }
});

/** Build a small zip (one stored + one deflated entry) to exercise the reader. */
function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content, deflate] of entries) {
    const data = deflate ? zlib.deflateRawSync(content) : content;
    const n = Buffer.from(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(deflate ? 8 : 0, 8);
    head.writeUInt32LE(data.length, 18); head.writeUInt32LE(content.length, 22); head.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(deflate ? 8 : 0, 10);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(content.length, 24); cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, n, data); centrals.push(cen, n);
    offset += head.length + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

test('zip reader', () => {
  const big = Buffer.from('xray binary '.repeat(5000));
  const zip = makeZip([['geoip.dat', Buffer.from('geo'), false], ['xray', big, true]]);
  assert.ok(zipRead(zip, 'xray').equals(big));
  assert.equal(zipRead(zip, 'geoip.dat').toString(), 'geo');
  assert.throws(() => zipRead(zip, 'missing'));
  assert.throws(() => zipRead(Buffer.from('nope'), 'x'));
});

test('real test end to end', async (t) => {
  const bin = xray.findXray(process.env.CDN_SCANNER_DATA_DIR || path.join(ROOT, 'data'));
  if (!bin) return t.skip('Xray-core not installed (set XRAY_PATH)');
  const targetPort = await startServer({ 'CF-RAY': '1-FRA' });
  const serverPort = (await xray.freePorts(1))[0];
  const cfg = path.join(os.tmpdir(), `cdn-test-xray-server-${process.pid}.json`);
  fs.writeFileSync(cfg, JSON.stringify({
    log: { loglevel: 'warning' },
    inbounds: [{ listen: '127.0.0.1', port: serverPort, protocol: 'vless',
                 settings: { clients: [{ id: UUID }], decryption: 'none' },
                 streamSettings: { network: 'ws', wsSettings: { path: '/ws' } } }],
    outbounds: [{ protocol: 'freedom' }],
  }));
  const server = spawn(bin, ['run', '-c', cfg], { stdio: 'ignore', windowsHide: true });
  try {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const ok = await new Promise((r) => {
        const s = http.request({ host: '127.0.0.1', port: serverPort, method: 'HEAD', timeout: 200 });
        s.on('response', () => { s.destroy(); r(true); }).on('error', () => r(false)).on('timeout', () => { s.destroy(); r(false); }).end();
      });
      if (ok) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const link = `vless://${UUID}@1.2.3.4:${serverPort}?encryption=none&security=none&type=ws&path=%2Fws#t`;
    const opts = { xrayPath: bin, testUrl: `http://127.0.0.1:${targetPort}/cdn-cgi/trace`, timeout: 5, batchSize: 2 };
    const results = await xray.testThroughXray(parseConfig(link), ['127.0.0.1', '127.0.0.2', '127.0.0.3'], opts);
    assert.ok(results.get('127.0.0.1').ok && results.get('127.0.0.1').real_delay > 0);
    assert.ok(!results.get('127.0.0.2').ok && results.get('127.0.0.2').real_delay === -1);
    assert.ok(!results.get('127.0.0.3').ok);
    const wrongUser = link.replace(UUID, '99999999-2222-3333-4444-555555555555');
    assert.equal((await xray.testThroughXray(parseConfig(wrongUser), ['127.0.0.1'], opts)).get('127.0.0.1').ok, false);
  } finally {
    server.kill();
    fs.unlinkSync(cfg);
  }
});

// ----------------------------------------------------------------- colo ---

test('colo lookup is case-insensitive and safe', () => {
  assert.equal(coloName('fra'), 'Frankfurt, DE');
  assert.equal(coloLabel(' ist '), 'IST (Istanbul, TR)');
  assert.ok(coloLabel('XXX') === 'XXX' && coloLabel(null) === '' && coloName('') === '');
});

test('colo table matches the Android app', (t) => {
  const kt = path.join(ROOT, 'android/app/src/main/java/com/shahinst/cdnscanner/scan/Colo.kt');
  if (!fs.existsSync(kt)) return t.skip('Android sources not present');
  const pairs = Object.fromEntries([...fs.readFileSync(kt, 'utf8').matchAll(/"([A-Z0-9]{3,4})" to "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(pairs, COLO_NAMES);
});
