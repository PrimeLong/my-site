/* Хранилище комнат. На Vercel используйте KV (Upstash Redis) — он переживает холодный старт
   и работает между инстансами. Память оставлена как запасной вариант для локальной разработки:
   в serverless она НЕ общая между вызовами, играть на ней нельзя. */
let kv = null;
try { ({ kv } = await import('@vercel/kv')); } catch (e) { kv = null; }

const mem = new Map();
const TTL = 60 * 60 * 24 * 3;   // комната живёт трое суток

export const hasKv = () => !!kv;
export async function getRoom(id) {
  if (kv) return (await kv.get(`room:${id}`)) || null;
  return mem.get(id) || null;
}
export async function setRoom(id, room) {
  if (kv) return kv.set(`room:${id}`, room, { ex: TTL });
  mem.set(id, room);
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
