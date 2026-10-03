import json

from app import create_app, db
from app.models import ScanResult, ScanSession
from app.routes import api


def _interrupted_session(app, ranges, port, found_ip=None, status='interrupted'):
    with app.app_context():
        sess = ScanSession(mode='hyper', scan_method='cloud', status=status, total_scanned=5,
                           params=json.dumps({'ranges': ranges, 'ports': str(port), 'target_count': '3'}))
        db.session.add(sess)
        db.session.commit()
        if found_ip:
            db.session.add(ScanResult(ip=found_ip, ping=10, open_ports='[]', score=50, scan_session_id=sess.id))
            db.session.commit()
        return sess.id


def test_running_scans_become_interrupted_on_startup(tmp_path):
    uri = 'sqlite:///' + str(tmp_path / 'r.db')
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': uri})
    with app.app_context():
        db.session.add(ScanSession(status='running', params='{}'))
        db.session.commit()
    app2 = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': uri})
    with app2.app_context():
        assert ScanSession.query.one().status == 'interrupted'
        db.session.remove()
        db.engine.dispose()


def test_resume_continues_the_same_session(app, client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    port = http_server({'CF-RAY': '1-FRA'})
    sid = _interrupted_session(app, ['127.0.0.1'], port, found_ip='127.0.0.1')

    info = client.get('/api/scan/resumable').get_json()
    assert info['resumable'] and info['session_id'] == sid and info['found'] == 1

    r = client.post('/api/scan/resume', json={'session_id': sid})
    assert r.status_code == 200 and r.get_json()['session_id'] == sid
    api._scan_thread.join(timeout=30)

    with app.app_context():
        sess = db.session.get(ScanSession, sid)
        assert sess.status == 'completed'
        assert sess.total_scanned >= 5  # continues counting from where it stopped
        # the IP found before the interruption is not added twice
        assert ScanResult.query.filter_by(scan_session_id=sid, ip='127.0.0.1').count() == 1
    assert client.get('/api/scan/resumable').get_json() == {'resumable': False}


def test_resume_rules(app, client, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    old = _interrupted_session(app, ['10.0.0.0/24'], 443, status='stopped')
    assert client.get('/api/scan/resumable').get_json()['session_id'] == old
    assert client.post('/api/scan/resume', json={'session_id': old + 99}).status_code == 404

    # a newer scan supersedes the old one
    _interrupted_session(app, ['10.0.1.0/24'], 443, status='completed')
    assert client.get('/api/scan/resumable').get_json() == {'resumable': False}


def test_discard(app, client):
    _interrupted_session(app, ['10.0.0.0/24'], 443)
    assert client.get('/api/scan/resumable').get_json()['resumable']
    client.post('/api/scan/discard-resume')
    assert client.get('/api/scan/resumable').get_json() == {'resumable': False}


def test_new_scans_store_their_params(app, client, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    sid = client.post('/api/scan/start', json={'ranges': ['127.0.0.1'], 'ports': '1', 'target_count': '5'}).get_json()['session_id']
    api._scan_thread.join(timeout=30)
    with app.app_context():
        params = json.loads(db.session.get(ScanSession, sid).params)
    assert params['ranges'] == ['127.0.0.1'] and params['ports'] == '1' and 'v2ray_config' not in params
