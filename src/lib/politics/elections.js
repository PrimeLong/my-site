/* Выделено из engine.js: politics/elections.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { clamp, rng } from '../catalog.js';
import { fmt1, fmtMoney } from '../engine.js';
import { groupTurnoutShift, regionVoteShares } from './groups.js';
import { MAP_REGIONS, votingRegions } from '../world/regions.js';

/* =========================================================================================
   ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ (роли «премьер-министр» и «президент»): у них, в отличие от
   ЦБ и Минфина, нет бота-оппонента со своими требованиями — конкретные, измеримые
   обещания на срок до выборов замещают то давление, которое остальным ролям
   создаёт партнёр по власти. target/baseline считаются один раз в момент
   начала срока (pickPromises) и хранятся как обычные числа — не функции —
   чтобы объект без проблем переживал JSON (сохранения, снапшоты).
========================================================================================= */
export const round1 = (v) => Math.round(v * 10) / 10;
export const PROMISE_POOL = [
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
export function pickPromises(startEconomy, count = 3) {
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
export function evaluatePromise(promise, economy) {
  const def = PROMISE_POOL.find((p) => p.id === promise.id);
  if (!def) return { met: true, value: null };
  const value = def.metric(economy, promise.baseline);
  const met = def.direction === 'below' ? value <= promise.target : value >= promise.target;
  // direction нужен интерфейсу, чтобы подписать порог («надо ≤» или «надо ≥»),
  // а не показывать две голые цифры через дробь
  return { met, value, direction: def.direction };
}


/* ======================= ОПРОСЫ И ШТАБ КАМПАНИИ =======================
   За четыре квартала до голосования появляются опросы по областям. Кампания —
   это штабы: каждый квартал президент (или бот за него) распределяет
   CAMPAIGN_POINTS штабов по областям, каждый стоит денег. Штаб убеждает тем
   сильнее, чем ближе область к перелому: там, где исход предрешён в ту или
   другую сторону, агитация почти бесполезна. Прибавка по областям складывается
   в общенациональный итог — поэтому выгоднее бороться за колеблющиеся области,
   а безнадёжные признать потерянными. */
export const CAMPAIGN_POINTS = 4;
export const CAMPAIGN_COST = 0.04; // % ВВП за штаб
export const POLL_WINDOW = 4;
export const campaignOpen = (s) => (s.politicalRegime || 'democracy') === 'democracy' || s.politicalRegime === 'crisis';
export function persuadability(share) {
  const m = Math.abs(share - 50);
  return m < 4 ? 1 : m < 8 ? 0.55 : 0.2;
}
export const campaignBonus = (points, share) => 1.6 * Math.sqrt(Math.max(0, points || 0)) * persuadability(share);
export const swingLabel = (share) => {
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
export const CLOSED_POLL_MARGIN = { authoritarian: 5, totalitarian: 8 };
export function electionForecast(s, extraPlan) {
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
export function sanitizeCampaignPlan(plan, s) {
  const out = {}; let left = CAMPAIGN_POINTS;
  (s ? votingRegions(s) : MAP_REGIONS).forEach((r) => {
    const n = Math.max(0, Math.min(left, Math.floor(Number((plan || {})[r.id]) || 0)));
    if (n > 0) { out[r.id] = n; left -= n; }
  });
  return out;
}
// бот-штаб: по одному штабу в четыре самые колеблющиеся области
export function botCampaignPlan(s) {
  const f = electionForecast(s);
  if (!f || f.closed) return {};
  const plan = {};
  [...f.byRegion].sort((a, b) => Math.abs(a.share - 50) - Math.abs(b.share - 50)).slice(0, CAMPAIGN_POINTS).forEach((r) => { plan[r.id] = 1; });
  return plan;
}
export function campaignStep(s, decisions) {
  const toVote = Number.isFinite(s.quartersToElection) ? s.quartersToElection : 16;
  if (toVote > POLL_WINDOW || toVote < 1 || !campaignOpen(s)) return { spend: { ...s.campaignSpend }, spendPct: 0 };
  const plan = sanitizeCampaignPlan(decisions.campaignPlan, s);
  const spend = { ...s.campaignSpend };
  let total = 0;
  Object.entries(plan).forEach(([id, n]) => { spend[id] = (spend[id] || 0) + n; total += n; });
  return { spend, spendPct: total * CAMPAIGN_COST };
}

