/* ============================================================================
   ОТЧЁТ О БАЛАНСЕ

   Стенд длинных партий (src/lib/__tests__/longgame.test.js) проверяет, что
   партия не ломается. Этот скрипт отвечает на другой вопрос: насколько она
   справедлива. Он играет сотни партий ботами — по всем парам персон ЦБ и
   Минфина, сложностям и сценариям — и сводит исходы в таблицы: как часто
   власть проигрывает выборы, доходит до дефолта, гиперинфляции, авторитаризма,
   каким в среднем выходит благополучие.

   Оговорка, без которой цифры читать нельзя: здесь бот играет против бота.
   Человек заменяет одно из ведомств и играет иначе. Поэтому отчёт показывает
   перекосы — пару персон, при которой экономика рушится почти всегда, или
   сложность, которая ничем не отличается от соседней, — а не то, насколько
   трудно будет конкретному игроку.

   Запуск: npm run balance                 (таблицы в консоль)
           npm run balance -- --json       (сырые цифры для сравнения до/после)
           npm run balance -- --scenarios  (плюс выигрываемость кризисных сценариев)

   Выигрываемость — отдельный вопрос, на который боты ответить не могут: они
   играют одну стратегию. Здесь перебирается 1296
   двухфазных стратегий (жёсткая фаза, потом мягкая) и считается, сколько из
   них сохраняют демократию за четыре года. Ноль
   значит, что сценарий политически не выигрывается никакой игрой.
============================================================================ */
import {
  CB_PERSONAS, MOF_PERSONAS, PRESIDENT_PERSONAS, SCENARIOS, DIFFICULTIES,
  makeInitialEconomy, defaultDecisions,
} from '../src/lib/engine.js';
import { freshRoom, planPresident, resolveQuarter } from '../api/room.js';
import { simulateQuarter, scaleLever, LEVERS } from '../src/lib/engine.js';

const QUARTERS = 40; // десять лет — два с половиной избирательных цикла
const SEEDS = Number(process.env.BALANCE_SEEDS || 12);
const JSON_OUT = process.argv.includes('--json');
const SCENARIO_SEARCH = process.argv.includes('--scenarios');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Партия играется настоящим игровым циклом — resolveQuarter сервера комнаты,
   где все места пусты и за каждое ведомство и президента решает бот. Это ровно
   то, что происходит в сетевой партии без людей: с указаниями президента,
   назначениями, сменой характеров ведомств после выборов и обещаниями. Своя
   упрощённая копия цикла здесь уже один раз соврала: вызывала бота-президента
   с аргументами не в том порядке, он не видел кулдаунов и издавал один и тот
   же указ через квартал, а указания ведомствам не исполнялись вовсе. */
function playGame({ seed, scenario, difficulty, cb, mof, pres }) {
  const realRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    const economy0 = makeInitialEconomy(scenario);
    let room = freshRoom({ id: 'BAL', mode: 'policy', difficulty, cbPersona: cb, mofPersona: mof,
      president: pres ? { persona: pres } : null });
    room = { ...room, economy: economy0, decisions: defaultDecisions(economy0),
      history: [{ q: 0, label: 'старт', ...economy0 }] };
    room = { ...room, presidentPlan: planPresident(room, room.economy, {}) };
    const out = { lostElection: false, landslide: false, defaulted: false, imf: false, hyper: false,
      hyperEnd: false, unfree: false, crisisQuarters: 0, wellbeingSum: 0, quarters: 0, personaChanged: false };
    for (let q = 1; q <= QUARTERS; q++) {
      room = resolveQuarter(room);
      const e = room.economy;
      out.quarters = q;
      if (e.electionResult && e.electionResult !== 'incumbent') out.lostElection = true;
      if (e.electionResult === 'landslide') out.landslide = true;
      if (e.defaultedEver) out.defaulted = true;
      if (e.imfActive) out.imf = true;
      if (e.inflation > 40) out.hyper = true;
      if (e.politicalRegime === 'authoritarian' || e.politicalRegime === 'totalitarian') out.unfree = true;
      if ((e.activeCrises || []).length) out.crisisQuarters += 1;
      if (room.cbPersona !== cb || room.mofPersona !== mof) out.personaChanged = true;
      out.wellbeingSum += e.wellbeing;
    }
    out.wellbeing = out.wellbeingSum / out.quarters;
    out.finalDebt = room.economy.debtToGdp;
    // «гиперинфляция» на старте одноимённого сценария — данность, а не исход:
    // исход — осталась ли она к концу партии
    out.hyperEnd = room.economy.inflation > 40;
    return out;
  } finally {
    Math.random = realRandom;
  }
}

// сводка по набору партий: доли исходов в процентах и средние
function summarize(games) {
  const n = games.length;
  const pct = (k) => Math.round(games.filter((g) => g[k]).length / n * 100);
  const avg = (k) => games.reduce((a, g) => a + g[k], 0) / n;
  return {
    n,
    lost: pct('lostElection'), landslide: pct('landslide'), defaulted: pct('defaulted'), imf: pct('imf'),
    hyper: pct('hyper'), hyperEnd: pct('hyperEnd'), unfree: pct('unfree'),
    crisisShare: Math.round(avg('crisisQuarters') / QUARTERS * 100),
    wellbeing: Math.round(avg('wellbeing')), finalDebt: Math.round(avg('finalDebt')),
  };
}

const HEAD = '| проиграны выборы | разгром | дефолт | МВФ | гиперинфл. когда-либо | гиперинфл. в конце | авторит. | кварталов в кризисе | благополучие | долг в конце |';
const SEP = '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
const row = (s) => `| ${s.lost}% | ${s.landslide}% | ${s.defaulted}% | ${s.imf}% | ${s.hyper}% | ${s.hyperEnd}% | ${s.unfree}% | ${s.crisisShare}% | ${s.wellbeing} | ${s.finalDebt}% |`;

const t0 = Date.now();
const results = [];
for (const d of DIFFICULTIES) for (const sc of SCENARIOS) for (const c of CB_PERSONAS) for (const m of MOF_PERSONAS) {
  for (let i = 0; i < SEEDS; i++) {
    const seed = 1000 + i;
    results.push({ difficulty: d.id, scenario: sc.id, cb: c.id, mof: m.id, pres: null,
      ...playGame({ seed, scenario: sc.id, difficulty: d.id, cb: c.id, mof: m.id, pres: null }) });
  }
}
const presResults = [];
for (const d of DIFFICULTIES) for (const p of PRESIDENT_PERSONAS) for (let i = 0; i < SEEDS * 3; i++) {
  presResults.push({ difficulty: d.id, pres: p.id,
    ...playGame({ seed: 5000 + i, scenario: 'sandbox', difficulty: d.id, cb: 'pragmatic', mof: 'technocrat', pres: p.id }) });
}

const groupBy = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
};
const name = (list, id) => (list.find((x) => x.id === id) || {}).name || (list.find((x) => x.id === id) || {}).title || id;

const report = {
  byDifficulty: [...groupBy(results, (r) => r.difficulty)].map(([k, g]) => ({ key: k, ...summarize(g) })),
  bySandboxDifficulty: [...groupBy(results.filter((r) => r.scenario === 'sandbox'), (r) => r.difficulty)].map(([k, g]) => ({ key: k, ...summarize(g) })),
  byScenario: [...groupBy(results, (r) => r.scenario)].map(([k, g]) => ({ key: k, ...summarize(g) })),
  byPair: [...groupBy(results, (r) => `${r.cb}+${r.mof}`)].map(([k, g]) => ({ key: k, ...summarize(g) })),
  byPairSandboxMedium: [...groupBy(results.filter((r) => r.scenario === 'sandbox' && r.difficulty === 'medium'), (r) => `${r.cb}+${r.mof}`)]
    .map(([k, g]) => ({ key: k, ...summarize(g) })),
  byPresident: [...groupBy(presResults, (r) => r.pres)].map(([k, g]) => ({ key: k, ...summarize(g) })),
  games: results.length + presResults.length,
  seconds: (Date.now() - t0) / 1000,
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const table = (title, rows, label) => {
    console.log(`\n### ${title}\n`);
    console.log(`| ${label} ${HEAD}`);
    console.log(`|---${SEP}`);
    rows.forEach((r) => console.log(`| ${r.label} ${row(r)}`));
  };
  const pairLabel = (k) => { const [c, m] = k.split('+'); return `${name(CB_PERSONAS, c)} + ${name(MOF_PERSONAS, m)}`; };
  console.log(`Партий сыграно: ${report.games}, по ${QUARTERS} кварталов, ${SEEDS} семян на комбинацию, ${report.seconds.toFixed(1)} с.`);
  table('По сложности (все сценарии и персоны)', report.byDifficulty.map((r) => ({ ...r, label: name(DIFFICULTIES, r.key) })), 'сложность');
  table('По сложности — только открытая партия (кризисные сценарии не смазывают разницу)', report.bySandboxDifficulty.map((r) => ({ ...r, label: name(DIFFICULTIES, r.key) })), 'сложность');
  table('По сценарию (все сложности и персоны)', report.byScenario.map((r) => ({ ...r, label: name(SCENARIOS, r.key) })), 'сценарий');
  table('По паре персон: ЦБ + Минфин (все сценарии и сложности)', report.byPair.map((r) => ({ ...r, label: pairLabel(r.key) })), 'пара');
  table('По паре персон — открытая партия, средняя сложность', report.byPairSandboxMedium.map((r) => ({ ...r, label: pairLabel(r.key) })), 'пара');
  table('По характеру президента (открытая партия, Прагматик + Технократ)', report.byPresident.map((r) => ({ ...r, label: name(PRESIDENT_PERSONAS, r.key) })), 'президент');
}

/* --- Выигрываемость кризисных сценариев перебором стратегий ---
   Стратегии двухфазные — так играет человек, а не бот: сначала жёсткая фаза
   (ставка над инфляцией, бюджет, режим курса), а когда инфляция вернулась
   близко к цели — мягкая (ставка у ожиданий, поддержка выплатами и
   закупками). Постоянные параметры на всю партию недооценивали игрока: в
   «Гиперинфляции» они не находили ни одной выигрышной стратегии даже там,
   где двухфазная находила. */
function scenarioWinnability(scenarioId) {
  const KR = LEVERS.find((l) => l.id === 'keyRate');
  const rank = { democracy: 0, crisis: 1, authoritarian: 2, totalitarian: 3 };
  let winning = 0; let total = 0; let best = null;
  for (const prem of [3, 5, 8]) for (const gs1 of [-6, -3, 0]) for (const fx of ['free', 'managed', 'peg']) for (const tr1 of [0, 4, 8])
    for (const exitAt of [3, 6]) for (const prem2 of [-1, 1]) for (const tr2 of [4, 10]) for (const gs2 of [0, 4]) {
      total += 1; let kept = 0;
      for (const seed of [1, 2, 3, 4]) {
        const realRandom = Math.random; Math.random = mulberry32(seed);
        try {
          let e = makeInitialEconomy(scenarioId); let d = defaultDecisions(e);
          let pend = []; let cd = {}; let st = []; let worst = 0; let phase = 1;
          for (let q = 1; q <= 16; q++) {
            const tgt = Number.isFinite(e.inflationTarget) ? e.inflationTarget : 4;
            if (phase === 1 && e.inflation < tgt + exitAt) phase = 2;
            const cap = scaleLever(KR, e).max;
            const dec = phase === 1
              ? { keyRate: Math.min(cap, Math.max(0, Math.round(Math.max(e.inflation, e.inflationExpectations) + prem))), govSpending: gs1, transfers: tr1, fxRegime: fx }
              : { keyRate: Math.min(cap, Math.max(0, Math.round(e.inflationExpectations + prem2))), govSpending: gs2, transfers: tr2, fxRegime: fx };
            const r = simulateQuarter({ economy: e, decisions: { ...d, ...dec },
              pendingImpulses: pend, eventCooldowns: cd, difficulty: 'medium', quarterIndex: q, stories: st });
            e = r.economy; pend = r.pendingImpulses; cd = r.eventCooldowns; st = r.stories || st; d = defaultDecisions(e, d);
            worst = Math.max(worst, rank[e.politicalRegime] || 0);
          }
          if (worst < 2) kept += 1;
        } finally { Math.random = realRandom; }
      }
      if (kept > 0) winning += 1;
      if (!best || kept > best.kept) best = { kept, prem, gs1, fx, tr1, exitAt, prem2, tr2, gs2 };
    }
  return { winning, total, best };
}

if (SCENARIO_SEARCH && !JSON_OUT) {
  console.log('\n### Выигрываемость кризисных сценариев (демократия за 16 кварталов, 4 семени)\n');
  console.log('| сценарий | стратегий, сохранивших демократию хоть раз | лучшая стратегия |');
  console.log('|---|---:|---|');
  SCENARIOS.filter((sc) => sc.id !== 'sandbox').forEach((sc) => {
    const w = scenarioWinnability(sc.id);
    const b = w.best;
    console.log(`| ${sc.title} | ${w.winning} из ${w.total} (${Math.round(w.winning / w.total * 100)}%) | ${b.kept}/4: сначала ставка = инфляция +${b.prem}, закупки ${b.gs1}, выплаты ${b.tr1}, курс ${b.fx}; у цели (+${b.exitAt}) — ставка = ожидания ${b.prem2 >= 0 ? '+' : ''}${b.prem2}, выплаты ${b.tr2}, закупки ${b.gs2} |`);
  });
}
