/* НАГРАДЫ: монеты, курс и лавка, задания дня, сундук юнита, печати-достижения, испытание
   месяца. Это экономика, поэтому у монет есть курс: цены в лавке назначены в кронах, а
   платите вы монетами по курсу дня — он колеблется вокруг единицы и тянется к ней обратно.
   Модуль чистый: всё считается из состояния учёбы (learn-state.js); каждая награда выдаётся
   под ключом (claimed) — ни дважды, ни на двух устройствах. Экраны — src/learn.jsx. */
import { dayOf, addDays, streak, longestStreak, dailyOf, DIAMOND_ACCURACY, goalMinutes, goalToday, PREMIUM, policyActive, weekOf } from '../textbook/learn-state.js';
import { plural } from '../lib/plural.js';
import { LESSONS, UNITS } from './course.js';
import { halloweenOn, WEB_FRAME } from './halloween.js';
export { plural };

// детерминированная «случайность» из строки: FNV-1a → [0, 1)
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
/* hash01 с перемешиванием битов: у строк, различающихся последним символом, hash01 даёт близкие
   старшие биты — три задания дня по «день:a», «день:b», «день:c» менялись хором (два набора на всё). */
export function mix01(str) {
  let x = Math.floor(hash01(str) * 4294967296);
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
// приветствие по часу: ночью (с 23 до 5) — «Доброй ночи», а не «Доброе утро» в час ночи
export const greetingAt = (hour) => (hour < 5 || hour >= 23 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер');
export const coinsWord = (n) => plural(Math.abs(n), 'монета', 'монеты', 'монет');

/* ------------------------------ МОНЕТЫ ------------------------------ */
/* За урок впервые — 10 (без ошибок — ещё 5), повтор — 2, практика — 5, сданная проверка
   юнита — 20. Алмазный уровень (от 80% верных): впервые — 25 (без ошибок — ещё 10), потом — 5. */
export const COIN = { lesson: 10, perfect: 5, replay: 2, practice: 5, check: 20, diamond: 25, diamondPerfect: 10, diamondReplay: 5, goal: 10, allQuests: 10, book: 3 };
/* Задача учебника решена с первой попытки (без подсмотренного решения) — немного монет в кошелёк Пути.
   Первая попытка у задачи одна, поэтому и награда — один раз. prev — запись задачи до ответа. */
export const bookFirstTry = (prev, ok, sawSolution = false) => !!ok && !sawSolution && !(prev && prev.tries);
// цель дня — столько монет, сколько минут в цели (10 минут — COIN.goal)
export const goalCoins = (minutes) => Math.round((minutes * COIN.goal) / 10);
export const earned = (s) => sum(s.coins);
// в кошельке: заработано − потрачено − взносы страховки − лежит в копилке + проценты забранных вкладов
export const balance = (s) => Math.max(0, sum(s.coins) - sum(s.spent) - sum(s.premiums) - piggyLocked(s) + piggyGain(s));
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
  if (mode === 'practice' || mode === 'fix') return items ? COIN.practice : 0;
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
   Цены — от заработка курса (courseIncome ниже, правило — docs/mechanics.md): самая дорогая вещь
   не дороже 70% того, что ученик получает за весь Путь.
   Наряды Инфли — по одному на голову, лицо, шею, в руку и рамку. Обычные вещи стоят от 25
   до 240 крон и меняются каждый день: на витрине дня — шесть из тех, что ещё не куплены, и
   одна из них — со скидкой дня 30%. Купленное всегда в гардеробе. Редкие вещи (от 400 крон) —
   в витрине ювелира всегда: на них копят; у каждой своя анимация (src/mascot.jsx). Страховка серии и «двойной опыт» — всегда в продаже. */
/* «Страховка серии» — полис с еженедельным взносом (docs/mechanics.md): оформить, платить
   взносы, расторгнуть. Разовых полисов (в данных — freeze) больше не продаём: купленные раньше
   тратятся как прежде (learn-state.js, applyFreezes). */
export const FREEZE = { id: 'freeze', title: 'Страховка серии', crowns: 20, text: 'Полис с еженедельным взносом: пока взносы идут, второй пропуск в неделе прощается.' };
export { PREMIUM, policyActive };
const weeksFrom = (fromDay, toDay) => { const out = []; for (let w = weekOf(fromDay); w <= toDay; w = addDays(w, 7)) out.push(w); return out; };
/* Взносы за все недели действия полиса, что ещё не оплачены (при открытии приложения и после
   урока). Не хватило монет — полис прекращается: эта неделя не покрыта. */
export function chargePremiums(s, now = Date.now()) {
  if (!policyActive(s)) return s;
  let t = s;
  for (const w of weeksFrom(dayOf(s.policyAt), dayOf(now))) {
    if ((t.premiums || {})[w]) continue;
    if (balance(t) < PREMIUM) return { ...t, policyOff: now, policyLapse: now };
    t = { ...t, premiums: { ...t.premiums, [w]: PREMIUM } };
  }
  return t;
}
// оформить полис: первый взнос — сразу, за текущую неделю (если она уже оплачена — без взноса)
export function takePolicy(s, now = Date.now()) {
  if (policyActive(s)) return { s, ok: false, reason: 'Полис уже действует' };
  const paid = ((s.premiums || {})[weekOf(dayOf(now))] || 0) > 0;
  if (!paid && balance(s) < PREMIUM) return { s, ok: false, reason: `На первый взнос не хватает ${PREMIUM - balance(s)} ${coinsWord(PREMIUM - balance(s))}` };
  return { s: chargePremiums({ ...s, policyAt: now }, now), ok: true, price: paid ? 0 : PREMIUM };
}
// расторгнуть: оплаченная неделя остаётся покрытой, взносы не возвращаются
export const cancelPolicy = (s, now = Date.now()) => (policyActive(s) ? { ...s, policyOff: now } : s);
// для лавки: действует ли, до какого дня оплачено, сколько внесено, сколько дней спасено, прекращён ли за неуплату
export function policyInfo(s, now = Date.now()) {
  const weeks = Object.keys(s.premiums || {}).sort();
  const last = weeks[weeks.length - 1] || null;
  return {
    active: policyActive(s), premium: PREMIUM, paidTotal: sum(s.premiums), paidUntil: last ? addDays(last, 6) : null,
    saved: streak(s, now).insuredDays.length, lapsed: !policyActive(s) && (s.policyLapse || 0) > 0 && s.policyLapse >= (s.policyOff || 0),
  };
}
export const BOOST = { id: 'boost', title: 'Двойной опыт', crowns: 40, minutes: 30, text: 'Полчаса после покупки уроки дают вдвое больше опыта.' };
export const OUTFITS = [
  { id: 'cap', slot: 'head', title: 'Кепка торговца', crowns: 25 },
  { id: 'beret', slot: 'head', title: 'Берет гравёра', crowns: 35 },
  { id: 'ushanka', slot: 'head', title: 'Ушанка ревизора', crowns: 50 },
  { id: 'bowler', slot: 'head', title: 'Котелок биржевика', crowns: 70 },
  { id: 'tophat', slot: 'head', title: 'Цилиндр банкира', crowns: 140 },
  { id: 'crown', slot: 'head', title: 'Корона казначея', note: 'Камни вспыхивают по очереди', crowns: 950, rare: true },
  { id: 'glasses', slot: 'face', title: 'Очки бухгалтера', crowns: 30 },
  { id: 'pince', slot: 'face', title: 'Пенсне профессора', crowns: 60 },
  { id: 'monocle', slot: 'face', title: 'Монокль', crowns: 100 },
  { id: 'bowtie', slot: 'neck', title: 'Бабочка', crowns: 25 },
  { id: 'scarf', slot: 'neck', title: 'Шарф', crowns: 40 },
  { id: 'tie', slot: 'neck', title: 'Галстук министра', crowns: 75 },
  { id: 'medal', slot: 'neck', title: 'Орден «За финансовую грамотность»', note: 'Качается на ленте и блестит', crowns: 760, rare: true },
  { id: 'paper', slot: 'hand', title: 'Свежий «Вестник»', crowns: 30 },
  { id: 'abacus', slot: 'hand', title: 'Счёты', crowns: 65 },
  { id: 'briefcase', slot: 'hand', title: 'Портфель с отчётом', crowns: 120 },
  { id: 'cane', slot: 'hand', title: 'Трость с набалдашником', crowns: 240 },
  { id: 'balloon', slot: 'hand', title: 'Шар «Инфляция»', note: 'То надувается, то сдувается — как цены', crowns: 1150, rare: true },
  { id: 'frame-guilloche', slot: 'frame', title: 'Рамка-гильош', crowns: 60 },
  { id: 'frame-gold', slot: 'frame', title: 'Золотой багет', crowns: 190 },
  { id: 'frame-diamond', slot: 'frame', title: 'Алмазная огранка', note: 'Грани медленно плывут по кругу', crowns: 1050, rare: true },
  /* УКРАШЕНИЯ УРОКА (src/learn-decor.jsx): не на Инфле, а над заданием в каждом уроке — живые, с
     физикой: их можно трогать, и они отзываются на ответы. Самое дорогое в лавке; своя витрина,
     в гардеробе их нет — надеть и снять можно прямо на витрине. */
  { id: 'desk-bunting', slot: 'desk', title: 'Гирлянда флажков', note: 'Потяните — флажки закачаются; верный ответ — порыв ветра', crowns: 1300, rare: true },
  { id: 'desk-cradle', slot: 'desk', title: 'Колыбель Ньютона', note: 'Оттяните один шарик или сразу несколько — столько же вылетит с другой стороны; верный ответ щёлкает сам', crowns: 1500, rare: true },
  { id: 'desk-mobile', slot: 'desk', title: 'Мобиле из монет', note: 'Коснитесь монетки — закрутится; верный ответ — все вспыхнут', crowns: 1650, rare: true },
  /* ТЕМЫ УРОКА (src/learn-skins.jsx): урок целиком — живой фон, свои кнопки вариантов и отклик на ответ.
     Место «theme», одна на все уроки; тоже не на Инфле и не в гардеробе. */
  { id: 'theme-mint', slot: 'theme', title: 'Тема «Монетный двор»', note: 'Гильош вращается, золотая пыль; варианты — банкноты; верный ответ — падает монета', crowns: 1350, rare: true },
  { id: 'theme-exchange', slot: 'theme', title: 'Тема «Биржа»', note: 'Тёмный терминал, бегут котировки; верный ответ — зелёная свеча', crowns: 1450, rare: true },
  { id: 'theme-blueprint', slot: 'theme', title: 'Тема «Чертёж»', note: 'Синька, кривые чертятся сами; верный ответ — галочка карандашом', crowns: 1550, rare: true },
  { id: 'theme-aurora', slot: 'theme', title: 'Тема «Северное сияние»', note: 'Ночное небо и сияние; варианты из стекла; верный ответ — падающая звезда', crowns: 1700, rare: true },
  /* ХЕЛЛОУИН (src/learn/halloween.js): продаются только в сезон, с 16 октября по 2 ноября, — своей
     витриной, не на витрине дня; купленное остаётся навсегда. «Паутину» не купить: она — награда
     за 13 тыкв. */
  { id: 'horns', slot: 'head', title: 'Рожки чертёнка', crowns: 90, season: 'halloween' },
  { id: 'witch', slot: 'head', title: 'Шляпа ведьмы', crowns: 160, season: 'halloween' },
  { id: 'batmask', slot: 'face', title: 'Маска летучей мыши', crowns: 120, season: 'halloween' },
  { id: 'cape', slot: 'neck', title: 'Воротник графа', crowns: 210, season: 'halloween' },
  { id: 'lantern', slot: 'hand', title: 'Тыква-фонарь', note: 'Огонёк внутри мерцает', crowns: 600, rare: true, season: 'halloween' },
  { id: WEB_FRAME, slot: 'frame', title: 'Паутина', note: 'Паучок качается на нитке', crowns: 650, rare: true, season: 'halloween', reward: true },
];
// хеллоуинская витрина: всё сезонное, кроме награды
export const SEASON_ITEMS = OUTFITS.filter((o) => o.season === 'halloween' && !o.reward).map((o) => o.id);
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export const DESK_ITEMS = OUTFITS.filter((o) => o.slot === 'desk').map((o) => o.id);
export const THEME_ITEMS = OUTFITS.filter((o) => o.slot === 'theme').map((o) => o.id);
// для урока, а не для Инфли: вещицы на столе и темы
export const LESSON_SLOTS = ['desk', 'theme'];
// вещи Инфли — без украшений урока
export const WARDROBE = OUTFITS.filter((o) => !LESSON_SLOTS.includes(o.slot));
export const SLOT_LABEL = { head: 'Голова', face: 'Лицо', neck: 'Шея', hand: 'В руке', frame: 'Рамка' };
export const SHOWCASE_SIZE = 6;
export const DEAL_OFF = 0.3;
const itemOf = (id) => (id === FREEZE.id ? FREEZE : id === BOOST.id ? BOOST : OUTFIT_BY_ID[id]);
/* Витрина дня: порядок обычных вещей задаёт дата (у всех учеников один), купленные до
   сегодняшнего дня пропускаются; скидка дня — на первую вещь витрины. Купленное сегодня
   остаётся на своём месте («Надеть»): витрина и скидка дня от покупки не меняются, только
   в полночь. */
export function shopDay(s, day) {
  const owned = {};
  Object.entries((s && s.owned) || {}).forEach(([id, at]) => { if (!(typeof at === 'number' && at > 0 && dayOf(at) === day)) owned[id] = at; });
  const order = OUTFITS.filter((o) => !o.rare && !o.season).map((o) => ({ o, k: hash01(`shop:${day}:${o.id}`) })).sort((a, b) => a.k - b.k).map((x) => x.o.id);
  const showcase = order.filter((id) => !owned[id]).slice(0, SHOWCASE_SIZE);
  return { showcase, deal: showcase[0] || null, rare: OUTFITS.filter((o) => o.rare && !o.season && !LESSON_SLOTS.includes(o.slot)).map((o) => o.id), desk: DESK_ITEMS, theme: THEME_ITEMS, season: halloweenOn(day) ? SEASON_ITEMS : [] };
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
  if (id === FREEZE.id) return { s, ok: false, reason: 'Страховка серии теперь — полис с еженедельным взносом: оформите его в лавке' };
  if (id === BOOST.id && boostActive(s, now)) return { s, ok: false, reason: 'Двойной опыт уже действует' };
  const outfit = id !== FREEZE.id && id !== BOOST.id;
  if (outfit && (s.owned || {})[id]) return { s, ok: false, reason: 'Уже куплено' };
  if (outfit && item.reward) return { s, ok: false, reason: 'Эту рамку не купить: она — награда за 13 тыкв на Хеллоуин' };
  if (outfit && item.season && !halloweenOn(day)) return { s, ok: false, reason: 'Хеллоуинские вещи продаются только на Хеллоуин — с 16 октября по 2 ноября' };
  if (outfit && !item.rare && !item.season && !shopDay(s, day).showcase.includes(id)) return { s, ok: false, reason: 'Сегодня этого нет на витрине — загляните завтра' };
  if (balance(s) < price) return { s, ok: false, reason: `Не хватает ${price - balance(s)} ${coinsWord(price - balance(s))}` };
  let t = { ...s, spent: { ...s.spent, [day]: ((s.spent || {})[day] || 0) + price } };
  if (id === BOOST.id) t = { ...t, boost: now + BOOST.minutes * 60000 };
  else t = { ...t, owned: { ...t.owned, [id]: now }, wear: { ...t.wear, [item.slot]: id, at: now } };
  return { s: t, ok: true, price };
}
// надеть купленное или снять (id = null)
export function setWear(s, slot, id, now = Date.now()) {
  if (id && (!(s.owned || {})[id] || OUTFIT_BY_ID[id].slot !== slot)) return s;
  return { ...s, wear: { ...s.wear, [slot]: id, at: now } };
}
export const outfitOf = (s) => { const w = s.wear || {}; return { head: w.head || null, face: w.face || null, neck: w.neck || null, hand: w.hand || null, frame: w.frame || null }; };
// украшение урока — одно на все уроки
export const deskOf = (s) => { const id = (s.wear || {}).desk; return id && (s.owned || {})[id] && OUTFIT_BY_ID[id] ? id : null; };
// тема урока — одна на все уроки
export const themeOf = (s) => { const id = (s.wear || {}).theme; return id && (s.owned || {})[id] && OUTFIT_BY_ID[id] ? id : null; };

/* ------------------------------ КОПИЛКА ИНФЛИ ------------------------------
   Монеты можно положить на 7 дней под ставку недели (в среднем 2% в день). Процент начисляется на
   накопленное, а не только на вложенное, — это сложный процент: при 2% за неделю 1000 монет
   вырастают до 1148, а не до 1140, как при простых 20 монетах в день. Забрать раньше срока можно,
   но процент сгорает — вернётся вложенное. Вклад один за раз. piggy — вклады { время вклада:
   монеты }, piggyOut — забранные { время вклада: сколько выдано }: ключи времени не пересекаются,
   и слияние устройств — просто объединение.
   Два вида вклада (docs/mechanics.md, «Копилка и сад»): срочный — без пополнений, по ставке недели;
   пополняемый (piggyTop { время вклада: 1 }) — ставка на 0,5 п. п. ниже, докладывать можно до конца
   срока (piggyAdd { время пополнения: «вклад:монеты» }); каждое пополнение растёт со своего дня. */
export const PIGGY = { rate: 0.02, days: 7, min: 10, addMin: 5, topupCut: 0.005, topupFloor: 0.005 };
// ставка пополняемого вклада: на 0,5 п. п. ниже ставки недели, но не ниже 0,5% в день
export const topupRate = (rate) => Math.max(PIGGY.topupFloor, Math.round((rate - PIGGY.topupCut) * 10000) / 10000);
const DAY_MS = 86400000;
/* СТАВКА НЕДЕЛИ (docs/mechanics.md, «Копилка и сад»): центральный банк меняет её по понедельникам
   не больше чем на шаг — по кругу 2 → 2,5 → 3 → 3 → 2,5 → 2 → 1,5 → 1 → 1 → 1,5%. Вклад держит
   ставку недели, когда его положили; спрос на рынке сада от ставки обратный: дорого копить —
   дёшево продавать. */
export const RATE_STEPS = [0.01, 0.015, 0.02, 0.025, 0.03];
export const DEMAND_STEPS = [1.15, 1.08, 1, 0.93, 0.86];
const RATE_CYCLE = [2, 3, 4, 4, 3, 2, 1, 0, 0, 1];
const weekNo = (day) => Math.round(new Date(`${weekOf(day)}T12:00:00`).getTime() / (7 * DAY_MS));
export const rateStep = (day) => RATE_CYCLE[((weekNo(day) % RATE_CYCLE.length) + RATE_CYCLE.length) % RATE_CYCLE.length];
export const weekRate = (day) => RATE_STEPS[rateStep(day)];
export const weekDemand = (day) => DEMAND_STEPS[rateStep(day)];
const isTopup = (s, at) => !!(s.piggyTop || {})[at];
const depositRate = (at, topup = false) => (topup ? topupRate(weekRate(dayOf(at))) : weekRate(dayOf(at)));
// пополнения вклада: [{ at, n }] по времени
const addsOf = (s, depAt) => Object.entries(s.piggyAdd || {}).map(([at, v]) => { const [d, n] = String(v).split(':').map(Number); return { at: Number(at), dep: d, n }; })
  .filter((x) => x.dep === depAt && x.n > 0).sort((a, b) => a.at - b.at);
// amount — всё вложенное (первый взнос и пополнения)
const deposits = (s) => Object.entries(s.piggy || {}).map(([at, first]) => {
  const t = Number(at); const adds = addsOf(s, t);
  return { at: t, first, adds, amount: first + adds.reduce((a, x) => a + x.n, 0), out: (s.piggyOut || {})[at] || 0, topup: isTopup(s, t) };
});
export function piggyLocked(s) { return deposits(s).filter((d) => !d.out).reduce((a, d) => a + d.amount, 0); }
export function piggyGain(s) { return deposits(s).filter((d) => d.out).reduce((a, d) => a + Math.max(0, d.out - d.amount), 0); }
// сколько стоит вклад через days дней под ставку rate: монеты — целые, дробь копится, но выдаётся по целой части
export const piggyValue = (amount, days, rate = PIGGY.rate) => Math.floor(amount * (1 + rate) ** Math.min(days, PIGGY.days) + 1e-9);
export const piggyCurve = (amount, rate = PIGGY.rate) => Array.from({ length: PIGGY.days + 1 }, (_, d) => ({ day: d, value: amount * (1 + rate) ** d }));
// открытый вклад: сколько дней лежит, сколько стоит сейчас, сколько дадут, если забрать сейчас
// стоимость вклада к моменту t: каждая часть (первый взнос и пополнения) растёт со своего дня до конца срока
const partsValue = (dep, rate, t) => {
  const end = Math.min(t, dep.at + PIGGY.days * DAY_MS);
  const parts = [{ at: dep.at, n: dep.first }, ...dep.adds];
  return Math.floor(parts.reduce((a, p) => a + p.n * (1 + rate) ** Math.max(0, Math.min(PIGGY.days, Math.floor((end - p.at) / DAY_MS))), 0) + 1e-9);
};
/* Путь вклада по дням для графика: в день d — только части, положенные к этому дню (пополнение —
   ступенька вверх), каждая растёт со своего дня; дальше сегодняшнего — без будущих пополнений.
   steps — в какой день на графике видно пополнение и на сколько. */
const pathOf = (dep, rate) => Array.from({ length: PIGGY.days + 1 }, (_, d) => {
  const t = dep.at + d * DAY_MS;
  return partsValue({ ...dep, adds: dep.adds.filter((x) => x.at <= t) }, rate, t);
});
const stepsOf = (dep) => {
  const by = {};
  dep.adds.forEach((x) => { const d = Math.min(PIGGY.days, Math.ceil((x.at - dep.at) / DAY_MS)); by[d] = (by[d] || 0) + x.n; });
  return Object.entries(by).map(([d, n]) => ({ day: Number(d), n })).sort((a, b) => a.day - b.day);
};
export function piggyState(s, now = Date.now()) {
  const open = deposits(s).filter((d) => !d.out).sort((a, b) => b.at - a.at)[0];
  if (!open) return null;
  const days = Math.min(PIGGY.days, Math.max(0, Math.floor((now - open.at) / DAY_MS)));
  const ripe = days >= PIGGY.days;
  const rate = depositRate(open.at, open.topup);
  const ripeAt = open.at + PIGGY.days * DAY_MS;
  const final = partsValue(open, rate, ripeAt);
  return { at: open.at, amount: open.amount, topup: open.topup, adds: open.adds.length, rate, days, ripe, value: partsValue(open, rate, now), final, payout: ripe ? final : open.amount,
    ripeAt, canAdd: open.topup && !ripe, path: pathOf(open, rate), steps: stepsOf(open) };
}
export function piggyPut(s, amount, now = Date.now(), { topup = false } = {}) {
  const n = Math.floor(amount);
  if (piggyState(s, now)) return { s, ok: false, reason: 'В копилке уже лежит вклад — сначала заберите его' };
  if (n < PIGGY.min) return { s, ok: false, reason: `Положить можно от ${PIGGY.min} монет` };
  if (balance(s) < n) return { s, ok: false, reason: `Не хватает ${n - balance(s)} ${coinsWord(n - balance(s))}` };
  const t = { ...s, piggy: { ...s.piggy, [now]: n } };
  if (topup) t.piggyTop = { ...s.piggyTop, [now]: 1 };
  return { s: t, ok: true, amount: n, rate: depositRate(now, topup), topup };
}
// пополнить открытый пополняемый вклад: до конца срока, от PIGGY.addMin монет
export function piggyAdd(s, amount, now = Date.now()) {
  const st = piggyState(s, now);
  const n = Math.floor(amount);
  if (!st) return { s, ok: false, reason: 'Копилка пуста' };
  if (!st.topup) return { s, ok: false, reason: 'Этот вклад без пополнений' };
  if (st.ripe) return { s, ok: false, reason: 'Срок вклада вышел — заберите его' };
  if (n < PIGGY.addMin) return { s, ok: false, reason: `Пополнить можно от ${PIGGY.addMin} монет` };
  if (balance(s) < n) return { s, ok: false, reason: `Не хватает ${n - balance(s)} ${coinsWord(n - balance(s))}` };
  let at = now; while ((s.piggyAdd || {})[at] || (s.piggy || {})[at]) at += 1;
  return { s: { ...s, piggyAdd: { ...s.piggyAdd, [at]: `${st.at}:${n}` } }, ok: true, amount: n };
}
export function piggyTake(s, now = Date.now()) {
  const st = piggyState(s, now);
  if (!st) return { s, ok: false, reason: 'Копилка пуста' };
  return { s: { ...s, piggyOut: { ...s.piggyOut, [st.at]: st.payout } }, ok: true, payout: st.payout, early: !st.ripe, lost: st.ripe ? 0 : st.value - st.amount };
}
export const piggyUsed = (s) => Object.keys(s.piggy || {}).length > 0;
/* ЗАРАБОТОК КУРСА — от него считаются цены лавки (docs/mechanics.md, «Экономика наград»).
   Ученик прошёл все уроки Пути: уроки впервые, половина без ошибок, проверка и сундук каждого
   юнита, цель дня — по два урока в день, бонусы серии за эти дни и печати, которые даёт сам
   курс. Задания дня и испытание месяца — сверху, их не считаем. */
export const PATH_LESSONS = LESSONS.length;
export const PATH_UNITS = UNITS.filter((u) => u.lessons.length).length;
export const RATE_MAX = 1.25; // худший курс кроны (rateOn держит его в 0,8–1,25)
const CHEST_AVG = 60;          // сундук — 40–80 монет
const COURSE_STAMPS = ['first', 'perfect', 'streak3', 'streak7', 'unit', 'kinds', 'saver'];
export function courseIncome(lessons = PATH_LESSONS, units = PATH_UNITS) {
  const days = Math.ceil(lessons / 2);
  const parts = {
    lessons: lessons * COIN.lesson,
    perfect: Math.floor(lessons / 2) * COIN.perfect,
    checks: units * COIN.check,
    chests: units * CHEST_AVG,
    goals: days * goalCoins(10),
    streak: STREAK_BONUS.filter(([d]) => d <= days).reduce((a, [, c]) => a + c, 0),
    stamps: ACHIEVEMENTS.filter((a) => COURSE_STAMPS.includes(a.id)).reduce((a, x) => a + x.coins, 0),
  };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0), days };
}
// средний заработок за урок: всё, что дал курс, делённое на его уроки (печати объявлены ниже — считаем лениво)
let perLesson = 0;
export const incomePerLesson = () => perLesson || (perLesson = Math.round(courseIncome().total / PATH_LESSONS));

/* Цена отказа: что ученик отдаёт за вещь — сколько уроков работы (по среднему заработку за
   урок, не больше уроков на Пути) и проценты, которые эти монеты принесли бы за неделю в копилке. */
export function forgone(price) {
  const lessons = Math.min(PATH_LESSONS, Math.max(1, Math.round(price / incomePerLesson())));
  return { lessons, week: piggyValue(price, PIGGY.days) - price, text: `≈ ${lessons} ${plural(lessons, 'урок', 'урока', 'уроков')}` };
}

/* Копилка — честно про проценты: 2% в день — это 730% годовых, в жизни так не бывает. Рядом —
   как растут реальные 8% годовых: 1000 крон за 10 лет (сложный процент, раз в год). */
export const PIGGY_YEARLY = Math.round(PIGGY.rate * 365 * 100);
export const REAL_RATE = 0.08;
export const realCurve = (amount = 1000, years = 10) => Array.from({ length: years + 1 }, (_, y) => ({ year: y, value: Math.round(amount * (1 + REAL_RATE) ** y) }));

/* ------------------------------ ЗАДАНИЯ ДНЯ ------------------------------
   Три задания: одно про уроки, одно про ответы, одно про опыт или новый урок; какие именно —
   решает дата, размер — цель дня в минутах. Минуты сами по себе — это цель дня (у неё своя
   награда), заданием их не дублируем. Всё считается только по сегодняшним занятиям.
   Выполнено — монеты сразу, все три — ещё бонус. */
const newToday = (s, day) => Object.values(s.lessons || {}).filter((l) => l && l.runs > 0 && l.at && dayOf(l.at) === day).length;
const QUEST = {
  lessons: { coins: 10, target: (s, now) => Math.max(2, Math.round(goalMinutes(s, now) / 5)), have: (d) => d.l, title: (t) => `Пройти ${t} ${plural(t, 'урок', 'урока', 'уроков')}` },
  perfect: { coins: 20, target: (s, now) => (goalMinutes(s, now) >= 15 ? 2 : 1), have: (d) => d.p, title: (t) => (t === 1 ? 'Урок без ошибок' : `${t} урока без ошибок`) },
  correct: { coins: 10, target: (s, now) => (goalMinutes(s, now) >= 15 ? 20 : 12), have: (d) => d.c, title: (t) => `${t} верных ответов` },
  run: { coins: 15, target: (s, now) => (goalMinutes(s, now) >= 15 ? 10 : 6), have: (d) => d.r, title: (t) => `${t} верных ответов подряд` },
  xp: { coins: 10, target: (s, now) => goalMinutes(s, now) * 3, have: (d, s, day) => (s.xp || {})[day] || 0, title: (t) => `Набрать ${t} опыта` },
  fresh: { coins: 15, target: () => 1, have: (d, s, day) => Math.max(d.n || 0, newToday(s, day)), title: () => 'Пройти новый урок на Пути' },
};
export const QUEST_ICON = { lessons: 'map', perfect: 'check', correct: 'coins', run: 'flame', xp: 'spark', fresh: 'target' };
export function questsFor(s, now = Date.now()) {
  const day = dayOf(now); const d = dailyOf(s, now);
  const pick = (list, salt) => list[Math.floor(mix01(`${day}:${salt}`) * list.length)];
  const ids = [pick(['lessons', 'perfect'], 'a'), pick(['correct', 'run'], 'b'), pick(['xp', 'fresh'], 'c')];
  return ids.map((id) => {
    const q = QUEST[id]; const target = q.target(s, now); const have = Math.min(target, q.have(d, s, day));
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
  { id: 'first', icon: 'footprints', title: 'Первый шаг', text: 'Пройден первый урок', how: 'Пройдите любой урок', coins: 10, test: (s, c) => c.lessonsDone >= 1 },
  // только за урок, пройденный без ошибок сейчас: счётчик дня растёт в момент такого урока (не «лучший результат» старых прохождений)
  { id: 'perfect', icon: 'check', title: 'Без помарок', text: 'Урок без единой ошибки', how: 'Пройдите урок без единой ошибки', coins: 20, test: (s) => Object.values(s.daily || {}).some((d) => d.p > 0) },
  { id: 'streak3', icon: 'flame', title: 'Три дня подряд', text: 'Серия — три дня', how: 'Занимайтесь три дня подряд', coins: 10, test: (s, c) => c.longest >= 3 },
  { id: 'streak7', icon: 'flame', title: 'Неделя в пути', text: 'Серия — семь дней', how: 'Занимайтесь семь дней подряд', coins: 30, test: (s, c) => c.longest >= 7 },
  { id: 'streak30', icon: 'flame', title: 'Месяц в пути', text: 'Серия — тридцать дней', how: 'Занимайтесь тридцать дней подряд', coins: 100, test: (s, c) => c.longest >= 30 },
  { id: 'unit', icon: 'landmark', title: 'Место на карте', text: 'Пройден первый юнит', how: 'Пройдите все уроки одного юнита', coins: 20, test: (s, c) => c.unitsDone >= 1 },
  { id: 'kinds', icon: 'shapes', title: 'Все жанры', text: 'Пройдены уроки всех восьми видов', how: 'Пройдите уроки всех восьми видов', coins: 30, test: (s, c) => c.kinds >= 8 },
  // знания, показанные делом: проверка юнита без единой ошибки (вступительный тест сам по себе печать не даёт)
  { id: 'ace', icon: 'graduation', title: 'Знаток', text: 'Проверка юнита — без единой ошибки', how: 'Сдайте проверку юнита без единой ошибки', coins: 30, test: (s) => Object.values(s.units || {}).some((u) => u.ace) },
  { id: 'quests', icon: 'scroll', title: 'Прилежание', text: 'Все задания дня — семь раз', how: 'Выполните все задания дня семь раз', coins: 40, test: (s) => Object.keys(s.claimed || {}).filter((k) => /^q:.*:all$/.test(k)).length >= 7 },
  { id: 'shop', icon: 'shopping', title: 'Первая покупка', text: 'Куплено что-то в лавке', how: 'Купите что-нибудь в лавке', coins: 10, test: (s) => Object.keys(s.owned || {}).length > 0 || Object.keys(s.freezeBuy || {}).length > 0 || (s.policyAt || 0) > 0 },
  { id: 'wardrobe', icon: 'shirt', title: 'Гардероб', text: 'У Инфли три наряда', how: 'Соберите Инфле три наряда', coins: 20, test: (s) => Object.keys(s.owned || {}).length >= 3 },
  { id: 'rare', icon: 'gem', title: 'Коллекционер', text: 'Куплена редкая вещь из витрины ювелира', how: 'Купите редкую вещь в витрине ювелира', coins: 100, test: (s) => Object.keys(s.owned || {}).some((id) => OUTFIT_BY_ID[id] && OUTFIT_BY_ID[id].rare && !LESSON_SLOTS.includes(OUTFIT_BY_ID[id].slot)) },
  { id: 'early', icon: 'sunrise', title: 'Ранняя пташка', text: 'Урок до восьми утра', how: 'Пройдите урок до восьми утра — по часам вашего устройства', coins: 10, test: (s) => Object.values(s.daily || {}).some((d) => d.h & 1) },
  { id: 'owl', icon: 'moon', title: 'Сова', text: 'Урок после десяти вечера', how: 'Пройдите урок после десяти вечера — по часам вашего устройства', coins: 10, test: (s) => Object.values(s.daily || {}).some((d) => d.h & 2) },
  { id: 'saver', icon: 'piggy', title: 'Пятьсот монет', text: 'Заработано 500 монет', how: 'Заработайте 500 монет', coins: 30, test: (s) => earned(s) >= 500 },
  { id: 'month', icon: 'calendar', title: 'Испытание месяца', text: 'Выполнено испытание месяца', how: 'Выполните испытание месяца', coins: 30, test: (s) => Object.keys(s.claimed || {}).some((k) => k.startsWith('m:')) },
  { id: 'diamond', icon: 'gem', title: 'Огранщик', text: 'Урок взят на алмазном уровне', how: 'Возьмите урок на алмазном уровне', coins: 20, test: (s) => Object.values(s.lessons || {}).some((l) => l.diamond) },
  // забег с другом (src/learn/friends.js): победа — отметка race:<id>:won
  { id: 'race', icon: 'flag', title: 'Забег', text: 'Выигран забег с другом', how: 'Позовите друга на забег и наберите за три дня больше опыта', coins: 30, test: (s) => Object.keys(s.claimed || {}).some((k) => /^race:[a-z0-9]+:won$/.test(k)) },
  { id: 'diamond10', icon: 'gem', title: 'Ювелир', text: 'Десять уроков на алмазном уровне', how: 'Возьмите десять уроков на алмазном уровне', coins: 60, test: (s) => Object.values(s.lessons || {}).filter((l) => l.diamond).length >= 10 },
];
export const achievementKey = (id) => `a:${id}`;

/* ------------------------------ ИСПЫТАНИЕ МЕСЯЦА ------------------------------ */
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const inMonth = (map, month) => Object.entries(map || {}).filter(([k]) => k.startsWith(month));
/* Испытание ПЕРСОНАЛЬНОЕ и посильное: цель считается от самого ученика.
   — Темп: цель дня в минутах → сколько это уроков, опыта, уроков без ошибок за день; за
     месяц — обычный темп пять дней из семи. Прежнее «шесть дней из семи и выше темпа, +20% к
     прошлому месяцу» было слишком трудным (жалоба: «задания месяца слишком сложные»): при цели
     10 минут выходило под восемьдесят уроков.
   — Бывают и испытания постоянства: заниматься N дней месяца, выполнить все задания дня N раз.
   — История: если в прошлом месяце сделано больше темпа — цель чуть больше прошлого (+10%, не
     меньше чем на единицу шага), иначе «теперь чуть больше» было бы неправдой.
   — Пришёл посреди месяца — темп и нижняя планка считаются по оставшимся дням.
   Цель закрепляется при первом показе (fixMonth) вместе с видом испытания; планы прежних
   правил (v меньше нынешней), пока марка не получена, считаются заново. */
const quests = (s, m) => Object.keys(s.claimed || {}).filter((k) => k.startsWith(`q:${m}`) && k.endsWith(':all')).length;
const MONTH_KINDS = [
  { id: 'minutes', floor: 200, round: 10, pace: (m) => m, title: (t) => `Заниматься ${t} минут в этом месяце`, unit: () => 'мин',
    have: (s, m) => Math.floor(inMonth(s.daily, m).reduce((a, [, d]) => a + (d.s || 0), 0) / 60) },
  { id: 'lessons', floor: 18, round: 1, pace: (m) => m / 6, title: (t) => `Пройти ${t} ${plural(t, 'урок', 'урока', 'уроков')} в этом месяце`, unit: (n) => plural(n, 'урок', 'урока', 'уроков'),
    have: (s, m) => inMonth(s.done, m).reduce((a, [, v]) => a + v, 0) },
  { id: 'perfect', floor: 8, round: 1, pace: (m) => m / 25, title: (t) => `${t} ${plural(t, 'урок', 'урока', 'уроков')} без единой ошибки в этом месяце`, unit: (n) => `${plural(n, 'урок', 'урока', 'уроков')} без ошибок`,
    have: (s, m) => inMonth(s.daily, m).reduce((a, [, d]) => a + d.p, 0) },
  { id: 'xp', floor: 450, round: 10, pace: (m) => m * 3, title: (t) => `Набрать ${t} опыта в этом месяце`, unit: () => 'опыта',
    have: (s, m) => inMonth(s.xp, m).reduce((a, [, v]) => a + v, 0) },
  { id: 'days', floor: 15, round: 1, pace: () => 1, steady: 'Испытание постоянства: больше половины дней месяца.', title: (t) => `Заниматься ${t} ${plural(t, 'день', 'дня', 'дней')} этого месяца`, unit: (n) => plural(n, 'день', 'дня', 'дней'),
    have: (s, m) => inMonth(s.done, m).filter(([, v]) => v > 0).length },
  { id: 'quests', floor: 8, round: 1, pace: () => 0.35, steady: 'Испытание постоянства: все три задания дня — два-три раза в неделю.', title: (t) => `Выполнить все задания дня ${t} ${plural(t, 'раз', 'раза', 'раз')} за месяц`, unit: (n) => plural(n, 'раз', 'раза', 'раз'),
    have: (s, m) => quests(s, m) },
];
const KIND_BY_ID = Object.fromEntries(MONTH_KINDS.map((k) => [k.id, k]));
export const MONTH_COINS = 100;
const ACTIVE_SHARE = 5 / 7;
const MONTH_PLAN_V = 3;
// первый день ученика: регистрация или самое раннее занятие
const firstDay = (s) => {
  const days = [...Object.keys(s.done || {}), ...Object.keys(s.xp || {})].sort();
  const reg = s.profile && s.profile.at ? dayOf(s.profile.at) : null;
  return [days[0], reg].filter(Boolean).sort()[0] || null;
};
const prevMonth = (month) => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export function monthChallenge(s, now = Date.now()) {
  const day = dayOf(now); const month = day.slice(0, 7);
  const key = `m:${month}`;
  const raw = (s.monthPlan || {})[month];
  // план прежних правил держим, только если марка уже получена; иначе — по новым
  const plan = raw && (raw.v === MONTH_PLAN_V || hasClaim(s, key)) ? raw : null;
  // месяц — по всемирному времени, как и день (src/textbook/learn-state.js)
  const d = new Date(now); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const start = firstDay(s) || day;
  const from = start.slice(0, 7) === month ? Number(start.slice(8)) : start < month ? 1 : d.getUTCDate();
  const span = last - from + 1;
  let kind = (plan && KIND_BY_ID[plan.kind]) || MONTH_KINDS[Math.floor(mix01(`month:${month}`) * MONTH_KINDS.length)];
  // пришёл под конец месяца — испытание постоянства («заниматься 2 дня») было бы пустым: берём объёмное
  if (!plan && kind.steady && span < 14) { const vol = MONTH_KINDS.filter((k) => !k.steady); kind = vol[Math.floor(mix01(`month:${month}:late`) * vol.length)]; }
  const mins = goalMinutes(s, now);
  const byPace = kind.pace(mins) * span * ACTIVE_SHARE;
  const before = kind.have(s, prevMonth(month));
  const up = (x) => Math.ceil(x / kind.round) * kind.round;
  // нижняя планка — за весь месяц; пришёл позже — по оставшимся дням, но не меньше половины: испытание, а не отметка
  const floor = up(kind.floor * Math.max(0.5, Math.min(1, span / last)));
  // дней в месяце больше не станет: испытание постоянства не выше оставшихся дней
  const cap = kind.steady ? span : Infinity;
  // прошлый месяц выше темпа — цель чуть больше прошлого: +10%, минимум на один шаг
  const grown = before > byPace ? Math.max(up(before * 1.1), before + kind.round) : 0;
  const fromHistory = grown <= cap ? grown : 0;
  // цель месяца закреплена при первом показе (fixMonth): поменяли цель дня — испытание то же
  const target = plan ? plan.target : Math.min(cap, Math.max(floor, up(byPace), fromHistory));
  // марка получена — испытание месяца выполнено до конца месяца, нового нет
  const have = hasClaim(s, key) ? target : Math.min(target, kind.have(s, month));
  // сегодня тоже считается: 29-го в 30-дневном месяце осталось два дня
  const daysLeft = last - d.getUTCDate() + 1;
  // почему именно столько — чтобы цель читалась как своя, а не взятая с потолка
  const why = plan && plan.why ? plan.why : fromHistory && target === fromHistory ? `В прошлом месяце — ${before}, теперь ${target}: чуть больше.`
    : kind.steady ? kind.steady
      : target === floor && up(byPace) < floor ? `По вашей цели — ${mins} минут в день: испытание чуть больше обычного темпа.`
        : `По вашей цели — ${mins} минут в день, пять дней в неделю.`;
  return { month, name: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, id: kind.id, title: kind.title(target), have, target, need: Math.max(0, target - have), unit: kind.unit(Math.max(0, target - have)),
    done: have >= target, claimed: hasClaim(s, key), key, coins: MONTH_COINS, daysLeft, why };
}
// закрепить испытание месяца: вид, цель и «почему» считаются один раз — при первом показе в месяце
export function fixMonth(s, now = Date.now()) {
  const month = dayOf(now).slice(0, 7);
  const cur = (s.monthPlan || {})[month];
  if (cur && (cur.v === MONTH_PLAN_V || hasClaim(s, `m:${month}`))) return s;
  const m = monthChallenge(s, now);
  return { ...s, monthPlan: { ...s.monthPlan, [month]: { target: m.target, why: m.why, at: now, kind: m.id, v: MONTH_PLAN_V } } };
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
  let t = fixMonth(chargePremiums(s, now), now);
  const day = dayOf(now);
  const g = goalToday(t, now);
  if (g.done >= g.goal) t = give(t, goalCoins(g.goal), `g:${day}`, `Цель дня: ${g.goal} минут`, 'goal');
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
