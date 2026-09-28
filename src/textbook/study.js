/* ЗАНЯТИЕ НА СЕГОДНЯ: один раздел (минут на десять) плюс вопросы, которым подошёл срок.
   Раздел — первый непройденный, начиная с главы, которую читали последней; пройден он, когда
   на вопрос в его конце ответили «совпало». Модуль чистый, его читают тесты. */
import { CHAPTERS } from './toc.js';
import { PROBLEMS, RECALLS, studySections } from './content.js';
import { reviewQueue } from './progress.js';

export const sectionDone = (p, s) => !!(s.recall && p.problems[s.recall] && p.problems[s.recall].ok);

// сколько разделов главы пройдено
export function sectionProgress(p, chapterId) {
  const secs = studySections(chapterId);
  return { done: secs.filter((s) => sectionDone(p, s)).length, total: secs.length };
}

const READY = () => CHAPTERS.filter((c) => c.status === 'ready' && studySections(c.id).length);

// следующий раздел: с главы, где остановились, дальше по порядку и по кругу
export function nextSection(p) {
  const ready = READY();
  if (!ready.length) return null;
  const lastId = p.last && p.last.kind === 'chapter' ? p.last.id : null;
  const start = Math.max(0, ready.findIndex((c) => c.id === lastId));
  for (let k = 0; k < ready.length; k++) {
    const ch = ready[(start + k) % ready.length];
    const s = studySections(ch.id).find((x) => !sectionDone(p, x));
    if (s) return { chapter: ch.id, section: s };
  }
  return null;
}

// вопросы на повторение сегодня: задачи и вопросы разделов, которым подошёл срок
export function dueItems(p, now = Date.now()) {
  return reviewQueue(p, now).due.filter((id) => PROBLEMS[id] || RECALLS[id]);
}

export function todayPlan(p, now = Date.now()) {
  return { next: nextSection(p), due: dueItems(p, now) };
}
