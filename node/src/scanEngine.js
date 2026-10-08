// Scan orchestration: start / resume / stop / re-test, Xray and speed phases, Socket.IO events
// (port of the scan part of app/routes/api.py).
import { DEFAULT_PORTS, DEFAULT_SPEED_TEST_URL, DEFAULT_XRAY_TEST_URL, RESUMABLE_FIELDS,
  RESUMABLE_STATUSES, toInt, truthy, utcnow, round } from './config.js';
import { runPool } from './pool.js';

const MAX_TOTAL_SCANNED = 500000; // safety: stop after 500k IPs tried

export class ScanEngine {
  constructor(ctx) {
    this.ctx = ctx; // {store, io, lib, sendTelegram, dataDir}
    this.logEnabled = false;
    this.debugEnabled = false;
    this.activeSessionId = null;
    this.userStopRequested = false;
    this.scanPromise = null;
    this.retestPromise = null;
    this.scanner = null;
  }

  get store() { return this.ctx.store; }
  get lib() { return this.ctx.lib; }

  emit(event, payload) {
    try { this.ctx.io.emit(event, payload); } catch { /* no clients */ }
  }

  /** Emit a log line to the UI and (INFO and above, when enabled) store it. */
  emitLog(level, message, sessionId = null) {
    if (level === 'DEBUG' && !this.debugEnabled) return;
    this.emit('scan_log', { level, message, timestamp: utcnow() });
    if (this.logEnabled && sessionId && level !== 'DEBUG') this.store.addLog(sessionId, level, message);
  }

  running() { return this.scanPromise !== null; }
  retestRunning() { return this.retestPromise !== null; }

  /** Wait for the background scan (tests). */
  async waitScan() { if (this.scanPromise) await this.scanPromise; }
  async waitRetest() { if (this.retestPromise) await this.retestPromise; }

  // ---------- start / resume ----------

  start(data) {
    if (this.running()) {
      return { status: 409, body: { error: 'A scan is already running. Stop it first.', session_id: this.activeSessionId } };
    }
    return this.startLocked(data || {}, null);
  }

  resumableSession() {
    const sess = this.store.listSessions(Infinity)
      .find((s) => RESUMABLE_STATUSES.includes(s.status) && s.params !== null && s.params !== undefined);
    if (!sess) return null;
    const latest = this.store.latestSession();
    return latest && latest.id === sess.id ? sess : null;
  }

  resumableInfo() {
    const sess = this.resumableSession();
    if (!sess) return { resumable: false };
    const params = JSON.parse(sess.params || '{}');
    return { resumable: true, session_id: sess.id, status: sess.status,
      found: this.store.sessionResults(sess.id).length,
      target_count: params.target_count ?? 100, scan_method: sess.scan_method, created_at: sess.created_at };
  }

  resume(sessionId) {
    if (this.running()) return { status: 409, body: { error: 'A scan is already running. Stop it first.' } };
    const sess = this.resumableSession();
    if (!sess || sess.id !== sessionId) return { status: 404, body: { error: 'This scan cannot be resumed' } };
    const data = JSON.parse(sess.params || '{}');
    data.v2ray_config = sess.v2ray_config || '';
    return this.startLocked(data, sess);
  }

  discardResume() {
    const sess = this.resumableSession();
    if (sess) { sess.status = 'completed'; this.store.saveSession(sess); }
  }

  stop() {
    this.userStopRequested = true;
    this.scanner?.stop();
    if (this.activeSessionId) {
      const session = this.store.getSession(this.activeSessionId);
      if (session && session.status === 'running') {
        session.status = 'stopped';
        session.completed_at = utcnow();
        this.store.saveSession(session);
      }
    }
  }

  startLocked(data, resumeSess) {
    let rangesInput = data.ranges ?? [];
    const scanMethod = data.scan_method ?? 'cloud';
    const mode = data.mode ?? 'hyper';
    let targetCount = data.target_count ?? 100;
    let pingMin = toInt(data.ping_min, 0, 0, 60000);
    let pingMax = toInt(data.ping_max, 9999, 1, 60000);
    if (pingMin > pingMax) [pingMin, pingMax] = [pingMax, pingMin];
    const portsStr = String(data.ports || '');
    if (!Array.isArray(rangesInput)) rangesInput = String(rangesInput).split(/\s+/).filter(Boolean);
    let operatorKey = String(data.operator_key || '').trim() || null;
    if (operatorKey) operatorKey = operatorKey.toLowerCase();
    const country = String(data.country || 'ir').trim().toLowerCase() || 'ir';
    const v2rayConfig = data.v2ray_config || '';
    const speedOpts = {
      enabled: truthy(data.speed_test),
      sizeKb: toInt(data.speed_test_size, 1024, 64, 51200),
      count: toInt(data.speed_test_count, 10, 1, 200),
      url: String(data.speed_test_url || DEFAULT_SPEED_TEST_URL).trim(),
    };
    const xrayOpts = {
      enabled: scanMethod === 'v2ray' && truthy(data.xray_test),
      count: toInt(data.xray_test_count, 20, 1, 500),
      url: String(data.xray_test_url || DEFAULT_XRAY_TEST_URL).trim(),
    };
    this.logEnabled = truthy(data.log_enabled, true);
    this.debugEnabled = truthy(data.debug_enabled, false);

    let ports = portsStr.split(',').map((p) => p.trim()).filter((p) => /^\d+$/.test(p))
      .map(Number).filter((p) => p > 0 && p < 65536);
    if (!ports.length) ports = [...DEFAULT_PORTS];

    targetCount = targetCount === 'All' ? null : toInt(targetCount, 100, 1, 100000);

    let session;
    let prior = [];
    if (!resumeSess) {
      const params = {};
      for (const k of RESUMABLE_FIELDS) if (k in data) params[k] = data[k];
      session = this.store.createSession({ mode, scan_method: scanMethod, status: 'running',
        v2ray_config: scanMethod === 'v2ray' ? v2rayConfig : null, params: JSON.stringify(params) });
    } else {
      session = resumeSess;
      session.status = 'running';
      session.completed_at = null;
      this.store.saveSession(session);
      prior = this.store.sessionResults(session.id);
    }
    const sessId = session.id;
    this.activeSessionId = sessId;
    const priorIps = new Set(prior.map((r) => r.ip));
    const priorScanned = session.total_scanned || 0;

    const opts = { sessId, resume: !!resumeSess, rangesInput, scanMethod, mode, targetCount, pingMin, pingMax,
      ports, operatorKey, country, v2rayConfig, speedOpts, xrayOpts, priorIps, priorScanned };
    this.scanPromise = this.runScan(opts).finally(() => { this.scanPromise = null; });
    return { status: 200, body: { session_id: sessId, status: 'started' } };
  }

  // ---------- the scan itself ----------

  async runScan(o) {
    const { sessId, scanMethod, mode, targetCount, pingMin, pingMax, ports } = o;
    const { store, lib } = this;
    const log = (level, msg) => this.emitLog(level, msg, sessId);
    try {
      const startTime = Date.now();
      const sess = store.getSession(sessId);
      if (!sess) return;

      const timeoutSec = Math.min(10, Math.max(2, pingMax / 1000 * 1.5));
      this.scanner = new lib.Scanner({ timeout: timeoutSec * 1000, maxLatencyMs: pingMax, logCallback: log });
      this.scanner.setMode(mode);

      if (!o.resume) log('INFO', `Scan started: method=${scanMethod}, mode=${mode}`);
      else log('INFO', `Resuming scan #${sessId}: ${o.priorIps.size} IPs already found`);

      const modeCfg = lib.SPEED_MODES[mode] || lib.SPEED_MODES.hyper;
      let v2rayParsed = null;
      let v2rayWorkers = 20;
      if (scanMethod === 'v2ray' && o.v2rayConfig) {
        v2rayParsed = lib.parseConfig(o.v2rayConfig);
        if (!v2rayParsed) {
          log('ERROR', 'Invalid V2Ray config');
          sess.status = 'completed';
          store.saveSession(sess);
          this.emit('scan_complete', { session_id: sessId, total_found: 0 });
          return;
        }
        v2rayWorkers = Math.max(20, Math.trunc(50 * modeCfg.resource_pct));
        log('INFO', `V2Ray config parsed: ${v2rayParsed.protocol}`);
      }

      let scanRanges = o.rangesInput.length ? [...o.rangesInput] : [];
      if (scanMethod === 'operators') {
        if (!scanRanges.length) {
          log('INFO', 'Operator mode: fetching CDN IP ranges...');
          try {
            scanRanges = (await lib.fetchRanges('all')).ranges;
            log('INFO', `Fetched ${scanRanges.length} CDN ranges (official)`);
          } catch (e) {
            log('ERROR', `Failed to fetch CDN ranges: ${e.message || e}`);
          }
        } else {
          log('INFO', `Operator mode: using ${scanRanges.length} CDN ranges (ping+port check)`);
        }
        if (!scanRanges.length) log('WARN', 'No CDN ranges. Paste CDN ranges or click Fetch Ranges.');
      }

      const batchSize = targetCount ? Math.max(targetCount * 100, 5000) : 100000;
      let totalScanned = o.priorScanned;
      let found = o.priorIps.size;
      const foundResults = []; // new results only: speed/xray phases + Telegram summary
      const foundIps = new Set(o.priorIps);

      const onProgress = (a, b, c = 0, d = 0) => {
        const p = (a && typeof a === 'object') ? a : { done: a, total: b, speed: c, elapsed: d };
        const done = p.done || 0, totalIps = p.total || 0;
        const pct = targetCount ? Math.min(100, (found / targetCount) * 100) : (totalIps > 0 ? done / totalIps * 100 : 0);
        this.emit('scan_progress', { done: totalScanned + done, total: totalScanned + totalIps,
          percent: round(pct, 1), speed: round(p.speed || 0, 1), elapsed: round(p.elapsed || 0, 1), session_id: sessId });
      };

      let sessionOperatorName = '';
      if (scanMethod === 'operators' || scanMethod === 'v2ray') {
        if (o.operatorKey) {
          const operators = lib.OPERATORS[o.country] || lib.OPERATORS.ir || {};
          if (operators[o.operatorKey]) {
            sessionOperatorName = operators[o.operatorKey].name || o.operatorKey;
            log('INFO', `Operator: ${sessionOperatorName} — results are labeled with this operator`);
          }
        }
        if (!sessionOperatorName) log('INFO', 'Select an operator from the list (operator column will be empty otherwise).');
        log('WARN', "Note: IPs are tested from THIS server's network. Results reflect the selected "
          + 'operator only if the server itself is connected through that operator.');
      }

      if (!scanRanges.length) {
        log('WARN', 'No CDN ranges. Paste CDN ranges or click Fetch Ranges.');
        sess.status = 'completed';
        sess.duration = 0;
        store.saveSession(sess);
        this.emit('scan_complete', { session_id: sessId, total_found: 0, duration: 0 });
        return;
      }

      log('INFO', `Target: ${targetCount || 'unlimited'} — scan will run until target reached or max IPs tried`);

      const onResult = (result) => {
        if (targetCount && found >= targetCount) { this.scanner.stop(); return; }
        const ping = result.ping;
        if (ping !== null && ping !== undefined && (ping < pingMin || ping > pingMax)) return;
        if (foundIps.has(result.ip)) return;
        foundIps.add(result.ip);
        let operatorName = result.operator || '';
        if (scanMethod === 'operators' || scanMethod === 'v2ray') operatorName = operatorName || sessionOperatorName || '';
        operatorName = operatorName.trim();
        const score = lib.Scanner.calcScore(result);
        store.addResult({ ip: result.ip, ping: result.ping ?? null, open_ports: result.open_ports || [],
          score, operator: operatorName, colo: result.colo || null, scan_session_id: sessId });
        found += 1;
        foundResults.push({ ...result, score });
        this.emit('scan_result', { ip: result.ip, ping: result.ping ? round(result.ping, 1) : null,
          open_ports: result.open_ports || [], score: round(score, 1), operator: operatorName,
          colo: result.colo || '', colo_name: lib.coloName(result.colo), session_id: sessId,
          is_v2ray: scanMethod === 'v2ray' });
        log('INFO', `Found: ${result.ip} ping=${round(result.ping || 0, 1)}ms ports=[${(result.open_ports || []).join(', ')}] op=${operatorName}`);
      };

      let batchNum = 0;
      const triedIps = new Set();
      this.userStopRequested = false;
      while (true) {
        if (this.userStopRequested) { log('INFO', 'Scan stopped by user.'); break; }
        if (targetCount && found >= targetCount) break;
        if (totalScanned >= MAX_TOTAL_SCANNED) { log('INFO', `Reached max IPs to try (${MAX_TOTAL_SCANNED}). Stopping.`); break; }

        batchNum += 1;
        let allIps = lib.NetUtils.generateScanIps(scanRanges, mode, batchSize).map(String)
          .filter((ip) => !triedIps.has(ip));
        if (!allIps.length) { log('INFO', 'All IPs in the given ranges have been tried.'); break; }
        for (const ip of allIps) triedIps.add(ip);

        log('INFO', `Batch ${batchNum}: scanning ${allIps.length} IPs (target ${targetCount || '—'}, found ${found} so far)`);
        this.emit('scan_status', { status: 'scanning', total: totalScanned + allIps.length, session_id: sessId });

        const shouldStop = () => this.userStopRequested || (targetCount !== null && found >= targetCount);
        if (scanMethod === 'v2ray' && v2rayParsed) {
          const timeoutMs = Math.min(8, Math.max(1.5, pingMax / 1000 * 1.5)) * 1000;
          await this.v2rayScan(v2rayParsed, allIps, v2rayWorkers, timeoutMs, { onResult, onProgress, shouldStop });
        } else {
          await this.scanner.batchScan(allIps, ports, { onResult, onProgress, shouldStop });
        }

        totalScanned += allIps.length;
        if (targetCount && found >= targetCount) { log('INFO', `Target reached: ${found} IPs found.`); break; }
        if (!targetCount) break;
        if (this.userStopRequested) { log('INFO', 'Scan stopped by user.'); break; }
      }

      if (o.xrayOpts.enabled && v2rayParsed && foundResults.length && !this.userStopRequested) {
        await this.runXrayTests(sessId, v2rayParsed, foundResults, o.xrayOpts);
      }
      if (o.speedOpts.enabled && foundResults.length && !this.userStopRequested) {
        await this.runSpeedTests(sessId, foundResults, o.speedOpts);
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const s2 = store.getSession(sessId);
      if (s2) {
        s2.total_scanned = totalScanned;
        s2.total_found = found;
        s2.duration = round(elapsed, 1);
        if (s2.status === 'running') s2.status = 'completed';
        s2.completed_at = utcnow();
        store.saveSession(s2);
      }
      log('INFO', `Scan complete: ${found}/${totalScanned} IPs found in ${elapsed.toFixed(1)}s`);
      if (found && !this.userStopRequested) {
        await this.notifyScanComplete(sessId, scanMethod, foundResults, totalScanned, elapsed);
      }
      this.emit('scan_complete', { session_id: sessId, total_scanned: totalScanned, total_found: found, duration: round(elapsed, 1) });
    } catch (e) {
      log('ERROR', `Scan error: ${e?.message || e}\n${e?.stack || ''}`);
      const s = store.getSession(sessId);
      if (s) { s.status = 'error'; store.saveSession(s); }
      this.emit('scan_error', { error: String(e?.message || e), session_id: sessId });
    }
  }

  /** Test IPs with the user's V2Ray config concurrently (port of V2RayScanner.scan_ips). */
  async v2rayScan(parsed, ips, workers, timeoutMs, { onResult, onProgress, shouldStop }) {
    const start = Date.now();
    let done = 0;
    await runPool(ips, workers, async (ip) => {
      let res = null;
      try { res = await this.lib.testIpWithConfig(parsed, ip, timeoutMs); } catch { res = null; }
      done += 1;
      if (res?.ok && !shouldStop()) {
        onResult({ ip, ping: res.latency, open_ports: [parsed.port], colo: res.colo || '' });
      }
      const elapsed = (Date.now() - start) / 1000;
      if (done % 10 === 0 || done === ips.length) onProgress(done, ips.length, elapsed > 0 ? done / elapsed : 0, elapsed);
    }, { shouldStop });
  }

  // ---------- post-scan phases ----------

  /** Update a stored result (and its score) after a post-scan test. */
  saveResultFields(sessId, res, fields) {
    Object.assign(res, fields);
    const score = this.lib.Scanner.calcScore(res);
    res.score = score;
    const row = this.store.sessionResults(sessId).find((r) => r.ip === res.ip);
    if (row) {
      Object.assign(row, fields);
      row.score = score;
      this.store.saveResult(row);
    }
    return score;
  }

  async runXrayTests(sessId, parsed, foundResults, opts) {
    const log = (level, msg) => this.emitLog(level, msg, sessId);
    const status = await this.lib.xrayStatus(this.ctx.dataDir);
    if (!status?.available) {
      log('WARN', 'Xray real test skipped: Xray-core is not installed (Settings → Install Xray).');
      return;
    }
    const candidates = [...foundResults].sort((a, b) => (a.ping ?? 1e9) - (b.ping ?? 1e9)).slice(0, opts.count);
    const byIp = new Map(candidates.map((r) => [r.ip, r]));
    log('INFO', `Xray real test: ${candidates.length} IPs via ${opts.url}`);
    this.emit('scan_status', { status: 'xray_testing', total: candidates.length, session_id: sessId });
    let done = 0;
    const reported = new Set();
    const onResult = (ip, delay) => {
      if (reported.has(ip) || !byIp.has(ip)) return;
      reported.add(ip);
      done += 1;
      const realDelay = delay === null || delay === undefined ? -1 : delay;
      const score = this.saveResultFields(sessId, byIp.get(ip), { real_delay: realDelay });
      this.emit('scan_result_update', { ip, real_delay: realDelay, score: round(score, 1), session_id: sessId });
      this.emit('scan_progress', { done, total: candidates.length, percent: round(done * 100 / candidates.length, 1),
        speed: 0, elapsed: 0, session_id: sessId, phase: 'xray' });
      log('INFO', `Real delay ${ip}: ` + (realDelay >= 0 ? `${Math.round(realDelay)} ms` : 'failed'));
    };
    try {
      const results = await this.lib.testThroughXray(parsed, candidates.map((r) => r.ip), {
        dataDir: this.ctx.dataDir, timeout: 10000, batchSize: 10, url: opts.url,
        onResult, shouldStop: () => this.userStopRequested, log,
      });
      for (const [ip, r] of results || []) onResult(ip, r?.ok ? r.real_delay : null);
    } catch (e) { // unsupported config (e.g. REALITY / unknown transport)
      log('WARN', `Xray real test skipped: ${e?.message || e}`);
    }
  }

  /** Download speed of the best IPs, one after another (parallel tests would share bandwidth). */
  async runSpeedTests(sessId, foundResults, opts) {
    const log = (level, msg) => this.emitLog(level, msg, sessId);
    const usable = foundResults.filter((r) => r.real_delay === null || r.real_delay === undefined || r.real_delay >= 0);
    const candidates = usable.sort((a, b) => (a.ping ?? 1e9) - (b.ping ?? 1e9)).slice(0, opts.count);
    if (!candidates.length) return;
    log('INFO', `Speed test: ${candidates.length} IPs, ${opts.sizeKb} KB each`);
    this.emit('scan_status', { status: 'speed_testing', total: candidates.length, session_id: sessId });
    let i = 0;
    for (const res of candidates) {
      i += 1;
      if (this.userStopRequested) { log('INFO', 'Speed test stopped by user.'); break; }
      let speed = null;
      try {
        speed = await this.lib.measureDownload(res.ip, { url: opts.url, bytes: opts.sizeKb * 1024, timeout: 30000 });
      } catch { speed = null; }
      const score = this.saveResultFields(sessId, res, { speed });
      this.emit('scan_result_update', { ip: res.ip, speed, score: round(score, 1), session_id: sessId });
      this.emit('scan_progress', { done: i, total: candidates.length, percent: round(i * 100 / candidates.length, 1),
        speed: 0, elapsed: 0, session_id: sessId, phase: 'speed' });
      log('INFO', `Speed ${res.ip}: ` + (speed ? `${Math.round(speed)} KB/s` : 'failed'));
    }
  }

  /** Optional Telegram summary (best IPs) when a scan finishes. */
  async notifyScanComplete(sessId, scanMethod, foundResults, totalScanned, elapsed) {
    if (this.store.getSetting('notify_scan_complete', 'false') !== 'true') return;
    const best = [...foundResults].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
    const lines = [`CDN IP Scanner: scan #${sessId} finished`,
      `${scanMethod}: ${foundResults.length} IPs found, ${totalScanned} tried, ${Math.round(elapsed)}s`, ''];
    for (const r of best) {
      const colo = r.colo ? ` ${r.colo}` : '';
      lines.push(r.ping ? `${r.ip}  ${Math.round(r.ping)} ms${colo}` : `${r.ip}${colo}`);
    }
    const { ok, error } = await this.ctx.sendTelegram(lines.join('\n'));
    if (ok) this.emitLog('INFO', 'Telegram: scan summary sent', sessId);
    else this.emitLog('WARN', `Telegram: could not send scan summary (${error})`, sessId);
  }

  // ---------- re-test stored results ----------

  retest(sessionId) {
    if (this.running() || this.retestRunning()) return { status: 409, body: { error: 'A scan or re-test is already running' } };
    const sess = sessionId ? this.store.getSession(sessionId) : null;
    if (!sess) return { status: 404, body: { error: 'Session not found' } };
    const rows = this.store.sessionResults(sess.id);
    if (!rows.length) return { status: 404, body: { error: 'No results in this session' } };
    let v2rayParsed = null;
    if (sess.scan_method === 'v2ray' && sess.v2ray_config) v2rayParsed = this.lib.parseConfig(sess.v2ray_config);
    this.retestPromise = this.runRetest(sess.id, [...rows], v2rayParsed).finally(() => { this.retestPromise = null; });
    return { status: 200, body: { status: 'started', count: rows.length } };
  }

  async retestOne(ip, ports, scanner, v2rayParsed) {
    if (v2rayParsed) {
      const r = await this.lib.testIpWithConfig(v2rayParsed, ip, 5000);
      return r?.ok ? [true, r.latency, r.colo || ''] : [false, null, ''];
    }
    const res = await scanner.check(ip, ports?.length ? ports : [443]);
    if (!res) return [false, null, ''];
    return [true, res.ping, res.colo || ''];
  }

  async runRetest(sessId, rows, v2rayParsed) {
    const { store, lib } = this;
    const log = (level, msg) => this.emitLog(level, msg, sessId);
    const scanner = new lib.Scanner({ maxLatencyMs: toInt(store.getSetting('ping_max', '9999'), 9999, 1, 60000) });
    scanner.setMode(store.getSetting('mode', 'hyper'));
    log('INFO', `Re-test: checking ${rows.length} IPs of scan #${sessId}`);
    let aliveCount = 0, deadCount = 0;
    await runPool(rows, 16, async (row) => {
      let alive, ping, colo;
      try {
        [alive, ping, colo] = await this.retestOne(row.ip, row.open_ports || [], scanner, v2rayParsed);
      } catch { [alive, ping, colo] = [false, null, '']; }
      row.alive = !!alive;
      if (alive) {
        aliveCount += 1;
        if (ping) row.ping = round(ping, 1);
        if (colo) row.colo = colo;
      } else {
        deadCount += 1;
      }
      row.score = lib.Scanner.calcScore({ ping: row.ping, open_ports: row.open_ports || [], speed: row.speed,
        real_delay: row.real_delay, alive: row.alive });
      store.saveResult(row);
      this.emit('scan_result_update', { ip: row.ip, session_id: sessId, alive: row.alive, ping: row.ping,
        colo: row.colo || '', colo_name: lib.coloName(row.colo), score: round(row.score, 1) });
      const state = alive && row.ping ? `OK ${Math.round(row.ping)} ms` : (alive ? 'OK' : 'dead');
      log('INFO', `Re-test ${row.ip}: ${state}`);
    });
    log('INFO', `Re-test complete: ${aliveCount} alive, ${deadCount} dead`);
    this.emit('retest_complete', { session_id: sessId, alive: aliveCount, dead: deadCount });
  }
}
