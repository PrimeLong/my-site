/* Возвраты для воронки (api/events.js): вернулся ли человек на следующий день после первого
   визита (return_d1) и через неделю (return_d7 — с 7-го по 13-й день). День первого визита и
   отправленные отметки лежат только в браузере; на сервер уходит одно слово события. */
const FIRST_KEY = 'ems-first-day';
const SENT_KEY = 'ems-return-sent';
const dayNo = (t) => Math.floor(t / 86400000);

// чистая часть: какие события пора отправить
export function returnEvents({ first, sent = {} }, now = Date.now()) {
  if (first == null) return [];
  const d = dayNo(now) - first;
  const out = [];
  if (d === 1 && !sent.d1) out.push('return_d1');
  if (d >= 7 && d <= 13 && !sent.d7) out.push('return_d7');
  return out;
}
export function checkReturn(send, now = Date.now()) {
  try {
    let first = Number(localStorage.getItem(FIRST_KEY));
    if (!localStorage.getItem(FIRST_KEY)) { localStorage.setItem(FIRST_KEY, String(dayNo(now))); return []; }
    first = Number.isFinite(first) ? first : dayNo(now);
    const sent = JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
    const evs = returnEvents({ first, sent }, now);
    evs.forEach((e) => { send(e); sent[e === 'return_d1' ? 'd1' : 'd7'] = true; });
    if (evs.length) localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    return evs;
  } catch { return []; }
}
