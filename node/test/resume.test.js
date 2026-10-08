import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, tmpDataDir, makeFakeLib } from './helpers.js';
import { Store } from '../src/store.js';

function seedSession(store, status, extra = {}) {
  const params = { ranges: ['10.0.0.0/24'], ports: '443', target_count: '5', scan_method: 'cloud', ...extra.params };
  const sess = store.createSession({ mode: 'hyper', scan_method: 'cloud', status, params: JSON.stringify(params) });
  store.addResult({ ip: '10.0.0.1', ping: 20, open_ports: [443], score: 50, colo: 'FRA', scan_session_id: sess.id, alive: true });
  sess.total_found = 1;
  sess.total_scanned = 1;
  store.saveSession(sess);
  store.flush();
  return sess;
}

describe('resume', () => {
  test('running sessions become interrupted on restart', async () => {
    const dataDir = tmpDataDir();
    const seed = new Store(dataDir);
    seedSession(seed, 'running');
    const app = await startApp({ dataDir });
    try {
      const sessions = (await app.api('GET', '/api/scan/sessions')).json;
      assert.equal(sessions[0].status, 'interrupted');
      const info = (await app.api('GET', '/api/scan/resumable')).json;
      assert.equal(info.resumable, true);
      assert.equal(info.session_id, sessions[0].id);
      assert.equal(info.found, 1);
      assert.equal(info.target_count, '5');
    } finally { await app.close(); }
  });

  test('resume continues the same session without duplicating ips', async () => {
    const dataDir = tmpDataDir();
    const sess = seedSession(new Store(dataDir), 'interrupted');
    const app = await startApp({ dataDir });
    try {
      assert.equal((await app.api('POST', '/api/scan/resume', { session_id: 9999 })).status, 404);
      const r = await app.api('POST', '/api/scan/resume', { session_id: sess.id });
      assert.equal(r.status, 200);
      assert.equal(r.json.session_id, sess.id);
      await app.waitScan();
      const sessions = (await app.api('GET', '/api/scan/sessions')).json;
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'completed');
      assert.ok(sessions[0].total_scanned >= 5, String(sessions[0].total_scanned));
      const ips = (await app.api('GET', '/api/scan/results')).json.map((x) => x.ip);
      assert.equal(new Set(ips).size, ips.length);
      assert.equal(ips.filter((ip) => ip === '10.0.0.1').length, 1);
      assert.equal((await app.api('GET', '/api/scan/resumable')).json.resumable, false);
    } finally { await app.close(); }
  });

  test('stopped sessions are resumable, newer sessions supersede, discard works', async () => {
    const dataDir = tmpDataDir();
    const seed = new Store(dataDir);
    const stopped = seedSession(seed, 'stopped');
    const app = await startApp({ dataDir });
    try {
      let info = (await app.api('GET', '/api/scan/resumable')).json;
      assert.equal(info.resumable, true);
      assert.equal(info.status, 'stopped');
      assert.equal(info.session_id, stopped.id);

      assert.equal((await app.api('POST', '/api/scan/discard-resume')).json.status, 'ok');
      assert.equal((await app.api('GET', '/api/scan/resumable')).json.resumable, false);
      assert.equal((await app.api('GET', '/api/scan/sessions')).json[0].status, 'completed');

      seedSession(app.store, 'interrupted');
      assert.equal((await app.api('GET', '/api/scan/resumable')).json.resumable, true);
      seedSession(app.store, 'completed');
      assert.equal((await app.api('GET', '/api/scan/resumable')).json.resumable, false);
    } finally { await app.close(); }
  });

  test('stop marks the session stopped and it can be resumed', async () => {
    const app = await startApp();
    try {
      let n = 0;
      app.state.check = async (ip, ports) => { n += 1; if (n === 2) app.engine.stop(); return { ip, open_ports: ports, ping: 20, colo: 'FRA' }; };
      const r = await app.api('POST', '/api/scan/start', { ranges: ['10.0.0.0/24'], ports: '443', target_count: '50' });
      await app.waitScan();
      const session = (await app.api('GET', '/api/scan/sessions')).json[0];
      assert.equal(session.status, 'stopped');
      const info = (await app.api('GET', '/api/scan/resumable')).json;
      assert.equal(info.resumable, true);
      assert.equal(info.session_id, r.json.session_id);
      assert.equal((await app.api('POST', '/api/scan/stop')).json.status, 'stopped');
    } finally { await app.close(); }
  });

  test('new scans store their params without the v2ray config', async () => {
    const app = await startApp({ lib: makeFakeLib() });
    try {
      const r = await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '443', target_count: '1',
        scan_method: 'v2ray', v2ray_config: 'vless://uuid@1.1.1.1:443?type=ws#Mine' });
      await app.waitScan();
      const sess = app.store.getSession(r.json.session_id);
      const params = JSON.parse(sess.params);
      assert.deepEqual(params.ranges, ['127.0.0.1']);
      assert.equal(params.ports, '443');
      assert.ok(!('v2ray_config' in params));
      assert.equal(sess.v2ray_config, 'vless://uuid@1.1.1.1:443?type=ws#Mine');
    } finally { await app.close(); }
  });
});
