/* ПРОГРЕСС ПО УЧЕБНИКУ: какие главы прочитаны, как решены задачи и что пора повторить.
   Живёт на устройстве (localStorage), как прогресс курсов обучения.

   Повторение — по коробкам Лейтнера: неверный ответ кладёт задачу в первую коробку, и
   она возвращается в список «на повторение» через REVIEW_DAYS[0] дней. Верный ответ на
   повторении переносит её в следующую коробку (через 5, потом через 12 дней), после
   последней задача из повторения уходит. Неверный ответ на любом шаге — снова в первую.

   Состояние: { read: { [главa]: ts }, problems: { [задача]: { tries, ok, box, due, lastAt } }, last } */
export const TEXTBOOK_PROGRESS_KEY = 'ems-textbook-v1';
export const REVIEW_DAYS = [2, 5, 12];
const DAY = 24 * 3600 * 1000;

export const emptyProgress = () => ({ read: {}, problems: {}, last: null });

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEXTBOOK_PROGRESS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return emptyProgress();
    return { read: raw.read || {}, problems: raw.problems || {}, last: raw.last || null };
  } catch { return emptyProgress(); }
}
export function saveProgress(p) {
  try { localStorage.setItem(TEXTBOOK_PROGRESS_KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
  return p;
}

export const markRead = (p, chapterId, now = Date.now()) => ({ ...p, read: { ...p.read, [chapterId]: p.read[chapterId] || now } });
export const unmarkRead = (p, chapterId) => { const read = { ...p.read }; delete read[chapterId]; return { ...p, read }; };
export const setLast = (p, page) => ({ ...p, last: page });

// ответ на задачу: обновляет счёт и расписание повторения
export function recordAnswer(p, problemId, correct, now = Date.now()) {
  const prev = p.problems[problemId] || { tries: 0, ok: false, box: null, due: null };
  let { box, due } = prev;
  if (!correct) { box = 0; due = now + REVIEW_DAYS[0] * DAY; }
  else if (box != null) {
    // верно на повторении — в следующую коробку, после последней повторение закончено
    box += 1;
    if (box >= REVIEW_DAYS.length) { box = null; due = null; } else due = now + REVIEW_DAYS[box] * DAY;
  }
  return { ...p, problems: { ...p.problems, [problemId]: { tries: prev.tries + 1, ok: !!correct, box, due, lastAt: now } } };
}

// задачи, которые пора повторить (срок наступил), и те, что ещё ждут своего дня
export function reviewQueue(p, now = Date.now()) {
  const all = Object.entries(p.problems).filter(([, r]) => r.due != null);
  const due = all.filter(([, r]) => r.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
  const later = all.filter(([, r]) => r.due > now).sort((a, b) => a[1].due - b[1].due);
  return { due, later: later.map(([id, r]) => ({ id, due: r.due })) };
}

// счёт по главе: сколько задач решено верно (по последней попытке) из скольких
export function chapterScore(p, problemIds) {
  const solved = problemIds.filter((id) => p.problems[id] && p.problems[id].ok).length;
  const tried = problemIds.filter((id) => p.problems[id]).length;
  return { solved, tried, total: problemIds.length };
}

// «через 2 дня», «завтра», «сегодня»
export function daysUntil(ts, now = Date.now()) {
  const d = Math.ceil((ts - now) / DAY);
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'завтра';
  const mod10 = d % 10; const mod100 = d % 100;
  const w = mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней';
  return `через ${d} ${w}`;
}
