import { clamp, ROLES, quarterLabel, CONFIG, romanQ, POLITICAL_REGIME_INFO, GOALS, DIFFICULTIES, SCENARIOS, PRESIDENT_PERSONAS, MOF_PERSONAS, CB_PERSONAS, rng } from './catalog.js';
import { gameChronicle } from './content/chronicle.js';
import { CHANNEL_HEADLINE, EVENTS, buildEventImpulses, headlineFor, makeImpulse, pickEvent, spreadOf, sustainedImpulse, tickImpulses } from './content/events.js';
import { STORY_TEMPLATES, advanceStories, buildDecisionImpulses, bumpNewsId, generateNews, mkNews, rf1, rf2, rfs, ru, storyConflicts, storyStartWait, storyTriggers } from './content/news.js';
import { PRESS_OPTION_IDS, PRESS_QUESTIONS, pickPressQuestion, pressSpeakerSeat } from './content/press.js';
import { QUINTILES, distributionStep, giniOf, groupRealIncome, initialDistribution } from './model/distribution.js';
import { STOCK_NORM, TAX_REF, TFP_SCALE, complianceFor, computeRevenue, computeScores, potentialFrom, taxBases, taxWedge } from './model/fiscal.js';
import { CAMPAIGN_COST, CAMPAIGN_POINTS, POLL_WINDOW, PROMISE_POOL, botCampaignPlan, campaignBonus, campaignStep, electionForecast, evaluatePromise, pickPromises, sanitizeCampaignPlan, swingLabel } from './politics/elections.js';
import { ACTION_GROUP_EFFECTS, SOCIAL_GROUPS, buildReport, coalitionOf, groupDemandStep, groupEpisodes, groupMemoryOf, groupStatus, groupStep, groupTurnoutShift, leverGroupEffects, propagandaEditorial, publicGroupDemand, regionBlurb, regionGroupSupport, regionVoteShares } from './politics/groups.js';
import { APPOINT_COST, BOT_CORE_GROUPS, CB_FULL_TERM, DIRECTIVE_FULL, DIRECTIVE_PART, PRESIDENT_ACTIONS, PRES_BY_ID, PRES_DIRECTIVE_COST, PRES_GROUP_LABEL, REFORM_RAMP, applyPresidentActions, appointmentEffects, botPresident, directiveProgress, directiveVerdict, getPresPersona, militaryCoupRisk, parliamentBlocksReform, politicalCapitalRegen, presActionAvailable, presidentSatisfactionNext, processPresidentialDirective, reformEffects, reformShare } from './politics/president.js';
import { REQUESTS, TAX_DEMAND_CAP, TAX_KEYS, askText, processRequest, reqAmount, taxSum } from './politics/requests.js';
import { DIPLO_ACTIONS, NEIGHBOR_EVENTS, NEIGHBOR_IDS, RELATIONS_START, atWarWith, botDiplomacy, deshtAttackRoll, deshtWarMultiplier, diploActionAvailable, diplomacyStep, neighborEventView, peaceStep, relationEffects, relationTarget, relationsOf, sanitizeDiplomacy, ultimatumChance } from './world/diplomacy.js';
import { ALL_REGIONS, ANNEX_REGIONS, ANNEX_REGION_OF, INTEGRATED_AT, INTEGRATION_COST, MAP_REGIONS, PARTISAN_BELOW, PROJECT_BY_ID, REGION_EVENTS, REGION_EVENT_BY_ID, REGION_PROJECTS, activeRegions, annexLoyalty, botRegionPlan, projectBlocker, projectSpendPct, regionById, regionStep, regionStress, votingRegions, warFrontRegion } from './world/regions.js';
import { ANNEX_EFFECT, DEFENSE_STANCES, DEF_ENEMY, DEF_FRONT, INTEGRATION_DONE, OBJECTIVE_VALUE, REVANCHE_WARN, WAR_OBJECTIVES, WAR_OBJECTIVE_BY_ID, WAR_STANCES, WAR_TARGETS, annexStep, botDefenseOrder, botFrontOrder, botTreaty, botWarOrder, defaultDefenseOrder, defaultFrontOrder, defaultWarOrder, defaultWarTarget, defenseStep, dropAnnexed, newDefenseCampaign, newWarCampaign, revancheGrowth, revancheStep, sanitizeIntegration, sanitizeTreaty, sanitizeWarTarget, treatyCost, warCampaignStep, warObjectiveOpen, warObjectivesFor, warStrength, warTargetAvailable, warTargetOf } from './world/war.js';

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
export const clampToLeverRange = (id, v) => clamp(v, LEVER_BY_ID[id].min, LEVER_BY_ID[id].max);

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
export function keyRateCap(e) {
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

  // обещание не повышать налоги (taxCommit) держит каждую ставку не выше обещанной
  const caps = s.taxCommit && s.taxCommit.caps;
  if (caps) {
    const cap = (v, k) => (Number.isFinite(caps[k]) ? Math.min(v, caps[k]) : v);
    incomeTaxRate = cap(incomeTaxRate, 'incomeTaxRate'); vatRate = cap(vatRate, 'vatRate'); profitTaxRate = cap(profitTaxRate, 'profitTaxRate');
    capitalTaxRate = cap(capitalTaxRate, 'capitalTaxRate'); socialContribRate = cap(socialContribRate, 'socialContribRate'); exciseRate = cap(exciseRate, 'exciseRate');
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
   ГЛАВНАЯ ФУНКЦИЯ КВАРТАЛА
========================================================================================= */
/* Шаги квартала, которые можно выключить (opts.skip или флаг партии):
   • 'war'    — война заморожена: ни нападений соседей, ни военного события в лотерее,
                ни указов о войне; режим «Только экономика» (economy.economyOnly);
   • 'events' — без случайных потрясений (то же, что noEvents): уроки и предыстория.
   Остальная модель — ставка, кредит, предложение, бюджет, спрос, труд, цены, курс,
   банки, политика — считается всегда. */
const SKIPPABLE_STEPS = ['war', 'events'];
function simulateQuarter(input, { skip = [] } = {}) {
  const { economy, decisions: rawDecisions0, pendingImpulses, eventCooldowns, difficulty, quarterIndex, stories, botAction, botActions, publicMode } = input;
  const noEvents = !!input.noEvents || skip.includes('events');
  const noWar = skip.includes('war') || !!economy.economyOnly;
  // войну не удалили — заморозили: указы группы «Война» в этом режиме не проходят
  const rawDecisions = noWar
    ? { ...rawDecisions0, presidentActions: (rawDecisions0.presidentActions || []).filter((id) => !(PRES_BY_ID[id] && PRES_BY_ID[id].group === 'war')), warTarget: null }
    : rawDecisions0;
  const s = economy;
  /* Каждый серверлесс-вызов может начинаться с чистого счётчика __newsId (новый
     процесс — новый модуль), а клиент копит все новости за партию в одном
     массиве. Без квартальной привязки id новостей из разных кварталов рано или
     поздно совпадали бы («n1» квартала 1 и «n1» квартала 9), и React путал эти
     записи по key — старая новость «залипала» на месте новой при перерисовке.
     Значение с запасом (кварталов не бывает тысячи, новостей за квартал —
     тем более) гарантирует уникальность в пределах одной партии независимо от
     того, сколько раз счётчик успел обнулиться. */
  bumpNewsId((quarterIndex || 0) * 1000 + 1);
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
  const deshtAttack = !noEvents && !noWar && deshtAttackRoll(s);
  if (noWar) cooldowns.war = Math.max(cooldowns.war || 0, 99); // военное событие не выпадет в лотерее
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
  /* Налоговое обещание: снижение налогов по просьбе (decisions.taxPledge) держится
     полтора года — бот-Минфин не поднимает ставки выше достигнутых. Если Минфин
     сам снижает дальше, обещанный потолок опускается вместе с ним. */
  const prevTax = s.taxCommit || null;
  const taxNow = Object.fromEntries(TAX_KEYS.map((k) => [k, decisions[k]]));
  const taxCommit = decisions.taxPledge && taxSum(decisions) < taxSum(s) - 0.25
    ? { caps: taxNow, left: 6 }
    : prevTax && prevTax.left > 1
      ? { caps: Object.fromEntries(TAX_KEYS.map((k) => [k, Math.min(prevTax.caps[k] ?? 99, decisions[k] ?? 99)])), left: prevTax.left - 1 }
      : null;

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
  /* Распределение доходов по пяти квинтилям — надстройка над посчитанным кварталом
     (см. model/distribution.js): личная инфляция, налоговая нагрузка, реальные доходы,
     Джини. Соцгруппы смотрят на доходы «своего» слоя. */
  const DIST = distributionStep(s.distribution, {
    wageGrowth, unemployment, prevUnemployment: s.unemployment, transfersRealGrowth: actualGrowthTr, inflation, coreInflation,
    gdpGrowth, stockGrowth: stockReturn, keyRate: decisions.keyRate, vatRate: decisions.vatRate,
    incomeTaxRate: decisions.incomeTaxRate, capitalTaxRate: decisions.capitalTaxRate,
  });
  const GS = groupStep(s, {
    distribution: DIST,
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
  if (decisions.incomeTaxRate > TAX_DEMAND_CAP.incomeTaxRate || decisions.vatRate > TAX_DEMAND_CAP.vatRate) {
    // называем, что именно давит и до какого уровня снизить — иначе требование не выполнить
    const over = [decisions.incomeTaxRate > TAX_DEMAND_CAP.incomeTaxRate && `подоходный ${rf1(decisions.incomeTaxRate)}% (терпимо до ${TAX_DEMAND_CAP.incomeTaxRate}%)`,
      decisions.vatRate > TAX_DEMAND_CAP.vatRate && `НДС ${rf1(decisions.vatRate)}% (терпимо до ${TAX_DEMAND_CAP.vatRate}%)`].filter(Boolean).join(', ');
    demandCandidates.push({ id: 'tax_cut', actor: 'Население', text: `Налоговая нагрузка невыносима — требуют снижения налогов: ${over}.` });
  }
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
    // настройка партии «Только экономика» живёт в состоянии и переходит из квартала в квартал
    ...(s.economyOnly ? { economyOnly: true } : {}),
    distribution: DIST, gini: DIST.gini, povertyRate: DIST.povertyRate,
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
    govDebt, debtToGdp, effectiveDebtRate, budgetShares, defenseCommit, taxCommit, sovereignFund, fundPctGdp, netDebtToGdp, fundIncome,
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
   НАЧАЛЬНОЕ СОСТОЯНИЕ
========================================================================================= */
function makeInitialEconomy(scenarioId) {
  const scenario = SCENARIOS.find((sc) => sc.id === scenarioId);
  const I = { ...CONFIG.initial, ...(scenario && scenario.overrides) };
  const potentialGdp = potentialFrom(I.capitalStock, I.laborForce, I.nairu, I.humanCapitalIndex, I.productivity, I.infrastructureIndex, TFP_SCALE, 0);
  const nominalGdp = I.gdp * I.priceLevel / 100;
  const dist0 = initialDistribution();
  const base = {
    ...I,
    distribution: dist0, gini: dist0.gini, povertyRate: dist0.povertyRate,
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
  simulateQuarter, SKIPPABLE_STEPS, QUINTILES, giniOf, groupRealIncome,
  mkNews, advanceStories, storyTriggers, generateNews, buildDecisionImpulses,
  makeInitialEconomy, buildReport, leverPreview,
};
