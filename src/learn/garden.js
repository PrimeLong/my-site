/* САД ИНФЛИ (docs/mechanics.md, «Сад»). Семена покупают за монеты по курсу дня, как вещи в лавке;
   растение растёт само, по часам, — и пока приложение закрыто. Чем реже растение, тем дольше оно
   растёт и тем дороже семена. Созревшее растение собирают в гербарий — это коллекция, монет
   оно не приносит: сад — радость, а не вклад.

   Данные в профиле ученика — как у копилки, слияние устройств — просто объединение:
   garden — посадки { время посадки (мс): 'растение@грядка' }, harvest — собранные
   { время посадки: когда собрали }. Что растёт на грядках, считается из этих двух таблиц. */
import { rateOn, balance, coinsWord } from './rewards.js';
import { dayOf } from '../textbook/learn-state.js';

const HOUR = 3600000;
export const GARDEN_PLOTS = 6;
// редкость: подпись и цвет плашки (тёплая палитра docs/world.md)
export const RARITY = {
  common: { title: 'обычное', color: '#4B692C' },
  uncommon: { title: 'необычное', color: '#7A5616' },
  rare: { title: 'редкое', color: '#86461F' },
  epic: { title: 'очень редкое', color: '#86446A' },
  legend: { title: 'легендарное', color: '#8A2F45' },
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
    note: 'Растёт четыре дня — и денег не приносит. Как и положено дереву.' },
];
export const PLANT_BY_ID = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
export const plantPrice = (id, day) => Math.ceil(PLANT_BY_ID[id].crowns * rateOn(day));
export const growMs = (id) => PLANT_BY_ID[id].hours * HOUR;

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
    if (want >= 0) plots[want] = { ...g, plot: want }; else overflow.push(g);
  });
  return { plots, overflow };
}
/* Как далеко растение: доля роста, стадия и сколько осталось. Часы на устройстве переведены
   назад — растение не растёт «в минус»: доля не меньше нуля. */
export const STAGES = ['seed', 'sprout', 'bud', 'bloom'];
export const STAGE_LABEL = { seed: 'семечко', sprout: 'росток', bud: 'бутон', bloom: 'цветёт' };
export function growth(g, now = Date.now()) {
  const total = growMs(g.plant);
  const p = Math.max(0, Math.min(1, (now - g.at) / total));
  const stage = p >= 1 ? 'bloom' : p >= 0.6 ? 'bud' : p >= 0.15 ? 'sprout' : 'seed';
  return { p, stage, ripe: p >= 1, left: Math.max(0, g.at + total - now), ripeAt: g.at + total };
}
// «ещё 3 ч 20 мин», «ещё 2 дн 4 ч», «ещё 12 мин»
export function leftText(ms) {
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return 'готово';
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  if (d) return `ещё ${d} дн${h ? ` ${h} ч` : ''}`;
  if (h) return `ещё ${h} ч${m ? ` ${m} мин` : ''}`;
  return `ещё ${m} мин`;
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
// собрать созревшее в гербарий
export function harvest(s, at, now = Date.now()) {
  const g = gardenPlots(s).plots.find((x) => x && x.at === at);
  if (!g) return { s, ok: false, reason: 'На грядке ничего нет' };
  if (!growth(g, now).ripe) return { s, ok: false, reason: `Ещё не созрело: ${leftText(growth(g, now).left)}` };
  const first = !herbarium(s)[g.plant];
  return { s: { ...s, harvest: { ...s.harvest, [at]: now } }, ok: true, plant: g.plant, first };
}
// гербарий: сколько каждого растения собрано
export function herbarium(s) {
  const out = {};
  Object.keys(s.harvest || {}).forEach((at) => { const v = (s.garden || {})[at]; if (!v) return; const { plant: id } = parse(v); if (PLANT_BY_ID[id]) out[id] = (out[id] || 0) + 1; });
  return out;
}
// сколько грядок созрело — для значка на вкладке
export const ripeCount = (s, now = Date.now()) => gardenPlots(s).plots.filter((g) => g && growth(g, now).ripe).length;
