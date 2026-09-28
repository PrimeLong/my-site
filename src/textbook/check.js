/* ПРОВЕРКА ЗНАНИЙ: итоговая проверка по блоку, «задачи вперемешку», «мой прогресс» и журнал
   занятий. Модуль чистый — его читают тесты; экран — в textbook.jsx.

   Итоговая проверка блока — по два типа задач из каждой готовой главы (базовый и
   семинарский), вперемешку, без подсказок и решений до конца. Задачи — параллельные варианты
   (variants.js): тот же тип, что в главе, но числа новые при каждой пересдаче, чтобы проверка
   меряла умение, а не память. В конце — счёт по темам и слабые места; ошибка отправляет на
   повторение задачу главы того же типа.

   «Задачи вперемешку» — такие же варианты из глав, где пройден хотя бы раздел или глава
   отмечена прочитанной, без названия главы: сначала нужно понять, какая модель здесь нужна. */
import { CHAPTERS, CHAPTER_BY_ID } from './toc.js';
import { problemsOf, studySections } from './content.js';
import { templatesOf, makeVariant, seeded } from './variants.js';
import { checkAnswer } from './markdown.js';
import { sectionProgress } from './study.js';
import { dayKey } from './progress.js';

export const EXAMS = {
  micro: { part: 'micro', title: 'Итоговая проверка: Микро' },
};

const readyOf = (part) => CHAPTERS.filter((c) => c.status === 'ready' && c.part === part);

// перемешивание с зерном: у одного зерна — один порядок
function mix(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Задачи проверки — параллельные варианты: из каждой главы блока тип задачи базового и тип
   семинарского уровня, с новыми числами при каждом seed (каждой пересдаче). Соседние задачи —
   из разных глав: по порядку тему не угадать. */
export function examTemplates(examId) {
  const exam = EXAMS[examId];
  if (!exam) return [];
  return readyOf(exam.part).flatMap((c) => [1, 2].map((lv) => templatesOf(c.id).find((t) => t.level === lv)).filter(Boolean));
}
export function examSet(examId, seed = 1) {
  const rand = seeded(seed);
  const tpls = examTemplates(examId);
  let order = mix(tpls, rand);
  for (let k = 0; k < 200 && order.some((t, i) => i > 0 && t.chapter === order[i - 1].chapter); k += 1) order = mix(tpls, rand);
  return order.map((t, i) => makeVariant(t.id, (seed * 7919 + i * 104729) >>> 0));
}

// верна ли задача целиком: все шаги
export const examCorrect = (block, inputs) => block.parts.every((pt, k) => checkAnswer((inputs || [])[k], pt.answer, pt.tol, pt.unit).ok);

/* Итог проверки: по каждой главе — сколько верно; слабые места — главы, где верно меньше
   половины (по возрастанию доли), не больше трёх. answers — по id варианта. */
export function examResult(blocks, answers) {
  const byChapter = {};
  const rows = blocks.map((b) => {
    const ok = examCorrect(b, answers[b.id]);
    byChapter[b.chapter] = byChapter[b.chapter] || { chapter: b.chapter, ok: 0, total: 0 };
    byChapter[b.chapter].total += 1; if (ok) byChapter[b.chapter].ok += 1;
    return { id: b.id, source: b.source, ok };
  });
  const topics = Object.values(byChapter);
  const weak = topics.filter((t) => t.ok / t.total < 0.5).sort((a, b) => a.ok / a.total - b.ok / b.total).slice(0, 3);
  return { rows, ok: rows.filter((r) => r.ok).length, total: rows.length, topics, weak };
}

// главы, из которых берутся «задачи вперемешку»: прочитана или пройден хотя бы раздел
export function mixedChapters(progress) {
  return CHAPTERS.filter((c) => c.status === 'ready' && (progress.read[c.id] || sectionProgress(progress, c.id).done > 0)).map((c) => c.id);
}

/* Набор «вперемешку»: n параллельных вариантов задач из пройденных глав, у каждой — три
   варианта модели: верная глава и две другие (сначала из того же блока). rand — для тестов. */
export function mixedSet(progress, n = 5, rand = Math.random) {
  const chapters = mixedChapters(progress);
  const pool = chapters.flatMap((c) => templatesOf(c));
  const pick = (arr, k) => {
    const a = arr.slice(); const out = [];
    while (a.length && out.length < k) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
    return out;
  };
  return pick(pool, n).map((tpl) => {
    const ch = tpl.chapter;
    const part = CHAPTER_BY_ID[ch].part;
    const others = CHAPTERS.filter((c) => c.status === 'ready' && c.id !== ch);
    const same = others.filter((c) => c.part === part).map((c) => c.id);
    const rest = others.filter((c) => c.part !== part).map((c) => c.id);
    const wrong = pick(same, 2);
    if (wrong.length < 2) wrong.push(...pick(rest, 2 - wrong.length));
    const options = pick([ch, ...wrong], 3);
    const block = makeVariant(tpl.id, Math.floor(rand() * 2 ** 31));
    return { id: block.id, block, chapter: ch, source: tpl.source, options };
  });
}

/* «Мой прогресс»: разделы, точность уверенных и неуверенных ответов, слабые темы. Слабая
   тема — глава, где среди отвеченных задач и вопросов больше всего неверных (по последней
   попытке); учитываются только главы, где ответов не меньше двух. */
export function weakTopics(progress, k = 3) {
  return CHAPTERS.filter((c) => c.status === 'ready').map((c) => {
    const ids = [...problemsOf(c.id), ...studySections(c.id).map((s) => s.recall)];
    const tried = ids.filter((id) => progress.problems[id]);
    const wrong = tried.filter((id) => !progress.problems[id].ok).length;
    return { chapter: c.id, tried: tried.length, wrong, share: tried.length ? wrong / tried.length : 0 };
  }).filter((t) => t.tried >= 2 && t.wrong > 0).sort((a, b) => b.share - a.share || b.wrong - a.wrong).slice(0, k);
}

/* Журнал занятий: сколько минут в учебнике по дням (days в прогрессе) — только сумма за
   день, без серий и штрафов. */
// последние weeks недель по дням, от понедельника
export function journalWeeks(days, now = Date.now(), weeks = 4) {
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // понедельник — 0
  const start = new Date(today); start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const out = [];
  for (let w = 0; w < weeks; w += 1) {
    const row = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(day.getTime());
      row.push({ key, minutes: (days && days[key]) || 0, future: day.getTime() > today.getTime() });
    }
    out.push(row);
  }
  return out;
}
export function journalSummary(days, now = Date.now(), weeks = 4) {
  const cells = journalWeeks(days, now, weeks).flat().filter((c) => !c.future);
  const active = cells.filter((c) => c.minutes > 0);
  return { days: active.length, minutes: active.reduce((s, c) => s + c.minutes, 0) };
}
