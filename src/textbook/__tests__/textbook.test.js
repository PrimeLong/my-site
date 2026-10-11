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
import { TYCOON_TASKS, TYCOON_TABS, TYCOON_STARTS, taskText } from '../tycoon-tasks.js';
import { CHAPTER_TEXT, CHAPTER_BLOCKS, APPENDIX_BLOCKS, CHAPTER_SECTIONS, PROBLEMS, RECALLS, problemsOf, sectionsOf, plainText } from '../content.js';
import { parseBlocks, parseInline, collectLinks, collectMath, collectBlocks, actionOf, checkAnswer, parseNumber, matchTraps } from '../markdown.js';
import { sectionDone, sectionProgress, nextSection, dueItems } from '../study.js';
import { CHARTS, chartDefaults, captionVars, lracFns, crossY, externality, moneyMultiplier, jointPies, sdEquilibrium, pointElasticity, islmEquilibrium, adasEquilibrium, costMinima, competitiveFirm, monopoly, cournot, checkGraph, ppfY, ppfCost, slutsky, cdChoice, taxMarket, phillipsPi, taylorRule, solowSteady } from '../charts.js';
import { emptyProgress, recordAnswer, scheduleAfter, reviewQueue, chapterScore, REVIEW_DAYS, daysUntil, confidenceStats, mergeTextbook, normalizeTextbook, addStudyMinute, dayKey, markRead as markReadP } from '../progress.js';
import { STARTS, RES, makeTycoon, requiredStaff, levelMult, upgradeCost, buyPrice, marketPrice, cartelChance, cartelFineRisk, BLD } from '../../lib/tycoon.js';
import { EXAMS, examSet, examResult, mixedSet, mixedChapters, weakTopics, journalWeeks, journalSummary } from '../check.js';
import { LEVER_BOOK, WHY_BOOK, COMPASS_BOOK, bookForChain, ALL_BOOK_LINKS } from '../../lib/booklinks.js';
import { balanceSteps, circularFlow } from '../diagrams.js';
import { TEMPLATES, templatesOf, makeVariant, seeded, trapDiffers } from '../variants.js';
import { todayCard, indexSections } from '../today-snapshot.js';

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
  it('ответы: без явного допуска — только точное совпадение (292 ≠ 291)', () => {
    expect(checkAnswer('292', 292).ok).toBe(true);
    expect(checkAnswer('291', 292).ok).toBe(false);
    expect(checkAnswer('293', 292).ok).toBe(false);
    expect(checkAnswer('292,1', 292).ok).toBe(false);
    expect(checkAnswer('0,5', 0.5).ok).toBe(true);
    expect(checkAnswer('0,49', 0.5).ok).toBe(false);
    // двоичная запись дробей не мешает: 0,1 + 0,2 — это 0,3
    expect(checkAnswer('0,3', 0.1 + 0.2).ok).toBe(true);
    // явный допуск задан — действует он
    expect(checkAnswer('1,85', -1.89, 0.05).ok).toBe(false);
    expect(checkAnswer('-1,85', -1.89, 0.05).ok).toBe(true);
  });
  it('ответы: единица из подписи задачи и знак процента отбрасываются', () => {
    expect(checkAnswer('292 руб.', 292, null, 'руб.').ok).toBe(true);
    expect(checkAnswer('292 руб', 292, null, 'руб.').ok).toBe(true);
    expect(checkAnswer('292руб.', 292, null, 'руб.').ok).toBe(true);
    expect(checkAnswer('330 тыс. руб.', 330, null, 'тыс. руб.').ok).toBe(true);
    expect(checkAnswer('35%', 35, null, '%').ok).toBe(true);
    expect(checkAnswer('35 %', 35, null, '%').ok).toBe(true);
    expect(checkAnswer('−1,89 %', -1.89, 0.05, '%').ok).toBe(true);
    expect(checkAnswer('50 фирм', 50, null, 'фирм').ok).toBe(true);
    // чужая единица — не число
    expect(checkAnswer('292 долл.', 292, null, 'руб.')).toEqual({ ok: false, value: null });
  });
  it('ответы: дроби вида «2/3»', () => {
    expect(parseNumber('2/3')).toBeCloseTo(2 / 3, 12);
    expect(parseNumber('−1/2')).toBe(-0.5);
    expect(parseNumber('1,5/3')).toBe(0.5);
    expect(parseNumber('1/0')).toBe(null);
    expect(parseNumber('1/2/3')).toBe(null);
    expect(checkAnswer('2/3', 0.6667, 0.001).ok).toBe(true);
    expect(checkAnswer('1/2', 0.5).ok).toBe(true);
    expect(checkAnswer('1/3', 0.5).ok).toBe(false);
  });
  it('подсказки, ключевые пункты «верно или неверно» и нумерация списка с нужного номера', () => {
    const [p] = parseBlocks(':::problem id=h answer=1\nУсловие\n?? Первая\n?? Вторая\n---\nРешение\n:::');
    expect(p.hints.map((h) => h[0].v)).toEqual(['Первая', 'Вторая']);
    expect(p.statement).toHaveLength(1);
    const [t] = parseBlocks(':::truefalse id=t answer=true\nУтверждение\n?? Подумайте\n---\n- пункт 1\n- пункт 2\n---\nРазбор\n:::');
    expect(t).toMatchObject({ kind: 'truefalse', answer: true });
    expect(t.points).toHaveLength(2);
    expect(t.solution[0].inline[0].v).toBe('Разбор');
    expect(() => parseBlocks(':::truefalse id=t answer=true\nУтверждение\n---\nРазбор\n:::')).toThrow();
    const blocks = parseBlocks('| a |\n|---|\n| 1 |\n\n5. пятый\n6. шестой');
    expect(blocks[1]).toMatchObject({ type: 'ol', start: 5 });
    expect(parseBlocks('1. первый')[0].start).toBeUndefined();
  });
});

describe('разметка методики: цели, итоги, вопросы на вспоминание, схемы, шаги задач', () => {
  it('цели, «Главное», «Типичные ошибки» — врезки; «+++» прячет подробности', () => {
    const b = parseBlocks(':::goals\n- раз\n:::\n:::summary\n- два\n:::\n:::mistakes\n- три\n:::\n:::game\nКоротко.\n+++\nПодробно.\n:::');
    expect(b.map((x) => x.kind)).toEqual(['goals', 'summary', 'mistakes', 'game']);
    expect(b[3].children[0].inline[0].v).toBe('Коротко.');
    expect(b[3].more[0].inline[0].v).toBe('Подробно.');
    expect(b[0].more).toBeUndefined();
  });
  it('вопрос на вспоминание: вопрос и ответ; без ответа — ошибка', () => {
    const [r] = parseBlocks(':::recall id=q1\nЧто такое X?\n---\nЭто Y.\n:::');
    expect(r).toMatchObject({ type: 'recall', id: 'q1' });
    expect(r.question[0].inline[0].v).toBe('Что такое X?');
    expect(r.answer[0].inline[0].v).toBe('Это Y.');
    expect(() => parseBlocks(':::recall id=q2\nвопрос\n:::')).toThrow();
  });
  it('схема-цепочка: звенья с текстом «вверх» и «вниз» и подпись', () => {
    const [f] = parseBlocks(':::flow Ставка и цены\n- Ставка | растёт | падает\n- Кредит | дорожает | дешевеет\nПодпись.\n:::');
    expect(f.type).toBe('flow');
    expect(f.title).toBe('Ставка и цены');
    expect(f.steps).toHaveLength(2);
    expect(f.steps[1].down[0].v).toBe('дешевеет');
    expect(f.caption[0].v).toBe('Подпись.');
  });
  it('задача в несколько шагов и уровень; заголовок с якорем', () => {
    const [p] = parseBlocks(':::problem id=m level=3 answer="15;0.5" tol=";0.01" unit="руб.;%" parts="MC;доля"\nУсловие\n---\nРешение\n:::');
    expect(p.level).toBe(3);
    expect(p.parts).toEqual([{ label: 'MC', answer: 15, tol: null, unit: 'руб.' }, { label: 'доля', answer: 0.5, tol: 0.01, unit: '%' }]);
    const [q] = parseBlocks(':::problem id=n answer="1;2" unit="шт."\nУсловие\n---\nРешение\n:::');
    expect(q.parts.map((x) => [x.label, x.unit])).toEqual([['а)', 'шт.'], ['б)', 'шт.']]);
    const [one] = parseBlocks(':::problem id=o answer=7 unit="т зерна"\nУсловие\n---\nРешение\n:::');
    expect(one).toMatchObject({ answer: 7, unit: 'т зерна', level: null });
    const [h] = parseBlocks('## Производная {#derivative}');
    expect(h).toMatchObject({ type: 'h2', anchor: 'derivative' });
    expect(h.inline[0].v).toBe('Производная');
  });
  it('разделы: якорь, блоки до следующего заголовка, вопрос раздела и минуты', () => {
    const secs = sectionsOf(parseBlocks('Вступление\n\n## Первый\nтекст\n:::recall id=r\nв\n---\nо\n:::\n## Второй {#two}\nещё'));
    expect(secs.map((x) => [x.id, x.title, x.recall])).toEqual([['sec-1', 'Первый', 'r'], ['two', 'Второй', null]]);
    expect(secs[0].minutes).toBeGreaterThanOrEqual(1);
  });
});

describe('оглавление', () => {
  it('микро и макро — все главы из программы; блок микро готов, кроме заготовок «в работе»', () => {
    expect(CHAPTERS.filter((c) => c.part === 'micro').map((c) => c.id))
      .toEqual(['scarcity', 'supply-demand', 'consumer', 'elasticity', 'production', 'costs', 'competition-monopoly', 'monopolistic', 'oligopoly', 'labor', 'market-failures']);
    expect(CHAPTERS.filter((c) => c.part === 'macro').map((c) => c.id))
      .toEqual(['gdp', 'money-banks', 'inflation', 'is-lm', 'ad-as', 'phillips', 'policy', 'growth', 'open-economy', 'public-debt', 'inequality']);
    expect(READY.map((c) => c.id)).toEqual(['scarcity', 'supply-demand', 'consumer', 'elasticity', 'costs', 'competition-monopoly', 'oligopoly', 'market-failures', 'gdp', 'money-banks', 'inflation', 'is-lm', 'ad-as', 'phillips', 'policy', 'growth']);
    expect(CHAPTERS.filter((c) => c.part === 'micro' && c.status !== 'ready').map((c) => c.id)).toEqual(['production', 'monopolistic', 'labor']);
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
  const all = [...Object.entries(CHAPTER_BLOCKS), ...Object.entries(APPENDIX_BLOCKS)].flatMap(([ch, blocks]) => collectLinks(blocks).map((l) => ({ ...l, ch })));
  const anchorsOf = (blocks) => sectionsOf(blocks).map((x) => x.id);
  // подписи ссылок тоже размечены — и в них могут быть ссылки
  const inLabels = all.filter((l) => l.label).flatMap((l) => parseInline(l.label).filter((n) => n.t === 'link').map((n) => ({ ...n, ch: l.ch })));

  it.each([...all, ...inLabels].map((l) => [`${l.ch}: [[${l.kind}:${l.target}]]`, l]))('%s ведёт туда, где что-то есть', (_, l) => {
    switch (l.kind) {
      case 'lever': expect(leverIds.has(l.target)).toBe(true); break;
      case 'term': expect(GLOSSARY[l.target]).toBeTruthy(); break;
      case 'drill': expect(drillIds.has(l.target)).toBe(true); break;
      case 'scenario': expect(scenarioIds.has(l.target)).toBe(true); break;
      case 'chapter': expect(CHAPTER_BY_ID[l.target]).toBeTruthy(); if (l.params.at) expect(anchorsOf(CHAPTER_BLOCKS[l.target])).toContain(l.params.at); break;
      case 'card': expect(GAME_CARDS.some((g) => g.id === l.target)).toBe(true); break;
      case 'appendix': expect(APPENDICES.some((a) => a.id === l.target)).toBe(true); if (l.params.at) expect(anchorsOf(APPENDIX_BLOCKS[l.target])).toContain(l.params.at); break;
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
  it('задание тайкуна подстраивается под товары компании: нет хлеба — мебель с её эластичностью', () => {
    const t = TYCOON_TASKS['price-elasticity'];
    const furn = taskText(t, [{ id: 'furniture', name: 'Мебель', elast: RES.furniture.elast, shop: true }]);
    expect(furn.text).toContain('«Мебель»');
    expect(furn.text).toContain('1,8');
    expect(furn.text).not.toMatch(/\{/);
    expect(furn.note).toBeNull();
    const both = taskText(t, [{ id: 'furniture', name: 'Мебель', elast: 1.8, shop: true }, { id: 'bread', name: 'Хлеб', elast: 1.2, shop: true }]);
    expect(both.text).toContain('«Хлеб»');
    expect(taskText(t, []).note).toContain('нет товара для магазинов');
    // в тексте каждого задания не остаётся неподставленных {…}
    Object.values(TYCOON_TASKS).forEach((x) => expect(taskText(x, [{ id: 'bread', name: 'Хлеб', elast: 1.2, shop: true, wholesale: true }]).text).not.toMatch(/\{/));
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
  it.each(READY.map((c) => [c.id]))('%s: теория с формулами и графиком, пример, «проверьте в игре», 10–12 задач трёх уровней, модель и игра раздельно, учебник', (id) => {
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
    expect(numeric.length).toBeGreaterThanOrEqual(5);
    // кроме числовых — «верно или неверно» и графическая, как на экзаменах и олимпиадах
    expect(probs.filter((p) => p.kind === 'truefalse').length).toBeGreaterThanOrEqual(1);
    expect(probs.filter((p) => p.kind === 'graph').length).toBeGreaterThanOrEqual(1);
    expect(probs.length).toBeGreaterThanOrEqual(10);
    expect(probs.length).toBeLessThanOrEqual(12);
    // три уровня: базовый, семинарский, олимпиадный — у каждой задачи свой, все три есть
    probs.forEach((p) => expect([1, 2, 3], `${p.id}: уровень`).toContain(p.level));
    [1, 2, 3].forEach((lv) => expect(probs.some((p) => p.level === lv), `уровень ${lv}`).toBe(true));
    // задачи идут от простых к сложным
    expect(probs.map((p) => p.level)).toEqual(probs.map((p) => p.level).sort());
    // не меньше трёх задач в несколько шагов
    expect(numeric.filter((p) => p.parts.length > 1).length, 'задачи в несколько шагов').toBeGreaterThanOrEqual(3);
    probs.forEach((p) => {
      // перед решением — одна-две подсказки
      expect(p.hints.length, `${p.id}: подсказки`).toBeGreaterThanOrEqual(1);
      expect(p.hints.length, `${p.id}: подсказки`).toBeLessThanOrEqual(2);
      if (p.kind === 'truefalse') { expect(p.points.length, p.id).toBeGreaterThanOrEqual(2); expect(p.points.length, p.id).toBeLessThanOrEqual(3); }
      // дробный ответ без явного допуска не примет округлённое значение
      if (p.kind === 'number') {
        p.parts.forEach((pt, k) => {
          expect(Number.isFinite(pt.answer), `${p.id}, шаг ${k + 1}`).toBe(true);
          if (!Number.isInteger(pt.answer)) expect(pt.tol, `${p.id}, шаг ${k + 1}: нужен tol`).not.toBeNull();
        });
      }
      if (p.kind === 'truefalse') expect(typeof p.answer, p.id).toBe('boolean');
      expect(p.statement.length).toBeGreaterThan(0);
      expect(p.solution.length).toBeGreaterThan(0);
    });
    // методика: цели в начале, «Главное» и «Типичные ошибки» в конце
    const goals = kinds('goals'); const summary = kinds('summary'); const mistakes = kinds('mistakes');
    expect(goals).toHaveLength(1);
    expect(blocks.findIndex((b) => b.type === 'box' && b.kind === 'goals')).toBeLessThan(blocks.findIndex((b) => b.type === 'h2'));
    const items = (box) => (box.children.find((b) => b.type === 'ul' || b.type === 'ol') || { items: [] }).items.length;
    expect(items(goals[0]), 'целей 3–4').toBeGreaterThanOrEqual(3);
    expect(items(goals[0]), 'целей 3–4').toBeLessThanOrEqual(4);
    expect(summary).toHaveLength(1);
    expect(items(summary[0]), '«Главное» — 5–7 пунктов').toBeGreaterThanOrEqual(5);
    expect(items(summary[0]), '«Главное» — 5–7 пунктов').toBeLessThanOrEqual(7);
    expect(mistakes).toHaveLength(1);
    expect(items(mistakes[0])).toBeGreaterThanOrEqual(3);
    // разделы: каждый, кроме «Итоги» и «Задачи», кончается вопросом на вспоминание и читается минут за 5–15
    const secs = CHAPTER_SECTIONS[id];
    expect(secs.map((x) => x.title).slice(-2)).toEqual(['Итоги', 'Задачи']);
    const study = secs.slice(0, -2);
    expect(study.length, 'разделов для чтения').toBeGreaterThanOrEqual(3);
    study.forEach((x) => {
      const last = x.blocks[x.blocks.length - 1];
      expect(last.type, `«${x.title}» кончается вопросом`).toBe('recall');
      expect(x.blocks.filter((b) => b.type === 'recall'), `«${x.title}»: один вопрос`).toHaveLength(1);
      expect(x.minutes, `«${x.title}»: минут`).toBeLessThanOrEqual(15);
    });
    expect(secs.find((x) => x.title === 'Итоги').blocks.map((b) => b.kind)).toEqual(['summary', 'mistakes']);
    // «как это устроено в игре» — 3–4 фразы, подробности — под «Подробнее»
    const game = kinds('game')[0];
    expect(game.more, 'подробности игры под «Подробнее»').toBeTruthy();
    const brief = game.children.filter((b) => b.type === 'p').map((b) => plainText(b.inline)).join(' ');
    const sentences = brief.split(/(?<=[.!?])\s+(?=[А-ЯA-Z«])/).filter((x) => x.trim()).length;
    expect(sentences, `игра: ${sentences} фраз`).toBeGreaterThanOrEqual(2);
    expect(sentences, `игра: ${sentences} фраз`).toBeLessThanOrEqual(4);
    expect(game.children.every((b) => b.type === 'p')).toBe(true);
    const ch = CHAPTER_BY_ID[id];
    expect(ch.refs.length).toBeGreaterThan(0);
    ch.refs.forEach((r) => expect(BOOKS[r.book]).toBeTruthy());
  });
  it('в «проверьте в игре» у микроглав — задания тайкуна, у IS-LM — Лаборатория и задачи', () => {
    const actions = (id) => collectBlocks(CHAPTER_BLOCKS[id], (b) => b.type === 'box' && b.kind === 'try')[0].children.map(actionOf).filter(Boolean);
    CHAPTERS.filter((c) => c.part === 'micro' && c.status === 'ready').forEach((c) => {
      expect(actions(c.id).length, c.id).toBeGreaterThanOrEqual(2);
      expect(actions(c.id).some((a) => a.kind === 'tycoon'), c.id).toBe(true);
    });
    expect(actions('is-lm').map((a) => a.kind).sort()).toEqual(['drill', 'drill', 'lab', 'lab']);
  });
  it('id задач и вопросов на вспоминание уникальны во всём учебнике', () => {
    const ids = Object.values(CHAPTER_BLOCKS).flatMap((b) => collectBlocks(b, (x) => x.type === 'problem' || x.type === 'recall').map((p) => p.id));
    ids.forEach((id) => expect(id, 'у задачи нет id').toBeTruthy());
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('все формулы KaTeX собираются без ошибок', () => {
    [...Object.entries(CHAPTER_BLOCKS), ...Object.entries(APPENDIX_BLOCKS)].forEach(([id, blocks]) => {
      collectMath(blocks).forEach((tex) => {
        expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }), `${id}: ${tex}`).not.toThrow();
      });
    });
  });
});

/* Ответы пересчитаны здесь заново — формулой, а не копией числа из главы. Если в
   условии поменяют число, а ответ забудут, тест упадёт. */
const INDEPENDENT = {
  // кривая Филлипса — функцией графика; пути инфляции — пошаговой симуляцией
  'ph-pi': () => { const p = { us: 5, beta: 0.5 }; return [phillipsPi(p, 4, 7), phillipsPi(p, 4, 3)]; },
  'ph-accel': () => { let pi = 2; for (let t = 0; t < 4; t += 1) pi = phillipsPi({ us: 5, beta: 0.5 }, pi, 4); return pi; },
  'ph-sacrifice': () => {
    // держим безработицу на пункт выше естественной и считаем пункт-годы, пока инфляция не дойдёт до 4%
    let pi = 10; let py = 0;
    while (pi > 4 + 1e-9) { pi = phillipsPi({ us: 5, beta: 0.5 }, pi, 6); py += 1; }
    return [py, py * 2];
  },
  'ph-okun': () => { const u = 5 + 4 / 2; return [u, phillipsPi({ us: 5, beta: 0.5 }, 6, u)]; },
  'ph-shock': () => [phillipsPi({ us: 5, beta: 0.5 }, 4, 5, 3), argmin((u) => Math.abs(phillipsPi({ us: 5, beta: 0.5 }, 4, u, 3) - 4), 5, 20)],
  'ph-path': () => {
    const p = { us: 5, beta: 0.5 }; let pi = 12;
    pi = phillipsPi(p, pi, 7); pi = phillipsPi(p, pi, 7); const two = pi;
    pi = phillipsPi(p, pi, 6); const three = pi;
    let years = 1; while (pi > 4 + 1e-9) { pi = phillipsPi(p, pi, 6); years += 1; }
    return [two, three, years];
  },
  'ph-trust': () => { const pe = 0.5 * 4 + 0.5 * 10; return [pe, argmin((u) => Math.abs(phillipsPi({ us: 5, beta: 0.5 }, pe, u) - 4), 5, 20)]; },
  // правило Тейлора — функцией графика; бюджет — сходящейся цепочкой расходов
  'pol-taylor': () => { const i = taylorRule(2, 8, 4, -2); return [i, i - 8]; },
  'pol-real': () => 16 - 12,
  'pol-stab': () => {
    // цепочка: ΔG, потом из каждого рубля дохода тратится c(1 − t)
    let dy = 0; let round = 40; for (let k = 0; k < 400; k += 1) { dy += round; round *= 0.8 * 0.75; }
    return [dy / 40, dy];
  },
  'pol-cyclical': () => { const cyc = 0.25 * 100 + 10; return [cyc, 60 - cyc]; },
  'pol-zlb': () => argmin((g) => Math.abs(taylorRule(2, 4, 4, g)), -30, 0),
  'pol-principle': () => { const di = taylorRule(2, 7, 4, 0) - taylorRule(2, 4, 4, 0); return [di, di - 3]; },
  'pol-zlbfiscal': () => {
    const mult = (() => { let s = 0; let r = 1; for (let k = 0; k < 400; k += 1) { s += r; r *= 0.75 * 0.8; } return s; })();
    const dG = 60 / mult; return [dG, dG - 0.2 * 60];
  },
  'pol-rulegap': () => { const i = taylorRule(2, 12, 4, 2); return [i, i - 15]; },
  // Солоу — пошаговое накопление капитала до устойчивого состояния и формула графика
  'gr-steady': () => {
    let k = 1; for (let t = 0; t < 5000; t += 1) k += 0.2 * Math.sqrt(k) - 0.05 * k;
    const st = solowSteady(0.5, 0.2, 0, 0.05); expect(k).toBeCloseTo(st.k, 3);
    return [k, Math.sqrt(k), 0.8 * Math.sqrt(k)];
  },
  'gr-accum': () => 0.3 * Math.sqrt(4) - 0.1 * 4,
  'gr-accounting': () => [0.3 * 5, 4 - 0.3 * 5 - 0.7 * 1],
  'gr-golden': () => {
    // перебор нормы сбережения: при какой потребление в устойчивом состоянии максимально
    const bs = argmax((s) => solowSteady(0.5, s, 0, 0.05).c, 0.01, 0.99);
    return [bs, solowSteady(0.5, bs, 0, 0.05).c];
  },
  'gr-pop': () => { const st = solowSteady(0.5, 0.2, 0.03, 0.05); return [st.k, st.y]; },
  'gr-convergence': () => [(0.3 * Math.sqrt(4) - 0.1 * 4) / 4 * 100, (0.3 * Math.sqrt(9) - 0.1 * 9) / 9 * 100],
  'gr-cd3': () => {
    let k = 1; for (let t = 0; t < 20000; t += 1) k += 0.24 * Math.cbrt(k) - 0.08 * k;
    return [k, Math.cbrt(k), 0.76 * Math.cbrt(k)];
  },
  'gr-transition': () => { const k1 = 4 + 0.2 * 2 - 0.05 * 4; return [k1, (Math.sqrt(k1) / 2 - 1) * 100, solowSteady(0.5, 0.2, 0, 0.05).k]; },
  'sd-equilibrium': () => sdEquilibrium(120, 3, -30, 2).P,
  'sd-market-demand': () => sdEquilibrium(10 + 20, 1 + 2, 0, 3).Q,
  'sd-ceiling': () => { expect(sdEquilibrium(80, 2, -10, 4).P).toBeGreaterThan(12); return [sdEquilibrium(80, 2, -10, 4).P, (80 - 2 * 12) - (-10 + 4 * 12)]; },
  'sd-read': () => [60 - 3 * 12, 60 / 3, 75 - 3 * 12],
  'sd-floor': () => { const P = 25; expect(sdEquilibrium(150, 5, -30, 4).P).toBeLessThan(P); return (-30 + 4 * P) - (150 - 5 * P); },
  'sd-kinked': () => {
    // спрос с изломом — сумма двух групп, каждая покупает только до своей цены; равновесие — перебором цены
    const D = (P) => (P <= 20 ? 60 - 3 * P : 0) + (P <= 40 ? 40 - P : 0);
    const eq = (S) => argmin((P) => Math.abs(D(P) - S(P)), 0, 40);
    const p1 = eq((P) => 4 * P - 20); const p2 = eq((P) => 2 * P - 26);
    return [p1, p2, p2 <= 20 ? 60 - 3 * p2 : 0];
  },
  'sd-passthrough': () => {
    // перебор наклонов: при каких b и d подъём предложения на 10 даёт цену +4 и количество −12
    for (let b = 0.5; b <= 10; b += 0.5) for (let d = 0.5; d <= 10; d += 0.5) {
      const e0 = sdEquilibrium(200, b, 0, d); const e1 = sdEquilibrium(200, b, -10 * d, d);
      if (Math.abs(e1.P - e0.P - 4) < 1e-9 && Math.abs(e1.Q - e0.Q + 12) < 1e-9) return [b, d];
    }
    return [NaN, NaN];
  },
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
  'el-revenue-step': () => (1 + pointElasticity(90, 2, 30)) * -1,
  'el-classify': () => [4 / 10, 15 / 10, (1 - 15 / 10) * 10],
  'el-cross': () => 6 / 20,
  'el-point': () => [Math.abs(pointElasticity(120, 3, 10)), Math.abs(pointElasticity(120, 3, 30)), argmin((p) => Math.abs(Math.abs(pointElasticity(120, 3, p)) - 1), 1, 39)],
  'el-const': () => { const q = (p) => 1000 * Math.pow(p, -2); return [(q(11) / q(10) - 1) * 100, ((11 * q(11)) / (10 * q(10)) - 1) * 100]; },
  'el-firm': () => {
    // остаточный спрос фирмы: рынок Q = A·P^−0,8, соперники держат 3/4 исходного выпуска; эластичность — численно
    const A = 1000; const Q = (p) => A * Math.pow(p, -0.8); const rivals = 0.75 * Q(10);
    const own = (p) => Q(p) - rivals;
    const h = 1e-6; const ef = -((own(10 + h) - own(10 - h)) / (2 * h)) * (10 / own(10));
    return [ef, ef * 5];
  },
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
  // AD-AS: равновесия — перебором цены, где AD из IS-LM пересекает SRAS; AD — по самой IS-LM
  'adas-ad': () => {
    const ad = (M, P) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M, P }).Y;
    return [ad(1200, 2), ad(1200, 3)];
  },
  'adas-okun': () => 5 + 4 / 2,
  'adas-sr': () => {
    const ad = (P) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1200, P }).Y;
    const P = argmin((x) => Math.abs(ad(x) - (1100 * x) / 2), 1, 4);
    return [P, ad(P), argmin((x) => Math.abs(ad(x) - 1100), 1, 5)];
  },
  'adas-lr-g': () => {
    const ad = (P) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 150, M: 1000, P }).Y;
    return [argmin((x) => Math.abs(ad(x) - 1100), 1, 6), 1100];
  },
  'adas-okun-gap': () => { const gap = -2 * (9 - 6); return [gap, 2000 * (1 + gap / 100)]; },
  'adas-stagflation': () => {
    const ad = (P, M = 1000) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M, P }).Y;
    const P = argmin((x) => Math.abs(ad(x) - (1100 * x) / 2.4), 1, 4);
    return [P, ad(P), argmin((M) => Math.abs(ad(2.4, M) - 1100), 500, 3000)];
  },
  'adas-adaptive': () => {
    const ad = (P) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1200, P }).Y;
    let pe = 2; let P = 0;
    for (let t = 1; t <= 2; t++) { const e = pe; P = argmin((x) => Math.abs(ad(x) - (1100 * x) / e), 1, 4); pe = P; }
    return [P, ad(P)];
  },
  // деньги: мультипликатор — суммой раундов «кредит → вклад», а не формулой
  'mb-base': () => [300 + 100, 300 + 1200, (300 + 1200) / (300 + 100)],
  'mb-qty': () => (200 * 5) / 500,
  'mb-deposit': () => {
    let dep = 0; let inflow = 1000; for (let i = 0; i < 400; i++) { dep += inflow; inflow *= 0.8; }
    return [dep, dep - 1000];
  },
  'mb-cash': () => {
    // база делится на наличные и резервы так, чтобы C = 0,25·D и R = 0,1·D
    const D = 500 / (0.25 + 0.1); const M = D * 1.25; return [M / 500, M];
  },
  'mb-qty-growth': () => (1.12 / 1.03 - 1) * 100,
  'mb-fisher': () => [15 - 10, (1.15 / 1.10 - 1) * 100],
  'mb-rounds': () => {
    let loan = 1000; let dep = 0; const first3 = [];
    for (let i = 0; i < 400; i++) { dep += loan; if (i < 3) first3.push(loan); loan *= 0.8; }
    // с наличными: из каждого кредита доля cr/(1 + cr) уходит на руки, остальное — во вклад
    let base = 1000; let M = 0; let lend = base;
    for (let i = 0; i < 2000; i++) { const cash = lend * 0.25 / 1.25; const d = lend - cash; M += lend; lend = d * 0.8; }
    return [first3.reduce((a, x) => a + x, 0), dep, M];
  },
  'mb-hyper': () => [(1.5 * 1.2 / 0.9 - 1) * 100, (1.5 / 0.9 - 1) * 100],
  // инфляция: стоимость корзины суммой «количество × цена», рост — отношением, реальные величины — делением
  'in-rate': () => (265 / 250 - 1) * 100,
  'in-basket': () => { const q = [10, 8, 4]; const cost = (p) => p.reduce((s, x, k) => s + x * q[k], 0); return [cost([40, 75, 750]), cost([44, 80, 830]), (cost([44, 80, 830]) / cost([40, 75, 750]) - 1) * 100]; },
  'in-wage': () => { const g = (43200 / 40000 - 1) * 100; return [g, g - 6]; },
  'in-years': () => ([1.1, 1.2, 1.05].reduce((a, x) => a * x, 1) - 1) * 100,
  'in-double': () => { let p = 1; for (let y = 0; y < 10; y += 1) p *= 1.07; return p; },
  'in-indexation': () => [20000 * 1.05, (20000 * 1.05 / (20000 * 1.09) - 1) * 100],
  'in-loan': () => [12 - 8, (1.12 / 1.15 - 1) * 100],
  'in-hyper': () => { let p = 1; let first = 0; for (let mo = 1; mo <= 12; mo += 1) { p *= 1.3; if (!first && p > 2) first = mo; } return [p, (p - 1) * 100, first]; },
  'in-tax': () => { const after = 10 * (1 - 0.13); return [after, ((1 + after / 100) / 1.08 - 1) * 100, ((1.10 / 1.08 - 1) * (1 - 0.13)) * 100]; },
  // ВВП: считаем из «сырых» данных — списками сделок, корзинами и множителями
  'gdp-exp': () => { const flows = { C: 600, I: 150, G: 200, Ex: 120, Im: 100, transfers: 80 }; return [flows.Ex - flows.Im, flows.C + flows.I + flows.G + flows.Ex - flows.Im]; },
  'gdp-va': () => { const sales = [100, 250, 600]; const va = sales.map((v, i) => v - (sales[i - 1] || 0)); return [va[1], va.reduce((a, x) => a + x, 0)]; },
  'gdp-deflator': () => (1560 / 1200) * 100,
  'gdp-income': () => { const y = 500 + 200 + 50 + 30 + 120 + 100; return [y, (500 / y) * 100]; },
  'gdp-real-growth': () => {
    const q2 = [12, 6]; const p1 = [2, 4]; const p2 = [3, 4];
    const nom = q2.reduce((a, q, i) => a + q * p2[i], 0); const real = q2.reduce((a, q, i) => a + q * p1[i], 0);
    return [nom, real, (nom / real) * 100];
  },
  'gdp-cpi': () => { const q = [30, 40, 2]; const cost = (p) => q.reduce((a, x, i) => a + x * p[i], 0); return (cost([55, 60, 500]) / cost([50, 60, 400]) - 1) * 100; },
  'gdp-approx': () => (1.12 / 1.08 - 1) * 100,
  'gdp-chain': () => { const C = 600; const I = 300 + 100; const NX = -400; const va = 1000 - 400; return [C + I + NX, va, 1000 - 400 - 300]; },
  'gdp-bias': () => {
    const p0 = [500, 200]; const p1 = [750, 200]; const q0 = [10, 10]; const q1 = [6, 16];
    const v = (p, q) => p.reduce((a, x, i) => a + x * q[i], 0);
    return [(v(p1, q0) / v(p0, q0) - 1) * 100, (v(p1, q1) / v(p0, q1) - 1) * 100];
  },
  'islm-cross': () => { const y = (G) => argmin((Y) => Math.abs(Y - (100 + 0.8 * (Y - 150) + 150 + G)), 0, 5000); return [y(200), y(201) - y(200), y(250)]; },
  'islm-curves': () => { const r = argmin((x) => Math.abs((1500 - 50 * x) - (300 + 150 * x)), 0, 20); return [r, 1500 - 50 * r]; },
  'islm-ad': () => {
    const at = (P) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1000, P }).Y;
    return [at(2.5), argmin((P) => Math.abs(at(P) - 1200), 0.5, 5)];
  },
  'islm-mix': () => {
    // при неподвижной ставке 6 — крест; при неизменных деньгах — полная IS-LM
    const cross = (G) => (200 - 0.75 * 100 + 200 - 25 * 6 + G) / 0.25;
    const dgFixed = argmin((g) => Math.abs(cross(100 + g) - 1200), 0, 200);
    const islm = (G) => islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G, M: 1000, P: 2 }).Y;
    const dgMoney = argmin((g) => Math.abs(islm(100 + g) - 1200), 0, 300);
    return [dgFixed, 2 * (1200 - 100 * 6), dgMoney];
  },
  // издержки: производная и минимум — численно, а не по формуле из главы
  'costs-mc': () => { const tc = (q) => 200 + 5 * q + 0.1 * q * q; return (tc(50 + 1e-6) - tc(50 - 1e-6)) / 2e-6; },
  'costs-atc-min': () => argmin((q) => (200 + 5 * q + 0.5 * q * q) / q, 1, 100),
  'costs-econ-profit': () => 3000 - 1800 - 720 - 0.1 * 1500,
  'costs-types': () => { const vc = (q) => 30 * q + q * q; return [400, vc(20), (400 + vc(20)) / 20]; },
  'costs-avc-min': () => { const avc = (q) => (24 * q - 6 * q * q + q * q * q) / q; const q = argmin(avc, 0.01, 20); return [q, avc(q)]; },
  'costs-from-avg': () => [30 * 10, 31 * 11 - 30 * 10],
  'costs-plants': () => {
    const tc1 = (q) => 80 + 10 * q + 0.5 * q * q; const tc2 = (q) => 360 + 4 * q + 0.1 * q * q;
    const cross = argmin((q) => Math.abs(tc1(q) - tc2(q)), 0, 100);
    return [cross, tc2(argmin((q) => tc2(q) / q, 1, 200)) / argmin((q) => tc2(q) / q, 1, 200), tc1(argmin((q) => tc1(q) / q, 1, 200)) / argmin((q) => tc1(q) / q, 1, 200)];
  },
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
    // перебор выпуска: максимум прибыли 70·Q − TC(Q)
    const tc = (q) => 60 + 10 * q - 4 * q * q + q * q * q;
    const q = argmin((x) => -(70 * x - tc(x)), 1, 20);
    return 70 * q - tc(q);
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
  'pc-basic': () => { const q = argmin((x) => -(30 * x - (10 * x + x * x)), 0, 50); return [q, 30 * q, (30 - 26) * q]; },
  'mon-dwl': () => {
    const q = argmin((x) => -((150 - x) * x - 30 * x), 0, 150); const P = 150 - q;
    let dwl = 0; const h = 0.001; for (let x = q + h / 2; x < 120; x += h) dwl += ((150 - x) - 30) * h;
    return [q, P, dwl];
  },
  'mon-discr': () => {
    const q1 = argmin((x) => -((25 - x / 4) * x - 10 * x), 0, 100); const q2 = argmin((x) => -((60 - x) * x - 10 * x), 0, 60);
    return [25 - q1 / 4, 60 - q2, (25 - q1 / 4 - 10) * q1 + (60 - q2 - 10) * q2];
  },
  'mon-natural': () => {
    const q = argmin((x) => -((110 - x) * x - (1000 + 10 * x)), 0, 110);
    // наименьшая цена без убытка: перебором цен снизу
    let p = 10; while ((p * (110 - p)) - (1000 + 10 * (110 - p)) < 0) p += 0.0001;
    return [110 - q, 10 * 100 - (1000 + 10 * 100), p];
  },
  'olig-cournot-price': () => { const e = bestResponseCournot(100, [10, 10]); return 100 - e.reduce((a, q) => a + q, 0); },
  'olig-cournot-asym': () => bestResponseCournot(120, [20, 50])[0],
  'olig-cheat': () => {
    const quota = argmin((Q) => -((150 - Q - 30) * Q), 0, 150) / 2;
    const q = argmin((x) => -((150 - quota - x - 30) * x), 0, 150);
    return (150 - quota - q - 30) * q;
  },
  // выбор и КПВ
  'sc-oc': () => 6 / 2,
  'sc-inside': () => [Math.sqrt(4225 - 25 * 25) - 52, Math.sqrt(4225 - 52 * 52) - 25],
  'sc-hours': () => { let h = 8; for (const r of [5000, 3500, 2500, 1500]) { if (r < 2800) break; h += 1; } return h; },
  'sc-sunk': () => [3 - 2, 1.5],
  'sc-joint': () => {
    // перебор часов на рубашки у Ани (a) и Бориса (b): больше всего пирогов при заданных рубашках
    const most = (need) => {
      let best = -1;
      for (let a = 0; a <= 8; a += 0.125) for (let b = 0; b <= 8; b += 0.125) {
        if (2 * a + b >= need - 1e-9) best = Math.max(best, 6 * (8 - a) + 2 * (8 - b));
      }
      return best;
    };
    // излом: дальше него каждая рубашка дорожает — ищем, где цена рубашки меняется с 2 на 3
    const kink = [...Array(24).keys()].find((k) => most(k) - most(k + 1) > 2.5);
    return [most(kink), most(10), most(10) - most(11)];
  },
  'sc-marginal-oc': () => { const y = (x) => 100 - (x * x) / 100; const d = (x) => (y(x - 1e-6) - y(x + 1e-6)) / 2e-6; return [d(30), d(80)]; },
  'sc-ppf-cost': () => (Math.sqrt(625 - 49) - Math.sqrt(625 - 225)) / (15 - 7),
  'sc-terms': () => Math.max(10 / 5, 6 / 1),
  'sc-gains': () => {
    // перебор распределения часов: сколько пирогов при 12 рубашках вдвоём
    let best = 0;
    for (let a = 0; a <= 8; a += 0.25) for (let b = 0; b <= 8; b += 0.25) {
      const shirts = 2 * (8 - a) + 1 * (8 - b);
      if (Math.abs(shirts - 12) < 1e-9) best = Math.max(best, 6 * a + 2 * b);
    }
    return best - (4 * 6 + 4 * 2);
  },
  // потребитель: оптимум численно, по бюджетной линии
  'cons-budget': () => (600 - 12 * 20) / 30,
  'cons-cd': () => { const x = argmin((v) => -(v * ((100 - 5 * v) / 2)), 0, 20); return (100 - 5 * x) / 2; },
  'cons-cd-share': () => argmin((x) => -(Math.pow(x, 0.3) * Math.pow((1000 - 10 * x) / 7, 0.7)), 0.01, 99.99),
  'cons-slutsky': () => {
    const xOf = (I, px) => argmin((x) => -(x * (I - px * x)), 0, I / px);
    const x0 = xOf(200, 2); const y0 = 200 - 2 * x0;
    return xOf(5 * x0 + y0, 5) - x0;
  },
  'cons-engel-index': () => (0.52 * 1.1 + 0.48 * 1 - 1) * 100,
  'cons-line': () => [480 / 12, 480 / 8, 12 / 8],
  'cons-mu': () => [30 / 5, 12 / 3, 15 * (30 / 5) - 15 * (12 / 3)],
  'cons-slutsky-full': () => {
    // оптимум Кобба — Дугласа численно, по бюджетной линии
    const xOf = (I, px) => argmin((x) => -(Math.pow(x, 0.25) * Math.pow(I - px * x, 0.75)), 0.001, I / px - 0.001);
    const x0 = xOf(400, 1); const y0 = 400 - x0;
    const xc = xOf(2 * x0 + y0, 2); const x1 = xOf(400, 2);
    return [x0, xc - x0, x1 - xc];
  },
  'cons-living': () => {
    const best = (I, px, py) => { const x = argmin((v) => -Math.sqrt(v * (I - px * v) / py), 0.001, I / px - 0.001); return Math.sqrt(x * (I - px * x) / py); };
    const u0 = best(200, 2, 2);
    const slutsky = 8 * 50 + 2 * 50;
    // доход, при котором прежняя полезность достижима, — бисекцией
    let lo = 0; let hi = 2000;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (best(m, 8, 2) < u0) lo = m; else hi = m; }
    return [slutsky, lo, (slutsky / lo - 1) * 100];
  },
  // провалы рынка
  'mf-cs': () => { let area = 0; const h = 0.01; for (let q = h / 2; q < 80; q += h) area += ((120 - q) / 2 - 20) * h; return area; },
  'mf-incidence': () => { const P = argmin((p) => Math.abs((90 - 3 * p) - (-10 + 2 * (p - 5))), 0, 30); return P; },
  'mf-dwl': () => { const q0 = 30; const q1 = 90 - 3 * 22; return 0.5 * 5 * (q0 - q1); },
  'mf-dwl-double': () => taxMarket({ a: 90, b: 3, c: -10, d: 2, t: 10 }).dwl,
  'mf-pigou': () => argmin((q) => Math.abs((100 - q) - (13 + q)), 0, 100),
  'mf-surplus': () => { const m = taxMarket({ a: 80, b: 2, c: -10, d: 1, t: 0 }); return [m.Pd, m.cs, m.ps]; },
  'mf-subsidy': () => [argmin((q) => Math.abs((100 - q) - (20 + q)), 0, 100), argmin((q) => Math.abs((110 - q) - (20 + q)), 0, 100), 10],
  'mf-coase': () => [50, 30, 50 - 30],
  'mf-laffer': () => {
    const t = argmin((x) => -taxMarket({ a: 100, b: 2, c: -20, d: 4, t: x }).rev, 0, 45);
    const m = taxMarket({ a: 100, b: 2, c: -20, d: 4, t });
    return [t, m.rev, m.dwl];
  },
  'olig-n-firms': () => { const e = bestResponseCournot(100, Array(9).fill(10)); return 100 - e.reduce((a, q) => a + q, 0); },
  'olig-bertrand-asym': () => (30 - 20) * (100 - 30),
  'olig-matrix': () => {
    // перебор: пара стратегий, от которой никому не выгодно отклоняться
    const pay = { HH: [50, 50], HL: [20, 70], LH: [70, 20], LL: [30, 30] };
    const S = ['H', 'L'];
    const eq = S.flatMap((a) => S.map((b) => a + b)).find((k) => {
      const [a, b] = k; return S.every((a2) => pay[a2 + b][0] <= pay[k][0]) && S.every((b2) => pay[a + b2][1] <= pay[k][1]);
    });
    return [pay[eq][0], pay.HH[0] + pay.HH[1]];
  },
  'olig-reaction': () => { const e = bestResponseCournot(130, [10, 10]); return [(120 - 20) / 2, e[0], 130 - e[0] - e[1]]; },
  'olig-cartel-stab': () => {
    const e = bestResponseCournot(150, [30, 30]); const cournot = (150 - e[0] - e[1] - 30) * e[0];
    // наименьший δ перебором
    let d = 0; while (1800 / (1 - d) < 2025 + (d * cournot) / (1 - d)) d += 0.0001;
    return [cournot, d];
  },
};

// минимум функции на отрезке тернарным поиском (для выпуклых функций задач)
function argmin(f, lo, hi) {
  for (let i = 0; i < 300; i++) { const m1 = lo + (hi - lo) / 3; const m2 = hi - (hi - lo) / 3; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
  return (lo + hi) / 2;
}
const argmax = (f, lo, hi) => argmin((x) => -f(x), lo, hi);
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
    // у задачи в несколько шагов расчёт возвращает массив — по числу на шаг
    const got = [].concat(INDEPENDENT[id]());
    expect(got).toHaveLength(p.parts.length);
    p.parts.forEach((pt, k) => {
      // численный поиск (перебор, тернарный поиск) точен до ~1e-6 от ответа
      const tol = Math.max(pt.tol || 0, 1e-4);
      expect(Math.abs(got[k] - pt.answer), `шаг ${k + 1}: ${got[k]} против ${pt.answer}`).toBeLessThanOrEqual(tol);
    });
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
    const [t] = parseBlocks(':::truefalse id=t answer=false\nутверждение\n---\n- пункт\n- ещё пункт\n---\nобъяснение\n:::');
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
  it('КПВ: точки примера (60; 80) и (80; 60), альтернативная стоимость растёт; технология в станках +20% — 96 станков', () => {
    expect(ppfY(100, 100, 60)).toBeCloseTo(80, 9);
    expect(ppfY(100, 100, 80)).toBeCloseTo(60, 9);
    expect(ppfCost(100, 100, 80)).toBeGreaterThan(ppfCost(100, 100, 60));
    expect(ppfY(100, 120, 60)).toBeCloseTo(96, 9);
  });
  it('потребитель: пример главы — (30; 60), при цене 4 — 15, Слуцкий −7,5 и −7,5', () => {
    expect(cdChoice({ a: 0.5, I: 120, px: 2, py: 1 })).toMatchObject({ x: 30, y: 60 });
    const sl = slutsky({ a: 0.5, I: 120, px0: 2, px1: 4, py: 1 });
    expect(sl.Ic).toBe(180);
    expect(sl.substitution).toBeCloseTo(-7.5, 9);
    expect(sl.income).toBeCloseTo(-7.5, 9);
    expect(sl.now.y).toBeCloseTo(60, 9);
  });
  it('налог: пример главы — 24 и 18, количество 52, излишки 676 и 338, сборы 312, потери 24; кто платит — неважно', () => {
    const m = taxMarket({ a: 100, b: 2, c: -20, d: 4, t: 6 });
    expect(m).toMatchObject({ Pd: 24, Ps: 18, Q: 52, cs: 676, ps: 338, rev: 312, dwl: 24 });
    // без налога общий излишек 900 + 450 = 1350; потеряно ровно DWL
    const m0 = taxMarket({ a: 100, b: 2, c: -20, d: 4, t: 0 });
    expect(m0.cs + m0.ps - (m.cs + m.ps + m.rev)).toBeCloseTo(m.dwl, 9);
    // налог «на покупателей»: спрос вниз на t — те же цены и количество
    const Pd = sdEquilibrium(100 - 2 * 6, 2, -20, 4).P + 6;
    expect(Pd).toBeCloseTo(m.Pd, 9);
  });
  it('ни одна задача не повторяет разбор: дробные ответы не встречаются в разборе своей главы', () => {
    const fmt = (v) => String(v).replace('.', ',');
    Object.values(PROBLEMS).forEach(({ chapter, block }) => {
      // короткие числа вроде 0,5 встречаются где угодно — сверяем только «приметные»: 1139,06, 43,33
      if (block.kind !== 'number') return;
      block.parts.forEach(({ answer }) => {
        if (Number.isInteger(answer) || String(Math.abs(answer)).replace('.', '').replace(/^0+/, '').length < 3) return;
        const ex = collectBlocks(CHAPTER_BLOCKS[chapter], (b) => b.type === 'box' && b.kind === 'example')[0];
        const text = JSON.stringify(ex);
        expect(text.includes(fmt(Math.abs(answer))), `${block.id}: ${answer} есть в разборе`).toBe(false);
      });
    });
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
  it('верный ответ до срока повторения расписание не меняет (ошибся — посмотрел решение — ответил верно)', () => {
    let p = recordAnswer(emptyProgress(), 'x', false, t0);
    const due = p.problems.x.due;
    p = recordAnswer(p, 'x', true, t0 + 60 * 1000, { sawSolution: true });
    expect(p.problems.x).toMatchObject({ ok: true, box: 0, due });
    p = recordAnswer(p, 'x', true, t0 + DAY);
    expect(p.problems.x.due).toBe(due);
  });
  it('верный ответ с подсмотренным решением засчитан, но задача вернётся через 2 дня', () => {
    const p = recordAnswer(emptyProgress(), 'y', true, t0, { sawSolution: true });
    expect(p.problems.y).toMatchObject({ ok: true, box: 0, due: t0 + 2 * DAY });
    expect(scheduleAfter(p.problems.y, true, t0 + 2 * DAY).why).toBe('advance');
    expect(scheduleAfter(p.problems.y, true, t0 + 2 * DAY, { sawSolution: true }).why).toBe('solution');
  });
  it('счёт главы — по последней попытке', () => {
    let p = recordAnswer(emptyProgress(), 'a', true, t0);
    p = recordAnswer(p, 'b', false, t0);
    expect(chapterScore(p, ['a', 'b', 'c'])).toEqual({ solved: 1, tried: 2, total: 3 });
    expect(problemsOf('is-lm')).toHaveLength(12);
  });
  it('«через N дней» по-русски', () => {
    expect(daysUntil(t0 + 2 * DAY, t0)).toBe('через 2 дня');
    expect(daysUntil(t0 + 5 * DAY, t0)).toBe('через 5 дней');
    expect(daysUntil(t0 + 21 * DAY, t0)).toBe('через 21 день');
    expect(daysUntil(t0 + DAY, t0)).toBe('завтра');
  });
});

describe('учебник: отметки для синхронизации с профилем', () => {
  it('снятая отметка «прочитано» помнит, когда её сняли, и не возвращается слиянием', async () => {
    const { emptyProgress, markRead, unmarkRead, mergeTextbook, setLast } = await import('../progress.js');
    const phone = markRead(emptyProgress(), 'elasticity', 100);
    const pc = unmarkRead(phone, 'elasticity', 200);
    expect(pc.read.elasticity).toBeUndefined();
    expect(mergeTextbook(phone, pc).read.elasticity).toBeUndefined();
    // а поставленная заново — снова прочитана
    const again = markRead(pc, 'elasticity', 300);
    expect(mergeTextbook(phone, again).read.elasticity).toBeTruthy();
    expect(setLast(again, again.last)).toBe(again);
    expect(setLast(again, { kind: 'chapter', id: 'elasticity' }, 400).lastAt).toBe(400);
  });
});

describe('уверенность и разделы', () => {
  it('уверенные и неуверенные ответы считаются отдельно; точность — по уверенным', () => {
    let p = emptyProgress();
    p = recordAnswer(p, 'a', true, 1000, { confident: true });
    p = recordAnswer(p, 'a', false, 2000, { confident: true });
    p = recordAnswer(p, 'b', true, 3000, { confident: false });
    p = recordAnswer(p, 'c', true, 4000, {});
    expect(confidenceStats(p, ['a', 'b', 'c'])).toEqual({ sure: { n: 2, ok: 1 }, unsure: { n: 1, ok: 1 } });
    expect(p.problems.c.cn).toBeUndefined();
  });
  it('счётчики уверенности переживают синхронизацию и чистку', () => {
    const a = recordAnswer(emptyProgress(), 'x', true, 1000, { confident: true });
    const b = recordAnswer(recordAnswer(emptyProgress(), 'x', false, 500, { confident: false }), 'x', true, 600, { confident: true });
    const m = mergeTextbook(a, b);
    expect(m.problems.x).toMatchObject({ cn: 1, cok: 1, un: 1, uok: 0, lastAt: 1000 });
    expect(normalizeTextbook({ problems: { y: { cn: 2, cok: 5, un: -1 } } }).problems.y).toMatchObject({ cn: 2, cok: 2, un: 0, uok: 0 });
  });
  it('«на сегодня»: первый непройденный раздел с главы, где остановились; пройденный — после «вспомнил»', () => {
    const first = READY[0].id;
    let p = emptyProgress();
    const n0 = nextSection(p);
    expect(n0.chapter).toBe(first);
    expect(n0.section.recall).toBeTruthy();
    p = recordAnswer(p, n0.section.recall, true, 1000);
    expect(sectionDone(p, n0.section)).toBe(true);
    expect(nextSection(p).section.id).not.toBe(n0.section.id);
    expect(sectionProgress(p, first).done).toBe(1);
    // читали другую главу — начинаем с неё
    const other = READY[3].id;
    expect(nextSection({ ...p, last: { kind: 'chapter', id: other } }).chapter).toBe(other);
    // «не вспомнил» — раздел не пройден, вопрос вернётся через два дня
    const q = recordAnswer(emptyProgress(), n0.section.recall, false, 1000);
    expect(nextSection(q).section.id).toBe(n0.section.id);
    expect(dueItems(q, 1000 + 2 * DAY)).toContain(n0.section.recall);
    expect(RECALLS[n0.section.recall].chapter).toBe(first);
  });
});

describe('огибающая LRAC', () => {
  it('каждая SRAC не ниже LRAC и касается её в точке своего размера; минимум SRAC — правее касания слева от МЭМ и левее справа', () => {
    const f = lracFns({ c: 20, m: 60, a: 0.004, s: 0.02 });
    [20, 40, 60, 80, 100].forEach((K) => {
      for (let q = 2; q <= 120; q += 1) expect(f.srac(K)(q)).toBeGreaterThanOrEqual(f.lrac(q) - 1e-9);
      expect(f.srac(K)(K)).toBeCloseTo(f.lrac(K), 12);
    });
    expect(f.sracMinQ(20)).toBeGreaterThan(20);
    expect(f.sracMinQ(60)).toBeCloseTo(60, 12);
    expect(f.sracMinQ(100)).toBeLessThan(100);
  });
});

describe('новые графики считают то же, что текст', () => {
  it('кейнсианский крест: экономика из примера IS-LM при ставке 6 — 1100; +50 госзакупок — 1300; +50 налогов — 950', () => {
    const p = { c0: 200, c: 0.75, I: 50, G: 100, T: 100 };
    expect(crossY(p, 100, 100)).toBeCloseTo(1100, 9);
    expect(crossY(p, 150, 100)).toBeCloseTo(1300, 9);
    expect(crossY(p, 100, 150)).toBeCloseTo(950, 9);
    // тот же выпуск даёт IS-LM при неподвижной ставке 6
    expect(islmEquilibrium({ c: 0.75, b: 25, k: 1, h: 100, a0: 325, G: 100, M: 1000, P: 2 }).Y).toBeCloseTo(crossY(p, 100, 100), 6);
  });
  it('внешний эффект: рынок 45, оптимум 35, потери 100; налог Пигу убирает потери', () => {
    const m = externality({ a: 100, c0: 10, e: 20 });
    expect([m.qm, m.qo, m.dwl]).toEqual([45, 35, 100]);
    expect(externality({ a: 100, c0: 10, e: 20 }, 20).dwl).toBe(0);
  });
  it('денежный мультипликатор: пример главы — 4,4 и масса 2200; рост резервов снижает его', () => {
    expect(moneyMultiplier(0.1, 0.15)).toBeCloseTo(4.4, 12);
    expect(moneyMultiplier(0.1, 0.15) * 500).toBeCloseTo(2200, 9);
    expect(moneyMultiplier(0.1, 0.2)).toBeLessThan(moneyMultiplier(0.1, 0.15));
    expect(moneyMultiplier(0, 0.2)).toBeCloseTo(5, 12);
  });
  it('общая КПВ Ани и Бориса: 40 пирогов без рубашек, излом на 8 рубашках — 32, дальше рубашка стоит 2 пирога', () => {
    const p = { a1: 4, b1: 2, a2: 1, b2: 1, h: 8 };
    expect(jointPies(p, 0).pies).toBe(40);
    expect(jointPies(p, 8).pies).toBe(32);
    expect(jointPies(p, 8).pies - jointPies(p, 9).pies).toBeCloseTo(2, 12);
    expect(jointPies(p, 4).pies).toBe(36);
  });
  it('цены и вклад: подпись к графику главы об инфляции — корзина 146,9, вклад 161,1, в сегодняшних ценах 109,6; при 12% — 176,2 и 91,4', () => {
    const m = CHARTS.inflation.measure({ p0: '100', n: '5' }, { pi: 8, i: 10 });
    expect(m.price).toBeCloseTo(146.93, 2);
    expect(m.deposit).toBeCloseTo(161.05, 2);
    expect(m.real).toBeCloseTo(109.61, 2);
    const hi = CHARTS.inflation.measure({ p0: '100', n: '5' }, { pi: 12, i: 10 });
    expect([hi.price, hi.deposit, hi.real].map((x) => Math.round(x * 10) / 10)).toEqual([176.2, 161.1, 91.4]);
  });
  it('номинальный и реальный ВВП: подпись к графику — через пять лет 162 и 110', () => {
    const m = CHARTS.gdp.measure({ y0: '100', n: '5' }, { g: 2, pi: 8 });
    expect(m.real).toBeCloseTo(110.4, 1);
    expect(m.nominal).toBeCloseTo(162.2, 1);
  });
  it('каждый новый график строится с ползунками по умолчанию и без NaN', () => {
    ['budget', 'choice', 'demand', 'market-demand', 'cross', 'externality', 'trade-ppf', 'gdp', 'inflation', 'money', 'ad-as'].forEach((type) => {
      const scene = CHARTS[type].build({}, chartDefaults(type, {}));
      scene.curves.forEach((c) => c.points.forEach((pt) => { expect(Number.isFinite(pt.x), `${type}:${c.id}`).toBe(true); expect(Number.isFinite(pt.y), `${type}:${c.id}`).toBe(true); }));
      expect(scene.readout.length).toBeGreaterThan(0);
    });
  });
});

describe('макроглавы: «проверьте в игре» и статистика', () => {
  const MACRO_NEW = ['gdp', 'money-banks', 'inflation', 'ad-as', 'phillips', 'policy', 'growth'];
  it('в «проверьте в игре» — Лаборатория или задача и сценарий с исторической тенью', () => {
    MACRO_NEW.forEach((id) => {
      const acts = collectBlocks(CHAPTER_BLOCKS[id], (b) => b.type === 'box' && b.kind === 'try')[0].children.map(actionOf).filter(Boolean);
      expect(acts.length, id).toBeGreaterThanOrEqual(3);
      expect(acts.some((a) => a.kind === 'lab' || a.kind === 'drill'), id).toBe(true);
      expect(acts.some((a) => a.kind === 'scenario' && (SCENARIOS.find((x) => x.id === a.target) || {}).shadow), `${id}: историческая тень`).toBe(true);
    });
  });
  it('настоящая статистика — только с источником: абзац с годом и числом в процентах или рублях называет источник', () => {
    const SOURCE = /Росстат|Банк России|ЦБ РФ|ФРС|МВФ/;
    MACRO_NEW.forEach((id) => {
      collectBlocks(CHAPTER_BLOCKS[id].filter((b) => b.type !== 'problem'), (b) => b.type === 'p' || b.type === 'ul').forEach((b) => {
        const texts = b.type === 'p' ? [plainText(b.inline)] : b.items.map(plainText);
        texts.forEach((t) => {
          const hasYear = /\b(19|20)\d{2}\b/.test(t);
          const hasStat = /\d[\d\s,]*\s?(%|трлн|млрд)/.test(t.replace(/\b(19|20)\d{2}\b/g, ''));
          if (hasYear && hasStat) expect(SOURCE.test(t), `${id}: «${t.slice(0, 80)}…» — нет источника`).toBe(true);
        });
      });
      // и примечание в начале главы честно говорит, что числа примеров условные
      expect(JSON.stringify(CHAPTER_BLOCKS[id].slice(0, 3))).toMatch(/условн/);
    });
  });
});

describe('подписи к графикам считают числа из параметров', () => {
  const charts = Object.entries(CHAPTER_BLOCKS).flatMap(([id, bl]) => collectBlocks(bl, (b) => b.type === 'chart' && b.caption).map((b) => ({ id, b })));
  const holes = (nodes) => [...JSON.stringify(nodes).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  it('каждая подстановка {{…}} в подписи находит значение', () => {
    charts.forEach(({ id, b }) => {
      const vars = captionVars(b.chart, b.attrs, chartDefaults(b.chart, b.attrs));
      holes(b.caption).forEach((k) => expect(vars, `${id}: {{${k}}}`).toHaveProperty(k));
    });
  });
  it('ВВП: множители за период совпадают со сложными процентами', () => {
    const b = charts.find((c) => c.b.chart === 'gdp').b;
    const d = chartDefaults('gdp', b.attrs);
    const v = captionVars('gdp', b.attrs, d);
    const n = Number(v.n);
    expect(Number(v.nomx.replace(',', '.'))).toBeCloseTo(Math.pow((1 + d.g / 100) * (1 + d.pi / 100), n), 2);
    expect(Number(v.realx.replace(',', '.'))).toBeCloseTo(Math.pow(1 + d.g / 100, n), 2);
  });
  it('кейнсианский крест: мультипликаторы из подписи', () => {
    const b = charts.find((c) => c.b.chart === 'cross').b;
    const v = captionVars('cross', b.attrs, chartDefaults('cross', b.attrs));
    expect(Number(v.dg)).toBeCloseTo(50 * Number(v.mult), 6);
  });
});

describe('ловушки: неверный ответ → объяснение ошибки', () => {
  const blocks = READY.flatMap((c) => problemsOf(c.id).map((id) => ({ ch: c.id, b: PROBLEMS[id].block })));
  it.each(READY.map((c) => [c.id]))('%s: не меньше трёх задач с ловушками', (id) => {
    expect(problemsOf(id).filter((pid) => (PROBLEMS[pid].block.traps || []).length > 0).length).toBeGreaterThanOrEqual(3);
  });
  it('ответ-ловушка всегда отличается от верного', () => {
    blocks.forEach(({ b }) => (b.traps || []).forEach((tr) => {
      if (b.kind === 'number') {
        const pt = b.parts[tr.part];
        const tol = Math.max(pt.tol || 0, 0.01 * Math.abs(tr.value));
        expect(Math.abs(tr.value - pt.answer), `${b.id}: ловушка ${tr.value}`).toBeGreaterThan(tol);
      } else if (b.kind === 'truefalse') {
        expect(tr.value, b.id).not.toBe(b.answer);
      } else {
        // графическая: ловушка — ползунок, который двигать не нужно
        expect(CHARTS[b.chart].controls(b.attrs).map((c) => c.id), b.id).toContain(tr.control);
        expect(b.reference[tr.control] == null || b.reference[tr.control] === chartDefaults(b.chart, b.attrs)[tr.control], b.id).toBe(true);
      }
    }));
  });
  it('ловушка срабатывает на свой ответ, а на верный — нет', () => {
    blocks.filter(({ b }) => b.kind === 'number').forEach(({ b }) => (b.traps || []).forEach((tr) => {
      const right = b.parts.map((pt) => String(pt.answer));
      const wrong = right.map((x, k) => (k === tr.part ? String(tr.value) : x));
      expect(matchTraps(b, wrong), `${b.id}: ${tr.value}`).toContain(tr);
      expect(matchTraps(b, right), b.id).toEqual([]);
    }));
  });
  it('пример из задачи о монополии: без ½ потери совпадают с прибылью', () => {
    const b = PROBLEMS['mon-dwl'].block;
    expect(matchTraps(b, ['60', '90', '3600']).map((t) => plainText(t.text))[0]).toContain('Забыли ½');
    expect(matchTraps(b, ['60', '90', '3000'])).toEqual([]);
  });
});

describe('задачи по газете', () => {
  it.each(READY.filter((c) => c.part === 'macro').map((c) => [c.id]))('%s: не меньше двух задач с заголовком газеты', (id) => {
    const news = problemsOf(id).map((pid) => PROBLEMS[pid].block).filter((b) => b.news);
    expect(news.length).toBeGreaterThanOrEqual(2);
    news.forEach((b) => {
      // заголовок — как в игровой газете: заглавными, коротко
      expect(b.news, b.id).toBe(b.news.toUpperCase());
      expect(b.news.length, b.id).toBeLessThanOrEqual(60);
      expect(['graph', 'truefalse'], b.id).toContain(b.kind);
    });
  });
});

const studySecRecall = (ch) => CHAPTER_SECTIONS[ch].find((x) => x.recall).recall;

describe('итоговая проверка и задачи вперемешку', () => {
  const micro = CHAPTERS.filter((c) => c.part === 'micro' && c.status === 'ready');
  it('проверка «Микро»: 15–20 задач — варианты типов из каждой главы блока, соседние — из разных глав', () => {
    const blocks = examSet('micro', 12345);
    expect(blocks.length).toBeGreaterThanOrEqual(15);
    expect(blocks.length).toBeLessThanOrEqual(20);
    expect(new Set(blocks.map((b) => b.template)).size).toBe(blocks.length);
    blocks.forEach((b) => { expect(b.kind).toBe('number'); expect(CHAPTER_BY_ID[b.chapter].part).toBe('micro'); expect(PROBLEMS[b.source], b.source).toBeTruthy(); });
    expect(new Set(blocks.map((b) => b.chapter))).toEqual(new Set(micro.map((c) => c.id)));
    blocks.slice(1).forEach((b, k) => expect(b.chapter).not.toBe(blocks[k].chapter));
    expect(EXAMS.micro.title).toContain('Микро');
  });
  it('пересдача — другие числа; тот же seed — тот же вариант', () => {
    const a = examSet('micro', 1); const b = examSet('micro', 2);
    expect(examSet('micro', 1).map((x) => x.answer)).toEqual(a.map((x) => x.answer));
    const same = a.filter((x) => b.some((y) => y.template === x.template && JSON.stringify(y.answer) === JSON.stringify(x.answer)));
    expect(same.length).toBeLessThan(4);
    // и числа не совпадают с задачами глав: ответы вариантов не равны ответам исходных задач во всех шагах
    const clones = a.filter((x) => JSON.stringify(x.answer) === JSON.stringify(PROBLEMS[x.source].block.answer));
    expect(clones.length).toBeLessThan(3);
  });
  it('итог: счёт по темам и слабые места', () => {
    const blocks = examSet('micro', 7);
    const right = Object.fromEntries(blocks.map((b) => [b.id, b.parts.map((pt) => String(pt.answer))]));
    const all = examResult(blocks, right);
    expect(all.ok).toBe(blocks.length);
    expect(all.weak).toEqual([]);
    const answers = { ...right };
    blocks.filter((b) => b.chapter === 'elasticity').forEach((b) => { answers[b.id] = ['-12345']; });
    const r = examResult(blocks, answers);
    expect(r.ok).toBe(blocks.length - 2);
    expect(r.weak.map((t) => t.chapter)).toEqual(['elasticity']);
    expect(r.rows.filter((x) => !x.ok).map((x) => PROBLEMS[x.source].chapter)).toEqual(['elasticity', 'elasticity']);
  });
  it('вперемешку: варианты только из начатых глав, у каждой задачи три разных варианта модели', () => {
    const empty = emptyProgress();
    expect(mixedChapters(empty)).toEqual([]);
    expect(mixedSet(empty)).toEqual([]);
    let p = markReadP(empty, 'elasticity');
    p = recordAnswer(p, studySecRecall('costs'), true, 1000);
    expect(mixedChapters(p).sort()).toEqual(['costs', 'elasticity']);
    let seed = 1; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const set = mixedSet(p, 4, rand);
    expect(set.length).toBe(4);
    set.forEach((it) => {
      expect(['costs', 'elasticity']).toContain(it.chapter);
      expect(it.block.chapter).toBe(it.chapter);
      expect(PROBLEMS[it.source].chapter).toBe(it.chapter);
      expect(it.options).toContain(it.chapter);
      expect(new Set(it.options).size).toBe(3);
    });
  });
  it('слабые темы: главы с наибольшей долей ошибок, не больше трёх', () => {
    let p = emptyProgress();
    const [a, b] = problemsOf('costs');
    p = recordAnswer(p, a, false, 1); p = recordAnswer(p, b, false, 2);
    const [c, d] = problemsOf('oligopoly');
    p = recordAnswer(p, c, false, 3); p = recordAnswer(p, d, true, 4);
    const [e] = problemsOf('gdp');
    p = recordAnswer(p, e, false, 5);
    const w = weakTopics(p);
    expect(w.map((t) => t.chapter)).toEqual(['costs', 'oligopoly']);
    expect(w[0]).toMatchObject({ tried: 2, wrong: 2 });
  });
});

describe('журнал занятий', () => {
  const now = new Date(2026, 8, 30, 15).getTime(); // среда
  it('минуты копятся по дням, без серий', () => {
    let p = emptyProgress();
    p = addStudyMinute(p, now); p = addStudyMinute(p, now);
    p = addStudyMinute(p, now - 2 * 24 * 3600 * 1000);
    expect(p.days[dayKey(now)]).toBe(2);
    expect(journalSummary(p.days, now)).toEqual({ days: 2, minutes: 3 });
    const weeks = journalWeeks(p.days, now);
    expect(weeks.length).toBe(4);
    weeks.forEach((w) => expect(w.length).toBe(7));
    // неделя с понедельника; сегодня — среда последней недели, дальше — будущее
    expect(weeks[3][2]).toMatchObject({ key: dayKey(now), minutes: 2, future: false });
    expect(weeks[3][3].future).toBe(true);
  });
  it('в профиле: чистка и слияние по максимуму за день', () => {
    const n = normalizeTextbook({ days: { '2026-09-30': 5, 'bad': 3, '2026-09-29': -1, '2026-09-28': 99999 } });
    expect(n.days).toEqual({ '2026-09-30': 5, '2026-09-28': 1440 });
    const m = mergeTextbook({ days: { '2026-09-30': 5, '2026-09-29': 7 } }, { days: { '2026-09-30': 9 } });
    expect(m.days).toEqual({ '2026-09-30': 9, '2026-09-29': 7 });
    expect(mergeTextbook(m, m)).toEqual(m);
  });
});

describe('игра → учебник: «Подробнее в учебнике»', () => {
  const anchors = (ch) => collectBlocks(CHAPTER_BLOCKS[ch] || [], (b) => (b.type === 'h2' || b.type === 'h3') && b.anchor).map((b) => b.anchor);
  it('все ссылки ведут в готовые главы и на существующие разделы', () => {
    ALL_BOOK_LINKS.forEach((l) => {
      expect(CHAPTER_BY_ID[l.chapter].status, l.chapter).toBe('ready');
      expect(anchors(l.chapter), `${l.chapter}#${l.anchor}`).toContain(l.anchor);
    });
  });
  it('рычаги: ставка → IS-LM и AD-AS, налоги → «Провалы рынка», норма резервов → «Деньги и банки», госзакупки → IS-LM', () => {
    expect(LEVER_BOOK.keyRate.map((l) => l.chapter)).toEqual(['is-lm', 'ad-as']);
    ['incomeTaxRate', 'vatRate', 'profitTaxRate', 'socialContribRate'].forEach((id) => expect(LEVER_BOOK[id][0].chapter).toBe('market-failures'));
    expect(LEVER_BOOK.reserveReq[0].chapter).toBe('money-banks');
    expect(LEVER_BOOK.govSpending[0].chapter).toBe('is-lm');
    Object.keys(LEVER_BOOK).forEach((id) => expect(LEVERS.some((l) => l.id === id), id).toBe(true));
  });
  it('«Почему это произошло?» и новости с цепочкой: стагфляция, секвестр, девальвация, кредитное сжатие', () => {
    Object.values(WHY_BOOK).forEach((l) => expect(ALL_BOOK_LINKS).toContain(l));
    expect(bookForChain(['Шок издержек', 'Выпуск ↓', 'Инфляция ↑', 'Дилемма ЦБ'])).toMatchObject({ chapter: 'ad-as', anchor: 'shocks' });
    expect(bookForChain(['Долг ↑', 'Премия за риск ↑', 'Рынок закрыт', 'Секвестр расходов', 'Спад ↑'])).toMatchObject({ chapter: 'is-lm', anchor: 'policy' });
    expect(bookForChain(['Резервы ↓', 'Защита курса невозможна', 'Девальвация', 'Импортные цены ↑', 'Инфляция ↑'])).toMatchObject({ chapter: 'ad-as' });
    expect(bookForChain(['Капитал ↓', 'Предложение кредита ↓', 'Инвестиции ↓', 'ВВП ↓'])).toMatchObject({ chapter: 'money-banks', anchor: 'multiplier' });
    expect(bookForChain(['Война', 'Доверие ↓'])).toBe(null);
    // новые главы: инфляция и ожидания → Филлипс, «Компас ставки» → политика, потенциал → Солоу
    expect(WHY_BOOK.inflation).toMatchObject({ chapter: 'phillips' });
    expect(WHY_BOOK.potential).toMatchObject({ chapter: 'growth' });
    expect(COMPASS_BOOK).toMatchObject({ chapter: 'policy', anchor: 'taylor' });
    expect(bookForChain(['Спрос ↑', 'Разрыв выпуска ↑', 'Инфляция ↑', 'Реакция ЦБ'])).toMatchObject({ chapter: 'phillips' });
    expect(bookForChain(['Производительность ↑', 'Потенциал ↑', 'Издержки ↓', 'Реальные зарплаты ↑'])).toMatchObject({ chapter: 'growth' });
  });
});

describe('схемы: кругооборот и балансы банков', () => {
  const sum = (rows) => rows.reduce((s, [, v]) => s + v, 0);
  it('в главах: кругооборот — в «ВВП», балансы — в «Деньгах и банках»', () => {
    expect(collectBlocks(CHAPTER_BLOCKS.gdp, (b) => b.type === 'diagram').map((b) => b.diagram)).toEqual(['circular']);
    expect(collectBlocks(CHAPTER_BLOCKS['money-banks'], (b) => b.type === 'diagram').map((b) => b.diagram)).toEqual(['balance']);
    expect(() => parseBlocks(':::diagram nope\nподпись\n:::')).toThrow();
  });
  it('кругооборот: три способа дают одно число', () => {
    const f = circularFlow(1000);
    expect(sum(f.valueAdded)).toBe(f.spending);
    expect(sum(f.incomes)).toBe(f.spending);
    // те же числа, что в разборе главы: 300 + 400 + 300
    expect(f.valueAdded.map(([, v]) => v)).toEqual([300, 400, 300]);
  });
  it('балансы: активы = пассивы на каждом шаге, кредит становится вкладом, в конце — база / норма', () => {
    const steps = balanceSteps(1000, 0.1);
    steps.forEach((s) => s.banks.forEach((b) => expect(sum(b.assets), `${s.title}: ${b.name}`).toBeCloseTo(sum(b.liab), 6)));
    expect(steps.map((s) => s.money)).toEqual([1000, 1900, 1900, 2710, 10000]);
    // шаг «кредит»: кредит и новый вклад — одна и та же сумма
    const loan = steps[1].banks[0];
    expect(loan.assets.find(([l]) => l === 'Кредит Борису')[1]).toBe(loan.liab.find(([l]) => l === 'Вклад Бориса')[1]);
    // после платежа у банка А ровно норма от вклада Анны
    expect(steps[2].banks[0].assets[0][1]).toBeCloseTo(100, 6);
    // и числа сходятся с текстом главы: 1000 + 900 + 810 + … = 10 000
    expect(CHAPTER_TEXT['money-banks']).toContain('1000 + 900 + 810');
  });
});

describe('«Продолжить учиться» в меню: те же разделы и минуты, что в учебнике', () => {
  it('указатель разделов из сборки совпадает с разделами учебника', () => {
    READY.forEach((c) => {
      const idx = indexSections(c.id);
      const book = CHAPTER_SECTIONS[c.id].filter((s) => s.recall);
      expect(idx.map((s) => [s.id, s.title, s.minutes, s.recall]), c.id).toEqual(book.map((s) => [s.id, s.title, s.minutes, s.recall]));
    });
  });
  it('карточка показывает тот же раздел и те же минуты, что «На сегодня»', () => {
    let p = emptyProgress();
    const check = () => {
      const n = nextSection(p);
      const card = todayCard(Date.now(), p);
      expect(card.section.title).toBe(n.section.title);
      expect(card.section.minutes).toBe(n.section.minutes);
      expect(card.section.chapterTitle).toBe(CHAPTER_BY_ID[n.chapter].title);
    };
    check();
    p = recordAnswer(p, nextSection(p).section.recall, true, 1000);
    p = { ...p, last: { kind: 'chapter', id: 'gdp' } };
    check();
  });
});

describe('параллельные варианты: сто случайных наборов на каждый тип', () => {
  const N = Number(process.env.VARIANT_N || 100);
  it('у каждой готовой главы есть типы вариантов базового и семинарского уровня', () => {
    READY.forEach((c) => {
      const lv = templatesOf(c.id).map((t) => t.level);
      expect(lv, c.id).toContain(1);
      expect(lv, c.id).toContain(2);
    });
    TEMPLATES.forEach((t) => { expect(PROBLEMS[t.source], `${t.id} → ${t.source}`).toBeTruthy(); expect(PROBLEMS[t.source].chapter).toBe(t.chapter); });
  });
  it.each(TEMPLATES.map((t) => [t.id]))('%s: ответы конечные, положительные где должны, проходят независимую проверку; ловушки ≠ ответу', (id) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    for (let s = 1; s <= N; s += 1) {
      const v = tpl.gen(seeded(s * 7 + 3));
      const ans = v.parts.map((pt) => pt.answer);
      ans.forEach((a, k) => {
        expect(Number.isFinite(a), `${id} seed ${s}: шаг ${k}`).toBe(true);
        if (v.parts[k].pos) expect(a, `${id} seed ${s}: шаг ${k} должен быть > 0`).toBeGreaterThan(0);
      });
      expect(v.check(ans), `${id} seed ${s}: независимая проверка`).toBe(true);
      v.traps.forEach((tr) => {
        const pt = v.parts[tr.part];
        expect(Number.isFinite(tr.value), `${id} seed ${s}: ловушка`).toBe(true);
        expect(trapDiffers(tr.value, pt.answer, pt.tol || 0), `${id} seed ${s}: ловушка ${tr.value} совпала с ответом ${pt.answer}`).toBe(true);
      });
      // и формулы условия и решения разбираются KaTeX
      const b = makeVariant(id, s * 7 + 3);
      collectMath([...b.statement, ...b.solution]).forEach((tex) => expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow());
      expect(b.traps.length).toBe(v.traps.length);
      // верный ответ, введённый как в тексте (с запятой), засчитывается
      b.parts.forEach((pt) => expect(checkAnswer(String(Math.round(pt.answer * 100) / 100).replace('.', ','), pt.answer, pt.tol, pt.unit).ok, `${id} seed ${s}`).toBe(true));
    }
  });
});
