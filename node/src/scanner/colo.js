// Cloudflare / Fastly data-center (colo) codes -> city names.
// Shared with the Python app (app/scanner/colo.py) and Android (scan/Colo.kt); keep in sync.

export const COLO_NAMES = {
  ABJ: 'Abidjan, CI', ABQ: 'Albuquerque, US', ACC: 'Accra, GH', ADD: 'Addis Ababa, ET',
  ADL: 'Adelaide, AU', AKL: 'Auckland, NZ', ALA: 'Almaty, KZ', ALG: 'Algiers, DZ',
  AMD: 'Ahmedabad, IN', AMM: 'Amman, JO', AMS: 'Amsterdam, NL', ARN: 'Stockholm, SE',
  ASU: 'Asuncion, PY', ATH: 'Athens, GR', ATL: 'Atlanta, US', AUS: 'Austin, US',
  BAH: 'Manama, BH', BCN: 'Barcelona, ES', BEG: 'Belgrade, RS', BER: 'Berlin, DE',
  BEY: 'Beirut, LB', BGW: 'Baghdad, IQ', BKK: 'Bangkok, TH', BLR: 'Bangalore, IN',
  BNA: 'Nashville, US', BNE: 'Brisbane, AU', BOG: 'Bogota, CO', BOM: 'Mumbai, IN',
  BOS: 'Boston, US', BRU: 'Brussels, BE', BSB: 'Brasilia, BR', BSR: 'Basra, IQ',
  BTS: 'Bratislava, SK', BUD: 'Budapest, HU', BUF: 'Buffalo, US', BWI: 'Baltimore, US',
  CAI: 'Cairo, EG', CBR: 'Canberra, AU', CCU: 'Kolkata, IN', CDG: 'Paris, FR',
  CEB: 'Cebu, PH', CGK: 'Jakarta, ID', CGP: 'Chattogram, BD', CHC: 'Christchurch, NZ',
  CLE: 'Cleveland, US', CLT: 'Charlotte, US', CMB: 'Colombo, LK', CMH: 'Columbus, US',
  CMN: 'Casablanca, MA', CNF: 'Belo Horizonte, BR', COK: 'Kochi, IN', CPH: 'Copenhagen, DK',
  CPT: 'Cape Town, ZA', CUR: 'Willemstad, CW', CWB: 'Curitiba, BR', DAC: 'Dhaka, BD',
  DAR: 'Dar es Salaam, TZ', DEL: 'New Delhi, IN', DEN: 'Denver, US', DFW: 'Dallas, US',
  DKR: 'Dakar, SN', DME: 'Moscow, RU', DMM: 'Dammam, SA', DOH: 'Doha, QA',
  DPS: 'Denpasar, ID', DTW: 'Detroit, US', DUB: 'Dublin, IE', DUR: 'Durban, ZA',
  DUS: 'Dusseldorf, DE', DXB: 'Dubai, AE', EBL: 'Erbil, IQ', EDI: 'Edinburgh, GB',
  EVN: 'Yerevan, AM', EWR: 'Newark, US', EZE: 'Buenos Aires, AR', FCO: 'Rome, IT',
  FOR: 'Fortaleza, BR', FRA: 'Frankfurt, DE', FUK: 'Fukuoka, JP', GDL: 'Guadalajara, MX',
  GIG: 'Rio de Janeiro, BR', GOT: 'Gothenburg, SE', GRU: 'Sao Paulo, BR', GUA: 'Guatemala City, GT',
  GUM: 'Hagatna, GU', GVA: 'Geneva, CH', GYD: 'Baku, AZ', HAM: 'Hamburg, DE',
  HAN: 'Hanoi, VN', HBA: 'Hobart, AU', HEL: 'Helsinki, FI', HKG: 'Hong Kong, HK',
  HND: 'Tokyo, JP', HNL: 'Honolulu, US', HYD: 'Hyderabad, IN', IAD: 'Ashburn, US',
  IAH: 'Houston, US', ICN: 'Seoul, KR', IND: 'Indianapolis, US', ISB: 'Islamabad, PK',
  IST: 'Istanbul, TR', JAX: 'Jacksonville, US', JED: 'Jeddah, SA', JNB: 'Johannesburg, ZA',
  JSR: 'Jashore, BD', KBP: 'Kyiv, UA', KEF: 'Reykjavik, IS', KGL: 'Kigali, RW',
  KHH: 'Kaohsiung, TW', KHI: 'Karachi, PK', KIV: 'Chisinau, MD', KIX: 'Osaka, JP',
  KJA: 'Krasnoyarsk, RU', KTM: 'Kathmandu, NP', KUL: 'Kuala Lumpur, MY', KWI: 'Kuwait City, KW',
  LAD: 'Luanda, AO', LAS: 'Las Vegas, US', LAX: 'Los Angeles, US', LCA: 'Larnaca, CY',
  LED: 'St. Petersburg, RU', LHE: 'Lahore, PK', LHR: 'London, GB', LIM: 'Lima, PE',
  LIS: 'Lisbon, PT', LJU: 'Ljubljana, SI', LOS: 'Lagos, NG', LPB: 'La Paz, BO',
  LUX: 'Luxembourg, LU', LYS: 'Lyon, FR', MAA: 'Chennai, IN', MAD: 'Madrid, ES',
  MAN: 'Manchester, GB', MCI: 'Kansas City, US', MCT: 'Muscat, OM', MEL: 'Melbourne, AU',
  MEM: 'Memphis, US', MEX: 'Mexico City, MX', MFE: 'McAllen, US', MFM: 'Macau, MO',
  MIA: 'Miami, US', MKE: 'Milwaukee, US', MLA: 'Valletta, MT', MLE: 'Male, MV',
  MNL: 'Manila, PH', MPM: 'Maputo, MZ', MRS: 'Marseille, FR', MRU: 'Port Louis, MU',
  MSP: 'Minneapolis, US', MSQ: 'Minsk, BY', MSY: 'New Orleans, US', MTY: 'Monterrey, MX',
  MUC: 'Munich, DE', MVD: 'Montevideo, UY', MXP: 'Milan, IT', NAG: 'Nagpur, IN',
  NBO: 'Nairobi, KE', NJF: 'Najaf, IQ', NOU: 'Noumea, NC', NRT: 'Tokyo, JP',
  OKA: 'Naha, JP', OKC: 'Oklahoma City, US', OMA: 'Omaha, US', ORD: 'Chicago, US',
  ORF: 'Norfolk, US', ORK: 'Cork, IE', ORN: 'Oran, DZ', OSL: 'Oslo, NO',
  OTP: 'Bucharest, RO', PAT: 'Patna, IN', PBH: 'Thimphu, BT', PDX: 'Portland, US',
  PER: 'Perth, AU', PHL: 'Philadelphia, US', PHX: 'Phoenix, US', PIT: 'Pittsburgh, US',
  PMO: 'Palermo, IT', PNH: 'Phnom Penh, KH', PNQ: 'Pune, IN', POA: 'Porto Alegre, BR',
  PRG: 'Prague, CZ', PTY: 'Panama City, PA', QRO: 'Queretaro, MX', RDU: 'Raleigh, US',
  RGN: 'Yangon, MM', RIC: 'Richmond, US', RIX: 'Riga, LV', RUH: 'Riyadh, SA',
  SAL: 'San Salvador, SV', SAN: 'San Diego, US', SAT: 'San Antonio, US', SCL: 'Santiago, CL',
  SDQ: 'Santo Domingo, DO', SEA: 'Seattle, US', SFO: 'San Francisco, US', SGN: 'Ho Chi Minh City, VN',
  SIN: 'Singapore, SG', SJC: 'San Jose, US', SJJ: 'Sarajevo, BA', SJO: 'San Jose, CR',
  SJU: 'San Juan, PR', SKP: 'Skopje, MK', SLC: 'Salt Lake City, US', SMF: 'Sacramento, US',
  SOF: 'Sofia, BG', STL: 'St. Louis, US', SVX: 'Yekaterinburg, RU', SYD: 'Sydney, AU',
  TAS: 'Tashkent, UZ', TBS: 'Tbilisi, GE', THR: 'Tehran, IR', TIA: 'Tirana, AL',
  TLL: 'Tallinn, EE', TLV: 'Tel Aviv, IL', TNR: 'Antananarivo, MG', TPA: 'Tampa, US',
  TPE: 'Taipei, TW', TUN: 'Tunis, TN', TXL: 'Berlin, DE', UIO: 'Quito, EC',
  ULN: 'Ulaanbaatar, MN', VIE: 'Vienna, AT', VKO: 'Moscow, RU', VNO: 'Vilnius, LT',
  WAW: 'Warsaw, PL', YOW: 'Ottawa, CA', YUL: 'Montreal, CA', YVR: 'Vancouver, CA',
  YWG: 'Winnipeg, CA', YYC: 'Calgary, CA', YYZ: 'Toronto, CA', ZAG: 'Zagreb, HR',
  ZRH: 'Zurich, CH',
};

/** City name for a colo code, or '' when unknown. */
export function coloName(code) {
  return COLO_NAMES[String(code || '').trim().toUpperCase()] || '';
}

/** 'FRA (Frankfurt, DE)' or just the code when unknown. */
export function coloLabel(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return '';
  const name = coloName(code);
  return name ? `${code} (${name})` : code;
}
