/* «ПРОДОЛЖИТЬ УЧИТЬСЯ» в меню. Меню не грузит учебник (тексты глав и KaTeX — отдельный
   ленивый чанк): разделы и их минуты приходят из указателя, который сборка считает теми же
   функциями, что и учебник (scripts/textbook-sections-plugin.js). Раздел на сегодня и число
   вопросов на повторение считаются по прогрессу — он лёгкий и мог измениться на другом
   устройстве. */
import SECTION_INDEX from 'virtual:textbook-sections';
import { loadProgress, reviewQueue } from './progress.js';
import { nextSectionIn } from './study-core.js';
import { CHAPTER_BY_ID } from './toc.js';

export const indexSections = (chapterId) => SECTION_INDEX[chapterId] || [];

export function todayCard(now = Date.now(), progress = loadProgress()) {
  const n = nextSectionIn(progress, indexSections);
  const due = reviewQueue(progress, now).due.length;
  return {
    section: n ? { title: n.section.title, minutes: n.section.minutes, chapterTitle: CHAPTER_BY_ID[n.chapter].title } : null,
    allDone: !n,
    due,
  };
}
