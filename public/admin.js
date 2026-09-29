/* KIB1 — CIA Incidentu laboratorija · pedagoga panelis */
(() => {
  'use strict';
  const KEY = 'kib1_admin';
  const S = { token: null, tab: 'students', data: null, detail: null, sort: { col: 'name', dir: 1 }, timer: null };
  try { S.token = sessionStorage.getItem(KEY); } catch (e) { /* */ }
  const EL = ['C', 'I', 'A'];
  const EL_NAME = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };

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
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const fmt = (n) => (n === null || n === undefined ? '—' : (Math.round(n * 100) / 100).toString().replace('.', ','));
  const pctCls = (p) => (p === null || p === undefined ? '' : p < 60 ? 'pct-low' : p < 80 ? 'pct-mid' : 'pct-hi');
  function toast(msg, isErr) {
    const t = h('div.toast' + (isErr ? '.error' : ''), msg);
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
  }

  async function api(path, body) {
    const opts = { method: body ? 'POST' : 'GET', headers: {} };
    if (S.token) opts.headers['x-admin'] = S.token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opts); } catch (e) { throw new Error('Nav savienojuma ar serveri.'); }
    let data = {}; try { data = await res.json(); } catch (e) { /* */ }
    if (res.status === 401) { S.token = null; try { sessionStorage.removeItem(KEY); } catch (e) { /* */ } renderLogin(); throw new Error('Nepieciešama pieslēgšanās'); }
    if (!res.ok) throw new Error(data.error || 'Kļūda');
    return data;
  }

  function renderLogin(err) {
    clearInterval(S.timer);
    const p = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password' });
    const eb = h('div.err' + (err ? '' : '.hidden'), err || '');
    const form = h('form', {
      onsubmit: async (ev) => {
        ev.preventDefault();
        try {
          const r = await api('/api/admin/login', { password: p.value });
          S.token = r.token; try { sessionStorage.setItem(KEY, r.token); } catch (e) { /* */ }
          start();
        } catch (e) { eb.textContent = e.message; eb.classList.remove('hidden'); }
      }
    }, h('label', { for: 'pw' }, 'Pedagoga parole'), p, eb, h('button.btn.primary', { type: 'submit', style: 'width:100%;margin-top:1rem' }, 'Ieiet'));
    document.getElementById('app').replaceChildren(h('div.login-wrap', h('div.login',
      h('div.kicker', 'KIB1 — CIA Incidentu laboratorija'), h('h1', 'Pedagoga panelis'),
      h('p.muted', 'Parole ir norādīta failā .env (ADMIN_PASSWORD). Noklusējums: skolotajs'), form)));
    p.focus();
  }

  async function load() {
    try { S.data = await api('/api/admin/overview'); render(); } catch (e) { if (S.token) toast(e.message, true); }
  }
  function start() {
    load();
    clearInterval(S.timer);
    S.timer = setInterval(() => { if (!S.detail && S.tab !== 'settings' && !document.hidden) load(); }, 10000);
  }

  function shell(content) {
    const top = h('header.topbar',
      h('div.brand', h('span.tag', 'KIB1'), ' — Pedagoga panelis', h('small', 'CIA INCIDENTU LABORATORIJA')),
      h('div.spacer'),
      S.data ? h('span.who', 'Piekļuves kods: ', h('b.mono', S.data.accessCode)) : null,
      h('a.btn.small', { href: '/api/admin/export.csv?t=' + encodeURIComponent(S.token) }, '⬇ CSV'),
      h('button.btn.small', { onclick: load }, '⟳ Atjaunot'),
      h('button.btn.small', { onclick: () => { S.token = null; try { sessionStorage.removeItem(KEY); } catch (e) { /* */ } renderLogin(); } }, 'Iziet'));
    document.getElementById('app').replaceChildren(top, h('main.main', { style: 'max-width:1300px;margin:0 auto' }, content));
  }

  function render() {
    if (S.detail) return renderDetail();
    const d = S.data; const s = d.summary;
    const kpis = h('div.kpis',
      kpi(`${s.loggedIn}${s.rosterCount ? ' / ' + s.rosterCount : ''}`, 'Pieslēgušies audzēkņi'),
      kpi(s.finished, 'Pabeiguši visu darbu'),
      kpi(s.avgScore === null ? '—' : fmt(s.avgScore), 'Vidējais rezultāts (no 100)'),
      kpi(s.avgGrade === null ? '—' : fmt(s.avgGrade), 'Vidējā atzīme'),
      ...EL.map((e) => kpi(s.el[e] === null ? '—' : fmt(s.el[e]) + '%', `Vidēji ${e} — ${EL_NAME[e]}`, 'cia-' + e)));
    const tabs = h('div.tabs', ...[['students', 'Audzēkņi'], ['class', 'Klases kopsavilkums un kļūdas'], ['settings', 'Iestatījumi']].map(([id, l]) =>
      h('button.btn' + (S.tab === id ? '.on' : ''), { onclick: () => { S.tab = id; render(); } }, l)));
    let body;
    if (S.tab === 'students') body = studentsTable();
    else if (S.tab === 'class') body = classView();
    else body = settingsView();
    shell([kpis, tabs, body]);
    return undefined;
  }

  function kpi(v, k, cls) {
    return h('div.kpi' + (cls ? '.' + cls : ''), h('div.v', { style: cls ? 'color:var(--el)' : '' }, v), h('div.k', k));
  }

  function studentsTable() {
    const cols = [
      ['name', 'Audzēknis'], ['progress', 'Progress'], ['total', 'Punkti'], ['pct', '%'], ['grade', 'Atzīme'],
      ['C', 'C %'], ['I', 'I %'], ['A', 'A %'], ['status', 'Statuss']
    ];
    const rows = S.data.rows.slice();
    const { col, dir } = S.sort;
    rows.sort((a, b) => {
      let x = col === 'status' ? a.status.text : a[col]; let y = col === 'status' ? b.status.text : b[col];
      if (x === null || x === undefined) x = col === 'name' ? '' : -1;
      if (y === null || y === undefined) y = col === 'name' ? '' : -1;
      if (typeof x === 'string') return x.localeCompare(y, 'lv') * dir;
      return (x - y) * dir;
    });
    if (!rows.length) {
      return h('div.panel', h('h3', 'Vēl neviens audzēknis nav pieslēdzies.'),
        h('p.muted', `Audzēkņi atver adresi, ko rāda servera logs (piem. http://<datora-IP>:3000), un ievada vārdu, uzvārdu un kodu ${S.data.accessCode}.`),
        h('p.muted', 'Iestatījumos vari ievadīt klases sarakstu — tad šeit uzreiz redzēsi visus audzēkņus, arī tos, kas vēl nav pieslēgušies.'));
    }
    return h('div.wrapx', h('table.stable',
      h('thead', h('tr', cols.map(([id, l]) => h('th', { onclick: () => { S.sort = { col: id, dir: S.sort.col === id ? -S.sort.dir : (id === 'name' ? 1 : -1) }; render(); } }, l + (col === id ? (dir > 0 ? ' ▲' : ' ▼') : ''))))),
      h('tbody', rows.map((r) => h('tr' + (r.id ? '.click' : ''), { onclick: r.id ? () => openDetail(r.id) : null },
        h('td', h('b', r.name), r.inRoster ? '' : h('span.faint', ' (nav sarakstā)')),
        h('td', h('span.mini', h('i', { style: `width:${r.progress}%` })), r.progress + '%'),
        h('td', r.total === null ? '—' : h('b', r.total)),
        h('td', { class: pctCls(r.pct) }, r.pct === null ? '—' : r.pct + '%'),
        h('td', r.grade === null ? '—' : h('b', r.grade)),
        ...EL.map((e) => h('td', { class: pctCls(r[e]) }, r[e] === null ? '—' : r[e] + '%')),
        h('td', h('span.st.' + r.status.code, r.status.text)))))));
  }

  function classView() {
    const d = S.data; const s = d.summary;
    const weakest = EL.filter((e) => s.el[e] !== null).sort((a, b) => s.el[a] - s.el[b])[0];
    const left = h('div.panel', h('h2', 'TIPISKĀKĀS CIA KĻŪDAS'),
      h('p.faint', 'Procents = cik bieži klase pieļāva šo kļūdu atbildēs, kur tā bija iespējama. Zemāk — cik audzēkņu to pieļāva vismaz vienreiz.'),
      d.topError ? h('div.note', h('b', 'Biežākā CIA kļūda: '), `${d.topError.pct}% gadījumu audzēkņi ${d.topError.text}.`) : h('p.muted', 'Kļūdu vēl nav vai nav pietiekami datu.'),
      ...d.errors.map((e) => h('div.errrow', h('div.p', e.pct + '%'), h('div', h('div', e.text),
        h('div.faint', `${e.errN} no ${e.oppN} atbildēm · ${e.withErr} no ${e.withOpp} audzēkņiem vismaz reizi`), h('div.errbar', h('i', { style: `width:${e.pct}%` }))))));
    const right = h('div',
      h('div.panel', h('h2', 'CIA izpratne klasē'),
        h('div.elbars', EL.map((e) => h('div.elbar.cia-' + e,
          h('div.top', h('span', h('span.chip', e), ' ', EL_NAME[e]), h('span', s.el[e] === null ? '—' : fmt(s.el[e]) + '%')),
          h('div.bar', h('i', { style: `width:${s.el[e] || 0}%` }))))),
        weakest ? h('p', { style: 'margin-top:1rem' }, 'Klase vājāk saprot: ', h('b', `${weakest} — ${EL_NAME[weakest]}`), ` (${fmt(s.el[weakest])}%).`) : null),
      h('div.panel', h('h2', '5 sarežģītākie jautājumi'),
        d.hardest.length ? h('ol', { style: 'padding-left:1.2rem' }, d.hardest.map((q) => h('li', { style: 'margin:.5rem 0' }, q.label, h('div.faint', `Vidēji ${q.avg}% punktu · atbildējuši ${q.n}`)))) : h('p.muted', 'Vēl nav atbilžu.')),
      h('div.panel', h('h2', 'Vidēji pa daļām'), h('table.list', h('tbody', d.catAvg.map((c) => h('tr', h('td', c.title), h('td', `${fmt(c.avg)} / ${c.weight}`)))))),
      h('div.panel', h('h2', 'Rezultāti'),
        h('div.kv', h('div.k', 'Vidējais'), h('div', `${fmt(s.avgScore)} punkti (visi, kas sākuši)`),
          h('div.k', 'Pabeigušie'), h('div', `${fmt(s.avgFinishedScore)} punkti (${s.finished} audz.)`),
          h('div.k', 'Vidējā atzīme'), h('div', fmt(s.avgGrade)))));
    return h('div.grid2', left, right);
  }

  function settingsView() {
    const ta = h('textarea', { style: 'min-height:260px', placeholder: 'Viens audzēknis rindā: Vārds Uzvārds\nJānis Bērziņš\nAnna Kalniņa' });
    api('/api/admin/roster').then((r) => { ta.value = r.text; }).catch(() => {});
    const unlock = h('input', { type: 'checkbox', checked: S.data.unlockAll });
    unlock.addEventListener('change', async () => {
      try { await api('/api/admin/settings', { unlockAll: unlock.checked }); S.data.unlockAll = unlock.checked; toast('Saglabāts'); } catch (e) { toast(e.message, true); }
    });
    return h('div.grid2',
      h('div.panel', h('h2', 'Klases saraksts'),
        h('p.muted', 'Ievadi visus klases audzēkņus (piem., 18). Tad tabulā redzēsi arī tos, kas vēl nav pieslēgušies. Vārdi tiek salīdzināti, ignorējot garumzīmes un lielos burtus.'),
        ta,
        h('div.row', { style: 'margin-top:.8rem' }, h('button.btn.primary', {
          onclick: async () => { try { const r = await api('/api/admin/roster', { text: ta.value }); toast(`Saglabāti ${r.count} audzēkņi`); load(); } catch (e) { toast(e.message, true); } }
        }, 'Saglabāt sarakstu'))),
      h('div',
        h('div.panel', h('h2', 'Moduļu secība'),
          h('label', { style: 'display:flex;gap:.6rem;align-items:center;cursor:pointer' }, unlock, 'Atbloķēt visus moduļus (audzēkņi var pildīt jebkurā secībā)'),
          h('p.faint', { style: 'margin-top:.6rem' }, 'Pēc noklusējuma nākamais modulis atveras, kad pabeigts iepriekšējais. Izmaiņa audzēkņiem stājas spēkā ~30 sekunžu laikā.')),
        h('div.panel', h('h2', 'Pieslēgšanās'),
          h('div.kv', h('div.k', 'Piekļuves kods'), h('div.mono', S.data.accessCode),
            h('div.k', 'Adrese'), h('div', 'http://<šī-datora-IP>:3000 (redzama servera logā)'),
            h('div.k', 'Atkārtoti'), h('div', 'Audzēknis ievada to pašu vārdu un uzvārdu — progress turpinās.'))),
        h('div.panel', h('h2', 'Vērtēšana'),
          h('p.muted', 'Kopā 100 punkti: CIA pamati 15 · vienkāršās situācijas 15 · reālie incidenti 30 · avotu izmantošana 15 · CIA detektīvs 10 · noslēguma analīze 15.'),
          h('p.muted', 'Noslēguma uzdevuma pamatojuma teksti tiek vērtēti automātiski un provizoriski — atver audzēkni un, ja vajag, koriģē punktus.'))));
  }

  /* ---------------- audzēkņa detaļas ---------------- */

  async function openDetail(id) {
    try { S.detail = await api('/api/admin/student/' + id); renderDetail(); window.scrollTo(0, 0); } catch (e) { toast(e.message, true); }
  }
  async function reloadDetail() {
    if (!S.detail) return;
    const y = window.scrollY;
    S.detail = await api('/api/admin/student/' + S.detail.student.id);
    renderDetail(); window.scrollTo(0, y);
  }

  function renderDetail() {
    const d = S.detail; const r = d.result;
    const head = h('div.row', { style: 'margin-bottom:1rem' },
      h('button.btn', { onclick: () => { S.detail = null; load(); } }, '← Atpakaļ uz sarakstu'),
      h('div.spacer'),
      h('button.btn.danger', {
        onclick: async () => {
          if (!confirm(`Atiestatīt VISU ${d.student.name} progresu? Visas atbildes tiks dzēstas.`)) return;
          await api(`/api/admin/student/${d.student.id}/reset`, {}); toast('Progress atiestatīts'); reloadDetail();
        }
      }, 'Atiestatīt progresu'),
      h('button.btn.danger', {
        onclick: async () => {
          if (!confirm(`Dzēst audzēkni ${d.student.name} pavisam?`)) return;
          await api(`/api/admin/student/${d.student.id}/delete`, {}); S.detail = null; load();
        }
      }, 'Dzēst audzēkni'));
    const summary = h('div.grid2',
      h('div.panel', h('div.kicker', 'Audzēknis'), h('h1', d.student.name),
        h('div.kv', h('div.k', 'Rezultāts'), h('div', h('b', `${r.total}/100`), ` · atzīme ${r.grade}`),
          h('div.k', 'Progress'), h('div', `${r.progress}%${r.finished ? ' · pabeidza' : ''}`),
          h('div.k', 'Pēdējoreiz'), h('div', new Date(d.student.lastSeen).toLocaleString('lv-LV'))),
        h('div.lbl', { style: 'margin-top:1rem' }, 'Atgriezeniskā saite audzēknim'), ...d.feedback.map((t) => h('p', '“' + t + '”'))),
      h('div.panel',
        h('div.elbars', EL.map((e) => h('div.elbar.cia-' + e, h('div.top', h('span', h('span.chip', e), ' ', EL_NAME[e]), h('span', r.el[e] === null ? '—' : r.el[e] + '%')),
          h('div.bar', h('i', { style: `width:${r.el[e] || 0}%` }))))),
        h('table.list', { style: 'margin-top:1rem' }, h('tbody', r.categories.map((c) => h('tr', h('td', c.title), h('td', `${fmt(c.score)} / ${c.weight}`))))),
        d.errors.length ? h('div', h('div.lbl', { style: 'margin-top:1rem' }, 'Kļūdas'), ...d.errors.map((e) => h('div', `${e.n}× ${e.text}`))) : null));

    const mods = d.modules.map((m) => {
      const done = m.items.filter((i) => i.answered);
      const earned = done.reduce((a, i) => a + i.earned, 0); const max = done.reduce((a, i) => a + i.max, 0);
      return h('details.mod', { open: m.id === 'final' || m.id === 'lvm' ? true : null },
        h('summary', `${m.title} — ${done.length}/${m.items.length} atbildēti · ${fmt(earned)}/${fmt(max)} p.`),
        ...m.items.map(itemRow));
    });
    shell([head, summary, h('h2', { style: 'margin-top:1.5rem' }, 'Visas atbildes'), ...mods]);
  }

  function itemRow(it) {
    const d = S.detail;
    if (!it.answered) return h('div.itemrow', h('div.top', h('span.lab.faint', it.label), h('span.faint', 'nav atbildēts')));
    const cls = it.earned >= it.max ? 'good' : it.earned > 0 ? 'mid' : 'bad';
    const row = h('div.itemrow',
      h('div.top', h('span.lab', it.label), h('span.pts.' + cls, `${fmt(it.earned)}/${fmt(it.max)}`), it.teacherScore !== null ? h('span.faint', ` (auto: ${fmt(it.autoEarned)})`) : null),
      h('div.kv', h('div.k', 'Atbilde'), h('div', it.answer || '—'), it.correct ? [h('div.k', 'Sagaidāmā'), h('div.faint', it.correct)] : null,
        it.changed ? [h('div.k', 'Mainīja'), h('div', it.changed.length ? it.changed.join(', ') : 'nemainīja vērtējumu')] : null));
    if (it.errors && it.errors.length) row.append(h('div', it.errors.map((e) => h('span.errtag', e))));
    if (it.facts) {
      row.append(h('div.kv', ...EL.map((e) => [h('div.k', `${e} fakti`), h('div', it.facts[e].length ? h('ul', { style: 'margin:0;padding-left:1rem' }, it.facts[e].map((f) => h('li', f))) : '—')])));
    }
    if (it.texts) {
      row.append(h('div.kv', ...Object.entries(it.texts).map(([k, v]) => [h('div.k', k.length === 1 ? `${k} pamatojums` : k), h('div', { style: 'white-space:pre-wrap' }, v || '—')])));
    }
    if (it.list) {
      row.append(h('ul', { style: 'margin:.4rem 0 0;padding-left:1.1rem;font-size:.9rem' }, it.list.map((x) => h('li', { style: x.ok ? '' : 'color:#ffb4b4' }, `${x.ok ? '✓' : '✗'} ${x.text} → ${x.answer}${x.ok ? '' : ` (pareizi: ${x.correct})`}`))));
    }
    const sc = h('input', { type: 'number', step: '0.5', min: 0, max: it.max, value: it.teacherScore !== null ? it.teacherScore : '', placeholder: fmt(it.autoEarned) });
    const note = h('input.note', { type: 'text', placeholder: 'Piezīme (nav obligāta)', value: it.teacherNote || '' });
    row.append(h('div.ov',
      h('span.faint', it.provisional ? 'Provizoriski punkti — koriģēt:' : 'Koriģēt punktus:'), sc, h('span.faint', `/ ${fmt(it.max)}`), note,
      h('button.btn.small', {
        onclick: async () => {
          try { await api('/api/admin/override', { studentId: d.student.id, itemId: it.id, score: sc.value === '' ? null : Number(sc.value), note: note.value }); toast('Saglabāts'); reloadDetail(); } catch (e) { toast(e.message, true); }
        }
      }, 'Saglabāt'),
      it.teacherScore !== null ? h('button.btn.small.ghost', {
        onclick: async () => { await api('/api/admin/override', { studentId: d.student.id, itemId: it.id, score: null, note: '' }); reloadDetail(); }
      }, 'Noņemt korekciju') : null,
      h('button.btn.small.danger', {
        onclick: async () => {
          if (!confirm('Dzēst šo atbildi? Audzēknis varēs uz šo jautājumu atbildēt vēlreiz.')) return;
          await api('/api/admin/delete-answer', { studentId: d.student.id, itemId: it.id }); reloadDetail();
        }
      }, 'Dzēst atbildi')));
    return row;
  }

  if (S.token) start(); else renderLogin();
})();
