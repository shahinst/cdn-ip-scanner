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
  🌐 <b>Language:</b> <b>English</b> &nbsp;|&nbsp; <a href="README.fa.md">فارسی</a>
</p>

<p align="center">
  <a href="#-installation">Install</a> &bull;
  <a href="#-features">Features</a> &bull;
  <a href="#-usage">Usage</a> &bull;
  <a href="#-whats-new-in-30">What's new</a> &bull;
  <a href="#-for-developers">Developers</a> &bull;
  <a href="#-donate">Donate</a>
</p>

---

<p align="center">
  <img src="image/cdn.png" alt="CDN IP Scanner - light theme" width="100%">
</p>
<p align="center">
  <img src="image/cdn-dark.png" alt="CDN IP Scanner - dark theme" width="100%">
</p>

---

## 📚 Table of Contents

1. [Overview](#-overview)
2. [Features](#-features)
3. [Installation](#-installation)
   - [npm app (Windows / macOS / Linux) — step by step](#-npm-app-windows--macos--linux)
   - [Android app](#-android-app)
   - [Linux server](#-linux-server)
   - [Release files & requirements](#-release-files--requirements)
4. [Usage](#-usage)
5. [Android app demo](#-android-app-demo)
6. [For developers](#-for-developers)
7. [What's new in 3.0](#-whats-new-in-30)
8. [Video tutorial](#-video-tutorial)
9. [Contributing](#-contributing)
10. [Donate](#-donate) · [License](#-license) · [Author](#-author)

---

## 🔎 Overview

**CDN IP Scanner** finds the fastest, cleanest edge IPs of **Cloudflare**, **Fastly** and other CDNs for your
network. Paste a range (or let the app fetch the official ones), press *Start*, and watch verified IPs appear
live with their ping, open ports, data center and a 0–100 score. Give it a V2Ray config and it finds the IPs
that really carry traffic for *that* config, then hands you a subscription link, QR codes or a ready Clash /
sing-box file.

Every IP goes through a TCP pre-check and a **5-attempt `/cdn-cgi/trace` verification** (at least 3 genuine
CDN-edge answers are required), so the list only contains IPs that actually respond, not just hosts with an open port.

### Three ways to run it

| | How | Best for |
|---|---|---|
| 🟢 **npm app** (new in 3.0) | `npm install -g cdn-ip-scanner` then `cdn-ip-scanner --port 8080` | Windows, macOS and Linux desktops — one command, no Python, no installer |
| 📱 **Android app** | Install the APK from Releases | Scanning directly on the phone, even on mobile data |
| 🐧 **Linux server** | `sudo bash install.sh` | A shared, always-on panel behind nginx + TLS + login |

All three share the same feature set, the same UI (npm / server) and the same scoring.

### How it works

```
1. Fetch CDN IP ranges (or paste your own)
2. Select scan method (Cloud / Operator / V2Ray)
3. Pick a profile or set target count, ping range and ports yourself
4. Click "Start Scan" and watch results arrive live
5. Re-test, filter, star the good ones
6. Export, copy the best IPs, or download a Clash / sing-box file
```

### Scan methods

- **Cloud Scan** — Direct CDN IP scanning with TCP pre-filter + 5-attempt HTTP verification
- **Operator Scan** — Find CDN IPs that work on a given ISP/operator (the scan runs from the machine the app is on, so run it on that operator's network)
- **V2Ray Scan** — Paste a V2Ray config and find working IPs for it automatically; optional Xray real test

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Runs with one command** | `npx cdn-ip-scanner` or `npm i -g cdn-ip-scanner` — the web UI comes up on the port you choose (default 8080) |
| **Modern UI** | Dashboard-style theme with light and dark mode, responsive from phones to wide screens, RTL for Persian |
| **Multi-source range fetching** | Cloudflare API, ASN, GitHub lists, Fastly's verified list, or your own ranges |
| **5-attempt verification** | Every IP is tested 5 times with connection reuse — at least 3 real CDN-edge answers are required |
| **Real-time results** | WebSocket streaming with live charts of scan speed and found-IP ping |
| **Scoring** | 0–100 score from ping, open ports, download speed and the real config test; dead IPs drop to 0 |
| **4 speed modes + profiles** | Hyper / Turbo / Ultra / Deep control the resource use; one-click Quick / Balanced / Thorough / Mobile-data profiles |
| **Fair sampling** | Round-robin picking from /24 blocks so every range gets covered; IPv4 and IPv6 |
| **V2Ray config support** | Parse vless://, vmess://, trojan://; test IPs with the config's own SNI/Host and rebuild the config for every working IP |
| **Xray real test** | The best IPs are tested from inside Xray-core with your config — only IPs that really carry traffic pass |
| **Download speed test** | Real download through the best IPs; the speed feeds the score |
| **Subscription, QR, Clash & sing-box** | Subscription link for v2rayN / v2rayNG / Hiddify, copy-all configs, a QR per IP, and ready Clash/Mihomo or sing-box files with auto-select of the fastest IP |
| **Operator tagging** | Tag results with Iranian (Irancell, MCI, Rightel, Shatel), Chinese or Russian operators — the test runs from the device's own network |
| **Data-center names** | Colo code plus city (FRA → Frankfurt, DE) in the table, filter and every export |
| **Filter & sort** | Filter by IP or data center, hide failed tests, sort by ping, score, speed or real delay |
| **Re-test & copy best** | Re-check every IP of a scan with one click (dead ones get marked) and copy the top 10 |
| **Favorites & monitoring** | Star IPs, re-check them automatically (5 min – 3 h), 24-hour uptime, Telegram alert when one goes down |
| **Scan summary to Telegram** | Receive the best IPs of every scan in Telegram (proxy supported) |
| **Resume scans** | Continue a stopped or interrupted scan from where it left off |
| **Export** | JSON, Excel (.xlsx), CSV with headers in four languages, or plain text (IPs only) |
| **History & logs** | Every session is kept with its parameters; live log with a DEBUG mode |
| **Diagnostics report** | One-click report (version, system, redacted settings, log) to attach to bug reports |
| **Multi-language** | English, Persian, Chinese, Russian |
| **Self-update** | In-app update check; the npm app updates itself with `npm install -g cdn-ip-scanner@latest` |
| **Stop any time** | The Stop button halts a scan in under 2 seconds |

---

## 📥 Installation

### 🟢 npm app (Windows / macOS / Linux)

This is the recommended way on a desktop or laptop. It takes about two minutes.

#### Step 1 — Install Node.js (once)

Download the **LTS** version from **[nodejs.org/en/download](https://nodejs.org/en/download)** and run the installer
(on Linux you can also use your package manager or `nvm`). Node.js 18 or newer is required; npm is included.

<p align="center"><img src="image/npm/1-nodejs.png" alt="Node.js download page" width="90%"></p>

Open a terminal (Windows: *Terminal* / *PowerShell* / *CMD*; macOS: *Terminal*; Linux: any shell) and confirm:

```bash
node --version      # v18 or newer
```

#### Step 2 — Install CDN IP Scanner

```bash
npm install -g cdn-ip-scanner
```

<p align="center"><img src="image/npm/2-install.png" alt="npm install -g cdn-ip-scanner" width="90%"></p>

> On Linux/macOS, if `npm install -g` complains about permissions, either use `nvm`, or run
> `sudo npm install -g cdn-ip-scanner`.
> Offline? Download `CDN-IP-Scanner-<version>-npm.tgz` from Releases and run `npm install -g ./CDN-IP-Scanner-<version>-npm.tgz`.

#### Step 3 — Start it on a port

```bash
cdn-ip-scanner --port 8080 --open
```

<p align="center"><img src="image/npm/3-run.png" alt="cdn-ip-scanner running" width="90%"></p>

The server prints the URL and the data folder. `--open` launches your browser automatically; otherwise open
**http://127.0.0.1:8080** yourself. Keep the terminal window open while you use the app and press `Ctrl+C` to stop it.

<p align="center"><img src="image/npm/4-browser.png" alt="CDN IP Scanner in the browser" width="90%"></p>

#### Step 4 — Options, updating and uninstalling

```bash
cdn-ip-scanner --port 9090                       # any free port
cdn-ip-scanner --host 0.0.0.0 --username me --password secret   # reachable from other devices, with login
cdn-ip-scanner --data-dir D:\scanner-data         # keep the data somewhere else
npx cdn-ip-scanner --port 8080                   # run without installing
npm install -g cdn-ip-scanner@latest             # update (the in-app Update button does the same)
npm uninstall -g cdn-ip-scanner                  # remove
```

<p align="center"><img src="image/npm/5-update.png" alt="update and --help" width="90%"></p>

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `8080` (or `$PORT`) | Port the web UI listens on |
| `--host` | `127.0.0.1` | Bind address. Use `0.0.0.0` to reach it from other devices — then also set a login |
| `--username` / `--password` | none | Protect the UI with HTTP basic auth (`APP_USERNAME` / `APP_PASSWORD` env vars work too) |
| `--data-dir` | `~/.cdn-ip-scanner` | Where settings, sessions, results, favorites and the log are stored (`CDN_SCANNER_DATA_DIR`) |
| `--open` | off | Open the browser after start |
| `--version`, `--help` | | |

Data is plain JSON in the data directory, so it survives updates and is easy to back up. The npm build has
**no native dependencies** and needs no compiler.

> **Why npm instead of the old .exe / .app bundles?** One package works on every OS, updates with one command,
> is 2 MB instead of 60 MB, starts in under a second and never trips SmartScreen / Gatekeeper.
> The PyInstaller desktop builds were retired in 3.0.

### 📱 Android app

Download `CDN-IP-Scanner-<version>-android.apk` from the **[Releases page](https://github.com/shahinst/cdn-ip-scanner/releases)**
and install it (allow "unknown sources"). Scans run on the phone itself, including on mobile data. Android 8.0 or newer.

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

### 📦 Release files & requirements

| File | What it is |
|------|------------|
| `CDN-IP-Scanner-<version>-npm.tgz` | The npm package (same as on npmjs.com) — for offline installs |
| `CDN-IP-Scanner-<version>-android.apk` | Android app |
| `SHA256SUMS.txt` | Checksums of every file above |
| `Source code (zip / tar.gz)` | Full source |

| Platform | Requirement |
|----------|-------------|
| **npm app (Windows / macOS / Linux)** | Node.js 18 or newer |
| **Android** | Android 8.0+ |
| **Linux server (`install.sh`)** | Ubuntu 20/22/24, Debian 10+, CentOS 7+, RHEL, Rocky, Alma, Fedora — Python 3.10+ is installed by the script |

---

## 🚀 Usage

1. **First scan.** Open the app, keep *Cloud* as the method, leave the ranges empty (the built-in Cloudflare + Fastly
   ranges are used) or click *Fetch ranges*, pick a profile (*Quick* for a first try) and press **Start**. Verified IPs
   appear live with ping, ports, data center and score.
2. **Scan for your V2Ray config.** Switch the method to *V2Ray*, paste a `vless://`, `vmess://` or `trojan://` link
   and start. Every working IP gets its own rebuilt config; use **Subscription** (one link for v2rayN / v2rayNG /
   Hiddify), **Copy all**, the **QR** on each row, or download a **Clash** / **sing-box** file. Enable the *Xray real
   test* in Settings to keep only IPs that really carry traffic.
3. **Pick the best.** Sort by score or ping, hide failed rows, press **Re-test** to re-check everything, then
   **Copy best IPs** or **Export** (JSON / Excel / CSV / TXT).
4. **Keep an eye on them.** Star an IP to add it to *Favorites*; the monitor re-checks favorites on a schedule, shows
   24-hour uptime and can message you in Telegram. Turn on *Scan summary to Telegram* to get the best IPs of every scan.
5. **Resume.** If a scan is stopped or interrupted, a banner offers to continue it from where it left off.

---

## 📱 Android app demo

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

### Tech stack

| Component | Technology |
|-----------|-----------|
| **npm app** | Node.js 18+, Express, Socket.IO, Nunjucks, JSON file store (no native modules) |
| **Linux server** | Python 3, Flask, Flask-SocketIO, gevent, SQLite / MySQL, nginx |
| **Frontend** | Vanilla JS, CSS custom properties (light/dark design tokens), inline-SVG live charts |
| **Scanning** | TCP pre-filter + 5× `/cdn-cgi/trace` verification, Xray-core real test, TLS speed test |
| **Export** | JSON, Excel (.xlsx), CSV, plain text, Clash / sing-box |
| **Android** | Kotlin, Jetpack Compose (Material 3), Coroutines, WorkManager, ZXing |

### Project structure

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
├── README.md / README.fa.md / CHANGELOG.md
└── version                 # Single source of the version number (npm, Android and Python read it)
```

---

## 🆕 What's new in 3.0

- **npm app replaces the desktop bundles.** `npm install -g cdn-ip-scanner` gives you the full scanner on Windows, macOS and Linux, started with `cdn-ip-scanner --port <port>`. It is a complete port of the server to Node.js (Express + Socket.IO) with the identical feature set: all three scan methods, Xray real test, speed test, favorites monitor with Telegram, resume, re-test, exports (JSON / Excel / CSV / TXT), Clash & sing-box, QR, subscription, diagnostics, four languages and self-update. Data is stored as JSON in `~/.cdn-ip-scanner`; no native modules, no compiler.
- **New web UI theme.** Dashboard-style layout, design tokens, refined light and dark palettes, stat tiles, pill buttons, sticky translucent header, better tables and modals, RTL polish. The saved theme is applied server-side so there is no flash of the wrong theme on load.
- **New Android theme.** Material 3 brand palette (blue / violet / emerald), branded top bar, stat tiles on the scan card, elevated result cards, status badges (UP / DOWN / dead), section headings and a modern progress bar, in light and dark.
- **Release pipeline.** Every tag publishes the npm tarball, the Android APK and `SHA256SUMS.txt`, and publishes to npmjs.com when `NPM_TOKEN` is set. CI runs the Node suite on Linux, Windows and macOS with Node 18 and 22, the Python suite, and the Android build + unit tests.
- **Fixes.** Fastly data-center codes no longer include cache-node digits (`SOF1510038` → `SOF`); the Android app restores the last scan's results after a restart.
- **Retired.** PyInstaller `.exe` / `.app` / Linux tarballs. Use the npm app instead; the Python server and `install.sh` remain for Linux servers.

Full history: [CHANGELOG.md](CHANGELOG.md)

---

## 🎬 Video tutorial

Watch the complete installation and usage tutorial on YouTube:

### **📺 [Watch on YouTube](https://youtu.be/S8H9AMVfz6M)**

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

## 💰 Donate

If this project is useful to you, you can support the developer by sending USDT:

**USDT (TRC20) — Tron Network**
```
TB3aXqkMioddzcgtqPfeBFthYUY9tj9kbs
```

**USDT (ERC20) — Ethereum Network**
```
0xd907642587cd654830F9C7bcc8084c8dF5B82713
```

> Thank you for your support! Every donation helps keep this project alive and maintained. 🙏

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
</p>
