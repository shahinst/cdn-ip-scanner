from app.scanner.v2ray import V2RayConfigParser

VLESS = 'vless://uuid-1234@1.2.3.4:443?encryption=none&security=tls&sni=example.com&type=ws&host=example.com#My%20Server'


def test_vless_parse_and_rebuild():
    parsed = V2RayConfigParser.parse(VLESS)
    assert parsed['protocol'] == 'vless'
    assert parsed['ip'] == '1.2.3.4' and parsed['port'] == 443
    assert parsed['params']['sni'] == 'example.com'
    rebuilt = V2RayConfigParser.rebuild_config(parsed, '5.6.7.8')
    reparsed = V2RayConfigParser.parse(rebuilt)
    assert reparsed['ip'] == '5.6.7.8'
    assert reparsed['params'] == parsed['params']
    assert reparsed['fragment'] == parsed['fragment']


def test_vmess_roundtrip():
    import base64, json
    cfg = 'vmess://' + base64.b64encode(json.dumps({'add': '1.2.3.4', 'port': '8443', 'id': 'u', 'tls': 'tls'}).encode()).decode()
    parsed = V2RayConfigParser.parse(cfg)
    assert parsed['port'] == 8443
    assert V2RayConfigParser.parse(V2RayConfigParser.rebuild_config(parsed, '9.9.9.9'))['ip'] == '9.9.9.9'


def test_invalid_config():
    assert V2RayConfigParser.parse('ss://whatever') is None
    assert V2RayConfigParser.parse('') is None


def test_parse_http_response():
    status, headers, body = V2RayConfigParser._parse_http_response(
        'HTTP/1.1 200 OK\r\nCF-RAY: x\r\nServer: cloudflare\r\n\r\nfl=1')
    assert status == 200 and headers['cf-ray'] == 'x' and body == 'fl=1'
    assert V2RayConfigParser._parse_http_response('garbage')[0] is None


def _plain_config(port):
    return V2RayConfigParser.parse(f'vless://u@1.2.3.4:{port}?security=none&type=ws&host=example.com')


def test_ip_requires_cdn_response(http_server):
    cdn_port = http_server({'CF-RAY': '1-FRA'})
    plain_port = http_server({'Server': 'nginx'})
    ok, latency = V2RayConfigParser.test_ip_with_config(_plain_config(cdn_port), '127.0.0.1', timeout=3)
    assert ok and latency is not None
    ok, _ = V2RayConfigParser.test_ip_with_config(_plain_config(plain_port), '127.0.0.1', timeout=3)
    assert not ok
