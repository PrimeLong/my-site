/* ГОЛОС ИНФЛИ: короткие фразы после ответа и в конце урока (docs/world.md, «Голоса»).
   Тон тёплый, на «вы», 2–8 слов; хвалим за конкретное, после ошибки — поддержка и следующий
   шаг, без «неправильно» и без стыда. Ситуации:
     ok — обычный верный ответ;  streak3 / streak5 / streak10 — серия верных подряд;
     hinted — верно после подсказки;  retry — задача после ошибки наконец решена;
     wrong — ошибка;  wrong2 — вторая ошибка подряд (поддержка);
     perfect / good / mixed — конец урока;  checkFail — проверка юнита не сдана.
   Внутри урока фраза не повторяется: pickPhrase помнит, что уже звучало. */
export const PHRASES = {
  ok: ['Верно. Звенит как надо.', 'Точно в цель.', 'Так и есть.', 'Именно так.', 'Всё сходится.', 'Верно. Идём дальше.',
    'В точку, как монета в копилку.', 'Ровно так и работает.'],
  streak3: ['Три подряд — серия пошла.', 'Три из трёх. Хороший ритм.', 'Третий подряд. Держим темп.'],
  streak5: ['Пять подряд — уже система.', 'Пять верных. Вы разогрелись.'],
  streak10: ['Десять подряд. Это мастерство.', 'Десять из десяти. Снимаю шляпу.'],
  hinted: ['Верно. Подсказка сработала.', 'С подсказкой — тоже честно.', 'Верно. В следующий раз — сами.'],
  retry: ['Вот теперь получилось.', 'Разобрались — и решили.'],
  wrong: ['Не совсем. Посмотрим, где ошибка.', 'Бывает. Разберём.', 'Мимо, но рядом.'],
  wrong2: ['Две подряд — это нормально.', 'Ошибки — часть учёбы. Спокойно.', 'Перечитайте условие — без спешки.'],
  perfect: ['Ни одной ошибки. Монетка гордится.'],
  good: ['Почти всё с первого раза. Хорошая работа.'],
  mixed: ['Ошибки разобраны и вернутся в практике.'],
  checkFail: ['Повторим трудное — и сдадим.'],
};

// какая ситуация после ответа: серия считается вместе с этим ответом
export function situation({ ok, streak = 0, hinted = false, retry = false, wrongRun = 0 }) {
  if (!ok) return wrongRun >= 2 ? 'wrong2' : 'wrong';
  if (retry) return 'retry';
  if (hinted) return 'hinted';
  if (streak === 10) return 'streak10';
  if (streak === 5) return 'streak5';
  if (streak === 3) return 'streak3';
  return 'ok';
}

/* Фраза для ситуации, которой ещё не было в этом уроке (used — Set уже сказанных; функция
   его пополняет). Кончились фразы ситуации — берём из запасной (серия → обычная похвала,
   вторая ошибка → обычная поддержка); кончились и там — повторяем самую давнюю. */
const FALLBACK = { streak3: 'ok', streak5: 'ok', streak10: 'ok', hinted: 'ok', retry: 'ok', wrong2: 'wrong' };
export function pickPhrase(kind, used, rand = Math.random) {
  const pool = (k) => (PHRASES[k] || []).filter((p) => !used.has(p));
  let fresh = pool(kind);
  if (!fresh.length && FALLBACK[kind]) fresh = pool(FALLBACK[kind]);
  const list = fresh.length ? fresh : PHRASES[kind] || PHRASES.ok;
  const phrase = list[Math.floor(rand() * list.length) % list.length];
  used.add(phrase);
  return phrase;
}
// фраза конца урока: без ошибок, почти без ошибок, с ошибками; проверка не сдана
export const endKind = ({ mistakes, accuracy, failedCheck = false }) => (failedCheck ? 'checkFail' : mistakes === 0 ? 'perfect' : accuracy >= 80 ? 'good' : 'mixed');
