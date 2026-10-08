// IPv4 / IPv6 parsing helpers (the subset of Python's ipaddress module the scanner needs).

const V4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Dotted IPv4 -> unsigned 32-bit int, or null. Leading zeros are rejected like Python. */
export function parseIpv4(s) {
  const m = V4_RE.exec(s);
  if (!m) return null;
  let n = 0;
  for (let i = 1; i <= 4; i++) {
    const o = m[i];
    if (o.length > 1 && o[0] === '0') return null;
    const v = Number(o);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function formatIpv4(n) {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

/** IPv6 text -> BigInt, or null. Supports '::' and an embedded IPv4 tail. */
export function parseIpv6(s) {
  if (typeof s !== 'string' || !s.includes(':') || /[^0-9a-fA-F:.]/.test(s)) return null;
  let text = s;
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    const v4 = parseIpv4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    text = s.slice(0, lastColon + 1) + ((v4 >>> 16) & 0xffff).toString(16) + ':' + (v4 & 0xffff).toString(16);
  }
  const dbl = text.split('::');
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(':') : [];
  const rest = dbl.length === 2 && dbl[1] ? dbl[1].split(':') : [];
  if (dbl.length === 1 && head.length !== 8) return null;
  if (dbl.length === 2 && head.length + rest.length > 7) return null;
  const groups = [...head, ...Array(8 - head.length - rest.length).fill('0'), ...rest];
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

/** BigInt -> compressed lowercase IPv6 text (same form as Python's str(IPv6Address)). */
export function formatIpv6(n) {
  const g = [];
  for (let i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  let best = -1, bestLen = 0, cur = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (g[i] !== 0) { cur = -1; continue; }
    if (cur < 0) { cur = i; curLen = 0; }
    curLen++;
    if (curLen > bestLen) { best = cur; bestLen = curLen; }
  }
  const hex = g.map((x) => x.toString(16));
  if (bestLen < 2) return hex.join(':');
  return `${hex.slice(0, best).join(':')}::${hex.slice(best + bestLen).join(':')}`;
}

/**
 * Parse 'a.b.c.d[/n]' or 'x::y[/n]' like ipaddress.ip_network(strict=False).
 * Returns {version, address (int | BigInt of the network address), prefix, text} or null.
 */
export function parseNetwork(s) {
  if (s === null || s === undefined) return null;
  s = String(s).trim();
  const slash = s.indexOf('/');
  const addr = slash < 0 ? s : s.slice(0, slash);
  const prefixStr = slash < 0 ? null : s.slice(slash + 1);
  const v6 = addr.includes(':');
  const bits = v6 ? 128 : 32;
  let prefix = bits;
  if (prefixStr !== null) {
    if (!/^\d+$/.test(prefixStr)) return null;
    prefix = Number(prefixStr);
    if (prefix > bits) return null;
  }
  if (v6) {
    const n = parseIpv6(addr);
    if (n === null) return null;
    const net = prefix === 0 ? 0n : n & (((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n));
    return { version: 6, address: net, prefix, text: `${formatIpv6(net)}/${prefix}` };
  }
  const n = parseIpv4(addr);
  if (n === null) return null;
  const net = prefix === 0 ? 0 : (n & (~0 << (32 - prefix))) >>> 0;
  return { version: 4, address: net, prefix, text: `${formatIpv4(net)}/${prefix}` };
}
