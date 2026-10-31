import React, { useState, useEffect, Suspense } from 'react';
import { syncProgress, fetchRoom, track, trackDaily } from './lib/client.js';
import {
  Landmark, Coins, Globe2, TrendingUp, TrendingDown, Users, Scale, ShieldCheck, X, AlertTriangle, Target, Volume2,
  VolumeX, Music, Trophy, Lock, Share2, GraduationCap, BookOpenText, Crown, Gavel, Hammer, Play, Calendar, BookOpen,
  Vote, Layers, Award, BarChart3, Medal, Handshake, HeartHandshake, LifeBuoy, Ban, DoorOpen, Factory, Wheat, Route,
  UserRound, Map as MapIcon, ShoppingBag, Ellipsis, Newspaper,
} from 'lucide-react';
// звуковой движок подгружается по первому клику — в стартовом файле только обёртка
import { Audio } from './audio/lazy.js';
import { BrandLoader } from './logo.jsx';
import { useAccount, loadAccount, refreshAccount, NameGate } from './account.jsx';
import { isGuest, GUEST_START, GUEST_SAVE } from './lib/guest.js';
import { checkReturn } from './lib/retention.js';
import {
  DS_THEMES, appColors, learnThemeId, dsThemeId, learnMusic, learnSfx, worldMusic, setWorldMusic, worldSfx,
  setWorldSfx, worldVolume, setWorldVolume, worldThemeId, setWorldTheme,
} from './ds-tokens.js';
import { DsRoot, Tabs } from './ds.jsx';
import {
  loadProgress as loadTextbookProgress, saveProgress as saveTextbookProgress, mergeTextbook, TEXTBOOK_PROGRESS_KEY,
  PROGRESS_EVENT,
} from './textbook/progress.js';
import { featureOpen, FeatureLocked } from './learn-unlock.jsx';
import { BookLinkContext } from './booklink-context.js';
import { LATEST_NEWS, readNewsSeen, newsForLearner, learnerSince, readFeedSeenAt, friendNewsSince } from './learn/news.js';
import { friendsState } from './lib/friends-store.js';
// профиль игрока живёт в src/account.jsx; сетевой экран и партия берут его отсюда
export { AuthModal, useAccount, emblemIcon, forgetAccount, loadAccount, accountKidsMode, EMBLEMS } from './account.jsx';

export { Audio };

export const THEMES = {
  ink: { id: 'ink', name: 'Ночная канцелярия', dark: true, colors: {
    bg: '#0B0F17', bgVignette: '#0E1420', panel: '#161D2B', panelAlt: '#1B2333', panelRaised: '#202B41',
    border: '#28324A', borderStrong: '#3D4C6B', hairline: '#1F2A3D',
    text: '#E8E6DD', muted: '#A3AABB', faint: '#9199AC',
    paper: '#EDE7D6', paperText: '#22261D', paperMuted: '#6B6754', paperRule: '#C9BFA0',
    gold: '#C9A227', goldSoft: '#E8C766', goldDim: 'rgba(201,162,39,0.14)', ink: '#1B1204',
    teal: '#5AAE93', tealDim: 'rgba(90,174,147,0.14)',
    rust: '#E07A5F', rustDim: 'rgba(224,122,95,0.14)',
    blue: '#7C9DC6', blueDim: 'rgba(124,157,198,0.14)',
    sel: '#2E3B57', selText: '#F4F1E6', selBorder: '#56668A' } },
  slate: { id: 'slate', name: 'Холодный кабинет', dark: true, colors: {
    bg: '#0A1014', bgVignette: '#0C151B', panel: '#13202A', panelAlt: '#182833', panelRaised: '#1E3240',
    border: '#24404F', borderStrong: '#365C70', hairline: '#1B2E3A',
    text: '#DFE8EC', muted: '#A0B6C0', faint: '#8AA3AE',
    paper: '#E6E9E4', paperText: '#1C2428', paperMuted: '#63706F', paperRule: '#B7C2BF',
    gold: '#8FB8C9', goldSoft: '#BBDCEA', goldDim: 'rgba(143,184,201,0.14)', ink: '#08161C',
    teal: '#5FB396', tealDim: 'rgba(95,179,150,0.14)',
    rust: '#E08472', rustDim: 'rgba(224,132,114,0.14)',
    blue: '#82A3D0', blueDim: 'rgba(130,163,208,0.14)',
    sel: '#29404F', selText: '#F1F6F8', selBorder: '#4F7488' } },
  // светлая тема «Мира» — по умолчанию (docs/world.md, «Один облик»): тот же тёплый светлый фон, что в обучении
  chamber: { id: 'chamber', name: 'Дневная канцелярия', dark: false, colors: {
    bg: '#FFF8EE', bgVignette: '#FFFDF8', panel: '#FFFFFF', panelAlt: '#FFF3E4', panelRaised: '#FFFFFF',
    border: '#EEDFCB', borderStrong: '#DCC5A6', hairline: '#F3E8D8',
    text: '#26201C', muted: '#5A5049', faint: '#6E645B',
    paper: '#FFFDF8', paperText: '#26201C', paperMuted: '#6B6653', paperRule: '#E2CBAE',
    gold: '#9A6300', goldSoft: '#7A4E00', goldDim: 'rgba(154,99,0,0.12)', ink: '#FFFDF8',
    teal: '#17824A', tealDim: 'rgba(23,130,74,0.12)',
    rust: '#C9372C', rustDim: 'rgba(201,55,44,0.10)',
    blue: '#2F6FD6', blueDim: 'rgba(47,111,214,0.12)',
    sel: '#FFFFFF', selText: '#15130F', selBorder: '#C2490B' } },
  contrast: { id: 'contrast', name: 'Высокий контраст', dark: true, colors: {
    bg: '#000000', bgVignette: '#000000', panel: '#0A0A0A', panelAlt: '#141414', panelRaised: '#1C1C1C',
    border: '#6A6A6A', borderStrong: '#A8A8A8', hairline: '#4A4A4A',
    text: '#FFFFFF', muted: '#D6D6D6', faint: '#A8A8A8',
    paper: '#FFFFFF', paperText: '#000000', paperMuted: '#333333', paperRule: '#888888',
    gold: '#FFD23F', goldSoft: '#FFE485', goldDim: 'rgba(255,210,63,0.22)', ink: '#000000',
    teal: '#4DE0A8', tealDim: 'rgba(77,224,168,0.20)',
    rust: '#FF6B52', rustDim: 'rgba(255,107,82,0.20)',
    blue: '#7FC2FF', blueDim: 'rgba(127,194,255,0.20)',
    sel: '#FFFFFF', selText: '#000000', selBorder: '#FFFFFF' } },
};

/* Темы обучения (Путь, практика, профиль, учебник-справочник): светлая и яркая по
   умолчанию, тёмная — по выбору в профиле. В переключателе тем «Мира» их нет: там
   остаётся канцелярия. */
// цвета — из токенов дизайн-системы обучения (src/ds-tokens.js): бумага и тушь
THEMES.learn = { id: 'learn', name: 'Обучение', dark: false, learn: true, colors: appColors(DS_THEMES.paper) };
THEMES.learnDark = { id: 'learnDark', name: 'Обучение (тёмная)', dark: true, learn: true, colors: appColors(DS_THEMES.ink) };
// темы для переключателя в «Мире» и в партии — без тем обучения
export const WORLD_THEMES = Object.values(THEMES).filter((t) => !t.learn);

export const COLOR = { ...THEMES.chamber.colors, isDark: false };

export function applyTheme(id) {
  const t = THEMES[id] || THEMES.chamber;
  Object.assign(COLOR, t.colors, { isDark: t.dark });
}

// верхний свет на поверхностях: на тёмных темах — едва заметный, на светлой — молочный
const SHEEN = () => (COLOR.isDark ? { fill: 'rgba(255,255,255,0.03)', line: 'rgba(255,255,255,0.05)' } : { fill: 'rgba(255,255,255,0.55)', line: 'rgba(255,255,255,0.8)' });

/* PT Serif/PT Sans/PT Mono — единственное семейство на Google Fonts, спроектированное
   ParaType специально для кириллицы (программа «Общественные шрифты РФ»): в отличие
   от системных стеков или модных латинских гарнитур типа Fraunces/IBM Plex, здесь
   не будет незаметного отвала на Georgia для всего русского текста. Fragment Mono —
   акцентная цифирь для витринных KPI, к обычному тексту не применяется. */
export const FONT = {
  serif: "'PT Serif','Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif",
  sans: "'PT Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'PT Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
  numeral: "'Fragment Mono','PT Mono','SFMono-Regular',Consolas,Menlo,monospace",
};

/* Цвета темы — CSS-переменными на корне (--c-text, --c-muted, --c-gold…): новые
   стили пишутся через них и через служебные классы ниже, а не через style={{…}}
   с COLOR.x в каждом элементе. Смена темы — одна замена переменных. */
const kebab = (k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const themeVars = () => Object.entries(COLOR).filter(([, v]) => typeof v === 'string').map(([k, v]) => `--c-${kebab(k)}:${v};`).join('');
/* Служебные классы для самых частых повторов оформления. Двойной селектор
   (.ems-root .x) — чтобы класс весил больше обычных правил кнопок и панелей и
   вёл себя как прежний inline-стиль. */
const UTILITY_CSS = `
  .ems-root .t-text { color: var(--c-text); } .ems-root .t-muted { color: var(--c-muted); } .ems-root .t-faint { color: var(--c-faint); }
  .ems-root .t-gold { color: var(--c-gold); } .ems-root .t-goldsoft { color: var(--c-gold-soft); } .ems-root .t-rust { color: var(--c-rust); }
  .ems-root .t-teal { color: var(--c-teal); }
  .ems-root .fs-12 { font-size: 12px; } .ems-root .fs-13 { font-size: 13px; } .ems-root .fs-14 { font-size: 14px; } .ems-root .fs-16 { font-size: 16px; }
  .ems-root .p-12 { padding: 12px; } .ems-root .p-13 { padding: 13px; } .ems-root .p-14 { padding: 14px; }
  .ems-root .shrink-0 { flex-shrink: 0; } .ems-root .nowrap { white-space: nowrap; } .ems-root .rel { position: relative; }
  .ems-root .va-1 { vertical-align: -1px; } .ems-root .va-2 { vertical-align: -2px; } .ems-root .mr-5 { margin-right: 5px; }
  .ems-root .row-between { display: flex; justify-content: space-between; gap: 8px; }
  .ems-root .col-12 { display: flex; flex-direction: column; gap: 12px; }
  .ems-root .note { font-size: 12px; color: var(--c-faint); margin-top: 5px; line-height: 1.4; }
  .ems-root .bar-track { flex: 1; height: 4px; border-radius: 2px; background: var(--c-border); overflow: hidden; }
`;

export const GlobalStyle = () => (
  <style>{`
    .ems-root { ${themeVars()} }
    ${UTILITY_CSS}
    .ems-root { color-scheme:${COLOR.isDark ? 'dark' : 'light'}; background:${COLOR.bg} radial-gradient(ellipse 1100px 620px at 50% -8%, ${COLOR.bgVignette} 0%, ${COLOR.bg} 70%); color:${COLOR.text}; font-family:${FONT.sans}; min-height:100vh; }
    .ems-root * { box-sizing: border-box; }
    .ems-root :focus-visible { outline: 2px solid ${COLOR.goldSoft}; outline-offset: 2px; }
    /* заголовки — PT Sans (класс остался с прежним именем); засечки — только у газеты */
    .ems-serif { font-family:${FONT.sans}; }
    .ems-mono { font-family:${FONT.mono}; font-variant-numeric: tabular-nums; }
    .ems-numeral { font-family:${FONT.numeral}; font-variant-numeric: tabular-nums; }
    .ems-btn.ghost { background:transparent; border-color:transparent; color:${COLOR.faint}; box-shadow:none; }
    .ems-btn.ghost:hover { background:${COLOR.panelAlt}; border-color:${COLOR.border}; color:${COLOR.text}; box-shadow:none; }
    .ems-btn.secondary { background:transparent; border-color:${COLOR.border}; color:${COLOR.text}; }
    .ems-btn.secondary:hover { background:${COLOR.panelAlt}; border-color:${COLOR.borderStrong}; }
    /* Поверхности: мягкий верхний свет, тонкая светлая кромка сверху и глубокая,
       но рассеянная тень — панель лежит на столе, а не нарисована рамкой. */
    .ems-panel { background: linear-gradient(180deg, ${SHEEN().fill} 0%, rgba(0,0,0,0) 140px), ${COLOR.panel}; border:1px solid ${COLOR.border}; border-radius:10px;
      box-shadow: inset 0 1px 0 ${SHEEN().line}, 0 1px 2px rgba(0,0,0,0.10), 0 12px 28px -18px rgba(0,0,0,0.6); }
    .ems-panel-raised { background: linear-gradient(180deg, ${SHEEN().fill} 0%, rgba(0,0,0,0) 160px), ${COLOR.panelRaised}; border:1px solid ${COLOR.borderStrong}; border-radius:10px;
      box-shadow: inset 0 1px 0 ${SHEEN().line}, 0 2px 4px rgba(0,0,0,0.14), 0 18px 36px -16px rgba(0,0,0,0.6); }
    /* сегментированный переключатель: вкладки в одной «капсуле», выбранная — золотая таблетка */
    .ems-seg { display:inline-flex; gap:2px; padding:3px; border-radius:11px; background:${COLOR.bg}; border:1px solid ${COLOR.border};
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.25); }
    .ems-seg > button { font-family:${FONT.sans}; border:none; background:transparent; color:${COLOR.muted}; border-radius:8px; padding:6px 12px; font-size:13px;
      display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; transition: background .15s, color .15s, box-shadow .15s; white-space:nowrap; }
    .ems-seg > button:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    /* Выбранное — нейтральной «поднятой» плашкой, не золотом: золото на экране
       остаётся только у главного действия («Завершить квартал», «Принять…»),
       иначе выбранный фильтр «5 лет» спорит с кнопкой хода. */
    .ems-seg > button[aria-pressed="true"] { background:${COLOR.sel}; color:${COLOR.selText}; font-weight:700; box-shadow: inset 0 0 0 1px ${COLOR.selBorder}, 0 1px 3px rgba(0,0,0,0.25); }
    /* плашка статуса в шапке: период, выборы, благополучие — одной карточкой */
    .ems-status { display:flex; align-items:center; gap:14px; padding:6px 14px; border-radius:12px; border:1px solid ${COLOR.border};
      background: linear-gradient(180deg, ${SHEEN().fill}, rgba(0,0,0,0)), ${COLOR.panelAlt}; box-shadow: inset 0 1px 0 ${SHEEN().line}; }
    .ems-status .sep { width:1px; align-self:stretch; background:${COLOR.hairline}; }
    /* свёрнутый блок кабинета — строка с названием и сводкой; развёрнутый получает
       язычок «свернуть» на нижней кромке */
    .ems-fold { width:100%; display:flex; align-items:center; gap:9px; padding:11px 14px; border-radius:10px; border:1px solid ${COLOR.border}; cursor:pointer;
      background: linear-gradient(180deg, ${SHEEN().fill}, rgba(0,0,0,0)), ${COLOR.panel}; color:${COLOR.text}; text-align:left; font-family:${FONT.sans};
      box-shadow: inset 0 1px 0 ${SHEEN().line}; transition: border-color .15s, background .15s; }
    .ems-fold:hover { border-color:${COLOR.borderStrong}; background:${COLOR.panelAlt}; }
    .ems-fold-close { position:absolute; left:50%; bottom:-10px; transform:translateX(-50%); z-index:2; display:inline-flex; align-items:center; gap:3px;
      font-family:${FONT.sans}; font-size:12px; padding:2px 10px; border-radius:999px; border:1px solid ${COLOR.border}; background:${COLOR.panelAlt}; color:${COLOR.faint}; cursor:pointer; }
    .ems-fold-close:hover { color:${COLOR.text}; border-color:${COLOR.borderStrong}; }
    .ems-eyebrow { font-family:${FONT.mono}; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:${COLOR.faint}; }
    .ems-hr { height:1px; background:${COLOR.hairline}; border:none; margin:0; }
    .ems-btn { font-family:${FONT.sans}; cursor:pointer; border:1px solid ${COLOR.border}; background:${COLOR.panelAlt}; color:${COLOR.text}; padding:8px 14px; border-radius:8px; font-size:13px; transition:background .15s, border-color .15s, transform .1s, box-shadow .15s; user-select:none; -webkit-user-select:none;
      box-shadow: inset 0 1px 0 ${SHEEN().line}; }
    .ems-btn:hover { background:${COLOR.panelRaised}; border-color:${COLOR.borderStrong}; box-shadow: 0 3px 10px -4px rgba(0,0,0,0.35); }
    .ems-btn:active { transform: scale(0.98); }
    .ems-btn.primary { background: linear-gradient(180deg, ${COLOR.goldSoft} -40%, ${COLOR.gold} 60%); color:${COLOR.ink}; border-color:${COLOR.gold}; font-weight:600;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px -4px ${COLOR.gold}66; letter-spacing:0.01em; }
    .ems-btn.primary:hover { background:${COLOR.goldSoft}; border-color:${COLOR.goldSoft}; box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 22px -4px ${COLOR.gold}88; }
    .ems-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; box-shadow:none; }
    .ems-slider { -webkit-appearance:none; width:100%; height:4px; background:${COLOR.border}; outline:none; border-radius:2px; }
    .ems-slider::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-slider::-moz-range-thumb { width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-scroll::-webkit-scrollbar { width:6px; height:6px; }
    .ems-scroll::-webkit-scrollbar-thumb { background:${COLOR.border}; border-radius:3px; }
    /* Полоса прокрутки самой страницы (не только внутренних панелей .ems-scroll):
       по умолчанию браузер рисует её светло-серой поверх тёмного фона — на тёмных
       темах это выглядит инородным светлым столбиком. Красим в цвет темы, тонкую
       и без трека, чтобы прокрутка не спорила с остальным интерфейсом. */
    html { scrollbar-width: thin; scrollbar-color: ${COLOR.border} transparent; }
    ::-webkit-scrollbar { width:8px; height:8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background:${COLOR.border}; border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:${COLOR.borderStrong}; }
    .ems-tab { font-family:${FONT.sans}; border:none; background:transparent; line-height:1.3; padding:7px 12px; font-size:13px; cursor:pointer; border-radius:7px; color:${COLOR.muted}; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:5px; transition:background .15s, color .15s, box-shadow .15s; user-select:none; -webkit-user-select:none; }
    .ems-tab:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    .ems-tab.active { color:${COLOR.selText}; background:${COLOR.sel}; font-weight:700; box-shadow: inset 0 0 0 1px ${COLOR.selBorder}; }
    .ems-tab.active:hover { background:${COLOR.sel}; color:${COLOR.selText}; }
    /* Ряд вкладок: на широком экране переносится на вторую строку — все вкладки
       видны сразу; на телефоне листается вбок, а правый край гаснет, чтобы было
       видно, что вкладки продолжаются. */
    .ems-tabrow { display:flex; flex-wrap:wrap; gap:2px; }
    @media (max-width: 640px) {
      .ems-tabrow { flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; padding-right:24px;
        -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 36px), transparent); }
      .ems-tabrow::-webkit-scrollbar { display:none; }
      .ems-tabrow > * { flex-shrink:0; }
    }
    .ems-fade-in { animation: emsFade .35s ease; }
    @keyframes emsFade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
    .ems-toast-out { animation: emsToastOut .45s ease forwards; }
    @keyframes emsToastOut { from { opacity:1; transform:translateY(0) scale(1);} to { opacity:0; transform:translateY(10px) scale(0.96);} }
    .ems-confetti-piece { border-radius:1px; opacity:1; animation: emsConfettiBurst .85s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes emsConfettiBurst { 0% { transform:translate(-50%,-50%) rotate(0deg); opacity:1; }
      100% { transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); opacity:0; } }
    .ems-quarter-stamp { opacity:0; animation: emsStamp .85s cubic-bezier(.2,.75,.25,1) forwards; filter: drop-shadow(0 8px 22px rgba(0,0,0,0.45)); }
    @keyframes emsStamp { 0% { transform:scale(2.4) rotate(-10deg); opacity:0; } 20% { transform:scale(0.92) rotate(2deg); opacity:0.92; }
      32% { transform:scale(1) rotate(0deg); opacity:0.85; } 78% { opacity:0.55; } 100% { opacity:0; transform:scale(1.02) rotate(0deg); } }
    @media (prefers-reduced-motion: reduce) { .ems-fade-in, .ems-toast-out { animation:none; } .ems-confetti-piece, .ems-quarter-stamp { animation:none; display:none; } .ems-btn, .ems-tab { transition:none; } }

    /* --- «Витринные» приёмы: крупный заголовок экрана, интерактивные карточки,
       атмосферный фон — используются на входных экранах (меню, новая партия,
       обучение, сеть), а не в плотном игровом дашборде. --- */
    .ems-hero-bg { position: relative; z-index: 0; }
    .ems-hero-bg::before {
      content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
      background:
        radial-gradient(760px 460px at 12% -12%, ${COLOR.goldDim} 0%, transparent 62%),
        radial-gradient(640px 420px at 105% 8%, ${COLOR.tealDim} 0%, transparent 58%);
      opacity: 0.8;
    }
    .ems-hero-eyebrow { font-family: ${FONT.mono}; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: ${COLOR.gold}; }
    .ems-hero-title { font-family: ${FONT.serif}; font-size: 40px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.14; margin: 12px 0 0;
      color: ${COLOR.text}; background: linear-gradient(180deg, ${COLOR.text} 0%, ${COLOR.muted} 145%);
      background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .ems-hero-title.small { font-size: 27px; }
    @media (max-width: 480px) { .ems-hero-title { font-size: 30px; } .ems-hero-title.small { font-size: 22px; } }
    .ems-hero-rule { width: 88px; height: 3px; margin: 18px auto 0; border-radius: 2px;
      background: linear-gradient(90deg, transparent, ${COLOR.gold}, transparent); }
    .ems-hero-badge { display: inline-flex; align-items: center; gap: 7px; font-family: ${FONT.mono}; font-size: 12px; color: ${COLOR.muted};
      padding: 6px 13px; border: 1px solid ${COLOR.border}; border-radius: 999px; background: ${COLOR.panelAlt}; margin-top: 18px; }
    .ems-hero-lede { color: ${COLOR.muted}; font-size: 14px; margin: 16px auto 0; max-width: 560px; line-height: 1.65; }
    .ems-card-btn { position: relative; display: flex; align-items: center; gap: 15px; cursor: pointer;
      border-radius: 13px; border: 1px solid ${COLOR.border}; background: ${COLOR.panel};
      box-shadow: 0 1px 2px rgba(0,0,0,0.14), 0 12px 28px -16px rgba(0,0,0,0.55);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      user-select: none; -webkit-user-select: none; }
    .ems-card-btn:hover, .ems-card-btn:focus-visible { transform: translateY(-2px); border-color: ${COLOR.gold};
      background: ${COLOR.panelRaised}; box-shadow: 0 1px 2px rgba(0,0,0,0.18), 0 18px 36px -16px rgba(0,0,0,0.65); }
    .ems-card-btn:active { transform: translateY(0); }
    .ems-card-icon { width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, ${COLOR.goldDim}, transparent); border: 1px solid ${COLOR.goldDim};
      transition: transform .18s ease, border-color .18s ease; }
    .ems-card-btn:hover .ems-card-icon { transform: scale(1.07) rotate(-2deg); border-color: ${COLOR.gold}; }
    .ems-card-chevron { transition: transform .18s ease; }
    .ems-card-btn:hover .ems-card-chevron { transform: translateX(3px) rotate(-90deg); }
    .ems-row-hover { border-radius: 9px !important; transition: background-color .15s ease, border-color .15s ease; user-select: none; -webkit-user-select: none; }
    .ems-row-hover:hover { background: ${COLOR.panelRaised} !important; border-color: ${COLOR.borderStrong} !important; }
    .ems-theme-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 9px; border-radius: 999px; font-size: 12px;
      cursor: pointer; transition: border-color .15s ease, background-color .15s ease, transform .15s ease; }
    .ems-theme-chip:hover { transform: translateY(-1px); }
    .ems-theme-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); }
    @media (prefers-reduced-motion: reduce) {
      .ems-card-btn, .ems-card-icon, .ems-card-chevron, .ems-theme-chip { transition: none !important; }
      .ems-card-btn:hover, .ems-card-btn:hover .ems-card-icon, .ems-card-btn:hover .ems-card-chevron { transform: none !important; }
    }
    .ems-grid { display:grid; grid-template-columns: 300px minmax(0,1fr) 300px; gap:14px; align-items:start; }
    @media (max-width: 1240px) { .ems-grid { grid-template-columns: 280px minmax(0,1fr); } }
    @media (max-width: 860px) { .ems-grid { grid-template-columns: minmax(0,1fr); padding: 12px !important; gap: 10px; } }
    @media (max-width: 860px) { .ems-hide-narrow { display: none !important; } }
    @media (max-width: 640px) { .ems-pad { padding-left: 10px !important; padding-right: 10px !important; } }
    .ems-col-hidden { display: none !important; }
    .ems-dense .ems-visual { display: none !important; }
    .ems-dense .ems-panel { padding-top: 9px !important; padding-bottom: 9px !important; }
    @keyframes emsSweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes emsBlink { 0%,45% { opacity: 1; } 55%,100% { opacity: 0.15; } }
    @keyframes emsShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-2px,1px); }
      40% { transform: translate(2px,-1px); } 60% { transform: translate(-1px,-1px); } 80% { transform: translate(1px,1px); } }
    @keyframes emsFlash { 0% { opacity: 0.5; } 100% { opacity: 0; } }
    @keyframes emsBreathe { 0%,100% { opacity: var(--p, 0.12); } 50% { opacity: calc(var(--p, 0.12) * 2.4); } }
    .ems-blink { animation: emsBlink 1.1s steps(1) infinite; }
    .ems-shake { animation: emsShake 0.45s ease-in-out 2; }
    .ems-flash { animation: emsFlash 0.9s ease-out forwards; }
    .ems-breathe { animation: emsBreathe 4.2s ease-in-out infinite; }
    .ems-sweep { animation: emsSweep 3.2s linear infinite; }
    /* Терминал — две колонки одной фиксированной высоты, каждая со своей прокруткой.
       Иначе карточка инструмента растёт от журнала сделок и тянет вниз всю страницу,
       а список слева остаётся прежней высоты и под ним зияет пустое место. */
    .ems-terminal { display:grid; grid-template-columns: minmax(230px, 0.85fr) minmax(300px, 1.15fr);
      height: clamp(480px, 68vh, 760px); }
    .ems-terminal > * { min-height: 0; overflow-y: auto; }
    @media (max-width: 900px) {
      .ems-terminal { grid-template-columns: minmax(0,1fr); height: auto; }
      .ems-terminal > * { overflow-y: visible; }
      /* 320px оставлял на телефоне буквально три строки списка (заголовок с
         поиском и фильтрами занимает почти половину этого места) — список
         инструментов приходилось листать, чтобы просто увидеть, что вообще есть.
         58vh подняло это только до четырёх — на карточку и график места на
         телефоне и так хватает своей прокруткой, отдаём списку заметно больше. */
      .ems-terminal > :first-child { max-height: min(76vh, 660px); overflow-y: auto; }
    }
    .ems-market-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap:12px; }
    @media (max-width: 420px) { .ems-market-grid { grid-template-columns: minmax(0,1fr); } }
    @keyframes emsPulse { 0%,100% { opacity: var(--p, 0.2); } 50% { opacity: calc(var(--p, 0.2) * 2.1); } }
    .ems-pulse { animation: emsPulse 3.4s ease-in-out infinite; }
    @keyframes emsDiceRoll { 0% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-100deg) scale(1.1); } 50% { transform: rotate(140deg) scale(0.94); } 75% { transform: rotate(-60deg) scale(1.08); } 100% { transform: rotate(360deg) scale(1); } }
    .ems-dice-roll { animation: emsDiceRoll 0.55s cubic-bezier(.34,1.56,.64,1); }
    @keyframes emsCardDeal { 0% { opacity:0; transform: translate(-26px,-10px) rotate(-8deg) scale(0.85); } 100% { opacity:1; transform: translate(0,0) rotate(0deg) scale(1); } }
    .ems-card-deal { animation: emsCardDeal 0.3s cubic-bezier(.2,.8,.3,1.2) backwards; }
    @keyframes emsCardFlip { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(92deg); } 100% { transform: rotateY(0deg); } }
    .ems-card-flip { animation: emsCardFlip 0.42s ease-in-out; }
    @keyframes emsWinPulse { 0% { box-shadow: 0 0 0 0 ${COLOR.teal}99; } 75% { box-shadow: 0 0 0 18px ${COLOR.teal}00; } 100% { box-shadow: 0 0 0 0 ${COLOR.teal}00; } }
    .ems-win-pulse { animation: emsWinPulse 1s ease-out; }
    @keyframes emsLosePulse { 0% { box-shadow: 0 0 0 0 ${COLOR.rust}99; } 75% { box-shadow: 0 0 0 14px ${COLOR.rust}00; } 100% { box-shadow: 0 0 0 0 ${COLOR.rust}00; } }
    .ems-lose-pulse { animation: emsLosePulse 0.7s ease-out; }
    @keyframes emsCoinPop { 0% { opacity:0; transform: translateY(6px) scale(0.7); } 55% { opacity:1; transform: translateY(-3px) scale(1.12); } 100% { opacity:1; transform: translateY(0) scale(1); } }
    .ems-coin-pop { animation: emsCoinPop 0.4s cubic-bezier(.2,.8,.3,1.3); }
    @keyframes emsReelBlur { 0%,100% { filter: blur(0); } 50% { filter: blur(2.5px); } }
    .ems-reel-spin { animation: emsReelBlur 0.11s linear infinite; }
    @keyframes emsWheelGlow { 0%,100% { box-shadow: 0 0 0 0 ${COLOR.goldDim}; } 50% { box-shadow: 0 0 22px 4px ${COLOR.goldDim}; } }
    .ems-wheel-idle { animation: emsWheelGlow 2.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .ems-dice-roll, .ems-card-deal, .ems-card-flip, .ems-win-pulse, .ems-lose-pulse, .ems-coin-pop, .ems-reel-spin, .ems-wheel-idle { animation: none !important; }
    }
    .ems-paper-cols { column-count: 2; }
    @media (max-width: 760px) { .ems-paper-cols { column-count: 1 !important; } }
    .ems-kpi-strip { display:grid; grid-template-columns: repeat(auto-fit, minmax(158px,1fr)); gap:10px; }
    .ems-kpi-cell.hero { grid-column: span 2; }
    .ems-kpi-ctl { position:absolute; top:3px; right:3px; display:flex; gap:1px; align-items:center; transition: opacity .15s; }
    .ems-kpi-ctl button { background:none; border:none; cursor:pointer; color:${COLOR.faint}; padding:4px 5px; line-height:1; font-size:12px; border-radius:5px; font-family:${FONT.sans}; display:inline-flex; }
    .ems-kpi-ctl button:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    @media (hover: hover) {
      .ems-kpi-cell .ems-kpi-ctl { opacity:0; }
      .ems-kpi-cell:hover .ems-kpi-ctl, .ems-kpi-cell:focus-within .ems-kpi-ctl, .ems-kpi-edit .ems-kpi-ctl { opacity:1; }
    }
    /* на сенсорном экране нет наведения: крестик «убрать» виден всегда, стрелки — только в режиме правки */
    @media (hover: none) {
      .ems-kpi-cell .ems-kpi-ctl { opacity:1; }
      .ems-kpi-strip:not(.ems-kpi-edit) .ems-kpi-ctl button:not(:last-child) { display:none; }
      .ems-kpi-ctl button { padding:6px 7px; }
      /* название не должно уходить под крестик */
      .ems-kpi-cell .ems-kpi-label { padding-right: 22px; }
    }
    /* На телефоне — три узкие плитки в ряд без спарклайнов: шесть показателей
       занимали весь первый экран, и до рычагов приходилось листать. */
    @media (max-width: 700px) {
      .ems-kpi-strip { grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; }
      .ems-kpi-cell.hero { grid-column: 1 / -1; }
      .ems-kpi-hint { display:none !important; }
      .ems-kpi-tile:not(.hero) { padding: 8px 8px 8px 11px !important; }
      .ems-kpi-tile:not(.hero) .ems-kpi-spark { display:none; }
      .ems-kpi-val { font-size: 17px !important; }
      .ems-kpi-hero-val { font-size: 28px !important; }
    }
    .ems-summary-sep { width:1px; height:16px; background:${COLOR.hairline}; }
    @media (max-width: 640px) { .ems-risk-track, .ems-summary-sep { display:none !important; } }
    /* Практика в курсе: на широком экране условие задачи слева, рабочие панели
       (рычаги, панель президента, лента новостей) справа — вместо одной длинной
       колонки посреди пустого экрана. На узком остаётся один столбец. */
    .ems-tut-cols { display:grid; grid-template-columns: 1fr; gap:0 20px; }
    @media (min-width: 1000px) { .ems-tut-cols { grid-template-columns: minmax(0,1fr) minmax(320px,0.95fr); } }
  `}</style>
);

// пятиконечная звезда: точки чередуют внешний/внутренний радиус через 36°,
// начиная сверху — обычная параметрическая формула геральдической звезды
export function starPath(cx, cy, rOuter, rInner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + i * (Math.PI / 5);
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export const ROLE_ICON = { landmark: Landmark, coins: Coins, globe: Globe2, chart: TrendingUp, crown: Crown, factory: Factory };

/* Звук и саундтрек живут в src/audio/: tracks.js — пьесы и плейлисты, engine.js — движок. */

/* Ни одна полноэкранная модалка (газета, достижения, карточка результата,
   график реакции и т.д.) не закрывалась по Esc — только кликом мимо или по
   крестику, то есть только мышью/тапом. Один хук на все модалки разом. */
export function useEscapeClose(onClose) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/* Общая логика для выпадающих панелей в шапке (звук, вид): не даёт двум
   открыться одновременно и накрыть друг друга, и считает позицию от кнопки
   через getBoundingClientRect + fixed — на телефоне, где шапка переносится
   на новую строку, обычный position:absolute+right:0 может унести панель
   за край экрана, потому что «правый край» отсчитывается не от кнопки. */
let dropdownActiveId = 0;

let dropdownSeq = 0;

const dropdownListeners = new Set();

export function useExclusiveDropdown(width) {
  const idRef = React.useRef(0);
  if (!idRef.current) idRef.current = ++dropdownSeq;
  const btnRef = React.useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, bottom: 'auto', left: 0, maxHeight: '80vh' });
  React.useEffect(() => {
    const onOther = () => { if (dropdownActiveId !== idRef.current) setOpen(false); };
    dropdownListeners.add(onOther);
    return () => dropdownListeners.delete(onOther);
  }, []);
  // Esc не закрывала ни одно из выпадающих меню на всей панели (звук, вид,
  // «⋯») — мышью/тапом мимо можно, с клавиатуры некуда деться, кроме Tab
  // через всё содержимое меню. Общий хук — общий фикс сразу для всех.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  /* Закрытие соседей нельзя делать внутри апдейтера setState: он выполняется в фазе
     рендера, и React ругается на setState в чужом компоненте. Считаем next заранее. */
  const toggle = () => {
    const next = !open;
    if (next) {
      dropdownActiveId = idRef.current;
      dropdownListeners.forEach((fn) => fn());
      const r = btnRef.current && btnRef.current.getBoundingClientRect();
      if (r) {
        const vw = window.innerWidth; const vh = window.innerHeight;
        const left = Math.max(8, Math.min(r.right - width, vw - width - 8));
        /* Панель не должна уезжать за нижний край экрана. На телефоне список
           саундтрека открывался вниз от кнопки, стоящей в нижней половине окна, и
           четыреста пикселей содержимого оказывались за пределами видимой части —
           до кнопок в нём было просто не добраться. Теперь: если снизу тесно,
           раскрываемся вверх, и в любом случае ограничиваем высоту экраном. */
        const below = vh - r.bottom - 14;
        const above = r.top - 14;
        const down = below >= 320 || below >= above;
        setPos(down
          ? { top: r.bottom + 6, bottom: 'auto', left, maxHeight: Math.max(180, below) }
          : { top: 'auto', bottom: Math.max(8, vh - r.top + 6), left, maxHeight: Math.max(180, above) });
      }
    }
    setOpen(next);
  };
  return { open, setOpen, toggle, btnRef, pos };
}

export function AudioControls() {
  const DD_WIDTH = 268;
  const { open, setOpen, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
  // музыку, звуки и громкость читаем из движка при каждом рисовании: их ставит и экран
  // (настройки «Мира» и обучения после перезагрузки), не только эта панель
  const [, forceRender] = useState(0);
  const { music, sfx, volume: vol } = Audio.opts;
  const setMusic = () => forceRender((n) => n + 1); const setSfx = setMusic; const setVol = setMusic;
  React.useEffect(() => Audio.onChange(() => forceRender((n) => n + 1)), []);
  const anyOn = music || sfx;
  const np = Audio.nowPlaying();
  const list = Audio.playlist();
  // названия пьес и заставок приезжают вместе с движком (см. audio/lazy.js)
  const { TRACKS = {}, STINGERS = {}, MOOD_LABEL = {} } = Audio.meta() || {};
  const moods = [['auto', 'По режиму экономики'], ['calm', MOOD_LABEL.calm], ['boom', MOOD_LABEL.boom],
    ['slump', MOOD_LABEL.slump], ['stag', MOOD_LABEL.stag], ['crisis', MOOD_LABEL.crisis], ['frost', MOOD_LABEL.frost], ['war', MOOD_LABEL.war]];
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="ems-btn" style={{ padding: '7px 9px' }} title={`Музыка: ${np.name}`}
        onClick={() => { Audio.prime(); Audio.play('click'); toggle(); }}>
        {anyOn ? <Volume2 size={14} /> : <VolumeX size={14} color={COLOR.faint} />}
      </button>
      {open && (
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: DD_WIDTH, padding: 13, zIndex: 60, maxHeight: pos.maxHeight, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Music size={13} color={COLOR.gold} />
            <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Саундтрек</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint }}>{np.moodLabel} · {np.bpm} BPM</span>
            {/* на телефоне «ткнуть мимо» — не очевидный способ закрыть панель */}
            <button className="ems-btn" style={{ padding: '3px 5px', lineHeight: 0 }} aria-label="Закрыть"
              onClick={() => { Audio.play('click'); setOpen(false); }}><X size={12} /></button>
          </div>
          <div style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '9px 10px', marginBottom: 9 }}>
            <div className="ems-serif" style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.2 }}>{np.name}</div>
            <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>{np.subtitle}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <button className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 12 }} onClick={() => { Audio.play('tick'); Audio.skip(false); }}>◀ пред.</button>
              <button className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 12 }} onClick={() => { Audio.play('tick'); Audio.skip(true); }}>след. ▶</button>
            </div>
          </div>
          {list.length > 1 && (
            <div style={{ marginBottom: 9, maxHeight: 116, overflowY: 'auto' }} className="ems-scroll">
              {list.map((x) => (
                <div key={x.id} onClick={() => { Audio.play('tick'); Audio.playTrack(x.id); }}
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 2, cursor: 'pointer',
                    color: x.current ? COLOR.goldSoft : COLOR.muted, background: x.current ? COLOR.goldDim : 'transparent' }}>
                  {x.current ? '♪ ' : '   '}{x.name}
                </div>
              ))}
            </div>
          )}
          {music && (
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Заставки событий</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.values(STINGERS).map((st) => (
                  <button key={st.id} className="ems-btn" style={{ padding: '2px 7px', fontSize: 12 }}
                    onClick={() => Audio.stinger(st.id)}>{st.name}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Что играть</div>
            <select className="ems-btn" value={np.locked || 'auto'} style={{ width: '100%', padding: '5px 8px', fontSize: 12 }}
              onChange={(e) => { Audio.play('tab'); Audio.setPlaylist(e.target.value === 'auto' ? null : e.target.value); }}>
              {moods.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
            </select>
          </div>
          {[['Музыка', music, (v) => { setMusic(v); Audio.setMusic(v); setWorldMusic(v); }, Music],
            ['Интерфейс и события', sfx, (v) => { setSfx(v); Audio.setSfx(v); setWorldSfx(v); if (v) Audio.play('click'); }, Volume2]].map(([label, val, set, Icon]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <Icon size={12} color={val ? COLOR.gold : COLOR.faint} />
                <span style={{ fontSize: 12, color: val ? COLOR.text : COLOR.muted, flex: 1 }}>{label}</span>
                <button className="ems-btn" style={{ padding: '2px 9px', fontSize: 12, background: val ? COLOR.sel : COLOR.panelAlt, color: val ? COLOR.selText : COLOR.muted, borderColor: val ? COLOR.selBorder : COLOR.border }}
                  onClick={() => set(!val)}>{val ? 'вкл' : 'выкл'}</button>
              </div>
            ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 12, color: COLOR.muted, width: 54 }}>Громкость</span>
            <input type="range" className="ems-slider" min={0} max={1} step={0.05} value={vol}
              onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); Audio.setVolume(v); setWorldVolume(v); }} />
          </div>
          <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
            {Object.keys(TRACKS).length} пьес в {new Set(Object.values(TRACKS).map((t) => t.mood)).size} настроениях. Каждая состоит из нескольких частей с разной оркестровкой, на повторах играется с вариациями, а темп дышит экономикой — при высокой инфляции музыка разгоняется. Смена настроения не обрывает пьесу: она затихает за такт и передаёт место следующей. На выборы, переворот, падение и возвращение демократии и остановленные цены звучат короткие заставки.
          </div>
        </div>
      )}
    </div>
  );
}

/* Обучение (словарь, курс из модулей, тесты и практика) подгружается лениво
   через React.lazy() — см. комментарий в начале src/tutorial.jsx. */
const TutorialHub = React.lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.TutorialHub })));

/* ============================ СОХРАНЕНИЯ ============================ */
export const SAVE_VERSION = 3;

export function validateSnapshot(data) {
  if (!data || data.app !== 'economic-panel') throw new Error('Это не сохранение Инфляции.');
  if (!data.setup || !data.economy || !Array.isArray(data.history)) throw new Error('Сохранение повреждено: не хватает состояния экономики.');
  if (data.v > SAVE_VERSION) throw new Error('Сохранение сделано в более новой версии симулятора.');
  return data;
}

/* Автосохранение текущей одиночной партии: раньше перезагрузка вкладки (случайный
   F5, восстановление после сна ноутбука) откатывала партию к главному меню, хотя
   игрок ничего не сохранял и не выходил. Слот в localStorage хранит полный снимок
   того же вида, что и ручное сохранение, и перезаписывается на каждый квартал —
   при следующем открытии страница просто открывает партию с того же места. */
export const AUTOSAVE_KEY = 'ems-autosave-v1';
/* «Своё дело» (тайкун предпринимателя) хранится отдельно: это другая игра со своим
   состоянием. Репутация от проданных компаний — в мета-записи, она переживает партии. */
export const TYCOON_SAVE_KEY = 'ems-tycoon-v1';
export const TYCOON_META_KEY = 'ems-tycoon-meta';
export function loadTycoonSave() {
  try {
    const d = JSON.parse(localStorage.getItem(TYCOON_SAVE_KEY) || 'null');
    return d && d.mode === 'tycoon' && d.country && d.country.economy && Array.isArray(d.buildings) ? d : null;
  } catch { return null; }
}
/* Какой экран был открыт на вкладке — чтобы после перезагрузки страницы «Своё дело»
   открывалось само, как одиночная партия, а не бросало в меню (или, хуже, в старую
   партию за государство, у которой тоже есть автосохранение). */
const LAST_SCREEN_KEY = 'ems-last-screen';
function tycoonWasOpen() {
  try { return localStorage.getItem(LAST_SCREEN_KEY) === 'tycoon'; } catch { return false; }
}
export function loadTycoonMeta() {
  try { return JSON.parse(localStorage.getItem(TYCOON_META_KEY) || 'null') || {}; } catch { return {}; }
}

export const loadAutosave = () => {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return validateSnapshot(JSON.parse(raw));
  } catch { return null; }
};

const clearAutosave = () => { try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ } };

/* Player ID — единственное, что остаётся на клиенте: без него некому
   адресовать слоты на сервере (аккаунтов в игре нет). Сама партия — экономика,
   история, декэижны — целиком лежит на сервере, как и сетевые комнаты. */
export const PLAYER_ID_KEY = 'ems-player-id';

export const getPlayerId = () => {
  const fresh = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `p${Date.now()}${Math.random().toString(36).slice(2)}`;
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) { id = fresh(); localStorage.setItem(PLAYER_ID_KEY, id); }
    return id;
  } catch { return fresh(); /* приватный режим — слоты проработают только эту вкладку */ }
};

/* Достижения: коллекция привязана к устройству (localStorage), а не к
   конкретному сохранению партии — открытое достижение остаётся открытым
   даже после «Начать заново» или удаления сохранения. */
export const ACHIEVEMENTS_KEY = 'ems-achievements';

export const ROLES_PLAYED_KEY = 'ems-roles-played';

export const NETWORK_PLAYED_KEY = 'ems-network-played';

export const ACHIEVEMENTS = [
  { id: 'first_quarter', icon: Play, title: 'Первый квартал', desc: 'Завершите первый квартал у руля экономики.' },
  { id: 'daily_done', icon: Medal, title: 'Вызов принят', desc: 'Пройдите вызов дня до конца, не проиграв.' },
  { id: 'biz_triple', icon: Factory, title: 'Своё дело', desc: 'В «Своём деле» утройте стоимость компании против стартовой.' },
  { id: 'biz_survivor', icon: LifeBuoy, title: 'Выжить в кризис', desc: 'В «Своём деле» выберите при старте кризисный сценарий (валютный кризис, ипотечный пузырь или гиперинфляцию — не открытую партию) и продержите компанию 12 кварталов без банкротства.' },
  { id: 'tycoon_chain', icon: Wheat, title: 'От поля до полки', desc: 'Соберите свою хлебную цепочку: ферма, мельница, хлебозавод и магазин.' },
  { id: 'tycoon_billion', icon: Crown, title: 'Миллиардер', desc: 'Доведите стоимость своей компании до миллиарда.' },
  { id: 'survivor_20', icon: Calendar, title: 'Ветеран', desc: 'Продержитесь 20 кварталов в одной партии.' },
  { id: 'survivor_40', icon: BookOpen, title: 'Долгожитель', desc: 'Продержитесь 40 кварталов в одной партии.' },
  { id: 'inflation_target', icon: Target, title: 'В яблочко', desc: 'Играя за Центробанк, удержите инфляцию рядом с целью 8 кварталов подряд.' },
  { id: 'gdp_double', icon: TrendingUp, title: 'Удвоение', desc: 'Удвойте реальный ВВП от старта партии.' },
  { id: 'low_unemployment', icon: Users, title: 'Полная занятость', desc: 'Опустите безработицу ниже 4%.' },
  { id: 'debt_control', icon: Scale, title: 'Долговая дисциплина', desc: 'Играя за Минфин, снизьте госдолг ниже 35% ВВП.' },
  { id: 'survived_crisis', icon: ShieldCheck, title: 'Пережили бурю', desc: 'Выведите страну из кризисного режима обратно к норме.' },
  { id: 'won_election', icon: Vote, title: 'Мандат доверия', desc: 'Останьтесь у власти на выборах.' },
  { id: 'all_roles', icon: Layers, title: 'Все ветви власти', desc: 'Доведите до конца хотя бы один квартал за Центробанк, Минфин, премьер-министра, президента и трейдера.' },
  { id: 'network_played', icon: Share2, title: 'На двоих', desc: 'Доиграйте хотя бы один квартал в партии по сети.' },
  { id: 'margin_call', icon: AlertTriangle, title: 'Маржин-колл', desc: 'Переживите принудительное закрытие позиций брокером и продолжите торговать.' },
  { id: 'tutorial_done', icon: GraduationCap, title: 'Курс молодого бойца', desc: 'Пройдите первый модуль обучения.' },
  { id: 'tutorial_course_done', icon: Award, title: 'Экономист', desc: 'Пройдите базовый курс целиком, вместе с экзаменом.' },
  { id: 'course_trader', icon: BarChart3, title: 'Аналитик', desc: 'Пройдите курс частного инвестора целиком, вместе с экзаменом.' },
  { id: 'course_president', icon: Landmark, title: 'Государственный ум', desc: 'Пройдите курс президента целиком, вместе с экзаменом.' },
  { id: 'course_all', icon: Medal, title: 'Красный диплом', desc: 'Пройдите три курса с экзаменами: экономическую политику, частного инвестора и президента.' },
  { id: 'promises_kept', icon: Handshake, title: 'Слово держат', desc: 'Дойдите до выборов, сдержав все три предвыборных обещания (премьер-министр или президент).' },
  { id: 'reformer', icon: Hammer, title: 'Реформатор', desc: 'Проведите три структурные реформы за одну партию (президент).' },
  { id: 'own_hands', icon: HeartHandshake, title: 'Своими руками', desc: 'Играя за президента, верните парламент, который сами же и распустили.' },
  { id: 'iron_president', icon: Gavel, title: 'Железная рука', desc: 'Играя за президента, доведите страну до тоталитарного режима.' },
  { id: 'imf_bailout', icon: LifeBuoy, title: 'Спасательный круг', desc: 'Играя за Минфин, получите экстренное финансирование МВФ вместо дефолта.' },
  { id: 'prices_stopped', icon: Award, title: 'Цены остановлены', desc: 'Доведите стабилизационную программу до конца: верните инфляцию из гиперинфляции к цели.' },
  { id: 'hardest_way_out', icon: Crown, title: 'Выход есть', desc: 'Сохраните демократию 16 кварталов в самом трудном сценарии — «Гиперинфляции».' },
  { id: 'diplomacy_sanctions', icon: Ban, title: 'Экономическое давление', desc: 'Играя за президента, введите санкции против торгового партнёра.' },
  { id: 'trade_bloc_join', icon: Globe2, title: 'Открытые границы', desc: 'Играя за президента, договоритесь о едином рынке с соседями.' },
  { id: 'cds_trade', icon: TrendingDown, title: 'Ставка на дефолт', desc: 'Совершите сделку по свопу на дефолт (CDS) в трейдерском терминале.' },
  { id: 'public_room_played', icon: DoorOpen, title: 'Открытая дверь', desc: 'Доиграйте хотя бы один квартал в открытой (публичной) сетевой комнате.' },
];

export const loadUnlockedAchievements = () => { try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '{}'); } catch { return {}; } };

export const loadRolesPlayed = () => { try { return JSON.parse(localStorage.getItem(ROLES_PLAYED_KEY) || '[]'); } catch { return []; } };

export const isNetworkPlayed = () => { try { return localStorage.getItem(NETWORK_PLAYED_KEY) === '1'; } catch { return false; } };

/* Ключи прогресса курса обучения и модулей — объявлены здесь (а не в tutorial.jsx,
   куда вынесен сам курс), потому что синхронизация профиля ниже читает и пишет их
   независимо от того, открывал ли человек обучение на этом устройстве. tutorial.jsx
   импортирует их обратно из этого модуля. */
export const COURSE_PROGRESS_KEY = 'ems-course-progress';

export const loadCourseProgress = () => { try { return JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY) || '{}'); } catch { return {}; } };

export const MODULE_STATE_KEY = 'ems-module-progress';

export const loadModuleState = () => { try { return JSON.parse(localStorage.getItem(MODULE_STATE_KEY) || '{}'); } catch { return {}; } };

/* Весь прогресс устройства одним объектом: достижения, сыгранные роли, сетевая
   партия, пройденные курсы и незаконченные модули. Это то, что переезжает вместе
   с профилем при связывании устройств, — слоты сохранений и так лежат на сервере. */
/* Свёрнутые блоки. Само положение лежит в ems.fold.<id> ('1' — открыт), а в
   ems.foldAt — когда его меняли: по этой отметке профиль понимает, какое из двух
   устройств свернуло блок позже, и на обоих он остаётся таким, каким его оставили. */
const FOLD_PREFIX = 'ems.fold.';
const FOLD_AT_KEY = 'ems.foldAt';
const readFoldAt = () => { try { return JSON.parse(localStorage.getItem(FOLD_AT_KEY) || '{}') || {}; } catch { return {}; } };
export const loadFold = (id, fallback) => {
  try { const v = localStorage.getItem(FOLD_PREFIX + id); return v == null ? fallback : v === '1'; } catch { return fallback; }
};
export const saveFold = (id, open) => {
  try {
    localStorage.setItem(FOLD_PREFIX + id, open ? '1' : '0');
    localStorage.setItem(FOLD_AT_KEY, JSON.stringify({ ...readFoldAt(), [id]: Date.now() }));
  } catch { /* приватный режим — просто не запоминаем */ }
};
const loadFolds = () => {
  const at = readFoldAt();
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(FOLD_PREFIX)) continue;
      const id = k.slice(FOLD_PREFIX.length);
      out[id] = [localStorage.getItem(k) === '1' ? 1 : 0, Number(at[id]) || 0];
    }
  } catch { /* приватный режим */ }
  return out;
};
const writeFolds = (folds) => {
  if (!folds || typeof folds !== 'object') return;
  const at = readFoldAt();
  let changed = false;
  Object.entries(folds).forEach(([id, v]) => {
    if (!Array.isArray(v) || (v[1] || 0) <= (Number(at[id]) || 0)) return;
    localStorage.setItem(FOLD_PREFIX + id, v[0] ? '1' : '0');
    at[id] = v[1]; changed = true;
  });
  if (changed) localStorage.setItem(FOLD_AT_KEY, JSON.stringify(at));
};

export const readLocalProgress = () => ({
  achievements: loadUnlockedAchievements(),
  roles: loadRolesPlayed(),
  network: isNetworkPlayed(),
  courses: loadCourseProgress(),
  modules: loadModuleState(),
  folds: loadFolds(),
  textbook: loadTextbookProgress(),
});

export const writeLocalProgress = (profile, { replace = false } = {}) => {
  if (!profile) return;
  try {
    if (profile.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(profile.achievements));
    if (profile.roles) localStorage.setItem(ROLES_PLAYED_KEY, JSON.stringify(profile.roles));
    if (profile.network) localStorage.setItem(NETWORK_PLAYED_KEY, '1');
    else localStorage.removeItem(NETWORK_PLAYED_KEY);
    if (profile.courses) localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(profile.courses));
    if (profile.modules) localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(profile.modules));
    writeFolds(profile.folds);
    // учебник — слиянием с тем, что на устройстве: ответ, данный пока шёл запрос, не пропадёт
    // (при выходе из профиля — наоборот, заменой: устройству возвращается его собственный прогресс)
    if (profile.textbook) saveTextbookProgress(replace ? mergeTextbook(profile.textbook, null) : mergeTextbook(loadTextbookProgress(), profile.textbook));
    else if (replace) localStorage.removeItem(TEXTBOOK_PROGRESS_KEY);
  } catch { /* приватный режим */ }
};

/* Синхронизация прогресса — всегда двусторонняя и всегда объединением: отправляем
   своё, получаем общее, записываем обратно. Ошибка сети тут ничего не ломает:
   локальные данные остаются как были, а следующий заход в меню попробует снова. */
export async function syncProfile(playerId) {
  try {
    const profile = await syncProgress(playerId, readLocalProgress());
    writeLocalProgress(profile);
    return profile;
  } catch { return null; }
}



// столько же, сколько в api/solo.js: слоты хранятся на сервере, клиент только рисует
export const SOLO_SLOT_COUNT = 4;

/* Место и токен — единственное, что нужно, чтобы вернуться в свою партию после
   обновления страницы: комната и так живёт на сервере (Redis/память, TTL 3 суток),
   не хватало только клиентской памяти о том, что вы уже вошли. Слотов три — можно
   одновременно вести до трёх сетевых партий (например, за разные ведомства в разных
   комнатах) и не терять доступ ни к одной из них. */
const NETWORK_SLOTS_KEY = 'ems-network-slots';

const NETWORK_SESSION_KEY_LEGACY = 'ems-network-session';

 // старый формат до введения слотов
export const NETWORK_SLOT_COUNT = 3;

export const loadNetworkSlots = () => {
  let arr;
  try { arr = JSON.parse(localStorage.getItem(NETWORK_SLOTS_KEY) || '[]'); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const slots = arr.slice(0, NETWORK_SLOT_COUNT).map((s) => ((s && s.id && s.seat && s.token) ? s : null));
  while (slots.length < NETWORK_SLOT_COUNT) slots.push(null);
  // разовая миграция: у тех, кто заходил до появления слотов, партия лежала под
  // одним старым ключом — переносим её в первый слот, чтобы не потерять доступ
  try {
    const legacy = JSON.parse(localStorage.getItem(NETWORK_SESSION_KEY_LEGACY) || 'null');
    if (legacy && legacy.id && legacy.seat && legacy.token) {
      const dup = slots.some((s) => s && s.id === legacy.id && s.seat === legacy.seat);
      if (!dup) {
        const idx = slots.findIndex((s) => !s);
        slots[idx === -1 ? 0 : idx] = { id: legacy.id, seat: legacy.seat, token: legacy.token, savedAt: Date.now() };
      }
      localStorage.removeItem(NETWORK_SESSION_KEY_LEGACY);
      writeNetworkSlots(slots);
    }
  } catch { /* ignore */ }
  return slots;
};

export const writeNetworkSlots = (slots) => {
  try { localStorage.setItem(NETWORK_SLOTS_KEY, JSON.stringify(slots)); }
  catch { /* приватный режим/квота — не критично, просто не восстановимся после обновления */ }
};

export const clearNetworkSlotAt = (idx) => { const slots = loadNetworkSlots(); slots[idx] = null; writeNetworkSlots(slots); };

// квартал и режим партии по каждому запомненному месту — общий хук для лобби и
// главного меню (см. NetworkLobby и MainMenu): комната всегда живёт на сервере,
// так что превью не устаревает так, как устаревал локальный снимок в одиночной
// игре — здесь только не хватало самого запроса.
export function useNetworkSlotPreviews(slots) {
  const [slotPreviews, setSlotPreviews] = useState({});
  React.useEffect(() => {
    let cancelled = false;
    slots.forEach((slot, idx) => {
      if (!slot) return;
      fetchRoom(slot.id).then((d) => { if (!cancelled && d.room) setSlotPreviews((p) => ({ ...p, [idx]: d.room })); }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [slots]);
  return slotPreviews;
}

export const roomCodeFromUrl = () => {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
};

// краткие ярлыки кризисов для превью в браузере открытых комнат — список
// комнат нарочно лёгкий (без полной экономики), поэтому берём готовые id
// из activeCrises, а не CRISIS_INFO с его иногда функциональными label
/* Сетевая игра — лобби, вход в комнату и экран партии — вынесена в отдельный
   чанк src/network.jsx и грузится лениво: при первом заходе на сайт человек
   видит меню, и полторы тысячи строк сетевого экрана ему пока не нужны.
   Помощники слотов (сохранённые сетевые партии в меню) остаются здесь. */
const NetworkEntryScreen = React.lazy(() => import('./network.jsx').then((m) => ({ default: m.NetworkEntryScreen })));

const NetworkGameScreen = React.lazy(() => import('./network.jsx').then((m) => ({ default: m.NetworkGameScreen })));

/* Экран одиночной партии (src/game.jsx) вместе с движком экономики тоже грузится
   лениво: меню и экран новой партии не ждут его. Пока человек выбирает роль,
   чанк успевает подтянуться заранее — см. preloadGame. */
const loadGame = () => import('./game.jsx');
/* меню «Мира» и экран новой партии — ленивый модуль (src/world-menu.jsx): на приветствии и в обучении не нужны */
const loadWorldMenu = () => import('./world-menu.jsx');
const MainMenu = React.lazy(() => loadWorldMenu().then((m) => ({ default: m.MainMenu })));
const SetupScreen = React.lazy(() => loadWorldMenu().then((m) => ({ default: m.SetupScreen })));
// «Своё дело» — отдельная игра и отдельный чанк
const TycoonScreen = React.lazy(() => import('./tycoon.jsx').then((m) => ({ default: m.TycoonScreen })));
// тренажёр: лаборатория и задачи на 10 минут — отдельный чанк
const LabScreen = React.lazy(() => import('./trainer.jsx').then((m) => ({ default: m.LabScreen })));
// учебник: главы, KaTeX, приложения — свой чанк
const TextbookScreen = React.lazy(() => import('./textbook.jsx').then((m) => ({ default: m.TextbookScreen })));
// путь уроков, практика и профиль учёбы — вместе с учебником (формулы и графики те же)
const loadLearn = () => import('./learn.jsx');
const LearnTab = React.lazy(() => loadLearn().then((m) => ({ default: m.LearnTab })));
const Welcome = React.lazy(() => import('./welcome.jsx'));
// витрина дизайн-системы обучения — внутренняя страница …/#ds
const DsShowcase = React.lazy(() => import('./ds-showcase.jsx'));
const DrillsScreen = React.lazy(() => import('./trainer.jsx').then((m) => ({ default: m.DrillsScreen })));
const GameScreen = React.lazy(() => loadGame().then((m) => ({ default: m.GameScreen })));
// подгрузить экран партии заранее (при наведении на «Новая партия», на экране настройки)
export function preloadGame() { loadGame().catch(() => {}); }

// пока грузится чанк — заставка в стиле знака: монета-шарик надувается (src/logo.jsx)
function GameFallback({ text }) {
  return <BrandLoader text={text} background={COLOR.bg} color={COLOR.text} />;
}

// пока грузится сетевой чанк — та же заставка
function NetworkFallback() {
  return <GameFallback text="Подключаем сетевую партию" />;
}

/* Нижняя панель главного экрана: Путь, Учебник, Лиги, Лавка и «⋯» — до каждой одно касание, на
   телефоне — под большим пальцем. «⋯» открывает выбор из двух: Мир или Профиль; пока открыт один
   из них, отмечена «⋯» с его названием. «Задания» (задания дня, испытание месяца и практика) —
   карточка наверху Пути, а не вкладка. Урок открывается поверх неё во весь экран. Открытая
   вкладка — не кнопка перехода: путь назад у подэкранов (учебник поверх вкладки) один — их
   собственный «назад». */
const MORE_TABS = [
  { id: 'world', icon: MapIcon, label: 'Мир', text: 'Игра: партия, Лаборатория, Своё дело' },
  { id: 'news', icon: Newspaper, label: 'Новости', text: 'Что нового в Инфляции' },
  { id: 'profile', icon: UserRound, label: 'Профиль', text: 'Серия, марки, печати, настройки' },
];
function BottomNav({ tab, onTab, onReselect = null }) {
  const learning = tab !== 'world';
  const [menu, setMenu] = useState(false);
  const inMore = MORE_TABS.find((t) => t.id === tab);
  // свежий выпуск «Что нового» ещё не открывали — точка на «⋯» и плашка «новое» у «Новостей»;
  // выпуск, вышедший до первого дня ученика, — не новость: новичку новое всё
  // и новое от друзей (печать, юнит, забег) после прошлого открытия ленты — тоже точка
  // лиги и лавка открываются после первых уроков (src/learn/unlocks.js) — до того у вкладки замок;
  // прогресс пришёл с другого устройства — пересчитать замки и точку новостей
  const [progTick, setProgTick] = useState(0);
  useEffect(() => { const f = () => setProgTick((x) => x + 1); window.addEventListener(PROGRESS_EVENT, f); return () => window.removeEventListener(PROGRESS_EVENT, f); }, []);
  const newsNew = React.useMemo(() => { const l = loadTextbookProgress().learn; return (!readNewsSeen(l)[LATEST_NEWS.id] && newsForLearner(LATEST_NEWS, learnerSince(l)))
    || friendNewsSince(((friendsState() || {}).friends) || [], readFeedSeenAt()); }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [tab, menu, progTick]);
  const locks = React.useMemo(() => { const l = loadTextbookProgress().learn; return { league: !featureOpen(l, 'league'), shop: !featureOpen(l, 'shop'), world: !featureOpen(l, 'world') }; }, [tab, menu, progTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [
    { id: 'path', icon: Route, label: 'Путь' },
    { id: 'book', icon: BookOpenText, label: 'Учебник' },
    { id: 'league', icon: Trophy, label: 'Лиги', lock: locks.league },
    { id: 'shop', icon: ShoppingBag, label: 'Лавка', lock: locks.shop },
    { id: 'more', icon: Ellipsis, label: inMore ? inMore.label : 'Ещё', menu: true, open: menu, dot: newsNew && tab !== 'news' },
  ];
  useEffect(() => {
    if (!menu) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    const away = (e) => { if (!e.target.closest || !e.target.closest('[data-testid="bottom-nav"]')) setMenu(false); };
    document.addEventListener('keydown', esc); document.addEventListener('pointerdown', away);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away); };
  }, [menu]);
  const go = (t) => {
    Audio.prime(); Audio.play('tab');
    if (t === 'more') { setMenu((x) => !x); return; }
    setMenu(false); onTab(t);
  };
  // та же панель из дизайн-системы: в обучении — бумага (или тушь), в «Мире» — его тёмная тема
  return (
    <DsRoot theme={dsThemeId()} world={learning ? null : COLOR} style={{ background: 'none' }}>
      <Tabs tabs={tabs} active={inMore ? 'more' : tab} onTab={go}
        onReselect={(t) => { if (t === 'more') { go('more'); return; } if (onReselect) { Audio.play('tab'); onReselect(t); } }}>
        {menu && (
          <div className="ds-more" role="menu" aria-label="Ещё" data-testid="more-menu">
            {MORE_TABS.map((t) => {
              const Icon = t.icon; const on = tab === t.id;
              return (
                <button key={t.id} type="button" role="menuitem" data-tab={t.id} aria-current={on ? 'page' : undefined} data-nav-target={on ? undefined : `tab:${t.id}`}
                  onClick={() => { setMenu(false); if (on) { if (onReselect) onReselect(t.id); return; } Audio.play('tab'); onTab(t.id); }}>
                  <Icon size={22} aria-hidden="true" /><span>{t.label}{t.id === 'news' && newsNew && <span className="ds-new">новое</span>}{t.id === 'world' && locks.world && <Lock size={13} aria-label="откроется позже" data-testid="world-lock" style={{ marginLeft: 6, verticalAlign: '-1px' }} />}<small>{t.id === 'world' && locks.world ? 'Откроется после 10-го урока' : t.text}</small></span>
                </button>
              );
            })}
          </div>
        )}
      </Tabs>
    </DsRoot>
  );
}

/* Экран не должен пропадать целиком. Любая ошибка при отрисовке в React
   размонтирует всё дерево — и вместо игры остаётся белая страница, по которой
   нельзя понять ни что сломалось, ни как вернуться. Граница ошибок ловит такой
   сбой на уровне экрана: показывает, что именно случилось, и оставляет дорогу
   обратно в меню. Сохранения при этом целы — они на сервере. */
function CrashScreen({ error, onMenu }) {
  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '44px 16px', minHeight: '100vh' }}>
      <GlobalStyle />
      <div className="ems-panel-raised" style={{ maxWidth: 520, width: '100%', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <AlertTriangle size={16} color={COLOR.rust} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.rust }}>Экран не открылся</span>
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Произошла ошибка при отрисовке. Партии это не касается: сохранения лежат на сервере и никуда не делись —
          можно вернуться в меню и загрузить их заново.
        </div>
        <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, background: COLOR.panelAlt,
          border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '9px 10px', marginBottom: 14,
          maxHeight: 120, overflow: 'auto', wordBreak: 'break-word' }}>
          {String((error && error.message) || error || 'неизвестная ошибка')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ems-btn primary" style={{ flex: 1, minWidth: 160, padding: '11px 0' }} onClick={onMenu}>
            Вернуться в меню
          </button>
          <button className="ems-btn" style={{ flex: 1, minWidth: 160, padding: '11px 0' }}
            onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </button>
        </div>
      </div>
    </div>
  );
}

class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Экран упал:', error, info); }
  componentDidUpdate(prev) {
    // сменили экран — пробуем снова: ошибка была у того, который уже закрыт
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} onMenu={this.props.onMenu} />;
    return this.props.children;
  }
}

export default function MacroSimulator() {
  // партия из автосохранения открывается сама, минуя меню — но только если
  // в адресе нет приглашения в сетевую комнату: оно важнее того, что было
  // открыто на этой вкладке раньше
  // до ухода со страницы было открыто «Своё дело» — открываем его, а не партию за государство
  const [resumeTycoon] = useState(() => (!roomCodeFromUrl() && tycoonWasOpen() ? loadTycoonSave() : null));
  const [loaded, setLoaded] = useState(() => (roomCodeFromUrl() || resumeTycoon ? null : loadAutosave()));
  const [setup, setSetup] = useState(() => (roomCodeFromUrl() || resumeTycoon ? null : (loadAutosave() || {}).setup || null));
  const [nonce, setNonce] = useState(0);
  // оформление «Мира» — сохранённое на устройстве или по ночной теме из настроек (ds-tokens.js)
  const [theme, setThemeState] = useState(worldThemeId);
  const [network, setNetwork] = useState(null);
  // 'menu' — главная страница; 'setup' — анкета новой одиночной партии;
  // 'network' — лобби подключения на двоих. Ссылка-приглашение (?room=)
  // ведёт сразу в лобби, минуя меню.
  const [view, setView] = useState(() => (roomCodeFromUrl() ? 'network' : 'menu'));
  /* Главный экран — оболочка с нижней панелью: Путь (уроки), Практика, Теория (учебник как
     справочник), Мир (партия, «Своё дело», лаборатория) и Профиль. view 'menu' — оболочка,
     tab — открытая вкладка; из Лаборатории или партии возвращаемся на ту же вкладку. */
  const [tab, setTabRaw] = useState('path');
  const setTab = (t) => { setTabRaw(t); window.scrollTo(0, 0); };
  // аналитика: открыли вкладку «Мир» — не чаще раза в день с устройства (docs/mechanics.md, «Аналитика»)
  React.useEffect(() => { if (tab === 'world' && view === 'menu') trackDaily('world_open'); }, [tab, view]);
  /* Вход обязателен: без аккаунта — только приветствие, вход и регистрация (src/welcome.jsx).
     Экран входа закрывается событием ems-account-ready, когда аккаунт сохранён и код
     восстановления показан; выход из аккаунта возвращает на приветствие. */
  const account = useAccount();
  const [showcase, setShowcase] = useState(() => typeof window !== 'undefined' && window.location.hash === '#ds');
  React.useEffect(() => {
    const f = () => setShowcase(window.location.hash === '#ds');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  /* Гость (src/lib/guest.js): «Начать» → цель → сразу первый урок, без аккаунта. Регистрация —
     после урока («Сохраните прогресс»): тогда ворота открываются на экране регистрации. */
  const [guest, setGuest] = useState(() => !loadAccount() && isGuest());
  const [gate, setGate] = useState(() => !loadAccount() && !isGuest());
  const [gateScreen, setGateScreen] = useState('hello');
  const [firstLesson, setFirstLesson] = useState(false);
  React.useEffect(() => {
    const ready = () => { setGate(false); setGuest(false); setView('menu'); setTabRaw('path'); window.scrollTo(0, 0); };
    const guestStart = () => { setGuest(true); setGate(false); setView('menu'); setTabRaw('path'); setFirstLesson(true); window.scrollTo(0, 0); };
    const guestSave = () => { setGateScreen('register'); setGate(true); window.scrollTo(0, 0); };
    window.addEventListener('ems-account-ready', ready);
    window.addEventListener(GUEST_START, guestStart);
    window.addEventListener(GUEST_SAVE, guestSave);
    return () => { window.removeEventListener('ems-account-ready', ready); window.removeEventListener(GUEST_START, guestStart); window.removeEventListener(GUEST_SAVE, guestSave); };
  }, []);
  React.useEffect(() => { if (!account && !guest) { setGateScreen('hello'); setGate(true); } }, [account, guest]);
  // детский режим и имя — с сервера при каждом запуске (профиль мог поменяться на другом устройстве)
  React.useEffect(() => { refreshAccount(); }, []);
  // воронка: вернулся ли человек на следующий день и через неделю (src/lib/retention.js)
  React.useEffect(() => { checkReturn(track); }, []);
  // тёмная тема обучения переключается в профиле — перерисовать оболочку
  const [learnTick, setLearnTick] = useState(0);
  // вернулись из Лаборатории, партии или «Своего дела», открытых из учебника, — снова в учебник
  const [reopenBook, setReopenBook] = useState(false);
  // учебник открыт поверх вкладки обучения: внизу подсвечен «Учебник»; closeTick закрывает его
  const [bookOver, setBookOver] = useState(false);
  const [closeTick, setCloseTick] = useState(0);
  // повторное нажатие на «Учебник», когда он уже открыт, — на главную страницу учебника
  const [bookHome, setBookHome] = useState(0);
  // повторное нажатие на «Путь» закрывает экран «Задания» поверх Пути
  const [pathHome, setPathHome] = useState(0);
  const [labLever, setLabLever] = useState('keyRate');
  // учебник: откуда открыта Лаборатория ({ lever, cb, mode, scenario }), куда вернуться,
  // задание для «Своего дела» и предвыбор сценария/старта в анкете
  const [labInit, setLabInit] = useState(null);
  const [fromBook, setFromBook] = useState(false);
  // партия (задача или сценарий) открыта из учебника — после неё вернуться в учебник
  const [gameFromBook, setGameFromBook] = useState(false);
  /* «Подробнее в учебнике» из партии: учебник открывается поверх, партия остаётся
     смонтированной (скрыта), «Назад в игру» возвращает туда же и на ту же прокрутку. */
  const [bookOverlay, setBookOverlay] = useState(null);
  const gameScroll = React.useRef(0);
  const openBookFromGame = React.useCallback((page) => {
    gameScroll.current = window.scrollY; setBookOverlay(page); window.scrollTo(0, 0);
  }, []);
  const closeBookOverlay = () => {
    setBookOverlay(null);
    requestAnimationFrame(() => window.scrollTo(0, gameScroll.current));
  };
  const [setupPreset, setSetupPreset] = useState(null);
  const [tycoonLesson, setTycoonLesson] = useState(null);
  // «Своё дело»: { initial } — продолжить сохранённое, { setupNew } — новое дело
  const [tycoon, setTycoon] = useState(() => (resumeTycoon ? { initial: resumeTycoon } : null));
  React.useEffect(() => {
    try { if (tycoon) localStorage.setItem(LAST_SCREEN_KEY, 'tycoon'); else localStorage.removeItem(LAST_SCREEN_KEY); } catch { /* приватный режим */ }
  }, [tycoon]);
  const showGate = gate || (!account && !guest);
  // «Мир» открывается после десятого урока (src/learn/unlocks.js): до того на вкладке — что там будет
  // и сколько уроков осталось, в оформлении обучения
  const worldLocked = tab === 'world' && !featureOpen(loadTextbookProgress().learn, 'world');
  const learning = showGate || (view === 'menu' && !setup && !network && !tycoon && (tab !== 'world' || worldLocked));
  // обучение — в своей светлой (или тёмной по выбору) теме; «канцелярия» — только в «Мире»
  applyTheme(learning ? learnThemeId() : theme);
  /* Звук: в обучении музыка по умолчанию выключена (своя настройка в профиле), звуки
     ответов — отдельный переключатель, по умолчанию включён. В «Мире» — его настройки из
     панели звука; они сохраняются, так что выключенная музыка не заиграет после перезагрузки.
     Меняем только то, что отличается: setMusic(true) грузит звуковой движок, а он нужен не
     раньше первого клика. */
  React.useEffect(() => {
    const music = learning ? learnMusic() : worldMusic(); const sfx = learning ? learnSfx() : worldSfx();
    if (Audio.opts.music !== music) Audio.setMusic(music);
    if (Audio.opts.sfx !== sfx) Audio.setSfx(sfx);
    if (!learning && Audio.opts.volume !== worldVolume()) Audio.setVolume(worldVolume());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learning, learnTick]);
  const setTheme = (id) => { setWorldTheme(id); applyTheme(id); setThemeState(id); };
  // ночную тему переключили в настройках — «Мир» тоже следует ей (если там не выбрано своё той же яркости)
  React.useEffect(() => { setThemeState(worldThemeId()); }, [learnTick]);
  const startLoaded = (data) => { setGameFromBook(false); setLoaded(data); setSetup(data.setup); setNonce((n) => n + 1); };
  const goMenu = () => setView('menu');
  const backToBook = () => { setReopenBook(true); setView('menu'); };
  // назад из Лаборатории, анкеты или тайкуна: в учебник, если пришли из него
  const goBack = () => { if (fromBook) { setFromBook(false); backToBook(); } else goMenu(); };
  // переключение между меню/анкетой/сетью/игрой не перезагружает страницу,
  // поэтому без явного сброса скролл оставался там, где был на предыдущем
  // экране — короткий новый экран открывался уже наполовину прокрученным
  const screenKey = network ? 'network-game' : tycoon ? 'tycoon' : setup ? 'game' : view;
  React.useEffect(() => { window.scrollTo(0, 0); }, [screenKey]);

  const backToMenu = () => { setNetwork(null); setLoaded(null); setSetup(null); goMenu(); };
  const startTycoon = (x) => {
    if (loadTycoonSave() && !window.confirm('Начать новое дело? Сохранённая компания будет потеряна (репутация останется).')) return;
    setTycoon({ lesson: tycoonLesson, setupNew: { start: x.sector || 'farm', scenario: x.scenario, difficulty: x.difficulty, cbPersona: x.cbPersona,
      mofPersona: x.mofPersona, presPersona: x.president && x.president.persona, president: !!(x.president && x.president.enabled) } });
    setTycoonLesson(null);
  };
  const screen = (() => {
    if (tycoon) {
      return (
        <Suspense fallback={<GameFallback />}>
          <TycoonScreen key={tycoon.initial ? 'load' : JSON.stringify(tycoon.setupNew)} initial={tycoon.initial} setupNew={tycoon.setupNew}
            lesson={tycoon.lesson || null} onExit={() => { setTycoon(null); goBack(); }} />
        </Suspense>
      );
    }
    if (network) {
      return (
        <Suspense fallback={<NetworkFallback />}>
          <NetworkGameScreen network={network} theme={theme} setTheme={setTheme} onExit={() => { setNetwork(null); goMenu(); }} />
        </Suspense>
      );
    }
    if (!setup) {
      if (view === 'setup' || view === 'setup-biz') {
        return (
          <Suspense fallback={<GameFallback />}>
            <SetupScreen key={`${theme}${view}`} initialRole={view === 'setup-biz' ? 'entrepreneur' : null}
              initialScenario={setupPreset && setupPreset.scenario} initialSector={setupPreset && setupPreset.sector}
              onStart={(x) => { setSetupPreset(null); if (x.role === 'entrepreneur') { startTycoon(x); return; } setGameFromBook(fromBook); setFromBook(false); clearAutosave(); setLoaded(null); setSetup(x); }}
              onBack={() => { setSetupPreset(null); setTycoonLesson(null); goBack(); }}
            />
          </Suspense>
        );
      }
      if (view === 'network') {
        return (
          <Suspense fallback={<NetworkFallback />}>
            <NetworkEntryScreen key={theme} onEnter={(net) => setNetwork(net)} onBack={goMenu} />
          </Suspense>
        );
      }
      if (view === 'lab') {
        return (
          <Suspense fallback={<GameFallback />}>
            <LabScreen key={`${theme}:${labLever}:${JSON.stringify(labInit)}`} initialLever={labLever} initial={labInit} onBack={() => { setLabInit(null); goBack(); }} />
          </Suspense>
        );
      }
      if (view === 'drills') {
        return (
          <Suspense fallback={<GameFallback />}>
            <DrillsScreen key={theme} onBack={goMenu} onStart={(x) => { setGameFromBook(false); clearAutosave(); setLoaded(null); setSetup(x); }} />
          </Suspense>
        );
      }
      if (view === 'tutorial') {
        return (
          <Suspense fallback={<GameFallback text="Открываем обучение" />}>
            <TutorialHub key={theme}
              onBack={goMenu}
              onStartRealGame={() => setView('setup')}
            />
          </Suspense>
        );
      }
      const startDrill = (x) => { setFromBook(false); setGameFromBook(true); clearAutosave(); setLoaded(null); setSetup(x); };
      return (
        <div data-testid="shell" data-tab={tab}>
          {tab === 'world' && worldLocked ? (
            <DsRoot theme={dsThemeId()} style={{ minHeight: '100vh' }}>
              <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 120px' }} data-testid="world-locked">
                <FeatureLocked id="world" learn={loadTextbookProgress().learn} onPath={() => setTab('path')} />
              </div>
            </DsRoot>
          ) : tab === 'world' ? (
            <Suspense fallback={<GameFallback />}>
            <MainMenu key={theme} theme={theme} setTheme={setTheme} inShell
              onNewGame={() => { setFromBook(false); setGameFromBook(false); setSetupPreset(null); setView('setup'); }}
              onNetwork={() => setView('network')}
              onTutorial={() => setView('tutorial')}
              onLab={() => { setFromBook(false); setLabInit(null); setLabLever('keyRate'); setView('lab'); }}
              onDrills={() => setView('drills')}
              onLoad={startLoaded}
              onEnterNetwork={setNetwork}
              onDaily={(daily) => { clearAutosave(); setLoaded(null); setSetup(daily); }}
              onTycoon={(save) => { setFromBook(false); setSetupPreset(null); setTycoonLesson(null); if (save) setTycoon({ initial: save }); else setView('setup-biz'); }}
            />
            </Suspense>
          ) : (
            <div className="ems-root">
              <GlobalStyle />
              <Suspense fallback={<GameFallback />}>
                <LearnTab tab={tab} onTab={setTab} reopenBook={reopenBook} onBookReopened={() => setReopenBook(false)} onThemeChange={() => setLearnTick((k) => k + 1)}
                  onBookOver={setBookOver} closeTick={closeTick} bookHome={bookHome} pathHome={pathHome} guest={guest} firstLesson={firstLesson} onFirstLesson={() => setFirstLesson(false)}
                  bookHandlers={{
                    onOpenLab: (init) => { setFromBook(true); setLabInit(init); setLabLever(init.lever); setView('lab'); },
                    onStartDrill: startDrill,
                    onOpenTycoon: (taskId, task) => {
                      if (!task) return;
                      setFromBook(true);
                      const save = loadTycoonSave();
                      const lesson = { id: taskId, ...task };
                      if (save) { setTycoon({ initial: save, lesson }); return; }
                      setTycoonLesson(lesson); setSetupPreset({ sector: task.start }); setView('setup-biz');
                    },
                    onOpenScenario: (id) => { setFromBook(true); setSetupPreset({ scenario: id }); setView('setup'); },
                  }} />
              </Suspense>
            </div>
          )}
          {/* учебник поверх вкладки (например, «Открыть теорию» из карточки урока) — внизу отмечен «Учебник»;
              нажатие на вкладку закрывает его */}
          <BottomNav tab={bookOver && tab !== 'world' ? 'book' : tab} onTab={(t) => { if (bookOver) { setBookOver(false); setCloseTick((k) => k + 1); } setTab(t); }}
            onReselect={(t) => {
              /* повторное касание вкладки — как «назад» к её началу: учебник — в оглавление,
                 Путь — к рекомендованному уроку, лавка и профиль — наверх */
              if (t === 'book') setBookHome((k) => k + 1);
              // учебник поверх другой вкладки («Мой прогресс» из профиля): внизу горит «Учебник», и касание
              // по нему — тоже «на главную учебника», а не пустое нажатие
              if (t === 'book' && bookOver) { setBookOver(false); setCloseTick((k) => k + 1); setTab('book'); }
              if (t === 'path') setPathHome((k) => k + 1);
              if ((t === 'shop' || t === 'profile' || t === 'league' || t === 'news') && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
              // профиль: повторное касание закрывает и страницы поверх него — настройки, уведомления
              if (t === 'profile') setCloseTick((k) => k + 1);
            }} />
        </div>
      );
    }
    return (
      <Suspense fallback={<GameFallback />}>
        <GameScreen key={`${JSON.stringify(setup)}:${nonce}`} setup={setup} initial={loaded}
          theme={theme} setTheme={setTheme}
          onRestart={() => {
            const wasDrill = !!setup.drill; clearAutosave(); setLoaded(null); setSetup(null);
            if (gameFromBook) { setGameFromBook(false); backToBook(); } else setView(wasDrill ? 'drills' : 'menu');
          }} onLoadState={startLoaded}
          onReplay={setup.drill ? () => { clearAutosave(); setLoaded(null); setNonce((n) => n + 1); } : null} />
      </Suspense>
    );
  })();
  const inGame = !tycoon && (network || setup);
  const wrapped = inGame ? (
    <BookLinkContext.Provider value={openBookFromGame}>
      <div style={bookOverlay ? { display: 'none' } : undefined}>{screen}</div>
      {bookOverlay && (
        <Suspense fallback={<GameFallback />}>
          <TextbookScreen key={`${theme}:${JSON.stringify(bookOverlay)}`} startPage={bookOverlay} backLabel="← Назад в игру" onBack={closeBookOverlay} />
        </Suspense>
      )}
    </BookLinkContext.Provider>
  ) : screen;
  if (showcase) return <Suspense fallback={<GameFallback />}><DsShowcase /></Suspense>;
  if (showGate) {
    return (
      <div className="ems-root" data-testid="gate">
        <GlobalStyle />
        <Suspense fallback={<GameFallback />}><Welcome key={gateScreen} initialScreen={gateScreen} onCancel={guest ? () => setGate(false) : null} /></Suspense>
      </div>
    );
  }
  // ник под запретом: окно «Смените ник» или экран блокировки (src/account.jsx) — поверх любого экрана
  return <ScreenErrorBoundary resetKey={screenKey} onMenu={backToMenu}>{wrapped}<NameGate /></ScreenErrorBoundary>;
}
