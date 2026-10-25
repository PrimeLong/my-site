/* УРОВЕНЬ В КУРСЕ ЭКОНОМИКИ — наверху Пути (docs/mechanics.md, «Путь»). Не школьная оценка, а шкала
   владения предметом, как A1…C2 в языках: весь курс — 1000 условных единиц (ед.), и ступень — по тому,
   сколько их набрано. Единицы делятся между уровнями курса (Начальный 100, Базовый 200, Средний 250,
   Продвинутый 250, Профессиональный 200), внутри уровня — поровну между его юнитами (и теми, что ещё
   готовятся: выйдет новый юнит — набранное не уменьшится), внутри юнита — поровну между уроками.
   Урок даёт свою долю целиком при точности 100% (и в алмазном уроке) и не меньше 70% доли при любой
   точности: главное — пройти, точность добавляет до трети. Юнит, сданный тестом без уроков, — 85%.

   Ступени: A1 — с нуля, A2 — Начальный уровень пройден (85 ед.), B1 — Базовый (255), B2 — Средний
   (470), C1 — Продвинутый (680), C2 — Профессиональный (850). Порог — 85% единиц всех уровней до
   него: пройти уровень и не получить его ступень можно, только отвечая почти наугад (точность ниже 50%).
   Модуль чистый: его читают Путь и тесты. */
import { pathState } from './course.js';
import { LEVELS, UNIT_LEVEL } from '../textbook/levels.js';

export const SCALE_MAX = 1000;
export const LEVEL_POINTS = { start: 100, basic: 200, middle: 250, advanced: 250, pro: 200 };
export const BANDS = [
  { id: 'A1', from: 0, title: 'Знакомство', text: 'Первые термины курса: выбор, цена, деньги.' },
  { id: 'A2', from: 85, title: 'Основы', text: 'Начальный уровень: альтернативная стоимость и границы возможностей.' },
  { id: 'B1', from: 255, title: 'Рынок', text: 'Базовый уровень: спрос и предложение, эластичность, деньги, инфляция.' },
  { id: 'B2', from: 470, title: 'Анализ', text: 'Средний уровень: потребитель, издержки, прибыль, конкуренция.' },
  { id: 'C1', from: 680, title: 'Модели', text: 'Продвинутый уровень: модели экономики и статистика.' },
  { id: 'C2', from: 850, title: 'Эксперт', text: 'Профессиональный уровень: полноценный экономический анализ.' },
];
export const bandOf = (points) => BANDS.filter((b) => points >= b.from).pop();
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
  const band = bandOf(points);
  const next = BANDS[BANDS.indexOf(band) + 1] || null;
  return {
    points, band, next, toNext: next ? next.from - points : 0,
    done, total: all.length, share: all.length ? done / all.length : 0,
    byLevel: Object.fromEntries(Object.entries(byLevel).map(([k, v]) => [k, Math.round(v)])),
  };
}
