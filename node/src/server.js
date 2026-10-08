// Express + Socket.IO application factory (port of app/__init__.py create_app).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import nunjucks from 'nunjucks';
import { Server as SocketServer } from 'socket.io';
import { PKG_DIR, AUTHOR, readVersion, defaultDataDir, truthy } from './config.js';
import { Store } from './store.js';
import { loadScannerLib } from './lib.js';
import { sendTelegram as sendTelegramRaw } from './telegram.js';
import { ScanEngine } from './scanEngine.js';
import { FavoritesMonitor } from './monitor.js';
import { apiRoutes } from './routes/api.js';
import { scanRoutes } from './routes/scan.js';
import { exportRoutes } from './routes/export.js';
import { favoritesRoutes } from './routes/favorites.js';
import { diagnosticsRoutes } from './diagnostics.js';

const LANGS = new Set(['en', 'fa', 'zh', 'ru']);

/** Packaged copy first (npm install), then the repo checkout next to node/. */
function assetDir(packaged, repo) {
  const a = path.join(PKG_DIR, packaged);
  if (fs.existsSync(a)) return a;
  return path.join(PKG_DIR, '..', 'app', repo);
}

function hostname(value) {
  if (!value) return '';
  let v = String(value).trim();
  if (!v.includes('://')) v = 'http://' + v;
  try { return new URL(v).hostname.toLowerCase(); } catch { return ''; }
}

/** Same-site check: no Origin, an allowed origin, or the Origin host equals the request Host. */
export function originAllowed(origin, hostHeader, extraOrigins = []) {
  if (!origin) return true;
  if (extraOrigins.includes(origin)) return true;
  const o = hostname(origin);
  return !!o && o === hostname(hostHeader);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function checkBasicAuth(header, username, password) {
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  return safeEqual(decoded.slice(0, i), username) & safeEqual(decoded.slice(i + 1), password);
}

/**
 * Build the app. Options: dataDir, username, password, corsOrigins (array),
 * allowWebUpdate, lib (scanner library override, used by tests), telegramRequest.
 */
export async function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.CDN_SCANNER_DATA_DIR || defaultDataDir();
  const username = options.username ?? process.env.APP_USERNAME ?? '';
  const password = options.password ?? process.env.APP_PASSWORD ?? '';
  const authEnabled = !!(username && password);
  const corsOrigins = options.corsOrigins
    ?? (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowWebUpdate = options.allowWebUpdate ?? truthy(process.env.ALLOW_WEB_UPDATE, true);
  const version = options.version || readVersion();
  const lib = options.lib || await loadScannerLib();

  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: {
      origin: (origin, cb) => cb(null, true), // same checks as HTTP: handled per request below
      credentials: true,
    },
    allowRequest: (req, cb) => {
      const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
      cb(null, originAllowed(req.headers.origin, host, corsOrigins));
    },
  });

  const store = new Store(dataDir);
  const sendTelegram = (text, opts = {}) => sendTelegramRaw(text, { store, request: options.telegramRequest, ...opts });
  const ctx = { app, server, io, store, lib, dataDir, version, authEnabled, allowWebUpdate, sendTelegram, corsOrigins };
  ctx.engine = new ScanEngine(ctx);
  ctx.engine.logEnabled = store.getSetting('log_enabled', 'false') === 'true';
  ctx.monitor = new FavoritesMonitor(ctx);

  // Templates and static files come from the Flask app unchanged.
  const staticDir = assetDir('public', 'static');
  const viewsDir = assetDir('views', 'templates');
  const env = nunjucks.configure(viewsDir, { autoescape: true, express: app, noCache: false });
  env.addGlobal('url_for', (endpoint, kw = {}) => (endpoint === 'static' ? `/static/${kw.filename || ''}` : '/'));
  env.addGlobal('version', version);
  env.addGlobal('author', AUTHOR);
  app.set('view engine', 'html');

  app.disable('x-powered-by');
  app.use('/static', express.static(staticDir, { maxAge: 0 }));
  app.use(express.json({ limit: '5mb', strict: false }));
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    next(err);
  });

  app.use((req, res, next) => {
    if (authEnabled && !req.path.startsWith('/static/')
        && !checkBasicAuth(req.headers.authorization, username, password)) {
      res.set('WWW-Authenticate', 'Basic realm="CDN IP Scanner"');
      return res.status(401).type('text/plain').send('Authentication required');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)
        && !originAllowed(req.headers.origin, req.headers.host, corsOrigins)) {
      return res.status(403).json({ error: 'Cross-origin request rejected' });
    }
    next();
  });

  app.get('/', (req, res) => res.render('index.html', { version, author: AUTHOR, theme: store.getSetting('theme', 'light') }));
  const scanner = (req, res) => {
    const lang = LANGS.has(req.params.lang) ? req.params.lang : 'en';
    res.render('scanner.html', { lang, version, author: AUTHOR, theme: store.getSetting('theme', 'light') });
  };
  app.get('/scanner', scanner);
  app.get('/scanner/:lang', scanner);

  app.use('/api', apiRoutes(ctx));
  app.use('/api', scanRoutes(ctx));
  app.use('/api', exportRoutes(ctx));
  app.use('/api', favoritesRoutes(ctx));
  app.use('/api', diagnosticsRoutes(ctx));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: String(err?.message || err) });
  });

  ctx.close = async () => {
    ctx.monitor.stop();
    ctx.engine.stop();
    await ctx.engine.waitScan?.();
    await ctx.engine.waitRetest?.();
    io.close();
    store.flush();
  };

  return { app, server, io, ctx, store, engine: ctx.engine, monitor: ctx.monitor, close: ctx.close };
}
