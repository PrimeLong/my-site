/* «ПРОДОЛЖИТЬ УЧИТЬСЯ» в меню. Меню не грузит учебник (тексты глав и KaTeX — отдельный
   ленивый чанк), поэтому учебник сам оставляет короткую записку: какой раздел на сегодня и
   сколько в нём минут. Число вопросов на повторение меню считает само по прогрессу —
   он лёгкий и мог измениться на другом устройстве. Модуль не тянет за собой тексты глав. */
import { loadProgress, reviewQueue } from './progress.js';

export const TODAY_SNAPSHOT_KEY = 'ems-textbook-today';

export function saveTodaySnapshot(next) {
  const snap = next
    ? { chapter: next.chapter, title: next.section.title, minutes: next.section.minutes, chapterTitle: next.chapterTitle || null }
    : { done: true };
  try { localStorage.setItem(TODAY_SNAPSHOT_KEY, JSON.stringify(snap)); } catch { /* приватный режим */ }
  return snap;
}

// что показать на карточке: раздел (если учебник уже открывали) и сколько повторять сегодня
export function todayCard(now = Date.now()) {
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem(TODAY_SNAPSHOT_KEY) || 'null'); } catch { snap = null; }
  const ok = snap && typeof snap === 'object' && (snap.done === true || (typeof snap.title === 'string' && Number.isFinite(snap.minutes)));
  const due = reviewQueue(loadProgress(), now).due.length;
  return { section: ok && !snap.done ? { title: snap.title.slice(0, 80), minutes: Math.max(1, Math.min(60, Math.round(snap.minutes))), chapterTitle: typeof snap.chapterTitle === 'string' ? snap.chapterTitle.slice(0, 80) : null } : null, allDone: !!(ok && snap.done), due };
}
