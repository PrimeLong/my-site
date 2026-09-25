/* «А ЕСЛИ БЫ ВЫ НИЧЕГО НЕ ДЕЛАЛИ». После каждого квартала тот же квартал считается
   второй раз — из той же точки, с тем же случайным зерном (значит, с теми же шоками и
   событиями) и с теми же решениями соседнего ведомства, президента и бота, — но рычаги
   игрока стоят там, где были в начале квартала. Разница двух итогов — вклад политики
   игрока в этом квартале, отделённый от шоков и чужих решений.

   Оговорка, которую показывает интерфейс: большая часть эффекта ставки и налогов
   приходит с лагом, через кварталы. Здесь — только то, что успело случиться сразу;
   полную траекторию показывает «Лаборатория». */
import { LEVERS } from './engine.js';

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
