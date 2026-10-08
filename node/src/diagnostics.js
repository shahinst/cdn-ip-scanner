// Redacted diagnostic report for bug reports (port of app/routes/diagnostics.py).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { SETTINGS_DEFAULTS, utcnow } from './config.js';

const SECRET_KEYS = new Set(['telegram_token']);
const LOG_TAIL_LINES = 300;

/** Drop user:password from proxy URLs. */
function redactUrl(value) {
  try { new URL(value); } catch { return '***'; }
  return value.replace(/\/\/[^@/]+@/, '//***@');
}

export function redactedSettings(store) {
  const out = {};
  for (const [key, def] of Object.entries(SETTINGS_DEFAULTS)) {
    let value = store.getSetting(key, def);
    if (SECRET_KEYS.has(key)) value = value ? '***' : '';
    else if (key.endsWith('_proxy') && value) value = redactUrl(value);
    out[key] = value;
  }
  return out;
}

function logFileTail(dataDir) {
  const file = path.join(dataDir, 'scanner.log');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-LOG_TAIL_LINES).map((l) => l.replace(/\r$/, ''));
}

export async function buildReport(ctx) {
  const { store, lib } = ctx;
  let xray = { available: false, version: '' };
  try {
    const st = await lib.xrayStatus(ctx.dataDir);
    xray = { available: !!st?.available, version: st?.available ? (st.version || '') : '' };
  } catch { /* report without it */ }
  return {
    generated_at: utcnow() + 'Z',
    app: { version: ctx.version, frozen: false, auth_enabled: !!ctx.authEnabled,
      web_update: !!ctx.allowWebUpdate, database: 'json' },
    system: { os: `${os.type()} ${os.release()}`, machine: os.arch(), node: process.version,
      cpu_count: os.cpus().length },
    xray,
    settings: redactedSettings(store),
    stats: { sessions: store.countSessions(), results: store.countResults() },
    recent_sessions: store.listSessions(10).map((s) => store.sessionToDict(s)), // no V2Ray config (credentials)
    scan_log: store.listLogs(null, LOG_TAIL_LINES).reverse(),
    app_log_tail: logFileTail(ctx.dataDir),
  };
}

export function diagnosticsRoutes(ctx) {
  const r = express.Router();
  r.get('/diagnostics', async (req, res) => {
    const report = JSON.stringify(await buildReport(ctx), null, 2);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    res.set('Content-Disposition', `attachment; filename=cdn-ip-scanner-report-${stamp}.json`);
    res.type('application/json').send(report);
  });
  return r;
}
