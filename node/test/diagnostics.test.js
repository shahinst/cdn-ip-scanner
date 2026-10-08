import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

describe('diagnostics', () => {
  test('report redacts secrets and includes the essentials', async () => {
    const app = await startApp();
    try {
      await app.api('POST', '/api/settings', { telegram_token: '123:SECRET-TOKEN', theme: 'dark',
        telegram_proxy: 'socks5h://user:pa55@127.0.0.1:1080' });
      await app.api('POST', '/api/scan/start', { ranges: ['127.0.0.1'], ports: '443', target_count: '1' });
      await app.waitScan();

      const r = await app.api('GET', '/api/diagnostics');
      assert.equal(r.status, 200);
      assert.ok(r.headers.get('content-disposition').includes('cdn-ip-scanner-report-'));
      assert.ok(!r.text.includes('SECRET-TOKEN') && !r.text.includes('pa55'));
      const report = r.json;
      assert.equal(report.settings.telegram_token, '***');
      assert.equal(report.settings.telegram_proxy, 'socks5h://***@127.0.0.1:1080');
      assert.equal(report.settings.theme, 'dark');
      assert.ok(report.app.version);
      assert.ok(report.system.node);
      assert.ok('xray' in report && 'scan_log' in report);
      assert.equal(report.stats.sessions, 1);
      assert.equal(report.recent_sessions[0].status, 'completed');
      assert.ok(!('v2ray_config' in report.recent_sessions[0]));
    } finally { await app.close(); }
  });
});
