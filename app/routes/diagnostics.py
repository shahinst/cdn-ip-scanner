"""
CDN IP Scanner - Diagnostic report for bug reports
Author: shahinst

One JSON file with what is needed to understand a problem: versions, OS,
settings (secrets removed), recent scan sessions and log lines. The user
downloads it and attaches it to a GitHub issue; nothing is sent anywhere.
"""

import json
import os
import platform
import sys
from collections import deque
from urllib.parse import urlsplit, urlunsplit

from flask import Blueprint, Response, current_app

from app import utcnow
from app.models import AppSetting, ScanLog, ScanResult, ScanSession
from app.scanner import xray as xray_mod

diagnostics_bp = Blueprint('diagnostics', __name__)

SECRET_KEYS = {'telegram_token'}
LOG_TAIL_LINES = 300


def _redact_url(value):
    """Drop user:password from proxy URLs."""
    try:
        parts = urlsplit(value)
    except ValueError:
        return '***'
    if parts.username or parts.password:
        host = parts.hostname or ''
        if parts.port:
            host += f':{parts.port}'
        return urlunsplit((parts.scheme, '***@' + host, parts.path, parts.query, parts.fragment))
    return value


def redacted_settings():
    from app.routes.api import SETTINGS_DEFAULTS
    out = {}
    for key, default in SETTINGS_DEFAULTS.items():
        value = AppSetting.get(key, default)
        if key in SECRET_KEYS:
            value = '***' if value else ''
        elif key.endswith('_proxy') and value:
            value = _redact_url(value)
        out[key] = value
    return out


def _log_file_tail():
    path = os.path.join(current_app.config['DATA_DIR'], 'scanner.log')
    if not os.path.isfile(path):
        return []
    with open(path, encoding='utf-8', errors='replace') as f:
        return [line.rstrip('\n') for line in deque(f, maxlen=LOG_TAIL_LINES)]


def build_report():
    xray_path = xray_mod.find_xray()
    sessions = ScanSession.query.order_by(ScanSession.id.desc()).limit(10).all()
    logs = ScanLog.query.order_by(ScanLog.id.desc()).limit(LOG_TAIL_LINES).all()
    return {
        'generated_at': utcnow().isoformat() + 'Z',
        'app': {
            'version': current_app.config.get('VERSION'),
            'frozen': bool(current_app.config.get('FROZEN')),
            'auth_enabled': bool(current_app.config.get('AUTH_ENABLED')),
            'web_update': bool(current_app.config.get('ALLOW_WEB_UPDATE')),
            'database': current_app.config['SQLALCHEMY_DATABASE_URI'].split(':', 1)[0],
        },
        'system': {
            'os': platform.platform(),
            'machine': platform.machine(),
            'python': sys.version.split()[0],
            'cpu_count': os.cpu_count(),
        },
        'xray': {'available': bool(xray_path), 'version': xray_mod.xray_version(xray_path) if xray_path else ''},
        'settings': redacted_settings(),
        'stats': {'sessions': ScanSession.query.count(), 'results': ScanResult.query.count()},
        'recent_sessions': [s.to_dict() for s in sessions],  # no V2Ray config (it holds credentials)
        'scan_log': [l.to_dict() for l in reversed(logs)],
        'app_log_tail': _log_file_tail(),
    }


@diagnostics_bp.route('/diagnostics', methods=['GET'])
def diagnostics():
    report = json.dumps(build_report(), indent=2, ensure_ascii=False, default=str)
    name = f'cdn-ip-scanner-report-{utcnow().strftime("%Y%m%d-%H%M%S")}.json'
    return Response(report, mimetype='application/json',
                    headers={'Content-Disposition': f'attachment; filename={name}'})
