/* Возраст игрока по году рождения — для детского режима «Мира» и согласия родителя. Модуль
   чистый: его читают клиент (src/account.jsx, src/welcome.jsx), сервер (api/account.js) и тесты.

   Спрашиваем только год, без даты: точный возраст по нему не известен, день рождения в этом
   году мог ещё не наступить. Поэтому считаем младший возможный возраст — так ни один ребёнок
   не окажется «старше», чем он есть. Расплата — в год 16-летия режим остаётся включённым до
   1 января. */
export const KIDS_AGE = 16;   // до этого возраста «Мир» — в детском режиме
export const PARENT_AGE = 14; // до этого возраста при регистрации нужен родитель
export const MIN_AGE = 4;
export const MAX_AGE = 100;

const yearOf = (now) => new Date(now).getUTCFullYear();
export const ageFromYear = (birthYear, now = Date.now()) => yearOf(now) - birthYear - 1;
export const validBirthYear = (y, now = Date.now()) => Number.isInteger(y) && y >= yearOf(now) - MAX_AGE && y <= yearOf(now) - MIN_AGE;
export const isKid = (birthYear, now = Date.now()) => ageFromYear(birthYear, now) < KIDS_AGE;
export const needsParent = (birthYear, now = Date.now()) => ageFromYear(birthYear, now) < PARENT_AGE;

/* Детский режим профиля: до 16 включён всегда; старше — как выбрано в профиле (по умолчанию
   выключен); год не указан (профиль заведён до этого правила) — включён, пока его не укажут. */
export function kidsModeOf(profile, now = Date.now()) {
  if (!profile || !validBirthYear(profile.birthYear, now)) return true;
  if (isKid(profile.birthYear, now)) return true;
  return profile.kidsMode === true;
}
