import time
from concurrent.futures import ThreadPoolExecutor

from app.scanner import core
from app.scanner.core import SHNetUtils, SHScanner, is_cdn_response, iter_completed
from app.scanner.range_fetcher import normalize_ipv4_ranges


def test_split_to_24_blocks():
    assert SHNetUtils.split_to_24_blocks('10.0.0.0/22') == ['10.0.0', '10.0.1', '10.0.2', '10.0.3']
    assert SHNetUtils.split_to_24_blocks('10.0.5.7/30') == ['10.0.5']
    assert SHNetUtils.split_to_24_blocks('garbage') == []


def test_generate_scan_ips_represents_every_range():
    ips = SHNetUtils.generate_scan_ips(['10.0.0.0/16', '192.168.1.0/24'], per_block=5, max_total=40)
    assert len(ips) <= 40
    assert any(ip.startswith('192.168.1.') for ip in ips)
    assert any(ip.startswith('10.0.') for ip in ips)


def test_calc_score_is_bounded():
    assert SHScanner.calc_score({'ping': 10, 'open_ports': [443, 80, 8080, 8443] + list(range(30))}) == 100.0
    assert SHScanner.calc_score({'ping': None, 'open_ports': []}) == 0.0


def test_is_cdn_response():
    assert is_cdn_response({'cf-ray': 'abc-FRA'})
    assert is_cdn_response({'server': 'cloudflare'})
    assert is_cdn_response({'via': '1.1 varnish', 'x-served-by': 'cache-fra1'})
    assert is_cdn_response({}, 'fl=1\ncolo=FRA\n')
    assert not is_cdn_response({'server': 'nginx'}, '<html>hello</html>')


def test_iter_completed_survives_poll_timeouts():
    # Regression: as_completed(timeout=...) ended the loop after the first timeout,
    # silently dropping every result that arrived later.
    with ThreadPoolExecutor(4) as ex:
        futures = [ex.submit(time.sleep, d) for d in (0.01, 0.3, 0.5)]
        done = list(iter_completed(futures, lambda: False, poll_interval=0.05))
    assert len(done) == 3


def test_iter_completed_honours_stop():
    with ThreadPoolExecutor(2) as ex:
        futures = [ex.submit(time.sleep, 0.5)]
        assert list(iter_completed(futures, lambda: True, poll_interval=0.05)) == []


def test_trace_check_accepts_cdn_and_rejects_other_servers(http_server):
    scanner = SHScanner()
    cdn_port = http_server({'CF-RAY': '123-FRA', 'Server': 'cloudflare'})
    plain_port = http_server({'Server': 'nginx'})
    ok, latency = scanner._sequential_trace_check('127.0.0.1', cdn_port, 9999)
    assert ok and latency >= 0
    ok, _ = scanner._sequential_trace_check('127.0.0.1', plain_port, 9999)
    assert not ok


def test_batch_scan_reports_results(http_server):
    port = http_server({'CF-RAY': '123-FRA'})
    scanner = SHScanner()
    scanner.max_workers = 4
    found = []
    results = scanner.batch_scan(['127.0.0.1'], [port], result_callback=found.append)
    assert [r['ip'] for r in results] == ['127.0.0.1']
    assert found and found[0]['open_ports'] == [port]


def test_normalize_ipv4_ranges():
    assert normalize_ipv4_ranges(['1.1.1.0/24', '1.1.1.5/24', 'evil<script>', '2606::/32', None, '8.8.8.8']) == [
        '1.1.1.0/24', '8.8.8.8/32']
