// CDN range sources (port of app/scanner/range_fetcher.py): retrying fetch, built-in
// lists and validation of every range.
import { parseNetwork } from './ip.js';
import { CLOUDFLARE_CORE, CLOUDFLARE_24, CLOUDFLARE_IPV6 } from './builtinRanges.js';

export const FETCH_TIMEOUT = 30;
export const FETCH_RETRIES = 3;
export const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isTlsError(err) {
  const cause = err && err.cause;
  return Boolean(cause && (/CERT|TLS|SSL/i.test(cause.code || '') || /certificate/i.test(cause.message || '')));
}

/**
 * GET with automatic retry. Certificate errors are never retried insecurely.
 * `delays(err, attempt)` chooses the pause between attempts (seconds).
 */
export async function robustGet(url, { timeout = FETCH_TIMEOUT, retries = FETCH_RETRIES,
                                       headers = FETCH_HEADERS, delays = defaultDelays } = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout * 1000) });
      if (!r.ok) {
        const e = new Error(`HTTP ${r.status} for ${url}`);
        e.status = r.status;
        throw e;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (isTlsError(e)) break;
      if (attempt < retries) await sleep(delays(e, attempt) * 1000);
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url} — ${lastErr && lastErr.message}`);
}

function defaultDelays(err, attempt) {
  if (err.status || err.name === 'TimeoutError' || err.name === 'AbortError') return 1.0;
  return 1.5 * attempt;  // connection error
}

/** Keep only valid IPv4/IPv6 CIDRs/addresses (canonical form, deduplicated, order kept). */
export function normalizeIpRanges(ranges) {
  const out = [];
  const seen = new Set();
  for (const r of ranges || []) {
    const net = parseNetwork(r);
    if (!net || seen.has(net.text)) continue;
    seen.add(net.text);
    out.push(net.text);
  }
  return out;
}

const unique = (items) => [...new Set(items)];

/** Built-in CDN ranges: official Cloudflare CIDRs plus known /24 blocks. No network needed. */
export const BuiltinCDNRanges = {
  CLOUDFLARE_CORE,
  CLOUDFLARE_24,
  getRanges() { return unique([...CLOUDFLARE_CORE, ...CLOUDFLARE_24]); },
  getCoreRanges() { return [...CLOUDFLARE_CORE]; },
  getDetailedRanges() { return [...CLOUDFLARE_24]; },
};

async function getJson(url) {
  return (await robustGet(url)).json();
}

export const RangeFetcher = {
  CLOUDFLARE_IPV6,

  async getCloudflareOfficial() {
    try {
      const data = await getJson('https://api.cloudflare.com/client/v4/ips');
      return (data.result || {}).ipv4_cidrs || [];
    } catch (e) {
      console.error('Cloudflare official fetch failed:', e.message);
      return [];
    }
  },

  /** Cloudflare IPv6 ranges from the official API, built-in list as fallback. */
  async getCloudflareIpv6() {
    try {
      const data = await getJson('https://api.cloudflare.com/client/v4/ips');
      const ranges = (data.result || {}).ipv6_cidrs || [];
      if (ranges.length) return ranges;
    } catch (e) {
      console.error('Cloudflare IPv6 fetch failed:', e.message);
    }
    return [...CLOUDFLARE_IPV6];
  },

  async getCloudflareAsn() {
    return [
      '104.16.0.0/12', '172.64.0.0/13', '162.159.0.0/16',
      '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
      '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
      '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22',
      '198.41.128.0/17', '131.0.72.0/22',
    ];
  },

  async getCloudflareGithub() {
    try {
      const data = await getJson('https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/data/ip-ranges.json');
      return data.ipv4_cidrs || [];
    } catch (e) {
      console.error('Cloudflare GitHub fetch failed:', e.message);
      return [];
    }
  },

  async getFastlyOfficial() {
    try {
      return (await getJson('https://api.fastly.com/public-ip-list')).addresses || [];
    } catch (e) {
      console.error('Fastly official fetch failed:', e.message);
      return [];
    }
  },

  async getFastlyAsn() {
    return [
      '151.101.0.0/16', '199.232.0.0/16',
      '103.244.50.0/24', '103.245.222.0/23',
      '103.245.224.0/24', '104.156.80.0/20',
    ];
  },

  async getBuiltinRanges() {
    return BuiltinCDNRanges.getRanges();
  },

  /** All online sources, deduplicated. */
  async getAllSources() {
    const all = [];
    all.push(...await RangeFetcher.getCloudflareOfficial());
    all.push(...await RangeFetcher.getCloudflareAsn());
    all.push(...await RangeFetcher.getCloudflareGithub());
    all.push(...await RangeFetcher.getFastlyOfficial());
    all.push(...await RangeFetcher.getFastlyAsn());
    return unique(all);
  },

  /** All online sources + built-in ranges, deduplicated. */
  async getAllWithBuiltin() {
    const all = await RangeFetcher.getAllSources();
    all.push(...await RangeFetcher.getBuiltinRanges());
    return unique(all);
  },
};

const SOURCE_MAP = {
  sh_api: RangeFetcher.getCloudflareOfficial,
  sh_asn: RangeFetcher.getCloudflareAsn,
  sh_github: RangeFetcher.getCloudflareGithub,
  fastly_api: RangeFetcher.getFastlyOfficial,
  fastly_asn: RangeFetcher.getFastlyAsn,
  builtin: RangeFetcher.getBuiltinRanges,
  sh_ipv6: RangeFetcher.getCloudflareIpv6,
  all: RangeFetcher.getAllWithBuiltin,
  // backward compat
  all_vfarid: RangeFetcher.getAllWithBuiltin,
  vfarid: RangeFetcher.getBuiltinRanges,
};

export const SOURCES = Object.keys(SOURCE_MAP);

/** Normalized ranges of a source key (unknown keys fall back to 'all'). */
export async function fetchRanges(source) {
  const key = Object.prototype.hasOwnProperty.call(SOURCE_MAP, source) ? source : 'all';
  return { ranges: normalizeIpRanges(await SOURCE_MAP[key]()), source: key };
}
