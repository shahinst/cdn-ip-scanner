from app.scanner.core import SHScanner, extract_colo
from app.scanner.speedtest import measure_download


def test_measure_download(http_server):
    port = http_server({'CF-RAY': '1-FRA'})
    url = f'http://speed.example:{port}/__down?bytes={{bytes}}'
    speed = measure_download('127.0.0.1', size_kb=256, timeout=10, url=url)
    assert speed is not None and speed > 0


def test_measure_download_rejects_tiny_or_failed_responses(http_server):
    port = http_server({'CF-RAY': '1-FRA'})
    # The trace path returns a few bytes only: not a meaningful speed sample
    assert measure_download('127.0.0.1', size_kb=256, url=f'http://x:{port}/cdn-cgi/trace') is None
    # Nothing listening
    assert measure_download('127.0.0.1', size_kb=64, timeout=2, url='http://x:1/__down?bytes={bytes}') is None
    assert measure_download('127.0.0.1', url='ftp://x/file') is None


def test_extract_colo():
    assert extract_colo({}, 'fl=1\ncolo=ams\n') == 'AMS'
    assert extract_colo({'cf-ray': '8abc123-IST'}) == 'IST'
    assert extract_colo({'x-served-by': 'cache-fra19125-FRA'}) == 'FRA'
    assert extract_colo({'server': 'nginx'}) == ''


def test_speed_increases_score():
    base = {'ping': 120, 'open_ports': [443]}
    assert SHScanner.calc_score(dict(base, speed=6000)) > SHScanner.calc_score(base)
