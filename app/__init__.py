"""
CDN IP Scanner V2.0 (Linux Edition)
Author: shahinst
GitHub: github.com/shahinst
"""

import hmac
import logging
from datetime import datetime, timezone
from urllib.parse import urlsplit

from flask import Flask, Response, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from sqlalchemy import event

# Configure logging for Linux server
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)

db = SQLAlchemy()
socketio = SocketIO()


def utcnow():
    """Naive UTC timestamp (replacement for the deprecated datetime.utcnow())."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hostname(value):
    """Hostname (no scheme/port) of an Origin URL or Host header."""
    if not value:
        return ''
    if '://' not in value:
        value = '//' + value
    try:
        return (urlsplit(value).hostname or '').lower()
    except ValueError:
        return ''


def origin_allowed(origin, host_header, extra_origins=()):
    """
    Same-origin check that tolerates reverse proxies: nginx forwards `Host: $host`
    (without port) and terminates TLS, so only the hostname is compared.
    """
    if not origin:
        return True  # non-browser clients (curl, scripts) send no Origin
    if origin in extra_origins:
        return True
    host = _hostname(host_header)
    return bool(host) and _hostname(origin) == host


def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    if config_override:
        app.config.update(config_override)
        if 'APP_USERNAME' in config_override or 'APP_PASSWORD' in config_override:
            app.config['AUTH_ENABLED'] = bool(app.config.get('APP_USERNAME') and app.config.get('APP_PASSWORD'))

    db.init_app(app)

    extra_origins = tuple(app.config.get('CORS_ORIGINS') or ())

    def _socket_origin_ok(origin, environ):
        host = environ.get('HTTP_X_FORWARDED_HOST') or environ.get('HTTP_HOST', '')
        return origin_allowed(origin, host.split(',')[0].strip(), extra_origins)

    # gevent for proper WebSocket + HTTP serving
    socketio.init_app(app, cors_allowed_origins=_socket_origin_ok, async_mode='gevent',
                      logger=False, engineio_logger=False)

    @app.before_request
    def _require_auth():
        if not app.config.get('AUTH_ENABLED') or request.path.startswith('/static/'):
            return None
        auth = request.authorization
        user_ok = auth is not None and hmac.compare_digest(
            (auth.username or '').encode(), app.config['APP_USERNAME'].encode())
        pass_ok = auth is not None and hmac.compare_digest(
            (auth.password or '').encode(), app.config['APP_PASSWORD'].encode())
        if user_ok and pass_ok:
            return None
        return Response('Authentication required', 401,
                        {'WWW-Authenticate': 'Basic realm="CDN IP Scanner"'})

    @app.before_request
    def _reject_cross_origin_writes():
        # CSRF protection: state-changing API calls must come from this site.
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return None
        if not origin_allowed(request.headers.get('Origin'), request.host, extra_origins):
            return jsonify({'error': 'Cross-origin request rejected'}), 403
        return None

    from app.routes.main import main_bp
    from app.routes.api import api_bp
    from app.routes.favorites import favorites_bp
    from app.routes.diagnostics import diagnostics_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(favorites_bp, url_prefix='/api')
    app.register_blueprint(diagnostics_bp, url_prefix='/api')

    with app.app_context():
        try:
            if db.engine.dialect.name == 'sqlite':
                @event.listens_for(db.engine, 'connect')
                def _sqlite_pragmas(dbapi_conn, _record):
                    cur = dbapi_conn.cursor()
                    cur.execute('PRAGMA journal_mode=WAL')
                    cur.execute('PRAGMA busy_timeout=30000')
                    cur.close()
            from app.models import migrate_schema
            migrate_schema()
            db.create_all()
            # A scan still marked "running" belongs to a previous process (closed or
            # crashed): mark it interrupted so it can be resumed from the UI.
            from app.models import ScanSession
            ScanSession.query.filter_by(status='running').update({'status': 'interrupted'})
            db.session.commit()
            logging.getLogger(__name__).info("Database initialized successfully")
        except Exception as e:
            logging.getLogger(__name__).warning(
                "Database init failed (app will still start): %s", e
            )

    return app
