"""
SH IP Scanner V2.0 - Main Routes
Author: shahinst
"""

from flask import Blueprint, render_template, current_app

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    return render_template('index.html',
                           version=current_app.config.get('VERSION', '2.0'),
                           author=current_app.config.get('AUTHOR', 'shahinst'))


@main_bp.route('/scanner')
@main_bp.route('/scanner/<lang>')
def scanner(lang='en'):
    if lang not in ('en', 'fa', 'zh', 'ru'):
        lang = 'en'
    return render_template('scanner.html', lang=lang,
                           version=current_app.config.get('VERSION', '2.0'),
                           author=current_app.config.get('AUTHOR', 'shahinst'))
