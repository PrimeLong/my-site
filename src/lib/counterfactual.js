/* «А ЕСЛИ БЫ ВЫ НИЧЕГО НЕ ДЕЛАЛИ». После каждого квартала тот же квартал считается
   второй раз — из той же точки, с тем же случайным зерном (значит, с теми же шоками и
   событиями) и с теми же решениями соседнего ведомства, президента и бота, — но рычаги
   игрока стоят там, где были в начале квартала. Разница двух итогов — вклад политики
   игрока в этом квартале, отделённый от шоков и чужих решений.

   Оговорка, которую показывает интерфейс: большая часть эффекта ставки и налогов
   приходит с лагом, через кварталы. Здесь — только то, что успело случиться сразу;
   полную траекторию показывает «Лаборатория». */
import { LEVERS, simulateQuarter, defaultDecisions, botCentralBank, botFinanceMinistry, clamp } from './engine.js';
import { withSeededRandom } from './catalog.js';

// какие рычаги игрока «не трогать»: всё, что он может двигать в своих группах
export function passiveDecisions(eff, baseline, groups) {
  const out = { ...eff };
  LEVERS.filter((l) => groups.includes(l.group)).forEach((l) => {
    if (baseline && Number.isFinite(baseline[l.id])) out[l.id] = baseline[l.id];
  });
  if (groups.includes('monetary')) {
    Object.assign(out, { fxRegime: baseline ? baseline.fxRegime : eff.fxRegime, guidance: null, emergency: false, pressAnswer: null });
  }
  if (groups.includes('fiscal')) {
    Object.assign(out, { sovereignDefault: false, imfProgram: false, startProject: null, regionResponse: null, groupResponse: null });
  }
  return out;
}

// что игрок изменил за квартал: для строки «вы сделали»
export function changedLevers(eff, baseline, groups) {
  return LEVERS.filter((l) => groups.includes(l.group))
    .filter((l) => baseline && Number.isFinite(baseline[l.id]) && Number.isFinite(eff[l.id]) && Math.abs(eff[l.id] - baseline[l.id]) > 1e-9)
    .map((l) => ({ id: l.id, label: l.label, from: baseline[l.id], to: eff[l.id], suffix: l.suffix, digits: l.step < 0.5 ? 2 : 1 }));
}

export const CF_METRICS = [
  { key: 'inflation', label: 'Инфляция', unit: 'п.п.', good: -1 },
  { key: 'unemployment', label: 'Безработица', unit: 'п.п.', good: -1 },
  { key: 'gdpGrowth', label: 'Рост ВВП', unit: 'п.п.', good: 1 },
  { key: 'outputGap', label: 'Разрыв выпуска', unit: 'п.п.', good: 0 },
  { key: 'lendingRate', label: 'Ставка по кредитам', unit: 'п.п.', good: 0 },
  { key: 'budgetBalancePctGdp', label: 'Сальдо бюджета, % ВВП', unit: 'п.п.', good: 1 },
  { key: 'exchangeRate', label: 'Курс (выше — слабее)', unit: '%', good: 0 },
  { key: 'approval', label: 'Рейтинг', unit: 'п.', good: 1 },
];

// итог квартала с решениями игрока против итога без них
export function policyContribution(actual, passive) {
  const rows = CF_METRICS.map((m) => {
    const a = actual[m.key]; const p = passive[m.key];
    const d = m.key === 'exchangeRate' ? (a / p - 1) * 100 : a - p;
    return { ...m, actual: a, passive: p, diff: Number.isFinite(d) ? d : 0 };
  });
  return rows;
}

/* НАКОПЛЕННОЕ СРАВНЕНИЕ. Из-за лагов вклад решения за один квартал почти нулевой: ставка
   действует через три–восемь кварталов. Поэтому рядом с партией живёт второй мир — «без
   вас с самого начала»: тот же старт, то же зерно каждого квартала (значит, те же шоки в
   той мере, в какой их вызывают одни и те же броски), тот же президент, но рычаги игрока
   навсегда стоят на стартовых значениях, а бот соседнего ведомства отвечает на состояние
   этого мира, а не вашего. Разница миров — накопленный вклад вашей политики.

   shadow = { economy, pendingImpulses, eventCooldowns, stories, fixed, fromQ, track[] } */
const TRACK_KEYS = ['inflation', 'unemployment', 'gdp', 'outputGap', 'debtToGdp', 'wellbeing', 'approval', 'keyRate'];
const trackRow = (q, e) => ({ q, ...Object.fromEntries(TRACK_KEYS.map((k) => [k, e[k]])) });

// старт — ровно та же точка, что у партии: экономика, очередь импульсов, откаты событий, сюжеты
export function startShadow(economy, fromQ = 1, { pendingImpulses = [], eventCooldowns = {}, stories = [] } = {}) {
  return { economy, pendingImpulses, eventCooldowns, stories, fixed: defaultDecisions(economy), fromQ, track: [] };
}

/* eff — решения этого квартала в настоящем мире (из них берутся президент, дипломатия и
   прочее, что не решает игрок); bots — характеры ботов соседних ведомств или null. */
export function shadowQuarter(shadow, { eff, groups, bots = {}, difficulty, quarterIndex, seed }) {
  const e = shadow.economy;
  let d = { ...defaultDecisions(e), ...eff, presidentDirectiveMet: undefined, promises: eff.promises };
  if (bots.cb) d = { ...d, ...botCentralBank(e, bots.cb, difficulty).decisions };
  if (bots.mof) d = { ...d, ...botFinanceMinistry(e, bots.mof, difficulty).decisions };
  d = passiveDecisions(d, shadow.fixed, groups);
  // те же формулы «жёсткости» ведомств, что и в настоящем мире
  const cbStance = clamp((d.keyRate - e.inflationExpectations - e.rStar) / 3, -1, 1);
  const mofStance = clamp((d.govSpending + d.transfers * 0.6 + d.govInvestment * 0.8) / 6
    - (d.vatRate - e.vatRate + d.incomeTaxRate - e.incomeTaxRate) * 0.3, -1, 1);
  const r = withSeededRandom(seed, () => simulateQuarter({ economy: { ...e, cbStance, mofStance }, decisions: d,
    pendingImpulses: shadow.pendingImpulses, eventCooldowns: shadow.eventCooldowns, difficulty, quarterIndex, stories: shadow.stories }));
  return { ...shadow, economy: r.economy, pendingImpulses: r.pendingImpulses, eventCooldowns: r.eventCooldowns,
    stories: r.stories, track: [...shadow.track, trackRow(quarterIndex, r.economy)].slice(-200) };
}

export const CUM_METRICS = [
  { key: 'inflation', label: 'Инфляция сейчас', unit: 'п.п.', good: -1 },
  { key: 'unemployment', label: 'Безработица сейчас', unit: 'п.п.', good: -1 },
  { key: 'gdp', label: 'ВВП (уровень)', unit: '%', good: 1 },
  { key: 'debtToGdp', label: 'Госдолг, % ВВП', unit: 'п.п.', good: -1 },
  { key: 'avgInflation', label: 'Средняя инфляция за партию', unit: 'п.п.', good: -1 },
  { key: 'avgUnemployment', label: 'Средняя безработица за партию', unit: 'п.п.', good: -1 },
  { key: 'wellbeing', label: 'Благополучие', unit: 'п.', good: 1 },
];

// накопленное сравнение: history — кварталы настоящего мира, shadow.track — мира без вас
export function cumulativeContribution(history, shadow) {
  if (!shadow || !shadow.track.length) return null;
  const qs = new Set(shadow.track.map((t) => t.q));
  const mine = (history || []).filter((h) => qs.has(h.q));
  if (!mine.length) return null;
  const a = mine[mine.length - 1];
  const p = shadow.track.find((t) => t.q === a.q) || shadow.track[shadow.track.length - 1];
  const avg = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0) / rows.length;
  const pr = shadow.track.filter((t) => t.q <= a.q);
  const A = { ...a, avgInflation: avg(mine, 'inflation'), avgUnemployment: avg(mine, 'unemployment') };
  const P = { ...p, avgInflation: avg(pr, 'inflation'), avgUnemployment: avg(pr, 'unemployment') };
  const rows = CUM_METRICS.map((m) => {
    const d = m.key === 'gdp' ? (A.gdp / P.gdp - 1) * 100 : A[m.key] - P[m.key];
    return { ...m, actual: A[m.key], passive: P[m.key], diff: Number.isFinite(d) ? d : 0 };
  });
  return { fromQ: shadow.fromQ, q: a.q, quarters: mine.length, rows };
}
