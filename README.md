# CDN IP Scanner Pro (IP Scanner Pro)

**English** | [فارسی](#-فارسی)

---

## English

### About

CDN IP Scanner Pro (V1.0) is a desktop app for scanning and finding the best CDN IPs. It uses your own internet connection to check IPs (no proxy). You can fetch IP ranges from **Cloudflare** and **Fastly** official APIs, choose which ranges to scan, and export results to Excel or JSON.

**Author:** Shahin Salek Tootoonchi  
**GitHub:** [github.com/shahinst](https://github.com/shahinst) · **Website:** [digicloud.tr](https://digicloud.tr) · **YouTube:** [@shaahinst](https://www.youtube.com/@shaahinst)

### Features

- **Fetch ranges:** Cloudflare (official API) and Fastly (official API). Other sources planned for future updates.
- **Range selection:** List of ranges with checkboxes; scan only the ranges you select.
- **Scan:** Requires at least one range to be selected. Scans IPs from selected ranges only.
- **Blocked IP memory:** Remembers IPs that had no ping and no open ports. Next time you can choose to rescan them or skip and scan the rest.
- **Settings:** Mode (Turbo/Hyper/Ultra/Deep), AI level, count (50, 100, 150, 200, 500, 1000, or All), theme (Dark/Light).
- **Results:** Score, ports, ping (integer 1–999 ms; “Unsuitable” for ≥1000 ms), IP, rank. Results table and AI analysis.
- **Export:** Excel (.xlsx) and JSON (.json).
- **Languages:** Interface in **English**, **Persian (Farsi)**, and also **Russian** and **Chinese**.

### Requirements

- Python 3.8+
- `requests`, `openpyxl` (see `requirements.txt`)

### Run

```bash
pip install -r requirements.txt
python ip_scanner_pro.py
```

On Windows you can use `Run_Scanner.bat` or `Scanner_Pro.bat`.

### Project structure

- `ip_scanner_pro.py` — main application
- `requirements.txt` — Python dependencies
- `fonts/` — Vazirmatn, Font Awesome (optional)
- `config.json` — saved settings (created on first run)
- `scan_cache.json` — cached blocked IPs (created when you scan)

---

## فارسی

### درباره

CDN IP Scanner Pro (نسخه ۱.۰) یک برنامه دسکتاپ برای اسکن و پیدا کردن بهترین آی‌پی‌های CDN است. از اینترنت خودتان برای بررسی آی‌پی‌ها استفاده می‌کند (بدون پراکسی). می‌توانید رنج‌های آی‌پی را از **API رسمی Cloudflare** و **API رسمی Fastly** بگیرید، انتخاب کنید کدام رنج‌ها اسکن شوند و نتیجه را به Excel یا JSON خروجی بگیرید.

**نویسنده:** شاهین سالک توتونچی  
**گیت‌هاب:** [github.com/shahinst](https://github.com/shahinst) · **وب‌سایت:** [digicloud.tr](https://digicloud.tr) · **یوتیوب:** [@shaahinst](https://www.youtube.com/@shaahinst)

### امکانات

- **دریافت رنج:** Cloudflare (API رسمی) و Fastly (API رسمی). بقیه منابع در آپدیت‌های بعدی.
- **انتخاب رنج:** لیست رنج‌ها با چک‌باکس؛ فقط رنج‌های انتخاب‌شده اسکن می‌شوند.
- **اسکن:** حتماً حداقل یک رنج باید انتخاب شده باشد. فقط آی‌پی‌های رنج‌های انتخاب‌شده اسکن می‌شوند.
- **حافظه آی‌پی بلاک‌شده:** آی‌پی‌هایی که پینگ و پورت باز نداشتند ذخیره می‌شوند. دفعه بعد می‌توانید همه را دوباره اسکن کنید یا فقط بقیه را.
- **تنظیمات:** حالت (Turbo/Hyper/Ultra/Deep)، سطح AI، تعداد (۵۰ تا ۱۰۰۰ یا همه)، تم (تاریک/روشن).
- **نتایج:** امتیاز، پورت‌ها، پینگ (عدد صحیح ۱–۹۹۹ ms؛ «نامناسب» برای ≥۱۰۰۰ ms)، آی‌پی، رتبه. جدول نتایج و تحلیل AI.
- **خروجی:** Excel (.xlsx) و JSON (.json).
- **زبان‌ها:** رابط به **فارسی** و **انگلیسی** و همچنین **روسی** و **چینی** موجود است.

### نیازمندی‌ها

- Python 3.8+
- `requests`, `openpyxl` (مطابق `requirements.txt`)

### اجرا

```bash
pip install -r requirements.txt
python ip_scanner_pro.py
```

در ویندوز می‌توانید از `Run_Scanner.bat` یا `Scanner_Pro.bat` استفاده کنید.

### ساختار پروژه

- `ip_scanner_pro.py` — برنامه اصلی
- `requirements.txt` — وابستگی‌های پایتون
- `fonts/` — وزیر متن
- `config.json` — تنظیمات ذخیره‌شده (با اولین اجرا ساخته می‌شود)
- `scan_cache.json` — کش آی‌پی‌های بلاک‌شده (پس از اسکن ساخته می‌شود)

---

**The application interface is also available in Russian (Русский) and Chinese (中文).**
Telegram Group | گروه تلگرام
https://t.me/shahinstgroup
**رابط برنامه به زبان‌های روسی و چینی هم پشتیبانی می‌شود.**

---

## Download & View stats · آمار دانلود و بازدید

![GitHub all releases](https://img.shields.io/github/downloads/shahinst/cdn-ip-scanner/total?style=for-the-badge)
![GitHub watchers](https://img.shields.io/github/watchers/shahinst/cdn-ip-scanner?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/shahinst/cdn-ip-scanner?style=for-the-badge)
