import json

import pytest

from app.routes import api
from app.scanner import client_export
from app.scanner.v2ray import V2RayConfigParser

UUID = '11111111-2222-3333-4444-555555555555'
VLESS_WS_TLS = (f'vless://{UUID}@1.1.1.1:443?encryption=none&security=tls&sni=sni.example.com&fp=chrome'
                '&alpn=h2,http/1.1&type=ws&host=host.example.com&path=%2Fws#My%20Server')


def test_clash_vless_ws_tls():
    proxy = client_export.clash_proxy(V2RayConfigParser.parse(VLESS_WS_TLS), '104.16.1.2')
    assert proxy['name'] == 'My Server | 104.16.1.2'
    assert proxy['type'] == 'vless' and proxy['server'] == '104.16.1.2' and proxy['port'] == 443
    assert proxy['uuid'] == UUID and proxy['tls'] is True and proxy['servername'] == 'sni.example.com'
    assert proxy['client-fingerprint'] == 'chrome' and proxy['alpn'] == ['h2', 'http/1.1']
    assert proxy['network'] == 'ws'
    assert proxy['ws-opts'] == {'path': '/ws', 'headers': {'Host': 'host.example.com'}}


def test_singbox_trojan_grpc_and_httpupgrade():
    trojan = V2RayConfigParser.parse('trojan://pw@1.1.1.1:2053?security=tls&type=grpc&serviceName=svc&sni=a.example.com#t')
    out = client_export.singbox_outbound(trojan, '9.9.9.9')
    assert out['type'] == 'trojan' and out['password'] == 'pw' and out['server_port'] == 2053
    assert out['transport'] == {'type': 'grpc', 'service_name': 'svc'}
    assert out['tls']['server_name'] == 'a.example.com'
    hu = V2RayConfigParser.parse(f'vless://{UUID}@1.1.1.1:80?security=none&type=httpupgrade&host=h.example.com&path=%2Fu#x')
    out = client_export.singbox_outbound(hu, '8.8.8.8')
    assert out['transport'] == {'type': 'httpupgrade', 'path': '/u', 'host': 'h.example.com'} and 'tls' not in out
    clash = client_export.clash_proxy(hu, '8.8.8.8')
    assert clash['ws-opts']['v2ray-http-upgrade'] is True


def test_full_configs_group_all_ips():
    parsed = V2RayConfigParser.parse(VLESS_WS_TLS)
    clash = json.loads(client_export.export(parsed, ['1.0.0.1', '1.0.0.2'], 'clash'))
    assert [p['server'] for p in clash['proxies']] == ['1.0.0.1', '1.0.0.2']
    auto = clash['proxy-groups'][0]
    assert auto['type'] == 'url-test' and len(auto['proxies']) == 2
    sb = json.loads(client_export.export(parsed, ['1.0.0.1', '1.0.0.2'], 'singbox'))
    tags = [o['tag'] for o in sb['outbounds']]
    assert 'auto' in tags and 'proxy' in tags and sb['route']['final'] == 'proxy'


def test_unsupported_transports_are_rejected():
    for link in (f'vless://{UUID}@1.1.1.1:443?security=reality&pbk=x&type=tcp#r',
                 f'vless://{UUID}@1.1.1.1:443?security=tls&type=xhttp#x'):
        with pytest.raises(ValueError):
            client_export.export(V2RayConfigParser.parse(link), ['1.1.1.1'], 'clash')


def test_export_endpoint(client, http_server, monkeypatch):
    monkeypatch.setattr(api, '_scan_thread', None)
    port = http_server({'CF-RAY': '1-FRA'})
    config = f'vless://{UUID}@1.1.1.1:{port}?security=none&type=ws&host=example.com&path=%2Fws#Mine'
    sid = client.post('/api/scan/start', json={
        'ranges': ['127.0.0.1'], 'ports': str(port), 'target_count': '1',
        'scan_method': 'v2ray', 'v2ray_config': config,
    }).get_json()['session_id']
    api._scan_thread.join(timeout=30)

    r = client.get(f'/api/v2ray/export/{sid}?format=clash')
    assert r.status_code == 200 and 'clash-' in r.headers['Content-Disposition']
    assert json.loads(r.data)['proxies'][0]['server'] == '127.0.0.1'
    r = client.get(f'/api/v2ray/export/{sid}?format=singbox')
    assert r.status_code == 200
    assert any(o.get('server') == '127.0.0.1' for o in json.loads(r.data)['outbounds'])
    assert client.get(f'/api/v2ray/export/{sid}?format=other').status_code == 400
    assert client.get('/api/v2ray/export/9999?format=clash').status_code == 404
