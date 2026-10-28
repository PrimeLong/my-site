/* УРОВЕНЬ ЗНАНИЙ — наверху Пути (docs/mechanics.md, «Путь»). Не школьная оценка, не ступени A1…C2 и не
   «условные единицы из 1000», а маленькое целое число, которое растёт от урока к уроку: 1, 5, 12… —
   чтобы рост был событием (жалоба: «убери условные единицы, сделай маленькие числа, чтобы рост был
   событием»). Потолка нет: выйдут новые юниты — будет куда расти.
   Из чего складывается (KNOW): пройденный урок — 1; урок без единой ошибки (лучший результат 100%) —
   ещё 1; урок на алмазном уровне — ещё 1; особый урок дороги (Персоналии, Чтение, Разбор графика) — 1;
   юнит пройден целиком или сдан проверкой — 3. Юнит, сданный проверкой без уроков, засчитывает свои
   уроки как пройденные (по 1).
   Уровень курса (Начальный … Профессиональный) — где ученик сейчас: первый, где на уже вышедших юнитах
   остались непройденные уроки; прогресс уровня — уроки уровня, пройденные из вышедших.
   Модуль чистый: его читают Путь и тесты. */
import { pathState } from './course.js';
import { LEVELS } from '../textbook/levels.js';
import { PEOPLE_BY_UNIT } from './people.js';
import { READING_BY_UNIT } from './reading.js';
import { GRAPH_BY_UNIT } from './graphs.js';
import { emptyLearn } from '../textbook/learn-state.js';

export const KNOW = { lesson: 1, perfect: 1, diamond: 1, extra: 1, unit: 3 };
const EXTRA_IDS = { met: Object.values(PEOPLE_BY_UNIT).map((x) => x.id), read: Object.values(READING_BY_UNIT).map((x) => x.id), graphs: Object.values(GRAPH_BY_UNIT).map((x) => x.id) };

export function courseLevel(learn) {
  const units = pathState(learn);
  const parts = { lessons: 0, perfect: 0, diamond: 0, extras: 0, units: 0 };
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l.id, { done: 0, total: 0 }]));
  units.forEach((st) => {
    const tested = !!((learn.units || {})[st.course.id] || {}).tested;
    st.lessons.forEach((l) => {
      const e = (learn.lessons || {})[l.id] || {};
      const lv = byLevel[st.course.level]; lv.total += 1;
      if (l.done) {
        parts.lessons += 1; lv.done += 1;
        if ((e.best || 0) >= 100) parts.perfect += 1;
        if (l.diamond) parts.diamond += 1;
      } else if (tested) { parts.lessons += 1; lv.done += 1; }
    });
    if (st.complete || tested) parts.units += 1;
  });
  parts.extras = Object.entries(EXTRA_IDS).reduce((a, [key, ids]) => a + ids.filter((id) => ((learn || {})[key] || {})[id]).length, 0);
  const points = parts.lessons * KNOW.lesson + parts.perfect * KNOW.perfect + parts.diamond * KNOW.diamond + parts.extras * KNOW.extra + parts.units * KNOW.unit;
  const all = units.flatMap((s) => s.lessons);
  const done = all.filter((l) => l.done).length;
  // уровень курса, где ученик сейчас: первый, где на вышедших юнитах есть непройденное; всё пройдено — последний с уроками
  const withLessons = LEVELS.filter((l) => byLevel[l.id].total > 0);
  const lv = withLessons.find((l) => byLevel[l.id].done < byLevel[l.id].total) || withLessons[withLessons.length - 1] || LEVELS[0];
  return {
    points, parts, done, total: all.length, share: all.length ? done / all.length : 0, byLevel,
    past: LEVELS.slice(0, LEVELS.indexOf(lv)).map((l) => l.id),
    level: { id: lv.id, title: lv.title, no: LEVELS.indexOf(lv) + 1, done: byLevel[lv.id].done, total: byLevel[lv.id].total },
  };
}

/* Учебник по уровням курса (жалоба: «из Среднего можно читать Продвинутый и Профессиональный»): открыты
   уровни до нынешнего уровня курса включительно, выше — под замком, пока ученик не дойдёт до них на Пути. */
export function openBookLevels(learn) {
  const cur = courseLevel(learn && learn.lessons ? learn : emptyLearn()).level.id;
  return new Set(LEVELS.slice(0, LEVELS.findIndex((l) => l.id === cur) + 1).map((l) => l.id));
}
