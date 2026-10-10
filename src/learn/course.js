/* ПУТЬ: юниты, уроки и упражнения. Юнит — глава учебника, урок — карточка новой идеи
   (:::idea) и упражнения после неё (:::ex) внутри раздела главы. К упражнениям, написанным
   руками, урок добирает собранные автоматически: из ловушек числовых задач — «выбор ответа»,
   из «верно или неверно» — то же одним касанием, из графических задач — «куда сдвинется?»,
   из параллельных вариантов — быстрый расчёт с новыми числами. «Собери цепочку» нет: порядок
   слов в цепочке проверял больше русский язык, чем экономику. Модуль чистый: его читают
   тесты; экраны — src/learn.jsx. */
import { CHAPTERS, CHAPTER_BY_ID } from '../textbook/toc.js';
import { CHAPTER_BLOCKS, CHAPTER_SECTIONS, PROBLEMS } from '../textbook/content.js';
import { collectBlocks, parseInline, parseBlocks, checkAnswer } from '../textbook/markdown.js';
import { TEMPLATE_BY_ID, TEMPLATES, templatesOf, seeded } from '../textbook/variants.js';
import { GLOSSARY } from '../textbook/glossary.js';
import { CAST } from './cast.js';
import { pathBlocks } from './money.js';

// сколько секунд на упражнение: одно касание — около десяти, расчёт и сборка — дольше
export const SECONDS = { choice: 12, gap: 12, tf: 10, shift: 12, news: 16, match: 22, sort: 22, calc: 28, tiles: 20, curve: 15, price: 18, point: 15, swipe: 60, rush: 60, open: 30, domino: 35 };
export const IDEA_SECONDS = 25;
export const KIND_LABEL = {
  choice: 'Выбор ответа', gap: 'Заполните пропуск', tf: 'Верно или неверно', shift: 'Куда сдвинется?',
  news: 'Газета', match: 'Сопоставьте пары', sort: 'Разложите по корзинам', calc: 'Быстрый расчёт',
  tiles: 'Соберите определение', curve: 'Сдвиньте кривую', price: 'Найдите цену', point: 'Отметьте равновесие',
  swipe: 'Мини-игра', rush: 'Мини-игра на время', open: 'Как бы вы поступили?', domino: 'Домино',
};
/* «Домино»: ученик сам выкладывает цепочку причин; неверное звено роняет домино с этого места,
   разбор — и он продолжает с верного места. Проверяется само, когда цепочка собрана: засчитано,
   если домино ни разу не упало. */
export const SELF_CHECK = ['domino'];
/* Открытый вопрос в конце истории: письменный ответ и разбор. Неверного ответа у него нет — он
   не идёт ни в ошибки, ни в повторение, ни в проверку юнита. */
export const OPEN_MIN = 15;
// мини-игры: у них свой счёт внутри, в проверку юнита и повторение они не идут
export const GAME_KINDS = ['swipe', 'rush'];
/* Мини-игра урока — одна, на минуту (на алмазном уровне — 45 секунд): карточки идут по кругу,
   пока не кончится время; засчитана — чистый счёт от восьми: верных минус ошибок
   (docs/mechanics.md, «Мини-игра — зачёт»). */
export const GAME_PASS = 8;
export const gameNet = (right, answered) => right - (answered - right);
// сколько ещё чистых верных нужно до зачёта (0 — зачёт есть)
export const gameLeft = (right, answered) => Math.max(0, GAME_PASS - gameNet(right, answered));
export const GAME_SECONDS = 60;
export const DIAMOND_GAME_SECONDS = 45;
/* Рынок из упражнений с графиком: Q_D = a − bP + dA, Q_S = c + dP + dC. Равновесие — где
   объёмы равны: P* = (a + dA − c − dC) / (b + d). */
export function equilibrium({ a, b, c, d, dA = 0, dC = 0 }) {
  const p = (a + dA - c - dC) / (b + d);
  return { p, q: a + dA - b * p };
}
export const qd = (m, p) => m.a + (m.dA || 0) - m.b * p;
export const qs = (m, p) => m.c + (m.dC || 0) + m.d * p;
// оси графика: цена от нуля до цены, при которой спрос исчезает; объём — с запасом на сдвиги
export const marketAxes = (m) => ({ pMax: Math.ceil((m.a + Math.max(0, m.dA || 0)) / m.b / 5) * 5 + 5, qMax: Math.ceil((m.a + 40) / 10) * 10 });
export const CURVE_STEP = 10;
/* «куда сдвинется?»: какой ползунок графика — какая кривая, как называть направления и
   какие стрелки рисовать на кнопках. Ключ ответа — буква кривой и знак: «D+», «Y-». */
const LR = { plus: 'вправо', minus: 'влево', up: '→', down: '←' };
export const SHIFT_CURVES = {
  'supply-demand': { D: { control: 'dA', label: 'Спрос', ...LR }, S: { control: 'dC', label: 'Предложение', ...LR } },
  ppf: {
    X: { control: 'tx', label: 'Конец КПВ на оси хлеба', short: 'Хлеб', plus: 'наружу', minus: 'внутрь', up: '→', down: '←' },
    Y: { control: 'ty', label: 'Конец КПВ на оси станков', short: 'Станки', plus: 'наружу', minus: 'внутрь', up: '↑', down: '↓' },
  },
};
const curveOf = (chart, key) => SHIFT_CURVES[chart][key[0]];
export const shiftLabel = (chart, key) => { const c = curveOf(chart, key); return `${c.label} ${key[1] === '+' ? c.plus : c.minus}`; };
// надпись на кнопке: «Спрос →», «← Спрос», «Станки ↑»
export const shiftButton = (chart, key) => {
  const c = curveOf(chart, key); const name = c.short || c.label;
  return key[1] === '+' ? `${name} ${c.up}` : c.down === '←' ? `← ${name}` : `${name} ${c.down}`;
};
export const shiftChoices = (chart) => Object.keys(SHIFT_CURVES[chart]).flatMap((k) => [`${k}+`, `${k}-`]);

const fmt = (x) => String(Math.round(x * 100) / 100).replace('.', ',').replace('-', '−');
const withUnit = (x, unit) => `${fmt(x)}${unit ? ` ${unit}` : ''}`;
const text = (s) => parseInline(s);

/* ------------------------------ ЮНИТЫ И УРОКИ ------------------------------ */
function sectionOf(chapterId, block) {
  const s = (CHAPTER_SECTIONS[chapterId] || []).find((x) => collectBlocks(x.blocks, (b) => b === block).length);
  return s ? s.id : null;
}

// автоупражнения из задач главы: на Пути — в кронах и с героями (src/learn/money.js)
const fromProblem = (pid) => pathBlocks(fromProblemRaw(pid));
function fromProblemRaw(pid) {
  const p = PROBLEMS[pid];
  if (!p) throw new Error(`Нет задачи ${pid}`);
  const b = p.block;
  const base = { id: `auto:${pid}`, source: pid, prompt: b.statement, explain: b.solution };
  if (b.kind === 'number' && b.parts.length === 1) {
    const pt = b.parts[0];
    if ((b.traps || []).length) {
      const correct = withUnit(pt.answer, pt.unit);
      const seen = new Set([correct]);
      const wrong = b.traps.map((tr) => ({ raw: withUnit(tr.value, pt.unit), why: tr.text })).filter((o) => !seen.has(o.raw) && seen.add(o.raw));
      return { ...base, kind: 'choice', options: [{ raw: correct, correct: true, why: null }, ...wrong.map((o) => ({ ...o, correct: false }))].map((o) => ({ ...o, text: text(o.raw) })) };
    }
    return { ...base, kind: 'calc', answer: pt.answer, tol: pt.tol, unit: pt.unit, traps: [] };
  }
  if (b.kind === 'truefalse') return { ...base, kind: 'tf', answer: b.answer, wrongWhy: (b.traps || []).map((t) => t.text)[0] || null };
  if (b.kind === 'graph' && SHIFT_CURVES[b.chart]) {
    const curves = SHIFT_CURVES[b.chart];
    const [control, value] = Object.entries(b.reference)[0];
    const curve = Object.keys(curves).find((k) => curves[k].control === control);
    const answer = `${curve}${value > 0 ? '+' : '-'}`;
    const traps = (b.traps || []).flatMap((t) => { const c = Object.keys(curves).find((k) => curves[k].control === t.control); return c ? ['+', '-'].map((d) => ({ key: `${c}${d}`, why: t.text })) : []; })
      .filter((t) => t.key !== answer);
    // в учебнике кривую двигают ползунком, здесь — одним касанием по стрелке
    const prompt = [...JSON.parse(JSON.stringify(b.statement), (k, v) => (k === 'v' && typeof v === 'string' ? v.replace(/\s*Сдвиньте[^.]*\./g, '') : v)),
      ...parseBlocks('Какая кривая сдвинется и куда?')];
    return { ...base, prompt, kind: 'shift', chart: b.chart, chartAttrs: b.attrs, answer, choices: shiftChoices(b.chart), traps };
  }
  throw new Error(`Задачу ${pid} нельзя превратить в упражнение`);
}
// руками написанное упражнение → общий вид
function fromBlock(b) {
  const e = { id: b.id, kind: b.kind, prompt: b.prompt, explain: b.explain, ...(b.context ? { context: b.context } : {}) };
  switch (b.kind) {
    case 'choice': case 'gap': return { ...e, options: b.options };
    case 'tf': return { ...e, answer: b.answer, wrongWhy: null };
    case 'match': return { ...e, pairs: b.pairs };
    case 'sort': return { ...e, bins: b.bins, items: b.items };
    case 'calc': return b.variant ? { ...e, variant: b.variant } : { ...e, answer: b.answer, tol: b.tol, unit: b.unit, traps: b.traps };
    case 'shift': return { ...e, chart: b.chart, chartAttrs: b.chartAttrs, answer: b.answer, choices: b.choices || shiftChoices(b.chart), traps: b.traps };
    case 'news': return { ...e, headline: b.headline, vars: b.vars, expect: b.expect };
    case 'tiles': return { ...e, solution: b.solution, extra: b.extra };
    case 'curve': return { ...e, market: b.market, answer: b.answer, only: b.only, traps: b.traps };
    case 'price': return { ...e, market: b.market, start: b.start };
    case 'point': return { ...e, market: b.market };
    case 'open': return e;
    case 'domino': return { ...e, headline: b.headline, scene: b.scene, links: b.links, decoys: b.decoys };
    default: throw new Error(b.kind);
  }
}
// мини-игра → упражнение со своим счётом; chart — график, который меняют карточки
function fromGame(g) {
  return { id: g.id, kind: g.kind, title: g.title, prompt: g.prompt, explain: null, game: true, items: g.items, labels: g.labels, seconds: g.seconds || GAME_SECONDS,
    chart: g.chart || null, ...(g.market ? { market: g.market } : {}) };
}
/* «Слова»: упражнения из слов урока — определение из плиток (первые три слова), пары «термин —
   определение» на время (по четыре) и «какой это термин?» для остальных. Плитки — по два
   слова определения; лишние плитки берутся из определения соседнего слова. */
const chunk = (textStr) => { const w = textStr.split(/\s+/); const out = []; for (let k = 0; k < w.length; k += 2) out.push(w.slice(k, k + 2).join(' ')); return out; };
const termName = (id) => { if (!GLOSSARY[id]) throw new Error(`Нет термина ${id} в словаре`); return GLOSSARY[id].title; };
function wordsExercises(lessonId, terms) {
  const out = [];
  const wordsOf = (x) => new Set(x.toLowerCase().split(/[\s,]+/).filter(Boolean));
  terms.slice(0, 3).forEach((t, k) => {
    // лишние плитки — из определения, где нет ни одного слова верного: иначе из плиток
    // можно собрать второе правдоподобное определение
    const own = wordsOf(t.text);
    const other = terms.slice(k + 1).concat(terms.slice(0, k)).find((o) => ![...wordsOf(o.text)].some((w) => own.has(w)));
    if (!other) throw new Error(`Для плиток «${t.term}» нет слова без общих слов`);
    out.push({ id: `${lessonId}:tiles:${t.term}`, kind: 'tiles', prompt: parseBlocks(`Соберите из плиток определение: **${termName(t.term)}**.`), explain: null,
      solution: chunk(t.text), extra: chunk(other.text).slice(0, 2) });
  });
  for (let k = 0; k + 4 <= terms.length; k += 4) {
    const group = terms.slice(k, k + 4).map((t) => termName(t.term));
    out.push({ id: `${lessonId}:pairs:${k / 4}`, kind: 'match', seconds: 40, prompt: parseBlocks(`Соедините с определениями: ${group.join(', ')} — на время, 40 секунд.`), explain: null,
      pairs: terms.slice(k, k + 4).map((t) => [{ raw: termName(t.term), text: text(termName(t.term)) }, { raw: t.text, text: text(t.text) }]) });
  }
  terms.slice(3).forEach((t, k) => {
    const others = terms.filter((x) => x !== t).slice(k % 3, (k % 3) + 3);
    out.push({ id: `${lessonId}:which:${t.term}`, kind: 'choice', prompt: parseBlocks(`Какой это термин: «${t.text}»?`), explain: null,
      options: [{ raw: termName(t.term), text: text(termName(t.term)), correct: true, why: null }, ...others.map((o) => ({ raw: termName(o.term), text: text(termName(o.term)), correct: false, why: null }))] });
  });
  return out;
}

/* Уроки юнита: у каждого карточка идеи и упражнения — свои и автоматические (из задач,
   названных в auto, и параллельных вариантов из variants). Шаги со словом diamond и всё после
   них — алмазный уровень урока: их видно только при повторном, усложнённом прохождении. */
/* Виды уроков (LESSON_KIND): «Знакомство», «История», «Слушай» — шаги (первая карточка урока и
   карточки more), после каждого шага — вопрос; «Итоги юнита» — пункты-карточки подряд, потом
   тест по юниту; «Практика» — только упражнения; «Слова» — карточки слов, потом упражнения из
   них; «Мини-игра» — раунды :::round; «Повторение» — упражнения юнита, ошибки первыми. */
const STEP_KINDS = ['intro', 'story', 'listen', 'summary'];
function lessonsOf(chapterId) {
  const blocks = CHAPTER_BLOCKS[chapterId];
  if (!blocks) return [];
  const seq = collectBlocks(blocks, (b) => b.type === 'idea' || b.type === 'ex' || b.type === 'round');
  const out = [];
  // упражнение после алмазного шага — тоже алмазное
  const push = (cur, e) => cur.exercises.push(cur.diamond ? { ...e, diamond: true } : e);
  const addAuto = (cur, b) => {
    b.auto.forEach((pid) => push(cur, fromProblem(pid)));
    b.variants.forEach((v) => { if (!TEMPLATE_BY_ID[v]) throw new Error(`Нет варианта ${v}`); push(cur, { id: `var:${v}`, kind: 'calc', variant: v }); });
  };
  seq.forEach((b) => {
    if (b.type === 'idea' && b.inner) {
      // следующий шаг урока — перед упражнением, которое идёт следом
      if (!out.length) throw new Error(`Карточка ${b.id} раньше первого урока`);
      const cur = out[out.length - 1];
      if (b.who && !CAST[b.who]) throw new Error(`Нет героя ${b.who} (${b.id})`);
      if (cur.diamond && !b.diamond) throw new Error(`Обычный шаг ${b.id} после алмазного: алмазные шаги — в конце урока`);
      if (b.diamond) cur.diamond = true;
      // «Откройте сами» — первым шагом урока, до карточки-идеи: сначала ученик пробует сам, потом ему объясняют
      if (b.discover) {
        if (cur.kind !== 'intro' || cur.exercises.length || cur.inner.length !== 1) throw new Error(`Шаг «Откройте сами» ${b.id} — сразу после первой карточки «Знакомства»`);
        cur.inner.unshift({ at: 0, idea: b, discover: true });
        return;
      }
      cur.inner.push({ at: cur.exercises.length, idea: b, ...(b.diamond ? { diamond: true } : {}) });
      addAuto(cur, b);
    } else if (b.type === 'idea') {
      if (b.who && !CAST[b.who]) throw new Error(`Нет героя ${b.who} (${b.id})`);
      out.push({ id: b.id, unitId: chapterId, no: out.length + 1, title: b.title, kind: b.kind, idea: b, section: sectionOf(chapterId, b), exercises: [], hard: b.hard || [],
        inner: STEP_KINDS.includes(b.kind) ? [{ at: 0, idea: b }] : [], terms: b.terms || null });
      const cur = out[out.length - 1];
      if (b.kind === 'words') {
        if (!b.terms || b.terms.length < 4) throw new Error(`В уроке «Слова» ${b.id} меньше четырёх слов`);
        wordsExercises(b.id, b.terms).forEach((e) => cur.exercises.push(e));
      }
      addAuto(cur, b);
    } else if (out.length) {
      const cur = out[out.length - 1];
      if (b.type === 'ex') push(cur, fromBlock(b));
      else cur.exercises.push(fromGame(b));
    }
  });
  out.forEach((l) => { delete l.diamond; });
  /* вопрос «Истории» без её шага непонятен («Маша двигает цену…»): вне урока — во вступительном
     тесте, проверке юнита, повторении — перед условием встаёт шаг, после которого он шёл */
  out.filter((l) => l.kind === 'story').forEach((l) => {
    l.exercises = l.exercises.map((e, k) => {
      if (e.context) return e;
      const step = l.inner.filter((c) => c.at <= k).pop();
      return step ? { ...e, context: step.idea.text } : e;
    });
  });
  return out;
}

/* УРОВНИ: юниты Пути разбиты на пять ступеней, от терминов до полноценного анализа. Путь идёт
   по уровням, внутри уровня — по порядку глав учебника. */
export const LEVELS = [
  { id: 'start', title: 'Начальный', text: 'Вы знаете основные термины: деньги, цена, доход, расход.' },
  { id: 'basic', title: 'Базовый', text: 'Вы понимаете спрос, предложение, рынок, налоги, инфляцию.' },
  { id: 'middle', title: 'Средний', text: 'Вы умеете анализировать графики, бюджет, прибыль и экономические ситуации.' },
  { id: 'advanced', title: 'Продвинутый', text: 'Вы понимаете экономические модели, статистику и сложные процессы.' },
  { id: 'pro', title: 'Профессиональный', text: 'Вы умеете проводить полноценный экономический анализ.' },
];
export const UNIT_LEVEL = {
  scarcity: 'start',
  'supply-demand': 'basic', elasticity: 'basic', 'market-failures': 'basic', 'money-banks': 'basic',
  consumer: 'middle', production: 'middle', costs: 'middle', 'competition-monopoly': 'middle', monopolistic: 'middle', labor: 'middle',
  oligopoly: 'advanced', gdp: 'advanced', 'is-lm': 'advanced', 'ad-as': 'advanced', phillips: 'advanced',
  policy: 'pro', growth: 'pro', 'open-economy': 'pro', 'public-debt': 'pro', inequality: 'pro',
};
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l, k) => [l.id, { ...l, no: k + 1 }]));
export const levelOf = (unitId) => LEVEL_BY_ID[UNIT_LEVEL[unitId] || 'pro'];
const levelRank = (id) => LEVELS.findIndex((l) => l.id === (UNIT_LEVEL[id] || 'pro'));
export const UNITS = CHAPTERS.map((c, k) => ({ id: c.id, title: c.title, part: c.part, ready: c.status === 'ready', lessons: lessonsOf(c.id), level: UNIT_LEVEL[c.id] || 'pro', order: k }))
  .sort((a, b) => levelRank(a.id) - levelRank(b.id) || a.order - b.order);
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const LESSONS = UNITS.flatMap((u) => u.lessons);
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const EXERCISES = Object.fromEntries(LESSONS.flatMap((l) => l.exercises.map((e) => [e.id, { ...e, lesson: l.id, unitId: l.unitId }])));
export const pilotUnits = () => UNITS.filter((u) => u.lessons.length);

/* ------------------------------ ЭКЗЕМПЛЯР УПРАЖНЕНИЯ ------------------------------
   То, что видит ученик: варианты перемешаны, у расчёта по варианту — новые числа. */
function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
let uidSeq = 0;
// вопрос из «Слушай» вне эфира (повторение, практика, проверка, повтор после ошибки): сначала — что прозвучало
const outOfAir = (ex, extra) => !!(ex.context && (extra.review || extra.practice || extra.check || extra.weak || extra.outside));
export function instantiate(ex, rand = Math.random, extra = {}) {
  const prompt = outOfAir(ex, extra) ? [{ type: 'p', inline: ex.context }, ...ex.prompt] : ex.prompt;
  const base = { uid: `u${uidSeq += 1}`, id: ex.id, kind: ex.kind, lesson: ex.lesson, unitId: ex.unitId, prompt, explain: ex.explain || null, seconds: SECONDS[ex.kind], ...extra };
  switch (ex.kind) {
    case 'choice': case 'gap':
      return { ...base, options: shuffle(ex.options.map((o, k) => ({ key: `o${k}`, text: o.text, raw: o.raw, correct: o.correct, why: o.why })), rand) };
    case 'tf': return { ...base, answer: ex.answer, wrongWhy: ex.wrongWhy || null };
    case 'match': {
      const pairs = ex.pairs.map(([l, r], k) => ({ key: `p${k}`, left: l, right: r }));
      return { ...base, ...(ex.seconds ? { timer: ex.seconds } : {}), left: shuffle(pairs.map((p) => ({ key: p.key, text: p.left.text, raw: p.left.raw })), rand), right: shuffle(pairs.map((p) => ({ key: p.key, text: p.right.text, raw: p.right.raw })), rand) };
    }
    case 'sort': return { ...base, bins: ex.bins, items: shuffle(ex.items.map((it, k) => ({ key: `s${k}`, text: it.text, raw: it.raw, bin: it.bin })), rand) };
    case 'calc': {
      if (ex.variant) {
        const tpl = TEMPLATE_BY_ID[ex.variant];
        const v = tpl.gen(seeded(Math.floor(rand() * 2 ** 31) + 1));
        const pt = v.parts[0];
        return { ...base, variant: ex.variant, source: tpl.source, prompt: parseBlocks(v.statement), explain: parseBlocks(v.solution), answer: pt.answer, tol: pt.tol != null ? pt.tol : null, unit: pt.unit || '',
          traps: v.traps.filter((t) => t.part === 0).map((t) => ({ value: t.value, why: text(t.text) })) };
      }
      return { ...base, answer: ex.answer, tol: ex.tol, unit: ex.unit, traps: ex.traps || [] };
    }
    case 'shift': return { ...base, chart: ex.chart, chartAttrs: ex.chartAttrs, answer: ex.answer, choices: ex.choices.map((key) => ({ key, label: shiftLabel(ex.chart, key), button: shiftButton(ex.chart, key) })), traps: ex.traps || [] };
    case 'news': return { ...base, headline: ex.headline, vars: ex.vars, expect: ex.expect };
    case 'tiles': {
      const sol = ex.solution.map((t, k) => ({ key: `t${k}`, text: t }));
      const extra = ex.extra.map((t, k) => ({ key: `x${k}`, text: t }));
      return { ...base, tiles: shuffle([...sol, ...extra], rand), solution: sol.map((t) => t.key) };
    }
    case 'curve': return { ...base, market: ex.market, answer: ex.answer, only: ex.only || null, traps: ex.traps || [], step: CURVE_STEP };
    case 'price': { const eq = equilibrium(ex.market); return { ...base, market: ex.market, start: ex.start, answer: Math.round(eq.p * 100) / 100 }; }
    case 'point': { const eq = equilibrium(ex.market); return { ...base, market: ex.market, answer: { q: eq.q, p: eq.p } }; }
    case 'open': return { ...base, noRetry: true };
    case 'domino': {
      const links = ex.links.map((l, k) => ({ key: `l${k}`, text: l.text, raw: l.raw, effects: l.effects, link: k }));
      const decoys = ex.decoys.map((d, k) => ({ key: `f${k}`, text: d.text, raw: d.raw, why: d.why, link: null }));
      return { ...base, headline: ex.headline, scene: ex.scene, chain: links.map((l) => l.key), deck: shuffle([...links, ...decoys], rand) };
    }
    case 'swipe': case 'rush':
      return { ...base, title: ex.title, labels: ex.labels, seconds: extra.seconds || ex.seconds || SECONDS[ex.kind], chart: ex.chart || null, ...(ex.market ? { market: ex.market } : {}),
        items: shuffle(ex.items.map((it, k) => ({ key: `g${k}`, text: it.text, raw: it.raw, side: it.side, effect: it.effect || null })), rand) };
    default: throw new Error(ex.kind);
  }
}

/* ------------------------------ ПРОВЕРКА ОТВЕТА ------------------------------
   Возвращает { ok, why } — why: объяснение выбранной ошибки (ловушки), если оно есть. */
const trapTol = (tol, v) => Math.max(tol || 0, 0.01 * Math.abs(v));
export function check(inst, resp) {
  switch (inst.kind) {
    case 'choice': case 'gap': {
      const o = inst.options.find((x) => x.key === resp);
      return { ok: !!(o && o.correct), why: o && !o.correct ? o.why : null };
    }
    case 'tf': return { ok: resp === inst.answer, why: resp !== inst.answer ? inst.wrongWhy : null };
    case 'match': return { ok: !!resp && inst.left.every((l) => resp[l.key] === l.key), why: null };
    case 'sort': return { ok: !!resp && inst.items.every((it) => resp[it.key] === it.bin), why: null };
    case 'calc': {
      const r = checkAnswer(resp, inst.answer, inst.tol, inst.unit);
      if (r.ok) return { ok: true, why: null };
      const tr = r.value != null && inst.traps.find((t) => Math.abs(r.value - t.value) <= trapTol(inst.tol, t.value));
      return { ok: false, why: tr ? tr.why : null, empty: r.value == null };
    }
    case 'shift': {
      const tr = inst.traps.find((t) => t.key === resp);
      return { ok: resp === inst.answer, why: resp !== inst.answer && tr ? tr.why : null };
    }
    case 'news': return { ok: !!resp && inst.vars.every((v) => resp[v.key] === inst.expect[v.key]), why: null };
    case 'tiles': return { ok: Array.isArray(resp) && resp.length === inst.solution.length && resp.every((k, i) => k === inst.solution[i]), why: null };
    case 'curve': {
      // сдвинуть нужно одну кривую и в нужную сторону; вторая остаётся на месте
      const moved = ['D', 'S'].filter((k) => resp && resp[k]);
      const key = moved.length === 1 ? `${moved[0]}${resp[moved[0]] > 0 ? '+' : '-'}` : null;
      const tr = key && inst.traps.find((t) => t.key === key);
      return { ok: key === inst.answer, why: key !== inst.answer && tr ? tr.why : null };
    }
    case 'price': {
      const p = Number(resp);
      if (Math.abs(p - inst.answer) < 1e-9) return { ok: true, why: null };
      const gap = Math.round(Math.abs(qd(inst.market, p) - qs(inst.market, p)));
      return { ok: false, why: text(p < inst.answer ? `При цене ${fmt(p)} покупатели хотят на ${gap} больше, чем продают: дефицит — цену надо поднять.` : `При цене ${fmt(p)} продают на ${gap} больше, чем покупают: избыток — цену надо снизить.`) };
    }
    case 'point': {
      const ax = marketAxes(inst.market);
      const ok = !!resp && Math.abs(resp.q - inst.answer.q) <= ax.qMax * 0.06 && Math.abs(resp.p - inst.answer.p) <= ax.pMax * 0.06;
      return { ok, why: ok ? null : text('Равновесие — там, где кривые пересекаются: объём спроса равен объёму предложения.') };
    }
    case 'swipe': case 'rush': return { ok: gameOk(inst, resp), why: null };
    // открытый вопрос: любой продуманный ответ засчитан, дальше — разбор
    case 'open': return { ok: String(resp || '').trim().length >= OPEN_MIN, why: null };
    case 'domino': {
      const falls = resp && resp.falls ? resp.falls.length : 0;
      const ok = !!(resp && resp.done) && falls === 0;
      return { ok, why: ok ? null : text(`Цепочка собрана, но домино падало ${falls} ${falls % 10 === 1 && falls % 100 !== 11 ? 'раз' : 'раза'}: каждое звено должно прямо следовать из предыдущего.`) };
    }
    default: return { ok: false, why: null };
  }
}
// мини-игра засчитана: верных минус ошибок — не меньше восьми
export function gameOk(inst, resp) {
  if (!resp || !resp.done) return false;
  return gameLeft(resp.right, resp.answered) === 0;
}
/* Очки игры: за верный ответ — 10 × множитель серии (каждые три верных подряд — ещё +1, не
   больше ×4); ошибка серию обнуляет. */
export const comboOf = (streakNow) => Math.min(4, 1 + Math.floor(streakNow / 3));
export function gameScore(answers) {
  let run = 0; let score = 0; let best = 0;
  answers.forEach((ok) => { if (ok) { run += 1; score += 10 * comboOf(run - 1); best = Math.max(best, run); } else run = 0; });
  return { score, bestRun: best };
}
// ответ заполнен настолько, что можно нажать «Проверить»
export function ready(inst, resp) {
  if (resp == null) return false;
  switch (inst.kind) {
    case 'match': return Object.keys(resp).length === inst.left.length;
    case 'sort': return Object.keys(resp).length === inst.items.length;
    case 'news': return inst.vars.every((v) => resp[v.key]);
    case 'calc': return String(resp).trim().length > 0;
    case 'tiles': return Array.isArray(resp) && resp.length > 0;
    case 'curve': return !!(resp.D || resp.S);
    case 'point': return Number.isFinite(resp.q) && Number.isFinite(resp.p);
    case 'swipe': case 'rush': return !!resp.done;
    case 'open': return String(resp).trim().length >= OPEN_MIN;
    case 'domino': return !!resp.done;
    default: return true;
  }
}
// правильный ответ словами — для красной плашки
export function answerText(inst) {
  const plain = (nodes) => (nodes || []).map((n) => (n.t === 'text' || n.t === 'math' ? n.v : n.c ? plain(n.c) : '')).join('');
  switch (inst.kind) {
    case 'choice': case 'gap': return plain(inst.options.find((o) => o.correct).text);
    case 'tf': return inst.answer ? 'Верно' : 'Неверно';
    case 'match': return inst.left.map((l) => `${plain(l.text)} — ${plain(inst.right.find((r) => r.key === l.key).text)}`).join('; ');
    case 'sort': return inst.bins.map((b) => `${b}: ${inst.items.filter((it) => it.bin === b).map((it) => plain(it.text)).join(', ')}`).join('; ');
    case 'calc': return withUnit(inst.answer, inst.unit);
    case 'shift': return shiftLabel(inst.chart, inst.answer);
    case 'news': return inst.vars.map((v) => `${v.label} ${({ '+': '↑', '-': '↓', 0: '—' })[inst.expect[v.key]]}`).join(', ');
    case 'tiles': return inst.solution.map((k) => inst.tiles.find((t) => t.key === k).text).join(' ');
    case 'curve': return shiftLabel('supply-demand', inst.answer);
    case 'price': return `цена ${fmt(inst.answer)}`;
    case 'point': return `объём ${fmt(inst.answer.q)}, цена ${fmt(inst.answer.p)}`;
    case 'swipe': case 'rush': return `верных минус ошибок — не меньше ${GAME_PASS}`;
    case 'open': return 'свой ответ — пара продуманных предложений';
    case 'domino': return inst.chain.map((k) => plain(inst.deck.find((c) => c.key === k).text)).join(' → ');
    default: return '';
  }
}

/* ------------------------------ СБОРКА УРОКА ------------------------------
   Свои упражнения урока плюс повторение прошлых уроков юнита — около трети урока, всего
   10–15. Повторение вперемешку со своими, первым идёт своё упражнение. */
export const LESSON_KIND = {
  intro: 'Знакомство', practice: 'Практика', words: 'Слова', story: 'История', listen: 'Слушай', game: 'Мини-игра', review: 'Повторение', summary: 'Итоги юнита',
};
// картинки шагов «Знакомства» (pic=…): значки, которые рисует src/learn.jsx
export const STEP_PICS = ['clock', 'scale', 'hourglass', 'ticket', 'trending-up', 'circle-check', 'medal', 'arrow-left-right', 'handshake',
  'coffee', 'wallet', 'link', 'utensils', 'boxes', 'users', 'snowflake', 'arrow-down-to-line', 'arrow-up-to-line', 'croissant', 'landmark', 'radio', 'flag'];
// шаг читается секунд за пятнадцать, карточка слова — за восемь, пункт итогов — за десять
export const STEP_SECONDS = 15;
// «Откройте сами»: пять-шесть дней в кофейне — около сорока пяти секунд
export const DISCOVER_SECONDS = 45;
const stepsSeconds = (inner) => inner.reduce((s, c) => s + (c.discover ? DISCOVER_SECONDS : STEP_SECONDS), 0);
export const FLASH_SECONDS = 8;
export const POINT_SECONDS = 10;
// в практике — не больше десяти своих упражнений за раз: при повторе урока набор другой
export const PRACTICE_OWN = 10;
export const REVIEW_SIZE = 12;
// упражнения, годные для повторения и проверок: в одно действие, без игрового счёта
const reviewable = (e) => !GAME_KINDS.includes(e.kind) && e.kind !== 'open';
// и без алмазных: их видели только те, кто проходил урок на алмазном уровне
const basic = (e) => reviewable(e) && !e.diamond;
const stepCards = (lesson, items, inner = lesson.inner) => {
  const cards = {};
  inner.forEach((c) => { if (items[c.at]) (cards[items[c.at].uid] = cards[items[c.at].uid] || []).push(c.idea); });
  return cards;
};
const sum = (items) => items.reduce((a, it) => a + (it.seconds || SECONDS[it.kind]), 0);
// карточки слов урока «Слова»: слово — на лицевой стороне, короткое определение — на обороте
export const flashCards = (lesson) => lesson.terms.map((t) => ({ id: `${lesson.id}:card:${t.term}`, flash: true, term: t.term, title: termName(t.term), text: text(t.text), ...(t.example ? { example: text(t.example) } : {}) }));
/* Меньше повторов: seen — сколько раз ученик уже встречал упражнение (learn.seen). В
   повторение, проверку и тест юнита первыми идут те, что он видел реже; задача, которая
   вернётся с новыми числами, повтором не считается. */
const canRenumber = (e) => !!(e.variant || (e.source && TEMPLATE_BY_SOURCE[e.source]));
const timesSeen = (e, seen) => (canRenumber(e) ? 0 : (seen[e.id] || 0));
const bySeen = (list, seen, rand) => shuffle(list, rand).map((e, k) => [e, timesSeen(e, seen), k]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);

/* Персональная программа (src/learn/program.js) подстраивает урок:
   level — «easy» (точность ниже 60%): в выборе ответа три варианта вместо четырёх, а разбор
   ошибки — по шагам (steps); «hard» (выше 90%): в практике часть упражнений заменяют задачи
   семинарского и олимпиадного уровня (hard: 2 или 3);
   weak — уроки со слабой точностью: их упражнения первыми идут в «Повторение»;
   seen — сколько раз ученик видел каждое упражнение: реже виденное — первым;
   diamond — алмазный уровень: повтор пройденного урока с усложнением (см. ниже). */
export function buildLesson(lessonId, rand = Math.random, opts = {}) {
  if (opts.diamond) return buildDiamond(lessonId, rand, opts);
  const p = buildLessonBase(lessonId, rand, opts);
  const level = opts.level || 'normal';
  if (level === 'easy') p.items = p.items.map((it) => easier(it, rand));
  return p;
}
/* ------------------------------ ПОВТОР БЕЗ ЗУБРЁЖКИ ------------------------------
   Задача, которая возвращается (после ошибки в уроке, в «Повторении», в практике), не
   должна быть той же самой — иначе запоминается ответ, а не решение. По порядку:
   1) у задачи есть генератор вариантов — те же условия с новыми числами;
   2) у автоупражнения из задачи главы есть параллельный вариант — расчёт с новыми числами;
   3) похожий вопрос на ту же тему: из того же шага урока, иначе того же вида или любой ещё не
      заданный из урока, иначе из урока раньше этого в том же разделе главы (того же вида, если есть) —
      из уроков дальше по Пути никогда: там может быть тема, которой ещё не учили;
   4) если ничего нет — та же задача с перемешанными вариантами.
   fresh — что вышло ('numbers' | 'sibling' | 'same'), of — id исходной задачи. */
// первый тип вариантов на задачу (базовый раньше семинарского): автоупражнение из задачи возвращается им
const TEMPLATE_BY_SOURCE = {};
TEMPLATES.filter((t) => t.gen(seeded(1)).parts.length === 1).forEach((t) => { if (!TEMPLATE_BY_SOURCE[t.source]) TEMPLATE_BY_SOURCE[t.source] = t.id; });
function siblingOf(ex, avoid, rand) {
  const lesson = LESSON_BY_ID[ex.lesson];
  if (!lesson) return null;
  const list = lesson.exercises;
  const idx = list.findIndex((e) => e.id === ex.id);
  const free = (e) => e.id !== ex.id && !avoid.has(e.id) && reviewable(e) && (!e.diamond || !!ex.diamond);
  let pool = [];
  if (lesson.inner.length && idx >= 0) {
    const starts = lesson.inner.map((c) => c.at);
    const from = Math.max(...starts.filter((a) => a <= idx), 0);
    const to = starts.filter((a) => a > idx).sort((a, b) => a - b)[0] ?? list.length;
    pool = list.slice(from, to).filter(free);
  }
  if (!pool.length) pool = list.filter((e) => free(e) && e.kind === ex.kind);
  if (!pool.length) pool = list.filter(free);
  // в уроке всё уже спрошено — вопрос того же вида из другого урока того же раздела главы
  if (!pool.length) {
    // только из уроков раньше этого: позже может быть тема, которой ещё не учили
    const near = UNIT_BY_ID[lesson.unitId].lessons.filter((l) => l.no < lesson.no && l.section === lesson.section).flatMap((l) => l.exercises).filter(free);
    pool = near.filter((e) => e.kind === ex.kind);
    if (!pool.length) pool = near;
  }
  if (!pool.length) return null;
  return EXERCISES[pool[Math.floor(rand() * pool.length)].id];
}
export function freshCopy(ex, rand = Math.random, extra = {}, { avoid = new Set(), sibling = true } = {}) {
  if (ex.variant) return instantiate(ex, rand, { ...extra, fresh: 'numbers', of: ex.id });
  const tpl = ex.source && TEMPLATE_BY_SOURCE[ex.source];
  if (tpl) return instantiate({ id: `var:${tpl}`, kind: 'calc', variant: tpl, lesson: ex.lesson, unitId: ex.unitId }, rand, { ...extra, fresh: 'numbers', of: ex.id });
  const sib = sibling ? siblingOf(ex, avoid, rand) : null;
  if (sib) return instantiate(sib, rand, { ...extra, fresh: 'sibling', of: ex.id });
  return instantiate(ex, rand, { ...extra, fresh: 'same' });
}
// повтор после ошибки в уроке: avoid — задачи, которые уже есть в этом уроке
export function retryOf(inst, rand = Math.random, avoid = []) {
  const base = EXERCISES[inst.of || inst.id] || (inst.variant ? { id: inst.id, kind: 'calc', variant: inst.variant, lesson: inst.lesson, unitId: inst.unitId } : null);
  if (!base) return { ...inst, fresh: 'same' };
  const keep = Object.fromEntries(['review', 'practice', 'check', 'hard', 'weak', 'steps', 'noRetry'].filter((k) => inst[k]).map((k) => [k, inst[k]]));
  // повтор идёт в конце урока, когда нужного сюжета эфира уже нет на экране
  const copy = freshCopy(base, rand, { ...keep, outside: true }, { avoid: new Set(avoid), sibling: true });
  return inst.steps ? easier(copy, rand) : copy;
}

// три варианта вместо четырёх: верный и две ошибки — те, у которых есть объяснение, первыми
function easier(it, rand) {
  const out = { ...it, steps: true };
  if ((it.kind === 'choice' || it.kind === 'gap') && it.options.length > 3) {
    const right = it.options.find((o) => o.correct);
    const wrong = it.options.filter((o) => !o.correct).sort((a, b) => (b.why ? 1 : 0) - (a.why ? 1 : 0)).slice(0, 2);
    out.options = shuffle([right, ...wrong], rand);
  }
  return out;
}
/* Задачи семинарского и олимпиадного уровня — для алмазного уровня и сильных учеников. Урок не
   спрашивает того, чему ещё не учил: задачи берутся только из списков hard="…" этого урока и
   уроков до него (каждый список — задачи на тему своего урока). «Повторение» и «Итоги» — в конце
   юнита, им годятся все задачи юнита. upto — номер урока. */
const hardEntry = (unitId, id) => {
  if (id.startsWith('var:')) {
    const t = TEMPLATE_BY_ID[id.slice(4)];
    if (!t || t.chapter !== unitId || t.gen(seeded(1)).parts.length !== 1) throw new Error(`hard: нет варианта ${id} с одним ответом в ${unitId}`);
    return { id, kind: 'calc', variant: t.id, lesson: null, unitId, level: Math.max(2, t.level) };
  }
  const p = PROBLEMS[id];
  if (!p || p.chapter !== unitId) throw new Error(`hard: нет задачи ${id} в ${unitId}`);
  return { ...fromProblem(id), lesson: null, unitId, level: p.block.level };
};
function hardPool(unitId, upto = Infinity) {
  const unit = UNIT_BY_ID[unitId];
  const probs = Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].chapter === unitId && PROBLEMS[id].block.level >= 2);
  const multi = probs.filter((id) => PROBLEMS[id].block.kind === 'number' && PROBLEMS[id].block.parts.length > 1);
  if (upto === Infinity) {
    const autos = [];
    probs.forEach((pid) => { try { autos.push({ ...fromProblem(pid), lesson: null, unitId, level: PROBLEMS[pid].block.level }); } catch { /* многошаговая — в упражнение не годится */ } });
    const variants = templatesOf(unitId).filter((t) => t.level === 2 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unitId, level: 2 }));
    return { variants, autos, multi };
  }
  const ids = [...new Set(unit.lessons.filter((l) => l.no <= upto).flatMap((l) => l.hard))];
  const list = ids.map((id) => hardEntry(unitId, id));
  return { variants: list.filter((e) => e.variant), autos: list.filter((e) => !e.variant), multi };
}
export const HARD_IN_PRACTICE = 2;
const ownOf = (lesson) => lesson.exercises.filter((e) => !e.diamond).map((e) => EXERCISES[e.id]);
function buildLessonBase(lessonId, rand, { mistakes = [], hinted = [], level = 'normal', weak = [], seen = {} }) {
  const lesson = LESSON_BY_ID[lessonId];
  const unit = UNIT_BY_ID[lesson.unitId];
  if (['intro', 'story', 'listen'].includes(lesson.kind)) {
    // шаги и вопросы строго по порядку, без повторения: это первая встреча с темой
    const items = ownOf(lesson).map((e) => instantiate(e, rand));
    const inner = lesson.inner.filter((c) => !c.diamond);
    return { lesson, items, cards: stepCards(lesson, items, inner), seconds: sum(items) + stepsSeconds(inner) };
  }
  if (lesson.kind === 'words') {
    const items = lesson.exercises.map((e) => instantiate(EXERCISES[e.id], rand));
    const flash = flashCards(lesson);
    return { lesson, items, cards: { [items[0].uid]: flash }, seconds: sum(items) + flash.length * FLASH_SECONDS };
  }
  if (lesson.kind === 'game') {
    // раунды — по порядку: от простого к быстрому
    const items = lesson.exercises.map((e) => instantiate(EXERCISES[e.id], rand, { noRetry: true }));
    return { lesson, items, cards: {}, seconds: sum(items) };
  }
  if (lesson.kind === 'review') {
    // ошибки этого юнита — первыми, за ними решённые с подсказкой, дальше — остальное вперемешку
    const pool = unit.lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter(basic);
    const wrong = pool.filter((e) => mistakes.includes(e.id));
    const helped = pool.filter((e) => hinted.includes(e.id) && !mistakes.includes(e.id));
    // остальное: сначала из уроков со слабой точностью, потом прочее; внутри — реже виденное первым
    const other = pool.filter((e) => !mistakes.includes(e.id) && !hinted.includes(e.id));
    const rest = [...bySeen(other.filter((e) => weak.includes(e.lesson)), seen, rand), ...bySeen(other.filter((e) => !weak.includes(e.lesson)), seen, rand)];
    const order = [...shuffle(wrong, rand), ...shuffle(helped, rand), ...rest];
    // двенадцать упражнений; если они все быстрые — ещё несколько, чтобы вышло минуты три
    let n = Math.min(REVIEW_SIZE, order.length);
    while (n < Math.min(15, order.length) && order.slice(0, n).reduce((a, e) => a + SECONDS[e.kind], 0) < 180) n += 1;
    // ошибки и решённое с подсказкой — похожей задачей или новыми числами, прочее — с новыми числами, где они есть
    const picked = order.slice(0, n);
    const avoid = new Set(picked.map((e) => e.id));
    const items = picked.map((e) => freshCopy(e, rand, { review: true }, { avoid, sibling: mistakes.includes(e.id) || hinted.includes(e.id) }));
    return { lesson, items: shuffle(items, rand), cards: {}, seconds: sum(items) };
  }
  if (lesson.kind === 'summary') {
    // пункты итогов подряд, потом тест по юниту — как проверка юнита, десять упражнений
    const items = unitTest(unit, lesson.no, rand, seen);
    const points = lesson.inner.filter((c) => !c.diamond).map((c) => c.idea);
    return { lesson, items, cards: { [items[0].uid]: points }, seconds: sum(items) + points.length * POINT_SECONDS };
  }
  const all = ownOf(lesson);
  // свои — не больше десяти, в прежнем порядке (случайный набор при каждом прохождении; реже виденные — первыми);
  // «Домино» урока — всегда: в нём ученик сам строит цепочку, а не только отвечает
  const pinned = all.map((e, k) => (SELF_CHECK.includes(e.kind) ? k : -1)).filter((k) => k >= 0);
  const keep = new Set([...pinned, ...bySeen(all.map((e, k) => ({ ...e, k })).filter((e) => !pinned.includes(e.k)), seen, rand).slice(0, PRACTICE_OWN - pinned.length).map((e) => e.k)]);
  const own = all.filter((_, k) => keep.has(k));
  // начинать с упражнения в одно касание, а не с расчёта или сборки
  const easy = own.findIndex((e) => SECONDS[e.kind] <= 12);
  if (easy > 0) own.unshift(own.splice(easy, 1)[0]);
  const prev = unit.lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter(basic);
  const nReview = Math.min(prev.length, Math.max(0, Math.min(15 - own.length, Math.round(own.length / 2))));
  // повторение — из реже виденного: одна и та же задача не всплывает в каждом уроке юнита
  const review = bySeen(prev, seen, rand).slice(0, nReview);
  const items = own.map((e) => instantiate(e, rand));
  review.forEach((e) => {
    const at = 1 + Math.floor(rand() * items.length);
    items.splice(at, 0, freshCopy(e, rand, { review: true }, { sibling: false }));
  });
  // урок — не дольше пяти минут: лишнее снимаем с конца, свои и повторение поровну
  while (estimate(items) > LESSON_MAX_SECONDS && items.length > 10) {
    const rev = items.filter((it) => it.review).length;
    const dropReview = rev / (items.length - 1) > 0.34;
    const k = items.map((it, i) => i).reverse().find((i) => i > 0 && !!items[i].review === dropReview && !SELF_CHECK.includes(items[i].kind));
    if (k == null) break;
    items.splice(k, 1);
  }
  // сильному ученику — задачи семинарского и олимпиадного уровня вместо последних своих
  if (level === 'hard') {
    const { variants, autos } = hardPool(unit.id, lesson.no);
    const hard = shuffle([...variants, ...autos], rand).slice(0, HARD_IN_PRACTICE);
    hard.forEach((e) => {
      const k = items.map((it, i) => i).reverse().find((i) => i > 0 && !items[i].review && !items[i].hard && !SELF_CHECK.includes(items[i].kind));
      const it = instantiate(e, rand, { hard: e.level >= 3 ? 3 : 2 });
      if (k != null && items.length >= 10) items.splice(k, 1, it); else items.push(it);
    });
  }
  return { lesson, items, cards: {}, seconds: estimate(items) };
}
export const LESSON_MAX_SECONDS = 300;
export const estimate = (items) => IDEA_SECONDS + items.reduce((s, it) => s + (it.seconds || SECONDS[it.kind]), 0);

/* «Проверка юнита»: расчёты по параллельным вариантам с новыми числами и упражнения всех
   уроков юнита вперемешку (реже виденные — первыми), 10 штук. Сдана, если ошибок с первой
   попытки не больше одной. */
function unitTest(unit, beforeNo, rand, seen = {}) {
  const variants = templatesOf(unit.id).filter((t) => t.level === 1 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unitId: unit.id }));
  const pool = bySeen(unit.lessons.filter((l) => l.no < beforeNo).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter((e) => !e.variant && basic(e)), seen, rand);
  return shuffle([...variants, ...pool].slice(0, 10).map((e) => instantiate(e, rand, { check: true })), rand);
}
export function buildUnitCheck(unitId, rand = Math.random, { seen = {} } = {}) {
  const unit = UNIT_BY_ID[unitId];
  return { course: unit, items: unitTest(unit, Infinity, rand, seen), passMistakes: 1 };
}

/* ------------------------------ АЛМАЗНЫЙ УРОВЕНЬ ------------------------------
   Пройденный урок можно пройти ещё раз — усложнённым. Что меняется по видам:
   «Знакомство», «История», «Слушай» — добавляются алмазные шаги урока (теория глубже: формулы
   и расчёты), а если их нет — две задачи семинарского уровня в конце;
   «Практика» — до четырёх своих упражнений заменяют задачи семинарского и олимпиадного уровня
   юнита, остальные — с новыми числами, где они есть;
   «Слова» — пары на время быстрее (25 секунд вместо 40);
   «Мини-игра» — 45 секунд вместо минуты при той же планке;
   «Повторение» и «Итоги» — три задачи семинарского уровня вместо последних.
   Всё в таком уроке помечено diamond: true. Награды — в src/learn/rewards.js. */
export const DIAMOND_HARD = 4;
export const DIAMOND_PAIRS_SECONDS = 25;
const hardItems = (unitId, n, rand, avoid = new Set(), upto = Infinity) => {
  const { variants, autos } = hardPool(unitId, upto);
  return shuffle([...variants, ...autos].filter((e) => !avoid.has(e.id)), rand).slice(0, n).map((e) => instantiate(e, rand, { hard: e.level >= 3 ? 3 : 2 }));
};
function buildDiamond(lessonId, rand, opts) {
  const lesson = LESSON_BY_ID[lessonId];
  const unitId = lesson.unitId;
  const mark = (p) => ({ ...p, diamond: true, items: p.items.map((it) => ({ ...it, diamond: true })) });
  if (['intro', 'story', 'listen'].includes(lesson.kind)) {
    const items = lesson.exercises.map((e) => instantiate(EXERCISES[e.id], rand));
    const deep = lesson.inner.some((c) => c.diamond);
    if (!deep) hardItems(unitId, 2, rand, new Set(), lesson.no).forEach((it) => items.push(it));
    // «Откройте сами» на повторе не нужен: кривую ученик уже нашёл
    const inner = lesson.inner.filter((c) => !c.discover);
    // карточки собираются до того, как mark скопирует упражнения: uid у копий тот же
    return mark({ lesson, items, cards: stepCards(lesson, items, inner), seconds: sum(items) + stepsSeconds(inner) });
  }
  if (lesson.kind === 'words') {
    const p = buildLessonBase(lessonId, rand, opts);
    return mark({ ...p, items: p.items.map((it) => (it.timer ? { ...it, timer: DIAMOND_PAIRS_SECONDS } : it)) });
  }
  if (lesson.kind === 'game') {
    const items = lesson.exercises.map((e) => instantiate(EXERCISES[e.id], rand, { noRetry: true, seconds: DIAMOND_GAME_SECONDS }));
    return mark({ lesson, items, cards: {}, seconds: sum(items) });
  }
  if (lesson.kind === 'review' || lesson.kind === 'summary') {
    const p = buildLessonBase(lessonId, rand, opts);
    const hard = hardItems(unitId, 3, rand);
    const keep = Math.max(1, p.items.length - hard.length);
    const items = p.items.slice(0, keep).concat(hard);
    // задачи посложнее бывают и короткими («верно или неверно»): урок не короче трёх минут
    const rest = p.items.slice(keep);
    while (sum(items) < 180 && rest.length) items.splice(items.length - hard.length, 0, rest.shift());
    return mark({ ...p, items, seconds: sum(items) + (p.seconds - sum(p.items)) });
  }
  // практика: свои упражнения с новыми числами, последние — задачи посложнее
  const all = lesson.exercises.map((e) => EXERCISES[e.id]);
  const own = shuffle(all, rand).slice(0, PRACTICE_OWN);
  const easy = own.findIndex((e) => SECONDS[e.kind] <= 12);
  if (easy > 0) own.unshift(own.splice(easy, 1)[0]);
  const items = own.map((e) => freshCopy(e, rand, {}, { sibling: false }));
  const hard = hardItems(unitId, DIAMOND_HARD, rand, new Set(), lesson.no);
  hard.forEach((it, k) => { const at = items.length - 1 - k; if (at > 0 && items.length >= 8) items.splice(at, 1, it); else items.push(it); });
  // короткий урок добираем до трёх минут повторением прошлых уроков юнита (реже виденное — первым)
  const prev = bySeen(UNIT_BY_ID[unitId].lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter(basic), opts.seen || {}, rand);
  while (estimate(items) < 180 && prev.length) items.splice(1 + Math.floor(rand() * items.length), 0, freshCopy(prev.shift(), rand, { review: true }, { sibling: false }));
  while (estimate(items) > LESSON_MAX_SECONDS && items.length > 8) {
    const k = items.map((it, i) => i).reverse().find((i) => i > 0 && !items[i].hard);
    if (k == null) break;
    items.splice(k, 1);
  }
  return mark({ lesson, items, cards: {}, seconds: estimate(items) });
}

/* Практика: ошибки прошлых уроков (по id упражнения), не больше двенадцати. Если ошибок
   мало — добираем до восьми упражнениями из слабых тем (weak — уроки, по порядку слабости). */
export const PRACTICE_MIN = 8;
export function buildPractice(mistakeIds, rand = Math.random, { weak = [] } = {}) {
  const exs = mistakeIds.map((id) => EXERCISES[id]).filter((e) => e && reviewable(e));
  // ошибка возвращается похожей задачей или с новыми числами — ответ не запомнить
  const avoidMistakes = new Set(exs.map((e) => e.id));
  const items = shuffle(exs, rand).slice(0, 12).map((e) => freshCopy(e, rand, { practice: true }, { avoid: avoidMistakes, sibling: true }));
  const have = new Set(exs.map((e) => e.id));
  for (const lessonId of weak) {
    if (items.length >= PRACTICE_MIN) break;
    const lesson = LESSON_BY_ID[lessonId];
    if (!lesson) continue;
    const pool = shuffle(lesson.exercises.map((e) => EXERCISES[e.id]).filter((e) => basic(e) && !have.has(e.id)), rand);
    pool.slice(0, PRACTICE_MIN - items.length).forEach((e) => { have.add(e.id); items.push(instantiate(e, rand, { practice: true, weak: true })); });
  }
  return { items };
}

/* Вступительный тест: по пять упражнений на юнит, юниты — по порядку Пути. Юнит считается
   известным, если в его пятёрке не больше одной ошибки; первая проваленная пятёрка тест
   заканчивает — дальше Путь откроется обычным порядком. */
export const PLACE_PER_UNIT = 5;
export const PLACE_MISTAKES = 1;
export function buildPlacement(rand = Math.random) {
  const items = [];
  pilotUnits().forEach((u) => {
    unitTest(u, Infinity, rand).slice(0, PLACE_PER_UNIT).forEach((it) => items.push({ ...it, placeUnit: u.id, check: true }));
  });
  return { items };
}
// какие юниты открыл тест: подряд с начала, пока в пятёрке юнита не больше одной ошибки
export function placementOpened(items, first) {
  const opened = [];
  for (const u of pilotUnits()) {
    const block = items.filter((it) => it.placeUnit === u.id);
    if (!block.length || block.some((it) => !(it.uid in first))) break;
    const wrong = block.filter((it) => !first[it.uid]).length;
    if (wrong > PLACE_MISTAKES) break;
    opened.push(u.id);
  }
  return opened;
}
// пятёрка юнита уже провалена — дальше спрашивать незачем
export function placementFailed(items, first, unitId) {
  return items.filter((it) => it.placeUnit === unitId && it.uid in first && !first[it.uid]).length > PLACE_MISTAKES;
}

/* ------------------------------ СОСТОЯНИЕ ПУТИ ------------------------------
   Урок открыт, если пройден предыдущий урок Пути (первый урок — всегда) или юнит сдан
   проверкой / открыт вступительным тестом. Пройден — только если урок доведён до конца
   (runs > 0): проверка и тест уроки открывают, но не засчитывают. Юнит пройден, когда
   пройдены все его уроки — тогда и сундук. diamond — урок взят на алмазном уровне. */
export function pathState(learn) {
  // Путь сквозной: первый урок юнита открывается, когда пройден последний урок прошлого юнита
  // или прошлый юнит сдан проверкой
  let prevDone = true;
  return pilotUnits().map((u) => {
    const tested = !!(learn.units || {})[u.id];
    const lessons = u.lessons.map((l) => {
      const entry = learn.lessons[l.id];
      const done = !!(entry && entry.runs > 0);
      const open = done || prevDone || tested;
      prevDone = done || tested;
      return { id: l.id, no: l.no, title: l.title, done, open, diamond: !!(done && entry.diamond) };
    });
    const current = lessons.find((l) => l.open && !l.done) || null;
    return { course: u, lessons, current, complete: lessons.every((l) => l.done), tested };
  });
}
export const unitTitle = (id) => (CHAPTER_BY_ID[id] || {}).title || id;
