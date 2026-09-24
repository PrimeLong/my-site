/* Таблица рекордов «Своего дела»: лучшая стоимость компании каждого профиля.
   Записаться можно только из профиля — имя и значок берутся из него, так что
   чужим именем в таблицу не встать. Стоимость считает клиент (игра идёт у игрока),
   поэтому сервер проверяет только границы правдоподобия, как и таблица дня. */
import { getRecords, setRecord, hasKv } from './_lib/store.js';
import { userBySession } from './_lib/accounts.js';

const KINDS = new Set(['tycoon']);
const TOP = 50;
const MAX_VALUE = 1e7; // млн — десять триллионов; дальше уже явная подделка
const START_IDS = new Set(['farm', 'retail', 'factory']);

export function rankRecords(board) {
  return Object.entries(board || {})
    .map(([login, e]) => ({ login, ...(typeof e === 'string' ? JSON.parse(e) : e) }))
    .filter((e) => Number.isFinite(e.value))
    .sort((a, b) => b.value - a.value || a.at - b.at);
}
const publicRow = (e, i, me) => ({ rank: i + 1, name: e.name, emblem: e.emblem || 'star', login: e.login,
  value: e.value, start: e.start || null, quarters: e.quarters || 0, legacy: e.legacy || 0, you: e.login === me });

async function handleRequest(req, res) {
  const kind = String((req.method === 'GET' ? req.query.kind : (req.body || {}).kind) || 'tycoon');
  if (!KINDS.has(kind)) return res.status(400).json({ error: 'Нет такой таблицы' });
  if (req.method === 'GET') {
    const me = typeof req.query.login === 'string' ? req.query.login : null;
    const ranked = rankRecords(await getRecords(kind));
    const myIdx = me ? ranked.findIndex((e) => e.login === me) : -1;
    return res.status(200).json({ kind, total: ranked.length, rows: ranked.slice(0, TOP).map((e, i) => publicRow(e, i, me)),
      you: myIdx >= 0 ? publicRow(ranked[myIdx], myIdx, me) : null, storage: hasKv() ? 'kv' : 'memory' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только GET и POST' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  const user = await userBySession(body.session);
  if (!user) return res.status(401).json({ error: 'В таблицу рекордов записывают из профиля' });
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_VALUE) return res.status(400).json({ error: 'Некорректный результат' });
  const board = await getRecords(kind);
  const prevRaw = board[user.login];
  const prev = prevRaw ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) : null;
  const entry = { name: user.name, emblem: user.emblem || 'star', value: Math.round(value * 10) / 10,
    start: START_IDS.has(body.start) ? body.start : null,
    quarters: Math.max(0, Math.min(10000, Math.round(Number(body.quarters) || 0))),
    legacy: Math.max(0, Math.min(1000, Math.round(Number(body.legacy) || 0))), at: Date.now() };
  // хуже прежнего — рекорд остаётся, но имя и значок обновляются
  const next = prev && prev.value >= entry.value ? { ...prev, name: entry.name, emblem: entry.emblem } : entry;
  await setRecord(kind, user.login, next);
  const ranked = rankRecords({ ...board, [user.login]: next });
  const myIdx = ranked.findIndex((e) => e.login === user.login);
  return res.status(200).json({ kind, total: ranked.length, improved: next === entry,
    rows: ranked.slice(0, TOP).map((e, i) => publicRow(e, i, user.login)), you: publicRow(ranked[myIdx], myIdx, user.login) });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('records handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
