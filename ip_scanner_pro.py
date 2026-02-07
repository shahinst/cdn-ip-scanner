#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CDN IP Scanner V1.0
Author: شاهین سالک توتونچی (shahin salek tootoonchi)
GitHub: github.com/shahinst
Website: digicloud.tr
YouTube: https://www.youtube.com/@shaahinst
"""

import os
import re
import sys
import socket
import math
import json
import time
import random
from queue import Queue
from datetime import datetime

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
from tkinter import font as tkfont

import ipaddress
import requests
import webbrowser
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# بارگذاری فونت از فایل در ویندوز (Windows API) — Vazirmatn، EV Sam، Font Awesome 6
def _load_fonts_win(font_dir):
    if sys.platform != "win32":
        return
    try:
        from ctypes import windll, byref, create_unicode_buffer
        FR_PRIVATE = 0x10
        names = (
            "Vazirmatn-Regular.ttf", "Vazirmatn-Bold.ttf",
            "EV-Sam-Regular.ttf", "EV-Sam-Bold.ttf", "EVSam-Regular.ttf", "EVSam-Bold.ttf",
            "fa-solid-900.ttf", "fa-brands-400.ttf",  # Font Awesome 6 Free
        )
        for name in names:
            path = os.path.join(font_dir, name)
            if os.path.isfile(path):
                path_buf = create_unicode_buffer(path)
                windll.gdi32.AddFontResourceExW(byref(path_buf), FR_PRIVATE, None)
    except Exception:
        pass

# Font Awesome 6 Free — یونیکد آیکن‌ها (PUA)
FA = {
    "rocket": "\uf135", "gear": "\uf013", "bolt": "\uf0e7", "check": "\uf00c", "clock": "\uf017",
    "bullseye": "\uf140", "satellite": "\uf7c0", "robot": "\uf544", "save": "\uf0c7", "stop": "\uf04d",
    "play": "\uf04b", "chart": "\uf201", "star": "\uf005", "lock_open": "\uf3c1", "location": "\uf3c5",
    "trophy": "\uf091", "gem": "\uf3a5", "moon": "\uf186", "sun": "\uf185",
    "github": "\uf09b", "youtube": "\uf167",  # brands
}
# رنگ پیشنهادی برای آیکن‌ها (نام کلید تم یا هگز)
FA_COLORS = {
    "rocket": "#6366f1", "gear": "#8b5cf6", "bolt": "#eab308", "check": "#22c55e", "clock": "#0ea5e9",
    "bullseye": "#f97316", "satellite": "#06b6d4", "robot": "#a855f7", "save": "#3b82f6", "stop": "#ef4444",
    "play": "#22c55e", "chart": "#8b5cf6", "star": "#eab308", "lock_open": "#10b981", "location": "#ec4899",
    "trophy": "#f59e0b", "gem": "#06b6d4", "moon": "#64748b", "sun": "#eab308",
    "github": "#f0f6fc", "youtube": "#ef4444",
}

# Try to import openpyxl for Excel export
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

# ===== Author & Links =====
AUTHOR_NAME = "شاهین سالک توتونچی"
GITHUB_URL = "https://github.com/shahinst"
GITHUB_REPO_URL = "https://github.com/shahinst/cdn-ip-scanner"  # پروژه گیت‌هاب
WEBSITE_URL = "https://digicloud.tr"
YOUTUBE_URL = "https://www.youtube.com/@shaahinst"

# ===== Translations (en, fa, zh, ru) =====
TRANSLATIONS = {
    "en": {
        "app_title": "CDN IP Scanner V1.0",
        "app_subtitle": "High accuracy • Ultra fast • AI powered ⚡",
        "loading": "Loading...",
        "choose_language": "Choose language",
        "target": "Target",
        "speed": "Speed",
        "found": "Found",
        "time": "Time",
        "settings": "Settings ⚙️",
        "mode": "Mode 🔥",
        "ai": "AI 🤖",
        "count": "Count 🎯",
        "fetch_ranges_btn": "Fetch Ranges 📡",
        "analyze_btn": "AI Analyze 🤖",
        "save_btn": "Save 💾",
        "stop_btn": "Stop ⏹️",
        "start_btn": "Start Scan 🚀",
        "progress_title": "Progress 📊",
        "ready_status": "Ready to start ⚡",
        "results_title": "Results (by speed) 🎯",
        "score_hdr": "Score ⭐",
        "ports_hdr": "Ports 🔓",
        "ping_hdr": "Ping ⚡",
        "ip_hdr": "IP 📍",
        "rank_hdr": "Rank 🏆",
        "made_by": "Made with ❤️ by {}",
        "author_display": "shahin salek tootoonchi",
        "website_link_text": "Buy server",
        "donate_text": "💎 Donate (USDT): 0xde200d...c269",
        "github_text": "GitHub ⭐",
        "youtube_text": "YouTube 📺",
        "donate_title": "Support Development 💎",
        "donate_desc": "If this tool helped you, you can support with a donation:",
        "copy_btn": "Copy Address 📋",
        "close_btn": "Close",
        "thanks": "🙏 Thank you for your support!",
        "range_fetcher_title": "Fetch IP Ranges 📡",
        "range_sources_title": "Fetch IP ranges from sources 📡",
        "ranges_received": "Ranges received 📋:",
        "ready_fetch": "Ready to fetch...",
        "fetching": "Fetching...",
        "error_fetch": "Error fetching ranges!",
        "cf_api": "Official API - Cloudflare ☁️",
        "cf_asn": "ASN - Cloudflare 🔢",
        "cf_github": "GitHub - Cloudflare 🐙",
        "fastly_api": "Official API - Fastly ⚡",
        "fastly_asn": "ASN - Fastly 🔢",
        "all_sources": "All sources (recommended) 🌐",
        "export_menu_title": "Choose export format 💾",
        "excel_btn": "Excel (xlsx) 📊",
        "json_btn": "JSON (json) 📄",
        "msg_no_results": "No results to save!",
        "msg_saved": "File saved!",
        "msg_error": "Error",
        "msg_copied": "Copied!",
        "ip_copied": "IP copied: {}",
        "error_title": "Error",
        "success_title": "Success",
        "analyze_title": "AI Analysis",
        "no_results_analyze": "No results to analyze!",
        "openpyxl_missing": "openpyxl not installed. Run: pip install openpyxl",
        "file_saved": "File saved!\n{}",
        "save_error": "Save error:\n{}",
        "scan_done": "Done! {} IP in {}s ✅",
        "mode_turbo": "Turbo (10s)", "mode_hyper": "Hyper (5s)", "mode_ultra": "Ultra (15s)", "mode_deep": "Deep (30s)",
        "ai_basic": "Basic", "ai_smart": "Smart", "ai_advanced": "Advanced", "ai_expert": "Expert",
        "target_50": "50", "target_100": "100", "target_150": "150", "target_200": "200", "target_500": "500", "target_1000": "1000", "target_all": "All",
        "coming_future_updates": "Will be added in future updates.",
        "range_source_label": "Range source:",
        "range_source_none": "—",
        "fetch_status": "{} ranges from {} ✅",
        "source_cf_api": "Cloudflare API", "source_cf_asn": "Cloudflare ASN", "source_cf_github": "Cloudflare GitHub",
        "source_fastly_api": "Fastly API", "source_fastly_asn": "Fastly ASN", "source_all": "All Sources",
        "status_fetch": "Fetching ranges... 🔍",
        "status_analyze": "Analyzing {} ranges... 🤖",
        "status_scan": "Scanning {} ranges... ⚡",
        "status_pct": "Scan... {}% ⚡",
        "made_by_simple": "Programming and design by: shahin salek tootoonchi",
        "settings_main": "Main settings",
        "settings_theme": "Theme / Color",
        "settings_ip_check": "IP check method",
        "ip_check_my_internet": "Check IPs with my internet",
        "ip_check_agent": "Use agent for search",
        "ip_check_agent_message": "This feature will be added in future updates. For now you can only search using your own internet.",
        "settings_saved": "Settings saved.",
        "rescan_closed_title": "Previously scanned IPs",
        "rescan_closed_message": "You have {} IP(s) that were previously scanned and had no open ports. Do you want to rescan them too?",
        "rescan_yes": "Yes, rescan them",
        "rescan_no": "No, skip them",
        "ping_unsuitable": "Unsuitable",
        "select_range_first": "Select your range from the active ranges first, then start the scan.",
        "ranges_to_scan_label": "Ranges to scan (check/uncheck):",
        "no_ranges_loaded": "No ranges loaded. Fetch ranges from Cloudflare or Fastly API first.",
        "rescan_blocked_message": "Last time you had {} blocked IP(s) (no ping, no open ports). Rescan all of them or scan the rest only?",
    },
    "fa": {
        "app_title": "CDN IP Scanner V1.0",
        "app_subtitle": "دقت بالا • سرعت فوق‌العاده • قدرت هوش مصنوعی ⚡",
        "loading": "در حال بارگذاری...",
        "choose_language": "زبان را انتخاب کنید",
        "target": "هدف",
        "speed": "سرعت",
        "found": "یافت شده",
        "time": "زمان",
        "settings": "تنظیمات ⚙️",
        "mode": "حالت 🔥",
        "ai": "AI 🤖",
        "count": "تعداد 🎯",
        "fetch_ranges_btn": "دریافت رنج‌ها 📡",
        "analyze_btn": "تحلیل AI 🤖",
        "save_btn": "ذخیره 💾",
        "stop_btn": "توقف ⏹️",
        "start_btn": "شروع اسکن 🚀",
        "progress_title": "پیشرفت 📊",
        "ready_status": "آماده برای شروع ⚡",
        "results_title": "نتایج (مرتب شده بر اساس سرعت) 🎯",
        "score_hdr": "امتیاز ⭐",
        "ports_hdr": "پورت‌ها 🔓",
        "ping_hdr": "Ping ⚡",
        "ip_hdr": "آدرس IP 📍",
        "rank_hdr": "رتبه 🏆",
        "made_by": "ساخته شده با ❤️ توسط {}",
        "author_display": AUTHOR_NAME,
        "website_link_text": "خرید سرور",
        "donate_text": "💎 Donate (USDT): 0xde200d...c269",
        "github_text": "GitHub ⭐",
        "youtube_text": "یوتیوب 📺",
        "donate_title": "حمایت از توسعه 💎",
        "donate_desc": "اگر این ابزار برات مفید بود، می‌تونی با دونیت حمایت کنی:",
        "copy_btn": "کپی آدرس 📋",
        "close_btn": "بستن",
        "thanks": "🙏 ممنون از حمایتت!",
        "range_fetcher_title": "دریافت رنج‌های IP 📡",
        "range_sources_title": "دریافت رنج‌های IP از منابع مختلف 📡",
        "ranges_received": "رنج‌های دریافت شده 📋:",
        "ready_fetch": "آماده برای دریافت...",
        "fetching": "در حال دریافت...",
        "error_fetch": "خطا در دریافت رنج‌ها!",
        "cf_api": "API رسمی - Cloudflare ☁️",
        "cf_asn": "ASN - Cloudflare 🔢",
        "cf_github": "GitHub - Cloudflare 🐙",
        "fastly_api": "API رسمی - Fastly ⚡",
        "fastly_asn": "ASN - Fastly 🔢",
        "all_sources": "(همه منابع (توصیه میشه! 🌐",
        "export_menu_title": "انتخاب فرمت خروجی 💾",
        "excel_btn": "Excel (xlsx) 📊",
        "json_btn": "JSON (json) 📄",
        "msg_no_results": "نتیجه‌ای برای ذخیره وجود ندارد!",
        "msg_saved": "فایل ذخیره شد!",
        "msg_error": "خطا",
        "msg_copied": "کپی شد!",
        "ip_copied": "IP کپی شد: {}",
        "error_title": "خطا",
        "success_title": "موفق",
        "analyze_title": "تحلیل AI",
        "no_results_analyze": "نتیجه‌ای برای تحلیل وجود ندارد!",
        "openpyxl_missing": "کتابخانه openpyxl نصب نیست. برای نصب: pip install openpyxl",
        "file_saved": "فایل ذخیره شد!\n{}",
        "save_error": "خطا در ذخیره فایل:\n{}",
        "scan_done": "اتمام! {} IP در {}s ✅",
        "mode_turbo": "Turbo (۱۰s)", "mode_hyper": "Hyper (۵s)", "mode_ultra": "Ultra (۱۵s)", "mode_deep": "Deep (۳۰s)",
        "ai_basic": "Basic", "ai_smart": "Smart", "ai_advanced": "Advanced", "ai_expert": "Expert",
        "target_50": "۵۰", "target_100": "۱۰۰", "target_150": "۱۵۰", "target_200": "۲۰۰", "target_500": "۵۰۰", "target_1000": "۱۰۰۰", "target_all": "همه",
        "coming_future_updates": "در آپدیت‌های بعدی قرار داده خواهد شد.",
        "range_source_label": "منبع رنج:",
        "range_source_none": "—",
        "fetch_status": "{} رنج از {} ✅",
        "source_cf_api": "Cloudflare API", "source_cf_asn": "Cloudflare ASN", "source_cf_github": "Cloudflare GitHub",
        "source_fastly_api": "Fastly API", "source_fastly_asn": "Fastly ASN", "source_all": "همه منابع",
        "status_fetch": "دریافت رنج‌ها... 🔍",
        "status_analyze": "تحلیل {} رنج... 🤖",
        "status_scan": "اسکن {} رنج... ⚡",
        "status_pct": "اسکن... {}% ⚡",
        "made_by_simple": "برنامه نویسی و طراحی توسط : شاهین سالک توتونچی",
        "settings_main": "تنظیمات اصلی",
        "settings_theme": "تغییر رنگ / تم",
        "settings_ip_check": "تغییر بررسی آی پی ها",
        "ip_check_my_internet": "بررسی آی پی ها با اینترنت خودم",
        "ip_check_agent": "جستجو از طریق ایجنت",
        "ip_check_agent_message": "این قابلیت در به‌روزرسانی‌های بعدی اضافه خواهد شد. در حال حاضر فقط از طریق اینترنت خودتان می‌توانید جستجو را انجام دهید.",
        "settings_saved": "تنظیمات ذخیره شد.",
        "rescan_closed_title": "آی‌پی‌های اسکن‌شدهٔ قبلی",
        "rescan_closed_message": "{} آی‌پی که قبلاً اسکن شده و پورت باز نداشتند در حافظه هست. می‌خواهید آن‌ها را دوباره هم اسکن کنم؟",
        "rescan_yes": "بله، دوباره اسکن کن",
        "rescan_no": "خیر، ردشون کن",
        "ping_unsuitable": "نامناسب",
        "select_range_first": "رنجت رو از بین رنج‌های فعال انتخاب کن، بعد اسکن رو شروع کن.",
        "ranges_to_scan_label": "رنج‌هایی که اسکن شوند (تیک بزن/بردار):",
        "no_ranges_loaded": "رنجی بارگذاری نشده. اول از Cloudflare یا Fastly API رنج بگیر.",
        "rescan_blocked_message": "دفعهٔ قبل {} آی‌پی بلاک‌شده داشتی (بدون پینگ و بدون پورت باز). همه رو دوباره اسکن کنم یا فقط بقیه رو اسکن کنم؟",
    },
    "zh": {
        "app_title": "CDN IP 扫描器 V1.0",
        "app_subtitle": "高精度 • 超快 • AI 驱动 ⚡",
        "loading": "加载中...",
        "choose_language": "选择语言",
        "target": "目标",
        "speed": "速度",
        "found": "已找到",
        "time": "时间",
        "settings": "设置 ⚙️",
        "mode": "模式 🔥",
        "ai": "AI 🤖",
        "count": "数量 🎯",
        "fetch_ranges_btn": "获取范围 📡",
        "analyze_btn": "AI 分析 🤖",
        "save_btn": "保存 💾",
        "stop_btn": "停止 ⏹️",
        "start_btn": "开始扫描 🚀",
        "progress_title": "进度 📊",
        "ready_status": "准备就绪 ⚡",
        "results_title": "结果（按速度）🎯",
        "score_hdr": "分数 ⭐",
        "ports_hdr": "端口 🔓",
        "ping_hdr": "Ping ⚡",
        "ip_hdr": "IP 📍",
        "rank_hdr": "排名 🏆",
        "made_by": "由 {} 用 ❤️ 制作",
        "author_display": "shahin salek tootoonchi",
        "website_link_text": "购买服务器",
        "donate_text": "💎 Donate (USDT): 0xde200d...c269",
        "github_text": "GitHub ⭐",
        "youtube_text": "YouTube 📺",
        "donate_title": "支持开发 💎",
        "donate_desc": "如果此工具对您有帮助，欢迎捐赠支持：",
        "copy_btn": "复制地址 📋",
        "close_btn": "关闭",
        "thanks": "🙏 感谢您的支持！",
        "range_fetcher_title": "获取 IP 范围 📡",
        "range_sources_title": "从各来源获取 IP 范围 📡",
        "ranges_received": "已获取范围 📋:",
        "ready_fetch": "准备获取...",
        "fetching": "获取中...",
        "error_fetch": "获取范围出错！",
        "cf_api": "官方 API - Cloudflare ☁️",
        "cf_asn": "ASN - Cloudflare 🔢",
        "cf_github": "GitHub - Cloudflare 🐙",
        "fastly_api": "官方 API - Fastly ⚡",
        "fastly_asn": "ASN - Fastly 🔢",
        "all_sources": "全部来源（推荐）🌐",
        "export_menu_title": "选择导出格式 💾",
        "excel_btn": "Excel (xlsx) 📊",
        "json_btn": "JSON (json) 📄",
        "msg_no_results": "没有可保存的结果！",
        "msg_saved": "文件已保存！",
        "msg_error": "错误",
        "msg_copied": "已复制！",
        "ip_copied": "IP 已复制: {}",
        "error_title": "错误",
        "success_title": "成功",
        "analyze_title": "AI 分析",
        "no_results_analyze": "没有可分析的结果！",
        "openpyxl_missing": "未安装 openpyxl。运行: pip install openpyxl",
        "file_saved": "文件已保存！\n{}",
        "save_error": "保存错误:\n{}",
        "scan_done": "完成！{} 个 IP，耗时 {}s ✅",
        "mode_turbo": "Turbo (10s)", "mode_hyper": "Hyper (5s)", "mode_ultra": "Ultra (15s)", "mode_deep": "Deep (30s)",
        "ai_basic": "Basic", "ai_smart": "Smart", "ai_advanced": "Advanced", "ai_expert": "Expert",
        "target_50": "50", "target_100": "100", "target_150": "150", "target_200": "200", "target_500": "500", "target_1000": "1000", "target_all": "All",
        "coming_future_updates": "将在后续更新中添加。",
        "select_range_first": "请先从可用范围中选择范围，然后再开始扫描。",
        "ranges_to_scan_label": "要扫描的范围（勾选/取消）：",
        "no_ranges_loaded": "未加载范围。请先从 Cloudflare 或 Fastly API 获取范围。",
        "rescan_blocked_message": "上次您有 {} 个被阻止的 IP（无 ping，无开放端口）。重新扫描全部还是仅扫描其余？",
        "range_source_label": "范围来源：",
        "range_source_none": "—",
        "fetch_status": "{} 个范围来自 {} ✅",
        "source_cf_api": "Cloudflare API", "source_cf_asn": "Cloudflare ASN", "source_cf_github": "Cloudflare GitHub",
        "source_fastly_api": "Fastly API", "source_fastly_asn": "Fastly ASN", "source_all": "All Sources",
        "status_fetch": "获取范围... 🔍",
        "status_analyze": "分析 {} 个范围... 🤖",
        "status_scan": "扫描 {} 个范围... ⚡",
        "status_pct": "扫描... {}% ⚡",
        "made_by_simple": "编程与设计：shahin salek tootoonchi",
        "settings_main": "主要设置",
        "settings_theme": "主题 / 颜色",
        "settings_ip_check": "IP 检查方式",
        "ip_check_my_internet": "使用我的网络检查 IP",
        "ip_check_agent": "通过代理搜索",
        "ip_check_agent_message": "此功能将在后续更新中添加。目前您只能使用自己的网络进行搜索。",
        "settings_saved": "设置已保存。",
        "rescan_closed_title": "之前扫描过的 IP",
        "rescan_closed_message": "有 {} 个 IP 之前扫描过且没有开放端口。是否要重新扫描它们？",
        "rescan_yes": "是，重新扫描",
        "rescan_no": "否，跳过",
        "ping_unsuitable": "不合适",
    },
    "ru": {
        "app_title": "CDN IP Сканер V1.0",
        "app_subtitle": "Точность • Скорость • ИИ ⚡",
        "loading": "Загрузка...",
        "choose_language": "Выберите язык",
        "target": "Цель",
        "speed": "Скорость",
        "found": "Найдено",
        "time": "Время",
        "settings": "Настройки ⚙️",
        "mode": "Режим 🔥",
        "ai": "AI 🤖",
        "count": "Кол-во 🎯",
        "fetch_ranges_btn": "Получить диапазоны 📡",
        "analyze_btn": "Анализ ИИ 🤖",
        "save_btn": "Сохранить 💾",
        "stop_btn": "Стоп ⏹️",
        "start_btn": "Сканировать 🚀",
        "progress_title": "Прогресс 📊",
        "ready_status": "Готов к запуску ⚡",
        "results_title": "Результаты (по скорости) 🎯",
        "score_hdr": "Оценка ⭐",
        "ports_hdr": "Порты 🔓",
        "ping_hdr": "Ping ⚡",
        "ip_hdr": "IP 📍",
        "rank_hdr": "Ранг 🏆",
        "made_by": "Сделано с ❤️ {}",
        "author_display": "shahin salek tootoonchi",
        "website_link_text": "Купить сервер",
        "donate_text": "💎 Donate (USDT): 0xde200d...c269",
        "github_text": "GitHub ⭐",
        "youtube_text": "YouTube 📺",
        "donate_title": "Поддержать разработку 💎",
        "donate_desc": "Если программа полезна, можно поддержать донатом:",
        "copy_btn": "Копировать адрес 📋",
        "close_btn": "Закрыть",
        "thanks": "🙏 Спасибо за поддержку!",
        "range_fetcher_title": "Получить диапазоны IP 📡",
        "range_sources_title": "Получить диапазоны IP из источников 📡",
        "ranges_received": "Полученные диапазоны 📋:",
        "ready_fetch": "Готов к получению...",
        "fetching": "Получение...",
        "error_fetch": "Ошибка получения диапазонов!",
        "cf_api": "Официальный API - Cloudflare ☁️",
        "cf_asn": "ASN - Cloudflare 🔢",
        "cf_github": "GitHub - Cloudflare 🐙",
        "fastly_api": "Официальный API - Fastly ⚡",
        "fastly_asn": "ASN - Fastly 🔢",
        "all_sources": "Все источники (рекомендуется) 🌐",
        "export_menu_title": "Формат экспорта 💾",
        "excel_btn": "Excel (xlsx) 📊",
        "json_btn": "JSON (json) 📄",
        "msg_no_results": "Нет результатов для сохранения!",
        "msg_saved": "Файл сохранён!",
        "msg_error": "Ошибка",
        "msg_copied": "Скопировано!",
        "ip_copied": "IP скопирован: {}",
        "error_title": "Ошибка",
        "success_title": "Успех",
        "analyze_title": "Анализ ИИ",
        "no_results_analyze": "Нет результатов для анализа!",
        "openpyxl_missing": "openpyxl не установлен. Выполните: pip install openpyxl",
        "file_saved": "Файл сохранён!\n{}",
        "save_error": "Ошибка сохранения:\n{}",
        "scan_done": "Готово! {} IP за {}s ✅",
        "mode_turbo": "Turbo (10s)", "mode_hyper": "Hyper (5s)", "mode_ultra": "Ultra (15s)", "mode_deep": "Deep (30s)",
        "ai_basic": "Basic", "ai_smart": "Smart", "ai_advanced": "Advanced", "ai_expert": "Expert",
        "target_50": "50", "target_100": "100", "target_150": "150", "target_200": "200", "target_500": "500", "target_1000": "1000", "target_all": "All",
        "coming_future_updates": "Будет добавлено в следующих обновлениях.",
        "range_source_label": "Источник диапазонов:",
        "range_source_none": "—",
        "fetch_status": "{} диапазонов из {} ✅",
        "source_cf_api": "Cloudflare API", "source_cf_asn": "Cloudflare ASN", "source_cf_github": "Cloudflare GitHub",
        "source_fastly_api": "Fastly API", "source_fastly_asn": "Fastly ASN", "source_all": "All Sources",
        "status_fetch": "Получение диапазонов... 🔍",
        "status_analyze": "Анализ {} диапазонов... 🤖",
        "status_scan": "Сканирование {} диапазонов... ⚡",
        "status_pct": "Сканирование... {}% ⚡",
        "made_by_simple": "Программирование и дизайн: shahin salek tootoonchi",
        "settings_main": "Основные настройки",
        "settings_theme": "Тема / Цвет",
        "settings_ip_check": "Способ проверки IP",
        "ip_check_my_internet": "Проверять IP через мой интернет",
        "ip_check_agent": "Поиск через агент",
        "ip_check_agent_message": "Эта функция будет добавлена в следующих обновлениях. Пока вы можете искать только через свой интернет.",
        "settings_saved": "Настройки сохранены.",
        "rescan_closed_title": "Ранее сканированные IP",
        "rescan_closed_message": "У вас {} IP ранее сканировались и не имели открытых портов. Сканировать их снова?",
        "rescan_yes": "Да, сканировать",
        "rescan_no": "Нет, пропустить",
        "ping_unsuitable": "Непригодно",
        "select_range_first": "Сначала выберите диапазон из активных, затем начните сканирование.",
        "ranges_to_scan_label": "Диапазоны для сканирования (отметьте снять):",
        "no_ranges_loaded": "Диапазоны не загружены. Сначала получите их из Cloudflare или Fastly API.",
        "rescan_blocked_message": "В прошлый раз у вас было {} заблокированных IP (без пинга, без открытых портов). Сканировать все снова или только остальные?",
    },
}

def _persian_digit(s):
    """Convert 0-9 to Persian digits ۰-۹ in string s."""
    if not isinstance(s, str):
        s = str(s)
    table = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
    return s.translate(table)

# ===== UI constants — استانداردهای ظاهری مدرن =====
RADIUS_BOX = 8
CARD_PADDING_X = 14
CARD_PADDING_Y = 10
SECTION_PADDING = 10
MIN_STAT_CARD_WIDTH = 110

class RoundedFrame(tk.Canvas):
    """Frame with rounded corners; use only where size is fixed (e.g. donate box)."""
    def __init__(self, parent, radius=None, bg=None, **kwargs):
        self.radius = radius if radius is not None else RADIUS_BOX
        self._bg = bg or parent.cget("bg")
        super().__init__(parent, highlightthickness=0, bg=parent.cget("bg"), **kwargs)
        self.inner = tk.Frame(self, bg=self._bg)
        self._win_id = None
        self.bind("<Configure>", self._on_configure)
    
    def _on_configure(self, event):
        w, h = event.width, event.height
        r = self.radius
        self.delete("all")
        bg = self._bg
        self.create_arc(0, 0, 2*r, 2*r, start=90, extent=90, fill=bg, outline=bg)
        self.create_arc(w-2*r, 0, w, 2*r, start=0, extent=90, fill=bg, outline=bg)
        self.create_arc(w-2*r, h-2*r, w, h, start=270, extent=90, fill=bg, outline=bg)
        self.create_arc(0, h-2*r, 2*r, h, start=180, extent=90, fill=bg, outline=bg)
        self.create_rectangle(r, 0, w-r, h, fill=bg, outline=bg)
        self.create_rectangle(0, r, w, h-r, fill=bg, outline=bg)
        if self._win_id:
            self.delete(self._win_id)
        self._win_id = self.create_window(r, r, window=self.inner, anchor="nw", width=max(1, w-2*r), height=max(1, h-2*r))

# ===== AI Optimizer =====
class AIOptimizer:
    def __init__(self):
        self.successful_patterns = {
            'cloudflare': ['104.16.0.0/13', '104.24.0.0/14', '162.159.0.0/19', '172.64.0.0/13'],
            'fastly': ['151.101.0.0/16', '199.232.0.0/16']
        }
        self.priority_ports = [443, 80, 8443, 2053, 2083, 2087, 2096]
    
    def predict_best_ranges(self, all_ranges, limit=100):
        scored = [(r, self._score(r)) for r in all_ranges]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [r[0] for r in scored[:limit]]
    
    def _score(self, cidr):
        score = random.uniform(5, 15)
        try:
            net = ipaddress.IPv4Network(cidr, strict=False)
            score += 5.0 / math.log10(max(net.num_addresses, 10))
        except Exception:
            pass
        return score
    
    def smart_sample(self, cidr, max_ips=50):
        try:
            net = ipaddress.IPv4Network(cidr, strict=False)
            hosts = list(net.hosts())
            if len(hosts) <= max_ips:
                return hosts
            selected = [hosts[0], hosts[-1], hosts[len(hosts)//2]]
            step = len(hosts) // (max_ips - 10)
            for i in range(0, len(hosts), max(step, 1)):
                if len(selected) >= max_ips - 7:
                    break
                selected.append(hosts[i])
            remaining = max_ips - len(selected)
            if remaining > 0:
                selected.extend(random.sample(hosts, min(remaining, len(hosts))))
            return list(set(selected))[:max_ips]
        except Exception:
            return []

# ===== Ultra Fast Scanner =====
# مهم: اسکن فقط از اینترنت و IP خود کاربر (همان ماشینی که اسکریپت روی آن اجرا می‌شود) انجام می‌شود.
# هیچ پراکسی یا سرویس خارجی استفاده نمی‌شود — اتصال مستقیم TCP از شبکهٔ محلی.
class UltraScanner:
    def __init__(self):
        self.ai = AIOptimizer()
        self.max_workers = 500
        self.timeout = 0.3  # Increased timeout for better accuracy from Iran
        self.failed_cache = set()
    
    def check(self, ip, ports):
        """
        بررسی IP فقط از اینترنت و IP خود کاربر (ماشین اجراکننده).
        بدون پراکسی؛ اتصال مستقیم socket از شبکهٔ فعلی.
        """
        ip_str = str(ip)
        if ip_str in self.failed_cache:
            return None
        
        result = {'ip': ip_str, 'open_ports': [], 'ping': None}
        sockets = []
        start = time.time()
        
        try:
            # اتصال مستقیم از همین ماشین — بدون پراکسی؛ از اینترنت خود کاربر استفاده می‌شود
            for port in ports:
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.setblocking(False)
                    sock.connect_ex((ip_str, port))
                    sockets.append((sock, port))
                except Exception:
                    continue
            
            # صبر برای اتصال
            time.sleep(self.timeout)
            
            # چک کردن نتایج
            for sock, port in sockets:
                try:
                    # اگه اتصال برقرار شده باشه، getpeername موفق میشه
                    # این یعنی از ایران (یا هر شبکه دیگه) به این IP و پورت دسترسی هست
                    sock.getpeername()
                    result['open_ports'].append(port)
                except Exception:
                    # اگه خطا داد، یعنی اتصال برقرار نشده (فیلتر یا بسته)
                    pass
                finally:
                    sock.close()
            
            if result['open_ports']:
                # اگه حداقل یک پورت باز بود، ping رو ثبت کن
                result['ping'] = (time.time() - start) * 1000
                return result
            else:
                # اگه هیچ پورتی باز نبود، کش کن
                self.failed_cache.add(ip_str)
                return None
        except Exception:
            return None
    
    def batch_scan(self, ips, ports):
        results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = {ex.submit(self.check, ip, ports): ip for ip in ips}
            for future in as_completed(futures, timeout=self.timeout * 3):
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                except Exception:
                    pass
        return results

# ===== Range Fetcher =====
class RangeFetcher:
    @staticmethod
    def get_cloudflare_official():
        try:
            r = requests.get('https://api.cloudflare.com/client/v4/ips', timeout=10)
            return r.json()['result']['ipv4_cidrs']
        except Exception:
            return []
    
    @staticmethod
    def get_cloudflare_asn():
        cloudflare_asn_ranges = [
            '104.16.0.0/12', '172.64.0.0/13', '162.159.0.0/16',
            '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
            '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
            '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22',
            '198.41.128.0/17', '131.0.72.0/22'
        ]
        return cloudflare_asn_ranges
    
    @staticmethod
    def get_cloudflare_github():
        try:
            r = requests.get('https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/data/ip-ranges.json', timeout=10)
            data = r.json()
            return data.get('ipv4_cidrs', [])
        except Exception:
            return []
    
    @staticmethod
    def get_fastly_official():
        try:
            r = requests.get('https://api.fastly.com/public-ip-list', timeout=10)
            return r.json()['addresses']
        except Exception:
            return []
    
    @staticmethod
    def get_fastly_asn():
        fastly_asn_ranges = [
            '151.101.0.0/16', '199.232.0.0/16',
            '103.244.50.0/24', '103.245.222.0/23',
            '103.245.224.0/24', '104.156.80.0/20'
        ]
        return fastly_asn_ranges
    
    @staticmethod
    def get_all_sources():
        all_ranges = []
        all_ranges.extend(RangeFetcher.get_cloudflare_official())
        all_ranges.extend(RangeFetcher.get_cloudflare_asn())
        all_ranges.extend(RangeFetcher.get_cloudflare_github())
        all_ranges.extend(RangeFetcher.get_fastly_official())
        all_ranges.extend(RangeFetcher.get_fastly_asn())
        return list(set(all_ranges))

# ===== Theme Manager =====
class ThemeManager:
    THEMES = {
        'dark': {
            'bg': '#1e1e2e',
            'fg': '#cdd6f4',
            'accent': '#89b4fa',
            'success': '#a6e3a1',
            'error': '#f38ba8',
            'warning': '#f9e2af',
            'card_bg': '#313244',
            'card_fg': '#a6adc8'
        },
        'light': {
            'bg': '#eff1f5',
            'fg': '#4c4f69',
            'accent': '#1e66f5',
            'success': '#40a02b',
            'error': '#d20f39',
            'warning': '#df8e1d',
            'card_bg': '#dce0e8',
            'card_fg': '#5c5f77'
        }
    }
    
    @staticmethod
    def get_theme(name='dark'):
        return ThemeManager.THEMES.get(name, ThemeManager.THEMES['dark'])

# ===== Excel Exporter =====
class ExcelExporter:
    @staticmethod
    def export(results, filename, app=None):
        """app: instance of CDNScannerPro for t() and num(); if None, use plain strings."""
        if not EXCEL_AVAILABLE:
            raise ImportError("openpyxl not installed. Run: pip install openpyxl")
        
        def _t(key):
            return app.t(key) if app else {"ping_unsuitable": "Unsuitable"}.get(key, key)
        def _num(n):
            return app.num(n) if app else str(n)
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Clean IPs"
        
        # Header style
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_font = Font(name='VazirMatn', size=12, bold=True, color="FFFFFF")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Border
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        headers = ['رتبه', 'آدرس IP', 'Ping (ms)', 'پورت‌های باز', 'امتیاز', 'تاریخ', 'زمان']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data
        data_font = Font(name='VazirMatn', size=11)
        data_alignment = Alignment(horizontal="right", vertical="center")
        
        sorted_results = sorted(results, key=lambda x: x.get('score', 0), reverse=True)
        
        now = datetime.now()
        date_str = now.strftime('%Y/%m/%d')
        time_str = now.strftime('%H:%M:%S')
        
        for idx, result in enumerate(sorted_results, 1):
            row = idx + 1
            ports_str = ', '.join(map(str, result['open_ports']))
            
            ping_val = result.get('ping')
            if ping_val is None:
                ping_cell = 'N/A'
            elif ping_val >= 1000:
                ping_cell = _t("ping_unsuitable")
            else:
                ping_cell = _num(int(round(ping_val))) + " ms"
            data = [
                f"#{idx}",
                result['ip'],
                ping_cell,
                ports_str,
                _num(int(result.get('score', 0))) + "/" + _num(100),
                date_str,
                time_str
            ]
            
            for col, value in enumerate(data, 1):
                cell = ws.cell(row=row, column=col, value=value)
                cell.font = data_font
                cell.alignment = data_alignment
                cell.border = thin_border
                
                # Color coding based on score
                if col == 5:  # Score column
                    score = result.get('score', 0)
                    if score >= 80:
                        cell.fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
                    elif score >= 60:
                        cell.fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
                    else:
                        cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
        
        # Column widths
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 18
        ws.column_dimensions['C'].width = 12
        ws.column_dimensions['D'].width = 25
        ws.column_dimensions['E'].width = 12
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 12
        
        # Right-to-left
        ws.sheet_view.rightToLeft = True
        
        # Save
        wb.save(filename)

# ===== Main GUI =====
class CDNScannerPro:
    def __init__(self, root):
        self.root = root
        self.root.title("CDN IP Scanner V1.0")
        
        # مسیر فونت‌ها: Vazirmatn یا در صورت وجود EV Sam (فونت ای وی سام)
        _script_dir = os.path.dirname(os.path.abspath(__file__))
        self._font_dir = os.path.join(_script_dir, "fonts")
        self._font_regular = os.path.join(self._font_dir, "Vazirmatn-Regular.ttf")
        self._font_bold = os.path.join(self._font_dir, "Vazirmatn-Bold.ttf")
        self._font_evsam_r = os.path.join(self._font_dir, "EV-Sam-Regular.ttf")
        self._font_evsam_b = os.path.join(self._font_dir, "EV-Sam-Bold.ttf")
        if not os.path.isfile(self._font_evsam_r):
            self._font_evsam_r = os.path.join(self._font_dir, "EVSam-Regular.ttf")
            self._font_evsam_b = os.path.join(self._font_dir, "EVSam-Bold.ttf")
        self._font_cache = {}
        self._fa_solid_path = os.path.join(self._font_dir, "fa-solid-900.ttf")
        self._fa_brands_path = os.path.join(self._font_dir, "fa-brands-400.ttf")
        self._fa_font_cache = {}  # (style, size) -> Font
        _load_fonts_win(self._font_dir)
        
        # ریسپانسیو: اندازه بر اساس مانیتور
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        window_width = max(800, min(1600, int(screen_width * 0.92)))
        window_height = max(500, min(900, int(screen_height * 0.88)))
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.minsize(750, 480)
        self.root.resizable(True, True)
        
        # Variables
        self.scanner = UltraScanner()
        self.ai = AIOptimizer()
        self.fetcher = RangeFetcher()
        
        self.current_theme = 'dark'
        self.theme = ThemeManager.get_theme(self.current_theme)
        
        self.lang = 'en'  # default English
        self.is_rtl = False
        self._loading_timer = None
        
        self.is_scanning = False
        self.results = []
        self.total_scanned = 0
        self.total_found = 0
        self.update_queue = Queue()
        self.start_time = None
        self.current_range_source = None  # نام منبع رنج فعلی (فقط Cloudflare API یا Fastly API)
        self.available_ranges = []  # لیست رنج‌های بارگذاری‌شده (CIDR)
        self.range_check_vars = []  # لیست BooleanVar برای تیک هر رنج
        
        # تنظیمات: متغیرها قبل از load_config (برای ذخیره/بارگذاری)
        self._target_internal = [50, 100, 150, 200, 500, 1000, "All"]
        self._target_keys = ["target_50", "target_100", "target_150", "target_200", "target_500", "target_1000", "target_all"]
        mode_vals_en = ["Turbo (10s)", "Hyper (5s)", "Ultra (15s)", "Deep (30s)"]
        ai_vals_en = ["Basic", "Smart", "Advanced", "Expert"]
        target_vals_en = ["50", "100", "150", "200", "500", "1000", "All"]
        self.mode_var = tk.StringVar(value=mode_vals_en[0])
        self.ai_var = tk.StringVar(value=ai_vals_en[1])
        self.target_var = tk.StringVar(value=target_vals_en[1])
        self.ip_check_method = tk.StringVar(value="internet")  # internet | agent
        
        self.scanned_closed = set()  # آی‌پی‌هایی که قبلاً اسکن شده و پورت باز نداشتند (ذخیرهٔ دائمی)
        self._load_config()
        self._load_scan_cache()
        
        self.show_loading()
    
    def t(self, key):
        """Translation for current language."""
        return TRANSLATIONS.get(self.lang, TRANSLATIONS["en"]).get(key, TRANSLATIONS["en"].get(key, key))
    
    def num(self, n):
        """Number as string; Persian digits if Farsi."""
        s = str(n) if isinstance(n, (int, float)) else n
        return _persian_digit(s) if self.lang == "fa" else s
    
    def font(self, size, bold=False):
        """Font: EV Sam or Vazirmatn for Persian; Segoe UI for others (modern)."""
        key = (size, bold)
        if key not in self._font_cache:
            if self.lang == "fa":
                use_evsam = os.path.isfile(self._font_evsam_r)
                if sys.platform == "win32":
                    fam = "EV Sam" if use_evsam else "Vazirmatn"
                    self._font_cache[key] = tkfont.Font(root=self.root, family=fam, size=size, weight="bold" if bold else "normal")
                elif use_evsam and os.path.isfile(self._font_evsam_b if bold else self._font_evsam_r):
                    path = self._font_evsam_b if bold else self._font_evsam_r
                    self._font_cache[key] = tkfont.Font(root=self.root, file=path, size=size)
                elif os.path.isfile(self._font_bold if bold else self._font_regular):
                    path = self._font_bold if bold else self._font_regular
                    self._font_cache[key] = tkfont.Font(root=self.root, file=path, size=size)
                else:
                    self._font_cache[key] = tkfont.Font(family="Tahoma", size=size, weight="bold" if bold else "normal")
            else:
                fam = "Segoe UI" if sys.platform == "win32" else "Tahoma"
                self._font_cache[key] = tkfont.Font(family=fam, size=size, weight="bold" if bold else "normal")
        return self._font_cache[key]
    
    def _fa_font_solid(self, size=14):
        """فونت Font Awesome 6 Solid برای آیکن‌ها."""
        key = ("solid", size)
        if key in self._fa_font_cache:
            return self._fa_font_cache[key]
        if not os.path.isfile(self._fa_solid_path):
            return None
        try:
            f = tkfont.Font(root=self.root, family="Font Awesome 6 Free", size=size, weight="bold")
        except Exception:
            try:
                f = tkfont.Font(root=self.root, file=self._fa_solid_path, size=size)
            except Exception:
                f = None
        self._fa_font_cache[key] = f
        return f
    
    def _fa_font_brands(self, size=14):
        """فونت Font Awesome 6 Brands برای آیکن‌های برند."""
        key = ("brands", size)
        if key in self._fa_font_cache:
            return self._fa_font_cache[key]
        if not os.path.isfile(self._fa_brands_path):
            return None
        try:
            f = tkfont.Font(root=self.root, family="Font Awesome 6 Brands", size=size)
        except Exception:
            try:
                f = tkfont.Font(root=self.root, file=self._fa_brands_path, size=size)
            except Exception:
                f = None
        self._fa_font_cache[key] = f
        return f
    
    def fa_icon(self, name, size=14, use_brands=False):
        """برگرداندن (کاراکتر آیکن، فونت، رنگ) برای نمایش؛ در صورت نبود فونت FA از ایموجی استفاده می‌شود."""
        char = FA.get(name, "")
        color = FA_COLORS.get(name, self.theme.get("accent", "#6366f1"))
        if use_brands and name in ("github", "youtube"):
            font = self._fa_font_brands(size)
        else:
            font = self._fa_font_solid(size)
        if font is None:
            fallback = {"rocket": "🚀", "gear": "⚙️", "bolt": "⚡", "check": "✅", "clock": "⏱️", "bullseye": "🎯", "satellite": "📡", "robot": "🤖", "save": "💾", "stop": "⏹️", "play": "🚀", "chart": "📊", "star": "⭐", "lock_open": "🔓", "location": "📍", "trophy": "🏆", "gem": "💎", "moon": "🌙", "sun": "☀️", "github": "⭐", "youtube": "📺"}
            return (fallback.get(name, ""), None, color)
        return (char, font, color)
    
    def get_target_internal(self):
        """Return internal target value (50, 100, 150, 200, 500, 1000, or 'All') from combo display."""
        v = self.target_var.get()
        for i, k in enumerate(self._target_keys):
            if self.t(k) == v:
                return self._target_internal[i]
        return 100
    
    _MODE_INTERNAL = {"mode_turbo": "Turbo (10s)", "mode_hyper": "Hyper (5s)", "mode_ultra": "Ultra (15s)", "mode_deep": "Deep (30s)"}
    
    def get_mode_internal(self):
        """Return internal mode string (e.g. 'Turbo (10s)') from translated combo value."""
        v = self.mode_var.get()
        for key in ("mode_turbo", "mode_hyper", "mode_ultra", "mode_deep"):
            if self.t(key) == v:
                return self._MODE_INTERNAL[key]
        return "Turbo (10s)"
    
    def _config_file(self):
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    
    def _scan_cache_file(self):
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan_cache.json")
    
    def _load_scan_cache(self):
        """بارگذاری آی‌پی‌های اسکن‌شدهٔ قبلی (بسته) از فایل."""
        path = self._scan_cache_file()
        if not os.path.isfile(path):
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.scanned_closed.update(data.get("closed_ips", []))
        except Exception:
            pass
    
    def _save_scan_cache(self):
        """ذخیرهٔ آی‌پی‌های بسته در فایل (حتی بعد از بستن برنامه و خاموشی)."""
        path = self._scan_cache_file()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"closed_ips": list(self.scanned_closed)}, f, ensure_ascii=False)
        except Exception:
            pass
    
    def _load_config(self):
        """بارگذاری تنظیمات ذخیره‌شده از فایل."""
        path = self._config_file()
        if not os.path.isfile(path):
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            if cfg.get("theme") in ("dark", "light"):
                self.current_theme = cfg["theme"]
                self.theme = ThemeManager.get_theme(self.current_theme)
            mode_key = cfg.get("mode_key", "mode_turbo")
            ai_key = cfg.get("ai_key", "ai_smart")
            target_key = cfg.get("target_key", "target_100")
            # مقدار نمایشی از ترجمه فعلی (بعد از انتخاب زبان در init_ui اعمال می‌شود؛ اینجا فقط کلید ذخیره می‌شود)
            self._saved_mode_key = mode_key
            self._saved_ai_key = ai_key
            self._saved_target_key = target_key
            self.ip_check_method.set(cfg.get("ip_check", "internet"))
        except Exception:
            pass
    
    def _apply_loaded_config(self):
        """اعمال تنظیمات بارگذاری‌شده روی comboها (بعد از انتخاب زبان)."""
        if hasattr(self, "_saved_mode_key"):
            self.mode_var.set(self.t(self._saved_mode_key))
        if hasattr(self, "_saved_ai_key"):
            self.ai_var.set(self.t(self._saved_ai_key))
        if hasattr(self, "_saved_target_key"):
            self.target_var.set(self.t(self._saved_target_key))
    
    def _save_config(self, mode_display=None, ai_display=None, target_display=None):
        """ذخیره تنظیمات در فایل. اگر مقدار نمایشی داده شود از آن استفاده می‌شود (مثلاً از combo)."""
        mode_val = (mode_display or self.mode_var.get() or "").strip()
        ai_val = (ai_display or self.ai_var.get() or "").strip()
        target_val = (target_display or self.target_var.get() or "").strip()
        
        mode_key = None
        for k in ("mode_turbo", "mode_hyper", "mode_ultra", "mode_deep"):
            if (self.t(k) or "").strip() == mode_val:
                mode_key = k
                break
        ai_key = None
        for k in ("ai_basic", "ai_smart", "ai_advanced", "ai_expert"):
            if (self.t(k) or "").strip() == ai_val:
                ai_key = k
                break
        target_key = None
        for k in self._target_keys:
            if (self.t(k) or "").strip() == target_val:
                target_key = k
                break
        
        cfg = {
            "theme": self.current_theme,
            "mode_key": mode_key or "mode_turbo",
            "ai_key": ai_key or "ai_smart",
            "target_key": target_key or "target_100",
            "ip_check": self.ip_check_method.get(),
        }
        self._saved_mode_key = cfg["mode_key"]
        self._saved_ai_key = cfg["ai_key"]
        self._saved_target_key = cfg["target_key"]
        
        path_cfg = self._config_file()
        try:
            with open(path_cfg, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
                f.flush()
                try:
                    if hasattr(os, 'fsync'):
                        os.fsync(f.fileno())
                except Exception:
                    pass
        except Exception as e:
            try:
                messagebox.showerror(self.t("error_title"), self.t("save_error").format(str(e)))
            except Exception:
                pass

    def _on_lang_selected(self, lang):
        if self._loading_timer:
            self.root.after_cancel(self._loading_timer)
            self._loading_timer = None
        self.lang = lang
        self.is_rtl = (lang == "fa")
        self._font_cache.clear()
        self._fa_font_cache.clear()
        self.root.after(300, self.init_ui)
    
    def show_loading(self):
        self.loading_frame = tk.Frame(self.root, bg='#1e1e2e')
        self.loading_frame.pack(fill=tk.BOTH, expand=True)
        
        char, fa_f, color = self.fa_icon("rocket", 72)
        if fa_f:
            tk.Label(self.loading_frame, text=char, font=fa_f, bg='#1e1e2e', fg=color).pack(pady=(80, 15))
        else:
            tk.Label(self.loading_frame, text="🚀", font=("Segoe UI", 72), bg='#1e1e2e', fg='#89b4fa').pack(pady=(80, 15))
        tk.Label(self.loading_frame, text="CDN IP Scanner V1.0", font=("Segoe UI", 28, "bold"), bg='#1e1e2e', fg='#cdd6f4').pack()
        
        lang_frame = tk.Frame(self.loading_frame, bg='#1e1e2e')
        lang_frame.pack(pady=25)
        tk.Label(lang_frame, text="Choose language / انتخاب زبان / 选择语言 / Выберите язык", font=("Segoe UI", 11), bg='#1e1e2e', fg='#a6adc8').pack(pady=(0, 15))
        
        flags = [
            ("🇮🇷", "fa", "فارسی"),
            ("🇬🇧", "en", "English"),
            ("🇨🇳", "zh", "中文"),
            ("🇷🇺", "ru", "Русский"),
        ]
        btn_frame = tk.Frame(lang_frame, bg='#1e1e2e')
        btn_frame.pack()
        for flag, code, name in flags:
            b = tk.Button(
                btn_frame, text=f"{flag}  {name}",
                font=("Segoe UI", 12), bg='#313244', fg='#cdd6f4', activebackground='#89b4fa',
                relief=tk.FLAT, padx=20, pady=12, cursor="hand2",
                command=(lambda c=code: self._on_lang_selected(c))
            )
            b.pack(side=tk.LEFT, padx=8)
        
        footer_frame = tk.Frame(self.loading_frame, bg='#1e1e2e')
        footer_frame.pack(side=tk.BOTTOM, pady=25)
        tk.Label(footer_frame, text="Programming and design by: shahin salek tootoonchi", font=("Segoe UI", 10), bg='#1e1e2e', fg='#a6adc8').pack()
        link_f = tk.Frame(footer_frame, bg='#1e1e2e')
        link_f.pack(pady=4)
        for lbl, url in [("GitHub", GITHUB_REPO_URL), ("YouTube", YOUTUBE_URL), ("digicloud.tr", WEBSITE_URL)]:
            L = tk.Label(link_f, text=lbl, font=("Segoe UI", 10), bg='#1e1e2e', fg='#74c7ec', cursor="hand2")
            L.pack(side=tk.LEFT, padx=8)
            L.bind("<Button-1>", lambda e, u=url: webbrowser.open(u))
        # منتظر انتخاب زبان توسط کاربر می‌ماند
    
    def init_ui(self):
        self.loading_frame.destroy()
        self.root.title(self.t("app_title"))
        self.setup_ui()
        self.check_queue()
    
    def setup_ui(self):
        self.root.configure(bg=self.theme['bg'])
        
        outer = tk.Frame(self.root, bg=self.theme['bg'])
        outer.pack(fill=tk.BOTH, expand=True)
        
        # اسکرول عمودی برای ریسپانسیو بودن
        self.main_canvas = tk.Canvas(outer, bg=self.theme['bg'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(outer)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.main_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.main_canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.configure(command=self.main_canvas.yview)
        
        content_frame = tk.Frame(self.main_canvas, bg=self.theme['bg'])
        self._content_window = self.main_canvas.create_window((0, 0), window=content_frame, anchor='nw')
        
        def on_frame_configure(e):
            self.main_canvas.configure(scrollregion=self.main_canvas.bbox("all"))
        content_frame.bind("<Configure>", on_frame_configure)
        
        def on_canvas_configure(e):
            self.main_canvas.itemconfig(self._content_window, width=e.width)
        self.main_canvas.bind("<Configure>", on_canvas_configure)
        
        def on_mousewheel(e):
            if hasattr(e, 'delta') and e.delta != 0:
                self.main_canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
            elif e.num == 5:
                self.main_canvas.yview_scroll(1, "units")
            elif e.num == 4:
                self.main_canvas.yview_scroll(-1, "units")
        def bind_mousewheel(e):
            self.main_canvas.bind_all("<MouseWheel>", on_mousewheel)
            self.main_canvas.bind_all("<Button-4>", on_mousewheel)
            self.main_canvas.bind_all("<Button-5>", on_mousewheel)
        def unbind_mousewheel(e):
            self.main_canvas.unbind_all("<MouseWheel>")
            self.main_canvas.unbind_all("<Button-4>")
            self.main_canvas.unbind_all("<Button-5>")
        self.main_canvas.bind("<Enter>", bind_mousewheel)
        self.main_canvas.bind("<Leave>", unbind_mousewheel)
        
        content_frame.columnconfigure(0, weight=1)
        for r in range(7):
            content_frame.rowconfigure(r, weight=0)
        content_frame.rowconfigure(5, weight=1, minsize=180)
        
        header = self.create_header(content_frame)
        stats = self.create_stats(content_frame)
        two_boxes_row = self.create_two_boxes_row(content_frame)
        btns = self.create_buttons(content_frame)
        prog = self.create_progress(content_frame)
        results = self.create_results(content_frame)
        footer = self.create_footer(content_frame)
        
        header.grid(row=0, column=0, sticky='ew', padx=20, pady=2)
        stats.grid(row=1, column=0, sticky='ew', padx=20, pady=2)
        two_boxes_row.grid(row=2, column=0, sticky='nsew', padx=20, pady=2)
        btns.grid(row=3, column=0, sticky='ew', padx=20, pady=2)
        prog.grid(row=4, column=0, sticky='ew', padx=20, pady=2)
        results.grid(row=5, column=0, sticky='nsew', padx=20, pady=4)
        footer.grid(row=6, column=0, sticky='ew', padx=20, pady=4)
        self._apply_loaded_config()
    
    def switch_lang(self, lang):
        self.lang = lang
        self.is_rtl = (lang == "fa")
        self._font_cache.clear()
        self._fa_font_cache.clear()
        for w in self.root.winfo_children():
            w.destroy()
        self.setup_ui()
    
    def create_header(self, parent):
        header = tk.Frame(parent, bg=self.theme['bg'])
        anchor_main = 'e' if self.is_rtl else 'w'
        title_frame = tk.Frame(header, bg=self.theme['bg'])
        title_frame.pack(side=tk.RIGHT if self.is_rtl else tk.LEFT)
        
        char, fa_f, fa_color = self.fa_icon("rocket", 24)
        if fa_f:
            title_row = tk.Frame(title_frame, bg=self.theme['bg'])
            title_row.pack(anchor=anchor_main)
            tk.Label(title_row, text=self.t("app_title"), font=self.font(24, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(side=tk.LEFT if not self.is_rtl else tk.RIGHT, padx=(0, 8) if not self.is_rtl else (8, 0))
            tk.Label(title_row, text=char, font=fa_f, bg=self.theme['bg'], fg=fa_color).pack(side=tk.LEFT if not self.is_rtl else tk.RIGHT)
        else:
            tk.Label(title_frame, text=self.t("app_title") + " 🚀", font=self.font(24, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor=anchor_main)
        tk.Label(title_frame, text=self.t("app_subtitle"), font=self.font(11), bg=self.theme['bg'], fg=self.theme['warning']).pack(anchor=anchor_main)
        
        btn_frame = tk.Frame(header, bg=self.theme['bg'])
        btn_frame.pack(side=tk.LEFT if self.is_rtl else tk.RIGHT)
        for flag, code in [("🇮🇷", "fa"), ("🇬🇧", "en"), ("🇨🇳", "zh"), ("🇷🇺", "ru")]:
            btn = tk.Button(btn_frame, text=flag, font=("Segoe UI", 10), bg=self.theme['card_bg'], fg=self.theme['fg'], relief=tk.FLAT, padx=4, pady=2, cursor="hand2", command=(lambda c=code: self.switch_lang(c)))
            btn.pack(side=tk.RIGHT if self.is_rtl else tk.LEFT, padx=2)
        th_char, th_f, th_color = self.fa_icon("moon" if self.current_theme == 'dark' else "sun", 16)
        th_text = th_char if th_f else ("🌙" if self.current_theme == 'dark' else "☀️")
        self.theme_btn = tk.Button(btn_frame, text=th_text, font=(th_f if th_f else self.font(16)), bg=self.theme['card_bg'], fg=(th_color if th_f else self.theme['fg']), relief=tk.FLAT, padx=15, pady=5, cursor="hand2", command=self.toggle_theme)
        self.theme_btn.pack(side=tk.RIGHT if self.is_rtl else tk.LEFT, padx=5)
        return header
    
    def create_stats(self, parent):
        stats_frame = tk.Frame(parent, bg=self.theme['bg'])
        tval = self.get_target_internal()
        tdisp = self.num(tval) if tval != "All" else self.t("target_all")
        stats_icons = [("bullseye", "target", tdisp, "target_label"), ("bolt", "speed", self.num(0) + " IP/s", "speed_label"), ("check", "found", self.num(0), "found_label"), ("clock", "time", self.num(0) + "s", "time_label")]
        for idx, (icon_name, key, value, var_name) in enumerate(stats_icons):
            card = tk.Frame(stats_frame, bg=self.theme['card_bg'], relief=tk.FLAT, bd=0, highlightbackground=self.theme.get('accent', '#89b4fa'), highlightthickness=1)
            card.grid(row=0, column=idx, padx=SECTION_PADDING // 2, pady=SECTION_PADDING // 2, sticky='ew')
            stats_frame.grid_columnconfigure(idx, weight=1, minsize=MIN_STAT_CARD_WIDTH)
            char, fa_f, fa_color = self.fa_icon(icon_name, 14)
            row_top = tk.Frame(card, bg=self.theme['card_bg'])
            row_top.pack(pady=(CARD_PADDING_Y, 0), anchor='center')
            if fa_f:
                tk.Label(row_top, text=char, font=fa_f, bg=self.theme['card_bg'], fg=fa_color).pack(side=tk.LEFT, padx=2)
            else:
                tk.Label(row_top, text=char, font=self.font(8), bg=self.theme['card_bg'], fg=self.theme['card_fg']).pack(side=tk.LEFT, padx=2)
            tk.Label(row_top, text=self.t(key), font=self.font(8), bg=self.theme['card_bg'], fg=self.theme['card_fg']).pack(side=tk.LEFT)
            label = tk.Label(card, text=value, font=self.font(11, bold=True), bg=self.theme['card_bg'], fg=self.theme['accent'])
            label.pack(pady=(0, CARD_PADDING_Y), anchor='center')
            setattr(self, var_name, label)
        return stats_frame
    
    def create_controls(self, parent):
        control_wrap = tk.Frame(parent, bg=self.theme['bg'])
        tk.Label(control_wrap, text=" " + self.t("settings") + " ", font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor='e' if self.is_rtl else 'w')
        center_frame = tk.Frame(control_wrap, bg=self.theme['bg'])
        center_frame.pack(anchor='center', fill=tk.X, pady=(SECTION_PADDING // 2, 0))
        btn_frame = tk.Frame(center_frame, bg=self.theme['bg'])
        btn_frame.pack(anchor='center')
        pad_btn = CARD_PADDING_Y
        pad_btn_h = CARD_PADDING_X
        # دکمه تنظیمات و دریافت رنج — یک اندازه برای یکنواختی
        g_char, g_f, g_color = self.fa_icon("gear", 14)
        set_btn = tk.Frame(btn_frame, bg=self.theme['accent'], cursor="hand2")
        set_btn.pack(side=tk.LEFT, padx=SECTION_PADDING // 2)
        if g_f:
            tk.Label(set_btn, text=g_char, font=g_f, bg=self.theme['accent'], fg=g_color).pack(side=tk.LEFT, padx=(pad_btn_h, 4), pady=pad_btn)
        tk.Label(set_btn, text=self._strip_emoji(self.t("settings")), font=self.font(11, bold=True), bg=self.theme['accent'], fg='#000').pack(side=tk.LEFT, padx=(0, pad_btn_h), pady=pad_btn)
        for c in set_btn.winfo_children():
            c.bind("<Button-1>", lambda e: self.show_settings_dialog())
        s_char, s_f, s_color = self.fa_icon("satellite", 14)
        fetch_btn = tk.Frame(btn_frame, bg=self.theme['warning'], cursor="hand2")
        fetch_btn.pack(side=tk.LEFT, padx=SECTION_PADDING // 2)
        if s_f:
            tk.Label(fetch_btn, text=s_char, font=s_f, bg=self.theme['warning'], fg=s_color).pack(side=tk.LEFT, padx=(pad_btn_h, 4), pady=pad_btn)
        tk.Label(fetch_btn, text=self._strip_emoji(self.t("fetch_ranges_btn")), font=self.font(11, bold=True), bg=self.theme['warning'], fg='#000').pack(side=tk.LEFT, padx=(0, pad_btn_h), pady=pad_btn)
        for c in fetch_btn.winfo_children():
            c.bind("<Button-1>", lambda e: self.show_range_fetcher())
        # نمایش منبع رنج فعلی (Cloudflare / Fastly API یا —)
        range_row = tk.Frame(center_frame, bg=self.theme['bg'])
        range_row.pack(anchor='center', pady=(8, 0))
        side_label = tk.RIGHT if self.is_rtl else tk.LEFT
        tk.Label(range_row, text=self.t("range_source_label") + " ", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack(side=side_label)
        self.range_source_value_label = tk.Label(range_row, text=(self.current_range_source or self.t("range_source_none")), font=self.font(10, bold=True), bg=self.theme['bg'], fg=self.theme['accent'])
        self.range_source_value_label.pack(side=side_label)
        return control_wrap
    
    def create_two_boxes_row(self, parent):
        """یک ردیف با دو باکس: سمت چپ = رنج‌های اسکن، سمت راست = تنظیمات."""
        row = tk.Frame(parent, bg=self.theme['bg'])
        row.columnconfigure(0, weight=1)
        row.columnconfigure(1, weight=1)
        ranges_box = self.create_ranges_section(row)
        settings_box = self.create_controls_box(row)
        ranges_box.grid(row=0, column=0, sticky='nsew', padx=(0, 10))
        settings_box.grid(row=0, column=1, sticky='nsew', padx=(10, 0))
        return row
    
    def create_controls_box(self, parent):
        """باکس تنظیمات (دکمه‌ها + منبع رنج) برای قرارگیری در ردیف دو باکس."""
        wrap = tk.Frame(parent, bg=self.theme['bg'])
        box = tk.Frame(wrap, bg=self.theme['card_bg'], relief=tk.FLAT, highlightbackground=self.theme.get('accent', '#89b4fa'), highlightthickness=1, padx=CARD_PADDING_X, pady=CARD_PADDING_Y)
        box.pack(fill=tk.BOTH, expand=True)
        tk.Label(box, text=" " + self.t("settings") + " ", font=self.font(11, bold=True), bg=self.theme['card_bg'], fg=self.theme['accent']).pack(anchor='e' if self.is_rtl else 'w')
        center_frame = tk.Frame(box, bg=self.theme['card_bg'])
        center_frame.pack(anchor='center', fill=tk.X, pady=(SECTION_PADDING // 2, 0))
        btn_frame = tk.Frame(center_frame, bg=self.theme['card_bg'])
        btn_frame.pack(anchor='center')
        pad_btn = CARD_PADDING_Y
        pad_btn_h = CARD_PADDING_X
        g_char, g_f, g_color = self.fa_icon("gear", 14)
        set_btn = tk.Frame(btn_frame, bg=self.theme['accent'], cursor="hand2")
        set_btn.pack(side=tk.LEFT, padx=SECTION_PADDING // 2)
        if g_f:
            tk.Label(set_btn, text=g_char, font=g_f, bg=self.theme['accent'], fg=g_color).pack(side=tk.LEFT, padx=(pad_btn_h, 4), pady=pad_btn)
        tk.Label(set_btn, text=self._strip_emoji(self.t("settings")), font=self.font(11, bold=True), bg=self.theme['accent'], fg='#000').pack(side=tk.LEFT, padx=(0, pad_btn_h), pady=pad_btn)
        for c in set_btn.winfo_children():
            c.bind("<Button-1>", lambda e: self.show_settings_dialog())
        s_char, s_f, s_color = self.fa_icon("satellite", 14)
        fetch_btn = tk.Frame(btn_frame, bg=self.theme['warning'], cursor="hand2")
        fetch_btn.pack(side=tk.LEFT, padx=SECTION_PADDING // 2)
        if s_f:
            tk.Label(fetch_btn, text=s_char, font=s_f, bg=self.theme['warning'], fg=s_color).pack(side=tk.LEFT, padx=(pad_btn_h, 4), pady=pad_btn)
        tk.Label(fetch_btn, text=self._strip_emoji(self.t("fetch_ranges_btn")), font=self.font(11, bold=True), bg=self.theme['warning'], fg='#000').pack(side=tk.LEFT, padx=(0, pad_btn_h), pady=pad_btn)
        for c in fetch_btn.winfo_children():
            c.bind("<Button-1>", lambda e: self.show_range_fetcher())
        range_row = tk.Frame(center_frame, bg=self.theme['card_bg'])
        range_row.pack(anchor='center', pady=(8, 0))
        side_label = tk.RIGHT if self.is_rtl else tk.LEFT
        tk.Label(range_row, text=self.t("range_source_label") + " ", font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['fg']).pack(side=side_label)
        self.range_source_value_label = tk.Label(range_row, text=(self.current_range_source or self.t("range_source_none")), font=self.font(10, bold=True), bg=self.theme['card_bg'], fg=self.theme['accent'])
        self.range_source_value_label.pack(side=side_label)
        return wrap
    
    def create_ranges_section(self, parent):
        """باکس انتخاب رنج‌ها برای اسکن (چک‌باکس) — سمت چپ ردیف دو باکس."""
        wrap = tk.Frame(parent, bg=self.theme['bg'])
        box = tk.Frame(wrap, bg=self.theme['card_bg'], relief=tk.FLAT, highlightbackground=self.theme.get('accent', '#89b4fa'), highlightthickness=1, padx=CARD_PADDING_X, pady=CARD_PADDING_Y)
        box.pack(fill=tk.BOTH, expand=True)
        anchor_sec = 'e' if self.is_rtl else 'w'
        tk.Label(box, text=" " + self.t("ranges_to_scan_label") + " ", font=self.font(11, bold=True), bg=self.theme['card_bg'], fg=self.theme['accent']).pack(anchor=anchor_sec)
        list_container = tk.Frame(box, bg=self.theme['card_bg'], relief=tk.FLAT)
        list_container.pack(fill=tk.BOTH, expand=True, pady=(4, 0))
        RANGES_LIST_HEIGHT = 5
        canvas = tk.Canvas(list_container, bg=self.theme['card_bg'], highlightthickness=0, height=min(120, RANGES_LIST_HEIGHT * 22))
        scrollbar = ttk.Scrollbar(list_container)
        self.ranges_inner_frame = tk.Frame(canvas, bg=self.theme['card_bg'])
        self.ranges_inner_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.ranges_inner_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.config(command=canvas.yview)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.ranges_list_container = list_container
        self.ranges_canvas = canvas
        def _ranges_scroll(e):
            if hasattr(e, 'delta') and e.delta != 0:
                canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
            elif getattr(e, 'num', None) == 5:
                canvas.yview_scroll(1, "units")
            elif getattr(e, 'num', None) == 4:
                canvas.yview_scroll(-1, "units")
        def _bind_ranges_wheel(e):
            canvas.bind_all("<MouseWheel>", _ranges_scroll)
            canvas.bind_all("<Button-4>", _ranges_scroll)
            canvas.bind_all("<Button-5>", _ranges_scroll)
        def _unbind_ranges_wheel(e):
            canvas.unbind_all("<MouseWheel>")
            canvas.unbind_all("<Button-4>")
            canvas.unbind_all("<Button-5>")
        list_container.bind("<Enter>", _bind_ranges_wheel)
        list_container.bind("<Leave>", _unbind_ranges_wheel)
        if self.available_ranges:
            self.refresh_ranges_selection_ui(self.available_ranges)
        else:
            self.ranges_placeholder_label = tk.Label(self.ranges_inner_frame, text=self.t("no_ranges_loaded"), font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['card_fg'])
            self.ranges_placeholder_label.pack(pady=8, padx=8, anchor='w' if not self.is_rtl else 'e')
        return wrap
    
    def refresh_ranges_selection_ui(self, ranges):
        """به‌روزرسانی لیست رنج‌ها با چک‌باکس (همه پیش‌فرض تیک‌دار)."""
        self.available_ranges = list(ranges) if ranges else []
        self.range_check_vars = [tk.BooleanVar(value=True) for _ in self.available_ranges]
        for w in self.ranges_inner_frame.winfo_children():
            w.destroy()
        if not self.available_ranges:
            self.ranges_placeholder_label = tk.Label(self.ranges_inner_frame, text=self.t("no_ranges_loaded"), font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['card_fg'])
            self.ranges_placeholder_label.pack(pady=8, padx=8, anchor='w' if not self.is_rtl else 'e')
            return
        for i, cidr in enumerate(self.available_ranges):
            cb = tk.Checkbutton(
                self.ranges_inner_frame,
                text=cidr,
                variable=self.range_check_vars[i],
                font=self.font(9),
                bg=self.theme['card_bg'],
                fg=self.theme['fg'],
                selectcolor=self.theme['card_bg'],
                activebackground=self.theme['card_bg'],
                activeforeground=self.theme['fg'],
                anchor='w' if not self.is_rtl else 'e'
            )
            cb.pack(anchor='w' if not self.is_rtl else 'e', padx=8, pady=0, fill=tk.X)
        try:
            self.ranges_canvas.configure(scrollregion=self.ranges_canvas.bbox("all"))
        except Exception:
            pass
    
    def get_selected_ranges(self):
        """رنج‌های انتخاب‌شده (تیک‌خورده) را برمی‌گرداند."""
        if not self.available_ranges or len(self.range_check_vars) != len(self.available_ranges):
            return []
        return [r for i, r in enumerate(self.available_ranges) if self.range_check_vars[i].get()]
    
    def show_settings_dialog(self):
        """پنجره تنظیمات: اصلی، تم، روش بررسی IP."""
        # نمایش همیشه مطابق _saved_* (همان چیزی که آخر بار ذخیره شد)
        # از فایل نخوان اینجا — _saved_* موقع ذخیره آپدیت شده؛ با همین comboها را پر کن
        if hasattr(self, "_saved_mode_key"):
            self.mode_var.set(self.t(self._saved_mode_key))
        if hasattr(self, "_saved_ai_key"):
            self.ai_var.set(self.t(self._saved_ai_key))
        if hasattr(self, "_saved_target_key"):
            self.target_var.set(self.t(self._saved_target_key))
        
        win = tk.Toplevel(self.root)
        win.title(self.t("settings"))
        win.configure(bg=self.theme['bg'])
        win.resizable(True, True)
        win.transient(self.root)
        win.grab_set()
        
        rtl = self.is_rtl
        anchor_sec = 'e' if rtl else 'w'
        side_1 = tk.RIGHT if rtl else tk.LEFT
        side_2 = tk.LEFT if rtl else tk.RIGHT
        
        main_f = tk.Frame(win, bg=self.theme['bg'], padx=20, pady=15)
        main_f.pack(fill=tk.BOTH, expand=True)
        
        # === تنظیمات اصلی (راست‌چین در فارسی) ===
        tk.Label(main_f, text=self.t("settings_main"), font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor=anchor_sec, pady=(0, 8))
        row1 = tk.Frame(main_f, bg=self.theme['bg'])
        row1.pack(fill=tk.X, pady=5, anchor=anchor_sec)
        mode_vals = [self.t("mode_turbo"), self.t("mode_hyper"), self.t("mode_ultra"), self.t("mode_deep")]
        ai_vals = [self.t("ai_basic"), self.t("ai_smart"), self.t("ai_advanced"), self.t("ai_expert")]
        target_vals = [self.t(k) for k in self._target_keys]
        justify_combo = 'right' if rtl else 'left'
        tk.Label(row1, text=self.t("mode") + " ", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack(side=side_1, padx=(0, 5) if rtl else (5, 0))
        combo_mode = ttk.Combobox(row1, textvariable=self.mode_var, values=mode_vals, width=18, state="readonly", justify=justify_combo, font=self.font(9))
        combo_mode.pack(side=side_1, padx=5)
        tk.Label(row1, text=self.t("ai") + " ", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack(side=side_1, padx=(15, 5) if rtl else (5, 15))
        combo_ai = ttk.Combobox(row1, textvariable=self.ai_var, values=ai_vals, width=14, state="readonly", justify=justify_combo, font=self.font(9))
        combo_ai.pack(side=side_1, padx=5)
        tk.Label(row1, text=self.t("count") + " ", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack(side=side_1, padx=(15, 5) if rtl else (5, 15))
        combo_target = ttk.Combobox(row1, textvariable=self.target_var, values=target_vals, width=12, state="readonly", justify=justify_combo, font=self.font(9))
        combo_target.pack(side=side_1, padx=5)
        # مطمئن شو comboها مقدار فعلی var را نشان می‌دهند (ttk گاهی sync نمی‌کند)
        try:
            combo_mode.set(self.mode_var.get())
            combo_ai.set(self.ai_var.get())
            combo_target.set(self.target_var.get())
        except Exception:
            pass
        
        # === تغییر رنگ / تم ===
        tk.Label(main_f, text=self.t("settings_theme"), font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor=anchor_sec, pady=(20, 8))
        theme_frame = tk.Frame(main_f, bg=self.theme['bg'])
        theme_frame.pack(fill=tk.X, pady=5, anchor=anchor_sec)
        theme_var = tk.StringVar(value=self.current_theme)
        tk.Radiobutton(theme_frame, text="🌙 Dark", variable=theme_var, value="dark", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg'], selectcolor=self.theme['card_bg'], activebackground=self.theme['bg'], activeforeground=self.theme['fg']).pack(side=side_1, padx=10)
        tk.Radiobutton(theme_frame, text="☀️ Light", variable=theme_var, value="light", font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg'], selectcolor=self.theme['card_bg'], activebackground=self.theme['bg'], activeforeground=self.theme['fg']).pack(side=side_1, padx=10)
        
        # === تغییر بررسی آی پی ها: فقط متن؛ گزینه ایجنت قابل انتخاب نیست، با کلیک فقط پیام نمایش داده می‌شود ===
        tk.Label(main_f, text=self.t("settings_ip_check"), font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor=anchor_sec, pady=(20, 8))
        ip_check_frame = tk.Frame(main_f, bg=self.theme['bg'])
        ip_check_frame.pack(fill=tk.X, pady=5, anchor=anchor_sec)
        tk.Label(ip_check_frame, text=self.t("ip_check_my_internet"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack(side=side_1, padx=5)
        agent_link = tk.Label(ip_check_frame, text=self.t("ip_check_agent") + " (?)", font=self.font(10), bg=self.theme['bg'], fg=self.theme['accent'], cursor="hand2", underline=True)
        agent_link.pack(side=side_1, padx=5)
        agent_link.bind("<Button-1>", lambda e: messagebox.showinfo(self.t("settings_ip_check"), self.t("ip_check_agent_message")))
        
        def on_save():
            win.update()
            self.current_theme = theme_var.get()
            self.theme = ThemeManager.get_theme(self.current_theme)
            mode_display = (combo_mode.get() or "").strip()
            ai_display = (combo_ai.get() or "").strip()
            target_display = (combo_target.get() or "").strip()
            self._save_config(mode_display=mode_display, ai_display=ai_display, target_display=target_display)
            messagebox.showinfo(self.t("success_title"), self.t("settings_saved"))
            win.destroy()
            # اعمال فوری تم با بازسازی UI
            self._font_cache.clear()
            self._fa_font_cache.clear()
            for w in self.root.winfo_children():
                w.destroy()
            self.setup_ui()
            self.check_queue()
        
        btn_row = tk.Frame(main_f, bg=self.theme['bg'])
        btn_row.pack(pady=25, anchor=anchor_sec)
        tk.Button(btn_row, text=self.t("save_btn"), font=self.font(11, bold=True), bg=self.theme['success'], fg='#000', relief=tk.FLAT, padx=30, pady=8, cursor="hand2", command=on_save).pack(side=side_1, padx=8)
        tk.Button(btn_row, text=self.t("close_btn"), font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['fg'], relief=tk.FLAT, padx=20, pady=6, cursor="hand2", command=win.destroy).pack(side=side_1, padx=8)
    
    def _strip_emoji(self, s):
        """حذف ایموجی از انتهای متن برای نمایش کنار آیکن FA."""
        for c in "🤖💾⏹️🚀📡⚙️⚡✅⏱️🎯📊⭐🔓📍🏆📺💎🌙☀️":
            s = s.replace(c, "")
        return s.strip()
    
    def create_buttons(self, parent):
        btn_frame = tk.Frame(parent, bg=self.theme['bg'])
        right_buttons = tk.Frame(btn_frame, bg=self.theme['bg'])
        right_buttons.pack(anchor='center')
        buttons = [
            ("analyze_btn", "robot", self.theme['warning'], self.ai_analyze, "analyze_btn"),
            ("save_btn", "save", self.theme['accent'], self.export_menu, "export_btn"),
            ("stop_btn", "stop", self.theme['error'], self.stop_scan, "stop_btn"),
            ("start_btn", "play", self.theme['success'], self.start_scan, "start_btn")
        ]
        side_btn = tk.LEFT if self.is_rtl else tk.RIGHT
        for text_key, icon_name, color, command, var_name in buttons:
            row = tk.Frame(right_buttons, bg=color)
            row.pack(side=side_btn, padx=5)
            char, fa_f, fa_color = self.fa_icon(icon_name, 12)
            if fa_f:
                tk.Label(row, text=char, font=fa_f, bg=color, fg=fa_color).pack(side=tk.LEFT, padx=(10, 4), pady=8)
            btn = tk.Button(row, text=self._strip_emoji(self.t(text_key)), font=self.font(11, bold=True), bg=color, fg='#000', activebackground=color, relief=tk.FLAT, padx=16, pady=8, cursor="hand2", command=command)
            btn.pack(side=tk.LEFT, padx=(0, 14))
            setattr(self, var_name, btn)
        self.stop_btn.config(state=tk.DISABLED)
        return btn_frame
    
    PROGRESS_BAR_WIDTH = 400
    
    def _set_progress_percent(self, percent):
        """تنظیم نوار پیشرفت بر اساس درصد ۰–۱۰۰؛ در ۱۰۰٪ حتماً تا انتها پر شود."""
        percent = max(0, min(100, float(percent)))
        if not hasattr(self, '_progress_inner') or not hasattr(self, '_progress_outer'):
            return
        try:
            if not self._progress_inner.winfo_exists():
                return
        except Exception:
            return
        try:
            total_w = self._progress_outer.winfo_width()
            if total_w <= 0:
                total_w = self.PROGRESS_BAR_WIDTH
            if percent >= 99.5:
                w = total_w
            else:
                w = int(total_w * percent / 100.0)
            self._progress_inner.place(x=0, y=0, width=w, relheight=1)
            self._progress_inner.update_idletasks()
        except Exception:
            pass
    
    def create_progress(self, parent):
        prog_wrap = tk.Frame(parent, bg=self.theme['bg'])
        tk.Label(prog_wrap, text=" " + self.t("progress_title") + " ", font=self.font(11, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(anchor='e' if self.is_rtl else 'w')
        progress_frame = tk.Frame(prog_wrap, bg=self.theme['card_bg'], relief=tk.FLAT, highlightbackground=self.theme.get('accent', '#89b4fa'), highlightthickness=1, padx=CARD_PADDING_X, pady=CARD_PADDING_Y)
        progress_frame.pack(fill=tk.X, pady=(SECTION_PADDING // 2, 0))
        self._progress_outer = tk.Frame(progress_frame, width=self.PROGRESS_BAR_WIDTH, height=22, bg=self.theme.get('card_fg', '#4c4f69'))
        self._progress_outer.pack(pady=6)
        self._progress_outer.pack_propagate(False)
        self._progress_inner = tk.Frame(self._progress_outer, width=0, height=22, bg=self.theme['success'])
        self._progress_inner.place(x=0, y=0, width=0, relheight=1)
        self.status_label = tk.Label(progress_frame, text=self.t("ready_status"), font=self.font(11, bold=True), bg=self.theme['card_bg'], fg=self.theme['success'])
        self.status_label.pack(pady=4, anchor='e' if self.is_rtl else 'w')
        return prog_wrap
    
    def create_results(self, parent):
        res_wrap = tk.Frame(parent, bg=self.theme['bg'])
        tk.Label(res_wrap, text=" " + self.t("results_title") + " ", font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['success']).pack(anchor='e' if self.is_rtl else 'w')
        results_frame = tk.Frame(res_wrap, bg=self.theme['card_bg'], relief=tk.FLAT, highlightbackground=self.theme.get('accent', '#89b4fa'), highlightthickness=1, padx=CARD_PADDING_X, pady=CARD_PADDING_Y)
        results_frame.pack(fill=tk.BOTH, expand=True, pady=(SECTION_PADDING // 2, 0))
        style = ttk.Style()
        style.configure("Treeview", font=self.font(10), rowheight=18)
        style.configure("Treeview.Heading", font=self.font(11, bold=True))
        columns = ("Score", "Ports", "Ping", "IP", "Rank")
        self.tree = ttk.Treeview(results_frame, columns=columns, show='headings', height=8)
        headers = [(self.t("score_hdr"), 90), (self.t("ports_hdr"), 350), (self.t("ping_hdr"), 90), (self.t("ip_hdr"), 140), (self.t("rank_hdr"), 70)]
        for (text, width), col in zip(headers, columns):
            self.tree.heading(col, text=text)
            self.tree.column(col, width=width, anchor='center')
        scrollbar = ttk.Scrollbar(results_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        
        self.tree.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=4, pady=4)
        scrollbar.pack(side=tk.LEFT, fill=tk.Y)
        
        self.tree.bind("<ButtonRelease-1>", self.on_tree_click)
        self.tree.bind("<Button-3>", self.copy_ip)
        return res_wrap
    
    def create_footer(self, parent):
        footer = tk.Frame(parent, bg=self.theme['bg'])
        footer_center = tk.Frame(footer, bg=self.theme['bg'])
        footer_center.pack(anchor='center')
        tk.Label(footer_center, text=self.t("made_by_simple"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack()
        link_row = tk.Frame(footer_center, bg=self.theme['bg'])
        link_row.pack(pady=4)
        gh_char, gh_f, gh_color = self.fa_icon("github", 12, use_brands=True)
        if gh_f:
            github_btn = tk.Label(link_row, text=gh_char, font=gh_f, bg=self.theme['bg'], fg=gh_color, cursor="hand2")
        else:
            github_btn = tk.Label(link_row, text=self.t("github_text"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['accent'], cursor="hand2")
        github_btn.pack(side=tk.LEFT, padx=12)
        github_btn.bind("<Button-1>", lambda e: webbrowser.open(GITHUB_REPO_URL))
        yt_char, yt_f, yt_color = self.fa_icon("youtube", 12, use_brands=True)
        if yt_f:
            yt_btn = tk.Label(link_row, text=yt_char, font=yt_f, bg=self.theme['bg'], fg=yt_color, cursor="hand2")
        else:
            yt_btn = tk.Label(link_row, text=self.t("youtube_text"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['accent'], cursor="hand2")
        yt_btn.pack(side=tk.LEFT, padx=12)
        yt_btn.bind("<Button-1>", lambda e: webbrowser.open(YOUTUBE_URL))
        web_btn = tk.Label(link_row, text=self.t("website_link_text"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['accent'], cursor="hand2")
        web_btn.pack(side=tk.LEFT, padx=12)
        web_btn.bind("<Button-1>", lambda e: webbrowser.open(WEBSITE_URL))
        return footer
    
    def on_tree_click(self, event):
        """کلیک روی آیتم برای کپی IP"""
        region = self.tree.identify("region", event.x, event.y)
        if region == "cell":
            item = self.tree.identify_row(event.y)
            if item:
                ip = self.tree.item(item)['values'][3]  # IP column
                self.root.clipboard_clear()
                self.root.clipboard_append(ip)
                self.root.update()
                # Show tooltip
                self.show_tooltip(self.t("ip_copied").format(ip))
    
    def show_tooltip(self, text):
        """نمایش tooltip"""
        tooltip = tk.Toplevel(self.root)
        tooltip.wm_overrideredirect(True)
        tooltip.wm_geometry(f"+{self.root.winfo_pointerx()+10}+{self.root.winfo_pointery()+10}")
        
        label = tk.Label(
            tooltip,
            text=text,
            font=self.font(10),
            bg=self.theme['success'],
            fg='#000',
            padx=10,
            pady=5
        )
        label.pack()
        
        self.root.after(1500, tooltip.destroy)
    
    def copy_ip(self, event):
        """کپی IP با راست کلیک"""
        item = self.tree.selection()
        if item:
            ip = self.tree.item(item[0])['values'][3]
            self.root.clipboard_clear()
            self.root.clipboard_append(ip)
            self.root.update()
            self.show_tooltip(self.t("ip_copied").format(ip))
    
    def show_donate(self):
        donate_window = tk.Toplevel(self.root)
        donate_window.title("💎 " + self.t("donate_title"))
        donate_window.geometry("500x300")
        donate_window.configure(bg=self.theme['bg'])
        donate_window.resizable(False, False)
        
        tk.Label(donate_window, text=self.t("donate_title"), font=self.font(18, bold=True), bg=self.theme['bg'], fg=self.theme['accent']).pack(pady=20)
        tk.Label(donate_window, text=self.t("donate_desc"), font=self.font(11), bg=self.theme['bg'], fg=self.theme['fg']).pack(pady=10)
        
        address_frame = RoundedFrame(donate_window, radius=RADIUS_BOX, bg=self.theme['card_bg'])
        address_frame.pack(pady=20, padx=30, fill=tk.X)
        
        tk.Label(
            address_frame.inner,
            text="USDT (Ethereum Network)",
            font=self.font(10, bold=True),
            bg=self.theme['card_bg'],
            fg=self.theme['warning']
        ).pack(pady=(10, 5))
        
        address = "0xde200d902bcf7d2a4f4a17b337b93caa7f78c269"
        tk.Label(
            address_frame.inner,
            text=address,
            font=self.font(10),
            bg=self.theme['card_bg'],
            fg=self.theme['accent']
        ).pack(pady=(0, 10))
        
        def copy_address():
            donate_window.clipboard_clear()
            donate_window.clipboard_append(address)
            messagebox.showinfo(self.t("msg_copied"), self.t("msg_copied"))
        
        tk.Button(
            donate_window,
            text=self.t("copy_btn"),
            font=self.font(11, bold=True),
            bg=self.theme['success'],
            fg='#000',
            relief=tk.FLAT,
            padx=30,
            pady=10,
            cursor="hand2",
            command=copy_address
        ).pack(pady=10)
        
        tk.Label(donate_window, text=self.t("thanks"), font=self.font(10), bg=self.theme['bg'], fg=self.theme['fg']).pack()
    
    def show_range_fetcher(self):
        fetcher_window = tk.Toplevel(self.root)
        fetcher_window.title("📡 " + self.t("range_fetcher_title"))
        fetcher_window.geometry("700x600")
        fetcher_window.configure(bg=self.theme['bg'])
        
        tk.Label(
            fetcher_window,
            text=self.t("range_sources_title"),
            font=self.font(16, bold=True),
            bg=self.theme['bg'],
            fg=self.theme['accent']
        ).pack(pady=20)
        
        sources_frame = tk.Frame(fetcher_window, bg=self.theme['bg'])
        sources_frame.pack(pady=10)
        
        def on_future_source():
            messagebox.showinfo(self.t("settings"), self.t("coming_future_updates"))
        
        sources = [
            (self.t("cf_api"), lambda: self.fetch_ranges("cf_api", fetcher_window)),
            (self.t("cf_asn"), on_future_source),
            (self.t("cf_github"), on_future_source),
            (self.t("fastly_api"), lambda: self.fetch_ranges("fastly_api", fetcher_window)),
            (self.t("fastly_asn"), on_future_source),
            (self.t("all_sources"), on_future_source),
        ]
        
        for idx, (text, command) in enumerate(sources):
            tk.Button(
                sources_frame,
                text=text,
                font=self.font(11),
                bg=self.theme['card_bg'],
                fg=self.theme['fg'],
                activebackground=self.theme['accent'],
                relief=tk.FLAT,
                padx=20,
                pady=10,
                cursor="hand2",
                command=command
            ).grid(row=idx//2, column=idx%2, padx=10, pady=5, sticky='ew')
        
        tk.Label(fetcher_window, text=self.t("ranges_received"), font=self.font(12, bold=True), bg=self.theme['bg'], fg=self.theme['success']).pack(pady=(20, 5))
        
        self.ranges_text = scrolledtext.ScrolledText(fetcher_window, height=15, font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['fg'])
        self.ranges_text.pack(padx=20, pady=10, fill=tk.BOTH, expand=True)
        
        self.ranges_stats_label = tk.Label(
            fetcher_window,
            text=self.t("ready_fetch"),
            font=self.font(10),
            bg=self.theme['bg'],
            fg=self.theme['fg']
        )
        self.ranges_stats_label.pack(pady=5)
    
    def fetch_ranges(self, source, window):
        self.ranges_text.delete(1.0, tk.END)
        self.ranges_stats_label.config(text=self.t("fetching"))
        
        def fetch_thread():
            ranges = []
            
            source_key = {"cf_api": "source_cf_api", "cf_asn": "source_cf_asn", "cf_github": "source_cf_github",
                         "fastly_api": "source_fastly_api", "fastly_asn": "source_fastly_asn", "all": "source_all"}.get(source, "source_all")
            if source == "cf_api":
                ranges = self.fetcher.get_cloudflare_official()
            elif source == "cf_asn":
                ranges = self.fetcher.get_cloudflare_asn()
            elif source == "cf_github":
                ranges = self.fetcher.get_cloudflare_github()
            elif source == "fastly_api":
                ranges = self.fetcher.get_fastly_official()
            elif source == "fastly_asn":
                ranges = self.fetcher.get_fastly_asn()
            else:
                ranges = self.fetcher.get_all_sources()
            
            self.root.after(0, lambda: self.display_ranges(ranges, source_key))
        
        threading.Thread(target=fetch_thread, daemon=True).start()
    
    def display_ranges(self, ranges, source_key):
        self.ranges_text.delete(1.0, tk.END)
        
        if not ranges:
            self.ranges_text.insert(tk.END, "❌ " + self.t("error_fetch"))
            self.ranges_stats_label.config(text=self.t("error_title"), fg=self.theme['error'])
            return
        
        for r in ranges:
            self.ranges_text.insert(tk.END, f"{r}\n")
        
        self.ranges_stats_label.config(
            text=self.t("fetch_status").format(self.num(len(ranges)), self.t(source_key)),
            fg=self.theme['success']
        )
        # به‌روزرسانی منبع رنج در صفحهٔ اصلی و لیست رنج‌ها برای انتخاب (فقط برای cf_api و fastly_api)
        if source_key in ("source_cf_api", "source_fastly_api"):
            self.current_range_source = self.t("cf_api") if source_key == "source_cf_api" else self.t("fastly_api")
            if hasattr(self, "range_source_value_label") and self.range_source_value_label.winfo_exists():
                self.range_source_value_label.config(text=self.current_range_source)
            self.root.after(0, lambda: self.refresh_ranges_selection_ui(ranges))
    
    def toggle_theme(self):
        self.current_theme = 'light' if self.current_theme == 'dark' else 'dark'
        self.theme = ThemeManager.get_theme(self.current_theme)
        
        for widget in self.root.winfo_children():
            widget.destroy()
        
        self.setup_ui()
    
    def export_menu(self):
        if not self.results:
            messagebox.showwarning(self.t("error_title"), self.t("msg_no_results"))
            return
        
        menu_window = tk.Toplevel(self.root)
        menu_window.title(self.t("export_menu_title"))
        menu_window.geometry("400x250")
        menu_window.configure(bg=self.theme['bg'])
        menu_window.resizable(False, False)
        
        tk.Label(
            menu_window,
            text=self.t("export_menu_title"),
            font=self.font(16, bold=True),
            bg=self.theme['bg'],
            fg=self.theme['accent']
        ).pack(pady=20)
        
        def export_json():
            menu_window.destroy()
            self.export_json()
        
        def export_excel():
            menu_window.destroy()
            self.export_excel()
        
        tk.Button(
            menu_window,
            text=self.t("excel_btn"),
            font=self.font(13, bold=True),
            bg=self.theme['success'],
            fg='#000',
            relief=tk.FLAT,
            padx=40,
            pady=15,
            cursor="hand2",
            command=export_excel
        ).pack(pady=10)
        
        tk.Button(
            menu_window,
            text=self.t("json_btn"),
            font=self.font(13, bold=True),
            bg=self.theme['accent'],
            fg='#000',
            relief=tk.FLAT,
            padx=40,
            pady=15,
            cursor="hand2",
            command=export_json
        ).pack(pady=10)
    
    def export_excel(self):
        """اکسپورت به Excel"""
        if not EXCEL_AVAILABLE:
            messagebox.showerror(self.t("error_title"), self.t("openpyxl_missing"))
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")],
            initialfile=f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
        
        if filename:
            try:
                ExcelExporter.export(self.results, filename, app=self)
                messagebox.showinfo(self.t("success_title"), self.t("file_saved").format(filename))
            except Exception as e:
                messagebox.showerror(self.t("error_title"), self.t("save_error").format(str(e)))
    
    def export_json(self):
        """اکسپورت به JSON"""
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            initialfile=f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        if filename:
            sorted_results = sorted(self.results, key=lambda x: x['score'], reverse=True)
            
            output = {
                'scan_info': {
                    'date': datetime.now().isoformat(),
                    'mode': self.mode_var.get(),
                    'ai_level': self.ai_var.get(),
                    'duration': time.time() - self.start_time if self.start_time else 0,
                    'author': AUTHOR_NAME,
                    'github': GITHUB_URL,
                    'website': WEBSITE_URL,
                    'youtube': YOUTUBE_URL,
                    'donate': '0xde200d902bcf7d2a4f4a17b337b93caa7f78c269'
                },
                'statistics': {
                    'total_scanned': self.total_scanned,
                    'total_found': self.total_found,
                    'success_rate': f"{(self.total_found / self.total_scanned * 100):.2f}%" if self.total_scanned > 0 else "0%"
                },
                'results': sorted_results
            }
            
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(output, f, indent=2, ensure_ascii=False)
                messagebox.showinfo(self.t("success_title"), self.t("file_saved").format(filename))
            except Exception as e:
                messagebox.showerror(self.t("error_title"), self.t("save_error").format(str(e)))
    
    def start_scan(self):
        if self.is_scanning:
            return
        
        # حتماً باید حداقل یک رنج انتخاب شده باشد
        selected = self.get_selected_ranges()
        if not selected:
            messagebox.showwarning(self.t("error_title"), self.t("select_range_first"))
            return
        
        # آی‌پی‌های بلاک‌شدهٔ قبلی را پاک نمی‌کنیم؛ از کش بارگذاری‌شده استفاده می‌کنیم و در صورت وجود سؤال می‌پرسیم
        rescan_closed = True
        if self.scanned_closed:
            n = len(self.scanned_closed)
            msg = self.t("rescan_blocked_message").format(self.num(n))
            win = tk.Toplevel(self.root)
            win.title(self.t("rescan_closed_title"))
            win.configure(bg=self.theme['bg'])
            win.resizable(False, False)
            win.transient(self.root)
            win.grab_set()
            tk.Label(win, text=msg, font=self.font(11), bg=self.theme['bg'], fg=self.theme['fg'], wraplength=400).pack(padx=24, pady=16)
            btn_f = tk.Frame(win, bg=self.theme['bg'])
            btn_f.pack(pady=(0, 16))
            dialog_result = [True]
            def on_yes():
                dialog_result[0] = True
                win.destroy()
            def on_no():
                dialog_result[0] = False
                win.destroy()
            tk.Button(btn_f, text=self.t("rescan_yes"), font=self.font(10), bg=self.theme['success'], fg='#000', relief=tk.FLAT, padx=16, pady=6, cursor="hand2", command=on_yes).pack(side=tk.LEFT, padx=8)
            tk.Button(btn_f, text=self.t("rescan_no"), font=self.font(10), bg=self.theme['card_bg'], fg=self.theme['fg'], relief=tk.FLAT, padx=16, pady=6, cursor="hand2", command=on_no).pack(side=tk.LEFT, padx=8)
            win.wait_window()
            rescan_closed = dialog_result[0]
        
        self.is_scanning = True
        self.results = []
        self.total_scanned = 0
        self.total_found = 0
        self.start_time = time.time()
        
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        self._set_progress_percent(0)
        self.root.update_idletasks()
        
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.export_btn.config(state=tk.DISABLED)
        self.analyze_btn.config(state=tk.DISABLED)
        
        threading.Thread(target=self.scan_worker, args=(rescan_closed,), daemon=True).start()
    
    def scan_worker(self, rescan_closed=True):
        try:
            self.update_queue.put(("status", self.t("status_fetch")))
            
            all_ranges = self.get_selected_ranges()
            
            if not all_ranges:
                self.update_queue.put(("error", self.t("select_range_first")))
                self.update_queue.put(("done", None))
                return
            
            self.update_queue.put(("status", self.t("status_analyze").format(len(all_ranges))))
            
            target = self.get_target_internal()
            if target == "All":
                best_ranges = all_ranges
            else:
                # برای رسیدن به «تعداد» نتیجه، رنج کافی برمی‌داریم (حداکثر ۵۰۰ رنج)
                best_ranges = self.ai.predict_best_ranges(all_ranges, min(500, max(100, int(target) * 3)))
            
            self.update_queue.put(("status", self.t("status_scan").format(len(best_ranges))))
            self.update_queue.put(("total", len(best_ranges)))
            
            mode = self.get_mode_internal()
            if "5s" in mode:
                max_ips = 30
                self.scanner.max_workers = 600
            elif "10s" in mode:
                max_ips = 50
                self.scanner.max_workers = 500
            elif "15s" in mode:
                max_ips = 70
                self.scanner.max_workers = 400
            else:
                max_ips = 100
                self.scanner.max_workers = 300
            
            ports = self.ai.priority_ports
            target_count = None if target == "All" else int(target)
            
            for idx, cidr in enumerate(best_ranges):
                if not self.is_scanning:
                    break
                if target_count is not None and len(self.results) >= target_count:
                    break
                
                ips = self.ai.smart_sample(cidr, max_ips)
                if not rescan_closed and self.scanned_closed:
                    ips = [ip for ip in ips if str(ip) not in self.scanned_closed]
                if not ips:
                    elapsed = time.time() - self.start_time
                    speed = self.total_scanned / elapsed if elapsed > 0 else 0
                    self.update_queue.put(("progress", (idx + 1, len(best_ranges), speed, elapsed)))
                    continue
                
                batch_results = self.scanner.batch_scan(ips, ports)
                open_ips = {r['ip'] for r in batch_results}
                for ip in ips:
                    if str(ip) not in open_ips:
                        self.scanned_closed.add(str(ip))
                
                for result in batch_results:
                    if target_count is not None and len(self.results) >= target_count:
                        break
                    self.total_found += 1
                    score = self._calc_score(result)
                    result['score'] = score
                    self.results.append(result)
                    self.update_queue.put(("result", result))
                
                self.total_scanned += len(ips)
                elapsed = time.time() - self.start_time
                speed = self.total_scanned / elapsed if elapsed > 0 else 0
                self.update_queue.put(("progress", (idx + 1, len(best_ranges), speed, elapsed)))
            
            # یک‌بار دیگر پیشرفت را روی ۱۰۰٪ بگذار تا نوار سبز کامل شود (حتی اگر زود break شده باشیم)
            elapsed = time.time() - self.start_time
            speed = self.total_scanned / elapsed if elapsed > 0 else 0
            self.update_queue.put(("progress", (len(best_ranges), len(best_ranges), speed, elapsed)))
            self._save_scan_cache()
            self.update_queue.put(("done", None))
            
        except Exception as e:
            self.update_queue.put(("error", str(e)))
            self.update_queue.put(("done", None))
    
    def _calc_score(self, result):
        score = 100.0
        if result['ping']:
            score -= min(result['ping'] / 2, 50)
        score += len(result['open_ports']) * 5
        if 443 in result['open_ports']:
            score += 10
        if 80 in result['open_ports']:
            score += 8
        return max(0, min(100, score))
    
    def stop_scan(self):
        self.is_scanning = False
        self.stop_btn.config(state=tk.DISABLED)
    
    def ai_analyze(self):
        if not self.results:
            messagebox.showinfo(self.t("analyze_title"), self.t("no_results_analyze"))
            return
        
        sorted_results = sorted(self.results, key=lambda x: x['score'], reverse=True)
        avg_ping = sum(r['ping'] for r in self.results if r['ping']) / len(self.results)
        best = sorted_results[0]
        
        n_results = len(self.results)
        n_low_ping = len([r for r in self.results if r['ping'] and r['ping'] < 50])
        n_443 = len([r for r in self.results if 443 in r['open_ports']])
        n_3ports = len([r for r in self.results if len(r['open_ports']) >= 3])
        
        # گزارش تحلیل: خطوط جدا و مرتب (آخرین خط‌ها جدا تا در RTL قاطی نشوند)
        lines = [
            self.t("analyze_title"),
            "=" * 40,
            "",
            self.t("found") + ": " + self.num(n_results),
            "Ping: " + (self.t("ping_unsuitable") if avg_ping >= 1000 else self.num(int(round(avg_ping))) + " ms"),
            self.t("score_hdr") + ": " + self.num(int(best['score'])) + " / " + self.num(100),
            "",
            "Best IP: " + best['ip'],
            "Ping: " + (self.t("ping_unsuitable") if best['ping'] >= 1000 else self.num(int(round(best['ping']))) + " ms"),
            "Ports: " + ", ".join(map(str, best['open_ports'])),
            "",
            self.num(n_low_ping) + " IP < 50ms",
            self.num(n_443) + " with 443",
            self.num(n_3ports) + " with 3+ ports",
        ]
        analysis_text = "\n".join(lines)
        
        # پنجرهٔ سفارشی برای گزارش راست‌چین و مرتب
        win = tk.Toplevel(self.root)
        win.title(self.t("analyze_title"))
        win.configure(bg=self.theme['bg'])
        win.resizable(True, True)
        win.transient(self.root)
        
        main_f = tk.Frame(win, bg=self.theme['bg'], padx=24, pady=20)
        main_f.pack(fill=tk.BOTH, expand=True)
        
        txt = scrolledtext.ScrolledText(
            main_f,
            font=self.font(11),
            bg=self.theme['card_bg'],
            fg=self.theme['fg'],
            relief=tk.FLAT,
            padx=15,
            pady=15,
            wrap=tk.WORD,
            width=48,
            height=18,
        )
        txt.pack(fill=tk.BOTH, expand=True)
        txt.insert(tk.END, analysis_text)
        txt.tag_configure("align", justify=tk.RIGHT if self.is_rtl else tk.LEFT)
        txt.tag_add("align", "1.0", tk.END)
        # کلیک روی IP → کپی خودکار در کلیپ‌بورد
        def on_ai_text_click(event):
            idx = txt.index(f"@{event.x},{event.y}")
            parts = idx.split(".")
            line_num, col = parts[0], int(parts[1])
            line_content = txt.get(f"{line_num}.0", f"{line_num}.end")
            for m in re.finditer(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", line_content):
                start, end = m.span()
                if start <= col < end:
                    ip = m.group(0)
                    win.clipboard_clear()
                    win.clipboard_append(ip)
                    win.update()
                    self.show_tooltip(self.t("ip_copied").format(ip))
                    return
        txt.bind("<Button-1>", on_ai_text_click)
        txt.bind("<Key>", lambda e: "break")
        txt.config(cursor="hand2")
        
        tk.Button(main_f, text=self.t("close_btn"), font=self.font(10), bg=self.theme['accent'], fg='#000', relief=tk.FLAT, padx=20, pady=6, cursor="hand2", command=win.destroy).pack(pady=(CARD_PADDING_Y + 4, 0), anchor='e' if self.is_rtl else 'w')
    
    def check_queue(self):
        try:
            while True:
                msg_type, data = self.update_queue.get_nowait()
                
                if msg_type == "status":
                    self.status_label.config(text=data)
                elif msg_type == "total":
                    pass
                    # نوار پیشرفت بر اساس درصد ۰–۱۰۰ است؛ هدف را عوض نکن
                elif msg_type == "progress":
                    done, total, speed, elapsed = data
                    percent = (float(done) / float(total) * 100.0) if total and total > 0 else 0.0
                    percent = min(100.0, percent)
                    self._set_progress_percent(percent)
                    self.speed_label.config(text=self.num(int(speed)) + " IP/s")
                    self.found_label.config(text=self.num(self.total_found))
                    self.time_label.config(text=self.num(f"{elapsed:.1f}") + "s")
                    self.status_label.config(text=self.t("status_pct").format(self.num(f"{percent:.1f}")))
                    self.root.update_idletasks()
                elif msg_type == "result":
                    result = data
                    # پورت‌های باز: آیکن سبز ✅ — پورت‌های بسته: آیکن قرمز ❌
                    ports_str = ", ".join([f"{p}✅" if p in result['open_ports'] else f"{p}❌" for p in self.ai.priority_ports])
                    score_str = self.num(int(result['score'])) + "/" + self.num(100)
                    if not result.get('ping'):
                        ping_str = "N/A"
                    elif result['ping'] >= 1000:
                        ping_str = self.t("ping_unsuitable")
                    else:
                        ping_str = self.num(int(round(result['ping']))) + " ms"
                    self.tree.insert("", 0, values=(score_str, ports_str, ping_str, result['ip'], "🏆"))
                    items = self.tree.get_children()
                    target = self.get_target_internal()
                    if target != "All" and len(items) > int(target):
                        self.tree.delete(items[-1])
                    for idx, item in enumerate(self.tree.get_children(), 1):
                        values = list(self.tree.item(item)['values'])
                        values[4] = "#" + self.num(idx)
                        self.tree.item(item, values=values)
                elif msg_type == "error":
                    messagebox.showerror(self.t("error_title"), data)
                elif msg_type == "done":
                    self.is_scanning = False
                    self._set_progress_percent(100)
                    try:
                        self.root.update_idletasks()
                        self.root.update()
                    except Exception:
                        pass
                    # یک‌بار دیگر بعد از یک تیک تا نوار حتماً تا انتها پر شود (ویندوز/رندر)
                    self.root.after(50, lambda: self._set_progress_percent(100))
                    self.start_btn.config(state=tk.NORMAL)
                    self.stop_btn.config(state=tk.DISABLED)
                    self.export_btn.config(state=tk.NORMAL)
                    self.analyze_btn.config(state=tk.NORMAL)
                    elapsed = time.time() - self.start_time
                    self.status_label.config(text=self.t("scan_done").format(self.num(self.total_found), self.num(f"{elapsed:.1f}")))
                    if self.total_found > 0:
                        self.root.after(1000, self.ai_analyze)
        except Exception:
            pass

        self.root.after(50, self.check_queue)


if __name__ == "__main__":
    root = tk.Tk()
    app = CDNScannerPro(root)
    root.mainloop()
