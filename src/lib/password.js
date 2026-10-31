/* Длина пароля (docs/mechanics.md, «Регистрация и вход») — одно число на клиент (src/account.jsx, src/welcome.jsx) и
   сервер (api/account.js). Новый пароль — не короче PASSWORD_MIN; для входа подходят и старые, с прежним
   минимумом 6 символов: правило не запирает тех, кто зарегистрировался раньше. */
export const PASSWORD_MIN = 8;
export const LOGIN_PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;
export const newPasswordOk = (p) => typeof p === 'string' && p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
export const PASSWORD_HINT = `не короче ${PASSWORD_MIN} символов`;
