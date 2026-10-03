"""
CDN IP Scanner - Favorite IPs API
Author: shahinst
"""

import ipaddress

from flask import Blueprint, jsonify, request

from app import db
from app.models import AppSetting, FavoriteIP, IPCheck
from app import monitor

favorites_bp = Blueprint('favorites', __name__)


@favorites_bp.route('/favorites', methods=['GET'])
def list_favorites():
    return jsonify(monitor.favorites_payload())


@favorites_bp.route('/favorites', methods=['POST'])
def add_favorite():
    data = request.get_json(silent=True) or {}
    try:
        ip = str(ipaddress.ip_address(str(data.get('ip', '')).strip()))
    except ValueError:
        return jsonify({'error': 'Invalid IP address'}), 400
    try:
        port = int(data.get('port') or 443)
    except (TypeError, ValueError):
        port = 443
    if not 0 < port < 65536:
        port = 443
    fav = FavoriteIP.query.filter_by(ip=ip).first()
    if fav is None:
        fav = FavoriteIP(ip=ip)
        db.session.add(fav)
    fav.port = port
    fav.label = str(data.get('label') or '')[:100] or fav.label
    if data.get('ping') is not None and fav.last_checked is None:
        try:
            fav.last_ping = float(data['ping'])
        except (TypeError, ValueError):
            pass
    if data.get('colo'):
        fav.last_colo = str(data['colo'])[:10]
    db.session.commit()
    return jsonify(fav.to_dict()), 201


@favorites_bp.route('/favorites/<path:ip>', methods=['DELETE'])
def delete_favorite(ip):
    fav = FavoriteIP.query.filter_by(ip=ip).first()
    if not fav:
        return jsonify({'error': 'Not found'}), 404
    IPCheck.query.filter_by(ip=ip).delete()
    db.session.delete(fav)
    db.session.commit()
    return jsonify({'status': 'deleted'})


@favorites_bp.route('/favorites/check', methods=['POST'])
def check_now():
    went_down, came_back = monitor.check_favorites()
    return jsonify({'favorites': monitor.favorites_payload(),
                    'went_down': went_down, 'came_back': came_back})


@favorites_bp.route('/telegram/test', methods=['POST'])
def telegram_test():
    """Send a test message with the given (or saved) Telegram settings."""
    data = request.get_json(silent=True) or {}
    ok, err = monitor.send_telegram(
        'CDN IP Scanner: Telegram notifications are working ✅',
        token=data.get('telegram_token', AppSetting.get('telegram_token', '')),
        chat_id=data.get('telegram_chat_id', AppSetting.get('telegram_chat_id', '')),
        proxy=data.get('telegram_proxy', AppSetting.get('telegram_proxy', '')),
    )
    if not ok:
        return jsonify({'error': err}), 400
    return jsonify({'status': 'sent'})
