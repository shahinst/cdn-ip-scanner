import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { buildXlsx } from '../src/xlsx.js';

/** Minimal zip reader: central directory -> {name: content}. */
function unzip(buf) {
  const out = {};
  let p = buf.length - 22;
  while (buf.readUInt32LE(p) !== 0x06054b50) p -= 1;
  let cd = buf.readUInt32LE(p + 16);
  const count = buf.readUInt16LE(p + 10);
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(cd), 0x02014b50);
    const method = buf.readUInt16LE(cd + 10);
    const csize = buf.readUInt32LE(cd + 20);
    const nlen = buf.readUInt16LE(cd + 28), elen = buf.readUInt16LE(cd + 30), clen = buf.readUInt16LE(cd + 32);
    const offset = buf.readUInt32LE(cd + 42);
    const name = buf.toString('utf8', cd + 46, cd + 46 + nlen);
    const lnlen = buf.readUInt16LE(offset + 26), lelen = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + lnlen + lelen;
    const data = buf.subarray(start, start + csize);
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    cd += 46 + nlen + elen + clen;
  }
  return out;
}

test('xlsx contains the rows as inline strings and numbers', () => {
  const buf = buildXlsx([['#', 'IP', 'Ping'], [1, '1.1.1.1', 12.5], [2, 'a&b<c>', '']], 'Results');
  const files = unzip(buf);
  assert.ok(files['[Content_Types].xml'] && files['xl/workbook.xml'] && files['xl/worksheets/sheet1.xml']);
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<t>IP</t>'));
  assert.ok(sheet.includes('<v>12.5</v>'));
  assert.ok(sheet.includes('a&amp;b&lt;c&gt;'));
  assert.ok(files['xl/workbook.xml'].includes('Results'));
});
