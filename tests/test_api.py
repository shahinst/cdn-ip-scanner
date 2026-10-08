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


def _wait_scan():
    api._scan_thread.join(timeout=30)
    assert not api._scan_thread.is_alive()


def test_scan_reports_colo_and_speed(client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    port = http_server({'CF-RAY': '1-FRA'})
    r = client.post('/api/scan/start', json={
        'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1',
        'speed_test': True, 'speed_test_size': '128',
        'speed_test_url': f'http://speed.example:{port}/__down?bytes={{bytes}}',
    })
    assert r.status_code == 200
    _wait_scan()
    results = client.get('/api/scan/results').get_json()
    assert results[0]['colo'] == 'FRA'
    assert results[0]['speed'] and results[0]['speed'] > 0


def test_v2ray_subscription_and_qr(client, http_server, monkeypatch):
    import base64
    monkeypatch.setattr(api, '_scan_thread', None)
    port = http_server({'CF-RAY': '1-FRA'})
    config = f'vless://uuid@1.1.1.1:{port}?security=none&type=ws&host=example.com#Mine'
    r = client.post('/api/scan/start', json={
        'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1',
        'scan_method': 'v2ray', 'v2ray_config': config,
    })
    session_id = r.get_json()['session_id']
    _wait_scan()

    plain = client.get(f'/api/v2ray/subscription/{session_id}?format=plain').get_data(as_text=True)
    assert plain.startswith(f'vless://uuid@127.0.0.1:{port}?') and plain.endswith('#Mine%20%7C%20127.0.0.1')
    encoded = client.get(f'/api/v2ray/subscription/{session_id}').get_data(as_text=True)
    assert base64.b64decode(encoded).decode() == plain
    assert client.get('/api/v2ray/subscription/9999').status_code == 404

    qr = client.post('/api/v2ray/qr', json={'config': config, 'ip': '1.2.3.4'})
    assert qr.status_code == 200 and qr.mimetype == 'image/svg+xml' and b'<svg' in qr.data
    assert client.post('/api/v2ray/qr', json={'config': 'bad', 'ip': '1.2.3.4'}).status_code == 400


def test_old_database_is_migrated(tmp_path):
    import sqlite3
    from app import create_app
    db_file = tmp_path / 'old.db'
    con = sqlite3.connect(db_file)
    con.execute('CREATE TABLE scan_sessions (id INTEGER PRIMARY KEY, mode VARCHAR(50))')
    con.execute('CREATE TABLE scan_results (id INTEGER PRIMARY KEY, ip VARCHAR(45) NOT NULL, '
                'scan_session_id INTEGER, score FLOAT)')
    con.commit()
    con.close()
    create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_file}'})
    con = sqlite3.connect(db_file)
    cols = {row[1] for row in con.execute('PRAGMA table_info(scan_results)')}
    assert {'colo', 'speed'} <= cols
    assert 'v2ray_config' in {row[1] for row in con.execute('PRAGMA table_info(scan_sessions)')}
    con.close()


def test_csv_export_and_colo_name(client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    port = http_server({'CF-RAY': '1-FRA'})
    client.post('/api/scan/start', json={'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1'})
    _wait_scan()
    results = client.get('/api/scan/results').get_json()
    assert results[0]['colo_name'] == 'Frankfurt, DE' and results[0]['alive'] is True
    r = client.get('/api/export/csv')
    assert r.status_code == 200 and 'scan_results.csv' in r.headers['Content-Disposition']
    text = r.data.decode('utf-8-sig')
    assert text.splitlines()[0].startswith('#,IP,Ping')
    assert '127.0.0.1' in text and 'FRA (Frankfurt, DE)' in text and text.rstrip().endswith('yes')


def test_retest_marks_dead_ips(client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    monkeypatch.setattr(api, '_retest_thread', None)
    port = http_server({'CF-RAY': '1-AMS'})
    sid = client.post('/api/scan/start', json={
        'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1',
    }).get_json()['session_id']
    _wait_scan()
    assert client.post('/api/scan/retest', json={'session_id': 9999}).status_code == 404

    # The IP still answers: it stays alive
    r = client.post('/api/scan/retest', json={'session_id': sid})
    assert r.status_code == 200 and r.get_json()['count'] == 1
    api._retest_thread.join(timeout=30)
    res = client.get('/api/scan/results').get_json()[0]
    assert res['alive'] is True and res['score'] > 0

    # The IP stopped answering: alive=false, score 0
    monkeypatch.setattr(api.SHScanner, 'check', lambda self, ip, ports: None)
    assert client.post('/api/scan/retest', json={'session_id': sid}).status_code == 200
    api._retest_thread.join(timeout=30)
    res = client.get('/api/scan/results').get_json()[0]
    assert res['alive'] is False and res['score'] == 0
    assert 'no' in client.get('/api/export/csv').data.decode('utf-8-sig').splitlines()[1].split(',')[-1]


def test_scan_summary_is_sent_to_telegram(client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    sent = []
    from app import monitor
    monkeypatch.setattr(monitor, 'send_telegram', lambda text, **kw: sent.append(text) or (True, ''))
    client.post('/api/settings', json={'notify_scan_complete': 'true'})
    port = http_server({'CF-RAY': '1-IST'})
    client.post('/api/scan/start', json={'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1'})
    _wait_scan()
    assert len(sent) == 1 and '127.0.0.1' in sent[0] and 'IST' in sent[0]
