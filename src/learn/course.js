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

// сколько секунд на упражнение: одно касание — около десяти, расчёт и сборка — дольше
export const SECONDS = { choice: 12, gap: 12, tf: 10, shift: 12, news: 16, order: 22, match: 22, sort: 22, calc: 28 };
export const IDEA_SECONDS = 25;
export const KIND_LABEL = {
  choice: 'Выбор ответа', gap: 'Заполни пропуск', tf: 'Верно или неверно', shift: 'Куда сдвинется?',
  news: 'Газета', order: 'Собери цепочку', match: 'Сопоставь пары', sort: 'Разложи по корзинам', calc: 'Быстрый расчёт',
};
// «куда сдвинется?»: какой ползунок графика — какая кривая
export const SHIFT_CURVES = {
  'supply-demand': { D: { control: 'dA', label: 'Спрос' }, S: { control: 'dC', label: 'Предложение' } },
};
const dirWord = (d) => (d === '+' ? 'вправо' : 'влево');
export const shiftLabel = (chart, key) => `${SHIFT_CURVES[chart][key[0]].label} ${dirWord(key[1])}`;

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
    return { ...base, prompt, kind: 'shift', chart: b.chart, chartAttrs: b.attrs, answer, choices: ['D+', 'D-', 'S+', 'S-'], traps };
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
    case 'shift': return { ...e, chart: b.chart, chartAttrs: b.chartAttrs, answer: b.answer, choices: b.choices, traps: b.traps };
    case 'news': return { ...e, headline: b.headline, vars: b.vars, expect: b.expect };
    default: throw new Error(b.kind);
  }
}

/* Уроки юнита: у каждого карточка идеи и упражнения — свои, автоматические (из задач,
   названных в auto, и параллельных вариантов из variants) и из схем-цепочек раздела. */
function lessonsOf(chapterId) {
  const blocks = CHAPTER_BLOCKS[chapterId];
  if (!blocks) return [];
  const seq = collectBlocks(blocks, (b) => b.type === 'idea' || b.type === 'ex' || b.type === 'flow');
  const out = [];
  seq.forEach((b) => {
    if (b.type === 'idea') {
      out.push({ id: b.id, unit: chapterId, no: out.length + 1, title: b.title, idea: b, section: sectionOf(chapterId, b), exercises: [] });
      const cur = out[out.length - 1];
      b.auto.forEach((pid) => cur.exercises.push(fromProblem(pid)));
      b.variants.forEach((v) => { if (!TEMPLATE_BY_ID[v]) throw new Error(`Нет варианта ${v}`); cur.exercises.push({ id: `var:${v}`, kind: 'calc', variant: v }); });
    } else if (out.length) {
      const cur = out[out.length - 1];
      if (b.type === 'ex') cur.exercises.push(fromBlock(b));
      else if (b.steps.length >= 4) cur.exercises.push(fromFlow(b, `flow:${cur.id}:${cur.exercises.length}`));
    }
  });
  return out;
}

export const UNITS = CHAPTERS.map((c) => ({ id: c.id, title: c.title, part: c.part, ready: c.status === 'ready', lessons: lessonsOf(c.id) }));
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const LESSONS = UNITS.flatMap((u) => u.lessons);
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const EXERCISES = Object.fromEntries(LESSONS.flatMap((l) => l.exercises.map((e) => [e.id, { ...e, lesson: l.id, unit: l.unit }])));
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
  const base = { uid: `u${uidSeq += 1}`, id: ex.id, kind: ex.kind, lesson: ex.lesson, unit: ex.unit, prompt: ex.prompt, explain: ex.explain || null, seconds: SECONDS[ex.kind], ...extra };
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
      return { ...base, left: shuffle(pairs.map((p) => ({ key: p.key, text: p.left.text, raw: p.left.raw })), rand), right: shuffle(pairs.map((p) => ({ key: p.key, text: p.right.text, raw: p.right.raw })), rand) };
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
    case 'shift': return { ...base, chart: ex.chart, chartAttrs: ex.chartAttrs, answer: ex.answer, choices: ex.choices.map((key) => ({ key, label: shiftLabel(ex.chart, key) })), traps: ex.traps || [] };
    case 'news': return { ...base, headline: ex.headline, vars: ex.vars, expect: ex.expect };
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
    default: return { ok: false, why: null };
  }
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
    default: return '';
  }
}

/* ------------------------------ СБОРКА УРОКА ------------------------------
   Свои упражнения урока плюс повторение прошлых уроков юнита — около трети урока, всего
   10–15. Повторение вперемешку со своими, первым идёт своё упражнение. */
export function buildLesson(lessonId, rand = Math.random) {
  const lesson = LESSON_BY_ID[lessonId];
  const unit = UNIT_BY_ID[lesson.unit];
  const own = lesson.exercises.map((e) => EXERCISES[e.id]);
  // начинать с упражнения в одно касание, а не с расчёта или сборки
  const easy = own.findIndex((e) => SECONDS[e.kind] <= 12);
  if (easy > 0) own.unshift(own.splice(easy, 1)[0]);
  const prev = unit.lessons.filter((l) => l.no < lesson.no).flatMap((l) => l.exercises.map((e) => EXERCISES[e.id]));
  const nReview = Math.min(prev.length, Math.max(0, Math.min(15 - own.length, Math.round(own.length / 2))));
  const review = shuffle(prev, rand).slice(0, nReview);
  const items = own.map((e) => instantiate(e, rand));
  review.forEach((e) => {
    const at = 1 + Math.floor(rand() * items.length);
    items.splice(at, 0, instantiate(e, rand, { review: true }));
  });
  return { lesson, items, seconds: estimate(items) };
}
export const estimate = (items) => IDEA_SECONDS + items.reduce((s, it) => s + (it.seconds || SECONDS[it.kind]), 0);

/* «Проверка юнита»: расчёты по параллельным вариантам с новыми числами и упражнения всех
   уроков юнита вперемешку, 10 штук. Сдана, если ошибок с первой попытки не больше одной.
   «Уровень легенды» — то же из задач семинарского и олимпиадного уровня. */
export function buildUnitCheck(unitId, rand = Math.random) {
  const unit = UNIT_BY_ID[unitId];
  const variants = templatesOf(unitId).filter((t) => t.level === 1 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unit: unitId }));
  const pool = shuffle(unit.lessons.flatMap((l) => l.exercises.map((e) => EXERCISES[e.id])).filter((e) => !e.variant), rand);
  const items = [...variants, ...pool].slice(0, 10).map((e) => instantiate(e, rand, { check: true }));
  return { unit, items: shuffle(items, rand), passMistakes: 1 };
}
export function buildLegend(unitId, rand = Math.random) {
  const unit = UNIT_BY_ID[unitId];
  const probs = Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].chapter === unitId && PROBLEMS[id].block.level >= 2);
  const autos = [];
  probs.forEach((pid) => { try { autos.push({ ...fromProblem(pid), lesson: null, unit: unitId }); } catch { /* многошаговая — в упражнение не годится */ } });
  const variants = templatesOf(unitId).filter((t) => t.level === 2 && t.gen(seeded(1)).parts.length === 1).map((t) => ({ id: `var:${t.id}`, kind: 'calc', variant: t.id, lesson: null, unit: unitId }));
  const items = [...variants, ...autos].map((e) => instantiate(e, rand, { legend: true }));
  return { unit, items: shuffle(items, rand), multi: probs.filter((id) => PROBLEMS[id].block.kind === 'number' && PROBLEMS[id].block.parts.length > 1) };
}

// практика: ошибки прошлых уроков (по id упражнения), не больше двенадцати
export function buildPractice(mistakeIds, rand = Math.random) {
  const exs = mistakeIds.map((id) => EXERCISES[id]).filter(Boolean);
  return { items: shuffle(exs, rand).slice(0, 12).map((e) => instantiate(e, rand, { practice: true })) };
}

/* ------------------------------ СОСТОЯНИЕ ПУТИ ------------------------------
   Урок открыт, если пройден предыдущий урок юнита (первый урок — всегда). Юнит пройден,
   когда пройдены все его уроки; тогда открывается «уровень легенды». */
export function pathState(learn) {
  return pilotUnits().map((u) => {
    const lessons = u.lessons.map((l, i) => {
      const done = !!learn.lessons[l.id];
      const open = i === 0 || !!learn.lessons[u.lessons[i - 1].id];
      return { id: l.id, no: l.no, title: l.title, done, open };
    });
    const current = lessons.find((l) => l.open && !l.done) || null;
    return { unit: u, lessons, current, complete: lessons.every((l) => l.done), tested: !!learn.units[u.id] };
  });
}
export const unitTitle = (id) => (CHAPTER_BY_ID[id] || {}).title || id;
