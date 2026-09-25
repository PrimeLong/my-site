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
import { makeInitialEconomy, defaultDecisions, simulateQuarter, LEVERS, CONFIG } from './engine.js';
import { withSeededRandom } from './catalog.js';

const LEVER_BY_ID = Object.fromEntries(LEVERS.map((l) => [l.id, l]));

// рычаги, у которых есть смысл в эксперименте «один рычаг против базы»
export const LAB_LEVERS = ['keyRate', 'govSpending', 'transfers', 'govInvestment', 'incomeTaxRate', 'vatRate',
  'profitTaxRate', 'socialContribRate', 'moneySupplyOp', 'fxIntervention', 'reserveReq', 'capitalRequirement']
  .map((id) => LEVER_BY_ID[id]).filter(Boolean);

// режим по умолчанию — как рычаг ведёт себя в партии
export const defaultLabMode = (lever) => (lever && (lever.type === 'level' || lever.persistent) ? 'hold' : 'pulse');

export const LAB_METRICS = [
  { key: 'inflation', label: 'Инфляция', unit: 'п.п.' },
  { key: 'outputGap', label: 'Разрыв выпуска', unit: 'п.п.' },
  { key: 'unemployment', label: 'Безработица', unit: 'п.п.' },
  { key: 'exchangeRate', label: 'Курс (выше — слабее)', unit: '%' },
];
const KEEP = ['inflation', 'outputGap', 'unemployment', 'exchangeRate', 'gdpGrowth', 'keyRate', 'lendingRate',
  'inflationExpectations', 'debtToGdp', 'budgetBalancePctGdp', 'wageGrowth', 'stockIndex'];
const PCT_KEYS = ['exchangeRate', 'stockIndex']; // в процентах к базе, остальное — в пунктах

/* economy — точка старта (по умолчанию стартовая экономика сценария), decisions — базовые
   решения (по умолчанию «ничего не менять»), leverId + value — что меняем. Возвращает
   { base, alt, diff }: diff[i] = alt − base (курс — в процентах к базе). */
export function impulseResponse({ scenario = 'sandbox', economy = null, decisions = null, leverId, value = null, delta = null,
  baseValue: baseOverride = null, horizon = 12, seed = 1, difficulty = 'medium', mode = null } = {}) {
  const lever = LEVER_BY_ID[leverId];
  if (!lever) throw new Error(`Нет рычага ${leverId}`);
  const start = { ...(economy || makeInitialEconomy(scenario)), economyOnly: true };
  const d0 = { ...defaultDecisions(start), ...decisions };
  const baseValue = Number.isFinite(baseOverride) ? baseOverride : Number.isFinite(d0[leverId]) ? d0[leverId] : 0;
  const newValue = Number.isFinite(value) ? value : baseValue + (delta || 0);
  const m = mode || defaultLabMode(lever);

  const run = (leverValue) => withSeededRandom(seed, () => {
    let e = start; let d = { ...d0, [leverId]: leverValue };
    let pend = []; let cds = {}; let st = [];
    const out = [];
    for (let q = 1; q <= horizon; q++) {
      const r = simulateQuarter({ economy: e, decisions: d, pendingImpulses: pend, eventCooldowns: cds,
        difficulty, quarterIndex: q, stories: st }, { skip: ['events', 'war'] });
      e = r.economy; pend = r.pendingImpulses; cds = r.eventCooldowns; st = r.stories;
      out.push(Object.fromEntries(KEEP.map((k) => [k, e[k]])));
      // дальше: в 'hold' рычаг остаётся на своём значении, в 'pulse' возвращается к базе
      d = { ...defaultDecisions(e, d), [leverId]: m === 'hold' ? leverValue : baseValue };
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
    return { lever, mode: m, baseValue, newValue, base, alt, diff };
  } finally {
    CONFIG.noiseMult[difficulty] = noiseSave;
  }
}

// пик отклика: наибольшее по модулю отклонение и квартал, когда оно достигнуто
export function peakOf(diff, key) {
  return diff.reduce((a, r) => (Math.abs(r[key]) > Math.abs(a.v) ? { v: r[key], q: r.q } : a), { v: 0, q: 0 });
}
