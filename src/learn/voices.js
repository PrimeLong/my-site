/* Голоса героев в «Слушай» и «Истории» (docs/world.md, «Голоса»): у каждого свой темп, высота и,
   если в браузере несколько русских голосов, свой голос — по полу героя, а дальше по кругу.
   Голос синтезирует браузер (Web Speech API); под эфиром — подпись об этом. Записанных живых
   голосов нет; вопросы про живой голос Лады — docs/legal-todo.md. Модуль чистый: список
   голосов передаётся снаружи, так его проверяют тесты. */
export const VOICE_CAPTION = 'голос синтезирован браузером';

// pick — номер голоса среди подходящих по полу; rate и pitch — темп и высота (1 — обычные)
export const HERO_VOICE = {
  host: { female: true, pick: 0, rate: 1.04, pitch: 1.12 },     // Лада — бодрая ведущая эфира
  masha: { female: true, pick: 1, rate: 1.0, pitch: 1.2 },      // Маша — быстрая, звонкая
  vera: { female: true, pick: 2, rate: 0.9, pitch: 0.95 },      // Вера Павловна — размеренно, ниже
  timur: { female: false, pick: 0, rate: 1.06, pitch: 1.05 },   // Тимур — молодой, чуть выше
  grisha: { female: false, pick: 1, rate: 0.88, pitch: 0.85 },  // Гриша — неторопливый, басом
  oleg: { female: false, pick: 2, rate: 0.96, pitch: 0.92 },    // Олег — ровно, по-банковски
  narrator: { female: null, pick: 0, rate: 0.95, pitch: 1.0 },  // Рассказчик — нейтральный
};
const FALLBACK = HERO_VOICE.narrator;

// пол по имени голоса — у браузеров нет поля «пол», а имена говорящие
const MALE = /(yuri|юрий|pavel|павел|dmitr|дмитр|maxim|максим|alexei|алексей|ivan|иван|male|мужск)/i;
const FEMALE = /(milena|милена|irina|ирина|svetlana|светлана|katya|катя|ekaterina|екатерина|anna|анна|alena|алёна|алена|darya|дарья|female|женск)/i;
const genderOf = (v) => (FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : null);

/* Голос героя из списка голосов браузера: { voice, rate, pitch } или null, если русских нет.
   Список упорядочивается по имени — один и тот же герой звучит одинаково от раза к разу. */
export function voiceFor(who, voices = []) {
  const ru = voices.filter((v) => v && /^ru/i.test(v.lang || '')).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!ru.length) return null;
  const p = HERO_VOICE[who] || FALLBACK;
  const want = p.female == null ? null : p.female ? 'f' : 'm';
  const same = want ? ru.filter((v) => genderOf(v) === want) : [];
  const pool = same.length ? same : ru;
  return { voice: pool[p.pick % pool.length], rate: p.rate, pitch: p.pitch };
}
