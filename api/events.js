/* АНАЛИТИКА БЕЗ ПЕРСОНАЛЬНЫХ ДАННЫХ: сколько человек дошло до каждого шага воронки и какие
   упражнения труднее всего. Принимает { event, lesson?, exercise?, ok?, ms? } и только
   увеличивает счётчики в Redis: событие за день и «верно с первой попытки / всего» по
   упражнению. Ни логина, ни сессии, ни IP-адреса здесь нет — ни в ключах, ни в значениях
   (заголовки запроса не читаются вовсе).

   Отчёт (воронка за 30 дней и 20 самых трудных упражнений) видят только владельцы —
   OWNER_LOGINS, как сообщения об ошибках (api/reports.js). */
import { bumpCounters, readCounters, addToSet, setMembers, hasKv } from './_lib/store.js';
import { userBySession } from './_lib/accounts.js';
import { isOwner } from './reports.js';

// шаги воронки — в том порядке, в каком их проходит ученик
export const FUNNEL = ['welcome_start', 'goal_done', 'lesson_start', 'lesson_done', 'register_done', 'return_d1', 'return_d7'];
export const EVENTS = [...FUNNEL, 'ex_first_try_ok', 'ex_first_try_fail'];
export const FUNNEL_LABEL = {
  welcome_start: 'Нажали «Начать»', goal_done: 'Выбрали цель', lesson_start: 'Начали первый урок', lesson_done: 'Прошли урок',
  register_done: 'Создали аккаунт', return_d1: 'Вернулись на следующий день', return_d7: 'Вернулись через неделю',
};
const ID_RE = /^[a-z0-9][a-z0-9_:.-]{0,79}$/i;
const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const lastDays = (n, now = Date.now()) => Array.from({ length: n }, (_, k) => today(now - k * 86400000));

// что из тела запроса пойдёт в счётчики; всё остальное отбрасывается
export function sanitizeEvent(body) {
  if (!body || typeof body !== 'object' || !EVENTS.includes(body.event)) return null;
  const out = { event: body.event };
  if (typeof body.lesson === 'string' && ID_RE.test(body.lesson)) out.lesson = body.lesson;
  if (typeof body.exercise === 'string' && ID_RE.test(body.exercise)) out.exercise = body.exercise;
  if (typeof body.ok === 'boolean') out.ok = body.ok;
  if (Number.isFinite(body.ms) && body.ms >= 0 && body.ms < 3600000) out.ms = Math.round(body.ms);
  return out;
}
// какие счётчики увеличить
export function counterKeys(e, now = Date.now()) {
  const keys = [`day:${today(now)}:${e.event}`];
  if (e.exercise && (e.event === 'ex_first_try_ok' || e.event === 'ex_first_try_fail')) {
    keys.push(`exercise:${e.exercise}:total`);
    if (e.event === 'ex_first_try_ok') keys.push(`exercise:${e.exercise}:correct`);
  }
  return keys;
}

export async function report(now = Date.now()) {
  const days = lastDays(30, now);
  const dayKeys = days.flatMap((d) => FUNNEL.map((ev) => `day:${d}:${ev}`));
  const c = await readCounters(dayKeys);
  const funnel = FUNNEL.map((ev) => ({ event: ev, label: FUNNEL_LABEL[ev], count: days.reduce((a, d) => a + (c[`day:${d}:${ev}`] || 0), 0) }));
  const ids = await setMembers('exercises');
  const ex = await readCounters(ids.flatMap((id) => [`exercise:${id}:total`, `exercise:${id}:correct`]));
  const hardest = ids.map((id) => {
    const total = ex[`exercise:${id}:total`] || 0; const correct = ex[`exercise:${id}:correct`] || 0;
    return { id, total, correct, share: total ? correct / total : 1 };
  }).filter((x) => x.total >= 5).sort((a, b) => a.share - b.share || b.total - a.total).slice(0, 20);
  return { funnel, hardest, days: 30 };
}

async function handleRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  // отчёт — только владельцам, по сессии; события — без неё
  if (body && body.action === 'report') {
    const user = await userBySession(body.session);
    if (!isOwner(user)) return res.status(403).json({ error: 'Отчёт видят только владельцы' });
    return res.status(200).json({ ...(await report()), storage: hasKv() ? 'kv' : 'memory' });
  }
  const e = sanitizeEvent(body);
  if (!e) return res.status(400).json({ error: 'Неизвестное событие' });
  await bumpCounters(counterKeys(e));
  if (e.exercise && e.event.startsWith('ex_first_try')) await addToSet('exercises', e.exercise);
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('events handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
