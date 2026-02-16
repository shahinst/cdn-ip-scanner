"""
SH IP Scanner V2.0 - V2Ray Config Parser & Scanner
Author: shahinst

Parses vless:// (and vmess://, trojan://) configs,
replaces the IP for each scan target, then tests latency
through each operator's network.
"""

import re
import time
import socket
import requests
import urllib3
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


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
    def test_ip_with_config(parsed, test_ip, timeout=5):
        """
        Test a single IP by replacing it in config and checking connectivity.
        For vless/trojan with TLS+WS: try HTTPS connection to the host/sni.
        Returns (success: bool, latency_ms: float or None).
        """
        if not parsed:
            return False, None

        port = parsed['port']
        params = parsed.get('params', {})
        sni = params.get('sni', '') or params.get('host', '') or ''

        start = time.time()
        try:
            # Try TLS connection with SNI
            if params.get('security') == 'tls' or port in (443, 8443, 2053, 2083, 2087, 2096):
                import ssl
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                wrapped = context.wrap_socket(sock, server_hostname=sni or test_ip)
                wrapped.connect((test_ip, port))
                latency = (time.time() - start) * 1000

                # Try HTTP request through the connection
                host_header = sni or test_ip
                request = f"GET /cdn-cgi/trace HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\n\r\n"
                wrapped.sendall(request.encode())
                response = wrapped.recv(4096).decode('utf-8', errors='ignore')
                wrapped.close()

                if '200' in response.split('\r\n')[0] or 'fl=' in response:
                    return True, latency
                # Even if trace fails, connection succeeded
                return True, latency
            else:
                # Plain TCP for non-TLS
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                sock.connect((test_ip, port))
                latency = (time.time() - start) * 1000
                sock.close()
                return True, latency
        except Exception:
            return False, None


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

        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = {}
            for ip in ip_list:
                if self._stop_flag:
                    break
                f = ex.submit(V2RayConfigParser.test_ip_with_config, parsed_config, str(ip), timeout)
                futures[f] = str(ip)

            completed = 0
            wait_timeout = 2.0
            it = as_completed(futures, timeout=wait_timeout)
            while True:
                if self._stop_flag:
                    for f in futures:
                        try:
                            f.cancel()
                        except Exception:
                            pass
                    break
                try:
                    future = next(it)
                except StopIteration:
                    break
                except FuturesTimeoutError:
                    continue
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

        self._log('INFO', f'V2Ray scan completed: {len(results)}/{total} successful')
        return results
