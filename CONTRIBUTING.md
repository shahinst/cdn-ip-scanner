# Contributing to CDN IP Scanner

Thanks for helping! This guide explains how the project is organized, how to run
it locally, and what a pull request needs before it can be merged.

> **فارسی:** راهنمای فارسی در انتهای همین فایل آمده است.

## Quick start

```bash
git clone https://github.com/shahinst/cdn-ip-scanner.git
cd cdn-ip-scanner
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt pytest

python run.py --port 8080        # web UI at http://127.0.0.1:8080
python -m pytest                 # run the tests

cd node && npm install && npm test    # npm app (Node 18+): node bin/cli.js --port 8080
```

Optional: install Xray-core for the real-test integration tests
(`python -c "from app.scanner.xray import install_xray; print(install_xray('ci-bin'))"`,
then set `XRAY_PATH` to the printed path). Without it those tests are skipped.

## Project layout

| Path | What lives there |
|------|------------------|
| `run.py` | Web server entry point. Applies gevent monkey-patching **first** — keep it that way. |
| `app/__init__.py` | Flask app factory, same-origin (CSRF) check, optional basic auth, DB setup. |
| `app/config.py` | Configuration; version comes from the `version` file. |
| `app/models.py` | SQLAlchemy models + `migrate_schema()` for columns added after a release. |
| `app/routes/api.py` | Scan API and the background scan loop. |
| `app/routes/favorites.py`, `app/monitor.py` | Favorite IPs, periodic re-checks, Telegram alerts. |
| `app/scanner/core.py` | IP generation (IPv4 /24 and IPv6 /120 blocks) and CDN-edge verification. |
| `app/scanner/v2ray.py` | Parsing / rebuilding vless, vmess and trojan links. |
| `app/scanner/xray.py` | Xray-core lookup/installer and the real-delay test. |
| `app/scanner/speedtest.py` | Download speed test through a given IP. |
| `app/scanner/client_export.py` | Clash/Mihomo and sing-box export. |
| `app/static/js/app.js`, `app/templates/` | Frontend (vanilla JS, no build step). |
| `node/` | npm app `cdn-ip-scanner`: Node.js port of the server (`bin/cli.js`, `src/server.js`, `src/routes/`, `src/scanner/`, `src/store.js`) reusing `app/static` and `app/templates`. Tests: `npm test` (node:test). |
| `install.sh` | Linux server installer (nginx, TLS, systemd as an unprivileged user). |
| `tests/` | pytest suite. `conftest.py` has local fake-CDN HTTP servers. |
| `android/` | Android app (Kotlin / Jetpack Compose). `cd android && ./gradlew assembleDebug testDebugUnitTest` needs JDK 17 and the Android SDK. |

## Rules of thumb

- **Tests come with the change.** New behaviour needs a test; bug fixes need a
  test that fails without the fix. Use the local fake servers in `tests/conftest.py`
  — tests must never depend on the internet.
- **Database changes:** add the column to the model *and* to `_ADDED_COLUMNS` in
  `app/models.py`, so existing users' databases are upgraded on start.
- **Settings:** a new setting must be added to `SETTINGS_DEFAULTS` in
  `app/routes/api.py`, otherwise it is silently ignored when saved.
- **Translations:** every UI string goes through `T` in `app.js` with at least
  `en` and `fa` (other languages fall back to English). Persian text must render
  correctly right-to-left.
- **Security:**
  - escape anything that came from a user, a config link or the network before
    putting it in `innerHTML` (`escapeHtml`);
  - never disable TLS verification without an explicit opt-in;
  - never log or return secrets (e.g. the Telegram bot token).
- **Cross-platform:** code must work on Windows, macOS and Linux. Use
  `socket.create_connection` (IPv4 + IPv6), `os.path`, and avoid shell-only tricks.
- **Keep it small.** One topic per pull request; it makes review and reverting easy.

## Pull request checklist

- [ ] `python -m pytest` passes locally (and `npm test` in `node/` if you touched the server or the frontend)
- [ ] `node --check app/static/js/app.js` and `bash -n install.sh` pass
- [ ] New strings translated (`en` + `fa`)
- [ ] README updated if the feature is user-visible
- [ ] No secrets, personal data or large binaries committed

CI runs the Python tests on Linux, Windows and macOS (Python 3.10 and 3.13), the Node
suite on the same three systems (Node 18 and 22), and builds + unit-tests the Android app.
A PR is merged only when all checks are green.

## Releases

1. Bump the `version` file (e.g. `3.0`) in the PR that finishes the release (npm, Android and Python read it).
2. After it is merged, tag **that merge commit on `main`**:
   `git fetch origin && git tag v3.0 origin/main && git push origin v3.0`
3. The *Build & Release* workflow packs the npm app, builds the Android APK and publishes both
   with `SHA256SUMS.txt`; with the `NPM_TOKEN` secret it also runs `npm publish`. It fails on
   purpose if the tag and the `version` file differ.

## Reporting bugs

Use **⚙️ Settings → Diagnostics → Download report** in the app and attach the file
to your GitHub issue. It contains the version, OS, settings (secrets removed) and
the recent log — please check it before posting.

---

## راهنمای فارسی

**شروع سریع:** مخزن را clone کنید، یک محیط مجازی پایتون بسازید، `pip install -r requirements.txt pytest`
را اجرا کنید و با `python run.py` برنامه را بالا بیاورید. تست‌ها با `python -m pytest` اجرا می‌شوند.

**قوانین اصلی:**
- هر تغییر باید تست داشته باشد و تست‌ها نباید به اینترنت وابسته باشند.
- ستون جدید دیتابیس را هم در مدل و هم در `_ADDED_COLUMNS` اضافه کنید.
- تنظیم جدید را به `SETTINGS_DEFAULTS` اضافه کنید.
- همه متن‌های رابط کاربری باید ترجمه انگلیسی و فارسی داشته باشند.
- هر داده‌ای از کاربر یا شبکه را قبل از `innerHTML` با `escapeHtml` امن کنید.
- کد باید روی ویندوز، مک و لینوکس کار کند.
- هر PR فقط یک موضوع داشته باشد.

**انتشار نسخه:** فایل `version` را در PR آخر بالا ببرید، بعد از merge، تگ را روی همان کامیت `main` بسازید.

**گزارش باگ:** از «تنظیمات ← عیب‌یابی ← دانلود گزارش» در برنامه استفاده کنید و فایل را به issue پیوست کنید.
