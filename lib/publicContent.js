/*
 * Saturs, ko sūtām audzēkņa pārlūkam — BEZ pareizajām atbildēm un skaidrojumiem.
 * Skaidrojumi tiek atgriezti tikai pēc tam, kad audzēknis ir iesniedzis atbildi.
 */
const L = require('../content/lesson');
const { evidenceFor } = require('./grading');

function stripItem(it) {
  const { key, explain, tags, ...rest } = it;
  return rest;
}

function publicCase(c) {
  return {
    id: c.id, code: c.code, title: c.title, org: c.org, period: c.period,
    briefing: c.briefing,
    stages: c.stages.map((s) => ({ id: s.id, time: s.time, blocks: s.blocks })),
    sources: c.sources.map((s) => ({ id: s.id, src: s.src, outlet: s.outlet, date: s.date, url: s.url || null, quote: s.quote, illustrative: !!s.illustrative })),
    evidence: evidenceFor(c.id).map(({ social, ...e }) => e),
    assessmentId: c.assessment.id
  };
}

function build() {
  return {
    title: 'KIB1 — CIA Incidentu laboratorija',
    EL: L.EL, EL_INFO: L.EL_INFO, STATUS: L.STATUS, KINDS: L.KINDS, KIND_HELP: L.KIND_HELP,
    RATING_LABELS: L.RATING_LABELS, SOURCE_TYPES: L.SOURCE_TYPES, BINS: L.BINS,
    modules: L.MODULES,
    cards: L.CARDS, rules: L.RULES,
    fund: L.FUND_ITEMS.map(stripItem),
    warm: L.WARM_ITEMS.map(stripItem),
    cases: { lvm: publicCase(L.CASES.lvm), csdd: publicCase(L.CASES.csdd), ddos: publicCase(L.CASES.ddos) },
    compare: {
      table: { id: L.COMPARE.table.id, cases: L.COMPARE.table.cases },
      questions: L.COMPARE.questions.map(stripItem)
    },
    detective: { id: L.DETECTIVE.id, cards: L.DETECTIVE.cards.map((c) => ({ id: c.id, text: c.text })) },
    final: {
      id: L.FINAL.id, title: L.FINAL.title, note: L.FINAL.note, intro: L.FINAL.intro, blocks: L.FINAL.blocks,
      statements: L.FINAL.statements.map((s) => ({ id: s.id, text: s.text }))
    }
  };
}

module.exports = { publicContent: build() };
