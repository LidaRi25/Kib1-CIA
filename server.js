/*
 * KIB1 — CIA Incidentu laboratorija
 * Palaišana: npm install && npm start
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

/* ---------------- .env ---------------- */
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ACCESS_CODE = (process.env.ACCESS_CODE || 'KIB1').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'skolotajs';
const DB_FILE = path.resolve(__dirname, process.env.DB_FILE || 'data/kib1.sqlite');
const ADMIN_TOKEN = crypto.createHmac('sha256', ADMIN_PASSWORD).update('kib1-admin-v1').digest('hex');

const L = require('./content/lesson');
const G = require('./lib/grading');
const { publicContent } = require('./lib/publicContent');
const { openDb } = require('./lib/db');

const now = () => new Date().toISOString();
const normName = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const nameKey = (f, l) => (normName(f) + '|' + normName(l)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const NAME_RE = /^[\p{L}][\p{L}\s'’.-]{0,39}$/u;
const MODULE_IDS = L.MODULES.map((m) => m.id);

function parseJSON(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

async function main() {
  const db = await openDb(DB_FILE);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const getSetting = (k, d) => { const r = db.get('SELECT value FROM settings WHERE key=?', [k]); return r ? r.value : d; };
  const setSetting = (k, v) => db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, String(v)]);
  const unlockAll = () => getSetting('unlock_all', '0') === '1';

  function answersOf(studentId) {
    return db.all('SELECT * FROM answers WHERE student_id=? ORDER BY id', [studentId]).map((r) => ({
      ...r, answer: parseJSON(r.answer_json, {}), detail: parseJSON(r.detail_json, {})
    }));
  }

  /* ---------------- audzēkņa autentifikācija ---------------- */
  function studentAuth(req, res, next) {
    const token = req.get('x-token');
    const s = token && db.get('SELECT s.* FROM sessions x JOIN students s ON s.id=x.student_id WHERE x.token=?', [token]);
    if (!s) return res.status(401).json({ error: 'Sesija beigusies. Lūdzu, pieslēdzies vēlreiz.' });
    req.student = s;
    db.run('UPDATE students SET last_seen=? WHERE id=?', [now(), s.id]);
    next();
  }

  function moduleUnlocked(moduleId, results) {
    if (unlockAll()) return true;
    const idx = MODULE_IDS.indexOf(moduleId);
    for (let i = 0; i < idx; i++) if (!results.modules[i].complete) return false;
    return true;
  }

  app.post('/api/login', (req, res) => {
    const first = normName(req.body.firstName);
    const last = normName(req.body.lastName);
    const code = String(req.body.code || '').trim();
    if (!NAME_RE.test(first) || !NAME_RE.test(last)) return res.status(400).json({ error: 'Ievadi savu īsto vārdu un uzvārdu.' });
    if (code.toUpperCase() !== ACCESS_CODE.toUpperCase()) return res.status(403).json({ error: 'Nepareizs piekļuves kods.' });
    const key = nameKey(first, last);
    let s = db.get('SELECT * FROM students WHERE name_key=?', [key]);
    if (!s) {
      db.run('INSERT INTO students(first_name,last_name,name_key,created_at,last_seen,current_module) VALUES(?,?,?,?,?,?)', [first, last, key, now(), now(), 'learn']);
      s = db.get('SELECT * FROM students WHERE name_key=?', [key]);
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.run('INSERT INTO sessions(token,student_id,created_at) VALUES(?,?,?)', [token, s.id, now()]);
    res.json({ token, resumed: answersOf(s.id).length > 0 });
  });

  app.post('/api/logout', studentAuth, (req, res) => {
    db.run('DELETE FROM sessions WHERE token=?', [req.get('x-token')]);
    res.json({ ok: true });
  });

  app.get('/api/state', studentAuth, (req, res) => {
    const s = req.student;
    const rows = answersOf(s.id);
    const results = G.computeResults(rows);
    const answers = {};
    for (const r of rows) {
      const d = G.effectiveDetail(r);
      answers[r.item_id] = { answer: r.answer, feedback: r.detail.feedback, earned: d.earned, max: d.max, errors: r.detail.errors };
    }
    res.json({
      student: { id: s.id, firstName: s.first_name, lastName: s.last_name },
      content: publicContent,
      answers,
      progress: parseJSON(s.progress_json, {}),
      drafts: parseJSON(s.drafts_json, {}),
      currentModule: s.current_module,
      unlockAll: unlockAll(),
      modules: results.modules,
      finished: results.finished
    });
  });

  app.post('/api/ping', studentAuth, (req, res) => {
    const m = req.body && req.body.module;
    if (MODULE_IDS.includes(m) || m === 'result') db.run('UPDATE students SET current_module=? WHERE id=?', [m, req.student.id]);
    res.json({ ok: true, unlockAll: unlockAll() });
  });

  app.post('/api/progress', studentAuth, (req, res) => {
    const p = parseJSON(req.student.progress_json, {});
    const patch = req.body && typeof req.body.patch === 'object' ? req.body.patch : {};
    for (const [k, v] of Object.entries(patch)) if (/^[a-z0-9_:-]{1,40}$/i.test(k)) p[k] = v;
    const json = JSON.stringify(p);
    if (json.length > 20000) return res.status(400).json({ error: 'Pārāk liels progresa ieraksts.' });
    db.run('UPDATE students SET progress_json=? WHERE id=?', [json, req.student.id]);
    res.json({ ok: true });
  });

  app.post('/api/draft', studentAuth, (req, res) => {
    const d = parseJSON(req.student.drafts_json, {});
    const { key, value } = req.body || {};
    if (!/^[a-z0-9_:-]{1,60}$/i.test(String(key))) return res.status(400).json({ error: 'Nederīga atslēga.' });
    d[key] = value;
    const json = JSON.stringify(d);
    if (json.length > 100000) return res.status(400).json({ error: 'Melnraksts pārāk liels.' });
    db.run('UPDATE students SET drafts_json=? WHERE id=?', [json, req.student.id]);
    res.json({ ok: true });
  });

  app.post('/api/answer', studentAuth, (req, res) => {
    const s = req.student;
    const { itemId, answer } = req.body || {};
    const item = G.REGISTRY.get(itemId);
    if (!item) return res.status(400).json({ error: 'Nezināms jautājums.' });
    const existing = db.get('SELECT * FROM answers WHERE student_id=? AND item_id=?', [s.id, itemId]);
    if (existing) {
      const d = parseJSON(existing.detail_json, {});
      return res.json({ already: true, answer: parseJSON(existing.answer_json, {}), feedback: d.feedback, earned: existing.teacher_score ?? d.earned, max: d.max });
    }
    const results = G.computeResults(answersOf(s.id));
    if (!moduleUnlocked(item.module, results)) return res.status(403).json({ error: 'Šis modulis vēl nav atvērts. Vispirms pabeidz iepriekšējos.' });
    let detail;
    try { detail = G.grade(itemId, answer); } catch (e) {
      if (e instanceof G.ValidationError) return res.status(400).json({ error: e.message });
      throw e;
    }
    // Vai CIA vērtējums mainījās salīdzinājumā ar iepriekšējo laika līnijas soli?
    if (item.type === 'status' && item.stageIndex > 0) {
      const prevId = L.CASES[item.caseId].stages[item.stageIndex - 1].id;
      const prev = db.get('SELECT answer_json FROM answers WHERE student_id=? AND item_id=?', [s.id, prevId]);
      if (prev) {
        const pa = parseJSON(prev.answer_json, {});
        detail.changed = L.EL.filter((e) => pa[e] !== answer[e]);
      }
    }
    db.run('INSERT INTO answers(student_id,item_id,answer_json,detail_json,score,max_score,created_at) VALUES(?,?,?,?,?,?,?)',
      [s.id, itemId, JSON.stringify(answer), JSON.stringify(detail), detail.earned, detail.max, now()]);
    db.run('UPDATE students SET current_module=? WHERE id=?', [item.module, s.id]);
    const after = G.computeResults(answersOf(s.id));
    res.json({ feedback: detail.feedback, earned: detail.earned, max: detail.max, errors: detail.errors, changed: detail.changed || null, modules: after.modules, finished: after.finished });
  });

  app.get('/api/result', studentAuth, (req, res) => {
    const r = G.computeResults(answersOf(req.student.id));
    res.json({
      total: r.total, grade: r.grade, el: r.el, progress: r.progress, finished: r.finished,
      categories: Object.entries(r.categories).map(([id, c]) => ({ id, title: c.title, score: c.score, weight: c.weight, pct: c.pct })),
      feedback: G.personalFeedback(r),
      errors: Object.entries(r.errCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ id: k, text: L.ERROR_TYPES[k], tip: G.ERROR_TIPS[k], n }))
    });
  });

  /* ---------------- pedagogs ---------------- */
  function adminAuth(req, res, next) {
    const t = req.get('x-admin') || req.query.t;
    if (!t || t.length !== ADMIN_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(ADMIN_TOKEN))) {
      return res.status(401).json({ error: 'Nepieciešama pedagoga pieslēgšanās.' });
    }
    next();
  }

  app.post('/api/admin/login', (req, res) => {
    const p = String((req.body && req.body.password) || '');
    if (p !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Nepareiza parole.' });
    res.json({ token: ADMIN_TOKEN });
  });

  function statusText(s, r) {
    if (!s) return { code: 'absent', text: 'Nav pieslēdzies' };
    if (r.finished) return { code: 'done', text: 'Pabeidza' };
    const idle = Date.now() - Date.parse(s.last_seen) > 3 * 60 * 1000;
    const m = L.MODULES.find((x) => x.id === s.current_module);
    if (idle) return { code: 'idle', text: 'Neaktīvs' + (m ? ' · ' + m.short : '') };
    return { code: 'active', text: 'Strādā · ' + (m ? m.short : '') };
  }

  function overview() {
    const students = db.all('SELECT * FROM students ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE');
    const roster = db.all('SELECT * FROM roster ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE');
    const byKey = new Map(students.map((s) => [s.name_key, s]));
    const rows = []; const perStudent = [];
    const used = new Set();
    const makeRow = (s) => {
      const ans = answersOf(s.id);
      const r = G.computeResults(ans);
      perStudent.push({ s, r, ans });
      return {
        id: s.id, name: `${s.first_name} ${s.last_name}`, progress: r.progress, total: r.total, pct: r.total,
        grade: r.answered ? r.grade : null, C: r.el.C, I: r.el.I, A: r.el.A, status: statusText(s, r),
        answered: r.answered, lastSeen: s.last_seen, inRoster: false
      };
    };
    for (const rs of roster) {
      const s = byKey.get(rs.name_key);
      if (s) { used.add(s.id); rows.push({ ...makeRow(s), inRoster: true }); } else {
        rows.push({ id: null, name: `${rs.first_name} ${rs.last_name}`, progress: 0, total: null, pct: null, grade: null, C: null, I: null, A: null, status: statusText(null), inRoster: true });
      }
    }
    for (const s of students) if (!used.has(s.id)) rows.push(makeRow(s));

    const started = perStudent.filter((p) => p.r.answered > 0);
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    const summary = {
      rosterCount: roster.length, loggedIn: students.length, started: started.length,
      finished: perStudent.filter((p) => p.r.finished).length,
      avgScore: avg(started.map((p) => p.r.total)),
      avgGrade: avg(started.map((p) => p.r.grade)),
      avgFinishedScore: avg(perStudent.filter((p) => p.r.finished).map((p) => p.r.total)),
      el: Object.fromEntries(L.EL.map((e) => [e, avg(started.map((p) => p.r.el[e]).filter((x) => x !== null))]))
    };

    // Grūtākie jautājumi
    const stat = new Map();
    const addStat = (id, label, earned, max) => {
      if (!max) return;
      const o = stat.get(id) || { id, label, sum: 0, n: 0 };
      o.sum += earned / max; o.n += 1; stat.set(id, o);
    };
    for (const p of started) {
      for (const row of p.ans) {
        const item = G.REGISTRY.get(row.item_id); if (!item) continue;
        const d = G.effectiveDetail(row);
        if (d.subs) d.subs.forEach((sb) => addStat(sb.id, sb.label, sb.earned, sb.max));
        else addStat(row.item_id, item.label, d.earned, d.max);
      }
    }
    const hardest = [...stat.values()].map((o) => ({ id: o.id, label: o.label, avg: Math.round((o.sum / o.n) * 100), n: o.n }))
      .sort((a, b) => a.avg - b.avg || b.n - a.n).slice(0, 5);

    // Tipiskās kļūdas
    // pct = cik % no atbildēm, kurās šī kļūda bija iespējama, audzēkņi to pieļāva
    const oppN = {}; const errN = {};
    for (const p of started) {
      for (const row of p.ans) {
        (row.detail.opps || []).forEach((o) => { oppN[o] = (oppN[o] || 0) + 1; });
        (row.detail.errors || []).forEach((x) => { errN[x] = (errN[x] || 0) + 1; });
      }
    }
    const errors = Object.entries(L.ERROR_TYPES).map(([id, text]) => {
      const withOpp = started.filter((p) => p.r.opps.includes(id)).length;
      const withErr = started.filter((p) => p.r.errors.includes(id)).length;
      const pct = oppN[id] ? Math.round(((errN[id] || 0) / oppN[id]) * 100) : 0;
      return { id, text, withErr, withOpp, pct, errN: errN[id] || 0, oppN: oppN[id] || 0 };
    }).filter((e) => e.withOpp > 0).sort((a, b) => b.pct - a.pct || b.withErr - a.withErr);
    const topError = errors.find((e) => e.withErr > 0) || null;

    const catAvg = Object.keys(L.CATEGORIES).map((c) => ({
      id: c, title: L.CATEGORIES[c].title, weight: L.CATEGORIES[c].weight,
      avg: avg(started.map((p) => p.r.categories[c].score))
    }));

    return { rows, summary, hardest, errors, topError, catAvg, unlockAll: unlockAll(), accessCode: ACCESS_CODE };
  }

  app.get('/api/admin/overview', adminAuth, (req, res) => res.json(overview()));

  app.get('/api/admin/student/:id', adminAuth, (req, res) => {
    const s = db.get('SELECT * FROM students WHERE id=?', [Number(req.params.id)]);
    if (!s) return res.status(404).json({ error: 'Audzēknis nav atrasts.' });
    const ans = answersOf(s.id);
    const r = G.computeResults(ans);
    const byId = new Map(ans.map((a) => [a.item_id, a]));
    const modules = L.MODULES.map((m) => ({
      id: m.id, title: m.title,
      items: G.moduleItems(m.id).map((id) => {
        const item = G.REGISTRY.get(id); const a = byId.get(id);
        if (!a) return { id, label: item.label, answered: false };
        const d = G.effectiveDetail(a);
        let desc;
        try { desc = G.describe(id, a.answer); } catch { desc = { answer: JSON.stringify(a.answer), correct: '' }; }
        return {
          id, label: item.label, answered: true, earned: d.earned, autoEarned: a.detail.earned, max: d.max,
          teacherScore: a.teacher_score, teacherNote: a.teacher_note, provisional: !!a.detail.provisional,
          errors: (a.detail.errors || []).map((e) => L.ERROR_TYPES[e]), changed: a.detail.changed || null,
          ...desc, at: a.created_at
        };
      })
    }));
    res.json({
      student: { id: s.id, name: `${s.first_name} ${s.last_name}`, created: s.created_at, lastSeen: s.last_seen },
      result: {
        total: r.total, grade: r.grade, el: r.el, progress: r.progress, finished: r.finished,
        categories: Object.entries(r.categories).map(([id, c]) => ({ id, title: c.title, score: c.score, weight: c.weight }))
      },
      errors: Object.entries(r.errCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ text: L.ERROR_TYPES[k], n })),
      feedback: G.personalFeedback(r),
      modules
    });
  });

  app.post('/api/admin/override', adminAuth, (req, res) => {
    const { studentId, itemId, score, note } = req.body || {};
    const a = db.get('SELECT * FROM answers WHERE student_id=? AND item_id=?', [Number(studentId), String(itemId)]);
    if (!a) return res.status(404).json({ error: 'Atbilde nav atrasta.' });
    let val = null;
    if (score !== null && score !== '' && score !== undefined) {
      val = Number(score);
      if (!Number.isFinite(val) || val < 0 || val > a.max_score) return res.status(400).json({ error: `Punktiem jābūt no 0 līdz ${a.max_score}.` });
    }
    db.run('UPDATE answers SET teacher_score=?, teacher_note=? WHERE id=?', [val, note ? String(note).slice(0, 500) : null, a.id]);
    res.json({ ok: true });
  });

  app.post('/api/admin/delete-answer', adminAuth, (req, res) => {
    const { studentId, itemId } = req.body || {};
    db.run('DELETE FROM answers WHERE student_id=? AND item_id=?', [Number(studentId), String(itemId)]);
    res.json({ ok: true });
  });

  app.post('/api/admin/student/:id/reset', adminAuth, (req, res) => {
    const id = Number(req.params.id);
    db.transaction(() => {
      db.run('DELETE FROM answers WHERE student_id=?', [id]);
      db.run("UPDATE students SET progress_json='{}', drafts_json='{}', current_module='learn' WHERE id=?", [id]);
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/student/:id/delete', adminAuth, (req, res) => {
    const id = Number(req.params.id);
    db.transaction(() => {
      db.run('DELETE FROM answers WHERE student_id=?', [id]);
      db.run('DELETE FROM sessions WHERE student_id=?', [id]);
      db.run('DELETE FROM students WHERE id=?', [id]);
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/roster', adminAuth, (req, res) => {
    const text = String((req.body && req.body.text) || '');
    const people = [];
    for (const line of text.split(/\r?\n/)) {
      const parts = normName(line.replace(/[;,\t]+/g, ' ')).split(' ').filter(Boolean);
      if (parts.length < 2) continue;
      const last = parts.pop(); const first = parts.join(' ');
      people.push([first, last]);
    }
    db.transaction(() => {
      db.run('DELETE FROM roster');
      for (const [f, l] of people) db.run('INSERT OR IGNORE INTO roster(first_name,last_name,name_key) VALUES(?,?,?)', [f, l, nameKey(f, l)]);
    });
    res.json({ ok: true, count: people.length });
  });

  app.get('/api/admin/roster', adminAuth, (req, res) => {
    res.json({ text: db.all('SELECT first_name, last_name FROM roster ORDER BY id').map((r) => `${r.first_name} ${r.last_name}`).join('\n') });
  });

  app.post('/api/admin/settings', adminAuth, (req, res) => {
    if (req.body && typeof req.body.unlockAll === 'boolean') setSetting('unlock_all', req.body.unlockAll ? '1' : '0');
    res.json({ ok: true, unlockAll: unlockAll() });
  });

  app.get('/api/admin/export.csv', adminAuth, (req, res) => {
    const o = overview();
    const cats = Object.keys(L.CATEGORIES);
    const head = ['Audzēknis', 'Progress %', 'Punkti', 'Atzīme', 'C %', 'I %', 'A %', 'Statuss', ...cats.map((c) => `${L.CATEGORIES[c].title} (${L.CATEGORIES[c].weight})`)];
    const lines = [head];
    for (const r of o.rows) {
      let catScores = cats.map(() => '');
      if (r.id) {
        const cr = G.computeResults(answersOf(r.id));
        catScores = cats.map((c) => String(cr.categories[c].score).replace('.', ','));
      }
      lines.push([r.name, r.progress, r.total ?? '', r.grade ?? '', r.C ?? '', r.I ?? '', r.A ?? '', r.status.text, ...catScores]);
    }
    const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="kib1-cia-rezultati-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  /* ---------------- statiskie faili ---------------- */
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Nav atrasts.' }));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: 'Servera kļūda. Mēģini vēlreiz.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    const ips = [];
    for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    console.log('');
    console.log('  KIB1 — CIA Incidentu laboratorija darbojas!');
    console.log('  ------------------------------------------------');
    console.log(`  Šajā datorā:        http://localhost:${PORT}`);
    for (const ip of ips) console.log(`  Audzēkņiem:         http://${ip}:${PORT}`);
    console.log(`  Pedagoga panelis:   http://localhost:${PORT}/admin`);
    console.log(`  Piekļuves kods:     ${ACCESS_CODE}`);
    if (!process.env.ADMIN_PASSWORD) console.log('  ! Pedagoga parole ir noklusējuma "skolotajs" — nomaini to failā .env');
    console.log(`  Datubāze:           ${DB_FILE}`);
    console.log('  Apturēt: Ctrl+C');
    console.log('');
  });

  const shutdown = () => {
    try { db.flush(); console.log('Datubāze saglabāta.'); } catch (e) { console.error(e); }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  setInterval(() => { try { db.flush(); } catch (e) { console.error(e.message); } }, 30000).unref();
}

main().catch((e) => { console.error('Neizdevās palaist serveri:', e); process.exit(1); });
