<p align="center">
  <img src="image/logo.png" alt="CDN IP Scanner Logo" width="80" height="80">
</p>

<h1 align="center">CDN IP Scanner V3.0</h1>

<p align="center">
  <b>High Accuracy &bull; Ultra Fast &bull; Real-Time</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cdn-ip-scanner"><img src="https://img.shields.io/npm/v/cdn-ip-scanner?style=flat-square&color=red&label=npm" alt="npm"></a>
  <a href="https://github.com/shahinst/cdn-ip-scanner/releases"><img src="https://img.shields.io/github/v/release/shahinst/cdn-ip-scanner?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/shahinst/cdn-ip-scanner/stargazers"><img src="https://img.shields.io/github/stars/shahinst/cdn-ip-scanner?style=flat-square&color=yellow" alt="Stars"></a>
  <a href="https://github.com/shahinst/cdn-ip-scanner/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/shahinst/cdn-ip-scanner/releases"><img src="https://img.shields.io/github/downloads/shahinst/cdn-ip-scanner/total?style=flat-square&color=purple" alt="Downloads"></a>
</p>

<p align="center">
  <a href="#-english">English</a> &bull;
  <a href="#-فارسی">فارسی</a> &bull;
  <a href="#-install--نصب">Install</a> &bull;
  <a href="#-whats-new-in-30--تغییرات-نسخه-۳۰">What's new</a> &bull;
  <a href="#-donate--حمایت-مالی">Donate</a>
</p>

---

<p align="center">
  <img src="image/cdn.png" alt="CDN IP Scanner - light theme" width="100%">
</p>
<p align="center">
  <img src="image/cdn-dark.png" alt="CDN IP Scanner - dark theme" width="100%">
</p>

---

## 🇬🇧 English

### What is CDN IP Scanner?

**CDN IP Scanner** finds the fastest, cleanest edge IPs of **Cloudflare**, **Fastly** and other CDNs for your
network. Paste a range (or let the app fetch the official ones), press *Start*, and watch verified IPs appear
live with their ping, open ports, data center and a 0–100 score. Give it a V2Ray config and it finds the IPs
that really carry traffic for *that* config, then hands you a subscription link, QR codes or a ready Clash /
sing-box file.

Every IP goes through a TCP pre-check and a **5-attempt `/cdn-cgi/trace` verification** (at least 3 genuine
CDN-edge answers are required), so the list only contains IPs that actually respond, not just hosts with an open port.

**Version 3.0 ships three ways to run the same scanner:**

| | How | Best for |
|---|---|---|
| 🟢 **npm app** (new) | `npm install -g cdn-ip-scanner` then `cdn-ip-scanner --port 8080` | Windows, macOS and Linux desktops — one command, no Python, no installer |
| 📱 **Android app** | Install the APK from Releases | Scanning directly on the phone, even on mobile data |
| 🐧 **Linux server** | `sudo bash install.sh` | A shared, always-on panel behind nginx + TLS + login |

All three share the same feature set, the same UI (web/npm/server) and the same scoring, and the web UI
got a complete visual refresh in 3.0 (see [What's new](#-whats-new-in-30--تغییرات-نسخه-۳۰)).

### Key Features

| Feature | Description |
|---------|-------------|
| **Runs with one command** | `npx cdn-ip-scanner` or `npm i -g cdn-ip-scanner` — starts a local web UI on the port you choose (default 8080) |
| **Modern UI** | New dashboard-style theme with light and dark modes, responsive from phones to wide screens, RTL-aware for Persian |
| **Multi-Source Range Fetching** | Fetch CDN IP ranges from the Cloudflare API, ASN databases, GitHub lists and the Fastly verified list, or paste your own |
| **5-Attempt Verification** | Each IP is tested 5 times with connection reuse — minimum 3/5 genuine CDN-edge responses required |
| **Real-Time Results** | Results appear instantly via WebSocket as each IP is found, with live scan-speed and ping charts |
| **Scoring** | 0–100 score from ping, open ports, download speed and the real config test; dead IPs drop to 0 |
| **4 Speed Modes & Profiles** | Hyper / Turbo / Ultra / Deep control CPU and bandwidth; one-click profiles Quick, Balanced, Thorough, Mobile |
| **Fair Sampling** | Round-robin /24 sampling so every range is represented, IPv4 and IPv6 |
| **V2Ray Config Support** | Parse vless://, vmess://, trojan:// configs, test IPs with the config's SNI/Host, rebuild the config for each working IP |
| **Xray Real Test** | Optionally push the best IPs through Xray-core with your own config — only IPs that really carry traffic pass |
| **Download Speed Test** | Optional real download test through the best IPs; speed counts in the score |
| **Subscription, QR, Clash, sing-box** | One-click subscription link for v2rayN / v2rayNG / Hiddify, "copy all configs", a QR code per IP, and ready Clash/Mihomo or sing-box files with automatic fastest-IP selection |
| **Operator Labeling** | Label results with an Iranian (Irancell, MCI, Rightel, Shuttle), Chinese or Russian operator — tests run from the machine's own network |
| **Data Center Names** | Colo codes are shown with their city (FRA → Frankfurt, DE) in the table, the filter and every export |
| **Filter & Sort** | Filter by IP or data center, hide failed real tests, sort by ping, score, speed or real delay |
| **Re-test & Copy Best** | Re-check every IP of a finished scan with one click (dead IPs are marked), copy the 10 best IPs to the clipboard |
| **Favorites & Monitoring** | Save IPs with ☆, re-check them automatically (5 min – 3 h), see 24h uptime, get a Telegram message when one stops working |
| **Scan Summary to Telegram** | Optionally receive the best IPs of every finished scan in Telegram (with proxy support) |
| **Resume Scans** | Stopped a scan or closed the app mid-scan? Continue where it left off with one click |
| **Export** | JSON, Excel (.xlsx), CSV (4-language headers) or plain text (IPs only) |
| **Scan History & Logs** | Every session is kept with its parameters; live log with DEBUG mode for troubleshooting |
| **Diagnostics** | One-click report (version, system, settings without secrets, logs) to attach to bug reports |
| **Multi-Language** | English, فارسی (Persian), 中文 (Chinese), Русский (Russian) |
| **Self-Update** | Check for updates in the app; the npm app updates itself with `npm install -g cdn-ip-scanner@latest` |
| **Stop Anytime** | Responsive stop button that halts scanning within 2 seconds |

### How It Works

```
1. Fetch CDN IP ranges (or paste your own)
2. Select scan method (Cloud / Operator / V2Ray)
3. Pick a profile or set target count, ping range and ports yourself
4. Click "Start Scan" and watch results arrive live
5. Re-test, filter, star the good ones
6. Export, copy the best IPs, or download a Clash / sing-box file
```

### Scan Methods

- **Cloud Scan** — Direct CDN IP scanning with TCP pre-filter + 5-attempt HTTP verification
- **Operator Scan** — Find CDN IPs that work on a given ISP/operator (the scan runs from the machine the app is on, so run it on that operator's network)
- **V2Ray Scan** — Paste a V2Ray config and find working IPs for it automatically; optional Xray real test

### System Requirements

| Platform | Requirement |
|----------|-------------|
| **npm app (Windows / macOS / Linux)** | Node.js 18 or newer — [nodejs.org](https://nodejs.org) |
| **Android** | Android 8.0+ |
| **Linux server (`install.sh`)** | Ubuntu 20/22/24, Debian 10+, CentOS 7+, RHEL, Rocky, Alma, Fedora — Python 3.10+ is installed by the script |

---

## 📥 Install / نصب

### 🟢 npm app — Windows, macOS, Linux

```bash
# install once (needs Node.js 18+)
npm install -g cdn-ip-scanner

# start it — opens http://127.0.0.1:8080
cdn-ip-scanner

# pick your own port / open the browser automatically
cdn-ip-scanner --port 9090 --open
```

No install at all? Run it directly:

```bash
npx cdn-ip-scanner --port 8080
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `8080` (or `$PORT`) | Port the web UI listens on |
| `--host` | `127.0.0.1` | Bind address. Use `0.0.0.0` to reach it from other devices — then also set a login |
| `--username` / `--password` | none | Protect the UI with HTTP basic auth (`APP_USERNAME` / `APP_PASSWORD` env vars work too) |
| `--data-dir` | `~/.cdn-ip-scanner` | Where settings, sessions, results, favorites and the log are stored (`CDN_SCANNER_DATA_DIR`) |
| `--open` | off | Open the browser after start |
| `--version`, `--help` | | |

Update to the newest release with `npm install -g cdn-ip-scanner@latest` (the in-app *Update* button runs the
same command and restarts). Data is plain JSON in the data directory, so it survives updates and is easy to back up.
The npm build has **no native dependencies** and needs no compiler.

> **Why npm instead of the old .exe / .app bundles?** One package works on every OS, updates with one command,
> is 2 MB instead of 60 MB, starts in under a second and never trips SmartScreen / Gatekeeper.
> The old PyInstaller desktop builds are retired in 3.0.

### 📱 Android

Download `CDN-IP-Scanner-<version>-android.apk` from the **[Releases page](https://github.com/shahinst/cdn-ip-scanner/releases)**
and install it (allow "unknown sources"). Scans run on the phone itself, including on mobile data.

### 🐧 Linux server

```bash
git clone https://github.com/shahinst/cdn-ip-scanner.git
cd cdn-ip-scanner
sudo bash install.sh
```

The interactive installer detects the OS (Ubuntu, Debian, CentOS, RHEL, Rocky, Alma, Fedora), asks for a panel
username/password and a domain or IP, installs Python, nginx and the dependencies, sets up TLS (Let's Encrypt for
domains, self-signed for IPs), writes a hardened systemd unit running as the unprivileged `cdnscanner` user, opens
ports 80/443 and prints the access details.

```bash
systemctl status cdn-ip-scanner      # status
journalctl -u cdn-ip-scanner -f      # logs
systemctl restart cdn-ip-scanner     # restart
sudo bash install.sh                 # update (keeps the database)
bash /opt/cdn-ip-scanner/uninstall.sh
```

### Release files

| File | What it is |
|------|------------|
| `CDN-IP-Scanner-<version>-npm.tgz` | The npm package (same as on npmjs.com) — `npm install -g ./CDN-IP-Scanner-<version>-npm.tgz` for offline installs |
| `CDN-IP-Scanner-<version>-android.apk` | Android app |
| `SHA256SUMS.txt` | Checksums of every file above |
| `Source code (zip / tar.gz)` | Full source |

---

## 🛠 For developers

### Run from source

```bash
# npm app (Node.js 18+)
cd node
npm install
npm start -- --port 8080          # or: node bin/cli.js --port 8080
npm test                          # node:test suite (API, scan engine, exports, favorites, resume)

# Python server (the Linux-server edition, same UI)
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py --port 8080
python -m pytest                  # pytest suite
```

The npm app and the Python server share `app/static` and `app/templates`; `npm pack` copies them into the package.

### Environment variables

| Variable | npm app | Python server | Description |
|----------|:---:|:---:|-------------|
| `PORT` / `CDN_SCANNER_PORT` | ✓ | ✓ | Listen port (CLI `--port` wins) |
| `APP_USERNAME` / `APP_PASSWORD` | ✓ | ✓ | HTTP basic auth for the UI and API |
| `CDN_SCANNER_DATA_DIR` | ✓ | ✓ | Data directory (`~/.cdn-ip-scanner` / `./data`) |
| `CORS_ORIGINS` | ✓ | ✓ | Comma-separated extra origins allowed to call the API / WebSocket |
| `ALLOW_WEB_UPDATE` | ✓ | ✓ | `false` disables the in-app *Update* button |
| `SECRET_KEY` | | ✓ | Flask secret key (auto-generated into `data/.secret_key`) |
| `DATABASE_URL` | | ✓ | SQLite by default; e.g. `mysql+pymysql://user:pass@host/db` |
| `ALLOW_INSECURE_FETCH` | | ✓ | Fetch ranges without TLS verification (not recommended) |

> ⚠️ If you bind to `0.0.0.0`, set a username/password or put the app behind an authenticated reverse proxy.

### Android app from source

The Android app lives in [`android/`](android/) (Kotlin, Jetpack Compose / Material 3, min Android 8.0).
It needs JDK 17 and the Android SDK (`ANDROID_HOME`); Android Studio installs both.

```bash
cd android
./gradlew assembleDebug           # -> app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest       # unit tests (IP generation, V2Ray parsing, scoring, colo table)
./gradlew assembleRelease         # signed with your key when ANDROID_KEYSTORE_* env vars are set
```

Release APKs on GitHub are built by `release.yml`; set the repository secrets `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` to sign them with your own key
(otherwise a debug key is used). Set `NPM_TOKEN` to publish the npm package automatically on every tag.

### 📱 Android App Demo

<p align="center">
  <img src="image/android/demo.gif" alt="Android app demo" width="260">
</p>

| Scan | Results | Favorites | Settings |
|:---:|:---:|:---:|:---:|
| ![Scan](image/android/scan.png) | ![Results](image/android/results.png) | ![Favorites](image/android/favorites.png) | ![Settings](image/android/settings.png) |

Same scanner as the web version (TCP pre-check, 5× `/cdn-cgi/trace` verification, scoring), range sources,
V2Ray configs with IP replacement, subscription link, QR codes, Clash / sing-box export, download speed test,
favorites with background monitoring and Telegram alerts, scan history, re-test, TXT/JSON/CSV share, and the four
UI languages. Scans run in a foreground service so they keep going while the screen is off.

---

## 🎬 Video Tutorial

Watch the complete installation and usage tutorial on YouTube:

### **📺 [Watch on YouTube](https://youtu.be/S8H9AMVfz6M)**

---

## 🇮🇷 فارسی

<div dir="rtl">

### CDN IP Scanner چیست؟

**CDN IP Scanner** سریع‌ترین و تمیزترین آی‌پی‌های لبه **Cloudflare**، **Fastly** و سایر CDNها را برای شبکه شما پیدا می‌کند. یک رنج بدهید (یا بگذارید برنامه رنج‌های رسمی را بگیرد)، *شروع* را بزنید و آی‌پی‌های تأییدشده را به‌صورت زنده با پینگ، پورت‌های باز، دیتاسنتر و امتیاز ۰ تا ۱۰۰ ببینید. یک کانفیگ V2Ray بدهید تا آی‌پی‌هایی را پیدا کند که واقعاً برای *همان کانفیگ* ترافیک رد می‌کنند و بعد لینک ساب‌اسکریپشن، QR یا فایل آماده Clash / sing-box تحویل بگیرید.

هر آی‌پی از یک پیش‌چک TCP و **تأیید ۵ مرحله‌ای `/cdn-cgi/trace`** می‌گذرد (حداقل ۳ پاسخ واقعی از لبه CDN لازم است)؛ بنابراین لیست فقط آی‌پی‌هایی را دارد که واقعاً جواب می‌دهند، نه هر میزبانی که یک پورت باز دارد.

**نسخه ۳.۰ به سه شکل اجرا می‌شود:**

| | روش | مناسب برای |
|---|---|---|
| 🟢 **اپ npm** (جدید) | `npm install -g cdn-ip-scanner` و سپس `cdn-ip-scanner --port 8080` | ویندوز، مک و لینوکس — یک دستور، بدون پایتون، بدون نصب‌کننده |
| 📱 **اپ اندروید** | نصب APK از صفحه Releases | اسکن مستقیم روی گوشی، حتی با اینترنت موبایل |
| 🐧 **سرور لینوکس** | `sudo bash install.sh` | پنل همیشه‌روشن و اشتراکی پشت nginx با TLS و رمز ورود |

هر سه نسخه امکانات، رابط کاربری و امتیازدهی یکسانی دارند و رابط وب در ۳.۰ به‌طور کامل بازطراحی شده است.

### ویژگی‌های کلیدی

| ویژگی | توضیحات |
|-------|---------|
| **اجرا با یک دستور** | `npx cdn-ip-scanner` یا `npm i -g cdn-ip-scanner` — رابط وب روی پورت دلخواه (پیش‌فرض ۸۰۸۰) بالا می‌آید |
| **رابط کاربری مدرن** | قالب جدید داشبوردی با حالت روشن و تاریک، واکنش‌گرا از موبایل تا نمایشگر عریض، راست‌چین برای فارسی |
| **دریافت رنج از چندین منبع** | API کلودفلر، ASN، لیست‌های گیت‌هاب، لیست تأییدشده فستلی، یا رنج دستی خودتان |
| **تأیید ۵ مرحله‌ای** | هر آی‌پی ۵ بار با استفاده مجدد از اتصال تست می‌شود — حداقل ۳ پاسخ واقعی لازم است |
| **نتایج لحظه‌ای** | نمایش فوری نتایج از طریق WebSocket همراه با نمودار زنده سرعت اسکن و پینگ |
| **امتیازدهی** | امتیاز ۰ تا ۱۰۰ بر اساس پینگ، پورت‌های باز، سرعت دانلود و تست واقعی کانفیگ؛ آی‌پی‌های مرده صفر می‌شوند |
| **۴ حالت سرعت و پروفایل** | Hyper / Turbo / Ultra / Deep برای کنترل مصرف منابع؛ پروفایل‌های یک‌کلیکی سریع، متعادل، کامل و اینترنت موبایل |
| **نمونه‌برداری منصفانه** | انتخاب چرخشی از بلوک‌های /24 تا همه رنج‌ها دیده شوند؛ IPv4 و IPv6 |
| **پشتیبانی کانفیگ V2Ray** | پارس vless://، vmess://، trojan://؛ تست آی‌پی‌ها با SNI/Host همان کانفیگ و بازسازی کانفیگ برای هر آی‌پی سالم |
| **تست واقعی با Xray** | بهترین آی‌پی‌ها از داخل Xray-core با کانفیگ خودتان تست می‌شوند — فقط آی‌پی‌هایی که واقعاً ترافیک رد می‌کنند قبول می‌شوند |
| **تست سرعت دانلود** | تست دانلود واقعی از طریق بهترین آی‌پی‌ها؛ سرعت در امتیاز لحاظ می‌شود |
| **ساب‌اسکریپشن، QR، Clash و sing-box** | لینک ساب‌اسکریپشن برای v2rayN / v2rayNG / Hiddify، کپی همه کانفیگ‌ها، QR برای هر آی‌پی و فایل آماده Clash/Mihomo یا sing-box با انتخاب خودکار سریع‌ترین آی‌پی |
| **برچسب اپراتور** | برچسب‌گذاری نتایج با اپراتور ایرانی (ایرانسل، همراه اول، رایتل، شاتل)، چینی یا روسی — تست از شبکه همان دستگاه انجام می‌شود |
| **نام دیتاسنترها** | کد colo همراه با نام شهر (FRA ← فرانکفورت، آلمان) در جدول، فیلتر و همه خروجی‌ها |
| **فیلتر و مرتب‌سازی** | فیلتر بر اساس IP یا دیتاسنتر، پنهان کردن تست‌های ناموفق، مرتب‌سازی با پینگ، امتیاز، سرعت یا تأخیر واقعی |
| **تست مجدد و کپی بهترین‌ها** | بررسی دوباره همه آی‌پی‌های یک اسکن با یک کلیک (مرده‌ها علامت می‌خورند) و کپی ۱۰ آی‌پی برتر |
| **علاقه‌مندی‌ها و پایش** | ذخیره آی‌پی با ☆، بررسی خودکار (۵ دقیقه تا ۳ ساعت)، آپ‌تایم ۲۴ ساعته و پیام تلگرام وقتی یکی از کار افتاد |
| **خلاصه اسکن در تلگرام** | دریافت بهترین آی‌پی‌های هر اسکن در تلگرام (با پشتیبانی پروکسی) |
| **ادامه اسکن** | اسکن متوقف‌شده یا نیمه‌کاره را با یک کلیک از همان‌جا ادامه دهید |
| **خروجی** | JSON، اکسل (xlsx.)، CSV با هدر چهارزبانه یا متن ساده (فقط آی‌پی) |
| **تاریخچه و لاگ** | نگهداری همه جلسات با پارامترها؛ لاگ زنده با حالت DEBUG |
| **گزارش عیب‌یابی** | گزارش یک‌کلیکی (نسخه، سیستم، تنظیمات بدون اطلاعات محرمانه، لاگ) برای پیوست به گزارش باگ |
| **چندزبانه** | انگلیسی، فارسی، چینی، روسی |
| **به‌روزرسانی خودکار** | بررسی نسخه جدید داخل برنامه؛ اپ npm با `npm install -g cdn-ip-scanner@latest` خودش را به‌روز می‌کند |
| **توقف در هر لحظه** | دکمه توقف در کمتر از ۲ ثانیه اسکن را متوقف می‌کند |

</div>

### 📥 نصب

<div dir="rtl">

#### 🟢 اپ npm — ویندوز، مک، لینوکس

Node.js نسخه ۱۸ یا بالاتر را از [nodejs.org](https://nodejs.org) نصب کنید، سپس:

</div>

```bash
npm install -g cdn-ip-scanner      # نصب (یک بار)
cdn-ip-scanner                     # اجرا — http://127.0.0.1:8080
cdn-ip-scanner --port 9090 --open  # پورت دلخواه + باز شدن خودکار مرورگر
npx cdn-ip-scanner --port 8080     # اجرا بدون نصب
```

<div dir="rtl">

| گزینه | پیش‌فرض | توضیح |
|------|---------|-------|
| `--port` یا `-p` | `8080` | پورتی که رابط وب روی آن بالا می‌آید |
| `--host` | `127.0.0.1` | آدرس bind؛ برای دسترسی از دستگاه‌های دیگر `0.0.0.0` بگذارید و حتماً رمز هم تعیین کنید |
| `--username` / `--password` | ندارد | محافظت از پنل با Basic Auth (متغیرهای `APP_USERNAME` / `APP_PASSWORD` هم کار می‌کنند) |
| `--data-dir` | `~/.cdn-ip-scanner` | محل ذخیره تنظیمات، جلسات، نتایج، علاقه‌مندی‌ها و لاگ |
| `--open` | خاموش | باز کردن مرورگر بعد از اجرا |

به‌روزرسانی: `npm install -g cdn-ip-scanner@latest` (دکمه *Update* داخل برنامه هم همین کار را می‌کند). داده‌ها فایل JSON ساده هستند و با به‌روزرسانی از بین نمی‌روند.

> **چرا npm به جای exe و پکیج مک؟** یک پکیج برای همه سیستم‌عامل‌ها، به‌روزرسانی با یک دستور، حجم ۲ مگابایت به جای ۶۰ مگابایت، اجرا در کمتر از یک ثانیه و بدون هشدار SmartScreen / Gatekeeper. بیلدهای قدیمی PyInstaller از نسخه ۳.۰ حذف شده‌اند.

#### 📱 اندروید

فایل `CDN-IP-Scanner-<version>-android.apk` را از **[صفحه Releases](https://github.com/shahinst/cdn-ip-scanner/releases)** دانلود و نصب کنید (اجازه «منابع ناشناس»). اسکن مستقیماً روی گوشی و حتی با اینترنت موبایل انجام می‌شود.

| اسکن | نتایج | علاقه‌مندی‌ها |
|:---:|:---:|:---:|
| ![اسکن](image/android/scan_fa.png) | ![نتایج](image/android/results_fa.png) | ![علاقه‌مندی‌ها](image/android/favorites.png) |

#### 🐧 سرور لینوکس

</div>

```bash
git clone https://github.com/shahinst/cdn-ip-scanner.git
cd cdn-ip-scanner
sudo bash install.sh
```

<div dir="rtl">

نصب‌کننده تعاملی سیستم‌عامل را تشخیص می‌دهد (اوبونتو، دبیان، سنت‌اواس، RHEL، راکی، آلما، فدورا)، نام کاربری و رمز پنل و دامنه یا آی‌پی را می‌پرسد، پایتون و nginx و وابستگی‌ها را نصب می‌کند، TLS را راه می‌اندازد (Let's Encrypt برای دامنه، self-signed برای آی‌پی)، سرویس systemd سخت‌شده با کاربر غیرروت `cdnscanner` می‌سازد، پورت‌های ۸۰ و ۴۴۳ را باز می‌کند و اطلاعات دسترسی را نشان می‌دهد.

</div>

```bash
systemctl status cdn-ip-scanner      # وضعیت
journalctl -u cdn-ip-scanner -f      # لاگ
systemctl restart cdn-ip-scanner     # ریستارت
sudo bash install.sh                 # به‌روزرسانی (دیتابیس حفظ می‌شود)
bash /opt/cdn-ip-scanner/uninstall.sh
```

<div dir="rtl">

فایل `SHA256SUMS.txt` در هر نسخه برای بررسی صحت دانلودها قرار دارد.

### 🎬 آموزش تصویری

آموزش کامل نصب و استفاده از برنامه را در یوتیوب ببینید: **📺 [مشاهده در یوتیوب](https://youtu.be/S8H9AMVfz6M)**

</div>

---

## 🆕 What's new in 3.0 / تغییرات نسخه ۳.۰

**English**

- **npm app replaces the desktop bundles.** `npm install -g cdn-ip-scanner` gives you the full scanner on Windows, macOS and Linux, started with `cdn-ip-scanner --port <port>`. It is a complete port of the server to Node.js (Express + Socket.IO), with the identical feature set: all three scan methods, Xray real test, speed test, favorites monitor with Telegram, resume, re-test, exports (JSON / Excel / CSV / TXT), Clash & sing-box, QR, subscription, diagnostics, four languages and self-update. Data is stored as JSON in `~/.cdn-ip-scanner`, no native modules, no compiler.
- **New web UI theme.** Dashboard-style layout, design tokens, refined light and dark palettes, stat tiles, pill buttons, sticky translucent header, better tables and modals, RTL polish. The saved theme is now applied server-side so there is no flash of the wrong theme on load.
- **New Android theme.** Material 3 brand palette (blue / violet / emerald), branded top bar, stat tiles on the scan card, elevated result cards, status badges (UP / DOWN / dead), section headings and a modern progress bar, in light and dark.
- **Release pipeline.** Every tag now publishes the npm tarball, the Android APK and `SHA256SUMS.txt`, and publishes to npmjs.com when `NPM_TOKEN` is set. CI runs the Node suite on Linux, Windows and macOS with Node 18 and 22, the Python suite, and the Android build + unit tests.
- **Fixes.** Fastly data-center codes no longer include cache-node digits (`SOF1510038` → `SOF`); the Android app restores the last scan's results after a restart.
- **Retired.** PyInstaller `.exe` / `.app` / Linux tarballs. Use the npm app instead; the Python server and `install.sh` remain for Linux servers.

<div dir="rtl">

**فارسی**

- **اپ npm جایگزین نسخه‌های دسکتاپ شد.** با `npm install -g cdn-ip-scanner` کل اسکنر روی ویندوز، مک و لینوکس نصب می‌شود و با `cdn-ip-scanner --port <port>` روی پورت دلخواه بالا می‌آید. این یک پورت کامل سرور به Node.js (Express + Socket.IO) است با دقیقاً همان امکانات: هر سه روش اسکن، تست واقعی Xray، تست سرعت، پایش علاقه‌مندی‌ها با تلگرام، ادامه اسکن، تست مجدد، خروجی‌ها (JSON / اکسل / CSV / TXT)، Clash و sing-box، QR، ساب‌اسکریپشن، گزارش عیب‌یابی، چهار زبان و به‌روزرسانی خودکار. داده‌ها به صورت JSON در `~/.cdn-ip-scanner` ذخیره می‌شوند؛ بدون ماژول نیتیو و بدون نیاز به کامپایلر.
- **قالب جدید رابط وب.** چیدمان داشبوردی، پالت‌های بازطراحی‌شده روشن و تاریک، کاشی‌های آمار، دکمه‌های گرد، هدر شفاف چسبان، جدول‌ها و مودال‌های بهتر و اصلاح راست‌چین. تم ذخیره‌شده از سمت سرور اعمال می‌شود تا هنگام باز شدن صفحه تم اشتباه نمایش داده نشود.
- **قالب جدید اندروید.** پالت Material 3 (آبی / بنفش / سبز)، نوار بالای برنددار، کاشی‌های آمار در کارت اسکن، کارت‌های نتیجه برجسته، نشان‌های وضعیت (UP / DOWN / مرده)، عنوان بخش‌ها و نوار پیشرفت مدرن، در حالت روشن و تاریک.
- **خط انتشار.** هر تگ، پکیج npm، فایل APK اندروید و `SHA256SUMS.txt` را منتشر می‌کند و در صورت وجود `NPM_TOKEN` روی npmjs.com هم منتشر می‌شود. CI تست‌های Node را روی لینوکس، ویندوز و مک با Node 18 و 22، تست‌های پایتون و بیلد و تست اندروید را اجرا می‌کند.
- **رفع اشکال.** کد دیتاسنترهای Fastly دیگر شماره نود کش را شامل نمی‌شود (`SOF1510038` ← `SOF`)؛ اپ اندروید بعد از باز شدن دوباره، نتایج آخرین اسکن را بازیابی می‌کند.
- **حذف شده.** بیلدهای PyInstaller برای exe / app / tar لینوکس. به جای آن از اپ npm استفاده کنید؛ سرور پایتون و `install.sh` برای سرورهای لینوکس باقی می‌مانند.

</div>

Full history: [CHANGELOG.md](CHANGELOG.md)

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **npm app** | Node.js 18+, Express, Socket.IO, Nunjucks, JSON file store (no native modules) |
| **Linux server** | Python 3, Flask, Flask-SocketIO, gevent, SQLite / MySQL, nginx |
| **Frontend** | Vanilla JS, CSS custom properties (light/dark design tokens), inline-SVG live charts |
| **Scanning** | TCP pre-filter + 5× `/cdn-cgi/trace` verification, Xray-core real test, TLS speed test |
| **Export** | JSON, Excel (.xlsx), CSV, plain text, Clash / sing-box |
| **Android** | Kotlin, Jetpack Compose (Material 3), Coroutines, WorkManager, ZXing |

---

## 📁 Project Structure

```
cdn-ip-scanner/
├── node/                   # npm app (cdn-ip-scanner): bin/cli.js, src/ (server, routes, scanner, store), test/
├── android/                # Android app (Kotlin / Jetpack Compose, Gradle project)
├── app/                    # Python server (Flask) — also provides static/ and templates/ for the npm app
│   ├── routes/             # api.py (REST + scan logic), favorites.py, diagnostics.py, main.py
│   ├── scanner/            # core.py, v2ray.py, xray.py, speedtest.py, range_fetcher.py, operators.py, colo.py, client_export.py
│   ├── static/             # css/style.css (theme), js/app.js + charts.js, fonts, logo
│   └── templates/          # base.html, index.html, scanner.html (shared with the npm app)
├── tests/                  # pytest suite for the Python server
├── install.sh              # Linux server installer (nginx, TLS, systemd)
├── run.py                  # Python server entry point
├── .github/workflows/      # ci.yml (Python, Node, Android) and release.yml (npm, APK, GitHub Release, npm publish)
├── CHANGELOG.md
└── version                 # Single source of the version number (npm, Android and Python read it)
```

---

## 🤝 Contributing

Contributions are welcome! Read **[CONTRIBUTING.md](CONTRIBUTING.md)** first — it covers the project
layout, how to run and test locally, the rules a PR must follow, and how releases are made.
Found a bug? Attach the report from **⚙️ Settings → Diagnostics → Download report** to your issue.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---
## 💰 Donate / حمایت مالی

<div dir="rtl">

اگر این پروژه برای شما مفید بود، می‌توانید از طریق ارسال USDT از توسعه‌دهنده حمایت کنید.

</div>

If this project is useful to you, you can support the developer by sending USDT:

### USDT (TRC20) — Tron Network
```
TB3aXqkMioddzcgtqPfeBFthYUY9tj9kbs
```

### USDT (ERC20) — Ethereum Network
```
0xd907642587cd654830F9C7bcc8084c8dF5B82713
```

> Thank you for your support! Every donation helps keep this project alive and maintained. 🙏
>
> <div dir="rtl">از حمایت شما سپاسگزاریم! هر کمکی به ادامه حیات و نگهداری این پروژه کمک می‌کند. 🙏</div>

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**shahinst**

- GitHub: [@shahinst](https://github.com/shahinst)
- YouTube: [@shaahinst](https://www.youtube.com/@shaahinst)
- Website: [digicloud.tr](https://digicloud.tr)

---

<p align="center">
  <b>If you find this project useful, please give it a ⭐ on GitHub!</b>
  <br>
  <div align="center" dir="rtl"><b>اگر این پروژه برای شما مفید بود، لطفاً یک ⭐ در گیت‌هاب بدهید!</b></div>
</p>
