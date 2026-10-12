/* ОДНО ПОВТОРЕНИЕ НА ДВОИХ: Путь и учебник.
   У Пути повторение — ошибки уроков (learn.mistakes) и решённое с подсказкой (learn.hinted),
   у учебника — задачи и вопросы разделов со сроком (problems[id].due). Упражнение Пути, сделанное
   из задачи учебника (auto:<задача>) или из её параллельного варианта (var:<вариант>), — та же
   задача. Поэтому:
   - решили её в учебнике (засчитанный ответ: первый раз верно, верно в день повторения или
     последний шаг расписания) — она уходит и из повторения Пути;
   - решили упражнение на Пути без подсказки, а у задачи учебника подошёл срок, — это и есть
     её повторение: расписание учебника идёт дальше, как после верного ответа в учебнике.
   Модуль чистый, его читают тесты. */
import { TEMPLATES } from './variants.js';
import { recordAnswer } from './progress.js';

const TEMPLATE_SOURCE = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.source]));

// задача учебника, из которой сделано упражнение Пути, или null
export function problemOfExercise(id) {
  const s = String(id || '');
  if (s.startsWith('auto:')) return s.slice(5);
  if (s.startsWith('var:')) return TEMPLATE_SOURCE[s.slice(4)] || null;
  return null;
}

// засчитанный ответ в учебнике: задача решена сама и вовремя
const COUNTED = ['clean', 'advance', 'done'];

// после ответа в учебнике (why — из scheduleAfter): из повторения Пути уходят её упражнения
export function afterBookAnswer(p, problemId, ok, why) {
  if (!ok || !COUNTED.includes(why) || !p.learn) return p;
  const mine = (m) => problemOfExercise(m.id) === problemId;
  const { mistakes = [], hinted = [] } = p.learn;
  if (!mistakes.some(mine) && !hinted.some(mine)) return p;
  return { ...p, learn: { ...p.learn, mistakes: mistakes.filter((m) => !mine(m)), hinted: hinted.filter((m) => !mine(m)) } };
}

// после верного ответа на Пути (без подсказки): у задачи учебника подошёл срок — повторение засчитано
export function afterPathAnswer(p, exerciseId, now = Date.now()) {
  const pid = problemOfExercise(exerciseId);
  const rec = pid ? p.problems[pid] : null;
  if (!rec || rec.due == null || rec.due > now) return p;
  return recordAnswer(p, pid, true, now);
}
