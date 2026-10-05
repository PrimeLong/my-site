/* ГОСТЕВОЙ СТАРТ: «Начать» → цель → сразу первый урок, без аккаунта. Прогресс гостя живёт
   в браузере (localStorage) под playerId устройства — тем же, что потом заберёт аккаунт при
   регистрации (api/account.js: профиль получает playerId устройства), поэтому переносить
   ничего не нужно. Здесь — только отметка «гость» и события, которыми экраны сообщают друг
   другу о старте гостя и о просьбе сохранить прогресс. */
const GUEST_KEY = 'ems-guest';
export const GUEST_START = 'ems-guest-start';
export const GUEST_SAVE = 'ems-guest-save';

export const isGuest = () => { try { return !!localStorage.getItem(GUEST_KEY); } catch { return false; } };
export function startGuest(now = Date.now()) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify({ at: now })); } catch { /* приватный режим: гость на одну вкладку */ }
  window.dispatchEvent(new Event(GUEST_START));
}
export const endGuest = () => { try { localStorage.removeItem(GUEST_KEY); } catch { /* приватный режим */ } };
// «Сохраните прогресс»: открыть регистрацию поверх приложения
export const askSave = () => window.dispatchEvent(new Event(GUEST_SAVE));
