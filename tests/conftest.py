import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _make_handler(headers):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = b'fl=1\nh=www.cloudflare.com\ncolo=FRA\n' if 'cf-ray' in headers else b'hello'
            self.send_response(200)
            for k, v in headers.items():
                self.send_header(k, v)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass
    return Handler


@pytest.fixture
def http_server():
    """Start a local HTTP server with the given response headers; yields its port."""
    servers = []

    def start(headers):
        srv = ThreadingHTTPServer(('127.0.0.1', 0), _make_handler(headers))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        servers.append(srv)
        return srv.server_address[1]

    yield start
    for srv in servers:
        srv.shutdown()
        srv.server_close()


@pytest.fixture
def app(tmp_path):
    from app import create_app, db
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + str(tmp_path / 'test.db'),
    })
    yield app
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()
