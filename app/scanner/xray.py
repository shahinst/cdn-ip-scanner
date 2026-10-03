"""
CDN IP Scanner - Real connection test through Xray-core
Author: shahinst

The CDN check only proves that a CDN edge answers on an IP. This module goes
one step further: it starts Xray-core with the user's own V2Ray config, pointed
at each candidate IP, and fetches a test URL *through the tunnel*. Only IPs
that carry real traffic pass ("real delay", like v2rayN's real-delay test).

One Xray process tests a batch of IPs at once: every IP gets its own local
SOCKS inbound that is routed to an outbound using that IP.
"""

import hashlib
import io
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor

import requests

XRAY_VERSION = '26.3.27'
DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204'
_RELEASE_URL = 'https://github.com/XTLS/Xray-core/releases/download/v{version}/{asset}'
_ASSETS = {
    ('windows', 'x64'): 'Xray-windows-64.zip',
    ('windows', 'arm64'): 'Xray-windows-arm64-v8a.zip',
    ('macos', 'x64'): 'Xray-macos-64.zip',
    ('macos', 'arm64'): 'Xray-macos-arm64-v8a.zip',
    ('linux', 'x64'): 'Xray-linux-64.zip',
    ('linux', 'arm64'): 'Xray-linux-arm64-v8a.zip',
}
_EXE = 'xray.exe' if sys.platform == 'win32' else 'xray'


# ---------------------------------------------------------------------------
# Locating / installing the binary
# ---------------------------------------------------------------------------

def _data_bin_dir():
    from app.config import DATA_DIR
    return os.path.join(DATA_DIR, 'bin')


def find_xray():
    """Path of the Xray binary, or None. Order: $XRAY_PATH, bundled, data/bin, PATH."""
    candidates = []
    if os.environ.get('XRAY_PATH'):
        candidates.append(os.environ['XRAY_PATH'])
    bundle = getattr(sys, '_MEIPASS', None)
    if bundle:
        candidates.append(os.path.join(bundle, 'bin', _EXE))
    candidates.append(os.path.join(_data_bin_dir(), _EXE))
    which = shutil.which('xray')
    if which:
        candidates.append(which)
    for path in candidates:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def xray_version(path):
    try:
        out = subprocess.run([path, 'version'], capture_output=True, text=True, timeout=10,
                             **_no_window()).stdout
        return ' '.join(out.split()[:2])  # e.g. 'Xray 26.3.27'
    except (OSError, subprocess.SubprocessError):
        return ''


def platform_key():
    machine = platform.machine().lower()
    arch = 'arm64' if machine in ('arm64', 'aarch64') else 'x64'
    osname = {'win32': 'windows', 'darwin': 'macos'}.get(sys.platform, 'linux')
    return osname, arch


def install_xray(dest_dir=None, version=XRAY_VERSION, key=None, timeout=120):
    """
    Download the official Xray-core release for this platform into `dest_dir`
    (default: <data dir>/bin), verifying the SHA-256 published with the release.
    Returns the path of the binary.
    """
    dest_dir = dest_dir or _data_bin_dir()
    key = key or platform_key()
    asset = _ASSETS.get(key)
    if not asset:
        raise RuntimeError(f'No Xray build for {key[0]}-{key[1]}')
    url = _RELEASE_URL.format(version=version, asset=asset)

    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    data = resp.content
    resp = requests.get(url + '.dgst', timeout=30)
    resp.raise_for_status()
    digest = resp.text
    expected = ''
    for line in digest.splitlines():
        if line.startswith('SHA2-256='):
            expected = line.split('=', 1)[1].strip().lower()
    if not expected or hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError('Xray download failed checksum verification')

    os.makedirs(dest_dir, exist_ok=True)
    exe = 'xray.exe' if key[0] == 'windows' else 'xray'
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        target = os.path.join(dest_dir, exe)
        with zf.open(exe) as src, open(target, 'wb') as dst:
            shutil.copyfileobj(src, dst)
    os.chmod(target, 0o755)
    return target


def _no_window():
    return {'creationflags': 0x08000000} if sys.platform == 'win32' else {}  # CREATE_NO_WINDOW


# ---------------------------------------------------------------------------
# Config generation
# ---------------------------------------------------------------------------

def _truthy(value):
    return str(value).lower() in ('1', 'true', 'yes')


def build_stream_settings(parsed):
    """streamSettings for a parsed vless/vmess/trojan link."""
    p = parsed.get('params') or {}
    vmess = parsed['protocol'] == 'vmess'
    network = (p.get('net') if vmess else p.get('type')) or 'tcp'
    network = {'splithttp': 'xhttp', 'raw': 'tcp'}.get(network, network)
    security = (p.get('tls') if vmess else p.get('security')) or 'none'
    if security == 'reality':
        raise ValueError('REALITY configs are not served through a CDN and cannot be IP-scanned')

    host = p.get('host') or ''
    path = p.get('path') or '/'
    stream = {'network': network, 'security': 'tls' if security == 'tls' else 'none'}

    if network == 'ws':
        stream['wsSettings'] = {'path': path, 'host': host}
    elif network == 'grpc':
        stream['grpcSettings'] = {'serviceName': p.get('serviceName') or p.get('path') or '',
                                  'multiMode': p.get('mode') == 'multi'}
    elif network == 'httpupgrade':
        stream['httpupgradeSettings'] = {'path': path, 'host': host}
    elif network == 'xhttp':
        stream['xhttpSettings'] = {'path': path, 'host': host, 'mode': p.get('mode') or 'auto'}
    elif network != 'tcp':
        raise ValueError(f'Unsupported transport: {network}')

    if security == 'tls':
        tls = {'serverName': p.get('sni') or host or parsed.get('ip', ''),
               'allowInsecure': _truthy(p.get('allowInsecure', p.get('insecure', '')))}
        if p.get('alpn'):
            tls['alpn'] = [a for a in str(p['alpn']).split(',') if a]
        if p.get('fp'):
            tls['fingerprint'] = p['fp']
        stream['tlsSettings'] = tls
    return stream


def build_outbound(parsed, ip, tag):
    """Xray outbound that connects to `ip` with everything else taken from the link."""
    proto = parsed['protocol']
    p = parsed.get('params') or {}
    port = int(parsed['port'])
    if proto == 'vless':
        user = {'id': parsed['uuid'], 'encryption': p.get('encryption') or 'none'}
        if p.get('flow'):
            user['flow'] = p['flow']
        settings = {'vnext': [{'address': ip, 'port': port, 'users': [user]}]}
    elif proto == 'vmess':
        settings = {'vnext': [{'address': ip, 'port': port, 'users': [{
            'id': parsed['uuid'], 'alterId': int(p.get('aid') or 0),
            'security': p.get('scy') or 'auto'}]}]}
    elif proto == 'trojan':
        settings = {'servers': [{'address': ip, 'port': port, 'password': parsed['uuid']}]}
    else:
        raise ValueError(f'Unsupported protocol: {proto}')
    return {'tag': tag, 'protocol': proto, 'settings': settings,
            'streamSettings': build_stream_settings(parsed)}


def build_config(parsed, ip_ports):
    """
    Full Xray config: one SOCKS inbound per (ip, local_port), each routed to an
    outbound that uses that IP.
    """
    inbounds, outbounds, rules = [], [], []
    for i, (ip, port) in enumerate(ip_ports):
        inbounds.append({'tag': f'in{i}', 'listen': '127.0.0.1', 'port': port, 'protocol': 'socks',
                         'settings': {'auth': 'noauth', 'udp': False}})
        outbounds.append(build_outbound(parsed, ip, f'out{i}'))
        rules.append({'type': 'field', 'inboundTag': [f'in{i}'], 'outboundTag': f'out{i}'})
    return {'log': {'loglevel': 'warning'}, 'inbounds': inbounds, 'outbounds': outbounds,
            'routing': {'rules': rules}}


# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------

def _free_ports(n):
    socks, ports = [], []
    try:
        for _ in range(n):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('127.0.0.1', 0))
            socks.append(s)
            ports.append(s.getsockname()[1])
    finally:
        for s in socks:
            s.close()
    return ports


def _wait_listening(ports, proc, timeout):
    deadline = time.time() + timeout
    pending = set(ports)
    while pending and time.time() < deadline:
        if proc.poll() is not None:
            return False
        for port in list(pending):
            try:
                socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
                pending.discard(port)
            except OSError:
                pass
        if pending:
            time.sleep(0.1)
    return not pending


def _fetch_through(port, url, timeout):
    """Delay in ms of a GET through the local SOCKS port, or None on failure."""
    session = requests.Session()
    session.trust_env = False  # never let system/env proxies or NO_PROXY bypass the tunnel
    proxies = {'http': f'socks5h://127.0.0.1:{port}', 'https': f'socks5h://127.0.0.1:{port}'}
    try:
        start = time.time()
        r = session.get(url, proxies=proxies, timeout=timeout, allow_redirects=False)
        if r.status_code >= 400:
            return None
        return round((time.time() - start) * 1000, 1)
    except requests.exceptions.RequestException:
        return None
    finally:
        session.close()


class XrayRealTester:
    def __init__(self, xray_path, test_url=DEFAULT_TEST_URL, timeout=10.0, batch_size=10, log=None):
        self.xray_path = xray_path
        self.test_url = test_url or DEFAULT_TEST_URL
        self.timeout = timeout
        self.batch_size = max(1, batch_size)
        self.log = log or (lambda level, msg: None)

    def test(self, parsed, ips, should_stop=None, on_result=None):
        """
        Real-delay test of every IP. Returns {ip: delay_ms or None}.
        `on_result(ip, delay)` is called as soon as each IP is done.
        """
        results = {}
        for i in range(0, len(ips), self.batch_size):
            if should_stop and should_stop():
                break
            batch = ips[i:i + self.batch_size]
            for ip, delay in self._test_batch(parsed, batch).items():
                results[ip] = delay
                if on_result:
                    on_result(ip, delay)
        return results

    def _test_batch(self, parsed, ips):
        ports = _free_ports(len(ips))
        config = build_config(parsed, list(zip(ips, ports)))
        fd, cfg_path = tempfile.mkstemp(prefix='cdn-scanner-xray-', suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(config, f)
        # Xray's output goes to a file: an unread pipe could fill up and block it.
        log_file = tempfile.TemporaryFile()
        proc = subprocess.Popen([self.xray_path, 'run', '-c', cfg_path],
                                stdout=log_file, stderr=subprocess.STDOUT, **_no_window())
        try:
            if not _wait_listening(ports, proc, timeout=10):
                log_file.seek(0)
                err = log_file.read()[-500:].decode('utf-8', 'replace').strip()
                self.log('ERROR', 'Xray did not start: ' + err)
                return {ip: None for ip in ips}
            with ThreadPoolExecutor(max_workers=len(ips)) as ex:
                delays = list(ex.map(lambda port: _fetch_through(port, self.test_url, self.timeout), ports))
            return dict(zip(ips, delays))
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            log_file.close()
            try:
                os.remove(cfg_path)
            except OSError:
                pass
