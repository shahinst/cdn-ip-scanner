// Telegram Bot API client with optional HTTP(S) CONNECT or SOCKS5 proxy (port of monitor.send_telegram).
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import http from 'node:http';

const TELEGRAM_HOST = 'api.telegram.org';
const TIMEOUT_MS = 20000;

function proxyParts(proxy) {
  const u = new URL(proxy);
  const scheme = u.protocol.replace(':', '').toLowerCase();
  const port = Number(u.port) || (scheme === 'https' ? 443 : scheme.startsWith('socks') ? 1080 : 80);
  return { scheme, host: u.hostname, port,
    user: decodeURIComponent(u.username || ''), pass: decodeURIComponent(u.password || '') };
}

function readExact(socket, n) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let got = 0;
    const onData = (d) => {
      chunks.push(d); got += d.length;
      if (got >= n) { socket.off('data', onData); socket.off('error', reject); socket.pause();
        const all = Buffer.concat(chunks);
        if (all.length > n) socket.unshift(all.subarray(n));
        resolve(all.subarray(0, n)); }
    };
    socket.on('data', onData);
    socket.once('error', reject);
    socket.resume();
  });
}

/** SOCKS5 CONNECT (RFC 1928, optional user/pass auth RFC 1929). */
async function socks5Connect(p, host, port) {
  const sock = await new Promise((resolve, reject) => {
    const s = net.connect(p.port, p.host, () => resolve(s));
    s.once('error', reject);
  });
  sock.pause();
  const auth = p.user ? Buffer.from([5, 2, 0, 2]) : Buffer.from([5, 1, 0]);
  sock.write(auth);
  const choice = await readExact(sock, 2);
  if (choice[0] !== 5 || choice[1] === 0xFF) throw new Error('SOCKS5: no acceptable auth method');
  if (choice[1] === 2) {
    const u = Buffer.from(p.user), w = Buffer.from(p.pass);
    sock.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([w.length]), w]));
    const r = await readExact(sock, 2);
    if (r[1] !== 0) throw new Error('SOCKS5: authentication failed');
  }
  const h = Buffer.from(host);
  sock.write(Buffer.concat([Buffer.from([5, 1, 0, 3, h.length]), h, Buffer.from([port >> 8, port & 0xFF])]));
  const head = await readExact(sock, 4);
  if (head[1] !== 0) throw new Error(`SOCKS5: connect failed (${head[1]})`);
  const addrLen = head[3] === 1 ? 4 : head[3] === 4 ? 16 : (await readExact(sock, 1))[0];
  await readExact(sock, addrLen + 2);
  return sock;
}

/** HTTP proxy CONNECT tunnel. */
async function httpConnect(p, host, port) {
  const mod = p.scheme === 'https' ? https : http;
  const headers = {};
  if (p.user) headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(`${p.user}:${p.pass}`).toString('base64');
  return new Promise((resolve, reject) => {
    const req = mod.request({ host: p.host, port: p.port, method: 'CONNECT', path: `${host}:${port}`, headers });
    req.once('connect', (res, socket) => {
      if (res.statusCode === 200) resolve(socket);
      else reject(new Error(`Proxy CONNECT failed (HTTP ${res.statusCode})`));
    });
    req.once('error', reject);
    req.end();
  });
}

/** POST JSON to the Bot API; resolves to {ok, error} (error is the API description or HTTP status). */
export async function postJson(url, body, proxy) {
  const u = new URL(url);
  const payload = Buffer.from(JSON.stringify(body));
  let socket = null;
  if (proxy) {
    const p = proxyParts(proxy);
    if (p.scheme.startsWith('socks')) socket = await socks5Connect(p, u.hostname, 443);
    else if (p.scheme === 'http' || p.scheme === 'https') socket = await httpConnect(p, u.hostname, 443);
    else throw new Error(`Unsupported proxy scheme: ${p.scheme}`);
  }
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port: 443, method: 'POST', path: u.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }, timeout: TIMEOUT_MS };
    if (socket) {
      opts.createConnection = () => tls.connect({ socket, servername: u.hostname });
    }
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let data = {};
        if ((res.headers['content-type'] || '').startsWith('application/json')) {
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { data = {}; }
        }
        if (res.statusCode === 200 && data?.ok) resolve({ ok: true, error: '' });
        else resolve({ ok: false, error: data?.description || `HTTP ${res.statusCode}` });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

/**
 * Send a Telegram message. Returns {ok, error}; the error never contains the URL
 * (it holds the bot token). `request` is injectable for tests.
 */
export async function sendTelegram(text, { token, chatId, proxy, store, request = postJson } = {}) {
  token = token ?? store?.getSetting('telegram_token', '') ?? '';
  chatId = chatId ?? store?.getSetting('telegram_chat_id', '') ?? '';
  proxy = proxy ?? store?.getSetting('telegram_proxy', '') ?? '';
  if (!token || !chatId) return { ok: false, error: 'not configured' };
  try {
    const r = await request(`https://${TELEGRAM_HOST}/bot${token}/sendMessage`,
      { chat_id: chatId, text }, proxy || null);
    if (r?.ok) return { ok: true, error: '' };
    return { ok: false, error: r?.error || 'Telegram request failed' };
  } catch (e) {
    return { ok: false, error: e?.code || e?.name || 'Error' };
  }
}
