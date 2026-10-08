// Favorite IPs API and Telegram test (port of app/routes/favorites.py).
import net from 'node:net';
import express from 'express';

function body(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }

export function favoritesRoutes(ctx) {
  const { store, monitor } = ctx;
  const r = express.Router();

  r.get('/favorites', (req, res) => res.json(monitor.favoritesPayload()));

  r.post('/favorites', (req, res) => {
    const data = body(req);
    const ip = String(data.ip ?? '').trim();
    if (!net.isIP(ip)) return res.status(400).json({ error: 'Invalid IP address' });
    let port = parseInt(data.port, 10);
    if (!Number.isFinite(port)) port = 443;
    if (!(port > 0 && port < 65536)) port = 443;
    let fav = store.getFavorite(ip);
    if (!fav) fav = store.addFavorite(ip);
    fav.port = port;
    fav.label = String(data.label || '').slice(0, 100) || fav.label;
    if (data.ping !== null && data.ping !== undefined && fav.last_checked === null) {
      const p = Number.parseFloat(data.ping);
      if (Number.isFinite(p)) fav.last_ping = p;
    }
    if (data.colo) fav.last_colo = String(data.colo).slice(0, 10);
    store.saveFavorite(fav);
    res.status(201).json(store.favoriteToDict(fav));
  });

  r.delete('/favorites/:ip', (req, res) => {
    const ip = req.params.ip;
    if (!store.getFavorite(ip)) return res.status(404).json({ error: 'Not found' });
    store.deleteFavorite(ip);
    res.json({ status: 'deleted' });
  });

  r.post('/favorites/check', async (req, res) => {
    const { went_down, came_back } = await monitor.checkFavorites();
    res.json({ favorites: monitor.favoritesPayload(), went_down, came_back });
  });

  r.post('/telegram/test', async (req, res) => {
    const data = body(req);
    const { ok, error } = await ctx.sendTelegram('CDN IP Scanner: Telegram notifications are working ✅', {
      token: data.telegram_token ?? store.getSetting('telegram_token', ''),
      chatId: data.telegram_chat_id ?? store.getSetting('telegram_chat_id', ''),
      proxy: data.telegram_proxy ?? store.getSetting('telegram_proxy', ''),
    });
    if (!ok) return res.status(400).json({ error });
    res.json({ status: 'sent' });
  });

  return r;
}
