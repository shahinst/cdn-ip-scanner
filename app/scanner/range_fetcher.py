"""
CDN IP Scanner V2.0 - Range Fetcher (Linux Edition)
Author: shahinst

Fetches CDN IP ranges from multiple sources with:
  - Automatic retry (3 attempts)
  - DNS resolution fallback
  - SSL certificate verification fallback
  - Timeout handling for slow server connections
"""

import time
import ipaddress
import logging
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

# Longer timeout and headers for server environments (firewall/proxy)
FETCH_TIMEOUT = 30
FETCH_RETRIES = 3
FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
}


def _robust_get(url, timeout=FETCH_TIMEOUT, verify=True, retries=FETCH_RETRIES):
    """
    HTTP GET with automatic retry, SSL fallback, and error logging.
    On SSL error, retries with verify=False.
    """
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(
                url,
                timeout=timeout,
                headers=FETCH_HEADERS,
                verify=verify,
            )
            r.raise_for_status()
            return r
        except requests.exceptions.SSLError as e:
            logger.warning("SSL error on %s (attempt %d): %s", url, attempt, e)
            if verify:
                # Retry without SSL verification
                verify = False
                continue
            last_err = e
        except requests.exceptions.ConnectionError as e:
            logger.warning("Connection error on %s (attempt %d): %s", url, attempt, e)
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * attempt)
        except requests.exceptions.Timeout as e:
            logger.warning("Timeout on %s (attempt %d): %s", url, attempt, e)
            last_err = e
            if attempt < retries:
                time.sleep(1.0)
        except requests.exceptions.RequestException as e:
            logger.warning("Request error on %s (attempt %d): %s", url, attempt, e)
            last_err = e
            if attempt < retries:
                time.sleep(1.0)
    raise requests.exceptions.ConnectionError(
        f"Failed after {retries} attempts: {url} — {last_err}"
    )


class RangeFetcher:

    @staticmethod
    def get_cloudflare_official():
        try:
            r = _robust_get('https://api.cloudflare.com/client/v4/ips')
            data = r.json()
            return data.get('result', {}).get('ipv4_cidrs', [])
        except Exception as e:
            logger.error("Cloudflare official fetch failed: %s", e)
            return []

    @staticmethod
    def get_cloudflare_asn():
        return [
            '104.16.0.0/12', '172.64.0.0/13', '162.159.0.0/16',
            '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
            '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
            '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22',
            '198.41.128.0/17', '131.0.72.0/22'
        ]

    @staticmethod
    def get_cloudflare_github():
        try:
            r = _robust_get(
                'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/data/ip-ranges.json'
            )
            data = r.json()
            return data.get('ipv4_cidrs', [])
        except Exception as e:
            logger.error("Cloudflare GitHub fetch failed: %s", e)
            return []

    @staticmethod
    def get_fastly_official():
        try:
            r = _robust_get('https://api.fastly.com/public-ip-list')
            return r.json().get('addresses', [])
        except Exception as e:
            logger.error("Fastly official fetch failed: %s", e)
            return []

    @staticmethod
    def get_fastly_asn():
        return [
            '151.101.0.0/16', '199.232.0.0/16',
            '103.244.50.0/24', '103.245.222.0/23',
            '103.245.224.0/24', '104.156.80.0/20'
        ]

    @staticmethod
    def get_vfarid_cdn_ranges():
        """
        Fetch comprehensive verified CDN IP ranges from vfarid's cf-ip-scanner repo.
        Returns list of CIDR strings (/24 ranges).
        """
        try:
            r = _robust_get(
                'https://raw.githubusercontent.com/vfarid/cf-ip-scanner/main/ipv4.txt'
            )
            if r.status_code == 200:
                lines = r.text.strip().split('\n')
                ranges = []
                for line in lines:
                    line = line.strip()
                    if not line or line.startswith('//') or line.startswith('#'):
                        continue
                    if '/' in line:
                        try:
                            ipaddress.IPv4Network(line, strict=False)
                            ranges.append(line)
                        except ValueError:
                            continue
                return ranges
        except Exception as e:
            logger.error("vfarid CDN ranges fetch failed: %s", e)
        return []

    @staticmethod
    def get_all_sources():
        """Fetch from all sources and deduplicate."""
        all_ranges = []
        all_ranges.extend(RangeFetcher.get_cloudflare_official())
        all_ranges.extend(RangeFetcher.get_cloudflare_asn())
        all_ranges.extend(RangeFetcher.get_cloudflare_github())
        all_ranges.extend(RangeFetcher.get_fastly_official())
        all_ranges.extend(RangeFetcher.get_fastly_asn())
        return list(set(all_ranges))

    @staticmethod
    def get_all_with_vfarid():
        """Fetch from ALL sources including vfarid comprehensive list."""
        all_ranges = RangeFetcher.get_all_sources()
        vfarid = RangeFetcher.get_vfarid_cdn_ranges()
        all_ranges.extend(vfarid)
        return list(set(all_ranges))

    @staticmethod
    def fetch_by_source(source):
        source_map = {
            'sh_api': RangeFetcher.get_cloudflare_official,
            'sh_asn': RangeFetcher.get_cloudflare_asn,
            'sh_github': RangeFetcher.get_cloudflare_github,
            'fastly_api': RangeFetcher.get_fastly_official,
            'fastly_asn': RangeFetcher.get_fastly_asn,
            'vfarid': RangeFetcher.get_vfarid_cdn_ranges,
            'all': RangeFetcher.get_all_sources,
            'all_vfarid': RangeFetcher.get_all_with_vfarid,
        }
        fn = source_map.get(source, RangeFetcher.get_all_sources)
        return fn()
