/* Хранилище комнат. Vercel KV как отдельный продукт больше не существует — в декабре 2024
   он был свёрнут в Upstash, и подключается через Vercel Marketplace. Официальный клиент
   теперь @upstash/redis, а не @vercel/kv (тот считается устаревшим). Переменные окружения
   остаются теми же — KV_REST_API_URL и KV_REST_API_TOKEN, — их подставляет сама интеграция.
   Память оставлена как запасной вариант для локальной разработки: в serverless она НЕ общая
   между вызовами, играть на ней нельзя. */
let redis = null;
try {
  const { Redis } = await import('@upstash/redis');
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) redis = Redis.fromEnv();
} catch { redis = null; }

const mem = new Map();
const TTL = 60 * 60 * 24 * 3;   // комната живёт трое суток
const SOLO_TTL = 60 * 60 * 24 * 180;   // соло-сохранение — не сессия, живёт полгода

export const hasKv = () => !!redis;
export async function getRoom(id) {
  if (redis) return (await redis.get(`room:${id}`)) || null;
  return mem.get(`room:${id}`) || null;
}
export async function setRoom(id, room) {
  if (redis) return redis.set(`room:${id}`, room, { ex: TTL });
  mem.set(`room:${id}`, room);
  return true;
}
export async function withRoom(id, fn) {
  const room = await getRoom(id);
  if (!room) return { error: 'Комната не найдена', status: 404 };
  const next = await fn(room);
  if (next && next.error) return next;
  await setRoom(id, next || room);
  return { room: next || room };
}

/* Индекс общедоступных комнат — отдельный от самих комнат: TTL комнаты не
   удаляет её id из индекса, поэтому listPublicRoomIds всегда подчищает
   протухшие записи сама, при каждом обращении (self-healing, без крон-задач). */
const PUBLIC_ROOMS_KEY = 'public_rooms';
export async function addPublicRoom(id) {
  if (redis) return redis.sadd(PUBLIC_ROOMS_KEY, id);
  if (!mem.has(PUBLIC_ROOMS_KEY)) mem.set(PUBLIC_ROOMS_KEY, new Set());
  mem.get(PUBLIC_ROOMS_KEY).add(id);
  return true;
}
export async function removePublicRoom(id) {
  if (redis) return redis.srem(PUBLIC_ROOMS_KEY, id);
  if (mem.has(PUBLIC_ROOMS_KEY)) mem.get(PUBLIC_ROOMS_KEY).delete(id);
  return true;
}
export async function listPublicRoomIds() {
  const ids = redis ? await redis.smembers(PUBLIC_ROOMS_KEY)
    : (mem.has(PUBLIC_ROOMS_KEY) ? [...mem.get(PUBLIC_ROOMS_KEY)] : []);
  return ids || [];
}

/* Код связывания устройств живёт десять минут и одноразовый: он не даёт доступа
   сам по себе — он ОБМЕНИВАЕТСЯ на идентификатор профиля, после чего исчезает.
   TTL держим и внутри значения тоже: в памяти (локальная разработка) redis-ного
   ex нет, а протухший код не должен работать вечно. */
const LINK_TTL = 60 * 10;
export async function getLink(code) {
  const raw = redis ? await redis.get(`link:${code}`) : mem.get(`link:${code}`);
  if (!raw) return null;
  if (raw.expiresAt && Date.now() > raw.expiresAt) { await delLink(code); return null; }
  return raw;
}
export async function setLink(code, data, ttlSeconds = LINK_TTL) {
  const value = { ...data, expiresAt: Date.now() + ttlSeconds * 1000 };
  if (redis) await redis.set(`link:${code}`, value, { ex: ttlSeconds });
  else mem.set(`link:${code}`, value);
  return value;
}
export async function delLink(code) {
  if (redis) return redis.del(`link:${code}`);
  mem.delete(`link:${code}`);
  return true;
}

/* Профиль игрока — достижения, пройденные роли и курсы. Всё это раньше жило
   только в localStorage и, значит, только на одном устройстве; связывание без
   него переносило бы партии, но не то, что игрок уже успел открыть. */
export async function getProfile(playerId) {
  if (redis) return (await redis.get(`profile:${playerId}`)) || null;
  return mem.get(`profile:${playerId}`) || null;
}
export async function setProfile(playerId, profile) {
  if (redis) return redis.set(`profile:${playerId}`, profile, { ex: SOLO_TTL });
  mem.set(`profile:${playerId}`, profile);
  return true;
}

export async function getSoloSlots(playerId) {
  if (redis) return (await redis.get(`solo:${playerId}`)) || null;
  return mem.get(`solo:${playerId}`) || null;
}
export async function setSoloSlots(playerId, slots) {
  if (redis) return redis.set(`solo:${playerId}`, slots, { ex: SOLO_TTL });
  mem.set(`solo:${playerId}`, slots);
  return true;
}

/* Таблица вызова дня: хэш daily:<день>, поле — playerId, значение — лучший результат
   игрока за этот день. Живёт месяц: вчерашнюю таблицу ещё смотрят, прошлогоднюю — нет. */
const DAILY_TTL = 60 * 60 * 24 * 31;
export async function getDailyBoard(day) {
  if (redis) return (await redis.hgetall(`daily:${day}`)) || {};
  return { ...mem.get(`daily:${day}`) };
}
export async function setDailyEntry(day, playerId, entry) {
  if (redis) {
    await redis.hset(`daily:${day}`, { [playerId]: entry });
    await redis.expire(`daily:${day}`, DAILY_TTL);
    return true;
  }
  mem.set(`daily:${day}`, { ...mem.get(`daily:${day}`), [playerId]: entry });
  return true;
}

// «Своё дело» (тайкун предпринимателя): свои слоты сохранений рядом с обычными
export async function getTycoonSlots(playerId) {
  if (redis) return (await redis.get(`tycoon:${playerId}`)) || null;
  return mem.get(`tycoon:${playerId}`) || null;
}
export async function setTycoonSlots(playerId, slots) {
  if (redis) return redis.set(`tycoon:${playerId}`, slots, { ex: SOLO_TTL });
  mem.set(`tycoon:${playerId}`, slots);
  return true;
}
