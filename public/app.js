/* KIB1 — CIA Incidentu laboratorija · audzēkņa lietotne */
(() => {
  'use strict';

  const TOKEN_KEY = 'kib1_token';
  const S = { token: null, data: null, view: null, sel: {}, ui: {}, timers: [], scrollTo: null };
  try { S.token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* privātais režīms */ }

  const EL = ['C', 'I', 'A'];
  const EL_NAME = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };
  const EL_LV = { C: 'Konfidencialitāte', I: 'Integritāte', A: 'Pieejamība' };
  const EL_Q = {
    C: 'Vai kāds bez tiesībām ieguva informāciju?',
    I: 'Vai dati vai sistēma tika neatļauti mainīti?',
    A: 'Vai sistēmu varēja izmantot?'
  };
  const GUIDE = {
    C: ['Vai neatļauta persona ieguva informāciju?', 'Vai dati tika nopludināti?', 'Vai tika kompromitēti piekļuves dati?'],
    I: ['Vai dati tika mainīti?', 'Vai sistēmas konfigurācija tika mainīta?', 'Vai iespējams uzticēties datu pareizībai?'],
    A: ['Vai sistēma turpināja darboties?', 'Vai pakalpojumi bija nepieejami?', 'Cik ilgi? Cik lietotāju tika ietekmēti?']
  };
  const STARTER = {
    C: 'KONFIDENCIALITĀTE IR / NAV ietekmēta, JO …',
    I: 'INTEGRITĀTE IR / NAV ietekmēta, JO …',
    A: 'PIEEJAMĪBA IR / NAV ietekmēta, JO …'
  };

  /* ================= palīgfunkcijas ================= */

  function h(tag, attrs, ...kids) {
    if (attrs === null || attrs === undefined || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
      if (attrs !== null && attrs !== undefined) kids.unshift(attrs);
      attrs = {};
    }
    const [t, ...cls] = tag.split('.');
    const el = document.createElement(t || 'div');
    if (cls.length) el.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const C = () => S.data.content;
  const A = () => S.data.answers;
  const answered = (id) => !!A()[id];
  const fmt = (n) => (Math.round(n * 100) / 100).toString().replace('.', ',');

  function toast(msg, isErr) {
    const t = h('div.toast' + (isErr ? '.error' : ''), msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isErr ? 5000 : 2500);
  }

  async function api(path, body) {
    const opts = { method: body ? 'POST' : 'GET', headers: {} };
    if (S.token) opts.headers['x-token'] = S.token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opts); } catch (e) { throw new Error('Nav savienojuma ar serveri. Pārbaudi tīklu un mēģini vēlreiz.'); }
    let data = {};
    try { data = await res.json(); } catch (e) { /* tukšs */ }
    if (res.status === 401 && path !== '/api/login') { logout(true); throw new Error(data.error || 'Sesija beigusies.'); }
    if (!res.ok) throw new Error(data.error || 'Kļūda. Mēģini vēlreiz.');
    return data;
  }

  const draftTimers = {};
  function saveDraft(key, value) {
    S.data.drafts[key] = value;
    clearTimeout(draftTimers[key]);
    draftTimers[key] = setTimeout(() => { api('/api/draft', { key, value }).catch(() => {}); }, 700);
  }
  function saveProgress(patch) {
    Object.assign(S.data.progress, patch);
    return api('/api/progress', { patch }).catch(() => {});
  }

  function logout(silent) {
    if (!silent && S.token) api('/api/logout', {}).catch(() => {});
    S.token = null; S.data = null; S.view = null; S.sel = {}; S.ui = {};
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* */ }
    clearTimers();
    renderLogin();
  }

  function clearTimers() { S.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); S.timers = []; if (window.speechSynthesis) speechSynthesis.cancel(); }

  function seededShuffle(arr, seed) {
    const a = arr.slice(); let s = seed || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ================= pieslēgšanās ================= */

  function renderLogin(err) {
    const app = document.getElementById('app');
    const f = h('input', { type: 'text', id: 'fn', autocomplete: 'given-name', maxlength: 40 });
    const l = h('input', { type: 'text', id: 'ln', autocomplete: 'family-name', maxlength: 40 });
    const c = h('input', { type: 'text', id: 'code', autocomplete: 'off', maxlength: 20, placeholder: 'piem. KIB1' });
    const errBox = h('div.err' + (err ? '' : '.hidden'), err || '');
    const btn = h('button.btn.primary', { type: 'submit', style: 'width:100%;margin-top:1.2rem' }, 'Sākt izmeklēšanu →');
    const form = h('form', {
      onsubmit: async (ev) => {
        ev.preventDefault(); btn.disabled = true; errBox.classList.add('hidden');
        try {
          const r = await api('/api/login', { firstName: f.value, lastName: l.value, code: c.value });
          S.token = r.token;
          try { localStorage.setItem(TOKEN_KEY, r.token); } catch (e) { /* */ }
          if (r.resumed) toast('Laipni lūdzam atpakaļ! Tavs progress ir saglabāts.');
          boot();
        } catch (e) { errBox.textContent = e.message; errBox.classList.remove('hidden'); btn.disabled = false; }
      }
    },
    h('label', { for: 'fn' }, 'Vārds'), f,
    h('label', { for: 'ln' }, 'Uzvārds'), l,
    h('label', { for: 'code' }, 'Piekļuves kods'), c,
    errBox, btn);
    app.replaceChildren(h('div.login-wrap', h('div.login',
      h('div.logo', h('span.chip.cia-C', 'C'), h('span.chip.cia-I', 'I'), h('span.chip.cia-A', 'A')),
      h('div.kicker', 'Kiberdrošības tehniķis · 1. kurss'),
      h('h1', 'KIB1 — CIA Incidentu laboratorija'),
      h('p.muted', 'Tu esi Junior Cyber Incident Analyst. Tavs uzdevums — noteikt, kuri CIA principi reālos Latvijas kiberincidentos ir pārkāpti, un pamatot to ar faktiem.'),
      form,
      h('p.faint', { style: 'margin-top:1rem' }, 'Ja pārlādēsi lapu vai aizvērsi pārlūku, pieslēdzies ar to pašu vārdu un uzvārdu — progress saglabājas.')
    )));
    f.focus();
  }

  /* ================= galvenais ietvars ================= */

  async function boot() {
    if (!S.token) return renderLogin();
    try { S.data = await api('/api/state'); } catch (e) {
      if (!S.token) return undefined;
      document.getElementById('app').replaceChildren(h('div.login-wrap', h('div.login', h('h2', 'Nevar ielādēt'), h('p', e.message), h('button.btn.primary', { onclick: boot }, 'Mēģināt vēlreiz'))));
      return undefined;
    }
    S.view = S.view || pickStartView();
    renderApp();
    startPing();
    return undefined;
  }

  function modIndex(id) { return C().modules.findIndex((m) => m.id === id); }
  function isUnlocked(id) {
    if (id === 'result') return S.data.finished;
    if (S.data.unlockAll) return true;
    const i = modIndex(id);
    for (let k = 0; k < i; k++) if (!S.data.modules[k].complete) return false;
    return true;
  }
  function pickStartView() {
    if (S.data.finished) return 'result';
    const cur = S.data.currentModule;
    if (cur && cur !== 'result' && isUnlocked(cur) && !(S.data.modules[modIndex(cur)] || {}).complete) return cur;
    const first = S.data.modules.find((m) => !m.complete && isUnlocked(m.id));
    return first ? first.id : 'learn';
  }

  let pingTimer = null;
  function startPing() {
    clearInterval(pingTimer);
    const ping = () => api('/api/ping', { module: S.view }).then((r) => {
      if (S.data && r.unlockAll !== S.data.unlockAll) { S.data.unlockAll = r.unlockAll; renderSidebar(); }
    }).catch(() => {});
    ping();
    pingTimer = setInterval(ping, 30000);
  }

  function go(view) {
    if (!isUnlocked(view)) { toast('Šis modulis atvērsies, kad pabeigsi iepriekšējos.'); return; }
    S.view = view;
    const sb = document.querySelector('.sidebar'); if (sb) sb.classList.remove('open');
    api('/api/ping', { module: view }).catch(() => {});
    renderApp();
    window.scrollTo(0, 0);
  }

  function rerender() {
    const y = window.scrollY;
    renderApp();
    window.scrollTo(0, y);
    if (S.scrollTo) {
      const el = document.getElementById(S.scrollTo);
      S.scrollTo = null;
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }

  function renderApp() {
    clearTimers();
    const d = S.data;
    const done = d.modules.reduce((a, m) => a + m.done, 0);
    const total = d.modules.reduce((a, m) => a + m.total, 0);
    const pct = Math.round((done / total) * 100);
    const top = h('header.topbar',
      h('button.btn.small.ghost.menu-btn', { onclick: () => document.querySelector('.sidebar').classList.toggle('open'), 'aria-label': 'Izvēlne' }, '☰'),
      h('div.brand', h('span.tag', 'KIB1'), ' — CIA Incidentu laboratorija', h('small', 'JUNIOR CYBER INCIDENT ANALYST')),
      h('div.spacer'),
      h('div.pbar', { title: `Progress: ${pct}%` }, h('span', { style: `width:${pct}%` })),
      h('span.faint', `${pct}%`),
      h('span.who', `${d.student.firstName} ${d.student.lastName}`),
      h('button.btn.small', { onclick: () => { if (confirm('Iziet? Progress ir saglabāts — vari pieslēgties vēlreiz ar to pašu vārdu.')) logout(); } }, 'Iziet')
    );
    const sidebar = h('nav.sidebar');
    const main = h('main.main');
    document.getElementById('app').replaceChildren(top, h('div.shell', sidebar, main));
    renderSidebar();
    const v = S.view;
    if (v === 'learn') viewLearn(main);
    else if (v === 'warmup') viewWarmup(main);
    else if (v === 'lvm' || v === 'csdd' || v === 'ddos') viewCase(main, v);
    else if (v === 'compare') viewCompare(main);
    else if (v === 'detective') viewDetective(main);
    else if (v === 'final') viewFinal(main);
    else if (v === 'result') viewResult(main);
  }

  function renderSidebar() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    const d = S.data;
    const items = C().modules.map((m, i) => {
      const st = d.modules[i];
      const unlocked = isUnlocked(m.id);
      return h('button.nav-item' + (S.view === m.id ? '.active' : '') + (st.complete ? '.done' : '') + (!unlocked ? '.locked' : ''),
        { onclick: () => go(m.id), title: unlocked ? '' : 'Vispirms pabeidz iepriekšējos moduļus' },
        h('span.ico', st.complete ? '✓' : (unlocked ? m.num : '🔒')),
        h('span', m.short, h('span.sub', `${st.done}/${st.total} uzdevumi`)));
    });
    sb.replaceChildren(
      h('h4', 'Izmeklēšanas gaita'),
      ...items,
      h('button.nav-item' + (S.view === 'result' ? '.active' : '') + (!d.finished ? '.locked' : ''),
        { onclick: () => go('result') }, h('span.ico', d.finished ? '★' : '🔒'), h('span', 'Rezultāts', h('span.sub', d.finished ? 'CIA ANALYSIS COMPLETE' : 'pēc gala uzdevuma'))),
      h('div.panel.tight', { style: 'margin-top:1.2rem;font-size:.86rem' },
        h('div.lbl', 'Atgādne'),
        ...EL.map((e) => h('div', { style: 'margin:.3rem 0' }, h('span.chip.cia-' + e, e), ' ', h('b', EL_NAME[e]), h('div.faint', EL_Q[e])))
      )
    );
  }

  function pageHead(kicker, title, sub) {
    return h('div', { style: 'margin-bottom:1.2rem' }, h('div.kicker', kicker), h('h1', title), sub ? h('p.muted', sub) : null);
  }

  function nextModuleButton(curId) {
    const i = modIndex(curId);
    const next = C().modules[i + 1];
    const label = next ? `Tālāk: ${next.title} →` : 'Skatīt rezultātu →';
    const target = next ? next.id : 'result';
    return h('div.row.end', { style: 'margin-top:1.5rem' }, h('button.btn.primary', { onclick: () => go(target) }, label));
  }

  function srcBadge(src, illustrative) {
    return [h('span.badge.' + src, C().SOURCE_TYPES[src] || src), illustrative ? h('span.badge.illu', 'ilustratīvs ieraksts') : null];
  }

  function sourceBlock(b) {
    const social = ['x', 'threads', 'anon', 'telegram'].includes(b.src);
    return h('div.src' + (social ? '.social' : ''),
      h('div.meta', social ? h('span.avatar') : null, ...srcBadge(b.src, b.illustrative), h('span', b.outlet), b.date ? h('span', '· ' + b.date) : null,
        b.url ? h('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'Atvērt avotu ↗') : null),
      h('div.txt', b.text));
  }

  function ptsTag(earned, max) {
    const cls = earned >= max ? 'good' : (earned > 0 ? 'mid' : 'bad');
    return h('span.pts.' + cls, `${fmt(earned)}/${fmt(max)} p.`);
  }

  /* ================= 1. IEMĀCIES CIA ================= */

  function viewLearn(main) {
    main.append(pageHead('Modulis 1', 'Iemācies CIA', 'Trīs principi, ar kuriem kiberdrošības analītiķis novērtē JEBKURU incidentu.'));
    main.append(h('div.cards3', C().cards.map((c) => h('div.ciacard.cia-' + c.el,
      h('div.big', c.el), h('h3', c.title), h('div.lv', c.lv),
      h('blockquote', '“' + c.def + '”'),
      h('div.q', h('b', 'Analītiķa jautājums: '), c.question),
      h('div.lbl', 'Piemēri'),
      h('ul', c.examples.map((x) => h('li', x)))))));

    main.append(h('div.panel', { style: 'margin-top:1.2rem' },
      h('h2', 'Svarīgi: CIA var pārklāties'),
      h('p.muted', 'Incidents ne vienmēr ir tikai C, I vai A. Piemērs — uzbrucējs:'),
      h('div.overlap',
        h('div.step', h('span.chip.cia-C', 'C'), h('div', h('b', '1. Iegūst klientu datubāzi'), h('div.faint', 'kāds bez tiesībām redz datus'))),
        h('div.step', h('span.chip.cia-I', 'I'), h('div', h('b', '2. Izmaina tajā informāciju'), h('div.faint', 'datiem vairs nevar uzticēties'))),
        h('div.step', h('span.chip.cia-A', 'A'), h('div', h('b', '3. Nošifrē serveri'), h('div.faint', 'sistēmu nevar izmantot')))),
      h('p', { style: 'margin-top:.8rem' }, 'Pareizi: ', h('b', 'Confidentiality — JĀ · Integrity — JĀ · Availability — JĀ'), '. Bet tikai tāpēc, ka par KATRU elementu ir fakts.'),
      h('div.lbl', { style: 'margin-top:1rem' }, 'Analītiķa noteikumi'),
      h('ol.rules', C().rules.map((r) => h('li', r)))));

    main.append(h('div.section-title', h('span.num', '✓'), h('h2', 'Pārbaudi sevi')));
    const items = C().fund;
    renderSequence(main, items, (it, i) => questionCard(it, `Jautājums ${i + 1} no ${items.length}`));
    if (items.every((it) => answered(it.id))) main.append(nextModuleButton('learn'));
  }

  function renderSequence(main, items, renderFn) {
    for (let i = 0; i < items.length; i++) {
      main.append(renderFn(items[i], i));
      if (!answered(items[i].id)) break;
    }
  }

  function questionCard(it, numLabel) {
    if (it.type === 'multi') return multiCard(it, numLabel);
    return singleCard(it, numLabel);
  }

  function choiceList(it) {
    if (it.options === 'CIA') return EL.map((e) => [e, e]);
    if (it.options === 'TF') return [['T', 'Patiess'], ['F', 'Nepatiess']];
    return it.choices;
  }

  function singleCard(it, numLabel, big) {
    const a = A()[it.id];
    const card = h('div.q-card' + (a ? '.answered' : ''), { id: 'q-' + it.id });
    if (numLabel) card.append(h('div.q-num', numLabel));
    card.append(h('div.q-prompt' + (big ? '' : ''), it.prompt));
    const pick = async (val, btn) => {
      if (a) return;
      const r = await submitAnswer(it.id, { choice: val }, btn);
      if (r) { S.scrollTo = 'q-' + it.id; rerender(); }
    };
    if (it.options === 'CIA') {
      card.append(h('div.ciabtns', EL.map((e) => {
        const b = h('button.ciabtn.cia-' + e + (a && a.answer.choice === e ? '.sel' : ''), { disabled: !!a },
          h('span.l', e), h('span.n', EL_NAME[e]), h('span.n', { style: 'display:block' }, EL_LV[e]));
        b.addEventListener('click', () => pick(e, b));
        return b;
      })));
    } else {
      const keyVal = a && a.feedback.key[0];
      card.append(h('div', choiceList(it).map(([v, label]) => {
        let cls = '';
        if (a) cls = v === keyVal ? '.right' : (a.answer.choice === v ? '.wrong' : '');
        const b = h('button.choice' + cls, { disabled: !!a }, label);
        b.addEventListener('click', () => pick(v, b));
        return b;
      })));
    }
    if (a) card.append(feedbackSimple(it, a));
    return card;
  }

  function labelFor(it, v) {
    const found = choiceList(it).find((c) => c[0] === v);
    if (it.options === 'CIA') return `${v} — ${EL_NAME[v]}`;
    return found ? found[1] : v;
  }

  function feedbackSimple(it, a) {
    const ok = a.earned >= a.max;
    const mid = !ok && a.earned > 0;
    const keyText = it.type === 'multi' ? a.feedback.key.join(' + ') : labelFor(it, a.feedback.key[0]);
    return h('div.fb.' + (ok ? 'good' : mid ? 'mid' : 'bad'),
      h('div.head', ok ? '✓ Pareizi!' : (mid ? '≈ Daļēji pareizi. ' : '✗ Nepareizi. ') + (ok ? '' : 'Pareizā atbilde: ' + keyText), ' ', ptsTag(a.earned, a.max)),
      h('div', a.feedback.explain));
  }

  function multiCard(it, numLabel) {
    const a = A()[it.id];
    const sel = S.sel[it.id] || (S.sel[it.id] = { choices: [] });
    const card = h('div.q-card', { id: 'q-' + it.id });
    if (numLabel) card.append(h('div.q-num', numLabel));
    card.append(h('div.q-prompt', it.prompt));
    const chosen = a ? a.answer.choices : sel.choices;
    const btns = EL.map((e) => {
      const b = h('button.ciabtn.cia-' + e + (chosen.includes(e) ? '.sel' : ''), { disabled: !!a }, h('span.l', e), h('span.n', EL_NAME[e]));
      b.addEventListener('click', () => {
        const i = sel.choices.indexOf(e);
        if (i >= 0) sel.choices.splice(i, 1); else sel.choices.push(e);
        b.classList.toggle('sel');
      });
      return b;
    });
    card.append(h('div.ciabtns', btns));
    if (!a) {
      const sb = h('button.btn.primary', { style: 'margin-top:1rem' }, 'Apstiprināt');
      sb.addEventListener('click', async () => {
        if (!sel.choices.length) return toast('Atzīmē vismaz vienu elementu.', true);
        const r = await submitAnswer(it.id, { choices: EL.filter((e) => sel.choices.includes(e)) }, sb);
        if (r) { S.scrollTo = 'q-' + it.id; rerender(); }
        return undefined;
      });
      card.append(h('div.faint', { style: 'margin-top:.6rem' }, 'Vari izvēlēties vienu, divus vai visus trīs elementus.'), sb);
    } else card.append(feedbackSimple(it, a));
    return card;
  }

  async function submitAnswer(itemId, answer, btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await api('/api/answer', { itemId, answer });
      A()[itemId] = { answer: r.answer || answer, feedback: r.feedback, earned: r.earned, max: r.max, errors: r.errors || [], changed: r.changed || null };
      if (r.modules) S.data.modules = r.modules;
      if (typeof r.finished === 'boolean') S.data.finished = r.finished;
      delete S.sel[itemId];
      return r;
    } catch (e) {
      toast(e.message, true);
      if (btn) btn.disabled = false;
      return null;
    }
  }

  /* ================= 2. IESILDĪŠANĀS ================= */

  function viewWarmup(main) {
    const items = C().warm;
    main.append(pageHead('Modulis 2', 'Iesildīšanās', 'Ātri: kurš CIA elements ir skarts? Pēc katras atbildes — īss skaidrojums.'));
    const dots = h('div.dots', items.map((it) => {
      const a = A()[it.id];
      return h('span' + (a ? (a.earned >= a.max ? '.ok' : '.no') : ''));
    }));
    main.append(dots);
    // warmShow = situācija, kuras skaidrojumu audzēknis vēl skatās
    const firstOpen = items.find((it) => !answered(it.id));
    let showId = S.ui.warmShow && answered(S.ui.warmShow) ? S.ui.warmShow : null;
    if (!showId && firstOpen) { showId = firstOpen.id; S.ui.warmShow = showId; }
    if (showId) {
      const idx = items.findIndex((it) => it.id === showId);
      const it = items[idx];
      const card = singleCard(it, `Situācija ${idx + 1} no ${items.length}`);
      card.querySelector('.q-prompt').style.fontSize = '1.45rem';
      main.append(card);
      if (answered(it.id)) {
        main.append(h('div.row.end', h('button.btn.primary', {
          onclick: () => { S.ui.warmShow = null; rerender(); }
        }, firstOpen ? 'Nākamā situācija →' : 'Skatīt kopsavilkumu →')));
      }
      return;
    }
    if (items.every((it) => answered(it.id))) {
      const got = items.reduce((s, it) => s + A()[it.id].earned, 0);
      main.append(h('div.panel', h('h2', `Iesildīšanās pabeigta: ${got}/${items.length} pareizi`),
        h('table.list', h('tbody', items.map((it) => {
          const a = A()[it.id];
          return h('tr', h('td', a.earned >= a.max ? '✓' : '✗'), h('td', it.prompt), h('td', h('span.chip.cia-' + a.answer.choice, a.answer.choice)), h('td.faint', a.earned >= a.max ? '' : 'pareizi: ' + a.feedback.key[0]));
        })))));
      main.append(nextModuleButton('warmup'));
    }
  }

  /* ================= 3. CASE FILE ================= */

  function briefPlayer(c) {
    const b = c.briefing;
    const n = b.slides.length; const dur = 7000;
    let idx = 0; let playing = true; let timer = null;
    const screen = h('div.screen');
    const prog = h('div.prog');
    const playBtn = h('button.btn.small', '⏸');
    const wrap = h('div.brief', screen, h('div.controls',
      h('button.btn.small', { onclick: () => { idx = Math.max(0, idx - 1); draw(); }, title: 'Iepriekšējais' }, '⏮'),
      playBtn,
      h('button.btn.small', { onclick: () => { idx = Math.min(n - 1, idx + 1); draw(); }, title: 'Nākamais' }, '⏭'),
      prog,
      h('button.btn.small', { onclick: speak, title: 'Nolasīt balsī (ja pārlūkam ir latviešu balss)' }, '🔊')));
    playBtn.addEventListener('click', () => { playing = !playing; if (playing && idx === n - 1) idx = 0; draw(); });
    function schedule() {
      clearTimeout(timer);
      if (playing && idx < n - 1) { timer = setTimeout(() => { idx++; draw(); }, dur); S.timers.push(timer); } else if (playing) { timer = setTimeout(() => { playing = false; draw(); }, dur); S.timers.push(timer); }
    }
    function draw() {
      const s = b.slides[idx];
      screen.replaceChildren(h('div.live', 'KIB1 ZIŅAS'), h('div.stitle', s.t), h('div.stext', s.text),
        h('div.ticker', `${c.code} · ${c.title} · ${c.org} · ${c.period}`));
      prog.className = 'prog' + (playing ? '' : ' paused');
      prog.style.setProperty('--dur', dur / 1000 + 's');
      prog.replaceChildren(...b.slides.map((_, i) => h('span' + (i < idx ? '.done' : i === idx ? '.cur' : ''), h('i'))));
      if (!playing && idx === n - 1) prog.lastChild.className = 'done';
      playBtn.textContent = playing ? '⏸' : '▶';
      schedule();
    }
    function speak() {
      if (!window.speechSynthesis) return toast('Šis pārlūks neatbalsta balss nolasīšanu.', true);
      const voices = speechSynthesis.getVoices();
      const lv = voices.find((v) => /^lv/i.test(v.lang));
      if (!lv) return toast('Šajā pārlūkā nav latviešu balss — lasi tekstu ekrānā.', true);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(b.slides[idx].t + '. ' + b.slides[idx].text);
      u.voice = lv; u.lang = lv.lang;
      speechSynthesis.speak(u);
      return undefined;
    }
    draw();
    const extra = h('div');
    if (b.video) {
      const vbtn = h('button.btn.small', { style: 'margin-top:.8rem' }, '▶ Skatīt oriģinālo video (nepieciešams internets)');
      vbtn.addEventListener('click', () => {
        vbtn.replaceWith(h('div', h('div.faint', b.video.label), h('div.video', h('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.video.youtube)}`, title: b.video.label,
          allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true
        }))));
      });
      extra.append(vbtn);
    }
    if (b.links && b.links.length) {
      extra.append(h('div.lbl', { style: 'margin-top:.8rem' }, 'Oriģinālie avoti (video un raksti)'),
        h('ul.links', b.links.map((l) => h('li', h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.label)))));
    }
    return h('div', wrap, extra);
  }

  function statusGrid(key, value, disabled, onPick, expected) {
    const g = h('div.sgrid');
    g.append(h('div.hd.first', ''), ...['P', 'I', 'N'].map((s) => h('div.hd', C().STATUS[s])));
    for (const e of EL) {
      g.append(h('div.el.cia-' + e, h('span.chip', e), h('div', h('b', EL_NAME[e]), h('small', EL_Q[e]))));
      for (const s of ['P', 'I', 'N']) {
        const isSel = value[e] === s;
        const exp = expected && expected[e] && expected[e].ok.includes(s);
        const b = h('button.sopt.cia-' + e + (isSel ? '.sel.' + s : '') + (exp ? '.expected' : ''), { disabled, 'data-el': e }, C().STATUS[s]);
        if (!disabled) b.addEventListener('click', () => onPick(e, s));
        g.append(b);
      }
    }
    return g;
  }

  function stageCard(c, st, i) {
    const a = A()[st.id];
    const prevId = i > 0 ? c.stages[i - 1].id : null;
    const card = h('div.tstage', { id: 'st-' + st.id });
    card.append(h('div.time', st.time));
    st.blocks.forEach((b) => card.append(sourceBlock(b)));
    const q = h('div.q-card', { style: 'margin-top:.6rem' });
    if (!a) {
      if (!S.sel[st.id]) S.sel[st.id] = prevId && A()[prevId] ? { ...A()[prevId].answer } : {};
      const sel = S.sel[st.id];
      q.append(h('div.q-prompt', i === 0 ? 'Ko mēs šobrīd varam secināt par CIA?' : 'Parādījās jauna informācija. Vai tava CIA analīze ir mainījusies?'));
      if (i > 0) q.append(h('p.faint', 'Tavs iepriekšējais vērtējums jau ir atzīmēts. Maini tikai to, ko maina jaunie fakti.'));
      const gridWrap = h('div');
      const draw = () => gridWrap.replaceChildren(statusGrid(null, sel, false, (e, s) => { sel[e] = s; draw(); }));
      draw();
      q.append(gridWrap);
      const sb = h('button.btn.primary', { style: 'margin-top:1rem' }, i === 0 ? 'Apstiprināt vērtējumu' : 'Apstiprināt (mainīts vai nemainīts)');
      sb.addEventListener('click', async () => {
        if (!EL.every((e) => sel[e])) return toast('Novērtē visus trīs: C, I un A.', true);
        const r = await submitAnswer(st.id, { C: sel.C, I: sel.I, A: sel.A }, sb);
        if (r) { S.scrollTo = 'fb-' + st.id; rerender(); }
        return undefined;
      });
      q.append(sb);
    } else {
      q.append(h('div.q-prompt', i === 0 ? 'Ko mēs šobrīd varam secināt par CIA?' : 'Vai tava CIA analīze ir mainījusies?'));
      q.append(statusGrid(null, a.answer, true, null, a.feedback.key));
      const fb = h('div.fb.' + (a.earned >= a.max ? 'good' : a.earned > 0 ? 'mid' : 'bad'), { id: 'fb-' + st.id },
        h('div.head', 'Analītiķa skaidrojums ', ptsTag(a.earned, a.max)));
      const prev = prevId && A()[prevId] ? A()[prevId].answer : null;
      if (prev) {
        const changed = EL.filter((e) => prev[e] !== a.answer[e]);
        fb.append(h('p.faint', changed.length ? `Tu mainīji vērtējumu: ${changed.map((e) => `${e} (${C().STATUS[prev[e]]} → ${C().STATUS[a.answer[e]]})`).join(', ')}` : 'Tu nemainīji savu vērtējumu.'));
      }
      for (const e of EL) {
        const p = a.feedback.per[e];
        fb.append(h('div', { style: 'margin:.4rem 0' }, h('span.chip.cia-' + e, e), ' ', h('span.pts.' + (p >= 1 ? 'good' : p > 0 ? 'mid' : 'bad'), p >= 1 ? '✓' : p > 0 ? '½' : '✗'), ' ', a.feedback.explain[e]));
      }
      fb.append(h('div.faint', 'Punktētā līnija rāda sagaidāmo atbildi.'));
      q.append(fb);
    }
    card.append(q);
    return card;
  }

  function classifyCard(s) {
    const a = A()[s.id];
    const K = C().KINDS;
    const card = h('div.q-card', { id: 'q-' + s.id });
    card.append(h('div.meta', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;font-size:.85rem;color:var(--muted)' },
      ...srcBadge(s.src, s.illustrative), h('span', s.outlet), h('span', '· ' + s.date),
      s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, 'Avots ↗') : null));
    card.append(h('div.quote', '“' + s.quote + '”'));
    card.append(h('div.lbl', 'Ko no šī avota vari izmantot CIA novērtējumam?'));
    const sel = a ? { kind: a.answer.kind, cia: a.answer.cia, none: a.answer.cia.length === 0 } : (S.sel[s.id] || (S.sel[s.id] = { kind: null, cia: [], none: false }));
    const body = h('div');
    const draw = () => {
      body.replaceChildren(
        h('div.faint', '1) Kas tas ir?'),
        h('div.kindbtns', Object.keys(K).map((k) => {
          let cls = sel.kind === k ? '.sel' : '';
          if (a) { if (a.feedback.key.kind.ok.includes(k)) cls += '.right'; }
          const b = h('button.kindbtn' + cls, { disabled: !!a, title: C().KIND_HELP[k], style: a && a.feedback.key.kind.ok.includes(k) ? 'border-color:var(--ok)' : '' }, K[k]);
          if (!a) b.addEventListener('click', () => { sel.kind = k; draw(); });
          return b;
        })),
        h('div.faint', '2) Kuru CIA elementu šis avots palīdz novērtēt?'),
        h('div.row', { style: 'margin:.4rem 0 .6rem' },
          ...EL.map((e) => {
            const b = h('button.toggle.cia-' + e + (sel.cia.includes(e) ? '.sel' : ''), { disabled: !!a }, e + ' · ' + EL_NAME[e]);
            if (!a) b.addEventListener('click', () => { const i = sel.cia.indexOf(e); if (i >= 0) sel.cia.splice(i, 1); else sel.cia.push(e); sel.none = false; draw(); });
            return b;
          }),
          (() => {
            const b = h('button.toggle' + (sel.none ? '.sel' : ''), { disabled: !!a }, 'Neder CIA vērtējumam');
            if (!a) b.addEventListener('click', () => { sel.none = !sel.none; if (sel.none) sel.cia = []; draw(); });
            return b;
          })()));
    };
    draw();
    card.append(body);
    if (!a) {
      const sb = h('button.btn.primary.small', 'Apstiprināt');
      sb.addEventListener('click', async () => {
        if (!sel.kind) return toast('Izvēlies, kas tas ir.', true);
        if (!sel.cia.length && !sel.none) return toast('Norādi CIA elementu vai “Neder CIA vērtējumam”.', true);
        const r = await submitAnswer(s.id, { kind: sel.kind, cia: EL.filter((e) => sel.cia.includes(e)) }, sb);
        if (r) { S.scrollTo = 'q-' + s.id; rerender(); }
        return undefined;
      });
      card.append(sb);
    } else {
      const k = a.feedback.key;
      const kindOk = a.feedback.kindPts >= 1; const ciaOk = a.feedback.ciaPts >= 1;
      card.append(h('div.fb.' + (a.earned >= a.max ? 'good' : a.earned > 0 ? 'mid' : 'bad'),
        h('div.head', (kindOk && ciaOk ? '✓ ' : '') + 'Skaidrojums ', ptsTag(a.earned, a.max)),
        h('div.faint', `Veids: ${k.kind.ok.map((x) => K[x]).join(' vai ')} ${kindOk ? '✓' : ''} · CIA: ${k.cia.length ? k.cia.join('+') : 'neder CIA vērtējumam'}${k.ciaOpt && k.ciaOpt.length ? ` (drīkst arī ${k.ciaOpt.join('+')})` : ''} ${ciaOk ? '✓' : ''}`),
        h('div', { style: 'margin-top:.3rem' }, a.feedback.explain)));
    }
    return card;
  }

  function evidenceBadge(ev) { return [h('span.badge.' + ev.src, C().SOURCE_TYPES[ev.src]), ev.illustrative ? h('span.badge.illu', 'ilustratīvs') : null]; }

  function assessmentBlock(c) {
    const aid = c.assessmentId;
    const a = A()[aid];
    const wrap = h('div', { id: 'as-' + aid });
    if (!a) {
      const dkey = 'asel_' + aid;
      const sel = S.sel[aid] || (S.sel[aid] = S.data.drafts[dkey] || { ratings: {}, facts: { C: [], I: [], A: [] } });
      const persist = () => saveDraft(dkey, sel);
      for (const e of EL) {
        const tkey = `txt_${aid}_${e}`;
        const box = h('div.assess.cia-' + e);
        box.append(h('h3', `${EL_NAME[e].toUpperCase()}`), h('div.muted', EL_LV[e]));
        box.append(h('ul.guide', GUIDE[e].map((g) => h('li', g))));
        box.append(h('div.lbl', 'Novērtējums'));
        const rwrap = h('div.ratings');
        const drawR = () => rwrap.replaceChildren(...C().RATING_LABELS.map((lab, r) => {
          const b = h('button.rbtn' + (sel.ratings[e] === r ? '.sel' : ''), h('b', r), h('span', lab.split('— ')[1]));
          b.addEventListener('click', () => { sel.ratings[e] = r; persist(); drawR(); });
          return b;
        }));
        drawR();
        box.append(rwrap);
        box.append(h('div.lbl', 'Kuri fakti pamato tavu vērtējumu? (atzīmē vienu vai vairākus)'));
        box.append(h('div.evlist', c.evidence.map((ev) => {
          const cb = h('input', { type: 'checkbox', checked: sel.facts[e].includes(ev.id) });
          const row = h('label.ev' + (sel.facts[e].includes(ev.id) ? '.sel' : ''), cb, h('div', h('div', ...evidenceBadge(ev)), ev.text));
          cb.addEventListener('change', () => {
            const i = sel.facts[e].indexOf(ev.id);
            if (cb.checked && i < 0) sel.facts[e].push(ev.id);
            if (!cb.checked && i >= 0) sel.facts[e].splice(i, 1);
            row.classList.toggle('sel', cb.checked); persist();
          });
          return row;
        })));
        box.append(h('div.lbl', 'Pamatojums'));
        const ta = h('textarea', { placeholder: STARTER[e], value: S.data.drafts[tkey] || '' });
        ta.addEventListener('input', () => saveDraft(tkey, ta.value));
        box.append(ta);
        wrap.append(box);
      }
      const sb = h('button.btn.primary', 'Iesniegt CIA Assessment');
      sb.addEventListener('click', async () => {
        const text = Object.fromEntries(EL.map((e) => [e, S.data.drafts[`txt_${aid}_${e}`] || '']));
        for (const e of EL) {
          if (sel.ratings[e] === undefined) return toast(`${EL_NAME[e]}: izvēlies novērtējumu 0–4.`, true);
          if (!sel.facts[e].length) return toast(`${EL_NAME[e]}: atzīmē vismaz vienu faktu.`, true);
          if (text[e].trim().length < 15) return toast(`${EL_NAME[e]}: uzraksti pamatojumu (vismaz vienu teikumu).`, true);
        }
        if (!confirm('Iesniegt CIA Assessment? Pēc iesniegšanas atbildes vairs nevarēs mainīt.')) return undefined;
        const r = await submitAnswer(aid, { ratings: sel.ratings, facts: sel.facts, text }, sb);
        if (r) { S.scrollTo = 'as-' + aid; rerender(); }
        return undefined;
      });
      wrap.append(h('div.row.end', sb));
    } else {
      const f = a.feedback;
      wrap.append(h('div.panel.tight', h('b', 'Tavs CIA Assessment ir iesniegts. '), ptsTag(a.earned, a.max)));
      for (const e of EL) {
        const box = h('div.assess.cia-' + e);
        box.append(h('h3', EL_NAME[e].toUpperCase()));
        box.append(h('div.ratings', C().RATING_LABELS.map((lab, r) => h('button.rbtn' + (a.answer.ratings[e] === r ? '.sel' : '') + (f.key.ratings[e].ok.includes(r) ? '.expected' : ''), { disabled: true }, h('b', r), h('span', lab.split('— ')[1])))));
        const rp = f.ratingPts[e]; const fp = f.factPts[e];
        box.append(h('div', h('span.pts.' + (rp >= 1 ? 'good' : rp > 0 ? 'mid' : 'bad'), `Vērtējums ${rp >= 1 ? '✓' : rp > 0 ? '½' : '✗'}`), ' ',
          h('span.pts.' + (fp >= 1 ? 'good' : fp > 0 ? 'mid' : 'bad'), `Fakti ${fp >= 1 ? '✓' : fp > 0 ? '½' : '✗'}`)));
        box.append(h('div.lbl', { style: 'margin-top:.8rem' }, 'Tevis izvēlētie fakti'));
        box.append(h('div.evlist', a.answer.facts[e].map((id) => {
          const ev = c.evidence.find((x) => x.id === id);
          const good = f.key.facts[e].includes(id); const badF = f.key.bad.includes(id);
          return h('div.ev' + (good ? '.good' : badF ? '.bad' : ''), h('span', good ? '✓' : badF ? '⚠' : '·'), h('div', ev ? h('div', ...evidenceBadge(ev)) : null, ev ? ev.text : id,
            badF ? h('div.faint', 'Šis ir nepierādīts apgalvojums — to nevajag izmantot kā pierādījumu.') : null));
        })));
        box.append(h('div.lbl', 'Tavs pamatojums'), h('div.model', { style: 'font-weight:400' }, a.answer.text[e]));
        box.append(h('div.fb.' + (rp >= 1 ? 'good' : rp > 0 ? 'mid' : 'bad'), h('div.head', 'Analītiķa vērtējums'), h('div', f.explain[e]),
          h('div.lbl', { style: 'margin-top:.6rem' }, 'Parauga formulējums'), h('div.model', f.model[e])));
        wrap.append(box);
      }
    }
    return wrap;
  }

  function viewCase(main, cid) {
    const c = C().cases[cid];
    const prog = S.data.progress;
    const mod = C().modules.find((m) => m.id === cid);
    main.append(h('div.case-head', h('div.kicker', `Modulis ${mod.num} · Case File`), h('h1', `${c.code} · ${c.title}`), h('div.muted', `${c.org} · ${c.period}`)));

    main.append(h('div.section-title', h('span.num', 'A'), h('h2', 'Video apskats')));
    main.append(briefPlayer(c));
    if (!prog['brief_' + cid] && !answered(c.stages[0].id)) {
      main.append(h('div.row.end', { style: 'margin-top:1rem' }, h('button.btn.primary', {
        onclick: async () => { await saveProgress({ ['brief_' + cid]: true }); S.scrollTo = 'sec-timeline'; rerender(); }
      }, 'Esmu iepazinies — sākt izmeklēšanu →')));
      return;
    }

    main.append(h('div.section-title', { id: 'sec-timeline' }, h('span.num', 'B'), h('h2', 'Izmeklēšana pa laika līniju')));
    main.append(h('p.muted', 'Informācija parādās pakāpeniski — tāpat kā reālā incidentā. Pēc katra jaunā avota pārvērtē CIA: Pierādīts / Iespējams / Nav pierādījumu.'));
    const tl = h('div.timeline');
    let allStages = true;
    for (let i = 0; i < c.stages.length; i++) {
      tl.append(stageCard(c, c.stages[i], i));
      if (!answered(c.stages[i].id)) { allStages = false; break; }
    }
    main.append(tl);
    if (!allStages) return;

    main.append(h('div.section-title', { id: 'sec-sources' }, h('span.num', 'C'), h('h2', 'Avotu analīze')));
    main.append(h('p.muted', 'Tagad redzi visus avotus vienlaikus. Katram nosaki: kas tas ir un kuram CIA elementam tas der kā pierādījums.'));
    main.append(h('div.legend', Object.keys(C().KINDS).map((k) => h('div', h('b', C().KINDS[k]), C().KIND_HELP[k]))));
    main.append(h('div', { style: 'height:1rem' }));
    main.append(h('div.srcgrid', c.sources.map(classifyCard)));
    if (!c.sources.every((s) => answered(s.id))) return;

    main.append(h('div.section-title', { id: 'sec-assess' }, h('span.num', 'D'), h('h2', 'CIA Assessment')));
    main.append(h('p.muted', 'Galvenais uzdevums. Novērtē katru elementu 0–4, atzīmē faktus, kas to pamato, un uzraksti pamatojumu. 0 nozīmē “nav pierādījumu” — tā ir pilnīgi pareiza atbilde, ja fakti neliecina par ietekmi.'));
    main.append(assessmentBlock(c));
    if (!answered(c.assessmentId)) return;

    const total = [...c.stages.map((s) => s.id), ...c.sources.map((s) => s.id), c.assessmentId].reduce((acc, id) => { acc[0] += A()[id].earned; acc[1] += A()[id].max; return acc; }, [0, 0]);
    main.append(h('div.section-title', h('span.num', '✓'), h('h2', 'Lieta slēgta')));
    main.append(h('div.panel', h('p', `Šajā lietā tu ieguvi ${fmt(total[0])} no ${fmt(total[1])} iespējamiem punktiem.`),
      h('p.muted', 'Atceries galveno: katru CIA elementu vērtē atsevišķi, un tikai pēc faktiem.')));
    main.append(nextModuleButton(cid));
  }

  /* ================= 6. SALĪDZINĀJUMS ================= */

  function viewCompare(main) {
    const cmp = C().compare;
    main.append(pageHead('Modulis 6', 'Salīdzini divus incidentus', 'LATVIJAS VALSTS MEŽI pret CSDD. Aizpildi salīdzinājumu pats — tikai pēc faktiem, ko redzēji lietās.'));
    // atgādne no audzēkņa paša novērtējumiem
    const recap = h('div.srcgrid');
    for (const cid of cmp.table.cases) {
      const c = C().cases[cid]; const a = A()[c.assessmentId];
      recap.append(h('div.panel.tight', h('h3', `${c.code} · ${c.title}`),
        a ? h('div', h('div.faint', 'Tavs CIA Assessment:'), h('div.row', EL.map((e) => h('span', h('span.chip.cia-' + e, e), ' ', a.answer.ratings[e] + '/4')))) : h('div.faint', 'Lieta vēl nav pabeigta.'),
        h('details', { style: 'margin-top:.6rem' }, h('summary', 'Galvenie fakti'),
          h('ul', { style: 'padding-left:1.1rem' }, c.stages.flatMap((st) => st.blocks.filter((b) => !['x', 'threads', 'anon'].includes(b.src)).map((b) => h('li', { style: 'margin:.3rem 0' }, h('b', st.time.split(' · ')[0] + ': '), b.text)))))));
    }
    main.append(recap);

    const t = cmp.table; const a = A()[t.id];
    main.append(h('div.section-title', { id: 'q-' + t.id }, h('span.num', '1'), h('h2', 'Salīdzinājuma tabula')));
    const sel = a ? a.answer : (S.sel[t.id] || (S.sel[t.id] = { lvm: {}, csdd: {} }));
    const tableWrap = h('div.panel');
    const draw = () => {
      const tbl = h('table.ctable', h('thead', h('tr', h('th', ''), ...t.cases.map((cid) => h('th', C().cases[cid].code + ' · ' + C().cases[cid].title)))),
        h('tbody', EL.map((e) => h('tr', h('td.cia-' + e, h('span.chip', e), ' ', h('b', EL_NAME[e])),
          ...t.cases.map((cid) => h('td', h('div.opts', ['P', 'I', 'N'].map((s) => {
            const exp = a && a.feedback.key[cid][e].ok.includes(s);
            const b = h('button.sopt.cia-' + e + (sel[cid][e] === s ? '.sel.' + s : '') + (exp ? '.expected' : ''), { disabled: !!a }, C().STATUS[s]);
            if (!a) b.addEventListener('click', () => { sel[cid][e] = s; draw(); });
            return b;
          }))))))));
      tableWrap.replaceChildren(tbl);
      if (!a) {
        const sb = h('button.btn.primary', { style: 'margin-top:.8rem' }, 'Apstiprināt salīdzinājumu');
        sb.addEventListener('click', async () => {
          if (!t.cases.every((cid) => EL.every((e) => sel[cid][e]))) return toast('Aizpildi visas 6 šūnas.', true);
          const r = await submitAnswer(t.id, sel, sb);
          if (r) { S.scrollTo = 'q-' + t.id; rerender(); }
          return undefined;
        });
        tableWrap.append(sb);
      } else {
        const fb = h('div.fb.' + (a.earned >= a.max ? 'good' : a.earned > 0 ? 'mid' : 'bad'), h('div.head', 'Skaidrojums ', ptsTag(a.earned, a.max)));
        for (const cid of t.cases) for (const e of EL) {
          const p = a.feedback.per[cid][e];
          fb.append(h('div', { style: 'margin:.3rem 0' }, h('b', C().cases[cid].title + ' '), h('span.chip.cia-' + e, e), ' ', p >= 1 ? '✓ ' : p > 0 ? '½ ' : '✗ ', a.feedback.explain[cid][e]));
        }
        tableWrap.append(fb);
      }
    };
    draw();
    main.append(tableWrap);
    if (!a) return;

    main.append(h('div.section-title', h('span.num', '2'), h('h2', 'Jautājumi')));
    renderSequence(main, cmp.questions, (q, i) => singleCard(q, `Jautājums ${i + 1} no ${cmp.questions.length}`));
    if (cmp.questions.every((q) => answered(q.id))) {
      main.append(h('div.note', h('b', 'Galvenā atziņa: '), 'Nedrīkst “izdomāt” Integrity pārkāpumu tikai tāpēc, ka noticis kiberuzbrukums. Ja nav pierādījumu, pareizā atbilde ir “NAV PIETIEKAMU DATU”.'));
      main.append(nextModuleButton('compare'));
    }
  }

  /* ================= 7. CIA DETEKTĪVS ================= */

  function viewDetective(main) {
    const det = C().detective; const bins = C().BINS;
    const a = A()[det.id];
    main.append(pageHead('Modulis 7', 'CIA detektīvs', `Ievelc katru situāciju pareizajā grozā (${det.cards.length} situācijas). Datorā vari vilkt ar peli; telefonā — pieskaries kartītei un tad grozam.`));
    const order = seededShuffle(det.cards, S.data.student.id * 7919 + 13);
    if (a) {
      const f = a.feedback;
      const good = det.cards.filter((c) => a.answer.placements[c.id] === f.key[c.id]).length;
      main.append(h('div.panel', h('h2', `Rezultāts: ${good}/${det.cards.length} precīzi `), ptsTag(a.earned, a.max),
        h('p.faint', 'Daļēji punkti tiek doti, ja daļa CIA elementu ir pareizi (piem., C+A vietā tikai C).')));
      main.append(h('div.bins', bins.map((bin) => h('div.bin', h('div.bh', ...bin.split('+').map((e) => h('span.chip.cia-' + e, e))),
        ...order.filter((c) => a.answer.placements[c.id] === bin).map((c) => {
          const ok = f.key[c.id] === bin;
          return h('div.dcard.' + (ok ? 'ok' : 'no'), (ok ? '✓ ' : '✗ ') + c.text,
            h('span.exp', ok ? f.explain[c.id] : `Pareizi: ${f.key[c.id]} — ${f.explain[c.id]}`));
        })))));
      main.append(nextModuleButton('detective'));
      return;
    }
    const pl = S.sel.det || (S.sel.det = { ...(S.data.drafts.det || {}) });
    const persist = () => saveDraft('det', pl);
    const place = (cardId, bin) => {
      if (bin) pl[cardId] = bin; else delete pl[cardId];
      S.ui.detSel = null; persist(); rerender();
    };
    const cardEl = (c) => {
      const el = h('div.dcard' + (S.ui.detSel === c.id ? '.sel' : ''), { draggable: 'true' }, c.text);
      el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', c.id); ev.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Ja cita kartīte jau izvēlēta un šī atrodas grozā — ieliekam izvēlēto tajā pašā grozā
        if (S.ui.detSel && S.ui.detSel !== c.id && pl[c.id]) { place(S.ui.detSel, pl[c.id]); return; }
        S.ui.detSel = S.ui.detSel === c.id ? null : c.id; rerender();
      });
      return el;
    };
    const dropZone = (el, bin) => {
      el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', (ev) => { ev.preventDefault(); el.classList.remove('over'); const id = ev.dataTransfer.getData('text/plain'); if (id) place(id, bin); });
      el.addEventListener('click', () => { if (S.ui.detSel) place(S.ui.detSel, bin); });
    };
    const unplaced = order.filter((c) => !pl[c.id]);
    const pool = h('div.pool' + (S.ui.detSel ? '.target' : ''), unplaced.length ? unplaced.map(cardEl) : h('div.faint', 'Visas situācijas izvietotas. Vari tās pārvietot vai spiest “Pārbaudīt”.'));
    dropZone(pool, null);
    main.append(h('div.lbl', `Situācijas (${unplaced.length} atlikušas)`), pool);
    main.append(h('div.bins', bins.map((bin) => {
      const el = h('div.bin' + (S.ui.detSel ? '.target' : ''), h('div.bh', ...bin.split('+').map((e) => h('span.chip.cia-' + e, e))),
        ...order.filter((c) => pl[c.id] === bin).map(cardEl));
      dropZone(el, bin);
      return el;
    })));
    const sb = h('button.btn.primary', { disabled: unplaced.length > 0 }, unplaced.length ? `Izvieto vēl ${unplaced.length}` : 'Pārbaudīt');
    sb.addEventListener('click', async () => {
      if (!confirm('Pārbaudīt? Pēc tam izvietojumu vairs nevarēs mainīt.')) return;
      const r = await submitAnswer(det.id, { placements: pl }, sb);
      if (r) { delete S.sel.det; window.scrollTo(0, 0); rerender(); }
    });
    main.append(h('div.row.end', { style: 'margin-top:1rem' }, sb));
  }

  /* ================= 8. GALA UZDEVUMS ================= */

  function viewFinal(main) {
    const f = C().final; const a = A()[f.id];
    main.append(pageHead('Modulis 8 · Gala uzdevums', 'CIA INCIDENT ASSESSMENT', 'Jauns, iepriekš neredzēts incidents. Tagad tu esi analītiķis — neviens vairs nepasaka, kas ir pareizi, kamēr neiesniedz.'));
    main.append(h('div.case-head', h('div.kicker', 'Case File'), h('h1', f.title), h('div.warn', f.note), h('p', f.intro)));
    main.append(h('div.lbl', 'Pieejamā informācija'));
    f.blocks.forEach((b) => main.append(sourceBlock(b)));

    if (a) return finalFeedback(main, f, a);

    const dkey = 'fin_sel';
    const sel = S.sel.final || (S.sel.final = S.data.drafts[dkey] || { status: {}, ratings: {}, statements: {} });
    const persist = () => saveDraft(dkey, sel);

    main.append(h('div.section-title', h('span.num', '1'), h('h2', 'Kas ir droši zināms? Kas vēl nav pierādīts?')));
    const stWrap = h('div.panel');
    const drawSt = () => stWrap.replaceChildren(h('table.list', h('tbody', f.statements.map((s) => h('tr', h('td', s.text),
      h('td', { style: 'white-space:nowrap' }, ...[['known', 'Droši zināms'], ['unproven', 'Vēl nav pierādīts']].map(([v, l]) => {
        const b = h('button.toggle' + (sel.statements[s.id] === v ? '.sel' : ''), { style: 'margin:.15rem' }, l);
        b.addEventListener('click', () => { sel.statements[s.id] = v; persist(); drawSt(); });
        return b;
      })))))));
    drawSt();
    main.append(stWrap);

    main.append(h('div.section-title', h('span.num', '2'), h('h2', 'CIA novērtējums')));
    for (const e of EL) {
      const box = h('div.assess.cia-' + e);
      box.append(h('h3', EL_NAME[e].toUpperCase() + ':'), h('div.muted', EL_LV[e]), h('ul.guide', GUIDE[e].map((g) => h('li', g))));
      box.append(h('div.lbl', 'Statuss'));
      const sw = h('div.row', { style: 'margin-bottom:.8rem' });
      const drawS = () => sw.replaceChildren(...['P', 'I', 'N'].map((s) => {
        const b = h('button.toggle.cia-' + e + (sel.status[e] === s ? '.sel' : ''), C().STATUS[s]);
        b.addEventListener('click', () => { sel.status[e] = s; persist(); drawS(); });
        return b;
      }));
      drawS();
      box.append(sw, h('div.lbl', 'Novērtējums 0–4'));
      const rw = h('div.ratings');
      const drawR = () => rw.replaceChildren(...C().RATING_LABELS.map((lab, r) => {
        const b = h('button.rbtn' + (sel.ratings[e] === r ? '.sel' : ''), h('b', r), h('span', lab.split('— ')[1]));
        b.addEventListener('click', () => { sel.ratings[e] = r; persist(); drawR(); });
        return b;
      }));
      drawR();
      box.append(rw, h('div.lbl', 'Pamatojums'));
      const tkey = 'fin_txt_' + e;
      const ta = h('textarea', { placeholder: STARTER[e], value: S.data.drafts[tkey] || '' });
      ta.addEventListener('input', () => saveDraft(tkey, ta.value));
      box.append(ta);
      main.append(box);
    }

    main.append(h('div.section-title', h('span.num', '3'), h('h2', 'Kādu papildu informāciju tu pieprasītu?')));
    const req = h('textarea', { placeholder: 'Piemēram: kādus žurnālfailus, no kā, lai pierādītu vai izslēgtu…', value: S.data.drafts.fin_req || '' });
    req.addEventListener('input', () => saveDraft('fin_req', req.value));
    main.append(req);

    const sb = h('button.btn.primary', { style: 'margin-top:1.2rem' }, 'Iesniegt gala novērtējumu');
    sb.addEventListener('click', async () => {
      const text = Object.fromEntries(EL.map((e) => [e, S.data.drafts['fin_txt_' + e] || '']));
      if (!f.statements.every((s) => sel.statements[s.id])) return toast('Katram apgalvojumam norādi: droši zināms vai vēl nav pierādīts.', true);
      for (const e of EL) {
        if (!sel.status[e]) return toast(`${EL_NAME[e]}: izvēlies statusu.`, true);
        if (sel.ratings[e] === undefined) return toast(`${EL_NAME[e]}: izvēlies novērtējumu 0–4.`, true);
        if (text[e].trim().length < 15) return toast(`${EL_NAME[e]}: uzraksti pamatojumu.`, true);
      }
      if ((S.data.drafts.fin_req || '').trim().length < 10) return toast('Uzraksti, kādu papildu informāciju tu pieprasītu.', true);
      if (!confirm('Iesniegt gala novērtējumu? Pēc iesniegšanas to vairs nevarēs mainīt.')) return undefined;
      const r = await submitAnswer(f.id, { status: sel.status, ratings: sel.ratings, statements: sel.statements, text, request: S.data.drafts.fin_req }, sb);
      if (r) { window.scrollTo(0, 0); rerender(); }
      return undefined;
    });
    main.append(h('div.row.end', sb));
    return undefined;
  }

  function finalFeedback(main, f, a) {
    const fb = a.feedback;
    main.append(h('div.panel', h('h2', 'Gala novērtējums iesniegts '), ptsTag(a.earned, a.max),
      h('p.faint', 'Pamatojuma teksta punkti ir provizoriski — pedagogs tos var pārskatīt.')));
    main.append(h('div.panel', h('h3', 'Droši zināms / nav pierādīts'), h('table.list', h('tbody', f.statements.map((s) => {
      const ok = a.answer.statements[s.id] === fb.statementsKey[s.id];
      return h('tr', h('td', ok ? '✓' : '✗'), h('td', s.text), h('td.faint', fb.statementsKey[s.id] === 'known' ? 'Droši zināms' : 'Nav pierādīts'));
    })))));
    for (const e of EL) {
      const box = h('div.assess.cia-' + e);
      const sp = fb.statusPts[e]; const rp = fb.ratingPts[e];
      box.append(h('h3', EL_NAME[e].toUpperCase()),
        h('div', 'Tavs statuss: ', h('b', C().STATUS[a.answer.status[e]]), ' ', h('span.pts.' + (sp >= 1 ? 'good' : sp > 0 ? 'mid' : 'bad'), sp >= 1 ? '✓' : sp > 0 ? '½' : '✗'),
          ' · Tavs vērtējums: ', h('b', a.answer.ratings[e]), ' ', h('span.pts.' + (rp >= 1 ? 'good' : rp > 0 ? 'mid' : 'bad'), rp >= 1 ? '✓' : rp > 0 ? '½' : '✗')),
        h('div.lbl', { style: 'margin-top:.6rem' }, 'Tavs pamatojums'), h('div.model', { style: 'font-weight:400' }, a.answer.text[e]),
        h('div.fb.' + (sp + rp >= 2 ? 'good' : sp + rp > 0 ? 'mid' : 'bad'), h('div.head', 'Analītiķa vērtējums'), fb.explain[e],
          h('div.lbl', { style: 'margin-top:.6rem' }, 'Parauga formulējums'), h('div.model', fb.model[e])));
      main.append(box);
    }
    main.append(h('div.panel', h('div.lbl', 'Tavs papildu informācijas pieprasījums'), h('div', a.answer.request),
      h('p.faint', { style: 'margin-top:.6rem' }, 'Labs pieprasījums, piemēram: rēķinu sistēmas un datubāzes žurnālfaili (vai bija datu eksports?), kad un kā uzbrucējs piekļuva, kuri konti izmantoti, vai Telegram kanāla “paraugdati” ir īsti.')));
    main.append(h('div.row.end', h('button.btn.primary', { onclick: () => go('result') }, 'Skatīt rezultātu →')));
  }

  /* ================= REZULTĀTS ================= */

  function viewResult(main) {
    const box = h('div', h('p.muted', 'Aprēķina rezultātu…'));
    main.append(box);
    api('/api/result').then((r) => {
      const hero = h('div.result-hero',
        h('div.title', r.finished ? 'CIA ANALYSIS COMPLETE' : 'STARPREZULTĀTS'),
        h('div.score', `${r.total}/100`),
        h('div.grade', `Atzīme: ${r.grade}`),
        h('div.faint', `${S.data.student.firstName} ${S.data.student.lastName}`));
      const bars = h('div.panel', h('h2', 'Tavs CIA profils'), h('div.elbars', EL.map((e) => h('div.elbar.cia-' + e,
        h('div.top', h('span', h('span.chip', e), ' ', EL_NAME[e]), h('span', r.el[e] === null ? '—' : r.el[e] + '%')),
        h('div.bar', h('i', { style: `width:${r.el[e] || 0}%` }))))));
      const fbk = h('div.panel', h('h2', 'Atgriezeniskā saite'), ...r.feedback.map((t) => h('p', '“' + t + '”')));
      const cats = h('div.panel', h('h2', 'Punkti pa daļām'), h('table.list', h('thead', h('tr', h('th', 'Daļa'), h('th', 'Punkti'))),
        h('tbody', r.categories.map((c) => h('tr', h('td', c.title), h('td', `${fmt(c.score)} / ${c.weight}`))))));
      const errs = r.errors.length ? h('div.panel', h('h2', 'Kam pievērst uzmanību'), h('ul', r.errors.slice(0, 4).map((e) => h('li', { style: 'margin:.4rem 0' }, h('b', e.tip), h('div.faint', `Tu ${e.text} (${e.n}×)`))))) : null;
      const remind = h('div.note', h('b', 'Analītiķa formula: '), '“KONFIDENCIALITĀTE / INTEGRITĀTE / PIEEJAMĪBA IR / NAV ietekmēta, JO …” — vai: “Šobrīd mums nav pietiekami daudz pierādījumu, lai par šo CIA elementu izdarītu secinājumu.”');
      box.replaceChildren(hero, bars, fbk, cats, errs || '', remind);
    }).catch((e) => box.replaceChildren(h('div.err', e.message)));
  }

  boot();
})();
