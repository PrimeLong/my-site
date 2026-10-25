/* Друзья на устройстве: последний ответ сервера (api/account.js, action friends) — в localStorage,
   чтобы список, забег и лента друзей появлялись сразу, а свежие данные подтягивались тихо: при
   открытии, раз в две минуты, пока вкладка видна, и после каждого действия. Без аккаунта друзей нет. */
import { useEffect, useState } from 'react';
import { loadAccount } from '../account.jsx';
import { accountFriends, accountFriendAdd, accountFriendAnswer, accountFriendCancel, accountFriendRemove, accountRaceInvite, accountRaceAnswer, accountCard } from './client.js';

const KEY = 'ems-friends';
const CARD_KEY = 'ems-card-sent';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Array.isArray(v.friends) ? v : null; } catch { return null; } };
let state = read();
let fetchedAt = 0;
const listeners = new Set();
const set = (data) => {
  const a = loadAccount();
  // ответ сервера — для того аккаунта, что вошёл сейчас
  state = data && a && data.me === a.login ? { ...data, at: Date.now() } : null;
  try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch { /* приватный режим */ }
  listeners.forEach((f) => f(state));
};
export const friendsState = () => {
  const a = loadAccount();
  return a && state && state.me === a.login ? state : null;
};

let pending = null;
export async function refreshFriends(force = false) {
  const a = loadAccount();
  if (!a) { if (state) set(null); return null; }
  if (!force && Date.now() - fetchedAt < 30000) return state;
  if (pending) return pending;
  pending = accountFriends(a.token).then((d) => { fetchedAt = Date.now(); set(d); return state; }).catch(() => state).finally(() => { pending = null; });
  return pending;
}
// действие → новый список от сервера; ошибка уходит вызывающему (показать в окне)
const act = async (fn) => {
  const a = loadAccount();
  if (!a) throw new Error('Друзья — для учеников с аккаунтом');
  const d = await fn(a.token);
  fetchedAt = Date.now(); set(d);
  return d;
};
export const friendsApi = {
  add: (login) => act((t) => accountFriendAdd(t, login)),
  answer: (login, accept) => act((t) => accountFriendAnswer(t, login, accept)),
  cancel: (login) => act((t) => accountFriendCancel(t, login)),
  remove: (login) => act((t) => accountFriendRemove(t, login)),
  invite: (login) => act((t) => accountRaceInvite(t, login)),
  answerRace: (id, accept, day, base = 0) => act((t) => accountRaceAnswer(t, id, accept, day, base)),
  refresh: () => refreshFriends(true),
};

export function useFriends() {
  const [data, setData] = useState(friendsState);
  useEffect(() => {
    const f = () => setData(friendsState());
    listeners.add(f);
    refreshFriends();
    const id = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) refreshFriends(); }, 120000);
    const vis = () => { if (!document.hidden) refreshFriends(); };
    document.addEventListener('visibilitychange', vis);
    return () => { listeners.delete(f); clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return data;
}

/* Своя карточка для друзей: отправляется, когда прогресс изменился (не чаще раза в несколько
   секунд — это решает вызывающий), и раз в день, даже если всё то же. */
export function pushCard(card) {
  const a = loadAccount();
  if (!a) return;
  const json = JSON.stringify(card);
  let sent = null; try { sent = localStorage.getItem(CARD_KEY); } catch { /* приватный режим */ }
  // раз в день — даже без перемен: по карточке друзья видят, что вы в сети
  const key = `${a.login}:${new Date().toISOString().slice(0, 10)}:${json}`;
  if (sent === key) return;
  accountCard(a.token, card).then(() => { try { localStorage.setItem(CARD_KEY, key); } catch { /* приватный режим */ } }).catch(() => {});
}
