# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this project is

**CDN IP Scanner V2.0** is a Flask web application that finds low-latency, reachable
Cloudflare/Fastly CDN edge IPs. It scans large IP ranges, verifies each candidate with
repeated `/cdn-cgi/trace` HTTP checks, scores the results by ping and open ports, and
streams progress to a browser UI over WebSockets in real time. It is primarily used to
discover "clean" CDN IPs that work well for V2Ray/Xray proxy configs on specific mobile
operators (Iran, China, Russia).

- Author/owner: `shahinst` (GitHub: `github.com/shahinst/cdn-ip-scanner`)
- Version lives in the `version` file (currently `2.0`) and in `app/config.py` (`Config.VERSION`).
- Linux-first: designed to run behind Nginx + systemd on a VPS. `install.sh` is a full
  interactive installer (Nginx reverse proxy, Basic Auth, SSL, firewall, systemd service).

## Tech stack

- **Backend:** Python 3, Flask, Flask-SQLAlchemy, Flask-SocketIO (async mode `gevent`).
- **Realtime:** Socket.IO over gevent + gevent-websocket.
- **Database:** SQLite by default (`data/scanner.db`, auto-created). MySQL/MariaDB optional
  via `DATABASE_URL` env var (PyMySQL driver).
- **Scanning:** `requests` + `ThreadPoolExecutor` (hundreds of worker threads), raw
  `socket` for TCP port checks, `ipaddress` for CIDR math.
- **Frontend:** server-rendered Jinja2 templates + vanilla JS (no build step, no framework).
  Socket.IO client and styling are loaded from `app/static/`.
- **Export:** `openpyxl` for Excel export.

There is **no build system, no test suite, and no linter config** in this repo. Changes are
validated by running the app and exercising the UI/API manually.

## Repository layout

```
run.py                     # Entry point: parses args, creates app, runs socketio server
version                    # Single source of truth for the version string ("2.0")
requirements.txt           # Python dependencies (Linux)
install.sh                 # Interactive Linux installer (Nginx/SSL/systemd/firewall)
README.md                  # User-facing install & usage docs (English + Persian)

app/
  __init__.py              # create_app() factory; initializes db + socketio, registers blueprints
  config.py                # Config class; DB URI selection (SQLite vs DATABASE_URL)
  models.py                # SQLAlchemy models (see "Data model" below)
  routes/
    main.py                # Page routes: /  and  /scanner[/<lang>]
    api.py                 # All /api/* endpoints + the background scan thread
  scanner/
    core.py                # SHScanner + SHNetUtils: the core scan engine and IP generation
    range_fetcher.py       # RangeFetcher + BuiltinCDNRanges: CDN CIDR sources
    operators.py           # Operator (ASN) definitions + RIPE/BGPView prefix fetching
    v2ray.py               # V2RayConfigParser + V2RayScanner: parse vless/vmess/trojan, test IPs
    ai_optimizer.py        # AIOptimizer: heuristic range scoring/sampling (lightweight)
  templates/
    base.html              # Shared HTML shell
    index.html             # Landing page (language chooser)
    scanner.html           # Main scanner UI
  static/
    js/app.js              # All frontend logic: settings, socket handlers, table, export
    css/style.css          # Styles (light/dark theme, RTL support)
    font/, img/            # Vazirmatn font, FontAwesome, logo
```

## How it runs

Entry point is `run.py`:

```bash
python run.py --host 127.0.0.1 --port 8080        # dev/prod default
python run.py --host 0.0.0.0 --port 8080 --debug  # expose + debug
```

- `run.py` loads `.env` (from repo root) via python-dotenv if present, installs a SIGTERM
  handler for clean systemd shutdown, then calls `socketio.run(app, ...)` with gevent.
- Default host is `127.0.0.1` (assumes a reverse proxy in front). Port defaults to
  `PORT` env var or `8080`.
- `create_app()` in `app/__init__.py` calls `db.create_all()` at startup — schema is created
  automatically, there are **no migrations**. Adding/altering a model column requires either a
  fresh DB or a manual migration.

In production (`install.sh`): the app is installed to `/opt/cdn-ip-scanner`, runs in a venv,
managed by a systemd service named `cdn-ip-scanner`, behind Nginx (Basic Auth + SSL).

```bash
sudo systemctl {status,restart,stop} cdn-ip-scanner
sudo journalctl -u cdn-ip-scanner -f            # live logs
# ExecStart: /opt/cdn-ip-scanner/venv/bin/python run.py --host 127.0.0.1 --port <PORT> --no-browser
```

## Request/scan lifecycle (the important part)

1. Browser loads `/scanner/<lang>` (`main.py`), which renders `scanner.html`.
2. `app.js` opens a Socket.IO connection and POSTs scan parameters to `POST /api/scan/start`
   (`api.py`).
3. `start_scan()` creates a `ScanSession` row, then spawns a **daemon `threading.Thread`**
   running `run_scan()`. It captures the real app object via
   `current_app._get_current_object()` and re-enters it with `app.app_context()` inside the
   thread — **do not call `create_app()` inside the thread.**
4. `run_scan()` loops in batches: `SHNetUtils.generate_scan_ips()` produces a fair,
   round-robin sample of IPs across all ranges; `SHScanner.batch_scan()` (or
   `V2RayScanner.scan_ips()` for the v2ray method) checks them in a thread pool.
5. Each verified IP triggers `on_result()`, which writes a `ScanResult` row and emits a
   `scan_result` Socket.IO event; progress emits `scan_progress`. The frontend appends rows
   live. The loop stops when the target count is reached, a user stop is requested, or the
   safety cap (`max_total_scanned = 500000`) is hit.
6. Completion emits `scan_complete`; errors emit `scan_error`.

**Concurrency model & shared state:** `api.py` keeps module-level singletons `_scanner`,
`_v2ray_scanner`, and globals `_active_session_id`, `_user_stop_requested`, `_log_enabled`,
`_debug_enabled`. This means **only one scan is intended to run at a time.** `stop_scan()`
sets `_user_stop_requested = True` and calls `_scanner.stop()`. Keep this single-scan
assumption in mind before adding concurrent-scan features.

**Socket.IO events** (server → client, all on namespace `/`): `scan_progress`,
`scan_result`, `scan_complete`, `scan_error`, `scan_log`, `scan_status`. Their payload
shapes are defined where they're `socketio.emit(...)`ed in `api.py` and consumed in
`app.js` (`socket.on(...)`). If you change a payload, update both sides.

## The scan engine (`app/scanner/core.py`)

- **`SHNetUtils.generate_scan_ips(cidr_list, per_block, max_total, shuffle)`** — splits every
  CIDR into `/24` blocks and picks IPs **round-robin across ranges** so even tiny ranges are
  represented alongside huge ones. Random IPs are `.1`–`.254` within a block.
- **`SHScanner.check(ip, ports)`** — the per-IP verification:
  1. Fast TCP pre-filter connect to the primary port (rejects dead IPs quickly).
  2. `_sequential_trace_check()`: up to 5 sequential `GET /cdn-cgi/trace` requests over one
     reused `requests.Session` (with `Host: www.cloudflare.com`). Valid if **≥3 of 5**
     succeed and average latency ≤ `max_latency_ms`.
  3. Quick TCP connects on the remaining ports to record which are open.
- **`SHScanner.batch_scan(...)`** — runs `check` across a `ThreadPoolExecutor`, invoking
  `result_callback` immediately per hit and polling `_stop_flag` every ~2s so stop is responsive.
- **`SPEED_MODES`** (`hyper`/`turbo`/`ultra`/`deep`) map to a resource percentage and
  `ips_per_24` density; `set_mode()` scales `max_workers` from CPU count × the percentage.
- **`calc_score(result)`** — 0–100 score from ping buckets + open-port bonuses (443/80 weighted).

**HTTPS vs HTTP ports:** ports in `HTTPS_PORTS` ({443, 8443, 2053, 2083, 2087, 2096}) use
`https://`, everything else `http://`. TLS verification is disabled (`session.verify = False`)
because we connect by raw IP with a spoofed Host header — this is intentional for this tool.

## Range & operator data

- **`range_fetcher.py`** — `RangeFetcher.fetch_by_source(source)` is the single entry point.
  Sources: `sh_api`/`sh_asn`/`sh_github` (Cloudflare), `fastly_api`/`fastly_asn`, `builtin`
  (offline `BuiltinCDNRanges` — hundreds of hardcoded Cloudflare `/24`s), and `all` (online +
  builtin, deduped). All HTTP uses `_robust_get()` with retries + SSL fallback.
- **`operators.py`** — `OPERATORS_BY_COUNTRY` defines mobile operators per country (`ir`, `cn`,
  `ru`) with their ASN(s). `fetch_all_operator_prefixes(operator_key, country)` pulls announced
  prefixes from RIPEstat with a BGPView fallback (`fetch_operator_prefixes_smart`). Results are
  stored in the `operator_ranges` table.

## V2Ray support (`app/scanner/v2ray.py`)

- `V2RayConfigParser.parse()` handles `vless://`, `vmess://` (base64 JSON), and `trojan://`.
- `rebuild_config(parsed, new_ip)` swaps the IP back into the config string for download.
- `V2RayScanner.scan_ips()` tests each candidate IP by doing a real TLS/TCP connect using the
  config's port and SNI, measuring latency. Used when `scan_method == 'v2ray'`.

## Data model (`app/models.py`)

| Model | Table | Purpose |
|-------|-------|---------|
| `ScanResult` | `scan_results` | One found IP (ping, open_ports JSON, score, operator, session FK) |
| `ScanSession` | `scan_sessions` | One scan run (mode, method, totals, status, timings) |
| `ClosedIP` | `closed_ips` | Known-bad IPs to skip |
| `OperatorRange` | `operator_ranges` | Fetched ASN prefixes per operator |
| `OperatorMatrix` | `operator_matrix` | Per-IP × operator activity matrix |
| `AppSetting` | `app_settings` | Key/value settings store (`.get`/`.set` helpers) |
| `ScanLog` | `scan_logs` | Persisted scan logs (only when logging enabled) |

`open_ports` and `ports` columns store **JSON-encoded lists as text** — encode/decode with
`json.dumps`/`json.loads`, not raw assignment.

## API surface (`app/routes/api.py`, prefix `/api`)

- `GET/POST /settings` — read/write `AppSetting` key/values (theme, mode, ports, language, …).
- `POST /ranges/fetch` — fetch CDN ranges by source.
- `GET /ranges/operators`, `POST /ranges/operators/fetch`, `POST /ranges/operators/fetch-all`.
- `POST /v2ray/parse`, `POST /v2ray/build-config`.
- `POST /scan/start`, `POST /scan/stop`.
- `GET /scan/results`, `GET /scan/sessions`, `GET /scan/logs`.
- `GET /export/<fmt>` — `json` | `txt` (IPs only) | `excel`. Header language via `?lang=en|fa`.
- `POST /reset` — wipe results/sessions/closed/logs.
- `GET /info` — version, author, speed modes.
- `POST /check-update`, `POST /do-update` — compare against the `version` file on GitHub
  `main`, then `git pull` + `pip install -r requirements.txt` and re-exec the process.

## Conventions & house style

- **Language:** UI and docs are bilingual (English + Persian/Farsi). Comments and log
  messages in the code are sometimes in Persian — that's normal here; keep new user-facing
  strings translatable and don't strip existing Persian comments.
- **Naming:** legacy `SH`/`sh_` prefixes (from "SH IP Scanner") persist in class and source
  names (`SHScanner`, `SHNetUtils`, `sh_api`). Keep them for consistency rather than renaming.
- **Error handling:** network code is defensively wrapped and returns empty/`error` payloads
  (often with HTTP 200) instead of throwing, so the UI can show a friendly message. Follow
  that pattern for new fetch endpoints. DB writes in the scan loop use try/`db.session.rollback()`.
- **Threading:** the scan runs off-request in a background thread that re-uses the captured
  app object. Never create a new app/context per thread; always guard shared state.
- **No migrations:** schema comes from `db.create_all()`. Model changes need a manual plan.
- **Version bumps:** update **both** the `version` file and `Config.VERSION` in `app/config.py`.
- **Frontend:** plain JS in `app/static/js/app.js`; no bundler. Edit the file directly; there's
  nothing to compile.

## Working in this repo

- **Run locally:** `pip install -r requirements.txt` then `python run.py --host 127.0.0.1
  --port 8080` and open the printed URL. SQLite DB is created automatically under `data/`.
- **Verify changes by running the app** and driving the scanner UI / hitting the `/api`
  endpoints — there is no automated test suite to rely on.
- **Config via env:** `PORT`, `DATABASE_URL`, `SECRET_KEY` (defaults exist; change
  `SECRET_KEY` for production).
- Do **not** commit `data/` (the SQLite DB) or `.env`. `.gitignore` currently only ignores
  `ScannerPro_exe.zip`; be careful not to add local artifacts.
- `.gitattributes` enforces LF line endings for shell/py/web files — keep scripts LF.

## Git / workflow notes

- Development for AI-assisted changes happens on the designated feature branch; commit with
  clear messages and push to that branch. Do not open a pull request unless explicitly asked.
- `install.sh` and `run.py` are what production deploys use — treat changes to them as
  deployment-affecting and describe them clearly.
