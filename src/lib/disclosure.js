/* Прогрессивное раскрытие в «Мире» (docs/mechanics.md, «Первый экран партии»): компас ставки,
   правило Тейлора, ссылки на IS-LM и риски не загружают первый экран новичка. Они открываются
   с 4-го квартала партии или сразу, если на Пути уже достигнут уровень «Средний».

   Уровень Пути пишет вкладка «Путь» (src/learn.jsx) — в «Мир» тяжёлый модуль курса не тянем. */
export const ADVANCED_QUARTER = 4;
export const ADVANCED_LEVEL = 2; // индекс «Средний» в LEVELS (src/learn/course.js)
export const LEVEL_KEY = 'ems-learn-level';

export function readLearnLevel() {
  try { const v = Number(localStorage.getItem(LEVEL_KEY)); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
// хранится самый высокий достигнутый уровень: повтор пройденного юнита его не снижает
export function writeLearnLevel(level) {
  try { localStorage.setItem(LEVEL_KEY, String(Math.max(level, readLearnLevel()))); } catch { /* приватный режим */ }
}
export const advancedOpen = ({ quarterIndex = 1, level = 0 } = {}) => quarterIndex >= ADVANCED_QUARTER || level >= ADVANCED_LEVEL;
// показатели и вкладки, которые до раскрытия спрятаны
export const ADVANCED_TABS = ['risks'];
export const ADVANCED_ROWS = ['taylorRate'];
export const ADVANCED_CHAPTERS = ['is-lm'];
