/* ЗАНЯТИЕ НА СЕГОДНЯ: один раздел (минут на десять) плюс вопросы, которым подошёл срок.
   Раздел — первый непройденный, начиная с главы, которую читали последней; пройден он, когда
   на вопрос в его конце ответили «совпало». Модуль чистый, его читают тесты. */
import { PROBLEMS, RECALLS, studySections } from './content.js';
import { reviewQueue } from './progress.js';
import { sectionDone, nextSectionIn } from './study-core.js';

export { sectionDone };

// сколько разделов главы пройдено
export function sectionProgress(p, chapterId) {
  const secs = studySections(chapterId);
  return { done: secs.filter((s) => sectionDone(p, s)).length, total: secs.length };
}

// следующий раздел: с главы, где остановились, дальше по порядку и по кругу
export const nextSection = (p) => nextSectionIn(p, studySections);

// вопросы на повторение сегодня: задачи и вопросы разделов, которым подошёл срок
export function dueItems(p, now = Date.now()) {
  return reviewQueue(p, now).due.filter((id) => PROBLEMS[id] || RECALLS[id]);
}

export function todayPlan(p, now = Date.now()) {
  return { next: nextSection(p), due: dueItems(p, now) };
}
