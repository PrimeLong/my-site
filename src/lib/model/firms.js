/* КРУПНЫЙ БИЗНЕС. Те же компании, что конкурируют с игроком в «Своём деле», живут и
   в «Партии у руля страны»: у каждой своя отрасль, свои области и своя
   чувствительность к ставке, налогам, спросу и курсу. Раньше «Партия» ничего не знала
   о фирмах, а тайкун лишь читал экономику, ничего не меняя в ней обратно.

   Здоровье фирмы (0–100) тянется к цели, которую задаёт политика. Проседает ниже 30 —
   фирма сокращает людей: растёт безработица и напряжение в её областях. Выше 70 —
   расширяется: инвестиции и рабочие места. Всё это — импульсы в ту же модель. */
import { clamp } from '../catalog.js';

export const FIRMS = [
  { id: 'kolos', name: 'Хлебный дом «Колос»', sector: 'Продукты', regions: ['agri', 'capital'], k: { demand: 1.0, rate: 0.5, tax: 0.6, fx: -0.4, world: 0 } },
  { id: 'severoles', name: 'Северолес', sector: 'Лес и мебель', regions: ['periphery', 'port'], k: { demand: 0.8, rate: 0.9, tax: 0.6, fx: 0.4, world: 0.6 } },
  { id: 'stal', name: 'Стальной союз', sector: 'Металлургия', regions: ['industry', 'mining'], k: { demand: 0.6, rate: 0.7, tax: 0.8, fx: 0.7, world: 1.0 } },
  { id: 'westra', name: 'Вестравский ритейл', sector: 'Ритейл (иностранный)', regions: ['capital', 'finance'], foreign: true, k: { demand: 1.2, rate: 0.4, tax: 0.5, fx: -0.9, world: 0 } },
];

export const initialFirms = () => Object.fromEntries(FIRMS.map((f) => [f.id, { health: 60, mode: 'steady' }]));

/* x — величины квартала: gdpGrowth, lendingRate, profitTaxRate, fxDeprAnnual, exportsGrowth,
   sanctions (санкции Вестравии), atWar. Возвращает новое состояние, импульсы-намерения и новости. */
export function firmsStep(prev, x) {
  const p = prev && typeof prev === 'object' ? prev : initialFirms();
  const out = {}; const events = []; const regionShift = {};
  let jobs = 0; let invest = 0;
  FIRMS.forEach((f) => {
    const cur = p[f.id] || { health: 60, mode: 'steady' };
    // иностранная сеть уходит при санкциях — и возвращается, когда их снимают
    if (f.foreign && x.sanctions) {
      out[f.id] = { health: 0, mode: 'gone' };
      if (cur.mode !== 'gone') events.push({ firm: f, kind: 'gone' });
      return;
    }
    const target = clamp(55
      + f.k.demand * 4 * (x.gdpGrowth - 2)
      - f.k.rate * 1.6 * (x.lendingRate - 8)
      - f.k.tax * 0.9 * (x.profitTaxRate - 20)
      + f.k.fx * 0.25 * clamp(x.fxDeprAnnual, -20, 30)
      + f.k.world * 0.8 * clamp(x.exportsGrowth, -10, 10)
      - (x.atWar ? 6 : 0), 5, 95);
    const health = clamp(cur.health + 0.3 * (target - cur.health), 0, 100);
    const mode = health < 30 ? 'cutting' : health > 70 ? 'expanding' : 'steady';
    if (mode !== cur.mode && cur.mode !== 'gone') events.push({ firm: f, kind: mode });
    if (cur.mode === 'gone') events.push({ firm: f, kind: 'back' });
    if (mode === 'cutting') { jobs += 0.08; f.regions.forEach((r) => { regionShift[r] = (regionShift[r] || 0) + 4; }); }
    if (mode === 'expanding') { invest += 0.25; jobs -= 0.04; f.regions.forEach((r) => { regionShift[r] = (regionShift[r] || 0) - 2; }); }
    out[f.id] = { health, mode };
  });
  return { firms: out, events, unemploymentPush: jobs, investmentPush: invest, regionShift };
}

export const FIRM_MODE_LABEL = { steady: 'работает ровно', cutting: 'сокращает людей', expanding: 'расширяется', gone: 'ушла из страны' };
