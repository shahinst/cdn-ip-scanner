// Scan control and result listing endpoints.
import express from 'express';
import { toInt } from '../config.js';

function body(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }

export function scanRoutes(ctx) {
  const { store, lib, engine } = ctx;
  const r = express.Router();
  const send = (res, out) => res.status(out.status).json(out.body);

  r.post('/scan/start', (req, res) => send(res, engine.start(body(req))));

  r.get('/scan/resumable', (req, res) => res.json(engine.resumableInfo()));

  r.post('/scan/resume', (req, res) => send(res, engine.resume(body(req).session_id)));

  r.post('/scan/discard-resume', (req, res) => {
    engine.discardResume();
    res.json({ status: 'ok' });
  });

  r.post('/scan/stop', (req, res) => {
    engine.stop();
    res.json({ status: 'stopped' });
  });

  r.post('/scan/retest', (req, res) => send(res, engine.retest(toInt(body(req).session_id, 0, 0))));

  r.get('/scan/results', (req, res) => {
    const sessionId = toInt(req.query.session_id, 0) || null;
    const limit = toInt(req.query.limit, 200, 1, 10000);
    res.json(store.listResults(sessionId, limit).map((row) => store.resultToDict(row, lib.coloName)));
  });

  r.get('/scan/sessions', (req, res) => {
    res.json(store.listSessions(20).map((s) => store.sessionToDict(s)));
  });

  r.get('/scan/logs', (req, res) => {
    const sessionId = toInt(req.query.session_id, 0) || null;
    const limit = toInt(req.query.limit, 100, 1, 10000);
    res.json(store.listLogs(sessionId, limit));
  });

  return r;
}
