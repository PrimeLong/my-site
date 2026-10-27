/* УРОВЕНЬ В КУРСЕ ЭКОНОМИКИ — наверху Пути (docs/mechanics.md, «Путь»). Не школьная оценка и не
   ступени — просто число: сколько условных единиц (ед.) курса набрано из 1000. Единицы делятся между
   уровнями курса (Начальный 100, Базовый 200, Средний 250, Продвинутый 250, Профессиональный 200),
   внутри уровня — поровну между его юнитами (и теми, что ещё готовятся: выйдет новый юнит — набранное
   не уменьшится), внутри юнита — поровну между уроками. Текущий уровень курса — первый, где на уже
   вышедших юнитах ещё есть что набрать: уровень не «застревает», пока ждёт будущий юнит. Урок даёт свою долю целиком при точности 100%
   (и в алмазном уроке) и не меньше 70% доли при любой точности: главное — пройти, точность добавляет
   до трети. Юнит, сданный тестом без уроков, — 85%.
   Модуль чистый: его читают Путь и тесты. */
import { pathState } from './course.js';
import { LEVELS, UNIT_LEVEL } from '../textbook/levels.js';

export const SCALE_MAX = 1000;
export const LEVEL_POINTS = { start: 100, basic: 200, middle: 250, advanced: 250, pro: 200 };
// где на шкале курса начинается каждый уровень: 0, 100, 300, 550, 800
export const LEVEL_FROM = LEVELS.reduce((acc, l, k) => ({ ...acc, [l.id]: k ? acc[LEVELS[k - 1].id] + LEVEL_POINTS[LEVELS[k - 1].id] : 0 }), {});
// доля урока: 70% за то, что пройден, и до 30% — за точность
export const lessonQuality = (best, diamond = false) => (diamond ? 1 : 0.7 + 0.3 * Math.max(0, Math.min(100, best || 0)) / 100);
export const TESTED_QUALITY = 0.85;
// сколько единиц весит юнит: доля уровня поровну между всеми его юнитами — и готовыми, и будущими
const unitsInLevel = (level) => Object.values(UNIT_LEVEL).filter((l) => l === level).length;
export const unitPoints = (unitId) => { const lv = UNIT_LEVEL[unitId] || 'pro'; return (LEVEL_POINTS[lv] || 0) / Math.max(1, unitsInLevel(lv)); };

export function courseLevel(learn) {
  const units = pathState(learn);
  let points = 0;
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l.id, 0]));
  units.forEach((st) => {
    const per = unitPoints(st.course.id) / Math.max(1, st.lessons.length);
    const tested = !!((learn.units || {})[st.course.id] || {}).tested;
    st.lessons.forEach((l) => {
      const q = l.done ? lessonQuality(((learn.lessons || {})[l.id] || {}).best, l.diamond) : tested ? TESTED_QUALITY : 0;
      points += per * q; byLevel[st.course.level] = (byLevel[st.course.level] || 0) + per * q;
    });
  });
  points = Math.min(SCALE_MAX, Math.round(points));
  const all = units.flatMap((s) => s.lessons);
  const done = all.filter((l) => l.done).length;
  const got = Object.fromEntries(Object.entries(byLevel).map(([k, v]) => [k, Math.round(v)]));
  // сколько единиц уровня можно набрать сейчас — у юнитов, уже вышедших на Путь
  const open = Object.fromEntries(LEVELS.map((l) => [l.id, 0]));
  units.forEach((st) => { open[st.course.level] += unitPoints(st.course.id); });
  /* уровень курса, где ученик сейчас: первый, где ещё есть что набрать на вышедших юнитах; всё вышедшее
     пройдено — первый, где ждут новые юниты; весь курс — последний. Уровни до него — пройдены (past) */
  const lv = LEVELS.find((l) => got[l.id] < Math.round(open[l.id])) || LEVELS.find((l) => got[l.id] < LEVEL_POINTS[l.id]) || LEVELS[LEVELS.length - 1];
  return {
    points, done, total: all.length, share: all.length ? done / all.length : 0, byLevel: got, past: LEVELS.slice(0, LEVELS.indexOf(lv)).map((l) => l.id),
    level: { id: lv.id, title: lv.title, got: Math.min(got[lv.id], LEVEL_POINTS[lv.id]), max: LEVEL_POINTS[lv.id] },
  };
}
