/* Ядро «занятия на сегодня» без текстов глав: разделы приходят параметром — из учебника
   (study.js) или из лёгкого указателя разделов в меню (today-snapshot.js). */
import { CHAPTERS } from './toc.js';

export const sectionDone = (p, s) => !!(s.recall && p.problems[s.recall] && p.problems[s.recall].ok);

// следующий раздел: с главы, где остановились, дальше по порядку и по кругу
export function nextSectionIn(p, sectionsOfChapter) {
  const ready = CHAPTERS.filter((c) => c.status === 'ready' && sectionsOfChapter(c.id).length);
  if (!ready.length) return null;
  const lastId = p.last && p.last.kind === 'chapter' ? p.last.id : null;
  const start = Math.max(0, ready.findIndex((c) => c.id === lastId));
  for (let k = 0; k < ready.length; k++) {
    const ch = ready[(start + k) % ready.length];
    const s = sectionsOfChapter(ch.id).find((x) => !sectionDone(p, x));
    if (s) return { chapter: ch.id, section: s };
  }
  return null;
}
