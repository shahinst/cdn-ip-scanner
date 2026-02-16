"""
CDN IP Scanner V2.0 (Linux Edition)
Author: shahinst
GitHub: github.com/shahinst
"""

import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# Configure logging for Linux server
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)

db = SQLAlchemy()
socketio = SocketIO()


def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    if config_override:
        app.config.update(config_override)

    db.init_app(app)

    # gevent for proper WebSocket + HTTP serving
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent',
                      logger=False, engineio_logger=False)

    from app.routes.main import main_bp
    from app.routes.api import api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    with app.app_context():
        try:
            db.create_all()
            logging.getLogger(__name__).info("Database initialized successfully")
        except Exception as e:
            logging.getLogger(__name__).warning(
                "Database init failed (app will still start): %s", e
            )

    return app
