# Changelog

All notable changes to CDN IP Scanner. The version number lives in the `version` file and is read by the
npm package, the Android app and the Python server.

## 3.0 — 2026-10-09

### Added
- **npm app** (`node/`): full Node.js port of the server, published as `cdn-ip-scanner` on npm.
  `npm install -g cdn-ip-scanner && cdn-ip-scanner --port 8080`. Express + Socket.IO + Nunjucks, JSON file
  store, no native modules. Same REST/WebSocket API, same UI and the complete feature set: cloud / operator /
  V2Ray scans, Xray real test, download speed test, favorites monitor with Telegram, scan summary to Telegram,
  resume, re-test, JSON / Excel / CSV / TXT exports, Clash & sing-box export, QR and subscription links,
  diagnostics report, four languages, self-update (`npm install -g cdn-ip-scanner@latest`).
- CLI options `--port/-p`, `--host`, `--username`, `--password`, `--data-dir`, `--open`, `--version`.
- `node:test` suite (API, scan engine, resume, retest, exports, favorites, diagnostics, xlsx writer).
- CI job for the npm app on Linux, Windows and macOS with Node 18 and 22.
- Release workflow publishes `CDN-IP-Scanner-<version>-npm.tgz` and publishes to npmjs.com when `NPM_TOKEN` is set.
- The saved theme is rendered on the `<html>` tag by both servers (no flash of the wrong theme).
- Android: trimmed logo for the top bar, `StatTile`, `SectionTitle` and `Badge` composables.

### Changed
- **Web UI theme rewritten**: dashboard layout, design tokens, new light and dark palettes, stat tiles, pill
  buttons, translucent sticky header, refined tables, modals and RTL layout.
- **Android theme rewritten**: explicit Material 3 light/dark schemes (blue / violet / emerald), branded top bar,
  stat tiles on the scan card, elevated result/favorite/history cards, status badges, section headings,
  rounded progress bar. Dynamic (wallpaper) colors are no longer used so the app looks the same everywhere.
- README rewritten around the three ways to run the app (npm, Android, Linux server).

### Fixed
- Fastly data-center codes no longer include the cache-node digits (`SOF1510038` → `SOF`) in the web, npm
  and Android apps.
- Android restores the results of the last scan after the process is restarted.

### Removed
- PyInstaller desktop builds (`.exe`, `.app`, Linux tarballs) and their release jobs. Use the npm app.

## 2.5 — 2026-10-08

- Android app (Kotlin / Jetpack Compose) with the complete scanner, published as an APK on every release.
- Re-test results, copy best IPs, CSV export, data-center city names, scan summary to Telegram.
- Fastly colo fix, results restored on restart (Android), release workflow fixes.

## 2.4

- Live charts, resume interrupted scans, diagnostics report, CONTRIBUTING guide.

## 2.3

- Non-root server service, scan profiles, filter/sort, Clash & sing-box export.
