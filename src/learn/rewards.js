/* НАГРАДЫ: монеты, курс и лавка, задания дня, сундук юнита, печати-достижения, испытание
   месяца. Это экономика, поэтому у монет есть курс: цены в лавке назначены в кронах, а
   платите вы монетами по курсу дня — он колеблется вокруг единицы и тянется к ней обратно.
   Модуль чистый: всё считается из состояния учёбы (learn-state.js); каждая награда выдаётся
   под ключом (claimed) — ни дважды, ни на двух устройствах. Экраны — src/learn.jsx. */
import { dayOf, addDays, streak, longestStreak, ownedFreezes, MAX_FREEZES, dailyOf, DIAMOND_ACCURACY, goalMinutes, goalToday } from '../textbook/learn-state.js';

// детерминированная «случайность» из строки: FNV-1a → [0, 1)
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
export const plural = (n, one, few, many) => { const a = n % 10; const b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
export const coinsWord = (n) => plural(Math.abs(n), 'монета', 'монеты', 'монет');

/* ------------------------------ МОНЕТЫ ------------------------------ */
/* За урок впервые — 10 (без ошибок — ещё 5), повтор — 2, практика — 5, сданная проверка
   юнита — 20. Алмазный уровень (от 80% верных): впервые — 25 (без ошибок — ещё 10), потом — 5. */
export const COIN = { lesson: 10, perfect: 5, replay: 2, practice: 5, check: 20, diamond: 25, diamondPerfect: 10, diamondReplay: 5, goal: 10, allQuests: 10 };
export const earned = (s) => sum(s.coins);
export const balance = (s) => Math.max(0, sum(s.coins) - sum(s.spent));
export const hasClaim = (s, key) => !!(s.claimed || {})[key];
// начислить монеты; с ключом — только один раз
export function earn(s, n, key = null, now = Date.now()) {
  if (n <= 0 || (key && hasClaim(s, key))) return s;
  const day = dayOf(now);
  return {
    ...s, coins: { ...s.coins, [day]: ((s.coins || {})[day] || 0) + n },
    claimed: key ? { ...s.claimed, [key]: now } : s.claimed,
  };
}
// монеты за пройденный урок, практику или проверку; diamond — алмазный уровень, gem — алмаз урока уже был
export function runCoins({ mode, replay = false, accuracy = 0, pass = null, items = 0, diamond = false, gem = false }) {
  if (mode === 'lesson' && diamond) return accuracy < DIAMOND_ACCURACY ? 0 : gem ? COIN.diamondReplay : COIN.diamond + (accuracy >= 100 ? COIN.diamondPerfect : 0);
  if (mode === 'lesson') return replay ? COIN.replay : COIN.lesson + (accuracy >= 100 ? COIN.perfect : 0);
  if (mode === 'practice') return items ? COIN.practice : 0;
  if (mode === 'check') return pass ? COIN.check : 0;
  return 0;
}
// ключ награды: первое прохождение урока и первый алмаз — по разу
export const runKey = ({ mode, lessonId, replay, diamond, gem }) => (mode !== 'lesson' ? null : diamond ? (gem ? null : `d:${lessonId}`) : replay ? null : `l:${lessonId}`);

/* ------------------------------ КУРС ------------------------------
   Сколько монет стоит одна крона в этот день: r = 1 + 0,75·(r_вчера − 1) + шум ±0,07.
   Считаем сорок дней назад от единицы — к нужному дню начало уже забыто. */
export function rateOn(day) {
  let r = 1; let key = addDays(day, -40);
  for (let i = 0; i <= 40; i += 1) { r = 1 + 0.75 * (r - 1) + (hash01(`rate:${key}`) - 0.5) * 0.14; key = addDays(key, 1); }
  return Math.round(Math.min(1.25, Math.max(0.8, r)) * 100) / 100;
}
export const rateHistory = (day, n = 14) => Array.from({ length: n }, (_, k) => { const d = addDays(day, k - n + 1); return { day: d, rate: rateOn(d) }; });

/* ------------------------------ ЛАВКА ------------------------------
   Цены — в кронах; в монетах — по курсу дня, с округлением вверх. Всё в лавке — только
   за монеты уроков, без случайных выпадений.
   Наряды Инфли — по одному на голову, лицо, шею, в руку и рамку. Обычные вещи стоят от 150
   до 1500 крон и меняются каждый день: на витрине дня — шесть из тех, что ещё не куплены, и
   одна из них — со скидкой дня 30%. Купленное всегда в гардеробе. Редкие вещи (от 2500 крон) —
   в витрине ювелира всегда: на них копят. Заморозка серии и «двойной опыт» — всегда в продаже. */
export const FREEZE = { id: 'freeze', title: 'Заморозка серии', crowns: 60, text: `Спасёт серию, если за неделю пропущено больше одного дня. В запасе — не больше ${MAX_FREEZES}.` };
export const BOOST = { id: 'boost', title: 'Двойной опыт', crowns: 150, minutes: 30, text: 'Полчаса после покупки уроки дают вдвое больше опыта.' };
export const OUTFITS = [
  { id: 'cap', slot: 'head', title: 'Кепка торговца', crowns: 150 },
  { id: 'beret', slot: 'head', title: 'Берет гравёра', crowns: 220 },
  { id: 'ushanka', slot: 'head', title: 'Ушанка ревизора', crowns: 320 },
  { id: 'bowler', slot: 'head', title: 'Котелок биржевика', crowns: 450 },
  { id: 'tophat', slot: 'head', title: 'Цилиндр банкира', crowns: 900 },
  { id: 'crown', slot: 'head', title: 'Корона казначея', crowns: 4500, rare: true },
  { id: 'glasses', slot: 'face', title: 'Очки бухгалтера', crowns: 180 },
  { id: 'pince', slot: 'face', title: 'Пенсне профессора', crowns: 380 },
  { id: 'monocle', slot: 'face', title: 'Монокль', crowns: 650 },
  { id: 'bowtie', slot: 'neck', title: 'Бабочка', crowns: 160 },
  { id: 'scarf', slot: 'neck', title: 'Шарф', crowns: 260 },
  { id: 'tie', slot: 'neck', title: 'Галстук министра', crowns: 480 },
  { id: 'medal', slot: 'neck', title: 'Орден «За финансовую грамотность»', crowns: 2800, rare: true },
  { id: 'paper', slot: 'hand', title: 'Свежий «Вестник»', crowns: 200 },
  { id: 'abacus', slot: 'hand', title: 'Счёты', crowns: 420 },
  { id: 'briefcase', slot: 'hand', title: 'Портфель с отчётом', crowns: 750 },
  { id: 'cane', slot: 'hand', title: 'Трость с набалдашником', crowns: 1500 },
  { id: 'goldbar', slot: 'hand', title: 'Золотой слиток', crowns: 6000, rare: true },
  { id: 'frame-guilloche', slot: 'frame', title: 'Рамка-гильош', crowns: 400 },
  { id: 'frame-gold', slot: 'frame', title: 'Золотой багет', crowns: 1200 },
  { id: 'frame-diamond', slot: 'frame', title: 'Алмазная огранка', crowns: 5000, rare: true },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export const SLOT_LABEL = { head: 'Голова', face: 'Лицо', neck: 'Шея', hand: 'В руке', frame: 'Рамка' };
export const SHOWCASE_SIZE = 6;
export const DEAL_OFF = 0.3;
const itemOf = (id) => (id === FREEZE.id ? FREEZE : id === BOOST.id ? BOOST : OUTFIT_BY_ID[id]);
/* Витрина дня: порядок обычных вещей задаёт дата (у всех учеников один), купленные
   пропускаются; скидка дня — на первую вещь витрины. */
export function shopDay(s, day) {
  const owned = (s && s.owned) || {};
  const order = OUTFITS.filter((o) => !o.rare).map((o) => ({ o, k: hash01(`shop:${day}:${o.id}`) })).sort((a, b) => a.k - b.k).map((x) => x.o.id);
  const showcase = order.filter((id) => !owned[id]).slice(0, SHOWCASE_SIZE);
  return { showcase, deal: showcase[0] || null, rare: OUTFITS.filter((o) => o.rare).map((o) => o.id) };
}
export const crownsOf = (id) => itemOf(id).crowns;
// цена в монетах: по курсу дня; вещь со скидкой дня — на 30% дешевле
export function priceOf(id, day, s = null) {
  const full = Math.ceil(itemOf(id).crowns * rateOn(day));
  return s && shopDay(s, day).deal === id ? Math.ceil(full * (1 - DEAL_OFF)) : full;
}
export const boostActive = (s, now = Date.now()) => (s.boost || 0) > now;
// купить: { s, ok, reason }
export function buy(s, id, now = Date.now()) {
  const item = itemOf(id);
  if (!item) return { s, ok: false, reason: 'Такого товара нет' };
  const day = dayOf(now);
  const price = priceOf(id, day, s);
  if (id === FREEZE.id && ownedFreezes(s) >= MAX_FREEZES) return { s, ok: false, reason: `В запасе уже ${MAX_FREEZES} заморозки` };
  if (id === BOOST.id && boostActive(s, now)) return { s, ok: false, reason: 'Двойной опыт уже действует' };
  const outfit = id !== FREEZE.id && id !== BOOST.id;
  if (outfit && (s.owned || {})[id]) return { s, ok: false, reason: 'Уже куплено' };
  if (outfit && !item.rare && !shopDay(s, day).showcase.includes(id)) return { s, ok: false, reason: 'Сегодня этого нет на витрине — загляните завтра' };
  if (balance(s) < price) return { s, ok: false, reason: `Не хватает ${price - balance(s)} ${coinsWord(price - balance(s))}` };
  let t = { ...s, spent: { ...s.spent, [day]: ((s.spent || {})[day] || 0) + price } };
  if (id === FREEZE.id) t = { ...t, freezeBuy: { ...t.freezeBuy, [day]: ((t.freezeBuy || {})[day] || 0) + 1 } };
  else if (id === BOOST.id) t = { ...t, boost: now + BOOST.minutes * 60000 };
  else t = { ...t, owned: { ...t.owned, [id]: now }, wear: { ...t.wear, [item.slot]: id, at: now } };
  return { s: t, ok: true, price };
}
// надеть купленное или снять (id = null)
export function setWear(s, slot, id, now = Date.now()) {
  if (id && (!(s.owned || {})[id] || OUTFIT_BY_ID[id].slot !== slot)) return s;
  return { ...s, wear: { ...s.wear, [slot]: id, at: now } };
}
export const outfitOf = (s) => { const w = s.wear || {}; return { head: w.head || null, face: w.face || null, neck: w.neck || null, hand: w.hand || null, frame: w.frame || null }; };

/* ------------------------------ ЗАДАНИЯ ДНЯ ------------------------------
   Три задания: одно про уроки, одно про ответы, одно про опыт или новый урок; какие именно —
   решает дата, размер — цель дня в минутах. Минуты сами по себе — это цель дня (у неё своя
   награда), заданием их не дублируем. Всё считается только по сегодняшним занятиям.
   Выполнено — монеты сразу, все три — ещё бонус. */
const newToday = (s, day) => Object.values(s.lessons || {}).filter((l) => l && l.runs > 0 && l.at && dayOf(l.at) === day).length;
const QUEST = {
  lessons: { coins: 10, target: (s) => Math.max(2, Math.round(goalMinutes(s) / 5)), have: (d) => d.l, title: (t) => `Пройти ${t} ${plural(t, 'урок', 'урока', 'уроков')}` },
  perfect: { coins: 20, target: (s) => (goalMinutes(s) >= 15 ? 2 : 1), have: (d) => d.p, title: (t) => (t === 1 ? 'Урок без ошибок' : `${t} урока без ошибок`) },
  correct: { coins: 10, target: (s) => (goalMinutes(s) >= 15 ? 20 : 12), have: (d) => d.c, title: (t) => `${t} верных ответов` },
  run: { coins: 15, target: (s) => (goalMinutes(s) >= 15 ? 10 : 6), have: (d) => d.r, title: (t) => `${t} верных ответов подряд` },
  xp: { coins: 10, target: (s) => goalMinutes(s) * 3, have: (d, s, day) => (s.xp || {})[day] || 0, title: (t) => `Набрать ${t} опыта` },
  fresh: { coins: 15, target: () => 1, have: (d, s, day) => newToday(s, day), title: () => 'Пройти новый урок на Пути' },
};
export const QUEST_ICON = { lessons: 'map', perfect: 'check', correct: 'coins', run: 'flame', xp: 'spark', fresh: 'target' };
export function questsFor(s, now = Date.now()) {
  const day = dayOf(now); const d = dailyOf(s, now);
  const pick = (list, salt) => list[Math.floor(hash01(`${day}:${salt}`) * list.length)];
  const ids = [pick(['lessons', 'perfect'], 'a'), pick(['correct', 'run'], 'b'), pick(['xp', 'fresh'], 'c')];
  return ids.map((id) => {
    const q = QUEST[id]; const target = q.target(s); const have = Math.min(target, q.have(d, s, day));
    const key = `q:${day}:${id}`;
    return { id, key, title: q.title(target), have, target, done: have >= target, claimed: hasClaim(s, key), coins: q.coins };
  });
}

/* ------------------------------ СУНДУК ЮНИТА ------------------------------ */
export const chestCoins = (unitId) => 40 + Math.floor(hash01(`chest:${unitId}`) * 41);
export const chestKey = (unitId) => `c:${unitId}`;
export const openChest = (s, unitId, now = Date.now()) => earn(s, chestCoins(unitId), chestKey(unitId), now);

/* ------------------------------ СЕРИЯ ------------------------------ */
export const STREAK_BONUS = [[3, 15], [7, 40], [14, 80], [30, 200], [60, 300], [100, 500]];

/* ------------------------------ ПЕЧАТИ-ДОСТИЖЕНИЯ ------------------------------
   ctx — то, что знает только курс: сколько пройдено уроков и юнитов, какие виды уроков. */
export const ACHIEVEMENTS = [
  { id: 'first', icon: 'footprints', title: 'Первый шаг', text: 'Пройден первый урок', coins: 10, test: (s, c) => c.lessonsDone >= 1 },
  // только за урок, пройденный без ошибок сейчас: счётчик дня растёт в момент такого урока (не «лучший результат» старых прохождений)
  { id: 'perfect', icon: 'check', title: 'Без помарок', text: 'Урок без единой ошибки', coins: 15, test: (s) => Object.values(s.daily || {}).some((d) => d.p > 0) },
  { id: 'streak3', icon: 'flame', title: 'Три дня подряд', text: 'Серия — три дня', coins: 10, test: (s, c) => c.longest >= 3 },
  { id: 'streak7', icon: 'flame', title: 'Неделя в пути', text: 'Серия — семь дней', coins: 30, test: (s, c) => c.longest >= 7 },
  { id: 'streak30', icon: 'flame', title: 'Месяц в пути', text: 'Серия — тридцать дней', coins: 100, test: (s, c) => c.longest >= 30 },
  { id: 'unit', icon: 'landmark', title: 'Место на карте', text: 'Пройден первый юнит', coins: 20, test: (s, c) => c.unitsDone >= 1 },
  { id: 'kinds', icon: 'shapes', title: 'Все жанры', text: 'Пройдены уроки всех восьми видов', coins: 30, test: (s, c) => c.kinds >= 8 },
  // знания, показанные делом: проверка юнита без единой ошибки (вступительный тест сам по себе печать не даёт)
  { id: 'ace', icon: 'graduation', title: 'Знаток', text: 'Проверка юнита — без единой ошибки', coins: 30, test: (s) => Object.values(s.units || {}).some((u) => u.ace) },
  { id: 'quests', icon: 'scroll', title: 'Прилежание', text: 'Все задания дня — семь раз', coins: 40, test: (s) => Object.keys(s.claimed || {}).filter((k) => /^q:.*:all$/.test(k)).length >= 7 },
  { id: 'shop', icon: 'shopping', title: 'Первая покупка', text: 'Куплено что-то в лавке', coins: 5, test: (s) => Object.keys(s.owned || {}).length > 0 || Object.keys(s.freezeBuy || {}).length > 0 },
  { id: 'wardrobe', icon: 'shirt', title: 'Гардероб', text: 'У Инфли три наряда', coins: 20, test: (s) => Object.keys(s.owned || {}).length >= 3 },
  { id: 'rare', icon: 'gem', title: 'Коллекционер', text: 'Куплена редкая вещь из витрины ювелира', coins: 100, test: (s) => Object.keys(s.owned || {}).some((id) => OUTFIT_BY_ID[id] && OUTFIT_BY_ID[id].rare) },
  { id: 'early', icon: 'sunrise', title: 'Ранняя пташка', text: 'Урок до восьми утра', coins: 10, test: (s) => Object.values(s.daily || {}).some((d) => d.h & 1) },
  { id: 'owl', icon: 'moon', title: 'Сова', text: 'Урок после десяти вечера', coins: 10, test: (s) => Object.values(s.daily || {}).some((d) => d.h & 2) },
  { id: 'saver', icon: 'piggy', title: 'Копилка', text: 'Заработано 500 монет', coins: 25, test: (s) => earned(s) >= 500 },
  { id: 'month', icon: 'calendar', title: 'Испытание месяца', text: 'Выполнено испытание месяца', coins: 30, test: (s) => Object.keys(s.claimed || {}).some((k) => k.startsWith('m:')) },
  { id: 'diamond', icon: 'gem', title: 'Огранщик', text: 'Урок взят на алмазном уровне', coins: 20, test: (s) => Object.values(s.lessons || {}).some((l) => l.diamond) },
  { id: 'diamond10', icon: 'gem', title: 'Ювелир', text: 'Десять уроков на алмазном уровне', coins: 60, test: (s) => Object.values(s.lessons || {}).filter((l) => l.diamond).length >= 10 },
];
export const achievementKey = (id) => `a:${id}`;

/* ------------------------------ ИСПЫТАНИЕ МЕСЯЦА ------------------------------ */
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const inMonth = (map, month) => Object.entries(map || {}).filter(([k]) => k.startsWith(month));
/* Испытание ПЕРСОНАЛЬНОЕ: цель считается от самого ученика.
   — Темп: цель дня в минутах → сколько это уроков, опыта, уроков без ошибок за день; за
     месяц — примерно за 60% его дней (занятия не каждый день — тоже нормально).
   — История: если в прошлом месяце сделано больше — цель «чуть больше прошлого» (+15%), но не
     больше полутора темпов; сделано меньше — цель по темпу, без наказаний.
   — Пришёл посреди месяца — темп считается по оставшимся дням, но не ниже нижней планки
     (иначе получается «заниматься 2 дня»). Испытания «просто заходить N дней» нет. */
const MONTH_KINDS = [
  { id: 'minutes', floor: 60, round: 10, pace: (m) => m, title: (t) => `Заниматься ${t} минут в этом месяце`, unit: () => 'мин',
    have: (s, m) => Math.floor(inMonth(s.daily, m).reduce((a, [, d]) => a + (d.s || 0), 0) / 60) },
  { id: 'lessons', floor: 5, round: 1, pace: (m) => m / 5, title: (t) => `Пройти ${t} ${plural(t, 'урок', 'урока', 'уроков')} в этом месяце`, unit: (n) => plural(n, 'урок', 'урока', 'уроков'),
    have: (s, m) => inMonth(s.done, m).reduce((a, [, v]) => a + v, 0) },
  { id: 'perfect', floor: 3, round: 1, pace: (m) => m / 40, title: (t) => `${t} ${plural(t, 'урок', 'урока', 'уроков')} без ошибок в этом месяце`, unit: (n) => `${plural(n, 'урок', 'урока', 'уроков')} без ошибок`,
    have: (s, m) => inMonth(s.daily, m).reduce((a, [, d]) => a + d.p, 0) },
  { id: 'xp', floor: 100, round: 10, pace: (m) => m * 3, title: (t) => `Набрать ${t} опыта в этом месяце`, unit: () => 'опыта',
    have: (s, m) => inMonth(s.xp, m).reduce((a, [, v]) => a + v, 0) },
];
export const MONTH_COINS = 100;
const ACTIVE_SHARE = 0.6;
// первый день ученика: регистрация или самое раннее занятие
const firstDay = (s) => {
  const days = [...Object.keys(s.done || {}), ...Object.keys(s.xp || {})].sort();
  const reg = s.profile && s.profile.at ? dayOf(s.profile.at) : null;
  return [days[0], reg].filter(Boolean).sort()[0] || null;
};
const prevMonth = (month) => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export function monthChallenge(s, now = Date.now()) {
  const day = dayOf(now); const month = day.slice(0, 7);
  const kind = MONTH_KINDS[Math.floor(hash01(`month:${month}`) * MONTH_KINDS.length)];
  const d = new Date(now); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const start = firstDay(s) || day;
  const from = start.slice(0, 7) === month ? Number(start.slice(8)) : start < month ? 1 : d.getDate();
  const span = last - from + 1;
  const mins = goalMinutes(s);
  const byPace = kind.pace(mins) * span * ACTIVE_SHARE;
  const before = kind.have(s, prevMonth(month));
  const raw = before > byPace ? Math.min(before * 1.15, byPace * 1.5) : byPace;
  const target = Math.max(kind.floor, Math.round(raw / kind.round) * kind.round);
  const have = Math.min(target, kind.have(s, month));
  const key = `m:${month}`;
  // сегодня тоже считается: 29-го в 30-дневном месяце осталось два дня
  const daysLeft = last - d.getDate() + 1;
  // почему именно столько — чтобы цель читалась как своя, а не взятая с потолка
  const why = before > byPace ? `В прошлом месяце — ${before}: теперь чуть больше.` : `По вашей цели — ${mins} минут в день.`;
  return { month, name: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, id: kind.id, title: kind.title(target), have, target, need: Math.max(0, target - have), unit: kind.unit(Math.max(0, target - have)),
    done: have >= target, claimed: hasClaim(s, key), key, coins: MONTH_COINS, daysLeft, why };
}
// марки месяцев, которые уже получены: «m:ГГГГ-ММ» → подпись
export const monthStamps = (s) => Object.keys(s.claimed || {}).filter((k) => k.startsWith('m:')).sort().map((k) => {
  const [y, m] = k.slice(2).split('-').map(Number); return { key: k, name: `${MONTHS[m - 1]} ${y}` };
});

/* ------------------------------ РАСЧЁТ НАГРАД ------------------------------
   После каждого урока: цель дня, серия, задания дня, печати, испытание месяца — всё, что
   выполнено и ещё не получено. Возвращает новое состояние и список полученного. */
export function settle(s, ctx, now = Date.now()) {
  const gains = [];
  const give = (t, n, key, title, kind) => { const before = t; const next = earn(t, n, key, now); if (next !== before) gains.push({ key, coins: n, title, kind }); return next; };
  let t = s;
  const day = dayOf(now);
  const g = goalToday(t, now);
  if (g.done >= g.goal) t = give(t, COIN.goal, `g:${day}`, `Цель дня: ${g.goal} минут`, 'goal');
  const st = streak(t, now).days;
  STREAK_BONUS.forEach(([n, c]) => { if (st >= n) t = give(t, c, `st:${n}`, `Серия: ${n} ${plural(n, 'день', 'дня', 'дней')}`, 'streak'); });
  const quests = questsFor(t, now);
  quests.forEach((q) => { if (q.done) t = give(t, q.coins, q.key, `Задание: ${q.title}`, 'quest'); });
  if (quests.every((q) => q.done)) t = give(t, COIN.allQuests, `q:${day}:all`, 'Все задания дня', 'quest');
  const m = monthChallenge(t, now);
  if (m.done) t = give(t, m.coins, m.key, `Испытание месяца: ${m.name}`, 'month');
  const full = { longest: longestStreak(t), ...ctx };
  ACHIEVEMENTS.forEach((a) => { if (a.test(t, full)) t = give(t, a.coins, achievementKey(a.id), `Печать «${a.title}»`, 'achievement'); });
  return { s: t, gains };
}
export const achievementsOf = (s) => ACHIEVEMENTS.map((a) => ({ ...a, got: hasClaim(s, achievementKey(a.id)), at: (s.claimed || {})[achievementKey(a.id)] || 0 }));
