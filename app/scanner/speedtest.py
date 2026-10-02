"""
CDN IP Scanner - Download speed test through a specific CDN IP
Author: shahinst

Connects to the CDN IP directly, sends the test URL's hostname as TLS SNI / HTTP
Host and measures how fast the body arrives. This is the same thing a V2Ray
client does when its config points at that IP, so the result reflects the
real-world speed of that IP on the current network.
"""

import socket
import ssl
import time
from urllib.parse import urlsplit

DEFAULT_SPEED_TEST_URL = 'https://speed.cloudflare.com/__down?bytes={bytes}'


def _recv_headers(sock, deadline):
    """Read the HTTP response head. Returns (status, leftover_body_bytes)."""
    data = b''
    while b'\r\n\r\n' not in data:
        if time.time() > deadline or len(data) > 65536:
            return None, b''
        chunk = sock.recv(16384)
        if not chunk:
            return None, b''
        data += chunk
    head, _, rest = data.partition(b'\r\n\r\n')
    status_line = head.split(b'\r\n', 1)[0].decode('latin-1', errors='ignore')
    parts = status_line.split(' ', 2)
    if len(parts) < 2 or not parts[1].isdigit():
        return None, b''
    return int(parts[1]), rest


def measure_download(ip, size_kb=1024, timeout=10.0, url=DEFAULT_SPEED_TEST_URL, should_stop=None):
    """
    Download `size_kb` KB from `url` through `ip`.
    `url` may contain `{bytes}`, replaced by the requested size in bytes.
    Returns the speed in KB/s, or None if the test failed.
    """
    size_bytes = max(1, int(size_kb)) * 1024
    parsed = urlsplit(url.replace('{bytes}', str(size_bytes)))
    host = parsed.hostname
    if not host or parsed.scheme not in ('http', 'https'):
        return None
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    path = parsed.path or '/'
    if parsed.query:
        path += '?' + parsed.query

    deadline = time.time() + timeout
    sock = None
    try:
        sock = socket.create_connection((ip, port), timeout=min(5.0, timeout))
        if parsed.scheme == 'https':
            # Verify the certificate: a real CDN edge serves a valid cert for `host`.
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
        sock.settimeout(min(5.0, timeout))
        request = (f"GET {path} HTTP/1.1\r\nHost: {host}\r\n"
                   "User-Agent: Mozilla/5.0\r\nAccept: */*\r\nConnection: close\r\n\r\n")
        sock.sendall(request.encode())

        status, body = _recv_headers(sock, deadline)
        if status != 200:
            return None

        start = time.time()
        received = len(body)
        while received < size_bytes and time.time() < deadline:
            if should_stop and should_stop():
                return None
            chunk = sock.recv(65536)
            if not chunk:
                break
            received += len(chunk)
        elapsed = max(time.time() - start, 0.001)
        # Too little data for a meaningful number (e.g. connection throttled to death)
        if received < min(size_bytes, 64 * 1024):
            return None
        return round(received / 1024.0 / elapsed, 1)
    except (OSError, ValueError):
        return None
    finally:
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass
