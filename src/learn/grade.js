/* ОЦЕНКА В КУРСЕ ЭКОНОМИКИ — наверху Пути вместо счётчиков опыта и монет (docs/mechanics.md, «Путь»).
   Две вещи: оценка — как в школе, от 2 до 5 с десятыми, по тому, насколько верно пройдены уроки
   (лучшая точность урока; алмазный урок — 100%), и прогресс — какая часть курса пройдена. Оценка
   не наказывает новичка за то, что пройдено мало: она про качество, а полоска — про путь.
   Модуль чистый: его читают Путь и тесты. */
import { pathState } from './course.js';

// точность → оценка: 95% и выше — 5, 80% — 4, 65% — 3, 50% и ниже — 2; между ними — плавно, с десятыми
export const gradeOf = (acc) => Math.round(Math.max(2, Math.min(5, 2 + (3 * (acc - 50)) / 45)) * 10) / 10;
export const gradeWord = (g) => (g >= 4.5 ? 'отлично' : g >= 3.5 ? 'хорошо' : g >= 2.5 ? 'удовлетворительно' : 'есть над чем поработать');

export function courseGrade(learn) {
  const all = pathState(learn).flatMap((s) => s.lessons);
  const done = all.filter((l) => l.done);
  const accs = done.map((l) => (l.diamond ? 100 : Math.max(0, Math.min(100, ((learn.lessons || {})[l.id] || {}).best || 0))));
  const acc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
  return {
    grade: done.length ? gradeOf(acc) : null,
    accuracy: Math.round(acc),
    done: done.length, total: all.length,
    share: all.length ? done.length / all.length : 0,
    diamonds: done.filter((l) => l.diamond).length,
  };
}
