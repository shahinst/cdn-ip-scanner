"""
CDN IP Scanner - Favorite IPs monitor
Author: shahinst

Saved ("favorite") IPs are re-checked with the same CDN verification as a scan,
either on demand or every N minutes in the background. Every check is kept for
30 days, which gives an uptime figure per IP. When an IP stops working (or comes
back) an optional Telegram message is sent.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import requests

from app import db, socketio, utcnow
from app.models import AppSetting, FavoriteIP, IPCheck
from app.scanner.core import SHScanner

logger = logging.getLogger(__name__)

HISTORY_DAYS = 30
_check_lock = threading.Lock()


def _check_one(fav_ip, port):
    scanner = SHScanner()  # own instance: never shares stop flags with a running scan
    scanner.max_latency_ms = 9999
    result = scanner.check(fav_ip, [port])
    if not result:
        return False, None, ''
    return True, result.get('ping'), result.get('colo') or ''


def uptime_24h(ip):
    """(uptime percent or None, number of checks) over the last 24 hours."""
    since = utcnow() - timedelta(hours=24)
    checks = IPCheck.query.filter(IPCheck.ip == ip, IPCheck.checked_at >= since).all()
    if not checks:
        return None, 0
    return round(100.0 * sum(1 for c in checks if c.ok) / len(checks), 1), len(checks)


def favorites_payload():
    out = []
    for fav in FavoriteIP.query.order_by(FavoriteIP.id).all():
        uptime, n = uptime_24h(fav.ip)
        out.append(fav.to_dict(uptime=uptime, checks=n))
    return out


def check_favorites(notify=True):
    """
    Check every favorite IP once, store the results and return the changes
    as (went_down, came_back) lists of IPs. Runs at most once at a time.
    """
    if not _check_lock.acquire(blocking=False):
        return [], []
    try:
        favorites = FavoriteIP.query.all()
        if not favorites:
            return [], []
        targets = [(f.ip, f.port or 443) for f in favorites]
        with ThreadPoolExecutor(max_workers=min(16, len(targets))) as ex:
            results = list(ex.map(lambda t: _check_one(*t), targets))

        now = utcnow()
        went_down, came_back = [], []
        for fav, (ok, ping, colo) in zip(favorites, results):
            if fav.last_ok is True and not ok:
                went_down.append(fav.ip)
            elif fav.last_ok is False and ok:
                came_back.append(fav.ip)
            fav.last_ok, fav.last_checked = ok, now
            if ok:
                fav.last_ping, fav.last_colo = ping, colo or fav.last_colo
            db.session.add(IPCheck(ip=fav.ip, ok=ok, ping=ping, colo=colo or None, checked_at=now))
        IPCheck.query.filter(IPCheck.checked_at < now - timedelta(days=HISTORY_DAYS)).delete()
        db.session.commit()

        socketio.emit('favorites_update', {'favorites': favorites_payload()}, namespace='/')
        if notify and (went_down or came_back):
            message = format_change_message(went_down, came_back)
            ok, err = send_telegram(message)
            if not ok and err != 'not configured':
                logger.warning("Telegram notification failed: %s", err)
        return went_down, came_back
    except Exception:
        db.session.rollback()
        raise
    finally:
        _check_lock.release()


def format_change_message(went_down, came_back):
    lines = ['CDN IP Scanner']
    lines += [f'❌ {ip} stopped working' for ip in went_down]
    lines += [f'✅ {ip} is working again' for ip in came_back]
    return '\n'.join(lines)


def send_telegram(text, token=None, chat_id=None, proxy=None):
    """Send a Telegram message using the saved settings. Returns (ok, error)."""
    token = token if token is not None else AppSetting.get('telegram_token', '')
    chat_id = chat_id if chat_id is not None else AppSetting.get('telegram_chat_id', '')
    proxy = proxy if proxy is not None else AppSetting.get('telegram_proxy', '')
    if not token or not chat_id:
        return False, 'not configured'
    proxies = {'http': proxy, 'https': proxy} if proxy else None
    try:
        r = requests.post(f'https://api.telegram.org/bot{token}/sendMessage',
                          json={'chat_id': chat_id, 'text': text}, proxies=proxies, timeout=20)
        data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
        if r.status_code == 200 and data.get('ok'):
            return True, ''
        return False, data.get('description') or f'HTTP {r.status_code}'
    except (requests.exceptions.RequestException, ValueError) as e:
        # Never echo the URL: it contains the bot token
        return False, type(e).__name__


def _monitor_loop(app, poll_seconds):
    last_run = 0.0
    while True:
        time.sleep(poll_seconds)
        try:
            with app.app_context():
                minutes = int(AppSetting.get('monitor_interval', '0') or 0)
                if minutes > 0 and time.time() - last_run >= minutes * 60:
                    last_run = time.time()
                    check_favorites()
        except Exception as e:
            logger.warning("Favorites monitor error: %s", e)


def start_monitor(app, poll_seconds=30):
    """Start the background monitor (once per process)."""
    if getattr(app, '_favorites_monitor', None):
        return
    t = threading.Thread(target=_monitor_loop, args=(app, poll_seconds), daemon=True,
                         name='favorites-monitor')
    t.start()
    app._favorites_monitor = t
