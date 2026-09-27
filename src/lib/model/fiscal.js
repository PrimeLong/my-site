/* Выделено из engine.js: model/fiscal.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG, clamp } from '../catalog.js';

/* =========================================================================================
   НАЛОГОВАЯ БАЗА И СОБИРАЕМОСТЬ (нелинейность -> кривая Лаффера как результат поведения)
========================================================================================= */
export const TAX_REF = { income: 13, wedge: 32, profit: 18, vat: 16, excise: 10, capital: 12 };
export function complianceFor(rate, ref, sens, shadowShare) {
  const excess = Math.max(0, rate - ref);
  const relief = Math.max(0, ref - rate) * 0.004;
  const c = (1 - shadowShare / 100 + relief) * (1 - sens * Math.pow(excess, 1.35) / 100);
  return clamp(c, 0.2, 0.99);
}
export function taxBases(s) {
  const nom = Math.max(1, s.nominalGdp);
  const cyc = 1 + 0.6 * (s.outputGap / 100);
  const employmentEffect = (100 - s.unemployment) / (100 - CONFIG.target.nairu);
  return {
    labor: nom * CONFIG.shares.wageBill * cyc * employmentEffect,
    profit: nom * CONFIG.shares.profits * Math.max(0.35, 1 + 1.8 * (s.outputGap / 100)),
    consumption: Math.max(1, s.consumption * s.priceLevel / 100),
    capital: nom * CONFIG.shares.capitalIncome * cyc,
    nominal: nom,
  };
}
export function computeRevenue(s, d) {
  const B = taxBases(s);
  const sh = s.shadowShare;
  const income = d.incomeTaxRate / 100 * B.labor * complianceFor(d.incomeTaxRate, TAX_REF.income, 0.9, sh);
  const social = d.socialContribRate / 100 * B.labor * complianceFor(d.socialContribRate + d.incomeTaxRate, TAX_REF.wedge, 0.8, sh);
  const profit = d.profitTaxRate / 100 * B.profit * complianceFor(d.profitTaxRate, TAX_REF.profit, 1.5, sh);
  const vat = d.vatRate / 100 * B.consumption * 0.72 * complianceFor(d.vatRate, TAX_REF.vat, 1.1, sh);
  const excise = d.exciseRate / 100 * B.consumption * 0.26 * complianceFor(d.exciseRate, TAX_REF.excise, 0.7, sh);
  const capital = d.capitalTaxRate / 100 * B.capital * complianceFor(d.capitalTaxRate, TAX_REF.capital, 2.2, sh);
  const nonTax = CONFIG.shares.nonTaxRevenue * B.nominal;
  const total = income + social + profit + vat + excise + capital + nonTax;
  return { income, social, profit, vat, excise, capital, nonTax, total, bases: B };
}
export const taxWedge = (d) => d.incomeTaxRate + d.socialContribRate * 0.7 + d.vatRate * 0.35;

/* Потенциальный ВВП: производственная функция Кобба—Дугласа */
export function potentialFrom(capitalStock, laborForce, nairu, humanCapital, productivity, infraIndex, tfpScale, scar) {
  const alpha = CONFIG.prod.alpha;
  const L = Math.max(1, laborForce * (1 - nairu / 100) * (humanCapital / 100));
  const A = tfpScale * (productivity / 100);
  const infraBoost = 1 + 0.18 * (infraIndex - 100) / 100;
  return A * Math.pow(Math.max(1, capitalStock), alpha) * Math.pow(L, 1 - alpha) * infraBoost * (1 + scar / 100);
}
export const STOCK_NORM = (() => {
  const I = CONFIG.initial;
  const earn0 = CONFIG.shares.profits * I.gdp * (1 - I.profitTaxRate / 100);
  const y10 = I.keyRate + 1.5; const erp0 = 3.2; const growth0 = 0.62 * (2.3 + I.inflationExpectations);
  const pe0 = 100 / Math.max(1, y10 + erp0 - growth0);
  return earn0 * pe0 / 1000;
})();
export const TFP_SCALE = (() => {
  const I = CONFIG.initial;
  const alpha = CONFIG.prod.alpha;
  const L = I.laborForce * (1 - I.nairu / 100) * (I.humanCapitalIndex / 100);
  return I.gdp / (Math.pow(I.capitalStock, alpha) * Math.pow(L, 1 - alpha));
})();


/* Пять независимых оценок: одновременно максимизировать их нельзя */
export function computeScores(x) {
  const T = CONFIG.target;
  const tgt = Number.isFinite(x.inflationTarget) ? x.inflationTarget : T.inflation;
  const interestToRevenue = x.interestPayment / Math.max(1, x.govRevenue) * 100;
  const reserveCover = x.reserves / Math.max(1, x.imports / 4) * 3;
  const inflDev = Math.abs(x.inflation - tgt);
  const scoreStability = clamp(72 + 0.35 * (x.cbCredibility - 60) + (inflDev < 1 ? 4 : 0)
    - 8.5 * inflDev - 7 * Math.abs(x.inflationExpectations - tgt)
    - 3.2 * Math.max(0, Math.abs(x.outputGap) - 1), 0, 100);
  const scoreWelfare = clamp(52 + 7 * (x.gdpGrowth - 1.5) - 5.5 * (x.unemployment - x.nairu)
    + 0.22 * (x.consumerConfidence - 55) - 3.2 * Math.max(0, x.inflation - tgt)
    + 0.12 * (x.humanCapitalIndex - 100), 0, 100);
  const scoreFinancial = clamp(100 - 0.75 * x.bankingRisk - 2.2 * Math.max(0, x.creditGap)
    - 3.2 * Math.max(0, x.capitalRequirement + 1 - x.bankCapitalAdequacy)
    - 0.45 * x.currencyRisk + 0.06 * Math.min(100, reserveCover * 10), 0, 100);
  const scoreFiscal = clamp(100 - 0.75 * Math.max(0, x.debtToGdp - 45) - 5.5 * Math.max(0, -x.budgetBalancePctGdp - 2)
    - 1.4 * Math.max(0, interestToRevenue - 8) - 0.6 * Math.max(0, x.shadowShare - 14), 0, 100);
  const scorePotential = clamp(48 + 13 * (x.potentialGrowth - 2.0) + 0.30 * (x.humanCapitalIndex - 100)
    + 0.22 * (x.infrastructureIndex - 100) + 0.30 * (x.productivity - 100) - 5 * Math.max(0, x.nairu - T.nairu), 0, 100);
  const wellbeing = clamp(0.22 * scoreStability + 0.30 * scoreWelfare + 0.16 * scoreFinancial + 0.16 * scoreFiscal + 0.16 * scorePotential, 0, 100);
  return { scoreStability, scoreWelfare, scoreFinancial, scoreFiscal, scorePotential, wellbeing };
}

