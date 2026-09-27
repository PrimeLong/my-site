/* КРУПНЫЙ БИЗНЕС. Те же компании, что конкурируют с игроком в «Своём деле», живут и
   в «Партии у руля страны»: у каждой своя отрасль, свои области и своя
   чувствительность к ставке, налогам, спросу и курсу.

   Здоровье фирмы (0–100) тянется к цели, которую задаёт политика:
   • ставка — реальная, против нейтральной (rateGap из движка): 15% при инфляции 12%
     мягче, чем 8% при инфляции 2%, и фирмы должны это видеть;
   • цель насыщается мягко (tanh), а не упирается в границу: в глубоком кризисе
     продуктовая сеть страдает меньше металлургии, а не все одинаково «на полу»;
   • сокращения не добавляют безработицу — она уже считается по закону Оукена из
     того же падения выпуска, второй импульс был бы двойным счётом. Фирмы показывают,
     где именно болит: напряжение в их областях и отложенные инвестиции. */
import { clamp } from '../catalog.js';

// base — здоровье при нейтральных условиях; k — чувствительности (спрос, реальная ставка,
// налог на прибыль, ослабление курса, мировой спрос)
export const FIRMS = [
  { id: 'kolos', name: 'Хлебный дом «Колос»', sector: 'Продукты', regions: ['agri', 'capital'], base: 60, k: { demand: 0.35, rate: 0.4, tax: 0.6, fx: -0.4, world: 0 } },
  { id: 'severoles', name: 'Северолес', sector: 'Лес и мебель', regions: ['periphery', 'port'], base: 55, k: { demand: 0.9, rate: 1.1, tax: 0.6, fx: 0.4, world: 0.6 } },
  { id: 'stal', name: 'Стальной союз', sector: 'Металлургия', regions: ['industry', 'mining'], base: 52, k: { demand: 1.3, rate: 0.8, tax: 0.8, fx: 0.7, world: 1.0 } },
  { id: 'westra', name: 'Вестравский ритейл', sector: 'Ритейл (иностранный)', regions: ['capital', 'finance'], foreign: true, base: 57, k: { demand: 1.0, rate: 0.5, tax: 0.5, fx: -0.9, world: 0 } },
];

export const initialFirms = () => Object.fromEntries(FIRMS.map((f) => [f.id, { health: 60, mode: 'steady' }]));

/* x — величины квартала: gdpGrowth, rateGap (реальная ставка по кредитам минус нейтральная,
   п.п.), profitTaxRate, fxDeprAnnual, exportsGrowth, sanctions (санкции Вестравии), atWar.
   Возвращает новое состояние, импульс инвестиций, напряжение по областям и новости. */
export function firmTarget(f, x) {
  const score = f.k.demand * 4 * (x.gdpGrowth - 2)
    - f.k.rate * 3 * (x.rateGap || 0)
    - f.k.tax * 0.9 * (x.profitTaxRate - 20)
    + f.k.fx * 0.25 * clamp(x.fxDeprAnnual, -20, 30)
    + f.k.world * 0.8 * clamp(x.exportsGrowth, -10, 10)
    - (x.atWar ? 6 : 0);
  // мягкое насыщение: вблизи нормы — почти линейно, в крайностях сжимается, но не упирается
  const room = score >= 0 ? 97 - f.base : f.base - 3;
  return f.base + room * Math.tanh(score / room);
}

export function firmsStep(prev, x) {
  const p = prev && typeof prev === 'object' ? prev : initialFirms();
  const out = {}; const events = []; const regionShift = {};
  let invest = 0;
  FIRMS.forEach((f) => {
    const cur = p[f.id] || { health: 60, mode: 'steady' };
    // иностранная сеть уходит при санкциях — и возвращается, когда их снимают
    if (f.foreign && x.sanctions) {
      out[f.id] = { health: 0, mode: 'gone' };
      if (cur.mode !== 'gone') events.push({ firm: f, kind: 'gone' });
      return;
    }
    const target = firmTarget(f, x);
    const health = clamp(cur.health + 0.3 * (target - cur.health), 0, 100);
    const mode = health < 30 ? 'cutting' : health > 70 ? 'expanding' : 'steady';
    if (mode !== cur.mode && cur.mode !== 'gone') events.push({ firm: f, kind: mode });
    if (cur.mode === 'gone') events.push({ firm: f, kind: 'back' });
    if (mode === 'cutting') { invest -= 0.15; f.regions.forEach((r) => { regionShift[r] = (regionShift[r] || 0) + 4; }); }
    if (mode === 'expanding') { invest += 0.25; f.regions.forEach((r) => { regionShift[r] = (regionShift[r] || 0) - 2; }); }
    out[f.id] = { health, mode };
  });
  return { firms: out, events, investmentPush: invest, regionShift };
}

export const FIRM_MODE_LABEL = { steady: 'работает ровно', cutting: 'сокращает людей', expanding: 'расширяется', gone: 'ушла из страны' };
