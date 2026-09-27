/* ЛАБОРАТОРИЯ: импульсный отклик одного рычага.

   Главный вопрос макроэкономики — «что сделал именно этот рычаг?» — в партии не
   разглядеть: одновременно работают шоки, события, второе ведомство и накопленные
   ожидания. Здесь модель прогоняется дважды из одной и той же точки: базовый мир
   (все рычаги как были) и мир, где изменён ровно один рычаг. Шоки выключены, события
   и война тоже, случайное зерно одно и то же — поэтому разница между мирами и есть
   чистый эффект рычага, квартал за кварталом (impulse response function).

   Режимы:
   • 'hold'  — новое значение держится весь горизонт (ставка выше на 1 п.п. три года);
   • 'pulse' — только первый квартал, дальше как в базе. Для темпов роста расходов это
     разовый сдвиг уровня: расходы выросли на 2% один раз и остались выше навсегда.
   По умолчанию — как в партии: ставка, налоги и темпы расходов сохраняются, пока их не
   тронут, а интервенции и операции с деньгами действуют один квартал.

   Другие рычаги не реагируют — ЦБ не отвечает на бюджет, Минфин на ставку. Это не
   прогноз, а эксперимент «при прочих равных». */
import { makeInitialEconomy, defaultDecisions, simulateQuarter, LEVERS, CONFIG, taylorRate, keyRateCap } from './engine.js';
import { withSeededRandom } from './catalog.js';

const LEVER_BY_ID = Object.fromEntries(LEVERS.map((l) => [l.id, l]));

// рычаги, у которых есть смысл в эксперименте «один рычаг против базы»
export const LAB_LEVERS = ['keyRate', 'govSpending', 'transfers', 'govInvestment', 'incomeTaxRate', 'vatRate',
  'profitTaxRate', 'socialContribRate', 'moneySupplyOp', 'fxIntervention', 'reserveReq', 'capitalRequirement']
  .map((id) => LEVER_BY_ID[id]).filter(Boolean);

// режим по умолчанию: ставка — шок в правиле Тейлора; остальное — как рычаг ведёт себя в партии
export const defaultLabMode = (lever) => (lever && lever.id === 'keyRate' ? 'taylor'
  : lever && (lever.type === 'level' || lever.persistent) ? 'hold' : 'pulse');
// ЦБ по умолчанию отвечает на бюджетные и прочие рычаги правилом Тейлора — как в жизни
export const defaultLabCb = () => 'taylor';

export const LAB_METRICS = [
  { key: 'inflation', label: 'Инфляция', unit: 'п.п.' },
  { key: 'outputGap', label: 'Разрыв выпуска', unit: 'п.п.' },
  { key: 'unemployment', label: 'Безработица', unit: 'п.п.' },
  { key: 'exchangeRate', label: 'Курс (выше — слабее)', unit: '%' },
];
const KEEP = ['inflation', 'outputGap', 'unemployment', 'exchangeRate', 'gdpGrowth', 'keyRate', 'lendingRate',
  'inflationExpectations', 'debtToGdp', 'budgetBalancePctGdp', 'wageGrowth', 'stockIndex'];
const PCT_KEYS = ['exchangeRate', 'stockIndex']; // в процентах к базе, остальное — в пунктах

/* ЦБ ПО ПРАВИЛУ ТЕЙЛОРА. Без реакции ЦБ модель к потенциалу сама не возвращается:
   разрыв выпуска закрывается только через ставку (у спроса нет собственного якоря —
   потребление и инвестиции реагируют на разрыв реальной ставки с нейтральной, а не на
   сам разрыв выпуска). Поэтому в режиме 'taylor' ЦБ в обоих мирах каждый квартал
   ставит ставку по сглаженному правилу i = ρ·i₋₁ + (1 − ρ)·Тейлор(π, разрыв), а шок
   ставки — это добавка к правилу, которая затухает с коэффициентом DECAY за квартал.
   Так выглядит учебный отклик: горб и возврат к нулю. */
export const TAYLOR_SMOOTH = 0.7;
export const SHOCK_DECAY = 0.6;
export function taylorPolicy(e, prevRate, shock = 0) {
  const t = taylorRate(e);
  const i = TAYLOR_SMOOTH * prevRate + (1 - TAYLOR_SMOOTH) * (Number.isFinite(t) ? t : prevRate) + shock;
  return Math.max(0, Math.min(keyRateCap(e), i));
}

/* economy — точка старта (по умолчанию стартовая экономика сценария), decisions — базовые
   решения (по умолчанию «ничего не менять»), leverId + value — что меняем. Возвращает
   { base, alt, diff }: diff[i] = alt − base (курс — в процентах к базе). */
export function impulseResponse({ scenario = 'sandbox', economy = null, decisions = null, leverId, value = null, delta = null,
  baseValue: baseOverride = null, horizon = 12, seed = 1, difficulty = 'medium', mode = null, cb = null } = {}) {
  const lever = LEVER_BY_ID[leverId];
  if (!lever) throw new Error(`Нет рычага ${leverId}`);
  const start = { ...(economy || makeInitialEconomy(scenario)), economyOnly: true };
  const d0 = { ...defaultDecisions(start), ...decisions };
  const baseValue = Number.isFinite(baseOverride) ? baseOverride : Number.isFinite(d0[leverId]) ? d0[leverId] : 0;
  const newValue = Number.isFinite(value) ? value : baseValue + (delta || 0);
  const m = mode || defaultLabMode(lever);
  // отвечает ли ЦБ правилом Тейлора: для ставки это и есть режим 'taylor'
  const rule = leverId === 'keyRate' ? m === 'taylor' : (cb || defaultLabCb(lever)) === 'taylor';

  const run = (leverValue) => withSeededRandom(seed, () => {
    const shock = leverId === 'keyRate' && rule ? leverValue - baseValue : 0;
    let e = start; let d = { ...d0, [leverId]: leverValue };
    if (rule) d.keyRate = taylorPolicy(e, e.keyRate, shock);
    let pend = []; let cds = {}; let st = [];
    const out = [];
    for (let q = 1; q <= horizon; q++) {
      const r = simulateQuarter({ economy: e, decisions: d, pendingImpulses: pend, eventCooldowns: cds,
        difficulty, quarterIndex: q, stories: st }, { skip: ['events', 'war'] });
      e = r.economy; pend = r.pendingImpulses; cds = r.eventCooldowns; st = r.stories;
      out.push(Object.fromEntries(KEEP.map((k) => [k, e[k]])));
      // дальше: в 'hold' рычаг остаётся на своём значении, в 'pulse' возвращается к базе
      if (leverId !== 'keyRate' || !rule) d = { ...defaultDecisions(e, d), [leverId]: m === 'hold' ? leverValue : baseValue };
      else d = defaultDecisions(e, d);
      // ЦБ по правилу: ставка следующего квартала — от нынешних инфляции и разрыва, шок затухает
      if (rule) d.keyRate = taylorPolicy(e, e.keyRate, shock * Math.pow(SHOCK_DECAY, q));
    }
    return out;
  });

  // шоки выключены на время расчёта: шум квартала обнуляется, события пропускаются
  const noiseSave = CONFIG.noiseMult[difficulty];
  CONFIG.noiseMult[difficulty] = 0;
  try {
    const base = run(baseValue);
    const alt = run(newValue);
    const diff = base.map((b, i) => {
      const a = alt[i]; const row = { q: i + 1 };
      KEEP.forEach((k) => { row[k] = a[k] - b[k]; });
      PCT_KEYS.forEach((k) => { row[k] = (a[k] / b[k] - 1) * 100; });
      return row;
    });
    return { lever, mode: m, cb: rule ? 'taylor' : 'fixed', baseValue, newValue, base, alt, diff };
  } finally {
    CONFIG.noiseMult[difficulty] = noiseSave;
  }
}

// пик отклика: наибольшее по модулю отклонение и квартал, когда оно достигнуто
export function peakOf(diff, key) {
  return diff.reduce((a, r) => (Math.abs(r[key]) > Math.abs(a.v) ? { v: r[key], q: r.q } : a), { v: 0, q: 0 });
}

// круглые деления оси, всегда включая ноль: 0, ±0,1, ±0,2… или 0, ±0,25, ±0,5…
export function zeroTicks(values) {
  const lo = Math.min(0, ...values); const hi = Math.max(0, ...values);
  const span = Math.max(hi - lo, 1e-6);
  const raw = span / 4; const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((x) => x >= raw) || 10 * pow;
  const a = Math.floor(lo / step + 1e-9) * step + 0; const b = Math.ceil(hi / step - 1e-9) * step + 0;
  const ticks = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toFixed(6)));
  // сколько знаков после запятой нужно, чтобы деления читались одинаково: 0,25 → 2, 0,2 → 1, 2 → 0
  const digits = step >= 1 ? 0 : Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2;
  return { domain: [a, b], ticks, digits };
}
