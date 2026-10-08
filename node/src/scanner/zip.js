// Minimal zip reader (stored + deflate entries, no zip64) built on zlib.inflateRawSync.
import zlib from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** Central-directory entries: [{name, method, csize, usize, local}]. */
export function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== SIG_CENTRAL) throw new Error('bad zip central directory');
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    entries.push({
      name: buf.toString('utf8', off + 46, off + 46 + nameLen),
      method: buf.readUInt16LE(off + 10),
      csize: buf.readUInt32LE(off + 20),
      usize: buf.readUInt32LE(off + 24),
      local: buf.readUInt32LE(off + 42),
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Uncompressed content of the entry called `name`. */
export function zipRead(buf, name) {
  const entry = zipEntries(buf).find((e) => e.name === name);
  if (!entry) throw new Error(`${name} not found in zip`);
  if (buf.readUInt32LE(entry.local) !== SIG_LOCAL) throw new Error('bad zip local header');
  const nameLen = buf.readUInt16LE(entry.local + 26);
  const extraLen = buf.readUInt16LE(entry.local + 28);
  const start = entry.local + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.csize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`unsupported zip compression method ${entry.method}`);
}
