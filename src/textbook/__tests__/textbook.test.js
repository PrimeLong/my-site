/* Учебник: разметка глав, ссылки из глав на игру, структура готовых глав, формулы,
   ответы задач (пересчитаны независимо) и повторение. */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { LEVERS, SCENARIOS } from '../../lib/engine.js';
import { LAB_LEVERS, impulseResponse } from '../../lib/lab.js';
import { DRILLS } from '../../lib/drills.js';
import { GLOSSARY } from '../glossary.js';
import { GAME_CARDS } from '../appendix.js';
import { CHAPTERS, CHAPTER_BY_ID, APPENDICES, BOOKS } from '../toc.js';
import { TYCOON_TASKS, TYCOON_TABS, TYCOON_STARTS } from '../tycoon-tasks.js';
import { CHAPTER_BLOCKS, PROBLEMS, problemsOf } from '../content.js';
import { parseBlocks, parseInline, collectLinks, collectMath, collectBlocks, actionOf, checkAnswer, parseNumber } from '../markdown.js';
import { CHARTS, chartDefaults, sdEquilibrium, pointElasticity, islmEquilibrium, adasEquilibrium, costMinima, competitiveFirm, monopoly, cournot, checkGraph } from '../charts.js';
import { emptyProgress, recordAnswer, reviewQueue, chapterScore, REVIEW_DAYS, daysUntil } from '../progress.js';
import { STARTS, RES, makeTycoon, requiredStaff, levelMult, upgradeCost, buyPrice, marketPrice, cartelChance, cartelFineRisk, BLD } from '../../lib/tycoon.js';

const DAY = 24 * 3600 * 1000;
const READY = CHAPTERS.filter((c) => c.status === 'ready');

describe('разметка глав', () => {
  it('строка: формулы, жирный, курсив, ссылки с параметрами и подписью', () => {
    const n = parseInline('Цена $P^*$ и **спрос**, *вдоль* [[lab:govSpending?cb=fixed&mode=hold|госзакупки]] и [[term:demand]]');
    expect(n.find((x) => x.t === 'math').v).toBe('P^*');
    expect(n.find((x) => x.t === 'b').c[0].v).toBe('спрос');
    expect(n.find((x) => x.t === 'i').c[0].v).toBe('вдоль');
    const links = n.filter((x) => x.t === 'link');
    expect(links[0]).toMatchObject({ kind: 'lab', target: 'govSpending', params: { cb: 'fixed', mode: 'hold' }, label: 'госзакупки' });
    expect(links[1]).toMatchObject({ kind: 'term', target: 'demand', label: null });
  });
  it('блоки: заголовки, списки, таблица, формула, вставки и задача с решением', () => {
    const b = parseBlocks([
      '## Раздел', 'Абзац', 'продолжается.', '', '- один', '- два', '  с продолжением', '',
      '| a | b |', '|---|---|', '| 1 | 2 |', '', '$$', 'x = 1', '$$',
      ':::model Учебная модель', 'Текст', ':::',
      ':::chart supply-demand a=100 b=2', 'Подпись', ':::',
      ':::problem id=t1 answer=2.5 tol=0.1 unit="руб."', 'Условие', '---', 'Решение', ':::',
      ':::try', '[[drill:recession]]', ':::',
    ].join('\n'));
    expect(b.map((x) => x.type)).toEqual(['h2', 'p', 'ul', 'table', 'math', 'box', 'chart', 'problem', 'box']);
    expect(b[1].inline[0].v).toBe('Абзац продолжается.');
    expect(b[2].items[1][0].v).toBe('два с продолжением');
    expect(b[3].rows).toHaveLength(1);
    expect(b[4].tex).toBe('x = 1');
    expect(b[5]).toMatchObject({ kind: 'model', title: 'Учебная модель' });
    expect(b[6]).toMatchObject({ chart: 'supply-demand', attrs: { a: '100', b: '2' } });
    expect(b[7]).toMatchObject({ id: 't1', answer: 2.5, tol: 0.1, unit: 'руб.' });
    expect(b[7].solution[0].inline[0].v).toBe('Решение');
    expect(actionOf(b[8].children[0])).toMatchObject({ kind: 'drill', target: 'recession' });
  });
  it('незакрытая вставка и задача без решения — ошибка, а не молчание', () => {
    expect(() => parseBlocks(':::model\nтекст')).toThrow();
    expect(() => parseBlocks(':::problem id=x answer=1\nусловие\n:::')).toThrow();
    expect(() => parseBlocks(':::wat\n:::')).toThrow();
  });
  it('ответы: запятая, пробелы, минус-тире, проценты; допуск', () => {
    expect(parseNumber('1 150')).toBe(1150);
    expect(parseNumber('−0,5')).toBe(-0.5);
    expect(parseNumber('30%')).toBe(30);
    expect(parseNumber('abc')).toBe(null);
    expect(checkAnswer('2,2', 2.22, 0.01).ok).toBe(false);
    expect(checkAnswer('2,22', 2.22, 0.01).ok).toBe(true);
    expect(checkAnswer('30', 30).ok).toBe(true);
    expect(checkAnswer('30,5', 30).ok).toBe(false);
    expect(checkAnswer('', 30)).toEqual({ ok: false, value: null });
  });
});

describe('оглавление', () => {
  it('микро и макро — все главы из программы; готовы пилот и весь блок микро', () => {
    expect(CHAPTERS.filter((c) => c.part === 'micro').map((c) => c.id))
      .toEqual(['supply-demand', 'elasticity', 'costs', 'competition-monopoly', 'oligopoly', 'market-failures']);
    expect(CHAPTERS.filter((c) => c.part === 'macro').map((c) => c.id))
      .toEqual(['gdp', 'money-banks', 'ad-as', 'is-lm', 'phillips', 'policy', 'growth', 'open-economy', 'public-debt', 'inequality']);
    expect(READY.map((c) => c.id)).toEqual(['supply-demand', 'elasticity', 'costs', 'competition-monopoly', 'oligopoly', 'is-lm']);
  });
  it('у каждой готовой главы есть текст, у ненаписанной — нет; карточки приложения существуют', () => {
    CHAPTERS.forEach((c) => {
      expect(!!CHAPTER_BLOCKS[c.id], c.id).toBe(c.status === 'ready');
      (c.cards || []).forEach((id) => expect(GAME_CARDS.some((g) => g.id === id), `${c.id} → ${id}`).toBe(true));
    });
    // лишних файлов глав нет
    Object.keys(CHAPTER_BLOCKS).forEach((id) => expect(CHAPTER_BY_ID[id], id).toBeTruthy());
  });
  it('каждая карточка «игра ↔ учебник» привязана к главе — один порядок чтения', () => {
    GAME_CARDS.forEach((g) => expect(CHAPTERS.some((c) => (c.cards || []).includes(g.id)), g.id).toBe(true));
  });
});

describe('ссылки из глав', () => {
  const leverIds = new Set(LEVERS.map((l) => l.id));
  const labIds = new Set(LAB_LEVERS.map((l) => l.id));
  const drillIds = new Set(DRILLS.map((d) => d.id));
  const scenarioIds = new Set(SCENARIOS.map((s) => s.id));
  const all = Object.entries(CHAPTER_BLOCKS).flatMap(([ch, blocks]) => collectLinks(blocks).map((l) => ({ ...l, ch })));
  // подписи ссылок тоже размечены — и в них могут быть ссылки
  const inLabels = all.filter((l) => l.label).flatMap((l) => parseInline(l.label).filter((n) => n.t === 'link').map((n) => ({ ...n, ch: l.ch })));

  it.each([...all, ...inLabels].map((l) => [`${l.ch}: [[${l.kind}:${l.target}]]`, l]))('%s ведёт туда, где что-то есть', (_, l) => {
    switch (l.kind) {
      case 'lever': expect(leverIds.has(l.target)).toBe(true); break;
      case 'term': expect(GLOSSARY[l.target]).toBeTruthy(); break;
      case 'drill': expect(drillIds.has(l.target)).toBe(true); break;
      case 'scenario': expect(scenarioIds.has(l.target)).toBe(true); break;
      case 'chapter': expect(CHAPTER_BY_ID[l.target]).toBeTruthy(); break;
      case 'card': expect(GAME_CARDS.some((g) => g.id === l.target)).toBe(true); break;
      case 'appendix': expect(APPENDICES.some((a) => a.id === l.target)).toBe(true); break;
      case 'tycoon': {
        const t = TYCOON_TASKS[l.target];
        expect(t).toBeTruthy();
        expect(TYCOON_TABS).toContain(t.tab);
        expect(TYCOON_STARTS).toContain(t.start);
        break;
      }
      case 'lab': {
        expect(labIds.has(l.target)).toBe(true);
        const { cb, mode, scenario, ...rest } = l.params;
        expect(rest).toEqual({});
        if (cb) expect(['taylor', 'fixed']).toContain(cb);
        if (mode) expect(l.target === 'keyRate' ? ['taylor', 'hold', 'pulse'] : ['hold', 'pulse']).toContain(mode);
        if (scenario) expect(scenarioIds.has(scenario)).toBe(true);
        break;
      }
      default: throw new Error(`Неизвестный вид ссылки ${l.kind}`);
    }
  });
  it('задания тайкуна: старты и вкладки существуют, у каждого есть глава', () => {
    Object.values(TYCOON_TASKS).forEach((t) => {
      expect(STARTS[t.start]).toBeTruthy();
      expect(CHAPTER_BY_ID[t.chapter]).toBeTruthy();
    });
  });
  it('каждое задание тайкуна вызывается из своей главы', () => {
    Object.entries(TYCOON_TASKS).forEach(([id, t]) => {
      expect(all.some((l) => l.kind === 'tycoon' && l.target === id && l.ch === t.chapter), id).toBe(true);
    });
  });
});

describe('структура готовых глав', () => {
  it.each(READY.map((c) => [c.id]))('%s: теория с формулами и графиком, пример, «проверьте в игре», 3–5 задач, модель и игра раздельно, учебник', (id) => {
    const blocks = CHAPTER_BLOCKS[id];
    const kinds = (k) => collectBlocks(blocks, (b) => b.type === 'box' && b.kind === k);
    expect(collectBlocks(blocks, (b) => b.type === 'math').length).toBeGreaterThan(2);
    const charts = collectBlocks(blocks, (b) => b.type === 'chart');
    expect(charts.length).toBeGreaterThan(0);
    charts.forEach((c) => expect(CHARTS[c.chart], c.chart).toBeTruthy());
    expect(kinds('example')).toHaveLength(1);
    expect(kinds('model')).toHaveLength(1);
    expect(kinds('game')).toHaveLength(1);
    const tries = kinds('try');
    expect(tries).toHaveLength(1);
    expect(tries[0].children.filter((b) => actionOf(b)).length).toBeGreaterThan(0);
    const probs = collectBlocks(blocks, (b) => b.type === 'problem');
    const numeric = probs.filter((p) => p.kind === 'number');
    expect(numeric.length).toBeGreaterThanOrEqual(3);
    expect(numeric.length).toBeLessThanOrEqual(5);
    // кроме числовых — «верно или неверно» и графическая, как на экзаменах и олимпиадах
    expect(probs.filter((p) => p.kind === 'truefalse').length).toBeGreaterThanOrEqual(1);
    expect(probs.filter((p) => p.kind === 'graph').length).toBeGreaterThanOrEqual(1);
    expect(probs.length).toBeLessThanOrEqual(7);
    probs.forEach((p) => {
      if (p.kind === 'number') expect(Number.isFinite(p.answer), p.id).toBe(true);
      if (p.kind === 'truefalse') expect(typeof p.answer, p.id).toBe('boolean');
      expect(p.statement.length).toBeGreaterThan(0);
      expect(p.solution.length).toBeGreaterThan(0);
    });
    const ch = CHAPTER_BY_ID[id];
    expect(ch.refs.length).toBeGreaterThan(0);
    ch.refs.forEach((r) => expect(BOOKS[r.book]).toBeTruthy());
  });
  it('в «проверьте в игре» у микроглав — задания тайкуна, у IS-LM — Лаборатория и задачи', () => {
    const actions = (id) => collectBlocks(CHAPTER_BLOCKS[id], (b) => b.type === 'box' && b.kind === 'try')[0].children.map(actionOf).filter(Boolean);
    CHAPTERS.filter((c) => c.part === 'micro' && c.status === 'ready').forEach((c) => {
      expect(actions(c.id).length, c.id).toBeGreaterThanOrEqual(2);
      expect(actions(c.id).every((a) => a.kind === 'tycoon'), c.id).toBe(true);
    });
    expect(actions('is-lm').map((a) => a.kind).sort()).toEqual(['drill', 'drill', 'lab', 'lab']);
  });
  it('id задач уникальны во всём учебнике', () => {
    const ids = Object.values(CHAPTER_BLOCKS).flatMap((b) => collectBlocks(b, (x) => x.type === 'problem').map((p) => p.id));
    ids.forEach((id) => expect(id, 'у задачи нет id').toBeTruthy());
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('все формулы KaTeX собираются без ошибок', () => {
    Object.entries(CHAPTER_BLOCKS).forEach(([id, blocks]) => {
      collectMath(blocks).forEach((tex) => {
        expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }), `${id}: ${tex}`).not.toThrow();
      });
    });
  });
});

/* Ответы пересчитаны здесь заново — формулой, а не копией числа из главы. Если в
   условии поменяют число, а ответ забудут, тест упадёт. */
const INDEPENDENT = {
  'sd-equilibrium': () => sdEquilibrium(120, 3, -30, 2).P,
  'sd-market-demand': () => sdEquilibrium(10 + 20, 1 + 2, 0, 3).Q,
  'sd-ceiling': () => (100 - 2 * 17) - (-20 + 4 * 17),
  'sd-cost-shock': () => sdEquilibrium(200, 4, -40 - 2 * 6, 2).P - sdEquilibrium(200, 4, -40, 2).P,
  'sd-both-shift': () => sdEquilibrium(110, 1, 10, 1).P - sdEquilibrium(90, 1, -10, 1).P,
  'el-arc': () => {
    const dq = (90 - 110) / ((90 + 110) / 2); const dp = (12 - 8) / ((12 + 8) / 2);
    return Math.abs(dq / dp);
  },
  'el-revenue-max': () => {
    // перебор: цена, при которой P·(240 − 4P) максимальна
    let best = 0; let bp = 0;
    for (let p = 0; p <= 60; p += 0.01) { const r = p * (240 - 4 * p); if (r > best) { best = r; bp = p; } }
    return bp;
  },
  'el-game-bread': () => {
    // тот же спрос, что в тайкуне: (1 + наценка)^−ε, ε хлеба из RESOURCES
    const e = RES.bread.elast;
    const rev = (m) => (1 + m) * Math.pow(1 + m, -e);
    return (rev(0.1) / rev(0) - 1) * 100;
  },
  'el-income': () => ((48 - 50) / 49) / ((44 - 40) / 42),
  'el-revenue-step': () => (1 + pointElasticity(100, 2, 30)) * -1,
  'islm-money': () => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1200, P: 2 }).Y,
  'islm-tax': () => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 200 - 0.75 * 200 + 200, G: 100, M: 1000, P: 2 }).Y
    - islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1000, P: 2 }).Y,
  'islm-multiplier': () => {
    const at = (G) => islmEquilibrium({ c: 0.8, b: 20, k: 0.5, h: 40, a0: 100, G, M: 500, P: 1 }).Y;
    return at(101) - at(100);
  },
  'islm-balanced': () => {
    // ставка стоит: кейнсианский крест Y = (C0 − cT + I0 − b·r + G) / (1 − c)
    const y = (G, T) => (200 - 0.75 * T + 200 - 25 * 6 + G) / 0.25;
    return y(200, 200) - y(100, 100);
  },
  'islm-trap': () => 200 * (1 - 0.75),
  // издержки: производная и минимум — численно, а не по формуле из главы
  'costs-mc': () => { const tc = (q) => 200 + 5 * q + 0.1 * q * q; return (tc(50 + 1e-6) - tc(50 - 1e-6)) / 2e-6; },
  'costs-atc-min': () => argmin((q) => (200 + 5 * q + 0.5 * q * q) / q, 1, 100),
  'costs-econ-profit': () => 2400 - 1500 - 600 - 0.12 * 1000,
  'costs-game-scale': () => {
    // те же множители, что в тайкуне: выпуск levelMult, штат requiredStaff, содержание ×1,3
    const st = makeTycoon({ start: 'retail' });
    const b1 = { type: 'farm', level: 1 }; const b2 = { type: 'farm', level: 2 };
    expect(BLD.farm.workers).toBe(4);
    const unit1 = (requiredStaff(st, b1) * 1 + 2) / levelMult(1);
    const unit2 = (requiredStaff(st, b2) * 1 + 2 * 1.3) / levelMult(2);
    return (1 - unit2 / unit1) * 100;
  },
  'pc-profit': () => {
    // перебор выпуска: максимум прибыли 83·Q − TC(Q)
    const tc = (q) => 100 + 20 * q - 6 * q * q + q * q * q;
    const q = argmin((x) => -(83 * x - tc(x)), 0, 20);
    return 83 * q - tc(q);
  },
  'pc-shutdown': () => { const avc = (q) => 12 - 4 * q + q * q; return avc(argmin(avc, 0.01, 20)); },
  'pc-firms': () => {
    const atc = (q) => (200 + 5 * q + 0.5 * q * q) / q;
    const q = argmin(atc, 1, 100); const P = atc(q);
    return (1500 - 20 * P) / q;
  },
  'mon-price': () => {
    const q = argmin((x) => -((200 - 2 * x) * x - 40 * x), 0, 100);
    return 200 - 2 * q;
  },
  'mon-lerner-game': () => { const e = RES.furniture.elast; return (0.6 * e / (e - 1) - 1) * 100; },
  'olig-cournot-price': () => { const e = bestResponseCournot(100, [10, 10]); return 100 - e.reduce((a, q) => a + q, 0); },
  'olig-cournot-asym': () => bestResponseCournot(120, [20, 50])[0],
  'olig-cheat': () => { const q = argmin((x) => -((100 - 22.5 - x - 10) * x), 0, 90); return (100 - 22.5 - q - 10) * q; },
  'olig-n-firms': () => { const e = bestResponseCournot(100, Array(9).fill(10)); return 100 - e.reduce((a, q) => a + q, 0); },
  'olig-bertrand-asym': () => (30 - 20) * (100 - 30),
};

// минимум функции на отрезке тернарным поиском (для выпуклых функций задач)
function argmin(f, lo, hi) {
  for (let i = 0; i < 300; i++) { const m1 = lo + (hi - lo) / 3; const m2 = hi - (hi - lo) / 3; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
  return (lo + hi) / 2;
}
// равновесие Курно итерацией лучших ответов: q_i = (a − c_i − Σ q_−i) / 2
function bestResponseCournot(a, costs) {
  let q = costs.map(() => 1);
  for (let it = 0; it < 2000; it++) {
    q = q.map((qi, i) => { const others = q.reduce((s, x, j) => s + (j === i ? 0 : x), 0); return 0.8 * qi + 0.2 * Math.max(0, (a - costs[i] - others) / 2); });
  }
  return q;
}

describe('ответы задач', () => {
  it('каждая числовая задача проверена независимым расчётом', () => {
    expect(Object.keys(INDEPENDENT).sort()).toEqual(Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].block.kind === 'number').sort());
  });
  it.each(Object.keys(INDEPENDENT).map((id) => [id]))('%s', (id) => {
    const p = PROBLEMS[id].block;
    const tol = p.tol != null ? p.tol : Math.max(1e-9, Math.abs(p.answer) * 0.005);
    expect(Math.abs(INDEPENDENT[id]() - p.answer)).toBeLessThanOrEqual(tol);
  });
});

describe('графические задачи и «верно или неверно»', () => {
  const graphs = Object.values(PROBLEMS).map((p) => p.block).filter((b) => b.kind === 'graph');
  const tfs = Object.values(PROBLEMS).map((p) => p.block).filter((b) => b.kind === 'truefalse');
  it('они есть', () => { expect(graphs.length).toBeGreaterThanOrEqual(6); expect(tfs.length).toBeGreaterThanOrEqual(6); });
  it.each(graphs.map((g) => [g.id, g]))('%s: эталонный сдвиг даёт ответ, обратный — нет', (_, g) => {
    const def = CHARTS[g.chart];
    expect(def, g.chart).toBeTruthy();
    expect(typeof def.measure).toBe('function');
    const ids = def.controls(g.attrs).map((c) => c.id);
    (g.controls || []).forEach((c) => expect(ids).toContain(c));
    g.still.forEach((c) => expect(ids).toContain(c));
    const base = chartDefaults(g.chart, g.attrs);
    const m = def.measure(g.attrs, base);
    g.expect.forEach((e) => { expect(Object.keys(m)).toContain(e.key); expect(['+', '-', '0', '?']).toContain(e.dir); });
    expect(Object.keys(g.reference).length).toBeGreaterThan(0);
    Object.keys(g.reference).forEach((k) => { expect(g.controls || ids).toContain(k); expect(g.still).not.toContain(k); });
    const v = { ...base, ...g.reference };
    expect(checkGraph(g.chart, g.attrs, v, g).ok).toBe(true);
    // без сдвига ответа нет, а сдвиг в обратную сторону ответ не даёт
    expect(checkGraph(g.chart, g.attrs, base, g).ok).toBe(false);
    const back = { ...base, ...Object.fromEntries(Object.entries(g.reference).map(([k, x]) => [k, base[k] - (x - base[k])])) };
    expect(checkGraph(g.chart, g.attrs, back, g).ok).toBe(false);
    // запрещённый ползунок: тронули — не засчитано
    g.still.forEach((k) => {
      const c = def.controls(g.attrs).find((x) => x.id === k);
      const other = base[k] + (c.step || 1) * 3 <= c.max ? base[k] + (c.step || 1) * 3 : base[k] - (c.step || 1) * 3;
      expect(checkGraph(g.chart, g.attrs, { ...v, [k]: other }, g).ok).toBe(false);
    });
  });
  it('разметка графической задачи: параметры графика отделены от условий проверки', () => {
    const [b] = parseBlocks(':::graph id=g chart=supply-demand a=100 b=2 expect="P:+ Q:-" still="dA" controls="dA dC" solution="dC:-20"\nусловие\n---\nрешение\n:::');
    expect(b).toMatchObject({ kind: 'graph', chart: 'supply-demand', attrs: { a: '100', b: '2' }, still: ['dA'], controls: ['dA', 'dC'], reference: { dC: -20 } });
    expect(b.expect).toEqual([{ key: 'P', dir: '+' }, { key: 'Q', dir: '-' }]);
    const [t] = parseBlocks(':::truefalse id=t answer=false\nутверждение\n---\nобъяснение\n:::');
    expect(t).toMatchObject({ kind: 'truefalse', answer: false });
    expect(() => parseBlocks(':::truefalse id=t answer=maybe\nу\n---\nо\n:::')).toThrow();
  });
  it('проверка графика: 0 — «не меняется», ? — любое', () => {
    const A = { fc: '100', a: '20', b: '6', c: '1' };
    const base = chartDefaults('costs', A);
    expect(checkGraph('costs', A, { ...base, fc: 150 }, { expect: [{ key: 'avcMin', dir: '0' }, { key: 'atcMin', dir: '+' }] }).ok).toBe(true);
    expect(checkGraph('costs', A, { ...base, da: 5 }, { expect: [{ key: 'avcMin', dir: '0' }] }).ok).toBe(false);
    expect(checkGraph('costs', A, { ...base, da: 5 }, { expect: [{ key: 'avcMin', dir: '?' }] }).ok).toBe(true);
  });
});

describe('графики и разборы в тексте считают одно и то же', () => {
  it('издержки: пример главы — min AVC 11 при Q = 3, min ATC 35 при Q = 5; конкурентная фирма при ценах 56, 20, 83 и 10', () => {
    const p = { fc: 100, a: 20, b: 6, c: 1 };
    const m = costMinima(p);
    expect(m.qAvc).toBeCloseTo(3, 9); expect(m.avcMin).toBeCloseTo(11, 9);
    expect(m.qAtc).toBeCloseTo(5, 5); expect(m.atcMin).toBeCloseTo(35, 6);
    expect(competitiveFirm(p, 56)).toMatchObject({ Q: 6, profit: 116, shut: false });
    expect(competitiveFirm(p, 20)).toMatchObject({ Q: 4, profit: -68, shut: false });
    expect(competitiveFirm(p, 83)).toMatchObject({ Q: 7, profit: 292 });
    expect(competitiveFirm(p, 10)).toMatchObject({ Q: 0, profit: -100, shut: true });
    // постоянные издержки не двигают ни MC, ни AVC — только ATC
    const hi = costMinima({ ...p, fc: 200 });
    expect(hi.avcMin).toBeCloseTo(11, 9); expect(hi.atcMin).toBeGreaterThan(35); expect(hi.qAtc).toBeGreaterThan(5);
    expect(competitiveFirm({ ...p, fc: 200 }, 56).Q).toBe(6);
  });
  it('монополия: пример главы — Q = 40, P = 60, прибыль 1600, потери 800; налог 10 — цена +5', () => {
    expect(monopoly({ A: 100, B: 1, mc: 20 })).toMatchObject({ Q: 40, P: 60, profit: 1600, Qc: 80, dwl: 800 });
    expect(monopoly({ A: 100, B: 1, mc: 30 })).toMatchObject({ Q: 35, P: 65 });
  });
  it('Курно: пример главы — по 30, цена 60, прибыль по 900; матрица дилеммы', () => {
    expect(cournot({ a: 120, c1: 30, c2: 30 })).toMatchObject({ q1: 30, q2: 30, P: 60, pi1: 900, pi2: 900 });
    const pi = (q1, q2) => (120 - q1 - q2 - 30) * q1;
    expect(pi(22.5, 22.5)).toBeCloseTo(1012.5, 9);
    expect(pi(30, 22.5)).toBeCloseTo(1125, 9);
    expect(pi(22.5, 30)).toBeCloseTo(843.75, 9);
    expect(pi(30, 30)).toBeCloseTo(900, 9);
    // 30 — доминирующая стратегия, равновесие хуже картеля
    expect(pi(30, 22.5)).toBeGreaterThan(pi(22.5, 22.5));
    expect(pi(30, 30)).toBeGreaterThan(pi(22.5, 30));
    const low = cournot({ a: 120, c1: 20, c2: 30 });
    expect(low.q1).toBeCloseTo(110 / 3, 9); expect(low.q2).toBeCloseTo(80 / 3, 9); expect(low.P).toBeCloseTo(170 / 3, 9);
  });
  it('спрос и предложение: пример главы — P* = 20, Q* = 60, при сдвиге спроса на 30 — 25 и 80', () => {
    expect(sdEquilibrium(100, 2, -20, 4)).toEqual({ P: 20, Q: 60 });
    expect(sdEquilibrium(130, 2, -20, 4)).toEqual({ P: 25, Q: 80 });
    const d = CHARTS['supply-demand'];
    const attrs = { a: '100', b: '2', c: '-20', d: '4' };
    const s0 = d.build(attrs, chartDefaults('supply-demand', attrs));
    expect(s0.readout[0].value).toBe('20');
    const s1 = d.build(attrs, { ...chartDefaults('supply-demand', attrs), dA: 30, ceil: 15 });
    expect(s1.readout[0].value).toBe('25');
    // потолок 15 ниже новой цены 25: дефицит 130 − 30 − (−20 + 60) = 60
    expect(s1.readout.find((r) => r.label.startsWith('Дефицит')).value).toBe('60');
  });
  it('эластичность: середина прямой — |E| = 1 и максимум выручки', () => {
    expect(pointElasticity(100, 2, 25)).toBeCloseTo(-1, 10);
    expect(pointElasticity(100, 2, 20)).toBeCloseTo(-2 / 3, 10);
    const sc = CHARTS.elasticity.build({ a: '100', b: '2' }, { P: 30 });
    expect(sc.readout.find((r) => r.label === 'Если цену поднять').value).toBe('выручка упадёт');
  });
  it('IS-LM: пример главы — Y = 1100, r = 6; G + 50 → 1200 и 7; при неподвижной ставке — 1300', () => {
    const p = { c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1000, P: 2 };
    const e0 = islmEquilibrium(p);
    expect(e0.Y).toBeCloseTo(1100, 9); expect(e0.r).toBeCloseTo(6, 9);
    const e1 = islmEquilibrium({ ...p, G: 150 });
    expect(e1.Y).toBeCloseTo(1200, 9); expect(e1.r).toBeCloseTo(7, 9);
    const attrs = { c: '0.75', b: '25', k: '1', h: '100', a0: '325', g: '100', m: '1000', p: '2' };
    const held = CHARTS['is-lm'].build(attrs, { G: 150, M: 1000, hold: true });
    expect(held.readout[0].value).toBe('1300');
    expect(held.readout.find((r) => r.label.startsWith('Сколько денег')).value).toBe('1400');
  });
  it('AD-AS: исходное равновесие на потенциале; «длинный период» возвращает выпуск к нему при ценах выше', () => {
    const p = { c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1000, P: 2 };
    const e0 = adasEquilibrium(p, 1000, 2, 1100, 1);
    expect(e0.Y).toBeCloseTo(1100, 3); expect(e0.P).toBeCloseTo(2, 3);
    const attrs = { c: '0.75', b: '25', k: '1', h: '100', a0: '325', g: '100', m: '1000', p: '2' };
    const def = CHARTS['ad-as'];
    const v = def.onButton(attrs, { M: 1200, pe: 2 });
    // деньги нейтральны в длинном периоде: +20% денег — +20% цен
    expect(v.pe).toBeCloseTo(2.4, 2);
    const e1 = adasEquilibrium(p, 1200, v.pe, 1100, 1);
    expect(e1.Y).toBeCloseTo(1100, 0);
  });
  it('утверждение главы IS-LM про Лабораторию: разовый сдвиг закупок — при неподвижной ставке выпуск выше навсегда, при правиле Тейлора эффект затухает почти до нуля', () => {
    const fixed = impulseResponse({ leverId: 'govSpending', delta: 2, cb: 'fixed', mode: 'pulse', horizon: 24 });
    const rule = impulseResponse({ leverId: 'govSpending', delta: 2, cb: 'taylor', mode: 'pulse', horizon: 24 });
    // «около +0,1 п.п. все шесть лет»
    fixed.diff.forEach((r) => { expect(r.outputGap).toBeGreaterThan(0.06); expect(r.outputGap).toBeLessThan(0.16); });
    // «к концу шестого года почти до нуля»: меньше четверти первого квартала
    expect(rule.diff[23].outputGap).toBeLessThan(rule.diff[0].outputGap * 0.25);
    expect(rule.diff[23].outputGap).toBeLessThan(fixed.diff[23].outputGap * 0.25);
    // «уровень закупок примерно на 0,5% выше»
    expect(fixed.diff[0].govPurchasesReal).toBeCloseTo(0.5, 1);
  });
  it('утверждения глав про тайкун: эластичности 1,2 / 1,8 / 2,2', () => {
    expect([RES.bread.elast, RES.furniture.elast, RES.appliances.elast]).toEqual([1.2, 1.8, 2.2]);
  });
  it('утверждения глав про тайкун: закупка на 15% дороже рынка, уровни ×1,5 выпуска и ×1,9 цены улучшения', () => {
    const st = makeTycoon({ start: 'retail' });
    expect(buyPrice(st, 'flour') / marketPrice(st, 'flour')).toBeCloseTo(1.15, 9);
    expect(levelMult(2) / levelMult(1)).toBeCloseTo(1.5, 9);
    expect(upgradeCost({ type: 'bakery', level: 2 }) / upgradeCost({ type: 'bakery', level: 1 })).toBeCloseTo(1.9, 9);
    expect(requiredStaff(st, { type: 'farm', level: 2 })).toBe(5);
  });
  it('утверждения глав про тайкун: шансы сговора 60 / 45 / 15% и риск штрафа 22%', () => {
    const st = makeTycoon({ start: 'retail' });
    expect(cartelChance(st, 'kolos')).toBeCloseTo(0.6, 9);
    expect(cartelChance(st, 'severoles')).toBeCloseTo(0.45, 9);
    expect(cartelChance(st, 'westra')).toBeCloseTo(0.15, 9);
    const free = { ...st, country: { ...st.country, economy: { ...st.country.economy, politicalRegime: 'democracy' } }, gr: false };
    expect(cartelFineRisk(free)).toBeCloseTo(0.22, 9);
  });
});

describe('прогресс и повторение', () => {
  const t0 = Date.UTC(2026, 0, 1);
  it('неверный ответ — задача вернётся через 2 дня; верный на повторении — через 5, потом 12, потом уходит', () => {
    let p = recordAnswer(emptyProgress(), 'x', false, t0);
    expect(p.problems.x).toMatchObject({ tries: 1, ok: false, box: 0 });
    expect(reviewQueue(p, t0 + DAY).due).toEqual([]);
    expect(reviewQueue(p, t0 + DAY).later[0].id).toBe('x');
    expect(reviewQueue(p, t0 + REVIEW_DAYS[0] * DAY).due).toEqual(['x']);
    const t1 = t0 + 2 * DAY;
    p = recordAnswer(p, 'x', true, t1);
    expect(p.problems.x).toMatchObject({ ok: true, box: 1 });
    expect(p.problems.x.due).toBe(t1 + 5 * DAY);
    const t2 = t1 + 5 * DAY;
    p = recordAnswer(p, 'x', true, t2);
    expect(p.problems.x.due).toBe(t2 + 12 * DAY);
    p = recordAnswer(p, 'x', true, t2 + 12 * DAY);
    expect(p.problems.x).toMatchObject({ box: null, due: null, ok: true, tries: 4 });
    expect(reviewQueue(p, t2 + 100 * DAY)).toEqual({ due: [], later: [] });
  });
  it('ошибка на повторении — снова в первую коробку; верный с первого раза в повторение не попадает', () => {
    let p = recordAnswer(emptyProgress(), 'x', false, t0);
    p = recordAnswer(p, 'x', true, t0 + 2 * DAY);
    p = recordAnswer(p, 'x', false, t0 + 7 * DAY);
    expect(p.problems.x).toMatchObject({ box: 0, due: t0 + 9 * DAY });
    const q = recordAnswer(emptyProgress(), 'y', true, t0);
    expect(q.problems.y).toMatchObject({ ok: true, box: null, due: null });
  });
  it('счёт главы — по последней попытке', () => {
    let p = recordAnswer(emptyProgress(), 'a', true, t0);
    p = recordAnswer(p, 'b', false, t0);
    expect(chapterScore(p, ['a', 'b', 'c'])).toEqual({ solved: 1, tried: 2, total: 3 });
    expect(problemsOf('is-lm')).toHaveLength(7);
  });
  it('«через N дней» по-русски', () => {
    expect(daysUntil(t0 + 2 * DAY, t0)).toBe('через 2 дня');
    expect(daysUntil(t0 + 5 * DAY, t0)).toBe('через 5 дней');
    expect(daysUntil(t0 + 21 * DAY, t0)).toBe('через 21 день');
    expect(daysUntil(t0 + DAY, t0)).toBe('завтра');
  });
});
