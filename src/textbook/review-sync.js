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
import { recordAnswer, dismissReview } from './progress.js';

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

// из повторения Пути уходят все упражнения, сделанные из этой задачи учебника
function dropPathCopies(p, problemId) {
  if (!p.learn) return p;
  const mine = (m) => problemOfExercise(m.id) === problemId;
  const { mistakes = [], hinted = [] } = p.learn;
  if (!mistakes.some(mine) && !hinted.some(mine)) return p;
  return { ...p, learn: { ...p.learn, mistakes: mistakes.filter((m) => !mine(m)), hinted: hinted.filter((m) => !mine(m)) } };
}

// после ответа в учебнике (why — из scheduleAfter): из повторения Пути уходят её упражнения
export function afterBookAnswer(p, problemId, ok, why) {
  if (!ok || !COUNTED.includes(why)) return p;
  return dropPathCopies(p, problemId);
}

/* «Убрать из повторения» — одно на двоих: задачу убрали в учебнике — уходят и её упражнения
   на Пути; убрали упражнение на Пути — у задачи учебника снимается срок. id — задача учебника
   или упражнение Пути; упражнение не из учебника уходит только из ошибок Пути. */
export function dropFromReview(p, id, now = Date.now()) {
  const pid = p.problems[id] ? id : problemOfExercise(id);
  let out = p;
  if (out.learn) {
    const { mistakes = [], hinted = [] } = out.learn;
    if (mistakes.some((m) => m.id === id) || hinted.some((m) => m.id === id)) {
      out = { ...out, learn: { ...out.learn, mistakes: mistakes.filter((m) => m.id !== id), hinted: hinted.filter((m) => m.id !== id) } };
    }
  }
  if (!pid) return out;
  return dropPathCopies(dismissReview(out, pid, now), pid);
}

// после верного ответа на Пути (без подсказки): у задачи учебника подошёл срок — повторение засчитано
export function afterPathAnswer(p, exerciseId, now = Date.now()) {
  const pid = problemOfExercise(exerciseId);
  const rec = pid ? p.problems[pid] : null;
  if (!rec || rec.due == null || rec.due > now) return p;
  return recordAnswer(p, pid, true, now);
}
