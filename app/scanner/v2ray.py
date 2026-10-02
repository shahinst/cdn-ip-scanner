"""
CDN IP Scanner V2.0 - V2Ray Config Parser & Scanner
Author: shahinst

Parses vless:// (and vmess://, trojan://) configs,
replaces the IP for each scan target, then checks that a real CDN edge
answers for the config's host on that IP (latency is measured from the
machine running the scanner).
"""

import ssl
import time
import socket
from urllib.parse import parse_qs, urlencode
from concurrent.futures import ThreadPoolExecutor

from app.scanner.core import is_cdn_response, iter_completed, HTTPS_PORTS


class V2RayConfigParser:
    """Parse and manipulate V2Ray config URIs."""

    @staticmethod
    def parse(config_str):
        """
        Parse a v2ray config string (vless://, vmess://, trojan://).
        Returns dict with all parameters, or None on failure.

        Example input:
        vless://uuid@162.159.143.76:443?encryption=none&security=tls&type=ws&...#name

        Returns:
        {
            'protocol': 'vless',
            'uuid': '...',
            'ip': '162.159.143.76',
            'port': 443,
            'params': {...},
            'fragment': '...',
            'raw': original_string
        }
        """
        config_str = (config_str or '').strip()
        if not config_str:
            return None

        try:
            # Detect protocol
            if config_str.startswith('vless://'):
                return V2RayConfigParser._parse_vless(config_str)
            elif config_str.startswith('vmess://'):
                return V2RayConfigParser._parse_vmess(config_str)
            elif config_str.startswith('trojan://'):
                return V2RayConfigParser._parse_trojan(config_str)
            else:
                return None
        except Exception:
            return None

    @staticmethod
    def _parse_vless(config_str):
        """Parse vless:// URI."""
        # vless://uuid@host:port?params#fragment
        without_scheme = config_str[len('vless://'):]
        fragment = ''
        if '#' in without_scheme:
            without_scheme, fragment = without_scheme.rsplit('#', 1)

        params_str = ''
        if '?' in without_scheme:
            without_scheme, params_str = without_scheme.split('?', 1)

        # uuid@host:port
        if '@' not in without_scheme:
            return None
        uuid_part, host_port = without_scheme.split('@', 1)
        if ':' in host_port:
            host, port_str = host_port.rsplit(':', 1)
            port = int(port_str)
        else:
            host = host_port
            port = 443

        params = {}
        if params_str:
            params = dict(parse_qs(params_str, keep_blank_values=True))
            params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}

        return {
            'protocol': 'vless',
            'uuid': uuid_part,
            'ip': host,
            'port': port,
            'params': params,
            'fragment': fragment,
            'raw': config_str,
        }

    @staticmethod
    def _parse_vmess(config_str):
        """Parse vmess:// URI (base64 encoded JSON)."""
        import base64, json
        encoded = config_str[len('vmess://'):]
        try:
            padding = 4 - len(encoded) % 4
            if padding != 4:
                encoded += '=' * padding
            decoded = base64.b64decode(encoded).decode('utf-8')
            data = json.loads(decoded)
            return {
                'protocol': 'vmess',
                'uuid': data.get('id', ''),
                'ip': data.get('add', ''),
                'port': int(data.get('port', 443)),
                'params': data,
                'fragment': data.get('ps', ''),
                'raw': config_str,
            }
        except Exception:
            return None

    @staticmethod
    def _parse_trojan(config_str):
        """Parse trojan:// URI."""
        without_scheme = config_str[len('trojan://'):]
        fragment = ''
        if '#' in without_scheme:
            without_scheme, fragment = without_scheme.rsplit('#', 1)
        params_str = ''
        if '?' in without_scheme:
            without_scheme, params_str = without_scheme.split('?', 1)
        if '@' not in without_scheme:
            return None
        password, host_port = without_scheme.split('@', 1)
        if ':' in host_port:
            host, port_str = host_port.rsplit(':', 1)
            port = int(port_str)
        else:
            host = host_port
            port = 443
        params = {}
        if params_str:
            params = dict(parse_qs(params_str, keep_blank_values=True))
            params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}
        return {
            'protocol': 'trojan',
            'uuid': password,
            'ip': host,
            'port': port,
            'params': params,
            'fragment': fragment,
            'raw': config_str,
        }

    @staticmethod
    def rebuild_config(parsed, new_ip):
        """Rebuild config string with a new IP, keeping everything else the same."""
        if not parsed:
            return None
        protocol = parsed['protocol']

        if protocol == 'vless':
            params_str = urlencode(parsed['params'], doseq=True) if parsed['params'] else ''
            uri = f"vless://{parsed['uuid']}@{new_ip}:{parsed['port']}"
            if params_str:
                uri += f"?{params_str}"
            if parsed.get('fragment'):
                uri += f"#{parsed['fragment']}"
            return uri

        elif protocol == 'vmess':
            import base64, json, copy
            data = copy.deepcopy(parsed['params'])
            data['add'] = new_ip
            encoded = base64.b64encode(json.dumps(data).encode()).decode()
            return f"vmess://{encoded}"

        elif protocol == 'trojan':
            params_str = urlencode(parsed['params'], doseq=True) if parsed['params'] else ''
            uri = f"trojan://{parsed['uuid']}@{new_ip}:{parsed['port']}"
            if params_str:
                uri += f"?{params_str}"
            if parsed.get('fragment'):
                uri += f"#{parsed['fragment']}"
            return uri

        return None

    @staticmethod
    def _parse_http_response(raw):
        """Split a raw HTTP response into (status_code, lowercase headers dict, body)."""
        head, _, body = raw.partition('\r\n\r\n')
        lines = head.split('\r\n')
        parts = lines[0].split(' ', 2) if lines else []
        if len(parts) < 2 or not parts[0].startswith('HTTP/') or not parts[1].isdigit():
            return None, {}, ''
        headers = {}
        for line in lines[1:]:
            if ':' in line:
                k, v = line.split(':', 1)
                headers[k.strip().lower()] = v.strip()
        return int(parts[1]), headers, body

    @staticmethod
    def _recv_head(sock, limit=8192):
        """Read until the end of the HTTP headers (or `limit` bytes / EOF)."""
        data = b''
        while b'\r\n\r\n' not in data and len(data) < limit:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
        return data.decode('utf-8', errors='ignore')

    @staticmethod
    def test_ip_with_config(parsed, test_ip, timeout=5):
        """
        Test a single IP with the config's TLS SNI / HTTP Host: connect to the IP,
        request /cdn-cgi/trace for the config's host and require a real CDN edge
        response (a bare TCP/TLS handshake is not enough).
        Returns (success: bool, latency_ms: float or None).
        """
        if not parsed:
            return False, None

        port = parsed['port']
        params = parsed.get('params', {}) or {}
        sni = params.get('sni', '') or params.get('host', '') or ''
        host_header = params.get('host', '') or sni or test_ip
        # vless/trojan use `security=tls`, vmess JSON uses `tls: "tls"`
        security = (params.get('security') or params.get('tls') or '').lower()
        use_tls = security == 'tls' or (not security and port in HTTPS_PORTS)

        start = time.time()
        sock = None
        try:
            sock = socket.create_connection((test_ip, port), timeout=timeout)
            if use_tls:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                sock = context.wrap_socket(sock, server_hostname=sni or None)
            latency = (time.time() - start) * 1000

            request = (f"GET /cdn-cgi/trace HTTP/1.1\r\nHost: {host_header}\r\n"
                       "User-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n")
            sock.sendall(request.encode())
            status, headers, body = V2RayConfigParser._parse_http_response(
                V2RayConfigParser._recv_head(sock))
            if status is None or not is_cdn_response(headers, body):
                return False, None
            return True, latency
        except Exception:
            return False, None
        finally:
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass


class V2RayScanner:
    """Scan IPs using V2Ray config template."""

    def __init__(self):
        self.max_workers = 50
        self._stop_flag = False
        self.log_callback = None

    def stop(self):
        self._stop_flag = True

    def reset(self):
        self._stop_flag = False

    def _log(self, level, message):
        if self.log_callback:
            try:
                self.log_callback(level, message)
            except Exception:
                pass

    def scan_ips(self, parsed_config, ip_list, timeout=5, progress_callback=None, result_callback=None):
        """
        Scan a list of IPs using the V2Ray config template.
        Calls result_callback(result) as soon as each IP is found.
        Returns list of {ip, latency, success} dicts.
        """
        results = []
        total = len(ip_list)

        self._log('INFO', f'V2Ray scan started: {total} IPs, config={parsed_config["protocol"]}')

        ex = ThreadPoolExecutor(max_workers=self.max_workers)
        try:
            futures = {}
            for ip in ip_list:
                if self._stop_flag:
                    break
                f = ex.submit(V2RayConfigParser.test_ip_with_config, parsed_config, str(ip), timeout)
                futures[f] = str(ip)

            completed = 0
            for future in iter_completed(futures, lambda: self._stop_flag):
                completed += 1
                ip_str = futures[future]
                try:
                    success, latency = future.result()
                    if success and latency is not None:
                        result = {
                            'ip': ip_str,
                            'ping': latency,
                            'open_ports': [parsed_config['port']],
                            'success': True,
                        }
                        results.append(result)
                        if result_callback:
                            try:
                                result_callback(result)
                            except Exception:
                                pass
                        self._log('DEBUG', f'V2Ray: {ip_str} OK latency={latency:.0f}ms')
                except Exception as e:
                    self._log('ERROR', f'V2Ray: {ip_str} error: {e}')

                if progress_callback:
                    try:
                        progress_callback(completed, total)
                    except Exception:
                        pass
        finally:
            ex.shutdown(wait=not self._stop_flag, cancel_futures=True)

        self._log('INFO', f'V2Ray scan completed: {len(results)}/{total} successful')
        return results
