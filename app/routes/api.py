"""
CDN IP Scanner V2.0 - API Routes
Author: shahinst
"""

import json
import time
import logging
import threading
import traceback
from flask import Blueprint, request, jsonify, current_app
from app import db, socketio, utcnow
from app.models import (
    ScanResult, ScanSession, OperatorRange, AppSetting, ScanLog
)
from app.scanner.core import SHScanner, SHNetUtils, SPEED_MODES
from app.scanner.range_fetcher import RangeFetcher
from app.scanner.operators import (
    OPERATORS_BY_COUNTRY, fetch_all_operator_prefixes
)
from app.scanner.v2ray import V2RayConfigParser, V2RayScanner
from app.scanner.speedtest import measure_download, DEFAULT_SPEED_TEST_URL
from app.scanner import xray as xray_mod

api_bp = Blueprint('api', __name__)
logger = logging.getLogger(__name__)

# Global scanner instances
_scanner = SHScanner()
_v2ray_scanner = V2RayScanner()
_active_session_id = None
_user_stop_requested = False  # set by stop_scan(), checked by run_scan() to exit batch loop
_log_enabled = False
_debug_enabled = False
# Only one scan may run at a time: the scanner instances and flags above are shared.
_scan_lock = threading.Lock()
_scan_thread = None

DEFAULT_PORTS = [443, 80, 8443, 2053, 2083, 2087, 2096]
SETTINGS_DEFAULTS = {
    'theme': 'light', 'mode': 'hyper',
    'target_count': '100', 'ping_min': '0', 'ping_max': '9999',
    'scan_ports': '443,80,8443,2053,2083,2087,2096',
    'language': 'en', 'log_enabled': 'false',
    'debug_enabled': 'false',
    'operator_country': 'ir',
    'speed_test': 'false', 'speed_test_size': '1024', 'speed_test_count': '10',
    'speed_test_url': DEFAULT_SPEED_TEST_URL,
    'xray_test': 'false', 'xray_test_count': '20', 'xray_test_url': xray_mod.DEFAULT_TEST_URL,
    'profile': 'custom',  # last scan profile chosen in the UI
    'monitor_interval': '0',  # minutes between favorite-IP checks (0 = off)
    'telegram_token': '', 'telegram_chat_id': '', 'telegram_proxy': '',
}


def _to_int(value, default, lo=None, hi=None):
    """Parse an int from user input, falling back to `default` and clamping to [lo, hi]."""
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        n = default
    if lo is not None:
        n = max(lo, n)
    if hi is not None:
        n = min(hi, n)
    return n


def _scan_running():
    return _scan_thread is not None and _scan_thread.is_alive()


def _emit_log(level, message, session_id=None):
    """Emit log to WebSocket and optionally save to DB."""
    global _log_enabled, _debug_enabled
    # Skip DEBUG-level logs unless debug is enabled
    if level == 'DEBUG' and not _debug_enabled:
        return
    timestamp = utcnow().isoformat()
    log_entry = {'level': level, 'message': message, 'timestamp': timestamp}
    try:
        socketio.emit('scan_log', log_entry, namespace='/')
    except Exception:
        pass
    # DEBUG lines are emitted per IP from many worker threads; persisting them
    # would hammer the database, so only INFO and above are stored.
    if _log_enabled and session_id and level != 'DEBUG':
        try:
            log = ScanLog(session_id=session_id, level=level, message=message)
            db.session.add(log)
            db.session.commit()
        except Exception as e:
            logger.warning("Could not save scan log to database: %s", e)
            try:
                db.session.rollback()
            except Exception:
                pass


# ========== Settings ==========

@api_bp.route('/settings', methods=['GET'])
def get_settings():
    settings = {}
    for key, default in SETTINGS_DEFAULTS.items():
        settings[key] = AppSetting.get(key, default)
    return jsonify(settings)


@api_bp.route('/settings', methods=['POST'])
def save_settings():
    data = request.get_json(silent=True) or {}
    for key, value in data.items():
        if key in SETTINGS_DEFAULTS:
            AppSetting.set(key, str(value)[:2000])
    global _log_enabled
    if 'log_enabled' in data:
        _log_enabled = str(data['log_enabled']).lower() == 'true'
    return jsonify({'status': 'ok'})


# ========== Ranges ==========

@api_bp.route('/ranges/fetch', methods=['POST'])
def fetch_ranges():
    source = (request.get_json(silent=True) or {}).get('source', 'all')
    try:
        ranges = RangeFetcher.fetch_by_source(source)
        return jsonify({'ranges': ranges, 'count': len(ranges), 'source': source})
    except Exception as e:
        return jsonify({
            'ranges': [], 'count': 0, 'source': source,
            'error': str(e) or 'Server cannot reach the internet. Check firewall and DNS.'
        }), 200


@api_bp.route('/ranges/operators', methods=['GET'])
def get_operators():
    country = request.args.get('country', 'ir')
    operators = OPERATORS_BY_COUNTRY.get(country, OPERATORS_BY_COUNTRY['ir'])
    result = {}
    for key, info in operators.items():
        count = OperatorRange.query.filter_by(operator_key=key).count()
        result[key] = {
            'name': info['name'],
            'name_fa': info.get('name_fa', info['name']),
            'asn': info['asn'],
            'prefix_count': count,
        }
    return jsonify(result)


@api_bp.route('/ranges/operators/fetch', methods=['POST'])
def fetch_operator_ranges():
    data = request.get_json(silent=True) or {}
    operator_key = data.get('operator_key')
    country = data.get('country', 'ir')

    if not operator_key:
        return jsonify({'error': 'operator_key required'}), 400

    cnt, prefixes, err = fetch_all_operator_prefixes(operator_key, country)
    if err:
        return jsonify({'error': err, 'count': 0}), 500

    operators = OPERATORS_BY_COUNTRY.get(country, {})
    op_info = operators.get(operator_key, {})

    OperatorRange.query.filter_by(operator_key=operator_key).delete()
    for p in prefixes:
        db.session.add(OperatorRange(
            operator_key=operator_key,
            operator_name=op_info.get('name', operator_key),
            asn=str(op_info.get('asn', '')),
            prefix=p,
            country=country,
        ))
    db.session.commit()
    return jsonify({'count': cnt, 'operator': operator_key})


@api_bp.route('/ranges/operators/fetch-all', methods=['POST'])
def fetch_all_operators_route():
    """Fetch IP ranges for all operators in the selected country from RIPE/BGP (no local IP)."""
    country = (request.get_json(silent=True) or {}).get('country', 'ir')
    operators = OPERATORS_BY_COUNTRY.get(country, OPERATORS_BY_COUNTRY['ir'])
    results = {}
    for op_key in operators:
        cnt, prefixes, err = fetch_all_operator_prefixes(op_key, country)
        if not err and prefixes:
            OperatorRange.query.filter_by(operator_key=op_key).delete()
            op_info = operators[op_key]
            for p in prefixes:
                db.session.add(OperatorRange(
                    operator_key=op_key,
                    operator_name=op_info.get('name', op_key),
                    asn=str(op_info.get('asn', '')),
                    prefix=p,
                    country=country,
                ))
            db.session.commit()
        results[op_key] = {'count': cnt, 'error': err}
    return jsonify(results)


# ========== V2Ray Config ==========

@api_bp.route('/v2ray/parse', methods=['POST'])
def parse_v2ray_config():
    data = request.get_json(silent=True) or {}
    config_str = data.get('config', '')
    parsed = V2RayConfigParser.parse(config_str)
    if not parsed:
        return jsonify({'error': 'Invalid config format'}), 400
    return jsonify({
        'protocol': parsed['protocol'],
        'uuid': parsed['uuid'][:8] + '...',
        'ip': parsed['ip'],
        'port': parsed['port'],
        'params': {k: v for k, v in parsed['params'].items() if k != 'id'},
        'fragment': parsed.get('fragment', ''),
    })


@api_bp.route('/v2ray/build-config', methods=['POST'])
def build_v2ray_config():
    """Build config string with a new IP for download."""
    data = request.get_json(silent=True) or {}
    config_str = data.get('config', '')
    new_ip = data.get('ip', '')
    if not config_str or not new_ip:
        return jsonify({'error': 'config and ip required'}), 400
    parsed = V2RayConfigParser.parse(config_str)
    if not parsed:
        return jsonify({'error': 'Invalid config format'}), 400
    built = V2RayConfigParser.rebuild_config(parsed, new_ip)
    if not built:
        return jsonify({'error': 'Could not build config'}), 400
    return jsonify({'config': built})


def _session_ips(session_id, limit):
    """(parsed template config, best IPs first) of a V2Ray scan, or (None, None)."""
    sess = db.session.get(ScanSession, session_id)
    if not sess or not sess.v2ray_config:
        return None, None
    parsed = V2RayConfigParser.parse(sess.v2ray_config)
    if not parsed:
        return None, None
    rows = (ScanResult.query.filter_by(scan_session_id=session_id)
            .filter(db.or_(ScanResult.real_delay.is_(None), ScanResult.real_delay >= 0))  # skip failed real tests
            .order_by(ScanResult.score.desc()).limit(limit).all())
    return parsed, [r.ip for r in rows]


def _session_configs(session_id, limit):
    """Rebuilt V2Ray configs (best score first) for the IPs found by a V2Ray scan."""
    parsed, ips = _session_ips(session_id, limit)
    if parsed is None:
        return None
    return [V2RayConfigParser.rebuild_config(parsed, ip, name_suffix=f' | {ip}') for ip in ips]


@api_bp.route('/v2ray/export/<int:session_id>', methods=['GET'])
def v2ray_client_export(session_id):
    """Download the found IPs as a Clash/Mihomo (`?format=clash`) or sing-box (`?format=singbox`) config."""
    from flask import Response
    from app.scanner import client_export
    fmt = request.args.get('format', 'clash')
    if fmt not in client_export.SUPPORTED:
        return jsonify({'error': 'format must be clash or singbox'}), 400
    limit = _to_int(request.args.get('limit'), 50, lo=1, hi=1000)
    parsed, ips = _session_ips(session_id, limit)
    if parsed is None:
        return jsonify({'error': 'No V2Ray scan with this session id'}), 404
    if not ips:
        return jsonify({'error': 'This scan has no working IPs to export'}), 404
    try:
        text = client_export.export(parsed, ips, fmt,
                                    test_url=AppSetting.get('xray_test_url', xray_mod.DEFAULT_TEST_URL))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    filename = f'clash-{session_id}.yaml' if fmt == 'clash' else f'sing-box-{session_id}.json'
    return Response(text, mimetype='application/json' if fmt == 'singbox' else 'text/yaml',
                    headers={'Content-Disposition': f'attachment; filename={filename}'})


@api_bp.route('/v2ray/subscription/<int:session_id>', methods=['GET'])
def v2ray_subscription(session_id):
    """
    Subscription for V2Ray clients (v2rayN, v2rayNG, Hiddify, ...): base64 of one
    config per line. `?format=plain` returns the plain lines instead.
    """
    import base64
    from flask import Response
    limit = _to_int(request.args.get('limit'), 50, lo=1, hi=1000)
    configs = _session_configs(session_id, limit)
    if configs is None:
        return jsonify({'error': 'No V2Ray scan with this session id'}), 404
    text = '\n'.join(configs)
    if request.args.get('format') == 'plain':
        return Response(text, mimetype='text/plain; charset=utf-8')
    return Response(base64.b64encode(text.encode()).decode(), mimetype='text/plain',
                    headers={'Content-Disposition': f'inline; filename=sub-{session_id}.txt'})


@api_bp.route('/v2ray/qr', methods=['POST'])
def v2ray_qr():
    """QR code (SVG) of the config rebuilt with the given IP, for scanning with a phone."""
    from flask import Response
    import io
    import segno
    data = request.get_json(silent=True) or {}
    parsed = V2RayConfigParser.parse(data.get('config', ''))
    ip = str(data.get('ip', '')).strip()
    if not parsed or not ip:
        return jsonify({'error': 'config and ip required'}), 400
    built = V2RayConfigParser.rebuild_config(parsed, ip, name_suffix=f' | {ip}')
    buf = io.BytesIO()
    segno.make(built, error='m').save(buf, kind='svg', scale=5, border=2, dark='#000', light='#fff')
    return Response(buf.getvalue(), mimetype='image/svg+xml')


@api_bp.route('/xray/status', methods=['GET'])
def xray_status():
    path = xray_mod.find_xray()
    return jsonify({'available': bool(path), 'version': xray_mod.xray_version(path) if path else '',
                    'can_install': not current_app.config.get('FROZEN')})


@api_bp.route('/xray/install', methods=['POST'])
def xray_install():
    """Download the official Xray-core release (checksum-verified) into the data folder."""
    if _scan_running():
        return jsonify({'error': 'Stop the running scan first.'}), 409
    try:
        path = xray_mod.install_xray()
    except Exception as e:
        return jsonify({'error': f'Xray install failed: {e}'}), 502
    return jsonify({'available': True, 'version': xray_mod.xray_version(path)})


# ========== Scanning ==========

@api_bp.route('/scan/start', methods=['POST'])
def start_scan():
    with _scan_lock:
        if _scan_running():
            return jsonify({'error': 'A scan is already running. Stop it first.',
                            'session_id': _active_session_id}), 409
        return _start_scan_locked()


def _start_scan_locked():
    global _active_session_id, _log_enabled, _debug_enabled, _scan_thread

    data = request.get_json(silent=True) or {}
    ranges_input = data.get('ranges', [])
    scan_method = data.get('scan_method', 'cloud')
    mode = data.get('mode', 'hyper')
    target_count = data.get('target_count', 100)
    ping_min = _to_int(data.get('ping_min'), 0, lo=0, hi=60000)
    ping_max = _to_int(data.get('ping_max'), 9999, lo=1, hi=60000)
    if ping_min > ping_max:
        ping_min, ping_max = ping_max, ping_min
    ports_str = str(data.get('ports') or '')
    if not isinstance(ranges_input, list):
        ranges_input = str(ranges_input).split()
    operator_key = (data.get('operator_key') or '').strip() or None
    if operator_key:
        operator_key = operator_key.lower()
    country = (data.get('country') or 'ir').strip().lower() or 'ir'
    v2ray_config = data.get('v2ray_config', '')
    speed_opts = {
        'enabled': str(data.get('speed_test', False)).lower() in ('true', '1', 'yes'),
        'size_kb': _to_int(data.get('speed_test_size'), 1024, lo=64, hi=51200),
        'count': _to_int(data.get('speed_test_count'), 10, lo=1, hi=200),
        'url': str(data.get('speed_test_url') or DEFAULT_SPEED_TEST_URL).strip(),
    }
    xray_opts = {
        'enabled': (scan_method == 'v2ray' and
                    str(data.get('xray_test', False)).lower() in ('true', '1', 'yes')),
        'count': _to_int(data.get('xray_test_count'), 20, lo=1, hi=500),
        'url': str(data.get('xray_test_url') or xray_mod.DEFAULT_TEST_URL).strip(),
    }
    _log_enabled = str(data.get('log_enabled', True)).lower() in ('true', '1', 'yes')
    _debug_enabled = str(data.get('debug_enabled', False)).lower() in ('true', '1', 'yes')

    ports = [int(p.strip()) for p in ports_str.split(',')
             if p.strip().isdigit() and 0 < int(p.strip()) < 65536]
    if not ports:
        ports = list(DEFAULT_PORTS)

    if target_count == 'All':
        target_count = None
    else:
        target_count = _to_int(target_count, 100, lo=1, hi=100000)

    # Create session
    session = ScanSession(mode=mode, scan_method=scan_method, status='running',
                          v2ray_config=v2ray_config if scan_method == 'v2ray' else None)
    db.session.add(session)
    db.session.commit()
    sess_id = session.id
    _active_session_id = sess_id

    # CRITICAL: Get the CURRENT app reference - do NOT create_app() in thread
    app = current_app._get_current_object()

    def _scanner_log(level, message):
        with app.app_context():
            _emit_log(level, message, sess_id)

    _scanner.log_callback = _scanner_log
    # Reset once per scan (not per batch) so failed IPs stay cached across batches.
    _scanner.reset()
    _v2ray_scanner.reset()

    def run_scan():
        """Background scan thread - uses the EXISTING app context."""
        with app.app_context():
            try:
                start_time = time.time()
                sess = db.session.get(ScanSession, sess_id)
                if not sess:
                    return

                # Configure scanner
                _scanner.set_mode(mode)
                _scanner.max_latency_ms = ping_max
                _scanner.timeout = min(10, max(2, ping_max / 1000.0 * 1.5))

                _emit_log('INFO', f'Scan started: method={scan_method}, mode={mode}', sess_id)

                # Handle V2Ray scan method
                v2ray_parsed = None
                if scan_method == 'v2ray' and v2ray_config:
                    v2ray_parsed = V2RayConfigParser.parse(v2ray_config)
                    if not v2ray_parsed:
                        _emit_log('ERROR', 'Invalid V2Ray config', sess_id)
                        sess.status = 'completed'
                        db.session.commit()
                        socketio.emit('scan_complete', {'session_id': sess_id, 'total_found': 0}, namespace='/')
                        return
                    _v2ray_scanner.log_callback = _scanner_log
                    mode_cfg = SPEED_MODES.get(mode, SPEED_MODES['hyper'])
                    _v2ray_scanner.max_workers = max(20, int(50 * mode_cfg['resource_pct']))
                    _emit_log('INFO', f'V2Ray config parsed: {v2ray_parsed["protocol"]}', sess_id)

                # Build IPs from ranges using /24-splitting mechanism
                mode_cfg = SPEED_MODES.get(mode, SPEED_MODES['hyper'])
                ips_per_24 = mode_cfg.get('ips_per_24', 30)
                scan_ranges = list(ranges_input) if ranges_input else []

                if scan_method == 'operators':
                    if not scan_ranges:
                        _emit_log('INFO', 'Operator mode: fetching CDN IP ranges...', sess_id)
                        try:
                            # فقط از منابع رسمی
                            scan_ranges = RangeFetcher.fetch_by_source('all')
                            _emit_log('INFO', f'Fetched {len(scan_ranges)} CDN ranges (official)', sess_id)
                        except Exception as e:
                            _emit_log('ERROR', f'Failed to fetch CDN ranges: {e}', sess_id)
                    else:
                        _emit_log('INFO', f'Operator mode: using {len(scan_ranges)} CDN ranges (ping+port check)', sess_id)
                    if not scan_ranges:
                        _emit_log('WARN', 'No CDN ranges. Paste CDN ranges or click Fetch Ranges.', sess_id)

                # Batch size per round
                batch_size = max(target_count * 100, 5000) if target_count else 100000
                max_total_scanned = 500000  # safety: stop after 500k IPs tried
                total_scanned = 0

                found = 0
                found_results = []  # for the speed-test phase
                found_ips = set()  # random sampling can pick the same IP in several batches

                def on_progress(done, total_ips, speed=0, elapsed=0):
                    nonlocal total_scanned
                    if target_count and target_count > 0:
                        pct = min(100.0, (found / target_count) * 100.0)
                    else:
                        pct = (done / total_ips * 100) if total_ips > 0 else 0
                    socketio.emit('scan_progress', {
                        'done': total_scanned + done, 'total': total_scanned + total_ips,
                        'percent': round(pct, 1), 'speed': round(speed, 1),
                        'elapsed': round(elapsed, 1), 'session_id': sess_id,
                    }, namespace='/')

                _session_operator_name = ''
                if scan_method in ('operators', 'v2ray'):
                    if operator_key:
                        operators_dict = OPERATORS_BY_COUNTRY.get(country, OPERATORS_BY_COUNTRY['ir'])
                        if operator_key in operators_dict:
                            _session_operator_name = operators_dict[operator_key].get('name', operator_key)
                            _emit_log('INFO', f'Operator: {_session_operator_name} — results are labeled with this operator', sess_id)
                    if not _session_operator_name:
                        _emit_log('INFO', 'Select an operator from the list (operator column will be empty otherwise).', sess_id)
                    # All checks run from this server's own network connection: the
                    # operator label is only accurate if the server is on that operator.
                    _emit_log('WARN', 'Note: IPs are tested from THIS server\'s network. Results reflect the selected '
                                      'operator only if the server itself is connected through that operator.', sess_id)

                if not scan_ranges:
                    _emit_log('WARN', 'No CDN ranges. Paste CDN ranges or click Fetch Ranges.', sess_id)
                    sess.status = 'completed'
                    sess.duration = 0
                    db.session.commit()
                    socketio.emit('scan_complete', {'session_id': sess_id, 'total_found': 0, 'duration': 0}, namespace='/')
                    return

                _emit_log('INFO', f'Target: {target_count or "unlimited"} — scan will run until target reached or max IPs tried', sess_id)

                def on_result(result):
                    nonlocal found
                    if target_count and found >= target_count:
                        _scanner.stop()
                        _v2ray_scanner.stop()
                        return
                    ping_val = result.get('ping')
                    if ping_val is not None and (ping_val < ping_min or ping_val > ping_max):
                        return
                    if result['ip'] in found_ips:
                        return
                    found_ips.add(result['ip'])

                    operator_name = result.get('operator') or ''
                    if scan_method in ('operators', 'v2ray'):
                        operator_name = operator_name or _session_operator_name or ''
                    operator_name = (operator_name or '').strip()

                    score = SHScanner.calc_score(result)
                    sr = ScanResult(
                        ip=result['ip'],
                        ping=result.get('ping'),
                        open_ports=json.dumps(result.get('open_ports', [])),
                        score=score,
                        operator=operator_name,
                        colo=result.get('colo') or None,
                        scan_session_id=sess_id,
                    )
                    db.session.add(sr)
                    found += 1
                    found_results.append(dict(result, score=score))
                    socketio.emit('scan_result', {
                        'ip': result['ip'],
                        'ping': round(result.get('ping', 0), 1) if result.get('ping') else None,
                        'open_ports': result.get('open_ports', []),
                        'score': round(score, 1),
                        'operator': operator_name,
                        'colo': result.get('colo') or '',
                        'session_id': sess_id,
                        'is_v2ray': scan_method == 'v2ray',
                    }, namespace='/')
                    _emit_log('INFO', f'Found: {result["ip"]} ping={round(result.get("ping",0),1)}ms ports={result.get("open_ports",[])} op={operator_name}', sess_id)
                    try:
                        db.session.commit()
                    except Exception as e:
                        logger.warning("Could not save scan result %s: %s", result['ip'], e)
                        db.session.rollback()

                batch_num = 0
                tried_ips = set()
                global _user_stop_requested
                _user_stop_requested = False
                while True:
                    if _user_stop_requested:
                        _emit_log('INFO', 'Scan stopped by user.', sess_id)
                        break
                    if target_count and found >= target_count:
                        break
                    if total_scanned >= max_total_scanned:
                        _emit_log('INFO', f'Reached max IPs to try ({max_total_scanned}). Stopping.', sess_id)
                        break

                    batch_num += 1
                    all_ips = SHNetUtils.generate_scan_ips(
                        scan_ranges,
                        per_block=ips_per_24,
                        max_total=batch_size,
                        shuffle=True,
                    )
                    # Skip IPs already tried in earlier batches; small ranges run out.
                    all_ips = [ip for ip in all_ips if str(ip) not in tried_ips]
                    if not all_ips:
                        _emit_log('INFO', 'All IPs in the given ranges have been tried.', sess_id)
                        break
                    tried_ips.update(str(ip) for ip in all_ips)

                    _emit_log('INFO', f'Batch {batch_num}: scanning {len(all_ips)} IPs (target {target_count or "—"}, found {found} so far)', sess_id)
                    socketio.emit('scan_status', {
                        'status': 'scanning', 'total': total_scanned + len(all_ips), 'session_id': sess_id
                    }, namespace='/')

                    if scan_method == 'v2ray' and v2ray_parsed:
                        _v2ray_scanner.scan_ips(
                            v2ray_parsed, [str(ip) for ip in all_ips],
                            timeout=min(8, max(1.5, ping_max / 1000.0 * 1.5)),
                            progress_callback=on_progress,
                            result_callback=on_result,
                        )
                    else:
                        _scanner.batch_scan(
                            all_ips, ports,
                            progress_callback=on_progress,
                            result_callback=on_result,
                            start_time=start_time,
                        )

                    total_scanned += len(all_ips)
                    if target_count and found >= target_count:
                        _emit_log('INFO', f'Target reached: {found} IPs found.', sess_id)
                        break
                    if not target_count:
                        break
                    if _user_stop_requested:
                        _emit_log('INFO', 'Scan stopped by user.', sess_id)
                        break

                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()

                if xray_opts['enabled'] and v2ray_parsed and found_results and not _user_stop_requested:
                    _run_xray_tests(sess_id, v2ray_parsed, found_results, xray_opts)

                if speed_opts['enabled'] and found_results and not _user_stop_requested:
                    _run_speed_tests(sess_id, found_results, speed_opts)

                elapsed = time.time() - start_time
                sess = db.session.get(ScanSession, sess_id)
                if sess:
                    sess.total_scanned = total_scanned
                    sess.total_found = found
                    sess.duration = round(elapsed, 1)
                    if sess.status == 'running':
                        sess.status = 'completed'
                    sess.completed_at = utcnow()
                    db.session.commit()

                _emit_log('INFO', f'Scan complete: {found}/{total_scanned} IPs found in {elapsed:.1f}s', sess_id)
                socketio.emit('scan_complete', {
                    'session_id': sess_id,
                    'total_scanned': total_scanned,
                    'total_found': found,
                    'duration': round(elapsed, 1),
                }, namespace='/')

            except Exception as e:
                tb = traceback.format_exc()
                _emit_log('ERROR', f'Scan error: {str(e)}\n{tb}', sess_id)
                try:
                    sess = db.session.get(ScanSession, sess_id)
                    if sess:
                        sess.status = 'error'
                        db.session.commit()
                except Exception:
                    db.session.rollback()
                socketio.emit('scan_error', {'error': str(e), 'session_id': sess_id}, namespace='/')

    _scan_thread = threading.Thread(target=run_scan, daemon=True)
    _scan_thread.start()

    return jsonify({'session_id': sess_id, 'status': 'started'})


def _save_result_fields(sess_id, res, **fields):
    """Update a stored result (and its score) after a post-scan test."""
    res.update(fields)
    score = SHScanner.calc_score(res)
    res['score'] = score
    row = ScanResult.query.filter_by(scan_session_id=sess_id, ip=res['ip']).first()
    if row:
        for key, value in fields.items():
            setattr(row, key, value)
        row.score = score
        try:
            db.session.commit()
        except Exception as e:
            logger.warning("Could not update result %s: %s", res['ip'], e)
            db.session.rollback()
    return score


def _run_xray_tests(sess_id, parsed, found_results, opts):
    """Real-delay test of the best IPs through Xray-core with the user's own config."""
    path = xray_mod.find_xray()
    if not path:
        _emit_log('WARN', 'Xray real test skipped: Xray-core is not installed (Settings → Install Xray).', sess_id)
        return
    candidates = sorted(found_results, key=lambda r: r.get('ping') or 1e9)[:opts['count']]
    by_ip = {r['ip']: r for r in candidates}
    _emit_log('INFO', f'Xray real test: {len(candidates)} IPs via {opts["url"]}', sess_id)
    socketio.emit('scan_status', {'status': 'xray_testing', 'total': len(candidates),
                                  'session_id': sess_id}, namespace='/')
    done = [0]

    def on_result(ip, delay):
        done[0] += 1
        real_delay = delay if delay is not None else -1.0
        score = _save_result_fields(sess_id, by_ip[ip], real_delay=real_delay)
        socketio.emit('scan_result_update', {
            'ip': ip, 'real_delay': real_delay, 'score': round(score, 1), 'session_id': sess_id,
        }, namespace='/')
        socketio.emit('scan_progress', {
            'done': done[0], 'total': len(candidates), 'percent': round(done[0] * 100.0 / len(candidates), 1),
            'speed': 0, 'elapsed': 0, 'session_id': sess_id, 'phase': 'xray',
        }, namespace='/')
        _emit_log('INFO', f'Real delay {ip}: ' + (f'{delay:.0f} ms' if delay is not None else 'failed'), sess_id)

    try:
        tester = xray_mod.XrayRealTester(path, test_url=opts['url'],
                                         log=lambda level, msg: _emit_log(level, msg, sess_id))
        tester.test(parsed, [r['ip'] for r in candidates],
                    should_stop=lambda: _user_stop_requested, on_result=on_result)
    except ValueError as e:  # unsupported config (e.g. REALITY / unknown transport)
        _emit_log('WARN', f'Xray real test skipped: {e}', sess_id)


def _run_speed_tests(sess_id, found_results, opts):
    """
    Measure download speed of the best (lowest ping) found IPs one after another
    (in parallel they would share the bandwidth and the numbers would be wrong).
    """
    # IPs that failed the Xray real test do not carry traffic: no point measuring them
    usable = [r for r in found_results if (r.get('real_delay') is None or r['real_delay'] >= 0)]
    candidates = sorted(usable, key=lambda r: r.get('ping') or 1e9)[:opts['count']]
    if not candidates:
        return
    _emit_log('INFO', f'Speed test: {len(candidates)} IPs, {opts["size_kb"]} KB each', sess_id)
    socketio.emit('scan_status', {'status': 'speed_testing', 'total': len(candidates),
                                  'session_id': sess_id}, namespace='/')
    for i, res in enumerate(candidates, 1):
        if _user_stop_requested:
            _emit_log('INFO', 'Speed test stopped by user.', sess_id)
            break
        speed = measure_download(res['ip'], size_kb=opts['size_kb'], url=opts['url'],
                                 should_stop=lambda: _user_stop_requested)
        score = _save_result_fields(sess_id, res, speed=speed)
        socketio.emit('scan_result_update', {
            'ip': res['ip'], 'speed': speed, 'score': round(score, 1), 'session_id': sess_id,
        }, namespace='/')
        socketio.emit('scan_progress', {
            'done': i, 'total': len(candidates), 'percent': round(i * 100.0 / len(candidates), 1),
            'speed': 0, 'elapsed': 0, 'session_id': sess_id, 'phase': 'speed',
        }, namespace='/')
        _emit_log('INFO', f'Speed {res["ip"]}: ' + (f'{speed:.0f} KB/s' if speed else 'failed'), sess_id)


@api_bp.route('/scan/stop', methods=['POST'])
def stop_scan():
    global _active_session_id, _user_stop_requested
    _user_stop_requested = True
    _scanner.stop()
    _v2ray_scanner.stop()
    if _active_session_id:
        session = db.session.get(ScanSession, _active_session_id)
        if session and session.status == 'running':
            session.status = 'stopped'
            session.completed_at = utcnow()
            db.session.commit()
    return jsonify({'status': 'stopped'})


@api_bp.route('/scan/results', methods=['GET'])
def get_results():
    session_id = request.args.get('session_id', type=int)
    limit = _to_int(request.args.get('limit'), 200, lo=1, hi=10000)
    q = ScanResult.query
    if session_id:
        q = q.filter_by(scan_session_id=session_id)
    results = q.order_by(ScanResult.score.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in results])


@api_bp.route('/scan/sessions', methods=['GET'])
def get_sessions():
    sessions = ScanSession.query.order_by(ScanSession.id.desc()).limit(20).all()
    return jsonify([s.to_dict() for s in sessions])


@api_bp.route('/scan/logs', methods=['GET'])
def get_logs():
    session_id = request.args.get('session_id', type=int)
    limit = _to_int(request.args.get('limit'), 100, lo=1, hi=10000)
    q = ScanLog.query
    if session_id:
        q = q.filter_by(session_id=session_id)
    logs = q.order_by(ScanLog.id.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs])


# ========== Export ==========

EXPORT_HEADERS = {
    'fa': ('رتبه', 'آدرس IP', 'Ping', 'پورت\u200cها', 'امتیاز', 'اپراتور', 'دیتاسنتر', 'سرعت (KB/s)', 'تأخیر واقعی (ms)'),
    'en': ('#', 'IP', 'Ping', 'Ports', 'Score', 'Operator', 'Colo', 'Speed (KB/s)', 'Real delay (ms)'),
}


@api_bp.route('/export/<fmt>', methods=['GET'])
def export_results(fmt):
    from flask import Response
    session_id = request.args.get('session_id', type=int)
    lang = (request.args.get('lang') or 'en').strip().lower()
    if lang not in EXPORT_HEADERS:
        lang = 'en'
    q = ScanResult.query
    if session_id:
        q = q.filter_by(scan_session_id=session_id)
    results = q.order_by(ScanResult.score.desc()).all()

    if fmt == 'json':
        output = json.dumps([r.to_dict() for r in results], indent=2, ensure_ascii=False)
        return Response(output, mimetype='application/json',
                        headers={'Content-Disposition': 'attachment;filename=scan_results.json'})
    elif fmt == 'txt':
        lines = [r.ip for r in results]
        return Response('\n'.join(lines), mimetype='text/plain',
                        headers={'Content-Disposition': 'attachment;filename=scan_ips.txt'})
    elif fmt == 'excel':
        try:
            import openpyxl
            from io import BytesIO
        except ImportError:
            return jsonify({'error': 'Excel export requires openpyxl'}), 500
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Results'
        headers = EXPORT_HEADERS[lang]
        for col, h in enumerate(headers, 1):
            ws.cell(row=1, column=col, value=h)
        for row_idx, r in enumerate(results, 2):
            ports_list = json.loads(r.open_ports) if r.open_ports else []
            ports_str = ' '.join(str(p) for p in ports_list) if ports_list else ''
            ws.cell(row=row_idx, column=1, value=row_idx - 1)
            ws.cell(row=row_idx, column=2, value=r.ip or '')
            ws.cell(row=row_idx, column=3, value=round(r.ping, 1) if r.ping is not None else '')
            ws.cell(row=row_idx, column=4, value=ports_str)
            ws.cell(row=row_idx, column=5, value=round(r.score, 1) if r.score is not None else '')
            ws.cell(row=row_idx, column=6, value=(r.operator or ''))
            ws.cell(row=row_idx, column=7, value=(r.colo or ''))
            ws.cell(row=row_idx, column=8, value=round(r.speed, 1) if r.speed is not None else '')
            real = '' if r.real_delay is None else ('failed' if r.real_delay < 0 else round(r.real_delay))
            ws.cell(row=row_idx, column=9, value=real)
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment;filename=scan_results.xlsx'}
        )
    else:
        return jsonify({'error': 'Unsupported format'}), 400


# ========== Reset ==========

@api_bp.route('/reset', methods=['POST'])
def reset_data():
    if _scan_running():
        return jsonify({'error': 'Stop the running scan first.'}), 409
    ScanResult.query.delete()
    ScanLog.query.delete()
    ScanSession.query.delete()
    db.session.commit()
    return jsonify({'status': 'ok'})


# ========== Info ==========

@api_bp.route('/info', methods=['GET'])
def app_info():
    return jsonify({
        'version': current_app.config.get('VERSION', '2.0'),
        'author': current_app.config.get('AUTHOR', 'shahinst'),
        'github': current_app.config.get('GITHUB_REPO_URL', ''),
        'speed_modes': {k: v['label'] for k, v in SPEED_MODES.items()},
    })


# ========== Update System ==========

@api_bp.route('/check-update', methods=['POST'])
def check_update():
    """Check GitHub for newer version."""
    import requests as req
    current_version = current_app.config.get('VERSION', '2.0')
    version_url = 'https://raw.githubusercontent.com/shahinst/cdn-ip-scanner/main/version'
    try:
        r = req.get(version_url, timeout=10)
        if r.status_code != 200:
            return jsonify({'error': f'Failed to fetch version (HTTP {r.status_code})'}), 200
        remote_version = r.text.strip()
        if not remote_version:
            return jsonify({'error': 'Empty version file'}), 200

        def parse_ver(v):
            parts = []
            for p in v.replace('-', '.').split('.'):
                try:
                    parts.append(int(p))
                except ValueError:
                    parts.append(0)
            return parts

        rv = parse_ver(remote_version)
        cv = parse_ver(current_version)
        update_available = rv > cv

        return jsonify({
            'current_version': current_version,
            'remote_version': remote_version,
            'update_available': update_available,
            'can_self_update': bool(current_app.config.get('ALLOW_WEB_UPDATE')),
            'download_url': current_app.config.get('RELEASES_URL', ''),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 200


@api_bp.route('/do-update', methods=['POST'])
def do_update():
    """Pull latest from GitHub and restart."""
    import subprocess
    import sys
    import os

    if not current_app.config.get('ALLOW_WEB_UPDATE', True):
        if current_app.config.get('FROZEN'):
            return jsonify({'error': 'Download the new version from the Releases page.',
                            'download_url': current_app.config.get('RELEASES_URL', '')}), 403
        return jsonify({'error': 'Web update is disabled on this server (ALLOW_WEB_UPDATE=false).'}), 403
    if _scan_running():
        return jsonify({'error': 'Stop the running scan before updating.'}), 409

    base_dir = current_app.config.get('BASE_DIR', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    try:
        git_check = subprocess.run(['git', 'status'], cwd=base_dir,
                                   capture_output=True, text=True, timeout=10)
        if git_check.returncode != 0:
            return jsonify({'error': 'Not a git repository. Please install via git clone.'}), 200

        pull_result = subprocess.run(['git', 'pull', 'origin', 'main'], cwd=base_dir,
                                     capture_output=True, text=True, timeout=60)
        if pull_result.returncode != 0:
            pull_result = subprocess.run(['git', 'pull', '--rebase', 'origin', 'main'], cwd=base_dir,
                                         capture_output=True, text=True, timeout=60)

        req_file = os.path.join(base_dir, 'requirements.txt')
        if os.path.exists(req_file):
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req_file, '-q'],
                          cwd=base_dir, capture_output=True, text=True, timeout=120)

        def restart_app():
            import time as _time
            _time.sleep(2)
            os.execv(sys.executable, [sys.executable] + sys.argv)

        restart_thread = threading.Thread(target=restart_app, daemon=True)
        restart_thread.start()

        return jsonify({
            'status': 'ok',
            'message': 'Update complete. Restarting...',
            'git_output': pull_result.stdout or pull_result.stderr,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 200
