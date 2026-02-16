"""
SH IP Scanner V2.0 - Operator Definitions & Fetch (Linux Edition)
Author: shahinst

Robust operator prefix fetching with retry, SSL fallback, and timeout handling.
"""

import time
import logging
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

OPERATORS_IRAN = {
    "irancell": {"name": "Irancell", "name_fa": "ایرانسل", "asn": 44244},
    "mci": {"name": "MCI", "name_fa": "همراه اول", "asn": 197207},
    "rightel": {"name": "Rightel", "name_fa": "رایتل", "asn": 57218},
    "shuttle": {"name": "Shuttle", "name_fa": "شاتل", "asn": 12880},
}

OPERATORS_CHINA = {
    "china_mobile": {"name": "China Mobile", "name_fa": "چاینا موبایل", "asn": [9808, 56040, 56041, 56042, 56044, 56046, 56047, 56048, 58453, 58807, 9231]},
    "china_unicom": {"name": "China Unicom", "name_fa": "چاینا یونیکام", "asn": [4837, 4808, 9800, 9929, 10099, 17621, 17623, 17816]},
    "china_telecom": {"name": "China Telecom", "name_fa": "چاینا تلکام", "asn": [4134, 4809, 4812, 23724, 58466, 133774, 133775, 136958]},
    "china_broadnet": {"name": "China Broadnet", "name_fa": "چاینا برادنت", "asn": [58542]},
}

OPERATORS_RUSSIA = {
    "mts": {"name": "MTS", "name_fa": "ام‌تی‌اس", "asn": [8359, 13174, 28840, 29226, 31163, 35807, 42511, 50544]},
    "megafon": {"name": "MegaFon", "name_fa": "مگافون", "asn": [25159, 31133, 31200, 43478, 44843, 49037, 50716]},
    "beeline": {"name": "Beeline", "name_fa": "بیلاین", "asn": [3216, 8402, 12389, 21453, 28917, 35000, 41733, 42668, 48642]},
    "tele2": {"name": "Tele2 Russia", "name_fa": "تله‌۲", "asn": [12958, 35104, 41668, 44746, 48287, 48715, 50384, 51547]},
}

OPERATORS_BY_COUNTRY = {"ir": OPERATORS_IRAN, "cn": OPERATORS_CHINA, "ru": OPERATORS_RUSSIA}

OPERATOR_FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

FETCH_TIMEOUT = 30
FETCH_RETRIES = 3


def _robust_get(url, timeout=FETCH_TIMEOUT, retries=FETCH_RETRIES):
    """HTTP GET with retry, SSL fallback, and error logging."""
    last_err = None
    verify = True
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, headers=OPERATOR_FETCH_HEADERS,
                             timeout=timeout, verify=verify)
            r.raise_for_status()
            return r
        except requests.exceptions.SSLError as e:
            logger.warning("SSL error on %s (attempt %d): %s", url, attempt, e)
            verify = False
            continue
        except (requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.RequestException) as e:
            logger.warning("Request error on %s (attempt %d): %s", url, attempt, e)
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * attempt)
    raise requests.exceptions.ConnectionError(
        f"Failed after {retries} attempts: {url} — {last_err}"
    )


def _normalize_ipv4_prefixes(prefixes):
    out = []
    for p in prefixes or []:
        if isinstance(p, dict):
            s = p.get("prefix") or p.get("ip") or ""
        else:
            s = str(p).strip()
        if not s or ":" in s or "/" not in s:
            continue
        out.append(s)
    return out


def fetch_operator_prefixes_ripe(asn):
    try:
        r = _robust_get(
            f"https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{asn}"
        )
        data = r.json()
        payload = data.get("data") or {}
        raw = payload.get("prefixes") or []
        prefixes = _normalize_ipv4_prefixes(raw)
        if not prefixes:
            return 0, [], "no IPv4 prefixes"
        return len(prefixes), prefixes, None
    except Exception as e:
        logger.error("RIPE fetch failed for AS%s: %s", asn, e)
        return 0, [], str(e)


def fetch_operator_prefixes_bgpview(asn):
    try:
        r = _robust_get(f"https://api.bgpview.io/asn/{asn}/prefixes")
        data = r.json()
        if data.get("status") != "ok":
            return 0, [], data.get("status_message", "API error")
        payload = data.get("data") or {}
        ipv4 = payload.get("ipv4_prefixes") or []
        prefixes = _normalize_ipv4_prefixes(ipv4)
        return len(prefixes), prefixes, None
    except Exception as e:
        logger.error("BGPView fetch failed for AS%s: %s", asn, e)
        return 0, [], str(e)


def fetch_operator_prefixes_smart(asn):
    """Smart fetch from multiple sources with fallback."""
    cnt, prefixes, err = fetch_operator_prefixes_ripe(asn)
    if not err and cnt > 0:
        return cnt, prefixes, None
    time.sleep(0.3)
    cnt, prefixes, err = fetch_operator_prefixes_bgpview(asn)
    if not err and cnt > 0:
        return cnt, prefixes, None
    time.sleep(0.5)
    cnt, prefixes, err = fetch_operator_prefixes_ripe(asn)
    if not err and cnt > 0:
        return cnt, prefixes, None
    return 0, [], err or "no data"


def fetch_all_operator_prefixes(operator_key, country='ir'):
    """Fetch all prefixes for an operator. Returns (count, prefixes_list, error)."""
    operators = OPERATORS_BY_COUNTRY.get(country, OPERATORS_IRAN)
    if operator_key not in operators:
        return 0, [], "unknown operator"
    asn = operators[operator_key]["asn"]
    if isinstance(asn, list):
        all_prefixes = []
        for a in asn:
            cnt, prefixes, err = fetch_operator_prefixes_smart(a)
            if not err and prefixes:
                all_prefixes.extend(prefixes)
            time.sleep(0.5)
        return len(all_prefixes), all_prefixes, None if all_prefixes else "no data"
    else:
        return fetch_operator_prefixes_smart(asn)
