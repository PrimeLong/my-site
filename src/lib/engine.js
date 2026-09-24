import { clamp, ROLES, quarterLabel, CONFIG, romanQ, POLITICAL_REGIME_INFO, GOALS, DIFFICULTIES, SCENARIOS, PRESIDENT_PERSONAS, MOF_PERSONAS, CB_PERSONAS, rng } from './catalog.js';


/* ============================ УТИЛИТЫ ============================ */
let __uid = 1;
const uid = () => `x${__uid++}`;
const QUARTERS_PER_YEAR = 4;
const annualToQuarterlyFactor = (annualPct) => Math.pow(1 + annualPct / 100, 1 / QUARTERS_PER_YEAR);
const applyAnnualGrowth = (value, annualPct) => value * annualToQuarterlyFactor(annualPct);
const annualizedGrowth = (from, to) => (from > 0 && Number.isFinite(from) && Number.isFinite(to))
  ? (Math.pow(Math.max(to, 1e-9) / from, QUARTERS_PER_YEAR) - 1) * 100
  : 0;
const applyNominalGrowth = (value, realAnnualPct, inflationAnnualPct) =>
  value * annualToQuarterlyFactor(realAnnualPct) * annualToQuarterlyFactor(inflationAnnualPct);
const gauss = (sigma) => sigma * ((rng() + rng() + rng() - 1.5) / 1.5);
const sign = (v) => (v > 0.0001 ? 1 : v < -0.0001 ? -1 : 0);
const ema = (prev, next, w) => prev * (1 - w) + next * w;
/* Насыщающийся отклик: при малом x ведёт себя как slope·x, а при большом
   упирается в потолок slope·scale. Для реакций людей, которые растут быстро,
   но не бесконечно (недовольство ценами, напряжение). */
const saturating = (x, slope, scale) => slope * scale * (1 - Math.exp(-Math.max(0, x) / scale));

const fmt1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const fmtSigned1 = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(1) : '—');
const pctFmt = (v) => `${fmt1(v)}%`;
const fmtSignedPct = (v) => `${fmtSigned1(v)}%`;
/* Единица растёт вместе с суммой. Раньше шкала обрывалась на триллионах, и
   длинная партия с высокой инфляцией показывала «6512258.68 трлн» — число,
   которое невозможно прочитать. */
const MONEY_UNITS = [
  [1e9, 'секстлн'], [1e6, 'квинтлн'], [1e3, 'квадрлн'], [1, 'трлн'],
];
const fmtMoney = (bn) => {
  if (!Number.isFinite(bn)) return '—';
  const abs = Math.abs(bn);
  if (abs < 1000) return `${bn.toFixed(0)} млрд`;
  const trn = bn / 1000;
  const unit = MONEY_UNITS.find(([min]) => Math.abs(trn) >= min) || MONEY_UNITS[MONEY_UNITS.length - 1];
  return `${(trn / unit[0]).toFixed(2)} ${unit[1]}`;
};
const fmtMoneySigned = (bn) => (bn >= 0 ? '+' : '') + fmtMoney(bn);
/* Биржевой индекс номинальный: он растёт вместе с номинальным ВВП и за долгую
   партию с высокой инфляцией честно уходит в миллионы пунктов — как и реальные
   индексы стран, переживших гиперинфляцию. Читать «8374980.7» невозможно,
   поэтому крупные значения сокращаются до тыс./млн пунктов. */
const fmtIndex = (v) => {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} млн`;
  if (abs >= 1e4) return `${(v / 1e3).toFixed(1)} тыс.`;
  return v.toFixed(1);
};
/* Деньги трейдера считаются в миллионах — но показывать «6118.42 млн» вместо
   «6.12 млрд» нельзя: единица должна расти вместе с капиталом. mlnScale отдаёт
   число и единицу по отдельности для мест, где единица набрана своим стилем. */
const mlnScale = (mln) => {
  if (!Number.isFinite(mln)) return { v: '—', unit: '' };
  const abs = Math.abs(mln);
  if (abs >= 1e6) return { v: (mln / 1e6).toFixed(2), unit: 'трлн' };
  if (abs >= 1000) return { v: (mln / 1000).toFixed(2), unit: 'млрд' };
  return { v: mln.toFixed(2), unit: 'млн' };
};
const fmtMln = (mln) => { const s = mlnScale(mln); return s.unit ? `${s.v} ${s.unit}` : s.v; };
const fmtMlnSigned = (mln) => ((Number.isFinite(mln) && mln >= 0 ? '+' : '') + fmtMln(mln));

const FX_REGIMES = [
  { id: 'free', label: 'Плавающий', hint: 'Курс определяется платёжным балансом. Резервы не тратятся, но инфляция импортируется быстрее.' },
  { id: 'managed', label: 'Управляемый', hint: 'ЦБ гасит половину давления интервенциями. Умеренный расход резервов.' },
  { id: 'peg', label: 'Фиксированный', hint: 'Курс удерживается почти жёстко. При исчерпании резервов — срыв и девальвация.' },
];

const LEVERS = [
  { id: 'keyRate', group: 'monetary', subgroup: 'core', label: 'Ключевая ставка', suffix: '%', min: 0, max: 25, step: 0.25, type: 'level' },
  { id: 'inflationTarget', group: 'monetary', subgroup: 'core', label: 'Цель по инфляции', suffix: '%', min: 1, max: 12, step: 0.25, type: 'level', hint: 'Смена цели стоит доверия: ожидания перестают верить объявленной цифре' },
  { id: 'reserveReq', group: 'monetary', subgroup: 'core', label: 'Норма резервирования', suffix: '%', min: 0, max: 20, step: 0.5, type: 'level' },
  { id: 'capitalRequirement', group: 'monetary', subgroup: 'macropru', label: 'Требование к капиталу банков', suffix: '%', min: 8, max: 18, step: 0.5, type: 'level', hint: 'Макропруденциальный норматив: выше — меньше кредитный бум, но и меньше кредита' },
  { id: 'moneySupplyOp', group: 'monetary', subgroup: 'core', label: 'Операции с денежной массой', suffix: '%', min: -10, max: 10, step: 0.5, type: 'flow', hint: 'QE (+) / QT (−) за квартал' },
  { id: 'fxIntervention', group: 'monetary', subgroup: 'core', label: 'Валютные интервенции', suffix: ' млрд', min: -25, max: 25, step: 1, type: 'flow', scale: 'gdp', hint: 'Покупка валюты (+) ослабляет нацвалюту, продажа (−) укрепляет и тратит резервы' },
  { id: 'liquidity', group: 'monetary', subgroup: 'core', label: 'Управление ликвидностью банков', suffix: ' млрд', min: -20, max: 20, step: 1, type: 'flow', scale: 'gdp', hint: 'Инъекция (+) / изъятие (−)' },
  { id: 'fxTarget', group: 'monetary', subgroup: 'core', label: 'Целевой уровень курса', suffix: '', min: 40, max: 400, step: 1, type: 'level', onlyIf: (d) => d.fxRegime !== 'free', hint: 'Ориентир, который ЦБ защищает интервенциями. Выше — слабее нацвалюта' },

  { id: 'incomeTaxRate', group: 'fiscal', subgroup: 'taxes', label: 'Подоходный налог', suffix: '%', min: 0, max: 45, step: 0.5, type: 'level' },
  { id: 'socialContribRate', group: 'fiscal', subgroup: 'taxes', label: 'Социальные взносы', suffix: '%', min: 0, max: 40, step: 0.5, type: 'level' },
  { id: 'profitTaxRate', group: 'fiscal', subgroup: 'taxes', label: 'Налог на прибыль', suffix: '%', min: 0, max: 45, step: 0.5, type: 'level' },
  { id: 'vatRate', group: 'fiscal', subgroup: 'taxes', label: 'НДС', suffix: '%', min: 0, max: 30, step: 0.5, type: 'level' },
  { id: 'exciseRate', group: 'fiscal', subgroup: 'taxes', label: 'Акцизы', suffix: '%', min: 0, max: 25, step: 0.5, type: 'level' },
  { id: 'capitalTaxRate', group: 'fiscal', subgroup: 'taxes', label: 'Налог на капитал', suffix: '%', min: 0, max: 35, step: 0.5, type: 'level' },

  /* Три бюджетных потока ходят в одних и тех же пределах ±15% за квартал — и у
     игрока, и у бота-Минфина (он режется по тем же границам через clampToLever).
     Раньше у закупок было ±10%, у выплат ±12%, у инвестиций ±15%: разные потолки
     у рычагов одного смысла выглядели случайными. */
  { id: 'govSpending', group: 'fiscal', subgroup: 'core', label: 'Госзакупки и содержание государства', suffix: '%', min: -15, max: 15, step: 0.5, type: 'flow', persistent: true, hint: 'Реальный темп роста — действует, пока не измените' },
  { id: 'transfers', group: 'fiscal', subgroup: 'core', label: 'Социальные выплаты', suffix: '%', min: -15, max: 15, step: 0.5, type: 'flow', persistent: true, hint: 'Реальный темп роста — сильный эффект в кризис, слабый при перегреве' },
  { id: 'govInvestment', group: 'fiscal', subgroup: 'core', label: 'Госинвестиции в инфраструктуру', suffix: '%', min: -15, max: 15, step: 0.5, type: 'flow', persistent: true, hint: 'Единственный расход, повышающий потенциальный ВВП' },

  { id: 'bondIssuance', group: 'fiscal', subgroup: 'debt', label: 'Размещение облигаций', suffix: ' млрд', min: 0, max: 60, step: 5, type: 'flow', scale: 'gdp',
    hint: 'Занять сверх того, что нужно для покрытия дефицита — долг растёт сразу, деньги идут в резерв' },

  { id: 'shareHealth', group: 'fiscal', subgroup: 'budget', label: 'Здравоохранение', suffix: '%', min: 5, max: 40, step: 1, type: 'level', hint: 'Доля госзакупок' },
  { id: 'shareEducation', group: 'fiscal', subgroup: 'budget', label: 'Образование', suffix: '%', min: 5, max: 40, step: 1, type: 'level', hint: 'Долгосрочно — человеческий капитал' },
  { id: 'shareScience', group: 'fiscal', subgroup: 'budget', label: 'Наука и НИОКР', suffix: '%', min: 0, max: 20, step: 1, type: 'level', hint: 'Долгосрочно — производительность (TFP)' },
  { id: 'shareDefense', group: 'fiscal', subgroup: 'budget', label: 'Оборона', suffix: '%', min: 2, max: 40, step: 1, type: 'level' },
  { id: 'shareAdmin', group: 'fiscal', subgroup: 'budget', label: 'Госаппарат', suffix: '%', min: 2, max: 30, step: 1, type: 'level' },
];
const LEVER_BY_ID = Object.fromEntries(LEVERS.map((l) => [l.id, l]));
// границы рычага без поправки на экономику — для потоков, у которых они постоянны
const clampToLeverRange = (id, v) => clamp(v, LEVER_BY_ID[id].min, LEVER_BY_ID[id].max);

/* Часть ползунков не статична: рычаги в миллиардах растут вместе с экономикой
   (10 млрд при ВВП 100 трлн — не тот же инструмент, что при ВВП 1 000 трлн),
   а курсовой ориентир имеет смысл только вокруг текущего курса. Это правило
   живёт здесь, а не в интерфейсе, потому что «что доступно игроку» обязаны
   знать трое: сам интерфейс, боты и тесты. */
/* Потолок ключевой ставки. 25% хватает, пока инфляция однозначная, но в
   сценарии «Гиперинфляция» партия начиналась при инфляции 34% и ставке 24%:
   реальная ставка не могла стать положительной ни у бота, ни у игрока, и
   инфляция стояла на 30+% четыре года подряд, пока напряжение не сносило
   демократию. Настоящие ЦБ в таких эпизодах поднимали ставку до 40–100%.
   Поэтому потолок растёт вместе с инфляцией и ожиданиями — с запасом в
   15 п.п. сверху — и возвращается к 25%, когда цены успокоятся. */
const KEY_RATE_BASE_MAX = 25;
function keyRateCap(e) {
  if (!e) return KEY_RATE_BASE_MAX;
  const pressure = Math.max(e.inflation || 0, e.inflationExpectations || 0);
  return Math.max(KEY_RATE_BASE_MAX, Math.ceil((pressure + 15) / 5) * 5);
}

export function scaleLever(l, e) {
  if (l.id === 'keyRate') return { ...l, max: keyRateCap(e) };
  if (l.scale === 'gdp') {
    const k = Math.max(1, e.nominalGdp / CONFIG.initial.gdp);
    const mag = Math.max(5, Math.round(l.max * k / 5) * 5);
    // рычаг с исходным минимумом 0 (например, размещение облигаций — занять
    // можно только неотрицательную сумму) должен и после масштабирования
    // остаться неотрицательным, а не зеркалиться в минус вслед за симметричными
    // рычагами вроде валютных интервенций
    return { ...l, min: l.min < 0 ? -mag : 0, max: mag, step: Math.max(1, Math.round(mag / 25)) };
  }
  if (l.id === 'fxTarget') {
    const cur = e.exchangeRate;
    return { ...l, min: Math.round(cur * 0.6), max: Math.round(cur * 1.6), step: 0.5 };
  }
  return l;
}

/* Бот управляет теми же рычагами и в тех же пределах, что и игрок: ни шага
   мельче, ни значения за границей ползунка. Иначе со стороны игрока это
   выглядит как «Минфину можно то, чего нельзя мне» — и это была правда для
   налогов, которые бот двигал долями десятой процента. Экономика передаётся,
   чтобы границы совпадали с теми, что игрок видит на экране именно сейчас. */
const clampToLever = (id, v, e) => {
  const base = LEVER_BY_ID[id];
  if (!base || !Number.isFinite(v)) return v;
  const l = e ? scaleLever(base, e) : base;
  return clamp(roundTo(v, l.step), l.min, l.max);
};

const UNCERTAINTY = {
  keyRate: 'средняя', reserveReq: 'средняя', capitalRequirement: 'средняя', moneySupplyOp: 'высокая',
  fxIntervention: 'средняя', liquidity: 'средняя', incomeTaxRate: 'средняя', profitTaxRate: 'высокая',
  vatRate: 'низкая', exciseRate: 'низкая', capitalTaxRate: 'высокая', socialContribRate: 'средняя',
  govSpending: 'низкая', transfers: 'низкая', govInvestment: 'высокая', bondIssuance: 'низкая',
  shareHealth: 'высокая', shareEducation: 'высокая', shareScience: 'высокая', shareDefense: 'низкая', shareAdmin: 'низкая',
};

function defaultDecisions(state, prevDecisions) {
  return {
    keyRate: state.keyRate, reserveReq: state.reserveReq, capitalRequirement: state.capitalRequirement,
    moneySupplyOp: 0, fxIntervention: 0, liquidity: 0, bondIssuance: 0, fxRegime: state.fxRegime, emergency: false, sovereignDefault: false, imfProgram: false, pressAnswer: null,
    startProject: null, regionResponse: null, warOrder: null, campaignPlan: null, integrate: null, treaty: null, groupResponse: null, diplomacy: null, warTarget: null,
    inflationTarget: state.inflationTarget, fxTarget: state.fxTarget,
    incomeTaxRate: state.incomeTaxRate, profitTaxRate: state.profitTaxRate, vatRate: state.vatRate,
    exciseRate: state.exciseRate, capitalTaxRate: state.capitalTaxRate, socialContribRate: state.socialContribRate,
    govSpending: prevDecisions ? prevDecisions.govSpending : 0,
    transfers: prevDecisions ? prevDecisions.transfers : 0,
    govInvestment: prevDecisions ? prevDecisions.govInvestment : 0,
    shareHealth: state.budgetShares.health, shareEducation: state.budgetShares.education,
    shareScience: state.budgetShares.science, shareDefense: state.budgetShares.defense,
    shareAdmin: state.budgetShares.admin,
  };
}

const getCbPersona = (id) => CB_PERSONAS.find((p) => p.id === id) || CB_PERSONAS[1];
// какой характер получает ведомство, назначенное новой властью
function personaAfterElection(kind, economy) {
  const line = economy.governmentLine || 'centrist';
  if (kind === 'ministry_finance') return line === 'populist' ? 'populist' : line === 'austerity' ? 'austerity' : 'technocrat';
  return line === 'populist' ? 'dove' : line === 'austerity' ? 'hawk' : 'pragmatic';
}
const MANDATE_LABEL = { jobs: 'занятость любой ценой', prices: 'обуздать цены', budget: 'привести бюджет в порядок', growth: 'вернуть рост' };
const getMofPersona = (id) => MOF_PERSONAS.find((p) => p.id === id) || MOF_PERSONAS[0];

// Бот-ЦБ: правило Тейлора вокруг нейтральной ставки + макропруденциальная и кризисная реакция
const roundTo = (v, step) => Math.round(v / step) * step;

/* Идёт ли борьба с высокой инфляцией — то же условие, при котором движок
   включает доверие к стабилизационной программе (см. simulateQuarter). Боты
   должны видеть то же, что и движок: без этого ЦБ-бот сдвигал ставку на
   1,25–1,75 п.п. за квартал и не успевал довести реальную ставку до +3 п.п.,
   пока держался мандат спасения, — игрок за Минфин или президент в
   «Гиперинфляции» проигрывал 6 партий из 6 при любом характере ЦБ. */
function stabilizationNeeded(s) {
  const tgt = Number.isFinite(s.inflationTarget) ? s.inflationTarget : CONFIG.target.inflation;
  const running = (s.stabilizationCred || 0) > 0.05;
  return s.inflation >= tgt + 8 || (running && s.inflation > tgt + 2);
}
/* Как характер ЦБ ведёт себя в стабилизации: какую реальную ставку держит и
   как быстро к ней идёт. Ястреб прыгает сразу, голубь тянет — но даже голубь
   понимает, что при бегстве от денег постепенность не работает. */
const CB_STABILIZATION = {
  hawk: { margin: 5, step: 12, cut: 4 },
  pragmatic: { margin: 3.5, step: 7, cut: 6 },
  dove: { margin: 3, step: 3.5, cut: 8 },
};
function botCentralBank(s, personaId, _difficulty) {
  const P = getCbPersona(personaId);
  const cbTarget = Number.isFinite(s.inflationTarget) ? s.inflationTarget : CONFIG.target.inflation;
  const inflGap = s.inflation - cbTarget;
  // санкции разгоняют инфляцию через подорожавший импорт (издержки), а не через
  // спрос — такой всплеск ставкой не лечится, и вменяемый ЦБ временно смотрит
  // сквозь часть отклонения вместо того, чтобы душить экономику ради разового шока
  const sanctionsTolerance = (s.sanctionsQuartersLeft || 0) > 0 ? P.tolerance * 1.3 : P.tolerance;
  const effInflGap = Math.abs(inflGap) < sanctionsTolerance ? inflGap * 0.35 : inflGap;
  const overheat = Math.max(0, s.outputGap - 1.5);
  const taylor = s.rStar + s.inflationExpectations + P.infl * effInflGap + P.gap * s.outputGap
    + P.fiscalLean * 2.2 * (s.fiscalImpulse || 0) + 0.45 * overheat
    + (s.cbCredibility < 45 ? 0.8 : 0) + 0.25 * Math.max(0, s.inflationExpectations - cbTarget - 1);
  const deepSlump = s.outputGap < -2 && s.inflation < cbTarget + 0.5;
  const smoothing = deepSlump ? Math.min(P.smooth, 0.55) : P.smooth;
  const smoothed = smoothing * s.keyRate + (1 - smoothing) * taylor;
  // ЦБ ходит шагами по 0,25 п.п. и не двигает ставку ради десятых долей
  const maxStep = deepSlump ? P.maxMove * 1.6 : P.maxMove;
  const rawMove2 = clamp(smoothed - s.keyRate, -maxStep, maxStep);
  const move = Math.abs(rawMove2) < 0.25 ? 0 : roundTo(rawMove2, 0.25);
  let keyRate = clamp(roundTo(s.keyRate + move, 0.25), 0, keyRateCap(s));
  // стабилизационный режим: реальная ставка выше ожиданий на запас характера,
  // и идти к ней можно быстрее обычного — постепенность здесь и есть ошибка
  const stabMode = stabilizationNeeded(s);
  const SP = CB_STABILIZATION[P.id] || CB_STABILIZATION.pragmatic;
  if (stabMode) {
    /* В программе ставка следует не правилу Тейлора (оно с коэффициентом 1,5
       реагирует на вчерашнюю инфляцию и сглаживает, держа 34% при инфляции
       10%), а правилу программы: реальная ставка на запас характера выше
       того, что сейчас выше — инфляции или ожиданий. Вверх — быстро, вниз —
       вслед за рушащимися ожиданиями. */
    const need = roundTo(Math.max(s.inflation, s.inflationExpectations) + SP.margin, 0.25);
    const next = need > s.keyRate ? Math.min(need, s.keyRate + SP.step) : Math.max(need, s.keyRate - SP.cut);
    keyRate = clamp(roundTo(next, 0.25), 0, keyRateCap(s));
  }
  /* Выход из программы. Победив инфляцию, ЦБ оставался со ставкой 30% и
     снижал её по два пункта за квартал — при дефляции −10% реальная ставка
     выходила за 25%, и рецессия после удачной стабилизации добивала то, что
     пощадила сама стабилизация. Настоящие ЦБ в этот момент снижают быстро:
     если ставка жёстче правила Тейлора больше чем на 5 п.п., а инфляция уже
     у цели, бот идёт вниз крупными шагами. Голубь — быстрее всех, ястреб —
     осторожнее. */
  const overTight = s.keyRate - Math.max(0, taylor) > 5 && s.inflation < cbTarget + 2;
  if (overTight) {
    keyRate = clamp(roundTo(Math.max(Math.max(0, taylor), s.keyRate - SP.cut), 0.25), 0, keyRateCap(s));
  }

  const fxTargetCur = s.fxTarget;
  const crisis = s.bankingRisk >= CONFIG.thresholds.bankingRisk || s.bankCapitalAdequacy < 9;
  const emergency = crisis;
  let liquidity = 0;
  if (s.bankLiquidity < 45) liquidity = 12;
  else if (s.bankLiquidity < 58) liquidity = 6;
  if (crisis) liquidity = Math.max(liquidity, 14);

  let moneySupplyOp = 0;
  if (keyRate < 0.8 && s.outputGap < -2 && !stabMode) moneySupplyOp = 2.5;
  if (s.outputGap > 3 && s.inflation > 7) moneySupplyOp = -2;

  let fxIntervention = 0;
  /* В программе курс — третья опора: управляемый курс при достаточных резервах
     даёт людям видимый якорь, пока ожидания ещё не поверили ставке. Бот берёт
     его сам, только если резервов хватает на защиту; после программы
     возвращает тот режим, что был. */
  const reservesOk = s.reserves >= 0.5 * CONFIG.initial.reserves;
  const fxRegime = stabMode && reservesOk && s.fxRegime === 'free' ? 'managed' : s.fxRegime;
  if (s.regime === 'currency' && s.reserves > 120) fxIntervention = -10;

  let capitalRequirement = s.capitalRequirement;
  if (s.creditGap > 6) capitalRequirement = clamp(s.capitalRequirement + 0.5 * P.macropru, 8, 18);
  else if (s.creditGap < -4 && s.capitalRequirement > 10.5) capitalRequirement = clamp(s.capitalRequirement - 0.5, 8, 18);

  // норма резервирования как второй инструмент
  let reserveReq = s.reserveReq;
  if (s.creditGap > 7 && s.reserveReq < 12) reserveReq = clamp(s.reserveReq + 1, 0, 20);
  else if ((s.creditCrunch || s.bankLiquidity < 50) && s.reserveReq > 3) reserveReq = clamp(s.reserveReq - 1, 0, 20);

  return buildCbResult(s, P, { keyRate, reserveReq, capitalRequirement, moneySupplyOp, fxIntervention, liquidity,
    fxRegime, emergency, cbTarget, fxTargetCur, stabMode });
}

/* Собирает текст решения ЦБ (новости, цитата, детали) по итоговым значениям.
   Вынесено отдельно от botCentralBank, чтобы после того как запрос Минфина
   меняет часть параметров (см. redescribeCbAction), новость описывала то, что
   реально произошло, а не изначальное намерение ЦБ до вмешательства. */
function buildCbResult(s, P, vals) {
  const { keyRate, reserveReq, capitalRequirement, moneySupplyOp, fxIntervention, liquidity, fxRegime,
    emergency, cbTarget, fxTargetCur, stabMode } = vals;
  const parts = [];
  if (Math.abs(keyRate - s.keyRate) > 0.05) parts.push(`${keyRate > s.keyRate ? 'повысил' : 'снизил'} ключевую ставку до ${keyRate.toFixed(2)}%`);
  else parts.push(`сохранил ключевую ставку на уровне ${keyRate.toFixed(2)}%`);
  if (Math.abs(reserveReq - s.reserveReq) > 0.05) parts.push(`изменил норму резервирования до ${reserveReq.toFixed(1)}%`);
  if (liquidity > 0) parts.push(`предоставил банкам ликвидность (${liquidity} млрд)`);
  if (emergency) parts.push('запустил экстренную поддержку банков');
  if (Math.abs(capitalRequirement - s.capitalRequirement) > 0.05) parts.push(`изменил норматив капитала до ${capitalRequirement.toFixed(1)}%`);
  if (fxIntervention < 0) parts.push('вышел на валютный рынок в поддержку курса');
  if (moneySupplyOp !== 0) parts.push(moneySupplyOp > 0 ? 'начал выкуп активов' : 'начал изъятие ликвидности');

  let demand = null;
  if ((s.fiscalImpulse || 0) > 0.6 && s.outputGap > 1.0) {
    demand = `Центральный банк требует немедленно прекратить наращивание бюджетного импульса: разрыв выпуска уже ${fmtSigned1(s.outputGap)}%, и каждый дополнительный рубль расходов ЦБ будет вынужден компенсировать ставкой.`;
  } else if (s.outputGap > 2.5) {
    demand = `Центральный банк указывает на перегрев (разрыв выпуска ${fmtSigned1(s.outputGap)}%): без бюджетной консолидации подавить инфляцию можно будет только ценой рецессии.`;
  } else if (s.budgetBalancePctGdp < -5) {
    demand = `Центральный банк требует сократить дефицит (${fmt1(Math.abs(s.budgetBalancePctGdp))}% ВВП): бюджетный импульс вынуждает держать ставку выше.`;
  } else if (s.inflation > 7 && (s.fiscalImpulse || 0) > 0.3) {
    demand = 'Центральный банк предупреждает: бюджетная экспансия при такой инфляции будет полностью компенсирована ставкой.';
  } else if (s.debtToGdp > 90) {
    demand = 'Центральный банк указывает на долговую нагрузку — премия за риск растёт вместе с ней.';
  }

  const stance = clamp((keyRate - s.inflationExpectations - s.rStar) / 3, -1, 1);
  const quote = (() => {
    if (emergency) return 'Мы приняли решение поддержать банковскую систему. Да, это денежная эмиссия, и мы понимаем её инфляционную цену — но альтернатива дороже: остановка платежей парализовала бы всю экономику.';
    if (stabMode && keyRate > s.keyRate + 0.05) return `Инфляция ${fmt1(s.inflation)}% — это уже не цикл, а бегство от денег. Реальная ставка ${fmtSigned1(keyRate - s.inflationExpectations)}% должна вернуть смысл сбережениям. Но программа сработает, только если бюджет перестанет требовать денег: одна ставка без Минфина — полдела.`;
    // санкции — свежее политическое решение, а не собственный манёвр ЦБ: персона
    // какое-то время явно проговаривает, почему не гоняется ставкой за скачком
    // цен на импорт, вместо того чтобы молчать о решении, которое бьёт по мандату
    if ((s.sanctionsQuartersLeft || 0) > 6) {
      if (P.id === 'hawk') return `Санкции против торгового партнёра разгоняют цены на импорт — это разовый сдвиг уровня цен, а не устойчивая инфляция, но мы не готовы списывать на него всё отклонение от цели без реакции.`;
      if (P.id === 'dove') return `Подорожавший из-за санкций импорт — это удар по издержкам, а не по спросу. Гасить его ставкой значит добавить к чужому решению ещё и рецессию, поэтому мы смотрим сквозь большую часть этого всплеска.`;
      return `Санкции против торгового партнёра — не наше решение, но инфляционные последствия разбирать приходится нам: часть всплеска — разовый эффект дорогого импорта, и на него мы реагируем мягче, чем на устойчивую инфляцию спроса.`;
    }
    if (keyRate > s.keyRate + 0.05) {
      if (s.outputGap > 1.5) return `Экономика работает выше своих возможностей: разрыв выпуска ${fmtSigned1(s.outputGap)}%. Мы повышаем ставку не потому, что хотим замедлить рост, а потому, что этот рост уже не производится — он только переоценивается в ценах.`;
      if ((s.fiscalImpulse || 0) > 0.4) return `Бюджетный импульс ${fmtSigned1(s.fiscalImpulse)} п.п. добавляет спрос, который экономика не может удовлетворить. Мы вынуждены компенсировать это ставкой — и хотели бы, чтобы в следующий раз эта работа была разделена между нами и Минфином.`;
      return `Инфляция ${fmt1(s.inflation)}% при цели ${fmt1(cbTarget)}%, ожидания ${fmt1(s.inflationExpectations)}%. Заякоренные ожидания — наш главный актив, и мы не готовы им рисковать ради нескольких месяцев более быстрого роста.`;
    }
    if (keyRate < s.keyRate - 0.05) {
      if (s.outputGap < -2) return `Разрыв выпуска ${fmtSigned1(s.outputGap)}%, безработица ${fmt1(s.unemployment)}% против естественного уровня ${fmt1(s.nairu)}%. Держать жёсткие условия, когда спроса и так не хватает, — значит превращать временные потери в постоянные.`;
      return `Инфляция вернулась к ${fmt1(s.inflation)}% при цели ${fmt1(cbTarget)}%, и мы можем позволить себе снять часть жёсткости. Смягчение будет постепенным: развернуть политику дешевле, чем восстанавливать доверие.`;
    }
    if (Math.abs(s.inflation - cbTarget) > 2) return `Мы сохраняем ставку, хотя инфляция ${fmt1(s.inflation)}% отличается от цели. Значительная часть этого отклонения объясняется разовыми факторами, а реагировать ставкой на разовый шок — значит платить выпуском дважды.`;
    return `Текущие условия соответствуют нашим оценкам нейтральных: реальная ставка ${fmtSigned1(keyRate - s.inflationExpectations)}% против нейтральной ${fmt1(s.rStar)}%. Менять курс без причины — худшее, что может делать центральный банк.`;
  })();
  return {
    quote,
    /* Решения ЦБ приводятся к сетке и границам ползунков игрока по той же
       причине, что и налоги Минфина: бот не имеет права на ход, которого нет
       у человека. Так, макропруденциальный шаг «+0,5 × характер» давал
       прагматику норматив капитала 10,8% при шаге ползунка 0,5.
       fxTarget здесь не трогаем: это не ход ЦБ, а унаследованный ориентир —
       после срыва фиксации он может оказаться далеко от рынка, и подтягивать
       его к текущему курсу значило бы менять политику молча. */
    decisions: {
      keyRate: clampToLever('keyRate', keyRate, s),
      reserveReq: clampToLever('reserveReq', reserveReq, s),
      capitalRequirement: clampToLever('capitalRequirement', capitalRequirement, s),
      moneySupplyOp: clampToLever('moneySupplyOp', moneySupplyOp, s),
      fxIntervention: clampToLever('fxIntervention', fxIntervention, s),
      liquidity: clampToLever('liquidity', liquidity, s),
      fxRegime, emergency,
      inflationTarget: clampToLever('inflationTarget', cbTarget, s),
      fxTarget: fxTargetCur,
    },
    detail: [
      `ставка ${keyRate.toFixed(2)}% (реальная ${fmtSigned1(keyRate - s.inflationExpectations)}% при нейтральной ${fmt1(s.rStar)}%)`,
      `цель по инфляции ${cbTarget.toFixed(2)}%, фактическая ${fmt1(s.inflation)}%`,
      `норма резервирования ${reserveReq.toFixed(1)}%, норматив капитала ${capitalRequirement.toFixed(1)}%`,
      `ликвидность банкам ${liquidity ? `+${liquidity} млрд` : 'не предоставлялась'}, режим курса ${fxRegime === 'free' ? 'плавающий' : fxRegime === 'managed' ? 'управляемый' : 'фиксированный'}`,
    ],
    // note идёт в панель ведомства, где характер бота — полезная информация;
    // newsNote — в ленту новостей, где «Центральный банк (Голубь)» выглядит так,
    // как не выглядит ни одна настоящая новость
    note: `Центральный банк (${P.name}) ${parts.join(', ')}.`,
    newsNote: `Центральный банк ${parts.join(', ')}.`, demand, stance, institution: 'cb',
    headline: keyRate > s.keyRate + 0.05 ? 'ужесточение' : keyRate < s.keyRate - 0.05 ? 'смягчение' : 'без изменений',
    newsHeadline: `ЦБ ${keyRate > s.keyRate + 0.05 ? 'УЖЕСТОЧАЕТ ПОЛИТИКУ' : keyRate < s.keyRate - 0.05 ? 'СМЯГЧАЕТ ПОЛИТИКУ' : 'СОХРАНЯЕТ КУРС'}: СТАВКА ${ru(keyRate.toFixed(2))}%`,
    publicHeadline: `РЕШЕНИЕ ЦБ: КЛЮЧЕВАЯ СТАВКА ${ru(keyRate.toFixed(2))}%`,
    publicNote: `Ставка ${ru(keyRate.toFixed(2))}%, норма резервирования ${ru(reserveReq.toFixed(1))}%, норматив капитала ${ru(capitalRequirement.toFixed(1))}%, цель по инфляции ${ru(cbTarget.toFixed(2))}%.`,
  };
}

/* Пересобрать новость/цитату решения ЦБ по итоговым decisions — после того как
   запрос Минфина (rate_cut/rate_hold/liquidity_help/capreq_ease/fx_support)
   изменил часть параметров поверх изначального решения ЦБ. */
function redescribeCbAction(s, personaId, finalDecisions) {
  const P = getCbPersona(personaId);
  return buildCbResult(s, P, {
    keyRate: finalDecisions.keyRate, reserveReq: finalDecisions.reserveReq,
    capitalRequirement: finalDecisions.capitalRequirement, moneySupplyOp: finalDecisions.moneySupplyOp,
    fxIntervention: finalDecisions.fxIntervention, liquidity: finalDecisions.liquidity,
    fxRegime: finalDecisions.fxRegime, emergency: finalDecisions.emergency,
    cbTarget: finalDecisions.inflationTarget, fxTargetCur: finalDecisions.fxTarget,
  });
}

// Бот-Минфин: бюджетное правило + контрциклическая реакция + собственные приоритеты расходов
function botFinanceMinistry(s, personaId, _difficulty) {
  const P = getMofPersona(personaId);
  const debtStress = clamp((s.debtToGdp - P.debtLimit) / 20, 0, 2);
  const targetDeficit = P.anchor - P.cyclical * Math.max(0, -s.outputGap) * 1.1 + debtStress * 2.2;
  const consolidationNeed = targetDeficit - s.budgetBalancePctGdp; // >0 => надо ужесточать

  const base = -1.0 * clamp(consolidationNeed, -3, 3);
  const dead = (v) => (Math.abs(v) < 0.5 ? 0 : roundTo(v, 0.5));
  let govSpending = clamp(base + 0.35 * Math.max(0, -s.outputGap) * P.cyclical, -4, 4);
  let transfers = clamp(0.4 * P.transferBias * Math.max(0, s.unemployment - 5) + (P.id === 'populist' ? 1.2 : 0) - 1.1 * Math.max(0, consolidationNeed), -5, 7);
  let govInvestment = clamp(P.investBias * (1.2 - 0.9 * Math.max(0, consolidationNeed)) + 0.4 * Math.max(0, -s.outputGap), -5, 6);
  if (s.inflation > 8 && P.id !== 'populist') { govSpending -= 0.8; transfers -= 0.6; }
  /* Стабилизационная программа держится на двух опорах, и бюджетная — за
     Минфином: дефицит не больше 3% ВВП или сокращение расходов. Технократ
     поддерживает программу полностью, консерватор — охотно (консолидация и
     так его курс), популист сопротивляется: урезает лишь закупки и держит
     выплаты, поэтому с ним доверие к программе копится втрое медленнее, и
     президенту или ЦБ придётся его дожимать. В этом режиме предвыборная
     щедрость отменяется у всех, кроме популиста. */
  const stabMode = stabilizationNeeded(s);
  if (stabMode) {
    if (P.id === 'populist') { govSpending = Math.min(govSpending, -0.5); }
    else {
      govSpending = Math.min(govSpending, P.id === 'austerity' ? -4 : -3);
      transfers = Math.min(transfers, P.id === 'austerity' ? -2 : -1);
      govInvestment = Math.min(govInvestment, 0);
    }
  }
  // политический цикл: перед выборами бюджет щедрее, сразу после — жёстче
  const toVote = Number.isFinite(s.quartersToElection) ? s.quartersToElection : 16;
  if (s.outputGap < -2 && s.recessionStreak >= 2 && !stabMode) {   // затяжной спад требует реакции даже от консерватора
    govSpending += 1.2; govInvestment += 1.6; transfers += 0.8;
  }
  if (toVote <= CONFIG.election.campaign && (!stabMode || P.id === 'populist')) { transfers += 1.5 * (P.id === 'populist' ? 1.6 : 1); govSpending += 0.7; }
  else if (toVote >= CONFIG.election.cycle - 2) { transfers -= 0.8; govSpending -= 0.5; }
  govSpending = dead(govSpending); transfers = dead(transfers); govInvestment = dead(govInvestment);

  /* Бот двигает налоги той же сеткой, что и игрок: рычаг налога ходит по
     0.5 п.п., поэтому «поднять НДС на 0.09» невозможно ни для кого. Раньше
     шаг бота был 0.5 * taxWill (от 0.09 до 0.375 п.п.) — со стороны это
     выглядело как отдельные правила для бота. Характер персоны сохраняется в
     размере шага, но уже целым числом ходов игрока. */
  const TAX_GRID = LEVER_BY_ID.vatRate ? LEVER_BY_ID.vatRate.step : 0.5;
  const taxMove = (mult) => Math.max(TAX_GRID, roundTo(P.taxWill * (mult || 1), TAX_GRID));
  const taxStep = taxMove(1);
  let incomeTaxRate = s.incomeTaxRate; let vatRate = s.vatRate; let profitTaxRate = s.profitTaxRate;
  let capitalTaxRate = s.capitalTaxRate; let socialContribRate = s.socialContribRate; let exciseRate = s.exciseRate;
  if (consolidationNeed > 1.5) {
    if (P.id === 'populist') { profitTaxRate = clamp(profitTaxRate + taxStep, 0, 45); capitalTaxRate = clamp(capitalTaxRate + taxStep, 0, 35); }
    else if (P.id === 'technocrat') { vatRate = clamp(vatRate + taxStep, 0, 30); exciseRate = clamp(exciseRate + taxStep, 0, 25); }
    else { vatRate = clamp(vatRate + taxMove(0.6), 0, 30); incomeTaxRate = clamp(incomeTaxRate + taxMove(0.6), 0, 45); }
  } else if (consolidationNeed < -2 && s.outputGap < 0) {
    if (P.id === 'populist') incomeTaxRate = clamp(incomeTaxRate - taxStep, 0, 45);
    else profitTaxRate = clamp(profitTaxRate - taxStep, 0, 45);
  }

  const drift = (cur, tgt) => (Math.abs(tgt - cur) < 1 ? cur : clamp(Math.round(cur + clamp(tgt - cur, -1, 1)), 0, 45));
  const shareHealth = drift(s.budgetShares.health, P.shares.health);
  const shareEducation = drift(s.budgetShares.education, P.shares.education);
  const shareScience = drift(s.budgetShares.science, P.shares.science);
  // оборона: не ниже взятого обязательства, а в войне — военный бюджет сверх обычного
  const defenseTarget = Math.max(P.shares.defense + ((s.warQuartersLeft || 0) > 0 ? 5 : 0),
    s.defenseCommit ? s.defenseCommit.share : 0);
  const shareDefense = drift(s.budgetShares.defense, defenseTarget);
  const shareAdmin = drift(s.budgetShares.admin, P.shares.admin);

  const regionPlan = botRegionPlan(s, P, consolidationNeed);
  return buildMofResult(s, P, targetDeficit, {
    ...regionPlan,
    incomeTaxRate: clampToLever('incomeTaxRate', incomeTaxRate, s),
    profitTaxRate: clampToLever('profitTaxRate', profitTaxRate, s),
    vatRate: clampToLever('vatRate', vatRate, s),
    exciseRate: clampToLever('exciseRate', exciseRate, s),
    capitalTaxRate: clampToLever('capitalTaxRate', capitalTaxRate, s),
    socialContribRate: clampToLever('socialContribRate', socialContribRate, s),
    govSpending: clampToLever('govSpending', govSpending, s),
    transfers: clampToLever('transfers', transfers, s),
    govInvestment: clampToLever('govInvestment', govInvestment, s),
    shareHealth, shareEducation, shareScience, shareDefense, shareAdmin });
}

/* Аналог buildCbResult для Минфина: собирает текст решения по итоговым
   значениям, отдельно от botFinanceMinistry — используется и там, и в
   redescribeMofAction после того как запрос ЦБ меняет часть параметров. */
function buildMofResult(s, P, targetDeficit, vals) {
  const { incomeTaxRate, profitTaxRate, vatRate, exciseRate, capitalTaxRate, socialContribRate,
    govSpending, transfers, govInvestment, shareHealth, shareEducation, shareScience, shareDefense, shareAdmin } = vals;
  const startProject = vals.startProject || null; const regionResponse = vals.regionResponse || null;
  const consolidationNeed = targetDeficit - s.budgetBalancePctGdp; // >0 => надо ужесточать
  const parts = [];
  if (Math.abs(govSpending) > 0.15) parts.push(`${govSpending > 0 ? 'нарастил' : 'сократил'} госзакупки (${fmtSigned1(govSpending)}%)`);
  if (Math.abs(transfers) > 0.15) parts.push(`${transfers > 0 ? 'повысил' : 'урезал'} социальные выплаты (${fmtSigned1(transfers)}%)`);
  if (Math.abs(govInvestment) > 0.15) parts.push(`${govInvestment > 0 ? 'увеличил' : 'сократил'} госинвестиции (${fmtSigned1(govInvestment)}%)`);
  if (Math.abs(vatRate - s.vatRate) > 0.05) parts.push(`изменил НДС до ${vatRate.toFixed(1)}%`);
  if (Math.abs(profitTaxRate - s.profitTaxRate) > 0.05) parts.push(`изменил налог на прибыль до ${profitTaxRate.toFixed(1)}%`);
  if (Math.abs(incomeTaxRate - s.incomeTaxRate) > 0.05) parts.push(`изменил подоходный налог до ${incomeTaxRate.toFixed(1)}%`);
  if (startProject && PROJECT_BY_ID[startProject]) parts.push(`начал стройку «${PROJECT_BY_ID[startProject].name}»`);
  if (!parts.length) parts.push('оставил бюджетные параметры без изменений');

  let demand = null;
  if (s.lendingRate - s.inflation > 6) demand = 'Минфин требует от ЦБ снизить ставку: стоимость обслуживания долга и кредита душит экономику.';
  else if (s.unemployment > 7.5) demand = 'Минфин настаивает на смягчении денежной политики — безработица выше приемлемого уровня.';
  else if (s.inflation > 8 && P.id !== 'populist') demand = 'Минфин просит ЦБ решительнее подавить инфляцию: она обесценивает бюджетные расходы.';

  const stance = clamp((govSpending + transfers * 0.6 + govInvestment * 0.8) / 6 - (vatRate - s.vatRate) * 0.3, -1, 1);
  const quote = (() => {
    if (consolidationNeed > 1.5) return `Дефицит ${fmt1(Math.abs(s.budgetBalancePctGdp))}% ВВП при долге ${fmt1(s.debtToGdp)}% — это не абстракция, а проценты, которые мы платим вместо школ и дорог. Консолидация неприятна, но занимать дороже, чем экономить.`;
    // вступление в блок — решение президента, но занимать на внешних рынках
    // после него приходится Минфину, и персона какое-то время явно связывает
    // более дешёвый долг именно с этим, а не с собственной заслугой
    if ((s.tradeBlocQuartersLeft || 0) > 0) return `Торговый блок уже виден в стоимости займов: премия за риск ниже, чем была бы без него. Не наша заслуга — но пользоваться этим окном мы обязаны, пока согласование с блоком не свело его на нет.`;
    if (s.unemployment > 7) return `Безработица ${fmt1(s.unemployment)}%. Люди без работы не ждут, пока заработают рыночные механизмы, поэтому бюджет берёт часть спроса на себя — и мы готовы объяснить каждый рубль этих расходов.`;
    if (s.outputGap < -1.5) return `Экономика работает ниже своих возможностей. Сейчас мультипликатор государственных расходов высок: каждый вложенный рубль доходит до выпуска, а не до цен. Это редкое окно, и мы им пользуемся.`;
    if (govInvestment > 1) return 'Мы смещаем расходы от текущего потребления к инвестициям. Трансферты поддерживают спрос сегодня, инфраструктура повышает то, что страна способна произвести завтра.';
    return `Бюджет исполняется в рамках правила: баланс ${fmtSigned1(s.budgetBalancePctGdp)}% ВВП. Предсказуемость бюджетной политики стоит дешевле, чем любые точечные меры.`;
  })();
  return {
    quote,
    decisions: {
      incomeTaxRate, profitTaxRate, vatRate, exciseRate, capitalTaxRate, socialContribRate,
      govSpending, transfers, govInvestment,
      shareHealth, shareEducation, shareScience, shareDefense, shareAdmin,
      startProject, regionResponse,
    },
    note: `Минфин (${P.name}) ${parts.join(', ')}.`,
    newsNote: `Минфин ${parts.join(', ')}.`, demand, stance, institution: 'gov',
    detail: [
      `госзакупки ${fmtSigned1(govSpending)}% к тренду, выплаты ${fmtSigned1(transfers)}%, инвестиции ${fmtSigned1(govInvestment)}%`,
      `НДС ${vatRate.toFixed(1)}%, прибыль ${profitTaxRate.toFixed(1)}%, подоходный ${incomeTaxRate.toFixed(1)}%`,
      `цель по балансу ${fmt1(targetDeficit)}% ВВП при текущем ${fmt1(s.budgetBalancePctGdp)}%`,
      `приоритеты: здравоохранение ${shareHealth.toFixed(0)}%, образование ${shareEducation.toFixed(0)}%, наука ${shareScience.toFixed(0)}%`,
    ],
    headline: stance > 0.15 ? 'стимулирование' : stance < -0.15 ? 'консолидация' : 'нейтрально',
    newsHeadline: `МИНФИН: ${stance > 0.15 ? 'КУРС НА СТИМУЛИРОВАНИЕ ЭКОНОМИКИ' : stance < -0.15 ? 'КУРС НА БЮДЖЕТНУЮ КОНСОЛИДАЦИЮ' : 'БЮДЖЕТНАЯ ПОЛИТИКА БЕЗ ИЗМЕНЕНИЙ'}`,
    publicHeadline: `БЮДЖЕТ: НДС ${ru(vatRate.toFixed(1))}%, НАЛОГ НА ПРИБЫЛЬ ${ru(profitTaxRate.toFixed(1))}%`,
    publicNote: `Госзакупки ${fmtSigned1(govSpending)}% к тренду, выплаты ${fmtSigned1(transfers)}%, инвестиции ${fmtSigned1(govInvestment)}%. Баланс бюджета ${fmtSigned1(s.budgetBalancePctGdp)}% ВВП, долг ${fmt1(s.debtToGdp)}% ВВП.`,
  };
}

/* Пересобрать новость/цитату решения Минфина по итоговым decisions — после
   того как запрос ЦБ (infra_up/deficit_cut/transfers_freeze/tax_relief_business)
   изменил часть параметров поверх изначального решения Минфина. */
function redescribeMofAction(s, personaId, finalDecisions) {
  const P = getMofPersona(personaId);
  const debtStress = clamp((s.debtToGdp - P.debtLimit) / 20, 0, 2);
  const targetDeficit = P.anchor - P.cyclical * Math.max(0, -s.outputGap) * 1.1 + debtStress * 2.2;
  return buildMofResult(s, P, targetDeficit, {
    incomeTaxRate: finalDecisions.incomeTaxRate, profitTaxRate: finalDecisions.profitTaxRate,
    vatRate: finalDecisions.vatRate, exciseRate: finalDecisions.exciseRate,
    capitalTaxRate: finalDecisions.capitalTaxRate, socialContribRate: finalDecisions.socialContribRate,
    govSpending: finalDecisions.govSpending, transfers: finalDecisions.transfers, govInvestment: finalDecisions.govInvestment,
    shareHealth: finalDecisions.shareHealth, shareEducation: finalDecisions.shareEducation,
    shareScience: finalDecisions.shareScience, shareDefense: finalDecisions.shareDefense, shareAdmin: finalDecisions.shareAdmin,
    startProject: finalDecisions.startProject, regionResponse: finalDecisions.regionResponse,
  });
}

/* Та же новость/цитата/спрос, что и у бота, но для решения живого игрока в
   сетевой партии — раньше новости о действиях второй ветви власти строились
   только из botAction/botActions, поэтому решения человека-партнёра никогда
   не попадали в ленту. buildCbResult/buildMofResult используют persona только
   для имени и (у Минфина) калибровки таргета дефицита — берём нейтральный
   персонаж по умолчанию и подставляем вместо имени ник игрока. */
function describeHumanCbAction(s, playerName, finalDecisions) {
  const P = { ...getCbPersona('pragmatic'), name: playerName || 'игрок' };
  return buildCbResult(s, P, {
    keyRate: finalDecisions.keyRate, reserveReq: finalDecisions.reserveReq,
    capitalRequirement: finalDecisions.capitalRequirement, moneySupplyOp: finalDecisions.moneySupplyOp,
    fxIntervention: finalDecisions.fxIntervention, liquidity: finalDecisions.liquidity,
    fxRegime: finalDecisions.fxRegime, emergency: finalDecisions.emergency,
    cbTarget: finalDecisions.inflationTarget, fxTargetCur: finalDecisions.fxTarget,
  });
}
function describeHumanMofAction(s, playerName, finalDecisions) {
  const P = { ...getMofPersona('technocrat'), name: playerName || 'игрок' };
  const debtStress = clamp((s.debtToGdp - P.debtLimit) / 20, 0, 2);
  const targetDeficit = P.anchor - P.cyclical * Math.max(0, -s.outputGap) * 1.1 + debtStress * 2.2;
  return buildMofResult(s, P, targetDeficit, {
    incomeTaxRate: finalDecisions.incomeTaxRate, profitTaxRate: finalDecisions.profitTaxRate,
    vatRate: finalDecisions.vatRate, exciseRate: finalDecisions.exciseRate,
    capitalTaxRate: finalDecisions.capitalTaxRate, socialContribRate: finalDecisions.socialContribRate,
    govSpending: finalDecisions.govSpending, transfers: finalDecisions.transfers, govInvestment: finalDecisions.govInvestment,
    shareHealth: finalDecisions.shareHealth, shareEducation: finalDecisions.shareEducation,
    shareScience: finalDecisions.shareScience, shareDefense: finalDecisions.shareDefense, shareAdmin: finalDecisions.shareAdmin,
    startProject: finalDecisions.startProject, regionResponse: finalDecisions.regionResponse,
  });
}

/* =========================================================================================
   МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ: официальное обращение одного ведомства к другому
========================================================================================= */
/* Число в тексте просьбы — «1», «1,5», «0,25»: без хвостовых нулей и с запятой,
   как это читается вслух, а не как в отчёте. */
const askNum = (n) => String(Number(Number(n).toFixed(2))).replace('.', ',');
/* Сколько именно просят: сила указания — множитель к базовой величине просьбы. */
const reqAmount = (req, strength) => (req && req.scale ? req.scale.base : 1)
  * (Number.isFinite(strength) ? strength : 1);
/* Текст просьбы. «Снизить ставку на 1 п.п.» и «на 0,25 п.п.» — разные просьбы, и в
   новостях обязана стоять та, которую действительно выдвинули: раньше в кавычках
   всегда висела базовая формулировка, сколько бы ни просили на самом деле. */
const askText = (req, strength, bySpeaker, regime) => {
  if (!req) return '';
  const raw = typeof req.ask === 'function' ? req.ask(reqAmount(req, strength)) : req.ask;
  let text = raw;
  // указание ведомству от имени президента передаёт он сам, а не то ведомство,
  // чьим голосом написан текст просьбы («...вынудит НАС держать ставку выше» —
  // это фраза ЦБ о себе). Без замены президент рассказывал бы про ставку так,
  // будто сам её устанавливает, хотя ни одного рычага у него нет.
  if (bySpeaker === 'president' && req.from) {
    const institutionName = req.from === 'central_bank' ? 'ЦБ' : 'Минфин';
    // \b в JS-регулярках размечает границы по ASCII \w и кириллицу словом не
    // считает — «\bнас\b» поэтому вообще не находит «нас» внутри кириллического
    // текста ни разу. \p{L} с флагом u распознаёт кириллицу как буквы корректно.
    text = text.replace(/(?<!\p{L})нас(?!\p{L})/giu, institutionName)
      .replace(/(?<!\p{L})нам(?!\p{L})/giu, institutionName);
  }
  // «Просим»/«Требуем»/«Предлагаем» — формулировки для ведомства, у которого
  // есть право отказать. При тоталитарном режиме отказать почти невозможно
  // (см. authority = 4.0 в processPresidentialDirective) — и президент,
  // который «просит» при таком раскладе, звучит фальшиво: это не просьба,
  // а распоряжение с заранее известным ответом.
  if (bySpeaker === 'president' && regime === 'totalitarian') {
    text = text.replace(/^(Просим|Требуем|Предлагаем) /, 'Приказываем ');
  }
  return text;
};
/* «Согласились наполовину» у ставочных запросов считается от того, что бот и
   так планировал сделать в этом квартале (decisions.keyRate ДО применения
   запроса — а это уже решение бота, которое само может быть повышением на
   фоне высокой инфляции), а не от ставки, которая реально действовала
   прошлый квартал (economy.keyRate). Если инфляция достаточно сильна,
   уступка в сторону смягчения может не спасти ставку от роста — и тогда
   статический текст «снижает вдвое меньше запрошенного» прямо противоречит
   соседней новости о повышении ставки, которая смотрит именно на факт:
   выросла ставка относительно прошлого квартала или нет. Поэтому текст у
   rate_cut/rate_hike сравнивает итог именно с economy.keyRate. */
function requestOutcomeText(req, status, economyBefore, after) {
  if ((req.id === 'rate_cut' || req.id === 'rate_hike') && status !== 'rejected') {
    const beforeRate = Number.isFinite(economyBefore.keyRate) ? economyBefore.keyRate : 0;
    const afterRate = Number.isFinite(after.keyRate) ? after.keyRate : beforeRate;
    const cut = afterRate < beforeRate - 0.01;
    const hike = afterRate > beforeRate + 0.01;
    if (req.id === 'rate_cut') {
      if (cut) return status === 'accepted' ? req.yes : req.partial;
      return hike
        ? `Центральный банк смягчает свою реакцию, но инфляция всё равно требует более высокой ставки — она растёт до ${rf2(afterRate)}%, просто меньше, чем без уступки.`
        : `Центральный банк идёт навстречу и отказывается от дальнейшего повышения, но снизить ставку пока не готов — она остаётся на ${rf2(afterRate)}%.`;
    }
    if (hike) return status === 'accepted' ? req.yes : req.partial;
    return cut
      ? `Центральный банк ужесточает тон, но экономика требует смягчения — ставка всё равно снижается до ${rf2(afterRate)}%.`
      : `Центральный банк соглашается не смягчать политику дальше, но и на решительное повышение пока не идёт — ставка остаётся на ${rf2(afterRate)}%.`;
  }
  return status === 'accepted' ? req.yes : status === 'partial' ? req.partial : req.no;
}

// liquidity/fxIntervention — рычаги в номинальных млрд, а не в % ВВП: их диапазон
// растёт вместе с экономикой (см. scaleLever в интерфейсе). Просьба, двигающая их
// на фиксированное число миллиардов, в позднем ВВП, выросшем в разы, превращается
// в неразличимую на глаз поправку — «исполнено», а по факту ничего не изменилось.
const gdpLeverScale = (s) => Math.max(1, (s && s.nominalGdp ? s.nominalGdp : CONFIG.initial.gdp) / CONFIG.initial.gdp);

const REQUESTS = [
  { id: 'infra_up', from: 'central_bank', label: 'Нарастить госинвестиции',
    scale: { base: 1.5, min: 0.5, max: 3, step: 0.5, unit: '% ВВП' },
    ask: (n) => `Просим увеличить расходы на инфраструктуру на ${askNum(n)}% ВВП для поддержки совокупного спроса.`,
    fit: (s) => (s.outputGap < -1 ? 1.5 : s.outputGap > 1.5 ? -1.6 : 0.1) + (s.debtToGdp > 85 ? -0.9 : 0.2),
    bias: { technocrat: 0.7, populist: 0.5, austerity: -0.7 },
    // множитель здесь обязан совпадать с scale.base (1.5): тот же scale.base
    // умножается на strength и печатается в тексте просьбы как «на N% ВВП» —
    // раньше apply двигал рычаг вдвое сильнее того, что было напечатано, и
    // игрок, выполнивший ровно заявленное, всё равно получал «частично»
    apply: (d, k) => ({ govInvestment: clamp(d.govInvestment + 1.5 * k, -15, 15) }),
    yes: 'Минфин согласен: инфраструктурная программа будет расширена уже в этом квартале.',
    partial: 'Минфин готов на половину запрошенного — бюджетное правило не позволяет больше.',
    no: 'Минфин отказывает: наращивать расходы при нынешнем состоянии бюджета он не намерен.' },
  { id: 'deficit_cut', from: 'central_bank', label: 'Сократить дефицит бюджета',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // «×2» читалось как «дефицит уменьшится вдвое», хотя запрос двигает не сам
    // дефицит, а темп роста двух статей расходов — итоговый эффект на баланс
    // бюджета зависит ещё и от доходов, процентных платежей и остальных
    // статей, которых запрос не касается. Текст явно называет то, что
    // реально просят, а не то, что могло бы показаться пропорциональным.
    ask: (n) => `Требуем притормозить рост расходов на ${askNum(2 * n)} п.п. и социальных выплат на ${askNum(1.5 * n)} п.п.: нынешний бюджетный импульс вынуждает нас держать ставку выше, чем требовалось бы.`,
    fit: (s) => (s.budgetBalancePctGdp < -4 ? 1.4 : 0.2) + (s.outputGap > 1 ? 0.8 : -0.3) + (s.inflation > 6 ? 0.6 : 0),
    bias: { technocrat: 0.6, austerity: 1.0, populist: -0.9 },
    apply: (d, k) => ({ govSpending: clampToLeverRange('govSpending', d.govSpending - 2 * k), transfers: clampToLeverRange('transfers', d.transfers - 1.5 * k) }),
    yes: 'Минфин соглашается на консолидацию: расходы будут урезаны.',
    partial: 'Минфин идёт на частичное сокращение, защитив социальные статьи.',
    no: 'Минфин отвечает, что сокращать расходы в текущей ситуации политически невозможно.' },
  { id: 'transfers_freeze', from: 'central_bank', label: 'Заморозить рост социальных выплат',
    scale: { base: 1, min: 0.5, max: 2, step: 0.5, unit: ' п.п.' },
    // множитель в apply (1.0) обязан совпадать с scale.base — та же причина,
    // что и у infra_up/vat_relief: иначе выполненная ровно по тексту просьба
    // всё равно читалась бы игрой как «частично»
    ask: (n) => `Просим приостановить рост социальных выплат минимум на ${askNum(n)} п.п.: их рост напрямую транслируется в потребительский спрос и цены.`,
    fit: (s) => (s.inflation > 6 ? 1.3 : -0.4) + (s.unemployment > 7 ? -1.0 : 0.3),
    bias: { austerity: 1.0, technocrat: 0.3, populist: -1.4 },
    apply: (d, k) => ({ transfers: clampToLeverRange('transfers', Math.min(d.transfers, 0) - 1.0 * k) }),
    yes: 'Минфин замораживает индексацию выплат до нормализации инфляции.',
    partial: 'Минфин ограничивает рост выплат, но полной заморозки не допускает.',
    no: 'Минфин отвечает, что заморозка выплат при текущем положении людей исключена.' },
  { id: 'tax_relief_business', from: 'central_bank', label: 'Снизить налог на прибыль',
    scale: { base: 2, min: 0.5, max: 4, step: 0.5, unit: ' п.п.' },
    // раньше текст не называл величину вовсе («снизить налог на прибыль», без
    // числа) — игрок не мог понять, сколько нужно сдвинуть ползунок, чтобы
    // просьба засчиталась выполненной
    ask: (n) => `Предлагаем снизить налог на прибыль на ${askNum(n)} п.п.: инвестиции сдерживаются и стоимостью денег, и налоговой нагрузкой сразу.`,
    fit: (s) => (s.investmentGrowth < 0 ? 1.2 : 0) + (s.budgetBalancePctGdp > -3 ? 0.5 : -0.9),
    bias: { technocrat: 0.4, austerity: 0.2, populist: -0.8 },
    apply: (d, k) => ({ profitTaxRate: clamp(d.profitTaxRate - 2 * k, 0, 45) }),
    yes: 'Минфин снижает налог на прибыль, рассчитывая вернуть выпадающие доходы ростом базы.',
    partial: 'Минфин идёт на символическое снижение ставки.',
    no: 'Минфин отказывается: выпадающие доходы нечем закрыть.' },
  { id: 'vat_relief', from: 'central_bank', label: 'Снизить НДС',
    scale: { base: 1.5, min: 0.5, max: 3, step: 0.5, unit: ' п.п.' },
    ask: (n) => `Просим снизить НДС на ${askNum(n)} п.п.: налоговая нагрузка бьёт по спросу населения раньше, чем по цифрам роста.`,
    fit: (s) => (s.vatRate > 20 ? 1.3 : -0.5) + (s.budgetBalancePctGdp > -3 ? 0.4 : -1.0),
    bias: { technocrat: 0.1, austerity: -0.7, populist: 0.9 },
    // множитель должен совпадать с scale.base (1.5): текст просьбы называет
    // именно эту величину, и полное согласие обязано двигать рычаг ровно на неё
    apply: (d, k) => ({ vatRate: clamp(d.vatRate - 1.5 * k, 0, 30) }),
    yes: 'Минфин снижает НДС, рассчитывая компенсировать выпадающие доходы ростом потребления.',
    partial: 'Минфин идёт на символическое снижение НДС.',
    no: 'Минфин отказывается: выпадающие доходы бюджета нечем закрыть.' },
  { id: 'fiscal_hold', from: 'central_bank', label: 'Не наращивать бюджетный импульс',
    hold: [{ key: 'govSpending', dir: 1 }, { key: 'transfers', dir: 1 }, { key: 'govInvestment', dir: 1 }],
    ask: 'Просим не расширять бюджетный импульс дальше: дополнительное стимулирование сейчас разгонит инфляцию и вынудит нас держать ставку выше.',
    fit: (s) => (s.inflation > s.inflationTarget + 1.5 ? 1.2 : -0.4) + (s.outputGap > 1 ? 0.8 : -0.2) + (s.debtToGdp > 80 ? 0.3 : 0),
    bias: { technocrat: 0.5, austerity: 0.9, populist: -1.0 },
    // «не наращивать» гасит уже запланированное РАСШИРЕНИЕ (govSpending/transfers/govInvestment —
    // это темпы роста, а не уровни), а не обнуляет их целиком: если статья и так в минусе
    // (уже консолидация), просьба её не трогает — как rate_hold гасит только повышение ставки
    apply: (d, k) => ({
      govSpending: d.govSpending > 0 ? roundTo(d.govSpending * (1 - k), 0.5) : d.govSpending,
      transfers: d.transfers > 0 ? roundTo(d.transfers * (1 - k), 0.5) : d.transfers,
      govInvestment: d.govInvestment > 0 ? roundTo(d.govInvestment * (1 - k), 0.5) : d.govInvestment,
    }),
    yes: 'Минфин соглашается не расширять бюджетный импульс дальше.',
    partial: 'Минфин частично сдерживает рост расходов, но не отказывается от него полностью.',
    no: 'Минфин отвечает, что взятые бюджетные обязательства снижать не намерен.' },
  // военные расходы — не дело Центробанка: эту просьбу к Минфину отдаёт только президент
  { id: 'defense_up', from: 'central_bank', presidentOnly: true, label: 'Нарастить военные расходы',
    scale: { base: 3, min: 1, max: 6, step: 1, unit: ' п.п. бюджета' },
    ask: (n) => `Просим увеличить долю военных расходов в бюджете на ${askNum(n)} п.п.: недофинансированная оборона в нынешней обстановке — риск дороже, чем строчка в бюджете.`,
    // вне войны эта просьба почти не имеет смысла для ЦБ — а во время войны
    // недофинансированная оборона бьёт по премии за риск и по доверию сильнее,
    // чем сам факт военных расходов
    fit: (s) => ((s.warQuartersLeft || 0) > 0 ? 1.5 : -0.9) + (s.debtToGdp > 85 ? -0.5 : 0.2),
    bias: { technocrat: -0.1, austerity: -0.4, populist: 0.1 },
    // множитель должен совпадать с scale.base (3), как и у infra_up
    apply: (d, k) => ({ shareDefense: clamp(d.shareDefense + 3 * k, 2, 40) }),
    yes: 'Минфин соглашается нарастить долю военных расходов за счёт остальных статей и держать её два года.',
    partial: 'Минфин идёт на скромное увеличение военной доли бюджета.',
    no: 'Минфин отказывает: перекраивать бюджет в пользу обороны сейчас не готовы.' },
  { id: 'rate_cut', from: 'ministry_finance', label: 'Снизить ключевую ставку',
    scale: { base: 1, min: 0.25, max: 2.5, step: 0.25, unit: ' п.п.' },
    ask: (n) => `Просим снизить ключевую ставку на ${askNum(n)} п.п.: стоимость кредита душит инвестиции и обслуживание долга.`,
    fit: (s) => (s.outputGap < -1 ? 1.3 : -0.6) + (s.inflation < s.inflationTarget + 1 ? 0.9 : -1.4) + (s.unemployment > 7 ? 0.6 : 0),
    bias: { dove: 0.9, pragmatic: 0.2, hawk: -0.9 },
    // округление к сетке 0,25 не должно съедать частичное согласие целиком: просьба
    // снизить на 0,25 при ответе «наполовину» давала −0,125 → та же ставка, и новость
    // «исполнено частично» выходила при неизменившейся ставке. Согласился — двигай.
    apply: (d, k, economy) => ({ keyRate: k <= 0 ? d.keyRate
      : clamp(Math.min(roundTo(d.keyRate - 1 * k, 0.25), roundTo(d.keyRate, 0.25) - 0.25), 0, keyRateCap(economy)) }),
    yes: 'Центральный банк соглашается и снижает ставку — инфляционная картина это позволяет.',
    partial: 'Центральный банк снижает ставку вдвое меньше запрошенного.',
    no: 'Центральный банк отказывает: снижение ставки при текущей инфляции стоило бы доверия к цели.' },
  /* Зеркало rate_cut: до появления президента все просьбы к ЦБ были «помягче» —
     Минфину жёсткость нужна редко. Президенту, который сам ставку не задаёт,
     нужен и обратный рычаг, иначе при голубином ЦБ инфляцию нечем давить. */
  { id: 'rate_hike', from: 'ministry_finance', label: 'Решительно подавить инфляцию',
    scale: { base: 2, min: 0.5, max: 4, step: 0.5, unit: ' п.п.' },
    ask: (n) => `Требуем повысить ключевую ставку на ${askNum(n)} п.п.: рост цен обесценивает доходы и расходы быстрее, чем их успевают индексировать.`,
    fit: (s) => (s.inflation > s.inflationTarget + 2 ? 1.4 : -1.0) + (s.inflationExpectations > s.inflationTarget + 1.5 ? 0.7 : -0.3)
      + (s.outputGap < -2 ? -0.8 : 0.2),
    bias: { hawk: 0.9, pragmatic: 0.2, dove: -0.9 },
    apply: (d, k, economy) => ({ keyRate: k <= 0 ? d.keyRate
      : clamp(Math.max(roundTo(d.keyRate + 2 * k, 0.25), roundTo(d.keyRate, 0.25) + 0.25), 0, keyRateCap(economy)) }),
    yes: 'Центральный банк соглашается и повышает ставку решительнее, чем планировал.',
    partial: 'Центральный банк добавляет к своему решению половину запрошенного шага.',
    no: 'Центральный банк отказывает: он считает, что уже сделал достаточно, а переужесточение обойдётся выпуском.' },
  { id: 'rate_hold', from: 'ministry_finance', label: 'Не повышать ставку',
    hold: [{ key: 'keyRate', dir: 1 }],
    ask: 'Просим воздержаться от повышения ставки: бюджет и без того несёт растущие процентные расходы.',
    fit: (s) => (s.inflation < s.inflationTarget + 2 ? 0.9 : -1.5) + (s.interestToRevenue > 14 ? 0.8 : 0),
    bias: { dove: 0.8, pragmatic: 0.1, hawk: -1.0 },
    // «не повышать» должно реально гасить запланированное повышение, а не быть
    // самоприсваиванием d.keyRate — иначе ЦБ повышает ставку, будто просьбы не было
    apply: (d, k, economy) => {
      const hike = d.keyRate - economy.keyRate;
      return hike <= 0 ? { keyRate: d.keyRate } : { keyRate: roundTo(economy.keyRate + hike * (1 - k), 0.25) };
    },
    yes: 'Центральный банк берёт паузу в ужесточении.',
    partial: 'Центральный банк обещает действовать осторожнее, но связывать себе руки не готов.',
    no: 'Центральный банк отвечает, что независимость политики не обсуждается.' },
  { id: 'liquidity_help', from: 'ministry_finance', label: 'Поддержать ликвидность банков',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // apply масштабирует рычаг по размеру экономики (gdpLeverScale) — точную
    // сумму в млрд в тексте просьбы не назвать без доступа к economy здесь,
    // поэтому число называет саму силу запроса (то же n, что двигает ползунок
    // «Насколько» у президента), а не производную от неё величину
    ask: (n) => `Просим предоставить банковской системе поддержку объёмом не менее ${askNum(n)}× обычного пакета ликвидности: кредитование останавливается, страдают предприятия.`,
    fit: (s) => (s.bankLiquidity < 60 ? 1.4 : -0.3) + (s.creditCrunch ? 1.0 : 0) + (s.inflation > 8 ? -0.7 : 0.2),
    bias: { dove: 0.6, pragmatic: 0.5, hawk: 0.1 },
    apply: (d, k, economy) => ({ liquidity: clamp(d.liquidity + 12 * k * gdpLeverScale(economy), -100 * gdpLeverScale(economy), 200 * gdpLeverScale(economy)) }),
    yes: 'Центральный банк открывает окно ликвидности для банков.',
    partial: 'Центральный банк предоставляет ограниченный объём ликвидности.',
    no: 'Центральный банк считает поддержку преждевременной.' },
  { id: 'capreq_ease', from: 'ministry_finance', label: 'Смягчить норматив капитала',
    scale: { base: 1, min: 0.5, max: 2, step: 0.5, unit: ' п.п.' },
    // множитель в apply (1.0) совпадает с scale.base — то же правило, что и у
    // остальных запросов с числом в тексте
    ask: (n) => `Просим временно смягчить требование к капиталу банков минимум на ${askNum(n)} п.п., чтобы разблокировать кредитование экономики.`,
    fit: (s) => (s.creditCrunch ? 1.5 : -0.5) + (s.creditGap > 5 ? -1.2 : 0.3) + (s.bankNPL > 8 ? -0.8 : 0),
    bias: { dove: 0.5, pragmatic: 0.1, hawk: -0.8 },
    apply: (d, k) => ({ capitalRequirement: clamp(d.capitalRequirement - 1.0 * k, 8, 18) }),
    yes: 'Центральный банк временно снижает норматив, признавая остроту кредитного сжатия.',
    partial: 'Центральный банк идёт на минимальное послабление.',
    no: 'Центральный банк отказывает: ослабление норматива в такой момент готовит следующий кризис.' },
  { id: 'fx_support', from: 'ministry_finance', label: 'Поддержать курс интервенциями',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // «выйти на валютный рынок» — фраза, в которой не сказано, что «поддержать
    // курс» значит толкнуть ползунок ВНИЗ, в минус, а не вверх: рычаг «валютные
    // интервенции» в плюсе — это покупка валюты, то есть ослабление, ровно
    // противоположное тому, чего просят. Явное направление в тексте просьбы
    // экономит игроку одно неверно понятое задание.
    // apply тоже масштабирует рычаг по размеру экономики (gdpLeverScale) —
    // число в тексте называет силу запроса (n), а не сумму в млрд, той же
    // логикой, что и liquidity_help
    ask: (n) => `Просим выйти на валютный рынок и продавать резервы объёмом не менее ${askNum(n)}× обычной интервенции (сдвиньте валютные интервенции в минус): ослабление курса разгоняет цены и стоимость импорта для бюджета.`,
    fit: (s) => (s.fxDeprAnnual > 6 ? 1.3 : -0.6) + (s.reserves > 200 ? 0.5 : -1.0),
    bias: { hawk: 0.5, pragmatic: 0.3, dove: 0.0 },
    apply: (d, k, economy) => ({ fxIntervention: clamp(d.fxIntervention - 12 * k * gdpLeverScale(economy), -400 * gdpLeverScale(economy), 400 * gdpLeverScale(economy)) }),
    yes: 'Центральный банк выходит на рынок в поддержку курса.',
    partial: 'Центральный банк проводит ограниченные интервенции.',
    no: 'Центральный банк отвечает, что тратить резервы против фундаментальных факторов бессмысленно.' },
];
function processRequest(reqId, economy, botKind, personaId, decisions) {
  const req = REQUESTS.find((r) => r.id === reqId);
  if (!req) return null;
  const persona = botKind === 'central_bank' ? getCbPersona(personaId) : getMofPersona(personaId);
  const score = req.fit(economy) + (req.bias[persona.id] || 0)
    + (economy.policyCoordination > 70 ? 0.3 : economy.policyCoordination < 35 ? -0.4 : 0);
  const status = score >= 1.0 ? 'accepted' : score >= 0.1 ? 'partial' : 'rejected';
  const k = status === 'accepted' ? 1 : status === 'partial' ? 0.5 : 0;
  const finalDecisions = k > 0 ? { ...decisions, ...req.apply(decisions, k, economy) } : decisions;
  return {
    req, status, score, ask: askText(req, 1),
    decisions: finalDecisions,
    text: requestOutcomeText(req, status, economy, finalDecisions),
    coordination: status === 'accepted' ? 9 : status === 'partial' ? 4 : -7,
  };
}

/* =========================================================================================
   ПРЕЗИДЕНТ: власть, у которой нет ни одного ползунка

   Роль устроена принципиально иначе, чем ЦБ, Минфин и премьер. Президент не задаёт
   ни ставку, ни налоги — оба ведомства ведут боты. Его валюта — политический капитал
   (0–100): он копится за счёт рейтинга и роста и тратится на кадры, указания
   ведомствам, структурные реформы и публичную политику.

   Разделение, которое здесь важно выдержать:
   • одноразовые политические эффекты (рейтинг, напряжённость, доверие) — импульсы,
     они естественно затухают;
   • постоянные экономические эффекты реформ — производные от карты reforms, потому
     что импульс по mean-reverting величине (nairu, humanCapital, riskPremium) через
     несколько кварталов рассосался бы, а реформа не должна «отыгрываться назад».
   Каждая реформа разворачивается постепенно: reforms[id] — сколько кварталов прошло
   с момента объявления, доля внедрения = кварталы / REFORM_RAMP[id].
========================================================================================= */
const REFORM_RAMP = { labor: 8, pension: 12, courts: 10, deregulation: 6, education: 16 };
const reformShare = (reforms, id) => clamp(((reforms && reforms[id]) || 0) / (REFORM_RAMP[id] || 8), 0, 1);
/* Постоянная часть реформ: то, что нельзя отдать импульсам, потому что величина
   сама возвращается к своему таргету. */
function reformEffects(reforms) {
  return {
    // nairu подтягивается к таргету с гистерезисом 0.02 в квартал, поэтому сдвиг
    // таргета на -1.5 даёт в реальности около -0.8 п.п. за десять лет игры
    nairu: -1.5 * reformShare(reforms, 'labor'),
    humanCapital: 7 * reformShare(reforms, 'education'),
    riskPremium: -0.40 * reformShare(reforms, 'courts'),
    transfers: -0.80 * reformShare(reforms, 'pension'),
  };
}

const PRES_GROUP_LABEL = { public: 'Публичная политика', reform: 'Структурные реформы',
  power: 'Устройство власти', war: 'Война и чрезвычайные полномочия', diplomacy: 'Внешняя политика' };

/* Каждое действие: build(s, difficulty) -> { impulses, news, patch }.
   patch может нести snapElection / dissolve / restore / reform — то, что меняет
   не поток, а состояние, и обрабатывается в simulateQuarter отдельно. */
/* =========================================================================================
   ОДНО ПРАВИЛО НА ВЕСЬ РЕЖИМ

   Игрок нашёл сразу три места, где игра забывала, при каком режиме идёт партия:
   антикоррупционная кампания, о которой при тоталитаризме отчитывались как при
   свободной прессе; «Рейтинг власти 62 ▼» в газете государства, где рейтингов
   не печатают; кнопка досрочных выборов там, где выборы отменены. Чинить это
   по одному месту значит гарантированно пропустить четвёртое.

   Поэтому правило одно и живёт здесь. Всё, что игра показывает как публичное
   слово — газетная новость, лента, вопрос на пресс-конференции, — проходит
   через фильтр режима. Всё, что игрок видит как собственный инструмент
   (панели кабинета, цепочка последствий новости, сводки ведомств), остаётся
   честным: правительство знает свои настоящие цифры, даже когда не публикует их.

   Техника простая: рядом с публичным текстом лежит его «жёсткий» вариант
   (textHard / headlineHard / promptHard / quoteHard), и при подконтрольной
   прессе берётся он. Тест regimeVoice в engine.test.js обходит все действия
   президента и все вопросы прессы и валится, если новый текст при
   тоталитаризме говорит словами свободной печати, — так четвёртое место
   найдётся само.
========================================================================================= */
const pressControlled = (e) => e.politicalRegime === 'authoritarian' || e.politicalRegime === 'totalitarian';

/* Публичный текст (новость) при подконтрольной прессе. Цепочку последствий
   (chain) намеренно не трогаем: это не газета, а объяснение механики игроку. */
function publicNews(spec, e) {
  if (!spec || !pressControlled(e)) return spec;
  const out = { ...spec };
  if (spec.textHard) out.text = spec.textHard;
  if (spec.headlineHard) out.headline = spec.headlineHard;
  return out;
}

const PRESIDENT_ACTIONS = [
  { id: 'address', group: 'public', label: 'Обращение к нации', cost: 8, cooldown: 3,
    desc: 'Прямой эфир поверх всех ведомств. Работает тем хуже, чем сильнее слова расходятся с ценами в магазине и с безработицей: рейтинг покупается доверием, а доверие — единственное, что нельзя напечатать.',
    build: (s, difficulty) => {
      // чем хуже фактические цифры, тем меньше верят словам; и тем меньше запас
      // роста, чем выше рейтинг уже сейчас
      const believe = clamp(1 - Math.max(0, s.inflation - s.inflationTarget) / 12
        - Math.max(0, s.unemployment - s.nairu) / 10, 0.2, 1);
      const room = 1 - clamp((s.approval - 50) / 45, 0, 0.7);
      const kick = 6.5 * believe * room;
      return {
        impulses: [
          makeImpulse('approvalPush', kick, 'Обращение президента к нации', 'fast', difficulty, 'other'),
          makeImpulse('consumerConfidence', 2.4 * believe, 'Обращение президента к нации', 'default', difficulty, 'other'),
        ],
        news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ОБРАЩАЕТСЯ К НАЦИИ',
          text: `Прямое обращение поверх ведомств: президент объясняет курс своими словами при инфляции ${fmt1(s.inflation)}% и безработице ${fmt1(s.unemployment)}%. Доверие к сказанному — ${Math.round(believe * 100)} из 100: разговор стоит ровно столько, сколько стоят цифры за ним.`,
          priority: 6 },
      };
    } },
  { id: 'elite_deal', group: 'public', label: 'Договориться с элитами', cost: 16, cooldown: 6,
    desc: 'Закрытые переговоры с теми, кто реально распоряжается активами. Снимает политическое напряжение и возвращает бизнесу уверенность — ценой доверия тех, кто узнаёт о сделке из новостей.',
    build: (s, difficulty) => ({
      impulses: [
        makeImpulse('tensionPush', -11, 'Соглашение с элитами', 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', 6, 'Соглашение с элитами', 'default', difficulty, 'other'),
        makeImpulse('govTrust', -3.5, 'Закулисная сделка стала известна', 'default', difficulty, 'other'),
        makeImpulse('approvalPush', -2.5, 'Закулисная сделка стала известна', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ЗАКРЫТАЯ ВСТРЕЧА ПРЕЗИДЕНТА С КРУПНЫМ БИЗНЕСОМ',
        text: `Итогов не публикуют, но напряжение в верхах спало, а бизнес заговорил о предсказуемости. Напряжённость была ${Math.round(s.politicalTension || 0)} из 100 — цена вопроса в том, что об условиях сделки страна узнаёт последней.`,
        priority: 6 },
    }) },
  { id: 'anticorruption', group: 'public', label: 'Антикоррупционная кампания', cost: 24, cooldown: 12,
    desc: 'Громкие дела и проверки. Через год-полтора это лучшая инвестиция в доверие и производительность, какая есть у президента, — но сначала бизнес замирает, а элиты, по которым идёт кампания, переходят в оппозицию.',
    build: (s, difficulty) => ({
      impulses: [
        sustainedImpulse('govTrust', 1.3, 8, 'Антикоррупционная кампания', 'other'),
        makeImpulse('approvalPush', 4.5, 'Антикоррупционная кампания', 'fast', difficulty, 'other'),
        sustainedImpulse('productivity', 0.13, 8, 'Антикоррупционная кампания: меньше издержек на «решение вопросов»'),
        makeImpulse('investment', -1.1, 'Проверки: бизнес откладывает решения', 'default', difficulty),
        makeImpulse('tensionPush', 6, 'Элиты под ударом кампании', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ОБЪЯВЛЯЕТ АНТИКОРРУПЦИОННУЮ КАМПАНИЮ',
        text: 'Проверки в госкорпорациях и первые задержания. Улица одобряет, инвесторы берут паузу, а те, по кому идёт кампания, впервые за долгое время объединяются против власти.',
        // под контролем государства та же кампания печатается как торжество
        // порядка: о консолидации элит против власти в такой газете не пишут
        textHard: 'Проверки в госкорпорациях и первые задержания. Ведётся планомерная работа по очищению государственного аппарата; граждане поддерживают решительность руководства. Отдельные хозяйственные структуры временно приостановили инвестиционные программы.',
        priority: 8, chain: ['Кампания объявлена', 'Бизнес выжидает', 'Элиты в оппозиции', 'Доверие ↑', 'Производительность ↑'] },
    }) },
  { id: 'crackdown', group: 'public', label: 'Силовое подавление протеста', cost: 14, cooldown: 4,
    requires: (s) => s.unrestActive || (s.politicalTension || 0) >= 45,
    reqText: 'Доступно при беспорядках или напряжённости от 45',
    desc: 'Улицу можно очистить за один квартал. Напряжение не исчезает — оно уходит внутрь и возвращается больше, чем было, а капитал и доверие уходят сразу и насовсем.',
    build: (s, difficulty) => ({
      impulses: [
        makeImpulse('tensionPush', -17, 'Протест подавлен силой', 'fast', difficulty, 'other'),
        sustainedImpulse('tensionPush', 2.6, 6, 'Подавление копит напряжение вглубь', 'other'),
        makeImpulse('govTrust', -8, 'Силовой разгон протеста', 'default', difficulty, 'other'),
        makeImpulse('businessConfidence', -6, 'Силовой разгон протеста', 'default', difficulty, 'other'),
        makeImpulse('capitalFlow', -10, 'Отток капитала после силового сценария', 'default', difficulty),
      ],
      news: { cat: 'crisis', headline: 'ПЛОЩАДИ ОЧИЩЕНЫ: ВЛАСТЬ ВЫБРАЛА СИЛОВОЙ СЦЕНАРИЙ',
        text: 'Официально — «восстановление порядка». Улицы пусты, но опросы фиксируют не согласие, а страх: подавленное напряжение возвращается позже и сильнее.',
        headlineHard: 'ПОРЯДОК В СТОЛИЦЕ ПОЛНОСТЬЮ ВОССТАНОВЛЕН',
        textHard: 'Попытка дестабилизации пресечена, работа городских служб не прерывалась. Ведомства отмечают спокойствие и сознательность граждан; отдельные участники беспорядков устанавливаются.',
        priority: 9, chain: ['Протест', 'Разгон', 'Тишина сейчас', 'Напряжение вглубь', 'Отток капитала'] },
    }) },
  { id: 'military_parade', group: 'public', label: 'Военный парад', cost: 10, cooldown: 5,
    desc: 'Демонстрация силы без единого выстрела: техника на площади, войска в строю, трансляция на всю страну. Рейтинг растёт от одного зрелища — заметно сильнее, если стране есть чем гордиться прямо сейчас (идёт война), и слабее, а то и в минус, если экономика тем временем явно страдает: тогда парад читается не как повод для гордости, а как отвлечение внимания.',
    build: (s, difficulty) => {
      const struggling = s.unemployment - s.nairu > 1.5 || s.inflation > s.inflationTarget + 3;
      const atWar = (s.warQuartersLeft || 0) > 0;
      const kick = (atWar ? 5.5 : 3.2) * (struggling ? 0.4 : 1) - (struggling ? 1.6 : 0);
      return {
        impulses: [
          makeImpulse('approvalPush', kick, 'Военный парад', 'fast', difficulty, 'other'),
          makeImpulse('tensionPush', struggling ? 3 : -1.5, 'Военный парад', 'fast', difficulty, 'other'),
        ],
        news: { cat: 'gov', headline: 'ВОЕННЫЙ ПАРАД В СТОЛИЦЕ',
          text: `Техника и войска перед трибунами, трансляция идёт весь день. ${atWar
            ? 'На фоне идущей войны зрелище работает: есть, чем гордиться прямо сейчас.'
            : struggling
              ? `При безработице ${fmt1(s.unemployment)}% и инфляции ${fmt1(s.inflation)}% зрелище многие читают не как повод для гордости, а как отвлечение от повседневных проблем.`
              : 'В мирное время это чистая демонстрация силы, которую пока не пришлось применять.'}`,
          priority: 6 },
      };
    } },

  /* ============================== ДИПЛОМАТИЯ ==============================
     Рычаг между «ничего не делать» и «начать войну»: экономическое давление
     или сближение с другой страной, без единого выстрела. Санкции греют
     рейтинг сплочением почти как парад, но бьют по импорту и инвестициям на
     годы; торговый блок — обратный обмен: дешевле капитал ценой части
     самостоятельности в регулировании. */
  { id: 'sanctions_impose', group: 'diplomacy', label: 'Ввести санкции против торгового партнёра', cost: 20, cooldown: 12,
    requires: (s) => (s.warQuartersLeft || 0) <= 0,
    reqText: 'Недоступно во время войны — экономическое давление теряет смысл рядом с настоящей',
    desc: 'Ограничить торговлю и инвестиции с одной из стран-партнёров — экономическое давление вместо военного. Рейтинг греется сплочением почти сразу, но подорожавший импорт и осторожность инвесторов остаются на годы.',
    build: (s, difficulty) => ({
      patch: { sanctionsStart: true },
      impulses: [
        makeImpulse('approvalPush', 3.5, 'Санкции против торгового партнёра', 'fast', difficulty, 'other'),
        makeImpulse('tensionPush', -2, 'Внешний оппонент сплачивает вокруг власти', 'fast', difficulty, 'other'),
        sustainedImpulse('inflationSupply', 0.35, 10, 'Санкции: подорожавший импорт', 'other'),
        sustainedImpulse('businessConfidence', -0.6, 10, 'Санкции: торговые ограничения'),
        sustainedImpulse('investment', -0.5, 10, 'Санкции: инвесторы закладывают риск ограничений'),
        makeImpulse('riskPremium', 0.25, 'Санкции повышают премию за риск', 'default', difficulty),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ВВОДИТ САНКЦИИ ПРОТИВ ТОРГОВОГО ПАРТНЁРА',
        text: 'Ограничения на торговлю и инвестиции с одной из стран-партнёров. Внутри это читают как решительность, снаружи — как разрыв связей, который бьёт по импорту и инвестициям на годы вперёд.',
        priority: 8, chain: ['Санкции объявлены', 'Рейтинг ↑ сразу', 'Импорт дороже', 'Инвестиции ↓', 'Премия за риск ↑'] },
    }) },
  { id: 'trade_bloc', group: 'diplomacy', label: 'Вступить в торговый блок', cost: 30, cooldown: 60,
    requires: (s) => (s.warQuartersLeft || 0) <= 0,
    reqText: 'Недоступно во время войны',
    desc: 'Договориться о едином рынке с соседями: ниже барьеры для торговли, дешевле капитал, ниже премия за риск — но часть регуляторных решений придётся согласовывать, а не принимать в одиночку. Долгий эффект, почти не отменяется.',
    build: (s, difficulty) => ({
      patch: { tradeBlocJoin: true },
      impulses: [
        sustainedImpulse('investment', 0.7, 16, 'Членство в торговом блоке', 'other'),
        sustainedImpulse('businessConfidence', 0.9, 16, 'Членство в торговом блоке', 'other'),
        makeImpulse('riskPremium', -0.4, 'Торговый блок снижает премию за риск', 'default', difficulty),
        makeImpulse('tensionPush', 5, 'Часть решений теперь согласуется с блоком, а не только внутри страны', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'СТРАНА ВСТУПАЕТ В ТОРГОВЫЙ БЛОК',
        text: 'Соглашение снимает барьеры для торговли и капитала с партнёрами по блоку. Издержки бизнеса падают вместе с премией за риск — а часть регуляторных решений теперь придётся согласовывать, а не принимать в одиночку.',
        priority: 8, chain: ['Соглашение подписано', 'Барьеры ↓', 'Капитал дешевле', 'Согласование с блоком', 'Напряжение ↑'] },
    }) },

  { id: 'dissolve', group: 'power', severe: true, label: 'Распустить парламент', cost: 45, cooldown: 14,
    requires: (s) => !s.parliamentDissolved,
    reqText: 'Доступно, пока парламент работает',
    desc: 'Убрать единственный орган, способный сказать «нет». Решения перестают тормозиться — вместе с ними перестаёт работать всё, что держало премию за риск низкой.',
    build: (s, difficulty) => ({
      patch: { dissolve: true },
      impulses: [
        makeImpulse('tensionPush', 22, 'Роспуск парламента указом президента', 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', -11, 'Роспуск парламента: институты слабеют', 'default', difficulty, 'other'),
        makeImpulse('riskPremium', 0.55, 'Роспуск парламента', 'default', difficulty),
        makeImpulse('capitalFlow', -14, 'Бегство капитала после роспуска парламента', 'default', difficulty),
        makeImpulse('approvalPush', -5, 'Роспуск парламента', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'УКАЗ ПРЕЗИДЕНТА: ПАРЛАМЕНТ РАСПУЩЕН',
        text: 'Формулировка указа — «временная мера ради управляемости». Ни срока, ни даты новых выборов в тексте нет.',
        priority: 10, chain: ['Указ президента', 'Парламент распущен', 'Институты слабеют', 'Премия за риск ↑'] },
    }) },
  { id: 'restore_parliament', group: 'power', label: 'Вернуть парламент', cost: 32, cooldown: 8,
    requires: (s) => !!s.parliamentDissolved,
    reqText: 'Доступно, только если парламент распущен',
    desc: 'Добровольно вернуть себе ограничение. Самый дорогой способ снять напряжение и единственная дорога обратно из авторитарного режима, если идти по ней сознательно, а не под давлением улицы.',
    build: (s, difficulty) => ({
      patch: { restore: true },
      impulses: [
        makeImpulse('tensionPush', -19, 'Парламент возвращён указом президента', 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', 9, 'Возврат к парламентской процедуре', 'default', difficulty, 'other'),
        makeImpulse('riskPremium', -0.35, 'Восстановление институтов', 'default', difficulty),
        sustainedImpulse('govTrust', 1.0, 6, 'Возврат к парламентской процедуре', 'other'),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ВОЗВРАЩАЕТ ПОЛНОМОЧИЯ ПАРЛАМЕНТУ',
        text: 'Указ отменён тем же, кто его подписал. Оппозиция называет это вынужденным шагом, рынки — первым за долгое время сигналом, что правила ещё что-то значат.',
        /* Указ подписан ещё при подконтрольной прессе: газета того же вечера
           печатает не оттепель, а плановое решение руководства. Оттепель в
           ней появится со следующего квартала — вместе со сменой режима. */
        textHard: 'Работа представительного органа возобновляется по решению главы государства. Руководство подчёркивает: мера принята в плановом порядке, поскольку обстоятельства, потребовавшие особого управления, исчерпаны.',
        priority: 9, chain: ['Указ отменён', 'Парламент работает', 'Напряжение ↓', 'Премия за риск ↓'] },
    }) },
  /* ============================== ВОЙНА КАК РЕШЕНИЕ ==============================
     До сих пор война в модели была только внешним событием — она случалась с
     экономикой, и ЦБ с Минфином могли лишь разгребать последствия. У президента
     другая позиция: он может начать её сам. Это и есть его уникальный рычаг —
     единственный, который переписывает не проценты, а рамку, в которой считают
     все остальные: рейтинг взлетает на волне сплочения, чрезвычайные полномочия
     становятся доступны, газеты меняют язык, — а платят за это торговля,
     инвестиции, капитал и люди.

     Наступательная война отличается от оборонительной именно ценой: союзников
     нет, есть санкции. Поэтому её и не показывают как «кризис, который случился»:
     это решение, у которого есть автор. */
  { id: 'war_start', group: 'war', severe: true, label: 'Начать военную операцию', cost: 45, cooldown: 20,
    requires: (s) => (s.warQuartersLeft || 0) <= 0,
    reqText: 'Доступно, пока страна не воюет',
    desc: 'Собственная война вместо чужой. Первые кварталы рейтинг растёт на сплочении вокруг флага, а с ним открываются чрезвычайные полномочия. Дальше начинается счёт: санкции, бегство капитала, сжатие торговли и инвестиций, рост цен со стороны предложения. Из войны выходят не тогда, когда захотят, а когда смогут.',
    build: (s, difficulty) => {
      const authoritarianPress = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
      return {
        patch: { startWar: true },
        impulses: [
          // сплочение вокруг флага греет рейтинг резко, но не гаснет за один квартал —
          // угасающая по кварталам добавка вместо разового скачка, который ema тут же
          // почти полностью стирает обратно к базовому уровню
          taperedImpulse('approvalPush', [11, 7, 4, 2, 1], 'Сплочение вокруг флага', 'other'),
          sustainedImpulse('approvalPush', -1.8, 9, 'Война затягивается', 'other'),
          makeImpulse('tensionPush', 10, 'Начало военной операции', 'fast', difficulty, 'other'),
          makeImpulse('exportsGrowth', -7, 'Санкции против наступающей стороны', 'default', difficulty),
          makeImpulse('importsGrowth', -6, 'Закрытие торговых каналов', 'default', difficulty),
          makeImpulse('capitalFlow', -26, 'Бегство капитала из воюющей страны', 'default', difficulty),
          makeImpulse('fdi', -18, 'Прямые инвестиции сворачиваются', 'default', difficulty),
          makeImpulse('riskPremium', 1.2, 'Военная премия за риск', 'default', difficulty),
          makeImpulse('businessConfidence', -15, 'Война: бизнес не планирует', 'default', difficulty, 'other'),
          makeImpulse('inflationSupply', 1.4, 'Разрыв поставок и военный спрос', 'default', difficulty),
          makeImpulse('stockShock', -16, 'Рынок переоценивает риск войны', 'fast', difficulty),
          sustainedImpulse('potentialShock', -0.35, 10, 'Люди и мощности уходят на войну'),
        ],
        news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ОБЪЯВЛЯЕТ О НАЧАЛЕ ВОЕННОЙ ОПЕРАЦИИ',
          // при авторитаризме и тем более тоталитаризме это не мог бы написать никто:
          // ни прогноз роста рейтинга, ни признание готовящихся санкций — государственная
          // пресса объявляет решение оправданным и заранее списывает любую реакцию
          // извне на враждебность, а не анализирует его последствия для страны
          text: authoritarianPress
            ? 'Официальное сообщение: решение принято ради безопасности и будущего страны, альтернативы ему не было. Народ сплотился вокруг руководства, армия выполняет поставленную задачу. Попытки внешних сил давить санкциями обречены на провал и лишь ускорят опору на собственные силы.'
            : `Решение объявлено как вынужденное и единственно возможное. Рейтинг власти ${Math.round(s.approval)} из 100 в ближайшие кварталы вырастет — так бывает всегда в первые месяцы. Партнёры уже готовят ограничения: экспорт, импорт, капитал и прямые инвестиции пойдут вниз одновременно.`,
          priority: 10, chain: ['Решение президента', 'Сплочение вокруг флага', 'Санкции', 'Торговля ↓', 'Капитал ↓', 'Цены ↑'] },
      };
    } },
  { id: 'mobilization', group: 'war', severe: true, label: 'Объявить мобилизацию', cost: 28, cooldown: 8,
    requires: (s) => (s.warQuartersLeft || 0) > 0,
    reqText: 'Доступно только во время войны',
    desc: 'Забрать людей из экономики в армию. Безработица падает — но не потому, что появились рабочие места; выпуск и потенциал падают вместе с ней. Рейтинг платит сразу и заметно: мобилизация касается каждой семьи, в отличие от войны на экране.',
    build: (s, difficulty) => ({
      patch: { warExtend: 2 },
      impulses: [
        makeImpulse('approvalPush', -13, 'Мобилизация коснулась каждой семьи', 'fast', difficulty, 'other'),
        makeImpulse('tensionPush', 16, 'Мобилизация', 'fast', difficulty, 'other'),
        sustainedImpulse('potentialShock', -0.55, 8, 'Люди изъяты из экономики'),
        makeImpulse('consumption', -1.6, 'Отъезд работников и неопределённость', 'default', difficulty),
        makeImpulse('capitalFlow', -14, 'Отъезд капитала вслед за людьми', 'default', difficulty),
        makeImpulse('businessConfidence', -9, 'Мобилизация: кадры выбывают', 'default', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ОБЪЯВЛЕНА МОБИЛИЗАЦИЯ',
        text: `Призыв затрагивает всю страну. Формально безработица снизится — из экономики просто изымают людей; выпуск, потенциал и потребление уйдут вниз следом. Напряжённость была ${Math.round(s.politicalTension || 0)} из 100, и это решение её не уменьшит.`,
        priority: 10, chain: ['Мобилизация', 'Рабочих рук ↓', 'Потенциал ↓', 'Рейтинг ↓', 'Напряжённость ↑'] },
    }) },
  { id: 'war_economy', group: 'war', severe: true, label: 'Перевести экономику на военные рельсы', cost: 34, cooldown: 12,
    requires: (s) => (s.warQuartersLeft || 0) > 0,
    reqText: 'Доступно только во время войны',
    desc: 'Госзаказ вместо рынка: оборонная промышленность растёт, гражданский сектор сжимается. Выпуск и занятость держатся, но держатся на бюджете — и всё, что произведено, не становится ни потреблением, ни будущим ростом.',
    build: (s, difficulty) => ({
      impulses: [
        sustainedImpulse('govInvestmentPush', 3.0, 8, 'Военный заказ'),
        makeImpulse('secIndustry', 12, 'Оборонная промышленность на подъёме', 'fast', difficulty),
        makeImpulse('secConsumer', -10, 'Гражданский сектор сжимается', 'fast', difficulty),
        makeImpulse('inflationSupply', 0.8, 'Военный заказ вытесняет гражданское производство', 'default', difficulty),
        sustainedImpulse('productivity', -0.08, 8, 'Производство не по спросу, а по разнарядке'),
      ],
      news: { cat: 'gov', headline: 'ЭКОНОМИКА ПЕРЕВЕДЕНА НА ВОЕННЫЕ РЕЛЬСЫ',
        text: 'Госзаказ становится главным покупателем: оборонные заводы работают в три смены, гражданские линии останавливаются. Цифры выпуска это поддержит — благосостояние нет: произведённое не съесть, не надеть и не вложить в завтрашний рост.',
        priority: 9, chain: ['Военный заказ', 'Оборонка ↑', 'Гражданский сектор ↓', 'Производительность ↓'] },
    }) },
  { id: 'peace_deal', group: 'war', severe: true,
    // в оборонительной войне у страны нет позиции для переговоров на равных:
    // прекратить её раньше срока значит принять условия того, кто напал, —
    // это капитуляция, а не мир, и цена у неё другая
    label: (s) => (s.warType === 'defensive' ? 'Капитулировать' : 'Заключить мир'),
    cost: 24, cooldown: 6,
    // войну за новые земли кончают на карте: перемирием и переговорами
    requires: (s) => (s.warQuartersLeft || 0) > 0 && s.warType !== 'revanche',
    reqText: 'Доступно только во время войны',
    desc: (s) => (s.warType === 'defensive'
      ? 'Остановить войну на условиях противника, потому что обороняться дальше нечем. Это не переговоры на равных: часть требований будет выполнена, санкции снимутся не полностью, а внутри страны решение читается как поражение, а не как облегчение. Экономика перестаёт терять с этого квартала — но не возвращает то, что уже потеряно.'
      : 'Выйти из войны раньше, чем она закончится сама. Санкции снимаются медленнее, чем вводились, а внутри решение читается как признание поражения — но экономика начинает восстанавливаться с этого квартала, а не через год.'),
    build: (s, difficulty) => {
      const authoritarianPress = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
      if (s.warType === 'defensive') {
        return {
          patch: { endWar: true },
          impulses: [
            makeImpulse('approvalPush', -18, 'Капитуляция читается как поражение', 'fast', difficulty, 'other'),
            makeImpulse('tensionPush', 12, 'Капитуляция раскалывает общество', 'fast', difficulty, 'other'),
            makeImpulse('businessConfidence', 5, 'Боевые действия прекращены, но условия невыгодны', 'default', difficulty, 'other'),
            makeImpulse('capitalFlow', 5, 'Капитал возвращается осторожно', 'default', difficulty),
            makeImpulse('riskPremium', 0.5, 'Уступки повышают премию за риск на будущее', 'default', difficulty),
            makeImpulse('stockShock', -12, 'Рынок закладывает цену капитуляции', 'fast', difficulty),
            sustainedImpulse('potentialShock', -0.4, 6, 'Утрата территорий и производственных мощностей'),
            sustainedImpulse('exportsGrowth', -0.8, 4, 'Торговые маршруты достались победителю'),
          ],
          news: { cat: 'gov',
            headline: authoritarianPress ? 'БОЕВЫЕ ДЕЙСТВИЯ ОСТАНОВЛЕНЫ' : 'ПРЕЗИДЕНТ ОБЪЯВЛЯЕТ О КАПИТУЛЯЦИИ',
            text: authoritarianPress
              ? 'Официальное сообщение: руководство остановило боевые действия ради сохранения жизней и стабильности страны. Условия соглашения не разглашаются полностью; независимые источники называют их уступками стороне, начавшей конфликт.'
              : 'Глава государства принимает условия противника, чтобы остановить боевые действия. Это не мирный договор равных сторон, а признание невозможности обороняться дальше: часть требований противника выполнена, потери территорий и репараций фиксируются соглашением. Рынок и общество читают это как поражение, а не как облегчение.',
            priority: 10, chain: ['Капитуляция', 'Потери территорий', 'Премия за риск ↑', 'Рейтинг ↓↓'] },
        };
      }
      return {
        patch: { endWar: true },
        impulses: [
          makeImpulse('approvalPush', -6, 'Мир читается как поражение', 'fast', difficulty, 'other'),
          makeImpulse('tensionPush', -8, 'Война окончена', 'fast', difficulty, 'other'),
          makeImpulse('businessConfidence', 12, 'Мир: бизнес возвращается к планированию', 'default', difficulty, 'other'),
          makeImpulse('capitalFlow', 16, 'Возврат капитала после мира', 'default', difficulty),
          makeImpulse('riskPremium', -0.7, 'Военная премия за риск уходит', 'default', difficulty),
          sustainedImpulse('exportsGrowth', 1.4, 6, 'Торговые каналы открываются заново'),
        ],
        news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ОБЪЯВЛЯЕТ О ЗАКЛЮЧЕНИИ МИРА',
          text: 'Боевые действия прекращены решением главы государства. Часть ограничений снимут не сразу, а часть не снимут вовсе — но премия за риск, капитал и деловая уверенность начинают возвращаться уже в этом квартале.',
          priority: 10, chain: ['Мир', 'Премия за риск ↓', 'Капитал ↑', 'Торговля ↑', 'Рейтинг ↓'] },
      };
    } },
  /* Верхняя ступень лестницы режимов. Раньше тоталитаризм существовал только как
     несчастный случай: из авторитарного режима туда вела единственная дорога —
     напряжённость 80+ и бросок кубика, то есть страна должна была сама дойти до
     ручки. Президенту, который строит вертикаль сознательно, нужен был собственный
     ход — дорогой и с честной ценой: экономика платит инвестициями, капиталом и
     производительностью, а власть получает управляемость и политический капитал,
     который копится почти сам. Обратно ведёт та же дорога, что и из авторитаризма, —
     указ «Вернуть парламент», и стоит он ровно столько же, сколько стоил всегда. */
  { id: 'seize_control', group: 'war', severe: true, label: 'Полный контроль над институтами', cost: 50, cooldown: 24,
    requires: (s) => s.politicalRegime === 'authoritarian' && !!s.parliamentDissolved && (s.warQuartersLeft || 0) > 0,
    reqText: 'Доступно во время войны при авторитарном режиме и распущенном парламенте',
    desc: 'Суды, пресса и остатки самостоятельных ведомств переходят под прямое управление. Ведомства почти перестают отказывать, политический капитал копится сам — но инвестиции, производительность и капитал уходят из страны и обратно не возвращаются.',
    build: (s, difficulty) => ({
      patch: { totalize: true },
      impulses: [
        makeImpulse('tensionPush', 14, 'Установление полного контроля', 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', -16, 'Институты подчинены', 'default', difficulty, 'other'),
        makeImpulse('investment', -3.2, 'Инвесторы уходят из страны', 'default', difficulty),
        makeImpulse('capitalFlow', -20, 'Бегство капитала', 'default', difficulty),
        makeImpulse('riskPremium', 0.8, 'Полный контроль над институтами', 'default', difficulty),
        sustainedImpulse('productivity', -0.1, 10, 'Отбор по лояльности вместо отбора по результату'),
        makeImpulse('govTrust', -6, 'Независимых источников информации не осталось', 'default', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'УКАЗ ПРЕЗИДЕНТА: ИНСТИТУТЫ ПЕРЕХОДЯТ ПОД ПРЯМОЕ УПРАВЛЕНИЕ',
        text: 'Суды, надзорные органы и оставшиеся независимые медиа подчинены администрации. Выборы отменены без назначения новой даты — сменить эту власть у урны больше нельзя. Отказать теперь почти невозможно и почти некому: цену такой управляемости страна платит инвестициями и людьми, которые умеют считать.',
        headlineHard: 'УКАЗ ПРЕЗИДЕНТА: УПРАВЛЕНИЕ ГОСУДАРСТВОМ ПРИВЕДЕНО К ЕДИНОМУ ПОРЯДКУ',
        textHard: 'Работа судов, надзорных органов и информационной сферы приведена к единому государственному стандарту. Проведение выборов отложено до нормализации обстановки. Собранность управления объявлена условием победы; отдельные хозяйственные структуры пересматривают инвестиционные планы.',
        priority: 10, chain: ['Указ президента', 'Институты подчинены', 'Тоталитарный режим', 'Бегство капитала', 'Производительность ↓'] } }) },
  { id: 'snap_election', group: 'power', label: 'Назначить досрочные выборы', cost: 28, cooldown: 16,
    // при тоталитаризме выборов не существует вовсе (noElections), назначать
    // досрочные — нечего: раньше кнопка предлагала пойти к урнам стране,
    // в которой урны уже отменены
    requires: (s) => (s.politicalRegime !== 'totalitarian') && (s.quartersToElection || 0) > 4,
    reqText: 'Доступно, если выборы вообще проводятся и до плановых больше 4 кв.',
    desc: 'Пойти к урнам через два квартала вместо оставшегося срока. При высоком рейтинге — способ обменять сегодняшнюю популярность на новый полный срок; при низком — способ проиграть раньше.',
    build: (s, difficulty) => ({
      patch: { snapElection: 2 },
      impulses: [
        makeImpulse('businessConfidence', -5, 'Досрочные выборы: неопределённость', 'default', difficulty, 'other'),
        makeImpulse('investment', -1.0, 'Досрочные выборы: инвестиции ждут результата', 'default', difficulty),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ НАЗНАЧАЕТ ДОСРОЧНЫЕ ВЫБОРЫ',
        text: `Голосование через 2 кв. вместо запланированных ${s.quartersToElection}. При рейтинге ${Math.round(s.approval)} из 100 это ставка: выиграть — значит получить полный срок заново, проиграть — уйти раньше, чем пришлось бы.`,
        /* При тоталитаризме кнопки нет вовсе, но при авторитарном режиме выборы
           формально проводятся — и подконтрольная газета не пишет о них как о
           ставке с двумя исходами: исход в ней известен заранее. */
        textHard: `Голосование состоится через 2 кв. вместо запланированных ${s.quartersToElection}. Руководство страны намерено досрочно получить подтверждение всенародной поддержки выбранного курса.`,
        priority: 9 },
    }) },

  { id: 'labor', group: 'reform', label: 'Реформа рынка труда', cost: 26, once: true,
    desc: 'Упростить наём и увольнение, перестроить пособия. Через два года структурная безработица ниже почти на процентный пункт — но первыми это почувствуют те, кого увольняют, и они это запомнят.',
    build: (s, difficulty) => {
      // при авторитаризме и тем более тоталитаризме государственная пресса не
      // станет сама печатать, что профсоюзы вышли на протест против решения
      // власти, — «реформа встречена с пониманием» и есть та версия, которую
      // такая пресса про себя предпочла бы написать
      const authoritarianPress = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
      return {
        patch: { reform: 'labor' },
        impulses: [
          makeImpulse('unemployment', 0.45, 'Реформа рынка труда: перестройка занятости', 'default', difficulty),
          makeImpulse('approvalPush', -6, 'Непопулярная реформа рынка труда', 'fast', difficulty, 'other'),
          makeImpulse('tensionPush', 11, 'Профсоюзы против реформы рынка труда', 'fast', difficulty, 'other'),
        ],
        news: { cat: 'gov', headline: 'ОБЪЯВЛЕНА РЕФОРМА РЫНКА ТРУДА',
          text: authoritarianPress
            ? 'Правила найма и увольнения переписываются, пособия привязываются к активному поиску работы. Официально — реформа встречена трудовыми коллективами с пониманием и поддержкой.'
            : 'Правила найма и увольнения переписываются, пособия привязываются к активному поиску работы. Профсоюзы объявляют протест; экономисты напоминают, что структурная безработица снижается не указом, а годами.',
          priority: 8, chain: ['Реформа объявлена', 'Протест профсоюзов', 'Перестройка занятости', 'Структурная безработица ↓'] },
      };
    } },
  { id: 'pension', group: 'reform', label: 'Пенсионная реформа', cost: 42, once: true,
    desc: 'Поднять возраст выхода на пенсию. Самое непопулярное решение из возможных — и единственное, которое одновременно расширяет рабочую силу и снимает постоянную нагрузку с бюджета.',
    build: (s, difficulty) => ({
      patch: { reform: 'pension' },
      impulses: [
        sustainedImpulse('laborForce', 0.18, 12, 'Пенсионная реформа: рабочая сила расширяется'),
        makeImpulse('approvalPush', -13, 'Пенсионная реформа', 'fast', difficulty, 'other'),
        makeImpulse('tensionPush', 22, 'Пенсионная реформа', 'fast', difficulty, 'other'),
        makeImpulse('consumerConfidence', -5, 'Пенсионная реформа', 'default', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ОБЪЯВЛЯЕТ ПОВЫШЕНИЕ ПЕНСИОННОГО ВОЗРАСТА',
        text: `Рейтинг власти ${Math.round(s.approval)} из 100 до объявления. Бюджет получает постоянную экономию, рынок труда — дополнительные руки, а власть — самый тяжёлый разговор со страной из всех возможных.`,
        textHard: 'Пенсионный возраст повышается. Решение объясняется растущей продолжительностью жизни и заботой о будущих поколениях: бюджет получает постоянную экономию, экономика — дополнительные рабочие руки.',
        priority: 9, chain: ['Реформа объявлена', 'Рейтинг ↓↓', 'Напряжённость ↑', 'Рабочая сила ↑', 'Выплаты ↓'] },
    }) },
  { id: 'courts', group: 'reform', label: 'Судебная реформа', cost: 34, once: true,
    // независимый суд и полный контроль над институтами — противоположные
    // вещи: указ «Полный контроль» (totalize) прямо забирает суды под
    // администрацию, реформа обещает ровно обратное. При тоталитарном
    // режиме такого выбора для президента уже не существует.
    requires: (s) => s.politicalRegime !== 'totalitarian',
    reqText: 'Недоступно при тоталитарном режиме: независимых судов при нём уже нет',
    desc: 'Независимые суды и защита собственности. Ничего не даёт в этом квартале и почти всё — в горизонте пяти лет: премия за риск, прямые инвестиции и производительность зависят от того, можно ли выиграть спор у государства.',
    build: (s, difficulty) => ({
      patch: { reform: 'courts' },
      impulses: [
        sustainedImpulse('productivity', 0.17, 10, 'Судебная реформа: издержки на защиту собственности падают'),
        sustainedImpulse('fdi', 0.9, 8, 'Судебная реформа привлекает прямые инвестиции', 'other'),
        sustainedImpulse('businessConfidence', 0.8, 8, 'Судебная реформа', 'other'),
        makeImpulse('tensionPush', 8, 'Судебная реформа задевает интересы элит', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'СУДЕБНАЯ РЕФОРМА: ПРЕЗИДЕНТ ОТДАЁТ ЧАСТЬ ВЛАСТИ',
        text: 'Порядок назначения судей выводится из-под администрации, вводится реальная процедура спора с государством. Эффект не измеряется в этом квартале — он измеряется в премии за риск через пять лет.',
        priority: 8, chain: ['Реформа объявлена', 'Элиты недовольны', 'Защита собственности ↑', 'Премия за риск ↓', 'Инвестиции ↑'] },
    }) },
  { id: 'deregulation', group: 'reform', label: 'Дерегулирование бизнеса', cost: 24, once: true,
    desc: 'Снять избыточные требования и проверки. Быстрая по меркам реформ отдача в производительности — и расплата доверием, когда первая же авария окажется на первых полосах.',
    build: (s, difficulty) => ({
      patch: { reform: 'deregulation' },
      impulses: [
        sustainedImpulse('productivity', 0.21, 6, 'Дерегулирование: издержки соблюдения требований падают'),
        makeImpulse('businessConfidence', 7, 'Дерегулирование', 'default', difficulty, 'other'),
        makeImpulse('investment', 0.8, 'Дерегулирование', 'default', difficulty),
        makeImpulse('govTrust', -4, 'Снятие требований воспринято как отказ государства от контроля', 'default', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ПОДПИСЫВАЕТ ПАКЕТ ДЕРЕГУЛИРОВАНИЯ',
        text: 'Треть отраслевых требований отменена, плановые проверки сокращены. Бизнес доволен, контролирующие ведомства предупреждают, что цену такого решения обычно узнают внезапно.',
        priority: 7 },
    }) },
  { id: 'education', group: 'reform', label: 'Реформа образования', cost: 28, once: true,
    desc: 'Не про объём расходов — про их качество: программы, отбор преподавателей, связь школы с рынком труда. Самая медленная реформа в наборе: полный эффект — через четыре года, зато он не откатывается.',
    build: (s, difficulty) => ({
      patch: { reform: 'education' },
      impulses: [
        makeImpulse('approvalPush', 2.5, 'Реформа образования', 'fast', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ОБЪЯВЛЕНА РЕФОРМА ОБРАЗОВАНИЯ',
        text: 'Программы, отбор преподавателей и связь с работодателями переписываются целиком. Человеческий капитал — единственная величина в модели, которая растёт четыре года и не падает обратно.',
        priority: 7 },
    }) },
  { id: 'infra_program', group: 'reform', label: 'Национальный проект: инфраструктура', cost: 26, cooldown: 16,
    desc: 'Указ, который обязан исполнить Минфин: реальные госинвестиции растут ускоренно десять кварталов. Инфраструктура и потенциал растут вместе с дефицитом и долгом — за проект платит бюджет, а не политический капитал.',
    build: (s, difficulty) => ({
      impulses: [
        sustainedImpulse('govInvestmentPush', 3.4, 10, 'Национальный проект: инфраструктура'),
        makeImpulse('approvalPush', 3, 'Национальный проект: инфраструктура', 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', 4, 'Национальный проект: инфраструктура', 'default', difficulty, 'other'),
      ],
      news: { cat: 'gov', headline: 'ПРЕЗИДЕНТ ЗАПУСКАЕТ НАЦИОНАЛЬНЫЙ ПРОЕКТ ПО ИНФРАСТРУКТУРЕ',
        text: `Указ обязывает Минфин ускорить реальные госинвестиции на несколько лет вперёд. Долг ${fmt1(s.debtToGdp)}% ВВП, баланс бюджета ${fmtSigned1(s.budgetBalancePctGdp)}% — считать придётся не президенту.`,
        priority: 8, chain: ['Указ подписан', 'Госинвестиции ↑', 'Дефицит ↑', 'Инфраструктура ↑', 'Потенциал ↑'] },
    }) },
];
const PRES_BY_ID = {};
PRESIDENT_ACTIONS.forEach((a) => { PRES_BY_ID[a.id] = a; });

const presActionAvailable = (a, s, cooldowns) => {
  if (a.once && (s.reforms || {})[a.id] !== undefined) return false;
  if ((cooldowns[`pres:${a.id}`] || 0) > 0) return false;
  if (a.requires && !a.requires(s)) return false;
  return true;
};

/* Прирост политического капитала за квартал. Популярного президента в растущей
   экономике власть кормит сама; в кризисе капитал тает, и рычаги отключаются
   раньше, чем экономика успевает развалиться, — это и есть цена бездействия.

   Слагаемое -0.075 * текущий капитал — не косметика: без него бездействующий
   президент за три года набирал бы предельные 100 и мог позволить себе вообще
   всё. С ним у капитала есть равновесие (около 58 при спокойной экономике и
   рейтинге 55): накопить на пенсионную реформу можно, накопить на все реформы
   сразу — нет. Репрессивный режим концентрирует власть и поднимает это
   равновесие почти до 90 — ровно тот размен, ради которого к нему и идут, а два
   одновременных кризиса с беспорядками обнуляют капитал за несколько кварталов. */
function politicalCapitalRegen(x) {
  const cap = clamp(Number.isFinite(x.politicalCapital) ? x.politicalCapital : 55, 0, 100);
  return clamp(3.6
    + clamp((x.approval - 50) / 8, -3.5, 3.5)
    + clamp((x.gdpGrowth - x.potentialGrowth) * 0.5, -1.5, 1.5)
    - (x.activeCrises || []).length * 1.2
    - (x.unrestActive ? 2.5 : 0)
    + (x.politicalRegime === 'totalitarian' ? 4.2 : x.politicalRegime === 'authoritarian' ? 2.4 : 0)
    - 0.075 * cap,
    -10, 9);
}

/* Вероятность военного переворота за квартал. Вынесена отдельно, потому что её
   показывает и интерфейс: риск, о котором нельзя узнать заранее, — это не механика,
   а лотерея. Армия выступает не «иногда», а когда совпадают напряжение, нищета,
   кризисы, презрение к правителю и пустая казна политического капитала: у власти,
   которой есть чем платить своим, переворотов не бывает. */
function militaryCoupRisk(x) {
  const tension = clamp(x.politicalTension || 0, 0, 100);
  const pressure = clamp((tension - 40) / 45, 0, 1);
  const misery = clamp(((x.unemployment || 0) - (x.nairu || 5)) / 6, 0, 1) * 0.5
    + clamp(((x.inflation || 0) - 8) / 20, 0, 1) * 0.5;
  const crisisLoad = clamp((x.activeCrises || []).length / 2, 0, 1);
  const weakness = clamp((45 - (x.approval || 0)) / 40, 0, 1);
  const naked = clamp((30 - (Number.isFinite(x.politicalCapital) ? x.politicalCapital : 55)) / 30, 0, 1);
  /* Пустая казна политического капитала — множитель, а не отдельное слагаемое.
     Слагаемым она поднимала армию и в спокойной популярной стране: президент,
     потративший капитал на реформы, получал переворот при напряжённости 12 и
     рейтинге 53. Армия выступает там, где есть недовольство; отсутствие денег
     на своих только делает выступление вероятнее. Нет недовольства — нет и риска. */
  // Нищета и кризисы сами по себе не поднимают армию против спокойного и
  // популярного лидера — иначе тяжёлая рецессия при рейтинге 52 и напряжённости
  // 38 (ниже обоих порогов pressure/weakness) всё равно давала переворот через
  // одну лишь безработицу. Их вклад отпирается vulnerability — минимальной
  // политической уязвимостью (хоть немного напряжения ИЛИ хоть немного
  // непопулярности): нет её — армии не за что зацепиться, экономика бы ни была.
  /* Силовики — те, кто на самом деле выводит танки: лояльные почти исключают
     переворот, потерянные делают его возможным и при терпимом рейтинге. */
  /* Считается не абсолютная поддержка силовиков, а их отставание от страны в целом:
     в кризисе, когда власть непопулярна у всех, армия недовольна ровно как все, и это
     уже учтено через рейтинг (weakness). Отдельный риск — когда силовиков обидели
     особо: урезали оборону, не слушают, а остальным живётся терпимо. */
  const sil = x.groupSupport && Number.isFinite(x.groupSupport.siloviki) ? x.groupSupport.siloviki : null;
  const silGap = sil === null ? 0 : sil - (x.approval || 0);
  const silMult = sil === null ? 1 : sil >= 60 ? 0.35 : silGap < -6 ? 1 + Math.min(1.5, (-6 - silGap) / 10) : silGap > 8 ? 0.75 : 1;
  const silAngry = sil !== null && sil < 35 && silGap < -6;
  const vulnerability = clamp(Math.max(pressure, weakness, silAngry ? 0.3 : 0) * 2, 0, 1);
  const grudge = silAngry ? Math.min(1, (-6 - silGap) / 24) * 0.05 : 0;
  const trouble = pressure * 0.11 + weakness * 0.045 + grudge + (misery * 0.055 + crisisLoad * 0.055) * vulnerability;
  return clamp(trouble * silMult * (1 + naked * 0.8) * (x.unrestActive ? 1.7 : 1), 0, 0.28);
}

/* Разбор пакета решений президента за квартал: списывает капитал, ставит
   кулдауны, собирает импульсы и новости. Проверки дублируют интерфейс намеренно —
   состояние может прийти из сохранения, а движок обязан оставаться замкнутым. */
// Пока парламент жив и не распущен указом, а страна не авторитарна, реформа —
// это не решение президента в одиночку, а внесённый в парламент законопроект.
// Порог, а не бросок кубика: при таком напряжении или таком провальном
// рейтинге оппозиция гарантированно консолидируется против инициативы —
// исход зависит от того, что игрок сделал со страной, а не от удачи. Роспуск
// парламента или авторитарный/тоталитарный режим убирают этот риск вовсе —
// именно поэтому концентрация власти работает, а не только вредит.
function parliamentBlocksReform(s) {
  if (s.parliamentDissolved) return false;
  if (s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian') return false;
  const tension = s.politicalTension || 0;
  const approval = Number.isFinite(s.approval) ? s.approval : 50;
  return tension >= 65 || approval <= 30;
}

function applyPresidentActions(s, ids, cooldowns, difficulty) {
  const impulses = []; const newsSpecs = []; const patch = {};
  let spent = 0; let budget = Number.isFinite(s.politicalCapital) ? s.politicalCapital : 55;
  const applied = []; const blocked = [];
  (ids || []).forEach((id) => {
    const a = PRES_BY_ID[id];
    if (!a || !presActionAvailable(a, s, cooldowns) || a.cost > budget) return;
    if (a.group === 'reform' && parliamentBlocksReform(s)) {
      // законопроект не прошёл: часть капитала уже потрачена на лоббирование,
      // но эффект и отметка «once» не применяются — попробовать снова можно
      // в любой следующий квартал, реформа не считается использованной
      const blockCost = Math.round(a.cost * 0.4);
      budget -= blockCost; spent += blockCost; blocked.push(id);
      newsSpecs.push({ cat: 'gov', headline: `ПАРЛАМЕНТ ОТКЛОНИЛ ЗАКОНОПРОЕКТ: ${a.label.toUpperCase()}`,
        text: 'Голосов не хватило: при текущем напряжении в обществе и рейтинге власти оппозиция консолидировалась против инициативы. Часть политического капитала потрачена на лоббирование впустую — само право внести законопроект снова никуда не делось.',
        priority: 7, chain: ['Законопроект внесён', 'Напряжение/рейтинг', 'Голосов не хватило', 'Капитал потрачен впустую'] });
      return;
    }
    const r = a.build(s, difficulty) || {};
    budget -= a.cost; spent += a.cost; applied.push(id);
    if (a.cooldown) cooldowns[`pres:${a.id}`] = a.cooldown;
    (r.impulses || []).forEach((i) => impulses.push(i));
    /* Подконтрольная пресса не напечатает того, что печатает свободная:
       про раскол элит, про оппозицию и про рейтинг власти. Где формулировка
       прямо противоречит режиму, у новости есть вариант textHard — им
       и заменяется текст при авторитаризме и тоталитаризме. */
    if (r.news) {
      newsSpecs.push(publicNews(r.news, s));
    }
    Object.assign(patch, r.patch || {});
    if (r.patch && r.patch.reform) (patch.reforms = patch.reforms || []).push(r.patch.reform);
  });
  return { impulses, newsSpecs, spent, patch, applied, blocked };
}

/* Указание ведомству. Тот же каталог REQUESTS, что и для межведомственных
   запросов, но подписан президентом: авторитет добавляется к оценке, а чем
   меньше в стране институтов, тем меньше у ведомства возможности отказать.
   Согласие ЦБ стоит доверия к нему — это и есть цена управляемого центробанка. */
const PRES_DIRECTIVE_COST = 12;
function processPresidentialDirective(reqId, economy, cbPersonaId, mofPersonaId, decisions, strength) {
  const req = REQUESTS.find((r) => r.id === reqId);
  if (!req) return null;
  // чем больше просят сверх обычного, тем охотнее ведомство отказывает
  const str = clamp(Number.isFinite(strength) ? strength : 1, 0.2, 4);
  // from: 'ministry_finance' — просьбы к ЦБ, from: 'central_bank' — к Минфину
  const toCb = req.from === 'ministry_finance';
  const persona = toCb ? getCbPersona(cbPersonaId) : getMofPersona(mofPersonaId);
  const regime = economy.politicalRegime || 'democracy';
  const authority = regime === 'totalitarian' ? 4.0 : regime === 'authoritarian' ? 1.8
    : regime === 'crisis' ? 0.15 : 0.55;
  const score = req.fit(economy) + (req.bias[persona.id] || 0) + authority
    + clamp((economy.approval - 50) / 55, -0.9, 0.9)
    - (str - 1) * 0.8;
  let status = score >= 1.0 ? 'accepted' : score >= 0.1 ? 'partial' : 'rejected';
  /* Ведомство могло и само идти в ту же сторону: ЦБ снижает ставку по своим
     причинам, а президент как раз этого и требует. Раньше в ленте стояло
     «ОТКАЗ» — и следующей строкой «ЦБ снизил ставку». Теперь собственное решение
     ведомства засчитывается: совпало с требованием — исполнено, шаг в ту же
     сторону, но меньше — частично. Уступки сверх своего решения тут нет, поэтому
     и удара по независимости ЦБ тоже нет. */
  const own = directiveProgress(reqId, economy, decisions, economy, str);
  let byOwn = false;
  if (Number.isFinite(own) && own >= 0.9 && status !== 'accepted') { status = 'accepted'; byOwn = true; }
  else if (Number.isFinite(own) && own >= 0.3 && status === 'rejected') { status = 'partial'; byOwn = true; }
  const k = byOwn ? 0 : status === 'accepted' ? 1 : status === 'partial' ? 0.5 : 0;
  // независимость ЦБ — не декларация, а то, насколько заметно он выполняет
  // политические указания; рынок это видит и переоценивает якорь ожиданий
  const credibilityHit = toCb && k > 0 ? -7 * k : 0;
  const finalDecisions = k > 0 ? { ...decisions, ...req.apply(decisions, k * str, economy),
    // согласие на военные расходы — обязательство на два года (см. defenseCommit)
    ...(req.id === 'defense_up' ? { defensePledge: true } : {}) } : decisions;
  const ownNote = byOwn ? (status === 'accepted'
    ? 'Ведомство и без указания шло в ту же сторону — решение совпало с требованием. '
    : 'Шаг в ту же сторону ведомство сделало по своим причинам, но меньше, чем требовали. ') : '';
  return {
    req, status, score, toCb, persona, strength: str, ask: askText(req, str, 'president', regime),
    decisions: finalDecisions, byOwn,
    text: ownNote + requestOutcomeText(req, status, economy, finalDecisions),
    credibilityHit,
    tension: status === 'rejected' ? 5 : 0,
    coordination: status === 'accepted' ? 5 : status === 'partial' ? 2 : -6,
  };
}

/* Смена руководителя ведомства. Досрочная отставка главы ЦБ — это заявление о том,
   что независимость центрального банка кончается там, где начинается администрация:
   бьёт по доверию тем сильнее, чем меньше человек проработал. */
const APPOINT_COST = { central_bank: 22, ministry_finance: 14 };
const CB_FULL_TERM = 12;
/* persona передаётся целиком (не только имя): «Прагматик»/«Технократ» — это ярлык
   архетипа для интерфейса игрока, а не имя человека, и печатать его в заголовке
   новости капслоком, как если бы это было чьё-то имя, — читается ровно так же
   нелепо, как заголовок «ПРЕЗИДЕНТ НАЗНАЧАЕТ ГЛАВОЙ ЦБ: ЯСТРЕБ». Настоящая пресса
   пишет о курсе нового человека, а не воспроизводит игровой ярлык. */
function appointmentEffects(kind, s, difficulty, persona) {
  const tenure = (kind === 'central_bank' ? s.cbTenure : s.mofTenure) || 0;
  const early = kind === 'central_bank' ? Math.max(0, CB_FULL_TERM - tenure) / CB_FULL_TERM : 0;
  const impulses = [];
  if (kind === 'central_bank') {
    impulses.push(makeImpulse('cbCredibilityPush', -6 - 9 * early, 'Смена главы ЦБ решением президента', 'fast', difficulty, 'other'));
    impulses.push(makeImpulse('riskPremium', 0.15 + 0.25 * early, 'Смена главы ЦБ решением президента', 'default', difficulty));
  } else {
    impulses.push(makeImpulse('businessConfidence', -4, 'Смена министра финансов', 'default', difficulty, 'other'));
  }
  const stance = String(persona.title || persona.name || '').toLowerCase();
  const news = {
    cat: kind === 'central_bank' ? 'cb' : 'gov',
    headline: kind === 'central_bank'
      ? 'ПРЕЗИДЕНТ МЕНЯЕТ ГЛАВУ ЦЕНТРАЛЬНОГО БАНКА'
      : 'ПРЕЗИДЕНТ МЕНЯЕТ МИНИСТРА ФИНАНСОВ',
    text: kind === 'central_bank'
      ? `Предшественник проработал ${tenure} кв. ${early > 0.5
        ? 'Досрочная отставка главы ЦБ читается однозначно: независимость заканчивается там, где начинается администрация, и ожидания это учтут.'
        : 'Срок отработан полностью, и смена выглядит плановой — доверие к политике задето, но не сломано.'} Новый глава известен как сторонник курса «${stance}».`
      : `Смена руководства Минфина меняет и логику бюджета: новый министр придёт со своим представлением о том, что такое допустимый дефицит, — в правительстве его называют сторонником курса «${stance}».`,
    priority: 9,
  };
  return { impulses, news, cost: APPOINT_COST[kind] };
}
const getPresPersona = (id) => PRESIDENT_PERSONAS.find((p) => p.id === id) || PRESIDENT_PERSONAS[0];

/* Наклон каждой просьбы: насколько она «популистская» и насколько «реформаторская».
   Вместе с req.fit(state) это и даёт выбор президента — что именно он потребует
   в текущей ситуации, исходя из своего характера, а не из списка по порядку. */
const PRES_REQ_LEAN = {
  rate_cut: { pop: 1.0, ref: -0.3 }, rate_hike: { pop: -1.0, ref: 0.5 }, rate_hold: { pop: 0.5, ref: -0.1 },
  liquidity_help: { pop: 0.3, ref: 0.1 }, capreq_ease: { pop: 0.4, ref: -0.2 }, fx_support: { pop: 0.5, ref: -0.1 },
  infra_up: { pop: 0.6, ref: 0.6 }, deficit_cut: { pop: -1.0, ref: 0.6 }, transfers_freeze: { pop: -1.0, ref: 0.4 },
  tax_relief_business: { pop: -0.2, ref: 0.6 }, fiscal_hold: { pop: -0.6, ref: 0.4 }, defense_up: { pop: 0.4, ref: -0.2 },
};

/* Насколько выполнено требование — доля от 0 до 1, а не «да/нет». Раньше снижение
   ставки на 0.5 п.п. вместо запрошенного 1 п.п. считалось полным выполнением
   (хватало сорока процентов пути), и это читалось как поблажка: половина просьбы —
   это половина просьбы. Направление берём из самой просьбы: применяем её к решениям
   на начало квартала и смотрим, куда и насколько сдвинулся игрок.

   Отдельный случай — просьбы «не делать» (req.hold): их выполняют бездействием, и
   старая проверка возвращала по ним null («без ответа») даже когда игрок честно
   ничего не трогал. Теперь такая просьба выполнена ровно тогда, когда запрещённое
   движение не сделано. */
function directiveProgress(reqId, baseDecisions, finalDecisions, economy, strength) {
  const req = REQUESTS.find((r) => r.id === reqId);
  if (!req || !baseDecisions || !finalDecisions) return null;
  if (req.hold) {
    const ref = economy || baseDecisions;
    let worst = 1;
    req.hold.forEach(({ key, dir }) => {
      const before = Number.isFinite(ref[key]) ? ref[key] : baseDecisions[key];
      const after = finalDecisions[key];
      if (![before, after].every(Number.isFinite)) return;
      const step = (after - before) * dir;
      if (step <= 1e-6) return;               // в запретную сторону не пошли
      // чем дальше шагнули в запретную сторону, тем меньше выполнено. Знаменатель
      // раньше был настолько щедрым, что даже пара обычных шагов ползунка (для
      // ставки — 0.5 п.п. при шаге 0.25) всё ещё читалась как «выполнено»: игрок
      // повышал ставку вопреки прямому «не повышать» и видел «ВЫПОЛНЕНО». Втрое
      // меньший знаменатель делает шкалу чувствительной к любому заметном шаге,
      // а не только к развороту на полную запрошенную величину.
      worst = Math.min(worst, clamp(1 - step / (Math.max(0.5, Math.abs(before) * 0.2 + 1) / 3), 0, 1));
    });
    return worst;
  }
  const want = req.apply(baseDecisions, strength || 1, economy || baseDecisions);
  let total = 0; let sum = 0;
  Object.keys(want).forEach((k) => {
    const target = want[k]; const before = baseDecisions[k]; const after = finalDecisions[k];
    if (![target, before, after].every(Number.isFinite)) return;
    const need = target - before;
    if (Math.abs(need) < 1e-6) return;
    total += 1;
    sum += clamp((after - before) / need, 0, 1);
  });
  if (!total) return null; // просить было нечего — не в чем и отказывать
  return sum / total;
}
// словами: полностью, наполовину или никак
const DIRECTIVE_FULL = 0.75;
const DIRECTIVE_PART = 0.35;
const directiveVerdict = (p) => (p === null || p === undefined ? null
  : p >= DIRECTIVE_FULL ? 'met' : p >= DIRECTIVE_PART ? 'partial' : 'ignored');

/* Решения президента-бота на ближайший квартал: что он потребует, что сделает сам
   и не пора ли ему поменять руководителя ведомства, которым игрок не управляет.
   Считается ДО квартала — требование должно быть видно игроку прежде, чем он
   примет решения, иначе это не требование, а претензия задним числом. */
// на ком держится власть каждого характера бота-президента (см. SOCIAL_GROUPS)
const BOT_CORE_GROUPS = {
  technocrat: ['business', 'public'],
  populist: ['pensioners', 'workers', 'regions'],
  strongman: ['siloviki', 'pensioners'],
  reformer: ['business', 'youth'],
};
function botPresident(s, personaId, difficulty, ctx) {
  const P = getPresPersona(personaId);
  const opts = ctx || {};
  const playerBranch = opts.playerBranch || null; // 'monetary' | 'fiscal' | null
  const capital = Number.isFinite(s.politicalCapital) ? s.politicalCapital : 55;
  const sat = Number.isFinite(s.presidentSatisfaction) ? s.presidentSatisfaction : 60;
  const crises = (s.activeCrises || []).length;
  const tension = s.politicalTension || 0;

  /* --- 1. что президент делает сам --- */
  const wish = [];
  if (tension >= 50 && P.power > 0.5) wish.push('crackdown');
  if (tension >= 62 && P.power >= 0.9 && !s.parliamentDissolved) wish.push('dissolve');
  if (P.power >= 0.9 && s.politicalRegime === 'authoritarian' && s.parliamentDissolved) wish.push('seize_control');
  if (s.parliamentDissolved && P.power < 0 && tension < 35) wish.push('restore_parliament');
  if (s.approval < 45) wish.push('address');
  if (tension >= 40 && P.power <= 0.5) wish.push('elite_deal');
  if (s.approval < 48) wish.push('address');
  if (P.reform >= 0.8) {
    // реформатор занимается реформами не «когда припрёт», а постоянно: доступность
    // и цена их и так ограничивают — presActionAvailable отсеет уже проведённые
    if (s.unemployment > s.nairu + 1) wish.push('labor');
    wish.push('courts', 'deregulation', 'education');
    if (s.debtToGdp > 90) wish.push('pension');
  }
  if (P.populism < 0 && s.debtToGdp > 88) wish.push('pension');
  // на дне списка — то, чем можно заняться всегда: кулдаун в 16 кварталов и цена
  // сами не дадут президенту подписывать нацпроекты каждый год
  wish.push('infra_program');
  /* Группы общества: бот бережёт свою опору и не добивает тех, кого уже теряет.
     Потерянные силовики — прямая дорога к перевороту, поэтому их спасают первыми;
     провалившиеся области лечат нацпроектом, забытых пенсионеров — обращением. */
  const sup = s.groupSupport || {};
  const low = (g, lim) => Number.isFinite(sup[g]) && sup[g] < lim;
  const core = BOT_CORE_GROUPS[P.id] || [];
  if (low('siloviki', 40)) wish.unshift('military_parade');
  if (low('regions', 38)) wish.unshift('infra_program');
  if (low('pensioners', 38) && core.includes('pensioners')) wish.unshift('address');
  const hurtsAllies = (id) => Object.entries(ACTION_GROUP_EFFECTS[id] || {}).some(([g, v]) => v < 0
    && ((core.includes(g) && low(g, 45)) || (v <= -10 && low(g, 35))));
  // берём по одному решению за квартал и только если капитала заметно больше цены:
  // бот, спускающий капитал в ноль, перестаёт быть силой, с которой считаются
  const actions = [];
  for (const id of wish) {
    const a = PRES_BY_ID[id];
    if (!a || actions.length) continue;
    if (a.cost > capital - 12) continue;
    // силовое подавление — исключение: силовику оно и есть способ удержать власть
    if (hurtsAllies(id) && !(id === 'crackdown' && P.id === 'strongman')) continue;
    if (!presActionAvailable(a, s, opts.cooldowns || {})) continue;
    actions.push(id);
  }

  /* --- 2. кому и что он требует --- */
  const branchOf = (req) => (req.from === 'ministry_finance' ? 'monetary' : 'fiscal');
  /* Вес характера намеренно больше единицы: с весом 1 оценка ситуации (req.fit)
     перекрывала характер почти везде, и все четыре президента требовали одного и
     того же. Теперь характер решает спорные случаи — но не заставляет популиста
     требовать снижения ставки при инфляции в десять процентов. */
  const scoreReq = (req) => {
    const lean = PRES_REQ_LEAN[req.id] || { pop: 0, ref: 0 };
    return req.fit(s) + lean.pop * P.populism * 1.8 + lean.ref * P.reform * 1.3
      // ведомство игрока президенту интереснее — но не настолько, чтобы соседнее
      // ведомство вообще никогда не получало указаний: президент, который двадцать
      // кварталов подряд разговаривает только с одним из двух, выглядит не главой
      // государства, а надзирателем за игроком. Разница в 0,6 — это «при прочих
      // равных к игроку», а не «к игроку всегда»
      + (playerBranch && branchOf(req) === playerBranch ? 0.6 : 0);
  };
  const pool = REQUESTS;
  /* Выбираем не строго лучшее, а случайное из близких по смыслу: президент, который
     двенадцать кварталов подряд требует одно и то же слово в слово, читается как
     сломанный, а не как упрямый. Прошлое требование при прочих равных пропускаем. */
  const scored = pool.map((r) => ({ req: r, sc: scoreReq(r) })).sort((a, b) => b.sc - a.sc);
  const band = (lim) => scored.filter((x) => x.sc >= scored[0].sc - lim);
  /* Сразу после требования то же самое не повторяем: ищем замену сначала в узкой
     полосе, потом в широкой, а если равноценной альтернативы нет — президент просто
     молчит этот квартал. Через пару кварталов он к своему требованию вернётся —
     и вот тогда повтор читается как настойчивость, а не как заевшая пластинка.
     Это же и спасает довольство: требование каждый квартал обнуляло бы его за
     четыре хода, сколько бы игрок ни старался в остальном. */
  // ноль — валидное «требовал в прошлом квартале», поэтому не `|| 99`
  const dirAgo = Number.isFinite(opts.lastDirectiveAgo) ? opts.lastDirectiveAgo : 99;
  const avoidLast = dirAgo <= 2;
  const notLast = (list) => (avoidLast ? list.filter((x) => x.req.id !== opts.lastReqId) : list);
  const shortlist = notLast(band(0.5)).length ? notLast(band(0.5)) : notLast(band(1.2));
  const best = shortlist.length ? shortlist[Math.floor(rng() * shortlist.length)] : null;
  // после только что выданного требования планка выше: иначе давление идёт каждый
  // квартал и довольство рушится быстрее, чем игрок успевает что-то показать
  const threshold = 1.5 - P.pressure * 1.2 + (sat > 70 ? 0.4 : 0)
    + (dirAgo <= 1 ? 0.8 : 0);
  // требование стоит политического капитала: на нуле давить не на что
  const canPressure = capital >= PRES_DIRECTIVE_COST + 4;
  const directive = canPressure && best && best.sc >= threshold
    ? { reqId: best.req.id, branch: branchOf(best.req), toPlayer: branchOf(best.req) === playerBranch,
      req: best.req, ask: askText(best.req, 1, 'president', s.politicalRegime) }
    : null;

  /* --- 3. смена руководителя ведомства, которым игрок не управляет --- */
  let appointBot = null;
  const botBranch = playerBranch === 'monetary' ? 'fiscal' : playerBranch === 'fiscal' ? 'monetary' : null;
  const tenure = botBranch === 'monetary' ? (s.cbTenure || 0) : (s.mofTenure || 0);
  if (botBranch && tenure >= 8 && capital > 40) {
    if (botBranch === 'monetary') {
      const want = P.populism > 0.5 ? 'dove' : P.populism < -0.2 ? 'hawk' : 'pragmatic';
      if (want !== opts.cbPersonaId && (s.inflation > s.inflationTarget + 3 || s.unemployment > s.nairu + 2)) appointBot = { kind: 'central_bank', persona: want };
    } else {
      const want = P.populism > 0.5 ? 'populist' : P.reform > 0.7 ? 'technocrat' : 'austerity';
      if (want !== opts.mofPersonaId && (s.debtToGdp > 90 || s.unemployment > s.nairu + 2)) appointBot = { kind: 'ministry_finance', persona: want };
    }
  }

  /* --- 4. как это выглядит со стороны --- */
  const mood = sat >= 70 ? 'доволен' : sat >= 40 ? 'сдержан' : sat >= 20 ? 'недоволен' : 'на грани';
  const quote = (() => {
    if (sat < 20) return 'Я назначаю людей не для того, чтобы они объясняли мне, почему ничего нельзя сделать. Терпение администрации не бесконечно.';
    if (crises > 0) return `В стране ${crises === 1 ? 'кризис' : 'сразу несколько кризисов'}, и объяснения меня интересуют меньше, чем результат. Работайте.`;
    if (P.id === 'populist') return `Люди не едят проценты по ставке и не носят домой бюджетное правило. Рейтинг власти ${Math.round(s.approval)} — вот единственная отчётность, которая имеет значение.`;
    if (P.id === 'strongman') return 'Государство — это вертикаль. Ведомства исполняют, а не обсуждают; обсуждать будем после того, как исполнено.';
    if (P.id === 'reformer') return 'Всё, что мы сделаем за этот срок, начнёт работать при следующем. Это не повод не делать — это единственная причина делать сейчас.';
    return 'У ведомств есть свои мандаты, и я в них не вмешиваюсь без нужды. Нужда определяется цифрами, а не настроением.';
  })();
  return {
    persona: P, actions, directive, appointBot, mood, quote,
    satisfaction: sat,
    newsHeadline: `ПРЕЗИДЕНТ ${directive
      ? `→ ${directive.branch === 'monetary' ? 'ЦБ' : 'МИНФИН'}: ${directive.req.label.toUpperCase()}`
      : 'О ПОЛОЖЕНИИ ДЕЛ'}`,
    demand: directive ? `Президент (${P.name}): ${askText(directive.req, 1, 'president', s.politicalRegime)}` : null,
  };
}

/* Насколько президент доволен ведомством игрока. Требование выполнено — плюс,
   проигнорировано — заметный минус; сверх того он смотрит на рейтинг и рост, потому
   что политику в конечном счёте оценивают не по послушанию. */
function presidentSatisfactionNext(prev, x) {
  // met может быть булевым (старые сохранения) или долей выполнения 0..1
  const raw = x.directiveMet;
  const p = raw === true ? 1 : raw === false ? 0 : Number.isFinite(raw) ? clamp(raw, 0, 1) : null;
  const harsh = clamp(1.6 - x.patience * 0.6, 0.6, 1.3);
  // половина просьбы — половина результата: выполнил полностью +9, частично около
  // нуля, проигнорировал — полный минус
  const base = p === null ? 1.8 : p >= DIRECTIVE_FULL ? 9 : p >= DIRECTIVE_PART ? 1 : -13 * harsh * (1 - p / DIRECTIVE_PART * 0.4);
  return clamp(prev + base
    + clamp((x.approval - 50) / 12, -2.5, 2.5)
    + clamp((x.gdpGrowth - x.potentialGrowth) * 0.6, -1.5, 1.5)
    - (x.activeCrises || []).length * 1.2, 0, 100);
}

/* =========================================================================================
   ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ (роли «премьер-министр» и «президент»): у них, в отличие от
   ЦБ и Минфина, нет бота-оппонента со своими требованиями — конкретные, измеримые
   обещания на срок до выборов замещают то давление, которое остальным ролям
   создаёт партнёр по власти. target/baseline считаются один раз в момент
   начала срока (pickPromises) и хранятся как обычные числа — не функции —
   чтобы объект без проблем переживал JSON (сохранения, снапшоты).
========================================================================================= */
const round1 = (v) => Math.round(v * 10) / 10;
const PROMISE_POOL = [
  { id: 'inflation_tame', label: 'Обуздать инфляцию',
    target: (s) => round1(s.inflationTarget + 1),
    metric: (e) => e.inflation, direction: 'below',
    describe: (t) => `Инфляция не выше ${fmt1(t)}% к выборам` },
  { id: 'jobs_for_all', label: 'Работа для всех',
    target: (s) => round1(s.nairu + 1),
    metric: (e) => e.unemployment, direction: 'below',
    describe: (t) => `Безработица не выше ${fmt1(t)}% к выборам` },
  { id: 'debt_discipline', label: 'Не наращивать долг',
    target: (s) => round1(s.debtToGdp),
    metric: (e) => e.debtToGdp, direction: 'below',
    describe: (t) => `Госдолг не выше ${fmt1(t)}% ВВП — уровня на начало срока` },
  { id: 'growth_promise', label: 'Обеспечить рост',
    target: () => 4, baseline: (s) => s.gdp,
    metric: (e, base) => (e.gdp / base - 1) * 100, direction: 'above',
    describe: (t) => `Реальный ВВП вырастет минимум на ${fmt1(t)}% за срок` },
  { id: 'strong_currency', label: 'Крепкая валюта',
    target: () => 15, baseline: (s) => s.exchangeRate,
    metric: (e, base) => (e.exchangeRate / base - 1) * 100, direction: 'below',
    describe: (t) => `Курс не ослабнет больше чем на ${fmt1(t)}% за срок` },
  { id: 'budget_control', label: 'Бюджет под контролем',
    target: () => 3,
    metric: (e) => -e.budgetBalancePctGdp, direction: 'below',
    describe: (t) => `Дефицит бюджета не больше ${fmt1(t)}% ВВП к выборам` },
  { id: 'living_standards_promise', label: 'Повысить уровень жизни',
    // раньше мерялась оценка «Люди», а в тексте стояло «благосостояние населения» —
    // игрок сверял обещание с «Благополучием» в шапке и видел разные числа
    target: (s) => round1(s.wellbeing),
    metric: (e) => e.wellbeing, direction: 'above',
    describe: (t) => `Благополучие не ниже ${fmt1(t)} — уровня на начало срока (показатель в шапке)` },
  { id: 'reserves_promise', label: 'Сохранить резервы',
    target: (s) => Math.round(s.reserves * 0.8),
    metric: (e) => e.reserves, direction: 'above',
    describe: (t) => `Резервы не ниже ${fmtMoney(t)} — не менее 80% уровня на начало срока` },
];
// три случайных обещания на новый срок; startEconomy — состояние на момент вступления в должность
function pickPromises(startEconomy, count = 3) {
  const pool = [...PROMISE_POOL];
  const picked = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked.map((p) => {
    const target = p.target(startEconomy);
    return { id: p.id, label: p.label, target, baseline: p.baseline ? p.baseline(startEconomy) : null, text: p.describe(target) };
  });
}
// met — выполняется ли обещание СЕЙЧАС (для живого статуса); итог подводится этой же
// функцией в момент выборов, когда quartersToElection обнуляется
function evaluatePromise(promise, economy) {
  const def = PROMISE_POOL.find((p) => p.id === promise.id);
  if (!def) return { met: true, value: null };
  const value = def.metric(economy, promise.baseline);
  const met = def.direction === 'below' ? value <= promise.target : value >= promise.target;
  // direction нужен интерфейсу, чтобы подписать порог («надо ≤» или «надо ≥»),
  // а не показывать две голые цифры через дробь
  return { met, value, direction: def.direction };
}

/* =========================================================================================
   ПРЕСС-КОНФЕРЕНЦИЯ: раз в квартал журналисты задают вопрос, и ответ — это не
   рычаг с числом, а слово, которое само по себе двигает доверие и рейтинг.
   Отдельно от обещаний: обещания подводят итог на выборах по факту, здесь же
   решает сам выбор ответа, а не то, что происходит с экономикой дальше.
   Вопрос выбирается детерминированно от (economy, quarterIndex) — без
   rng() — чтобы превью в интерфейсе перед отправкой решений и сам
   расчёт квартала внутри simulateQuarter всегда сходились на одном и том же
   вопросе без необходимости протаскивать его id через decisions отдельно. */
const PRESS_QUESTIONS = [
  { id: 'growth', shortLabel: 'ОБ ИТОГАХ КВАРТАЛА', when: () => true,
    prompt: 'Как вы оцениваете экономические результаты квартала?',
    promptHard: 'Какими достижениями отмечен завершившийся квартал?',
    options: [
      { id: 'spin', label: 'Показать результаты в лучшем свете',
        quote: 'Мы видим уверенный прогресс по всем ключевым направлениям.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', 2.5, 'Пресс-конференция: оптимистичный тон', 'fast', d, 'other'),
          makeImpulse('govTrust', -2, 'Пресс-конференция: приукрашенные цифры', 'fast', d, 'other')] }) },
      { id: 'honest', label: 'Признать проблемы честно',
        quote: 'Есть реальные сложности, и мы не собираемся их замалчивать.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', 3, 'Пресс-конференция: честное признание проблем', 'fast', d, 'other'),
          makeImpulse('approvalPush', -1, 'Пресс-конференция: неприятная правда', 'fast', d, 'other')] }) },
      { id: 'deflect', label: 'Уйти от прямого ответа',
        quote: 'Экономика — это сложная система, нельзя всё сводить к одной цифре.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', -1.5, 'Пресс-конференция: уклончивый ответ', 'fast', d, 'other')] }) },
    ] },
  /* Оппозиции, которая задаёт вопросы через прессу, при авторитарном и тем
     более тоталитарном режиме не существует. Вопрос при этом не исчезает —
     он меняет источник: критику курса озвучивают «зарубежные издания», и
     отвечать на неё приходится ровно теми же тремя способами. */
  { id: 'opposition', shortLabel: 'ОБ ОБВИНЕНИЯХ ОППОЗИЦИИ', shortLabelHard: 'О ЗАРУБЕЖНЫХ ОЦЕНКАХ', when: () => true,
    prompt: 'Оппозиция называет вашу экономическую политику провальной — ваш ответ?',
    promptHard: 'Зарубежные издания называют экономический курс страны провальным. Как вы прокомментируете эти публикации?',
    options: [
      { id: 'attack', label: 'Перейти в контратаку',
        quote: 'Оппозиция предлагает лишь популизм без единой цифры расчётов.',
        quoteHard: 'За этими публикациями стоят те, кому наш курс мешает. Ни одной цифры расчётов они не предъявили.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', 2, 'Пресс-конференция: жёсткий ответ оппозиции', 'fast', d, 'other'),
          makeImpulse('tensionPush', 3, 'Пресс-конференция: обострение риторики', 'fast', d, 'other')] }) },
      { id: 'engage', label: 'Признать часть критики обоснованной',
        quote: 'В критике есть здравое зерно, и мы готовы это обсуждать.',
        quoteHard: 'Даже в недружественных оценках встречается полезное, и мы это учитываем в работе.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', 2.5, 'Пресс-конференция: готовность к диалогу', 'fast', d, 'other'),
          makeImpulse('tensionPush', -2, 'Пресс-конференция: снижение накала', 'fast', d, 'other')] }) },
      { id: 'ignore', label: 'Проигнорировать вопрос',
        quote: 'Мы сосредоточены на работе, а не на политических дебатах.',
        quoteHard: 'Мы сосредоточены на работе, а не на чужих публикациях.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', -1, 'Пресс-конференция: отказ отвечать критикам', 'fast', d, 'other')] }) },
    ] },
  { id: 'inflation', shortLabel: 'ОБ ИНФЛЯЦИИ', when: (s) => s.inflation > (s.inflationTarget || 4) + 2,
    prompt: 'Цены снова растут быстрее обещанного — как вы это объясните?',
    promptHard: 'Отдельные группы товаров подорожали заметнее прочих. Что делается для сдерживания цен?',
    options: [
      { id: 'blame_external', label: 'Списать на внешние факторы',
        quote: 'Инфляция ускоряется во всём мире, мы не исключение.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', 1.5, 'Пресс-конференция: инфляция как внешний шок', 'fast', d, 'other'),
          makeImpulse('govTrust', -2.5, 'Пресс-конференция: перекладывание ответственности', 'fast', d, 'other')] }) },
      { id: 'own_it', label: 'Взять ответственность на себя',
        quote: 'Часть решений оказалась ошибочной, и мы это исправляем.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', 3.5, 'Пресс-конференция: ответственность за инфляцию', 'fast', d, 'other'),
          makeImpulse('approvalPush', -2, 'Пресс-конференция: признание ошибки', 'fast', d, 'other')] }) },
      { id: 'promise', label: 'Пообещать скорое улучшение',
        quote: 'Уже в следующих кварталах инфляция пойдёт на спад.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', 2, 'Пресс-конференция: обещание скорого улучшения', 'fast', d, 'other'),
          makeImpulse('govTrust', -1, 'Пресс-конференция: невыполнимое обещание', 'default', d, 'other')] }) },
    ] },
  { id: 'unemployment', shortLabel: 'О БЕЗРАБОТИЦЕ', when: (s) => s.unemployment > s.nairu + 1.2,
    prompt: 'Люди теряют работу — что вы скажете тем, кто остался без дохода?',
    promptHard: 'Часть предприятий проводит оптимизацию штата. Какая поддержка предусмотрена для работников?',
    options: [
      { id: 'sympathy', label: 'Выразить сочувствие и пообещать поддержку',
        quote: 'Мы разделяем эту боль и расширяем программы поддержки.',
        build: (s, d) => ({ impulses: [makeImpulse('consumerConfidence', 2.5, 'Пресс-конференция: сочувствие безработным', 'fast', d, 'other'),
          makeImpulse('govTrust', 1.5, 'Пресс-конференция: сочувствие безработным', 'fast', d, 'other')] }) },
      { id: 'structural', label: 'Назвать это неизбежной структурной перестройкой',
        quote: 'Экономика проходит через болезненную, но необходимую перестройку.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', -2, 'Пресс-конференция: безработица названа неизбежной', 'fast', d, 'other'),
          makeImpulse('approvalPush', -1.5, 'Пресс-конференция: холодный ответ безработным', 'fast', d, 'other')] }) },
      { id: 'minimize', label: 'Преуменьшить масштаб проблемы',
        quote: 'Цифры безработицы не так тревожны, как их представляют.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', -3, 'Пресс-конференция: преуменьшение безработицы', 'fast', d, 'other'),
          makeImpulse('consumerConfidence', -2, 'Пресс-конференция: преуменьшение безработицы', 'fast', d, 'other')] }) },
    ] },
  { id: 'debt', shortLabel: 'О ГОСДОЛГЕ', when: (s) => s.debtToGdp > 70,
    prompt: 'Госдолг продолжает расти — вас не пугает эта цифра?',
    promptHard: 'Показатель государственного долга растёт. Насколько устойчива финансовая система государства?',
    options: [
      { id: 'reassure', label: 'Заверить, что долг под контролем',
        quote: 'Долговая нагрузка полностью управляема, поводов для паники нет.',
        build: (s, d) => ({ impulses: [makeImpulse('approvalPush', 1.5, 'Пресс-конференция: заверения по долгу', 'fast', d, 'other'),
          makeImpulse('riskPremium', 0.15, 'Пресс-конференция: рынок не поверил заверениям по долгу', 'default', d)] }) },
      { id: 'plan', label: 'Изложить конкретный план консолидации',
        quote: 'У нас есть чёткий график снижения долговой нагрузки.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', 3, 'Пресс-конференция: план консолидации долга', 'fast', d, 'other'),
          makeImpulse('riskPremium', -0.2, 'Пресс-конференция: рынок поверил в план консолидации', 'default', d)] }) },
      { id: 'shrug', label: 'Сказать, что так живут многие страны',
        quote: 'Уровень нашего долга сопоставим со многими развитыми странами.',
        build: (s, d) => ({ impulses: [makeImpulse('govTrust', -2, 'Пресс-конференция: долг списан на общемировую практику', 'fast', d, 'other')] }) },
    ] },
];

// без rng(): один и тот же (economy, quarterIndex) всегда даёт один и
// тот же вопрос, поэтому клиентское превью перед отправкой решений и расчёт
// внутри simulateQuarter не могут разойтись
/* Кто отвечает на пресс-конференции в сетевой партии. В одиночной игре вопрос
   достаётся тому, за кого играет человек, а в комнате людей может быть
   несколько — и отвечать двумя голосами сразу власть не может. Голос власти —
   президент, если его место занято человеком; без него — правительство
   (Минфин); без обоих — глава ЦБ. Трейдер власти не представляет и не
   отвечает никогда. Правило живёт в движке, потому что его одинаково должны
   знать сервер (чей ответ брать) и клиент (кому показывать вопрос). */
const PRESS_SPEAKER_ORDER = ['president', 'ministry_finance', 'central_bank'];
function pressSpeakerSeat(occupied) {
  return PRESS_SPEAKER_ORDER.find((seat) => !!(occupied && occupied[seat])) || null;
}
// все допустимые идентификаторы ответа — сервер отбрасывает любые другие
const PRESS_OPTION_IDS = new Set(PRESS_QUESTIONS.flatMap((q) => q.options.map((o) => o.id)));

/* Вопрос уже приходит отфильтрованным по режиму: pickPressQuestion получает
   состояние, поэтому и движок (он публикует цитату ответа новостью), и
   интерфейс (он рисует вопрос) видят одну и ту же формулировку — без
   отдельной проверки режима на каждой стороне. Идентификаторы вариантов
   ответа не меняются: механика и эффекты остаются те же, меняются слова. */
function pickPressQuestion(s, quarterIndex) {
  const eligible = PRESS_QUESTIONS.filter((q) => !q.when || q.when(s));
  if (!eligible.length) return null;
  const q = eligible[quarterIndex % eligible.length];
  if (!pressControlled(s)) return q;
  return {
    ...q,
    shortLabel: q.shortLabelHard || q.shortLabel,
    prompt: q.promptHard || q.prompt,
    options: q.options.map((o) => (o.quoteHard ? { ...o, quote: o.quoteHard } : o)),
  };
}

/* =========================================================================================
   СОБЫТИЯ. kind: demand | supply | financial | external | structural
========================================================================================= */
const EVENTS = [
  { id: 'global_crisis', kind: 'external', title: 'Мировой экономический кризис', weight: 3, cooldown: 10,
    news: 'Замедление мировой экономики ударило по внешнему спросу и настроениям инвесторов.',
    spread: [0.4, 0.35, 0.25],
    build: () => ([['exportsGrowth', -7], ['investment', -4], ['businessConfidence', -14],
      ['consumerConfidence', -10], ['financialStability', -8], ['worldGdpGrowth', -1.8], ['worldDemandIndex', -8], ['capitalFlow', -18],
      ['secIndustry', -9], ['secResources', -7], ['secBanks', -6], ['stockShock', -13]]) },
  { id: 'oil_up', kind: 'supply', title: 'Рост мировых цен на сырьё', weight: 4, cooldown: 4,
    spread: [0.6, 0.4],
    build: (s) => (s.exports - s.imports >= 0
      ? { news: 'Рост цен на сырьё увеличил экспортную выручку и укрепил платёжный баланс.',
          list: [['exportsGrowth', 5], ['commodityIndex', 10], ['capitalFlow', 8], ['secResources', 10], ['secConsumer', 2]] }
      : { news: 'Рост цен на сырьё поднял издержки производства и разогнал инфляцию предложения.',
          list: [['inflationSupply', 1.1], ['commodityIndex', 10], ['consumerConfidence', -5], ['potentialShock', -0.25],
            ['secResources', 8], ['secIndustry', -6], ['secConsumer', -4]] }) },
  { id: 'commodity_down', kind: 'supply', title: 'Падение цен на сырьё', weight: 4, cooldown: 4,
    spread: [0.6, 0.4],
    build: (s) => (s.exports - s.imports >= 0
      ? { news: 'Падение цен на сырьё сократило экспортную выручку и ослабило платёжный баланс.',
          list: [['exportsGrowth', -5], ['commodityIndex', -10], ['capitalFlow', -7]] }
      : { news: 'Падение цен на сырьё снизило издержки и ослабило инфляционное давление.',
          list: [['inflationSupply', -0.8], ['commodityIndex', -10], ['consumerConfidence', 2]] }) },
  { id: 'supply_chain', kind: 'supply', title: 'Разрыв цепочек поставок', weight: 3, cooldown: 8,
    news: 'Сбои поставок подняли издержки и сократили производственные возможности экономики.',
    spread: [0.5, 0.3, 0.2],
    build: () => ([['inflationSupply', 2.0], ['potentialShock', -0.8], ['productivity', -0.6], ['businessConfidence', -7],
      ['investment', -4.5], ['consumption', -1.8], ['exportsGrowth', -3.5],
      ['secIndustry', -10], ['secConsumer', -5], ['secResources', 5], ['stockShock', -6]]) },
  { id: 'financial_crisis', kind: 'financial', title: 'Глобальный финансовый кризис', weight: 2, cooldown: 12,
    news: 'Глобальная нестабильность спровоцировала бегство капитала из рискованных активов.',
    spread: [0.5, 0.3, 0.2],
    build: () => ([['financialStability', -16], ['fdi', -25], ['capitalFlow', -35], ['riskPremium', 1.2], ['businessConfidence', -10],
      ['stockShock', -18], ['secBanks', -14], ['secReit', -11], ['secIndustry', -7], ['investment', -3]]) },
  { id: 'bank_run', kind: 'financial', title: 'Паника вкладчиков', weight: 2, cooldown: 10,
    eligible: (s) => s.financialStability < 58 || s.bankNPL > 6,
    weightFn: (s) => (s.financialStability < 42 ? 5 : s.financialStability < 58 ? 2.5 : 0),
    news: 'Отток депозитов обрушил ликвидность банков и парализовал кредитование.',
    spread: [0.7, 0.3],
    build: () => ([['bankLiquidity', -22], ['bankNPL', 1.2], ['financialStability', -18], ['investment', -4],
      ['secBanks', -16], ['secReit', -9], ['stockShock', -9]]) },
  { id: 'deflation_risk', kind: 'demand', title: 'Провал внутреннего спроса', weight: 2, cooldown: 8,
    eligible: (s) => s.inflation < 2.5,
    news: 'Слабый спрос и осторожность домохозяйств создали риск дефляционной спирали.',
    spread: [0.5, 0.5],
    build: () => ([['consumption', -2.2], ['investment', -2.0], ['consumerConfidence', -8], ['inflationSupply', -0.6]]) },
  { id: 'pandemic', kind: 'supply', title: 'Пандемия', weight: 1, cooldown: 20,
    news: 'Вспышка заболевания одновременно сократила спрос и производственные возможности.',
    spread: [0.5, 0.3, 0.2],
    build: () => ([['consumption', -6], ['investment', -6], ['unemployment', 1.6], ['potentialShock', -1.2],
      ['consumerConfidence', -16], ['worldGdpGrowth', -1.4], ['inflationSupply', 0.8], ['stockShock', -15], ['secConsumer', -10], ['secReit', -6]]) },
  { id: 'war', kind: 'external', title: 'Начало войны', weight: 0.6, cooldown: 28,
    // посреди другой войны новая не начинается: иначе она подменяла бы идущую
    eligible: (s) => !((s.warQuartersLeft || 0) > 0),
    // нападает Дешт — и тем вероятнее, чем хуже с ним отношения (см. «Живые соседи»)
    weightFn: (s) => 0.6 * deshtWarMultiplier(s),
    spread: [0.4, 0.3, 0.2, 0.1],
    build: (s) => {
      const defShare = s.budgetShares ? s.budgetShares.defense : CONFIG.initial.budgetShares.defense;
      // базовая доля обороны в бюджете — CONFIG.initial.budgetShares.defense; каждый процент сверх нее
      // гасит часть военного шока — расходы, сделанные ДО войны, а не в панике после
      const mult = clamp(1 - Math.max(0, defShare - CONFIG.initial.budgetShares.defense) * 0.025, 0.35, 1);
      const prepNews = mult < 0.7
        ? 'Заранее высокие расходы на оборону смягчили удар по экономике — армия и логистика были готовы.'
        : 'Низкие расходы на оборону обернулись более тяжёлым ударом — тыл оказался не готов.';
      /* Война, пришедшая извне, — всегда оборонительная: на страну напали. Начать
         наступление может только президент своим указом (war_start) — иначе
         игрок за президента вдруг оказывался во главе войны, которую не объявлял.
         Обороняющаяся сторона получает сочувствие и помощь союзников. */
      const warType = 'defensive';
      const diploNews = warType === 'defensive'
        ? 'Война носит оборонительный характер: союзники открывают кредитные линии и наращивают закупки — приходит иностранная помощь.'
        : 'Война носит наступательный характер: партнёры вводят санкции и сворачивают инвестиции — страна оказывается в изоляции.';
      const diplomacy = warType === 'defensive'
        ? [['capitalFlow', 14], ['fdi', 9], ['exportsGrowth', 2.5], ['riskPremium', -0.5], ['worldDemandIndex', 2]]
        : [['exportsGrowth', -5], ['importsGrowth', -4], ['capitalFlow', -16], ['fdi', -11], ['riskPremium', 0.9]];
      return { news: `Началась война. ${prepNews} ${diploNews}`, warType, list: [
        ['exportsGrowth', -8 * mult], ['importsGrowth', -6 * mult], ['investment', -7 * mult],
        ['businessConfidence', -18 * mult], ['consumerConfidence', -12 * mult], ['inflationSupply', 1.6 * mult],
        ['capitalFlow', -30 * mult], ['fdi', -22 * mult], ['riskPremium', 1.4 * mult], ['potentialShock', -1.0 * mult],
        ['worldDemandIndex', -6 * mult], ['stockShock', -20 * mult], ['secIndustry', -8 * mult],
        ['secConsumer', -10 * mult], ['secReit', -9 * mult],
        ...diplomacy,
      ] };
    } },
  { id: 'geopolitical', kind: 'external', title: 'Геополитический кризис', weight: 2, cooldown: 10,
    news: 'Геополитическая напряжённость встревожила инвесторов и подняла издержки.',
    spread: [0.5, 0.5],
    build: () => ([['businessConfidence', -10], ['fdi', -15], ['capitalFlow', -22], ['riskPremium', 0.9], ['inflationSupply', 0.7],
      ['stockShock', -8], ['secResources', 4]]) },
  { id: 'sanctions', kind: 'external', title: 'Введение санкций', weight: 1.5, cooldown: 16,
    news: 'Внешние ограничения нарушили торговые и финансовые потоки.',
    spread: [0.4, 0.35, 0.25],
    build: () => ([['exportsGrowth', -7], ['importsGrowth', -5], ['capitalFlow', -30], ['fdi', -18],
      ['inflationSupply', 1.1], ['potentialShock', -0.7], ['riskPremium', 1.0], ['stockShock', -11], ['secIndustry', -8]]) },
  { id: 'global_rate_hike', kind: 'external', title: 'Рост мировых процентных ставок', weight: 3, cooldown: 6,
    news: 'Ужесточение политики крупнейших центробанков спровоцировало отток капитала.',
    spread: [0.6, 0.4],
    build: () => ([['worldRate', 1.4], ['capitalFlow', -20], ['fdi', -8], ['secReit', -10], ['secBanks', -5]]) },
  { id: 'capital_inflow', kind: 'financial', title: 'Резкий приток капитала', weight: 3, cooldown: 6,
    news: 'Инвесторы нарастили вложения — дешёвые деньги хлынули в экономику.',
    spread: [0.6, 0.4],
    build: () => ([['capitalFlow', 28], ['fdi', 15], ['financialStability', -3], ['investment', 1.5],
      ['secBanks', 7], ['secReit', 8], ['secIndustry', 4], ['stockShock', 6]]) },
  { id: 'tech_breakthrough', kind: 'structural', title: 'Технологический скачок', weight: 2, cooldown: 12,
    news: 'Внедрение новых технологий повысило совокупную производительность.',
    spread: [0.3, 0.4, 0.3],
    build: () => ([['productivity', 1.6], ['businessConfidence', 8], ['investment', 2], ['potentialShock', 0.5],
      ['secIndustry', 11], ['secConsumer', 4], ['stockShock', 7]]) },
  { id: 'demographic', kind: 'structural', title: 'Демографический сдвиг', weight: 1, cooldown: 24,
    news: 'Старение населения сжимает рабочую силу и давит на бюджет.',
    spread: [0.3, 0.3, 0.4],
    build: () => ([['laborForce', -0.8], ['wageGrowth', 0.7], ['transfersPressure', 1.0], ['rStar', -0.25]]) },
  { id: 'consumer_boom', kind: 'demand', title: 'Потребительский бум', weight: 3, cooldown: 6,
    news: 'Домохозяйства резко нарастили расходы и спрос на кредит.',
    spread: [0.6, 0.4],
    build: () => ([['consumption', 2.5], ['consumerConfidence', 9], ['creditDemand', 3], ['secConsumer', 9], ['secReit', 6]]) },
  { id: 'harvest_fail', kind: 'supply', title: 'Неурожай и рост цен на продовольствие', weight: 3, cooldown: 6,
    news: 'Плохой урожай поднял продовольственные цены — удар по реальным доходам.',
    spread: [0.7, 0.3],
    build: () => ([['inflationSupply', 1.4], ['consumerConfidence', -6], ['consumption', -0.8]]) },
];

const CHANNEL_HEADLINE = {
  consumption: 'gdpGrowth', investment: 'gdpGrowth', exportsGrowth: 'gdpGrowth', importsGrowth: 'gdpGrowth',
  creditDemand: 'banking', inflationSupply: 'inflation', vatPrices: 'inflation',
  exchangeRate: 'exchangeRate', capitalFlow: 'exchangeRate', riskPremium: 'exchangeRate',
  revenue: 'budget', transfersPressure: 'budget',
  unemployment: 'unemployment', wageGrowth: 'unemployment', laborForce: 'unemployment',
  financialStability: 'banking', bankNPL: 'banking', bankLiquidity: 'banking', bankCapital: 'banking',
  productivity: 'potential', potentialShock: 'potential', infrastructureIndex: 'potential', rStar: 'potential',
  secBanks: 'banking', secIndustry: 'banking', secConsumer: 'banking', secResources: 'banking', secReit: 'banking',
  stockShock: 'banking',
  govInvestmentPush: 'gdpGrowth',
};
const headlineFor = (channel) => CHANNEL_HEADLINE[channel] || 'other';

function spreadOf(kind, difficulty) {
  if (kind === 'slow') return CONFIG.slowSpread[difficulty];
  if (kind === 'fast') return [1];
  return CONFIG.lagSpread[difficulty];
}
function makeImpulse(channel, amount, reasonText, spreadKind, difficulty, headline) {
  const pattern = spreadOf(spreadKind, difficulty);
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel), values: pattern.map((f) => amount * f), idx: 0 };
}
/* Программа, а не шок: одно и то же давление держится N кварталов подряд.
   Обычные раскладки (lagSpread/slowSpread) распределяют разовую сумму по 2–4
   кварталам — этого хватает событию, но не реформе или национальному проекту,
   которые тянутся годами. */
function sustainedImpulse(channel, perQuarter, quarters, reasonText, headline) {
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel),
    values: Array.from({ length: Math.max(1, quarters) }, () => perQuarter), idx: 0 };
}
/* Как sustainedImpulse, но со своим значением на каждый квартал — нужно там, где
   эффект не постоянен, а угасает по графику (сплочение вокруг флага греет рейтинг
   резко и быстро остывает, а не держится на одном уровне и не обрывается разом). */
function taperedImpulse(channel, values, reasonText, headline) {
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel), values, idx: 0 };
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
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function buildEventImpulses(evt, state) {
  const resolved = evt.build(state);
  const list = Array.isArray(resolved) ? resolved : resolved.list;
  const news = Array.isArray(resolved) ? evt.news : resolved.news;
  const warType = Array.isArray(resolved) ? null : resolved.warType || null;
  const impulses = list.map(([channel, amount]) => ({
    id: uid(), channel, reasonText: `Событие: ${evt.title}`, headline: headlineFor(channel),
    values: evt.spread.map((f) => amount * f), idx: 0,
  }));
  return { impulses, news, warType };
}
function tickImpulses(queue) {
  const deltas = {}; const contributions = []; const nextQueue = [];
  for (const imp of queue) {
    const amt = imp.values[imp.idx] || 0;
    deltas[imp.channel] = (deltas[imp.channel] || 0) + amt;
    if (Math.abs(amt) > 1e-4 && imp.headline && imp.headline !== 'other') {
      contributions.push({ reasonText: imp.reasonText, headline: imp.headline, amount: amt, channel: imp.channel });
    }
    const nextIdx = imp.idx + 1;
    if (nextIdx < imp.values.length) nextQueue.push({ ...imp, idx: nextIdx });
  }
  return { deltas, contributions, nextQueue };
}

/* =========================================================================================
   НАЛОГОВАЯ БАЗА И СОБИРАЕМОСТЬ (нелинейность -> кривая Лаффера как результат поведения)
========================================================================================= */
const TAX_REF = { income: 13, wedge: 32, profit: 18, vat: 16, excise: 10, capital: 12 };
function complianceFor(rate, ref, sens, shadowShare) {
  const excess = Math.max(0, rate - ref);
  const relief = Math.max(0, ref - rate) * 0.004;
  const c = (1 - shadowShare / 100 + relief) * (1 - sens * Math.pow(excess, 1.35) / 100);
  return clamp(c, 0.2, 0.99);
}
function taxBases(s) {
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
function computeRevenue(s, d) {
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
const taxWedge = (d) => d.incomeTaxRate + d.socialContribRate * 0.7 + d.vatRate * 0.35;

/* Потенциальный ВВП: производственная функция Кобба—Дугласа */
function potentialFrom(capitalStock, laborForce, nairu, humanCapital, productivity, infraIndex, tfpScale, scar) {
  const alpha = CONFIG.prod.alpha;
  const L = Math.max(1, laborForce * (1 - nairu / 100) * (humanCapital / 100));
  const A = tfpScale * (productivity / 100);
  const infraBoost = 1 + 0.18 * (infraIndex - 100) / 100;
  return A * Math.pow(Math.max(1, capitalStock), alpha) * Math.pow(L, 1 - alpha) * infraBoost * (1 + scar / 100);
}
const STOCK_NORM = (() => {
  const I = CONFIG.initial;
  const earn0 = CONFIG.shares.profits * I.gdp * (1 - I.profitTaxRate / 100);
  const y10 = I.keyRate + 1.5; const erp0 = 3.2; const growth0 = 0.62 * (2.3 + I.inflationExpectations);
  const pe0 = 100 / Math.max(1, y10 + erp0 - growth0);
  return earn0 * pe0 / 1000;
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

/* =========================================================================================
   ГЛАВНАЯ ФУНКЦИЯ КВАРТАЛА
========================================================================================= */
function simulateQuarter({ economy, decisions: rawDecisions, pendingImpulses, eventCooldowns, difficulty, quarterIndex, stories, botAction, botActions, publicMode, noEvents }) {
  const s = economy;
  /* Каждый серверлесс-вызов может начинаться с чистого счётчика __newsId (новый
     процесс — новый модуль), а клиент копит все новости за партию в одном
     массиве. Без квартальной привязки id новостей из разных кварталов рано или
     поздно совпадали бы («n1» квартала 1 и «n1» квартала 9), и React путал эти
     записи по key — старая новость «залипала» на месте новой при перерисовке.
     Значение с запасом (кварталов не бывает тысячи, новостей за квартал —
     тем более) гарантирует уникальность в пределах одной партии независимо от
     того, сколько раз счётчик успел обнулиться. */
  __newsId = Math.max(__newsId, (quarterIndex || 0) * 1000 + 1);
  /* Один потолок на всех. Решения приходят из трёх мест — от игрока, от бота
     соседнего ведомства и от указаний президента, — и только у игрока они были
     ограничены диапазоном ползунка. Отсюда и возникало «бот наращивает
     госинвестиции до бесконечности»: у него тех же ограничений не было.
     Приводим любые решения к тому, что физически может задать человек. */
  const decisions = (() => {
    let changed = false; const out = { ...rawDecisions };
    LEVERS.forEach((base) => {
      const v = out[base.id];
      if (!Number.isFinite(v)) return;
      // границы — те, что игрок видит на ползунке сейчас (потолок ставки растёт
      // с инфляцией); рычаги в миллиардах и ориентир курса — как и раньше
      const l = base.scale === 'gdp' || base.id === 'fxTarget' ? base : scaleLever(base, s);
      const lo = l.scale === 'gdp' ? -Infinity : l.min;
      const hi = l.scale === 'gdp' ? Infinity : l.max;
      const c = clamp(v, lo, hi);
      if (c !== v) { out[l.id] = c; changed = true; }
    });
    return changed ? out : rawDecisions;
  })();
  const C = CONFIG.coef;
  const T = CONFIG.target;
  const nMult = CONFIG.noiseMult[difficulty];
  const NB = CONFIG.noiseBase;
  const infTarget = Number.isFinite(decisions.inflationTarget) ? decisions.inflationTarget : CONFIG.target.inflation;
  const targetChange = infTarget - (Number.isFinite(s.inflationTarget) ? s.inflationTarget : CONFIG.target.inflation);
  const activeCrisesPre = s.activeCrises || [];
  const log = [];
  const news = [];
  const add = (headline, reasonText, amount) => log.push({ headline, reasonText, amount });

  /* --- 1. события и очередь импульсов --- */
  const cooldowns = { ...eventCooldowns };
  Object.keys(cooldowns).forEach((k) => { cooldowns[k] = Math.max(0, cooldowns[k] - 1); });
  let queue = [...pendingImpulses];
  const newStories = [];
  const KIND_CAT = { demand: 'households', supply: 'business', financial: 'markets', external: 'world', structural: 'business' };
  let pandemicTriggered = false;
  let warTriggered = false;
  let warTypeRolled = null;
  // Дешт стянул войска к границе, а отношения на дне — нападает сам, вне общей лотереи
  const deshtAttack = !noEvents && deshtAttackRoll(s);
  if (deshtAttack) {
    const evt = EVENTS.find((e) => e.id === 'war');
    const built = buildEventImpulses(evt, s);
    warTriggered = true; warTypeRolled = 'defensive';
    queue = queue.concat(built.impulses);
    cooldowns.war = evt.cooldown;
    news.push(mkNews('world', 'ДЕШТ НАПАЛ', `Войска, которые Дешт держал у границы, перешли её. ${built.news}`, { priority: 10 }));
  }
  if (!deshtAttack && !noEvents && rng() < CONFIG.eventProbability[difficulty]) {
    const evt = pickEvent(s, cooldowns);
    if (evt) {
      if (evt.id === 'pandemic') pandemicTriggered = true;
      if (evt.id === 'war') warTriggered = true;
      const built = buildEventImpulses(evt, s);
      if (evt.id === 'war') warTypeRolled = built.warType || null;
      queue = queue.concat(built.impulses);
      cooldowns[evt.id] = evt.cooldown;
      // встречный сюжет (сырьё вверх при идущем «сырьё вниз») запускать нельзя:
      // они объясняли бы одно и то же противоположными причинами в одной ленте
      const busy = (stories || []).some((x) => x.tplId === evt.id) || storyConflicts(evt.id, stories);
      if (STORY_TEMPLATES[evt.id] && !busy) newStories.push({ tplId: evt.id, nextIdx: 0, wait: storyStartWait(evt.id) });
      else news.push(mkNews(KIND_CAT[evt.kind] || 'world', evt.title.toUpperCase(), built.news, { priority: 8 }));
    }
  }
  queue = queue.concat(buildDecisionImpulses(decisions, s, difficulty));

  /* --- 1б. РЕШЕНИЯ ПРЕЗИДЕНТА: указы, реформы и кадры --- */
  const pres = applyPresidentActions(s, decisions.presidentActions, cooldowns, difficulty);
  queue = queue.concat(pres.impulses);
  pres.newsSpecs.forEach((n) => news.push(mkNews(n.cat, n.headline, n.text, { priority: n.priority, chain: n.chain })));

  /* --- 1в. ПРЕСС-КОНФЕРЕНЦИЯ: один вопрос за квартал, ответ значит больше цифр --- */
  const pressQ = pickPressQuestion(s, quarterIndex);
  const pressOpt = pressQ && (pressQ.options.find((o) => o.id === decisions.pressAnswer) || null);
  if (pressOpt) {
    const built = pressOpt.build(s, difficulty) || {};
    queue = queue.concat(built.impulses || []);
    news.push(mkNews('gov', `ПРЕСС-КОНФЕРЕНЦИЯ: ${pressQ.shortLabel}`, `«${pressOpt.quote}»`, { priority: 6 }));
  }
  /* --- 1г. ОКРУГА: ответ на событие, ход строек, новое событие --- */
  const RS = regionStep(s, decisions, difficulty, quarterIndex);
  queue = queue.concat(RS.impulses);
  RS.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  // требования лидеров групп: ответ на прошлое, новое требование
  const GD = groupDemandStep(s, decisions, difficulty, quarterIndex);
  queue = queue.concat(GD.impulses);
  GD.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  // новые земли: лояльность, интеграция, партизаны
  const AN = annexStep(s, decisions, difficulty, RS.loyaltyDelta);
  queue = queue.concat(AN.impulses);
  AN.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  Object.entries(AN.shock).forEach(([id, v]) => { RS.regionShock[id] = (RS.regionShock[id] || 0) + v; });
  /* --- 1д. НАСТУПАТЕЛЬНАЯ ОПЕРАЦИЯ: приказ президента на квартал --- */
  const CP = campaignStep(s, decisions);
  const WC = warCampaignStep(s, decisions, difficulty);
  queue = queue.concat(WC.impulses);
  WC.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  /* --- 1е. НОРЛАНД: реваншизм, война за новые земли, мирные переговоры --- */
  const RV = revancheStep(s, decisions, difficulty, quarterIndex, !!pres.patch.startWar);
  queue = queue.concat(RV.impulses);
  RV.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  /* --- 1ж. ОБОРОНИТЕЛЬНАЯ ВОЙНА: фронт на юго-западе --- */
  const DF = defenseStep(s, decisions, difficulty, quarterIndex, warTriggered && warTypeRolled === 'defensive');
  queue = queue.concat(DF.impulses);
  DF.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  Object.entries(DF.shock).forEach(([id, v]) => { RS.regionShock[id] = (RS.regionShock[id] || 0) + v; });
  const PC = peaceStep(s, decisions, difficulty, quarterIndex);
  queue = queue.concat(PC.impulses);
  PC.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));

  // указание ведомству разбирается на уровне интерфейса (ему нужны уже готовые
  // решения ботов), но платит за него тот же политический капитал
  let presSpent = pres.spent + Math.max(0, decisions.presidentExtraSpend || 0);
  // реформа, объявленная в этом квартале, входит в карту с нулём: доля внедрения
  // считается от того, сколько кварталов она уже разворачивается
  const reforms = {};
  Object.keys(s.reforms || {}).forEach((k) => { reforms[k] = (s.reforms[k] || 0) + 1; });
  (pres.patch.reforms || []).forEach((id) => { if (reforms[id] === undefined) reforms[id] = 0; });
  const RE = reformEffects(reforms);
  // назначения: срок работы руководителя ведомства идёт кварталами и обнуляется
  // при смене — от него зависит, насколько дорого обходится досрочная отставка
  let cbTenure = (s.cbTenure || 0) + 1;
  let mofTenure = (s.mofTenure || 0) + 1;
  const startCapital = Number.isFinite(s.politicalCapital) ? s.politicalCapital : 55;
  [['central_bank', decisions.appointCb, getCbPersona], ['ministry_finance', decisions.appointMof, getMofPersona]]
    .forEach(([kind, pid, look]) => {
      if (!pid || startCapital - presSpent < APPOINT_COST[kind]) return;
      const eff = appointmentEffects(kind, s, difficulty, look(pid));
      presSpent += eff.cost;
      queue = queue.concat(eff.impulses);
      news.push(mkNews(eff.news.cat, eff.news.headline, eff.news.text, { priority: eff.news.priority }));
      if (kind === 'central_bank') cbTenure = 0; else mofTenure = 0;
    });

  /* --- 1з. ЖИВЫЕ СОСЕДИ: дипломатия президента, события и ходы соседей --- */
  const DP = diplomacyStep(s, decisions, difficulty, quarterIndex, startCapital - presSpent, noEvents, pres.applied);
  presSpent += DP.spent;
  queue = queue.concat(DP.impulses);
  DP.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));

  const ticked = tickImpulses(queue);
  const d = ticked.deltas;
  log.push(...ticked.contributions);
  const nextQueue = ticked.nextQueue;

  /* --- 2. внешний мир --- */
  const worldGdpGrowth = clamp(s.worldGdpGrowth + 0.10 * (2.5 - s.worldGdpGrowth) + (d.worldGdpGrowth || 0) + gauss(NB.worldGdpGrowth * nMult), -6, 8);
  const worldInflation = clamp(s.worldInflation + 0.12 * (T.worldInflation - s.worldInflation) + (d.worldInflation || 0) + gauss(NB.worldInflation * nMult), -3, 20);
  const worldRate = clamp(s.worldRate + 0.10 * (T.foreignRate - s.worldRate) + (d.worldRate || 0) + gauss(NB.worldRate * nMult), 0, 18);
  const commodityIndex = clamp(s.commodityIndex + 0.06 * (100 - s.commodityIndex) + (d.commodityIndex || 0) + gauss(NB.commodityIndex * nMult), 20, 400);
  const worldDemandIndex = clamp(s.worldDemandIndex + 0.08 * (100 - s.worldDemandIndex) + (d.worldDemandIndex || 0) + gauss(NB.worldDemandIndex * nMult), 40, 220);

  /* --- 2а. ДЕФОЛТ ПО ГОСДОЛГУ --- */
  // Секвестр (§7) молча режет расходы, когда рынок не даёт занять достаточно — но это
  // не то же самое, что дефолт: секвестр экономит через боль внутри страны, дефолт —
  // это прямой отказ платить кредиторам. Это осознанное разовое решение Минфина
  // (decisions.sovereignDefault), а не автоматический порог: провести его вне
  // реального долгового кризиса он не может — рынок и так не в панике.
  const prevLockout = Math.max(0, (s.marketLockoutQuartersLeft || 0) - 1);
  const sovereignDefault = !!decisions.sovereignDefault && prevLockout === 0 && (s.activeCrises || []).includes('debt');
  const marketLockoutQuartersLeft = sovereignDefault ? 7 : prevLockout;
  const lockedOutOfMarkets = marketLockoutQuartersLeft > 0;
  const defaultedEver = sovereignDefault || !!s.defaultedEver;
  if (sovereignDefault) {
    news.push(mkNews('crisis', 'ДЕФОЛТ: ПРАВИТЕЛЬСТВО ОБЪЯВЛЯЕТ РЕСТРУКТУРИЗАЦИЮ ДОЛГА',
      'Вместо очередного секвестра — прямой отказ платить по графику. Часть долга списывается принудительно, а доступ к новым заимствованиям закрыт на несколько кварталов: расходы придётся финансировать только из того, что удаётся собрать прямо сейчас.',
      { priority: 10, chain: ['Долговой кризис', 'Дефолт', 'Долг списан', 'Рынок закрыт', 'Премия за риск ↑↑'] }));
    nextQueue.push(makeImpulse('govTrust', -18, 'Дефолт по государственному долгу', 'fast', difficulty));
    nextQueue.push(makeImpulse('businessConfidence', -16, 'Дефолт: инвесторы уходят', 'default', difficulty, 'other'));
    nextQueue.push(makeImpulse('capitalFlow', -35, 'Бегство капитала после дефолта', 'default', difficulty));
  }

  /* --- 2б. ПОМОЩЬ МВФ --- */
  // Альтернатива дефолту, а не его дополнение: тоже осознанное решение Минфина
  // в реальном долговом кризисе, но не отказ платить, а внешнее экстренное
  // финансирование под условия. Ставка и премия за риск падают сразу, а взамен
  // расходы и выплаты обязаны сокращаться два года — это условие программы,
  // а не то, что можно передумать через квартал.
  const prevImfLeft = Math.max(0, (s.imfQuartersLeft || 0) - 1);
  const imfStarted = !!decisions.imfProgram && prevImfLeft === 0 && !sovereignDefault && (s.activeCrises || []).includes('debt');
  const imfQuartersLeft = imfStarted ? 8 : prevImfLeft;
  const imfActive = imfQuartersLeft > 0;
  if (imfStarted) {
    news.push(mkNews('gov', 'МВФ ОДОБРИЛ ЭКСТРЕННОЕ ФИНАНСИРОВАНИЕ',
      'Вместо реструктуризации — кредит на льготных условиях: ставка по долгу и премия за риск снижаются сразу. Взамен бюджет два года обязан сокращать расходы и выплаты — это уже не решение Минфина, а условие программы, и его нельзя будет отменить, не разорвав саму программу.',
      { priority: 10, chain: ['Долговой кризис', 'Программа МВФ', 'Ставка по долгу ↓', 'Обязательная консолидация', 'Доверие ↓'] }));
    nextQueue.push(makeImpulse('riskPremium', -1.6, 'Программа МВФ снижает премию за риск', 'fast', difficulty));
    nextQueue.push(makeImpulse('govTrust', -5, 'Программа МВФ: обязательная экономия непопулярна', 'default', difficulty, 'other'));
  } else if ((s.imfQuartersLeft || 0) > 0 && imfQuartersLeft === 0) {
    news.push(mkNews('gov', 'ПРОГРАММА МВФ ЗАВЕРШЕНА', 'Обязательные условия сняты — бюджетная политика снова полностью в руках Минфина.', { priority: 8 }));
  }

  /* --- 3. статьи бюджета --- */
  const rawShares = { health: decisions.shareHealth, education: decisions.shareEducation, science: decisions.shareScience, defense: decisions.shareDefense, admin: decisions.shareAdmin };
  const sum5 = rawShares.health + rawShares.education + rawShares.science + rawShares.defense + rawShares.admin;
  const otherRaw = Math.max(4, 100 - sum5);
  const shareBase = sum5 + otherRaw;
  const ns = (x) => (x / shareBase) * 100;
  const budgetShares = { health: ns(rawShares.health), education: ns(rawShares.education), science: ns(rawShares.science), defense: ns(rawShares.defense), admin: ns(rawShares.admin), other: ns(otherRaw) };
  /* Обязательство по обороне: увеличение военной доли, на которое Минфин согласился
     по просьбе президента (decisions.defensePledge), держится два года — бот-Минфин
     не откатывает его через квартал к доле своего характера. Собственный рост доли
     у бота (например, на время войны) обязательством не считается. */
  const prevCommit = s.defenseCommit || null;
  const defenseCommit = decisions.defensePledge && budgetShares.defense > (s.budgetShares ? s.budgetShares.defense : 0) + 0.5
    ? { share: Math.round(budgetShares.defense), left: 8 }
    : prevCommit && prevCommit.left > 1 ? { ...prevCommit, left: prevCommit.left - 1 } : null;

  /* --- 4. ДЕНЕЖНАЯ ТРАНСМИССИЯ: ключевая ставка -> рыночные ставки --- */
  const rStarTarget = 1.55 + 0.55 * (s.potentialGrowth - 2.3) + 0.30 * (worldRate - worldInflation) + 0.25 * (s.riskPremium - 1.4) + (d.rStar || 0);
  const rStar = clamp(ema(s.rStar, rStarTarget, 0.06), -1.5, 6);

  const riskPremiumTarget = 0.8 + C.debtLevelPremium * Math.max(0, s.debtToGdp - 55) + 0.045 * Math.max(0, s.bankingRisk - 45)
    + 0.035 * Math.max(0, 55 - s.govTrust) + 0.03 * Math.max(0, 60 - s.cbCredibility) + 0.02 * Math.max(0, 55 - s.policyCoordination)
    - 0.02 * Math.max(0, -(Number.isFinite(s.netDebtToGdp) ? s.netDebtToGdp : s.debtToGdp)) + (s.regime === 'currency' || s.regime === 'debt' ? 1.5 : 0)
    + (lockedOutOfMarkets ? 3.5 : 0) + (defaultedEver ? 0.3 : 0) // рынок не забывает дефолт — даже после локаута премия не возвращается к нулю
    + RE.riskPremium // судебная реформа: спор с государством можно выиграть — риск дешевеет
    // поверенная стабилизационная программа (с лагом в квартал: рынок судит
    // по прошлой отчётности) — инвесторы снова готовы держать местные деньги
    - 1.6 * (Number.isFinite(s.stabilizationCred) ? s.stabilizationCred : 0);
  const riskPremium = clamp(ema(s.riskPremium, riskPremiumTarget, 0.22) + (d.riskPremium || 0), 0.2, 14);

  const bankSpread = C.bankSpreadBase + 0.35 * clamp(s.bankNPL - 3, 0, 10) + 0.25 * clamp(12 - s.bankCapitalAdequacy, 0, 8)
    + 0.02 * Math.max(0, 60 - s.bankLiquidity) + 0.15 * Math.max(0, decisions.reserveReq - 6) + 0.1 * Math.max(0, decisions.capitalRequirement - 10.5);
  const lendingTarget = decisions.keyRate + C.termPremium + bankSpread + 0.3 * riskPremium;
  const lendingRate = clamp(ema(s.lendingRate, lendingTarget, C.lendingPassthrough[difficulty]), 0, 40);
  const depositRate = clamp(decisions.keyRate - C.depositSpread + 0.05 * Math.max(0, 55 - s.bankLiquidity), -2, 35);
  const realLendingRate = lendingRate - s.inflationExpectations;
  const realPolicyRate = decisions.keyRate - s.inflationExpectations;
  const neutralLendingReal = rStar + C.termPremium + C.bankSpreadBase;
  const rateGap = realLendingRate - neutralLendingReal;   // >0 — денежные условия жёстче нейтральных
  const policyStance = realPolicyRate - rStar;
  if (Math.abs(rateGap) > 0.15) add('gdpGrowth', `Денежные условия ${rateGap > 0 ? 'жёстче' : 'мягче'} нейтральных на ${fmt1(Math.abs(rateGap))} п.п. (реальная ставка по кредитам ${fmt1(realLendingRate)}% против нейтральных ${fmt1(neutralLendingReal)}%)`, -rateGap * C.invRate * 0.2);

  /* --- 5. КРЕДИТНЫЙ КАНАЛ И БАНКОВСКИЙ ЦИКЛ --- */
  const creditDemandGrowth = C.creditDemandBase - C.creditRateSens * rateGap + C.creditConfSens * (s.businessConfidence - 55) / 5
    + C.creditAccelerator * (s.gdpGrowth - s.potentialGrowth) - C.creditReserveSens * (decisions.reserveReq - 6) + (d.creditDemand || 0);
  const maxCreditStock = s.bankCapital / (Math.max(8, decisions.capitalRequirement) / 100 * T.riskWeight);
  const supplyGrowthCap = (maxCreditStock / Math.max(1, s.creditVolume) - 1) * 100 * 4;
  const creditCrunch = supplyGrowthCap < creditDemandGrowth - 0.5;
  const creditGrowth = clamp(Math.min(creditDemandGrowth, supplyGrowthCap), -35, 30);
  const creditVolume = Math.max(1, applyAnnualGrowth(s.creditVolume, creditGrowth));
  if (creditCrunch) add('banking', 'Капитал банков ограничивает выдачу новых кредитов (кредитное сжатие)', supplyGrowthCap - creditDemandGrowth);

  /* --- 6. СТОРОНА ПРЕДЛОЖЕНИЯ: капитал, труд, производительность, потенциал --- */
  const eduHealthShareGdp = (budgetShares.health + budgetShares.education) / 100 * s.govPurchasesReal / Math.max(1, s.gdp) * 100;
  const baseEduHealth = (CONFIG.initial.budgetShares.health + CONFIG.initial.budgetShares.education) / 100 * CONFIG.initial.govPurchasesReal / CONFIG.initial.gdp * 100;
  const humanCapitalTarget = 100 + 7.0 * (eduHealthShareGdp - baseEduHealth) + RE.humanCapital;
  const humanCapitalIndex = clamp(s.humanCapitalIndex + 0.055 * (humanCapitalTarget - s.humanCapitalIndex) + gauss(0.04 * nMult), 55, 200);

  const scienceShareGdp = budgetShares.science / 100 * s.govPurchasesReal / Math.max(1, s.gdp) * 100;
  const baseScience = CONFIG.initial.budgetShares.science / 100 * CONFIG.initial.govPurchasesReal / CONFIG.initial.gdp * 100;
  const tfpGrowth = CONFIG.prod.tfpBase + 0.45 * (scienceShareGdp - baseScience) + 0.10 * (s.infrastructureIndex - 100) / 10
    - (s.regime === 'banking' || s.regime === 'debt' ? 0.35 : 0);
  const productivity = clamp(applyAnnualGrowth(s.productivity, tfpGrowth) + (d.productivity || 0) + gauss(NB.productivity * nMult), 50, 400);

  const govInvShareGdp = (s.govInvestmentReal + (s.projectReal || 0)) / Math.max(1, s.gdp) * 100;
  const baseGovInvShare = CONFIG.initial.govInvestmentReal / CONFIG.initial.gdp * 100;
  const infrastructureIndex = clamp(s.infrastructureIndex + 0.9 * (govInvShareGdp - baseGovInvShare) - 0.25 * (s.infrastructureIndex - 100) / 10
    + (d.infrastructureIndex || 0) + gauss(0.05 * nMult), 50, 220);

  const capitalStock = Math.max(1, s.capitalStock + (s.businessInvestment + s.govInvestmentReal - CONFIG.prod.depreciation / 100 * s.capitalStock) / QUARTERS_PER_YEAR);
  const laborForce = clamp(s.laborForce * (1 + (d.laborForce || 0) / 100), 60, 140);
  const supplyScar = clamp(s.supplyScar * 0.94 + (d.potentialShock || 0), -18, 6);
  const nairuTarget = T.nairu + 0.35 * Math.max(0, s.unemployment - T.nairu - 2) + 0.2 * Math.max(0, s.shadowShare - 14) * 0.1
    + RE.nairu;
  const nairu = clamp(s.nairu + C.nairuHysteresis * (nairuTarget - s.nairu), 3.5, 12);

  const potentialGdp = potentialFrom(capitalStock, laborForce, nairu, humanCapitalIndex, productivity, infrastructureIndex, TFP_SCALE, supplyScar);
  const potentialGrowth = clamp(ema(s.potentialGrowth, annualizedGrowth(s.potentialGdp, potentialGdp), 0.35), -4, 8);

  /* --- 7. БЮДЖЕТ: реальные уровни расходов и фискальный импульс --- */
  const trendReal = potentialGrowth;
  // условие программы МВФ — не совет, а потолок: пока она действует, госзакупки
  // и выплаты обязаны сокращаться (не решение Минфина), инвестиции — не расти
  const imfGovSpending = imfActive ? Math.min(decisions.govSpending, -1) : decisions.govSpending;
  const imfTransfers = imfActive ? Math.min(decisions.transfers, -1) : decisions.transfers;
  const imfGovInvestment = imfActive ? Math.min(decisions.govInvestment, 0) : decisions.govInvestment;
  const govPurchasesGrowth = clamp(trendReal + imfGovSpending, -12, 14);
  const transfersGrowth = clamp(trendReal + imfTransfers + (d.transfersPressure || 0) + RE.transfers, -12, 16);
  const govInvestmentGrowth = clamp(trendReal + imfGovInvestment + (d.govInvestmentPush || 0), -16, 20);
  const plannedPurchases = Math.max(1, applyAnnualGrowth(s.govPurchasesReal, govPurchasesGrowth));
  const plannedTransfers = Math.max(1, applyAnnualGrowth(s.transfersReal, transfersGrowth));
  const plannedGovInv = Math.max(1, applyAnnualGrowth(s.govInvestmentReal, govInvestmentGrowth));
  // Рынок не даёт занять сколько угодно: чем выше долг и премия за риск, тем меньше
  // дефицит, который вообще можно профинансировать. Остальное — секвестр.
  const projRevenue = s.govRevenue * (1 + (s.potentialGrowth + s.inflation) / 400);
  const projInterest = s.govDebt * s.effectiveDebtRate / 100;
  const maxDeficitPct = lockedOutOfMarkets ? clamp(11 - 0.10 * Math.max(0, s.debtToGdp - 55) - 1.5 * Math.max(0, s.riskPremium - 2.0), 0, 0.8)
    : clamp(11 - 0.10 * Math.max(0, s.debtToGdp - 55) - 1.5 * Math.max(0, s.riskPremium - 2.0), 0.5, 11);
  const allowedPrimary = projRevenue + maxDeficitPct / 100 * s.nominalGdp - projInterest;
  const plannedPrimary = (plannedPurchases + plannedTransfers + plannedGovInv) * s.priceLevel / 100;
  const sequesterFactor = (plannedPrimary > allowedPrimary && allowedPrimary > 0)
    ? clamp(allowedPrimary / plannedPrimary, 0.72, 1) : 1;
  const govPurchasesReal = plannedPurchases * sequesterFactor;
  const transfersReal = plannedTransfers * (sequesterFactor < 1 ? Math.min(1, sequesterFactor + 0.10) : 1);
  const govInvestmentReal = plannedGovInv * (sequesterFactor < 1 ? Math.max(0.5, sequesterFactor - 0.12) : 1);
  // стройки в округах и разовые ответы на события — госрасходы сверх ползунков:
  // входят в ВВП и в дефицит, но не в базу, от которой растут ползунки
  const projectReal = RS.projectPct / 100 * s.gdp;
  const eventReal = (RS.eventPct + WC.spendPct + CP.spendPct + AN.spendPct + RV.spendPct + DF.spendPct + GD.spendPct) / 100 * s.gdp;
  if (sequesterFactor < 0.995) {
    news.push(mkNews('crisis', `СЕКВЕСТР БЮДЖЕТА: РАСХОДЫ УРЕЗАНЫ НА ${fmt1((1 - sequesterFactor) * 100)}%`,
      `Инвесторы отказываются финансировать дефицит больше ${fmt1(maxDeficitPct)}% ВВП при долге ${fmt1(s.debtToGdp)}% и премии за риск ${fmt1(s.riskPremium)} п.п. Правительство вынуждено резать расходы независимо от своих планов — первыми страдают госинвестиции.`,
      { priority: 10, chain: ['Долг ↑', 'Премия за риск ↑', 'Рынок закрыт', 'Секвестр расходов', 'Спад ↑'] }));
  }

  const actualGrowthG = annualizedGrowth(s.govPurchasesReal, govPurchasesReal);
  const actualGrowthTr = annualizedGrowth(s.transfersReal, transfersReal);
  const actualGrowthIg = annualizedGrowth(s.govInvestmentReal, govInvestmentReal);
  const slack = clamp(-s.outputGap, 0, 6) / 6;
  const mPurchases = C.multPurchases[0] + C.multPurchases[1] * slack;
  const mTransfers = C.multTransfers[0] + C.multTransfers[1] * slack;
  const mInvestment = C.multInvestment[0] + C.multInvestment[1] * slack;
  const mTax = C.multTax[0] + C.multTax[1] * slack;
  const shareG = s.govPurchasesReal / s.gdp; const shareTr = s.transfersReal / s.gdp; const shareIg = s.govInvestmentReal / s.gdp;
  const wedgeChange = taxWedge(decisions) - taxWedge(s);
  const fiscalImpulse = mPurchases * decisions.govSpending * shareG + mTransfers * decisions.transfers * shareTr
    + mInvestment * decisions.govInvestment * shareIg - mTax * wedgeChange * 0.35;
  if (Math.abs(fiscalImpulse) > 0.05) {
    add('gdpGrowth', `Бюджетный импульс ${fmtSigned1(fiscalImpulse)} п.п. (мультипликатор расходов ${fmt2(mPurchases)} — ${slack > 0.4 ? 'экономика ниже потенциала, деньги доходят до выпуска' : 'экономика близка к пределу, эффект уходит в цены'})`, fiscalImpulse);
  }

  /* --- 8. IS: компоненты спроса --- */
  const capacityDrag = -C.capacityDrag * Math.pow(Math.max(0, s.outputGap - 1), 1.25);
  const creditRatio = s.creditVolume / Math.max(1, s.nominalGdp);
  const creditImpulse = (creditGrowth - (s.potentialGrowth + s.inflationExpectations)) * creditRatio * C.creditImpulseToDemand;

  const prevU = Number.isFinite(s.prevUnemployment) ? s.prevUnemployment : s.unemployment;
  const employmentGrowthPrev = -(s.unemployment - prevU) * QUARTERS_PER_YEAR;
  const realWageIncome = s.wageGrowth - s.inflation + employmentGrowthPrev;
  const realTransferGrowth = transfersGrowth;
  /* Доход с капитала — реальная величина: gdpGrowth уже реальный рост, и
     вычитать из него всю инфляцию значило дефлировать дважды. При инфляции
     34% это одно слагаемое опускало рост потребления на семь пунктов при
     любой политике. Реальный доход держателей бумаг съедает только
     неожиданная инфляция — ожидаемая уже заложена в ставки. */
  const capitalIncomeGrowth = s.gdpGrowth - Math.max(0, s.inflation - s.inflationExpectations) + 0.5 * (s.gdpGrowth - s.potentialGrowth);
  const wedgeDrag = -wedgeChange * 0.55;
  const realIncomeGrowth = 0.62 * realWageIncome + 0.16 * realTransferGrowth + 0.22 * capitalIncomeGrowth + wedgeDrag;

  const consShareDev = s.consumption / s.potentialGdp / (CONFIG.initial.consumption / CONFIG.initial.gdp) - 1;
  const invShareDev = s.businessInvestment / s.potentialGdp / (CONFIG.initial.businessInvestment / CONFIG.initial.gdp) - 1;
  const consumptionCore = potentialGrowth - 16 * consShareDev + C.consIncome * (realIncomeGrowth - potentialGrowth)
    - C.consRate * (depositRate - s.inflationExpectations - (rStar - 1.0))
    + C.consConf * (s.consumerConfidence - 55) / 5 + C.consCredit * creditImpulse
    + 0.35 * slack * 0.16 * decisions.transfers + capacityDrag * 0.6;
  const consumptionGrowth = clamp(C.consInertia * s.consumptionGrowth + (1 - C.consInertia) * consumptionCore
    + (d.consumption || 0) + gauss(NB.consumption * nMult), -18, 14);

  const investmentCore = potentialGrowth - 24 * invShareDev + C.invAccelerator * (s.gdpGrowth - s.potentialGrowth) - C.invRate * rateGap
    + C.invConf * (s.businessConfidence - 55) / 5 + C.invCredit * creditImpulse
    + C.invCrowdIn * decisions.govInvestment * (shareIg / 0.03) - C.invProfitTax * (decisions.profitTaxRate - s.profitTaxRate)
    + (creditCrunch ? -2.5 : 0) + capacityDrag;
  const investmentGrowth = clamp(C.invInertia * s.investmentGrowth + (1 - C.invInertia) * investmentCore
    + (d.investment || 0) + gauss(NB.investment * nMult), -35, 25);

  const exportsGrowth = clamp(0.95 + C.exportWorld * worldGdpGrowth + 0.03 * (worldDemandIndex - 100)
    - C.exportRer * (s.realExchangeRate - 100) + (d.exportsGrowth || 0) + gauss(NB.exports * nMult), -30, 30);
  const importsGrowth = clamp(0.15 + C.importIncome * s.gdpGrowth + C.importRer * (s.realExchangeRate - 100)
    + (d.importsGrowth || 0) + gauss(NB.imports * nMult), -30, 30);

  const consumption = Math.max(1, applyAnnualGrowth(s.consumption, consumptionGrowth));
  const businessInvestment = Math.max(1, applyAnnualGrowth(s.businessInvestment, investmentGrowth));
  const exports = Math.max(1, applyAnnualGrowth(s.exports, exportsGrowth));
  const imports = Math.max(1, applyAnnualGrowth(s.imports, importsGrowth));

  const gdp = Math.max(1, consumption + businessInvestment + govPurchasesReal + govInvestmentReal + projectReal + eventReal + exports - imports);
  const gdpGrowth = annualizedGrowth(s.gdp, gdp);
  const outputGap = clamp((gdp - potentialGdp) / potentialGdp * 100, -25, 20);
  add('gdpGrowth', `Потребление ${fmtSigned1(consumptionGrowth)}%, инвестиции ${fmtSigned1(investmentGrowth)}%, госсектор ${fmtSigned1(govPurchasesGrowth)}%, чистый экспорт ${fmtMoneySigned(exports - imports)}`, gdpGrowth - s.gdpGrowth);
  if (capacityDrag < -0.15) add('gdpGrowth', `Экономика упирается в предел мощностей: часть спроса уходит в цены, а не в выпуск (${fmt1(capacityDrag)} п.п.)`, capacityDrag);

  /* --- 9. РЫНОК ТРУДА: спрос на труд -> занятость -> напряжённость -> зарплаты --- */
  const unemploymentTarget = nairu - C.okun * outputGap;
  const unemployment = clamp(s.unemployment + C.uAdjust * (unemploymentTarget - s.unemployment)
    + (d.unemployment || 0) + gauss(NB.unemployment * nMult), 1.5, 30);
  const employment = 100 - unemployment;
  const tightness = nairu - unemployment;              // >0 — дефицит работников
  const vacancyRate = clamp(3.0 + 0.95 * tightness + 0.25 * outputGap, 0.2, 14);
  add('unemployment', `Разрыв выпуска ${fmtSigned1(outputGap)}% через закон Оукена тянет безработицу к ${fmt1(unemploymentTarget)}%`, unemployment - s.unemployment);

  const trendLaborProductivity = clamp(potentialGrowth - (laborForce / s.laborForce - 1) * 400, -2, 6);
  const wageGrowth = clamp(C.wageExpect * s.inflationExpectations + trendLaborProductivity
    + C.wageTightness * tightness + 0.18 * Math.max(0, vacancyRate - 4)
    - C.wageSocial * (decisions.socialContribRate - s.socialContribRate)
    + (d.wageGrowth || 0) + gauss(NB.wageGrowth * nMult), Math.min(0, s.wageGrowth * 0.5), 45);
  const unitLaborCostGrowth = wageGrowth - trendLaborProductivity;
  if (tightness > 0.4) add('inflation', `Дефицит работников (безработица ${fmt1(unemployment)}% против естественной ${fmt1(nairu)}%) разгоняет зарплаты до ${fmt1(wageGrowth)}%`, C.ulcPass * (unitLaborCostGrowth - s.inflationExpectations));

  /* --- 10. ЦЕНЫ: кривая Филлипса + издержки + ожидания --- */
  const phillipsAsym = outputGap < 0 ? 0.55 : 1.0;   // цены и зарплаты вниз идут заметно хуже, чем вверх
  const demandPressure = phillipsAsym * (C.phillipsLinear * outputGap + C.phillipsConvex * outputGap * Math.abs(outputGap));
  const ulcPressure = C.ulcPass * (unitLaborCostGrowth - s.inflationExpectations);
  const commodityPressure = C.commodityPass * (commodityIndex - s.commodityIndex) * 4;
  const supplyShock = (d.inflationSupply || 0);
  const vatPressure = (d.vatPrices || 0);
  const inflationPre = s.inflationExpectations + demandPressure + ulcPressure + supplyShock + vatPressure + commodityPressure;

  /* --- 11. ПЛАТЁЖНЫЙ БАЛАНС И КУРС --- */
  const carry = (decisions.keyRate - s.inflationExpectations) - (worldRate - worldInflation) - riskPremium;
  const netCapitalFlow = C.capitalFlowCarry * carry + C.capitalFlowConf * (s.businessConfidence - 55)
    + C.capitalFlowStab * (s.financialStability - 70) + (d.capitalFlow || 0) + gauss(NB.capitalFlow * nMult)
    - (s.regime === 'debt' || s.regime === 'currency' ? 25 : 0);
  const currentAccountPrev = s.exports - s.imports - 0.012 * s.govDebt;
  // fxIntervention не учитывается здесь второй раз: его эффект на резервы и курс уже
  // прямо применяется ниже (marketDepr/reserves), иначе он задвоился бы.
  const bop = currentAccountPrev + netCapitalFlow;
  const pppAnchor = s.inflationExpectations - worldInflation;
  const rawPressure = pppAnchor + C.fxBop * (-bop / Math.max(1, s.nominalGdp) * 100) - C.fxCarry * carry;
  const regimeDamp = decisions.fxRegime === 'peg' ? 0.08 : decisions.fxRegime === 'managed' ? 0.45 : 1.0;
  /* При свободном курсе ориентир не задаёт никто: движок держит его равным
     рынку, чтобы при переходе на управляемый режим ползунок стартовал с
     осмысленного значения. Округление до целого — потому что ползунок игрока
     ходит по единице: иначе бот-ЦБ следующего квартала возвращал бы в решениях
     курс вроде 100.38, которого игрок выставить не может (нашёл стенд длинных
     партий). Сам диапазон при этом шире ползунка: рынок имеет право уйти
     дальше, чем защищает интервенциями любой центробанк. */
  const fxTarget = decisions.fxRegime === 'free'
    ? roundTo(clamp(s.exchangeRate, 20, 1200), 1)
    : clamp(decisions.fxTarget || s.exchangeRate, 20, 1200);
  const marketDepr = rawPressure + gauss(NB.exchangeRate * nMult);           // что сделал бы свободный курс
  const pullToTarget = clamp((fxTarget / Math.max(1, s.exchangeRate) - 1) * 100 * 2, -35, 35);
  const desiredDepr = decisions.fxRegime === 'free' ? marketDepr
    : marketDepr * regimeDamp + pullToTarget * (1 - regimeDamp);
  // Разница между желаемым и рыночным движением курса — это и есть объём интервенций.
  // Хотим валюту слабее рынка → покупаем валюту, резервы растут. Хотим крепче → продаём и тратим.
  const gapPct = desiredDepr - marketDepr;
  let defenseIntervention = decisions.fxRegime === 'free' ? 0 : gapPct * Math.max(1, s.nominalGdp) / 100 / C.fxBop;
  const reserveYield = s.reserves * worldRate / 100 / QUARTERS_PER_YEAR;
  let unfundedPct = 0;
  const quarterlyNeed = defenseIntervention / QUARTERS_PER_YEAR;
  if (quarterlyNeed < 0 && -quarterlyNeed > s.reserves * 0.6) {          // продавать нечего
    const feasible = -s.reserves * 0.6 * QUARTERS_PER_YEAR;
    unfundedPct = (defenseIntervention - feasible) / (Math.max(1, s.nominalGdp) / 100 / C.fxBop);
    defenseIntervention = feasible;
  }
  let depreciationPct = desiredDepr - unfundedPct
    + decisions.fxIntervention / Math.max(1, s.nominalGdp) * 100 * 2.5;
  let reserves = Math.max(0, s.reserves + decisions.fxIntervention + defenseIntervention / QUARTERS_PER_YEAR
    + reserveYield + (d.reserves || 0) + gauss(NB.reserves * nMult * 0.3));
  let fxBreak = false;
  if (decisions.fxRegime !== 'free' && reserves < 0.22 * CONFIG.initial.reserves) {
    fxBreak = true; depreciationPct += 22; reserves = Math.max(reserves, 0.25 * CONFIG.initial.reserves);
    news.push(mkNews('crisis', 'СРЫВ ВАЛЮТНОГО РЕЖИМА: ДЕВАЛЬВАЦИЯ', 'Резервы исчерпаны — удержать курс не удалось. Валюта резко девальвирована, импортная инфляция придёт в ближайшие кварталы.', { priority: 10, chain: ['Резервы ↓', 'Защита курса невозможна', 'Девальвация', 'Импортные цены ↑', 'Инфляция ↑'] }));
  }
  const exchangeRate = clamp(applyAnnualGrowth(s.exchangeRate, depreciationPct), 20, 1200);
  const fxDeprAnnual = annualizedGrowth(s.exchangeRate, exchangeRate);
  const importPriceInflation = worldInflation + fxDeprAnnual;
  const fxPressureInfl = C.fxPass * fxDeprAnnual + C.worldInflPass * (worldInflation - T.worldInflation);
  if (Math.abs(fxPressureInfl) > 0.1) add('inflation', `Перенос курса в цены импорта: валюта ${fxDeprAnnual > 0 ? 'ослабла' : 'укрепилась'} на ${fmt1(Math.abs(fxDeprAnnual))}% годовых`, fxPressureInfl);
  if (Math.abs(depreciationPct) > 0.5) add('exchangeRate', `Платёжный баланс ${fmtMoneySigned(bop)} и разница реальных ставок (${fmt1(carry)} п.п.) ${bop < 0 ? 'давят на' : 'поддерживают'} курс`, depreciationPct);

  /* Жёсткость цен вниз. Магазины и работодатели охотно поднимают цены и
     зарплаты и очень неохотно их режут: дефляции в современных экономиках
     редко глубже −2…−4% в год. Без этого после удачной стабилизации модель
     проваливалась в дефляцию −10% (её нижняя граница) при нулевой ставке —
     реальная ставка выходила за 10%, и рецессия добивала то, что пощадила
     сама стабилизация. Ниже нуля давление на цены проходит лишь на 35%:
     сырые −10% становятся примерно −3,5%; выше нуля ничего не меняется. */
  const inflationRaw = inflationPre + fxPressureInfl + (d.inflation || 0) + gauss(NB.inflation * nMult);
  const inflation = clamp(inflationRaw >= 0 ? inflationRaw : inflationRaw * 0.35, -10, 90);
  const coreInflation = clamp(s.inflationExpectations + demandPressure + ulcPressure * 0.9, -10, 90);
  add('inflation', `Ожидания ${fmt1(s.inflationExpectations)}% + давление спроса ${fmtSigned1(demandPressure)} п.п. + издержки труда ${fmtSigned1(ulcPressure)} п.п.`, inflation - s.inflation);
  if (Math.abs(supplyShock) > 0.1) add('inflation', 'Шок предложения: издержки выросли при падении выпуска', supplyShock);

  /* --- СТАБИЛИЗАЦИОННАЯ ПРОГРАММА ---
     Большие инфляции в истории кончались не постепенным сжатием, а сменой
     режима (Сарджент, «Конец четырёх больших инфляций»): жёсткие деньги плюс
     бюджет, который перестаёт их требовать. Когда рынок верит, что оба условия
     выполнены всерьёз, ожидания рушатся за кварталы, а не за годы — и
     рецессия выходит мельче, чем при медленной дезинфляции.

     Без этой механики сценарий «Гиперинфляция» политически не выигрывался:
     перебор 432 стратегий не нашёл ни одной, сохраняющей демократию, —
     ожидания сползали так медленно, что сбить инфляцию можно было только
     рецессией с безработицей 16%.

     Доверие к программе (0..1) копится, пока выполнены опоры:
       — деньги: реальная ставка ≥ 3 п.п., ЦБ не печатает и не заливает банки;
       — бюджет: дефицит не больше 3% ВВП или бюджетный импульс сокращается;
       — якорь (бонус): курс управляется или фиксирован при достаточных резервах.
     Одна жёсткая ставка без бюджета копит доверие втрое медленнее — рынок
     помнит, чем кончаются программы, которые Минфин не поддерживает. Нарушение
     денежной опоры обрушивает доверие сразу. Программа имеет смысл только при
     высокой инфляции; когда цены вернулись к цели, доверие плавно гаснет —
     дальше работает обычное доверие к ЦБ. */
  const prevStab = Number.isFinite(s.stabilizationCred) ? s.stabilizationCred : 0;
  const highInflation = s.inflation >= infTarget + 8 || (prevStab > 0.05 && s.inflation > infTarget + 2);
  const moneyPillar = decisions.keyRate - s.inflationExpectations >= 3
    && (decisions.moneySupplyOp || 0) <= 0 && !decisions.emergency;
  const budgetPillar = (Number.isFinite(s.budgetBalancePctGdp) ? s.budgetBalancePctGdp : 0) >= -3 || fiscalImpulse <= -0.3;
  const anchorPillar = decisions.fxRegime !== 'free' && s.reserves >= 0.5 * CONFIG.initial.reserves;
  let stabilizationCred = prevStab;
  if (!highInflation) stabilizationCred = prevStab * 0.7;
  else if (!moneyPillar) stabilizationCred = prevStab * 0.35;
  else stabilizationCred = prevStab + (budgetPillar ? 0.3 : 0.1) + (anchorPillar ? 0.1 : 0);
  stabilizationCred = clamp(stabilizationCred, 0, 1);
  if (stabilizationCred < 0.02) stabilizationCred = 0;
  if (highInflation && prevStab < 0.5 && stabilizationCred >= 0.5) {
    news.push(mkNews('cb', 'СТАБИЛИЗАЦИОННАЯ ПРОГРАММА: РЫНКИ ПОВЕРИЛИ',
      `Жёсткая ставка${budgetPillar ? ' и бюджет без дыры' : ''}${anchorPillar ? ' при удерживаемом курсе' : ''} убеждают, что деньги перестанут обесцениваться. Ожидания начали падать быстрее самих цен.`,
      { priority: 8, chain: ['Реальная ставка ↑', budgetPillar ? 'Дефицит под контролем' : 'Бюджет отстаёт', 'Доверие к программе ↑', 'Ожидания ↓', 'Инфляция ↓'] }));
  } else if (prevStab >= 0.5 && highInflation && !moneyPillar) {
    news.push(mkNews('cb', 'СТАБИЛИЗАЦИЯ СОРВАНА: ДОВЕРИЕ ПОТЕРЯНО',
      'Денежные условия ослаблены раньше, чем инфляция побеждена. Рынок помнит такие программы — второй раз поверят не скоро.',
      { priority: 9, chain: ['Ставка ↓ / эмиссия', 'Программа сорвана', 'Ожидания ↑', 'Инфляция ↑'] }));
  }

  /* --- ЦЕНЫ ОСТАНОВЛЕНЫ ---
     Доведённая до конца стабилизация — одна из немногих побед, которую люди
     замечают сразу и помнят: после бразильского Плана Реал в 1994-м министр
     финансов, остановивший цены, выиграл президентские выборы. Когда
     поверенная программа (доверие ≥ 0,6) возвращает инфляцию к цели,
     рейтинг получает разовый скачок, а напряжение — разовый спад. Один раз
     за партию: второй раз «спасти страну от инфляции» не получится. */
  const stabilizationWon = !!s.stabilizationWon
    || (prevStab >= 0.6 && s.inflation > infTarget + 3 && inflation <= infTarget + 3);
  const stabilizationBonus = stabilizationWon && !s.stabilizationWon ? 15 : 0;
  if (stabilizationBonus) {
    news.push(mkNews('gov', 'ЦЕНЫ ОСТАНОВЛЕНЫ: СТАБИЛИЗАЦИЯ УДАЛАСЬ',
      `Инфляция ${fmt1(inflation)}% при цели ${fmt1(infTarget)}% — впервые за долгое время ценники перестали меняться каждую неделю. Цена победы — рецессия, но её страна готова простить тем, кто вернул деньгам смысл.`,
      { priority: 10, chain: ['Жёсткая ставка', 'Бюджет под контролем', 'Доверие к программе', 'Ожидания ↓', 'Цены остановлены', 'Рейтинг ↑'] }));
  }

  /* --- МАНДАТ СПАСЕНИЯ ---
     Правительству, которое пришло спасать страну от гиперинфляции, люди дают
     время: так было с Пасом Эстенссоро в Боливии в 1985-м — поддержка держалась,
     пока цены не встали. Без этого политические часы шли быстрее экономических:
     рейтинг обваливался за три–четыре квартала, а самая быстрая стабилизация
     даёт результат через четыре–пять, и перебор 1296 двухфазных стратегий не
     нашёл ни одной, удерживающей демократию.

     Мандат задаётся сценарием (crisisMandateLeft/Total) и тает с каждым
     кварталом. Полную силу он даёт, только пока программа реально работает
     (доверие к ней ≥ 0,3); при бездействии — треть силы, и после первых двух
     кварталов сгорает вдвое быстрее: терпение людей не бесконечно. Поэтому он
     спасает хорошую игру, но не бездействие. */
  const mandateTotal = Number.isFinite(s.crisisMandateTotal) ? s.crisisMandateTotal : 0;
  const mandatePrev = Number.isFinite(s.crisisMandateLeft) ? s.crisisMandateLeft : 0;
  const programOn = stabilizationCred >= 0.3;
  const earlyMandate = mandatePrev > mandateTotal - 2;
  /* Победа над ценами обновляет мандат один раз и полностью: заслуга того,
     кто остановил инфляцию, держится годами (Кардозу после Плана Реал выиграл
     двое выборов подряд), и как раз её не хватало, чтобы пережить рецессию
     после стабилизации — мандат кончался на самом дне спада. После победы
     мандат действует в полную силу: это уже заработанное доверие, а не аванс. */
  const mandateRefill = stabilizationBonus > 0 && mandateTotal > 0;
  const mandateBase = mandateRefill ? mandateTotal : mandatePrev;
  const crisisMandateLeft = mandateBase > 0
    ? Math.max(0, mandateBase - (programOn || earlyMandate || stabilizationWon ? 1 : 2)) : 0;
  const mandateEffect = mandateTotal > 0
    ? (mandateBase / mandateTotal) * (stabilizationWon ? 1 : 0.35 + 0.65 * stabilizationCred) : 0;
  if (mandateRefill) {
    news.push(mkNews('gov', 'СТРАНА ДАЁТ ВРЕМЯ ТЕМ, КТО ОСТАНОВИЛ ЦЕНЫ',
      'Мандат правительства национального спасения продлён: люди готовы пережить рецессию, раз деньги снова что-то значат. Но это последний кредит — дальше судят по работе и зарплатам.',
      { priority: 8 }));
  } else if (mandateBase > 0 && crisisMandateLeft === 0) {
    news.push(mkNews('gov', programOn ? 'МАНДАТ СПАСЕНИЯ ИСЧЕРПАН — ДАЛЬШЕ СУДЯТ ПО ЦЕНАМ' : 'ТЕРПЕНИЕ КОНЧИЛОСЬ: МАНДАТ СПАСЕНИЯ СГОРЕЛ',
      programOn ? 'Кредит доверия, выданный правительству национального спасения, исчерпан. Дальше поддержку определяют не обещания, а ценники и занятость.'
        : 'Правительству давали время, чтобы остановить цены. Время вышло раньше, чем программа заработала.', { priority: 8 }));
  }

  /* ожидания и доверие к ЦБ */
  const inflDev = Math.abs(inflation - infTarget);
  const adaptSpeed = Math.max(
    clamp(C.expAdaptMin + (C.expAdaptMax - C.expAdaptMin) * clamp(inflDev / 6, 0, 1) * (1 - s.cbCredibility / 140), 0.08, 0.55),
    0.2 + 0.35 * stabilizationCred);
  // поверившая программе страна ждёт цель, а не вчерашние цены
  const anchorWeight = Math.max(clamp(s.cbCredibility / 100 * (1 - clamp((inflDev - 2) / 8, 0, 0.6)), 0.05, 0.95),
    0.75 * stabilizationCred);
  const expTarget = anchorWeight * infTarget + (1 - anchorWeight) * (0.75 * inflation + 0.25 * s.inflationExpectations);
  // ожидания двигают не только цифры, но и сами события: шоки, кризисы, курс, эмиссия
  const expShock = clamp(0.32 * Math.max(0, supplyShock) + 0.055 * Math.max(0, Math.abs(fxDeprAnnual) - 6)
    + (activeCrisesPre.indexOf('currency') >= 0 ? 0.5 : 0) + (activeCrisesPre.indexOf('banking') >= 0 ? 0.25 : 0)
    + (decisions.emergency ? 0.5 : 0) + 0.25 * Math.max(0, inflation - s.inflation - 1)
    + (Math.abs(targetChange) > 0.01 ? targetChange * 0.6 : 0)
    - (s.cbCredibility > 75 ? 0.2 : 0) - (s.cbCredibility > 88 ? 0.1 : 0), -0.8, 2.4)
    // заголовки пугают меньше, когда люди верят программе
    * (1 - 0.5 * stabilizationCred);
  const inflationExpectations = clamp(s.inflationExpectations + adaptSpeed * (expTarget - s.inflationExpectations)
    + expShock + gauss(0.10 * nMult), -5, 40);
  if (Math.abs(expShock) > 0.08) {
    add('inflation', `Событийный сдвиг ожиданий ${fmtSigned1(expShock)} п.п.: люди и бизнес пересматривают свои прогнозы не по статистике, а по заголовкам — ${supplyShock > 0.1 ? 'шок издержек' : Math.abs(fxDeprAnnual) > 6 ? 'движение курса' : decisions.emergency ? 'эмиссионная поддержка банков' : Math.abs(targetChange) > 0.01 ? 'смена цели ЦБ' : 'резкий скачок цен'} виден всем`, expShock);
  }

  const stanceCorrect = sign(policyStance) === sign(inflation - infTarget) || inflDev < 1.0;
  const credDrift = (inflDev < 1.5 ? 0.75 : -0.45 * Math.min(4, inflDev / 1.5))
    + (stanceCorrect ? 0.30 : -0.35) - (decisions.emergency ? 0.7 : 0)
    - (decisions.moneySupplyOp > 3 ? 0.8 : 0) - (s.cbCredibility - 60) * 0.02;
  const cbCredibility = clamp(s.cbCredibility + credDrift * 0.55 - Math.abs(targetChange) * 9
    + (d.cbCredibilityPush || 0) + gauss(0.5 * nMult), 0, 100);

  const priceLevel = Math.max(10, applyAnnualGrowth(s.priceLevel, inflation));
  const nominalGdp = Math.max(1, gdp * priceLevel / 100);
  const realExchangeRate = clamp(s.realExchangeRate * (1 + (inflation - worldInflation - fxDeprAnnual) / 400), 45, 260);

  /* --- 12. БАНКИ: просрочка, убытки, капитал --- */
  const creditTrendRatio = ema(s.creditTrendRatio, creditVolume / nominalGdp * 100, 0.05);
  const creditGap = creditVolume / nominalGdp * 100 - creditTrendRatio;
  // «наследие» кредитного бума: дешёвый кредит сегодня превращается в просрочку через 2–3 года
  const creditGapLag = ema(Number.isFinite(s.creditGapLag) ? s.creditGapLag : 0, creditGap, 0.12);
  const nplTarget = clamp(1.8 + C.nplRate * Math.max(0, realLendingRate - rStar - 1) + C.nplUnemp * Math.max(0, unemployment - nairu)
    + C.nplGap * Math.max(0, -outputGap) + C.nplCreditBoom * Math.max(0, s.creditGapLag), 0.8, 35);
  const bankNPL = clamp(s.bankNPL + C.nplAdjust * (nplTarget - s.bankNPL) + (d.bankNPL || 0) + gauss(NB.bankNPL * nMult), 0.4, 40);
  const loanLosses = creditVolume * (bankNPL / 100) * T.lgd * 0.25;
  const interestMargin = creditVolume * (lendingRate - depositRate) / 100 / QUARTERS_PER_YEAR;
  const opCost = 0.004 * creditVolume;
  const bankProfit = interestMargin - loanLosses - opCost;
  const rwa = Math.max(1, creditVolume * T.riskWeight);
  /* Экстренная поддержка банков была «+12% капитала + 25» — в абсолютных
     единицах, одинаковых для любой экономики. На старте 25 — это ~2,4% активов,
     взвешенных по риску (1050), но после многолетнего кредитного сжатия активы
     падали до сотни, и те же 25 давали +25 п.п. норматива за квартал: стенд
     длинных партий поймал норматив достаточности капитала в 102%. Теперь
     вливание — доля самой банковской системы, как и было задумано на старте. */
  let bankCapital = Math.max(1, s.bankCapital + bankProfit + (d.bankCapital || 0)
    + (decisions.emergency ? 0.12 * s.bankCapital + 0.024 * rwa : 0));
  // докапитализация с рынка: в спокойные времена банки привлекают капитал, в кризис — почти нет
  const capitalTarget = (decisions.capitalRequirement + 3.5) / 100 * rwa;
  if (bankCapital < capitalTarget) {
    const appetite = clamp((s.businessConfidence - 35) / 30, 0.05, 1) * clamp((s.financialStability - 30) / 40, 0.05, 1);
    bankCapital += 0.16 * (capitalTarget - bankCapital) * appetite;
  }
  let bankCapitalAdequacy = bankCapital / rwa * 100;
  if (bankCapitalAdequacy > decisions.capitalRequirement + 4.5) {
    const excess = (bankCapitalAdequacy - decisions.capitalRequirement - 4.5) / 100 * rwa;
    bankCapital -= excess * 0.3; bankCapitalAdequacy = bankCapital / rwa * 100;
  }
  // decisions.liquidity — рычаг в «млрд» с диапазоном, растущим вместе с ВВП (см.
  // scaleLever в UI), поэтому в индексный (0-100) эффект он идёт как доля ВВП, а не
  // сырым числом — иначе на разросшейся экономике один и тот же шаг ползунка давал
  // бы всё больший и больший скачок ликвидности, как для fxIntervention/курса выше.
  const liquidityInjectionPctGdp = (decisions.liquidity || 0) / Math.max(1, s.nominalGdp) * 100;
  const bankLiquidity = clamp(s.bankLiquidity + 0.09 * (75 - s.bankLiquidity) - Math.max(0, bankNPL - 6) * 1.1
    - Math.max(0, -creditGrowth) * 0.25 + liquidityInjectionPctGdp * 18 + (d.bankLiquidity || 0)
    - (decisions.reserveReq - s.reserveReq) * 1.2 + (decisions.emergency ? 22 : 0) + gauss(0.9 * nMult), 0, 100);
  const bankingRisk = clamp(ema(s.bankingRisk, clamp(0.5 * clamp(bankNPL * 4.5, 0, 100)
    + 0.28 * clamp(100 - bankLiquidity, 0, 100)
    + 0.22 * clamp((decisions.capitalRequirement + 3 - bankCapitalAdequacy) * 9, 0, 100), 0, 100), 0.4), 0, 100);
  if (bankProfit < 0) add('banking', `Убытки банков ${fmtMoney(-bankProfit)} за квартал съедают капитал: достаточность ${fmt1(bankCapitalAdequacy)}% при требовании ${fmt1(decisions.capitalRequirement)}%`, bankProfit);
  if (nplTarget > s.bankNPL + 0.5) add('banking', `Дорогой кредит и слабый выпуск повышают неплатежи: просрочка идёт к ${fmt1(nplTarget)}%`, nplTarget - s.bankNPL);

  const financialStability = clamp(s.financialStability + 0.10 * (T.neutralStability - s.financialStability)
    - Math.max(0, bankingRisk - 50) * 0.10 - Math.max(0, s.debtToGdp - 90) * 0.04 - Math.max(0, creditGap - 8) * 0.25
    + (decisions.emergency ? 14 : 0) + liquidityInjectionPctGdp * 5 + (d.financialStability || 0) + gauss(NB.financialStability * nMult), 0, 100);

  /* --- 13. НАЛОГИ, РАСХОДЫ, ДОЛГ --- */
  const fundIncome = (s.sovereignFund || 0) * (worldRate + 1) / 100 / QUARTERS_PER_YEAR;
  const stateForTax = { nominalGdp, consumption, priceLevel, outputGap, unemployment, shadowShare: s.shadowShare };
  const wedgeNow = taxWedge(decisions);
  const shadowTarget = clamp(9 + 0.55 * (wedgeNow - 32) + 0.10 * Math.max(0, 55 - s.govTrust) + 0.06 * Math.max(0, unemployment - 6) * 5, 4, 45);
  const shadowShare = clamp(s.shadowShare + 0.07 * (shadowTarget - s.shadowShare), 3, 50);
  const revenueParts = computeRevenue({ ...stateForTax, shadowShare }, decisions);
  const govRevenue = Math.max(1, revenueParts.total + fundIncome * QUARTERS_PER_YEAR + (d.revenue || 0));
  const revenuePctGdp = govRevenue / nominalGdp * 100;
  add('budget', `Налоговая база: теневая экономика ${fmt1(shadowShare)}%, собираемость подстраивается под нагрузку (налоговый клин ${fmt1(wedgeNow)})`, govRevenue - s.govRevenue);

  const govPurchasesNominal = (govPurchasesReal + eventReal) * priceLevel / 100;
  const transfersNominal = transfersReal * priceLevel / 100;
  const govInvestmentNominal = (govInvestmentReal + projectReal) * priceLevel / 100;
  const newDebtRate = 0.35 * decisions.keyRate + 0.65 * (rStar + inflationExpectations + 1.0) + riskPremium
    + C.debtLevelPremium * Math.max(0, s.debtToGdp - 60);
  const effectiveDebtRate = clamp(s.effectiveDebtRate + C.debtRollover * (newDebtRate - s.effectiveDebtRate), 0, 45);
  const interestPayment = s.govDebt * effectiveDebtRate / 100;
  const govSpendingTotal = govPurchasesNominal + transfersNominal + govInvestmentNominal + interestPayment;
  const budgetBalance = govRevenue - govSpendingTotal;
  const primaryBalance = budgetBalance + interestPayment;
  // профицит сначала гасит долг, остальное уходит в суверенный фонд; дефицит сначала
  // финансируется из фонда и только потом новым долгом
  let govDebt = sovereignDefault ? s.govDebt * 0.55 : s.govDebt; // реструктуризация списывает часть долга разом
  let sovereignFund = s.sovereignFund || 0;
  const flow = budgetBalance / QUARTERS_PER_YEAR;
  if (flow >= 0) {
    const repay = Math.min(govDebt, flow);
    govDebt -= repay;
    sovereignFund += flow - repay;
  } else {
    const draw = Math.min(sovereignFund, -flow * 0.65);
    sovereignFund -= draw;
    govDebt += (-flow - draw);
  }
  // добровольное размещение облигаций сверх того, что требуется для покрытия
  // дефицита: сознательное решение Минфина, а не автоматическое финансирование
  // дыры в бюджете выше — долг растёт сразу, а вырученные деньги идут в резерв
  const bondIssuance = Math.max(0, decisions.bondIssuance || 0);
  govDebt += bondIssuance;
  sovereignFund += bondIssuance;
  govDebt = Math.max(0, govDebt);
  const debtToGdp = govDebt / nominalGdp * 100;
  const fundPctGdp = sovereignFund / nominalGdp * 100;
  const netDebtToGdp = (govDebt - sovereignFund) / nominalGdp * 100;
  const budgetBalancePctGdp = budgetBalance / nominalGdp * 100;
  const structuralBalancePctGdp = budgetBalancePctGdp + 0.45 * outputGap;
  // (7) откуда взялось изменение баланса — по слагаемым
  const dRev = govRevenue - s.govRevenue;
  const dSpend = govSpendingTotal - s.govSpendingTotal;
  const dInt = interestPayment - s.interestPayment;
  add('budget', `Доходы ${fmtMoneySigned(dRev)} (номинальный ВВП ${fmtSigned1(annualizedGrowth(s.nominalGdp, nominalGdp))}%, теневая экономика ${fmt1(shadowShare)}%${Math.abs(fundIncome) > 0.5 ? `, доход фонда ${fmtMoney(fundIncome * 4)}` : ''}), расходы ${fmtMoneySigned(dSpend)} (из них проценты ${fmtMoneySigned(dInt)}) — итог ${fmtSigned1(budgetBalancePctGdp - s.budgetBalancePctGdp)} п.п. ВВП`, budgetBalancePctGdp - s.budgetBalancePctGdp);
  if (sovereignFund > 1) add('budget', `Суверенный фонд ${fmtMoney(sovereignFund)} (${fmt1(fundPctGdp)}% ВВП) приносит ${fmtMoney(fundIncome * 4)} в год и гасит будущие дефициты до обращения к рынку`, fundPctGdp);
  if (interestPayment - s.interestPayment > 1) add('budget', `Стоимость обслуживания долга выросла до ${fmtMoney(interestPayment)} в год (ставка ${fmt1(effectiveDebtRate)}%)`, -(interestPayment - s.interestPayment));

  /* --- 14. ВНЕШНИЙ СЧЁТ И НАСТРОЕНИЯ --- */
  const currentAccount = exports - imports - 0.012 * govDebt;
  const capitalAccount = netCapitalFlow;
  const fdi = clamp(s.fdi + (d.fdi || 0) + 0.35 * (s.businessConfidence - 55) + 0.2 * (financialStability - 70)
    - 0.8 * (decisions.capitalTaxRate - s.capitalTaxRate) + gauss(NB.fdi * nMult), -120, 500);

  const consumerConfidence = clamp(s.consumerConfidence + 0.11 * (T.neutralConfidence - s.consumerConfidence)
    + 0.30 * (wageGrowth - inflation) - 0.35 * Math.max(0, unemployment - nairu) - 0.25 * Math.max(0, inflation - 6)
    // деньги снова что-то значат: люди перестают избавляться от них в тот же день
    + 3.5 * stabilizationCred
    + (d.consumerConfidence || 0) + gauss(NB.consumerConfidence * nMult), 0, 100);
  const businessConfidence = clamp(s.businessConfidence + 0.11 * (T.neutralConfidence - s.businessConfidence)
    + 0.32 * (gdpGrowth - potentialGrowth) - 0.06 * Math.max(0, bankingRisk - 50)
    // жёсткая ставка поверенной программы читается как сигнал, а не как угроза:
    // бизнес снова может считать на год вперёд
    - 0.25 * Math.max(0, rateGap) * (1 - 0.7 * stabilizationCred) + 3.5 * stabilizationCred
    + (d.businessConfidence || 0) + gauss(NB.businessConfidence * nMult), 0, 100);
  const ignoredDemands = (s.demands || []).filter((x) => x.quartersActive >= 4).length;
  const govTrust = clamp(s.govTrust + 0.30 * ((budgetBalancePctGdp > -4 ? 0.4 : -0.5) + (gdpGrowth > 1 ? 0.3 : -0.3)
    - 0.25 * Math.max(0, inflation - 6) - 0.3 * Math.max(0, unemployment - 7) - ignoredDemands * 0.5)
    + (d.govTrust || 0) + gauss(0.5 * nMult), 0, 100);
  const moneySupply = clamp(applyAnnualGrowth(s.moneySupply, potentialGrowth + inflation) * (1 + (decisions.moneySupplyOp || 0) / 100)
    + liquidityInjectionPctGdp * 0.4 + (decisions.emergency ? 3 : 0), 20, 4000);

  /* --- 14а. ФИНАНСОВЫЙ РЫНОК: кривая доходности, облигации, акции, риск-премии --- */
  const neutralNominal = rStar + inflationExpectations;
  const sovereignExtra = C.debtLevelPremium * Math.max(0, debtToGdp - 60);
  // ожидания по ставке: чем длиннее горизонт, тем ближе к нейтральной
  const yieldAt = (h) => {
    const w = clamp(h / 5, 0, 1);
    return clamp(decisions.keyRate * (1 - w) + neutralNominal * w
      + 0.25 * Math.sqrt(h) + riskPremium * (0.10 + 0.07 * h) + sovereignExtra * (0.2 + 0.08 * h), -2, 60);
  };
  const yield3m = yieldAt(0.25); const yield1y = yieldAt(1); const yield2y = yieldAt(2);
  const yield5y = yieldAt(5); const yield10y = yieldAt(10);
  const curveSlope = yield10y - yield3m;
  const curveInverted = curveSlope < -0.15;
  const prevY10 = Number.isFinite(s.yield10y) ? s.yield10y : yield10y;
  const duration10y = 7.4;
  const bondReturn = (prevY10 / QUARTERS_PER_YEAR) - duration10y * (yield10y - prevY10);   // % за квартал
  const bondIndex = Math.max(5, (Number.isFinite(s.bondIndex) ? s.bondIndex : 1000) * (1 + bondReturn / 100));
  const sovereignSpread = Math.max(0, (riskPremium + sovereignExtra) * 100);
  const corporateSpread = Math.max(20, (riskPremium * 0.8 + 0.32 * Math.max(0, bankNPL - 3)
    + 0.35 * Math.max(0, -outputGap) + 0.02 * Math.max(0, bankingRisk - 40)) * 100);

  // акции: прибыль / ставка дисконтирования, где премия за риск растёт в кризис
  const earnings = Math.max(1, CONFIG.shares.profits * nominalGdp * (1 - decisions.profitTaxRate / 100)
    * clamp(1 + 1.7 * outputGap / 100, 0.25, 2.2));
  const equityRiskPremium = clamp(3.2 + 0.055 * Math.max(0, bankingRisk - 40) + 0.04 * Math.max(0, (s.currencyRisk || 20) - 30)
    + 0.55 * Math.max(0, -outputGap) - 0.28 * (businessConfidence - 55) / 5
    + (activeCrisesPre.length ? 1.6 : 0), 1.2, 16);
  const growthTerm = clamp((potentialGrowth + inflationExpectations) * 0.62, 0, 9);
  const discountRate = clamp(yield10y + equityRiskPremium - growthTerm, 1.1, 32);
  const fairPE = clamp(100 / discountRate, 3, 38);
  const fairIndex = earnings * fairPE / STOCK_NORM;
  const prevStock = Number.isFinite(s.stockIndex) ? s.stockIndex : 1000;
  const stockIndex = Math.max(30, ema(prevStock, fairIndex, 0.42) * (1 + ((d.stockShock || 0) + gauss(1.6 * nMult)) / 100));
  const stockReturn = (stockIndex / prevStock - 1) * 100;
  const stockPE = stockIndex * STOCK_NORM / earnings;
  /* Капитализация считается от индекса и только от него. Раньше здесь был ещё
     множитель priceLevel/100 — но индекс и сам уже номинальный: он растёт из
     earnings, а те пропорциональны номинальному ВВП. Инфляция входила в
     капитализацию дважды, и «% ВВП» рос вместе с уровнем цен без всякого
     предела: на длинной партии с высокой инфляцией выходило 31 000% ВВП
     вместо правдоподобных 50–200%. */
  const marketCap = stockIndex / 1000 * 1100;
  const marketCapPctGdp = marketCap / nominalGdp * 100;

  const netInterestMarginPre = lendingRate - depositRate;
  const prevLending = Number.isFinite(s.lendingRate) ? s.lendingRate : lendingRate;
  // отраслевые индексы со своей чувствительностью
  const sect = (prev, drift) => Math.max(45, (Number.isFinite(prev) ? prev : 1000) * (1 + clamp(drift, -16, 16) / 100));
  const sectorBanks = sect(s.sectorBanks, stockReturn * 1.3 - 0.45 * Math.max(0, bankNPL - 3)
    - 0.12 * Math.max(0, bankingRisk - 45) + 0.25 * (netInterestMarginPre - 3.4) + (d.secBanks || 0));
  const sectorIndustry = sect(s.sectorIndustry, stockReturn * 1.05 + 0.35 * (investmentGrowth - potentialGrowth) - 0.22 * rateGap + (d.secIndustry || 0));
  const sectorConsumer = sect(s.sectorConsumer, stockReturn * 0.85 + 0.45 * (wageGrowth - inflation) + 0.06 * (consumerConfidence - 55) + (d.secConsumer || 0));
  const sectorResources = sect(s.sectorResources, stockReturn * 0.7 + 0.14 * (commodityIndex - s.commodityIndex) + 0.18 * fxDeprAnnual + (d.secResources || 0));
  // недвижимость: живёт ставкой по кредитам, кредитным циклом и реальными доходами
  const reitIndex = sect(s.reitIndex, stockReturn * 0.55 - 1.35 * (lendingRate - prevLending) - 0.45 * rateGap
    + 0.5 * (wageGrowth - inflation) + 0.12 * creditGrowth + (d.secReit || 0));

  // банковский сектор глазами рынка
  const netInterestMargin = netInterestMarginPre;
  const bankROE = bankProfit * QUARTERS_PER_YEAR / Math.max(1, bankCapital) * 100;
  const bankPB = clamp(0.35 + bankROE / 22 - Math.max(0, bankNPL - 4) * 0.07 - Math.max(0, bankingRisk - 50) * 0.012, 0.08, 2.6);

  // индексы полной доходности: то, по чему реально торгует частный инвестор
  const depositIndex = Math.max(1, (Number.isFinite(s.depositIndex) ? s.depositIndex : 100) * (1 + depositRate / 400));
  const fxIndex = Math.max(1, exchangeRate * (1 + worldRate / 400) * (Number.isFinite(s.fxCarry) ? s.fxCarry : 1));
  const fxCarry = (Number.isFinite(s.fxCarry) ? s.fxCarry : 1) * (1 + worldRate / 400);
  const corpYield = yield5y + corporateSpread / 100;
  const prevCorpYield = Number.isFinite(s.corpYield) ? s.corpYield : corpYield;
  const corpReturn = prevCorpYield / QUARTERS_PER_YEAR - 4.1 * (corpYield - prevCorpYield) - Math.max(0, bankNPL - 3) * 0.12;
  const corpBondIndex = Math.max(5, (Number.isFinite(s.corpBondIndex) ? s.corpBondIndex : 1000) * (1 + corpReturn / 100));
  const goldIndex = Math.max(5, commodityIndex * exchangeRate / 100);
  // Короткие облигации: та же кривая, но дюрация 1.9 вместо 7.4 — от разворота
  // ставки они почти не страдают, зато и не выстреливают на снижении.
  const prevY2 = Number.isFinite(s.yield2y) ? s.yield2y : yield2y;
  const shortBondReturn = (prevY2 / QUARTERS_PER_YEAR) - 1.9 * (yield2y - prevY2);
  const bondShortIndex = Math.max(5, (Number.isFinite(s.bondShortIndex) ? s.bondShortIndex : 1000) * (1 + shortBondReturn / 100));
  // Инфляционные линкеры: номинал индексируется на фактическую инфляцию, сверху —
  // реальная доходность. Единственная бумага, которой всплеск цен не вредит.
  const linkerReal = clamp(yield5y - inflationExpectations, -3, 12);
  const linkerIndex = Math.max(5, (Number.isFinite(s.linkerIndex) ? s.linkerIndex : 1000)
    * (1 + (inflation + linkerReal) / QUARTERS_PER_YEAR / 100));
  // Денежный рынок: овернайт по ключевой ставке — номинально безрисковый и ровно
  // настолько же беззащитный перед инфляцией.
  const moneyMarketIndex = Math.max(1, (Number.isFinite(s.moneyMarketIndex) ? s.moneyMarketIndex : 1000) * (1 + decisions.keyRate / 400));
  // Мировые акции в местной валюте: чужой цикл плюс курс — единственная
  // диверсификация от собственной экономики, доступная инвестору.
  const worldEquityReturn = clamp((worldGdpGrowth - 1.2) * 1.6 + (worldDemandIndex - s.worldDemandIndex) * 0.35
    + fxDeprAnnual / QUARTERS_PER_YEAR + gauss(2.2 * nMult), -18, 18);
  const worldEquityIndex = Math.max(20, (Number.isFinite(s.worldEquityIndex) ? s.worldEquityIndex : 1000) * (1 + worldEquityReturn / 100));
  const fxVolatility = clamp(ema(Number.isFinite(s.fxVolatility) ? s.fxVolatility : 6, Math.abs(fxDeprAnnual) * 1.6 + 3, 0.3), 1, 60);
  const volatilityIndex = clamp(ema(Number.isFinite(s.volatilityIndex) ? s.volatilityIndex : 16,
    11 + 2.6 * Math.abs(stockReturn) + 0.5 * fxVolatility + 0.16 * bankingRisk + (activeCrisesPre.length ? 16 : 0), 0.38), 5, 100);

  /* --- 14б. ПОЛИТИЧЕСКИЙ ЦИКЛ: рейтинг власти и выборы как жёсткий таймер --- */
  /* Штраф за инфляцию выше цели насыщается, а не растёт линейно без предела.
     Около цели наклон прежний (2,2 за пункт) — в спокойной партии рейтинг от
     этого не меняется. Но линейный штраф при инфляции 28% в одиночку давал
     −52 и опускал рейтинг в ноль при любой политике: отчёт о балансе показал,
     что в сценариях «Гиперинфляция» и «Валютный кризис» демократия гибла и
     при лучшей стратегии, и при полном бездействии — примерно в те же
     кварталы. Решения игрока политически ничего не значили. Недовольство
     ценами растёт быстро, но не бесконечно: выше ~20 пунктов его уже
     перекрывают безработица и падение выпуска, которые считаются отдельно. */
  const inflationPain = saturating(Math.max(0, inflation - infTarget), 2.2, 10);
  /* Люди голосуют не только по уровню, но и по направлению: когда после
     месяцев бегущих цен программа действует и инфляция заметно падает, это
     чувствуют сразу — ценники перестают меняться каждую неделю. Облегчение
     растёт с доверием к программе и со скоростью падения цен. */
  const stabilizationRelief = stabilizationCred > 0.3
    ? 12 * stabilizationCred * clamp((s.inflation - inflation) / 3, 0, 1) : 0;
  const approvalTarget = clamp(50 + 2.4 * (wageGrowth - inflation) - 3.6 * (unemployment - nairu)
    - inflationPain + stabilizationRelief + 25 * mandateEffect + 0.22 * (govTrust - 55) + 0.18 * (consumerConfidence - 55)
    + 1.6 * (gdpGrowth - potentialGrowth), 0, 100);
  /* Публичные шаги власти двигают сам рейтинг, а не его «равновесие»: пенсионная
     реформа сбивает поддержку сразу и целиком, а не на 28% от заявленного, и дальше
     рейтинг возвращается к тому, что говорят цены, зарплаты и безработица. */
  /* Рейтинг — взвешенная сумма поддержки групп (см. groupStep): тот же общий фон
     для всех плюс то, что каждая группа выиграла или проиграла от политики, и то,
     что она помнит. */
  const prevRegimeForGroups = s.politicalRegime || 'democracy';
  const groupMemoryNew = [];
  pres.applied.forEach((id) => {
    const a = PRES_BY_ID[id];
    const label = typeof a.label === 'function' ? a.label(s) : a.label;
    groupMemoryNew.push(...groupMemoryOf(ACTION_GROUP_EFFECTS[id], label, a.group === 'reform' ? 16 : 10));
  });
  const res = RS.lastRegionResolution;
  if (res && res.q === quarterIndex) {
    const tone = ((REGION_EVENT_BY_ID[res.id] || { options: [] }).options.find((o) => o.id === res.option) || {}).tone;
    if (res.byDefault || tone === 'wait') groupMemoryNew.push(...groupMemoryOf({ regions: -3 }, `${res.title}: ответа не было`, 8));
    else if (tone === 'generous') groupMemoryNew.push(...groupMemoryOf({ regions: 3 }, res.title, 8));
    else if (tone === 'hard') groupMemoryNew.push(...groupMemoryOf({ youth: -3, siloviki: 2 }, res.title, 8));
  }
  if (sovereignDefault) groupMemoryNew.push(...groupMemoryOf({ business: -15, pensioners: -8, public: -8 }, 'Дефолт', 12));
  groupMemoryNew.push(...GD.memory);
  if (RV.lost.length) groupMemoryNew.push(...groupMemoryOf({ siloviki: -8, pensioners: -3 }, 'Потеря новых земель', 10));
  if (PC.returned.length) groupMemoryNew.push(...groupMemoryOf({ siloviki: -10 }, 'Земли возвращены Норланду', 12));
  if (PC.treaty && PC.treaty !== s.treaty && PC.treaty.recognized) groupMemoryNew.push(...groupMemoryOf({ business: 6 }, 'Граница признана', 10));
  const groupStress = activeRegions(s).map((r) => regionStress(r, s));
  const GS = groupStep(s, {
    approvalTarget, push: (d.approvalPush || 0) + stabilizationBonus, newMemory: groupMemoryNew,
    inflation, infTarget, unemployment, nairu, wageGrowth, decisions, budgetShares: s.budgetShares,
    businessConfidence, offensiveWar: (s.warQuartersLeft || 0) > 0 && s.warType === 'offensive', atWar: (s.warQuartersLeft || 0) > 0,
    repression: prevRegimeForGroups === 'totalitarian' ? 1 : prevRegimeForGroups === 'authoritarian' ? 0.55 : 0,
    avgStress: groupStress.reduce((a, b) => a + b, 0) / (groupStress.length || 1), projects: (s.projects || []).length,
  });
  const approval = GS.approval;
  const GE = groupEpisodes(s, GS.support, difficulty);
  GE.news.forEach(([cat, h, t, pr]) => news.push(mkNews(cat, h, t, { priority: pr })));
  nextQueue.push(...GE.impulses);
  const prevToElection = Number.isFinite(s.quartersToElection) ? s.quartersToElection : CONFIG.election.cycle;
  /* При тоталитарном режиме выборов нет вообще. В авторитарном они ещё проводятся —
     формально, с заранее известным результатом; это часть его фасада. А там, где
     независимых институтов не осталось, голосование отменяют, а не рисуют: счётчик
     до выборов замирает, кампании не начинается, власть не меняется у урны.
     Единственный способ её потерять — переворот (см. ниже). */
  const noElections = (s.politicalRegime || 'democracy') === 'totalitarian';
  let quartersToElection = noElections ? prevToElection : prevToElection - 1;
  // досрочные выборы президента: срок обрезается, кампания начинается тем же кварталом
  if (pres.patch.snapElection) quartersToElection = Math.min(quartersToElection, pres.patch.snapElection);
  let term = s.term || 1;
  let electionResult = null;
  // последние состоявшиеся выборы живут в экономике между голосованиями: карта
  // округов показывает именно их, а electionResult обнуляется каждый квартал
  let lastElection = s.lastElection || null;
  let mandate = s.mandate || null;
  let governmentLine = s.governmentLine || 'centrist';
  // авторитарный/тоталитарный режим не проигрывает выборы — только считает голоса,
  // а значит там нет и настоящей предвыборной гонки с её неопределённостью для рынков
  const riggedElection = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
  const campaign = !noElections && quartersToElection <= CONFIG.election.campaign && quartersToElection > 0;
  if (campaign && !s.campaignActive) {
    if (riggedElection) {
      news.push(mkNews('gov', 'НАЗНАЧЕНА ДАТА ГОЛОСОВАНИЯ',
        `До официальной даты ${quartersToElection} кв. Исход не обсуждается — обсуждается только явка.`, { priority: 5 }));
    } else {
      nextQueue.push(makeImpulse('businessConfidence', -6, 'Предвыборная неопределённость: бизнес откладывает решения', 'default', difficulty, 'other'));
      nextQueue.push(makeImpulse('investment', -1.6, 'Предвыборная неопределённость', 'default', difficulty));
      nextQueue.push(makeImpulse('riskPremium', 0.25, 'Политическая неопределённость перед выборами', 'default', difficulty));
      news.push(mkNews('gov', `НАЧАЛАСЬ ПРЕДВЫБОРНАЯ КАМПАНИЯ: ДО ГОЛОСОВАНИЯ ${quartersToElection} КВ.`,
        `Рейтинг власти ${Math.round(approval)} из 100 при безработице ${fmt1(unemployment)}% и инфляции ${fmt1(inflation)}%. Инвесторы берут паузу до результата, а правительство — наоборот, тратит: политический цикл всегда заканчивается счётом, который оплачивают уже после выборов.`,
        { priority: 8, chain: ['Кампания', 'Неопределённость ↑', 'Инвестиции ↓', 'Расходы бюджета ↑', 'Счёт после выборов'] }));
    }
  }
  // Отчаянный шаг: при разгромном поражении и уже накопленном напряжении власть
  // может не признать результат и захватить контроль вместо того, чтобы уйти —
  // иначе рейтинг, рухнувший в ноль, всегда тихо заканчивал партию поражением на
  // выборах, а до авторитаризма/тоталитаризма дело попросту не успевало дойти.
  /* Итог выборов считается не по рейтингу напрямую. Рейтинг 50 — это половина
     страны за вас, а не поражение: раньше при 49.6 партия заканчивалась с текстом
     «рейтинг упал до 50», что читалось как издевательство. Теперь из рейтинга
     считается доля голосов — с преимуществом действующей власти, со сдержанностью
     (край рейтинга не переносится в край результата) и с неопределённостью дня
     голосования. Сюда же попадают сдержанные и проваленные обещания: раньше они
     были чистой декорацией. */
  let promiseScore = 0; let promisesKept = 0; let promisesTotal = 0;
  if (quartersToElection <= 0 && !noElections && Array.isArray(decisions.promises) && decisions.promises.length) {
    promisesTotal = decisions.promises.length;
    /* Обещания сверяются со свежими величинами этого квартала. Единственное
       исключение — благополучие: сводные оценки считаются ниже по файлу, поэтому
       для него берётся значение на конец прошлого квартала. */
    const atVote = { ...s, inflation, unemployment, debtToGdp, gdp, exchangeRate, reserves, budgetBalancePctGdp };
    decisions.promises.forEach((pr) => { if (evaluatePromise(pr, atVote).met) promisesKept += 1; });
    promiseScore = (promisesKept - (promisesTotal - promisesKept)) * 2.2;
  }
  const incumbencyBonus = 2.5;
  let voteShare = quartersToElection <= 0 && !noElections
    ? clamp(50 + (approval - 50 + groupTurnoutShift(s)) * 0.85 + incumbencyBonus + promiseScore + gauss(2.2 * nMult), 0, 100)
    : null;
  // штабы кампании: прибавка по областям, сложенная в общенациональный итог
  let campaignRegions = null;
  if (voteShare != null && !riggedElection && Object.keys(CP.spend).length) {
    campaignRegions = regionVoteShares(s, voteShare, false)
      .map((r) => ({ id: r.id, share: clamp(r.share + campaignBonus(CP.spend[r.id], r.share), 0, 100) }));
    voteShare = campaignRegions.reduce((a, b) => a + b.share, 0) / campaignRegions.length;
  }
  let coup = false;
  if (quartersToElection <= 0 && !noElections) {
    const margin = voteShare - 50;
    if (!riggedElection && margin < 0) {
      const severity = clamp(-margin, 0, 50) / 50; // 0 при ничьей, 1 при рейтинге ~0
      const priorTension = clamp(Number.isFinite(s.politicalTension) ? s.politicalTension : 8, 0, 100);
      const coupChance = clamp(Math.pow(severity, 1.6) * 0.6 + (priorTension / 100) * 0.25, 0, 0.75);
      coup = rng() < coupChance;
    }
    electionResult = (riggedElection || coup) ? 'incumbent' : (margin >= 0 ? 'incumbent' : (voteShare < 42 ? 'landslide' : 'opposition'));
    /* Результат по округам считаем по состоянию НА ДЕНЬ ГОЛОСОВАНИЯ, то есть по
       рискам и напряжённости, с которыми страна подошла к выборам (s), а не по
       тем, что сложились уже после подсчёта. Карта хранит последние выборы
       целиком: между голосованиями показывать нечего, кроме них. */
    const byRegion = campaignRegions || regionVoteShares(s, voteShare, riggedElection);
    lastElection = {
      q: quarterIndex, qLabel: quarterLabel(quarterIndex),
      result: electionResult, rigged: !!riggedElection, coup,
      // при честном подсчёте среднее по округам и есть национальный результат
      // (см. поправку на среднее в regionVoteShares); при нарисованном —
      // «официальная» цифра тоже выводится из того, что напечатали по округам
      nationalShare: byRegion.reduce((a, b) => a + b.share, 0) / (byRegion.length || 1),
      byRegion,
    };
    /* Карта и газета должны рассказывать об одном и том же голосовании одно и
       то же: в новость добавляется самый верный и самый оппозиционный округ. */
    const sortedRegions = [...byRegion].sort((a, b) => b.share - a.share);
    const nameOf = (id) => (regionById(id) || {}).name || id;
    const geoLine = riggedElection
      ? ` По областям результат тоже ровный: от ${fmt1(sortedRegions[sortedRegions.length - 1].share)}% до ${fmt1(sortedRegions[0].share)}%.`
      : ` Лучший результат — ${nameOf(sortedRegions[0].id)} (${fmt1(sortedRegions[0].share)}%), худший — ${nameOf(sortedRegions[sortedRegions.length - 1].id)} (${fmt1(sortedRegions[sortedRegions.length - 1].share)}%).`;
    quartersToElection = CONFIG.election.cycle; term += 1;
    if (electionResult === 'incumbent') {
      nextQueue.push(makeImpulse('businessConfidence', 4, 'Преемственность политики после выборов', 'default', difficulty, 'other'));
      news.push(riggedElection
        ? mkNews('gov', 'ВЫБОРЫ БЕЗ НЕОЖИДАННОСТЕЙ: РЕЗУЛЬТАТ БЛИЗОК К ЕДИНОГЛАСНОМУ',
          `Официально — явка рекордная, поддержка почти абсолютная. Независимые наблюдатели на участки не допущены, альтернативных кандидатов не зарегистрировано.${geoLine}`, { priority: 9 })
        : coup
          ? mkNews('gov', 'ПЕРЕВОРОТ: ВЛАСТЬ НЕ ПРИЗНАЛА ПОРАЖЕНИЕ НА ВЫБОРАХ',
            `Рейтинг ${Math.round(approval)} из 100 не оставлял шансов на честную победу. Вместо передачи власти объявлено чрезвычайное положение: результаты аннулированы, парламент распущен, оппозиция объявлена вне закона.`,
            { priority: 10, chain: ['Разгромное поражение', 'Отказ признать результат', 'Чрезвычайное положение', 'Авторитарный поворот'] })
          : mkNews('gov', `ВЛАСТЬ СОХРАНЯЕТ МАНДАТ: ${fmt1(voteShare)}% ГОЛОСОВ`,
            `Избиратель одобрил курс при росте ${fmt1(gdpGrowth)}%, инфляции ${fmt1(inflation)}% и безработице ${fmt1(unemployment)}%.${promisesTotal ? ` Сдержано обещаний: ${promisesKept} из ${promisesTotal}.` : ''}${geoLine} Преемственность экономической политики — это не только про идеи, это про то, что ожидания не приходится заново заякоривать.`, { priority: 9 }));
    } else {
      mandate = (unemployment - nairu > 1.2) ? 'jobs' : (inflation > infTarget + 2) ? 'prices' : (debtToGdp > 85) ? 'budget' : 'growth';
      governmentLine = mandate === 'jobs' ? 'populist' : mandate === 'budget' ? 'austerity' : 'technocrat';
      const shock = electionResult === 'landslide' ? 1.7 : 1;
      nextQueue.push(makeImpulse('businessConfidence', -8 * shock, 'Смена власти: бизнес ждёт новых правил', 'default', difficulty, 'other'));
      nextQueue.push(makeImpulse('investment', -2.2 * shock, 'Смена власти и неопределённость политики', 'default', difficulty));
      nextQueue.push(makeImpulse('riskPremium', 0.45 * shock, 'Смена власти: инвесторы пересматривают риск', 'default', difficulty));
      nextQueue.push(makeImpulse('capitalFlow', -14 * shock, 'Отток капитала после смены власти', 'default', difficulty));
      const MAND = { jobs: 'занятость любой ценой', prices: 'обуздать цены', budget: 'привести бюджет в порядок', growth: 'вернуть рост' };
      news.push(mkNews('gov', electionResult === 'landslide' ? 'СОКРУШИТЕЛЬНОЕ ПОРАЖЕНИЕ ВЛАСТИ НА ВЫБОРАХ' : 'ОППОЗИЦИЯ ПОБЕЖДАЕТ НА ВЫБОРАХ',
        `За власть ${fmt1(voteShare)}% голосов при рейтинге ${Math.round(approval)} из 100.${promisesTotal ? ` Сдержано обещаний: ${promisesKept} из ${promisesTotal} — избиратель это посчитал.` : ''}${geoLine} Новое правительство приходит с мандатом: ${MAND[mandate]}. Экономический курс будет переписан, а пока он переписывается, инвестиции и капитал ждут в стороне.`,
        { priority: 10, chain: ['Низкий рейтинг', 'Смена власти', 'Неопределённость ↑', 'Инвестиции ↓', 'Премия за риск ↑', 'Новый курс'] }));
    }
  }

  /* --- 15. РИСКИ, РЕЖИМ ЭКОНОМИКИ, КАСКАД КРИЗИСОВ --- */
  const inflationRisk = clamp(ema(s.inflationRisk, clamp(Math.abs(inflation - infTarget) * 9 + Math.max(0, inflationExpectations - infTarget) * 6, 0, 100), 0.3), 0, 100);
  const debtRisk = clamp(ema(s.debtRisk, clamp(Math.max(0, debtToGdp - 45) * 0.8 + Math.max(0, -budgetBalancePctGdp - 2) * 5
    + Math.max(0, effectiveDebtRate - gdpGrowth - inflation) * 3, 0, 100), 0.3), 0, 100);
  const recessionRisk = clamp(ema(s.recessionRisk, clamp(Math.max(0, -outputGap) * 11 + Math.max(0, unemployment - nairu) * 6
    + Math.max(0, rateGap) * 4, 0, 100), 0.3), 0, 100);
  const currencyRisk = clamp(ema(s.currencyRisk || 20, clamp(Math.max(0, -currentAccount / Math.max(1, nominalGdp) * 100) * 9
    + Math.max(0, 200 - reserves) * 0.12 + Math.max(0, riskPremium - 2) * 8, 0, 100), 0.3), 0, 100);

  const recessionStreak = outputGap < CONFIG.thresholds.recessionGap ? (s.recessionStreak || 0) + 1 : 0;
  // без гистерезиса разрыв выпуска, колеблющийся у порога входа (-2.0%), качал
  // режим «рецессия ⇄ норма» каждый квартал: выход был мгновенным (один квартал
  // выше порога — и рецессии как не бывало), а вход требовал двух кварталов подряд.
  // Раз войдя в рецессию, выходим из неё только после закрытия разрыва выше
  // более высокого порога (-0.8%), тоже выдержанного пару кварталов, — вход и
  // выход больше не делят одну и ту же границу.
  const wasRecession = (s.activeCrises || []).includes('recession');
  const recessionRecoverStreak = outputGap >= CONFIG.thresholds.recessionGapExit ? (s.recessionRecoverStreak || 0) + 1 : 0;
  const recessionNow = wasRecession
    ? recessionRecoverStreak < CONFIG.thresholds.recessionGapQuarters
    : recessionStreak >= CONFIG.thresholds.recessionGapQuarters;
  const regimeStreakPrev = s.regimeStreak || 0;
  const fxMovePct = Math.abs(fxDeprAnnual);
  // пандемия — не пороговое состояние экономики, а отдельное событие с растянутым
  // на несколько кварталов эффектом; без счётчика она не попадала в activeCrises
  // и никак не отображалась как кризис, хотя бьёт по спросу и предложению сразу
  const pandemicQuartersLeft = pandemicTriggered ? 3 : Math.max(0, (s.pandemicQuartersLeft || 0) - 1);
  // война, как и пандемия, — не пороговое состояние, а отдельное событие с растянутым
  // эффектом; длится дольше пандемии (её экономический урон гасится 4 квартала)
  /* Война может прийти извне (событие), а может быть решением президента: указ
     ставит те же счётчики, только длиннее — свою войну не заканчивают через год
     потому, что надоело, — и всегда наступательного типа, со всеми вытекающими
     санкциями. Мобилизация продлевает, мир обрывает. */
  const warDecreed = !!pres.patch.startWar;
  // кому объявлена война: выбор президента (карта), иначе — сосед с худшими отношениями
  const warTarget = warDecreed ? sanitizeWarTarget(decisions.warTarget, s)
    : ((s.warQuartersLeft || 0) > 0 && s.warType === 'offensive' ? warTargetOf(s) : null);
  const warEnded = !!pres.patch.endWar;
  /* Своя наступательная война не кончается сама по себе, когда истёк какой-то срок:
     её заканчивают победа, перемирие или мир — решением, а не календарём. Счётчик
     у неё не убывает; у пришедшей извне войны он по-прежнему идёт вниз. */
  /* Война за новые земли (реванш Норланда) тоже бессрочная: её кончают перемирие,
     выдохшийся Норланд или потеря всех земель. */
  const revancheStart = RV.start;
  // ни одна война не идёт по календарю: её кончают победа, перемирие, мир или выдохшийся противник
  const offensiveOngoing = (s.warQuartersLeft || 0) > 0 && (s.warType === 'offensive' || s.warType === 'revanche' || s.warType === 'defensive');
  let warQuartersLeft = warDecreed ? 10 : revancheStart ? 10 : warTriggered ? 4
    : offensiveOngoing ? s.warQuartersLeft : Math.max(0, (s.warQuartersLeft || 0) - 1);
  if (pres.patch.warExtend && warQuartersLeft > 0) warQuartersLeft += pres.patch.warExtend;
  if (warEnded || WC.endWar || RV.endWar || DF.endWar) warQuartersLeft = 0;
  /* Как бы ни кончилась своя война — победой, перемирием или миром, — взятое
     остаётся за страной и становится её территорией: граница на карте сдвигается,
     в экономику приходят люди и руда, а на новых землях первое время неспокойно. */
  let annexed = [...(s.annexed || [])];
  const annexLoyaltyNext = { ...AN.loyalty };
  const groupMemoryLate = [];
  if (s.warType === 'offensive' && warTargetOf(s) === 'north' && (s.warQuartersLeft || 0) > 0 && warQuartersLeft === 0) {
    const fresh = (((WC.campaign || s.warCampaign) || {}).captured || []).filter((id) => !annexed.includes(id) && ANNEX_EFFECT[id]);
    if (fresh.length) {
      annexed = [...annexed, ...fresh];
      groupMemoryLate.push(...groupMemoryOf({ siloviki: 6, pensioners: 3, business: -3 }, 'Присоединение новых земель', 10));
      fresh.forEach((id) => {
        nextQueue.push(...ANNEX_EFFECT[id].impulses(difficulty));
        annexLoyaltyNext[ANNEX_REGION_OF[id]] = regionById(ANNEX_REGION_OF[id]).loyalty0;
      });
      nextQueue.push(sustainedImpulse('tensionPush', 0.8 * fresh.length, 4, 'Сопротивление на присоединённых землях'));
      news.push(mkNews('gov', 'ГРАНИЦА СДВИНУТА: НОВЫЕ ЗЕМЛИ В СОСТАВЕ СТРАНЫ',
        `В состав страны входят: ${fresh.map((id) => ANNEX_EFFECT[id].name).join(', ')}. Новые жители, новые рудники и дороги — и первое время неспокойные улицы.`,
        { priority: 9, chain: ['Война окончена', 'Присоединение', 'Рабочая сила ↑', 'Напряжённость ↑'] }));
    }
  }
  // срок войны истёк без победы и без перемирия — фронт замирает там, где стоял
  if (s.warCampaign && warQuartersLeft === 0 && !WC.endWar && !warEnded && !warDecreed) {
    const kept = (WC.campaign || s.warCampaign).captured || [];
    news.push(mkNews('gov', `ФРОНТ ЗАМЕР: ВОЙНА ${WAR_TARGETS[warTargetOf(s)].ins.toUpperCase()} ЗАКОНЧИЛАСЬ ПЕРЕМИРИЕМ`, kept.length
      ? `Боевые действия прекращены по линии фронта. За страной остаётся: ${kept.map((id) => WAR_OBJECTIVE_BY_ID[id].name).join(', ')}.`
      : 'Боевые действия прекращены по линии фронта, ни одна из целей операции не взята.', { priority: 9 }));
  }
  // тип войны (оборонительная/наступательная) решает исход дипломатически — помощь
  // союзников или санкции — и держится неизменным, пока идёт одна и та же война
  const warType = warDecreed ? 'offensive' : revancheStart ? 'revanche' : warTriggered ? warTypeRolled : (warQuartersLeft > 0 ? (s.warType || null) : null);
  // чья это война: случившаяся с экономикой или объявленная её же руководством —
  // от этого зависит и язык новостей, и то, как её показывает интерфейс
  const warByChoice = warDecreed ? true : (warQuartersLeft > 0 ? !!s.warByChoice : false);
  // сколько кварталов уже идёт война — для бессрочной наступательной это и есть её «срок»
  const warElapsed = (warDecreed || warTriggered || revancheStart) ? 1 : (warQuartersLeft > 0 ? (s.warElapsed || 0) + 1 : 0);
  /* Переговоры с Норландом: открываются после своей войны, если что-то взято, и
     после войны за новые земли, если что-то удержано; закрываются договором,
     отказом от переговоров или новой войной. Потерянное и возвращённое по
     договору уходит из состава страны вместе со стройками и лояльностью. */
  let peaceTalks = PC.talks;
  let treaty = PC.treaty;
  if (RV.talks) peaceTalks = RV.talks;
  if (s.warType === 'offensive' && warTargetOf(s) === 'north' && (s.warQuartersLeft || 0) > 0 && warQuartersLeft === 0 && annexed.length) {
    const held = (((WC.campaign || s.warCampaign) || {}).captured || []).concat(annexed);
    const value = [...new Set(held)].reduce((a, id) => a + (OBJECTIVE_VALUE[id] || 0), 0);
    peaceTalks = { since: quarterIndex, leverage: Math.max(0, 15 + value + (WC.victory ? 50 : 0) - (warEnded ? 10 : 0)), attempts: 0, origin: 'offensive' };
    news.push(mkNews('gov', 'ОТКРЫТЫ ПЕРЕГОВОРЫ С НОРЛАНДОМ', 'Стрельба прекращена, но чья это земля — решит договор: признание границы, санкции, репарации. Позиция страны тем сильнее, чем больше взято, и тает, пока тянут время.', { priority: 8 }));
  }
  if (warDecreed || revancheStart) { peaceTalks = null; treaty = null; }
  const dropped = [...RV.lost, ...PC.returned];
  const territory = dropAnnexed({ annexed, annexLoyalty: annexLoyaltyNext, annexIntegrated: AN.integrated, annexFunded: AN.funded,
    projects: RS.projects, projectsBuilt: RS.projectsBuilt, regionEvent: RS.regionEvent }, dropped);
  if (dropped.length) {
    dropped.forEach((id) => {
      const obj = regionById(id).objective;
      nextQueue.push(makeImpulse('laborForce', obj === 'city' ? -0.8 : obj === 'mines' ? -0.3 : -0.2, `Утрачен ${regionById(id).name}`, 'slow', difficulty, 'other'));
      if (obj === 'mines') nextQueue.push(sustainedImpulse('exportsGrowth', -0.8, 6, 'Руда Хальвика больше не наша'));
    });
  }
  if (!territory.annexed.length) peaceTalks = null;
  // окна «свежей реакции» ЦБ/Минфина на дипломатию президента — сам
  // экономический эффект уже идёт через sustainedImpulse у соответствующих
  // действий, эти счётчики нужны только чтобы бот-персона какое-то время
  // явно комментировала санкции/блок, а не молчала о решении, которое бьёт
  // прямо по её мандату
  const sanctionsQuartersLeft = pres.patch.sanctionsStart || DP.sanctionsWest ? 10 : Math.max(0, (s.sanctionsQuartersLeft || 0) - 1);
  const tradeBlocQuartersLeft = pres.patch.tradeBlocJoin ? 6 : Math.max(0, (s.tradeBlocQuartersLeft || 0) - 1);
  const tradeBlocActive = !!pres.patch.tradeBlocJoin || !!s.tradeBlocActive;
  const activeCrises = [];
  if (bankingRisk >= CONFIG.thresholds.bankingRisk || bankCapitalAdequacy < 8) activeCrises.push('banking');
  if (debtRisk >= CONFIG.thresholds.debtRisk) activeCrises.push('debt');
  if (fxMovePct >= CONFIG.thresholds.currencyMovePct || fxBreak) activeCrises.push('currency');
  if (inflation >= Math.max(CONFIG.thresholds.stagflationInflation, infTarget + 2.5) && outputGap <= CONFIG.thresholds.stagflationGap) activeCrises.push('stagflation');
  else if (recessionNow) activeCrises.push('recession');
  if (outputGap >= CONFIG.thresholds.overheatGap && inflation > infTarget + 1) activeCrises.push('overheating');
  if (inflation < CONFIG.thresholds.deflation && outputGap < -1) activeCrises.push('deflation');
  if (pandemicQuartersLeft > 0) activeCrises.push('pandemic');
  if (warQuartersLeft > 0) activeCrises.push('war');

  const regime = activeCrises.includes('currency') ? 'currency'
    : activeCrises.includes('banking') ? 'banking'
      : activeCrises.includes('debt') ? 'debt'
        : activeCrises.includes('war') ? 'war'
          : activeCrises.includes('pandemic') ? 'pandemic'
            : activeCrises.includes('stagflation') ? 'stagflation'
              : activeCrises.includes('deflation') ? 'deflation'
                : activeCrises.includes('overheating') ? 'overheating'
                  : activeCrises.includes('recession') ? 'recession' : 'normal';

  // Дефляция как самостоятельное событие: инфляция может уйти в минус и без
  // полноценного спада (outputGap < -1), которого требует режим 'deflation'
  // выше, — а падение цен само по себе достаточно необычно, чтобы про него
  // сообщить отдельно, не дожидаясь, пока разрыв выпуска дорастёт до кризиса.
  if (inflation < 0 && s.inflation >= 0) {
    news.push(mkNews('crisis', `ИНФЛЯЦИЯ УШЛА В МИНУС: ${rfs(inflation)}%`,
      'Цены в среднем снижаются — это уже дефляция, а не просто медленный рост. Отложенный спрос («подождём — подешевеет») бьёт по продажам сильнее, чем кажется, а реальная тяжесть долгов растёт даже без роста номинального долга.', { priority: 8 }));
  }

  const prevCrises = s.activeCrises || [];
  activeCrises.filter((c) => !prevCrises.includes(c)).forEach((c) => {
    if (c === 'banking') {
      nextQueue.push(makeImpulse('investment', -4.5, 'Банковский кризис: кредит недоступен', 'default', difficulty));
      nextQueue.push(makeImpulse('consumption', -1.8, 'Банковский кризис: сжатие потребительского кредита', 'default', difficulty));
      nextQueue.push(makeImpulse('bankLiquidity', -10, 'Банковский кризис', 'fast', difficulty));
      nextQueue.push(makeImpulse('capitalFlow', -20, 'Бегство из банковской системы', 'default', difficulty));
      news.push(mkNews('crisis', 'БАНКОВСКИЙ КРИЗИС: КРЕДИТОВАНИЕ ОСТАНОВЛЕНО', 'Капитал банков не покрывает потери. Экстренная поддержка спасёт систему, но ударит по доверию к ЦБ и разгонит денежную массу.', { priority: 10, chain: ['Потери банков', 'Капитал ↓', 'Кредит ↓', 'Инвестиции ↓', 'ВВП ↓', 'Просрочка ↑'] }));
    } else if (c === 'debt') {
      nextQueue.push(makeImpulse('riskPremium', 1.8, 'Долговой кризис: инвесторы требуют премию', 'fast', difficulty));
      nextQueue.push(makeImpulse('capitalFlow', -30, 'Долговой кризис: отток капитала', 'default', difficulty));
      nextQueue.push(makeImpulse('govTrust', -8, 'Долговой кризис', 'fast', difficulty));
      news.push(mkNews('crisis', 'ДОЛГОВОЙ КРИЗИС: ИНВЕСТОРЫ ТРЕБУЮТ ПРЕМИЮ', 'Каждый новый выпуск долга дороже предыдущего. Спираль «дефицит → ставка → процентные расходы → дефицит» запущена.', { priority: 10, chain: ['Долг ↑', 'Премия за риск ↑', 'Ставка по долгу ↑', 'Расходы на проценты ↑', 'Дефицит ↑'] }));
    } else if (c === 'currency') {
      nextQueue.push(makeImpulse('inflationSupply', 1.6, 'Валютный кризис: удорожание импорта', 'fast', difficulty));
      nextQueue.push(makeImpulse('consumerConfidence', -8, 'Валютный кризис', 'fast', difficulty));
      news.push(mkNews('crisis', 'ВАЛЮТНЫЙ КРИЗИС: РЕЗКОЕ ДВИЖЕНИЕ КУРСА', 'Курс переносится в цены. Защищать его резервами — тратить их, отпустить — принять импортную инфляцию.', { priority: 10, chain: ['Отток капитала', 'Курс ↓', 'Импортные цены ↑', 'Инфляция ↑', 'Реальные доходы ↓'] }));
    } else if (c === 'stagflation') {
      news.push(mkNews('crisis', 'СТАГФЛЯЦИЯ: СПАД И ИНФЛЯЦИЯ ОДНОВРЕМЕННО', 'Ставку вверх — углубить спад; ставку вниз — сорвать ожидания. У этой ситуации нет решения без потерь.', { priority: 10 }));
    } else if (c === 'overheating') {
      news.push(mkNews('crisis', 'ЭКОНОМИКА ПЕРЕГРЕТА', 'Выпуск устойчиво выше потенциала: дальнейший спрос уходит в цены, а не в производство.', { priority: 9 }));
    } else if (c === 'recession') {
      news.push(mkNews('crisis', 'РЕЦЕССИЯ: ВЫПУСК НИЖЕ ПОТЕНЦИАЛА', 'Второй квартал подряд. Затяжная безработица поднимает и сам естественный уровень — часть потерь станет необратимой.', { priority: 9 }));
    } else if (c === 'deflation') {
      news.push(mkNews('crisis', 'ДЕФЛЯЦИОННАЯ УГРОЗА', 'Цены почти не растут при слабом спросе: реальная ставка высока даже при нулевой ключевой. Обычных инструментов может не хватить.', { priority: 9 }));
    } else if (c === 'war' && warByChoice) {
      // указ о начале операции уже напечатан решениями президента — здесь не
      // «кризис, который случился», а описание режима, в котором теперь живут.
      // Случайно начавшаяся война и пандемия сюда не попадают: обеим уже
      // объявляет первый эпизод их сюжетной цепочки (см. STORY_TEMPLATES) —
      // второй текст о том же самом только повторял его другими словами.
      // при авторитаризме и тоталитаризме пресса не признаёт, что война — чьё-то
      // решение с ценой: это «ответ на угрозу» и «сплочение», а не сжатие экономики
      const statePress = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
      news.push(mkNews('gov', statePress ? 'ВВЕДЕНО ВОЕННОЕ ПОЛОЖЕНИЕ: СТРАНА СПЛОТИЛАСЬ' : 'СТРАНА ПЕРЕХОДИТ НА ВОЕННОЕ ПОЛОЖЕНИЕ',
        statePress
          ? (s.politicalRegime === 'totalitarian'
            ? 'Обращение к народу: враг у ворот, и народ как один встаёт на защиту Родины. Экономика переводится на нужды фронта, предприятия получают оборонный заказ. Попытки сеять панику и распространять слухи о трудностях пресекаются по законам военного времени.'
            : 'Официальное сообщение: в ответ на угрозу безопасности вводится военное положение. Промышленность получает оборонный заказ, правительство берёт экономику под особый контроль. Трудности временные — страна справится.')
          : 'Торговля, инвестиции и доверие сжимаются одновременно — это не стихия, а прямое следствие принятого решения. Расходы на оборону, сделанные до войны, определяют, насколько тяжёлым будет первый год. Чрезвычайные полномочия с этого момента доступны власти в полном объёме.',
        { priority: 10, chain: statePress ? ['Угроза', 'Военное положение', 'Оборонный заказ'] : ['Решение о войне', 'Санкции', 'Торговля ↓', 'Военное положение'] }));
    }
  });
  // окончание войны/пандемии тоже должно попасть в новости — раньше они молча
  // пропадали из activeCrises, и в ленте никогда не было понятно, что всё кончилось.
  // Для пороговых режимов (рецессия/перегрев/дефляция/стагфляция/...) такое же
  // объявление не делаем: они колеблются у границы и будут постоянно мигать —
  // war/pandemic же управляются событием с фиксированной длительностью и кулдауном,
  // мигать не могут
  prevCrises.filter((c) => !activeCrises.includes(c)).forEach((c) => {
    if (c === 'war' && s.warByChoice) {
      // при авторитаризме и тем более тоталитаризме государственная пресса не
      // станет сама признавать, что санкции снимаются неохотно, а капитал и
      // потенциал не возвращаются вместе с перемирием, — это ровно те факты,
      // которые превращают победную реляцию в её противоположность
      const authoritarianPress = s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian';
      news.push(mkNews('gov', 'ВОЕННАЯ ОПЕРАЦИЯ ЗАВЕРШЕНА', authoritarianPress
        ? 'Официальное сообщение: поставленные задачи выполнены полностью, операция завершена победой. Чрезвычайные полномочия, введённые на время войны, снимаются — страна возвращается к мирной жизни с позиции силы.'
        : 'Официально — «цели достигнуты». Санкции снимаются медленнее, чем вводились, капитал возвращается неохотно, а потенциал, из которого забрали людей и мощности, восстанавливается годами. Чрезвычайные полномочия перестают быть доступны.',
        { priority: 9, chain: ['Война окончена', 'Премия за риск ↓', 'Санкции остаются', 'Потенциал восстанавливается годами'] }));
    } else if (c === 'war') {
      const endNote = s.warType === 'offensive'
        ? ' Санкции обычно снимаются медленнее, чем вводились — торговые ограничения ещё долго будут сдерживать восстановление.'
        : s.warType === 'defensive'
          ? ' Иностранная помощь сворачивается вместе с чрезвычайным положением — экономике предстоит учиться стоять без неё.'
          : '';
      news.push(mkNews('crisis', 'ВОЙНА ОКОНЧЕНА', `Боевые действия прекратились. Торговля, инвестиции и доверие начинают восстанавливаться — но быстро зарубцевавшихся последствий войны не бывает.${endNote}`, { priority: 8 }));
    } else if (c === 'pandemic') {
      news.push(mkNews('crisis', 'ПАНДЕМИЯ ОТСТУПИЛА', 'Ограничения сняты, спрос и производственные возможности возвращаются к норме.', { priority: 7 }));
    }
  });

  /* --- 15а. ПОЛИТИЧЕСКИЙ РЕЖИМ: демократия → конфликт ветвей власти → авторитаризм →
     тоталитаризм, плюс отдельный слой беспорядков поверх любого режима. Подавление копит
     напряжение, а не гасит его — поэтому у авторитарных и тоталитарных режимов есть
     собственная «подпитка» напряжённости даже без видимых потрясений. */
  const prevPoliticalRegime = s.politicalRegime || 'democracy';
  const repression = prevPoliticalRegime === 'totalitarian' ? 1 : prevPoliticalRegime === 'authoritarian' ? 0.55 : prevPoliticalRegime === 'crisis' ? 0.15 : 0;
  // Коэффициент при рейтинге раньше давал не больше 37.8 п.п. даже при approval=0 —
  // порог кризиса (62) физически не мог быть взят одним лишь провалом рейтинга, как
  // бы катастрофично он ни упал: нужен был ещё и одновременный шок по безработице/
  // инфляции/долгу. Теперь обвал рейтинга в ноль сам по себе почти доводит до кризиса,
  // а любой активный кризис экономики (в т.ч. банковский с нулевой ликвидностью)
  // добавляет прямое давление, а не действует только через посредников.
  const tensionTarget = clamp(
    Math.max(0, 55 - approval) * 1.3
    + (warQuartersLeft > 0 ? 12 : 0)
    + activeCrises.length * 6
    + Math.max(0, unemployment - 7.5) * 2.2
    // та же логика насыщения, что и в рейтинге: прямой вклад цен в напряжение
    // не должен в одиночку сносить демократию — он добавляется к рейтингу,
    // в котором инфляция уже учтена
    + saturating(Math.max(0, inflation - 8), 1.6, 12.5)
    + Math.max(0, debtToGdp - 90) * 0.15
    + repression * 14
    + GS.unrest
    - 22 * mandateEffect
    - Math.max(0, approval - 55) * 0.6,
    0, 100);
  /* Указы президента двигают сам уровень напряжённости, а не её «равновесие»: разгон
     площади не меняет причин недовольства, он сдвигает состояние здесь и сейчас, а
     EMA сама вернёт напряжение к тому, что говорят экономика и рейтинг. */
  let politicalTension = clamp(ema(Number.isFinite(s.politicalTension) ? s.politicalTension : 8, tensionTarget, 0.3)
    + (d.tensionPush || 0) - 0.8 * stabilizationBonus, 0, 100);
  // переворот из блока выборов выше замыкает переход на авторитаризм напрямую,
  // минуя обычную пороговую цепочку демократия→кризис→авторитаризм — он уже
  // случился в этом квартале, а не подкрадывался несколько кварталов подряд
  // как именно власть потеряли, если потеряли: восстание или армия
  let powerLost = null;
  let politicalRegime = coup ? 'authoritarian' : prevPoliticalRegime;
  let parliamentDissolved = coup ? true : !!s.parliamentDissolved;
  /* Указы президента о парламенте — это прямой ход по той же лестнице режимов, а не
     ещё один источник напряжённости: распустить парламент своей волей значит сразу
     оказаться в авторитарном режиме, вернуть его — сойти обратно до конфликта ветвей,
     откуда обычные пороги уже сами доведут до демократии, если напряжение спадёт. */
  // переворот — такой же сознательный захват, как и указ: обратно «само» не отыграется
  let decreeRule = coup ? true : !!s.decreeRule;
  if (pres.patch.dissolve) {
    parliamentDissolved = true; decreeRule = true;
    if (politicalRegime === 'democracy' || politicalRegime === 'crisis') politicalRegime = 'authoritarian';
    cooldowns['political:transition'] = 4;
  }
  if (pres.patch.restore) {
    parliamentDissolved = false; decreeRule = false;
    if (politicalRegime === 'authoritarian' || politicalRegime === 'totalitarian') politicalRegime = 'crisis';
    cooldowns['political:transition'] = 3;
  }
  // указ о полном контроле — прямой ход на верхнюю ступень, без броска кубика:
  // тоталитаризм должен быть решением, а не стечением обстоятельств
  if (pres.patch.totalize && politicalRegime === 'authoritarian') {
    politicalRegime = 'totalitarian'; parliamentDissolved = true; decreeRule = true;
    cooldowns['political:transition'] = 6;
  }
  const politicalCooldown = coup ? 4 : (cooldowns['political:transition'] || 0);
  if (politicalCooldown <= 0) {
    if (politicalRegime === 'democracy' && politicalTension >= 62) {
      politicalRegime = 'crisis';
      cooldowns['political:transition'] = 3;
      news.push(mkNews('gov', 'ПАРЛАМЕНТ И ПРЕЗИДЕНТ: ОТКРЫТЫЙ КОНФЛИКТ',
        `Взаимные вето и угроза импичмента парализуют принятие решений. Рейтинг власти ${Math.round(approval)} из 100 — почвы для компромисса всё меньше.`,
        { priority: 9, chain: ['Низкий рейтинг', 'Паралич власти', 'Конфликт ветвей власти'] }));
    } else if (politicalRegime === 'crisis') {
      if (politicalTension >= 70 && rng() < 0.4) {
        politicalRegime = 'authoritarian'; parliamentDissolved = true;
        cooldowns['political:transition'] = 4;
        nextQueue.push(makeImpulse('businessConfidence', -10, 'Роспуск парламента: институты слабеют', 'default', difficulty, 'other'));
        nextQueue.push(makeImpulse('riskPremium', 0.6, 'Политический режим меняется', 'default', difficulty));
        news.push(mkNews('gov', 'ПАРЛАМЕНТ РАСПУЩЕН: ВЛАСТЬ СОСРЕДОТОЧЕНА В ОДНИХ РУКАХ',
          'Указ объявлен временной мерой «ради стабильности». Оппозиция называет это концом парламентской республики.',
          { priority: 10, chain: ['Конфликт ветвей власти', 'Роспуск парламента', 'Авторитарный поворот'] }));
      } else if (politicalTension <= 30) {
        politicalRegime = 'democracy';
        cooldowns['political:transition'] = 2;
        news.push(mkNews('gov', 'ПОЛИТИЧЕСКИЙ КРИЗИС ИСЧЕРПАН', 'Стороны нашли компромисс, парламент возвращается к обычной работе.', { priority: 7 }));
      }
    } else if (politicalRegime === 'authoritarian') {
      if (politicalTension >= 80 && rng() < 0.38) {
        politicalRegime = 'totalitarian';
        cooldowns['political:transition'] = 6;
        nextQueue.push(makeImpulse('businessConfidence', -14, 'Установление тоталитарного контроля', 'default', difficulty, 'other'));
        nextQueue.push(makeImpulse('investment', -3, 'Инвесторы уходят из страны', 'default', difficulty));
        nextQueue.push(makeImpulse('capitalFlow', -18, 'Бегство капитала', 'default', difficulty));
        news.push(mkNews('gov', 'ВЛАСТЬ УСТАНАВЛИВАЕТ ПОЛНЫЙ КОНТРОЛЬ',
          'Оставшиеся независимые институты и медиа переходят под прямое управление. Несогласие приравнено к угрозе государству, выборы отменены без назначения новой даты.',
          { priority: 10, chain: ['Авторитарный поворот', 'Подавление институтов', 'Тоталитарный режим'] }));
      } else if (politicalTension <= 25 && !decreeRule && rng() < 0.25) {
        // Возврат к демократии «сам собой» — это про режим, который вводился как
        // временная мера в кризис: обстоятельства отпали, чрезвычайное положение
        // сняли. Президент, распустивший парламент собственным указом (decreeRule),
        // так власть не отдаёт — для этого есть отдельное решение «вернуть парламент».
        politicalRegime = 'democracy'; parliamentDissolved = false;
        cooldowns['political:transition'] = 3;
        news.push(mkNews('gov', 'ЧРЕЗВЫЧАЙНОЕ ПОЛОЖЕНИЕ СНЯТО, ПАРЛАМЕНТ ВОССТАНОВЛЕН',
          'Обстоятельства, которыми объясняли особый режим, отпали, и удерживать его дальше стало дороже, чем вернуть обычную процедуру. Объявлены свободные выборы.', { priority: 8 }));
      }
    } else if (politicalRegime === 'totalitarian') {
      if (politicalTension >= 92 && rng() < 0.12) {
        politicalRegime = 'crisis'; parliamentDissolved = false;
        cooldowns['political:transition'] = 5;
        powerLost = 'uprising';
        nextQueue.push(makeImpulse('businessConfidence', 6, 'Режим пал: осторожный оптимизм', 'default', difficulty, 'other'));
        news.push(mkNews('gov', 'РЕЖИМ ПАЛ', 'Массовые протесты и раскол в элитах вынудили власть отступить. Страна входит в переходный период с неясным исходом.',
          { priority: 10, chain: ['Массовые протесты', 'Раскол элит', 'Падение режима', 'Переходный период'] }));
      }
    }
  } else {
    cooldowns['political:transition'] = politicalCooldown - 1;
  }

  const unrestCooldown = cooldowns['political:unrest'] || 0;
  let unrestTriggered = false;
  if (unrestCooldown <= 0 && politicalTension >= 55) {
    const chance = 0.05 + politicalTension / 400 + (warQuartersLeft > 0 ? 0.08 : 0) + repression * 0.06;
    if (rng() < chance) {
      unrestTriggered = true;
      cooldowns['political:unrest'] = 2;
      nextQueue.push(makeImpulse('consumption', -1.2, 'Беспорядки: перебои в повседневной жизни', 'default', difficulty));
      nextQueue.push(makeImpulse('businessConfidence', -6, 'Беспорядки в стране', 'default', difficulty, 'other'));
      nextQueue.push(makeImpulse('investment', -1.4, 'Беспорядки отпугивают инвестиции', 'default', difficulty));
      news.push(repression > 0.4
        ? mkNews('crisis', 'БЕСПОРЯДКИ ПОДАВЛЕНЫ СИЛОЙ', 'Силовые структуры разогнали демонстрантов. Официально — «попытка дестабилизации», пресечённая в интересах порядка.', { priority: 9 })
        : mkNews('crisis', 'МАССОВЫЕ ПРОТЕСТЫ В СТОЛИЦЕ', 'Люди вышли на улицы требовать перемен. Власть пытается балансировать между уступками и силовым сценарием.', { priority: 9 }));
    }
  } else if (unrestCooldown > 0) {
    cooldowns['political:unrest'] = unrestCooldown - 1;
  }
  const unrestQuartersLeft = unrestTriggered ? 2 : Math.max(0, (s.unrestQuartersLeft || 0) - 1);
  const unrestActive = unrestQuartersLeft > 0;

  /* Военный переворот. Там, где выборов нет или они ничего не решают, власть всё
     равно можно потерять — просто не у урны. Армия выступает не от хорошей жизни:
     её поднимают напряжение, нищета, кризисы и правитель, которого перестали
     бояться. Это единственный способ проиграть при тоталитарном режиме — и
     ровно поэтому он не должен быть ни неизбежным, ни невозможным: при спокойной
     стране вероятность почти нулевая, при разваливающейся — около пятой части
     за квартал. Кулдаун не даёт двум переворотам подряд. */
  const coupCooldown = cooldowns['political:military'] || 0;
  // не в тот же квартал, когда режим уже сменился: два переворота подряд — это не
  // драма, а сбой. Кулдаун смены режима заодно даёт новой власти время осмотреться
  const regimeJustChanged = coup || (cooldowns['political:transition'] || 0) > 0;
  if (!powerLost && !regimeJustChanged && (politicalRegime === 'authoritarian' || politicalRegime === 'totalitarian')) {
    if (coupCooldown > 0) cooldowns['political:military'] = coupCooldown - 1;
    else {
      // та же формула, что показывает интерфейс: поддержку силовиков раньше сюда не
      // передавали, и риск на экране расходился с настоящим
      const chance = militaryCoupRisk({ politicalTension, unemployment, nairu, inflation,
        activeCrises, approval, unrestActive, politicalCapital: Number.isFinite(s.politicalCapital) ? s.politicalCapital : 55,
        groupSupport: GS.support });
      if (chance > 0 && rng() < chance) {
        /* Выступить — не значит победить. Власть, которую поддерживает большинство,
           переворот переживает: люди выходят на улицу за неё, а не против, и
           заговорщиков арестовывают к утру. Чем ниже рейтинг и выше напряжение,
           тем меньше желающих её защищать. */
        const legitimacy = clamp((approval - 35) / 40, 0, 1) * 0.6 + clamp((45 - politicalTension) / 45, 0, 1) * 0.4;
        cooldowns['political:military'] = 8;
        if (rng() < legitimacy) {
          nextQueue.push(makeImpulse('approvalPush', 6, 'Попытка переворота провалилась: власть защитили', 'fast', difficulty, 'other'));
          nextQueue.push(makeImpulse('tensionPush', 9, 'Раскол в силовых структурах', 'fast', difficulty, 'other'));
          nextQueue.push(makeImpulse('businessConfidence', -7, 'Попытка переворота: страна на грани', 'default', difficulty, 'other'));
          nextQueue.push(makeImpulse('riskPremium', 0.35, 'Попытка переворота', 'default', difficulty));
          // подавленный мятеж — это и есть демонстрация единства: режим,
          // который его пережил, не станет сам объявлять, что в войсках раскол —
          // такую новость раньше писали прямым текстом, будто это независимая
          // пресса, хотя событие в принципе не может случиться вне авторитарного
          // или тоталитарного режима (см. условие блока выше)
          news.push(mkNews('gov', 'ПОПЫТКА ГОСУДАРСТВЕННОГО ПЕРЕВОРОТА ПРЕСЕЧЕНА',
            `Ночью часть войск попыталась занять правительственные здания. При рейтинге власти ${Math.round(approval)} из 100 и напряжённости ${Math.round(politicalTension)} улица вышла за действующую власть, а не против неё: к утру мятеж подавлен, зачинщики арестованы. Официально — «происки внешних сил, не нашедшие поддержки в народе»; то, что часть армии вообще была готова выступить, в сводки не попадёт.`,
            { priority: 10, chain: ['Выступление части армии', 'Улица за власть', 'Мятеж подавлен', 'Рейтинг ↑', 'Раскол в элитах'] }));
        } else {
          powerLost = 'military';
          politicalRegime = 'crisis'; parliamentDissolved = false; decreeRule = false;
          nextQueue.push(makeImpulse('businessConfidence', -12, 'Военный переворот: правил больше нет', 'default', difficulty, 'other'));
          nextQueue.push(makeImpulse('riskPremium', 0.9, 'Военный переворот', 'default', difficulty));
          nextQueue.push(makeImpulse('capitalFlow', -22, 'Бегство капитала после переворота', 'default', difficulty));
          // «отменил выборы» было правдой только для тоталитарного режима
          // (noElections); авторитарный их фальсифицирует, но формально проводит —
          // текст утверждал обратное для обоих режимов сразу
          news.push(mkNews('crisis', 'ВОЕННЫЙ ПЕРЕВОРОТ: АРМИЯ БЕРЁТ ВЛАСТЬ',
            `Ночью войска заняли правительственные здания. Официальное объяснение — «восстановление порядка» при напряжённости ${Math.round(politicalTension)} из 100 и рейтинге власти ${Math.round(approval)}: защищать эту власть на улицу никто не вышел. ${noElections ? 'Тот, кто отменил выборы' : 'Тот, кто превратил выборы в формальность'}, снимается с должности не голосованием.`,
            { priority: 10, chain: ['Напряжение в стране', 'Раскол в элитах', 'Выступление армии', 'Смена власти', 'Бегство капитала'] }));
        }
      }
    }
  } else if (coupCooldown > 0) cooldowns['political:military'] = coupCooldown - 1;

  /* Политический капитал президента: копится рейтингом и ростом, тает кризисами.
     Считается после режима и беспорядков — они на него и влияют. */
  /* Довольство президента считаем только когда он в партии вообще есть: иначе
     показатель молча дрейфовал бы у ролей, где президента не существует. */
  const presidentSatisfaction = decisions.presidentActive
    ? presidentSatisfactionNext(Number.isFinite(s.presidentSatisfaction) ? s.presidentSatisfaction : 60,
      { directiveMet: decisions.presidentDirectiveMet, patience: decisions.presidentPatience || 1,
        approval, gdpGrowth, potentialGrowth, activeCrises })
    : (Number.isFinite(s.presidentSatisfaction) ? s.presidentSatisfaction : 60);
  const capitalAfterSpend = clamp(startCapital - presSpent, 0, 100);
  const politicalCapitalGain = politicalCapitalRegen({ approval, gdpGrowth, potentialGrowth, activeCrises,
    unrestActive, politicalRegime, politicalCapital: capitalAfterSpend });
  const politicalCapital = clamp(capitalAfterSpend + politicalCapitalGain, 0, 100);

  /* --- 16. ПОЛИТИЧЕСКОЕ ДАВЛЕНИЕ --- */
  const demandCandidates = [];
  if (decisions.incomeTaxRate > 28 || decisions.vatRate > 23) demandCandidates.push({ id: 'tax_cut', actor: 'Население', text: 'Налоговая нагрузка невыносима — требуют снижения налогов.' });
  if (lendingRate - inflation > 6 && businessConfidence < 50) demandCandidates.push({ id: 'rate_cut', actor: 'Бизнес', text: 'Реальная стоимость кредита душит инвестиции — требуют снизить ставку.' });
  if (debtToGdp > 85) demandCandidates.push({ id: 'debt_cut', actor: 'Инвесторы', text: 'Долговая нагрузка выше комфортного уровня — требуют бюджетной консолидации.' });
  if (unemployment > 7.5) demandCandidates.push({ id: 'social_up', actor: 'Парламент', text: 'Безработица высока — требуют расширить социальные выплаты.' });
  if (inflation > 8) demandCandidates.push({ id: 'infl_down', actor: 'Профсоюзы', text: 'Инфляция съедает зарплаты — требуют вернуть цены под контроль.' });
  if (shadowShare > 22) demandCandidates.push({ id: 'shadow', actor: 'Налоговая служба', text: 'Бизнес массово уходит в тень — база размывается быстрее, чем растут ставки.' });
  const prevDemands = s.demands || [];
  const demands = demandCandidates.map((c) => {
    const prev = prevDemands.find((p) => p.id === c.id);
    return { ...c, quartersActive: prev ? prev.quartersActive + 1 : 1 };
  });

  /* --- 17. ПЯТЬ НЕЗАВИСИМЫХ ОЦЕНОК --- */
  const scores = computeScores({
    inflation, inflationExpectations, outputGap, cbCredibility, gdpGrowth, unemployment, nairu,
    consumerConfidence, humanCapitalIndex, bankingRisk, creditGap, bankCapitalAdequacy, capitalRequirement: decisions.capitalRequirement,
    currencyRisk, reserves, imports, debtToGdp, budgetBalancePctGdp, interestPayment, govRevenue, shadowShare,
    potentialGrowth, infrastructureIndex, productivity, inflationTarget: infTarget,
  });
  const { scoreStability, scoreWelfare, scoreFinancial, scoreFiscal, scorePotential, wellbeing } = scores;
  const interestToRevenue = interestPayment / Math.max(1, govRevenue) * 100;

  // конфликт политик: ЦБ ужесточает, когда бюджет стимулирует (или наоборот) — произведение стансов > 0
  const policyConflict = clamp(Math.max(0, (s.cbStance || 0) * (s.mofStance || 0)), 0, 1);
  const policyCoordination = clamp(s.policyCoordination + 3.0 - 16 * policyConflict, 0, 100);

  const newEconomy = {
    gdp, nominalGdp, priceLevel, gdpGrowth, potentialGdp, potentialGrowth, outputGap,
    gdpPerCapita: gdp * 1000 / CONFIG.population,
    consumption, businessInvestment, govPurchasesReal, govInvestmentReal, transfersReal,
    consumptionGrowth, investmentGrowth, govPurchasesGrowth: actualGrowthG, transfersGrowth: actualGrowthTr,
    govInvestmentGrowth: actualGrowthIg, sequesterFactor, maxDeficitPct,
    exports, imports, tradeBalance: exports - imports, currentAccount, capitalAccount, netCapitalFlow, reserves, fdi,
    exchangeRate, realExchangeRate, fxDeprAnnual, fxRegime: decisions.fxRegime, fxTarget, importPriceInflation,
    inflationTarget: infTarget, defenseIntervention,
    capitalStock, laborForce, productivity, humanCapitalIndex, infrastructureIndex, supplyScar, tfpGrowth,
    unemployment, prevUnemployment: s.unemployment, employment, nairu, tightness, vacancyRate, wageGrowth, unitLaborCostGrowth,
    inflation, coreInflation, inflationExpectations, cbCredibility, importPriceInfl: importPriceInflation,
    keyRate: decisions.keyRate, reserveReq: decisions.reserveReq, capitalRequirement: decisions.capitalRequirement,
    lendingRate, depositRate, realLendingRate, realPolicyRate, rStar, rateGap, policyStance, riskPremium, moneySupply, carry,
    creditVolume, creditGrowth, creditGap, creditGapLag, creditTrendRatio, creditImpulse, creditCrunch,
    bankNPL, bankCapital, bankCapitalAdequacy, bankLiquidity, bankProfit, loanLosses, bankingRisk, financialStability,
    incomeTaxRate: decisions.incomeTaxRate, profitTaxRate: decisions.profitTaxRate, vatRate: decisions.vatRate,
    exciseRate: decisions.exciseRate, capitalTaxRate: decisions.capitalTaxRate, socialContribRate: decisions.socialContribRate,
    shadowShare, taxWedgeValue: wedgeNow, revenueParts, govRevenue, revenuePctGdp,
    govPurchasesNominal, transfersNominal, govInvestmentNominal, govSpendingTotal, interestPayment, interestToRevenue,
    budgetBalance, budgetBalancePctGdp, structuralBalancePctGdp, primaryBalance, fiscalImpulse,
    govDebt, debtToGdp, effectiveDebtRate, budgetShares, defenseCommit, sovereignFund, fundPctGdp, netDebtToGdp, fundIncome,
    marketLockoutQuartersLeft, defaultedEver, justDefaulted: sovereignDefault,
    imfQuartersLeft, imfActive, imfStarted,
    consumerConfidence, businessConfidence, govTrust, policyCoordination,
    approval, quartersToElection, term, mandate, governmentLine, electionResult, lastElection, campaignActive: campaign,
    electionVoteShare: voteShare, promisesKept: promisesTotal ? promisesKept : null, promisesTotal: promisesTotal || null,
    politicalRegime, politicalTension, parliamentDissolved, unrestQuartersLeft, unrestActive, powerLost, noElections,
    stabilizationCred, stabilizationWon, crisisMandateLeft, crisisMandateTotal: mandateTotal,
    projects: territory.projects, projectsBuilt: territory.projectsBuilt, regionMods: RS.regionMods, regionShock: RS.regionShock,
    regionEvent: territory.regionEvent, regionEventCooldown: RS.regionEventCooldown, lastRegionResolution: RS.lastRegionResolution,
    projectReal,
    // штабы копятся весь цикл кампании и обнуляются голосованием
    campaignSpend: quartersToElection === CONFIG.election.cycle ? {} : CP.spend,
    warCampaign: warQuartersLeft > 0 && warType === 'offensive' ? (WC.campaign || newWarCampaign(annexed, warTarget || 'north')) : null,
    warTarget: warQuartersLeft > 0 && warType === 'offensive' ? (warTarget || 'north') : null,
    annexed: territory.annexed, annexLoyalty: territory.annexLoyalty, annexIntegrated: territory.annexIntegrated, annexFunded: territory.annexFunded,
    revancheCampaign: warQuartersLeft > 0 && warType === 'revanche' ? (RV.campaign || s.revancheCampaign) : null,
    defenseCampaign: warQuartersLeft > 0 && warType === 'defensive' ? (DF.campaign || s.defenseCampaign || newDefenseCampaign()) : null,
    norlandRevanche: RV.start ? RV.revanche : clamp(RV.revanche + DP.revancheDelta, -50, 100), revancheWarned: RV.warned, peaceTalks, treaty,
    relations: DP.relations, diploTreaties: DP.treaties, diploSanctions: DP.sanctions, diploCooldown: DP.cooldown,
    deshtMobilized: warTriggered ? 0 : DP.mobilized, deshtCalm: DP.calm, neighborEvent: DP.event, diploLast: DP.last || null, diploResolved: DP.resolved || null,
    groupSupport: GS.support, groupSupportPrev: s.groupSupport || null, groupDriversNow: GS.drivers, groupUnrestCd: GE.cd,
    groupDemand: GD.demand, groupDemandCooldown: GD.cooldown, lastGroupResolution: GD.resolution || s.lastGroupResolution || null,
    groupMemory: [...GS.memory, ...groupMemoryLate],
    politicalCapital, politicalCapitalGain, reforms, cbTenure, mofTenure, decreeRule, presidentSatisfaction,
    worldGdpGrowth, worldInflation, worldRate, commodityIndex, worldDemandIndex,
    inflationRisk, debtRisk, recessionRisk, currencyRisk, bankingRiskValue: bankingRisk,
    yield3m, yield1y, yield2y, yield5y, yield10y, curveSlope, curveInverted, bondIndex, bondReturn,
    sovereignSpread, corporateSpread, stockIndex, stockReturn, stockPE, fairPE, equityRiskPremium, earnings,
    marketCap, marketCapPctGdp, sectorBanks, sectorIndustry, sectorConsumer, sectorResources,
    netInterestMargin, bankROE, bankPB, fxVolatility, volatilityIndex, discountRate,
    depositIndex, fxIndex, fxCarry, corpBondIndex, corpYield, corpReturn, goldIndex, reitIndex,
    bondShortIndex, linkerIndex, moneyMarketIndex, worldEquityIndex,
    activeCrises, regime, recessionStreak, recessionRecoverStreak, demands, pandemicQuartersLeft, warQuartersLeft, warType, warByChoice, warElapsed,
    sanctionsQuartersLeft, tradeBlocQuartersLeft, tradeBlocActive,
    regimeStreak: (s.regime === regime ? regimeStreakPrev + 1 : 1),
    scoreStability, scoreWelfare, scoreFinancial, scoreFiscal, scorePotential, wellbeing,
    cbStance: s.cbStance || 0, mofStance: s.mofStance || 0,
    botHeadline: botAction ? botAction.headline : null, botDemand: botAction ? botAction.demand : null,
    botHeadline2: (botActions && botActions[0]) ? botActions[0].headline : null,
    botDemand2: (botActions && botActions[0]) ? botActions[0].demand : null,
  };

  const byHeadline = (h) => log.filter((c) => c.headline === h).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 6);
  // разрыв выпуска — это фактический рост против потенциального, а не отдельная
  // строчка в журнале причин: своего списка импульсов у него нет, поэтому
  // «почему» составляется из тех же двух источников, которые его и образуют —
  // спросовых причин роста ВВП и причин, двигающих сам потенциал
  const outputGapReasons = log.filter((c) => c.headline === 'gdpGrowth' || c.headline === 'potential')
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 6);
  const reasons = {
    gdpGrowth: byHeadline('gdpGrowth'), inflation: byHeadline('inflation'), exchangeRate: byHeadline('exchangeRate'),
    budget: byHeadline('budget'), unemployment: byHeadline('unemployment'), banking: byHeadline('banking'), potential: byHeadline('potential'),
    outputGap: outputGapReasons,
  };
  const report = buildReport({ prev: s, next: newEconomy, reasons });

  // сюжеты: запуск новых цепочек и продвижение уже идущих
  const activeStories = [...(stories || []), ...newStories];
  storyTriggers(s, newEconomy, decisions, activeStories, cooldowns).forEach((id) => {
    activeStories.push({ tplId: id, nextIdx: 0, wait: storyStartWait(id) });
    cooldowns[`story:${id}`] = 10;
  });
  const advanced = advanceStories(activeStories, newEconomy, quarterIndex);
  const generated = generateNews(s, newEconomy, decisions, quarterIndex, botAction, cooldowns, botActions, publicMode);
  const propaganda = propagandaEditorial(newEconomy);
  const editorial = propaganda
    ? mkNews('editorial', propaganda.headline, propaganda.text, { priority: 2 })
    : mkNews('editorial', `ИТОГИ ${quarterLabel(quarterIndex).toUpperCase()}`, report, { priority: 2 });
  const allNews = [...news, ...advanced.news, ...generated, editorial]
    .map((n) => ({ ...n, q: quarterIndex, qLabel: quarterLabel(quarterIndex) }))
    .sort((a, b) => b.priority - a.priority);

  return { economy: newEconomy, pendingImpulses: nextQueue, eventCooldowns: cooldowns, reasons, report,
    newsEntries: allNews, stories: advanced.stories };
}

/* =========================================================================================
   НОВОСТНОЙ ДВИЖОК: заголовки генерируются из состояния модели, а события разворачиваются
   в многоквартальные сюжеты (цепочки последствий), а не в одно сообщение.
========================================================================================= */
const ru = (v) => String(v).replace('.', ',');
const rf1 = (v) => ru(fmt1(v));
const rf2 = (v) => ru(fmt2(v));
const rfs = (v) => ru(fmtSigned1(v));
// шаг ставки ходит по сетке 0,25 — округление до десятых превращало его в «+0,3»
const rfs2 = (v) => ru(Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) : '—');
let __newsId = 1;
function mkNews(cat, headline, text, opts) {
  const o = opts || {};
  return { id: `n${__newsId++}`, cat, headline, text, priority: o.priority || 4, chain: o.chain || null,
    storyId: o.storyId || null, storyTitle: o.storyTitle || null, step: o.step || null, steps: o.steps || null, tag: o.tag || null };
}

/* ----------------------- СЮЖЕТЫ: цепочки последствий ----------------------- */
const STORY_TEMPLATES = {
  commodity_down: { id: 'commodity_down', title: 'Падение сырьевых цен', steps: [
    { make: (s) => mkNews('world', `МИРОВЫЕ ЦЕНЫ НА СЫРЬЁ ПАДАЮТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
      'Сырьевые рынки развернулись вниз. Для экспортёров это прямой удар по выручке, для бюджета — по доходам, а дальше цепочка дойдёт до курса и цен в магазинах.', { priority: 7,
        chain: ['Сырьё ↓', 'Экспортная выручка ↓', 'Доходы бюджета ↓', 'Курс ↓', 'Импортные цены ↑', 'Реальные доходы ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `ЭКСПОРТ СОКРАЩАЕТСЯ ДО ${fmtMoney(s.exports)}`,
      `Экспортная выручка падает вслед за ценами. Текущий счёт ${fmtMoneySigned(s.currentAccount)} — приток валюты в страну слабеет, и это уже вопрос курса.`, { priority: 6 }) },
    { gap: 1, make: (s) => (s.budgetBalancePctGdp < 0
      ? mkNews('gov', `БЮДЖЕТ НЕДОСЧИТЫВАЕТСЯ ДОХОДОВ: ДЕФИЦИТ ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП`,
        `Сужение налоговой базы экспортёров бьёт по доходам казны при долге ${rf1(s.debtToGdp)}% ВВП — Минфину предстоит выбирать между сокращением расходов и займами.`, { priority: 6 })
      : mkNews('gov', `БЮДЖЕТ ВЫДЕРЖАЛ СЫРЬЕВОЙ УДАР: ПРОФИЦИТ ${rf1(s.budgetBalancePctGdp)}% ВВП`,
        `Доходы от экспортёров просели, но запас прочности бюджета оказался достаточным. Долг ${rf1(s.debtToGdp)}% ВВП, резервный фонд ${fmtMoney(s.sovereignFund || 0)}.`, { priority: 5 })) },
    { gap: 1, make: (s) => (s.fxDeprAnnual > 0.5
      ? mkNews('markets', `ВАЛЮТА СЛАБЕЕТ: ${rfs(s.fxDeprAnnual)}% В ГОДОВОМ ВЫРАЖЕНИИ`,
        'Платёжный баланс ухудшился — валюта пошла вниз. Следующий шаг цепочки предсказуем: дорожает импорт.', { priority: 6 })
      : mkNews('markets', 'КУРС УСТОЯЛ ВОПРЕКИ УХУДШЕНИЮ БАЛАНСА',
        'Отток валюты по торговому счёту компенсирован притоком капитала или интервенциями. Импортная инфляция в этот раз не придёт — но резервы и доверие инвесторов не бесконечны.', { priority: 5 })) },
    { gap: 1, make: (s) => mkNews('households', `ИМПОРТ ДОРОЖАЕТ, РЕАЛЬНЫЕ ЗАРПЛАТЫ ${s.wageGrowth - s.inflation >= 0 ? 'ЕДВА РАСТУТ' : 'ПАДАЮТ'}`,
      `Цены импорта растут на ${rf1(s.importPriceInflation)}% в год при инфляции ${rf1(s.inflation)}%. Зарплаты прибавляют ${rf1(s.wageGrowth)}% — реальный доход ${rfs(s.wageGrowth - s.inflation)}%. Замыкающее звено цепочки — уровень жизни.`, { priority: 6 }) },
  ] },
  oil_up: { id: 'oil_up', title: 'Сырьевой рост', steps: [
    { make: (s) => mkNews('world', `СЫРЬЁ ДОРОЖАЕТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
      'Мировые цены на сырьё пошли вверх. Для экспортёра это валютная выручка, для импортёра — удар по издержкам.', { priority: 6,
        chain: ['Сырьё ↑', 'Торговый баланс', 'Курс', 'Издержки и цены', 'Решение ЦБ'] }) },
    { gap: 1, make: (s) => (s.tradeBalance >= 0
      ? mkNews('markets', `ПРИТОК ВАЛЮТЫ УКРЕПЛЯЕТ ПОЗИЦИИ: ТОРГОВЫЙ БАЛАНС ${fmtMoneySigned(s.tradeBalance)}`,
        'Экспортная выручка растёт быстрее импорта. Крепкий курс сдержит инфляцию, но ударит по конкурентоспособности несырьевых отраслей.', { priority: 5 })
      : mkNews('business', `ИЗДЕРЖКИ ПРОИЗВОДСТВА РАСТУТ ВСЛЕД ЗА СЫРЬЁМ`,
        `Экономика покупает сырьё дороже, чем продаёт. Инфляция ${rf1(s.inflation)}% — и это инфляция издержек, которую ставкой лечить больнее всего.`, { priority: 6 })) },
    { gap: 2, make: (s) => mkNews('cb', `ЦБ ОЦЕНИВАЕТ ПЕРЕНОС СЫРЬЕВЫХ ЦЕН: ОЖИДАНИЯ ${rf1(s.inflationExpectations)}%`,
      `Ключевой вопрос — закрепится ли ценовой шок в ожиданиях. Пока доверие к ЦБ ${Math.round(s.cbCredibility)} из 100, и от него зависит, придётся ли жертвовать выпуском.`, { priority: 5 }) },
  ] },
  global_rate_hike: { id: 'global_rate_hike', title: 'Ужесточение в мире', steps: [
    { make: (s) => mkNews('world', `МИРОВЫЕ СТАВКИ РАСТУТ ДО ${rf1(s.worldRate)}%`,
      'Крупнейшие центробанки ужесточают политику. Капитал разворачивается в сторону безопасных активов — развивающиеся рынки первыми чувствуют отток.', { priority: 7,
        chain: ['Мировые ставки ↑', 'Отток капитала', 'Курс ↓', 'Импортные цены ↑', 'Ставка ЦБ ↑', 'Кредит ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `ОТТОК КАПИТАЛА: ${fmtMoneySigned(s.netCapitalFlow)} В ГОДОВОМ ВЫРАЖЕНИИ`,
      `Разница реальных ставок с миром ${rfs(s.carry)} п.п. при премии за риск ${rf1(s.riskPremium)} п.п. Инвесторы уходят — резервы ${fmtMoney(s.reserves)}.`, { priority: 6 }) },
    { gap: 1, make: (s) => mkNews('cb', `ДАВЛЕНИЕ НА КУРС СТАВИТ ЦБ ПЕРЕД ВЫБОРОМ`,
      `Валюта ${s.fxDeprAnnual > 0 ? `слабеет на ${rf1(s.fxDeprAnnual)}% годовых` : 'держится'}, инфляция ${rf1(s.inflation)}%. Поднять ставку — задушить кредит; не поднимать — импортировать инфляцию.`, { priority: 6 }) },
  ] },
  bank_run: { id: 'bank_run', title: 'Банковская паника', steps: [
    { make: (s) => mkNews('crisis', 'ВКЛАДЧИКИ ЗАБИРАЮТ ДЕНЬГИ ИЗ БАНКОВ',
      `Ликвидность банковской системы упала до ${Math.round(s.bankLiquidity)} из 100. Банки сокращают выдачу новых кредитов, чтобы удержать наличность.`, { priority: 9,
        chain: ['Отток депозитов', 'Ликвидность ↓', 'Кредит ↓', 'Инвестиции ↓', 'ВВП ↓', 'Просрочка ↑'] }) },
    { gap: 1, make: (s) => mkNews('business', `КРЕДИТ ДЛЯ БИЗНЕСА ПЕРЕСЫХАЕТ: РОСТ ПОРТФЕЛЯ ${rfs(s.creditGrowth)}%`,
      `Ставка по кредитам ${rf1(s.lendingRate)}%, достаточность капитала банков ${rf1(s.bankCapitalAdequacy)}%. Компании откладывают инвестиционные проекты.`, { priority: 7 }) },
    { gap: 1, make: (s) => mkNews('households', `РЫНОК ТРУДА ЧУВСТВУЕТ КРЕДИТНОЕ СЖАТИЕ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}%`,
      `Сокращение инвестиций дошло до занятости. Разрыв выпуска ${rfs(s.outputGap)}% — и чем дольше он отрицательный, тем выше естественный уровень безработицы в будущем.`, { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('markets', `ПРОСРОЧКА РАСТЁТ ДО ${rf1(s.bankNPL)}%: ПЕТЛЯ ЗАМКНУЛАСЬ`,
      'Слабая экономика возвращается в банки неплатежами, неплатежи съедают капитал, капитал ограничивает кредит. Разорвать круг можно только извне — рекапитализацией или смягчением политики.', { priority: 8 }) },
  ] },
  sanctions: { id: 'sanctions', title: 'Внешние ограничения', steps: [
    { make: (_s) => mkNews('world', 'ВВЕДЕНЫ ВНЕШНИЕ ОГРАНИЧЕНИЯ НА ТОРГОВЛЮ И ФИНАНСЫ',
      'Часть торговых и финансовых каналов закрыта. Экономика теряет не только спрос, но и производственные возможности: это шок предложения.', { priority: 9,
        chain: ['Ограничения', 'Экспорт и импорт ↓', 'Отток капитала', 'Курс ↓', 'Инфляция ↑', 'Потенциал ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `КУРС ПОД ДАВЛЕНИЕМ, ПРЕМИЯ ЗА РИСК ${rf1(s.riskPremium)} П.П.`,
      `Инвесторы требуют больше за страновой риск, новый госдолг обходится в ${rf1(s.effectiveDebtRate)}%. Резервы ${fmtMoney(s.reserves)} — вопрос, тратить ли их на защиту курса.`, { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('business', `ПОТЕНЦИАЛЬНЫЙ ВЫПУСК СНИЖАЕТСЯ: РОСТ ПОТЕНЦИАЛА ${rf1(s.potentialGrowth)}%`,
      'Разорванные цепочки поставок — это не временная просадка спроса, а утраченные мощности. Стимулировать такую экономику деньгами значит получить инфляцию без выпуска.', { priority: 7 }) },
  ] },
  pandemic: { id: 'pandemic', title: 'Пандемия', steps: [
    { make: (_s) => mkNews('crisis', 'ВСПЫШКА ЗАБОЛЕВАНИЯ: ОГРАНИЧЕНИЯ ЭКОНОМИЧЕСКОЙ АКТИВНОСТИ',
      'Одновременно падают и спрос, и предложение. Редкий случай, когда бюджетная поддержка нужна быстрее денежной.', { priority: 9,
        chain: ['Ограничения', 'Спрос ↓ и мощности ↓', 'Безработица ↑', 'Расходы бюджета ↑', 'Долг ↑'] }) },
    { gap: 1, make: (s) => mkNews('households', `БЕЗРАБОТИЦА ${rf1(s.unemployment)}%, ДОВЕРИЕ НАСЕЛЕНИЯ ${Math.round(s.consumerConfidence)}`,
      'Домохозяйства сокращают расходы и наращивают сбережения. Трансферты сейчас работают сильнее обычного: склонность тратить у людей без дохода максимальна.', { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('gov', `СЧЁТ ЗА КРИЗИС: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Поддержка экономики оплачена займами. Обслуживание долга забирает ${rf1(s.interestToRevenue)}% доходов бюджета — это уже структурное ограничение на будущую политику.`, { priority: 6 }) },
  ] },
  war: { id: 'war', title: 'Война', steps: [
    { make: (s) => mkNews('crisis', 'НАЧАЛАСЬ ВОЙНА: ЭКОНОМИКА ПЕРЕХОДИТ НА ВОЕННЫЕ РЕЛЬСЫ',
      `Торговля и инвестиции сжимаются, инвесторы уходят в защитные активы. ${s.warType === 'offensive'
        ? 'Война носит наступательный характер: партнёры вводят санкции, торговые и финансовые каналы сворачиваются быстрее, чем от одного военного шока.'
        : s.warType === 'defensive'
          ? 'Война носит оборонительный характер: союзники открывают кредитные линии и наращивают закупки — часть удара компенсирует иностранная помощь.'
          : 'Насколько тяжёлым будет удар — во многом решили расходы на оборону, сделанные ещё до войны.'}`, { priority: 10,
        chain: ['Война', 'Торговля ↓ и инвестиции ↓', 'Доверие ↓', 'Издержки ↑', 'Отток капитала'] }) },
    { gap: 1, make: (s) => mkNews('world', `ОБОРОННЫЕ РАСХОДЫ — ${rf1(s.budgetShares.defense)}% БЮДЖЕТА`,
      s.budgetShares.defense >= 20
        ? 'Заранее укреплённая оборона и логистика смягчили удар по экономике — тыл оказался готов.'
        : 'Война застала экономику с низкими расходами на оборону: адаптация обходится дороже и медленнее.', { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('gov', `ЦЕНА ВОЙНЫ: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Военные расходы и потери выпуска ложатся на бюджет. ${s.warType === 'offensive'
        ? 'Санкции отрезали часть внешнего финансирования — дефицит приходится закрывать более дорогим внутренним долгом.'
        : s.warType === 'defensive'
          ? 'Иностранная помощь и льготные кредиты союзников частично разгружают бюджет, но обслуживание долга и оборона всё равно конкурируют за каждый процент.'
          : 'Обслуживание долга и оборона теперь конкурируют за каждый бюджетный процент.'}`, { priority: 6 }) },
  ] },
  tech_breakthrough: { id: 'tech_breakthrough', title: 'Технологический скачок', steps: [
    { make: (s) => mkNews('business', `ТЕХНОЛОГИЧЕСКИЙ ПРОРЫВ: ПРОИЗВОДИТЕЛЬНОСТЬ ${rf1(s.productivity)}`,
      'Новые технологии повышают совокупную факторную производительность. Это редкий шок, который одновременно увеличивает выпуск и снижает инфляцию.', { priority: 6,
        chain: ['Производительность ↑', 'Потенциал ↑', 'Издержки ↓', 'Реальные зарплаты ↑'] }) },
    { gap: 2, make: (s) => mkNews('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rfs(s.wageGrowth - s.inflation)}%`,
      `Рост производительности позволяет платить больше без инфляции: удельные издержки труда ${rf1(s.unitLaborCostGrowth)}%. Потенциальный рост ВВП ${rf1(s.potentialGrowth)}%.`, { priority: 5 }) },
  ] },
  supply_chain: { id: 'supply_chain', title: 'Шок предложения', steps: [
    { make: (_s) => mkNews('world', 'НАРУШЕНЫ ЦЕПОЧКИ ПОСТАВОК',
      'Логистика встала: часть производственных мощностей физически не может работать. Это не падение спроса — это падение того, сколько экономика вообще способна произвести.', { priority: 8 }) },
    { make: (s) => mkNews('business', 'СБОИ ПОСТАВОК: ИЗДЕРЖКИ РАСТУТ, ПОТЕНЦИАЛ СНИЖАЕТСЯ',
      `Производство встало без комплектующих: выпуск падает, разрыв ${rfs(s.outputGap)}%, рост потенциала снизился до ${rf1(s.potentialGrowth)}%. Падает и то, что экономика производит, и то, что она в принципе способна произвести — но цены при этом растут.`, { priority: 8,
        chain: ['Сбои поставок', 'Выпуск ↓', 'Потенциал ↓', 'Издержки ↑', 'Инфляция ↑', 'Дилемма ЦБ'] }) },
    { gap: 1, make: (s) => (s.outputGap < 0 && s.inflation > s.inflationTarget
      ? mkNews('cb', `ДИЛЕММА ЦБ: ИНФЛЯЦИЯ ${rf1(s.inflation)}% ПРИ РАЗРЫВЕ ВЫПУСКА ${rfs(s.outputGap)}%`,
        `Ожидания ${rf1(s.inflationExpectations)}%. Подавлять инфляцию — углублять спад. Терпеть — рисковать срывом ожиданий, после которого возврат к цели обойдётся дороже.`, { priority: 8 })
      : s.outputGap >= 0
        ? mkNews('cb', `ШОК ПРОШЁЛ, НО РАЗРЫВ ВЫПУСКА УЖЕ ${rfs(s.outputGap)}%`,
          `Пока экономика подстраивалась под сбой поставок, спрос успел обогнать восстановившееся предложение: инфляция ${rf1(s.inflation)}% при ожиданиях ${rf1(s.inflationExpectations)}%. Дилемма сменилась на обратную — сдерживать перегрев, а не спасать от спада.`, { priority: 7 })
        : mkNews('cb', `ШОК ПОСТАВОК ПОЗАДИ: ИНФЛЯЦИЯ ${rf1(s.inflation)}% ПРИ РАЗРЫВЕ ВЫПУСКА ${rfs(s.outputGap)}%`,
          `Издержки перестали расти быстрее спроса — цены отпустило раньше, чем закрылся разрыв выпуска. Дилеммы уже нет: пространство поддержать спрос есть, инфляция не мешает.`, { priority: 6 })) },
  ] },
  demographic: { id: 'demographic', title: 'Демографический сдвиг', steps: [
    { make: (_s) => mkNews('households', 'СТАРЕНИЕ НАСЕЛЕНИЯ СЖИМАЕТ РАБОЧУЮ СИЛУ',
      'Предложение труда сокращается. В краткосрочной перспективе это разгон зарплат, в долгосрочной — более низкий потенциальный рост и более низкая нейтральная ставка.', { priority: 6,
        chain: ['Рабочая сила ↓', 'Зарплаты ↑', 'Потенциал ↓', 'Нагрузка на бюджет ↑'] }) },
    { gap: 2, make: (s) => mkNews('gov', `СОЦИАЛЬНЫЕ ОБЯЗАТЕЛЬСТВА ДАВЯТ НА БЮДЖЕТ: БАЛАНС ${rfs(s.budgetBalancePctGdp)}% ВВП`,
      `Меньше работников — меньше налоговая база, больше получателей выплат. Нейтральная ставка r* опустилась до ${rf1(s.rStar)}%: это меняет всю шкалу того, что считать жёсткой политикой.`, { priority: 6 }) },
  ] },
  consumer_boom: { id: 'consumer_boom', title: 'Потребительский бум', steps: [
    { make: (_s) => mkNews('households', 'ДОМОХОЗЯЙСТВА НАРАЩИВАЮТ РАСХОДЫ И СПРОС НА КРЕДИТ',
      'Потребительский оптимизм разгоняет спрос. Пока есть свободные мощности, это рост; когда они закончатся — инфляция.', { priority: 6,
        chain: ['Спрос ↑', 'Разрыв выпуска ↑', 'Инфляция ↑', 'Реакция ЦБ'] }) },
    { gap: 2, make: (s) => (s.outputGap > 1.5
      ? mkNews('markets', `ЭКОНОМИКА ПЕРЕГРЕВАЕТСЯ: РАЗРЫВ ВЫПУСКА ${rfs(s.outputGap)}%`,
        `Инфляция ${rf1(s.inflation)}% при безработице ${rf1(s.unemployment)}% — ниже естественного уровня. Дефицит работников толкает зарплаты вверх на ${rf1(s.wageGrowth)}%.`, { priority: 7 })
      : mkNews('business', 'СПРОС АБСОРБИРОВАН БЕЗ ПЕРЕГРЕВА',
        `Экономика переварила всплеск спроса: разрыв выпуска ${rfs(s.outputGap)}%, инфляция ${rf1(s.inflation)}%. Свободные мощности сделали своё дело.`, { priority: 4 })) },
  ] },
  /* --- сюжеты, которые запускает сам игрок --- */
  /* Сюжет начинается не с объявления решения — его и так печатают либо сводка ЦБ,
     либо общая новость о шаге ставки, — а с того, что происходит дальше. */
  rate_hike: { id: 'rate_hike', title: 'Ужесточение денежной политики', steps: [
    { gap: 2, make: (s) => mkNews('markets', `БАНКИ ПЕРЕНОСЯТ СТАВКУ В КРЕДИТЫ: ${rf1(s.lendingRate)}%`,
      `Перенос ключевой ставки в рыночные идёт с лагом. Рост кредитного портфеля ${rfs(s.creditGrowth)}%, спрос на заёмные деньги остывает.`, { priority: 6 }) },
    { gap: 1, make: (s) => mkNews('business', `ИНВЕСТИЦИИ ЗАМЕДЛЯЮТСЯ: ${rfs(s.investmentGrowth)}%`,
      `Дорогие деньги переписывают инвестиционные планы. Доверие бизнеса ${Math.round(s.businessConfidence)}, разрыв выпуска ${rfs(s.outputGap)}%.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('households', `ЦЕНА ДЕЗИНФЛЯЦИИ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}%, ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
      `Замедление цен оплачено занятостью — это и есть коэффициент жертв. Ожидания ${rf1(s.inflationExpectations)}%: чем выше доверие к ЦБ, тем дешевле обходится такой манёвр.`, { priority: 7 }) },
  ] },
  rate_cut: { id: 'rate_cut', title: 'Смягчение денежной политики', steps: [
    { gap: 2, make: (s) => mkNews('business', `КРЕДИТ ОЖИВАЕТ: ПОРТФЕЛЬ ${rfs(s.creditGrowth)}%`,
      `Инвестиции ${rfs(s.investmentGrowth)}%, доверие бизнеса ${Math.round(s.businessConfidence)}. Кредитный разрыв ${rfs(s.creditGap)} п.п. ВВП — за этим показателем стоит следить: сегодняшний бум завтра вернётся просрочкой.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('cb', `ПРОВЕРКА ОЖИДАНИЙ: ${rf1(s.inflationExpectations)}% ПРИ ЦЕЛИ 4%`,
      `Инфляция ${rf1(s.inflation)}%, доверие к ЦБ ${Math.round(s.cbCredibility)}. Если ожидания сдвинулись вверх, возврат к цели обойдётся дороже, чем стоило смягчение.`, { priority: 6 }) },
  ] },
  vat_hike: { id: 'vat_hike', title: 'Повышение НДС', steps: [
    { make: (s) => mkNews('gov', `НДС ПОВЫШЕН ДО ${rf1(s.vatRate)}%`,
      `Минфин закрывает дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП за счёт косвенного налога. Цены отреагируют почти сразу — это разовый скачок, но ожидания могут его подхватить.`, { priority: 7,
        chain: ['НДС ↑', 'Цены ↑ сразу', 'Реальные доходы ↓', 'Спрос ↓', 'База налога ↓'] }) },
    { gap: 1, make: (s) => mkNews('households', `ЦЕНЫ В МАГАЗИНАХ РАСТУТ: ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
      `Реальные зарплаты ${rfs(s.wageGrowth - s.inflation)}%, доверие населения ${Math.round(s.consumerConfidence)}. Косвенный налог всегда платит покупатель.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('gov', `СБОР НАЛОГОВ: ${rf1(s.revenuePctGdp)}% ВВП, ТЕНЕВАЯ ЭКОНОМИКА ${rf1(s.shadowShare)}%`,
      'База реагирует на ставку медленно, но необратимо: часть оборота уходит в тень и обратно возвращается неохотно.', { priority: 6 }) },
  ] },
  social_boost: { id: 'social_boost', title: 'Социальный пакет', steps: [
    { make: (s) => mkNews('gov', 'ПРАВИТЕЛЬСТВО РАСШИРЯЕТ СОЦИАЛЬНЫЕ ВЫПЛАТЫ',
      `Выплаты растут при безработице ${rf1(s.unemployment)}% и разрыве выпуска ${rfs(s.outputGap)}%. Мультипликатор трансфертов тем выше, чем больше в экономике свободных мощностей.`, { priority: 7,
        chain: ['Выплаты ↑', 'Располагаемый доход ↑', 'Потребление ↑', 'Спрос ↑', 'Дефицит ↑'] }) },
    { gap: 1, make: (s) => mkNews('households', `ПОТРЕБЛЕНИЕ РАЗГОНЯЕТСЯ: ${rfs(s.consumptionGrowth)}%`,
      `Доверие населения ${Math.round(s.consumerConfidence)}, реальные доходы ${rfs(s.wageGrowth - s.inflation)}%. Деньги дошли до спроса — вопрос, дойдут ли до выпуска или до цен.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('markets', `СЧЁТ ЗА ЩЕДРОСТЬ: ДЕФИЦИТ ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП, ДОЛГ ${rf1(s.debtToGdp)}%`,
      `Премия за риск ${rf1(s.riskPremium)} п.п., ставка по новому долгу ${rf1(s.effectiveDebtRate)}%. Трансферты почти не повышают потенциал — в отличие от инвестиций.`, { priority: 7 }) },
  ] },
  credit_boom: { id: 'credit_boom', title: 'Кредитный бум', steps: [
    { make: (s) => mkNews('markets', `КРЕДИТНЫЙ БУМ: РАЗРЫВ ${rfs(s.creditGap)} П.П. ВВП`,
      `Портфель растёт на ${rfs(s.creditGrowth)}% при номинальном ВВП заметно медленнее. Пока просрочка низкая — ${rf1(s.bankNPL)}%, но именно так начинаются все банковские кризисы.`, { priority: 7,
        chain: ['Дешёвый кредит', 'Долговая нагрузка ↑', 'Просрочка ↑ через 2–3 года', 'Капитал банков ↓', 'Кредитное сжатие'] }) },
    { gap: 4, make: (s) => mkNews('markets', `НАСЛЕДИЕ БУМА: ПРОСРОЧКА ${rf1(s.bankNPL)}%`,
      `Выданные в лёгкие времена кредиты выходят на просрочку. Достаточность капитала банков ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%.`, { priority: 7 }) },
    { gap: 3, make: (s) => (s.bankCapitalAdequacy < s.capitalRequirement + 1.5
      ? mkNews('crisis', 'БАНКИ УПИРАЮТСЯ В НОРМАТИВ КАПИТАЛА',
        `Капитал ${fmtMoney(s.bankCapital)} больше не позволяет наращивать портфель. Кредитное сжатие ударит по инвестициям, инвестиции — по ВВП, ВВП — снова по просрочке.`, { priority: 9 })
      : mkNews('markets', 'БАНКОВСКАЯ СИСТЕМА ПЕРЕВАРИЛА БУМ',
        `Достаточность капитала ${rf1(s.bankCapitalAdequacy)}% — запас прочности выдержал. Кредитный цикл прошёл без срыва.`, { priority: 5 })) },
  ] },
  debt_spiral: { id: 'debt_spiral', title: 'Долговая спираль', steps: [
    { make: (s) => mkNews('gov', `ГОСДОЛГ ПРЕВЫСИЛ ${Math.round(s.debtToGdp / 5) * 5}% ВВП`,
      `Обслуживание забирает ${rf1(s.interestToRevenue)}% доходов бюджета при ставке ${rf1(s.effectiveDebtRate)}%. Пока номинальный рост экономики выше ставки, долг стабилизируется сам; если нет — начинается спираль.`, { priority: 8,
        chain: ['Долг ↑', 'Премия за риск ↑', 'Ставка по долгу ↑', 'Процентные расходы ↑', 'Дефицит ↑'] }) },
    { gap: 2, make: (s) => mkNews('markets', `ИНВЕСТОРЫ ТРЕБУЮТ ПРЕМИЮ: ${rf1(s.riskPremium)} П.П.`,
      `Каждый новый выпуск дороже предыдущего: средняя ставка по долгу ${rf1(s.effectiveDebtRate)}% против номинального роста ВВП около ${rf1(s.gdpGrowth + s.inflation)}%. Это арифметика, из которой не выйти обещаниями.`, { priority: 8 }) },
  ] },
  credit_crunch: { id: 'credit_crunch', title: 'Кредитное сжатие', steps: [
    { make: (s) => mkNews('crisis', 'КАПИТАЛ БАНКОВ ОГРАНИЧИЛ ВЫДАЧУ КРЕДИТОВ',
      `Достаточность капитала ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%: спрос на кредит есть, предложения нет. Снижение ставки в такой ситуации почти не работает.`, { priority: 9,
        chain: ['Капитал ↓', 'Предложение кредита ↓', 'Инвестиции ↓', 'ВВП ↓', 'Просрочка ↑', 'Капитал ↓'] }) },
    { gap: 2, make: (s) => mkNews('business', `ЭКОНОМИКА БЕЗ КРЕДИТА: ИНВЕСТИЦИИ ${rfs(s.investmentGrowth)}%`,
      `Разрыв выпуска ${rfs(s.outputGap)}%, безработица ${rf1(s.unemployment)}%. Разорвать петлю можно рекапитализацией банков или смягчением норматива — у обоих решений есть цена.`, { priority: 8 }) },
  ] },
  bond_issuance: { id: 'bond_issuance', title: 'Заём про запас', steps: [
    { make: (s) => mkNews('markets', `МИНФИН ЗАНИМАЕТ СВЕРХ НЕОБХОДИМОГО: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Размещение прошло не под дефицит этого квартала, а про запас — рынок это видит и закладывает в цену: премия за риск ${rf1(s.riskPremium)} п.п. Резерв в суверенном фонде вырос, но занять заранее — тоже занять.`,
      { priority: 6, chain: ['Размещение сверх дефицита', 'Долг ↑ сразу', 'Премия за риск ↑', 'Резерв в фонде ↑', 'Доступен без нового займа позже'] }) },
    { gap: 2, make: (s) => (s.sovereignFund > 1
      ? mkNews('gov', `СУВЕРЕННЫЙ ФОНД: ${fmtMoney(s.sovereignFund)} В РЕЗЕРВЕ`,
        `Отложенное про запас разместилось не в расходы, а в фонд. Обслуживание долга при этом уже обходится в ${rf1(s.interestToRevenue)}% доходов бюджета — резерв не бесплатен, он занят заранее.`, { priority: 5 })
      : mkNews('markets', 'РЕЗЕРВ УЖЕ РАЗОШЁЛСЯ НА ДЕФИЦИТ',
        `Фонд, пополненный про запас, снова пуст — дефицит следующих кварталов забрал его раньше, чем он успел пригодиться при более выгодных условиях займа.`, { priority: 5 })) },
  ] },
  cds_spike: { id: 'cds_spike', title: 'Ставка против суверена', steps: [
    { make: (s) => mkNews('markets', `СВОП НА ДЕФОЛТ (CDS) ПОДСКОЧИЛ ДО ${Math.round(s.sovereignSpread)} Б.П.`,
      `Инструмент, который прежде почти не двигался, за квартал резко переоценил риск: премия за риск ${rf1(s.riskPremium)} п.п. Это не абстрактная цифра из сводки, а ставка, которую можно купить или продать прямо в трейдерском терминале, — и рынок свопов уже сделал свою.`,
      { priority: 8, chain: ['Скачок спреда', 'CDS дорожает', 'Рынок закладывает риск дефолта', 'Занимать дороже для всех'] }) },
    { gap: 2, make: (s) => (s.sovereignSpread > 250
      ? mkNews('markets', `ПРЕМИЯ ЗА ДЕФОЛТ ОСТАЁТСЯ ВЫСОКОЙ: ${Math.round(s.sovereignSpread)} Б.П.`,
        `Рынок CDS не разворачивается — устойчиво повышенная премия означает, что инвесторы всё ещё считают риск дефолта реальным, а не разовой паникой. Каждый новый выпуск долга занимает по этой цене.`, { priority: 6 })
      : mkNews('markets', 'ПРЕМИЯ ЗА ДЕФОЛТ ОТКАТИЛАСЬ',
        `Своп на дефолт подешевел обратно — рынок решил, что скачок был паникой, а не переоценкой фундаментальных рисков. Доверие к платёжеспособности страны восстановилось быстрее, чем сам долг.`, { priority: 5 })) },
  ] },
};

/* Взаимоисключающие сюжеты. Игрок видел в одной ленте «Падение сырьевых цен,
   часть 4 из 5» и «Сырьевой рост, часть 2 из 3» — мировая цена не может
   одновременно падать и расти, и обе новости объясняли курс противоположными
   причинами. Пока идёт один сюжет пары, встречный не начинается. */
const STORY_CONFLICTS = {
  commodity_down: ['oil_up'], oil_up: ['commodity_down'],
  credit_boom: ['credit_crunch'], credit_crunch: ['credit_boom'],
  rate_hike: ['rate_cut'], rate_cut: ['rate_hike'],
};
const storyConflicts = (id, active) => (STORY_CONFLICTS[id] || [])
  .some((other) => (active || []).some((x) => x.tplId === other));

// пауза перед первым шагом сюжета: у части сюжетов первое сообщение — это уже
// следствие, и печатать его в тот же квартал, что и само решение, рано
const storyStartWait = (id) => {
  const tpl = STORY_TEMPLATES[id];
  return tpl && tpl.steps.length ? Math.max(0, (tpl.steps[0].gap || 1) - 1) : 0;
};

function advanceStories(stories, next, quarterIndex) {
  const out = []; const keep = [];
  for (const st of (stories || [])) {
    const tpl = STORY_TEMPLATES[st.tplId];
    if (!tpl) continue;
    if (st.wait > 0) { keep.push({ ...st, wait: st.wait - 1 }); continue; }
    const step = tpl.steps[st.nextIdx];
    if (!step) continue;
    const item = step.make(next);
    if (item) out.push({ ...item, q: quarterIndex, storyId: tpl.id, storyTitle: tpl.title, step: st.nextIdx + 1, steps: tpl.steps.length });
    const nextIdx = st.nextIdx + 1;
    if (nextIdx < tpl.steps.length) keep.push({ tplId: st.tplId, nextIdx, wait: (tpl.steps[nextIdx].gap || 1) - 1 });
  }
  return { news: out, stories: keep };
}

/* Что запускает новый сюжет: решения игрока и накопленные состояния */
function storyTriggers(prev, next, decisions, active, cooldowns) {
  const fire = [];
  const busy = (id) => active.some((x) => x.tplId === id) || (cooldowns[`story:${id}`] || 0) > 0
    || storyConflicts(id, active);
  const dRate = decisions.keyRate - prev.keyRate;
  if (dRate >= 0.75 && !busy('rate_hike')) fire.push('rate_hike');
  if (dRate <= -0.75 && !busy('rate_cut')) fire.push('rate_cut');
  if (decisions.vatRate - prev.vatRate >= 0.5 && !busy('vat_hike')) fire.push('vat_hike');
  if (decisions.transfers >= 3 && prev.transfersGrowth < next.transfersGrowth && !busy('social_boost')) fire.push('social_boost');
  if (next.creditGap > 5.5 && !busy('credit_boom')) fire.push('credit_boom');
  if (next.creditCrunch && !prev.creditCrunch && !busy('credit_crunch')) fire.push('credit_crunch');
  // раньше «Долговая спираль» объясняла разгон долга только выше 80% ВВП — а
  // разрыв «ставка минус рост», из-за которого долг растёт даже при
  // консолидации Минфина, реально кусается и при более скромном долге:
  // вторая ветка ловит это раньше, не дожидаясь, пока цифра станет пугающей
  const debtGrowthGap = next.effectiveDebtRate - next.gdpGrowth - next.inflation;
  if (!busy('debt_spiral') && ((next.debtToGdp > 80 && Math.floor(next.debtToGdp / 10) > Math.floor(prev.debtToGdp / 10))
    || (next.debtToGdp > 50 && next.debtToGdp > prev.debtToGdp + 0.1 && debtGrowthGap > 3))) fire.push('debt_spiral');
  // порог в % ВВП, а не в абсолютных млрд — иначе в разросшейся вдвое экономике
  // тот же сюжет либо запускался бы от любого чиха, либо не запускался вовсе
  if ((decisions.bondIssuance || 0) / Math.max(1, next.nominalGdp) * 100 >= 0.5 && !busy('bond_issuance')) fire.push('bond_issuance');
  // резкий скачок CDS-спреда — отдельное событие от общего «долг дорожает»
  // (та новость про обслуживание долга остаётся, но она про бюджет; здесь —
  // про то, что рынок деривативов уже поставил на дефолт, а инструмент для
  // этого лежит прямо в трейдерском терминале)
  if (!busy('cds_spike') && next.sovereignSpread > 250 && next.sovereignSpread - (prev.sovereignSpread || 0) > 45) fire.push('cds_spike');
  return fire;
}

/* ----------------------- ЕЖЕКВАРТАЛЬНАЯ ЛЕНТА ----------------------- */
function generateNews(prev, s, decisions, quarterIndex, botAction, cd, extraActions, publicMode) {
  const out = [];
  const push = (cat, headline, text, priority, chain) => out.push({ ...mkNews(cat, headline, text, { priority, chain }), q: quarterIndex });
  // одна и та же тема не повторяется каждый квартал
  const once = (key, gap) => { if ((cd[`news:${key}`] || 0) > 0) return false; cd[`news:${key}`] = gap; return true; };
  const tgt = Number.isFinite(s.inflationTarget) ? s.inflationTarget : CONFIG.target.inflation;

  /* Решение второй ветви власти. Печатается ПЕРЕД блоком ЦБ намеренно: ниже нужно
     знать, попала ли сводка ведомства в ленту. Если попала — общая новость о шаге
     ставки будет тем же фактом второй раз подряд, только с другими цифрами
     инфляции (до и после квартала); если нет (сводка повторяет прошлый курс и
     придержана) — общая новость остаётся единственной, и без неё изменение ставки
     вообще пропало бы из ленты. Порядок в ленте задаётся приоритетом, а не местом
     в коде, так что перестановка ничего не ломает. */
  let cbReported = false;
  const actions = [botAction, ...(extraActions || [])].filter(Boolean);
  // раньше сюда же подмешивался периодический «отчёт о том, что ничего не
  // изменилось» раз в 8 кварталов (once(`bot${ix}`, 8)) — без реального повода
  // это читалось как «зачем вообще об этом писать»; сводка ведомства теперь
  // попадает в ленту, только когда курс или требование правда изменились
  actions.forEach((act) => {
    const isCb = act.institution === 'cb';
    const changedCourse = (isCb ? prev.botHeadline : prev.botHeadline2) !== act.headline;
    const newDemand = act.demand && (isCb ? prev.botDemand : prev.botDemand2) !== act.demand;
    if (changedCourse || newDemand) {
      if (isCb) cbReported = true;
      if (publicMode) {
        push(isCb ? 'cb' : 'gov', act.publicHeadline || act.newsHeadline,
          `${act.publicNote || ''}${act.quote ? ` Из заявления по итогам решения: «${act.quote}»` : ''}`, 7);
      } else {
        push(isCb ? 'cb' : 'gov', act.newsHeadline,
          `${act.newsNote || act.note}${act.quote ? ` Из заявления по итогам решения: «${act.quote}»` : ''}${act.demand ? ` ${act.demand}` : ''}`,
          changedCourse || newDemand ? 8 : 5);
      }
    }
  });

  /* 🏦 ЦЕНТРАЛЬНЫЙ БАНК */
  /* Решение по ставке описывает ЛИБО сводка ведомства (у неё есть и цитата, и
     требование к соседу), ЛИБО — если такой сводки нет, то есть ставку двигал сам
     игрок, — общая новость о шаге. Раньше в ленте стояли обе: «ЦБ ПОВЫШАЕТ СТАВКУ
     ДО 8,75%» и следом «ЦБ УЖЕСТОЧАЕТ ПОЛИТИКУ: СТАВКА 8,75%», да ещё и с разными
     цифрами инфляции — до и после квартала. */
  const dRate = s.keyRate - prev.keyRate;
  if (!cbReported) {
    // верхней границы у шага больше нет: раньше крупное движение (больше 0,75 п.п.)
    // намеренно уступало место сводке ЦБ, а теперь сводка и так печатается отдельно —
    // и без этого условия резкий разворот ставки просто пропадал из ленты
    if (Math.abs(dRate) > 0.01) {
      push('cb', `${dRate > 0 ? 'ЦБ ПОВЫШАЕТ' : 'ЦБ СНИЖАЕТ'} КЛЮЧЕВУЮ СТАВКУ ДО ${rf2(s.keyRate)}%`,
        `Шаг ${rfs2(dRate)} п.п. при инфляции ${rf1(s.inflation)}% и цели ${rf1(tgt)}%. Реальная ставка ${rfs(s.realPolicyRate)}% против нейтральной ${rf1(s.rStar)}% — условия ${s.rateGap > 0.3 ? 'жёстче нейтральных' : s.rateGap < -0.3 ? 'мягче нейтральных' : 'близки к нейтральным'}.`, 6);
    } else if (Math.abs(dRate) < 0.01 && Math.abs(s.inflation - tgt) > 2 && once('hold', 4)) {
      push('cb', `ЦБ СОХРАНЯЕТ СТАВКУ ${rf2(s.keyRate)}% ПРИ ИНФЛЯЦИИ ${rf1(s.inflation)}%`,
        `Бездействие — тоже решение. Ожидания ${rf1(s.inflationExpectations)}%, доверие к ЦБ ${Math.round(s.cbCredibility)} из 100.`, 5);
    }
  }
  const dTarget = tgt - (Number.isFinite(prev.inflationTarget) ? prev.inflationTarget : CONFIG.target.inflation);
  if (Math.abs(dTarget) > 0.01) {
    push('cb', `ЦБ ${dTarget > 0 ? 'ПОВЫШАЕТ' : 'СНИЖАЕТ'} ЦЕЛЬ ПО ИНФЛЯЦИИ ДО ${rf2(tgt)}%`,
      `Смена цели — не бухгалтерская правка, а заявление о намерениях. Доверие к ЦБ ${Math.round(s.cbCredibility)}: ожидания будут привыкать к новой цифре не один квартал, а пока они плавают, любое решение по ставке работает хуже.`, 9,
      ['Смена цели', 'Доверие ↓', 'Ожидания плывут', 'Цена управления инфляцией ↑']);
  }
  if (decisions.fxRegime !== 'free' && Math.abs((decisions.fxTarget || 0) - (prev.fxTarget || 0)) > 0.5) {
    push('cb', `ЦБ ОБЪЯВЛЯЕТ НОВЫЙ ОРИЕНТИР КУРСА: ${rf1(decisions.fxTarget)}`,
      `Защита ориентира оплачивается резервами: сейчас ${fmtMoney(s.reserves)}, расход на удержание курса ${fmtMoneySigned(s.defenseIntervention || 0)} в год.`, 8);
  }
  if (decisions.emergency) {
    push('cb', 'ЦБ ЗАПУСКАЕТ ЭКСТРЕННУЮ ПОДДЕРЖКУ БАНКОВ',
      `Капитал банковской системы пополнен, ликвидность восстановлена до ${Math.round(s.bankLiquidity)}. Плата — денежная эмиссия, инфляционный след и −доверие к ЦБ.`, 9,
      ['Экстренная помощь', 'Капитал банков ↑', 'Денежная масса ↑', 'Инфляция ↑', 'Доверие к ЦБ ↓']);
  }
  if (s.cbCredibility < 40 && prev.cbCredibility >= 40) {
    push('cb', `ДОВЕРИЕ К ЦБ ПАДАЕТ ДО ${Math.round(s.cbCredibility)}: ОЖИДАНИЯ СРЫВАЮТСЯ С ЯКОРЯ`,
      `Инфляционные ожидания ${rf1(s.inflationExpectations)}% вместо цели ${rf1(tgt)}%. Теперь любое снижение инфляции потребует большего падения выпуска, чем раньше.`, 9,
      ['Доверие ↓', 'Ожидания ↑', 'Кривая Филлипса хуже', 'Цена дезинфляции ↑']);
  }
  if (Math.abs(decisions.moneySupplyOp || 0) > 0.5 && once('qe', 2)) {
    push('cb', `ЦБ ${decisions.moneySupplyOp > 0 ? 'ВЫКУПАЕТ АКТИВЫ' : 'ИЗЫМАЕТ ЛИКВИДНОСТЬ'}: ${rfs(decisions.moneySupplyOp)}% ДЕНЕЖНОЙ МАССЫ`,
      `Нестандартные операции при ставке ${rf2(s.keyRate)}%. Эффект на спрос быстрый, на цены — отложенный.`, 6);
  }
  if (decisions.fxRegime !== prev.fxRegime) {
    push('cb', `СМЕНА ВАЛЮТНОГО РЕЖИМА: ${decisions.fxRegime === 'free' ? 'СВОБОДНОЕ ПЛАВАНИЕ' : decisions.fxRegime === 'managed' ? 'УПРАВЛЯЕМЫЙ КУРС' : 'ФИКСИРОВАННЫЙ КУРС'}`,
      `Резервы ${fmtMoney(s.reserves)}. Фиксировать курс значит обменивать инфляцию на резервы — пока резервы есть.`, 8);
  }

  /* 🏛 ПРАВИТЕЛЬСТВО */
  const taxChanges = [
    ['vatRate', 'НДС'], ['incomeTaxRate', 'ПОДОХОДНЫЙ НАЛОГ'], ['profitTaxRate', 'НАЛОГ НА ПРИБЫЛЬ'],
    ['exciseRate', 'АКЦИЗЫ'], ['capitalTaxRate', 'НАЛОГ НА КАПИТАЛ'], ['socialContribRate', 'СОЦИАЛЬНЫЕ ВЗНОСЫ'],
  ];
  taxChanges.forEach(([key, label]) => {
    const dv = s[key] - prev[key];
    if (key === 'vatRate' && dv >= 0.5) return;   // о повышении НДС рассказывает отдельный сюжет
    if (Math.abs(dv) > 0.01) {
      push('gov', `${label} ${dv > 0 ? 'ПОВЫШЕН' : 'СНИЖЕН'} ДО ${rf1(s[key])}%`,
        `Доходы бюджета ${rf1(s.revenuePctGdp)}% ВВП, теневая экономика ${rf1(s.shadowShare)}%. ${dv > 0 ? 'Ставка растёт быстрее, чем доходы: часть базы уходит из-под налога.' : 'Выпадающие доходы придётся компенсировать — займами или расходами.'}`, 6,
        dv > 0 ? ['Ставка ↑', 'Собираемость ↓', 'Теневая экономика ↑', 'База ↓', 'Доходы ↑ слабее ожидаемого'] : null);
    }
  });
  if (Math.abs(s.fiscalImpulse) > 0.35 && once('fiscalImpulse', 4)) {
    push('gov', `БЮДЖЕТНЫЙ ИМПУЛЬС ${rfs(s.fiscalImpulse)} П.П. ВВП`,
      `Мультипликатор сейчас ${s.outputGap < -1 ? 'высокий: свободные мощности превращают расходы в выпуск' : 'низкий: экономика близка к пределу, деньги уходят в цены'}. Дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП.`, 6);
  }
  if (s.interestToRevenue > 15 && prev.interestToRevenue <= 15) {
    push('gov', `ОБСЛУЖИВАНИЕ ДОЛГА ЗАБИРАЕТ ${rf1(s.interestToRevenue)}% ДОХОДОВ БЮДЖЕТА`,
      'Проценты вытесняют из бюджета всё остальное — прежде всего инвестиции и образование, то есть будущий рост.', 8);
  }
  const dSci = s.budgetShares.science - prev.budgetShares.science;
  const dEdu = s.budgetShares.education - prev.budgetShares.education;
  if ((Math.abs(dSci) > 0.4 || Math.abs(dEdu) > 0.4) && once('shares', 8)) {
    push('gov', `ПРИОРИТЕТЫ БЮДЖЕТА МЕНЯЮТСЯ: НАУКА ${rf1(s.budgetShares.science)}%, ОБРАЗОВАНИЕ ${rf1(s.budgetShares.education)}%`,
      `Эти статьи не дают эффекта в этом квартале. Они меняют производительность и человеческий капитал — потенциальный рост сейчас ${rf1(s.potentialGrowth)}%.`, 5,
      ['Наука и образование', 'Человеческий капитал ↑', 'Производительность ↑', 'Потенциальный ВВП ↑ через годы']);
  }

  /* 📊 РЫНКИ */
  if (Math.abs(s.fxDeprAnnual) > 6 && once('fx', 3)) {
    push('markets', `ВАЛЮТА ${s.fxDeprAnnual > 0 ? 'ПАДАЕТ' : 'УКРЕПЛЯЕТСЯ'}: ${rfs(s.fxDeprAnnual)}% В ГОДОВОМ ВЫРАЖЕНИИ`,
      `Текущий счёт ${fmtMoneySigned(s.currentAccount)}, приток капитала ${fmtMoneySigned(s.netCapitalFlow)}, резервы ${fmtMoney(s.reserves)}. Перенос курса в цены импорта: ${rf1(s.importPriceInflation)}%.`, 7,
      s.fxDeprAnnual > 0 ? ['Отток валюты', 'Курс ↓', 'Импорт дорожает', 'Инфляция ↑', 'Реальные доходы ↓'] : null);
  }
  if (s.riskPremium - prev.riskPremium > 0.35 && once('risk', 5)) {
    push('markets', `ПРЕМИЯ ЗА СТРАНОВОЙ РИСК РАСТЁТ ДО ${rf1(s.riskPremium)} П.П.`,
      `Инвесторы закладывают долг ${rf1(s.debtToGdp)}% ВВП, банковский риск ${Math.round(s.bankingRisk)} и согласованность политики ${Math.round(s.policyCoordination)} из 100. Дороже становится всё: госдолг, кредит, капитал.`, 7);
  }
  if (s.reserves < 150 && prev.reserves >= 150) {
    push('markets', `РЕЗЕРВЫ СОКРАТИЛИСЬ ДО ${fmtMoney(s.reserves)}`,
      'Запас прочности для защиты курса тает. Если режим не свободный, рынок начнёт проверять его на прочность.', 8);
  }
  if (s.bankNPL > 7 && s.bankNPL - prev.bankNPL > 0.25 && once('npl', 4)) {
    push('markets', `ПРОСРОЧКА В БАНКАХ ДОСТИГЛА ${rf1(s.bankNPL)}%`,
      `Убытки съедают капитал: достаточность ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%. Прибыль сектора ${fmtMoneySigned(s.bankProfit)} за квартал.`, 8,
      ['Просрочка ↑', 'Убытки ↑', 'Капитал ↓', 'Кредитование ↓', 'ВВП ↓', 'Просрочка ↑']);
  }

  /* 🏭 БИЗНЕС */
  if (s.investmentGrowth < -3 && prev.investmentGrowth >= -3 && once('inv', 5)) {
    push('business', `ИНВЕСТИЦИИ ПАДАЮТ НА ${rf1(Math.abs(s.investmentGrowth))}%`,
      `Реальная ставка по кредитам ${rf1(s.realLendingRate)}% против нейтральных ${rf1(s.rStar + 2)}%. Сокращение инвестиций сегодня — это меньший капитал и меньший потенциал завтра.`, 7);
  }
  if (s.businessConfidence < 40 && prev.businessConfidence >= 40) {
    push('business', `ДЕЛОВЫЕ НАСТРОЕНИЯ УХУДШАЮТСЯ: ИНДЕКС ${Math.round(s.businessConfidence)}`,
      `Компании откладывают найм и инвестиции. Разрыв выпуска ${rfs(s.outputGap)}%, банковский риск ${Math.round(s.bankingRisk)}.`, 6);
  }
  if (s.tfpGrowth > prev.tfpGrowth + 0.15 && once('tfp', 6)) {
    push('business', `ПРОИЗВОДИТЕЛЬНОСТЬ УСКОРЯЕТСЯ: ${rf1(s.tfpGrowth)}% В ГОД`,
      `Индекс TFP ${rf1(s.productivity)}, инфраструктура ${rf1(s.infrastructureIndex)}. Единственный источник роста, который не оплачивается инфляцией.`, 5);
  }

  /* 👥 НАСЕЛЕНИЕ */
  const realWage = s.wageGrowth - s.inflation;
  const prevRealWage = prev.wageGrowth - prev.inflation;
  if (realWage < 0 && prevRealWage >= 0) {
    push('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ ПЕРЕШЛИ К ПАДЕНИЮ: ${rfs(realWage)}%`,
      `Номинальный рост ${rf1(s.wageGrowth)}% не поспевает за инфляцией ${rf1(s.inflation)}%. Дальше — слабое потребление и требования индексации.`, 7,
      ['Инфляция ↑', 'Реальные доходы ↓', 'Потребление ↓', 'Спрос ↓']);
  } else if (realWage > 3 && prevRealWage <= 3) {
    push('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rf1(realWage)}%`,
      `При напряжённости рынка труда ${rfs(s.tightness)} п.п. и производительности ${rf1(s.tfpGrowth)}% рост зарплат ${realWage > s.tfpGrowth + 1.5 ? 'опережает производительность — это будущая инфляция издержек' : 'обеспечен производительностью'}.`, 6);
  }
  if (s.unemployment - prev.unemployment > 0.35 && once('unemp', 4)) {
    push('households', `БЕЗРАБОТИЦА РАСТЁТ ДО ${rf1(s.unemployment)}%`,
      `Естественный уровень ${rf1(s.nairu)}% — разрыв ${rfs(s.unemployment - s.nairu)} п.п. Долгая безработица поднимает и сам естественный уровень: часть потерь станет необратимой.`, 7);
  }
  if (s.tightness > 1.2 && prev.tightness <= 1.2) {
    push('households', `ДЕФИЦИТ РАБОТНИКОВ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}% НИЖЕ ЕСТЕСТВЕННОЙ`,
      `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты ускоряются до ${rf1(s.wageGrowth)}%. Низкая безработица не бесплатна: удельные издержки труда ${rf1(s.unitLaborCostGrowth)}% переходят в цены.`, 7,
      ['Безработица ↓', 'Дефицит кадров', 'Зарплаты ↑', 'Издержки ↑', 'Инфляция ↑', 'Ставка ↑']);
  }
  if (s.consumerConfidence < 35 && prev.consumerConfidence >= 35) {
    push('households', `ПОТРЕБИТЕЛЬСКИЕ НАСТРОЕНИЯ НА МИНИМУМЕ: ${Math.round(s.consumerConfidence)}`,
      'Домохозяйства переходят к сберегательной модели. Спрос будет слабым даже при снижении ставки.', 6);
  }

  /* 🌍 МИР */
  if (Math.abs(s.worldGdpGrowth - prev.worldGdpGrowth) > 0.5 && once('world', 5)) {
    push('world', `МИРОВАЯ ЭКОНОМИКА ${s.worldGdpGrowth > prev.worldGdpGrowth ? 'УСКОРЯЕТСЯ' : 'ЗАМЕДЛЯЕТСЯ'}: ${rf1(s.worldGdpGrowth)}%`,
      `Внешний спрос — это ваш экспорт ${fmtMoney(s.exports)}. Индекс мирового спроса ${rf1(s.worldDemandIndex)}.`, 5);
  }
  if (Math.abs(s.commodityIndex - prev.commodityIndex) > 6 && once('comm', 4)) {
    push('world', `СЫРЬЕВОЙ ИНДЕКС ${s.commodityIndex > prev.commodityIndex ? 'РАСТЁТ' : 'ПАДАЕТ'} ДО ${rf1(s.commodityIndex)}`,
      `Торговый баланс ${fmtMoneySigned(s.tradeBalance)}: страна ${s.tradeBalance >= 0 ? 'выигрывает от дорогого сырья' : 'платит за него'}.`, 5);
  }

  /* ⚠️ КРИЗИС / РЕЖИМ
     Вход в любой кризисный режим уже объявлен ниже, в переходах activeCrises,
     своим более конкретным текстом — а для пандемии и случайно начавшейся войны
     ещё и сюжетной цепочкой с первым эпизодом день в день. Раньше этот общий
     переход дублировал их слово в слово, и игрок получал по три новости об
     одном и том же событии за один квартал. Выход из войны и пандемии тоже
     объявлен отдельно и точнее (санкции снимутся не сразу, помощь союзников
     свернётся и т.д.). Единственный случай, для которого объявлять больше
     нечему, — возврат к норме из порогового режима (рецессия, перегрев,
     дефляция, стагфляция, банковский/долговой/валютный кризис): для них нет
     отдельного текста о выходе. */
  if (s.regime === 'normal' && prev.regime !== 'normal' && prev.regime !== 'war' && prev.regime !== 'pandemic') {
    const info = REGIME_INFO.normal;
    push('crisis', `ЭКОНОМИКА ВОЗВРАЩАЕТСЯ В НОРМАЛЬНЫЙ РЕЖИМ`, regimeInfoText(info, s), 6);
  }

  /* 📊 РЫНОК */
  if (s.stockReturn < -9 && once('crash', 3)) {
    push('markets', `ОБВАЛ НА ФОНДОВОМ РЫНКЕ: ИНДЕКС ${rf1(s.stockReturn)}%`,
      `Индекс опустился до ${rf1(s.stockIndex)}, капитализация ${rf1(s.marketCapPctGdp)}% ВВП. Ставка дисконтирования выросла до ${rf1(s.discountRate)}% — рынок пересчитал будущие прибыли по новой цене денег. Индекс страха ${rf1(s.volatilityIndex)}.`, 8,
      ['Ставка ↑ / риск ↑', 'Дисконт ↑', 'Оценка активов ↓', 'Капитализация ↓', 'Богатство и залоги ↓']);
  } else if (s.stockReturn > 9 && once('rally', 4)) {
    push('markets', `РАЛЛИ НА РЫНКЕ АКЦИЙ: ИНДЕКС ${rfs(s.stockReturn)}%`,
      `Капитализация выросла до ${rf1(s.marketCapPctGdp)}% ВВП при P/E ${rf1(s.stockPE)}. Дешёвые деньги поднимают цены активов быстрее, чем прибыли — именно так надуваются пузыри, которые потом приходится разбирать ставкой.`, 6);
  }
  const SECTORS = [['sectorBanks', 'БАНКОВСКИЙ', 'банки живут маржой и качеством портфеля'],
    ['sectorIndustry', 'ПРОМЫШЛЕННЫЙ', 'промышленность зависит от инвестиционного цикла и стоимости денег'],
    ['sectorConsumer', 'ПОТРЕБИТЕЛЬСКИЙ', 'потребительский сектор следует за реальными доходами'],
    ['sectorResources', 'СЫРЬЕВОЙ', 'сырьевой сектор торгует мировыми ценами и курсом'],
    ['reitIndex', 'НЕДВИЖИМОСТЬ', 'недвижимость переоценивается вслед за ставкой по кредитам']];
  let bestSec = null;
  SECTORS.forEach(([key, label, why]) => {
    if (!prev[key] || !s[key]) return;
    const r = (s[key] / prev[key] - 1) * 100;
    const rel = r - s.stockReturn;
    if (!bestSec || Math.abs(rel) > Math.abs(bestSec.rel)) bestSec = { key, label, why, r, rel };
  });
  if (bestSec && Math.abs(bestSec.rel) > 4.5 && once('sector', 3)) {
    push('markets', `${bestSec.label} СЕКТОР ${bestSec.r >= 0 ? 'ВЫРОС' : 'УПАЛ'} НА ${rf1(Math.abs(bestSec.r))}% — ${bestSec.rel >= 0 ? 'ЛУЧШЕ' : 'ХУЖЕ'} РЫНКА НА ${rf1(Math.abs(bestSec.rel))} П.П.`,
      `Рынок целиком ${rfs(s.stockReturn)}%, но ${bestSec.why}. Расхождение секторов — это подсказка о том, какой канал политики работает прямо сейчас.`, 7);
  }
  if (s.curveInverted && !prev.curveInverted && once('invert', 6)) {
    push('markets', `КРИВАЯ ДОХОДНОСТИ ИНВЕРТИРОВАЛАСЬ: ${rf1(s.curveSlope)} П.П.`,
      `Короткие ставки ${rf1(s.yield3m)}% выше длинных ${rf1(s.yield10y)}%. Рынок фактически говорит: нынешняя жёсткость сломает спрос, и ставку придётся снижать. Исторически это лучший из ранних сигналов рецессии.`, 8,
      ['Ставка ↑', 'Ожидания снижения', 'Инверсия кривой', 'Рецессия через 3–6 кв.']);
  }
  if (s.sovereignSpread > 400 && s.sovereignSpread - (prev.sovereignSpread || 0) > 60 && once('spread', 4)) {
    push('markets', `СУВЕРЕННЫЙ СПРЕД РАСШИРИЛСЯ ДО ${Math.round(s.sovereignSpread)} Б.П.`,
      `Занимать становится дорого: доходность 10 лет ${rf1(s.yield10y)}% при долге ${rf1(s.debtToGdp)}% ВВП. Корпоративный спред ${Math.round(s.corporateSpread)} б.п. — стоимость денег растёт для всех, а не только для бюджета.`, 8);
  }
  if (s.bankPB < 0.35 && once('bankpb', 6)) {
    push('markets', `РЫНОК ОЦЕНИВАЕТ БАНКИ ДЕШЕВЛЕ ИХ КАПИТАЛА: P/B ${rf2(s.bankPB)}`,
      `Инвесторы не верят в отчётный капитал: просрочка ${rf1(s.bankNPL)}%, рентабельность ${rf1(s.bankROE)}%. Привлечь новый капитал с рынка в таком состоянии почти невозможно — а именно он ограничивает кредитование.`, 8,
      ['Просрочка ↑', 'Прибыль ↓', 'Оценка банков ↓', 'Капитал не привлечь', 'Кредит ↓']);
  }

  /* 💬 ГОЛОСА: субъективные реакции людей на то, что происходит */
  const realW = s.wageGrowth - s.inflation;
  const VOICES = [
    { id: 'pensioner_infl', p: 8, when: () => s.inflation > 7,
      q: '«Я перестала смотреть на ценники — всё равно они другие каждую неделю»',
      who: 'Тамара Николаевна, 68 лет, получатель социальных выплат',
      t: () => `Инфляция ${rf1(s.inflation)}% при индексации выплат, отстающей от цен. Для людей с фиксированным доходом инфляция — это не показатель, а прямой вычет из тарелки.` },
    { id: 'mortgage', p: 7, when: () => s.lendingRate > 11,
      q: '«Ставка по кредиту такая, что мы просто отложили покупку квартиры»',
      who: 'Артём и Лена, семья из областного центра',
      t: () => `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(s.inflation)}%. Жёсткая политика работает именно так: сначала отменяются чужие планы, и только потом замедляются цены.` },
    { id: 'smb', p: 7, when: () => s.rateGap > 1.2 || s.creditCrunch,
      q: '«Банк не отказал напрямую — просто перестал отвечать»',
      who: 'Игорь, владелец мебельного производства, 40 сотрудников',
      t: () => `${s.creditCrunch ? 'Капитал банков упёрся в норматив' : 'Кредит подорожал'}: рост портфеля ${rfs(s.creditGrowth)}%. Малый бизнес чувствует денежную политику раньше статистики.` },
    { id: 'worker', p: 8, when: () => s.unemployment > s.nairu + 1.2,
      q: '«На заводе третий месяц неполная неделя»',
      who: 'Сергей, оператор линии',
      t: () => `Безработица ${rf1(s.unemployment)}% против естественных ${rf1(s.nairu)}%. За разрывом выпуска ${rfs(s.outputGap)}% стоят конкретные смены, которых больше нет.` },
    { id: 'hr', p: 6, when: () => s.tightness > 1.0,
      q: '«Мы поднимаем зарплату дважды в год и всё равно не закрываем вакансии»',
      who: 'Марина, директор по персоналу в логистике',
      t: () => `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты растут на ${rf1(s.wageGrowth)}%. Дефицит кадров приятен для работника и тяжёл для цен.` },
    { id: 'trader', p: 6, when: () => Math.abs(s.fxDeprAnnual) > 7 || s.riskPremium > 3,
      q: '«Рынок торгует не вашей статистикой, а доверием к ней»',
      who: 'Дмитрий, управляющий портфелем',
      t: () => `Премия за риск ${rf1(s.riskPremium)} п.п., курс ${rfs(s.fxDeprAnnual)}% годовых. Резервы ${fmtMoney(s.reserves)} — цифра, которую считают все, кто решает, оставаться ли в стране.` },
    { id: 'foreign_aid', p: 9, when: () => (s.warQuartersLeft || 0) > 0 && s.warType === 'defensive',
      q: '«Кредитная линия союзников пришла быстрее, чем собственный бюджетный перевод»',
      who: 'Представитель профильного ведомства',
      t: () => `Оборонительная война вызывает сочувствие союзников: чистый приток капитала ${fmtMoney(s.netCapitalFlow)}, резервы ${fmtMoney(s.reserves)}. Опираться на чужую щедрость долго нельзя — но пока она держит платёжный баланс.` },
    { id: 'sanctions_exporter', p: 9, when: () => (s.warQuartersLeft || 0) > 0 && s.warType === 'offensive',
      q: '«Полгода назад у нас были контракты на три года вперёд, теперь — ни одного»',
      who: 'Экспортёр промышленного оборудования',
      t: () => `Наступательная война обернулась санкциями: торговый баланс ${fmtMoney(s.tradeBalance)}, премия за риск ${rf1(s.riskPremium)} п.п. Рынки закрываются быстрее, чем открываются новые.` },
    { id: 'econ_hawk', p: 7, when: () => s.inflationExpectations > tgt + 2,
      q: '«Проблема уже не в ценах, а в том, что в цель никто не верит»',
      who: 'Ольга Р., экономист, колонка в деловом еженедельнике',
      t: () => `Ожидания ${rf1(s.inflationExpectations)}% при цели ${rf1(tgt)}%. Заякоренные ожидания — это бесплатный инструмент, а разъякоренные приходится выкупать безработицей.` },
    // «держать жёсткие условия» — упрёк, который имеет смысл, только если условия
    // и правда жёстче нейтральных (s.rateGap > 0.3, тот же порог, что и в остальной
    // ленте): без этого экономист критиковал бы жёсткость на фоне уже смягчённой
    // ставки, а дашборд рядом показывал бы «мягче нейтральных» — прямое противоречие
    { id: 'econ_dove', p: 6, when: () => s.outputGap < -2.5 && s.inflation < tgt + 1 && s.rateGap > 0.3,
      q: '«Мы лечим болезнь, которой нет, и получаем ту, что есть»',
      who: 'Павел К., профессор макроэкономики',
      t: () => `Разрыв выпуска ${rfs(s.outputGap)}% при инфляции ${rf1(s.inflation)}%. Держать жёсткие условия, когда спрос и так слаб, — значит превращать циклическую безработицу в структурную.` },
    { id: 'union', p: 7, when: () => realW < -1,
      q: '«Индексация ниже инфляции — это не повышение, это торг о размере потери»',
      who: 'Представитель профсоюза работников транспорта',
      t: () => `Реальные зарплаты ${rfs(realW)}% при росте номинальных ${rf1(s.wageGrowth)}%. Требования индексации — следующий пункт повестки, а за ними инфляция издержек.` },
    { id: 'biz_tax', p: 7, when: () => s.taxWedgeValue > 42 || s.shadowShare > 20,
      q: '«Половина знакомых перешла на серые схемы — не от жадности, а от арифметики»',
      who: 'Анна, бухгалтер, ведёт два десятка ИП',
      t: () => `Теневая экономика ${rf1(s.shadowShare)}% при налоговом клине ${rf1(s.taxWedgeValue)}. База уходит тихо и возвращается неохотно — даже если ставки потом снизить.` },
    { id: 'depositor', p: 9, when: () => s.bankingRisk > 60,
      q: '«В очереди у банкомата стояли люди, которые никогда там не стояли»',
      who: 'Наблюдение корреспондента в областном центре',
      t: () => `Банковский риск ${Math.round(s.bankingRisk)} из 100, ликвидность ${Math.round(s.bankLiquidity)}. Паника — единственный экономический процесс, который разгоняет сам себя быстрее, чем кто-либо успевает среагировать.` },
    { id: 'optimist', p: 5, when: () => s.gdpGrowth > 3 && s.inflation < tgt + 1.5 && s.unemployment < s.nairu + 0.5,
      q: '«Впервые за годы мы планируем на три года вперёд, а не на квартал»',
      who: 'Руслан, основатель производственной компании',
      t: () => `Рост ${rf1(s.gdpGrowth)}% при инфляции ${rf1(s.inflation)}% и разрыве выпуска ${rfs(s.outputGap)}%. Предсказуемость — тот редкий ресурс, который создаётся политикой, а не покупается.` },
    { id: 'region', p: 6, when: () => (s.sequesterFactor || 1) < 0.995 || s.budgetBalancePctGdp < -7,
      q: '«Нам сказали: стройку заморозить, зарплаты оставить»',
      who: 'Глава администрации небольшого города',
      t: () => `Дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП. Когда бюджет режут, первыми уходят инвестиции — то есть будущий рост, у которого нет своего профсоюза.` },
    { id: 'student', p: 5, when: () => s.unemployment > 6.5,
      q: '«Диплом есть, работы нет — беру любую подработку»',
      who: 'Камиль, выпускник технического вуза',
      t: () => `Безработица ${rf1(s.unemployment)}%. Молодёжь всегда первой выпадает из найма и последней возвращается — отсюда и растущий естественный уровень безработицы ${rf1(s.nairu)}%.` },
    { id: 'farmer', p: 5, when: () => s.commodityIndex > 108 || s.inflation > 7,
      q: '«Солярка подорожала раньше, чем мы успели продать урожай»',
      who: 'Владимир, фермерское хозяйство',
      t: () => `Сырьевой индекс ${rf1(s.commodityIndex)} при инфляции ${rf1(s.inflation)}%. Издержки приходят к производителю быстрее, чем цены его продукции.` },
    { id: 'importer', p: 6, when: () => s.fxDeprAnnual > 5,
      q: '«Мы пересчитываем прайс раз в две недели, и клиенты это ненавидят»',
      who: 'Ксения, импорт бытовой техники',
      t: () => `Курс ослаб на ${rf1(s.fxDeprAnnual)}% годовых, цены импорта растут на ${rf1(s.importPriceInflation)}%. Перенос курса в ценники — самый быстрый канал инфляции.` },
    { id: 'exporter', p: 5, when: () => s.fxDeprAnnual > 4 && s.exports > s.imports * 0.95,
      q: '«Слабый курс — наш единственный бонус за последние годы»',
      who: 'Директор экспортного предприятия',
      t: () => `Торговый баланс ${fmtMoneySigned(s.tradeBalance)}. Девальвация перекладывает доход от покупателя импорта к экспортёру — это перераспределение, а не рост.` },
    { id: 'banker', p: 6, when: () => s.netInterestMargin > 5 || s.bankROE > 15,
      q: '«Мы зарабатываем на разнице ставок, а не на экономике — это тревожный признак»',
      who: 'Зампред одного из крупных банков',
      t: () => `Процентная маржа ${rf2(s.netInterestMargin)} п.п., рентабельность ${rf1(s.bankROE)}%. Когда банкам выгоднее держать деньги, чем кредитовать, страдает инвестиционный цикл.` },
    { id: 'realtor', p: 5, when: () => s.creditGap > 4,
      q: '«Очереди на ипотеку — как в лучшие годы, и это меня пугает»',
      who: 'Агент по недвижимости',
      t: () => `Кредитный разрыв ${rfs(s.creditGap)} п.п. ВВП. Кредитные бумы приятны в моменте и дороги через два-три года, когда приходит просрочка.` },
    { id: 'nurse', p: 6, when: () => s.budgetShares.health < 15,
      q: '«В больнице снова нет расходников, зато есть оптимизация»',
      who: 'Медсестра районной больницы',
      t: () => `Доля здравоохранения ${rf1(s.budgetShares.health)}% бюджетных расходов. Это не только про людей — человеческий капитал ${rf1(s.humanCapitalIndex)} прямо входит в потенциальный ВВП.` },
    { id: 'teacher', p: 6, when: () => s.budgetShares.education < 14,
      q: '«Молодые учителя не приходят, а старые уходят»',
      who: 'Директор школы',
      t: () => `На образование идёт ${rf1(s.budgetShares.education)}% расходов. Эффект этой цифры вы увидите не в этом квартале, а через десять лет — в темпе роста потенциала ${rf1(s.potentialGrowth)}%.` },
    { id: 'scientist', p: 5, when: () => s.budgetShares.science < 3,
      q: '«Лаборатория закрыта, гранта нет, коллеги уехали»',
      who: 'Научный сотрудник института',
      t: () => `Наука получает ${rf1(s.budgetShares.science)}% расходов. Производительность ${rf1(s.productivity)} растёт на ${rf1(s.tfpGrowth)}% в год — единственный источник роста, который не оплачивается инфляцией.` },
    { id: 'engineer_boom', p: 5, when: () => s.investmentGrowth > 5,
      q: '«Нам впервые за годы согласовали новую линию»',
      who: 'Главный инженер завода',
      t: () => `Инвестиции растут на ${rf1(s.investmentGrowth)}% при реальной ставке по кредитам ${rf1(s.realLendingRate)}%. Сегодняшние инвестиции — это завтрашний потенциал, а не сегодняшний спрос.` },
    { id: 'retiree_ok', p: 4, when: () => s.inflation < s.inflationTarget + 0.5 && s.wageGrowth - s.inflation > 0,
      q: '«Я снова понимаю, сколько стоит поход в магазин»',
      who: 'Галина Петровна, пенсионерка',
      t: () => `Инфляция ${rf1(s.inflation)}% при цели ${rf1(tgt)}%. Предсказуемость цен — та форма благополучия, которую замечают, только когда её теряют.` },
    { id: 'fund_manager', p: 6, when: () => s.volatilityIndex > 45,
      q: '«Мы вышли в короткие облигации и ждём — рынок не про фундамент сейчас»',
      who: 'Управляющий пенсионным фондом',
      t: () => `Индекс страха ${rf1(s.volatilityIndex)}, премия за риск акций ${rf1(s.equityRiskPremium)}%. Когда все уходят в короткие бумаги, длинные деньги для экономики исчезают.` },
    { id: 'ceo_invert', p: 7, when: () => s.curveInverted,
      q: '«Банк предлагает депозит доходнее, чем мой собственный проект»',
      who: 'Основатель промышленной группы',
      t: () => `Короткие ставки ${rf1(s.yield3m)}% против длинных ${rf1(s.yield10y)}%. Инверсия кривой — это когда экономике выгоднее ждать, чем строить.` },
    { id: 'accountant_sequester', p: 8, when: () => (s.sequesterFactor || 1) < 0.995,
      q: '«Контракты подписаны, деньги отозваны — объясняйте это подрядчикам сами»',
      who: 'Финансовый директор госпредприятия',
      t: () => `Секвестр урезал расходы на ${rf1((1 - s.sequesterFactor) * 100)}%. Когда рынок отказывается финансировать дефицит, выбор делает уже не правительство.` },
    /* Голос обозревателя перед выборами. Двойная проверка режима: при
       тоталитаризме счётчик до выборов замирает на своём последнем значении
       (выборов больше нет), и без первого условия этот голос звучал бы в
       стране без урн бесконечно — «До выборов 3 кв.» кряду десятки лет.
       А подконтрольная пресса, даже когда выборы формально проводятся, не
       печатает рейтинг власти — ровно то, на что жаловался игрок. */
    { id: 'journalist_elect', p: 6, when: () => !s.noElections && s.quartersToElection <= 3,
      q: '«Обещаний в этом квартале больше, чем в предыдущие два года»',
      who: 'Политический обозреватель',
      t: () => (pressControlled(s)
        ? `До голосования ${s.quartersToElection} кв. Предвыборные расходы государства всё равно оплачиваются после голосования — обычно ставкой.`
        : `До выборов ${s.quartersToElection} кв., рейтинг власти ${Math.round(s.approval)}. Предвыборные расходы всегда оплачиваются после выборов — обычно ставкой.`) },
    { id: 'mayor_fund', p: 4, when: () => (s.fundPctGdp || 0) > 4,
      q: '«Впервые за долгое время у страны есть подушка, а не только долги»',
      who: 'Экономический обозреватель',
      t: () => `Суверенный фонд ${fmtMoney(s.sovereignFund)} (${rf1(s.fundPctGdp)}% ВВП) при долге ${rf1(s.debtToGdp)}% ВВП. Чистый долг ${rf1(s.netDebtToGdp)}% — именно эту цифру смотрят инвесторы.` },
    { id: 'trader_street', p: 5, when: () => Math.abs(s.stockReturn) > 6,
      q: () => (s.stockReturn > 0 ? '«Все вдруг стали экспертами по акциям»' : '«Портфель за квартал похудел сильнее, чем я за год»'),
      who: 'Частный инвестор',
      t: () => `Индекс ${rfs(s.stockReturn)}% за квартал, капитализация ${rf1(s.marketCapPctGdp)}% ВВП. Цены активов реагируют на ставку раньше, чем выпуск и занятость.` },
    { id: 'union_strike', p: 8, when: () => (s.wageGrowth - s.inflation) < -2.5,
      q: '«Если индексации не будет, встанут цеха»',
      who: 'Забастовочный комитет',
      t: () => `Реальные зарплаты ${rfs(s.wageGrowth - s.inflation)}%. Дальше либо индексация и инфляция издержек, либо конфликт — третьего пути у этой развилки обычно нет.` },
    { id: 'econ_coord', p: 6, when: () => s.policyCoordination < 35,
      q: '«Одно ведомство жмёт газ, другое — тормоз, а изнашивается вся машина»',
      who: 'Профессор, бывший советник правительства',
      t: () => `Согласованность политики ${Math.round(s.policyCoordination)} из 100. Несогласованность стоит стране премии за риск ${rf1(s.riskPremium)} п.п. и лишних процентов по долгу.` },
    { id: 'young_family', p: 5, when: () => s.lendingRate < 7 && s.inflation < 6,
      q: '«Мы взяли кредит на ремонт — впервые ставка выглядит разумной»',
      who: 'Молодая семья',
      t: () => `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(s.inflation)}%. Дешёвые деньги приятны домохозяйствам и опасны балансам банков — вопрос в том, надолго ли.` },
    { id: 'saver', p: 5, when: () => s.depositRate - s.inflation < -2,
      q: '«Деньги на вкладе тают, но куда их ещё нести — непонятно»',
      who: 'Виктор, инженер, откладывает на образование детей',
      t: () => `Реальная ставка по депозитам ${rfs(s.depositRate - s.inflation)}%. Отрицательная реальная доходность — это налог, который никто не голосовал.` },
  ];
  const BASELINE_VOICES = [
    { id: 'base_wage', p: 3, when: () => realW >= 0.5,
      q: '«Зарплата наконец обгоняет ценники — не сильно, но обгоняет»',
      who: 'Николай, мастер на складе',
      t: () => `Реальные доходы ${rfs(realW)}% при инфляции ${rf1(s.inflation)}%. Такие кварталы люди запоминают лучше, чем любые показатели с панели.` },
    { id: 'base_orders', p: 3, when: () => s.gdpGrowth < s.potentialGrowth - 0.3,
      q: '«Заказов стало меньше, но увольнять пока некого»',
      who: 'Елена, владелица типографии',
      t: () => `Рост ${rf1(s.gdpGrowth)}% при потенциале ${rf1(s.potentialGrowth)}%. Бизнес сначала теряет выручку и только потом сокращает людей — поэтому безработица всегда опаздывает.` },
    { id: 'base_analyst', p: 3, when: () => true,
      q: () => (s.policyCoordination < 45
        ? '«Два ведомства тянут экономику в разные стороны, и оплачивает это третий — гражданин»'
        : '«Политика выглядит связной, а связность сама по себе стоит процента роста»'),
      who: 'Еженедельный экономический обзор',
      t: () => `Согласованность политики ${Math.round(s.policyCoordination)} из 100 при ставке ${rf2(s.keyRate)}% и балансе бюджета ${rfs(s.budgetBalancePctGdp)}% ВВП. Когда бюджет разгоняет спрос, а ЦБ его тормозит, обе стороны тратят ресурсы впустую.` },
    { id: 'base_street', p: 2, when: () => true,
      q: () => (s.inflation > tgt + 1 ? '«Цены в магазине у дома объясняют экономику лучше любого отчёта»' : '«Ценники стоят на месте, и это уже новость»'),
      who: 'Опрос на улице, областной центр',
      t: () => `Инфляция ${rf1(s.inflation)}% при цели ${rf1(tgt)}%, потребительские настроения ${Math.round(s.consumerConfidence)} из 100. Люди судят об экономике по корзине, а не по разрыву выпуска.` },
  ];
  // не больше одного мнения за квартал: два голоса подряд в одной и той же
  // рубрике читались как заполнение места, а не как две отдельные причины
  // говорить с читателем
  let picked = VOICES.filter((v) => v.when()).sort((a, b) => b.p - a.p).filter((v) => once(`op:${v.id}`, 7)).slice(0, 1);
  if (picked.length === 0) {
    const pool = BASELINE_VOICES.filter((v) => v.when());
    const rot = pool.map((_, i) => pool[(i + quarterIndex) % pool.length]);
    picked = rot.filter((v) => once(`op:${v.id}`, 4)).slice(0, 1);
  }
  picked.forEach((v) => push('opinion', typeof v.q === 'function' ? v.q() : v.q, `${v.who}. ${v.t()}`, 4));

  return out;
}

/* Импульсы решений: то, что действует не мгновенно и не через запас (ставки, кредит) */
function buildDecisionImpulses(dec, s, difficulty) {
  const out = [];
  const dVat = dec.vatRate - s.vatRate;
  if (Math.abs(dVat) > 1e-6) {
    out.push(makeImpulse('vatPrices', dVat * CONFIG.coef.vatPass, `Изменение НДС до ${dec.vatRate.toFixed(1)}% напрямую переносится в розничные цены`, 'fast', difficulty, 'inflation'));
    out.push(makeImpulse('consumption', -dVat * 0.35, `Изменение НДС до ${dec.vatRate.toFixed(1)}% меняет реальные доходы домохозяйств`, 'default', difficulty));
  }
  const dExcise = dec.exciseRate - s.exciseRate;
  if (Math.abs(dExcise) > 1e-6) {
    out.push(makeImpulse('vatPrices', dExcise * 0.12, `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`, 'fast', difficulty, 'inflation'));
    out.push(makeImpulse('consumption', -dExcise * 0.14, `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`, 'default', difficulty));
  }
  const dIncome = dec.incomeTaxRate - s.incomeTaxRate;
  if (Math.abs(dIncome) > 1e-6) out.push(makeImpulse('consumption', -dIncome * 0.30, `${dIncome > 0 ? 'Повышение' : 'Снижение'} подоходного налога до ${dec.incomeTaxRate.toFixed(1)}% меняет располагаемый доход`, 'default', difficulty));
  const dSocial = dec.socialContribRate - s.socialContribRate;
  if (Math.abs(dSocial) > 1e-6) {
    out.push(makeImpulse('unemployment', dSocial * 0.045, `Изменение социальных взносов до ${dec.socialContribRate.toFixed(1)}% меняет стоимость труда для работодателя`, 'default', difficulty));
    out.push(makeImpulse('investment', -dSocial * 0.20, `Изменение социальных взносов до ${dec.socialContribRate.toFixed(1)}%`, 'default', difficulty));
  }
  const dProfit = dec.profitTaxRate - s.profitTaxRate;
  if (Math.abs(dProfit) > 1e-6) out.push(makeImpulse('businessConfidence', -dProfit * 0.8, `${dProfit > 0 ? 'Повышение' : 'Снижение'} налога на прибыль до ${dec.profitTaxRate.toFixed(1)}%`, 'default', difficulty, 'other'));
  const dCapital = dec.capitalTaxRate - s.capitalTaxRate;
  if (Math.abs(dCapital) > 1e-6) out.push(makeImpulse('capitalFlow', -dCapital * 6, `Изменение налога на капитал до ${dec.capitalTaxRate.toFixed(1)}% влияет на приток капитала`, 'default', difficulty));
  if (Math.abs(dec.moneySupplyOp || 0) > 1e-6) {
    out.push(makeImpulse('inflationSupply', dec.moneySupplyOp * 0.14, `${dec.moneySupplyOp > 0 ? 'Расширение' : 'Сжатие'} денежной массы на ${fmtSigned1(dec.moneySupplyOp)}%`, 'slow', difficulty, 'inflation'));
    out.push(makeImpulse('investment', dec.moneySupplyOp * 0.35, `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`, 'default', difficulty));
    out.push(makeImpulse('creditDemand', dec.moneySupplyOp * 0.4, `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`, 'default', difficulty));
  }
  if (dec.emergency) {
    out.push(makeImpulse('inflationSupply', 0.45, 'Экстренная поддержка банков: эмиссионное финансирование', 'slow', difficulty, 'inflation'));
    out.push(makeImpulse('govTrust', -2.5, 'Экстренная поддержка банков за счёт бюджета и эмиссии', 'fast', difficulty, 'other'));
  }
  const dReserve = dec.reserveReq - s.reserveReq;
  if (Math.abs(dReserve) > 1e-6) out.push(makeImpulse('creditDemand', -dReserve * 0.5, `Изменение нормы резервирования до ${dec.reserveReq.toFixed(1)}%`, 'default', difficulty, 'banking'));
  const bondIssuance = Math.max(0, dec.bondIssuance || 0);
  if (bondIssuance > 0.01) {
    // рынок читает размещение сверх необходимого как сигнал: раз занимают, не
    // будучи прижатыми дефицитом, значит готовятся к чему-то — премия растёт
    // пропорционально размеру размещения относительно экономики, а не самой сумме
    out.push(makeImpulse('riskPremium', bondIssuance / Math.max(1, s.nominalGdp) * 100 * 0.6,
      `Минфин разместил облигации на ${fmtMoney(bondIssuance)} сверх необходимого для покрытия дефицита`, 'default', difficulty));
  }
  return out.filter((im) => im.values.some((x) => Math.abs(x) > 1e-9));
}

/* =========================================================================================
   НАЧАЛЬНОЕ СОСТОЯНИЕ
========================================================================================= */
function makeInitialEconomy(scenarioId) {
  const scenario = SCENARIOS.find((sc) => sc.id === scenarioId);
  const I = { ...CONFIG.initial, ...(scenario && scenario.overrides) };
  const potentialGdp = potentialFrom(I.capitalStock, I.laborForce, I.nairu, I.humanCapitalIndex, I.productivity, I.infrastructureIndex, TFP_SCALE, 0);
  const nominalGdp = I.gdp * I.priceLevel / 100;
  const base = {
    ...I,
    gdp: I.gdp, nominalGdp, potentialGdp, potentialGrowth: 2.3, outputGap: (I.gdp - potentialGdp) / potentialGdp * 100,
    gdpGrowth: 2.3, gdpPerCapita: I.gdp * 1000 / CONFIG.population,
    consumptionGrowth: 2.3, investmentGrowth: 2.3, govPurchasesGrowth: 2.3, transfersGrowth: 2.3, govInvestmentGrowth: 2.3,
    tradeBalance: I.exports - I.imports, currentAccount: I.exports - I.imports - 0.012 * I.govDebt,
    capitalAccount: 0, netCapitalFlow: 0, fxDeprAnnual: 1.0, importPriceInflation: 4.0, importPriceInfl: 4.0,
    supplyScar: 0, tfpGrowth: CONFIG.prod.tfpBase,
    prevUnemployment: I.unemployment, employment: 100 - I.unemployment, tightness: 0,
    vacancyRate: 3.0, unitLaborCostGrowth: 4.0,
    realLendingRate: I.lendingRate - I.inflationExpectations, realPolicyRate: I.keyRate - I.inflationExpectations,
    rateGap: 0, policyStance: I.keyRate - I.inflationExpectations - I.rStar, carry: 0,
    creditGrowth: 6.3, creditTrendRatio: I.creditVolume / nominalGdp * 100, creditGap: 0, creditGapLag: 0, creditImpulse: 0, creditCrunch: false,
    bankCapitalAdequacy: I.bankCapital / (I.creditVolume * CONFIG.target.riskWeight) * 100,
    bankProfit: 2.2, loanLosses: 4.7, bankingRisk: 24, bankingRiskValue: 24,
    interestPayment: I.govDebt * I.effectiveDebtRate / 100,
    fiscalImpulse: 0, structuralBalancePctGdp: 0,
    // округа: идущие и достроенные стройки, поправки к напряжению, текущее событие
    projects: [], projectsBuilt: [], regionMods: {}, regionShock: {}, regionEvent: null, regionEventCooldown: 1,
    lastRegionResolution: null, projectReal: 0, warCampaign: null, annexed: [], campaignSpend: {},
    annexLoyalty: {}, annexIntegrated: [], annexFunded: [],
    norlandRevanche: 0, revancheWarned: false, revancheCampaign: null, defenseCampaign: null, peaceTalks: null, treaty: null,
    relations: { ...RELATIONS_START }, diploTreaties: {}, diploSanctions: {}, diploCooldown: {}, deshtMobilized: 0, deshtCalm: 0,
    neighborEvent: null, diploLast: null, diploResolved: null,
    groupSupport: null, groupSupportPrev: null, groupMemory: [], groupDriversNow: null, groupUnrestCd: {},
    groupDemand: null, groupDemandCooldown: 0, lastGroupResolution: null,
    inflationRisk: 14, debtRisk: 24, recessionRisk: 12, currencyRisk: 20,
    activeCrises: [], regime: I.regime || 'normal', recessionStreak: 0, recessionRecoverStreak: 0, regimeStreak: 1, demands: [], pandemicQuartersLeft: 0, warQuartersLeft: 0, warType: null, warByChoice: false,
    unrestActive: false, marketLockoutQuartersLeft: 0, defaultedEver: false, justDefaulted: false,
    stabilizationCred: 0,
    cbStance: 0, mofStance: 0, taxWedgeValue: 0, botHeadline: null, botDemand: null,
  };
  const rev = computeRevenue(base, base);
  base.revenueParts = rev;
  base.govRevenue = rev.total;
  base.revenuePctGdp = rev.total / nominalGdp * 100;
  base.taxWedgeValue = taxWedge(base);
  base.sovereignFund = 0; base.fundPctGdp = 0; base.netDebtToGdp = I.govDebt / nominalGdp * 100; base.fundIncome = 0;
  base.govPurchasesNominal = I.govPurchasesReal;
  base.transfersNominal = I.transfersReal;
  base.govInvestmentNominal = I.govInvestmentReal;
  base.govSpendingTotal = I.govPurchasesReal + I.transfersReal + I.govInvestmentReal + base.interestPayment;
  base.budgetBalance = base.govRevenue - base.govSpendingTotal;
  base.budgetBalancePctGdp = base.budgetBalance / nominalGdp * 100;
  base.structuralBalancePctGdp = base.budgetBalancePctGdp;
  base.primaryBalance = base.budgetBalance + base.interestPayment;
  base.debtToGdp = I.govDebt / nominalGdp * 100;
  base.interestToRevenue = base.interestPayment / base.govRevenue * 100;
  base.yield3m = base.keyRate + 0.2; base.yield1y = base.keyRate + 0.4; base.yield2y = base.keyRate + 0.7;
  base.yield5y = base.keyRate + 1.1; base.yield10y = base.keyRate + 1.5;
  base.curveSlope = 1.3; base.curveInverted = false; base.bondIndex = 1000; base.bondReturn = 1.75;
  base.sovereignSpread = base.riskPremium * 100; base.corporateSpread = 190;
  base.stockIndex = 1000; base.stockReturn = 0; base.equityRiskPremium = 3.2;
  base.earnings = CONFIG.shares.profits * I.gdp * (1 - I.profitTaxRate / 100);
  base.discountRate = base.yield10y + 3.2 - 0.62 * (2.3 + I.inflationExpectations);
  base.fairPE = 100 / base.discountRate; base.stockPE = base.fairPE;
  base.marketCap = 1100; base.marketCapPctGdp = 1100 / nominalGdp * 100;
  base.sectorBanks = 1000; base.sectorIndustry = 1000; base.sectorConsumer = 1000; base.sectorResources = 1000; base.reitIndex = 1000;
  base.netInterestMargin = I.lendingRate - I.depositRate; base.bankROE = 6.0; base.bankPB = 0.7;
  base.fxVolatility = 6; base.volatilityIndex = 16;
  base.depositIndex = 100; base.fxIndex = I.exchangeRate; base.fxCarry = 1;
  base.corpBondIndex = 1000; base.corpYield = base.yield5y + 1.9; base.corpReturn = 2.0;
  base.goldIndex = I.commodityIndex * I.exchangeRate / 100;
  base.bondShortIndex = 1000; base.linkerIndex = 1000; base.moneyMarketIndex = 1000; base.worldEquityIndex = 1000;
  base.reforms = {}; base.politicalCapitalGain = 0; base.decreeRule = false;
  Object.assign(base, computeScores({ ...base, capitalRequirement: base.capitalRequirement }));
  return base;
}

/* =========================================================================================
   ОТЧЁТ
========================================================================================= */
const REGIME_INFO = {
  normal: { label: 'Нормальный режим', color: 'teal', text: 'Выпуск близок к потенциалу, инфляция под контролем. Лучшее время для структурных решений: их эффект проявится через годы.' },
  overheating: { label: 'Перегрев', color: 'gold', text: 'Спрос выше производственных возможностей. Дополнительные расходы почти целиком уйдут в цены, а не в выпуск.' },
  recession: { label: 'Рецессия', color: 'rust', text: 'Выпуск ниже потенциала. Мультипликатор расходов высок, но длительная безработица поднимает её естественный уровень — шрамы останутся.' },
  stagflation: { label: 'Стагфляция', color: 'rust', text: 'Спад и инфляция одновременно. Любая политика чем-то жертвует: ставка вверх — глубже спад, ставка вниз — срыв ожиданий.' },
  banking: { label: 'Банковский кризис', color: 'rust', text: 'Капитал банков не покрывает потери, кредит сжимается, что само поднимает просрочку. Петля обратной связи работает против вас.' },
  debt: { label: 'Долговой кризис', color: 'rust', text: 'Премия за риск растёт быстрее, чем экономика. Каждый новый выпуск долга дороже предыдущего.' },
  currency: { label: 'Валютный кризис', color: 'rust', text: 'Курс переносится в цены. Защита резервами конечна, свободный курс — импорт инфляции.' },
  deflation: { label: 'Дефляционная ловушка', color: 'blue', text: 'Реальная ставка высока даже при нулевой ключевой. Обычная денежная политика теряет силу — нужен бюджет.' },
  pandemic: { label: 'Пандемия', color: 'rust', text: 'Вспышка заболевания одновременно сократила спрос и производственные возможности. Эффект растянут на несколько кварталов и постепенно сходит на нет.' },
  /* «Военное положение» вместо «Войны», когда войну объявили сами: это не кризис,
     который случился с экономикой, а режим, в который её перевели решением. */
  war: { label: (e) => (e.warByChoice ? 'Военное положение' : 'Война'), color: 'rust',
    text: (e) => (e.warByChoice
      ? `Страна ведёт объявленную ею войну. Санкции сжали торговлю и инвестиции, капитал уходит, издержки растут — это прямая цена решения, а не внешний шок. Взамен открыты чрезвычайные полномочия, а рейтинг первые кварталы держится на сплочении.`
      : `Экономика в состоянии ${e.warType === 'offensive' ? 'наступательной войны: под санкциями сжались торговля и инвестиции, капитал уходит в защитные активы' : e.warType === 'defensive' ? 'оборонительной войны: удар смягчает иностранная помощь союзников, но торговля и инвестиции всё равно сжались' : 'войны: торговля и инвестиции сжались, издержки растут, капитал уходит в защитные активы'}. Расходы на оборону, сделанные ещё до войны, смягчают удар.`) },
};
/* text может быть строкой или функцией (economy) => строка — второе нужно там,
   где формулировка зависит от состояния (например, тип войны) */
const regimeInfoText = (info, economy) => (typeof info.text === 'function' ? info.text(economy) : info.text);
// label тоже может зависеть от состояния: «Война» или «Военное положение» — это
// один и тот же режим экономики, но с разным автором
const regimeInfoLabel = (info, economy) => (typeof info.label === 'function' ? info.label(economy) : info.label);
const CRISIS_INFO = {
  banking: { label: 'Банковский кризис', text: 'Просрочка съедает капитал, капитал ограничивает кредит, сжатие кредита повышает просрочку.' },
  debt: { label: 'Долговой кризис', text: 'Инвесторы требуют премию за риск; стоимость обслуживания растёт быстрее доходов.' },
  currency: { label: 'Валютный кризис', text: 'Резкое движение курса разгоняет инфляцию через импорт.' },
  stagflation: { label: 'Стагфляция', text: 'Высокая инфляция при отрицательном разрыве выпуска.' },
  overheating: { label: 'Перегрев', text: 'Разрыв выпуска положительный — спрос упирается в мощности.' },
  recession: { label: 'Рецессия', text: 'Выпуск ниже потенциала уже несколько кварталов.' },
  deflation: { label: 'Дефляция', text: 'Слабый спрос и почти нулевой рост цен.' },
  pandemic: { label: 'Пандемия', text: 'Вспышка заболевания одновременно бьёт по спросу и по производственным возможностям.' },
  war: { label: (e) => (e.warByChoice ? 'Военное положение' : 'Война'),
    text: (e) => `${e.warByChoice ? 'Объявленная война бьёт по торговле, инвестициям и доверию — это цена решения, а не внешний шок.' : 'Военный конфликт бьёт по торговле, инвестициям и доверию; заранее высокие расходы на оборону снижают потери.'} ${e.warType === 'offensive' ? 'Наступательный характер войны привёл к санкциям.' : e.warType === 'defensive' ? 'Оборонительный характер войны приносит иностранную помощь.' : ''}`.trim() },
};

/* =========================================================================================
   ПОЛИТИЧЕСКИЙ РЕЖИМ: демократия / конфликт ветвей власти / авторитаризм / тоталитаризм —
   см. блок «15а» в simulateQuarter. Здесь только описание для интерфейса и подмена «От
   редакции» пропагандой там, где режим подчинил себе прессу.
========================================================================================= */
/* =========================================================================================
   РАЗБОР ПАРТИИ

   В конце партии игрок видел приговор («ВОЕННЫЙ ПЕРЕВОРОТ», «ВЫБОРЫ
   ПРОИГРАНЫ») и графики, но не ответ на главный вопрос: где именно всё
   пошло не так — или так. Эта функция читает историю кварталов и находит
   переломные моменты: начало и конец кризисов, срыв инфляции и её возврат
   к цели, рецессию, выборы, смену режима, пересечение долговых порогов,
   лучший и худший квартал. К каждому плохому повороту она ищет решение,
   которое ему предшествовало, — резкий сдвиг ставки, налогов, бюджетного
   импульса или режима курса за один–три квартала до этого. Причину она не
   доказывает, а показывает соседство во времени: «вот что вы сделали прямо
   перед этим». Этого обычно хватает, чтобы увидеть свою ошибку.

   Функция чистая и работает на снимках истории, которые уже хранятся в
   партии (одиночной и сетевой): ни новых полей, ни новой памяти не нужно.
========================================================================================= */
const TAX_FIELDS = [
  ['incomeTaxRate', 'подоходный налог'], ['vatRate', 'НДС'], ['profitTaxRate', 'налог на прибыль'],
  ['socialContribRate', 'социальные взносы'], ['exciseRate', 'акцизы'], ['capitalTaxRate', 'налог на капитал'],
];
const crisisName = (id, e) => {
  const info = CRISIS_INFO[id];
  if (!info) return id;
  return typeof info.label === 'function' ? info.label(e || {}) : info.label;
};

// самое заметное решение в одном переходе prev → cur (или null)
function policyMoveBetween(prev, cur) {
  const moves = [];
  const dr = (cur.keyRate || 0) - (prev.keyRate || 0);
  if (Math.abs(dr) >= 1.5) moves.push({ w: Math.abs(dr) / 1.5, text: `ставка ${dr > 0 ? 'поднята' : 'снижена'} с ${fmt1(prev.keyRate)} до ${fmt1(cur.keyRate)}%` });
  TAX_FIELDS.forEach(([k, name]) => {
    const d = (cur[k] || 0) - (prev[k] || 0);
    if (Math.abs(d) >= 2) moves.push({ w: Math.abs(d) / 2, text: `${name} ${d > 0 ? 'поднят' : 'снижен'} с ${fmt1(prev[k])} до ${fmt1(cur[k])}%` });
  });
  const fi = cur.fiscalImpulse || 0;
  if (Math.abs(fi) >= 1.2) moves.push({ w: Math.abs(fi) / 1.2, text: `бюджетный импульс ${fi > 0 ? '+' : ''}${fmt1(fi)} п.п. ВВП — ${fi > 0 ? 'резкая раздача' : 'резкое сокращение'} расходов` });
  if (prev.fxRegime && cur.fxRegime && prev.fxRegime !== cur.fxRegime) {
    const nm = { free: 'плавающий', managed: 'управляемый', peg: 'фиксированный' };
    moves.push({ w: 1.5, text: `режим курса сменён: ${nm[prev.fxRegime] || prev.fxRegime} → ${nm[cur.fxRegime] || cur.fxRegime}` });
  }
  if (!moves.length) return null;
  return moves.sort((a, b) => b.w - a.w)[0];
}

// решение, предшествовавшее повороту в квартале i: смотрим 1–3 квартала назад
function precedingMove(hist, i) {
  let best = null;
  for (let back = 0; back < 3; back++) {
    const j = i - back;
    if (j < 1) break;
    const m = policyMoveBetween(hist[j - 1], hist[j]);
    if (m && (!best || m.w > best.w)) best = { ...m, back };
  }
  if (!best) return null;
  return best.back === 0 ? `В том же квартале: ${best.text}.` : `За ${best.back} кв. до этого: ${best.text}.`;
}

function gameChronicle(history) {
  const hist = (history || []).filter((h) => h && Number.isFinite(h.gdpGrowth));
  const events = [];
  if (hist.length < 2) return { events, summary: null };
  const labelOf = (h, i) => h.label || h.qLabel || quarterLabel(Number.isFinite(h.q) ? h.q : i);
  const push = (i, ev) => events.push({ q: Number.isFinite(hist[i].q) ? hist[i].q : i, label: labelOf(hist[i], i), ...ev });
  const crisisStart = {};
  let inflationOut = false; let growthRun = 0; let debtHigh = false;
  // смену режима отмечаем, только когда страна опускается ниже, чем была, или
  // возвращается к демократии: колебания «конфликт ↔ авторитаризм» в разборе —
  // шум, который вытеснял бы из списка всё остальное
  const REGIME_RANK = { democracy: 0, crisis: 1, authoritarian: 2, totalitarian: 3 };
  let worstRank = REGIME_RANK[hist[0].politicalRegime] || 0;

  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1]; const cur = hist[i];
    const tgt = Number.isFinite(cur.inflationTarget) ? cur.inflationTarget : CONFIG.target.inflation;
    const why = () => precedingMove(hist, i);

    // кризисы: начало и конец
    const was = new Set(prev.activeCrises || []); const now = new Set(cur.activeCrises || []);
    now.forEach((c) => {
      if (was.has(c)) return;
      crisisStart[c] = i;
      // в первом квартале «начавшийся» кризис — это стартовые условия сценария
      if (i === 1) {
        push(i, { kind: 'crisis', tone: 'bad', weight: 7, title: `Партия началась в кризисе: ${crisisName(c, cur).toLowerCase()}`,
          text: 'Это стартовые условия, а не чьё-то решение.' });
        return;
      }
      push(i, { kind: 'crisis', tone: 'bad', weight: 8, title: `Начался кризис: ${crisisName(c, cur).toLowerCase()}`,
        text: why() || 'Резких решений прямо перед этим не было — кризис вырос из накопленного дисбаланса или пришёл извне.' });
    });
    was.forEach((c) => {
      if (now.has(c)) return;
      const len = crisisStart[c] !== undefined ? i - crisisStart[c] : null;
      if (len !== null && len < 2) return;
      push(i, { kind: 'crisis-end', tone: 'good', weight: 6, title: `Кризис преодолён: ${crisisName(c, prev).toLowerCase()}`,
        text: len !== null ? `Он длился ${len} кв.` : 'Он тянулся с начала партии.' });
    });

    // инфляция: срыв и возврат к цели
    if (!inflationOut && cur.inflation > tgt + 3 && prev.inflation <= tgt + 3) {
      inflationOut = true;
      push(i, { kind: 'inflation', tone: 'bad', weight: 7, title: `Инфляция вырвалась: ${fmt1(cur.inflation)}% при цели ${fmt1(tgt)}%`,
        text: why() || 'Резких решений прямо перед этим не было — цены разогнали ожидания, курс или шок извне.' });
    } else if (inflationOut && Math.abs(cur.inflation - tgt) <= 1) {
      inflationOut = false;
      push(i, { kind: 'inflation-back', tone: 'good', weight: 6, title: `Инфляция возвращена к цели: ${fmt1(cur.inflation)}%`,
        text: 'Цены снова под контролем — теперь важно не отпустить ожидания.' });
    }

    // рецессия после периода роста
    if (cur.gdpGrowth < 0 && prev.gdpGrowth >= 0 && growthRun >= 2 && !now.has('recession')) {
      push(i, { kind: 'recession', tone: 'bad', weight: 6, title: `Экономика ушла в минус: ${fmt1(cur.gdpGrowth)}% годовых`,
        text: why() || 'Резких решений прямо перед этим не было.' });
    }
    growthRun = cur.gdpGrowth >= 0 ? growthRun + 1 : 0;

    // выборы
    if (cur.electionResult) {
      const le = cur.lastElection || {};
      const honest = Number.isFinite(cur.electionVoteShare) ? cur.electionVoteShare : null;
      const won = cur.electionResult === 'incumbent';
      if (le.coup) {
        push(i, { kind: 'election', tone: 'bad', weight: 11, title: `Выборы проиграны — итог не признан`,
          text: `За власть проголосовали ${honest !== null ? `${fmt1(honest)}%` : 'меньшинство'}, но результат объявлен недействительным: парламент распущен, режим одним скачком стал авторитарным.` });
      } else if (le.rigged) {
        /* Разбор — это кабинет, а не газета: здесь можно сказать правду.
           Официальная цифра — нарисованная, честная — та, что была бы без
           подтасовки. Раньше разбор печатал «выиграны — 3.7% голосов». */
        const official = Number.isFinite(le.nationalShare) ? `официально ${fmt1(le.nationalShare)}%` : 'официально — уверенная победа';
        push(i, { kind: 'election', tone: 'neutral', weight: 10, title: `Выборы «выиграны»: ${official}`,
          text: honest !== null ? `При честном подсчёте за власть было бы ${fmt1(honest)}% — выборы при несвободном режиме считают голоса, а не решают исход.`
            : 'Выборы при несвободном режиме считают голоса, а не решают исход.' });
      } else {
        const share = honest !== null ? ` — ${fmt1(honest)}% голосов` : '';
        push(i, { kind: 'election', tone: won ? 'good' : 'bad', weight: 10,
          title: won ? `Выборы выиграны${share}` : cur.electionResult === 'landslide' ? `Разгромное поражение на выборах${share}` : `Выборы проиграны${share}`,
          text: won ? 'Избиратели продлили мандат — рейтинг к урне был достаточным.'
            : `Рейтинг власти к выборам — ${Math.round(cur.approval)} из 100.` });
      }
    }

    // смена политического режима
    const curRank = REGIME_RANK[cur.politicalRegime] || 0;
    const regimeNews = prev.politicalRegime !== cur.politicalRegime
      && (curRank > worstRank || (cur.politicalRegime === 'democracy' && prev.politicalRegime !== 'democracy'));
    if (cur.politicalRegime === 'democracy') worstRank = 0; else worstRank = Math.max(worstRank, curRank);
    if (regimeNews) {
      const info = POLITICAL_REGIME_INFO[cur.politicalRegime] || {};
      const better = cur.politicalRegime === 'democracy';
      push(i, { kind: 'regime', tone: better ? 'good' : 'bad', weight: 10, title: `Режим: ${info.label || cur.politicalRegime}`,
        text: better ? 'Институты вернулись — рынки и доверие это заметят не сразу, но заметят.'
          : `Напряжение ${Math.round(cur.politicalTension || 0)} из 100 при рейтинге ${Math.round(cur.approval)} — так демократия и ломается.` });
    }

    // стабилизационная программа: рынок поверил, программа сорвана, цены остановлены
    const sPrev = prev.stabilizationCred || 0; const sCur = cur.stabilizationCred || 0;
    if (sPrev < 0.5 && sCur >= 0.5 && !cur.stabilizationWon) {
      push(i, { kind: 'stab-credible', tone: 'good', weight: 7, title: 'Рынок поверил стабилизационной программе',
        text: `Доверие к программе ${Math.round(sCur * 100)} из 100: реальная ставка ${fmtSigned1(cur.keyRate - prev.inflationExpectations)} п.п.${(cur.fiscalImpulse || 0) <= -0.3 || (prev.budgetBalancePctGdp || 0) >= -3 ? ', бюджет держит свою часть' : ''} — ожидания начали падать быстрее самих цен.` });
    } else if (sPrev >= 0.5 && sCur < sPrev * 0.5 && !cur.stabilizationWon) {
      push(i, { kind: 'stab-broken', tone: 'bad', weight: 8, title: 'Стабилизационная программа сорвана',
        text: precedingMove(hist, i) || 'Денежные условия ослаблены раньше, чем инфляция побеждена.' });
    }
    if (cur.stabilizationWon && !prev.stabilizationWon) {
      push(i, { kind: 'prices-stopped', tone: 'good', weight: 10, title: `Цены остановлены: инфляция ${fmt1(cur.inflation)}%`,
        text: 'Стабилизационная программа доведена до конца. Рецессия — её цена, но страна готова простить её тем, кто вернул деньгам смысл.' });
    }

    // долговые пороги
    if (!debtHigh && cur.debtToGdp > 90 && prev.debtToGdp <= 90) {
      debtHigh = true;
      push(i, { kind: 'debt', tone: 'bad', weight: 5, title: `Долг перешёл 90% ВВП`, text: why() || 'Долг копился постепенно — квартал за кварталом дефицита.' });
    } else if (debtHigh && cur.debtToGdp < 60) {
      debtHigh = false;
      push(i, { kind: 'debt-down', tone: 'good', weight: 5, title: `Долг снижен ниже 60% ВВП`, text: 'Бюджетная консолидация дала результат.' });
    }
  }

  // лучший и худший квартал — только если партия длинная и разброс заметный
  if (hist.length >= 6) {
    let bi = 1; let wi = 1;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].wellbeing > hist[bi].wellbeing) bi = i;
      if (hist[i].wellbeing < hist[wi].wellbeing) wi = i;
    }
    if (hist[bi].wellbeing - hist[wi].wellbeing >= 10) {
      // «лучшим» оказался самый первый квартал — это не успех, а констатация
      push(bi, { kind: 'best', tone: bi === 1 ? 'neutral' : 'good', weight: 4, title: `Лучший квартал: благополучие ${Math.round(hist[bi].wellbeing)}`,
        text: bi === 1 ? 'Лучше, чем в самом начале, не стало ни разу.' : 'Здесь всё сходилось — стоит запомнить, какой была политика.' });
      push(wi, { kind: 'worst', tone: 'bad', weight: 4, title: `Худший квартал: благополучие ${Math.round(hist[wi].wellbeing)}`, text: precedingMove(hist, wi) || 'Сюда пришли постепенно, без одного резкого решения.' });
    }
  }

  // самое резкое решение по ставке и что было через год
  let mi = -1; let md = 0;
  for (let i = 1; i < hist.length; i++) {
    const d = (hist[i].keyRate || 0) - (hist[i - 1].keyRate || 0);
    if (Math.abs(d) > Math.abs(md)) { md = d; mi = i; }
  }
  if (mi > 0 && Math.abs(md) >= 2) {
    const later = hist[Math.min(hist.length - 1, mi + 4)];
    const after = later === hist[mi] ? '' : ` Через ${Math.min(hist.length - 1, mi + 4) - mi} кв.: инфляция ${fmt1(hist[mi].inflation)} → ${fmt1(later.inflation)}%, безработица ${fmt1(hist[mi].unemployment)} → ${fmt1(later.unemployment)}%.`;
    push(mi, { kind: 'decision', tone: 'neutral', weight: 3, title: `Самое резкое решение по ставке: ${md > 0 ? '+' : ''}${fmt1(md)} п.п.`,
      text: `Ставка ${fmt1(hist[mi - 1].keyRate)} → ${fmt1(hist[mi].keyRate)}%.${after}` });
  }

  // не больше десяти самых весомых, в хронологическом порядке
  const top = [...events].sort((a, b) => b.weight - a.weight).slice(0, 10)
    .sort((a, b) => a.q - b.q || b.weight - a.weight);

  const first = hist[0]; const last = hist[hist.length - 1];
  const quarters = hist.length - 1;
  const gdpChange = (last.gdp / Math.max(1e-9, first.gdp) - 1) * 100;
  const avgInfl = hist.slice(1).reduce((a, h) => a + h.inflation, 0) / quarters;
  const elections = events.filter((e) => e.kind === 'election');
  const crises = events.filter((e) => e.kind === 'crisis').length;
  const summary = {
    quarters, gdpChange, avgInflation: avgInfl, crises,
    elections: elections.length, electionsWon: elections.filter((e) => e.tone === 'good').length,
    wellbeingStart: first.wellbeing, wellbeingEnd: last.wellbeing,
    debtStart: first.debtToGdp, debtEnd: last.debtToGdp,
  };
  return { events: top, summary };
}

/* Карта страны — семь округов правильным шестиугольным кластером (центр и
   кольцо из шести): осевые координаты гарантируют, что фигуры точно
   стыкуются без наложений и дыр, без ручной подгонки полигонов. Экономику
   отдельно по округам не считаем — это отдельный, гораздо более рискованный
   слой поверх движка (новое измерение состояния, новый баланс); вместо
   этого «напряжение округа» — взвешенная сумма уже существующих индексов
   риска (0..100) с весами по профилю сектора округа, так что карта реагирует
   на настоящее состояние экономики, а не рисует отдельную придуманную цифру. */
/* lean — структурная политическая склонность округа, а не реакция на экономику:
   город исторически голосует против действующей власти, село — за неё, и так
   почти везде, независимо от того, какой сейчас квартал. Реакция на экономику
   добавляется сверху (см. regionVoteShares): округ, которому живётся хуже
   среднего по стране, отворачивается от власти дополнительно. */
const MAP_REGIONS = [
  { id: 'capital', name: 'Велеградский столичный округ', short: 'Велеградский', city: 'Велеград', loc: 'Велеградском столичном округе', gen: 'Велеградского столичного округа', sector: 'Управление', icon: 'capital', lean: -6,
    weights: { politicalTension: 0.5, bankingRisk: 0.2, debtRisk: 0.3 } },
  { id: 'port', name: 'Янтарская область', short: 'Янтарская', city: 'Янтарск', loc: 'Янтарской области', gen: 'Янтарской области', sector: 'Внешняя торговля', icon: 'port', lean: -2,
    weights: { currencyRisk: 0.55, recessionRisk: 0.25, debtRisk: 0.2 } },
  { id: 'industry', name: 'Кузнецкая область', short: 'Кузнецкая', city: 'Кузнецк', loc: 'Кузнецкой области', gen: 'Кузнецкой области', sector: 'Промышленность', icon: 'industry', lean: -3,
    weights: { recessionRisk: 0.5, inflationRisk: 0.2, bankingRisk: 0.3 } },
  { id: 'agri', name: 'Приреченская область', short: 'Приреченская', city: 'Приреченск', loc: 'Приреченской области', gen: 'Приреченской области', sector: 'Сельское хозяйство', icon: 'agri', lean: 6,
    weights: { inflationRisk: 0.6, recessionRisk: 0.2, currencyRisk: 0.2 } },
  { id: 'finance', name: 'Златоградская область', short: 'Златоградская', city: 'Златоград', loc: 'Златоградской области', gen: 'Златоградской области', sector: 'Финансы', icon: 'finance', lean: -1,
    weights: { bankingRisk: 0.45, debtRisk: 0.35, currencyRisk: 0.2 } },
  { id: 'mining', name: 'Рудногорская область', short: 'Рудногорская', city: 'Рудногорск', loc: 'Рудногорской области', gen: 'Рудногорской области', sector: 'Добыча и энергетика', icon: 'mining', lean: 2,
    weights: { inflationRisk: 0.35, recessionRisk: 0.35, bankingRisk: 0.3 } },
  { id: 'periphery', name: 'Боровская область', short: 'Боровская', city: 'Боровец', loc: 'Боровской области', gen: 'Боровской области', sector: 'Лес, село и услуги', icon: 'periphery', lean: 7,
    weights: { politicalTension: 0.2, recessionRisk: 0.3, inflationRisk: 0.2, currencyRisk: 0.3 } },
];
/* Земли, которые могут войти в состав страны после войны с Норландом (см.
   ANNEX_EFFECT). objective — цель операции, которой была эта земля. Пока земля
   не присоединена, её нет ни на карте областей, ни в голосовании. Присоединённая
   живёт как область, но с лояльностью (annexLoyalty): она стартует низкой, пока
   она ниже PARTISAN_BELOW — там партизаны и саботаж, а голосовать область
   начинает, когда лояльность впервые дойдёт до INTEGRATED_AT. */
const ANNEX_REGIONS = [
  { id: 'pereval', objective: 'pass', name: 'Перевальский район', short: 'Перевальский', city: 'Перевальск', loc: 'Перевальском районе', gen: 'Перевальского района',
    sector: 'Горный транзит', icon: 'pereval', lean: -4, annex: true, loyalty0: 22,
    weights: { politicalTension: 0.4, recessionRisk: 0.3, currencyRisk: 0.3 } },
  { id: 'halvik', objective: 'mines', name: 'Хальвикский край', short: 'Хальвикский', city: 'Хальвик', loc: 'Хальвикском крае', gen: 'Хальвикского края',
    sector: 'Рудники', icon: 'halvik', lean: -3, annex: true, loyalty0: 18,
    weights: { inflationRisk: 0.35, recessionRisk: 0.35, bankingRisk: 0.3 } },
  { id: 'nordholm', objective: 'city', name: 'Нордхольмская область', short: 'Нордхольмская', city: 'Нордхольм', loc: 'Нордхольмской области', gen: 'Нордхольмской области',
    sector: 'Бывшая столица Норланда', icon: 'nordholm', lean: -9, annex: true, loyalty0: 8,
    weights: { politicalTension: 0.5, recessionRisk: 0.25, inflationRisk: 0.25 } },
];
const ALL_REGIONS = [...MAP_REGIONS, ...ANNEX_REGIONS];
const REGION_BY_ID = Object.fromEntries(ALL_REGIONS.map((r) => [r.id, r]));
const regionById = (id) => REGION_BY_ID[id] || null;
const ANNEX_REGION_OF = Object.fromEntries(ANNEX_REGIONS.map((r) => [r.objective, r.id]));
const PARTISAN_BELOW = 35;
const INTEGRATED_AT = 50;
const INTEGRATION_COST = 0.08; // % ВВП за квартал на одну область
// области страны сейчас: исходные и присоединённые
const activeRegions = (s) => [...MAP_REGIONS, ...ANNEX_REGIONS.filter((r) => (s.annexed || []).includes(r.objective))];
// голосуют исходные и уже интегрированные
const votingRegions = (s) => activeRegions(s).filter((r) => !r.annex || (s.annexIntegrated || []).includes(r.id));
const annexLoyalty = (s, id) => {
  const v = (s.annexLoyalty || {})[id];
  return Number.isFinite(v) ? v : (regionById(id) || {}).loyalty0 || 0;
};
function regionStress(region, economy) {
  const fields = {
    politicalTension: clamp(economy.politicalTension || 0, 0, 100),
    bankingRisk: clamp(economy.bankingRisk || 0, 0, 100),
    debtRisk: clamp(economy.debtRisk || 0, 0, 100),
    currencyRisk: clamp(economy.currencyRisk || 0, 0, 100),
    recessionRisk: clamp(economy.recessionRisk || 0, 0, 100),
    inflationRisk: clamp(economy.inflationRisk || 0, 0, 100),
  };
  let sum = 0; let wsum = 0;
  Object.entries(region.weights).forEach(([k, w]) => { sum += (fields[k] || 0) * w; wsum += w; });
  const base = wsum > 0 ? sum / wsum : 0;
  // поверх общенационального фона — то, что случилось именно здесь: достроенные
  // объекты (надолго), недавние события (сходят) и работа на идущей стройке
  const built = (economy.regionMods || {})[region.id] || 0;
  const shock = (economy.regionShock || {})[region.id] || 0;
  const building = (economy.projects || []).some((x) => x.region === region.id) ? -4 : 0;
  // война: прифронтовая область живёт под обстрелом, остальные — в тылу
  const atWar = (economy.warQuartersLeft || 0) > 0;
  const war = atWar ? (warFrontRegion(economy) === region.id ? 22 : 5) : 0;
  // новые земли: чем ниже лояльность, тем неспокойнее
  const unrest = region.annex ? Math.max(0, 60 - annexLoyalty(economy, region.id)) * 0.75 : 0;
  return clamp(base + built + shock + building + war + unrest, 0, 100);
}
/* Где проходит фронт. В обороне противник заходит со степной границы на юго-западе
   (Приреченская область), в наступлении страна сама бьёт на север, из Рудногорской
   области. Карта рисует фронт по той же привязке. */
const WAR_FRONT_REGION = { defensive: 'agri', offensive: 'mining' };
function warFrontRegion(economy) {
  if (!((economy.warQuartersLeft || 0) > 0)) return null;
  // в войне за новые земли фронт там, куда бьёт Норланд
  if (economy.warType === 'revanche') return (economy.revancheCampaign && economy.revancheCampaign.next) || null;
  if (economy.warType === 'defensive' && economy.defenseCampaign) return economy.defenseCampaign.next || economy.defenseCampaign.occupied[0] || null;
  if (economy.warType === 'offensive') return WAR_TARGETS[warTargetOf(economy)].front;
  return WAR_FRONT_REGION[economy.warType] || WAR_FRONT_REGION.defensive;
}
/* ============================ СТРОЙКИ В ОКРУГАХ ============================
   У каждого округа — своя большая стройка, отвечающая его характеру: метро в
   Велеграде, глубоководный порт в Янтарске, электростанция в Рудногорских горах. Стройка идёт
   несколько кварталов и всё это время стоит денег (cost — % ВВП в год: это
   госинвестиции сверх ползунка, они входят в ВВП, дефицит и индекс
   инфраструктуры). Пока идёт стройка, в округе есть работа — напряжение ниже.
   Достроенная — навсегда снижает напряжение округа (relief) и даёт свой эффект
   на экономику. Запускает стройку Минфин; живой президент — поверх него. */
const REGION_PROJECTS = [
  { id: 'metro', region: 'capital', name: 'Велеградское метро', doneHeadline: 'ОТКРЫТО ВЕЛЕГРАДСКОЕ МЕТРО', quarters: 8, cost: 0.35, relief: 12,
    effect: 'Инфраструктура и доверие к власти: столица видит результат каждый день.',
    done: (d) => [makeImpulse('infrastructureIndex', 2.5, 'Открыто велеградское метро', 'fast', d, 'other'),
      makeImpulse('approvalPush', 2.5, 'Открыто велеградское метро', 'fast', d, 'other')] },
  { id: 'deepport', region: 'port', name: 'Глубоководный порт', doneHeadline: 'ОТКРЫТ ГЛУБОКОВОДНЫЙ ПОРТ В ЯНТАРСКЕ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Экспорт растёт: к причалам встают суда, которые раньше шли к соседям.',
    done: (d) => [sustainedImpulse('exportsGrowth', 1.2, 4, 'Глубоководный порт принимает крупные суда'),
      makeImpulse('infrastructureIndex', 1.5, 'Глубоководный порт', 'fast', d, 'other')] },
  { id: 'factories', region: 'industry', name: 'Модернизация заводов', doneHeadline: 'ЗАВОДЫ КУЗНЕЦКА МОДЕРНИЗИРОВАНЫ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Производительность: новые станки выпускают больше тем же числом рук.',
    done: (d) => [makeImpulse('productivity', 1.6, 'Заводы Кузнецкой области модернизированы', 'slow', d, 'other')] },
  { id: 'irrigation', region: 'agri', name: 'Ирригация и элеваторы', doneHeadline: 'ИРРИГАЦИЯ И ЭЛЕВАТОРЫ ПРИРЕЧЬЯ ГОТОВЫ', quarters: 4, cost: 0.2, relief: 12,
    effect: 'Дешевле продовольствие: урожай меньше зависит от погоды и доезжает до города.',
    done: (d) => [makeImpulse('inflationSupply', -0.35, 'Ирригация Приреченской области снижает цены на продовольствие', 'slow', d, 'other')] },
  { id: 'powerplant', region: 'mining', name: 'Новая электростанция', doneHeadline: 'НОВАЯ ЭЛЕКТРОСТАНЦИЯ ДАЛА ТОК', quarters: 8, cost: 0.4, relief: 12,
    effect: 'Дешевле энергия для всей страны: ниже издержки и инфляция предложения.',
    done: (d) => [makeImpulse('inflationSupply', -0.45, 'Новая электростанция удешевляет энергию', 'slow', d, 'other'),
      makeImpulse('infrastructureIndex', 1.5, 'Новая электростанция', 'fast', d, 'other')] },
  { id: 'techpark', region: 'finance', name: 'Технопарк при бирже', doneHeadline: 'ОТКРЫТ ТЕХНОПАРК ЗЛАТОГРАДА', quarters: 5, cost: 0.25, relief: 10,
    effect: 'Производительность и доверие бизнеса: деньги и идеи находят друг друга.',
    done: (d) => [makeImpulse('productivity', 1.0, 'Открыт технопарк Златограда', 'slow', d, 'other'),
      makeImpulse('businessConfidence', 4, 'Открыт технопарк Златограда', 'default', d, 'other')] },
  { id: 'railway', region: 'periphery', name: 'Железная дорога на Боровец', doneHeadline: 'ЖЕЛЕЗНАЯ ДОРОГА ДОШЛА ДО БОРОВЦА', quarters: 7, cost: 0.3, relief: 14,
    effect: 'Боровская область перестаёт пустеть: работа и рынки становятся ближе.',
    done: (d) => [makeImpulse('infrastructureIndex', 2.2, 'Железная дорога дошла до Боровца', 'fast', d, 'other'),
      makeImpulse('laborForce', 0.25, 'Боровская область перестаёт пустеть', 'slow', d, 'other')] },
  // новые земли: стройка там ещё и поднимает лояльность (см. annexStep и regionStep)
  { id: 'tunnel', region: 'pereval', name: 'Тоннель под перевалом', doneHeadline: 'ОТКРЫТ ТОННЕЛЬ ПОД ПЕРЕВАЛОМ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Перевал проходим круглый год: транзит и экспорт, а район — часть страны не только на карте.',
    done: (d) => [makeImpulse('infrastructureIndex', 1.5, 'Открыт тоннель под перевалом', 'fast', d, 'other'),
      sustainedImpulse('exportsGrowth', 0.8, 4, 'Транзит через тоннель')] },
  { id: 'halvik_mines', region: 'halvik', name: 'Модернизация Хальвикских копей', doneHeadline: 'ХАЛЬВИКСКИЕ КОПИ МОДЕРНИЗИРОВАНЫ', quarters: 5, cost: 0.3, relief: 10,
    effect: 'Новые шахты и обогатительная фабрика: больше руды на экспорт и работа для края.',
    done: (d) => [sustainedImpulse('exportsGrowth', 1.0, 6, 'Модернизированные копи Хальвика'),
      makeImpulse('inflationSupply', -0.2, 'Руда Хальвика дешевеет', 'slow', d, 'other')] },
  { id: 'nordholm_rebuild', region: 'nordholm', name: 'Восстановление Нордхольма', doneHeadline: 'НОРДХОЛЬМ ВОССТАНОВЛЕН', quarters: 8, cost: 0.4, relief: 14,
    effect: 'Город отстраивают после войны: лучший довод для тех, кто ещё ждёт возвращения Норланда.',
    done: (d) => [makeImpulse('approvalPush', 1, 'Нордхольм восстановлен', 'fast', d, 'other'),
      makeImpulse('laborForce', 0.2, 'Нордхольм снова живёт', 'slow', d, 'other')] },
];
const PROJECT_BY_ID = Object.fromEntries(REGION_PROJECTS.map((p) => [p.id, p]));
const MAX_ACTIVE_PROJECTS = 3;
// почему стройку сейчас нельзя начать — или null, если можно
function projectBlocker(p, s) {
  if (!p) return 'такой стройки нет';
  if (!activeRegions(s).some((r) => r.id === p.region)) return 'эта земля не в составе страны';
  if ((s.projectsBuilt || []).includes(p.id)) return 'уже завершено';
  const active = s.projects || [];
  if (active.some((x) => x.id === p.id)) return 'уже строится';
  if (active.length >= MAX_ACTIVE_PROJECTS) return `одновременно — не больше ${MAX_ACTIVE_PROJECTS} строек`;
  if ((s.marketLockoutQuartersLeft || 0) > 0 || s.imfActive) return 'бюджет без доступа к рынку: большие стройки заморожены';
  return null;
}
// первая и последняя очередь стройки стоят меньше полной: разворачивание и сдача
const projectRamp = (x) => (x.left === x.total || x.left === 1 ? 0.6 : 1);
const projectSpendPct = (projects) => (projects || []).reduce((a, x) => a + (PROJECT_BY_ID[x.id] || { cost: 0 }).cost * projectRamp(x), 0);

/* ============================ СОБЫТИЯ В ОКРУГАХ ============================
   Округ сам подбрасывает задачу: забастовку, неурожай, аварию. Событие
   вспыхивает в конце квартала, и на следующий квартал на него надо ответить —
   иначе срабатывает вариант «переждать» (defaultOption). Ответ стоит денег
   (spend — % ВВП разово), двигает экономику импульсами и напряжение округа
   (shock — сколько пунктов прибавить к его напряжению; сходит на треть за квартал).
   tone — для ботов: щедрый, дешёвый, жёсткий или выжидательный ответ. */
const REGION_EVENTS = [
  { id: 'miners_strike', region: 'mining', title: 'Забастовка шахтёров',
    text: (s) => `Горняки Рудногорска остановили добычу: при инфляции ${fmt1(s.inflation)}% зарплата не покрывает жизнь. Профсоюз требует индексации.`,
    weight: (s) => 1 + 0.12 * Math.max(0, s.inflation - 5) + 0.3 * Math.max(0, s.unemployment - 6),
    defaultOption: 'wait',
    options: [
      { id: 'pay', tone: 'generous', label: 'Проиндексировать зарплаты горнякам', spend: 0.15, shock: -12,
        effect: 'Добыча возобновится, но индексация разгоняет цены.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.15, 'Индексация зарплат шахтёрам', 'slow', d, 'other'),
          makeImpulse('approvalPush', 1, 'Требования шахтёров выполнены', 'fast', d, 'other')] },
      { id: 'talks', tone: 'cheap', label: 'Переговоры и обещания', spend: 0.03, shock: -4,
        effect: 'Дёшево, но обещания придётся выполнять — иначе забастовка вернётся.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1, 'Шахтёрам дали обещания', 'fast', d, 'other')] },
      { id: 'crush', tone: 'hard', label: 'Разогнать пикеты', spend: 0, shock: -6,
        effect: 'Шахты заработают, но страна запомнит дубинки.',
        impulses: (s, d) => [makeImpulse('tensionPush', 4, 'Разгон забастовки шахтёров', 'fast', d, 'other'),
          makeImpulse('approvalPush', -3, 'Разгон забастовки шахтёров', 'fast', d, 'other'),
          makeImpulse('govTrust', -3, 'Разгон забастовки шахтёров', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Переждать', spend: 0, shock: 12,
        effect: 'Добыча стоит, энергия дорожает, забастовка расползается.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.25, 'Шахты стоят: энергия дорожает', 'default', d, 'other'),
          makeImpulse('exportsGrowth', -1.5, 'Шахты стоят', 'default', d, 'other'),
          makeImpulse('tensionPush', 2.5, 'Забастовка шахтёров расползается', 'fast', d, 'other')] },
    ] },
  { id: 'drought', region: 'agri', title: 'Засуха и неурожай',
    text: () => 'В Приреченской области засуха: урожай на треть ниже прошлогоднего, хозяйства просят помощи, а в городах начинают дорожать хлеб и крупа.',
    weight: () => 1.1,
    defaultOption: 'wait',
    options: [
      { id: 'import', tone: 'cheap', label: 'Закупить зерно за рубежом', spend: 0.08, shock: -5,
        effect: 'Цены не взлетят, но деньги уйдут соседям, а не своим фермерам.',
        impulses: (s, d) => [makeImpulse('importsGrowth', 2, 'Закупки зерна за рубежом', 'fast', d, 'other')] },
      { id: 'subsidy', tone: 'generous', label: 'Субсидировать фермеров', spend: 0.15, shock: -12,
        effect: 'Хозяйства переживут год, а цены вырастут умеренно.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.15, 'Неурожай: цены на продовольствие', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Пусть рынок разберётся', spend: 0, shock: 10,
        effect: 'Продовольствие заметно дорожает, село злится.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.6, 'Неурожай: продовольствие дорожает', 'default', d, 'other'),
          makeImpulse('approvalPush', -1.5, 'Неурожай и дорогой хлеб', 'fast', d, 'other')] },
    ] },
  { id: 'port_accident', region: 'port', title: 'Авария в порту',
    text: () => 'В Янтарске обрушился старый причал: треть терминалов закрыта, суда уходят на рейд или к соседям.',
    weight: (s) => 0.8 + 0.01 * (s.currencyRisk || 0),
    defaultOption: 'wait',
    options: [
      { id: 'repair', tone: 'generous', label: 'Срочный ремонт за счёт бюджета', spend: 0.12, shock: -7,
        effect: 'Через квартал порт работает в полную силу.',
        impulses: (s, d) => [makeImpulse('exportsGrowth', 0.5, 'Порт быстро восстановлен', 'fast', d, 'other')] },
      { id: 'concession', tone: 'cheap', label: 'Отдать терминал в концессию', spend: 0, shock: 3,
        effect: 'Ремонт за счёт инвестора: бизнес доволен, портовики — нет.',
        impulses: (s, d) => [makeImpulse('businessConfidence', 2.5, 'Порт отдан в концессию', 'default', d, 'other'),
          makeImpulse('fdi', 1, 'Порт отдан в концессию', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Чинить в плановом порядке', spend: 0, shock: 8,
        effect: 'Экспорт проседает на несколько кварталов.',
        impulses: (s, d) => [makeImpulse('exportsGrowth', -2.5, 'Порт работает вполсилы', 'default', d, 'other')] },
    ] },
  { id: 'bank_panic', region: 'finance', title: 'Паника вкладчиков в Златограде',
    text: (s) => `У отделений местного банка очереди: слух о его проблемах разошёлся быстрее опровержения. Банковский риск по стране ${Math.round(s.bankingRisk || 0)} из 100.`,
    weight: (s) => 0.5 + 0.03 * Math.max(0, (s.bankingRisk || 0) - 25),
    defaultOption: 'wait',
    options: [
      { id: 'guarantee', tone: 'generous', label: 'Гарантировать вклады', spend: 0.1, shock: -9,
        effect: 'Очереди расходятся, доверие к банкам цело.',
        impulses: (s, d) => [makeImpulse('riskPremium', -0.05, 'Вклады в Златограде гарантированы', 'fast', d, 'other'),
          makeImpulse('consumerConfidence', 1.5, 'Вклады гарантированы', 'fast', d, 'other')] },
      { id: 'bail_in', tone: 'cheap', label: 'Санировать за счёт акционеров', spend: 0, shock: 3,
        effect: 'Бюджет цел, но инвесторы запомнят, что держать акции банков опасно.',
        impulses: (s, d) => [makeImpulse('stockShock', -2, 'Санация банка за счёт акционеров', 'fast', d, 'other'),
          makeImpulse('businessConfidence', -1.5, 'Санация банка за счёт акционеров', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Не вмешиваться', spend: 0, shock: 10,
        effect: 'Банк лопается, паника перекидывается на соседей.',
        impulses: (s, d) => [makeImpulse('consumerConfidence', -3, 'Лопнул банк в Златограде', 'fast', d, 'other'),
          makeImpulse('riskPremium', 0.12, 'Лопнул банк в Златограде', 'default', d, 'other')] },
    ] },
  { id: 'plant_closure', region: 'industry', title: 'Закрывается градообразующий завод',
    text: (s) => `Кузнецкий машиностроительный объявил о закрытии: заказов нет, кредит дорог (ставка ${fmt1(s.keyRate)}%). Без работы останутся тысячи людей.`,
    weight: (s) => 0.6 + 0.35 * Math.max(0, -(s.outputGap || 0)) + 0.05 * Math.max(0, (s.keyRate || 0) - 8),
    defaultOption: 'wait',
    options: [
      { id: 'order', tone: 'generous', label: 'Дать заводу госзаказ', spend: 0.15, shock: -12,
        effect: 'Завод работает, город спокоен — пока не кончится заказ.',
        impulses: () => [] },
      { id: 'retrain', tone: 'cheap', label: 'Переобучение и пособия', spend: 0.06, shock: -4,
        effect: 'Люди переходят в новые отрасли — медленно, зато навсегда.',
        impulses: (s, d) => [makeImpulse('productivity', 0.3, 'Переобучение рабочих Кузнецка', 'slow', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Не мешать рынку', spend: 0, shock: 10,
        effect: 'Безработица в поясе растёт, рейтинг власти падает.',
        impulses: (s, d) => [makeImpulse('unemployment', 0.25, 'Закрыт завод в Кузнецке', 'default', d, 'other'),
          makeImpulse('approvalPush', -1, 'Закрыт завод в Кузнецке', 'fast', d, 'other')] },
    ] },
  { id: 'capital_rally', region: 'capital', title: 'Митинг у стен правительства',
    // при ручном управлении пресса не пишет ни о рейтинге, ни о «десятках тысяч» —
    // только о «несогласованной акции»
    text: (s) => (s.politicalRegime === 'authoritarian'
      ? `У здания правительства — несогласованная акция. Власти призывают граждан не поддаваться на провокации; напряжённость ${Math.round(s.politicalTension || 0)} из 100.`
      : `На площади перед правительством десятки тысяч человек. Одобрение власти ${Math.round(s.approval)} из 100, напряжённость ${Math.round(s.politicalTension || 0)} из 100.`),
    weight: (s) => 0.3 + 0.03 * Math.max(0, (s.politicalTension || 0) - 30) + 0.03 * Math.max(0, 50 - (s.approval || 50)),
    eligible: (s) => s.politicalRegime !== 'totalitarian',
    defaultOption: 'allow',
    options: [
      { id: 'meet', tone: 'generous', label: 'Выйти к людям', spend: 0, shock: -8,
        effect: 'Разговор вместо оцепления — рейтинг растёт, если есть что сказать.',
        impulses: (s, d) => [makeImpulse('approvalPush', 2, 'Власть вышла к митингующим', 'fast', d, 'other'),
          makeImpulse('tensionPush', -2, 'Власть вышла к митингующим', 'fast', d, 'other')] },
      { id: 'allow', tone: 'cheap', label: 'Разрешить и не мешать', spend: 0, shock: -2,
        effect: 'Митинг проходит спокойно и расходится.',
        impulses: (s, d) => [makeImpulse('tensionPush', -1, 'Митинг прошёл спокойно', 'fast', d, 'other')] },
      { id: 'ban', tone: 'hard', label: 'Запретить митинг', spend: 0, shock: -4,
        effect: 'Площадь пустеет, недовольство уходит внутрь.',
        impulses: (s, d) => [makeImpulse('tensionPush', 3, 'Митинг запрещён', 'fast', d, 'other'),
          makeImpulse('govTrust', -2, 'Митинг запрещён', 'default', d, 'other')] },
    ] },
  { id: 'wildfire', region: 'periphery', title: 'Лесные пожары под Боровцом',
    text: () => 'Горят боровские леса: огонь подходит к посёлкам, дым висит над Боровцом вторую неделю.',
    weight: (s, q) => 0.5 + ((q % 4) === 2 || (q % 4) === 3 ? 0.6 : 0),
    defaultOption: 'regional',
    options: [
      { id: 'army', tone: 'generous', label: 'Бросить армию и авиацию', spend: 0.08, shock: -8,
        effect: 'Огонь сбит за неделю, область видит, что о ней помнят.',
        impulses: (s, d) => [makeImpulse('approvalPush', 1, 'Пожары под Боровцом потушены', 'fast', d, 'other')] },
      { id: 'regional', tone: 'wait', label: 'Пусть справляется область', spend: 0, shock: 9,
        effect: 'Посёлки горят, Боровская область снова чувствует себя забытой.',
        impulses: (s, d) => [makeImpulse('approvalPush', -1.5, 'Боровскую область оставили один на один с пожарами', 'fast', d, 'other')] },
    ] },
  { id: 'youth_exodus', region: 'periphery', title: 'Молодёжь уезжает из Боровской области',
    text: () => 'Школы Боровской области выпускают больше, чем остаётся: молодые семьи уезжают в столицу и за границу.',
    weight: (s) => 0.3 + 0.2 * Math.max(0, (s.unemployment || 0) - 6),
    defaultOption: 'wait',
    options: [
      { id: 'grants', tone: 'generous', label: 'Подъёмные и жильё для молодых', spend: 0.06, shock: -7,
        effect: 'Часть семей остаётся — область стареет медленнее.',
        impulses: () => [] },
      { id: 'wait', tone: 'wait', label: 'Ничего не делать', spend: 0, shock: 5,
        effect: 'Рабочих рук в стране становится чуть меньше.',
        impulses: (s, d) => [makeImpulse('laborForce', -0.15, 'Отток из Боровской области', 'slow', d, 'other')] },
    ] },
  /* Новые земли: события только там, где земля уже присоединена. loyalty — сколько
     пунктов лояльности области прибавит или отнимет ответ (см. annexStep). */
  { id: 'nordholm_underground', region: 'nordholm', title: 'Подполье в Нордхольме',
    text: (s) => `В Нордхольме раскрыта подпольная сеть: листовки, склады оружия, списки «пособников». Лояльность области ${Math.round(annexLoyalty(s, 'nordholm'))} из 100.`,
    eligible: (s) => (s.annexed || []).includes('city'),
    weight: (s) => 0.6 + Math.max(0, 50 - annexLoyalty(s, 'nordholm')) / 30,
    defaultOption: 'wait',
    options: [
      { id: 'amnesty', tone: 'generous', label: 'Амнистия тем, кто сдаст оружие', spend: 0.06, shock: -8, loyalty: 10,
        effect: 'Часть подполья выходит из тени; в столице ворчат о мягкости.',
        impulses: (s, d) => [makeImpulse('approvalPush', -0.5, 'Амнистия подпольщикам Нордхольма', 'fast', d, 'other')] },
      { id: 'sweep', tone: 'hard', label: 'Зачистка кварталов', spend: 0.03, shock: -4, loyalty: -8,
        effect: 'Сеть разгромлена, но каждый обыск рождает новых подпольщиков.',
        impulses: (s, d) => [makeImpulse('tensionPush', 2, 'Зачистка в Нордхольме', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Наблюдать', spend: 0, shock: 8, loyalty: -4,
        effect: 'Подполье растёт и готовит следующий удар.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1.5, 'Подполье в Нордхольме растёт', 'fast', d, 'other')] },
    ] },
  { id: 'halvik_schools', region: 'halvik', title: 'Школы на норландском языке',
    text: () => 'Родители в Хальвике требуют оставить школы на норландском языке. Министерство образования готовит единую программу для всей страны.',
    eligible: (s) => (s.annexed || []).includes('mines'),
    weight: () => 0.9,
    defaultOption: 'wait',
    options: [
      { id: 'allow', tone: 'generous', label: 'Оставить школы на родном языке', spend: 0.02, shock: -6, loyalty: 9,
        effect: 'Край успокаивается; националисты в столице недовольны.',
        impulses: (s, d) => [makeImpulse('approvalPush', -0.6, 'Уступка хальвикским школам', 'fast', d, 'other')] },
      { id: 'ban', tone: 'hard', label: 'Единая программа для всех', spend: 0, shock: 5, loyalty: -10,
        effect: 'Одна страна — одна школа; край запомнит.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1, 'Хальвикские школы закрыты', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Отложить решение', spend: 0, shock: 4, loyalty: -3,
        effect: 'Вопрос висит, и обе стороны считают, что их не слышат.',
        impulses: () => [] },
    ] },
  { id: 'pereval_smuggling', region: 'pereval', title: 'Контрабанда через перевал',
    text: () => 'Через перевал идут фуры без документов: старые норландские связи работают лучше новых таможен.',
    eligible: (s) => (s.annexed || []).includes('pass'),
    weight: () => 0.8,
    defaultOption: 'wait',
    options: [
      { id: 'customs', tone: 'hard', label: 'Закрыть перевал таможней', spend: 0.05, shock: 3, loyalty: -5,
        effect: 'Бюджет получает пошлины, район теряет заработок.',
        impulses: (s, d) => [makeImpulse('importsGrowth', -0.6, 'Таможня на перевале', 'fast', d, 'other')] },
      { id: 'legalize', tone: 'generous', label: 'Легализовать приграничную торговлю', spend: 0, shock: -6, loyalty: 7,
        effect: 'Торговля выходит из тени, а район — из подполья.',
        impulses: (s, d) => [makeImpulse('importsGrowth', 0.8, 'Приграничная торговля на перевале', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Закрывать глаза', spend: 0, shock: 2, loyalty: 0,
        effect: 'Всё идёт как шло: мимо бюджета.',
        impulses: () => [] },
    ] },
];
const REGION_EVENT_BY_ID = Object.fromEntries(REGION_EVENTS.map((e) => [e.id, e]));
// то, что видит интерфейс: без функций, с текстом на момент события
function publicRegionEvent(ev, s, q) {
  return { id: ev.id, region: ev.region, title: ev.title, text: ev.text(s), q, defaultOption: ev.defaultOption,
    options: ev.options.map((o) => ({ id: o.id, label: o.label, effect: o.effect, spend: o.spend, shock: o.shock, tone: o.tone, loyalty: o.loyalty || 0 })) };
}

/* Шаг округов за квартал: ответ на прошлое событие, ход строек, новое событие.
   Возвращает импульсы, разовые расходы и новое состояние — simulateQuarter
   вплетает это в бюджет, ВВП и ленту новостей. */
function regionStep(s, decisions, difficulty, quarterIndex) {
  const out = { impulses: [], news: [], eventPct: 0, loyaltyDelta: {} };
  // напряжение от прошлых событий сходит на треть за квартал
  const shock = {};
  Object.entries(s.regionShock || {}).forEach(([id, v]) => { const nv = v * 0.65; if (Math.abs(nv) >= 0.5) shock[id] = nv; });
  // 1) ответ на событие прошлого квартала
  let resolution = null;
  const pend = s.regionEvent ? REGION_EVENT_BY_ID[s.regionEvent.id] : null;
  if (pend) {
    const chosen = pend.options.find((o) => o.id === decisions.regionResponse);
    const opt = chosen || pend.options.find((o) => o.id === pend.defaultOption);
    out.impulses.push(...opt.impulses(s, difficulty));
    out.eventPct += opt.spend;
    shock[pend.region] = (shock[pend.region] || 0) + opt.shock;
    if (opt.loyalty) out.loyaltyDelta[pend.region] = (out.loyaltyDelta[pend.region] || 0) + opt.loyalty;
    const region = regionById(pend.region);
    resolution = { id: pend.id, region: pend.region, title: pend.title, option: opt.id, label: opt.label, byDefault: !chosen, q: quarterIndex };
    out.news.push(['gov', `${region.name.toUpperCase()}: ${pend.title.toUpperCase()} — ${chosen ? opt.label.toUpperCase() : 'РЕШЕНИЯ НЕ ПРИНЯЛИ'}`,
      `${chosen ? `Ответ власти: «${opt.label}».` : `Ответа так и не дали — вышло «${opt.label.toLowerCase()}».`} ${opt.effect}${opt.spend ? ` Стоимость — около ${fmt1(opt.spend)}% ВВП.` : ''}`, 7]);
  }
  // 2) стройки: старт, ход, сдача
  let projects = (s.projects || []).map((x) => ({ ...x }));
  const built = [...(s.projectsBuilt || [])];
  const mods = { ...s.regionMods };
  const startP = PROJECT_BY_ID[decisions.startProject];
  if (startP && !projectBlocker(startP, s)) {
    projects.push({ id: startP.id, region: startP.region, left: startP.quarters, total: startP.quarters, startedQ: quarterIndex });
    const region = regionById(startP.region);
    out.news.push(['gov', `СТАРТ СТРОЙКИ: ${startP.name.toUpperCase()}`,
      `${region.name}: ${startP.name.toLowerCase()} — ${startP.quarters} кв. работ, около ${fmt1(startP.cost)}% ВВП в год из бюджета. ${startP.effect}`, 6]);
  }
  const projectPct = projectSpendPct(projects);
  const still = [];
  projects.forEach((x) => {
    const left = x.left - 1;
    if (left > 0) { still.push({ ...x, left }); return; }
    const p = PROJECT_BY_ID[x.id];
    built.push(x.id);
    mods[x.region] = (mods[x.region] || 0) - p.relief;
    out.impulses.push(...p.done(difficulty), makeImpulse('approvalPush', 1, `Сдан объект: ${p.name}`, 'fast', difficulty, 'other'));
    const region = regionById(x.region);
    // на новой земле построенное — лучший довод, что она теперь своя
    if (region.annex) out.loyaltyDelta[x.region] = (out.loyaltyDelta[x.region] || 0) + 15;
    // у каждой стройки свой глагол: метро открывают, копи модернизируют, город восстанавливают
    out.news.push(['gov', p.doneHeadline || `ЗАВЕРШЕНО: ${p.name.toUpperCase()}`, `${region.name}: работы завершены — «${p.name}». ${p.effect} Напряжение в области снижается надолго.`, 8]);
  });
  projects = still;
  // 3) новое событие — не каждый квартал и не раньше третьего
  let cooldown = Math.max(0, (Number.isFinite(s.regionEventCooldown) ? s.regionEventCooldown : 1) - 1);
  let regionEvent = null;
  if (pend) cooldown = Math.max(cooldown, 1);
  if (!pend && cooldown === 0 && quarterIndex >= 3) {
    const pool = REGION_EVENTS.filter((e) => (!e.eligible || e.eligible(s)));
    const stressOf = (id) => regionStress(regionById(id), s);
    const maxStress = Math.max(...activeRegions(s).map((r) => stressOf(r.id)));
    if (pool.length && rng() < clamp(0.22 + 0.004 * maxStress, 0.22, 0.55)) {
      const weights = pool.map((e) => Math.max(0.05, e.weight(s, quarterIndex)) * (1 + stressOf(e.region) / 50));
      let r = rng() * weights.reduce((a, b) => a + b, 0);
      const ev = pool.find((e, i) => { r -= weights[i]; return r <= 0; }) || pool[pool.length - 1];
      regionEvent = publicRegionEvent(ev, s, quarterIndex);
      cooldown = 2;
      const region = regionById(ev.region);
      out.news.push(['crisis', `${region.name.toUpperCase()}: ${ev.title.toUpperCase()}`, `${regionEvent.text} Решение — за правительством: ответ нужен в следующем квартале.`, 8]);
    }
  }
  return { ...out, projects, projectsBuilt: built, regionMods: mods, regionShock: shock, regionEvent,
    regionEventCooldown: cooldown, lastRegionResolution: resolution || s.lastRegionResolution || null, projectPct };
}

/* Бот-Минфин на карте: запускает стройку там, где хуже всего, если бюджет
   позволяет, и отвечает на событие по характеру — популист платит, консерватор
   экономит, технократ платит, только если округ уже на грани. */
function botRegionPlan(s, P, consolidationNeed) {
  const plan = { startProject: null, regionResponse: null };
  const active = (s.projects || []).length;
  const limit = P.investBias >= 1.2 ? 2 : 1;
  const room = consolidationNeed < 0.5 || (s.outputGap < -2 && P.id !== 'austerity');
  if (active < limit && room) {
    const cands = REGION_PROJECTS.filter((p) => !projectBlocker(p, s))
      .map((p) => ({ p, stress: regionStress(regionById(p.region), s) }))
      .sort((a, b) => b.stress - a.stress);
    if (cands.length) plan.startProject = cands[0].p.id;
  }
  const ev = s.regionEvent ? REGION_EVENT_BY_ID[s.regionEvent.id] : null;
  if (ev) {
    const byTone = (t) => ev.options.find((o) => o.tone === t);
    const stress = regionStress(regionById(ev.region), s);
    const pick = P.id === 'populist' ? (byTone('generous') || byTone('cheap'))
      : P.id === 'austerity' ? (byTone('cheap') || byTone('wait'))
        : (stress >= 45 ? byTone('generous') : byTone('cheap')) || byTone('generous');
    plan.regionResponse = (pick || ev.options.find((o) => o.id === ev.defaultOption)).id;
  }
  // требование группы: популист уступает, экономный обещает, остальные уступают,
  // только если группа уже на грани
  if (s.groupDemand) {
    const v = (s.groupSupport || {})[s.groupDemand.group] ?? 40;
    plan.groupResponse = P.id === 'populist' ? 'concede' : P.id === 'austerity' ? 'promise' : v < 32 ? 'concede' : 'promise';
  }
  // новые земли: популист интегрирует всё, экономный — только самую неспокойную,
  // остальные — пока область не стала своей, если бюджет позволяет
  const annex = activeRegions(s).filter((r) => r.annex && annexLoyalty(s, r.id) < 70)
    .sort((a, b) => annexLoyalty(s, a.id) - annexLoyalty(s, b.id));
  plan.integrate = P.id === 'populist' ? annex.map((r) => r.id)
    : P.id === 'austerity' || consolidationNeed >= 0.8 ? annex.slice(0, 1).map((r) => r.id)
      : annex.map((r) => r.id);
  return plan;
}

/* ======================== НАСТУПАТЕЛЬНАЯ ОПЕРАЦИЯ ========================
   Своя война — не только счётчик кварталов и санкции. Пока страна наступает на
   Норланд, у операции три цели, и каждый квартал президент отдаёт приказ: куда
   бить и как. Штурм быстр, дорог и стоит жизней; осада медленнее и дешевле;
   удержание почти не двигает фронт, зато гасит контратаки; перемирие закрывает
   войну по линии фронта. Продвижение зависит от доли обороны в бюджете и от
   того, насколько страна поддерживает армию. Взятые цели — не только флажок на
   карте: копи дают экспорт, перевал открывает дорогу на Нордхольм, падение
   Нордхольма при уже взятых остальных целях — капитуляция Норланда. */
const WAR_OBJECTIVES = [
  { id: 'pass', name: 'Ледяной перевал', headline: 'ВЗЯТ ЛЕДЯНОЙ ПЕРЕВАЛ', desc: 'Горный проход: без него к Нордхольму не подойти. Взятый — облегчает все следующие штурмы и гасит контратаки.' },
  { id: 'mines', name: 'Копи Хальвика', headline: 'ВЗЯТЫ КОПИ ХАЛЬВИКА', desc: 'Рудники у самой границы. Взятые — дают стране экспорт руды и удешевляют сырьё.' },
  // к столице ведут два пути: через перевал и с востока, от копей Хальвика
  { id: 'city', name: 'Нордхольм', headline: 'ВЗЯТ НОРДХОЛЬМ', desc: 'Столица Норланда. Подойти можно через перевал или со стороны копей Хальвика; её падение при уже взятых целях — капитуляция противника.', requiresAny: ['pass', 'mines'] },
];
/* Войну можно объявить любому соседу. У каждой страны свои цели операции; земли
   присоединяются только у Норланда (горный край, который и так спорный) — у Дешта и
   Вестравии взятое возвращается по миру, а счёт закрывают репарации. enemyK — насколько
   трудно продвигаться: Вестравия втрое больше и лучше вооружена, Дешт держит армию. */
const WAR_OBJECTIVES_SW = [
  { id: 'steppe', target: 'southwest', name: 'Приграничные степи', headline: 'ВЗЯТЫ ПРИГРАНИЧНЫЕ СТЕПИ', desc: 'Равнина за Приреченской областью: без неё к нефтепромыслам не подойти.' },
  { id: 'oil', target: 'southwest', name: 'Кумсайские нефтепромыслы', headline: 'ВЗЯТЫ КУМСАЙСКИЕ НЕФТЕПРОМЫСЛЫ', desc: 'Нефть Дешта. Взятые — дешевле топливо и дороже экспорт, пока идёт война.', requiresAny: ['steppe'] },
  { id: 'ashkala', target: 'southwest', name: 'Ашкала', headline: 'ВЗЯТА АШКАЛА', desc: 'Столица Дешта: её падение — капитуляция и репарации.', requiresAny: ['oil'] },
];
const WAR_OBJECTIVES_W = [
  { id: 'fort', target: 'west', name: 'Пограничные укрепления', headline: 'ПРОРВАНА ПОГРАНИЧНАЯ ЛИНИЯ ВЕСТРАВИИ', desc: 'Долговременная оборона вдоль границы — первое, что нужно прорвать.' },
  { id: 'limmern', target: 'west', name: 'Лиммерн', headline: 'ВЗЯТ ЛИММЕРН', desc: 'Промышленный город на пути к столице.', requiresAny: ['fort'] },
  { id: 'westgrad', target: 'west', name: 'Вестград', headline: 'ВЗЯТ ВЕСТГРАД', desc: 'Столица Вестравии: её падение — капитуляция и репарации.', requiresAny: ['limmern'] },
];
const WAR_OBJECTIVE_BY_ID = Object.fromEntries([...WAR_OBJECTIVES, ...WAR_OBJECTIVES_SW, ...WAR_OBJECTIVES_W].map((o) => [o.id, o]));
const WAR_TARGETS = {
  north: { name: 'Норланд', gen: 'Норланда', ins: 'с Норландом', up: 'НОРЛАНД', objectives: WAR_OBJECTIVES, enemyK: 1, front: 'mining' },
  southwest: { name: 'Дешт', gen: 'Дешта', ins: 'с Дештом', up: 'ДЕШТ', objectives: WAR_OBJECTIVES_SW, enemyK: 0.8, front: 'agri' },
  west: { name: 'Вестравия', gen: 'Вестравии', ins: 'с Вестравией', up: 'ВЕСТРАВИЯ', objectives: WAR_OBJECTIVES_W, enemyK: 0.5, front: 'periphery', partner: true },
};
const warTargetOf = (s) => (WAR_TARGETS[s && s.warTarget] ? s.warTarget : 'north');
const warObjectivesFor = (target) => (WAR_TARGETS[target] || WAR_TARGETS.north).objectives;
// кому можно объявить войну: у Норланда — пока ещё есть что взять
function warTargetAvailable(s, target) {
  if (!WAR_TARGETS[target] || (s.warQuartersLeft || 0) > 0) return false;
  if (target === 'north') return (s.annexed || []).length < 3;
  return true;
}
// бот-президент, решивший воевать, идёт на того, с кем отношения хуже всего
function defaultWarTarget(s) {
  const rel = relationsOf(s);
  const ok = Object.keys(WAR_TARGETS).filter((t) => warTargetAvailable(s, t));
  return ok.sort((a, b) => rel[a] - rel[b])[0] || 'north';
}
// цель не выбрана (указ из кабинета, а не с карты) — как и раньше, Норланд, пока у него есть что взять
const sanitizeWarTarget = (t, s) => (warTargetAvailable(s, t) ? t
  : !t && warTargetAvailable(s, 'north') ? 'north' : defaultWarTarget(s));
const WAR_STANCES = [
  { id: 'assault', label: 'Штурм', spend: 0.35, desc: 'Быстрое продвижение, но большие потери и расходы.' },
  { id: 'siege', label: 'Осада и обстрел', spend: 0.2, desc: 'Медленнее, дешевле, потерь меньше.' },
  { id: 'hold', label: 'Держать позиции', spend: 0.1, desc: 'Фронт почти не движется, контратаки противника слабее.' },
  { id: 'ceasefire', label: 'Предложить перемирие', spend: 0, desc: 'Закончить войну по нынешней линии фронта; взятые цели остаются за страной.' },
];
// уже присоединённое после прошлой войны считается взятым: второй раз его не штурмуют
const newWarCampaign = (annexed, target = 'north') => {
  const own = target === 'north' ? (annexed || []) : [];
  return { progress: Object.fromEntries(warObjectivesFor(target).map((o) => [o.id, own.includes(o.id) ? 100 : 0])), captured: [...own], last: null };
};
// что даёт присоединение: люди, руда, но и сопротивление на новых землях
const ANNEX_EFFECT = {
  pass: { name: 'Перевальский район', impulses: (d) => [makeImpulse('laborForce', 0.2, 'Присоединён Перевальский район', 'slow', d, 'other')] },
  mines: { name: 'Хальвикский край', impulses: (d) => [makeImpulse('laborForce', 0.3, 'Присоединён Хальвикский край', 'slow', d, 'other'),
    sustainedImpulse('exportsGrowth', 0.8, 16, 'Руда Хальвикского края'), makeImpulse('inflationSupply', -0.2, 'Своя руда Хальвика', 'slow', d, 'other')] },
  city: { name: 'Нордхольмская область', impulses: (d) => [makeImpulse('laborForce', 0.8, 'Присоединена Нордхольмская область', 'slow', d, 'other'),
    makeImpulse('approvalPush', 3, 'Присоединена Нордхольмская область', 'fast', d, 'other')] },
};
const warObjectiveOpen = (id, camp) => {
  const o = WAR_OBJECTIVE_BY_ID[id];
  const cap = camp.captured || [];
  return !!o && !cap.includes(id) && (!o.requires || cap.includes(o.requires))
    && (!o.requiresAny || o.requiresAny.some((x) => cap.includes(x)));
};
// сила армии: доля обороны в бюджете и поддержка в обществе
function warStrength(s) {
  const defense = (s.budgetShares && s.budgetShares.defense) || 15;
  return clamp(0.55 + (defense - 10) / 20 + ((s.approval || 50) - 50) / 200, 0.45, 1.5);
}
/* Приказ действует, пока его не отменят: без нового приказа армия продолжает
   прошлый (та же цель, если её ещё не взяли, и тот же способ). Самый первый
   приказ по умолчанию — осада ближайшей цели, армия действует по уставу. */
function defaultWarOrder(camp, enemy = 'north') {
  const last = camp.last && camp.last.stance !== 'ceasefire' ? camp.last : null;
  const first = warObjectivesFor(enemy).find((o) => warObjectiveOpen(o.id, camp));
  const target = last && warObjectiveOpen(last.target, camp) ? last.target : first ? first.id : null;
  return { target, stance: last ? last.stance : 'siege' };
}
/* Бот-президент командует по характеру: силовик штурмует, популист штурмует,
   пока его поддерживают, технократ и реформатор осаждают и ищут перемирие,
   когда взято хоть что-то, а поддержка тает. */
function botWarOrder(s, personaId) {
  const target = warTargetOf(s);
  const camp = s.warCampaign || newWarCampaign(s.annexed, target);
  const order = defaultWarOrder(camp, target);
  if (!order.target) return { target: null, stance: 'ceasefire' };
  const approval = s.approval || 50;
  if (personaId === 'strongman') order.stance = approval > 20 ? 'assault' : 'ceasefire';
  else if (personaId === 'populist') order.stance = approval > 45 ? 'assault' : approval > 30 ? 'hold' : 'ceasefire';
  else {
    order.stance = 'siege';
    if ((camp.captured.length >= 1 && approval < 45) || approval < 30) order.stance = 'ceasefire';
  }
  // копи выгоднее перевала, если перевал уже стоит дорого, — но сначала то, что ближе к взятию
  const best = warObjectivesFor(target).filter((o) => warObjectiveOpen(o.id, camp)).sort((a, b) => camp.progress[b.id] - camp.progress[a.id])[0];
  if (best) order.target = best.id;
  return order;
}
function warCampaignStep(s, decisions, difficulty) {
  const out = { impulses: [], news: [], spendPct: 0, endWar: false, victory: false };
  const active = (s.warQuartersLeft || 0) > 0 && s.warType === 'offensive';
  if (!active) return { ...out, campaign: null };
  const tgt = warTargetOf(s);
  const T = WAR_TARGETS[tgt];
  const OBJ = T.objectives;
  const camp = s.warCampaign ? { progress: { ...s.warCampaign.progress }, captured: [...(s.warCampaign.captured || [])], last: s.warCampaign.last } : newWarCampaign(s.annexed, tgt);
  const def = defaultWarOrder(camp, tgt);
  const raw = decisions.warOrder || {};
  const stance = WAR_STANCES.find((x) => x.id === raw.stance) || WAR_STANCES.find((x) => x.id === def.stance) || WAR_STANCES[1];
  const target = warObjectiveOpen(raw.target, camp) ? raw.target : def.target;
  out.spendPct = stance.spend;
  const pressFree = s.politicalRegime !== 'authoritarian' && s.politicalRegime !== 'totalitarian';
  if (stance.id === 'ceasefire' || !target) {
    out.endWar = true;
    const n = camp.captured.length;
    out.impulses.push(makeImpulse('approvalPush', n ? 2 * n : -3, `Перемирие ${T.ins}`, 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 4, 'Боевые действия прекращены', 'default', difficulty, 'other'),
      makeImpulse('tensionPush', n ? -2 : 3, `Перемирие ${T.ins}`, 'fast', difficulty, 'other'));
    // у Дешта и Вестравии земли не берут: взятое возвращается, а за него платят
    if (tgt !== 'north' && n) out.impulses.push(sustainedImpulse('revenue', (s.nominalGdp || 0) * 0.25 * n / 100, 6, `Выплаты ${T.gen} по перемирию`));
    out.news.push(['gov', `ПЕРЕМИРИЕ ${T.ins.toUpperCase()}`, n
      ? (tgt === 'north'
        ? `Боевые действия остановлены по линии фронта. За страной остаётся: ${camp.captured.map((id) => WAR_OBJECTIVE_BY_ID[id].name).join(', ')}.`
        : `Боевые действия остановлены. Взятое (${camp.captured.map((id) => WAR_OBJECTIVE_BY_ID[id].name).join(', ')}) возвращается ${T.gen === 'Вестравии' ? 'Вестравии' : 'Дешту'} — в обмен на выплаты полтора года.`)
      : `Боевые действия остановлены там же, где начались.${pressFree ? ' Цели операции не достигнуты — и это понятно всем.' : ' Официально — ради сохранения жизней.'}`, 10]);
    camp.last = { target: null, stance: 'ceasefire', gained: 0, counter: null };
    return { ...out, campaign: camp };
  }
  // затяжная война: санкции и усталость давят всё сильнее, пока её не закончат
  if ((s.warElapsed || 0) >= 10) {
    out.impulses.push(makeImpulse('exportsGrowth', -0.6, 'Санкции за затяжную войну', 'fast', difficulty, 'other'),
      makeImpulse('approvalPush', -0.6, 'Усталость от затяжной войны', 'fast', difficulty, 'other'),
      makeImpulse('riskPremium', 0.04, 'Затяжная война', 'fast', difficulty));
  }
  // война с главным торговым партнёром бьёт по экспорту и капиталу каждый квартал
  if (T.partner) out.impulses.push(makeImpulse('exportsGrowth', -1.5, 'Торговля с Вестравией закрыта', 'fast', difficulty, 'other'),
    makeImpulse('capitalFlow', -5, 'Вестравские банки отзывают кредиты', 'fast', difficulty));
  const strength = warStrength(s) * T.enemyK;
  const passBonus = camp.captured.includes('pass') || camp.captured.includes('steppe') || camp.captured.includes('fort') ? 1.25 : 1;
  const gain = stance.id === 'assault' ? strength * (16 + 18 * rng()) * passBonus
    : stance.id === 'siege' ? strength * (6 + 8 * rng()) * passBonus : strength * 2 * rng();
  camp.progress[target] = clamp(camp.progress[target] + gain, 0, 100);
  // потери и настроение: штурм бьёт по поддержке сильнее всего
  if (stance.id === 'assault') out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при штурме', 'fast', difficulty, 'other'),
    makeImpulse('tensionPush', 1.5, 'Потери при штурме', 'fast', difficulty, 'other'));
  else if (stance.id === 'siege') out.impulses.push(makeImpulse('approvalPush', -0.5, 'Затяжная осада', 'fast', difficulty, 'other'));
  // контратака противника по недобранной цели
  let counter = null;
  const counterChance = (stance.id === 'hold' ? 0.1 : 0.25) * (camp.captured.includes('pass') ? 0.5 : 1) / Math.sqrt(T.enemyK);
  if (rng() < counterChance) {
    const cands = OBJ.filter((o) => !camp.captured.includes(o.id) && camp.progress[o.id] > 0);
    if (cands.length) {
      const o = cands[Math.floor(rng() * cands.length)];
      const lost = 8 + 8 * rng();
      camp.progress[o.id] = clamp(camp.progress[o.id] - lost, 0, 100);
      counter = { target: o.id, lost: Math.round(lost) };
      out.news.push(['crisis', `КОНТРАТАКА У ЦЕЛИ «${o.name.toUpperCase()}»`, `Противник отбил часть позиций: продвижение откатилось на ${Math.round(lost)} п.`, 7]);
    }
  }
  // взятие цели
  if (camp.progress[target] >= 100 && !camp.captured.includes(target)) {
    camp.captured.push(target);
    const o = WAR_OBJECTIVE_BY_ID[target];
    if (target === 'mines') out.impulses.push(sustainedImpulse('exportsGrowth', 1.2, 8, 'Руда Хальвика идёт на экспорт'),
      makeImpulse('inflationSupply', -0.2, 'Сырьё Хальвика дешевле', 'slow', difficulty, 'other'));
    if (target === 'oil') out.impulses.push(sustainedImpulse('exportsGrowth', 0.8, 6, 'Нефть Кумсая'),
      makeImpulse('inflationSupply', -0.3, 'Топливо дешевле: нефть Кумсая', 'slow', difficulty, 'other'));
    out.impulses.push(makeImpulse('approvalPush', target === 'city' ? 4 : 2, `Взята цель: ${o.name}`, 'fast', difficulty, 'other'));
    out.news.push(['gov', o.headline, o.desc, 9]);
  }
  if (OBJ.every((o) => camp.captured.includes(o.id))) {
    out.endWar = true; out.victory = true;
    out.impulses.push(makeImpulse('approvalPush', 6, `Победа над ${T.gen === 'Вестравии' ? 'Вестравией' : T.gen === 'Дешта' ? 'Дештом' : 'Норландом'}`, 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', -4, 'Победа в войне', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 3, 'Война окончена', 'default', difficulty, 'other'));
    if (tgt !== 'north') out.impulses.push(sustainedImpulse('revenue', (s.nominalGdp || 0) * 0.9 / 100, 8, `Репарации ${T.gen}`));
    out.news.push(['gov', `${T.up} ПОДПИСЫВАЕТ КАПИТУЛЯЦИЮ`, tgt === 'north'
      ? 'Все цели операции взяты, противник принимает условия. Санкции за войну никуда не деваются — они снимаются дольше, чем вводились.'
      : `Все цели операции взяты. Войска уходят домой, а ${T.gen === 'Дешта' ? 'Дешт' : 'Вестравия'} два года платит репарации — около 0,9% ВВП в год. Соседи этого не забудут.`, 10]);
  }
  camp.last = { target, stance: stance.id, gained: Math.round(gain), counter };
  return { ...out, campaign: camp };
}

/* ============================ НОВЫЕ ЗЕМЛИ ============================
   Присоединить — не значит удержать. Каждый квартал лояльность новой области
   сама понемногу растёт (люди привыкают), программа интеграции — пособия,
   паспорта, дороги — ускоряет это за деньги, стройка в области тоже. Напряжение
   в стране и война за эти земли отбрасывают назад. Пока лояльность ниже
   PARTISAN_BELOW, там партизаны: подрывы, саботаж, подполье. Когда она впервые
   доходит до INTEGRATED_AT, область интегрирована и голосует вместе со страной. */
const PARTISAN_INCIDENTS = {
  pereval: { headline: 'ПОДРЫВ НА ПЕРЕВАЛЬСКОЙ ДОРОГЕ',
    text: (l) => `Ночью подорвали мост на серпантине, колонны с грузом стоят. Лояльность района ${Math.round(l)} из 100 — новой власти здесь пока не рады.`,
    impulses: (d) => [makeImpulse('exportsGrowth', -0.8, 'Подрыв на перевальской дороге', 'fast', d, 'other'),
      makeImpulse('riskPremium', 0.03, 'Диверсии на новых землях', 'fast', d),
      makeImpulse('tensionPush', 1, 'Диверсия на перевале', 'fast', d, 'other')] },
  halvik: { headline: 'САБОТАЖ НА ХАЛЬВИКСКИХ КОПЯХ',
    text: (l) => `На копях Хальвика залиты две шахты и сожжён склад взрывчатки. Лояльность края ${Math.round(l)} из 100.`,
    impulses: (d) => [makeImpulse('exportsGrowth', -1.2, 'Саботаж на копях Хальвика', 'fast', d, 'other'),
      makeImpulse('inflationSupply', 0.1, 'Руда Хальвика встала', 'fast', d, 'other')] },
  nordholm: { headline: 'ПОДПОЛЬЕ В НОРДХОЛЬМЕ: НАПАДЕНИЕ НА КОМЕНДАТУРУ',
    text: (l) => `В Нордхольме обстреляна комендатура, в городе комендантский час. Лояльность области ${Math.round(l)} из 100 — город ждёт возвращения Норланда.`,
    impulses: (d) => [makeImpulse('tensionPush', 2, 'Нападение на комендатуру в Нордхольме', 'fast', d, 'other'),
      makeImpulse('approvalPush', -1, 'Новые земли неспокойны', 'fast', d, 'other'),
      makeImpulse('govTrust', -1, 'Подполье в Нордхольме', 'default', d, 'other')] },
};
// только присоединённые области и без повторов
// программа интеграции области с полной лояльностью закрывается сама — платить больше не за что
const INTEGRATION_DONE = 100;
function sanitizeIntegration(list, s) {
  const own = activeRegions(s).filter((r) => r.annex && annexLoyalty(s, r.id) < INTEGRATION_DONE).map((r) => r.id);
  return Array.isArray(list) ? [...new Set(list.filter((id) => own.includes(id)))] : [];
}
function annexBlurb(region, s) {
  const l = annexLoyalty(s, region.id);
  const integrated = (s.annexIntegrated || []).includes(region.id);
  if (l < PARTISAN_BELOW) return `Лояльность ${Math.round(l)} из 100: власть держится на комендатурах, по ночам — подрывы и листовки. Пока здесь не станет спокойнее, область не голосует.`;
  if (!integrated) return `Лояльность ${Math.round(l)} из 100: партизан почти не слышно, но своей эта земля ещё не стала. Голосовать область начнёт с ${INTEGRATED_AT}.`;
  return `Лояльность ${Math.round(l)} из 100: область интегрирована и голосует вместе со страной — но помнит, откуда пришла.`;
}
function annexStep(s, decisions, difficulty, loyaltyDelta) {
  const out = { impulses: [], news: [], spendPct: 0, loyalty: {}, integrated: [...(s.annexIntegrated || [])], shock: {}, funded: [] };
  const regions = activeRegions(s).filter((r) => r.annex);
  if (!regions.length) return out;
  // программа интеграции действует, пока её не сменят: null — продолжать прошлую
  const plan = new Set(sanitizeIntegration(decisions.integrate == null ? s.annexFunded : decisions.integrate, s));
  const underAttack = (s.warQuartersLeft || 0) > 0 && s.warType === 'revanche';
  regions.forEach((r) => {
    let l = annexLoyalty(s, r.id);
    let d = 1 + ((loyaltyDelta || {})[r.id] || 0);
    const wasFunded = (s.annexFunded || []).includes(r.id);
    if (plan.has(r.id)) { d += 6; out.spendPct += INTEGRATION_COST; out.funded.push(r.id); }
    if ((s.projects || []).some((x) => x.region === r.id)) d += 2;
    if (underAttack) d -= 3;
    if ((s.politicalTension || 0) > 45) d -= (s.politicalTension - 45) * 0.06;
    l = clamp(l + d, 0, 100);
    if (l >= INTEGRATION_DONE && (plan.has(r.id) || wasFunded)) {
      out.funded = out.funded.filter((id) => id !== r.id);
      out.news.push(['gov', `${r.name.toUpperCase()}: ПРОГРАММА ИНТЕГРАЦИИ ВЫПОЛНЕНА`,
        `Лояльность ${r.gen} достигла 100 из 100 — деньги на интеграцию больше не нужны, программа закрыта.`, 6]);
    }
    if (l < PARTISAN_BELOW && rng() < 0.15 + ((PARTISAN_BELOW - l) / PARTISAN_BELOW) * 0.45) {
      const inc = PARTISAN_INCIDENTS[r.id];
      out.impulses.push(...inc.impulses(difficulty));
      out.spendPct += 0.03;
      out.shock[r.id] = (out.shock[r.id] || 0) + 6;
      out.news.push(['crisis', inc.headline, inc.text(l), 7]);
    }
    if (l >= INTEGRATED_AT && !out.integrated.includes(r.id)) {
      out.integrated.push(r.id);
      out.impulses.push(makeImpulse('approvalPush', 1, `${r.name}: интеграция завершена`, 'fast', difficulty, 'other'));
      out.news.push(['gov', `${r.name.toUpperCase()} ВПЕРВЫЕ ГОЛОСУЕТ ВМЕСТЕ СО СТРАНОЙ`,
        `Комендатуры сменяются обычной администрацией, партизан больше не слышно. Лояльность ${r.gen} — ${Math.round(l)} из 100: теперь это не только новая земля на карте, но и новые избиратели.`, 8]);
    }
    out.loyalty[r.id] = l;
  });
  return out;
}

/* ========================= МИР С НОРЛАНДОМ =========================
   Перемирие останавливает стрельбу, но не решает, чья это земля. После войны,
   в которой страна что-то взяла, открываются переговоры: каждый квартал можно
   предложить договор — признание новой границы, поддержку Норландом снятия
   санкций, репарации (получить или выплатить), возврат части земель. Норланд
   соглашается, если цена требований не выше позиции страны на переговорах
   (leverage): она тем сильнее, чем больше взято, и тает, пока тянут время.
   Непризнанная граница продлевает санкции и кормит реваншизм Норланда. */
const TREATY_LAND_VALUE = { pereval: 18, halvik: 22, nordholm: 35 };
const OBJECTIVE_VALUE = { pass: 18, mines: 22, city: 35 };
const heldAnnex = (s) => activeRegions(s).filter((r) => r.annex).map((r) => r.id);
function sanitizeTreaty(t, s) {
  if (!t || typeof t !== 'object') return null;
  const held = heldAnnex(s);
  return {
    recognition: !!t.recognition, sanctions: !!t.sanctions,
    reparations: t.reparations === 'receive' || t.reparations === 'pay' ? t.reparations : null,
    returned: Array.isArray(t.returned) ? [...new Set(t.returned.filter((id) => held.includes(id)))] : [],
    propose: !!t.propose, walkAway: !!t.walkAway,
  };
}
// во что Норланду обходятся требования; уступки (выплата, возврат земель) — со знаком минус
function treatyCost(terms, s) {
  if (!terms) return 0;
  const kept = heldAnnex(s).filter((id) => !terms.returned.includes(id));
  let c = 0;
  if (terms.recognition) c += 10 + 12 * kept.length + (kept.includes('nordholm') ? 15 : 0);
  if (terms.sanctions) c += 15;
  if (terms.reparations === 'receive') c += 25;
  if (terms.reparations === 'pay') c -= 25;
  terms.returned.forEach((id) => { c -= TREATY_LAND_VALUE[id] || 0; });
  return c;
}
// бот за столом переговоров: берёт самое ценное, на что Норланд согласится, по своим приоритетам
function botTreaty(s, personaId) {
  const talks = s.peaceTalks;
  if (!talks) return null;
  const order = personaId === 'strongman' ? ['reparations', 'recognition', 'sanctions']
    : personaId === 'populist' ? ['recognition', 'reparations', 'sanctions'] : ['recognition', 'sanctions', 'reparations'];
  const terms = { recognition: false, sanctions: false, reparations: null, returned: [], propose: true, walkAway: false };
  order.forEach((k) => {
    const next = { ...terms, [k]: k === 'reparations' ? 'receive' : true };
    if (treatyCost(next, s) <= talks.leverage) Object.assign(terms, next);
  });
  return terms;
}
// земля уходит из состава страны: вместе с её стройками, событием и лояльностью
function dropAnnexed(state, regionIds) {
  const objs = regionIds.map((id) => (regionById(id) || {}).objective).filter(Boolean);
  const lostProjects = new Set(REGION_PROJECTS.filter((p) => regionIds.includes(p.region)).map((p) => p.id));
  const loyalty = { ...state.annexLoyalty };
  regionIds.forEach((id) => { delete loyalty[id]; });
  return {
    annexed: (state.annexed || []).filter((o) => !objs.includes(o)),
    annexLoyalty: loyalty,
    annexIntegrated: (state.annexIntegrated || []).filter((id) => !regionIds.includes(id)),
    annexFunded: (state.annexFunded || []).filter((id) => !regionIds.includes(id)),
    projects: (state.projects || []).filter((x) => !lostProjects.has(x.id)),
    projectsBuilt: (state.projectsBuilt || []).filter((id) => !lostProjects.has(id)),
    regionEvent: state.regionEvent && regionIds.includes(state.regionEvent.region) ? null : state.regionEvent,
  };
}
/* =========================================================================================
   ЖИВЫЕ СОСЕДИ: ОТНОШЕНИЯ КАК РЕСУРС

   У каждого соседа — отношения от 0 до 100. Они сами тянутся к «естественному»
   уровню (торговый блок, признанная граница, реваншизм, война), а сдвигают их
   действия президента (договор, помощь, ультиматум, санкции), ответы на события
   от соседей и их собственные ходы. Отношения — не табличка: Вестравия при
   хороших отношениях покупает наш экспорт и даёт дешёвый кредит, Дешт при плохих
   стягивает войска и может напасть, Норланд — копит реваншизм.
========================================================================================= */
const NEIGHBOR_IDS = ['north', 'west', 'southwest'];
const NB = {
  north: { name: 'Норланд', gen: 'Норланда', dat: 'Норланду', ins: 'с Норландом', up: 'НОРЛАНД' },
  west: { name: 'Вестравия', gen: 'Вестравии', dat: 'Вестравии', ins: 'с Вестравией', up: 'ВЕСТРАВИЯ' },
  southwest: { name: 'Дешт', gen: 'Дешта', dat: 'Дешту', ins: 'с Дештом', up: 'ДЕШТ' },
};
const RELATIONS_START = { north: 50, west: 64, southwest: 40 };
function relationsOf(s) { return { ...RELATIONS_START, ...s.relations }; }
// воюем ли мы с этим соседом прямо сейчас
function atWarWith(s, c) {
  if (!((s.warQuartersLeft || 0) > 0)) return false;
  if (s.warType === 'offensive') return warTargetOf(s) === c;
  return c === 'southwest' ? s.warType === 'defensive' : c === 'north' ? s.warType === 'revanche' : false;
}
// куда отношения тянутся сами, если ничего не делать
function relationTarget(s, c) {
  if (atWarWith(s, c)) return 4;
  const tr = (s.diploTreaties || {})[c] > 0 ? 10 : 0;
  const sanc = (s.diploSanctions || {})[c] > 0 ? -30 : 0;
  if (c === 'west') {
    if ((s.sanctionsQuartersLeft || 0) > 0) return 15;
    return clamp(62 + (s.tradeBlocActive ? 14 : 0) + tr + sanc, 5, 92);
  }
  if (c === 'north') {
    const held = (s.annexed || []).length;
    const t = s.treaty;
    const base = held ? (t && t.recognized ? 58 : 38) - Math.max(0, s.norlandRevanche || 0) * 0.3 : 50;
    return clamp(base + tr + sanc, 5, 90);
  }
  return clamp(40 + tr + sanc - ((s.deshtMobilized || 0) > 0 ? 8 : 0), 5, 85);
}
/* Во сколько раз Дешт вероятнее нападёт, чем «в среднем»: плохие отношения и
   стянутые к границе войска поднимают риск, договор и отведённые войска — гасят. */
function deshtWarMultiplier(s) {
  const rel = relationsOf(s).southwest;
  const calm = (s.deshtCalm || 0) > 0 ? 0.3 : 1;
  const mob = (s.deshtMobilized || 0) > 0 ? 1.6 : 1;
  return clamp((1 + (40 - rel) / 25) * calm * mob, 0.2, 3.5);
}
// Дешт стянул войска и отношения на дне — нападение вне общей лотереи событий
function deshtAttackRoll(s) {
  const rel = relationsOf(s).southwest;
  if ((s.warQuartersLeft || 0) > 0 || !((s.deshtMobilized || 0) > 0) || rel >= 22 || (s.deshtCalm || 0) > 0) return false;
  return rng() < 0.3 + (22 - rel) * 0.02;
}
// что даёт экономике нынешний уровень отношений — для подсказок в карточке страны
function relationEffects(s, c) {
  const rel = relationsOf(s)[c];
  if (atWarWith(s, c)) return ['идёт война — торговли нет'];
  if (c === 'west') {
    const x = (rel - 60) / 40;
    return [`экспорт ${x >= 0 ? '+' : '−'}${fmt1(Math.abs(0.5 * x)).replace('.', ',')} п.п. роста в квартал`, x >= 0 ? 'кредит дешевле: банки Вестравии охотно дают в долг' : 'кредит дороже: банки Вестравии осторожничают'];
  }
  if (c === 'southwest') {
    const m = deshtWarMultiplier(s);
    return [`риск нападения ×${fmt1(m).replace('.', ',')}${(s.deshtMobilized || 0) > 0 ? ' — войска у границы' : ''}`, rel >= 40 ? 'дешёвое зерно и нефть сдерживают цены' : 'зерно и нефть идут мимо нас'];
  }
  return [(s.annexed || []).length ? `реваншизм ${rel >= 50 ? 'остывает' : 'растёт быстрее'} от отношений` : 'руда и лес: небольшой, но стабильный торговый оборот'];
}

const DIPLO_ACTIONS = [
  { id: 'trade', label: 'Торговый договор', cost: 12,
    desc: 'Снять пошлины на три года: растёт экспорт, а отношения держатся выше. Нужны хотя бы ровные отношения.',
    can: (s, c) => (relationsOf(s)[c] >= 45 && !((s.diploTreaties || {})[c] > 0) && !((s.diploSanctions || {})[c] > 0))
      || null, why: 'нужны отношения от 45, без санкций и без уже действующего договора' },
  { id: 'aid', label: 'Помощь', cost: 6,
    desc: 'Гуманитарная помощь и льготный кредит: около 0,3% ВВП из бюджета, зато отношения заметно теплеют.',
    can: (s, c) => !((s.diploCooldown || {})[`aid:${c}`] > 0) || null, why: 'помощь уже отправлялась недавно' },
  { id: 'ultimatum', label: 'Ультиматум', cost: 10,
    desc: 'Потребовать уступки под угрозой. Сильная армия повышает шансы; отказ — удар по отношениям и повод для ответа.',
    can: (s, c) => !((s.diploCooldown || {})[`ultimatum:${c}`] > 0) || null, why: 'ультиматум уже звучал недавно' },
  { id: 'sanctions', label: 'Санкции', cost: 14,
    desc: 'Ограничить торговлю: внутри — сплочение, снаружи — разрыв. Против Вестравии бьёт по своим же ценам и инвестициям.',
    can: (s, c) => !((s.diploSanctions || {})[c] > 0) && !(c === 'west' && (s.sanctionsQuartersLeft || 0) > 0) || null, why: 'санкции уже действуют' },
];
const DIPLO_BY_ID = Object.fromEntries(DIPLO_ACTIONS.map((a) => [a.id, a]));
const ULTIMATUM_DEMAND = { west: 'снизить пошлины на наш экспорт', north: 'отвести войска от новой границы и прекратить провокации', southwest: 'отвести войска от границы' };
function diploActionAvailable(s, c, id) {
  const a = DIPLO_BY_ID[id];
  if (!a || !NB[c] || atWarWith(s, c)) return false;
  return !!a.can(s, c);
}
function ultimatumChance(s, c) {
  const base = { west: 0.25, north: 0.4, southwest: 0.35 }[c];
  const rel = relationsOf(s)[c];
  return clamp(base + (warStrength(s) - 1) * 0.35 + (rel < 15 ? -0.1 : 0), 0.08, 0.8);
}

/* События от соседей: у каждого — варианты ответа и срок. Не ответили до срока —
   срабатывает вариант по умолчанию (протест, отказ, упущенная сделка). */
const NEIGHBOR_EVENTS = [
  { id: 'border_incident', weight: 3, countries: ['north', 'southwest'], when: (s, c) => relationsOf(s)[c] < 62, days: 1, def: 'protest',
    title: (c) => `Пограничный инцидент ${NB[c].ins}`,
    text: (c) => `Патруль ${NB[c].gen} задержал наших пограничников на спорном участке. Ждут реакции президента.`,
    options: [
      { id: 'protest', label: 'Нота протеста', note: 'отношения −4, рейтинг +1', rel: -4, approval: 1 },
      { id: 'hush', label: 'Замять тихо', note: 'отношения +4, рейтинг −1,5', rel: 4, approval: -1.5 },
      { id: 'retaliate', label: 'Ответить силой', note: 'отношения −14, рейтинг +3, риск эскалации', rel: -14, approval: 3, escalate: true },
    ] },
  { id: 'loan_request', weight: 2, countries: ['north', 'west', 'southwest'], when: (s, c) => relationsOf(s)[c] >= 30, days: 1, def: 'decline',
    title: (c) => `${NB[c].name} просит кредит`,
    text: (c) => `Правительство ${NB[c].gen} просит заём около 0,4% нашего ВВП на два года — под проценты, но с риском, что отдавать будут долго.`,
    options: [
      { id: 'lend', label: 'Дать заём', note: 'бюджет −0,4% ВВП сейчас, возврат с процентами позже; отношения +15', rel: 15, loan: true },
      { id: 'decline', label: 'Отказать', note: 'отношения −6', rel: -6 },
    ] },
  { id: 'refugees', weight: 1.5, countries: ['southwest', 'north'], when: (s, c) => !atWarWith(s, c), days: 1, def: 'close',
    title: (c) => `Беженцы из ${NB[c].gen}`,
    text: (c) => `В ${NB[c].dat} кризис: у нашей границы около 80 тысяч человек. Принять — это рабочие руки и расходы, закрыть — тишина внутри и холод снаружи.`,
    options: [
      { id: 'accept', label: 'Принять', note: 'рабочая сила ↑, выплаты ↑, напряжение +2; Вестравия и сосед теплеют', rel: 6, westRel: 5, accept: true },
      { id: 'close', label: 'Закрыть границу', note: 'напряжение −1; Вестравия −4', rel: -3, westRel: -4, tension: -1 },
    ] },
  { id: 'west_deal', weight: 2, countries: ['west'], when: (s) => relationsOf(s).west >= 45 && (s.sanctionsQuartersLeft || 0) <= 0, days: 2, def: 'pass',
    title: () => 'Вестравия предлагает контракт',
    text: () => 'Концерны Вестравии готовы закупать нашу продукцию по долгому контракту — если ответим в течение двух кварталов. Взамен просят открыть рынок для своих станков.',
    options: [
      { id: 'sign', label: 'Подписать', note: 'экспорт ↑ на два года, отношения +6; свой бизнес поворчит', rel: 6, deal: 'west' },
      { id: 'pass', label: 'Отказаться', note: 'отношения −3', rel: -3 },
    ] },
  { id: 'desht_deal', weight: 1.5, countries: ['southwest'], when: (s) => relationsOf(s).southwest >= 30 && !atWarWith(s, 'southwest'), days: 2, def: 'pass',
    title: () => 'Дешт предлагает дешёвое зерно и нефть',
    text: () => 'Ашкала готова продавать зерно и нефть ниже рынка — два квартала на ответ. Вестравия такое сближение не одобрит.',
    options: [
      { id: 'sign', label: 'Согласиться', note: 'цены ниже на год, Дешт +8, Вестравия −4', rel: 8, westRel: -4, deal: 'southwest' },
      { id: 'pass', label: 'Отказаться', note: 'Дешт −3', rel: -3 },
    ] },
];
const NB_EVENT_BY_ID = Object.fromEntries(NEIGHBOR_EVENTS.map((e) => [e.id, e]));
// событие соседа в виде, пригодном для интерфейса (варианты и срок)
function neighborEventView(s) {
  const ev = s.neighborEvent;
  if (!ev || !NB_EVENT_BY_ID[ev.id]) return null;
  const def = NB_EVENT_BY_ID[ev.id];
  return { ...ev, title: def.title(ev.country), text: def.text(ev.country), options: def.options, def: def.def };
}

/* Бот-президент по характеру: отвечает на события соседей и изредка сам делает
   ход. Популист — за рейтинг, силовик — жёстко, технократ — за экономику. */
function botDiplomacy(s, personaId, capitalLeft = 99) {
  const out = { action: null, reply: null };
  const ev = s.neighborEvent;
  if (ev && NB_EVENT_BY_ID[ev.id]) {
    const pick = {
      border_incident: personaId === 'strongman' ? 'retaliate' : personaId === 'technocrat' ? 'hush' : 'protest',
      loan_request: personaId === 'technocrat' && s.debtToGdp < 70 ? 'lend' : personaId === 'populist' ? 'decline' : relationsOf(s)[ev.country] < 45 ? 'lend' : 'decline',
      refugees: personaId === 'technocrat' && s.unemployment < 6.5 ? 'accept' : 'close',
      west_deal: personaId === 'strongman' ? 'pass' : 'sign',
      desht_deal: personaId === 'technocrat' ? 'sign' : personaId === 'strongman' ? 'sign' : 'pass',
    }[ev.id];
    out.reply = pick || NB_EVENT_BY_ID[ev.id].def;
  }
  const rel = relationsOf(s);
  const tryAct = (c, id) => { if (!out.action && diploActionAvailable(s, c, id) && DIPLO_BY_ID[id].cost <= capitalLeft) out.action = { country: c, kind: id }; };
  if ((s.deshtMobilized || 0) > 0) tryAct('southwest', personaId === 'technocrat' ? 'aid' : 'ultimatum');
  if (personaId === 'technocrat') tryAct('west', 'trade');
  if (rel.west < 50 && personaId !== 'strongman') tryAct('west', 'aid');
  if (personaId === 'populist' && rel.southwest >= 45) tryAct('southwest', 'trade');
  return out;
}
function sanitizeDiplomacy(raw, s) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const a = r.action && typeof r.action === 'object' && diploActionAvailable(s, r.action.country, r.action.kind) ? { country: r.action.country, kind: r.action.kind } : null;
  const ev = s.neighborEvent && NB_EVENT_BY_ID[s.neighborEvent.id];
  const reply = ev && ev.options.some((o) => o.id === r.reply) ? r.reply : null;
  return { action: a, reply };
}

function diplomacyStep(s, decisions, difficulty, q, capitalLeft, noEvents, presApplied) {
  const out = { impulses: [], news: [], spent: 0, sanctionsWest: false, revancheDelta: 0, last: null };
  const rel = relationsOf(s);
  const treaties = { ...s.diploTreaties };
  const sanctions = { ...s.diploSanctions };
  const cooldown = { ...s.diploCooldown };
  Object.keys(cooldown).forEach((k) => { cooldown[k] = Math.max(0, cooldown[k] - 1); });
  let mobilized = Math.max(0, (s.deshtMobilized || 0) - 1);
  let calm = Math.max(0, (s.deshtCalm || 0) - 1);
  let event = s.neighborEvent || null;
  const nGdp = s.nominalGdp || 0;
  const push = (...imps) => out.impulses.push(...imps);
  const shift = (c, v) => { rel[c] = clamp(rel[c] + v, 0, 100); };

  // 1. дрейф к естественному уровню
  NEIGHBOR_IDS.forEach((c) => { rel[c] = clamp(rel[c] + 0.15 * (relationTarget(s, c) - rel[c]), 0, 100); });
  // старые президентские указы тоже двигают отношения с Вестравией
  if ((presApplied || []).includes('sanctions_impose')) shift('west', -30);
  if ((presApplied || []).includes('trade_bloc')) shift('west', 12);

  // 2. ответ на событие соседа: выбранный вариант — или вариант по умолчанию, когда срок вышел
  const dip = sanitizeDiplomacy(decisions.diplomacy, s);
  if (event && NB_EVENT_BY_ID[event.id]) {
    const def = NB_EVENT_BY_ID[event.id];
    const expired = q >= event.deadline;
    const optId = dip.reply || (expired ? def.def : null);
    if (optId) {
      const o = def.options.find((x) => x.id === optId) || def.options[0];
      const c = event.country;
      shift(c, o.rel || 0);
      if (o.westRel) shift('west', o.westRel);
      if (o.approval) push(makeImpulse('approvalPush', o.approval, def.title(c), 'fast', difficulty, 'other'));
      if (o.tension) push(makeImpulse('tensionPush', o.tension, def.title(c), 'fast', difficulty, 'other'));
      if (o.escalate && c === 'southwest' && rel.southwest < 30) mobilized = Math.max(mobilized, 4);
      if (o.escalate && c === 'north') out.revancheDelta += 8;
      if (o.loan) {
        push(sustainedImpulse('revenue', -nGdp * 0.8 / 100, 2, `Заём ${NB[c].dat}`),
          taperedImpulse('revenue', [0, 0, 0, 0, 0, 0, 0.26, 0.26, 0.26, 0.26].map((k) => k * nGdp / 100 * (rel[c] >= 25 ? 1 : 0.4)), `${NB[c].name} возвращает заём`));
      }
      if (o.accept) {
        push(makeImpulse('laborForce', 0.25, 'Беженцы пополнили рабочую силу', 'slow', difficulty, 'other'),
          sustainedImpulse('transfersPressure', 0.25, 4, 'Расходы на размещение беженцев'),
          makeImpulse('tensionPush', 2, 'Беженцы: часть общества против', 'fast', difficulty, 'other'));
      }
      if (o.deal === 'west') {
        push(sustainedImpulse('exportsGrowth', 0.5, 8, 'Долгий контракт с концернами Вестравии'),
          makeImpulse('businessConfidence', 2, 'Контракт с Вестравией', 'default', difficulty, 'other'),
          makeImpulse('tensionPush', 1.2, 'Рынок открыт для станков Вестравии', 'fast', difficulty, 'other'));
      }
      if (o.deal === 'southwest') push(sustainedImpulse('inflationSupply', -0.2, 4, 'Дешёвое зерно и нефть из Дешта'));
      out.news.push(['world', `${def.title(c).toUpperCase()}: ${o.label.toUpperCase()}`, `${dip.reply ? 'Президент выбрал' : 'Срок ответа вышел — по умолчанию'}: ${o.label.toLowerCase()}. ${o.note}.`, 6]);
      out.resolved = { id: event.id, country: c, option: o.id, q };
      event = null;
    }
  }

  // 3. действие президента
  const act = dip.action;
  if (act && DIPLO_BY_ID[act.kind].cost <= capitalLeft) {
    const a = DIPLO_BY_ID[act.kind]; const c = act.country;
    out.spent += a.cost;
    let ok = true;
    if (a.id === 'trade') {
      treaties[c] = 12; shift(c, 8);
      push(makeImpulse('businessConfidence', 2, `Торговый договор ${NB[c].ins}`, 'default', difficulty, 'other'));
      out.news.push(['world', `ТОРГОВЫЙ ДОГОВОР ${NB[c].ins.toUpperCase()}`, `Пошлины сняты на три года. ${c === 'west' ? 'Вестравия — главный рынок для нашего экспорта: эффект будет заметным.' : 'Оборот невелик, но отношения держатся ровнее.'}`, 7]);
    } else if (a.id === 'aid') {
      cooldown[`aid:${c}`] = 4; shift(c, 14);
      push(sustainedImpulse('revenue', -nGdp * 0.6 / 100, 2, `Помощь ${NB[c].dat}`));
      out.news.push(['world', `ПОМОЩЬ ${NB[c].dat.toUpperCase()}`, `Гуманитарные грузы и льготный кредит — около 0,3% ВВП. В ${NB[c].gen === 'Дешта' ? 'Ашкале' : NB[c].gen === 'Норланда' ? 'Эльвборге' : 'Вестграде'} благодарят.`, 6]);
    } else if (a.id === 'ultimatum') {
      cooldown[`ultimatum:${c}`] = 6;
      ok = rng() < ultimatumChance(s, c);
      shift(c, ok ? -12 : -24);
      push(makeImpulse('approvalPush', ok ? 3 : -1, `Ультиматум ${NB[c].dat}`, 'fast', difficulty, 'other'));
      if (ok) {
        if (c === 'west') push(sustainedImpulse('exportsGrowth', 0.5, 6, 'Вестравия снизила пошлины после ультиматума'));
        if (c === 'north') out.revancheDelta -= 30;
        if (c === 'southwest') { mobilized = 0; calm = 8; }
      } else {
        push(makeImpulse('riskPremium', 0.15, `${NB[c].name} отверг ультиматум`, 'default', difficulty));
        if (c === 'southwest') mobilized = Math.max(mobilized, 3);
        if (c === 'north') out.revancheDelta += 10;
      }
      out.news.push(['world', ok ? `${NB[c].up} УСТУПИЛ УЛЬТИМАТУМУ` : `${NB[c].up} ОТВЕРГ УЛЬТИМАТУМ`,
        ok ? `Требование ${ULTIMATUM_DEMAND[c]} выполнено. Отношения испорчены, но своё страна получила.`
          : `Требование ${ULTIMATUM_DEMAND[c]} отвергнуто. Отношения рухнули, а угроза, которую не исполнили, стоит репутации.`, 8]);
    } else if (a.id === 'sanctions') {
      shift(c, -30);
      if (c === 'west') {
        out.sanctionsWest = true;
        push(...PRES_BY_ID.sanctions_impose.build(s, difficulty).impulses);
      } else {
        sanctions[c] = 8;
        push(makeImpulse('approvalPush', 2, `Санкции против ${NB[c].gen}`, 'fast', difficulty, 'other'));
      }
      out.news.push(['world', `САНКЦИИ ПРОТИВ ${NB[c].gen.toUpperCase()}`, c === 'west'
        ? 'Главный торговый партнёр под ограничениями: подорожает импорт, осторожнее станут инвесторы.'
        : `Торговля ${NB[c].ins} ограничена на два года. Оборот невелик — удар больше политический.`, 8]);
    }
    out.last = { country: c, kind: a.id, ok, q };
  }

  // 4. текущие эффекты отношений, договоров и санкций
  NEIGHBOR_IDS.forEach((c) => {
    if (treaties[c] > 0) treaties[c] -= 1;
    if (sanctions[c] > 0) sanctions[c] -= 1;
  });
  if (!atWarWith(s, 'west')) {
    const x = clamp((rel.west - 60) / 40, -1.5, 1);
    const tr = (s.diploTreaties || {}).west > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.5 * x + 0.6 * tr, 1, 'Отношения с Вестравией'),
      sustainedImpulse('capitalFlow', 3 * x, 1, 'Банки Вестравии'),
      sustainedImpulse('riskPremium', -0.03 * x, 1, 'Кредит банков Вестравии'));
  }
  if (!atWarWith(s, 'southwest')) {
    const x = clamp((rel.southwest - 40) / 40, -1, 1);
    const tr = (s.diploTreaties || {}).southwest > 0 ? 1 : 0;
    const sc = (s.diploSanctions || {}).southwest > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.15 * x + 0.3 * tr - 0.3 * sc, 1, 'Торговля с Дештом'),
      sustainedImpulse('inflationSupply', -0.05 * x - 0.05 * tr + 0.1 * sc, 1, 'Зерно и нефть Дешта'));
  }
  if (!atWarWith(s, 'north')) {
    const x = clamp((rel.north - 50) / 50, -1, 1);
    const tr = (s.diploTreaties || {}).north > 0 ? 1 : 0;
    const sc = (s.diploSanctions || {}).north > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.12 * x + 0.2 * tr - 0.25 * sc, 1, 'Торговля с Норландом'));
    if ((s.annexed || []).length) out.revancheDelta += -(rel.north - 45) * 0.06;
  }

  // 5. ходы соседей-ботов: при плохих отношениях они начинают конфликт сами
  if (!noEvents) {
    NEIGHBOR_IDS.forEach((c) => {
      if (atWarWith(s, c) || (cooldown[`hostile:${c}`] || 0) > 0 || rel[c] >= 25) return;
      if (rng() >= (25 - rel[c]) / 25 * 0.3) return;
      cooldown[`hostile:${c}`] = 6;
      if (c === 'west') {
        push(sustainedImpulse('exportsGrowth', -0.7, 6, 'Пошлины Вестравии'), makeImpulse('capitalFlow', -8, 'Пошлины Вестравии', 'default', difficulty));
        out.news.push(['world', 'ВЕСТРАВИЯ ВВОДИТ ПОШЛИНЫ НА НАШ ЭКСПОРТ', `Отношения ${Math.round(rel.west)} из 100 — и Вестград отвечает своим ходом: пошлины на полтора года. Экспорт просядет.`, 8]);
      } else if (c === 'north') {
        push(sustainedImpulse('exportsGrowth', -0.3, 4, 'Норланд перекрыл транзит'));
        out.revancheDelta += 12; shift('north', -3);
        out.news.push(['world', 'НОРЛАНД ПЕРЕКРЫЛ ТРАНЗИТ И РЫБОЛОВНЫЕ ВОДЫ', `Эльвборг наказывает за холодные отношения (${Math.round(rel.north)} из 100): грузы идут в обход, реваншисты в Норланде громче.`, 8]);
      } else if (!(mobilized > 0)) {
        mobilized = 6;
        push(makeImpulse('businessConfidence', -3, 'Дешт стягивает войска', 'default', difficulty, 'other'), makeImpulse('riskPremium', 0.1, 'Дешт стягивает войска', 'default', difficulty));
        out.news.push(['crisis', 'ДЕШТ СТЯГИВАЕТ ВОЙСКА К ГРАНИЦЕ', `Отношения ${Math.round(rel.southwest)} из 100. Если их не поправить — помощью, договором или ультиматумом, — Дешт может напасть.`, 9]);
      }
    });
  }

  // 6. новое событие от соседа
  if (!event && !noEvents && rng() < 0.18) {
    const pool = [];
    NEIGHBOR_EVENTS.forEach((e) => e.countries.forEach((c) => { if (!atWarWith(s, c) && e.when(s, c) && !(cooldown[`ev:${e.id}`] > 0)) pool.push([e, c]); }));
    if (pool.length) {
      const total = pool.reduce((a, [e]) => a + e.weight, 0);
      let r = rng() * total; let pick = pool[0];
      for (const p of pool) { r -= p[0].weight; if (r <= 0) { pick = p; break; } }
      const [e, c] = pick;
      event = { id: e.id, country: c, q, deadline: q + e.days };
      cooldown[`ev:${e.id}`] = 6;
      out.news.push(['world', e.title(c).toUpperCase(), `${e.text(c)} Ответ — за президентом${e.days > 1 ? `, срок — ${e.days} квартала` : ' в этом квартале'}.`, 7]);
    }
  }

  out.relations = Object.fromEntries(NEIGHBOR_IDS.map((c) => [c, Math.round(rel[c] * 10) / 10]));
  Object.assign(out, { treaties, sanctions, cooldown, mobilized, calm, event });
  return out;
}

function peaceStep(s, decisions, difficulty, q) {
  const out = { impulses: [], news: [], talks: s.peaceTalks || null, treaty: s.treaty || null, returned: [] };
  const held = heldAnnex(s);
  // непризнанная граница: партнёры не снимают ограничения, пока Норланд её не признал
  if (held.length && !(s.treaty && s.treaty.recognized)) {
    out.impulses.push(makeImpulse('exportsGrowth', -0.3, 'Санкции за непризнанную границу', 'fast', difficulty, 'other'),
      makeImpulse('fdi', -1, 'Непризнанная граница отпугивает инвесторов', 'fast', difficulty, 'other'));
  }
  const talks = s.peaceTalks;
  if (!talks) return out;
  const terms = sanitizeTreaty(decisions.treaty, s);
  if (terms && terms.walkAway) {
    out.talks = null;
    out.news.push(['gov', 'ПЕРЕГОВОРЫ С НОРЛАНДОМ ПРЕРВАНЫ', 'Договора не будет: граница остаётся непризнанной, санкции — в силе, а в Норланде говорят о реванше всё громче.', 8]);
    return out;
  }
  if (!terms || !terms.propose) {
    out.talks = { ...talks, leverage: Math.max(0, talks.leverage - 2) };
    return out;
  }
  const cost = treatyCost(terms, s);
  if (cost > talks.leverage) {
    out.talks = { ...talks, leverage: Math.max(0, talks.leverage - 2), attempts: (talks.attempts || 0) + 1, refused: { cost: Math.round(cost), q } };
    out.news.push(['gov', 'НОРЛАНД ОТВЕРГ УСЛОВИЯ МИРА', `Делегация Норланда покинула зал: требования (${Math.round(cost)}) выше того, что позволяет нынешняя позиция страны (${Math.round(talks.leverage)}). Позиция тает с каждым кварталом.`, 8]);
    return out;
  }
  // договор подписан
  out.talks = null;
  const kept = held.filter((id) => !terms.returned.includes(id));
  out.treaty = { q, recognized: terms.recognition, sanctions: terms.sanctions, reparations: terms.reparations, returned: terms.returned, kept };
  out.returned = terms.returned;
  out.impulses.push(makeImpulse('approvalPush', terms.returned.length || terms.reparations === 'pay' ? -2 : 3, 'Мирный договор с Норландом', 'fast', difficulty, 'other'),
    makeImpulse('tensionPush', -2, 'Мирный договор', 'fast', difficulty, 'other'),
    makeImpulse('businessConfidence', 4, 'Мирный договор', 'default', difficulty, 'other'));
  if (terms.recognition) out.impulses.push(makeImpulse('riskPremium', -0.3, 'Граница признана', 'default', difficulty),
    makeImpulse('fdi', 6, 'Граница признана', 'default', difficulty, 'other'), makeImpulse('exportsGrowth', 1.5, 'Граница признана', 'default', difficulty, 'other'));
  if (terms.sanctions) out.impulses.push(makeImpulse('exportsGrowth', 3, 'Санкции сняты', 'default', difficulty, 'other'),
    makeImpulse('importsGrowth', 2, 'Санкции сняты', 'default', difficulty, 'other'), makeImpulse('capitalFlow', 12, 'Санкции сняты', 'default', difficulty),
    makeImpulse('fdi', 8, 'Санкции сняты', 'default', difficulty, 'other'), makeImpulse('riskPremium', -0.4, 'Санкции сняты', 'default', difficulty),
    makeImpulse('stockShock', 6, 'Санкции сняты', 'fast', difficulty));
  const rep = s.nominalGdp * 0.6 / 100;
  if (terms.reparations === 'receive') out.impulses.push(sustainedImpulse('revenue', rep, 8, 'Репарации Норланда'));
  if (terms.reparations === 'pay') out.impulses.push(sustainedImpulse('revenue', -rep, 8, 'Выплата репараций Норланду'));
  const parts = [
    terms.recognition ? `Норланд признаёт новую границу${kept.length ? ` — за страной остаются: ${kept.map((id) => regionById(id).name).join(', ')}` : ''}.` : 'Граница остаётся непризнанной: это перемирие на бумаге, а не мир.',
    terms.sanctions ? 'Норланд поддерживает снятие санкций — партнёры возвращаются.' : '',
    terms.reparations === 'receive' ? 'Норланд выплатит репарации: около 0,6% ВВП в год два года.' : terms.reparations === 'pay' ? 'Страна выплатит Норланду репарации: около 0,6% ВВП в год два года.' : '',
    terms.returned.length ? `Норланду возвращаются: ${terms.returned.map((id) => regionById(id).name).join(', ')}.` : '',
  ].filter(Boolean);
  out.news.push(['gov', 'ПОДПИСАН МИРНЫЙ ДОГОВОР С НОРЛАНДОМ', parts.join(' '), 10]);
  return out;
}

/* ========================== РЕВАНШ НОРЛАНДА ==========================
   Пока у страны есть земли Норланда, Норланд копит реваншизм (norlandRevanche,
   0..100): быстрее, если граница не признана и земель много; медленнее, если
   договор подписан, и ещё медленнее, если граница признана; сильная армия
   сдерживает, кризисы в стране — подталкивают. На 100 Норланд нападает.
   Тогда война идёт за новые земли: каждый квартал Норланд бьёт по одной из них
   (куда — разведка сообщает заранее, campaign.next), а президент выбирает,
   какую область укрепить и как: держать оборону, контрудар или переговоры.
   Давление на область до 100 — она потеряна. Боевой дух Норланда тает, пока
   его атаки захлёбываются; на нуле он сам просит мира. */
const DEFENSE_STANCES = [
  { id: 'defend', label: 'Держать оборону', spend: 0.15, desc: 'Укрепить выбранную область: удар по ней почти не продвинется, но остальные прикрыты слабее.' },
  { id: 'counter', label: 'Контрудар', spend: 0.35, desc: 'Отбросить противника там, где он уже продвинулся. Дорого и с потерями, зато ломает его боевой дух.' },
  { id: 'talks', label: 'Переговоры о перемирии', spend: 0, desc: 'Остановить войну и сесть за стол. Чем больше потеряно, тем хуже условия.' },
];
const REVANCHE_WARN = 70;
function revancheGrowth(s) {
  const n = heldAnnex(s).length;
  if (!n) return -10;
  const t = s.treaty;
  const mult = (t && t.recognized ? 0.05 : t ? 0.6 : 1) * (s.peaceTalks ? 0.5 : 1);
  const deter = (warStrength(s) - 1) * 6;
  const crisis = (s.activeCrises || []).filter((c) => c !== 'war').length * 1.5;
  return Math.max(0, (3 + 3 * n + crisis) * mult - deter);
}
// куда Норланд ударит: где он уже продвинулся и где новой власти меньше всего рады
function revancheTarget(s, camp) {
  const held = heldAnnex(s).filter((id) => !(camp.lost || []).includes(id));
  return held.sort((a, b) => ((camp.pressure[b] || 0) + (60 - annexLoyalty(s, b))) - ((camp.pressure[a] || 0) + (60 - annexLoyalty(s, a))))[0] || null;
}
function defaultDefenseOrder(camp) {
  const last = camp.last && camp.last.stance !== 'talks' ? camp.last : null;
  return { target: camp.next, stance: last ? last.stance : 'defend' };
}
function botDefenseOrder(s, personaId) {
  const camp = s.revancheCampaign;
  if (!camp) return null;
  const worst = Object.entries(camp.pressure).filter(([id]) => heldAnnex(s).includes(id)).sort((a, b) => b[1] - a[1])[0];
  const approval = s.approval || 50;
  if (personaId === 'strongman') return worst && worst[1] > 40 ? { target: worst[0], stance: 'counter' } : { target: camp.next, stance: 'defend' };
  if (personaId === 'populist') return approval < 30 ? { target: camp.next, stance: 'talks' } : { target: camp.next, stance: 'defend' };
  if ((camp.lost || []).length || approval < 35) return { target: camp.next, stance: 'talks' };
  return { target: camp.next, stance: 'defend' };
}
function revancheStep(s, decisions, difficulty, q, blockStart) {
  const out = { impulses: [], news: [], spendPct: 0, start: false, endWar: false, lost: [], campaign: null, revanche: s.norlandRevanche || 0, talks: null, warned: !!s.revancheWarned };
  const atWar = (s.warQuartersLeft || 0) > 0;
  if (!atWar) {
    // ниже нуля — Норланд ещё не оправился от прошлой проигранной войны
    out.revanche = clamp(out.revanche + revancheGrowth(s), -50, 100);
    if (out.revanche >= REVANCHE_WARN && !out.warned && heldAnnex(s).length) {
      out.warned = true;
      out.news.push(['crisis', 'НОРЛАНД СТЯГИВАЕТ ВОЙСКА К НОВОЙ ГРАНИЦЕ', `Разведка докладывает: реваншизм в Норланде ${Math.round(out.revanche)} из 100. Сильная армия и признанная граница остужают его, кризисы в стране — подогревают.`, 8]);
    }
    if (out.revanche < 50) out.warned = false;
    if (out.revanche >= 100 && heldAnnex(s).length && !blockStart) {
      out.start = true;
      const camp = { pressure: Object.fromEntries(heldAnnex(s).map((id) => [id, 0])), morale: 100, lost: [], last: null, next: null };
      camp.next = revancheTarget(s, camp);
      out.campaign = camp;
      out.impulses.push(taperedImpulse('approvalPush', [4, 2, 1], 'Страну атаковали: сплочение', 'other'),
        makeImpulse('tensionPush', 8, 'Норланд напал', 'fast', difficulty, 'other'),
        makeImpulse('riskPremium', 0.5, 'Война на новой границе', 'default', difficulty),
        makeImpulse('capitalFlow', -12, 'Война на новой границе', 'default', difficulty),
        makeImpulse('businessConfidence', -8, 'Война на новой границе', 'default', difficulty, 'other'),
        makeImpulse('inflationSupply', 0.5, 'Война на новой границе', 'default', difficulty),
        makeImpulse('exportsGrowth', -2, 'Война на новой границе', 'default', difficulty, 'other'),
        makeImpulse('stockShock', -8, 'Война на новой границе', 'fast', difficulty));
      out.news.push(['crisis', 'НОРЛАНД НАЧАЛ ВОЙНУ ЗА ПОТЕРЯННЫЕ ЗЕМЛИ', `Норландские войска перешли новую границу. Первые бои идут в ${regionById(camp.next).loc}.${s.treaty && s.treaty.recognized ? ' Норланд нарушил договор, в котором сам признал границу.' : ''}`, 10]);
      out.revanche = 0;
    }
    return out;
  }
  if (s.warType !== 'revanche' || !s.revancheCampaign) return out;
  const camp = { ...s.revancheCampaign, pressure: { ...s.revancheCampaign.pressure }, lost: [...(s.revancheCampaign.lost || [])] };
  const held = heldAnnex(s).filter((id) => !camp.lost.includes(id));
  const def = defaultDefenseOrder(camp);
  const raw = decisions.warOrder || {};
  const stance = DEFENSE_STANCES.find((x) => x.id === raw.stance) || DEFENSE_STANCES.find((x) => x.id === def.stance) || DEFENSE_STANCES[0];
  const target = held.includes(raw.target) ? raw.target : held.includes(def.target) ? def.target : held[0];
  out.spendPct = stance.spend;
  if (stance.id === 'talks' || !held.length) {
    out.endWar = true;
    out.talks = held.length ? { since: q, leverage: Math.max(0, 5 + 6 * held.length - 10 * camp.lost.length + (100 - camp.morale) * 0.3), attempts: 0, origin: 'revanche' } : null;
    out.impulses.push(makeImpulse('approvalPush', -2, 'Перемирие на условиях войны', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 3, 'Бои на границе прекращены', 'default', difficulty, 'other'));
    out.revanche = -10 - (100 - camp.morale) * 0.3;
    out.news.push(['gov', 'ПЕРЕМИРИЕ С НОРЛАНДОМ НА НОВОЙ ГРАНИЦЕ', 'Стрельба прекращена, стороны садятся за стол. Условия будут зависеть от того, что удалось удержать.', 9]);
    camp.last = { target, stance: 'talks', hit: null, gain: 0, pushed: 0 };
    out.campaign = camp;
    return out;
  }
  // удар Норланда
  // разведка ошибается: примерно каждый третий удар приходится не туда, куда ждали
  const planned = held.includes(camp.next) ? camp.next : revancheTarget(s, camp);
  const others = held.filter((id) => id !== planned);
  const feint = others.length > 0 && rng() < 0.3;
  const hit = feint ? others[Math.floor(rng() * others.length)] : planned;
  const nStr = 0.5 + camp.morale / 200;
  const loyal = 1 + Math.max(0, 50 - annexLoyalty(s, hit)) / 100;
  let gain = (12 + 10 * rng()) * nStr * loyal / warStrength(s);
  if (target === hit) gain *= stance.id === 'defend' ? 0.3 : 0.6;
  camp.pressure[hit] = clamp((camp.pressure[hit] || 0) + gain, 0, 100);
  let pushed = 0;
  if (stance.id === 'counter') {
    pushed = warStrength(s) * (10 + 12 * rng());
    camp.pressure[target] = clamp((camp.pressure[target] || 0) - pushed, 0, 100);
    camp.morale -= 6 + 6 * rng();
    out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при контрударе', 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', 1, 'Потери при контрударе', 'fast', difficulty, 'other'));
  }
  if (target === hit && stance.id === 'defend') camp.morale -= 5;
  camp.morale = Math.max(0, camp.morale - 3);
  if (feint) out.news.push(['crisis', 'РАЗВЕДКА ОШИБЛАСЬ', `Норланд ударил не туда, где его ждали: бои идут в ${regionById(hit).loc}.`, 7]);
  if (camp.pressure[hit] >= 100) {
    camp.lost.push(hit);
    out.lost.push(hit);
    const r = regionById(hit);
    out.impulses.push(makeImpulse('approvalPush', -4, `Потерян ${r.name}`, 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', 4, `Потерян ${r.name}`, 'fast', difficulty, 'other'));
    out.news.push(['crisis', `НОРЛАНД ВЕРНУЛ СЕБЕ: ${r.name.toUpperCase()}`, `Оборона ${r.gen} прорвана. Земля, за которую воевали, снова норландская.`, 10]);
  }
  const stillHeld = held.filter((id) => !camp.lost.includes(id));
  if (!stillHeld.length) {
    out.endWar = true;
    out.news.push(['crisis', 'НОРЛАНД ВЕРНУЛ ВСЕ ПОТЕРЯННЫЕ ЗЕМЛИ', 'Война за новые земли проиграна: граница там же, где была до первой войны.', 10]);
  } else if (camp.morale <= 0) {
    out.endWar = true;
    out.talks = { since: q, leverage: 35 + 10 * stillHeld.length, attempts: 0, origin: 'revanche' };
    out.impulses.push(makeImpulse('approvalPush', 4, 'Норланд отступил', 'fast', difficulty, 'other'));
    out.revanche = -40;
    out.news.push(['gov', 'НОРЛАНД ПРОСИТ МИРА', 'Атаки захлебнулись, армия Норланда выдохлась и предлагает переговоры. Позиция страны за столом сильная.', 10]);
  }
  camp.last = { target, stance: stance.id, hit, gain: Math.round(gain), pushed: Math.round(pushed), feint };
  camp.next = stillHeld.length ? revancheTarget(s, camp) : null;
  out.campaign = camp;
  return out;
}

/* ======================= ОБОРОНИТЕЛЬНАЯ ВОЙНА =======================
   На страну напала Республика Дешт — с юго-запада, по равнинам Приреченской и
   лесам Боровской области. Раньше такая война просто шла четыре квартала, а
   игроку оставалось только капитулировать. Теперь это фронт: каждый квартал
   противник давит на одну из двух областей (разведка иногда ошибается), президент
   или премьер отдаёт приказ — держать оборону там, где ждут удара, контрударом
   отбросить противника или просить перемирия. Область, где давление дошло до 100,
   оккупирована: там рушатся напряжение, потребление и потенциал, пока её не отобьют
   (давление ниже 60). Выдохшийся противник уходит сам, срок войны — прежний. */
const DEF_FRONT = ['agri', 'periphery'];
const DEF_ENEMY = 'Республика Дешт';
function newDefenseCampaign() {
  return { pressure: { agri: 0, periphery: 0 }, occupied: [], morale: 100, last: null, next: 'agri' };
}
function defenseTarget(camp) {
  const free = DEF_FRONT.filter((id) => !camp.occupied.includes(id));
  return free.sort((a, b) => (camp.pressure[b] || 0) - (camp.pressure[a] || 0))[0] || null;
}
function defaultFrontOrder(camp) {
  const last = camp.last && camp.last.stance !== 'talks' ? camp.last : null;
  return { target: (last && last.stance === 'counter' && camp.occupied.includes(last.target)) ? last.target : camp.next || DEF_FRONT[0],
    stance: last ? last.stance : 'defend' };
}
function botFrontOrder(s, personaId) {
  const camp = s.defenseCampaign;
  if (!camp) return null;
  const occ = camp.occupied[0];
  if (personaId === 'strongman') return occ ? { target: occ, stance: 'counter' } : { target: camp.next, stance: 'defend' };
  if (occ && warStrength(s) >= 0.85) return { target: occ, stance: 'counter' };
  if (personaId === 'populist' && (s.approval || 50) < 30) return { target: camp.next, stance: 'talks' };
  if (camp.occupied.length >= 2) return { target: camp.next, stance: 'talks' };
  return { target: camp.next || DEF_FRONT[0], stance: 'defend' };
}
function defenseStep(s, decisions, difficulty, q, starting) {
  const out = { impulses: [], news: [], spendPct: 0, endWar: false, campaign: null, shock: {} };
  if (starting) { out.campaign = newDefenseCampaign(); return out; }
  if (!((s.warQuartersLeft || 0) > 0 && s.warType === 'defensive')) return out;
  const prev = s.defenseCampaign || newDefenseCampaign();
  const camp = { ...prev, pressure: { ...prev.pressure }, occupied: [...(prev.occupied || [])] };
  const raw = decisions.warOrder || {};
  const def = defaultFrontOrder(camp);
  const stance = DEFENSE_STANCES.find((x) => x.id === raw.stance) || DEFENSE_STANCES.find((x) => x.id === def.stance) || DEFENSE_STANCES[0];
  const target = DEF_FRONT.includes(raw.target) ? raw.target : def.target;
  const nameOf = (id) => regionById(id);
  out.spendPct = stance.spend;
  if (stance.id === 'talks') {
    out.endWar = true;
    const lost = camp.occupied.length;
    out.impulses.push(makeImpulse('approvalPush', -2 - 3 * lost, 'Перемирие с Дештом', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 4, 'Бои прекращены', 'default', difficulty, 'other'));
    out.news.push(['gov', `ПЕРЕМИРИЕ: ${DEF_ENEMY.toUpperCase()} ОСТАНАВЛИВАЕТ НАСТУПЛЕНИЕ`, lost
      ? `Стрельба прекращена. Занятые районы ${camp.occupied.map((id) => nameOf(id).gen).join(' и ')} возвращаются по соглашению — ценой уступок, которые оппозиция назовёт капитуляцией.`
      : 'Стрельба прекращена, фронт удержан. Мир дороже войны, но его цену ещё будут вспоминать.', 9]);
    camp.last = { target, stance: 'talks', hit: null, gain: 0, pushed: 0 };
    out.campaign = camp;
    return out;
  }
  // удар противника: туда, где он уже продвинулся; примерно каждый четвёртый — не туда
  const free = DEF_FRONT.filter((id) => !camp.occupied.includes(id));
  const planned = free.includes(camp.next) ? camp.next : defenseTarget(camp);
  const others = free.filter((id) => id !== planned);
  const feint = !!planned && others.length > 0 && rng() < 0.25;
  const hit = feint ? others[Math.floor(rng() * others.length)] : planned;
  let gain = 0;
  if (hit) {
    const nStr = 0.5 + camp.morale / 200;
    gain = (11 + 9 * rng()) * nStr / warStrength(s);
    if (target === hit) gain *= stance.id === 'defend' ? 0.3 : 0.6;
    camp.pressure[hit] = clamp((camp.pressure[hit] || 0) + gain, 0, 100);
    if (camp.pressure[hit] >= 100 && !camp.occupied.includes(hit)) {
      camp.occupied.push(hit);
      out.impulses.push(makeImpulse('approvalPush', -4, `Оккупирована ${nameOf(hit).name}`, 'fast', difficulty, 'other'),
        makeImpulse('tensionPush', 4, `Оккупирована ${nameOf(hit).name}`, 'fast', difficulty, 'other'));
      out.news.push(['crisis', `ФРОНТ ПРОРВАН: ЗАНЯТА ${nameOf(hit).name.toUpperCase()}`, `Войска Дешта вошли в ${nameOf(hit).city}. Пока область под оккупацией, её хозяйство стоит, а люди бегут в тыл. Отбить её можно только контрударом.`, 10]);
    }
  }
  let pushed = 0;
  if (stance.id === 'counter') {
    pushed = warStrength(s) * (10 + 12 * rng());
    camp.pressure[target] = clamp((camp.pressure[target] || 0) - pushed, 0, 100);
    camp.morale -= 6 + 6 * rng();
    out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при контрударе', 'fast', difficulty, 'other'));
    if (camp.occupied.includes(target) && camp.pressure[target] < 60) {
      camp.occupied = camp.occupied.filter((id) => id !== target);
      out.impulses.push(makeImpulse('approvalPush', 4, `Освобождена ${nameOf(target).name}`, 'fast', difficulty, 'other'));
      out.news.push(['gov', `ОСВОБОЖДЕНА ${nameOf(target).name.toUpperCase()}`, `Контрудар отбросил противника: ${nameOf(target).city} снова под контролем страны.`, 10]);
    }
  }
  if (hit && target === hit && stance.id === 'defend') camp.morale -= 5;
  camp.morale = Math.max(0, camp.morale - 4);
  if (feint) out.news.push(['crisis', 'РАЗВЕДКА ОШИБЛАСЬ', `${DEF_ENEMY} ударила не там, где её ждали: бои идут в ${nameOf(hit).loc}.`, 7]);
  // оккупация: область живёт без хозяйства, пока её не отобьют
  camp.occupied.forEach((id) => {
    out.shock[id] = 25;
    out.impulses.push(makeImpulse('potentialShock', -0.25, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty),
      makeImpulse('consumption', -0.8, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty),
      makeImpulse('approvalPush', -1.2, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty, 'other'));
  });
  if (camp.morale <= 0) {
    out.endWar = true;
    out.impulses.push(makeImpulse('approvalPush', 5, `${DEF_ENEMY} отступила`, 'fast', difficulty, 'other'));
    out.news.push(['gov', `${DEF_ENEMY.toUpperCase()} ОТСТУПАЕТ`, 'Наступление захлебнулось: армия противника выдохлась и уходит за границу. Занятые районы освобождены.', 10]);
  } else {
    /* Срока у войны нет: никто не знает заранее, когда она кончится. Дешт сам идёт на
       перемирие — тем вероятнее, чем дольше война и чем ниже боевой дух его армии;
       занятое он при этом возвращает не даром — это перемирие, а не победа. */
    const elapsed = (s.warElapsed || 1);
    const pStop = clamp(0.04 + 0.035 * elapsed + (100 - camp.morale) / 350, 0, 0.55);
    if (rng() < pStop) {
      out.endWar = true;
      const lost = camp.occupied.length;
      out.impulses.push(makeImpulse('approvalPush', lost ? 1 : 3, `${DEF_ENEMY} согласилась на перемирие`, 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', 4, 'Бои прекращены', 'default', difficulty, 'other'));
      out.news.push(['gov', `${DEF_ENEMY.toUpperCase()} ПРЕДЛАГАЕТ ПЕРЕМИРИЕ`, lost
        ? `Армия противника устала: Ашкала соглашается остановить бои и вывести войска из ${camp.occupied.map((id) => nameOf(id).gen).join(' и ')} в обмен на прекращение огня.`
        : 'Армия противника устала: Ашкала соглашается остановить бои по линии границы.', 10]);
    }
  }
  camp.last = { target, stance: stance.id, hit, gain: Math.round(gain), pushed: Math.round(pushed), feint };
  camp.next = defenseTarget(camp);
  out.campaign = camp;
  return out;
}

/* ======================= ОПРОСЫ И ШТАБ КАМПАНИИ =======================
   За четыре квартала до голосования появляются опросы по областям. Кампания —
   это штабы: каждый квартал президент (или бот за него) распределяет
   CAMPAIGN_POINTS штабов по областям, каждый стоит денег. Штаб убеждает тем
   сильнее, чем ближе область к перелому: там, где исход предрешён в ту или
   другую сторону, агитация почти бесполезна. Прибавка по областям складывается
   в общенациональный итог — поэтому выгоднее бороться за колеблющиеся области,
   а безнадёжные признать потерянными. */
const CAMPAIGN_POINTS = 4;
const CAMPAIGN_COST = 0.04; // % ВВП за штаб
const POLL_WINDOW = 4;
const campaignOpen = (s) => (s.politicalRegime || 'democracy') === 'democracy' || s.politicalRegime === 'crisis';
function persuadability(share) {
  const m = Math.abs(share - 50);
  return m < 4 ? 1 : m < 8 ? 0.55 : 0.2;
}
const campaignBonus = (points, share) => 1.6 * Math.sqrt(Math.max(0, points || 0)) * persuadability(share);
const swingLabel = (share) => {
  const m = share - 50;
  if (Math.abs(m) < 4) return 'колеблется';
  if (Math.abs(m) < 8) return m > 0 ? 'склоняется к власти' : 'склоняется к оппозиции';
  return m > 0 ? 'надёжная' : 'потеряна';
};
/* Прогноз: та же формула, что и в день голосования, без неопределённости дня
   голосования, но с уже вложенными штабами. Погрешность опроса — ±2,5 п.п.
   При несвободном режиме выборы рисуют, и настоящую поддержку показывает только
   закрытый замер для внутреннего пользования: он есть каждый квартал, штабов
   в нём нет, а погрешность шире — люди боятся отвечать. */
const CLOSED_POLL_MARGIN = { authoritarian: 5, totalitarian: 8 };
function electionForecast(s, extraPlan) {
  const toVote = Number.isFinite(s.quartersToElection) ? s.quartersToElection : 16;
  const closed = CLOSED_POLL_MARGIN[s.politicalRegime] || 0;
  if (!closed && (toVote > POLL_WINDOW || toVote < 1 || !campaignOpen(s))) return null;
  const base = clamp(50 + ((s.approval || 50) - 50 + groupTurnoutShift(s)) * 0.85 + 2.5, 0, 100);
  const spent = closed ? {} : { ...s.campaignSpend };
  if (!closed) Object.entries(extraPlan || {}).forEach(([id, n]) => { spent[id] = (spent[id] || 0) + n; });
  const byRegion = regionVoteShares(s, base, false).map((r) => ({
    id: r.id, base: r.share, spent: spent[r.id] || 0,
    share: clamp(r.share + campaignBonus(spent[r.id], r.share), 0, 100),
  })).map((r) => ({ ...r, label: swingLabel(r.base) }));
  const national = byRegion.reduce((a, b) => a + b.share, 0) / (byRegion.length || 1);
  if (closed) {
    // официальная цифра, которую напечатают, — для сравнения с настоящей
    const official = regionVoteShares(s, base, true);
    return { national, byRegion, closed: true, margin: closed, noElections: !!s.noElections,
      quartersToElection: s.noElections ? null : toVote,
      official: official.reduce((a, b) => a + b.share, 0) / (official.length || 1) };
  }
  return { national, byRegion, quartersToElection: toVote, margin: 2.5 };
}
// только настоящие области, целые штабы и не больше положенного за квартал
function sanitizeCampaignPlan(plan, s) {
  const out = {}; let left = CAMPAIGN_POINTS;
  (s ? votingRegions(s) : MAP_REGIONS).forEach((r) => {
    const n = Math.max(0, Math.min(left, Math.floor(Number((plan || {})[r.id]) || 0)));
    if (n > 0) { out[r.id] = n; left -= n; }
  });
  return out;
}
// бот-штаб: по одному штабу в четыре самые колеблющиеся области
function botCampaignPlan(s) {
  const f = electionForecast(s);
  if (!f || f.closed) return {};
  const plan = {};
  [...f.byRegion].sort((a, b) => Math.abs(a.share - 50) - Math.abs(b.share - 50)).slice(0, CAMPAIGN_POINTS).forEach((r) => { plan[r.id] = 1; });
  return plan;
}
function campaignStep(s, decisions) {
  const toVote = Number.isFinite(s.quartersToElection) ? s.quartersToElection : 16;
  if (toVote > POLL_WINDOW || toVote < 1 || !campaignOpen(s)) return { spend: { ...s.campaignSpend }, spendPct: 0 };
  const plan = sanitizeCampaignPlan(decisions.campaignPlan, s);
  const spend = { ...s.campaignSpend };
  let total = 0;
  Object.entries(plan).forEach(([id, n]) => { spend[id] = (spend[id] || 0) + n; total += n; });
  return { spend, spendPct: total * CAMPAIGN_COST };
}

/* ======================== ОБЩЕСТВО: СОЦИАЛЬНЫЕ ГРУППЫ ========================
   Рейтинг власти — не одна цифра на всю страну, а взвешенная сумма поддержки
   семи групп. У каждой свои интересы (groupDrivers — что и насколько двигает её
   поддержку сверх общего фона), память (groupMemory — решения, которые она
   помнит кварталами: пенсионная реформа, мобилизация, разгон протестов) и лидер.
   Группа с поддержкой от 50 — в коалиции власти; ниже 35 — в оппозиции и
   действует: пенсионеры выходят на улицы и голосуют активнее всех, рабочие
   бастуют, бизнес выводит капитал, молодёжь протестует и уезжает, силовики
   ропщут — и именно их потеря делает переворот вероятнее.
   В нейтральной экономике отклонения групп в сумме около нуля — рейтинг
   ведёт себя как раньше; разница появляется, когда политика выигрывает у одних
   и проигрывает у других. */
const SOCIAL_GROUPS = [
  { id: 'pensioners', name: 'Пенсионеры', weight: 0.2, turnout: 1.5, icon: 'pensioners',
    leader: { name: 'Галина Воронцова', title: 'председатель Союза пенсионеров' },
    wants: 'Стабильные цены и индексацию пенсий и соцвыплат.',
    lost: 'Выходят на улицы и приходят на выборы активнее всех: их недовольство сильнее всего бьёт по итогу голосования.' },
  { id: 'workers', name: 'Рабочие', weight: 0.2, turnout: 1, icon: 'workers',
    leader: { name: 'Степан Грачёв', title: 'лидер Федерации профсоюзов' },
    wants: 'Работу, растущие реальные зарплаты и заказы заводам.',
    lost: 'Бастуют: встают заводы и шахты, проседают выпуск и экспорт.' },
  { id: 'business', name: 'Бизнес', weight: 0.12, turnout: 1, icon: 'business',
    leader: { name: 'Аркадий Левин', title: 'глава Союза промышленников' },
    wants: 'Низкие налоги и ставки, предсказуемые правила, никакой войны и произвола.',
    lost: 'Выводит капитал и откладывает инвестиции: растёт премия за риск.' },
  { id: 'siloviki', name: 'Силовики', weight: 0.08, turnout: 1, icon: 'siloviki',
    leader: { name: 'генерал Олег Рубцов', title: 'начальник Генштаба' },
    wants: 'Деньги на оборону, порядок и сильную руку.',
    lost: 'Ропщут в казармах: риск военного переворота растёт в разы даже при терпимом рейтинге.' },
  { id: 'public', name: 'Бюджетники', weight: 0.15, turnout: 1.1, icon: 'public',
    leader: { name: 'Нина Сомова', title: 'председатель профсоюза учителей и врачей' },
    wants: 'Зарплаты в бюджетной сфере, деньги на школы и больницы.',
    lost: 'Учителя и врачи бастуют: падает доверие к государству.' },
  { id: 'youth', name: 'Молодёжь', weight: 0.15, turnout: 0.6, icon: 'youth',
    leader: { name: 'Кира Лебедь', title: 'лидер студенческого движения' },
    wants: 'Работу, свободы и будущее — без войны и цензуры.',
    lost: 'Протестует и уезжает: растёт напряжённость, страна теряет рабочие руки.' },
  { id: 'regions', name: 'Регионы', weight: 0.1, turnout: 1.1, icon: 'regions',
    leader: { name: 'Павел Мирошник', title: 'глава Ассоциации губернаторов' },
    wants: 'Трансферты и стройки в областях, спокойствие на местах.',
    lost: 'Губернаторы саботируют решения центра: растут напряжённость и недоверие.' },
];
// что каждое решение президента значит для групп: кто выиграл, кто проиграл
const ACTION_GROUP_EFFECTS = {
  address: { pensioners: 2, public: 1, regions: 1 },
  elite_deal: { business: 8, regions: 6, siloviki: 4, youth: -6, workers: -3 },
  anticorruption: { youth: 8, workers: 4, public: 3, business: -5, regions: -6, siloviki: -3 },
  crackdown: { siloviki: 10, youth: -18, workers: -8, business: -4, public: -4 },
  military_parade: { siloviki: 6, pensioners: 4, youth: -4 },
  sanctions_impose: { siloviki: 4, business: -8, workers: -2 },
  trade_bloc: { business: 8, youth: 4, workers: -3, siloviki: -3 },
  dissolve: { siloviki: 6, youth: -15, business: -6, public: -4 },
  restore_parliament: { youth: 10, business: 5, siloviki: -8 },
  war_start: { siloviki: 14, pensioners: 3, youth: -14, business: -12, workers: -3 },
  mobilization: { youth: -22, workers: -10, pensioners: -6, siloviki: 6 },
  war_economy: { workers: 6, siloviki: 8, business: -10, youth: -3 },
  peace_deal: { business: 8, youth: 8, siloviki: -10 },
  seize_control: { siloviki: 10, youth: -20, business: -10, public: -6, regions: -4 },
  labor: { business: 12, workers: -14, youth: 3 },
  pension: { pensioners: -22, business: 6, youth: 4, public: -3 },
  courts: { business: 8, youth: 5, siloviki: -6, regions: -3 },
  deregulation: { business: 12, youth: 3, public: -6, regions: -2 },
  education: { youth: 8, public: 6, pensioners: -2 },
  infra_program: { regions: 12, workers: 6, business: 3 },
};
const groupMemoryOf = (effects, text, quarters) => Object.entries(effects || {})
  .filter(([, v]) => v).map(([group, amount]) => ({ group, amount, left: quarters, total: quarters, text }));
// что двигает группу сверх общего фона: [подпись, вклад в пунктах]
function groupDrivers(id, x) {
  const infGap = Math.max(0, x.inflation - x.infTarget);
  const uGap = x.unemployment - x.nairu;
  const d = x.decisions || {};
  const sh = x.budgetShares || {};
  const num = (v, def) => (Number.isFinite(v) ? v : def);
  switch (id) {
    case 'pensioners': return [['Цены', -1.2 * infGap], ['Соцвыплаты', 0.7 * num(d.transfers, 0)]];
    case 'workers': return [['Безработица', -1.8 * uGap], ['Реальные зарплаты', 1.2 * (x.wageGrowth - x.inflation - 2)]];
    case 'business': return [['Ставка', -0.7 * (num(d.keyRate, 5.5) - (x.infTarget + 2))], ['Налог на прибыль', -0.8 * (num(d.profitTaxRate, 20) - 20)],
      ['Настроения бизнеса', 0.15 * (x.businessConfidence - 55)], ['Война', x.offensiveWar ? -6 : 0], ['Произвол', -8 * x.repression]];
    case 'siloviki': return [['Оборона в бюджете', 1.2 * (num(sh.defense, 15) - 15)], ['Сильная рука', 10 * x.repression], ['Война', x.atWar ? 4 : 0]];
    case 'public': return [['Госрасходы', 0.8 * num(d.govSpending, 0)], ['Школы и больницы', 0.5 * (num(sh.health, 19) + num(sh.education, 16) - 35)], ['Цены', -0.8 * infGap]];
    case 'youth': return [['Работа', -1.5 * uGap], ['Свободы', -14 * x.repression], ['Война', x.atWar ? -6 : 0]];
    case 'regions': return [['Напряжение в областях', -0.3 * (x.avgStress - 15)], ['Соцвыплаты', 0.5 * num(d.transfers, 0)], ['Стройки', 2 * x.projects]];
    default: return [];
  }
}
/* Что ползунок при этом значении значит для групп — те же коэффициенты, что и
   в groupDrivers, только по одному рычагу: [[группа, пункты], …]. */
const LEVER_GROUP_SENS = {
  transfers: (v) => [['pensioners', 0.7 * v], ['regions', 0.5 * v]],
  govSpending: (v) => [['public', 0.8 * v]],
  profitTaxRate: (v) => [['business', -0.8 * (v - 20)]],
  keyRate: (v, t) => [['business', -0.7 * (v - (t + 2))]],
  shareDefense: (v) => [['siloviki', 1.2 * (v - 15)]],
  shareHealth: (v) => [['public', 0.5 * (v - 19)]],
  shareEducation: (v) => [['public', 0.5 * (v - 16)]],
};
function leverGroupEffects(leverId, value, infTarget) {
  const f = LEVER_GROUP_SENS[leverId];
  if (!f || !Number.isFinite(value)) return [];
  return f(value, Number.isFinite(infTarget) ? infTarget : CONFIG.target.inflation)
    .map(([g, v]) => [g, Math.round(v * 10) / 10]).filter(([, v]) => Math.abs(v) >= 0.5);
}
function groupStep(s, ctx) {
  const base = Number.isFinite(s.approval) ? s.approval : 55;
  const prev = s.groupSupport || {};
  // запись с wait > 0 ещё не действует: так живёт невыполненное обещание — сначала
  // благодарность, а через несколько кварталов разочарование
  const memory = [...(s.groupMemory || []).map((m) => (m.wait > 0 ? { ...m, wait: m.wait - 1 } : { ...m, left: m.left - 1 }))
    .filter((m) => m.left > 0), ...(ctx.newMemory || [])];
  const support = {}; const drivers = {};
  const meanDev = SOCIAL_GROUPS.reduce((acc, g) => acc + g.weight
    * clamp(groupDrivers(g.id, ctx).reduce((x, [, v]) => x + v, 0), -25, 25), 0);
  SOCIAL_GROUPS.forEach((g) => {
    const parts = groupDrivers(g.id, ctx).filter(([, v]) => Math.abs(v) >= 0.05);
    drivers[g.id] = parts.map(([k, v]) => [k, Math.round(v * 10) / 10]);
    // интересы групп в основном перераспределяют поддержку, а не опускают её всем
    // сразу: цены и безработица уже сидят в общем рейтинге (approvalTarget), и без
    // центрирования в кризисе они учитывались дважды — каждая группа тонула ещё и
    // по своим поводам. 80% среднего отклонения вычитаем; остаток — то, насколько
    // политика нравится обществу в целом сверх базового рейтинга
    const dev = clamp(parts.reduce((a, [, v]) => a + v, 0) - 0.8 * meanDev, -25, 25);
    const mem = memory.filter((m) => m.group === g.id && !(m.wait > 0)).reduce((a, m) => a + (m.amount * m.left) / m.total, 0);
    const target = clamp(ctx.approvalTarget + dev + mem, 0, 100);
    support[g.id] = clamp(ema(Number.isFinite(prev[g.id]) ? prev[g.id] : base, target, 0.28) + (ctx.push || 0), 0, 100);
  });
  const approval = clamp(SOCIAL_GROUPS.reduce((a, g) => a + g.weight * support[g.id], 0), 0, 100);
  // группы, отставшие от среднего по стране, добавляют напряжённости сверх той, что
  // даёт низкий рейтинг: расколотое общество неспокойнее ровно недовольного. Раньше
  // здесь считался просто уровень (40 − поддержка), и в кризисе, когда недовольны
  // все, общее недовольство учитывалось дважды — через рейтинг и ещё раз здесь:
  // в «Валютном кризисе» переворот случался почти в каждой партии
  const unrest = SOCIAL_GROUPS.reduce((a, g) => a + g.weight * Math.max(0, approval - 8 - support[g.id]), 0) * 1.2;
  return { support, memory, drivers, approval, unrest };
}
const groupStatus = (v) => (v >= 60 ? 'опора власти' : v >= 50 ? 'лояльны' : v >= 35 ? 'колеблются' : 'в оппозиции');
function coalitionOf(support) {
  const members = SOCIAL_GROUPS.filter((g) => (support || {})[g.id] >= 50);
  return { members: members.map((g) => g.id), weight: members.reduce((a, g) => a + g.weight, 0) };
}
// пенсионеры голосуют чаще молодёжи: итог выборов считается по явке, а не только по весу
function groupTurnoutShift(s) {
  const sup = s.groupSupport;
  if (!sup) return 0;
  let tw = 0; let ts = 0; let plain = 0;
  SOCIAL_GROUPS.forEach((g) => {
    const v = Number.isFinite(sup[g.id]) ? sup[g.id] : 50;
    tw += g.weight * g.turnout; ts += g.weight * g.turnout * v; plain += g.weight * v;
  });
  return tw > 0 ? ts / tw - plain : 0;
}
// кто в какой области живёт — отсюда и разница в голосовании областей
const REGION_GROUP_MIX = {
  capital: { youth: 0.25, public: 0.2, business: 0.2, pensioners: 0.15, workers: 0.1, siloviki: 0.1 },
  port: { workers: 0.3, business: 0.2, youth: 0.2, pensioners: 0.15, public: 0.1, regions: 0.05 },
  industry: { workers: 0.45, pensioners: 0.2, public: 0.15, youth: 0.1, regions: 0.1 },
  agri: { pensioners: 0.35, regions: 0.3, workers: 0.15, public: 0.15, youth: 0.05 },
  finance: { business: 0.4, youth: 0.2, public: 0.15, pensioners: 0.15, workers: 0.1 },
  mining: { workers: 0.45, regions: 0.2, pensioners: 0.15, siloviki: 0.1, public: 0.1 },
  periphery: { pensioners: 0.35, regions: 0.3, public: 0.2, workers: 0.1, youth: 0.05 },
};
const ANNEX_GROUP_MIX = { regions: 0.4, workers: 0.3, pensioners: 0.2, youth: 0.1 };
function regionGroupSupport(regionId, s) {
  const sup = s.groupSupport;
  if (!sup) return null;
  const mix = REGION_GROUP_MIX[regionId] || ANNEX_GROUP_MIX;
  return Object.entries(mix).reduce((a, [g, w]) => a + w * (Number.isFinite(sup[g]) ? sup[g] : 50), 0);
}
// лидер потерянной группы переходит к делу: протест, забастовка, бегство капитала
const GROUP_UNREST = {
  pensioners: { headline: 'ПЕНСИОНЕРЫ ВЫШЛИ НА УЛИЦЫ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Пенсия не поспевает за ценами. Мы помним, кто это допустил, — и придём на выборы».`,
    impulses: (d) => [makeImpulse('tensionPush', 2, 'Протесты пенсионеров', 'fast', d, 'other')] },
  workers: { headline: 'ЗАБАСТОВКА: ПРОФСОЮЗЫ ОСТАНОВИЛИ ЗАВОДЫ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Работать за такие деньги — и при таких решениях — мы больше не будем».`,
    impulses: (d) => [makeImpulse('exportsGrowth', -0.8, 'Забастовка рабочих', 'fast', d, 'other'),
      makeImpulse('tensionPush', 2, 'Забастовка рабочих', 'fast', d, 'other')] },
  business: { headline: 'БИЗНЕС ВЫВОДИТ КАПИТАЛ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Вкладываться туда, где правила меняются каждый квартал, никто не будет».`,
    impulses: (d) => [makeImpulse('capitalFlow', -8, 'Бизнес выводит капитал', 'fast', d),
      makeImpulse('riskPremium', 0.05, 'Бизнес не верит власти', 'fast', d), makeImpulse('businessConfidence', -3, 'Бизнес не верит власти', 'fast', d, 'other')] },
  siloviki: { headline: 'РОПОТ В ГЕНШТАБЕ',
    text: (g) => `${g.leader.name}, ${g.leader.title}, на закрытом совещании: «Армию держат впроголодь и не слушают. Долго так продолжаться не может».`,
    impulses: (d) => [makeImpulse('tensionPush', 1, 'Недовольство силовиков', 'fast', d, 'other')] },
  public: { headline: 'УЧИТЕЛЯ И ВРАЧИ БАСТУЮТ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Школы и больницы держатся на нашем терпении. Оно кончилось».`,
    impulses: (d) => [makeImpulse('govTrust', -2, 'Забастовка бюджетников', 'default', d, 'other'),
      makeImpulse('tensionPush', 1.5, 'Забастовка бюджетников', 'fast', d, 'other')] },
  youth: { headline: 'МОЛОДЁЖЬ ПРОТЕСТУЕТ — И УЕЗЖАЕТ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Здесь нам не оставили ни работы, ни голоса. Кто не выходит на площадь — покупает билет».`,
    impulses: (d) => [makeImpulse('tensionPush', 3, 'Протесты молодёжи', 'fast', d, 'other'),
      makeImpulse('laborForce', -0.05, 'Молодые уезжают', 'slow', d, 'other')] },
  regions: { headline: 'ГУБЕРНАТОРЫ ПРОТИВ ЦЕНТРА',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Области забыты. Решения центра на местах исполнять некому и незачем».`,
    impulses: (d) => [makeImpulse('govTrust', -1, 'Губернаторы против центра', 'default', d, 'other'),
      makeImpulse('tensionPush', 1, 'Губернаторы против центра', 'fast', d, 'other')] },
};
function groupEpisodes(s, support, difficulty) {
  const out = { impulses: [], news: [], cd: {} };
  Object.entries(s.groupUnrestCd || {}).forEach(([id, v]) => { if (v > 1) out.cd[id] = v - 1; });
  /* Не больше одного выступления за квартал — от самой обиженной группы. Раньше каждая
     группа в оппозиции выходила сама по себе, и в глубоком кризисе, когда в оппозиции
     почти все, их толчки напряжения складывались (плюс пачка одинаковых заголовков
     в газете) — это и доводило кризисные сценарии до переворота почти всегда. */
  const angry = SOCIAL_GROUPS.filter((g) => support[g.id] < 35 && !out.cd[g.id]).sort((a, b) => support[a.id] - support[b.id]);
  const g = angry[0];
  if (g && rng() < 0.5) {
    const u = GROUP_UNREST[g.id];
    out.impulses.push(...u.impulses(difficulty));
    out.news.push(['crisis', u.headline, u.text(g), 7]);
    out.cd[g.id] = 3;
  }
  return out;
}

/* Требования лидеров групп. Когда группа уходит к оппозиции, её лидер приходит
   с конкретным требованием — и на него надо ответить в следующем квартале, как на
   событие в области: уступить (деньги, группа довольна надолго), пообещать (дёшево,
   благодарность сейчас — разочарование потом), отказать (группа запомнит).
   Отвечают Минфин и президент; без ответа — отказ. */
const GROUP_DEMANDS = {
  pensioners: { title: 'Пенсионеры требуют внеочередной индексации', concede: 'Проиндексировать пенсии', spend: 0.2,
    text: (s) => `Инфляция ${fmt1(s.inflation)}%, пенсия за ценами не поспевает. Союз пенсионеров требует внеочередной индексации.` },
  workers: { title: 'Профсоюзы требуют заказов и индексации зарплат', concede: 'Госзаказ заводам и индексация', spend: 0.15,
    text: (s) => `Безработица ${fmt1(s.unemployment)}%. Федерация профсоюзов требует госзаказов и индексации зарплат на госпредприятиях.`,
    extra: (d) => [makeImpulse('inflationSupply', 0.1, 'Индексация зарплат по требованию профсоюзов', 'slow', d, 'other')] },
  business: { title: 'Бизнес требует снизить налоговую нагрузку', concede: 'Налоговые каникулы для бизнеса', spend: 0,
    text: (s) => `Премия за риск ${fmt1(s.riskPremium)} п.п., ставка ${fmt1(s.keyRate)}%. Союз промышленников требует налоговых каникул — иначе инвестиции уйдут за границу.`,
    extra: (d, s) => [sustainedImpulse('revenue', -(s.nominalGdp || 0) * 0.4 / 100, 6, 'Налоговые каникулы для бизнеса'),
      makeImpulse('businessConfidence', 4, 'Налоговые каникулы', 'default', d, 'other')] },
  siloviki: { title: 'Генштаб требует денег на перевооружение', concede: 'Выделить деньги на перевооружение', spend: 0.25,
    text: () => 'Генштаб докладывает: техника изношена, довольствие отстаёт от цен. Требование — внеочередное финансирование перевооружения.' },
  public: { title: 'Учителя и врачи требуют повышения зарплат', concede: 'Поднять зарплаты бюджетникам', spend: 0.2,
    text: () => 'Профсоюз учителей и врачей грозит забастовкой: зарплаты в школах и больницах отстали от цен и от частного сектора.' },
  youth: { title: 'Студенты требуют работы и свобод', concede: 'Молодёжная программа: рабочие места и гранты', spend: 0.08,
    text: (s) => `Молодёжная безработица растёт вдвое быстрее общей (${fmt1(s.unemployment)}%). Студенческое движение требует программы рабочих мест${s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian' ? ' и отмены цензуры' : ''}.` },
  regions: { title: 'Губернаторы требуют трансфертов', concede: 'Увеличить трансферты областям', spend: 0.15,
    text: () => 'Ассоциация губернаторов: областные бюджеты пусты, зарплаты бюджетникам на местах платить нечем. Требование — трансферты из центра.' },
};
function publicGroupDemand(groupId, s, q) {
  const g = SOCIAL_GROUPS.find((x) => x.id === groupId);
  const t = GROUP_DEMANDS[groupId];
  return { group: groupId, title: t.title, text: t.text(s), q, leader: g.leader, defaultOption: 'refuse',
    options: [
      { id: 'concede', tone: 'generous', label: t.concede, spend: t.spend, support: 10,
        effect: 'Группа довольна надолго — но это стоит денег.' },
      { id: 'promise', tone: 'cheap', label: 'Пообещать и отложить', spend: 0, support: 5,
        effect: 'Сейчас — благодарность, через год — разочарование, если обещание так и не выполнят.' },
      { id: 'refuse', tone: 'hard', label: 'Отказать', spend: 0, support: -7,
        effect: 'Бюджет цел, группа запомнит отказ — и её лидер перейдёт к делу.' },
    ] };
}
function groupDemandStep(s, decisions, difficulty, q) {
  const out = { impulses: [], news: [], spendPct: 0, memory: [], demand: null, cooldown: Math.max(0, (s.groupDemandCooldown || 0) - 1), resolution: null };
  const pend = s.groupDemand;
  if (pend) {
    const t = GROUP_DEMANDS[pend.group];
    const chosen = pend.options.find((o) => o.id === decisions.groupResponse);
    const opt = chosen || pend.options.find((o) => o.id === pend.defaultOption);
    const g = SOCIAL_GROUPS.find((x) => x.id === pend.group);
    out.spendPct += opt.spend || 0;
    if (opt.id === 'concede') {
      out.memory.push(...groupMemoryOf({ [pend.group]: 10 }, pend.title, 10));
      if (t.extra) out.impulses.push(...t.extra(difficulty, s));
    } else if (opt.id === 'promise') {
      out.memory.push(...groupMemoryOf({ [pend.group]: 5 }, `Обещание: ${t.concede.toLowerCase()}`, 4));
      out.memory.push(...groupMemoryOf({ [pend.group]: -8 }, `Обещание не выполнено: ${t.concede.toLowerCase()}`, 8).map((m) => ({ ...m, wait: 4 })));
    } else {
      out.memory.push(...groupMemoryOf({ [pend.group]: -7 }, `Отказ: ${pend.title.toLowerCase()}`, 8));
      out.impulses.push(makeImpulse('tensionPush', 1, `${g.name}: требование отклонено`, 'fast', difficulty, 'other'));
    }
    out.resolution = { group: pend.group, title: pend.title, option: opt.id, label: opt.label, byDefault: !chosen, q };
    out.news.push(['gov', `${g.name.toUpperCase()}: ${chosen ? opt.label.toUpperCase() : 'ОТВЕТА НЕ ДАЛИ'}`,
      `${pend.title}. ${chosen ? `Ответ власти: «${opt.label}».` : 'Ответа так и не последовало — это читается как отказ.'} ${opt.effect}`, 7]);
    out.cooldown = Math.max(out.cooldown, 3);
    return out;
  }
  if (out.cooldown > 0 || q < 4) return out;
  const sup = s.groupSupport || {};
  const worst = SOCIAL_GROUPS.filter((g) => Number.isFinite(sup[g.id]) && sup[g.id] < 42).sort((a, b) => sup[a.id] - sup[b.id])[0];
  if (!worst || rng() >= 0.45) return out;
  out.demand = publicGroupDemand(worst.id, s, q);
  out.news.push(['crisis', out.demand.title.toUpperCase(), `${worst.leader.name}, ${worst.leader.title}: ${out.demand.text} Ответ нужен в следующем квартале.`, 8]);
  return out;
}

const REGION_TEXT = {
  capital: {
    calm: (e) => `Аппарат работает штатно, рейтинг власти держится на ${Math.round(e.approval)} из 100 — столице нечего обсуждать сверх обычной повестки.`,
    tense: (e) => `Напряжённость в стране ${Math.round(e.politicalTension)} из 100 ощущается здесь острее всего — ближе всего к власти, ближе всего к недовольству ею.`,
    crisis: (e) => `Улицы Велеграда — первыми на очереди у любой перемены власти: рейтинг ${Math.round(e.approval)}, напряжённость ${Math.round(e.politicalTension)} из 100.`,
  },
  port: {
    calm: () => 'Погрузка идёт по графику, курс не пугает импортёров — обычный квартал для внешней торговли.',
    tense: (e) => `Курс ${fmt1(e.exchangeRate)} держит трейдеров в напряжении: контракты на следующий квартал подписывают с оговорками.`,
    crisis: (e) => `Резервы истрачены, курс ${fmt1(e.exchangeRate)} — импортные контракты замораживают, а не подписывают.`,
  },
  industry: {
    calm: () => 'Цеха загружены, заказы есть — обычный квартал для кузнецких заводов.',
    tense: (e) => `Безработица ${fmt1(e.unemployment)}% при норме ${fmt1(e.nairu)}% — часть цехов уже перешла на неполную неделю.`,
    crisis: (e) => `Заказы встали, безработица ${fmt1(e.unemployment)}% — не статистика, а очередь у проходной.`,
  },
  agri: {
    calm: () => 'Цены на урожай предсказуемы, кредит на посевную доступен — обычный квартал для приреченских хозяйств.',
    tense: (e) => `Инфляция ${fmt1(e.inflation)}% съедает выручку быстрее, чем успевает вырасти цена на зерно.`,
    crisis: (e) => `При инфляции ${fmt1(e.inflation)}% продавать урожай по контрактным ценам — значит себе в убыток; хозяйства придерживают запасы.`,
  },
  finance: {
    calm: () => 'Спреды узкие, кредит доступен — обычный квартал для златоградских банков.',
    tense: (e) => `Премия за риск ${fmt1(e.riskPremium)} п.п. — кредит дорожает быстрее, чем успевают пересчитать ставки по старым займам.`,
    crisis: (e) => `Премия за риск ${fmt1(e.riskPremium)} п.п. и банковский риск ${Math.round(e.bankingRisk)} из 100 — межбанк торгуется нервно, лимиты друг на друга урезаны.`,
  },
  mining: {
    calm: () => 'Добыча и энергогенерация идут ровным ходом — обычный квартал для рудногорских шахт.',
    tense: (e) => `Инфляция ${fmt1(e.inflation)}% при просевшем спросе — не лучшее время закладывать новую смену.`,
    crisis: () => 'Часть добывающих мощностей встала на консервацию — дешевле переждать, чем работать в убыток.',
  },
  periphery: {
    calm: () => 'Обычный квартал: ни ажиотажа, ни оттока — Боровская область этим и живёт.',
    tense: () => 'Отток молодёжи в Велеград ускоряется — там хотя бы платят вовремя.',
    crisis: (e) => `При напряжённости ${Math.round(e.politicalTension)} из 100 периферия голосует не бюллетенем, а переездом.`,
  },
};
function regionBlurb(region, economy) {
  const stress = regionStress(region, economy);
  const tier = stress >= 65 ? 'crisis' : stress >= 35 ? 'tense' : 'calm';
  const fn = (REGION_TEXT[region.id] || {})[tier];
  if (region.annex) return { stress, tier, text: annexBlurb(region, economy) };
  return { stress, tier, text: fn ? fn(economy) : '' };
}

/* Результат выборов по округам. Отдельной «региональной явки» движок не
   считает — доля голосов за действующую власть в округе выводится из уже
   посчитанного общенационального результата тремя понятными слагаемыми:
   структурная склонность округа (lean), то, насколько именно ему живётся
   хуже или лучше среднего по стране (regionStress), и поправка, которая
   возвращает среднее по округам ровно к национальному результату — иначе
   сумма по карте не сходилась бы с цифрой в новостях.

   Без rng(): один и тот же квартал всегда даёт одну и ту же карту.
   При сфальсифицированных выборах (авторитаризм/тоталитаризм) рисуется не
   этот расчёт, а «официальный результат» — почти ровный по всей стране,
   потому что рисуют его в одном кабинете, а не считают по участкам. */
function regionVoteShares(economy, nationalShare, rigged) {
  if (rigged) {
    // официальная цифра тем «единодушнее», чем жёстче режим
    const official = economy.politicalRegime === 'totalitarian' ? 91 : 78;
    return votingRegions(economy).map((r, i) => ({
      id: r.id,
      // разброс в пределах пары процентов — чтобы таблица не выглядела
      // напечатанной под копирку, но и не походила на настоящий подсчёт
      share: clamp(official + ((i % 3) - 1) * 1.4, 0, 100),
    }));
  }
  const regions = votingRegions(economy);
  const stresses = regions.map((r) => regionStress(r, economy));
  const avgStress = stresses.reduce((a, b) => a + b, 0) / (stresses.length || 1);
  // новая земля голосует ещё и по тому, насколько она уже своя
  // и по тому, кто в ней живёт: область рабочих голосует как рабочие
  const national = economy.groupSupport ? SOCIAL_GROUPS.reduce((a, g) => a + g.weight * (economy.groupSupport[g.id] ?? 50), 0) : 0;
  const raw = regions.map((r, i) => (r.lean || 0) + (avgStress - stresses[i]) * 0.35
    + (r.annex ? (annexLoyalty(economy, r.id) - 60) * 0.15 : 0)
    + (economy.groupSupport ? (regionGroupSupport(r.id, economy) - national) * 0.5 : 0));
  const mean = raw.reduce((a, b) => a + b, 0) / (raw.length || 1);
  return regions.map((r, i) => ({
    id: r.id,
    share: clamp(nationalShare + (raw[i] - mean), 0, 100),
  }));
}

/* «От редакции» под властью, которая контролирует прессу: не искажаем цифры, которые видит
   игрок (report остаётся точным и используется отдельно), а полностью пересобираем тон
   газетной колонки из тех же показателей — эвфемизмы вместо признаний, победные реляции
   вместо анализа. Во время войны пропаганда при тоталитаризме усиливается ещё сильнее. */
function propagandaEditorial(e) {
  const regime = e.politicalRegime;
  const war = (e.warQuartersLeft || 0) > 0;
  /* Свободная пресса о той же войне пишет иначе — и это и есть влияние режима на
     газету: не только шрифт и вёрстка, но и то, чей счёт она предъявляет. */
  if (regime !== 'authoritarian' && regime !== 'totalitarian') {
    if (!war || !e.warByChoice) return null;
    return {
      headline: 'ВОЙНА И ЭКОНОМИКА: СЧЁТ, КОТОРЫЙ ПРИДЁТ ПОЗЖЕ',
      text: `Рейтинг власти ${Math.round(e.approval)} из 100: сплочение вокруг флага работает первые кварталы и не работает дальше. Санкции уже видны в торговле и инвестициях, премия за риск ${fmt1(e.riskPremium)} п.п., капитал уходит. Редакция напоминает: потенциал экономики, из которого забрали людей и мощности, не возвращается вместе с прекращением огня.`,
    };
  }
  const totalitarian = regime === 'totalitarian';
  const growthLine = e.gdpGrowth >= 0
    ? `Рост экономики составил ${fmt1(e.gdpGrowth)}% — государство подтверждает верность выбранного курса.`
    : `Плановая перестройка экономики (формально ${fmt1(e.gdpGrowth)}%) — необходимый и временный этап на пути к устойчивому подъёму.`;
  const jobsLine = e.unemployment <= e.nairu + 1
    ? 'Занятость держится на исторически комфортном уровне.'
    : 'Трудовые резервы проходят оптимизацию в интересах государства — временные неудобства окупятся сторицей.';
  const pricesLine = e.inflation <= e.inflationTarget + 2
    ? 'Цены — под полным контролем компетентных ведомств.'
    : 'Отдельные колебания цен носят исключительно технический характер и не должны беспокоить граждан: обеспечение всем необходимым остаётся приоритетом номер один.';
  const debtLine = totalitarian
    ? (e.debtToGdp > 80 ? ' Финансовая система работает с полной отдачей, мобилизуя все доступные резервы.' : '')
    : '';
  const warLine = war && e.warByChoice
    ? (totalitarian
      ? ' Операция развивается по плану, и каждый её этап приближает неизбежную победу. Сомневающийся в успехе действует на руку противнику.'
      : ' Особые меры, введённые в связи с операцией, носят временный характер и будут сняты по мере достижения поставленных целей.')
    : war
    ? (totalitarian
      ? ' Все трудности — достойная цена, которую нация с гордостью платит за неизбежную победу над врагом. Тот, кто сомневается в успехе, действует на руку противнику.'
      : ' Особые меры военного времени объясняют часть текущих трудностей и постепенно снимаются по мере стабилизации обстановки.')
    : '';
  const closing = totalitarian
    ? ' Инакомыслие в такой момент — не мнение, а угроза единству нации; редакция напоминает читателям о бдительности.'
    : ' Правительство призывает сохранять спокойствие и доверие к принимаемым мерам.';
  const headline = totalitarian
    ? (war ? 'ЕДИНСТВО ПЕРЕД ЛИЦОМ ВРАГА: ЭКОНОМИКА РАБОТАЕТ НА ПОБЕДУ' : 'СТРАНА УВЕРЕННО ИДЁТ ВПЕРЁД')
    : 'ВЛАСТЬ ДЕРЖИТ КУРС: СТАБИЛЬНОСТЬ ПРЕВЫШЕ ВСЕГО';
  return { headline, text: `${growthLine} ${jobsLine} ${pricesLine}${debtLine}${warLine}${closing}` };
}

function buildReport({ prev, next, reasons }) {
  const p = [];
  p.push(`ВВП ${next.gdpGrowth >= 0 ? 'вырос' : 'сократился'} на ${fmt1(Math.abs(next.gdpGrowth))}% в годовом выражении при потенциальном росте ${fmt1(next.potentialGrowth)}%; разрыв выпуска ${fmtSigned1(next.outputGap)}%.`);
  p.push(`Инфляция ${next.inflation >= prev.inflation ? 'ускорилась' : 'замедлилась'} до ${fmt1(next.inflation)}% при ожиданиях ${fmt1(next.inflationExpectations)}%, безработица ${fmt1(next.unemployment)}% против естественного уровня ${fmt1(next.nairu)}%.`);
  p.push(`Бюджет: ${next.budgetBalancePctGdp >= 0 ? 'профицит' : 'дефицит'} ${fmt1(Math.abs(next.budgetBalancePctGdp))}% ВВП, долг ${fmt1(next.debtToGdp)}% ВВП, обслуживание забирает ${fmt1(next.interestToRevenue)}% доходов.`);
  p.push(`Ставка по кредитам ${fmt1(next.lendingRate)}% при нейтральной реальной ${fmt1(next.rStar)}%: денежные условия ${next.rateGap > 0.3 ? 'жёстче нейтральных' : next.rateGap < -0.3 ? 'мягче нейтральных' : 'близки к нейтральным'}, кредит ${fmtSigned1(next.creditGrowth)}%.`);
  if (next.creditCrunch) p.push('Капитал банков ограничивает выдачу кредитов — спрос на заёмные средства не удовлетворён.');
  if (Math.abs(next.inflationExpectations - prev.inflationExpectations) > 0.25) {
    p.push(`Инфляционные ожидания ${next.inflationExpectations > prev.inflationExpectations ? 'сдвинулись вверх' : 'опустились'} — доверие к ЦБ ${fmt1(next.cbCredibility)}. Чем ниже доверие, тем дороже обойдётся возврат инфляции к цели.`);
  }
  const top = reasons.gdpGrowth[0];
  if (top) p.push(`Главный фактор динамики выпуска: ${top.reasonText.charAt(0).toLowerCase()}${top.reasonText.slice(1)}.`);
  if (next.regime !== 'normal' && REGIME_INFO[next.regime]) p.push(`Режим экономики — ${regimeInfoLabel(REGIME_INFO[next.regime], next).toLowerCase()}. ${regimeInfoText(REGIME_INFO[next.regime], next)}`);
  return p.join(' ');
}

/* =========================================================================================
   ПОДСКАЗКИ ПО РЫЧАГАМ
========================================================================================= */
function leverPreview(id, newVal, s, difficulty) {
  const C = CONFIG.coef;
  const items = []; let pros = []; let cons = [];
  const uncertainty = UNCERTAINTY[id] || 'средняя';
  const lag = difficulty === 'easy' ? 'эффект в основном в следующем квартале' : difficulty === 'medium' ? 'эффект распределён на 2 квартала' : 'эффект распределён на 3 квартала';
  const add2 = (label, text) => items.push({ label, text });
  switch (id) {
    case 'keyRate': {
      const dv = newVal - s.keyRate;
      const newLend = s.lendingRate + dv * C.lendingPassthrough[difficulty];
      const newGap = (newLend - s.inflationExpectations) - (s.rStar + C.termPremium + C.bankSpreadBase);
      add2('Ставка по кредитам', `${fmt1(s.lendingRate)}% → ~${fmt1(newLend)}%`);
      add2('Разрыв к нейтральной', `${fmtSigned1(s.rateGap)} → ${fmtSigned1(newGap)} п.п.`);
      add2('Инвестиции', `${fmtSigned1(-dv * C.lendingPassthrough[difficulty] * C.invRate)}% к темпу`);
      add2('Кредит', `${fmtSigned1(-dv * C.lendingPassthrough[difficulty] * C.creditRateSens)}% к росту`);
      add2('Приток капитала / курс', `${fmtSigned1(dv * C.capitalFlowCarry)} млрд; валюта ${dv > 0 ? 'крепче' : 'слабее'}`);
      pros = dv > 0 ? ['охлаждение спроса и кредита', 'закрепление инфляционных ожиданий', 'приток капитала и крепкий курс']
        : ['дешёвый кредит и рост инвестиций', 'снижение стоимости обслуживания долга', 'поддержка занятости'];
      cons = dv > 0 ? ['падение инвестиций и рост безработицы', 'рост просрочки у банков и давление на их капитал', 'дороже новый госдолг']
        : ['разгон инфляции и риск срыва ожиданий', 'отток капитала и ослабление валюты', 'риск кредитного пузыря'];
      break;
    }
    case 'reserveReq': {
      const dv = newVal - s.reserveReq;
      add2('Кредитование', `${fmtSigned1(-dv * 0.5)}% к росту`);
      add2('Ликвидность банков', `${fmtSigned1(-dv * 1.2)} пункта`);
      add2('Ставка по кредитам', `${fmtSigned1(dv * 0.15)} п.п.`);
      pros = dv > 0 ? ['меньше риска кредитного бума', 'банки держат больше буфера'] : ['больше кредита экономике', 'выше ликвидность банков'];
      cons = dv > 0 ? ['кредит дороже и его меньше', 'давление на прибыль банков'] : ['рост кредитных рисков', 'ускорение денежной массы'];
      break;
    }
    case 'capitalRequirement': {
      const dv = newVal - s.capitalRequirement;
      const maxCredit = s.bankCapital / (Math.max(8, newVal) / 100 * CONFIG.target.riskWeight);
      add2('Предел кредитования', `${fmtMoney(maxCredit)} (сейчас выдано ${fmtMoney(s.creditVolume)})`);
      add2('Ставка по кредитам', `${fmtSigned1(dv * 0.1)} п.п.`);
      pros = dv > 0 ? ['банки устойчивее к кризису', 'гасится кредитный бум'] : ['кредит доступнее', 'быстрее выход из сжатия'];
      cons = dv > 0 ? ['риск кредитного сжатия прямо сейчас', 'ниже инвестиции'] : ['система хрупче при следующем шоке', 'кредитный пузырь вернётся просрочкой через годы'];
      break;
    }
    case 'moneySupplyOp': {
      add2('Инфляция', `${fmtSigned1(newVal * 0.14)} п.п. (с лагом)`);
      add2('Инвестиции', `${fmtSigned1(newVal * 0.35)}% к темпу`);
      add2('Доверие к ЦБ', newVal > 3 ? 'заметное снижение' : 'почти без изменений');
      pros = newVal > 0 ? ['быстрое смягчение условий', 'работает даже у нулевой ставки'] : ['изъятие избыточной ликвидности'];
      cons = newVal > 0 ? ['инфляция с лагом', 'риск потери доверия к ЦБ'] : ['удар по кредитованию'];
      break;
    }
    case 'fxIntervention': {
      // newVal — «млрд», диапазон растёт вместе с ВВП (см. scaleLever), поэтому в
      // курс это должно идти как доля ВВП — та же нормировка, что и в реальном расчёте.
      add2('Резервы', `${fmtMoneySigned(newVal)} за квартал (сейчас ${fmtMoney(s.reserves)})`);
      add2('Курс', `${fmtSigned1(newVal / Math.max(1, s.nominalGdp) * 100 * 2.5)}% к темпу изменения`);
      pros = newVal < 0 ? ['поддержка курса и подавление импортной инфляции'] : ['накопление резервов и слабая валюта помогает экспорту'];
      cons = newVal < 0 ? ['резервы конечны — при исчерпании режим срывается'] : ['импорт дорожает, инфляция растёт'];
      break;
    }
    case 'liquidity': {
      // та же нормировка по ВВП, что и в реальном расчёте bankLiquidity/financialStability —
      // иначе на разросшейся экономике превью показывало бы в разы больше, чем происходит на деле.
      const pctGdp = newVal / Math.max(1, s.nominalGdp) * 100;
      add2('Ликвидность банков', `${fmtSigned1(pctGdp * 18)} пункта`);
      add2('Финансовая стабильность', `${fmtSigned1(pctGdp * 5)} пункта`);
      pros = ['снижение риска банковской паники', 'поддержка кредитования'];
      cons = ['рост денежной массы', 'банки привыкают к поддержке'];
      break;
    }
    case 'bondIssuance': {
      const pctGdp = newVal / Math.max(1, s.nominalGdp) * 100;
      add2('Госдолг', `${fmtMoneySigned(newVal)} сразу (сейчас ${fmtMoney(s.govDebt)})`);
      add2('Резерв (суверенный фонд)', `${fmtMoneySigned(newVal)} сразу (сейчас ${fmtMoney(s.sovereignFund || 0)})`);
      add2('Премия за риск', `${fmtSigned1(pctGdp * 0.6)} п.п. — рынок читает лишний долг как сигнал`);
      pros = ['резерв на случай, если рынок вдруг откажет в финансировании дефицита', 'больше гособлигаций доступно инвесторам'];
      cons = ['долг растёт независимо от реальной потребности', 'крупное размещение стоит премии за риск'];
      break;
    }
    case 'govSpending': case 'transfers': case 'govInvestment': {
      const slack = clamp(-s.outputGap, 0, 6) / 6;
      const m = id === 'govSpending' ? C.multPurchases[0] + C.multPurchases[1] * slack
        : id === 'transfers' ? C.multTransfers[0] + C.multTransfers[1] * slack
          : C.multInvestment[0] + C.multInvestment[1] * slack;
      const shareX = (id === 'govSpending' ? s.govPurchasesReal : id === 'transfers' ? s.transfersReal : s.govInvestmentReal) / Math.max(1, s.gdp);
      const level = (id === 'govSpending' ? s.govPurchasesNominal : id === 'transfers' ? s.transfersNominal : s.govInvestmentNominal);
      add2('Мультипликатор сейчас', `${fmt2(m)} (${slack > 0.4 ? 'экономика ниже потенциала' : 'мало свободных мощностей'})`);
      add2('Вклад в ВВП', `${fmtSigned1(m * newVal * shareX)} п.п.`);
      add2('Стоимость', `${fmtMoneySigned(level * newVal / 100)} в год`);
      if (id === 'govInvestment') add2('Потенциальный ВВП', `инфраструктура ${fmtSigned1(newVal * 0.05)} пункта в квартал`);
      pros = id === 'govInvestment' ? ['единственный расход, повышающий потенциал', 'притягивает частные инвестиции']
        : id === 'transfers' ? ['быстрый эффект на потребление, особенно в кризис', 'рост доверия населения']
          : ['прямой вклад в спрос', 'поддержка занятости'];
      cons = id === 'transfers' ? ['почти нулевой долгосрочный эффект', 'постоянное обязательство бюджета']
        : ['рост дефицита и долга', 'при перегреве уходит в цены, а не в выпуск'];
      break;
    }
    case 'incomeTaxRate': case 'vatRate': case 'profitTaxRate': case 'exciseRate': case 'capitalTaxRate': case 'socialContribRate': {
      const cur = s[id];
      const dv = newVal - cur;
      const testDec = { incomeTaxRate: s.incomeTaxRate, profitTaxRate: s.profitTaxRate, vatRate: s.vatRate, exciseRate: s.exciseRate, capitalTaxRate: s.capitalTaxRate, socialContribRate: s.socialContribRate };
      const before = computeRevenue(s, testDec).total;
      const after = computeRevenue(s, { ...testDec, [id]: newVal }).total;
      const dRev = after - before;
      const mech = dv > 0 ? (dRev / Math.max(0.01, Math.abs(dv)) < before * 0.004 ? 'база сжимается почти так же быстро, как растёт ставка' : 'база держится') : 'база расширяется';
      add2('Доходы бюджета', `${fmtMoneySigned(dRev)} в год (${mech})`);
      add2('Собираемость', `уход в тень ${dv > 0 ? 'усилится' : 'ослабнет'} постепенно`);
      if (id === 'vatRate') add2('Инфляция', `${fmtSigned1(dv * C.vatPass)} п.п. сразу`);
      if (id === 'profitTaxRate') add2('Инвестиции', `${fmtSigned1(-dv * C.invProfitTax)}% к темпу`);
      if (id === 'capitalTaxRate') add2('Приток капитала', `${fmtMoneySigned(-dv * 6)}`);
      if (id === 'socialContribRate') add2('Рынок труда', `безработица ${fmtSigned1(dv * 0.045)} п.п., зарплаты ${fmtSigned1(-dv * C.wageSocial)}%`);
      pros = dv > 0 ? ['больше доходов бюджета в моменте', 'сокращение дефицита'] : ['рост частного спроса', 'расширение налоговой базы в будущем'];
      cons = dv > 0 ? ['сжатие базы и рост теневой экономики', 'удар по спросу или инвестициям'] : ['выпадение доходов бюджета сейчас', 'рост дефицита и долга'];
      break;
    }
    case 'shareHealth': case 'shareEducation': case 'shareScience': case 'shareDefense': case 'shareAdmin': {
      const key = id === 'shareHealth' ? 'health' : id === 'shareEducation' ? 'education' : id === 'shareScience' ? 'science' : id === 'shareDefense' ? 'defense' : 'admin';
      const dv = newVal - s.budgetShares[key];
      add2('Расходы по статье', `${fmtMoneySigned(s.govPurchasesNominal * dv / 100)} в год`);
      if (key === 'education' || key === 'health') add2('Человеческий капитал', `цель ${fmtSigned1(dv / 100 * s.govPurchasesReal / Math.max(1, s.gdp) * 100 * 7)} пункта (годы)`);
      if (key === 'science') add2('Рост производительности', `${fmtSigned1(dv / 100 * s.govPurchasesReal / Math.max(1, s.gdp) * 100 * 0.45)} п.п. в год`);
      pros = key === 'science' ? ['главный источник долгосрочного роста потенциала']
        : key === 'education' || key === 'health' ? ['человеческий капитал повышает потенциальный ВВП'] : ['перераспределение внутри бюджета без роста дефицита'];
      cons = ['эффект проявляется через годы, а не кварталы', 'ресурс отнимается у других статей'];
      break;
    }
    default: break;
  }
  return { items, pros, cons, uncertainty, delayNote: lag };
}

export {
  CONFIG, ROLES, DIFFICULTIES, GOALS, SCENARIOS, FX_REGIMES, LEVERS, UNCERTAINTY,
  CB_PERSONAS, MOF_PERSONAS, REQUESTS, EVENTS, CHANNEL_HEADLINE, TAX_REF,
  STOCK_NORM, TFP_SCALE, STORY_TEMPLATES, REGIME_INFO, CRISIS_INFO, MANDATE_LABEL, regimeInfoText, regimeInfoLabel,
  POLITICAL_REGIME_INFO, propagandaEditorial, gameChronicle, MAP_REGIONS, regionStress, regionBlurb, regionVoteShares, REGION_PROJECTS, REGION_EVENTS, projectBlocker, projectSpendPct, warFrontRegion, defaultWarOrder, WAR_OBJECTIVES, WAR_STANCES, warObjectiveOpen, warStrength, botWarOrder, ANNEX_EFFECT, CAMPAIGN_POINTS, CAMPAIGN_COST, POLL_WINDOW, electionForecast, sanitizeCampaignPlan, botCampaignPlan, swingLabel,
  ANNEX_REGIONS, ALL_REGIONS, regionById, activeRegions, votingRegions, annexLoyalty, sanitizeIntegration,
  PARTISAN_BELOW, INTEGRATED_AT, INTEGRATION_COST, INTEGRATION_DONE,
  SOCIAL_GROUPS, publicGroupDemand, ACTION_GROUP_EFFECTS, BOT_CORE_GROUPS, leverGroupEffects, groupStatus, coalitionOf, groupTurnoutShift, regionGroupSupport,
  sanitizeTreaty, treatyCost, botTreaty,
  WAR_TARGETS, warTargetOf, warObjectivesFor, warTargetAvailable, defaultWarTarget, sanitizeWarTarget,
  NEIGHBOR_IDS, RELATIONS_START, DIPLO_ACTIONS, NEIGHBOR_EVENTS, relationsOf, relationTarget, relationEffects, deshtWarMultiplier, diploActionAvailable,
  ultimatumChance, neighborEventView, botDiplomacy, sanitizeDiplomacy, diplomacyStep, atWarWith, DEFENSE_STANCES, REVANCHE_WARN, revancheGrowth, defaultDefenseOrder, botDefenseOrder,
  DEF_FRONT, DEF_ENEMY, defaultFrontOrder, botFrontOrder,
  QUARTERS_PER_YEAR,
  uid, clamp, annualToQuarterlyFactor, applyAnnualGrowth, annualizedGrowth, applyNominalGrowth,
  gauss, sign, ema,
  fmt1, fmt2, fmtSigned1, pctFmt, fmtSignedPct, fmtMoney, fmtMoneySigned, fmtIndex, mlnScale, fmtMln, fmtMlnSigned, romanQ, quarterLabel,
  ru, rf1, rf2, rfs,
  defaultDecisions, getCbPersona, personaAfterElection, getMofPersona, roundTo,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction, redescribeMofAction,
  describeHumanCbAction, describeHumanMofAction,
  PROMISE_POOL, pickPromises, evaluatePromise, PRESS_QUESTIONS, pickPressQuestion, pressSpeakerSeat, PRESS_OPTION_IDS,
  PRESIDENT_ACTIONS, PRES_BY_ID, PRES_GROUP_LABEL, REFORM_RAMP, reformShare, reformEffects,
  presActionAvailable, applyPresidentActions, politicalCapitalRegen, parliamentBlocksReform,
  PRESIDENT_PERSONAS, getPresPersona, botPresident, presidentSatisfactionNext, militaryCoupRisk,
  directiveProgress, directiveVerdict, DIRECTIVE_FULL, DIRECTIVE_PART,
  processPresidentialDirective, PRES_DIRECTIVE_COST, askText, reqAmount, appointmentEffects, APPOINT_COST, CB_FULL_TERM,
  headlineFor, spreadOf, makeImpulse, pickEvent, buildEventImpulses, tickImpulses,
  complianceFor, taxBases, computeRevenue, taxWedge, potentialFrom, computeScores,
  simulateQuarter,
  mkNews, advanceStories, storyTriggers, generateNews, buildDecisionImpulses,
  makeInitialEconomy, buildReport, leverPreview,
};
