/* АНАЛИТИКА БЕЗ ПЕРСОНАЛЬНЫХ ДАННЫХ: сколько человек дошло до каждого шага воронки и какие
   упражнения труднее всего. Принимает { event, lesson?, exercise?, ok?, ms? } и только
   увеличивает счётчики в Redis: событие за день и «верно с первой попытки / всего» по
   упражнению. Ни логина, ни сессии, ни IP-адреса здесь нет — ни в ключах, ни в значениях
   (заголовки запроса не читаются вовсе).

   Отчёт видят только владельцы — OWNER_LOGINS, как сообщения об ошибках (api/reports.js): воронка
   за 30 дней с конверсией шагов, активность и точность по дням, сводка за неделю против прошлой,
   уроки (начали, дошли до конца, сколько минут) и самые трудные упражнения, новые сообщения об
   ошибках по причинам. */
import { bumpCounters, addCounters, readCounters, addToSet, setMembers, getReports, hasKv } from './_lib/store.js';
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
  // по уроку: сколько раз начали и сколько дошли до конца
  if (e.lesson && (e.event === 'lesson_start' || e.event === 'lesson_done')) keys.push(`lesson:${e.lesson}:${e.event === 'lesson_start' ? 'start' : 'done'}`);
  return keys;
}
// суммы: секунды пройденного урока — для «сколько минут занимает урок»
export const counterSums = (e) => (e.lesson && e.event === 'lesson_done' && e.ms ? [[`lesson:${e.lesson}:sec`, Math.round(e.ms / 1000)]] : []);

const sumDays = (c, days, ev) => days.reduce((a, d) => a + (c[`day:${d}:${ev}`] || 0), 0);
export async function report(now = Date.now()) {
  const days = lastDays(30, now);
  const dayKeys = days.flatMap((d) => EVENTS.map((ev) => `day:${d}:${ev}`));
  const c = await readCounters(dayKeys);
  const funnel = FUNNEL.map((ev) => ({ event: ev, label: FUNNEL_LABEL[ev], count: sumDays(c, days, ev) }));
  // по дням — от старых к свежим: активность и точность с первой попытки
  const daily = [...days].reverse().map((d) => ({ day: d, ...Object.fromEntries(EVENTS.map((ev) => [ev, c[`day:${d}:${ev}`] || 0])) }));
  // неделя против прошлой недели (обе — внутри 30 дней)
  const week = (from) => days.slice(from, from + 7);
  const stat = (ev) => ({ now: sumDays(c, week(0), ev), prev: sumDays(c, week(7), ev), today: sumDays(c, days.slice(0, 1), ev) });
  const acc = (ds) => { const ok = sumDays(c, ds, 'ex_first_try_ok'); const all = ok + sumDays(c, ds, 'ex_first_try_fail'); return all ? ok / all : null; };
  const totals = { lessons: stat('lesson_done'), starts: stat('lesson_start'), accounts: stat('register_done'), newcomers: stat('welcome_start'), accuracy: { now: acc(week(0)), prev: acc(week(7)) } };
  // уроки: начали, дошли до конца, сколько минут в среднем
  const lessonIds = await setMembers('lessons');
  const lc = await readCounters(lessonIds.flatMap((id) => [`lesson:${id}:start`, `lesson:${id}:done`, `lesson:${id}:sec`]));
  const lessons = lessonIds.map((id) => {
    const start = lc[`lesson:${id}:start`] || 0; const done = lc[`lesson:${id}:done`] || 0; const sec = lc[`lesson:${id}:sec`] || 0;
    return { id, start, done, finish: start ? Math.min(1, done / start) : null, minutes: done ? sec / done / 60 : null };
  }).filter((x) => x.start > 0).sort((a, b) => b.start - a.start).slice(0, 40);
  // сообщения об ошибках: новые по причинам
  const fresh = (await getReports()).filter((r) => r.status !== 'done');
  const reports = { fresh: fresh.length, byReason: fresh.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {}) };
  const ids = await setMembers('exercises');
  const ex = await readCounters(ids.flatMap((id) => [`exercise:${id}:total`, `exercise:${id}:correct`]));
  const hardest = ids.map((id) => {
    const total = ex[`exercise:${id}:total`] || 0; const correct = ex[`exercise:${id}:correct`] || 0;
    return { id, total, correct, share: total ? correct / total : 1 };
  }).filter((x) => x.total >= 5).sort((a, b) => a.share - b.share || b.total - a.total).slice(0, 20);
  return { funnel, daily, totals, lessons, reports, hardest, days: 30 };
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
  const sums = counterSums(e);
  if (sums.length) await addCounters(sums);
  if (e.exercise && e.event.startsWith('ex_first_try')) await addToSet('exercises', e.exercise);
  if (e.lesson && (e.event === 'lesson_start' || e.event === 'lesson_done')) await addToSet('lessons', e.lesson);
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
