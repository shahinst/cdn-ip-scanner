// /api/export/<json|txt|csv|excel>
import express from 'express';
import { toInt, round } from '../config.js';
import { buildXlsx } from '../xlsx.js';

export const ALIVE_HEADER = { en: 'Alive', fa: 'سالم', zh: '可用', ru: 'Работает' };

export const EXPORT_HEADERS = {
  fa: ['رتبه', 'آدرس IP', 'Ping', 'پورت‌ها', 'امتیاز', 'اپراتور', 'دیتاسنتر', 'سرعت (KB/s)', 'تأخیر واقعی (ms)'],
  en: ['#', 'IP', 'Ping', 'Ports', 'Score', 'Operator', 'Colo', 'Speed (KB/s)', 'Real delay (ms)'],
};

/** Field quoting like Python's csv.writer (QUOTE_MINIMAL, CRLF line ends). */
function csvLine(fields) {
  return fields.map((v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',') + '\r\n';
}

function realDelayCell(r) {
  if (r.real_delay === null || r.real_delay === undefined) return '';
  return r.real_delay < 0 ? 'failed' : Math.round(r.real_delay);
}

function rowCells(idx, r, coloLabel) {
  return [idx, r.ip || '', r.ping !== null && r.ping !== undefined ? round(r.ping, 1) : '',
    (r.open_ports || []).join(' '), r.score !== null && r.score !== undefined ? round(r.score, 1) : '',
    r.operator || '', coloLabel(r.colo), r.speed !== null && r.speed !== undefined ? round(r.speed, 1) : '',
    realDelayCell(r)];
}

export function exportRoutes(ctx) {
  const { store, lib } = ctx;
  const r = express.Router();

  r.get('/export/:fmt', (req, res) => {
    const fmt = req.params.fmt;
    const sessionId = toInt(req.query.session_id, 0) || null;
    let lang = String(req.query.lang || 'en').trim().toLowerCase();
    if (!Object.hasOwn(EXPORT_HEADERS, lang)) lang = 'en';
    const results = store.listResults(sessionId);

    if (fmt === 'json') {
      res.set('Content-Disposition', 'attachment;filename=scan_results.json');
      return res.type('application/json').send(JSON.stringify(results.map((x) => store.resultToDict(x, lib.coloName)), null, 2));
    }
    if (fmt === 'txt') {
      res.set('Content-Disposition', 'attachment;filename=scan_ips.txt');
      return res.type('text/plain').send(results.map((x) => x.ip).join('\n'));
    }
    if (fmt === 'csv') {
      let out = csvLine([...EXPORT_HEADERS[lang], ALIVE_HEADER[lang] || 'Alive']);
      results.forEach((x, i) => {
        out += csvLine([...rowCells(i + 1, x, lib.coloLabel), x.alive === false ? 'no' : 'yes']);
      });
      res.set('Content-Disposition', 'attachment;filename=scan_results.csv');
      return res.type('text/csv; charset=utf-8').send('﻿' + out);
    }
    if (fmt === 'excel') {
      const rows = [EXPORT_HEADERS[lang], ...results.map((x, i) => rowCells(i + 1, x, lib.coloLabel))];
      res.set('Content-Disposition', 'attachment;filename=scan_results.xlsx');
      return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buildXlsx(rows, 'Results'));
    }
    res.status(400).json({ error: 'Unsupported format' });
  });

  return r;
}
