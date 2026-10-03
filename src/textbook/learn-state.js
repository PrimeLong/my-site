/* ПУТЬ «КАК В ДУОЛИНГО»: состояние учёбы — пройденные уроки, опыт (XP) по дням, серия дней,
   дневная цель, статистика по типам упражнений. Живёт внутри прогресса учебника (поле learn)
   и едет в профиль вместе с ним. Модуль чистый: без React и без хранилища — его читают тесты
   и сервер (api/solo.js — через normalizeTextbook/mergeTextbook).

   Серия дней — дни, когда пройден хотя бы один урок. Один пропуск в календарную неделю
   «замораживается» и серию не обнуляет. Без наказаний: пропуск просто не считается днём серии. */
const DAY = 24 * 3600 * 1000;
export const XP = { correct: 2, finish: 5, replayShare: 0.1, diamond: 1.5 };
export const GOALS = [1, 2, 3, 5];
const MAX_DAYS = 400;
const MAX_KEYS = 300;
const MAX_MISTAKES = 60;
const MAX_HINTED = 60;

/* Этап 3 — персональная программа и награды:
   profile — ответы при регистрации (цель, минут в день, есть ли знания);
   placement — вступительный тест: когда пройден и какие юниты открыл;
   topics — точность по урокам (первые попытки, окно ~20 последних): слабые темы;
   recent — последние 30 первых попыток строкой «1»/«0»: уровень сложности;
   daily — счётчики дня для заданий дня: уроки, без ошибок, верные, секунды, серия, игры, практика;
   coins/spent — монеты по дням (заработано/потрачено), claimed — полученные награды (ключ → когда):
   одна награда не выдаётся дважды и на двух устройствах; owned — купленные вещи, wear — наряд Инфли;
   freezeBuy — купленные заморозки по дням, frozen — дни, которые спасла купленная заморозка;
   seen — сколько раз ученик встречал каждое упражнение (чтобы реже повторять одно и то же);
   best — рекорды мини-игр (очки); lessons[id].diamond — когда урок взят на алмазном уровне;
   boost — до какого времени действует купленный «двойной опыт». */
export const emptyLearn = () => ({
  lessons: {}, units: {}, goal: 1, goalAt: 0, xp: {}, done: {}, types: {},
  runs: { started: 0, finished: 0, abandoned: 0 }, quits: {}, quitAt: {}, mistakes: [], hinted: [],
  profile: { goal: null, minutes: null, knows: false, at: 0 }, placement: { at: 0, opened: [] },
  topics: {}, recent: '', recentAt: 0, daily: {},
  coins: {}, spent: {}, claimed: {}, owned: {}, wear: { head: null, face: null, neck: null, hand: null, frame: null, at: 0 }, freezeBuy: {}, frozen: {},
  seen: {}, best: {}, boost: 0,
});
export const PROFILE_GOALS = ['exam', 'olymp', 'uni', 'self'];
export const PROFILE_MINUTES = [5, 10, 15, 20];
export const PROFILE_GOAL_LABEL = { exam: 'Поступление в вуз', olymp: 'Олимпиада', uni: 'Первый курс', self: 'Для себя' };
// минуты в день → примерно уроков в день (урок — 3–5 минут): только для подписей и заданий
export const LESSONS_FOR_MINUTES = { 5: 1, 10: 2, 15: 3, 20: 5 };
/* Цель дня — в минутах (из ответа при регистрации, меняется в профиле): скорость у всех
   разная, а время занятий честно сравнивается само с собой. По умолчанию — 10 минут. */
export const goalMinutes = (s) => (s.profile && PROFILE_MINUTES.includes(s.profile.minutes) ? s.profile.minutes : 10);
export const SLOTS = ['head', 'face', 'neck', 'hand', 'frame'];
const MAX_SEEN = 800;
const MAX_BEST = 40;
const MAX_RECENT = 30;
const TOPIC_WINDOW = 20;
const MAX_DAILY = 60;
const MAX_CLAIMED = 500;

// день по местному времени: ГГГГ-ММ-ДД
export const dayOf = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayTs = (key) => { const [y, mo, d] = key.split('-').map(Number); return new Date(y, mo - 1, d, 12).getTime(); };
export const addDays = (key, n) => dayOf(dayTs(key) + n * DAY);
// неделя с понедельника: ключ — дата понедельника
const weekOf = (key) => { const t = new Date(dayTs(key)); const dow = (t.getDay() + 6) % 7; return addDays(key, -dow); };

/* ------------------------------ ЗАПИСИ ------------------------------ */
const upd = (s, patch) => ({ ...s, ...patch });
/* Урок начат — с первого ответа, а не с открытия: открыть и сразу закрыть урок нигде не
   засчитывается. Брошенным он становится, только если его не продолжили в течение суток
   (см. src/learn/resume.js) — тогда abandonLesson. */
export const startLesson = (s) => upd(s, { runs: { ...s.runs, started: s.runs.started + 1 } });

/* Первая попытка в упражнении: тип, верно ли, сколько миллисекунд. lesson — урок, откуда
   упражнение (точность по темам), run — сколько верных подряд теперь (для задания дня). */
export function recordAttempt(s, kind, ok, ms, { lesson = null, run = 0, now = Date.now() } = {}) {
  const t = s.types[kind] || { n: 0, ok: 0, ms: 0 };
  const cap = Math.max(0, Math.min(120000, Math.round(ms || 0)));
  const patch = { types: { ...s.types, [kind]: { n: t.n + 1, ok: t.ok + (ok ? 1 : 0), ms: t.ms + cap } } };
  if (lesson) {
    // окно: после двадцати попыток старые затухают (×19/20 на каждую новую) — считается недавняя точность
    const tp = (s.topics || {})[lesson] || { n: 0, ok: 0 };
    const full = tp.n >= TOPIC_WINDOW;
    const n = full ? TOPIC_WINDOW : tp.n + 1;
    const good = (full ? (tp.ok * (TOPIC_WINDOW - 1)) / TOPIC_WINDOW : tp.ok) + (ok ? 1 : 0);
    patch.topics = { ...s.topics, [lesson]: { n, ok: Math.round(good * 100) / 100 } };
  }
  patch.recent = `${s.recent || ''}${ok ? 1 : 0}`.slice(-MAX_RECENT);
  patch.recentAt = now;
  const day = dayOf(now); const d = dayEntry(s, day);
  // серия считается только по сегодняшним ответам: урок, начатый вчера, не приносит в новый день «готовую» серию
  patch.daily = { ...s.daily, [day]: { ...d, c: d.c + (ok ? 1 : 0), r: Math.max(d.r, ok ? Math.min(run, d.c + 1) : 0) } };
  return upd(s, patch);
}
const DAILY_FIELDS = ['l', 'p', 'c', 's', 'r', 'g', 'pr', 'h'];
const dayEntry = (s, day) => ({ l: 0, p: 0, c: 0, s: 0, r: 0, g: 0, pr: 0, h: 0, ...(s.daily || {})[day] });
export const dailyOf = (s, now = Date.now()) => dayEntry(s, dayOf(now));

// ответы при регистрации — из них цель дня и задания; меняются в профиле
export function setProfile(s, { goal, minutes, knows }, now = Date.now()) {
  const p = s.profile || emptyLearn().profile;
  return upd(s, { profile: {
    goal: PROFILE_GOALS.includes(goal) ? goal : p.goal, minutes: PROFILE_MINUTES.includes(minutes) ? minutes : p.minutes,
    knows: typeof knows === 'boolean' ? knows : p.knows, at: now,
  } });
}
// вступительный тест пройден: открытые им юниты — как сданные проверкой
export const setPlacement = (s, opened, now = Date.now()) => upd(s, { placement: { at: now, opened: opened.slice(0, 40) } });

// урок брошен после начала и не продолжен: на каком по счёту упражнении и какого типа
export function abandonLesson(s, kind, index) {
  const i = String(Math.max(0, Math.min(30, index | 0)));
  return upd(s, { quits: { ...s.quits, [kind]: (s.quits[kind] || 0) + 1 }, quitAt: { ...s.quitAt, [i]: (s.quitAt[i] || 0) + 1 },
    runs: { ...s.runs, abandoned: (s.runs.abandoned || 0) + 1 } });
}

// упражнение встретилось ученику (первая попытка): счётчик для «реже виденное — первым»
export function recordSeen(s, id) {
  if (!id || id.length > 64) return s;
  const seen = { ...s.seen };
  seen[id] = Math.min(9999, (seen[id] || 0) + 1);
  const keys = Object.keys(seen);
  // переполнение: забываем самые редкие — их и так покажут первыми
  if (keys.length > MAX_SEEN) keys.sort((a, b) => seen[a] - seen[b]).slice(0, keys.length - MAX_SEEN).forEach((k) => { if (k !== id) delete seen[k]; });
  return upd(s, { seen });
}
// рекорд мини-игры: остаётся лучший счёт
export const recordBest = (s, gameId, score) => ((s.best || {})[gameId] >= score ? s : upd(s, { best: { ...s.best, [gameId]: Math.max(0, Math.round(score)) } }));

// ошибки уходят в практику, верный ответ в практике их убирает
export const addMistake = (s, id, now = Date.now()) => upd(s, { mistakes: [...s.mistakes.filter((m) => m.id !== id), { id, at: now }].slice(-MAX_MISTAKES) });
export const resolveMistake = (s, id) => upd(s, { mistakes: s.mistakes.filter((m) => m.id !== id) });
/* Подсказка ничем не наказывается: ни опытом, ни плашкой. Единственное невидимое следствие —
   упражнение, решённое с подсказкой, попадает в «Повторение» раньше остальных (сразу после
   ошибок). Решено потом без подсказки — снимается с этого списка. */
export const addHinted = (s, id, now = Date.now()) => upd(s, { hinted: [...(s.hinted || []).filter((m) => m.id !== id), { id, at: now }].slice(-MAX_HINTED) });
export const clearHinted = (s, id) => ((s.hinted || []).some((m) => m.id === id) ? upd(s, { hinted: s.hinted.filter((m) => m.id !== id) }) : s);

/* Опыт за урок: 2 за каждое упражнение, решённое верно с первой попытки (и новое, и
   повторение, с подсказкой или без), плюс 5 за то, что урок доведён до конца. Урок, который
   уже был пройден, даёт десятую часть — повторять лёгкое ради опыта незачем. Алмазный
   уровень — не лёгкое: полтора полного опыта, сколько бы раз его ни проходили. */
export function lessonXp({ firstTry, replay, diamond = false }) {
  const full = firstTry * XP.correct + XP.finish;
  if (diamond) return Math.round(full * XP.diamond);
  return replay ? Math.max(1, Math.round(full * XP.replayShare)) : full;
}
/* Урок доведён до конца. seconds — сколько занимались (в задание «N минут занятий», не больше
   пятнадцати минут за раз), kind — вид урока, mode — урок Пути, практика или проверка;
   diamond — урок пройден на алмазном уровне: от 80% верных он отмечается алмазом. */
export const DIAMOND_ACCURACY = 80;
export function finishLesson(s, lessonId, { xp, accuracy, now = Date.now(), count = true, seconds = 0, kind = null, mode = 'lesson', diamond = false }) {
  const day = dayOf(now);
  const prev = s.lessons[lessonId];
  const gem = (prev && prev.diamond) || (diamond && accuracy >= DIAMOND_ACCURACY ? now : 0);
  const lessons = lessonId ? { ...s.lessons, [lessonId]: { at: prev ? prev.at : now, runs: (prev ? prev.runs : 0) + 1, best: Math.max(prev ? prev.best : 0, Math.round(accuracy)), ...(gem ? { diamond: gem } : {}) } } : s.lessons;
  const d = dayEntry(s, day);
  const hour = new Date(now).getHours();
  // в сегодняшние минуты — только время после полуночи: урок, начатый вчера, не делает новый день наполовину выполненным
  const sinceMidnight = (now - new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()) / 1000;
  const entry = {
    ...d, l: d.l + (lessonId ? 1 : 0), p: d.p + (lessonId && accuracy >= 100 ? 1 : 0), s: d.s + Math.max(0, Math.round(Math.min(900, seconds, sinceMidnight))),
    g: d.g + (kind === 'game' ? 1 : 0), pr: d.pr + (mode === 'practice' ? 1 : 0), h: d.h | (hour < 8 ? 1 : 0) | (hour >= 22 ? 2 : 0),
  };
  return upd(s, {
    lessons,
    xp: { ...s.xp, [day]: (s.xp[day] || 0) + xp },
    done: count ? { ...s.done, [day]: (s.done[day] || 0) + 1 } : s.done,
    runs: { ...s.runs, finished: s.runs.finished + 1 },
    daily: { ...s.daily, [day]: entry },
  });
}
/* «Проверка юнита» сдана (или вступительный тест открыл юнит): его уроки ОТКРЫТЫ, но не
   пройдены — ни опыта, ни сундука, ни печатей за них. Пройденным урок становится только
   уроком. ace — проверка без единой ошибки (печать «Знаток»). */
export function passUnit(s, unitId, { ace = false, now = Date.now() } = {}) {
  const prev = (s.units || {})[unitId] || {};
  return upd(s, { units: { ...s.units, [unitId]: { tested: prev.tested || now, ...(ace || prev.ace ? { ace: prev.ace || now } : {}) } } });
}
// урок пройден по-настоящему: был хотя бы один доведённый до конца раз (старые записи вступительного теста — runs: 0)
export const lessonDone = (s, id) => ((s.lessons || {})[id] || {}).runs > 0;
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
    } else if ((s.frozen || {})[key]) {
      // день спасла купленная заморозка: не рвёт серию и не тратит недельную
      pending.push(key);
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
/* Купленные заморозки: куплено минус потрачено. Тратятся сами, при открытии приложения, —
   на пропуск, который недельная заморозка уже не покрывает, и только если за пропуском есть
   занятия, то есть серию действительно есть что спасать. */
export const MAX_FREEZES = 2;
const sumMap = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
export const ownedFreezes = (s) => Math.max(0, sumMap(s.freezeBuy) - Object.keys(s.frozen || {}).length);
export function applyFreezes(s, now = Date.now()) {
  let owned = ownedFreezes(s);
  if (!owned) return s;
  const frozen = s.frozen || {};
  let key = addDays(dayOf(now), -1);
  const weeks = new Set(); const commit = []; let pending = []; let gap = 0;
  for (let k = 0; k < MAX_DAYS; k += 1) {
    if (active(s, key)) { commit.push(...pending); pending = []; gap = 0; } else if (!frozen[key]) {
      gap += 1;
      if (gap > 30) break;
      const w = weekOf(key);
      if (!weeks.has(w)) weeks.add(w);
      else if (owned > 0) { pending.push(key); owned -= 1; } else break;
    }
    key = addDays(key, -1);
  }
  if (!commit.length) return s;
  return upd(s, { frozen: { ...frozen, ...Object.fromEntries(commit.map((d) => [d, 1])) } });
}
// дни последней недели для экрана серии: занимался, спасён заморозкой, пропуск, сегодня
export function weekDots(s, now = Date.now()) {
  const today = dayOf(now);
  return [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const key = addDays(today, -back);
    return { day: key, dow: (new Date(dayTs(key)).getDay() + 6) % 7, done: active(s, key), frozen: !!(s.frozen || {})[key], today: back === 0 };
  });
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
// сделано сегодня против дневной цели: минуты занятий (уроки — для подписи)
export const goalToday = (s, now = Date.now()) => ({ done: Math.floor(dayEntry(s, dayOf(now)).s / 60), goal: goalMinutes(s), lessons: s.done[dayOf(now)] || 0 });
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
  // доля доведённых: брошенные — только те, что не продолжили в течение суток
  const ab = s.runs.abandoned || 0;
  const completion = s.runs.finished + ab ? s.runs.finished / (s.runs.finished + ab) : null;
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
    const l = obj(r.lessons[k]); const gem = cnt(l.diamond, 1e14);
    lessons[k] = { at: cnt(l.at, 1e14), runs: cnt(l.runs, 1e5), best: cnt(l.best, 100), ...(gem ? { diamond: gem } : {}) };
  });
  const units = {};
  Object.keys(obj(r.units)).filter(okKey).slice(0, MAX_KEYS).forEach((k) => { const u = obj(r.units[k]); const t = cnt(u.tested, 1e14); const ace = cnt(u.ace, 1e14); if (t) units[k] = { tested: t, ...(ace ? { ace } : {}) }; });
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
    runs: { started, finished: Math.min(started || cnt(runs.finished), cnt(runs.finished)), abandoned: cnt(runs.abandoned) },
    quits: smallMap(r.quits), quitAt: smallMap(r.quitAt),
    mistakes: (Array.isArray(r.mistakes) ? r.mistakes : []).filter((m) => m && okKey(m.id)).map((m) => ({ id: m.id, at: cnt(m.at, 1e14) })).slice(-MAX_MISTAKES),
    hinted: (Array.isArray(r.hinted) ? r.hinted : []).filter((m) => m && okKey(m.id)).map((m) => ({ id: m.id, at: cnt(m.at, 1e14) })).slice(-MAX_HINTED),
    ...normalizeProgram(r),
  };
}
const tsMap = (v, limit) => {
  const out = {};
  Object.keys(obj(v)).filter(okKey).slice(0, limit).forEach((k) => { const t = cnt(v[k], 1e14); if (t) out[k] = t; });
  return out;
};
const countMap = (v, limit, hi) => {
  const out = {};
  Object.keys(obj(v)).filter(okKey).slice(0, limit).forEach((k) => { const x = cnt(v[k], hi); if (x) out[k] = x; });
  return out;
};
// полученные награды: ключи заданий дня («q:ГГГГ-ММ-ДД:…») — только за последние месяцы, остальные — все
function claimedMap(v) {
  const all = tsMap(v, 5000);
  const quests = Object.keys(all).filter((k) => k.startsWith('q:')).sort().slice(-250);
  const rest = Object.keys(all).filter((k) => !k.startsWith('q:')).sort().slice(0, MAX_CLAIMED - 250);
  const out = {}; [...rest, ...quests].forEach((k) => { out[k] = all[k]; });
  return out;
}
function normalizeProgram(r) {
  const e = emptyLearn();
  const p = obj(r.profile); const pl = obj(r.placement); const w = obj(r.wear);
  const topics = {};
  Object.keys(obj(r.topics)).filter(okKey).slice(0, MAX_KEYS).forEach((k) => {
    const t = obj(r.topics[k]); const n = cnt(t.n, TOPIC_WINDOW);
    if (n) topics[k] = { n, ok: Math.min(n, Math.round(Math.max(0, fin(t.ok)) * 100) / 100) };
  });
  const daily = {};
  Object.keys(obj(r.daily)).filter(isDay).sort().slice(-MAX_DAILY).forEach((k) => {
    const d = obj(r.daily[k]); const out = {};
    DAILY_FIELDS.forEach((f) => { out[f] = cnt(d[f], f === 's' ? 86400 : f === 'h' ? 3 : 1e5); });
    daily[k] = out;
  });
  return {
    profile: {
      goal: PROFILE_GOALS.includes(p.goal) ? p.goal : e.profile.goal, minutes: PROFILE_MINUTES.includes(p.minutes) ? p.minutes : e.profile.minutes,
      knows: p.knows === true, at: cnt(p.at, 1e14),
    },
    placement: { at: cnt(pl.at, 1e14), opened: (Array.isArray(pl.opened) ? pl.opened : []).filter(okKey).slice(0, 40) },
    topics, daily,
    recent: typeof r.recent === 'string' && /^[01]*$/.test(r.recent) ? r.recent.slice(-MAX_RECENT) : '', recentAt: cnt(r.recentAt, 1e14),
    coins: dayMap(r.coins, 1e6), spent: dayMap(r.spent, 1e6), freezeBuy: dayMap(r.freezeBuy, MAX_FREEZES * 5),
    frozen: Object.fromEntries(Object.keys(obj(r.frozen)).filter(isDay).sort().slice(-MAX_DAYS).map((k) => [k, 1])),
    claimed: claimedMap(r.claimed), owned: tsMap(r.owned, 60),
    wear: { ...Object.fromEntries(SLOTS.map((sl) => [sl, okKey(w[sl]) ? w[sl] : null])), at: cnt(w.at, 1e14) },
    seen: countMap(r.seen, MAX_SEEN, 9999), best: countMap(r.best, MAX_BEST, 1e6), boost: cnt(r.boost, 1e14),
  };
}
// слияние полей программы: ответы и наряд — более поздние, счётчики дня — по максимуму, награды и покупки — объединение
function mergeProgram(x, y) {
  const maxMap = (p, q) => { const out = { ...p }; Object.entries(q).forEach(([k, v]) => { out[k] = Math.max(out[k] || 0, v); }); return out; };
  const minTs = (p, q) => { const out = { ...p }; Object.entries(q).forEach(([k, v]) => { out[k] = out[k] ? Math.min(out[k], v) : v; }); return out; };
  // «более позднее» при равном времени решает сравнение текста — слияние симметрично
  const later = (a, b) => (b.at > a.at || (b.at === a.at && JSON.stringify(b) > JSON.stringify(a)) ? b : a);
  const topics = { ...x.topics };
  Object.entries(y.topics).forEach(([k, t]) => { const c = topics[k]; topics[k] = !c || t.n > c.n || (t.n === c.n && t.ok > c.ok) ? t : c; });
  const daily = { ...x.daily };
  Object.entries(y.daily).forEach(([k, d]) => { const c = daily[k]; daily[k] = c ? Object.fromEntries(DAILY_FIELDS.map((f) => [f, f === 'h' ? (c.h | d.h) : Math.max(c[f], d[f])])) : d; });
  const laterRecent = y.recentAt > x.recentAt || (y.recentAt === x.recentAt && y.recent > x.recent);
  return {
    profile: later(x.profile, y.profile), placement: later(x.placement, y.placement), wear: later(x.wear, y.wear),
    topics, daily,
    recent: laterRecent ? y.recent : x.recent, recentAt: Math.max(x.recentAt, y.recentAt),
    coins: maxMap(x.coins, y.coins), spent: maxMap(x.spent, y.spent), freezeBuy: maxMap(x.freezeBuy, y.freezeBuy),
    frozen: { ...x.frozen, ...y.frozen }, claimed: minTs(x.claimed, y.claimed), owned: minTs(x.owned, y.owned),
    seen: maxMap(x.seen, y.seen), best: maxMap(x.best, y.best), boost: Math.max(x.boost, y.boost),
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
    const gem = Math.min(c && c.diamond ? c.diamond : Infinity, l.diamond || Infinity);
    lessons[k] = c ? { at: Math.min(c.at || l.at, l.at || c.at), runs: Math.max(c.runs, l.runs), best: Math.max(c.best, l.best), ...(gem < Infinity ? { diamond: gem } : {}) } : l;
  });
  const units = { ...x.units };
  Object.entries(y.units).forEach(([k, u]) => { const c = units[k] || {}; const ace = Math.max(c.ace || 0, u.ace || 0); units[k] = { tested: Math.max(c.tested || 0, u.tested), ...(ace ? { ace } : {}) }; });
  const types = { ...x.types };
  Object.entries(y.types).forEach(([k, t]) => { const c = types[k] || { n: 0, ok: 0, ms: 0 }; types[k] = { n: Math.max(c.n, t.n), ok: Math.max(c.ok, t.ok), ms: Math.max(c.ms, t.ms) }; });
  const byId = {};
  [...x.mistakes, ...y.mistakes].forEach((m) => { byId[m.id] = Math.max(byId[m.id] || 0, m.at); });
  const hintById = {};
  [...x.hinted, ...y.hinted].forEach((m) => { hintById[m.id] = Math.max(hintById[m.id] || 0, m.at); });
  const laterGoal = y.goalAt > x.goalAt || (y.goalAt === x.goalAt && y.goal > x.goal);
  return normalizeLearn({
    lessons, units, types,
    goal: laterGoal ? y.goal : x.goal, goalAt: Math.max(x.goalAt, y.goalAt),
    xp: maxMap(x.xp, y.xp), done: maxMap(x.done, y.done),
    runs: { started: Math.max(x.runs.started, y.runs.started), finished: Math.max(x.runs.finished, y.runs.finished), abandoned: Math.max(x.runs.abandoned, y.runs.abandoned) },
    quits: maxMap(x.quits, y.quits), quitAt: maxMap(x.quitAt, y.quitAt),
    mistakes: Object.entries(byId).map(([id, at]) => ({ id, at })).sort((p, q) => p.at - q.at || (p.id < q.id ? -1 : 1)),
    hinted: Object.entries(hintById).map(([id, at]) => ({ id, at })).sort((p, q) => p.at - q.at || (p.id < q.id ? -1 : 1)),
    ...mergeProgram(x, y),
  });
}
