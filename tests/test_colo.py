"""Colo code -> city table shared with the Android app."""
import re
from pathlib import Path

from app.scanner.colo import COLO_NAMES, colo_label, colo_name


def test_lookup_is_case_insensitive_and_safe():
    assert colo_name('fra') == 'Frankfurt, DE'
    assert colo_label(' ist ') == 'IST (Istanbul, TR)'
    assert colo_label('XXX') == 'XXX' and colo_label(None) == '' and colo_name('') == ''


def test_table_matches_android_app():
    kt = Path(__file__).resolve().parents[1] / 'android/app/src/main/java/com/shahinst/cdnscanner/scan/Colo.kt'
    pairs = dict(re.findall(r'"([A-Z0-9]{3,4})" to "([^"]+)"', kt.read_text(encoding='utf-8')))
    assert pairs == COLO_NAMES
