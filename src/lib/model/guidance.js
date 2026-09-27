/* ОБЕЩАНИЕ О ПУТИ СТАВКИ (forward guidance). На пресс-конференции ЦБ объявляет, куда
   пойдёт ставка в ближайшие два квартала: снижать, держать или повышать. Рынок верит
   ему настолько, насколько доверяет ЦБ, и закладывает путь в цены сразу: ставки по
   кредитам и доходности облигаций сдвигаются до самого решения, ожидания инфляции —
   тоже. Но это обязательство: если ЦБ потом делает не то, что обещал, доверие к нему
   падает пропорционально отклонению — и следующее обещание стоит уже меньше.

   s.guidance = { dir: 'cut' | 'hold' | 'hike', left: кварталов, fromRate, q } */
import { clamp } from '../catalog.js';

export const GUIDANCE_OPTIONS = [
  { id: 'none', label: 'Без обещаний', hint: 'Решаем по данным каждый квартал — рынок не получает сигнала, но и нарушить нечего.' },
  { id: 'cut', label: 'Будем снижать', hint: 'Кредит дешевеет уже сейчас, ожидания инфляции чуть растут. Повышение в ближайшие два квартала — нарушение.' },
  { id: 'hold', label: 'Будем держать', hint: 'Ставка на паузе два квартала. Сдвиг больше чем на 0,25 п.п. в любую сторону — нарушение.' },
  { id: 'hike', label: 'Будем повышать', hint: 'Кредит дорожает уже сейчас, ожидания инфляции снижаются. Снижение — нарушение.' },
];
export const GUIDANCE_LABEL = { cut: 'снижать', hold: 'держать', hike: 'повышать' };
const HORIZON = 2;

// насколько решение отклонилось от обещания, п.п. (0 — обещание выполнено)
export function guidanceBreach(dir, delta) {
  if (dir === 'hold') return Math.max(0, Math.abs(delta) - 0.25);
  if (dir === 'cut') return delta > 0.01 ? delta + 0.25 : 0;
  if (dir === 'hike') return delta < -0.01 ? -delta + 0.25 : 0;
  return 0;
}

/* s — состояние на начало квартала, keyRate — решение этого квартала, pick — что ЦБ
   объявляет сейчас ('none' | 'cut' | 'hold' | 'hike' | undefined — ничего нового). */
export function guidanceStep(s, keyRate, pick) {
  const cur = s.guidance && s.guidance.left > 0 ? s.guidance : null;
  const cred = clamp(Number.isFinite(s.cbCredibility) ? s.cbCredibility : 60, 0, 100) / 100;
  const delta = keyRate - (Number.isFinite(s.keyRate) ? s.keyRate : keyRate);
  let credDelta = 0; const news = [];
  // 1. проверка действующего обещания решением этого квартала
  if (cur) {
    const breach = guidanceBreach(cur.dir, delta);
    if (breach > 0) {
      credDelta -= Math.min(12, 5 * breach);
      news.push(['cb', 'ЦБ НАРУШИЛ СОБСТВЕННОЕ ОБЕЩАНИЕ',
        `Обещали ${GUIDANCE_LABEL[cur.dir]} ставку, а сдвинули её на ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2).replace('.', ',')} п.п. Рынок запомнит: следующему слову ЦБ поверят меньше.`, 8]);
    } else credDelta += 0.6;
  }
  // 2. новое слово: отказ от обещания раньше срока тоже стоит доверия, но меньше нарушения
  let next = cur ? { ...cur, left: cur.left - 1 } : null;
  if (pick === 'none' && cur && cur.left > 1) {
    credDelta -= 1.5; next = null;
    news.push(['cb', 'ЦБ ОТОЗВАЛ ОРИЕНТИР ПО СТАВКЕ', 'Обещание сняли раньше срока — рынок воспринял это как неуверенность.', 5]);
  } else if (pick && pick !== 'none' && (!cur || cur.dir !== pick || cur.left <= 1)) {
    next = { dir: pick, left: HORIZON, fromRate: keyRate };
    if (!cur || cur.dir !== pick) {
      news.push(['cb', `ЦБ: БУДЕМ ${GUIDANCE_LABEL[pick].toUpperCase()} СТАВКУ`,
        `Ориентир на два квартала. Рынок верит ЦБ на ${Math.round(cred * 100)} из 100 — и уже закладывает путь в ставки по кредитам и доходности облигаций.`, 6]);
    }
  }
  if (next && next.left <= 0) next = null;
  // 3. что рынок закладывает сейчас: сдвиг будущих ставок, взвешенный доверием
  const dir = next ? next.dir : null;
  const bias = (dir === 'hike' ? 0.5 : dir === 'cut' ? -0.5 : 0) * cred;
  const expDelta = dir === 'hike' ? -0.15 * cred : dir === 'cut' ? 0.1 * cred : dir === 'hold' ? -0.03 * cred : 0;
  return { next, bias, expDelta, credDelta, news };
}
