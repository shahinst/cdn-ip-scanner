// Favorite IPs monitor: periodic re-checks, 30-day history, Telegram alerts (port of app/monitor.py).
import { runPool } from './pool.js';
import { utcnow } from './config.js';

const HISTORY_DAYS = 30;

function isoAgo(ms) {
  return new Date(Date.now() - ms).toISOString().replace('Z', '');
}

export class FavoritesMonitor {
  constructor(ctx) {
    this.ctx = ctx; // {store, io, lib, sendTelegram}
    this.checking = false;
    this.timer = null;
    this.lastRun = 0;
  }

  get store() { return this.ctx.store; }

  /** [uptime percent or null, number of checks] over the last 24 hours. */
  uptime24h(ip) {
    const checks = this.store.ipChecksSince(ip, isoAgo(24 * 3600 * 1000));
    if (!checks.length) return [null, 0];
    const ok = checks.filter((c) => c.ok).length;
    return [Math.round(1000 * ok / checks.length) / 10, checks.length];
  }

  favoritesPayload() {
    return this.store.listFavorites().map((f) => {
      const [uptime, n] = this.uptime24h(f.ip);
      return this.store.favoriteToDict(f, uptime, n);
    });
  }

  async checkOne(ip, port) {
    const scanner = new this.ctx.lib.Scanner({ maxLatencyMs: 9999 }); // own instance: never shares stop flags
    let result = null;
    try { result = await scanner.check(ip, [port]); } catch { result = null; }
    if (!result) return [false, null, ''];
    return [true, result.ping ?? null, result.colo || ''];
  }

  /**
   * Check every favorite IP once, store the results and return the changes as
   * {went_down, came_back}. Runs at most once at a time.
   */
  async checkFavorites(notify = true) {
    if (this.checking) return { went_down: [], came_back: [] };
    this.checking = true;
    try {
      const favorites = this.store.listFavorites();
      if (!favorites.length) return { went_down: [], came_back: [] };
      const results = new Array(favorites.length);
      await runPool(favorites.map((f, i) => i), Math.min(16, favorites.length), async (i) => {
        results[i] = await this.checkOne(favorites[i].ip, favorites[i].port || 443);
      });
      const now = utcnow();
      const wentDown = [], cameBack = [];
      favorites.forEach((fav, i) => {
        const [ok, ping, colo] = results[i];
        if (fav.last_ok === true && !ok) wentDown.push(fav.ip);
        else if (fav.last_ok === false && ok) cameBack.push(fav.ip);
        fav.last_ok = ok;
        fav.last_checked = now;
        if (ok) { fav.last_ping = ping; fav.last_colo = colo || fav.last_colo; }
        this.store.saveFavorite(fav);
        this.store.addIpCheck({ ip: fav.ip, ok, ping, colo: colo || null, checked_at: now });
      });
      this.store.pruneIpChecks(isoAgo(HISTORY_DAYS * 86400 * 1000));
      try { this.ctx.io.emit('favorites_update', { favorites: this.favoritesPayload() }); } catch { /* no clients */ }
      if (notify && (wentDown.length || cameBack.length)) {
        const { ok, error } = await this.ctx.sendTelegram(formatChangeMessage(wentDown, cameBack));
        if (!ok && error !== 'not configured') console.warn(`Telegram notification failed: ${error}`);
      }
      return { went_down: wentDown, came_back: cameBack };
    } finally {
      this.checking = false;
    }
  }

  /** Poll every `pollSeconds`; run a check when monitor_interval minutes have passed. */
  start(pollSeconds = 30) {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const minutes = parseInt(this.store.getSetting('monitor_interval', '0') || '0', 10) || 0;
        if (minutes > 0 && Date.now() - this.lastRun >= minutes * 60000) {
          this.lastRun = Date.now();
          await this.checkFavorites();
        }
      } catch (e) {
        console.warn(`Favorites monitor error: ${e?.message || e}`);
      }
    }, pollSeconds * 1000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export function formatChangeMessage(wentDown, cameBack) {
  return ['CDN IP Scanner',
    ...wentDown.map((ip) => `❌ ${ip} stopped working`),
    ...cameBack.map((ip) => `✅ ${ip} is working again`)].join('\n');
}
