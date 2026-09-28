/* НЕЗАКОНЧЕННЫЙ УРОК. Вышли из урока после первого ответа — урок сохраняется целиком (те же
   упражнения с теми же числами, место, ответы) и его можно продолжить с того же места в
   течение суток. Не продолжили за сутки — урок считается брошенным: только тогда он попадает
   в статистику «не доведён до конца» (abandonLesson в learn-state.js). Хранится на
   устройстве: продолжить урок можно там, где его начали. */
export const RESUME_MS = 24 * 3600 * 1000;
const KEY = 'ems-learn-resume';

const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const write = (v) => { try { if (Object.keys(v).length) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* приватный режим */ } };

// чистая часть: какие сохранённые уроки ещё можно продолжить, а какие просрочены
export function pruneResumes(map, now = Date.now()) {
  const fresh = {}; const expired = [];
  Object.entries(map || {}).forEach(([id, r]) => {
    if (r && Number.isFinite(r.at) && now - r.at < RESUME_MS && now >= r.at - 60000) fresh[id] = r;
    else if (r) expired.push({ id, ...r });
  });
  return { fresh, expired };
}

export function saveResume(lessonId, data, now = Date.now()) {
  const map = read();
  map[lessonId] = { ...data, at: now };
  write(map);
}
export function dropResume(lessonId) {
  const map = read();
  if (map[lessonId]) { delete map[lessonId]; write(map); }
}
export function getResume(lessonId, now = Date.now()) {
  return pruneResumes(read(), now).fresh[lessonId] || null;
}
// просроченные уроки забираются из хранилища — вызывающий засчитывает их как брошенные
export function takeExpiredResumes(now = Date.now()) {
  const { fresh, expired } = pruneResumes(read(), now);
  if (expired.length) write(fresh);
  return expired;
}
export const resumeIds = (now = Date.now()) => Object.keys(pruneResumes(read(), now).fresh);
