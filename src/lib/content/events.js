/* Выделено из engine.js: content/events.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG, clamp, rng } from '../catalog.js';
import { uid } from '../engine.js';
import { deshtWarMultiplier } from '../world/diplomacy.js';

/* =========================================================================================
   СОБЫТИЯ. kind: demand | supply | financial | external | structural
========================================================================================= */
export const EVENTS = [
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

export const CHANNEL_HEADLINE = {
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
export const headlineFor = (channel) => CHANNEL_HEADLINE[channel] || 'other';

export function spreadOf(kind, difficulty) {
  if (kind === 'slow') return CONFIG.slowSpread[difficulty];
  if (kind === 'fast') return [1];
  return CONFIG.lagSpread[difficulty];
}
export function makeImpulse(channel, amount, reasonText, spreadKind, difficulty, headline) {
  const pattern = spreadOf(spreadKind, difficulty);
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel), values: pattern.map((f) => amount * f), idx: 0 };
}
/* Программа, а не шок: одно и то же давление держится N кварталов подряд.
   Обычные раскладки (lagSpread/slowSpread) распределяют разовую сумму по 2–4
   кварталам — этого хватает событию, но не реформе или национальному проекту,
   которые тянутся годами. */
export function sustainedImpulse(channel, perQuarter, quarters, reasonText, headline) {
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel),
    values: Array.from({ length: Math.max(1, quarters) }, () => perQuarter), idx: 0 };
}
/* Как sustainedImpulse, но со своим значением на каждый квартал — нужно там, где
   эффект не постоянен, а угасает по графику (сплочение вокруг флага греет рейтинг
   резко и быстро остывает, а не держится на одном уровне и не обрывается разом). */
export function taperedImpulse(channel, values, reasonText, headline) {
  return { id: uid(), channel, reasonText, headline: headline || headlineFor(channel), values, idx: 0 };
}
export function pickEvent(state, eventCooldowns) {
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
export function buildEventImpulses(evt, state) {
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
export function tickImpulses(queue) {
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

