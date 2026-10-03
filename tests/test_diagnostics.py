import json


def test_report_has_no_secrets(client):
    client.post('/api/settings', json={
        'telegram_token': '123456:SUPERSECRET', 'telegram_chat_id': '42',
        'telegram_proxy': 'socks5h://user:hunter2@127.0.0.1:1080', 'theme': 'dark',
    })
    r = client.get('/api/diagnostics')
    assert r.status_code == 200 and 'attachment' in r.headers['Content-Disposition']
    text = r.get_data(as_text=True)
    assert 'SUPERSECRET' not in text and 'hunter2' not in text
    report = json.loads(text)
    assert report['settings']['telegram_token'] == '***'
    assert report['settings']['telegram_proxy'] == 'socks5h://***@127.0.0.1:1080'
    assert report['settings']['theme'] == 'dark'
    assert report['app']['version'] and report['system']['python']
    assert 'xray' in report and 'scan_log' in report
