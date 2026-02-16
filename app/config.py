"""
SH IP Scanner V2.0 - Configuration (Linux Edition)
Author: shahinst

Linux-optimized: defaults to SQLite (no external DB required).
Supports MySQL/MariaDB via DATABASE_URL env var.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Database: use DATABASE_URL env var if set, otherwise SQLite (works everywhere)
if os.environ.get('DATABASE_URL'):
    _DEFAULT_DB = os.environ['DATABASE_URL']
else:
    _db_path = os.path.join(BASE_DIR, 'data', 'scanner.db')
    os.makedirs(os.path.dirname(_db_path), exist_ok=True)
    _DEFAULT_DB = 'sqlite:///' + _db_path


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sh-scanner-v2-secret-key-change-me')
    SQLALCHEMY_DATABASE_URI = _DEFAULT_DB
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Engine options only for MySQL/MariaDB (SQLite doesn't support pool options)
    if 'sqlite' not in _DEFAULT_DB:
        SQLALCHEMY_ENGINE_OPTIONS = {
            'pool_recycle': 280,
            'pool_pre_ping': True,
            'pool_size': 10,
            'max_overflow': 20,
        }

    BASE_DIR = BASE_DIR
    APP_NAME = 'CDN IP Scanner'
    VERSION = '2.0'
    AUTHOR = 'shahinst'
    GITHUB_URL = 'https://github.com/shahinst'
    GITHUB_REPO_URL = 'https://github.com/shahinst/cdn-ip-scanner'
    WEBSITE_URL = 'https://digicloud.tr'
    YOUTUBE_URL = 'https://www.youtube.com/@shaahinst'
