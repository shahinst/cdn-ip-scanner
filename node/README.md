# cdn-ip-scanner

Find the fastest, cleanest **Cloudflare / Fastly** edge IPs for your network, test them against your
**V2Ray** config, and get subscription links, QR codes or ready **Clash / sing-box** files — from a local web UI.

```bash
npm install -g cdn-ip-scanner
cdn-ip-scanner --port 8080        # open http://127.0.0.1:8080
```

Or without installing: `npx cdn-ip-scanner`.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `8080` (or `$PORT`) | Port of the web UI |
| `--host` | `127.0.0.1` | Bind address (`0.0.0.0` to reach it from other devices — set a login too) |
| `--username` / `--password` | none | HTTP basic auth (`APP_USERNAME` / `APP_PASSWORD` also work) |
| `--data-dir` | `~/.cdn-ip-scanner` | Settings, sessions, results, favorites, log (`CDN_SCANNER_DATA_DIR`) |
| `--open` | off | Open the browser after start |

## Features

Cloud / operator / V2Ray scans with 5-attempt `/cdn-cgi/trace` verification, Xray real test, download speed
test, 0–100 scoring, data-center names, live charts, filter & sort, re-test, copy best IPs, favorites with
background monitoring and Telegram alerts, scan summary to Telegram, resume, history, JSON / Excel / CSV / TXT
export, Clash & sing-box export, QR codes, subscription links, diagnostics report, English / Persian / Chinese /
Russian UI, self-update.

Requires Node.js 18+. No native modules. MIT license.
Source, Android app and Linux-server installer: https://github.com/shahinst/cdn-ip-scanner
