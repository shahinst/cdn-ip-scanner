"""
CDN IP Scanner V2.0 - Database Models (SQLite / MySQL)
Author: shahinst
"""

import json

from app import db, utcnow
from app.scanner.colo import colo_name


class ScanResult(db.Model):
    __tablename__ = 'scan_results'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(45), nullable=False, index=True)
    ping = db.Column(db.Float, nullable=True)
    open_ports = db.Column(db.Text, nullable=True)  # JSON list
    score = db.Column(db.Float, default=0.0)
    operator = db.Column(db.String(100), nullable=True)
    colo = db.Column(db.String(10), nullable=True)   # CDN edge data center, e.g. FRA
    speed = db.Column(db.Float, nullable=True)       # download speed in KB/s (if tested)
    real_delay = db.Column(db.Float, nullable=True)  # Xray real test: ms, -1 = failed, NULL = not tested
    alive = db.Column(db.Boolean, nullable=True)    # False once a re-test found the IP dead
    scan_session_id = db.Column(db.Integer, db.ForeignKey('scan_sessions.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'ip': self.ip,
            'ping': self.ping,
            'open_ports': json.loads(self.open_ports) if self.open_ports else [],
            'score': self.score,
            'operator': self.operator or '',
            'colo': self.colo or '',
            'speed': self.speed,
            'real_delay': self.real_delay,
            'alive': self.alive is not False,
            'colo_name': colo_name(self.colo),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ScanSession(db.Model):
    __tablename__ = 'scan_sessions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    mode = db.Column(db.String(50), nullable=True)
    scan_method = db.Column(db.String(50), nullable=True)
    v2ray_config = db.Column(db.Text, nullable=True)  # template config (for subscription output)
    params = db.Column(db.Text, nullable=True)  # JSON of the scan request, used to resume it
    total_scanned = db.Column(db.Integer, default=0)
    total_found = db.Column(db.Integer, default=0)
    duration = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, stopped
    created_at = db.Column(db.DateTime, default=utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    results = db.relationship('ScanResult', backref='session', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'mode': self.mode,
            'scan_method': self.scan_method,
            'total_scanned': self.total_scanned,
            'total_found': self.total_found,
            'duration': self.duration,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class OperatorRange(db.Model):
    __tablename__ = 'operator_ranges'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    operator_key = db.Column(db.String(50), nullable=False, index=True)
    operator_name = db.Column(db.String(100), nullable=True)
    asn = db.Column(db.String(200), nullable=True)
    prefix = db.Column(db.String(50), nullable=False)
    country = db.Column(db.String(10), default='ir')
    created_at = db.Column(db.DateTime, default=utcnow)


class AppSetting(db.Model):
    __tablename__ = 'app_settings'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    key = db.Column(db.String(100), nullable=False, unique=True, index=True)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    @staticmethod
    def get(key, default=None):
        s = AppSetting.query.filter_by(key=key).first()
        return s.value if s else default

    @staticmethod
    def set(key, value):
        s = AppSetting.query.filter_by(key=key).first()
        if s:
            s.value = str(value)
        else:
            s = AppSetting(key=key, value=str(value))
            db.session.add(s)
        db.session.commit()


class ScanLog(db.Model):
    __tablename__ = 'scan_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(db.Integer, db.ForeignKey('scan_sessions.id'), nullable=True)
    level = db.Column(db.String(10), default='INFO')  # INFO, WARN, ERROR, DEBUG
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'level': self.level,
            'message': self.message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# Columns added after the first release: (table, column, SQL type).
# db.create_all() never alters existing tables, so these are added on startup.
_ADDED_COLUMNS = [
    ('scan_results', 'colo', 'VARCHAR(10)'),
    ('scan_results', 'speed', 'FLOAT'),
    ('scan_results', 'real_delay', 'FLOAT'),
    ('scan_results', 'alive', 'BOOLEAN'),
    ('scan_sessions', 'v2ray_config', 'TEXT'),
    ('scan_sessions', 'params', 'TEXT'),
]


def migrate_schema():
    """Add missing columns to databases created by older versions."""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())
    with db.engine.begin() as conn:
        for table, column, sql_type in _ADDED_COLUMNS:
            if table not in tables:
                continue
            existing = {c['name'] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {sql_type}'))


class FavoriteIP(db.Model):
    """An IP the user saved; re-checked periodically by app.monitor."""
    __tablename__ = 'favorite_ips'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(45), nullable=False, unique=True, index=True)
    port = db.Column(db.Integer, default=443)
    label = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    last_checked = db.Column(db.DateTime, nullable=True)
    last_ok = db.Column(db.Boolean, nullable=True)
    last_ping = db.Column(db.Float, nullable=True)
    last_colo = db.Column(db.String(10), nullable=True)

    def to_dict(self, uptime=None, checks=0):
        return {
            'id': self.id, 'ip': self.ip, 'port': self.port, 'label': self.label or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_checked': self.last_checked.isoformat() if self.last_checked else None,
            'last_ok': self.last_ok, 'last_ping': self.last_ping, 'last_colo': self.last_colo or '',
            'uptime_24h': uptime, 'checks_24h': checks,
        }


class IPCheck(db.Model):
    """History of favorite-IP checks (kept for 30 days)."""
    __tablename__ = 'ip_checks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(45), nullable=False, index=True)
    ok = db.Column(db.Boolean, default=False)
    ping = db.Column(db.Float, nullable=True)
    colo = db.Column(db.String(10), nullable=True)
    checked_at = db.Column(db.DateTime, default=utcnow, index=True)
