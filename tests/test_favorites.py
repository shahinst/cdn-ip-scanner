from app import monitor


def test_add_list_delete_favorite(client):
    assert client.post('/api/favorites', json={'ip': 'not-an-ip'}).status_code == 400
    r = client.post('/api/favorites', json={'ip': '104.16.1.2', 'port': 8443, 'colo': 'FRA'})
    assert r.status_code == 201
    client.post('/api/favorites', json={'ip': '104.16.1.2', 'port': 443})  # update, not duplicate
    favs = client.get('/api/favorites').get_json()
    assert len(favs) == 1 and favs[0]['port'] == 443 and favs[0]['last_colo'] == 'FRA'
    assert client.delete('/api/favorites/104.16.1.2').status_code == 200
    assert client.get('/api/favorites').get_json() == []
    assert client.delete('/api/favorites/104.16.1.2').status_code == 404


def test_check_favorites_tracks_uptime_and_changes(app, client, http_server, monkeypatch):
    sent = []
    monkeypatch.setattr(monitor, 'send_telegram', lambda text, **kw: (sent.append(text), (True, ''))[1])
    port = http_server({'CF-RAY': '1-FRA'})
    client.post('/api/favorites', json={'ip': '127.0.0.1', 'port': port})
    client.post('/api/favorites', json={'ip': '127.0.0.2', 'port': 1})  # never answers

    r = client.post('/api/favorites/check').get_json()
    by_ip = {f['ip']: f for f in r['favorites']}
    assert by_ip['127.0.0.1']['last_ok'] is True and by_ip['127.0.0.1']['uptime_24h'] == 100.0
    assert by_ip['127.0.0.1']['last_colo'] == 'FRA'
    assert by_ip['127.0.0.2']['last_ok'] is False and by_ip['127.0.0.2']['uptime_24h'] == 0.0
    assert r['went_down'] == [] and sent == []  # first check: no previous state, no alert

    # The working IP goes down -> one alert
    client.post('/api/favorites', json={'ip': '127.0.0.1', 'port': 1})
    r = client.post('/api/favorites/check').get_json()
    assert r['went_down'] == ['127.0.0.1']
    assert len(sent) == 1 and '127.0.0.1' in sent[0]
    fav = {f['ip']: f for f in r['favorites']}['127.0.0.1']
    assert fav['uptime_24h'] == 50.0 and fav['checks_24h'] == 2


def test_send_telegram(app, monkeypatch):
    with app.app_context():
        assert monitor.send_telegram('hi') == (False, 'not configured')

        calls = []

        class Resp:
            status_code = 200
            headers = {'content-type': 'application/json'}

            def json(self):
                return {'ok': True}

        def fake_post(url, json=None, proxies=None, timeout=None):
            calls.append((url, json, proxies))
            return Resp()
        monkeypatch.setattr(monitor.requests, 'post', fake_post)
        assert monitor.send_telegram('hi', token='123:ABC', chat_id='42', proxy='socks5h://127.0.0.1:1') == (True, '')
        url, body, proxies = calls[0]
        assert url.endswith('/bot123:ABC/sendMessage') and body == {'chat_id': '42', 'text': 'hi'}
        assert proxies == {'http': 'socks5h://127.0.0.1:1', 'https': 'socks5h://127.0.0.1:1'}

        def failing_post(url, **kw):
            raise monitor.requests.exceptions.ConnectionError(f'cannot reach {url}')
        monkeypatch.setattr(monitor.requests, 'post', failing_post)
        ok, err = monitor.send_telegram('hi', token='123:SECRET', chat_id='42')
        assert not ok and 'SECRET' not in err  # the token must never leak into error messages


def test_telegram_test_endpoint_needs_settings(client):
    r = client.post('/api/telegram/test', json={})
    assert r.status_code == 400 and r.get_json()['error'] == 'not configured'
