/*
 * Vērtēšanas dzinējs.
 * Katra atbilde tiek novērtēta uz servera. Rezultāts (detail) satur:
 *   earned, max       — punkti (neapstrādāti)
 *   parts             — [{cat, earned, max}] kategoriju punkti (svērumi -> 100 punkti)
 *   el                — { C:[earned,max], I:[..], A:[..] } CIA elementu spriedumi
 *   errors, opps      — tipisko kļūdu tipi (errors ⊆ opps)
 *   subs              — apakšjautājumi (detektīva kartītes) grūtāko jautājumu statistikai
 *   feedback          — ko rādīt audzēknim pēc atbildes
 */
const L = require('../content/lesson');

const EL = L.EL;
const round2 = (n) => Math.round(n * 100) / 100;

/* ------------------------- reģistrs ------------------------- */

function buildRegistry() {
  const reg = new Map();
  const order = [];
  const add = (item) => { reg.set(item.id, item); order.push(item.id); };

  L.FUND_ITEMS.forEach((it) => add({ ...it, module: 'learn', label: it.prompt }));
  L.WARM_ITEMS.forEach((it) => add({ ...it, module: 'warmup', label: 'Iesildīšanās: ' + it.prompt }));

  for (const cid of ['lvm', 'csdd', 'ddos']) {
    const c = L.CASES[cid];
    c.stages.forEach((st, i) => add({
      id: st.id, type: 'status', cat: 'cases', module: cid, caseId: cid, stageIndex: i,
      key: st.key, explain: st.explain, tags: c.tags,
      label: `${c.code} ${c.title}: laika līnija — ${st.time}`
    }));
    c.sources.forEach((s) => add({
      id: s.id, type: 'classify', cat: 'sources', module: cid, caseId: cid,
      key: s.key, explain: s.explain, social: !!s.social, tags: c.tags,
      label: `${c.code} avots (${L.SOURCE_TYPES[s.src]}): “${s.quote.slice(0, 70)}${s.quote.length > 70 ? '…' : ''}”`
    }));
    add({
      id: c.assessment.id, type: 'assessment', cat: 'cases', module: cid, caseId: cid,
      key: c.assessment.key, explain: c.assessment.explain, model: c.assessment.model, tags: c.tags,
      label: `${c.code} ${c.title}: CIA Assessment`
    });
  }

  add({ ...L.COMPARE.table, module: 'compare', label: 'Salīdzinājums: LVM pret CSDD tabula' });
  L.COMPARE.questions.forEach((q) => add({ ...q, module: 'compare', label: 'Salīdzinājums: ' + q.prompt }));

  add({ id: L.DETECTIVE.id, type: 'detective', cat: 'detective', module: 'detective', cards: L.DETECTIVE.cards, label: 'CIA detektīvs' });

  add({ id: L.FINAL.id, type: 'final', cat: 'final', module: 'final', key: L.FINAL.key, explain: L.FINAL.explain,
    model: L.FINAL.model, statements: L.FINAL.statements, label: 'Gala uzdevums: CIA Incident Assessment' });

  return { reg, order };
}

const { reg: REGISTRY, order: ORDER } = buildRegistry();

function evidenceFor(caseId) {
  const c = L.CASES[caseId];
  const list = c.sources.map((s) => ({ id: s.id, src: s.src, text: s.quote, social: !!s.social, illustrative: !!s.illustrative, outlet: s.outlet }));
  (c.extraEvidence || []).forEach((e) => list.push({ id: e.id, src: e.src, text: e.text, social: false, illustrative: false }));
  return list;
}

/* ------------------------- palīgfunkcijas ------------------------- */

function maxOf(item) {
  switch (item.type) {
    case 'single': case 'multi': return 1;
    case 'status': return 3;
    case 'classify': return 2;
    case 'assessment': return 6;
    case 'compare': return 6;
    case 'detective': return item.cards.length;
    case 'final': return 14;
    default: return 0;
  }
}

function catMaxes() {
  const out = {};
  for (const c of Object.keys(L.CATEGORIES)) out[c] = 0;
  for (const id of ORDER) {
    const it = REGISTRY.get(id);
    if (it.type === 'assessment') { out.cases += 3; out.sources += 3; } else out[it.cat] += maxOf(it);
  }
  return out;
}
const CAT_MAX = catMaxes();

function emptyEl() { return { C: [0, 0], I: [0, 0], A: [0, 0] }; }

function setOf(arr) { return new Set((arr || []).filter((x) => EL.includes(x))); }

function jaccard(exp, ans) {
  const union = new Set([...exp, ...ans]);
  if (union.size === 0) return 1;
  let inter = 0;
  for (const e of exp) if (ans.has(e)) inter++;
  return inter / union.size;
}

function elJudgements(el, exp, ans, weight = 1) {
  for (const e of EL) {
    const inE = exp.has(e); const inA = ans.has(e);
    if (inE || inA) { el[e][0] += (inE && inA ? weight : 0); el[e][1] += weight; }
  }
}

// Kļūdu tipi, ko var noteikt no "sagaidāmā" un "atbildētā" C/I/A kopas
function setErrors(exp, ans, tags = []) {
  const opps = new Set(); const errors = new Set();
  const has = (s, e) => s.has(e);
  if (has(exp, 'I') || has(exp, 'A')) {
    opps.add('IA_MIX');
    if ((has(exp, 'I') && !has(ans, 'I') && has(ans, 'A') && !has(exp, 'A')) ||
        (has(exp, 'A') && !has(ans, 'A') && has(ans, 'I') && !has(exp, 'I'))) errors.add('IA_MIX');
  }
  if (has(exp, 'C') || has(exp, 'I')) {
    opps.add('CI_MIX');
    if ((has(exp, 'C') && !has(ans, 'C') && has(ans, 'I') && !has(exp, 'I')) ||
        (has(exp, 'I') && !has(ans, 'I') && has(ans, 'C') && !has(exp, 'C'))) errors.add('CI_MIX');
  }
  if (tags.includes('leak') && !has(exp, 'A')) {
    opps.add('LEAK_AS_A');
    if (has(ans, 'A')) errors.add('LEAK_AS_A');
  }
  if (tags.includes('ransomware') && has(exp, 'A')) {
    opps.add('RANSOM_ONLY_C');
    if (has(ans, 'C') && !has(ans, 'A')) errors.add('RANSOM_ONLY_C');
  }
  if (exp.size < 3) {
    opps.add('ALL_CIA');
    if (ans.size === 3) errors.add('ALL_CIA');
  }
  if (exp.size >= 2) {
    opps.add('MISSED_OVERLAP');
    if (ans.size === 1) errors.add('MISSED_OVERLAP');
  }
  return { opps, errors };
}

function ptsFor(rule, value) {
  if (rule.ok.includes(value)) return 1;
  if ((rule.half || []).includes(value)) return 0.5;
  return 0;
}

function result({ item, earned, parts, el, errors, opps, subs, feedback, extra }) {
  return {
    earned: round2(earned),
    max: maxOf(item),
    parts: parts.map((p) => ({ cat: p.cat, earned: round2(p.earned), max: p.max })),
    el,
    errors: [...(errors || [])],
    opps: [...(opps || [])],
    subs: subs || null,
    feedback,
    ...(extra || {})
  };
}

class ValidationError extends Error {}
const bad = (msg) => { throw new ValidationError(msg); };

/* ------------------------- vērtētāji ------------------------- */

function choiceValues(item) {
  if (item.options === 'CIA') return EL;
  if (item.options === 'TF') return ['T', 'F'];
  return (item.choices || []).map((c) => c[0]);
}

function gradeSingle(item, ans) {
  const choice = ans && ans.choice;
  if (!choiceValues(item).includes(choice)) bad('Izvēlies atbildi.');
  const correct = item.key[0] === choice;
  const earned = correct ? 1 : 0;
  const el = emptyEl();
  let opps = new Set(); let errors = new Set();
  if (item.options === 'CIA') {
    const exp = setOf(item.key); const got = setOf([choice]);
    elJudgements(el, exp, got);
    ({ opps, errors } = setErrors(exp, got, item.tags || []));
  }
  const tags = item.tags || [];
  if (tags.includes('allcia')) { opps.add('ALL_CIA'); if (choice === 'T') errors.add('ALL_CIA'); }
  if (tags.includes('leakA')) { opps.add('LEAK_AS_A'); if (choice === 'CSDD' || choice === 'BOTH') errors.add('LEAK_AS_A'); }
  if (tags.includes('inoev')) { opps.add('I_NO_EVIDENCE'); if (choice !== 'NONE') errors.add('I_NO_EVIDENCE'); }
  return result({
    item, earned, parts: [{ cat: item.cat, earned, max: 1 }], el, errors, opps,
    feedback: { correct, key: item.key, explain: item.explain }
  });
}

function gradeMulti(item, ans) {
  const got = setOf(ans && ans.choices);
  if (got.size === 0) bad('Atzīmē vismaz vienu CIA elementu.');
  const exp = setOf(item.key);
  const earned = jaccard(exp, got);
  const el = emptyEl();
  elJudgements(el, exp, got);
  const { opps, errors } = setErrors(exp, got, item.tags || []);
  return result({
    item, earned, parts: [{ cat: item.cat, earned, max: 1 }], el, errors, opps,
    feedback: { correct: earned === 1, key: item.key, explain: item.explain }
  });
}

function statusErrors(key, ans, tags, opps, errors) {
  for (const e of EL) {
    const rule = key[e]; const v = ans[e];
    const pAllowed = rule.ok.includes('P') || (rule.half || []).includes('P');
    if (!pAllowed) {
      opps.add('OVERCONFIDENT');
      if (v === 'P') errors.add('OVERCONFIDENT');
      if (e === 'I') { opps.add('I_NO_EVIDENCE'); if (v === 'P') errors.add('I_NO_EVIDENCE'); }
      if (e === 'A' && tags.includes('leak')) { opps.add('LEAK_AS_A'); if (v === 'P') errors.add('LEAK_AS_A'); }
    }
    if (rule.ok.length === 1 && rule.ok[0] === 'P') {
      opps.add('UNDERCONFIDENT');
      if (v === 'N') errors.add('UNDERCONFIDENT');
      if (e === 'A' && tags.includes('ransomware')) { opps.add('RANSOM_ONLY_C'); if (v === 'N') errors.add('RANSOM_ONLY_C'); }
    }
  }
}

function validStatus(ans) {
  if (!ans) bad('Novērtē visus trīs CIA elementus.');
  for (const e of EL) if (!['P', 'I', 'N'].includes(ans[e])) bad('Novērtē visus trīs CIA elementus (C, I un A).');
}

function gradeStatus(item, ans) {
  validStatus(ans);
  const el = emptyEl(); let earned = 0; const per = {};
  for (const e of EL) {
    const p = ptsFor(item.key[e], ans[e]);
    per[e] = p; earned += p; el[e] = [p, 1];
  }
  const opps = new Set(); const errors = new Set();
  statusErrors(item.key, ans, item.tags || [], opps, errors);
  return result({
    item, earned, parts: [{ cat: 'cases', earned, max: 3 }], el, errors, opps,
    feedback: { per, key: item.key, explain: item.explain }
  });
}

function gradeClassify(item, ans) {
  const kinds = Object.keys(L.KINDS);
  if (!ans || !kinds.includes(ans.kind)) bad('Izvēlies, kas tas ir: fakts, eksperta interpretācija, pieņēmums vai nav pietiekami pierādījumu.');
  if (!Array.isArray(ans.cia)) bad('Norādi, kuram CIA elementam avots noder (vai “neder CIA vērtējumam”).');
  const kindPts = ptsFor(item.key.kind, ans.kind);
  const required = setOf(item.key.cia); const opt = setOf(item.key.ciaOpt);
  const given = setOf(ans.cia);
  const considered = new Set([...given].filter((e) => !opt.has(e)));
  const ciaPts = jaccard(required, considered);
  const el = emptyEl();
  elJudgements(el, required, considered);
  const opps = new Set(); const errors = new Set();
  if (item.social) {
    opps.add('SOCIAL_AS_FACT');
    if (ans.kind === 'FAKTS' && !item.key.kind.ok.includes('FAKTS')) errors.add('SOCIAL_AS_FACT');
    if (!required.has('I') && !opt.has('I')) { opps.add('I_NO_EVIDENCE'); if (given.has('I')) errors.add('I_NO_EVIDENCE'); }
  }
  if ((item.tags || []).includes('leak') && !required.has('A') && !opt.has('A') && required.has('C')) {
    opps.add('LEAK_AS_A'); if (given.has('A')) errors.add('LEAK_AS_A');
  }
  const earned = kindPts + ciaPts;
  return result({
    item, earned, parts: [{ cat: 'sources', earned, max: 2 }], el, errors, opps,
    feedback: { kindPts, ciaPts, key: item.key, explain: item.explain }
  });
}

function gradeAssessment(item, ans) {
  if (!ans || !ans.ratings || !ans.facts || !ans.text) bad('Aizpildi visu CIA novērtējumu.');
  const evidence = new Set(evidenceFor(item.caseId).map((e) => e.id));
  for (const e of EL) {
    const r = ans.ratings[e];
    if (!Number.isInteger(r) || r < 0 || r > 4) bad(`Norādi ${L.EL_INFO[e].en} novērtējumu 0–4.`);
    if (!Array.isArray(ans.facts[e]) || ans.facts[e].length === 0) bad(`${L.EL_INFO[e].en}: atzīmē vismaz vienu faktu, kas pamato tavu vērtējumu.`);
    if (ans.facts[e].some((f) => !evidence.has(f))) bad('Nederīgs fakts.');
    if (typeof ans.text[e] !== 'string' || ans.text[e].trim().length < 15) bad(`${L.EL_INFO[e].en}: uzraksti pamatojumu (vismaz vienu teikumu).`);
  }
  const k = item.key; const el = emptyEl();
  const ratingPts = {}; const factPts = {}; const badSel = {};
  let rSum = 0; let fSum = 0;
  for (const e of EL) {
    const rp = ptsFor(k.ratings[e], ans.ratings[e]);
    ratingPts[e] = rp; rSum += rp; el[e] = [rp, 1];
    const sel = ans.facts[e];
    const good = sel.filter((f) => k.facts[e].includes(f)).length;
    const bads = sel.filter((f) => k.bad.includes(f));
    badSel[e] = bads;
    const fp = good >= 1 ? (bads.length ? 0.5 : 1) : 0;
    factPts[e] = fp; fSum += fp;
  }
  const opps = new Set(); const errors = new Set();
  const tags = item.tags || [];
  const iRule = k.ratings.I; const iMax = Math.max(...iRule.ok);
  if (iMax <= 1) {
    opps.add('I_NO_EVIDENCE');
    const r = ans.ratings.I;
    if (r > iMax && !(iRule.half || []).includes(r)) errors.add('I_NO_EVIDENCE');
  }
  if (tags.includes('leak')) { opps.add('LEAK_AS_A'); if (ans.ratings.A >= 2) errors.add('LEAK_AS_A'); }
  if (tags.includes('ransomware')) { opps.add('RANSOM_ONLY_C'); if (ans.ratings.A <= 1 && ans.ratings.C >= 2) errors.add('RANSOM_ONLY_C'); }
  if (EL.some((e) => Math.max(...k.ratings[e].ok) <= 1)) {
    opps.add('ALL_CIA');
    if (EL.every((e) => ans.ratings[e] >= 2)) errors.add('ALL_CIA');
  }
  opps.add('SOCIAL_AS_FACT');
  if (EL.some((e) => badSel[e].length)) errors.add('SOCIAL_AS_FACT');
  for (const e of EL) {
    if (Math.min(...k.ratings[e].ok) >= 3) { opps.add('UNDERCONFIDENT'); if (ans.ratings[e] === 0) errors.add('UNDERCONFIDENT'); }
  }
  return result({
    item, earned: rSum + fSum,
    parts: [{ cat: 'cases', earned: rSum, max: 3 }, { cat: 'sources', earned: fSum, max: 3 }],
    el, errors, opps,
    feedback: { ratingPts, factPts, badSel, key: k, explain: item.explain, model: item.model }
  });
}

function gradeCompare(item, ans) {
  if (!ans) bad('Aizpildi tabulu.');
  const el = emptyEl(); let earned = 0; const per = {};
  const opps = new Set(); const errors = new Set();
  for (const cid of item.cases) {
    validStatus(ans[cid]);
    per[cid] = {};
    for (const e of EL) {
      const p = ptsFor(item.key[cid][e], ans[cid][e]);
      per[cid][e] = p; earned += p; el[e][0] += p; el[e][1] += 1;
    }
    statusErrors(item.key[cid], ans[cid], L.CASES[cid].tags, opps, errors);
  }
  return result({
    item, earned, parts: [{ cat: 'cases', earned, max: 6 }], el, errors, opps,
    feedback: { per, key: item.key, explain: item.explain }
  });
}

function binSet(bin) { return setOf(String(bin || '').split('+')); }

function gradeDetective(item, ans) {
  const pl = ans && ans.placements;
  if (!pl) bad('Izvieto visas situācijas.');
  for (const c of item.cards) if (!L.BINS.includes(pl[c.id])) bad('Izvieto visas situācijas pirms pārbaudes.');
  const el = emptyEl(); let earned = 0; const subs = []; const per = {};
  const opps = new Set(); const errors = new Set();
  for (const c of item.cards) {
    const exp = binSet(c.key); const got = binSet(pl[c.id]);
    const p = jaccard(exp, got);
    earned += p; per[c.id] = round2(p);
    elJudgements(el, exp, got);
    const r = setErrors(exp, got, c.tags || []);
    r.opps.forEach((o) => opps.add(o)); r.errors.forEach((x) => errors.add(x));
    subs.push({ id: `${item.id}:${c.id}`, label: 'CIA detektīvs: ' + c.text, earned: round2(p), max: 1 });
  }
  return result({
    item, earned, parts: [{ cat: 'detective', earned, max: item.cards.length }], el, errors, opps, subs,
    feedback: { per, key: Object.fromEntries(item.cards.map((c) => [c.id, c.key])), explain: Object.fromEntries(item.cards.map((c) => [c.id, c.explain])) }
  });
}

const JUSTIFY_WORDS = ['jo', 'tāpēc', 'pierād', 'apstiprin', 'fakt', 'avot', 'nav', 'cert', 'uzņēmum', 'paziņo', 'žurnāl'];
function textPts(t, minFull = 40) {
  const s = String(t || '').trim().toLowerCase();
  if (s.length >= minFull && JUSTIFY_WORDS.some((w) => s.includes(w))) return 1;
  if (s.length >= 15) return 0.5;
  return 0;
}

function gradeFinal(item, ans) {
  if (!ans || !ans.status || !ans.ratings || !ans.text || !ans.statements) bad('Aizpildi visu gala novērtējumu.');
  validStatus(ans.status);
  for (const e of EL) {
    const r = ans.ratings[e];
    if (!Number.isInteger(r) || r < 0 || r > 4) bad(`Norādi ${L.EL_INFO[e].en} novērtējumu 0–4.`);
    if (typeof ans.text[e] !== 'string' || ans.text[e].trim().length < 15) bad(`${L.EL_INFO[e].en}: uzraksti pamatojumu (vismaz vienu teikumu).`);
  }
  for (const s of item.statements) if (!['known', 'unproven'].includes(ans.statements[s.id])) bad('Katram apgalvojumam norādi: droši zināms vai vēl nav pierādīts.');
  if (typeof ans.request !== 'string' || ans.request.trim().length < 10) bad('Uzraksti, kādu papildu informāciju tu pieprasītu.');

  const k = item.key; const el = emptyEl();
  const statusPts = {}; const ratingPts = {}; const textP = {};
  let sSum = 0; let rSum = 0; let tSum = 0;
  for (const e of EL) {
    statusPts[e] = ptsFor(k.status[e], ans.status[e]);
    ratingPts[e] = ptsFor(k.ratings[e], ans.ratings[e]);
    textP[e] = textPts(ans.text[e]);
    sSum += statusPts[e]; rSum += ratingPts[e]; tSum += textP[e];
    el[e] = [statusPts[e] + ratingPts[e], 2];
  }
  const stmtPts = {}; let stSum = 0;
  for (const s of item.statements) { stmtPts[s.id] = ans.statements[s.id] === s.key ? 0.5 : 0; stSum += stmtPts[s.id]; }
  const reqPts = textPts(ans.request, 30);
  const opps = new Set(['OVERCONFIDENT', 'SOCIAL_AS_FACT', 'UNDERCONFIDENT']); const errors = new Set();
  if (ans.status.C === 'P') errors.add('OVERCONFIDENT');
  if (item.statements.some((s) => s.social && ans.statements[s.id] === 'known')) errors.add('SOCIAL_AS_FACT');
  if (ans.status.I === 'N' || ans.status.A === 'N') errors.add('UNDERCONFIDENT');
  opps.add('IA_MIX');
  if (ans.ratings.I <= 1 && ans.ratings.A >= 3) errors.add('IA_MIX');
  const earned = sSum + rSum + stSum + tSum + reqPts;
  return result({
    item, earned, parts: [{ cat: 'final', earned, max: 14 }], el, errors, opps,
    feedback: { statusPts, ratingPts, textPts: textP, stmtPts, reqPts, key: k, explain: item.explain, model: item.model,
      statementsKey: Object.fromEntries(item.statements.map((s) => [s.id, s.key])) },
    extra: { provisional: true }
  });
}

function grade(itemId, ans) {
  const item = REGISTRY.get(itemId);
  if (!item) bad('Nezināms jautājums.');
  switch (item.type) {
    case 'single': return gradeSingle(item, ans);
    case 'multi': return gradeMulti(item, ans);
    case 'status': return gradeStatus(item, ans);
    case 'classify': return gradeClassify(item, ans);
    case 'assessment': return gradeAssessment(item, ans);
    case 'compare': return gradeCompare(item, ans);
    case 'detective': return gradeDetective(item, ans);
    case 'final': return gradeFinal(item, ans);
    default: bad('Nezināms jautājuma tips.');
  }
  return null;
}

/* ------------------------- rezultātu aprēķins ------------------------- */

function gradeFromPercent(p) {
  for (const g of L.GRADE_SCALE) if (p >= g.min) return g.grade;
  return 1;
}

// Pielāgo detail, ja pedagogs ir mainījis punktus
function effectiveDetail(row) {
  const d = row.detail;
  if (row.teacher_score === null || row.teacher_score === undefined) return d;
  const f = d.max > 0 ? Math.max(0, Math.min(1, row.teacher_score / d.max)) : 0;
  return { ...d, earned: row.teacher_score, parts: d.parts.map((p) => ({ ...p, earned: round2(p.max * f) })) };
}

function moduleItems(moduleId) { return ORDER.filter((id) => REGISTRY.get(id).module === moduleId); }

function computeResults(rows) {
  const cats = {};
  for (const c of Object.keys(L.CATEGORIES)) cats[c] = { earned: 0, max: CAT_MAX[c], weight: L.CATEGORIES[c].weight, title: L.CATEGORIES[c].title };
  const el = emptyEl();
  const errCount = {}; const oppSet = new Set(); const errSet = new Set();
  const answered = new Set();
  for (const row of rows) {
    if (!REGISTRY.has(row.item_id)) continue;
    answered.add(row.item_id);
    const d = effectiveDetail(row);
    d.parts.forEach((p) => { cats[p.cat].earned += p.earned; });
    for (const e of EL) { el[e][0] += d.el[e][0]; el[e][1] += d.el[e][1]; }
    (d.opps || []).forEach((o) => oppSet.add(o));
    (d.errors || []).forEach((x) => { errSet.add(x); errCount[x] = (errCount[x] || 0) + 1; });
  }
  let total = 0;
  for (const c of Object.values(cats)) {
    c.score = c.max ? round2((c.earned / c.max) * c.weight) : 0;
    c.pct = c.max ? Math.round((c.earned / c.max) * 100) : 0;
    total += c.score;
  }
  total = Math.round(total);
  const elPct = {};
  for (const e of EL) elPct[e] = el[e][1] ? Math.round((el[e][0] / el[e][1]) * 100) : null;
  const modules = L.MODULES.map((m) => {
    const items = moduleItems(m.id);
    const done = items.filter((id) => answered.has(id)).length;
    return { id: m.id, done, total: items.length, complete: done === items.length };
  });
  return {
    total, grade: gradeFromPercent(total), categories: cats, el: elPct,
    answered: answered.size, totalItems: ORDER.length,
    progress: Math.round((answered.size / ORDER.length) * 100),
    finished: answered.has(L.FINAL.id),
    modules,
    errors: [...errSet], opps: [...oppSet], errCount
  };
}

const ERROR_TIPS = {
  IA_MIX: 'Vēl jāpievērš uzmanība atšķirībai starp Integrity un Availability: I — dati ir izmainīti un tiem nevar uzticēties; A — sistēmu vai datus nevar izmantot.',
  CI_MIX: 'Vēl jāpievērš uzmanība atšķirībai starp Confidentiality un Integrity: C — kāds datus IEGUVA vai REDZĒJA; I — kāds datus IZMAINĪJA.',
  LEAK_AS_A: 'Atceries: datu noplūde ir Confidentiality problēma. Ja sistēma turpina strādāt, Availability nav ietekmēta.',
  RANSOM_ONLY_C: 'Atceries: ransomware, kas nošifrē sistēmas, vienmēr skar Availability. Ja dati arī nozagti — klāt nāk C.',
  ALL_CIA: 'Neklasificē katru uzbrukumu automātiski kā C+I+A. Katram elementam vajag savu faktu.',
  I_NO_EVIDENCE: 'Neizdari secinājumu par Integrity, ja avotos nav pierādījumu par datu izmaiņām. Pareizā atbilde var būt “nav pietiekamu datu”.',
  OVERCONFIDENT: 'Nošķir “Pierādīts” no “Iespējams”: pierādīts ir tikai tas, ko apstiprina uzticams avots.',
  UNDERCONFIDENT: 'Ja uzņēmums vai CERT.LV ietekmi apstiprina, droši atzīmē “Pierādīts”.',
  SOCIAL_AS_FACT: 'Skaļš sociālo tīklu ieraksts nav pierādījums. Izmanto to tikai tad, ja to apstiprina uzticams avots.',
  MISSED_OVERLAP: 'Atceries: vienā incidentā var būt skarti vairāki CIA elementi — pārbaudi katru atsevišķi.'
};

function joinLv(list) {
  return list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' un ' + list[list.length - 1];
}

function personalFeedback(res) {
  const out = [];
  const names = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };
  const strong = EL.filter((e) => res.el[e] !== null && res.el[e] >= 80);
  const weak = EL.filter((e) => res.el[e] !== null && res.el[e] < 70).sort((a, b) => res.el[a] - res.el[b]);
  if (strong.length === 3) out.push('Tu ļoti labi atpazīsti visus trīs CIA elementus.');
  else if (strong.length) out.push(`Tu labi atpazīsti ${joinLv(strong.map((e) => names[e]))} incidentus.`);
  const top = Object.entries(res.errCount).sort((a, b) => b[1] - a[1]);
  if (top.length) out.push(ERROR_TIPS[top[0][0]]);
  if (weak.length && (!top.length || !['IA_MIX', 'CI_MIX'].includes(top[0][0]))) {
    out.push(`Vēl jātrenējas atpazīt ${joinLv(weak.map((e) => names[e]))} ietekmi.`);
  }
  if (top.length > 1 && top[1][1] >= 2) out.push(ERROR_TIPS[top[1][0]]);
  if (!out.length) out.push('Turpini tāpat — vērtē katru CIA elementu atsevišķi un pamato ar faktiem.');
  return out;
}

/* ------------------------- cilvēklasāmi apraksti (pedagogam) ------------------------- */

const ST = L.STATUS;
function fmtStatus(o) { return EL.map((e) => `${e}: ${ST[o[e]] || '—'}`).join(' · '); }
function fmtRule(r) { return r.ok.join(' / ') + (r.half && r.half.length ? ` (½: ${r.half.join('/')})` : ''); }
function choiceLabel(item, v) {
  if (item.options === 'CIA') return v;
  if (item.options === 'TF') return v === 'T' ? 'Patiess' : 'Nepatiess';
  const c = (item.choices || []).find((x) => x[0] === v);
  return c ? c[1] : v;
}

function describe(itemId, ans) {
  const item = REGISTRY.get(itemId);
  const evLabel = (caseId) => {
    const map = Object.fromEntries(evidenceFor(caseId).map((e) => [e.id, e]));
    return (id) => {
      const e = map[id];
      return e ? `[${L.SOURCE_TYPES[e.src]}${e.social ? ' ⚠' : ''}] ${e.text.slice(0, 90)}${e.text.length > 90 ? '…' : ''}` : id;
    };
  };
  switch (item.type) {
    case 'single':
      return { answer: choiceLabel(item, ans.choice), correct: choiceLabel(item, item.key[0]) };
    case 'multi':
      return { answer: (ans.choices || []).join('+'), correct: item.key.join('+') };
    case 'status':
      return { answer: fmtStatus(ans), correct: EL.map((e) => `${e}: ${item.key[e].ok.map((v) => ST[v]).join(' / ')}`).join(' · ') };
    case 'classify':
      return {
        answer: `${L.KINDS[ans.kind]} · CIA: ${ans.cia.length ? ans.cia.join('+') : 'neder CIA vērtējumam'}`,
        correct: `${item.key.kind.ok.map((k) => L.KINDS[k]).join(' / ')} · CIA: ${item.key.cia.length ? item.key.cia.join('+') : 'neder'}${item.key.ciaOpt && item.key.ciaOpt.length ? ` (drīkst arī ${item.key.ciaOpt.join('+')})` : ''}`
      };
    case 'assessment': {
      const lab = evLabel(item.caseId);
      return {
        answer: EL.map((e) => `${e}=${ans.ratings[e]}`).join(', '),
        correct: EL.map((e) => `${e}: ${fmtRule(item.key.ratings[e])}`).join(' · '),
        texts: Object.fromEntries(EL.map((e) => [e, ans.text[e]])),
        facts: Object.fromEntries(EL.map((e) => [e, (ans.facts[e] || []).map(lab)]))
      };
    }
    case 'compare':
      return {
        answer: item.cases.map((c) => `${c.toUpperCase()} — ${fmtStatus(ans[c])}`).join(' | '),
        correct: item.cases.map((c) => `${c.toUpperCase()} — ${EL.map((e) => `${e}: ${ST[item.key[c][e].ok[0]]}`).join(' · ')}`).join(' | ')
      };
    case 'detective': {
      const wrong = item.cards.filter((c) => ans.placements[c.id] !== c.key);
      return {
        answer: `${item.cards.length - wrong.length}/${item.cards.length} precīzi`,
        correct: '',
        list: item.cards.map((c) => ({ text: c.text, answer: ans.placements[c.id], correct: c.key, ok: ans.placements[c.id] === c.key }))
      };
    }
    case 'final':
      return {
        answer: `Statuss: ${fmtStatus(ans.status)} | Vērtējums: ${EL.map((e) => `${e}=${ans.ratings[e]}`).join(', ')}`,
        correct: `Statuss: ${EL.map((e) => `${e}: ${ST[item.key.status[e].ok[0]]}`).join(' · ')} | Vērtējums: ${EL.map((e) => `${e}: ${fmtRule(item.key.ratings[e])}`).join(' · ')}`,
        texts: { ...Object.fromEntries(EL.map((e) => [e, ans.text[e]])), 'Papildu informācija': ans.request },
        list: item.statements.map((s) => ({ text: s.text, answer: ans.statements[s.id] === 'known' ? 'Droši zināms' : 'Nav pierādīts', correct: s.key === 'known' ? 'Droši zināms' : 'Nav pierādīts', ok: ans.statements[s.id] === s.key }))
      };
    default:
      return { answer: JSON.stringify(ans), correct: '' };
  }
}

module.exports = {
  REGISTRY, ORDER, CAT_MAX, grade, computeResults, personalFeedback, describe, evidenceFor,
  moduleItems, ValidationError, ERROR_TIPS, effectiveDetail
};
