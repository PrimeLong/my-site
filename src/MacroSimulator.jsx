import React, { useState, useEffect, Suspense } from 'react';
import {
  syncProgress, fetchRoom,
  fetchSoloSlots, fetchSoloSlot, deleteSoloSlot, fetchDailyBoard, fetchTycoonSlots, fetchTycoonSlot,
} from './lib/client.js';
import {
  Landmark, Coins, Globe2, TrendingUp, TrendingDown, Users, Scale, ShieldCheck, ChevronDown, X, Check,
  AlertTriangle, Bot, Target, Volume2, VolumeX, Music, Flag, Dices, Clock, Trophy, Lock, Share2,
  GraduationCap, Crown, Gavel, Hammer, Play, Calendar, BookOpen, Vote, Layers, PartyPopper,
  Award, BarChart3, Medal, Handshake, HeartHandshake, LifeBuoy, Ban, DoorOpen, Factory, Wheat, Save,
} from 'lucide-react';
import {
  CONFIG, ROLES, DIFFICULTIES, GOALS, SCENARIOS, CB_PERSONAS, MOF_PERSONAS, POLITICAL_REGIME_INFO,
  romanQ, quarterLabel, PRESIDENT_PERSONAS, dailyChallenge, dailyKey, dailySetup, SECTORS,
} from './lib/catalog.js';
// звуковой движок подгружается по первому клику — в стартовом файле только обёртка
import { Audio } from './audio/lazy.js';
import { InflatiaMark } from './logo.jsx';
import { AuthModal, ProfileModal, ProfileChip, useAccount, emblemIcon } from './account.jsx';
// профиль игрока живёт в src/account.jsx; сетевой экран и партия берут его отсюда
export { AuthModal, useAccount, emblemIcon, forgetAccount, loadAccount, EMBLEMS } from './account.jsx';

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
  chamber: { id: 'chamber', name: 'Дневная канцелярия', dark: false, colors: {
    bg: '#EFEADF', bgVignette: '#E7E1D2', panel: '#F7F3E9', panelAlt: '#EDE7D8', panelRaised: '#FFFCF4',
    border: '#D3C9B2', borderStrong: '#B5A888', hairline: '#E0D8C6',
    text: '#221F19', muted: '#5F5A4C', faint: '#67614F',
    paper: '#FBF7EC', paperText: '#221F19', paperMuted: '#6B6653', paperRule: '#CDC2A6',
    gold: '#735A0E', goldSoft: '#5E4A0B', goldDim: 'rgba(115,90,14,0.12)', ink: '#FBF7EC',
    teal: '#2F6B57', tealDim: 'rgba(47,107,87,0.12)',
    rust: '#94331F', rustDim: 'rgba(148,51,31,0.12)',
    blue: '#2F5578', blueDim: 'rgba(47,85,120,0.12)',
    sel: '#FFFFFF', selText: '#15130F', selBorder: '#8C7F62' } },
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

export const COLOR = { ...THEMES.ink.colors, isDark: true };

function applyTheme(id) {
  const t = THEMES[id] || THEMES.ink;
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
    .ems-serif { font-family:${FONT.serif}; }
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
    @media (max-width: 560px) { .ems-casino-grid { grid-template-columns: minmax(0,1fr) !important; } }
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

/* Государственная печать — единственный сквозной визуальный образ страны:
   не карта и не герб конкретного государства (их у безымянной страны панели
   нет и не может быть), а абстрактная эмблема власти, которая грубеет вместе
   с политическим режимом — то же самое, что уже делает газета своим тоном,
   но как знак, а не текст. Democracy: тонкие линии, разомкнутые насечки,
   контурная звезда. Totalitarian: двойное кольцо, сплошные насечки-клинья,
   залитая звезда. Один компонент на все режимы — только веса и заливки
   разные, чтобы получить не четыре разных значка, а один и тот же символ,
   который явно тяжелеет. */
export function StateSeal({ regime = 'democracy', size = 40, title }) {
  const info = POLITICAL_REGIME_INFO[regime] || POLITICAL_REGIME_INFO.democracy;
  const color = COLOR[info.color] || COLOR.gold;
  const hard = regime === 'authoritarian' || regime === 'totalitarian';
  const heavy = regime === 'totalitarian';
  const cx = 50; const cy = 50;
  const rOuter = 46; const rInner = hard ? 34 : 37;
  const tickInner = hard ? 38 : 40.5; const tickOuter = 45;
  const ticks = 16;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title || info.label} style={{ flexShrink: 0 }}>
      {heavy && <circle cx={cx} cy={cy} r={rOuter - 4.5} fill="none" stroke={color} strokeWidth={1.3} opacity={0.65} />}
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={color} strokeWidth={hard ? 3 : 1.6} />
      {Array.from({ length: ticks }).map((_, i) => {
        const a = (i / ticks) * Math.PI * 2;
        return (
          <line key={i} x1={(cx + Math.cos(a) * tickInner).toFixed(2)} y1={(cy + Math.sin(a) * tickInner).toFixed(2)}
            x2={(cx + Math.cos(a) * tickOuter).toFixed(2)} y2={(cy + Math.sin(a) * tickOuter).toFixed(2)}
            stroke={color} strokeWidth={hard ? 3.2 : 1.2} strokeLinecap={hard ? 'square' : 'round'} opacity={hard ? 0.9 : 0.55} />
        );
      })}
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={color} strokeWidth={hard ? 2.4 : 1.3} />
      <path d={starPath(cx, cy, hard ? 21 : 18, hard ? 9.5 : 7.5)} fill={hard ? color : 'none'} stroke={color} strokeWidth={hard ? 0 : 1.5} strokeLinejoin="round" />
    </svg>
  );
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
  const [music, setMusic] = useState(Audio.opts.music);
  const [sfx, setSfx] = useState(Audio.opts.sfx);
  const [vol, setVol] = useState(Audio.opts.volume);
  const [, forceRender] = useState(0);
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
          {[['Музыка', music, (v) => { setMusic(v); Audio.setMusic(v); }, Music],
            ['Интерфейс и события', sfx, (v) => { setSfx(v); Audio.setSfx(v); if (v) Audio.play('click'); }, Volume2]].map(([label, val, set, Icon]) => (
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
              onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); Audio.setVolume(v); }} />
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
  if (!data || data.app !== 'economic-panel') throw new Error('Это не сохранение Inflatia.');
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

const loadAutosave = () => {
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
  { id: 'first_quarter', icon: Play, title: 'Первый квартал', desc: 'Заверши первый квартал у руля экономики.' },
  { id: 'daily_done', icon: Medal, title: 'Вызов принят', desc: 'Пройди вызов дня до конца, не проиграв.' },
  { id: 'biz_triple', icon: Factory, title: 'Своё дело', desc: 'В «Своём деле» утрой стоимость компании против стартовой.' },
  { id: 'biz_survivor', icon: LifeBuoy, title: 'Выжить в кризис', desc: 'В «Своём деле» выбери при старте кризисный сценарий (валютный кризис, ипотечный пузырь или гиперинфляцию — не открытую партию) и продержи компанию 12 кварталов без банкротства.' },
  { id: 'tycoon_chain', icon: Wheat, title: 'От поля до полки', desc: 'Собери свою хлебную цепочку: ферма, мельница, хлебозавод и магазин.' },
  { id: 'tycoon_billion', icon: Crown, title: 'Миллиардер', desc: 'Доведи стоимость своей компании до миллиарда.' },
  { id: 'survivor_20', icon: Calendar, title: 'Ветеран', desc: 'Продержись 20 кварталов в одной партии.' },
  { id: 'survivor_40', icon: BookOpen, title: 'Долгожитель', desc: 'Продержись 40 кварталов в одной партии.' },
  { id: 'inflation_target', icon: Target, title: 'В яблочко', desc: 'Играя за Центробанк, удержи инфляцию рядом с целью 8 кварталов подряд.' },
  { id: 'gdp_double', icon: TrendingUp, title: 'Удвоение', desc: 'Удвой реальный ВВП от старта партии.' },
  { id: 'low_unemployment', icon: Users, title: 'Полная занятость', desc: 'Опусти безработицу ниже 4%.' },
  { id: 'debt_control', icon: Scale, title: 'Долговая дисциплина', desc: 'Играя за Минфин, снизь госдолг ниже 35% ВВП.' },
  { id: 'survived_crisis', icon: ShieldCheck, title: 'Пережили бурю', desc: 'Выведи страну из кризисного режима обратно к норме.' },
  { id: 'won_election', icon: Vote, title: 'Мандат доверия', desc: 'Останься у власти на выборах.' },
  { id: 'all_roles', icon: Layers, title: 'Все ветви власти', desc: 'Доведи до конца хотя бы один квартал за Центробанк, Минфин, премьер-министра, президента и трейдера.' },
  { id: 'network_played', icon: Share2, title: 'На двоих', desc: 'Доиграй хотя бы один квартал в партии по сети.' },
  { id: 'casino_win', icon: Dices, title: 'Дебют в казино', desc: 'Выиграй свою первую ставку в казино.' },
  // id прежние (открытые достижения сохраняются), смысл — закон больших чисел, а не куш
  { id: 'casino_jackpot', icon: Coins, title: 'Закон больших чисел', desc: 'Сделай 30 ставок в казино и сравни итог со счётчиком матожидания.' },
  { id: 'casino_ahead', icon: PartyPopper, title: 'Дом всегда выигрывает', desc: 'Сто ставок в казино: на такой дистанции итог почти наверняка сходится к ожидаемому проигрышу.' },
  { id: 'margin_call', icon: AlertTriangle, title: 'Маржин-колл', desc: 'Переживи принудительное закрытие позиций брокером и продолжи торговать.' },
  { id: 'tutorial_done', icon: GraduationCap, title: 'Курс молодого бойца', desc: 'Пройди первый модуль обучения.' },
  { id: 'tutorial_course_done', icon: Award, title: 'Экономист', desc: 'Пройди базовый курс целиком, вместе с экзаменом.' },
  { id: 'course_trader', icon: BarChart3, title: 'Аналитик', desc: 'Пройди курс частного инвестора целиком, вместе с экзаменом.' },
  { id: 'course_president', icon: Landmark, title: 'Государственный ум', desc: 'Пройди курс президента целиком, вместе с экзаменом.' },
  { id: 'course_all', icon: Medal, title: 'Красный диплом', desc: 'Пройди три курса с экзаменами: экономическую политику, частного инвестора и президента.' },
  { id: 'promises_kept', icon: Handshake, title: 'Слово держат', desc: 'Дойди до выборов, сдержав все три предвыборных обещания (премьер-министр или президент).' },
  { id: 'reformer', icon: Hammer, title: 'Реформатор', desc: 'Проведи три структурные реформы за одну партию (президент).' },
  { id: 'own_hands', icon: HeartHandshake, title: 'Своими руками', desc: 'Играя за президента, верни парламент, который сам же и распустил.' },
  { id: 'iron_president', icon: Gavel, title: 'Железная рука', desc: 'Играя за президента, доведи страну до тоталитарного режима.' },
  { id: 'imf_bailout', icon: LifeBuoy, title: 'Спасательный круг', desc: 'Играя за Минфин, получи экстренное финансирование МВФ вместо дефолта.' },
  { id: 'prices_stopped', icon: Award, title: 'Цены остановлены', desc: 'Доведи стабилизационную программу до конца: верни инфляцию из гиперинфляции к цели.' },
  { id: 'hardest_way_out', icon: Crown, title: 'Выход есть', desc: 'Сохрани демократию 16 кварталов в самом трудном сценарии — «Гиперинфляции».' },
  { id: 'diplomacy_sanctions', icon: Ban, title: 'Экономическое давление', desc: 'Играя за президента, введи санкции против торгового партнёра.' },
  { id: 'trade_bloc_join', icon: Globe2, title: 'Открытые границы', desc: 'Играя за президента, договорись о едином рынке с соседями.' },
  { id: 'cds_trade', icon: TrendingDown, title: 'Ставка на дефолт', desc: 'Соверши сделку по свопу на дефолт (CDS) в трейдерском терминале.' },
  { id: 'public_room_played', icon: DoorOpen, title: 'Открытая дверь', desc: 'Доиграй хотя бы один квартал в открытой (публичной) сетевой комнате.' },
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
});

export const writeLocalProgress = (profile) => {
  if (!profile) return;
  try {
    if (profile.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(profile.achievements));
    if (profile.roles) localStorage.setItem(ROLES_PLAYED_KEY, JSON.stringify(profile.roles));
    if (profile.network) localStorage.setItem(NETWORK_PLAYED_KEY, '1');
    else localStorage.removeItem(NETWORK_PLAYED_KEY);
    if (profile.courses) localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(profile.courses));
    if (profile.modules) localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(profile.modules));
    writeFolds(profile.folds);
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



export function AchievementsModal({ onClose }) {
  useEscapeClose(onClose);
  const unlocked = loadUnlockedAchievements();
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 560, width: '100%', maxHeight: '82vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Trophy size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Коллекция достижений</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 14 }}>
          Открыто {count} из {ACHIEVEMENTS.length}. Привязано к профилю, а не к сохранению партии: «Начать заново»
          коллекцию не сбрасывает, а связанные устройства делят её на двоих.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const done = !!unlocked[a.id];
            const AchIcon = a.icon;
            return (
              <div key={a.id} className="ems-panel" style={{ padding: '9px 11px', display: 'flex', gap: 10, alignItems: 'flex-start',
                opacity: done ? 1 : 0.55, borderColor: done ? COLOR.gold : COLOR.border }}>
                <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done ? <AchIcon size={19} color={COLOR.goldSoft} /> : <Lock size={18} color={COLOR.faint} />}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: done ? COLOR.goldSoft : COLOR.text }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// столько же, сколько в api/solo.js: слоты хранятся на сервере, клиент только рисует
export const SOLO_SLOT_COUNT = 4;

// оба трейдерских места делят одну и ту же роль из ROLES (id 'trader') — нумеруем
// их отдельно только в подписи, чтобы «Трейдер 1» и «Трейдер 2» не выглядели одним
// и тем же местом в UI
export const seatRole = (seat) => {
  if (seat === 'president') return ROLES.find((r) => r.id === 'president');
  if (seat === 'trader1' || seat === 'trader2') {
    const base = ROLES.find((r) => r.id === 'trader');
    const n = seat.slice(-1);
    return { ...base, short: `Трейдер ${n}`, title: `${base.title} ${n}` };
  }
  return ROLES.find((r) => r.id === seat);
};

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
// «Своё дело» — отдельная игра и отдельный чанк
const TycoonScreen = React.lazy(() => import('./tycoon.jsx').then((m) => ({ default: m.TycoonScreen })));
const GameScreen = React.lazy(() => loadGame().then((m) => ({ default: m.GameScreen })));
// подгрузить экран партии заранее (при наведении на «Новая партия», на экране настройки)
export function preloadGame() { loadGame().catch(() => {}); }

function GameFallback() {
  return (
    <div style={{ minHeight: '100vh', background: COLOR.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.muted, fontSize: 13 }}>
      Готовим кабинет…
    </div>
  );
}

// пока грузится сетевой чанк — тот же фон и тон, что у остальных заглушек
function NetworkFallback() {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLOR.bg, color: COLOR.muted, fontSize: 13 }}>
      Подключаем сетевую партию…
    </div>
  );
}

/* ============================ ВЫЗОВ ДНЯ ============================
   Карточка в меню, таблица результатов и то, что помнит само устройство: имя для
   таблицы и лучший свой балл за сегодня (чтобы карточка показывала его сразу, без
   запроса к серверу). Сам итог партии считает и отправляет экран партии. */
const DAILY_NAME_KEY = 'ems.daily.name';
const DAILY_BEST_KEY = 'ems.daily.best';
export function loadDailyName() {
  try { return localStorage.getItem(DAILY_NAME_KEY) || ''; } catch { return ''; }
}
export function saveDailyName(name) {
  try { localStorage.setItem(DAILY_NAME_KEY, name); } catch { /* приватный режим — имя просто не запомнится */ }
}
function loadDailyBest(day) {
  try {
    const v = JSON.parse(localStorage.getItem(DAILY_BEST_KEY) || 'null');
    return v && v.day === day && Number.isFinite(v.score) ? v : null;
  } catch { return null; }
}
export function recordDailyBest(day, score, defeated) {
  const prev = loadDailyBest(day);
  if (prev && prev.score >= score) return;
  try { localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ day, score, defeated: !!defeated })); } catch { /* см. выше */ }
}
export const dailyDateLabel = (day) => new Date(`${day}T12:00:00Z`)
  .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
// до полуночи по Москве — когда сменится вызов
function untilNextDaily(now = Date.now()) {
  const msk = now + 3 * 3600 * 1000;
  const left = 86400000 - (msk % 86400000);
  const h = Math.floor(left / 3600000); const m = Math.floor((left % 3600000) / 60000);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
const dailyRoleShort = (id) => (ROLES.find((r) => r.id === id) || {}).short || id;

/* Таблица дня. Если данные уже есть (ответ на отправку результата), показывает их,
   иначе запрашивает сама. playerId наружу не уходит — сервер помечает свою строку. */
export function DailyBoard({ day, data: given = null, limit = 10 }) {
  const [fetched, setFetched] = useState(null);
  const [err, setErr] = useState('');
  React.useEffect(() => {
    if (given) return undefined;
    let alive = true;
    setErr('');
    fetchDailyBoard(day, getPlayerId())
      .then((d) => { if (alive) setFetched(d); })
      .catch((e) => { if (alive) setErr(e.message || 'Таблица недоступна'); });
    return () => { alive = false; };
  }, [day, given]);
  const data = given || fetched;
  if (err) return <div style={{ fontSize: 12, color: COLOR.rust }}>{err}</div>;
  if (!data) return <div style={{ fontSize: 12, color: COLOR.faint }}>Загружаем таблицу…</div>;
  const rows = (data.rows || []).slice(0, limit);
  if (!rows.length) return <div style={{ fontSize: 12, color: COLOR.faint }}>Сегодня ещё никто не прошёл вызов — будьте первым.</div>;
  const you = data.you && !rows.some((r) => r.you) ? data.you : null;
  const row = (r) => (
    <div key={`${r.rank}-${r.name}`} style={{
      display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto auto', alignItems: 'center', gap: 8, padding: '6px 9px',
      background: r.you ? COLOR.goldDim : COLOR.panelAlt,
      border: `1px solid ${r.you ? COLOR.gold : COLOR.border}`, fontSize: 12 }}>
      <span className="ems-mono" style={{ color: r.rank <= 3 ? COLOR.gold : COLOR.faint, fontWeight: 600 }}>{r.rank}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.you ? COLOR.goldSoft : COLOR.text }}>
        {/* значок — у строк, записанных из профиля: имя за ними подтверждено */}
        {r.verified && (() => { const Em = emblemIcon(r.emblem); return <Em size={11} color={COLOR.gold} style={{ verticalAlign: -1, marginRight: 4 }} aria-label="профиль" />; })()}
        {r.name}{r.you ? ' (вы)' : ''}
      </span>
      <span style={{ fontSize: 12, color: r.defeated ? COLOR.rust : COLOR.faint, whiteSpace: 'nowrap' }}>
        {r.defeated ? `поражение, кв. ${r.quarters}` : dailyRoleShort(r.role)}
      </span>
      <span className="ems-mono" style={{ color: r.you ? COLOR.gold : COLOR.text, fontWeight: 600, minWidth: 34, textAlign: 'right' }}>
        {r.score.toFixed(1).replace('.', ',')}
      </span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(row)}
      {you && <div style={{ textAlign: 'center', color: COLOR.faint, fontSize: 12, lineHeight: 1 }}>⋯</div>}
      {you && row(you)}
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 3 }}>
        Всего участников: {data.total}. В таблице — лучший результат каждого за день.
      </div>
    </div>
  );
}

function DailyCard({ onStart }) {
  const ch = React.useMemo(() => dailyChallenge(dailyKey()), []);
  const [open, setOpen] = useState(false);
  const best = loadDailyBest(ch.day);
  const scenario = SCENARIOS.find((x) => x.id === ch.scenario) || SCENARIOS[0];
  const diff = DIFFICULTIES.find((x) => x.id === ch.difficulty) || DIFFICULTIES[1];
  const goal = GOALS.find((g) => g.id === ch.goal);
  const cbName = (CB_PERSONAS.find((x) => x.id === ch.cbPersona) || {}).name;
  const mofName = (MOF_PERSONAS.find((x) => x.id === ch.mofPersona) || {}).name;
  const presName = (PRESIDENT_PERSONAS.find((x) => x.id === ch.presPersona) || {}).name;
  const rivals = ch.role === 'central_bank' ? `Минфин: ${mofName} · президент: ${presName}`
    : ch.role === 'ministry_finance' ? `ЦБ: ${cbName} · президент: ${presName}`
      : ch.role === 'president' ? `ЦБ: ${cbName} · Минфин: ${mofName}` : 'обе ветви в ваших руках';
  const roleTitle = (ROLES.find((r) => r.id === ch.role) || {}).short;
  return (
    <div className="ems-panel ems-fade-in" style={{ padding: '13px 15px', marginBottom: 18, borderColor: `${COLOR.gold}88` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Calendar size={16} color={COLOR.gold} style={{ flexShrink: 0 }} />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>Вызов дня · {dailyDateLabel(ch.day)}</div>
          <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 1 }}>
            {roleTitle} · {scenario.id === 'sandbox' ? 'спокойный старт' : scenario.title.toLowerCase()} · {diff.title.toLowerCase()} · {ch.quarters} кв.
            {best ? <> · ваш лучший <b className="ems-mono" style={{ color: COLOR.gold }}>{best.score.toFixed(1).replace('.', ',')}</b></> : null}
          </div>
        </div>
        <button className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 12 }}
          onClick={() => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onStart(ch); }}>
          {best ? 'Ещё раз' : 'Принять вызов'}
        </button>
        <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          aria-expanded={open} onClick={() => { Audio.play('tab'); setOpen((v) => !v); }}>
          <Trophy size={13} />Таблица дня
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
            Одна партия на всех: тот же пост, тот же кризис и те же случайные события. Итог — пять оценок, где цель дня
            («{goal ? goal.label.toLowerCase() : '—'}») весит вдвое. Боты: {rivals}. Новый вызов через {untilNextDaily()}.
          </div>
          <DailyBoard day={ch.day} />
        </div>
      )}
    </div>
  );
}

/* Живая строка над меню: пустовавшая треть экрана стала биржевым табло страны.
   Числа — не из движка (меню не грузит его ради украшения), а лёгкое случайное
   блуждание вокруг стартовых значений партии: инфляция, ставка, рост, курс, индекс
   биржи и заголовки из жизни Инфлатии и соседей. Мини-график — инфляция за
   последние «кварталы» табло. При «уменьшить движение» строка стоит на месте. */
const TICKER_HEADLINES = ['ЦБ сохранил ключевую ставку', 'Минфин разместил облигации на 40 млрд', 'Норланд наращивает рыбный экспорт',
  'Вестравия зовёт в торговый блок', 'Урожай в Приреченской выше ожиданий', 'Дешт снизил цены на нефть', 'Стройка метро в Велеграде идёт по графику',
  'Профсоюзы требуют индексации зарплат', 'Рудногорские копи увеличили добычу'];
const TICKER_BASE = [
  { id: 'inf', label: 'Инфляция', v: 4.0, step: 0.12, unit: '%', dec: 1, bad: true },
  { id: 'rate', label: 'Ставка ЦБ', v: 5.5, step: 0.05, unit: '%', dec: 2, grid: 0.25 },
  { id: 'gdp', label: 'Рост ВВП', v: 2.3, step: 0.1, unit: '%', dec: 1 },
  { id: 'unemp', label: 'Безработица', v: 5.0, step: 0.06, unit: '%', dec: 1, bad: true },
  { id: 'fx', label: 'Курс', v: 100, step: 0.4, unit: '', dec: 1, bad: true },
  { id: 'idx', label: 'Индекс ВБ', v: 1000, step: 6, unit: '', dec: 0 },
];
function MenuTicker() {
  const [rows, setRows] = useState(() => TICKER_BASE.map((r) => ({ ...r, prev: r.v })));
  const [infHist, setInfHist] = useState(() => Array.from({ length: 16 }, (_, i) => 4 + Math.sin(i / 2.3) * 0.5));
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setRows((list) => list.map((r) => {
        const base = TICKER_BASE.find((b) => b.id === r.id).v;
        // шаг к стартовому значению плюс шум: табло живое, но не уходит в абсурд
        let v = r.v + (base - r.v) * 0.08 + (Math.random() - 0.5) * 2 * r.step;
        if (r.grid) v = Math.round(v / r.grid) * r.grid;
        return { ...r, prev: r.v, v };
      }));
      setInfHist((h) => [...h.slice(1), h[h.length - 1] + (4 - h[h.length - 1]) * 0.1 + (Math.random() - 0.5) * 0.3]);
    }, 3500);
    return () => clearInterval(id);
  }, []);
  const lo = Math.min(...infHist) - 0.2; const hi = Math.max(...infHist) + 0.2;
  const pts = infHist.map((v, i) => `${(i / (infHist.length - 1)) * 120},${34 - ((v - lo) / (hi - lo)) * 30}`).join(' ');
  const cells = rows.map((r) => {
    const d = r.v - r.prev;
    const up = d > 1e-9; const down = d < -1e-9;
    const tone = !up && !down ? COLOR.faint : (up !== !!r.bad) ? COLOR.teal : COLOR.rust;
    return (
      <span key={r.id} className="menu-tick-cell">
        <span style={{ color: COLOR.muted }}>{r.label}</span>{' '}
        <span className="ems-mono" style={{ color: COLOR.text }}>{r.v.toFixed(r.dec).replace('.', ',')}{r.unit}</span>{' '}
        <span style={{ color: tone, fontSize: 10 }}>{up ? '▲' : down ? '▼' : '•'}</span>
      </span>
    );
  });
  const news = TICKER_HEADLINES.map((h) => <span key={h} className="menu-tick-cell" style={{ color: COLOR.goldSoft }}>◆ {h}</span>);
  return (
    <div className="ems-fade-in menu-ticker" aria-hidden="true">
      <div className="menu-ticker-spark">
        <div style={{ fontSize: 11, color: COLOR.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Инфляция, 4 года</div>
        <svg width="120" height="36" viewBox="0 0 120 36" style={{ display: 'block' }}>
          <polyline points={pts} fill="none" stroke={COLOR.gold} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="120" cy={34 - ((infHist[infHist.length - 1] - lo) / (hi - lo)) * 30} r="2.4" fill={COLOR.goldSoft} />
        </svg>
      </div>
      <div className="menu-ticker-band">
        <div className="menu-ticker-track">{cells}{news}{cells.map((c) => React.cloneElement(c, { key: `${c.key}b` }))}{news.map((c) => React.cloneElement(c, { key: `${c.key}b` }))}</div>
      </div>
    </div>
  );
}

function MainMenu({ theme, setTheme, onNewGame, onNetwork, onTutorial, onLoad, onEnterNetwork, onDaily, onTycoon }) {
  // профиль может смениться прямо здесь (связывание устройств), поэтому это
  // состояние, а не разовое чтение: после связывания список слотов перечитывается
  const [playerId, setPlayerIdState] = useState(getPlayerId);
  // экран партии подтягиваем в фоне, когда меню уже нарисовано
  React.useEffect(() => { const t = setTimeout(preloadGame, 1500); return () => clearTimeout(t); }, []);
  const [soloSlots, setSoloSlots] = useState(null);
  const [slotBusy, setSlotBusy] = useState(null);
  const [slotError, setSlotError] = useState('');
  const [storageMode, setStorageMode] = useState(null);
  const [showAch, setShowAch] = useState(false);
  // профиль игрока в шапке меню: вход, регистрация, статистика
  const account = useAccount();
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const switchPlayer = (id) => { setPlayerIdState(id); setSoloSlots(null); setSlotError(''); };
  const profileSlot = <ProfileChip account={account} onClick={() => { Audio.play('click'); if (account) setShowProfile(true); else setShowAuth(true); }} />;
  // партия из автосохранения обычно открывается сама, минуя меню (см. App()) —
  // сюда игрок попадает с ней «на руках» только если разбирался с крашем
  // («Вернуться в меню» не трогает автосохранение) или пришёл по ссылке-
  // приглашению в сетевую комнату. Карточка здесь — и подстраховка на этот
  // случай, и просто видимое подтверждение того, что автосохранение вообще есть.
  const [autosave] = useState(loadAutosave);
  // сетевая партия ничего не теряет при случайном закрытии вкладки (комната
  // живёт на сервере), но раньше, чтобы в неё вернуться, нужно было ещё
  // знать, что для этого нужно зайти в «Игра по сети» → «Ваши партии» —
  // не самый очевидный путь после случайной перезагрузки. Здесь та же
  // карточка «на видном месте», что и для одиночного автосохранения.
  const [networkSlots, setNetworkSlots] = useState(loadNetworkSlots);
  const networkSlotPreviews = useNetworkSlotPreviews(networkSlots);
  const [networkSlotBusy, setNetworkSlotBusy] = useState(null);
  const enterNetworkSlot = async (idx) => {
    const slot = networkSlots[idx];
    if (!slot) return;
    setNetworkSlotBusy(idx);
    try {
      const data = await fetchRoom(slot.id, undefined, slot.seat, slot.token);
      if (!data.room) throw new Error('Комната недоступна');
      Audio.prime(); Audio.play('stamp'); Audio.startMusic();
      onEnterNetwork({ id: slot.id, seat: slot.seat, token: slot.token, ownerToken: slot.ownerToken || null, room: data.room });
    } catch {
      clearNetworkSlotAt(idx); setNetworkSlots(loadNetworkSlots());
    } finally { setNetworkSlotBusy(null); }
  };
  React.useEffect(() => {
    fetchSoloSlots(playerId).then((d) => { setSoloSlots(d.slots); setStorageMode(d.storage || null); })
      .catch(() => setSoloSlots(Array(SOLO_SLOT_COUNT).fill(null)));
    if (onTycoon) fetchTycoonSlots(playerId).then((d) => setTycoonSlots(d.slots || [])).catch(() => setTycoonSlots([]));
    // заодно подтягиваем общий прогресс: со связанного устройства могли прийти
    // новые достижения и пройденные модули
    syncProfile(playerId);
  }, [playerId]);
  /* Меню — тоже часть игры, и тишины в нём быть не должно. Автозапуск звука
     браузер не разрешает до первого действия человека, поэтому заводим музыку
     либо сразу (если звук уже разбужен в этой сессии — например, игрок вернулся
     из обучения), либо по первому же клику или нажатию клавиши.
     Роль при выходе не сбрасываем: следом идёт экран новой партии, и обрывать
     музыку между двумя экранами меню было бы хуже, чем дать ей доиграть. */
  React.useEffect(() => {
    Audio.setRole('menu');
    const kick = () => { if (Audio.prime() && Audio.opts.music) Audio.startMusic(); };
    if (Audio.primed()) kick();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);
  const enterSlot = async (idx) => {
    setSlotBusy(idx); setSlotError('');
    try {
      const snap = await fetchSoloSlot(playerId, idx);
      Audio.prime(); Audio.play('stamp'); Audio.startMusic();
      onLoad({ ...snap, slotIdx: idx });
    } catch (e) { setSlotError(e.message); setSlotBusy(null); }
  };
  const removeSlot = async (idx) => {
    try { setSoloSlots(await deleteSoloSlot(playerId, idx)); } catch (e) { setSlotError(e.message); }
  };
  const hasSaves = !!(soloSlots && soloSlots.some(Boolean));

  const [tycoonSave] = useState(loadTycoonSave);
  const [tycoonSlots, setTycoonSlots] = useState([]);
  const [tycoonBusy, setTycoonBusy] = useState(null);
  const [savesOpen, setSavesOpen] = useState(false);
  const [savesTab, setSavesTab] = useState('solo');
  const enterTycoonSlot = async (idx) => {
    setTycoonBusy(idx);
    try { const snap = await fetchTycoonSlot(playerId, idx); Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(snap); }
    catch (e) { setSlotError(e.message); setTycoonBusy(null); }
  };
  const roleShort = (id) => (ROLES.find((r) => r.id === id) || {}).short || id;
  const moneyShort = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} млрд` : v >= 1 ? `${v.toFixed(1)} млн` : `${Math.round(v * 1000)} тыс`);

  /* «Продолжить» — одна главная кнопка вместо трёх карточек с сохранениями подряд:
     самое свежее из одиночной партии и «Своего дела»; второе — строкой под ней. */
  const soloTime = autosave ? Date.parse(autosave.savedAt || 0) || 0 : 0;
  const tycoonTime = tycoonSave ? Number(tycoonSave.savedAt) || 0 : 0;
  const continues = [
    autosave && { id: 'solo', time: soloTime, icon: ROLE_ICON[(ROLES.find((r) => r.id === autosave.setup.role) || {}).icon] || Flag,
      title: roleShort(autosave.setup.role), sub: `${quarterLabel(autosave.quarterIndex || 1)}${autosave.setup.daily ? ' · вызов дня' : ''}`,
      go: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onLoad(autosave); } },
    tycoonSave && onTycoon && { id: 'tycoon', time: tycoonTime, icon: Factory, title: 'Своё дело',
      sub: `${tycoonSave.buildings.length} зданий · на счёте ${moneyShort(tycoonSave.cash || 0)}`,
      go: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(tycoonSave); } },
  ].filter(Boolean).sort((x, y) => y.time - x.time);
  const mainContinue = continues[0] || null;
  const savesCount = { solo: (soloSlots || []).filter(Boolean).length, tycoon: tycoonSlots.filter(Boolean).length, network: networkSlots.filter(Boolean).length };
  const savesTotal = savesCount.solo + savesCount.tycoon + savesCount.network;

  const MODES = [
    { id: 'new', icon: Landmark, title: 'Партия у руля страны', tag: 'ЦБ · Минфин · президент · премьер · трейдер',
      desc: 'Выберите пост и проведите страну через кризисы, выборы и войны. Второй ветвью власти управляет бот со своим характером.',
      action: () => { Audio.prime(); Audio.play('stamp'); onNewGame(); } },
    ...(onTycoon ? [{ id: 'tycoon', icon: Factory, title: 'Своё дело', tag: 'тайкун в реальном времени',
      desc: 'Фермы, заводы, магазины и экспорт по всей стране. Экономика живёт сама — вы строите бизнес внутри неё.',
      action: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(tycoonSave); } }] : []),
    { id: 'network', icon: Users, title: 'По сети', tag: 'вдвоём или втроём',
      desc: 'ЦБ, Минфин и президент — разные люди на одной экономике. Комната по коду или из списка открытых.',
      action: () => { Audio.prime(); Audio.play('tab'); onNetwork(); } },
    { id: 'tutorial', icon: GraduationCap, title: 'Обучение', tag: 'курсы с практикой',
      desc: 'Как работают ставка, бюджет, рынок и власть — короткими уроками с тестами и экзаменами.',
      action: () => { Audio.prime(); Audio.play('tab'); onTutorial(); } },
  ];

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '36px 16px 48px' }}>
      <GlobalStyle />
      <style>{menuCss()}</style>
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onDone={(pf, id) => switchPlayer(id)} />}
      {/* сохранения и достижения едут за профилем — «связать устройства» кодом больше не нужно */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} onSwitched={switchPlayer} />}
      {/* margin: auto по вертикали — меню стоит по центру высокого экрана, а когда
          раскрыты сохранения и оно выше окна, просто прокручивается, не уезжая вверх */}
      <div style={{ maxWidth: 760, width: '100%', margin: 'auto 0' }}>
        <MenuTicker />
        {/* шапка: печать, название и одна строка о том, что это */}
        <div className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          <InflatiaMark size={54} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="ems-serif menu-title">Inflatia</h1>
            <div className="ems-hero-eyebrow menu-eyebrow" style={{ textAlign: 'left', marginTop: 3 }}>Симулятор государства и бизнеса</div>
          </div>
          {profileSlot}
        </div>

        {storageMode === 'memory' && (
          <div className="ems-fade-in" style={{ fontSize: 12, color: COLOR.rust, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            Сервер без общего хранилища (Redis): сохранения на сервере могут пропадать. Это настройка развёртывания, не партии.
          </div>
        )}

        {/* 1. Продолжить */}
        {mainContinue && (
          <div className="ems-fade-in menu-continue" role="button" tabIndex={0} onClick={mainContinue.go}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') mainContinue.go(); }}>
            <div className="ems-card-icon" style={{ width: 46, height: 46, flexShrink: 0 }}><mainContinue.icon size={21} color={COLOR.gold} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: COLOR.goldSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Продолжить</div>
              <div className="ems-serif" style={{ fontSize: 18, color: COLOR.text, marginTop: 1 }}>{mainContinue.title}</div>
              <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>{mainContinue.sub}</div>
            </div>
            <Play size={22} color={COLOR.gold} style={{ flexShrink: 0 }} />
          </div>
        )}
        {continues[1] && (
          <button className="ems-btn menu-continue-alt ems-fade-in" onClick={continues[1].go}>
            <span style={{ color: COLOR.faint }}>или</span> {continues[1].title} · <span style={{ color: COLOR.muted }}>{continues[1].sub}</span>
            <ChevronDown size={13} style={{ transform: 'rotate(-90deg)', marginLeft: 'auto' }} />
          </button>
        )}

        {/* 2. Режимы */}
        <div className="menu-section-label">{mainContinue ? 'Или начните новое' : 'Во что сыграть'}</div>
        <div className="menu-modes">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={m.id} className="ems-card-btn ems-fade-in menu-mode" style={{ animationDelay: `${60 + i * 50}ms` }}
                role="button" tabIndex={0} onClick={m.action} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') m.action(); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div className="ems-card-icon" style={{ width: 38, height: 38 }}><Icon size={18} color={COLOR.gold} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="ems-serif" style={{ fontSize: 16, color: COLOR.text }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: COLOR.goldSoft, marginTop: 1 }}>{m.tag}</div>
                  </div>
                </div>
                <div className="menu-mode-desc" style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.5, marginTop: 9 }}>{m.desc}</div>
              </div>
            );
          })}
        </div>

        {/* 3. Вызов дня */}
        {onDaily && <DailyCard onStart={onDaily} />}

        {/* 4. Все сохранения — свёрнуты, чтобы не заслонять главное */}
        {savesTotal > 0 && (
          <div className="ems-panel ems-fade-in" style={{ padding: 0, marginBottom: 18, overflow: 'hidden' }}>
            <button className="menu-fold" aria-expanded={savesOpen} onClick={() => { Audio.play('tab'); setSavesOpen((v) => !v); }}>
              <Save size={14} color={COLOR.gold} />
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Все сохранения</span>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{savesTotal}</span>
              <ChevronDown size={14} color={COLOR.muted} style={{ marginLeft: 'auto', transform: savesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {savesOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <div className="ems-seg" role="tablist" style={{ display: 'flex', marginBottom: 10 }}>
                  {[['solo', 'Партии'], ['tycoon', 'Своё дело'], ['network', 'По сети']].filter(([id]) => savesCount[id] > 0 || id === 'solo').map(([id, label]) => (
                    <button key={id} role="tab" aria-pressed={savesTab === id} style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                      onClick={() => setSavesTab(id)}>{label} · {savesCount[id]}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {savesTab === 'solo' && (hasSaves ? soloSlots.map((slot, idx) => (slot ? (
                    <div key={idx} className="ems-row-hover menu-slot">
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {slot.name && <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.name}</span>}
                        <span style={{ fontSize: 12, color: slot.name ? COLOR.faint : COLOR.text }}>
                          Слот {idx + 1} · {roleShort(slot.role)} · {quarterLabel(slot.quarterIndex || 1)}
                        </span>
                      </span>
                      <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12 }} disabled={slotBusy === idx}
                        onClick={() => enterSlot(idx)}>{slotBusy === idx ? 'Загружаем…' : 'Играть'}</button>
                      <button onClick={() => removeSlot(idx)} aria-label="Удалить сохранение" className="menu-x"><X size={12} /></button>
                    </div>
                  ) : null)) : <div style={{ fontSize: 12, color: COLOR.faint }}>Сохранённых партий на сервере нет — сохраняйте кнопкой «Партия» в игре.</div>)}
                  {savesTab === 'tycoon' && tycoonSlots.map((slot, idx) => (slot ? (
                    <div key={idx} className="ems-row-hover menu-slot">
                      <span style={{ flex: 1, minWidth: 0 }}>Слот {idx + 1} · {quarterLabel(slot.quarterIndex || 1)} · {slot.buildings} зданий</span>
                      <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12 }} disabled={tycoonBusy === idx}
                        onClick={() => enterTycoonSlot(idx)}>{tycoonBusy === idx ? 'Загружаем…' : 'Играть'}</button>
                    </div>
                  ) : null))}
                  {savesTab === 'network' && networkSlots.map((slot, idx) => {
                    if (!slot) return null;
                    const rd = seatRole(slot.seat);
                    const preview = networkSlotPreviews[idx];
                    return (
                      <div key={idx} className="ems-row-hover menu-slot">
                        <span style={{ flex: 1, minWidth: 0 }}>
                          Комната <b className="ems-mono">{slot.id}</b> · {rd.short}{preview && <span style={{ color: COLOR.faint }}> · {quarterLabel(preview.quarterIndex)}</span>}
                        </span>
                        <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12 }} disabled={networkSlotBusy === idx}
                          onClick={() => enterNetworkSlot(idx)}>{networkSlotBusy === idx ? 'Входим…' : 'Войти'}</button>
                      </div>
                    );
                  })}
                </div>
                {slotError && <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 8 }}>{slotError}</div>}
              </div>
            )}
          </div>
        )}

        {/* 5. Мелкое: достижения, устройства, оформление, звук */}
        <div className="menu-footer ems-fade-in">
          <button className="ems-btn menu-chip" onClick={() => { Audio.play('click'); setShowAch(true); }}><Trophy size={13} color={COLOR.gold} />Достижения</button>
          <label className="menu-chip menu-theme">
            <span style={{ fontSize: 12, color: COLOR.faint }}>Оформление</span>
            <select value={theme} onChange={(e) => { Audio.play('tab'); setTheme(e.target.value); }} aria-label="Оформление">
              {Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <AudioControls />
        </div>
      </div>
    </div>
  );
}

// функция, а не строка: цвета берутся из текущей темы при каждой отрисовке
const menuCss = () => `
  .menu-ticker { display: flex; align-items: center; gap: 14px; margin-bottom: 30px; padding: 10px 14px; border: 1px solid ${COLOR.border};
    border-radius: 12px; background: ${COLOR.panel}cc; overflow: hidden; }
  .menu-ticker-spark { flex-shrink: 0; padding-right: 14px; border-right: 1px solid ${COLOR.hairline}; }
  .menu-ticker-band { flex: 1; min-width: 0; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 3%, #000 94%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 3%, #000 94%, transparent); }
  .menu-ticker-track { display: inline-flex; white-space: nowrap; animation: menuTicker 70s linear infinite; }
  .menu-tick-cell { padding: 0 16px; font-size: 13px; }
  @keyframes menuTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (max-width: 560px) { .menu-ticker-spark { display: none; } .menu-ticker { margin-bottom: 22px; padding: 8px 10px; } }
  @media (prefers-reduced-motion: reduce) { .menu-ticker-track { animation: none; } }
  .menu-title { margin: 0; font-size: 30px; line-height: 1.05; font-weight: 700; letter-spacing: 0.02em; color: ${COLOR.goldSoft}; }
  @media (max-width: 560px) { .menu-title { font-size: 25px; } }
  .menu-profile { display: flex; align-items: center; gap: 7px; padding: 7px 11px; font-size: 13px; flex-shrink: 0; max-width: 170px; }
  .menu-profile-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 560px) { .menu-profile { padding: 7px 9px; max-width: 110px; } .menu-eyebrow { font-size: 12px; letter-spacing: 0.1em; } }
  .menu-continue { display: flex; align-items: center; gap: 14px; cursor: pointer; padding: 16px 18px; margin-bottom: 8px;
    border-radius: 14px; border: 1px solid ${COLOR.gold}; background: linear-gradient(135deg, ${COLOR.goldDim}, ${COLOR.panel} 70%);
    box-shadow: 0 16px 36px -20px rgba(0,0,0,0.7); transition: transform .18s ease, box-shadow .18s ease; }
  .menu-continue:hover, .menu-continue:focus-visible { transform: translateY(-2px); box-shadow: 0 22px 40px -18px rgba(0,0,0,0.75); outline: none; }
  .menu-continue-alt { width: 100%; display: flex; align-items: center; gap: 6px; padding: 9px 14px; font-size: 13px; text-align: left; margin-bottom: 4px; }
  .menu-section-label { font-size: 12px; color: ${COLOR.faint}; letter-spacing: 0.1em; text-transform: uppercase; margin: 20px 0 10px; }
  .menu-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
  @media (max-width: 600px) { .menu-modes { grid-template-columns: minmax(0, 1fr); } }
  .menu-mode { flex-direction: column; align-items: stretch !important; gap: 0 !important; padding: 15px 16px; }
  @media (max-width: 600px) { .menu-mode-desc { display: none; } .menu-mode { padding: 12px 14px; } }
  .menu-fold { width: 100%; display: flex; align-items: center; gap: 8px; padding: 13px 15px; background: none; border: none; cursor: pointer; font: inherit; color: inherit; text-align: left; }
  .menu-slot { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ${COLOR.panelAlt}; border: 1px solid ${COLOR.border}; font-size: 12px; color: ${COLOR.text}; }
  .menu-x { background: none; border: none; cursor: pointer; color: ${COLOR.faint}; padding: 2px; line-height: 0; }
  .menu-footer { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .menu-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; font-size: 12px; border-radius: 999px; }
  .menu-theme { border: 1px solid ${COLOR.border}; background: ${COLOR.panelAlt}; }
  .menu-theme select { background: transparent; color: ${COLOR.text}; border: none; font: inherit; font-size: 12px; cursor: pointer; }
  .menu-theme select option { background: ${COLOR.panel}; color: ${COLOR.text}; }
`;

/* ============================ ЭКРАН ВЫБОРА ============================ */
function SetupScreen({ onStart, onBack, initialRole = null }) {
  React.useEffect(preloadGame, []);
  const [role, setRole] = useState(initialRole);
  const [difficulty, setDifficulty] = useState('medium');
  const [goal, setGoalRaw] = useState('living_standards');
  const setGoal = (g) => setGoalRaw(g);
  React.useEffect(() => { setGoalRaw(role === 'trader' ? 'max_wealth' : role === 'entrepreneur' ? 'company_value' : 'living_standards'); }, [role]);
  // отрасль компании — только для предпринимателя
  const [sector, setSector] = useState('farm');
  const [scenario, setScenario] = useState('sandbox');
  // обучение по экрану партии: у тех, кто ещё не играл ни одной ролью, включено само
  const [tour, setTour] = useState(() => loadRolesPlayed().length === 0);
  const [cbPersona, setCbPersona] = useState('pragmatic');
  const [mofPersona, setMofPersona] = useState('technocrat');
  /* Классика против настраиваемой партии. В классике характеры ведомств бросаются
     случайно, а президент включён — то есть игрок садится за пульт, не выбирая
     заранее, с кем ему иметь дело. Все эти ручки никуда не делись, они просто не
     вываливаются на человека, который хочет просто начать играть. */
  const [mode, setMode] = useState('classic');
  const [presEnabled, setPresEnabled] = useState(true);
  const [presPersona, setPresPersona] = useState('random');
  const roleDef = ROLES.find((r) => r.id === role);
  const botRole = roleDef ? roleDef.botRole : null;
  // президент-бот имеет смысл только там, где над игроком вообще кто-то стоит
  const presAvailable = role === 'central_bank' || role === 'ministry_finance' || role === 'trader' || role === 'entrepreneur';
  const custom = mode === 'custom';
  const personaBlocks = botRole === 'central_bank' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' }]
    : botRole === 'ministry_finance' ? [{ list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }]
      : botRole === 'both' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' },
        { list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }] : [];

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 800, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 34 }}>
          <div className="ems-hero-eyebrow">Новая партия</div>
          <div className="ems-hero-title small">Вступление в должность</div>
          <div className="ems-hero-rule" />
          <span className="ems-hero-badge"><Clock size={11} color={COLOR.gold} />{romanQ(1)} кв. {CONFIG.startYear}</span>
          <div className="ems-hero-lede">
            Экономика работает как цепочка причин: ставка → рыночные ставки → кредит → спрос → выпуск → занятость → зарплаты → цены → ожидания. Второй ветвью власти управляет бот со своим характером, а над обоими ведомствами стоит президент — и требования будут у каждого из них.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>1</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Ваш пост</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 26 }}>
          {/* «Своё дело» — отдельная игра со своим входом в меню: среди постов «Партии у
              руля страны» предприниматель только путал. И наоборот, из меню «Своего дела»
              государственные посты не предлагаются. */}
          {ROLES.filter((r) => (initialRole === 'entrepreneur') === (r.id === 'entrepreneur')).map((r) => {
            const Icon = ROLE_ICON[r.icon]; const active = role === r.id;
            return (
              <div key={r.id} onClick={() => { Audio.prime(); Audio.play('click'); setRole(r.id); }} className="ems-card-btn"
                style={{ padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(r.id); }}>
                {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 14, right: 14 }} />}
                {/* иконка — рядом с названием, а не отдельной строкой над ним: на телефоне
                    пять карточек растягивались на два экрана */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 7, paddingRight: 18 }}>
                  <div className="ems-card-icon" style={{ width: 34, height: 34 }}>
                    <Icon size={16} color={COLOR.gold} />
                  </div>
                  <div className="ems-serif" style={{ fontSize: 15, color: active ? COLOR.goldSoft : COLOR.text }}>{r.title}</div>
                </div>
                <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            );
          })}
        </div>

        {role === 'entrepreneur' && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Ваша компания</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 10, marginBottom: 26 }}>
              {SECTORS.map((sc) => {
                const active = sector === sc.id;
                return (
                  <div key={sc.id} onClick={() => { Audio.play('click'); setSector(sc.id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} aria-pressed={active} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSector(sc.id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div className="ems-serif" style={{ fontSize: 14, color: active ? COLOR.goldSoft : COLOR.text }}>{sc.title}</div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '2px 0 5px' }}>{sc.short}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{sc.desc}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {role && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>2</span>
              <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Как настраивать партию</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: custom ? 22 : 26 }}>
              {[['classic', 'Классика', 'Открытая партия без стартового кризиса, характеры ведомств бросаются случайно, президент включён. Начать и разбираться по ходу — как и должно быть в первый раз.'],
                ['custom', 'Настраиваемая', 'Выбрать стартовую ситуацию — от открытой партии до гиперинфляции, — характер каждого ведомства и президента или отключить президента совсем.']].map(([id, title, note]) => {
                const active = mode === id;
                return (
                  <div key={id} onClick={() => { Audio.play('click'); setMode(id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMode(id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div className="ems-serif" style={{ fontSize: 14, marginBottom: 4, color: active ? COLOR.goldSoft : COLOR.text }}>{title}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{note}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {custom && presAvailable && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Президент</span>
              <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12,
                background: presEnabled ? COLOR.sel : COLOR.panelAlt, color: presEnabled ? COLOR.selText : COLOR.muted,
                borderColor: presEnabled ? COLOR.selBorder : COLOR.border }}
                onClick={() => { Audio.play('tick'); setPresEnabled((v) => !v); }}>
                {presEnabled ? 'включён' : 'выключен'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10, lineHeight: 1.45 }}>
              {role === 'trader' || role === 'entrepreneur'
                ? `Президент не управляет ставкой и бюджетом, но требует своего от обоих ведомств и тратит политический капитал на реформы — для ${role === 'trader' ? 'рынка' : 'бизнеса'} это ещё один источник новостей и риска.`
                : 'Над вашим ведомством стоит президент: он выдвигает требования, назначает руководителя соседнего ведомства и тратит политический капитал на реформы и указы. Требования можно игнорировать — но администрация ведёт счёт, и на нуле терпения следует отставка.'}
            </div>
            {presEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 22 }}>
                {PRESIDENT_PERSONAS.map((p) => {
                  const active = presPersona === p.id;
                  return (
                    <div key={p.id} onClick={() => { Audio.play('click'); setPresPersona(p.id); }} className="ems-card-btn"
                      style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                        borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPresPersona(p.id); }}>
                      {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Crown size={14} color={active ? COLOR.gold : COLOR.muted} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
                    </div>
                  );
                })}
                {(() => {
                  const active = presPersona === 'random';
                  return (
                    <div onClick={() => { Audio.play('click'); setPresPersona('random'); }} className="ems-card-btn"
                      style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                        borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPresPersona('random'); }}>
                      {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Dices size={14} color={active ? COLOR.gold : COLOR.muted} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>С кем придётся работать, выяснится уже в должности.</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {custom && personaBlocks.map((blk, bi) => (
          <React.Fragment key={blk.title}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{bi === 0 ? '' : ''}</span>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{blk.title}</span>
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10 }}>
              {role === 'president'
                ? (blk.list === CB_PERSONAS
                  ? 'С этим человеком вы начнёте срок. Сменить его можно и позже — но досрочная отставка главы ЦБ стоит доверия к денежной политике.'
                  : 'С этим министром вы начнёте срок. Заменить его дешевле, чем главу ЦБ, — но бюджет будет переписан под нового.')
                : botRole === 'both' ? 'Вы не управляете этим ведомством — но от его решений зависит стоимость ваших активов.'
                  : blk.list === CB_PERSONAS ? 'Ставкой будет управлять бот-ЦБ. От его характера зависит, насколько дорого вам обойдётся бюджетная экспансия.'
                    : 'Бюджетом будет управлять бот-Минфин. От его характера зависит, с какой инфляцией и каким долгом вам придётся иметь дело.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 22 }}>
              {blk.list.map((p) => {
                const active = blk.value === p.id;
                return (
                  <div key={p.id} onClick={() => { Audio.play('click'); blk.set(p.id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') blk.set(p.id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Bot size={14} color={active ? COLOR.gold : COLOR.muted} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
                  </div>
                );
              })}
              {(() => {
                const active = blk.value === 'random';
                return (
                  <div onClick={() => { Audio.play('click'); blk.set('random'); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') blk.set('random'); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Dices size={14} color={active ? COLOR.gold : COLOR.muted} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>Характер определится в момент вступления в должность — не будете знать заранее, с кем имеете дело.</div>
                  </div>
                );
              })()}
            </div>
          </React.Fragment>
        ))}

        {/* сценарий задаёт не песочницу, а другую стартовую точку той же экономики:
            переопределяет часть начальных условий движка, а не превращает партию
            во что-то отдельное — сюжет, обучение и достижения работают как обычно.
            Выбор сценария — часть настраиваемой партии: классика всегда начинается
            с открытой партии, как и положено в первый раз, а кризисные старты —
            для тех, кто уже решил, с чем хочет иметь дело. */}
        {custom && (<>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>{role ? 3 : 2}</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Стартовая ситуация</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px,1fr))', gap: 10, marginBottom: 26 }}>
          {[...SCENARIOS].sort((a, b) => (a.level || 0) - (b.level || 0)).map((sc) => {
            const active = scenario === sc.id;
            // от спокойного к опасному: бирюзовый → золотой → ржавый
            const levelColor = sc.level >= 4 ? COLOR.rust : sc.level === 3 ? COLOR.gold : sc.level === 2 ? COLOR.goldSoft : COLOR.teal;
            return (
              <div key={sc.id} onClick={() => { Audio.play('click'); setScenario(sc.id); }} className="ems-card-btn"
                style={{ padding: 13, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScenario(sc.id); }}>
                {active && <Check size={12} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                <div className="ems-serif" style={{ fontSize: 13, marginBottom: 4, color: active ? COLOR.goldSoft : COLOR.text }}>{sc.title}</div>
                {sc.level && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
                    aria-label={`Сложность: ${sc.levelLabel}, ${sc.level} из 4`}>
                    <span aria-hidden style={{ display: 'flex', gap: 3 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} style={{ width: 12, height: 4, borderRadius: 2, background: i <= sc.level ? levelColor : COLOR.borderStrong, opacity: i <= sc.level ? 1 : 0.55 }} />
                      ))}
                    </span>
                    <span className="ems-mono" style={{ fontSize: 12, color: levelColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{sc.levelLabel}</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{sc.desc}</div>
                {sc.levelNote && <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginTop: 6 }}>{sc.levelNote}</div>}
              </div>
            );
          })}
        </div>
        </>)}

        {/* сложность и приоритет — это быстрые настройки, а не решения того же веса,
            что роль: сводим в одну компактную секцию вместо двух полноразмерных
            сеток карточек, чтобы «пост» на экране визуально оставался главным */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>{2 + (role ? 1 : 0) + (custom ? 1 : 0)}</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Сложность и приоритет</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 20, marginBottom: 30 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {DIFFICULTIES.map((dd) => {
                const active = difficulty === dd.id;
                return (
                  <button type="button" key={dd.id} className={`ems-tab ${active ? 'active' : ''}`} aria-pressed={active}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0', fontSize: 13 }}
                    onClick={() => { Audio.play('click'); setDifficulty(dd.id); }}>{dd.title}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>
              {(DIFFICULTIES.find((dd) => dd.id === difficulty) || {}).desc}
            </div>
          </div>
          {role !== 'entrepreneur' && (
            <div>
              <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 8 }}>По какой оценке подводить итог партии</div>
              <div style={{ position: 'relative' }}>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="ems-btn"
                  style={{ width: '100%', padding: '10px 36px 10px 12px', fontSize: 13, appearance: 'none', WebkitAppearance: 'none' }}>
                  {GOALS.filter((g) => (role === 'trader' ? g.trader : role === 'entrepreneur' ? g.entrepreneur : !g.trader && !g.entrepreneur)).map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
                </select>
                <ChevronDown size={14} color={COLOR.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}
        </div>

        {role !== 'entrepreneur' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', marginBottom: 12, borderRadius: 10,
            border: `1px solid ${tour ? COLOR.gold : COLOR.border}`, background: tour ? COLOR.goldDim : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={tour} onChange={(e) => { Audio.play('tick'); setTour(e.target.checked); }}
              style={{ marginTop: 3, accentColor: COLOR.gold }} />
            <span>
              <span style={{ fontSize: 13, color: COLOR.text, fontWeight: 600 }}>Обучение по экрану партии</span>
              <span style={{ display: 'block', fontSize: 12, color: COLOR.muted, marginTop: 2, lineHeight: 1.45 }}>
                Для первой партии: по шагам покажем, где рычаги, показатели, график, оценки и кнопка квартала. Всё доступно сразу — обучение ничего не прячет. Повторить можно из меню «⋯».
              </span>
            </span>
          </label>
        )}
        <button disabled={!role} className="ems-btn primary" style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
          onClick={() => {
            if (!role) return;
            Audio.prime(); Audio.play('stamp'); Audio.startMusic();
            const pick = (list) => list[Math.floor(Math.random() * list.length)].id;
            const cbWanted = custom ? cbPersona : 'random';
            const mofWanted = custom ? mofPersona : 'random';
            const presWanted = custom ? presPersona : 'random';
            // классика всегда начинается с открытой партии, даже если в
            // настраиваемом режиме до этого успели выбрать кризисный сценарий
            onStart({ role, difficulty, goal, scenario: custom ? scenario : 'sandbox', tour,
              ...(role === 'entrepreneur' ? { sector } : {}),
              cbPersona: cbWanted === 'random' ? pick(CB_PERSONAS) : cbWanted,
              mofPersona: mofWanted === 'random' ? pick(MOF_PERSONAS) : mofWanted,
              president: { enabled: presAvailable && (custom ? presEnabled : true),
                persona: presWanted === 'random' ? pick(PRESIDENT_PERSONAS) : presWanted } });
          }}>
          Принять полномочия
        </button>
      </div>
    </div>
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
  const [theme, setThemeState] = useState('ink');
  const [network, setNetwork] = useState(null);
  // 'menu' — главная страница; 'setup' — анкета новой одиночной партии;
  // 'network' — лобби подключения на двоих. Ссылка-приглашение (?room=)
  // ведёт сразу в лобби, минуя меню.
  const [view, setView] = useState(() => (roomCodeFromUrl() ? 'network' : 'menu'));
  // «Своё дело»: { initial } — продолжить сохранённое, { setupNew } — новое дело
  const [tycoon, setTycoon] = useState(() => (resumeTycoon ? { initial: resumeTycoon } : null));
  React.useEffect(() => {
    try { if (tycoon) localStorage.setItem(LAST_SCREEN_KEY, 'tycoon'); else localStorage.removeItem(LAST_SCREEN_KEY); } catch { /* приватный режим */ }
  }, [tycoon]);
  applyTheme(theme);
  const setTheme = (id) => { applyTheme(id); setThemeState(id); };
  const startLoaded = (data) => { setLoaded(data); setSetup(data.setup); setNonce((n) => n + 1); };
  const goMenu = () => setView('menu');
  // переключение между меню/анкетой/сетью/игрой не перезагружает страницу,
  // поэтому без явного сброса скролл оставался там, где был на предыдущем
  // экране — короткий новый экран открывался уже наполовину прокрученным
  const screenKey = network ? 'network-game' : tycoon ? 'tycoon' : setup ? 'game' : view;
  React.useEffect(() => { window.scrollTo(0, 0); }, [screenKey]);

  const backToMenu = () => { setNetwork(null); setLoaded(null); setSetup(null); goMenu(); };
  const startTycoon = (x) => {
    if (loadTycoonSave() && !window.confirm('Начать новое дело? Сохранённая компания будет потеряна (репутация останется).')) return;
    setTycoon({ setupNew: { start: x.sector || 'farm', scenario: x.scenario, difficulty: x.difficulty, cbPersona: x.cbPersona,
      mofPersona: x.mofPersona, presPersona: x.president && x.president.persona, president: !!(x.president && x.president.enabled) } });
  };
  const screen = (() => {
    if (tycoon) {
      return (
        <Suspense fallback={<GameFallback />}>
          <TycoonScreen key={tycoon.initial ? 'load' : JSON.stringify(tycoon.setupNew)} initial={tycoon.initial} setupNew={tycoon.setupNew}
            onExit={() => { setTycoon(null); goMenu(); }} />
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
          <SetupScreen key={`${theme}${view}`} initialRole={view === 'setup-biz' ? 'entrepreneur' : null}
            onStart={(x) => { if (x.role === 'entrepreneur') { startTycoon(x); return; } clearAutosave(); setLoaded(null); setSetup(x); }}
            onBack={goMenu}
          />
        );
      }
      if (view === 'network') {
        return (
          <Suspense fallback={<NetworkFallback />}>
            <NetworkEntryScreen key={theme} onEnter={(net) => setNetwork(net)} onBack={goMenu} />
          </Suspense>
        );
      }
      if (view === 'tutorial') {
        return (
          <Suspense fallback={(
            <div style={{ minHeight: '100vh', background: COLOR.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.muted, fontSize: 13 }}>
              Загрузка обучения…
            </div>
          )}>
            <TutorialHub key={theme}
              onBack={goMenu}
              onStartRealGame={() => setView('setup')}
            />
          </Suspense>
        );
      }
      return (
        <MainMenu key={theme} theme={theme} setTheme={setTheme}
          onNewGame={() => setView('setup')}
          onNetwork={() => setView('network')}
          onTutorial={() => setView('tutorial')}
          onLoad={startLoaded}
          onEnterNetwork={setNetwork}
          onDaily={(ch) => { clearAutosave(); setLoaded(null); setSetup(dailySetup(ch)); }}
          onTycoon={(save) => (save ? setTycoon({ initial: save }) : setView('setup-biz'))}
        />
      );
    }
    return (
      <Suspense fallback={<GameFallback />}>
        <GameScreen key={`${JSON.stringify(setup)}:${nonce}`} setup={setup} initial={loaded}
          theme={theme} setTheme={setTheme}
          onRestart={() => { clearAutosave(); setLoaded(null); setSetup(null); goMenu(); }} onLoadState={startLoaded} />
      </Suspense>
    );
  })();
  return <ScreenErrorBoundary resetKey={screenKey} onMenu={backToMenu}>{screen}</ScreenErrorBoundary>;
}
