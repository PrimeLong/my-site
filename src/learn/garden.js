/* САД ИНФЛИ (docs/mechanics.md, «Сад»). Семена покупают за монеты по курсу дня, как вещи в лавке;
   растение растёт само, по часам, — и пока приложение закрыто. Чем реже растение, тем дольше оно
   растёт и тем дороже семена. У собранного растения — редкость урожая (шансы на экране не пишем):
   его можно оставить в гербарии или продать на рынке. Цена — цена семян × редкость, и она падает
   с каждой продажей того же растения за день: спрос насыщается. В среднем урожай приносит около
   9% сверх цены семян — небольшой доход, а не вклад.

   Данные в профиле ученика — как у копилки, слияние устройств — просто объединение:
   garden — посадки { время посадки (мс): 'растение@грядка' }, harvest — собранные
   { время посадки: когда собрали }. Что растёт на грядках, считается из этих двух таблиц.
   Продажа — монеты с ключом sell:<время посадки> (claimed): дважды не продать, и устройства
   сходятся сами. Редкость урожая — из времени посадки, хранить её не нужно.

   ПОЛИВ. Растения, которые растут сутки и дольше, нужно поливать: при посадке грядку поливают, воды
   хватает на WATER_HOURS часов, дальше земля сохнет и растение стоит — не растёт, но и не гибнет.
   Полили — снова растёт ещё WATER_HOURS часов. Растёт только «влажное» время: сколько часов роста
   нужно растению, столько часов оно должно простоять во влажной земле. water — поливы
   { время полива (мс): время посадки }, слияние устройств — объединение. Растения, посаженные
   до появления полива (WATER_SINCE), растут по-старому. */
import { rateOn, balance, coinsWord, earn, hasClaim, hash01, weekDemand } from './rewards.js';
import { dayOf } from '../textbook/learn-state.js';

const HOUR = 3600000;
export const GARDEN_PLOTS = 6;
export const WATER_HOURS = 12;
export const WATER_FROM_HOURS = 24;
export const WATER_SINCE = Date.UTC(2026, 9, 12, 12);
// редкость: подпись и цвет плашки (тёплая палитра docs/world.md)
export const RARITY = {
  common: { title: 'обычное', color: '#4D7C0F' },
  uncommon: { title: 'необычное', color: '#9A6300' },
  rare: { title: 'редкое', color: '#C2490B' },
  epic: { title: 'очень редкое', color: '#B0198F' },
  legend: { title: 'легендарное', color: '#B3123F' },
};
export const RARITY_ORDER = Object.keys(RARITY);
// цена — в кронах, платят монетами по курсу дня; hours — сколько растёт до цветения
export const PLANTS = [
  { id: 'chamomile', title: 'Ромашка', rarity: 'common', crowns: 15, hours: 2, color: '#F4F1E6', heart: '#E3B23C' },
  { id: 'cornflower', title: 'Василёк', rarity: 'common', crowns: 20, hours: 3, color: '#4F7BC0', heart: '#2E4D86' },
  { id: 'calendula', title: 'Календула', rarity: 'common', crowns: 25, hours: 4, color: '#E8912D', heart: '#B65F14' },
  { id: 'tulip', title: 'Тюльпан', rarity: 'uncommon', crowns: 45, hours: 8, color: '#D2463C', heart: '#8E2A23' },
  { id: 'sunflower', title: 'Подсолнух', rarity: 'uncommon', crowns: 55, hours: 12, color: '#F2C230', heart: '#6B4A1E' },
  { id: 'peony', title: 'Пион', rarity: 'rare', crowns: 90, hours: 24, color: '#E68FA8', heart: '#C2577A' },
  { id: 'lavender', title: 'Лаванда', rarity: 'rare', crowns: 110, hours: 30, color: '#8E78C4', heart: '#5E4A99' },
  { id: 'orchid', title: 'Орхидея', rarity: 'epic', crowns: 200, hours: 48, color: '#C46FC0', heart: '#F2E36B' },
  { id: 'moneytree', title: 'Денежное дерево', rarity: 'legend', crowns: 400, hours: 96, color: '#D8B25A', heart: '#7D5A10',
    note: 'Растёт четыре дня. Деньги на деревьях не растут — а вот продать дерево можно дорого.' },
];
export const PLANT_BY_ID = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
/* Редкость урожая: шанс и множитель цены на рынке. В среднем ×1,093 — около 9% сверх семян.
   Небывалый — один урожай из тысячи; он взял последнюю тысячную у легендарного, поэтому редкость
   уже собранного урожая не поменялась (кроме тех, что стали небывалыми). */
export const GRADES = [
  { id: 'plain', title: 'обычный', p: 0.55, mult: 1, color: '#5E5A4E' },
  { id: 'good', title: 'хороший', p: 0.25, mult: 1.1, color: '#4B692C' },
  { id: 'fine', title: 'отборный', p: 0.12, mult: 1.2, color: '#2F5D8C' },
  { id: 'rare', title: 'редкий', p: 0.06, mult: 1.4, color: '#86446A' },
  { id: 'legend', title: 'легендарный', p: 0.019, mult: 1.8, color: '#8A6416' },
  { id: 'myth', title: 'небывалый', p: 0.001, mult: 6, color: '#1F5F6B' },
];
export const GRADE_BY_ID = Object.fromEntries(GRADES.map((g) => [g.id, g]));
/* Экран «Шансы урожая» (docs/mechanics.md, «Сад Инфли»): по решению владельца шансы на экране не пишем, экран
   выключен. Включить — true (рекомендация показать — docs/legal-todo.md, п. 11). */
export const SHOW_ODDS = false;
// шанс в процентах по-русски: 55%, 1,9%, 0,1% — из тех же GRADES, по которым выпадает редкость
export const oddsText = (p) => `${String(Math.round(p * 1000) / 10).replace('.', ',')}%`;
export const oddsTable = () => GRADES.map((g) => ({ id: g.id, title: g.title, odds: oddsText(g.p), mult: g.mult }));
export const MARKET_DROP = 0.15;
export const MARKET_FLOOR = 0.5;
// редкость урожая — от времени посадки: на всех устройствах одна и та же, пересобрать нельзя
export function gradeOf(at) {
  const u = hash01(`grade:${at}`);
  let acc = 0;
  for (const g of GRADES) { acc += g.p; if (u < acc) return g.id; }
  return GRADES[0].id;
}
export const plantPrice = (id, day) => Math.ceil(PLANT_BY_ID[id].crowns * rateOn(day));
export const growMs = (id) => PLANT_BY_ID[id].hours * HOUR;
// поливать нужно растения, которые растут сутки и дольше
export const needsWater = (id) => PLANT_BY_ID[id].hours >= WATER_FROM_HOURS;
const watered = (g) => needsWater(g.plant) && g.at >= WATER_SINCE;
// поливы растения: времена по порядку
export const watersOf = (s, at) => Object.entries(s.water || {}).filter(([, v]) => String(v) === String(at)).map(([t]) => Number(t)).sort((a, b) => a - b);

const parse = (v) => { const [plant, plot] = String(v).split('@'); return { plant, plot: Number(plot) }; };
/* Посадки, которые ещё на грядках. Если на двух устройствах посадили в одну грядку, позднее
   растение встаёт на первую свободную; не хватило грядок — ждёт в списке (overflow). */
export function gardenPlots(s) {
  const harvested = s.harvest || {};
  const growing = Object.entries(s.garden || {}).filter(([at]) => !harvested[at])
    .map(([at, v]) => ({ at: Number(at), ...parse(v) })).filter((g) => PLANT_BY_ID[g.plant]).sort((a, b) => a.at - b.at);
  const plots = Array(GARDEN_PLOTS).fill(null);
  const overflow = [];
  growing.forEach((g) => {
    const want = Number.isInteger(g.plot) && g.plot >= 0 && g.plot < GARDEN_PLOTS && !plots[g.plot] ? g.plot : plots.findIndex((p) => !p);
    const w = watered(g) ? { waters: watersOf(s, g.at) } : {};
    if (want >= 0) plots[want] = { ...g, plot: want, ...w }; else overflow.push({ ...g, ...w });
  });
  return { plots, overflow };
}
/* Как далеко растение: доля роста, стадия и сколько осталось. Часы на устройстве переведены
   назад — растение не растёт «в минус»: доля не меньше нуля. */
export const STAGES = ['seed', 'sprout', 'bud', 'bloom'];
export const STAGE_LABEL = { seed: 'семечко', sprout: 'росток', bud: 'бутон', bloom: 'цветёт' };
const stageOf = (p) => (p >= 1 ? 'bloom' : p >= 0.6 ? 'bud' : p >= 0.15 ? 'sprout' : 'seed');
/* Влажное время растения к моменту now: объединение отрезков [полив, полив + WATER_HOURS] (первый
   полив — при посадке), обрезанное посадкой и now; wetUntil — до какого времени земля влажная. */
export function wetTime(g, now = Date.now()) {
  const W = WATER_HOURS * HOUR;
  const starts = [g.at, ...(g.waters || []).filter((t) => t >= g.at)].sort((a, b) => a - b);
  let wet = 0; let end = g.at;
  starts.forEach((t) => {
    const a = Math.max(t, end); const b = Math.min(t + W, now);
    if (b > a) wet += b - a;
    end = Math.max(end, t + W);
  });
  return { wet, wetUntil: end };
}
/* growth: p — доля роста, stage, ripe, left — сколько ещё расти (для поливаемых — влажных часов),
   ripeAt — когда созреет, если не придётся поливать (null — без полива не дорастёт).
   Поливаемые ещё: water — { left: на сколько хватит воды, dry: земля сухая, need: полить, чтобы дорасти }. */
export function growth(g, now = Date.now()) {
  const total = growMs(g.plant);
  if (!watered(g)) {
    const p = Math.max(0, Math.min(1, (now - g.at) / total));
    return { p, stage: stageOf(p), ripe: p >= 1, left: Math.max(0, g.at + total - now), ripeAt: g.at + total };
  }
  const { wet, wetUntil } = wetTime(g, now);
  const p = Math.max(0, Math.min(1, wet / total));
  const left = Math.max(0, total - wet);
  const waterLeft = Math.max(0, wetUntil - now);
  const ripe = p >= 1;
  return { p, stage: stageOf(p), ripe, left, ripeAt: ripe ? now : left <= waterLeft ? now + left : null,
    water: { left: waterLeft, dry: !ripe && waterLeft <= 0, need: !ripe && left > waterLeft } };
}
// полить: воды снова на WATER_HOURS часов; созревшее и то, чему полив не нужен, не поливают
export function water(s, at, now = Date.now()) {
  const g = gardenPlots(s).plots.find((x) => x && x.at === at);
  if (!g) return { s, ok: false, reason: 'На грядке ничего нет' };
  if (!g.waters) return { s, ok: false, reason: `${PLANT_BY_ID[g.plant].title} полива не просит` };
  const st = growth(g, now);
  if (st.ripe) return { s, ok: false, reason: 'Уже созрело — соберите' };
  let t = now; while ((s.water || {})[t]) t += 1;
  return { s: { ...s, water: { ...s.water, [t]: String(at) } }, ok: true, wasDry: st.water.dry };
}
// «ещё 3 ч 20 мин», «ещё 2 дн 4 ч», «ещё 12 мин»; short — для грядки: без «ещё», от трёх часов — без минут
export function leftText(ms, { short = false } = {}) {
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return 'готово';
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  const pre = short ? '' : 'ещё ';
  if (d) return `${pre}${d} дн${h ? ` ${h} ч` : ''}`;
  if (h) return `${pre}${h} ч${m && !(short && h >= 3) ? ` ${m} мин` : ''}`;
  return `${pre}${m} мин`;
}
// посадить: { s, ok, reason, plot, price } — монеты списываются как покупка в лавке
export function plant(s, id, now = Date.now(), plot = null) {
  const p = PLANT_BY_ID[id];
  if (!p) return { s, ok: false, reason: 'Таких семян нет' };
  const { plots } = gardenPlots(s);
  const free = plot != null && plot >= 0 && plot < GARDEN_PLOTS && !plots[plot] ? plot : plots.findIndex((x) => !x);
  if (free < 0) return { s, ok: false, reason: 'Все грядки заняты — соберите, что созрело' };
  const day = dayOf(now);
  const price = plantPrice(id, day);
  const b = balance(s);
  if (b < price) return { s, ok: false, reason: `Не хватает ${price - b} ${coinsWord(price - b)}` };
  // ключ — время посадки; две посадки в одну миллисекунду не сливаются
  let at = now; while ((s.garden || {})[at]) at += 1;
  const t = { ...s, spent: { ...s.spent, [day]: ((s.spent || {})[day] || 0) + price }, garden: { ...s.garden, [at]: `${id}@${free}` } };
  return { s: t, ok: true, plot: free, price, at };
}
// собрать созревшее: урожай с редкостью ложится в гербарий, оттуда его можно продать
export function harvest(s, at, now = Date.now()) {
  const g = gardenPlots(s).plots.find((x) => x && x.at === at);
  if (!g) return { s, ok: false, reason: 'На грядке ничего нет' };
  if (!growth(g, now).ripe) return { s, ok: false, reason: `Ещё не созрело: ${leftText(growth(g, now).left)}` };
  const first = !grown(s)[g.plant];
  return { s: { ...s, harvest: { ...s.harvest, [at]: now } }, ok: true, plant: g.plant, grade: gradeOf(at), at, first };
}
const sellKey = (at) => `sell:${at}`;
export const isSold = (s, at) => hasClaim(s, sellKey(at));
// весь собранный урожай: { at, plant, grade, sold } — новые сверху
export function crops(s) {
  return Object.keys(s.harvest || {}).map((k) => {
    const v = (s.garden || {})[k]; if (!v) return null;
    const { plant: id } = parse(v);
    if (!PLANT_BY_ID[id]) return null;
    return { at: Number(k), plant: id, grade: gradeOf(k), sold: isSold(s, k), harvested: s.harvest[k] };
  }).filter(Boolean).sort((a, b) => b.harvested - a.harvested || b.at - a.at);
}
// сколько каждого растения выращено за всё время (и проданные тоже) — открыто ли оно в гербарии
export function grown(s) {
  const out = {};
  crops(s).forEach((c) => { out[c.plant] = (out[c.plant] || 0) + 1; });
  return out;
}
// гербарий: сколько каждого растения лежит в коллекции (без проданных)
export function herbarium(s) {
  const out = {};
  crops(s).filter((c) => !c.sold).forEach((c) => { out[c.plant] = (out[c.plant] || 0) + 1; });
  return out;
}
// какие редкости урожая каждого растения сейчас в коллекции
export function collection(s) {
  const out = {};
  crops(s).filter((c) => !c.sold).forEach((c) => { (out[c.plant] = out[c.plant] || {})[c.grade] = (out[c.plant][c.grade] || 0) + 1; });
  return out;
}
/* РЫНОК: сколько этого растения уже продано сегодня — каждая продажа снижает цену на 15%,
   не ниже половины. Назавтра цена снова полная. */
export function soldToday(s, id, now = Date.now()) {
  const day = dayOf(now);
  return Object.entries(s.claimed || {}).filter(([k, t]) => k.startsWith('sell:') && dayOf(t) === day)
    .filter(([k]) => { const v = (s.garden || {})[k.slice(5)]; return v && parse(v).plant === id; }).length;
}
export const marketFactor = (s, id, now = Date.now()) => Math.max(MARKET_FLOOR, 1 - MARKET_DROP * soldToday(s, id, now));
/* цена урожая сейчас: семена × редкость × спрос недели СБОРА × насыщение спроса за день, в кронах и
   в монетах по курсу дня (вниз). Спрос недели — от ставки центробанка: высокая ставка — люди копят,
   цветы покупают хуже. Цена в кронах назначается при сборе и дальше не меняется: собрали в неделю
   высокой ставки — урожай так и останется дешёвым, сколько его ни держи. Поэтому выгодно растить,
   когда ставка низкая, и не растить, когда высокая (docs/mechanics.md, «Сад»). Ещё не собранное —
   по спросу сегодняшней недели: таким оно будет, если собрать сейчас. */
export function salePrice(s, at, now = Date.now()) {
  const v = (s.garden || {})[at];
  if (!v) return null;
  const { plant: id } = parse(v);
  const p = PLANT_BY_ID[id];
  if (!p) return null;
  const factor = marketFactor(s, id, now);
  const picked = (s.harvest || {})[at];
  const demand = weekDemand(dayOf(picked || now));
  const crowns = p.crowns * GRADE_BY_ID[gradeOf(at)].mult * factor * demand;
  return { crowns: Math.round(crowns * 10) / 10, coins: Math.floor(crowns * rateOn(dayOf(now))), factor, demand };
}
// за сколько куплены семена этого урожая: цена в день посадки
export function paidPrice(s, at) {
  const v = (s.garden || {})[at];
  if (!v) return null;
  const { plant: id } = parse(v);
  return PLANT_BY_ID[id] ? plantPrice(id, dayOf(Number(at))) : null;
}
/* Урожай одной строкой на растение и редкость: { plant, grade, ats (новые первыми), paid: [min, max] }.
   Строки — от последнего сбора: что собрали только что, то и сверху. */
export function cropGroups(s) {
  const out = new Map();
  crops(s).filter((c) => !c.sold).forEach((c) => {
    const key = `${c.plant}:${c.grade}`;
    if (!out.has(key)) out.set(key, { key, plant: c.plant, grade: c.grade, ats: [], paid: [Infinity, 0] });
    const g = out.get(key); const p = paidPrice(s, c.at);
    g.ats.push(c.at); g.paid = [Math.min(g.paid[0], p), Math.max(g.paid[1], p)];
  });
  return [...out.values()];
}
// продать урожай: монеты по цене рынка, ключ не даёт продать дважды
export function sell(s, at, now = Date.now()) {
  const key = String(at);
  if (!(s.harvest || {})[key]) return { s, ok: false, reason: 'Этого урожая нет' };
  if (isSold(s, key)) return { s, ok: false, reason: 'Уже продано' };
  const price = salePrice(s, key, now);
  if (!price || price.coins <= 0) return { s, ok: false, reason: 'Рынок не берёт' };
  return { s: earn(s, price.coins, sellKey(key), now), ok: true, coins: price.coins, plant: parse(s.garden[key]).plant, grade: gradeOf(key) };
}
// сколько грядок созрело — для значка на вкладке
export const ripeCount = (s, now = Date.now()) => gardenPlots(s).plots.filter((g) => g && growth(g, now).ripe).length;
// продать несколько подряд: каждая продажа того же растения снижает цену следующей
export function sellAll(s, ats, now = Date.now()) {
  let t = s; let coins = 0; let n = 0;
  ats.forEach((at) => { const r = sell(t, at, now); if (r.ok) { t = r.s; coins += r.coins; n += 1; } });
  return { s: t, ok: n > 0, coins, n };
}
