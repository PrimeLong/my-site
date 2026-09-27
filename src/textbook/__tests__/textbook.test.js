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
import { CHARTS, chartDefaults, sdEquilibrium, pointElasticity, islmEquilibrium, adasEquilibrium } from '../charts.js';
import { emptyProgress, recordAnswer, reviewQueue, chapterScore, REVIEW_DAYS, daysUntil } from '../progress.js';
import { STARTS, RES } from '../../lib/tycoon.js';

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
  it('микро и макро — все главы из программы, пилот из трёх глав готов', () => {
    expect(CHAPTERS.filter((c) => c.part === 'micro').map((c) => c.id))
      .toEqual(['supply-demand', 'elasticity', 'costs', 'competition-monopoly', 'oligopoly', 'market-failures']);
    expect(CHAPTERS.filter((c) => c.part === 'macro').map((c) => c.id))
      .toEqual(['gdp', 'money-banks', 'ad-as', 'is-lm', 'phillips', 'policy', 'growth', 'open-economy', 'public-debt', 'inequality']);
    expect(READY.map((c) => c.id)).toEqual(['supply-demand', 'elasticity', 'is-lm']);
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
    expect(probs.length).toBeGreaterThanOrEqual(3);
    expect(probs.length).toBeLessThanOrEqual(5);
    probs.forEach((p) => {
      expect(Number.isFinite(p.answer), p.id).toBe(true);
      expect(p.statement.length).toBeGreaterThan(0);
      expect(p.solution.length).toBeGreaterThan(0);
    });
    const ch = CHAPTER_BY_ID[id];
    expect(ch.refs.length).toBeGreaterThan(0);
    ch.refs.forEach((r) => expect(BOOKS[r.book]).toBeTruthy());
  });
  it('в «проверьте в игре» у микроглав — задания тайкуна, у IS-LM — Лаборатория и задачи', () => {
    const actions = (id) => collectBlocks(CHAPTER_BLOCKS[id], (b) => b.type === 'box' && b.kind === 'try')[0].children.map(actionOf).filter(Boolean);
    expect(actions('supply-demand').every((a) => a.kind === 'tycoon')).toBe(true);
    expect(actions('elasticity').every((a) => a.kind === 'tycoon')).toBe(true);
    expect(actions('is-lm').map((a) => a.kind).sort()).toEqual(['drill', 'drill', 'lab', 'lab']);
  });
  it('id задач уникальны во всём учебнике', () => {
    const ids = Object.values(CHAPTER_BLOCKS).flatMap((b) => collectBlocks(b, (x) => x.type === 'problem').map((p) => p.id));
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
};

describe('ответы задач', () => {
  it('каждая задача проверена независимым расчётом', () => {
    expect(Object.keys(INDEPENDENT).sort()).toEqual(Object.keys(PROBLEMS).sort());
  });
  it.each(Object.keys(INDEPENDENT).map((id) => [id]))('%s', (id) => {
    const p = PROBLEMS[id].block;
    const tol = p.tol != null ? p.tol : Math.max(1e-9, Math.abs(p.answer) * 0.005);
    expect(Math.abs(INDEPENDENT[id]() - p.answer)).toBeLessThanOrEqual(tol);
  });
});

describe('графики и разборы в тексте считают одно и то же', () => {
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
  it('утверждение главы IS-LM про Лабораторию: при неподвижной ставке эффект госзакупок примерно вдвое больше', () => {
    const fixed = impulseResponse({ leverId: 'govSpending', delta: 2, cb: 'fixed', mode: 'hold', horizon: 24 });
    const rule = impulseResponse({ leverId: 'govSpending', delta: 2, cb: 'taylor', mode: 'hold', horizon: 24 });
    const ratio = fixed.diff[23].outputGap / rule.diff[23].outputGap;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.7);
  });
  it('утверждения глав про тайкун: эластичности 1,2 / 1,8 / 2,2', () => {
    expect([RES.bread.elast, RES.furniture.elast, RES.appliances.elast]).toEqual([1.2, 1.8, 2.2]);
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
    expect(problemsOf('is-lm')).toHaveLength(5);
  });
  it('«через N дней» по-русски', () => {
    expect(daysUntil(t0 + 2 * DAY, t0)).toBe('через 2 дня');
    expect(daysUntil(t0 + 5 * DAY, t0)).toBe('через 5 дней');
    expect(daysUntil(t0 + 21 * DAY, t0)).toBe('через 21 день');
    expect(daysUntil(t0 + DAY, t0)).toBe('завтра');
  });
});
