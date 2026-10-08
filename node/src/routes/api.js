// Settings, ranges, V2Ray tools, Xray, reset, info and update endpoints (port of app/routes/api.py).
import { spawn } from 'node:child_process';
import express from 'express';
import QRCode from 'qrcode';
import { SETTINGS_DEFAULTS, DEFAULT_XRAY_TEST_URL, GITHUB_REPO_URL, RELEASES_URL, VERSION_URL,
  AUTHOR, toInt } from '../config.js';

function body(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }

/** (parsed template config, best IPs first) of a V2Ray scan, or null. */
export function sessionIps(ctx, sessionId, limit) {
  const sess = ctx.store.getSession(sessionId);
  if (!sess || !sess.v2ray_config) return null;
  const parsed = ctx.lib.parseConfig(sess.v2ray_config);
  if (!parsed) return null;
  const rows = ctx.store.listResults(sessionId)
    .filter((r) => r.real_delay === null || r.real_delay === undefined || r.real_delay >= 0)
    .slice(0, limit);
  return { parsed, rows, ips: rows.map((r) => r.ip) };
}

function parseVer(v) {
  return String(v).replace(/-/g, '.').split('.').map((p) => (Number.isInteger(Number(p)) && p !== '' ? Number(p) : 0));
}

function versionGreater(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === undefined) return false;
    if (y === undefined) return true;
    if (x !== y) return x > y;
  }
  return false;
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: process.platform === 'win32', windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out, err: String(e) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}

export function apiRoutes(ctx) {
  const { store, lib, engine } = ctx;
  const r = express.Router();

  // ---- settings ----
  r.get('/settings', (req, res) => {
    const out = {};
    for (const [k, d] of Object.entries(SETTINGS_DEFAULTS)) out[k] = store.getSetting(k, d);
    res.json(out);
  });

  r.post('/settings', (req, res) => {
    const data = body(req);
    for (const [k, v] of Object.entries(data)) {
      if (Object.hasOwn(SETTINGS_DEFAULTS, k)) store.setSetting(k, String(v).slice(0, 2000));
    }
    if ('log_enabled' in data) engine.logEnabled = String(data.log_enabled).toLowerCase() === 'true';
    res.json({ status: 'ok' });
  });

  // ---- ranges ----
  r.post('/ranges/fetch', async (req, res) => {
    const source = body(req).source ?? 'all';
    try {
      const { ranges } = await lib.fetchRanges(source);
      res.json({ ranges, count: ranges.length, source });
    } catch (e) {
      res.json({ ranges: [], count: 0, source,
        error: (e && e.message) || 'Server cannot reach the internet. Check firewall and DNS.' });
    }
  });

  r.get('/ranges/operators', (req, res) => {
    const country = req.query.country || 'ir';
    const operators = lib.OPERATORS[country] || lib.OPERATORS.ir;
    const out = {};
    for (const [key, info] of Object.entries(operators)) {
      out[key] = { name: info.name, name_fa: info.name_fa || info.name, asn: info.asn,
        prefix_count: store.countOperatorRanges(key) };
    }
    res.json(out);
  });

  const storePrefixes = (key, country, info, prefixes) => {
    store.replaceOperatorRanges(key, prefixes.map((p) => ({ operator_key: key, operator_name: info.name || key,
      asn: String(info.asn ?? ''), prefix: p, country })));
  };

  const fetchOperator = async (key, country) => {
    try {
      const out = await lib.fetchOperatorRanges(key, country);
      const prefixes = Array.isArray(out) ? out : (out?.prefixes || []);
      return { count: prefixes.length, prefixes, error: out?.error || null };
    } catch (e) {
      return { count: 0, prefixes: [], error: e?.message || String(e) };
    }
  };

  r.post('/ranges/operators/fetch', async (req, res) => {
    const data = body(req);
    const key = data.operator_key;
    const country = data.country || 'ir';
    if (!key) return res.status(400).json({ error: 'operator_key required' });
    const { count, prefixes, error } = await fetchOperator(key, country);
    if (error) return res.status(500).json({ error, count: 0 });
    const info = (lib.OPERATORS[country] || {})[key] || {};
    storePrefixes(key, country, info, prefixes);
    res.json({ count, operator: key });
  });

  r.post('/ranges/operators/fetch-all', async (req, res) => {
    const country = body(req).country || 'ir';
    const operators = lib.OPERATORS[country] || lib.OPERATORS.ir;
    const results = {};
    for (const key of Object.keys(operators)) {
      const { count, prefixes, error } = await fetchOperator(key, country);
      if (!error && prefixes.length) storePrefixes(key, country, operators[key], prefixes);
      results[key] = { count, error };
    }
    res.json(results);
  });

  // ---- V2Ray config ----
  r.post('/v2ray/parse', (req, res) => {
    const parsed = lib.parseConfig(body(req).config || '');
    if (!parsed) return res.status(400).json({ error: 'Invalid config format' });
    const params = Object.fromEntries(Object.entries(parsed.params || {}).filter(([k]) => k !== 'id'));
    res.json({ protocol: parsed.protocol, uuid: String(parsed.uuid || '').slice(0, 8) + '...', ip: parsed.ip,
      port: parsed.port, params, fragment: parsed.fragment || '' });
  });

  r.post('/v2ray/build-config', (req, res) => {
    const data = body(req);
    const configStr = data.config || '', newIp = data.ip || '';
    if (!configStr || !newIp) return res.status(400).json({ error: 'config and ip required' });
    const parsed = lib.parseConfig(configStr);
    if (!parsed) return res.status(400).json({ error: 'Invalid config format' });
    const built = lib.rebuildConfig(parsed, newIp, '');
    if (!built) return res.status(400).json({ error: 'Could not build config' });
    res.json({ config: built });
  });

  r.get('/v2ray/export/:id(\\d+)', (req, res) => {
    const sessionId = Number(req.params.id);
    const fmt = req.query.format || 'clash';
    if (!['clash', 'singbox'].includes(fmt)) return res.status(400).json({ error: 'format must be clash or singbox' });
    const limit = toInt(req.query.limit, 50, 1, 1000);
    const found = sessionIps(ctx, sessionId, limit);
    if (!found) return res.status(404).json({ error: 'No V2Ray scan with this session id' });
    if (!found.ips.length) return res.status(404).json({ error: 'This scan has no working IPs to export' });
    let text;
    try {
      const testUrl = store.getSetting('xray_test_url', DEFAULT_XRAY_TEST_URL);
      text = fmt === 'clash' ? lib.toClash(found.parsed, found.rows, { testUrl }) : lib.toSingbox(found.parsed, found.rows, { testUrl });
    } catch (e) {
      return res.status(400).json({ error: e?.message || String(e) });
    }
    const filename = fmt === 'clash' ? `clash-${sessionId}.yaml` : `sing-box-${sessionId}.json`;
    res.set('Content-Disposition', `attachment; filename=${filename}`);
    res.type(fmt === 'singbox' ? 'application/json' : 'text/yaml').send(text);
  });

  r.get('/v2ray/subscription/:id(\\d+)', (req, res) => {
    const sessionId = Number(req.params.id);
    const limit = toInt(req.query.limit, 50, 1, 1000);
    const found = sessionIps(ctx, sessionId, limit);
    if (!found) return res.status(404).json({ error: 'No V2Ray scan with this session id' });
    const text = found.ips.map((ip) => lib.rebuildConfig(found.parsed, ip, ` | ${ip}`)).join('\n');
    if (req.query.format === 'plain') return res.type('text/plain; charset=utf-8').send(text);
    res.set('Content-Disposition', `inline; filename=sub-${sessionId}.txt`);
    res.type('text/plain').send(Buffer.from(text, 'utf8').toString('base64'));
  });

  r.post('/v2ray/qr', async (req, res) => {
    const data = body(req);
    const parsed = lib.parseConfig(data.config || '');
    const ip = String(data.ip || '').trim();
    if (!parsed || !ip) return res.status(400).json({ error: 'config and ip required' });
    const built = lib.rebuildConfig(parsed, ip, ` | ${ip}`);
    const svg = await QRCode.toString(built, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, scale: 5,
      color: { dark: '#000', light: '#fff' } });
    res.type('image/svg+xml').send(svg);
  });

  // ---- Xray ----
  r.get('/xray/status', async (req, res) => {
    const st = await lib.xrayStatus(ctx.dataDir);
    res.json({ available: !!st?.available, version: st?.available ? (st.version || '') : '', can_install: true });
  });

  r.post('/xray/install', async (req, res) => {
    if (engine.running()) return res.status(409).json({ error: 'Stop the running scan first.' });
    try {
      await lib.installXray(ctx.dataDir);
    } catch (e) {
      return res.status(502).json({ error: `Xray install failed: ${e?.message || e}` });
    }
    const st = await lib.xrayStatus(ctx.dataDir);
    res.json({ available: true, version: st?.version || '' });
  });

  // ---- reset / info ----
  r.post('/reset', (req, res) => {
    if (engine.running()) return res.status(409).json({ error: 'Stop the running scan first.' });
    store.resetScans();
    res.json({ status: 'ok' });
  });

  r.get('/info', (req, res) => {
    res.json({ version: ctx.version, author: AUTHOR, github: GITHUB_REPO_URL,
      speed_modes: Object.fromEntries(Object.entries(lib.SPEED_MODES).map(([k, v]) => [k, v.label])) });
  });

  // ---- update ----
  r.post('/check-update', async (req, res) => {
    try {
      const resp = await fetch(VERSION_URL, { signal: AbortSignal.timeout(10000) });
      if (resp.status !== 200) return res.json({ error: `Failed to fetch version (HTTP ${resp.status})` });
      const remote = (await resp.text()).trim();
      if (!remote) return res.json({ error: 'Empty version file' });
      res.json({ current_version: ctx.version, remote_version: remote,
        update_available: versionGreater(parseVer(remote), parseVer(ctx.version)),
        can_self_update: !!ctx.allowWebUpdate, download_url: RELEASES_URL });
    } catch (e) {
      res.json({ error: e?.message || String(e) });
    }
  });

  r.post('/do-update', async (req, res) => {
    if (!ctx.allowWebUpdate) {
      return res.status(403).json({ error: 'Web update is disabled on this server (ALLOW_WEB_UPDATE=false).' });
    }
    if (engine.running()) return res.status(409).json({ error: 'Stop the running scan before updating.' });
    const result = await run('npm', ['install', '-g', 'cdn-ip-scanner@latest'], 180000);
    if (result.code !== 0) return res.json({ error: `npm install failed: ${(result.err || result.out).trim()}` });
    setTimeout(() => {
      store.flush();
      const child = spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: 'inherit' });
      child.unref();
      process.exit(0);
    }, 2000).unref();
    res.json({ status: 'ok', message: 'Update complete. Restarting...', git_output: result.out || result.err });
  });

  return r;
}
