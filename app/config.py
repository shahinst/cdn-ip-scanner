"""
CDN IP Scanner - Configuration (Linux / Windows / macOS)
Author: shahinst

Defaults to SQLite (no external DB required).
Supports MySQL/MariaDB via DATABASE_URL env var.
"""

import os
import sys
import secrets

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# True when running from a PyInstaller build (desktop app)
FROZEN = bool(getattr(sys, 'frozen', False))


def _default_data_dir():
    """
    Where the database and secret key live. Source checkouts keep using ./data;
    packaged apps can't write next to the executable (Program Files, read-only
    .app bundles), so they use the per-user application data directory.
    """
    if os.environ.get('CDN_SCANNER_DATA_DIR'):
        return os.environ['CDN_SCANNER_DATA_DIR']
    if not FROZEN:
        return os.path.join(BASE_DIR, 'data')
    if sys.platform == 'win32':
        root = os.environ.get('APPDATA') or os.path.expanduser('~')
        return os.path.join(root, 'CDN-IP-Scanner')
    if sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Application Support/CDN-IP-Scanner')
    root = os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share')
    return os.path.join(root, 'cdn-ip-scanner')


DATA_DIR = _default_data_dir()
os.makedirs(DATA_DIR, exist_ok=True)

# Database: use DATABASE_URL env var if set, otherwise SQLite (works everywhere)
if os.environ.get('DATABASE_URL'):
    _DEFAULT_DB = os.environ['DATABASE_URL']
else:
    _DEFAULT_DB = 'sqlite:///' + os.path.join(DATA_DIR, 'scanner.db')


def _read_version():
    """Single source of truth for the version: the `version` file in the repo root."""
    try:
        with open(os.path.join(BASE_DIR, 'version'), encoding='utf-8') as f:
            return f.read().strip() or '0'
    except OSError:
        return '0'


def _load_secret_key():
    """Use SECRET_KEY from the environment, otherwise a random key persisted in data/."""
    env_key = os.environ.get('SECRET_KEY')
    if env_key:
        return env_key
    key_file = os.path.join(DATA_DIR, '.secret_key')
    try:
        with open(key_file, encoding='utf-8') as f:
            key = f.read().strip()
            if key:
                return key
    except OSError:
        pass
    key = secrets.token_hex(32)
    try:
        fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(key)
    except OSError:
        pass
    return key


class Config:
    SECRET_KEY = _load_secret_key()
    SQLALCHEMY_DATABASE_URI = _DEFAULT_DB
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    if 'sqlite' in _DEFAULT_DB:
        # Many scan threads write results/logs; wait for the lock instead of failing.
        SQLALCHEMY_ENGINE_OPTIONS = {
            'connect_args': {'timeout': 30, 'check_same_thread': False},
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_recycle': 280,
            'pool_pre_ping': True,
            'pool_size': 10,
            'max_overflow': 20,
        }

    # Optional built-in HTTP basic auth (in addition to / instead of nginx auth)
    APP_USERNAME = os.environ.get('APP_USERNAME', '')
    APP_PASSWORD = os.environ.get('APP_PASSWORD', '')
    AUTH_ENABLED = bool(APP_USERNAME and APP_PASSWORD)

    # Comma-separated list of extra origins allowed for Socket.IO / API calls.
    # Empty = same-origin only.
    CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip()]

    # Allow /api/do-update (git pull + pip install + restart) from the web UI.
    # Packaged apps are updated by downloading a new release instead.
    ALLOW_WEB_UPDATE = (not FROZEN and
                        os.environ.get('ALLOW_WEB_UPDATE', 'true').lower() in ('1', 'true', 'yes'))
    FROZEN = FROZEN
    DATA_DIR = DATA_DIR

    BASE_DIR = BASE_DIR
    APP_NAME = 'CDN IP Scanner'
    VERSION = _read_version()
    AUTHOR = 'shahinst'
    GITHUB_URL = 'https://github.com/shahinst'
    GITHUB_REPO_URL = 'https://github.com/shahinst/cdn-ip-scanner'
    RELEASES_URL = 'https://github.com/shahinst/cdn-ip-scanner/releases/latest'
    WEBSITE_URL = 'https://digicloud.tr'
    YOUTUBE_URL = 'https://www.youtube.com/@shaahinst'
