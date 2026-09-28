/* ПУТЬ «КАК В ДУОЛИНГО»: состояние учёбы — пройденные уроки, опыт (XP) по дням, серия дней,
   дневная цель, статистика по типам упражнений. Живёт внутри прогресса учебника (поле learn)
   и едет в профиль вместе с ним. Модуль чистый: без React и без хранилища — его читают тесты
   и сервер (api/solo.js — через normalizeTextbook/mergeTextbook).

   Серия дней — дни, когда пройден хотя бы один урок. Один пропуск в календарную неделю
   «замораживается» и серию не обнуляет. Без наказаний: пропуск просто не считается днём серии. */
const DAY = 24 * 3600 * 1000;
export const XP = { correct: 2, hinted: 1, finish: 5, replayShare: 0.1 };
export const GOALS = [1, 2, 3, 5];
const MAX_DAYS = 400;
const MAX_KEYS = 300;
const MAX_MISTAKES = 60;

export const emptyLearn = () => ({
  lessons: {}, units: {}, goal: 1, goalAt: 0, xp: {}, done: {}, types: {},
  runs: { started: 0, finished: 0 }, quits: {}, quitAt: {}, mistakes: [],
});

// день по местному времени: ГГГГ-ММ-ДД
export const dayOf = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayTs = (key) => { const [y, mo, d] = key.split('-').map(Number); return new Date(y, mo - 1, d, 12).getTime(); };
const addDays = (key, n) => dayOf(dayTs(key) + n * DAY);
// неделя с понедельника: ключ — дата понедельника
const weekOf = (key) => { const t = new Date(dayTs(key)); const dow = (t.getDay() + 6) % 7; return addDays(key, -dow); };

/* ------------------------------ ЗАПИСИ ------------------------------ */
const upd = (s, patch) => ({ ...s, ...patch });
export const startLesson = (s) => upd(s, { runs: { ...s.runs, started: s.runs.started + 1 } });

// первая попытка в упражнении: тип, верно ли, сколько миллисекунд
export function recordAttempt(s, kind, ok, ms) {
  const t = s.types[kind] || { n: 0, ok: 0, ms: 0 };
  const cap = Math.max(0, Math.min(120000, Math.round(ms || 0)));
  return upd(s, { types: { ...s.types, [kind]: { n: t.n + 1, ok: t.ok + (ok ? 1 : 0), ms: t.ms + cap } } });
}

// ушли из урока, не закончив: на каком по счёту упражнении и какого типа
export function quitLesson(s, kind, index) {
  const i = String(Math.max(0, Math.min(30, index | 0)));
  return upd(s, { quits: { ...s.quits, [kind]: (s.quits[kind] || 0) + 1 }, quitAt: { ...s.quitAt, [i]: (s.quitAt[i] || 0) + 1 } });
}

// ошибки уходят в практику, верный ответ в практике их убирает
export const addMistake = (s, id, now = Date.now()) => upd(s, { mistakes: [...s.mistakes.filter((m) => m.id !== id), { id, at: now }].slice(-MAX_MISTAKES) });
export const resolveMistake = (s, id) => upd(s, { mistakes: s.mistakes.filter((m) => m.id !== id) });

/* Опыт за урок: 2 за каждое упражнение, решённое верно с первой попытки (и новое, и
   повторение), плюс 5 за то, что урок доведён до конца. Урок, который уже был пройден, даёт
   десятую часть — повторять лёгкое ради опыта незачем. */
// firstTry — верно с первой попытки без подсказки, hinted — верно с первой, но после подсказки
export function lessonXp({ firstTry, hinted = 0, replay }) {
  const full = firstTry * XP.correct + hinted * XP.hinted + XP.finish;
  return replay ? Math.max(1, Math.round(full * XP.replayShare)) : full;
}
export function finishLesson(s, lessonId, { xp, accuracy, now = Date.now(), count = true }) {
  const day = dayOf(now);
  const prev = s.lessons[lessonId];
  const lessons = lessonId ? { ...s.lessons, [lessonId]: { at: prev ? prev.at : now, runs: (prev ? prev.runs : 0) + 1, best: Math.max(prev ? prev.best : 0, Math.round(accuracy)) } } : s.lessons;
  return upd(s, {
    lessons,
    xp: { ...s.xp, [day]: (s.xp[day] || 0) + xp },
    done: count ? { ...s.done, [day]: (s.done[day] || 0) + 1 } : s.done,
    runs: { ...s.runs, finished: s.runs.finished + 1 },
  });
}
// «Проверка юнита» сдана: все его уроки считаются пройденными
export function passUnit(s, unitId, lessonIds, now = Date.now()) {
  const lessons = { ...s.lessons };
  lessonIds.forEach((id) => { if (!lessons[id]) lessons[id] = { at: now, runs: 0, best: 0 }; });
  return upd(s, { lessons, units: { ...s.units, [unitId]: { tested: now } } });
}
export const setGoal = (s, goal, now = Date.now()) => (GOALS.includes(goal) ? upd(s, { goal, goalAt: now }) : s);

/* ------------------------------ СЕРИЯ И РЕКОРДЫ ------------------------------ */
const active = (s, key) => (s.done[key] || 0) > 0;
/* Серия на сегодня: считаем назад от сегодня (если сегодня урока ещё не было — от вчера,
   сегодняшний день ещё не упущен). Пропуск в неделе, где заморозка ещё не потрачена, серию не
   рвёт; второй пропуск в той же неделе — рвёт. */
export function streak(s, now = Date.now()) {
  const today = dayOf(now);
  let key = active(s, today) ? today : addDays(today, -1);
  let n = 0; const frozenWeeks = new Set(); const used = []; let pending = [];
  for (let k = 0; k < MAX_DAYS; k += 1) {
    if (active(s, key)) {
      n += 1; used.push(...pending); pending = [];
    } else {
      const w = weekOf(key);
      if (frozenWeeks.has(w)) break;
      frozenWeeks.add(w); pending.push(key);
    }
    key = addDays(key, -1);
  }
  // заморозки, за которыми дальше в прошлом не было занятий, ничего не спасли — не считаем
  return { days: n, today: active(s, today), freezesUsed: used };
}
// самая длинная серия за всю историю (с теми же заморозками)
export function longestStreak(s) {
  const days = Object.keys(s.done).filter((d) => active(s, d)).sort();
  if (!days.length) return 0;
  let best = 0;
  days.forEach((d) => { best = Math.max(best, streak(s, dayTs(d)).days); });
  return best;
}
// лучшая неделя по опыту
export function bestWeek(s) {
  const weeks = {};
  Object.entries(s.xp).forEach(([d, x]) => { const w = weekOf(d); weeks[w] = (weeks[w] || 0) + x; });
  return Object.entries(weeks).reduce((b, [w, x]) => (x > b.xp ? { week: w, xp: x } : b), { week: null, xp: 0 });
}
// сделано сегодня против дневной цели
export const goalToday = (s, now = Date.now()) => ({ done: s.done[dayOf(now)] || 0, goal: s.goal || 1 });
// спит ли талисман: вчера занятий не было и сегодня ещё не было
export const missedYesterday = (s, now = Date.now()) => {
  const today = dayOf(now);
  return !active(s, today) && !active(s, addDays(today, -1)) && Object.keys(s.done).length > 0;
};

/* ------------------------------ СТАТИСТИКА ДЛЯ ПРОФИЛЯ ------------------------------ */
export function learnStats(s, now = Date.now()) {
  const today = dayOf(now);
  // дни занятий по неделям: последние четыре недели, от текущей назад
  const weeks = [0, 1, 2, 3].map((w) => {
    const mon = addDays(weekOf(today), -7 * w);
    let n = 0; for (let d = 0; d < 7; d += 1) if (active(s, addDays(mon, d))) n += 1;
    return { week: mon, days: n };
  });
  const types = Object.entries(s.types).map(([kind, t]) => ({ kind, n: t.n, accuracy: t.n ? t.ok / t.n : 0, avgSec: t.n ? t.ms / t.n / 1000 : 0 }))
    .sort((a, b) => b.n - a.n);
  const completion = s.runs.started ? Math.min(1, s.runs.finished / s.runs.started) : null;
  const quitKinds = Object.entries(s.quits).sort((a, b) => b[1] - a[1]);
  const quitPos = Object.entries(s.quitAt).map(([i, n]) => ({ index: Number(i), n })).sort((a, b) => b.n - a.n);
  return { weeks, types, completion, quitKinds, quitPos, totalXp: Object.values(s.xp).reduce((a, b) => a + b, 0) };
}

/* ------------------------------ ПРОФИЛЬ: ЧИСТКА И СЛИЯНИЕ ------------------------------ */
const fin = (v) => (Number.isFinite(v) ? v : 0);
const cnt = (v, hi = 1e7) => Math.max(0, Math.min(hi, Math.round(fin(v))));
const okKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 64;
const isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const dayMap = (v, hi) => {
  const out = {};
  Object.keys(obj(v)).filter(isDay).sort().slice(-MAX_DAYS).forEach((k) => { const x = cnt(v[k], hi); if (x > 0) out[k] = x; });
  return out;
};
export function normalizeLearn(raw) {
  const r = obj(raw); const e = emptyLearn();
  const lessons = {};
  Object.keys(obj(r.lessons)).filter(okKey).slice(0, MAX_KEYS).forEach((k) => {
    const l = obj(r.lessons[k]);
    lessons[k] = { at: cnt(l.at, 1e14), runs: cnt(l.runs, 1e5), best: cnt(l.best, 100) };
  });
  const units = {};
  Object.keys(obj(r.units)).filter(okKey).slice(0, MAX_KEYS).forEach((k) => { const t = cnt(obj(r.units[k]).tested, 1e14); if (t) units[k] = { tested: t }; });
  const types = {};
  Object.keys(obj(r.types)).filter(okKey).slice(0, 20).forEach((k) => {
    const t = obj(r.types[k]); const n = cnt(t.n);
    types[k] = { n, ok: Math.min(n, cnt(t.ok)), ms: cnt(t.ms, 1e12) };
  });
  const smallMap = (v) => { const out = {}; Object.keys(obj(v)).filter(okKey).slice(0, 40).forEach((k) => { const x = cnt(v[k]); if (x) out[k] = x; }); return out; };
  const runs = obj(r.runs);
  const started = cnt(runs.started);
  return {
    lessons, units, types,
    goal: GOALS.includes(r.goal) ? r.goal : e.goal, goalAt: cnt(r.goalAt, 1e14),
    xp: dayMap(r.xp, 1e6), done: dayMap(r.done, 1000),
    runs: { started, finished: Math.min(started || cnt(runs.finished), cnt(runs.finished)) },
    quits: smallMap(r.quits), quitAt: smallMap(r.quitAt),
    mistakes: (Array.isArray(r.mistakes) ? r.mistakes : []).filter((m) => m && okKey(m.id)).map((m) => ({ id: m.id, at: cnt(m.at, 1e14) })).slice(-MAX_MISTAKES),
  };
}
/* Слияние двух устройств: счётчики — по максимуму (одно и то же занятие не удваивается),
   цель — более поздняя, ошибки — объединение. Симметрично и повторное слияние ничего не меняет. */
export function mergeLearn(a, b) {
  const x = normalizeLearn(a); const y = normalizeLearn(b);
  const maxMap = (p, q) => { const out = { ...p }; Object.entries(q).forEach(([k, v]) => { out[k] = Math.max(out[k] || 0, v); }); return out; };
  const lessons = { ...x.lessons };
  Object.entries(y.lessons).forEach(([k, l]) => {
    const c = lessons[k];
    lessons[k] = c ? { at: Math.min(c.at || l.at, l.at || c.at), runs: Math.max(c.runs, l.runs), best: Math.max(c.best, l.best) } : l;
  });
  const units = { ...x.units };
  Object.entries(y.units).forEach(([k, u]) => { units[k] = { tested: Math.max((units[k] || {}).tested || 0, u.tested) }; });
  const types = { ...x.types };
  Object.entries(y.types).forEach(([k, t]) => { const c = types[k] || { n: 0, ok: 0, ms: 0 }; types[k] = { n: Math.max(c.n, t.n), ok: Math.max(c.ok, t.ok), ms: Math.max(c.ms, t.ms) }; });
  const byId = {};
  [...x.mistakes, ...y.mistakes].forEach((m) => { byId[m.id] = Math.max(byId[m.id] || 0, m.at); });
  const laterGoal = y.goalAt > x.goalAt || (y.goalAt === x.goalAt && y.goal > x.goal);
  return normalizeLearn({
    lessons, units, types,
    goal: laterGoal ? y.goal : x.goal, goalAt: Math.max(x.goalAt, y.goalAt),
    xp: maxMap(x.xp, y.xp), done: maxMap(x.done, y.done),
    runs: { started: Math.max(x.runs.started, y.runs.started), finished: Math.max(x.runs.finished, y.runs.finished) },
    quits: maxMap(x.quits, y.quits), quitAt: maxMap(x.quitAt, y.quitAt),
    mistakes: Object.entries(byId).map(([id, at]) => ({ id, at })).sort((p, q) => p.at - q.at || (p.id < q.id ? -1 : 1)),
  });
}
