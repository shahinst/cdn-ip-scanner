// Copy the repo root `version` file into package.json (run at prepack).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(root, '..', 'version');
if (!fs.existsSync(versionFile)) {
  console.log('sync-version: no ../version file, keeping package.json version');
  process.exit(0);
}
const raw = fs.readFileSync(versionFile, 'utf8').trim();
const parts = raw.split('.').map((p) => parseInt(p, 10) || 0);
while (parts.length < 3) parts.push(0);
const version = parts.slice(0, 3).join('.');

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`sync-version: package.json version -> ${version}`);
}
fs.writeFileSync(path.join(root, 'version'), raw + '\n');
