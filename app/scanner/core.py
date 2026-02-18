"""
CDN IP Scanner V2.0 - Core Scanner Engine
Author: shahinst

Scanning mechanism based on proven multi-attempt /cdn-cgi/trace verification:
  - Split CIDRs into /24 blocks
  - Round-robin across ALL ranges (ensures every range is represented)
  - Generate random IPs from each /24
  - 5 sequential HTTP requests per IP (AbortController-like behavior)
  - >= 3 out of 5 successes + avg latency <= max → valid IP
  - Connection reuse (requests.Session) for 3x speed boost
"""

import os
import time
import random
import socket
import ipaddress
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ===== SH Scanner Constants =====
SH_TRACE_PATH = "/cdn-cgi/trace"
HTTPS_PORTS = {443, 8443, 2053, 2083, 2087, 2096}
HTTP_PORTS = {80, 8080, 2052, 2082, 2086, 2095}
SH_TRACE_ATTEMPTS = 5        # 5 sequential requests per IP
SH_TRACE_MIN_SUCCESS = 3     # need >= 3 successes out of 5
SH_HOST_HEADER = "www.cloudflare.com"


def _sh_trace_url(ip_str, port):
    """Build URL for /cdn-cgi/trace based on port."""
    scheme = "https" if port in HTTPS_PORTS else "http"
    return f"{scheme}://{ip_str}:{port}{SH_TRACE_PATH}"


# Speed mode resource allocation
SPEED_MODES = {
    'hyper': {'resource_pct': 0.20, 'ips_per_24': 30,  'label': 'Hyper (20%)'},
    'turbo': {'resource_pct': 0.40, 'ips_per_24': 50,  'label': 'Turbo (40%)'},
    'ultra': {'resource_pct': 0.60, 'ips_per_24': 80,  'label': 'Ultra (60%)'},
    'deep':  {'resource_pct': 0.80, 'ips_per_24': 120, 'label': 'Deep (80%)'},
}


class SHNetUtils:
    """
    Network utilities for CIDR splitting and random IP generation.
    Uses round-robin to guarantee ALL provided ranges are represented.
    """

    @staticmethod
    def split_to_24_blocks(cidr_str):
        """
        Split any CIDR range into /24 block prefixes.
        Returns list of prefix strings like '104.16.0', '104.16.1', etc.
        """
        try:
            net = ipaddress.IPv4Network(cidr_str, strict=False)
            prefix_len = net.prefixlen

            if prefix_len >= 24:
                base = str(net.network_address)
                prefix = base.rsplit('.', 1)[0]
                return [prefix]

            base_int = int(net.network_address)
            end_int = int(net.broadcast_address)
            blocks = []
            current = base_int
            while current <= end_int:
                a = (current >> 24) & 0xFF
                b = (current >> 16) & 0xFF
                c = (current >> 8) & 0xFF
                blocks.append(f"{a}.{b}.{c}")
                current += 256
            return blocks
        except Exception:
            return []

    @staticmethod
    def random_ips_from_block(prefix_24, count=30):
        """
        Generate unique random IPs from a /24 block.
        IPs range from .1 to .254 (skipping .0 and .255).
        """
        count = min(count, 254)
        numbers = random.sample(range(1, 255), count)
        return [f"{prefix_24}.{n}" for n in numbers]

    @staticmethod
    def generate_scan_ips(cidr_list, per_block=30, max_total=None, shuffle=True):
        """
        Generate scan IPs with FAIR representation from ALL ranges.

        Uses round-robin block selection:
          Round 1: pick 1 block from range 1, 1 from range 2, ..., 1 from range N
          Round 2: same again
          ... continues until we have enough IPs

        This GUARANTEES every single range contributes IPs, even tiny /22 ranges
        alongside huge /12 ranges.
        """
        single_ips = []
        range_block_lists = []  # List of shuffled block lists, one per range

        for cidr in cidr_list:
            cidr = str(cidr).strip()
            if not cidr:
                continue
            if '/' not in cidr:
                single_ips.append(cidr)
                continue
            blocks = SHNetUtils.split_to_24_blocks(cidr)
            if blocks:
                random.shuffle(blocks)  # Shuffle blocks within each range
                range_block_lists.append(blocks)

        if not range_block_lists and not single_ips:
            return []

        # Round-robin: pick blocks from each range alternately
        # This ensures ALL ranges are represented from the very first round
        selected_blocks = []
        if range_block_lists:
            max_rounds = max(len(b) for b in range_block_lists)
            for round_idx in range(max_rounds):
                for blocks in range_block_lists:
                    if round_idx < len(blocks):
                        selected_blocks.append(blocks[round_idx])
                # Stop when we have enough blocks to generate max_total IPs
                if max_total and len(selected_blocks) * per_block >= max_total:
                    break

        # Generate random IPs from selected blocks
        all_ips = list(single_ips)
        for prefix in selected_blocks:
            all_ips.extend(SHNetUtils.random_ips_from_block(prefix, per_block))

        if shuffle:
            random.shuffle(all_ips)

        if max_total:
            all_ips = all_ips[:max_total]

        return all_ips


class SHScanner:
    """
    Core IP scanner engine.
    Uses 5-sequential-attempt /cdn-cgi/trace verification with connection reuse.
    """

    def __init__(self):
        self.max_workers = 800
        self.timeout = 1.8
        self.max_latency_ms = 9999
        self.failed_cache = set()
        self.log_callback = None
        self._stop_flag = False

    def set_mode(self, mode_key):
        """Configure scanner based on speed mode with resource percentage."""
        mode = SPEED_MODES.get(mode_key, SPEED_MODES['hyper'])
        cpu_count = os.cpu_count() or 4
        # Higher base for network I/O bound tasks
        base_workers = max(800, min(2000, cpu_count * 200))
        resource_pct = mode['resource_pct']
        self.max_workers = max(150, int(base_workers * resource_pct))
        self._log('INFO', f'Mode set to {mode_key}: {int(resource_pct*100)}% resources, {self.max_workers} workers')

    def stop(self):
        self._stop_flag = True

    def reset(self):
        self._stop_flag = False
        self.failed_cache.clear()

    def _log(self, level, message):
        if self.log_callback:
            try:
                self.log_callback(level, message)
            except Exception:
                pass

    def _sequential_trace_check(self, ip_str, port, max_latency_ms):
        """
        5 sequential HTTP requests to /cdn-cgi/trace with connection reuse.

        FIX 1: multiply حالا برای latency بالا هم مقدار مناسب داره —
                قبلاً وقتی ping_max=9999 بود، multiply=1.0 میشد و timeout
                per-request فقط ~1 ثانیه بود که خیلی کمه.

        FIX 2: max_total_sec حداقل 8 ثانیه — قبلاً با ping_max پایین
                ممکن بود خیلی کوتاه بشه.

        Returns (is_valid: bool, avg_latency_ms: float).
        """
        url = _sh_trace_url(ip_str, port)

        # FIX 1: multiply اصلاح شد — مقدار بیشتر = timeout بیشتر per request
        # قبلاً: 1.5 برای <=500، 1.2 برای <=1000، 1.0 برای بقیه (اشتباه)
        # الان: برای مقادیر بالا (مثل 9999) هم timeout کافی داره
        if max_latency_ms <= 300:
            multiply = 2.0
        elif max_latency_ms <= 500:
            multiply = 1.8
        elif max_latency_ms <= 1000:
            multiply = 1.5
        elif max_latency_ms <= 3000:
            multiply = 1.2
        else:
            # ping_max بالا (مثلاً 9999) — از timeout ثابت 3 ثانیه استفاده کن
            multiply = 1.0

        timeout_factors = [1.5, 1.2, 1.0, 1.0, 1.0]

        # FIX 2: حداقل 8 ثانیه total — قبلاً با ping_max کم خیلی کوتاه میشد
        max_total_sec = max(8.0, min(15.0, max_latency_ms * 3.0 / 1000.0))

        total_start = time.time()
        successes = 0
        aborted = False

        # Session for connection reuse (TCP+TLS only once per IP)
        session = requests.Session()
        session.verify = False
        session.headers.update({
            "Host": SH_HOST_HEADER,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        try:
            for i in range(SH_TRACE_ATTEMPTS):
                if self._stop_flag or aborted:
                    break

                # Check total time cap
                if time.time() - total_start > max_total_sec:
                    break

                # FIX 3: per-request timeout — حداقل 1.5s، حداکثر 4s
                # قبلاً حداکثر 2.5s بود که برای شبکه‌های کند کافی نبود
                if max_latency_ms > 3000:
                    # برای ping_max خیلی بالا (9999): timeout ثابت 3 ثانیه
                    timeout_sec = 3.0
                else:
                    raw_timeout = timeout_factors[i] * multiply * max_latency_ms / 1000.0
                    timeout_sec = min(4.0, max(1.5, raw_timeout))

                try:
                    r = session.get(url, timeout=timeout_sec, allow_redirects=False)
                    successes += 1
                except requests.exceptions.Timeout:
                    aborted = True
                except requests.exceptions.ConnectionError:
                    aborted = True  # Connection failed → no point retrying same IP
                except Exception:
                    successes += 1
        finally:
            try:
                session.close()
            except Exception:
                pass

        total_time_ms = (time.time() - total_start) * 1000
        avg_latency = total_time_ms / SH_TRACE_ATTEMPTS

        is_valid = (successes >= SH_TRACE_MIN_SUCCESS) and (avg_latency <= max_latency_ms)
        return is_valid, avg_latency

    def _tcp_connect(self, ip_str, port, timeout_sec):
        """Quick TCP connect to check if port is open."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout_sec)
            sock.connect((ip_str, port))
            sock.close()
            return True
        except Exception:
            return False

    def check(self, ip, ports):
        """
        Check a single IP:
        1. Quick TCP pre-filter → rejects dead IPs FAST
        2. If TCP passes → 5-sequential /cdn-cgi/trace verification
        3. If valid → quick TCP check on remaining ports
        4. Returns result dict or None

        FIX 4: TCP pre-filter timeout از 1.0s به 2.5s افزایش یافت.
                قبلاً روی سرورهای ایران/روسیه/چین که latency بالاست،
                IP های معتبر هم رد میشدن چون 1 ثانیه کافی نبود.
        """
        if self._stop_flag:
            return None
        ip_str = str(ip)
        if ip_str in self.failed_cache:
            return None

        primary_port = ports[0] if ports else 443

        # FIX 4: TCP timeout افزایش یافت: 1.0s → 2.5s
        # دلیل: روی شبکه‌های با latency بالا (ایران، روسیه، چین)
        # IP های معتبر CDN هم ممکنه TCP connect > 1s داشته باشن
        tcp_prefilter_timeout = min(2.5, max(1.5, self.max_latency_ms / 1000.0 * 0.5))
        if not self._tcp_connect(ip_str, primary_port, tcp_prefilter_timeout):
            self.failed_cache.add(ip_str)
            return None

        # TCP passed → full 5-sequential-attempt verification
        result = {'ip': ip_str, 'open_ports': [], 'ping': None}
        is_valid, avg_latency = self._sequential_trace_check(
            ip_str, primary_port, self.max_latency_ms
        )

        if not is_valid:
            self.failed_cache.add(ip_str)
            return None

        result['ping'] = avg_latency
        result['open_ports'].append(primary_port)

        # Quick TCP scan on remaining ports
        tcp_timeout = min(3.0, max(1.5, self.max_latency_ms / 1000.0))
        for port in ports[1:]:
            if self._stop_flag:
                break
            if self._tcp_connect(ip_str, port, tcp_timeout):
                result['open_ports'].append(port)

        self._log('DEBUG', f'{ip_str}: open={result["open_ports"]} ping={avg_latency:.0f}ms')
        return result

    def batch_scan(self, ips, ports, progress_callback=None, result_callback=None, start_time=None):
        """
        Scan a batch of IPs in parallel.
        Calls result_callback(result) immediately when each valid IP is found.
        Stops quickly when _stop_flag is set (check every ~2s via short timeout).
        """
        results = []
        n = len(ips)
        n_completed = 0
        wait_timeout = 2.0  # check _stop_flag every 2 seconds

        self._log('INFO', f'Batch scan started: {n} IPs, {len(ports)} ports, {self.max_workers} workers')

        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = {ex.submit(self.check, ip, ports): ip for ip in ips}
            iterator = as_completed(futures, timeout=wait_timeout)
            while True:
                if self._stop_flag:
                    for f in futures:
                        try:
                            f.cancel()
                        except Exception:
                            pass
                    break
                try:
                    future = next(iterator)
                except StopIteration:
                    break
                except FuturesTimeoutError:
                    continue
                n_completed += 1
                if progress_callback:
                    try:
                        elapsed = (time.time() - start_time) if start_time else 0
                        speed = n_completed / elapsed if elapsed > 0 else 0
                        progress_callback(n_completed, n, speed, elapsed)
                    except Exception:
                        pass
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                        if result_callback:
                            try:
                                result_callback(result)
                            except Exception:
                                pass
                except Exception:
                    pass

        self._log('INFO', f'Batch scan completed: {len(results)}/{n} IPs found')
        return results

    @staticmethod
    def calc_score(result):
        """Calculate score based on ping and open ports."""
        score = 0.0
        ping_val = result.get('ping')
        if ping_val is not None:
            if ping_val < 50:
                score += 35
            elif ping_val < 100:
                score += 28
            elif ping_val < 200:
                score += 20
            elif ping_val < 500:
                score += 10
            elif ping_val < 1000:
                score += 3
        open_ports = result.get('open_ports') or []
        score += len(open_ports) * 3
        if 443 in open_ports:
            score += 12
        if 80 in open_ports:
            score += 10
        if 8080 in open_ports:
            score += 4
        if 8443 in open_ports:
            score += 4
        return max(0.0, min(100.0, score))
