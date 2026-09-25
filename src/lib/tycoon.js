/* =========================================================================================
   СВОЁ ДЕЛО: тайкун предпринимателя в реальном времени
   Страна живёт фоном (lib/autopilot.js): ЦБ, Минфин и президент — боты, квартал
   экономики проходит раз в минуту игрового времени. Игрок строит производственные
   цепочки по областям карты: поле → мельница → хлебозавод → магазин, лес → лесопилка
   → мебель, руда и уголь → сталь → станки и техника. Сырьё возится между областями
   (перевозка стоит денег, чем дальше — тем дороже), лишнее уходит на оптовый рынок,
   недостающее докупается там же. Спрос в магазинах — от ВВП, доверия и ставки, цены
   сырья — от инфляции и курса, кредит — от ставки и банков, налог — от Минфина,
   проверки — от режима. Растёт всё экспоненциально: улучшения зданий, исследования,
   а продажа компании приносит репутацию — бонус к следующему делу.

   Деньги — в «млн», как во всей игре. Время — в секундах игрового времени.
   Модель чистая: состояние на входе, новое состояние на выходе. Случайность — rng()
   (как у движка), чтобы тесты и повторы были воспроизводимы.
========================================================================================= */
import { clamp, rng } from './catalog.js';
import { activeRegions, regionById, regionStress, quarterLabel } from './engine.js';
import {
  demandIndex, exportIndex, priceIdx, fxRate, fxLoanRate, rubLoanRate, evMultiple, creditMultiple,
  strikeChance, inspectionChance, hardRegime,
} from './business.js';
import { makeCountry, advanceCountry } from './autopilot.js';

export const TYCOON_VERSION = 1;
export const QUARTER_SEC = 60;
export const OFFLINE_CAP_SEC = 3 * 3600;
const WAGE_PER_SEC = 0.0009;
// очки исследований в секунду и без лаборатории
export const RP_BASE = 0.25;

/* ------------------------------ РЕСУРСЫ ------------------------------
   price — оптовая цена за единицу при ценах и курсе старта; imp — доля цены,
   которая ходит за мировым рынком (курс); depth — «глубина» оптового рынка: сколько
   единиц в секунду он переварит без заметного падения цены. consumer — продаётся в
   магазинах (market — какой макропоказатель двигает спрос), export — можно вывозить. */
export const RESOURCES = [
  { id: 'grain', name: 'Зерно', unit: 'т', price: 0.02, imp: 0.2, depth: 4, export: true, tier: 0 },
  { id: 'wood', name: 'Древесина', unit: 'м³', price: 0.024, imp: 0.1, depth: 4, export: true, tier: 0 },
  { id: 'ore', name: 'Руда', unit: 'т', price: 0.03, imp: 0.3, depth: 3, export: true, tier: 0 },
  { id: 'coal', name: 'Уголь', unit: 'т', price: 0.022, imp: 0.3, depth: 3, export: true, tier: 0 },
  { id: 'flour', name: 'Мука', unit: 'т', price: 0.06, imp: 0.1, depth: 2.5, tier: 1 },
  { id: 'boards', name: 'Доски', unit: 'м³', price: 0.075, imp: 0.2, depth: 2.5, export: true, tier: 1 },
  { id: 'steel', name: 'Сталь', unit: 'т', price: 0.22, imp: 0.5, depth: 1.5, export: true, tier: 2 },
  { id: 'parts', name: 'Комплектующие', unit: 'шт', price: 0.3, imp: 1, depth: 1, buyOnly: true, tier: 2 },
  { id: 'bread', name: 'Хлеб', unit: 'т', price: 0.12, imp: 0.05, depth: 3, consumer: 'food', demand: 6, elast: 1.2, tier: 2 },
  { id: 'furniture', name: 'Мебель', unit: 'компл.', price: 0.45, imp: 0.15, depth: 0.6, consumer: 'housing', demand: 2, elast: 1.8, export: true, tier: 2 },
  { id: 'appliances', name: 'Бытовая техника', unit: 'шт', price: 1.2, imp: 0.4, depth: 0.5, consumer: 'durable', demand: 0.8, elast: 2.2, export: true, tier: 3 },
  { id: 'machines', name: 'Станки', unit: 'шт', price: 1.4, imp: 0.5, depth: 0.4, export: true, tier: 3 },
];
export const RES = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

/* ------------------------------ ЗДАНИЯ ------------------------------
   in/out — единиц в секунду на первом уровне при полном штате; regions — где можно
   строить и с каким бонусом к выработке (нет списка — где угодно, с бонусами из
   bonus); unlock — исследование, которое открывает здание. */
export const BUILDINGS = [
  { id: 'farm', name: 'Ферма', cat: 'extract', icon: 'wheat', cost: 1.6, upkeep: 0.002, workers: 4,
    out: { grain: 1 }, regions: { agri: 1.3, periphery: 1, finance: 0.8 } },
  { id: 'logging', name: 'Лесозаготовка', cat: 'extract', icon: 'trees', cost: 1.8, upkeep: 0.002, workers: 4,
    out: { wood: 1 }, regions: { periphery: 1.3, mining: 0.8, pereval: 1.1, halvik: 1 } },
  { id: 'ore_mine', name: 'Рудник', cat: 'extract', icon: 'pickaxe', cost: 6, upkeep: 0.004, workers: 6,
    out: { ore: 1.2 }, regions: { mining: 1.2, halvik: 1.6, pereval: 0.9 }, unlock: 'metallurgy' },
  { id: 'coal_mine', name: 'Угольная шахта', cat: 'extract', icon: 'mountain', cost: 5, upkeep: 0.004, workers: 6,
    out: { coal: 1.2 }, regions: { mining: 1.3, industry: 0.8, halvik: 1 }, unlock: 'metallurgy' },
  { id: 'mill', name: 'Мельница', cat: 'process', icon: 'factory', cost: 3, upkeep: 0.003, workers: 3,
    in: { grain: 2 }, out: { flour: 1 }, bonus: { agri: 1.1 } },
  { id: 'bakery', name: 'Хлебозавод', cat: 'process', icon: 'factory', cost: 4, upkeep: 0.004, workers: 5,
    in: { flour: 1 }, out: { bread: 1 }, bonus: { capital: 1.05 } },
  { id: 'sawmill', name: 'Лесопилка', cat: 'process', icon: 'factory', cost: 3.5, upkeep: 0.003, workers: 4,
    in: { wood: 2 }, out: { boards: 1 }, bonus: { periphery: 1.1, industry: 1.1 } },
  { id: 'furniture_plant', name: 'Мебельная фабрика', cat: 'process', icon: 'factory', cost: 9, upkeep: 0.008, workers: 8,
    in: { boards: 1.5 }, out: { furniture: 0.5 }, bonus: { industry: 1.15, capital: 1.05 }, unlock: 'furniture' },
  { id: 'steelworks', name: 'Сталелитейный завод', cat: 'process', icon: 'factory', cost: 25, upkeep: 0.015, workers: 12,
    in: { ore: 1, coal: 0.5 }, out: { steel: 0.5 }, bonus: { industry: 1.25, mining: 1.1 }, unlock: 'metallurgy' },
  { id: 'machine_plant', name: 'Станкозавод', cat: 'process', icon: 'factory', cost: 60, upkeep: 0.03, workers: 15,
    in: { steel: 1 }, out: { machines: 0.25 }, bonus: { industry: 1.3 }, unlock: 'machinery' },
  { id: 'appliance_plant', name: 'Завод бытовой техники', cat: 'process', icon: 'factory', cost: 55, upkeep: 0.025, workers: 14,
    in: { steel: 0.667, parts: 0.333 }, out: { appliances: 0.333 }, bonus: { industry: 1.15, port: 1.1 }, unlock: 'appliances' },
  { id: 'shop', name: 'Магазин', cat: 'sell', icon: 'store', cost: 2.5, upkeep: 0.002, workers: 3, sells: 1.5 },
  { id: 'mall', name: 'Торговый центр', cat: 'sell', icon: 'building', cost: 45, upkeep: 0.02, workers: 12, sells: 8, unlock: 'malls' },
  { id: 'terminal', name: 'Экспортный терминал', cat: 'sell', icon: 'anchor', cost: 30, upkeep: 0.01, workers: 6, exports: 3,
    regions: { port: 1, nordholm: 0.8 }, unlock: 'export' },
  { id: 'warehouse', name: 'Склад', cat: 'support', icon: 'warehouse', cost: 1.5, upkeep: 0.001, workers: 1, storage: 400 },
  { id: 'lab', name: 'Лаборатория', cat: 'support', icon: 'flask', cost: 7, upkeep: 0.005, workers: 5, research: 0.6,
    bonus: { capital: 1.3, finance: 1.2 } },
];
export const BLD = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/* ------------------------------ ИССЛЕДОВАНИЯ: ДЕРЕВО ------------------------------
   tier — колонка дерева (чем правее, тем дальше), row — строка; req — что нужно
   изучить раньше (одно или несколько). Ветки: производство, торговля, металл,
   управление. Каждое следующее изучение дороже (researchCost). */
export const RESEARCH = [
  // производство
  { id: 'mechanization', name: 'Механизация', cost: 150, tier: 0, row: 0, branch: 'prod', desc: 'Фермы и лесозаготовки дают в полтора раза больше.' },
  { id: 'agronomy', name: 'Селекция', cost: 260, tier: 1, row: 0, branch: 'prod', req: ['mechanization'], desc: 'Фермы и лесозаготовки — ещё +40%.' },
  { id: 'automation1', name: 'Автоматизация', cost: 375, tier: 2, row: 0, branch: 'prod', req: ['mechanization'], desc: 'Зданиям нужно на четверть меньше работников.' },
  { id: 'efficiency', name: 'Бережливое производство', cost: 500, tier: 3, row: 0, branch: 'prod', req: ['automation1'], desc: 'Расходы на содержание зданий ниже на 30%.' },
  { id: 'automation2', name: 'Роботизация', cost: 1250, tier: 4, row: 0, branch: 'prod', req: ['automation1', 'efficiency'], desc: 'Работников нужно вдвое меньше, чем без автоматизации.' },
  // торговля и логистика
  { id: 'storage', name: 'Складская логистика', cost: 225, tier: 0, row: 1, branch: 'trade', desc: 'Вместимость склада вдвое больше.' },
  { id: 'logistics1', name: 'Логистика', cost: 150, tier: 1, row: 1, branch: 'trade', req: ['storage'], desc: 'Перевозки между областями дешевле на 40%.' },
  { id: 'export', name: 'Внешняя торговля', cost: 300, tier: 2, row: 1, branch: 'trade', req: ['logistics1'], desc: 'Открывает экспортный терминал в порту: продажи в валюте по мировым ценам.' },
  { id: 'logistics2', name: 'Своя транспортная сеть', cost: 500, tier: 3, row: 1, branch: 'trade', req: ['logistics1'], desc: 'Перевозки дешевле ещё вдвое, склад больше на половину.' },
  // товары и бренд
  { id: 'furniture', name: 'Мебельное производство', cost: 125, tier: 0, row: 2, branch: 'goods', desc: 'Открывает мебельную фабрику: доски превращаются в мебель для магазинов.' },
  { id: 'branding', name: 'Бренд', cost: 300, tier: 1, row: 2, branch: 'goods', req: ['furniture'], desc: 'Спрос в ваших магазинах выше на четверть.' },
  { id: 'malls', name: 'Торговые центры', cost: 375, tier: 2, row: 2, branch: 'goods', req: ['branding'], desc: 'Открывает торговый центр — в пять раз больше покупателей, чем у магазина.' },
  { id: 'megabrand', name: 'Национальный бренд', cost: 2000, tier: 4, row: 2, branch: 'goods', req: ['malls', 'export'], desc: 'Спрос в магазинах выше ещё на треть, экспорт дороже на 10%.' },
  // металл и машины
  { id: 'metallurgy', name: 'Металлургия', cost: 200, tier: 1, row: 3, branch: 'metal', req: ['mechanization'], desc: 'Открывает рудники, угольные шахты и сталелитейный завод.' },
  { id: 'machinery', name: 'Станкостроение', cost: 625, tier: 2, row: 3, branch: 'metal', req: ['metallurgy'], desc: 'Открывает станкозавод — дорогой товар для экспорта и оптового рынка.' },
  { id: 'appliances', name: 'Бытовая техника', cost: 750, tier: 3, row: 3, branch: 'metal', req: ['machinery', 'branding'], desc: 'Открывает завод бытовой техники: сталь и импортные комплектующие.' },
  // управление: люди, менеджеры, деньги
  { id: 'hr', name: 'Кадровое агентство', cost: 80, tier: 0, row: 4, branch: 'mgmt', desc: 'Люди на новые здания набираются вдвое быстрее.' },
  { id: 'management', name: 'Школа управленцев', cost: 180, tier: 1, row: 4, branch: 'mgmt', req: ['hr'], desc: 'Можно нанимать менеджеров: управляющего производством, коммерческого директора и главного технолога.' },
  { id: 'finance_dept', name: 'Финансовый отдел', cost: 280, tier: 2, row: 4, branch: 'mgmt', req: ['management'], desc: 'Банки дают вдвое больше, проценты ниже на пункт.' },
  { id: 'board', name: 'Совет директоров', cost: 700, tier: 3, row: 4, branch: 'mgmt', req: ['management', 'finance_dept'], desc: 'Можно нанять директора по развитию и финансового директора — они строят и занимают сами.' },
];
export const RESEARCH_BRANCHES = { prod: 'Производство', trade: 'Торговля и логистика', goods: 'Товары и бренд', metal: 'Металл и машины', mgmt: 'Управление' };
const reqsOf = (r) => (Array.isArray(r.req) ? r.req : r.req ? [r.req] : []);
export { reqsOf };
export const RSR = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

/* ------------------------------ ГЕОГРАФИЯ ------------------------------
   Сеть дорог — та же, что на карте страны (железные и автомобильные), плюс пути
   в присоединённые земли. Расстояние — число перегонов. */
const LINKS = [['capital', 'industry'], ['industry', 'mining'], ['capital', 'port'], ['port', 'finance'], ['capital', 'agri'],
  ['capital', 'periphery'], ['capital', 'finance'], ['agri', 'finance'], ['periphery', 'industry'], ['agri', 'periphery'],
  ['mining', 'halvik'], ['industry', 'pereval'], ['pereval', 'halvik'], ['pereval', 'nordholm']];
const REGION_IDS = ['capital', 'port', 'industry', 'agri', 'finance', 'mining', 'periphery', 'pereval', 'halvik', 'nordholm'];
export const HOPS = (() => {
  const adj = Object.fromEntries(REGION_IDS.map((id) => [id, []]));
  LINKS.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const out = {};
  REGION_IDS.forEach((src) => {
    const d = { [src]: 0 }; const q = [src];
    while (q.length) { const x = q.shift(); adj[x].forEach((y) => { if (d[y] == null) { d[y] = d[x] + 1; q.push(y); } }); }
    out[src] = d;
  });
  return out;
})();
export const ROUTE_LINKS = LINKS;
const hops = (a, b) => (HOPS[a] && HOPS[a][b] != null ? HOPS[a][b] : 4);
// оптовый рынок и биржа — в столице: купленное там везут оттуда
const MARKET_HUB = 'capital';

// доля покупателей области и уровень зарплат в ней
const POP = { capital: 0.24, port: 0.11, industry: 0.15, agri: 0.11, finance: 0.12, mining: 0.1, periphery: 0.12, pereval: 0.03, halvik: 0.03, nordholm: 0.05 };
const REGION_WAGE = { capital: 1.3, finance: 1.2, port: 1.1, industry: 1, mining: 1.05, agri: 0.85, periphery: 0.8, pereval: 0.75, halvik: 0.75, nordholm: 0.8 };
const BASE_SLOTS = 3;

/* ------------------------------ СТАРТЫ ------------------------------ */
export const STARTS = {
  farm: { region: 'agri', buildings: [['farm', 'agri'], ['farm', 'agri'], ['mill', 'agri']], sell: ['flour'], buy: [], cash: 10,
    hint: 'Мука уходит на оптовый рынок. Дальше — хлебозавод и магазин, чтобы продавать хлеб людям, а не муку перекупщикам.' },
  retail: { region: 'capital', buildings: [['bakery', 'capital'], ['shop', 'capital']], sell: [], buy: ['flour'],
    hint: 'Мука покупается на рынке — это дорого. Своя мельница и поле рядом со столицей сделают хлеб выгоднее.' },
  factory: { region: 'periphery', buildings: [['logging', 'periphery'], ['logging', 'periphery'], ['sawmill', 'periphery']], sell: ['boards'], buy: [],
    research: ['furniture'], cash: 16,
    hint: 'Доски уходят на оптовый рынок. Мебельное производство вы уже знаете: фабрика и магазин — и доски станут мебелью в разы дороже.' },
};

let uidSeq = 1;
const newUid = () => `b${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

export function makeTycoon({ start = 'farm', scenario = 'sandbox', difficulty = 'medium', cbPersona = 'pragmatic',
  mofPersona = 'technocrat', presPersona = 'technocrat', president = true, legacy = 0, name = 'Своё дело' } = {}) {
  const kit = STARTS[start] || STARTS.farm;
  const country = makeCountry({ scenario, difficulty, cbPersona, mofPersona, presPersona, president });
  const now = Date.now();
  const st = {
    v: TYCOON_VERSION, app: 'economic-panel', mode: 'tycoon', name, start, createdAt: now, savedAt: now,
    t: 0, qTime: 0, speed: 1, paused: false,
    cash: kit.cash || 8, debtRub: 0, debtFx: 0, loanRate: rubLoanRate(country.economy),
    wagePremium: 0, gr: false,
    buildings: [], slots: {},
    stock: {}, autoSell: {}, autoBuy: {}, reserve: {}, exportList: {}, markup: {},
    research: {}, rp: 0,
    wageIdx: 1, worldIdx: 1,
    stats: { rates: {}, income: 0, costs: 0, flows: {}, unmet: {}, sellEma: {}, exportEma: {} },
    quarter: emptyQuarter(),
    history: [],
    country,
    news: [], log: [],
    events: { regionHit: null, strike: null, strikeCd: 0, inspectionCd: 0 },
    distress: 0, bankrupt: false,
    legacy, milestones: {},
    rivals: makeRivals(), startQ: country.quarterIndex,
    managers: {}, mgrTimer: 0, quest: 0, introSeen: false,
    lifetime: { retail: 0, wholesale: 0, exports: 0 }, flags: {},
    setup: { start, scenario, difficulty, cbPersona, mofPersona, presPersona, president },
  };
  kit.buildings.forEach(([type, region]) => {
    st.buildings.push({ uid: newUid(), type, region, level: 1, staff: requiredStaff(st, { type, level: 1 }), enabled: true });
  });
  kit.sell.forEach((r) => { st.autoSell[r] = true; });
  (kit.research || []).forEach((r) => { st.research[r] = true; });
  kit.buy.forEach((r) => { st.autoBuy[r] = true; });
  st.autoBuy.parts = true;
  RESOURCES.forEach((r) => { st.stock[r.id] = 0; st.reserve[r.id] = 0; });
  pushLog(st, kit.hint);
  st.value0 = companyValue(st);
  st.startBuildings = st.buildings.length;
  return st;
}

// сохранения прошлых версий не знают о менеджерах, заданиях и счётчиках — дополняем
export function normalizeTycoon(st) {
  return { managers: {}, mgrTimer: 0, quest: 0, introSeen: true, lifetime: { retail: 0, wholesale: 0, exports: 0 }, flags: {},
    startBuildings: 3, rivals: makeRivals(), startQ: st.country ? st.country.quarterIndex : 1, ...st };
}

function emptyQuarter() {
  return { revenue: 0, retail: 0, wholesale: 0, exports: 0, wages: 0, upkeep: 0, purchases: 0, transport: 0, capex: 0 };
}
function pushLog(st, text) {
  st.log = [{ t: st.t, q: st.country.quarterIndex, text }, ...st.log].slice(0, 40);
}
function pushNews(st, headline, text, cat = 'business') {
  const q = st.country.quarterIndex;
  st.news = [{ id: `own${st.t.toFixed(1)}${headline.length}`, cat, priority: 7, q, qLabel: quarterLabel(q), headline, text, own: true }, ...st.news].slice(0, 80);
}

/* ------------------------------ ПРОИЗВОДНЫЕ ------------------------------ */
export const economyOf = (st) => st.country.economy;
export const has = (st, id) => !!st.research[id];
export const legacyMult = (st) => 1 + 0.1 * (st.legacy || 0);
export const levelMult = (level) => Math.pow(1.5, level - 1);
export const upgradeCost = (b) => BLD[b.type].cost * Math.pow(1.9, b.level);
export const MAX_LEVEL = 12;

export function requiredStaff(st, b) {
  const auto = has(st, 'automation2') ? 0.5 : has(st, 'automation1') ? 0.75 : 1;
  return Math.max(1, Math.round(BLD[b.type].workers * Math.pow(1.25, b.level - 1) * auto));
}

export function regionsOpen(st) {
  const ids = activeRegions(economyOf(st)).map((r) => r.id);
  return REGION_IDS.filter((id) => ids.includes(id));
}
export const regionName = (id) => (regionById(id) || {}).short || id;
export const regionFullName = (id) => (regionById(id) || {}).name || id;

// можно ли строить здание в области и с каким бонусом (null — нельзя)
export function siteBonus(type, region) {
  const d = BLD[type];
  if (d.regions) return d.regions[region] ?? null;
  return (d.bonus && d.bonus[region]) || 1;
}
export const slotsIn = (st, region) => BASE_SLOTS + (st.slots[region] || 0);
export const usedIn = (st, region) => st.buildings.filter((b) => b.region === region).length;
export const slotCost = (st, region) => 3 * Math.pow(2.5, st.slots[region] || 0);

export function storageCap(st) {
  const extra = st.buildings.filter((b) => b.type === 'warehouse' && b.enabled)
    .reduce((a, b) => a + BLD.warehouse.storage * levelMult(b.level), 0);
  let cap = 200 + extra;
  if (has(st, 'storage')) cap *= 2;
  if (has(st, 'logistics2')) cap *= 1.5;
  return cap;
}

// оптовая цена ресурса сейчас: внутренние цены и мировые по курсу
export function marketPrice(st, id) {
  const r = RES[id]; const e = economyOf(st);
  let p = r.price * (priceIdx(e) * (1 - r.imp) + fxRate(e) * st.worldIdx * r.imp);
  // война: оборонный заказ поднимает цену стали и станков
  if ((e.warQuartersLeft || 0) > 0 && (id === 'steel' || id === 'machines')) p *= 1.25;
  return p;
}
export const buyPrice = (st, id) => marketPrice(st, id) * 1.15;
export function sellPrice(st, id, rate = null) {
  const r = RES[id];
  const ema = rate ?? (st.stats.sellEma[id] || 0);
  // на оптовый рынок льют и конкуренты: чем больше их товара, тем дешевле ваш
  return marketPrice(st, id) * 0.8 / (1 + (ema + rivalSupply(st, id)) / r.depth);
}
export function exportPrice(st, id, rate = null) {
  const r = RES[id]; const e = economyOf(st);
  const ema = rate ?? (st.stats.exportEma[id] || 0);
  const world = r.price * fxRate(e) * st.worldIdx * (has(st, 'megabrand') ? 1.1 : 1);
  // санкции, наступательная война и торговый блок — из того же внешнего спроса, что у первой версии роли
  const open = exportIndex(e) / Math.pow(fxRate(e), 0.9);
  return world * open / (1 + ema / (r.depth * 3));
}
export const retailPrice = (st, id) => marketPrice(st, id) * (1 + (st.markup[id] || 0) / 100);
const tariff = (st, id) => RES[id].price * priceIdx(economyOf(st)) * 0.04
  * (has(st, 'logistics2') ? 0.3 : has(st, 'logistics1') ? 0.6 : 1);

// спрос на товар в области: люди области, макроэкономика, настроение области, цена, бренд
export function regionDemand(st, region, id) {
  const r = RES[id]; const e = economyOf(st);
  if (!r.consumer) return 0;
  const macro = r.consumer === 'food' ? Math.pow(demandIndex('retail', e), 0.5)
    : r.consumer === 'housing' ? demandIndex('builder', e)
      : demandIndex('retail', e) * Math.exp(-0.03 * ((e.lendingRate ?? 7.92) - 7.92));
  const reg = regionById(region);
  const stress = reg ? regionStress(reg, e) : 30;
  const mood = clamp(1.15 - stress / 200, 0.6, 1.15);
  const brand = (has(st, 'branding') ? 1.25 : 1) * (has(st, 'megabrand') ? 1.33 : 1);
  const priceF = Math.pow(1 + (st.markup[id] || 0) / 100, -r.elast);
  const hit = st.events.regionHit && st.events.regionHit.region === region ? 0.75 : 1;
  return r.demand * (POP[region] || 0.05) * macro * mood * brand * priceF * legacyMult(st) * hit;
}

// что показать об области: отрасль, доля покупателей, уровень зарплат, настроение, беда
export function regionInfo(st, region) {
  const reg = regionById(region); const e = economyOf(st);
  const stress = reg ? regionStress(reg, e) : 30;
  return { sector: reg ? reg.sector : '', pop: POP[region] || 0.05, wage: REGION_WAGE[region] || 1,
    mood: clamp(1.15 - stress / 200, 0.6, 1.15),
    hit: st.events.regionHit && st.events.regionHit.region === region ? st.events.regionHit.title : null };
}

// выработка здания сейчас: уровень, место, штат, исследования, события
export function buildingPower(st, b) {
  if (!b.enabled) return 0;
  const d = BLD[b.type];
  const need = requiredStaff(st, b);
  const staffK = clamp((b.staff || 0) / need, 0, 1);
  let k = levelMult(b.level) * (siteBonus(b.type, b.region) || 0) * staffK * legacyMult(st);
  if (d.cat === 'extract' && has(st, 'mechanization')) k *= 1.5;
  if (d.cat === 'extract' && has(st, 'agronomy')) k *= 1.4;
  if (st.events.regionHit && st.events.regionHit.region === b.region) k *= 0.6;
  if (st.events.strike && st.events.strike.uid === b.uid && st.t < st.events.strike.until) k *= 0.15;
  return k;
}
const wageOf = (st, region) => WAGE_PER_SEC * st.wageIdx * (REGION_WAGE[region] || 1) * (1 + st.wagePremium / 100) * rivalWageK(st, region);
const upkeepOf = (st, b) => BLD[b.type].upkeep * Math.pow(1.3, b.level - 1) * priceIdx(economyOf(st))
  * (has(st, 'efficiency') ? 0.7 : 1);

/* ------------------------------ ТАКТ ------------------------------
   dt — секунды игрового времени. Большие промежутки режутся на секунды, внутри —
   кварталы, если пришло их время. offline — страна стоит (её кварталы не идут), но
   кварталы компании идут: проценты, погашение, налог, проверки, ход конкурентов.
   Раньше офлайн их пропускал целиком — можно было взять максимальный кредит,
   закрыть вкладку и три часа (180 кварталов) не платить ни процентов, ни налога. */
export function tick(prev, dt, { offline = false } = {}) {
  let st = prev;
  let left = Math.max(0, dt);
  while (left > 1e-9 && !st.bankrupt) {
    const step = Math.min(left, 1);
    st = step1(st, step, offline);
    if (st.mgrTimer >= 5) st = runManagers({ ...st, mgrTimer: 0 });
    left -= step;
    if (st.qTime >= QUARTER_SEC) st = quarterEnd(st, offline);
  }
  return st;
}

function step1(prev, dt, offline) {
  const st = { ...prev, stock: { ...prev.stock }, stats: { ...prev.stats }, quarter: { ...prev.quarter } };
  const e = economyOf(st);
  const alpha = 1 - Math.exp(-dt / 6);
  const ema = (old, v) => (old || 0) + alpha * (v - (old || 0));
  const offK = offline ? 0.5 : 1;
  let cash = st.cash;
  let revenue = 0; let costs = 0;
  const prod = {}; const cons = {}; const sold = {}; const bought = {};
  const add = (m, k, v) => { m[k] = (m[k] || 0) + v; };
  const flows = {};
  const flow = (from, to, value) => { if (from !== to && value > 0) add(flows, `${from}>${to}`, value); };

  // штат: люди приходят постепенно — быстрее при высокой безработице и хорошей зарплате
  const labor = clamp(((e.unemployment ?? 5) - 2) / 5, 0.15, 1.3) * (1 + st.wagePremium / 50) * (has(st, 'hr') ? 2 : 1);
  st.buildings = st.buildings.map((b) => {
    const need = requiredStaff(st, b);
    if (b.staff >= need) return b.staff > need ? { ...b, staff: need } : b;
    return { ...b, staff: Math.min(need, (b.staff || 0) + 0.5 * labor * dt) };
  });

  const power = Object.fromEntries(st.buildings.map((b) => [b.uid, buildingPower(st, b) * offK]));
  const cap = storageCap(st);

  // откуда что везти: ближайшая область, где это производят свои же здания
  const producers = {};
  st.buildings.forEach((b) => {
    const d = BLD[b.type];
    if (d.out && power[b.uid] > 0) Object.keys(d.out).forEach((r) => { (producers[r] = producers[r] || new Set()).add(b.region); });
  });
  const sourceFor = (r, region) => {
    const set = producers[r];
    if (!set || !set.size) return MARKET_HUB;
    let best = null; let bd = 99;
    set.forEach((x) => { const h = hops(x, region); if (h < bd) { bd = h; best = x; } });
    return best;
  };

  // 1. потребность цехов во входах; недостающее — докупить, если разрешено
  const need = {};
  st.buildings.forEach((b) => {
    const d = BLD[b.type];
    if (!d.in) return;
    Object.entries(d.in).forEach(([r, q]) => add(need, r, q * power[b.uid] * dt));
  });
  Object.entries(need).forEach(([r, q]) => {
    const have = st.stock[r] || 0;
    if (have < q && (st.autoBuy[r] || RES[r].buyOnly) && cash > 0) {
      const price = buyPrice(st, r);
      const amt = Math.min(q - have, cash / price);
      if (amt > 0) {
        st.stock[r] = have + amt; cash -= amt * price; costs += amt * price;
        st.quarter.purchases += amt * price; add(bought, r, amt);
      }
    }
  });
  const sat = {};
  Object.entries(need).forEach(([r, q]) => { sat[r] = q > 0 ? clamp((st.stock[r] || 0) / q, 0, 1) : 1; });

  // 2. сколько каждый цех реально отработает: хватает ли входов и места под выход
  const runK = {};
  const plannedOut = {};
  st.buildings.forEach((b) => {
    const d = BLD[b.type];
    if (!d.out) return;
    let f = 1;
    if (d.in) Object.keys(d.in).forEach((r) => { f = Math.min(f, sat[r] ?? 1); });
    runK[b.uid] = f;
    Object.entries(d.out).forEach(([r, q]) => add(plannedOut, r, q * power[b.uid] * f * dt));
  });
  const room = {};
  Object.entries(plannedOut).forEach(([r, q]) => {
    const space = Math.max(0, cap - (st.stock[r] || 0));
    room[r] = q > 0 ? clamp(space / q, 0, 1) : 1;
  });
  st.buildings.forEach((b) => {
    const d = BLD[b.type];
    if (!d.out) return;
    let f = runK[b.uid];
    Object.keys(d.out).forEach((r) => { f = Math.min(f, room[r] ?? 1); });
    const p = power[b.uid] * f * dt;
    if (p <= 0) { runK[b.uid] = 0; return; }
    runK[b.uid] = f;
    if (d.in) {
      Object.entries(d.in).forEach(([r, q]) => {
        const amt = q * p;
        st.stock[r] = Math.max(0, (st.stock[r] || 0) - amt); add(cons, r, amt);
        const src = sourceFor(r, b.region);
        const tr = amt * tariff(st, r) * hops(src, b.region);
        cash -= tr; costs += tr; st.quarter.transport += tr;
        flow(src, b.region, amt * RES[r].price);
      });
    }
    Object.entries(d.out).forEach(([r, q]) => { const amt = q * p; st.stock[r] = (st.stock[r] || 0) + amt; add(prod, r, amt); });
  });

  // 3. магазины: покупатели области разбирают товары, пока хватает полок и запасов
  const shopCap = {};
  st.buildings.forEach((b) => { const d = BLD[b.type]; if (d.sells) add(shopCap, b.region, d.sells * power[b.uid] * dt); });
  const planned = {}; const unmet = {};
  const goods = RESOURCES.filter((r) => r.consumer);
  const rivalSold = {};
  Object.entries(shopCap).forEach(([region, c]) => {
    // покупатели области делятся с конкурентами: у кого больше полок и ниже цены
    const dem = goods.map((g) => {
      const split = marketSplit(st, region, g.id, c / dt);
      split.rivals.forEach((x) => { rivalSold[g.id] = rivalSold[g.id] || {}; rivalSold[g.id][x.id] = (rivalSold[g.id][x.id] || 0) + x.rate; });
      return [g.id, (st.stock[g.id] > 0 || prod[g.id] > 0) ? regionDemand(st, region, g.id) * split.share * dt : 0];
    });
    const total = dem.reduce((a, [, v]) => a + v, 0);
    const k = total > c ? c / total : 1;
    dem.forEach(([g, v]) => { if (v > 0) { (planned[g] = planned[g] || []).push([region, v * k]); add(unmet, g, v * (1 - k)); } });
  });
  Object.entries(planned).forEach(([g, list]) => {
    const want = list.reduce((a, [, v]) => a + v, 0);
    const k = want > 0 ? Math.min(1, (st.stock[g] || 0) / want) : 0;
    const price = retailPrice(st, g);
    list.forEach(([region, v]) => {
      const amt = v * k;
      if (amt <= 0) return;
      st.stock[g] -= amt; add(sold, g, amt);
      const money = amt * price;
      revenue += money; st.quarter.retail += money;
      const src = sourceFor(g, region);
      const tr = amt * tariff(st, g) * hops(src, region);
      cash -= tr; costs += tr; st.quarter.transport += tr;
      flow(src, region, amt * RES[g].price);
      add(unmet, g, v - amt);
    });
  });

  /* свои цеха в первую очередь: на продажу и экспорт идёт только то, что сверх
     запаса игрока и сверх того, что собственные цеха заберут в ближайшие секунды */
  const keep = {};
  st.buildings.forEach((b) => {
    const d = BLD[b.type];
    if (d.in) Object.entries(d.in).forEach(([r, q]) => add(keep, r, q * power[b.uid] * 3));
  });
  const spare = (id) => Math.max(0, (st.stock[id] || 0) - (st.reserve[id] || 0) - (keep[id] || 0));

  // 4. экспорт через терминалы: отмеченные товары сверх запаса, по мировой цене
  const expCap = st.buildings.reduce((a, b) => a + (BLD[b.type].exports ? BLD[b.type].exports * power[b.uid] * dt : 0), 0);
  const exportedNow = {};
  if (expCap > 0) {
    const cand = RESOURCES.filter((r) => r.export && st.exportList[r.id])
      .map((r) => [r.id, spare(r.id)]).filter(([, v]) => v > 0);
    const total = cand.reduce((a, [, v]) => a + v, 0);
    const k = total > expCap ? expCap / total : 1;
    const port = st.buildings.find((b) => BLD[b.type].exports) || { region: 'port' };
    cand.forEach(([id, v]) => {
      const amt = v * k;
      const money = amt * exportPrice(st, id);
      st.stock[id] -= amt; add(sold, id, amt); exportedNow[id] = amt;
      revenue += money; st.quarter.exports += money;
      const src = sourceFor(id, port.region);
      const tr = amt * tariff(st, id) * hops(src, port.region);
      cash -= tr; costs += tr; st.quarter.transport += tr;
      flow(src, port.region, amt * RES[id].price);
    });
  }

  // 5. оптовый рынок: излишки сверх запаса уходят перекупщикам — чем больше льёте, тем дешевле
  const soldNow = {};
  RESOURCES.forEach((r) => {
    if (!st.autoSell[r.id] || r.buyOnly) return;
    const excess = spare(r.id);
    if (excess <= 1e-9) return;
    const money = excess * sellPrice(st, r.id);
    st.stock[r.id] -= excess; add(sold, r.id, excess); soldNow[r.id] = excess;
    revenue += money; st.quarter.wholesale += money;
    flow(sourceFor(r.id, MARKET_HUB), MARKET_HUB, excess * r.price);
  });

  // 6. зарплаты и содержание
  let wages = 0; let upkeep = 0;
  st.buildings.forEach((b) => {
    wages += (b.staff || 0) * wageOf(st, b.region) * dt;
    upkeep += (b.enabled ? upkeepOf(st, b) : upkeepOf(st, b) * 0.3) * dt;
  });
  cash += revenue - wages - upkeep;
  costs += wages + upkeep;
  st.quarter.revenue += revenue; st.quarter.wages += wages; st.quarter.upkeep += upkeep;
  if (st.lifetime) {
    st.lifetime = { retail: st.lifetime.retail + (st.quarter.retail - prev.quarter.retail),
      wholesale: st.lifetime.wholesale + (st.quarter.wholesale - prev.quarter.wholesale),
      exports: st.lifetime.exports + (st.quarter.exports - prev.quarter.exports) };
  }
  // менеджеры — каждые пять секунд игрового времени, и пока вкладка закрыта тоже
  if (st.managers && Object.keys(st.managers).length) {
    const salary = managerSalary(st) * dt;
    cash -= salary; costs += salary; st.quarter.wages += salary;
    st.mgrTimer = (st.mgrTimer || 0) + dt;
  }

  // 7. исследования
  const rp = st.buildings.reduce((a, b) => a + (BLD[b.type].research ? BLD[b.type].research * power[b.uid] * dt : 0), 0);
  // очки копятся и без лаборатории — первое изучение через несколько минут, а не через полчаса
  st.rp += rp + RP_BASE * dt;

  // статистика для экрана: скорости в секунду, сглаженные
  const rates = { ...st.stats.rates };
  RESOURCES.forEach((r) => {
    const o = rates[r.id] || {};
    rates[r.id] = { prod: ema(o.prod, (prod[r.id] || 0) / dt), cons: ema(o.cons, (cons[r.id] || 0) / dt),
      sold: ema(o.sold, (sold[r.id] || 0) / dt), bought: ema(o.bought, (bought[r.id] || 0) / dt) };
  });
  st.stats.rates = rates;
  st.stats.income = ema(st.stats.income, revenue / dt);
  st.stats.costs = ema(st.stats.costs, costs / dt);
  st.stats.sellEma = { ...st.stats.sellEma };
  st.stats.exportEma = { ...st.stats.exportEma };
  RESOURCES.forEach((r) => {
    st.stats.sellEma[r.id] = ema(st.stats.sellEma[r.id], (soldNow[r.id] || 0) / dt);
    st.stats.exportEma[r.id] = ema(st.stats.exportEma[r.id], (exportedNow[r.id] || 0) / dt);
  });
  const un = {};
  goods.forEach((g) => { un[g.id] = ema(st.stats.unmet[g.id], (unmet[g.id] || 0) / dt); });
  st.stats.unmet = un;
  // продажи конкурентов там, где торгуете и вы (и там, где вас нет, — для доли рынка)
  liveRivals(st).forEach((c) => RIVAL[c.id].goods.forEach((g) => Object.keys(c.shops).forEach((region) => {
    if (shopCap[region]) return;
    marketSplit(st, region, g, 0).rivals.forEach((x) => { if (x.id === c.id) { rivalSold[g] = rivalSold[g] || {}; rivalSold[g][c.id] = (rivalSold[g][c.id] || 0) + x.rate; } });
  })));
  const rs = {};
  goods.forEach((g) => {
    const old = (st.stats.rivalSold || {})[g.id] || {};
    const now = rivalSold[g.id] || {};
    const ids = new Set([...Object.keys(old), ...Object.keys(now)]);
    const m = {}; ids.forEach((id) => { const v = ema(old[id], now[id] || 0); if (v > 1e-5) m[id] = v; });
    rs[g.id] = m;
  });
  st.stats.rivalSold = rs;
  const fl = {};
  const keys = new Set([...Object.keys(st.stats.flows || {}), ...Object.keys(flows)]);
  keys.forEach((k) => { const v = ema((st.stats.flows || {})[k], (flows[k] || 0) / dt); if (v > 1e-5) fl[k] = v; });
  st.stats.flows = fl;
  st.stats.runK = runK;

  st.cash = cash;
  st.t += dt;
  st.qTime += dt;
  return st;
}

/* ------------------------------ КОНЕЦ КВАРТАЛА ------------------------------
   Страна делает ход, компания платит проценты и налог, случаются проверки,
   забастовки и беды в областях, банк пересчитывает лимит. */
/* След компании в экономике страны. Сила — от размера компании (стоимость v / (v + 3000)):
   небольшая лавка стране незаметна, концерн — заметен. Стройки — инвестиции, терминалы —
   экспорт, штат — занятость, а области с вашими заводами спокойнее. */
export function firmFootprint(st) {
  const v = Math.max(0, companyValue(st));
  const k = v / (v + 3000);
  const q = st.quarter || {};
  const byRegion = {};
  st.buildings.forEach((b) => { byRegion[b.region] = (byRegion[b.region] || 0) + 1; });
  const n = Math.max(1, st.buildings.length);
  const exportShare = q.revenue > 0 ? (q.exports || 0) / q.revenue : 0;
  return {
    k, investment: (q.capex || 0) > 0 ? 0.5 * k : 0, exports: 0.6 * k * exportShare, jobs: 0.2 * k,
    regions: Object.fromEntries(Object.entries(byRegion).map(([r, c]) => [r, Math.round(8 * k * (c / n) * 10) / 10])),
  };
}

// тело кредита гасится каждый квартал: 5% долга (кредит на ~5 лет), а не только проценты
export const AMORT_Q = 0.05;
function quarterEnd(prev, offline = false) {
  const st = { ...prev, events: { ...prev.events }, milestones: { ...prev.milestones } };
  st.qTime -= QUARTER_SEC;
  const before = economyOf(st);
  const q = st.quarter;
  const qi = st.country.quarterIndex;

  // проценты по долгу — по ставке, по которой он взят (старый переоценивается постепенно)
  const interest = st.debtRub * st.loanRate / 400 + st.debtFx * fxRate(before) * fxLoanRate(before) / 400;
  const ebitda = q.revenue - q.wages - q.upkeep - q.purchases - q.transport;
  const pretax = ebitda - interest;
  const tax = Math.max(0, pretax) * clamp(before.profitTaxRate ?? 20, 0, 60) / 100;
  st.cash -= interest + tax;
  // погашение тела: раньше долг висел вечно, сколько ни плати проценты
  const principal = (st.debtRub + st.debtFx * fxRate(before)) * AMORT_Q;
  if (principal > 0.005) {
    st.cash -= principal;
    st.debtRub *= 1 - AMORT_Q; st.debtFx *= 1 - AMORT_Q;
  }

  // страна: квартал экономики (офлайн страна стоит на паузе)
  if (!offline) {
    // компания игрока — часть своей экономики: стройки, экспорт и рабочие места идут в страну
    const { country, news } = advanceCountry(st.country, { firm: firmFootprint(st) });
    st.country = country;
    st.news = [...news.map((n) => ({ ...n, id: `c${qi}${n.id}` })), ...st.news].slice(0, 80);
  }
  const e = st.country.economy;
  if (!offline) {
    st.wageIdx *= Math.pow(1 + (e.wageGrowth ?? 6) / 100, 0.25);
    st.worldIdx *= 1.004;
  }
  const bankRate = Math.max(0.5, rubLoanRate(e) - (has(st, 'finance_dept') ? 1 : 0));
  st.loanRate = st.debtRub > 0 ? st.loanRate + 0.25 * (bankRate - st.loanRate) : bankRate;

  // конкуренты делают свой ход
  st.rivals = st.rivals || makeRivals();
  rivalsQuarter(st);

  // события квартала
  let fine = 0;
  st.events.regionHit = null;
  const rev = e.regionEvent;
  if (rev && rev.region && st.buildings.some((b) => b.region === rev.region)) {
    st.events.regionHit = { region: rev.region, title: rev.title, untilQ: e.quarterIndex };
    pushNews(st, `${(rev.title || 'Событие').toUpperCase()}: ВАШИ ПРЕДПРИЯТИЯ ПОД УДАРОМ`,
      `В ${(regionById(rev.region) || {}).loc || 'области'} ваши здания работают вполсилы, а покупателей меньше — пока не пройдёт квартал.`);
  }
  const value = companyValue(st);
  if (st.events.inspectionCd <= 0 && rng() < inspectionChance(e.politicalRegime, value / 1000, st.gr)) {
    const hard = hardRegime(e.politicalRegime);
    fine = Math.max(0.3, Math.max(0, st.cash) * (hard ? 0.18 : 0.07));
    st.cash -= fine;
    st.events.inspectionCd = 6;
    pushNews(st, hard ? 'К ВАМ ПРИШЛИ С ПРОВЕРКОЙ' : 'НАЛОГОВАЯ ПРОВЕРКА', hard
      ? `Обыски в офисе закончились «добровольным взносом» ${fine.toFixed(1)} млн в фонд поддержки региона.`
      : `Доначислено налогов и штрафов на ${fine.toFixed(1)} млн.`);
  } else st.events.inspectionCd = Math.max(0, st.events.inspectionCd - 1);
  if (st.events.strikeCd <= 0 && st.buildings.length && rng() < strikeChance(st.wagePremium, e.unemployment)) {
    const target = [...st.buildings].sort((a, b) => (b.staff || 0) - (a.staff || 0))[0];
    st.events.strike = { uid: target.uid, until: st.t + 30 };
    st.events.strikeCd = 6;
    pushNews(st, 'ЗАБАСТОВКА НА ВАШЕМ ПРЕДПРИЯТИИ',
      `${BLD[target.type].name} (${regionName(target.region)}) почти встал на полминуты: люди требуют индексации. Надбавка к зарплате снимет напряжение.`);
  } else st.events.strikeCd = Math.max(0, st.events.strikeCd - 1);

  // кассовый разрыв: банк закрывает в пределах лимита, иначе — счёт кварталов до банкротства
  if (st.cash < 0) {
    const lim = creditLimitT(st);
    const extra = Math.min(-st.cash, lim);
    if (extra > 0) { st.cash += extra; st.debtRub += extra; pushLog(st, `Кассовый разрыв закрыт экстренным кредитом ${extra.toFixed(1)} млн.`); }
  }
  st.distress = st.cash < 0 ? st.distress + 1 : 0;
  if (st.distress === 1) pushNews(st, 'КОМПАНИЯ ЗАДЕРЖИВАЕТ ПЛАТЕЖИ', 'Денег нет даже с кредитом. Ещё квартал — и кредиторы пойдут в суд.');
  if (st.distress >= 2) { st.bankrupt = true; pushNews(st, 'КОМПАНИЯ ПРИЗНАНА БАНКРОТОМ', 'Суд ввёл внешнее управление.'); }

  const profit = pretax - tax - fine;
  st.history = [...st.history, { q: qi, label: quarterLabel(qi), revenue: q.revenue, retail: q.retail, wholesale: q.wholesale,
    exports: q.exports, wages: q.wages, upkeep: q.upkeep, purchases: q.purchases, transport: q.transport,
    ebitda, interest, principal, tax, fine, profit, cash: st.cash, debt: totalDebtT(st), value: 0, offline: offline || undefined }].slice(-60);
  st.quarter = emptyQuarter();
  st.history[st.history.length - 1].value = companyValue(st);
  return st;
}

/* ------------------------------ ФИНАНСЫ ------------------------------ */
export const totalDebtT = (st) => st.debtRub + st.debtFx * fxRate(economyOf(st));
export function annualEbitda(st) {
  const h = st.history.slice(-2);
  if (h.length) return (h.reduce((a, x) => a + x.ebitda, 0) / h.length) * 4;
  // первый квартал: по текущему темпу, но вполовину — рынок не верит разгону, пока нет отчётности
  return (st.stats.income - st.stats.costs) * QUARTER_SEC * 4 * 0.5;
}
// банк даёт под годовую EBITDA; новичку — небольшой стартовый лимит
export function creditLimitT(st) {
  const e = economyOf(st);
  const k = creditMultiple(e) * (has(st, 'finance_dept') ? 2 : 1);
  return Math.max(0, Math.max(0, annualEbitda(st)) * k + 3 * k / 3.5 - totalDebtT(st));
}
export function companyValue(st) {
  const e = economyOf(st);
  const assets = st.buildings.reduce((a, b) => {
    let c = BLD[b.type].cost; for (let l = 1; l < b.level; l++) c += BLD[b.type].cost * Math.pow(1.9, l);
    return a + c;
  }, 0);
  return Math.max(0, Math.max(0, annualEbitda(st)) * evMultiple(e) + assets * 0.5 + st.cash - totalDebtT(st));
}
export const ownerWealth = (st) => companyValue(st) * 100 / Math.max(1, economyOf(st).priceLevel || 100);

/* ------------------------------ ДЕЙСТВИЯ ИГРОКА ------------------------------
   Каждое возвращает { st } при успехе или { error } — чтобы экран мог объяснить отказ. */
export function canBuild(st, type, region) {
  const d = BLD[type];
  if (!d) return 'Нет такого здания';
  if (d.unlock && !has(st, d.unlock)) return `Нужно исследование «${RSR[d.unlock].name}»`;
  if (!regionsOpen(st).includes(region)) return 'Эта область сейчас не ваша страна';
  if (siteBonus(type, region) == null) return 'Здесь это не построить';
  if (usedIn(st, region) >= slotsIn(st, region)) return 'В области нет свободных участков';
  if (st.cash < d.cost) return 'Не хватает денег';
  return null;
}
export function build(st, type, region) {
  const err = canBuild(st, type, region);
  if (err) return { error: err };
  const d = BLD[type];
  const next = { ...st, cash: st.cash - d.cost, quarter: { ...st.quarter, capex: (st.quarter.capex || 0) + d.cost },
    buildings: [...st.buildings, { uid: newUid(), type, region, level: 1, staff: 0, enabled: true }] };
  return { st: checkMilestones(next) };
}
export function upgrade(st, uid) {
  const b = st.buildings.find((x) => x.uid === uid);
  if (!b) return { error: 'Здание не найдено' };
  if (b.level >= MAX_LEVEL) return { error: 'Максимальный уровень' };
  const c = upgradeCost(b);
  if (st.cash < c) return { error: 'Не хватает денег' };
  return { st: checkMilestones({ ...st, cash: st.cash - c, quarter: { ...st.quarter, capex: (st.quarter.capex || 0) + c },
    buildings: st.buildings.map((x) => (x.uid === uid ? { ...x, level: x.level + 1 } : x)) }) };
}
// продажа здания возвращает треть вложенного
export function demolish(st, uid) {
  const b = st.buildings.find((x) => x.uid === uid);
  if (!b) return { error: 'Здание не найдено' };
  let c = BLD[b.type].cost; for (let l = 1; l < b.level; l++) c += BLD[b.type].cost * Math.pow(1.9, l);
  return { st: { ...st, cash: st.cash + c / 3, buildings: st.buildings.filter((x) => x.uid !== uid) } };
}
export const toggle = (st, uid) => ({ st: { ...st, buildings: st.buildings.map((x) => (x.uid === uid ? { ...x, enabled: !x.enabled } : x)) } });
export function buySlot(st, region) {
  const c = slotCost(st, region);
  if (st.cash < c) return { error: 'Не хватает денег' };
  return { st: { ...st, cash: st.cash - c, slots: { ...st.slots, [region]: (st.slots[region] || 0) + 1 } } };
}
// каждое следующее исследование дороже: открыть всё за один вечер нельзя
export const researchCost = (st, id) => Math.round(RSR[id].cost * (1 + 0.2 * Object.keys(st.research).length));
export function canResearch(st, id) {
  const r = RSR[id];
  if (!r) return 'Нет такого исследования';
  if (has(st, id)) return 'Уже изучено';
  const missing = reqsOf(r).filter((x) => !has(st, x));
  if (missing.length) return `Сначала «${missing.map((x) => RSR[x].name).join('» и «')}»`;
  if (st.rp < researchCost(st, id)) return 'Не хватает очков исследований';
  return null;
}
export function research(st, id) {
  const err = canResearch(st, id);
  if (err) return { error: err };
  const next = { ...st, rp: st.rp - researchCost(st, id), research: { ...st.research, [id]: true } };
  pushLog(next, `Изучено: ${RSR[id].name}. ${RSR[id].desc}`);
  return { st: next };
}
export function borrow(st, amount, fx = false) {
  const lim = creditLimitT(st);
  const a = Math.min(amount, lim);
  if (a <= 0) return { error: 'Банк больше не даёт' };
  const e = economyOf(st);
  const next = { ...st, cash: st.cash + a };
  if (fx) next.debtFx = st.debtFx + a / fxRate(e);
  else {
    next.loanRate = (st.debtRub * st.loanRate + a * rubLoanRate(e)) / (st.debtRub + a);
    next.debtRub = st.debtRub + a;
  }
  return { st: next };
}
export function repay(st, amount) {
  const e = economyOf(st);
  let a = Math.min(amount, Math.max(0, st.cash), totalDebtT(st));
  if (a <= 0) return { error: 'Нечем гасить' };
  const next = { ...st, cash: st.cash - a };
  // сначала валютный долг: курсовой риск дороже
  const fxPart = Math.min(a, st.debtFx * fxRate(e));
  next.debtFx = st.debtFx - fxPart / fxRate(e); a -= fxPart;
  next.debtRub = Math.max(0, st.debtRub - a);
  return { st: next };
}
export const setField = (st, patch) => ({ st: { ...st, ...patch } });
export const setMap = (st, field, id, value) => ({ st: { ...st, [field]: { ...st[field], [id]: value },
  flags: { ...st.flags, [`touched_${field}`]: true } } });

/* ------------------------------ ВЕХИ И РЕПУТАЦИЯ ------------------------------ */
export const MILESTONES = [
  { id: 'first_build', title: 'Первая стройка', test: (st) => st.buildings.length >= 4 },
  { id: 'chain_bread', title: 'Хлеб от поля до полки', test: (st) => ['farm', 'mill', 'bakery', 'shop'].every((t) => st.buildings.some((b) => b.type === t)) },
  { id: 'three_regions', title: 'Три области', test: (st) => new Set(st.buildings.map((b) => b.region)).size >= 3 },
  { id: 'steel', title: 'Своя сталь', test: (st) => st.buildings.some((b) => b.type === 'steelworks') },
  { id: 'exporter', title: 'Экспортёр', test: (st) => st.buildings.some((b) => b.type === 'terminal') },
  { id: 'ten_buildings', title: 'Десять зданий', test: (st) => st.buildings.length >= 10 },
  { id: 'level5', title: 'Флагман: здание 5-го уровня', test: (st) => st.buildings.some((b) => b.level >= 5) },
  { id: 'value100', title: 'Компания дороже 250 млн', test: (st) => companyValue(st) >= 250 },
  { id: 'value1000', title: 'Миллиардер', test: (st) => companyValue(st) >= 1000 },
  { id: 'takeover', title: 'Поглощение', test: (st) => !!(st.flags && st.flags.boughtRival) },
];
export function checkMilestones(st) {
  let out = st;
  MILESTONES.forEach((m) => {
    if (!out.milestones[m.id] && m.test(out)) {
      out = { ...out, milestones: { ...out.milestones, [m.id]: true } };
      pushLog(out, `Веха: ${m.title}.`);
    }
  });
  return out;
}

export const SELL_MIN_VALUE = 2000;
// репутация за проданную компанию: +10% ко всему в следующем деле за каждый пункт
export const legacyFor = (value) => Math.floor(Math.sqrt(Math.max(0, value) / 200));

/* ------------------------------ КОНКУРЕНТЫ ------------------------------
   Вы не одни на рынке. Компании-боты делят с вами покупателей в областях (у кого
   больше полок и ниже цены — тому больше людей), сбивают оптовые цены, переманивают
   работников. Каждый квартал решают: расширяться, начать ценовую войну, держать цены
   или отступать. Разорившийся уходит с рынка; ослабевшего можно купить; с любым —
   попробовать договориться о ценах, рискуя штрафом антимонопольной службы.
   shops — полки в области в тех же единицах, что у магазина игрока (магазин = 1,5);
   supplies — сколько единиц в секунду конкурент продаёт на оптовый рынок. */
export const RIVALS = [
  { id: 'kolos', name: 'Хлебный дом «Колос»', short: 'Колос', color: 'rust', goods: ['bread'], supplies: { flour: 0.5, grain: 1 },
    start: { agri: 1.5, finance: 1.5 }, entry: 0, cash: 6, style: 'defensive', maxCap: 12,
    about: 'Местная пекарная сеть. Цены держит спокойные, но за свою долю хлеба будет драться.' },
  { id: 'severoles', name: 'Северолес', short: 'Северолес', color: 'teal', goods: ['furniture'], supplies: { boards: 0.6, wood: 1 },
    start: { periphery: 1.5, industry: 1.5 }, entry: 2, cash: 10, style: 'steady', maxCap: 12,
    about: 'Лесопромышленный холдинг: доски на оптовом рынке и мебельные салоны по всей стране.' },
  { id: 'stal', name: 'Стальной союз', short: 'Стальсоюз', color: 'muted', goods: [], supplies: { steel: 0.35, ore: 0.9, coal: 0.9, machines: 0.08 },
    start: {}, entry: 3, cash: 30, style: 'steady', maxCap: 0,
    about: 'Металлургический комбинат. Магазинов нет — зато его руда, уголь и сталь сбивают оптовые цены, если вы льёте туда же.' },
  { id: 'westra', name: 'Вестравский ритейл', short: 'Вестра', color: 'blue', goods: ['bread', 'furniture', 'appliances'], supplies: {},
    start: { capital: 3 }, entry: 6, cash: 40, style: 'aggressive', foreign: true, maxCap: 12,
    about: 'Сеть гипермаркетов из Вестравии на дешёвых деньгах: заходит ценой и годами терпит убытки. Санкции против Вестравии или плохие отношения с ней её выгоняют.' },
];
export const RIVAL = Object.fromEntries(RIVALS.map((r) => [r.id, r]));
const RIVAL_SHOP = 1.5;
const RIVAL_SHOP_COST = 6;
export const RIVAL_MODE_LABEL = { wait: 'ещё не на рынке', grow: 'расширяется', hold: 'держит цены', war: 'ценовая война', retreat: 'отступает',
  cartel: 'сговор с вами', gone: 'ушёл с рынка', bought: 'куплен вами' };

export function makeRivals() {
  return RIVALS.map((r) => ({ id: r.id, cash: r.cash, shops: { ...r.start }, markup: 8, mode: 'wait', modeQ: 0, distress: 0,
    alive: true, entered: false, supply: { ...r.supplies }, profitQ: 0, warned: false }));
}
const liveRivals = (st) => (st.rivals || []).filter((c) => c.alive && c.entered);
const rivalCap = (c) => Object.values(c.shops || {}).reduce((a, v) => a + v, 0);

// на сколько процентов цены конкурентов ниже или выше ваших — отношение привлекательности
const priceRel = (st, c, g) => Math.pow((1 + (st.markup[g] || 0) / 100) / (1 + c.markup / 100), RES[g].elast * 1.5);

/* Как делятся покупатели товара g в области: доля игрока при его полках P (единиц в
   секунду) и полки конкурентов, взвешенные ценой. Возвращает долю игрока и по каждому
   конкуренту — сколько единиц в секунду он продаёт. */
export function marketSplit(st, region, g, P) {
  const rivals = liveRivals(st).filter((c) => RIVAL[c.id].goods.includes(g) && (c.shops[region] || 0) > 0);
  const weights = rivals.map((c) => (c.shops[region] / RIVAL[c.id].goods.length) * priceRel(st, c, g));
  const R = weights.reduce((a, v) => a + v, 0);
  const share = P + R > 0 ? P / (P + R) : 1;
  // спрос, который конкурент видит по своей цене — без вашего бренда и репутации
  const base = rawDemand(st, region, g);
  const list = rivals.map((c, i) => {
    const dem = base * Math.pow(1 + c.markup / 100, -RES[g].elast);
    const want = dem * (weights[i] / Math.max(1e-9, P + R));
    return { id: c.id, rate: Math.min(want, c.shops[region] / RIVAL[c.id].goods.length) };
  });
  return { share, rivals: list };
}
// спрос области на товар без учёта цены и бренда игрока — «рынок» как таковой
function rawDemand(st, region, id) {
  const r = RES[id]; const e = economyOf(st);
  if (!r.consumer) return 0;
  const macro = r.consumer === 'food' ? Math.pow(demandIndex('retail', e), 0.5)
    : r.consumer === 'housing' ? demandIndex('builder', e)
      : demandIndex('retail', e) * Math.exp(-0.03 * ((e.lendingRate ?? 7.92) - 7.92));
  const reg = regionById(region);
  const stress = reg ? regionStress(reg, e) : 30;
  return r.demand * (POP[region] || 0.05) * macro * clamp(1.15 - stress / 200, 0.6, 1.15);
}
/* Где торговать. Для каждой области — сколько выручки в минуту принёс бы ещё один
   магазин: покупатели области, доля, которую отдадут конкуренты, и полки, которые у
   вас там уже стоят. Раньше этого не было видно вовсе: магазины ставились наугад. */
const shopRevenue = (st, region, P, goods) => {
  if (P <= 0) return 0;
  const rows = goods.map((g) => {
    const d = regionDemand(st, region, g.id) * marketSplit(st, region, g.id, P).share;
    return [d, retailPrice(st, g.id)];
  });
  const units = rows.reduce((a, [d]) => a + d, 0);
  const k = units > P ? P / units : 1; // полок меньше, чем покупателей, — продаётся столько, сколько влезет
  return rows.reduce((a, [d, p]) => a + d * p * k, 0);
};
export function shopOpportunities(st) {
  const cap = {};
  st.buildings.forEach((b) => { const d = BLD[b.type]; if (d.sells) cap[b.region] = (cap[b.region] || 0) + d.sells * buildingPower(st, b); });
  const one = BLD.shop.sells;
  // считаем по товарам, которые у вас есть или производятся; нет ни одного — по всем
  const made = new Set(st.buildings.flatMap((b) => Object.keys(BLD[b.type].out || {})));
  const all = RESOURCES.filter((r) => r.consumer);
  const own = all.filter((g) => made.has(g.id) || (st.stock[g.id] || 0) > 0.5);
  const goods = own.length ? own : all;
  return regionsOpen(st).map((region) => {
    const P = cap[region] || 0;
    const now = shopRevenue(st, region, P, goods);
    const gain = shopRevenue(st, region, P + one, goods) - now;
    const buyers = RESOURCES.filter((r) => r.consumer).reduce((a, g) => a + rawDemand(st, region, g.id), 0);
    const rivalShelves = liveRivals(st).reduce((a, c) => a + (c.shops[region] || 0), 0);
    return { region, gain: Math.max(0, gain) * 60, now: now * 60, buyers: buyers * 60, mine: P, rivals: rivalShelves, goods: goods.map((g) => g.name) };
  }).sort((a, b) => b.gain - a.gain);
}
/* Экспорт: по каждому экспортному товару — мировая цена по курсу против оптовой внутри
   страны. Разница и есть смысл терминала; санкции и война её съедают. */
export function exportOpportunities(st) {
  const ports = regionsOpen(st).filter((r) => siteBonus('terminal', r) != null);
  return RESOURCES.filter((r) => r.export).map((r) => {
    const world = exportPrice(st, r.id); const home = sellPrice(st, r.id);
    return { id: r.id, name: r.name, world, home, edge: home > 0 ? world / home - 1 : 0, have: (st.stock[r.id] || 0) > 0.5 };
  }).sort((a, b) => b.edge - a.edge).map((x) => ({ ...x, ports }));
}

// сколько всего конкуренты льют на оптовый рынок этого товара
export const rivalSupply = (st, id) => liveRivals(st).reduce((a, c) => a + ((c.supply || {})[id] || 0), 0);
// конкуренты в области переманивают людей: зарплаты там выше
export const rivalWageK = (st, region) => clamp(1 + 0.04 * liveRivals(st).reduce((a, c) => a + (c.shops[region] || 0), 0) / RIVAL_SHOP, 1, 1.3);

// ваша доля по каждому товару, который продают и конкуренты (сглаженная, для экрана)
export function marketShares(st) {
  const out = {};
  RESOURCES.filter((r) => r.consumer).forEach((r) => {
    const mine = (st.stats.rates[r.id] || {}).sold || 0;
    const theirs = st.stats.rivalSold ? st.stats.rivalSold[r.id] || {} : {};
    const total = mine + Object.values(theirs).reduce((a, v) => a + v, 0);
    if (total > 1e-6) out[r.id] = { mine: mine / total, rivals: Object.fromEntries(Object.entries(theirs).map(([k, v]) => [k, v / total])) };
  });
  return out;
}

// цена поглощения: полки, деньги и прибыль; в беде — дешевле, здоровый просит премию
export function rivalPrice(st, id) {
  const c = (st.rivals || []).find((x) => x.id === id);
  if (!c) return Infinity;
  const base = rivalCap(c) / RIVAL_SHOP * RIVAL_SHOP_COST * priceIdx(economyOf(st)) + Math.max(0, c.cash) + Math.max(0, c.profitQ) * 6
    + Object.values(c.supply || {}).reduce((a, v) => a + v, 0) * 6;
  const mood = c.distress > 0 || c.mode === 'retreat' ? 0.6 : 1.4;
  return Math.max(2, base * mood * (RIVAL[id].foreign ? 1.6 : 1));
}
export function canBuyRival(st, id) {
  const c = (st.rivals || []).find((x) => x.id === id);
  if (!c || !c.alive) return 'Этой компании уже нет';
  if (!c.entered) return 'Компания ещё не вышла на рынок';
  if (RIVAL[id].foreign && c.distress === 0) return 'Вестравцы здоровую сеть не продают — только если она в беде';
  if (st.cash < rivalPrice(st, id)) return 'Не хватает денег';
  return null;
}
// поглощение: полки конкурента становятся вашими магазинами (с участками под них)
export function buyRival(st, id) {
  const err = canBuyRival(st, id);
  if (err) return { error: err };
  const price = rivalPrice(st, id);
  const c = st.rivals.find((x) => x.id === id);
  const buildings = [...st.buildings]; const slots = { ...st.slots };
  const open = regionsOpen(st);
  Object.entries(c.shops).forEach(([region, cap]) => {
    if (!open.includes(region)) return;
    const n = Math.max(1, Math.round(cap / RIVAL_SHOP));
    for (let i = 0; i < n; i++) buildings.push({ uid: newUid(), type: 'shop', region, level: 1, staff: requiredStaff(st, { type: 'shop', level: 1 }), enabled: true });
    const over = buildings.filter((b) => b.region === region).length - slotsIn(st, region);
    if (over > 0) slots[region] = (slots[region] || 0) + over;
  });
  const next = { ...st, cash: st.cash - price, buildings, slots,
    rivals: st.rivals.map((x) => (x.id === id ? { ...x, alive: false, mode: 'bought', shops: {}, supply: {} } : x)),
    milestones: { ...st.milestones } };
  pushNews(next, `ВЫ КУПИЛИ «${RIVAL[id].short.toUpperCase()}»`, `Сделка на ${price.toFixed(1)} млн: магазины конкурента теперь ваши, его покупатели — тоже.`);
  return { st: checkMilestones({ ...next, flags: { ...next.flags, boughtRival: true } }) };
}
// сговор о ценах: оба держат цены высокими, но антимонопольная служба может заметить
export function cartelChance(st, id) {
  const c = (st.rivals || []).find((x) => x.id === id);
  if (!c) return 0;
  const st0 = RIVAL[id].style;
  return clamp((st0 === 'defensive' ? 0.6 : st0 === 'steady' ? 0.45 : 0.15) + (c.distress > 0 ? 0.25 : 0) + (c.mode === 'war' ? 0.1 : 0), 0.05, 0.9);
}
export const cartelFineRisk = (st) => {
  const reg = economyOf(st).politicalRegime;
  return (hardRegime(reg) ? 0.08 : 0.22) * (st.gr ? 0.6 : 1);
};
export function proposeCartel(st, id) {
  const c = (st.rivals || []).find((x) => x.id === id);
  if (!c || !c.alive || !c.entered) return { error: 'Не с кем договариваться' };
  if (!RIVAL[id].goods.length) return { error: 'Этот конкурент торгует оптом — о розничных ценах с ним не договориться' };
  if (c.mode === 'cartel') return { error: 'Договорённость уже действует' };
  if ((st.events.cartelCd || 0) > 0) return { error: 'После прошлого отказа вас не станут слушать ещё квартал' };
  const ok = rng() < cartelChance(st, id);
  const next = { ...st, events: { ...st.events },
    rivals: st.rivals.map((x) => (x.id === id && ok ? { ...x, mode: 'cartel', modeQ: 4, markup: 15 } : x)) };
  if (ok) {
    pushNews(next, `ТИХАЯ ДОГОВОРЁННОСТЬ С «${RIVAL[id].short.toUpperCase()}»`, 'Год обе компании держат цены высокими. Опустите свои ниже рынка — договорённость рухнет, а антимонопольная служба может заинтересоваться в любой квартал.');
  } else {
    next.events.cartelCd = 1;
    pushNews(next, `«${RIVAL[id].short.toUpperCase()}» ОТВЕРГ ПРЕДЛОЖЕНИЕ`, 'Конкурент не стал договариваться о ценах — и теперь знает, что вам тесно.');
  }
  return { st: next, ok };
}

/* Квартал конкурентов: выход на рынок, прибыль, решение, что делать дальше. */
function rivalsQuarter(st) {
  const e = economyOf(st);
  const age = st.country.quarterIndex - (st.startQ || 1);
  const pIdx = priceIdx(e);
  const playerCap = {};
  st.buildings.forEach((b) => { const d = BLD[b.type]; if (d.sells) playerCap[b.region] = (playerCap[b.region] || 0) + d.sells * buildingPower(st, b); });
  const shares = marketShares(st);
  const westHostile = (e.sanctionsQuartersLeft || 0) > 0 || ((e.relations || {}).west ?? 64) < 25;
  const open = regionsOpen(st);
  st.rivals = (st.rivals || makeRivals()).map((c0) => {
    const def = RIVAL[c0.id];
    const c = { ...c0, shops: { ...c0.shops }, supply: { ...c0.supply } };
    if (!c.alive) return c;
    if (!c.entered) {
      if (age < def.entry || (def.foreign && westHostile)) return c;
      c.entered = true; c.mode = 'grow';
      pushNews(st, `НА РЫНОК ВЫХОДИТ «${def.short.toUpperCase()}»`, `${def.about}${def.goods.length ? ` Первые магазины: ${Object.keys(c.shops).map(regionName).join(', ')}.` : ''}`);
      return c;
    }
    if (def.foreign && westHostile) {
      c.alive = false; c.mode = 'gone'; c.shops = {};
      pushNews(st, `«${def.short.toUpperCase()}» УХОДИТ ИЗ СТРАНЫ`, 'Отношения с Вестравией испорчены — сеть закрывает магазины. Её покупатели ищут, где купить.');
      return c;
    }
    // прибыль квартала: розница (наценка над оптом) и опт, минус содержание полок
    let sales = 0;
    def.goods.forEach((g) => open.forEach((region) => {
      if (!(c.shops[region] > 0)) return;
      const split = marketSplit(st, region, g, playerCap[region] || 0);
      const mine = split.rivals.find((x) => x.id === c.id);
      if (mine) sales += mine.rate * marketPrice(st, g) * (0.15 + c.markup / 100);
    }));
    Object.entries(c.supply).forEach(([r, v]) => { sales += v * sellPrice(st, r) * 0.12; });
    const upkeep = rivalCap(c) / RIVAL_SHOP * 0.1 * pIdx;
    c.profitQ = sales * QUARTER_SEC - upkeep + (def.foreign ? 0.4 : 0);
    // сверх запаса на развитие владельцы забирают дивидендами — конкурент не копит сотни миллионов
    c.cash = Math.min(c.cash + c.profitQ, (def.foreign ? 30 : 12) + rivalCap(c) * 3);
    c.distress = c.cash < 0 ? c.distress + 1 : 0;
    // оптовики отходят, когда вы льёте на рынок больше них, и подтягиваются, когда рынок пуст
    Object.keys(c.supply).forEach((r) => {
      const mine = st.stats.sellEma[r] || 0;
      c.supply[r] = clamp(c.supply[r] * (mine > c.supply[r] ? 0.85 : 1.06), 0.05, (def.supplies[r] || 0.1) * 2.5);
    });
    const share = def.goods.length ? Math.max(0, ...def.goods.map((g) => (shares[g] ? shares[g].mine : 0))) : 0;
    const warAt = def.style === 'aggressive' ? 0.35 : def.style === 'defensive' ? 0.55 : 0.65;
    const baseMarkup = def.style === 'aggressive' ? 0 : 8;
    if (c.distress >= 3 || c.cash < -8) {
      c.alive = false; c.mode = 'gone'; c.shops = {}; c.supply = {};
      pushNews(st, `«${def.short.toUpperCase()}» УШЁЛ С РЫНКА`, 'Конкурент не выдержал: магазины закрыты, его покупатели теперь ищут, где купить.');
      return c;
    }
    if (c.mode === 'cartel') {
      c.modeQ -= 1; c.markup = 15;
      // вы нарушили договорённость — цены ниже рынка
      const broke = def.goods.some((g) => (st.markup[g] || 0) < 5);
      if (broke || c.modeQ <= 0) {
        c.mode = broke ? 'war' : 'hold'; c.modeQ = broke ? 3 : 0;
        pushNews(st, broke ? `«${def.short.toUpperCase()}»: ВЫ НАРУШИЛИ ДОГОВОР` : `ДОГОВОРЁННОСТЬ С «${def.short.toUpperCase()}» ИСТЕКЛА`,
          broke ? 'Вы опустили цены — конкурент отвечает ценовой войной.' : 'Год прошёл, каждый снова сам по себе.');
      }
      return c;
    }
    if (c.distress >= 1) {
      c.mode = 'retreat'; c.markup = baseMarkup + 6;
      const worst = Object.keys(c.shops).sort((a, b) => (POP[a] || 0) - (POP[b] || 0))[0];
      if (worst && c.shops[worst] > 0) { c.shops[worst] = Math.max(0, c.shops[worst] - RIVAL_SHOP); if (!c.shops[worst]) delete c.shops[worst]; }
      if (!c.warned) { c.warned = true; pushNews(st, `«${def.short.toUpperCase()}» В ДОЛГАХ`, 'Конкурент закрывает магазины. Сейчас его можно купить дешевле обычного.'); }
      return c;
    }
    c.warned = false;
    // запас на войну: три квартала содержания полок и ещё немного — в убыток торговать дорого
    const warChest = 3 * upkeep + 3;
    if (c.mode === 'war' && c.modeQ > 0) {
      c.modeQ -= 1;
      // деньги кончаются раньше срока — война сворачивается, а не доводит конкурента до долгов
      if (c.cash < warChest / 3 && c.profitQ < 0) {
        c.mode = 'hold'; c.modeQ = 0; c.markup = baseMarkup;
        pushNews(st, `«${def.short.toUpperCase()}» СВОРАЧИВАЕТ ЦЕНОВУЮ ВОЙНУ`, 'Торговать в убыток дальше конкуренту не на что — цены возвращаются к рыночным.');
        return c;
      }
      if (c.modeQ <= 0) c.mode = 'hold';
      return c;
    }
    /* Ценовую войну объявляет только тот, кому есть чем её оплатить: заметная прибыль
       и запас денег на три квартала торговли в убыток. Раньше хватало трёх миллионов
       на счёте — и войну начинала сеть, которая сама еле сводила концы с концами. */
    const comfy = c.profitQ > Math.max(0.5, upkeep * 0.5);
    if (def.goods.length && share > warAt && comfy && c.cash > warChest) {
      c.mode = 'war'; c.modeQ = 3; c.markup = def.style === 'aggressive' ? -20 : def.style === 'defensive' ? -12 : -8;
      pushNews(st, `«${def.short.toUpperCase()}» НАЧИНАЕТ ЦЕНОВУЮ ВОЙНУ`, `Ваша доля рынка ${Math.round(share * 100)}% — конкурент снижает цены на ${Math.abs(c.markup)}% ниже рынка. Можно ответить ценой, переждать или договориться.`);
      return c;
    }
    const cost = RIVAL_SHOP_COST * pIdx;
    /* расширяться — только в прибыли, до своего размера, и туда, где рынок ещё не насыщен:
       полок (ваших и всех конкурентов) меньше, чем покупателей */
    const perRegion = def.style === 'aggressive' ? 6 : 4.5;
    const shelves = (rg) => (playerCap[rg] || 0) + liveRivals(st).reduce((a, x) => a + (x.shops[rg] || 0), 0);
    const hungry = (rg) => shelves(rg) < def.goods.reduce((a, g) => a + rawDemand(st, rg, g), 0) * 1.3;
    if (def.goods.length && c.cash > cost * 2 && c.profitQ > 0.3 && rivalCap(c) < def.maxCap && rng() < 0.6) {
      // агрессивный идёт туда, где сильнее всего вы; остальные — где людей больше, а их меньше
      const cand = open.filter((rg) => (POP[rg] || 0) > 0.04 && (c.shops[rg] || 0) < perRegion && hungry(rg));
      const pick = def.style === 'aggressive'
        ? cand.sort((a, b) => (playerCap[b] || 0) - (playerCap[a] || 0) || (POP[b] - POP[a]))[0]
        : cand.sort((a, b) => (POP[b] / (1 + (c.shops[b] || 0))) - (POP[a] / (1 + (c.shops[a] || 0))))[0];
      if (pick) {
        c.shops[pick] = (c.shops[pick] || 0) + RIVAL_SHOP; c.cash -= cost; c.mode = 'grow';
        pushNews(st, `«${def.short.toUpperCase()}» ОТКРЫЛ МАГАЗИН: ${regionName(pick).toUpperCase()}`,
          (playerCap[pick] || 0) > 0 ? 'Прямо рядом с вашими — покупателей там станет меньше.' : 'Область, где вас пока нет.');
      }
      return c;
    }
    c.mode = 'hold';
    c.markup += 0.5 * (baseMarkup - c.markup);
    return c;
  });
  // сговор: штраф может прийти в любой квартал, пока договорённость действует
  if (st.rivals.some((c) => c.mode === 'cartel') && rng() < cartelFineRisk(st)) {
    const fine = Math.max(0.5, Math.max(0, st.cash) * 0.15);
    st.cash -= fine;
    st.rivals = st.rivals.map((c) => (c.mode === 'cartel' ? { ...c, mode: 'hold', modeQ: 0 } : c));
    pushNews(st, 'АНТИМОНОПОЛЬНАЯ СЛУЖБА: ШТРАФ ЗА СГОВОР', `Переписка с конкурентом попала к регулятору. Штраф ${fine.toFixed(1)} млн, договорённость разорвана.`);
  }
  st.events.cartelCd = Math.max(0, (st.events.cartelCd || 0) - 1);
}

/* ------------------------------ ОФЛАЙН ------------------------------
   Пока вкладка закрыта, страна стоит на паузе, а предприятия работают без присмотра —
   вполсилы. Не больше трёх часов. */
export function catchUp(st, now = Date.now()) {
  const away = clamp((now - (st.savedAt || now)) / 1000, 0, OFFLINE_CAP_SEC);
  if (away < 30 || st.bankrupt) return { st, away: 0, earned: 0 };
  const cash0 = st.cash;
  let next = st;
  let left = away;
  while (left > 0) { const s = Math.min(left, 5); next = tick(next, s, { offline: true }); left -= s; }
  return { st: next, away, earned: next.cash - cash0 };
}

export function snapshotTycoon(st) {
  return { ...st, savedAt: Date.now(), country: { ...st.country, prev: undefined } };
}
export function validateTycoon(data) {
  return !!(data && data.mode === 'tycoon' && data.country && data.country.economy && Array.isArray(data.buildings));
}

/* ------------------------------ МЕНЕДЖЕРЫ ------------------------------
   Инкрементальная автоматизация: нанятый менеджер каждые пять секунд делает то, что
   игрок делал бы руками. У каждого — зарплата (растёт вместе с компанией и рыночными
   зарплатами) и бюджет: какую долю денег на счёте ему можно тратить за раз. */
export const MANAGERS = [
  { id: 'foreman', name: 'Управляющий производством', unlock: 'management', hire: 5, salary: 0.004, spends: true,
    desc: 'Улучшает здания, которые работают в полную силу, — самое дешёвое улучшение в пределах бюджета.' },
  { id: 'trader', name: 'Коммерческий директор', unlock: 'management', hire: 4, salary: 0.003,
    desc: 'Ведёт склад и цены: продаёт то, что копится, докупает, чего не хватает цехам, отправляет на экспорт, когда там дороже, двигает цены в магазинах по спросу.' },
  { id: 'scientist', name: 'Главный технолог', unlock: 'management', hire: 6, salary: 0.003,
    desc: 'Изучает самое дешёвое из доступных исследований, как только хватает очков.' },
  { id: 'developer', name: 'Директор по развитию', unlock: 'board', hire: 25, salary: 0.012, spends: true,
    desc: 'Строит: производство сырья, которого не хватает цехам, и магазины там, где спрос не обслужен; докупает участки.' },
  { id: 'cfo', name: 'Финансовый директор', unlock: 'board', hire: 20, salary: 0.008,
    desc: 'Гасит долг из лишних денег, не даёт урезать зарплаты до забастовки, включает работу с властями при жёстком режиме.' },
];
export const MGR = Object.fromEntries(MANAGERS.map((m) => [m.id, m]));
const salaryOf = (st, m) => m.salary * (1 + st.buildings.length / 8) * st.wageIdx;
export function managerSalary(st) {
  return Object.entries(st.managers || {}).reduce((a, [id, x]) => a + (x && x.on !== false && MGR[id] ? salaryOf(st, MGR[id]) : 0), 0);
}
export const managerSalaryOf = (st, id) => salaryOf(st, MGR[id]);
export function hireManager(st, id) {
  const m = MGR[id];
  if (!m) return { error: 'Нет такой должности' };
  if (st.managers && st.managers[id]) return { error: 'Уже нанят' };
  if (!has(st, m.unlock)) return { error: `Нужно исследование «${RSR[m.unlock].name}»` };
  if (st.cash < m.hire) return { error: 'Не хватает денег на подбор' };
  const next = { ...st, cash: st.cash - m.hire, managers: { ...st.managers, [id]: { on: true, budget: 30 } } };
  pushLog(next, `Нанят: ${m.name}.`);
  return { st: next };
}
export const fireManager = (st, id) => {
  const m = { ...st.managers }; delete m[id];
  return { st: { ...st, managers: m } };
};
export const setManager = (st, id, patch) => ({ st: { ...st, managers: { ...st.managers, [id]: { ...st.managers[id], ...patch } } } });
const mgrOn = (st, id) => !!(st.managers && st.managers[id] && st.managers[id].on !== false);
/* Бюджет менеджера — на квартал, а не на одно решение: иначе 20% «за раз» при каждом
   решении раз за разом сводили счёт к нулю. Лимит считается от денег на момент первой
   траты в квартале, и два квартала расходов менеджер не трогает никогда. */
export function mgrBudget(st, id) {
  const m = st.managers[id];
  const q = st.country.quarterIndex;
  const fresh = m.q !== q;
  const limit = fresh ? Math.max(0, st.cash) * clamp((m.budget ?? 30), 0, 100) / 100 : m.limit;
  const spent = fresh ? 0 : m.spent || 0;
  const floor = Math.max(0, st.stats.costs) * QUARTER_SEC * 2;
  return Math.max(0, Math.min(limit - spent, st.cash - floor));
}
function mgrSpend(st, id, amount) {
  const m = st.managers[id];
  const q = st.country.quarterIndex;
  const fresh = m.q !== q;
  const limit = fresh ? Math.max(0, st.cash + amount) * clamp((m.budget ?? 30), 0, 100) / 100 : m.limit;
  return { ...st, managers: { ...st.managers, [id]: { ...m, q, limit, spent: (fresh ? 0 : m.spent || 0) + amount } } };
}

function runManagers(prev) {
  let st = prev;
  const log = (text) => { st = { ...st }; pushLog(st, text); };
  // коммерческий директор: склад, закупки, экспорт, цены
  if (mgrOn(st, 'trader')) {
    const cap = storageCap(st);
    const inputs = new Set(); const outputs = new Set();
    st.buildings.forEach((b) => { const d = BLD[b.type]; if (d.in) Object.keys(d.in).forEach((r) => inputs.add(r)); if (d.out) Object.keys(d.out).forEach((r) => outputs.add(r)); });
    const hasTerm = st.buildings.some((b) => BLD[b.type].exports);
    const autoSell = { ...st.autoSell }; const autoBuy = { ...st.autoBuy }; const exportList = { ...st.exportList }; const markup = { ...st.markup };
    RESOURCES.forEach((r) => {
      const rate = st.stats.rates[r.id] || { prod: 0, cons: 0, sold: 0, bought: 0 };
      const stock = st.stock[r.id] || 0;
      if (outputs.has(r.id) && !r.buyOnly && stock > cap * 0.5) autoSell[r.id] = true;
      if (inputs.has(r.id) && !r.buyOnly) autoBuy[r.id] = rate.prod < rate.cons * 0.95 || stock < 1;
      if (hasTerm && r.export) exportList[r.id] = exportPrice(st, r.id) > sellPrice(st, r.id) * 1.05;
      if (r.consumer) {
        const unmet = st.stats.unmet[r.id] || 0;
        const m = markup[r.id] || 0;
        if (unmet > rate.sold * 0.15 && stock < cap * 0.2) markup[r.id] = Math.min(30, m + 2);
        else if (stock > cap * 0.5 && unmet < 0.01) markup[r.id] = Math.max(-10, m - 2);
      }
    });
    st = { ...st, autoSell, autoBuy, exportList, markup };
  }
  // главный технолог: самое дешёвое из доступного
  if (mgrOn(st, 'scientist')) {
    const avail = RESEARCH.filter((r) => !canResearch(st, r.id)).sort((a, b) => researchCost(st, a.id) - researchCost(st, b.id));
    if (avail[0]) { const r = research(st, avail[0].id); if (r.st) st = r.st; }
  }
  // управляющий: самое дешёвое улучшение работающего здания
  if (mgrOn(st, 'foreman')) {
    const budget = mgrBudget(st, 'foreman');
    const cand = st.buildings.filter((b) => b.enabled && b.level < MAX_LEVEL && (b.staff || 0) >= requiredStaff(st, b) - 0.5
      && (!BLD[b.type].out || (st.stats.runK && (st.stats.runK[b.uid] ?? 0) >= 0.9)))
      .sort((a, b) => upgradeCost(a) - upgradeCost(b))[0];
    if (cand && upgradeCost(cand) <= budget) {
      const cost = upgradeCost(cand);
      const r = upgrade(st, cand.uid);
      if (r.st) { st = mgrSpend(r.st, 'foreman', cost); log(`Управляющий улучшил: ${BLD[cand.type].name} (${regionName(cand.region)}) до ${cand.level + 1}-го уровня.`); }
    }
  }
  // директор по развитию: сырьё, которого не хватает, и магазины под спрос
  if (mgrOn(st, 'developer')) {
    const budget = mgrBudget(st, 'developer');
    const open = regionsOpen(st);
    const bestSite = (type) => open.filter((rg) => siteBonus(type, rg) != null)
      .sort((a, b) => (siteBonus(type, b) - siteBonus(type, a)) || (usedIn(st, a) - usedIn(st, b)))[0];
    const place = (type) => {
      const d = BLD[type];
      if (d.unlock && !has(st, d.unlock)) return false;
      const rg = bestSite(type);
      if (!rg) return false;
      let cost = d.cost;
      const needSlot = usedIn(st, rg) >= slotsIn(st, rg);
      if (needSlot) cost += slotCost(st, rg);
      if (cost > budget) return false;
      if (needSlot) st = buySlot(st, rg).st;
      const r = build(st, type, rg);
      if (!r.st) return false;
      st = mgrSpend(r.st, 'developer', cost); log(`Директор по развитию построил: ${d.name} (${regionName(rg)}).`);
      return true;
    };
    let done = false;
    // 1) цехам не хватает сырья — своё производство вместо закупок
    const short = RESOURCES.filter((r) => !r.buyOnly && (st.stats.rates[r.id] || {}).bought > 0.2)
      .sort((a, b) => (st.stats.rates[b.id].bought) - (st.stats.rates[a.id].bought))[0];
    if (short) {
      const producer = BUILDINGS.find((d) => d.out && d.out[short.id] && (!d.unlock || has(st, d.unlock)));
      if (producer) done = place(producer.id);
    }
    // 2) спрос в магазинах не обслужен, а товар есть
    if (!done) {
      const g = RESOURCES.filter((r) => r.consumer && (st.stats.unmet[r.id] || 0) > 0.3 && (st.stock[r.id] || 0) > 20)[0];
      if (g) {
        const shopType = has(st, 'malls') && budget > BLD.mall.cost * 2 ? 'mall' : 'shop';
        const rg = open.slice().sort((a, b) => regionDemand(st, b, g.id) - regionDemand(st, a, g.id))
          .find((x) => usedIn(st, x) < slotsIn(st, x) || slotCost(st, x) + BLD[shopType].cost <= budget);
        if (rg && BLD[shopType].cost <= budget) {
          let cost = BLD[shopType].cost;
          if (usedIn(st, rg) >= slotsIn(st, rg)) { cost += slotCost(st, rg); if (cost > budget) return st; st = buySlot(st, rg).st; }
          const r = build(st, shopType, rg);
          if (r.st) { st = mgrSpend(r.st, 'developer', cost); log(`Директор по развитию открыл: ${BLD[shopType].name} (${regionName(rg)}).`); }
        }
      }
    }
  }
  // финансовый директор: долг, зарплаты, связи во власти
  if (mgrOn(st, 'cfo')) {
    const e = economyOf(st);
    const costsQ = st.stats.costs * QUARTER_SEC;
    const spare = st.cash - Math.max(3, costsQ * 2);
    if (spare > 1 && totalDebtT(st) > 0.01) { const r = repay(st, spare * 0.5); if (r.st) st = r.st; }
    if ((e.unemployment ?? 5) < 6.5 && st.wagePremium < 0) st = { ...st, wagePremium: 0 };
    if (hardRegime(e.politicalRegime) && !st.gr) { st = { ...st, gr: true }; log('Финансовый директор включил работу с властями: режим ужесточился.'); }
  }
  return st;
}

/* ------------------------------ ЗАДАНИЯ-ОБУЧЕНИЕ ------------------------------
   Цепочка первых шагов с наградой: по одному за раз, с подсказкой, где это
   делается (tab — вкладка, которую подсветить). */
const soldToPeople = (st) => (st.lifetime ? st.lifetime.retail : 0) > 0;
export const QUESTS = [
  { id: 'build', title: 'Первая стройка', tab: 'build', reward: 1,
    text: 'Постройте любое новое здание: выберите область на карте, внизу — «Что можно построить здесь».',
    test: (st) => st.buildings.length > (st.startBuildings || 3) },
  { id: 'market', title: 'Склад и рынок', tab: 'stock', reward: 1,
    text: 'Загляните в «Склад и рынок» и настройте хотя бы один товар: продажу излишков, докупку или запас.',
    test: (st) => !!(st.flags && (st.flags.touched_autoSell || st.flags.touched_autoBuy || st.flags.touched_reserve || st.flags.touched_markup)) },
  { id: 'people', title: 'Продать людям', tab: 'build', reward: 1.5,
    text: (st) => (st.start === 'factory'
      ? 'Продайте мебель людям: постройте мебельную фабрику (лучше в Кузнецкой) и магазин — розница платит в разы больше, чем оптовики за доски.'
      : st.start === 'retail' ? 'Ваш магазин уже торгует хлебом — дождитесь первых продаж.'
        : 'Продайте хлеб людям: постройте хлебозавод и магазин (в столице больше всего покупателей) — розница платит больше оптовиков.'),
    test: soldToPeople },
  { id: 'research', title: 'Первое исследование', tab: 'lab', reward: 2,
    text: 'Изучите что-нибудь во вкладке «Исследования». Очки копятся сами, лаборатория (лучше в столице) ускоряет их в десятки раз.',
    test: (st) => Object.keys(st.research).length >= 1 },
  { id: 'upgrade', title: 'Улучшение', tab: 'prod', reward: 3,
    text: 'Улучшите любое здание до 2-го уровня: выработка ×1,5, людей нужно больше.',
    test: (st) => st.buildings.some((b) => b.level >= 2) },
  { id: 'chain', title: 'Своя цепочка', tab: 'build', reward: 5,
    text: 'Соберите цепочку от сырья до полки: ферма → мельница → хлебозавод → магазин или лес → лесопилка → мебель → магазин.',
    test: (st) => ['farm', 'mill', 'bakery', 'shop'].every((t) => st.buildings.some((b) => b.type === t))
      || ['logging', 'sawmill', 'furniture_plant', 'shop'].every((t) => st.buildings.some((b) => b.type === t)) },
  { id: 'regions', title: 'Три области', tab: 'build', reward: 6,
    text: 'Работайте в трёх областях: у каждой свои бонусы и свои покупатели. Сырьё ставьте рядом с переработкой — перевозка стоит денег.',
    test: (st) => new Set(st.buildings.map((b) => b.region)).size >= 3 },
  { id: 'manager', title: 'Первый менеджер', tab: 'money', reward: 8,
    text: 'Изучите «Кадровое агентство» и «Школу управленцев», затем наймите менеджера во вкладке «Финансы» — он возьмёт рутину на себя.',
    test: (st) => Object.keys(st.managers || {}).length >= 1 },
  { id: 'value', title: 'Компания на 500 млн', tab: 'money', reward: 25,
    text: 'Доведите стоимость компании до 500 млн. Дальше — металл, экспорт и продажа компании за репутацию.',
    test: (st) => companyValue(st) >= 500 },
];
export const currentQuest = (st) => QUESTS[st.quest || 0] || null;
export const questText = (st, q) => (typeof q.text === 'function' ? q.text(st) : q.text);
export function claimQuest(st) {
  const q = currentQuest(st);
  if (!q) return { error: 'Все задания выполнены' };
  if (!q.test(st)) return { error: 'Задание ещё не выполнено' };
  const next = { ...st, cash: st.cash + q.reward, quest: (st.quest || 0) + 1 };
  pushLog(next, `Задание «${q.title}» выполнено: +${q.reward} млн.`);
  return { st: next };
}
