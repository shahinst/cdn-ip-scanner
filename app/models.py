"""
CDN IP Scanner V2.0 - Database Models (SQLite / MySQL)
Author: shahinst
"""

import json

from app import db, utcnow


class ScanResult(db.Model):
    __tablename__ = 'scan_results'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(45), nullable=False, index=True)
    ping = db.Column(db.Float, nullable=True)
    open_ports = db.Column(db.Text, nullable=True)  # JSON list
    score = db.Column(db.Float, default=0.0)
    operator = db.Column(db.String(100), nullable=True)
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ScanSession(db.Model):
    __tablename__ = 'scan_sessions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    mode = db.Column(db.String(50), nullable=True)
    scan_method = db.Column(db.String(50), nullable=True)
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
