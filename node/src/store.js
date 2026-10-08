// JSON-file persistence with the semantics of the former SQLAlchemy models.
import fs from 'node:fs';
import path from 'node:path';
import { utcnow } from './config.js';

const FLUSH_DELAY_MS = 150;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    this.dirty = new Set();
    this.timer = null;
    this.load();
    // A scan still marked "running" belongs to a previous process: it can be resumed.
    for (const s of this.sessions.items) {
      if (s.status === 'running') { s.status = 'interrupted'; this.mark('sessions'); }
    }
    this.flush();
  }

  file(name) { return path.join(this.dataDir, name); }

  load() {
    this.settings = readJson(this.file('settings.json'), {});
    this.sessions = readJson(this.file('sessions.json'), { nextId: 1, nextResultId: 1, items: [] });
    this.favorites = readJson(this.file('favorites.json'), { nextId: 1, items: [] });
    this.ipChecks = readJson(this.file('ip_checks.json'), { nextId: 1, items: [] });
    this.logs = readJson(this.file('logs.json'), { nextId: 1, items: [] });
    this.operatorRanges = readJson(this.file('operator_ranges.json'), { items: [] });
    this.results = new Map();
    for (const s of this.sessions.items) {
      this.results.set(s.id, readJson(this.file(`results-${s.id}.json`), []));
    }
  }

  mark(name) {
    this.dirty.add(name);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
      this.timer.unref?.();
    }
  }

  /** Write every dirty collection to disk (tmp + rename). */
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const files = { settings: this.settings, sessions: this.sessions, favorites: this.favorites,
      ip_checks: this.ipChecks, logs: this.logs, operator_ranges: this.operatorRanges };
    for (const name of this.dirty) {
      if (name.startsWith('results-')) {
        const id = Number(name.slice(8));
        if (this.results.has(id)) writeAtomic(this.file(`${name}.json`), this.results.get(id));
        else fs.rmSync(this.file(`${name}.json`), { force: true });
      } else {
        writeAtomic(this.file(`${name}.json`), files[name]);
      }
    }
    this.dirty.clear();
  }

  // ---- AppSetting ----
  getSetting(key, def = null) {
    return Object.hasOwn(this.settings, key) ? this.settings[key] : def;
  }

  setSetting(key, value) {
    this.settings[key] = String(value);
    this.mark('settings');
  }

  // ---- ScanSession ----
  createSession(fields) {
    const s = { id: this.sessions.nextId++, mode: null, scan_method: null, v2ray_config: null,
      params: null, total_scanned: 0, total_found: 0, duration: 0, status: 'pending',
      created_at: utcnow(), completed_at: null, ...fields };
    this.sessions.items.push(s);
    this.results.set(s.id, []);
    this.mark('sessions');
    this.mark(`results-${s.id}`);
    return s;
  }

  getSession(id) { return this.sessions.items.find((s) => s.id === id) || null; }

  saveSession(s) { this.mark('sessions'); return s; }

  /** Sessions, newest first. */
  listSessions(limit = 20) {
    return [...this.sessions.items].sort((a, b) => b.id - a.id).slice(0, limit);
  }

  latestSession() { return this.listSessions(1)[0] || null; }

  countSessions() { return this.sessions.items.length; }

  sessionToDict(s) {
    return { id: s.id, mode: s.mode, scan_method: s.scan_method, total_scanned: s.total_scanned,
      total_found: s.total_found, duration: s.duration, status: s.status,
      created_at: s.created_at, completed_at: s.completed_at };
  }

  // ---- ScanResult ----
  addResult(fields) {
    const r = { id: this.sessions.nextResultId++, ip: '', ping: null, open_ports: [], score: 0,
      operator: null, colo: null, speed: null, real_delay: null, alive: null,
      scan_session_id: null, created_at: utcnow(), ...fields };
    if (!this.results.has(r.scan_session_id)) this.results.set(r.scan_session_id, []);
    this.results.get(r.scan_session_id).push(r);
    this.mark('sessions');
    this.mark(`results-${r.scan_session_id}`);
    return r;
  }

  saveResult(r) { this.mark(`results-${r.scan_session_id}`); return r; }

  /** Results of one session (or all), best score first. */
  listResults(sessionId = null, limit = null) {
    let rows = sessionId ? [...(this.results.get(sessionId) || [])]
      : [].concat(...this.results.values());
    rows.sort((a, b) => (b.score || 0) - (a.score || 0) || a.id - b.id);
    if (limit) rows = rows.slice(0, limit);
    return rows;
  }

  sessionResults(sessionId) { return this.results.get(sessionId) || []; }

  countResults() { return [...this.results.values()].reduce((n, l) => n + l.length, 0); }

  resultToDict(r, coloName) {
    return { id: r.id, ip: r.ip, ping: r.ping, open_ports: r.open_ports || [], score: r.score,
      operator: r.operator || '', colo: r.colo || '', speed: r.speed, real_delay: r.real_delay,
      alive: r.alive !== false, colo_name: coloName(r.colo), created_at: r.created_at };
  }

  // ---- ScanLog ----
  addLog(sessionId, level, message) {
    const l = { id: this.logs.nextId++, session_id: sessionId, level, message, created_at: utcnow() };
    this.logs.items.push(l);
    this.mark('logs');
    return l;
  }

  /** Logs newest first. */
  listLogs(sessionId = null, limit = 100) {
    let rows = this.logs.items;
    if (sessionId) rows = rows.filter((l) => l.session_id === sessionId);
    return rows.slice(-limit).reverse();
  }

  resetScans() {
    for (const s of this.sessions.items) this.mark(`results-${s.id}`);
    this.sessions.items = [];
    this.results = new Map();
    this.logs.items = [];
    this.mark('sessions');
    this.mark('logs');
  }

  // ---- OperatorRange ----
  countOperatorRanges(key) {
    return this.operatorRanges.items.filter((r) => r.operator_key === key).length;
  }

  replaceOperatorRanges(key, rows) {
    this.operatorRanges.items = this.operatorRanges.items.filter((r) => r.operator_key !== key).concat(rows);
    this.mark('operator_ranges');
  }

  // ---- FavoriteIP / IPCheck ----
  getFavorite(ip) { return this.favorites.items.find((f) => f.ip === ip) || null; }

  listFavorites() { return [...this.favorites.items].sort((a, b) => a.id - b.id); }

  addFavorite(ip) {
    const f = { id: this.favorites.nextId++, ip, port: 443, label: null, created_at: utcnow(),
      last_checked: null, last_ok: null, last_ping: null, last_colo: null };
    this.favorites.items.push(f);
    this.mark('favorites');
    return f;
  }

  saveFavorite(f) { this.mark('favorites'); return f; }

  deleteFavorite(ip) {
    this.favorites.items = this.favorites.items.filter((f) => f.ip !== ip);
    this.ipChecks.items = this.ipChecks.items.filter((c) => c.ip !== ip);
    this.mark('favorites');
    this.mark('ip_checks');
  }

  favoriteToDict(f, uptime = null, checks = 0) {
    return { id: f.id, ip: f.ip, port: f.port, label: f.label || '', created_at: f.created_at,
      last_checked: f.last_checked, last_ok: f.last_ok, last_ping: f.last_ping,
      last_colo: f.last_colo || '', uptime_24h: uptime, checks_24h: checks };
  }

  addIpCheck(fields) {
    const c = { id: this.ipChecks.nextId++, ip: '', ok: false, ping: null, colo: null,
      checked_at: utcnow(), ...fields };
    this.ipChecks.items.push(c);
    this.mark('ip_checks');
    return c;
  }

  ipChecksSince(ip, sinceIso) {
    return this.ipChecks.items.filter((c) => c.ip === ip && c.checked_at >= sinceIso);
  }

  pruneIpChecks(beforeIso) {
    this.ipChecks.items = this.ipChecks.items.filter((c) => c.checked_at >= beforeIso);
    this.mark('ip_checks');
  }
}
