/* ПЕРСОНАЛЬНАЯ ПРОГРАММА: уровень сложности, слабые темы и «рекомендуем сейчас».
   Уровень — по последним тридцати первым попыткам: точность выше 90% (для олимпиадников —
   выше 85%) — «hard», ниже 60% — «easy» (см. buildLesson в course.js). Слабая тема — пройденный
   урок, где недавняя точность ниже 70%: его упражнения первыми идут в «Повторение» и добирают
   практику. Модуль чистый: экраны — src/learn.jsx. */
import { LESSON_BY_ID, UNIT_BY_ID, pathState } from './course.js';
import { CHAPTER_SECTIONS } from '../textbook/content.js';
import { sectionDone } from '../textbook/study-core.js';
import { lessonDone } from '../textbook/learn-state.js';

export const LEVEL_MIN = 10;
export function skillLevel(s) {
  const r = s.recent || '';
  if (r.length < LEVEL_MIN) return 'normal';
  const acc = [...r].filter((c) => c === '1').length / r.length;
  const hard = (s.profile || {}).goal === 'olymp' ? 0.85 : 0.9;
  if (acc > hard) return 'hard';
  if (acc < 0.6) return 'easy';
  return 'normal';
}
export const LEVEL_TEXT = {
  easy: 'Сейчас задания проще, а разбор ошибок — по шагам. Станет точнее — вернутся обычные.',
  normal: 'Обычный уровень. Больше 90% верных — появятся задачи семинаров и олимпиад.',
  hard: 'Вы отвечаете почти без ошибок — в практике есть задачи семинаров и олимпиад.',
};
export const LEVEL_NAME = { easy: 'по шагам', normal: 'обычный', hard: 'повышенный' };

// точность по урокам, где попыток не меньше четырёх
export const TOPIC_MIN = 4;
export function weakLessons(s, below = 0.7) {
  return Object.entries(s.topics || {})
    .filter(([id, t]) => t.n >= TOPIC_MIN && LESSON_BY_ID[id] && s.lessons[id] && t.ok / t.n < below)
    .map(([id, t]) => ({ id, acc: t.ok / t.n, title: LESSON_BY_ID[id].title }))
    .sort((a, b) => a.acc - b.acc || (a.id < b.id ? -1 : 1));
}

/* «Рекомендуем сейчас» — одна остановка на Пути: урок с самой слабой точностью (ниже 60%),
   если он открыт; иначе — следующая остановка. why: 'weak' или 'next'. */
export function recommend(s, states = pathState(s)) {
  const cur = (states.find((x) => x.current) || {}).current || null;
  const open = new Set(states.flatMap((st) => st.lessons.filter((l) => l.open).map((l) => l.id)));
  const weak = weakLessons(s, 0.6).find((w) => open.has(w.id));
  if (weak) return { lessonId: weak.id, why: 'weak', acc: weak.acc };
  if (cur) return { lessonId: cur.id, why: 'next' };
  return null;
}

// то, что наградам нужно знать о курсе: пройдено уроков и юнитов, сколько видов уроков
export function courseCtx(s, states = pathState(s)) {
  const done = states.flatMap((st) => st.lessons.filter((l) => l.done));
  return {
    lessonsDone: done.length,
    unitsDone: states.filter((st) => st.complete).length,
    kinds: new Set(done.map((l) => LESSON_BY_ID[l.id].kind)).size,
  };
}
// параметры сборки урока из состояния ученика
export const lessonOpts = (s) => ({
  mistakes: s.mistakes.map((m) => m.id), hinted: (s.hinted || []).map((m) => m.id),
  level: skillLevel(s), weak: weakLessons(s).map((w) => w.id), seen: s.seen || {},
});

/* Напоминание о теории перед уроком. Уроку нужна теория раздела учебника, а ученик её ещё
   не видел: ни в учебнике (глава отмечена прочитанной или раздел пройден вопросом в конце),
   ни в уроке «Знакомство» по тому же разделу. known — разделы, про которые ученик сказал
   «теория уже была в уроке»: про них больше не спрашиваем. Уроки «Знакомство» сами дают
   теорию — для них напоминания нет. */
export function theoryNotice(lesson, learn, progress = null, known = []) {
  if (!lesson || lesson.kind === 'intro' || !lesson.section) return null;
  const sec = (CHAPTER_SECTIONS[lesson.unitId] || []).find((x) => x.id === lesson.section);
  if (!sec || known.includes(sec.id)) return null;
  if (progress && ((progress.read || {})[lesson.unitId] || sectionDone(progress, sec))) return null;
  const unit = UNIT_BY_ID[lesson.unitId];
  if (unit && unit.lessons.some((o) => o.kind === 'intro' && o.section === lesson.section && lessonDone(learn, o.id))) return null;
  return { chapter: lesson.unitId, section: { id: sec.id, title: sec.title, minutes: sec.minutes } };
}
