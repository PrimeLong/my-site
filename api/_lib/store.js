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

export async function getSoloSlots(playerId) {
  if (redis) return (await redis.get(`solo:${playerId}`)) || null;
  return mem.get(`solo:${playerId}`) || null;
}
export async function setSoloSlots(playerId, slots) {
  if (redis) return redis.set(`solo:${playerId}`, slots, { ex: SOLO_TTL });
  mem.set(`solo:${playerId}`, slots);
  return true;
}
