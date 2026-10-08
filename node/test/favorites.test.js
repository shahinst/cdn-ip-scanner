import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { sendTelegram } from '../src/telegram.js';

describe('favorites', () => {
  let app;
  before(async () => { app = await startApp(); });
  after(async () => { await app.close(); });

  test('add, update and delete', async () => {
    assert.equal((await app.api('POST', '/api/favorites', { ip: 'not-an-ip' })).status, 400);
    const r = await app.api('POST', '/api/favorites', { ip: '1.1.1.1', port: 443, label: 'cf', ping: 12.5, colo: 'FRA' });
    assert.equal(r.status, 201);
    assert.equal(r.json.ip, '1.1.1.1');
    assert.equal(r.json.label, 'cf');
    assert.equal(r.json.last_colo, 'FRA');
    const again = await app.api('POST', '/api/favorites', { ip: '1.1.1.1', label: 'renamed' });
    assert.equal(again.status, 201);
    assert.equal(again.json.label, 'renamed');
    const list = (await app.api('GET', '/api/favorites')).json;
    assert.equal(list.length, 1);
    assert.equal((await app.api('DELETE', '/api/favorites/1.1.1.1')).status, 200);
    assert.equal((await app.api('DELETE', '/api/favorites/1.1.1.1')).status, 404);
    assert.equal((await app.api('GET', '/api/favorites')).json.length, 0);
  });

  test('check tracks uptime and alerts once when an ip goes down', async () => {
    await app.api('POST', '/api/settings', { telegram_token: '123:ABC', telegram_chat_id: '42' });
    await app.api('POST', '/api/favorites', { ip: '2.2.2.2' });
    app.sent.length = 0;

    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 10, colo: 'FRA' });
    let r = await app.api('POST', '/api/favorites/check');
    assert.equal(r.status, 200);
    assert.equal(r.json.favorites[0].uptime_24h, 100.0);
    assert.equal(r.json.favorites[0].last_ok, true);
    assert.deepEqual(r.json.went_down, []);

    app.state.check = async () => null;
    r = await app.api('POST', '/api/favorites/check');
    assert.deepEqual(r.json.went_down, ['2.2.2.2']);
    assert.equal(r.json.favorites[0].uptime_24h, 50.0);
    assert.equal(r.json.favorites[0].checks_24h, 2);
    assert.equal(app.sent.length, 1);
    assert.ok(app.sent[0].body.text.includes('2.2.2.2 stopped working'));

    r = await app.api('POST', '/api/favorites/check');
    assert.deepEqual(r.json.went_down, []);
    assert.equal(app.sent.length, 1); // no repeated alert
    const update = app.events.filter((e) => e.event === 'favorites_update').pop();
    assert.equal(update.payload.favorites[0].ip, '2.2.2.2');

    app.state.check = async (ip, ports) => ({ ip, open_ports: ports, ping: 10, colo: 'FRA' });
    r = await app.api('POST', '/api/favorites/check');
    assert.deepEqual(r.json.came_back, ['2.2.2.2']);
    assert.ok(app.sent[1].body.text.includes('is working again'));
    await app.api('POST', '/api/settings', { telegram_token: '', telegram_chat_id: '' });
  });

  test('telegram test endpoint reports missing configuration', async () => {
    const r = await app.api('POST', '/api/telegram/test', {});
    assert.equal(r.status, 400);
    assert.ok(r.json.error.includes('not configured'));
    const ok = await app.api('POST', '/api/telegram/test', { telegram_token: '1:A', telegram_chat_id: '7' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.status, 'sent');
  });
});

describe('sendTelegram', () => {
  test('not configured without token and chat id', async () => {
    const r = await sendTelegram('hi', { token: '', chatId: '' });
    assert.equal(r.ok, false);
    assert.ok(r.error.includes('not configured'));
  });

  test('posts to the bot API through the given proxy', async () => {
    const calls = [];
    const request = async (url, body, proxy) => { calls.push({ url, body, proxy }); return { ok: true }; };
    const r = await sendTelegram('hi', { token: '123:ABC', chatId: '42', proxy: 'socks5h://127.0.0.1:1080', request });
    assert.equal(r.ok, true);
    assert.ok(calls[0].url.endsWith('/bot123:ABC/sendMessage'));
    assert.deepEqual(calls[0].body, { chat_id: '42', text: 'hi' });
    assert.equal(calls[0].proxy, 'socks5h://127.0.0.1:1080');
  });

  test('transport errors never leak the token', async () => {
    const request = async (url) => { throw new Error(`cannot reach ${url}`); };
    const r = await sendTelegram('hi', { token: '123:ABC', chatId: '42', request });
    assert.equal(r.ok, false);
    assert.ok(!r.error.includes('123:ABC'));
  });
});
