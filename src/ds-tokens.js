/* ДИЗАЙН-СИСТЕМА ОБУЧЕНИЯ: токены. Чистый модуль без React — его читают и компоненты
   (src/ds.jsx), и тема приложения (THEMES.learn / learnDark в src/MacroSimulator.jsx), и
   тесты. Язык — деньги и печать: бумага и типографская краска, у каждого юнита свой цвет,
   как у купюры своего достоинства; шрифты проекта — PT Serif, PT Sans, PT Mono.

   Темы: paper — светлая бумага (по умолчанию в обучении), ink — тёмная (по выбору в
   профиле). «Мир» задаёт те же переменные из своей тёмной темы (worldTokens). */

export const DS_FONT = {
  serif: "'PT Serif','Iowan Old Style','Palatino Linotype',Georgia,serif",
  sans: "'PT Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
  mono: "'PT Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
};

// цвета темы: бумага, карточка, краска трёх насыщенностей, линейки, верно/неверно, золото
export const DS_THEMES = {
  paper: {
    isDark: false,
    paper: '#F3EEE2', card: '#FFFCF5', card2: '#ECE5D4', ink: '#1C2125', ink2: '#4A5157', ink3: '#62696F',
    rule: '#D6CCB7', rule2: '#B3A78E', ok: '#2D7A4B', okInk: '#1C5433', okBg: '#E2F0E3', bad: '#B0392D', badInk: '#8A2A20', badBg: '#F7E1DC', okBtn: '#2D7A4B', badBtn: '#B0392D',
    gold: '#9C7218', goldSoft: '#C9A24A', sel: '#E6ECF5', selInk: '#1E3C66', selRule: '#5F82B3', shade: 'rgba(60,45,20,.14)', accent: '#8A4B22',
  },
  ink: {
    isDark: true,
    paper: '#14181C', card: '#1C2227', card2: '#242B32', ink: '#EEE7D7', ink2: '#BDB5A5', ink3: '#A29A8B',
    rule: '#353D45', rule2: '#4D5660', ok: '#62B882', okInk: '#AEE3C1', okBg: '#1B3226', bad: '#E2806F', badInk: '#F4BCB2', badBg: '#3A221E', okBtn: '#2B7048', badBtn: '#A23E32',
    gold: '#D8B25A', goldSoft: '#B8964A', sel: '#22324A', selInk: '#D2E2F8', selRule: '#6A8FC2', shade: 'rgba(0,0,0,.45)', accent: '#C98A55',
  },
};

// отступы, скругления, размеры шрифта — одна шкала на все экраны
export const DS_SPACE = [0, 4, 8, 12, 16, 24, 32];
export const DS_RADIUS = { s: 4, m: 8, l: 14 };
export const DS_SIZE = { xs: 12.5, s: 14, m: 16, l: 18, xl: 22, xxl: 28, hero: 34 };

/* Юниты — места на карте Инфлатии, по порядку курса дорога идёт спиралью: из Мастерской
   по часовой вдоль берега, потом внутренним кольцом к центру — без пересечений. Цвет — как у купюры своего достоинства (белый текст
   на нём читается с контрастом не ниже 4.5:1), здание — гравюра (src/ds.jsx, Engraving),
   region — округ карты, at — точка места на карте (поле 1000×720 из src/lib/mapgeo.js). */
export const PLACES = {
  scarcity: { place: 'Мастерская', building: 'workshop', color: '#4B692C', region: 'industry', at: [245, 310], note: 'хлеб или станки' },
  'supply-demand': { place: 'Рынок', building: 'market', color: '#86461F', region: 'capital', at: [320, 220], note: 'кофе, мука и цены' },
  consumer: { place: 'Универмаг', building: 'store', color: '#2C5A8E', region: 'capital', at: [440, 180], note: 'выбор покупателя' },
  elasticity: { place: 'Лавка', building: 'store', color: '#65408F', region: 'agri', at: [565, 170], note: 'реакция на цену' },
  production: { place: 'Завод', building: 'factory', color: '#5A5650', region: 'industry', at: [690, 195], note: 'труд и капитал' },
  costs: { place: 'Пекарня', building: 'bakery', color: '#7A5616', region: 'agri', at: [785, 300], note: 'издержки и прибыль' },
  'competition-monopoly': { place: 'Биржа', building: 'exchange', color: '#A0372A', region: 'finance', at: [690, 395], note: 'конкуренция и монополия' },
  monopolistic: { place: 'Ярмарка', building: 'market', color: '#86446A', region: 'agri', at: [700, 515], note: 'похожие товары' },
  oligopoly: { place: 'Картель', building: 'factory', color: '#356653', region: 'mining', at: [610, 590], note: 'несколько крупных' },
  labor: { place: 'Биржа труда', building: 'ministry', color: '#4F5D80', region: 'industry', at: [490, 615], note: 'зарплаты и занятость' },
  'market-failures': { place: 'Порт', building: 'port', color: '#26677A', region: 'port', at: [370, 600], note: 'внешние эффекты и налоги' },
  gdp: { place: 'Статуправление', building: 'tower', color: '#465689', region: 'capital', at: [270, 548], note: 'как считают ВВП' },
  'money-banks': { place: 'Банк', building: 'bank', color: '#1D6860', region: 'finance', at: [275, 450], note: 'деньги и кредит' },
  'is-lm': { place: 'Казначейство', building: 'bank', color: '#65572B', region: 'capital', at: [350, 360], note: 'ставка и выпуск' },
  'ad-as': { place: 'Промзона', building: 'factory', color: '#763B3B', region: 'industry', at: [465, 300], note: 'спрос и предложение в целом' },
  phillips: { place: 'Профсоюз', building: 'ministry', color: '#4B5B2D', region: 'industry', at: [590, 290], note: 'инфляция и безработица' },
  policy: { place: 'Центробанк', building: 'bank', color: '#563878', region: 'capital', at: [600, 420], note: 'ставка и бюджет' },
  growth: { place: 'Электростанция', building: 'factory', color: '#2B5875', region: 'port', at: [485, 480], note: 'модель Солоу' },
  'open-economy': { place: 'Таможня', building: 'port', color: '#735030', region: 'port', at: [360, 500], note: 'курс и торговля' },
  'public-debt': { place: 'Министерство', building: 'ministry', color: '#54436A', region: 'capital', at: [500, 385], note: 'долг государства' },
  inequality: { place: 'Рабочий квартал', building: 'store', color: '#6A4838', region: 'periphery', at: [400, 410], note: 'доходы и бедность' },
};
export const placeOf = (unitId) => PLACES[unitId] || { place: 'Город', building: 'store', color: '#5A4E80', region: 'capital', at: [496, 372], note: '' };
export const unitColor = (unitId) => placeOf(unitId).color;

// CSS-переменные темы: одна строка на корень экрана (ds-root)
export function tokenVars(t, accent) {
  return {
    '--ds-paper': t.paper, '--ds-card': t.card, '--ds-card2': t.card2, '--ds-ink': t.ink, '--ds-ink2': t.ink2, '--ds-ink3': t.ink3,
    '--ds-rule': t.rule, '--ds-rule2': t.rule2, '--ds-ok': t.ok, '--ds-ok-ink': t.okInk, '--ds-ok-bg': t.okBg,
    '--ds-bad': t.bad, '--ds-bad-ink': t.badInk, '--ds-bad-bg': t.badBg, '--ds-ok-btn': t.okBtn || t.ok, '--ds-bad-btn': t.badBtn || t.bad, '--ds-gold': t.gold, '--ds-gold-soft': t.goldSoft,
    '--ds-sel': t.sel, '--ds-sel-ink': t.selInk, '--ds-sel-rule': t.selRule, '--ds-shade': t.shade, '--u': accent || t.accent,
    '--ds-serif': DS_FONT.serif, '--ds-sans': DS_FONT.sans, '--ds-mono': DS_FONT.mono,
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
  blue: t.selRule, blueDim: t.sel, sel: t.sel, selText: t.selInk, selBorder: t.selRule,
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
