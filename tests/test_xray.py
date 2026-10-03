import json
import os
import subprocess
import tempfile
import time

import pytest

from app.scanner import xray as xray_mod
from app.scanner.v2ray import V2RayConfigParser
from app.scanner.xray import XrayRealTester, build_config, build_outbound

UUID = '11111111-2222-3333-4444-555555555555'


def test_vless_ws_tls_outbound():
    parsed = V2RayConfigParser.parse(
        f'vless://{UUID}@1.1.1.1:443?encryption=none&security=tls&sni=sni.example.com&fp=chrome'
        '&alpn=h2,http/1.1&type=ws&host=host.example.com&path=%2Fws%3Fed%3D2048#x')
    out = build_outbound(parsed, '104.16.1.2', 'o')
    assert out['settings']['vnext'][0]['address'] == '104.16.1.2'
    assert out['settings']['vnext'][0]['users'][0]['id'] == UUID
    stream = out['streamSettings']
    assert stream['network'] == 'ws' and stream['wsSettings'] == {'path': '/ws?ed=2048', 'host': 'host.example.com'}
    assert stream['tlsSettings']['serverName'] == 'sni.example.com'
    assert stream['tlsSettings']['alpn'] == ['h2', 'http/1.1'] and stream['tlsSettings']['fingerprint'] == 'chrome'


def test_vmess_grpc_and_trojan_outbounds():
    import base64
    vmess = 'vmess://' + base64.b64encode(json.dumps({
        'v': '2', 'add': '1.1.1.1', 'port': '2053', 'id': UUID, 'aid': '0', 'net': 'grpc',
        'path': 'svc', 'tls': 'tls', 'sni': 'a.example.com'}).encode()).decode()
    out = build_outbound(V2RayConfigParser.parse(vmess), '9.9.9.9', 'o')
    assert out['protocol'] == 'vmess' and out['settings']['vnext'][0]['port'] == 2053
    assert out['streamSettings']['grpcSettings']['serviceName'] == 'svc'
    trojan = V2RayConfigParser.parse('trojan://secret@1.1.1.1:443?security=tls&type=ws&path=%2Ft&sni=b.example.com#t')
    out = build_outbound(trojan, '8.8.8.8', 'o')
    assert out['settings']['servers'][0] == {'address': '8.8.8.8', 'port': 443, 'password': 'secret'}


def test_reality_is_rejected():
    parsed = V2RayConfigParser.parse(f'vless://{UUID}@1.1.1.1:443?security=reality&pbk=x&type=tcp#r')
    with pytest.raises(ValueError):
        build_outbound(parsed, '1.1.1.1', 'o')


def test_build_config_routes_each_inbound_to_its_ip():
    parsed = V2RayConfigParser.parse(f'vless://{UUID}@1.1.1.1:443?security=none&type=ws#x')
    cfg = build_config(parsed, [('1.0.0.1', 30001), ('1.0.0.2', 30002)])
    assert [i['port'] for i in cfg['inbounds']] == [30001, 30002]
    assert cfg['outbounds'][1]['settings']['vnext'][0]['address'] == '1.0.0.2'
    assert cfg['routing']['rules'][1] == {'type': 'field', 'inboundTag': ['in1'], 'outboundTag': 'out1'}


@pytest.fixture
def xray_path():
    path = xray_mod.find_xray()
    if not path:
        pytest.skip('Xray-core not installed (set XRAY_PATH)')
    return path


def test_real_test_end_to_end(xray_path, http_server):
    """A local VLESS+WS 'server' stands in for the CDN; only its IP carries traffic."""
    target_port = http_server({'CF-RAY': '1-FRA'})
    server_cfg = {
        'log': {'loglevel': 'warning'},
        'inbounds': [{'listen': '127.0.0.1', 'port': 0, 'protocol': 'vless',
                      'settings': {'clients': [{'id': UUID}], 'decryption': 'none'},
                      'streamSettings': {'network': 'ws', 'wsSettings': {'path': '/ws'}}}],
        'outbounds': [{'protocol': 'freedom'}],
    }
    server_port = xray_mod._free_ports(1)[0]
    server_cfg['inbounds'][0]['port'] = server_port
    fd, cfg = tempfile.mkstemp(suffix='.json')
    with os.fdopen(fd, 'w') as f:
        json.dump(server_cfg, f)
    server = subprocess.Popen([xray_path, 'run', '-c', cfg],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.time() + 10
        while time.time() < deadline:
            try:
                __import__('socket').create_connection(('127.0.0.1', server_port), 0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        link = f'vless://{UUID}@1.2.3.4:{server_port}?encryption=none&security=none&type=ws&path=%2Fws#t'
        tester = XrayRealTester(xray_path, test_url=f'http://127.0.0.1:{target_port}/cdn-cgi/trace',
                                timeout=5, batch_size=2)
        results = tester.test(V2RayConfigParser.parse(link), ['127.0.0.1', '127.0.0.2', '127.0.0.3'])
        assert results['127.0.0.1'] is not None and results['127.0.0.1'] > 0
        assert results['127.0.0.2'] is None and results['127.0.0.3'] is None

        wrong_user = link.replace(UUID, '99999999-2222-3333-4444-555555555555')
        assert tester.test(V2RayConfigParser.parse(wrong_user), ['127.0.0.1']) == {'127.0.0.1': None}
    finally:
        server.terminate()
        server.wait(timeout=10)
        os.remove(cfg)
