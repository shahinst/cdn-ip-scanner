"""
CDN IP Scanner - Export scan results as Clash (Mihomo) or sing-box configs
Author: shahinst

Every found IP becomes one proxy built from the user's own V2Ray link (only
the address changes), plus an automatic "fastest" group so the client picks
the best IP by itself.
"""

import json

SUPPORTED = ('clash', 'singbox')


def _link_fields(parsed):
    """Transport/TLS settings of a parsed vless/vmess/trojan link, normalized."""
    p = parsed.get('params') or {}
    vmess = parsed['protocol'] == 'vmess'
    network = ((p.get('net') if vmess else p.get('type')) or 'tcp')
    network = {'raw': 'tcp', 'splithttp': 'xhttp'}.get(network, network)
    security = ((p.get('tls') if vmess else p.get('security')) or 'none')
    if security == 'reality':
        raise ValueError('REALITY configs are not served through a CDN')
    if network not in ('tcp', 'ws', 'grpc', 'httpupgrade'):
        raise ValueError(f'Transport "{network}" is not supported by this export')
    host = p.get('host') or ''
    return {
        'network': network,
        'tls': security == 'tls',
        'host': host,
        'path': p.get('path') or '/',
        'service_name': p.get('serviceName') or p.get('path') or '',
        'sni': p.get('sni') or host,
        'alpn': [a for a in str(p.get('alpn') or '').split(',') if a],
        'fp': p.get('fp') or '',
        'insecure': str(p.get('allowInsecure', p.get('insecure', ''))).lower() in ('1', 'true'),
        'flow': p.get('flow') or '',
        'aid': int(p.get('aid') or 0) if vmess else 0,
        'cipher': p.get('scy') or 'auto',
    }


def _name(parsed, ip):
    base = parsed.get('fragment') or parsed['protocol']
    try:
        from urllib.parse import unquote
        base = unquote(base)
    except Exception:
        pass
    return f'{base} | {ip}'


# ----------------------------------------------------------------- Clash ---

def clash_proxy(parsed, ip):
    f = _link_fields(parsed)
    proto = parsed['protocol']
    proxy = {'name': _name(parsed, ip), 'type': proto, 'server': ip,
             'port': int(parsed['port']), 'udp': True}
    if proto == 'vless':
        proxy['uuid'] = parsed['uuid']
        if f['flow']:
            proxy['flow'] = f['flow']
    elif proto == 'vmess':
        proxy.update({'uuid': parsed['uuid'], 'alterId': f['aid'], 'cipher': f['cipher']})
    else:  # trojan
        proxy['password'] = parsed['uuid']

    if f['tls']:
        proxy['tls'] = True
        proxy['sni' if proto == 'trojan' else 'servername'] = f['sni']
        proxy['skip-cert-verify'] = f['insecure']
        if f['alpn']:
            proxy['alpn'] = f['alpn']
        if f['fp']:
            proxy['client-fingerprint'] = f['fp']

    if f['network'] in ('ws', 'httpupgrade'):
        proxy['network'] = 'ws'
        opts = {'path': f['path']}
        if f['host']:
            opts['headers'] = {'Host': f['host']}
        if f['network'] == 'httpupgrade':
            opts['v2ray-http-upgrade'] = True
        proxy['ws-opts'] = opts
    elif f['network'] == 'grpc':
        proxy['network'] = 'grpc'
        proxy['grpc-opts'] = {'grpc-service-name': f['service_name']}
    return proxy


def clash_config(parsed, ips, test_url):
    proxies = [clash_proxy(parsed, ip) for ip in ips]
    names = [p['name'] for p in proxies]
    config = {
        'mixed-port': 7890,
        'allow-lan': False,
        'mode': 'rule',
        'log-level': 'warning',
        'proxies': proxies,
        'proxy-groups': [
            {'name': 'Auto (fastest IP)', 'type': 'url-test', 'proxies': names,
             'url': test_url, 'interval': 300, 'tolerance': 50},
            {'name': 'PROXY', 'type': 'select', 'proxies': ['Auto (fastest IP)'] + names},
        ],
        'rules': ['MATCH,PROXY'],
    }
    # JSON is valid YAML, so Clash / Mihomo clients load this file as-is.
    return json.dumps(config, indent=2, ensure_ascii=False)


# -------------------------------------------------------------- sing-box ---

def singbox_outbound(parsed, ip):
    f = _link_fields(parsed)
    proto = parsed['protocol']
    out = {'type': proto, 'tag': _name(parsed, ip), 'server': ip, 'server_port': int(parsed['port'])}
    if proto == 'vless':
        out['uuid'] = parsed['uuid']
        if f['flow']:
            out['flow'] = f['flow']
    elif proto == 'vmess':
        out.update({'uuid': parsed['uuid'], 'alter_id': f['aid'], 'security': f['cipher']})
    else:
        out['password'] = parsed['uuid']

    if f['tls']:
        tls = {'enabled': True, 'server_name': f['sni'], 'insecure': f['insecure']}
        if f['alpn']:
            tls['alpn'] = f['alpn']
        if f['fp']:
            tls['utls'] = {'enabled': True, 'fingerprint': f['fp']}
        out['tls'] = tls

    if f['network'] == 'ws':
        transport = {'type': 'ws', 'path': f['path']}
        if f['host']:
            transport['headers'] = {'Host': f['host']}
        out['transport'] = transport
    elif f['network'] == 'httpupgrade':
        out['transport'] = {'type': 'httpupgrade', 'path': f['path'], 'host': f['host']}
    elif f['network'] == 'grpc':
        out['transport'] = {'type': 'grpc', 'service_name': f['service_name']}
    return out


def singbox_config(parsed, ips, test_url):
    outbounds = [singbox_outbound(parsed, ip) for ip in ips]
    tags = [o['tag'] for o in outbounds]
    config = {
        'log': {'level': 'warn'},
        'inbounds': [{'type': 'mixed', 'tag': 'mixed-in', 'listen': '127.0.0.1', 'listen_port': 2080}],
        'outbounds': [
            {'type': 'selector', 'tag': 'proxy', 'outbounds': ['auto'] + tags, 'default': 'auto'},
            {'type': 'urltest', 'tag': 'auto', 'outbounds': tags, 'url': test_url, 'interval': '5m'},
        ] + outbounds + [{'type': 'direct', 'tag': 'direct'}],
        'route': {'final': 'proxy'},
    }
    return json.dumps(config, indent=2, ensure_ascii=False)


def export(parsed, ips, fmt, test_url='https://www.gstatic.com/generate_204'):
    if fmt == 'clash':
        return clash_config(parsed, ips, test_url)
    if fmt == 'singbox':
        return singbox_config(parsed, ips, test_url)
    raise ValueError(f'Unknown format: {fmt}')
