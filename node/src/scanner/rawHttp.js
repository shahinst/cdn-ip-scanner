// Raw-socket HTTP helpers shared by the scanner modules (no http/https module involved).
import net from 'node:net';
import tls from 'node:tls';

const CRLF = Buffer.from('\r\n');
const CRLF2 = Buffer.from('\r\n\r\n');
const noop = () => {};

/**
 * Open a TCP (or TLS) connection. `socket` wraps an existing socket in TLS instead
 * (used for TLS through a SOCKS tunnel). Resolves with the connected socket.
 */
export function connect({ host, port, tls: useTls = false, servername, rejectUnauthorized = false,
                          timeoutMs = 5000, socket = null }) {
  return new Promise((resolve, reject) => {
    let sock;
    const fail = (err) => { sock.setTimeout(0); sock.destroy(); reject(err); };
    const done = () => {
      sock.setTimeout(0);
      sock.removeListener('error', fail);
      sock.on('error', noop);
      resolve(sock);
    };
    const opts = socket ? { socket } : { host, port };
    sock = useTls ? tls.connect({ ...opts, servername, rejectUnauthorized }, done) : net.connect(opts, done);
    sock.once('error', fail);
    sock.setTimeout(Math.max(1, timeoutMs), () => fail(new Error('connect timeout')));
    sock.setNoDelay(true);
  });
}

/** Buffered reader over a socket with deadline-aware awaits. */
export class SocketReader {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.ended = false;
    this.waiters = [];
    const end = () => { this.ended = true; this._wake(); };
    sock.on('data', (c) => { this.buf = this.buf.length ? Buffer.concat([this.buf, c]) : c; this._wake(); });
    sock.on('end', end);
    sock.on('close', end);
    sock.on('error', end);
  }

  _wake() {
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn();
  }

  /** Wait for more data / EOF; rejects when `deadline` (ms timestamp) passes. */
  wait(deadline) {
    return new Promise((resolve, reject) => {
      const ms = deadline - Date.now();
      if (ms <= 0) return reject(new Error('timeout'));
      const fn = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((f) => f !== fn);
        reject(new Error('timeout'));
      }, ms);
      this.waiters.push(fn);
    });
  }

  /** Bytes up to and including `sep`, or null on EOF / `limit` bytes without it. */
  async readUntil(sep, deadline, limit = 65536) {
    for (;;) {
      const i = this.buf.indexOf(sep);
      if (i >= 0) {
        const out = this.buf.subarray(0, i + sep.length);
        this.buf = this.buf.subarray(i + sep.length);
        return out;
      }
      if (this.ended || this.buf.length >= limit) return null;
      await this.wait(deadline);
    }
  }

  /** Exactly `n` bytes, or null on EOF. */
  async readExact(n, deadline) {
    while (this.buf.length < n) {
      if (this.ended) return null;
      await this.wait(deadline);
    }
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }

  async readToEnd(deadline, limit = 1 << 20) {
    while (!this.ended && this.buf.length < limit) await this.wait(deadline);
    return this.take();
  }

  /** Drain whatever is buffered. */
  take() {
    const out = this.buf;
    this.buf = Buffer.alloc(0);
    return out;
  }
}

/** Split a raw HTTP response into {status, headers (lowercase keys), body}; status null if garbage. */
export function parseHttpResponse(raw) {
  const idx = raw.indexOf('\r\n\r\n');
  const head = idx < 0 ? raw : raw.slice(0, idx);
  const body = idx < 0 ? '' : raw.slice(idx + 4);
  const lines = head.split('\r\n');
  const parts = lines[0].split(' ');
  if (parts.length < 2 || !parts[0].startsWith('HTTP/') || !/^\d+$/.test(parts[1])) {
    return { status: null, headers: {}, body: '' };
  }
  const headers = {};
  for (const line of lines.slice(1)) {
    const c = line.indexOf(':');
    if (c >= 0) headers[line.slice(0, c).trim().toLowerCase()] = line.slice(c + 1).trim();
  }
  return { status: Number(parts[1]), headers, body };
}

/** Read until the end of the HTTP headers (or `limit` bytes / EOF); returns everything read. */
export async function readHead(reader, deadline, limit = 8192) {
  while (!reader.buf.includes(CRLF2) && reader.buf.length < limit && !reader.ended) await reader.wait(deadline);
  return reader.take().toString('utf8');
}

/**
 * Read one full HTTP/1.x response (keep-alive aware): Content-Length, chunked or
 * read-until-close bodies. Returns {status, headers, body, close} or null if malformed.
 */
export async function readResponse(reader, deadline, bodyLimit = 1 << 20) {
  const head = await reader.readUntil(CRLF2, deadline, 65536);
  if (!head) return null;
  const headText = head.toString('latin1');
  const { status, headers } = parseHttpResponse(headText);
  if (status === null) return null;
  let body;
  const te = (headers['transfer-encoding'] || '').toLowerCase();
  if (te.includes('chunked')) {
    const parts = [];
    for (;;) {
      const line = await reader.readUntil(CRLF, deadline, 1024);
      if (!line) return null;
      const size = parseInt(line.toString('latin1').trim(), 16);
      if (Number.isNaN(size)) return null;
      if (size === 0) { await reader.readUntil(CRLF, deadline, 8192); break; }
      const chunk = await reader.readExact(size + 2, deadline);
      if (!chunk) return null;
      parts.push(chunk.subarray(0, size));
    }
    body = Buffer.concat(parts);
  } else if (headers['content-length'] !== undefined) {
    body = await reader.readExact(parseInt(headers['content-length'], 10) || 0, deadline);
    if (!body) return null;
  } else if (status === 204 || status === 304 || status < 200) {
    body = Buffer.alloc(0);
  } else {
    body = await reader.readToEnd(deadline, bodyLimit);
  }
  const conn = (headers.connection || '').toLowerCase();
  const close = conn.includes('close') || (headText.startsWith('HTTP/1.0') && !conn.includes('keep-alive'));
  return { status, headers, body: body.toString('utf8'), close };
}
