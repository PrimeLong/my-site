/* РАСПРЕДЕЛЕНИЕ ДОХОДОВ: пять квинтилей (по 20% населения, от беднейших к
   богатейшим). Раньше общество жило средними цифрами по стране, и не было видно
   главных распределительных уроков:
   • инфляция бьёт по бедным сильнее — у них в корзине больше еды и коммуналки,
     а это самые волатильные цены (разница между общей и базовой инфляцией);
   • НДС и подоходный налог ложатся на разных людей: НДС платят с потребления, а
     бедные тратят весь доход, богатые — меньше половины; подоходный — с зарплат,
     и у беднейших часть их ниже необлагаемого минимума;
   • трансферты перераспределяют: для нижнего квинтиля это больше половины дохода;
   • рост безработицы сначала бьёт по нижним квинтилям, биржевой рост — по верхнему.

   Модель — надстройка над макроэкономикой: она ничего не меняет в ВВП и ценах,
   а раскладывает уже посчитанный квартал по доходным группам. Итог — реальный
   располагаемый доход каждого квинтиля, личная инфляция, налоговая нагрузка и
   коэффициент Джини. Соцгруппы (пенсионеры, рабочие, бизнес…) смотрят на «свой»
   квинтиль, а не на среднее по стране. */
import { clamp } from '../catalog.js';

export const QUINTILES = [
  // src: доли источников дохода (зарплата, трансферты, капитал, неформальный);
  // cons: доля дохода, которая уходит на потребление (на неё ложится НДС);
  // food: доля еды и коммуналки в корзине; taxable: какая часть зарплаты облагается
  { id: 'q1', name: 'Беднейшие 20%', short: '1-й', share0: 0.062, src: { wage: 0.36, transfer: 0.54, capital: 0.0, informal: 0.10 }, cons: 1.0, food: 0.52, taxable: 0.55 },
  { id: 'q2', name: 'Ниже среднего', short: '2-й', share0: 0.108, src: { wage: 0.60, transfer: 0.33, capital: 0.02, informal: 0.05 }, cons: 0.92, food: 0.42, taxable: 0.85 },
  { id: 'q3', name: 'Средние 20%', short: '3-й', share0: 0.158, src: { wage: 0.75, transfer: 0.18, capital: 0.04, informal: 0.03 }, cons: 0.84, food: 0.34, taxable: 1 },
  { id: 'q4', name: 'Выше среднего', short: '4-й', share0: 0.228, src: { wage: 0.80, transfer: 0.10, capital: 0.08, informal: 0.02 }, cons: 0.74, food: 0.27, taxable: 1 },
  { id: 'q5', name: 'Богатейшие 20%', short: '5-й', share0: 0.444, src: { wage: 0.62, transfer: 0.04, capital: 0.34, informal: 0.0 }, cons: 0.52, food: 0.18, taxable: 1 },
];
const AVG_FOOD = QUINTILES.reduce((a, q) => a + q.food, 0) / QUINTILES.length;
// как рост безработицы распределяется по квинтилям: теряют работу в первую очередь внизу
const JOB_LOSS = [1.8, 1.3, 1.0, 0.7, 0.4];

// Джини по пяти равным группам: 1 − Σ 0,2·(L(k−1) + L(k)), L — кривая Лоренца
export function giniOf(shares) {
  const total = shares.reduce((a, v) => a + v, 0) || 1;
  let cum = 0; let area = 0;
  shares.forEach((v) => { const prev = cum; cum += v / total; area += 0.2 * (prev + cum); });
  return clamp(1 - area, 0, 1);
}

export function initialDistribution() {
  const quintiles = QUINTILES.map((q) => ({ id: q.id, income: q.share0 * 100, real: 100, realYoY: 0, inflation: 0, taxBurden: 0 }));
  return { quintiles, gini: giniOf(QUINTILES.map((q) => q.share0)), povertyRate: 13 };
}

/* Один квартал. x — уже посчитанные величины квартала:
   wageGrowth, unemployment, prevUnemployment, transfersRealGrowth, inflation, coreInflation,
   gdpGrowth, stockGrowth (% за квартал), keyRate, vatRate, incomeTaxRate, capitalTaxRate. */
export function distributionStep(prev, x) {
  const p = prev && Array.isArray(prev.quintiles) && prev.quintiles.length === 5 ? prev : initialDistribution();
  const k = 0.25; // годовые темпы → квартальные
  const du = (x.unemployment - x.prevUnemployment) || 0;
  const foodGap = (x.inflation - x.coreInflation) || 0;
  const quintiles = QUINTILES.map((q, i) => {
    const old = p.quintiles[i];
    // номинальный рост источников дохода, % годовых
    const wage = x.wageGrowth - JOB_LOSS[i] * du * 4;
    const transfer = x.transfersRealGrowth + x.inflation;
    const capital = x.stockGrowth * 4 * 0.5 + x.keyRate * 0.4 + x.gdpGrowth * 0.5;
    const informal = x.gdpGrowth + x.inflation;
    const nominal = q.src.wage * wage + q.src.transfer * transfer + q.src.capital * capital + q.src.informal * informal;
    // личная инфляция: корзина с большей долей еды и коммуналки чувствует разрыв «общая − базовая» сильнее
    const personal = x.coreInflation + foodGap * (q.food / AVG_FOOD);
    // налоги, которые платит квинтиль, в % его дохода
    const tax = (x.vatRate / (100 + x.vatRate)) * q.cons * 100
      + x.incomeTaxRate * q.taxable * q.src.wage
      + x.capitalTaxRate * q.src.capital;
    const taxChange = old.taxBurden ? tax - old.taxBurden : 0;
    const income = old.income * (1 + (nominal * k - taxChange) / 100);
    const real = old.real * (1 + ((nominal - personal) * k - taxChange) / 100);
    const hist = [...(old.hist || []), real].slice(-4);
    return { id: q.id, income, real, hist, realYoY: hist.length >= 4 ? (real / hist[0] - 1) * 100 : 0,
      inflation: personal, taxBurden: tax };
  });
  // располагаемые доли: после налогов
  const disp = quintiles.map((q) => q.income * (1 - q.taxBurden / 100));
  const gini = giniOf(disp);
  // бедность: доля населения ниже порога — растёт, когда реальные доходы низа падают
  const lowReal = (quintiles[0].real + quintiles[1].real * 0.5) / 1.5;
  const povertyRate = clamp(13 + (100 - lowReal) * 0.45 + (gini - 0.33) * 60, 2, 60);
  return { quintiles, gini, povertyRate };
}

// какому квинтилю «принадлежит» соцгруппа: её доходы — доходы этого слоя
export const GROUP_QUINTILE = { pensioners: [0, 1], workers: [1, 2], public: [2], business: [4], youth: [1, 2], regions: [0, 1, 2] };
export function groupRealIncome(dist, groupId) {
  const idx = GROUP_QUINTILE[groupId];
  if (!dist || !dist.quintiles || !idx) return null;
  return idx.reduce((a, i) => a + (dist.quintiles[i].realYoY || 0), 0) / idx.length;
}
