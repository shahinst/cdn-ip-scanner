// Copy the Flask frontend (static files + templates) into the package (run at prepack).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pairs = [
  [path.join(root, '..', 'app', 'static'), path.join(root, 'public')],
  [path.join(root, '..', 'app', 'templates'), path.join(root, 'views')],
];
for (const [src, dst] of pairs) {
  if (!fs.existsSync(src)) {
    if (fs.existsSync(dst)) { console.log(`copy-assets: keeping existing ${dst}`); continue; }
    console.error(`copy-assets: missing ${src}`);
    process.exit(1);
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true, filter: (p) => !/__pycache__|\.pyc$/.test(p) });
  console.log(`copy-assets: ${src} -> ${dst}`);
}
