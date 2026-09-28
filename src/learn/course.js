/* ПУТЬ: юниты, уроки и упражнения. Юнит — глава учебника, урок — карточка новой идеи
   (:::idea) и упражнения после неё (:::ex) внутри раздела главы. К упражнениям, написанным
   руками, урок добирает собранные автоматически: из ловушек числовых задач — «выбор ответа»,
   из «верно или неверно» — то же одним касанием, из графических задач — «куда сдвинется?»,
   из схем-цепочек (:::flow) — «собери цепочку», из параллельных вариантов — быстрый расчёт с
   новыми числами. Модуль чистый: его читают тесты; экраны — src/learn.jsx. */
import { CHAPTERS, CHAPTER_BY_ID } from '../textbook/toc.js';
import { CHAPTER_BLOCKS, CHAPTER_SECTIONS, PROBLEMS } from '../textbook/content.js';
import { collectBlocks, parseInline, parseBlocks, checkAnswer } from '../textbook/markdown.js';
import { TEMPLATE_BY_ID, templatesOf, seeded } from '../textbook/variants.js';
import { plain } from '../textbook/sections.js';
import { GLOSSARY } from '../textbook/glossary.js';
import { CAST } from './cast.js';

// сколько секунд на упражнение: одно касание — около десяти, расчёт и сборка — дольше
export const SECONDS = { choice: 12, gap: 12, tf: 10, shift: 12, news: 16, order: 22, match: 22, sort: 22, calc: 28, tiles: 20, curve: 15, price: 18, point: 15, swipe: 40, rush: 60, chain: 30 };
export const IDEA_SECONDS = 25;
export const KIND_LABEL = {
  choice: 'Выбор ответа', gap: 'Заполни пропуск', tf: 'Верно или неверно', shift: 'Куда сдвинется?',
  news: 'Газета', order: 'Собери цепочку', match: 'Сопоставь пары', sort: 'Разложи по корзинам', calc: 'Быстрый расчёт',
  tiles: 'Собери определение', curve: 'Сдвинь кривую', price: 'Найди цену', point: 'Отметь равновесие',
  swipe: 'Сдвиг или движение?', rush: '60 секунд', chain: 'Цепочка на время',
};
// раунды мини-игр: у них свой счёт внутри, в проверку юнита и повторение они не идут
export const GAME_KINDS = ['swipe', 'rush', 'chain'];
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

// автоупражнения из задач главы
function fromProblem(pid) {
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
// схема-цепочка главы → «собери цепочку»
function fromFlow(flow, id) {
  const items = flow.steps.slice(0, 5).map((st) => ({ raw: plain(st.title), text: st.title }));
  return { id, kind: 'order', prompt: parseBlocks(`Расставьте звенья по порядку: ${flow.title}.`), explain: flow.caption ? [{ type: 'p', inline: flow.caption }] : null, items };
}
// руками написанное упражнение → общий вид
function fromBlock(b) {
  const e = { id: b.id, kind: b.kind, prompt: b.prompt, explain: b.explain };
  switch (b.kind) {
    case 'choice': case 'gap': return { ...e, options: b.options };
    case 'tf': return { ...e, answer: b.answer, wrongWhy: null };
    case 'order': return { ...e, items: b.items };
    case 'match': return { ...e, pairs: b.pairs };
    case 'sort': return { ...e, bins: b.bins, items: b.items };
    case 'calc': return b.variant ? { ...e, variant: b.variant } : { ...e, answer: b.answer, tol: b.tol, unit: b.unit, traps: b.traps };
    case 'shift': return { ...e, chart: b.chart, chartAttrs: b.chartAttrs, answer: b.answer, choices: b.choices || shiftChoices(b.chart), traps: b.traps };
    case 'news': return { ...e, headline: b.headline, vars: b.vars, expect: b.expect };
    case 'tiles': return { ...e, solution: b.solution, extra: b.extra };
    case 'curve': return { ...e, market: b.market, answer: b.answer, only: b.only, traps: b.traps };
    case 'price': return { ...e, market: b.market, start: b.start };
    case 'point': return { ...e, market: b.market };
    default: throw new Error(b.kind);
  }
}
// раунд мини-игры → упражнение со своим счётом
function fromGame(g) {
  const base = { id: g.id, kind: g.kind, title: g.title, prompt: g.prompt, explain: null, game: true };
  if (g.kind === 'chain') return { ...base, items: g.items, seconds: g.seconds || 30 };
  return { ...base, items: g.items, labels: g.labels, seconds: g.seconds || null };
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
    out.push({ id: `${lessonId}:pairs:${k / 4}`, kind: 'match', seconds: 40, prompt: parseBlocks('Соедините слова о спросе с определениями — на время, 40 секунд.'), explain: null,
      pairs: terms.slice(k, k + 4).map((t) => [{ raw: termName(t.term), text: text(termName(t.term)) }, { raw: t.text, text: text(t.text) }]) });
  }
  terms.slice(3).forEach((t, k) => {
    const others = terms.filter((x) => x !== t).slice(k % 3, (k % 3) + 3);
    out.push({ id: `${lessonId}:which:${t.term}`, kind: 'choice', prompt: parseBlocks(`Какой это термин: «${t.text}»?`), explain: null,
      options: [{ raw: termName(t.term), text: text(termName(t.term)), correct: true, why: null }, ...others.map((o) => ({ raw: termName(o.term), text: text(termName(o.term)), correct: false, why: null }))] });
  });
  return out;
}

/* Уроки юнита: у каждого карточка идеи и упражнения — свои, автоматические (из задач,
   названных в auto, и параллельных вариантов из variants) и из схем-цепочек раздела. */
/* Виды уроков (LESSON_KIND): «Знакомство», «История», «Слушай» — шаги (первая карточка урока и
   карточки more), после каждого шага — вопрос; «Итоги юнита» — пункты-карточки подряд, потом
   тест по юниту; «Практика» — только упражнения; «Слова» — карточки слов, потом упражнения из
   них; «Мини-игра» — раунды :::round; «Повторение» — упражнения юнита, ошибки первыми. */
const STEP_KINDS = ['intro', 'story', 'listen', 'summary'];
function lessonsOf(chapterId) {
  const blocks = CHAPTER_BLOCKS[chapterId];
  if (!blocks) return [];
  const seq = collectBlocks(blocks, (b) => b.type === 'idea' || b.type === 'ex' || b.type === 'flow' || b.type === 'round');
  const out = [];
  const addAuto = (cur, b) => {
    b.auto.forEach((pid) => cur.exercises.push(fromProblem(pid)));
    b.variants.forEach((v) => { if (!TEMPLATE_BY_ID[v]) throw new Error(`Нет варианта ${v}`); cur.exercises.push({ id: `var:${v}`, kind: 'calc', variant: v }); });
  };
  seq.forEach((b) => {
    if (b.type === 'idea' && b.inner) {
      // следующий шаг урока — перед упражнением, которое идёт следом
      if (!out.length) throw new Error(`Карточка ${b.id} раньше первого урока`);
      const cur = out[out.length - 1];
      if (b.who && !CAST[b.who]) throw new Error(`Нет героя ${b.who} (${b.id})`);
      cur.inner.push({ at: cur.exercises.length, idea: b });
      addAuto(cur, b);
    } else if (b.type === 'idea') {
      if (b.who && !CAST[b.who]) throw new Error(`Нет героя ${b.who} (${b.id})`);
      out.push({ id: b.id, unitId: chapterId, no: out.length + 1, title: b.title, kind: b.kind, idea: b, section: sectionOf(chapterId, b), exercises: [],
        inner: STEP_KINDS.includes(b.kind) ? [{ at: 0, idea: b }] : [], terms: b.terms || null });
      const cur = out[out.length - 1];
      if (b.kind === 'words') {
        if (!b.terms || b.terms.length < 4) throw new Error(`В уроке «Слова» ${b.id} меньше четырёх слов`);
        wordsExercises(b.id, b.terms).forEach((e) => cur.exercises.push(e));
      }
      addAuto(cur, b);
    } else if (out.length) {
      const cur = out[out.length - 1];
      if (b.type === 'ex') cur.exercises.push(fromBlock(b));
      else if (b.type === 'round') cur.exercises.push(fromGame(b));
      else if (b.steps.length >= 4 && cur.kind === 'practice') cur.exercises.push(fromFlow(b, `flow:${cur.id}:${cur.exercises.length}`));
    }
  });
  return out;
}

export const UNITS = CHAPTERS.map((c) => ({ id: c.id, title: c.title, part: c.part, ready: c.status === 'ready', lessons: lessonsOf(c.id) }));
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
export function instantiate(ex, rand = Math.random, extra = {}) {
  const base = { uid: `u${uidSeq += 1}`, id: ex.id, kind: ex.kind, lesson: ex.lesson, unitId: ex.unitId, prompt: ex.prompt, explain: ex.explain || null, seconds: SECONDS[ex.kind], ...extra };
  switch (ex.kind) {
    case 'choice': case 'gap':
      return { ...base, options: shuffle(ex.options.map((o, k) => ({ key: `o${k}`, text: o.text, raw: o.raw, correct: o.correct, why: o.why })), rand) };
    case 'tf': return { ...base, answer: ex.answer, wrongWhy: ex.wrongWhy || null };
    case 'order': {
      const items = ex.items.map((it, k) => ({ key: `i${k}`, text: it.text, raw: it.raw }));
      let shown = shuffle(items, rand);
      // перемешанный порядок не должен совпасть с верным
      for (let t = 0; t < 10 && shown.every((x, k) => x.key === items[k].key); t += 1) shown = shuffle(items, rand);
      return { ...base, items: shown, solution: items.map((x) => x.key) };
    }
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
    case 'swipe': case 'rush':
      return { ...base, title: ex.title, labels: ex.labels, seconds: ex.seconds || SECONDS[ex.kind], items: shuffle(ex.items.map((it, k) => ({ key: `g${k}`, text: it.text, raw: it.raw, side: it.side })), rand) };
    case 'chain': {
      const items = ex.items.map((it, k) => ({ key: `i${k}`, text: it.text, raw: it.raw }));
      let shown = shuffle(items, rand);
      for (let t = 0; t < 10 && shown.every((x, k) => x.key === items[k].key); t += 1) shown = shuffle(items, rand);
      return { ...base, title: ex.title, seconds: ex.seconds, items: shown, solution: items.map((x) => x.key) };
    }
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
    case 'order': return { ok: Array.isArray(resp) && resp.length === inst.solution.length && resp.every((k, i) => k === inst.solution[i]), why: null };
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
    case 'swipe': case 'rush': case 'chain': return { ok: gameOk(inst, resp), why: null };
    default: return { ok: false, why: null };
  }
}
/* Раунд мини-игры засчитан: в «смахни» — три четверти верно; в «60 секундах» — не меньше
   шести верных при точности от 70%; цепочка — верный порядок, пока не кончилось время. */
export function gameOk(inst, resp) {
  if (!resp || !resp.done) return false;
  if (inst.kind === 'swipe') return resp.right >= Math.ceil(inst.items.length * 0.75);
  if (inst.kind === 'rush') return resp.right >= Math.min(6, inst.items.length) && resp.right >= 0.7 * resp.answered;
  return !resp.timeout && Array.isArray(resp.seq) && resp.seq.length === inst.solution.length && resp.seq.every((k, i) => k === inst.solution[i]);
}
// ответ заполнен настолько, что можно нажать «Проверить»
export function ready(inst, resp) {
  if (resp == null) return false;
  switch (inst.kind) {
    case 'order': return resp.length === inst.items.length;
    case 'match': return Object.keys(resp).length === inst.left.length;
    case 'sort': return Object.keys(resp).length === inst.items.length;
    case 'news': return inst.vars.every((v) => resp[v.key]);
    case 'calc': return String(resp).trim().length > 0;
    case 'tiles': return Array.isArray(resp) && resp.length > 0;
    case 'curve': return !!(resp.D || resp.S);
    case 'point': return Number.isFinite(resp.q) && Number.isFinite(resp.p);
    case 'swipe': case 'rush': case 'chain': return !!resp.done;
    default: return true;
  }
}
// правильный ответ словами — для красной плашки
export function answerText(inst) {
  const plain = (nodes) => (nodes || []).map((n) => (n.t === 'text' || n.t === 'math' ? n.v : n.c ? plain(n.c) : '')).join('');
  switch (inst.kind) {
    case 'choice': case 'gap': return plain(inst.options.find((o) => o.correct).text);
    case 'tf': return inst.answer ? 'Верно' : 'Неверно';
    case 'order': return inst.solution.map((k) => plain(inst.items.find((x) => x.key === k).text)).join(' → ');
    case 'match': return inst.left.map((l) => `${plain(l.text)} — ${plain(inst.right.find((r) => r.key === l.key).text)}`).join('; ');
    case 'sort': return inst.bins.map((b) => `${b}: ${inst.items.filter((it) => it.bin === b).map((it) => plain(it.text)).join(', ')}`).join('; ');
    case 'calc': return withUnit(inst.answer, inst.unit);
    case 'shift': return shiftLabel(inst.chart, inst.answer);
    case 'news': return inst.vars.map((v) => `${v.label} ${({ '+': '↑', '-': '↓', 0: '—' })[inst.expect[v.key]]}`).join(', ');
    case 'tiles': return inst.solution.map((k) => inst.tiles.find((t) => t.key === k).text).join(' ');
    case 'curve': return shiftLabel('supply-demand', inst.answer);
    case 'price': return `цена ${fmt(inst.answer)}`;
    case 'point': return `объём ${fmt(inst.answer.q)}, цена ${fmt(inst.answer.p)}`;
    case 'swipe': return `не меньше ${Math.ceil(inst.items.length * 0.75)} верных из ${inst.items.length}`;
    case 'rush': return `не меньше ${Math.min(6, inst.items.length)} верных`;
    case 'chain': return inst.solution.map((k) => plain(inst.items.find((x) => x.key === k).text)).join(' → ');
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
export const FLASH_SECONDS = 8;
export const POINT_SECONDS = 10;
// в практике — не больше десяти своих упражнений за раз: при повторе урока набор другой
export const PRACTICE_OWN = 10;
export const REVIEW_SIZE = 12;
// упражнения, годные для повторения и проверок: в одно действие, без игрового счёта
const reviewable = (e) => !GAME_KINDS.includes(e.kind);
const stepCards = (lesson, items) => {
  const cards = {};
  lesson.inner.forEach((c) => { if (items[c.at]) (cards[items[c.at].uid] = cards[items[c.at].uid] || []).push(c.idea); });
  return cards;
};
const sum = (items) => items.reduce((a, it) => a + (it.seconds || SECONDS[it.kind]), 0);
// карточки слов урока «Слова»: слово — на лицевой стороне, короткое определение — на обороте
export const flashCards = (lesson) => lesson.terms.map((t) => ({ id: `${lesson.id}:card:${t.term}`, flash: true, term: t.term, title: termName(t.term), text: text(t.text) }));

/* Персональная программа (src/learn/program.js) подстраивает урок:
   level — «easy» (точность ниже 60%): в выборе ответа три варианта вместо четырёх, а разбор
   ошибки — по шагам (steps); «hard» (выше 90%): в практике часть упражнений заменяют задачи
   семинарского и олимпиадного уровня (hard: 2 или 3);
   weak — уроки со слабой точностью: их упражнения первыми идут в «Повторение». */
export function buildLesson(lessonId, rand = Math.random, opts = {}) {
  const p = buildLessonBase(lessonId, rand, opts);
  const level = opts.level || 'normal';
  if (level === 'easy') p.items = p.items.map((it) => easier(it, rand));
  return p;
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
// задачи семинарского и олимпиадного уровня юнита — для «уровня легенды» и сильных учеников
function hardPool(unitId) {
  const probs = Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].chapter === unitId && PROBLEMS[id].block.level >= 2);
  const autos = [];
  probs.forEach((pid) => { try { autos.push({ ...fromProblem(pid), lesson: null, unitId, level: PROBLEMS[pid].block.level }); } catch { /* многошаговая — в упражнение не годится */ } });
  const variants = templatesOf(unitId).filter((t) => t.level === 2 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unitId, level: 2 }));
  return { variants, autos, multi: probs.filter((id) => PROBLEMS[id].block.kind === 'number' && PROBLEMS[id].block.parts.length > 1) };
}
export const HARD_IN_PRACTICE = 2;
function buildLessonBase(lessonId, rand, { mistakes = [], hinted = [], level = 'normal', weak = [] }) {
  const lesson = LESSON_BY_ID[lessonId];
  const unit = UNIT_BY_ID[lesson.unitId];
  if (['intro', 'story', 'listen'].includes(lesson.kind)) {
    // шаги и вопросы строго по порядку, без повторения: это первая встреча с темой
    const items = lesson.exercises.map((e) => instantiate(EXERCISES[e.id], rand));
    return { lesson, items, cards: stepCards(lesson, items), seconds: sum(items) + lesson.inner.length * STEP_SECONDS };
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
    const pool = unit.lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter(reviewable);
    const wrong = pool.filter((e) => mistakes.includes(e.id));
    const helped = pool.filter((e) => hinted.includes(e.id) && !mistakes.includes(e.id));
    // остальное: сначала из уроков со слабой точностью, потом прочее — вперемешку внутри групп
    const other = pool.filter((e) => !mistakes.includes(e.id) && !hinted.includes(e.id));
    const rest = [...shuffle(other.filter((e) => weak.includes(e.lesson)), rand), ...shuffle(other.filter((e) => !weak.includes(e.lesson)), rand)];
    const order = [...shuffle(wrong, rand), ...shuffle(helped, rand), ...rest];
    // двенадцать упражнений; если они все быстрые — ещё несколько, чтобы вышло минуты три
    let n = Math.min(REVIEW_SIZE, order.length);
    while (n < Math.min(15, order.length) && order.slice(0, n).reduce((a, e) => a + SECONDS[e.kind], 0) < 180) n += 1;
    const items = order.slice(0, n).map((e) => instantiate(e, rand, { review: true }));
    return { lesson, items: shuffle(items, rand), cards: {}, seconds: sum(items) };
  }
  if (lesson.kind === 'summary') {
    // пункты итогов подряд, потом тест по юниту — как проверка юнита, десять упражнений
    const items = unitTest(unit, lesson.no, rand);
    const points = lesson.inner.map((c) => c.idea);
    return { lesson, items, cards: { [items[0].uid]: points }, seconds: sum(items) + points.length * POINT_SECONDS };
  }
  const all = lesson.exercises.map((e) => EXERCISES[e.id]);
  // свои — не больше десяти, в прежнем порядке (случайный набор при каждом прохождении)
  const keep = new Set(shuffle(all.map((_, k) => k), rand).slice(0, PRACTICE_OWN));
  const own = all.filter((_, k) => keep.has(k));
  // начинать с упражнения в одно касание, а не с расчёта или сборки
  const easy = own.findIndex((e) => SECONDS[e.kind] <= 12);
  if (easy > 0) own.unshift(own.splice(easy, 1)[0]);
  const prev = unit.lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter(reviewable);
  const nReview = Math.min(prev.length, Math.max(0, Math.min(15 - own.length, Math.round(own.length / 2))));
  const review = shuffle(prev, rand).slice(0, nReview);
  const items = own.map((e) => instantiate(e, rand));
  review.forEach((e) => {
    const at = 1 + Math.floor(rand() * items.length);
    items.splice(at, 0, instantiate(e, rand, { review: true }));
  });
  // урок — не дольше пяти минут: лишнее снимаем с конца, свои и повторение поровну
  while (estimate(items) > LESSON_MAX_SECONDS && items.length > 10) {
    const rev = items.filter((it) => it.review).length;
    const dropReview = rev / (items.length - 1) > 0.34;
    const k = items.map((it, i) => i).reverse().find((i) => i > 0 && !!items[i].review === dropReview);
    items.splice(k, 1);
  }
  // сильному ученику — задачи семинарского и олимпиадного уровня вместо последних своих
  if (level === 'hard') {
    const { variants, autos } = hardPool(unit.id);
    const hard = shuffle([...variants, ...autos], rand).slice(0, HARD_IN_PRACTICE);
    hard.forEach((e) => {
      const k = items.map((it, i) => i).reverse().find((i) => i > 0 && !items[i].review && !items[i].hard);
      const it = instantiate(e, rand, { hard: e.level >= 3 ? 3 : 2 });
      if (k != null && items.length >= 10) items.splice(k, 1, it); else items.push(it);
    });
  }
  return { lesson, items, cards: {}, seconds: estimate(items) };
}
export const LESSON_MAX_SECONDS = 300;
export const estimate = (items) => IDEA_SECONDS + items.reduce((s, it) => s + (it.seconds || SECONDS[it.kind]), 0);

/* «Проверка юнита»: расчёты по параллельным вариантам с новыми числами и упражнения всех
   уроков юнита вперемешку, 10 штук. Сдана, если ошибок с первой попытки не больше одной.
   «Уровень легенды» — то же из задач семинарского и олимпиадного уровня. */
function unitTest(unit, beforeNo, rand) {
  const variants = templatesOf(unit.id).filter((t) => t.level === 1 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unitId: unit.id }));
  const pool = shuffle(unit.lessons.filter((l) => l.no < beforeNo).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter((e) => !e.variant && reviewable(e)), rand);
  return shuffle([...variants, ...pool].slice(0, 10).map((e) => instantiate(e, rand, { check: true })), rand);
}
export function buildUnitCheck(unitId, rand = Math.random) {
  const unit = UNIT_BY_ID[unitId];
  return { course: unit, items: unitTest(unit, Infinity, rand), passMistakes: 1 };
}
export function buildLegend(unitId, rand = Math.random) {
  const unit = UNIT_BY_ID[unitId];
  const { variants, autos, multi } = hardPool(unitId);
  const items = [...variants, ...autos].map((e) => instantiate(e, rand, { legend: true }));
  return { course: unit, items: shuffle(items, rand), multi };
}

/* Практика: ошибки прошлых уроков (по id упражнения), не больше двенадцати. Если ошибок
   мало — добираем до восьми упражнениями из слабых тем (weak — уроки, по порядку слабости). */
export const PRACTICE_MIN = 8;
export function buildPractice(mistakeIds, rand = Math.random, { weak = [] } = {}) {
  const exs = mistakeIds.map((id) => EXERCISES[id]).filter((e) => e && reviewable(e));
  const items = shuffle(exs, rand).slice(0, 12).map((e) => instantiate(e, rand, { practice: true }));
  const have = new Set(exs.map((e) => e.id));
  for (const lessonId of weak) {
    if (items.length >= PRACTICE_MIN) break;
    const lesson = LESSON_BY_ID[lessonId];
    if (!lesson) continue;
    const pool = shuffle(lesson.exercises.map((e) => EXERCISES[e.id]).filter((e) => reviewable(e) && !have.has(e.id)), rand);
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
   Урок открыт, если пройден предыдущий урок Пути (первый урок — всегда). Юнит пройден,
   когда пройдены все его уроки; тогда открывается «уровень легенды». */
export function pathState(learn) {
  // Путь сквозной: первый урок юнита открывается, когда пройден последний урок прошлого юнита
  // (или прошлый юнит сдан проверкой — она отмечает его уроки пройденными)
  let prevDone = true;
  return pilotUnits().map((u) => {
    const lessons = u.lessons.map((l) => {
      const done = !!learn.lessons[l.id];
      const open = done || prevDone;
      prevDone = done;
      return { id: l.id, no: l.no, title: l.title, done, open };
    });
    const current = lessons.find((l) => l.open && !l.done) || null;
    return { course: u, lessons, current, complete: lessons.every((l) => l.done), tested: !!learn.units[u.id] };
  });
}
export const unitTitle = (id) => (CHAPTER_BY_ID[id] || {}).title || id;
