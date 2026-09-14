/* Serverless-хранилище соло-сохранений: четыре слота на playerId (случайный id,
   который клиент генерирует один раз и держит в localStorage — единственное,
   что остаётся локальным, потому что войти без аккаунта иначе некому).
   Сама партия — экономика, история, декэижны — целиком лежит на сервере,
   как и у сетевых комнат (тот же _lib/store.js). */
import { getSoloSlots, setSoloSlots, hasKv } from './_lib/store.js';

const SLOT_COUNT = 4;
const MAX_NAME_LEN = 40;
const MAX_PLAYER_ID_LEN = 64;
// история/новости обрезаются перед сохранением: полный снимок после многих
// десятилетий игры может весить больше мегабайта (каждая запись истории —
// это весь объект экономики), а для возобновления партии старые кварталы
// не нужны — только последние ~10 лет для графиков
const HISTORY_CAP = 40;
const NEWS_CAP = 40;

const emptySlots = () => Array.from({ length: SLOT_COUNT }, () => null);
/* Слотов стало четыре: у игроков, сохранявшихся раньше, в хранилище лежит массив
   из трёх — дополняем его, а не считаем сохранения битыми. */
const normalizeSlots = (slots) => {
  const out = emptySlots();
  if (Array.isArray(slots)) slots.slice(0, SLOT_COUNT).forEach((s, i) => { out[i] = s || null; });
  return out;
};
const cleanName = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);
  return t.length ? t : null;
};

function summarize(slot) {
  if (!slot) return null;
  const snap = slot.snapshot || {};
  return { savedAt: slot.savedAt, name: slot.name || null,
    role: snap.setup && snap.setup.role, difficulty: snap.setup && snap.setup.difficulty,
    quarterIndex: snap.quarterIndex };
}

function trimSnapshot(snap) {
  const history = Array.isArray(snap.history)
    ? snap.history.slice(-HISTORY_CAP).map((h) => { const { revenueParts: _revenueParts, ...rest } = h; return rest; })
    : [];
  const newsFeed = Array.isArray(snap.newsFeed) ? snap.newsFeed.slice(0, NEWS_CAP) : [];
  return { ...snap, history, newsFeed };
}

const validPlayerId = (id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_PLAYER_ID_LEN;
const validSlotIndex = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n < SLOT_COUNT ? n : null; };
const validSnapshot = (snap) => snap && typeof snap === 'object' && snap.app === 'economic-panel'
  && snap.setup && snap.economy && Array.isArray(snap.history);

async function handleRequest(req, res) {
  if (req.method === 'GET') {
    const { playerId, slot } = req.query;
    if (!validPlayerId(playerId)) return res.status(400).json({ error: 'Некорректный идентификатор' });
    const slots = normalizeSlots(await getSoloSlots(playerId));
    if (slot !== undefined) {
      const idx = validSlotIndex(slot);
      if (idx === null) return res.status(400).json({ error: 'Некорректный слот' });
      const s = slots[idx];
      if (!s) return res.status(404).json({ error: 'Слот пуст' });
      return res.status(200).json({ snapshot: s.snapshot });
    }
    return res.status(200).json({ slots: slots.map(summarize), storage: hasKv() ? 'kv' : 'memory' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только GET и POST' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Некорректное тело запроса' });

  const { action, playerId } = body;
  if (!validPlayerId(playerId)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const idx = validSlotIndex(body.slot);
  if (idx === null) return res.status(400).json({ error: 'Некорректный слот' });
  const slots = normalizeSlots(await getSoloSlots(playerId));

  if (action === 'save') {
    if (!validSnapshot(body.snapshot)) return res.status(400).json({ error: 'Некорректное сохранение' });
    // имя сохранения переживает перезапись: игрок назвал слот «перед выборами» —
    // значит и после дозаписи в него это по-прежнему тот же слот
    const name = cleanName(body.name) || (slots[idx] && slots[idx].name) || null;
    slots[idx] = { savedAt: new Date().toISOString(), name, snapshot: trimSnapshot(body.snapshot) };
    await setSoloSlots(playerId, slots);
    return res.status(200).json({ slots: slots.map(summarize) });
  }
  if (action === 'rename') {
    if (!slots[idx]) return res.status(404).json({ error: 'Слот пуст' });
    slots[idx] = { ...slots[idx], name: cleanName(body.name) };
    await setSoloSlots(playerId, slots);
    return res.status(200).json({ slots: slots.map(summarize) });
  }
  if (action === 'delete') {
    slots[idx] = null;
    await setSoloSlots(playerId, slots);
    return res.status(200).json({ slots: slots.map(summarize) });
  }
  return res.status(400).json({ error: 'Неизвестное действие' });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('solo handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
