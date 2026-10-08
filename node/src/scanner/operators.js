// Operator (ISP) definitions and announced-prefix fetching (port of app/scanner/operators.py).
import { parseNetwork } from './ip.js';
import { robustGet } from './rangeFetcher.js';

export const OPERATORS_IRAN = {
  irancell: { name: 'Irancell', name_fa: 'ایرانسل', asn: 44244 },
  mci: { name: 'MCI', name_fa: 'همراه اول', asn: 197207 },
  rightel: { name: 'Rightel', name_fa: 'رایتل', asn: 57218 },
  shuttle: { name: 'Shuttle', name_fa: 'شاتل', asn: 12880 },
};

export const OPERATORS_CHINA = {
  china_mobile: { name: 'China Mobile', name_fa: 'چاینا موبایل',
                  asn: [9808, 56040, 56041, 56042, 56044, 56046, 56047, 56048, 58453, 58807, 9231] },
  china_unicom: { name: 'China Unicom', name_fa: 'چاینا یونیکام',
                  asn: [4837, 4808, 9800, 9929, 10099, 17621, 17623, 17816] },
  china_telecom: { name: 'China Telecom', name_fa: 'چاینا تلکام',
                   asn: [4134, 4809, 4812, 23724, 58466, 133774, 133775, 136958] },
  china_broadnet: { name: 'China Broadnet', name_fa: 'چاینا برادنت', asn: [58542] },
};

export const OPERATORS_RUSSIA = {
  mts: { name: 'MTS', name_fa: 'ام‌تی‌اس', asn: [8359, 13174, 28840, 29226, 31163, 35807, 42511, 50544] },
  megafon: { name: 'MegaFon', name_fa: 'مگافون', asn: [25159, 31133, 31200, 43478, 44843, 49037, 50716] },
  beeline: { name: 'Beeline', name_fa: 'بیلاین', asn: [3216, 8402, 12389, 21453, 28917, 35000, 41733, 42668, 48642] },
  tele2: { name: 'Tele2 Russia', name_fa: 'تله‌۲', asn: [12958, 35104, 41668, 44746, 48287, 48715, 50384, 51547] },
};

export const OPERATORS_BY_COUNTRY = { ir: OPERATORS_IRAN, cn: OPERATORS_CHINA, ru: OPERATORS_RUSSIA };
export const OPERATORS = OPERATORS_BY_COUNTRY;

export const OPERATOR_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => (await robustGet(url, { headers: OPERATOR_FETCH_HEADERS,
                                                       delays: (e, attempt) => 1.5 * attempt })).json();

function normalizeIpv4Prefixes(prefixes) {
  const out = [];
  for (const p of prefixes || []) {
    const s = p && typeof p === 'object' ? String(p.prefix || p.ip || '') : String(p ?? '').trim();
    if (!s || s.includes(':') || !s.includes('/')) continue;
    const net = parseNetwork(s);
    if (net && net.version === 4) out.push(net.text);
  }
  return out;
}

const result = (prefixes, error = null) => ({ count: prefixes.length, prefixes, error });

export async function fetchOperatorPrefixesRipe(asn) {
  try {
    const data = await getJson(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`);
    const prefixes = normalizeIpv4Prefixes((data.data || {}).prefixes || []);
    if (!prefixes.length) return result([], 'no IPv4 prefixes');
    return result(prefixes);
  } catch (e) {
    console.error(`RIPE fetch failed for AS${asn}:`, e.message);
    return result([], String(e.message || e));
  }
}

export async function fetchOperatorPrefixesBgpview(asn) {
  try {
    const data = await getJson(`https://api.bgpview.io/asn/${asn}/prefixes`);
    if (data.status !== 'ok') return result([], data.status_message || 'API error');
    return result(normalizeIpv4Prefixes((data.data || {}).ipv4_prefixes || []));
  } catch (e) {
    console.error(`BGPView fetch failed for AS${asn}:`, e.message);
    return result([], String(e.message || e));
  }
}

/** RIPE -> BGPView -> RIPE again, with short pauses between sources. */
export async function fetchOperatorPrefixesSmart(asn) {
  let r = await fetchOperatorPrefixesRipe(asn);
  if (!r.error && r.count > 0) return r;
  await sleep(300);
  r = await fetchOperatorPrefixesBgpview(asn);
  if (!r.error && r.count > 0) return r;
  await sleep(500);
  r = await fetchOperatorPrefixesRipe(asn);
  if (!r.error && r.count > 0) return r;
  return result([], r.error || 'no data');
}

function findOperator(key, country) {
  if (country) return (OPERATORS_BY_COUNTRY[country] || OPERATORS_IRAN)[key];
  for (const table of Object.values(OPERATORS_BY_COUNTRY)) if (table[key]) return table[key];
  return undefined;
}

/** All announced IPv4 prefixes of one operator: {count, prefixes, error}. */
export async function fetchOperatorRanges(key, country = null) {
  const op = findOperator(key, country);
  if (!op) return result([], 'unknown operator');
  if (!Array.isArray(op.asn)) return fetchOperatorPrefixesSmart(op.asn);
  const all = [];
  for (const asn of op.asn) {
    const r = await fetchOperatorPrefixesSmart(asn);
    if (!r.error && r.prefixes.length) all.push(...r.prefixes);
    await sleep(500);
  }
  return result(all, all.length ? null : 'no data');
}

/** Prefixes of every operator of a country, keyed by operator key. */
export async function fetchAllOperators(country = 'ir') {
  const table = OPERATORS_BY_COUNTRY[country] || OPERATORS_IRAN;
  const out = {};
  for (const [key, op] of Object.entries(table)) {
    out[key] = { name: op.name, name_fa: op.name_fa, ...(await fetchOperatorRanges(key, country)) };
  }
  return out;
}
