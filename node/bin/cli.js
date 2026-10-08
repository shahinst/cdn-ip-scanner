#!/usr/bin/env node
// Command-line entry point: starts the web server (port of run.py).
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createApp } from '../src/server.js';
import { readVersion, defaultDataDir } from '../src/config.js';

const HELP = `Usage: cdn-ip-scanner [options]

Options:
  --port <n>         Port to listen on (default: 8080, env PORT)
  --host <addr>      Address to bind (default: 127.0.0.1)
  --data-dir <path>  Data directory (default: ~/.cdn-ip-scanner, env CDN_SCANNER_DATA_DIR)
  --username <u>     Basic auth user (env APP_USERNAME)
  --password <p>     Basic auth password (env APP_PASSWORD)
  --open             Open the browser after start
  --version          Print the version
  --help             Show this help
`;

export function parseArgs(argv) {
  const opts = { port: parseInt(process.env.PORT || '8080', 10), host: '127.0.0.1',
    dataDir: process.env.CDN_SCANNER_DATA_DIR || defaultDataDir(),
    username: process.env.APP_USERNAME || '', password: process.env.APP_PASSWORD || '',
    open: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { i += 1; if (argv[i] === undefined) throw new Error(`${a} requires a value`); return argv[i]; };
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--open') opts.open = true;
    else if (a === '--port' || a === '-p') opts.port = parseInt(next(), 10);
    else if (a.startsWith('--port=')) opts.port = parseInt(a.slice(7), 10);
    else if (a === '--host') opts.host = next();
    else if (a.startsWith('--host=')) opts.host = a.slice(7);
    else if (a === '--data-dir') opts.dataDir = next();
    else if (a.startsWith('--data-dir=')) opts.dataDir = a.slice(11);
    else if (a === '--username') opts.username = next();
    else if (a.startsWith('--username=')) opts.username = a.slice(11);
    else if (a === '--password') opts.password = next();
    else if (a.startsWith('--password=')) opts.password = a.slice(11);
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) throw new Error('Invalid --port');
  return opts;
}

function isLoopback(host) {
  if (host === 'localhost') return true;
  if (net.isIP(host) === 4) return host.startsWith('127.');
  if (net.isIP(host) === 6) return host === '::1' || host === '0:0:0:0:0:0:0:1';
  return false;
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); } catch { /* best effort */ }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error(HELP);
    process.exit(2);
  }
  if (opts.help) { process.stdout.write(HELP); return; }
  if (opts.version) { console.log(readVersion()); return; }

  const { server, close } = await createApp({ dataDir: opts.dataDir, username: opts.username, password: opts.password });
  const authEnabled = !!(opts.username && opts.password);
  if (!isLoopback(opts.host) && !authEnabled) {
    console.error('WARNING: binding to a non-loopback address without APP_USERNAME/APP_PASSWORD set — '
      + 'the scanner (including /api/do-update) will be reachable by anyone on the network.');
  }

  const url = `http://${opts.host.includes(':') ? `[${opts.host}]` : opts.host}:${opts.port}`;
  server.listen(opts.port, opts.host, () => {
    const line = '='.repeat(48);
    console.log(`\n${line}\n  CDN IP Scanner V ${readVersion()}\n  Author: shahinst\n${'-'.repeat(48)}`
      + `\n  URL:    ${url}\n  Data:   ${opts.dataDir}\n${line}\n`);
    if (opts.open) openBrowser(url);
  });
  server.on('error', (e) => { console.error(`Cannot listen on ${url}: ${e.message}`); process.exit(1); });

  const shutdown = async () => { await close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
