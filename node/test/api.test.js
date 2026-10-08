import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers.js';
import { PKG_DIR } from '../src/config.js';

describe('api', () => {
  let app;
  before(async () => { app = await startApp(); });
  after(async () => { await app.close(); });

  test('settings roundtrip ignores unknown keys', async () => {
    assert.equal((await app.api('POST', '/api/settings', { theme: 'dark', evil: 'x' })).status, 200);
    const data = (await app.api('GET', '/api/settings')).json;
    assert.equal(data.theme, 'dark');
    assert.ok(!('evil' in data));
  });

  test('cross-origin POST is rejected', async () => {
    assert.equal((await app.api('POST', '/api/reset', undefined, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await app.api('POST', '/api/reset', undefined, { Origin: 'http://127.0.0.1' })).status, 200);
  });

  test('version comes from the version file', async () => {
    const expected = fs.readFileSync(path.join(PKG_DIR, '..', 'version'), 'utf8').trim();
    assert.equal((await app.api('GET', '/api/info')).json.version, expected);
  });

  test('second scan is rejected while running', async () => {
    let release;
    app.state.check = () => new Promise((resolve) => { release = () => resolve(null); });
    assert.equal((await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'] })).status, 200);
    try {
      assert.equal((await app.api('POST', '/api/scan/start', { ranges: [] })).status, 409);
      assert.equal((await app.api('POST', '/api/reset')).status, 409);
      assert.equal((await app.api('POST', '/api/do-update')).status, 409);
    } finally {
      release();
      await app.waitScan();
      app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 20, colo: 'FRA' });
    }
  });

  test('invalid numbers do not crash scan start', async () => {
    const r = await app.api('POST', '/api/scan/start',
      { ranges: [], scan_method: 'cloud', ping_min: 'abc', ping_max: '', target_count: 'x' });
    assert.equal(r.status, 200);
    await app.waitScan();
    assert.equal((await app.api('GET', '/api/scan/sessions')).json[0].status, 'completed');
  });

  test('results limit is clamped', async () => {
    assert.equal((await app.api('GET', '/api/scan/results?limit=-5')).status, 200);
  });

  test('scan ends when small ranges are exhausted', async () => {
    app.state.check = async () => null; // nothing answers
    const r = await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '1', target_count: '5' });
    assert.equal(r.status, 200);
    await app.waitScan();
    const session = (await app.api('GET', '/api/scan/sessions')).json[0];
    assert.equal(session.status, 'completed');
    assert.equal(session.total_scanned, 1);
    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 20, colo: 'FRA' });
  });

  test('scan reports colo and speed', async () => {
    const r = await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '443', target_count: '1',
      speed_test: true, speed_test_size: '128', speed_test_url: 'http://speed.example/__down?bytes={bytes}' });
    assert.equal(r.status, 200);
    await app.waitScan();
    const results = (await app.api('GET', `/api/scan/results?session_id=${r.json.session_id}`)).json;
    assert.equal(results[0].colo, 'FRA');
    assert.ok(results[0].speed > 0);
    const complete = app.events.filter((e) => e.event === 'scan_complete').pop();
    assert.ok(complete && 'duration' in complete.payload && complete.payload.total_found === 1);
  });

  test('v2ray subscription, export and qr', async () => {
    const config = 'vless://uuid@1.1.1.1:8443?security=none&type=ws&host=example.com#Mine';
    const r = await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '8443', target_count: '1',
      scan_method: 'v2ray', v2ray_config: config });
    const sid = r.json.session_id;
    await app.waitScan();

    const plain = (await app.api('GET', `/api/v2ray/subscription/${sid}?format=plain`)).text;
    assert.ok(plain.startsWith('vless://uuid@127.0.0.1:8443?'), plain);
    assert.ok(plain.endsWith('#Mine%20%7C%20127.0.0.1'), plain);
    const encoded = (await app.api('GET', `/api/v2ray/subscription/${sid}`)).text;
    assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), plain);
    assert.equal((await app.api('GET', '/api/v2ray/subscription/9999')).status, 404);

    const clash = await app.api('GET', `/api/v2ray/export/${sid}?format=clash`);
    assert.equal(clash.status, 200);
    assert.ok(clash.headers.get('content-disposition').includes(`clash-${sid}.yaml`));
    assert.equal((await app.api('GET', `/api/v2ray/export/${sid}?format=bogus`)).status, 400);
    assert.equal((await app.api('GET', '/api/v2ray/export/9999')).status, 404);

    const parsed = await app.api('POST', '/api/v2ray/parse', { config });
    assert.equal(parsed.json.uuid, 'uuid...');
    assert.equal((await app.api('POST', '/api/v2ray/build-config', { config, ip: '1.2.3.4' })).json.config,
      'vless://uuid@1.2.3.4:8443?security=none&type=ws&host=example.com#Mine');

    const qr = await app.api('POST', '/api/v2ray/qr', { config, ip: '1.2.3.4' });
    assert.equal(qr.status, 200);
    assert.ok(qr.headers.get('content-type').startsWith('image/svg+xml'));
    assert.ok(qr.text.includes('<svg'));
    assert.equal((await app.api('POST', '/api/v2ray/qr', { config: 'bad', ip: '1.2.3.4' })).status, 400);
  });

  test('csv export and colo name', async () => {
    const r = await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '443', target_count: '1' });
    const sid = r.json.session_id;
    await app.waitScan();
    const results = (await app.api('GET', `/api/scan/results?session_id=${sid}`)).json;
    assert.equal(results[0].colo_name, 'Frankfurt, DE');
    assert.equal(results[0].alive, true);
    const csv = await app.api('GET', `/api/export/csv?session_id=${sid}`);
    assert.equal(csv.status, 200);
    assert.ok(csv.headers.get('content-disposition').includes('scan_results.csv'));
    assert.ok(csv.text.startsWith('﻿'));
    const text = csv.text.slice(1);
    assert.ok(text.split(/\r?\n/)[0].startsWith('#,IP,Ping'));
    assert.ok(text.includes('127.0.0.1') && text.includes('FRA (Frankfurt, DE)') && text.trimEnd().endsWith('yes'));
    const fa = (await app.api('GET', `/api/export/csv?session_id=${sid}&lang=fa`)).text.slice(1);
    assert.ok(fa.startsWith('رتبه,آدرس IP') && fa.split(/\r?\n/)[0].endsWith('سالم'));
    assert.equal((await app.api('GET', '/api/export/bogus')).status, 400);
    const txt = await app.api('GET', `/api/export/txt?session_id=${sid}`);
    assert.equal(txt.text, '127.0.0.1');
    const json = await app.api('GET', `/api/export/json?session_id=${sid}`);
    assert.equal(json.json[0].ip, '127.0.0.1');
  });

  test('excel export is a valid xlsx', async () => {
    const xlsx = await app.api('GET', '/api/export/excel');
    assert.equal(xlsx.status, 200);
    assert.ok(xlsx.headers.get('content-type').includes('spreadsheetml'));
    assert.equal(xlsx.buffer.subarray(0, 2).toString(), 'PK');
    assert.ok(xlsx.buffer.includes(Buffer.from('xl/worksheets/sheet1.xml')));
  });

  test('retest marks dead ips', async () => {
    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 30, colo: 'AMS' });
    const sid = (await app.api('POST', '/api/scan/start',
      { ranges: ['127.0.0.1'], ports: '443', target_count: '1' })).json.session_id;
    await app.waitScan();
    assert.equal((await app.api('POST', '/api/scan/retest', { session_id: 9999 })).status, 404);

    const r = await app.api('POST', '/api/scan/retest', { session_id: sid });
    assert.equal(r.status, 200);
    assert.equal(r.json.count, 1);
    await app.waitScan();
    let res = (await app.api('GET', `/api/scan/results?session_id=${sid}`)).json[0];
    assert.equal(res.alive, true);
    assert.ok(res.score > 0);

    app.state.check = async () => null;
    assert.equal((await app.api('POST', '/api/scan/retest', { session_id: sid })).status, 200);
    await app.waitScan();
    res = (await app.api('GET', `/api/scan/results?session_id=${sid}`)).json[0];
    assert.equal(res.alive, false);
    assert.equal(res.score, 0);
    const line = (await app.api('GET', `/api/export/csv?session_id=${sid}`)).text.slice(1).split(/\r?\n/)[1];
    assert.equal(line.split(',').pop(), 'no');
    const done = app.events.filter((e) => e.event === 'retest_complete').pop();
    assert.deepEqual(done.payload, { session_id: sid, alive: 0, dead: 1 });
    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 20, colo: 'FRA' });
  });

  test('scan summary is sent to telegram', async () => {
    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 20, colo: 'IST' });
    await app.api('POST', '/api/settings', { notify_scan_complete: 'true', telegram_token: '123:ABC', telegram_chat_id: '42' });
    app.sent.length = 0;
    await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '443', target_count: '1' });
    await app.waitScan();
    assert.equal(app.sent.length, 1);
    assert.ok(app.sent[0].body.text.includes('127.0.0.1') && app.sent[0].body.text.includes('IST'));
    await app.api('POST', '/api/settings', { notify_scan_complete: 'false' });
  });

  test('pages render', async () => {
    const index = await app.api('GET', '/');
    assert.equal(index.status, 200);
    assert.ok(index.text.includes('/static/'));
    const fa = await app.api('GET', '/scanner/fa');
    assert.equal(fa.status, 200);
    assert.ok(fa.text.includes('rtl'));
    assert.equal((await app.api('GET', '/scanner/xx')).status, 200);
    assert.equal((await app.api('GET', '/static/css/style.css')).status, 200);
  });
});

describe('api with auth and update disabled', () => {
  let app;
  before(async () => { app = await startApp({ username: 'admin', password: 'secret', allowWebUpdate: false }); });
  after(async () => { await app.close(); });

  test('basic auth when configured', async () => {
    assert.equal((await app.api('GET', '/api/info')).status, 401);
    const token = Buffer.from('admin:secret').toString('base64');
    assert.equal((await app.api('GET', '/api/info', undefined, { Authorization: 'Basic ' + token })).status, 200);
    assert.equal((await app.api('GET', '/api/info', undefined, { Authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') })).status, 401);
    assert.equal((await app.api('GET', '/static/css/style.css')).status, 200);
  });

  test('web update can be disabled', async () => {
    const token = Buffer.from('admin:secret').toString('base64');
    assert.equal((await app.api('POST', '/api/do-update', undefined, { Authorization: 'Basic ' + token })).status, 403);
  });
});
