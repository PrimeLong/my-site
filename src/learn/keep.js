/* «ДЕРЖИ ИНФЛЯЦИЮ» — мини-игра центробанка (docs/mechanics.md, «Держи инфляцию»).
   Ученик управляет ключевой ставкой. Каждая новость толкает цены — давление на инфляцию
   растёт или падает на несколько пунктов. Инфляция плавно идёт к уровню, который задают
   давление и ставка: цель + давление − (ставка − нейтральная ставка). Раунд засчитан, если за
   шесть секунд уровень инфляции вернулся в коридор цели (3–5%), а сама она устоялась около него — то есть ставка
   сдвинута в нужную сторону и на нужную величину; перестарался — инфляция уйдёт из коридора
   с другой стороны. Зачёт — как у всех игр: верных раундов на восемь больше, чем ошибок. */
export const KEEP = {
  target: 4, band: 1, rate0: 8, neutral: 8, step: 1, minRate: 0, maxRate: 20,
  pull: 0.3, tickMs: 250, windowMs: 6000, holdMs: 750, gapMs: 600, maxPressure: 7, slack: 0.3,
};
const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
// куда идёт инфляция при нынешних давлении и ставке
export const keepGoal = (st) => KEEP.target + st.pressure - (st.rate - KEEP.neutral);
export const inBand = (x, slack = 0) => Math.abs(x - KEEP.target) <= KEEP.band + slack + 1e-9;
/* инфляция устоялась: её уровень — в коридоре, и она подошла к нему ближе slack. Иначе при уровне
   ровно на краю (3 или 5%) инфляция, подходя к нему плавно, никогда не «вошла» бы в коридор */
export const keepSettled = (st, infl = st.infl) => inBand(keepGoal(st)) && Math.abs(infl - keepGoal(st)) <= KEEP.slack + 1e-9;
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
/* Шаг времени: инфляция подтягивается к своему уровню; раунд новости решается — засчитан, когда
   уровень в коридоре и инфляция устоялась около него дольше holdMs; не засчитан, если окно в шесть секунд вышло. */
export function keepStep(st, now) {
  const goal = keepGoal(st);
  const infl = st.infl + (goal - st.infl) * KEEP.pull;
  const history = [...st.history, infl].slice(-60);
  let { inSince, news, answers } = st;
  if (news && !news.done) {
    let ok = null;
    if (keepSettled(st, infl)) { inSince = inSince == null ? now : inSince; if (now - inSince >= KEEP.holdMs) ok = true; } else inSince = null;
    if (ok == null && now - news.at >= KEEP.windowMs) ok = false;
    if (ok != null) { answers = [...answers, ok]; news = { ...news, done: true, ok, doneAt: now }; }
  }
  return { ...st, infl, inSince, news, answers, history };
}
// подсказка для e2e и для разбора: куда двигать ставку сейчас
export const keepHint = (st) => { const g = keepGoal(st); return g > KEEP.target + KEEP.band ? 'up' : g < KEEP.target - KEEP.band ? 'down' : 'hold'; };
// сколько пунктов ставки нужно, чтобы вернуть цель инфляции в центр коридора
export const keepNeed = (st) => Math.round(keepGoal(st) - KEEP.target);
