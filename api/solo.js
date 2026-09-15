/* Serverless-хранилище соло-сохранений: четыре слота на playerId (случайный id,
   который клиент генерирует один раз и держит в localStorage — единственное,
   что остаётся локальным, потому что войти без аккаунта иначе некому).
   Сама партия — экономика, история, декэижны — целиком лежит на сервере,
   как и у сетевых комнат (тот же _lib/store.js). */
import { getSoloSlots, setSoloSlots, getProfile, setProfile, getLink, setLink, delLink, hasKv } from './_lib/store.js';
import { randomInt, randomUUID } from 'node:crypto';

const SLOT_COUNT = 4;
const MAX_NAME_LEN = 40;
const MAX_PLAYER_ID_LEN = 64;
// история/новости обрезаются перед сохранением: полный снимок после многих
// десятилетий игры может весить больше мегабайта (каждая запись истории —
// это весь объект экономики), а для возобновления партии старые кварталы
// не нужны — только последние ~10 лет для графиков
const HISTORY_CAP = 40;
const NEWS_CAP = 40;

const PROFILE_ACTIONS = new Set(['progress', 'link_create', 'link_status', 'link_claim', 'link_cancel', 'link_revoke']);
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

/* ================== СВЯЗЫВАНИЕ УСТРОЙСТВ И ОБЩИЙ ПРОГРЕСС ==================
   Аккаунтов в игре нет, и заводить их ради «телефон плюс компьютер» — слишком
   большая цена. Вместо этого одно устройство показывает короткий код, второе его
   вводит и получает тот же playerId: дальше оба адресуют одни и те же слоты на
   сервере. Код одноразовый, живёт десять минут и сам по себе ничего не открывает —
   он обменивается на идентификатор и тут же исчезает.

   Алфавит без похожих друг на друга знаков (0/O, 1/I/L): код диктуют голосом и
   набирают с телефона, и «ноль или буква О» — это лишняя попытка. */
const LINK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LINK_LEN = 8;
const makeLinkCode = () => Array.from({ length: LINK_LEN },
  () => LINK_ALPHABET[randomInt(LINK_ALPHABET.length)]).join('');
const cleanCode = (v) => (typeof v === 'string'
  ? v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LINK_LEN) : '');

/* Слияние прогресса — только объединение: достижение, открытое на телефоне, не
   должно пропасть из-за того, что на компьютере его нет. Никаких «кто последний,
   тот и прав»: всё, что здесь хранится, монотонно — открыто, пройдено, сыграно. */
const MAX_KEYS = 300;
const cleanMap = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  Object.keys(v).slice(0, MAX_KEYS).forEach((k) => {
    if (typeof k === 'string' && k.length <= 64) out[k] = v[k];
  });
  return out;
};
const cleanIdList = (v) => (Array.isArray(v)
  ? v.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, 64) : []);

function normalizeProgress(p) {
  const src = p && typeof p === 'object' ? p : {};
  const achievements = {};
  Object.entries(cleanMap(src.achievements)).forEach(([id, at]) => {
    achievements[id] = Number.isFinite(at) ? at : Date.now();
  });
  const modules = {};
  Object.entries(cleanMap(src.modules)).forEach(([id, st]) => {
    if (!st || typeof st !== 'object') return;
    modules[id] = {
      step: Number.isFinite(st.step) ? Math.max(0, Math.min(999, Math.round(st.step))) : 0,
      at: Number.isFinite(st.at) ? Math.max(0, Math.min(999, Math.round(st.at))) : 0,
      passed: cleanMap(st.passed),
    };
  });
  return {
    achievements,
    roles: cleanIdList(src.roles),
    network: !!src.network,
    courses: cleanMap(src.courses),
    modules,
    // когда профиль стал общим: по этой отметке ОБА устройства понимают, что связка
    // есть, и могут её разорвать — раньше кнопка была только у того, кто вводил код
    linkedAt: Number.isFinite(src.linkedAt) ? src.linkedAt : null,
  };
}

function mergeProgress(a, b) {
  const x = normalizeProgress(a);
  const y = normalizeProgress(b);
  const achievements = { ...x.achievements };
  Object.entries(y.achievements).forEach(([id, at]) => {
    // дата открытия — более ранняя из двух: достижение открыто тогда, когда оно
    // впервые открыто, а не тогда, когда о нём узнало второе устройство
    achievements[id] = Math.min(achievements[id] ?? at, at);
  });
  const modules = { ...x.modules };
  Object.entries(y.modules).forEach(([id, st]) => {
    const cur = modules[id];
    modules[id] = cur ? { step: Math.max(cur.step, st.step), at: Math.max(cur.at, st.at),
      passed: { ...cur.passed, ...st.passed } } : st;
  });
  return {
    achievements,
    roles: Array.from(new Set([...x.roles, ...y.roles])).slice(0, 64),
    network: x.network || y.network,
    courses: { ...x.courses, ...y.courses },
    modules,
    linkedAt: Math.max(x.linkedAt || 0, y.linkedAt || 0) || null,
    updatedAt: Date.now(),
  };
}

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
  if (PROFILE_ACTIONS.has(action)) return handleProfileAction(body, res);
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

/* Действия связывания и прогресса вынесены отдельно: им не нужен номер слота,
   который handleRequest требует у всех остальных. */
async function handleProfileAction(body, res) {
  const { action, playerId } = body;
  if (!validPlayerId(playerId)) return res.status(400).json({ error: 'Некорректный идентификатор' });

  if (action === 'progress') {
    const merged = mergeProgress(await getProfile(playerId), body.progress);
    await setProfile(playerId, merged);
    return res.status(200).json({ profile: merged, storage: hasKv() ? 'kv' : 'memory' });
  }

  if (action === 'link_create') {
    // прогресс этого устройства кладём в профиль сразу: второе устройство должно
    // увидеть уже собранную коллекцию, а не то, что было при прошлой синхронизации
    if (body.progress) await setProfile(playerId, mergeProgress(await getProfile(playerId), body.progress));
    const code = makeLinkCode();
    const link = await setLink(code, { playerId, claimed: false });
    return res.status(200).json({ code, expiresAt: link.expiresAt, storage: hasKv() ? 'kv' : 'memory' });
  }

  if (action === 'link_status') {
    const code = cleanCode(body.code);
    const link = code ? await getLink(code) : null;
    // код исчезает сразу после обмена — «его больше нет» значит «уже сработал»
    if (!link) return res.status(200).json({ claimed: false, expired: true });
    if (link.playerId !== playerId) return res.status(403).json({ error: 'Код принадлежит другому устройству' });
    return res.status(200).json({ claimed: !!link.claimed, expiresAt: link.expiresAt });
  }

  if (action === 'link_claim') {
    const code = cleanCode(body.code);
    if (code.length !== LINK_LEN) return res.status(400).json({ error: 'Код состоит из восьми знаков' });
    const link = await getLink(code);
    if (!link) return res.status(404).json({ error: 'Код не найден или устарел — попросите показать новый' });
    if (link.claimed) return res.status(409).json({ error: 'Этот код уже использован' });
    if (link.playerId === playerId) return res.status(400).json({ error: 'Это то же самое устройство' });
    // прогресс входящего устройства вливается в профиль: связывание не должно
    // стоить игроку достижений, открытых на телефоне
    const merged = { ...mergeProgress(await getProfile(link.playerId), body.progress), linkedAt: Date.now() };
    await setProfile(link.playerId, merged);
    // код помечаем использованным и держим ещё минуту, чтобы первое устройство
    // успело показать «готово», а не решить, что код просто протух
    await setLink(code, { playerId: link.playerId, claimed: true }, 60);
    const slots = normalizeSlots(await getSoloSlots(link.playerId));
    return res.status(200).json({ playerId: link.playerId, profile: merged,
      slots: slots.map(summarize), storage: hasKv() ? 'kv' : 'memory' });
  }

  if (action === 'link_revoke') {
    /* Разорвать связку можно с ЛЮБОГО устройства, а не только с того, которое
       вводило код. Данные при этом не пропадают ни у кого: устройство, нажавшее
       кнопку, забирает копию профиля и сохранений на новый идентификатор, а
       прежний остаётся второму устройству как есть. Дальше они живут отдельно. */
    const profile = await getProfile(playerId);
    const slots = normalizeSlots(await getSoloSlots(playerId));
    const fresh = randomUUID();
    await setProfile(fresh, { ...mergeProgress(profile, body.progress), linkedAt: null });
    await setSoloSlots(fresh, slots);
    return res.status(200).json({ playerId: fresh, profile: await getProfile(fresh),
      slots: slots.map(summarize), storage: hasKv() ? 'kv' : 'memory' });
  }
  if (action === 'link_cancel') {
    const code = cleanCode(body.code);
    const link = code ? await getLink(code) : null;
    if (link && link.playerId === playerId && !link.claimed) await delLink(code);
    return res.status(200).json({ ok: true });
  }
  return null;
}

// нормализация и слияние выставлены наружу ради тестов: «объединяем, никогда не
// теряем» — это то свойство, ломать которое нельзя молча
export { normalizeProgress, mergeProgress };

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('solo handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
