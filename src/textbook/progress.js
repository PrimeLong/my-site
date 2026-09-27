/* ПРОГРЕСС ПО УЧЕБНИКУ: какие главы прочитаны, как решены задачи и что пора повторить.
   Живёт на устройстве (localStorage), как прогресс курсов обучения.

   Повторение — по коробкам Лейтнера: неверный ответ кладёт задачу в первую коробку, и
   она возвращается в список «на повторение» через REVIEW_DAYS[0] дней. Верный ответ на
   повторении переносит её в следующую коробку (через 5, потом через 12 дней), после
   последней задача из повторения уходит. Неверный ответ на любом шаге — снова в первую.

   Состояние: { read: { [главa]: ts }, unread: { [глава]: ts }, problems: { [задача]: { tries, ok, box, due, lastAt } },
   last, lastAt }. Прогресс уходит в профиль вместе с остальным (см. mergeTextbook) — поэтому снятая
   отметка «прочитано» не стирается бесследно, а помнит, когда её сняли: иначе второе устройство
   вернуло бы её при следующей синхронизации. */
export const TEXTBOOK_PROGRESS_KEY = 'ems-textbook-v1';
export const REVIEW_DAYS = [2, 5, 12];
const DAY = 24 * 3600 * 1000;

export const emptyProgress = () => ({ read: {}, unread: {}, problems: {}, last: null, lastAt: 0 });

export function loadProgress() {
  try {
    return normalizeTextbook(JSON.parse(localStorage.getItem(TEXTBOOK_PROGRESS_KEY) || 'null'));
  } catch { return emptyProgress(); }
}
export function saveProgress(p) {
  try { localStorage.setItem(TEXTBOOK_PROGRESS_KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
  return p;
}

export const markRead = (p, chapterId, now = Date.now()) => {
  const unread = { ...p.unread }; delete unread[chapterId];
  return { ...p, read: { ...p.read, [chapterId]: p.read[chapterId] || now }, unread };
};
export const unmarkRead = (p, chapterId, now = Date.now()) => {
  const read = { ...p.read }; delete read[chapterId];
  return { ...p, read, unread: { ...p.unread, [chapterId]: now } };
};
export const setLast = (p, page, now = Date.now()) => (
  JSON.stringify(page) === JSON.stringify(p.last) ? p : { ...p, last: page, lastAt: now });

/* Прогресс в профиле. Данные приходят с другого устройства и с сервера, поэтому сначала
   чистка: только знакомые поля, конечные числа, короткие ключи, ограниченное число записей. */
const MAX_ENTRIES = 600;
const fin = (v) => (Number.isFinite(v) ? v : null);
const okKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 64;
const tsMap = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  Object.keys(v).filter(okKey).slice(0, MAX_ENTRIES).forEach((k) => { if (fin(v[k]) != null && v[k] > 0) out[k] = v[k]; });
  return out;
};
const cleanPage = (v) => {
  if (!v || typeof v !== 'object' || typeof v.kind !== 'string' || v.kind.length > 32) return null;
  const page = { kind: v.kind };
  if (okKey(v.id)) page.id = v.id;
  return page;
};
export function normalizeTextbook(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyProgress();
  const problems = {};
  const src = raw.problems && typeof raw.problems === 'object' && !Array.isArray(raw.problems) ? raw.problems : {};
  Object.keys(src).filter(okKey).slice(0, MAX_ENTRIES).forEach((id) => {
    const r = src[id];
    if (!r || typeof r !== 'object') return;
    const box = Number.isInteger(r.box) && r.box >= 0 && r.box < REVIEW_DAYS.length ? r.box : null;
    problems[id] = {
      tries: Math.max(0, Math.min(9999, Math.round(fin(r.tries) || 0))),
      ok: !!r.ok,
      box,
      due: box == null ? null : fin(r.due),
      lastAt: Math.max(0, fin(r.lastAt) || 0),
    };
  });
  return { read: tsMap(raw.read), unread: tsMap(raw.unread), problems, last: cleanPage(raw.last), lastAt: Math.max(0, fin(raw.lastAt) || 0) };
}

/* Слияние двух копий прогресса (телефон и компьютер, устройство и профиль). В отличие от
   достижений, здесь не всё монотонно: отметку «прочитано» снимают, задача после неверного
   ответа возвращается в первую коробку. Поэтому по каждой записи побеждает более поздняя:
   прочитано/не прочитано — по времени отметки, задача — по времени последнего ответа,
   место чтения — по времени перехода. Слияние симметрично и повторное ничего не меняет. */
export function mergeTextbook(a, b) {
  const x = normalizeTextbook(a); const y = normalizeTextbook(b);
  const read = {}; const unread = {};
  const chapters = new Set([...Object.keys(x.read), ...Object.keys(y.read), ...Object.keys(x.unread), ...Object.keys(y.unread)]);
  chapters.forEach((id) => {
    const readTs = [x.read[id], y.read[id]].filter(Boolean);
    const unreadAt = Math.max(x.unread[id] || 0, y.unread[id] || 0);
    const lastRead = readTs.length ? Math.max(...readTs) : 0;
    // прочитано, если последняя отметка «прочитано» позже снятия; дата — первого прочтения
    if (lastRead > unreadAt) read[id] = Math.min(...readTs.filter((t) => t > unreadAt));
    else if (unreadAt) unread[id] = unreadAt;
  });
  const problems = { ...x.problems };
  Object.entries(y.problems).forEach(([id, r]) => {
    const cur = problems[id];
    if (!cur) { problems[id] = r; return; }
    const later = r.lastAt > cur.lastAt || (r.lastAt === cur.lastAt && JSON.stringify(r) > JSON.stringify(cur)) ? r : cur;
    problems[id] = { ...later, tries: Math.max(cur.tries, r.tries) };
  });
  const pickY = y.lastAt > x.lastAt || (y.lastAt === x.lastAt && !x.last && y.last);
  return { read, unread, problems, last: pickY ? y.last : x.last, lastAt: Math.max(x.lastAt, y.lastAt) };
}

/* Расписание после ответа. Переносит повторение дальше только верный самостоятельный ответ
   в день повторения (или позже). Верный ответ до срока — например, сразу после того как
   открыли решение, — расписание не трогает: ничего не изменилось. Верный ответ с
   подсмотренным решением засчитывается, но задача всё равно вернётся через 2 дня.
   Неверный — в первую коробку, через 2 дня. */
export function scheduleAfter(prev, correct, now = Date.now(), { sawSolution = false } = {}) {
  const box = prev ? prev.box : null; const due = prev ? prev.due : null;
  const first = { box: 0, due: now + REVIEW_DAYS[0] * DAY };
  if (!correct) return { ...first, why: 'wrong' };
  if (due != null && due > now) return { box, due, why: 'early' };
  if (sawSolution) return due == null ? { ...first, why: 'solution' } : { box: 0, due: now + REVIEW_DAYS[0] * DAY, why: 'solution' };
  if (box == null) return { box: null, due: null, why: 'clean' };
  const next = box + 1;
  if (next >= REVIEW_DAYS.length) return { box: null, due: null, why: 'done' };
  return { box: next, due: now + REVIEW_DAYS[next] * DAY, why: 'advance' };
}

// ответ на задачу: обновляет счёт и расписание повторения
export function recordAnswer(p, problemId, correct, now = Date.now(), opts = {}) {
  const prev = p.problems[problemId] || { tries: 0, ok: false, box: null, due: null };
  const { box, due } = scheduleAfter(prev, correct, now, opts);
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
