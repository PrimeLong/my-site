/* «ДЕРЖИ ИНФЛЯЦИЮ» — мини-игра центробанка (docs/mechanics.md, «Держи инфляцию»).
   Ученик управляет ключевой ставкой. Каждая новость толкает цены — давление на инфляцию
   растёт или падает на несколько пунктов. Инфляция плавно идёт к уровню, который задают
   давление и ставка: цель + давление − (ставка − нейтральная ставка). Раунд засчитан, если за
   шесть секунд инфляция вернулась в коридор цели (3–5%) и держится там — то есть ставка
   сдвинута в нужную сторону и на нужную величину; перестарался — инфляция уйдёт из коридора
   с другой стороны. Зачёт — как у всех игр: верных раундов на восемь больше, чем ошибок. */
export const KEEP = {
  target: 4, band: 1, rate0: 8, neutral: 8, step: 1, minRate: 0, maxRate: 20,
  pull: 0.3, tickMs: 250, windowMs: 6000, holdMs: 750, gapMs: 600, maxPressure: 7,
};
const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
// куда идёт инфляция при нынешних давлении и ставке
export const keepGoal = (st) => KEEP.target + st.pressure - (st.rate - KEEP.neutral);
export const inBand = (x) => Math.abs(x - KEEP.target) <= KEEP.band + 1e-9;
export const keepStart = () => ({ rate: KEEP.rate0, pressure: 0, infl: KEEP.target, news: null, inSince: null, answers: [], history: [KEEP.target] });
// новость: давление меняется, начинается раунд
/* need — что требовала новость в момент выхода: 'up', 'down' или 'hold' (слабая новость: цель
   осталась в коридоре — ставку лучше не трогать, не перестараться — тоже навык). */
export function keepNews(st, item, now) {
  const pressure = clampN(st.pressure + item.effect, -KEEP.maxPressure, KEEP.maxPressure);
  const need = keepHint({ ...st, pressure });
  return { ...st, pressure, inSince: null, news: { key: item.key, effect: item.effect, need, at: now, done: false, ok: null } };
}
// кнопки ставки: шаг 1 п. п., от 0 до 20%
export const keepRate = (st, dir) => ({ ...st, rate: clampN(st.rate + (dir === 'up' ? KEEP.step : -KEEP.step), KEEP.minRate, KEEP.maxRate) });
/* Шаг времени: инфляция подтягивается к своей цели; раунд новости решается — засчитан, когда
   и инфляция, и её цель в коридоре дольше holdMs; не засчитан, если окно в шесть секунд вышло. */
export function keepStep(st, now) {
  const goal = keepGoal(st);
  const infl = st.infl + (goal - st.infl) * KEEP.pull;
  const history = [...st.history, infl].slice(-60);
  let { inSince, news, answers } = st;
  if (news && !news.done) {
    let ok = null;
    if (inBand(infl) && inBand(goal)) { inSince = inSince == null ? now : inSince; if (now - inSince >= KEEP.holdMs) ok = true; } else inSince = null;
    if (ok == null && now - news.at >= KEEP.windowMs) ok = false;
    if (ok != null) { answers = [...answers, ok]; news = { ...news, done: true, ok, doneAt: now }; }
  }
  return { ...st, infl, inSince, news, answers, history };
}
// подсказка для e2e и для разбора: куда двигать ставку сейчас
export const keepHint = (st) => { const g = keepGoal(st); return g > KEEP.target + KEEP.band ? 'up' : g < KEEP.target - KEEP.band ? 'down' : 'hold'; };
// сколько пунктов ставки нужно, чтобы вернуть цель инфляции в центр коридора
export const keepNeed = (st) => Math.round(keepGoal(st) - KEEP.target);
