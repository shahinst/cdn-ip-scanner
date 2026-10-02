"""
CDN IP Scanner V2.0 - Configuration (Linux Edition)
Author: shahinst

Linux-optimized: defaults to SQLite (no external DB required).
Supports MySQL/MariaDB via DATABASE_URL env var.
"""

import os
import secrets

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
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
    ALLOW_WEB_UPDATE = os.environ.get('ALLOW_WEB_UPDATE', 'true').lower() in ('1', 'true', 'yes')

    BASE_DIR = BASE_DIR
    APP_NAME = 'CDN IP Scanner'
    VERSION = _read_version()
    AUTHOR = 'shahinst'
    GITHUB_URL = 'https://github.com/shahinst'
    GITHUB_REPO_URL = 'https://github.com/shahinst/cdn-ip-scanner'
    WEBSITE_URL = 'https://digicloud.tr'
    YOUTUBE_URL = 'https://www.youtube.com/@shaahinst'
