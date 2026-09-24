/* Справочники игры: константы модели, роли, цели, сложность, сценарии, режимы и
   характеры ботов. Вынесены из движка в отдельный маленький модуль, чтобы главное
   меню и экран новой партии не тянули за собой весь движок экономики — он
   загружается отдельно, когда партия начинается. Движок импортирует их отсюда
   и экспортирует дальше как прежде. */
/* =========================================================================================
   ЯДРО МОДЕЛИ Inflatia — чистые функции, без React и DOM.
   Единственный источник истины: импортируется и клиентом (src/MacroSimulator.jsx, для
   соло-игры), и сервером (api/_lib/engine.js, для мультиплеера). Не дублировать — иначе
   у игроков разойдутся случайные шоки и результаты кварталов.
========================================================================================= */
export const CONFIG = {
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
  shares: { wageBill: 0.47, profits: 0.21, capitalIncome: 0.055, nonTaxRevenue: 0.075 },
  initial: {
    gdp: 2000, priceLevel: 100,
    consumption: 1155, businessInvestment: 380, govPurchasesReal: 405, govInvestmentReal: 60,
    exports: 480, imports: 480, transfersReal: 175,
    capitalStock: 6000, laborForce: 100,
    unemployment: 5.0, nairu: 5.0, wageGrowth: 6.3,
    productivity: 100, humanCapitalIndex: 100, infrastructureIndex: 100,
    inflation: 4.0, coreInflation: 4.0, inflationExpectations: 4.0, cbCredibility: 60,
    keyRate: 5.5, reserveReq: 6.0, capitalRequirement: 10.5, fxRegime: 'free',
    lendingRate: 7.92, depositRate: 4.3, rStar: 1.55, riskPremium: 1.4,
    moneySupply: 100, exchangeRate: 100, realExchangeRate: 100,
    inflationTarget: 4.0, fxTarget: 100,
    incomeTaxRate: 15, profitTaxRate: 20, vatRate: 18, exciseRate: 8, capitalTaxRate: 13, socialContribRate: 22,
    shadowShare: 14,
    budgetShares: { health: 19, education: 16, science: 4, defense: 15, admin: 12, other: 34 },
    govDebt: 1200, effectiveDebtRate: 6.5, sovereignFund: 0,
    creditVolume: 1400, bankCapital: 147, bankNPL: 3.0, bankLiquidity: 70,
    reserves: 300, fdi: 40,
    consumerConfidence: 55, businessConfidence: 55, financialStability: 70, govTrust: 55,
    approval: 55, quartersToElection: 16, term: 1, mandate: null, governmentLine: 'centrist',
    politicalRegime: 'democracy', politicalTension: 8, parliamentDissolved: false, unrestQuartersLeft: 0,
    politicalCapital: 55, cbTenure: 0, mofTenure: 0, presidentSatisfaction: 60,
    worldGdpGrowth: 2.5, worldInflation: 3.0, worldRate: 3.0, commodityIndex: 100, worldDemandIndex: 100,
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
    consInertia: 0.30, consIncome: 0.55, consRate: 0.30, consConf: 0.22, consCredit: 0.55,
    invInertia: 0.28, invAccelerator: 0.42, invRate: 1.25, invConf: 0.35, invCredit: 0.75,
    invCrowdIn: 0.35, invProfitTax: 0.45,
    capacityDrag: 0.30,
    // внешний сектор
    exportWorld: 0.55, exportRer: 0.09, importIncome: 0.95, importRer: 0.07,
    // труд
    okun: 0.45, uAdjust: 0.34, nairuHysteresis: 0.020,
    wageTightness: 0.80, wageExpect: 1.0, wageSocial: 0.30,
    // цены
    phillipsLinear: 0.15, phillipsConvex: 0.022,
    ulcPass: 0.28, fxPass: 0.085, commodityPass: 0.012, worldInflPass: 0.10, vatPass: 0.35,
    expAdaptMin: 0.16, expAdaptMax: 0.42,
    // банки
    nplRate: 0.55, nplUnemp: 0.35, nplGap: 0.40, nplCreditBoom: 0.75, nplAdjust: 0.20,
    // бюджет
    multPurchases: [0.55, 0.60], multTransfers: [0.30, 0.50], multInvestment: [0.60, 0.55], multTax: [0.45, 0.40],
    // платёжный баланс
    capitalFlowCarry: 11.0, capitalFlowConf: 0.9, capitalFlowStab: 0.55,
    fxBop: 1.25, fxCarry: 0.30,
    // долг
    debtRollover: 0.12, debtLevelPremium: 0.035,
  },
  noiseBase: {
    consumption: 0.30, investment: 0.70, exports: 0.70, imports: 0.70,
    inflation: 0.22, exchangeRate: 0.9, financialStability: 1.0,
    consumerConfidence: 1.1, businessConfidence: 1.1, reserves: 3, fdi: 4,
    unemployment: 0.07, wageGrowth: 0.16, bankNPL: 0.09, productivity: 0.05,
    worldGdpGrowth: 0.20, worldInflation: 0.15, worldRate: 0.10, commodityIndex: 2.0, worldDemandIndex: 1.2,
    capitalFlow: 5.0,
  },
  noiseMult: { easy: 0.55, medium: 1.0, hard: 1.55 },
  lagSpread: { easy: [1], medium: [0.55, 0.45], hard: [0.3, 0.4, 0.3] },
  slowSpread: { easy: [0.4, 0.6], medium: [0.25, 0.4, 0.35], hard: [0.15, 0.3, 0.35, 0.2] },
  eventProbability: { easy: 0.09, medium: 0.14, hard: 0.20 },
  election: { cycle: 16, campaign: 3 },
  thresholds: {
    bankingRisk: 70, debtRisk: 75, recessionGapQuarters: 2, recessionGap: -2.0, recessionGapExit: -0.8,
    overheatGap: 3.5, stagflationInflation: 6.5, stagflationGap: -1.0,
    currencyMovePct: 11, deflation: 0.5, carCrunch: 10.5,
  },
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const romanQ = (n) => ['I', 'II', 'III', 'IV'][n - 1] || String(n);

export const quarterLabel = (qIndex) => {
  const year = CONFIG.startYear + Math.floor((qIndex - 1) / 4);
  const q = ((qIndex - 1) % 4) + 1;
  return `${romanQ(q)} кв. ${year}`;
};

/* ============================ РОЛИ, ЦЕЛИ, РЫЧАГИ ============================ */
export const ROLES = [
  { id: 'central_bank', icon: 'landmark', title: 'Глава Центрального банка', short: 'Центральный банк',
    desc: 'Ставка, норматив капитала банков, ликвидность, курс. Бюджетом управляет бот-Минфин.',
    groups: ['monetary'], botRole: 'ministry_finance' },
  { id: 'ministry_finance', icon: 'coins', title: 'Глава Министерства финансов', short: 'Минфин',
    desc: 'Налоги, расходы, выплаты и госинвестиции. Ставкой управляет бот-Центробанк.',
    groups: ['fiscal'], botRole: 'central_bank' },
  { id: 'full_control', icon: 'globe', title: 'Премьер-министр', short: 'Премьер',
    desc: 'Оба кабинета в одних руках: и ставка, и бюджет. Ботов нет — и оправдываться не на кого.',
    groups: ['monetary', 'fiscal'], botRole: null },
  /* Президент — не «глава государства» из старой роли: он не двигает ни одного
     ползунка. ЦБ и Минфин здесь два бота, а власть проявляется через людей,
     указания и реформы — политический капитал вместо процентных пунктов. */
  { id: 'president', icon: 'crown', title: 'Президент', short: 'Президент',
    desc: 'Ни ставки, ни бюджета: ими заняты два бота — ЦБ и Минфин. У вас другие рычаги — кадры, указания ведомствам, структурные реформы и публичная политика. Ресурс один: политический капитал.',
    groups: [], botRole: 'both' },
  { id: 'trader', icon: 'chart', title: 'Частный инвестор', short: 'Трейдер',
    desc: 'Вы не управляете экономикой — вы живёте в ней. Ставку ведёт бот-ЦБ, бюджет бот-Минфин, а вы распределяете капитал между активами и отвечаете за результат.',
    groups: [], botRole: 'both' },
  /* Предприниматель — отдельная игра «Своё дело» (тайкун в реальном времени,
     src/tycoon.jsx): страна живёт фоном, игрок строит производственные цепочки. */
  { id: 'entrepreneur', icon: 'factory', title: 'Предприниматель', short: 'Своё дело',
    desc: 'Другая игра — в реальном времени: фермы, заводы, магазины и экспорт по всей стране, склад, рынок, исследования. Страна живёт сама — ставка, кризисы и выборы бьют по вашему бизнесу.',
    groups: [], botRole: 'both' },
];

/* Старты предпринимателя (тайкун «Своё дело»): с чего начинается компания. Ключи
   factory/retail остались от первой версии роли, где это были отрасли компании. */
export const SECTORS = [
  { id: 'farm', title: 'Ферма', short: 'Поля и мельница',
    desc: 'Две фермы и мельница в Приреченской области. Мука уходит перекупщикам — дёшево, но надёжно. Дальше свой хлеб и свои магазины.' },
  { id: 'retail', title: 'Лавка', short: 'Хлебозавод и магазин в столице',
    desc: 'Сразу продаёте людям, и это выгодно, — но муку покупаете на рынке втридорога. Своё сырьё сделает хлеб вдвое прибыльнее.' },
  { id: 'factory', title: 'Лесопилка', short: 'Лес и доски',
    desc: 'Лесозаготовки и лесопилка в Боровской области. Доски дешёвые, мебель — дорогая: путь к ней лежит через исследования.' },
]

export const DIFFICULTIES = [
  { id: 'easy', title: 'Лёгкий', desc: 'Быстрая трансмиссия, мягкие шоки, терпеливые ожидания.' },
  { id: 'medium', title: 'Средний', desc: 'Реалистичные лаги: решение действует 2–3 квартала.' },
  { id: 'hard', title: 'Сложный', desc: 'Длинные лаги, срыв ожиданий, банковские и долговые спирали.' },
];

export const GOALS = [
  { id: 'max_growth', label: 'Максимальный рост ВВП', score: 'potential' },
  { id: 'min_inflation', label: 'Минимальная инфляция', score: 'stability' },
  { id: 'min_unemployment', label: 'Минимальная безработица', score: 'welfare' },
  { id: 'debt_reduction', label: 'Снижение государственного долга', score: 'fiscal' },
  { id: 'stable_currency', label: 'Стабильный курс валюты', score: 'financial' },
  { id: 'living_standards', label: 'Повышение уровня жизни', score: 'welfare' },
  { id: 'balanced_budget', label: 'Сбалансированный бюджет', score: 'fiscal' },
  { id: 'max_wealth', label: 'Приумножить капитал', score: 'financial', trader: true },
  { id: 'beat_index', label: 'Обогнать индекс акций', score: 'financial', trader: true },
  { id: 'beat_inflation', label: 'Сохранить покупательную способность', score: 'financial', trader: true },
  { id: 'survive', label: 'Пройти цикл без маржин-колла', score: 'financial', trader: true },
  { id: 'company_value', label: 'Приумножить состояние владельца', score: 'financial', entrepreneur: true },
  { id: 'market_share', label: 'Стать лидером рынка', score: 'potential', entrepreneur: true },
];

/* Сценарии — не отдельная песочница, а другая стартовая точка того же движка:
   переопределяют часть CONFIG.initial перед расчётом makeInitialEconomy, а не
   правят его — иначе baseline-сравнения в остальном коде (валютный порог
   резервов, доля потребления/инвестиций «как в нормальной экономике») сами
   поехали бы вместе со стартом и потеряли смысл как ориентир. */
/* Сложность сценария — не на глаз, а по отчёту о балансе (npm run balance --
   --scenarios): перебор 2592 двухфазных стратегий игрока (с МВФ и без), доля
   тех, что удерживают демократию четыре года. Открытая партия и ипотечный
   пузырь — 100%, валютный кризис — около 88%, гиперинфляция — около 7%.
   Ипотечный пузырь всё же «средний», а не «лёгкий»: демократия в нём цела,
   но выборы проиграть легко — пузырь лопается под урну. Валютный кризис —
   «трудный»: демократию удержать можно, но выборы в нём боты проигрывают в
   трёх партиях из четырёх, и одна ошибка первого года стоит мандата.
   level — от 1 до 4, levelNote объясняет цифру игроку. */
export const SCENARIOS = [
  { id: 'sandbox', title: 'Открытая партия', short: 'Песочница', level: 1, levelLabel: 'Лёгкий',
    levelNote: 'Без стартового кризиса: ошибки видны, но исправимы.',
    desc: 'Стабильная экономика без стартового кризиса — учиться или экспериментировать без давления времени.', overrides: null },
  { id: 'currency_crisis', title: 'Валютный кризис', short: 'Курс и резервы', level: 3, levelLabel: 'Трудный',
    levelNote: 'Демократию удержать можно, но выборы проиграть легко: ошибки первого года стоят мандата.',
    desc: 'Резервы уже наполовину истрачены, инфляция разогналась, ставка экстренно поднята — но доверие подорвано, и рынок ждёт девальвации.',
    overrides: { reserves: 60, inflation: 11, coreInflation: 9.5, inflationExpectations: 9, riskPremium: 3.4,
      keyRate: 15, lendingRate: 19, depositRate: 12, fxRegime: 'managed', cbCredibility: 32,
      consumerConfidence: 32, businessConfidence: 30, approval: 38, politicalTension: 28,
      // режим экономики на старте — тот, что движок присвоит после первого
      // квартала; иначе до первого хода баннер писал «Нормальный режим»
      regime: 'currency' } },
  { id: 'housing_bubble', title: 'Ипотечный пузырь', short: 'Банки и кредит', level: 2, levelLabel: 'Средний',
    levelNote: 'Институты выдержат, но выборы проиграть легко: пузырь лопается под урну.',
    desc: 'Кредитный бум уже случился: портфель раздут, просрочка растёт, капитал банков на исходе. Вопрос не в том, лопнет ли пузырь, а когда.',
    overrides: { creditVolume: 2100, bankCapital: 85, bankNPL: 8.5, bankLiquidity: 38, financialStability: 30,
      unemployment: 6.2, wageGrowth: 3.2, consumerConfidence: 40, businessConfidence: 38, approval: 45,
      regime: 'banking' } },
  { id: 'hyperinflation', title: 'Гиперинфляция', short: 'Доверие к деньгам', level: 4, levelLabel: 'Самый трудный',
    levelNote: 'Выигрывает примерно одна стратегия из пятнадцати, бездействие проигрывает всегда. Даже верная игра стоит глубокой рецессии.',
    desc: 'Цены разгоняются на глазах, доверие к цели по инфляции разрушено, долг уже дорогой. Выход один — стабилизационная программа: жёсткая ставка вместе с бюджетом без дыры, пока у правительства держится мандат спасения. Постепенностью эту спираль не остановить.',
    overrides: { inflation: 34, coreInflation: 30, inflationExpectations: 27, cbCredibility: 18, keyRate: 24,
      lendingRate: 30, depositRate: 22, govDebt: 1700, effectiveDebtRate: 13, riskPremium: 4.2,
      consumerConfidence: 25, businessConfidence: 28, approval: 33, politicalTension: 34,
      // при гиперинфляции номинальные зарплаты растут почти вровень с ценами
      // (индексация), отставая на несколько пунктов; со стартовыми 6,3% модель
      // считала, что реальные зарплаты падают на 28% в год при любой политике
      wageGrowth: 26,
      regime: 'currency',
      crisisMandateLeft: 6, crisisMandateTotal: 6 } },
];

/* =========================================================================================
   БОТЫ: ведомство, которым вы не управляете, ведёт собственную политику
========================================================================================= */
export const CB_PERSONAS = [
  { id: 'hawk', name: 'Ястреб', title: 'Бескомпромиссный инфляционный таргетёр',
    infl: 2.1, gap: 0.25, smooth: 0.70, maxMove: 1.75, tolerance: 0.7, fiscalLean: 0.35, macropru: 1.0,
    desc: 'Ставит цель по инфляции выше занятости. Жёстко реагирует на бюджетную экспансию.' },
  { id: 'pragmatic', name: 'Прагматик', title: 'Гибкое таргетирование инфляции',
    infl: 1.5, gap: 0.60, smooth: 0.74, maxMove: 1.25, tolerance: 1.2, fiscalLean: 0.20, macropru: 0.6,
    desc: 'Балансирует инфляцию и выпуск, сглаживает траекторию ставки.' },
  { id: 'dove', name: 'Голубь', title: 'Приоритет занятости и роста',
    infl: 1.05, gap: 1.00, smooth: 0.82, maxMove: 0.75, tolerance: 2.2, fiscalLean: 0.05, macropru: 0.3,
    desc: 'Терпит инфляцию ради роста. Рискует потерей доверия и срывом ожиданий.' },
];

export const MOF_PERSONAS = [
  { id: 'technocrat', name: 'Технократ', title: 'Бюджетное правило и инвестиции',
    anchor: -2.0, cyclical: 0.55, taxWill: 0.6, debtLimit: 75, transferBias: 0.8, investBias: 1.4,
    shares: { health: 19, education: 20, science: 7, defense: 13, admin: 10 },
    desc: 'Держит дефицит у правила, в кризис умеренно стимулирует, вкладывается в образование и науку.' },
  { id: 'austerity', name: 'Консерватор', title: 'Жёсткая бюджетная дисциплина',
    anchor: -0.5, cyclical: 0.22, taxWill: 0.3, debtLimit: 60, transferBias: 0.4, investBias: 0.6,
    shares: { health: 16, education: 13, science: 3, defense: 18, admin: 12 },
    desc: 'Сокращает дефицит любой ценой. Усиливает рецессии, зато долг под контролем.' },
  { id: 'populist', name: 'Популист', title: 'Социальные расходы прежде всего',
    anchor: -4.5, cyclical: 0.95, taxWill: 0.75, debtLimit: 105, transferBias: 2.2, investBias: 0.9,
    shares: { health: 24, education: 17, science: 2, defense: 14, admin: 13 },
    desc: 'Наращивает выплаты и расходы, налоги повышает на бизнес. Источник инфляции и долга.' },
];

/* ============================ ПРЕЗИДЕНТ КАК ТРЕТЬЕ ЛИЦО ============================
   За ЦБ и Минфин игрок и раньше имел дело с ботом соседнего ведомства. Президент —
   другой уровень: он ничего не считает сам, но может требовать, назначать и тратить
   политический капитал на то, до чего у ведомств руки не доходят. Работает он тем же
   кодом, что и роль президента (PRESIDENT_ACTIONS, processPresidentialDirective) —
   отличается только тем, что решения принимает характер, а не человек.

   Главное следствие для игрока: у требований президента есть последствия. Он не
   может отменить решение ЦБ, но может перестать терпеть его главу. */
export const PRESIDENT_PERSONAS = [
  { id: 'technocrat', name: 'Технократ', title: 'Не мешает ведомствам работать',
    pressure: 0.30, populism: -0.5, reform: 0.9, power: 0.05, patience: 1.35,
    desc: 'Вмешивается редко и по делу, вкладывается в структурные реформы, требований почти не выдвигает. Работать с ним спокойно — но и помощи ждать не стоит.' },
  { id: 'populist', name: 'Популист', title: 'Рейтинг важнее цифр',
    pressure: 0.85, populism: 1.0, reform: -0.35, power: 0.35, patience: 0.7,
    desc: 'Требует дешёвых денег и щедрого бюджета, реформы считает вредными для рейтинга. Отказ читает как личную нелояльность.' },
  { id: 'strongman', name: 'Силовик', title: 'Власть должна быть вертикальной',
    pressure: 0.90, populism: 0.25, reform: 0.15, power: 1.0, patience: 0.55,
    desc: 'Указания не обсуждаются. Легко идёт на роспуск парламента и разгон протеста — вместе с ними приходят премия за риск и отток капитала.' },
  { id: 'reformer', name: 'Реформатор', title: 'Считает на два срока вперёд',
    pressure: 0.40, populism: -0.4, reform: 1.0, power: -0.2, patience: 1.1,
    desc: 'Тратит капитал на реформы, даже когда они стоят рейтинга. Требовать будет дисциплины, а не щедрости.' },
];

export const POLITICAL_REGIME_INFO = {
  democracy: { label: 'Демократия', color: 'teal', text: 'Парламент работает, выборы решают исход, пресса независима.' },
  crisis: { label: 'Конфликт парламента и президента', color: 'gold', text: 'Взаимные вето и угроза импичмента парализуют принятие решений — институты ещё держатся, но компромисса всё меньше.' },
  authoritarian: { label: 'Авторитарный режим', color: 'rust', text: 'Парламент распущен или обессилен, выборы формальны, независимые голоса вытесняются.' },
  totalitarian: { label: 'Тоталитарный режим', color: 'rust', text: 'Полный государственный контроль над институтами и прессой; несогласие приравнено к угрозе государству.' },
};

/* =========================================================================================
   ВЫЗОВ ДНЯ: одна и та же партия для всех в течение суток
   Из даты (по Москве) выводится зерно, из зерна — пост, сценарий, сложность, цель и
   характеры ботов. Случайность движка на время вызова берётся из того же зерна, причём
   заново на каждый квартал (зерно + номер квартала): решения одного квартала не сдвигают
   жребий всех следующих, и шоки, выпавшие одному игроку, выпадут и другому.
========================================================================================= */
export const DAILY_QUARTERS = 12;
const MSK_OFFSET_MS = 3 * 3600 * 1000;

// сутки по Москве: вызов меняется в полночь для всех одновременно, а не по поясу устройства
export function dailyKey(date = new Date()) {
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

// FNV-1a: строку в 32-битное зерно
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// mulberry32 — короткий и достаточно ровный генератор для игровых бросков
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Источник случайности движка. По умолчанию это Math.random (через обёртку — чтобы
   тесты могли подменять Math.random как раньше), а на время вызова дня —
   генератор из зерна. Звук, конфетти и прочий интерфейс берут Math.random напрямую
   и жребий движка не сдвигают. */
let currentRandom = () => Math.random();
export const rng = () => currentRandom();
export function withSeededRandom(seed, fn) {
  const prev = currentRandom;
  currentRandom = mulberry32(seed);
  try { return fn(); } finally { currentRandom = prev; }
}

const DAILY_ROLES = ['central_bank', 'ministry_finance', 'president', 'full_control'];
export function dailyChallenge(day = dailyKey()) {
  const seed = hashSeed(`ems-daily:${day}`);
  const r = mulberry32(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  // пост идёт по кругу, чтобы четыре дня подряд не выпал один и тот же
  const dayNum = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  const role = DAILY_ROLES[((dayNum % DAILY_ROLES.length) + DAILY_ROLES.length) % DAILY_ROLES.length];
  // чаще всего — кризис: ради него и собираются сравнить, кто справился лучше
  const scenario = r() < 0.25 ? 'sandbox' : pick(SCENARIOS.filter((s) => s.id !== 'sandbox')).id;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const difficulty = weekday === 0 || weekday === 6 ? 'hard' : 'medium';
  const goal = pick(GOALS.filter((g) => !g.trader && !g.entrepreneur)).id;
  return {
    day, seed, role, scenario, difficulty, goal, quarters: DAILY_QUARTERS,
    cbPersona: pick(CB_PERSONAS).id,
    mofPersona: pick(MOF_PERSONAS).id,
    presPersona: pick(PRESIDENT_PERSONAS).id,
  };
}

// setup партии в том же виде, что собирает экран новой партии
export function dailySetup(ch) {
  return {
    role: ch.role, difficulty: ch.difficulty, goal: ch.goal, scenario: ch.scenario,
    cbPersona: ch.cbPersona, mofPersona: ch.mofPersona,
    president: { enabled: ch.role === 'central_bank' || ch.role === 'ministry_finance', persona: ch.presPersona },
    daily: { day: ch.day, seed: ch.seed, quarters: ch.quarters },
  };
}

export const DAILY_SCORE_KEYS = ['stability', 'welfare', 'financial', 'fiscal', 'potential'];
/* Итог вызова — среднее пяти оценок политики, где оценка по цели дня считается
   дважды. Поражение до срока обрывает партию и делит итог пополам: дотянуть до
   конца с посредственными цифрами лучше, чем блестяще рухнуть. */
export function dailyScore(economy, goalId, defeated) {
  const goal = GOALS.find((g) => g.id === goalId);
  const val = (k) => clamp(Number(economy[`score${k.charAt(0).toUpperCase()}${k.slice(1)}`]) || 0, 0, 100);
  let sum = 0; let w = 0;
  DAILY_SCORE_KEYS.forEach((k) => { const ww = goal && goal.score === k ? 2 : 1; sum += val(k) * ww; w += ww; });
  const raw = sum / w;
  return Math.round((defeated ? raw * 0.5 : raw) * 10) / 10;
}
