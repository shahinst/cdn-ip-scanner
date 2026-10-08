// Constants shared by the routes, the scan engine and the CLI (port of app/config.py).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_SPEED_TEST_URL = 'https://speed.cloudflare.com/__down?bytes={bytes}';
export const DEFAULT_XRAY_TEST_URL = 'https://www.gstatic.com/generate_204';

export const APP_NAME = 'CDN IP Scanner';
export const AUTHOR = 'shahinst';
export const GITHUB_REPO_URL = 'https://github.com/shahinst/cdn-ip-scanner';
export const RELEASES_URL = 'https://github.com/shahinst/cdn-ip-scanner/releases/latest';
export const VERSION_URL = 'https://raw.githubusercontent.com/shahinst/cdn-ip-scanner/main/version';

export const DEFAULT_PORTS = [443, 80, 8443, 2053, 2083, 2087, 2096];

export const SETTINGS_DEFAULTS = {
  theme: 'light', mode: 'hyper',
  target_count: '100', ping_min: '0', ping_max: '9999',
  scan_ports: '443,80,8443,2053,2083,2087,2096',
  language: 'en', log_enabled: 'false',
  debug_enabled: 'false',
  operator_country: 'ir',
  speed_test: 'false', speed_test_size: '1024', speed_test_count: '10',
  speed_test_url: DEFAULT_SPEED_TEST_URL,
  xray_test: 'false', xray_test_count: '20', xray_test_url: DEFAULT_XRAY_TEST_URL,
  profile: 'custom',
  monitor_interval: '0',
  telegram_token: '', telegram_chat_id: '', telegram_proxy: '',
  notify_scan_complete: 'false',
};

// Request fields stored with a session so an interrupted scan can be resumed.
export const RESUMABLE_FIELDS = [
  'ranges', 'scan_method', 'mode', 'target_count', 'ping_min', 'ping_max', 'ports',
  'operator_key', 'country', 'speed_test', 'speed_test_size', 'speed_test_count',
  'speed_test_url', 'xray_test', 'xray_test_count', 'xray_test_url', 'log_enabled',
  'debug_enabled',
];

export const RESUMABLE_STATUSES = ['interrupted', 'stopped'];

/** Version: the repo root `version` file in a checkout, package.json when installed from npm. */
export function readVersion() {
  for (const p of [path.join(PKG_DIR, '..', 'version'), path.join(PKG_DIR, 'version')]) {
    try {
      const v = fs.readFileSync(p, 'utf8').trim();
      if (v) return v;
    } catch { /* next */ }
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version || '0';
  } catch {
    return '0';
  }
}

export function defaultDataDir() {
  return process.env.CDN_SCANNER_DATA_DIR || path.join(os.homedir(), '.cdn-ip-scanner');
}

/** Parse an int from user input, falling back to `def` and clamping to [lo, hi]. */
export function toInt(value, def, lo = null, hi = null) {
  let n = Number.parseFloat(value);
  n = Number.isFinite(n) ? Math.trunc(n) : def;
  if (lo !== null) n = Math.max(lo, n);
  if (hi !== null) n = Math.min(hi, n);
  return n;
}

export function truthy(value, def = false) {
  if (value === undefined || value === null) return def;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
}

/** Naive UTC timestamp like Python's datetime.utcnow().isoformat() (the UI appends 'Z'). */
export function utcnow() {
  return new Date().toISOString().replace('Z', '');
}

export function round(value, digits = 1) {
  if (value === null || value === undefined) return value;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
