/* ДИЗАЙН-СИСТЕМА ОБУЧЕНИЯ: токены. Чистый модуль без React — его читают и компоненты
   (src/ds.jsx), и тема приложения (THEMES.learn / learnDark в src/MacroSimulator.jsx), и
   тесты. Облик — светлый и живой (docs/world.md, «Цвета» и «Форма»): почти белый тёплый фон,
   белые карточки, у каждого юнита свой яркий тёплый цвет; шрифты — PT Sans (заголовки,
   кнопки, текст) и PT Mono (числа); PT Serif — только у газеты.

   Темы: paper — светлая (по умолчанию в обучении), ink — тёмная (по выбору в профиле).
   «Мир» задаёт те же переменные из своей игровой темы (worldTokens). */

export const DS_FONT = {
  serif: "'PT Serif','Iowan Old Style','Palatino Linotype',Georgia,serif",
  sans: "'PT Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
  mono: "'PT Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
};

// цвета темы: бумага, карточка, краска трёх насыщенностей, линейки, верно/неверно, золото
export const DS_THEMES = {
  paper: {
    isDark: false,
    paper: '#FFFAF3', card: '#FFFFFF', card2: '#FFF1E2', ink: '#26201C', ink2: '#5A5049', ink3: '#6E645B',
    rule: '#F1E4D3', rule2: '#E2CBAE', ok: '#147A45', okInk: '#13693A', okBg: '#E3F7EA', bad: '#BF3A2B', badInk: '#A3271A', badBg: '#FFE9E4', okBtn: '#147A45', badBtn: '#D13B1F',
    gold: '#9A6300', goldSoft: '#F4B740', sel: '#FFEAD6', selInk: '#8A3E08', selRule: '#F0883A', warmBtn: '#C2490B', blue: '#2A5FBF', shade: 'rgba(160,90,30,.14)', accent: '#C2490B',
  },
  ink: {
    isDark: true,
    paper: '#14181C', card: '#1C2227', card2: '#242B32', ink: '#EEE7D7', ink2: '#BDB5A5', ink3: '#A29A8B',
    rule: '#353D45', rule2: '#4D5660', ok: '#62B882', okInk: '#AEE3C1', okBg: '#1B3226', bad: '#E2806F', badInk: '#F4BCB2', badBg: '#3A221E', okBtn: '#2B7048', badBtn: '#A23E32',
    gold: '#D8B25A', goldSoft: '#B8964A', sel: '#3A2B1D', selInk: '#F2DCBC', selRule: '#C98A55', blue: '#8FB3E0', shade: 'rgba(0,0,0,.45)', accent: '#C98A55',
  },
};

// отступы, скругления, размеры шрифта — одна шкала на все экраны
export const DS_SPACE = [0, 4, 8, 12, 16, 24, 32];
export const DS_RADIUS = { s: 4, m: 8, l: 14 };
export const DS_SIZE = { xs: 12.5, s: 14, m: 16, l: 18, xl: 22, xxl: 28, hero: 34 };

/* Юниты — места на карте Инфляции, по порядку курса дорога идёт спиралью: из Мастерской
   по часовой вдоль берега, потом внутренним кольцом к центру — без пересечений. Цвет — как у купюры своего достоинства (белый текст
   на нём читается с контрастом не ниже 4.5:1), здание — гравюра (src/ds.jsx, Engraving),
   region — округ карты, at — точка места на карте (поле 1000×720 из src/lib/mapgeo.js). */
// места по порядку Пути (юниты по уровням): дорога обходит страну петлёй, не пересекая себя
export const PLACES = {
  scarcity: { place: 'Мастерская', building: 'workshop', color: '#4D7C0F', region: 'industry', at: [245, 310], note: 'хлеб или станки' },
  'supply-demand': { place: 'Рынок', building: 'market', color: '#C2490B', region: 'capital', at: [320, 220], note: 'кофе, мука и цены' },
  consumer: { place: 'Универмаг', building: 'store', color: '#B0198F', region: 'capital', at: [785, 300], note: 'выбор покупателя' },
  elasticity: { place: 'Кофейня', building: 'cafe', color: '#C21E56', region: 'agri', at: [440, 180], note: 'реакция на цену' },
  production: { place: 'Завод', building: 'factory', color: '#B25E00', region: 'industry', at: [690, 395], note: 'труд и капитал' },
  costs: { place: 'Пекарня', building: 'bakery', color: '#9A6300', region: 'agri', at: [700, 515], note: 'издержки и прибыль' },
  'competition-monopoly': { place: 'Биржа', building: 'exchange', color: '#C9372C', region: 'finance', at: [610, 590], note: 'конкуренция и монополия' },
  monopolistic: { place: 'Ярмарка', building: 'market', color: '#9B2C8F', region: 'agri', at: [490, 615], note: 'похожие товары' },
  oligopoly: { place: 'Картель', building: 'factory', color: '#577A00', region: 'mining', at: [270, 548], note: 'несколько крупных' },
  labor: { place: 'Биржа труда', building: 'ministry', color: '#A9561A', region: 'industry', at: [370, 600], note: 'зарплаты и занятость' },
  'market-failures': { place: 'Порт', building: 'port', color: '#D13B1F', region: 'port', at: [585, 180], note: 'внешние эффекты и налоги' },
  gdp: { place: 'Статуправление', building: 'tower', color: '#A65A00', region: 'capital', at: [275, 450], note: 'как считают ВВП' },
  'money-banks': { place: 'Банк', building: 'bank', color: '#8F6A00', region: 'finance', at: [690, 215], note: 'деньги и кредит' },
  inflation: { place: 'Гастроном', building: 'grocery', color: '#C2304F', region: 'capital', at: [800, 175], note: 'цены и корзина' },
  'is-lm': { place: 'Казначейство', building: 'bank', color: '#7A7000', region: 'capital', at: [350, 360], note: 'ставка и выпуск' },
  'ad-as': { place: 'Промзона', building: 'factory', color: '#B83A1C', region: 'industry', at: [465, 300], note: 'спрос и предложение в целом' },
  phillips: { place: 'Профсоюз', building: 'ministry', color: '#5E7E0E', region: 'industry', at: [590, 290], note: 'инфляция и безработица' },
  policy: { place: 'Центробанк', building: 'bank', color: '#A3305E', region: 'capital', at: [600, 420], note: 'ставка и бюджет' },
  growth: { place: 'Электростанция', building: 'factory', color: '#BF4E14', region: 'port', at: [485, 480], note: 'модель Солоу' },
  'open-economy': { place: 'Таможня', building: 'port', color: '#A85A12', region: 'port', at: [360, 500], note: 'курс и торговля' },
  'public-debt': { place: 'Министерство', building: 'ministry', color: '#B3123F', region: 'capital', at: [400, 410], note: 'долг государства' },
  inequality: { place: 'Рабочий квартал', building: 'store', color: '#B0453A', region: 'periphery', at: [500, 385], note: 'доходы и бедность' },
};
export const placeOf = (unitId) => PLACES[unitId] || { place: 'Город', building: 'store', color: '#6B4357', region: 'capital', at: [496, 372], note: '' };
export const unitColor = (unitId) => placeOf(unitId).color;
/* Тёплая палитра (docs/world.md, «Цвета»): места юнитов, их кнопки и алмазный уровень — яркие
   тёплые цвета без бурых и коричневых. На каждом белый текст читается с контрастом не ниже
   4,5:1 (src/learn/__tests__/palette.test.js). */
export const WARM = {
  vermilion: '#D13B1F', tangerine: '#C2490B', amber: '#B25E00', gold: '#9A6300', leaf: '#4D7C0F', olive: '#577A00',
  raspberry: '#C21E56', rose: '#C2304F', fuchsia: '#B0198F', plum: '#9B2C8F', coral: '#C9372C', garnet: '#B3123F',
};
// алмазный уровень урока — малиновый гранат: камень, но из тёплой палитры
export const DIAMOND_COLOR = WARM.garnet;

// CSS-переменные темы: одна строка на корень экрана (ds-root)
export function tokenVars(t, accent) {
  return {
    '--ds-paper': t.paper, '--ds-card': t.card, '--ds-card2': t.card2, '--ds-ink': t.ink, '--ds-ink2': t.ink2, '--ds-ink3': t.ink3,
    '--ds-rule': t.rule, '--ds-rule2': t.rule2, '--ds-ok': t.ok, '--ds-ok-ink': t.okInk, '--ds-ok-bg': t.okBg,
    '--ds-bad': t.bad, '--ds-bad-ink': t.badInk, '--ds-bad-bg': t.badBg, '--ds-ok-btn': t.okBtn || t.ok, '--ds-bad-btn': t.badBtn || t.bad, '--ds-gold': t.gold, '--ds-gold-soft': t.goldSoft,
    '--ds-sel': t.sel, '--ds-sel-ink': t.selInk, '--ds-sel-rule': t.selRule, '--ds-warm-btn': t.warmBtn || t.selInk, '--ds-shade': t.shade, '--u': accent || t.accent,
    // заголовки и кнопки — PT Sans; засечки — только у газеты «Вестник» (--ds-news)
    '--ds-head': DS_FONT.sans, '--ds-news': DS_FONT.serif, '--ds-sans': DS_FONT.sans, '--ds-mono': DS_FONT.mono,
    colorScheme: t.isDark ? 'dark' : 'light',
  };
}
// «Мир» — те же переменные из тёмной игровой темы (COLOR), чтобы компоненты были одни
export const worldTokens = (C) => ({
  isDark: C.isDark !== false, paper: C.bg, card: C.panel, card2: C.panelAlt || C.panel, ink: C.text, ink2: C.muted, ink3: C.faint,
  rule: C.border, rule2: C.borderStrong || C.border, ok: C.teal, okInk: C.text, okBg: C.tealDim || C.panelAlt, bad: C.rust, badInk: C.text, badBg: C.rustDim || C.panelAlt,
  gold: C.gold, goldSoft: C.goldSoft, sel: C.sel || C.panelAlt, selInk: C.selText || C.text, selRule: C.selBorder || C.gold, shade: 'rgba(0,0,0,.4)', accent: C.gold,
});

/* Тема обучения в понятиях игровой темы (COLOR): учебник-справочник и упражнения берут
   цвета отсюда, поэтому они те же, что у компонентов дизайн-системы. */
export const appColors = (t) => ({
  bg: t.paper, bgVignette: t.paper, panel: t.card, panelAlt: t.card2, panelRaised: t.card,
  border: t.rule, borderStrong: t.rule2, hairline: t.rule,
  text: t.ink, muted: t.ink2, faint: t.ink3,
  paper: t.card2, paperText: t.ink, paperMuted: t.ink2, paperRule: t.rule2,
  gold: t.gold, goldSoft: t.gold, goldDim: `color-mix(in srgb, ${t.gold} 16%, transparent)`, ink: t.isDark ? '#0E1114' : '#1C2125',
  teal: t.ok, tealDim: t.okBg, rust: t.bad, rustDim: t.badBg,
  // выбранное — в тёплой гамме бумаги (не синим); синий остаётся только для линий графиков
  blue: t.blue || t.selRule, blueDim: `color-mix(in srgb, ${t.blue || t.selRule} 14%, ${t.card})`, sel: t.sel, selText: t.selInk, selBorder: t.selRule,
});

/* Настройки обучения на устройстве: тёмная тема (по умолчанию светлая), музыка (по
   умолчанию выключена — в обучении нужна тишина), звуки ответов (по умолчанию включены).
   В «Мире» музыка своя и играет как раньше. */
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* приватный режим */ } },
};
export const learnDark = () => store.get('ems-learn-dark') === '1';
export const setLearnDark = (on) => store.set('ems-learn-dark', on ? '1' : null);
export const learnThemeId = () => (learnDark() ? 'learnDark' : 'learn');
export const dsThemeId = () => (learnDark() ? 'ink' : 'paper');
export const learnMusic = () => store.get('ems-learn-music') === '1';
export const setLearnMusic = (on) => store.set('ems-learn-music', on ? '1' : null);
export const learnSfx = () => store.get('ems-learn-sfx') !== '0';
export const setLearnSfx = (on) => store.set('ems-learn-sfx', on ? null : '0');
// звук «Мира»: выключенная музыка (и звуки, громкость) остаётся выключенной после перезагрузки
export const worldMusic = () => store.get('ems-world-music') !== '0';
export const setWorldMusic = (on) => store.set('ems-world-music', on ? null : '0');
export const worldSfx = () => store.get('ems-world-sfx') !== '0';
export const setWorldSfx = (on) => store.set('ems-world-sfx', on ? null : '0');
export const worldVolume = () => { const v = parseFloat(store.get('ems-world-volume')); return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.6; };
export const setWorldVolume = (v) => store.set('ems-world-volume', String(v));
