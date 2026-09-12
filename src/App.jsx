import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Landmark,
  Coins,
  Globe2,
  TrendingUp,
  Users,
  Activity,
  Newspaper,
  Factory,
  Scale,
  Banknote,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Check,
  AlertTriangle,
  Bot,
  Gauge as GaugeIcon,
  Target,
  Zap,
  Volume2,
  VolumeX,
  Music,
  Save,
  Download,
  Upload,
  Copy,
  Star,
  Flag,
  Megaphone,
  Sliders,
} from 'lucide-react';

/* =========================================================================================
   ЭКОНОМИЧЕСКАЯ ПАНЕЛЬ ГОСУДАРСТВА — ЯДРО МОДЕЛИ (v2)
   Структура: IS -> рынок труда -> Филлипс -> ожидания, денежная трансмиссия через
   рыночные ставки и кредит, банковский цикл с капиталом, налоговая база и комплаенс,
   платёжный баланс, режимы экономики и пять независимых оценок.
========================================================================================= */
const CONFIG = {
  population: 45,
  startYear: 2032,
  target: {
    inflation: 4.0,
    nairu: 5.0,
    foreignRate: 3.0,
    worldInflation: 3.0,
    neutralConfidence: 55,
    neutralStability: 70,
    neutralTrust: 55,
    minCapitalRatio: 10.5,
    riskWeight: 0.75,
    lgd: 0.45,
  },
  prod: { alpha: 0.32, depreciation: 5.0, tfpBase: 1.55 },
  shares: {
    wageBill: 0.47,
    profits: 0.21,
    capitalIncome: 0.055,
    nonTaxRevenue: 0.075,
  },
  initial: {
    gdp: 2000,
    priceLevel: 100,
    consumption: 1155,
    businessInvestment: 380,
    govPurchasesReal: 405,
    govInvestmentReal: 60,
    exports: 480,
    imports: 480,
    transfersReal: 175,
    capitalStock: 6000,
    laborForce: 100,
    unemployment: 5.0,
    nairu: 5.0,
    wageGrowth: 6.3,
    productivity: 100,
    humanCapitalIndex: 100,
    infrastructureIndex: 100,
    inflation: 4.0,
    coreInflation: 4.0,
    inflationExpectations: 4.0,
    cbCredibility: 60,
    keyRate: 5.5,
    reserveReq: 6.0,
    capitalRequirement: 10.5,
    fxRegime: 'free',
    lendingRate: 7.92,
    depositRate: 4.3,
    rStar: 1.55,
    riskPremium: 1.4,
    moneySupply: 100,
    exchangeRate: 100,
    realExchangeRate: 100,
    inflationTarget: 4.0,
    fxTarget: 100,
    incomeTaxRate: 15,
    profitTaxRate: 20,
    vatRate: 18,
    exciseRate: 8,
    capitalTaxRate: 13,
    socialContribRate: 22,
    shadowShare: 14,
    budgetShares: {
      health: 19,
      education: 16,
      science: 4,
      defense: 15,
      admin: 12,
      other: 34,
    },
    govDebt: 1200,
    effectiveDebtRate: 6.5,
    sovereignFund: 0,
    creditVolume: 1400,
    bankCapital: 147,
    bankNPL: 3.0,
    bankLiquidity: 70,
    reserves: 300,
    fdi: 40,
    consumerConfidence: 55,
    businessConfidence: 55,
    financialStability: 70,
    govTrust: 55,
    approval: 55,
    quartersToElection: 16,
    term: 1,
    mandate: null,
    governmentLine: 'centrist',
    worldGdpGrowth: 2.5,
    worldInflation: 3.0,
    worldRate: 3.0,
    commodityIndex: 100,
    worldDemandIndex: 100,
    policyCoordination: 70,
  },
  /* Коэффициенты причинных связей. Всё, что относится к «силе» канала, собрано здесь. */
  coef: {
    // денежная трансмиссия
    termPremium: 0.8,
    bankSpreadBase: 1.2,
    lendingPassthrough: { easy: 0.9, medium: 0.62, hard: 0.45 },
    depositSpread: 0.8,
    // кредит
    creditDemandBase: 6.0,
    creditRateSens: 1.15,
    creditConfSens: 0.5,
    creditAccelerator: 0.45,
    creditReserveSens: 0.35,
    creditImpulseToDemand: 0.16,
    // IS
    consInertia: 0.3,
    consIncome: 0.55,
    consRate: 0.3,
    consConf: 0.22,
    consCredit: 0.55,
    invInertia: 0.28,
    invAccelerator: 0.42,
    invRate: 1.25,
    invConf: 0.35,
    invCredit: 0.75,
    invCrowdIn: 0.35,
    invProfitTax: 0.45,
    capacityDrag: 0.3,
    // внешний сектор
    exportWorld: 0.55,
    exportRer: 0.09,
    importIncome: 0.95,
    importRer: 0.07,
    // труд
    okun: 0.45,
    uAdjust: 0.34,
    nairuHysteresis: 0.02,
    wageTightness: 0.8,
    wageExpect: 1.0,
    wageSocial: 0.3,
    // цены
    phillipsLinear: 0.15,
    phillipsConvex: 0.022,
    ulcPass: 0.28,
    fxPass: 0.085,
    commodityPass: 0.012,
    worldInflPass: 0.1,
    vatPass: 0.35,
    expAdaptMin: 0.16,
    expAdaptMax: 0.42,
    // банки
    nplRate: 0.55,
    nplUnemp: 0.35,
    nplGap: 0.4,
    nplCreditBoom: 0.75,
    nplAdjust: 0.2,
    // бюджет
    multPurchases: [0.55, 0.6],
    multTransfers: [0.3, 0.5],
    multInvestment: [0.6, 0.55],
    multTax: [0.45, 0.4],
    // платёжный баланс
    capitalFlowCarry: 11.0,
    capitalFlowConf: 0.9,
    capitalFlowStab: 0.55,
    fxBop: 1.25,
    fxCarry: 0.3,
    // долг
    debtRollover: 0.12,
    debtLevelPremium: 0.035,
  },
  noiseBase: {
    consumption: 0.3,
    investment: 0.7,
    exports: 0.7,
    imports: 0.7,
    inflation: 0.22,
    exchangeRate: 0.9,
    financialStability: 1.0,
    consumerConfidence: 1.1,
    businessConfidence: 1.1,
    reserves: 3,
    fdi: 4,
    unemployment: 0.07,
    wageGrowth: 0.16,
    bankNPL: 0.09,
    productivity: 0.05,
    worldGdpGrowth: 0.2,
    worldInflation: 0.15,
    worldRate: 0.1,
    commodityIndex: 2.0,
    worldDemandIndex: 1.2,
    capitalFlow: 5.0,
  },
  noiseMult: { easy: 0.55, medium: 1.0, hard: 1.55 },
  lagSpread: { easy: [1], medium: [0.55, 0.45], hard: [0.3, 0.4, 0.3] },
  slowSpread: {
    easy: [0.4, 0.6],
    medium: [0.25, 0.4, 0.35],
    hard: [0.15, 0.3, 0.35, 0.2],
  },
  eventProbability: { easy: 0.09, medium: 0.14, hard: 0.2 },
  election: { cycle: 16, campaign: 3 },
  thresholds: {
    bankingRisk: 70,
    debtRisk: 75,
    recessionGapQuarters: 2,
    recessionGap: -2.0,
    overheatGap: 3.5,
    stagflationInflation: 6.5,
    stagflationGap: -1.0,
    currencyMovePct: 11,
    deflation: 0.5,
    carCrunch: 10.5,
  },
};

/* ============================ УТИЛИТЫ ============================ */
let __uid = 1;
const uid = () => `x${__uid++}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const QUARTERS_PER_YEAR = 4;
const annualToQuarterlyFactor = (annualPct) =>
  Math.pow(1 + annualPct / 100, 1 / QUARTERS_PER_YEAR);
const applyAnnualGrowth = (value, annualPct) =>
  value * annualToQuarterlyFactor(annualPct);
const annualizedGrowth = (from, to) =>
  from > 0 && Number.isFinite(from) && Number.isFinite(to)
    ? (Math.pow(Math.max(to, 1e-9) / from, QUARTERS_PER_YEAR) - 1) * 100
    : 0;
const applyNominalGrowth = (value, realAnnualPct, inflationAnnualPct) =>
  value *
  annualToQuarterlyFactor(realAnnualPct) *
  annualToQuarterlyFactor(inflationAnnualPct);
const gauss = (sigma) =>
  sigma * ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5);
const sign = (v) => (v > 0.0001 ? 1 : v < -0.0001 ? -1 : 0);
const ema = (prev, next, w) => prev * (1 - w) + next * w;

const fmt1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const fmtSigned1 = (v) =>
  Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) : '—';
const pctFmt = (v) => `${fmt1(v)}%`;
const fmtSignedPct = (v) => `${fmtSigned1(v)}%`;
const fmtMoney = (bn) => {
  if (!Number.isFinite(bn)) return '—';
  const abs = Math.abs(bn);
  if (abs >= 1000) return `${(bn / 1000).toFixed(2)} трлн`;
  return `${bn.toFixed(0)} млрд`;
};
const fmtMoneySigned = (bn) => (bn >= 0 ? '+' : '') + fmtMoney(bn);
const romanQ = (n) => ['I', 'II', 'III', 'IV'][n - 1] || String(n);
const quarterLabel = (qIndex) => {
  const year = CONFIG.startYear + Math.floor((qIndex - 1) / 4);
  const q = ((qIndex - 1) % 4) + 1;
  return `${romanQ(q)} кв. ${year}`;
};

/* ============================ РОЛИ, ЦЕЛИ, РЫЧАГИ ============================ */
const ROLES = [
  {
    id: 'central_bank',
    icon: 'landmark',
    title: 'Глава Центрального банка',
    short: 'Центральный банк',
    desc: 'Ставка, норматив капитала банков, ликвидность, курс. Бюджетом управляет бот-Минфин.',
    groups: ['monetary'],
    botRole: 'ministry_finance',
  },
  {
    id: 'ministry_finance',
    icon: 'coins',
    title: 'Глава Министерства финансов',
    short: 'Минфин',
    desc: 'Налоги, расходы, выплаты и госинвестиции. Ставкой управляет бот-Центробанк.',
    groups: ['fiscal'],
    botRole: 'central_bank',
  },
  {
    id: 'full_control',
    icon: 'globe',
    title: 'Глава государства',
    short: 'Полное управление',
    desc: 'Обе ветви политики под вашим контролем. Ботов нет — и оправдываться не на кого.',
    groups: ['monetary', 'fiscal'],
    botRole: null,
  },
  {
    id: 'trader',
    icon: 'chart',
    title: 'Частный инвестор',
    short: 'Трейдер',
    desc: 'Вы не управляете экономикой — вы живёте в ней. Ставку ведёт бот-ЦБ, бюджет бот-Минфин, а вы распределяете капитал между активами и отвечаете за результат.',
    groups: [],
    botRole: 'both',
  },
];

const DIFFICULTIES = [
  {
    id: 'easy',
    title: 'Лёгкий',
    desc: 'Быстрая трансмиссия, мягкие шоки, терпеливые ожидания.',
  },
  {
    id: 'medium',
    title: 'Средний',
    desc: 'Реалистичные лаги: решение действует 2–3 квартала.',
  },
  {
    id: 'hard',
    title: 'Сложный',
    desc: 'Длинные лаги, срыв ожиданий, банковские и долговые спирали.',
  },
];

const GOALS = [
  { id: 'max_growth', label: 'Максимальный рост ВВП', score: 'potential' },
  { id: 'min_inflation', label: 'Минимальная инфляция', score: 'stability' },
  {
    id: 'min_unemployment',
    label: 'Минимальная безработица',
    score: 'welfare',
  },
  {
    id: 'debt_reduction',
    label: 'Снижение государственного долга',
    score: 'fiscal',
  },
  {
    id: 'stable_currency',
    label: 'Стабильный курс валюты',
    score: 'financial',
  },
  { id: 'living_standards', label: 'Повышение уровня жизни', score: 'welfare' },
  { id: 'balanced_budget', label: 'Сбалансированный бюджет', score: 'fiscal' },
  { id: 'max_wealth', label: 'Приумножить капитал', score: 'financial' },
];

const FX_REGIMES = [
  {
    id: 'free',
    label: 'Плавающий',
    hint: 'Курс определяется платёжным балансом. Резервы не тратятся, но инфляция импортируется быстрее.',
  },
  {
    id: 'managed',
    label: 'Управляемый',
    hint: 'ЦБ гасит половину давления интервенциями. Умеренный расход резервов.',
  },
  {
    id: 'peg',
    label: 'Фиксированный',
    hint: 'Курс удерживается почти жёстко. При исчерпании резервов — срыв и девальвация.',
  },
];

const LEVERS = [
  {
    id: 'keyRate',
    group: 'monetary',
    subgroup: 'core',
    label: 'Ключевая ставка',
    suffix: '%',
    min: 0,
    max: 25,
    step: 0.25,
    type: 'level',
  },
  {
    id: 'inflationTarget',
    group: 'monetary',
    subgroup: 'core',
    label: 'Цель по инфляции',
    suffix: '%',
    min: 1,
    max: 12,
    step: 0.25,
    type: 'level',
    hint: 'Смена цели стоит доверия: ожидания перестают верить объявленной цифре',
  },
  {
    id: 'reserveReq',
    group: 'monetary',
    subgroup: 'core',
    label: 'Норма резервирования',
    suffix: '%',
    min: 0,
    max: 20,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'capitalRequirement',
    group: 'monetary',
    subgroup: 'macropru',
    label: 'Требование к капиталу банков',
    suffix: '%',
    min: 8,
    max: 18,
    step: 0.5,
    type: 'level',
    hint: 'Макропруденциальный норматив: выше — меньше кредитный бум, но и меньше кредита',
  },
  {
    id: 'moneySupplyOp',
    group: 'monetary',
    subgroup: 'core',
    label: 'Операции с денежной массой',
    suffix: '%',
    min: -10,
    max: 10,
    step: 0.5,
    type: 'flow',
    hint: 'QE (+) / QT (−) за квартал',
  },
  {
    id: 'fxIntervention',
    group: 'monetary',
    subgroup: 'core',
    label: 'Валютные интервенции',
    suffix: ' млрд',
    min: -25,
    max: 25,
    step: 1,
    type: 'flow',
    scale: 'gdp',
    hint: 'Покупка валюты (+) ослабляет нацвалюту, продажа (−) укрепляет и тратит резервы',
  },
  {
    id: 'liquidity',
    group: 'monetary',
    subgroup: 'core',
    label: 'Управление ликвидностью банков',
    suffix: ' млрд',
    min: -20,
    max: 20,
    step: 1,
    type: 'flow',
    scale: 'gdp',
    hint: 'Инъекция (+) / изъятие (−)',
  },
  {
    id: 'fxTarget',
    group: 'monetary',
    subgroup: 'core',
    label: 'Целевой уровень курса',
    suffix: '',
    min: 40,
    max: 400,
    step: 1,
    type: 'level',
    onlyIf: (d) => d.fxRegime !== 'free',
    hint: 'Ориентир, который ЦБ защищает интервенциями. Выше — слабее нацвалюта',
  },

  {
    id: 'incomeTaxRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'Подоходный налог',
    suffix: '%',
    min: 0,
    max: 45,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'socialContribRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'Социальные взносы',
    suffix: '%',
    min: 0,
    max: 40,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'profitTaxRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'Налог на прибыль',
    suffix: '%',
    min: 0,
    max: 45,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'vatRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'НДС',
    suffix: '%',
    min: 0,
    max: 30,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'exciseRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'Акцизы',
    suffix: '%',
    min: 0,
    max: 25,
    step: 0.5,
    type: 'level',
  },
  {
    id: 'capitalTaxRate',
    group: 'fiscal',
    subgroup: 'taxes',
    label: 'Налог на капитал',
    suffix: '%',
    min: 0,
    max: 35,
    step: 0.5,
    type: 'level',
  },

  {
    id: 'govSpending',
    group: 'fiscal',
    subgroup: 'core',
    label: 'Госзакупки и содержание государства',
    suffix: '%',
    min: -10,
    max: 10,
    step: 0.5,
    type: 'flow',
    persistent: true,
    hint: 'Реальный темп роста — действует, пока не измените',
  },
  {
    id: 'transfers',
    group: 'fiscal',
    subgroup: 'core',
    label: 'Социальные выплаты',
    suffix: '%',
    min: -12,
    max: 12,
    step: 0.5,
    type: 'flow',
    persistent: true,
    hint: 'Реальный темп роста — сильный эффект в кризис, слабый при перегреве',
  },
  {
    id: 'govInvestment',
    group: 'fiscal',
    subgroup: 'core',
    label: 'Госинвестиции в инфраструктуру',
    suffix: '%',
    min: -15,
    max: 15,
    step: 0.5,
    type: 'flow',
    persistent: true,
    hint: 'Единственный расход, повышающий потенциальный ВВП',
  },

  {
    id: 'shareHealth',
    group: 'fiscal',
    subgroup: 'budget',
    label: 'Здравоохранение',
    suffix: '%',
    min: 5,
    max: 40,
    step: 1,
    type: 'level',
    hint: 'Доля госзакупок',
  },
  {
    id: 'shareEducation',
    group: 'fiscal',
    subgroup: 'budget',
    label: 'Образование',
    suffix: '%',
    min: 5,
    max: 40,
    step: 1,
    type: 'level',
    hint: 'Долгосрочно — человеческий капитал',
  },
  {
    id: 'shareScience',
    group: 'fiscal',
    subgroup: 'budget',
    label: 'Наука и НИОКР',
    suffix: '%',
    min: 0,
    max: 20,
    step: 1,
    type: 'level',
    hint: 'Долгосрочно — производительность (TFP)',
  },
  {
    id: 'shareDefense',
    group: 'fiscal',
    subgroup: 'budget',
    label: 'Оборона',
    suffix: '%',
    min: 2,
    max: 40,
    step: 1,
    type: 'level',
  },
  {
    id: 'shareAdmin',
    group: 'fiscal',
    subgroup: 'budget',
    label: 'Госаппарат',
    suffix: '%',
    min: 2,
    max: 30,
    step: 1,
    type: 'level',
  },
];

const UNCERTAINTY = {
  keyRate: 'средняя',
  reserveReq: 'средняя',
  capitalRequirement: 'средняя',
  moneySupplyOp: 'высокая',
  fxIntervention: 'средняя',
  liquidity: 'средняя',
  incomeTaxRate: 'средняя',
  profitTaxRate: 'высокая',
  vatRate: 'низкая',
  exciseRate: 'низкая',
  capitalTaxRate: 'высокая',
  socialContribRate: 'средняя',
  govSpending: 'низкая',
  transfers: 'низкая',
  govInvestment: 'высокая',
  shareHealth: 'высокая',
  shareEducation: 'высокая',
  shareScience: 'высокая',
  shareDefense: 'низкая',
  shareAdmin: 'низкая',
};

function defaultDecisions(state, prevDecisions) {
  return {
    keyRate: state.keyRate,
    reserveReq: state.reserveReq,
    capitalRequirement: state.capitalRequirement,
    moneySupplyOp: 0,
    fxIntervention: 0,
    liquidity: 0,
    fxRegime: state.fxRegime,
    emergency: false,
    inflationTarget: state.inflationTarget,
    fxTarget: state.fxTarget,
    incomeTaxRate: state.incomeTaxRate,
    profitTaxRate: state.profitTaxRate,
    vatRate: state.vatRate,
    exciseRate: state.exciseRate,
    capitalTaxRate: state.capitalTaxRate,
    socialContribRate: state.socialContribRate,
    govSpending: prevDecisions ? prevDecisions.govSpending : 0,
    transfers: prevDecisions ? prevDecisions.transfers : 0,
    govInvestment: prevDecisions ? prevDecisions.govInvestment : 0,
    shareHealth: state.budgetShares.health,
    shareEducation: state.budgetShares.education,
    shareScience: state.budgetShares.science,
    shareDefense: state.budgetShares.defense,
    shareAdmin: state.budgetShares.admin,
  };
}

/* =========================================================================================
   БОТЫ: ведомство, которым вы не управляете, ведёт собственную политику
========================================================================================= */
const CB_PERSONAS = [
  {
    id: 'hawk',
    name: 'Ястреб',
    title: 'Бескомпромиссный инфляционный таргетёр',
    infl: 2.1,
    gap: 0.25,
    smooth: 0.7,
    maxMove: 1.75,
    tolerance: 0.7,
    fiscalLean: 0.35,
    macropru: 1.0,
    desc: 'Ставит цель по инфляции выше занятости. Жёстко реагирует на бюджетную экспансию.',
  },
  {
    id: 'pragmatic',
    name: 'Прагматик',
    title: 'Гибкое таргетирование инфляции',
    infl: 1.5,
    gap: 0.6,
    smooth: 0.74,
    maxMove: 1.25,
    tolerance: 1.2,
    fiscalLean: 0.2,
    macropru: 0.6,
    desc: 'Балансирует инфляцию и выпуск, сглаживает траекторию ставки.',
  },
  {
    id: 'dove',
    name: 'Голубь',
    title: 'Приоритет занятости и роста',
    infl: 1.05,
    gap: 1.0,
    smooth: 0.82,
    maxMove: 0.75,
    tolerance: 2.2,
    fiscalLean: 0.05,
    macropru: 0.3,
    desc: 'Терпит инфляцию ради роста. Рискует потерей доверия и срывом ожиданий.',
  },
];

const MOF_PERSONAS = [
  {
    id: 'technocrat',
    name: 'Технократ',
    title: 'Бюджетное правило и инвестиции',
    anchor: -2.0,
    cyclical: 0.55,
    taxWill: 0.6,
    debtLimit: 75,
    transferBias: 0.8,
    investBias: 1.4,
    shares: { health: 19, education: 20, science: 7, defense: 13, admin: 10 },
    desc: 'Держит дефицит у правила, в кризис умеренно стимулирует, вкладывается в образование и науку.',
  },
  {
    id: 'austerity',
    name: 'Консерватор',
    title: 'Жёсткая бюджетная дисциплина',
    anchor: -0.5,
    cyclical: 0.22,
    taxWill: 0.3,
    debtLimit: 60,
    transferBias: 0.4,
    investBias: 0.6,
    shares: { health: 16, education: 13, science: 3, defense: 18, admin: 12 },
    desc: 'Сокращает дефицит любой ценой. Усиливает рецессии, зато долг под контролем.',
  },
  {
    id: 'populist',
    name: 'Популист',
    title: 'Социальные расходы прежде всего',
    anchor: -4.5,
    cyclical: 0.95,
    taxWill: 0.75,
    debtLimit: 105,
    transferBias: 2.2,
    investBias: 0.9,
    shares: { health: 24, education: 17, science: 2, defense: 14, admin: 13 },
    desc: 'Наращивает выплаты и расходы, налоги повышает на бизнес. Источник инфляции и долга.',
  },
];

const getCbPersona = (id) =>
  CB_PERSONAS.find((p) => p.id === id) || CB_PERSONAS[1];
// какой характер получает ведомство, назначенное новой властью
function personaAfterElection(kind, economy) {
  const line = economy.governmentLine || 'centrist';
  if (kind === 'ministry_finance')
    return line === 'populist'
      ? 'populist'
      : line === 'austerity'
      ? 'austerity'
      : 'technocrat';
  return line === 'populist'
    ? 'dove'
    : line === 'austerity'
    ? 'hawk'
    : 'pragmatic';
}
const MANDATE_LABEL = {
  jobs: 'занятость любой ценой',
  prices: 'обуздать цены',
  budget: 'привести бюджет в порядок',
  growth: 'вернуть рост',
};
const getMofPersona = (id) =>
  MOF_PERSONAS.find((p) => p.id === id) || MOF_PERSONAS[0];

// Бот-ЦБ: правило Тейлора вокруг нейтральной ставки + макропруденциальная и кризисная реакция
const roundTo = (v, step) => Math.round(v / step) * step;
function botCentralBank(s, personaId, difficulty) {
  const P = getCbPersona(personaId);
  const cbTarget = Number.isFinite(s.inflationTarget)
    ? s.inflationTarget
    : CONFIG.target.inflation;
  const inflGap = s.inflation - cbTarget;
  const effInflGap = Math.abs(inflGap) < P.tolerance ? inflGap * 0.35 : inflGap;
  const overheat = Math.max(0, s.outputGap - 1.5);
  const taylor =
    s.rStar +
    s.inflationExpectations +
    P.infl * effInflGap +
    P.gap * s.outputGap +
    P.fiscalLean * 2.2 * (s.fiscalImpulse || 0) +
    0.45 * overheat +
    (s.cbCredibility < 45 ? 0.8 : 0) +
    0.25 * Math.max(0, s.inflationExpectations - cbTarget - 1);
  const smoothed = P.smooth * s.keyRate + (1 - P.smooth) * taylor;
  const rawMove = clamp(smoothed - s.keyRate, -P.maxMove, P.maxMove);
  // ЦБ ходит шагами по 0,25 п.п. и не двигает ставку ради десятых долей
  const move = Math.abs(rawMove) < 0.25 ? 0 : roundTo(rawMove, 0.25);
  let keyRate = clamp(roundTo(s.keyRate + move, 0.25), 0, 25);

  const fxRegimeCur = s.fxRegime;
  const fxTargetCur = s.fxTarget;
  const crisis =
    s.bankingRisk >= CONFIG.thresholds.bankingRisk || s.bankCapitalAdequacy < 9;
  const emergency = crisis;
  let liquidity = 0;
  if (s.bankLiquidity < 45) liquidity = 12;
  else if (s.bankLiquidity < 58) liquidity = 6;
  if (crisis) liquidity = Math.max(liquidity, 14);

  let moneySupplyOp = 0;
  if (keyRate < 0.8 && s.outputGap < -2) moneySupplyOp = 2.5;
  if (s.outputGap > 3 && s.inflation > 7) moneySupplyOp = -2;

  let fxIntervention = 0;
  const fxRegime = s.fxRegime;
  if (s.regime === 'currency' && s.reserves > 120) fxIntervention = -10;

  let capitalRequirement = s.capitalRequirement;
  if (s.creditGap > 6)
    capitalRequirement = clamp(s.capitalRequirement + 0.5 * P.macropru, 8, 18);
  else if (s.creditGap < -4 && s.capitalRequirement > 10.5)
    capitalRequirement = clamp(s.capitalRequirement - 0.5, 8, 18);

  // норма резервирования как второй инструмент
  let reserveReq = s.reserveReq;
  if (s.creditGap > 7 && s.reserveReq < 12)
    reserveReq = clamp(s.reserveReq + 1, 0, 20);
  else if ((s.creditCrunch || s.bankLiquidity < 50) && s.reserveReq > 3)
    reserveReq = clamp(s.reserveReq - 1, 0, 20);

  const parts = [];
  if (Math.abs(keyRate - s.keyRate) > 0.05)
    parts.push(
      `${
        keyRate > s.keyRate ? 'повысил' : 'снизил'
      } ключевую ставку до ${keyRate.toFixed(2)}%`
    );
  else parts.push(`сохранил ключевую ставку на уровне ${keyRate.toFixed(2)}%`);
  if (Math.abs(reserveReq - s.reserveReq) > 0.05)
    parts.push(`изменил норму резервирования до ${reserveReq.toFixed(1)}%`);
  if (liquidity > 0)
    parts.push(`предоставил банкам ликвидность (${liquidity} млрд)`);
  if (emergency) parts.push('запустил экстренную поддержку банков');
  if (Math.abs(capitalRequirement - s.capitalRequirement) > 0.05)
    parts.push(
      `изменил норматив капитала до ${capitalRequirement.toFixed(1)}%`
    );
  if (fxIntervention < 0)
    parts.push('вышел на валютный рынок в поддержку курса');
  if (moneySupplyOp !== 0)
    parts.push(
      moneySupplyOp > 0 ? 'начал выкуп активов' : 'начал изъятие ликвидности'
    );

  let demand = null;
  if ((s.fiscalImpulse || 0) > 0.6 && s.outputGap > 1.0) {
    demand = `Центральный банк требует немедленно прекратить наращивание бюджетного импульса: разрыв выпуска уже ${fmtSigned1(
      s.outputGap
    )}%, и каждый дополнительный рубль расходов ЦБ будет вынужден компенсировать ставкой.`;
  } else if (s.outputGap > 2.5) {
    demand = `Центральный банк указывает на перегрев (разрыв выпуска ${fmtSigned1(
      s.outputGap
    )}%): без бюджетной консолидации подавить инфляцию можно будет только ценой рецессии.`;
  } else if (s.budgetBalancePctGdp < -5) {
    demand = `Центральный банк требует сократить дефицит (${fmt1(
      Math.abs(s.budgetBalancePctGdp)
    )}% ВВП): бюджетный импульс вынуждает держать ставку выше.`;
  } else if (s.inflation > 7 && (s.fiscalImpulse || 0) > 0.3) {
    demand =
      'Центральный банк предупреждает: бюджетная экспансия при такой инфляции будет полностью компенсирована ставкой.';
  } else if (s.debtToGdp > 90) {
    demand =
      'Центральный банк указывает на долговую нагрузку — премия за риск растёт вместе с ней.';
  }

  const stance = clamp(
    (keyRate - s.inflationExpectations - s.rStar) / 3,
    -1,
    1
  );
  return {
    decisions: {
      keyRate,
      reserveReq,
      capitalRequirement,
      moneySupplyOp,
      fxIntervention,
      liquidity,
      fxRegime,
      emergency,
      inflationTarget: cbTarget,
      fxTarget: fxTargetCur,
    },
    detail: [
      `ставка ${keyRate.toFixed(2)}% (реальная ${fmtSigned1(
        keyRate - s.inflationExpectations
      )}% при нейтральной ${fmt1(s.rStar)}%)`,
      `цель по инфляции ${cbTarget.toFixed(2)}%, фактическая ${fmt1(
        s.inflation
      )}%`,
      `норма резервирования ${reserveReq.toFixed(
        1
      )}%, норматив капитала ${capitalRequirement.toFixed(1)}%`,
      `ликвидность банкам ${
        liquidity ? `+${liquidity} млрд` : 'не предоставлялась'
      }, режим курса ${
        fxRegime === 'free'
          ? 'плавающий'
          : fxRegime === 'managed'
          ? 'управляемый'
          : 'фиксированный'
      }`,
    ],
    note: `Центральный банк (${P.name}) ${parts.join(', ')}.`,
    demand,
    stance,
    institution: 'cb',
    headline:
      keyRate > s.keyRate + 0.05
        ? 'ужесточение'
        : keyRate < s.keyRate - 0.05
        ? 'смягчение'
        : 'без изменений',
    newsHeadline: `ЦБ ${
      keyRate > s.keyRate + 0.05
        ? 'УЖЕСТОЧАЕТ ПОЛИТИКУ'
        : keyRate < s.keyRate - 0.05
        ? 'СМЯГЧАЕТ ПОЛИТИКУ'
        : 'СОХРАНЯЕТ КУРС'
    }: СТАВКА ${ru(keyRate.toFixed(2))}%`,
  };
}

// Бот-Минфин: бюджетное правило + контрциклическая реакция + собственные приоритеты расходов
function botFinanceMinistry(s, personaId, difficulty) {
  const P = getMofPersona(personaId);
  const debtStress = clamp((s.debtToGdp - P.debtLimit) / 20, 0, 2);
  const targetDeficit =
    P.anchor - P.cyclical * Math.max(0, -s.outputGap) * 1.1 + debtStress * 2.2;
  const consolidationNeed = targetDeficit - s.budgetBalancePctGdp; // >0 => надо ужесточать

  const base = -1.0 * clamp(consolidationNeed, -3, 3);
  const dead = (v) => (Math.abs(v) < 0.5 ? 0 : roundTo(v, 0.5));
  let govSpending = clamp(
    base + 0.35 * Math.max(0, -s.outputGap) * P.cyclical,
    -4,
    4
  );
  let transfers = clamp(
    0.4 * P.transferBias * Math.max(0, s.unemployment - 5) +
      (P.id === 'populist' ? 1.2 : 0) -
      1.1 * Math.max(0, consolidationNeed),
    -5,
    7
  );
  let govInvestment = clamp(
    P.investBias * (1.2 - 0.9 * Math.max(0, consolidationNeed)) +
      0.4 * Math.max(0, -s.outputGap),
    -5,
    6
  );
  if (s.inflation > 8 && P.id !== 'populist') {
    govSpending -= 0.8;
    transfers -= 0.6;
  }
  // политический цикл: перед выборами бюджет щедрее, сразу после — жёстче
  const toVote = Number.isFinite(s.quartersToElection)
    ? s.quartersToElection
    : 16;
  if (toVote <= CONFIG.election.campaign) {
    transfers += 1.5 * (P.id === 'populist' ? 1.6 : 1);
    govSpending += 0.7;
  } else if (toVote >= CONFIG.election.cycle - 2) {
    transfers -= 0.8;
    govSpending -= 0.5;
  }
  govSpending = dead(govSpending);
  transfers = dead(transfers);
  govInvestment = dead(govInvestment);

  const taxStep = 0.5 * P.taxWill;
  let incomeTaxRate = s.incomeTaxRate;
  let vatRate = s.vatRate;
  let profitTaxRate = s.profitTaxRate;
  let capitalTaxRate = s.capitalTaxRate;
  let socialContribRate = s.socialContribRate;
  let exciseRate = s.exciseRate;
  if (consolidationNeed > 1.5) {
    if (P.id === 'populist') {
      profitTaxRate = clamp(profitTaxRate + taxStep, 0, 45);
      capitalTaxRate = clamp(capitalTaxRate + taxStep, 0, 35);
    } else if (P.id === 'technocrat') {
      vatRate = clamp(vatRate + taxStep, 0, 30);
      exciseRate = clamp(exciseRate + taxStep, 0, 25);
    } else {
      vatRate = clamp(vatRate + taxStep * 0.6, 0, 30);
      incomeTaxRate = clamp(incomeTaxRate + taxStep * 0.6, 0, 45);
    }
  } else if (consolidationNeed < -2 && s.outputGap < 0) {
    if (P.id === 'populist')
      incomeTaxRate = clamp(incomeTaxRate - taxStep, 0, 45);
    else profitTaxRate = clamp(profitTaxRate - taxStep, 0, 45);
  }

  const drift = (cur, tgt) =>
    Math.abs(tgt - cur) < 1
      ? cur
      : clamp(Math.round(cur + clamp(tgt - cur, -1, 1)), 0, 45);
  const shareHealth = drift(s.budgetShares.health, P.shares.health);
  const shareEducation = drift(s.budgetShares.education, P.shares.education);
  const shareScience = drift(s.budgetShares.science, P.shares.science);
  const shareDefense = drift(s.budgetShares.defense, P.shares.defense);
  const shareAdmin = drift(s.budgetShares.admin, P.shares.admin);

  const parts = [];
  if (Math.abs(govSpending) > 0.15)
    parts.push(
      `${govSpending > 0 ? 'нарастил' : 'сократил'} госзакупки (${fmtSigned1(
        govSpending
      )}%)`
    );
  if (Math.abs(transfers) > 0.15)
    parts.push(
      `${transfers > 0 ? 'повысил' : 'урезал'} социальные выплаты (${fmtSigned1(
        transfers
      )}%)`
    );
  if (Math.abs(govInvestment) > 0.15)
    parts.push(
      `${
        govInvestment > 0 ? 'увеличил' : 'сократил'
      } госинвестиции (${fmtSigned1(govInvestment)}%)`
    );
  if (Math.abs(vatRate - s.vatRate) > 0.05)
    parts.push(`изменил НДС до ${vatRate.toFixed(1)}%`);
  if (Math.abs(profitTaxRate - s.profitTaxRate) > 0.05)
    parts.push(`изменил налог на прибыль до ${profitTaxRate.toFixed(1)}%`);
  if (Math.abs(incomeTaxRate - s.incomeTaxRate) > 0.05)
    parts.push(`изменил подоходный налог до ${incomeTaxRate.toFixed(1)}%`);
  if (!parts.length) parts.push('оставил бюджетные параметры без изменений');

  let demand = null;
  if (s.lendingRate - s.inflation > 6)
    demand =
      'Минфин требует от ЦБ снизить ставку: стоимость обслуживания долга и кредита душит экономику.';
  else if (s.unemployment > 7.5)
    demand =
      'Минфин настаивает на смягчении денежной политики — безработица выше приемлемого уровня.';
  else if (s.inflation > 8 && P.id !== 'populist')
    demand =
      'Минфин просит ЦБ решительнее подавить инфляцию: она обесценивает бюджетные расходы.';

  const stance = clamp(
    (govSpending + transfers * 0.6 + govInvestment * 0.8) / 6 -
      (vatRate - s.vatRate) * 0.3,
    -1,
    1
  );
  return {
    decisions: {
      incomeTaxRate,
      profitTaxRate,
      vatRate,
      exciseRate,
      capitalTaxRate,
      socialContribRate,
      govSpending,
      transfers,
      govInvestment,
      shareHealth,
      shareEducation,
      shareScience,
      shareDefense,
      shareAdmin,
    },
    note: `Минфин (${P.name}) ${parts.join(', ')}.`,
    demand,
    stance,
    institution: 'gov',
    detail: [
      `госзакупки ${fmtSigned1(govSpending)}% к тренду, выплаты ${fmtSigned1(
        transfers
      )}%, инвестиции ${fmtSigned1(govInvestment)}%`,
      `НДС ${vatRate.toFixed(1)}%, прибыль ${profitTaxRate.toFixed(
        1
      )}%, подоходный ${incomeTaxRate.toFixed(1)}%`,
      `цель по балансу ${fmt1(targetDeficit)}% ВВП при текущем ${fmt1(
        s.budgetBalancePctGdp
      )}%`,
      `приоритеты: здравоохранение ${shareHealth.toFixed(
        0
      )}%, образование ${shareEducation.toFixed(
        0
      )}%, наука ${shareScience.toFixed(0)}%`,
    ],
    headline:
      stance > 0.15
        ? 'стимулирование'
        : stance < -0.15
        ? 'консолидация'
        : 'нейтрально',
    newsHeadline: `МИНФИН: ${
      stance > 0.15
        ? 'КУРС НА СТИМУЛИРОВАНИЕ ЭКОНОМИКИ'
        : stance < -0.15
        ? 'КУРС НА БЮДЖЕТНУЮ КОНСОЛИДАЦИЮ'
        : 'БЮДЖЕТНАЯ ПОЛИТИКА БЕЗ ИЗМЕНЕНИЙ'
    }`,
  };
}

/* =========================================================================================
   МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ: официальное обращение одного ведомства к другому
========================================================================================= */
const REQUESTS = [
  {
    id: 'infra_up',
    from: 'central_bank',
    label: 'Нарастить госинвестиции',
    ask: 'Просим увеличить расходы на инфраструктуру на 1,5% ВВП для поддержки совокупного спроса.',
    fit: (s) =>
      (s.outputGap < -1 ? 1.5 : s.outputGap > 1.5 ? -1.6 : 0.1) +
      (s.debtToGdp > 85 ? -0.9 : 0.2),
    bias: { technocrat: 0.7, populist: 0.5, austerity: -0.7 },
    apply: (d, k) => ({
      govInvestment: clamp(d.govInvestment + 3 * k, -15, 15),
    }),
    yes: 'Минфин согласен: инфраструктурная программа будет расширена уже в этом квартале.',
    partial:
      'Минфин готов на половину запрошенного — бюджетное правило не позволяет больше.',
    no: 'Минфин отказывает: наращивать расходы при нынешнем состоянии бюджета он не намерен.',
  },
  {
    id: 'deficit_cut',
    from: 'central_bank',
    label: 'Сократить дефицит бюджета',
    ask: 'Требуем сокращения бюджетного импульса: он вынуждает нас держать ставку выше, чем требовалось бы.',
    fit: (s) =>
      (s.budgetBalancePctGdp < -4 ? 1.4 : 0.2) +
      (s.outputGap > 1 ? 0.8 : -0.3) +
      (s.inflation > 6 ? 0.6 : 0),
    bias: { technocrat: 0.6, austerity: 1.0, populist: -0.9 },
    apply: (d, k) => ({
      govSpending: clamp(d.govSpending - 2 * k, -10, 10),
      transfers: clamp(d.transfers - 1.5 * k, -12, 12),
    }),
    yes: 'Минфин соглашается на консолидацию: расходы будут урезаны.',
    partial: 'Минфин идёт на частичное сокращение, защитив социальные статьи.',
    no: 'Минфин отвечает, что сокращать расходы в текущей ситуации политически невозможно.',
  },
  {
    id: 'transfers_freeze',
    from: 'central_bank',
    label: 'Заморозить рост социальных выплат',
    ask: 'Просим приостановить индексацию выплат: их рост напрямую транслируется в потребительский спрос и цены.',
    fit: (s) =>
      (s.inflation > 6 ? 1.3 : -0.4) + (s.unemployment > 7 ? -1.0 : 0.3),
    bias: { austerity: 1.0, technocrat: 0.3, populist: -1.4 },
    apply: (d, k) => ({
      transfers: clamp(Math.min(d.transfers, 0) - 1.0 * k, -12, 12),
    }),
    yes: 'Минфин замораживает индексацию выплат до нормализации инфляции.',
    partial:
      'Минфин ограничивает рост выплат, но полной заморозки не допускает.',
    no: 'Минфин отвечает, что заморозка выплат при текущем положении людей исключена.',
  },
  {
    id: 'tax_relief_business',
    from: 'central_bank',
    label: 'Снизить налог на прибыль',
    ask: 'Предлагаем снизить налог на прибыль: инвестиции сдерживаются и стоимостью денег, и налоговой нагрузкой сразу.',
    fit: (s) =>
      (s.investmentGrowth < 0 ? 1.2 : 0) +
      (s.budgetBalancePctGdp > -3 ? 0.5 : -0.9),
    bias: { technocrat: 0.4, austerity: 0.2, populist: -0.8 },
    apply: (d, k) => ({ profitTaxRate: clamp(d.profitTaxRate - 2 * k, 0, 45) }),
    yes: 'Минфин снижает налог на прибыль, рассчитывая вернуть выпадающие доходы ростом базы.',
    partial: 'Минфин идёт на символическое снижение ставки.',
    no: 'Минфин отказывается: выпадающие доходы нечем закрыть.',
  },
  {
    id: 'rate_cut',
    from: 'ministry_finance',
    label: 'Снизить ключевую ставку',
    ask: 'Просим снизить ключевую ставку на 1 п.п.: стоимость кредита душит инвестиции и обслуживание долга.',
    fit: (s) =>
      (s.outputGap < -1 ? 1.3 : -0.6) +
      (s.inflation < s.inflationTarget + 1 ? 0.9 : -1.4) +
      (s.unemployment > 7 ? 0.6 : 0),
    bias: { dove: 0.9, pragmatic: 0.2, hawk: -0.9 },
    apply: (d, k) => ({
      keyRate: clamp(Math.round((d.keyRate - 1 * k) / 0.25) * 0.25, 0, 25),
    }),
    yes: 'Центральный банк соглашается и снижает ставку — инфляционная картина это позволяет.',
    partial: 'Центральный банк снижает ставку вдвое меньше запрошенного.',
    no: 'Центральный банк отказывает: снижение ставки при текущей инфляции стоило бы доверия к цели.',
  },
  {
    id: 'rate_hold',
    from: 'ministry_finance',
    label: 'Не повышать ставку',
    ask: 'Просим воздержаться от повышения ставки: бюджет и без того несёт растущие процентные расходы.',
    fit: (s) =>
      (s.inflation < s.inflationTarget + 2 ? 0.9 : -1.5) +
      (s.interestToRevenue > 14 ? 0.8 : 0),
    bias: { dove: 0.8, pragmatic: 0.1, hawk: -1.0 },
    apply: (d, k) => ({ keyRate: d.keyRate }),
    yes: 'Центральный банк берёт паузу в ужесточении.',
    partial:
      'Центральный банк обещает действовать осторожнее, но связывать себе руки не готов.',
    no: 'Центральный банк отвечает, что независимость политики не обсуждается.',
  },
  {
    id: 'liquidity_help',
    from: 'ministry_finance',
    label: 'Поддержать ликвидность банков',
    ask: 'Просим предоставить банковской системе ликвидность: кредитование останавливается, страдают предприятия.',
    fit: (s) =>
      (s.bankLiquidity < 60 ? 1.4 : -0.3) +
      (s.creditCrunch ? 1.0 : 0) +
      (s.inflation > 8 ? -0.7 : 0.2),
    bias: { dove: 0.6, pragmatic: 0.5, hawk: 0.1 },
    apply: (d, k) => ({ liquidity: clamp(d.liquidity + 12 * k, -100, 200) }),
    yes: 'Центральный банк открывает окно ликвидности для банков.',
    partial: 'Центральный банк предоставляет ограниченный объём ликвидности.',
    no: 'Центральный банк считает поддержку преждевременной.',
  },
  {
    id: 'capreq_ease',
    from: 'ministry_finance',
    label: 'Смягчить норматив капитала',
    ask: 'Просим временно смягчить требование к капиталу банков, чтобы разблокировать кредитование экономики.',
    fit: (s) =>
      (s.creditCrunch ? 1.5 : -0.5) +
      (s.creditGap > 5 ? -1.2 : 0.3) +
      (s.bankNPL > 8 ? -0.8 : 0),
    bias: { dove: 0.5, pragmatic: 0.1, hawk: -0.8 },
    apply: (d, k) => ({
      capitalRequirement: clamp(d.capitalRequirement - 1.0 * k, 8, 18),
    }),
    yes: 'Центральный банк временно снижает норматив, признавая остроту кредитного сжатия.',
    partial: 'Центральный банк идёт на минимальное послабление.',
    no: 'Центральный банк отказывает: ослабление норматива в такой момент готовит следующий кризис.',
  },
  {
    id: 'fx_support',
    from: 'ministry_finance',
    label: 'Поддержать курс интервенциями',
    ask: 'Просим выйти на валютный рынок: ослабление курса разгоняет цены и стоимость импорта для бюджета.',
    fit: (s) =>
      (s.fxDeprAnnual > 6 ? 1.3 : -0.6) + (s.reserves > 200 ? 0.5 : -1.0),
    bias: { hawk: 0.5, pragmatic: 0.3, dove: 0.0 },
    apply: (d, k) => ({
      fxIntervention: clamp(d.fxIntervention - 12 * k, -400, 400),
    }),
    yes: 'Центральный банк выходит на рынок в поддержку курса.',
    partial: 'Центральный банк проводит ограниченные интервенции.',
    no: 'Центральный банк отвечает, что тратить резервы против фундаментальных факторов бессмысленно.',
  },
];
function processRequest(reqId, economy, botKind, personaId, decisions) {
  const req = REQUESTS.find((r) => r.id === reqId);
  if (!req) return null;
  const persona =
    botKind === 'central_bank'
      ? getCbPersona(personaId)
      : getMofPersona(personaId);
  const score =
    req.fit(economy) +
    (req.bias[persona.id] || 0) +
    (economy.policyCoordination > 70
      ? 0.3
      : economy.policyCoordination < 35
      ? -0.4
      : 0);
  const status =
    score >= 1.0 ? 'accepted' : score >= 0.1 ? 'partial' : 'rejected';
  const k = status === 'accepted' ? 1 : status === 'partial' ? 0.5 : 0;
  return {
    req,
    status,
    score,
    decisions: k > 0 ? { ...decisions, ...req.apply(decisions, k) } : decisions,
    text:
      status === 'accepted'
        ? req.yes
        : status === 'partial'
        ? req.partial
        : req.no,
    coordination: status === 'accepted' ? 9 : status === 'partial' ? 4 : -7,
  };
}

/* =========================================================================================
   СОБЫТИЯ. kind: demand | supply | financial | external | structural
========================================================================================= */
const EVENTS = [
  {
    id: 'global_crisis',
    kind: 'external',
    title: 'Мировой экономический кризис',
    weight: 3,
    cooldown: 10,
    news: 'Замедление мировой экономики ударило по внешнему спросу и настроениям инвесторов.',
    spread: [0.4, 0.35, 0.25],
    build: () => [
      ['exportsGrowth', -7],
      ['investment', -4],
      ['businessConfidence', -14],
      ['consumerConfidence', -10],
      ['financialStability', -8],
      ['worldGdpGrowth', -1.8],
      ['worldDemandIndex', -8],
      ['capitalFlow', -18],
    ],
  },
  {
    id: 'oil_up',
    kind: 'supply',
    title: 'Рост мировых цен на сырьё',
    weight: 4,
    cooldown: 4,
    spread: [0.6, 0.4],
    build: (s) =>
      s.exports - s.imports >= 0
        ? {
            news: 'Рост цен на сырьё увеличил экспортную выручку и укрепил платёжный баланс.',
            list: [
              ['exportsGrowth', 5],
              ['commodityIndex', 10],
              ['capitalFlow', 8],
            ],
          }
        : {
            news: 'Рост цен на сырьё поднял издержки производства и разогнал инфляцию предложения.',
            list: [
              ['inflationSupply', 1.1],
              ['commodityIndex', 10],
              ['consumerConfidence', -5],
              ['potentialShock', -0.25],
            ],
          },
  },
  {
    id: 'commodity_down',
    kind: 'supply',
    title: 'Падение цен на сырьё',
    weight: 4,
    cooldown: 4,
    spread: [0.6, 0.4],
    build: (s) =>
      s.exports - s.imports >= 0
        ? {
            news: 'Падение цен на сырьё сократило экспортную выручку и ослабило платёжный баланс.',
            list: [
              ['exportsGrowth', -5],
              ['commodityIndex', -10],
              ['capitalFlow', -7],
            ],
          }
        : {
            news: 'Падение цен на сырьё снизило издержки и ослабило инфляционное давление.',
            list: [
              ['inflationSupply', -0.8],
              ['commodityIndex', -10],
              ['consumerConfidence', 2],
            ],
          },
  },
  {
    id: 'supply_chain',
    kind: 'supply',
    title: 'Разрыв цепочек поставок',
    weight: 3,
    cooldown: 8,
    news: 'Сбои поставок подняли издержки и сократили производственные возможности экономики.',
    spread: [0.5, 0.3, 0.2],
    build: () => [
      ['inflationSupply', 2.0],
      ['potentialShock', -0.8],
      ['productivity', -0.6],
      ['businessConfidence', -7],
    ],
  },
  {
    id: 'financial_crisis',
    kind: 'financial',
    title: 'Глобальный финансовый кризис',
    weight: 2,
    cooldown: 12,
    news: 'Глобальная нестабильность спровоцировала бегство капитала из рискованных активов.',
    spread: [0.5, 0.3, 0.2],
    build: () => [
      ['financialStability', -16],
      ['fdi', -25],
      ['capitalFlow', -35],
      ['riskPremium', 1.2],
      ['businessConfidence', -10],
    ],
  },
  {
    id: 'bank_run',
    kind: 'financial',
    title: 'Паника вкладчиков',
    weight: 2,
    cooldown: 10,
    eligible: (s) => s.financialStability < 58 || s.bankNPL > 6,
    weightFn: (s) =>
      s.financialStability < 42 ? 5 : s.financialStability < 58 ? 2.5 : 0,
    news: 'Отток депозитов обрушил ликвидность банков и парализовал кредитование.',
    spread: [0.7, 0.3],
    build: () => [
      ['bankLiquidity', -22],
      ['bankNPL', 1.2],
      ['financialStability', -18],
      ['investment', -4],
    ],
  },
  {
    id: 'deflation_risk',
    kind: 'demand',
    title: 'Провал внутреннего спроса',
    weight: 2,
    cooldown: 8,
    eligible: (s) => s.inflation < 2.5,
    news: 'Слабый спрос и осторожность домохозяйств создали риск дефляционной спирали.',
    spread: [0.5, 0.5],
    build: () => [
      ['consumption', -2.2],
      ['investment', -2.0],
      ['consumerConfidence', -8],
      ['inflationSupply', -0.6],
    ],
  },
  {
    id: 'pandemic',
    kind: 'supply',
    title: 'Пандемия',
    weight: 1,
    cooldown: 20,
    news: 'Вспышка заболевания одновременно сократила спрос и производственные возможности.',
    spread: [0.5, 0.3, 0.2],
    build: () => [
      ['consumption', -6],
      ['investment', -6],
      ['unemployment', 1.6],
      ['potentialShock', -1.2],
      ['consumerConfidence', -16],
      ['worldGdpGrowth', -1.4],
      ['inflationSupply', 0.8],
    ],
  },
  {
    id: 'geopolitical',
    kind: 'external',
    title: 'Геополитический кризис',
    weight: 2,
    cooldown: 10,
    news: 'Геополитическая напряжённость встревожила инвесторов и подняла издержки.',
    spread: [0.5, 0.5],
    build: () => [
      ['businessConfidence', -10],
      ['fdi', -15],
      ['capitalFlow', -22],
      ['riskPremium', 0.9],
      ['inflationSupply', 0.7],
    ],
  },
  {
    id: 'sanctions',
    kind: 'external',
    title: 'Введение санкций',
    weight: 1.5,
    cooldown: 16,
    news: 'Внешние ограничения нарушили торговые и финансовые потоки.',
    spread: [0.4, 0.35, 0.25],
    build: () => [
      ['exportsGrowth', -7],
      ['importsGrowth', -5],
      ['capitalFlow', -30],
      ['fdi', -18],
      ['inflationSupply', 1.1],
      ['potentialShock', -0.7],
      ['riskPremium', 1.0],
    ],
  },
  {
    id: 'global_rate_hike',
    kind: 'external',
    title: 'Рост мировых процентных ставок',
    weight: 3,
    cooldown: 6,
    news: 'Ужесточение политики крупнейших центробанков спровоцировало отток капитала.',
    spread: [0.6, 0.4],
    build: () => [
      ['worldRate', 1.4],
      ['capitalFlow', -20],
      ['fdi', -8],
    ],
  },
  {
    id: 'capital_inflow',
    kind: 'financial',
    title: 'Резкий приток капитала',
    weight: 3,
    cooldown: 6,
    news: 'Инвесторы нарастили вложения — дешёвые деньги хлынули в экономику.',
    spread: [0.6, 0.4],
    build: () => [
      ['capitalFlow', 28],
      ['fdi', 15],
      ['financialStability', -3],
      ['investment', 1.5],
    ],
  },
  {
    id: 'tech_breakthrough',
    kind: 'structural',
    title: 'Технологический скачок',
    weight: 2,
    cooldown: 12,
    news: 'Внедрение новых технологий повысило совокупную производительность.',
    spread: [0.3, 0.4, 0.3],
    build: () => [
      ['productivity', 1.6],
      ['businessConfidence', 8],
      ['investment', 2],
      ['potentialShock', 0.5],
    ],
  },
  {
    id: 'demographic',
    kind: 'structural',
    title: 'Демографический сдвиг',
    weight: 1,
    cooldown: 24,
    news: 'Старение населения сжимает рабочую силу и давит на бюджет.',
    spread: [0.3, 0.3, 0.4],
    build: () => [
      ['laborForce', -0.8],
      ['wageGrowth', 0.7],
      ['transfersPressure', 1.0],
      ['rStar', -0.25],
    ],
  },
  {
    id: 'consumer_boom',
    kind: 'demand',
    title: 'Потребительский бум',
    weight: 3,
    cooldown: 6,
    news: 'Домохозяйства резко нарастили расходы и спрос на кредит.',
    spread: [0.6, 0.4],
    build: () => [
      ['consumption', 2.5],
      ['consumerConfidence', 9],
      ['creditDemand', 3],
    ],
  },
  {
    id: 'harvest_fail',
    kind: 'supply',
    title: 'Неурожай и рост цен на продовольствие',
    weight: 3,
    cooldown: 6,
    news: 'Плохой урожай поднял продовольственные цены — удар по реальным доходам.',
    spread: [0.7, 0.3],
    build: () => [
      ['inflationSupply', 1.4],
      ['consumerConfidence', -6],
      ['consumption', -0.8],
    ],
  },
];

const CHANNEL_HEADLINE = {
  consumption: 'gdpGrowth',
  investment: 'gdpGrowth',
  exportsGrowth: 'gdpGrowth',
  importsGrowth: 'gdpGrowth',
  creditDemand: 'banking',
  inflationSupply: 'inflation',
  vatPrices: 'inflation',
  exchangeRate: 'exchangeRate',
  capitalFlow: 'exchangeRate',
  riskPremium: 'exchangeRate',
  revenue: 'budget',
  transfersPressure: 'budget',
  unemployment: 'unemployment',
  wageGrowth: 'unemployment',
  laborForce: 'unemployment',
  financialStability: 'banking',
  bankNPL: 'banking',
  bankLiquidity: 'banking',
  bankCapital: 'banking',
  productivity: 'potential',
  potentialShock: 'potential',
  infrastructureIndex: 'potential',
  rStar: 'potential',
};
const headlineFor = (channel) => CHANNEL_HEADLINE[channel] || 'other';

function spreadOf(kind, difficulty) {
  if (kind === 'slow') return CONFIG.slowSpread[difficulty];
  if (kind === 'fast') return [1];
  return CONFIG.lagSpread[difficulty];
}
function makeImpulse(
  channel,
  amount,
  reasonText,
  spreadKind,
  difficulty,
  headline
) {
  const pattern = spreadOf(spreadKind, difficulty);
  return {
    id: uid(),
    channel,
    reasonText,
    headline: headline || headlineFor(channel),
    values: pattern.map((f) => amount * f),
    idx: 0,
  };
}
function pickEvent(state, eventCooldowns) {
  const pool = EVENTS.filter((e) => {
    if ((eventCooldowns[e.id] || 0) > 0) return false;
    if (e.eligible && !e.eligible(state)) return false;
    return true;
  });
  if (!pool.length) return null;
  const weights = pool.map((e) => (e.weightFn ? e.weightFn(state) : e.weight));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
function buildEventImpulses(evt, state, difficulty) {
  const resolved = evt.build(state);
  const list = Array.isArray(resolved) ? resolved : resolved.list;
  const news = Array.isArray(resolved) ? evt.news : resolved.news;
  const impulses = list.map(([channel, amount]) => ({
    id: uid(),
    channel,
    reasonText: `Событие: ${evt.title}`,
    headline: headlineFor(channel),
    values: evt.spread.map((f) => amount * f),
    idx: 0,
  }));
  return { impulses, news };
}
function tickImpulses(queue) {
  const deltas = {};
  const contributions = [];
  const nextQueue = [];
  for (const imp of queue) {
    const amt = imp.values[imp.idx] || 0;
    deltas[imp.channel] = (deltas[imp.channel] || 0) + amt;
    if (Math.abs(amt) > 1e-4 && imp.headline && imp.headline !== 'other') {
      contributions.push({
        reasonText: imp.reasonText,
        headline: imp.headline,
        amount: amt,
        channel: imp.channel,
      });
    }
    const nextIdx = imp.idx + 1;
    if (nextIdx < imp.values.length) nextQueue.push({ ...imp, idx: nextIdx });
  }
  return { deltas, contributions, nextQueue };
}

/* =========================================================================================
   НАЛОГОВАЯ БАЗА И СОБИРАЕМОСТЬ (нелинейность -> кривая Лаффера как результат поведения)
========================================================================================= */
const TAX_REF = {
  income: 13,
  wedge: 32,
  profit: 18,
  vat: 16,
  excise: 10,
  capital: 12,
};
function complianceFor(rate, ref, sens, shadowShare) {
  const excess = Math.max(0, rate - ref);
  const relief = Math.max(0, ref - rate) * 0.004;
  const c =
    (1 - shadowShare / 100 + relief) *
    (1 - (sens * Math.pow(excess, 1.35)) / 100);
  return clamp(c, 0.2, 0.99);
}
function taxBases(s) {
  const nom = Math.max(1, s.nominalGdp);
  const cyc = 1 + 0.6 * (s.outputGap / 100);
  const employmentEffect = (100 - s.unemployment) / (100 - CONFIG.target.nairu);
  return {
    labor: nom * CONFIG.shares.wageBill * cyc * employmentEffect,
    profit:
      nom *
      CONFIG.shares.profits *
      Math.max(0.35, 1 + 1.8 * (s.outputGap / 100)),
    consumption: Math.max(1, (s.consumption * s.priceLevel) / 100),
    capital: nom * CONFIG.shares.capitalIncome * cyc,
    nominal: nom,
  };
}
function computeRevenue(s, d) {
  const B = taxBases(s);
  const sh = s.shadowShare;
  const income =
    (d.incomeTaxRate / 100) *
    B.labor *
    complianceFor(d.incomeTaxRate, TAX_REF.income, 0.9, sh);
  const social =
    (d.socialContribRate / 100) *
    B.labor *
    complianceFor(
      d.socialContribRate + d.incomeTaxRate,
      TAX_REF.wedge,
      0.8,
      sh
    );
  const profit =
    (d.profitTaxRate / 100) *
    B.profit *
    complianceFor(d.profitTaxRate, TAX_REF.profit, 1.5, sh);
  const vat =
    (d.vatRate / 100) *
    B.consumption *
    0.72 *
    complianceFor(d.vatRate, TAX_REF.vat, 1.1, sh);
  const excise =
    (d.exciseRate / 100) *
    B.consumption *
    0.26 *
    complianceFor(d.exciseRate, TAX_REF.excise, 0.7, sh);
  const capital =
    (d.capitalTaxRate / 100) *
    B.capital *
    complianceFor(d.capitalTaxRate, TAX_REF.capital, 2.2, sh);
  const nonTax = CONFIG.shares.nonTaxRevenue * B.nominal;
  const total = income + social + profit + vat + excise + capital + nonTax;
  return {
    income,
    social,
    profit,
    vat,
    excise,
    capital,
    nonTax,
    total,
    bases: B,
  };
}
const taxWedge = (d) =>
  d.incomeTaxRate + d.socialContribRate * 0.7 + d.vatRate * 0.35;

/* Потенциальный ВВП: производственная функция Кобба—Дугласа */
function potentialFrom(
  capitalStock,
  laborForce,
  nairu,
  humanCapital,
  productivity,
  infraIndex,
  tfpScale,
  scar
) {
  const alpha = CONFIG.prod.alpha;
  const L = Math.max(1, laborForce * (1 - nairu / 100) * (humanCapital / 100));
  const A = tfpScale * (productivity / 100);
  const infraBoost = 1 + (0.18 * (infraIndex - 100)) / 100;
  return (
    A *
    Math.pow(Math.max(1, capitalStock), alpha) *
    Math.pow(L, 1 - alpha) *
    infraBoost *
    (1 + scar / 100)
  );
}
const STOCK_NORM = (() => {
  const I = CONFIG.initial;
  const earn0 = CONFIG.shares.profits * I.gdp * (1 - I.profitTaxRate / 100);
  const y10 = I.keyRate + 1.5;
  const erp0 = 3.2;
  const growth0 = 0.62 * (2.3 + I.inflationExpectations);
  const pe0 = 100 / Math.max(1, y10 + erp0 - growth0);
  return (earn0 * pe0) / 1000;
})();
const TFP_SCALE = (() => {
  const I = CONFIG.initial;
  const alpha = CONFIG.prod.alpha;
  const L = I.laborForce * (1 - I.nairu / 100) * (I.humanCapitalIndex / 100);
  return I.gdp / (Math.pow(I.capitalStock, alpha) * Math.pow(L, 1 - alpha));
})();

/* Пять независимых оценок: одновременно максимизировать их нельзя */
function computeScores(x) {
  const T = CONFIG.target;
  const tgt = Number.isFinite(x.inflationTarget)
    ? x.inflationTarget
    : T.inflation;
  const interestToRevenue =
    (x.interestPayment / Math.max(1, x.govRevenue)) * 100;
  const reserveCover = (x.reserves / Math.max(1, x.imports / 4)) * 3;
  const inflDev = Math.abs(x.inflation - tgt);
  const scoreStability = clamp(
    72 +
      0.35 * (x.cbCredibility - 60) +
      (inflDev < 1 ? 4 : 0) -
      8.5 * inflDev -
      7 * Math.abs(x.inflationExpectations - tgt) -
      3.2 * Math.max(0, Math.abs(x.outputGap) - 1),
    0,
    100
  );
  const scoreWelfare = clamp(
    52 +
      7 * (x.gdpGrowth - 1.5) -
      5.5 * (x.unemployment - x.nairu) +
      0.22 * (x.consumerConfidence - 55) -
      3.2 * Math.max(0, x.inflation - tgt) +
      0.12 * (x.humanCapitalIndex - 100),
    0,
    100
  );
  const scoreFinancial = clamp(
    100 -
      0.75 * x.bankingRisk -
      2.2 * Math.max(0, x.creditGap) -
      3.2 * Math.max(0, x.capitalRequirement + 1 - x.bankCapitalAdequacy) -
      0.45 * x.currencyRisk +
      0.06 * Math.min(100, reserveCover * 10),
    0,
    100
  );
  const scoreFiscal = clamp(
    100 -
      0.75 * Math.max(0, x.debtToGdp - 45) -
      5.5 * Math.max(0, -x.budgetBalancePctGdp - 2) -
      1.4 * Math.max(0, interestToRevenue - 8) -
      0.6 * Math.max(0, x.shadowShare - 14),
    0,
    100
  );
  const scorePotential = clamp(
    48 +
      13 * (x.potentialGrowth - 2.0) +
      0.3 * (x.humanCapitalIndex - 100) +
      0.22 * (x.infrastructureIndex - 100) +
      0.3 * (x.productivity - 100) -
      5 * Math.max(0, x.nairu - T.nairu),
    0,
    100
  );
  const wellbeing = clamp(
    0.22 * scoreStability +
      0.3 * scoreWelfare +
      0.16 * scoreFinancial +
      0.16 * scoreFiscal +
      0.16 * scorePotential,
    0,
    100
  );
  return {
    scoreStability,
    scoreWelfare,
    scoreFinancial,
    scoreFiscal,
    scorePotential,
    wellbeing,
  };
}

/* =========================================================================================
   ГЛАВНАЯ ФУНКЦИЯ КВАРТАЛА
========================================================================================= */
function simulateQuarter({
  economy,
  decisions,
  pendingImpulses,
  eventCooldowns,
  difficulty,
  quarterIndex,
  stories,
  botAction,
}) {
  const s = economy;
  const C = CONFIG.coef;
  const T = CONFIG.target;
  const nMult = CONFIG.noiseMult[difficulty];
  const NB = CONFIG.noiseBase;
  const infTarget = Number.isFinite(decisions.inflationTarget)
    ? decisions.inflationTarget
    : CONFIG.target.inflation;
  const targetChange =
    infTarget -
    (Number.isFinite(s.inflationTarget)
      ? s.inflationTarget
      : CONFIG.target.inflation);
  const activeCrisesPre = s.activeCrises || [];
  const log = [];
  const news = [];
  const add = (headline, reasonText, amount) =>
    log.push({ headline, reasonText, amount });

  /* --- 1. события и очередь импульсов --- */
  const cooldowns = { ...eventCooldowns };
  Object.keys(cooldowns).forEach((k) => {
    cooldowns[k] = Math.max(0, cooldowns[k] - 1);
  });
  let queue = [...pendingImpulses];
  const newStories = [];
  const KIND_CAT = {
    demand: 'households',
    supply: 'business',
    financial: 'markets',
    external: 'world',
    structural: 'business',
  };
  if (Math.random() < CONFIG.eventProbability[difficulty]) {
    const evt = pickEvent(s, cooldowns);
    if (evt) {
      const built = buildEventImpulses(evt, s, difficulty);
      queue = queue.concat(built.impulses);
      cooldowns[evt.id] = evt.cooldown;
      const busy = (stories || []).some((x) => x.tplId === evt.id);
      if (STORY_TEMPLATES[evt.id] && !busy)
        newStories.push({ tplId: evt.id, nextIdx: 0, wait: 0 });
      else
        news.push(
          mkNews(
            KIND_CAT[evt.kind] || 'world',
            evt.title.toUpperCase(),
            built.news,
            { priority: 8 }
          )
        );
    }
  }
  queue = queue.concat(buildDecisionImpulses(decisions, s, difficulty));
  const ticked = tickImpulses(queue);
  const d = ticked.deltas;
  log.push(...ticked.contributions);
  const nextQueue = ticked.nextQueue;

  /* --- 2. внешний мир --- */
  const worldGdpGrowth = clamp(
    s.worldGdpGrowth +
      0.1 * (2.5 - s.worldGdpGrowth) +
      (d.worldGdpGrowth || 0) +
      gauss(NB.worldGdpGrowth * nMult),
    -6,
    8
  );
  const worldInflation = clamp(
    s.worldInflation +
      0.12 * (T.worldInflation - s.worldInflation) +
      (d.worldInflation || 0) +
      gauss(NB.worldInflation * nMult),
    -3,
    20
  );
  const worldRate = clamp(
    s.worldRate +
      0.1 * (T.foreignRate - s.worldRate) +
      (d.worldRate || 0) +
      gauss(NB.worldRate * nMult),
    0,
    18
  );
  const commodityIndex = clamp(
    s.commodityIndex +
      0.06 * (100 - s.commodityIndex) +
      (d.commodityIndex || 0) +
      gauss(NB.commodityIndex * nMult),
    20,
    400
  );
  const worldDemandIndex = clamp(
    s.worldDemandIndex +
      0.08 * (100 - s.worldDemandIndex) +
      (d.worldDemandIndex || 0) +
      gauss(NB.worldDemandIndex * nMult),
    40,
    220
  );

  /* --- 3. статьи бюджета --- */
  const rawShares = {
    health: decisions.shareHealth,
    education: decisions.shareEducation,
    science: decisions.shareScience,
    defense: decisions.shareDefense,
    admin: decisions.shareAdmin,
  };
  const sum5 =
    rawShares.health +
    rawShares.education +
    rawShares.science +
    rawShares.defense +
    rawShares.admin;
  const otherRaw = Math.max(4, 100 - sum5);
  const shareBase = sum5 + otherRaw;
  const ns = (x) => (x / shareBase) * 100;
  const budgetShares = {
    health: ns(rawShares.health),
    education: ns(rawShares.education),
    science: ns(rawShares.science),
    defense: ns(rawShares.defense),
    admin: ns(rawShares.admin),
    other: ns(otherRaw),
  };

  /* --- 4. ДЕНЕЖНАЯ ТРАНСМИССИЯ: ключевая ставка -> рыночные ставки --- */
  const rStarTarget =
    1.55 +
    0.55 * (s.potentialGrowth - 2.3) +
    0.3 * (worldRate - worldInflation) +
    0.25 * (s.riskPremium - 1.4) +
    (d.rStar || 0);
  const rStar = clamp(ema(s.rStar, rStarTarget, 0.06), -1.5, 6);

  const riskPremiumTarget =
    0.8 +
    C.debtLevelPremium * Math.max(0, s.debtToGdp - 55) +
    0.045 * Math.max(0, s.bankingRisk - 45) +
    0.035 * Math.max(0, 55 - s.govTrust) +
    0.03 * Math.max(0, 60 - s.cbCredibility) +
    0.02 * Math.max(0, 55 - s.policyCoordination) -
    0.02 *
      Math.max(
        0,
        -(Number.isFinite(s.netDebtToGdp) ? s.netDebtToGdp : s.debtToGdp)
      ) +
    (s.regime === 'currency' || s.regime === 'debt' ? 1.5 : 0);
  const riskPremium = clamp(
    ema(s.riskPremium, riskPremiumTarget, 0.22) + (d.riskPremium || 0),
    0.2,
    14
  );

  const bankSpread =
    C.bankSpreadBase +
    0.35 * clamp(s.bankNPL - 3, 0, 10) +
    0.25 * clamp(12 - s.bankCapitalAdequacy, 0, 8) +
    0.02 * Math.max(0, 60 - s.bankLiquidity) +
    0.15 * Math.max(0, decisions.reserveReq - 6) +
    0.1 * Math.max(0, decisions.capitalRequirement - 10.5);
  const lendingTarget =
    decisions.keyRate + C.termPremium + bankSpread + 0.3 * riskPremium;
  const lendingRate = clamp(
    ema(s.lendingRate, lendingTarget, C.lendingPassthrough[difficulty]),
    0,
    40
  );
  const depositRate = clamp(
    decisions.keyRate -
      C.depositSpread +
      0.05 * Math.max(0, 55 - s.bankLiquidity),
    -2,
    35
  );
  const realLendingRate = lendingRate - s.inflationExpectations;
  const realPolicyRate = decisions.keyRate - s.inflationExpectations;
  const neutralLendingReal = rStar + C.termPremium + C.bankSpreadBase;
  const rateGap = realLendingRate - neutralLendingReal; // >0 — денежные условия жёстче нейтральных
  const policyStance = realPolicyRate - rStar;
  if (Math.abs(rateGap) > 0.15)
    add(
      'gdpGrowth',
      `Денежные условия ${
        rateGap > 0 ? 'жёстче' : 'мягче'
      } нейтральных на ${fmt1(
        Math.abs(rateGap)
      )} п.п. (реальная ставка по кредитам ${fmt1(
        realLendingRate
      )}% против нейтральных ${fmt1(neutralLendingReal)}%)`,
      -rateGap * C.invRate * 0.2
    );

  /* --- 5. КРЕДИТНЫЙ КАНАЛ И БАНКОВСКИЙ ЦИКЛ --- */
  const creditDemandGrowth =
    C.creditDemandBase -
    C.creditRateSens * rateGap +
    (C.creditConfSens * (s.businessConfidence - 55)) / 5 +
    C.creditAccelerator * (s.gdpGrowth - s.potentialGrowth) -
    C.creditReserveSens * (decisions.reserveReq - 6) +
    (d.creditDemand || 0);
  const maxCreditStock =
    s.bankCapital /
    ((Math.max(8, decisions.capitalRequirement) / 100) * T.riskWeight);
  const supplyGrowthCap =
    (maxCreditStock / Math.max(1, s.creditVolume) - 1) * 100 * 4;
  const creditCrunch = supplyGrowthCap < creditDemandGrowth - 0.5;
  const creditGrowth = clamp(
    Math.min(creditDemandGrowth, supplyGrowthCap),
    -35,
    30
  );
  const creditVolume = Math.max(
    1,
    applyAnnualGrowth(s.creditVolume, creditGrowth)
  );
  if (creditCrunch)
    add(
      'banking',
      'Капитал банков ограничивает выдачу новых кредитов (кредитное сжатие)',
      supplyGrowthCap - creditDemandGrowth
    );

  /* --- 6. СТОРОНА ПРЕДЛОЖЕНИЯ: капитал, труд, производительность, потенциал --- */
  const eduHealthShareGdp =
    ((((budgetShares.health + budgetShares.education) / 100) *
      s.govPurchasesReal) /
      Math.max(1, s.gdp)) *
    100;
  const baseEduHealth =
    ((((CONFIG.initial.budgetShares.health +
      CONFIG.initial.budgetShares.education) /
      100) *
      CONFIG.initial.govPurchasesReal) /
      CONFIG.initial.gdp) *
    100;
  const humanCapitalTarget = 100 + 7.0 * (eduHealthShareGdp - baseEduHealth);
  const humanCapitalIndex = clamp(
    s.humanCapitalIndex +
      0.055 * (humanCapitalTarget - s.humanCapitalIndex) +
      gauss(0.04 * nMult),
    55,
    200
  );

  const scienceShareGdp =
    (((budgetShares.science / 100) * s.govPurchasesReal) / Math.max(1, s.gdp)) *
    100;
  const baseScience =
    (((CONFIG.initial.budgetShares.science / 100) *
      CONFIG.initial.govPurchasesReal) /
      CONFIG.initial.gdp) *
    100;
  const tfpGrowth =
    CONFIG.prod.tfpBase +
    0.45 * (scienceShareGdp - baseScience) +
    (0.1 * (s.infrastructureIndex - 100)) / 10 -
    (s.regime === 'banking' || s.regime === 'debt' ? 0.35 : 0);
  const productivity = clamp(
    applyAnnualGrowth(s.productivity, tfpGrowth) +
      (d.productivity || 0) +
      gauss(NB.productivity * nMult),
    50,
    400
  );

  const govInvShareGdp = (s.govInvestmentReal / Math.max(1, s.gdp)) * 100;
  const baseGovInvShare =
    (CONFIG.initial.govInvestmentReal / CONFIG.initial.gdp) * 100;
  const infrastructureIndex = clamp(
    s.infrastructureIndex +
      0.9 * (govInvShareGdp - baseGovInvShare) -
      (0.25 * (s.infrastructureIndex - 100)) / 10 +
      (d.infrastructureIndex || 0) +
      gauss(0.05 * nMult),
    50,
    220
  );

  const capitalStock = Math.max(
    1,
    s.capitalStock +
      (s.businessInvestment +
        s.govInvestmentReal -
        (CONFIG.prod.depreciation / 100) * s.capitalStock) /
        QUARTERS_PER_YEAR
  );
  const laborForce = clamp(
    s.laborForce * (1 + (d.laborForce || 0) / 100),
    60,
    140
  );
  const supplyScar = clamp(
    s.supplyScar * 0.94 + (d.potentialShock || 0),
    -18,
    6
  );
  const nairuTarget =
    T.nairu +
    0.35 * Math.max(0, s.unemployment - T.nairu - 2) +
    0.2 * Math.max(0, s.shadowShare - 14) * 0.1;
  const nairu = clamp(
    s.nairu + C.nairuHysteresis * (nairuTarget - s.nairu),
    3.5,
    12
  );

  const potentialGdp = potentialFrom(
    capitalStock,
    laborForce,
    nairu,
    humanCapitalIndex,
    productivity,
    infrastructureIndex,
    TFP_SCALE,
    supplyScar
  );
  const potentialGrowth = clamp(
    ema(
      s.potentialGrowth,
      annualizedGrowth(s.potentialGdp, potentialGdp),
      0.35
    ),
    -4,
    8
  );

  /* --- 7. БЮДЖЕТ: реальные уровни расходов и фискальный импульс --- */
  const trendReal = potentialGrowth;
  const govPurchasesGrowth = clamp(trendReal + decisions.govSpending, -12, 14);
  const transfersGrowth = clamp(
    trendReal + decisions.transfers + (d.transfersPressure || 0),
    -12,
    16
  );
  const govInvestmentGrowth = clamp(
    trendReal + decisions.govInvestment,
    -16,
    20
  );
  const plannedPurchases = Math.max(
    1,
    applyAnnualGrowth(s.govPurchasesReal, govPurchasesGrowth)
  );
  const plannedTransfers = Math.max(
    1,
    applyAnnualGrowth(s.transfersReal, transfersGrowth)
  );
  const plannedGovInv = Math.max(
    1,
    applyAnnualGrowth(s.govInvestmentReal, govInvestmentGrowth)
  );
  // Рынок не даёт занять сколько угодно: чем выше долг и премия за риск, тем меньше
  // дефицит, который вообще можно профинансировать. Остальное — секвестр.
  const projRevenue =
    s.govRevenue * (1 + (s.potentialGrowth + s.inflation) / 400);
  const projInterest = (s.govDebt * s.effectiveDebtRate) / 100;
  const maxDeficitPct = clamp(
    11 -
      0.1 * Math.max(0, s.debtToGdp - 55) -
      1.5 * Math.max(0, s.riskPremium - 2.0),
    0.5,
    11
  );
  const allowedPrimary =
    projRevenue + (maxDeficitPct / 100) * s.nominalGdp - projInterest;
  const plannedPrimary =
    ((plannedPurchases + plannedTransfers + plannedGovInv) * s.priceLevel) /
    100;
  const sequesterFactor =
    plannedPrimary > allowedPrimary && allowedPrimary > 0
      ? clamp(allowedPrimary / plannedPrimary, 0.72, 1)
      : 1;
  const govPurchasesReal = plannedPurchases * sequesterFactor;
  const transfersReal =
    plannedTransfers *
    (sequesterFactor < 1 ? Math.min(1, sequesterFactor + 0.1) : 1);
  const govInvestmentReal =
    plannedGovInv *
    (sequesterFactor < 1 ? Math.max(0.5, sequesterFactor - 0.12) : 1);
  if (sequesterFactor < 0.995) {
    news.push(
      mkNews(
        'crisis',
        `СЕКВЕСТР БЮДЖЕТА: РАСХОДЫ УРЕЗАНЫ НА ${fmt1(
          (1 - sequesterFactor) * 100
        )}%`,
        `Инвесторы отказываются финансировать дефицит больше ${fmt1(
          maxDeficitPct
        )}% ВВП при долге ${fmt1(s.debtToGdp)}% и премии за риск ${fmt1(
          s.riskPremium
        )} п.п. Правительство вынуждено резать расходы независимо от своих планов — первыми страдают госинвестиции.`,
        {
          priority: 10,
          chain: [
            'Долг ↑',
            'Премия за риск ↑',
            'Рынок закрыт',
            'Секвестр расходов',
            'Спад ↑',
          ],
        }
      )
    );
  }

  const actualGrowthG = annualizedGrowth(s.govPurchasesReal, govPurchasesReal);
  const actualGrowthTr = annualizedGrowth(s.transfersReal, transfersReal);
  const actualGrowthIg = annualizedGrowth(
    s.govInvestmentReal,
    govInvestmentReal
  );
  const slack = clamp(-s.outputGap, 0, 6) / 6;
  const mPurchases = C.multPurchases[0] + C.multPurchases[1] * slack;
  const mTransfers = C.multTransfers[0] + C.multTransfers[1] * slack;
  const mInvestment = C.multInvestment[0] + C.multInvestment[1] * slack;
  const mTax = C.multTax[0] + C.multTax[1] * slack;
  const shareG = s.govPurchasesReal / s.gdp;
  const shareTr = s.transfersReal / s.gdp;
  const shareIg = s.govInvestmentReal / s.gdp;
  const wedgeChange = taxWedge(decisions) - taxWedge(s);
  const fiscalImpulse =
    mPurchases * decisions.govSpending * shareG +
    mTransfers * decisions.transfers * shareTr +
    mInvestment * decisions.govInvestment * shareIg -
    mTax * wedgeChange * 0.35;
  if (Math.abs(fiscalImpulse) > 0.05) {
    add(
      'gdpGrowth',
      `Бюджетный импульс ${fmtSigned1(
        fiscalImpulse
      )} п.п. (мультипликатор расходов ${fmt2(mPurchases)} — ${
        slack > 0.4
          ? 'экономика ниже потенциала, деньги доходят до выпуска'
          : 'экономика близка к пределу, эффект уходит в цены'
      })`,
      fiscalImpulse
    );
  }

  /* --- 8. IS: компоненты спроса --- */
  const capacityDrag =
    -C.capacityDrag * Math.pow(Math.max(0, s.outputGap - 1), 1.25);
  const creditRatio = s.creditVolume / Math.max(1, s.nominalGdp);
  const creditImpulse =
    (creditGrowth - (s.potentialGrowth + s.inflationExpectations)) *
    creditRatio *
    C.creditImpulseToDemand;

  const prevU = Number.isFinite(s.prevUnemployment)
    ? s.prevUnemployment
    : s.unemployment;
  const employmentGrowthPrev = -(s.unemployment - prevU) * QUARTERS_PER_YEAR;
  const realWageIncome = s.wageGrowth - s.inflation + employmentGrowthPrev;
  const realTransferGrowth = transfersGrowth;
  const capitalIncomeGrowth =
    s.gdpGrowth - s.inflation * 0 + 0.5 * (s.gdpGrowth - s.potentialGrowth);
  const wedgeDrag = -wedgeChange * 0.55;
  const realIncomeGrowth =
    0.62 * realWageIncome +
    0.16 * realTransferGrowth +
    0.22 * capitalIncomeGrowth +
    wedgeDrag;

  const consShareDev =
    s.consumption /
      s.potentialGdp /
      (CONFIG.initial.consumption / CONFIG.initial.gdp) -
    1;
  const invShareDev =
    s.businessInvestment /
      s.potentialGdp /
      (CONFIG.initial.businessInvestment / CONFIG.initial.gdp) -
    1;
  const consumptionCore =
    potentialGrowth -
    16 * consShareDev +
    C.consIncome * (realIncomeGrowth - potentialGrowth) -
    C.consRate * (depositRate - s.inflationExpectations - (rStar - 1.0)) +
    (C.consConf * (s.consumerConfidence - 55)) / 5 +
    C.consCredit * creditImpulse +
    0.35 * slack * 0.16 * decisions.transfers +
    capacityDrag * 0.6;
  const consumptionGrowth = clamp(
    C.consInertia * s.consumptionGrowth +
      (1 - C.consInertia) * consumptionCore +
      (d.consumption || 0) +
      gauss(NB.consumption * nMult),
    -18,
    14
  );

  const investmentCore =
    potentialGrowth -
    24 * invShareDev +
    C.invAccelerator * (s.gdpGrowth - s.potentialGrowth) -
    C.invRate * rateGap +
    (C.invConf * (s.businessConfidence - 55)) / 5 +
    C.invCredit * creditImpulse +
    C.invCrowdIn * decisions.govInvestment * (shareIg / 0.03) -
    C.invProfitTax * (decisions.profitTaxRate - s.profitTaxRate) +
    (creditCrunch ? -2.5 : 0) +
    capacityDrag;
  const investmentGrowth = clamp(
    C.invInertia * s.investmentGrowth +
      (1 - C.invInertia) * investmentCore +
      (d.investment || 0) +
      gauss(NB.investment * nMult),
    -35,
    25
  );

  const exportsGrowth = clamp(
    0.95 +
      C.exportWorld * worldGdpGrowth +
      0.03 * (worldDemandIndex - 100) -
      C.exportRer * (s.realExchangeRate - 100) +
      (d.exportsGrowth || 0) +
      gauss(NB.exports * nMult),
    -30,
    30
  );
  const importsGrowth = clamp(
    0.15 +
      C.importIncome * s.gdpGrowth +
      C.importRer * (s.realExchangeRate - 100) +
      (d.importsGrowth || 0) +
      gauss(NB.imports * nMult),
    -30,
    30
  );

  const consumption = Math.max(
    1,
    applyAnnualGrowth(s.consumption, consumptionGrowth)
  );
  const businessInvestment = Math.max(
    1,
    applyAnnualGrowth(s.businessInvestment, investmentGrowth)
  );
  const exports = Math.max(1, applyAnnualGrowth(s.exports, exportsGrowth));
  const imports = Math.max(1, applyAnnualGrowth(s.imports, importsGrowth));

  const gdp = Math.max(
    1,
    consumption +
      businessInvestment +
      govPurchasesReal +
      govInvestmentReal +
      exports -
      imports
  );
  const gdpGrowth = annualizedGrowth(s.gdp, gdp);
  const outputGap = clamp(((gdp - potentialGdp) / potentialGdp) * 100, -25, 20);
  add(
    'gdpGrowth',
    `Потребление ${fmtSigned1(consumptionGrowth)}%, инвестиции ${fmtSigned1(
      investmentGrowth
    )}%, госсектор ${fmtSigned1(
      govPurchasesGrowth
    )}%, чистый экспорт ${fmtMoneySigned(exports - imports)}`,
    gdpGrowth - s.gdpGrowth
  );
  if (capacityDrag < -0.15)
    add(
      'gdpGrowth',
      `Экономика упирается в предел мощностей: часть спроса уходит в цены, а не в выпуск (${fmt1(
        capacityDrag
      )} п.п.)`,
      capacityDrag
    );

  /* --- 9. РЫНОК ТРУДА: спрос на труд -> занятость -> напряжённость -> зарплаты --- */
  const unemploymentTarget = nairu - C.okun * outputGap;
  const unemployment = clamp(
    s.unemployment +
      C.uAdjust * (unemploymentTarget - s.unemployment) +
      (d.unemployment || 0) +
      gauss(NB.unemployment * nMult),
    1.5,
    30
  );
  const employment = 100 - unemployment;
  const tightness = nairu - unemployment; // >0 — дефицит работников
  const vacancyRate = clamp(3.0 + 0.95 * tightness + 0.25 * outputGap, 0.2, 14);
  add(
    'unemployment',
    `Разрыв выпуска ${fmtSigned1(
      outputGap
    )}% через закон Оукена тянет безработицу к ${fmt1(unemploymentTarget)}%`,
    unemployment - s.unemployment
  );

  const trendLaborProductivity = clamp(
    potentialGrowth - (laborForce / s.laborForce - 1) * 400,
    -2,
    6
  );
  const wageGrowth = clamp(
    C.wageExpect * s.inflationExpectations +
      trendLaborProductivity +
      C.wageTightness * tightness +
      0.18 * Math.max(0, vacancyRate - 4) -
      C.wageSocial * (decisions.socialContribRate - s.socialContribRate) +
      (d.wageGrowth || 0) +
      gauss(NB.wageGrowth * nMult),
    Math.min(0, s.wageGrowth * 0.5),
    45
  );
  const unitLaborCostGrowth = wageGrowth - trendLaborProductivity;
  if (tightness > 0.4)
    add(
      'inflation',
      `Дефицит работников (безработица ${fmt1(
        unemployment
      )}% против естественной ${fmt1(nairu)}%) разгоняет зарплаты до ${fmt1(
        wageGrowth
      )}%`,
      C.ulcPass * (unitLaborCostGrowth - s.inflationExpectations)
    );

  /* --- 10. ЦЕНЫ: кривая Филлипса + издержки + ожидания --- */
  const phillipsAsym = outputGap < 0 ? 0.55 : 1.0; // цены и зарплаты вниз идут заметно хуже, чем вверх
  const demandPressure =
    phillipsAsym *
    (C.phillipsLinear * outputGap +
      C.phillipsConvex * outputGap * Math.abs(outputGap));
  const ulcPressure =
    C.ulcPass * (unitLaborCostGrowth - s.inflationExpectations);
  const commodityPressure =
    C.commodityPass * (commodityIndex - s.commodityIndex) * 4;
  const supplyShock = d.inflationSupply || 0;
  const vatPressure = d.vatPrices || 0;
  const inflationPre =
    s.inflationExpectations +
    demandPressure +
    ulcPressure +
    supplyShock +
    vatPressure +
    commodityPressure;

  /* --- 11. ПЛАТЁЖНЫЙ БАЛАНС И КУРС --- */
  const carry =
    decisions.keyRate -
    s.inflationExpectations -
    (worldRate - worldInflation) -
    riskPremium;
  const netCapitalFlow =
    C.capitalFlowCarry * carry +
    C.capitalFlowConf * (s.businessConfidence - 55) +
    C.capitalFlowStab * (s.financialStability - 70) +
    (d.capitalFlow || 0) +
    gauss(NB.capitalFlow * nMult) -
    (s.regime === 'debt' || s.regime === 'currency' ? 25 : 0);
  const currentAccountPrev = s.exports - s.imports - 0.012 * s.govDebt;
  const bop =
    currentAccountPrev + netCapitalFlow + decisions.fxIntervention * 0;
  const pppAnchor = s.inflationExpectations - worldInflation;
  const rawPressure =
    pppAnchor +
    C.fxBop * ((-bop / Math.max(1, s.nominalGdp)) * 100) -
    C.fxCarry * carry;
  const regimeDamp =
    decisions.fxRegime === 'peg'
      ? 0.08
      : decisions.fxRegime === 'managed'
      ? 0.45
      : 1.0;
  const fxTarget =
    decisions.fxRegime === 'free'
      ? s.exchangeRate
      : clamp(decisions.fxTarget || s.exchangeRate, 20, 1200);
  const marketDepr = rawPressure + gauss(NB.exchangeRate * nMult); // что сделал бы свободный курс
  const pullToTarget = clamp(
    (fxTarget / Math.max(1, s.exchangeRate) - 1) * 100 * 2,
    -35,
    35
  );
  const desiredDepr =
    decisions.fxRegime === 'free'
      ? marketDepr
      : marketDepr * regimeDamp + pullToTarget * (1 - regimeDamp);
  // Разница между желаемым и рыночным движением курса — это и есть объём интервенций.
  // Хотим валюту слабее рынка → покупаем валюту, резервы растут. Хотим крепче → продаём и тратим.
  const gapPct = desiredDepr - marketDepr;
  let defenseIntervention =
    decisions.fxRegime === 'free'
      ? 0
      : (gapPct * Math.max(1, s.nominalGdp)) / 100 / C.fxBop;
  const reserveYield = (s.reserves * worldRate) / 100 / QUARTERS_PER_YEAR;
  let unfundedPct = 0;
  const quarterlyNeed = defenseIntervention / QUARTERS_PER_YEAR;
  if (quarterlyNeed < 0 && -quarterlyNeed > s.reserves * 0.6) {
    // продавать нечего
    const feasible = -s.reserves * 0.6 * QUARTERS_PER_YEAR;
    unfundedPct =
      (defenseIntervention - feasible) /
      (Math.max(1, s.nominalGdp) / 100 / C.fxBop);
    defenseIntervention = feasible;
  }
  let depreciationPct =
    desiredDepr -
    unfundedPct +
    (decisions.fxIntervention / Math.max(1, s.nominalGdp)) * 100 * 2.5;
  let reserves = Math.max(
    0,
    s.reserves +
      decisions.fxIntervention +
      defenseIntervention / QUARTERS_PER_YEAR +
      reserveYield +
      (d.reserves || 0) +
      gauss(NB.reserves * nMult * 0.3)
  );
  let fxBreak = false;
  if (
    decisions.fxRegime !== 'free' &&
    reserves < 0.22 * CONFIG.initial.reserves
  ) {
    fxBreak = true;
    depreciationPct += 22;
    reserves = Math.max(reserves, 0.25 * CONFIG.initial.reserves);
    news.push(
      mkNews(
        'crisis',
        'СРЫВ ВАЛЮТНОГО РЕЖИМА: ДЕВАЛЬВАЦИЯ',
        'Резервы исчерпаны — удержать курс не удалось. Валюта резко девальвирована, импортная инфляция придёт в ближайшие кварталы.',
        {
          priority: 10,
          chain: [
            'Резервы ↓',
            'Защита курса невозможна',
            'Девальвация',
            'Импортные цены ↑',
            'Инфляция ↑',
          ],
        }
      )
    );
  }
  const exchangeRate = clamp(
    applyAnnualGrowth(s.exchangeRate, depreciationPct),
    20,
    1200
  );
  const fxDeprAnnual = annualizedGrowth(s.exchangeRate, exchangeRate);
  const importPriceInflation = worldInflation + fxDeprAnnual;
  const fxPressureInfl =
    C.fxPass * fxDeprAnnual +
    C.worldInflPass * (worldInflation - T.worldInflation);
  if (Math.abs(fxPressureInfl) > 0.1)
    add(
      'inflation',
      `Перенос курса в цены импорта: валюта ${
        fxDeprAnnual > 0 ? 'ослабла' : 'укрепилась'
      } на ${fmt1(Math.abs(fxDeprAnnual))}% годовых`,
      fxPressureInfl
    );
  if (Math.abs(depreciationPct) > 0.5)
    add(
      'exchangeRate',
      `Платёжный баланс ${fmtMoneySigned(
        bop
      )} и разница реальных ставок (${fmt1(carry)} п.п.) ${
        bop < 0 ? 'давят на' : 'поддерживают'
      } курс`,
      depreciationPct
    );

  const inflation = clamp(
    inflationPre +
      fxPressureInfl +
      (d.inflation || 0) +
      gauss(NB.inflation * nMult),
    -10,
    90
  );
  const coreInflation = clamp(
    s.inflationExpectations + demandPressure + ulcPressure * 0.9,
    -10,
    90
  );
  add(
    'inflation',
    `Ожидания ${fmt1(s.inflationExpectations)}% + давление спроса ${fmtSigned1(
      demandPressure
    )} п.п. + издержки труда ${fmtSigned1(ulcPressure)} п.п.`,
    inflation - s.inflation
  );
  if (Math.abs(supplyShock) > 0.1)
    add(
      'inflation',
      'Шок предложения: издержки выросли при падении выпуска',
      supplyShock
    );

  /* ожидания и доверие к ЦБ */
  const inflDev = Math.abs(inflation - infTarget);
  const adaptSpeed = clamp(
    C.expAdaptMin +
      (C.expAdaptMax - C.expAdaptMin) *
        clamp(inflDev / 6, 0, 1) *
        (1 - s.cbCredibility / 140),
    0.08,
    0.55
  );
  const anchorWeight = clamp(
    (s.cbCredibility / 100) * (1 - clamp((inflDev - 2) / 8, 0, 0.6)),
    0.05,
    0.95
  );
  const expTarget =
    anchorWeight * infTarget +
    (1 - anchorWeight) * (0.75 * inflation + 0.25 * s.inflationExpectations);
  // ожидания двигают не только цифры, но и сами события: шоки, кризисы, курс, эмиссия
  const expShock = clamp(
    0.32 * Math.max(0, supplyShock) +
      0.055 * Math.max(0, Math.abs(fxDeprAnnual) - 6) +
      (activeCrisesPre.indexOf('currency') >= 0 ? 0.5 : 0) +
      (activeCrisesPre.indexOf('banking') >= 0 ? 0.25 : 0) +
      (decisions.emergency ? 0.5 : 0) +
      0.25 * Math.max(0, inflation - s.inflation - 1) +
      (Math.abs(targetChange) > 0.01 ? targetChange * 0.6 : 0) -
      (s.cbCredibility > 75 ? 0.2 : 0) -
      (s.cbCredibility > 88 ? 0.1 : 0),
    -0.8,
    2.4
  );
  const inflationExpectations = clamp(
    s.inflationExpectations +
      adaptSpeed * (expTarget - s.inflationExpectations) +
      expShock +
      gauss(0.1 * nMult),
    -5,
    40
  );
  if (Math.abs(expShock) > 0.08) {
    add(
      'inflation',
      `Событийный сдвиг ожиданий ${fmtSigned1(
        expShock
      )} п.п.: люди и бизнес пересматривают свои прогнозы не по статистике, а по заголовкам — ${
        supplyShock > 0.1
          ? 'шок издержек'
          : Math.abs(fxDeprAnnual) > 6
          ? 'движение курса'
          : decisions.emergency
          ? 'эмиссионная поддержка банков'
          : Math.abs(targetChange) > 0.01
          ? 'смена цели ЦБ'
          : 'резкий скачок цен'
      } виден всем`,
      expShock
    );
  }

  const stanceCorrect =
    sign(policyStance) === sign(inflation - infTarget) || inflDev < 1.0;
  const credDrift =
    (inflDev < 1.5 ? 0.75 : -0.45 * Math.min(4, inflDev / 1.5)) +
    (stanceCorrect ? 0.3 : -0.35) -
    (decisions.emergency ? 0.7 : 0) -
    (decisions.moneySupplyOp > 3 ? 0.8 : 0) -
    (s.cbCredibility - 60) * 0.02;
  const cbCredibility = clamp(
    s.cbCredibility +
      credDrift * 0.55 -
      Math.abs(targetChange) * 9 +
      gauss(0.5 * nMult),
    0,
    100
  );

  const priceLevel = Math.max(10, applyAnnualGrowth(s.priceLevel, inflation));
  const nominalGdp = Math.max(1, (gdp * priceLevel) / 100);
  const realExchangeRate = clamp(
    s.realExchangeRate *
      (1 + (inflation - worldInflation - fxDeprAnnual) / 400),
    45,
    260
  );

  /* --- 12. БАНКИ: просрочка, убытки, капитал --- */
  const creditTrendRatio = ema(
    s.creditTrendRatio,
    (creditVolume / nominalGdp) * 100,
    0.05
  );
  const creditGap = (creditVolume / nominalGdp) * 100 - creditTrendRatio;
  // «наследие» кредитного бума: дешёвый кредит сегодня превращается в просрочку через 2–3 года
  const creditGapLag = ema(
    Number.isFinite(s.creditGapLag) ? s.creditGapLag : 0,
    creditGap,
    0.12
  );
  const nplTarget = clamp(
    1.8 +
      C.nplRate * Math.max(0, realLendingRate - rStar - 1) +
      C.nplUnemp * Math.max(0, unemployment - nairu) +
      C.nplGap * Math.max(0, -outputGap) +
      C.nplCreditBoom * Math.max(0, s.creditGapLag),
    0.8,
    35
  );
  const bankNPL = clamp(
    s.bankNPL +
      C.nplAdjust * (nplTarget - s.bankNPL) +
      (d.bankNPL || 0) +
      gauss(NB.bankNPL * nMult),
    0.4,
    40
  );
  const loanLosses = creditVolume * (bankNPL / 100) * T.lgd * 0.25;
  const interestMargin =
    (creditVolume * (lendingRate - depositRate)) / 100 / QUARTERS_PER_YEAR;
  const opCost = 0.004 * creditVolume;
  const bankProfit = interestMargin - loanLosses - opCost;
  let bankCapital = Math.max(
    1,
    s.bankCapital +
      bankProfit +
      (d.bankCapital || 0) +
      (decisions.emergency ? 0.12 * s.bankCapital + 25 : 0)
  );
  const rwa = Math.max(1, creditVolume * T.riskWeight);
  // докапитализация с рынка: в спокойные времена банки привлекают капитал, в кризис — почти нет
  const capitalTarget = ((decisions.capitalRequirement + 3.5) / 100) * rwa;
  if (bankCapital < capitalTarget) {
    const appetite =
      clamp((s.businessConfidence - 35) / 30, 0.05, 1) *
      clamp((s.financialStability - 30) / 40, 0.05, 1);
    bankCapital += 0.16 * (capitalTarget - bankCapital) * appetite;
  }
  let bankCapitalAdequacy = (bankCapital / rwa) * 100;
  if (bankCapitalAdequacy > decisions.capitalRequirement + 4.5) {
    const excess =
      ((bankCapitalAdequacy - decisions.capitalRequirement - 4.5) / 100) * rwa;
    bankCapital -= excess * 0.3;
    bankCapitalAdequacy = (bankCapital / rwa) * 100;
  }
  const bankLiquidity = clamp(
    s.bankLiquidity +
      0.09 * (75 - s.bankLiquidity) -
      Math.max(0, bankNPL - 6) * 1.1 -
      Math.max(0, -creditGrowth) * 0.25 +
      (decisions.liquidity || 0) * 0.9 +
      (d.bankLiquidity || 0) -
      (decisions.reserveReq - s.reserveReq) * 1.2 +
      gauss(0.9 * nMult),
    0,
    100
  );
  const bankingRisk = clamp(
    ema(
      s.bankingRisk,
      clamp(
        0.5 * clamp(bankNPL * 4.5, 0, 100) +
          0.28 * clamp(100 - bankLiquidity, 0, 100) +
          0.22 *
            clamp(
              (decisions.capitalRequirement + 3 - bankCapitalAdequacy) * 9,
              0,
              100
            ),
        0,
        100
      ),
      0.4
    ),
    0,
    100
  );
  if (bankProfit < 0)
    add(
      'banking',
      `Убытки банков ${fmtMoney(
        -bankProfit
      )} за квартал съедают капитал: достаточность ${fmt1(
        bankCapitalAdequacy
      )}% при требовании ${fmt1(decisions.capitalRequirement)}%`,
      bankProfit
    );
  if (nplTarget > s.bankNPL + 0.5)
    add(
      'banking',
      `Дорогой кредит и слабый выпуск повышают неплатежи: просрочка идёт к ${fmt1(
        nplTarget
      )}%`,
      nplTarget - s.bankNPL
    );

  const financialStability = clamp(
    s.financialStability +
      0.1 * (T.neutralStability - s.financialStability) -
      Math.max(0, bankingRisk - 50) * 0.1 -
      Math.max(0, s.debtToGdp - 90) * 0.04 -
      Math.max(0, creditGap - 8) * 0.25 +
      (decisions.emergency ? 14 : 0) +
      (decisions.liquidity || 0) * 0.25 +
      (d.financialStability || 0) +
      gauss(NB.financialStability * nMult),
    0,
    100
  );

  /* --- 13. НАЛОГИ, РАСХОДЫ, ДОЛГ --- */
  const fundIncome =
    ((s.sovereignFund || 0) * (worldRate + 1)) / 100 / QUARTERS_PER_YEAR;
  const stateForTax = {
    nominalGdp,
    consumption,
    priceLevel,
    outputGap,
    unemployment,
    shadowShare: s.shadowShare,
  };
  const wedgeNow = taxWedge(decisions);
  const shadowTarget = clamp(
    9 +
      0.55 * (wedgeNow - 32) +
      0.1 * Math.max(0, 55 - s.govTrust) +
      0.06 * Math.max(0, unemployment - 6) * 5,
    4,
    45
  );
  const shadowShare = clamp(
    s.shadowShare + 0.07 * (shadowTarget - s.shadowShare),
    3,
    50
  );
  const revenueParts = computeRevenue(
    { ...stateForTax, shadowShare },
    decisions
  );
  const govRevenue = Math.max(
    1,
    revenueParts.total + fundIncome * QUARTERS_PER_YEAR + (d.revenue || 0)
  );
  const revenuePctGdp = (govRevenue / nominalGdp) * 100;
  add(
    'budget',
    `Налоговая база: теневая экономика ${fmt1(
      shadowShare
    )}%, собираемость подстраивается под нагрузку (налоговый клин ${fmt1(
      wedgeNow
    )})`,
    govRevenue - s.govRevenue
  );

  const govPurchasesNominal = (govPurchasesReal * priceLevel) / 100;
  const transfersNominal = (transfersReal * priceLevel) / 100;
  const govInvestmentNominal = (govInvestmentReal * priceLevel) / 100;
  const newDebtRate =
    0.35 * decisions.keyRate +
    0.65 * (rStar + inflationExpectations + 1.0) +
    riskPremium +
    C.debtLevelPremium * Math.max(0, s.debtToGdp - 60);
  const effectiveDebtRate = clamp(
    s.effectiveDebtRate + C.debtRollover * (newDebtRate - s.effectiveDebtRate),
    0,
    45
  );
  const interestPayment = (s.govDebt * effectiveDebtRate) / 100;
  const govSpendingTotal =
    govPurchasesNominal +
    transfersNominal +
    govInvestmentNominal +
    interestPayment;
  const budgetBalance = govRevenue - govSpendingTotal;
  const primaryBalance = budgetBalance + interestPayment;
  // профицит сначала гасит долг, остальное уходит в суверенный фонд; дефицит сначала
  // финансируется из фонда и только потом новым долгом
  let govDebt = s.govDebt;
  let sovereignFund = s.sovereignFund || 0;
  const flow = budgetBalance / QUARTERS_PER_YEAR;
  if (flow >= 0) {
    const repay = Math.min(govDebt, flow);
    govDebt -= repay;
    sovereignFund += flow - repay;
  } else {
    const draw = Math.min(sovereignFund, -flow * 0.65);
    sovereignFund -= draw;
    govDebt += -flow - draw;
  }
  govDebt = Math.max(0, govDebt);
  const debtToGdp = (govDebt / nominalGdp) * 100;
  const fundPctGdp = (sovereignFund / nominalGdp) * 100;
  const netDebtToGdp = ((govDebt - sovereignFund) / nominalGdp) * 100;
  const budgetBalancePctGdp = (budgetBalance / nominalGdp) * 100;
  const structuralBalancePctGdp = budgetBalancePctGdp + 0.45 * outputGap;
  // (7) откуда взялось изменение баланса — по слагаемым
  const dRev = govRevenue - s.govRevenue;
  const dSpend = govSpendingTotal - s.govSpendingTotal;
  const dInt = interestPayment - s.interestPayment;
  add(
    'budget',
    `Доходы ${fmtMoneySigned(dRev)} (номинальный ВВП ${fmtSigned1(
      annualizedGrowth(s.nominalGdp, nominalGdp)
    )}%, теневая экономика ${fmt1(shadowShare)}%${
      Math.abs(fundIncome) > 0.5
        ? `, доход фонда ${fmtMoney(fundIncome * 4)}`
        : ''
    }), расходы ${fmtMoneySigned(dSpend)} (из них проценты ${fmtMoneySigned(
      dInt
    )}) — итог ${fmtSigned1(
      budgetBalancePctGdp - s.budgetBalancePctGdp
    )} п.п. ВВП`,
    budgetBalancePctGdp - s.budgetBalancePctGdp
  );
  if (sovereignFund > 1)
    add(
      'budget',
      `Суверенный фонд ${fmtMoney(sovereignFund)} (${fmt1(
        fundPctGdp
      )}% ВВП) приносит ${fmtMoney(
        fundIncome * 4
      )} в год и гасит будущие дефициты до обращения к рынку`,
      fundPctGdp
    );
  if (interestPayment - s.interestPayment > 1)
    add(
      'budget',
      `Стоимость обслуживания долга выросла до ${fmtMoney(
        interestPayment
      )} в год (ставка ${fmt1(effectiveDebtRate)}%)`,
      -(interestPayment - s.interestPayment)
    );

  /* --- 14. ВНЕШНИЙ СЧЁТ И НАСТРОЕНИЯ --- */
  const currentAccount = exports - imports - 0.012 * govDebt;
  const capitalAccount = netCapitalFlow;
  const fdi = clamp(
    s.fdi +
      (d.fdi || 0) +
      0.35 * (s.businessConfidence - 55) +
      0.2 * (financialStability - 70) -
      0.8 * (decisions.capitalTaxRate - s.capitalTaxRate) +
      gauss(NB.fdi * nMult),
    -120,
    500
  );

  const consumerConfidence = clamp(
    s.consumerConfidence +
      0.11 * (T.neutralConfidence - s.consumerConfidence) +
      0.3 * (wageGrowth - inflation) -
      0.35 * Math.max(0, unemployment - nairu) -
      0.25 * Math.max(0, inflation - 6) +
      (d.consumerConfidence || 0) +
      gauss(NB.consumerConfidence * nMult),
    0,
    100
  );
  const businessConfidence = clamp(
    s.businessConfidence +
      0.11 * (T.neutralConfidence - s.businessConfidence) +
      0.32 * (gdpGrowth - potentialGrowth) -
      0.06 * Math.max(0, bankingRisk - 50) -
      0.25 * Math.max(0, rateGap) +
      (d.businessConfidence || 0) +
      gauss(NB.businessConfidence * nMult),
    0,
    100
  );
  const ignoredDemands = (s.demands || []).filter(
    (x) => x.quartersActive >= 4
  ).length;
  const govTrust = clamp(
    s.govTrust +
      0.3 *
        ((budgetBalancePctGdp > -4 ? 0.4 : -0.5) +
          (gdpGrowth > 1 ? 0.3 : -0.3) -
          0.25 * Math.max(0, inflation - 6) -
          0.3 * Math.max(0, unemployment - 7) -
          ignoredDemands * 0.5) +
      (d.govTrust || 0) +
      gauss(0.5 * nMult),
    0,
    100
  );
  const moneySupply = clamp(
    applyAnnualGrowth(s.moneySupply, potentialGrowth + inflation) *
      (1 + (decisions.moneySupplyOp || 0) / 100) +
      (decisions.liquidity || 0) * 0.02 +
      (decisions.emergency ? 3 : 0),
    20,
    4000
  );

  /* --- 14а. ФИНАНСОВЫЙ РЫНОК: кривая доходности, облигации, акции, риск-премии --- */
  const neutralNominal = rStar + inflationExpectations;
  const sovereignExtra = C.debtLevelPremium * Math.max(0, debtToGdp - 60);
  // ожидания по ставке: чем длиннее горизонт, тем ближе к нейтральной
  const yieldAt = (h) => {
    const w = clamp(h / 5, 0, 1);
    return clamp(
      decisions.keyRate * (1 - w) +
        neutralNominal * w +
        0.25 * Math.sqrt(h) +
        riskPremium * (0.1 + 0.07 * h) +
        sovereignExtra * (0.2 + 0.08 * h),
      -2,
      60
    );
  };
  const yield3m = yieldAt(0.25);
  const yield1y = yieldAt(1);
  const yield2y = yieldAt(2);
  const yield5y = yieldAt(5);
  const yield10y = yieldAt(10);
  const curveSlope = yield10y - yield3m;
  const curveInverted = curveSlope < -0.15;
  const prevY10 = Number.isFinite(s.yield10y) ? s.yield10y : yield10y;
  const duration10y = 7.4;
  const bondReturn =
    prevY10 / QUARTERS_PER_YEAR - duration10y * (yield10y - prevY10); // % за квартал
  const bondIndex = Math.max(
    5,
    (Number.isFinite(s.bondIndex) ? s.bondIndex : 1000) * (1 + bondReturn / 100)
  );
  const sovereignSpread = Math.max(0, (riskPremium + sovereignExtra) * 100);
  const corporateSpread = Math.max(
    20,
    (riskPremium * 0.8 +
      0.32 * Math.max(0, bankNPL - 3) +
      0.35 * Math.max(0, -outputGap) +
      0.02 * Math.max(0, bankingRisk - 40)) *
      100
  );

  // акции: прибыль / ставка дисконтирования, где премия за риск растёт в кризис
  const earnings = Math.max(
    1,
    CONFIG.shares.profits *
      nominalGdp *
      (1 - decisions.profitTaxRate / 100) *
      clamp(1 + (1.7 * outputGap) / 100, 0.25, 2.2)
  );
  const equityRiskPremium = clamp(
    3.2 +
      0.055 * Math.max(0, bankingRisk - 40) +
      0.04 * Math.max(0, (s.currencyRisk || 20) - 30) +
      0.55 * Math.max(0, -outputGap) -
      (0.28 * (businessConfidence - 55)) / 5 +
      (activeCrisesPre.length ? 1.6 : 0),
    1.2,
    16
  );
  const growthTerm = clamp(
    (potentialGrowth + inflationExpectations) * 0.62,
    0,
    9
  );
  const discountRate = clamp(
    yield10y + equityRiskPremium - growthTerm,
    1.1,
    32
  );
  const fairPE = clamp(100 / discountRate, 3, 38);
  const fairIndex = (earnings * fairPE) / STOCK_NORM;
  const prevStock = Number.isFinite(s.stockIndex) ? s.stockIndex : 1000;
  const stockIndex = Math.max(
    30,
    ema(prevStock, fairIndex, 0.42) * (1 + gauss(1.6 * nMult) / 100)
  );
  const stockReturn = (stockIndex / prevStock - 1) * 100;
  const stockPE = (stockIndex * STOCK_NORM) / earnings;
  const marketCap = (stockIndex / 1000) * 1100 * (priceLevel / 100);
  const marketCapPctGdp = (marketCap / nominalGdp) * 100;

  const netInterestMarginPre = lendingRate - depositRate;
  // отраслевые индексы со своей чувствительностью
  const sect = (prev, drift) =>
    Math.max(
      45,
      (Number.isFinite(prev) ? prev : 1000) * (1 + clamp(drift, -16, 16) / 100)
    );
  const sectorBanks = sect(
    s.sectorBanks,
    stockReturn * 1.3 -
      0.45 * Math.max(0, bankNPL - 3) -
      0.12 * Math.max(0, bankingRisk - 45) +
      0.25 * (netInterestMarginPre - 3.4)
  );
  const sectorIndustry = sect(
    s.sectorIndustry,
    stockReturn * 1.05 +
      0.35 * (investmentGrowth - potentialGrowth) -
      0.22 * rateGap
  );
  const sectorConsumer = sect(
    s.sectorConsumer,
    stockReturn * 0.85 +
      0.45 * (wageGrowth - inflation) +
      0.06 * (consumerConfidence - 55)
  );
  const sectorResources = sect(
    s.sectorResources,
    stockReturn * 0.7 +
      0.14 * (commodityIndex - s.commodityIndex) +
      0.18 * fxDeprAnnual
  );

  // банковский сектор глазами рынка
  const netInterestMargin = netInterestMarginPre;
  const bankROE =
    ((bankProfit * QUARTERS_PER_YEAR) / Math.max(1, bankCapital)) * 100;
  const bankPB = clamp(
    0.35 +
      bankROE / 22 -
      Math.max(0, bankNPL - 4) * 0.07 -
      Math.max(0, bankingRisk - 50) * 0.012,
    0.08,
    2.6
  );

  // индексы полной доходности: то, по чему реально торгует частный инвестор
  const depositIndex = Math.max(
    1,
    (Number.isFinite(s.depositIndex) ? s.depositIndex : 100) *
      (1 + depositRate / 400)
  );
  const fxIndex = Math.max(
    1,
    exchangeRate *
      (1 + worldRate / 400) *
      (Number.isFinite(s.fxCarry) ? s.fxCarry : 1)
  );
  const fxCarry =
    (Number.isFinite(s.fxCarry) ? s.fxCarry : 1) * (1 + worldRate / 400);
  const corpYield = yield5y + corporateSpread / 100;
  const prevCorpYield = Number.isFinite(s.corpYield) ? s.corpYield : corpYield;
  const corpReturn =
    prevCorpYield / QUARTERS_PER_YEAR -
    4.1 * (corpYield - prevCorpYield) -
    Math.max(0, bankNPL - 3) * 0.12;
  const corpBondIndex = Math.max(
    5,
    (Number.isFinite(s.corpBondIndex) ? s.corpBondIndex : 1000) *
      (1 + corpReturn / 100)
  );
  const goldIndex = Math.max(5, (commodityIndex * exchangeRate) / 100);
  const fxVolatility = clamp(
    ema(
      Number.isFinite(s.fxVolatility) ? s.fxVolatility : 6,
      Math.abs(fxDeprAnnual) * 1.6 + 3,
      0.3
    ),
    1,
    60
  );
  const volatilityIndex = clamp(
    ema(
      Number.isFinite(s.volatilityIndex) ? s.volatilityIndex : 16,
      11 +
        2.6 * Math.abs(stockReturn) +
        0.5 * fxVolatility +
        0.16 * bankingRisk +
        (activeCrisesPre.length ? 16 : 0),
      0.38
    ),
    5,
    100
  );

  /* --- 14б. ПОЛИТИЧЕСКИЙ ЦИКЛ: рейтинг власти и выборы как жёсткий таймер --- */
  const approvalTarget = clamp(
    50 +
      2.4 * (wageGrowth - inflation) -
      3.6 * (unemployment - nairu) -
      2.2 * Math.max(0, inflation - infTarget) +
      0.22 * (govTrust - 55) +
      0.18 * (consumerConfidence - 55) +
      1.6 * (gdpGrowth - potentialGrowth),
    0,
    100
  );
  const approval = clamp(
    ema(Number.isFinite(s.approval) ? s.approval : 55, approvalTarget, 0.28),
    0,
    100
  );
  const prevToElection = Number.isFinite(s.quartersToElection)
    ? s.quartersToElection
    : CONFIG.election.cycle;
  let quartersToElection = prevToElection - 1;
  let term = s.term || 1;
  let electionResult = null;
  let mandate = s.mandate || null;
  let governmentLine = s.governmentLine || 'centrist';
  const campaign =
    quartersToElection <= CONFIG.election.campaign && quartersToElection > 0;
  if (campaign && !s.campaignActive) {
    nextQueue.push(
      makeImpulse(
        'businessConfidence',
        -6,
        'Предвыборная неопределённость: бизнес откладывает решения',
        'default',
        difficulty,
        'other'
      )
    );
    nextQueue.push(
      makeImpulse(
        'investment',
        -1.6,
        'Предвыборная неопределённость',
        'default',
        difficulty
      )
    );
    nextQueue.push(
      makeImpulse(
        'riskPremium',
        0.25,
        'Политическая неопределённость перед выборами',
        'default',
        difficulty
      )
    );
    news.push(
      mkNews(
        'gov',
        `НАЧАЛАСЬ ПРЕДВЫБОРНАЯ КАМПАНИЯ: ДО ГОЛОСОВАНИЯ ${quartersToElection} КВ.`,
        `Рейтинг власти ${Math.round(approval)} из 100 при безработице ${fmt1(
          unemployment
        )}% и инфляции ${fmt1(
          inflation
        )}%. Инвесторы берут паузу до результата, а правительство — наоборот, тратит: политический цикл всегда заканчивается счётом, который оплачивают уже после выборов.`,
        {
          priority: 8,
          chain: [
            'Кампания',
            'Неопределённость ↑',
            'Инвестиции ↓',
            'Расходы бюджета ↑',
            'Счёт после выборов',
          ],
        }
      )
    );
  }
  if (quartersToElection <= 0) {
    const margin = approval - 50;
    electionResult =
      margin >= 0 ? 'incumbent' : approval < 35 ? 'landslide' : 'opposition';
    quartersToElection = CONFIG.election.cycle;
    term += 1;
    if (electionResult === 'incumbent') {
      nextQueue.push(
        makeImpulse(
          'businessConfidence',
          4,
          'Преемственность политики после выборов',
          'default',
          difficulty,
          'other'
        )
      );
      news.push(
        mkNews(
          'gov',
          `ВЛАСТЬ СОХРАНЯЕТ МАНДАТ: РЕЙТИНГ ${Math.round(approval)}`,
          `Избиратель одобрил курс при росте ${fmt1(
            gdpGrowth
          )}%, инфляции ${fmt1(inflation)}% и безработице ${fmt1(
            unemployment
          )}%. Преемственность экономической политики — это не только про идеи, это про то, что ожидания не приходится заново заякоривать.`,
          { priority: 9 }
        )
      );
    } else {
      mandate =
        unemployment - nairu > 1.2
          ? 'jobs'
          : inflation > infTarget + 2
          ? 'prices'
          : debtToGdp > 85
          ? 'budget'
          : 'growth';
      governmentLine =
        mandate === 'jobs'
          ? 'populist'
          : mandate === 'budget'
          ? 'austerity'
          : 'technocrat';
      const shock = electionResult === 'landslide' ? 1.7 : 1;
      nextQueue.push(
        makeImpulse(
          'businessConfidence',
          -8 * shock,
          'Смена власти: бизнес ждёт новых правил',
          'default',
          difficulty,
          'other'
        )
      );
      nextQueue.push(
        makeImpulse(
          'investment',
          -2.2 * shock,
          'Смена власти и неопределённость политики',
          'default',
          difficulty
        )
      );
      nextQueue.push(
        makeImpulse(
          'riskPremium',
          0.45 * shock,
          'Смена власти: инвесторы пересматривают риск',
          'default',
          difficulty
        )
      );
      nextQueue.push(
        makeImpulse(
          'capitalFlow',
          -14 * shock,
          'Отток капитала после смены власти',
          'default',
          difficulty
        )
      );
      const MAND = {
        jobs: 'занятость любой ценой',
        prices: 'обуздать цены',
        budget: 'привести бюджет в порядок',
        growth: 'вернуть рост',
      };
      news.push(
        mkNews(
          'gov',
          electionResult === 'landslide'
            ? 'СОКРУШИТЕЛЬНОЕ ПОРАЖЕНИЕ ВЛАСТИ НА ВЫБОРАХ'
            : 'ОППОЗИЦИЯ ПОБЕЖДАЕТ НА ВЫБОРАХ',
          `Рейтинг ${Math.round(
            approval
          )} из 100 не оставил шансов. Новое правительство приходит с мандатом: ${
            MAND[mandate]
          }. Экономический курс будет переписан, а пока он переписывается, инвестиции и капитал ждут в стороне.`,
          {
            priority: 10,
            chain: [
              'Низкий рейтинг',
              'Смена власти',
              'Неопределённость ↑',
              'Инвестиции ↓',
              'Премия за риск ↑',
              'Новый курс',
            ],
          }
        )
      );
    }
  }

  /* --- 15. РИСКИ, РЕЖИМ ЭКОНОМИКИ, КАСКАД КРИЗИСОВ --- */
  const inflationRisk = clamp(
    ema(
      s.inflationRisk,
      clamp(
        Math.abs(inflation - infTarget) * 9 +
          Math.max(0, inflationExpectations - infTarget) * 6,
        0,
        100
      ),
      0.3
    ),
    0,
    100
  );
  const debtRisk = clamp(
    ema(
      s.debtRisk,
      clamp(
        Math.max(0, debtToGdp - 45) * 0.8 +
          Math.max(0, -budgetBalancePctGdp - 2) * 5 +
          Math.max(0, effectiveDebtRate - gdpGrowth - inflation) * 3,
        0,
        100
      ),
      0.3
    ),
    0,
    100
  );
  const recessionRisk = clamp(
    ema(
      s.recessionRisk,
      clamp(
        Math.max(0, -outputGap) * 11 +
          Math.max(0, unemployment - nairu) * 6 +
          Math.max(0, rateGap) * 4,
        0,
        100
      ),
      0.3
    ),
    0,
    100
  );
  const currencyRisk = clamp(
    ema(
      s.currencyRisk || 20,
      clamp(
        Math.max(0, (-currentAccount / Math.max(1, nominalGdp)) * 100) * 9 +
          Math.max(0, 200 - reserves) * 0.12 +
          Math.max(0, riskPremium - 2) * 8,
        0,
        100
      ),
      0.3
    ),
    0,
    100
  );

  const recessionStreak =
    outputGap < CONFIG.thresholds.recessionGap
      ? (s.recessionStreak || 0) + 1
      : 0;
  const regimeStreakPrev = s.regimeStreak || 0;
  const fxMovePct = Math.abs(fxDeprAnnual);
  const activeCrises = [];
  if (bankingRisk >= CONFIG.thresholds.bankingRisk || bankCapitalAdequacy < 8)
    activeCrises.push('banking');
  if (debtRisk >= CONFIG.thresholds.debtRisk) activeCrises.push('debt');
  if (fxMovePct >= CONFIG.thresholds.currencyMovePct || fxBreak)
    activeCrises.push('currency');
  if (
    inflation >=
      Math.max(CONFIG.thresholds.stagflationInflation, infTarget + 2.5) &&
    outputGap <= CONFIG.thresholds.stagflationGap
  )
    activeCrises.push('stagflation');
  else if (recessionStreak >= CONFIG.thresholds.recessionGapQuarters)
    activeCrises.push('recession');
  if (outputGap >= CONFIG.thresholds.overheatGap && inflation > infTarget + 1)
    activeCrises.push('overheating');
  if (inflation < CONFIG.thresholds.deflation && outputGap < -1)
    activeCrises.push('deflation');

  const regime = activeCrises.includes('currency')
    ? 'currency'
    : activeCrises.includes('banking')
    ? 'banking'
    : activeCrises.includes('debt')
    ? 'debt'
    : activeCrises.includes('stagflation')
    ? 'stagflation'
    : activeCrises.includes('deflation')
    ? 'deflation'
    : activeCrises.includes('overheating')
    ? 'overheating'
    : activeCrises.includes('recession')
    ? 'recession'
    : 'normal';

  const prevCrises = s.activeCrises || [];
  activeCrises
    .filter((c) => !prevCrises.includes(c))
    .forEach((c) => {
      if (c === 'banking') {
        nextQueue.push(
          makeImpulse(
            'investment',
            -4.5,
            'Банковский кризис: кредит недоступен',
            'default',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse(
            'consumption',
            -1.8,
            'Банковский кризис: сжатие потребительского кредита',
            'default',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse(
            'bankLiquidity',
            -10,
            'Банковский кризис',
            'fast',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse(
            'capitalFlow',
            -20,
            'Бегство из банковской системы',
            'default',
            difficulty
          )
        );
        news.push(
          mkNews(
            'crisis',
            'БАНКОВСКИЙ КРИЗИС: КРЕДИТОВАНИЕ ОСТАНОВЛЕНО',
            'Капитал банков не покрывает потери. Экстренная поддержка спасёт систему, но ударит по доверию к ЦБ и разгонит денежную массу.',
            {
              priority: 10,
              chain: [
                'Потери банков',
                'Капитал ↓',
                'Кредит ↓',
                'Инвестиции ↓',
                'ВВП ↓',
                'Просрочка ↑',
              ],
            }
          )
        );
      } else if (c === 'debt') {
        nextQueue.push(
          makeImpulse(
            'riskPremium',
            1.8,
            'Долговой кризис: инвесторы требуют премию',
            'fast',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse(
            'capitalFlow',
            -30,
            'Долговой кризис: отток капитала',
            'default',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse('govTrust', -8, 'Долговой кризис', 'fast', difficulty)
        );
        news.push(
          mkNews(
            'crisis',
            'ДОЛГОВОЙ КРИЗИС: ИНВЕСТОРЫ ТРЕБУЮТ ПРЕМИЮ',
            'Каждый новый выпуск долга дороже предыдущего. Спираль «дефицит → ставка → процентные расходы → дефицит» запущена.',
            {
              priority: 10,
              chain: [
                'Долг ↑',
                'Премия за риск ↑',
                'Ставка по долгу ↑',
                'Расходы на проценты ↑',
                'Дефицит ↑',
              ],
            }
          )
        );
      } else if (c === 'currency') {
        nextQueue.push(
          makeImpulse(
            'inflationSupply',
            1.6,
            'Валютный кризис: удорожание импорта',
            'fast',
            difficulty
          )
        );
        nextQueue.push(
          makeImpulse(
            'consumerConfidence',
            -8,
            'Валютный кризис',
            'fast',
            difficulty
          )
        );
        news.push(
          mkNews(
            'crisis',
            'ВАЛЮТНЫЙ КРИЗИС: РЕЗКОЕ ДВИЖЕНИЕ КУРСА',
            'Курс переносится в цены. Защищать его резервами — тратить их, отпустить — принять импортную инфляцию.',
            {
              priority: 10,
              chain: [
                'Отток капитала',
                'Курс ↓',
                'Импортные цены ↑',
                'Инфляция ↑',
                'Реальные доходы ↓',
              ],
            }
          )
        );
      } else if (c === 'stagflation') {
        news.push(
          mkNews(
            'crisis',
            'СТАГФЛЯЦИЯ: СПАД И ИНФЛЯЦИЯ ОДНОВРЕМЕННО',
            'Ставку вверх — углубить спад; ставку вниз — сорвать ожидания. У этой ситуации нет решения без потерь.',
            { priority: 10 }
          )
        );
      } else if (c === 'overheating') {
        news.push(
          mkNews(
            'crisis',
            'ЭКОНОМИКА ПЕРЕГРЕТА',
            'Выпуск устойчиво выше потенциала: дальнейший спрос уходит в цены, а не в производство.',
            { priority: 9 }
          )
        );
      } else if (c === 'recession') {
        news.push(
          mkNews(
            'crisis',
            'РЕЦЕССИЯ: ВЫПУСК НИЖЕ ПОТЕНЦИАЛА',
            'Второй квартал подряд. Затяжная безработица поднимает и сам естественный уровень — часть потерь станет необратимой.',
            { priority: 9 }
          )
        );
      } else if (c === 'deflation') {
        news.push(
          mkNews(
            'crisis',
            'ДЕФЛЯЦИОННАЯ УГРОЗА',
            'Цены почти не растут при слабом спросе: реальная ставка высока даже при нулевой ключевой. Обычных инструментов может не хватить.',
            { priority: 9 }
          )
        );
      }
    });

  /* --- 16. ПОЛИТИЧЕСКОЕ ДАВЛЕНИЕ --- */
  const demandCandidates = [];
  if (decisions.incomeTaxRate > 28 || decisions.vatRate > 23)
    demandCandidates.push({
      id: 'tax_cut',
      actor: 'Население',
      text: 'Налоговая нагрузка невыносима — требуют снижения налогов.',
    });
  if (lendingRate - inflation > 6 && businessConfidence < 50)
    demandCandidates.push({
      id: 'rate_cut',
      actor: 'Бизнес',
      text: 'Реальная стоимость кредита душит инвестиции — требуют снизить ставку.',
    });
  if (debtToGdp > 85)
    demandCandidates.push({
      id: 'debt_cut',
      actor: 'Инвесторы',
      text: 'Долговая нагрузка выше комфортного уровня — требуют бюджетной консолидации.',
    });
  if (unemployment > 7.5)
    demandCandidates.push({
      id: 'social_up',
      actor: 'Парламент',
      text: 'Безработица высока — требуют расширить социальные выплаты.',
    });
  if (inflation > 8)
    demandCandidates.push({
      id: 'infl_down',
      actor: 'Профсоюзы',
      text: 'Инфляция съедает зарплаты — требуют вернуть цены под контроль.',
    });
  if (shadowShare > 22)
    demandCandidates.push({
      id: 'shadow',
      actor: 'Налоговая служба',
      text: 'Бизнес массово уходит в тень — база размывается быстрее, чем растут ставки.',
    });
  const prevDemands = s.demands || [];
  const demands = demandCandidates.map((c) => {
    const prev = prevDemands.find((p) => p.id === c.id);
    return { ...c, quartersActive: prev ? prev.quartersActive + 1 : 1 };
  });

  /* --- 17. ПЯТЬ НЕЗАВИСИМЫХ ОЦЕНОК --- */
  const scores = computeScores({
    inflation,
    inflationExpectations,
    outputGap,
    cbCredibility,
    gdpGrowth,
    unemployment,
    nairu,
    consumerConfidence,
    humanCapitalIndex,
    bankingRisk,
    creditGap,
    bankCapitalAdequacy,
    capitalRequirement: decisions.capitalRequirement,
    currencyRisk,
    reserves,
    imports,
    debtToGdp,
    budgetBalancePctGdp,
    interestPayment,
    govRevenue,
    shadowShare,
    potentialGrowth,
    infrastructureIndex,
    productivity,
    inflationTarget: infTarget,
  });
  const {
    scoreStability,
    scoreWelfare,
    scoreFinancial,
    scoreFiscal,
    scorePotential,
    wellbeing,
  } = scores;
  const interestToRevenue = (interestPayment / Math.max(1, govRevenue)) * 100;

  // конфликт политик: ЦБ ужесточает, когда бюджет стимулирует (или наоборот) — произведение стансов > 0
  const policyConflict = clamp(
    Math.max(0, (s.cbStance || 0) * (s.mofStance || 0)),
    0,
    1
  );
  const policyCoordination = clamp(
    s.policyCoordination + 3.0 - 16 * policyConflict,
    0,
    100
  );

  const newEconomy = {
    gdp,
    nominalGdp,
    priceLevel,
    gdpGrowth,
    potentialGdp,
    potentialGrowth,
    outputGap,
    gdpPerCapita: (gdp * 1000) / CONFIG.population,
    consumption,
    businessInvestment,
    govPurchasesReal,
    govInvestmentReal,
    transfersReal,
    consumptionGrowth,
    investmentGrowth,
    govPurchasesGrowth: actualGrowthG,
    transfersGrowth: actualGrowthTr,
    govInvestmentGrowth: actualGrowthIg,
    sequesterFactor,
    maxDeficitPct,
    exports,
    imports,
    tradeBalance: exports - imports,
    currentAccount,
    capitalAccount,
    netCapitalFlow,
    reserves,
    fdi,
    exchangeRate,
    realExchangeRate,
    fxDeprAnnual,
    fxRegime: decisions.fxRegime,
    fxTarget,
    importPriceInflation,
    inflationTarget: infTarget,
    defenseIntervention,
    capitalStock,
    laborForce,
    productivity,
    humanCapitalIndex,
    infrastructureIndex,
    supplyScar,
    tfpGrowth,
    unemployment,
    prevUnemployment: s.unemployment,
    employment,
    nairu,
    tightness,
    vacancyRate,
    wageGrowth,
    unitLaborCostGrowth,
    inflation,
    coreInflation,
    inflationExpectations,
    cbCredibility,
    importPriceInfl: importPriceInflation,
    keyRate: decisions.keyRate,
    reserveReq: decisions.reserveReq,
    capitalRequirement: decisions.capitalRequirement,
    lendingRate,
    depositRate,
    realLendingRate,
    realPolicyRate,
    rStar,
    rateGap,
    policyStance,
    riskPremium,
    moneySupply,
    carry,
    creditVolume,
    creditGrowth,
    creditGap,
    creditGapLag,
    creditTrendRatio,
    creditImpulse,
    creditCrunch,
    bankNPL,
    bankCapital,
    bankCapitalAdequacy,
    bankLiquidity,
    bankProfit,
    loanLosses,
    bankingRisk,
    financialStability,
    incomeTaxRate: decisions.incomeTaxRate,
    profitTaxRate: decisions.profitTaxRate,
    vatRate: decisions.vatRate,
    exciseRate: decisions.exciseRate,
    capitalTaxRate: decisions.capitalTaxRate,
    socialContribRate: decisions.socialContribRate,
    shadowShare,
    taxWedgeValue: wedgeNow,
    revenueParts,
    govRevenue,
    revenuePctGdp,
    govPurchasesNominal,
    transfersNominal,
    govInvestmentNominal,
    govSpendingTotal,
    interestPayment,
    interestToRevenue,
    budgetBalance,
    budgetBalancePctGdp,
    structuralBalancePctGdp,
    primaryBalance,
    fiscalImpulse,
    govDebt,
    debtToGdp,
    effectiveDebtRate,
    budgetShares,
    sovereignFund,
    fundPctGdp,
    netDebtToGdp,
    fundIncome,
    consumerConfidence,
    businessConfidence,
    govTrust,
    policyCoordination,
    approval,
    quartersToElection,
    term,
    mandate,
    governmentLine,
    electionResult,
    campaignActive: campaign,
    worldGdpGrowth,
    worldInflation,
    worldRate,
    commodityIndex,
    worldDemandIndex,
    inflationRisk,
    debtRisk,
    recessionRisk,
    currencyRisk,
    bankingRiskValue: bankingRisk,
    yield3m,
    yield1y,
    yield2y,
    yield5y,
    yield10y,
    curveSlope,
    curveInverted,
    bondIndex,
    bondReturn,
    sovereignSpread,
    corporateSpread,
    stockIndex,
    stockReturn,
    stockPE,
    fairPE,
    equityRiskPremium,
    earnings,
    marketCap,
    marketCapPctGdp,
    sectorBanks,
    sectorIndustry,
    sectorConsumer,
    sectorResources,
    netInterestMargin,
    bankROE,
    bankPB,
    fxVolatility,
    volatilityIndex,
    discountRate,
    depositIndex,
    fxIndex,
    fxCarry,
    corpBondIndex,
    corpYield,
    corpReturn,
    goldIndex,
    activeCrises,
    regime,
    recessionStreak,
    demands,
    regimeStreak: s.regime === regime ? regimeStreakPrev + 1 : 1,
    scoreStability,
    scoreWelfare,
    scoreFinancial,
    scoreFiscal,
    scorePotential,
    wellbeing,
    cbStance: s.cbStance || 0,
    mofStance: s.mofStance || 0,
    botHeadline: botAction ? botAction.headline : null,
    botDemand: botAction ? botAction.demand : null,
  };

  const byHeadline = (h) =>
    log
      .filter((c) => c.headline === h)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 6);
  const reasons = {
    gdpGrowth: byHeadline('gdpGrowth'),
    inflation: byHeadline('inflation'),
    exchangeRate: byHeadline('exchangeRate'),
    budget: byHeadline('budget'),
    unemployment: byHeadline('unemployment'),
    banking: byHeadline('banking'),
    potential: byHeadline('potential'),
  };
  const report = buildReport({
    prev: s,
    next: newEconomy,
    quarterIndex,
    reasons,
  });

  // сюжеты: запуск новых цепочек и продвижение уже идущих
  const activeStories = [...(stories || []), ...newStories];
  storyTriggers(s, newEconomy, decisions, activeStories, cooldowns).forEach(
    (id) => {
      activeStories.push({ tplId: id, nextIdx: 0, wait: 0 });
      cooldowns[`story:${id}`] = 10;
    }
  );
  const advanced = advanceStories(activeStories, newEconomy, quarterIndex);
  const generated = generateNews(
    s,
    newEconomy,
    decisions,
    quarterIndex,
    botAction,
    cooldowns
  );
  const editorial = mkNews(
    'editorial',
    `ИТОГИ ${quarterLabel(quarterIndex).toUpperCase()}`,
    report,
    { priority: 2 }
  );
  const allNews = [...news, ...advanced.news, ...generated, editorial]
    .map((n) => ({ ...n, q: quarterIndex, qLabel: quarterLabel(quarterIndex) }))
    .sort((a, b) => b.priority - a.priority);

  return {
    economy: newEconomy,
    pendingImpulses: nextQueue,
    eventCooldowns: cooldowns,
    reasons,
    report,
    newsEntries: allNews,
    stories: advanced.stories,
  };
}

/* =========================================================================================
   НОВОСТНОЙ ДВИЖОК: заголовки генерируются из состояния модели, а события разворачиваются
   в многоквартальные сюжеты (цепочки последствий), а не в одно сообщение.
========================================================================================= */
const ru = (v) => String(v).replace('.', ',');
const rf1 = (v) => ru(fmt1(v));
const rf2 = (v) => ru(fmt2(v));
const rfs = (v) => ru(fmtSigned1(v));
let __newsId = 1;
function mkNews(cat, headline, text, opts) {
  const o = opts || {};
  return {
    id: `n${__newsId++}`,
    cat,
    headline,
    text,
    priority: o.priority || 4,
    chain: o.chain || null,
    storyId: o.storyId || null,
    storyTitle: o.storyTitle || null,
    step: o.step || null,
    steps: o.steps || null,
    tag: o.tag || null,
  };
}

/* ----------------------- СЮЖЕТЫ: цепочки последствий ----------------------- */
const STORY_TEMPLATES = {
  commodity_down: {
    id: 'commodity_down',
    title: 'Падение сырьевых цен',
    steps: [
      {
        make: (s) =>
          mkNews(
            'world',
            `МИРОВЫЕ ЦЕНЫ НА СЫРЬЁ ПАДАЮТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
            'Сырьевые рынки развернулись вниз. Для экспортёров это прямой удар по выручке, для бюджета — по доходам, а дальше цепочка дойдёт до курса и цен в магазинах.',
            {
              priority: 7,
              chain: [
                'Сырьё ↓',
                'Экспортная выручка ↓',
                'Доходы бюджета ↓',
                'Курс ↓',
                'Импортные цены ↑',
                'Реальные доходы ↓',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'markets',
            `ЭКСПОРТ СОКРАЩАЕТСЯ ДО ${fmtMoney(s.exports)}`,
            `Экспортная выручка падает вслед за ценами. Текущий счёт ${fmtMoneySigned(
              s.currentAccount
            )} — приток валюты в страну слабеет, и это уже вопрос курса.`,
            { priority: 6 }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          s.budgetBalancePctGdp < 0
            ? mkNews(
                'gov',
                `БЮДЖЕТ НЕДОСЧИТЫВАЕТСЯ ДОХОДОВ: ДЕФИЦИТ ${rf1(
                  Math.abs(s.budgetBalancePctGdp)
                )}% ВВП`,
                `Сужение налоговой базы экспортёров бьёт по доходам казны при долге ${rf1(
                  s.debtToGdp
                )}% ВВП — Минфину предстоит выбирать между сокращением расходов и займами.`,
                { priority: 6 }
              )
            : mkNews(
                'gov',
                `БЮДЖЕТ ВЫДЕРЖАЛ СЫРЬЕВОЙ УДАР: ПРОФИЦИТ ${rf1(
                  s.budgetBalancePctGdp
                )}% ВВП`,
                `Доходы от экспортёров просели, но запас прочности бюджета оказался достаточным. Долг ${rf1(
                  s.debtToGdp
                )}% ВВП, резервный фонд ${fmtMoney(s.sovereignFund || 0)}.`,
                { priority: 5 }
              ),
      },
      {
        gap: 1,
        make: (s) =>
          s.fxDeprAnnual > 0.5
            ? mkNews(
                'markets',
                `ВАЛЮТА СЛАБЕЕТ: ${rfs(s.fxDeprAnnual)}% В ГОДОВОМ ВЫРАЖЕНИИ`,
                'Платёжный баланс ухудшился — валюта пошла вниз. Следующий шаг цепочки предсказуем: дорожает импорт.',
                { priority: 6 }
              )
            : mkNews(
                'markets',
                'КУРС УСТОЯЛ ВОПРЕКИ УХУДШЕНИЮ БАЛАНСА',
                'Отток валюты по торговому счёту компенсирован притоком капитала или интервенциями. Импортная инфляция в этот раз не придёт — но резервы и доверие инвесторов не бесконечны.',
                { priority: 5 }
              ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'households',
            `ИМПОРТ ДОРОЖАЕТ, РЕАЛЬНЫЕ ЗАРПЛАТЫ ${
              s.wageGrowth - s.inflation >= 0 ? 'ЕДВА РАСТУТ' : 'ПАДАЮТ'
            }`,
            `Цены импорта растут на ${rf1(
              s.importPriceInflation
            )}% в год при инфляции ${rf1(
              s.inflation
            )}%. Зарплаты прибавляют ${rf1(
              s.wageGrowth
            )}% — реальный доход ${rfs(
              s.wageGrowth - s.inflation
            )}%. Замыкающее звено цепочки — уровень жизни.`,
            { priority: 6 }
          ),
      },
    ],
  },
  oil_up: {
    id: 'oil_up',
    title: 'Сырьевой рост',
    steps: [
      {
        make: (s) =>
          mkNews(
            'world',
            `СЫРЬЁ ДОРОЖАЕТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
            'Мировые цены на сырьё пошли вверх. Для экспортёра это валютная выручка, для импортёра — удар по издержкам.',
            {
              priority: 6,
              chain: [
                'Сырьё ↑',
                'Торговый баланс',
                'Курс',
                'Издержки и цены',
                'Решение ЦБ',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          s.tradeBalance >= 0
            ? mkNews(
                'markets',
                `ПРИТОК ВАЛЮТЫ УКРЕПЛЯЕТ ПОЗИЦИИ: ТОРГОВЫЙ БАЛАНС ${fmtMoneySigned(
                  s.tradeBalance
                )}`,
                'Экспортная выручка растёт быстрее импорта. Крепкий курс сдержит инфляцию, но ударит по конкурентоспособности несырьевых отраслей.',
                { priority: 5 }
              )
            : mkNews(
                'business',
                `ИЗДЕРЖКИ ПРОИЗВОДСТВА РАСТУТ ВСЛЕД ЗА СЫРЬЁМ`,
                `Экономика покупает сырьё дороже, чем продаёт. Инфляция ${rf1(
                  s.inflation
                )}% — и это инфляция издержек, которую ставкой лечить больнее всего.`,
                { priority: 6 }
              ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'cb',
            `ЦБ ОЦЕНИВАЕТ ПЕРЕНОС СЫРЬЕВЫХ ЦЕН: ОЖИДАНИЯ ${rf1(
              s.inflationExpectations
            )}%`,
            `Ключевой вопрос — закрепится ли ценовой шок в ожиданиях. Пока доверие к ЦБ ${Math.round(
              s.cbCredibility
            )} из 100, и от него зависит, придётся ли жертвовать выпуском.`,
            { priority: 5 }
          ),
      },
    ],
  },
  global_rate_hike: {
    id: 'global_rate_hike',
    title: 'Ужесточение в мире',
    steps: [
      {
        make: (s) =>
          mkNews(
            'world',
            `МИРОВЫЕ СТАВКИ РАСТУТ ДО ${rf1(s.worldRate)}%`,
            'Крупнейшие центробанки ужесточают политику. Капитал разворачивается в сторону безопасных активов — развивающиеся рынки первыми чувствуют отток.',
            {
              priority: 7,
              chain: [
                'Мировые ставки ↑',
                'Отток капитала',
                'Курс ↓',
                'Импортные цены ↑',
                'Ставка ЦБ ↑',
                'Кредит ↓',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'markets',
            `ОТТОК КАПИТАЛА: ${fmtMoneySigned(
              s.netCapitalFlow
            )} В ГОДОВОМ ВЫРАЖЕНИИ`,
            `Разница реальных ставок с миром ${rfs(
              s.carry
            )} п.п. при премии за риск ${rf1(
              s.riskPremium
            )} п.п. Инвесторы уходят — резервы ${fmtMoney(s.reserves)}.`,
            { priority: 6 }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'cb',
            `ДАВЛЕНИЕ НА КУРС СТАВИТ ЦБ ПЕРЕД ВЫБОРОМ`,
            `Валюта ${
              s.fxDeprAnnual > 0
                ? `слабеет на ${rf1(s.fxDeprAnnual)}% годовых`
                : 'держится'
            }, инфляция ${rf1(
              s.inflation
            )}%. Поднять ставку — задушить кредит; не поднимать — импортировать инфляцию.`,
            { priority: 6 }
          ),
      },
    ],
  },
  bank_run: {
    id: 'bank_run',
    title: 'Банковская паника',
    steps: [
      {
        make: (s) =>
          mkNews(
            'crisis',
            'ВКЛАДЧИКИ ЗАБИРАЮТ ДЕНЬГИ ИЗ БАНКОВ',
            `Ликвидность банковской системы упала до ${Math.round(
              s.bankLiquidity
            )} из 100. Банки сокращают выдачу новых кредитов, чтобы удержать наличность.`,
            {
              priority: 9,
              chain: [
                'Отток депозитов',
                'Ликвидность ↓',
                'Кредит ↓',
                'Инвестиции ↓',
                'ВВП ↓',
                'Просрочка ↑',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'business',
            `КРЕДИТ ДЛЯ БИЗНЕСА ПЕРЕСЫХАЕТ: РОСТ ПОРТФЕЛЯ ${rfs(
              s.creditGrowth
            )}%`,
            `Ставка по кредитам ${rf1(
              s.lendingRate
            )}%, достаточность капитала банков ${rf1(
              s.bankCapitalAdequacy
            )}%. Компании откладывают инвестиционные проекты.`,
            { priority: 7 }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'households',
            `РЫНОК ТРУДА ЧУВСТВУЕТ КРЕДИТНОЕ СЖАТИЕ: БЕЗРАБОТИЦА ${rf1(
              s.unemployment
            )}%`,
            `Сокращение инвестиций дошло до занятости. Разрыв выпуска ${rfs(
              s.outputGap
            )}% — и чем дольше он отрицательный, тем выше естественный уровень безработицы в будущем.`,
            { priority: 7 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'markets',
            `ПРОСРОЧКА РАСТЁТ ДО ${rf1(s.bankNPL)}%: ПЕТЛЯ ЗАМКНУЛАСЬ`,
            'Слабая экономика возвращается в банки неплатежами, неплатежи съедают капитал, капитал ограничивает кредит. Разорвать круг можно только извне — рекапитализацией или смягчением политики.',
            { priority: 8 }
          ),
      },
    ],
  },
  sanctions: {
    id: 'sanctions',
    title: 'Внешние ограничения',
    steps: [
      {
        make: (s) =>
          mkNews(
            'world',
            'ВВЕДЕНЫ ВНЕШНИЕ ОГРАНИЧЕНИЯ НА ТОРГОВЛЮ И ФИНАНСЫ',
            'Часть торговых и финансовых каналов закрыта. Экономика теряет не только спрос, но и производственные возможности: это шок предложения.',
            {
              priority: 9,
              chain: [
                'Ограничения',
                'Экспорт и импорт ↓',
                'Отток капитала',
                'Курс ↓',
                'Инфляция ↑',
                'Потенциал ↓',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'markets',
            `КУРС ПОД ДАВЛЕНИЕМ, ПРЕМИЯ ЗА РИСК ${rf1(s.riskPremium)} П.П.`,
            `Инвесторы требуют больше за страновой риск, новый госдолг обходится в ${rf1(
              s.effectiveDebtRate
            )}%. Резервы ${fmtMoney(
              s.reserves
            )} — вопрос, тратить ли их на защиту курса.`,
            { priority: 7 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'business',
            `ПОТЕНЦИАЛЬНЫЙ ВЫПУСК СНИЖАЕТСЯ: РОСТ ПОТЕНЦИАЛА ${rf1(
              s.potentialGrowth
            )}%`,
            'Разорванные цепочки поставок — это не временная просадка спроса, а утраченные мощности. Стимулировать такую экономику деньгами значит получить инфляцию без выпуска.',
            { priority: 7 }
          ),
      },
    ],
  },
  pandemic: {
    id: 'pandemic',
    title: 'Пандемия',
    steps: [
      {
        make: (s) =>
          mkNews(
            'crisis',
            'ВСПЫШКА ЗАБОЛЕВАНИЯ: ОГРАНИЧЕНИЯ ЭКОНОМИЧЕСКОЙ АКТИВНОСТИ',
            'Одновременно падают и спрос, и предложение. Редкий случай, когда бюджетная поддержка нужна быстрее денежной.',
            {
              priority: 9,
              chain: [
                'Ограничения',
                'Спрос ↓ и мощности ↓',
                'Безработица ↑',
                'Расходы бюджета ↑',
                'Долг ↑',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'households',
            `БЕЗРАБОТИЦА ${rf1(
              s.unemployment
            )}%, ДОВЕРИЕ НАСЕЛЕНИЯ ${Math.round(s.consumerConfidence)}`,
            'Домохозяйства сокращают расходы и наращивают сбережения. Трансферты сейчас работают сильнее обычного: склонность тратить у людей без дохода максимальна.',
            { priority: 7 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'gov',
            `СЧЁТ ЗА КРИЗИС: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
            `Поддержка экономики оплачена займами. Обслуживание долга забирает ${rf1(
              s.interestToRevenue
            )}% доходов бюджета — это уже структурное ограничение на будущую политику.`,
            { priority: 6 }
          ),
      },
    ],
  },
  tech_breakthrough: {
    id: 'tech_breakthrough',
    title: 'Технологический скачок',
    steps: [
      {
        make: (s) =>
          mkNews(
            'business',
            `ТЕХНОЛОГИЧЕСКИЙ ПРОРЫВ: ПРОИЗВОДИТЕЛЬНОСТЬ ${rf1(s.productivity)}`,
            'Новые технологии повышают совокупную факторную производительность. Это редкий шок, который одновременно увеличивает выпуск и снижает инфляцию.',
            {
              priority: 6,
              chain: [
                'Производительность ↑',
                'Потенциал ↑',
                'Издержки ↓',
                'Реальные зарплаты ↑',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'households',
            `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rfs(s.wageGrowth - s.inflation)}%`,
            `Рост производительности позволяет платить больше без инфляции: удельные издержки труда ${rf1(
              s.unitLaborCostGrowth
            )}%. Потенциальный рост ВВП ${rf1(s.potentialGrowth)}%.`,
            { priority: 5 }
          ),
      },
    ],
  },
  supply_chain: {
    id: 'supply_chain',
    title: 'Шок предложения',
    steps: [
      {
        make: (s) =>
          mkNews(
            'world',
            'НАРУШЕНЫ ЦЕПОЧКИ ПОСТАВОК',
            'Логистика встала: часть производственных мощностей физически не может работать. Это не падение спроса — это падение того, сколько экономика вообще способна произвести.',
            { priority: 8 }
          ),
      },
      {
        make: (s) =>
          mkNews(
            'business',
            'СБОИ ПОСТАВОК: ИЗДЕРЖКИ РАСТУТ, ПОТЕНЦИАЛ СНИЖАЕТСЯ',
            `Шок предложения: рост потенциала упал до ${rf1(
              s.potentialGrowth
            )}%. Обратите внимание на разрыв выпуска ${rfs(
              s.outputGap
            )}% — он расширяется не потому, что производство выросло, а потому, что сократились сами возможности экономики. Тот же выпуск теперь перегревает страну.`,
            {
              priority: 8,
              chain: [
                'Сбои поставок',
                'Потенциал ↓',
                'Разрыв выпуска ↑ при том же выпуске',
                'Издержки ↑',
                'Инфляция ↑',
                'Дилемма ЦБ',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'cb',
            `ДИЛЕММА ЦБ: ИНФЛЯЦИЯ ${rf1(
              s.inflation
            )}% ПРИ РАЗРЫВЕ ВЫПУСКА ${rfs(s.outputGap)}%`,
            `Ожидания ${rf1(
              s.inflationExpectations
            )}%. Подавлять инфляцию — углублять спад. Терпеть — рисковать срывом ожиданий, после которого возврат к цели обойдётся дороже.`,
            { priority: 8 }
          ),
      },
    ],
  },
  demographic: {
    id: 'demographic',
    title: 'Демографический сдвиг',
    steps: [
      {
        make: (s) =>
          mkNews(
            'households',
            'СТАРЕНИЕ НАСЕЛЕНИЯ СЖИМАЕТ РАБОЧУЮ СИЛУ',
            'Предложение труда сокращается. В краткосрочной перспективе это разгон зарплат, в долгосрочной — более низкий потенциальный рост и более низкая нейтральная ставка.',
            {
              priority: 6,
              chain: [
                'Рабочая сила ↓',
                'Зарплаты ↑',
                'Потенциал ↓',
                'Нагрузка на бюджет ↑',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'gov',
            `СОЦИАЛЬНЫЕ ОБЯЗАТЕЛЬСТВА ДАВЯТ НА БЮДЖЕТ: БАЛАНС ${rfs(
              s.budgetBalancePctGdp
            )}% ВВП`,
            `Меньше работников — меньше налоговая база, больше получателей выплат. Нейтральная ставка r* опустилась до ${rf1(
              s.rStar
            )}%: это меняет всю шкалу того, что считать жёсткой политикой.`,
            { priority: 6 }
          ),
      },
    ],
  },
  consumer_boom: {
    id: 'consumer_boom',
    title: 'Потребительский бум',
    steps: [
      {
        make: (s) =>
          mkNews(
            'households',
            'ДОМОХОЗЯЙСТВА НАРАЩИВАЮТ РАСХОДЫ И СПРОС НА КРЕДИТ',
            'Потребительский оптимизм разгоняет спрос. Пока есть свободные мощности, это рост; когда они закончатся — инфляция.',
            {
              priority: 6,
              chain: [
                'Спрос ↑',
                'Разрыв выпуска ↑',
                'Инфляция ↑',
                'Реакция ЦБ',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          s.outputGap > 1.5
            ? mkNews(
                'markets',
                `ЭКОНОМИКА ПЕРЕГРЕВАЕТСЯ: РАЗРЫВ ВЫПУСКА ${rfs(s.outputGap)}%`,
                `Инфляция ${rf1(s.inflation)}% при безработице ${rf1(
                  s.unemployment
                )}% — ниже естественного уровня. Дефицит работников толкает зарплаты вверх на ${rf1(
                  s.wageGrowth
                )}%.`,
                { priority: 7 }
              )
            : mkNews(
                'business',
                'СПРОС АБСОРБИРОВАН БЕЗ ПЕРЕГРЕВА',
                `Экономика переварила всплеск спроса: разрыв выпуска ${rfs(
                  s.outputGap
                )}%, инфляция ${rf1(
                  s.inflation
                )}%. Свободные мощности сделали своё дело.`,
                { priority: 4 }
              ),
      },
    ],
  },
  /* --- сюжеты, которые запускает сам игрок --- */
  rate_hike: {
    id: 'rate_hike',
    title: 'Ужесточение денежной политики',
    steps: [
      {
        make: (s) =>
          mkNews(
            'cb',
            `КЛЮЧЕВАЯ СТАВКА ПОВЫШЕНА ДО ${rf2(s.keyRate)}%`,
            `ЦБ ужесточает политику при инфляции ${rf1(
              s.inflation
            )}% и ожиданиях ${rf1(
              s.inflationExpectations
            )}%. Реальная ставка ${rfs(
              s.realPolicyRate
            )}% против нейтральной ${rf1(
              s.rStar
            )}% — рынок закладывает замедление кредитования.`,
            {
              priority: 8,
              chain: [
                'Ставка ↑',
                'Ставка по кредитам ↑',
                'Кредит ↓',
                'Инвестиции и спрос ↓',
                'Безработица ↑',
                'Инфляция ↓ через 3–5 кв.',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'markets',
            `БАНКИ ПЕРЕНОСЯТ СТАВКУ В КРЕДИТЫ: ${rf1(s.lendingRate)}%`,
            `Перенос ключевой ставки в рыночные идёт с лагом. Рост кредитного портфеля ${rfs(
              s.creditGrowth
            )}%, спрос на заёмные деньги остывает.`,
            { priority: 6 }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'business',
            `ИНВЕСТИЦИИ ЗАМЕДЛЯЮТСЯ: ${rfs(s.investmentGrowth)}%`,
            `Дорогие деньги переписывают инвестиционные планы. Доверие бизнеса ${Math.round(
              s.businessConfidence
            )}, разрыв выпуска ${rfs(s.outputGap)}%.`,
            { priority: 6 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'households',
            `ЦЕНА ДЕЗИНФЛЯЦИИ: БЕЗРАБОТИЦА ${rf1(
              s.unemployment
            )}%, ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
            `Замедление цен оплачено занятостью — это и есть коэффициент жертв. Ожидания ${rf1(
              s.inflationExpectations
            )}%: чем выше доверие к ЦБ, тем дешевле обходится такой манёвр.`,
            { priority: 7 }
          ),
      },
    ],
  },
  rate_cut: {
    id: 'rate_cut',
    title: 'Смягчение денежной политики',
    steps: [
      {
        make: (s) =>
          mkNews(
            'cb',
            `КЛЮЧЕВАЯ СТАВКА СНИЖЕНА ДО ${rf2(s.keyRate)}%`,
            `ЦБ смягчает условия при разрыве выпуска ${rfs(
              s.outputGap
            )}% и инфляции ${rf1(s.inflation)}%. Реальная ставка ${rfs(
              s.realPolicyRate
            )}% против нейтральной ${rf1(s.rStar)}%.`,
            {
              priority: 7,
              chain: [
                'Ставка ↓',
                'Кредит ↑',
                'Спрос ↑',
                'Занятость ↑',
                'Инфляция ↑ с лагом',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'business',
            `КРЕДИТ ОЖИВАЕТ: ПОРТФЕЛЬ ${rfs(s.creditGrowth)}%`,
            `Инвестиции ${rfs(
              s.investmentGrowth
            )}%, доверие бизнеса ${Math.round(
              s.businessConfidence
            )}. Кредитный разрыв ${rfs(
              s.creditGap
            )} п.п. ВВП — за этим показателем стоит следить: сегодняшний бум завтра вернётся просрочкой.`,
            { priority: 6 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'cb',
            `ПРОВЕРКА ОЖИДАНИЙ: ${rf1(s.inflationExpectations)}% ПРИ ЦЕЛИ 4%`,
            `Инфляция ${rf1(s.inflation)}%, доверие к ЦБ ${Math.round(
              s.cbCredibility
            )}. Если ожидания сдвинулись вверх, возврат к цели обойдётся дороже, чем стоило смягчение.`,
            { priority: 6 }
          ),
      },
    ],
  },
  vat_hike: {
    id: 'vat_hike',
    title: 'Повышение НДС',
    steps: [
      {
        make: (s) =>
          mkNews(
            'gov',
            `НДС ПОВЫШЕН ДО ${rf1(s.vatRate)}%`,
            `Минфин закрывает дефицит ${rf1(
              Math.abs(s.budgetBalancePctGdp)
            )}% ВВП за счёт косвенного налога. Цены отреагируют почти сразу — это разовый скачок, но ожидания могут его подхватить.`,
            {
              priority: 7,
              chain: [
                'НДС ↑',
                'Цены ↑ сразу',
                'Реальные доходы ↓',
                'Спрос ↓',
                'База налога ↓',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'households',
            `ЦЕНЫ В МАГАЗИНАХ РАСТУТ: ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
            `Реальные зарплаты ${rfs(
              s.wageGrowth - s.inflation
            )}%, доверие населения ${Math.round(
              s.consumerConfidence
            )}. Косвенный налог всегда платит покупатель.`,
            { priority: 6 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'gov',
            `СБОР НАЛОГОВ: ${rf1(
              s.revenuePctGdp
            )}% ВВП, ТЕНЕВАЯ ЭКОНОМИКА ${rf1(s.shadowShare)}%`,
            'База реагирует на ставку медленно, но необратимо: часть оборота уходит в тень и обратно возвращается неохотно.',
            { priority: 6 }
          ),
      },
    ],
  },
  social_boost: {
    id: 'social_boost',
    title: 'Социальный пакет',
    steps: [
      {
        make: (s) =>
          mkNews(
            'gov',
            'ПРАВИТЕЛЬСТВО РАСШИРЯЕТ СОЦИАЛЬНЫЕ ВЫПЛАТЫ',
            `Выплаты растут при безработице ${rf1(
              s.unemployment
            )}% и разрыве выпуска ${rfs(
              s.outputGap
            )}%. Мультипликатор трансфертов тем выше, чем больше в экономике свободных мощностей.`,
            {
              priority: 7,
              chain: [
                'Выплаты ↑',
                'Располагаемый доход ↑',
                'Потребление ↑',
                'Спрос ↑',
                'Дефицит ↑',
              ],
            }
          ),
      },
      {
        gap: 1,
        make: (s) =>
          mkNews(
            'households',
            `ПОТРЕБЛЕНИЕ РАЗГОНЯЕТСЯ: ${rfs(s.consumptionGrowth)}%`,
            `Доверие населения ${Math.round(
              s.consumerConfidence
            )}, реальные доходы ${rfs(
              s.wageGrowth - s.inflation
            )}%. Деньги дошли до спроса — вопрос, дойдут ли до выпуска или до цен.`,
            { priority: 6 }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'markets',
            `СЧЁТ ЗА ЩЕДРОСТЬ: ДЕФИЦИТ ${rf1(
              Math.abs(s.budgetBalancePctGdp)
            )}% ВВП, ДОЛГ ${rf1(s.debtToGdp)}%`,
            `Премия за риск ${rf1(
              s.riskPremium
            )} п.п., ставка по новому долгу ${rf1(
              s.effectiveDebtRate
            )}%. Трансферты почти не повышают потенциал — в отличие от инвестиций.`,
            { priority: 7 }
          ),
      },
    ],
  },
  credit_boom: {
    id: 'credit_boom',
    title: 'Кредитный бум',
    steps: [
      {
        make: (s) =>
          mkNews(
            'markets',
            `КРЕДИТНЫЙ БУМ: РАЗРЫВ ${rfs(s.creditGap)} П.П. ВВП`,
            `Портфель растёт на ${rfs(
              s.creditGrowth
            )}% при номинальном ВВП заметно медленнее. Пока просрочка низкая — ${rf1(
              s.bankNPL
            )}%, но именно так начинаются все банковские кризисы.`,
            {
              priority: 7,
              chain: [
                'Дешёвый кредит',
                'Долговая нагрузка ↑',
                'Просрочка ↑ через 2–3 года',
                'Капитал банков ↓',
                'Кредитное сжатие',
              ],
            }
          ),
      },
      {
        gap: 4,
        make: (s) =>
          mkNews(
            'markets',
            `НАСЛЕДИЕ БУМА: ПРОСРОЧКА ${rf1(s.bankNPL)}%`,
            `Выданные в лёгкие времена кредиты выходят на просрочку. Достаточность капитала банков ${rf1(
              s.bankCapitalAdequacy
            )}% при требовании ${rf1(s.capitalRequirement)}%.`,
            { priority: 7 }
          ),
      },
      {
        gap: 3,
        make: (s) =>
          s.bankCapitalAdequacy < s.capitalRequirement + 1.5
            ? mkNews(
                'crisis',
                'БАНКИ УПИРАЮТСЯ В НОРМАТИВ КАПИТАЛА',
                `Капитал ${fmtMoney(
                  s.bankCapital
                )} больше не позволяет наращивать портфель. Кредитное сжатие ударит по инвестициям, инвестиции — по ВВП, ВВП — снова по просрочке.`,
                { priority: 9 }
              )
            : mkNews(
                'markets',
                'БАНКОВСКАЯ СИСТЕМА ПЕРЕВАРИЛА БУМ',
                `Достаточность капитала ${rf1(
                  s.bankCapitalAdequacy
                )}% — запас прочности выдержал. Кредитный цикл прошёл без срыва.`,
                { priority: 5 }
              ),
      },
    ],
  },
  debt_spiral: {
    id: 'debt_spiral',
    title: 'Долговая спираль',
    steps: [
      {
        make: (s) =>
          mkNews(
            'gov',
            `ГОСДОЛГ ПРЕВЫСИЛ ${Math.round(s.debtToGdp / 5) * 5}% ВВП`,
            `Обслуживание забирает ${rf1(
              s.interestToRevenue
            )}% доходов бюджета при ставке ${rf1(
              s.effectiveDebtRate
            )}%. Пока номинальный рост экономики выше ставки, долг стабилизируется сам; если нет — начинается спираль.`,
            {
              priority: 8,
              chain: [
                'Долг ↑',
                'Премия за риск ↑',
                'Ставка по долгу ↑',
                'Процентные расходы ↑',
                'Дефицит ↑',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'markets',
            `ИНВЕСТОРЫ ТРЕБУЮТ ПРЕМИЮ: ${rf1(s.riskPremium)} П.П.`,
            `Каждый новый выпуск дороже предыдущего: средняя ставка по долгу ${rf1(
              s.effectiveDebtRate
            )}% против номинального роста ВВП около ${rf1(
              s.gdpGrowth + s.inflation
            )}%. Это арифметика, из которой не выйти обещаниями.`,
            { priority: 8 }
          ),
      },
    ],
  },
  credit_crunch: {
    id: 'credit_crunch',
    title: 'Кредитное сжатие',
    steps: [
      {
        make: (s) =>
          mkNews(
            'crisis',
            'КАПИТАЛ БАНКОВ ОГРАНИЧИЛ ВЫДАЧУ КРЕДИТОВ',
            `Достаточность капитала ${rf1(
              s.bankCapitalAdequacy
            )}% при требовании ${rf1(
              s.capitalRequirement
            )}%: спрос на кредит есть, предложения нет. Снижение ставки в такой ситуации почти не работает.`,
            {
              priority: 9,
              chain: [
                'Капитал ↓',
                'Предложение кредита ↓',
                'Инвестиции ↓',
                'ВВП ↓',
                'Просрочка ↑',
                'Капитал ↓',
              ],
            }
          ),
      },
      {
        gap: 2,
        make: (s) =>
          mkNews(
            'business',
            `ЭКОНОМИКА БЕЗ КРЕДИТА: ИНВЕСТИЦИИ ${rfs(s.investmentGrowth)}%`,
            `Разрыв выпуска ${rfs(s.outputGap)}%, безработица ${rf1(
              s.unemployment
            )}%. Разорвать петлю можно рекапитализацией банков или смягчением норматива — у обоих решений есть цена.`,
            { priority: 8 }
          ),
      },
    ],
  },
};

function advanceStories(stories, next, quarterIndex) {
  const out = [];
  const keep = [];
  for (const st of stories || []) {
    const tpl = STORY_TEMPLATES[st.tplId];
    if (!tpl) continue;
    if (st.wait > 0) {
      keep.push({ ...st, wait: st.wait - 1 });
      continue;
    }
    const step = tpl.steps[st.nextIdx];
    if (!step) continue;
    const item = step.make(next);
    if (item)
      out.push({
        ...item,
        q: quarterIndex,
        storyId: tpl.id,
        storyTitle: tpl.title,
        step: st.nextIdx + 1,
        steps: tpl.steps.length,
      });
    const nextIdx = st.nextIdx + 1;
    if (nextIdx < tpl.steps.length)
      keep.push({
        tplId: st.tplId,
        nextIdx,
        wait: (tpl.steps[nextIdx].gap || 1) - 1,
      });
  }
  return { news: out, stories: keep };
}

/* Что запускает новый сюжет: решения игрока и накопленные состояния */
function storyTriggers(prev, next, decisions, active, cooldowns) {
  const fire = [];
  const busy = (id) =>
    active.some((x) => x.tplId === id) || (cooldowns[`story:${id}`] || 0) > 0;
  const dRate = decisions.keyRate - prev.keyRate;
  if (dRate >= 0.75 && !busy('rate_hike')) fire.push('rate_hike');
  if (dRate <= -0.75 && !busy('rate_cut')) fire.push('rate_cut');
  if (decisions.vatRate - prev.vatRate >= 0.5 && !busy('vat_hike'))
    fire.push('vat_hike');
  if (
    decisions.transfers >= 3 &&
    prev.transfersGrowth < next.transfersGrowth &&
    !busy('social_boost')
  )
    fire.push('social_boost');
  if (next.creditGap > 5.5 && !busy('credit_boom')) fire.push('credit_boom');
  if (next.creditCrunch && !prev.creditCrunch && !busy('credit_crunch'))
    fire.push('credit_crunch');
  if (
    next.debtToGdp > 80 &&
    Math.floor(next.debtToGdp / 10) > Math.floor(prev.debtToGdp / 10) &&
    !busy('debt_spiral')
  )
    fire.push('debt_spiral');
  return fire;
}

/* ----------------------- ЕЖЕКВАРТАЛЬНАЯ ЛЕНТА ----------------------- */
function generateNews(prev, s, decisions, quarterIndex, botAction, cd) {
  const out = [];
  const push = (cat, headline, text, priority, chain) =>
    out.push({
      ...mkNews(cat, headline, text, { priority, chain }),
      q: quarterIndex,
    });
  // одна и та же тема не повторяется каждый квартал
  const once = (key, gap) => {
    if ((cd[`news:${key}`] || 0) > 0) return false;
    cd[`news:${key}`] = gap;
    return true;
  };
  const tgt = Number.isFinite(s.inflationTarget)
    ? s.inflationTarget
    : CONFIG.target.inflation;
  const T = CONFIG.target;

  /* 🏦 ЦЕНТРАЛЬНЫЙ БАНК */
  const dRate = s.keyRate - prev.keyRate;
  if (Math.abs(dRate) > 0.01 && Math.abs(dRate) < 0.75) {
    push(
      'cb',
      `${dRate > 0 ? 'ЦБ ПОВЫШАЕТ' : 'ЦБ СНИЖАЕТ'} КЛЮЧЕВУЮ СТАВКУ ДО ${rf2(
        s.keyRate
      )}%`,
      `Шаг ${rfs(dRate)} п.п. при инфляции ${rf1(s.inflation)}% и цели ${rf1(
        tgt
      )}%. Реальная ставка ${rfs(s.realPolicyRate)}% против нейтральной ${rf1(
        s.rStar
      )}% — условия ${
        s.rateGap > 0.3
          ? 'жёстче нейтральных'
          : s.rateGap < -0.3
          ? 'мягче нейтральных'
          : 'близки к нейтральным'
      }.`,
      6
    );
  } else if (
    Math.abs(dRate) < 0.01 &&
    Math.abs(s.inflation - tgt) > 2 &&
    once('hold', 4)
  ) {
    push(
      'cb',
      `ЦБ СОХРАНЯЕТ СТАВКУ ${rf2(s.keyRate)}% ПРИ ИНФЛЯЦИИ ${rf1(
        s.inflation
      )}%`,
      `Бездействие — тоже решение. Ожидания ${rf1(
        s.inflationExpectations
      )}%, доверие к ЦБ ${Math.round(s.cbCredibility)} из 100.`,
      5
    );
  }
  const dTarget =
    tgt -
    (Number.isFinite(prev.inflationTarget)
      ? prev.inflationTarget
      : CONFIG.target.inflation);
  if (Math.abs(dTarget) > 0.01) {
    push(
      'cb',
      `ЦБ ${dTarget > 0 ? 'ПОВЫШАЕТ' : 'СНИЖАЕТ'} ЦЕЛЬ ПО ИНФЛЯЦИИ ДО ${rf2(
        tgt
      )}%`,
      `Смена цели — не бухгалтерская правка, а заявление о намерениях. Доверие к ЦБ ${Math.round(
        s.cbCredibility
      )}: ожидания будут привыкать к новой цифре не один квартал, а пока они плавают, любое решение по ставке работает хуже.`,
      9,
      [
        'Смена цели',
        'Доверие ↓',
        'Ожидания плывут',
        'Цена управления инфляцией ↑',
      ]
    );
  }
  if (
    decisions.fxRegime !== 'free' &&
    Math.abs((decisions.fxTarget || 0) - (prev.fxTarget || 0)) > 0.5
  ) {
    push(
      'cb',
      `ЦБ ОБЪЯВЛЯЕТ НОВЫЙ ОРИЕНТИР КУРСА: ${rf1(decisions.fxTarget)}`,
      `Защита ориентира оплачивается резервами: сейчас ${fmtMoney(
        s.reserves
      )}, расход на удержание курса ${fmtMoneySigned(
        s.defenseIntervention || 0
      )} в год.`,
      8
    );
  }
  if (decisions.emergency) {
    push(
      'cb',
      'ЦБ ЗАПУСКАЕТ ЭКСТРЕННУЮ ПОДДЕРЖКУ БАНКОВ',
      `Капитал банковской системы пополнен, ликвидность восстановлена до ${Math.round(
        s.bankLiquidity
      )}. Плата — денежная эмиссия, инфляционный след и −доверие к ЦБ.`,
      9,
      [
        'Экстренная помощь',
        'Капитал банков ↑',
        'Денежная масса ↑',
        'Инфляция ↑',
        'Доверие к ЦБ ↓',
      ]
    );
  }
  if (s.cbCredibility < 40 && prev.cbCredibility >= 40) {
    push(
      'cb',
      `ДОВЕРИЕ К ЦБ ПАДАЕТ ДО ${Math.round(
        s.cbCredibility
      )}: ОЖИДАНИЯ СРЫВАЮТСЯ С ЯКОРЯ`,
      `Инфляционные ожидания ${rf1(s.inflationExpectations)}% вместо цели ${rf1(
        tgt
      )}%. Теперь любое снижение инфляции потребует большего падения выпуска, чем раньше.`,
      9,
      ['Доверие ↓', 'Ожидания ↑', 'Кривая Филлипса хуже', 'Цена дезинфляции ↑']
    );
  }
  if (Math.abs(decisions.moneySupplyOp || 0) > 0.5 && once('qe', 2)) {
    push(
      'cb',
      `ЦБ ${
        decisions.moneySupplyOp > 0 ? 'ВЫКУПАЕТ АКТИВЫ' : 'ИЗЫМАЕТ ЛИКВИДНОСТЬ'
      }: ${rfs(decisions.moneySupplyOp)}% ДЕНЕЖНОЙ МАССЫ`,
      `Нестандартные операции при ставке ${rf2(
        s.keyRate
      )}%. Эффект на спрос быстрый, на цены — отложенный.`,
      6
    );
  }
  if (decisions.fxRegime !== prev.fxRegime) {
    push(
      'cb',
      `СМЕНА ВАЛЮТНОГО РЕЖИМА: ${
        decisions.fxRegime === 'free'
          ? 'СВОБОДНОЕ ПЛАВАНИЕ'
          : decisions.fxRegime === 'managed'
          ? 'УПРАВЛЯЕМЫЙ КУРС'
          : 'ФИКСИРОВАННЫЙ КУРС'
      }`,
      `Резервы ${fmtMoney(
        s.reserves
      )}. Фиксировать курс значит обменивать инфляцию на резервы — пока резервы есть.`,
      8
    );
  }

  /* 🏛 ПРАВИТЕЛЬСТВО */
  const taxChanges = [
    ['vatRate', 'НДС'],
    ['incomeTaxRate', 'ПОДОХОДНЫЙ НАЛОГ'],
    ['profitTaxRate', 'НАЛОГ НА ПРИБЫЛЬ'],
    ['exciseRate', 'АКЦИЗЫ'],
    ['capitalTaxRate', 'НАЛОГ НА КАПИТАЛ'],
    ['socialContribRate', 'СОЦИАЛЬНЫЕ ВЗНОСЫ'],
  ];
  taxChanges.forEach(([key, label]) => {
    const dv = s[key] - prev[key];
    if (key === 'vatRate' && dv >= 0.5) return; // о повышении НДС рассказывает отдельный сюжет
    if (Math.abs(dv) > 0.01) {
      push(
        'gov',
        `${label} ${dv > 0 ? 'ПОВЫШЕН' : 'СНИЖЕН'} ДО ${rf1(s[key])}%`,
        `Доходы бюджета ${rf1(s.revenuePctGdp)}% ВВП, теневая экономика ${rf1(
          s.shadowShare
        )}%. ${
          dv > 0
            ? 'Ставка растёт быстрее, чем доходы: часть базы уходит из-под налога.'
            : 'Выпадающие доходы придётся компенсировать — займами или расходами.'
        }`,
        6,
        dv > 0
          ? [
              'Ставка ↑',
              'Собираемость ↓',
              'Теневая экономика ↑',
              'База ↓',
              'Доходы ↑ слабее ожидаемого',
            ]
          : null
      );
    }
  });
  if (Math.abs(s.fiscalImpulse) > 0.35 && once('fiscalImpulse', 4)) {
    push(
      'gov',
      `БЮДЖЕТНЫЙ ИМПУЛЬС ${rfs(s.fiscalImpulse)} П.П. ВВП`,
      `Мультипликатор сейчас ${
        s.outputGap < -1
          ? 'высокий: свободные мощности превращают расходы в выпуск'
          : 'низкий: экономика близка к пределу, деньги уходят в цены'
      }. Дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП.`,
      6
    );
  }
  if (s.interestToRevenue > 15 && prev.interestToRevenue <= 15) {
    push(
      'gov',
      `ОБСЛУЖИВАНИЕ ДОЛГА ЗАБИРАЕТ ${rf1(
        s.interestToRevenue
      )}% ДОХОДОВ БЮДЖЕТА`,
      'Проценты вытесняют из бюджета всё остальное — прежде всего инвестиции и образование, то есть будущий рост.',
      8
    );
  }
  const dSci = s.budgetShares.science - prev.budgetShares.science;
  const dEdu = s.budgetShares.education - prev.budgetShares.education;
  if ((Math.abs(dSci) > 0.4 || Math.abs(dEdu) > 0.4) && once('shares', 8)) {
    push(
      'gov',
      `ПРИОРИТЕТЫ БЮДЖЕТА МЕНЯЮТСЯ: НАУКА ${rf1(
        s.budgetShares.science
      )}%, ОБРАЗОВАНИЕ ${rf1(s.budgetShares.education)}%`,
      `Эти статьи не дают эффекта в этом квартале. Они меняют производительность и человеческий капитал — потенциальный рост сейчас ${rf1(
        s.potentialGrowth
      )}%.`,
      5,
      [
        'Наука и образование',
        'Человеческий капитал ↑',
        'Производительность ↑',
        'Потенциальный ВВП ↑ через годы',
      ]
    );
  }

  /* 📊 РЫНКИ */
  if (Math.abs(s.fxDeprAnnual) > 6 && once('fx', 3)) {
    push(
      'markets',
      `ВАЛЮТА ${s.fxDeprAnnual > 0 ? 'ПАДАЕТ' : 'УКРЕПЛЯЕТСЯ'}: ${rfs(
        s.fxDeprAnnual
      )}% В ГОДОВОМ ВЫРАЖЕНИИ`,
      `Текущий счёт ${fmtMoneySigned(
        s.currentAccount
      )}, приток капитала ${fmtMoneySigned(
        s.netCapitalFlow
      )}, резервы ${fmtMoney(s.reserves)}. Перенос курса в цены импорта: ${rf1(
        s.importPriceInflation
      )}%.`,
      7,
      s.fxDeprAnnual > 0
        ? [
            'Отток валюты',
            'Курс ↓',
            'Импорт дорожает',
            'Инфляция ↑',
            'Реальные доходы ↓',
          ]
        : null
    );
  }
  if (s.riskPremium - prev.riskPremium > 0.35 && once('risk', 5)) {
    push(
      'markets',
      `ПРЕМИЯ ЗА СТРАНОВОЙ РИСК РАСТЁТ ДО ${rf1(s.riskPremium)} П.П.`,
      `Инвесторы закладывают долг ${rf1(
        s.debtToGdp
      )}% ВВП, банковский риск ${Math.round(
        s.bankingRisk
      )} и согласованность политики ${Math.round(
        s.policyCoordination
      )} из 100. Дороже становится всё: госдолг, кредит, капитал.`,
      7
    );
  }
  if (s.reserves < 150 && prev.reserves >= 150) {
    push(
      'markets',
      `РЕЗЕРВЫ СОКРАТИЛИСЬ ДО ${fmtMoney(s.reserves)}`,
      'Запас прочности для защиты курса тает. Если режим не свободный, рынок начнёт проверять его на прочность.',
      8
    );
  }
  if (s.bankNPL > 7 && s.bankNPL - prev.bankNPL > 0.25 && once('npl', 4)) {
    push(
      'markets',
      `ПРОСРОЧКА В БАНКАХ ДОСТИГЛА ${rf1(s.bankNPL)}%`,
      `Убытки съедают капитал: достаточность ${rf1(
        s.bankCapitalAdequacy
      )}% при требовании ${rf1(
        s.capitalRequirement
      )}%. Прибыль сектора ${fmtMoneySigned(s.bankProfit)} за квартал.`,
      8,
      [
        'Просрочка ↑',
        'Убытки ↑',
        'Капитал ↓',
        'Кредитование ↓',
        'ВВП ↓',
        'Просрочка ↑',
      ]
    );
  }

  /* 🏭 БИЗНЕС */
  if (
    s.investmentGrowth < -3 &&
    prev.investmentGrowth >= -3 &&
    once('inv', 5)
  ) {
    push(
      'business',
      `ИНВЕСТИЦИИ ПАДАЮТ НА ${rf1(Math.abs(s.investmentGrowth))}%`,
      `Реальная ставка по кредитам ${rf1(
        s.realLendingRate
      )}% против нейтральных ${rf1(
        s.rStar + 2
      )}%. Сокращение инвестиций сегодня — это меньший капитал и меньший потенциал завтра.`,
      7
    );
  }
  if (s.businessConfidence < 40 && prev.businessConfidence >= 40) {
    push(
      'business',
      `ДЕЛОВЫЕ НАСТРОЕНИЯ УХУДШАЮТСЯ: ИНДЕКС ${Math.round(
        s.businessConfidence
      )}`,
      `Компании откладывают найм и инвестиции. Разрыв выпуска ${rfs(
        s.outputGap
      )}%, банковский риск ${Math.round(s.bankingRisk)}.`,
      6
    );
  }
  if (s.tfpGrowth > prev.tfpGrowth + 0.15 && once('tfp', 6)) {
    push(
      'business',
      `ПРОИЗВОДИТЕЛЬНОСТЬ УСКОРЯЕТСЯ: ${rf1(s.tfpGrowth)}% В ГОД`,
      `Индекс TFP ${rf1(s.productivity)}, инфраструктура ${rf1(
        s.infrastructureIndex
      )}. Единственный источник роста, который не оплачивается инфляцией.`,
      5
    );
  }

  /* 👥 НАСЕЛЕНИЕ */
  const realWage = s.wageGrowth - s.inflation;
  const prevRealWage = prev.wageGrowth - prev.inflation;
  if (realWage < 0 && prevRealWage >= 0) {
    push(
      'households',
      `РЕАЛЬНЫЕ ЗАРПЛАТЫ ПЕРЕШЛИ К ПАДЕНИЮ: ${rfs(realWage)}%`,
      `Номинальный рост ${rf1(s.wageGrowth)}% не поспевает за инфляцией ${rf1(
        s.inflation
      )}%. Дальше — слабое потребление и требования индексации.`,
      7,
      ['Инфляция ↑', 'Реальные доходы ↓', 'Потребление ↓', 'Спрос ↓']
    );
  } else if (realWage > 3 && prevRealWage <= 3) {
    push(
      'households',
      `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rf1(realWage)}%`,
      `При напряжённости рынка труда ${rfs(
        s.tightness
      )} п.п. и производительности ${rf1(s.tfpGrowth)}% рост зарплат ${
        realWage > s.tfpGrowth + 1.5
          ? 'опережает производительность — это будущая инфляция издержек'
          : 'обеспечен производительностью'
      }.`,
      6
    );
  }
  if (s.unemployment - prev.unemployment > 0.35 && once('unemp', 4)) {
    push(
      'households',
      `БЕЗРАБОТИЦА РАСТЁТ ДО ${rf1(s.unemployment)}%`,
      `Естественный уровень ${rf1(s.nairu)}% — разрыв ${rfs(
        s.unemployment - s.nairu
      )} п.п. Долгая безработица поднимает и сам естественный уровень: часть потерь станет необратимой.`,
      7
    );
  }
  if (s.tightness > 1.2 && prev.tightness <= 1.2) {
    push(
      'households',
      `ДЕФИЦИТ РАБОТНИКОВ: БЕЗРАБОТИЦА ${rf1(
        s.unemployment
      )}% НИЖЕ ЕСТЕСТВЕННОЙ`,
      `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты ускоряются до ${rf1(
        s.wageGrowth
      )}%. Низкая безработица не бесплатна: удельные издержки труда ${rf1(
        s.unitLaborCostGrowth
      )}% переходят в цены.`,
      7,
      [
        'Безработица ↓',
        'Дефицит кадров',
        'Зарплаты ↑',
        'Издержки ↑',
        'Инфляция ↑',
        'Ставка ↑',
      ]
    );
  }
  if (s.consumerConfidence < 35 && prev.consumerConfidence >= 35) {
    push(
      'households',
      `ПОТРЕБИТЕЛЬСКИЕ НАСТРОЕНИЯ НА МИНИМУМЕ: ${Math.round(
        s.consumerConfidence
      )}`,
      'Домохозяйства переходят к сберегательной модели. Спрос будет слабым даже при снижении ставки.',
      6
    );
  }

  /* 🌍 МИР */
  if (
    Math.abs(s.worldGdpGrowth - prev.worldGdpGrowth) > 0.5 &&
    once('world', 5)
  ) {
    push(
      'world',
      `МИРОВАЯ ЭКОНОМИКА ${
        s.worldGdpGrowth > prev.worldGdpGrowth ? 'УСКОРЯЕТСЯ' : 'ЗАМЕДЛЯЕТСЯ'
      }: ${rf1(s.worldGdpGrowth)}%`,
      `Внешний спрос — это ваш экспорт ${fmtMoney(
        s.exports
      )}. Индекс мирового спроса ${rf1(s.worldDemandIndex)}.`,
      5
    );
  }
  if (Math.abs(s.commodityIndex - prev.commodityIndex) > 6 && once('comm', 4)) {
    push(
      'world',
      `СЫРЬЕВОЙ ИНДЕКС ${
        s.commodityIndex > prev.commodityIndex ? 'РАСТЁТ' : 'ПАДАЕТ'
      } ДО ${rf1(s.commodityIndex)}`,
      `Торговый баланс ${fmtMoneySigned(s.tradeBalance)}: страна ${
        s.tradeBalance >= 0 ? 'выигрывает от дорогого сырья' : 'платит за него'
      }.`,
      5
    );
  }

  /* ⚠️ КРИЗИС / РЕЖИМ */
  if (s.regime !== prev.regime && REGIME_INFO[s.regime]) {
    const info = REGIME_INFO[s.regime];
    push(
      'crisis',
      `ЭКОНОМИКА ПЕРЕХОДИТ В РЕЖИМ: ${info.label.toUpperCase()}`,
      info.text,
      s.regime === 'normal' ? 6 : 10
    );
  }

  /* 📊 РЫНОК */
  if (s.stockReturn < -9 && once('crash', 3)) {
    push(
      'markets',
      `ОБВАЛ НА ФОНДОВОМ РЫНКЕ: ИНДЕКС ${rf1(s.stockReturn)}%`,
      `Индекс опустился до ${rf1(s.stockIndex)}, капитализация ${rf1(
        s.marketCapPctGdp
      )}% ВВП. Ставка дисконтирования выросла до ${rf1(
        s.discountRate
      )}% — рынок пересчитал будущие прибыли по новой цене денег. Индекс страха ${rf1(
        s.volatilityIndex
      )}.`,
      8,
      [
        'Ставка ↑ / риск ↑',
        'Дисконт ↑',
        'Оценка активов ↓',
        'Капитализация ↓',
        'Богатство и залоги ↓',
      ]
    );
  } else if (s.stockReturn > 9 && once('rally', 4)) {
    push(
      'markets',
      `РАЛЛИ НА РЫНКЕ АКЦИЙ: ИНДЕКС ${rfs(s.stockReturn)}%`,
      `Капитализация выросла до ${rf1(s.marketCapPctGdp)}% ВВП при P/E ${rf1(
        s.stockPE
      )}. Дешёвые деньги поднимают цены активов быстрее, чем прибыли — именно так надуваются пузыри, которые потом приходится разбирать ставкой.`,
      6
    );
  }
  if (s.curveInverted && !prev.curveInverted && once('invert', 6)) {
    push(
      'markets',
      `КРИВАЯ ДОХОДНОСТИ ИНВЕРТИРОВАЛАСЬ: ${rf1(s.curveSlope)} П.П.`,
      `Короткие ставки ${rf1(s.yield3m)}% выше длинных ${rf1(
        s.yield10y
      )}%. Рынок фактически говорит: нынешняя жёсткость сломает спрос, и ставку придётся снижать. Исторически это лучший из ранних сигналов рецессии.`,
      8,
      [
        'Ставка ↑',
        'Ожидания снижения',
        'Инверсия кривой',
        'Рецессия через 3–6 кв.',
      ]
    );
  }
  if (
    s.sovereignSpread > 400 &&
    s.sovereignSpread - (prev.sovereignSpread || 0) > 60 &&
    once('spread', 4)
  ) {
    push(
      'markets',
      `СУВЕРЕННЫЙ СПРЕД РАСШИРИЛСЯ ДО ${Math.round(s.sovereignSpread)} Б.П.`,
      `Занимать становится дорого: доходность 10 лет ${rf1(
        s.yield10y
      )}% при долге ${rf1(s.debtToGdp)}% ВВП. Корпоративный спред ${Math.round(
        s.corporateSpread
      )} б.п. — стоимость денег растёт для всех, а не только для бюджета.`,
      8
    );
  }
  if (s.bankPB < 0.35 && once('bankpb', 6)) {
    push(
      'markets',
      `РЫНОК ОЦЕНИВАЕТ БАНКИ ДЕШЕВЛЕ ИХ КАПИТАЛА: P/B ${rf2(s.bankPB)}`,
      `Инвесторы не верят в отчётный капитал: просрочка ${rf1(
        s.bankNPL
      )}%, рентабельность ${rf1(
        s.bankROE
      )}%. Привлечь новый капитал с рынка в таком состоянии почти невозможно — а именно он ограничивает кредитование.`,
      8,
      [
        'Просрочка ↑',
        'Прибыль ↓',
        'Оценка банков ↓',
        'Капитал не привлечь',
        'Кредит ↓',
      ]
    );
  }

  /* 💬 ГОЛОСА: субъективные реакции людей на то, что происходит */
  const realW = s.wageGrowth - s.inflation;
  const VOICES = [
    {
      id: 'pensioner_infl',
      p: 8,
      when: () => s.inflation > 7,
      q: '«Я перестала смотреть на ценники — всё равно они другие каждую неделю»',
      who: 'Тамара Николаевна, 68 лет, получатель социальных выплат',
      t: () =>
        `Инфляция ${rf1(
          s.inflation
        )}% при индексации выплат, отстающей от цен. Для людей с фиксированным доходом инфляция — это не показатель, а прямой вычет из тарелки.`,
    },
    {
      id: 'mortgage',
      p: 7,
      when: () => s.lendingRate > 11,
      q: '«Ставка по кредиту такая, что мы просто отложили покупку квартиры»',
      who: 'Артём и Лена, семья из областного центра',
      t: () =>
        `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(
          s.inflation
        )}%. Жёсткая политика работает именно так: сначала отменяются чужие планы, и только потом замедляются цены.`,
    },
    {
      id: 'smb',
      p: 7,
      when: () => s.rateGap > 1.2 || s.creditCrunch,
      q: '«Банк не отказал напрямую — просто перестал отвечать»',
      who: 'Игорь, владелец мебельного производства, 40 сотрудников',
      t: () =>
        `${
          s.creditCrunch
            ? 'Капитал банков упёрся в норматив'
            : 'Кредит подорожал'
        }: рост портфеля ${rfs(
          s.creditGrowth
        )}%. Малый бизнес чувствует денежную политику раньше статистики.`,
    },
    {
      id: 'worker',
      p: 8,
      when: () => s.unemployment > s.nairu + 1.2,
      q: '«На заводе третий месяц неполная неделя»',
      who: 'Сергей, оператор линии',
      t: () =>
        `Безработица ${rf1(s.unemployment)}% против естественных ${rf1(
          s.nairu
        )}%. За разрывом выпуска ${rfs(
          s.outputGap
        )}% стоят конкретные смены, которых больше нет.`,
    },
    {
      id: 'hr',
      p: 6,
      when: () => s.tightness > 1.0,
      q: '«Мы поднимаем зарплату дважды в год и всё равно не закрываем вакансии»',
      who: 'Марина, директор по персоналу в логистике',
      t: () =>
        `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты растут на ${rf1(
          s.wageGrowth
        )}%. Дефицит кадров приятен для работника и тяжёл для цен.`,
    },
    {
      id: 'trader',
      p: 6,
      when: () => Math.abs(s.fxDeprAnnual) > 7 || s.riskPremium > 3,
      q: '«Рынок торгует не вашей статистикой, а доверием к ней»',
      who: 'Дмитрий, управляющий портфелем',
      t: () =>
        `Премия за риск ${rf1(s.riskPremium)} п.п., курс ${rfs(
          s.fxDeprAnnual
        )}% годовых. Резервы ${fmtMoney(
          s.reserves
        )} — цифра, которую считают все, кто решает, оставаться ли в стране.`,
    },
    {
      id: 'econ_hawk',
      p: 7,
      when: () => s.inflationExpectations > tgt + 2,
      q: '«Проблема уже не в ценах, а в том, что в цель никто не верит»',
      who: 'Ольга Р., экономист, колонка в деловом еженедельнике',
      t: () =>
        `Ожидания ${rf1(s.inflationExpectations)}% при цели ${rf1(
          tgt
        )}%. Заякоренные ожидания — это бесплатный инструмент, а разъякоренные приходится выкупать безработицей.`,
    },
    {
      id: 'econ_dove',
      p: 6,
      when: () => s.outputGap < -2.5 && s.inflation < tgt + 1,
      q: '«Мы лечим болезнь, которой нет, и получаем ту, что есть»',
      who: 'Павел К., профессор макроэкономики',
      t: () =>
        `Разрыв выпуска ${rfs(s.outputGap)}% при инфляции ${rf1(
          s.inflation
        )}%. Держать жёсткие условия, когда спрос и так слаб, — значит превращать циклическую безработицу в структурную.`,
    },
    {
      id: 'union',
      p: 7,
      when: () => realW < -1,
      q: '«Индексация ниже инфляции — это не повышение, это торг о размере потери»',
      who: 'Представитель профсоюза работников транспорта',
      t: () =>
        `Реальные зарплаты ${rfs(realW)}% при росте номинальных ${rf1(
          s.wageGrowth
        )}%. Требования индексации — следующий пункт повестки, а за ними инфляция издержек.`,
    },
    {
      id: 'biz_tax',
      p: 7,
      when: () => s.taxWedgeValue > 42 || s.shadowShare > 20,
      q: '«Половина знакомых перешла на серые схемы — не от жадности, а от арифметики»',
      who: 'Анна, бухгалтер, ведёт два десятка ИП',
      t: () =>
        `Теневая экономика ${rf1(s.shadowShare)}% при налоговом клине ${rf1(
          s.taxWedgeValue
        )}. База уходит тихо и возвращается неохотно — даже если ставки потом снизить.`,
    },
    {
      id: 'depositor',
      p: 9,
      when: () => s.bankingRisk > 60,
      q: '«В очереди у банкомата стояли люди, которые никогда там не стояли»',
      who: 'Наблюдение корреспондента в областном центре',
      t: () =>
        `Банковский риск ${Math.round(
          s.bankingRisk
        )} из 100, ликвидность ${Math.round(
          s.bankLiquidity
        )}. Паника — единственный экономический процесс, который разгоняет сам себя быстрее, чем кто-либо успевает среагировать.`,
    },
    {
      id: 'optimist',
      p: 5,
      when: () =>
        s.gdpGrowth > 3 &&
        s.inflation < tgt + 1.5 &&
        s.unemployment < s.nairu + 0.5,
      q: '«Впервые за годы мы планируем на три года вперёд, а не на квартал»',
      who: 'Руслан, основатель производственной компании',
      t: () =>
        `Рост ${rf1(s.gdpGrowth)}% при инфляции ${rf1(
          s.inflation
        )}% и разрыве выпуска ${rfs(
          s.outputGap
        )}%. Предсказуемость — тот редкий ресурс, который создаётся политикой, а не покупается.`,
    },
    {
      id: 'region',
      p: 6,
      when: () =>
        (s.sequesterFactor || 1) < 0.995 || s.budgetBalancePctGdp < -7,
      q: '«Нам сказали: стройку заморозить, зарплаты оставить»',
      who: 'Глава администрации небольшого города',
      t: () =>
        `Дефицит ${rf1(
          Math.abs(s.budgetBalancePctGdp)
        )}% ВВП. Когда бюджет режут, первыми уходят инвестиции — то есть будущий рост, у которого нет своего профсоюза.`,
    },
    {
      id: 'student',
      p: 5,
      when: () => s.unemployment > 6.5,
      q: '«Диплом есть, работы нет — беру любую подработку»',
      who: 'Камиль, выпускник технического вуза',
      t: () =>
        `Безработица ${rf1(
          s.unemployment
        )}%. Молодёжь всегда первой выпадает из найма и последней возвращается — отсюда и растущий естественный уровень безработицы ${rf1(
          s.nairu
        )}%.`,
    },
    {
      id: 'farmer',
      p: 5,
      when: () => s.commodityIndex > 108 || s.inflation > 7,
      q: '«Солярка подорожала раньше, чем мы успели продать урожай»',
      who: 'Владимир, фермерское хозяйство',
      t: () =>
        `Сырьевой индекс ${rf1(s.commodityIndex)} при инфляции ${rf1(
          s.inflation
        )}%. Издержки приходят к производителю быстрее, чем цены его продукции.`,
    },
    {
      id: 'importer',
      p: 6,
      when: () => s.fxDeprAnnual > 5,
      q: '«Мы пересчитываем прайс раз в две недели, и клиенты это ненавидят»',
      who: 'Ксения, импорт бытовой техники',
      t: () =>
        `Курс ослаб на ${rf1(
          s.fxDeprAnnual
        )}% годовых, цены импорта растут на ${rf1(
          s.importPriceInflation
        )}%. Перенос курса в ценники — самый быстрый канал инфляции.`,
    },
    {
      id: 'exporter',
      p: 5,
      when: () => s.fxDeprAnnual > 4 && s.exports > s.imports * 0.95,
      q: '«Слабый курс — наш единственный бонус за последние годы»',
      who: 'Директор экспортного предприятия',
      t: () =>
        `Торговый баланс ${fmtMoneySigned(
          s.tradeBalance
        )}. Девальвация перекладывает доход от покупателя импорта к экспортёру — это перераспределение, а не рост.`,
    },
    {
      id: 'banker',
      p: 6,
      when: () => s.netInterestMargin > 5 || s.bankROE > 15,
      q: '«Мы зарабатываем на разнице ставок, а не на экономике — это тревожный признак»',
      who: 'Зампред одного из крупных банков',
      t: () =>
        `Процентная маржа ${rf2(
          s.netInterestMargin
        )} п.п., рентабельность ${rf1(
          s.bankROE
        )}%. Когда банкам выгоднее держать деньги, чем кредитовать, страдает инвестиционный цикл.`,
    },
    {
      id: 'realtor',
      p: 5,
      when: () => s.creditGap > 4,
      q: '«Очереди на ипотеку — как в лучшие годы, и это меня пугает»',
      who: 'Агент по недвижимости',
      t: () =>
        `Кредитный разрыв ${rfs(
          s.creditGap
        )} п.п. ВВП. Кредитные бумы приятны в моменте и дороги через два-три года, когда приходит просрочка.`,
    },
    {
      id: 'nurse',
      p: 6,
      when: () => s.budgetShares.health < 15,
      q: '«В больнице снова нет расходников, зато есть оптимизация»',
      who: 'Медсестра районной больницы',
      t: () =>
        `Доля здравоохранения ${rf1(
          s.budgetShares.health
        )}% бюджетных расходов. Это не только про людей — человеческий капитал ${rf1(
          s.humanCapitalIndex
        )} прямо входит в потенциальный ВВП.`,
    },
    {
      id: 'teacher',
      p: 6,
      when: () => s.budgetShares.education < 14,
      q: '«Молодые учителя не приходят, а старые уходят»',
      who: 'Директор школы',
      t: () =>
        `На образование идёт ${rf1(
          s.budgetShares.education
        )}% расходов. Эффект этой цифры вы увидите не в этом квартале, а через десять лет — в темпе роста потенциала ${rf1(
          s.potentialGrowth
        )}%.`,
    },
    {
      id: 'scientist',
      p: 5,
      when: () => s.budgetShares.science < 3,
      q: '«Лаборатория закрыта, гранта нет, коллеги уехали»',
      who: 'Научный сотрудник института',
      t: () =>
        `Наука получает ${rf1(
          s.budgetShares.science
        )}% расходов. Производительность ${rf1(s.productivity)} растёт на ${rf1(
          s.tfpGrowth
        )}% в год — единственный источник роста, который не оплачивается инфляцией.`,
    },
    {
      id: 'engineer_boom',
      p: 5,
      when: () => s.investmentGrowth > 5,
      q: '«Нам впервые за годы согласовали новую линию»',
      who: 'Главный инженер завода',
      t: () =>
        `Инвестиции растут на ${rf1(
          s.investmentGrowth
        )}% при реальной ставке по кредитам ${rf1(
          s.realLendingRate
        )}%. Сегодняшние инвестиции — это завтрашний потенциал, а не сегодняшний спрос.`,
    },
    {
      id: 'retiree_ok',
      p: 4,
      when: () =>
        s.inflation < s.inflationTarget + 0.5 && s.wageGrowth - s.inflation > 0,
      q: '«Я снова понимаю, сколько стоит поход в магазин»',
      who: 'Галина Петровна, пенсионерка',
      t: () =>
        `Инфляция ${rf1(s.inflation)}% при цели ${rf1(
          tgt
        )}%. Предсказуемость цен — та форма благополучия, которую замечают, только когда её теряют.`,
    },
    {
      id: 'fund_manager',
      p: 6,
      when: () => s.volatilityIndex > 45,
      q: '«Мы вышли в короткие облигации и ждём — рынок не про фундамент сейчас»',
      who: 'Управляющий пенсионным фондом',
      t: () =>
        `Индекс страха ${rf1(s.volatilityIndex)}, премия за риск акций ${rf1(
          s.equityRiskPremium
        )}%. Когда все уходят в короткие бумаги, длинные деньги для экономики исчезают.`,
    },
    {
      id: 'ceo_invert',
      p: 7,
      when: () => s.curveInverted,
      q: '«Банк предлагает депозит доходнее, чем мой собственный проект»',
      who: 'Основатель промышленной группы',
      t: () =>
        `Короткие ставки ${rf1(s.yield3m)}% против длинных ${rf1(
          s.yield10y
        )}%. Инверсия кривой — это когда экономике выгоднее ждать, чем строить.`,
    },
    {
      id: 'accountant_sequester',
      p: 8,
      when: () => (s.sequesterFactor || 1) < 0.995,
      q: '«Контракты подписаны, деньги отозваны — объясняйте это подрядчикам сами»',
      who: 'Финансовый директор госпредприятия',
      t: () =>
        `Секвестр урезал расходы на ${rf1(
          (1 - s.sequesterFactor) * 100
        )}%. Когда рынок отказывается финансировать дефицит, выбор делает уже не правительство.`,
    },
    {
      id: 'journalist_elect',
      p: 6,
      when: () => s.quartersToElection <= 3,
      q: '«Обещаний в этом квартале больше, чем в предыдущие два года»',
      who: 'Политический обозреватель',
      t: () =>
        `До выборов ${s.quartersToElection} кв., рейтинг власти ${Math.round(
          s.approval
        )}. Предвыборные расходы всегда оплачиваются после выборов — обычно ставкой.`,
    },
    {
      id: 'mayor_fund',
      p: 4,
      when: () => (s.fundPctGdp || 0) > 4,
      q: '«Впервые за долгое время у страны есть подушка, а не только долги»',
      who: 'Экономический обозреватель',
      t: () =>
        `Суверенный фонд ${fmtMoney(s.sovereignFund)} (${rf1(
          s.fundPctGdp
        )}% ВВП) при долге ${rf1(s.debtToGdp)}% ВВП. Чистый долг ${rf1(
          s.netDebtToGdp
        )}% — именно эту цифру смотрят инвесторы.`,
    },
    {
      id: 'trader_street',
      p: 5,
      when: () => Math.abs(s.stockReturn) > 6,
      q: () =>
        s.stockReturn > 0
          ? '«Все вдруг стали экспертами по акциям»'
          : '«Портфель за квартал похудел сильнее, чем я за год»',
      who: 'Частный инвестор',
      t: () =>
        `Индекс ${rfs(s.stockReturn)}% за квартал, капитализация ${rf1(
          s.marketCapPctGdp
        )}% ВВП. Цены активов реагируют на ставку раньше, чем выпуск и занятость.`,
    },
    {
      id: 'union_strike',
      p: 8,
      when: () => s.wageGrowth - s.inflation < -2.5,
      q: '«Если индексации не будет, встанут цеха»',
      who: 'Забастовочный комитет',
      t: () =>
        `Реальные зарплаты ${rfs(
          s.wageGrowth - s.inflation
        )}%. Дальше либо индексация и инфляция издержек, либо конфликт — третьего пути у этой развилки обычно нет.`,
    },
    {
      id: 'econ_coord',
      p: 6,
      when: () => s.policyCoordination < 35,
      q: '«Одно ведомство жмёт газ, другое — тормоз, а изнашивается вся машина»',
      who: 'Профессор, бывший советник правительства',
      t: () =>
        `Согласованность политики ${Math.round(
          s.policyCoordination
        )} из 100. Несогласованность стоит стране премии за риск ${rf1(
          s.riskPremium
        )} п.п. и лишних процентов по долгу.`,
    },
    {
      id: 'young_family',
      p: 5,
      when: () => s.lendingRate < 7 && s.inflation < 6,
      q: '«Мы взяли кредит на ремонт — впервые ставка выглядит разумной»',
      who: 'Молодая семья',
      t: () =>
        `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(
          s.inflation
        )}%. Дешёвые деньги приятны домохозяйствам и опасны балансам банков — вопрос в том, надолго ли.`,
    },
    {
      id: 'saver',
      p: 5,
      when: () => s.depositRate - s.inflation < -2,
      q: '«Деньги на вкладе тают, но куда их ещё нести — непонятно»',
      who: 'Виктор, инженер, откладывает на образование детей',
      t: () =>
        `Реальная ставка по депозитам ${rfs(
          s.depositRate - s.inflation
        )}%. Отрицательная реальная доходность — это налог, который никто не голосовал.`,
    },
  ];
  const BASELINE_VOICES = [
    {
      id: 'base_wage',
      p: 3,
      when: () => realW >= 0.5,
      q: '«Зарплата наконец обгоняет ценники — не сильно, но обгоняет»',
      who: 'Николай, мастер на складе',
      t: () =>
        `Реальные доходы ${rfs(realW)}% при инфляции ${rf1(
          s.inflation
        )}%. Такие кварталы люди запоминают лучше, чем любые показатели с панели.`,
    },
    {
      id: 'base_orders',
      p: 3,
      when: () => s.gdpGrowth < s.potentialGrowth - 0.3,
      q: '«Заказов стало меньше, но увольнять пока некого»',
      who: 'Елена, владелица типографии',
      t: () =>
        `Рост ${rf1(s.gdpGrowth)}% при потенциале ${rf1(
          s.potentialGrowth
        )}%. Бизнес сначала теряет выручку и только потом сокращает людей — поэтому безработица всегда опаздывает.`,
    },
    {
      id: 'base_analyst',
      p: 3,
      when: () => true,
      q: () =>
        s.policyCoordination < 45
          ? '«Два ведомства тянут экономику в разные стороны, и оплачивает это третий — гражданин»'
          : '«Политика выглядит связной, а связность сама по себе стоит процента роста»',
      who: 'Еженедельный экономический обзор',
      t: () =>
        `Согласованность политики ${Math.round(
          s.policyCoordination
        )} из 100 при ставке ${rf2(s.keyRate)}% и балансе бюджета ${rfs(
          s.budgetBalancePctGdp
        )}% ВВП. Когда бюджет разгоняет спрос, а ЦБ его тормозит, обе стороны тратят ресурсы впустую.`,
    },
    {
      id: 'base_street',
      p: 2,
      when: () => true,
      q: () =>
        s.inflation > tgt + 1
          ? '«Цены в магазине у дома объясняют экономику лучше любого отчёта»'
          : '«Ценники стоят на месте, и это уже новость»',
      who: 'Опрос на улице, областной центр',
      t: () =>
        `Инфляция ${rf1(s.inflation)}% при цели ${rf1(
          tgt
        )}%, потребительские настроения ${Math.round(
          s.consumerConfidence
        )} из 100. Люди судят об экономике по корзине, а не по разрыву выпуска.`,
    },
  ];
  let picked = VOICES.filter((v) => v.when())
    .sort((a, b) => b.p - a.p)
    .filter((v) => once(`op:${v.id}`, 7))
    .slice(0, 2);
  if (picked.length === 0) {
    const pool = BASELINE_VOICES.filter((v) => v.when());
    const rot = pool.map((_, i) => pool[(i + quarterIndex) % pool.length]);
    picked = rot.filter((v) => once(`op:${v.id}`, 4)).slice(0, 1);
  }
  picked.forEach((v) =>
    push(
      'opinion',
      typeof v.q === 'function' ? v.q() : v.q,
      `${v.who}. ${v.t()}`,
      4
    )
  );

  /* решение второй ветви власти */
  if (botAction) {
    const changedCourse = prev.botHeadline !== botAction.headline;
    const newDemand = botAction.demand && prev.botDemand !== botAction.demand;
    if (changedCourse || newDemand || once('bot', 8)) {
      push(
        botAction.institution === 'cb' ? 'cb' : 'gov',
        botAction.newsHeadline,
        botAction.note + (botAction.demand ? ` ${botAction.demand}` : ''),
        changedCourse || newDemand ? 8 : 5
      );
    }
  }
  return out;
}

/* Импульсы решений: то, что действует не мгновенно и не через запас (ставки, кредит) */
function buildDecisionImpulses(dec, s, difficulty) {
  const out = [];
  const dVat = dec.vatRate - s.vatRate;
  if (Math.abs(dVat) > 1e-6) {
    out.push(
      makeImpulse(
        'vatPrices',
        dVat * CONFIG.coef.vatPass,
        `Изменение НДС до ${dec.vatRate.toFixed(
          1
        )}% напрямую переносится в розничные цены`,
        'fast',
        difficulty,
        'inflation'
      )
    );
    out.push(
      makeImpulse(
        'consumption',
        -dVat * 0.35,
        `Изменение НДС до ${dec.vatRate.toFixed(
          1
        )}% меняет реальные доходы домохозяйств`,
        'default',
        difficulty
      )
    );
  }
  const dExcise = dec.exciseRate - s.exciseRate;
  if (Math.abs(dExcise) > 1e-6) {
    out.push(
      makeImpulse(
        'vatPrices',
        dExcise * 0.12,
        `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`,
        'fast',
        difficulty,
        'inflation'
      )
    );
    out.push(
      makeImpulse(
        'consumption',
        -dExcise * 0.14,
        `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`,
        'default',
        difficulty
      )
    );
  }
  const dIncome = dec.incomeTaxRate - s.incomeTaxRate;
  if (Math.abs(dIncome) > 1e-6)
    out.push(
      makeImpulse(
        'consumption',
        -dIncome * 0.3,
        `${
          dIncome > 0 ? 'Повышение' : 'Снижение'
        } подоходного налога до ${dec.incomeTaxRate.toFixed(
          1
        )}% меняет располагаемый доход`,
        'default',
        difficulty
      )
    );
  const dSocial = dec.socialContribRate - s.socialContribRate;
  if (Math.abs(dSocial) > 1e-6) {
    out.push(
      makeImpulse(
        'unemployment',
        dSocial * 0.045,
        `Изменение социальных взносов до ${dec.socialContribRate.toFixed(
          1
        )}% меняет стоимость труда для работодателя`,
        'default',
        difficulty
      )
    );
    out.push(
      makeImpulse(
        'investment',
        -dSocial * 0.2,
        `Изменение социальных взносов до ${dec.socialContribRate.toFixed(1)}%`,
        'default',
        difficulty
      )
    );
  }
  const dProfit = dec.profitTaxRate - s.profitTaxRate;
  if (Math.abs(dProfit) > 1e-6)
    out.push(
      makeImpulse(
        'businessConfidence',
        -dProfit * 0.8,
        `${
          dProfit > 0 ? 'Повышение' : 'Снижение'
        } налога на прибыль до ${dec.profitTaxRate.toFixed(1)}%`,
        'default',
        difficulty,
        'other'
      )
    );
  const dCapital = dec.capitalTaxRate - s.capitalTaxRate;
  if (Math.abs(dCapital) > 1e-6)
    out.push(
      makeImpulse(
        'capitalFlow',
        -dCapital * 6,
        `Изменение налога на капитал до ${dec.capitalTaxRate.toFixed(
          1
        )}% влияет на приток капитала`,
        'default',
        difficulty
      )
    );
  if (Math.abs(dec.moneySupplyOp || 0) > 1e-6) {
    out.push(
      makeImpulse(
        'inflationSupply',
        dec.moneySupplyOp * 0.14,
        `${
          dec.moneySupplyOp > 0 ? 'Расширение' : 'Сжатие'
        } денежной массы на ${fmtSigned1(dec.moneySupplyOp)}%`,
        'slow',
        difficulty,
        'inflation'
      )
    );
    out.push(
      makeImpulse(
        'investment',
        dec.moneySupplyOp * 0.35,
        `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`,
        'default',
        difficulty
      )
    );
    out.push(
      makeImpulse(
        'creditDemand',
        dec.moneySupplyOp * 0.4,
        `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`,
        'default',
        difficulty
      )
    );
  }
  if (dec.emergency) {
    out.push(
      makeImpulse(
        'inflationSupply',
        0.45,
        'Экстренная поддержка банков: эмиссионное финансирование',
        'slow',
        difficulty,
        'inflation'
      )
    );
    out.push(
      makeImpulse(
        'govTrust',
        -2.5,
        'Экстренная поддержка банков за счёт бюджета и эмиссии',
        'fast',
        difficulty,
        'other'
      )
    );
  }
  const dReserve = dec.reserveReq - s.reserveReq;
  if (Math.abs(dReserve) > 1e-6)
    out.push(
      makeImpulse(
        'creditDemand',
        -dReserve * 0.5,
        `Изменение нормы резервирования до ${dec.reserveReq.toFixed(1)}%`,
        'default',
        difficulty,
        'banking'
      )
    );
  return out.filter((im) => im.values.some((x) => Math.abs(x) > 1e-9));
}

/* =========================================================================================
   НАЧАЛЬНОЕ СОСТОЯНИЕ
========================================================================================= */
function makeInitialEconomy() {
  const I = CONFIG.initial;
  const potentialGdp = potentialFrom(
    I.capitalStock,
    I.laborForce,
    I.nairu,
    I.humanCapitalIndex,
    I.productivity,
    I.infrastructureIndex,
    TFP_SCALE,
    0
  );
  const nominalGdp = (I.gdp * I.priceLevel) / 100;
  const base = {
    ...I,
    gdp: I.gdp,
    nominalGdp,
    potentialGdp,
    potentialGrowth: 2.3,
    outputGap: ((I.gdp - potentialGdp) / potentialGdp) * 100,
    gdpGrowth: 2.3,
    gdpPerCapita: (I.gdp * 1000) / CONFIG.population,
    consumptionGrowth: 2.3,
    investmentGrowth: 2.3,
    govPurchasesGrowth: 2.3,
    transfersGrowth: 2.3,
    govInvestmentGrowth: 2.3,
    tradeBalance: I.exports - I.imports,
    currentAccount: I.exports - I.imports - 0.012 * I.govDebt,
    capitalAccount: 0,
    netCapitalFlow: 0,
    fxDeprAnnual: 1.0,
    importPriceInflation: 4.0,
    importPriceInfl: 4.0,
    supplyScar: 0,
    tfpGrowth: CONFIG.prod.tfpBase,
    prevUnemployment: I.unemployment,
    employment: 100 - I.unemployment,
    tightness: 0,
    vacancyRate: 3.0,
    unitLaborCostGrowth: 4.0,
    realLendingRate: I.lendingRate - I.inflationExpectations,
    realPolicyRate: I.keyRate - I.inflationExpectations,
    rateGap: 0,
    policyStance: I.keyRate - I.inflationExpectations - I.rStar,
    carry: 0,
    creditGrowth: 6.3,
    creditTrendRatio: (I.creditVolume / nominalGdp) * 100,
    creditGap: 0,
    creditGapLag: 0,
    creditImpulse: 0,
    creditCrunch: false,
    bankCapitalAdequacy:
      (I.bankCapital / (I.creditVolume * CONFIG.target.riskWeight)) * 100,
    bankProfit: 2.2,
    loanLosses: 4.7,
    bankingRisk: 24,
    bankingRiskValue: 24,
    interestPayment: (I.govDebt * I.effectiveDebtRate) / 100,
    fiscalImpulse: 0,
    structuralBalancePctGdp: 0,
    inflationRisk: 14,
    debtRisk: 24,
    recessionRisk: 12,
    currencyRisk: 20,
    activeCrises: [],
    regime: 'normal',
    recessionStreak: 0,
    regimeStreak: 1,
    demands: [],
    cbStance: 0,
    mofStance: 0,
    taxWedgeValue: 0,
    botHeadline: null,
    botDemand: null,
  };
  const rev = computeRevenue(base, base);
  base.revenueParts = rev;
  base.govRevenue = rev.total;
  base.revenuePctGdp = (rev.total / nominalGdp) * 100;
  base.taxWedgeValue = taxWedge(base);
  base.sovereignFund = 0;
  base.fundPctGdp = 0;
  base.netDebtToGdp = (I.govDebt / nominalGdp) * 100;
  base.fundIncome = 0;
  base.govPurchasesNominal = I.govPurchasesReal;
  base.transfersNominal = I.transfersReal;
  base.govInvestmentNominal = I.govInvestmentReal;
  base.govSpendingTotal =
    I.govPurchasesReal +
    I.transfersReal +
    I.govInvestmentReal +
    base.interestPayment;
  base.budgetBalance = base.govRevenue - base.govSpendingTotal;
  base.budgetBalancePctGdp = (base.budgetBalance / nominalGdp) * 100;
  base.structuralBalancePctGdp = base.budgetBalancePctGdp;
  base.primaryBalance = base.budgetBalance + base.interestPayment;
  base.debtToGdp = (I.govDebt / nominalGdp) * 100;
  base.interestToRevenue = (base.interestPayment / base.govRevenue) * 100;
  base.yield3m = base.keyRate + 0.2;
  base.yield1y = base.keyRate + 0.4;
  base.yield2y = base.keyRate + 0.7;
  base.yield5y = base.keyRate + 1.1;
  base.yield10y = base.keyRate + 1.5;
  base.curveSlope = 1.3;
  base.curveInverted = false;
  base.bondIndex = 1000;
  base.bondReturn = 1.75;
  base.sovereignSpread = base.riskPremium * 100;
  base.corporateSpread = 190;
  base.stockIndex = 1000;
  base.stockReturn = 0;
  base.equityRiskPremium = 3.2;
  base.earnings = CONFIG.shares.profits * I.gdp * (1 - I.profitTaxRate / 100);
  base.discountRate =
    base.yield10y + 3.2 - 0.62 * (2.3 + I.inflationExpectations);
  base.fairPE = 100 / base.discountRate;
  base.stockPE = base.fairPE;
  base.marketCap = 1100;
  base.marketCapPctGdp = (1100 / nominalGdp) * 100;
  base.sectorBanks = 1000;
  base.sectorIndustry = 1000;
  base.sectorConsumer = 1000;
  base.sectorResources = 1000;
  base.netInterestMargin = I.lendingRate - I.depositRate;
  base.bankROE = 6.0;
  base.bankPB = 0.7;
  base.fxVolatility = 6;
  base.volatilityIndex = 16;
  base.depositIndex = 100;
  base.fxIndex = I.exchangeRate;
  base.fxCarry = 1;
  base.corpBondIndex = 1000;
  base.corpYield = base.yield5y + 1.9;
  base.corpReturn = 2.0;
  base.goldIndex = (I.commodityIndex * I.exchangeRate) / 100;
  Object.assign(
    base,
    computeScores({ ...base, capitalRequirement: base.capitalRequirement })
  );
  return base;
}

/* =========================================================================================
   ОТЧЁТ
========================================================================================= */
const REGIME_INFO = {
  normal: {
    label: 'Нормальный режим',
    color: 'teal',
    text: 'Выпуск близок к потенциалу, инфляция под контролем. Лучшее время для структурных решений: их эффект проявится через годы.',
  },
  overheating: {
    label: 'Перегрев',
    color: 'gold',
    text: 'Спрос выше производственных возможностей. Дополнительные расходы почти целиком уйдут в цены, а не в выпуск.',
  },
  recession: {
    label: 'Рецессия',
    color: 'rust',
    text: 'Выпуск ниже потенциала. Мультипликатор расходов высок, но длительная безработица поднимает её естественный уровень — шрамы останутся.',
  },
  stagflation: {
    label: 'Стагфляция',
    color: 'rust',
    text: 'Спад и инфляция одновременно. Любая политика чем-то жертвует: ставка вверх — глубже спад, ставка вниз — срыв ожиданий.',
  },
  banking: {
    label: 'Банковский кризис',
    color: 'rust',
    text: 'Капитал банков не покрывает потери, кредит сжимается, что само поднимает просрочку. Петля обратной связи работает против вас.',
  },
  debt: {
    label: 'Долговой кризис',
    color: 'rust',
    text: 'Премия за риск растёт быстрее, чем экономика. Каждый новый выпуск долга дороже предыдущего.',
  },
  currency: {
    label: 'Валютный кризис',
    color: 'rust',
    text: 'Курс переносится в цены. Защита резервами конечна, свободный курс — импорт инфляции.',
  },
  deflation: {
    label: 'Дефляционная ловушка',
    color: 'blue',
    text: 'Реальная ставка высока даже при нулевой ключевой. Обычная денежная политика теряет силу — нужен бюджет.',
  },
};
const CRISIS_INFO = {
  banking: {
    label: 'Банковский кризис',
    text: 'Просрочка съедает капитал, капитал ограничивает кредит, сжатие кредита повышает просрочку.',
  },
  debt: {
    label: 'Долговой кризис',
    text: 'Инвесторы требуют премию за риск; стоимость обслуживания растёт быстрее доходов.',
  },
  currency: {
    label: 'Валютный кризис',
    text: 'Резкое движение курса разгоняет инфляцию через импорт.',
  },
  stagflation: {
    label: 'Стагфляция',
    text: 'Высокая инфляция при отрицательном разрыве выпуска.',
  },
  overheating: {
    label: 'Перегрев',
    text: 'Разрыв выпуска положительный — спрос упирается в мощности.',
  },
  recession: {
    label: 'Рецессия',
    text: 'Выпуск ниже потенциала уже несколько кварталов.',
  },
  deflation: {
    label: 'Дефляция',
    text: 'Слабый спрос и почти нулевой рост цен.',
  },
};

function buildReport({ prev, next, quarterIndex, reasons }) {
  const p = [];
  p.push(
    `ВВП ${next.gdpGrowth >= 0 ? 'вырос' : 'сократился'} на ${fmt1(
      Math.abs(next.gdpGrowth)
    )}% в годовом выражении при потенциальном росте ${fmt1(
      next.potentialGrowth
    )}%; разрыв выпуска ${fmtSigned1(next.outputGap)}%.`
  );
  p.push(
    `Инфляция ${
      next.inflation >= prev.inflation ? 'ускорилась' : 'замедлилась'
    } до ${fmt1(next.inflation)}% при ожиданиях ${fmt1(
      next.inflationExpectations
    )}%, безработица ${fmt1(
      next.unemployment
    )}% против естественного уровня ${fmt1(next.nairu)}%.`
  );
  p.push(
    `Бюджет: ${next.budgetBalancePctGdp >= 0 ? 'профицит' : 'дефицит'} ${fmt1(
      Math.abs(next.budgetBalancePctGdp)
    )}% ВВП, долг ${fmt1(next.debtToGdp)}% ВВП, обслуживание забирает ${fmt1(
      next.interestToRevenue
    )}% доходов.`
  );
  p.push(
    `Ставка по кредитам ${fmt1(
      next.lendingRate
    )}% при нейтральной реальной ${fmt1(next.rStar)}%: денежные условия ${
      next.rateGap > 0.3
        ? 'жёстче нейтральных'
        : next.rateGap < -0.3
        ? 'мягче нейтральных'
        : 'близки к нейтральным'
    }, кредит ${fmtSigned1(next.creditGrowth)}%.`
  );
  if (next.creditCrunch)
    p.push(
      'Капитал банков ограничивает выдачу кредитов — спрос на заёмные средства не удовлетворён.'
    );
  if (
    Math.abs(next.inflationExpectations - prev.inflationExpectations) > 0.25
  ) {
    p.push(
      `Инфляционные ожидания ${
        next.inflationExpectations > prev.inflationExpectations
          ? 'сдвинулись вверх'
          : 'опустились'
      } — доверие к ЦБ ${fmt1(
        next.cbCredibility
      )}. Чем ниже доверие, тем дороже обойдётся возврат инфляции к цели.`
    );
  }
  const top = reasons.gdpGrowth[0];
  if (top)
    p.push(
      `Главный фактор динамики выпуска: ${top.reasonText
        .charAt(0)
        .toLowerCase()}${top.reasonText.slice(1)}.`
    );
  if (next.regime !== 'normal' && REGIME_INFO[next.regime])
    p.push(
      `Режим экономики — ${REGIME_INFO[next.regime].label.toLowerCase()}. ${
        REGIME_INFO[next.regime].text
      }`
    );
  return p.join(' ');
}

/* =========================================================================================
   ПОДСКАЗКИ ПО РЫЧАГАМ
========================================================================================= */
function leverPreview(id, newVal, s, difficulty) {
  const C = CONFIG.coef;
  const items = [];
  let pros = [];
  let cons = [];
  const uncertainty = UNCERTAINTY[id] || 'средняя';
  const lag =
    difficulty === 'easy'
      ? 'эффект в основном в следующем квартале'
      : difficulty === 'medium'
      ? 'эффект распределён на 2 квартала'
      : 'эффект распределён на 3 квартала';
  const add2 = (label, text) => items.push({ label, text });
  const nomGdp = Math.max(1, s.nominalGdp);
  switch (id) {
    case 'keyRate': {
      const dv = newVal - s.keyRate;
      const newLend = s.lendingRate + dv * C.lendingPassthrough[difficulty];
      const newGap =
        newLend -
        s.inflationExpectations -
        (s.rStar + C.termPremium + C.bankSpreadBase);
      add2(
        'Ставка по кредитам',
        `${fmt1(s.lendingRate)}% → ~${fmt1(newLend)}%`
      );
      add2(
        'Разрыв к нейтральной',
        `${fmtSigned1(s.rateGap)} → ${fmtSigned1(newGap)} п.п.`
      );
      add2(
        'Инвестиции',
        `${fmtSigned1(
          -dv * C.lendingPassthrough[difficulty] * C.invRate
        )}% к темпу`
      );
      add2(
        'Кредит',
        `${fmtSigned1(
          -dv * C.lendingPassthrough[difficulty] * C.creditRateSens
        )}% к росту`
      );
      add2(
        'Приток капитала / курс',
        `${fmtSigned1(dv * C.capitalFlowCarry)} млрд; валюта ${
          dv > 0 ? 'крепче' : 'слабее'
        }`
      );
      pros =
        dv > 0
          ? [
              'охлаждение спроса и кредита',
              'закрепление инфляционных ожиданий',
              'приток капитала и крепкий курс',
            ]
          : [
              'дешёвый кредит и рост инвестиций',
              'снижение стоимости обслуживания долга',
              'поддержка занятости',
            ];
      cons =
        dv > 0
          ? [
              'падение инвестиций и рост безработицы',
              'рост просрочки у банков и давление на их капитал',
              'дороже новый госдолг',
            ]
          : [
              'разгон инфляции и риск срыва ожиданий',
              'отток капитала и ослабление валюты',
              'риск кредитного пузыря',
            ];
      break;
    }
    case 'reserveReq': {
      const dv = newVal - s.reserveReq;
      add2('Кредитование', `${fmtSigned1(-dv * 0.5)}% к росту`);
      add2('Ликвидность банков', `${fmtSigned1(-dv * 1.2)} пункта`);
      add2('Ставка по кредитам', `${fmtSigned1(dv * 0.15)} п.п.`);
      pros =
        dv > 0
          ? ['меньше риска кредитного бума', 'банки держат больше буфера']
          : ['больше кредита экономике', 'выше ликвидность банков'];
      cons =
        dv > 0
          ? ['кредит дороже и его меньше', 'давление на прибыль банков']
          : ['рост кредитных рисков', 'ускорение денежной массы'];
      break;
    }
    case 'capitalRequirement': {
      const dv = newVal - s.capitalRequirement;
      const maxCredit =
        s.bankCapital /
        ((Math.max(8, newVal) / 100) * CONFIG.target.riskWeight);
      add2(
        'Предел кредитования',
        `${fmtMoney(maxCredit)} (сейчас выдано ${fmtMoney(s.creditVolume)})`
      );
      add2('Ставка по кредитам', `${fmtSigned1(dv * 0.1)} п.п.`);
      pros =
        dv > 0
          ? ['банки устойчивее к кризису', 'гасится кредитный бум']
          : ['кредит доступнее', 'быстрее выход из сжатия'];
      cons =
        dv > 0
          ? ['риск кредитного сжатия прямо сейчас', 'ниже инвестиции']
          : [
              'система хрупче при следующем шоке',
              'кредитный пузырь вернётся просрочкой через годы',
            ];
      break;
    }
    case 'moneySupplyOp': {
      add2('Инфляция', `${fmtSigned1(newVal * 0.14)} п.п. (с лагом)`);
      add2('Инвестиции', `${fmtSigned1(newVal * 0.35)}% к темпу`);
      add2(
        'Доверие к ЦБ',
        newVal > 3 ? 'заметное снижение' : 'почти без изменений'
      );
      pros =
        newVal > 0
          ? ['быстрое смягчение условий', 'работает даже у нулевой ставки']
          : ['изъятие избыточной ликвидности'];
      cons =
        newVal > 0
          ? ['инфляция с лагом', 'риск потери доверия к ЦБ']
          : ['удар по кредитованию'];
      break;
    }
    case 'fxIntervention': {
      add2(
        'Резервы',
        `${fmtMoneySigned(newVal)} за квартал (сейчас ${fmtMoney(s.reserves)})`
      );
      add2('Курс', `${fmtSigned1(newVal * 0.05)}% к темпу изменения`);
      pros =
        newVal < 0
          ? ['поддержка курса и подавление импортной инфляции']
          : ['накопление резервов и слабая валюта помогает экспорту'];
      cons =
        newVal < 0
          ? ['резервы конечны — при исчерпании режим срывается']
          : ['импорт дорожает, инфляция растёт'];
      break;
    }
    case 'liquidity': {
      add2('Ликвидность банков', `${fmtSigned1(newVal * 0.9)} пункта`);
      add2('Финансовая стабильность', `${fmtSigned1(newVal * 0.25)} пункта`);
      pros = ['снижение риска банковской паники', 'поддержка кредитования'];
      cons = ['рост денежной массы', 'банки привыкают к поддержке'];
      break;
    }
    case 'govSpending':
    case 'transfers':
    case 'govInvestment': {
      const slack = clamp(-s.outputGap, 0, 6) / 6;
      const m =
        id === 'govSpending'
          ? C.multPurchases[0] + C.multPurchases[1] * slack
          : id === 'transfers'
          ? C.multTransfers[0] + C.multTransfers[1] * slack
          : C.multInvestment[0] + C.multInvestment[1] * slack;
      const shareX =
        (id === 'govSpending'
          ? s.govPurchasesReal
          : id === 'transfers'
          ? s.transfersReal
          : s.govInvestmentReal) / Math.max(1, s.gdp);
      const level =
        id === 'govSpending'
          ? s.govPurchasesNominal
          : id === 'transfers'
          ? s.transfersNominal
          : s.govInvestmentNominal;
      add2(
        'Мультипликатор сейчас',
        `${fmt2(m)} (${
          slack > 0.4 ? 'экономика ниже потенциала' : 'мало свободных мощностей'
        })`
      );
      add2('Вклад в ВВП', `${fmtSigned1(m * newVal * shareX)} п.п.`);
      add2('Стоимость', `${fmtMoneySigned((level * newVal) / 100)} в год`);
      if (id === 'govInvestment')
        add2(
          'Потенциальный ВВП',
          `инфраструктура ${fmtSigned1(newVal * 0.05)} пункта в квартал`
        );
      pros =
        id === 'govInvestment'
          ? [
              'единственный расход, повышающий потенциал',
              'притягивает частные инвестиции',
            ]
          : id === 'transfers'
          ? [
              'быстрый эффект на потребление, особенно в кризис',
              'рост доверия населения',
            ]
          : ['прямой вклад в спрос', 'поддержка занятости'];
      cons =
        id === 'transfers'
          ? [
              'почти нулевой долгосрочный эффект',
              'постоянное обязательство бюджета',
            ]
          : [
              'рост дефицита и долга',
              'при перегреве уходит в цены, а не в выпуск',
            ];
      break;
    }
    case 'incomeTaxRate':
    case 'vatRate':
    case 'profitTaxRate':
    case 'exciseRate':
    case 'capitalTaxRate':
    case 'socialContribRate': {
      const cur = s[id];
      const dv = newVal - cur;
      const testDec = {
        incomeTaxRate: s.incomeTaxRate,
        profitTaxRate: s.profitTaxRate,
        vatRate: s.vatRate,
        exciseRate: s.exciseRate,
        capitalTaxRate: s.capitalTaxRate,
        socialContribRate: s.socialContribRate,
      };
      const before = computeRevenue(s, testDec).total;
      const after = computeRevenue(s, { ...testDec, [id]: newVal }).total;
      const dRev = after - before;
      const mech =
        dv > 0
          ? dRev / Math.max(0.01, Math.abs(dv)) < before * 0.004
            ? 'база сжимается почти так же быстро, как растёт ставка'
            : 'база держится'
          : 'база расширяется';
      add2('Доходы бюджета', `${fmtMoneySigned(dRev)} в год (${mech})`);
      add2(
        'Собираемость',
        `уход в тень ${dv > 0 ? 'усилится' : 'ослабнет'} постепенно`
      );
      if (id === 'vatRate')
        add2('Инфляция', `${fmtSigned1(dv * C.vatPass)} п.п. сразу`);
      if (id === 'profitTaxRate')
        add2('Инвестиции', `${fmtSigned1(-dv * C.invProfitTax)}% к темпу`);
      if (id === 'capitalTaxRate')
        add2('Приток капитала', `${fmtMoneySigned(-dv * 6)}`);
      if (id === 'socialContribRate')
        add2(
          'Рынок труда',
          `безработица ${fmtSigned1(dv * 0.045)} п.п., зарплаты ${fmtSigned1(
            -dv * C.wageSocial
          )}%`
        );
      pros =
        dv > 0
          ? ['больше доходов бюджета в моменте', 'сокращение дефицита']
          : ['рост частного спроса', 'расширение налоговой базы в будущем'];
      cons =
        dv > 0
          ? [
              'сжатие базы и рост теневой экономики',
              'удар по спросу или инвестициям',
            ]
          : ['выпадение доходов бюджета сейчас', 'рост дефицита и долга'];
      break;
    }
    case 'shareHealth':
    case 'shareEducation':
    case 'shareScience':
    case 'shareDefense':
    case 'shareAdmin': {
      const key =
        id === 'shareHealth'
          ? 'health'
          : id === 'shareEducation'
          ? 'education'
          : id === 'shareScience'
          ? 'science'
          : id === 'shareDefense'
          ? 'defense'
          : 'admin';
      const dv = newVal - s.budgetShares[key];
      add2(
        'Расходы по статье',
        `${fmtMoneySigned((s.govPurchasesNominal * dv) / 100)} в год`
      );
      if (key === 'education' || key === 'health')
        add2(
          'Человеческий капитал',
          `цель ${fmtSigned1(
            (((dv / 100) * s.govPurchasesReal) / Math.max(1, s.gdp)) * 100 * 7
          )} пункта (годы)`
        );
      if (key === 'science')
        add2(
          'Рост производительности',
          `${fmtSigned1(
            (((dv / 100) * s.govPurchasesReal) / Math.max(1, s.gdp)) *
              100 *
              0.45
          )} п.п. в год`
        );
      pros =
        key === 'science'
          ? ['главный источник долгосрочного роста потенциала']
          : key === 'education' || key === 'health'
          ? ['человеческий капитал повышает потенциальный ВВП']
          : ['перераспределение внутри бюджета без роста дефицита'];
      cons = [
        'эффект проявляется через годы, а не кварталы',
        'ресурс отнимается у других статей',
      ];
      break;
    }
    default:
      break;
  }
  return { items, pros, cons, uncertainty, delayNote: lag };
}

const THEMES = {
  ink: {
    id: 'ink',
    name: 'Ночная канцелярия',
    dark: true,
    colors: {
      bg: '#0B0F17',
      bgVignette: '#0E1420',
      panel: '#161D2B',
      panelAlt: '#1B2333',
      panelRaised: '#202B41',
      border: '#28324A',
      borderStrong: '#3D4C6B',
      hairline: '#1F2A3D',
      text: '#E8E6DD',
      muted: '#8B94A8',
      faint: '#5B6478',
      paper: '#EDE7D6',
      paperText: '#22261D',
      paperMuted: '#6B6754',
      paperRule: '#C9BFA0',
      gold: '#C9A227',
      goldSoft: '#E8C766',
      goldDim: 'rgba(201,162,39,0.14)',
      ink: '#1B1204',
      teal: '#4E9A82',
      tealDim: 'rgba(78,154,130,0.14)',
      rust: '#B0503A',
      rustDim: 'rgba(176,80,58,0.14)',
      blue: '#5B7FA6',
      blueDim: 'rgba(91,127,166,0.14)',
    },
  },
  slate: {
    id: 'slate',
    name: 'Холодный кабинет',
    dark: true,
    colors: {
      bg: '#0A1014',
      bgVignette: '#0C151B',
      panel: '#13202A',
      panelAlt: '#182833',
      panelRaised: '#1E3240',
      border: '#24404F',
      borderStrong: '#365C70',
      hairline: '#1B2E3A',
      text: '#DFE8EC',
      muted: '#87A0AC',
      faint: '#5A717C',
      paper: '#E6E9E4',
      paperText: '#1C2428',
      paperMuted: '#63706F',
      paperRule: '#B7C2BF',
      gold: '#8FB8C9',
      goldSoft: '#BBDCEA',
      goldDim: 'rgba(143,184,201,0.14)',
      ink: '#08161C',
      teal: '#57A98E',
      tealDim: 'rgba(87,169,142,0.14)',
      rust: '#C06152',
      rustDim: 'rgba(192,97,82,0.14)',
      blue: '#6E93C4',
      blueDim: 'rgba(110,147,196,0.14)',
    },
  },
  chamber: {
    id: 'chamber',
    name: 'Дневная канцелярия',
    dark: false,
    colors: {
      bg: '#EFEADF',
      bgVignette: '#E7E1D2',
      panel: '#F7F3E9',
      panelAlt: '#EDE7D8',
      panelRaised: '#FFFCF4',
      border: '#D3C9B2',
      borderStrong: '#B5A888',
      hairline: '#E0D8C6',
      text: '#221F19',
      muted: '#5F5A4C',
      faint: '#8A8372',
      paper: '#FBF7EC',
      paperText: '#221F19',
      paperMuted: '#6B6653',
      paperRule: '#CDC2A6',
      gold: '#8A6D12',
      goldSoft: '#6F5710',
      goldDim: 'rgba(138,109,18,0.12)',
      ink: '#FBF7EC',
      teal: '#2F6B57',
      tealDim: 'rgba(47,107,87,0.12)',
      rust: '#94331F',
      rustDim: 'rgba(148,51,31,0.12)',
      blue: '#2F5578',
      blueDim: 'rgba(47,85,120,0.12)',
    },
  },
  contrast: {
    id: 'contrast',
    name: 'Высокий контраст',
    dark: true,
    colors: {
      bg: '#000000',
      bgVignette: '#000000',
      panel: '#0A0A0A',
      panelAlt: '#141414',
      panelRaised: '#1C1C1C',
      border: '#6A6A6A',
      borderStrong: '#A8A8A8',
      hairline: '#4A4A4A',
      text: '#FFFFFF',
      muted: '#D6D6D6',
      faint: '#A8A8A8',
      paper: '#FFFFFF',
      paperText: '#000000',
      paperMuted: '#333333',
      paperRule: '#888888',
      gold: '#FFD23F',
      goldSoft: '#FFE485',
      goldDim: 'rgba(255,210,63,0.22)',
      ink: '#000000',
      teal: '#4DE0A8',
      tealDim: 'rgba(77,224,168,0.20)',
      rust: '#FF6B52',
      rustDim: 'rgba(255,107,82,0.20)',
      blue: '#7FC2FF',
      blueDim: 'rgba(127,194,255,0.20)',
    },
  },
};
const COLOR = { ...THEMES.ink.colors };
let CURRENT_THEME = 'ink';
function applyTheme(id) {
  const t = THEMES[id] || THEMES.ink;
  Object.assign(COLOR, t.colors);
  CURRENT_THEME = t.id;
}
const FONT = {
  serif:
    "'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
};

const GlobalStyle = () => (
  <style>{`
    .ems-root { background:${COLOR.bg} radial-gradient(ellipse 1100px 620px at 50% -8%, ${COLOR.bgVignette} 0%, ${COLOR.bg} 70%); color:${COLOR.text}; font-family:${FONT.sans}; min-height:100vh; }
    .ems-root * { box-sizing: border-box; }
    .ems-root :focus-visible { outline: 2px solid ${COLOR.goldSoft}; outline-offset: 2px; }
    .ems-serif { font-family:${FONT.serif}; }
    .ems-mono { font-family:${FONT.mono}; font-variant-numeric: tabular-nums; }
    .ems-panel { background:${COLOR.panel}; border:1px solid ${COLOR.border}; border-radius:4px; }
    .ems-panel-raised { background:${COLOR.panelRaised}; border:1px solid ${COLOR.borderStrong}; border-radius:4px; }
    .ems-hr { height:1px; background:${COLOR.hairline}; border:none; margin:0; }
    .ems-btn { font-family:${FONT.sans}; cursor:pointer; border:1px solid ${COLOR.border}; background:${COLOR.panelAlt}; color:${COLOR.text}; padding:8px 14px; border-radius:3px; font-size:13px; transition:background .15s, border-color .15s, transform .1s; }
    .ems-btn:hover { background:${COLOR.panelRaised}; border-color:${COLOR.borderStrong}; }
    .ems-btn:active { transform: scale(0.98); }
    .ems-btn.primary { background:${COLOR.gold}; color:${COLOR.ink}; border-color:${COLOR.gold}; font-weight:600; }
    .ems-btn.primary:hover { background:${COLOR.goldSoft}; border-color:${COLOR.goldSoft}; }
    .ems-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
    .ems-slider { -webkit-appearance:none; width:100%; height:4px; background:${COLOR.border}; outline:none; border-radius:2px; }
    .ems-slider::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-slider::-moz-range-thumb { width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-scroll::-webkit-scrollbar { width:6px; height:6px; }
    .ems-scroll::-webkit-scrollbar-thumb { background:${COLOR.border}; border-radius:3px; }
    .ems-tab { padding:7px 12px; font-size:12.5px; cursor:pointer; border-radius:3px; color:${COLOR.muted}; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; transition:background .15s, color .15s; }
    .ems-tab:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    .ems-tab.active { color:${COLOR.ink}; background:${COLOR.gold}; font-weight:600; }
    .ems-tab.active:hover { background:${COLOR.goldSoft}; color:${COLOR.ink}; }
    .ems-fade-in { animation: emsFade .35s ease; }
    @keyframes emsFade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
    @media (prefers-reduced-motion: reduce) { .ems-fade-in { animation:none; } .ems-btn, .ems-tab { transition:none; } }
    .ems-grid { display:grid; grid-template-columns: 300px minmax(0,1fr) 300px; gap:14px; align-items:start; }
    @media (max-width: 1240px) { .ems-grid { grid-template-columns: 280px minmax(0,1fr); } }
    @media (max-width: 860px) { .ems-grid { grid-template-columns: 1fr; padding: 12px !important; gap: 10px; } }
    @media (max-width: 860px) { .ems-hide-narrow { display: none !important; } }
    @media (max-width: 640px) { .ems-pad { padding-left: 10px !important; padding-right: 10px !important; } }
    .ems-col-hidden { display: none !important; }
    .ems-dense .ems-visual { display: none !important; }
    .ems-dense .ems-panel { padding-top: 9px !important; padding-bottom: 9px !important; }
    @keyframes emsSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes emsBlink { 0%,45% { opacity: 1; } 55%,100% { opacity: 0.15; } }
    @keyframes emsShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-2px,1px); }
      40% { transform: translate(2px,-1px); } 60% { transform: translate(-1px,-1px); } 80% { transform: translate(1px,1px); } }
    @keyframes emsFlash { 0% { opacity: 0.5; } 100% { opacity: 0; } }
    @keyframes emsBreathe { 0%,100% { opacity: var(--p, 0.12); } 50% { opacity: calc(var(--p, 0.12) * 2.4); } }
    .ems-blink { animation: emsBlink 1.1s steps(1) infinite; }
    .ems-shake { animation: emsShake 0.45s ease-in-out 2; }
    .ems-flash { animation: emsFlash 0.9s ease-out forwards; }
    .ems-breathe { animation: emsBreathe 4.2s ease-in-out infinite; }
    .ems-sweep { animation: emsSweep 3.2s linear infinite; }
    .ems-terminal { display:grid; grid-template-columns: minmax(230px, 0.85fr) minmax(300px, 1.15fr); }
    @media (max-width: 900px) { .ems-terminal { grid-template-columns: 1fr; } }
    .ems-market-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap:12px; }
    @keyframes emsPulse { 0%,100% { opacity: var(--p, 0.2); } 50% { opacity: calc(var(--p, 0.2) * 2.1); } }
    .ems-pulse { animation: emsPulse 3.4s ease-in-out infinite; }
    .ems-paper-cols { column-count: 2; }
    @media (max-width: 760px) { .ems-paper-cols { column-count: 1 !important; } }
    .ems-kpi-strip { display:grid; grid-template-columns: repeat(auto-fit, minmax(158px,1fr)); gap:10px; }
    @media (max-width: 700px) { .ems-kpi-strip { grid-template-columns: repeat(2,1fr); } }
  `}</style>
);

/* =========================================================================================
   8. МЕЛКИЕ КОМПОНЕНТЫ
========================================================================================= */
function DeltaTag({ value, invert, suffix = '' }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05)
    return <span style={{ color: COLOR.muted, fontSize: 11 }}>—</span>;
  const good = invert ? value < 0 : value > 0;
  const color = good ? COLOR.teal : COLOR.rust;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      style={{
        color,
        fontSize: 11,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Icon size={11} />
      {fmtSigned1(value)}
      {suffix}
    </span>
  );
}

function Gauge({ value, size = 110 }) {
  const v = clamp(value, 0, 100);
  const angle = -90 + (v / 100) * 180;
  const color = v >= 65 ? COLOR.teal : v >= 40 ? COLOR.gold : COLOR.rust;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (Math.PI / 180) * angle;
  const x2 = cx + r * Math.sin(rad);
  const y2 = cy - r * Math.cos(rad);
  const arc = (from, to) => {
    const rf = (Math.PI / 180) * from;
    const rt = (Math.PI / 180) * to;
    const x1 = cx + r * Math.sin(rf);
    const y1 = cy - r * Math.cos(rf);
    const x2b = cx + r * Math.sin(rt);
    const y2b = cy - r * Math.cos(rt);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2b} ${y2b}`;
  };
  const ticks = [0, 25, 50, 75, 100].map((t) => {
    const a = -90 + (t / 100) * 180;
    const ra = (Math.PI / 180) * a;
    const r1 = r + 5;
    const r2 = r + (t % 50 === 0 ? 9 : 7);
    return {
      x1: cx + r1 * Math.sin(ra),
      y1: cy - r1 * Math.cos(ra),
      x2: cx + r2 * Math.sin(ra),
      y2: cy - r2 * Math.cos(ra),
    };
  });
  return (
    <svg
      width={size}
      height={size / 1.6}
      viewBox={`0 0 ${size} ${size / 1.6 + 4}`}
    >
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={COLOR.faint}
          strokeWidth={1}
        />
      ))}
      <path
        d={arc(-90, 90)}
        stroke={COLOR.border}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={arc(-90, angle)}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill={color} />
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fontSize={20}
        fontWeight={700}
        fill={COLOR.text}
        fontFamily={FONT.serif}
      >
        {Math.round(v)}
      </text>
    </svg>
  );
}

function KpiTile({ label, value, delta, invert, icon: Icon }) {
  const good =
    Number.isFinite(delta) && Math.abs(delta) >= 0.05
      ? invert
        ? delta < 0
        : delta > 0
      : null;
  const barColor =
    good === null ? COLOR.border : good ? COLOR.teal : COLOR.rust;
  return (
    <div
      className="ems-panel"
      style={{
        padding: '10px 12px 10px 14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: barColor,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: COLOR.muted,
          fontSize: 11,
          marginBottom: 7,
        }}
      >
        {Icon && <Icon size={12} />}
        <span>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          className="ems-mono ems-serif"
          style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        <DeltaTag value={delta} invert={invert} />
      </div>
    </div>
  );
}

function LeverSlider({
  lever,
  currentDisplay,
  value,
  onChange,
  preview,
  onIRF,
}) {
  const delta = lever.type === 'level' ? value - currentDisplay : value;
  const [open, setOpen] = useState(false);
  const pct = clamp(
    ((value - lever.min) / (lever.max - lever.min)) * 100,
    0,
    100
  );
  const trackStyle = {
    background: `linear-gradient(90deg, ${COLOR.gold} 0%, ${COLOR.gold} ${pct}%, ${COLOR.border} ${pct}%, ${COLOR.border} 100%)`,
  };
  return (
    <div
      style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12.5 }}>{lever.label}</span>
        {lever.type === 'level' && (
          <span
            className="ems-mono"
            style={{ fontSize: 12, color: COLOR.muted }}
          >
            {currentDisplay.toFixed(2)}
            {lever.suffix}
          </span>
        )}
        {lever.type === 'flow' && !lever.persistent && (
          <span
            className="ems-mono"
            style={{ fontSize: 12, color: COLOR.muted }}
          >
            тек. 0{lever.suffix}
          </span>
        )}
      </div>
      {lever.hint && (
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 1 }}>
          {lever.hint}
        </div>
      )}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}
      >
        <input
          type="range"
          className="ems-slider"
          style={trackStyle}
          min={lever.min}
          max={lever.max}
          step={lever.step}
          aria-label={`${lever.label}, текущее значение ${value}${lever.suffix}`}
          value={value}
          onChange={(e) => {
            Audio.play('tick');
            onChange(parseFloat(e.target.value));
          }}
        />
        <span
          className="ems-mono"
          style={{
            fontSize: 12.5,
            width: 62,
            textAlign: 'right',
            color: COLOR.goldSoft,
            fontWeight: 600,
          }}
        >
          {lever.type === 'level'
            ? `${value.toFixed(2)}${lever.suffix}`
            : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${lever.suffix}`}
        </span>
      </div>
      {Math.abs(delta) > 0.001 && (
        <div
          className="ems-fade-in"
          style={{
            marginTop: 8,
            background: COLOR.panelAlt,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 3,
            padding: '8px 9px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 12px',
              marginBottom: 6,
            }}
          >
            {preview.items.map((it, i) => (
              <span key={i} style={{ fontSize: 11 }}>
                <span style={{ color: COLOR.muted }}>{it.label}:</span>{' '}
                <span className="ems-mono">{it.text}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button
              className="ems-btn"
              style={{ padding: '3px 8px', fontSize: 10.5 }}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Скрыть детали' : 'Плюсы и минусы'}{' '}
              {open ? (
                <ChevronUp size={11} style={{ verticalAlign: -1 }} />
              ) : (
                <ChevronDown size={11} style={{ verticalAlign: -1 }} />
              )}
            </button>
            {onIRF && (
              <button
                className="ems-btn"
                style={{
                  padding: '3px 8px',
                  fontSize: 10.5,
                  borderColor: COLOR.blue,
                  color: COLOR.blue,
                }}
                onClick={() => {
                  Audio.play('click');
                  onIRF(lever, value);
                }}
              >
                <Activity
                  size={11}
                  style={{ verticalAlign: -1, marginRight: 3 }}
                />
                Реакция экономики
              </button>
            )}
          </div>
          {open && (
            <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.55 }}>
              <div style={{ color: COLOR.teal }}>
                + {preview.pros.join('; ')}
              </div>
              <div style={{ color: COLOR.rust, marginTop: 2 }}>
                − {preview.cons.join('; ')}
              </div>
              <div style={{ color: COLOR.muted, marginTop: 4 }}>
                Неопределённость: {preview.uncertainty}
                {preview.delayNote ? ` · ${preview.delayNote}` : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ROLE_ICON = {
  landmark: Landmark,
  coins: Coins,
  globe: Globe2,
  chart: TrendingUp,
};

/* ============================ ГРАФИКИ ============================ */
const CHART_GROUPS = [
  {
    id: 'output',
    label: 'Выпуск',
    series: [
      {
        id: 'gdp',
        label: 'ВВП',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'money',
      },
      {
        id: 'potentialGdp',
        label: 'Потенциальный ВВП',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'money',
      },
      {
        id: 'outputGap',
        label: 'Разрыв выпуска',
        axis: 'right',
        color: COLOR.teal,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'growth',
    label: 'Рост',
    series: [
      {
        id: 'gdpGrowth',
        label: 'Рост ВВП',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'pct',
      },
      {
        id: 'potentialGrowth',
        label: 'Рост потенциала',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'pct',
      },
      {
        id: 'consumptionGrowth',
        label: 'Потребление',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'pct',
      },
      {
        id: 'investmentGrowth',
        label: 'Инвестиции',
        axis: 'left',
        color: COLOR.rust,
        fmt: 'pct',
      },
      {
        id: 'wageGrowth',
        label: 'Зарплаты',
        axis: 'left',
        color: '#8E7CC3',
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'prices',
    label: 'Цены',
    series: [
      {
        id: 'inflation',
        label: 'Инфляция',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'pct',
      },
      {
        id: 'coreInflation',
        label: 'Базовая инфляция',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'pct',
      },
      {
        id: 'inflationExpectations',
        label: 'Ожидания',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'pct',
      },
      {
        id: 'cbCredibility',
        label: 'Доверие к ЦБ',
        axis: 'right',
        color: COLOR.rust,
        fmt: 'idx',
      },
    ],
  },
  {
    id: 'money',
    label: 'Ставки',
    series: [
      {
        id: 'keyRate',
        label: 'Ключевая ставка',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'pct',
      },
      {
        id: 'lendingRate',
        label: 'Ставка по кредитам',
        axis: 'left',
        color: COLOR.rust,
        fmt: 'pct',
      },
      {
        id: 'realLendingRate',
        label: 'Реальная ставка',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'pct',
      },
      {
        id: 'rStar',
        label: 'Нейтральная ставка r*',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'labor',
    label: 'Труд',
    series: [
      {
        id: 'unemployment',
        label: 'Безработица',
        axis: 'left',
        color: COLOR.rust,
        fmt: 'pct',
      },
      {
        id: 'nairu',
        label: 'Естественный уровень',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'pct',
      },
      {
        id: 'wageGrowth',
        label: 'Рост зарплат',
        axis: 'right',
        color: COLOR.teal,
        fmt: 'pct',
      },
      {
        id: 'unitLaborCostGrowth',
        label: 'Удельные издержки труда',
        axis: 'right',
        color: COLOR.gold,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'banking',
    label: 'Банки',
    series: [
      {
        id: 'bankNPL',
        label: 'Просрочка',
        axis: 'left',
        color: COLOR.rust,
        fmt: 'pct',
      },
      {
        id: 'bankCapitalAdequacy',
        label: 'Достаточность капитала',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'pct',
      },
      {
        id: 'creditGrowth',
        label: 'Рост кредита',
        axis: 'right',
        color: COLOR.gold,
        fmt: 'pct',
      },
      {
        id: 'creditGap',
        label: 'Кредитный разрыв',
        axis: 'right',
        color: COLOR.blue,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'government',
    label: 'Бюджет',
    series: [
      {
        id: 'debtToGdp',
        label: 'Госдолг к ВВП',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'pct',
      },
      {
        id: 'deficitPctGdp',
        label: 'Дефицит бюджета',
        axis: 'right',
        color: COLOR.rust,
        fmt: 'pct',
      },
      {
        id: 'interestPctGdp',
        label: 'Процентные расходы',
        axis: 'right',
        color: COLOR.blue,
        fmt: 'pct',
      },
      {
        id: 'shadowShare',
        label: 'Теневая экономика',
        axis: 'right',
        color: COLOR.teal,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'external',
    label: 'Внешний сектор',
    series: [
      {
        id: 'exchangeRate',
        label: 'Курс (индекс)',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'idx',
      },
      {
        id: 'realExchangeRate',
        label: 'Реальный курс',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'idx',
      },
      {
        id: 'currentAccount',
        label: 'Текущий счёт',
        axis: 'right',
        color: COLOR.teal,
        fmt: 'money',
      },
      {
        id: 'netCapitalFlow',
        label: 'Приток капитала',
        axis: 'right',
        color: COLOR.rust,
        fmt: 'money',
      },
    ],
  },
  {
    id: 'potential',
    label: 'Потенциал',
    series: [
      {
        id: 'productivity',
        label: 'Производительность',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'idx',
      },
      {
        id: 'humanCapitalIndex',
        label: 'Человеческий капитал',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'idx',
      },
      {
        id: 'infrastructureIndex',
        label: 'Инфраструктура',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'idx',
      },
      {
        id: 'potentialGrowth',
        label: 'Рост потенциала',
        axis: 'right',
        color: COLOR.rust,
        fmt: 'pct',
      },
    ],
  },
  {
    id: 'markets',
    label: 'Рынок',
    series: [
      {
        id: 'stockIndex',
        label: 'Индекс акций',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'idx',
      },
      {
        id: 'bondIndex',
        label: 'Индекс облигаций',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'idx',
      },
      {
        id: 'yield10y',
        label: 'Доходность 10 лет',
        axis: 'right',
        color: COLOR.teal,
        fmt: 'pct',
      },
      {
        id: 'yield3m',
        label: 'Доходность 3 месяца',
        axis: 'right',
        color: '#8E7CC3',
        fmt: 'pct',
      },
      {
        id: 'volatilityIndex',
        label: 'Индекс страха',
        axis: 'right',
        color: COLOR.rust,
        fmt: 'idx',
      },
    ],
  },
  {
    id: 'scores',
    label: 'Оценки',
    series: [
      {
        id: 'scoreStability',
        label: 'Стабильность',
        axis: 'left',
        color: COLOR.gold,
        fmt: 'idx',
      },
      {
        id: 'scoreWelfare',
        label: 'Благосостояние',
        axis: 'left',
        color: COLOR.teal,
        fmt: 'idx',
      },
      {
        id: 'scoreFinancial',
        label: 'Финансы',
        axis: 'left',
        color: COLOR.blue,
        fmt: 'idx',
      },
      {
        id: 'scoreFiscal',
        label: 'Бюджет',
        axis: 'left',
        color: COLOR.rust,
        fmt: 'idx',
      },
      {
        id: 'scorePotential',
        label: 'Потенциал',
        axis: 'left',
        color: '#8E7CC3',
        fmt: 'idx',
      },
    ],
  },
];
const PERIODS = [
  { id: '1y', label: '1 год', q: 4 },
  { id: '5y', label: '5 лет', q: 20 },
  { id: '10y', label: '10 лет', q: 40 },
  { id: 'all', label: 'Всё время', q: 1e9 },
];
const axisTick = (fmtType) =>
  fmtType === 'money'
    ? (v) => Math.round(v).toLocaleString('ru-RU')
    : fmtType === 'idx'
    ? (v) => Math.round(v)
    : (v) => `${Math.round(v)}%`;
const tooltipVal = (fmtType) =>
  fmtType === 'money'
    ? (v) => fmtMoney(v)
    : fmtType === 'idx'
    ? (v) => fmt1(v)
    : (v) => `${fmt1(v)}%`;

const FORECAST_ANCHORS = {
  inflation: (e) => e.inflationTarget,
  coreInflation: (e) => e.inflationTarget,
  inflationExpectations: (e) => e.inflationTarget,
  gdpGrowth: (e) => e.potentialGrowth,
  potentialGrowth: (e) => e.potentialGrowth,
  unemployment: (e) => e.nairu,
  outputGap: () => 0,
  keyRate: (e) => e.rStar + e.inflationTarget,
  lendingRate: (e) => e.rStar + e.inflationTarget + 2,
  wageGrowth: (e) => e.inflationTarget + e.potentialGrowth,
  creditGrowth: (e) => e.potentialGrowth + e.inflationTarget,
};
const FORECAST_SIGMA = {
  inflation: 0.9,
  inflationExpectations: 0.5,
  gdpGrowth: 1.1,
  outputGap: 0.9,
  unemployment: 0.4,
  keyRate: 0.8,
  lendingRate: 0.9,
  wageGrowth: 1.0,
  stockIndex: 55,
  exchangeRate: 4,
};

function ChartPanel({
  history,
  chartGroup,
  setChartGroup,
  hiddenSeries,
  setHiddenSeries,
  period,
  setPeriod,
}) {
  const group = CHART_GROUPS.find((g) => g.id === chartGroup);
  const [forecast, setForecast] = useState(false);
  const data = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period);
    const hist = history.slice(-p.q).map((h) => ({
      ...h,
      deficitPctGdp: -h.budgetBalancePctGdp,
      interestPctGdp: h.gdp ? (h.interestPayment / h.gdp) * 100 : 0,
    }));
    if (!forecast || !hist.length) return hist;
    // веер неопределённости: инерционный прогноз к якорю с расширяющимися границами
    const last = hist[hist.length - 1];
    const vis = group.series.filter((x) => !hiddenSeries.includes(x.id));
    const lead = vis[0];
    const out = hist.map((h) => ({ ...h, fanBand: null }));
    if (!lead) return out;
    const anchorFn = FORECAST_ANCHORS[lead.id];
    const anchor = anchorFn ? anchorFn(last) : last[lead.id];
    const sigma =
      FORECAST_SIGMA[lead.id] ||
      Math.max(0.4, Math.abs(last[lead.id] || 1) * 0.06);
    let v = last[lead.id];
    for (let i = 1; i <= 8; i++) {
      v += (anchor - v) * 0.28;
      const sd = sigma * Math.sqrt(i) * 0.9;
      out.push({
        label: `+${i} кв.`,
        forecastPoint: true,
        [`${lead.id}__f`]: v,
        fanBand: [v - 1.96 * sd, v + 1.96 * sd],
        fanInner: [v - sd, v + sd],
      });
    }
    out[hist.length - 1] = {
      ...out[hist.length - 1],
      [`${lead.id}__f`]: last[lead.id],
      fanBand: [last[lead.id], last[lead.id]],
      fanInner: [last[lead.id], last[lead.id]],
    };
    return out;
  }, [history, period, forecast, chartGroup, hiddenSeries]);

  const toggleSeries = (id) =>
    setHiddenSeries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const visible = group.series.filter((s) => !hiddenSeries.includes(s.id));
  const leftDef = visible.find((s) => s.axis === 'left');
  const rightDef = visible.find((s) => s.axis === 'right');
  const seriesById = Object.fromEntries(group.series.map((s) => [s.id, s]));

  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          className="ems-serif"
          style={{ fontSize: 14, color: COLOR.goldSoft }}
        >
          График экономики
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            className="ems-btn"
            style={{
              padding: '4px 9px',
              fontSize: 11,
              background: forecast ? COLOR.gold : COLOR.panelAlt,
              color: forecast ? COLOR.ink : COLOR.text,
              borderColor: forecast ? COLOR.gold : COLOR.border,
            }}
            onClick={() => {
              Audio.play('tab');
              setForecast((f) => !f);
            }}
            title="Веер неопределённости на 8 кварталов вперёд"
          >
            прогноз
          </button>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                Audio.play('tab');
                setPeriod(p.id);
              }}
              className="ems-btn"
              style={{
                padding: '4px 9px',
                fontSize: 11,
                background: period === p.id ? COLOR.gold : COLOR.panelAlt,
                color: period === p.id ? COLOR.ink : COLOR.text,
                borderColor: period === p.id ? COLOR.gold : COLOR.border,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 2,
          borderBottom: `1px solid ${COLOR.border}`,
          marginBottom: 10,
        }}
      >
        {CHART_GROUPS.map((g) => (
          <span
            key={g.id}
            className={`ems-tab ${chartGroup === g.id ? 'active' : ''}`}
            onClick={() => {
              Audio.play('tab');
              setChartGroup(g.id);
            }}
          >
            {g.label}
          </span>
        ))}
      </div>

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}
      >
        {group.series.map((s) => {
          const active = !hiddenSeries.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => {
                Audio.play('tick');
                toggleSeries(s.id);
              }}
              className="ems-btn"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: active ? COLOR.panelAlt : 'transparent',
                borderColor: active ? s.color : COLOR.border,
                color: active ? COLOR.text : COLOR.muted,
                opacity: active ? 1 : 0.5,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="ems-visual" style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
          >
            <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: COLOR.muted }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: COLOR.muted }}
              width={50}
              tickFormatter={axisTick(leftDef ? leftDef.fmt : 'pct')}
            />
            {rightDef && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: COLOR.muted }}
                width={50}
                tickFormatter={axisTick(rightDef.fmt)}
              />
            )}
            <Tooltip
              contentStyle={{
                background: COLOR.panel,
                border: `1px solid ${COLOR.border}`,
                fontSize: 12,
              }}
              labelStyle={{ color: COLOR.goldSoft }}
              formatter={(value, name, props) => {
                const def = seriesById[props.dataKey];
                return [def ? tooltipVal(def.fmt)(value) : value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {forecast && visible[0] && (
              <Area
                yAxisId={visible[0].axis}
                type="monotone"
                dataKey="fanBand"
                name="95% интервал"
                stroke="none"
                fill={visible[0].color}
                fillOpacity={0.1}
                isAnimationActive={false}
                legendType="none"
              />
            )}
            {forecast && visible[0] && (
              <Area
                yAxisId={visible[0].axis}
                type="monotone"
                dataKey="fanInner"
                name="68% интервал"
                stroke="none"
                fill={visible[0].color}
                fillOpacity={0.18}
                isAnimationActive={false}
                legendType="none"
              />
            )}
            {forecast && visible[0] && (
              <Line
                yAxisId={visible[0].axis}
                type="monotone"
                dataKey={`${visible[0].id}__f`}
                name="прогноз"
                stroke={visible[0].color}
                strokeWidth={1.6}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                legendType="none"
              />
            )}
            {visible.map((s) => (
              <Line
                key={s.id}
                yAxisId={s.axis}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, marginTop: 4 }}>
        {forecast
          ? `Веер построен для показателя «${
              (visible[0] || group.series[0]).label
            }»: пунктир — инерционная траектория к якорю (цель ЦБ, потенциал, естественная безработица), заливка — интервалы 68% и 95%. Чем дальше горизонт, тем шире неопределённость.`
          : 'Темпы роста и ставки показаны в годовом выражении; траектория рассчитывается по кварталам. Нажмите на показатель выше, чтобы скрыть или показать его линию.'}
      </div>
    </div>
  );
}

function WhyModal({ reasons, onClose }) {
  const [tab, setTab] = useState('gdpGrowth');
  const TABS = [
    { id: 'gdpGrowth', label: 'ВВП' },
    { id: 'inflation', label: 'Инфляция' },
    { id: 'unemployment', label: 'Безработица' },
    { id: 'exchangeRate', label: 'Курс валюты' },
    { id: 'budget', label: 'Бюджет' },
    { id: 'banking', label: 'Банки' },
    { id: 'potential', label: 'Потенциал' },
  ];
  const list = reasons[tab] || [];
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,9,14,0.7)',
        backdropFilter: 'blur(2px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="ems-panel-raised ems-fade-in"
        style={{ maxWidth: 480, width: '100%', padding: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span
            className="ems-serif"
            style={{
              fontSize: 16,
              color: COLOR.goldSoft,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Info size={16} />
            Почему это произошло?
          </span>
          <button
            className="ems-btn"
            style={{ padding: '4px 7px' }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${COLOR.hairline}`,
            marginBottom: 12,
            paddingBottom: 10,
          }}
        >
          {TABS.map((t) => (
            <span
              key={t.id}
              className={`ems-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </span>
          ))}
        </div>
        {list.length === 0 && (
          <div style={{ color: COLOR.muted, fontSize: 12.5 }}>
            В этом квартале не было значимых отдельных факторов — динамика
            определялась общей инерцией экономики.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            maxHeight: 320,
            overflowY: 'auto',
          }}
          className="ems-scroll"
        >
          {list.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12.5,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  color: r.amount >= 0 ? COLOR.teal : COLOR.rust,
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {r.amount >= 0 ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                )}
              </span>
              <span>{r.reasonText}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   ЗВУК: интерфейсные эффекты и генеративная музыка, реагирующая на состояние экономики.
   Всё синтезируется через Web Audio прямо в браузере — внешних файлов нет.
========================================================================================= */
/* =========================================================================================
   ЗВУК И МУЗЫКА: интерфейсные эффекты и шесть написанных тем, переключающихся
   по режиму экономики. Всё синтезируется через Web Audio — внешних файлов нет.
========================================================================================= */
/* =========================================================================================
   ЗВУК И МУЗЫКА: семнадцать написанных пьес с многочастной формой, живой оркестровкой
   и переключением по режиму экономики. Всё синтезируется через Web Audio.
========================================================================================= */
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const nn = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 60;
  return (
    NOTE_BASE[m[1]] +
    (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) +
    (parseInt(m[3], 10) + 1) * 12
  );
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const H = (str) => str.split('|').map((bar) => bar.trim().split(/\s+/).map(nn));
const MEL = (str) =>
  str
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const [st, note, dur] = tok.split(':');
      return [parseInt(st, 10), nn(note), parseInt(dur, 10)];
    });
const drum = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i++) if (s[i] !== '.') out.push([i, s[i]]);
  return out;
};
const DR = (k, sn, h) => ({ kick: drum(k), snare: drum(sn), hat: drum(h) });

/* Фигуры левой руки: [шаг в такте, индекс тона аккорда] */
const LH = {
  flow: [
    [0, 0],
    [2, 1],
    [4, 2],
    [6, 3],
    [8, 2],
    [10, 1],
    [12, 2],
    [14, 3],
  ],
  wide: [
    [0, 0],
    [3, 1],
    [6, 2],
    [8, 3],
    [11, 2],
    [14, 1],
  ],
  waltz: [
    [0, 0],
    [4, 1],
    [6, 2],
    [8, 1],
    [12, 2],
    [14, 3],
  ],
  sustain: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  pulse: [
    [0, 0],
    [2, 1],
    [4, 0],
    [6, 1],
    [8, 0],
    [10, 1],
    [12, 0],
    [14, 1],
  ],
  drive: [
    [0, 0],
    [2, 0],
    [3, 1],
    [5, 0],
    [6, 1],
    [8, 0],
    [10, 0],
    [11, 1],
    [13, 0],
    [14, 1],
  ],
  roll: [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 1],
    [8, 0],
    [9, 1],
    [10, 2],
    [11, 3],
    [12, 2],
    [13, 1],
  ],
  air: [
    [0, 0],
    [6, 2],
    [10, 1],
  ],
};
const sec = (h, mel, lh, arr, dyn, drums) => ({
  h,
  mel,
  lh,
  arr,
  dyn: dyn || 1,
  drums: drums || null,
});

const TRACKS = {};
const tr = (id, name, subtitle, mood, cfg) => {
  TRACKS[id] = { id, name, subtitle, mood, ...cfg };
};

/* ------------------------------- СПОКОЙСТВИЕ ------------------------------- */
tr('dawn', 'Рассвет над министерством', 'фортепиано, струнные', 'calm', {
  bpm: 72,
  swing: 0.12,
  reverb: 0.42,
  A: H(
    'F2 C3 E3 A3 | A2 E3 G3 C4 | Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4'
  ),
  B: H('D3 A3 C4 F4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | G2 D3 F3 Bb3'),
  melA: MEL(
    '0:C5:4 4:F5:4 8:A5:8 16:G5:4 20:E5:4 24:C5:8 32:D5:4 36:F5:4 40:A5:8 48:G5:8 56:E5:8 64:F5:4 68:A5:4 72:C6:8 80:Bb5:4 84:A5:4 88:F5:8 96:D5:4 100:Bb4:4 104:D5:8 112:E5:4 116:G5:4 120:F5:12'
  ),
  melB: MEL(
    '0:A5:4 4:F5:4 8:E5:8 16:C#5:4 20:E5:4 24:A5:8 32:F5:4 36:D5:4 40:C5:8 48:Bb4:4 52:D5:4 56:F5:8'
  ),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('A', 'melA', 'flow', 'piano bass pad', 0.85),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 1.0),
    sec('A', 'melA', 'waltz', 'piano bass pad strings violin', 1.0),
  ],
});
tr('ledger', 'Тихая бухгалтерия', 'фортепиано соло', 'calm', {
  bpm: 68,
  swing: 0.14,
  reverb: 0.46,
  A: H(
    'D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'
  ),
  B: H('Bb2 F3 A3 D4 | F2 C3 E3 A3 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'),
  melA: MEL(
    '0:A4:4 4:D5:4 8:F5:8 16:E5:4 20:D5:4 24:C5:8 32:A4:4 36:C5:4 40:A4:4 44:F4:4 48:G4:8 56:E4:8 64:A4:4 68:D5:4 72:F5:8 80:G5:4 84:F5:4 88:E5:8 96:D5:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:12'
  ),
  melB: MEL(
    '0:F5:4 4:D5:4 8:A4:8 16:C5:4 20:E5:4 24:F5:8 32:D5:4 36:Bb4:4 40:G4:8 48:E5:4 52:C#5:4 56:A4:8'
  ),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.7),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad cello', 1.0),
  ],
});
tr('northlight', 'Северный свет', 'челеста, струнные', 'calm', {
  bpm: 64,
  swing: 0,
  reverb: 0.62,
  A: H(
    'Ab2 Eb3 G3 C4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 Eb4 | Ab2 Eb3 G3 C4 | F2 C3 Ab3 Eb4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4'
  ),
  B: H('F2 C3 Ab3 C4 | Db3 Ab3 C4 F4 | Bb2 F3 Ab3 D4 | Eb3 Bb3 D4 G4'),
  melA: MEL(
    '0:Eb5:8 8:G5:8 16:F5:8 24:Ab5:8 32:G5:8 40:Bb5:8 48:Eb5:14 64:C5:8 72:Eb5:8 80:Ab5:8 88:G5:8 96:F5:8 104:Db5:8 112:Eb5:14'
  ),
  melB: MEL('0:Ab5:8 8:C6:8 16:Bb5:12 32:F5:8 40:Ab5:8 48:G5:14'),
  sections: [
    sec('A', 'melA', 'air', 'bells pad bass', 0.68),
    sec('B', 'melB', 'sustain', 'bells pad strings bass', 0.9),
    sec('A', 'melA', 'flow', 'piano bells pad strings bass', 1.0),
  ],
});
tr('promenade', 'Прогулка по столице', 'фортепиано, арфа', 'calm', {
  bpm: 84,
  swing: 0.16,
  reverb: 0.34,
  A: H(
    'G2 D3 G3 B3 | E2 B2 E3 G3 | C3 G3 B3 E4 | D3 A3 C4 F#4 | G2 D3 G3 B3 | E2 B2 E3 G3 | A2 E3 G3 C#4 | D3 A3 C4 F#4'
  ),
  B: H('C3 G3 B3 E4 | B2 F#3 A3 D4 | E2 B2 E3 G3 | D3 A3 C4 F#4'),
  melA: MEL(
    '0:D5:4 4:G5:4 8:B5:4 12:A5:4 16:G5:8 24:E5:8 32:G5:4 36:B5:4 40:D6:8 48:C6:4 52:A5:4 56:F#5:8 64:D5:4 68:G5:4 72:B5:4 76:A5:4 80:G5:8 88:E5:8 96:C#5:4 100:E5:4 104:A5:8 112:F#5:4 116:A5:4 120:G5:8'
  ),
  melB: MEL(
    '0:E5:4 4:G5:4 8:B5:8 16:D5:4 20:F#5:4 24:A5:8 32:G5:4 36:E5:4 40:B4:8 48:A5:4 52:F#5:4 56:D5:8'
  ),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.72),
    sec('A', 'melA', 'roll', 'piano harp bass pad', 0.92),
    sec('B', 'melB', 'flow', 'piano harp bass pad strings', 1.0),
  ],
});

/* --------------------------------- ПОДЪЁМ --------------------------------- */
tr('ascent', 'Восхождение', 'фортепиано, ритм-секция', 'boom', {
  bpm: 108,
  swing: 0,
  reverb: 0.26,
  A: H(
    'A2 E3 A3 C#4 | G#2 E3 G#3 B3 | F#2 C#3 F#3 A3 | D3 A3 D4 F#4 | A2 E3 A3 C#4 | E3 B3 E4 G#4 | D3 A3 D4 F#4 | E3 B3 D4 G#4'
  ),
  B: H('D3 A3 D4 F#4 | C#3 G#3 C#4 E4 | B2 F#3 B3 D4 | E3 B3 D4 G#4'),
  melA: MEL(
    '0:E5:4 4:F#5:2 6:E5:2 8:C#5:8 16:B4:4 20:C#5:4 24:E5:8 32:F#5:4 36:E5:2 38:C#5:2 40:A4:8 48:D5:4 52:F#5:4 56:A5:8 64:E5:4 68:F#5:2 70:E5:2 72:C#5:8 80:B4:4 84:E5:4 88:G#5:8 96:A5:4 100:F#5:4 104:D5:8 112:E5:4 116:D5:4 120:C#5:8'
  ),
  melB: MEL(
    '0:F#5:4 4:A5:4 8:D6:8 16:E5:4 20:G#5:4 24:C#6:8 32:D5:4 36:F#5:4 40:B5:8 48:G#5:4 52:E5:4 56:B4:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'flow',
      'piano bass',
      0.75,
      DR('x.......x.......', '................', '..o...o...o...o.')
    ),
    sec(
      'A',
      'melA',
      'flow',
      'piano bass pad',
      0.9,
      DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'B',
      'melB',
      'roll',
      'piano harp bass pad strings',
      1.0,
      DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'A',
      'melA',
      'flow',
      'piano bass pad strings violin',
      1.0,
      DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')
    ),
  ],
});
tr('boulevard', 'Бульвар', 'струнные, фортепиано', 'boom', {
  bpm: 116,
  swing: 0,
  reverb: 0.3,
  A: H(
    'E2 B2 E3 G#3 | C#3 G#3 B3 E4 | A2 E3 A3 C#4 | B2 F#3 B3 D#4 | E2 B2 E3 G#3 | C#3 G#3 B3 E4 | F#2 C#3 F#3 A3 | B2 F#3 B3 D#4'
  ),
  B: H('A2 E3 A3 C#4 | B2 F#3 B3 D#4 | G#2 D#3 G#3 B3 | C#3 G#3 B3 E4'),
  melA: MEL(
    '0:B4:4 4:E5:4 8:G#5:8 16:F#5:4 20:E5:4 24:C#5:8 32:E5:4 36:A5:4 40:C#6:8 44:B5:4 48:F#5:4 52:D#5:4 56:B4:8 64:B4:4 68:E5:4 72:G#5:8 80:F#5:4 84:G#5:4 88:E5:8 96:A5:4 100:F#5:4 104:C#5:8 112:D#5:4 116:F#5:4 120:B4:8'
  ),
  melB: MEL(
    '0:C#5:4 4:E5:4 8:A5:8 16:B5:4 20:F#5:4 24:D#5:8 32:B4:4 36:D#5:4 40:G#5:8 48:E5:4 52:G#5:4 56:B5:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'flow',
      'piano bass strings',
      0.8,
      DR('x.......x.......', '....x.......x...', '..o...o...o...o.')
    ),
    sec(
      'B',
      'melB',
      'roll',
      'piano harp bass pad strings violin',
      1.0,
      DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'A',
      'melA',
      'flow',
      'piano bass pad strings violin',
      1.0,
      DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
  ],
});
tr('overdrive', 'Перегрев', 'синкопы, ударные', 'boom', {
  bpm: 126,
  swing: 0,
  reverb: 0.22,
  A: H(
    'B2 F#3 B3 D4 | A2 E3 A3 C#4 | G2 D3 G3 B3 | F#2 C#3 F#3 A3 | B2 F#3 B3 D4 | A2 E3 A3 C#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'
  ),
  B: H('G2 D3 G3 B3 | D3 A3 D4 F#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'),
  melA: MEL(
    '0:F#5:2 2:A5:2 4:F#5:2 6:D5:2 8:B4:8 16:C#5:4 20:E5:4 24:A5:8 32:B5:4 36:G5:4 40:D5:8 48:C#5:4 52:A4:4 56:F#4:8 64:F#5:2 66:A5:2 68:B5:4 72:F#5:8 80:E5:4 84:C#5:4 88:A4:8 96:B4:4 100:E5:4 104:G5:8 112:A5:4 116:F#5:4 120:C#5:8'
  ),
  melB: MEL(
    '0:D5:4 4:G5:4 8:B5:8 16:A5:4 20:F#5:4 24:D5:8 32:G5:4 36:B5:4 40:E5:8 48:C#5:4 52:A5:4 56:F#5:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'drive',
      'piano bass',
      0.85,
      DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'B',
      'melB',
      'drive',
      'piano bass pad strings',
      1.0,
      DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')
    ),
    sec(
      'A',
      'melA',
      'drive',
      'piano bass pad violin',
      1.0,
      DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')
    ),
  ],
});

/* --------------------------------- СПАД --------------------------------- */
tr('longwinter', 'Долгая зима', 'фортепиано, виолончель', 'slump', {
  bpm: 56,
  swing: 0.08,
  reverb: 0.58,
  A: H(
    'E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | B2 F#3 A3 D#4 | E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | E2 B2 E3 G3'
  ),
  B: H('C3 G3 B3 E4 | G2 D3 G3 B3 | A2 E3 G3 C4 | B2 F#3 A3 D#4'),
  melA: MEL(
    '0:B4:8 8:G4:8 16:E4:12 32:A4:8 40:C5:8 48:B4:14 64:G4:8 72:E4:8 80:E5:12 96:C5:8 104:B4:8 112:E4:14'
  ),
  melB: MEL('0:G4:8 8:B4:8 16:D5:12 32:C5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass', 0.66),
    sec('B', 'melB', 'air', 'piano bass cello pad', 0.85),
    sec('A', 'melA', 'waltz', 'piano bass cello pad strings', 1.0),
  ],
});
tr('emptyhalls', 'Пустые цеха', 'виолончель, фортепиано', 'slump', {
  bpm: 60,
  swing: 0.06,
  reverb: 0.55,
  A: H(
    'A2 E3 A3 C4 | G2 E3 A3 C4 | F2 C3 F3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | C3 A3 C4 E4 | E2 B2 E3 A3 | A2 E3 A3 C4'
  ),
  B: H('F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 C4 F4 | E2 B2 E3 G#3'),
  melA: MEL(
    '0:A4:8 8:C5:8 16:B4:12 32:A4:8 40:F4:8 48:G4:14 64:F4:8 72:A4:8 80:E5:12 96:B4:8 104:A4:8 112:A4:14'
  ),
  melB: MEL('0:C5:8 8:A4:8 16:G4:12 32:F4:8 40:D5:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass cello', 0.64),
    sec('A', 'melA', 'sustain', 'piano bass cello pad', 0.82),
    sec('B', 'melB', 'wide', 'piano bass cello pad strings', 1.0),
  ],
});
tr('patience', 'Терпение', 'фортепиано, струнные', 'slump', {
  bpm: 66,
  swing: 0.1,
  reverb: 0.5,
  A: H(
    'C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 G3 B3'
  ),
  B: H('Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | Ab2 Eb3 Ab3 C4 | G2 D3 G3 B3'),
  melA: MEL(
    '0:G4:8 8:Eb4:8 16:C5:12 32:Bb4:8 40:D5:8 48:G4:14 64:G4:8 72:C5:8 80:Eb5:12 96:C5:8 104:Ab4:8 112:G4:14'
  ),
  melB: MEL('0:Bb4:8 8:Eb5:8 16:D5:12 32:C5:8 40:Ab4:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0),
  ],
});

/* ------------------------------ СТАГФЛЯЦИЯ ------------------------------ */
tr('deadlock', 'Тупик', 'остинато, низкие струнные', 'stag', {
  bpm: 80,
  swing: 0,
  reverb: 0.36,
  A: H(
    'E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | E2 B2 E3 G3 | F2 C3 F3 A3 | C3 G3 C4 E4 | B2 D#3 F#3 A3'
  ),
  B: H('F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | B2 D#3 F#3 A3'),
  melA: MEL(
    '0:E4:8 8:F4:4 12:E4:4 16:F4:12 32:E4:8 40:D4:8 48:D4:14 64:E4:8 72:G4:8 80:F4:12 96:E4:8 104:C4:8 112:D#4:8 120:E4:8'
  ),
  melB: MEL('0:A4:8 8:F4:8 16:G4:12 32:F4:8 40:D4:8 48:D#4:12'),
  sections: [
    sec(
      'A',
      'melA',
      'pulse',
      'piano bass cello',
      0.75,
      DR('x.......x.......', '................', '....o.......o...')
    ),
    sec(
      'B',
      'melB',
      'pulse',
      'piano bass cello pad',
      0.9,
      DR('x.......x.......', '........x.......', '..o...o...o...o.')
    ),
    sec(
      'A',
      'melA',
      'pulse',
      'piano bass cello pad choir',
      1.0,
      DR('x...x...x...x...', '........x.......', '..o...o...o...o.')
    ),
  ],
});
tr('friction', 'Трение', 'фортепиано, хор', 'stag', {
  bpm: 86,
  swing: 0,
  reverb: 0.4,
  A: H(
    'D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | D3 A3 D4 F4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'
  ),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL(
    '0:D4:8 8:Eb4:4 12:D4:4 16:Eb4:12 32:F4:8 40:D4:8 48:C4:14 64:D4:8 72:F4:8 80:G4:12 96:D4:8 104:Bb3:8 112:C#4:8 120:D4:8'
  ),
  melB: MEL('0:Bb4:8 8:F4:8 16:Eb4:12 32:D4:8 40:A4:8 48:C#4:12'),
  sections: [
    sec(
      'A',
      'melA',
      'pulse',
      'piano bass choir',
      0.75,
      DR('x.......x.......', '................', '....o.......o...')
    ),
    sec(
      'B',
      'melB',
      'wide',
      'piano bass cello choir pad',
      0.95,
      DR('x.......x.......', '........x.......', '..o...o...o...o.')
    ),
    sec(
      'A',
      'melA',
      'pulse',
      'piano bass cello choir pad',
      1.0,
      DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')
    ),
  ],
});

/* -------------------------------- КРИЗИС -------------------------------- */
tr('collapse', 'Обвал', 'бас, ударные, фортепиано', 'crisis', {
  bpm: 128,
  swing: 0,
  reverb: 0.26,
  A: H(
    'C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 F3 B3'
  ),
  B: H('Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | G2 D3 F3 B3'),
  melA: MEL(
    '0:G4:2 2:Ab4:2 4:G4:2 6:F4:2 8:Eb4:8 16:Eb4:2 18:F4:2 20:Eb4:4 24:C4:8 32:G4:4 36:Bb4:4 40:Eb5:8 48:D5:4 52:Bb4:4 56:F4:8 64:G4:2 66:Ab4:2 68:G4:2 70:F4:2 72:Eb4:8 80:C5:4 84:Ab4:4 88:Eb4:8 96:Ab4:4 100:C5:4 104:F5:8 112:D5:4 116:B4:4 120:G4:8'
  ),
  melB: MEL(
    '0:Ab4:4 4:C5:4 8:Eb5:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:C5:4 40:Eb5:8 48:B4:4 52:D5:4 56:G5:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'drive',
      'piano bass cello',
      0.85,
      DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'B',
      'melB',
      'drive',
      'piano bass cello choir',
      1.0,
      DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')
    ),
    sec(
      'A',
      'melA',
      'drive',
      'piano bass cello choir violin',
      1.0,
      DR('x..x..x.x.x..x..', '....x...x...x...', 'oooooooooooooooo')
    ),
  ],
});
tr('panic', 'Паника', 'струнные, литавры', 'crisis', {
  bpm: 136,
  swing: 0,
  reverb: 0.3,
  A: H(
    'D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'
  ),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL(
    '0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:A4:2 34:C5:2 36:A4:4 40:F4:8 48:E5:4 52:C5:4 56:G4:8 64:A4:2 66:Bb4:2 68:A4:2 70:G4:2 72:F4:8 80:D5:4 84:F5:4 88:Bb4:8 96:G4:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:8'
  ),
  melB: MEL(
    '0:F5:4 4:D5:4 8:Bb4:8 16:E5:4 20:C5:4 24:G4:8 32:A5:4 36:F5:4 40:D5:8 48:E5:4 52:C#5:4 56:A4:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'drive',
      'piano bass strings timpani',
      0.9,
      DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'B',
      'melB',
      'drive',
      'piano bass strings choir timpani',
      1.0,
      DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')
    ),
    sec(
      'A',
      'melA',
      'drive',
      'piano bass strings violin timpani',
      1.0,
      DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')
    ),
  ],
});
tr('bankrun', 'Очередь у банка', 'остинато, хор', 'crisis', {
  bpm: 118,
  swing: 0,
  reverb: 0.34,
  A: H(
    'G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | D3 A3 D4 F#4 | G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | D3 A3 D4 F#4'
  ),
  B: H('Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | D3 A3 D4 F#4'),
  melA: MEL(
    '0:D5:4 4:Eb5:4 8:D5:8 16:Bb4:4 20:G5:4 24:Eb5:8 32:C5:4 36:A4:4 40:F4:8 48:F#4:4 52:A4:4 56:D5:8 64:D5:4 68:Eb5:4 72:F5:8 80:G5:4 84:Eb5:4 88:Bb4:8 96:C5:4 100:Eb5:4 104:G5:8 112:F#5:4 116:A5:4 120:D5:8'
  ),
  melB: MEL(
    '0:G5:4 4:Bb5:4 8:Eb5:8 16:C5:4 20:F5:4 24:A4:8 32:Bb4:4 36:D5:4 40:G5:8 48:A5:4 52:F#5:4 56:D5:8'
  ),
  sections: [
    sec(
      'A',
      'melA',
      'pulse',
      'piano bass cello',
      0.85,
      DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')
    ),
    sec(
      'B',
      'melB',
      'drive',
      'piano bass cello choir timpani',
      1.0,
      DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')
    ),
    sec(
      'A',
      'melA',
      'drive',
      'piano bass cello choir strings timpani',
      1.0,
      DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')
    ),
  ],
});

/* ------------------------------- ДЕФЛЯЦИЯ ------------------------------- */
tr('glass', 'Стеклянный воздух', 'колокольчики, хор', 'frost', {
  bpm: 52,
  swing: 0,
  reverb: 0.72,
  A: H(
    'F2 C3 E3 A3 | C3 G3 B3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | A2 E3 G3 C4 | G2 D3 F3 Bb3 | C3 G3 C4 D4'
  ),
  B: H('Bb2 F3 A3 D4 | C3 G3 B3 E4 | D3 A3 C4 F4 | C3 G3 C4 D4'),
  melA: MEL(
    '0:C6:12 16:A5:12 32:F5:14 48:D5:14 64:C6:12 80:E5:12 96:Bb5:14 112:G5:14'
  ),
  melB: MEL('0:D6:12 16:C6:12 32:A5:14 48:G5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad', 0.65),
    sec('B', 'melB', 'air', 'bells bass pad choir', 0.85),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 1.0),
  ],
});
tr('stillness', 'Ничего не происходит', 'хор, низкие струнные', 'frost', {
  bpm: 48,
  swing: 0,
  reverb: 0.75,
  A: H(
    'Bb2 F3 A3 D4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'
  ),
  B: H('G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  melA: MEL(
    '0:D5:14 16:F5:14 32:G5:14 48:A5:14 64:D5:14 80:Bb4:14 96:G5:14 112:A5:14'
  ),
  melB: MEL('0:Bb4:14 16:E5:14 32:G5:14 48:A5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad choir', 0.6),
    sec('B', 'melB', 'sustain', 'bells bass pad choir cello', 0.8),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 0.95),
  ],
});

const MOOD_PLAYLISTS = {
  calm: ['dawn', 'ledger', 'northlight', 'promenade'],
  boom: ['ascent', 'boulevard', 'overdrive'],
  slump: ['longwinter', 'emptyhalls', 'patience'],
  stag: ['deadlock', 'friction'],
  crisis: ['collapse', 'panic', 'bankrun'],
  frost: ['glass', 'stillness'],
};
const MOOD_LABEL = {
  calm: 'Спокойствие',
  boom: 'Подъём',
  slump: 'Спад',
  stag: 'Стагфляция',
  crisis: 'Кризис',
  frost: 'Дефляция',
};
const REGIME_MOOD = {
  normal: 'calm',
  overheating: 'boom',
  recession: 'slump',
  stagflation: 'stag',
  banking: 'crisis',
  debt: 'crisis',
  currency: 'crisis',
  deflation: 'frost',
};

const Audio = (() => {
  let ctx = null;
  let master = null;
  let comp = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuf = null;
  let dry = null;
  let verbIn = null;
  let echo = null;
  let pianoBus = null;
  let chorusIn = null;
  const opts = { music: true, sfx: true, volume: 0.6 };
  let lastTick = 0;
  const listeners = [];
  let track = TRACKS.dawn;
  let mood = 'calm';
  let lockedMood = null;
  let playlistIdx = 0;
  let pending = null;
  let tempoMod = 1;
  let intensity = 0.3;
  let timer = null;
  let nextTime = 0;
  let stepIdx = 0;
  let running = false;

  const now = () => (ctx ? ctx.currentTime : 0);
  const resume = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  const jitter = () => (Math.random() - 0.5) * 0.014;
  const notify = () =>
    listeners.forEach((f) => {
      try {
        f();
      } catch (e) {
        /* ignore */
      }
    });
  const plan = (t) => {
    let bar = 0;
    return t.sections.map((s) => {
      const start = bar;
      bar += t[s.h].length;
      return { ...s, start, bars: t[s.h].length };
    });
  };
  let sectionPlan = plan(track);
  let formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);

  const makeIR = (seconds, decay) => {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        lp += (Math.random() * 2 - 1 - lp) * (0.3 - 0.22 * (i / len));
        d[i] = lp * env;
      }
    }
    return buf;
  };

  const ensure = () => {
    if (ctx) return ctx;
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = opts.volume;
    try {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 22;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.28;
      master.connect(comp);
      comp.connect(ctx.destination);
    } catch (e) {
      master.connect(ctx.destination);
    }
    musicBus = ctx.createGain();
    musicBus.gain.value = opts.music ? 0.55 : 0;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = opts.sfx ? 0.9 : 0;
    sfxBus.connect(master);
    dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(musicBus);
    try {
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 220;
      body.Q.value = 0.8;
      body.gain.value = 2.5;
      const air = ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 5400;
      air.gain.value = -4;
      pianoBus = ctx.createGain();
      pianoBus.gain.value = 1;
      pianoBus.connect(body);
      body.connect(air);
      air.connect(dry);
    } catch (e) {
      pianoBus = dry;
    }
    try {
      const conv = ctx.createConvolver();
      conv.buffer = makeIR(4.0, 2.1);
      const pre = ctx.createDelay(0.2);
      pre.delayTime.value = 0.024;
      verbIn = ctx.createGain();
      verbIn.gain.value = 1;
      const wet = ctx.createGain();
      wet.gain.value = 0.9;
      verbIn.connect(pre);
      pre.connect(conv);
      conv.connect(wet);
      wet.connect(musicBus);
    } catch (e) {
      verbIn = ctx.createGain();
      verbIn.gain.value = 0;
      verbIn.connect(musicBus);
    }
    // хорус для струнных и хора: две модулированные линии задержки
    try {
      chorusIn = ctx.createGain();
      chorusIn.gain.value = 1;
      chorusIn.connect(dry);
      [
        [0.014, 0.31],
        [0.021, 0.23],
      ].forEach(([base, rate], i) => {
        const dl = ctx.createDelay(0.1);
        dl.delayTime.value = base;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = rate;
        const amt = ctx.createGain();
        amt.gain.value = 0.0035;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        lfo.connect(amt);
        amt.connect(dl.delayTime);
        lfo.start();
        chorusIn.connect(dl);
        dl.connect(g);
        g.connect(dry);
      });
    } catch (e) {
      chorusIn = dry;
    }
    try {
      const dl = ctx.createDelay(1.0);
      dl.delayTime.value = 0.36;
      const fb = ctx.createGain();
      fb.gain.value = 0.26;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2200;
      echo = ctx.createGain();
      echo.gain.value = 0.15;
      echo.connect(dl);
      dl.connect(damp);
      damp.connect(fb);
      fb.connect(dl);
      dl.connect(musicBus);
    } catch (e) {
      echo = dry;
    }
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dat = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;
    return ctx;
  };
  const panFor = (midi, width) => {
    try {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp((midi - 62) / 30, -1, 1) * (width || 0.35);
      return p;
    } catch (e) {
      return ctx.createGain();
    }
  };
  const sendTo = (node, bus, amt) => {
    const g = ctx.createGain();
    g.gain.value = amt;
    node.connect(g);
    g.connect(bus);
  };

  /* ------------------------------- ИНСТРУМЕНТЫ ------------------------------- */
  const PART_AMP = [1, 0.58, 0.34, 0.22, 0.14, 0.09, 0.06, 0.04];
  const piano = (t, midi, vel, sustain, maxParts) => {
    const f = hz(midi);
    if (f > 5000 || f < 25) return;
    const inharm = 0.00045 * Math.pow(2, (62 - midi) / 22);
    const ring = clamp((6.8 - (midi - 33) * 0.062) * (sustain || 1), 0.7, 7.5);
    const nPart = Math.min(maxParts || 8, midi > 81 ? 4 : midi > 66 ? 6 : 8);
    const out = ctx.createGain();
    out.gain.value = 0.085 * vel;
    const pan = panFor(midi);
    out.connect(pan);
    pan.connect(pianoBus);
    sendTo(out, verbIn, track.reverb);
    for (let n = 1; n <= nPart; n++) {
      const pf = f * n * Math.sqrt(1 + inharm * n * n);
      if (pf > 11000) break;
      const amp = PART_AMP[n - 1] * Math.pow(vel, 0.45 + 0.16 * (n - 1));
      const dec = Math.max(0.12, ring / (1 + 0.52 * (n - 1)));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.00008, t + dec);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = pf;
      o.detune.value = (Math.random() - 0.5) * 2.5;
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
    const hs = ctx.createBufferSource();
    hs.buffer = noiseBuf;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = Math.min(7000, f * 4);
    hf.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.02 * vel * vel, t);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    hs.connect(hf);
    hf.connect(hg);
    hg.connect(out);
    hs.start(t);
    hs.stop(t + 0.06);
  };
  const harp = (t, midi, dur, vel) => {
    const out = ctx.createGain();
    out.gain.value = 0.055 * vel;
    const pan = panFor(midi, 0.5);
    out.connect(pan);
    pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 1.2);
    [
      [1, 0.7],
      [2, 0.28],
      [3, 0.12],
      [4.02, 0.06],
    ].forEach(([mul, amp]) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        t + dur * (mul > 2 ? 0.5 : 1)
      );
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(midi) * mul;
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  };
  const bell = (t, midi, dur, vel) => {
    const out = ctx.createGain();
    out.gain.value = 0.07 * (vel || 1);
    const pan = panFor(midi, 0.45);
    out.connect(pan);
    pan.connect(dry);
    sendTo(out, verbIn, 1.15);
    [
      [1, 0.55, 1],
      [2.01, 0.28, 0.75],
      [3.01, 0.14, 0.55],
      [4.98, 0.07, 0.4],
    ].forEach(([mul, amp, dm]) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * dm);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(midi) * mul;
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur * dm + 0.1);
    });
  };
  const bowed = (t, midi, dur, vel, bright, panW) => {
    // виолончель / скрипка
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(
      Math.max(0.0004, 0.055 * vel),
      t + Math.min(0.22, dur * 0.3)
    );
    out.gain.setValueAtTime(Math.max(0.0004, 0.055 * vel), t + dur * 0.72);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(bright * 0.6, t);
    filt.frequency.linearRampToValueAtTime(bright, t + dur * 0.4);
    filt.Q.value = 0.9;
    filt.connect(out);
    const pan = panFor(midi, panW || 0.3);
    out.connect(pan);
    pan.connect(chorusIn);
    sendTo(out, verbIn, track.reverb * 1.1);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.1 + Math.random() * 0.6;
    const lg = ctx.createGain();
    lg.gain.value = 0;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(6, t + Math.min(0.5, dur * 0.5));
    lfo.connect(lg);
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
    [
      [1, 'sawtooth', 0.6, -4],
      [1, 'triangle', 0.3, 5],
      [2, 'sawtooth', 0.12, 0],
    ].forEach(([mul, wave, amp, det]) => {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = hz(midi) * mul;
      o.detune.value = det;
      lg.connect(o.detune);
      const a = ctx.createGain();
      a.gain.value = amp;
      o.connect(a);
      a.connect(filt);
      o.start(t);
      o.stop(t + dur + 0.3);
    });
  };
  const cello = (t, midi, dur, vel) =>
    bowed(t, midi, dur, vel * 1.15, 900, 0.2);
  const violin = (t, midi, dur, vel) => {
    bowed(t, midi, dur, vel * 0.9, 3000, 0.35);
  };
  const strings = (t, notes, dur, level) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0004, level),
      t + dur * 0.38
    );
    g.gain.setValueAtTime(Math.max(0.0004, level), t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900 + 900 * (1 - intensity);
    filt.Q.value = 0.5;
    filt.connect(g);
    g.connect(chorusIn);
    sendTo(g, verbIn, 1.0);
    notes.forEach((midi, i) => {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(midi + 12);
        o.detune.value = det + i;
        const a = ctx.createGain();
        a.gain.value = 0.85 / notes.length;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.4 + i * 0.3;
        const lg = ctx.createGain();
        lg.gain.value = 3.5;
        lfo.connect(lg);
        lg.connect(o.detune);
        lfo.start(t);
        lfo.stop(t + dur + 0.2);
        o.connect(a);
        a.connect(filt);
        o.start(t);
        o.stop(t + dur + 0.2);
      });
    });
  };
  const choir = (t, notes, dur, level) => {
    // формантный «хор»
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0004, level * 0.9),
      t + dur * 0.45
    );
    g.gain.setValueAtTime(Math.max(0.0004, level * 0.9), t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(chorusIn);
    sendTo(g, verbIn, 1.25);
    const mix = ctx.createGain();
    mix.gain.value = 1;
    [
      [720, 1.0, 3],
      [1180, 0.55, 4],
      [2600, 0.22, 6],
    ].forEach(([f0, amp, q]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0;
      bp.Q.value = q;
      const a = ctx.createGain();
      a.gain.value = amp;
      mix.connect(bp);
      bp.connect(a);
      a.connect(g);
    });
    notes.forEach((midi, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi + 12);
      o.detune.value = (i % 2 ? 6 : -6) + (Math.random() - 0.5) * 7;
      const a = ctx.createGain();
      a.gain.value = 0.5 / notes.length;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.1 + i * 0.25;
      const lg = ctx.createGain();
      lg.gain.value = 4;
      lfo.connect(lg);
      lg.connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.2);
      o.connect(a);
      a.connect(mix);
      o.start(t);
      o.stop(t + dur + 0.2);
    });
  };
  const timpani = (t, midi, vel) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz(midi) * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.09);
    g.gain.setValueAtTime(0.13 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g);
    g.connect(dry);
    sendTo(g, verbIn, 0.7);
    o.start(t);
    o.stop(t + 1.2);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(f);
    f.connect(ng);
    ng.connect(dry);
    src.start(t);
    src.stop(t + 0.3);
  };
  const kick = (t, vel) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(125, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
    g.gain.setValueAtTime(0.15 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    g.connect(dry);
    o.start(t);
    o.stop(t + 0.28);
  };
  const noiseHit = (t, dur, gain, type, freq, q, bus) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || dry);
    src.start(t);
    src.stop(t + dur + 0.05);
  };
  const snare = (t, vel) => {
    noiseHit(t, 0.15, 0.05 * vel, 'bandpass', 1900, 0.9);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    g.gain.setValueAtTime(0.028 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g);
    g.connect(dry);
    o.start(t);
    o.stop(t + 0.14);
  };
  const hat = (t, open) =>
    noiseHit(t, open ? 0.09 : 0.035, 0.02, 'highpass', 7600, 0.7);

  /* ------------------------------- СЕКВЕНСОР ------------------------------- */
  /* Атмосферный слой: низкий гул, «ветер» и сердцебиение под музыкой */
  let amb = null;
  let heartTimer = null;
  const ensureAmb = () => {
    if (amb || !ctx) return;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(musicBus);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 140;
    f.Q.value = 0.8;
    f.connect(g);
    const a1 = ctx.createOscillator();
    a1.type = 'sine';
    a1.frequency.value = 41.2;
    const a2 = ctx.createOscillator();
    a2.type = 'sawtooth';
    a2.frequency.value = 41.2;
    a2.detune.value = 8;
    const ag = ctx.createGain();
    ag.gain.value = 0.5;
    a1.connect(f);
    a2.connect(ag);
    ag.connect(f);
    a1.start();
    a2.start();
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 320;
    const wg = ctx.createGain();
    wg.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.12;
    lfo.connect(lg);
    lg.connect(wg.gain);
    lfo.start();
    wind.connect(wf);
    wf.connect(wg);
    wg.connect(g);
    wind.start();
    amb = { gain: g, filter: f, oscB: a2, wind: wf };
  };
  const heartbeat = () => {
    if (!ctx || !amb) return;
    const t = now();
    [0, 0.26].forEach((d, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(58, t + d);
      o.frequency.exponentialRampToValueAtTime(30, t + d + 0.12);
      g.gain.setValueAtTime(i ? 0.05 : 0.075, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
      o.connect(g);
      g.connect(musicBus);
      o.start(t + d);
      o.stop(t + d + 0.35);
    });
  };
  const stepDur = () => 60 / (track.bpm * tempoMod) / 4;
  const accent = (pos) =>
    pos === 0 ? 1 : pos % 8 === 0 ? 0.92 : pos % 4 === 0 ? 0.84 : 0.72;
  const BASS_DEG = [0, 7, 12, 3];

  const setTrack = (id) => {
    if (!TRACKS[id]) return;
    track = TRACKS[id];
    sectionPlan = plan(track);
    formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);
    stepIdx = 0;
    notify();
  };
  const advancePlaylist = (forward) => {
    const list = MOOD_PLAYLISTS[lockedMood || mood] || MOOD_PLAYLISTS.calm;
    playlistIdx =
      (playlistIdx + (forward === false ? -1 : 1) + list.length) % list.length;
    pending = list[playlistIdx];
  };

  const scheduleStep = (idx, t) => {
    const totalSteps = formBars * 16;
    const i = ((idx % totalSteps) + totalSteps) % totalSteps;
    const bar = Math.floor(i / 16);
    const pos = i % 16;
    const sc =
      sectionPlan.find((x) => bar >= x.start && bar < x.start + x.bars) ||
      sectionPlan[0];
    const harmony = track[sc.h];
    const barIn = bar - sc.start;
    const voicing = harmony[barIn % harmony.length];
    const melody = track[sc.mel] || [];
    const stepIn = barIn * 16 + pos;
    const sd = stepDur();
    const arr = sc.arr;
    const has = (k) => arr.indexOf(k) >= 0;
    const dyn = sc.dyn * (0.88 + 0.18 * intensity);

    // гармония
    if (pos === 0) {
      if (has('pad'))
        strings(t, voicing.slice(1, 3), sd * 16 * 0.96, 0.055 * dyn);
      if (has('choir')) choir(t, voicing.slice(1), sd * 16 * 0.94, 0.05 * dyn);
      if (has('strings'))
        strings(t, voicing.slice(1, 4), sd * 16 * 0.92, 0.042 * dyn);
      if (has('timpani') && bar % 2 === 0)
        timpani(t, voicing[0] - 12, 0.8 * dyn);
    }
    // бас
    if (pos === 0 || pos === 8) {
      if (has('cello')) cello(t, voicing[0] - 12, sd * 8 * 0.95, 0.95 * dyn);
      else if (has('bass'))
        piano(t + jitter(), voicing[0] - 12, 0.5 * accent(pos) * dyn, 1.1, 5);
    }
    // фигура левой руки
    const fig = LH[sc.lh] || LH.flow;
    fig.forEach(([st, deg]) => {
      if (st !== pos) return;
      const vel = (0.38 + 0.16 * accent(pos)) * dyn;
      const note = voicing[deg % voicing.length];
      if (has('harp')) harp(t + jitter(), note + 12, sd * 6, vel);
      if (has('piano'))
        piano(
          t + jitter(),
          note,
          vel,
          track.bpm > 100 ? 0.55 : sc.lh === 'sustain' ? 1.0 : 0.85,
          sc.lh === 'sustain' ? 4 : 5
        );
      else if (has('bells') && !has('harp') && st % 4 === 0)
        bell(t, note + 12, sd * 6, 0.6 * vel);
    });
    // мелодия
    melody.forEach(([st, midi, dur]) => {
      if (st !== stepIn) return;
      const vel = (0.78 + 0.2 * accent(pos)) * dyn;
      if (has('violin')) violin(t, midi, sd * dur * 1.05, vel);
      if (has('bells')) bell(t, midi, sd * dur * 1.7, vel * 0.9);
      if (!has('violin') && !has('bells')) {
        piano(t + jitter(), midi, Math.min(1, vel), 1);
        if (dur >= 8 && track.mood !== 'crisis')
          piano(t + jitter(), midi - 12, vel * 0.32, 0.8);
      } else if (has('piano') && has('violin')) {
        piano(t + jitter(), midi, vel * 0.5, 0.9, 5);
      }
    });
    // ударные
    const d = sc.drums;
    if (d) {
      d.kick.forEach(([st]) => {
        if (st === pos) kick(t, (0.75 + 0.3 * intensity) * dyn);
      });
      d.snare.forEach(([st]) => {
        if (st === pos) snare(t, (0.75 + 0.3 * intensity) * dyn);
      });
      d.hat.forEach(([st, c]) => {
        if (st === pos) hat(t, c === 'O');
      });
    }
  };

  const scheduler = () => {
    if (!ctx || !running) return;
    if (nextTime < now() - 0.4) nextTime = now() + 0.06;
    let guard = 0;
    while (nextTime < now() + 0.22 && guard++ < 24) {
      const totalSteps = formBars * 16;
      if (stepIdx % 16 === 0 && pending && pending !== track.id) {
        setTrack(pending);
        pending = null;
        if (musicBus) {
          musicBus.gain.setTargetAtTime(opts.music ? 0.18 : 0, now(), 0.12);
          musicBus.gain.setTargetAtTime(
            opts.music ? 0.55 : 0,
            now() + 0.7,
            0.7
          );
        }
      }
      if (stepIdx > 0 && stepIdx % totalSteps === 0) advancePlaylist(true); // пьеса сыграна целиком
      const sd = stepDur();
      const swing = stepIdx % 2 === 1 ? track.swing * sd : 0;
      scheduleStep(stepIdx, nextTime + swing);
      nextTime += sd;
      stepIdx += 1;
    }
  };

  /* ---------------------------- ЗВУКИ ИНТЕРФЕЙСА ---------------------------- */
  const tone = (freq, t0, dur, gain, wave) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  const SFX = {
    tick: () => tone(1250, now(), 0.035, 0.028, 'triangle'),
    click: () => {
      const t = now();
      tone(760, t, 0.05, 0.045, 'square');
      tone(1140, t + 0.015, 0.05, 0.025, 'triangle');
    },
    tab: () => tone(560, now(), 0.06, 0.032, 'triangle'),
    paper: () => {
      const t = now();
      noiseHit(t, 0.28, 0.055, 'bandpass', 2600, 0.7, sfxBus);
      noiseHit(t + 0.09, 0.22, 0.035, 'bandpass', 3400, 0.9, sfxBus);
    },
    stamp: () => {
      const t = now();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(sfxBus);
      o.start(t);
      o.stop(t + 0.35);
      noiseHit(t, 0.09, 0.08, 'bandpass', 1800, 0.6, sfxBus);
    },
    up: () => {
      const t = now();
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone(f, t + i * 0.075, 0.4, 0.04, 'triangle')
      );
    },
    down: () => {
      const t = now();
      [659.25, 523.25, 392.0].forEach((f, i) =>
        tone(f, t + i * 0.085, 0.45, 0.04, 'triangle')
      );
    },
    alarm: () => {
      const t = now();
      [0, 0.22, 0.44].forEach((d) => {
        tone(233, t + d, 0.18, 0.06, 'square');
        tone(175, t + d + 0.09, 0.18, 0.05, 'square');
      });
    },
    news: () => {
      const t = now();
      tone(1500, t, 0.04, 0.025, 'sine');
      tone(2100, t + 0.05, 0.05, 0.02, 'sine');
    },
    coin: () => {
      const t = now();
      tone(988, t, 0.09, 0.035, 'triangle');
      tone(1319, t + 0.05, 0.16, 0.03, 'triangle');
    },
  };

  return {
    opts,
    trackName: () => track.name,
    nowPlaying: () => ({
      id: track.id,
      name: track.name,
      subtitle: track.subtitle,
      mood: track.mood,
      moodLabel: MOOD_LABEL[track.mood],
      bpm: Math.round(track.bpm * tempoMod),
      locked: lockedMood,
    }),
    playlist: () =>
      (MOOD_PLAYLISTS[lockedMood || mood] || []).map((id) => ({
        id,
        name: TRACKS[id].name,
        current: id === track.id,
      })),
    onChange: (fn) => {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    skip(forward) {
      if (!ensure()) return;
      resume();
      advancePlaylist(forward);
      if (!running) this.startMusic();
    },
    playTrack(id) {
      if (!ensure()) return;
      resume();
      pending = id;
      const list = MOOD_PLAYLISTS[lockedMood || mood] || [];
      const i = list.indexOf(id);
      if (i >= 0) playlistIdx = i;
      if (!running) this.startMusic();
    },
    setPlaylist(moodId) {
      lockedMood = moodId || null;
      const list = MOOD_PLAYLISTS[lockedMood || mood] || MOOD_PLAYLISTS.calm;
      playlistIdx = 0;
      pending = list[0];
      notify();
      if (!running && opts.music) this.startMusic();
    },
    prime() {
      const c = ensure();
      if (c) resume();
      return !!c;
    },
    play(name) {
      if (!opts.sfx) return;
      if (name === 'tick') {
        const t = Date.now();
        if (t - lastTick < 70) return;
        lastTick = t;
      }
      if (!ensure()) return;
      resume();
      const fn = SFX[name];
      if (fn) {
        try {
          fn();
        } catch (e) {
          /* тишина важнее падения */
        }
      }
    },
    startMusic() {
      if (!ensure()) return;
      resume();
      if (running || !opts.music) return;
      running = true;
      stepIdx = 0;
      nextTime = now() + 0.2;
      if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 1.5);
      timer = setInterval(() => {
        try {
          scheduler();
        } catch (e) {
          /* музыка не ломает игру */
        }
      }, 40);
      notify();
    },
    stopMusic() {
      running = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (musicBus) musicBus.gain.setTargetAtTime(0.0001, now(), 0.3);
      notify();
    },
    setMusic(on) {
      opts.music = on;
      if (!ensure()) return;
      if (on) {
        if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 0.5);
        this.startMusic();
      } else this.stopMusic();
    },
    setSfx(on) {
      opts.sfx = on;
      if (ensure() && sfxBus)
        sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.1);
    },
    setVolume(v) {
      opts.volume = v;
      if (ensure() && master) master.gain.setTargetAtTime(v, now(), 0.1);
    },
    setAmbience(regime, k) {
      if (!ensure()) return;
      ensureAmb();
      if (!amb) return;
      const crisis =
        ['banking', 'debt', 'currency', 'stagflation'].indexOf(regime) >= 0;
      const lvl = crisis
        ? 0.055 + 0.075 * k
        : regime === 'recession'
        ? 0.026
        : regime === 'overheating'
        ? 0.018
        : 0.005;
      amb.gain.gain.setTargetAtTime(lvl, now(), 2.2);
      amb.filter.frequency.setTargetAtTime(
        crisis ? 180 + 260 * k : 120,
        now(),
        2.5
      );
      amb.oscB.detune.setTargetAtTime(crisis ? 20 + 14 * k : 6, now(), 2.5);
      amb.wind.frequency.setTargetAtTime(
        crisis ? 420 + 300 * k : 260,
        now(),
        2.5
      );
      if (crisis && k > 0.5) {
        if (!heartTimer)
          heartTimer = setInterval(() => {
            try {
              heartbeat();
            } catch (err) {
              /* тихо */
            }
          }, 1700);
      } else if (heartTimer) {
        clearInterval(heartTimer);
        heartTimer = null;
      }
    },
    setMood(e) {
      const m = REGIME_MOOD[e.regime] || 'calm';
      intensity = clamp(
        (e.inflationRisk * 0.3 +
          e.bankingRisk * 0.3 +
          e.debtRisk * 0.2 +
          e.recessionRisk * 0.2) /
          100,
        0,
        1
      );
      tempoMod = clamp(
        0.95 + (e.gdpGrowth - 2.0) * 0.012 + intensity * 0.05,
        0.9,
        1.1
      );
      this.setAmbience(e.regime, intensity);
      if (m !== mood) {
        mood = m;
        playlistIdx = 0;
        if (!lockedMood) {
          pending = (MOOD_PLAYLISTS[m] || ['dawn'])[0];
          notify();
        }
      }
    },
    quarterSequence({ wellbeingDelta, newCrisis, bigNews }) {
      if (!opts.sfx) return;
      if (!ensure()) return;
      resume();
      SFX.stamp();
      setTimeout(() => {
        if (bigNews) SFX.news();
      }, 240);
      setTimeout(() => {
        if (newCrisis) SFX.alarm();
        else if (wellbeingDelta > 0.6) SFX.up();
        else if (wellbeingDelta < -0.6) SFX.down();
      }, 430);
    },
  };
})();

function AudioControls() {
  const [open, setOpen] = useState(false);
  const [music, setMusic] = useState(Audio.opts.music);
  const [sfx, setSfx] = useState(Audio.opts.sfx);
  const [vol, setVol] = useState(Audio.opts.volume);
  const [, forceRender] = useState(0);
  React.useEffect(() => Audio.onChange(() => forceRender((n) => n + 1)), []);
  const anyOn = music || sfx;
  const np = Audio.nowPlaying();
  const list = Audio.playlist();
  const moods = [
    ['auto', 'По режиму экономики'],
    ['calm', MOOD_LABEL.calm],
    ['boom', MOOD_LABEL.boom],
    ['slump', MOOD_LABEL.slump],
    ['stag', MOOD_LABEL.stag],
    ['crisis', MOOD_LABEL.crisis],
    ['frost', MOOD_LABEL.frost],
  ];
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ems-btn"
        style={{ padding: '7px 9px' }}
        title={`Музыка: ${np.name}`}
        onClick={() => {
          Audio.prime();
          Audio.play('click');
          setOpen((o) => !o);
        }}
      >
        {anyOn ? (
          <Volume2 size={14} />
        ) : (
          <VolumeX size={14} color={COLOR.faint} />
        )}
      </button>
      {open && (
        <div
          className="ems-panel-raised ems-fade-in"
          style={{
            position: 'absolute',
            right: 0,
            top: 38,
            width: 268,
            padding: 13,
            zIndex: 40,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: 8,
            }}
          >
            <Music size={13} color={COLOR.gold} />
            <span
              className="ems-serif"
              style={{ fontSize: 12.5, color: COLOR.goldSoft }}
            >
              Саундтрек
            </span>
            <span
              style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}
            >
              {np.moodLabel} · {np.bpm} BPM
            </span>
          </div>
          <div
            style={{
              background: COLOR.panelAlt,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 3,
              padding: '9px 10px',
              marginBottom: 9,
            }}
          >
            <div
              className="ems-serif"
              style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.2 }}
            >
              {np.name}
            </div>
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 2 }}>
              {np.subtitle}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <button
                className="ems-btn"
                style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }}
                onClick={() => {
                  Audio.play('tick');
                  Audio.skip(false);
                }}
              >
                ◀ пред.
              </button>
              <button
                className="ems-btn"
                style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }}
                onClick={() => {
                  Audio.play('tick');
                  Audio.skip(true);
                }}
              >
                след. ▶
              </button>
            </div>
          </div>
          {list.length > 1 && (
            <div
              style={{ marginBottom: 9, maxHeight: 116, overflowY: 'auto' }}
              className="ems-scroll"
            >
              {list.map((x) => (
                <div
                  key={x.id}
                  onClick={() => {
                    Audio.play('tick');
                    Audio.playTrack(x.id);
                  }}
                  style={{
                    fontSize: 11,
                    padding: '3px 6px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    color: x.current ? COLOR.goldSoft : COLOR.muted,
                    background: x.current ? COLOR.goldDim : 'transparent',
                  }}
                >
                  {x.current ? '♪ ' : '   '}
                  {x.name}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 9 }}>
            <div
              style={{ fontSize: 10.5, color: COLOR.muted, marginBottom: 4 }}
            >
              Что играть
            </div>
            <select
              className="ems-btn"
              value={np.locked || 'auto'}
              style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}
              onChange={(e) => {
                Audio.play('tab');
                Audio.setPlaylist(
                  e.target.value === 'auto' ? null : e.target.value
                );
              }}
            >
              {moods.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {[
            [
              'Музыка',
              music,
              (v) => {
                setMusic(v);
                Audio.setMusic(v);
              },
              Music,
            ],
            [
              'Интерфейс и события',
              sfx,
              (v) => {
                setSfx(v);
                Audio.setSfx(v);
                if (v) Audio.play('click');
              },
              Volume2,
            ],
          ].map(([label, val, set, Icon]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 7,
              }}
            >
              <Icon size={12} color={val ? COLOR.gold : COLOR.faint} />
              <span
                style={{
                  fontSize: 11.5,
                  color: val ? COLOR.text : COLOR.muted,
                  flex: 1,
                }}
              >
                {label}
              </span>
              <button
                className="ems-btn"
                style={{
                  padding: '2px 9px',
                  fontSize: 10.5,
                  background: val ? COLOR.gold : COLOR.panelAlt,
                  color: val ? COLOR.ink : COLOR.muted,
                  borderColor: val ? COLOR.gold : COLOR.border,
                }}
                onClick={() => set(!val)}
              >
                {val ? 'вкл' : 'выкл'}
              </button>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 9,
            }}
          >
            <span style={{ fontSize: 11, color: COLOR.muted, width: 54 }}>
              Громкость
            </span>
            <input
              type="range"
              className="ems-slider"
              min={0}
              max={1}
              step={0.05}
              value={vol}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVol(v);
                Audio.setVolume(v);
              }}
            />
          </div>
          <div
            style={{
              fontSize: 10,
              color: COLOR.faint,
              marginTop: 9,
              lineHeight: 1.45,
            }}
          >
            Семнадцать пьес в шести настроениях. Каждая состоит из нескольких
            частей с разной оркестровкой и доигрывается до конца, прежде чем
            уступить место следующей.
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ НОВОСТНАЯ ПОДСИСТЕМА ============================ */
const NEWS_CATEGORIES = [
  {
    id: 'cb',
    label: 'Центральный банк',
    short: 'ЦБ',
    icon: '🏦',
    color: COLOR.blue,
  },
  {
    id: 'gov',
    label: 'Правительство',
    short: 'Правительство',
    icon: '🏛',
    color: COLOR.gold,
  },
  {
    id: 'markets',
    label: 'Рынки',
    short: 'Рынки',
    icon: '📊',
    color: COLOR.teal,
  },
  {
    id: 'business',
    label: 'Бизнес',
    short: 'Бизнес',
    icon: '🏭',
    color: '#8E7CC3',
  },
  {
    id: 'households',
    label: 'Население',
    short: 'Население',
    icon: '👥',
    color: COLOR.goldSoft,
  },
  { id: 'world', label: 'Мир', short: 'Мир', icon: '🌍', color: '#6FA8A0' },
  {
    id: 'opinion',
    label: 'Мнения',
    short: 'Мнения',
    icon: '💬',
    color: '#C08A6B',
  },
  {
    id: 'crisis',
    label: 'Кризис',
    short: 'Кризис',
    icon: '⚠️',
    color: COLOR.rust,
  },
  {
    id: 'editorial',
    label: 'Сводка',
    short: 'Сводка',
    icon: '📰',
    color: COLOR.muted,
  },
];
const CATMAP = {};
NEWS_CATEGORIES.forEach((c) => {
  CATMAP[c.id] = c;
});
const catOf = (id) => CATMAP[id] || CATMAP.markets;

function ChainTrail({ chain, compact }) {
  if (!chain || !chain.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        marginTop: 7,
      }}
    >
      {chain.map((step, i) => (
        <React.Fragment key={i}>
          <span
            style={{
              fontSize: compact ? 9.5 : 10,
              padding: '2px 6px',
              borderRadius: 2,
              background: i === 0 ? COLOR.goldDim : COLOR.panelAlt,
              border: `1px solid ${i === 0 ? COLOR.gold : COLOR.border}`,
              color: i === 0 ? COLOR.goldSoft : COLOR.muted,
              whiteSpace: 'nowrap',
            }}
          >
            {step}
          </span>
          {i < chain.length - 1 && (
            <span style={{ color: COLOR.faint, fontSize: 10 }}>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function NewsItem({ item, showQuarter }) {
  const c = catOf(item.cat);
  const [open, setOpen] = useState(false);
  const hasChain = item.chain && item.chain.length > 0;
  return (
    <div
      style={{
        borderLeft: `2px solid ${c.color}`,
        paddingLeft: 10,
        paddingBottom: 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 10.5 }}>{c.icon}</span>
        <span
          style={{
            fontSize: 9.5,
            color: c.color,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {c.short}
        </span>
        {showQuarter && item.qLabel && (
          <span
            className="ems-mono"
            style={{ fontSize: 9.5, color: COLOR.faint }}
          >
            {item.qLabel}
          </span>
        )}
        {item.storyTitle && (
          <span
            style={{
              fontSize: 9.5,
              color: COLOR.faint,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 2,
              padding: '0 4px',
            }}
          >
            сюжет «{item.storyTitle}» · {item.step}/{item.steps}
          </span>
        )}
      </div>
      <div
        className="ems-serif"
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          lineHeight: 1.25,
          margin: '3px 0 3px',
          color: COLOR.text,
          letterSpacing: '0.01em',
        }}
      >
        {item.headline}
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>
        {item.text}
      </div>
      {hasChain && (
        <>
          <button
            className="ems-btn"
            style={{ padding: '2px 7px', fontSize: 10, marginTop: 6 }}
            onClick={() => {
              Audio.play('tick');
              setOpen((o) => !o);
            }}
          >
            {open ? 'Скрыть цепочку' : 'Цепочка последствий'}{' '}
            {open ? (
              <ChevronUp size={10} style={{ verticalAlign: -1 }} />
            ) : (
              <ChevronDown size={10} style={{ verticalAlign: -1 }} />
            )}
          </button>
          {open && <ChainTrail chain={item.chain} />}
        </>
      )}
    </div>
  );
}

function NewsTerminal({ items, onOpenPaper }) {
  const [filter, setFilter] = useState('all');
  const present = NEWS_CATEGORIES.filter((c) =>
    items.some((i) => i.cat === c.id)
  );
  const list = (
    filter === 'all' ? items : items.filter((i) => i.cat === filter)
  ).slice(0, 60);
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 9,
        }}
      >
        <Newspaper size={14} color={COLOR.gold} />
        <span
          className="ems-serif"
          style={{ fontSize: 13.5, color: COLOR.goldSoft }}
        >
          Экономический терминал
        </span>
        <button
          className="ems-btn"
          style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: 10.5 }}
          onClick={() => {
            Audio.play('paper');
            onOpenPaper();
          }}
        >
          Газета и хроника
        </button>
      </div>
      {present.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            marginBottom: 10,
          }}
        >
          <span
            className={`ems-tab ${filter === 'all' ? 'active' : ''}`}
            style={{ padding: '4px 9px', fontSize: 11 }}
            onClick={() => {
              Audio.play('tab');
              setFilter('all');
            }}
          >
            Всё
          </span>
          {present.map((c) => (
            <span
              key={c.id}
              className={`ems-tab ${filter === c.id ? 'active' : ''}`}
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => {
                Audio.play('tab');
                setFilter(c.id);
              }}
            >
              {c.icon} {c.short}
            </span>
          ))}
        </div>
      )}
      <div
        className="ems-scroll"
        style={{
          maxHeight: 430,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
        }}
      >
        {list.length === 0 && (
          <div style={{ fontSize: 12, color: COLOR.muted }}>
            Лента пуста — завершите первый квартал, и экономика начнёт
            рассказывать о себе сама.
          </div>
        )}
        {list.map((n) => (
          <NewsItem key={n.id} item={n} showQuarter />
        ))}
      </div>
    </div>
  );
}

/* Газета: выпуск квартала, хроника страны и сюжетные линии */
function NewspaperModal({ news, history, quarterIndex, onClose }) {
  const [tab, setTab] = useState('issue');
  const quarters = useMemo(() => {
    const map = new Map();
    news.forEach((n) => {
      if (!map.has(n.q)) map.set(n.q, []);
      map.get(n.q).push(n);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [news]);
  const latest = quarters.length ? quarters[0] : null;
  const issueItems = latest ? latest[1] : [];
  const lead = issueItems.find((n) => n.cat !== 'editorial');
  const editorial = issueItems.find((n) => n.cat === 'editorial');
  const rest = issueItems.filter((n) => n !== lead && n !== editorial);
  const snapshot = latest ? history.find((h) => h.q === latest[0]) : null;

  const stories = useMemo(() => {
    const map = new Map();
    news
      .slice()
      .reverse()
      .forEach((n) => {
        if (!n.storyId) return;
        const key = `${n.storyId}`;
        if (!map.has(key))
          map.set(key, { id: key, title: n.storyTitle, steps: [] });
        map.get(key).steps.push(n);
      });
    return [...map.values()].reverse();
  }, [news]);

  const PaperBox = ({ children, style }) => (
    <div
      style={{
        background: COLOR.paper,
        color: COLOR.paperText,
        border: `1px solid ${COLOR.paperRule}`,
        padding: '18px 20px',
        ...style,
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,9,14,0.82)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 14px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="ems-fade-in"
        style={{ maxWidth: 940, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <PaperBox>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: `3px double ${COLOR.paperRule}`,
              paddingBottom: 10,
            }}
          >
            <div>
              <div
                className="ems-serif"
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                }}
              >
                ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ
              </div>
              <div
                className="ems-mono"
                style={{
                  fontSize: 10,
                  color: COLOR.paperMuted,
                  marginTop: 6,
                  letterSpacing: '0.08em',
                }}
              >
                ЕЖЕКВАРТАЛЬНОЕ ИЗДАНИЕ ·{' '}
                {latest ? latest[1][0].qLabel : quarterLabel(quarterIndex)} ·
                ВЫПУСК № {latest ? latest[0] : 0}
              </div>
            </div>
            <button
              className="ems-btn"
              style={{
                padding: '4px 7px',
                background: 'transparent',
                color: COLOR.paperText,
                borderColor: COLOR.paperRule,
              }}
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 14,
              borderBottom: `1px solid ${COLOR.paperRule}`,
              padding: '8px 0',
              marginBottom: 14,
            }}
          >
            {[
              ['issue', 'Выпуск'],
              ['chronicle', 'Хроника страны'],
              ['stories', 'Сюжетные линии'],
            ].map(([id, label]) => (
              <span
                key={id}
                onClick={() => {
                  Audio.play('paper');
                  setTab(id);
                }}
                style={{
                  cursor: 'pointer',
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontWeight: tab === id ? 700 : 400,
                  color: tab === id ? COLOR.paperText : COLOR.paperMuted,
                  borderBottom:
                    tab === id
                      ? `2px solid ${COLOR.paperText}`
                      : '2px solid transparent',
                  paddingBottom: 3,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {tab === 'issue' && (
            <div>
              {!lead && (
                <div
                  className="ems-serif"
                  style={{ fontSize: 13, color: COLOR.paperMuted }}
                >
                  Первый выпуск выйдет после завершения квартала.
                </div>
              )}
              {lead && (
                <div
                  style={{
                    borderBottom: `1px solid ${COLOR.paperRule}`,
                    paddingBottom: 14,
                    marginBottom: 14,
                  }}
                >
                  <div
                    className="ems-mono"
                    style={{
                      fontSize: 9.5,
                      color: COLOR.paperMuted,
                      letterSpacing: '0.1em',
                      marginBottom: 6,
                    }}
                  >
                    {catOf(lead.cat).icon} {catOf(lead.cat).label.toUpperCase()}{' '}
                    · ГЛАВНАЯ ТЕМА
                  </div>
                  <div
                    className="ems-serif"
                    style={{
                      fontSize: 25,
                      fontWeight: 700,
                      lineHeight: 1.12,
                      marginBottom: 8,
                    }}
                  >
                    {lead.headline}
                  </div>
                  <div
                    className="ems-serif"
                    style={{ fontSize: 13.5, lineHeight: 1.6 }}
                  >
                    {lead.text}
                  </div>
                  {lead.chain && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 10,
                      }}
                    >
                      {lead.chain.map((st, i) => (
                        <React.Fragment key={i}>
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: '2px 7px',
                              border: `1px solid ${COLOR.paperRule}`,
                              color: COLOR.paperText,
                            }}
                          >
                            {st}
                          </span>
                          {i < lead.chain.length - 1 && (
                            <span style={{ color: COLOR.paperMuted }}>→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {snapshot && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px 22px',
                    border: `1px solid ${COLOR.paperRule}`,
                    padding: '9px 12px',
                    marginBottom: 14,
                  }}
                >
                  {[
                    ['ВВП', fmtSignedPct(snapshot.gdpGrowth)],
                    ['Инфляция', pctFmt(snapshot.inflation)],
                    ['Безработица', pctFmt(snapshot.unemployment)],
                    ['Ставка', pctFmt(snapshot.keyRate)],
                    ['Курс', fmt1(snapshot.exchangeRate)],
                    ['Долг/ВВП', pctFmt(snapshot.debtToGdp)],
                  ].map(([k, v]) => (
                    <span
                      key={k}
                      className="ems-mono"
                      style={{ fontSize: 10.5, color: COLOR.paperMuted }}
                    >
                      {k}: <b style={{ color: COLOR.paperText }}>{v}</b>
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  columnCount: 2,
                  columnGap: 22,
                  columnRule: `1px solid ${COLOR.paperRule}`,
                }}
                className="ems-paper-cols"
              >
                {rest.map((n) => (
                  <div
                    key={n.id}
                    style={{ breakInside: 'avoid', marginBottom: 14 }}
                  >
                    <div
                      className="ems-mono"
                      style={{
                        fontSize: 9,
                        color: COLOR.paperMuted,
                        letterSpacing: '0.08em',
                      }}
                    >
                      {catOf(n.cat).icon} {catOf(n.cat).label.toUpperCase()}
                    </div>
                    <div
                      className="ems-serif"
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        margin: '3px 0 4px',
                      }}
                    >
                      {n.headline}
                    </div>
                    <div
                      className="ems-serif"
                      style={{ fontSize: 12, lineHeight: 1.55 }}
                    >
                      {n.text}
                    </div>
                    {n.storyTitle && (
                      <div
                        style={{
                          fontSize: 10,
                          color: COLOR.paperMuted,
                          marginTop: 4,
                        }}
                      >
                        Сюжет «{n.storyTitle}», часть {n.step} из {n.steps}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {editorial && (
                <div
                  style={{
                    borderTop: `3px double ${COLOR.paperRule}`,
                    marginTop: 6,
                    paddingTop: 12,
                  }}
                >
                  <div
                    className="ems-mono"
                    style={{
                      fontSize: 9.5,
                      color: COLOR.paperMuted,
                      letterSpacing: '0.1em',
                      marginBottom: 5,
                    }}
                  >
                    ОТ РЕДАКЦИИ · СВОДКА КВАРТАЛА
                  </div>
                  <div
                    className="ems-serif"
                    style={{ fontSize: 12.5, lineHeight: 1.65 }}
                  >
                    {editorial.text}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'chronicle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {quarters.length === 0 && (
                <div
                  className="ems-serif"
                  style={{ fontSize: 13, color: COLOR.paperMuted }}
                >
                  Хроника начнётся с первого завершённого квартала.
                </div>
              )}
              {quarters.map(([q, list]) => {
                const snap = history.find((h) => h.q === q);
                const top = list
                  .filter((n) => n.cat !== 'editorial')
                  .slice(0, 3);
                return (
                  <div
                    key={q}
                    style={{
                      display: 'flex',
                      gap: 14,
                      borderBottom: `1px solid ${COLOR.paperRule}`,
                      padding: '11px 0',
                    }}
                  >
                    <div style={{ width: 92, flexShrink: 0 }}>
                      <div
                        className="ems-mono ems-serif"
                        style={{ fontSize: 12, fontWeight: 700 }}
                      >
                        {list[0].qLabel}
                      </div>
                      {snap && (
                        <div
                          className="ems-mono"
                          style={{
                            fontSize: 9.5,
                            color: COLOR.paperMuted,
                            lineHeight: 1.5,
                            marginTop: 3,
                          }}
                        >
                          ВВП {fmtSigned1(snap.gdpGrowth)}%<br />
                          инфл. {fmt1(snap.inflation)}%<br />
                          безр. {fmt1(snap.unemployment)}%<br />
                          ставка {fmt1(snap.keyRate)}%
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {top.map((n) => (
                        <div key={n.id}>
                          <span style={{ fontSize: 10 }}>
                            {catOf(n.cat).icon}{' '}
                          </span>
                          <span
                            className="ems-serif"
                            style={{ fontSize: 12.5, fontWeight: 700 }}
                          >
                            {n.headline}
                          </span>
                          <div
                            className="ems-serif"
                            style={{
                              fontSize: 11.5,
                              color: COLOR.paperMuted,
                              lineHeight: 1.45,
                            }}
                          >
                            {n.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'stories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {stories.length === 0 && (
                <div
                  className="ems-serif"
                  style={{ fontSize: 13, color: COLOR.paperMuted }}
                >
                  Сюжетов пока нет. Они рождаются из шоков и ваших собственных
                  решений — и разворачиваются несколько кварталов подряд.
                </div>
              )}
              {stories.map((st) => (
                <div
                  key={st.id}
                  style={{
                    borderLeft: `2px solid ${COLOR.paperRule}`,
                    paddingLeft: 14,
                  }}
                >
                  <div
                    className="ems-serif"
                    style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}
                  >
                    Сюжет: {st.title}
                  </div>
                  <div
                    className="ems-mono"
                    style={{
                      fontSize: 9.5,
                      color: COLOR.paperMuted,
                      marginBottom: 8,
                    }}
                  >
                    {st.steps[0].qLabel} —{' '}
                    {st.steps[st.steps.length - 1].qLabel} · {st.steps.length}{' '}
                    из {st.steps[0].steps} частей
                  </div>
                  {st.steps.map((n, i) => (
                    <div
                      key={n.id}
                      style={{ display: 'flex', gap: 10, marginBottom: 9 }}
                    >
                      <div
                        style={{ width: 74, flexShrink: 0 }}
                        className="ems-mono"
                      >
                        <div style={{ fontSize: 9.5, color: COLOR.paperMuted }}>
                          {n.qLabel}
                        </div>
                        <div style={{ fontSize: 9, color: COLOR.paperMuted }}>
                          часть {i + 1}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          className="ems-serif"
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }}
                        >
                          {n.headline}
                        </div>
                        <div
                          className="ems-serif"
                          style={{
                            fontSize: 11.5,
                            color: COLOR.paperMuted,
                            lineHeight: 1.5,
                          }}
                        >
                          {n.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </PaperBox>
      </div>
    </div>
  );
}

/* ============================ АТМОСФЕРА ============================ */
const ATMOSPHERE = {
  normal: {
    tint: 'rgba(201,162,39,0.012)',
    vig: 0.16,
    accent: COLOR.gold,
    breathe: 0,
    grain: 0,
    label: 'спокойствие',
    urgent: false,
  },
  overheating: {
    tint: 'rgba(214,146,42,0.030)',
    vig: 0.2,
    accent: '#D68E2A',
    breathe: 0.1,
    grain: 0,
    label: 'перегрев',
    urgent: false,
  },
  recession: {
    tint: 'rgba(70,105,150,0.026)',
    vig: 0.24,
    accent: COLOR.blue,
    breathe: 0,
    grain: 0,
    label: 'спад',
    urgent: false,
  },
  stagflation: {
    tint: 'rgba(138,120,48,0.034)',
    vig: 0.26,
    accent: '#A8913A',
    breathe: 0.12,
    grain: 0.02,
    label: 'стагфляция',
    urgent: true,
  },
  banking: {
    tint: 'rgba(150,42,30,0.042)',
    vig: 0.3,
    accent: COLOR.rust,
    breathe: 0.2,
    grain: 0.035,
    label: 'банковский кризис',
    urgent: true,
  },
  debt: {
    tint: 'rgba(150,42,30,0.036)',
    vig: 0.28,
    accent: COLOR.rust,
    breathe: 0.16,
    grain: 0.03,
    label: 'долговой кризис',
    urgent: true,
  },
  currency: {
    tint: 'rgba(165,60,25,0.042)',
    vig: 0.3,
    accent: '#C2531F',
    breathe: 0.2,
    grain: 0.035,
    label: 'валютный кризис',
    urgent: true,
  },
  deflation: {
    tint: 'rgba(120,150,175,0.024)',
    vig: 0.22,
    accent: '#7FA3B8',
    breathe: 0,
    grain: 0,
    label: 'дефляция',
    urgent: false,
  },
};
const isCrisisRegime = (r) =>
  ['banking', 'debt', 'currency', 'stagflation'].indexOf(r) >= 0;

function Atmosphere({ regime, intensity, flashKey }) {
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const k = clamp(intensity, 0, 1);
  const vig = a.vig * (0.6 + 0.5 * k);
  return (
    <>
      {/* мягкий объём по краям вместо тяжёлой виньетки */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 3,
          transition: 'background 3.2s ease',
          background: `radial-gradient(130% 105% at 50% 45%, transparent 58%, rgba(0,0,0,${vig.toFixed(
            3
          )}) 100%), ${a.tint}`,
        }}
      />
      {a.breathe > 0 && (
        <div
          className="ems-breathe"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 4,
            '--p': (a.breathe * (0.4 + 0.7 * k)).toFixed(3),
            background: `radial-gradient(150% 120% at 50% 118%, ${a.accent}22 0%, transparent 45%)`,
          }}
        />
      )}
      {a.grain > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 4,
            opacity: a.grain * (0.5 + 0.7 * k),
            background:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 4px)',
          }}
        />
      )}
      {a.urgent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            pointerEvents: 'none',
            zIndex: 9,
            overflow: 'hidden',
            background: `${a.accent}33`,
          }}
        >
          <div
            className="ems-sweep"
            style={{
              height: '100%',
              width: '45%',
              background: `linear-gradient(90deg, transparent, ${a.accent}, transparent)`,
            }}
          />
        </div>
      )}
      {flashKey ? (
        <div
          key={flashKey}
          className="ems-flash"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            background: `radial-gradient(circle at 50% 40%, ${a.accent}55, transparent 70%)`,
          }}
        />
      ) : null}
    </>
  );
}

/* Аварийная строка: ощущение, что вы внутри события, а не читаете отчёт о нём */
function CrisisBar({ economy, botAction }) {
  const regime = economy.regime;
  if (regime === 'normal' || regime === 'deflation') return null;
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const info = REGIME_INFO[regime] || REGIME_INFO.normal;
  const metrics = [];
  if (regime === 'banking')
    metrics.push(
      ['Просрочка', pctFmt(economy.bankNPL)],
      ['Капитал банков', pctFmt(economy.bankCapitalAdequacy)],
      ['Ликвидность', Math.round(economy.bankLiquidity)]
    );
  else if (regime === 'currency')
    metrics.push(
      ['Курс', `${fmtSigned1(economy.fxDeprAnnual)}% год.`],
      ['Резервы', fmtMoney(economy.reserves)],
      ['Цены импорта', pctFmt(economy.importPriceInflation)]
    );
  else if (regime === 'debt')
    metrics.push(
      ['Долг', pctFmt(economy.debtToGdp)],
      ['Спред', `${Math.round(economy.sovereignSpread)} б.п.`],
      ['Проценты к доходам', pctFmt(economy.interestToRevenue)]
    );
  else if (regime === 'stagflation')
    metrics.push(
      ['Инфляция', pctFmt(economy.inflation)],
      ['Разрыв выпуска', fmtSignedPct(economy.outputGap)],
      ['Ожидания', pctFmt(economy.inflationExpectations)]
    );
  else if (regime === 'recession')
    metrics.push(
      ['Разрыв выпуска', fmtSignedPct(economy.outputGap)],
      ['Безработица', pctFmt(economy.unemployment)],
      ['Инвестиции', fmtSignedPct(economy.investmentGrowth)]
    );
  else
    metrics.push(
      ['Разрыв выпуска', fmtSignedPct(economy.outputGap)],
      ['Инфляция', pctFmt(economy.inflation)],
      ['Рынок труда', `${fmtSigned1(economy.tightness)} п.п.`]
    );
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 8,
        borderTop: `1px solid ${a.accent}`,
        borderBottom: `1px solid ${a.accent}`,
        background: `linear-gradient(90deg, ${a.accent}22, ${COLOR.panel} 48%)`,
        padding: '7px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className={a.urgent ? 'ems-blink' : ''}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: a.accent,
            display: 'inline-block',
          }}
        />
        <span
          className="ems-mono"
          style={{
            fontSize: 11,
            color: a.accent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {info.label}
        </span>
        <span style={{ fontSize: 11, color: COLOR.faint }}>
          {economy.regimeStreak}-й квартал
        </span>
      </span>
      {metrics.map(([l, v]) => (
        <span
          key={l}
          style={{
            fontSize: 11.5,
            display: 'flex',
            gap: 5,
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: COLOR.muted }}>{l}</span>
          <span className="ems-mono" style={{ color: COLOR.text }}>
            {v}
          </span>
        </span>
      ))}
      {botAction && botAction.demand && (
        <span
          style={{
            fontSize: 11,
            color: a.accent,
            marginLeft: 'auto',
            maxWidth: 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {botAction.demand}
        </span>
      )}
    </div>
  );
}

/* ============================ ФИНАНСОВЫЙ РЫНОК ============================ */
function Spark({ data, color, height = 30, fill }) {
  const vals = data.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return <div style={{ height }} />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const rng = max - min || 1;
  const w = 100;
  const pts = vals.map(
    (v, i) =>
      `${(i / (vals.length - 1)) * w},${
        height - ((v - min) / rng) * (height - 3) - 1.5
      }`
  );
  return (
    <svg
      className="ems-visual"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      aria-hidden="true"
    >
      {fill && (
        <polygon
          points={`0,${height} ${pts.join(' ')} ${w},${height}`}
          fill={color}
          opacity={0.12}
        />
      )}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Quote({ label, value, change, unit, color, big }) {
  const c =
    change === undefined
      ? COLOR.text
      : change > 0.001
      ? COLOR.teal
      : change < -0.001
      ? COLOR.rust
      : COLOR.muted;
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.muted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div
        className="ems-mono"
        style={{
          fontSize: big ? 21 : 14,
          color: color || COLOR.text,
          lineHeight: 1.15,
          marginTop: 1,
        }}
      >
        {value}
        {unit ? (
          <span style={{ fontSize: big ? 12 : 10, color: COLOR.faint }}>
            {unit}
          </span>
        ) : null}
      </div>
      {change !== undefined && (
        <div className="ems-mono" style={{ fontSize: 10.5, color: c }}>
          {change > 0 ? '▲' : change < 0 ? '▼' : '■'} {fmtSigned1(change)}%
        </div>
      )}
    </div>
  );
}

/* Живые котировки: между кварталами цены дышат вокруг расчётных значений */
function useLiveQuotes(economy) {
  const keys = [
    'stockIndex',
    'bondIndex',
    'sectorBanks',
    'sectorIndustry',
    'sectorConsumer',
    'sectorResources',
    'exchangeRate',
    'yield10y',
    'yield2y',
    'sovereignSpread',
    'corporateSpread',
    'marketCap',
    'corpBondIndex',
    'fxIndex',
    'goldIndex',
    'depositIndex',
  ];
  const base = {};
  keys.forEach((k) => {
    base[k] = economy[k];
  });
  const [live, setLive] = useState(base);
  React.useEffect(() => {
    const b = {};
    keys.forEach((k) => {
      b[k] = economy[k];
    });
    setLive(b);
    const vol = clamp(economy.volatilityIndex / 100, 0.05, 1);
    const id = setInterval(() => {
      setLive((prev) => {
        const next = {};
        keys.forEach((k) => {
          const target = b[k];
          const amp = target * vol * 0.0045;
          const pull = (target - (prev[k] || target)) * 0.18;
          next[k] =
            (prev[k] || target) + pull + (Math.random() - 0.5) * amp * 2;
        });
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [economy]);
  return live;
}

function MarketScreen({ economy, prev, history, book, onTrade }) {
  const live = useLiveQuotes(economy);
  const hist = history.slice(-28);
  const ser = (k) => hist.map((h) => h[k]);
  const chg = (k) => (prev && prev[k] ? (economy[k] / prev[k] - 1) * 100 : 0);
  const Panel = ({ title, icon: Icon, children, accent }) => (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 10,
        }}
      >
        {Icon && <Icon size={13} color={accent || COLOR.goldSoft} />}
        <span
          className="ems-serif"
          style={{ fontSize: 13, color: accent || COLOR.goldSoft }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
  const tickerItems = [
    ['ИНДЕКС', live.stockIndex, chg('stockIndex'), 0],
    ['БАНКИ', live.sectorBanks, chg('sectorBanks'), 0],
    ['ПРОМ', live.sectorIndustry, chg('sectorIndustry'), 0],
    ['ПОТРЕБ', live.sectorConsumer, chg('sectorConsumer'), 0],
    ['СЫРЬЁ', live.sectorResources, chg('sectorResources'), 0],
    ['ОБЛИГ', live.bondIndex, chg('bondIndex'), 0],
    [
      '10Y',
      live.yield10y,
      ((economy.yield10y - (prev ? prev.yield10y : economy.yield10y)) * 100) /
        100,
      2,
    ],
    ['2Y', live.yield2y, 0, 2],
    ['КУРС', live.exchangeRate, chg('exchangeRate'), 1],
    ['СПРЕД', live.sovereignSpread, 0, 0],
  ];
  const curve = [
    ['3м', economy.yield3m],
    ['1г', economy.yield1y],
    ['2г', economy.yield2y],
    ['5л', economy.yield5y],
    ['10л', economy.yield10y],
  ];
  const curvePrev = prev
    ? [prev.yield3m, prev.yield1y, prev.yield2y, prev.yield5y, prev.yield10y]
    : null;
  const yMin =
    Math.min(...curve.map((c) => c[1]), ...(curvePrev || [99])) - 0.6;
  const yMax = Math.max(...curve.map((c) => c[1]), ...(curvePrev || [0])) + 0.6;
  const cx = (i) => 8 + i * (184 / (curve.length - 1));
  const cy = (v) => 76 - ((v - yMin) / Math.max(0.5, yMax - yMin)) * 62;

  return (
    <div style={{ padding: '0 18px 18px' }}>
      {/* бегущая строка */}
      <div
        className="ems-panel"
        style={{ padding: '7px 12px', marginBottom: 12, overflow: 'hidden' }}
      >
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            className="ems-mono"
            style={{ fontSize: 10, color: COLOR.gold, letterSpacing: '0.1em' }}
          >
            ТОРГИ
          </span>
          {tickerItems.map(([label, val, ch, dec]) => (
            <span
              key={label}
              className="ems-mono"
              style={{
                fontSize: 11.5,
                display: 'flex',
                gap: 6,
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: COLOR.faint }}>{label}</span>
              <span style={{ color: COLOR.text }}>
                {Number.isFinite(val) ? val.toFixed(dec) : '—'}
              </span>
              <span
                style={{
                  color:
                    ch > 0.01
                      ? COLOR.teal
                      : ch < -0.01
                      ? COLOR.rust
                      : COLOR.faint,
                  fontSize: 10,
                }}
              >
                {ch > 0.01 ? '▲' : ch < -0.01 ? '▼' : '·'}
                {Math.abs(ch) > 0.01 ? `${Math.abs(ch).toFixed(1)}%` : ''}
              </span>
            </span>
          ))}
        </div>
      </div>

      {book && (
        <div style={{ marginBottom: 12 }}>
          <TradingTerminal
            economy={economy}
            prev={prev}
            live={live}
            history={history}
            book={book}
            onTrade={(id, amt, side) => onTrade(id, amt, side, live)}
          />
        </div>
      )}

      <div className="ems-market-grid">
        <Panel title="Фондовый рынок" icon={TrendingUp}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            <Quote
              label="Сводный индекс"
              value={
                Number.isFinite(live.stockIndex)
                  ? live.stockIndex.toFixed(1)
                  : '—'
              }
              change={chg('stockIndex')}
              big
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, color: COLOR.muted }}>
                Капитализация
              </div>
              <div className="ems-mono" style={{ fontSize: 14 }}>
                {fmtMoney(economy.marketCap)}
              </div>
              <div
                className="ems-mono"
                style={{ fontSize: 10.5, color: COLOR.faint }}
              >
                {fmt1(economy.marketCapPctGdp)}% ВВП
              </div>
            </div>
          </div>
          <div style={{ margin: '9px 0 4px' }}>
            <Spark
              data={ser('stockIndex')}
              color={COLOR.gold}
              height={46}
              fill
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '7px 12px',
              marginTop: 8,
            }}
          >
            {[
              ['Банки', 'sectorBanks', COLOR.blue],
              ['Промышленность', 'sectorIndustry', COLOR.teal],
              ['Потребительский', 'sectorConsumer', COLOR.goldSoft],
              ['Сырьевой', 'sectorResources', '#8E7CC3'],
            ].map(([label, key, col]) => (
              <div key={key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                  }}
                >
                  <span style={{ color: COLOR.muted }}>{label}</span>
                  <span
                    className="ems-mono"
                    style={{ color: chg(key) >= 0 ? COLOR.teal : COLOR.rust }}
                  >
                    {fmtSigned1(chg(key))}%
                  </span>
                </div>
                <Spark data={ser(key)} color={col} height={22} />
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 9,
              fontSize: 10.5,
              color: COLOR.muted,
              flexWrap: 'wrap',
            }}
          >
            <span>
              P/E{' '}
              <b className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.stockPE)}
              </b>
            </span>
            <span>
              справедливый{' '}
              <b className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.fairPE)}
              </b>
            </span>
            <span>
              премия за риск акций{' '}
              <b className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.equityRiskPremium)}%
              </b>
            </span>
          </div>
        </Panel>

        <Panel
          title="Кривая доходности"
          icon={Activity}
          accent={economy.curveInverted ? COLOR.rust : COLOR.goldSoft}
        >
          <svg viewBox="0 0 200 90" style={{ width: '100%', height: 108 }}>
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1={8}
                y1={14 + i * 20}
                x2={192}
                y2={14 + i * 20}
                stroke={COLOR.hairline}
                strokeWidth={0.6}
              />
            ))}
            {curvePrev && (
              <polyline
                points={curvePrev.map((v, i) => `${cx(i)},${cy(v)}`).join(' ')}
                fill="none"
                stroke={COLOR.faint}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
            <polyline
              points={curve.map((c, i) => `${cx(i)},${cy(c[1])}`).join(' ')}
              fill="none"
              stroke={economy.curveInverted ? COLOR.rust : COLOR.gold}
              strokeWidth={1.8}
            />
            {curve.map((c, i) => (
              <g key={c[0]}>
                <circle
                  cx={cx(i)}
                  cy={cy(c[1])}
                  r={2.2}
                  fill={economy.curveInverted ? COLOR.rust : COLOR.gold}
                />
                <text
                  x={cx(i)}
                  y={88}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={COLOR.faint}
                >
                  {c[0]}
                </text>
                <text
                  x={cx(i)}
                  y={cy(c[1]) - 6}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill={COLOR.muted}
                >
                  {fmt1(c[1])}
                </text>
              </g>
            ))}
          </svg>
          <div
            style={{
              fontSize: 11,
              color: economy.curveInverted ? COLOR.rust : COLOR.muted,
              lineHeight: 1.45,
              marginTop: 4,
            }}
          >
            {economy.curveInverted
              ? `Кривая инвертирована на ${fmt1(
                  -economy.curveSlope
                )} п.п. Рынок закладывает, что нынешняя жёсткость сломает спрос и ставку придётся снижать — исторически это сигнал рецессии.`
              : `Наклон ${fmtSigned1(
                  economy.curveSlope
                )} п.п. Длинные ставки выше коротких: рынок не ждёт скорого разворота политики.`}
          </div>
        </Panel>

        <Panel title="Облигации и риск-премии" icon={Landmark}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
            }}
          >
            <Quote
              label="Индекс облигаций"
              value={
                Number.isFinite(live.bondIndex)
                  ? live.bondIndex.toFixed(1)
                  : '—'
              }
              change={chg('bondIndex')}
            />
            <Quote
              label="Доходность 10 лет"
              value={fmt2(economy.yield10y)}
              unit="%"
            />
            <Quote
              label="Ставка нового долга"
              value={fmt2(economy.effectiveDebtRate)}
              unit="%"
            />
          </div>
          <div style={{ margin: '9px 0' }}>
            <Spark
              data={ser('bondIndex')}
              color={COLOR.blue}
              height={34}
              fill
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['Суверенный спред', economy.sovereignSpread, 800],
              ['Корпоративный спред', economy.corporateSpread, 1200],
              ['Премия за риск страны', economy.riskPremium * 100, 900],
            ].map(([label, v, max]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: COLOR.muted, width: 132 }}>{label}</span>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    background: COLOR.border,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${clamp((v / max) * 100, 0, 100)}%`,
                      background:
                        v > max * 0.5
                          ? COLOR.rust
                          : v > max * 0.25
                          ? COLOR.gold
                          : COLOR.teal,
                    }}
                  />
                </span>
                <span
                  className="ems-mono"
                  style={{ width: 54, textAlign: 'right' }}
                >
                  {Math.round(v)} б.п.
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Банковский сектор"
          icon={ShieldAlert}
          accent={economy.bankingRisk > 60 ? COLOR.rust : COLOR.goldSoft}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Quote
              label="Индекс банков"
              value={
                Number.isFinite(live.sectorBanks)
                  ? live.sectorBanks.toFixed(0)
                  : '—'
              }
              change={chg('sectorBanks')}
            />
            <Quote label="Цена к капиталу" value={fmt2(economy.bankPB)} />
            <Quote
              label="Рентабельность"
              value={fmt1(economy.bankROE)}
              unit="%"
              color={economy.bankROE < 0 ? COLOR.rust : COLOR.text}
            />
          </div>
          <Spark data={ser('sectorBanks')} color={COLOR.blue} height={28} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '5px 14px',
              marginTop: 9,
              fontSize: 11,
            }}
          >
            {[
              ['Процентная маржа', `${fmt2(economy.netInterestMargin)} п.п.`],
              ['Просрочка', pctFmt(economy.bankNPL)],
              ['Достаточность капитала', pctFmt(economy.bankCapitalAdequacy)],
              ['Норматив', pctFmt(economy.capitalRequirement)],
              ['Кредитный портфель', fmtMoney(economy.creditVolume)],
              ['Рост кредита', fmtSignedPct(economy.creditGrowth)],
            ].map(([a, b]) => (
              <div
                key={a}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span style={{ color: COLOR.muted }}>{a}</span>
                <span className="ems-mono">{b}</span>
              </div>
            ))}
          </div>
          {economy.creditCrunch && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: COLOR.rust,
                lineHeight: 1.4,
              }}
            >
              Капитал упёрся в норматив: банки физически не могут выдавать новые
              кредиты, сколько бы ни стоили деньги.
            </div>
          )}
        </Panel>

        <Panel title="Валютный рынок" icon={Globe2}>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <Quote
              label="Курс (выше — слабее)"
              value={
                Number.isFinite(live.exchangeRate)
                  ? live.exchangeRate.toFixed(2)
                  : '—'
              }
              change={chg('exchangeRate')}
              big
            />
            <Quote
              label="Реальный курс"
              value={fmt1(economy.realExchangeRate)}
            />
          </div>
          <div style={{ margin: '9px 0' }}>
            <Spark
              data={ser('exchangeRate')}
              color={COLOR.rust}
              height={32}
              fill
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '5px 14px',
              fontSize: 11,
            }}
          >
            {[
              [
                'Режим',
                economy.fxRegime === 'free'
                  ? 'плавающий'
                  : economy.fxRegime === 'managed'
                  ? 'управляемый'
                  : 'фиксированный',
              ],
              [
                'Ориентир',
                economy.fxRegime === 'free' ? '—' : fmt1(economy.fxTarget),
              ],
              ['Резервы', fmtMoney(economy.reserves)],
              ['Интервенции', fmtMoneySigned(economy.defenseIntervention || 0)],
              ['Волатильность', fmt1(economy.fxVolatility)],
              ['Текущий счёт', fmtMoneySigned(economy.currentAccount)],
            ].map(([a, b]) => (
              <div
                key={a}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span style={{ color: COLOR.muted }}>{a}</span>
                <span className="ems-mono">{b}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Настроение рынка"
          icon={Zap}
          accent={economy.volatilityIndex > 45 ? COLOR.rust : COLOR.goldSoft}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Gauge
              value={clamp(100 - economy.volatilityIndex, 0, 100)}
              size={86}
            />
            <div style={{ flex: 1 }}>
              <Quote
                label="Индекс страха"
                value={fmt1(economy.volatilityIndex)}
                color={
                  economy.volatilityIndex > 45
                    ? COLOR.rust
                    : economy.volatilityIndex > 28
                    ? COLOR.gold
                    : COLOR.teal
                }
                big
              />
              <div
                style={{
                  fontSize: 11,
                  color: COLOR.muted,
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                {economy.volatilityIndex > 55
                  ? 'Рынок в панике: цены двигаются быстрее, чем поступают новости.'
                  : economy.volatilityIndex > 32
                  ? 'Нервозность повышена — инвесторы требуют премию за неопределённость.'
                  : 'Рынок спокоен, премии за риск сжаты. Именно в такие периоды копятся дисбалансы.'}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '5px 14px',
              marginTop: 10,
              fontSize: 11,
            }}
          >
            {[
              ['Ставка дисконтирования', `${fmt1(economy.discountRate)}%`],
              ['Премия за риск акций', `${fmt1(economy.equityRiskPremium)}%`],
              ['Прибыль корпораций', fmtMoney(economy.earnings)],
              ['Доходность облигаций 2 года', `${fmt2(economy.yield2y)}%`],
            ].map(([a, b]) => (
              <div
                key={a}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span style={{ color: COLOR.muted }}>{a}</span>
                <span className="ems-mono">{b}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================ НОВЫЕ КОМПОНЕНТЫ ============================ */
const SCORE_DEFS = [
  {
    id: 'scoreStability',
    label: 'Макростабильность',
    short: 'Стабильность',
    color: COLOR.gold,
    hint: 'Инфляция у цели, заякоренные ожидания, закрытый разрыв выпуска.',
  },
  {
    id: 'scoreWelfare',
    label: 'Благосостояние населения',
    short: 'Люди',
    color: COLOR.teal,
    hint: 'Реальные доходы, занятость, уверенность, человеческий капитал.',
  },
  {
    id: 'scoreFinancial',
    label: 'Финансовая устойчивость',
    short: 'Финансы',
    color: COLOR.blue,
    hint: 'Капитал банков, просрочка, кредитный разрыв, резервы.',
  },
  {
    id: 'scoreFiscal',
    label: 'Бюджетная устойчивость',
    short: 'Бюджет',
    color: COLOR.rust,
    hint: 'Долг, дефицит, стоимость обслуживания, собираемость налогов.',
  },
  {
    id: 'scorePotential',
    label: 'Долгосрочный потенциал',
    short: 'Потенциал',
    color: '#8E7CC3',
    hint: 'Производительность, образование, инфраструктура, капитал.',
  },
];

function ScoreRadar({ economy, prev, size = 190 }) {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = size / 2 - 34;
  const n = SCORE_DEFS.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (getter) =>
    SCORE_DEFS.map((d, i) =>
      pt(i, (R * clamp(getter(d.id), 0, 100)) / 100).join(',')
    ).join(' ');
  const grid = [25, 50, 75, 100].map((g) =>
    SCORE_DEFS.map((d, i) => pt(i, (R * g) / 100).join(',')).join(' ')
  );
  return (
    <svg
      className="ems-visual"
      width="100%"
      viewBox={`0 0 ${size} ${size + 12}`}
      style={{ maxWidth: size }}
      aria-hidden="true"
    >
      {grid.map((g, i) => (
        <polygon
          key={i}
          points={g}
          fill="none"
          stroke={COLOR.hairline}
          strokeWidth={1}
        />
      ))}
      {SCORE_DEFS.map((dd, i) => {
        const [x, y] = pt(i, R);
        return (
          <line
            key={dd.id}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={COLOR.hairline}
            strokeWidth={1}
          />
        );
      })}
      {prev && (
        <polygon
          points={poly((id) => prev[id])}
          fill="none"
          stroke={COLOR.faint}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <polygon
        points={poly((id) => economy[id])}
        fill="rgba(201,162,39,0.16)"
        stroke={COLOR.gold}
        strokeWidth={1.7}
      />
      {SCORE_DEFS.map((dd, i) => {
        const [x, y] = pt(i, R + 17);
        return (
          <g key={dd.id}>
            <text
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={8.5}
              fill={COLOR.muted}
            >
              {dd.short}
            </text>
            <text
              x={x}
              y={y + 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={dd.color}
            >
              {Math.round(economy[dd.id])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScorePanel({ economy, prev, goalDef }) {
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div
        className="ems-serif"
        style={{
          fontSize: 14,
          color: COLOR.goldSoft,
          marginBottom: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Target size={14} />
        Пять оценок вашей политики
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.faint,
          marginBottom: 8,
          lineHeight: 1.45,
        }}
      >
        Максимизировать все пять одновременно невозможно: каждая политика что-то
        отнимает у остальных.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ScoreRadar economy={economy} prev={prev} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          marginTop: 6,
        }}
      >
        {SCORE_DEFS.map((dd) => {
          const v = clamp(economy[dd.id] || 0, 0, 100);
          const delta = (economy[dd.id] || 0) - (prev ? prev[dd.id] || 0 : 0);
          const isGoal =
            goalDef &&
            goalDef.score &&
            `score${goalDef.score.charAt(0).toUpperCase()}${goalDef.score.slice(
              1
            )}` === dd.id;
          return (
            <div
              key={dd.id}
              title={dd.hint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11,
              }}
            >
              <span
                style={{
                  color: isGoal ? COLOR.goldSoft : COLOR.muted,
                  width: 92,
                  fontWeight: isGoal ? 600 : 400,
                }}
              >
                {dd.short}
                {isGoal ? ' ★' : ''}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: COLOR.border,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${v}%`,
                    height: '100%',
                    background: dd.color,
                  }}
                />
              </span>
              <span
                className="ems-mono"
                style={{
                  width: 22,
                  textAlign: 'right',
                  color: dd.color,
                  fontWeight: 600,
                }}
              >
                {Math.round(v)}
              </span>
              <DeltaTag value={delta} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegimeBanner({ economy }) {
  const info = REGIME_INFO[economy.regime] || REGIME_INFO.normal;
  const c =
    info.color === 'teal'
      ? COLOR.teal
      : info.color === 'gold'
      ? COLOR.gold
      : info.color === 'blue'
      ? COLOR.blue
      : COLOR.rust;
  const dim =
    info.color === 'teal'
      ? COLOR.tealDim
      : info.color === 'gold'
      ? COLOR.goldDim
      : info.color === 'blue'
      ? COLOR.blueDim
      : COLOR.rustDim;
  return (
    <div
      className="ems-fade-in"
      style={{
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
        background: dim,
        border: `1px solid ${c}`,
        borderRadius: 3,
        padding: '9px 12px',
        fontSize: 12,
      }}
    >
      <Activity size={15} color={c} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <b style={{ color: c }}>Режим экономики: {info.label}.</b>{' '}
        <span style={{ color: COLOR.muted }}>{info.text}</span>
      </div>
    </div>
  );
}

function StanceBar({ value, leftLabel, rightLabel }) {
  const v = clamp(value, -1, 1);
  const pos = ((v + 1) / 2) * 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          position: 'relative',
          height: 5,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${COLOR.teal} 0%, ${COLOR.border} 50%, ${COLOR.rust} 100%)`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: `calc(${pos}% - 4px)`,
            top: -2.5,
            width: 8,
            height: 10,
            borderRadius: 2,
            background: COLOR.text,
            border: `1px solid ${COLOR.bg}`,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          color: COLOR.faint,
          marginTop: 3,
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/* Панель ведомства, которым управляет бот */
function BotPanel({ botRole, persona, lastAction, economy, coordination }) {
  if (!botRole) return null;
  const isCb = botRole === 'central_bank';
  const Icon = isCb ? Landmark : Coins;
  return (
    <div
      className="ems-panel"
      style={{ padding: 13, borderColor: COLOR.borderStrong }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 3,
        }}
      >
        <Bot size={14} color={COLOR.blue} />
        <span
          className="ems-serif"
          style={{ fontSize: 13.5, color: COLOR.blue }}
        >
          {isCb ? 'Центральный банк' : 'Министерство финансов'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>
          бот
        </span>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{persona.name}</b> · {persona.title}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 14px',
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {isCb ? (
          <>
            <span style={{ color: COLOR.muted }}>
              Ставка:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmt2(economy.keyRate)}%
              </span>
            </span>
            <span style={{ color: COLOR.muted }}>
              Норматив капитала:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.capitalRequirement)}%
              </span>
            </span>
            <span style={{ color: COLOR.muted }}>
              Реальная ставка − r*:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmtSigned1(economy.policyStance)}
              </span>
            </span>
          </>
        ) : (
          <>
            <span style={{ color: COLOR.muted }}>
              Баланс бюджета:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmtSigned1(economy.budgetBalancePctGdp)}% ВВП
              </span>
            </span>
            <span style={{ color: COLOR.muted }}>
              Долг:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.debtToGdp)}%
              </span>
            </span>
            <span style={{ color: COLOR.muted }}>
              НДС:{' '}
              <span className="ems-mono" style={{ color: COLOR.text }}>
                {fmt1(economy.vatRate)}%
              </span>
            </span>
          </>
        )}
      </div>
      <StanceBar
        value={lastAction ? lastAction.stance : 0}
        leftLabel={isCb ? 'мягкая политика' : 'консолидация'}
        rightLabel={isCb ? 'жёсткая политика' : 'стимулирование'}
      />
      {lastAction && (
        <div
          style={{
            marginTop: 9,
            fontSize: 11.5,
            lineHeight: 1.45,
            borderLeft: `2px solid ${COLOR.blue}`,
            paddingLeft: 9,
            color: COLOR.text,
          }}
        >
          {lastAction.note}
        </div>
      )}
      {lastAction && lastAction.demand && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            lineHeight: 1.45,
            borderLeft: `2px solid ${COLOR.rust}`,
            paddingLeft: 9,
            color: COLOR.muted,
          }}
        >
          <span style={{ color: COLOR.rust, fontWeight: 600 }}>
            Требование:{' '}
          </span>
          {lastAction.demand}
        </div>
      )}
      <div
        style={{
          marginTop: 9,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 10.5,
          color: COLOR.muted,
        }}
      >
        <span>Согласованность политики</span>
        <span
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: COLOR.border,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${clamp(coordination, 0, 100)}%`,
              height: '100%',
              background:
                coordination > 60
                  ? COLOR.teal
                  : coordination > 35
                  ? COLOR.gold
                  : COLOR.rust,
            }}
          />
        </span>
        <span className="ems-mono">{Math.round(coordination)}</span>
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, label, hint }) {
  const cur = options.find((o) => o.id === value);
  return (
    <div
      style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}
    >
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => (
          <button
            key={o.id}
            className="ems-btn"
            onClick={() => {
              Audio.play('click');
              onChange(o.id);
            }}
            style={{
              flex: 1,
              padding: '5px 6px',
              fontSize: 11,
              background: value === o.id ? COLOR.gold : COLOR.panelAlt,
              color: value === o.id ? COLOR.ink : COLOR.text,
              borderColor: value === o.id ? COLOR.gold : COLOR.border,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.faint,
          marginTop: 5,
          lineHeight: 1.4,
        }}
      >
        {cur ? cur.hint : hint}
      </div>
    </div>
  );
}

/* ============================ СОХРАНЕНИЯ ============================ */
const SAVE_VERSION = 3;
function makeSnapshot(state) {
  // в истории не храним разложение налоговой базы — оно пересчитывается и раздувает файл
  const slim = (state.history || []).map((h) => {
    const { revenueParts, ...rest } = h;
    return rest;
  });
  return {
    app: 'economic-panel',
    v: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
    history: slim,
  };
}
function serializeSave(snap) {
  return JSON.stringify(snap);
}
function parseSave(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'economic-panel')
    throw new Error('Это не файл сохранения «Экономической панели».');
  if (!data.setup || !data.economy || !Array.isArray(data.history))
    throw new Error('Файл повреждён: не хватает состояния экономики.');
  if (data.v > SAVE_VERSION)
    throw new Error('Сохранение сделано в более новой версии симулятора.');
  return data;
}

function SaveLoadModal({ mode, snapshot, onClose, onLoad }) {
  const [tab, setTab] = useState(mode || 'save');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const payload = useMemo(
    () => (snapshot ? serializeSave(snapshot) : ''),
    [snapshot]
  );
  const sizeKb = (payload.length / 1024).toFixed(1);

  const download = () => {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const q =
        snapshot && snapshot.quarterIndex ? snapshot.quarterIndex - 1 : 0;
      a.href = url;
      a.download = `economic-panel-q${q}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        'Скачивание недоступно в этом окружении — скопируйте текст вручную.'
      );
    }
  };
  const copy = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(payload);
      else {
        const ta = document.createElement('textarea');
        ta.value = payload;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setError(
        'Не удалось скопировать автоматически — выделите текст вручную.'
      );
    }
  };
  const readFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setText(String(r.result || ''));
    r.readAsText(f);
  };
  const doLoad = () => {
    try {
      const data = parseSave(text);
      setError('');
      onLoad(data);
    } catch (err) {
      setError(err.message || 'Не удалось прочитать сохранение.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,9,14,0.8)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="ems-panel-raised ems-fade-in"
        style={{ maxWidth: 660, width: '100%', padding: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <Save size={15} color={COLOR.gold} />
          <span
            className="ems-serif"
            style={{ fontSize: 16, color: COLOR.goldSoft }}
          >
            Сохранения
          </span>
          <button
            className="ems-btn"
            style={{ marginLeft: 'auto', padding: '4px 7px' }}
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[
            ['save', 'Сохранить'],
            ['load', 'Загрузить'],
          ].map(([id, label]) => (
            <span
              key={id}
              className={`ems-tab ${tab === id ? 'active' : ''}`}
              onClick={() => {
                Audio.play('tab');
                setTab(id);
                setError('');
              }}
            >
              {label}
            </span>
          ))}
        </div>
        {tab === 'save' ? (
          <>
            <div
              style={{
                fontSize: 11.5,
                color: COLOR.muted,
                marginBottom: 9,
                lineHeight: 1.5,
              }}
            >
              Весь ход партии — экономика, история, лента новостей и сюжеты —
              умещается в один текстовый файл ({sizeKb} КБ). Скачайте его или
              скопируйте текст: вставив его во вкладке «Загрузить», вы вернётесь
              ровно в этот момент.
            </div>
            <textarea
              readOnly
              value={payload}
              className="ems-mono ems-scroll"
              style={{
                width: '100%',
                height: 190,
                background: COLOR.bg,
                color: COLOR.muted,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 3,
                fontSize: 9.5,
                padding: 9,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button
                className="ems-btn primary"
                style={{ flex: 1, padding: '9px 0' }}
                onClick={() => {
                  Audio.play('stamp');
                  download();
                }}
              >
                <Download
                  size={13}
                  style={{ verticalAlign: -2, marginRight: 6 }}
                />
                Скачать файл
              </button>
              <button
                className="ems-btn"
                style={{ flex: 1, padding: '9px 0' }}
                onClick={() => {
                  Audio.play('click');
                  copy();
                }}
              >
                {copied ? (
                  <Check
                    size={13}
                    style={{ verticalAlign: -2, marginRight: 6 }}
                  />
                ) : (
                  <Copy
                    size={13}
                    style={{ verticalAlign: -2, marginRight: 6 }}
                  />
                )}
                {copied ? 'Скопировано' : 'Скопировать текст'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 11.5,
                color: COLOR.muted,
                marginBottom: 9,
                lineHeight: 1.5,
              }}
            >
              Вставьте текст сохранения или выберите файл. Текущая партия будет
              заменена — сохраните её заранее, если она вам ещё нужна.
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте сюда содержимое файла сохранения…"
              className="ems-mono ems-scroll"
              style={{
                width: '100%',
                height: 170,
                background: COLOR.bg,
                color: COLOR.text,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 3,
                fontSize: 9.5,
                padding: 9,
                resize: 'vertical',
              }}
            />
            {error && (
              <div style={{ fontSize: 11.5, color: COLOR.rust, marginTop: 8 }}>
                {error}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 7,
                marginTop: 10,
                alignItems: 'center',
              }}
            >
              <label
                className="ems-btn"
                style={{
                  flex: 1,
                  padding: '9px 0',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <Upload
                  size={13}
                  style={{ verticalAlign: -2, marginRight: 6 }}
                />
                Выбрать файл
                <input
                  type="file"
                  accept="application/json,.json,text/plain"
                  style={{ display: 'none' }}
                  onChange={readFile}
                />
              </label>
              <button
                className="ems-btn primary"
                style={{ flex: 1, padding: '9px 0' }}
                disabled={!text.trim()}
                onClick={() => {
                  Audio.play('stamp');
                  doLoad();
                }}
              >
                Загрузить партию
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* Бюджетная арифметика: почему баланс такой, какой он есть */
function FiscalMath({ economy, decisions }) {
  const growth = (v) => `${fmtSigned1(v)}%`;
  const rows = [
    [
      'Доходы бюджета',
      fmtMoney(economy.govRevenue),
      `${fmt1(economy.revenuePctGdp)}% ВВП`,
    ],
    [
      'Расходы всего',
      fmtMoney(economy.govSpendingTotal),
      `${fmt1((economy.govSpendingTotal / economy.nominalGdp) * 100)}% ВВП`,
    ],
    [
      '· госзакупки',
      fmtMoney(economy.govPurchasesNominal),
      growth(economy.govPurchasesGrowth),
    ],
    [
      '· выплаты',
      fmtMoney(economy.transfersNominal),
      growth(economy.transfersGrowth),
    ],
    [
      '· инвестиции',
      fmtMoney(economy.govInvestmentNominal),
      growth(economy.govInvestmentGrowth),
    ],
    [
      '· обслуживание долга',
      fmtMoney(economy.interestPayment),
      `ставка ${fmt1(economy.effectiveDebtRate)}%`,
    ],
  ];
  const bal = economy.budgetBalancePctGdp;
  const limit = economy.maxDeficitPct;
  const plan =
    decisions.govSpending * 0.62 +
    decisions.transfers * 0.27 +
    decisions.govInvestment * 0.11;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div
        className="ems-serif"
        style={{
          fontSize: 13,
          color: COLOR.goldSoft,
          marginBottom: 7,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Scale size={13} />
        Бюджетная арифметика
      </div>
      {rows.map(([a, b, c]) => (
        <div
          key={a}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11.5,
            padding: '3px 0',
            color: a.startsWith('·') ? COLOR.muted : COLOR.text,
          }}
        >
          <span>{a}</span>
          <span style={{ display: 'flex', gap: 9 }}>
            <span className="ems-mono">{b}</span>
            <span
              className="ems-mono"
              style={{ color: COLOR.faint, width: 68, textAlign: 'right' }}
            >
              {c}
            </span>
          </span>
        </div>
      ))}
      <div
        style={{
          borderTop: `1px solid ${COLOR.hairline}`,
          marginTop: 6,
          paddingTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
        }}
      >
        <span>Баланс</span>
        <span
          className="ems-mono"
          style={{ color: bal >= 0 ? COLOR.teal : COLOR.rust, fontWeight: 600 }}
        >
          {fmtSigned1(bal)}% ВВП
        </span>
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.faint,
          marginTop: 7,
          lineHeight: 1.45,
        }}
      >
        Рычаги задают{' '}
        <b style={{ color: COLOR.muted }}>реальный рост сверх тренда</b>: ноль
        означает, что расходы растут вместе с экономикой, а не заморожены. Ваш
        текущий набор решений — {growth(plan)} к тренду.
        {Number.isFinite(limit) && (
          <>
            {' '}
            Рынок готов финансировать дефицит до {fmt1(limit)}% ВВП; сверх этого
            начинается секвестр.
          </>
        )}
        {economy.sequesterFactor < 0.995 && (
          <span style={{ color: COLOR.rust }}>
            {' '}
            Сейчас расходы принудительно урезаны на{' '}
            {fmt1((1 - economy.sequesterFactor) * 100)}%.
          </span>
        )}
      </div>
    </div>
  );
}

/* Сводка по ведомству, которым управляет бот */
const SUMMARY_TABS = {
  central_bank: {
    id: 'summary',
    label: 'Сводка ЦБ',
    icon: Landmark,
    rows: [
      { key: 'keyRate', label: 'Ключевая ставка', fmt: pctFmt },
      { key: 'inflationTarget', label: 'Цель ЦБ по инфляции', fmt: pctFmt },
      { key: 'inflation', label: 'Инфляция', fmt: pctFmt },
      { key: 'inflationExpectations', label: 'Ожидания', fmt: pctFmt },
      { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: (v) => v.toFixed(0) },
      { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
      { key: 'rStar', label: 'Нейтральная ставка r*', fmt: pctFmt },
      {
        key: 'rateGap',
        label: 'Жёсткость условий',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
      {
        key: 'capitalRequirement',
        label: 'Норматив капитала банков',
        fmt: pctFmt,
      },
      { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
      {
        key: 'bankCapitalAdequacy',
        label: 'Достаточность капитала',
        fmt: pctFmt,
      },
      { key: 'reserves', label: 'Резервы', fmt: fmtMoney },
      {
        label: 'Режим курса',
        get: (e) => e.fxRegime,
        text: true,
        map: {
          free: 'плавающий',
          managed: 'управляемый',
          peg: 'фиксированный',
        },
      },
    ],
  },
  ministry_finance: {
    id: 'summary',
    label: 'Сводка Минфина',
    icon: Coins,
    rows: [
      { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
      { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
      {
        key: 'budgetBalancePctGdp',
        label: 'Баланс бюджета',
        fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      },
      {
        key: 'structuralBalancePctGdp',
        label: 'Структурный баланс',
        fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      },
      { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
      { key: 'interestToRevenue', label: 'Проценты к доходам', fmt: pctFmt },
      {
        key: 'fiscalImpulse',
        label: 'Бюджетный импульс',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
      { key: 'vatRate', label: 'НДС', fmt: pctFmt },
      { key: 'incomeTaxRate', label: 'Подоходный налог', fmt: pctFmt },
      { key: 'profitTaxRate', label: 'Налог на прибыль', fmt: pctFmt },
      { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt },
      {
        label: 'Доля образования',
        get: (e) => e.budgetShares.education,
        fmt: pctFmt,
      },
      { label: 'Доля науки', get: (e) => e.budgetShares.science, fmt: pctFmt },
      {
        label: 'Доля здравоохранения',
        get: (e) => e.budgetShares.health,
        fmt: pctFmt,
      },
    ],
  },
};

/* Рычаги в миллиардах масштабируются вместе с экономикой, курсовой ориентир — вокруг текущего курса */
function scaleLever(l, e) {
  if (l.scale === 'gdp') {
    const k = Math.max(1, e.nominalGdp / CONFIG.initial.gdp);
    const mag = Math.max(5, Math.round((l.max * k) / 5) * 5);
    return {
      ...l,
      min: -mag,
      max: mag,
      step: Math.max(1, Math.round(mag / 25)),
    };
  }
  if (l.id === 'fxTarget') {
    const cur = e.exchangeRate;
    return {
      ...l,
      min: Math.round(cur * 0.6),
      max: Math.round(cur * 1.6),
      step: 0.5,
    };
  }
  return l;
}

/* ============================ ТОРГОВЫЙ ТЕРМИНАЛ ============================ */
const INSTRUMENTS = [
  {
    id: 'eq_broad',
    name: 'Индекс акций',
    ticker: 'IDX',
    group: 'Акции',
    color: COLOR.gold,
    key: 'stockIndex',
    fee: 0.0015,
    note: 'Весь рынок целиком. Растёт на дешёвых деньгах и прибылях, падает на ставке и риске.',
  },
  {
    id: 'eq_banks',
    name: 'Банковский сектор',
    ticker: 'BNK',
    group: 'Акции',
    color: COLOR.blue,
    key: 'sectorBanks',
    fee: 0.002,
    note: 'Живёт процентной маржой, умирает от просрочки и нормативов.',
  },
  {
    id: 'eq_industry',
    name: 'Промышленность',
    ticker: 'IND',
    group: 'Акции',
    color: COLOR.teal,
    key: 'sectorIndustry',
    fee: 0.002,
    note: 'Чувствительна к инвестиционному циклу и стоимости кредита.',
  },
  {
    id: 'eq_consumer',
    name: 'Потребительский сектор',
    ticker: 'CNS',
    group: 'Акции',
    color: COLOR.goldSoft,
    key: 'sectorConsumer',
    fee: 0.002,
    note: 'Зависит от реальных зарплат и уверенности домохозяйств.',
  },
  {
    id: 'eq_resources',
    name: 'Сырьевой сектор',
    ticker: 'RES',
    group: 'Акции',
    color: '#8E7CC3',
    key: 'sectorResources',
    fee: 0.002,
    note: 'Выигрывает от дорогого сырья и слабой валюты.',
  },
  {
    id: 'bond_gov',
    name: 'Гособлигации 10 лет',
    ticker: 'GOV',
    group: 'Облигации',
    color: COLOR.blue,
    key: 'bondIndex',
    fee: 0.001,
    note: 'Купон плюс переоценка. Дюрация 7,4: рост доходности на 1 п.п. отнимает около 7% цены.',
  },
  {
    id: 'bond_corp',
    name: 'Корпоративные облигации',
    ticker: 'CRP',
    group: 'Облигации',
    color: COLOR.teal,
    key: 'corpBondIndex',
    fee: 0.0015,
    note: 'Доходность выше на величину спреда, но в кризис спред расширяется, а эмитенты не платят.',
  },
  {
    id: 'dep',
    name: 'Банковский депозит',
    ticker: 'DEP',
    group: 'Деньги',
    color: COLOR.teal,
    key: 'depositIndex',
    fee: 0,
    note: 'Ставка по депозитам. Безопасно ровно до тех пор, пока реальная ставка не уйдёт в минус.',
  },
  {
    id: 'fx',
    name: 'Иностранная валюта',
    ticker: 'FX',
    group: 'Деньги',
    color: COLOR.rust,
    key: 'fxIndex',
    fee: 0.003,
    note: 'Курс плюс мировая ставка. Страховка от девальвации и от собственного правительства.',
  },
  {
    id: 'gold',
    name: 'Сырьевой контракт',
    ticker: 'CMD',
    group: 'Товары',
    color: '#C08A6B',
    key: 'goldIndex',
    fee: 0.0025,
    note: 'Мировая цена сырья в местной валюте: защищает и от инфляции, и от слабого курса.',
  },
];
const INSTR_BY_ID = {};
INSTRUMENTS.forEach((x) => {
  INSTR_BY_ID[x.id] = x;
});

const emptyBook = () => ({
  cash: 10,
  pos: {},
  avg: {},
  realized: 0,
  history: [10],
  startValue: 10,
});
const priceOf = (instr, economy, live) => {
  const v =
    live && Number.isFinite(live[instr.key])
      ? live[instr.key]
      : economy[instr.key];
  return Number.isFinite(v) && v > 0 ? v : 1;
};
const bookValue = (book, economy, live) => {
  let v = book.cash;
  INSTRUMENTS.forEach((i) => {
    const q = book.pos[i.id] || 0;
    if (q) v += (q * priceOf(i, economy, live)) / 1000;
  });
  return v;
};
/* цены указаны в пунктах индекса; одна «единица» позиции = 1/1000 млн, чтобы числа были удобными */
function tradeBook(book, instrId, amountMln, side, economy, live) {
  const instr = INSTR_BY_ID[instrId];
  if (!instr) return book;
  const price = priceOf(instr, economy, live);
  const fee = 1 + (side === 'buy' ? instr.fee : -instr.fee);
  const qty = (amountMln * 1000) / (price * fee);
  const held = book.pos[instrId] || 0;
  if (side === 'buy') {
    const cost = (qty * price * fee) / 1000;
    const newQty = held + qty;
    const prevAvg = book.avg[instrId] || price;
    return {
      ...book,
      cash: book.cash - cost,
      pos: { ...book.pos, [instrId]: newQty },
      avg: {
        ...book.avg,
        [instrId]: (prevAvg * held + price * qty) / Math.max(1e-9, newQty),
      },
    };
  }
  const sellQty = Math.min(held, qty);
  if (sellQty <= 0) return book;
  const proceeds = (sellQty * price * fee) / 1000;
  const pnl = (sellQty * (price - (book.avg[instrId] || price))) / 1000;
  return {
    ...book,
    cash: book.cash + proceeds,
    realized: book.realized + pnl,
    pos: { ...book.pos, [instrId]: held - sellQty },
  };
}

function PriceCell({ value, size = 12, bold }) {
  const prevRef = React.useRef(value);
  const [dir, setDir] = useState(0);
  React.useEffect(() => {
    if (value > prevRef.current + 1e-9) setDir(1);
    else if (value < prevRef.current - 1e-9) setDir(-1);
    prevRef.current = value;
    const t = setTimeout(() => setDir(0), 650);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span
      className="ems-mono"
      style={{
        fontSize: size,
        fontWeight: bold ? 600 : 400,
        transition: 'color 0.45s ease',
        color: dir > 0 ? COLOR.teal : dir < 0 ? COLOR.rust : COLOR.text,
      }}
    >
      {Number.isFinite(value) ? value.toFixed(2) : '—'}
    </span>
  );
}

function TradingTerminal({ economy, prev, live, book, onTrade, history }) {
  const [sel, setSel] = useState('eq_broad');
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState(1);
  const equity = bookValue(book, economy, live);
  const margin = book.cash < 0 ? -book.cash : 0;
  const maxLoan = Math.max(0, equity * 0.6 - margin);
  const instr = INSTR_BY_ID[sel];
  const price = priceOf(instr, economy, live);
  const held = book.pos[sel] || 0;
  const heldValue = (held * price) / 1000;
  const avg = book.avg[sel];
  const unreal = held > 0 && avg ? (held * (price - avg)) / 1000 : 0;
  const invested = INSTRUMENTS.reduce(
    (a, i) => a + ((book.pos[i.id] || 0) * priceOf(i, economy, live)) / 1000,
    0
  );
  const maxBuy = Math.max(0, book.cash + maxLoan);
  const maxAmount = side === 'buy' ? maxBuy : heldValue;
  const amt = clamp(amount, 0, maxAmount);
  const fee = instr.fee;
  const qty = (amt * 1000) / (price * (side === 'buy' ? 1 + fee : 1 - fee));
  const chg =
    prev && prev[instr.key]
      ? (economy[instr.key] / prev[instr.key] - 1) * 100
      : 0;
  const series = (history || []).slice(-28).map((h) => h[instr.key]);

  const setPct = (p) => {
    Audio.play('tick');
    setAmount(Math.round(maxAmount * p * 100) / 100);
  };

  return (
    <div className="ems-panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* строка состояния счёта */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 22px',
          alignItems: 'center',
          padding: '9px 13px',
          borderBottom: `1px solid ${COLOR.border}`,
          background: COLOR.panelAlt,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TrendingUp size={13} color={COLOR.gold} />
          <span
            className="ems-serif"
            style={{ fontSize: 13, color: COLOR.goldSoft }}
          >
            Терминал
          </span>
        </span>
        {[
          ['Капитал', `${equity.toFixed(2)} млн`, COLOR.text],
          [
            'Деньги',
            `${book.cash.toFixed(2)}`,
            book.cash < 0 ? COLOR.rust : COLOR.text,
          ],
          ['В позициях', `${invested.toFixed(2)}`, COLOR.text],
          [
            'Плечо',
            margin > 0
              ? `${margin.toFixed(2)} под ${fmt1(economy.lendingRate)}%`
              : 'нет',
            margin > 0 ? COLOR.rust : COLOR.faint,
          ],
          [
            'Зафиксировано',
            `${fmtSigned1(book.realized)} млн`,
            book.realized >= 0 ? COLOR.teal : COLOR.rust,
          ],
        ].map(([l, v, c]) => (
          <span
            key={l}
            style={{
              fontSize: 11.5,
              display: 'flex',
              gap: 5,
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: COLOR.muted }}>{l}</span>
            <span className="ems-mono" style={{ color: c }}>
              {v}
            </span>
          </span>
        ))}
      </div>

      <div className="ems-terminal">
        {/* список инструментов */}
        <div
          className="ems-scroll"
          style={{
            maxHeight: 430,
            overflowY: 'auto',
            borderRight: `1px solid ${COLOR.border}`,
          }}
        >
          {[...new Set(INSTRUMENTS.map((i) => i.group))].map((g) => (
            <div key={g}>
              <div
                style={{
                  padding: '7px 12px 3px',
                  fontSize: 9.5,
                  color: COLOR.blue,
                  letterSpacing: '0.08em',
                }}
              >
                {g.toUpperCase()}
              </div>
              {INSTRUMENTS.filter((i) => i.group === g).map((i) => {
                const pr = priceOf(i, economy, live);
                const q = book.pos[i.id] || 0;
                const val = (q * pr) / 1000;
                const dq =
                  prev && prev[i.key]
                    ? (economy[i.key] / prev[i.key] - 1) * 100
                    : 0;
                const active = sel === i.id;
                return (
                  <div
                    key={i.id}
                    onClick={() => {
                      Audio.play('tick');
                      setSel(i.id);
                      setAmount(1);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      background: active ? COLOR.goldDim : 'transparent',
                      borderLeft: `2px solid ${
                        active
                          ? COLOR.gold
                          : val > 0.005
                          ? i.color
                          : 'transparent'
                      }`,
                    }}
                  >
                    <span
                      className="ems-mono"
                      style={{ fontSize: 10, color: i.color, width: 30 }}
                    >
                      {i.ticker}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: active ? COLOR.text : COLOR.muted,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {i.name}
                      </div>
                      {val > 0.005 && (
                        <div style={{ fontSize: 10, color: COLOR.faint }}>
                          в позиции {val.toFixed(2)} млн
                        </div>
                      )}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <div>
                        <PriceCell value={pr} size={11.5} />
                      </div>
                      <div
                        className="ems-mono"
                        style={{
                          fontSize: 10,
                          color:
                            dq > 0.01
                              ? COLOR.teal
                              : dq < -0.01
                              ? COLOR.rust
                              : COLOR.faint,
                        }}
                      >
                        {dq > 0.01 ? '▲' : dq < -0.01 ? '▼' : '·'}{' '}
                        {fmtSigned1(dq)}%
                      </div>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* заявка по выбранному инструменту */}
        <div
          style={{
            padding: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: COLOR.text }}>
                <span
                  className="ems-mono"
                  style={{ color: instr.color, marginRight: 7 }}
                >
                  {instr.ticker}
                </span>
                {instr.name}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: COLOR.faint,
                  marginTop: 3,
                  maxWidth: 330,
                  lineHeight: 1.4,
                }}
              >
                {instr.note}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <PriceCell value={price} size={21} bold />
              <div
                className="ems-mono"
                style={{
                  fontSize: 11,
                  color: chg >= 0 ? COLOR.teal : COLOR.rust,
                }}
              >
                {fmtSigned1(chg)}% за квартал
              </div>
            </div>
          </div>

          {series.length > 2 && (
            <Spark data={series} color={instr.color} height={44} fill />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 8,
              background: COLOR.panelAlt,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 3,
              padding: '8px 10px',
            }}
          >
            {[
              ['Позиция', held > 0 ? held.toFixed(1) : '—'],
              ['Средняя', avg ? avg.toFixed(2) : '—'],
              ['Стоимость', held > 0 ? `${heldValue.toFixed(2)} млн` : '—'],
              ['Прибыль', held > 0 && avg ? `${fmtSigned1(unreal)} млн` : '—'],
            ].map(([l, v], idx) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: COLOR.muted }}>{l}</div>
                <div
                  className="ems-mono"
                  style={{
                    fontSize: 12,
                    color:
                      idx === 3 && held > 0
                        ? unreal >= 0
                          ? COLOR.teal
                          : COLOR.rust
                        : COLOR.text,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {[
              ['buy', 'Купить'],
              ['sell', 'Продать'],
            ].map(([id, label]) => (
              <button
                key={id}
                className="ems-btn"
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: 12.5,
                  background:
                    side === id
                      ? id === 'buy'
                        ? COLOR.teal
                        : COLOR.rust
                      : COLOR.panelAlt,
                  color: side === id ? COLOR.ink : COLOR.muted,
                  borderColor:
                    side === id
                      ? id === 'buy'
                        ? COLOR.teal
                        : COLOR.rust
                      : COLOR.border,
                }}
                onClick={() => {
                  Audio.play('tick');
                  setSide(id);
                  setAmount(
                    Math.min(amount, id === 'buy' ? maxBuy : heldValue)
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 11, color: COLOR.muted }}>
                Сумма сделки
              </span>
              <span className="ems-mono" style={{ fontSize: 14 }}>
                {amt.toFixed(2)}{' '}
                <span style={{ fontSize: 10, color: COLOR.faint }}>млн</span>
              </span>
            </div>
            <input
              type="range"
              className="ems-slider"
              min={0}
              max={Math.max(0.1, Math.round(maxAmount * 100) / 100)}
              step={0.05}
              value={amt}
              onChange={(e) => {
                Audio.play('tick');
                setAmount(parseFloat(e.target.value));
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[
                [0.25, '25%'],
                [0.5, '50%'],
                [0.75, '75%'],
                [1, 'всё'],
              ].map(([p, l]) => (
                <button
                  key={l}
                  className="ems-btn"
                  style={{ flex: 1, padding: '3px 0', fontSize: 10.5 }}
                  onClick={() => setPct(p)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: COLOR.muted,
              lineHeight: 1.5,
              borderLeft: `2px solid ${
                side === 'buy' ? COLOR.teal : COLOR.rust
              }`,
              paddingLeft: 9,
            }}
          >
            {amt <= 0.001 ? (
              'Выберите сумму сделки.'
            ) : (
              <>
                {side === 'buy' ? 'Покупка' : 'Продажа'}{' '}
                <b className="ems-mono" style={{ color: COLOR.text }}>
                  {qty.toFixed(1)}
                </b>{' '}
                ед. по{' '}
                <b className="ems-mono" style={{ color: COLOR.text }}>
                  {price.toFixed(2)}
                </b>
                , комиссия {(fee * 100).toFixed(2)}% ({(amt * fee).toFixed(3)}{' '}
                млн).
                <br />
                Деньги: {book.cash.toFixed(2)} →{' '}
                <b className="ems-mono" style={{ color: COLOR.text }}>
                  {(side === 'buy' ? book.cash - amt : book.cash + amt).toFixed(
                    2
                  )}
                </b>{' '}
                млн
                {side === 'buy' && book.cash - amt < 0 && (
                  <span style={{ color: COLOR.rust }}> · сделка в плечо</span>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <button
              className="ems-btn"
              disabled={amt <= 0.001}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 13,
                background: side === 'buy' ? COLOR.tealDim : COLOR.rustDim,
                borderColor: side === 'buy' ? COLOR.teal : COLOR.rust,
                color: side === 'buy' ? COLOR.teal : COLOR.rust,
                fontWeight: 600,
              }}
              onClick={() => {
                Audio.play(side === 'buy' ? 'coin' : 'click');
                onTrade(sel, amt, side);
                setAmount(1);
              }}
            >
              {side === 'buy' ? 'Купить' : 'Продать'} на {amt.toFixed(2)} млн
            </button>
            {held > 0 && (
              <button
                className="ems-btn"
                style={{ padding: '10px 14px', fontSize: 12 }}
                onClick={() => {
                  Audio.play('click');
                  onTrade(sel, heldValue, 'sell');
                }}
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioSummary({ book, economy, live, prevValue }) {
  const equity = bookValue(book, economy, live);
  const real = (equity * 100) / economy.priceLevel;
  const qRet = prevValue ? (equity / prevValue - 1) * 100 : 0;
  const totalRet = (equity / (book.startValue || 10) - 1) * 100;
  const realTotal = (real / (book.startValue || 10) - 1) * 100;
  const rows = INSTRUMENTS.map((i) => ({
    i,
    v: ((book.pos[i.id] || 0) * priceOf(i, economy, live)) / 1000,
  })).filter((r) => r.v > 0.005);
  const invested = rows.reduce((a, r) => a + r.v, 0);
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div
        className="ems-serif"
        style={{
          fontSize: 14,
          color: COLOR.goldSoft,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Coins size={14} />
        Ваш капитал
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-end',
          marginBottom: 9,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>Стоимость</div>
          <div className="ems-mono" style={{ fontSize: 22 }}>
            {equity.toFixed(2)}
            <span style={{ fontSize: 11, color: COLOR.faint }}> млн</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>
            В ценах старта
          </div>
          <div
            className="ems-mono"
            style={{
              fontSize: 15,
              color: realTotal >= 0 ? COLOR.teal : COLOR.rust,
            }}
          >
            {real.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>За квартал</div>
          <div
            className="ems-mono"
            style={{ fontSize: 15, color: qRet >= 0 ? COLOR.teal : COLOR.rust }}
          >
            {fmtSigned1(qRet)}%
          </div>
        </div>
      </div>
      {book.history && book.history.length > 2 && (
        <div style={{ margin: '4px 0 8px' }}>
          <Spark data={book.history} color={COLOR.gold} height={40} fill />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 8,
          border: `1px solid ${COLOR.border}`,
        }}
      >
        {rows.map((r) => (
          <span
            key={r.i.id}
            style={{
              width: `${(r.v / Math.max(0.001, equity)) * 100}%`,
              background: r.i.color,
            }}
          />
        ))}
        <span style={{ flex: 1, background: COLOR.panelAlt }} />
      </div>
      {rows.map((r) => (
        <div
          key={r.i.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11.5,
            padding: '2px 0',
          }}
        >
          <span
            style={{
              color: COLOR.muted,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: r.i.color,
                borderRadius: 1,
              }}
            />
            {r.i.name}
          </span>
          <span className="ems-mono">
            {r.v.toFixed(2)} млн ·{' '}
            {Math.round((r.v / Math.max(0.001, equity)) * 100)}%
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          padding: '2px 0',
          color: COLOR.muted,
        }}
      >
        <span>Свободные деньги</span>
        <span
          className="ems-mono"
          style={{ color: book.cash < 0 ? COLOR.rust : COLOR.text }}
        >
          {book.cash.toFixed(2)} млн
        </span>
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: COLOR.faint,
          marginTop: 9,
          lineHeight: 1.45,
        }}
      >
        Всего с начала игры {fmtSigned1(totalRet)}%, с поправкой на инфляцию{' '}
        {fmtSigned1(realTotal)}%. Инфляция за квартал забирает{' '}
        {fmt1(economy.inflation / 4)}% от номинальной стоимости — деньги на
        счету не защищены.
        {invested < equity * 0.15 &&
          ' Почти весь капитал лежит в деньгах: он не работает.'}
      </div>
    </div>
  );
}

/* ============================ МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ ============================ */
function RequestPanel({ role, botRole, pending, setPending, lastResponse }) {
  if (!botRole || botRole === 'both') return null;
  const options = REQUESTS.filter((r) => r.from === role);
  if (!options.length) return null;
  const cur = options.find((r) => r.id === pending);
  const target = botRole === 'central_bank' ? 'Центральному банку' : 'Минфину';
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div
        className="ems-serif"
        style={{
          fontSize: 13,
          color: COLOR.goldSoft,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <Megaphone size={13} />
        Официальный запрос {target}
      </div>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}
      >
        <span
          className={`ems-tab ${!pending ? 'active' : ''}`}
          style={{ fontSize: 10.5, padding: '3px 8px' }}
          onClick={() => {
            Audio.play('tick');
            setPending(null);
          }}
        >
          без запроса
        </span>
        {options.map((r) => (
          <span
            key={r.id}
            className={`ems-tab ${pending === r.id ? 'active' : ''}`}
            style={{ fontSize: 10.5, padding: '3px 8px' }}
            onClick={() => {
              Audio.play('click');
              setPending(r.id);
            }}
          >
            {r.label}
          </span>
        ))}
      </div>
      {cur && (
        <div
          style={{
            fontSize: 11.5,
            color: COLOR.text,
            lineHeight: 1.45,
            borderLeft: `2px solid ${COLOR.gold}`,
            paddingLeft: 9,
          }}
        >
          «{cur.ask}»
          <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4 }}>
            Запрос уйдёт вместе с вашими решениями. Ответ зависит от характера
            ведомства и от того, насколько просьба соответствует ситуации.
          </div>
        </div>
      )}
      {lastResponse && (
        <div
          style={{
            marginTop: 9,
            fontSize: 11.5,
            lineHeight: 1.45,
            borderLeft: `2px solid ${
              lastResponse.status === 'accepted'
                ? COLOR.teal
                : lastResponse.status === 'partial'
                ? COLOR.gold
                : COLOR.rust
            }`,
            paddingLeft: 9,
          }}
        >
          <span
            style={{
              color:
                lastResponse.status === 'accepted'
                  ? COLOR.teal
                  : lastResponse.status === 'partial'
                  ? COLOR.gold
                  : COLOR.rust,
              fontWeight: 600,
            }}
          >
            {lastResponse.status === 'accepted'
              ? 'Запрос удовлетворён: '
              : lastResponse.status === 'partial'
              ? 'Частично удовлетворён: '
              : 'Отказано: '}
          </span>
          <span style={{ color: COLOR.muted }}>{lastResponse.text}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ ПРЕДСТАВЛЕНИЕ И ДОСТУПНОСТЬ ============================ */
const DASHBOARD_PRESETS = [
  {
    id: 'overview',
    name: 'Обзор',
    pins: [
      'gdp',
      'outputGap',
      'inflation',
      'unemployment',
      'debtToGdp',
      'approval',
    ],
  },
  {
    id: 'prices',
    name: 'Цены и ставки',
    pins: [
      'inflation',
      'inflationExpectations',
      'cbCredibility',
      'keyRate',
      'lendingRate',
      'rStar',
      'wageGrowth',
    ],
  },
  {
    id: 'budget',
    name: 'Бюджет',
    pins: [
      'budgetBalancePctGdp',
      'debtToGdp',
      'interestToRevenue',
      'revenuePctGdp',
      'shadowShare',
      'sovereignFund',
    ],
  },
  {
    id: 'market',
    name: 'Рынок',
    pins: [
      'stockIndex',
      'bondIndex',
      'yield10y',
      'curveSlope',
      'sovereignSpread',
      'volatilityIndex',
    ],
  },
  {
    id: 'crisis',
    name: 'Кризис',
    pins: [
      'bankNPL',
      'bankCapitalAdequacy',
      'bankingRisk',
      'reserves',
      'exchangeRate',
      'unemployment',
    ],
  },
];
const haptic = (pattern) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate)
      navigator.vibrate(pattern);
  } catch (e) {
    /* не поддерживается */
  }
};

function ViewSettings({
  theme,
  setTheme,
  dense,
  setDense,
  dashboards,
  activeDash,
  applyDash,
  saveDash,
  deleteDash,
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ems-btn"
        style={{ padding: '7px 9px' }}
        title="Вид, тема и доступность"
        aria-label="Настройки вида"
        onClick={() => {
          Audio.play('click');
          setOpen((o) => !o);
        }}
      >
        <Sliders size={14} />
      </button>
      {open && (
        <div
          className="ems-panel-raised ems-fade-in"
          style={{
            position: 'absolute',
            right: 0,
            top: 38,
            width: 250,
            padding: 13,
            zIndex: 40,
          }}
        >
          <div
            className="ems-serif"
            style={{ fontSize: 12.5, color: COLOR.goldSoft, marginBottom: 8 }}
          >
            Тема оформления
          </div>
          {Object.values(THEMES).map((t) => (
            <button
              key={t.id}
              className="ems-btn"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 9px',
                fontSize: 11.5,
                marginBottom: 4,
                background: theme === t.id ? COLOR.gold : COLOR.panelAlt,
                color: theme === t.id ? COLOR.ink : COLOR.text,
                borderColor: theme === t.id ? COLOR.gold : COLOR.border,
              }}
              onClick={() => {
                Audio.play('tab');
                setTheme(t.id);
              }}
            >
              {t.name}
              {t.id === 'contrast' ? ' · доступность' : ''}
            </button>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '10px 0 4px',
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: dense ? COLOR.text : COLOR.muted,
                flex: 1,
              }}
            >
              Только цифры
            </span>
            <button
              className="ems-btn"
              style={{
                padding: '2px 9px',
                fontSize: 10.5,
                background: dense ? COLOR.gold : COLOR.panelAlt,
                color: dense ? COLOR.ink : COLOR.muted,
                borderColor: dense ? COLOR.gold : COLOR.border,
              }}
              onClick={() => {
                Audio.play('tick');
                setDense(!dense);
              }}
            >
              {dense ? 'вкл' : 'выкл'}
            </button>
          </div>
          <div
            style={{
              fontSize: 10,
              color: COLOR.faint,
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            Скрывает графики, шкалы и декоративные слои — остаются только
            таблицы и текст.
          </div>
          <div
            className="ems-serif"
            style={{ fontSize: 12.5, color: COLOR.goldSoft, marginBottom: 6 }}
          >
            Дашборды
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              marginBottom: 6,
            }}
          >
            {dashboards.map((d) => (
              <span
                key={d.id}
                className={`ems-tab ${activeDash === d.id ? 'active' : ''}`}
                style={{ fontSize: 10.5, padding: '3px 8px' }}
                onClick={() => {
                  Audio.play('tab');
                  applyDash(d.id);
                }}
              >
                {d.name}
                {d.custom && (
                  <span
                    style={{ color: COLOR.faint }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDash(d.id);
                    }}
                  >
                    {' '}
                    ×
                  </span>
                )}
              </span>
            ))}
          </div>
          <button
            className="ems-btn"
            style={{ width: '100%', padding: '5px 0', fontSize: 10.5 }}
            onClick={() => {
              Audio.play('stamp');
              saveDash();
            }}
          >
            Сохранить текущий набор
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================ РЕАКЦИЯ ЭКОНОМИКИ НА РЕШЕНИЕ ============================ */
function computeIRF(
  economy,
  decisions,
  leverId,
  newValue,
  difficulty,
  horizon
) {
  const H = horizon || 12;
  const noiseSave = CONFIG.noiseMult[difficulty];
  const evSave = CONFIG.eventProbability[difficulty];
  CONFIG.noiseMult[difficulty] = 0;
  CONFIG.eventProbability[difficulty] = 0;
  const run = (val) => {
    let e = economy;
    let d = { ...decisions, [leverId]: val };
    let pend = [];
    let cds = {};
    let st = [];
    const out = [];
    for (let q = 1; q <= H; q++) {
      const r = simulateQuarter({
        economy: e,
        decisions: d,
        pendingImpulses: pend,
        eventCooldowns: cds,
        difficulty,
        quarterIndex: q,
        stories: st,
      });
      e = r.economy;
      pend = r.pendingImpulses;
      cds = r.eventCooldowns;
      st = r.stories;
      d = { ...defaultDecisions(e, d), [leverId]: val };
      out.push(e);
    }
    return out;
  };
  let res = [];
  try {
    const base = run(decisions[leverId]);
    const alt = run(newValue);
    res = base.map((b, i) => ({
      q: i + 1,
      gdpGrowth: alt[i].gdpGrowth - b.gdpGrowth,
      inflation: alt[i].inflation - b.inflation,
      unemployment: alt[i].unemployment - b.unemployment,
      outputGap: alt[i].outputGap - b.outputGap,
      debtToGdp: alt[i].debtToGdp - b.debtToGdp,
      stockIndex: (alt[i].stockIndex / b.stockIndex - 1) * 100,
      baseGdp: b.gdpGrowth,
      altGdp: alt[i].gdpGrowth,
      baseInfl: b.inflation,
      altInfl: alt[i].inflation,
    }));
  } catch (e) {
    res = [];
  }
  CONFIG.noiseMult[difficulty] = noiseSave;
  CONFIG.eventProbability[difficulty] = evSave;
  return res;
}
const IRF_SERIES = [
  { key: 'gdpGrowth', label: 'Рост ВВП', color: COLOR.gold, unit: ' п.п.' },
  { key: 'inflation', label: 'Инфляция', color: COLOR.rust, unit: ' п.п.' },
  {
    key: 'unemployment',
    label: 'Безработица',
    color: COLOR.blue,
    unit: ' п.п.',
  },
  { key: 'debtToGdp', label: 'Долг к ВВП', color: COLOR.teal, unit: ' п.п.' },
  { key: 'stockIndex', label: 'Индекс акций', color: '#8E7CC3', unit: '%' },
];
function IRFModal({ economy, decisions, lever, value, difficulty, onClose }) {
  const data = useMemo(
    () => computeIRF(economy, decisions, lever.id, value, difficulty, 12),
    [lever.id, value]
  );
  const peak = (key) =>
    data.reduce(
      (a, d) => (Math.abs(d[key]) > Math.abs(a.v) ? { v: d[key], q: d.q } : a),
      { v: 0, q: 0 }
    );
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,9,14,0.82)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="ems-panel-raised ems-fade-in"
        style={{
          maxWidth: 720,
          width: '100%',
          padding: 18,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <Activity size={15} color={COLOR.gold} />
          <span
            className="ems-serif"
            style={{ fontSize: 15, color: COLOR.goldSoft }}
          >
            Реакция экономики: {lever.label}
          </span>
          <button
            className="ems-btn"
            style={{ marginLeft: 'auto', padding: '4px 7px' }}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={13} />
          </button>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: COLOR.muted,
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Модель прогоняется на 12 кварталов вперёд дважды: с текущим значением
          ({fmt1(decisions[lever.id])}
          {lever.suffix}) и с новым ({fmt1(value)}
          {lever.suffix}), без случайных шоков и событий. На графике — разница
          между этими двумя мирами, то есть чистый эффект именно вашего решения.
        </div>
        <div className="ems-visual" style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 6, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                stroke={COLOR.hairline}
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="q"
                tick={{ fill: COLOR.faint, fontSize: 10 }}
                stroke={COLOR.border}
                label={{
                  value: 'кварталов после решения',
                  fill: COLOR.faint,
                  fontSize: 10,
                  position: 'insideBottom',
                  offset: -2,
                }}
              />
              <YAxis
                tick={{ fill: COLOR.faint, fontSize: 10 }}
                stroke={COLOR.border}
              />
              <Tooltip
                contentStyle={{
                  background: COLOR.panelRaised,
                  border: `1px solid ${COLOR.border}`,
                  fontSize: 11,
                }}
                labelFormatter={(v) => `${v}-й квартал`}
                formatter={(v, n) => [fmtSigned1(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              {IRF_SERIES.map((sr) => (
                <Line
                  key={sr.key}
                  type="monotone"
                  dataKey={sr.key}
                  name={sr.label}
                  stroke={sr.color}
                  strokeWidth={1.6}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 8,
            marginTop: 12,
          }}
        >
          {IRF_SERIES.map((sr) => {
            const pk = peak(sr.key);
            return (
              <div key={sr.key} className="ems-panel" style={{ padding: 9 }}>
                <div style={{ fontSize: 10.5, color: COLOR.muted }}>
                  {sr.label}
                </div>
                <div
                  className="ems-mono"
                  style={{ fontSize: 15, color: sr.color }}
                >
                  {fmtSigned1(pk.v)}
                  {sr.unit}
                </div>
                <div style={{ fontSize: 10, color: COLOR.faint }}>
                  {pk.q ? `пик через ${pk.q} кв.` : 'без заметного эффекта'}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 11,
            color: COLOR.faint,
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Это контрфактический расчёт: «что было бы, если бы». Реальная
          траектория будет отличаться — в ней будут шоки, решения второго
          ведомства и накопленные ожидания. Но знак, форма и задержка эффекта
          останутся теми же.
        </div>
      </div>
    </div>
  );
}

/* ============================ ЭКРАН ВЫБОРА ============================ */
function SetupScreen({ onStart, onLoad }) {
  const [showLoad, setShowLoad] = useState(false);
  const [role, setRole] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [goal, setGoal] = useState('living_standards');
  const [cbPersona, setCbPersona] = useState('pragmatic');
  const [mofPersona, setMofPersona] = useState('technocrat');
  const roleDef = ROLES.find((r) => r.id === role);
  const botRole = roleDef ? roleDef.botRole : null;
  const personaBlocks =
    botRole === 'central_bank'
      ? [
          {
            list: CB_PERSONAS,
            value: cbPersona,
            set: setCbPersona,
            title: 'Характер Центрального банка',
          },
        ]
      : botRole === 'ministry_finance'
      ? [
          {
            list: MOF_PERSONAS,
            value: mofPersona,
            set: setMofPersona,
            title: 'Характер Минфина',
          },
        ]
      : botRole === 'both'
      ? [
          {
            list: CB_PERSONAS,
            value: cbPersona,
            set: setCbPersona,
            title: 'Характер Центрального банка',
          },
          {
            list: MOF_PERSONAS,
            value: mofPersona,
            set: setMofPersona,
            title: 'Характер Минфина',
          },
        ]
      : [];
  const personas = personaBlocks.length ? personaBlocks : null;

  return (
    <div
      className="ems-root"
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '44px 16px',
      }}
    >
      <GlobalStyle />
      {showLoad && (
        <SaveLoadModal
          mode="load"
          snapshot={null}
          onClose={() => setShowLoad(false)}
          onLoad={(d) => {
            setShowLoad(false);
            onLoad(d);
          }}
        />
      )}
      <div style={{ maxWidth: 800, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div
            className="ems-serif"
            style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Экономическая панель государства
          </div>
          <div
            className="ems-mono"
            style={{ color: COLOR.faint, fontSize: 11, marginTop: 9 }}
          >
            {romanQ(1)} кв. {CONFIG.startYear} · вступление в должность
          </div>
          <div
            style={{
              color: COLOR.muted,
              fontSize: 13.5,
              marginTop: 14,
              maxWidth: 600,
              margin: '14px auto 0',
              lineHeight: 1.55,
            }}
          >
            Экономика работает как цепочка причин: ставка → рыночные ставки →
            кредит → спрос → выпуск → занятость → зарплаты → цены → ожидания.
            Второй ветвью власти управляет бот со своим характером — и у него
            будут к вам требования.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            className="ems-mono"
            style={{ fontSize: 11, color: COLOR.faint }}
          >
            1
          </span>
          <span
            className="ems-serif"
            style={{ fontSize: 13, color: COLOR.goldSoft }}
          >
            Ваш пост
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))',
            gap: 10,
            marginBottom: 26,
          }}
        >
          {ROLES.map((r) => {
            const Icon = ROLE_ICON[r.icon];
            const active = role === r.id;
            return (
              <div
                key={r.id}
                onClick={() => {
                  Audio.prime();
                  Audio.play('click');
                  setRole(r.id);
                }}
                className="ems-panel"
                style={{
                  padding: 16,
                  cursor: 'pointer',
                  position: 'relative',
                  borderColor: active ? COLOR.gold : COLOR.border,
                  background: active ? COLOR.panelRaised : COLOR.panel,
                }}
              >
                {active && (
                  <Check
                    size={13}
                    color={COLOR.gold}
                    style={{ position: 'absolute', top: 14, right: 14 }}
                  />
                )}
                <Icon size={20} color={active ? COLOR.gold : COLOR.muted} />
                <div
                  className="ems-serif"
                  style={{
                    fontSize: 14.5,
                    margin: '9px 0 5px',
                    color: active ? COLOR.goldSoft : COLOR.text,
                  }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: COLOR.muted,
                    lineHeight: 1.5,
                  }}
                >
                  {r.desc}
                </div>
              </div>
            );
          })}
        </div>

        {personaBlocks.map((blk, bi) => (
          <React.Fragment key={blk.title}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                className="ems-mono"
                style={{ fontSize: 11, color: COLOR.faint }}
              >
                {bi === 0 ? 2 : ''}
              </span>
              <span
                className="ems-serif"
                style={{ fontSize: 13, color: COLOR.goldSoft }}
              >
                {blk.title}
              </span>
            </div>
            <div
              style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10 }}
            >
              {botRole === 'both'
                ? 'Вы не управляете этим ведомством — но от его решений зависит стоимость ваших активов.'
                : blk.list === CB_PERSONAS
                ? 'Ставкой будет управлять бот-ЦБ. От его характера зависит, насколько дорого вам обойдётся бюджетная экспансия.'
                : 'Бюджетом будет управлять бот-Минфин. От его характера зависит, с какой инфляцией и каким долгом вам придётся иметь дело.'}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))',
                gap: 10,
                marginBottom: 22,
              }}
            >
              {blk.list.map((p) => {
                const active = blk.value === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      Audio.play('click');
                      blk.set(p.id);
                    }}
                    className="ems-panel"
                    style={{
                      padding: 14,
                      cursor: 'pointer',
                      position: 'relative',
                      borderColor: active ? COLOR.gold : COLOR.border,
                      background: active ? COLOR.panelRaised : COLOR.panel,
                    }}
                  >
                    {active && (
                      <Check
                        size={13}
                        color={COLOR.gold}
                        style={{ position: 'absolute', top: 12, right: 12 }}
                      />
                    )}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                    >
                      <Bot
                        size={14}
                        color={active ? COLOR.gold : COLOR.muted}
                      />
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: active ? COLOR.goldSoft : COLOR.text,
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: COLOR.faint,
                        margin: '4px 0 5px',
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: COLOR.muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {p.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            className="ems-mono"
            style={{ fontSize: 11, color: COLOR.faint }}
          >
            {personas ? 3 : 2}
          </span>
          <span
            className="ems-serif"
            style={{ fontSize: 13, color: COLOR.goldSoft }}
          >
            Уровень сложности
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
            gap: 10,
            marginBottom: 26,
          }}
        >
          {DIFFICULTIES.map((dd) => {
            const active = difficulty === dd.id;
            return (
              <div
                key={dd.id}
                onClick={() => {
                  Audio.play('click');
                  setDifficulty(dd.id);
                }}
                className="ems-panel"
                style={{
                  padding: 14,
                  cursor: 'pointer',
                  position: 'relative',
                  borderColor: active ? COLOR.gold : COLOR.border,
                  background: active ? COLOR.panelRaised : COLOR.panel,
                }}
              >
                {active && (
                  <Check
                    size={13}
                    color={COLOR.gold}
                    style={{ position: 'absolute', top: 12, right: 12 }}
                  />
                )}
                <div
                  style={{
                    fontSize: 13.5,
                    color: active ? COLOR.goldSoft : COLOR.text,
                    fontWeight: 600,
                  }}
                >
                  {dd.title}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: COLOR.muted,
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {dd.desc}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            className="ems-mono"
            style={{ fontSize: 11, color: COLOR.faint }}
          >
            {personas ? 4 : 3}
          </span>
          <span
            className="ems-serif"
            style={{ fontSize: 13, color: COLOR.goldSoft }}
          >
            Приоритетная оценка
          </span>
        </div>
        <div style={{ position: 'relative', marginBottom: 30 }}>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="ems-btn"
            style={{
              width: '100%',
              padding: '10px 36px 10px 12px',
              fontSize: 13,
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            {GOALS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            color={COLOR.muted}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <button
          disabled={!role}
          className="ems-btn primary"
          style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
          onClick={() => {
            if (!role) return;
            Audio.prime();
            Audio.play('stamp');
            Audio.startMusic();
            onStart({ role, difficulty, goal, cbPersona, mofPersona });
          }}
        >
          Принять полномочия
        </button>
        <button
          className="ems-btn"
          style={{
            width: '100%',
            padding: '10px 0',
            fontSize: 12.5,
            marginTop: 9,
          }}
          onClick={() => {
            Audio.prime();
            Audio.play('paper');
            setShowLoad(true);
          }}
        >
          <Upload size={13} style={{ verticalAlign: -2, marginRight: 7 }} />
          Продолжить сохранённую партию
        </button>
      </div>
    </div>
  );
}

/* ============================ ТАБЛИЦЫ ПОКАЗАТЕЛЕЙ ============================ */
const idx0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
const INDICATOR_TABS = [
  {
    id: 'economy',
    label: 'Выпуск',
    icon: TrendingUp,
    rows: [
      { key: 'gdp', label: 'ВВП (реальный)', fmt: fmtMoney },
      { key: 'gdpGrowth', label: 'Темп роста ВВП', fmt: fmtSignedPct },
      { key: 'potentialGdp', label: 'Потенциальный ВВП', fmt: fmtMoney },
      { key: 'potentialGrowth', label: 'Рост потенциала', fmt: fmtSignedPct },
      { key: 'outputGap', label: 'Разрыв выпуска', fmt: fmtSignedPct },
      {
        key: 'gdpPerCapita',
        label: 'ВВП на душу населения',
        fmt: (v) => `${Math.round(v).toLocaleString('ru-RU')} у.е.`,
      },
      { key: 'consumption', label: 'Потребление', fmt: fmtMoney },
      { key: 'businessInvestment', label: 'Инвестиции бизнеса', fmt: fmtMoney },
      {
        key: 'fiscalImpulse',
        label: 'Бюджетный импульс',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
    ],
  },
  {
    id: 'prices',
    label: 'Цены',
    icon: Coins,
    rows: [
      { key: 'inflation', label: 'Инфляция (ИПЦ)', fmt: pctFmt },
      { key: 'coreInflation', label: 'Базовая инфляция', fmt: pctFmt },
      {
        key: 'inflationExpectations',
        label: 'Инфляционные ожидания',
        fmt: pctFmt,
      },
      { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: idx0 },
      {
        key: 'importPriceInflation',
        label: 'Инфляция цен импорта',
        fmt: pctFmt,
      },
      {
        key: 'unitLaborCostGrowth',
        label: 'Удельные издержки труда',
        fmt: fmtSignedPct,
      },
      { key: 'moneySupply', label: 'Денежная масса (индекс)', fmt: fmt1 },
    ],
  },
  {
    id: 'money',
    label: 'Ставки',
    icon: Banknote,
    rows: [
      { key: 'keyRate', label: 'Ключевая ставка', fmt: pctFmt },
      { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
      { key: 'depositRate', label: 'Ставка по депозитам', fmt: pctFmt },
      {
        key: 'realLendingRate',
        label: 'Реальная ставка по кредитам',
        fmt: pctFmt,
      },
      { key: 'rStar', label: 'Нейтральная реальная ставка r*', fmt: pctFmt },
      {
        key: 'rateGap',
        label: 'Жёсткость условий (факт − нейтраль)',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
      { key: 'riskPremium', label: 'Премия за риск страны', fmt: pctFmt },
    ],
  },
  {
    id: 'banking',
    label: 'Банки',
    icon: ShieldAlert,
    rows: [
      { key: 'creditVolume', label: 'Кредитный портфель', fmt: fmtMoney },
      { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
      {
        key: 'creditGap',
        label: 'Кредитный разрыв (бум/сжатие)',
        fmt: (v) => `${fmtSigned1(v)} п.п. ВВП`,
      },
      { key: 'bankNPL', label: 'Просроченные кредиты', fmt: pctFmt },
      { key: 'bankCapital', label: 'Капитал банков', fmt: fmtMoney },
      {
        key: 'bankCapitalAdequacy',
        label: 'Достаточность капитала',
        fmt: pctFmt,
      },
      {
        key: 'bankProfit',
        label: 'Прибыль банков за квартал',
        fmt: fmtMoneySigned,
      },
      { key: 'bankLiquidity', label: 'Ликвидность банков', fmt: idx0 },
      { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
    ],
  },
  {
    id: 'government',
    label: 'Бюджет',
    icon: Landmark,
    rows: [
      { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
      { key: 'revenuePctGdp', label: 'Доходы к ВВП', fmt: pctFmt },
      { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
      { key: 'interestPayment', label: 'Обслуживание долга', fmt: fmtMoney },
      {
        key: 'interestToRevenue',
        label: 'Обслуживание к доходам',
        fmt: pctFmt,
      },
      {
        key: 'budgetBalancePctGdp',
        label: 'Баланс бюджета',
        fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      },
      {
        key: 'structuralBalancePctGdp',
        label: 'Структурный баланс',
        fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      },
      { key: 'govDebt', label: 'Государственный долг', fmt: fmtMoney },
      { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
      {
        key: 'effectiveDebtRate',
        label: 'Средняя ставка по долгу',
        fmt: pctFmt,
      },
      { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt },
    ],
  },
  {
    id: 'labor',
    label: 'Труд',
    icon: Users,
    rows: [
      { key: 'unemployment', label: 'Безработица', fmt: pctFmt },
      { key: 'nairu', label: 'Естественный уровень безработицы', fmt: pctFmt },
      {
        key: 'tightness',
        label: 'Напряжённость рынка труда',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
      { key: 'vacancyRate', label: 'Доля вакансий', fmt: pctFmt },
      { key: 'wageGrowth', label: 'Рост зарплат', fmt: fmtSignedPct },
      { key: 'employment', label: 'Занятость', fmt: pctFmt },
    ],
  },
  {
    id: 'external',
    label: 'Внешний сектор',
    icon: Globe2,
    rows: [
      { key: 'exports', label: 'Экспорт', fmt: fmtMoney },
      { key: 'imports', label: 'Импорт', fmt: fmtMoney },
      {
        key: 'currentAccount',
        label: 'Счёт текущих операций',
        fmt: fmtMoneySigned,
      },
      {
        key: 'netCapitalFlow',
        label: 'Чистый приток капитала',
        fmt: fmtMoneySigned,
      },
      { key: 'reserves', label: 'Золотовалютные резервы', fmt: fmtMoney },
      { key: 'exchangeRate', label: 'Курс (выше = слабее)', fmt: fmt1 },
      { key: 'realExchangeRate', label: 'Реальный курс', fmt: fmt1 },
      {
        key: 'fdi',
        label: 'Прямые иностранные инвестиции',
        fmt: fmtMoneySigned,
      },
      {
        key: 'worldGdpGrowth',
        label: 'Рост мировой экономики',
        fmt: fmtSignedPct,
      },
    ],
  },
  {
    id: 'potential',
    label: 'Потенциал',
    icon: Factory,
    rows: [
      { key: 'productivity', label: 'Производительность (TFP)', fmt: fmt1 },
      { key: 'tfpGrowth', label: 'Рост производительности', fmt: fmtSignedPct },
      { key: 'humanCapitalIndex', label: 'Человеческий капитал', fmt: fmt1 },
      { key: 'infrastructureIndex', label: 'Инфраструктура', fmt: fmt1 },
      { key: 'capitalStock', label: 'Основной капитал', fmt: fmtMoney },
      {
        key: 'supplyScar',
        label: 'Шрамы предложения',
        fmt: (v) => `${fmtSigned1(v)}%`,
      },
    ],
  },
  {
    id: 'market',
    label: 'Рынок',
    icon: TrendingUp,
    rows: [
      { key: 'stockIndex', label: 'Индекс акций', fmt: fmt1 },
      { key: 'marketCapPctGdp', label: 'Капитализация к ВВП', fmt: pctFmt },
      { key: 'stockPE', label: 'P/E рынка', fmt: fmt1 },
      { key: 'equityRiskPremium', label: 'Премия за риск акций', fmt: pctFmt },
      { key: 'bondIndex', label: 'Индекс облигаций', fmt: fmt1 },
      { key: 'yield2y', label: 'Доходность 2 года', fmt: pctFmt },
      { key: 'yield10y', label: 'Доходность 10 лет', fmt: pctFmt },
      {
        key: 'curveSlope',
        label: 'Наклон кривой',
        fmt: (v) => `${fmtSigned1(v)} п.п.`,
      },
      {
        key: 'sovereignSpread',
        label: 'Суверенный спред',
        fmt: (v) => `${Math.round(v)} б.п.`,
      },
      {
        key: 'corporateSpread',
        label: 'Корпоративный спред',
        fmt: (v) => `${Math.round(v)} б.п.`,
      },
      { key: 'volatilityIndex', label: 'Индекс страха', fmt: fmt1 },
      { key: 'bankPB', label: 'Банки: цена к капиталу', fmt: fmt2 },
      { key: 'bankROE', label: 'Банки: рентабельность', fmt: pctFmt },
      {
        key: 'netInterestMargin',
        label: 'Процентная маржа',
        fmt: (v) => `${fmt2(v)} п.п.`,
      },
      { key: 'fxVolatility', label: 'Волатильность курса', fmt: fmt1 },
    ],
  },
  {
    id: 'politics',
    label: 'Политика',
    icon: Flag,
    rows: [
      { key: 'approval', label: 'Рейтинг власти', fmt: (v) => v.toFixed(0) },
      {
        key: 'quartersToElection',
        label: 'Кварталов до выборов',
        fmt: (v) => v.toFixed(0),
        noDelta: true,
      },
      { key: 'term', label: 'Срок правительства', fmt: (v) => `${v}-й` },
      {
        key: 'govTrust',
        label: 'Доверие к правительству',
        fmt: (v) => v.toFixed(0),
      },
      {
        key: 'policyCoordination',
        label: 'Согласованность политики',
        fmt: (v) => v.toFixed(0),
      },
      {
        label: 'Мандат власти',
        get: (e) => e.mandate,
        text: true,
        map: MANDATE_LABEL,
      },
      {
        label: 'Линия правительства',
        get: (e) => e.governmentLine,
        text: true,
        map: {
          centrist: 'центристская',
          populist: 'популистская',
          austerity: 'консервативная',
          technocrat: 'технократическая',
        },
      },
    ],
  },
  {
    id: 'risks',
    label: 'Риски',
    icon: AlertTriangle,
    rows: [
      { key: 'inflationRisk', label: 'Инфляционный риск', fmt: idx0 },
      { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
      { key: 'debtRisk', label: 'Долговой риск', fmt: idx0 },
      { key: 'recessionRisk', label: 'Риск рецессии', fmt: idx0 },
      { key: 'currencyRisk', label: 'Валютный риск', fmt: idx0 },
      {
        key: 'financialStability',
        label: 'Финансовая стабильность',
        fmt: idx0,
      },
      { key: 'consumerConfidence', label: 'Доверие населения', fmt: idx0 },
      { key: 'businessConfidence', label: 'Доверие бизнеса', fmt: idx0 },
      { key: 'govTrust', label: 'Доверие к правительству', fmt: idx0 },
    ],
  },
];

/* Реестр показателей: всё, что можно закрепить в верхнюю полосу */
const METRIC_INVERT = new Set([
  'inflation',
  'coreInflation',
  'inflationExpectations',
  'importPriceInflation',
  'unitLaborCostGrowth',
  'sovereignSpread',
  'corporateSpread',
  'volatilityIndex',
  'equityRiskPremium',
  'discountRate',
  'taxWedgeValue',
  'depositRate',
  'effectiveDebtRate',
  'unemployment',
  'debtToGdp',
  'bankNPL',
  'bankingRisk',
  'inflationRisk',
  'debtRisk',
  'recessionRisk',
  'currencyRisk',
  'shadowShare',
  'interestToRevenue',
  'effectiveDebtRate',
  'riskPremium',
  'exchangeRate',
  'importPriceInflation',
  'lendingRate',
  'nairu',
  'creditGap',
  'rateGap',
  'quartersToElection',
]);
const ALL_METRICS = (() => {
  const m = {};
  INDICATOR_TABS.forEach((t) =>
    t.rows.forEach((r) => {
      if (r.key && !r.text && !m[r.key])
        m[r.key] = {
          key: r.key,
          label: r.label,
          fmt: r.fmt,
          group: t.label,
          invert: METRIC_INVERT.has(r.key),
        };
    })
  );
  [
    ['wellbeing', 'Благополучие'],
    ['scoreStability', 'Оценка: стабильность'],
    ['scoreWelfare', 'Оценка: благосостояние'],
    ['scoreFinancial', 'Оценка: финансы'],
    ['scoreFiscal', 'Оценка: бюджет'],
    ['scorePotential', 'Оценка: потенциал'],
  ].forEach(([k, l]) => {
    m[k] = {
      key: k,
      label: l,
      fmt: (v) => v.toFixed(0),
      group: 'Оценки',
      invert: false,
    };
  });
  return m;
})();
const DEFAULT_PINS = [
  'gdp',
  'outputGap',
  'inflation',
  'unemployment',
  'debtToGdp',
];
const MAX_PINS = 8;

function PinButton({ active, onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        Audio.play('tick');
        onClick();
      }}
      title={
        active ? 'Открепить с верхней полосы' : 'Закрепить в верхнюю полосу'
      }
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        lineHeight: 0,
        color: active ? COLOR.gold : COLOR.faint,
        opacity: active ? 1 : 0.55,
      }}
    >
      <Star size={11} fill={active ? COLOR.gold : 'none'} />
    </button>
  );
}

/* Полоса требований: то, чего от вас прямо сейчас хотят */
function DemandStrip({ botAction, botRole, economy }) {
  const items = [];
  if (economy.mandate)
    items.push({
      who: 'Мандат власти',
      text: `Новое правительство пришло с задачей: ${
        MANDATE_LABEL[economy.mandate] || economy.mandate
      }.`,
      color: COLOR.gold,
    });
  if (botAction && botAction.demand)
    items.push({
      who: botRole === 'central_bank' ? 'Центральный банк' : 'Минфин',
      text: botAction.demand,
      color: COLOR.blue,
    });
  (economy.demands || [])
    .slice(0, 3)
    .forEach((d) =>
      items.push({
        who: d.actor,
        text:
          d.text +
          (d.quartersActive >= 3
            ? ` (${d.quartersActive}-й квартал подряд)`
            : ''),
        color: COLOR.rust,
      })
    );
  if (!items.length) return null;
  return (
    <div
      className="ems-panel ems-fade-in"
      style={{
        padding: '8px 12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 18px',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: COLOR.goldSoft,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <Megaphone size={13} />
        Требования
      </span>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            fontSize: 11.5,
            display: 'flex',
            gap: 5,
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: it.color, fontWeight: 600 }}>{it.who}:</span>
          <span style={{ color: COLOR.muted }}>{it.text}</span>
        </span>
      ))}
    </div>
  );
}

function RiskBadge({ label, value }) {
  const v = clamp(value || 0, 0, 100);
  const color = v >= 65 ? COLOR.rust : v >= 35 ? COLOR.gold : COLOR.teal;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}
    >
      <span style={{ color: COLOR.muted, whiteSpace: 'nowrap' }}>{label}</span>
      <span
        style={{
          width: 46,
          height: 4,
          borderRadius: 2,
          background: COLOR.border,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${v}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
          }}
        />
      </span>
      <span className="ems-mono" style={{ color, fontWeight: 600, width: 18 }}>
        {Math.round(v)}
      </span>
    </div>
  );
}

function DemandsPanel({ demands }) {
  if (!demands || demands.length === 0) return null;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 9,
        }}
      >
        <Users size={14} color={COLOR.gold} />
        <span
          className="ems-serif"
          style={{ fontSize: 13.5, color: COLOR.goldSoft }}
        >
          Общественное давление
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {demands.map((dd) => (
          <div
            key={dd.id}
            style={{
              fontSize: 11.5,
              lineHeight: 1.45,
              borderLeft: `2px solid ${COLOR.rust}`,
              paddingLeft: 9,
            }}
          >
            <span style={{ color: COLOR.rust, fontWeight: 600 }}>
              {dd.actor}:{' '}
            </span>
            <span style={{ color: COLOR.text }}>{dd.text}</span>
            {dd.quartersActive >= 3 && (
              <span style={{ color: COLOR.faint }}>
                {' '}
                ({dd.quartersActive}-й квартал подряд)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ ГЛАВНЫЙ ЭКРАН ============================ */
function GameScreen({
  setup,
  initial,
  onRestart,
  onLoadState,
  theme,
  setTheme,
}) {
  const roleDef = ROLES.find((r) => r.id === setup.role);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  const goalDef = GOALS.find((g) => g.id === setup.goal);
  const botRole = roleDef.botRole;
  const isTrader = setup.role === 'trader';
  const botPersona = null;

  const initEconomy = useMemo(
    () => (initial ? initial.economy : makeInitialEconomy()),
    []
  );
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState(
    initial
      ? initial.history
      : [{ q: 0, label: quarterLabel(1) + ' (старт)', ...initEconomy }]
  );
  const [decisions, setDecisions] = useState(
    initial ? initial.decisions : defaultDecisions(initEconomy)
  );
  const [pendingImpulses, setPendingImpulses] = useState(
    initial ? initial.pendingImpulses || [] : []
  );
  const [eventCooldowns, setEventCooldowns] = useState(
    initial ? initial.eventCooldowns || {} : {}
  );
  const [quarterIndex, setQuarterIndex] = useState(
    initial ? initial.quarterIndex : 1
  );
  const [newsFeed, setNewsFeed] = useState(
    initial ? initial.newsFeed || [] : []
  );
  const [stories, setStories] = useState(initial ? initial.stories || [] : []);
  const [showPaper, setShowPaper] = useState(false);
  const [saveModal, setSaveModal] = useState(null);
  const [view, setView] = useState(setup.role === 'trader' ? 'market' : 'dash');
  const [flashKey, setFlashKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [dense, setDense] = useState(initial ? !!initial.dense : false);
  const [irf, setIrf] = useState(null);
  const [mobileCol, setMobileCol] = useState('center');
  const [narrow, setNarrow] = useState(false);
  const [dashboards, setDashboards] = useState(
    initial && initial.dashboards ? initial.dashboards : DASHBOARD_PRESETS
  );
  const [activeDash, setActiveDash] = useState(
    initial ? initial.activeDash || 'overview' : 'overview'
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) {
      mq.addEventListener('change', upd);
      return () => mq.removeEventListener('change', upd);
    }
    mq.addListener(upd);
    return () => mq.removeListener(upd);
  }, []);
  const [pinned, setPinned] = useState(
    initial && initial.pinned ? initial.pinned : DEFAULT_PINS
  );
  const [pendingRequest, setPendingRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(
    initial ? initial.lastResponse || null : null
  );
  const [botAction2, setBotAction2] = useState(
    initial ? initial.botAction2 || null : null
  );
  const [portfolio, setPortfolio] = useState(
    initial && initial.portfolio ? initial.portfolio : emptyBook()
  );
  const [cbPersonaId, setCbPersonaId] = useState(
    initial && initial.cbPersonaId ? initial.cbPersonaId : setup.cbPersona
  );
  const [mofPersonaId, setMofPersonaId] = useState(
    initial && initial.mofPersonaId ? initial.mofPersonaId : setup.mofPersona
  );
  const [lastReasons, setLastReasons] = useState(
    initial && initial.lastReasons
      ? initial.lastReasons
      : {
          gdpGrowth: [],
          inflation: [],
          exchangeRate: [],
          budget: [],
          unemployment: [],
          banking: [],
          potential: [],
        }
  );
  const [lastReport, setLastReport] = useState(
    initial ? initial.lastReport || '' : ''
  );
  const [botAction, setBotAction] = useState(
    initial ? initial.botAction || null : null
  );
  const [showWhy, setShowWhy] = useState(false);
  const [activeTab, setActiveTab] = useState('economy');
  const [chartGroup, setChartGroup] = useState('output');
  const [hiddenSeries, setHiddenSeries] = useState([]);
  const [period, setPeriod] = useState('5y');
  const [busy, setBusy] = useState(false);

  const activeBotPersona =
    botRole === 'central_bank'
      ? getCbPersona(cbPersonaId)
      : botRole === 'ministry_finance'
      ? getMofPersona(mofPersonaId)
      : null;
  const onTrade = (id, amt, side, live) =>
    setPortfolio((b) => tradeBook(b, id, amt, side, economy, live));
  const prevEcon =
    history.length >= 2 ? history[history.length - 2] : initEconomy;
  const groups = roleDef.groups;
  const levers = LEVERS.filter((l) => groups.includes(l.group)).filter(
    (l) => !l.onlyIf || l.onlyIf(decisions)
  );
  const tabs = useMemo(
    () =>
      botRole && SUMMARY_TABS[botRole]
        ? [...INDICATOR_TABS, SUMMARY_TABS[botRole]]
        : INDICATOR_TABS,
    [botRole]
  );
  const snapshot = () =>
    makeSnapshot({
      setup,
      economy,
      history,
      decisions,
      pendingImpulses,
      eventCooldowns,
      quarterIndex,
      newsFeed,
      stories,
      lastReport,
      lastReasons,
      botAction,
      botAction2,
      pinned,
      cbPersonaId,
      mofPersonaId,
      portfolio,
      lastResponse,
      dense,
      dashboards,
      activeDash,
    });
  const togglePin = (key) =>
    setPinned((ps) =>
      ps.includes(key)
        ? ps.filter((x) => x !== key)
        : ps.length >= MAX_PINS
        ? ps
        : [...ps, key]
    );
  const movePin = (key, dir) =>
    setPinned((ps) => {
      const i = ps.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      next[i] = ps[j];
      next[j] = ps[i];
      return next;
    });
  const applyDash = (id) => {
    const d = dashboards.find((x) => x.id === id);
    if (d) {
      setPinned(d.pins);
      setActiveDash(id);
    }
  };
  const saveDash = () => {
    const name = `Мой набор ${dashboards.filter((d) => d.custom).length + 1}`;
    const id = `custom${Date.now()}`;
    setDashboards((ds) => [
      ...ds,
      { id, name, pins: [...pinned], custom: true },
    ]);
    setActiveDash(id);
  };
  const deleteDash = (id) =>
    setDashboards((ds) => ds.filter((d) => d.id !== id));
  const crisisActive =
    (economy.activeCrises || []).includes('banking') ||
    economy.bankingRisk > 60;

  const finishQuarter = useCallback(() => {
    setBusy(true);
    let eff = { ...decisions };
    const cbAction =
      botRole === 'central_bank' || isTrader
        ? botCentralBank(economy, cbPersonaId, setup.difficulty)
        : null;
    const mofAction =
      botRole === 'ministry_finance' || isTrader
        ? botFinanceMinistry(economy, mofPersonaId, setup.difficulty)
        : null;
    if (cbAction) eff = { ...eff, ...cbAction.decisions };
    if (mofAction) eff = { ...eff, ...mofAction.decisions };
    const action =
      botRole === 'central_bank'
        ? cbAction
        : botRole === 'ministry_finance'
        ? mofAction
        : cbAction;
    // официальный запрос второму ведомству
    let reqResult = null;
    if (pendingRequest && botRole && botRole !== 'both') {
      reqResult = processRequest(
        pendingRequest,
        economy,
        botRole,
        botRole === 'central_bank' ? cbPersonaId : mofPersonaId,
        eff
      );
      if (reqResult) eff = reqResult.decisions;
    }

    const cbStance = clamp(
      (eff.keyRate - economy.inflationExpectations - economy.rStar) / 3,
      -1,
      1
    );
    const mofStance = clamp(
      (eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6 -
        (eff.vatRate -
          economy.vatRate +
          eff.incomeTaxRate -
          economy.incomeTaxRate) *
          0.3,
      -1,
      1
    );

    const result = simulateQuarter({
      economy: {
        ...economy,
        cbStance,
        mofStance,
        policyCoordination: clamp(
          economy.policyCoordination + (reqResult ? reqResult.coordination : 0),
          0,
          100
        ),
      },
      decisions: eff,
      pendingImpulses,
      eventCooldowns,
      difficulty: setup.difficulty,
      quarterIndex,
      stories,
      botAction: action,
    });
    if (reqResult) {
      const who = botRole === 'central_bank' ? 'ЦБ → МИНФИН' : 'МИНФИН → ЦБ';
      result.newsEntries.unshift({
        id: `req${quarterIndex}`,
        cat: 'gov',
        priority: 9,
        q: quarterIndex,
        qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${reqResult.req.label.toUpperCase()} — ${
          reqResult.status === 'accepted'
            ? 'СОГЛАСОВАНО'
            : reqResult.status === 'partial'
            ? 'ЧАСТИЧНО'
            : 'ОТКАЗ'
        }`,
        text: `«${reqResult.req.ask}» ${
          reqResult.text
        } Согласованность политики ${
          reqResult.coordination > 0 ? 'выросла' : 'снизилась'
        } на ${Math.abs(reqResult.coordination)} пункта.`,
      });
      setLastResponse({ status: reqResult.status, text: reqResult.text });
      setPendingRequest(null);
    }
    if (isTrader) {
      setPortfolio((b) => {
        // проценты по плечу списываются в конце квартала
        const margin = b.cash < 0 ? -b.cash : 0;
        const interest = (margin * economy.lendingRate) / 400;
        const cash = b.cash - interest;
        const nb = { ...b, cash };
        const val = bookValue(nb, result.economy, null);
        return { ...nb, history: [...(b.history || []), val].slice(-80) };
      });
    }
    setEconomy(result.economy);
    setHistory((h) => [
      ...h,
      { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy },
    ]);
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setLastReasons(result.reasons);
    setLastReport(result.report);
    setBotAction(action);
    setBotAction2(isTrader ? mofAction : null);
    setStories(result.stories);
    setNewsFeed((f) => [...result.newsEntries, ...f].slice(0, 220));
    // после проигранных выборов новая власть меняет руководство ведомства
    const er = result.economy.electionResult;
    if (er && er !== 'incumbent' && botRole) {
      const changeCb = botRole === 'central_bank' && er === 'landslide';
      const changeMof = botRole === 'ministry_finance';
      if (changeMof) {
        const np = personaAfterElection('ministry_finance', result.economy);
        if (np !== mofPersonaId) {
          setMofPersonaId(np);
          result.newsEntries.unshift({
            id: `pers${quarterIndex}`,
            cat: 'gov',
            priority: 9,
            q: quarterIndex,
            qLabel: quarterLabel(quarterIndex),
            headline: `НОВЫЙ МИНИСТР ФИНАНСОВ: ${getMofPersona(
              np
            ).name.toUpperCase()}`,
            text: `${getMofPersona(np).title}. ${
              getMofPersona(np).desc
            } Вам предстоит работать с другим бюджетом и другой логикой расходов.`,
          });
        }
      }
      if (changeCb) {
        const np = personaAfterElection('central_bank', result.economy);
        if (np !== cbPersonaId) {
          setCbPersonaId(np);
          result.newsEntries.unshift({
            id: `pers${quarterIndex}`,
            cat: 'cb',
            priority: 9,
            q: quarterIndex,
            qLabel: quarterLabel(quarterIndex),
            headline: `СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА: ${getCbPersona(
              np
            ).name.toUpperCase()}`,
            text: `${getCbPersona(np).title}. ${
              getCbPersona(np).desc
            } Смена руководства ЦБ после выборов — всегда вопрос к независимости политики и к тому, чего стоят её обещания.`,
          });
        }
      }
    }
    const newCrisis = (result.economy.activeCrises || []).some(
      (c) => !(economy.activeCrises || []).includes(c)
    );
    if (newCrisis) {
      setFlashKey(quarterIndex);
      setShake(true);
      haptic([45, 70, 45, 70, 90]);
      setTimeout(() => setShake(false), 950);
    } else if (result.economy.regime !== economy.regime) {
      setFlashKey(quarterIndex);
      haptic([28, 60, 28]);
    } else haptic(14);
    Audio.quarterSequence({
      wellbeingDelta: result.economy.wellbeing - economy.wellbeing,
      newCrisis,
      bigNews: result.newsEntries.some((n) => n.priority >= 8),
    });
    setDecisions(defaultDecisions(result.economy, decisions));
    setQuarterIndex((q) => q + 1);
    setBusy(false);
  }, [
    economy,
    decisions,
    pendingImpulses,
    eventCooldowns,
    setup,
    quarterIndex,
    botRole,
    stories,
    cbPersonaId,
    mofPersonaId,
    pendingRequest,
    portfolio,
    isTrader,
  ]);

  const setLever = (id, val) => setDecisions((dd) => ({ ...dd, [id]: val }));

  // музыка следует за режимом экономики и уровнем рисков
  React.useEffect(() => {
    Audio.setMood(economy);
  }, [
    economy.regime,
    economy.inflationRisk,
    economy.bankingRisk,
    economy.debtRisk,
    economy.recessionRisk,
    economy.gdpGrowth,
  ]);
  React.useEffect(() => () => Audio.stopMusic(), []);
  const kpiDelta = (key) => economy[key] - prevEcon[key];
  const shareKey = (id) =>
    id === 'shareHealth'
      ? 'health'
      : id === 'shareEducation'
      ? 'education'
      : id === 'shareScience'
      ? 'science'
      : id === 'shareDefense'
      ? 'defense'
      : 'admin';

  return (
    <div
      className={`ems-root${shake ? ' ems-shake' : ''}${
        dense ? ' ems-dense' : ''
      }`}
      lang="ru"
    >
      <GlobalStyle />
      {irf && (
        <IRFModal
          economy={economy}
          decisions={decisions}
          lever={irf.lever}
          value={irf.value}
          difficulty={setup.difficulty}
          onClose={() => setIrf(null)}
        />
      )}
      <Atmosphere
        regime={economy.regime}
        flashKey={flashKey}
        intensity={clamp(
          (economy.inflationRisk * 0.25 +
            economy.bankingRisk * 0.3 +
            economy.debtRisk * 0.2 +
            economy.recessionRisk * 0.25) /
            100,
          0,
          1
        )}
      />
      {showWhy && (
        <WhyModal reasons={lastReasons} onClose={() => setShowWhy(false)} />
      )}
      {showPaper && (
        <NewspaperModal
          news={newsFeed}
          history={history}
          quarterIndex={quarterIndex}
          onClose={() => setShowPaper(false)}
        />
      )}
      {saveModal && (
        <SaveLoadModal
          mode={saveModal}
          snapshot={snapshot()}
          onClose={() => setSaveModal(null)}
          onLoad={(d) => {
            setSaveModal(null);
            onLoadState(d);
          }}
        />
      )}

      <div
        style={{
          borderTop: `2px solid ${COLOR.gold}`,
          borderBottom: `1px solid ${COLOR.hairline}`,
          background: COLOR.panel,
          padding: '13px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 4,
              background: COLOR.goldDim,
              border: `1px solid ${COLOR.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            <div className="ems-serif" style={{ fontSize: 18 }}>
              Страна — экономическая панель
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              {roleDef.title} · сложность:{' '}
              {
                (DIFFICULTIES.find((x) => x.id === setup.difficulty) || {})
                  .title
              }
              {activeBotPersona
                ? ` · вторая ветвь: ${activeBotPersona.name} (бот)`
                : setup.role === 'trader'
                ? ''
                : ' · без ботов'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: COLOR.muted }}>
              Текущий период
            </div>
            <div
              className="ems-mono ems-serif"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {quarterLabel(quarterIndex)}
            </div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 11,
                color: COLOR.muted,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                justifyContent: 'flex-end',
              }}
            >
              <Flag size={11} />
              Выборы через {economy.quartersToElection} кв.
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              <span style={{ color: COLOR.muted }}>рейтинг власти </span>
              <span
                className="ems-mono"
                style={{
                  color:
                    economy.approval >= 50
                      ? COLOR.teal
                      : economy.approval >= 40
                      ? COLOR.gold
                      : COLOR.rust,
                  fontWeight: 600,
                }}
              >
                {Math.round(economy.approval)}
              </span>
            </div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: COLOR.muted, marginBottom: 2 }}>
              Благополучие
            </div>
            <Gauge value={economy.wellbeing} size={74} />
          </div>
          <div style={{ display: 'flex', gap: 3, marginRight: 4 }}>
            {[
              ['dash', 'Панель', GaugeIcon],
              ['market', 'Рынок', TrendingUp],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                className="ems-btn"
                style={{
                  padding: '7px 11px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: view === id ? COLOR.gold : COLOR.panelAlt,
                  color: view === id ? COLOR.ink : COLOR.text,
                  borderColor: view === id ? COLOR.gold : COLOR.border,
                }}
                onClick={() => {
                  Audio.play('tab');
                  setView(id);
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <button
            className="ems-btn"
            style={{
              padding: '7px 11px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => {
              Audio.play('click');
              setSaveModal('save');
            }}
            title="Сохранить или загрузить партию"
          >
            <Save size={14} />
            Партия
          </button>
          <ViewSettings
            theme={theme}
            setTheme={setTheme}
            dense={dense}
            setDense={setDense}
            dashboards={dashboards}
            activeDash={activeDash}
            applyDash={applyDash}
            saveDash={saveDash}
            deleteDash={deleteDash}
          />
          <AudioControls />
          <button
            className="ems-btn"
            style={{
              padding: '7px 11px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => {
              Audio.play('paper');
              setShowPaper(true);
            }}
            title="Экономический вестник"
          >
            <Newspaper size={14} />
            Газета
          </button>
          <button
            className="ems-btn"
            style={{ padding: '7px 9px' }}
            onClick={onRestart}
            title="Начать заново"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <CrisisBar economy={economy} botAction={botAction} />

      <div style={{ padding: '14px 18px 4px' }}>
        <div className="ems-kpi-strip">
          {pinned.map((key) => {
            const m = ALL_METRICS[key];
            if (!m) return null;
            const val = economy[key];
            return (
              <div key={key} style={{ position: 'relative' }}>
                <KpiTile
                  label={m.label}
                  value={Number.isFinite(val) ? m.fmt(val) : '—'}
                  delta={kpiDelta(key)}
                  invert={m.invert}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                  }}
                >
                  <button
                    onClick={() => {
                      Audio.play('tick');
                      movePin(key, -1);
                    }}
                    aria-label="Левее"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: COLOR.faint,
                      padding: 1,
                      lineHeight: 0,
                      fontSize: 10,
                    }}
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => {
                      Audio.play('tick');
                      movePin(key, 1);
                    }}
                    aria-label="Правее"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: COLOR.faint,
                      padding: 1,
                      lineHeight: 0,
                      fontSize: 10,
                    }}
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => {
                      Audio.play('tick');
                      togglePin(key);
                    }}
                    aria-label={`Убрать ${m.label} с полосы`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: COLOR.faint,
                      padding: 1,
                      lineHeight: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          {pinned.length < MAX_PINS && (
            <div
              className="ems-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 10,
                borderStyle: 'dashed',
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  color: COLOR.faint,
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                <Star size={12} style={{ verticalAlign: -2 }} /> закрепите любой
                показатель
                <br />
                звёздочкой в таблице справа
              </span>
            </div>
          )}
        </div>
        <div
          className="ems-panel"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 20px',
            marginTop: 10,
            padding: '9px 13px',
          }}
        >
          <RiskBadge label="Инфляционный" value={economy.inflationRisk} />
          <RiskBadge label="Банковский" value={economy.bankingRisk} />
          <RiskBadge label="Долговой" value={economy.debtRisk} />
          <RiskBadge label="Рецессии" value={economy.recessionRisk} />
          <RiskBadge label="Валютный" value={economy.currencyRisk} />
        </div>
      </div>

      <div
        style={{
          margin: '10px 18px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <DemandStrip
          botAction={botAction}
          botRole={botRole}
          economy={economy}
        />
        <RegimeBanner economy={economy} />
        {(economy.activeCrises || [])
          .filter((c) => c !== economy.regime)
          .map((c) => (
            <div
              key={c}
              className="ems-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: COLOR.rustDim,
                border: `1px solid ${COLOR.rust}`,
                borderRadius: 3,
                padding: '8px 11px',
                fontSize: 12,
              }}
            >
              <AlertTriangle
                size={15}
                color={COLOR.rust}
                style={{ flexShrink: 0 }}
              />
              <span>
                <b style={{ color: COLOR.rust }}>
                  {CRISIS_INFO[c] ? CRISIS_INFO[c].label : c}.
                </b>{' '}
                <span style={{ color: COLOR.muted }}>
                  {CRISIS_INFO[c] ? CRISIS_INFO[c].text : ''}
                </span>
              </span>
            </div>
          ))}
      </div>

      {view === 'market' && (
        <MarketScreen
          economy={economy}
          prev={prevEcon}
          history={history}
          book={isTrader ? portfolio : null}
          onTrade={onTrade}
        />
      )}

      {narrow && view === 'dash' && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
          {[
            ['left', setup.role === 'trader' ? 'Капитал' : 'Решения'],
            ['center', 'Новости и графики'],
            ['right', 'Показатели'],
          ].map(([id, label]) => (
            <button
              key={id}
              className="ems-btn"
              style={{
                flex: 1,
                padding: '8px 0',
                fontSize: 11.5,
                background: mobileCol === id ? COLOR.gold : COLOR.panelAlt,
                color: mobileCol === id ? COLOR.ink : COLOR.text,
                borderColor: mobileCol === id ? COLOR.gold : COLOR.border,
              }}
              onClick={() => {
                Audio.play('tab');
                setMobileCol(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className="ems-grid"
        style={{ padding: 18, display: view === 'dash' ? undefined : 'none' }}
      >
        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div
          className={narrow && mobileCol !== 'left' ? 'ems-col-hidden' : ''}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {isTrader && (
            <PortfolioSummary
              book={portfolio}
              economy={economy}
              live={null}
              prevValue={
                portfolio.history && portfolio.history.length > 1
                  ? portfolio.history[portfolio.history.length - 2]
                  : null
              }
            />
          )}
          {isTrader && (
            <div
              className="ems-panel"
              style={{
                padding: 12,
                fontSize: 11.5,
                color: COLOR.muted,
                lineHeight: 1.5,
              }}
            >
              Торговля идёт на вкладке{' '}
              <b style={{ color: COLOR.text }}>«Рынок»</b>: там терминал с
              ценами, которые меняются в реальном времени. Сделки исполняются
              мгновенно по текущей котировке, плечо ограничено 60% капитала и
              стоит ставку по кредитам.
            </div>
          )}
          {!isTrader && (
            <div className="ems-panel" style={{ padding: 14 }}>
              <div
                className="ems-serif"
                style={{
                  fontSize: 14,
                  color: COLOR.goldSoft,
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <RoleIcon size={14} />
                Ваши полномочия
              </div>
              <div
                style={{ fontSize: 11, color: COLOR.muted, marginBottom: 10 }}
              >
                Приоритет: {goalDef.label}
              </div>

              {groups.includes('monetary') && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: COLOR.blue,
                      marginBottom: 3,
                      fontWeight: 600,
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 5,
                    }}
                  >
                    Денежно-кредитная политика
                  </div>
                  {levers
                    .filter(
                      (l) => l.group === 'monetary' && l.subgroup === 'core'
                    )
                    .map((l) => (
                      <LeverSlider
                        key={l.id}
                        lever={scaleLever(l, economy)}
                        currentDisplay={economy[l.id]}
                        value={decisions[l.id]}
                        onChange={(v) => setLever(l.id, v)}
                        onIRF={(lv, val) => setIrf({ lever: lv, value: val })}
                        preview={leverPreview(
                          l.id,
                          decisions[l.id],
                          economy,
                          setup.difficulty
                        )}
                      />
                    ))}
                  <Segmented
                    label="Режим валютного курса"
                    options={FX_REGIMES}
                    value={decisions.fxRegime}
                    onChange={(v) => setLever('fxRegime', v)}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: COLOR.blue,
                      margin: '12px 0 3px',
                      fontWeight: 600,
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 5,
                    }}
                  >
                    Макропруденциальная политика
                  </div>
                  {levers
                    .filter(
                      (l) => l.group === 'monetary' && l.subgroup === 'macropru'
                    )
                    .map((l) => (
                      <LeverSlider
                        key={l.id}
                        lever={scaleLever(l, economy)}
                        currentDisplay={economy[l.id]}
                        value={decisions[l.id]}
                        onChange={(v) => setLever(l.id, v)}
                        onIRF={(lv, val) => setIrf({ lever: lv, value: val })}
                        preview={leverPreview(
                          l.id,
                          decisions[l.id],
                          economy,
                          setup.difficulty
                        )}
                      />
                    ))}
                  {crisisActive && (
                    <div style={{ padding: '10px 0' }}>
                      <button
                        className="ems-btn"
                        style={{
                          width: '100%',
                          background: decisions.emergency
                            ? COLOR.rust
                            : COLOR.panelAlt,
                          color: decisions.emergency ? '#fff' : COLOR.text,
                          borderColor: COLOR.rust,
                        }}
                        onClick={() => {
                          Audio.play(decisions.emergency ? 'click' : 'alarm');
                          setLever('emergency', !decisions.emergency);
                        }}
                      >
                        {decisions.emergency ? (
                          <Check size={13} style={{ verticalAlign: -2 }} />
                        ) : (
                          <ShieldAlert
                            size={13}
                            style={{ verticalAlign: -2 }}
                          />
                        )}{' '}
                        Экстренная поддержка банков
                      </button>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: COLOR.faint,
                          marginTop: 5,
                          lineHeight: 1.4,
                        }}
                      >
                        Спасёт капитал банков, но ударит по доверию к ЦБ и
                        добавит инфляции.
                      </div>
                    </div>
                  )}
                </div>
              )}
              {groups.includes('fiscal') && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: COLOR.blue,
                      marginBottom: 3,
                      fontWeight: 600,
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 5,
                    }}
                  >
                    Расходы
                  </div>
                  {levers
                    .filter(
                      (l) => l.group === 'fiscal' && l.subgroup === 'core'
                    )
                    .map((l) => (
                      <LeverSlider
                        key={l.id}
                        lever={scaleLever(l, economy)}
                        currentDisplay={economy[l.id]}
                        value={decisions[l.id]}
                        onChange={(v) => setLever(l.id, v)}
                        onIRF={(lv, val) => setIrf({ lever: lv, value: val })}
                        preview={leverPreview(
                          l.id,
                          decisions[l.id],
                          economy,
                          setup.difficulty
                        )}
                      />
                    ))}
                  <div
                    style={{
                      fontSize: 11,
                      color: COLOR.blue,
                      margin: '12px 0 3px',
                      fontWeight: 600,
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 5,
                    }}
                  >
                    Налоги
                  </div>
                  {levers
                    .filter(
                      (l) => l.group === 'fiscal' && l.subgroup === 'taxes'
                    )
                    .map((l) => (
                      <LeverSlider
                        key={l.id}
                        lever={scaleLever(l, economy)}
                        currentDisplay={economy[l.id]}
                        value={decisions[l.id]}
                        onChange={(v) => setLever(l.id, v)}
                        onIRF={(lv, val) => setIrf({ lever: lv, value: val })}
                        preview={leverPreview(
                          l.id,
                          decisions[l.id],
                          economy,
                          setup.difficulty
                        )}
                      />
                    ))}
                  <div
                    style={{
                      fontSize: 11,
                      color: COLOR.blue,
                      margin: '12px 0 3px',
                      fontWeight: 600,
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 5,
                    }}
                  >
                    Статьи бюджета
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: COLOR.faint,
                      margin: '2px 0',
                      lineHeight: 1.4,
                    }}
                  >
                    Доли нормализуются к 100%. Образование и здравоохранение
                    растят человеческий капитал, наука — производительность.
                    Эффект — годы, не кварталы.
                  </div>
                  {levers
                    .filter(
                      (l) => l.group === 'fiscal' && l.subgroup === 'budget'
                    )
                    .map((l) => (
                      <LeverSlider
                        key={l.id}
                        lever={l}
                        currentDisplay={economy.budgetShares[shareKey(l.id)]}
                        value={decisions[l.id]}
                        onChange={(v) => setLever(l.id, v)}
                        preview={leverPreview(
                          l.id,
                          decisions[l.id],
                          economy,
                          setup.difficulty
                        )}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
          <RequestPanel
            role={setup.role}
            botRole={botRole}
            pending={pendingRequest}
            setPending={setPendingRequest}
            lastResponse={lastResponse}
          />
          {groups.includes('fiscal') && (
            <FiscalMath economy={economy} decisions={decisions} />
          )}
          {isTrader ? (
            <>
              <BotPanel
                botRole="central_bank"
                persona={getCbPersona(cbPersonaId)}
                lastAction={botAction}
                economy={economy}
                coordination={economy.policyCoordination}
              />
              <BotPanel
                botRole="ministry_finance"
                persona={getMofPersona(mofPersonaId)}
                lastAction={botAction2}
                economy={economy}
                coordination={economy.policyCoordination}
              />
            </>
          ) : (
            <BotPanel
              botRole={botRole}
              persona={activeBotPersona}
              lastAction={botAction}
              economy={economy}
              coordination={economy.policyCoordination}
            />
          )}
        </div>

        {/* ЦЕНТР */}
        <div
          className={narrow && mobileCol !== 'center' ? 'ems-col-hidden' : ''}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minWidth: 0,
          }}
        >
          <NewsTerminal
            items={newsFeed}
            onOpenPaper={() => setShowPaper(true)}
          />
          <ChartPanel
            history={history}
            chartGroup={chartGroup}
            setChartGroup={setChartGroup}
            hiddenSeries={hiddenSeries}
            setHiddenSeries={setHiddenSeries}
            period={period}
            setPeriod={setPeriod}
          />
          <div className="ems-panel" style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <span
                className="ems-serif"
                style={{ fontSize: 14, color: COLOR.goldSoft }}
              >
                Квартальный отчёт
              </span>
              {lastReport && (
                <button
                  className="ems-btn"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                  onClick={() => {
                    Audio.play('click');
                    setShowWhy(true);
                  }}
                >
                  <Info
                    size={12}
                    style={{ verticalAlign: -2, marginRight: 4 }}
                  />
                  Почему это произошло?
                </button>
              )}
            </div>
            <div
              style={{
                background: COLOR.panelAlt,
                color: COLOR.text,
                padding: '15px 17px',
                borderRadius: 2,
                border: `1px solid ${COLOR.border}`,
                borderLeft: `2px solid ${COLOR.gold}`,
              }}
            >
              {lastReport ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      borderBottom: `1px solid ${COLOR.hairline}`,
                      paddingBottom: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      className="ems-serif"
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLOR.goldSoft,
                      }}
                    >
                      {history[history.length - 1].label}
                    </span>
                    <span
                      className="ems-mono"
                      style={{ fontSize: 10, color: COLOR.faint }}
                    >
                      бюллетень · {roleDef.short}
                    </span>
                  </div>
                  <div
                    className="ems-serif"
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      color: COLOR.text,
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    {lastReport}
                  </div>
                </>
              ) : (
                <div
                  className="ems-serif"
                  style={{ fontSize: 12.5, color: COLOR.muted }}
                >
                  Настройте политику слева и завершите первый квартал. Помните:
                  между решением и результатом стоит цепочка — ставка меняет
                  стоимость кредита, кредит меняет спрос, спрос меняет цены.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <div
          className={narrow && mobileCol !== 'right' ? 'ems-col-hidden' : ''}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <ScorePanel economy={economy} prev={prevEcon} goalDef={goalDef} />
          <div className="ems-panel" style={{ padding: 14 }}>
            <div
              className="ems-serif"
              style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 9 }}
            >
              Показатели экономики
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                marginBottom: 11,
              }}
              className="ems-scroll"
            >
              {tabs.map((t) => {
                const TabIcon = t.icon;
                return (
                  <span
                    key={t.id}
                    className={`ems-tab ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => {
                      Audio.play('tab');
                      setActiveTab(t.id);
                    }}
                  >
                    {TabIcon && <TabIcon size={12} />}
                    {t.label}
                  </span>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(tabs.find((t) => t.id === activeTab) || tabs[0]).rows.map(
                (row, i, arr) => {
                  const val = row.get ? row.get(economy) : economy[row.key];
                  const prevVal = row.get
                    ? row.get(prevEcon)
                    : prevEcon[row.key];
                  const delta =
                    Number.isFinite(prevVal) && Number.isFinite(val)
                      ? val - prevVal
                      : 0;
                  if (row.text) {
                    return (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          padding: '6px 0',
                          borderBottom:
                            i < arr.length - 1
                              ? `1px solid ${COLOR.hairline}`
                              : 'none',
                        }}
                      >
                        <span style={{ color: COLOR.muted }}>{row.label}</span>
                        <span className="ems-mono">
                          {(row.map && row.map[val]) || String(val || '—')}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={row.label || row.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        padding: '6px 0',
                        borderBottom:
                          i < arr.length - 1
                            ? `1px solid ${COLOR.hairline}`
                            : 'none',
                      }}
                    >
                      <span
                        style={{
                          color: COLOR.muted,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {ALL_METRICS[row.key] && (
                          <PinButton
                            active={pinned.includes(row.key)}
                            onClick={() => togglePin(row.key)}
                          />
                        )}
                        {row.label}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span className="ems-mono">
                          {Number.isFinite(val) ? row.fmt(val) : '—'}
                        </span>
                        {row.noDelta ? (
                          <span style={{ width: 34 }} />
                        ) : (
                          <DeltaTag
                            value={delta}
                            invert={METRIC_INVERT.has(row.key)}
                          />
                        )}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
          <DemandsPanel demands={economy.demands} />
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${COLOR.hairline}`,
          background: COLOR.panel,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          position: 'sticky',
          bottom: 0,
        }}
      >
        <span
          style={{ fontSize: 11.5, color: COLOR.faint, marginRight: 'auto' }}
        >
          {botRole
            ? `${
                botRole === 'central_bank' ? 'Центральный банк' : 'Минфин'
              } примет своё решение одновременно с вами`
            : 'Обе ветви политики под вашим контролем'}
        </span>
        <button
          className="ems-btn primary"
          style={{ padding: '12px 26px', fontSize: 13.5 }}
          disabled={busy}
          onClick={finishQuarter}
          aria-label="Завершить квартал и применить решения"
        >
          {busy ? 'Обработка…' : 'Завершить квартал'}
        </button>
      </div>
    </div>
  );
}

export default function MacroSimulator() {
  const [setup, setSetup] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [theme, setThemeState] = useState('ink');
  applyTheme(theme);
  const setTheme = (id) => {
    applyTheme(id);
    setThemeState(id);
  };
  const startLoaded = (data) => {
    setLoaded(data);
    setSetup(data.setup);
    setNonce((n) => n + 1);
  };
  if (!setup)
    return (
      <SetupScreen
        key={theme}
        onStart={(x) => {
          setLoaded(null);
          setSetup(x);
        }}
        onLoad={startLoaded}
      />
    );
  return (
    <GameScreen
      key={`${JSON.stringify(setup)}:${nonce}:${theme}`}
      setup={setup}
      initial={loaded}
      theme={theme}
      setTheme={setTheme}
      onRestart={() => {
        setLoaded(null);
        setSetup(null);
      }}
      onLoadState={startLoaded}
    />
  );
}
