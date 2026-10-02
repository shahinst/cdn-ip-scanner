import threading

from app.routes import api


def test_settings_roundtrip_ignores_unknown_keys(client):
    assert client.post('/api/settings', json={'theme': 'dark', 'evil': 'x'}).status_code == 200
    data = client.get('/api/settings').get_json()
    assert data['theme'] == 'dark'
    assert 'evil' not in data


def test_cross_origin_post_is_rejected(client):
    r = client.post('/api/reset', headers={'Origin': 'https://evil.example'})
    assert r.status_code == 403
    r = client.post('/api/reset', headers={'Origin': 'http://localhost'})
    assert r.status_code == 200


def test_basic_auth_when_configured(tmp_path):
    from app import create_app
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + str(tmp_path / 'auth.db'),
        'APP_USERNAME': 'admin', 'APP_PASSWORD': 'secret',
    })
    c = app.test_client()
    assert c.get('/api/info').status_code == 401
    import base64
    token = base64.b64encode(b'admin:secret').decode()
    assert c.get('/api/info', headers={'Authorization': 'Basic ' + token}).status_code == 200
    assert c.get('/static/css/style.css').status_code == 200


def test_version_comes_from_version_file(client):
    import os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, 'version')) as f:
        assert client.get('/api/info').get_json()['version'] == f.read().strip()


def test_second_scan_is_rejected_while_running(client, monkeypatch):
    blocker = threading.Event()
    t = threading.Thread(target=blocker.wait, daemon=True)
    t.start()
    monkeypatch.setattr(api, '_scan_thread', t)
    try:
        assert client.post('/api/scan/start', json={'ranges': []}).status_code == 409
        assert client.post('/api/reset').status_code == 409
        assert client.post('/api/do-update').status_code == 409
    finally:
        blocker.set()
        t.join()


def test_invalid_numbers_do_not_crash_scan_start(client, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    r = client.post('/api/scan/start', json={
        'ranges': [], 'scan_method': 'cloud', 'ping_min': 'abc', 'ping_max': '', 'target_count': 'x',
    })
    assert r.status_code == 200
    api._scan_thread.join(timeout=10)
    sessions = client.get('/api/scan/sessions').get_json()
    assert sessions[0]['status'] == 'completed'


def test_web_update_can_be_disabled(app, client):
    app.config['ALLOW_WEB_UPDATE'] = False
    assert client.post('/api/do-update').status_code == 403


def test_results_limit_is_clamped(client):
    assert client.get('/api/scan/results?limit=-5').status_code == 200


def test_scan_ends_when_small_ranges_are_exhausted(client, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    # Nothing listens on port 1, target is never reached: the scan must still finish.
    r = client.post('/api/scan/start', json={'ranges': ['127.0.0.1'], 'ports': '1', 'target_count': '5'})
    assert r.status_code == 200
    api._scan_thread.join(timeout=15)
    assert not api._scan_thread.is_alive()
    session = client.get('/api/scan/sessions').get_json()[0]
    assert session['status'] == 'completed' and session['total_scanned'] == 1
