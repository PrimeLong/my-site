/* Таблица вызова дня. Сама партия идёт у игрока (как соло), сюда приходит только
   итог: балл, пост, дошёл ли до конца. С профилем строка привязана к нему: имя и
   значок берутся из профиля, строка помечена как подтверждённая. Гость по-прежнему
   может записаться под своим playerId и любым именем, но чужое подтверждённое имя
   ему не достанется — к нему припишется «(гость)». У каждого в таблице одна строка:
   лучший результат за день, повторная попытка с меньшим баллом её не затирает.

   Балл считает клиент, и сервер не может его перепроверить, не переиграв всю
   партию, — поэтому здесь только границы правдоподобия (0–100, известный пост,
   день — сегодня или вчера по Москве, чтобы партия, начатая до полуночи, успела
   записаться). Для таблицы друзей этого достаточно. */
import { getDailyBoard, setDailyEntry, hasKv } from './_lib/store.js';
import { userBySession } from './_lib/accounts.js';
import { dailyKey, DAILY_QUARTERS } from '../src/lib/catalog.js';

const MAX_PLAYER_ID_LEN = 64;
const MAX_NAME_LEN = 24;
const TOP = 50;
const ROLE_IDS = new Set(['central_bank', 'ministry_finance', 'president', 'full_control']);
const SCORE_IDS = ['stability', 'welfare', 'financial', 'fiscal', 'potential'];

const validPlayerId = (id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_PLAYER_ID_LEN;
const validDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const cleanName = (v) => {
  if (typeof v !== 'string') return null;
  // управляющие символы выкидываем: имя показывается другим игрокам
  const t = Array.from(v).filter((ch) => ch.charCodeAt(0) >= 32).join('')
    .replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);
  return t.length ? t : null;
};
const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : null);

// дни, в которые ещё принимаются результаты: сегодня и вчера (по Москве)
export function openDays(now = new Date()) {
  return [dailyKey(now), dailyKey(new Date(now.getTime() - 86400000))];
}

export function sanitizeEntry(body) {
  const score = num(body.score, 0, 100);
  if (score === null) return null;
  if (!ROLE_IDS.has(body.role)) return null;
  const scores = {};
  if (body.scores && typeof body.scores === 'object') {
    SCORE_IDS.forEach((k) => { const v = num(body.scores[k], 0, 100); if (v !== null) scores[k] = Math.round(v); });
  }
  return {
    name: cleanName(body.name) || 'Без имени',
    score: Math.round(score * 10) / 10,
    role: body.role,
    quarters: Math.round(num(body.quarters, 0, DAILY_QUARTERS) || 0),
    defeated: !!body.defeated,
    scores,
    at: Date.now(),
  };
}

// строки таблицы по убыванию балла; при равенстве выше тот, кто успел раньше
export function rankBoard(board) {
  return Object.entries(board || {})
    .map(([playerId, e]) => ({ playerId, ...(typeof e === 'string' ? JSON.parse(e) : e) }))
    .filter((e) => Number.isFinite(e.score))
    .sort((a, b) => b.score - a.score || a.at - b.at);
}

// наружу playerId не отдаём — это ключ к чужим сохранениям; своя строка помечается флагом
const publicRow = (e, i, me) => ({ rank: i + 1, name: e.name, score: e.score, role: e.role,
  quarters: e.quarters, defeated: e.defeated, scores: e.scores || {}, you: e.playerId === me,
  verified: !!e.verified, emblem: e.verified ? e.emblem || 'star' : null });

// гость не может подписаться именем, которое в этой таблице уже стоит за профилем
export function guestName(name, board, playerId) {
  const taken = rankBoard(board).some((e) => e.verified && e.playerId !== playerId
    && String(e.name).toLowerCase() === String(name).toLowerCase());
  return taken ? `${name} (гость)`.slice(0, MAX_NAME_LEN + 8) : name;
}

async function handleRequest(req, res) {
  if (req.method === 'GET') {
    const day = validDay(req.query.day) ? req.query.day : dailyKey();
    const me = validPlayerId(req.query.playerId) ? req.query.playerId : null;
    const ranked = rankBoard(await getDailyBoard(day));
    const rows = ranked.slice(0, TOP).map((e, i) => publicRow(e, i, me));
    const myIdx = me ? ranked.findIndex((e) => e.playerId === me) : -1;
    return res.status(200).json({ day, total: ranked.length, rows,
      you: myIdx >= 0 ? publicRow(ranked[myIdx], myIdx, me) : null, storage: hasKv() ? 'kv' : 'memory' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только GET и POST' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Некорректное тело запроса' });
  const { day } = body;
  const user = body.session ? await userBySession(body.session) : null;
  // с профилем строка — за профилем, а не за устройством
  const playerId = user ? user.playerId : body.playerId;
  if (!validPlayerId(playerId)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  if (!validDay(day) || !openDays().includes(day)) return res.status(400).json({ error: 'Приём результатов за этот день закрыт' });
  const entry = sanitizeEntry(body);
  if (!entry) return res.status(400).json({ error: 'Некорректный результат' });

  const board = await getDailyBoard(day);
  if (user) Object.assign(entry, { name: user.name, verified: true, emblem: user.emblem || 'star' });
  else entry.name = guestName(entry.name, board, playerId);
  const prevRaw = board[playerId];
  const prev = prevRaw ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) : null;
  // худший повтор не затирает лучший результат, но новое имя применяется всегда
  const next = prev && prev.score >= entry.score
    ? { ...prev, name: entry.name, verified: entry.verified || false, emblem: entry.emblem } : entry;
  await setDailyEntry(day, playerId, next);
  const ranked = rankBoard({ ...board, [playerId]: next });
  const myIdx = ranked.findIndex((e) => e.playerId === playerId);
  return res.status(200).json({ day, total: ranked.length, improved: next === entry,
    rows: ranked.slice(0, TOP).map((e, i) => publicRow(e, i, playerId)),
    you: publicRow(ranked[myIdx], myIdx, playerId) });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('daily handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
