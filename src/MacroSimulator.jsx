import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { createLinkCode, checkLinkCode, cancelLinkCode, claimLinkCode, revokeLink, syncProgress,
  createRoom, joinRoom, submitDecisions, cancelSubmission, watchRoom, leaveRoom, fetchRoom, setRoomDifficulty, sendChatMessage, kickFromRoom,
  reportPortfolioValue, fetchSoloSlots, fetchSoloSlot, saveSoloSlot, renameSoloSlot, deleteSoloSlot } from './lib/client.js';
import {
  Landmark, Coins, Globe2, TrendingUp, Users, Activity, Newspaper, Factory, Scale, Banknote,
  ShieldAlert, ChevronDown, ChevronUp, Info, RotateCcw, ArrowUpRight, ArrowDownRight,
  X, Check, AlertTriangle, Bot, Gauge as GaugeIcon, Target, Zap, Volume2, VolumeX, Music, Save, Copy, Star, Flag, Megaphone, Sliders, Dices, Clock,
  Trophy, Lock, Share2, Download, GraduationCap, Crown, Gavel, Hammer, Smartphone,
} from 'lucide-react';
import {
  CONFIG, ROLES, DIFFICULTIES, GOALS, FX_REGIMES, LEVERS,
  CB_PERSONAS, MOF_PERSONAS, REQUESTS, REGIME_INFO, CRISIS_INFO, MANDATE_LABEL, regimeInfoText, regimeInfoLabel,
  POLITICAL_REGIME_INFO,
  clamp, fmt1, fmt2, fmtSigned1, pctFmt, fmtSignedPct, fmtMoney, fmtMoneySigned, mlnScale, fmtMln, fmtMlnSigned, romanQ, quarterLabel,
  defaultDecisions, getCbPersona, personaAfterElection, getMofPersona,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction, redescribeMofAction,
  simulateQuarter, makeInitialEconomy, leverPreview, pickPromises, evaluatePromise,
  PRESIDENT_ACTIONS, PRES_BY_ID, PRES_GROUP_LABEL, reformShare, REFORM_RAMP,
  processPresidentialDirective, PRES_DIRECTIVE_COST, APPOINT_COST, CB_FULL_TERM, makeImpulse, askText,
  PRESIDENT_PERSONAS, botPresident, directiveProgress, directiveVerdict, militaryCoupRisk,
} from './lib/engine.js';

const THEMES = {
  ink: { id: 'ink', name: 'Ночная канцелярия', dark: true, colors: {
    bg: '#0B0F17', bgVignette: '#0E1420', panel: '#161D2B', panelAlt: '#1B2333', panelRaised: '#202B41',
    border: '#28324A', borderStrong: '#3D4C6B', hairline: '#1F2A3D',
    text: '#E8E6DD', muted: '#8B94A8', faint: '#5B6478',
    paper: '#EDE7D6', paperText: '#22261D', paperMuted: '#6B6754', paperRule: '#C9BFA0',
    gold: '#C9A227', goldSoft: '#E8C766', goldDim: 'rgba(201,162,39,0.14)', ink: '#1B1204',
    teal: '#4E9A82', tealDim: 'rgba(78,154,130,0.14)',
    rust: '#B0503A', rustDim: 'rgba(176,80,58,0.14)',
    blue: '#5B7FA6', blueDim: 'rgba(91,127,166,0.14)' } },
  slate: { id: 'slate', name: 'Холодный кабинет', dark: true, colors: {
    bg: '#0A1014', bgVignette: '#0C151B', panel: '#13202A', panelAlt: '#182833', panelRaised: '#1E3240',
    border: '#24404F', borderStrong: '#365C70', hairline: '#1B2E3A',
    text: '#DFE8EC', muted: '#87A0AC', faint: '#5A717C',
    paper: '#E6E9E4', paperText: '#1C2428', paperMuted: '#63706F', paperRule: '#B7C2BF',
    gold: '#8FB8C9', goldSoft: '#BBDCEA', goldDim: 'rgba(143,184,201,0.14)', ink: '#08161C',
    teal: '#57A98E', tealDim: 'rgba(87,169,142,0.14)',
    rust: '#C06152', rustDim: 'rgba(192,97,82,0.14)',
    blue: '#6E93C4', blueDim: 'rgba(110,147,196,0.14)' } },
  chamber: { id: 'chamber', name: 'Дневная канцелярия', dark: false, colors: {
    bg: '#EFEADF', bgVignette: '#E7E1D2', panel: '#F7F3E9', panelAlt: '#EDE7D8', panelRaised: '#FFFCF4',
    border: '#D3C9B2', borderStrong: '#B5A888', hairline: '#E0D8C6',
    text: '#221F19', muted: '#5F5A4C', faint: '#8A8372',
    paper: '#FBF7EC', paperText: '#221F19', paperMuted: '#6B6653', paperRule: '#CDC2A6',
    gold: '#8A6D12', goldSoft: '#6F5710', goldDim: 'rgba(138,109,18,0.12)', ink: '#FBF7EC',
    teal: '#2F6B57', tealDim: 'rgba(47,107,87,0.12)',
    rust: '#94331F', rustDim: 'rgba(148,51,31,0.12)',
    blue: '#2F5578', blueDim: 'rgba(47,85,120,0.12)' } },
  contrast: { id: 'contrast', name: 'Высокий контраст', dark: true, colors: {
    bg: '#000000', bgVignette: '#000000', panel: '#0A0A0A', panelAlt: '#141414', panelRaised: '#1C1C1C',
    border: '#6A6A6A', borderStrong: '#A8A8A8', hairline: '#4A4A4A',
    text: '#FFFFFF', muted: '#D6D6D6', faint: '#A8A8A8',
    paper: '#FFFFFF', paperText: '#000000', paperMuted: '#333333', paperRule: '#888888',
    gold: '#FFD23F', goldSoft: '#FFE485', goldDim: 'rgba(255,210,63,0.22)', ink: '#000000',
    teal: '#4DE0A8', tealDim: 'rgba(77,224,168,0.20)',
    rust: '#FF6B52', rustDim: 'rgba(255,107,82,0.20)',
    blue: '#7FC2FF', blueDim: 'rgba(127,194,255,0.20)' } },
};
export const COLOR = { ...THEMES.ink.colors };
function applyTheme(id) {
  const t = THEMES[id] || THEMES.ink;
  Object.assign(COLOR, t.colors);
}
const FONT = {
  serif: "'Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif",
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
};

const GlobalStyle = () => (
  <style>{`
    .ems-root { background:${COLOR.bg} radial-gradient(ellipse 1100px 620px at 50% -8%, ${COLOR.bgVignette} 0%, ${COLOR.bg} 70%); color:${COLOR.text}; font-family:${FONT.sans}; min-height:100vh; }
    .ems-root * { box-sizing: border-box; }
    .ems-root :focus-visible { outline: 2px solid ${COLOR.goldSoft}; outline-offset: 2px; }
    .ems-serif { font-family:${FONT.serif}; }
    .ems-mono { font-family:${FONT.mono}; font-variant-numeric: tabular-nums; }
    .ems-panel { background:${COLOR.panel}; border:1px solid ${COLOR.border}; border-radius:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.10), 0 6px 16px -10px rgba(0,0,0,0.4); }
    .ems-panel-raised { background:${COLOR.panelRaised}; border:1px solid ${COLOR.borderStrong}; border-radius:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.14), 0 14px 30px -12px rgba(0,0,0,0.55); }
    .ems-hr { height:1px; background:${COLOR.hairline}; border:none; margin:0; }
    .ems-btn { font-family:${FONT.sans}; cursor:pointer; border:1px solid ${COLOR.border}; background:${COLOR.panelAlt}; color:${COLOR.text}; padding:8px 14px; border-radius:7px; font-size:13px; transition:background .15s, border-color .15s, transform .1s, box-shadow .15s; }
    .ems-btn:hover { background:${COLOR.panelRaised}; border-color:${COLOR.borderStrong}; box-shadow: 0 3px 10px -4px rgba(0,0,0,0.35); }
    .ems-btn:active { transform: scale(0.98); }
    .ems-btn.primary { background:${COLOR.gold}; color:${COLOR.ink}; border-color:${COLOR.gold}; font-weight:600; box-shadow: 0 2px 12px -3px ${COLOR.goldDim}; }
    .ems-btn.primary:hover { background:${COLOR.goldSoft}; border-color:${COLOR.goldSoft}; box-shadow: 0 4px 18px -3px ${COLOR.goldDim}; }
    .ems-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; box-shadow:none; }
    .ems-slider { -webkit-appearance:none; width:100%; height:4px; background:${COLOR.border}; outline:none; border-radius:2px; }
    .ems-slider::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-slider::-moz-range-thumb { width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-scroll::-webkit-scrollbar { width:6px; height:6px; }
    .ems-scroll::-webkit-scrollbar-thumb { background:${COLOR.border}; border-radius:3px; }
    .ems-tab { padding:7px 12px; font-size:12.5px; cursor:pointer; border-radius:7px; color:${COLOR.muted}; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:5px; transition:background .15s, color .15s, box-shadow .15s; }
    .ems-tab:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    .ems-tab.active { color:${COLOR.ink}; background:${COLOR.gold}; font-weight:600; box-shadow: 0 2px 10px -3px ${COLOR.goldDim}; }
    .ems-tab.active:hover { background:${COLOR.goldSoft}; color:${COLOR.ink}; }
    .ems-fade-in { animation: emsFade .35s ease; }
    @keyframes emsFade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
    .ems-toast-out { animation: emsToastOut .45s ease forwards; }
    @keyframes emsToastOut { from { opacity:1; transform:translateY(0) scale(1);} to { opacity:0; transform:translateY(10px) scale(0.96);} }
    .ems-confetti-piece { border-radius:1px; opacity:1; animation: emsConfettiBurst .85s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes emsConfettiBurst { 0% { transform:translate(-50%,-50%) rotate(0deg); opacity:1; }
      100% { transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); opacity:0; } }
    @media (prefers-reduced-motion: reduce) { .ems-fade-in, .ems-toast-out { animation:none; } .ems-confetti-piece { animation:none; display:none; } .ems-btn, .ems-tab { transition:none; } }

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
    .ems-hero-eyebrow { font-family: ${FONT.mono}; font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: ${COLOR.gold}; }
    .ems-hero-title { font-family: ${FONT.serif}; font-size: 40px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.14; margin: 12px 0 0;
      color: ${COLOR.text}; background: linear-gradient(180deg, ${COLOR.text} 0%, ${COLOR.muted} 145%);
      background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .ems-hero-title.small { font-size: 27px; }
    @media (max-width: 480px) { .ems-hero-title { font-size: 30px; } .ems-hero-title.small { font-size: 22px; } }
    .ems-hero-rule { width: 88px; height: 3px; margin: 18px auto 0; border-radius: 2px;
      background: linear-gradient(90deg, transparent, ${COLOR.gold}, transparent); }
    .ems-hero-badge { display: inline-flex; align-items: center; gap: 7px; font-family: ${FONT.mono}; font-size: 11px; color: ${COLOR.muted};
      padding: 6px 13px; border: 1px solid ${COLOR.border}; border-radius: 999px; background: ${COLOR.panelAlt}; margin-top: 18px; }
    .ems-hero-lede { color: ${COLOR.muted}; font-size: 14px; margin: 16px auto 0; max-width: 560px; line-height: 1.65; }
    .ems-card-btn { position: relative; display: flex; align-items: center; gap: 15px; cursor: pointer;
      border-radius: 13px; border: 1px solid ${COLOR.border}; background: ${COLOR.panel};
      box-shadow: 0 1px 2px rgba(0,0,0,0.14), 0 12px 28px -16px rgba(0,0,0,0.55);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background-color .18s ease; }
    .ems-card-btn:hover, .ems-card-btn:focus-visible { transform: translateY(-2px); border-color: ${COLOR.gold};
      background: ${COLOR.panelRaised}; box-shadow: 0 1px 2px rgba(0,0,0,0.18), 0 18px 36px -16px rgba(0,0,0,0.65); }
    .ems-card-btn:active { transform: translateY(0); }
    .ems-card-icon { width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, ${COLOR.goldDim}, transparent); border: 1px solid ${COLOR.goldDim};
      transition: transform .18s ease, border-color .18s ease; }
    .ems-card-btn:hover .ems-card-icon { transform: scale(1.07) rotate(-2deg); border-color: ${COLOR.gold}; }
    .ems-card-chevron { transition: transform .18s ease; }
    .ems-card-btn:hover .ems-card-chevron { transform: translateX(3px) rotate(-90deg); }
    .ems-row-hover { border-radius: 9px !important; transition: background-color .15s ease, border-color .15s ease; }
    .ems-row-hover:hover { background: ${COLOR.panelRaised} !important; border-color: ${COLOR.borderStrong} !important; }
    .ems-theme-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 9px; border-radius: 999px; font-size: 10.5px;
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
    @media (max-width: 700px) { .ems-kpi-strip { grid-template-columns: repeat(2,1fr); } }
    /* Практика в курсе: на широком экране условие задачи слева, рабочие панели
       (рычаги, панель президента, лента новостей) справа — вместо одной длинной
       колонки посреди пустого экрана. На узком остаётся один столбец. */
    .ems-tut-cols { display:grid; grid-template-columns: 1fr; gap:0 20px; }
    @media (min-width: 1000px) { .ems-tut-cols { grid-template-columns: minmax(0,1fr) minmax(320px,0.95fr); } }
  `}</style>
);

/* =========================================================================================
   8. МЕЛКИЕ КОМПОНЕНТЫ
========================================================================================= */
function DeltaTag({ value, invert, suffix = '' }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return <span style={{ color: COLOR.muted, fontSize: 11 }}>—</span>;
  const good = invert ? value < 0 : value > 0;
  const color = good ? COLOR.teal : COLOR.rust;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span style={{ color, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icon size={11} />{fmtSigned1(value)}{suffix}
    </span>
  );
}

function Gauge({ value, size = 110 }) {
  const v = clamp(value, 0, 100);
  const angle = -90 + (v / 100) * 180;
  const color = v >= 65 ? COLOR.teal : v >= 40 ? COLOR.gold : COLOR.rust;
  const r = size / 2 - 8;
  const cx = size / 2; const cy = size / 2;
  const rad = (Math.PI / 180) * angle;
  const x2 = cx + r * Math.sin(rad); const y2 = cy - r * Math.cos(rad);
  const arc = (from, to) => {
    const rf = (Math.PI / 180) * from; const rt = (Math.PI / 180) * to;
    const x1 = cx + r * Math.sin(rf); const y1 = cy - r * Math.cos(rf);
    const x2b = cx + r * Math.sin(rt); const y2b = cy - r * Math.cos(rt);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2b} ${y2b}`;
  };
  const ticks = [0, 25, 50, 75, 100].map((t) => {
    const a = -90 + (t / 100) * 180;
    const ra = (Math.PI / 180) * a;
    const r1 = r + 5; const r2 = r + (t % 50 === 0 ? 9 : 7);
    return { x1: cx + r1 * Math.sin(ra), y1: cy - r1 * Math.cos(ra), x2: cx + r2 * Math.sin(ra), y2: cy - r2 * Math.cos(ra) };
  });
  return (
    <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6 + 4}`}>
      {ticks.map((t, i) => (<line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={COLOR.faint} strokeWidth={1} />))}
      <path d={arc(-90, 90)} stroke={COLOR.border} strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d={arc(-90, angle)} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill={color} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={20} fontWeight={700} fill={COLOR.text} fontFamily={FONT.serif}>{Math.round(v)}</text>
    </svg>
  );
}

// мини-график последних значений прямо в плитке: число говорит «сколько сейчас»,
// а один взгляд на форму линии — «а раньше как было», без похода к графику ниже
function Sparkline({ series, color, height = 16 }) {
  if (!series || series.length < 2) return null;
  const w = 100; // виртуальные единицы viewBox — реальную ширину задаёт CSS (width:100%),
  // поэтому плитке неважно, узкая она или широкая: переполнения по горизонтали не будет
  const min = Math.min(...series); const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = height - ((v - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiTile({ label, value, delta, invert, icon: Icon, series }) {
  const good = Number.isFinite(delta) && Math.abs(delta) >= 0.05 ? (invert ? delta < 0 : delta > 0) : null;
  const barColor = good === null ? COLOR.border : good ? COLOR.teal : COLOR.rust;
  return (
    <div className="ems-panel" style={{ padding: '10px 12px 10px 14px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: barColor }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLOR.muted, fontSize: 11, marginBottom: 7 }}>
        {Icon && <Icon size={12} />}<span>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span className="ems-mono ems-serif" style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
        <DeltaTag value={delta} invert={invert} />
      </div>
      {/* спарклайн — под цифрой, во всю ширину плитки: так его не приходится
          втискивать в один ряд с числом на узких мобильных плитках (2 в ряд) */}
      {series && series.length >= 2 && (
        <div style={{ marginTop: 6 }}><Sparkline series={series} color={barColor === COLOR.border ? COLOR.faint : barColor} /></div>
      )}
    </div>
  );
}

function LeverSlider({ lever, currentDisplay, value, onChange, preview, onIRF }) {
  const delta = lever.type === 'level' ? value - currentDisplay : value;
  const [open, setOpen] = useState(false);
  const pct = clamp(((value - lever.min) / (lever.max - lever.min)) * 100, 0, 100);
  const trackStyle = { background: `linear-gradient(90deg, ${COLOR.gold} 0%, ${COLOR.gold} ${pct}%, ${COLOR.border} ${pct}%, ${COLOR.border} 100%)` };
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5 }}>{lever.label}</span>
        {lever.type === 'level' && (
          <span className="ems-mono" style={{ fontSize: 12, color: COLOR.muted }}>{currentDisplay.toFixed(2)}{lever.suffix}</span>
        )}
        {lever.type === 'flow' && !lever.persistent && (
          <span className="ems-mono" style={{ fontSize: 12, color: COLOR.muted }}>тек. 0{lever.suffix}</span>
        )}
      </div>
      {lever.hint && <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 1 }}>{lever.hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
        <input type="range" className="ems-slider" style={trackStyle} min={lever.min} max={lever.max} step={lever.step}
          aria-label={`${lever.label}, текущее значение ${value}${lever.suffix}`}
          value={value} onChange={(e) => { Audio.play('tick'); onChange(parseFloat(e.target.value)); }} />
        <span className="ems-mono" style={{ fontSize: 12.5, width: 62, textAlign: 'right', color: COLOR.goldSoft, fontWeight: 600 }}>
          {lever.type === 'level' ? `${value.toFixed(2)}${lever.suffix}` : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${lever.suffix}`}
        </span>
      </div>
      {Math.abs(delta) > 0.001 && (
        <div className="ems-fade-in" style={{ marginTop: 8, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 9px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 6 }}>
            {preview.items.map((it, i) => (
              <span key={i} style={{ fontSize: 11 }}><span style={{ color: COLOR.muted }}>{it.label}:</span> <span className="ems-mono">{it.text}</span></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button className="ems-btn" style={{ padding: '3px 8px', fontSize: 10.5 }} onClick={() => setOpen((o) => !o)}>
              {open ? 'Скрыть детали' : 'Плюсы и минусы'} {open ? <ChevronUp size={11} style={{ verticalAlign: -1 }} /> : <ChevronDown size={11} style={{ verticalAlign: -1 }} />}
            </button>
            {onIRF && (
              <button className="ems-btn" style={{ padding: '3px 8px', fontSize: 10.5, borderColor: COLOR.blue, color: COLOR.blue }}
                onClick={() => { Audio.play('click'); onIRF(lever, value, lever.type === 'level' ? currentDisplay : 0); }}>
                <Activity size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Реакция экономики
              </button>
            )}
          </div>
          {open && (
            <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.55 }}>
              <div style={{ color: COLOR.teal }}>+ {preview.pros.join('; ')}</div>
              <div style={{ color: COLOR.rust, marginTop: 2 }}>− {preview.cons.join('; ')}</div>
              <div style={{ color: COLOR.muted, marginTop: 4 }}>Неопределённость: {preview.uncertainty}{preview.delayNote ? ` · ${preview.delayNote}` : ''}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


const ROLE_ICON = { landmark: Landmark, coins: Coins, globe: Globe2, chart: TrendingUp, crown: Crown };

/* ============================ ГРАФИКИ ============================ */
/* ChartPanel/MemoChart/IRFModal живут в отдельном чанке (src/charts.jsx) вместе
   с recharts (~104 KB gzip) — эта библиотека нужна только внутри уже запущенной
   партии, а не в меню/анкете/обучении, поэтому не должна грузиться заранее.
   React.lazy() подгружает файл по требованию; ChartFallback — что видно, пока
   он грузится (обычно доли секунды, но экран не должен оставаться пустым). */
const ChartFallback = ({ height = 250 }) => (
  <div className="ems-panel" style={{ padding: 14, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.faint, fontSize: 12 }}>
    Загрузка графика…
  </div>
);
const ChartPanel = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.ChartPanel })));
const MemoChart = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.MemoChart })));
const IRFModal = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.IRFModal })));
const InstrumentChart = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.InstrumentChart })));

function WhyModal({ reasons, onClose }) {
  const [tab, setTab] = useState('gdpGrowth');
  const TABS = [
    { id: 'gdpGrowth', label: 'ВВП' }, { id: 'outputGap', label: 'Разрыв выпуска' }, { id: 'inflation', label: 'Инфляция' },
    { id: 'unemployment', label: 'Безработица' }, { id: 'exchangeRate', label: 'Курс валюты' },
    { id: 'budget', label: 'Бюджет' }, { id: 'banking', label: 'Банки' }, { id: 'potential', label: 'Потенциал' },
  ];
  const list = reasons[tab] || [];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.7)', backdropFilter: 'blur(2px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 480, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, display: 'flex', alignItems: 'center', gap: 8 }}><Info size={16} />Почему это произошло?</span>
          <button className="ems-btn" style={{ padding: '4px 7px' }} onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: `1px solid ${COLOR.hairline}`, marginBottom: 12, paddingBottom: 10 }}>
          {TABS.map((t) => (<span key={t.id} className={`ems-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</span>))}
        </div>
        {list.length === 0 && <div style={{ color: COLOR.muted, fontSize: 12.5 }}>В этом квартале не было значимых отдельных факторов — динамика определялась общей инерцией экономики.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 320, overflowY: 'auto' }} className="ems-scroll">
          {list.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.4 }}>
              <span style={{ color: r.amount >= 0 ? COLOR.teal : COLOR.rust, marginTop: 1, flexShrink: 0 }}>{r.amount >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>
              <span>{r.reasonText}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================================
   ЗВУК: интерфейсные эффекты и генеративная музыка, реагирующая на состояние экономики.
   Всё синтезируется через Web Audio прямо в браузере — внешних файлов нет.
========================================================================================= */
/* =========================================================================================
   ЗВУК И МУЗЫКА: интерфейсные эффекты и шесть написанных тем, переключающихся
   по режиму экономики. Всё синтезируется через Web Audio — внешних файлов нет.
========================================================================================= */
/* =========================================================================================
   ЗВУК И МУЗЫКА: синтвейв-саундтрек — двадцать две написанные пьесы с многочастной формой
   на аналоговых синт-тембрах (лид, бас, пады, драм-машина) и переключением по режиму
   экономики. Всё синтезируется через Web Audio, внешних файлов нет.
========================================================================================= */
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const nn = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 60;
  return NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const H = (str) => str.split('|').map((bar) => bar.trim().split(/\s+/).map(nn));
const MEL = (str) => str.trim().split(/\s+/).filter(Boolean).map((tok) => {
  const [st, note, dur] = tok.split(':');
  return [parseInt(st, 10), nn(note), parseInt(dur, 10)];
});
const drum = (s) => { const out = []; for (let i = 0; i < s.length; i++) if (s[i] !== '.') out.push([i, s[i]]); return out; };
/* DR(бочка, малый, тарелки, опции). В строке тарелок: 'o' — закрытый хэт,
   'O' — открытый, 'r' — райд. Опции: ghost — призрачные удары малого между
   долями, fill:false — не играть сбивку в последнем такте секции. */
const DR = (k, sn, h, opts) => ({ kick: drum(k), snare: drum(sn), hat: drum(h), ...opts });

/* Фигуры левой руки: [шаг в такте, индекс тона аккорда] */
const LH = {
  flow: [[0, 0], [2, 1], [4, 2], [6, 3], [8, 2], [10, 1], [12, 2], [14, 3]],
  wide: [[0, 0], [3, 1], [6, 2], [8, 3], [11, 2], [14, 1]],
  waltz: [[0, 0], [4, 1], [6, 2], [8, 1], [12, 2], [14, 3]],
  sustain: [[0, 0], [0, 1], [0, 2], [0, 3]],
  pulse: [[0, 0], [2, 1], [4, 0], [6, 1], [8, 0], [10, 1], [12, 0], [14, 1]],
  drive: [[0, 0], [2, 0], [3, 1], [5, 0], [6, 1], [8, 0], [10, 0], [11, 1], [13, 0], [14, 1]],
  roll: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [8, 0], [9, 1], [10, 2], [11, 3], [12, 2], [13, 1]],
  air: [[0, 0], [6, 2], [10, 1]],
};
const sec = (h, mel, lh, arr, dyn, drums) => ({ h, mel, lh, arr, dyn: dyn || 1, drums: drums || null });

const TRACKS = {};
const tr = (id, name, subtitle, mood, cfg) => { TRACKS[id] = { id, name, subtitle, mood, ...cfg }; };

/* ------------------------------- СПОКОЙСТВИЕ ------------------------------- */
tr('dawn', 'Рассвет над министерством', 'фортепиано, струнные, аналоговый пад', 'calm', {
  bpm: 72, swing: 0.12, reverb: 0.42,
  bassLine: 'half',
  A: H('F2 C3 E3 A3 | A2 E3 G3 C4 | Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4'),
  B: H('D3 A3 C4 F4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | G2 D3 F3 Bb3'),
  melA: MEL('0:C5:4 4:F5:4 8:A5:8 16:G5:4 20:E5:4 24:C5:8 32:D5:4 36:F5:4 40:A5:8 48:G5:8 56:E5:8 64:F5:4 68:A5:4 72:C6:8 80:Bb5:4 84:A5:4 88:F5:8 96:D5:4 100:Bb4:4 104:D5:8 112:E5:4 116:G5:4 120:F5:12'),
  melB: MEL('0:A5:4 4:F5:4 8:E5:8 16:C#5:4 20:E5:4 24:A5:8 32:F5:4 36:D5:4 40:C5:8 48:Bb4:4 52:D5:4 56:F5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('A', 'melA', 'flow', 'piano bass pad', 0.85),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 1.0),
    sec('A', 'melA', 'waltz', 'piano bass pad strings violin', 1.0),
  ],
});
tr('ledger', 'Тихая бухгалтерия', 'фортепиано соло', 'calm', {
  bpm: 68, swing: 0.14, reverb: 0.46,
  bassLine: 'half', feel: 'loose',
  A: H('D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 A3 D4 | F2 C3 E3 A3 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:4 4:D5:4 8:F5:8 16:E5:4 20:D5:4 24:C5:8 32:A4:4 36:C5:4 40:A4:4 44:F4:4 48:G4:8 56:E4:8 64:A4:4 68:D5:4 72:F5:8 80:G5:4 84:F5:4 88:E5:8 96:D5:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:12'),
  melB: MEL('0:F5:4 4:D5:4 8:A4:8 16:C5:4 20:E5:4 24:F5:8 32:D5:4 36:Bb4:4 40:G4:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.7),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad cello', 1.0),
  ],
});
tr('northlight', 'Северный свет', 'ретро-колокол, фортепиано, аналоговый пад', 'calm', {
  bpm: 64, swing: 0, reverb: 0.62,
  bassLine: 'half',
  A: H('Ab2 Eb3 G3 C4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 Eb4 | Ab2 Eb3 G3 C4 | F2 C3 Ab3 Eb4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4'),
  B: H('F2 C3 Ab3 C4 | Db3 Ab3 C4 F4 | Bb2 F3 Ab3 D4 | Eb3 Bb3 D4 G4'),
  melA: MEL('0:Eb5:8 8:G5:8 16:F5:8 24:Ab5:8 32:G5:8 40:Bb5:8 48:Eb5:14 64:C5:8 72:Eb5:8 80:Ab5:8 88:G5:8 96:F5:8 104:Db5:8 112:Eb5:14'),
  melB: MEL('0:Ab5:8 8:C6:8 16:Bb5:12 32:F5:8 40:Ab5:8 48:G5:14'),
  sections: [
    sec('A', 'melA', 'air', 'bells pad bass', 0.68),
    sec('B', 'melB', 'sustain', 'bells pad strings bass', 0.9),
    sec('A', 'melA', 'flow', 'piano bells pad strings bass', 1.0),
  ],
});
tr('promenade', 'Прогулка по столице', 'фортепиано и арпеджио', 'calm', {
  bpm: 84, swing: 0.16, reverb: 0.34,
  bassLine: 'root',
  A: H('G2 D3 G3 B3 | E2 B2 E3 G3 | C3 G3 B3 E4 | D3 A3 C4 F#4 | G2 D3 G3 B3 | E2 B2 E3 G3 | A2 E3 G3 C#4 | D3 A3 C4 F#4'),
  B: H('C3 G3 B3 E4 | B2 F#3 A3 D4 | E2 B2 E3 G3 | D3 A3 C4 F#4'),
  melA: MEL('0:D5:4 4:G5:4 8:B5:4 12:A5:4 16:G5:8 24:E5:8 32:G5:4 36:B5:4 40:D6:8 48:C6:4 52:A5:4 56:F#5:8 64:D5:4 68:G5:4 72:B5:4 76:A5:4 80:G5:8 88:E5:8 96:C#5:4 100:E5:4 104:A5:8 112:F#5:4 116:A5:4 120:G5:8'),
  melB: MEL('0:E5:4 4:G5:4 8:B5:8 16:D5:4 20:F#5:4 24:A5:8 32:G5:4 36:E5:4 40:B4:8 48:A5:4 52:F#5:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.72),
    sec('A', 'melA', 'roll', 'piano harp bass pad', 0.92),
    sec('B', 'melB', 'flow', 'piano harp bass pad strings', 1.0),
  ],
});
// Единственная полностью акустическая пьеса саундтрека: ни синт-пэдов, ни дисторшна —
// только нейлоновая гитара и синт-бас (cello), другой жанр, а не ещё один синтвейв-трек.
tr('meadow', 'Загородная тишина', 'нейлоновая гитара и бас — акустическая пьеса саундтрека', 'calm', {
  bpm: 88, swing: 0.1, reverb: 0.3,
  bassLine: 'root', feel: 'loose',
  A: H('G3 D4 G4 B4 | D3 A3 D4 F#4 | E3 B3 E4 G4 | C3 G3 C4 E4 | G3 D4 G4 B4 | D3 A3 D4 F#4 | C3 G3 C4 E4 | D3 A3 D4 F#4'),
  B: H('E3 B3 E4 G4 | C3 G3 C4 E4 | G3 D4 G4 B4 | D3 A3 D4 F#4'),
  melA: MEL('0:B4:4 4:D5:4 8:G5:4 12:D5:4 16:E5:8 24:D5:4 28:B4:4 32:C5:4 36:E5:4 40:G5:4 44:E5:4 48:D5:8 56:B4:4 60:A4:4 64:B4:4 68:D5:4 72:G5:4 76:D5:4 80:E5:8 88:D5:4 92:B4:4 96:C5:4 100:E5:4 104:G5:4 108:E5:4 112:F#5:8 120:D5:8'),
  melB: MEL('0:E5:4 4:G5:4 8:B5:8 16:D5:4 20:C5:4 24:E5:8 32:B4:4 36:D5:4 40:G5:8 48:F#5:4 52:D5:4 56:B4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'nylon cello', 0.68),
    sec('A', 'melA', 'roll', 'nylon cello', 0.88),
    sec('B', 'melB', 'flow', 'nylon cello', 1.0),
  ],
});

/* --------------------------------- ПОДЪЁМ --------------------------------- */
tr('ascent', 'Восхождение', 'фортепиано, бас, драм-машина', 'boom', {
  bpm: 108, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('A2 E3 A3 C#4 | G#2 E3 G#3 B3 | F#2 C#3 F#3 A3 | D3 A3 D4 F#4 | A2 E3 A3 C#4 | E3 B3 E4 G#4 | D3 A3 D4 F#4 | E3 B3 D4 G#4'),
  B: H('D3 A3 D4 F#4 | C#3 G#3 C#4 E4 | B2 F#3 B3 D4 | E3 B3 D4 G#4'),
  melA: MEL('0:E5:4 4:F#5:2 6:E5:2 8:C#5:8 16:B4:4 20:C#5:4 24:E5:8 32:F#5:4 36:E5:2 38:C#5:2 40:A4:8 48:D5:4 52:F#5:4 56:A5:8 64:E5:4 68:F#5:2 70:E5:2 72:C#5:8 80:B4:4 84:E5:4 88:G#5:8 96:A5:4 100:F#5:4 104:D5:8 112:E5:4 116:D5:4 120:C#5:8'),
  melB: MEL('0:F#5:4 4:A5:4 8:D6:8 16:E5:4 20:G#5:4 24:C#6:8 32:D5:4 36:F#5:4 40:B5:8 48:G#5:4 52:E5:4 56:B4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.75, DR('x.......x.......', '................', '..o...o...o...o.')),
    sec('A', 'melA', 'flow', 'piano bass pad', 0.9, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'roll', 'piano harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
  ],
});
tr('boulevard', 'Бульвар', 'аналоговый пад, фортепиано, бас', 'boom', {
  bpm: 116, swing: 0, reverb: 0.3,
  bassLine: 'drive',
  A: H('E2 B2 E3 G#3 | C#3 G#3 B3 E4 | A2 E3 A3 C#4 | B2 F#3 B3 D#4 | E2 B2 E3 G#3 | C#3 G#3 B3 E4 | F#2 C#3 F#3 A3 | B2 F#3 B3 D#4'),
  B: H('A2 E3 A3 C#4 | B2 F#3 B3 D#4 | G#2 D#3 G#3 B3 | C#3 G#3 B3 E4'),
  melA: MEL('0:B4:4 4:E5:4 8:G#5:8 16:F#5:4 20:E5:4 24:C#5:8 32:E5:4 36:A5:4 40:C#6:8 44:B5:4 48:F#5:4 52:D#5:4 56:B4:8 64:B4:4 68:E5:4 72:G#5:8 80:F#5:4 84:G#5:4 88:E5:8 96:A5:4 100:F#5:4 104:C#5:8 112:D#5:4 116:F#5:4 120:B4:8'),
  melB: MEL('0:C#5:4 4:E5:4 8:A5:8 16:B5:4 20:F#5:4 24:D#5:8 32:B4:4 36:D#5:4 40:G#5:8 48:E5:4 52:G#5:4 56:B5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass strings', 0.8, DR('x.......x.......', '....x.......x...', '..o...o...o...o.')),
    sec('B', 'melB', 'roll', 'piano harp bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('overdrive', 'Перегрев', 'фортепиано, бас, барабаны', 'boom', {
  bpm: 126, swing: 0, reverb: 0.22,
  bassLine: 'drive',
  A: H('B2 F#3 B3 D4 | A2 E3 A3 C#4 | G2 D3 G3 B3 | F#2 C#3 F#3 A3 | B2 F#3 B3 D4 | A2 E3 A3 C#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'),
  B: H('G2 D3 G3 B3 | D3 A3 D4 F#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'),
  melA: MEL('0:F#5:2 2:A5:2 4:F#5:2 6:D5:2 8:B4:8 16:C#5:4 20:E5:4 24:A5:8 32:B5:4 36:G5:4 40:D5:8 48:C#5:4 52:A4:4 56:F#4:8 64:F#5:2 66:A5:2 68:B5:4 72:F#5:8 80:E5:4 84:C#5:4 88:A4:8 96:B4:4 100:E5:4 104:G5:8 112:A5:4 116:F#5:4 120:C#5:8'),
  melB: MEL('0:D5:4 4:G5:4 8:B5:8 16:A5:4 20:F#5:4 24:D5:8 32:G5:4 36:B5:4 40:E5:8 48:C#5:4 52:A5:4 56:F#5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.85, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass pad strings', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass pad violin', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------------- СПАД --------------------------------- */
tr('longwinter', 'Долгая зима', 'фортепиано и бас', 'slump', {
  bpm: 56, swing: 0.08, reverb: 0.58,
  bassLine: 'half',
  A: H('E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | B2 F#3 A3 D#4 | E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | E2 B2 E3 G3'),
  B: H('C3 G3 B3 E4 | G2 D3 G3 B3 | A2 E3 G3 C4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:G4:8 16:E4:12 32:A4:8 40:C5:8 48:B4:14 64:G4:8 72:E4:8 80:E5:12 96:C5:8 104:B4:8 112:E4:14'),
  melB: MEL('0:G4:8 8:B4:8 16:D5:12 32:C5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass', 0.66),
    sec('B', 'melB', 'air', 'piano bass cello pad', 0.85),
    sec('A', 'melA', 'waltz', 'piano bass cello pad strings', 1.0),
  ],
});
tr('emptyhalls', 'Пустые цеха', 'бас и фортепиано', 'slump', {
  bpm: 60, swing: 0.06, reverb: 0.55,
  bassLine: 'root',
  A: H('A2 E3 A3 C4 | G2 E3 A3 C4 | F2 C3 F3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | C3 A3 C4 E4 | E2 B2 E3 A3 | A2 E3 A3 C4'),
  B: H('F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 C4 F4 | E2 B2 E3 G#3'),
  melA: MEL('0:A4:8 8:C5:8 16:B4:12 32:A4:8 40:F4:8 48:G4:14 64:F4:8 72:A4:8 80:E5:12 96:B4:8 104:A4:8 112:A4:14'),
  melB: MEL('0:C5:8 8:A4:8 16:G4:12 32:F4:8 40:D5:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass cello', 0.64),
    sec('A', 'melA', 'sustain', 'piano bass cello pad', 0.82),
    sec('B', 'melB', 'wide', 'piano bass cello pad strings', 1.0),
  ],
});
tr('patience', 'Терпение', 'фортепиано, аналоговый пад', 'slump', {
  bpm: 66, swing: 0.1, reverb: 0.5,
  bassLine: 'half', feel: 'loose',
  A: H('C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 G3 B3'),
  B: H('Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | Ab2 Eb3 Ab3 C4 | G2 D3 G3 B3'),
  melA: MEL('0:G4:8 8:Eb4:8 16:C5:12 32:Bb4:8 40:D5:8 48:G4:14 64:G4:8 72:C5:8 80:Eb5:12 96:C5:8 104:Ab4:8 112:G4:14'),
  melB: MEL('0:Bb4:8 8:Eb5:8 16:D5:12 32:C5:8 40:Ab4:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0),
  ],
});

/* ------------------------------ СТАГФЛЯЦИЯ ------------------------------ */
tr('deadlock', 'Тупик', 'арпеджио, низкий пад', 'stag', {
  bpm: 80, swing: 0, reverb: 0.36,
  bassLine: 'pulse8',
  A: H('E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | E2 B2 E3 G3 | F2 C3 F3 A3 | C3 G3 C4 E4 | B2 D#3 F#3 A3'),
  B: H('F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | B2 D#3 F#3 A3'),
  melA: MEL('0:E4:8 8:F4:4 12:E4:4 16:F4:12 32:E4:8 40:D4:8 48:D4:14 64:E4:8 72:G4:8 80:F4:12 96:E4:8 104:C4:8 112:D#4:8 120:E4:8'),
  melB: MEL('0:A4:8 8:F4:8 16:G4:12 32:F4:8 40:D4:8 48:D#4:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass cello', 0.75, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'pulse', 'piano bass cello pad', 0.9, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'piano bass cello pad choir', 1.0, DR('x...x...x...x...', '........x.......', '..o...o...o...o.')),
  ],
});
tr('friction', 'Трение', 'фортепиано, PWM-пад', 'stag', {
  bpm: 86, swing: 0, reverb: 0.4,
  bassLine: 'root',
  A: H('D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | D3 A3 D4 F4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:D4:8 8:Eb4:4 12:D4:4 16:Eb4:12 32:F4:8 40:D4:8 48:C4:14 64:D4:8 72:F4:8 80:G4:12 96:D4:8 104:Bb3:8 112:C#4:8 120:D4:8'),
  melB: MEL('0:Bb4:8 8:F4:8 16:Eb4:12 32:D4:8 40:A4:8 48:C#4:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass choir', 0.75, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass cello choir pad', 0.95, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'piano bass cello choir pad', 1.0, DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')),
  ],
});

/* -------------------------------- КРИЗИС -------------------------------- */
tr('collapse', 'Обвал', 'бас, барабаны, фортепиано', 'crisis', {
  bpm: 128, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 F3 B3'),
  B: H('Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:2 2:Ab4:2 4:G4:2 6:F4:2 8:Eb4:8 16:Eb4:2 18:F4:2 20:Eb4:4 24:C4:8 32:G4:4 36:Bb4:4 40:Eb5:8 48:D5:4 52:Bb4:4 56:F4:8 64:G4:2 66:Ab4:2 68:G4:2 70:F4:2 72:Eb4:8 80:C5:4 84:Ab4:4 88:Eb4:8 96:Ab4:4 100:C5:4 104:F5:8 112:D5:4 116:B4:4 120:G4:8'),
  melB: MEL('0:Ab4:4 4:C5:4 8:Eb5:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:C5:4 40:Eb5:8 48:B4:4 52:D5:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass cello', 0.85, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass cello choir', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass cello choir violin', 1.0, DR('x..x..x.x.x..x..', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
tr('panic', 'Паника', 'аналоговый пад, литавры, бас', 'crisis', {
  bpm: 136, swing: 0, reverb: 0.3,
  bassLine: 'pulse8',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:A4:2 34:C5:2 36:A4:4 40:F4:8 48:E5:4 52:C5:4 56:G4:8 64:A4:2 66:Bb4:2 68:A4:2 70:G4:2 72:F4:8 80:D5:4 84:F5:4 88:Bb4:8 96:G4:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:8'),
  melB: MEL('0:F5:4 4:D5:4 8:Bb4:8 16:E5:4 20:C5:4 24:G4:8 32:A5:4 36:F5:4 40:D5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass strings timpani', 0.9, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass strings choir timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass strings violin timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
tr('bankrun', 'Очередь у банка', 'арпеджио, PWM-пад, бас', 'crisis', {
  bpm: 118, swing: 0, reverb: 0.34,
  bassLine: 'synco',
  A: H('G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | D3 A3 D4 F#4 | G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | D3 A3 D4 F#4'),
  B: H('Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | D3 A3 D4 F#4'),
  melA: MEL('0:D5:4 4:Eb5:4 8:D5:8 16:Bb4:4 20:G5:4 24:Eb5:8 32:C5:4 36:A4:4 40:F4:8 48:F#4:4 52:A4:4 56:D5:8 64:D5:4 68:Eb5:4 72:F5:8 80:G5:4 84:Eb5:4 88:Bb4:8 96:C5:4 100:Eb5:4 104:G5:8 112:F#5:4 116:A5:4 120:D5:8'),
  melB: MEL('0:G5:4 4:Bb5:4 8:Eb5:8 16:C5:4 20:F5:4 24:A4:8 32:Bb4:4 36:D5:4 40:G5:8 48:A5:4 52:F#5:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass cello', 0.85, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass cello choir timpani', 1.0, DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass cello choir strings timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------------- ВОЙНА --------------------------------- */
// Настоящий марш: пунктирный «длинный-короткий» ритм (3+1 шестнадцатых — то же
// «та-та́» дудочки и барабана, что в строевых маршах), духовые стабы на каждую
// четверть и малый барабан с форшлагами-дробью перед каждой сильной долей —
// вместо синтвейв-пэда и мелодии, унаследованной от «паники».
tr('warmarch', 'Марш', 'духовые стабы, дробь малого барабана, маршевый бас', 'war', {
  bpm: 112, swing: 0, reverb: 0.2,
  bassLine: 'drive',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:D4:3 3:F4:1 4:A4:3 7:D5:1 8:D5:4 12:C5:2 14:Bb4:2 16:C5:3 19:A4:1 20:F4:3 23:C5:1 24:Bb4:4 28:A4:2 30:G4:2 32:F4:3 35:A4:1 36:C5:3 39:F5:1 40:F5:4 44:E5:2 46:D5:2 48:E5:3 51:C5:1 52:G4:3 55:C5:1 56:C5:4 60:B4:2 62:A4:2 64:D4:3 67:F4:1 68:A4:3 71:D5:1 72:D5:4 76:C5:2 78:Bb4:2 80:C5:3 83:A4:1 84:F4:3 87:C5:1 88:Bb4:4 92:A4:2 94:G4:2 96:G4:3 99:Bb4:1 100:D5:3 103:G5:1 104:G5:4 108:F5:2 110:Eb5:2 112:E5:3 115:C#5:1 116:A4:3 119:E5:1 120:A4:4 124:D5:4'),
  melB: MEL('0:F4:3 3:Bb4:1 4:D5:3 7:F5:1 8:F5:4 12:D5:2 14:Bb4:2 16:E4:3 19:G4:1 20:C5:3 23:E5:1 24:E5:4 28:C5:2 30:G4:2 32:F4:3 35:A4:1 36:D5:3 39:F5:1 40:F5:4 44:D5:2 46:A4:2 48:C#5:3 51:E5:1 52:A4:3 55:C#5:1 56:A4:6 62:D5:2'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass brass timpani', 0.85, DR('x.......x.......', '....x.......x...', 'o...o...o...o...')),
    sec('B', 'melB', 'drive', 'piano bass brass timpani', 1.0, DR('x.......x.......', '....x.......xxx.', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'drive', 'piano bass brass strings cello timpani', 1.0, DR('x...x...x...x...', '....x.x.....xxx.', 'oooooooooooooooo')),
  ],
});
// Окопы: не марш, а гнетущая, замедленная поступь — редкая, тянущаяся мелодия
// в низком регистре без дроби и стабов, чтобы отчётливо звучать иначе, чем марш.
tr('trenches', 'Окопы', 'литавры, низкая виолончель, редкая поступь', 'war', {
  bpm: 90, swing: 0, reverb: 0.36,
  bassLine: 'half',
  A: H('G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | D3 A3 D4 F#4 | G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | D3 A3 D4 F#4'),
  B: H('Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | D3 A3 D4 F#4'),
  melA: MEL('0:Bb4:6 8:G4:4 12:D4:4 16:Eb5:6 24:Bb4:4 28:G4:4 32:A4:6 40:F4:4 44:C4:4 48:F#4:6 56:D4:4 60:A3:4 64:Bb4:6 72:G4:4 76:D4:4 80:Eb5:6 88:Bb4:4 92:G4:4 96:Eb4:6 104:C4:4 108:G3:4 112:F#4:6 120:A4:6'),
  melB: MEL('0:G4:4 4:Bb4:4 8:Eb5:8 16:F4:4 20:A4:4 24:C5:8 32:Bb4:4 36:D5:4 40:G5:8 48:F#4:4 52:A4:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass cello timpani', 0.8, DR('x.......x.......', '....x...........', 'o.......o.......')),
    sec('B', 'melB', 'drive', 'piano bass cello timpani', 0.95, DR('x...x...x...x...', '....x.......x...', 'o...o...o...o...')),
    sec('A', 'melA', 'drive', 'piano bass cello strings timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});

/* ----------------------------- ТОТАЛИТАРНЫЙ РЕЖИМ ----------------------------- */
// Обе пьесы этого настроения нарочно построены только на новых голосах (guitar, growl) и
// драм-машине — ни один другой трек саундтрека не пользуется дисторшном, так что звучание
// тоталитарного режима не может быть спутано ни с чем прежним.
tr('ironmarch', 'Железный марш', 'дисторшн-гитара, тяжёлый бас, драм-машина', 'totalitarian', {
  bpm: 104, swing: 0, reverb: 0.22,
  bassLine: 'pulse8',
  A: H('D3 A3 D4 F4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | A2 E3 A3 C#4 | D3 A3 D4 F4 | D3 A3 D4 F4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | D3 A3 D4 F4 | A2 E3 A3 C#4'),
  melA: MEL('0:D4:3 3:F4:1 8:D4:3 11:F4:1 16:Bb3:3 19:D4:1 24:A3:3 27:C#4:1 32:D4:3 35:F4:1 40:D4:3 43:F4:1 48:G3:3 51:Bb3:1 56:A3:3 59:C#4:1'),
  melB: MEL('0:Bb3:3 3:D4:1 8:G3:3 11:Bb3:1 16:D4:3 19:F4:1 24:A3:3 27:C#4:1'),
  sections: [
    sec('A', 'melA', 'flow', 'guitar growl', 0.85, DR('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('B', 'melB', 'flow', 'guitar growl', 1.0, DR('x...x...x...x...', '....x.......xxx.', 'xxxxxxxxxxxxxxxx')),
    sec('A', 'melA', 'flow', 'guitar growl', 1.0, DR('x...x...x...x...', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
// Комендантский час: не марш, а гнетущая пустота улиц — редкие гитарные вспышки над
// тяжёлым басовым дроном, шаги патруля вместо строевого шага.
tr('curfew', 'Комендантский час', 'бас-дрон, редкие гитарные вспышки', 'totalitarian', {
  bpm: 72, swing: 0, reverb: 0.42,
  bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | A2 E3 A3 C#4 | D3 A3 D4 F4 | A2 E3 A3 C#4'),
  melA: MEL('0:D4:8 16:F4:4 24:D4:4 32:Bb3:8 48:D4:4 56:Bb3:4'),
  melB: MEL('0:Bb3:8 16:D4:4 24:A3:4 32:A3:8 48:C#4:4 56:A3:4'),
  sections: [
    sec('A', 'melA', 'sustain', 'guitar growl', 0.7, DR('x...............', '................', '.......o........')),
    sec('B', 'melB', 'sustain', 'guitar growl', 0.85, DR('x.......x.......', '................', '.......o.......o')),
    sec('A', 'melA', 'sustain', 'guitar growl', 1.0, DR('x.......x.......', '....x...........', 'o.......o.......')),
  ],
});

/* ------------------------------- ДЕФЛЯЦИЯ ------------------------------- */
tr('glass', 'Стеклянный воздух', 'ретро-колокол, PWM-пад', 'frost', {
  bpm: 52, swing: 0, reverb: 0.72,
  bassLine: 'half',
  A: H('F2 C3 E3 A3 | C3 G3 B3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | A2 E3 G3 C4 | G2 D3 F3 Bb3 | C3 G3 C4 D4'),
  B: H('Bb2 F3 A3 D4 | C3 G3 B3 E4 | D3 A3 C4 F4 | C3 G3 C4 D4'),
  melA: MEL('0:C6:12 16:A5:12 32:F5:14 48:D5:14 64:C6:12 80:E5:12 96:Bb5:14 112:G5:14'),
  melB: MEL('0:D6:12 16:C6:12 32:A5:14 48:G5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad', 0.65),
    sec('B', 'melB', 'air', 'bells bass pad choir', 0.85),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 1.0),
  ],
});
tr('stillness', 'Ничего не происходит', 'PWM-пад, низкий пад', 'frost', {
  bpm: 48, swing: 0, reverb: 0.75,
  bassLine: 'half',
  A: H('Bb2 F3 A3 D4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  B: H('G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  melA: MEL('0:D5:14 16:F5:14 32:G5:14 48:A5:14 64:D5:14 80:Bb4:14 96:G5:14 112:A5:14'),
  melB: MEL('0:Bb4:14 16:E5:14 32:G5:14 48:A5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad choir', 0.6),
    sec('B', 'melB', 'sustain', 'bells bass pad choir cello', 0.8),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 0.95),
  ],
});
/* ------------------------------ ТОРГОВЫЙ ЗАЛ ------------------------------
   Пьесы звучат только у роли «Частный инвестор»: другая инструментовка,
   другой пульс — рынок, а не министерство.                                 */
tr('openingbell', 'Открытие торгов', 'синт-лид, хай-хэт, синт-бас', 'calm', {
  bpm: 92, swing: 0.18, reverb: 0.32,
  bassLine: 'drive',
  A: H('D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:4 4:D5:4 8:F5:8 16:Bb4:4 20:D5:4 24:G5:8 32:E5:4 36:G5:4 40:Bb5:8 48:A5:4 52:F5:4 56:C5:8 64:D5:4 68:F5:4 72:A5:8 80:C#5:4 84:E5:4 88:A5:8 96:F5:4 100:D5:4 104:A4:8 112:C#5:4 116:E5:4 120:D5:8'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:E5:4 20:G5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'synth bass', 0.7, DR('x.......x.......', '................', '..o...o...o...o.')),
    sec('B', 'melB', 'wide', 'synth bass pad', 0.9, DR('x.......x.......', '....x.......x...', '..o...o...o...o.')),
    sec('A', 'melA', 'roll', 'synth harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('bidask', 'Бид и аск', 'синт-лид, драм-машина', 'boom', {
  bpm: 118, swing: 0, reverb: 0.24,
  bassLine: 'drive',
  A: H('C3 G3 C4 E4 | A2 E3 A3 C4 | F2 C3 F3 A3 | G2 D3 G3 B3 | C3 G3 C4 E4 | E3 B3 E4 G#4 | F2 C3 F3 A3 | G2 D3 F3 B3'),
  B: H('F2 C3 F3 A3 | G2 D3 G3 B3 | A2 E3 A3 C4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:2 2:C5:2 4:E5:4 8:G5:8 16:E5:4 20:A5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:B4:4 52:D5:4 56:G5:8 64:G4:2 66:C5:2 68:E5:4 72:C5:8 80:G#5:4 84:E5:4 88:B4:8 96:A5:4 100:F5:4 104:C5:8 112:B4:4 116:D5:4 120:G4:8'),
  melB: MEL('0:A5:4 4:F5:4 8:C5:8 16:B5:4 20:G5:4 24:D5:8 32:C6:4 36:A5:4 40:E5:8 48:B4:4 52:F5:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'synth bass', 0.8, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'roll', 'synth harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'synth bass pad violin', 1.0, DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')),
  ],
});
tr('bearmarket', 'Медвежий рынок', 'синт-бас, синт-лид', 'slump', {
  bpm: 62, swing: 0.08, reverb: 0.56,
  bassLine: 'root',
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E2 B2 E3 G#3 | A2 E3 A3 C4 | G2 D3 G3 Bb3 | F2 C3 F3 A3 | E2 B2 E3 G#3'),
  B: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | E2 B2 E3 G#3'),
  melA: MEL('0:E5:8 8:C5:8 16:A4:12 32:D5:8 40:F5:8 48:E5:14 64:C5:8 72:A4:8 80:Bb4:12 96:A4:8 104:F4:8 112:G#4:14'),
  melB: MEL('0:F5:8 8:D5:8 16:Bb4:12 32:E5:8 40:C5:8 48:G#4:12'),
  sections: [
    sec('A', 'melA', 'air', 'synth bass cello', 0.64),
    sec('B', 'melB', 'sustain', 'synth bass cello pad', 0.84),
    sec('A', 'melA', 'wide', 'synth bass cello pad strings', 1.0),
  ],
});
tr('thinvolume', 'Тонкий рынок', 'синт-арпеджио, PWM-пад', 'stag', {
  bpm: 76, swing: 0, reverb: 0.38,
  bassLine: 'synco',
  A: H('E2 B2 E3 G3 | A2 E3 G3 C4 | E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | C3 G3 C4 E4 | B2 F#3 A3 D#4'),
  B: H('A2 E3 G3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:A4:4 12:B4:4 16:G4:12 32:A4:8 40:C5:8 48:B4:14 64:E5:8 72:D5:8 80:C5:12 96:B4:8 104:G4:8 112:D#5:8 120:E4:8'),
  melB: MEL('0:C5:8 8:A4:8 16:F4:12 32:D5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'synth bass choir', 0.74, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'pulse', 'synth bass cello choir pad', 0.92, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'synth bass cello choir pad', 1.0, DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('marginwire', 'Маржин-колл', 'синт-бас, синт-том, аналоговый пад', 'crisis', {
  bpm: 132, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4 | D3 A3 D4 F4 | F2 C3 F3 A3 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'),
  B: H('G2 D3 G3 Bb3 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:Bb4:4 40:D5:8 48:C#5:4 52:E5:4 56:A4:8 64:A4:2 66:D5:2 68:F5:4 72:D5:8 80:C5:4 84:A4:4 88:F4:8 96:Bb4:4 100:D5:4 104:F5:8 112:E5:4 116:C#5:4 120:A4:8'),
  melB: MEL('0:Bb4:4 4:D5:4 8:G5:8 16:F5:4 20:D5:4 24:Bb4:8 32:C5:4 36:E5:4 40:G5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'drive', 'synth bass cello', 0.88, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'synth bass strings timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'synth bass strings violin timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------- ЖИВОЙ СОСТАВ ---------------------------
   Пьесы, написанные не под синтезатор, а под состав: рояль, бас-гитара или
   контрабас, барабаны, акустическая гитара. Здесь у баса своя линия, у
   барабанщика — динамика и сбивки, а у мелодии — фразировка с ответом, а не
   ровная цепочка нот одинаковой длины.                                    */
tr('cabinet', 'Кабинет в семь утра', 'фортепианное трио: рояль, контрабас, щётки', 'calm', {
  bpm: 86, swing: 0.26, reverb: 0.38, feel: 'swing', bassLine: 'walk',
  A: H('F2 C3 E3 A3 | D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | A2 E3 G3 C4 | D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4'),
  B: H('Bb2 F3 A3 D4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | C3 G3 Bb3 E4'),
  melA: MEL('0:A4:4 4:C5:4 8:F5:6 16:E5:4 20:D5:4 24:A4:8 32:Bb4:4 36:D5:4 40:F5:6 48:E5:8 56:C5:8 64:C5:4 68:E5:4 72:A5:6 80:G5:4 84:F5:4 88:D5:8 96:Bb4:4 100:D5:4 104:G5:6 112:F5:4 116:E5:4 120:C5:10'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:C#5:4 20:E5:4 24:A5:8 32:F5:4 36:A5:4 40:D6:8 48:E5:4 52:G5:4 56:C5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68, DR('x.......x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('B', 'melB', 'wide', 'piano bass', 0.88, DR('x.....x.x.......', '....x.......x...', 'r..r.r..r..r.r..', { ghost: true })),
    sec('A', 'melA', 'flow', 'piano bass strings', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});
tr('sixstring', 'Шесть струн', 'акустическая гитара, бас, барабаны', 'calm', {
  bpm: 104, swing: 0.1, reverb: 0.34, feel: 'loose', bassLine: 'root',
  A: H('G2 D3 G3 B3 | E2 B2 E3 G3 | C3 G3 C4 E4 | D3 A3 D4 F#4 | G2 D3 G3 B3 | E2 B2 E3 G3 | A2 E3 A3 C4 | D3 A3 D4 F#4'),
  B: H('C3 G3 C4 E4 | D3 A3 D4 F#4 | B2 F#3 B3 D4 | E2 B2 E3 G3'),
  melA: MEL('0:D5:4 4:G5:4 8:B5:6 16:A5:4 20:G5:4 24:E5:8 32:E5:4 36:G5:4 40:C6:6 48:B5:4 52:A5:4 56:D5:8 64:D5:4 68:G5:4 72:B5:6 80:A5:4 84:B5:4 88:G5:8 96:E5:4 100:A5:4 104:C6:6 112:B5:4 116:A5:4 120:G5:10'),
  melB: MEL('0:G5:4 4:C6:4 8:E6:8 16:D6:4 20:A5:4 24:F#5:8 32:B5:4 36:D6:4 40:F#6:8 48:E6:4 52:B5:4 56:G5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'strum bass nylon', 0.7, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'wide', 'strum bass nylon', 0.9, DR('x.....x.x.......', '....x.......x...', 'o.o.o.o.o.o.o.O.')),
    sec('A', 'melA', 'flow', 'strum bass nylon strings', 1.0, DR('x..x..x.x..x....', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});
tr('fullhouse', 'Полный зал', 'рояль, бас, барабаны — быстрый темп', 'boom', {
  bpm: 138, swing: 0, reverb: 0.26, bassLine: 'drive',
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | C3 G3 C4 E4 | G2 D3 G3 B3 | A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E3 B3 E4 G4'),
  B: H('F2 C3 F3 A3 | G2 D3 G3 B3 | A2 E3 A3 C4 | E3 B3 E4 G4'),
  melA: MEL('0:A4:2 2:C5:2 4:E5:4 8:A5:6 16:G5:2 18:F5:2 20:E5:4 24:C5:8 32:C5:2 34:E5:2 36:G5:4 40:C6:6 48:B5:2 50:A5:2 52:G5:4 56:D5:8 64:A4:2 66:C5:2 68:E5:4 72:A5:6 80:C6:2 82:B5:2 84:A5:4 88:F5:8 96:D5:2 98:F5:2 100:A5:4 104:D6:6 112:B5:4 116:G5:4 120:E5:8'),
  melB: MEL('0:F5:2 2:A5:2 4:C6:4 8:F6:6 16:D6:2 18:B5:2 20:G5:4 24:D5:8 32:E5:2 34:A5:2 36:C6:4 40:E6:6 48:D6:4 52:B5:4 56:E5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.82, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass brass', 1.0, DR('x..x....x...x...', '....x.......x..x', 'oooooooooooooooo', { ghost: true })),
    sec('A', 'melA', 'drive', 'piano bass brass strings', 1.0, DR('x..x..x.x...x..x', '....x...x...x...', 'oooooooooooooooo', { ghost: true })),
  ],
});
tr('nightshift', 'Ночная смена', 'рояль и бас, редкие барабаны', 'slump', {
  bpm: 74, swing: 0.18, reverb: 0.5, feel: 'loose', bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 A3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C4 | D3 A3 D4 F4 | F2 C3 F3 A3 | Bb2 F3 A3 D4 | A2 E3 A3 C#4'),
  B: H('G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | Bb2 F3 A3 D4 | A2 E3 A3 C#4'),
  melA: MEL('0:D5:6 8:F5:6 16:A5:10 32:Bb4:6 40:D5:6 48:F5:12 64:G4:6 72:Bb4:6 80:D5:10 96:C5:6 104:A4:6 112:D5:12'),
  melB: MEL('0:Bb4:6 8:D5:6 16:G5:12 32:Eb5:6 40:G5:6 48:C6:12'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass', 0.6, DR('x...............', '........x.......', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.8, DR('x.......x.......', '........x.......', 'o...o...o...o...')),
    sec('A', 'melA', 'flow', 'piano bass pad cello', 0.95, DR('x.....x.x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
  ],
});
tr('treadmill', 'Бег на месте', 'синкопированный бас, рояль, барабаны', 'stag', {
  bpm: 112, swing: 0.14, reverb: 0.3, bassLine: 'synco',
  A: H('E2 B2 E3 G3 | C3 G3 C4 E4 | D3 A3 D4 F4 | B2 F#3 B3 D4 | E2 B2 E3 G3 | A2 E3 A3 C4 | C3 G3 C4 E4 | B2 F#3 B3 D4'),
  B: H('A2 E3 A3 C4 | D3 A3 D4 F4 | G2 D3 G3 B3 | B2 F#3 B3 D4'),
  melA: MEL('0:B4:3 3:E5:3 6:G5:6 16:C5:3 19:E5:3 22:G5:6 32:D5:3 35:F5:3 38:A5:6 48:F#5:6 56:D5:6 64:B4:3 67:E5:3 70:B5:6 80:C5:3 83:A4:3 86:E5:6 96:G5:3 99:E5:3 102:C5:6 112:B4:6 120:F#4:6'),
  melB: MEL('0:A4:3 3:C5:3 6:E5:6 16:D5:3 19:F5:3 22:A5:6 32:G5:3 35:B5:3 38:D6:6 48:F#5:6 56:B4:6'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass', 0.75, DR('x.....x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
    sec('B', 'melB', 'drive', 'piano bass pad', 0.92, DR('x.....x...x...x.', '....x.......x...', 'oo.ooo.ooo.ooo.o', { ghost: true })),
    sec('A', 'melA', 'pulse', 'piano bass pad strings', 1.0, DR('x.....x...x.....', '....x...x...x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});

/* ------------------------------ ОБУЧЕНИЕ ------------------------------
   Курсам нужна своя музыка: не тревожная и не парадная, а такая, под которую
   спокойно читают и решают задачи. Три пьесы на разный темп — от медленной
   первой лекции до бодрого экзамена.                                      */
tr('firstlesson', 'Первый урок', 'рояль и нейлоновая гитара', 'calm', {
  bpm: 92, swing: 0.16, reverb: 0.42, feel: 'loose', bassLine: 'half',
  A: H('C3 G3 C4 E4 | A2 E3 A3 C4 | F2 C3 F3 A3 | G2 D3 G3 B3 | C3 G3 C4 E4 | E3 B3 E4 G4 | F2 C3 F3 A3 | G2 D3 G3 B3'),
  B: H('A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | G2 D3 G3 B3'),
  melA: MEL('0:E5:4 4:G5:4 8:C6:8 16:B5:4 20:A5:4 24:E5:8 32:F5:4 36:A5:4 40:C6:8 48:D6:4 52:B5:4 56:G5:8 64:E5:4 68:C5:4 72:G5:8 80:B5:4 84:G5:4 88:E5:8 96:A5:4 100:F5:4 104:C6:8 112:D6:4 116:B5:4 120:C6:10'),
  melB: MEL('0:C6:4 4:A5:4 8:E5:8 16:A5:4 20:F5:4 24:C5:8 32:D5:4 36:F5:4 40:A5:8 48:B5:4 52:D6:4 56:G5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.62, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass nylon', 0.82, DR('x.......x.......', '........x.......', 'o...o...o...o...')),
    sec('A', 'melA', 'flow', 'piano bass nylon strings', 0.95, DR('x.....x.x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});
tr('chalkboard', 'Мел и доска', 'маримба, бас, щётки', 'calm', {
  bpm: 100, swing: 0.24, reverb: 0.36, feel: 'swing', bassLine: 'walk',
  A: H('Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | D3 A3 C4 F4 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  B: H('G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4'),
  melA: MEL('0:D5:4 4:F5:4 8:Bb5:6 16:A5:4 20:G5:4 24:D5:8 32:G5:4 36:Bb5:4 40:Eb6:6 48:D6:4 52:C6:4 56:A5:8 64:D5:4 68:A5:4 72:F5:6 80:C6:4 84:A5:4 88:F5:8 96:G5:4 100:Bb5:4 104:D6:6 112:C6:4 116:A5:4 120:Bb5:10'),
  melB: MEL('0:Bb5:4 4:D6:4 8:G6:8 16:E6:4 20:C6:4 24:G5:8 32:A5:4 36:C6:4 40:F6:8 48:D6:4 52:Bb5:4 56:F5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'marimba bass', 0.66, DR('x.......x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('B', 'melB', 'wide', 'marimba bass piano', 0.86, DR('x.....x.x.......', '....x.......x...', 'r..r.r..r..r.r..', { ghost: true })),
    sec('A', 'melA', 'flow', 'marimba bass piano strings', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});
tr('graduation', 'Выпуск', 'рояль, бас, барабаны — экзаменационный темп', 'boom', {
  bpm: 126, swing: 0, reverb: 0.3, bassLine: 'drive',
  A: H('D3 A3 D4 F#4 | B2 F#3 B3 D4 | G2 D3 G3 B3 | A2 E3 A3 C#4 | D3 A3 D4 F#4 | F#2 C#3 F#3 A3 | G2 D3 G3 B3 | A2 E3 A3 C#4'),
  B: H('G2 D3 G3 B3 | A2 E3 A3 C#4 | B2 F#3 B3 D4 | E3 B3 E4 G4'),
  melA: MEL('0:D5:2 2:F#5:2 4:A5:4 8:D6:6 16:C#6:2 18:B5:2 20:A5:4 24:F#5:8 32:G5:2 34:B5:2 36:D6:4 40:G6:6 48:F#6:4 52:D6:4 56:A5:8 64:D5:2 66:A5:2 68:F#5:4 72:D6:6 80:C#6:2 82:A5:2 84:F#5:4 88:C#5:8 96:B5:2 98:G5:2 100:D6:4 104:B5:6 112:C#6:4 116:A5:4 120:D6:8'),
  melB: MEL('0:G5:2 2:B5:2 4:D6:4 8:G6:6 16:E6:2 18:C#6:2 20:A5:4 24:E5:8 32:F#5:2 34:B5:2 36:D6:4 40:F#6:6 48:G6:4 52:E6:4 56:B5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.8, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass brass', 0.96, DR('x..x....x...x...', '....x.......x..x', 'oooooooooooooooo', { ghost: true })),
    sec('A', 'melA', 'drive', 'piano bass brass strings', 1.0, DR('x..x..x.x...x..x', '....x...x...x...', 'oooooooooooooooo', { ghost: true })),
  ],
});

/* ------------------------------- КАЗИНО ------------------------------- */
// не привязана к режиму экономики — переключается локально при входе на
// вкладку «Казино» (см. Audio.setPlaylist('casino')/(null)), поэтому обе
// темы нарочно бодрые и «фоново-лаунжевые» вне зависимости от состояния
// экономики за окном
tr('chips', 'Фишки и блеск', 'свинг-фортепиано, контрабас, щётки', 'casino', {
  bpm: 124, swing: 0.32, reverb: 0.3,
  bassLine: 'walk', feel: 'swing',
  A: H('C3 A3 C4 E4 | A2 G3 A3 C4 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 A3 C4 E4 | A2 G3 A3 C4 | D3 C4 D4 F4 | G2 F3 G3 B3'),
  B: H('F2 D3 F3 A3 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 A3 C4 E4'),
  melA: MEL('0:E4:2 2:G4:2 4:C5:2 6:E5:2 8:D5:4 12:C5:4 16:C5:2 18:E5:2 20:A4:2 22:C5:2 24:B4:4 28:A4:4 32:F4:2 34:A4:2 36:D5:2 38:F5:2 40:E5:4 44:D5:4 48:D5:2 50:B4:2 52:G4:2 54:D5:2 56:B4:4 60:G4:4 64:E4:2 66:G4:2 68:C5:2 70:E5:2 72:D5:4 76:C5:4 80:C5:2 82:E5:2 84:A4:2 86:C5:2 88:B4:4 92:A4:4 96:F4:2 98:A4:2 100:D5:2 102:Eb5:2 104:D5:4 108:C5:4 112:D5:2 114:B4:2 116:G4:2 118:D5:2 120:G5:4 124:D5:4'),
  melB: MEL('0:A4:2 2:C5:2 4:F5:2 6:A5:2 8:G5:4 12:F5:4 16:D5:2 18:F5:2 20:A5:2 22:C6:2 24:A5:4 28:F5:4 32:B4:2 34:D5:2 36:G5:2 38:B5:2 40:A5:4 44:G5:4 48:E5:2 50:G5:2 52:C6:2 54:E5:2 56:C5:6 62:E5:2'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass cello harp', 0.85, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('B', 'melB', 'drive', 'piano bass cello harp bells', 1.0, DR('x...x...x...x...', '....x...x...x...', 'xxxxxxxxxxxxxxxx')),
    sec('A', 'melA', 'drive', 'piano bass cello harp bells timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'xxxxxxxxxxxxxxxx')),
  ],
});
tr('croupier', 'Крупье', 'вибрафон, фортепиано, контрабас — джаз-лаунж', 'casino', {
  bpm: 96, swing: 0.28, reverb: 0.4,
  bassLine: 'walk', feel: 'swing',
  A: H('D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4'),
  B: H('F2 E3 F3 A3 | E3 D4 E4 G4 | A2 G3 A3 C4 | A2 G3 A3 C#4'),
  melA: MEL('0:D4:6 8:A4:4 12:F4:4 16:G4:6 24:B4:4 28:G4:4 32:C5:6 40:E5:4 44:C5:4 48:C#5:6 56:A4:4 60:E4:4 64:D4:6 72:A4:4 76:F4:4 80:G4:6 88:B4:4 92:G4:4 96:C5:6 104:E5:4 108:C5:4 112:C#5:6 120:D5:8'),
  melB: MEL('0:A4:6 8:F4:4 12:E4:4 16:G4:6 24:E4:4 28:D4:4 32:A4:6 40:C5:4 44:A4:4 48:C#5:6 56:A4:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'marimba bass cello timpani', 0.78, DR('x.......x.......', '....x.......x...', 'x...x...x...x...')),
    sec('B', 'melB', 'sustain', 'marimba bass cello strings timpani', 0.92, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('A', 'melA', 'sustain', 'marimba bass cello strings bells timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
  ],
});

/* -------------------------------- ЗАГЛАВНАЯ -------------------------------- */
/* Тема главного меню: рояль ведёт мелодию, струнные держат зал, барабаны почти
   не слышны — это ещё не партия, это дверь в кабинет. */
tr('anthem', 'Герб на двери', 'рояль, струнные, контрабас — заглавная тема', 'calm', {
  bpm: 88, swing: 0.08, reverb: 0.44, bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  melA: MEL('0:D5:4 4:F5:4 8:A5:6 16:G5:4 20:F5:4 24:D5:8 32:F5:4 36:A5:4 40:C6:6 48:Bb5:4 52:A5:4 56:F5:8 64:A5:4 68:G5:4 72:F5:6 80:E5:4 84:D5:4 88:C5:8 96:Bb4:4 100:D5:4 104:G5:6 112:F5:4 116:E5:4 120:D5:10'),
  melB: MEL('0:F5:4 4:Bb5:4 8:D6:8 16:C6:4 20:A5:4 24:F5:8 32:Bb5:4 36:D6:4 40:F6:6 48:E6:4 52:C#6:4 56:A5:10'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass', 0.6, DR('x.......x.......', '................', 'r...r...r...r...')),
    sec('B', 'melB', 'flow', 'piano bass strings', 0.85, DR('x.....x.x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('A', 'melA', 'flow', 'piano bass strings cello', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});

const MOOD_PLAYLISTS = {
  calm: ['cabinet', 'dawn', 'sixstring', 'ledger', 'northlight', 'promenade', 'meadow'],
  boom: ['fullhouse', 'ascent', 'boulevard', 'overdrive'],
  slump: ['nightshift', 'longwinter', 'emptyhalls', 'patience'],
  stag: ['treadmill', 'deadlock', 'friction'],
  crisis: ['collapse', 'panic', 'bankrun'],
  frost: ['glass', 'stillness'],
  war: ['warmarch', 'trenches'],
  totalitarian: ['ironmarch', 'curfew'],
  casino: ['chips', 'croupier'],
};
const MOOD_LABEL = { calm: 'Спокойствие', boom: 'Подъём', slump: 'Спад', stag: 'Стагфляция', crisis: 'Кризис', frost: 'Дефляция', war: 'Война', totalitarian: 'Тоталитаризм', casino: 'Казино' };
const REGIME_MOOD = { normal: 'calm', overheating: 'boom', recession: 'slump', stagflation: 'stag',
  banking: 'crisis', debt: 'crisis', currency: 'crisis', deflation: 'frost', war: 'war', pandemic: 'crisis' };
/* Плейлисты, привязанные к роли: у инвестора свой репертуар, у обучения — свой */
const ROLE_PLAYLISTS = {
  /* В меню нет экономики, а значит нет и настроения: один и тот же спокойный
     репертуар во всех ветках — заглавная тема и то, что к ней прилегает. */
  menu: {
    calm: ['anthem', 'cabinet', 'dawn', 'northlight', 'promenade'],
    boom: ['anthem', 'cabinet', 'dawn'],
    slump: ['anthem', 'dawn', 'northlight'],
    stag: ['anthem', 'cabinet', 'meadow'],
    crisis: ['anthem', 'dawn', 'northlight'],
    frost: ['anthem', 'meadow', 'dawn'],
  },
  tutorial: {
    calm: ['firstlesson', 'chalkboard', 'cabinet'],
    boom: ['graduation', 'sixstring'],
    slump: ['nightshift', 'firstlesson'],
    stag: ['chalkboard', 'treadmill'],
    crisis: ['treadmill', 'graduation'],
    frost: ['firstlesson', 'nightshift'],
  },
  trader: {
    calm: ['openingbell', 'ledger'],
    boom: ['bidask', 'ascent'],
    slump: ['bearmarket', 'patience'],
    stag: ['thinvolume', 'friction'],
    crisis: ['marginwire', 'panic'],
    frost: ['thinvolume', 'glass'],
  },
};

export const Audio = (() => {
  let ctx = null; let master = null; let comp = null; let musicBus = null; let sfxBus = null; let noiseBuf = null;
  let dry = null; let verbIn = null; let echo = null; let pianoBus = null; let chorusIn = null;
  const opts = { music: true, sfx: true, volume: 0.6 };
  let lastTick = 0; const listeners = [];
  let track = TRACKS.dawn; let mood = 'calm'; let lockedMood = null; let playlistIdx = 0;
  let roleId = null;
  const listOf = (m) => (
    (roleId && ROLE_PLAYLISTS[roleId] && ROLE_PLAYLISTS[roleId][m])
    || MOOD_PLAYLISTS[m] || MOOD_PLAYLISTS.calm
  );
  let pending = null; let tempoMod = 1; let intensity = 0.3;
  let timer = null; let nextTime = 0; let stepIdx = 0; let running = false;

  const now = () => (ctx ? ctx.currentTime : 0);
  const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  const jitter = () => (Math.random() - 0.5) * 0.014;
  const notify = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
  const plan = (t) => {
    let bar = 0;
    return t.sections.map((s) => { const start = bar; bar += t[s.h].length; return { ...s, start, bars: t[s.h].length }; });
  };
  let sectionPlan = plan(track);
  let formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);

  const makeIR = (seconds, decay) => {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        lp += ((Math.random() * 2 - 1) - lp) * (0.30 - 0.22 * (i / len));
        d[i] = lp * env;
      }
    }
    return buf;
  };

  const ensure = () => {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain(); master.gain.value = opts.volume;
    try {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.28;
      master.connect(comp); comp.connect(ctx.destination);
    } catch { master.connect(ctx.destination); }
    musicBus = ctx.createGain(); musicBus.gain.value = opts.music ? 0.55 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = opts.sfx ? 0.9 : 0; sfxBus.connect(master);
    dry = ctx.createGain(); dry.gain.value = 1; dry.connect(musicBus);
    try {
      // шельф на верхах был сделан под пилу старого синт-лида и душил бы настоящий
      // рояль: у него в этой полосе как раз живёт молоточек и «воздух» инструмента
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 0.8; body.gain.value = 2.0;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5400; air.gain.value = -1.5;
      pianoBus = ctx.createGain(); pianoBus.gain.value = 1;
      pianoBus.connect(body); body.connect(air); air.connect(dry);
    } catch { pianoBus = dry; }
    try {
      // короче и суше, чем концертный зал: маленькая комната/плата — характернее для синтвейва
      const conv = ctx.createConvolver(); conv.buffer = makeIR(1.5, 2.6);
      const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.014;
      verbIn = ctx.createGain(); verbIn.gain.value = 1;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      verbIn.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(musicBus);
    } catch { verbIn = ctx.createGain(); verbIn.gain.value = 0; verbIn.connect(musicBus); }
    // хорус для струнных и хора: две модулированные линии задержки
    try {
      chorusIn = ctx.createGain(); chorusIn.gain.value = 1; chorusIn.connect(dry);
      [[0.014, 0.31], [0.021, 0.23]].forEach(([base, rate]) => {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = base;
        const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
        const amt = ctx.createGain(); amt.gain.value = 0.0035;
        const g = ctx.createGain(); g.gain.value = 0.5;
        lfo.connect(amt); amt.connect(dl.delayTime); lfo.start();
        chorusIn.connect(dl); dl.connect(g); g.connect(dry);
      });
    } catch { chorusIn = dry; }
    try {
      // слэп-дилей на синт-лид/арпеджио — фирменный приём синтвейва вместо диффузного эха
      const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.16;
      const fb = ctx.createGain(); fb.gain.value = 0.24;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
      echo = ctx.createGain(); echo.gain.value = 0.5;
      echo.connect(dl); dl.connect(damp); damp.connect(fb); fb.connect(dl); dl.connect(musicBus);
    } catch { echo = dry; }
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dat = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;
    return ctx;
  };
  const panFor = (midi, width) => {
    try { const p = ctx.createStereoPanner(); p.pan.value = clamp((midi - 62) / 30, -1, 1) * (width || 0.35); return p; } catch { return ctx.createGain(); }
  };
  const sendTo = (node, bus, amt) => { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(bus); };

  /* ------------------------------- ИНСТРУМЕНТЫ ------------------------------- */
  /* Рояль. Раньше под именем piano() играла пила с квадратом — то есть каждый трек
     саундтрека, что бы ни было написано в его аранжировке, звучал одним и тем же
     синтезаторным плаком. Теперь это настоящий фортепианный голос: собственная
     волна с фортепианным набором обертонов, две слегка расстроенные «струны»
     (отсюда живое биение), стук молоточка в атаке и двухступенчатое затухание —
     быстрый спад первых миллисекунд и длинный хвост, который у басов тянется
     дольше, чем у верхов. Старый синтезаторный голос никуда не делся, он живёт
     отдельно под именем synth() — там, где синтвейв нужен осознанно. */
  let pianoWave = null;
  const ensurePianoWave = () => {
    if (pianoWave || !ctx) return pianoWave;
    // амплитуды обертонов, снятые с характера рояля: сильная первая и вторая,
    // быстро убывающие верхние — отсюда «деревянный», а не «жужжащий» тембр
    const amps = [0, 1, 0.58, 0.36, 0.26, 0.17, 0.11, 0.082, 0.058, 0.04, 0.028, 0.02, 0.014, 0.01];
    const real = new Float32Array(amps.length);
    const imag = new Float32Array(amps.length);
    amps.forEach((a, i) => { imag[i] = a; });
    try { pianoWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false }); }
    catch { pianoWave = null; }
    return pianoWave;
  };
  const piano = (t, midi, vel, sustain) => {
    const f = hz(midi);
    if (f > 5000 || f < 25) return;
    // низкие струны звучат дольше высоких — это и создаёт ощущение инструмента,
    // а не одинаково обрубленных нот
    const pitchLen = clamp(2.6 - (midi - 36) * 0.022, 0.55, 2.6);
    const dec = clamp(pitchLen * (sustain || 1), 0.16, 3.4);
    const out = ctx.createGain(); out.gain.value = 0.105 * vel;
    const pan = panFor(midi, 0.28); out.connect(pan); pan.connect(pianoBus);
    sendTo(out, verbIn, track.reverb * 0.5);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.6;
    filt.frequency.setValueAtTime(Math.min(12000, f * 11 + 1400), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 3.2, 950), t + dec * 0.55);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    // двухступенчатое затухание: резкий спад молоточка, затем долгий хвост струны
    g.gain.exponentialRampToValueAtTime(0.42, t + Math.min(0.16, dec * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    g.connect(filt);
    const wave = ensurePianoWave();
    [[0, 0.62], [vel > 0.6 ? 3.5 : 2.2, 0.38]].forEach(([det, amp]) => {
      const o = ctx.createOscillator();
      if (wave) o.setPeriodicWave(wave); else o.type = 'triangle';
      o.frequency.value = f; o.detune.value = det;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dec + 0.06);
    });
    // стук молоточка по струне: короткий полосовой шум, громче при сильной ноте
    const hs = ctx.createBufferSource(); hs.buffer = noiseBuf;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(6500, f * 3.2); hf.Q.value = 0.9;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.030 * vel * vel, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    hs.connect(hf); hf.connect(hg); hg.connect(out); hs.start(t); hs.stop(t + 0.07);
  };
  // Синт-лид: прежний голос движка — пила с квадратом, суб-осциллятором и
  // нисходящим фильтром. Остаётся для пьес, где синтезатор — осознанный выбор.
  const synth = (t, midi, vel, sustain, maxParts) => {
    const f = hz(midi);
    if (f > 5000 || f < 25) return;
    const dec = clamp(0.85 * (sustain || 1), 0.14, 3.0);
    const out = ctx.createGain(); out.gain.value = 0.095 * vel;
    const pan = panFor(midi); out.connect(pan); pan.connect(pianoBus);
    sendTo(out, verbIn, track.reverb * 0.45);
    sendTo(out, echo, 0.22);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 3.5;
    filt.frequency.setValueAtTime(Math.min(9500, f * 7 + 600), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t + dec * 0.7);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    g.connect(filt);
    const maxN = maxParts || 8;
    [[1, 'sawtooth', 0, 0.5], [1, 'square', 7, 0.34], [0.5, 'sine', 0, Math.min(0.4, maxN / 20)]].forEach(([mul, wave, det, amp]) => {
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f * mul; o.detune.value = det;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dec + 0.05);
    });
    const hs = ctx.createBufferSource(); hs.buffer = noiseBuf;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(7000, f * 4); hf.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.020 * vel * vel, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    hs.connect(hf); hf.connect(hg); hg.connect(out); hs.start(t); hs.stop(t + 0.06);
  };
  /* Бас-гитара. Раньше басовую линию играл тот же piano() вполсилы — то есть баса
     как отдельного инструмента в движке просто не было. Здесь он свой: синус на
     фундаменте, поверх — фильтрованная пила с быстрым фильтр-спадом (щипок
     пальцем), сверху короткий призвук струны о лад. */
  const bass = (t, midi, dur, vel) => {
    const f = hz(midi);
    if (f < 20 || f > 700) return;
    const out = ctx.createGain(); out.gain.value = 0.18 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.12);
    const d = clamp(dur, 0.08, 1.6);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 4.5;
    filt.frequency.setValueAtTime(Math.min(2600, f * 12), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 90), t + Math.min(0.22, d * 0.6));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.55, t + Math.min(0.12, d * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f;
    const subG = ctx.createGain(); subG.gain.value = 0.85;
    sub.connect(subG); subG.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = 5;
    const oG = ctx.createGain(); oG.gain.value = 0.42;
    o.connect(oG); oG.connect(g);
    sub.start(t); sub.stop(t + d + 0.05); o.start(t); o.stop(t + d + 0.05);
    // призвук струны о порожек — то, по чему бас-гитара и узнаётся
    const cl = ctx.createBufferSource(); cl.buffer = noiseBuf;
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1400; cf.Q.value = 1.1;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.022 * vel, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    cl.connect(cf); cf.connect(cg); cg.connect(out); cl.start(t); cl.stop(t + 0.05);
  };
  // Плак для аккордовых фигур/арпеджио — короткая пила с нисходящим фильтром,
  // подпёртая слэп-дилеем (см. echo в ensure()) вместо арфового «звона».
  const harp = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.08 * vel;
    const pan = panFor(midi, 0.5); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.3); sendTo(out, echo, 0.3);
    const d = Math.min(dur, 0.2);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 2.5;
    filt.frequency.setValueAtTime(Math.min(8500, f * 8), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 400), t + d);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(g); o.start(t); o.stop(t + d + 0.05);
  };
  // Ретро-«колокол»: та же идея, только квадрат+пила вместо синусоидальных парциалов.
  const bell = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.075 * (vel || 1);
    const pan = panFor(midi, 0.45); out.connect(pan); pan.connect(chorusIn);
    sendTo(out, verbIn, track.reverb * 0.4); sendTo(out, echo, 0.28);
    const d = Math.min(dur, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(out);
    [[1, 'square', 0.55], [2, 'sawtooth', 0.22], [1, 'sawtooth', 0.3]].forEach(([mul, wave, amp]) => {
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f * mul;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + d + 0.05);
    });
  };
  // Синт-медь: три пилы в унисон через ФНЧ с восходящей атакой фильтра («открывающийся»
  // тембр classic synth-brass) — духовые стабы для военной/маршевой темы, единственный
  // голос в движке с настоящим фанфарным характером.
  const brass = (t, notes, dur, vel) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), t + 0.045);
    g.gain.setValueAtTime(Math.max(0.0004, vel), t + Math.max(dur - 0.09, 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 4;
    filt.frequency.setValueAtTime(480, t);
    filt.frequency.exponentialRampToValueAtTime(3600, t + 0.07);
    filt.frequency.exponentialRampToValueAtTime(1500, t + dur);
    filt.connect(g); g.connect(dry);
    sendTo(g, verbIn, track.reverb * 0.3); sendTo(g, echo, 0.12);
    notes.forEach((midi) => {
      [-6, 0, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(midi); o.detune.value = det;
        const a = ctx.createGain(); a.gain.value = 0.38 / notes.length;
        o.connect(a); a.connect(filt); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  };
  // Синт-бас: пила + суб-осциллятор на октаву ниже через резонансный ФНЧ с щелчком атаки.
  const cello = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.12 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.2);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 5;
    filt.frequency.setValueAtTime(Math.min(2400, f * 10), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 90), t + Math.min(dur, 0.2));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.setValueAtTime(1, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f / 2;
    const a2 = ctx.createGain(); a2.gain.value = 0.7;
    o1.connect(g); o2.connect(a2); a2.connect(g);
    o1.start(t); o1.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
  };
  // Второй синт-лид, ярче основного: пара расстроенных пил с вибрато — держит мелодию,
  // когда в аранжировке заявлен «violin».
  const violin = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.08 * vel;
    const pan = panFor(midi, 0.4); out.connect(pan); pan.connect(chorusIn);
    sendTo(out, verbIn, track.reverb * 0.4); sendTo(out, echo, 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + Math.min(0.04, dur * 0.2));
    g.gain.setValueAtTime(1, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
    const lg = ctx.createGain(); lg.gain.value = 5;
    lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.1);
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      lg.connect(o.detune);
      const a = ctx.createGain(); a.gain.value = 0.5;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
  };
  // Аналоговый пад: стек расстроенных пил/квадратов под медленный ФНЧ-свип — вместо
  // смычковых струнных несёт длинные гармонии.
  const strings = (t, notes, dur, level) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, level), t + dur * 0.3);
    g.gain.setValueAtTime(Math.max(0.0004, level), t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(420, t);
    filt.frequency.linearRampToValueAtTime(1300 + 900 * intensity, t + dur * 0.5);
    filt.Q.value = 0.6;
    filt.connect(g); g.connect(chorusIn);
    sendTo(g, verbIn, track.reverb * 0.6);
    notes.forEach((midi, i) => {
      [-9, 0, 9].forEach((det) => {
        const o = ctx.createOscillator(); o.type = i % 2 ? 'square' : 'sawtooth'; o.frequency.value = hz(midi + 12);
        o.detune.value = det;
        const a = ctx.createGain(); a.gain.value = 0.5 / notes.length;
        o.connect(a); a.connect(filt); o.start(t); o.stop(t + dur + 0.2);
      });
    });
  };
  // Яркий PWM-пад (два квадрата на голос, разведённых по detune с медленным LFO) — вместо
  // формантного «хора» несёт верхний слой гармонии там, где заявлен «choir».
  const choir = (t, notes, dur, level) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, level * 0.9), t + dur * 0.35);
    g.gain.setValueAtTime(Math.max(0.0004, level * 0.9), t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(chorusIn); sendTo(g, verbIn, track.reverb * 0.65);
    notes.forEach((midi, i) => {
      const f = hz(midi + 12);
      const a = ctx.createGain(); a.gain.value = 0.4 / notes.length;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3 + i * 0.05;
      const lg = ctx.createGain(); lg.gain.value = 6;
      lfo.start(t); lfo.stop(t + dur + 0.2);
      [-8, 8].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.detune.value = det;
        lg.connect(o.detune); lfo.connect(lg);
        o.connect(a); o.start(t); o.stop(t + dur + 0.2);
      });
      a.connect(g);
    });
  };
  // Синт-том вместо литавры: короткий питч-свип синусоиды.
  const timpani = (t, midi, vel) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hz(midi) * 2.2, t); o.frequency.exponentialRampToValueAtTime(hz(midi) * 0.9, t + 0.12);
    g.gain.setValueAtTime(0.15 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(dry); sendTo(g, verbIn, 0.25); o.start(t); o.stop(t + 0.35);
  };
  const noiseHit = (t, dur, gain, type, freq, q, bus) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || dry); src.start(t); src.stop(t + dur + 0.05);
  };
  /* УДАРНЫЕ. Раньше это были три ноты без динамики: бочка, шум-снейр и шум-хэт,
     всегда одной громкости. Теперь у каждого удара есть velocity, у бочки — тело и
     щелчок колотушки, у снейра — пружина, а к набору добавились том и райд, без
     которых не сыграть ни сбивку, ни джазовый грув. */
  const kick = (t, vel) => {
    const v = clamp(vel, 0.1, 1.4);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.055);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.38);
    // щелчок колотушки — то, за счёт чего бочка слышна в миксе, а не только ощущается
    noiseHit(t, 0.010, 0.055 * v, 'bandpass', 2600, 1.4);
  };
  const snare = (t, vel) => {
    const v = clamp(vel, 0.05, 1.4);
    // тело барабана — две расстроенные головки
    [188, 242].forEach((fr, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(fr, t);
      o.frequency.exponentialRampToValueAtTime(fr * 0.82, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((i ? 0.022 : 0.034) * v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.12);
    });
    // пружина: два слоя шума, длинный и короткий
    noiseHit(t, 0.11 + 0.05 * v, 0.070 * v, 'bandpass', 1900, 0.9);
    noiseHit(t + 0.004, 0.055, 0.045 * v, 'highpass', 4200, 0.7);
  };
  // Том — нужен и для сбивок, и для маршевой дроби
  const tom = (t, midi, vel) => {
    const f = hz(midi);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.35, t); o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(dry); sendTo(g, verbIn, track.reverb * 0.3);
    o.start(t); o.stop(t + 0.38);
    noiseHit(t, 0.04, 0.018 * vel, 'bandpass', 900, 0.8);
  };
  // Хэт с динамикой: закрытый щелчок, открытый «шшш» — и тихие призрачные удары
  const hat = (t, open, vel) => {
    const v = clamp(vel === undefined ? 1 : vel, 0.1, 1.4);
    noiseHit(t, open ? 0.16 : 0.036, (open ? 0.024 : 0.028) * v, 'highpass', open ? 7200 : 8800, 1.4);
    if (!open) noiseHit(t, 0.012, 0.010 * v, 'bandpass', 11000, 2.0);
  };
  // Райд: металлический звон с длинным хвостом — без него джазовый грув не собрать
  const ride = (t, vel) => {
    const v = clamp(vel, 0.1, 1.4);
    noiseHit(t, 0.42, 0.011 * v, 'highpass', 6200, 0.8);
    [3140, 4270, 5630].forEach((fr, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.006 * v / (i + 1), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 - i * 0.1);
      o.connect(g); g.connect(dry); sendTo(g, verbIn, track.reverb * 0.25);
      o.start(t); o.stop(t + 0.6);
    });
  };

  /* Мягкий клиппинг для гитары и нового баса тоталитарного режима — ни один другой
     голос в движке им не пользуется, поэтому у этих двух треков не может быть звучания,
     похожего на остальной саундтрек. */
  const distCurve = (() => {
    const n = 1024; const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 3.2); }
    return curve;
  })();
  // Дисторшн-гитара: пила через waveshaper с кабинетным ФНЧ и серединным пиком.
  // power=true — режущий «пауэр-аккорд» (терция + квинта), false — сольная линия.
  const guitar = (t, midi, dur, vel, power) => {
    const notes = power ? [midi, midi + 7] : [midi];
    const out = ctx.createGain(); out.gain.value = 0.10 * vel;
    const pan = panFor(midi, 0.3); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.25); sendTo(out, echo, 0.18);
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3200; cab.Q.value = 0.7;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 1.1; mid.gain.value = 4;
    cab.connect(mid); mid.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.setValueAtTime(1, t + Math.max(0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(cab);
    notes.forEach((m) => {
      const shaper = ctx.createWaveShaper(); shaper.curve = distCurve; shaper.oversample = '2x';
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m);
      const pre = ctx.createGain(); pre.gain.value = 2.6;
      o.connect(pre); pre.connect(shaper); shaper.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
  };
  // Новый бас, отдельный от cello/piano-баса: суб-синус на октаву ниже плюс расстроенная
  // пила через тот же дисторшн, что и guitar — тяжёлый, давящий низ без «щелчка» атаки.
  const growl = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.16 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.15);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 2;
    filt.frequency.setValueAtTime(Math.min(900, f * 5), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.4, 70), t + Math.min(dur, 0.25));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2;
    sub.connect(g);
    const shaper = ctx.createWaveShaper(); shaper.curve = distCurve; shaper.oversample = '2x';
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const pre = ctx.createGain(); pre.gain.value = 1.8;
    const distAmt = ctx.createGain(); distAmt.gain.value = 0.6;
    o.connect(pre); pre.connect(shaper); shaper.connect(distAmt); distAmt.connect(g);
    sub.start(t); sub.stop(t + dur + 0.05); o.start(t); o.stop(t + dur + 0.05);
  };
  // Маримба: синус с треугольным «стуком» атаки и очень быстрым затуханием — тёплый
  // деревянный щелчок, совсем другой характер, чем звонкие bell()/harp(); настоящий
  // мэллет-тембр для джазовых и лаунж-пьес вместо синтвейвового пэда.
  const marimba = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.11 * vel;
    const pan = panFor(midi, 0.4); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.35);
    const d = Math.min(dur, 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 4;
    const a2 = ctx.createGain();
    a2.gain.setValueAtTime(0.35 * vel, t); a2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o1.connect(g); o2.connect(a2); a2.connect(out);
    o1.start(t); o1.stop(t + d + 0.05); o2.start(t); o2.stop(t + 0.08);
  };
  // Нейлоновая гитара: щипок без дисторшна — треугольник с расстроенной пилой под
  // быстро закрывающимся ФНЧ. Единственный «акустический», чистый щипковый голос
  // движка — фолковый/акустический характер вместо синтвейвовых пэдов и арпеджио.
  const nylon = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.10 * vel;
    const pan = panFor(midi, 0.35); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.3); sendTo(out, echo, 0.1);
    const d = Math.min(dur, 0.9);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(Math.min(5200, f * 6), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 300), t + d * 0.6);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 4;
    const a2 = ctx.createGain(); a2.gain.value = 0.3;
    o.connect(g); o2.connect(a2); a2.connect(g);
    o.start(t); o.stop(t + d + 0.05); o2.start(t); o2.stop(t + d + 0.05);
  };

  /* ------------------------------- СЕКВЕНСОР ------------------------------- */
  /* Атмосферный слой: низкий гул, «ветер» и сердцебиение под музыкой */
  let amb = null; let heartTimer = null;
  const ensureAmb = () => {
    if (amb || !ctx) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(musicBus);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.8; f.connect(g);
    const a1 = ctx.createOscillator(); a1.type = 'sine'; a1.frequency.value = 41.2;
    const a2 = ctx.createOscillator(); a2.type = 'sawtooth'; a2.frequency.value = 41.2; a2.detune.value = 8;
    const ag = ctx.createGain(); ag.gain.value = 0.5;
    a1.connect(f); a2.connect(ag); ag.connect(f); a1.start(); a2.start();
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320;
    const wg = ctx.createGain(); wg.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(wg.gain); lfo.start();
    wind.connect(wf); wf.connect(wg); wg.connect(g); wind.start();
    amb = { gain: g, filter: f, oscB: a2, wind: wf };
  };
  const heartbeat = () => {
    if (!ctx || !amb) return;
    const t = now();
    [0, 0.26].forEach((d, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(58, t + d); o.frequency.exponentialRampToValueAtTime(30, t + d + 0.12);
      g.gain.setValueAtTime(i ? 0.05 : 0.075, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
      o.connect(g); g.connect(musicBus); o.start(t + d); o.stop(t + d + 0.35);
    });
  };
  const stepDur = () => 60 / (track.bpm * tempoMod) / 4;
  const accent = (pos) => (pos === 0 ? 1 : pos % 8 === 0 ? 0.92 : pos % 4 === 0 ? 0.84 : 0.72);

  const setTrack = (id) => {
    if (!TRACKS[id]) return;
    track = TRACKS[id]; sectionPlan = plan(track); formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);
    stepIdx = 0; notify();
  };
  const advancePlaylist = (forward) => {
    const list = listOf(lockedMood || mood);
    playlistIdx = (playlistIdx + (forward === false ? -1 : 1) + list.length) % list.length;
    pending = list[playlistIdx];
  };

  /* Басовые фигуры. Раньше бас во всех без исключения пьесах играл одну и ту же
     ломаную восьмыми — отсюда и ощущение однообразия сильнее всего. Теперь рисунок
     выбирает сама пьеса: рок гонит ровные восьмые, джаз ходит четвертями по тонам
     аккорда, баллада держит половинки, а фанк дышит синкопой. [шаг, ступень]. */
  const BASS_LINES = {
    drive: [[0, 0], [2, 0], [4, 7], [6, 0], [8, 0], [10, 12], [12, 7], [14, 0]],
    walk: [[0, 0], [4, 4], [8, 7], [12, 9]],
    root: [[0, 0], [6, 0], [8, 7], [14, 7]],
    half: [[0, 0], [8, 7]],
    synco: [[0, 0], [3, 0], [6, 7], [8, 12], [11, 7], [14, 0]],
    pulse8: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [14, 0]],
  };
  // человеческая неровность: одинаковая громкость у всех ударов — первое, по чему
  // слышно, что играет не живой барабанщик, а сетка
  const humanVel = (base) => base * (0.86 + Math.random() * 0.2);

  const scheduleStep = (idx, t) => {
    const totalSteps = formBars * 16;
    const i = ((idx % totalSteps) + totalSteps) % totalSteps;
    const bar = Math.floor(i / 16); const pos = i % 16;
    const sc = sectionPlan.find((x) => bar >= x.start && bar < x.start + x.bars) || sectionPlan[0];
    const harmony = track[sc.h];
    const barIn = bar - sc.start;
    const voicing = harmony[barIn % harmony.length];
    const melody = track[sc.mel] || [];
    const stepIn = barIn * 16 + pos;
    const sd = stepDur();
    const arr = sc.arr;
    const has = (k) => arr.indexOf(k) >= 0;
    const dyn = sc.dyn * (0.88 + 0.18 * intensity);
    const lastBarOfSection = barIn === sc.bars - 1;

    // гармония
    if (pos === 0) {
      if (has('pad')) strings(t, voicing.slice(1, 3), sd * 16 * 0.96, 0.055 * dyn);
      if (has('choir')) choir(t, voicing.slice(1), sd * 16 * 0.94, 0.05 * dyn);
      if (has('strings')) strings(t, voicing.slice(1, 4), sd * 16 * 0.92, 0.042 * dyn);
      if (has('timpani') && (bar % 2 === 0)) timpani(t, voicing[0] - 12, 0.8 * dyn);
    }
    // духовые стабы на каждую четверть — маршевое «ум-па», а не длинная педаль
    if (has('brass') && pos % 4 === 0) brass(t, voicing.slice(0, 3), sd * 3.4, 0.1 * dyn);
    // гитарный «чуг» на каждую четверть — тот же маршевый приём, что и духовые стабы,
    // но режущий и жёсткий: собственный узнаваемый ритм тоталитарного саундтрека
    if (has('guitar') && has('growl') && pos % 4 === 0) guitar(t, voicing[0], sd * 3.4, 0.11 * dyn, true);
    // бой акустической гитары: перебор аккорда восьмыми со сменой направления
    if (has('strum') && pos % 2 === 0) {
      const dirDown = (pos / 2) % 2 === 0;
      const order = dirDown ? [0, 1, 2, 3] : [3, 2, 1, 0];
      order.forEach((k, n) => {
        const note = voicing[k % voicing.length] + (k > 1 ? 12 : 0);
        nylon(t + n * 0.011 + jitter() * 0.4, note, sd * 3.2, (dirDown ? 0.5 : 0.34) * dyn);
      });
    }
    // бас
    const bassFig = BASS_LINES[track.bassLine || 'drive'] || BASS_LINES.drive;
    bassFig.forEach(([st, deg]) => {
      if (st !== pos) return;
      const root = voicing[0] - 12;
      const note = root + deg;
      const vel = (pos === 0 ? 1.0 : pos % 8 === 0 ? 0.82 : pos % 4 === 0 ? 0.7 : 0.56) * dyn;
      const len = sd * (track.bassLine === 'walk' ? 3.6 : track.bassLine === 'half' ? 7 : 1.9);
      if (has('growl')) growl(t, note, len, vel);
      else if (has('cello')) cello(t, note, len, vel);
      else if (has('bass')) bass(t + jitter() * 0.5, note, len, vel);
    });
    // арпеджио по аккорду шестнадцатыми — накладывается на «полные» секции без
    // собственной арпеджио-партии в аранжировке, характерный слой синтвейва
    if (has('pad') && !has('harp') && !has('strum')) {
      const arpDeg = [1, 2, 3, 2][(pos / 2) % 4];
      if (pos % 2 === 0) harp(t + jitter(), voicing[arpDeg % voicing.length] + 12, sd * 2.2, 0.3 * dyn);
    }
    // фигура левой руки
    const fig = LH[sc.lh] || LH.flow;
    fig.forEach(([st, deg]) => {
      if (st !== pos) return;
      const vel = (0.38 + 0.16 * accent(pos)) * dyn;
      const note = voicing[deg % voicing.length];
      if (has('harp')) harp(t + jitter(), note + 12, sd * 6, vel);
      if (has('piano')) piano(t + jitter(), note, vel, track.bpm > 100 ? 0.7 : sc.lh === 'sustain' ? 1.15 : 0.95);
      else if (has('synth')) synth(t + jitter(), note, vel, track.bpm > 100 ? 0.55 : sc.lh === 'sustain' ? 1.0 : 0.85, sc.lh === 'sustain' ? 4 : 5);
      else if (has('nylon') && !has('strum')) nylon(t + jitter(), note + 12, sd * 4.5, vel);
      else if (has('marimba')) marimba(t + jitter(), note + 12, sd * 3, vel * 0.9);
      else if (has('bells') && !has('harp') && (st % 4 === 0)) bell(t, note + 12, sd * 6, 0.6 * vel);
    });
    // мелодия
    melody.forEach(([st, midi, dur]) => {
      if (st !== stepIn) return;
      const vel = (0.78 + 0.20 * accent(pos)) * dyn;
      if (has('violin')) violin(t, midi, sd * dur * 1.05, vel);
      if (has('bells')) bell(t, midi, sd * dur * 1.7, vel * 0.9);
      if (has('lead')) synth(t + jitter(), midi, vel, 1.1, 8);
      if (has('guitar') && !has('violin') && !has('bells') && !has('lead')) guitar(t + jitter(), midi, sd * dur * 0.9, vel * 0.7, false);
      if (has('marimba') && !has('violin') && !has('bells') && !has('guitar') && !has('lead')) marimba(t + jitter(), midi, sd * dur * 0.8, vel * 0.85);
      if (has('nylon') && !has('violin') && !has('bells') && !has('guitar') && !has('marimba') && !has('lead')) nylon(t + jitter(), midi, sd * dur * 0.9, vel * 0.8);
      if (!has('violin') && !has('bells') && !has('guitar') && !has('marimba') && !has('nylon') && !has('lead')) {
        piano(t + jitter(), midi, Math.min(1, vel), 1.25);
        if (dur >= 8 && track.mood !== 'crisis') piano(t + jitter(), midi - 12, vel * 0.32, 0.9);
      } else if (has('piano') && has('violin')) {
        piano(t + jitter(), midi, vel * 0.5, 1.0);
      }
    });
    // ударные
    const d = sc.drums;
    if (d) {
      const power = (0.75 + 0.3 * intensity) * dyn;
      // сбивка в последнем такте секции: барабанщик объявляет смену, а не молча
      // доигрывает один и тот же такт по кругу
      const fillBar = lastBarOfSection && sc.bars >= 4 && d.fill !== false;
      if (fillBar && pos >= 8) {
        const TOMS = [52, 50, 47, 43];
        if (pos % 2 === 0) tom(t, TOMS[Math.min(3, Math.floor((pos - 8) / 2))], humanVel(power * 0.95));
        if (pos === 15) snare(t, humanVel(power * 1.1));
        if (pos === 8) kick(t, humanVel(power));
      } else {
        d.kick.forEach(([st]) => { if (st === pos) kick(t, humanVel(power)); });
        d.snare.forEach(([st]) => { if (st === pos) snare(t, humanVel(power)); });
        d.hat.forEach(([st, c]) => {
          if (st !== pos) return;
          if (c === 'r') ride(t, humanVel(power * 0.8));
          else hat(t, c === 'O', humanVel(pos % 4 === 0 ? power : power * 0.62));
        });
        // призрачные удары малого между долями — то, что отличает грув от метронома
        if (d.ghost && pos % 4 === 2 && Math.random() < 0.45) snare(t, power * 0.18);
      }
    }
  };

  const scheduler = () => {
    if (!ctx || !running) return;
    if (nextTime < now() - 0.4) nextTime = now() + 0.06;
    let guard = 0;
    while (nextTime < now() + 0.22 && guard++ < 24) {
      const totalSteps = formBars * 16;
      if (stepIdx % 16 === 0 && pending && pending !== track.id) {
        setTrack(pending); pending = null;
        if (musicBus) {
          musicBus.gain.setTargetAtTime(opts.music ? 0.18 : 0, now(), 0.12);
          musicBus.gain.setTargetAtTime(opts.music ? 0.55 : 0, now() + 0.7, 0.7);
        }
      }
      if (stepIdx > 0 && stepIdx % totalSteps === 0) advancePlaylist(true);   // пьеса сыграна целиком
      const sd = stepDur();
      /* Свинг по характеру пьесы, а не один на всех: синтвейву и маршу нужна ровная
         механическая сетка, а джазу и лаунжу — та самая неровность восьмых, без
         которой они звучат как упражнение из учебника. */
      const feelK = track.feel === 'swing' ? 1 : track.feel === 'loose' ? 0.6 : 0.3;
      const swing = (stepIdx % 2 === 1) ? track.swing * sd * feelK : 0;
      scheduleStep(stepIdx, nextTime + swing);
      nextTime += sd; stepIdx += 1;
    }
  };

  /* ---------------------------- ЗВУКИ ИНТЕРФЕЙСА ---------------------------- */
  const tone = (freq, t0, dur, gain, wave) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = wave || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const SFX = {
    tick: () => tone(1250, now(), 0.035, 0.028, 'triangle'),
    click: () => { const t = now(); tone(760, t, 0.05, 0.045, 'square'); tone(1140, t + 0.015, 0.05, 0.025, 'triangle'); },
    tab: () => tone(560, now(), 0.06, 0.032, 'triangle'),
    paper: () => { const t = now(); noiseHit(t, 0.28, 0.055, 'bandpass', 2600, 0.7, sfxBus); noiseHit(t + 0.09, 0.22, 0.035, 'bandpass', 3400, 0.9, sfxBus); },
    stamp: () => {
      const t = now(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.35);
      noiseHit(t, 0.09, 0.08, 'bandpass', 1800, 0.6, sfxBus);
    },
    up: () => { const t = now(); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.075, 0.4, 0.04, 'triangle')); },
    down: () => { const t = now(); [659.25, 523.25, 392.0].forEach((f, i) => tone(f, t + i * 0.085, 0.45, 0.04, 'triangle')); },
    alarm: () => { const t = now(); [0, 0.22, 0.44].forEach((d) => { tone(233, t + d, 0.18, 0.06, 'square'); tone(175, t + d + 0.09, 0.18, 0.05, 'square'); }); },
    news: () => { const t = now(); tone(1500, t, 0.04, 0.025, 'sine'); tone(2100, t + 0.05, 0.05, 0.02, 'sine'); },
    coin: () => { const t = now(); tone(988, t, 0.09, 0.035, 'triangle'); tone(1319, t + 0.05, 0.16, 0.03, 'triangle'); },
  };

  return {
    opts,
    trackName: () => track.name,
    nowPlaying: () => ({ id: track.id, name: track.name, subtitle: track.subtitle, mood: track.mood,
      moodLabel: MOOD_LABEL[track.mood], bpm: Math.round(track.bpm * tempoMod), locked: lockedMood }),
    playlist: () => listOf(lockedMood || mood).map((id) => ({ id, name: TRACKS[id].name, current: id === track.id })),
    setRole(id) {
      if (roleId === id) return;
      roleId = id || null;
      playlistIdx = 0;
      if (!lockedMood) { pending = listOf(mood)[0]; notify(); }
    },
    onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    skip(forward) { if (!ensure()) return; resume(); advancePlaylist(forward); if (!running) this.startMusic(); },
    playTrack(id) { if (!ensure()) return; resume(); pending = id; const list = listOf(lockedMood || mood); const i = list.indexOf(id); if (i >= 0) playlistIdx = i; if (!running) this.startMusic(); },
    setPlaylist(moodId) {
      lockedMood = moodId || null;
      const list = MOOD_PLAYLISTS[lockedMood || mood] || MOOD_PLAYLISTS.calm;
      playlistIdx = 0; pending = list[0]; notify();
      if (!running && opts.music) this.startMusic();
    },
    prime() { const c = ensure(); if (c) resume(); return !!c; },
    // «контекст уже создан и играет» — без создания нового: до первого действия
    // человека браузер всё равно держал бы его выключенным
    primed: () => !!ctx && ctx.state === 'running',
    play(name) {
      if (!opts.sfx) return;
      if (name === 'tick') { const t = Date.now(); if (t - lastTick < 70) return; lastTick = t; }
      if (!ensure()) return; resume();
      const fn = SFX[name]; if (fn) { try { fn(); } catch { /* тишина важнее падения */ } }
    },
    startMusic() {
      if (!ensure()) return; resume();
      if (running || !opts.music) return;
      running = true; stepIdx = 0; nextTime = now() + 0.2;
      if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 1.5);
      timer = setInterval(() => { try { scheduler(); } catch { /* музыка не ломает игру */ } }, 40);
      notify();
    },
    stopMusic() {
      running = false;
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (musicBus) musicBus.gain.setTargetAtTime(0.0001, now(), 0.3);
      notify();
    },
    setMusic(on) {
      opts.music = on;
      if (!ensure()) return;
      if (on) { if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 0.5); this.startMusic(); } else this.stopMusic();
    },
    setSfx(on) { opts.sfx = on; if (ensure() && sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.1); },
    setVolume(v) { opts.volume = v; if (ensure() && master) master.gain.setTargetAtTime(v, now(), 0.1); },
    setAmbience(regime, k) {
      if (!ensure()) return;
      ensureAmb();
      if (!amb) return;
      const crisis = ['banking', 'debt', 'currency', 'stagflation'].indexOf(regime) >= 0;
      const lvl = crisis ? 0.055 + 0.075 * k : regime === 'recession' ? 0.026 : regime === 'overheating' ? 0.018 : 0.005;
      amb.gain.gain.setTargetAtTime(lvl, now(), 2.2);
      amb.filter.frequency.setTargetAtTime(crisis ? 180 + 260 * k : 120, now(), 2.5);
      amb.oscB.detune.setTargetAtTime(crisis ? 20 + 14 * k : 6, now(), 2.5);
      amb.wind.frequency.setTargetAtTime(crisis ? 420 + 300 * k : 260, now(), 2.5);
      if (crisis && k > 0.5) {
        if (!heartTimer) heartTimer = setInterval(() => { try { heartbeat(); } catch { /* тихо */ } }, 1700);
      } else if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
    },
    setMood(e) {
      // тоталитарный режим переопределяет настроение саундтрека независимо от того,
      // что творится с экономикой — власть куда навязчивее любого экономического цикла
      const m = e.politicalRegime === 'totalitarian' ? 'totalitarian' : (REGIME_MOOD[e.regime] || 'calm');
      intensity = clamp((e.inflationRisk * 0.3 + e.bankingRisk * 0.3 + e.debtRisk * 0.2 + e.recessionRisk * 0.2) / 100, 0, 1);
      tempoMod = clamp(0.95 + (e.gdpGrowth - 2.0) * 0.012 + intensity * 0.05, 0.9, 1.1);
      this.setAmbience(e.regime, intensity);
      if (m !== mood) {
        mood = m; playlistIdx = 0;
        if (!lockedMood) { pending = listOf(m)[0]; notify(); }
      }
    },
    quarterSequence({ wellbeingDelta, newCrisis, bigNews }) {
      if (!opts.sfx) return;
      if (!ensure()) return; resume();
      SFX.stamp();
      setTimeout(() => { if (bigNews) SFX.news(); }, 240);
      setTimeout(() => {
        if (newCrisis) SFX.alarm();
        else if (wellbeingDelta > 0.6) SFX.up();
        else if (wellbeingDelta < -0.6) SFX.down();
      }, 430);
    },
  };
})();

/* Общая логика для выпадающих панелей в шапке (звук, вид): не даёт двум
   открыться одновременно и накрыть друг друга, и считает позицию от кнопки
   через getBoundingClientRect + fixed — на телефоне, где шапка переносится
   на новую строку, обычный position:absolute+right:0 может унести панель
   за край экрана, потому что «правый край» отсчитывается не от кнопки. */
let dropdownActiveId = 0;
let dropdownSeq = 0;
const dropdownListeners = new Set();
function useExclusiveDropdown(width) {
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

function AudioControls() {
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
            <span className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft }}>Саундтрек</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{np.moodLabel} · {np.bpm} BPM</span>
            {/* на телефоне «ткнуть мимо» — не очевидный способ закрыть панель */}
            <button className="ems-btn" style={{ padding: '3px 5px', lineHeight: 0 }} aria-label="Закрыть"
              onClick={() => { Audio.play('click'); setOpen(false); }}><X size={12} /></button>
          </div>
          <div style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '9px 10px', marginBottom: 9 }}>
            <div className="ems-serif" style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.2 }}>{np.name}</div>
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 2 }}>{np.subtitle}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <button className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }} onClick={() => { Audio.play('tick'); Audio.skip(false); }}>◀ пред.</button>
              <button className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }} onClick={() => { Audio.play('tick'); Audio.skip(true); }}>след. ▶</button>
            </div>
          </div>
          {list.length > 1 && (
            <div style={{ marginBottom: 9, maxHeight: 116, overflowY: 'auto' }} className="ems-scroll">
              {list.map((x) => (
                <div key={x.id} onClick={() => { Audio.play('tick'); Audio.playTrack(x.id); }}
                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 2, cursor: 'pointer',
                    color: x.current ? COLOR.goldSoft : COLOR.muted, background: x.current ? COLOR.goldDim : 'transparent' }}>
                  {x.current ? '♪ ' : '   '}{x.name}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 10.5, color: COLOR.muted, marginBottom: 4 }}>Что играть</div>
            <select className="ems-btn" value={np.locked || 'auto'} style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}
              onChange={(e) => { Audio.play('tab'); Audio.setPlaylist(e.target.value === 'auto' ? null : e.target.value); }}>
              {moods.map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
            </select>
          </div>
          {[['Музыка', music, (v) => { setMusic(v); Audio.setMusic(v); }, Music],
            ['Интерфейс и события', sfx, (v) => { setSfx(v); Audio.setSfx(v); if (v) Audio.play('click'); }, Volume2]].map(([label, val, set, Icon]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <Icon size={12} color={val ? COLOR.gold : COLOR.faint} />
                <span style={{ fontSize: 11.5, color: val ? COLOR.text : COLOR.muted, flex: 1 }}>{label}</span>
                <button className="ems-btn" style={{ padding: '2px 9px', fontSize: 10.5, background: val ? COLOR.gold : COLOR.panelAlt, color: val ? COLOR.ink : COLOR.muted, borderColor: val ? COLOR.gold : COLOR.border }}
                  onClick={() => set(!val)}>{val ? 'вкл' : 'выкл'}</button>
              </div>
            ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 11, color: COLOR.muted, width: 54 }}>Громкость</span>
            <input type="range" className="ems-slider" min={0} max={1} step={0.05} value={vol}
              onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); Audio.setVolume(v); }} />
          </div>
          <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
            {Object.keys(TRACKS).length} пьес в {new Set(Object.values(TRACKS).map((t) => t.mood)).size} настроениях. Каждая состоит из нескольких частей с разной оркестровкой и доигрывается до конца, прежде чем уступить место следующей.
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ НОВОСТНАЯ ПОДСИСТЕМА ============================ */
const NEWS_CATEGORIES = [
  { id: 'cb', label: 'Центральный банк', short: 'ЦБ', icon: '🏦', color: COLOR.blue },
  { id: 'gov', label: 'Правительство', short: 'Правительство', icon: '🏛', color: COLOR.gold },
  { id: 'markets', label: 'Рынки', short: 'Рынки', icon: '📊', color: COLOR.teal },
  { id: 'business', label: 'Бизнес', short: 'Бизнес', icon: '🏭', color: '#8E7CC3' },
  { id: 'households', label: 'Население', short: 'Население', icon: '👥', color: COLOR.goldSoft },
  { id: 'world', label: 'Мир', short: 'Мир', icon: '🌍', color: '#6FA8A0' },
  { id: 'opinion', label: 'Мнения', short: 'Мнения', icon: '💬', color: '#C08A6B' },
  { id: 'crisis', label: 'Кризис', short: 'Кризис', icon: '⚠️', color: COLOR.rust },
  { id: 'editorial', label: 'Сводка', short: 'Сводка', icon: '📰', color: COLOR.muted },
];
const CATMAP = {};
NEWS_CATEGORIES.forEach((c) => { CATMAP[c.id] = c; });
const catOf = (id) => CATMAP[id] || CATMAP.markets;

function ChainTrail({ chain, compact }) {
  if (!chain || !chain.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 7 }}>
      {chain.map((step, i) => (
        <React.Fragment key={i}>
          <span style={{ fontSize: compact ? 9.5 : 10, padding: '2px 6px', borderRadius: 2,
            background: i === 0 ? COLOR.goldDim : COLOR.panelAlt, border: `1px solid ${i === 0 ? COLOR.gold : COLOR.border}`,
            color: i === 0 ? COLOR.goldSoft : COLOR.muted, whiteSpace: 'nowrap' }}>{step}</span>
          {i < chain.length - 1 && <span style={{ color: COLOR.faint, fontSize: 10 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function NewsItem({ item, showQuarter }) {
  const c = catOf(item.cat);
  const [open, setOpen] = useState(false);
  const hasChain = item.chain && item.chain.length > 0;
  return (
    <div style={{ borderLeft: `2px solid ${c.color}`, paddingLeft: 10, paddingBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5 }}>{c.icon}</span>
        <span style={{ fontSize: 9.5, color: c.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.short}</span>
        {showQuarter && item.qLabel && <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint }}>{item.qLabel}</span>}
        {item.storyTitle && (
          <span style={{ fontSize: 9.5, color: COLOR.faint, border: `1px solid ${COLOR.border}`, borderRadius: 2, padding: '0 4px' }}>
            сюжет «{item.storyTitle}» · {item.step}/{item.steps}
          </span>
        )}
      </div>
      <div className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, margin: '3px 0 3px', color: COLOR.text, letterSpacing: '0.01em' }}>
        {item.headline}
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>{item.text}</div>
      {hasChain && (
        <>
          <button className="ems-btn" style={{ padding: '2px 7px', fontSize: 10, marginTop: 6 }} onClick={() => { Audio.play('tick'); setOpen((o) => !o); }}>
            {open ? 'Скрыть цепочку' : 'Цепочка последствий'} {open ? <ChevronUp size={10} style={{ verticalAlign: -1 }} /> : <ChevronDown size={10} style={{ verticalAlign: -1 }} />}
          </button>
          {open && <ChainTrail chain={item.chain} />}
        </>
      )}
    </div>
  );
}

function NewsTerminal({ items, onOpenPaper }) {
  const [filter, setFilter] = useState('all');
  const present = NEWS_CATEGORIES.filter((c) => items.some((i) => i.cat === c.id));
  const list = (filter === 'all' ? items : items.filter((i) => i.cat === filter)).slice(0, 60);
  // лента растёт вставкой новых записей В НАЧАЛО массива, но скролл-позиция
  // блока сама не сбрасывается — если читали и проскроллили вниз, свежая
  // новость наверху оказывается выше видимой области и выглядит пропавшей
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = 0;
    // сброс scrollTop не помогает, если сама панель уехала за пределы видимой
    // области страницы (на телефоне «Завершить квартал» — внизу длинной
    // страницы, и после клика страница остаётся там же) — довозим панель
    // в поле зрения, но мягко: 'nearest' ничего не делает, если она и так видна
    scrollRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [items[0] && items[0].id]);
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <Newspaper size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>Экономический терминал</span>
        <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: 10.5 }} onClick={() => { Audio.play('paper'); onOpenPaper(); }}>
          Газета и хроника
        </button>
      </div>
      {present.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
          <span className={`ems-tab ${filter === 'all' ? 'active' : ''}`} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => { Audio.play('tab'); setFilter('all'); }}>Всё</span>
          {present.map((c) => (
            <span key={c.id} className={`ems-tab ${filter === c.id ? 'active' : ''}`} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => { Audio.play('tab'); setFilter(c.id); }}>
              {c.icon} {c.short}
            </span>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="ems-scroll" style={{ maxHeight: 430, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {list.length === 0 && <div style={{ fontSize: 12, color: COLOR.muted }}>Лента пуста — завершите первый квартал, и экономика начнёт рассказывать о себе сама.</div>}
        {list.map((n) => (<NewsItem key={n.id} item={n} showQuarter />))}
      </div>
    </div>
  );
}

/* Политический режим красит газету: чем дальше от демократии, тем холоднее и темнее
   бумага — это должно читаться раньше, чем игрок разберёт хоть одно слово текста. */
const mixHex = (a, b, t) => {
  const c = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const m = (i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, '0');
  return `#${m(1)}${m(3)}${m(5)}`;
};
const POLITICAL_PAPER_TARGET = {
  crisis: { paper: '#E2D9BE', paperText: '#241C12', paperMuted: '#6B5A3E', paperRule: '#8C6B3E' },
  authoritarian: { paper: '#B5AF9C', paperText: '#1C1B15', paperMuted: '#4A483C', paperRule: '#6C6755' },
  totalitarian: { paper: '#22252A', paperText: '#B7B7AC', paperMuted: '#6B6D66', paperRule: '#48493F' },
};
function politicalPaperPalette(base, economy) {
  const regime = economy && economy.politicalRegime;
  const target = POLITICAL_PAPER_TARGET[regime];
  if (!target) return base;
  const tension = clamp((economy.politicalTension || 0) / 100, 0, 1);
  const war = (economy.warQuartersLeft || 0) > 0;
  const k = regime === 'totalitarian' ? clamp(0.6 + tension * 0.3 + (war ? 0.1 : 0), 0.6, 1)
    : regime === 'authoritarian' ? clamp(0.6 + tension * 0.35, 0.6, 0.95)
      : clamp(0.18 + tension * 0.3, 0.18, 0.5); // crisis: тревожно, но ещё не мрачно
  return {
    paper: mixHex(base.paper, target.paper, k),
    paperText: mixHex(base.paperText, target.paperText, k),
    paperMuted: mixHex(base.paperMuted, target.paperMuted, k),
    paperRule: mixHex(base.paperRule, target.paperRule, k),
  };
}

/* Газета: выпуск квартала, хроника страны и сюжетные линии */
function NewspaperModal({ news, history, quarterIndex, onClose, economy }) {
  const [tab, setTab] = useState('issue');
  const quarters = useMemo(() => {
    const map = new Map();
    news.forEach((n) => { if (!map.has(n.q)) map.set(n.q, []); map.get(n.q).push(n); });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [news]);
  const latest = quarters.length ? quarters[0] : null;
  const issueItems = latest ? latest[1] : [];
  const lead = issueItems.find((n) => n.cat !== 'editorial');
  const editorial = issueItems.find((n) => n.cat === 'editorial');
  const rest = issueItems.filter((n) => n !== lead && n !== editorial);
  const snapshot = latest ? history.find((h) => h.q === latest[0]) : null;

  const stories = useMemo(() => {
    const map = new Map();
    news.slice().reverse().forEach((n) => {
      if (!n.storyId) return;
      const key = `${n.storyId}`;
      if (!map.has(key)) map.set(key, { id: key, title: n.storyTitle, steps: [] });
      map.get(key).steps.push(n);
    });
    return [...map.values()].reverse();
  }, [news]);

  const pp = politicalPaperPalette(COLOR, economy || {});
  const regimeId = economy && economy.politicalRegime;
  const PaperBox = ({ children, style }) => (
    <div style={{ background: pp.paper, color: pp.paperText, border: `1px solid ${pp.paperRule}`, padding: '18px 20px', transition: 'background 1.2s ease, color 1.2s ease, border-color 1.2s ease', ...style }}>{children}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', overflowY: 'auto' }} onClick={onClose}>
      <div className="ems-fade-in" style={{ maxWidth: 940, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <PaperBox>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px double ${pp.paperRule}`, paddingBottom: 10 }}>
            <div>
              <div className="ems-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1 }}>ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div>
              <div className="ems-mono" style={{ fontSize: 10, color: pp.paperMuted, marginTop: 6, letterSpacing: '0.08em' }}>
                ЕЖЕКВАРТАЛЬНОЕ ИЗДАНИЕ · {latest ? latest[1][0].qLabel : quarterLabel(quarterIndex)} · ВЫПУСК № {latest ? latest[0] : 0}
              </div>
              {/* Газета не объявляет режим, в котором выходит: «АВТОРИТАРНЫЙ РЕЖИМ» в
                  собственной шапке не печатает ни одно издание. Про режим говорит сама
                  бумага, тон заголовков и вот эта служебная строка выходных данных. */}
              {(regimeId === 'totalitarian' || regimeId === 'authoritarian') && (
                <div className="ems-mono" style={{ fontSize: 9.5, marginTop: 5, letterSpacing: '0.1em', color: pp.paperMuted, fontWeight: 700 }}>
                  {regimeId === 'totalitarian'
                    ? '⚑ ГОСУДАРСТВЕННОЕ ИЗДАНИЕ · РАСПРОСТРАНЯЕТСЯ ПО ПОДПИСКЕ ОБЯЗАТЕЛЬНО'
                    : 'ВЫХОДИТ ПО РАЗРЕШЕНИЮ · МАТЕРИАЛЫ СОГЛАСОВАНЫ'}
                </div>
              )}
            </div>
            <button className="ems-btn" style={{ padding: '4px 7px', background: 'transparent', color: pp.paperText, borderColor: pp.paperRule }} onClick={onClose}><X size={14} /></button>
          </div>

          <div style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${pp.paperRule}`, padding: '8px 0', marginBottom: 14 }}>
            {[['issue', 'Выпуск'], ['chronicle', 'Хроника страны'], ['stories', 'Сюжетные линии']].map(([id, label]) => (
              <span key={id} onClick={() => { Audio.play('paper'); setTab(id); }} style={{ cursor: 'pointer', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
                fontWeight: tab === id ? 700 : 400, color: tab === id ? pp.paperText : pp.paperMuted, borderBottom: tab === id ? `2px solid ${pp.paperText}` : '2px solid transparent', paddingBottom: 3 }}>{label}</span>
            ))}
          </div>

          {tab === 'issue' && (
            <div>
              {!lead && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Первый выпуск выйдет после завершения квартала.</div>}
              {lead && (
                <div style={{ borderBottom: `1px solid ${pp.paperRule}`, paddingBottom: 14, marginBottom: 14 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                    {catOf(lead.cat).icon} {catOf(lead.cat).label.toUpperCase()} · ГЛАВНАЯ ТЕМА
                  </div>
                  <div className="ems-serif" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.12, marginBottom: 8 }}>{lead.headline}</div>
                  <div className="ems-serif" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{lead.text}</div>
                  {lead.chain && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 10 }}>
                      {lead.chain.map((st, i) => (
                        <React.Fragment key={i}>
                          <span style={{ fontSize: 10.5, padding: '2px 7px', border: `1px solid ${pp.paperRule}`, color: pp.paperText }}>{st}</span>
                          {i < lead.chain.length - 1 && <span style={{ color: pp.paperMuted }}>→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {snapshot && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', border: `1px solid ${pp.paperRule}`, padding: '9px 12px', marginBottom: 14 }}>
                  {[['ВВП', fmtSignedPct(snapshot.gdpGrowth)], ['Инфляция', pctFmt(snapshot.inflation)], ['Безработица', pctFmt(snapshot.unemployment)],
                    ['Ставка', pctFmt(snapshot.keyRate)], ['Курс', fmt1(snapshot.exchangeRate)], ['Долг/ВВП', pctFmt(snapshot.debtToGdp)]].map(([k, v]) => (
                      <span key={k} className="ems-mono" style={{ fontSize: 10.5, color: pp.paperMuted }}>{k}: <b style={{ color: pp.paperText }}>{v}</b></span>
                    ))}
                </div>
              )}

              <div style={{ columnCount: 2, columnGap: 22, columnRule: `1px solid ${pp.paperRule}` }} className="ems-paper-cols">
                {rest.map((n) => (
                  <div key={n.id} style={{ breakInside: 'avoid', marginBottom: 14 }}>
                    <div className="ems-mono" style={{ fontSize: 9, color: pp.paperMuted, letterSpacing: '0.08em' }}>{catOf(n.cat).icon} {catOf(n.cat).label.toUpperCase()}</div>
                    <div className="ems-serif" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, margin: '3px 0 4px' }}>{n.headline}</div>
                    <div className="ems-serif" style={{ fontSize: 12, lineHeight: 1.55 }}>{n.text}</div>
                    {n.storyTitle && <div style={{ fontSize: 10, color: pp.paperMuted, marginTop: 4 }}>Сюжет «{n.storyTitle}», часть {n.step} из {n.steps}</div>}
                  </div>
                ))}
              </div>

              {editorial && (
                <div style={{ borderTop: `3px double ${pp.paperRule}`, marginTop: 6, paddingTop: 12 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 5 }}>ОТ РЕДАКЦИИ · СВОДКА КВАРТАЛА</div>
                  <div className="ems-serif" style={{ fontSize: 12.5, lineHeight: 1.65 }}>{editorial.text}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'chronicle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {quarters.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Хроника начнётся с первого завершённого квартала.</div>}
              {quarters.map(([q, list]) => {
                const snap = history.find((h) => h.q === q);
                const top = list.filter((n) => n.cat !== 'editorial').slice(0, 3);
                return (
                  <div key={q} style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${pp.paperRule}`, padding: '11px 0' }}>
                    <div style={{ width: 92, flexShrink: 0 }}>
                      <div className="ems-mono ems-serif" style={{ fontSize: 12, fontWeight: 700 }}>{list[0].qLabel}</div>
                      {snap && (
                        <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, lineHeight: 1.5, marginTop: 3 }}>
                          ВВП {fmtSigned1(snap.gdpGrowth)}%<br />инфл. {fmt1(snap.inflation)}%<br />безр. {fmt1(snap.unemployment)}%<br />ставка {fmt1(snap.keyRate)}%
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {top.map((n) => (
                        <div key={n.id}>
                          <span style={{ fontSize: 10 }}>{catOf(n.cat).icon} </span>
                          <span className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700 }}>{n.headline}</span>
                          <div className="ems-serif" style={{ fontSize: 11.5, color: pp.paperMuted, lineHeight: 1.45 }}>{n.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'stories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {stories.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Сюжетов пока нет. Они рождаются из шоков и ваших собственных решений — и разворачиваются несколько кварталов подряд.</div>}
              {stories.map((st) => (
                <div key={st.id} style={{ borderLeft: `2px solid ${pp.paperRule}`, paddingLeft: 14 }}>
                  <div className="ems-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Сюжет: {st.title}</div>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, marginBottom: 8 }}>
                    {st.steps[0].qLabel} — {st.steps[st.steps.length - 1].qLabel} · {st.steps.length} из {st.steps[0].steps} частей
                  </div>
                  {st.steps.map((n, i) => (
                    <div key={n.id} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                      <div style={{ width: 74, flexShrink: 0 }} className="ems-mono">
                        <div style={{ fontSize: 9.5, color: pp.paperMuted }}>{n.qLabel}</div>
                        <div style={{ fontSize: 9, color: pp.paperMuted }}>часть {i + 1}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{n.headline}</div>
                        <div className="ems-serif" style={{ fontSize: 11.5, color: pp.paperMuted, lineHeight: 1.5 }}>{n.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </PaperBox>
      </div>
    </div>
  );
}


/* ============================ АТМОСФЕРА ============================ */
const ATMOSPHERE = {
  normal: { tint: 'rgba(201,162,39,0.012)', vig: 0.16, accent: COLOR.gold, breathe: 0, grain: 0, label: 'спокойствие', urgent: false },
  overheating: { tint: 'rgba(214,146,42,0.030)', vig: 0.20, accent: '#D68E2A', breathe: 0.10, grain: 0, label: 'перегрев', urgent: false },
  recession: { tint: 'rgba(70,105,150,0.026)', vig: 0.24, accent: COLOR.blue, breathe: 0, grain: 0, label: 'спад', urgent: false },
  stagflation: { tint: 'rgba(138,120,48,0.034)', vig: 0.26, accent: '#A8913A', breathe: 0.12, grain: 0.02, label: 'стагфляция', urgent: true },
  banking: { tint: 'rgba(150,42,30,0.042)', vig: 0.30, accent: COLOR.rust, breathe: 0.20, grain: 0.035, label: 'банковский кризис', urgent: true },
  debt: { tint: 'rgba(150,42,30,0.036)', vig: 0.28, accent: COLOR.rust, breathe: 0.16, grain: 0.03, label: 'долговой кризис', urgent: true },
  currency: { tint: 'rgba(165,60,25,0.042)', vig: 0.30, accent: '#C2531F', breathe: 0.20, grain: 0.035, label: 'валютный кризис', urgent: true },
  deflation: { tint: 'rgba(120,150,175,0.024)', vig: 0.22, accent: '#7FA3B8', breathe: 0, grain: 0, label: 'дефляция', urgent: false },
};
function Atmosphere({ regime, intensity, flashKey }) {
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const k = clamp(intensity, 0, 1);
  const vig = a.vig * (0.6 + 0.5 * k);
  return (
    <>
      {/* мягкий объём по краям вместо тяжёлой виньетки */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3, transition: 'background 3.2s ease',
        background: `radial-gradient(130% 105% at 50% 45%, transparent 58%, rgba(0,0,0,${vig.toFixed(3)}) 100%), ${a.tint}` }} />
      {a.breathe > 0 && (
        <div className="ems-breathe" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4,
          '--p': (a.breathe * (0.4 + 0.7 * k)).toFixed(3),
          background: `radial-gradient(150% 120% at 50% 118%, ${a.accent}22 0%, transparent 45%)` }} />
      )}
      {a.grain > 0 && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4, opacity: a.grain * (0.5 + 0.7 * k),
          background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 4px)' }} />
      )}
      {a.urgent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, pointerEvents: 'none', zIndex: 9, overflow: 'hidden', background: `${a.accent}33` }}>
          <div className="ems-sweep" style={{ height: '100%', width: '45%', background: `linear-gradient(90deg, transparent, ${a.accent}, transparent)` }} />
        </div>
      )}
      {flashKey ? (
        <div key={flashKey} className="ems-flash" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10,
          background: `radial-gradient(circle at 50% 40%, ${a.accent}55, transparent 70%)` }} />
      ) : null}
    </>
  );
}

/* Аварийная строка: ощущение, что вы внутри события, а не читаете отчёт о нём */
function CrisisBar({ economy, botAction }) {
  const regime = economy.regime;
  if (regime === 'normal' || regime === 'deflation') return null;
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const info = REGIME_INFO[regime] || REGIME_INFO.normal;
  const metrics = [];
  if (regime === 'banking') metrics.push(['Просрочка', pctFmt(economy.bankNPL)], ['Капитал банков', pctFmt(economy.bankCapitalAdequacy)], ['Ликвидность', Math.round(economy.bankLiquidity)]);
  else if (regime === 'currency') metrics.push(['Курс', `${fmtSigned1(economy.fxDeprAnnual)}% год.`], ['Резервы', fmtMoney(economy.reserves)], ['Цены импорта', pctFmt(economy.importPriceInflation)]);
  else if (regime === 'debt') metrics.push(['Долг', pctFmt(economy.debtToGdp)], ['Спред', `${Math.round(economy.sovereignSpread)} б.п.`], ['Проценты к доходам', pctFmt(economy.interestToRevenue)]);
  else if (regime === 'stagflation') metrics.push(['Инфляция', pctFmt(economy.inflation)], ['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Ожидания', pctFmt(economy.inflationExpectations)]);
  else if (regime === 'recession') metrics.push(['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Безработица', pctFmt(economy.unemployment)], ['Инвестиции', fmtSignedPct(economy.investmentGrowth)]);
  else metrics.push(['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Инфляция', pctFmt(economy.inflation)], ['Рынок труда', `${fmtSigned1(economy.tightness)} п.п.`]);
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 8, borderTop: `1px solid ${a.accent}`, borderBottom: `1px solid ${a.accent}`,
      background: `linear-gradient(90deg, ${a.accent}22, ${COLOR.panel} 48%)`, padding: '7px 18px',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} role="status" aria-live="polite">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={a.urgent ? 'ems-blink' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: a.accent, display: 'inline-block' }} />
        <span className="ems-mono" style={{ fontSize: 11, color: a.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{regimeInfoLabel(info, economy)}</span>
        <span style={{ fontSize: 11, color: COLOR.faint }}>{economy.regimeStreak}-й квартал</span>
      </span>
      {metrics.map(([l, v]) => (
        <span key={l} style={{ fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'baseline' }}>
          <span style={{ color: COLOR.muted }}>{l}</span>
          <span className="ems-mono" style={{ color: COLOR.text }}>{v}</span>
        </span>
      ))}
      {botAction && botAction.demand && (
        <span style={{ fontSize: 11, color: a.accent, marginLeft: 'auto', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {botAction.demand}
        </span>
      )}
    </div>
  );
}

/* ============================ ФИНАНСОВЫЙ РЫНОК ============================ */
function Spark({ data, color, height = 30, fill }) {
  const vals = data.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return <div style={{ height }} />;
  const min = Math.min(...vals); const max = Math.max(...vals);
  const rng = max - min || 1;
  const w = 100;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${height - ((v - min) / rng) * (height - 3) - 1.5}`);
  return (
    <svg className="ems-visual" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} aria-hidden="true">
      {fill && <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity={0.12} />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Quote({ label, value, change, unit, color, big }) {
  const c = change === undefined ? COLOR.text : change > 0.001 ? COLOR.teal : change < -0.001 ? COLOR.rust : COLOR.muted;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div className="ems-mono" style={{ fontSize: big ? 21 : 14, color: color || COLOR.text, lineHeight: 1.15, marginTop: 1 }}>
        {value}{unit ? <span style={{ fontSize: big ? 12 : 10, color: COLOR.faint }}>{unit}</span> : null}
      </div>
      {change !== undefined && (
        <div className="ems-mono" style={{ fontSize: 10.5, color: c }}>{change > 0 ? '▲' : change < 0 ? '▼' : '■'} {fmtSigned1(change)}%</div>
      )}
    </div>
  );
}

/* Живые котировки: между кварталами цены дышат вокруг расчётных значений */
function useLiveQuotes(economy) {
  const keys = ['stockIndex', 'bondIndex', 'sectorBanks', 'sectorIndustry', 'sectorConsumer', 'sectorResources',
    'exchangeRate', 'yield10y', 'yield2y', 'sovereignSpread', 'corporateSpread', 'marketCap',
    'corpBondIndex', 'fxIndex', 'goldIndex', 'depositIndex', 'reitIndex',
    'bondShortIndex', 'linkerIndex', 'moneyMarketIndex', 'worldEquityIndex'];
  const base = {};
  keys.forEach((k) => { base[k] = economy[k]; });
  const [live, setLive] = useState(base);
  React.useEffect(() => {
    const b = {}; keys.forEach((k) => { b[k] = economy[k]; });
    setLive(b);
    const vol = clamp(economy.volatilityIndex / 100, 0.05, 1);
    const id = setInterval(() => {
      setLive((prev) => {
        const next = {};
        keys.forEach((k) => {
          const target = b[k];
          const amp = target * vol * 0.0045;
          const pull = (target - (prev[k] || target)) * 0.18;
          next[k] = (prev[k] || target) + pull + (Math.random() - 0.5) * amp * 2;
        });
        return next;
      });
    }, 1200);
    return () => clearInterval(id);
  }, [economy]);
  return live;
}

/* Бегущая строка держит живые котировки внутри себя, чтобы не перерисовывать экран целиком */
function LiveTicker({ economy, prev }) {
  const live = useLiveQuotes(economy);
  const chg = (k) => (prev && prev[k] ? (economy[k] / prev[k] - 1) * 100 : 0);
  const items = [
    ['ИНДЕКС', live.stockIndex, chg('stockIndex'), 0], ['БАНКИ', live.sectorBanks, chg('sectorBanks'), 0],
    ['ПРОМ', live.sectorIndustry, chg('sectorIndustry'), 0], ['ПОТРЕБ', live.sectorConsumer, chg('sectorConsumer'), 0],
    ['СЫРЬЁ', live.sectorResources, chg('sectorResources'), 0], ['НЕДВИЖ', live.reitIndex, chg('reitIndex'), 0],
    ['ОБЛИГ', live.bondIndex, chg('bondIndex'), 0], ['10Y', live.yield10y, 0, 2],
    ['КУРС', live.exchangeRate, chg('exchangeRate'), 1], ['СПРЕД', live.sovereignSpread, 0, 0],
  ];
  return (
    <div className="ems-panel" style={{ padding: '7px 12px', marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ems-mono" style={{ fontSize: 10, color: COLOR.gold, letterSpacing: '0.1em' }}>ТОРГИ</span>
        {items.map(([label, val, ch, dec]) => (
          <span key={label} className="ems-mono" style={{ fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: COLOR.faint }}>{label}</span>
            <span style={{ color: COLOR.text }}>{Number.isFinite(val) ? val.toFixed(dec) : '—'}</span>
            <span style={{ color: ch > 0.01 ? COLOR.teal : ch < -0.01 ? COLOR.rust : COLOR.faint, fontSize: 10 }}>
              {ch > 0.01 ? '▲' : ch < -0.01 ? '▼' : '·'}{Math.abs(ch) > 0.01 ? `${Math.abs(ch).toFixed(1)}%` : ''}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MarketScreen({ economy, prev, history, book, onTrade }) {
  const live = null;
  const q = (k) => (live && Number.isFinite(live[k]) ? live[k] : economy[k]);
  const hist = useMemo(() => history.slice(-28), [history]);
  const seriesCache = useMemo(() => {
    const keys = ['stockIndex', 'bondIndex', 'sectorBanks', 'sectorIndustry', 'sectorConsumer', 'sectorResources', 'reitIndex', 'exchangeRate'];
    const out = {};
    keys.forEach((k) => { out[k] = hist.map((h) => h[k]); });
    return out;
  }, [hist]);
  const ser = (k) => seriesCache[k] || hist.map((h) => h[k]);
  const chg = (k) => (prev && prev[k] ? (economy[k] / prev[k] - 1) * 100 : 0);
  const Panel = ({ title, icon: Icon, children, accent }) => (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        {Icon && <Icon size={13} color={accent || COLOR.goldSoft} />}
        <span className="ems-serif" style={{ fontSize: 13, color: accent || COLOR.goldSoft }}>{title}</span>
      </div>
      {children}
    </div>
  );
  const curve = [['3м', economy.yield3m], ['1г', economy.yield1y], ['2г', economy.yield2y], ['5л', economy.yield5y], ['10л', economy.yield10y]];
  const curvePrev = prev ? [prev.yield3m, prev.yield1y, prev.yield2y, prev.yield5y, prev.yield10y] : null;
  const yMin = Math.min(...curve.map((c) => c[1]), ...(curvePrev || [99])) - 0.6;
  const yMax = Math.max(...curve.map((c) => c[1]), ...(curvePrev || [0])) + 0.6;
  const cx = (i) => 8 + i * (184 / (curve.length - 1));
  const cy = (v) => 76 - ((v - yMin) / Math.max(0.5, yMax - yMin)) * 62;

  return (
    <div style={{ padding: '0 18px 18px' }}>
      <LiveTicker economy={economy} prev={prev} />

      {book && (
        <div style={{ marginBottom: 12 }}>
          <TradingTerminal economy={economy} prev={prev} history={history} book={book} onTrade={onTrade} />
        </div>
      )}

      <div className="ems-market-grid">
        <Panel title="Фондовый рынок" icon={TrendingUp}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
            <Quote label="Сводный индекс" value={Number.isFinite(q('stockIndex')) ? q('stockIndex').toFixed(1) : '—'} change={chg('stockIndex')} big />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, color: COLOR.muted }}>Капитализация</div>
              <div className="ems-mono" style={{ fontSize: 14 }}>{fmtMoney(economy.marketCap)}</div>
              <div className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint }}>{fmt1(economy.marketCapPctGdp)}% ВВП</div>
            </div>
          </div>
          <div style={{ margin: '6px 0 4px' }}>
            <Suspense fallback={<ChartFallback height={64} />}>
              <MemoChart data={ser('stockIndex')} color={COLOR.gold} height={64} label="Индекс акций" fmt={(v) => v.toFixed(1)} />
            </Suspense>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 12px', marginTop: 8 }}>
            {[['Банки', 'sectorBanks', COLOR.blue], ['Промышленность', 'sectorIndustry', COLOR.teal],
              ['Потребительский', 'sectorConsumer', COLOR.goldSoft], ['Сырьевой', 'sectorResources', '#8E7CC3']].map(([label, key, col]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                    <span style={{ color: COLOR.muted }}>{label}</span>
                    <span className="ems-mono" style={{ color: chg(key) >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(chg(key))}%</span>
                  </div>
                  <Spark data={ser(key)} color={col} height={22} />
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 9, fontSize: 10.5, color: COLOR.muted, flexWrap: 'wrap' }}>
            <span>P/E <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.stockPE)}</b></span>
            <span>справедливый <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.fairPE)}</b></span>
            <span>премия за риск акций <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.equityRiskPremium)}%</b></span>
          </div>
        </Panel>

        <Panel title="Кривая доходности" icon={Activity} accent={economy.curveInverted ? COLOR.rust : COLOR.goldSoft}>
          <svg viewBox="0 0 200 90" style={{ width: '100%', height: 108 }}>
            {[0, 1, 2, 3].map((i) => (<line key={i} x1={8} y1={14 + i * 20} x2={192} y2={14 + i * 20} stroke={COLOR.hairline} strokeWidth={0.6} />))}
            {curvePrev && <polyline points={curvePrev.map((v, i) => `${cx(i)},${cy(v)}`).join(' ')} fill="none" stroke={COLOR.faint} strokeWidth={1} strokeDasharray="3 3" />}
            <polyline points={curve.map((c, i) => `${cx(i)},${cy(c[1])}`).join(' ')} fill="none"
              stroke={economy.curveInverted ? COLOR.rust : COLOR.gold} strokeWidth={1.8} />
            {curve.map((c, i) => (
              <g key={c[0]}>
                <circle cx={cx(i)} cy={cy(c[1])} r={2.2} fill={economy.curveInverted ? COLOR.rust : COLOR.gold} />
                <text x={cx(i)} y={88} textAnchor="middle" fontSize={7.5} fill={COLOR.faint}>{c[0]}</text>
                <text x={cx(i)} y={cy(c[1]) - 6} textAnchor="middle" fontSize={7.5} fill={COLOR.muted}>{fmt1(c[1])}</text>
              </g>
            ))}
          </svg>
          <div style={{ fontSize: 11, color: economy.curveInverted ? COLOR.rust : COLOR.muted, lineHeight: 1.45, marginTop: 4 }}>
            {economy.curveInverted
              ? `Кривая инвертирована на ${fmt1(-economy.curveSlope)} п.п. Рынок закладывает, что нынешняя жёсткость сломает спрос и ставку придётся снижать — исторически это сигнал рецессии.`
              : `Наклон ${fmtSigned1(economy.curveSlope)} п.п. Длинные ставки выше коротких: рынок не ждёт скорого разворота политики.`}
          </div>
        </Panel>

        <Panel title="Облигации и риск-премии" icon={Landmark}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Quote label="Индекс облигаций" value={Number.isFinite(q('bondIndex')) ? q('bondIndex').toFixed(1) : '—'} change={chg('bondIndex')} />
            <Quote label="Доходность 10 лет" value={fmt2(economy.yield10y)} unit="%" />
            <Quote label="Ставка нового долга" value={fmt2(economy.effectiveDebtRate)} unit="%" />
          </div>
          <div style={{ margin: '6px 0' }}>
            <Suspense fallback={<ChartFallback height={54} />}>
              <MemoChart data={ser('bondIndex')} color={COLOR.blue} height={54} label="Индекс облигаций" fmt={(v) => v.toFixed(1)} />
            </Suspense>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Суверенный спред', economy.sovereignSpread, 800], ['Корпоративный спред', economy.corporateSpread, 1200],
              ['Премия за риск страны', economy.riskPremium * 100, 900]].map(([label, v, max]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ color: COLOR.muted, width: 132 }}>{label}</span>
                  <span style={{ flex: 1, height: 4, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${clamp(v / max * 100, 0, 100)}%`,
                      background: v > max * 0.5 ? COLOR.rust : v > max * 0.25 ? COLOR.gold : COLOR.teal }} />
                  </span>
                  <span className="ems-mono" style={{ width: 54, textAlign: 'right' }}>{Math.round(v)} б.п.</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Банковский сектор" icon={ShieldAlert} accent={economy.bankingRisk > 60 ? COLOR.rust : COLOR.goldSoft}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <Quote label="Индекс банков" value={Number.isFinite(q('sectorBanks')) ? q('sectorBanks').toFixed(0) : '—'} change={chg('sectorBanks')} />
            <Quote label="Цена к капиталу" value={fmt2(economy.bankPB)} />
            <Quote label="Рентабельность" value={fmt1(economy.bankROE)} unit="%" color={economy.bankROE < 0 ? COLOR.rust : COLOR.text} />
          </div>
          <Suspense fallback={<ChartFallback height={48} />}>
            <MemoChart data={ser('sectorBanks')} color={COLOR.blue} height={48} label="Индекс банков" fmt={(v) => v.toFixed(0)} />
          </Suspense>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginTop: 9, fontSize: 11 }}>
            {[['Процентная маржа', `${fmt2(economy.netInterestMargin)} п.п.`], ['Просрочка', pctFmt(economy.bankNPL)],
              ['Достаточность капитала', pctFmt(economy.bankCapitalAdequacy)], ['Норматив', pctFmt(economy.capitalRequirement)],
              ['Кредитный портфель', fmtMoney(economy.creditVolume)], ['Рост кредита', fmtSignedPct(economy.creditGrowth)]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono">{b}</span>
                </div>
              ))}
          </div>
          {economy.creditCrunch && (
            <div style={{ marginTop: 8, fontSize: 11, color: COLOR.rust, lineHeight: 1.4 }}>
              Капитал упёрся в норматив: банки физически не могут выдавать новые кредиты, сколько бы ни стоили деньги.
            </div>
          )}
        </Panel>

        <Panel title="Валютный рынок" icon={Globe2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Quote label="Курс (выше — слабее)" value={Number.isFinite(q('exchangeRate')) ? q('exchangeRate').toFixed(2) : '—'} change={chg('exchangeRate')} big />
            <Quote label="Реальный курс" value={fmt1(economy.realExchangeRate)} />
          </div>
          <div style={{ margin: '6px 0' }}>
            <Suspense fallback={<ChartFallback height={54} />}>
              <MemoChart data={ser('exchangeRate')} color={COLOR.rust} height={54} label="Курс" fmt={(v) => v.toFixed(2)} />
            </Suspense>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 11 }}>
            {[['Режим', economy.fxRegime === 'free' ? 'плавающий' : economy.fxRegime === 'managed' ? 'управляемый' : 'фиксированный'],
              ['Ориентир', economy.fxRegime === 'free' ? '—' : fmt1(economy.fxTarget)],
              ['Резервы', fmtMoney(economy.reserves)], ['Интервенции', fmtMoneySigned(economy.defenseIntervention || 0)],
              ['Волатильность', fmt1(economy.fxVolatility)], ['Текущий счёт', fmtMoneySigned(economy.currentAccount)]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono">{b}</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Настроение рынка" icon={Zap} accent={economy.volatilityIndex > 45 ? COLOR.rust : COLOR.goldSoft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Gauge value={clamp(100 - economy.volatilityIndex, 0, 100)} size={86} />
            <div style={{ flex: 1 }}>
              <Quote label="Индекс страха" value={fmt1(economy.volatilityIndex)}
                color={economy.volatilityIndex > 45 ? COLOR.rust : economy.volatilityIndex > 28 ? COLOR.gold : COLOR.teal} big />
              <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>
                {economy.volatilityIndex > 55 ? 'Рынок в панике: цены двигаются быстрее, чем поступают новости.'
                  : economy.volatilityIndex > 32 ? 'Нервозность повышена — инвесторы требуют премию за неопределённость.'
                    : 'Рынок спокоен, премии за риск сжаты. Именно в такие периоды копятся дисбалансы.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginTop: 10, fontSize: 11 }}>
            {[['Ставка дисконтирования', `${fmt1(economy.discountRate)}%`], ['Премия за риск акций', `${fmt1(economy.equityRiskPremium)}%`],
              ['Прибыль корпораций', fmtMoney(economy.earnings)], ['Доходность облигаций 2 года', `${fmt2(economy.yield2y)}%`]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono">{b}</span>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================ НОВЫЕ КОМПОНЕНТЫ ============================ */
const SCORE_DEFS = [
  { id: 'scoreStability', label: 'Макростабильность', short: 'Стабильность', color: COLOR.gold, hint: 'Инфляция у цели, заякоренные ожидания, закрытый разрыв выпуска.' },
  { id: 'scoreWelfare', label: 'Благосостояние населения', short: 'Люди', color: COLOR.teal, hint: 'Реальные доходы, занятость, уверенность, человеческий капитал.' },
  { id: 'scoreFinancial', label: 'Финансовая устойчивость', short: 'Финансы', color: COLOR.blue, hint: 'Капитал банков, просрочка, кредитный разрыв, резервы.' },
  { id: 'scoreFiscal', label: 'Бюджетная устойчивость', short: 'Бюджет', color: COLOR.rust, hint: 'Долг, дефицит, стоимость обслуживания, собираемость налогов.' },
  { id: 'scorePotential', label: 'Долгосрочный потенциал', short: 'Потенциал', color: '#8E7CC3', hint: 'Производительность, образование, инфраструктура, капитал.' },
];

function ScoreRadar({ economy, prev, size = 190 }) {
  const cx = size / 2; const cy = size / 2 + 6; const R = size / 2 - 34;
  const n = SCORE_DEFS.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (getter) => SCORE_DEFS.map((d, i) => pt(i, R * clamp(getter(d.id), 0, 100) / 100).join(',')).join(' ');
  const grid = [25, 50, 75, 100].map((g) => SCORE_DEFS.map((d, i) => pt(i, R * g / 100).join(',')).join(' '));
  return (
    <svg className="ems-visual" width="100%" viewBox={`0 0 ${size} ${size + 12}`} style={{ maxWidth: size }} aria-hidden="true">
      {grid.map((g, i) => (<polygon key={i} points={g} fill="none" stroke={COLOR.hairline} strokeWidth={1} />))}
      {SCORE_DEFS.map((dd, i) => { const [x, y] = pt(i, R); return <line key={dd.id} x1={cx} y1={cy} x2={x} y2={y} stroke={COLOR.hairline} strokeWidth={1} />; })}
      {prev && <polygon points={poly((id) => prev[id])} fill="none" stroke={COLOR.faint} strokeWidth={1} strokeDasharray="3 3" />}
      <polygon points={poly((id) => economy[id])} fill="rgba(201,162,39,0.16)" stroke={COLOR.gold} strokeWidth={1.7} />
      {SCORE_DEFS.map((dd, i) => {
        const [x, y] = pt(i, R + 17);
        return (
          <g key={dd.id}>
            <text x={x} y={y} textAnchor="middle" fontSize={8.5} fill={COLOR.muted}>{dd.short}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={dd.color}>{Math.round(economy[dd.id])}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ScorePanel({ economy, prev, goalDef }) {
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Target size={14} />Пять оценок вашей политики
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginBottom: 8, lineHeight: 1.45 }}>Максимизировать все пять одновременно невозможно: каждая политика что-то отнимает у остальных.</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><ScoreRadar economy={economy} prev={prev} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
        {SCORE_DEFS.map((dd) => {
          const v = clamp(economy[dd.id] || 0, 0, 100); const delta = (economy[dd.id] || 0) - (prev ? prev[dd.id] || 0 : 0);
          const isGoal = goalDef && goalDef.score && `score${goalDef.score.charAt(0).toUpperCase()}${goalDef.score.slice(1)}` === dd.id;
          return (
            <div key={dd.id} title={dd.hint} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
              <span style={{ color: isGoal ? COLOR.goldSoft : COLOR.muted, width: 92, fontWeight: isGoal ? 600 : 400 }}>{dd.short}{isGoal ? ' ★' : ''}</span>
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${v}%`, height: '100%', background: dd.color }} />
              </span>
              <span className="ems-mono" style={{ width: 22, textAlign: 'right', color: dd.color, fontWeight: 600 }}>{Math.round(v)}</span>
              <DeltaTag value={delta} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegimeBanner({ economy }) {
  const info = REGIME_INFO[economy.regime] || REGIME_INFO.normal;
  const c = info.color === 'teal' ? COLOR.teal : info.color === 'gold' ? COLOR.gold : info.color === 'blue' ? COLOR.blue : COLOR.rust;
  const dim = info.color === 'teal' ? COLOR.tealDim : info.color === 'gold' ? COLOR.goldDim : info.color === 'blue' ? COLOR.blueDim : COLOR.rustDim;
  // баннер не должен висеть на экране постоянно: в нормальном режиме показываем
  // его недолго (только что зашли / кризис только закончился), а не бессрочно;
  // сам кризис — другое дело, его показываем, пока он активен
  const [visible, setVisible] = useState(true);
  React.useEffect(() => {
    setVisible(true);
    if (economy.regime !== 'normal') return undefined;
    const t = setTimeout(() => setVisible(false), 45000);
    return () => clearTimeout(t);
  }, [economy.regime]);
  if (!visible) return null;
  // кризисный режим должен ощутимо «весить» тяжелее нормального — иначе баннер
  // «всё спокойно» и баннер «валютный кризис» выглядят одинаково важными
  const isCrisis = economy.regime !== 'normal';
  return (
    <div className="ems-fade-in" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: dim,
      border: `1px solid ${c}`, borderLeft: `${isCrisis ? 4 : 1}px solid ${c}`, borderRadius: 3,
      padding: isCrisis ? '11px 14px' : '9px 12px', fontSize: 12 }}>
      <Activity size={isCrisis ? 17 : 15} color={c} style={{ flexShrink: 0, marginTop: 1 }} />
      <div><b style={{ color: c, fontSize: isCrisis ? 12.5 : 12 }}>Режим экономики: {regimeInfoLabel(info, economy)}.</b> <span style={{ color: COLOR.muted }}>{regimeInfoText(info, economy)}</span></div>
    </div>
  );
}

function StanceBar({ value, leftLabel, rightLabel }) {
  const v = clamp(value, -1, 1);
  const pos = (v + 1) / 2 * 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ position: 'relative', height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${COLOR.teal} 0%, ${COLOR.border} 50%, ${COLOR.rust} 100%)` }}>
        <span style={{ position: 'absolute', left: `calc(${pos}% - 4px)`, top: -2.5, width: 8, height: 10, borderRadius: 2, background: COLOR.text, border: `1px solid ${COLOR.bg}` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: COLOR.faint, marginTop: 3 }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
    </div>
  );
}

/* Панель ведомства, которым управляет бот */
function BotPanel({ botRole, persona, lastAction, coordination }) {
  if (!botRole) return null;
  const isCb = botRole === 'central_bank';
  const Icon = isCb ? Landmark : Coins;
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <Icon size={14} color={COLOR.blue} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.blue }}>{isCb ? 'Центральный банк' : 'Министерство финансов'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={11} />бот</span>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{persona.name}</b> · {persona.title}
      </div>
      <StanceBar value={lastAction ? lastAction.stance : 0} leftLabel={isCb ? 'мягкая политика' : 'консолидация'} rightLabel={isCb ? 'жёсткая политика' : 'стимулирование'} />
      {lastAction && (
        <div style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.blue}`, paddingLeft: 9, color: COLOR.text }}>
          {lastAction.note}
        </div>
      )}
      {lastAction && lastAction.demand && (
        <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.rust}`, paddingLeft: 9, color: COLOR.muted }}>
          <span style={{ color: COLOR.rust, fontWeight: 600 }}>Требование: </span>{lastAction.demand}
        </div>
      )}
      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: COLOR.muted }}>
        <span>Согласованность политики</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${clamp(coordination, 0, 100)}%`, height: '100%', background: coordination > 60 ? COLOR.teal : coordination > 35 ? COLOR.gold : COLOR.rust }} />
        </span>
        <span className="ems-mono">{Math.round(coordination)}</span>
      </div>
    </div>
  );
}

/* Президент глазами ведомства: чей он характер, чего требует прямо сейчас, и
   насколько администрация вами довольна. Последнее — не косметика: из нуля
   довольства вырастает отставка, и полоса должна быть видна заранее, а не
   объявляться постфактум вместе с увольнением. */
/* Чем кончилось прошлое требование, одним словом. Доля выполнения может прийти
   и булевой (старые сохранения), и дробной, и вовсе отсутствовать; у указания
   боту вместо неё — ответ ведомства. */
const lastDirectiveWord = (last) => {
  if (last.status) {
    return last.status === 'accepted' ? 'исполнено' : last.status === 'partial' ? 'исполнено частично' : 'отклонено';
  }
  const raw = last.directiveMet;
  const p = raw === true ? 1 : raw === false ? 0 : Number.isFinite(raw) ? raw : null;
  const verdict = directiveVerdict(p);
  return verdict === 'met' ? 'выполнено' : verdict === 'partial' ? 'выполнено частично'
    : verdict === 'ignored' ? 'проигнорировано' : 'передано ведомству';
};

function PresidentWatchPanel({ economy, plan, last, branch }) {
  if (!plan) return null;
  const P = plan.persona;
  const sat = clamp(Number.isFinite(economy.presidentSatisfaction) ? economy.presidentSatisfaction : 60, 0, 100);
  const satColor = sat >= 55 ? COLOR.teal : sat >= 25 ? COLOR.gold : COLOR.rust;
  const dir = plan.directive;
  const mine = dir && dir.toPlayer;
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: sat < 25 ? COLOR.rust : COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <Crown size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>Президент</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={11} />бот</span>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{P.name}</b> · {P.title}
      </div>
      {/* его капитал виден и вам: и требование, и указ, и реформа стоят денег,
          а без счётчика казалось, что президент тратит из воздуха */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: COLOR.muted, marginBottom: 6 }}>
        <span>Политический капитал</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${clamp(economy.politicalCapital || 0, 0, 100)}%`, height: '100%', background: COLOR.gold }} />
        </span>
        <span className="ems-mono" style={{ color: COLOR.goldSoft }}>{Math.round(economy.politicalCapital || 0)}</span>
      </div>
      {/* у трейдера президента не за что увольнять — «отношение к вам» там не про что */}
      {branch && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: COLOR.muted, marginBottom: 8 }}>
        <span>Отношение к вам</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${sat}%`, height: '100%', background: satColor }} />
        </span>
        <span className="ems-mono" style={{ color: satColor }}>{plan.mood}</span>
      </div>
      )}
      {dir ? (
        <div style={{ fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${mine ? COLOR.rust : COLOR.blue}`, paddingLeft: 9, color: COLOR.text }}>
          <span style={{ color: mine ? COLOR.rust : COLOR.blue, fontWeight: 600 }}>
            {mine ? 'Требование к вам: ' : `Указание ${dir.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: `}
          </span>
          {dir.ask || askText(dir.req, 1, 'president')}
          {mine && (
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4 }}>
              Выполнить — значит сдвинуть свои ползунки в эту сторону в этом квартале. Отказ никто не запрещает,
              но администрация его запомнит.
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: COLOR.muted, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9 }}>
          В этом квартале требований нет.
        </div>
      )}
      {last && !!(last.label || (last.actions || []).length) && (
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 8, lineHeight: 1.45 }}>
          В прошлый раз: {last.label
            ? `${last.toPlayer ? 'требование' : 'указание'} «${last.label}» — ${lastDirectiveWord(last)}`
            : 'без требований'}
          {last.actions && last.actions.length ? `; сам занялся: ${last.actions.join(', ').toLowerCase()}` : ''}.
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9, color: COLOR.muted }}>
        «{plan.quote}»
      </div>
      {branch && sat < 25 && (
        <div style={{ marginTop: 8, fontSize: 11, color: COLOR.rust, lineHeight: 1.45 }}>
          Администрация всерьёз рассматривает вопрос о вашей отставке. Выполненное требование поднимает
          отношение заметно быстрее, чем хорошие цифры{branch === 'monetary' ? ' по инфляции' : ' по бюджету'}.
        </div>
      )}
    </div>
  );
}

/* ============================ ПРЕЗИДЕНТ ============================
   У президента нет ни одного ползунка: вместо непрерывных величин — набор
   дискретных решений, каждое со своей ценой в политическом капитале. Панель
   поэтому устроена не как список слайдеров, а как ведомость: сколько капитала
   есть, сколько уже забронировано выбранными на этот квартал решениями и
   сколько останется. Пока квартал не завершён, любое решение можно снять. */
const PRES_GROUP_ICON = { public: Megaphone, reform: Hammer, power: Gavel, war: ShieldAlert };
const PRES_TABS = [
  { id: 'public', label: 'Указы' },
  { id: 'reform', label: 'Реформы' },
  // война — отдельная вкладка: это единственный рычаг президента, который меняет
  // не проценты, а саму рамку, в которой считают все остальные
  { id: 'war', label: 'Война' },
  { id: 'staff', label: 'Кадры' },
  { id: 'directive', label: 'Указания' },
];

function CapitalBar({ value, reserved, gain }) {
  const v = clamp(value, 0, 100);
  const res = clamp(reserved, 0, v);
  const left = v - res;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <span className="ems-mono" style={{ fontSize: 25, color: COLOR.gold, fontWeight: 600, lineHeight: 1 }}>{Math.round(left)}</span>
        <span style={{ fontSize: 11, color: COLOR.muted }}>из {Math.round(v)} свободно</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 11, color: gain >= 0 ? COLOR.teal : COLOR.rust }}>
          {gain >= 0 ? '+' : ''}{fmt1(gain)} за квартал
        </span>
      </div>
      <div style={{ display: 'flex', height: 7, borderRadius: 3, overflow: 'hidden', background: COLOR.border }}>
        <span style={{ width: `${left}%`, background: COLOR.gold }} />
        <span style={{ width: `${res}%`, background: COLOR.goldDim, borderLeft: res > 0 ? `1px solid ${COLOR.gold}` : 'none' }} />
      </div>
      <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 4, lineHeight: 1.4 }}>
        {res > 0
          ? `${Math.round(res)} забронировано решениями этого квартала — списание произойдёт при завершении квартала.`
          : 'Копится рейтингом и ростом, тает в кризисах. Без него ни одно решение президента не проходит.'}
      </div>
    </div>
  );
}

/* Лестница режимов: где вы сейчас и что нужно, чтобы шагнуть выше или вернуться
   вниз. Без этой строки путь к авторитаризму и тем более к тоталитаризму был
   чистой догадкой — пороги живут в движке, а игрок видел только результат. */
function RegimeLadder({ economy }) {
  const regime = economy.politicalRegime || 'democracy';
  const tension = Math.round(economy.politicalTension || 0);
  const info = POLITICAL_REGIME_INFO[regime] || {};
  const next = regime === 'democracy'
    ? { label: 'конфликт ветвей власти', need: 'напряжённость ≥ 62', at: 62 }
    : regime === 'crisis'
      ? { label: 'авторитарный режим', need: 'напряжённость ≥ 70 (или указ о роспуске парламента)', at: 70 }
      : regime === 'authoritarian'
        ? { label: 'тоталитарный режим', need: 'указ «Полный контроль над институтами» во время войны или напряжённость ≥ 80', at: 80 }
        : null;
  const bar = clamp(tension, 0, 100);
  return (
    <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${COLOR.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 10.5, marginBottom: 5 }}>
        <span style={{ color: COLOR.muted }}>Режим</span>
        {/* ярлыки авторитаризма и тоталитаризма сами заканчиваются на «режим»
            («Авторитарный режим») — рядом с меткой поля получалась тавтология
            «Режим: Авторитарный режим» */}
        <span style={{ color: COLOR.text }}>{(info.label || regime).replace(/\s*режим$/i, '')}</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', color: tension >= 62 ? COLOR.rust : tension >= 40 ? COLOR.gold : COLOR.teal }}>
          напряжённость {tension}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${bar}%`, height: '100%',
          background: tension >= 62 ? COLOR.rust : tension >= 40 ? COLOR.gold : COLOR.teal }} />
        {next && <span style={{ position: 'absolute', left: `${next.at}%`, top: -2, width: 2, height: 8, background: COLOR.goldSoft }} />}
      </div>
      {(regime === 'authoritarian' || regime === 'totalitarian') && (() => {
        /* Риск, о котором нельзя узнать заранее, — это лотерея, а не механика.
           Показываем его прямо: чем выше напряжение, безработица, инфляция и чем
           меньше политического капитала, тем ближе армия. Пока он пренебрежимо
           мал, строка только шумит — ноль полезной информации при каждом взгляде
           на панель, — поэтому ниже 1% в квартал её просто нет. */
        const risk = militaryCoupRisk(economy);
        // словом и числом — по одной и той же величине: «низкий · 3%» рядом с
        // порогом в 3% читался бы как ошибка
        const pct = Math.round(risk * 1000) / 10;
        if (pct < 1) return null;
        const color = pct >= 8 ? COLOR.rust : COLOR.gold;
        return (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 10.5, marginTop: 6 }}>
            <span style={{ color: COLOR.muted }}>Риск военного переворота</span>
            <span style={{ marginLeft: 'auto', color }} className="ems-mono">
              {pct >= 8 ? 'высокий' : 'заметный'} · {pct}% за квартал
            </span>
          </div>
        );
      })()}
      <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 5, lineHeight: 1.45 }}>
        {next
          ? <>Следующая ступень — <b style={{ color: COLOR.muted }}>{next.label}</b>: {next.need}. Напряжённость растёт от низкого рейтинга, кризисов, безработицы и инфляции.</>
          : 'Дальше по этой лестнице идти некуда: выборов нет, голосованием власть не сменить. Остаётся армия — чем выше напряжённость, безработица и инфляция, тем вероятнее переворот. Спуститься можно только так или вернуть парламент по своей воле.'}
      </div>
    </div>
  );
}

function PresActionCard({ action, economy, cooldowns, selected, affordable, onToggle }) {
  // у выбранного решения его цена уже вычтена из свободного капитала — проверять
  // «хватает ли» по остатку без него значит объявлять нехватку на ровном месте
  const canAfford = selected || affordable;
  const cdLeft = cooldowns[`pres:${action.id}`] || 0;
  const done = action.once && (economy.reforms || {})[action.id] !== undefined;
  const blockedByReq = !!(action.requires && !action.requires(economy));
  const disabled = done || cdLeft > 0 || blockedByReq || !canAfford;
  const share = done ? reformShare(economy.reforms, action.id) : 0;
  const why = done ? (REFORM_RAMP[action.id]
    ? `Проведена · внедрена на ${Math.round(share * 100)}%`
    : 'Уже проведена')
    : cdLeft > 0 ? `Повторно через ${cdLeft} кв.`
      : blockedByReq ? (action.reqText || 'Сейчас недоступно')
        : !canAfford ? 'Не хватает капитала' : null;
  return (
    <div className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) { Audio.play('tick'); onToggle(); } }}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(); } }}
      style={{ padding: '9px 11px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 6,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled && !selected ? 0.5 : 1,
        borderColor: selected ? COLOR.gold : COLOR.border, background: selected ? COLOR.goldDim : COLOR.panelAlt }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {selected && <Check size={12} color={COLOR.gold} style={{ alignSelf: 'center', flexShrink: 0 }} />}
        <span style={{ fontSize: 12.5, color: selected ? COLOR.goldSoft : COLOR.text, fontWeight: 600, flex: 1 }}>{action.label}</span>
        <span className="ems-mono" style={{ fontSize: 11, color: selected ? COLOR.goldSoft : COLOR.muted, flexShrink: 0 }}>{action.cost} ПК</span>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.45, marginTop: 4 }}>{action.desc}</div>
      {done && REFORM_RAMP[action.id] && (
        <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${share * 100}%`, height: '100%', background: COLOR.teal }} />
        </div>
      )}
      {why && <div style={{ fontSize: 10, color: done ? COLOR.teal : COLOR.faint, marginTop: 4 }}>{why}</div>}
    </div>
  );
}

function PresidentPanel({ economy, cooldowns, selected, setSelected, cbPersonaId, mofPersonaId,
  appointCb, setAppointCb, appointMof, setAppointMof, directive, setDirective, lastDirective,
  directiveStrength, setDirectiveStrength }) {
  const [tab, setTab] = useState('public');
  const capital = Number.isFinite(economy.politicalCapital) ? economy.politicalCapital : 55;
  const reserved = selected.reduce((sum, id) => sum + ((PRES_BY_ID[id] || {}).cost || 0), 0)
    + (appointCb ? APPOINT_COST.central_bank : 0) + (appointMof ? APPOINT_COST.ministry_finance : 0)
    + (directive ? PRES_DIRECTIVE_COST : 0);
  const free = capital - reserved;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const groupActions = (g) => PRESIDENT_ACTIONS.filter((a) => a.group === g);
  const cbP = getCbPersona(cbPersonaId); const mofP = getMofPersona(mofPersonaId);

  const staffBlock = (kind, list, current, pending, setPending, tenure) => {
    const cost = APPOINT_COST[kind];
    const canPay = free + (pending ? cost : 0) >= cost;
    const early = kind === 'central_bank' && tenure < CB_FULL_TERM;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
          <span className="ems-serif" style={{ fontSize: 12.5, color: COLOR.blue }}>
            {kind === 'central_bank' ? 'Глава Центрального банка' : 'Министр финансов'}
          </span>
          <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>{cost} ПК за смену</span>
        </div>
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginBottom: 6, lineHeight: 1.45 }}>
          Действующий — <b style={{ color: COLOR.text }}>{current.name}</b>, {tenure} кв. в должности.
          {kind === 'central_bank' && (early
            ? ` Полный срок — ${CB_FULL_TERM} кв.: досрочная отставка обойдётся доверием к ЦБ и премией за риск тем дороже, чем раньше она случится.`
            : ' Срок отработан полностью — смена будет выглядеть плановой.')}
        </div>
        {list.map((p) => {
          const isCur = p.id === current.id;
          const isPending = pending === p.id;
          const disabled = isCur || (!isPending && !canPay);
          return (
            <div key={p.id} className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
              onClick={() => { if (!disabled) { Audio.play('tick'); setPending(isPending ? null : p.id); } }}
              onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setPending(isPending ? null : p.id); } }}
              style={{ padding: '7px 10px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 5,
                cursor: disabled ? 'default' : 'pointer', opacity: disabled && !isCur ? 0.5 : 1,
                borderColor: isPending ? COLOR.gold : isCur ? COLOR.blue : COLOR.border,
                background: isPending ? COLOR.goldDim : isCur ? COLOR.blueDim : COLOR.panelAlt }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: isPending ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                {/* должность режем в одну строку: иначе она переносится и утаскивает
                    вниз метку «действующий», разрывая строку карточки надвое */}
                <span style={{ fontSize: 10, color: COLOR.faint, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                {isCur && <span style={{ fontSize: 9.5, color: COLOR.blue, flexShrink: 0 }}>действующий</span>}
                {isPending && <span style={{ fontSize: 9.5, color: COLOR.gold, flexShrink: 0 }}>назначить</span>}
              </div>
              <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.4, marginTop: 3 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const directiveList = (toCb) => REQUESTS.filter((r) => (r.from === 'ministry_finance') === toCb);
  const canDirective = free + (directive ? PRES_DIRECTIVE_COST : 0) >= PRES_DIRECTIVE_COST;

  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Crown size={14} />Политический капитал
      </div>
      <CapitalBar value={capital} reserved={reserved} gain={economy.politicalCapitalGain || 0} />
      <RegimeLadder economy={economy} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '12px 0 10px' }}>
        {PRES_TABS.map((t) => (
          <span key={t.id} className={`ems-tab ${tab === t.id ? 'active' : ''}`} style={{ fontSize: 10.5, padding: '4px 9px' }}
            onClick={() => { Audio.play('tab'); setTab(t.id); }}>{t.label}</span>
        ))}
      </div>

      {tab === 'public' && (
        <div>
          {['public', 'power'].map((g) => {
            const Icon = PRES_GROUP_ICON[g];
            return (
              <React.Fragment key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: COLOR.faint,
                  letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 6px' }}>
                  <Icon size={11} />{PRES_GROUP_LABEL[g]}
                </div>
                {groupActions(g).map((a) => (
                  <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
                    selected={selected.includes(a.id)} affordable={free >= a.cost} onToggle={() => toggle(a.id)} />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {tab === 'war' && (
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Война — не рычаг экономики, а смена рамки: рейтинг первые кварталы растёт на сплочении,
            чрезвычайные полномочия становятся доступны, газеты меняют язык. Платят за это торговля,
            инвестиции, капитал и люди — и платят дольше, чем идёт сама война.
          </div>
          {PRESIDENT_ACTIONS.filter((a) => a.group === 'war').map((a) => (
            <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
              selected={selected.includes(a.id)} affordable={free >= a.cost}
              onToggle={() => toggle(a.id)} />
          ))}
        </div>
      )}

      {tab === 'reform' && (
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
            Реформы не действуют в квартале объявления: каждая разворачивается годами, а платить рейтингом
            приходится сразу. Это единственные решения в игре, которые двигают потенциальный ВВП, а не спрос.
          </div>
          {groupActions('reform').map((a) => (
            <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
              selected={selected.includes(a.id)} affordable={free >= a.cost} onToggle={() => toggle(a.id)} />
          ))}
        </div>
      )}

      {tab === 'staff' && (
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Вы не задаёте ставку и бюджет — вы выбираете тех, кто их задаёт. Характер руководителя определяет
            политику ведомства на годы вперёд, поэтому назначение работает медленнее указа, но действует дольше.
          </div>
          {staffBlock('central_bank', CB_PERSONAS, cbP, appointCb, setAppointCb, economy.cbTenure || 0)}
          {staffBlock('ministry_finance', MOF_PERSONAS, mofP, appointMof, setAppointMof, economy.mofTenure || 0)}
        </div>
      )}

      {tab === 'directive' && (
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Одно указание за квартал, {PRES_DIRECTIVE_COST} ПК. Ведомство может и отказать: шанс зависит от того,
            насколько просьба соответствует ситуации, от характера руководителя и от политического режима — чем
            меньше в стране институтов, тем меньше у ведомства возможности сказать «нет».
            {' '}Выполненное указание ЦБ стоит доверия к нему: управляемый центральный банк рынок оценивает дешевле.
          </div>
          {[[true, 'Центральному банку'], [false, 'Минфину']].map(([toCb, title]) => (
            <React.Fragment key={title}>
              <div style={{ fontSize: 10, color: COLOR.faint, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 6px' }}>{title}</div>
              {directiveList(toCb).map((r) => {
                const isSel = directive === r.id;
                const disabled = !isSel && !canDirective;
                return (
                  <div key={r.id} className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
                    onClick={() => { if (!disabled) { Audio.play('tick'); setDirective(isSel ? null : r.id); } }}
                    onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDirective(isSel ? null : r.id); } }}
                    style={{ padding: '7px 10px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 5,
                      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
                      borderColor: isSel ? COLOR.gold : COLOR.border, background: isSel ? COLOR.goldDim : COLOR.panelAlt }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      {isSel && <Check size={11} color={COLOR.gold} />}
                      <span style={{ fontSize: 12, color: isSel ? COLOR.goldSoft : COLOR.text }}>{r.label}</span>
                    </div>
                    {isSel && <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.4, marginTop: 4 }}>«{askText(r, r.scale ? (directiveStrength || 1) : 1, 'president')}»</div>}
                    {/* «снизить ставку» без указания насколько — это не указание:
                        один пункт для ставки очень много, и просить можно меньше */}
                    {isSel && r.scale && (
                      <div style={{ marginTop: 7 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
                          <span style={{ color: COLOR.muted }}>Насколько</span>
                          <span className="ems-mono" style={{ color: COLOR.goldSoft }}>
                            {fmt2(r.scale.base * (directiveStrength || 1))}{r.scale.unit}
                          </span>
                        </div>
                        <input type="range" className="ems-slider"
                          min={r.scale.min / r.scale.base} max={r.scale.max / r.scale.base}
                          step={r.scale.step / r.scale.base} value={directiveStrength || 1}
                          onChange={(e) => { Audio.play('tick'); setDirectiveStrength(Number(e.target.value)); }} />
                        <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 3, lineHeight: 1.4 }}>
                          Чем больше просите, тем охотнее ведомство откажет.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {lastDirective && (
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, paddingLeft: 9,
              borderLeft: `2px solid ${lastDirective.status === 'rejected' ? COLOR.rust : lastDirective.status === 'partial' ? COLOR.gold : COLOR.teal}`,
              color: COLOR.muted }}>
              <span style={{ color: COLOR.faint }}>Ответ на прошлое указание: </span>{lastDirective.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// формат текущего/целевого значения под конкретное обещание — target/value это
// голые числа (см. pickPromises/evaluatePromise в engine.js), единицы тут же рядом с текстом
const PROMISE_FMT = {
  inflation_tame: (v) => `${fmt1(v)}%`, jobs_for_all: (v) => `${fmt1(v)}%`,
  debt_discipline: (v) => `${fmt1(v)}%`, growth_promise: (v) => `${fmtSigned1(v)}%`,
  strong_currency: (v) => `${fmtSigned1(v)}%`, budget_control: (v) => `${fmt1(v)}%`,
  living_standards_promise: (v) => fmt1(v), reserves_promise: (v) => fmtMoney(v),
};
/* У премьер-министра и президента нет бота-оппонента с требованиями — три случайных
   обещания на срок до выборов создают то же ощутимое давление, что остальным
   ролям даёт партнёр по власти. met/value считаются на лету от текущей
   экономики (evaluatePromise), а не хранятся — иначе они бы не обновлялись
   при откате/загрузке сохранения. */
function PromisesPanel({ promises, economy }) {
  if (!promises || !promises.length) return null;
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <Flag size={14} color={COLOR.blue} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.blue }}>Предвыборные обещания</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>
          {economy.noElections ? 'выборы отменены' : `до выборов ${economy.quartersToElection} кв.`}</span>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
        Каждое сдержанное обещание добавляет около 2 п.п. голосов на выборах, каждое проваленное — столько же отнимает.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {promises.map((p) => {
          const { met, value } = evaluatePromise(p, economy);
          const fmtFn = PROMISE_FMT[p.id] || fmt1;
          const color = met ? COLOR.teal : COLOR.rust;
          return (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {met ? <Check size={13} color={color} style={{ marginTop: 2, flexShrink: 0 }} /> : <AlertTriangle size={13} color={color} style={{ marginTop: 2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: met ? COLOR.text : COLOR.muted }}>{p.label}</span>
                  <span className="ems-mono" style={{ fontSize: 10.5, color, flexShrink: 0 }}>{fmtFn(value)} / {fmtFn(p.target)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: COLOR.faint }}>{p.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, label, hint }) {
  const cur = options.find((o) => o.id === value);
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}>
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => (
          <button key={o.id} className="ems-btn" onClick={() => { Audio.play('click'); onChange(o.id); }}
            style={{ flex: 1, padding: '5px 6px', fontSize: 11, background: value === o.id ? COLOR.gold : COLOR.panelAlt, color: value === o.id ? COLOR.ink : COLOR.text, borderColor: value === o.id ? COLOR.gold : COLOR.border }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>{cur ? cur.hint : hint}</div>
    </div>
  );
}



/* ============================ СОХРАНЕНИЯ ============================ */
const SAVE_VERSION = 3;
function makeSnapshot(state) {
  // в истории не храним разложение налоговой базы — оно пересчитывается и раздувает файл
  const slim = (state.history || []).map((h) => { const { revenueParts: _revenueParts, ...rest } = h; return rest; });
  return { app: 'economic-panel', v: SAVE_VERSION, savedAt: new Date().toISOString(), ...state, history: slim };
}
function validateSnapshot(data) {
  if (!data || data.app !== 'economic-panel') throw new Error('Это не сохранение «Экономической панели».');
  if (!data.setup || !data.economy || !Array.isArray(data.history)) throw new Error('Сохранение повреждено: не хватает состояния экономики.');
  if (data.v > SAVE_VERSION) throw new Error('Сохранение сделано в более новой версии симулятора.');
  return data;
}

/* Player ID — единственное, что остаётся на клиенте: без него некому
   адресовать слоты на сервере (аккаунтов в игре нет). Сама партия — экономика,
   история, декэижны — целиком лежит на сервере, как и сетевые комнаты. */
const PLAYER_ID_KEY = 'ems-player-id';
// собственный идентификатор устройства, отложенный при связывании: «отвязать»
// должно возвращать сюда, а не заводить пустой профиль с нуля
const OWN_PLAYER_ID_KEY = 'ems-own-player-id';
// и снимок собственного прогресса на момент связывания — чтобы «отвязать» вернуло
// ровно то, что было, а не общую коллекцию, собранную с двух устройств
const OWN_PROGRESS_KEY = 'ems-own-progress';
const getPlayerId = () => {
  const fresh = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `p${Date.now()}${Math.random().toString(36).slice(2)}`;
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) { id = fresh(); localStorage.setItem(PLAYER_ID_KEY, id); }
    return id;
  } catch { return fresh(); /* приватный режим — слоты проработают только эту вкладку */ }
};
/* Переключение профиля. При первом связывании прячем свой прежний идентификатор:
   партии, сохранённые до связывания, никуда не деваются — они остаются под старым
   профилем и возвращаются, если устройство отвязать. */
const setPlayerId = (id, { keepOwn = true } = {}) => {
  try {
    if (keepOwn && !localStorage.getItem(OWN_PLAYER_ID_KEY)) {
      const cur = localStorage.getItem(PLAYER_ID_KEY);
      if (cur && cur !== id) {
        localStorage.setItem(OWN_PLAYER_ID_KEY, cur);
        localStorage.setItem(OWN_PROGRESS_KEY, JSON.stringify(readLocalProgress()));
      }
    }
    localStorage.setItem(PLAYER_ID_KEY, id);
  } catch { /* приватный режим */ }
  return id;
};
const getOwnPlayerId = () => { try { return localStorage.getItem(OWN_PLAYER_ID_KEY); } catch { return null; } };
const unlinkDevice = () => {
  const own = getOwnPlayerId();
  if (!own) return null;
  try {
    // возвращаем и прогресс: иначе собственный профиль устройства унаследовал бы
    // достижения соседнего — связывание не должно оставлять следов после отмены
    const saved = localStorage.getItem(OWN_PROGRESS_KEY);
    if (saved) writeLocalProgress(JSON.parse(saved));
    localStorage.setItem(PLAYER_ID_KEY, own);
    localStorage.removeItem(OWN_PLAYER_ID_KEY);
    localStorage.removeItem(OWN_PROGRESS_KEY);
  } catch { /* приватный режим */ }
  return own;
};
// профиль показываем человеку коротким «отпечатком»: полный id — это, по сути,
// ключ от сохранений, и светить его на экране незачем
const profileTag = (id) => (typeof id === 'string' && id.length >= 6
  ? id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() : '—');

/* Достижения: коллекция привязана к устройству (localStorage), а не к
   конкретному сохранению партии — открытое достижение остаётся открытым
   даже после «Начать заново» или удаления сохранения. */
const ACHIEVEMENTS_KEY = 'ems-achievements';
const ROLES_PLAYED_KEY = 'ems-roles-played';
const NETWORK_PLAYED_KEY = 'ems-network-played';
const ALL_ROLE_IDS = ['central_bank', 'ministry_finance', 'full_control', 'president', 'trader'];
const ACHIEVEMENTS = [
  { id: 'first_quarter', icon: '🎬', title: 'Первый квартал', desc: 'Заверши первый квартал у руля экономики.' },
  { id: 'survivor_20', icon: '🗓️', title: 'Ветеран', desc: 'Продержись 20 кварталов в одной партии.' },
  { id: 'survivor_40', icon: '📜', title: 'Долгожитель', desc: 'Продержись 40 кварталов в одной партии.' },
  { id: 'inflation_target', icon: '🎯', title: 'В яблочко', desc: 'Играя за Центробанк, удержи инфляцию рядом с целью 8 кварталов подряд.' },
  { id: 'gdp_double', icon: '📈', title: 'Удвоение', desc: 'Удвой реальный ВВП от старта партии.' },
  { id: 'low_unemployment', icon: '🧑‍🏭', title: 'Полная занятость', desc: 'Опусти безработицу ниже 4%.' },
  { id: 'debt_control', icon: '🏦', title: 'Долговая дисциплина', desc: 'Играя за Минфин, снизь госдолг ниже 35% ВВП.' },
  { id: 'survived_crisis', icon: '⛈️', title: 'Пережили бурю', desc: 'Выведи страну из кризисного режима обратно к норме.' },
  { id: 'won_election', icon: '🗳️', title: 'Мандат доверия', desc: 'Останься у власти на выборах.' },
  { id: 'all_roles', icon: '🎭', title: 'Все ветви власти', desc: 'Доведи до конца хотя бы один квартал за Центробанк, Минфин, премьер-министра, президента и трейдера.' },
  { id: 'network_played', icon: '🌐', title: 'На двоих', desc: 'Доиграй хотя бы один квартал в партии по сети.' },
  { id: 'casino_win', icon: '🎲', title: 'Дебют в казино', desc: 'Выиграй свою первую ставку в казино.' },
  { id: 'casino_jackpot', icon: '💰', title: 'Куш', desc: 'Выиграй разом от 30 млн в одной игре казино.' },
  { id: 'casino_ahead', icon: '🥂', title: 'Дом не всегда выигрывает', desc: 'Уйди из казино в плюс на 50 млн суммарно за партию.' },
  { id: 'margin_call', icon: '⚠️', title: 'Маржин-колл', desc: 'Переживи принудительное закрытие позиций брокером и продолжи торговать.' },
  { id: 'tutorial_done', icon: '🎓', title: 'Курс молодого бойца', desc: 'Пройди первый модуль обучения.' },
  { id: 'tutorial_course_done', icon: '🏅', title: 'Экономист', desc: 'Пройди базовый курс целиком, вместе с экзаменом.' },
  { id: 'course_trader', icon: '📊', title: 'Аналитик', desc: 'Пройди курс частного инвестора целиком, вместе с экзаменом.' },
  { id: 'course_president', icon: '🏛️', title: 'Государственный ум', desc: 'Пройди курс президента целиком, вместе с экзаменом.' },
  { id: 'course_all', icon: '🎓', title: 'Красный диплом', desc: 'Пройди все три курса обучения и сдай все три экзамена.' },
  { id: 'promises_kept', icon: '🤝', title: 'Слово держат', desc: 'Дойди до выборов, сдержав все три предвыборных обещания (премьер-министр или президент).' },
  { id: 'reformer', icon: '🏗️', title: 'Реформатор', desc: 'Проведи три структурные реформы за одну партию (президент).' },
  { id: 'own_hands', icon: '🕊️', title: 'Своими руками', desc: 'Играя за президента, верни парламент, который сам же и распустил.' },
  { id: 'iron_president', icon: '🎖️', title: 'Железная рука', desc: 'Играя за президента, доведи страну до тоталитарного режима.' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const loadUnlockedAchievements = () => { try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '{}'); } catch { return {}; } };
const loadRolesPlayed = () => { try { return JSON.parse(localStorage.getItem(ROLES_PLAYED_KEY) || '[]'); } catch { return []; } };
const isNetworkPlayed = () => { try { return localStorage.getItem(NETWORK_PLAYED_KEY) === '1'; } catch { return false; } };
const markNetworkPlayed = () => { try { localStorage.setItem(NETWORK_PLAYED_KEY, '1'); } catch { /* приватный режим */ } };
const recordRolePlayed = (role) => {
  const arr = loadRolesPlayed();
  if (!role || arr.includes(role)) return arr;
  const next = [...arr, role];
  try { localStorage.setItem(ROLES_PLAYED_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
  return next;
};
// помечает переданные id разблокированными (если ещё не были) и возвращает
// только реально НОВЫЕ разблокировки — этот список идёт в тост
function unlockAchievements(ids) {
  if (!ids || !ids.length) return [];
  const cur = loadUnlockedAchievements();
  const fresh = [];
  ids.forEach((id) => { if (!cur[id] && ACH_BY_ID[id]) { cur[id] = Date.now(); fresh.push(ACH_BY_ID[id]); } });
  if (fresh.length) { try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(cur)); } catch { /* приватный режим */ } }
  return fresh;
}
/* Весь прогресс устройства одним объектом: достижения, сыгранные роли, сетевая
   партия, пройденные курсы и незаконченные модули. Это то, что переезжает вместе
   с профилем при связывании устройств, — слоты сохранений и так лежат на сервере.
   COURSE_PROGRESS_KEY и MODULE_STATE_KEY объявлены ниже по файлу: функции
   вызываются уже после того, как модуль целиком выполнен, так что это безопасно. */
const readLocalProgress = () => ({
  achievements: loadUnlockedAchievements(),
  roles: loadRolesPlayed(),
  network: isNetworkPlayed(),
  courses: loadCourseProgress(),
  modules: loadModuleState(),
});
const writeLocalProgress = (profile) => {
  if (!profile) return;
  try {
    if (profile.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(profile.achievements));
    if (profile.roles) localStorage.setItem(ROLES_PLAYED_KEY, JSON.stringify(profile.roles));
    if (profile.network) localStorage.setItem(NETWORK_PLAYED_KEY, '1');
    else localStorage.removeItem(NETWORK_PLAYED_KEY);
    if (profile.courses) localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(profile.courses));
    if (profile.modules) localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(profile.modules));
  } catch { /* приватный режим */ }
};
/* Синхронизация прогресса — всегда двусторонняя и всегда объединением: отправляем
   своё, получаем общее, записываем обратно. Ошибка сети тут ничего не ломает:
   локальные данные остаются как были, а следующий заход в меню попробует снова. */
async function syncProfile(playerId) {
  try {
    const profile = await syncProgress(playerId, readLocalProgress());
    writeLocalProgress(profile);
    return profile;
  } catch { return null; }
}

// сколько кварталов подряд (считая с конца истории) инфляция была в пределах ±0.5 п.п. от цели
function inflationOnTargetStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.inflation == null || h.inflationTarget == null) break;
    if (Math.abs(h.inflation - h.inflationTarget) <= 0.5) streak++; else break;
  }
  return streak;
}
// кризисный режим был активен где-то в истории партии, а сейчас — нет
function survivedCrisis(history) {
  if (!history || history.length < 2) return false;
  const last = history[history.length - 1];
  if ((last.activeCrises || []).length > 0) return false;
  return history.slice(0, -1).some((h) => (h.activeCrises || []).length > 0);
}
function questProgressAchievementIds({ quarterIndex, economy, history, rolesPlayed, networkPlayed, lastEvents, role }) {
  const ids = [];
  if (quarterIndex >= 1) ids.push('first_quarter');
  if (quarterIndex >= 20) ids.push('survivor_20');
  if (quarterIndex >= 40) ids.push('survivor_40');
  if (role === 'central_bank' && inflationOnTargetStreak(history) >= 8) ids.push('inflation_target');
  if (history && history.length > 1 && history[0].gdp > 0 && economy.gdp >= history[0].gdp * 2) ids.push('gdp_double');
  if (economy.unemployment < 4) ids.push('low_unemployment');
  if (role === 'ministry_finance' && economy.debtToGdp < 35) ids.push('debt_control');
  if (survivedCrisis(history)) ids.push('survived_crisis');
  if (economy.electionResult === 'incumbent') ids.push('won_election');
  if (rolesPlayed && ALL_ROLE_IDS.every((r) => rolesPlayed.includes(r))) ids.push('all_roles');
  if (networkPlayed) ids.push('network_played');
  if ((lastEvents || []).some((e) => e.kind === 'call')) ids.push('margin_call');
  if (role === 'president') {
    if (Object.keys(economy.reforms || {}).length >= 3) ids.push('reformer');
    if (economy.politicalRegime === 'totalitarian') ids.push('iron_president');
  }
  return ids;
}
function casinoAchievementIds({ net, casinoNet }) {
  const ids = [];
  if (net > 0) ids.push('casino_win');
  if (net >= 30) ids.push('casino_jackpot');
  if (casinoNet >= 50) ids.push('casino_ahead');
  return ids;
}
// очередь тостов «достижение открыто» — общая для соло- и сетевого экрана
function useAchievementToasts() {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const queueRef = React.useRef([]);
  const showingRef = React.useRef(false);
  const showTimerRef = React.useRef(null);
  const leaveTimerRef = React.useRef(null);
  const advance = React.useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      showingRef.current = true;
      setToast(next); setLeaving(false);
      Audio.play('coin');
      showTimerRef.current = setTimeout(() => {
        setLeaving(true);
        leaveTimerRef.current = setTimeout(advance, 450); // время на анимацию исчезновения
      }, 3800);
    } else {
      showingRef.current = false;
      setToast(null); setLeaving(false);
    }
  }, []);
  React.useEffect(() => () => { clearTimeout(showTimerRef.current); clearTimeout(leaveTimerRef.current); }, []);
  const push = React.useCallback((list) => {
    if (!list || !list.length) return;
    queueRef.current.push(...list);
    if (!showingRef.current) advance();
  }, [advance]);
  return { toast, leaving, push };
}
// Конфетти — фиксированный набор мелких прямоугольников с разлётом наружу через
// CSS-переменные; пересоздаётся только когда меняется само достижение (по toast.id),
// а не на каждый ре-рендер, иначе разлёт «дёргался» бы при любом обновлении родителя.
const CONFETTI_COLORS = ['#C9A227', '#E8C766', '#4E9A82', '#B0503A', '#5B7FA6', '#EDE7D6'];
function useConfettiPieces(seed, count = 16) {
  return React.useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 34 + Math.random() * 46;
    return {
      key: i,
      dx: `${(Math.cos(angle) * dist).toFixed(1)}px`,
      dy: `${(Math.sin(angle) * dist - 14 - Math.random() * 18).toFixed(1)}px`,
      rot: `${Math.round((Math.random() - 0.5) * 520)}deg`,
      delay: `${(Math.random() * 0.12).toFixed(2)}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 4 + Math.round(Math.random() * 3),
      h: 7 + Math.round(Math.random() * 5),
    };
  }), [seed, count]);
}
const AchievementToast = ({ toast, leaving }) => {
  const pieces = useConfettiPieces(toast ? toast.id : null);
  if (!toast) return null;
  return (
    <div className={`ems-panel-raised ${leaving ? 'ems-toast-out' : 'ems-fade-in'}`} style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 90, maxWidth: 300,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderColor: COLOR.gold, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', overflow: 'visible' }}>
      <span style={{ position: 'relative', fontSize: 26, lineHeight: 1 }}>
        {toast.icon}
        {!leaving && pieces.map((p) => (
          <span key={p.key} className="ems-confetti-piece" style={{
            position: 'absolute', top: '50%', left: '50%', width: p.w, height: p.h, background: p.color,
            '--dx': p.dx, '--dy': p.dy, '--rot': p.rot, animationDelay: p.delay,
          }} />
        ))}
      </span>
      <div>
        <div style={{ fontSize: 10, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Достижение открыто</div>
        <div className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft, marginTop: 1 }}>{toast.title}</div>
      </div>
    </div>
  );
};
/* ============================ СВЯЗЫВАНИЕ УСТРОЙСТВ ============================
   Аккаунтов в игре нет: профиль — это идентификатор, который лежит в localStorage
   и адресует слоты на сервере. Связать телефон с компьютером значит дать им один
   и тот же идентификатор: устройство, где партии уже есть, показывает одноразовый
   код, второе его вводит. Прогресс (достижения, курсы) при этом не заменяется, а
   объединяется — открытое на телефоне остаётся открытым. */
function DeviceLinkModal({ playerId, onClose, onLinked }) {
  const [tab, setTab] = useState('show');      // show — показать код, enter — ввести
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);      // сколько партий приехало с профилем
  const [doneKind, setDoneKind] = useState('linked'); // чем кончилось: связали или разорвали
  const [now, setNow] = useState(Date.now());
  // без общего хранилища (Redis) код физически не доедет до второго устройства:
  // серверная функция держит его в памяти одного случайного вызова
  const [noStorage, setNoStorage] = useState(false);
  const linkedTo = getOwnPlayerId();
  // общий ли сейчас профиль — знает сервер: отметка ставится в момент обмена кодом
  // и видна ОБОИМ устройствам, а не только тому, которое вводило код
  const [shared, setShared] = useState(false);
  React.useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((pf) => { if (alive && pf && pf.linkedAt) setShared(true); });
    return () => { alive = false; };
  }, [playerId]);

  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // пока код на экране, спрашиваем сервер, не ввели ли его на втором устройстве:
  // человеку важно увидеть «готово» здесь, а не бежать проверять обратно
  React.useEffect(() => {
    if (!code || claimed) return undefined;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await checkLinkCode(playerId, code);
        if (stop) return;
        if (r.claimed) { setClaimed(true); Audio.play('up'); return; }
        if (r.expired) { setCode(null); return; }
      } catch { /* сеть подождёт до следующей попытки */ }
      if (!stop) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 2500);
    return () => { stop = true; clearTimeout(t); };
  }, [code, claimed, playerId]);

  const left = code && !claimed ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0;
  React.useEffect(() => { if (code && !claimed && expiresAt && left <= 0) setCode(null); }, [left, code, claimed, expiresAt]);

  const makeCode = async () => {
    setBusy(true); setError(''); setClaimed(false);
    try {
      const r = await createLinkCode(playerId, readLocalProgress());
      setCode(r.code); setExpiresAt(r.expiresAt); setNoStorage(r.storage === 'memory'); Audio.play('stamp');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const dropCode = async () => {
    const c = code; setCode(null); setClaimed(false);
    if (c) { try { await cancelLinkCode(playerId, c); } catch { /* код и сам протухнет */ } }
  };
  const submitCode = async () => {
    setBusy(true); setError('');
    try {
      const r = await claimLinkCode(playerId, input, readLocalProgress());
      setPlayerId(r.playerId);
      writeLocalProgress(r.profile);
      setDone((r.slots || []).filter(Boolean).length);
      Audio.play('up');
      onLinked(r.playerId);
    } catch (e) { setError(e.message); Audio.play('down'); } finally { setBusy(false); }
  };
  const doRevoke = async () => {
    if (!window.confirm('Разорвать связку? Это устройство продолжит с копией общего профиля — сохранения, достижения и курсы останутся при нём. Второе устройство останется на прежнем профиле со своей копией, но общими они больше не будут.')) return;
    setBusy(true); setError('');
    try {
      const r = await revokeLink(playerId, readLocalProgress());
      setPlayerId(r.playerId, { keepOwn: false });
      writeLocalProgress(r.profile);
      setShared(false);
      setDoneKind('revoked');
      setDone((r.slots || []).filter(Boolean).length);
      Audio.play('click');
      onLinked(r.playerId);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const doUnlink = () => {
    if (!window.confirm('Отвязать это устройство? Вернутся сохранения и прогресс, которые были на нём до связывания. Партии общего профиля останутся на другом устройстве.')) return;
    const own = unlinkDevice();
    if (own) { Audio.play('click'); onLinked(own); onClose(); }
  };
  const pretty = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 480, width: '100%', maxHeight: '86vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Smartphone size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Связать устройства</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Сохранения лежат на сервере и адресуются профилем этого устройства
          (<b className="ems-mono" style={{ color: COLOR.goldSoft }}>{profileTag(playerId)}</b>). Свяжите телефон с компьютером — и
          у них будет один профиль: общие слоты сохранений, достижения и пройденные курсы.
        </div>

        {done !== null ? (
          <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.teal }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Check size={14} color={COLOR.teal} />
              <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.teal }}>
                {doneKind === 'revoked' ? 'Связка разорвана' : 'Устройства связаны'}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>
              {doneKind === 'revoked'
                ? <>Это устройство перешло на собственный профиль с копией всего, что было общим:
                  {done ? ` ${done} ${done === 1 ? 'сохранение' : done < 5 ? 'сохранения' : 'сохранений'} на месте` : ' сохранений в нём не было'},
                  достижения и курсы тоже. Второе устройство осталось на прежнем профиле — со своей копией.</>
                : <>Профиль теперь общий: {done ? `${done} ${done === 1 ? 'сохранение доступно' : done < 5 ? 'сохранения доступны' : 'сохранений доступно'} на этом устройстве` : 'общих сохранений пока нет'}.
                  Достижения и курсы обоих устройств объединены.</>}
            </div>
            <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0', marginTop: 11 }} onClick={onClose}>Готово</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[['show', 'Показать код'], ['enter', 'Ввести код']].map(([id, title]) => (
                <span key={id} className={`ems-tab ${tab === id ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 12.5 }}
                  onClick={() => { Audio.play('tab'); setTab(id); setError(''); }}>{title}</span>
              ))}
            </div>

            {tab === 'show' && (
              <div>
                <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 11, lineHeight: 1.5 }}>
                  Показывайте код на том устройстве, где партии уже есть, — второе получит доступ к ним.
                  Код действует десять минут и срабатывает один раз.
                </div>
                {code ? (
                  <div className="ems-panel" style={{ padding: 14, textAlign: 'center', borderColor: claimed ? COLOR.teal : COLOR.gold }}>
                    <div className="ems-mono" style={{ fontSize: 30, letterSpacing: '0.12em', color: claimed ? COLOR.teal : COLOR.goldSoft }}>{pretty(code)}</div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.45 }}>
                      {claimed
                        ? 'Второе устройство подключено. Теперь у вас общий профиль.'
                        : <>Введите этот код на втором устройстве: меню → «Связать устройства» → «Ввести код».
                          <span style={{ display: 'block', color: left < 60 ? COLOR.rust : COLOR.faint, marginTop: 4 }}>
                            действует ещё {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                          </span></>}
                    </div>
                    <button className="ems-btn" style={{ width: '100%', padding: '9px 0', marginTop: 11, fontSize: 12 }}
                      onClick={() => { Audio.play('click'); if (claimed) onClose(); else dropCode(); }}>
                      {claimed ? 'Готово' : 'Отменить код'}
                    </button>
                  </div>
                ) : (
                  <button className="ems-btn primary" disabled={busy} style={{ width: '100%', padding: '11px 0' }} onClick={makeCode}>
                    {busy ? 'Готовим…' : 'Показать код'}
                  </button>
                )}
              </div>
            )}

            {tab === 'enter' && (
              <div>
                <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 11, lineHeight: 1.5 }}>
                  Введите код со второго устройства. Это устройство перейдёт на его профиль: сохранения станут общими,
                  достижения и курсы — объединятся. Партии, сохранённые здесь раньше, не пропадут — они останутся
                  под прежним профилем и вернутся, если устройство отвязать.
                </div>
                <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="XXXX-XXXX"
                  className="ems-mono" style={{ width: '100%', padding: '11px 12px', fontSize: 18, letterSpacing: '0.1em', textAlign: 'center',
                    background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
                <button className="ems-btn primary" disabled={busy || input.replace(/[^A-Z0-9]/g, '').length < 8}
                  style={{ width: '100%', padding: '11px 0', marginTop: 10 }} onClick={submitCode}>
                  {busy ? 'Связываем…' : 'Связать'}
                </button>
              </div>
            )}

            {error && <div style={{ marginTop: 10, fontSize: 11.5, color: COLOR.rust, lineHeight: 1.45 }}>{error}</div>}

            {noStorage && (
              <div className="ems-panel" style={{ marginTop: 11, padding: 11, borderColor: COLOR.rust, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: COLOR.rust, lineHeight: 1.45 }}>
                  Сервер не подключён к общему хранилищу — код живёт в памяти одного случайного запроса и со второго
                  устройства, скорее всего, не найдётся. Это настройка развёртывания
                  (<b className="ems-mono">KV_REST_API_URL</b>/<b className="ems-mono">KV_REST_API_TOKEN</b>), а не ошибка ввода.
                </div>
              </div>
            )}

            {shared && !linkedTo && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLOR.hairline}` }}>
                <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 7, lineHeight: 1.45 }}>
                  Профиль общий с другим устройством. Разорвать связку можно и отсюда: это устройство заберёт
                  копию профиля и сохранений себе, второе останется на прежнем — но общими они быть перестанут.
                </div>
                <button className="ems-btn" disabled={busy} style={{ width: '100%', padding: '9px 0', fontSize: 12, color: COLOR.rust, borderColor: COLOR.rust }}
                  onClick={doRevoke}>Разорвать связку устройств</button>
              </div>
            )}

            {linkedTo && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLOR.hairline}` }}>
                <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 7, lineHeight: 1.45 }}>
                  Это устройство работает на общем профиле. Отвязать — значит вернуться к собственному
                  (<b className="ems-mono">{profileTag(linkedTo)}</b>) со своими прежними сохранениями.
                </div>
                <button className="ems-btn" style={{ width: '100%', padding: '9px 0', fontSize: 12, color: COLOR.rust, borderColor: COLOR.rust }}
                  onClick={doUnlink}>Отвязать это устройство</button>
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45 }}>
              Наборы показателей на дашборде и оформление остаются у каждого устройства своими — это настройки экрана,
              а не прогресс.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AchievementsModal({ onClose }) {
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
        <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 14 }}>
          Открыто {count} из {ACHIEVEMENTS.length}. Привязано к профилю, а не к сохранению партии: «Начать заново»
          коллекцию не сбрасывает, а связанные устройства делят её на двоих.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const done = !!unlocked[a.id];
            return (
              <div key={a.id} className="ems-panel" style={{ padding: '9px 11px', display: 'flex', gap: 10, alignItems: 'flex-start',
                opacity: done ? 1 : 0.55, borderColor: done ? COLOR.gold : COLOR.border }}>
                <span style={{ fontSize: 22, lineHeight: 1, filter: done ? 'none' : 'grayscale(1)' }}>{done ? a.icon : <Lock size={18} color={COLOR.faint} />}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: done ? COLOR.goldSoft : COLOR.text }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Условия поражения. Без них достижения «Ветеран»/«Долгожитель» ничего не
   значат — партию нельзя не пройти, значит нечем гордиться, продержавшись.
   Гиперинфляция касается любой роли (страна одна на всех); поражение на
   выборах — только тех, кто реально отвечает перед избирателем; банкротство —
   только трейдера, который вне политики. Порог ЦБ (только при landslide) и
   Минфина (при любом исходе) намеренно разный: так же асимметрично уже
   работает смена персон бота после выборов в finishQuarter — независимость
   центробанка переживает обычное поражение партии власти, а министерский
   портфель нет. */
function checkDefeat({ role, economy, history, bookVal, presidentActive }) {
  // гиперинфляция — провал денежной/бюджетной политики; трейдер её не проводит и
  // повлиять на неё не может, так что и мандата за неё лишаться ему не за что
  if (role !== 'trader' && history && history.length >= 4) {
    const last4 = history.slice(-4);
    if (last4.every((h) => h.inflation != null && h.inflation >= 40)) {
      return { id: 'hyperinflation', title: 'Гиперинфляционный коллапс',
        text: `Инфляция держится выше 40% четыре квартала подряд (сейчас ${fmt1(economy.inflation)}%). Деньги теряют смысл быстрее, чем правительство успевает отреагировать — экономика срывается в неуправляемую спираль, а вместе с ней и ваш мандат.` };
    }
  }
  /* Импичмент — поражение, доступное только президенту: у него нет ползунков,
     которыми можно было бы отыграться, зато есть политический капитал. Когда он
     обнулён, а рейтинг третий квартал подряд ниже 30, парламент отстраняет
     президента, не дожидаясь выборов. При распущенном парламенте отстранять
     некому — там страну ждёт другой сценарий. */
  if (role === 'president' && history && history.length >= 3 && !economy.parliamentDissolved) {
    const last3 = history.slice(-3);
    if (last3.every((h) => (h.politicalCapital != null && h.politicalCapital <= 2) && h.approval < 30)) {
      return { id: 'impeachment', title: 'Импичмент',
        text: `Политический капитал исчерпан, рейтинг ${Math.round(economy.approval)} из 100 третий квартал подряд. Парламент отстраняет президента от должности: власть, которая ничего не может предложить и ничем не может заплатить, перестаёт быть властью раньше, чем наступают выборы.` };
    }
  }
  /* Отставка по решению президента: доступна только там, где президент вообще есть.
     Два квартала на нуле — чтобы увольнение не прилетало от одного неудачного
     квартала, а полоса отношения успела побыть красной. */
  if (presidentActive && history && history.length >= 2 && (role === 'central_bank' || role === 'ministry_finance')) {
    const last2 = history.slice(-2);
    if (last2.every((h) => Number.isFinite(h.presidentSatisfaction) && h.presidentSatisfaction <= 4)) {
      return { id: 'dismissal', title: 'Отставка по решению президента',
        text: `Администрация исчерпала терпение: требования президента игнорировались, а результат их не оправдал. ${role === 'central_bank' ? 'Главу Центрального банка' : 'Министра финансов'} освобождают от должности — формально «по собственному желанию».` };
    }
  }
  /* Потеря власти не у урны: восстание или армия. При тоталитарном режиме выборов
     нет вовсе, и это единственный способ проиграть — зато настоящий. Трейдера это
     не касается: он не власть. */
  if (role !== 'trader' && economy.powerLost) {
    return economy.powerLost === 'military'
      ? { id: 'military_coup', title: 'Военный переворот',
        text: `Армия заняла правительственные здания при напряжённости ${Math.round(economy.politicalTension || 0)} из 100 и рейтинге ${Math.round(economy.approval)}. Власть, отменившую выборы, снимают с должности не голосованием — и не спрашивая.` }
      : { id: 'uprising', title: 'Режим пал',
        text: `Массовые протесты и раскол элит вынудили власть отступить. Напряжённость ${Math.round(economy.politicalTension || 0)} из 100: удерживать страну силой дороже, чем управлять ею.` };
  }
  const er = economy.electionResult;
  if (er && er !== 'incumbent' && (role === 'full_control' || role === 'president' || role === 'ministry_finance' || (role === 'central_bank' && er === 'landslide'))) {
    return { id: 'election_defeat', title: er === 'landslide' ? 'Сокрушительное поражение на выборах' : 'Поражение на выборах',
      text: `Рейтинг власти упал до ${Math.round(economy.approval)} из 100. ${er === 'landslide' ? 'Оппозиция побеждает с разгромным перевесом — вместе с прежним курсом уходите и вы.' : 'Избиратели выбрали другой курс, и вместе с ним приходит другое руководство.'}` };
  }
  // settleQuarter сам не даёт капиталу уйти ниже 0.05 (сбрасывает счёт на этот
  // минимум) — поэтому банкротство проверяем по <=, а не по <: иначе порог
  // никогда не сработает, ведь bookVal после расчёта всегда достанет до пола
  if (role === 'trader' && bookVal != null && bookVal <= 0.05) {
    return { id: 'bankruptcy', title: 'Банкротство', text: 'Капитал исчерпан, обеспечения для новых позиций больше нет — играть не на что.' };
  }
  return null;
}
function GameOverModal({ defeat, quarterIndex, onClose, onRestart, onOpenAch, onShare, restartLabel = 'Начать заново' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 460, width: '100%', padding: 26, textAlign: 'center', borderColor: COLOR.rust }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
        <div className="ems-serif" style={{ fontSize: 19, color: COLOR.rust, marginBottom: 10 }}>{defeat.title}</div>
        <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.6 }}>{defeat.text}</div>
        <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 12 }}>Партия окончена на {quarterLabel(quarterIndex)} — {quarterIndex} кв. у руля.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button className="ems-btn" onClick={onShare}><Share2 size={13} color={COLOR.gold} style={{ verticalAlign: -2, marginRight: 5 }} />Поделиться</button>
          <button className="ems-btn" onClick={onOpenAch}><Trophy size={13} color={COLOR.gold} style={{ verticalAlign: -2, marginRight: 5 }} />Коллекция</button>
          <button className="ems-btn primary" onClick={onRestart}>{restartLabel}</button>
        </div>
      </div>
    </div>
  );
}
const GameOverBar = ({ defeat, onReopen, onRestart, restartLabel = 'Начать заново' }) => (
  <div style={{ borderTop: `2px solid ${COLOR.rust}`, background: COLOR.panel, padding: '14px 18px',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
    boxShadow: '0 -6px 20px -8px rgba(0,0,0,0.45)' }}>
    <span style={{ fontSize: 12, color: COLOR.rust, marginRight: 'auto', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
      <AlertTriangle size={14} />Партия окончена: {defeat.title}
    </span>
    <button className="ems-btn" style={{ padding: '10px 16px', fontSize: 12.5 }} onClick={onReopen}>Подробнее</button>
    <button className="ems-btn primary" style={{ padding: '10px 20px', fontSize: 12.5 }} onClick={onRestart}>{restartLabel}</button>
  </div>
);

/* Карточка результата: не только на конце партии (поражение), но и в любой
   момент по кнопке в шапке — так шансов поделиться и позвать друга в сеть
   больше, чем ждать финала. Рисуется на canvas и скачивается/копируется как
   текст: ни бэкенда, ни аккаунтов для «шаринга» этой игре не требуется. */
const RESULT_CARD_EMOJI = { central_bank: '🏛️', ministry_finance: '💰', full_control: '👑', president: '🎖️', trader: '📈' };
function ruPlural(n, one, few, many) {
  const n10 = n % 10; const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}
const countUnlockedAchievements = () => { const u = loadUnlockedAchievements(); return ACHIEVEMENTS.filter((a) => u[a.id]).length; };
function buildResultCard({ role, quarterIndex, economy, startEconomy, portfolio, defeat, promises }) {
  const roleLabel = (ROLES.find((r) => r.id === role) || {}).short || role;
  const isTrader = role === 'trader';
  const stats = [];
  if (isTrader && portfolio) {
    const val = bookValue(portfolio, economy, null);
    const start = portfolio.startValue || 10;
    const ret = ((val / start) - 1) * 100;
    stats.push(['Капитал', fmtMln(val)]);
    stats.push(['Доходность', `${ret >= 0 ? '+' : ''}${ret.toFixed(0)}%`]);
    stats.push(['Сделок на рынке', String((portfolio.trades || []).length)]);
    stats.push(['Итог казино', fmtMlnSigned(portfolio.casinoNet || 0)]);
  } else {
    const gdpChange = startEconomy && startEconomy.gdp > 0 ? ((economy.gdp / startEconomy.gdp) - 1) * 100 : null;
    stats.push(['ВВП с начала партии', gdpChange != null ? `${gdpChange >= 0 ? '+' : ''}${gdpChange.toFixed(0)}%` : '—']);
    stats.push(['Инфляция', `${fmt1(economy.inflation)}%`]);
    stats.push(['Безработица', `${fmt1(economy.unemployment)}%`]);
    if (role === 'full_control' && promises && promises.length) {
      const keptCount = promises.filter((p) => evaluatePromise(p, economy).met).length;
      stats.push(['Обещания сдержаны', `${keptCount} из ${promises.length}`]);
    } else {
      stats.push(['Долг к ВВП', `${fmt1(economy.debtToGdp)}%`]);
    }
  }
  return {
    roleLabel, emoji: RESULT_CARD_EMOJI[role] || '🏛️',
    quarterIndex, quarterWord: ruPlural(quarterIndex, 'квартал', 'квартала', 'кварталов'),
    years: (quarterIndex / 4).toFixed(1),
    outcome: defeat ? defeat.title : 'Партия продолжается',
    isDefeat: !!defeat, stats, unlockedCount: countUnlockedAchievements(),
  };
}
function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawResultCard(canvas, data) {
  const W = 1000; const H = 625; const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;
  // размер на экране задаёт CSS (width:100%, height:auto на самом <canvas>) —
  // если продублировать его тут через canvas.style, эффект перетрёт инлайн-стиль
  // React и картинка перестанет вписываться в модалку при её ширине < 1000px
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.fillStyle = COLOR.bg; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 700);
  grad.addColorStop(0, COLOR.bgVignette); grad.addColorStop(1, COLOR.bg);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLOR.gold; ctx.fillRect(0, 0, W, 4);
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.goldSoft;
  ctx.font = `600 14px ${FONT.sans}`;
  ctx.fillText('С Т Р А Н А   —   Э К О Н О М И Ч Е С К А Я   П А Н Е Л Ь', W / 2, 46);

  ctx.fillStyle = COLOR.text;
  ctx.font = `700 38px ${FONT.serif}`;
  ctx.fillText(`${data.emoji}  ${data.roleLabel}`, W / 2, 106);

  ctx.fillStyle = COLOR.gold;
  ctx.font = `800 112px ${FONT.serif}`;
  ctx.fillText(String(data.quarterIndex), W / 2, 246);
  ctx.fillStyle = COLOR.muted;
  ctx.font = `500 17px ${FONT.sans}`;
  ctx.fillText(`${data.quarterWord} у руля  ·  ${data.years} лет`, W / 2, 278);

  ctx.font = `700 18px ${FONT.sans}`;
  const outcomeW = Math.min(820, ctx.measureText(data.outcome).width + 56);
  ctx.fillStyle = data.isDefeat ? COLOR.rustDim : COLOR.tealDim;
  canvasRoundRect(ctx, W / 2 - outcomeW / 2, 304, outcomeW, 44, 9); ctx.fill();
  ctx.fillStyle = data.isDefeat ? COLOR.rust : COLOR.teal;
  ctx.fillText(data.outcome, W / 2, 332);

  const cellW = 440; const cellH = 80; const gapX = 20; const gridTop = 384;
  const startX = W / 2 - cellW - gapX / 2;
  ctx.textAlign = 'left';
  data.stats.forEach((s, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = startX + col * (cellW + gapX); const y = gridTop + row * (cellH + 14);
    ctx.fillStyle = COLOR.panelAlt; canvasRoundRect(ctx, x, y, cellW, cellH, 8); ctx.fill();
    ctx.strokeStyle = COLOR.border; canvasRoundRect(ctx, x, y, cellW, cellH, 8); ctx.stroke();
    ctx.fillStyle = COLOR.muted; ctx.font = `500 14px ${FONT.sans}`;
    ctx.fillText(s[0], x + 22, y + 30);
    ctx.fillStyle = COLOR.text; ctx.font = `700 25px ${FONT.mono}`;
    ctx.fillText(s[1], x + 22, y + 62);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.faint;
  ctx.font = `500 14px ${FONT.sans}`;
  ctx.fillText(`🏆 Открыто ${data.unlockedCount} из ${ACHIEVEMENTS.length} достижений`, W / 2, H - 30);
}
function ResultCardModal({ data, onClose }) {
  const canvasRef = React.useRef(null);
  const [copied, setCopied] = useState(false);
  React.useEffect(() => { if (canvasRef.current) drawResultCard(canvasRef.current, data); }, [data]);
  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `ekonomicheskaya-panel-${data.quarterIndex}kv.png`;
    a.click();
    Audio.play('click');
  };
  const copyText = async () => {
    const lines = [
      'Экономическая панель государства',
      `Роль: ${data.roleLabel}`,
      `Отыграно: ${data.quarterIndex} ${data.quarterWord} (${data.years} лет)`,
      `Итог: ${data.outcome}`,
      ...data.stats.map(([k, v]) => `${k}: ${v}`),
      `Достижений: ${data.unlockedCount} из ${ACHIEVEMENTS.length}`,
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); Audio.play('click'); setTimeout(() => setCopied(false), 1800); }
    catch { /* буфер обмена недоступен — нет разрешения или не https */ }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 620, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Share2 size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Карточка результата</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6, border: `1px solid ${COLOR.border}` }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={copyText}>
            <Copy size={13} />{copied ? 'Скопировано' : 'Скопировать текст'}
          </button>
          <button className="ems-btn primary" style={{ flex: 1, padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={download}>
            <Download size={13} />Скачать картинку
          </button>
        </div>
      </div>
    </div>
  );
}

// столько же, сколько в api/solo.js: слоты хранятся на сервере, клиент только рисует
const SOLO_SLOT_COUNT = 4;
function SaveLoadModal({ mode, snapshot, onClose, onLoad }) {
  const [tab, setTab] = useState(mode || 'save');
  const [error, setError] = useState('');
  const [slots, setSlots] = useState(null); // null = ещё загружаются
  const [busyIdx, setBusyIdx] = useState(null);
  const [storageMode, setStorageMode] = useState(null);
  const playerId = useMemo(getPlayerId, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchSoloSlots(playerId).then((d) => { if (!cancelled) { setSlots(d.slots); setStorageMode(d.storage || null); } })
      .catch((e) => { if (!cancelled) { setSlots(Array.from({ length: SOLO_SLOT_COUNT }, () => null)); setError(e.message); } });
    return () => { cancelled = true; };
  }, [playerId]);

  // подпись слота: роль и квартал — то, по чему партию узнают, если ей не дали имени
  const slotLabel = (s) => {
    const roleTitle = (ROLES.find((r) => r.id === s.role) || {}).short || s.role;
    return `${roleTitle} · ${quarterLabel(Math.max(1, (s.quarterIndex || 1) - 1))}`;
  };
  const saveToSlot = async (idx) => {
    if (!snapshot) return;
    if (slots[idx] && !window.confirm(`Перезаписать «${slots[idx].name || `слот ${idx + 1}`}»?`)) return;
    setBusyIdx(idx); setError('');
    try { validateSnapshot(snapshot); setSlots(await saveSoloSlot(playerId, idx, snapshot)); Audio.play('stamp'); }
    catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };
  const renameSlot = async (idx) => {
    const cur = slots[idx];
    if (!cur) return;
    const next = window.prompt('Название сохранения (пусто — вернуть подпись по умолчанию):', cur.name || '');
    if (next === null) return;
    setBusyIdx(idx); setError('');
    try { setSlots(await renameSoloSlot(playerId, idx, next)); Audio.play('tick'); }
    catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };
  const loadFromSlot = async (idx) => {
    if (!slots[idx]) return;
    setBusyIdx(idx); setError('');
    try { const snap = validateSnapshot(await fetchSoloSlot(playerId, idx)); Audio.play('stamp'); onLoad(snap); }
    catch (e) { setError(e.message); setBusyIdx(null); }
  };
  const deleteSlot = async (idx) => {
    setBusyIdx(idx); setError('');
    try { setSlots(await deleteSoloSlot(playerId, idx)); }
    catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 480, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Save size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Сохранения</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[['save', 'Сохранить'], ['load', 'Загрузить']].map(([id, label]) => (
            <span key={id} className={`ems-tab ${tab === id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setTab(id); setError(''); }}>{label}</span>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10, lineHeight: 1.5 }}>
          {tab === 'save'
            ? `Партия хранится на сервере — как и сетевые комнаты. ${SOLO_SLOT_COUNT} слота на это устройство, каждому можно дать своё название.`
            : 'Выберите слот, чтобы вернуться в сохранённую партию. Текущая партия будет заменена.'}
        </div>
        {storageMode === 'memory' && (
          <div style={{ fontSize: 11, color: COLOR.rust, marginBottom: 10, lineHeight: 1.4 }}>
            Сервер не подключён к общему хранилищу — сохранение может пропасть между запросами.
          </div>
        )}

        {slots === null ? (
          <div style={{ fontSize: 12, color: COLOR.muted }}>Загружаем слоты…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((slot, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, fontSize: 12 }}>
                <span style={{ flex: 1, minWidth: 0, color: slot ? COLOR.text : COLOR.faint }}>
                  {slot ? (
                    <>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slot.name || `Слот ${idx + 1}`}
                      </span>
                      <span style={{ fontSize: 10.5, color: COLOR.faint }}>{slotLabel(slot)}</span>
                    </>
                  ) : `Слот ${idx + 1}: пусто`}
                </span>
                {slot && (
                  <button className="ems-btn" title="Переименовать сохранение" aria-label={`Переименовать слот ${idx + 1}`}
                    style={{ padding: '3px 7px', fontSize: 10, color: COLOR.faint }}
                    disabled={busyIdx === idx} onClick={() => renameSlot(idx)}>✎</button>
                )}
                {tab === 'save' && snapshot && (
                  <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 10.5 }} disabled={busyIdx === idx} onClick={() => saveToSlot(idx)}>
                    {busyIdx === idx ? 'Сохраняем…' : (slot ? 'Перезаписать' : 'Сохранить')}
                  </button>
                )}
                {tab === 'load' && slot && (
                  <>
                    <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 10.5 }} disabled={busyIdx === idx} onClick={() => loadFromSlot(idx)}>
                      {busyIdx === idx ? 'Загружаем…' : 'Загрузить'}
                    </button>
                    <button onClick={() => deleteSlot(idx)} aria-label={`Удалить слот ${idx + 1}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <div style={{ fontSize: 11.5, color: COLOR.rust, marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}

/* Бюджетная арифметика: почему баланс такой, какой он есть */
function FiscalMath({ economy, decisions }) {
  const growth = (v) => `${fmtSigned1(v)}%`;
  const rows = [
    ['Доходы бюджета', fmtMoney(economy.govRevenue), `${fmt1(economy.revenuePctGdp)}% ВВП`],
    ['Расходы всего', fmtMoney(economy.govSpendingTotal), `${fmt1(economy.govSpendingTotal / economy.nominalGdp * 100)}% ВВП`],
    ['· госзакупки', fmtMoney(economy.govPurchasesNominal), growth(economy.govPurchasesGrowth)],
    ['· выплаты', fmtMoney(economy.transfersNominal), growth(economy.transfersGrowth)],
    ['· инвестиции', fmtMoney(economy.govInvestmentNominal), growth(economy.govInvestmentGrowth)],
    ['· обслуживание долга', fmtMoney(economy.interestPayment), `ставка ${fmt1(economy.effectiveDebtRate)}%`],
  ];
  const bal = economy.budgetBalancePctGdp;
  const limit = economy.maxDeficitPct;
  const plan = decisions.govSpending * 0.62 + decisions.transfers * 0.27 + decisions.govInvestment * 0.11;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Scale size={13} />Бюджетная арифметика
      </div>
      {rows.map(([a, b, c]) => (
        <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '3px 0', color: a.startsWith('·') ? COLOR.muted : COLOR.text }}>
          <span>{a}</span>
          <span style={{ display: 'flex', gap: 9 }}>
            <span className="ems-mono">{b}</span>
            <span className="ems-mono" style={{ color: COLOR.faint, width: 68, textAlign: 'right' }}>{c}</span>
          </span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${COLOR.hairline}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Баланс</span>
        <span className="ems-mono" style={{ color: bal >= 0 ? COLOR.teal : COLOR.rust, fontWeight: 600 }}>{fmtSigned1(bal)}% ВВП</span>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
        Рычаги задают <b style={{ color: COLOR.muted }}>реальный рост сверх тренда</b>: ноль означает, что расходы растут вместе с экономикой, а не заморожены. Ваш текущий набор решений — {growth(plan)} к тренду.
        {Number.isFinite(limit) && <> Рынок готов финансировать дефицит до {fmt1(limit)}% ВВП; сверх этого начинается секвестр.</>}
        {economy.sequesterFactor < 0.995 && <span style={{ color: COLOR.rust }}> Сейчас расходы принудительно урезаны на {fmt1((1 - economy.sequesterFactor) * 100)}%.</span>}
      </div>
    </div>
  );
}

/* Сводка по ведомству, которым управляет бот */
const SUMMARY_TABS = {
  central_bank: { id: 'summary_cb', label: 'Сводка ЦБ', icon: Landmark, rows: [
    // ставка ходит шагом 0.25 п.п., а pctFmt округлял до десятых: 5.25% и 5.5%
    // выглядели как «5.3%» и «5.5%», то есть разный шаг казался одинаковым
    { key: 'keyRate', label: 'Ключевая ставка', fmt: (v) => `${fmt2(v)}%` },
    { key: 'inflationTarget', label: 'Цель ЦБ по инфляции', fmt: pctFmt },
    { key: 'inflation', label: 'Инфляция', fmt: pctFmt },
    { key: 'inflationExpectations', label: 'Ожидания', fmt: pctFmt },
    { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: (v) => v.toFixed(0) },
    { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
    { key: 'rStar', label: 'Нейтральная ставка r*', fmt: pctFmt },
    { key: 'rateGap', label: 'Жёсткость условий', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'capitalRequirement', label: 'Норматив капитала банков', fmt: pctFmt },
    { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
    { key: 'bankCapitalAdequacy', label: 'Достаточность капитала', fmt: pctFmt },
    { key: 'reserves', label: 'Резервы', fmt: fmtMoney },
    { label: 'Режим курса', get: (e) => e.fxRegime, text: true, map: { free: 'плавающий', managed: 'управляемый', peg: 'фиксированный' } },
  ] },
  ministry_finance: { id: 'summary_mof', label: 'Сводка Минфина', icon: Coins, rows: [
    { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
    { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
    { key: 'budgetBalancePctGdp', label: 'Баланс бюджета', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'structuralBalancePctGdp', label: 'Структурный баланс', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
    { key: 'interestToRevenue', label: 'Проценты к доходам', fmt: pctFmt },
    { key: 'fiscalImpulse', label: 'Бюджетный импульс', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'vatRate', label: 'НДС', fmt: pctFmt },
    { key: 'incomeTaxRate', label: 'Подоходный налог', fmt: pctFmt },
    { key: 'profitTaxRate', label: 'Налог на прибыль', fmt: pctFmt },
    { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt },
    { label: 'Доля образования', get: (e) => e.budgetShares.education, fmt: pctFmt },
    { label: 'Доля науки', get: (e) => e.budgetShares.science, fmt: pctFmt },
    { label: 'Доля здравоохранения', get: (e) => e.budgetShares.health, fmt: pctFmt },
  ] },
};
/* «Показатели экономики» — единственное место, где смотрят на ставку, норматив
   капитала, баланс бюджета и прочие цифры ведомств: раньше те же три-четыре
   значения ещё раз печатались прямо в карточке бота (см. BotPanel), и правка
   там неизбежно расходилась с тем, что показывала эта вкладка. При «обоих ботах»
   (президент, трейдер) нужны сразу обе сводки, а не только одна. */
const tabsForBotRole = (botRole) => (botRole === 'both' ? [...INDICATOR_TABS, SUMMARY_TABS.central_bank, SUMMARY_TABS.ministry_finance]
  : botRole && SUMMARY_TABS[botRole] ? [...INDICATOR_TABS, SUMMARY_TABS[botRole]] : INDICATOR_TABS);

/* Рычаги в миллиардах масштабируются вместе с экономикой, курсовой ориентир — вокруг текущего курса */
function scaleLever(l, e) {
  if (l.scale === 'gdp') {
    const k = Math.max(1, e.nominalGdp / CONFIG.initial.gdp);
    const mag = Math.max(5, Math.round(l.max * k / 5) * 5);
    return { ...l, min: -mag, max: mag, step: Math.max(1, Math.round(mag / 25)) };
  }
  if (l.id === 'fxTarget') {
    const cur = e.exchangeRate;
    return { ...l, min: Math.round(cur * 0.6), max: Math.round(cur * 1.6), step: 0.5 };
  }
  return l;
}


/* ============================ ТОРГОВЫЙ ТЕРМИНАЛ ============================ */
const INSTRUMENTS = [
  { id: 'eq_broad', name: 'Индекс акций', ticker: 'IDX', group: 'Акции', color: COLOR.gold, key: 'stockIndex', fee: 0.0015, kind: 'spot',
    note: 'Весь рынок целиком. Растёт на дешёвых деньгах и прибылях, падает на ставке и риске.' },
  { id: 'eq_banks', name: 'Банки (ETF)', ticker: 'BNK', group: 'Акции', color: COLOR.blue, key: 'sectorBanks', fee: 0.002, kind: 'spot',
    note: 'Живёт процентной маржой, умирает от просрочки и нормативов капитала.' },
  { id: 'eq_industry', name: 'Промышленность (ETF)', ticker: 'IND', group: 'Акции', color: COLOR.teal, key: 'sectorIndustry', fee: 0.002, kind: 'spot',
    note: 'Чувствительна к инвестиционному циклу и стоимости кредита.' },
  { id: 'eq_consumer', name: 'Потребительский (ETF)', ticker: 'CNS', group: 'Акции', color: COLOR.goldSoft, key: 'sectorConsumer', fee: 0.002, kind: 'spot',
    note: 'Зависит от реальных зарплат и уверенности домохозяйств.' },
  { id: 'eq_resources', name: 'Сырьевой (ETF)', ticker: 'RES', group: 'Акции', color: '#8E7CC3', key: 'sectorResources', fee: 0.002, kind: 'spot',
    note: 'Выигрывает от дорогого сырья и слабой валюты.' },
  { id: 'reit', name: 'Фонды недвижимости', ticker: 'RET', group: 'Акции', color: '#C08A6B', key: 'reitIndex', fee: 0.0025, kind: 'spot',
    note: 'Недвижимость переоценивается вслед за ставкой по кредитам и реальными доходами. Самый процентно-чувствительный актив.' },
  { id: 'eq_world', name: 'Мировые акции (ETF)', ticker: 'WLD', group: 'Акции', color: '#6BA9C0', key: 'worldEquityIndex', fee: 0.0025, kind: 'spot',
    note: 'Чужой экономический цикл, пересчитанный в местную валюту. Единственная позиция, которой всё равно на вашу ставку и ваш бюджет: растёт на мировом спросе и на девальвации.' },
  { id: 'bond_gov', name: 'Гособлигации 10 лет', ticker: 'GOV', group: 'Облигации', color: COLOR.blue, key: 'bondIndex', fee: 0.001, kind: 'spot',
    note: 'Индекс полной доходности: купон уже внутри цены и реинвестируется, отдельной выплаты нет, бумага не гасится. Дюрация 7,4: доходность +1 п.п. отнимает около 7% цены.' },
  { id: 'bond_short', name: 'Короткие ОФЗ 2 года', ticker: 'GOV2', group: 'Облигации', color: '#7FA3B8', key: 'bondShortIndex', fee: 0.0008, kind: 'spot',
    note: 'Тот же госдолг, но дюрация 1,9 вместо 7,4: разворот ставки почти не двигает цену. Место, где пережидают неопределённость, не выходя из бумаг.' },
  { id: 'bond_linker', name: 'Инфляционные линкеры', ticker: 'LNK', group: 'Облигации', color: '#C2A15A', key: 'linkerIndex', fee: 0.0012, kind: 'spot',
    note: 'Номинал индексируется на фактическую инфляцию, сверху — реальная доходность. Единственная бумага, которой скачок цен помогает, а не вредит.' },
  { id: 'bond_corp', name: 'Корпоративные облигации', ticker: 'CRP', group: 'Облигации', color: COLOR.teal, key: 'corpBondIndex', fee: 0.0015, kind: 'spot',
    note: 'То же самое, но с кредитным спредом: доходность выше, а в кризис спред расширяется и цена падает сильнее государственной. Дюрация 4,1.' },
  { id: 'dep', name: 'Банковский депозит', ticker: 'DEP', group: 'Деньги', color: COLOR.teal, key: 'depositIndex', fee: 0, kind: 'spot',
    note: 'Ставка по депозитам. Безопасно ровно до тех пор, пока реальная ставка не уйдёт в минус.' },
  { id: 'mm', name: 'Денежный рынок (РЕПО)', ticker: 'MMF', group: 'Деньги', color: '#9AA79B', key: 'moneyMarketIndex', fee: 0.0002, kind: 'spot',
    note: 'Овернайт по ключевой ставке. Номинально безрисковый и ровно настолько же беззащитный перед инфляцией: при отрицательной реальной ставке теряет медленно, но неизбежно.' },
  { id: 'fx', name: 'Иностранная валюта', ticker: 'FX', group: 'Деньги', color: COLOR.rust, key: 'fxIndex', fee: 0.003, kind: 'spot',
    note: 'Курс плюс мировая ставка. Страховка от девальвации и от собственного правительства.' },
  { id: 'gold', name: 'Сырьевой контракт', ticker: 'CMD', group: 'Товары', color: '#C08A6B', key: 'goldIndex', fee: 0.0025, kind: 'spot',
    note: 'Мировая цена сырья в местной валюте: защищает и от инфляции, и от слабого курса.' },
  { id: 'fut_idx', name: 'Фьючерс на индекс', ticker: 'F-IDX', group: 'Производные', color: COLOR.gold, key: 'stockIndex', fee: 0.0008, kind: 'fut', lev: 5,
    note: 'Плечо 5:1. Вы вносите только ГО; прибыль и убыток начисляются на всю позицию и попадают на счёт при закрытии.' },
  { id: 'fut_fx', name: 'Фьючерс на валюту', ticker: 'F-FX', group: 'Производные', color: COLOR.rust, key: 'fxIndex', fee: 0.0008, kind: 'fut', lev: 8,
    note: 'Плечо 8:1. Вы вносите только ГО; движение курса на 1% меняет ваши деньги на 8%.' },
  { id: 'fut_bond', name: 'Фьючерс на облигации', ticker: 'F-GOV', group: 'Производные', color: COLOR.blue, key: 'bondIndex', fee: 0.0006, kind: 'fut', lev: 10,
    note: 'Плечо 10:1. Ставка на разворот денежной политики. Движение цены на 1% — это 10% вашего ГО.' },
  { id: 'fut_cmd', name: 'Фьючерс на сырьё', ticker: 'F-CMD', group: 'Производные', color: '#C08A6B', key: 'goldIndex', fee: 0.0009, kind: 'fut', lev: 6,
    note: 'Плечо 6:1 на мировую цену сырья в местной валюте. Двойная ставка сразу: и на сырьевой цикл, и на курс.' },
  { id: 'opt_call', name: 'Опцион call на индекс', ticker: 'CALL', group: 'Опционы', color: COLOR.teal, key: 'stockIndex', fee: 0.004, kind: 'opt', optType: 'call', life: 2,
    note: 'Право купить индекс по текущей цене через 2 квартала. Убыток ограничен премией, прибыль — нет.' },
  { id: 'opt_put', name: 'Опцион put на индекс', ticker: 'PUT', group: 'Опционы', color: COLOR.rust, key: 'stockIndex', fee: 0.004, kind: 'opt', optType: 'put', life: 2,
    note: 'Право продать индекс по текущей цене через 2 квартала. Страховка портфеля от обвала.' },
];
const INSTR_BY_ID = {};
INSTRUMENTS.forEach((x) => { INSTR_BY_ID[x.id] = x; });
const MAINTENANCE = 0.25;     // ниже этого уровня приходит маржин-колл
const TARGET_MARGIN = 0.38;   // до этого уровня принудительно закрывают
const BORROW_FEE = 0.02;      // годовая плата за короткую позицию

const emptyBook = () => ({ cash: 10, pos: {}, avg: {}, opts: [], realized: 0, history: [10],
  startValue: 10, benchStart: null, marginCalls: 0, lastEvents: [], casinoNet: 0 });
const priceOf = (instr, economy, live) => {
  const v = (live && Number.isFinite(live[instr.key])) ? live[instr.key] : economy[instr.key];
  return Number.isFinite(v) && v > 0 ? v : 1;
};
const normCdf = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};
function optionValue(type, S, K, volAnnual, quartersLeft) {
  const T = Math.max(0.02, quartersLeft / 4);
  const vol = clamp(volAnnual, 0.08, 1.6);
  const sT = vol * Math.sqrt(T);
  const d1 = (Math.log(Math.max(1e-6, S / K)) + 0.5 * sT * sT) / sT;
  const d2 = d1 - sT;
  if (type === 'call') return Math.max(0, S * normCdf(d1) - K * normCdf(d2));
  return Math.max(0, K * normCdf(-d2) - S * normCdf(-d1));
}
const impliedVol = (economy) => clamp(economy.volatilityIndex / 100 * 1.5, 0.12, 1.4);

function bookParts(book, economy, live) {
  let spot = 0; let futPnl = 0; let optVal = 0; let gross = 0;
  INSTRUMENTS.forEach((i) => {
    const q = book.pos[i.id] || 0;
    if (!q) return;
    const pr = priceOf(i, economy, live);
    if (i.kind === 'fut') { futPnl += q * (pr - (book.avg[i.id] || pr)) / 1000; gross += Math.abs(q) * pr / 1000; }
    else { spot += q * pr / 1000; gross += Math.abs(q) * pr / 1000; }
  });
  (book.opts || []).forEach((lot) => {
    const instr = INSTR_BY_ID[lot.instr];
    if (!instr) return;
    const S = priceOf(instr, economy, live);
    const v = optionValue(lot.type, S, lot.strike, impliedVol(economy), lot.left) * lot.qty / 1000;
    optVal += v;
    gross += Math.abs(lot.qty) * S / 1000 * 0.4;
  });
  return { spot, futPnl, optVal, gross };
}
const bookValue = (book, economy, live) => {
  const p = bookParts(book, economy, live);
  return book.cash + p.spot + p.futPnl + p.optVal;
};
const marginLevel = (book, economy, live) => {
  const p = bookParts(book, economy, live);
  const eq = book.cash + p.spot + p.futPnl + p.optVal;
  return p.gross > 0.01 ? eq / p.gross : 9;
};

/* amountMln — деньги для спота и опционов, гарантийное обеспечение для фьючерса */
function tradeBook(book, instrId, amountMln, side, economy, live) {
  const instr = INSTR_BY_ID[instrId];
  if (!instr || !(amountMln > 0.0001)) return book;
  const price = priceOf(instr, economy, live);
  const dir = side === 'buy' ? 1 : -1;

  if (instr.kind === 'opt') {
    const vol = impliedVol(economy);
    if (side === 'buy') {
      const prem = optionValue(instr.optType, price, price, vol, instr.life) * (1 + instr.fee);
      if (prem <= 0.0001) return book;
      const qty = amountMln * 1000 / prem;
      return { ...book, cash: book.cash - amountMln,
        opts: [...(book.opts || []), { id: `o${Math.random().toString(36).slice(2, 8)}`, instr: instrId, type: instr.optType,
          strike: price, qty, left: instr.life, premium: prem }] };
    }
    // продажа = закрытие имеющихся контрактов этого типа
    let remain = amountMln; let cash = book.cash; let realized = book.realized;
    const opts = [];
    (book.opts || []).forEach((lot) => {
      if (lot.instr !== instrId || remain <= 0.0001) { opts.push(lot); return; }
      const S = priceOf(INSTR_BY_ID[lot.instr], economy, live);
      const v = optionValue(lot.type, S, lot.strike, vol, lot.left) * (1 - instr.fee);
      const lotVal = v * lot.qty / 1000;
      if (lotVal <= remain + 1e-9) {
        cash += lotVal; realized += lotVal - lot.premium * lot.qty / 1000; remain -= lotVal;
      } else {
        const part = remain / Math.max(1e-9, lotVal);
        cash += remain; realized += remain - lot.premium * lot.qty * part / 1000;
        opts.push({ ...lot, qty: lot.qty * (1 - part) }); remain = 0;
      }
    });
    return { ...book, cash, realized, opts };
  }

  const held = book.pos[instrId] || 0;
  if (instr.kind === 'fut') {
    const notional = amountMln * (instr.lev || 1);
    const qty = notional * 1000 / price;
    const fees = notional * instr.fee;
    if (held === 0 || Math.sign(held) === dir) {           // открытие или наращивание
      const newQty = held + dir * qty;
      const prevAvg = book.avg[instrId] || price;
      return { ...book, cash: book.cash - fees, pos: { ...book.pos, [instrId]: newQty },
        avg: { ...book.avg, [instrId]: (prevAvg * Math.abs(held) + price * qty) / Math.max(1e-9, Math.abs(newQty)) } };
    }
    const closeQty = Math.min(Math.abs(held), qty);
    const pnl = Math.sign(held) * closeQty * (price - (book.avg[instrId] || price)) / 1000;
    const rest = Math.abs(held) - closeQty;
    return { ...book, cash: book.cash + pnl - fees, realized: book.realized + pnl,
      pos: { ...book.pos, [instrId]: Math.sign(held) * rest } };
  }

  // спот: покупка, продажа, короткая позиция
  const feeMul = side === 'buy' ? 1 + instr.fee : 1 - instr.fee;
  const qty = amountMln * 1000 / (price * feeMul);
  if (side === 'buy') {
    if (held < 0) {                                        // закрытие шорта
      const closeQty = Math.min(-held, qty);
      const pnl = closeQty * ((book.avg[instrId] || price) - price) / 1000;
      const rest = qty - closeQty;
      const newQty = held + closeQty + rest;
      const cash = book.cash - closeQty * price * feeMul / 1000 - rest * price * feeMul / 1000;
      return { ...book, cash, realized: book.realized + pnl,
        pos: { ...book.pos, [instrId]: newQty },
        avg: rest > 0 ? { ...book.avg, [instrId]: price } : book.avg };
    }
    const prevAvg = book.avg[instrId] || price;
    const newQty = held + qty;
    return { ...book, cash: book.cash - amountMln, pos: { ...book.pos, [instrId]: newQty },
      avg: { ...book.avg, [instrId]: (prevAvg * held + price * qty) / Math.max(1e-9, newQty) } };
  }
  if (held > 0) {                                          // продажа длинной позиции
    const sellQty = Math.min(held, qty);
    const proceeds = sellQty * price * feeMul / 1000;
    const pnl = sellQty * (price - (book.avg[instrId] || price)) / 1000;
    const rest = qty - sellQty;
    let nb = { ...book, cash: book.cash + proceeds, realized: book.realized + pnl,
      pos: { ...book.pos, [instrId]: held - sellQty } };
    if (rest > 0.0001) {                                   // остаток уходит в шорт
      nb = { ...nb, cash: nb.cash + rest * price * feeMul / 1000, pos: { ...nb.pos, [instrId]: -rest },
        avg: { ...nb.avg, [instrId]: price } };
    }
    return nb;
  }
  // открытие или наращивание шорта
  const prevAvg = book.avg[instrId] || price;
  const newQty = held - qty;
  return { ...book, cash: book.cash + amountMln, pos: { ...book.pos, [instrId]: newQty },
    avg: { ...book.avg, [instrId]: (prevAvg * Math.abs(held) + price * qty) / Math.max(1e-9, Math.abs(newQty)) } };
}

/* Закрытие квартала: экспирация опционов, плата за шорт и плечо, маржин-колл */
function settleQuarter(book, economy) {
  const events = [];
  let b = { ...book, pos: { ...book.pos }, avg: { ...book.avg }, opts: [...(book.opts || [])] };
  // опционы: экспирация и списание временной стоимости
  const keep = [];
  b.opts.forEach((lot) => {
    const instr = INSTR_BY_ID[lot.instr];
    const S = priceOf(instr, economy, null);
    if (lot.left <= 1) {
      const payoff = (lot.type === 'call' ? Math.max(0, S - lot.strike) : Math.max(0, lot.strike - S)) * lot.qty / 1000;
      b.cash += payoff;
      b.realized += payoff - lot.premium * lot.qty / 1000;
      events.push({ kind: payoff > lot.premium * lot.qty / 1000 ? 'ok' : 'loss',
        text: `Опцион ${lot.type === 'call' ? 'call' : 'put'} со страйком ${lot.strike.toFixed(0)} исполнен: выплата ${fmtMln(payoff)} при уплаченной премии ${fmtMln(lot.premium * lot.qty / 1000)}.` });
    } else keep.push({ ...lot, left: lot.left - 1 });
  });
  b.opts = keep;
  // плата за короткие позиции и проценты по плечу
  let borrow = 0;
  INSTRUMENTS.forEach((i) => {
    const q = b.pos[i.id] || 0;
    if (i.kind === 'spot' && q < 0) borrow += -q * priceOf(i, economy, null) / 1000 * BORROW_FEE / 4;
  });
  const margin = b.cash < 0 ? -b.cash : 0;
  const interest = margin * economy.lendingRate / 400;
  b.cash -= borrow + interest;
  if (borrow > 0.005) events.push({ kind: 'info', text: `Плата за короткие позиции: ${fmtMln(borrow)} за квартал.` });
  // маржин-колл
  let lvl = marginLevel(b, economy, null);
  if (lvl < MAINTENANCE) {
    const parts = bookParts(b, economy, null);
    const eq = b.cash + parts.spot + parts.futPnl + parts.optVal;
    const targetGross = Math.max(0, eq / TARGET_MARGIN);
    const cut = clamp(1 - targetGross / Math.max(0.001, parts.gross), 0, 1);
    let closedValue = 0;
    INSTRUMENTS.forEach((i) => {
      const q = b.pos[i.id] || 0;
      if (!q) return;
      const pr = priceOf(i, economy, null);
      const closeQty = q * cut;
      closedValue += Math.abs(closeQty) * pr / 1000;
      if (i.kind === 'fut') {
        const pnl = closeQty * (pr - (b.avg[i.id] || pr)) / 1000;
        b.cash += pnl; b.realized += pnl;
      } else {
        const pnl = closeQty * (pr - (b.avg[i.id] || pr)) / 1000;
        b.cash += closeQty * pr / 1000 * (1 - 0.005);
        b.realized += pnl;
      }
      b.pos[i.id] = q - closeQty;
    });
    b.opts = b.opts.map((l) => ({ ...l, qty: l.qty * (1 - cut) }));
    b.marginCalls = (b.marginCalls || 0) + 1;
    events.push({ kind: 'call', text: `Маржин-колл: уровень обеспечения упал до ${(lvl * 100).toFixed(0)}% при минимуме ${MAINTENANCE * 100}%. Брокер принудительно закрыл ${(cut * 100).toFixed(0)}% позиций (${fmtMln(closedValue)}) по рынку со штрафом 0,5%.` });
    lvl = marginLevel(b, economy, null);
  }
  const val = bookValue(b, economy, null);
  if (val <= 0.05) {
    b = { ...emptyBook(), cash: Math.max(0.05, val), startValue: b.startValue, benchStart: b.benchStart,
      history: b.history, marginCalls: (b.marginCalls || 0) + 1 };
    events.push({ kind: 'call', text: 'Счёт обнулён: убытки съели весь капитал. Позиции закрыты, торговля начинается заново с тем, что осталось.' });
  }
  b.history = [...(b.history || []), bookValue(b, economy, null)].slice(-80);
  b.lastEvents = events;
  return b;
}

/* Эталоны сравнения: индекс, облигации, депозит и просто сохранённая покупательная способность */
const BENCHMARKS = [
  { id: 'stock', label: 'Индекс акций', key: 'stockIndex', color: COLOR.gold },
  { id: 'bond', label: 'Гособлигации', key: 'bondIndex', color: COLOR.blue },
  { id: 'dep', label: 'Депозит', key: 'depositIndex', color: COLOR.teal },
  { id: 'infl', label: 'Инфляция (сохранение покупательной способности)', key: 'priceLevel', color: COLOR.rust },
];
/* Отраслевая принадлежность позиций — для круговой диаграммы портфеля */
const SECTOR_OF = {
  eq_broad: 'Рынок целиком', eq_banks: 'Банки', eq_industry: 'Промышленность',
  eq_consumer: 'Потребительский сектор', eq_resources: 'Сырьевой сектор', reit: 'Недвижимость',
  eq_world: 'Мировые акции',
  bond_gov: 'Госдолг', bond_short: 'Госдолг', bond_linker: 'Линкеры', bond_corp: 'Корпоративный долг',
  dep: 'Депозит', mm: 'Денежный рынок', fx: 'Валюта', gold: 'Товары',
  fut_idx: 'Плечо: индекс', fut_fx: 'Плечо: валюта', fut_bond: 'Плечо: долг', fut_cmd: 'Плечо: сырьё',
};

function AllocationDonut({ rows, size = 124, thickness = 16 }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!(total > 0)) return null;
  const c = size / 2; const rad = c - thickness / 2; const CIRC = 2 * Math.PI * rad;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      <circle cx={c} cy={c} r={rad} fill="none" stroke={COLOR.hairline} strokeWidth={thickness} />
      {rows.map((row) => {
        const frac = row.value / total; const off = acc; acc += frac;
        return (
          <circle key={row.label} cx={c} cy={c} r={rad} fill="none" stroke={row.color}
            strokeWidth={thickness} strokeLinecap="butt" opacity={row.short ? 0.5 : 1}
            strokeDasharray={`${Math.max(0.5, frac * CIRC - 1.5)} ${CIRC}`}
            strokeDashoffset={-off * CIRC} transform={`rotate(-90 ${c} ${c})`} />
        );
      })}
      <text x={c} y={c - 3} textAnchor="middle" fontSize={9} fill={COLOR.muted}>ЭКСПОЗИЦИЯ</text>
      <text x={c} y={c + 12} textAnchor="middle" fontSize={13} fill={COLOR.text}>{fmtMln(total)}</text>
    </svg>
  );
}
function benchValues(book, economy) {
  // benchStart обычно проставляется в settleQuarter при первом переходе
  // квартала — но до этого момента (весь первый квартал партии) книга его
  // ещё не имеет, а не «нет данных»: значит, отсчёт эталонов = сейчас, и
  // все они совпадают со стартовым капиталом, а не пропадают из интерфейса
  const start = book.benchStart || { stockIndex: economy.stockIndex, bondIndex: economy.bondIndex,
    depositIndex: economy.depositIndex, priceLevel: economy.priceLevel };
  const out = {};
  BENCHMARKS.forEach((b) => { out[b.id] = (book.startValue || 10) * economy[b.key] / start[b.key]; });
  return out;
}

function PriceCell({ value, size = 12, bold }) {
  const prevRef = React.useRef(value);
  const [dir, setDir] = useState(0);
  React.useEffect(() => {
    if (value > prevRef.current + 1e-9) setDir(1);
    else if (value < prevRef.current - 1e-9) setDir(-1);
    prevRef.current = value;
    const t = setTimeout(() => setDir(0), 650);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className="ems-mono" style={{ fontSize: size, fontWeight: bold ? 600 : 400, transition: 'color 0.45s ease',
      color: dir > 0 ? COLOR.teal : dir < 0 ? COLOR.rust : COLOR.text }}>
      {Number.isFinite(value) ? value.toFixed(2) : '—'}
    </span>
  );
}

/* Разбор механики инструмента живыми цифрами: фьючерс и облигация — самые непонятные */
function InstrumentPrimer({ instr, economy, prev, amt }) {
  const Row = ({ k, v, tone }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '1.5px 0' }}>
      <span style={{ color: COLOR.muted }}>{k}</span>
      <span className="ems-mono" style={{ color: tone || COLOR.text, textAlign: 'right' }}>{v}</span>
    </div>
  );
  const box = { fontSize: 10.5, lineHeight: 1.5, background: COLOR.panelAlt,
    border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 10px' };

  if (instr.kind === 'fut') {
    const m = Math.max(0.01, amt);
    const notional = m * instr.lev;
    const perPct = notional * 0.01;
    return (
      <div style={box}>
        <div style={{ color: COLOR.goldSoft, marginBottom: 5 }}>Как считается фьючерс</div>
        <Row k="Вы вносите (гарантийное обеспечение)" v={fmtMln(m)} />
        <Row k={`Работает позиция размером (×${instr.lev})`} v={fmtMln(notional)} />
        <Row k="Движение цены на 1%" v={`± ${fmtMln(perPct)} = ${instr.lev}% вашего ГО`}
          tone={COLOR.gold} />
        <Row k="Убыток съедает ГО полностью при" v={`падении на ${(100 / instr.lev).toFixed(1)}%`} tone={COLOR.rust} />
        <div style={{ color: COLOR.faint, marginTop: 6 }}>
          Прибыль и убыток считаются от всей позиции, а не от внесённых денег, и живут в строке
          «Прибыль» — на счёт они попадают только когда вы нажмёте «Закрыть». Продажа при нулевой
          позиции открывает шорт: заработок на падении.
        </div>
      </div>
    );
  }

  if (instr.id === 'bond_gov' || instr.id === 'bond_corp') {
    const corp = instr.id === 'bond_corp';
    const y = corp ? economy.corpYield : economy.yield10y;
    const yPrev = prev ? (corp ? prev.corpYield : prev.yield10y) : y;
    const dur = corp ? 4.1 : 7.4;
    const coupon = y / 4;
    const reval = -dur * (y - yPrev);
    const total = Number.isFinite(corp ? economy.corpReturn : economy.bondReturn)
      ? (corp ? economy.corpReturn : economy.bondReturn) : coupon + reval;
    return (
      <div style={box}>
        <div style={{ color: COLOR.goldSoft, marginBottom: 5 }}>Откуда берётся результат</div>
        <Row k={`Купон за квартал (доходность ${fmt2(y)}% ÷ 4)`} v={`+${fmt2(coupon)}%`} tone={COLOR.teal} />
        <Row k={`Переоценка (дюрация ${dur} × изменение доходности)`} v={`${fmtSigned1(reval)}%`}
          tone={reval >= 0 ? COLOR.teal : COLOR.rust} />
        <Row k="Итого за прошлый квартал" v={`${fmtSigned1(total)}%`} tone={total >= 0 ? COLOR.teal : COLOR.rust} />
        <div style={{ color: COLOR.faint, marginTop: 6 }}>
          Это индекс постоянной дюрации, а не одна бумага: он <b style={{ color: COLOR.muted }}>не гасится</b>,
          и купон <b style={{ color: COLOR.muted }}>не приходит отдельной выплатой</b> — он уже внутри цены
          и сразу реинвестируется. Позиция закрывается только вашей продажей. Доходность вверх — цена вниз.
        </div>
      </div>
    );
  }
  return null;
}

function TradingTerminal({ economy, prev, book, onTrade, history }) {
  const live = useLiveQuotes(economy);
  const [sel, setSel] = useState('eq_broad');
  const [activeGroup, setActiveGroup] = useState('all');
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState(1);
  const [useMargin, setUseMargin] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [sortBy, setSortBy] = useState('group');
  const [chartRange, setChartRange] = useState(20);
  const [showBench, setShowBench] = useState(false);
  const parts = bookParts(book, economy, live);
  const equity = book.cash + parts.spot + parts.futPnl + parts.optVal;
  const lvl = parts.gross > 0.01 ? equity / parts.gross : 9;
  const freeRisk = Math.max(0, equity / MAINTENANCE - parts.gross);
  const instr = INSTR_BY_ID[sel];
  const price = priceOf(instr, economy, live);
  const held = book.pos[sel] || 0;
  const heldValue = held * price / 1000;
  const avg = book.avg[sel];
  const lots = (book.opts || []).filter((l) => l.instr === sel);
  const vol = impliedVol(economy);
  const lotsValue = lots.reduce((a, l) => a + optionValue(l.type, price, l.strike, vol, l.left) * l.qty / 1000, 0);
  const unreal = instr.kind === 'opt' ? lotsValue - lots.reduce((a, l) => a + l.premium * l.qty / 1000, 0)
    : held !== 0 && avg ? held * (price - avg) / 1000 : 0;
  const maxBuy = instr.kind === 'fut' ? Math.max(0, freeRisk / (instr.lev || 1))
    : instr.kind === 'opt' ? Math.max(0, book.cash)
      : useMargin ? Math.max(0, Math.min(book.cash + Math.max(0, equity * 0.6), freeRisk)) : Math.max(0, book.cash);
  const maxSell = instr.kind === 'opt' ? lotsValue
    : instr.kind === 'fut' ? Math.max(0, freeRisk / (instr.lev || 1))
      : Math.max(0, heldValue) + (useMargin ? Math.max(0, Math.min(equity * 0.5, freeRisk)) : 0);
  const maxAmount = side === 'buy' ? maxBuy : maxSell;
  const amt = clamp(amount, 0, maxAmount);
  const chg = prev && prev[instr.key] ? (economy[instr.key] / prev[instr.key] - 1) * 100 : 0;
  const histWin = useMemo(() => (history || []).slice(-chartRange), [history, chartRange]);
  // Эталон приводим к стартовой точке самого инструмента: сравнение имеет смысл
  // только как «обогнали рынок или отстали», а не как разница абсолютных пунктов
  const chartRows = useMemo(() => {
    const first = histWin.find((h) => Number.isFinite(h[instr.key]));
    const benchFirst = histWin.find((h) => Number.isFinite(h.stockIndex));
    const k = first && benchFirst && benchFirst.stockIndex ? first[instr.key] / benchFirst.stockIndex : 1;
    return histWin.map((h, idx) => ({
      i: idx,
      label: h.label || h.q || '',
      price: Number.isFinite(h[instr.key]) ? h[instr.key] : null,
      bench: showBench && Number.isFinite(h.stockIndex) ? h.stockIndex * k : null,
    }));
  }, [histWin, instr.key, showBench]);
  const marks = useMemo(() => {
    const firstQ = histWin.length ? histWin[0].q : 0;
    const last = histWin.length - 1;
    return (book.trades || []).filter((t) => t.id === sel)
      // сделки текущего, ещё не закрытого квартала прижимаем к последней точке графика
      .map((t) => ({ idx: Math.min(t.q - firstQ, last), side: t.side }))
      .filter((m) => m.idx >= 0 && m.idx <= last);
  }, [histWin, book.trades, sel]);
  // одна таблица «как на бирже»: цена, изменение, позиция и результат по каждой
  // строке считаются в одном месте — и для сортировки, и для отрисовки
  const rows = useMemo(() => INSTRUMENTS.map((i) => {
    const pr = priceOf(i, economy, live);
    const q = book.pos[i.id] || 0;
    const myLots = (book.opts || []).filter((l) => l.instr === i.id);
    const value = i.kind === 'opt'
      ? myLots.reduce((a, l) => a + optionValue(l.type, pr, l.strike, vol, l.left) * l.qty / 1000, 0)
      : i.kind === 'fut' ? Math.abs(q) * pr / 1000 : q * pr / 1000;
    const avgP = book.avg[i.id];
    const pnl = i.kind === 'opt'
      ? value - myLots.reduce((a, l) => a + l.premium * l.qty / 1000, 0)
      : (q !== 0 && avgP) ? q * (pr - avgP) / 1000 : 0;
    const chgQ = prev && prev[i.key] ? (economy[i.key] / prev[i.key] - 1) * 100 : 0;
    return { i, pr, q, myLots, value, pnl, chgQ, has: Math.abs(q) > 0.001 || myLots.length > 0 };
  }), [economy, live, book, prev, vol]);
  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const out = rows.filter((r) => (activeGroup === 'all' || r.i.group === activeGroup)
      && (!onlyMine || r.has)
      && (!term || r.i.name.toLowerCase().includes(term) || r.i.ticker.toLowerCase().includes(term)));
    if (sortBy === 'chg') return [...out].sort((a, b) => b.chgQ - a.chgQ);
    if (sortBy === 'pnl') return [...out].sort((a, b) => b.pnl - a.pnl);
    return out;
  }, [rows, activeGroup, onlyMine, query, sortBy]);
  const openCount = rows.filter((r) => r.has).length;
  // «Движение квартала»: три лидера и три аутсайдера среди спот-инструментов —
  // производные повторяют базовый актив и в этой строке были бы дублями
  const movers = useMemo(() => {
    const spot = rows.filter((r) => r.i.kind === 'spot' && Math.abs(r.chgQ) > 0.05).sort((a, b) => b.chgQ - a.chgQ);
    if (spot.length < 2) return [];
    return [...spot.slice(0, 3), ...spot.slice(-3).filter((r) => !spot.slice(0, 3).includes(r)).reverse()];
  }, [rows]);
  const premium = instr.kind === 'opt' ? optionValue(instr.optType, price, price, vol, instr.life) : 0;
  const qty = instr.kind === 'opt' ? (premium > 0 ? amt * 1000 / (premium * (1 + instr.fee)) : 0)
    : amt * (instr.lev || 1) * 1000 / price;
  const willShort = instr.kind !== 'opt' && side === 'sell' && amt > Math.max(0, heldValue) + 1e-9;
  const setPct = (p) => { Audio.play('tick'); setAmount(Math.round(maxAmount * p * 100) / 100); };
  const posLabel = (i, q) => {
    if (i.kind === 'opt') return lots.length ? `${lots.length} серии` : '—';
    if (!q) return '—';
    return `${q > 0 ? 'лонг' : 'шорт'} ${Math.abs(q).toFixed(1)}`;
  };

  return (
    <div className="ems-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', padding: '9px 13px',
        borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panelAlt }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TrendingUp size={13} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Терминал</span>
        </span>
        {[['Капитал', fmtMln(equity), COLOR.text],
          ['Деньги', fmtMln(book.cash), book.cash < 0 ? COLOR.rust : COLOR.text],
          ['Экспозиция', fmtMln(parts.gross), COLOR.text],
          ['Зафиксировано', fmtMlnSigned(book.realized), book.realized >= 0 ? COLOR.teal : COLOR.rust]].map(([l, v, c]) => (
            <span key={l} style={{ fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'baseline' }}>
              <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono" style={{ color: c }}>{v}</span>
            </span>
          ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', minWidth: 190 }}>
          <span style={{ fontSize: 11, color: COLOR.muted }}>Обеспечение</span>
          <span style={{ flex: 1, height: 5, background: COLOR.border, borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
            <span style={{ display: 'block', height: '100%', width: `${clamp(lvl / 1.2 * 100, 0, 100)}%`,
              background: lvl < MAINTENANCE ? COLOR.rust : lvl < 0.45 ? COLOR.gold : COLOR.teal }} />
          </span>
          <span className="ems-mono" style={{ fontSize: 11.5, color: lvl < MAINTENANCE ? COLOR.rust : lvl < 0.45 ? COLOR.gold : COLOR.teal }}>
            {parts.gross > 0.01 ? `${Math.round(lvl * 100)}%` : '—'}
          </span>
        </span>
      </div>
      {parts.gross > 0.01 && lvl < 0.45 && (
        <div style={{ padding: '6px 13px', fontSize: 11.5, background: lvl < MAINTENANCE ? COLOR.rustDim : COLOR.goldDim,
          color: lvl < MAINTENANCE ? COLOR.rust : COLOR.goldSoft, borderBottom: `1px solid ${COLOR.border}` }}>
          {lvl < MAINTENANCE
            ? `Уровень обеспечения ниже ${MAINTENANCE * 100}%: в конце квартала брокер принудительно закроет часть позиций по рынку.`
            : `Обеспечение ${Math.round(lvl * 100)}% — запас до маржин-колла невелик. Падение рынка на ${Math.round((lvl - MAINTENANCE) / Math.max(0.01, lvl) * 100)}% приведёт к принудительному закрытию.`}
        </div>
      )}
      {movers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 13px', flexWrap: 'wrap',
          borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panel }}>
          <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.blue, letterSpacing: '0.08em' }}>ДВИЖЕНИЕ КВАРТАЛА</span>
          {movers.map((r) => (
            <span key={r.i.id} onClick={() => { Audio.play('tick'); setSel(r.i.id); setAmount(1); setSide('buy'); }}
              title={r.i.name}
              style={{ display: 'flex', gap: 5, alignItems: 'baseline', cursor: 'pointer', fontSize: 11 }}>
              <span className="ems-mono" style={{ color: r.i.color }}>{r.i.ticker}</span>
              <span className="ems-mono" style={{ color: r.chgQ >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(r.chgQ)}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="ems-terminal">
        <div className="ems-scroll" style={{ borderRight: `1px solid ${COLOR.border}` }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: COLOR.panel, borderBottom: `1px solid ${COLOR.border}`, padding: '8px 12px 6px' }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: тикер или название" aria-label="Поиск инструмента"
                style={{ flex: 1, minWidth: 0, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 4,
                  color: COLOR.text, fontSize: 11, padding: '5px 8px', outline: 'none', fontFamily: 'inherit' }} />
              <button className="ems-btn" title="Показать только инструменты, где у вас есть позиция"
                style={{ padding: '3px 9px', fontSize: 10.5, whiteSpace: 'nowrap',
                  background: onlyMine ? COLOR.gold : COLOR.panelAlt, color: onlyMine ? COLOR.ink : COLOR.muted,
                  borderColor: onlyMine ? COLOR.gold : COLOR.border }}
                onClick={() => { Audio.play('tick'); setOnlyMine((v) => !v); }}>мои {openCount > 0 ? `· ${openCount}` : ''}</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <span className={`ems-tab ${activeGroup === 'all' ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
                onClick={() => { Audio.play('tab'); setActiveGroup('all'); }}>Все</span>
              {[...new Set(INSTRUMENTS.map((i) => i.group))].map((g) => (
                <span key={g} className={`ems-tab ${activeGroup === g ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={() => { Audio.play('tab'); setActiveGroup(g); }}>{g}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 9.5, color: COLOR.faint, letterSpacing: '0.06em' }}>СОРТИРОВКА</span>
              {[['group', 'по группам'], ['chg', 'по движению'], ['pnl', 'по результату']].map(([id, label]) => (
                <span key={id} className={`ems-tab ${sortBy === id ? 'active' : ''}`} style={{ padding: '2px 7px', fontSize: 10 }}
                  onClick={() => { Audio.play('tab'); setSortBy(id); }}>{label}</span>
              ))}
            </div>
          </div>
          {visibleRows.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 11.5, color: COLOR.faint }}>
              {onlyMine ? 'Открытых позиций нет — снимите фильтр «мои», чтобы увидеть весь список.' : 'Ничего не найдено по этому запросу.'}
            </div>
          )}
          {visibleRows.map((r, idx) => {
            const { i, pr, q, myLots, value, pnl, chgQ, has } = r;
            const active = sel === i.id;
            const groupHeader = sortBy === 'group' && (idx === 0 || visibleRows[idx - 1].i.group !== i.group);
            return (
              <React.Fragment key={i.id}>
                {groupHeader && (
                  <div style={{ padding: '7px 12px 3px', fontSize: 9.5, color: COLOR.blue, letterSpacing: '0.08em' }}>{i.group.toUpperCase()}</div>
                )}
                <div onClick={() => { Audio.play('tick'); setSel(i.id); setAmount(1); setSide('buy'); }}
                  className="ems-row-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer',
                    background: active ? COLOR.goldDim : 'transparent',
                    borderLeft: `2px solid ${active ? COLOR.gold : has ? i.color : 'transparent'}` }}>
                  <span className="ems-mono" style={{ fontSize: 10, color: i.color, width: 44, flexShrink: 0 }}>{i.ticker}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: active ? COLOR.text : COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                    {has && (
                      <div style={{ fontSize: 10, color: q < 0 ? COLOR.rust : COLOR.faint }}>
                        {i.kind === 'opt' ? `${myLots.length} серии · ${fmtMln(value)}`
                          : `${q < 0 ? 'шорт' : 'лонг'} ${fmtMln(Math.abs(value))}${i.kind === 'fut' ? ' номинала' : ''}`}
                      </div>
                    )}
                    {i.kind === 'fut' && !has && <div style={{ fontSize: 10, color: COLOR.faint }}>плечо {i.lev}:1</div>}
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div><PriceCell value={pr} size={11.5} /></div>
                    <div className="ems-mono" style={{ fontSize: 10, color: chgQ > 0.01 ? COLOR.teal : chgQ < -0.01 ? COLOR.rust : COLOR.faint }}>
                      {chgQ > 0.01 ? '▲' : chgQ < -0.01 ? '▼' : '·'} {fmtSigned1(chgQ)}%
                    </div>
                  </span>
                  {has && (
                    <span className="ems-mono" style={{ fontSize: 10.5, width: 62, textAlign: 'right', flexShrink: 0,
                      color: pnl > 0.0005 ? COLOR.teal : pnl < -0.0005 ? COLOR.rust : COLOR.faint }}>
                      {Math.abs(pnl) > 0.0005 ? fmtMlnSigned(pnl) : '—'}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* карточка выбранного инструмента — единственное место, где реально
            происходит действие (сделка); отделяем её от списка цветом инструмента,
            а не просто нейтральной панелью того же веса, что и список слева */}
        <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10, background: COLOR.panelRaised, borderTop: `2px solid ${instr.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: COLOR.text }}>
                <span className="ems-mono" style={{ color: instr.color, marginRight: 7 }}>{instr.ticker}</span>{instr.name}
              </div>
              <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 3, maxWidth: 340, lineHeight: 1.4 }}>{instr.note}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <PriceCell value={price} size={21} bold />
              <div className="ems-mono" style={{ fontSize: 11, color: chg >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(chg)}% за квартал</div>
            </div>
          </div>

          {chartRows.length > 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {[[8, '2 года'], [20, '5 лет'], [1000, 'всё время']].map(([q, label]) => (
                  <span key={label} className={`ems-tab ${chartRange === q ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}
                    onClick={() => { Audio.play('tab'); setChartRange(q); }}>{label}</span>
                ))}
                <span className={`ems-tab ${showBench ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10, marginLeft: 'auto' }}
                  title="Наложить сводный индекс, приведённый к той же стартовой точке: видно, обгоняет инструмент рынок или отстаёт"
                  onClick={() => { Audio.play('tab'); setShowBench((v) => !v); }}>
                  {showBench ? 'скрыть индекс' : 'сравнить с индексом'}
                </span>
              </div>
              <Suspense fallback={<ChartFallback height={190} />}>
                <InstrumentChart rows={chartRows} color={instr.color} avg={instr.kind === 'opt' ? null : avg}
                  marks={marks} benchLabel={showBench && instr.key !== 'stockIndex' ? 'сводный индекс' : null}
                  benchColor={COLOR.faint} height={190} />
              </Suspense>
              <div style={{ fontSize: 10, color: COLOR.faint, marginTop: -2, lineHeight: 1.4 }}>
                {marks.length > 0 && <><span style={{ color: COLOR.teal }}>B</span> — ваши покупки, <span style={{ color: COLOR.rust }}>S</span> — продажи. </>}
                {showBench && instr.key !== 'stockIndex' && 'Индекс приведён к стартовой цене инструмента: расхождение линий — это опережение или отставание от рынка. '}
                {Number.isFinite(avg) && instr.kind !== 'opt' && 'Пунктир с подписью «ваша средняя» — ваша средняя цена входа.'}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: COLOR.panelAlt,
            border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 10px' }}>
            {[['Позиция', posLabel(instr, held)],
              [instr.kind === 'opt' ? 'Страйк' : 'Средняя', instr.kind === 'opt' ? (lots[0] ? lots[0].strike.toFixed(0) : '—') : (avg ? avg.toFixed(2) : '—')],
              [instr.kind === 'fut' ? 'Номинал' : 'Стоимость',
                instr.kind === 'opt' ? (lotsValue > 0 ? fmtMln(lotsValue) : '—')
                  : Math.abs(held) > 0.001 ? fmtMln(Math.abs(heldValue)) : '—'],
              ['Прибыль', Math.abs(unreal) > 0.0005 ? fmtMlnSigned(unreal) : '—']].map(([l, v], idx) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: COLOR.muted }}>{l}</div>
                  <div className="ems-mono" style={{ fontSize: 12, color: idx === 3 && Math.abs(unreal) > 0.0005 ? (unreal >= 0 ? COLOR.teal : COLOR.rust) : COLOR.text }}>{v}</div>
                </div>
              ))}
          </div>
          <InstrumentPrimer instr={instr} economy={economy} prev={prev} amt={amt} />

          {instr.kind === 'opt' && lots.length > 0 && (
            <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.5 }}>
              {lots.map((l, i) => (
                <div key={l.id}>серия {i + 1}: страйк {l.strike.toFixed(0)}, до экспирации {l.left} кв., премия {fmtMln(l.premium * l.qty / 1000)}, сейчас {fmtMln(optionValue(l.type, price, l.strike, vol, l.left) * l.qty / 1000)}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            {[['buy', instr.kind === 'opt' ? 'Купить' : 'Купить / лонг'], ['sell', instr.kind === 'opt' ? 'Закрыть' : 'Продать / шорт']].map(([id, label]) => (
              <button key={id} className="ems-btn" style={{ flex: 1, padding: '7px 0', fontSize: 12,
                background: side === id ? (id === 'buy' ? COLOR.teal : COLOR.rust) : COLOR.panelAlt,
                color: side === id ? COLOR.ink : COLOR.muted,
                borderColor: side === id ? (id === 'buy' ? COLOR.teal : COLOR.rust) : COLOR.border }}
                onClick={() => { Audio.play('tick'); setSide(id); setAmount(1); }}>{label}</button>
            ))}
          </div>
          {(book.trades || []).length > 0 && (
            <div style={{ borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7, fontSize: 10.5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
                <span style={{ color: COLOR.blue }}>Исполнено</span>
                <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint }}>{book.trades.length} сделок за партию</span>
              </div>
              {/* журнал прокручивается внутри себя: раньше он рос вместе с числом
                  сделок и растягивал карточку, а с ней и всю страницу */}
              <div className="ems-scroll" style={{ maxHeight: 112, overflowY: 'auto' }}>
              {(() => {
                const list = (book.trades || []).slice(-40).reverse();
                let lastQ = null;
                // сделки шли слитной лентой без единого разделителя — за несколько
                // кварталов не разобрать, где кончился один и начался следующий
                return list.map((t, k) => {
                  const ins = INSTR_BY_ID[t.id];
                  const showQ = t.q !== lastQ;
                  lastQ = t.q;
                  return (
                    <React.Fragment key={`${t.q}-${k}`}>
                      {showQ && (
                        <div className="ems-mono" style={{ fontSize: 9, color: COLOR.faint, letterSpacing: '0.05em',
                          padding: '4px 0 2px', borderTop: k === 0 ? 'none' : `1px solid ${COLOR.hairline}`,
                          marginTop: k === 0 ? 0 : 2 }}>
                          {(t.label || quarterLabel(t.q)).toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, padding: '1.5px 0', color: COLOR.muted }}>
                        <span className="ems-mono" style={{ color: t.side === 'buy' ? COLOR.teal : COLOR.rust, width: 62 }}>
                          {t.side === 'buy' ? 'покупка' : 'продажа'}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ins ? ins.name : t.id}
                        </span>
                        <span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{fmtMln(t.amt)}</span>
                        <span className="ems-mono" style={{ color: COLOR.faint, width: 78, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          по {t.price.toFixed(2)}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
              </div>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: COLOR.muted }}>
                {instr.kind === 'fut' ? 'Гарантийное обеспечение' : instr.kind === 'opt' ? 'Премия' : 'Сумма сделки'}
              </span>
              <span className="ems-mono" style={{ fontSize: 14 }}>{mlnScale(amt).v} <span style={{ fontSize: 10, color: COLOR.faint }}>{mlnScale(amt).unit}</span></span>
            </div>
            <input type="range" className="ems-slider" min={0} max={Math.max(0.1, Math.round(maxAmount * 100) / 100)} step={0.05}
              aria-label="Сумма сделки" value={amt} onChange={(e) => { Audio.play('tick'); setAmount(parseFloat(e.target.value)); }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[[0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, 'макс.']].map(([p, l]) => (
                <button key={l} className="ems-btn" style={{ flex: 1, padding: '3px 0', fontSize: 10.5 }} onClick={() => setPct(p)}>{l}</button>
              ))}
            </div>
            {instr.kind === 'spot' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button className="ems-btn" style={{ padding: '3px 10px', fontSize: 10.5,
                  background: useMargin ? COLOR.rust : COLOR.panelAlt, color: useMargin ? COLOR.ink : COLOR.muted,
                  borderColor: useMargin ? COLOR.rust : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setUseMargin((m) => !m); setAmount(1); }}>
                  {useMargin ? 'кредитное плечо включено' : 'торговать в кредит'}
                </button>
                <span style={{ fontSize: 10, color: COLOR.faint, flex: 1, lineHeight: 1.35 }}>
                  {useMargin ? `Доступно ${fmtMln(maxBuy)}, из них ${fmtMln(Math.max(0, maxBuy - Math.max(0, book.cash)))} заёмных под ${fmt1(economy.lendingRate)}% годовых.`
                    : `Сделки только на свои: доступно ${fmtMln(Math.max(0, book.cash))}.`}
                </span>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, borderLeft: `2px solid ${side === 'buy' ? COLOR.teal : COLOR.rust}`, paddingLeft: 9 }}>
            {amt <= 0.001 ? 'Выберите сумму сделки.' : instr.kind === 'opt' ? (
              side === 'buy'
                ? <>Покупка <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> контрактов со страйком {price.toFixed(0)} и экспирацией через {instr.life} кв.
                  Премия {fmtMln(amt)} — это максимум, который можно потерять. Волатильность в цене опциона: {(vol * 100).toFixed(0)}%.</>
                : <>Закрытие позиций по опционам на {fmtMln(amt)} по текущей оценке.</>
            ) : (
              <>
                {side === 'buy' ? 'Покупка' : willShort ? 'Продажа в шорт' : 'Продажа'} <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> ед.
                по <b className="ems-mono" style={{ color: COLOR.text }}>{price.toFixed(2)}</b>
                {instr.kind === 'fut' && <> · номинал <b className="ems-mono" style={{ color: COLOR.text }}>{fmtMln(amt * instr.lev)}</b> при плече {instr.lev}:1</>}
                , комиссия {fmtMln(amt * instr.fee * (instr.lev || 1))}.
                {willShort && <span style={{ color: COLOR.rust }}> Шорт: прибыль при падении цены, плата за заём {(BORROW_FEE * 100).toFixed(1)}% годовых, убыток теоретически не ограничен.</span>}
                {instr.kind === 'spot' && side === 'buy' && book.cash - amt < 0 && <span style={{ color: COLOR.rust }}> Сделка в плечо под {fmt1(economy.lendingRate)}% годовых.</span>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <button className="ems-btn" disabled={amt <= 0.001}
              style={{ flex: 1, padding: '10px 0', fontSize: 13, background: side === 'buy' ? COLOR.tealDim : COLOR.rustDim,
                borderColor: side === 'buy' ? COLOR.teal : COLOR.rust, color: side === 'buy' ? COLOR.teal : COLOR.rust, fontWeight: 600 }}
              onClick={() => { Audio.play(side === 'buy' ? 'coin' : 'click'); onTrade(sel, amt, side, live); setAmount(1); }}>
              {side === 'buy' ? 'Купить' : willShort ? 'Открыть шорт' : 'Продать'} на {fmtMln(amt)}
            </button>
            {(Math.abs(held) > 0.001 || lots.length > 0) && (
              <button className="ems-btn" style={{ padding: '10px 14px', fontSize: 12 }}
                onClick={() => { Audio.play('click'); onTrade(sel, instr.kind === 'opt' ? lotsValue : Math.abs(heldValue) / (instr.lev || 1), held < 0 ? 'buy' : 'sell', live); }}>
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioSummary({ book, economy, live, prevValue, goal, opponent }) {
  const parts = bookParts(book, economy, live);
  const equity = book.cash + parts.spot + parts.futPnl + parts.optVal;
  const real = equity * 100 / economy.priceLevel;
  const qRet = prevValue ? (equity / prevValue - 1) * 100 : 0;
  const start = book.startValue || 10;
  const totalRet = (equity / start - 1) * 100;
  const bench = benchValues(book, economy);
  const optVal = parts.optVal;
  const alloc = useMemo(() => {
    const map = {};
    const put = (label, color, v, short) => {
      if (!map[label]) map[label] = { label, color, value: 0, net: 0, short: false };
      map[label].value += Math.abs(v); map[label].net += v;
      if (short) map[label].short = true;
    };
    INSTRUMENTS.forEach((i) => {
      const q = book.pos[i.id] || 0;
      if (!q) return;
      const pr = priceOf(i, economy, live);
      put(SECTOR_OF[i.id] || i.group, i.color, q * pr / 1000, q < 0);
    });
    (book.opts || []).forEach((lot) => {
      const ins = INSTR_BY_ID[lot.instr];
      if (!ins) return;
      const S = priceOf(ins, economy, live);
      put('Опционы', COLOR.teal, optionValue(lot.type, S, lot.strike, impliedVol(economy), lot.left) * lot.qty / 1000, false);
    });
    if (book.cash > 0.005) put('Свободные деньги', COLOR.faint, book.cash, false);
    return Object.values(map).filter((r) => r.value > 0.005).sort((a, b) => b.value - a.value);
  }, [book, economy, live]);
  const allocTotal = alloc.reduce((a, r) => a + r.value, 0);
  const goalDef = GOALS.find((g) => g.id === goal);
  const goalLine = () => {
    if (!bench) return null;
    if (goal === 'beat_index') return `Индекс: ${fmtMln(bench.stock)} против вашего ${fmtMln(equity)} — вы ${equity >= bench.stock ? 'впереди' : 'позади'} на ${fmtMln(Math.abs(equity - bench.stock))}.`;
    if (goal === 'beat_inflation') return `Сохранение покупательной способности требует ${fmtMln(bench.infl)} — у вас ${fmtMln(equity)}.`;
    if (goal === 'survive') return `Маржин-коллов: ${book.marginCalls || 0}. Цель — пройти цикл без принудительных закрытий.`;
    return `Капитал вырос на ${fmtSigned1(totalRet)}% с начала игры.`;
  };
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Coins size={14} />Ваш капитал
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 9, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>Стоимость</div>
          <div className="ems-mono" style={{ fontSize: 22 }}>{mlnScale(equity).v}<span style={{ fontSize: 11, color: COLOR.faint }}> {mlnScale(equity).unit}</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>В ценах старта</div>
          <div className="ems-mono" style={{ fontSize: 15, color: real >= start ? COLOR.teal : COLOR.rust }}>{mlnScale(real).v}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>За квартал</div>
          <div className="ems-mono" style={{ fontSize: 15, color: qRet >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(qRet)}%</div>
        </div>
      </div>
      {book.history && book.history.length > 2 && (
        <Suspense fallback={<ChartFallback height={54} />}>
          <MemoChart data={book.history} color={COLOR.gold} height={54} label="Капитал" fmt={fmt2} />
        </Suspense>
      )}
      {bench && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7 }}>
          <div style={{ fontSize: 11, color: COLOR.blue, marginBottom: 4 }}>Против эталонов</div>
          {[{ id: 'me', label: 'Ваш портфель', v: equity, color: COLOR.gold }]
            .concat(BENCHMARKS.map((b) => ({ id: b.id, label: b.label, v: bench[b.id], color: b.color })))
            .concat(opponent && Number.isFinite(opponent.value) ? [{ id: 'opponent', label: opponent.label, v: opponent.value, color: COLOR.rust }] : [])
            .sort((a, b) => b.v - a.v)
            .map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, padding: '2px 0',
                color: r.id === 'me' ? COLOR.text : COLOR.muted, fontWeight: r.id === 'me' ? 600 : 400 }}>
                <span className="ems-mono" style={{ width: 14, color: COLOR.faint }}>{idx + 1}</span>
                <span style={{ width: 8, height: 8, background: r.color, borderRadius: 1, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span className="ems-mono">{fmtMln(r.v)}</span>
                <span className="ems-mono" style={{ width: 52, textAlign: 'right', color: (r.v / start - 1) >= 0 ? COLOR.teal : COLOR.rust }}>
                  {fmtSigned1((r.v / start - 1) * 100)}%
                </span>
              </div>
            ))}
          {opponent && !Number.isFinite(opponent.value) && (
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 3 }}>{opponent.label} ещё не выходил на рынок в этой партии.</div>
          )}
        </div>
      )}
      {alloc.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7 }}>
          <div style={{ fontSize: 11, color: COLOR.blue, marginBottom: 6 }}>Портфель по отраслям</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <AllocationDonut rows={alloc} />
            <div style={{ flex: 1, minWidth: 165 }}>
              {alloc.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '1.5px 0' }}>
                  <span style={{ width: 8, height: 8, background: r.color, borderRadius: 1, flexShrink: 0, opacity: r.short ? 0.5 : 1 }} />
                  <span style={{ flex: 1, minWidth: 0, color: COLOR.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}{r.short ? ' · шорт' : ''}
                  </span>
                  <span className="ems-mono" style={{ color: r.net < 0 ? COLOR.rust : COLOR.text }}>{fmtMln(r.value)}</span>
                  <span className="ems-mono" style={{ width: 38, textAlign: 'right', color: COLOR.faint }}>
                    {Math.round(r.value / Math.max(0.0001, allocTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          {Math.abs(optVal) > 0.005 && (
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5 }}>
              Опционы учтены по текущей оценке, фьючерсы — по номиналу позиции, шорты — по модулю: диаграмма показывает риск, а не вложенные деньги.
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0 0', color: COLOR.muted }}>
        <span>Свободные деньги</span>
        <span className="ems-mono" style={{ color: book.cash < 0 ? COLOR.rust : COLOR.text }}>{fmtMln(book.cash)}</span>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
        <b style={{ color: COLOR.goldSoft }}>Ваша цель: {goalDef ? goalDef.label.toLowerCase() : 'приумножить капитал'}.</b> {goalLine()}
        {' '}Инфляция за квартал забирает {fmt1(economy.inflation / 4)}% номинальной стоимости, поэтому «ничего не делать» — это тоже ставка, и обычно проигрышная.
      </div>
      {(book.lastEvents || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {book.lastEvents.map((ev, i) => (
            <div key={i} style={{ fontSize: 11, lineHeight: 1.45, color: ev.kind === 'call' ? COLOR.rust : ev.kind === 'ok' ? COLOR.teal : COLOR.muted,
              borderLeft: `2px solid ${ev.kind === 'call' ? COLOR.rust : COLOR.border}`, paddingLeft: 8, marginTop: 4 }}>
              {ev.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
   КАЗИНО: отдельная вкладка для частного инвестора — рулетка, слоты, кости,
   блэкджек и бинарные опционы. Играет на тот же капитал портфеля (book.cash),
   выигрыш/проигрыш — через onResult(net), тем же путём, что и обычная сделка,
   поэтому сразу видны в общей стоимости портфеля и в сравнении с соперником.
========================================================================================= */
const CASINO_GAMES = [
  { id: 'roulette', label: 'Рулетка', icon: '🎡' },
  { id: 'slots', label: 'Слоты', icon: '🎰' },
  { id: 'dice', label: 'Кости', icon: '🎲' },
  { id: 'blackjack', label: 'Блэкджек', icon: '🃏' },
  { id: 'binary', label: 'Бинарные опционы', icon: '📉' },
];

const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const rouletteColor = (n) => (n === 0 ? 'green' : ROULETTE_RED.has(n) ? 'red' : 'black');
// порядок секторов настоящего европейского колеса — от него зависит, где именно
// останавливается стрелка, а не только какое число «выпало» по RNG
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const WHEEL_SEG = 360 / WHEEL_ORDER.length;
const WHEEL_SIZE = 260;
const WHEEL_GRADIENT = (() => {
  const stops = WHEEL_ORDER.map((n, i) => {
    const c = n === 0 ? '#1F7A4D' : ROULETTE_RED.has(n) ? '#A4342A' : '#17181C';
    return `${c} ${(i * WHEEL_SEG).toFixed(3)}deg ${((i + 1) * WHEEL_SEG).toFixed(3)}deg`;
  }).join(', ');
  return `conic-gradient(${stops})`;
})();
const ROULETTE_BETS = [
  { id: 'red', label: 'Красное', mult: 2 }, { id: 'black', label: 'Чёрное', mult: 2 },
  { id: 'even', label: 'Чёт', mult: 2 }, { id: 'odd', label: 'Нечет', mult: 2 },
  { id: 'low', label: '1–18', mult: 2 }, { id: 'high', label: '19–36', mult: 2 },
  { id: 'straight', label: 'Число', mult: 36 },
];

// Мелкая ставка = процент от свободных денег, крупная = абсолютная сумма —
// общий контрол для всех игр казино, чтобы не плодить одну и ту же вёрстку пять раз
function CasinoBet({ amount, setAmount, cash }) {
  const setPct = (p) => setAmount(Math.max(0.01, Math.round(cash * p * 100) / 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLOR.muted, marginBottom: 4 }}>
        <span>Ставка</span><span className="ems-mono">{fmtMln(amount)}</span>
      </div>
      <input type="range" min={0.01} max={Math.max(0.01, cash)} step={0.01} value={Math.min(amount, Math.max(0.01, cash))}
        onChange={(e) => setAmount(parseFloat(e.target.value))} style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {[0.1, 0.25, 0.5, 1].map((p) => (
          <button key={p} className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }} onClick={() => setPct(p)}>
            {p === 1 ? 'макс.' : `${p * 100}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
const CasinoResult = ({ net }) => (net === null ? null : (
  <div className="ems-mono" style={{ marginTop: 12, fontSize: 19, fontWeight: 700, color: net > 0 ? COLOR.teal : net < 0 ? COLOR.rust : COLOR.muted }}>
    {fmtMlnSigned(net)}
  </div>
));

function RouletteGame({ cash, onResult }) {
  const [betType, setBetType] = useState('red');
  const [number, setNumber] = useState(7);
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [spinning, setSpinning] = useState(false);
  const [spin, setSpin] = useState(null);
  const [rotation, setRotation] = useState(0);
  const SPIN_MS = 2200;
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || spinning) return;
    const n = Math.floor(Math.random() * 37);
    const color = rouletteColor(n);
    const b = ROULETTE_BETS.find((x) => x.id === betType);
    let win = false;
    if (betType === 'straight') win = n === number;
    else if (betType === 'red' || betType === 'black') win = color === betType;
    else if (betType === 'even') win = n !== 0 && n % 2 === 0;
    else if (betType === 'odd') win = n % 2 === 1;
    else if (betType === 'low') win = n >= 1 && n <= 18;
    else if (betType === 'high') win = n >= 19 && n <= 36;
    const net = win ? bet * (b.mult - 1) : -bet;
    // колесо реально останавливается на выпавшем секторе, а не крутится вслепую:
    // подгоняем итоговый угол под сектор n, всегда вперёд от текущего положения
    const idx = WHEEL_ORDER.indexOf(n);
    const targetMod = 360 - (idx * WHEEL_SEG + WHEEL_SEG / 2);
    const curMod = ((rotation % 360) + 360) % 360;
    let delta = targetMod - curMod;
    if (delta <= 0) delta += 360;
    const spins = 5 + Math.floor(Math.random() * 2);
    setSpinning(true); setSpin(null); Audio.play('tick');
    setRotation((r) => r + spins * 360 + delta);
    setTimeout(() => {
      onResult(net);
      Audio.play(win ? 'coin' : 'click');
      setSpin({ n, color, win, net });
      setSpinning(false);
    }, SPIN_MS);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 5 }}>Тип ставки</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {ROULETTE_BETS.map((b) => (
            <span key={b.id} className={`ems-tab ${betType === b.id ? 'active' : ''}`} style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => { Audio.play('tab'); setBetType(b.id); }}>{b.label} <span style={{ color: COLOR.faint }}>×{b.mult}</span></span>
          ))}
        </div>
        {betType === 'straight' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 4 }}>Число (0–36)</div>
            <input type="number" min={0} max={36} value={number} onChange={(e) => setNumber(clamp(parseInt(e.target.value, 10) || 0, 0, 36))}
              style={{ width: '100%', padding: '7px 9px', fontSize: 13, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
          </div>
        )}
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={spinning || cash <= 0} onClick={play}>
          {spinning ? 'Крутится…' : 'Крутить'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE }}>
          <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
            borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: `18px solid ${COLOR.goldSoft}`, zIndex: 2 }} />
          <div className={!spinning && !spin ? 'ems-wheel-idle' : ''} style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: '50%',
            background: WHEEL_GRADIENT, border: `4px solid ${COLOR.borderStrong}`, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.4)',
            transform: `rotate(${rotation}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(0.12,0.67,0.1,0.99)` }}>
            {WHEEL_ORDER.map((n, i) => {
              const mid = i * WHEEL_SEG + WHEEL_SEG / 2;
              return (
                <div key={n} style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, transform: `rotate(${mid}deg)` }}>
                  <span style={{ position: 'absolute', left: -11, top: -(WHEEL_SIZE / 2 - 22), width: 22, textAlign: 'center',
                    fontSize: 12.5, fontWeight: 700, color: '#F4F1E8', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{n}</span>
                </div>
              );
            })}
          </div>
          <div className="ems-mono" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 80, height: 80, borderRadius: '50%', background: COLOR.panel, border: `3px solid ${COLOR.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700,
            color: !spin ? COLOR.faint : spin.color === 'red' ? COLOR.rust : spin.color === 'black' ? COLOR.text : COLOR.teal }}>
            {spinning ? '' : spin ? spin.n : '—'}
          </div>
        </div>
        {spin && !spinning && (
          <div className="ems-coin-pop" style={{ marginTop: 12, fontSize: 13, color: COLOR.muted }}>
            Выпало {spin.n} ({spin.color === 'red' ? 'красное' : spin.color === 'black' ? 'чёрное' : 'зеро'}) — {spin.win ? 'выигрыш' : 'проигрыш'}
          </div>
        )}
        <div className={spin && !spinning ? (spin.win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ borderRadius: 8 }}>
          <CasinoResult net={spin && !spinning ? spin.net : null} />
        </div>
      </div>
    </div>
  );
}

const SLOT_SYMBOLS = [
  { id: 'cherry', icon: '🍒', weight: 40, pay3: 4, pay2: 1.5 },
  { id: 'lemon', icon: '🍋', weight: 28, pay3: 6 },
  { id: 'bell', icon: '🔔', weight: 16, pay3: 12 },
  { id: 'gem', icon: '💎', weight: 8, pay3: 25 },
  { id: 'seven', icon: '7️⃣', weight: 3, pay3: 60 },
];
const SLOT_WEIGHT_TOTAL = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
const pickSlotSymbol = () => {
  let r = Math.random() * SLOT_WEIGHT_TOTAL;
  for (const s of SLOT_SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
  return SLOT_SYMBOLS[0];
};
function SlotsGame({ cash, onResult }) {
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [display, setDisplay] = useState([SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]]);
  const [spinningReels, setSpinningReels] = useState([false, false, false]);
  const [net, setNet] = useState(null);
  const [win, setWin] = useState(false);
  const timersRef = React.useRef([]);
  React.useEffect(() => () => timersRef.current.forEach(clearInterval), []);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || spinningReels.some(Boolean)) return;
    Audio.play('tick');
    const final = [pickSlotSymbol(), pickSlotSymbol(), pickSlotSymbol()];
    let mult = 0;
    if (final[0].id === final[1].id && final[1].id === final[2].id) mult = final[0].pay3;
    else if (final.filter((s) => s.id === 'cherry').length >= 2) mult = SLOT_SYMBOLS[0].pay2;
    const didWin = mult > 0;
    const n = didWin ? bet * mult : -bet;
    setNet(null); setWin(false);
    setSpinningReels([true, true, true]);
    timersRef.current.forEach(clearInterval); timersRef.current = [];
    // барабаны останавливаются не одновременно, а с задержкой друг за другом —
    // тот самый «дзынь-дзынь-дзынь» настоящего слот-автомата
    [0, 1, 2].forEach((i) => {
      const iv = setInterval(() => setDisplay((d) => { const nd = [...d]; nd[i] = pickSlotSymbol(); return nd; }), 65);
      timersRef.current.push(iv);
      setTimeout(() => {
        clearInterval(iv); Audio.play('tick');
        setDisplay((d) => { const nd = [...d]; nd[i] = final[i]; return nd; });
        setSpinningReels((s) => { const ns = [...s]; ns[i] = false; return ns; });
        if (i === 2) {
          onResult(n);
          Audio.play(didWin ? 'coin' : 'click');
          setNet(n); setWin(didWin);
        }
      }, 600 + i * 280);
    });
  };
  const anySpinning = spinningReels.some(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={anySpinning || cash <= 0} onClick={play}>
          {anySpinning ? 'Крутится…' : 'Крутить'}
        </button>
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9, lineHeight: 1.5 }}>
          {SLOT_SYMBOLS.map((s) => (<div key={s.id}>{s.icon}{s.icon}{s.icon} × {s.pay3}</div>))}
          <div>🍒🍒 × {SLOT_SYMBOLS[0].pay2}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className={net !== null ? (win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ display: 'flex', gap: 16, fontSize: 66, padding: 10, borderRadius: 10 }}>
          {display.map((s, i) => (
            <div key={i} className={spinningReels[i] ? 'ems-reel-spin' : net !== null ? 'ems-coin-pop' : ''}
              style={{ width: 98, height: 98, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: COLOR.panelAlt, border: `2px solid ${spinningReels[i] ? COLOR.gold : COLOR.border}`, borderRadius: 6 }}>
              {s.icon}
            </div>
          ))}
        </div>
        <CasinoResult net={net} />
      </div>
    </div>
  );
}

const DICE_BETS = [
  { id: 'under', label: 'Меньше 7', mult: 2 }, { id: 'over', label: 'Больше 7', mult: 2 }, { id: 'seven', label: 'Ровно 7', mult: 5 },
];
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function DiceGame({ cash, onResult }) {
  const [betType, setBetType] = useState('over');
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [net, setNet] = useState(null);
  const [win, setWin] = useState(false);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || rolling) return;
    setRolling(true); setNet(null); Audio.play('tick');
    setTimeout(() => {
      const d1 = 1 + Math.floor(Math.random() * 6); const d2 = 1 + Math.floor(Math.random() * 6);
      const sum = d1 + d2;
      const b = DICE_BETS.find((x) => x.id === betType);
      let didWin = false;
      if (betType === 'under') didWin = sum < 7;
      else if (betType === 'over') didWin = sum > 7;
      else didWin = sum === 7;
      const n = didWin ? bet * (b.mult - 1) : -bet;
      onResult(n);
      Audio.play(didWin ? 'coin' : 'click');
      setDice([d1, d2, sum]); setNet(n); setWin(didWin);
      setRolling(false);
    }, 650);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 5 }}>Ставка на сумму двух костей</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {DICE_BETS.map((b) => (
            <span key={b.id} className={`ems-tab ${betType === b.id ? 'active' : ''}`} style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => { Audio.play('tab'); setBetType(b.id); }}>{b.label} <span style={{ color: COLOR.faint }}>×{b.mult}</span></span>
          ))}
        </div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={rolling || cash <= 0} onClick={play}>
          {rolling ? 'Бросок…' : 'Бросить'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className={net !== null ? (win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ display: 'flex', gap: 16, padding: 10, borderRadius: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} className={rolling ? 'ems-dice-roll' : dice ? 'ems-coin-pop' : ''}
              style={{ width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, lineHeight: 1,
                color: COLOR.text, background: COLOR.panelAlt, border: `2px solid ${COLOR.border}`, borderRadius: 10 }}>
              {rolling ? '⚅' : dice ? DICE_FACES[dice[i]] : '—'}
            </div>
          ))}
        </div>
        {dice && !rolling && <div style={{ marginTop: 10, fontSize: 13, color: COLOR.muted }}>Сумма: {dice[2]}</div>}
        <CasinoResult net={rolling ? null : net} />
      </div>
    </div>
  );
}

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const drawCard = () => CARD_RANKS[Math.floor(Math.random() * 13)] + CARD_SUITS[Math.floor(Math.random() * 4)];
const cardRank = (c) => c.slice(0, -1);
const cardSuit = (c) => c.slice(-1);
const cardValue = (c) => { const r = cardRank(c); return r === 'A' ? 11 : (r === 'J' || r === 'Q' || r === 'K') ? 10 : parseInt(r, 10); };
function handValue(cards) {
  let sum = cards.reduce((a, c) => a + cardValue(c), 0);
  let aces = cards.filter((c) => cardRank(c) === 'A').length;
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
const Card = ({ c, hidden, dealIndex, className }) => {
  const red = !hidden && (cardSuit(c) === '♥' || cardSuit(c) === '♦');
  return (
    <div className={`ems-mono ems-card-deal ${className || ''}`} style={{ width: 70, height: 98, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: hidden ? COLOR.panelRaised : '#F4F1E8', color: hidden ? COLOR.faint : red ? '#A4342A' : '#17181C', borderRadius: 7, fontSize: 22, fontWeight: 700, lineHeight: 1.2,
      border: `1px solid ${COLOR.border}`, boxShadow: '0 3px 8px rgba(0,0,0,0.35)', animationDelay: `${(dealIndex || 0) * 90}ms` }}>
      {hidden ? <span style={{ fontSize: 32 }}>🂠</span> : (<><span>{cardRank(c)}</span><span style={{ fontSize: 26 }}>{cardSuit(c)}</span></>)}
    </div>
  );
};
function BlackjackGame({ cash, onResult }) {
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [phase, setPhase] = useState('bet'); // bet | player | done
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [bet, setBet] = useState(0);
  const [outcome, setOutcome] = useState(null);
  const resolve = (p, d, b) => {
    const pv = handValue(p); const dv = handValue(d);
    const pBJ = pv === 21 && p.length === 2; const dBJ = dv === 21 && d.length === 2;
    let net; let text;
    if (pv > 21) { net = -b; text = 'Перебор — вы проиграли.'; }
    else if (pBJ && !dBJ) { net = b * 1.5; text = 'Блэкджек! Выплата 3:2.'; }
    else if (dBJ && !pBJ) { net = -b; text = 'Блэкджек у дилера.'; }
    else if (dv > 21) { net = b; text = 'Дилер перебрал — вы выиграли.'; }
    else if (pv > dv) { net = b; text = 'Вы выиграли.'; }
    else if (pv < dv) { net = -b; text = 'Дилер выиграл.'; }
    else { net = 0; text = 'Ничья — ставка возвращена.'; }
    onResult(net);
    Audio.play(net > 0 ? 'coin' : net < 0 ? 'click' : 'tick');
    setDealer(d); setOutcome({ text, net }); setPhase('done');
  };
  const deal = () => {
    const b = clamp(amount, 0.01, cash);
    if (b <= 0) return;
    const p = [drawCard(), drawCard()]; const d = [drawCard(), drawCard()];
    setPlayer(p); setDealer(d); setBet(b); setOutcome(null);
    Audio.play('tick');
    if (handValue(p) === 21 || handValue(d) === 21) resolve(p, d, b);
    else setPhase('player');
  };
  const hit = () => {
    const p = [...player, drawCard()];
    setPlayer(p); Audio.play('tick');
    if (handValue(p) > 21) resolve(p, dealer, bet);
  };
  const stand = () => {
    let d = [...dealer];
    while (handValue(d) < 17) d = [...d, drawCard()];
    resolve(player, d, bet);
  };
  const again = () => { setPhase('bet'); setPlayer([]); setDealer([]); setOutcome(null); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        {phase === 'bet' ? (
          <>
            <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
            <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={cash <= 0} onClick={deal}>Сдать карты</button>
          </>
        ) : phase === 'player' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ems-btn" style={{ flex: 1, padding: '10px 0' }} onClick={hit}>Ещё карту</button>
            <button className="ems-btn primary" style={{ flex: 1, padding: '10px 0' }} onClick={stand}>Хватит</button>
          </div>
        ) : (
          <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} onClick={again}>Ещё раз</button>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>Дилер {phase !== 'bet' && phase !== 'player' && `— ${handValue(dealer)}`}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {dealer.map((c, i) => {
            const hidden = phase === 'player' && i === 1;
            return <Card key={i} c={c} hidden={hidden} dealIndex={i} className={!hidden && phase === 'done' && i === 1 ? 'ems-card-flip' : ''} />;
          })}
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>Вы {player.length > 0 && `— ${handValue(player)}`}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {player.map((c, i) => (<Card key={i} c={c} dealIndex={i} />))}
        </div>
        {outcome && (
          <div style={{ marginTop: 10, fontSize: 12, color: COLOR.muted }}>{outcome.text}</div>
        )}
        <div className={outcome ? (outcome.net > 0 ? 'ems-win-pulse' : outcome.net < 0 ? 'ems-lose-pulse' : '') : ''} style={{ borderRadius: 8 }}>
          <CasinoResult net={outcome ? outcome.net : null} />
        </div>
      </div>
    </div>
  );
}

function BinaryOptionGame({ cash, onResult }) {
  const [instrId, setInstrId] = useState('eq_broad');
  const [dir, setDir] = useState('up');
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [path, setPath] = useState([50]);
  const tickRef = React.useRef(null);
  React.useEffect(() => () => clearInterval(tickRef.current), []);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || busy) return;
    setBusy(true); setRes(null); setPath([50]); Audio.play('tick');
    const up = Math.random() < 0.5;
    const win = (dir === 'up' && up) || (dir === 'down' && !up);
    const net = win ? bet * 0.85 : -bet;
    // «живой» тик котировки — тянет к итоговому направлению, но с шумом,
    // а не прямая линия, чтобы разрешение пари не выглядело предрешённым сразу
    const drift = up ? 1.7 : -1.7;
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setPath((prev) => [...prev, clamp(prev[prev.length - 1] + drift + (Math.random() - 0.5) * 5.5, 4, 96)].slice(-26));
    }, 90);
    setTimeout(() => {
      clearInterval(tickRef.current);
      onResult(net);
      Audio.play(win ? 'coin' : 'click');
      setRes({ up, win, net });
      setBusy(false);
    }, 1450);
  };
  const instr = INSTR_BY_ID[instrId];
  const lineColor = busy ? COLOR.gold : res ? (res.win ? COLOR.teal : COLOR.rust) : COLOR.faint;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 5 }}>Инструмент</div>
        <select value={instrId} onChange={(e) => setInstrId(e.target.value)}
          style={{ width: '100%', padding: '7px 9px', fontSize: 12, marginBottom: 10, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }}>
          {INSTRUMENTS.filter((i) => i.kind === 'spot').map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
        </select>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', background: dir === 'up' ? COLOR.tealDim : COLOR.panelAlt, borderColor: dir === 'up' ? COLOR.teal : COLOR.border, color: dir === 'up' ? COLOR.teal : COLOR.text }}
            onClick={() => setDir('up')}><ArrowUpRight size={13} style={{ verticalAlign: -2 }} /> Вверх</button>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', background: dir === 'down' ? COLOR.rustDim : COLOR.panelAlt, borderColor: dir === 'down' ? COLOR.rust : COLOR.border, color: dir === 'down' ? COLOR.rust : COLOR.text }}
            onClick={() => setDir('down')}><ArrowDownRight size={13} style={{ verticalAlign: -2 }} /> Вниз</button>
        </div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={busy || cash <= 0} onClick={play}>
          {busy ? 'Идёт торг…' : 'Заключить пари'}
        </button>
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9 }}>Выплата 1.85× ставки при угадывании направления {instr ? instr.name.toLowerCase() : ''} — без плеча, без комиссии, чистое пари на монетку.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
        <div className={res && !busy ? (res.win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ width: '100%', maxWidth: 480, borderRadius: 10, padding: 8 }}>
          <svg width="100%" height="150" viewBox="0 0 100 90" preserveAspectRatio="none" style={{ display: 'block' }}>
            <line x1="0" y1="45" x2="100" y2="45" stroke={COLOR.hairline} strokeWidth="0.6" strokeDasharray="2,2" />
            <polyline points={path.map((v, i) => `${(i / Math.max(1, path.length - 1)) * 100},${90 - (v / 100) * 90}`).join(' ')}
              fill="none" stroke={lineColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        {res && !busy && (
          <div className="ems-coin-pop" style={{ marginTop: 4, fontSize: 12, color: COLOR.muted }}>
            {res.up ? <ArrowUpRight size={13} color={COLOR.teal} style={{ verticalAlign: -2 }} /> : <ArrowDownRight size={13} color={COLOR.rust} style={{ verticalAlign: -2 }} />} Рынок пошёл {res.up ? 'вверх' : 'вниз'} — {res.win ? 'вы угадали' : 'вы не угадали'}
          </div>
        )}
        <CasinoResult net={busy ? null : res ? res.net : null} />
      </div>
    </div>
  );
}

function CasinoScreen({ book, onCasino }) {
  const [game, setGame] = useState('roulette');
  const cash = Math.max(0, book.cash);
  return (
      <div className="ems-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', padding: '9px 13px',
          borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panelAlt }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Dices size={13} color={COLOR.gold} />
            <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Казино</span>
          </span>
          <span style={{ fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'baseline' }}>
            <span style={{ color: COLOR.muted }}>Свободные деньги</span><span className="ems-mono" style={{ color: cash < 0.01 ? COLOR.rust : COLOR.text }}>{fmtMln(cash)}</span>
          </span>
          <span style={{ fontSize: 10.5, color: COLOR.faint, marginLeft: 'auto' }}>
            Матожидание отрицательное — это развлечение, а не стратегия
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '9px 13px', borderBottom: `1px solid ${COLOR.border}` }}>
          {CASINO_GAMES.map((g) => (
            <span key={g.id} className={`ems-tab ${game === g.id ? 'active' : ''}`} style={{ padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => { Audio.play('tab'); setGame(g.id); }}>{g.icon} {g.label}</span>
          ))}
        </div>
        {/* лёгкий зелёный отблеск поверх ФОНА ТЕМЫ, а не сплошной сукно-зелёный:
            текст внутри игр по-прежнему берёт цвета из COLOR.* — если сделать
            стол по-настоящему тёмным, он ломает контраст на светлой теме */}
        <div style={{ padding: 24, borderTop: `2px solid ${COLOR.gold}`,
          background: `radial-gradient(ellipse 480px 220px at 50% -10%, rgba(31,122,77,0.16) 0%, rgba(31,122,77,0) 62%), ${COLOR.panel}` }}>
          {cash <= 0 && (
            <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 12 }}>Свободных денег нет — освободите средства из позиций на «Рынке», чтобы сделать ставку.</div>
          )}
          {game === 'roulette' && <RouletteGame cash={cash} onResult={onCasino} />}
          {game === 'slots' && <SlotsGame cash={cash} onResult={onCasino} />}
          {game === 'dice' && <DiceGame cash={cash} onResult={onCasino} />}
          {game === 'blackjack' && <BlackjackGame cash={cash} onResult={onCasino} />}
          {game === 'binary' && <BinaryOptionGame cash={cash} onResult={onCasino} />}
        </div>
      </div>
  );
}

/* Панель ведомств для инвестора: только наблюдаемые факты и публичные заявления */
function InstitutionsPanel({ economy, cbAction, mofAction }) {
  const row = (l, v) => (
    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0' }}>
      <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
    </div>
  );
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Landmark size={13} />Что видно со стороны
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
        Вы не в кабинете: намерений ведомств вам никто не сообщает. Есть только их решения, цифры и публичные заявления — по ним и приходится догадываться, что будет дальше.
      </div>
      <div style={{ fontSize: 11, color: COLOR.blue, marginBottom: 3 }}>Центральный банк</div>
      {row('Ключевая ставка', pctFmt(economy.keyRate))}
      {row('Объявленная цель по инфляции', pctFmt(economy.inflationTarget))}
      {row('Инфляция / ожидания', `${fmt1(economy.inflation)}% / ${fmt1(economy.inflationExpectations)}%`)}
      {row('Норматив капитала банков', pctFmt(economy.capitalRequirement))}
      <div style={{ fontSize: 11, color: COLOR.blue, margin: '8px 0 3px' }}>Минфин</div>
      {row('Баланс бюджета', `${fmtSigned1(economy.budgetBalancePctGdp)}% ВВП`)}
      {row('Госдолг', pctFmt(economy.debtToGdp))}
      {row('НДС / прибыль', `${fmt1(economy.vatRate)}% / ${fmt1(economy.profitTaxRate)}%`)}
      {[['Заявление ЦБ', cbAction], ['Заявление Минфина', mofAction]].map(([title, act]) => (act && act.quote ? (
        <div key={title} style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9, color: COLOR.muted }}>
          <span style={{ color: COLOR.faint }}>{title}: </span>«{act.quote}»
        </div>
      ) : null))}
    </div>
  );
}

/* ============================ МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ ============================ */
function RequestPanel({ role, botRole, pending, setPending, lastResponse }) {
  if (!botRole || botRole === 'both') return null;
  const options = REQUESTS.filter((r) => r.from === role);
  if (!options.length) return null;
  const cur = options.find((r) => r.id === pending);
  const target = botRole === 'central_bank' ? 'Центральному банку' : 'Минфину';
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Megaphone size={13} />Официальный запрос {target}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <span className={`ems-tab ${!pending ? 'active' : ''}`} style={{ fontSize: 10.5, padding: '3px 8px' }}
          onClick={() => { Audio.play('tick'); setPending(null); }}>без запроса</span>
        {options.map((r) => (
          <span key={r.id} className={`ems-tab ${pending === r.id ? 'active' : ''}`} style={{ fontSize: 10.5, padding: '3px 8px' }}
            onClick={() => { Audio.play('click'); setPending(r.id); }}>{r.label}</span>
        ))}
      </div>
      {cur && (
        <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.gold}`, paddingLeft: 9 }}>
          «{askText(cur, 1)}»
          <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4 }}>Запрос уйдёт вместе с вашими решениями. Ответ зависит от характера ведомства и от того, насколько просьба соответствует ситуации.</div>
        </div>
      )}
      {lastResponse && (
        <div style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${lastResponse.status === 'accepted' ? COLOR.teal : lastResponse.status === 'partial' ? COLOR.gold : COLOR.rust}`, paddingLeft: 9 }}>
          <span style={{ color: lastResponse.status === 'accepted' ? COLOR.teal : lastResponse.status === 'partial' ? COLOR.gold : COLOR.rust, fontWeight: 600 }}>
            {lastResponse.status === 'accepted' ? 'Запрос удовлетворён: ' : lastResponse.status === 'partial' ? 'Частично удовлетворён: ' : 'Отказано: '}
          </span>
          <span style={{ color: COLOR.muted }}>{lastResponse.text}</span>
        </div>
      )}
    </div>
  );
}


/* ============================ ПРЕДСТАВЛЕНИЕ И ДОСТУПНОСТЬ ============================ */
const DASHBOARD_PRESETS = [
  { id: 'overview', name: 'Обзор', pins: ['gdp', 'outputGap', 'inflation', 'unemployment', 'debtToGdp', 'approval'] },
  { id: 'prices', name: 'Цены и ставки', pins: ['inflation', 'inflationExpectations', 'cbCredibility', 'keyRate', 'lendingRate', 'rStar', 'wageGrowth'] },
  { id: 'budget', name: 'Бюджет', pins: ['budgetBalancePctGdp', 'debtToGdp', 'interestToRevenue', 'revenuePctGdp', 'shadowShare', 'sovereignFund'] },
  { id: 'market', name: 'Рынок', pins: ['stockIndex', 'bondIndex', 'yield10y', 'curveSlope', 'sovereignSpread', 'volatilityIndex'] },
  { id: 'crisis', name: 'Кризис', pins: ['bankNPL', 'bankCapitalAdequacy', 'bankingRisk', 'reserves', 'exchangeRate', 'unemployment'] },
];
/* Пользовательские наборы дашборда хранятся на устройстве (как достижения), а не
   только внутри конкретного сохранения — «Сохранить текущий набор» должен пережить
   и «Начать заново», и переход в другую партию. */
/* Настройка графика — категория, период и выключенные линии — тоже запоминается
   на устройстве. Раньше каждая новая партия (и каждое возвращение в меню) начиналась
   с «Выпуск» и всеми включёнными линиями, хотя человек уже настроил себе вид. */
const CHART_VIEW_KEY = 'ems-chart-view';
const loadChartView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CHART_VIEW_KEY) || '{}');
    return {
      group: typeof v.group === 'string' ? v.group : 'output',
      period: typeof v.period === 'string' ? v.period : '5y',
      hidden: Array.isArray(v.hidden) ? v.hidden.filter((x) => typeof x === 'string') : [],
    };
  } catch { return { group: 'output', period: '5y', hidden: [] }; }
};
const persistChartView = (v) => {
  try { localStorage.setItem(CHART_VIEW_KEY, JSON.stringify(v)); } catch { /* приватный режим */ }
};
/* Хук на три связанных значения: и в одиночной партии, и в сетевой — один и тот же
   вид графика, потому что настраивает его один и тот же человек. */
function useChartView() {
  const init = React.useRef(null);
  if (!init.current) init.current = loadChartView();
  const [chartGroup, setChartGroup] = useState(init.current.group);
  const [period, setPeriod] = useState(init.current.period);
  const [hiddenSeries, setHiddenSeries] = useState(init.current.hidden);
  React.useEffect(() => { persistChartView({ group: chartGroup, period, hidden: hiddenSeries }); },
    [chartGroup, period, hiddenSeries]);
  return { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries };
}

const CUSTOM_DASHBOARDS_KEY = 'ems-custom-dashboards';
const HIDDEN_PRESETS_KEY = 'ems-hidden-dashboards';
const loadCustomDashboards = () => {
  try { const arr = JSON.parse(localStorage.getItem(CUSTOM_DASHBOARDS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};
const persistCustomDashboards = (list) => {
  try { localStorage.setItem(CUSTOM_DASHBOARDS_KEY, JSON.stringify(list)); } catch { /* приватный режим */ }
};
/* Свои наборы дашбордов лежат и в localStorage устройства, и — снимком на момент
   сохранения — в каждой партии. Без надгробного списка удалённый набор молча
   возвращался: загрузка более старой партии видела его в своём снимке, не
   находила среди актуальных (loadCustomDashboards уже без него) и решала, что
   это забытый набор из прошлого, который надо вернуть. */
const DELETED_CUSTOM_KEY = 'ems-deleted-dashboards';
const loadDeletedCustomIds = () => {
  try { const arr = JSON.parse(localStorage.getItem(DELETED_CUSTOM_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};
const persistDeletedCustomIds = (list) => {
  try { localStorage.setItem(DELETED_CUSTOM_KEY, JSON.stringify(list.slice(-200))); } catch { /* приватный режим */ }
};
/* Встроенные наборы («Обзор», «Цены и ставки»…) удалить насовсем нельзя — иначе
   их было бы не вернуть; вместо этого запоминаем, какие из них скрыты, и «Сбросить»
   возвращает список к заводскому виду. */
const PRESET_NAMES_KEY = 'ems-dashboard-names';
const loadHiddenPresets = () => {
  try { const arr = JSON.parse(localStorage.getItem(HIDDEN_PRESETS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};
const persistHiddenPresets = (list) => {
  try { localStorage.setItem(HIDDEN_PRESETS_KEY, JSON.stringify(list)); } catch { /* приватный режим */ }
};
const loadPresetNames = () => {
  try { const o = JSON.parse(localStorage.getItem(PRESET_NAMES_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
  catch { return {}; }
};
const persistPresetNames = (map) => {
  try { localStorage.setItem(PRESET_NAMES_KEY, JSON.stringify(map)); } catch { /* приватный режим */ }
};
// Сохранение может нести свои собственные наборы (например, сделанные до появления
// этой возможности) — подмешиваем их к общеустройственным и заодно закрепляем там же.
function initDashboards(savedDashboards) {
  const stored = loadCustomDashboards();
  const deleted = loadDeletedCustomIds();
  const extra = (savedDashboards || []).filter((d) => d && d.custom
    && !stored.some((s) => s.id === d.id) && !deleted.includes(d.id));
  const merged = [...stored, ...extra];
  if (extra.length) persistCustomDashboards(merged);
  const hidden = loadHiddenPresets();
  const names = loadPresetNames();
  const presets = DASHBOARD_PRESETS.filter((d) => !hidden.includes(d.id))
    .map((d) => (names[d.id] ? { ...d, name: names[d.id] } : d));
  return [...presets, ...merged];
}
// «Сбросить» имеет смысл показывать, только если со встроенными наборами что-то
// сделали: убрали из списка или переименовали. Свои наборы кнопка не трогает.
const presetsAreDefault = (list) => DASHBOARD_PRESETS.every((p) => list.some((d) => d.id === p.id && d.name === p.name));
/* Что закреплено на верхней полосе и какой набор выбран — это тоже настройка вида,
   а не часть партии: раньше она жила только в памяти вкладки, и любое изменение
   пропадало, если его не сохранить кнопкой отдельным набором. */
const PINS_KEY = 'ems-pins';
const loadPinView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PINS_KEY) || '{}');
    const pins = Array.isArray(v.pinned) ? v.pinned.filter((k) => typeof k === 'string' && ALL_METRICS[k]) : [];
    return { pinned: pins.length ? pins.slice(0, MAX_PINS) : null,
      activeDash: typeof v.activeDash === 'string' ? v.activeDash : null };
  } catch { return { pinned: null, activeDash: null }; }
};
const persistPinView = (pinned, activeDash) => {
  try { localStorage.setItem(PINS_KEY, JSON.stringify({ pinned, activeDash })); } catch { /* приватный режим */ }
};
/* Закреплённые показатели: своя память на устройстве, плюс автосохранение в свой
   набор, если сейчас выбран именно он. Партия, загруженная из сохранения, важнее:
   в ней полоса была своя. */
function usePinnedStrip(initialPins, initialDash, dashActions) {
  const saved = React.useRef(null);
  if (!saved.current) saved.current = loadPinView();
  const [activeDash, setActiveDash] = useState(initialDash || saved.current.activeDash || 'overview');
  const [pinned, setPinned] = useState(initialPins || saved.current.pinned || DEFAULT_PINS);
  React.useEffect(() => {
    persistPinView(pinned, activeDash);
    dashActions.syncActive(activeDash, pinned);
    // dashActions пересоздаётся каждый рендер — в зависимостях ему делать нечего
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, activeDash]);
  return { pinned, setPinned, activeDash, setActiveDash };
}

/* Ширина и порядок трёх столбцов панели («Решения»/«Новости и графики»/«Показатели») —
   настройка устройства, общая для одиночной и сетевой партии. Ниже 1241px CSS сама
   переводит сетку в адаптивный режим (см. .ems-grid) — там своя ширина и порядок не
   к месту, поэтому в этом диапазоне хук отдаёт исходный порядок и не трогает шаблон. */
function useLayoutColumns() {
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [columnOrder, setColumnOrderState] = useState(() => loadColumnOrder());
  const [columnWidths, setColumnWidthsState] = useState(() => loadColumnWidths());
  const [wide, setWide] = useState(true);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1241px)');
    const upd = () => setWide(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const moveColumn = (id, dir) => setColumnOrderState((prev) => {
    const idx = prev.indexOf(id); const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev]; [next[idx], next[j]] = [next[j], next[idx]];
    persistColumnOrder(next);
    return next;
  });
  const setColumnWidthsLive = (w) => setColumnWidthsState(w);
  const commitWidths = (w) => { setColumnWidthsState(w); persistColumnWidths(w); };
  const resetLayout = () => {
    setColumnOrderState([...DEFAULT_COLUMN_ORDER]);
    setColumnWidthsState({ ...DEFAULT_COLUMN_WIDTHS });
    persistColumnOrder([...DEFAULT_COLUMN_ORDER]);
    persistColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
  };
  return { layoutEditMode, setLayoutEditMode, columnOrder, columnWidths, wide, moveColumn,
    setColumnWidthsLive, commitWidths, resetLayout, layoutIsDefaultNow: layoutIsDefault(columnOrder, columnWidths) };
}

/* Действия над наборами одинаковы в соло- и сетевом экране, а правила хранения
   нетривиальны (свои наборы лежат целиком, у встроенных хранятся только отличия) —
   поэтому логика одна на оба экрана, а не две расходящиеся копии. */
function makeDashboardActions(setDashboards) {
  const syncCustom = (next) => { persistCustomDashboards(next.filter((d) => d.custom)); return next; };
  return {
    saveDash: (pins, setActive) => {
      const id = `custom${Date.now()}`;
      setDashboards((ds) => {
        const name = `Мой набор ${ds.filter((d) => d.custom).length + 1}`;
        return syncCustom([...ds, { id, name, pins: [...pins], custom: true }]);
      });
      setActive(id);
    },
    /* Правка полосы при выбранном своём наборе пишется прямо в него: отдельная
       кнопка «сохранить» для этого не нужна — набор и есть то, что сейчас на
       экране. Встроенные наборы так не меняются: их правят «поверх», а вернуть
       исходный вид можно кнопкой сброса. */
    syncActive: (id, pins) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (!target || !target.custom) return ds;
      if (target.pins.length === pins.length && target.pins.every((k, i) => k === pins[i])) return ds;
      return syncCustom(ds.map((d) => (d.id === id ? { ...d, pins: [...pins] } : d)));
    }),
    deleteDash: (id) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (target && !target.custom) persistHiddenPresets([...loadHiddenPresets().filter((x) => x !== id), id]);
      // надгробие нужно только своим наборам: встроенные и так не возвращаются
      // из старых партий (initDashboards пересобирает их заново из HIDDEN_PRESETS_KEY)
      if (target && target.custom) persistDeletedCustomIds([...loadDeletedCustomIds().filter((x) => x !== id), id]);
      return syncCustom(ds.filter((d) => d.id !== id));
    }),
    renameDash: (id) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (!target) return ds;
      const raw = window.prompt('Новое название набора', target.name);
      if (raw === null) return ds;
      const name = raw.trim().slice(0, 28);
      if (!name || name === target.name) return ds;
      if (!target.custom) persistPresetNames({ ...loadPresetNames(), [id]: name });
      return syncCustom(ds.map((d) => (d.id === id ? { ...d, name } : d)));
    }),
    resetDash: () => setDashboards((ds) => {
      persistHiddenPresets([]); persistPresetNames({});
      return [...DASHBOARD_PRESETS, ...ds.filter((d) => d.custom)];
    }),
  };
}
const haptic = (pattern) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch { /* не поддерживается */ } };

/* Макет трёх столбцов панели («Решения» / «Новости и графики» / «Показатели») —
   какой из них слева, в центре, справа, и насколько широки крайние. Устройство,
   а не партия: хранится напрямую в localStorage, как тема, а не в сохранении игры. */
const LAYOUT_ORDER_KEY = 'ems-layout-order';
const LAYOUT_WIDTHS_KEY = 'ems-layout-widths';
const DEFAULT_COLUMN_ORDER = ['left', 'center', 'right'];
const DEFAULT_COLUMN_WIDTHS = { left: 300, right: 300 };
const COLUMN_LABELS = { left: 'Решения', center: 'Новости и графики', right: 'Показатели' };
const loadColumnOrder = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(LAYOUT_ORDER_KEY) || 'null');
    if (Array.isArray(arr) && arr.length === 3 && ['left', 'center', 'right'].every((k) => arr.includes(k))) return arr;
  } catch { /* приватный режим */ }
  return [...DEFAULT_COLUMN_ORDER];
};
const persistColumnOrder = (order) => { try { localStorage.setItem(LAYOUT_ORDER_KEY, JSON.stringify(order)); } catch { /* приватный режим */ } };
const loadColumnWidths = () => {
  try {
    const o = JSON.parse(localStorage.getItem(LAYOUT_WIDTHS_KEY) || 'null');
    if (o && Number.isFinite(o.left) && Number.isFinite(o.right)) return { left: clamp(o.left, 220, 520), right: clamp(o.right, 220, 520) };
  } catch { /* приватный режим */ }
  return { ...DEFAULT_COLUMN_WIDTHS };
};
const persistColumnWidths = (w) => { try { localStorage.setItem(LAYOUT_WIDTHS_KEY, JSON.stringify(w)); } catch { /* приватный режим */ } };
const layoutIsDefault = (order, widths) => DEFAULT_COLUMN_ORDER.every((v, i) => order[i] === v)
  && widths.left === DEFAULT_COLUMN_WIDTHS.left && widths.right === DEFAULT_COLUMN_WIDTHS.right;

/* Перетаскиваемая граница между двумя столбцами: «резиновый» (center, 1fr) сосед
   ширину не хранит — тянется тот, у кого она вообще есть. Если по обе стороны
   от границы стоят два фиксированных столбца (после перестановки), двигаются оба
   разом, как в обычном сплиттере. */
function ColumnResizeHandle({ leftId, rightId, widths, onResize, onCommit }) {
  const dragRef = React.useRef(null);
  const onPointerDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidths: { ...widths } };
    const move = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const next = { ...dragRef.current.startWidths };
      if (leftId !== 'center') next[leftId] = clamp(dragRef.current.startWidths[leftId] + dx, 220, 520);
      if (rightId !== 'center') next[rightId] = clamp(dragRef.current.startWidths[rightId] - dx, 220, 520);
      dragRef.current.last = next;
      onResize(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragRef.current && dragRef.current.last) onCommit(dragRef.current.last);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div onPointerDown={onPointerDown} title="Потяните, чтобы изменить ширину столбцов"
      style={{ position: 'absolute', top: 0, bottom: 0, right: -11, width: 14, cursor: 'col-resize', zIndex: 5 }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 6, width: 2, borderRadius: 1,
        background: COLOR.gold, opacity: 0.55 }} />
    </div>
  );
}

function ViewSettings({ theme, setTheme, dense, setDense, dashboards, activeDash, applyDash, saveDash, deleteDash, renameDash, resetDash,
  layoutEditMode, setLayoutEditMode, columnOrder, moveColumn, resetLayout, layoutIsDefaultNow }) {
  const DD_WIDTH = 250;
  const { open, setOpen, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="ems-btn" style={{ padding: '7px 9px' }} title="Вид, тема и доступность" aria-label="Настройки вида"
        onClick={() => { Audio.play('click'); toggle(); }}>
        <Sliders size={14} />
      </button>
      {open && (
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: DD_WIDTH, padding: 13, zIndex: 60, maxHeight: pos.maxHeight, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft }}>Тема оформления</span>
            <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 5px', lineHeight: 0 }} aria-label="Закрыть"
              onClick={() => { Audio.play('click'); setOpen(false); }}><X size={12} /></button>
          </div>
          {Object.values(THEMES).map((t) => (
            <button key={t.id} className="ems-btn" style={{ width: '100%', textAlign: 'left', padding: '6px 9px', fontSize: 11.5, marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 7,
              background: theme === t.id ? COLOR.gold : COLOR.panelAlt, color: theme === t.id ? COLOR.ink : COLOR.text,
              borderColor: theme === t.id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setTheme(t.id); }}>
              <span className="ems-theme-dot" style={{ background: t.colors.gold }} />
              {t.name}{t.id === 'contrast' ? ' · доступность' : ''}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 11.5, color: dense ? COLOR.text : COLOR.muted, flex: 1 }}>Только цифры</span>
            <button className="ems-btn" style={{ padding: '2px 9px', fontSize: 10.5, background: dense ? COLOR.gold : COLOR.panelAlt, color: dense ? COLOR.ink : COLOR.muted, borderColor: dense ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tick'); setDense(!dense); }}>{dense ? 'вкл' : 'выкл'}</button>
          </div>
          <div style={{ fontSize: 10, color: COLOR.faint, lineHeight: 1.4, marginBottom: 10 }}>
            Скрывает графики, шкалы и декоративные слои — остаются только таблицы и текст.
          </div>
          <div className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft, marginBottom: 6 }}>Дашборды</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 7 }}>
            {dashboards.map((d) => (
              <div key={d.id} className="ems-row-hover"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 7px', borderRadius: 4,
                  background: activeDash === d.id ? COLOR.goldDim : 'transparent',
                  borderLeft: `2px solid ${activeDash === d.id ? COLOR.gold : 'transparent'}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, cursor: 'pointer', color: activeDash === d.id ? COLOR.text : COLOR.muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { Audio.play('tab'); applyDash(d.id); }}>{d.name}</span>
                <button className="ems-btn" title="Переименовать набор" aria-label={`Переименовать ${d.name}`}
                  style={{ padding: '1px 5px', fontSize: 9.5, lineHeight: 1.5, color: COLOR.faint }}
                  onClick={() => { Audio.play('tick'); renameDash(d.id); }}>✎</button>
                <button className="ems-btn" title={d.custom ? 'Удалить набор' : 'Убрать встроенный набор из списка'}
                  aria-label={`Убрать ${d.name}`}
                  style={{ padding: '1px 5px', fontSize: 9.5, lineHeight: 1.5, color: COLOR.faint }}
                  onClick={() => { Audio.play('tick'); deleteDash(d.id); }}>×</button>
              </div>
            ))}
            {dashboards.length === 0 && (
              <div style={{ fontSize: 10.5, color: COLOR.faint, padding: '4px 0' }}>Все наборы убраны — сохраните свой или сбросьте список.</div>
            )}
          </div>
          <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 10.5 }}
            onClick={() => { Audio.play('stamp'); saveDash(); }}>Сохранить текущий набор</button>
          {!presetsAreDefault(dashboards) && (
            <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 10.5, marginTop: 4, color: COLOR.rust, borderColor: COLOR.rust }}
              onClick={() => { Audio.play('click'); resetDash(); }}>Вернуть встроенные наборы</button>
          )}
          <div style={{ fontSize: 9.5, color: COLOR.faint, lineHeight: 1.4, marginTop: 6 }}>
            Свои наборы хранятся на этом устройстве и доступны во всех партиях, а не только в текущей.
            Встроенные наборы можно убрать из списка и переименовать — «Сбросить» вернёт их обратно.
          </div>
          {moveColumn && (
            <>
              <div className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft, margin: '12px 0 6px' }}>Макет столбцов</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 11.5, color: layoutEditMode ? COLOR.text : COLOR.muted, flex: 1 }}>Растягивание столбцов</span>
                <button className="ems-btn" aria-label="Переключить растягивание столбцов" style={{ padding: '2px 9px', fontSize: 10.5, background: layoutEditMode ? COLOR.gold : COLOR.panelAlt, color: layoutEditMode ? COLOR.ink : COLOR.muted, borderColor: layoutEditMode ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setLayoutEditMode(!layoutEditMode); }}>{layoutEditMode ? 'вкл' : 'выкл'}</button>
              </div>
              <div style={{ fontSize: 10, color: COLOR.faint, lineHeight: 1.4, marginBottom: 9 }}>
                Включите и потяните за границу между столбцами панели — ширина запомнится. Выключение прячет
                рамки для перетаскивания, но не сбрасывает уже подобранную ширину.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 7 }}>
                {columnOrder.map((id, i) => (
                  <div key={id} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 7px', borderRadius: 4 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: COLOR.muted }}>{COLUMN_LABELS[id]}</span>
                    <button className="ems-btn" title="Сдвинуть влево" aria-label={`Сдвинуть «${COLUMN_LABELS[id]}» влево`}
                      disabled={i === 0} style={{ padding: '1px 6px', fontSize: 10, lineHeight: 1.5, color: i === 0 ? COLOR.faint : COLOR.text }}
                      onClick={() => { Audio.play('tick'); moveColumn(id, -1); }}>◀</button>
                    <button className="ems-btn" title="Сдвинуть вправо" aria-label={`Сдвинуть «${COLUMN_LABELS[id]}» вправо`}
                      disabled={i === columnOrder.length - 1} style={{ padding: '1px 6px', fontSize: 10, lineHeight: 1.5, color: i === columnOrder.length - 1 ? COLOR.faint : COLOR.text }}
                      onClick={() => { Audio.play('tick'); moveColumn(id, 1); }}>▶</button>
                  </div>
                ))}
              </div>
              {!layoutIsDefaultNow && (
                <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 10.5, color: COLOR.rust, borderColor: COLOR.rust }}
                  onClick={() => { Audio.play('click'); resetLayout(); }}>Сбросить макет столбцов</button>
              )}
              <div style={{ fontSize: 9.5, color: COLOR.faint, lineHeight: 1.4, marginTop: 6 }}>
                Порядок и ширина столбцов — на широком экране (шире 1240px); на узком панель уже адаптивна.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
   СЕТЕВАЯ ИГРА: лобби (создать/войти) и экран партии, синхронизированный с сервером.
   Сервер (api/room.js) считает квартал, когда решения прислали оба места; здесь — только
   отображение состояния комнаты и отправка своих решений.
========================================================================================= */
const NETWORK_SEATS = ['central_bank', 'ministry_finance', 'president'];
const TRADER_SEATS = ['trader1', 'trader2'];
const seatsForMode = (mode) => (mode === 'trader' ? TRADER_SEATS : NETWORK_SEATS);
// оба трейдерских места делят одну и ту же роль из ROLES (id 'trader') — нумеруем
// их отдельно только в подписи, чтобы «Трейдер 1» и «Трейдер 2» не выглядели одним
// и тем же местом в UI
const seatRole = (seat) => {
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
const NETWORK_SESSION_KEY_LEGACY = 'ems-network-session'; // старый формат до введения слотов
const NETWORK_SLOT_COUNT = 3;
const loadNetworkSlots = () => {
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
const writeNetworkSlots = (slots) => {
  try { localStorage.setItem(NETWORK_SLOTS_KEY, JSON.stringify(slots)); }
  catch { /* приватный режим/квота — не критично, просто не восстановимся после обновления */ }
};
// сохраняем/обновляем сессию в слотах: та же комната+место обновляет свой слот,
// иначе — в первый свободный, а если все заняты — вытесняем самый старый (LRU)
const saveNetworkSlot = (net) => {
  const slots = loadNetworkSlots();
  const entry = { id: net.id, seat: net.seat, token: net.token, ownerToken: net.ownerToken || null, savedAt: Date.now() };
  let idx = slots.findIndex((s) => s && s.id === net.id && s.seat === net.seat);
  if (idx === -1) idx = slots.findIndex((s) => !s);
  if (idx === -1) {
    idx = 0;
    slots.forEach((s, i) => { if ((s ? s.savedAt : -Infinity) < (slots[idx] ? slots[idx].savedAt : -Infinity)) idx = i; });
  }
  slots[idx] = entry;
  writeNetworkSlots(slots);
};
const clearNetworkSlotAt = (idx) => { const slots = loadNetworkSlots(); slots[idx] = null; writeNetworkSlots(slots); };
const clearNetworkSlotFor = (id, seat) => writeNetworkSlots(loadNetworkSlots().map((s) => ((s && s.id === id && s.seat === seat) ? null : s)));

// портфель трейдера в сетевой «рыночной» комнате — целиком на клиенте: сделки
// одного трейдера никак не задевают другого (независимые позиции на одной и той
// же экономике), поэтому синхронизировать их через сервер незачем — только
// экономика (котировки/квартал) общая и приходит через room. Ключ на комнату+
// место, чтобы каждое место партии имело свой портфель и он пережил обновление
// страницы.
const netPortfolioKey = (id, seat) => `ems-net-portfolio:${id}:${seat}`;
const loadNetworkPortfolio = (id, seat) => {
  try {
    const raw = JSON.parse(localStorage.getItem(netPortfolioKey(id, seat)) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch { return null; }
};
const saveNetworkPortfolio = (id, seat, book) => {
  try { localStorage.setItem(netPortfolioKey(id, seat), JSON.stringify(book)); }
  catch { /* приватный режим/квота — не критично, портфель просто не переживёт обновление */ }
};

const roomCodeFromUrl = () => {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
};

function NetworkLobby({ onEnter }) {
  const linkedCode = useMemo(roomCodeFromUrl, []);
  const [tab, setTab] = useState(linkedCode ? 'join' : 'create');
  const [seat, setSeat] = useState('central_bank');
  const [name, setName] = useState('');
  const [code, setCode] = useState(linkedCode);
  const [difficulty, setDifficulty] = useState('medium');
  const [mode, setMode] = useState('policy');
  /* Те же две настройки, что и в одиночной игре: «классика» бросает характеры
     ведомств случайно и включает президента, «настраиваемая» открывает всё это
     руками. До этого сетевая комната всегда собиралась с одними и теми же
     ботами и вообще без президента. */
  const [setupMode, setSetupMode] = useState('classic');
  const [cbPersona, setCbPersona] = useState('random');
  const [mofPersona, setMofPersona] = useState('random');
  const [presEnabled, setPresEnabled] = useState(true);
  const [presPersona, setPresPersona] = useState('random');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [createdOwnerToken, setCreatedOwnerToken] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [slots, setSlots] = useState(loadNetworkSlots);
  const [slotBusy, setSlotBusy] = useState(null);
  const [roomPreview, setRoomPreview] = useState(null);
  // если сервер не подключён к Redis (нет KV_REST_API_URL/KV_REST_API_TOKEN),
  // комната живёт только в памяти одного serverless-вызова — партнёр или сам
  // игрок при следующем запросе почти наверняка получит «комната не найдена».
  // Ловим это здесь, чтобы не гадать по симптому, а сказать прямо.
  const [storageMode, setStorageMode] = useState(null);

  // подглядываем занятость мест ДО входа, чтобы не отправлять игрока на
  // «место уже занято» после того, как он уже заполнил форму. Опрашиваем
  // не один раз при вводе кода, а периодически, пока экран открыт: партнёр
  // мог занять место уже ПОСЛЕ того, как код был напечатан, — иначе кнопка
  // остаётся разблокированной до первой неудачной попытки входа
  React.useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setRoomPreview(null); return undefined; }
    let cancelled = false;
    const fetchPreview = async () => {
      try {
        const data = await fetchRoom(trimmed);
        if (!cancelled) { setRoomPreview(data.room); setStorageMode(data.storage || null); }
      } catch { if (!cancelled) setRoomPreview(null); }
    };
    const t = setTimeout(fetchPreview, 400);
    const iv = setInterval(fetchPreview, 3000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(iv); };
  }, [code]);
  React.useEffect(() => {
    if (!roomPreview) return;
    // переключаем выбранное место, если оно занято ИЛИ вообще не существует в
    // режиме этой комнаты (например, код привёл в «рыночную» комнату, а по
    // умолчанию выбран ЦБ — место из другого режима)
    const validSeats = previewSeats(roomPreview);
    const occ = roomPreview.occupied || {};
    if (!validSeats.includes(seat) || occ[seat]) {
      const free = validSeats.find((sx) => !occ[sx]) || validSeats[0];
      setSeat(free);
    }
  }, [roomPreview]);
  /* Место президента существует только там, где президент в комнате включён —
     иначе его незачем и показывать. */
  const previewSeats = (r) => seatsForMode(r ? r.mode : mode)
    // в «классике» президент включён — значит и место за него есть
    .filter((sx) => sx !== 'president' || !!(r ? r.president : (setupMode === 'classic' || presEnabled)));
  const bothSeatsTaken = !!(roomPreview && roomPreview.occupied
    && previewSeats(roomPreview).every((sx) => roomPreview.occupied[sx]));

  const enterSlot = async (idx) => {
    const slot = slots[idx];
    if (!slot) return;
    setSlotBusy(idx); setError('');
    try {
      const data = await fetchRoom(slot.id, undefined, slot.seat, slot.token);
      if (!data.room) throw new Error('Комната недоступна');
      onEnter({ id: slot.id, seat: slot.seat, token: slot.token, ownerToken: slot.ownerToken || null, room: data.room });
    } catch (e) {
      setError(e.message);
      clearNetworkSlotAt(idx); setSlots(loadNetworkSlots());
    } finally { setSlotBusy(null); }
  };
  const removeSlot = (idx) => {
    const slot = slots[idx];
    if (slot && !window.confirm('Забыть эту партию? Ваше место освободится — партнёру вместо вас будет играть бот.')) return;
    if (slot) leaveRoom(slot.id, slot.seat, slot.token).catch(() => {}); // освобождаем место партнёру, раз партия забыта насовсем
    clearNetworkSlotAt(idx); setSlots(loadNetworkSlots());
  };

  const shareLink = (id) => `${window.location.origin}${window.location.pathname}?room=${id}`;
  const copyLink = (id) => {
    try {
      navigator.clipboard.writeText(shareLink(id));
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800);
    } catch { /* буфер обмена недоступен — код всё равно виден рядом */ }
  };
  const doCreate = async () => {
    setBusy(true); setError('');
    try {
      const custom = setupMode === 'custom';
      const asId = (v) => (v === 'random' ? undefined : v);
      const r = await createRoom({ difficulty, mode,
        cbPersona: custom ? asId(cbPersona) : undefined,
        mofPersona: custom ? asId(mofPersona) : undefined,
        president: custom && !presEnabled ? null : { persona: custom ? asId(presPersona) : undefined } });
      setCreated(r.id); setCreatedOwnerToken(r.ownerToken || null); setCode(r.id); setTab('join'); setStorageMode(r.storage || null);
      setSeat(seatsForMode(mode)[0]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const doJoin = async () => {
    if (!code.trim()) { setError('Введите код комнаты.'); return; }
    setBusy(true); setError('');
    try {
      const r = await joinRoom(code.trim().toUpperCase(), seat, name.trim() || 'игрок');
      setStorageMode(r.storage || null);
      Audio.play('stamp'); Audio.prime();
      const trimmedCode = code.trim().toUpperCase();
      // ownerToken есть только у того, кто сам только что создал ЭТУ комнату в этой
      // же сессии лобби — у всех остальных, кто просто вошёл по коду/ссылке, его нет
      const ownerToken = trimmedCode === created ? createdOwnerToken : null;
      const net = { id: trimmedCode, seat, token: r.token, ownerToken, room: r.room };
      saveNetworkSlot(net);
      // убираем ?room= из адресной строки, чтобы обновление страницы не пыталось
      // «войти по ссылке» повторно поверх уже сохранённой сессии
      if (typeof window !== 'undefined' && window.history && window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      onEnter(net);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      {slots.some(Boolean) && (
        <div className="ems-panel" style={{ padding: 14, marginBottom: 16 }}>
          <div className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft, marginBottom: 9 }}>Ваши партии ({slots.filter(Boolean).length}/{NETWORK_SLOT_COUNT})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((slot, idx) => {
              const rd = slot && seatRole(slot.seat);
              const SlotIcon = rd && ROLE_ICON[rd.icon];
              return (
                <div key={idx} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12 }}>
                  {slot ? (
                    <>
                      {SlotIcon && <SlotIcon size={14} color={COLOR.muted} />}
                      <span style={{ flex: 1, color: COLOR.text }}>Комната <b className="ems-mono">{slot.id}</b> · {rd.short}</span>
                      <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 11 }} disabled={slotBusy === idx}
                        onClick={() => enterSlot(idx)}>{slotBusy === idx ? 'Входим…' : 'Войти'}</button>
                      <button onClick={() => removeSlot(idx)} aria-label="Забыть эту партию"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <span style={{ color: COLOR.faint }}>слот {idx + 1}: пусто</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {storageMode === 'memory' && (
        <div className="ems-panel" style={{ padding: 12, marginBottom: 16, borderColor: COLOR.rust }}>
          <div style={{ fontSize: 12, color: COLOR.rust, lineHeight: 1.5 }}>
            Сервер не подключён к общему хранилищу (Redis) — комната живёт только в памяти одного случайного запроса
            и может пропасть при следующем же обращении с ошибкой «комната не найдена». Это настройка развёртывания
            (нужны переменные окружения <b className="ems-mono">KV_REST_API_URL</b>/<b className="ems-mono">KV_REST_API_TOKEN</b> —
            подключаются через Upstash в Vercel Marketplace), а не баг в самой партии.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {[['create', 'Создать комнату'], ['join', 'Войти по коду']].map(([id, label]) => (
          <span key={id} className={`ems-tab ${tab === id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setTab(id); setError(''); }}>{label}</span>
        ))}
      </div>

      {tab === 'create' && (
        <div className="ems-panel" style={{ padding: 18 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 10 }}>Новая партия на двоих</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Режим партии</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['policy', 'Политика', 'ЦБ и Минфин делят экономику'], ['trader', 'Рынок', 'два трейдера на одной экономике']].map(([id, title]) => (
                <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: mode === id ? COLOR.gold : COLOR.panelAlt, color: mode === id ? COLOR.ink : COLOR.text,
                  borderColor: mode === id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setMode(id); }}>{title}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 14, lineHeight: 1.5 }}>
            {mode === 'trader'
              ? 'Оба игрока — частные инвесторы на одной и той же экономике: ставку ведёт бот-ЦБ, бюджет — бот-Минфин, а вы независимо друг от друга распределяете капитал между активами. Квартал наступает, когда готовы оба.'
              : 'Один из вас ведёт Центральный банк, второй — Минфин, на одной и той же экономике. Квартал наступает, когда решения пришлют оба; если партнёр ещё не подключился, его место временно ведёт бот.'}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Сложность партии</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICULTIES.map((d) => (
                <button key={d.id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: difficulty === d.id ? COLOR.gold : COLOR.panelAlt, color: difficulty === d.id ? COLOR.ink : COLOR.text,
                  borderColor: difficulty === d.id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setDifficulty(d.id); }}>{d.title}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Как настраивать партию</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['classic', 'Классика'], ['custom', 'Настраиваемая']].map(([id, title]) => (
                <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: setupMode === id ? COLOR.gold : COLOR.panelAlt, color: setupMode === id ? COLOR.ink : COLOR.text,
                  borderColor: setupMode === id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setSetupMode(id); }}>{title}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>
              {setupMode === 'classic'
                ? 'Характеры ведомств бросаются случайно, президент включён — как в одиночной классике.'
                : 'Выбрать характер каждого ведомства и президента — или обойтись без президента.'}
            </div>
          </div>

          {setupMode === 'custom' && (
            <div style={{ marginBottom: 14 }}>
              {[['Характер Центрального банка', CB_PERSONAS, cbPersona, setCbPersona,
                mode === 'trader' ? 'Ставку ведёт бот — от его характера зависит весь рынок.' : 'Действует, пока место ЦБ пустует или игрок не успел с решением.'],
              ['Характер Минфина', MOF_PERSONAS, mofPersona, setMofPersona,
                mode === 'trader' ? 'Бюджет тоже ведёт бот: его щедрость — ваш долговой рынок.' : 'Действует, пока место Минфина пустует или игрок не успел с решением.']]
                .map(([title, list, value, set, note]) => (
                  <div key={title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 6, lineHeight: 1.4 }}>{note}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[...list, { id: 'random', name: 'Случайный' }].map((pp) => (
                        <button key={pp.id} className="ems-btn" style={{ flex: '1 1 30%', padding: '7px 0', fontSize: 11.5,
                          background: value === pp.id ? COLOR.gold : COLOR.panelAlt, color: value === pp.id ? COLOR.ink : COLOR.text,
                          borderColor: value === pp.id ? COLOR.gold : COLOR.border }}
                          onClick={() => { Audio.play('click'); set(pp.id); }}>{pp.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>Президент</span>
                <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11,
                  background: presEnabled ? COLOR.gold : COLOR.panelAlt, color: presEnabled ? COLOR.ink : COLOR.muted,
                  borderColor: presEnabled ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setPresEnabled((v) => !v); }}>
                  {presEnabled ? 'включён' : 'выключен'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 6, lineHeight: 1.4 }}>
                Над обоими ведомствами стоит президент: он требует своего от каждого из вас, меняет руководителя
                ведомства, за которым никто не сидит, и тратит политический капитал на реформы и указы.
              </div>
              {presEnabled && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...PRESIDENT_PERSONAS, { id: 'random', name: 'Случайный' }].map((pp) => (
                    <button key={pp.id} className="ems-btn" style={{ flex: '1 1 30%', padding: '7px 0', fontSize: 11.5,
                      background: presPersona === pp.id ? COLOR.gold : COLOR.panelAlt, color: presPersona === pp.id ? COLOR.ink : COLOR.text,
                      borderColor: presPersona === pp.id ? COLOR.gold : COLOR.border }}
                      onClick={() => { Audio.play('click'); setPresPersona(pp.id); }}>{pp.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="ems-btn primary" disabled={busy} style={{ width: '100%', padding: '11px 0' }} onClick={doCreate}>
            {busy ? 'Создаём…' : 'Создать комнату'}
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div className="ems-panel" style={{ padding: 18 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 10 }}>Войти в комнату</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Код комнаты</div>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="например, DA9X6"
              className="ems-mono" style={{ width: '100%', padding: '9px 11px', fontSize: 14, letterSpacing: '0.08em',
                background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
            {created && created === code.trim().toUpperCase() && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: COLOR.teal }}>
                <div>Комната ваша — отправьте партнёру код выше или ссылку ниже, по ней комната откроется автоматически.</div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 6 }}>
                  <input readOnly value={shareLink(created)} className="ems-mono" onClick={(e) => e.target.select()}
                    style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 11, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.muted }} />
                  <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => copyLink(created)}>
                    {linkCopied ? <Check size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> : <Copy size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                    {linkCopied ? 'Скопировано' : 'Копировать ссылку'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Ваше имя</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="как вас видит партнёр"
              style={{ width: '100%', padding: '9px 11px', fontSize: 13,
                background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Ваша роль</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {previewSeats(roomPreview).map((sx) => {
                const rd = seatRole(sx); const RoleIcon = ROLE_ICON[rd.icon];
                const taken = !!(roomPreview && roomPreview.occupied && roomPreview.occupied[sx]);
                return (
                  <button key={sx} className="ems-btn" disabled={taken}
                    style={{ flex: 1, padding: '10px 6px', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      background: seat === sx ? COLOR.gold : COLOR.panelAlt, color: seat === sx ? COLOR.ink : COLOR.text,
                      borderColor: seat === sx ? COLOR.gold : COLOR.border, opacity: taken ? 0.4 : 1, cursor: taken ? 'not-allowed' : 'pointer' }}
                    onClick={() => { if (taken) return; Audio.play('click'); setSeat(sx); }}>
                    <RoleIcon size={15} />{rd.short}
                    {taken && <span style={{ fontSize: 9, letterSpacing: '0.03em' }}>занято</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="ems-btn primary" disabled={busy || bothSeatsTaken} style={{ width: '100%', padding: '11px 0' }} onClick={doJoin}>
            {busy ? 'Входим…' : bothSeatsTaken ? 'Оба места заняты' : 'Войти в партию'}
          </button>
        </div>
      )}
      {error && <div style={{ marginTop: 10, fontSize: 12.5, color: COLOR.rust }}>{error}</div>}
    </div>
  );
}

function NetworkEntryScreen({ onEnter, onBack }) {
  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 640, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="ems-hero-eyebrow">Мультиплеер</div>
          <div className="ems-hero-title small">Партия на двоих</div>
          <div className="ems-hero-rule" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NetworkLobby onEnter={onEnter} />
        </div>
      </div>
    </div>
  );
}

const QUARTER_TIMEOUT_MS = 5 * 60 * 1000; // держим в синхроне с QUARTER_TIMEOUT_MS в api/room.js

function NetworkGameScreen({ network, theme, setTheme, onExit }) {
  const { id, seat, token, ownerToken } = network;
  const isOwner = !!ownerToken;
  const [kickBusy, setKickBusy] = useState(null);
  const [room, setRoom] = useState(network.room);
  const [decisions, setDecisions] = useState(() => defaultDecisions(network.room.economy));
  const [portfolio, setPortfolio] = useState(() => loadNetworkPortfolio(id, seat) || emptyBook());
  React.useEffect(() => { saveNetworkPortfolio(id, seat, portfolio); }, [id, seat, portfolio]);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();
  const [showAch, setShowAch] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [defeat, setDefeat] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const onTrade = (instrId, amt, side, liveQuotes) => setPortfolio((b) => {
    const nb = tradeBook(b, instrId, amt, side, room.economy, liveQuotes);
    const instr = INSTR_BY_ID[instrId];
    return { ...nb, trades: [...(b.trades || []), { q: room.quarterIndex, id: instrId, side, amt, price: priceOf(instr, room.economy, liveQuotes) }].slice(-120) };
  });
  const onCasino = (net) => {
    const casinoNet = (portfolio.casinoNet || 0) + net;
    setPortfolio((b) => ({ ...b, cash: Math.max(0, b.cash + net), realized: (b.realized || 0) + net, casinoNet: (b.casinoNet || 0) + net }));
    pushAch(unlockAchievements(casinoAchievementIds({ net, casinoNet })));
  };
  const [marketTab, setMarketTab] = useState('market');
  // та же временная подмена плейлиста, что и в соло-игре — см. комментарий там.
  // room.mode напрямую, а не isTraderRoom: та объявляется ниже по компоненту
  React.useEffect(() => {
    if (room.mode !== 'trader' || marketTab !== 'casino') return undefined;
    const prevLocked = Audio.nowPlaying().locked;
    Audio.setPlaylist('casino');
    return () => { Audio.setPlaylist(prevLocked); };
  }, [room.mode, marketTab]);
  // соперник должен видеть стоимость портфеля не только в момент «готов», а
  // вскоре после каждой сделки — иначе до конца квартала список эталонов
  // выглядит так, будто ничего не пишется, хотя сделка уже прошла
  React.useEffect(() => {
    if (room.mode !== 'trader') return undefined;
    const value = bookValue(portfolio, room.economy, null);
    const t = setTimeout(() => {
      reportPortfolioValue(id, seat, token, value).then((r) => setRoom(r.room)).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [portfolio, room.mode]);
  const [chatText, setChatText] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  React.useEffect(() => { const iv = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(iv); }, []);
  /* Таймер квартала отсчитывается от серверного времени, а часы на устройствах
     расходятся на минуты: у двух игроков на экране были разные цифры, а иногда и
     давно истёкший срок. Держим поправку «сервер минус мы» и считаем по ней. */
  const [skew, setSkew] = useState(0);
  React.useEffect(() => {
    if (Number.isFinite(room.now)) setSkew(room.now - Date.now());
  }, [room.now]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = React.useRef(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const [showPaper, setShowPaper] = useState(false);
  const [mobileCol, setMobileCol] = useState('center');
  const [narrow, setNarrow] = useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const prevQuarter = React.useRef(room.quarterIndex);

  React.useEffect(() => watchRoom(id, (r) => {
    setRoom(r);
    if (r.quarterIndex !== prevQuarter.current) {
      prevQuarter.current = r.quarterIndex;
      setSent(false);
      setDecisions((d) => defaultDecisions(r.economy, d));
      Audio.quarterSequence({ wellbeingDelta: 0, newCrisis: false, bigNews: r.news.some((n) => n.priority >= 8) });
      markNetworkPlayed();
      pushAch(unlockAchievements(questProgressAchievementIds({
        quarterIndex: r.quarterIndex, economy: r.economy, history: r.history,
        rolesPlayed: recordRolePlayed(seat), networkPlayed: true, role: seatRole(seat).id,
      })));
      const roleForDefeat = seatRole(seat).id;
      // расчёт по портфелю (переоценка, экспирация опционов, маржин-колл) —
      // тем же способом, что и в соло-игре трейдера, только экономику берём
      // из ответа сервера, а не считаем сами
      if (r.mode === 'trader') {
        setPortfolio((b) => {
          const withBench = b.benchStart ? b : { ...b, benchStart: { stockIndex: r.economy.stockIndex, bondIndex: r.economy.bondIndex,
            depositIndex: r.economy.depositIndex, priceLevel: r.economy.priceLevel } };
          const nb = settleQuarter(withBench, r.economy);
          const marginCalled = (nb.lastEvents || []).some((ev) => ev.kind === 'call');
          if (marginCalled) { Audio.play('alarm'); haptic([60, 80, 60]); pushAch(unlockAchievements(['margin_call'])); }
          const nextDefeat = checkDefeat({ role: roleForDefeat, economy: r.economy, history: r.history, bookVal: bookValue(nb, r.economy, null) });
          if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
          return nb;
        });
      } else {
        const nextDefeat = checkDefeat({ role: roleForDefeat, economy: r.economy, history: r.history, bookVal: null });
        if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
      }
    }
    Audio.setMood(r.economy);
  }, (e) => failWithError(e), 2500, seat, token), [id, seat, token]);
  // новый квартал — новый ход президента: прошлые указы уже оплачены и применены
  React.useEffect(() => {
    setPresActions([]); setPresAppointCb(null); setPresAppointMof(null);
    setPresDirective(null); setPresDirStrength(1);
  }, [room.quarterIndex]);

  const isTraderRoom = room.mode === 'trader';
  const roleDef = seatRole(seat);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  /* Мест теперь может быть три: ЦБ, Минфин и президент. «Партнёр» по-прежнему один —
     второе ведомство (для президента это ЦБ, чьи цифры и показываем рядом), но ждём
     квартала мы от всех занятых мест, а не от одного. */
  const roomSeats = seatsForMode(room.mode).filter((sx) => sx !== 'president' || !!room.president);
  const isPresidentSeat = seat === 'president';
  const DEPT_PAIR = { central_bank: 'ministry_finance', ministry_finance: 'central_bank' };
  const otherSeat = isTraderRoom ? (roomSeats[0] === seat ? roomSeats[1] : roomSeats[0])
    : (DEPT_PAIR[seat] || 'central_bank');
  const otherSeats = roomSeats.filter((sx) => sx !== seat);
  const otherRole = seatRole(otherSeat);
  const OtherRoleIcon = ROLE_ICON[otherRole.icon];
  const levers = LEVERS.filter((l) => roleDef.groups.includes(l.group)).filter((l) => !l.onlyIf || l.onlyIf(decisions));
  const economy = room.economy;
  const prevEcon = room.history.length >= 2 ? room.history[room.history.length - 2] : economy;
  const setLever = (id2, v) => setDecisions((d) => ({ ...d, [id2]: v }));
  const shareKey = (lid) => (lid === 'shareHealth' ? 'health' : lid === 'shareEducation' ? 'education' : lid === 'shareScience' ? 'science' : lid === 'shareDefense' ? 'defense' : 'admin');
  const leverDisplay = (l) => (l.subgroup === 'budget' ? economy.budgetShares[shareKey(l.id)] : economy[l.id]);
  const { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries } = useChartView();
  const [activeTab, setActiveTab] = useState('economy');
  // ход живого президента: указы и реформы, кадры, одно указание и его сила
  const [presActions, setPresActions] = useState([]);
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  const [dense, setDense] = useState(false);
  const [dashboards, setDashboards] = useState(() => initDashboards());
  const dashActions = useMemo(() => makeDashboardActions(setDashboards), []);
  const { pinned, setPinned, activeDash, setActiveDash } = usePinnedStrip(null, null, dashActions);
  const layout = useLayoutColumns();
  const togglePin = (key) => setPinned((ps) => (ps.includes(key) ? ps.filter((x) => x !== key) : (ps.length >= MAX_PINS ? ps : [...ps, key])));
  const movePin = (key, dir) => setPinned((ps) => {
    const i = ps.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= ps.length) return ps;
    const next = [...ps]; next[i] = ps[j]; next[j] = ps[i]; return next;
  });
  const [dragPin, setDragPin] = useState(null);
  const reorderPin = (from, to) => setPinned((ps) => {
    if (from === to) return ps;
    const fromIdx = ps.indexOf(from); const toIdx = ps.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return ps;
    const next = [...ps]; next.splice(fromIdx, 1); next.splice(toIdx, 0, from); return next;
  });
  const applyDash = (did) => { const d = dashboards.find((x) => x.id === did); if (d) { setPinned(d.pins); setActiveDash(did); } };
  const saveDash = () => dashActions.saveDash(pinned, setActiveDash);
  const { deleteDash, renameDash, resetDash } = dashActions;
  const kpiDelta = (key) => economy[key] - prevEcon[key];
  const goalDef = GOALS.find((g) => g.id === room.goals[seat]);

  // держим слот в актуальном состоянии (перекладывает savedAt наверх LRU) и на
  // случай, если сюда попали в обход NetworkLobby (например, через ?room=)
  React.useEffect(() => { saveNetworkSlot({ id, seat, token }); }, [id, seat, token]);
  const failWithError = (e) => {
    setError(e.message);
    // токен отозван или комната истекла — восстанавливать в ней больше нечего
    if (/неверный токен|не найдена/i.test(e.message || '')) clearNetworkSlotFor(id, seat);
  };
  const send = async () => {
    setBusy(true); setError('');
    try {
      // стоимость портфеля сообщаем только в «рыночной» комнате — сервер не
      // знает позиций трейдера (они клиентские), только текущую сумму, чтобы
      // соперник видел её в своём списке эталонов (см. PortfolioSummary);
      // основной канал — report_portfolio после каждой сделки (см. выше), это
      // просто подстраховка на случай, если тот эффект ещё не успел отправиться
      const portfolioValue = isTraderRoom ? bookValue(portfolio, room.economy, null) : undefined;
      // президент шлёт не рычаги, а решения: сервер разберёт их тем же кодом, что и
      // ход бота-президента в одиночной игре
      const president = isPresidentSeat
        ? { actions: presActions, appointCb: presAppointCb, appointMof: presAppointMof,
          directive: presDirective, directiveStrength: presDirStrength }
        : undefined;
      const r = await submitDecisions(id, seat, token, decisions, null, portfolioValue, president);
      setRoom(r.room); setSent(true); Audio.play('stamp');
    } catch (e) { failWithError(e); } finally { setBusy(false); }
  };
  const retract = async () => {
    setBusy(true); setError('');
    try { const r = await cancelSubmission(id, seat, token); setRoom(r.room); setSent(false); Audio.play('click'); }
    catch (e) { failWithError(e); } finally { setBusy(false); }
  };
  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatBusy(true); setError('');
    try { const r = await sendChatMessage(id, seat, token, text); setRoom(r.room); setChatText(''); Audio.play('click'); }
    catch (e) { failWithError(e); } finally { setChatBusy(false); }
  };
  React.useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [room.chat?.length]);

  const pendingSeats = otherSeats.filter((sx) => room.occupied[sx] && !room.ready[sx]);
  const waitingForOther = sent && pendingSeats.length > 0;
  // сколько времени осталось до того, как сервер решит за отсутствующего игрока
  // ботом (см. QUARTER_TIMEOUT_MS/maybeForceResolve в api/room.js) — держим в поле
  // зрения, чтобы «квартал стоит» не выглядело так, будто ничего не произойдёт
  const timeLeftMs = room.quarterStartedAt
    ? Math.max(0, room.quarterStartedAt + QUARTER_TIMEOUT_MS - (nowTick + skew)) : null;
  const timeLeftLabel = timeLeftMs === null ? null
    : `${Math.floor(timeLeftMs / 60000)}:${String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')}`;
  /* Таймер отсчитывает не «время на ход», а срок, после которого сервер решит за
     МОЛЧАЩЕГО ПАРТНЁРА ботом. Пока второе место пустует, подгонять некого: квартал
     считается ровно в тот момент, когда я нажму «готов», — и часы над пустой
     комнатой только создавали ощущение, что кто-то торопит. Своего собственного
     «ещё не отправил» таймер тоже не касается. */
  const quarterPending = pendingSeats.length > 0;
  /* Президент комнаты приходит с сервера «плоским» (в хранилище нельзя класть
     объекты просьб с функциями) — собираем из него то, что ждёт панель. Чьё
     требование «ко мне», зависит от места, за которым сижу я. */
  const myBranch = seat === 'central_bank' ? 'monetary' : seat === 'ministry_finance' ? 'fiscal' : null;
  const presState = room.president || null;
  const presPlan = presState && presState.plan ? {
    ...presState.plan,
    persona: { name: presState.plan.personaName, title: presState.plan.personaTitle },
    directive: presState.plan.directive
      ? { ...presState.plan.directive, toPlayer: presState.plan.directive.branch === myBranch } : null,
  } : null;
  const presLast = presState && presState.last
    ? { ...presState.last, toPlayer: presState.last.branch === myBranch } : null;
  // требование живого президента: оно выдвинуто в прошлом квартале и исполняется
  // в этом — у ведомства есть на него ход, а не «претензия задним числом»
  const presDemand = presState && presState.human ? presState.demand : null;
  const otherAction = room.lastActions ? room.lastActions[otherSeat] : null;
  const disconnectedSeat = otherSeats.find((sx) => room.occupied[sx] && room.connected && !room.connected[sx]) || null;
  const otherDisconnected = !!disconnectedSeat;
  const myLastAction = room.lastActions ? room.lastActions[seat] : null;
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false);
  React.useEffect(() => { setWelcomeBackDismissed(false); }, [room.quarterIndex]);
  // выход в меню — это не уход из комнаты: место и сохранённая сессия остаются,
  // партия появится в лобби («Ваши партии») и в неё можно вернуться позже;
  // насовсем комнату покидают через «Забыть эту партию» в лобби
  const exit = () => onExit();
  const [difficultyBusy, setDifficultyBusy] = useState(false);
  const changeDifficulty = async (next) => {
    if (next === room.difficulty) return;
    setDifficultyBusy(true); setError('');
    try { const r = await setRoomDifficulty(id, seat, token, next); setRoom(r.room); }
    catch (e) { failWithError(e); } finally { setDifficultyBusy(false); }
  };
  const kickSeat = async (targetSeat) => {
    if (!window.confirm(`Убрать ${seatRole(targetSeat).short} из комнаты? Место освободится, партнёр сможет войти заново.`)) return;
    setKickBusy(targetSeat); setError('');
    try { const r = await kickFromRoom(id, ownerToken, targetSeat); setRoom(r.room); Audio.play('click'); }
    catch (e) { setError(e.message); } finally { setKickBusy(null); }
  };
  // владелец кикнул вас самого (или ваше место освободили как-то иначе, пока вы
  // были в комнате) — своё же место внезапно снова «пустое» означает именно это
  const [kickedOut, setKickedOut] = useState(false);
  React.useEffect(() => { if (!room.occupied[seat]) setKickedOut(true); }, [room.occupied, seat]);

  if (kickedOut) {
    return (
      <div className="ems-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <GlobalStyle />
        <div className="ems-panel" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <AlertTriangle size={28} color={COLOR.rust} style={{ marginBottom: 10 }} />
          <div className="ems-serif" style={{ fontSize: 16, color: COLOR.rust, marginBottom: 8 }}>Вас убрали из комнаты</div>
          <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 18, lineHeight: 1.5 }}>
            Владелец лобби освободил ваше место. Вернуться в эту партию так же нельзя — при желании войдите заново по коду.
          </div>
          <button className="ems-btn primary" style={{ padding: '10px 20px' }}
            onClick={() => { clearNetworkSlotFor(id, seat); onExit(); }}>В меню</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ems-root">
      <GlobalStyle />
      <Atmosphere regime={economy.regime}
        intensity={clamp((economy.inflationRisk * 0.25 + economy.bankingRisk * 0.3 + economy.debtRisk * 0.2 + economy.recessionRisk * 0.25) / 100, 0, 1)} />
      {showWhy && room.reasons && <WhyModal reasons={room.reasons} onClose={() => setShowWhy(false)} />}
      {showPaper && <NewspaperModal news={room.news} history={room.history} quarterIndex={room.quarterIndex} economy={room.economy} onClose={() => setShowPaper(false)} />}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} leaving={achLeaving} />
      {defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={room.quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={exit} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }} restartLabel="В меню" />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: seatRole(seat).id, quarterIndex: room.quarterIndex, economy: room.economy,
        startEconomy: room.history && room.history[0], portfolio, defeat,
      })} />}

      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, background: COLOR.panel,
        padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ems-card-icon" style={{ width: 40, height: 40 }}>
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            <div className="ems-serif" style={{ fontSize: 18 }}>Сетевая партия · комната {room.id}</div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              вы — {roleDef.title} · партнёр — {room.occupied[otherSeat] ? (room.names[otherSeat] || 'игрок') : (isTraderRoom ? 'место свободно' : 'бот')} за {otherRole.short}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: COLOR.muted }}>Текущий период</div>
            <div className="ems-mono ems-serif" style={{ fontSize: 15, fontWeight: 600 }}>{room.quarterLabel}</div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: COLOR.muted, marginBottom: 2 }}>Благополучие</div>
            <Gauge value={economy.wellbeing} size={68} />
          </div>
          <div style={{ position: 'relative' }}>
            <select value={room.difficulty} disabled={difficultyBusy} onChange={(e) => changeDifficulty(e.target.value)}
              title="Сложность партии" className="ems-btn"
              style={{ padding: '7px 26px 7px 9px', fontSize: 11.5, appearance: 'none', WebkitAppearance: 'none', cursor: difficultyBusy ? 'wait' : 'pointer' }}>
              {DIFFICULTIES.map((d) => (<option key={d.id} value={d.id}>{d.title}</option>))}
            </select>
            <ChevronDown size={12} color={COLOR.muted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <ViewSettings theme={theme} setTheme={setTheme} dense={dense} setDense={setDense}
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash}
            deleteDash={deleteDash} renameDash={renameDash} resetDash={resetDash}
            layoutEditMode={layout.layoutEditMode} setLayoutEditMode={layout.setLayoutEditMode}
            columnOrder={layout.columnOrder} moveColumn={layout.moveColumn}
            resetLayout={layout.resetLayout} layoutIsDefaultNow={layout.layoutIsDefaultNow} />
          <AudioControls />
          <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowCard(true); }} title="Карточка результата">
            <Share2 size={14} color={COLOR.gold} />
          </button>
          <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowAch(true); }} title="Коллекция достижений">
            <Trophy size={14} color={COLOR.gold} />
          </button>
          <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { Audio.play('paper'); setShowPaper(true); }} title="Экономический вестник">
            <Newspaper size={14} />Газета
          </button>
          <button className="ems-btn" style={{ padding: '7px 9px' }} title="Выйти в меню" onClick={() => { Audio.play('click'); exit(); }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <CrisisBar economy={economy} botAction={otherAction} />

      <div style={{ padding: '14px 18px 4px' }}>
        <div className="ems-kpi-strip">
          {pinned.map((key) => {
            const m = ALL_METRICS[key];
            if (!m) return null;
            const val = economy[key];
            return (
              <div key={key} draggable
                onDragStart={(e) => { setDragPin(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from) reorderPin(from, key); setDragPin(null); }}
                onDragEnd={() => setDragPin(null)}
                style={{ position: 'relative', opacity: dragPin === key ? 0.4 : 1, cursor: 'grab' }}>
                <KpiTile label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'} delta={kpiDelta(key)} invert={m.invert} series={room.history.slice(-8).map((h) => h[key]).filter(Number.isFinite)} />
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <button onClick={() => { Audio.play('tick'); movePin(key, -1); }} aria-label="Левее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>◀</button>
                  <button onClick={() => { Audio.play('tick'); movePin(key, 1); }} aria-label="Правее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>▶</button>
                  <button onClick={() => { Audio.play('tick'); togglePin(key); }} aria-label={`Убрать ${m.label} с полосы`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          {pinned.length < MAX_PINS && (
            <div className="ems-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed' }}>
              <span style={{ fontSize: 10.5, color: COLOR.faint, textAlign: 'center', lineHeight: 1.4 }}>
                <Star size={12} style={{ verticalAlign: -2 }} /> закрепите любой показатель<br />звёздочкой в таблице справа
              </span>
            </div>
          )}
        </div>
        <div className="ems-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10, padding: '9px 13px' }}>
          <RiskBadge label="Инфляционный" value={economy.inflationRisk} />
          <RiskBadge label="Банковский" value={economy.bankingRisk} />
          <RiskBadge label="Долговой" value={economy.debtRisk} />
          <RiskBadge label="Рецессии" value={economy.recessionRisk} />
          <RiskBadge label="Валютный" value={economy.currencyRisk} />
        </div>
      </div>

      <div style={{ margin: '10px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {myLastAction && myLastAction.timedOut && !welcomeBackDismissed && (
          <div className="ems-fade-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: COLOR.goldDim, border: `1px solid ${COLOR.gold}`, borderRadius: 3, padding: '9px 12px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.gold} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}><b style={{ color: COLOR.gold }}>С возвращением.</b> <span style={{ color: COLOR.muted }}>
              Пока вас не было, прошлый квартал за вас решал бот — вы не отправили решение вовремя. Место осталось вашим, продолжайте с этого квартала.</span></div>
            <button onClick={() => setWelcomeBackDismissed(true)} aria-label="Закрыть"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0, flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>
        )}
        {otherDisconnected && (
          <div className="ems-fade-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '9px 12px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><b style={{ color: COLOR.rust }}>{(disconnectedSeat && room.names[disconnectedSeat]) || 'Партнёр'} не на связи.</b> <span style={{ color: COLOR.muted }}>
              Больше 12 секунд нет ответа от его вкладки — возможно, партнёр закрыл игру. {isTraderRoom
                ? 'Если решение не придёт в течение 5 минут с начала квартала, квартал наступит без него — место останется за партнёром.'
                : 'Если решение не придёт в течение 5 минут с начала квартала, за это ведомство один раз решит бот, а место останется за партнёром.'}</span></div>
          </div>
        )}
        <RegimeBanner economy={economy} />
      </div>

      {narrow && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0' }}>
          {[['left', isTraderRoom ? 'Капитал' : 'Решения'], ['center', isTraderRoom ? 'Рынок и новости' : 'Новости и графики'], ['right', 'Показатели']].map(([id, label]) => (
            <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 11.5,
              background: mobileCol === id ? COLOR.gold : COLOR.panelAlt, color: mobileCol === id ? COLOR.ink : COLOR.text,
              borderColor: mobileCol === id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setMobileCol(id); }}>{label}</button>
          ))}
        </div>
      )}

      {(() => {
      const leftNode = (
        <div className={narrow && mobileCol !== 'left' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isTraderRoom ? (
            <PortfolioSummary book={portfolio} economy={economy} live={null} goal="max_wealth"
              prevValue={portfolio.history && portfolio.history.length > 1 ? portfolio.history[portfolio.history.length - 2] : null}
              opponent={{ label: room.names[otherSeat] || otherRole.short, value: (room.portfolioValues || {})[otherSeat] }} />
          ) : isPresidentSeat ? (
            <>
              {/* у президента нет ни одного рычага: его ход — кадры, указания,
                  реформы и публичная политика, ровно как в одиночной игре */}
              <PresidentPanel economy={economy} cooldowns={room.presCooldowns || {}}
                selected={presActions} setSelected={setPresActions}
                cbPersonaId={(room.personas || {}).central_bank || 'pragmatic'}
                mofPersonaId={(room.personas || {}).ministry_finance || 'technocrat'}
                appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                directive={presDirective} setDirective={setPresDirective}
                lastDirective={presState && presState.last && presState.last.status
                  ? { status: presState.last.status, text: `Указание «${presState.last.label}».` } : null}
                directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              {presState && presState.demand && (
                <div className="ems-panel" style={{ padding: 12, borderColor: COLOR.gold }}>
                  <div style={{ fontSize: 10, color: COLOR.faint, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                    Требование в силе
                  </div>
                  <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.45 }}>
                    {presState.demand.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: «{presState.demand.ask}»
                  </div>
                  <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4, lineHeight: 1.4 }}>
                    Ведомство отвечает решениями этого квартала — итог будет в новостях, когда квартал закроется.
                    Новое указание встанет в силу со следующего.
                  </div>
                </div>
              )}
              <div className="ems-panel" style={{ padding: 13 }}>
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.blue, marginBottom: 8 }}>Ведомства</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[['Ключевая ставка', pctFmt(economy.keyRate)],
                    ['Баланс бюджета', fmtSignedPct(economy.budgetBalancePctGdp)],
                    ['Долг', pctFmt(economy.debtToGdp)],
                    ['За ЦБ', room.occupied.central_bank ? (room.names.central_bank || 'игрок') : 'бот'],
                    ['За Минфин', room.occupied.ministry_finance ? (room.names.ministry_finance || 'игрок') : 'бот']].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                        <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="ems-panel" style={{ padding: 14 }}>
                <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <RoleIcon size={14} />Ваши полномочия
                </div>
                {['monetary', 'fiscal'].filter((g) => roleDef.groups.includes(g)).map((g) => (
                  <React.Fragment key={g}>
                    {['core', 'macropru', 'taxes', 'budget'].map((sub) => {
                      const set = levers.filter((l) => l.group === g && l.subgroup === sub);
                      if (!set.length) return null;
                      return set.map((l) => (
                        <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={leverDisplay(l)} value={decisions[l.id]}
                          onChange={(v) => setLever(l.id, v)} preview={leverPreview(l.id, decisions[l.id], economy, room.difficulty)} />
                      ));
                    })}
                    {g === 'monetary' && <Segmented label="Режим валютного курса" options={FX_REGIMES} value={decisions.fxRegime} onChange={(v) => setLever('fxRegime', v)} />}
                  </React.Fragment>
                ))}
              </div>

              {/* без этой панели игрок видел только собственные рычаги — о том, что
                  сейчас установлено у партнёра (ставка ЦБ, налоги/бюджет Минфина),
                  приходилось либо спрашивать в чате, либо искать по всем вкладкам
                  «Показателей экономики»; ниже — сводка его последних решённых
                  значений, как в соло-игре у бота-оппонента */}
              <div className="ems-panel" style={{ padding: 13 }}>
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.blue, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <OtherRoleIcon size={13} />{otherRole.title}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{room.occupied[otherSeat] ? (room.names[otherSeat] || 'игрок') : 'бот'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(otherSeat === 'central_bank' ? [
                    ['Ключевая ставка', pctFmt(economy.keyRate)],
                    ['Норма резервирования', pctFmt(economy.reserveReq)],
                    ['Режим курса', (FX_REGIMES.find((r) => r.id === economy.fxRegime) || {}).label || economy.fxRegime],
                  ] : [
                    ['Баланс бюджета', fmtSignedPct(economy.budgetBalancePctGdp)],
                    ['Долг', pctFmt(economy.debtToGdp)],
                    ['НДС', pctFmt(economy.vatRate)],
                    ['Налог на прибыль', pctFmt(economy.profitTaxRate)],
                  ]).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
                    </div>
                  ))}
                </div>
                {otherAction && otherAction.note && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLOR.faint, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7, lineHeight: 1.4 }}>{otherAction.note}</div>
                )}
              </div>
            </>
          )}

          {presPlan && !isPresidentSeat && <PresidentWatchPanel economy={economy} plan={presPlan} last={presLast} branch={myBranch} />}
          {presDemand && !isPresidentSeat && (
            <div className="ems-panel" style={{ padding: 13, borderColor: presDemand.branch === myBranch ? COLOR.rust : COLOR.borderStrong }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <Crown size={14} color={COLOR.gold} />
                <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>Президент</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{room.names.president || 'игрок'}</span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, paddingLeft: 9, color: COLOR.text,
                borderLeft: `2px solid ${presDemand.branch === myBranch ? COLOR.rust : COLOR.blue}` }}>
                <span style={{ color: presDemand.branch === myBranch ? COLOR.rust : COLOR.blue, fontWeight: 600 }}>
                  {presDemand.branch === myBranch ? 'Требование к вам: ' : `Указание ${presDemand.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: `}
                </span>
                {presDemand.ask}
                {presDemand.branch === myBranch && (
                  <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4 }}>
                    Выполнить — значит сдвинуть свои рычаги в эту сторону в этом квартале. Отказать можно, но администрация ведёт счёт.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="ems-panel" style={{ padding: 13 }}>
            <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 7 }}>Чат с партнёром</div>
            <div className="ems-scroll" style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
              {(!room.chat || room.chat.length === 0) && (
                <div style={{ fontSize: 11.5, color: COLOR.faint }}>Пока тишина — напишите первым.</div>
              )}
              {(room.chat || []).map((m, i) => {
                const mine = m.seat === seat;
                const nm = mine ? 'вы' : (room.names[m.seat] || seatRole(m.seat).short);
                // подряд отправленные сообщения одного собеседника сливаются в одну
                // группу: заголовок с именем и увеличенный отступ — только перед новым
                // отправителем, а не перед каждым сообщением
                const grouped = i > 0 && room.chat[i - 1].seat === m.seat;
                const time = m.at ? new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', textAlign: mine ? 'right' : 'left', marginTop: i === 0 ? 0 : grouped ? 2 : 10 }}>
                    {!grouped && <div style={{ fontSize: 9.5, color: mine ? COLOR.gold : COLOR.blue, marginBottom: 2 }}>{nm}</div>}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                      <div style={{ fontSize: 12, color: COLOR.text, background: COLOR.panelAlt, padding: '6px 10px', borderRadius: 3, display: 'inline-block', wordBreak: 'break-word' }}>{m.text}</div>
                      {time && <span className="ems-mono" style={{ fontSize: 9, color: COLOR.faint, flexShrink: 0 }}>{time}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={chatText} onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="написать партнёру…"
                style={{ flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 12, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
              <button className="ems-btn" disabled={chatBusy || !chatText.trim()} onClick={sendChat} style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
                {chatBusy ? '…' : 'Отпр.'}
              </button>
            </div>
            {otherAction && otherAction.quote && (
              <div style={{ marginTop: 8, fontSize: 11.5, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 8, color: COLOR.muted }}>
                <span style={{ color: COLOR.faint }}>{otherRole.short} (бот): </span>«{otherAction.quote}»
              </div>
            )}
          </div>
        </div>
      );
      const centerNode = (
        <div className={narrow && mobileCol !== 'center' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {isTraderRoom && (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['market', 'Рынок', TrendingUp], ['casino', 'Казино', Dices]].map(([tid, label, Icon]) => (
                  <span key={tid} className={`ems-tab ${marketTab === tid ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => { Audio.play('tab'); setMarketTab(tid); }}><Icon size={13} />{label}</span>
                ))}
              </div>
              {marketTab === 'market'
                ? <TradingTerminal economy={economy} prev={prevEcon} history={room.history} book={portfolio} onTrade={onTrade} />
                : <CasinoScreen book={portfolio} onCasino={onCasino} />}
            </>
          )}
          <NewsTerminal items={room.news} onOpenPaper={() => setShowPaper(true)} />
          <Suspense fallback={<ChartFallback />}>
            <ChartPanel history={room.history} chartGroup={chartGroup} setChartGroup={setChartGroup}
              hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
          </Suspense>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Квартальный отчёт</span>
              {room.report && room.reasons && (
                <button className="ems-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setShowWhy(true)}>
                  <Info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Почему это произошло?
                </button>
              )}
            </div>
            {/* официальный бюллетень, но в палитре кабинета, а не полноцветной «Газеты»:
                двойная линейка сохраняет жанр, фон и текст остаются тёмными */}
            <div style={{ background: COLOR.panelRaised, color: COLOR.text, padding: '16px 18px',
              borderTop: `3px double ${COLOR.gold}`, borderLeft: `1px solid ${COLOR.border}`,
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              <div className="ems-mono" style={{ fontSize: 9, color: COLOR.gold, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Бюллетень квартала</div>
              {room.report ? (
                <div className="ems-serif" style={{ fontSize: 13, lineHeight: 1.65 }}>{room.report}</div>
              ) : (
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.muted }}>
                  {isTraderRoom ? 'Совершайте сделки слева и нажмите «готов» — квартал наступит, когда готовы оба трейдера.'
                    : 'Настройте свои решения слева и отправьте их — квартал наступит, когда решения пришлют оба игрока.'}
                </div>
              )}
            </div>
          </div>
        </div>
      );
      const rightNode = (
        <div className={narrow && mobileCol !== 'right' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isTraderRoom && <ScorePanel economy={economy} prev={prevEcon} goalDef={goalDef} />}
          <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <Users size={13} color={COLOR.blue} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.blue }}>Статус партии</span>
              {isOwner && <span title="Вы создали эту комнату" className="ems-mono" style={{ marginLeft: 'auto', fontSize: 9.5, color: COLOR.faint, letterSpacing: '0.04em' }}>ВЛАДЕЛЕЦ</span>}
            </div>
            {roomSeats.map((sx) => {
              const rd = seatRole(sx); const Icon = ROLE_ICON[rd.icon];
              const isMe = sx === seat;
              const canKick = isOwner && !isMe && room.occupied[sx];
              return (
                <div key={sx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${COLOR.hairline}` }}>
                  <Icon size={13} color={isMe ? COLOR.gold : COLOR.muted} />
                  <span style={{ flex: 1, color: isMe ? COLOR.text : COLOR.muted }}>
                    {rd.short}{isMe ? ' (вы)' : ''} — {room.occupied[sx] ? (room.names[sx] || 'игрок') : (isTraderRoom ? 'свободно' : 'бот')}
                  </span>
                  <span className="ems-mono" style={{ fontSize: 10.5, color: room.ready[sx] ? COLOR.teal : COLOR.faint }}>
                    {room.ready[sx] ? 'готово' : 'думает'}
                  </span>
                  {canKick && (
                    <button onClick={() => kickSeat(sx)} disabled={kickBusy === sx} title="Убрать из комнаты"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 8, lineHeight: 1.4 }}>
              Код комнаты для второго игрока: <b className="ems-mono" style={{ color: COLOR.text }}>{room.id}</b>
            </div>
          </div>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 9 }}>Показатели экономики</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 11 }} className="ems-scroll">
              {INDICATOR_TABS.map((t) => {
                const TabIcon = t.icon;
                return (<span key={t.id} className={`ems-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setActiveTab(t.id); }}>{TabIcon && <TabIcon size={12} />}{t.label}</span>);
              })}
            </div>
            {(INDICATOR_TABS.find((t) => t.id === activeTab) || INDICATOR_TABS[0]).rows.map((row, i, arr) => {
              const val = row.get ? row.get(economy) : economy[row.key];
              const prevVal = row.get ? row.get(prevEcon) : prevEcon[row.key];
              const delta = Number.isFinite(prevVal) && Number.isFinite(val) ? val - prevVal : 0;
              if (row.text) {
                return (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${COLOR.hairline}` : 'none' }}>
                    <span style={{ color: COLOR.muted }}>{row.label}</span>
                    <span className="ems-mono">{(row.map && row.map[val]) || String(val || '—')}</span>
                  </div>
                );
              }
              return (
                <div key={row.label || row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${COLOR.hairline}` : 'none' }}>
                  <span style={{ color: COLOR.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {ALL_METRICS[row.key] && <PinButton active={pinned.includes(row.key)} onClick={() => togglePin(row.key)} />}
                    {row.label}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="ems-mono">{Number.isFinite(val) ? row.fmt(val) : '—'}</span>
                    {row.noDelta ? <span style={{ width: 34 }} /> : <DeltaTag value={delta} invert={METRIC_INVERT.has(row.key)} />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
      const nodes = { left: leftNode, center: centerNode, right: rightNode };
      const order = layout.wide ? layout.columnOrder : DEFAULT_COLUMN_ORDER;
      const colWidthFor = (id) => (id === 'center' ? 'minmax(0,1fr)' : `${layout.columnWidths[id]}px`);
      const gridStyle = { padding: 18, ...(layout.wide ? { gridTemplateColumns: order.map(colWidthFor).join(' ') } : null) };
      return (
        <div className="ems-grid" style={gridStyle}>
          {order.map((id, i) => (
            <div key={id} style={{ position: 'relative', minWidth: 0 }}>
              {nodes[id]}
              {layout.wide && layout.layoutEditMode && i < order.length - 1 && (
                <ColumnResizeHandle leftId={id} rightId={order[i + 1]} widths={layout.columnWidths}
                  onResize={layout.setColumnWidthsLive} onCommit={layout.commitWidths} />
              )}
            </div>
          ))}
        </div>
      );
      })()}

      {defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={exit} restartLabel="В меню" />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '14px 18px',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
          boxShadow: '0 -6px 20px -10px rgba(0,0,0,0.4)' }}>
          {error && <span style={{ color: COLOR.rust, fontSize: 12, marginRight: 'auto' }}>{error}</span>}
          {!error && (
            <span style={{ fontSize: 11.5, color: COLOR.faint, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
              {!room.occupied[otherSeat]
                ? (isTraderRoom
                  ? 'Второе место свободно: квартал наступит сразу, как только вы будете готовы.'
                  : 'Второе место свободно: за него решает бот, квартал наступит сразу после ваших решений.')
                : isTraderRoom
                  ? (waitingForOther ? 'Вы готовы — ждём партнёра.' : 'Квартал наступит, когда готовы оба трейдера.')
                  : (waitingForOther ? 'Решения отправлены — ждём партнёра.' : 'Квартал наступит, когда решения пришлют оба игрока.')}
              {quarterPending && timeLeftLabel && (
                <span className="ems-mono" title={isTraderRoom ? 'Если оба не будут готовы вовремя, квартал наступит сам собой' : 'Если решение не придёт вовремя, за отсутствующего один раз решит бот'}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: timeLeftMs < 60000 ? COLOR.rust : COLOR.muted }}>
                  <Clock size={11} />{timeLeftLabel}
                </span>
              )}
            </span>
          )}
          {waitingForOther ? (
            <button className="ems-btn" style={{ padding: '12px 22px', fontSize: 13 }} disabled={busy} onClick={retract}>{isTraderRoom ? 'Отменить готовность' : 'Отозвать решения'}</button>
          ) : (
            <button className="ems-btn primary" style={{ padding: '12px 26px', fontSize: 13.5 }} disabled={busy} onClick={send}>
              {busy ? 'Отправка…' : isTraderRoom ? 'Готов к следующему кварталу'
                : isPresidentSeat ? 'Подписать и завершить квартал' : 'Отправить решения квартала'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ ГЛАВНОЕ МЕНЮ ============================ */
// Первый экран после запуска: выбор направления (новая партия / сеть /
// продолжить / достижения), а не сразу детальная анкета — её показывает
// SetupScreen отдельным шагом, только для новой одиночной партии.
// Витринные классы (.ems-hero-*, .ems-card-btn, .ems-theme-*) определены в
// GlobalStyle и переиспользуются на всех входных экранах (меню, новая партия,
// обучение, сеть) — не только здесь.
function MainMenu({ theme, setTheme, onNewGame, onNetwork, onTutorial, onLoad }) {
  // профиль может смениться прямо здесь (связывание устройств), поэтому это
  // состояние, а не разовое чтение: после связывания список слотов перечитывается
  const [playerId, setPlayerIdState] = useState(getPlayerId);
  const [soloSlots, setSoloSlots] = useState(null);
  const [slotBusy, setSlotBusy] = useState(null);
  const [slotError, setSlotError] = useState('');
  const [storageMode, setStorageMode] = useState(null);
  const [showAch, setShowAch] = useState(false);
  const [showLink, setShowLink] = useState(false);
  React.useEffect(() => {
    fetchSoloSlots(playerId).then((d) => { setSoloSlots(d.slots); setStorageMode(d.storage || null); })
      .catch(() => setSoloSlots(Array(SOLO_SLOT_COUNT).fill(null)));
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
      onLoad(snap);
    } catch (e) { setSlotError(e.message); setSlotBusy(null); }
  };
  const removeSlot = async (idx) => {
    try { setSoloSlots(await deleteSoloSlot(playerId, idx)); } catch (e) { setSlotError(e.message); }
  };
  const hasSaves = !!(soloSlots && soloSlots.some(Boolean));

  const MENU_ITEMS = [
    { id: 'new', icon: Flag, title: 'Новая партия', desc: 'Пост, характер оппонента, сложность — и первый квартал у руля.',
      action: () => { Audio.prime(); Audio.play('stamp'); onNewGame(); } },
    { id: 'tutorial', icon: GraduationCap, title: 'Обучение', desc: 'Три курса с тестами, практикой и экзаменами: политика, инвестор, президент.',
      action: () => { Audio.prime(); Audio.play('tab'); onTutorial(); } },
    { id: 'network', icon: Users, title: 'Игра по сети — вдвоём', desc: 'ЦБ и Минфин (или два трейдера) — разные игроки на одной экономике.',
      action: () => { Audio.prime(); Audio.play('tab'); onNetwork(); } },
    { id: 'achievements', icon: Trophy, title: 'Достижения', desc: 'Коллекция наград, открытых за все ваши партии в этом профиле.',
      action: () => { Audio.play('click'); setShowAch(true); } },
    { id: 'link', icon: Smartphone, title: 'Связать устройства', desc: 'Один профиль на телефоне и компьютере: общие сохранения, достижения и курсы.',
      action: () => { Audio.play('click'); setShowLink(true); } },
  ];

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '56px 16px' }}>
      <GlobalStyle />
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      {showLink && (
        <DeviceLinkModal playerId={playerId} onClose={() => setShowLink(false)}
          onLinked={(id) => { setPlayerIdState(id); setSoloSlots(null); setSlotError(''); }} />
      )}
      <div style={{ maxWidth: 640, width: '100%' }}>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="ems-hero-eyebrow">Симулятор макроэкономической политики</div>
          <div className="ems-hero-title">Экономическая панель государства</div>
          <div className="ems-hero-rule" />
          <span className="ems-hero-badge"><Clock size={11} color={COLOR.gold} />{romanQ(1)} кв. {CONFIG.startYear} · вступление в должность</span>
          <div className="ems-hero-lede">
            Ставка → кредит → спрос → выпуск → занятость → цены → ожидания. Управляйте центральным банком, Минфином
            или обоими сразу — соло против ботов со своим характером или вдвоём по сети.
          </div>
        </div>

        {storageMode === 'memory' && (
          <div className="ems-panel ems-fade-in" style={{ padding: 13, marginBottom: 16, borderColor: COLOR.rust, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: COLOR.rust, lineHeight: 1.5 }}>
              Сервер не подключён к общему хранилищу (Redis) — сохранения живут только в памяти одного случайного
              запроса и могут пропасть между обращениями. Это настройка развёртывания
              (переменные окружения <b className="ems-mono">KV_REST_API_URL</b>/<b className="ems-mono">KV_REST_API_TOKEN</b>),
              не баг в самой партии.
            </div>
          </div>
        )}

        {hasSaves && (
          <div className="ems-panel ems-fade-in" style={{ padding: 15, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <Clock size={13} color={COLOR.teal} />
              <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>
                Продолжить ({soloSlots.filter(Boolean).length} из {SOLO_SLOT_COUNT})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {soloSlots.map((slot, idx) => {
                if (!slot) return null;
                const roleTitle = (ROLES.find((r) => r.id === slot.role) || {}).short || slot.role;
                return (
                  <div key={idx} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12 }}>
                    <span style={{ flex: 1, minWidth: 0, color: COLOR.text }}>
                      {slot.name && (
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.name}</span>
                      )}
                      <span style={{ fontSize: slot.name ? 10.5 : 12, color: slot.name ? COLOR.faint : COLOR.text }}>
                        {roleTitle} · {quarterLabel(Math.max(1, (slot.quarterIndex || 1) - 1))}
                      </span>
                    </span>
                    <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 11 }} disabled={slotBusy === idx}
                      onClick={() => enterSlot(idx)}>{slotBusy === idx ? 'Загружаем…' : 'Играть'}</button>
                    <button onClick={() => removeSlot(idx)} aria-label="Удалить сохранение"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            {slotError && <div style={{ fontSize: 11.5, color: COLOR.rust, marginTop: 8 }}>{slotError}</div>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 30 }}>
          {MENU_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={item.id} onClick={item.action} className="ems-card-btn ems-fade-in"
                style={{ padding: '17px 20px', animationDelay: `${80 + i * 55}ms` }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') item.action(); }}>
                <div className="ems-card-icon">
                  <Icon size={19} color={COLOR.gold} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>{item.desc}</div>
                </div>
                <ChevronDown className="ems-card-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        <div className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
          <AudioControls />
        </div>

        <div className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: COLOR.faint, marginRight: 2 }}>Оформление:</span>
          {Object.values(THEMES).map((t) => (
            <button key={t.id} className="ems-theme-chip" style={{
              background: theme === t.id ? COLOR.gold : COLOR.panelAlt, color: theme === t.id ? COLOR.ink : COLOR.muted,
              border: `1px solid ${theme === t.id ? COLOR.gold : COLOR.border}` }}
              onClick={() => { Audio.play('tab'); setTheme(t.id); }}>
              <span className="ems-theme-dot" style={{ background: t.colors.gold }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================ СЛОВАРЬ ТЕРМИНОВ ================================
   Курс объясняет механику, но пользуется словами, которых человек мог никогда не
   встречать: «дисконтируется», «бенчмарк», «разрыв выпуска». Раньше их приходилось
   либо угадывать по контексту, либо искать снаружи. Теперь термин в тексте подчёркнут
   пунктиром: наведите (или нажмите с телефона) — и определение раскроется прямо под
   абзацем. Тот же список целиком лежит в «Словаре» на странице курсов. */
const GLOSSARY = {
  discount: { title: 'Дисконтирование', text: 'Приведение будущих денег к сегодняшнему дню. Тысяча через год стоит сегодня меньше тысячи: её можно было бы положить под процент. Чем выше ставка, тем дешевле сегодня стоит одна и та же будущая прибыль — поэтому от роста ставки акции дешевеют даже без изменения самих прибылей.' },
  long: { title: 'Лонг (длинная позиция)', text: 'Покупка в расчёте на рост цены. Максимальный убыток — вся вложенная сумма: ниже нуля цена не падает.' },
  short: { title: 'Шорт (короткая позиция)', text: 'Ставка на падение: вы продаёте занятый актив, чтобы позже выкупить его дешевле. Прибыль ограничена (цена не упадёт ниже нуля), а убыток растёт вместе с ценой и потолка не имеет — на практике позицию раньше закроет маржин-колл.' },
  leverage: { title: 'Плечо', text: 'Сделка на сумму больше собственного капитала: остальное — заём под обеспечение. Во столько же раз растут и прибыль, и убыток, и скорость, с которой вы упираетесь в маржин-колл.' },
  margincall: { title: 'Маржин-колл', text: 'Требование довнести обеспечение, когда убыток съел его запас. Если вносить нечего, позиции закрывают принудительно по текущей цене — и убыток фиксируется независимо от того, что цена сделает дальше.' },
  benchmark: { title: 'Бенчмарк (эталон)', text: 'То, с чем сравнивают результат: индекс акций, облигации, депозит, инфляция. «Заработал 8%» ничего не значит, пока неизвестно, сколько за то же время дал рынок и сколько съели цены.' },
  volatility: { title: 'Волатильность', text: 'Размах колебаний цены. Высокая волатильность — это не «падение», а неопределённость: сильные движения в обе стороны, из-за которых плечо становится опасным.' },
  liquidity: { title: 'Ликвидность', text: 'Насколько быстро актив превращается в деньги без потери цены. У банка — запас средств, которыми он может рассчитаться прямо сейчас; его нехватка останавливает кредитование раньше, чем банк становится неплатёжеспособным.' },
  riskpremium: { title: 'Премия за риск', text: 'Надбавка к ставке, которую требуют за право одолжить именно вам. Растёт от долга, политической неопределённости и слабых институтов — и удорожает весь новый долг государства.' },
  realrate: { title: 'Реальная ставка', text: 'Ставка за вычетом инфляции (точнее — ожидаемой инфляции). Именно она определяет, дорогие деньги или дешёвые: ставка 8% при инфляции 10% — это мягкая политика, а не жёсткая.' },
  rstar: { title: 'Нейтральная ставка (r*)', text: 'Уровень реальной ставки, при котором политика никуда не толкает экономику: не разгоняет и не тормозит. Жёсткость политики измеряют расстоянием до неё, а не абсолютной цифрой.' },
  outputgap: { title: 'Разрыв выпуска', text: 'Насколько фактический ВВП отличается от потенциального, в процентах. Плюс — экономика работает выше своих возможностей (перегрев, цены пойдут вверх), минус — недозагружена (простаивают люди и мощности).' },
  potential: { title: 'Потенциальный рост', text: 'Темп, с которым экономика может расти долго и без разгона цен: определяется людьми, капиталом и производительностью. Спрос можно поднять указом, потенциал — только реформами и инвестициями, и не за квартал.' },
  nairu: { title: 'Естественная безработица (NAIRU)', text: 'Уровень безработицы, при котором зарплаты и цены не ускоряются. Опускать безработицу ниже него можно — но только ценой растущей инфляции.' },
  expectations: { title: 'Инфляционные ожидания', text: 'То, какую инфляцию люди и бизнес закладывают в цены и зарплаты уже сейчас. Это механизм, а не прогноз: если все ждут роста цен, он происходит независимо от первопричины.' },
  anchor: { title: 'Якорь ожиданий', text: 'Состояние, при котором ожидания стоят у цели центрального банка и не реагируют на каждый скачок цен. Якорь держится доверием: сорвать его можно за квартал, вернуть — за годы.' },
  credibility: { title: 'Доверие к ЦБ', text: 'Насколько рынок верит, что объявленная цель будет достигнута. Высокое доверие делает ту же ставку эффективнее: ожидания опускаются сами, без дополнительного ужесточения.' },
  fiscalimpulse: { title: 'Бюджетный импульс', text: 'Насколько бюджет в этом году добавляет спроса по сравнению с прошлым. Положительный импульс разгоняет экономику, даже если дефицит формально не растёт.' },
  consolidation: { title: 'Бюджетная консолидация', text: 'Сокращение дефицита: расходы вниз или налоги вверх. Лечит долг и помогает ставке, но забирает спрос — обычно в самый неподходящий политически момент.' },
  transfers: { title: 'Социальные выплаты (трансферты)', text: 'Пенсии, пособия, индексации. Это не разовая трата, а темп: подняли один раз — расходы растут каждый квартал, пока решение не отменят.' },
  shadow: { title: 'Теневая экономика', text: 'Доля активности, которая не видна бюджету и не платит налогов. Растёт от чрезмерной налоговой нагрузки: часть возможных сборов теряется ровно так, а не из-за «плохого администрирования».' },
  intervention: { title: 'Валютные интервенции', text: 'Покупка или продажа валюты центральным банком ради курса. Против фундаментальных причин ослабления работают недолго — ровно столько, сколько хватит резервов.' },
  yieldcurve: { title: 'Кривая доходности', text: 'Соотношение доходностей коротких и длинных облигаций. Когда короткие дороже длинных (кривая перевёрнута), рынок ждёт снижения ставки — обычно из-за приближающегося спада.' },
  polcapital: { title: 'Политический капитал', text: 'Ресурс президента вместо ползунков: им оплачиваются указы, кадровые решения, реформы и требования к ведомствам. Копится рейтингом и ростом, тает кризисами и беспорядками.' },
  reform: { title: 'Структурная реформа', text: 'Изменение правил, а не суммы: рынок труда, пенсии, суды, образование. Двигает потенциал экономики, а не её загрузку, платит за себя годами и почти всегда стоит рейтинга сразу.' },
  futures: { title: 'Фьючерс', text: 'Контракт на актив с расчётами по рыночной цене каждый квартал, а не сама покупка. Плечо в нём не берётся отдельно — оно встроено в номинал контракта: вносится лишь гарантийное обеспечение, а прибыль и убыток считаются от полной суммы контракта, поэтому и то, и другое растёт кратно быстрее, чем при прямой покупке актива.' },
  option: { title: 'Опцион', text: 'Право (но не обязанность) купить (call) или продать (put) актив по заранее оговорённой цене (страйку) до определённого срока. Стоит премию — это и есть максимум, который можно потерять; выигрыш при этом ничем не ограничен сверху у call и ограничен нулевой ценой актива у put.' },
};
const GLOSSARY_KEYS = Object.keys(GLOSSARY);

/* Термин в тексте курса: пунктирное подчёркивание, определение раскрывается по
   нажатию (на десктопе работает и обычная подсказка при наведении). */
function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[k];
  if (!g) return <>{children}</>;
  return (
    <span style={{ position: 'relative' }}>
      <span role="button" tabIndex={0} title={`${g.title} — ${g.text}`}
        onClick={() => { Audio.play('tick'); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
        style={{ borderBottom: `1px dashed ${COLOR.gold}`, cursor: 'help', color: COLOR.goldSoft }}>{children}</span>
      {open && (
        <span style={{ display: 'block', margin: '7px 0', padding: '9px 11px', background: COLOR.panelAlt,
          border: `1px solid ${COLOR.border}`, borderRadius: 3, fontSize: 11.5, lineHeight: 1.55, color: COLOR.muted }}>
          <b style={{ color: COLOR.goldSoft }}>{g.title}</b> — {g.text}
        </span>
      )}
    </span>
  );
}

function GlossaryModal({ onClose }) {
  const [q, setQ] = useState('');
  const norm = q.trim().toLowerCase();
  const list = GLOSSARY_KEYS.map((k) => GLOSSARY[k])
    .filter((g) => !norm || g.title.toLowerCase().includes(norm) || g.text.toLowerCase().includes(norm))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 620, width: '100%', maxHeight: '86vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <GraduationCap size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Словарь терминов</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} aria-label="Закрыть" onClick={onClose}><X size={13} /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по словарю"
          style={{ width: '100%', padding: '9px 11px', fontSize: 13, marginBottom: 12,
            background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
        {list.map((g) => (
          <div key={g.title} className="ems-panel" style={{ padding: '10px 12px', marginBottom: 7 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: COLOR.goldSoft, marginBottom: 3 }}>{g.title}</div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.55 }}>{g.text}</div>
          </div>
        ))}
        {!list.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Ничего не нашлось.</div>}
      </div>
    </div>
  );
}

/* ============================ ОБУЧЕНИЕ: КУРС ИЗ МОДУЛЕЙ ============================ */
// Курс из последовательных модулей вместо одного урока: каждый — своя
// мини-экономика (без бота-оппонента, кризисов и оценки партии) на настоящем
// движке (simulateQuarter), со сценарием и открываемыми по одному рычагами.
// Модули идут от поверхностного понимания к углублённому и разблокируются по
// порядку — прогресс хранится на устройстве (localStorage), как и достижения.
const COURSE_PROGRESS_KEY = 'ems-course-progress';
const loadCourseProgress = () => { try { return JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY) || '{}'); } catch { return {}; } };
const markModuleDone = (id) => {
  const p = loadCourseProgress(); p[id] = true;
  try { localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
  return p;
};

/* ============================ ОБУЧЕНИЕ: ПРОВЕРКА ЗНАНИЙ ============================
   Модуль больше нельзя пролистать «Далее»: между теорией и следующим модулем стоят
   два вида проверки — тест (теория) и практика (задача в песочнице). Тест не пускает
   дальше с неверным ответом, но и не наказывает: показывает разбор и даёт ответить
   заново, потому что цель проверки — чтобы человек понял, а не чтобы он отсеялся.
   Практика устроена так же: не получилось за отведённые кварталы — состояние
   откатывается к началу задачи, и можно попробовать ещё раз. */
/* Правильный вариант при написании всегда стоит первым — так удобно автору и
   совершенно негодно для проверяющего: «А» превратилась бы в универсальный ответ.
   Порядок перемешивается детерминированно по тексту вопроса: у одного и того же
   вопроса он всегда одинаковый (иначе варианты прыгали бы при каждом рендере и
   при перепрохождении), но предсказать его по позиции нельзя. */
const hashStr = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// возвращает порядок показа: order[позиция на экране] = индекс в исходном массиве
const shuffleOrder = (question, salt) => {
  const order = question.options.map((_, i) => i);
  let seed = (hashStr(question.q) ^ (salt || 0)) >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order;
};

function QuizStep({ questions, onPass, passed }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  /* Соль перемешивания живёт на время захода в модуль: внутри одной попытки
     варианты не прыгают, а при следующем заходе порядок другой — иначе тест
     запоминается позициями, а не смыслом. */
  const salt = React.useRef(Math.floor(Math.random() * 1e9));
  const orders = useMemo(() => questions.map((q) => shuffleOrder(q, salt.current)), [questions]);
  const allAnswered = questions.every((_, i) => answers[i] !== undefined);
  /* Тест, сданный в прошлый заход, отвечать заново не нужно — прогресс модуля
     сохраняется. Но разбор при этом строился по пустому набору ответов и писал
     «Неверно» под вариантом, который тут же был отмечен галочкой как правильный. */
  const isRight = (i) => (answers[i] === undefined ? !!passed : orders[i][answers[i]] === questions[i].answer);
  const wrongCount = questions.filter((_, i) => !isRight(i)).length;
  const check = () => {
    setChecked(true);
    if (wrongCount === 0) { Audio.play('stamp'); onPass(); } else { Audio.play('alarm'); haptic([40, 60, 40]); }
  };
  const pick = (qi, oi) => {
    if (passed) return;
    Audio.play('tick');
    setAnswers((a) => ({ ...a, [qi]: oi }));
    // после правки ответа разбор прячется: иначе рядом с новым выбором висит
    // вердикт по старому и читается как оценка того, что ещё не проверяли
    setChecked(false);
  };
  return (
    <div>
      {questions.map((q, qi) => {
        const showVerdict = checked || passed;
        return (
          <div key={q.q} className="ems-panel" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 9 }}>
              <span className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint, flexShrink: 0 }}>{qi + 1} / {questions.length}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: COLOR.text }}>{q.q}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {orders[qi].map((srcIdx, oi) => {
                const opt = q.options[srcIdx];
                const chosen = answers[qi] === oi;
                const right = srcIdx === q.answer;
                const mark = showVerdict && (right || chosen);
                const color = !mark ? (chosen ? COLOR.gold : COLOR.border) : right ? COLOR.teal : COLOR.rust;
                return (
                  <button key={opt} className="ems-btn" onClick={() => pick(qi, oi)} disabled={passed}
                    style={{ textAlign: 'left', padding: '8px 11px', fontSize: 12.5, lineHeight: 1.45, display: 'flex', gap: 9, alignItems: 'flex-start',
                      borderColor: color, background: chosen ? COLOR.goldDim : COLOR.panelAlt,
                      color: COLOR.text, cursor: passed ? 'default' : 'pointer' }}>
                    <span className="ems-mono" style={{ fontSize: 10.5, color, flexShrink: 0, marginTop: 1 }}>
                      {mark ? (right ? '✓' : '✕') : String.fromCharCode(1040 + oi)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {showVerdict && (
              <div style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.5, paddingLeft: 10,
                borderLeft: `2px solid ${isRight(qi) ? COLOR.teal : COLOR.rust}`, color: COLOR.muted }}>
                <b style={{ color: isRight(qi) ? COLOR.teal : COLOR.rust }}>{isRight(qi) ? 'Верно. ' : 'Неверно. '}</b>{q.explain}
              </div>
            )}
          </div>
        );
      })}
      {!passed && (
        <>
          <button className="ems-btn primary" disabled={!allAnswered} style={{ width: '100%', padding: '11px 0', fontSize: 13 }}
            onClick={check}>
            {checked && wrongCount > 0 ? 'Проверить ещё раз' : 'Проверить ответы'}
          </button>
          <div style={{ fontSize: 11, color: checked && wrongCount ? COLOR.rust : COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
            {checked && wrongCount > 0
              ? `Ошибок: ${wrongCount}. Разбор под каждым вопросом — исправьте ответы и проверьте снова, попытки не считаются.`
              : allAnswered ? 'Дальше пустит только полностью верный ответ — но переотвечать можно сколько угодно.'
                : 'Ответьте на все вопросы, чтобы проверить.'}
          </div>
        </>
      )}
      {passed && (
        <div style={{ fontSize: 12.5, color: COLOR.teal, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Check size={14} />Тест пройден.
        </div>
      )}
    </div>
  );
}

/* Полоса задачи: что нужно сделать, сколько кварталов осталось и где вы сейчас. */
function PracticeStatus({ step, ctx, quartersUsed, passed, failed }) {
  const left = step.maxQuarters - quartersUsed;
  const tone = passed ? COLOR.teal : failed ? COLOR.rust : COLOR.gold;
  return (
    <div className="ems-panel" style={{ padding: '11px 14px', marginBottom: 12, borderColor: tone }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: tone }}>
          {passed ? 'Задача решена' : failed ? 'Задача не решена' : 'Задача'}
        </span>
        <span style={{ fontSize: 12.5, color: COLOR.text, flex: 1, minWidth: 180 }}>{step.goalLabel}</span>
        <span className="ems-mono" style={{ fontSize: 11, color: left <= 1 && !passed ? COLOR.rust : COLOR.faint }}>
          {passed ? `${quartersUsed} кв. потрачено` : `осталось ${left} кв. из ${step.maxQuarters}`}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>{step.goalText(ctx)}</div>
      {failed && step.hint && (
        <div style={{ fontSize: 11.5, color: COLOR.goldSoft, marginTop: 6, lineHeight: 1.45 }}>Подсказка: {step.hint}</div>
      )}
    </div>
  );
}

const TUTORIAL_MODULES = [
  {
    id: 'basics', depth: 'surface', icon: Zap,
    title: 'Основы: ставка и расходы',
    summary: 'Как ключевая ставка и госрасходы двигают экономику — и почему не сразу.',
    pins: ['gdp', 'inflation', 'unemployment', 'debtToGdp'],
    steps: [
      {
        title: 'Добро пожаловать',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Это тренировочный кабинет: мини-экономика без бота-оппонента, кризисов и оценки партии в конце. Настоящая игра сложнее — там второй ветвью власти управляет бот со своим характером, случаются кризисы, а итог партии сравнивается с выбранной целью.</p>
            <p>Экономика считается кварталами, и решение сегодня отражается на показателях с лагом в один-два квартала — эффект не мгновенный. Это главное, что стоит запомнить прямо сейчас.</p>
            <p>Сейчас инфляция {pctFmt(economy.inflation)} при цели {pctFmt(economy.inflationTarget)}, рост в норме. Нажмите «Далее», чтобы посмотреть на квартал без вашего вмешательства.</p>
          </>
        ),
      },
      {
        title: 'Ключевая ставка', pins: ['keyRate', 'inflation', 'gdp', 'unemployment'],
        lever: 'keyRate', minDelta: 1, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Вот единственный рычаг этого шага — ключевая ставка Центрального банка. Выше ставка → дороже кредит → меньше спроса → ниже инфляция, но и медленнее рост. Ниже ставка — наоборот.</p>
            <p>Сейчас ставка {pctFmt(economy.keyRate)}, инфляция {pctFmt(economy.inflation)}.</p>
            <p>Поднимите ставку минимум на 1 п.п. и нажмите «Далее» — квартал завершится с этим решением.</p>
          </>
        ),
      },
      {
        title: 'Лаг и бюджетный рычаг', pins: ['keyRate', 'inflation', 'outputGap', 'gdp'],
        lever: 'govSpending', minDelta: 2, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Инфляция сейчас {pctFmt(economy.inflation)} — почти как и была. Это ожидаемо: решение по ставке действует не мгновенно, а с лагом в один-два квартала — эффект будет виден чуть позже.</p>
            <p>А вот и второй канал — расходы государства. В отличие от ставки, это решение «по накопительной»: заданный темп роста расходов сохраняется, пока вы его не измените, — не нужно повторять его каждый квартал.</p>
            <p>Поднимите темп роста госрасходов минимум на 2 п.п. и нажмите «Далее».</p>
          </>
        ),
      },
      {
        title: 'Вот и эффект', pins: ['keyRate', 'inflation', 'outputGap', 'unemployment'],
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1].inflation : economy.inflation;
          const now = economy.inflation;
          return (
            <>
              <p>Сравните: сразу после первого квартала инфляция была {pctFmt(before)}. Сейчас, когда ставка и расходы успели подействовать, — {pctFmt(now)}. {now < before
                ? 'Повышение ставки перевесило стимул от расходов — инфляция снижается.'
                : 'Стимул от расходов оказался сильнее охлаждающего эффекта ставки — инфляция подросла.'}</p>
              <p>Это и есть главный урок первого модуля: эффект решений накапливается и проявляется с задержкой.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли первую цепочку: <b>ставка/расходы → кредит и спрос → выпуск → занятость → цены</b>. Дальше — вторая половина государства: бюджет, налоги и то, откуда вообще берётся госдолг.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'budget', depth: 'surface', icon: Coins,
    title: 'Бюджет: налоги и дефицит',
    summary: 'Откуда берутся деньги государства и почему долг — это не просто цифра.',
    pins: ['revenuePctGdp', 'budgetBalancePctGdp', 'debtToGdp', 'interestToRevenue'],
    steps: [
      {
        title: 'Доходы, расходы, долг',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Бюджет — это доходы (в основном налоги) минус расходы. Разница — дефицит (если отрицательная) или профицит. Накопленные из года в год дефициты и есть государственный долг.</p>
            <p>Долг принято мерить не в абсолютных деньгах, а в % ВВП — так можно сравнивать разные по размеру экономики и разные периоды одной и той же.</p>
            <p>Сейчас доходы бюджета {pctFmt(economy.revenuePctGdp)} ВВП, долг {pctFmt(economy.debtToGdp)} ВВП. Нажмите «Далее», чтобы увидеть спокойный квартал.</p>
          </>
        ),
      },
      {
        title: 'Налоги', pins: ['revenuePctGdp', 'shadowShare', 'budgetBalancePctGdp', 'debtToGdp'],
        lever: 'vatRate', minDelta: 3, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Поднимите НДС минимум на 3 п.п. Казалось бы, доходы бюджета должны вырасти пропорционально ставке — но так работает только в теории.</p>
            <p>Сейчас НДС {pctFmt(economy.vatRate)}, <Term k="shadow">теневая экономика</Term> {pctFmt(economy.shadowShare)} ВВП. Чем выше ставка сверх разумного, тем больше активности уходит «в тень» — часть возможных сборов модель теряет именно так.</p>
          </>
        ),
      },
      {
        title: 'Расходы вместо доходов',
        lever: 'transfers', minDelta: 3, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Второй способ повлиять на бюджет — расходы. Поднимите темп роста социальных выплат минимум на 3 п.п.</p>
            <p>В отличие от разовой операции, это тоже «накопительное» решение (как госрасходы в первом модуле): подняли один раз — растёт каждый квартал, пока не измените. Сейчас баланс бюджета {fmtSignedPct(economy.budgetBalancePctGdp)} ВВП.</p>
          </>
        ),
      },
      {
        title: 'Цена долга',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1] : economy;
          return (
            <>
              <p>Доходы бюджета выросли не так сильно, как ставка НДС — часть эффекта съела тень. А рост социальных выплат потянул баланс бюджета вниз: с {fmtSignedPct(before.budgetBalancePctGdp)} до {fmtSignedPct(economy.budgetBalancePctGdp)} ВВП.</p>
              <p>Долг к ВВП сдвинулся с {pctFmt(before.debtToGdp)} до {pctFmt(economy.debtToGdp)}. Обслуживание долга ({pctFmt(economy.interestToRevenue)} от доходов) — это проценты, которые бюджет платит каждый квартал, отъедая от денег на всё остальное.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Налоги не масштабируются линейно, а расходы, увеличенные один раз, продолжают давить на баланс каждый квартал. Долг — это не разовая проблема, а нарастающая стоимость обслуживания. Дальше — то, что происходит на границе: валютный курс.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'fx', depth: 'surface', icon: Globe2,
    title: 'Валютный курс и резервы',
    summary: 'Что двигает курс и почему ставка и интервенции тянут его в разные стороны.',
    pins: ['exchangeRate', 'reserves', 'currentAccount', 'inflation'],
    steps: [
      {
        title: 'Курс и резервы',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Курс в этой модели устроен так: чем выше число — тем слабее национальная валюта. Резервы — валютная «подушка», которой ЦБ может защищать курс интервенциями, но она не бесконечна.</p>
            <p>Сейчас курс {fmt1(economy.exchangeRate)}, резервы {fmtMoney(economy.reserves)}. Нажмите «Далее», чтобы увидеть спокойный квартал.</p>
          </>
        ),
      },
      {
        title: 'Валютные интервенции',
        lever: 'fxIntervention', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Увеличьте валютные интервенции минимум на 5 млрд. Положительное значение — ЦБ покупает иностранную валюту, тем самым ослабляя национальную (например, чтобы поддержать экспортёров, которым выгоден слабый курс).</p>
            <p>Курс сейчас {fmt1(economy.exchangeRate)}.</p>
          </>
        ),
      },
      {
        title: 'Ставка как противовес',
        lever: 'keyRate', minDelta: 1.5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>У ставки, помимо влияния на инфляцию (модуль 1), есть и валютный эффект: чем она выше, тем привлекательнее актив в национальной валюте для иностранного капитала — курс укрепляется.</p>
            <p>Курс после прошлого шага — {fmt1(economy.exchangeRate)}. Поднимите ключевую ставку минимум на 1.5 п.п. — это противоположно направленная сила.</p>
          </>
        ),
      },
      {
        title: 'Кто перевесил',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1].exchangeRate : economy.exchangeRate;
          const now = economy.exchangeRate;
          return (
            <>
              <p>Курс изменился с {fmt1(before)} до {fmt1(now)}. Вы одновременно ослабляли его интервенциями и укрепляли ставкой — {now > before ? 'интервенции оказались сильнее' : 'ставка перевесила'}.</p>
              <p>В реальной партии эти рычаги обычно в руках разных институтов (ЦБ отвечает за оба, но приоритеты у него не всегда однозначны) — управлять курсом в одиночку сложнее, чем кажется.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Курс — не отдельный рычаг, а равнодействующая нескольких решений сразу, и резервы, которыми его защищают, конечны. Дальше — тема более тонкая: как рынки верят (или не верят) обещаниям ЦБ.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'expectations', depth: 'deep', icon: Target,
    title: 'Ожидания и доверие к ЦБ',
    summary: 'Почему инфляционные ожидания важнее сиюминутной инфляции.',
    pins: ['inflation', 'inflationExpectations', 'cbCredibility', 'keyRate'],
    steps: [
      {
        title: 'Ожидания важнее цифры',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Инфляционные ожидания — это не прогноз, а то, что закладывают в цены и зарплаты уже сейчас: если все верят, что инфляция будет высокой, продавцы и работники требуют больше — и она правда становится высокой. Это самосбывающийся механизм.</p>
            <p>Доверие к ЦБ измеряет, насколько рынок верит объявленной цели по инфляции. Сейчас ожидания {pctFmt(economy.inflationExpectations)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Соблазн простого решения',
        lever: 'inflationTarget', minDelta: 1, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Есть простой на бумаге способ «побороть» высокую инфляцию — объявить цель повыше, и формально она у цели. Поднимите цель по инфляции минимум на 1 п.п. и посмотрите, что происходит на самом деле.</p>
            <p>Сейчас цель {pctFmt(economy.inflationTarget)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Доверие не восстанавливается по щелчку',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] || economy;
          return (
            <>
              <p>Доверие к ЦБ сдвинулось с {Math.round(before.cbCredibility)} до {Math.round(economy.cbCredibility)}, а ожидания — с {pctFmt(before.inflationExpectations)} до {pctFmt(economy.inflationExpectations)}. Смена цели не прошла бесплатно: рынок теперь меньше верит следующим объявлениям ЦБ.</p>
              <p>Доверие теряется быстро, а восстанавливается медленно — и только делами, а не заявлениями.</p>
            </>
          );
        },
      },
      {
        title: 'Восстановление доверия',
        lever: 'keyRate', minDelta: 2, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Единственный способ вернуть доверие — решительно и последовательно действовать в объявленную сторону. Поднимите ключевую ставку минимум на 2 п.п.</p>
            <p>Сейчас ставка {pctFmt(economy.keyRate)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Компромисс между гибкостью и доверием — сквозная тема настоящей игры: недаром у ботов-глав ЦБ разный характер (Ястреб держит цель жёстко, Голубь готов ею жертвовать). Дальше — последний, самый прикладной модуль: как готовиться к кризису заранее.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'crisis', depth: 'deep', icon: ShieldAlert,
    title: 'Риски и подготовка к кризису',
    summary: 'Макропруденциальные инструменты: не тушить пожар, а не дать ему начаться.',
    pins: ['bankingRisk', 'bankCapitalAdequacy', 'bankNPL', 'financialStability'],
    steps: [
      {
        title: 'Пять индикаторов риска',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>В настоящей игре есть панель из пяти рисков: инфляционный, банковский, долговой, рецессии и валютный — заранее показывают, где копится опасность, до того как она стала кризисом. В этом модуле — банковский.</p>
            <p>Достаточность капитала банков {pctFmt(economy.bankCapitalAdequacy)}, просроченные кредиты {pctFmt(economy.bankNPL)}. Это буфер и его нагрузка: чем толще буфер и меньше просрочка, тем спокойнее банковская система переживёт шок.</p>
          </>
        ),
      },
      {
        title: 'Норматив достаточности капитала', pins: ['bankCapitalAdequacy', 'capitalRequirement', 'bankNPL', 'bankingRisk'],
        lever: 'capitalRequirement', minDelta: 1.5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Это требование к банкам держать больше капитала на случай убытков — амортизатор кризиса, который ставится заранее, а не во время паники. Поднимите норматив минимум на 1.5 п.п.</p>
            <p>Плата за это реальна: банки выдают меньше кредитов — рост чуть замедляется. Сейчас норматив {pctFmt(economy.capitalRequirement)}.</p>
          </>
        ),
      },
      {
        title: 'Быстрая помощь ликвидностью', pins: ['bankLiquidity', 'bankingRisk', 'bankCapitalAdequacy', 'bankNPL'],
        lever: 'liquidity', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Другой инструмент — прямая инъекция ликвидности банкам. В отличие от норматива капитала, это разовая скорая помощь, а не структурное решение. Увеличьте вливание ликвидности минимум на 5 млрд.</p>
            <p>Сейчас банковский риск {Math.round(economy.bankingRisk)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Что изменилось',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] || economy;
          return (
            <>
              <p>Достаточность капитала выросла с {pctFmt(before.bankCapitalAdequacy)} до {pctFmt(economy.bankCapitalAdequacy)}, банковский риск изменился с {Math.round(before.bankingRisk)} до {Math.round(economy.bankingRisk)}.</p>
              <p>Норматив капитала — это профилактика на годы вперёд, ликвидность — заплатка на квартал. В реальной партии оба инструмента понадобятся, но по-разному: один заранее, другой — когда индикаторы риска уже красные.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли пять модулей: ставка и расходы → бюджет и долг → валютный курс → ожидания и доверие → риски и подготовка к кризису. Экономика в этих модулях жила своей жизнью — но не жила политика. Последний модуль курса — как раз про неё: что бывает, когда всё перечисленное идёт плохо слишком долго.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'politics', depth: 'deep', icon: Flag,
    title: 'Политический режим: от рейтинга до переворота',
    summary: 'Как провальная политика может стоить не только выборов, но и самой демократии.',
    pins: ['approval', 'politicalTension', 'govTrust', 'quartersToElection'],
    steps: [
      {
        title: 'Рейтинг власти и выборы',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Рейтинг власти — не просто цифра для галочки. Раз в {CONFIG.election.cycle} кварталов проходят выборы, и их итог решает, продолжаете ли вы партию. Для премьер-министра, президента и главы Минфина почти любое поражение заканчивает игру; для Центробанка — только разгромное, ниже 35 из 100.</p>
            <p>Сейчас рейтинг {Math.round(economy.approval)} из 100, до выборов {economy.quartersToElection} кв. Рейтинг реагирует на всё сразу: рост, безработицу, инфляцию, доверие — и реагирует медленно, с задержкой в несколько кварталов, а не мгновенно.</p>
          </>
        ),
      },
      {
        title: 'Цена непопулярных решений',
        lever: 'incomeTaxRate', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Поднимите подоходный налог минимум на 5 п.п. — способ профинансировать что угодно, который никогда не проходит бесследно для доверия. Сейчас ставка {pctFmt(economy.incomeTaxRate)}, доверие к правительству {Math.round(economy.govTrust)} из 100.</p>
            <p>Один квартал почти не изменит рейтинг — эффект слабый и с лагом. Но представьте это решение, повторённое из квартала в квартал: именно так рейтинг доходит до по-настоящему опасных значений, а не одним резким обвалом.</p>
          </>
        ),
      },
      {
        title: 'Политическое напряжение',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Помимо рейтинга, в настоящей партии копится ещё один, менее заметный счётчик — политическое напряжение. Оно растёт от провального рейтинга, войны и от любого активного кризиса экономики (банковского, долгового, валютного — какого угодно): страна в кризисе — это прямое политическое давление, а не только статистика.</p>
            <p>Сейчас напряжение {Math.round(economy.politicalTension)} из 100, режим — «{(POLITICAL_REGIME_INFO[economy.politicalRegime] || {}).label}». Когда оно переваливает за порог, демократия сменяется конфликтом парламента и президента, затем — при неудачном стечении обстоятельств — авторитаризмом и тоталитаризмом. Причём подавление само подпитывает напряжение: авторитарный режим копит недовольство даже в тихие кварталы, просто медленнее.</p>
          </>
        ),
      },
      {
        title: 'Переворот вместо капитуляции',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Разгромное поражение на выборах не всегда означает мирный уход. Если рейтинг рухнул катастрофически и напряжение уже накопилось, действующая власть может не признать результат: выборы объявляются недействительными, парламент распущен, режим одним скачком становится авторитарным — вместо обычного экрана поражения.</p>
            <p>Небольшое поражение почти всегда заканчивается обычным проигрышем — переворот остаётся исходом именно катастрофы, а не любой неудачи на выборах.</p>
          </>
        ),
      },
      {
        title: 'Пропаганда и подконтрольная пресса',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Режим меняет не только цифры, но и то, как о них рассказывают. Авторитарные и особенно тоталитарные власти переписывают редакционную колонку газеты в пропаганду: провалы становятся эвфемизмами, а обычные цифры — поводом для победных реляций. Во время войны тон становится ещё жёстче — на первый план выходят враг и бдительность.</p>
            <p>Сама газета при этом визуально темнеет и остывает: чем дальше от демократии и чем выше напряжение, тем мрачнее бумага — это заметно раньше, чем прочитан хоть один заголовок. Ваша собственная панель управления при этом остаётся честной: искажается только то, что видит страна, а не то, что видите вы.</p>
          </>
        ),
      },
      {
        title: 'Курс пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Это был последний модуль. Вы прошли всю цепочку курса: ставка и расходы → бюджет и долг → валютный курс → ожидания и доверие → риски и подготовка к кризису → политический режим. В настоящей партии всё это работает одновременно, плюс бот на второй ветви власти со своим характером, случайные кризисы, выборы и оценка партии по выбранной цели.</p>
            <p>Готовы попробовать по-настоящему?</p>
          </>
        ),
      },
    ],
  },
];

/* ============================ ПРОВЕРКИ ПО МОДУЛЯМ ============================
   Теория и практика вынесены из тела модулей в отдельную карту: так видно весь
   набор проверок целиком, а сами модули не расползаются на полтысячи строк.
   Порядок внутри модуля один и тот же: сначала тест на понимание прочитанного,
   потом задача, где это понимание надо применить руками. */
const q = (question, options, answer, explain) => ({ q: question, options, answer, explain });

const MODULE_CHECKS = {
  basics: {
    quiz: {
      kind: 'quiz', title: 'Тест: ставка, расходы и лаг',
      body: () => <p>Три вопроса по пройденному. Неверный ответ ничем не грозит: под каждым вопросом появится разбор, и ответить можно заново.</p>,
      questions: [
        q('Центральный банк поднял ключевую ставку. Когда это сильнее всего скажется на инфляции?',
          ['Через один-два квартала', 'В том же квартале', 'Ровно через год, не раньше', 'Никогда: ставка на цены не влияет'], 0,
          'Между решением и ценами стоит цепочка: ставка → стоимость кредита → спрос → выпуск → цены. Каждое звено берёт время, поэтому основной эффект приходит с лагом в один-два квартала.'),
        q('Чем темп роста госрасходов отличается от ключевой ставки как решение?',
          ['Он накопительный: заданный темп действует каждый квартал, пока его не изменить',
            'Он действует ровно один квартал, потом обнуляется', 'Он влияет только на бюджет, но не на спрос',
            'Он меняет цены мгновенно, без лага'], 0,
          'Ставка — это уровень, который стоит там, где вы его поставили. Темп роста расходов — это скорость: пока он положительный, расходы растут каждый квартал, и стимул накапливается сам собой.'),
        q('Вы подняли ставку, а инфляция в том же квартале не снизилась. Что разумнее сделать?',
          ['Подождать: эффект ещё не дошёл до цен', 'Немедленно поднять ставку ещё раз, вдвое сильнее',
            'Вернуть ставку обратно — она не работает', 'Одновременно нарастить госрасходы'], 0,
          'Реакция на отсутствие мгновенного эффекта — самая частая ошибка. Догоняющее ужесточение накладывается на первое, когда оно наконец доходит, и экономика получает двойной удар уже в рецессии.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: остудить перегрев',
      pins: ['inflation', 'outputGap', 'unemployment', 'gdp'],
      goalLabel: 'Инфляция ≤ 6.0% и разрыв выпуска ≤ 1.0%',
      body: () => (
        <>
          <p>Ситуация задана заранее: экономика перегрета — выпуск заметно выше потенциала, инфляция разогналась, ожидания поползли вверх. У вас два рычага из первого модуля и шесть кварталов.</p>
          <p>Помните про лаг: то, что вы поставите сейчас, дойдёт до цен через квартал-другой. Если задача не выйдет — можно откатить её к началу и попробовать иначе.</p>
        </>
      ),
      // перегрев задаётся через сам выпуск: разрыв — величина производная, её
      // подмена ничего бы не изменила, модель пересчитала бы его в тот же квартал
      setup: (e) => ({ gdp: e.potentialGdp * 1.03, inflation: 8.6, coreInflation: 8.0,
        inflationExpectations: 6.6, unemployment: 4.0, keyRate: 5.5 }),
      levers: ['keyRate', 'govSpending'], maxQuarters: 6,
      goal: ({ economy }) => economy.inflation <= 6 && economy.outputGap <= 1.0,
      goalText: ({ economy }) => `Сейчас инфляция ${pctFmt(economy.inflation)}, разрыв выпуска ${fmtSignedPct(economy.outputGap)}.`,
      hint: 'Ставку в такой ситуации поднимают сразу и заметно, а не по четверти пункта: пока вы добавляете понемногу, ожидания успевают вырасти. И проверьте темп госрасходов — пока он в плюсе, бюджет подогревает спрос каждый квартал.',
    },
  },

  budget: {
    quiz: {
      kind: 'quiz', title: 'Тест: доходы, расходы, долг',
      questions: [
        q('Ставку НДС подняли на 3 п.п. Почему доходы бюджета выросли слабее, чем можно было ожидать?',
          ['Часть активности ушла в тень, и база сборов сузилась', 'НДС не влияет на доходы бюджета',
            'Доходы всегда растут ровно пропорционально ставке', 'Собранное автоматически идёт на погашение долга'], 0,
          'Собираемость зависит от ставки: чем она выше сверх привычного уровня, тем выгоднее уходить в тень. Именно поэтому у налоговых сборов есть потолок, за которым повышение ставки уже уменьшает поступления.'),
        q('Что такое государственный долг в этой модели?',
          ['Накопленные за годы дефициты бюджета', 'Разница между экспортом и импортом',
            'Деньги, которые государство должно центральному банку по ставке', 'Сумма всех налогов за год'], 0,
          'Дефицит — поток за квартал, долг — накопленный запас. Поэтому один хороший квартал долг почти не меняет, а несколько лет дефицита меняют сильно.'),
        q('Почему долг измеряют в процентах ВВП, а не в деньгах?',
          ['Так видно нагрузку на экономику, которая этот долг обслуживает',
            'Так цифра выглядит меньше', 'В деньгах его посчитать невозможно',
            'Потому что кредиторы дают в долг проценты, а не деньги'], 0,
          'Один и тот же долг в деньгах — катастрофа для маленькой экономики и мелочь для большой. Отношение к ВВП как раз и показывает, чем страна способна этот долг обслуживать.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: свести бюджет',
      goalLabel: 'Дефицит не глубже 3.5% ВВП',
      body: () => (
        <>
          <p>Вам достался бюджет с дырой под 7% ВВП: предшественник опустил НДС и налог на прибыль намного ниже разумного уровня, а расходы оставил как были. Задача — довести дефицит до 3.5% ВВП или лучше за шесть кварталов.</p>
          <p>Рычагов четыре: два налога и два темпа расходов. Все работают по-разному, и у каждого своя цена — в том числе та, о которой был весь модуль: выше ставка не значит больше сборов.</p>
        </>
      ),
      // баланс в setup задаётся явно: он производный и пересчитается в первом же
      // квартале, но без него шапка показывала прежние -3.6% и спорила с условием
      setup: { vatRate: 10, profitTaxRate: 13, budgetBalancePctGdp: -6.6 },
      pins: ['budgetBalancePctGdp', 'revenuePctGdp', 'debtToGdp', 'shadowShare'],
      levers: ['vatRate', 'profitTaxRate', 'govSpending', 'transfers'], maxQuarters: 6,
      goal: ({ economy }) => economy.budgetBalancePctGdp >= -3.5,
      goalText: ({ economy }) => `Сейчас баланс ${fmtSignedPct(economy.budgetBalancePctGdp)} ВВП, долг ${pctFmt(economy.debtToGdp)}, обслуживание ${pctFmt(economy.interestToRevenue)} доходов.`,
      hint: 'Начните с налогов: они здесь заниженные, и возврат к нормальным ставкам закрывает бо́льшую часть дыры за один квартал. Но не увлекайтесь — выше определённого уровня ставка начинает кормить тень, а не бюджет, и сборы падают. Расходы — это темпы роста: чтобы они реально сокращались, темп должен уйти в минус, а не просто до нуля.',
    },
  },

  fx: {
    quiz: {
      kind: 'quiz', title: 'Тест: курс, резервы, интервенции',
      questions: [
        q('Курс в модели вырос со 100 до 130. Что это значит?',
          ['Национальная валюта ослабла', 'Национальная валюта укрепилась',
            'Резервы выросли на 30%', 'Инфляция снизилась на 30%'], 0,
          'Курс здесь — сколько национальной валюты стоит иностранная. Чем больше число, тем дешевле национальная валюта и тем дороже импорт, который сразу же попадает в цены.'),
        q('ЦБ продаёт валюту из резервов, чтобы поддержать курс. В чём главное ограничение?',
          ['Резервы конечны, и рынок это видит', 'Продажа валюты запрещена при плавающем курсе',
            'Интервенции не влияют на курс', 'Каждая продажа снижает ключевую ставку'], 0,
          'Интервенции работают, пока у ЦБ есть чем интервенировать. Когда резервы подходят к концу, защита курса рушится разом — и девальвация выходит резче, чем была бы без защиты.'),
        q('Как повышение ключевой ставки действует на курс?',
          ['Укрепляет: активы в национальной валюте становятся привлекательнее для капитала',
            'Ослабляет: дорогой кредит душит экспорт', 'Никак: ставка и курс не связаны',
            'Зависит только от цены на сырьё'], 0,
          'Высокая ставка притягивает капитал, и приток укрепляет валюту. Поэтому ставка и интервенции на покупку валюты тянут курс в разные стороны — и итог зависит от того, что сильнее.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: остановить девальвацию',
      goalLabel: 'Курс ≤ 126 при резервах ≥ 150',
      body: () => (
        <>
          <p>Валюта резко ослабла, а импортируемая инфляция разгоняет цены. Нужно вернуть курс к 126 или крепче — и не спалить при этом резервы ниже 150.</p>
          <p>Два рычага тянут курс в одну сторону, но платите вы за них разным: ставка — ростом, интервенции — резервами.</p>
        </>
      ),
      setup: { exchangeRate: 132, reserves: 205, inflation: 8.2, inflationExpectations: 6.5, riskPremium: 2.6, keyRate: 6 },
      levers: ['keyRate', 'fxIntervention'], maxQuarters: 8,
      goal: ({ economy }) => economy.exchangeRate <= 126 && economy.reserves >= 150,
      goalText: ({ economy }) => `Сейчас курс ${fmt1(economy.exchangeRate)}, резервы ${fmtMoney(economy.reserves)}.`,
      hint: 'Одними интервенциями курс не удержать: тающие резервы рынок читает как слабость, премия за риск растёт — и валюта слабеет быстрее, чем её успевают выкупать. Основой защиты делают ставку, а интервенциями лишь сглаживают, иначе резервов не хватит до конца задачи.',
    },
  },

  expectations: {
    quiz: {
      kind: 'quiz', title: 'Тест: ожидания и доверие',
      questions: [
        q('Почему инфляционные ожидания важнее текущей цифры инфляции?',
          ['Их закладывают в цены и зарплаты уже сейчас, и они сбываются сами',
            'Их публикует статистика раньше, чем инфляцию', 'Они входят в ВВП',
            'Ожидания влияют только на курс валюты'], 0,
          'Ожидания — это механизм, а не прогноз. Если все ждут роста цен, продавцы поднимают цены заранее, а работники требуют индексации — и инфляция становится высокой независимо от того, что было её первопричиной.'),
        q('ЦБ поднял цель по инфляции с 4% до 6%. Что произойдёт с доверием к нему?',
          ['Оно упадёт: цель, которую можно подвинуть, перестаёт быть якорем',
            'Оно вырастет: цель стала реалистичнее', 'Ничего не изменится',
            'Доверие вырастет, но только при высокой ставке'], 0,
          'Ценность цели ровно в том, что она не двигается. Один раз подвинув её под факт, ЦБ показывает, что подвинет и в следующий раз, — и ожидания перестают цепляться за объявленную цифру.'),
        q('Доверие к ЦБ упало. Как его вернуть?',
          ['Последовательно действовать в объявленную сторону несколько кварталов подряд',
            'Объявить новую, более амбициозную цель', 'Один раз резко поднять ставку и сразу отпустить',
            'Перестать публиковать цель по инфляции'], 0,
          'Доверие теряется за квартал, а возвращается годами и только делами. Разовый рывок с быстрым разворотом читается как паника и доверие не восстанавливает.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: вернуть ожидания к якорю',
      goalLabel: 'Ожидания ≤ 6.5% при инфляции ≤ 6.0%',
      body: () => (
        <>
          <p>Ожидания сорвались с якоря, доверие к ЦБ на дне, инфляция почти 10%. Это самая дорогая ситуация в модели: пока ожидания высоко, любая ставка работает хуже, чем должна была бы.</p>
          <p>Рычаг один — ключевая ставка, кварталов девять. Цель по инфляции трогать нельзя: она и так уже подвинута. Доверие к ЦБ будет восстанавливаться дольше самих ожиданий — это нормально, оно всегда идёт последним.</p>
        </>
      ),
      setup: { inflation: 9.6, coreInflation: 9.0, inflationExpectations: 8.8, cbCredibility: 30, inflationTarget: 4, keyRate: 6.5 },
      levers: ['keyRate'], maxQuarters: 9,
      goal: ({ economy }) => economy.inflationExpectations <= 6.5 && economy.inflation <= 6,
      goalText: ({ economy }) => `Сейчас ожидания ${pctFmt(economy.inflationExpectations)}, доверие ${Math.round(economy.cbCredibility)} из 100, инфляция ${pctFmt(economy.inflation)}.`,
      hint: 'Доверие растёт, только пока реальная ставка выше нейтральной и политика не мечется. Поставьте ставку заметно выше ожиданий — и не трогайте её несколько кварталов подряд: постоянство здесь и есть инструмент.',
    },
  },

  crisis: {
    quiz: {
      kind: 'quiz', title: 'Тест: буферы и скорая помощь',
      questions: [
        q('Чем норматив достаточности капитала отличается от инъекции ликвидности?',
          ['Норматив — буфер, который ставят заранее; ликвидность — скорая помощь по факту',
            'Это одно и то же разными словами', 'Норматив помогает в кризис, а ликвидность — до него',
            'Норматив увеличивает объём кредита в экономике'], 0,
          'Норматив капитала работает годами и стоит роста: банки кредитуют осторожнее. Ликвидность спасает от разрыва платежей здесь и сейчас, но ничего не меняет в устойчивости системы.'),
        q('Зачем панель рисков, если есть сами показатели?',
          ['Она показывает, где копится опасность, до того как та станет кризисом',
            'Она заменяет собой отчёт по бюджету', 'Она предсказывает точную дату кризиса',
            'Она нужна только при игре за Минфин'], 0,
          'Кризис в модели — не случайность, а порог, к которому показатели подходят постепенно. Риски и есть способ увидеть это приближение за несколько кварталов.'),
        q('Норматив капитала подняли на 2 п.п. Какова плата за это решение?',
          ['Банки выдают меньше кредита, и рост замедляется', 'Растёт инфляция',
            'Падают резервы центрального банка', 'Никакой платы нет — это бесплатная страховка'], 0,
          'Каждый пункт норматива — это капитал, который банк держит вместо того, чтобы выдать в кредит. Устойчивость всегда покупается за темп роста, и вопрос лишь в том, по какой цене вы её берёте.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: вытащить банки',
      pins: ['bankingRisk', 'bankCapitalAdequacy', 'bankNPL', 'bankLiquidity'],
      goalLabel: 'Банковский риск ≤ 45 и ликвидность банков ≥ 58',
      body: () => (
        <>
          <p>Банковская система в стрессе: просрочка растёт, ликвидность на исходе, риск в красной зоне. Задача — вывести систему из опасной зоны за шесть кварталов.</p>
          <p>Три рычага: норматив капитала, прямые вливания ликвидности и ключевая ставка. Один из них помогает быстро, другой — надолго, третий двигает всю экономику сразу.</p>
        </>
      ),
      setup: { bankNPL: 8.4, bankLiquidity: 36, bankingRisk: 72, financialStability: 42, bankCapital: 118, creditVolume: 1450 },
      levers: ['liquidity', 'capitalRequirement', 'keyRate'], maxQuarters: 6,
      goal: ({ economy }) => economy.bankingRisk <= 45 && economy.bankLiquidity >= 58,
      goalText: ({ economy }) => `Сейчас банковский риск ${Math.round(economy.bankingRisk)} из 100, ликвидность ${Math.round(economy.bankLiquidity)}, просрочка ${pctFmt(economy.bankNPL)}.`,
      hint: 'Ликвидность возвращается быстро и от прямых вливаний. С нормативом капитала в разгар стресса осторожнее: он лечит систему вдолгую, но прямо сейчас заставляет банки сжимать кредит, а сжатие кредита ухудшает просрочку.',
    },
  },

  politics: {
    quiz: {
      kind: 'quiz', title: 'Тест: рейтинг, напряжение, режим',
      questions: [
        q('От чего в первую очередь зависит рейтинг власти?',
          ['От реальных доходов, безработицы и инфляции', 'Только от размера госдолга',
            'От числа кварталов у власти', 'От характера бота на второй ветви власти'], 0,
          'Рейтинг считается из того, что человек чувствует на себе: растут ли зарплаты быстрее цен, есть ли работа, насколько цены выше цели. Долг сюда попадает косвенно — через то, чем за него платят.'),
        q('Что происходит с политическим напряжением при силовом подавлении протеста?',
          ['Сразу падает, но потом возвращается больше, чем было',
            'Исчезает окончательно', 'Не меняется', 'Растёт сразу и продолжает расти'], 0,
          'Подавление убирает симптом, а не причину. В модели у него есть и мгновенный минус к напряжению, и растянутый плюс: подавленное недовольство никуда не девается, оно копится.'),
        q('Авторитарный режим объявил выборы. Чем они отличаются от выборов при демократии?',
          ['Результат предрешён, и настоящей гонки с неопределённостью для рынков нет',
            'Ничем', 'Они всегда заканчиваются поражением власти',
            'Они отменяют политическое напряжение'], 0,
          'При авторитарном и тоталитарном режиме выборы в модели не проигрываются: они считают голоса, а не решают исход. Зато напряжение продолжает копиться, и рано или поздно оно выходит другим путём.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: удержать власть',
      goalLabel: 'Рейтинг ≥ 47 и напряжение ≤ 25',
      pins: ['approval', 'politicalTension', 'inflation', 'unemployment'],
      body: () => (
        <>
          <p>Рейтинг рухнул, безработица высокая, инфляция двузначная, напряжение растёт. До выборов ещё есть время, но если ничего не менять, страна дойдёт до них с конфликтом ветвей власти.</p>
          <p>Девять кварталов и три рычага. Разгонять экономику выплатами легко — сложнее сделать это, не добив цены, потому что инфляция бьёт по рейтингу не слабее безработицы.</p>
        </>
      ),
      setup: (e) => ({ approval: 33, unemployment: 8.2, inflation: 10.2, coreInflation: 9.4, inflationExpectations: 8.0,
        politicalTension: 46, gdp: e.potentialGdp * 0.975, keyRate: 7 }),
      levers: ['keyRate', 'transfers', 'govSpending'], maxQuarters: 9,
      goal: ({ economy }) => economy.approval >= 47 && economy.politicalTension <= 25,
      goalText: ({ economy }) => `Сейчас рейтинг ${Math.round(economy.approval)} из 100, напряжение ${Math.round(economy.politicalTension)}, безработица ${pctFmt(economy.unemployment)}, инфляция ${pctFmt(economy.inflation)}.`,
      hint: 'Рейтинг растёт от реальных доходов — от зарплат за вычетом инфляции — и от занятости. Одной жёсткой ставкой его не поднять: цены вы собьёте, но безработица останется высокой, и рейтинг встанет. Спрос придётся поддержать бюджетом одновременно с тем, как ставка гасит инфляцию.',
    },
  },
};

/* ============================ КУРС ИНВЕСТОРА ============================
   Песочница здесь — настоящий терминал: те же инструменты, те же котировки, тот же
   расчёт позиций в конце квартала. Учить торговле на упрощённой имитации смысла нет,
   потому что весь смысл роли в том, как ведут себя настоящие цены. */
const TRADER_MODULES = [
  {
    id: 'tr_market', depth: 'surface', icon: TrendingUp, sandbox: 'trader',
    title: 'Рынок: цена, позиция, результат',
    summary: 'Из чего складывается цена инструмента и почему результат бывает и до продажи.',
    pins: ['stockIndex', 'bondIndex', 'keyRate', 'inflation'],
    steps: [
      {
        title: 'Вы больше не управляете экономикой',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>За инвестора у вас нет ни ставки, ни бюджета: ставку ведёт бот-ЦБ, бюджет — бот-Минфин, а вы живёте внутри их решений. Ваши инструменты — цены, а не рычаги.</p>
            <p>Цены здесь не случайны. Индекс акций считается из прибылей компаний и ставки <Term k="discount">дисконтирования</Term>: дешёвые деньги и растущая прибыль поднимают его, дорогие деньги и риск — опускают. Облигации живут от доходности: выросла доходность — упала цена уже выпущенной бумаги.</p>
            <p>Сейчас индекс акций {fmt1(economy.stockIndex)}, ключевая ставка {pctFmt(economy.keyRate)}. Нажмите «Далее», чтобы посмотреть один квартал со стороны.</p>
          </>
        ),
      },
      {
        kind: 'practice', title: 'Позиция, средняя цена и прибыль',
        goalLabel: 'Открыть любую позицию и завершить квартал',
        body: () => (
          <>
            <p>Купить инструмент — значит открыть <b>позицию</b>. Пока она открыта, её результат называют нереализованным: он меняется каждый квартал вместе с ценой и превращается в деньги только при закрытии.</p>
            <p>Средняя цена входа — та, по которой вы в среднем набрали позицию. Всё, что выше неё, — прибыль; всё, что ниже, — убыток.</p>
            <p>Про это проще один раз увидеть, чем прочитать: выберите любой инструмент в терминале ниже, нажмите «Купить / <Term k="long">лонг</Term>» и завершите квартал. На графике инструмента появится пунктирная линия с подписью <b>«ваша средняя»</b> — это и есть ваша средняя цена входа; по расстоянию до линии цены сразу видно, где вы стоите.</p>
            <p>Есть и обратная сторона: <Term k="short">шорт</Term>. Это ставка на падение — вы продаёте занятый актив, чтобы выкупить его дешевле. Заработать в лонге можно сколько угодно, а потерять — не больше вложенного: ниже нуля цена не падает. В шорте наоборот: заработок ограничен, а убыток растёт вместе с ценой. До бесконечности он, впрочем, не дорастёт — раньше сработает <Term k="margincall">маржин-колл</Term> и закроет позицию принудительно.</p>
          </>
        ),
        levers: [], maxQuarters: 4,
        goal: (c) => Object.values((c.book && c.book.pos) || {}).some((q) => Math.abs(q) > 1e-9),
        goalText: (c) => {
          const open = Object.entries((c.book && c.book.pos) || {}).filter(([, q]) => Math.abs(q) > 1e-9);
          return open.length
            ? `Открыто позиций: ${open.length}. Пунктир «ваша средняя» уже на графике выбранного инструмента.`
            : 'Открытых позиций пока нет — купите что-нибудь в терминале ниже.';
        },
        hint: 'Любой инструмент подойдёт: кнопка «Купить / лонг» под карточкой, сумма сделки задаётся ползунком ниже. После покупки посмотрите на график — пунктир с подписью «ваша средняя» и есть ваша средняя цена входа.',
      },
    ],
  },
  {
    id: 'tr_leverage', depth: 'deep', icon: Zap, sandbox: 'trader',
    title: 'Плечо, обеспечение и маржин-колл',
    summary: 'Почему заёмные деньги увеличивают не доход, а размер ошибки.',
    pins: ['stockIndex', 'volatilityIndex', 'keyRate', 'lendingRate'],
    steps: [
      {
        title: 'Что такое плечо',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Плечо — это торговля на заёмные деньги. Купив на 3 млн при своих 1 млн, вы получаете втрое больший результат и от роста, и от падения: <Term k="leverage">плечо</Term> умножает не доход, а размер вашей ошибки.</p>
            <p>За заёмные деньги брокер берёт ставку по кредитам — сейчас {pctFmt(economy.lendingRate)} годовых. Она капает каждый квартал независимо от того, права позиция или нет.</p>
            <p>Уровень обеспечения — это ваш капитал, делённый на стоимость позиций. Пока он выше поддерживающего уровня, всё в порядке. Как только он падает ниже — брокер закрывает часть позиций сам, по рынку, не спрашивая вас. Это и есть <Term k="margincall">маржин-колл</Term>.</p>
          </>
        ),
      },
      {
        title: 'Фьючерсы: плечо, встроенное в инструмент',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>У <Term k="futures">фьючерса</Term> плечо не нужно брать отдельно — оно уже внутри. Вы вносите гарантийное обеспечение, а результат считается от полного номинала контракта: при плече 8:1 движение цены на 3% меняет ваши деньги на 24%.</p>
            <p>Поэтому в списке инструментов у фьючерсов подписано «плечо N:1»: это не реклама доходности, а предупреждение о том, во сколько раз быстрее закончится ваш счёт.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'tr_portfolio', depth: 'deep', icon: Scale, sandbox: 'trader',
    title: 'Портфель: диверсификация и бенчмарк',
    summary: 'Зачем держать несколько разных активов и с чем сравнивать свой результат.',
    pins: ['stockIndex', 'bondIndex', 'exchangeRate', 'inflation'],
    steps: [
      {
        title: 'Активы ведут себя по-разному',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Смысл диверсификации не в том, чтобы купить побольше разного, а в том, чтобы держать активы, которые реагируют на одно и то же событие по-разному.</p>
            <p>Повышение ставки бьёт по акциям и по длинным облигациям одновременно — они не диверсифицируют друг друга. А вот денежный рынок на повышении ставки, наоборот, начинает приносить больше, инфляционные линкеры защищают от роста цен, мировые акции живут чужим циклом, а золото дорожает при девальвации.</p>
          </>
        ),
      },
      {
        title: 'С чем сравнивать результат',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>«Заработал 8% за год» само по себе ничего не значит. Если индекс за это время вырос на 15% — вы отстали от рынка, и проще было купить индекс целиком. Если инфляция была 12% — вы потеряли покупательную способность, несмотря на плюс на счёте.</p>
            <p>Поэтому в панели портфеля результат показан сразу тремя способами: номинальный, реальный (за вычетом инфляции) и относительно индекса. На графике инструмента индекс можно наложить прямо поверх цены — расхождение линий и есть ваше опережение или отставание.</p>
          </>
        ),
      },
    ],
  },
];

/* ============================ КУРС ПРЕЗИДЕНТА ============================ */
const PRESIDENT_MODULES = [
  {
    id: 'pr_capital', depth: 'surface', icon: Crown, sandbox: 'president',
    title: 'Политический капитал и кадры',
    summary: 'Власть без ползунков: чем президент платит и через кого действует.',
    pins: ['politicalCapital', 'approval', 'politicalTension', 'keyRate'],
    steps: [
      {
        title: 'У президента нет ни одного ползунка',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Ни ставки, ни налогов, ни расходов: ЦБ и Минфин ведут боты со своими характерами. Вы влияете на экономику только через людей, которых назначаете, указания, которые они могут не выполнить, и реформы, которые окупятся не в этот срок.</p>
            <p>Единственный ваш ресурс — <Term k="polcapital">политический капитал</Term>, сейчас {Math.round(economy.politicalCapital)} из 100. Он копится рейтингом и ростом, тает в кризисах и при беспорядках, и у него есть равновесие: накопить на одну большую реформу можно, на все сразу — нет.</p>
          </>
        ),
      },
      {
        title: 'Кадры и указания',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Назначение — самый медленный и самый долгий по эффекту инструмент: характер главы ЦБ определяет реакцию на инфляцию на годы вперёд, характер министра финансов — на что и в каком объёме тратится бюджет.</p>
            <p>У смены главы ЦБ есть отдельная цена. Чем меньше человек проработал, тем сильнее досрочная отставка бьёт по доверию к денежной политике и по премии за риск: рынок читает её однозначно — независимость центрального банка заканчивается там, где начинается администрация.</p>
            <p>Указание — быстрый инструмент, но ведомство может отказать. Шанс зависит от того, насколько просьба соответствует ситуации, от характера руководителя и от политического режима: чем меньше в стране институтов, тем меньше у ведомства возможности сказать «нет» — и тем дешевле рынок оценивает его подпись.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'pr_reforms', depth: 'deep', icon: Hammer, sandbox: 'president',
    title: 'Реформы: платить сейчас, получать потом',
    summary: 'Единственные решения в игре, которые двигают потенциал, а не спрос.',
    pins: ['potentialGrowth', 'approval', 'politicalCapital', 'gdp'],
    steps: [
      {
        title: 'Спрос и потенциал — разные вещи',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Всё, чем занимаются ЦБ и Минфин, — это управление спросом: ставка и бюджет решают, насколько загружена экономика относительно своих возможностей. Сами возможности — потенциальный ВВП — от них почти не зависят.</p>
            <p>Потенциал определяется четырьмя вещами: капиталом, рабочей силой, человеческим капиталом и производительностью. Двигать их умеют только структурные реформы, и это единственный способ сделать страну богаче, а не просто разогнать её на пару лет.</p>
          </>
        ),
      },
      {
        title: 'Горизонт и цена',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>У каждой реформы одинаковая форма: рейтинг платится сразу и целиком, эффект приходит годами. Реформа рынка труда разворачивается два года, пенсионная — три, реформа образования — четыре, и полный эффект пенсионной вы увидите уже в следующий срок, возможно, не свой.</p>
            <p>Отсюда главный конфликт роли: реформа, которая нужнее всего, обычно и самая непопулярная, а расплачиваться за неё рейтингом придётся до ближайших выборов. Нацпроект по инфраструктуре — исключение: он платит не политическим капиталом, а бюджетом, и потому виден быстрее.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'pr_regime', depth: 'deep', icon: Gavel, sandbox: 'president',
    title: 'Устройство власти и её цена',
    summary: 'Роспуск парламента, авторитарный поворот и что за это платит экономика.',
    pins: ['politicalTension', 'approval', 'riskPremium', 'politicalCapital'],
    steps: [
      {
        title: 'Лестница режимов',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Режим меняется не по вашему желанию, а по накопленному напряжению: демократия → конфликт ветвей власти → авторитаризм → тоталитаризм. Напряжение растёт от низкого рейтинга, кризисов, безработицы и инфляции — и, отдельно, от самих репрессий.</p>
            <p>Но президент может пройти по этой лестнице и сознательно: распустить парламент указом. Тогда режим становится авторитарным сразу, и — в отличие от чрезвычайного положения, введённого кризисом, — обратно сам уже не отыграется. Вернуть парламент можно только отдельным решением, и стоит оно дороже.</p>
          </>
        ),
      },
      {
        title: 'За что платит экономика',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Концентрация власти реально работает: политического капитала становится больше, ведомства перестают отказывать, выборы больше не проигрываются. Всё это — настоящие преимущества, и именно поэтому соблазн существует.</p>
            <p>Платит за них экономика, и по всем каналам сразу: <Term k="riskpremium">премия за риск</Term> растёт, доверие бизнеса падает, капитал уходит, прямые инвестиции сокращаются. А напряжение никуда не девается — репрессии его копят, и подавленный протест возвращается больше, чем был.</p>
          </>
        ),
      },
    ],
  },
];

/* Проверки курсов инвестора и президента. Практика здесь идёт не через ползунки,
   а через настоящий терминал и настоящую панель политического капитала — поэтому
   levers у этих задач пустой, а работа делается в самой песочнице. */
const COURSE_CHECKS = {
  tr_market: {
    quiz: {
      kind: 'quiz', title: 'Тест: цена и позиция',
      questions: [
        q('Центральный банк резко поднял ставку. Что произойдёт с индексом акций?',
          ['Скорее всего упадёт: будущие прибыли дисконтируются дороже',
            'Вырастет: высокая ставка — признак сильной экономики',
            'Не изменится: ставка влияет только на облигации',
            'Вырастет ровно на величину повышения ставки'], 0,
          'Цена акции — это будущие прибыли, приведённые к сегодняшнему дню. Чем выше ставка дисконтирования, тем меньше сегодня стоит та же самая будущая прибыль, поэтому индекс падает даже без изменения самих прибылей.'),
        q('Доходность облигаций выросла. Что стало с ценой уже выпущенной бумаги?',
          ['Упала', 'Выросла', 'Не изменилась', 'Зависит от инфляции, а не от доходности'], 0,
          'Купон у выпущенной бумаги фиксированный. Чтобы её доходность сравнялась с новой рыночной, цена должна упасть — и тем сильнее, чем длиннее бумага. Это и называется дюрацией.'),
        q('Что такое нереализованная прибыль по позиции?',
          ['Результат открытой позиции: он меняется каждый квартал и станет деньгами только при закрытии',
            'Прибыль, которую брокер удерживает до конца года',
            'Разница между вашей средней ценой и ценой покупки',
            'Прибыль от коротких позиций'], 0,
          'Пока позиция открыта, её результат — это переоценка, а не деньги. Он растёт и падает вместе с ценой, и зафиксировать его можно только сделкой в обратную сторону.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: обогнать безрисковую ставку',
      goalLabel: 'Прирост капитала не меньше 10% за шесть кварталов',
      body: ({ ctx }) => (
        <>
          <p>У вас {fmtMln(ctx.startValue)} и шесть кварталов. Задача — вырасти минимум на 10%.</p>
          <p>Просто пересидеть в деньгах не выйдет: денежный рынок и депозит дадут заметно меньше. Придётся выбрать, каким риском вы за эту разницу платите, — и терминал ниже настоящий, со всеми инструментами сразу.</p>
        </>
      ),
      levers: [], maxQuarters: 6,
      goal: (c) => c.value >= c.startValue * 1.10,
      goalText: (c) => `Сейчас капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} на старте — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%.`,
      hint: 'Посмотрите, что делает бот-ЦБ со ставкой: от неё зависит и денежный рынок, и облигации, и акции. Если ставка идёт вниз — выигрывают длинные облигации и акции; если вверх — денежный рынок и короткие бумаги. Плечо доступно, но и убыток оно множит на ту же величину.',
    },
  },

  tr_leverage: {
    quiz: {
      kind: 'quiz', title: 'Тест: плечо и обеспечение',
      questions: [
        q('Вы купили на 4 млн, имея 1 млн своих. Цена упала на 10%. Сколько вы потеряли от своего капитала?',
          ['40%', '10%', '4%', 'Ничего, пока позиция не закрыта'], 0,
          'Плечо 4:1 умножает движение цены на четыре. Падение на 10% от четырёх миллионов — это 0.4 млн, то есть 40% вашего собственного миллиона. Именно так позиции и заканчиваются раньше, чем рынок разворачивается.'),
        q('Что такое маржин-колл?',
          ['Брокер сам закрывает часть позиций, когда обеспечения перестаёт хватать',
            'Требование брокера продать всё до конца дня',
            'Комиссия за использование заёмных средств',
            'Автоматическое увеличение плеча при росте цены'], 0,
          'Это не предупреждение, а действие: закрытие происходит по рынку и в худший момент — когда цена уже упала. Поэтому уровень обеспечения смотрят до сделки, а не после.'),
        q('Чем фьючерс отличается от покупки актива с плечом?',
          ['Плечо в него уже встроено: вы вносите обеспечение, а результат считается от полного номинала',
            'Фьючерс нельзя потерять целиком', 'У фьючерса нет расчётов по кварталам',
            'Фьючерс не зависит от цены базового актива'], 0,
          'Экономически это то же плечо, только оформленное иначе. Разница практическая: у фьючерса плечо фиксированное и указано прямо в инструменте, так что «случайно» набрать его больше, чем собирались, сложнее.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: заработать на падающем рынке',
      goalLabel: 'Прирост не меньше 4% за шесть кварталов на падающем рынке',
      body: () => (
        <>
          <p>Ставка высокая и останется высокой, инфляция двузначная, акции уже упали и падать им есть куда. Цель скромная — плюс 4% — и в этом весь смысл: на таком рынке сохранить капитал уже работа.</p>
          <p>Просто сидеть в деньгах не выйдет: они не приносят ничего. Плечо в лонге здесь — самый быстрый способ закончить партию, зато есть инструменты, которым высокая ставка идёт на пользу.</p>
        </>
      ),
      setup: (e) => ({ keyRate: 12, inflation: 11.5, coreInflation: 10.5, inflationExpectations: 9,
        stockIndex: e.stockIndex * 0.92, riskPremium: 3.0, volatilityIndex: 34 }),
      levers: [], maxQuarters: 6,
      goal: (c) => c.value >= c.startValue * 1.04,
      goalText: (c) => `Капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} на старте — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%.`,
      hint: 'Денежный рынок при ставке 12% приносит примерно 3% за квартал и ничем не рискует. Инфляционные линкеры индексируются на сами цены. Короткие облигации почти не реагируют на движение ставки — в отличие от десятилетних.',
    },
  },

  tr_portfolio: {
    quiz: {
      kind: 'quiz', title: 'Тест: портфель и бенчмарк',
      questions: [
        q('Какая пара активов хуже всего диверсифицирует друг друга?',
          ['Акции и длинные облигации', 'Акции и денежный рынок',
            'Акции и инфляционные линкеры', 'Акции и мировые акции'], 0,
          'И акции, и длинные облигации падают от одного и того же — от роста ставки. Держать их вместе — значит дважды поставить на одно событие, хотя выглядит это как два разных инструмента.'),
        q('Ваш портфель вырос на 9% за год, индекс акций — на 14%, инфляция составила 11%. Как честно описать результат?',
          ['Вы отстали от рынка и потеряли покупательную способность',
            'Вы заработали 9% — это хороший результат', 'Вы обогнали рынок на 9%',
            'Реальный результат +9%, номинальный +14%'], 0,
          'Плюс на счёте не означает прибыли. Относительно индекса вы отстали на 5 п.п., а относительно цен потеряли около 2%: на те же деньги в конце года можно купить меньше, чем в начале.'),
        q('Зачем накладывать индекс на график инструмента?',
          ['Чтобы увидеть, обгоняет ваш инструмент рынок или просто едет вместе с ним',
            'Чтобы предсказать будущую цену', 'Чтобы уменьшить комиссию',
            'Чтобы посчитать уровень обеспечения'], 0,
          'Индекс приводится к стартовой цене инструмента, поэтому важно не то, где проходит его линия, а как она расходится с вашей. Совпали — вы просто купили рынок. Разошлись — вот это и есть ваш собственный результат.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: обогнать индекс',
      goalLabel: 'Портфель растёт быстрее индекса акций и не в минусе',
      body: () => (
        <>
          <p>Экономика на подъёме, ставка ниже нейтральной, спрос растёт — индекс акций в таких условиях сам по себе прибавит заметно за восемь кварталов. Купить сам индекс — доступно всем, и результат будет ровно такой же, как у рынка. Задача — обогнать его, а не просто оказаться в плюсе: на растущем рынке в плюс выйдет почти любая позиция, а вот обогнать сам рынок — уже вопрос выбора.</p>
          <p>Восемь кварталов. Побеждает не тот, кто угадал направление (тут его несложно угадать), а тот, кто держал то, что в этих условиях растёт быстрее широкого индекса.</p>
        </>
      ),
      // экономика на подъёме: индекс акций сам по себе прибавит около 20% за
      // восемь кварталов — просто пересидеть в безрисковых инструментах (денежный
      // рынок при такой ставке даёт не больше 8-10%) этот рубеж не возьмёт, и
      // «купить что угодно» перестаёт быть решением
      setup: (e) => ({ keyRate: 4, inflation: 3.4, coreInflation: 3.3, inflationExpectations: 3.6,
        outputGap: 1.6, businessConfidence: 64, riskPremium: 0.8, unemployment: Math.min(e.unemployment, e.nairu - 0.5) }),
      levers: [], maxQuarters: 8,
      goal: (c) => c.value > c.startValue
        && c.value / Math.max(0.001, c.startValue) >= c.economy.stockIndex / Math.max(0.001, c.start.stockIndex),
      goalText: (c) => `Портфель ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%, индекс ${fmtSigned1((c.economy.stockIndex / Math.max(0.001, c.start.stockIndex) - 1) * 100)}% за то же время.`,
      hint: 'Обогнать индекс на растущем рынке можно плечом на самом индексе или на отдельном секторе, который растёт быстрее рынка, — но тогда вы обгоните его и вниз, если подъём развернётся. Надёжнее — искать то, что в буме растёт сильнее широкого рынка: секторные фонды на пике цикла, мировые акции при крепнущей валюте.',
    },
  },

  pr_capital: {
    quiz: {
      kind: 'quiz', title: 'Тест: капитал, кадры, указания',
      questions: [
        q('Откуда у президента берётся политический капитал?',
          ['Он копится от рейтинга и роста экономики и тает в кризисах',
            'Он выдаётся фиксированной суммой раз в год', 'Он покупается за бюджетные деньги',
            'Он равен рейтингу власти'], 0,
          'Капитал — это следствие того, как идут дела: популярного президента в растущей экономике власть кормит сама. Отсюда и главная ловушка роли: когда рычаги нужнее всего, платить за них уже нечем.'),
        q('Президент меняет главу ЦБ, проработавшего два квартала из двенадцати. Что произойдёт?',
          ['Доверие к денежной политике заметно упадёт, премия за риск вырастет',
            'Ничего: назначение — обычная процедура', 'Вырастет согласованность политики',
            'Инфляция немедленно снизится'], 0,
          'Дело не в том, кто пришёл, а в том, как ушёл предыдущий. Досрочная отставка показывает рынку, что срок главы ЦБ ничего не значит, — и ожидания перестают верить его обещаниям, кто бы их ни давал.'),
        q('При каком режиме ведомство с наименьшей вероятностью откажет президенту?',
          ['При тоталитарном', 'При демократии', 'При конфликте ветвей власти',
            'Вероятность отказа от режима не зависит'], 0,
          'Возможность сказать «нет» — это и есть институт. Чем меньше институтов, тем послушнее ведомство и тем меньше стоит его подпись: рынок дисконтирует решения управляемого центробанка независимо от их содержания.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: сбить инфляцию чужими руками',
      pins: ['inflation', 'inflationExpectations', 'keyRate', 'politicalCapital'],
      goalLabel: 'Инфляция ≤ 6.3% — но ставку задаёте не вы',
      body: () => (
        <>
          <p>Инфляция под 10%, а во главе ЦБ сидит Голубь: он терпит рост цен ради занятости и ставку поднимать не спешит. Ключевой ставки у вас нет — есть кадры и указания.</p>
          <p>Шесть кварталов. Оба инструмента стоят политического капитала, и у каждого свои последствия помимо инфляции.</p>
        </>
      ),
      setup: () => ({ inflation: 9.8, coreInflation: 9.2, inflationExpectations: 8.2, keyRate: 5.5, cbTenure: 11 }),
      personas: { cb: 'dove' },
      levers: [], maxQuarters: 6,
      goal: (c) => shown1(c.economy.inflation) <= 6.3,
      goalText: (c) => `Инфляция ${pctFmt(c.economy.inflation)}, ставка ${pctFmt(c.economy.keyRate)}, ожидания ${pctFmt(c.economy.inflationExpectations)}.`,
      hint: 'Глава ЦБ отработал одиннадцать кварталов из двенадцати — смена почти плановая и обойдётся дёшево. Ястреб реагирует на инфляцию вдвое жёстче Голубя. Есть и быстрый путь — указание «решительно подавить инфляцию», но Голубь на него скорее всего ответит отказом.',
    },
  },

  pr_reforms: {
    quiz: {
      kind: 'quiz', title: 'Тест: реформы и горизонт',
      questions: [
        q('Чем структурная реформа отличается от снижения ставки?',
          ['Реформа двигает потенциал экономики, ставка — только загрузку имеющегося',
            'Реформа действует быстрее', 'Реформа не требует политического капитала',
            'Ставка влияет на потенциал, а реформа — на спрос'], 0,
          'Ставка и бюджет решают, работает ли экономика ниже или выше своих возможностей. Сами возможности — капитал, рабочая сила, человеческий капитал, производительность — меняются только реформами.'),
        q('Почему пенсионная реформа — самое дорогое решение в наборе?',
          ['Рейтинг падает сразу и целиком, а эффект приходит через три года',
            'Она стоит больше всего бюджетных денег', 'Она снижает потенциальный ВВП',
            'Она требует роспуска парламента'], 0,
          'Форма у всех реформ одна: платите сегодня, получаете потом. У пенсионной этот разрыв максимальный — и по величине удара по рейтингу, и по длине горизонта, на котором окупается расширение рабочей силы.'),
        q('Чем национальный проект по инфраструктуре отличается от остальных реформ?',
          ['За него платит бюджет — дефицитом и долгом, а не политический капитал',
            'Он не влияет на потенциал', 'Он действует мгновенно',
            'Его нельзя провести дважды'], 0,
          'Указ обязывает Минфин ускорить реальные госинвестиции на несколько лет. Инфраструктура и потенциал растут — вместе с дефицитом и долгом, считать который будет уже не президент.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: реформировать и удержаться',
      goalLabel: 'Две реформы за восемь кварталов при рейтинге ≥ 42',
      body: () => (
        <>
          <p>Провести реформу легко — сложно провести её и остаться у власти. Задача: объявить минимум две структурные реформы за восемь кварталов и подойти к концу с рейтингом не ниже 42.</p>
          <p>Капитала на всё сразу не хватит, и после непопулярной реформы рейтинг придётся чем-то чинить.</p>
        </>
      ),
      levers: [], maxQuarters: 8,
      goal: (c) => Object.keys(c.economy.reforms || {}).length >= 2 && shown0(c.economy.approval) >= 42,
      goalText: (c) => `Проведено реформ: ${Object.keys(c.economy.reforms || {}).length}. Рейтинг ${Math.round(c.economy.approval)}, капитал ${Math.round(c.economy.politicalCapital)}.`,
      hint: 'Начните с дешёвых и не самых болезненных: дерегулирование и судебная реформа стоят меньше и по рейтингу почти не бьют. Обращение к нации восстанавливает поддержку быстро — но работает тем хуже, чем сильнее слова расходятся с ценами.',
    },
  },

  pr_regime: {
    quiz: {
      kind: 'quiz', title: 'Тест: режим и его цена',
      questions: [
        q('Президент распустил парламент указом при спокойной экономике. Что будет дальше?',
          ['Режим станет авторитарным и сам обратно не вернётся',
            'Ничего не изменится, пока не вырастет напряжение',
            'Режим станет авторитарным на два квартала и вернётся',
            'Начнётся тоталитарный режим'], 0,
          'Чрезвычайное положение, введённое в кризис, снимается, когда кризис проходит. Осознанный роспуск — другое: власть, взятая указом, отдаётся только таким же указом, и стоит это дороже.'),
        q('Что происходит с политическим напряжением при авторитарном режиме?',
          ['У него появляется собственная подпитка: репрессии сами добавляют напряжения',
            'Оно перестаёт расти', 'Оно обнуляется при роспуске парламента',
            'Оно зависит только от инфляции'], 0,
          'Подавление убирает проявления недовольства, а не его причины. В модели у репрессивного режима есть постоянное слагаемое в напряжении — поэтому авторитаризм устойчив ровно до тех пор, пока экономика позволяет.'),
        q('Чем экономика расплачивается за концентрацию власти?',
          ['Премией за риск, доверием бизнеса, оттоком капитала и прямых инвестиций',
            'Только инфляцией', 'Ничем: это чисто политическое решение',
            'Ростом безработицы в первый же квартал'], 0,
          'Издержки идут не одним каналом, а сразу всеми и не мгновенно. Именно поэтому размен выглядит выгодным в квартале, когда его совершают, и невыгодным через несколько лет.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: удержать страну, не распуская парламент',
      goalLabel: 'Напряжение ≤ 15 при работающем парламенте',
      body: () => (
        <>
          <p>Напряжение почти на пороге конфликта ветвей власти, рейтинг низкий, элиты нервничают. Самый быстрый выход — указ о роспуске парламента, и он вам доступен.</p>
          <p>Задача в том, чтобы обойтись без него: снять напряжение до 15 за шесть кварталов, сохранив парламент. Если распустите — задача считается проваленной.</p>
          <p>Само оно так низко не опустится: напряжение тянется к уровню, который задают рейтинг и экономика, а он сейчас куда выше пятнадцати. Придётся либо поднимать рейтинг, либо снимать напряжение напрямую.</p>
        </>
      ),
      setup: () => ({ politicalTension: 58, approval: 36, unemployment: 7.4, inflation: 8.4, coreInflation: 7.8 }),
      levers: [], maxQuarters: 6,
      goal: (c) => shown0(c.economy.politicalTension) <= 15 && !c.economy.parliamentDissolved && c.economy.politicalRegime !== 'authoritarian',
      goalText: (c) => `Напряжение ${Math.round(c.economy.politicalTension)}, рейтинг ${Math.round(c.economy.approval)}, режим — ${(POLITICAL_REGIME_INFO[c.economy.politicalRegime] || {}).label || c.economy.politicalRegime}.`,
      hint: 'Напряжение считается от рейтинга, кризисов, безработицы и инфляции — то есть чинится тем же, чем чинится экономика. Сделка с элитами снимает его быстро и прямо; силовое подавление — тоже, но потом возвращает больше, чем сняло.',
    },
  },
};

/* ============================ ЭКЗАМЕНЫ ============================
   Экзамен — это отдельный модуль в конце курса: сначала теория по всему
   пройденному, потом одна задача, где взаимодействуют сразу несколько
   механизмов и однозначно правильного рычага уже нет. */
const EXAM_MODULES = [
  {
    id: 'policy_exam', depth: 'deep', icon: GraduationCap, isExam: true,
    title: 'Экзамен: экономическая политика',
    summary: 'Шесть вопросов по всему курсу и стагфляция напоследок.',
    pins: ['inflation', 'unemployment', 'gdpGrowth', 'debtToGdp'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Шесть вопросов по всем шести модулям сразу, а после них — задача, в которой ни один рычаг не работает в одну сторону.</p>
            <p>Как и в тестах модулей, ошибиться не страшно: разбор появится под каждым вопросом, а задачу можно перезапустить.</p>
          </>
        ),
      },
      {
        kind: 'quiz', title: 'Теория: весь курс',
        questions: [
          q('Экономика перегрета, инфляция 9%, бюджет в дефиците 6% ВВП. Какая пара решений последовательна?',
            ['Поднять ставку и сократить темп госрасходов',
              'Снизить ставку и нарастить выплаты',
              'Поднять ставку и одновременно нарастить госрасходы',
              'Ничего не делать: перегрев проходит сам'], 0,
            'При перегреве обе ветви политики должны тянуть в одну сторону. Если бюджет продолжает подогревать спрос, ЦБ придётся держать ставку выше — и за несогласованность заплатит выпуск.'),
          q('Что произойдёт с ценой десятилетней облигации, если ЦБ резко поднимет ставку?',
            ['Упадёт сильнее, чем цена двухлетней', 'Вырастет', 'Упадёт слабее, чем цена двухлетней',
              'Не изменится: длинные бумаги от ставки не зависят'], 0,
            'Чем длиннее бумага, тем сильнее её цена реагирует на изменение доходности. Это и есть дюрация — и именно поэтому в ожидании роста ставок уходят в короткие бумаги.'),
          q('Инфляционные ожидания 9% при цели 4%. Почему это дороже, чем просто высокая инфляция?',
            ['Ожидания закладываются в цены и зарплаты и делают инфляцию устойчивой',
              'Ожидания напрямую входят в расчёт ВВП',
              'Ожидания увеличивают государственный долг',
              'Ожидания влияют только на курс валюты'], 0,
            'Разовый скачок цен проходит сам. Сорванные ожидания превращают его в самоподдерживающийся процесс: чтобы его остановить, ставку приходится держать выше и дольше, а платит за это выпуск.'),
          q('Резервы тают, а курс продолжает слабеть. Что это чаще всего означает?',
            ['Защита курса одними интервенциями не работает: рынок видит конечность резервов',
              'Интервенции проводятся в неверную сторону',
              'Нужно ускорить продажу резервов', 'Курс скоро развернётся сам'], 0,
            'Интервенции работают, пока рынок верит, что резервов хватит. Как только видно дно, тающие резервы сами становятся аргументом против валюты — и премия за риск добавляет к девальвации больше, чем снимают интервенции.'),
          q('Банковский риск 70, ликвидность банков 35. Что делать в первую очередь?',
            ['Дать ликвидность: это скорая помощь, которая действует сразу',
              'Резко поднять норматив капитала', 'Поднять ключевую ставку',
              'Сократить государственные расходы'], 0,
            'Норматив капитала — профилактика на годы, и в разгар стресса он только заставляет банки сжимать кредит. Ликвидность закрывает разрыв платежей здесь и сейчас; укреплять буферы будете, когда система перестанет гореть.'),
          q('Рейтинг власти третий год ниже 35, инфляция двузначная, идут протесты. Что говорит модель?',
            ['Политическое напряжение растёт, и режим может сойти с демократической ветки',
              'Ничего: рейтинг влияет только на исход выборов',
              'Экономика автоматически стабилизируется',
              'Центральный банк потеряет независимость по закону'], 0,
            'Рейтинг — не только счётчик к выборам. Через политическое напряжение он выводит страну на лестницу режимов: конфликт ветвей власти, авторитаризм, тоталитаризм — и каждый шаг оплачивается премией за риск и оттоком капитала.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: стагфляция',
        pins: ['inflation', 'unemployment', 'outputGap', 'gdpGrowth'],
        goalLabel: 'Инфляция ≤ 6.5% и безработица ≤ 6.5% одновременно',
        body: () => (
          <>
            <p>Худшее сочетание из возможных: цены растут, а экономика при этом стоит. Ставка лечит одно и калечит другое, бюджет — ровно наоборот.</p>
            <p>Десять кварталов и четыре рычага. Однозначно правильного ответа здесь нет — есть последовательность, в которой рычаги применяют.</p>
          </>
        ),
        setup: (e) => ({ inflation: 11.4, coreInflation: 10.6, inflationExpectations: 8.6, unemployment: 7.8,
          gdp: e.potentialGdp * 0.972, keyRate: 7, cbCredibility: 42 }),
        levers: ['keyRate', 'govSpending', 'transfers', 'vatRate'], maxQuarters: 10,
        goal: (c) => shown1(c.economy.inflation) <= 6.5 && shown1(c.economy.unemployment) <= 6.5,
        goalText: (c) => `Инфляция ${pctFmt(c.economy.inflation)}, безработица ${pctFmt(c.economy.unemployment)}, разрыв выпуска ${fmtSignedPct(c.economy.outputGap)}.`,
        hint: 'Сначала цены, потом занятость: пока ожидания высоко, любой бюджетный стимул уходит в инфляцию, а не в выпуск. Сбейте инфляцию жёсткой ставкой, а когда ожидания опустятся — отпускайте её и поддерживайте спрос бюджетом.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли курс целиком: ставка и расходы, бюджет и долг, курс и резервы, ожидания и доверие, риски и буферы, политический режим — и свели всё это вместе в одной задаче без правильного ответа.</p>
            <p>Дальше два прикладных курса: за частного инвестора и за президента. Или сразу настоящая партия — там всё перечисленное работает одновременно.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'tr_exam', depth: 'deep', icon: GraduationCap, isExam: true, sandbox: 'trader',
    title: 'Экзамен: частный инвестор',
    summary: 'Теория по трём модулям и портфель на развороте ставки.',
    pins: ['stockIndex', 'bondIndex', 'keyRate', 'inflation'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => <p>Четыре вопроса и одна задача. В задаче важно не угадать направление рынка, а понять, какие инструменты в этих условиях работают.</p>,
      },
      {
        kind: 'quiz', title: 'Теория: рынок, плечо, портфель',
        questions: [
          q('Ставка идёт вниз третий квартал подряд. Какой инструмент выигрывает больше всех?',
            ['Длинные облигации', 'Денежный рынок', 'Короткие облигации', 'Депозит'], 0,
            'Чем длиннее бумага, тем сильнее растёт её цена при снижении доходности. Денежный рынок и депозит, наоборот, начинают приносить меньше — они живут текущей ставкой, а не переоценкой.'),
          q('Инфляция 14%, ваш портфель за год вырос на 9%. Что произошло с вашими деньгами?',
            ['Покупательная способность упала примерно на 4%',
              'Вы заработали 9%', 'Вы заработали 23%', 'Ничего не изменилось'], 0,
            'Реальный результат — это номинальный за вычетом инфляции. Плюс на счёте и прибыль — разные вещи, и различать их важнее всего именно в те годы, когда цены растут быстрее всего.'),
          q('Уровень обеспечения 135% при поддерживающем 120%. Что это значит?',
            ['Падение позиций примерно на 11% приведёт к принудительному закрытию',
              'У вас нет заёмных средств', 'Брокер закроет позиции прямо сейчас',
              'Можно безопасно увеличить плечо вдвое'], 0,
            'Запас до маржин-колла считается от текущего уровня к поддерживающему. Пятнадцать пунктов запаса при высокой волатильности — это одно неудачное движение рынка, а не комфортная подушка.'),
          q('Что защищает портфель от девальвации национальной валюты?',
            ['Золото и мировые акции', 'Длинные государственные облигации',
              'Депозит в национальной валюте', 'Акции банков'], 0,
            'Активы, чья цена выражена в чужой валюте или в сырье, при ослаблении национальной валюты дорожают в местных деньгах. Депозит и облигации в национальной валюте, наоборот, обесцениваются вместе с ней.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: разворот ставки',
        goalLabel: 'Прирост капитала не меньше 12% за восемь кварталов',
        body: () => (
          <>
            <p>Инфляция уже сбита, но ставка ещё высокая: бот-ЦБ будет снижать её по мере того, как ожидания опускаются. Это самый предсказуемый момент рынка — и самый упускаемый.</p>
            <p>Восемь кварталов, цель — плюс 12%. Подумайте, что дорожает, когда ставка идёт вниз, и что перестаёт приносить.</p>
          </>
        ),
        setup: () => ({ keyRate: 12, inflation: 4.6, coreInflation: 4.4, inflationExpectations: 5.0, cbCredibility: 58 }),
        levers: [], maxQuarters: 8,
        goal: (c) => c.value >= c.startValue * 1.12,
        goalText: (c) => `Капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%. Ставка ${pctFmt(c.economy.keyRate)}.`,
        hint: 'Когда инфляция уже у цели, а ставка вдвое выше нейтральной, ЦБ будет смягчать политику. От снижения ставки выигрывают длинные облигации и акции — а денежный рынок с каждым снижением приносит всё меньше.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => <p>Курс инвестора пройден: цена и позиция, плечо и обеспечение, портфель и <Term k="benchmark">бенчмарк</Term>. В настоящей партии добавятся случайные кризисы, опционы и казино — но правила те же.</p>,
      },
    ],
  },
  {
    id: 'pr_exam', depth: 'deep', icon: GraduationCap, isExam: true, sandbox: 'president',
    title: 'Экзамен: президент',
    summary: 'Теория по трём модулям и страна, которую надо вытащить чужими руками.',
    pins: ['politicalCapital', 'approval', 'politicalTension', 'inflation'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => <p>Четыре вопроса и одна задача. В задаче у вас по-прежнему нет ни одного ползунка — только люди, указания и реформы.</p>,
      },
      {
        kind: 'quiz', title: 'Теория: капитал, реформы, режим',
        questions: [
          q('Кризис, беспорядки, рейтинг 25. Что происходит с политическим капиталом?',
            ['Он уходит в минус и быстро обнуляется', 'Он растёт: в кризис власть концентрируется',
              'Он не меняется', 'Он превращается в рейтинг'], 0,
            'В этом и состоит ловушка роли: рычаги отключаются ровно тогда, когда они нужнее всего. Копить капитал имеет смысл до кризиса, а не во время него.'),
          q('Вы хотите поднять потенциальный ВВП. Что для этого нужно?',
            ['Структурная реформа: они единственные двигают потенциал',
              'Указание Минфину нарастить выплаты', 'Снижение ключевой ставки через указание ЦБ',
              'Обращение к нации'], 0,
            'Спрос можно двигать быстро, возможности экономики — нет. Труд, суды, дерегулирование, образование и инфраструктура и есть тот единственный канал, через который страна становится богаче, а не просто загруженнее.'),
          q('ЦБ выполнил ваше указание снизить ставку. Что при этом произошло помимо ставки?',
            ['Доверие к денежной политике снизилось: рынок увидел управляемый центробанк',
              'Выросла согласованность и доверие', 'Ничего: указание — обычная процедура',
              'Политическое напряжение выросло'], 0,
            'Цена управляемости — сама управляемость. Исполненное политическое указание обесценивает будущие обещания ЦБ, и возвращать ожидания к якорю потом придётся более высокой ставкой, чем понадобилась бы.'),
          q('Что отличает роспуск парламента указом от авторитарного поворота из-за кризиса?',
            ['Указ обратно сам не отыгрывается — власть придётся возвращать отдельным решением',
              'Указ не меняет политический режим', 'Указ не влияет на премию за риск',
              'Указ снижает политическое напряжение навсегда'], 0,
            'Чрезвычайное положение снимают, когда отпадают обстоятельства. Осознанный захват полномочий обстоятельствами не объясняется, и модель это различает: обратный ход возможен только как такое же осознанное решение.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: вытащить страну',
        goalLabel: 'Рейтинг ≥ 48, инфляция ≤ 6.5%, хотя бы одна реформа, парламент работает',
        body: () => (
          <>
            <p>Вам достаётся страна с двузначной инфляцией, высокой безработицей, низким рейтингом и Голубем во главе ЦБ. Десять кварталов.</p>
            <p>Ни ставки, ни бюджета у вас нет. Есть кадры, указания, реформы, публичная политика — и соблазн решить всё указом о роспуске парламента, который здесь считается провалом задачи.</p>
            <p>Вытащить экономику мало: за срок нужно ещё и оставить после себя хотя бы одну проведённую <Term k="reform">структурную реформу</Term>. Разбираться с ценами и при этом тратить капитал на то, что окупится после вас, — и есть работа президента.</p>
          </>
        ),
        setup: () => ({ inflation: 10.4, coreInflation: 9.8, inflationExpectations: 8.4, unemployment: 7.6,
          approval: 34, politicalTension: 44, keyRate: 6, cbTenure: 10, politicalCapital: 60 }),
        personas: { cb: 'dove', mof: 'populist' },
        levers: [], maxQuarters: 10,
        goal: (c) => shown0(c.economy.approval) >= 48 && shown1(c.economy.inflation) <= 6.5
          && Object.keys(c.economy.reforms || {}).length >= 1 && !c.economy.parliamentDissolved,
        goalText: (c) => `Рейтинг ${Math.round(c.economy.approval)}, инфляция ${pctFmt(c.economy.inflation)}, реформ ${Object.keys(c.economy.reforms || {}).length}, капитал ${Math.round(c.economy.politicalCapital)}.`,
        hint: 'Начните с ЦБ: с Голубем инфляцию не сбить, а без этого рейтинг не вырастет — реальные доходы съедаются ценами. Дальше рейтинг чинится тем же, чем чинится экономика, плюс обращением к нации, которое работает тем лучше, чем ближе цифры к обещаниям.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => <p>Курс президента пройден: капитал и кадры, реформы и горизонт, режим и его цена. Осталось попробовать это в настоящей партии — там ещё случайные кризисы, выборы и бот, который вас не слушается.</p>,
      },
    ],
  },
];
/* Задача сверяется с теми же числами, которые видит игрок. Иначе «Рейтинг 48»
   при цели «≥ 48» читается как обман: под округлением там 47.6. */
const shown0 = (v) => Math.round(v);
const shown1 = (v) => Math.round(v * 10) / 10;

const EXAM_BY_ID = {};
EXAM_MODULES.forEach((m) => { EXAM_BY_ID[m.id] = m; });

// вставляем проверки перед финальным шагом каждого модуля
TUTORIAL_MODULES.forEach((m) => {
  const c = MODULE_CHECKS[m.id];
  if (!c) return;
  const fin = m.steps.pop();
  if (c.quiz) m.steps.push(c.quiz);
  if (c.practice) m.steps.push(c.practice);
  m.steps.push(fin);
});
/* Модули курсов инвестора и президента написаны без финального шага: он
   одинаковый по смыслу, поэтому дописывается здесь вместе с проверками. */
[...TRADER_MODULES, ...PRESIDENT_MODULES].forEach((m) => {
  const c = COURSE_CHECKS[m.id];
  if (c && c.quiz) m.steps.push(c.quiz);
  if (c && c.practice) m.steps.push(c.practice);
  m.steps.push({
    title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
    body: () => <p>Теория и практика этого модуля пройдены. Следующий модуль откроется в программе курса.</p>,
  });
});

/* ============================ ПРОГРАММА КУРСОВ ============================ */
const TUTORIAL_COURSES = [
  { id: 'policy', icon: Landmark, title: 'Экономическая политика',
    lede: 'Базовый курс: как ставка, бюджет, курс валюты и ожидания связаны между собой. Семь модулей от поверхностного понимания к углублённому, каждый заканчивается тестом и практической задачей.',
    modules: [...TUTORIAL_MODULES, EXAM_BY_ID.policy_exam] },
  { id: 'trader', icon: TrendingUp, title: 'Частный инвестор',
    lede: 'Прикладной курс для роли трейдера: цена и позиция, плечо и маржин-колл, портфель и бенчмарк. Практика идёт в настоящем терминале, с настоящими котировками и расчётом позиций.',
    modules: [...TRADER_MODULES, EXAM_BY_ID.tr_exam] },
  { id: 'president', icon: Crown, title: 'Президент',
    lede: 'Прикладной курс для роли президента: политический капитал, кадры, указания ведомствам, структурные реформы и цена концентрации власти. Ни одного ползунка — только решения.',
    modules: [...PRESIDENT_MODULES, EXAM_BY_ID.pr_exam] },
];

/* Экран модуля. Три песочницы под три курса: политическая (ползунки ЦБ/Минфина),
   трейдерская (настоящий терминал и расчёт позиций) и президентская (панель
   политического капитала с двумя ботами). Общее у них одно — «Завершить квартал»
   двигает одну и ту же модель, поэтому практика в обучении считается ровно тем же
   кодом, что и настоящая партия, а не отдельной облегчённой имитацией. */
function TutorialModuleScreen({ module, isLastModule, onExit, onComplete, onGoNext, onGoHub, onStartRealGame,
  saved, onSaveProgress, completed }) {
  const sandbox = module.sandbox || 'policy';
  const initEconomy = useMemo(() => makeInitialEconomy(), [module.id]);
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState([{ q: 0, label: `${quarterLabel(1)} (старт)`, ...initEconomy }]);
  const [decisions, setDecisions] = useState(() => defaultDecisions(initEconomy));
  const [pendingImpulses, setPendingImpulses] = useState([]);
  const [eventCooldowns, setEventCooldowns] = useState({});
  const [quarterIndex, setQuarterIndex] = useState(1);
  /* Шаг и пройденные проверки хранятся снаружи: раньше выход «к программе курса»
     на четвёртом шаге из пяти означал проходить модуль заново. Отдельно от step
     живёт maxStep — докуда дошли: назад можно вернуться перечитать теорию, но
     кварталы при этом заново не проигрываются. */
  /* Докуда дошли (maxStep) и где стоим сейчас (step) — это разные величины, и
     наружу надо отдавать обе. Раньше сохранялся только step: стоило на пройденном
     модуле вернуться по содержанию с седьмого шага на четвёртый и выйти — и шаги
     5–7 снова оказывались закрыты. Пройденный модуль открыт целиком независимо от
     того, что лежит в сохранении. */
  const [step, setStep] = useState(() => (saved && (saved.at ?? saved.step)) || 0);
  const [maxStep, setMaxStep] = useState(() => (completed ? module.steps.length - 1
    : Math.max((saved && saved.step) || 0, (saved && saved.at) || 0)));
  const [leverBaseline, setLeverBaseline] = useState(0);
  const [passed, setPassed] = useState(() => (saved && saved.passed) || {});
  const [newsLog, setNewsLog] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  React.useEffect(() => { onSaveProgress(module.id, { step: maxStep, at: step, passed }); },
    [module.id, step, maxStep, passed, onSaveProgress]);
  const [practice, setPractice] = useState(null);
  const [book, setBook] = useState(() => emptyBook());
  const [cbPersonaId, setCbPersonaId] = useState('pragmatic');
  const [mofPersonaId, setMofPersonaId] = useState('technocrat');
  const [presActions, setPresActions] = useState([]);
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  const prevEcon = history.length >= 2 ? history[history.length - 2] : initEconomy;

  // музыка курса реагирует на состояние песочницы так же, как в настоящей партии
  React.useEffect(() => { Audio.setMood(economy); },
    [economy.regime, economy.inflationRisk, economy.bankingRisk, economy.recessionRisk]);

  const cur = module.steps[step];
  const kind = cur.kind || 'read';
  const lever = cur.lever ? LEVERS.find((l) => l.id === cur.lever) : null;
  const delta = lever ? decisions[cur.lever] - leverBaseline : 0;

  const startEconomy = practice ? practice.anchor.economy : initEconomy;
  const startBook = practice ? practice.anchor.book : book;
  const ctx = { economy, history, book, decisions, start: startEconomy, startBook,
    value: bookValue(book, economy, null), startValue: bookValue(startBook, startEconomy, null) };

  /* Вход в практику фиксирует состояние песочницы: не получилось — откатываемся сюда.
     step.setup задаёт исходную ситуацию задачи (перегрев, сорванные ожидания,
     банковский стресс): без него условие задачи зависело бы от того, как именно
     человек прошёл теоретические шаги, и одна и та же задача у разных людей была
     бы то невыполнимой, то уже выполненной. */
  React.useEffect(() => {
    const st = module.steps[step];
    if (st && (st.kind === 'practice')) {
      let eco = economy; let hist = history; let dec = decisions;
      if (st.personas) {
        // характер ведомства — такое же условие задачи, как инфляция или долг:
        // «сбить инфляцию при Голубе во главе ЦБ» без этого было бы не воспроизвести
        if (st.personas.cb) setCbPersonaId(st.personas.cb);
        if (st.personas.mof) setMofPersonaId(st.personas.mof);
      }
      if (st.setup) {
        // setup может быть функцией: часть величин имеет смысл задавать только
        // относительно текущего состояния (долг к ВВП — это доля от номинального
        // ВВП, перегрев — превышение над потенциалом, а не абсолютное число)
        const patch = typeof st.setup === 'function' ? st.setup(economy) : st.setup;
        eco = { ...economy, ...patch };
        hist = [...history.slice(0, -1), { ...history[history.length - 1], ...patch }];
        dec = defaultDecisions(eco, decisions);
        setEconomy(eco); setHistory(hist); setDecisions(dec); setPendingImpulses([]);
        // setup переписывает сценарий (ставка, инфляция и т.д.) заново — новости из
        // предыдущих шагов рассказывали про старое состояние экономики и теперь
        // прямо противоречат тому, что показано на дашборде («ставка 12%» на панели
        // и тут же в ленте «ЦБ сохраняет ставку 5.5%» из шага до setup)
        setNewsLog([]);
      }
      setPractice({ used: 0, anchor: { economy: eco, history: hist, decisions: dec,
        pendingImpulses: st.setup ? [] : pendingImpulses, eventCooldowns, quarterIndex, book } });
    } else setPractice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, module.id]);

  const practicePassed = !!passed[step];
  const practiceFailed = kind === 'practice' && !!practice && !practicePassed && practice.used >= cur.maxQuarters;
  const canAdvance = kind === 'quiz' || kind === 'practice' ? !!passed[step]
    : (!lever || delta >= cur.minDelta - 1e-9);

  // один квартал модели; отличается только тем, кто принимает решения помимо игрока
  const runQuarter = (extraDecisions) => {
    let eff = { ...decisions, ...extraDecisions };
    let cbAction = null; let mofAction = null;
    if (sandbox !== 'policy') {
      cbAction = botCentralBank(economy, cbPersonaId, 'easy');
      mofAction = botFinanceMinistry(economy, mofPersonaId, 'easy');
      eff = { ...eff, ...cbAction.decisions, ...mofAction.decisions };
    }
    /* Указание ведомству в песочнице раньше только выбиралось: разбирал его
       интерфейс настоящей партии, а не курс, — и в обучении оно не делало ровно
       ничего. Теперь считается тем же кодом и с той же силой, которую выставили
       ползунком. */
    let dirResult = null;
    if (sandbox === 'president') {
      eff = { ...eff, presidentActions: presActions, appointCb: presAppointCb, appointMof: presAppointMof };
      if (presDirective) {
        dirResult = processPresidentialDirective(presDirective, economy, cbPersonaId, mofPersonaId, eff, presDirStrength);
        if (dirResult) {
          eff = { ...dirResult.decisions, presidentActions: presActions,
            appointCb: presAppointCb, appointMof: presAppointMof, presidentExtraSpend: PRES_DIRECTIVE_COST };
          if (dirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
          else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
        }
      }
    }
    const result = simulateQuarter({
      economy, decisions: eff, pendingImpulses, eventCooldowns,
      difficulty: 'easy', quarterIndex, stories: [],
      botAction: cbAction, botActions: mofAction ? [mofAction] : [], noEvents: true,
    });
    if (dirResult) {
      result.newsEntries.unshift({ id: `dir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex,
        headline: `ПРЕЗИДЕНТ → ${dirResult.toCb ? 'ЦБ' : 'МИНФИН'}: ${dirResult.req.label.toUpperCase()} — ${dirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : dirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${dirResult.ask}» ${dirResult.text}` });
    }
    const newHistory = [...history, { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy }];
    const newDecisions = defaultDecisions(result.economy, decisions);
    let newBook = book;
    if (sandbox === 'trader') {
      const withBench = book.benchStart ? book : { ...book, benchStart: { stockIndex: economy.stockIndex,
        bondIndex: economy.bondIndex, depositIndex: economy.depositIndex, priceLevel: economy.priceLevel } };
      newBook = settleQuarter(withBench, result.economy);
      setBook(newBook);
    }
    if (sandbox === 'president') {
      if (presAppointCb) setCbPersonaId(presAppointCb);
      if (presAppointMof) setMofPersonaId(presAppointMof);
      setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1);
    }
    setEconomy(result.economy);
    setHistory(newHistory);
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setQuarterIndex((q) => q + 1);
    setDecisions(newDecisions);
    // без ленты новостей в песочнице непонятно, что вообще произошло за квартал —
    // согласился ли ЦБ, сработал ли указ, что случилось с ценами
    /* Новости копятся: раньше лента показывала только последний квартал, и
       вернуться к тому, что было два хода назад, было невозможно — а в задаче
       на несколько кварталов это как раз то, по чему и отслеживают, сработало
       решение или нет. Заголовки уже отсортированы движком по важности. */
    setNewsLog((log) => [
      { q: quarterIndex, label: quarterLabel(quarterIndex), items: (result.newsEntries || []).slice(0, 6) },
      ...log,
    ].slice(0, 12));
    return { economy: result.economy, history: newHistory, decisions: newDecisions, book: newBook };
  };

  const runPracticeQuarter = () => {
    Audio.play('stamp');
    const out = runQuarter();
    const used = (practice ? practice.used : 0) + 1;
    setPractice((pr) => (pr ? { ...pr, used } : pr));
    const nextCtx = { ...out, start: startEconomy, startBook,
      value: bookValue(out.book, out.economy, null), startValue: ctx.startValue };
    if (cur.goal(nextCtx)) { setPassed((s2) => ({ ...s2, [step]: true })); Audio.play('up'); }
  };

  const resetPractice = () => {
    if (!practice) return;
    Audio.play('click');
    const a = practice.anchor;
    setEconomy(a.economy); setHistory(a.history); setDecisions(a.decisions);
    setPendingImpulses(a.pendingImpulses); setEventCooldowns(a.eventCooldowns);
    setQuarterIndex(a.quarterIndex); setBook(a.book);
    setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1);
    setNewsLog([]);
    setPractice({ ...practice, used: 0 });
  };

  const advance = () => {
    Audio.play('stamp');
    // если вернулись перечитать теорию, «далее» просто листает вперёд по уже
    // пройденному: кварталы второй раз не играются
    if (step < maxStep) { setStep((v) => v + 1); return; }
    if (cur.runsQuarter) {
      const out = runQuarter();
      const nextStep = module.steps[step + 1];
      if (nextStep && nextStep.lever) setLeverBaseline(out.decisions[nextStep.lever]);
    }
    const willReachFinal = step + 1 >= module.steps.length - 1;
    if (willReachFinal) onComplete();
    setStep((v) => v + 1); setMaxStep((v) => Math.max(v, step + 1));
  };
  const goStep = (i) => { if (i <= maxStep) { Audio.play('tab'); setStep(i); setShowToc(false); } };

  const onTrade = (id, amt, side, live) => setBook((b) => {
    const nb = tradeBook(b, id, amt, side, economy, live);
    const instr = INSTR_BY_ID[id];
    return { ...nb, trades: [...(b.trades || []), { q: quarterIndex, id, side, amt, price: priceOf(instr, economy, live) }].slice(-120) };
  });

  const leverIds = kind === 'practice' ? (cur.levers || []) : lever ? [cur.lever] : [];
  // широкий макет нужен только терминалу: панель президента узкая, и на 1180 px
  // рядом с ней оставалось бы полэкрана пустоты
  const wide = kind === 'practice' && sandbox === 'trader';
  /* Курс раньше жил в колонке 640 px посреди пустого экрана: на компьютере это
     выглядело как страница из телефона. Читать всё ещё удобнее в узкой колонке —
     поэтому текст не растягиваем до края, а вот рабочие панели практики (рычаги,
     панель президента, лента новостей) на широком экране уходят во второй столбец,
     рядом с условием задачи, а не под него. */
  const twoCol = kind === 'practice' && sandbox !== 'trader';

  /* Рабочие панели практики: на широком экране уходят во второй столбец. */
  const sideBlocks = (
    <>
      {newsLog.length > 0 && (
              <div className="ems-panel" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: COLOR.faint,
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                  <Newspaper size={11} />Что происходило по кварталам
                  <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
              {newsLog.length > 1 ? 'сверху — последний' : ''}
                  </span>
                </div>
                {/* лента прокручивается: по задаче на восемь-десять кварталов важно
                    уметь отмотать назад и сверить, после чего что произошло */}
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {newsLog.map((qn) => (
                    <div key={qn.q} style={{ marginBottom: 8 }}>
                      <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint, marginBottom: 4 }}>{qn.label}</div>
                      {qn.items.map((n) => (
                        <div key={n.id} style={{ fontSize: 11.5, lineHeight: 1.45, marginBottom: 6, paddingLeft: 9,
                          borderLeft: `2px solid ${n.priority >= 8 ? COLOR.gold : COLOR.border}` }}>
                          <div style={{ color: COLOR.text }}>{n.headline}</div>
                          <div style={{ color: COLOR.muted }}>{n.text}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
      {sandbox === 'president' && (
              <div style={{ marginBottom: 14 }}>
                <PresidentPanel economy={economy} cooldowns={eventCooldowns}
                  selected={presActions} setSelected={setPresActions}
                  cbPersonaId={cbPersonaId} mofPersonaId={mofPersonaId}
                  appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                  appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                  directive={presDirective} setDirective={setPresDirective} lastDirective={null}
                  directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              </div>
            )}
      {leverIds.length > 0 && (
          <div className="ems-panel" style={{ padding: 16, marginBottom: 22 }}>
          {leverIds.map((id) => {
              const lv = scaleLever(LEVERS.find((l) => l.id === id), economy);
              return (
                <div key={id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                    <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{lv.label}</span>
                    <span className="ems-mono" style={{ fontSize: 13 }}>{decisions[id].toFixed(2)}{lv.suffix}</span>
                  </div>
                  <input type="range" className="ems-slider" min={lv.min} max={lv.max} step={lv.step} value={decisions[id]}
                    disabled={practicePassed}
                    onChange={(e) => { Audio.play('tick'); setDecisions((d) => ({ ...d, [id]: Number(e.target.value) })); }} />
                </div>
              );
            })}
            {lever && (
              <div style={{ fontSize: 11, color: canAdvance ? COLOR.teal : COLOR.faint }}>
                Изменение: {fmtSigned1(delta)}{lever.suffix} — нужно не меньше +{cur.minDelta}{lever.suffix}
              </div>
            )}
          </div>
        )}

    </>
  );

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: wide ? 1180 : twoCol ? 1120 : 900, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <button className="ems-btn" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); onExit(); }}>
            ← К программе курса
          </button>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); setShowGlossary(true); }}>Словарь</button>
          <AudioControls />
        </div>
        {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

        <div key={step} className="ems-fade-in">
          <div className="ems-hero-eyebrow">{module.title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4, marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
            <span className="ems-serif" style={{ fontSize: 22, fontWeight: 600 }}>{cur.title}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {kind === 'quiz' && <span className="ems-hero-badge" style={{ marginTop: 0 }}>теория</span>}
              {kind === 'practice' && <span className="ems-hero-badge" style={{ marginTop: 0 }}>практика</span>}
              <button className="ems-btn" style={{ padding: '4px 10px', fontSize: 11 }}
                title="Содержание модуля: можно вернуться и перечитать пройденное"
                onClick={() => { Audio.play('tab'); setShowToc((v) => !v); }}>
                шаг {step + 1} из {module.steps.length} <ChevronDown size={11} style={{ verticalAlign: -1 }} />
              </button>
            </span>
          </div>
        </div>
        {/* Содержание модуля. Без него нельзя было вернуться и перечитать теорию —
            особенно неудобно в тесте, где вопрос как раз про прочитанное. */}
        {showToc && (
          <div className="ems-panel ems-fade-in" style={{ padding: 10, marginBottom: 12 }}>
            {module.steps.map((st, i) => {
              const reached = i <= maxStep;
              const k = st.kind || 'read';
              return (
                <div key={st.title} role="button" tabIndex={reached ? 0 : -1}
                  onClick={() => goStep(i)} onKeyDown={(e) => { if (e.key === 'Enter') goStep(i); }}
                  className={reached ? 'ems-row-hover' : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 7px', borderRadius: 4, fontSize: 11.5,
                    cursor: reached ? 'pointer' : 'default', opacity: reached ? 1 : 0.45,
                    background: i === step ? COLOR.goldDim : 'transparent' }}>
                  <span className="ems-mono" style={{ fontSize: 10, color: COLOR.faint, width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: i === step ? COLOR.goldSoft : COLOR.text }}>{st.title}</span>
                  {k !== 'read' && <span style={{ fontSize: 9.5, color: COLOR.faint }}>{k === 'quiz' ? 'тест' : 'практика'}</span>}
                  {passed[i] && <Check size={11} color={COLOR.teal} />}
                  {!reached && <Lock size={10} color={COLOR.faint} />}
                </div>
              );
            })}
          </div>
        )}
        <div className="ems-hr" style={{ marginBottom: 18 }} />

        <div className="ems-kpi-strip" style={{ marginBottom: 18 }}>
          {/* незнакомый ключ в списке — опечатка автора курса, а не повод показать
              человеку пустой экран вместо урока: просто пропускаем плитку */}
          {(cur.pins || module.pins).filter((key) => ALL_METRICS[key]).map((key) => {
            const m = ALL_METRICS[key];
            const val = economy[key];
            return (
              <KpiTile key={key} label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'}
                delta={economy[key] - prevEcon[key]} invert={m.invert}
                series={history.slice(-6).map((h) => h[key]).filter(Number.isFinite)} />
            );
          })}
        </div>

        <div className={twoCol ? 'ems-tut-cols' : undefined}>
          <div style={{ minWidth: 0 }}>
            {cur.body && (
              <div className="ems-panel" style={{ padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: COLOR.text, marginBottom: 18 }}>
                {cur.body({ economy, history, decisions, book, ctx })}
              </div>
            )}
            {twoCol && (
              <PracticeStatus step={cur} ctx={ctx} quartersUsed={practice ? practice.used : 0}
                passed={practicePassed} failed={practiceFailed} />
            )}
          </div>
          {twoCol && <div style={{ minWidth: 0 }}>{sideBlocks}</div>}
        </div>

        {kind === 'quiz' && (
          <QuizStep questions={cur.questions} passed={!!passed[step]}
            onPass={() => setPassed((s2) => ({ ...s2, [step]: true }))} />
        )}

        {kind === 'practice' && (
          <>
            {!twoCol && (
              <PracticeStatus step={cur} ctx={ctx} quartersUsed={practice ? practice.used : 0}
                passed={practicePassed} failed={practiceFailed} />
            )}
            {sandbox === 'trader' && (
              <div style={{ marginBottom: 14 }}>
                <TradingTerminal economy={economy} prev={prevEcon} history={history} book={book} onTrade={onTrade} />
              </div>
            )}
          </>
        )}

        {twoCol ? null : sideBlocks}
        {kind === 'practice' && !practicePassed && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="ems-btn primary" disabled={practiceFailed} style={{ flex: 1, minWidth: 200, padding: '12px 0', fontSize: 13.5 }}
              onClick={runPracticeQuarter}>
              Завершить квартал
            </button>
            <button className="ems-btn" style={{ padding: '12px 18px', fontSize: 12.5 }} onClick={resetPractice}>
              <RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Начать задачу заново
            </button>
          </div>
        )}

        {cur.isFinal ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isLastModule ? (
              <button className="ems-btn primary" style={{ flex: 1, minWidth: 220, padding: '13px 0', fontSize: 14 }}
                onClick={() => { Audio.prime(); onStartRealGame(); }}>
                Начать настоящую партию
              </button>
            ) : (
              <button className="ems-btn primary" style={{ flex: 1, minWidth: 220, padding: '13px 0', fontSize: 14 }}
                onClick={() => { Audio.prime(); Audio.play('tab'); onGoNext(); }}>
                Следующий модуль →
              </button>
            )}
            <button className="ems-btn" style={{ padding: '13px 20px', fontSize: 13 }} onClick={() => { Audio.play('click'); onGoHub(); }}>
              К программе курса
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ems-btn" disabled={step === 0} style={{ padding: '13px 18px', fontSize: 13 }}
                onClick={() => goStep(step - 1)}>← Назад</button>
              <button disabled={!canAdvance} className="ems-btn primary" style={{ flex: 1, padding: '13px 0', fontSize: 14 }}
                onClick={advance}>
                {step < maxStep ? 'Далее →' : 'Далее'}
              </button>
            </div>
            {!canAdvance && (kind === 'quiz' || kind === 'practice') && (
              <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 7, textAlign: 'center' }}>
                {kind === 'quiz' ? 'Следующий шаг откроется после верных ответов на все вопросы.'
                  : 'Следующий шаг откроется, когда задача будет решена.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MODULE_STATE_KEY = 'ems-module-progress';
const loadModuleState = () => { try { return JSON.parse(localStorage.getItem(MODULE_STATE_KEY) || '{}'); } catch { return {}; } };
function TutorialHub({ onBack, onStartRealGame }) {
  const playerId = useMemo(getPlayerId, []);
  const [progress, setProgress] = useState(loadCourseProgress);
  // незаконченные модули: на каком шаге остановились и что уже сдали
  const [moduleState, setModuleState] = useState(loadModuleState);
  /* Прогресс курса раньше синхронизировался только в главном меню — если
     человек прошёл несколько уроков и закрыл вкладку, не заходя в меню снова,
     второе связанное устройство об этом так и не узнавало. Здесь синхронизация
     срабатывает трижды: при входе в хаб (подтянуть то, что сделали на другом
     устройстве), при каждом сохранении шага (отправить своё) и при выходе. */
  React.useEffect(() => {
    let alive = true;
    syncProfile(playerId).then(() => {
      if (!alive) return;
      setProgress(loadCourseProgress());
      setModuleState(loadModuleState());
    });
    return () => { alive = false; syncProfile(playerId); };
  }, [playerId]);
  const saveModuleProgress = useCallback((id, st) => {
    setModuleState((prev) => {
      if (prev[id] && prev[id].step === st.step && prev[id].at === st.at
        && Object.keys(prev[id].passed || {}).length === Object.keys(st.passed).length) return prev;
      const next = { ...prev, [id]: st };
      try { localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
      syncProfile(playerId);
      return next;
    });
  }, [playerId]);
  /* Своя музыка курса: спокойные пьесы под чтение и разбор задач. Роль ставится
     на весь хаб, поэтому переходы между модулями её не сбрасывают. */
  React.useEffect(() => {
    Audio.setRole('tutorial');
    return () => { Audio.setRole(null); Audio.stopMusic(); };
  }, []);
  const [courseId, setCourseId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();

  const course = TUTORIAL_COURSES.find((c) => c.id === courseId) || null;
  const doneIn = (c) => c.modules.filter((m) => progress[m.id]).length;

  const completeModule = (mod) => {
    const next = markModuleDone(mod.id);
    setProgress(next);
    syncProfile(playerId);
    /* Пройденный модуль остаётся открытым целиком: его шаги не «сбрасываются», а
       фиксируются пройденными — вернуться по содержанию к четвёртому шагу из семи
       и выйти теперь не значит закрыть себе пятый, шестой и седьмой. */
    setModuleState((prev) => {
      const cur = prev[mod.id] || { passed: {} };
      const full = { ...cur, step: mod.steps.length - 1, at: cur.at ?? (mod.steps.length - 1) };
      const nextState = { ...prev, [mod.id]: full };
      try { localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(nextState)); } catch { /* приватный режим */ }
      return nextState;
    });
    const achIds = ['tutorial_done'];
    // «Экономист» — за базовый курс целиком, включая экзамен; отдельные значки
    // за прикладные курсы, чтобы у каждого была своя цель, а не общий счётчик
    const policy = TUTORIAL_COURSES[0];
    if (policy.modules.every((m) => next[m.id])) achIds.push('tutorial_course_done');
    if (TUTORIAL_COURSES[1].modules.every((m) => next[m.id])) achIds.push('course_trader');
    if (TUTORIAL_COURSES[2].modules.every((m) => next[m.id])) achIds.push('course_president');
    if (TUTORIAL_COURSES.every((c) => c.modules.every((m) => next[m.id]))) achIds.push('course_all');
    pushAch(unlockAchievements(achIds));
  };

  if (activeId && course) {
    const idx = course.modules.findIndex((m) => m.id === activeId);
    const mod = course.modules[idx];
    const next = course.modules[idx + 1];
    return (
      <>
        <AchievementToast toast={achToast} leaving={achLeaving} />
        <TutorialModuleScreen key={mod.id} module={mod} isLastModule={idx === course.modules.length - 1}
          saved={moduleState[mod.id]} onSaveProgress={saveModuleProgress} completed={!!progress[mod.id]}
          onExit={() => setActiveId(null)}
          onComplete={() => completeModule(mod)}
          onGoNext={next ? () => setActiveId(next.id) : null}
          onGoHub={() => setActiveId(null)}
          onStartRealGame={onStartRealGame}
        />
      </>
    );
  }

  const totalDone = TUTORIAL_COURSES.reduce((n, c) => n + doneIn(c), 0);
  const totalModules = TUTORIAL_COURSES.reduce((n, c) => n + c.modules.length, 0);

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <AchievementToast toast={achToast} leaving={achLeaving} />
      <div style={{ maxWidth: 640, width: '100%' }}>
        {/* В обучении музыки не было вообще и включить её было нечем — та же панель
            саундтрека, что и в партии, только прижата к строке навигации. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <button className="ems-btn" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); if (course) setCourseId(null); else onBack(); }}>
            ← {course ? 'Ко всем курсам' : 'Назад в меню'}
          </button>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); setShowGlossary(true); }}>Словарь терминов</button>
          <AudioControls />
        </div>
        {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 30 }}>
          <div className="ems-hero-eyebrow">{course ? 'Программа курса' : 'Обучение'}</div>
          <div className="ems-hero-title small">{course ? course.title : 'Три курса'}</div>
          <div className="ems-hero-rule" />
          <span className="ems-hero-badge">
            <GraduationCap size={11} color={COLOR.gold} />
            {course ? `Пройдено ${doneIn(course)} из ${course.modules.length}` : `Пройдено ${totalDone} из ${totalModules} модулей`}
          </span>
          <div className="ems-hero-lede">
            {course ? course.lede
              : 'Каждый модуль заканчивается тестом на понимание и практической задачей в песочнице: дальше пускает только верный ответ и решённая задача. В конце каждого курса — экзамен. Прогресс сохраняется, проходить заново можно сколько угодно.'}
          </div>
        </div>

        {!course && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {TUTORIAL_COURSES.map((c, i) => {
              const Icon = c.icon;
              const done = doneIn(c);
              const complete = done === c.modules.length;
              return (
                <div key={c.id} onClick={() => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); setCourseId(c.id); }}
                  className="ems-card-btn ems-fade-in" style={{ padding: '17px 20px', animationDelay: `${80 + i * 55}ms` }}
                  role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCourseId(c.id); }}>
                  <div className="ems-card-icon">
                    {complete ? <Check size={19} color={COLOR.teal} /> : <Icon size={19} color={COLOR.gold} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{c.title}</span>
                      <span className="ems-mono" style={{ fontSize: 10, color: complete ? COLOR.teal : COLOR.faint }}>
                        {done} / {c.modules.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>{c.lede}</div>
                    <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${done / c.modules.length * 100}%`, height: '100%',
                        background: complete ? COLOR.teal : COLOR.gold }} />
                    </div>
                  </div>
                  <ChevronDown className="ems-card-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}

        {course && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {course.modules.map((mod, i) => {
              const unlocked = i === 0 || !!progress[course.modules[i - 1].id];
              const done = !!progress[mod.id];
              const Icon = mod.icon;
              const label = mod.isExam ? 'экзамен' : mod.depth === 'deep' ? 'углублённо' : 'поверхностно';
              const depthColor = mod.isExam ? COLOR.gold : mod.depth === 'deep' ? COLOR.rust : COLOR.teal;
              const depthDim = mod.isExam ? COLOR.goldDim : mod.depth === 'deep' ? COLOR.rustDim : COLOR.tealDim;
              const nChecks = mod.steps.filter((st) => st.kind === 'quiz' || st.kind === 'practice').length;
              return (
                <div key={mod.id} onClick={() => { if (unlocked) { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); setActiveId(mod.id); } }}
                  className="ems-card-btn ems-fade-in"
                  style={{ padding: '17px 20px', animationDelay: `${80 + i * 45}ms`,
                    opacity: unlocked ? 1 : 0.55, cursor: unlocked ? 'pointer' : 'not-allowed' }}
                  role="button" tabIndex={unlocked ? 0 : -1}
                  onKeyDown={(e) => { if (unlocked && (e.key === 'Enter' || e.key === ' ')) setActiveId(mod.id); }}>
                  <div className="ems-card-icon">
                    {done ? <Check size={19} color={COLOR.teal} /> : unlocked ? <Icon size={19} color={COLOR.gold} /> : <Lock size={17} color={COLOR.faint} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{mod.title}</span>
                      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999,
                        color: depthColor, border: `1px solid ${depthDim}`, background: depthDim }}>{label}</span>
                      {nChecks > 0 && (
                        <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint }}>
                          {mod.steps.some((st) => st.kind === 'quiz') ? 'тест' : ''}
                          {mod.steps.some((st) => st.kind === 'quiz') && mod.steps.some((st) => st.kind === 'practice') ? ' + ' : ''}
                          {mod.steps.some((st) => st.kind === 'practice') ? 'практика' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>
                      {unlocked ? mod.summary : `Сначала пройдите «${course.modules[i - 1].title}»`}
                    </div>
                    {unlocked && !done && moduleState[mod.id] && moduleState[mod.id].step > 0 && (
                      <div style={{ fontSize: 10.5, color: COLOR.goldSoft, marginTop: 3 }}>
                        Начат — продолжить с шага {(moduleState[mod.id].at ?? moduleState[mod.id].step) + 1} из {mod.steps.length}
                      </div>
                    )}
                  </div>
                  {unlocked && <ChevronDown className="ems-card-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ ЭКРАН ВЫБОРА ============================ */
function SetupScreen({ onStart, onBack }) {
  const [role, setRole] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [goal, setGoalRaw] = useState('living_standards');
  const setGoal = (g) => setGoalRaw(g);
  React.useEffect(() => { setGoalRaw(role === 'trader' ? 'max_wealth' : 'living_standards'); }, [role]);
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
  const presAvailable = role === 'central_bank' || role === 'ministry_finance' || role === 'trader';
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
          <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>1</span>
          <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Ваш пост</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 26 }}>
          {ROLES.map((r) => {
            const Icon = ROLE_ICON[r.icon]; const active = role === r.id;
            return (
              <div key={r.id} onClick={() => { Audio.prime(); Audio.play('click'); setRole(r.id); }} className="ems-card-btn"
                style={{ padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(r.id); }}>
                {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 14, right: 14 }} />}
                <div className="ems-card-icon" style={{ width: 36, height: 36, marginBottom: 10 }}>
                  <Icon size={17} color={COLOR.gold} />
                </div>
                <div className="ems-serif" style={{ fontSize: 14.5, marginBottom: 5, color: active ? COLOR.goldSoft : COLOR.text }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            );
          })}
        </div>

        {role && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>2</span>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Как настраивать партию</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: custom ? 22 : 26 }}>
              {[['classic', 'Классика', 'Характеры ведомств бросаются случайно, президент включён. Начать и разбираться по ходу — как и должно быть в первый раз.'],
                ['custom', 'Настраиваемая', 'Выбрать характер каждого ведомства и президента — или отключить президента совсем.']].map(([id, title, note]) => {
                const active = mode === id;
                return (
                  <div key={id} onClick={() => { Audio.play('click'); setMode(id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMode(id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div className="ems-serif" style={{ fontSize: 13.5, marginBottom: 4, color: active ? COLOR.goldSoft : COLOR.text }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>{note}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {custom && presAvailable && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Президент</span>
              <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11,
                background: presEnabled ? COLOR.gold : COLOR.panelAlt, color: presEnabled ? COLOR.ink : COLOR.muted,
                borderColor: presEnabled ? COLOR.gold : COLOR.border }}
                onClick={() => { Audio.play('tick'); setPresEnabled((v) => !v); }}>
                {presEnabled ? 'включён' : 'выключен'}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10, lineHeight: 1.45 }}>
              {role === 'trader'
                ? 'Президент не управляет ставкой и бюджетом, но требует своего от обоих ведомств и тратит политический капитал на реформы — для рынка это ещё один источник новостей и риска.'
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
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
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
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>С кем придётся работать, выяснится уже в должности.</div>
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
              <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>{bi === 0 ? '' : ''}</span>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{blk.title}</span>
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10 }}>
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
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
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
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                    </div>
                    <div style={{ fontSize: 11, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>Характер определится в момент вступления в должность — не будете знать заранее, с кем имеете дело.</div>
                  </div>
                );
              })()}
            </div>
          </React.Fragment>
        ))}

        {/* сложность и приоритет — это быстрые настройки, а не решения того же веса,
            что роль: сводим в одну компактную секцию вместо двух полноразмерных
            сеток карточек, чтобы «пост» на экране визуально оставался главным */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>3</span>
          <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Сложность и приоритет</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 20, marginBottom: 30 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {DIFFICULTIES.map((dd) => {
                const active = difficulty === dd.id;
                return (
                  <span key={dd.id} className={`ems-tab ${active ? 'active' : ''}`}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0', fontSize: 12.5 }}
                    onClick={() => { Audio.play('click'); setDifficulty(dd.id); }}>{dd.title}</span>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>
              {(DIFFICULTIES.find((dd) => dd.id === difficulty) || {}).desc}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 8 }}>По какой оценке подводить итог партии</div>
            <div style={{ position: 'relative' }}>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className="ems-btn"
                style={{ width: '100%', padding: '10px 36px 10px 12px', fontSize: 13, appearance: 'none', WebkitAppearance: 'none' }}>
                {GOALS.filter((g) => (role === 'trader' ? g.trader : !g.trader)).map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
              </select>
              <ChevronDown size={14} color={COLOR.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <button disabled={!role} className="ems-btn primary" style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
          onClick={() => {
            if (!role) return;
            Audio.prime(); Audio.play('stamp'); Audio.startMusic();
            const pick = (list) => list[Math.floor(Math.random() * list.length)].id;
            const cbWanted = custom ? cbPersona : 'random';
            const mofWanted = custom ? mofPersona : 'random';
            const presWanted = custom ? presPersona : 'random';
            onStart({ role, difficulty, goal,
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

/* ============================ ТАБЛИЦЫ ПОКАЗАТЕЛЕЙ ============================ */
const idx0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
// в узкой строке показателя полные названия реформ не помещаются
const REFORM_SHORT = { labor: 'труд', pension: 'пенсии', courts: 'суды', deregulation: 'дерегулирование', education: 'образование' };
const INDICATOR_TABS = [
  { id: 'economy', label: 'Выпуск', icon: TrendingUp, rows: [
    { key: 'gdp', label: 'ВВП (реальный)', fmt: fmtMoney },
    { key: 'gdpGrowth', label: 'Темп роста ВВП', fmt: fmtSignedPct },
    { key: 'potentialGdp', label: 'Потенциальный ВВП', fmt: fmtMoney },
    { key: 'potentialGrowth', label: 'Рост потенциала', fmt: fmtSignedPct },
    { key: 'outputGap', label: 'Разрыв выпуска', fmt: fmtSignedPct },
    { key: 'gdpPerCapita', label: 'ВВП на душу населения', fmt: (v) => `${Math.round(v).toLocaleString('ru-RU')} у.е.` },
    { key: 'consumption', label: 'Потребление', fmt: fmtMoney },
    { key: 'businessInvestment', label: 'Инвестиции бизнеса', fmt: fmtMoney },
    { key: 'fiscalImpulse', label: 'Бюджетный импульс', fmt: (v) => `${fmtSigned1(v)} п.п.` },
  ] },
  { id: 'prices', label: 'Цены', icon: Coins, rows: [
    { key: 'inflation', label: 'Инфляция (ИПЦ)', fmt: pctFmt },
    { key: 'coreInflation', label: 'Базовая инфляция', fmt: pctFmt },
    { key: 'inflationExpectations', label: 'Инфляционные ожидания', fmt: pctFmt },
    { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: idx0 },
    { key: 'importPriceInflation', label: 'Инфляция цен импорта', fmt: pctFmt },
    { key: 'unitLaborCostGrowth', label: 'Удельные издержки труда', fmt: fmtSignedPct },
    { key: 'moneySupply', label: 'Денежная масса (индекс)', fmt: fmt1 },
  ] },
  { id: 'money', label: 'Ставки', icon: Banknote, rows: [
    { key: 'keyRate', label: 'Ключевая ставка', fmt: pctFmt },
    { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
    { key: 'depositRate', label: 'Ставка по депозитам', fmt: pctFmt },
    { key: 'realLendingRate', label: 'Реальная ставка по кредитам', fmt: pctFmt },
    { key: 'rStar', label: 'Нейтральная реальная ставка r*', fmt: pctFmt },
    { key: 'rateGap', label: 'Жёсткость условий (факт − нейтраль)', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'riskPremium', label: 'Премия за риск страны', fmt: pctFmt },
  ] },
  { id: 'banking', label: 'Банки', icon: ShieldAlert, rows: [
    { key: 'creditVolume', label: 'Кредитный портфель', fmt: fmtMoney },
    { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
    { key: 'creditGap', label: 'Кредитный разрыв (бум/сжатие)', fmt: (v) => `${fmtSigned1(v)} п.п. ВВП` },
    { key: 'bankNPL', label: 'Просроченные кредиты', fmt: pctFmt },
    { key: 'bankCapital', label: 'Капитал банков', fmt: fmtMoney },
    { key: 'bankCapitalAdequacy', label: 'Достаточность капитала', fmt: pctFmt },
    // норматив задаётся рычагом, но смотреть на него игроку тоже нужно: рядом с
    // фактической достаточностью видно, есть ли у банков запас над требованием
    { key: 'capitalRequirement', label: 'Норматив достаточности', fmt: pctFmt, noDelta: true },
    { key: 'bankProfit', label: 'Прибыль банков за квартал', fmt: fmtMoneySigned },
    { key: 'bankLiquidity', label: 'Ликвидность банков', fmt: idx0 },
    { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
  ] },
  { id: 'government', label: 'Бюджет', icon: Landmark, rows: [
    { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
    { key: 'revenuePctGdp', label: 'Доходы к ВВП', fmt: pctFmt },
    { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
    { key: 'interestPayment', label: 'Обслуживание долга', fmt: fmtMoney },
    { key: 'interestToRevenue', label: 'Обслуживание к доходам', fmt: pctFmt },
    { key: 'budgetBalancePctGdp', label: 'Баланс бюджета', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'structuralBalancePctGdp', label: 'Структурный баланс', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'govDebt', label: 'Государственный долг', fmt: fmtMoney },
    { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
    { key: 'effectiveDebtRate', label: 'Средняя ставка по долгу', fmt: pctFmt },
    { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt },
  ] },
  { id: 'labor', label: 'Труд', icon: Users, rows: [
    { key: 'unemployment', label: 'Безработица', fmt: pctFmt },
    { key: 'nairu', label: 'Естественный уровень безработицы', fmt: pctFmt },
    { key: 'tightness', label: 'Напряжённость рынка труда', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'vacancyRate', label: 'Доля вакансий', fmt: pctFmt },
    { key: 'wageGrowth', label: 'Рост зарплат', fmt: fmtSignedPct },
    { key: 'employment', label: 'Занятость', fmt: pctFmt },
  ] },
  { id: 'external', label: 'Внешний сектор', icon: Globe2, rows: [
    { key: 'exports', label: 'Экспорт', fmt: fmtMoney },
    { key: 'imports', label: 'Импорт', fmt: fmtMoney },
    { key: 'currentAccount', label: 'Счёт текущих операций', fmt: fmtMoneySigned },
    { key: 'netCapitalFlow', label: 'Чистый приток капитала', fmt: fmtMoneySigned },
    { key: 'reserves', label: 'Золотовалютные резервы', fmt: fmtMoney },
    { key: 'exchangeRate', label: 'Курс (выше = слабее)', fmt: fmt1 },
    { key: 'realExchangeRate', label: 'Реальный курс', fmt: fmt1 },
    { key: 'fdi', label: 'Прямые иностранные инвестиции', fmt: fmtMoneySigned },
    { key: 'worldGdpGrowth', label: 'Рост мировой экономики', fmt: fmtSignedPct },
  ] },
  { id: 'potential', label: 'Потенциал', icon: Factory, rows: [
    { key: 'productivity', label: 'Производительность (TFP)', fmt: fmt1 },
    { key: 'tfpGrowth', label: 'Рост производительности', fmt: fmtSignedPct },
    { key: 'humanCapitalIndex', label: 'Человеческий капитал', fmt: fmt1 },
    { key: 'infrastructureIndex', label: 'Инфраструктура', fmt: fmt1 },
    { key: 'capitalStock', label: 'Основной капитал', fmt: fmtMoney },
    { key: 'supplyScar', label: 'Шрамы предложения', fmt: (v) => `${fmtSigned1(v)}%` },
  ] },
  { id: 'market', label: 'Рынок', icon: TrendingUp, rows: [
    { key: 'stockIndex', label: 'Индекс акций', fmt: fmt1 },
    { key: 'marketCapPctGdp', label: 'Капитализация к ВВП', fmt: pctFmt },
    { key: 'stockPE', label: 'P/E рынка', fmt: fmt1 },
    { key: 'equityRiskPremium', label: 'Премия за риск акций', fmt: pctFmt },
    { key: 'bondIndex', label: 'Индекс облигаций', fmt: fmt1 },
    { key: 'yield2y', label: 'Доходность 2 года', fmt: pctFmt },
    { key: 'yield10y', label: 'Доходность 10 лет', fmt: pctFmt },
    { key: 'curveSlope', label: 'Наклон кривой', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'sovereignSpread', label: 'Суверенный спред', fmt: (v) => `${Math.round(v)} б.п.` },
    { key: 'corporateSpread', label: 'Корпоративный спред', fmt: (v) => `${Math.round(v)} б.п.` },
    { key: 'volatilityIndex', label: 'Индекс страха', fmt: fmt1 },
    { key: 'bankPB', label: 'Банки: цена к капиталу', fmt: fmt2 },
    { key: 'bankROE', label: 'Банки: рентабельность', fmt: pctFmt },
    { key: 'netInterestMargin', label: 'Процентная маржа', fmt: (v) => `${fmt2(v)} п.п.` },
    { key: 'fxVolatility', label: 'Волатильность курса', fmt: fmt1 },
  ] },
  { id: 'politics', label: 'Политика', icon: Flag, rows: [
    { key: 'approval', label: 'Рейтинг власти', fmt: (v) => v.toFixed(0) },
    { key: 'quartersToElection', label: 'Кварталов до выборов', fmt: (v) => v.toFixed(0), noDelta: true },
    { key: 'term', label: 'Срок правительства', fmt: (v) => `${v}-й` },
    { key: 'govTrust', label: 'Доверие к правительству', fmt: (v) => v.toFixed(0) },
    { key: 'policyCoordination', label: 'Согласованность политики', fmt: (v) => v.toFixed(0) },
    { label: 'Мандат власти', get: (e) => e.mandate, text: true, map: MANDATE_LABEL },
    { label: 'Линия правительства', get: (e) => e.governmentLine, text: true, map: { centrist: 'центристская', populist: 'популистская', austerity: 'консервативная', technocrat: 'технократическая' } },
    { label: 'Политический режим', get: (e) => e.politicalRegime, text: true,
      map: Object.fromEntries(Object.entries(POLITICAL_REGIME_INFO).map(([id, info]) => [id, info.label])) },
    { key: 'politicalTension', label: 'Политическое напряжение', fmt: (v) => v.toFixed(0) },
    { label: 'Беспорядки в стране', get: (e) => !!e.unrestActive, text: true, map: { true: 'да', false: 'нет' } },
    { label: 'Парламент', get: (e) => !!e.parliamentDissolved, text: true, map: { true: 'распущен', false: 'работает' } },
    { key: 'politicalCapital', label: 'Политический капитал', fmt: (v) => v.toFixed(0) },
    { key: 'cbTenure', label: 'Глава ЦБ в должности, кв.', fmt: (v) => v.toFixed(0), noDelta: true },
    { key: 'mofTenure', label: 'Министр финансов в должности, кв.', fmt: (v) => v.toFixed(0), noDelta: true },
    { label: 'Проведённые реформы', text: true,
      get: (e) => {
        const ids = Object.keys(e.reforms || {});
        if (!ids.length) return 'нет';
        return ids.map((id) => `${REFORM_SHORT[id] || id} ${Math.round(reformShare(e.reforms, id) * 100)}%`).join(', ');
      } },
  ] },
  { id: 'risks', label: 'Риски', icon: AlertTriangle, rows: [
    { key: 'inflationRisk', label: 'Инфляционный риск', fmt: idx0 },
    { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
    { key: 'debtRisk', label: 'Долговой риск', fmt: idx0 },
    { key: 'recessionRisk', label: 'Риск рецессии', fmt: idx0 },
    { key: 'currencyRisk', label: 'Валютный риск', fmt: idx0 },
    { key: 'financialStability', label: 'Финансовая стабильность', fmt: idx0 },
    { key: 'consumerConfidence', label: 'Доверие населения', fmt: idx0 },
    { key: 'businessConfidence', label: 'Доверие бизнеса', fmt: idx0 },
    { key: 'govTrust', label: 'Доверие к правительству', fmt: idx0 },
  ] },
];

/* Реестр показателей: всё, что можно закрепить в верхнюю полосу */
const METRIC_INVERT = new Set(['inflation', 'coreInflation', 'inflationExpectations', 'importPriceInflation',
  'unitLaborCostGrowth', 'sovereignSpread', 'corporateSpread', 'volatilityIndex', 'equityRiskPremium', 'discountRate',
  'taxWedgeValue', 'keyRate', 'depositRate', 'effectiveDebtRate', 'unemployment', 'debtToGdp', 'bankNPL', 'bankingRisk',
  'inflationRisk', 'debtRisk', 'recessionRisk', 'currencyRisk', 'shadowShare', 'interestToRevenue', 'effectiveDebtRate',
  'riskPremium', 'exchangeRate', 'importPriceInflation', 'lendingRate', 'nairu', 'creditGap', 'rateGap', 'quartersToElection',
  'politicalTension']);
const ALL_METRICS = (() => {
  const m = {};
  INDICATOR_TABS.forEach((t) => t.rows.forEach((r) => {
    if (r.key && !r.text && !m[r.key]) m[r.key] = { key: r.key, label: r.label, fmt: r.fmt, group: t.label, invert: METRIC_INVERT.has(r.key) };
  }));
  [['wellbeing', 'Благополучие'], ['scoreStability', 'Оценка: стабильность'], ['scoreWelfare', 'Оценка: благосостояние'],
    ['scoreFinancial', 'Оценка: финансы'], ['scoreFiscal', 'Оценка: бюджет'], ['scorePotential', 'Оценка: потенциал']].forEach(([k, l]) => {
      m[k] = { key: k, label: l, fmt: (v) => v.toFixed(0), group: 'Оценки', invert: false };
    });
  return m;
})();
const DEFAULT_PINS = ['gdp', 'outputGap', 'inflation', 'unemployment', 'debtToGdp'];
const MAX_PINS = 8;

function PinButton({ active, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); Audio.play('tick'); onClick(); }} title={active ? 'Открепить с верхней полосы' : 'Закрепить в верхнюю полосу'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, color: active ? COLOR.gold : COLOR.faint, opacity: active ? 1 : 0.55 }}>
      <Star size={11} fill={active ? COLOR.gold : 'none'} />
    </button>
  );
}

/* Полоса требований: то, чего от вас прямо сейчас хотят */
function DemandStrip({ botAction, botAction2, botRole, economy, president }) {
  const items = [];
  if (president) items.push({ who: `Президент (${president.persona.name})`, text: president.directive.ask || askText(president.directive.req, 1, 'president'), color: COLOR.gold });
  if (economy.mandate) items.push({ who: 'Мандат власти', text: `Новое правительство пришло с задачей: ${MANDATE_LABEL[economy.mandate] || economy.mandate}.`, color: COLOR.gold });
  if (botAction && botAction.demand) items.push({ who: botRole === 'central_bank' ? 'Центральный банк' : 'Минфин', text: botAction.demand, color: COLOR.blue });
  // у президента оба ведомства — боты, и требования к нему идут с обеих сторон
  if (botAction2 && botAction2.demand) items.push({ who: 'Минфин', text: botAction2.demand, color: COLOR.blue });
  (economy.demands || []).slice(0, 3).forEach((d) => items.push({ who: d.actor, text: d.text + (d.quartersActive >= 3 ? ` (${d.quartersActive}-й квартал подряд)` : ''), color: COLOR.rust }));
  if (!items.length) return null;
  return (
    <div className="ems-panel ems-fade-in" style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px 18px', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLOR.goldSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Megaphone size={13} />Требования
      </span>
      {items.map((it, i) => (
        <span key={i} style={{ fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'baseline' }}>
          <span style={{ color: it.color, fontWeight: 600 }}>{it.who}:</span>
          <span style={{ color: COLOR.muted }}>{it.text}</span>
        </span>
      ))}
    </div>
  );
}

function RiskBadge({ label, value }) {
  const v = clamp(value || 0, 0, 100);
  const color = v >= 65 ? COLOR.rust : v >= 35 ? COLOR.gold : COLOR.teal;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
      <span style={{ color: COLOR.muted, whiteSpace: 'nowrap' }}>{label}</span>
      {/* дорожка размечена самими зонами (спокойно/тревожно/опасно), а не только
          закрашена до текущего значения — так видно не просто «24», а «24 — это
          насколько близко к жёлтой зоне», без сверки с легендой в голове */}
      <span style={{ position: 'relative', width: 46, height: 4, borderRadius: 2, flexShrink: 0,
        background: `linear-gradient(90deg, ${COLOR.tealDim} 0%, ${COLOR.tealDim} 35%, ${COLOR.goldDim} 35%, ${COLOR.goldDim} 65%, ${COLOR.rustDim} 65%, ${COLOR.rustDim} 100%)` }}>
        <span style={{ position: 'absolute', left: `calc(${v}% - 1.5px)`, top: -2, width: 3, height: 8, borderRadius: 1, background: color }} />
      </span>
      <span className="ems-mono" style={{ color, fontWeight: 600, width: 18 }}>{Math.round(v)}</span>
    </div>
  );
}

function DemandsPanel({ demands }) {
  if (!demands || demands.length === 0) return null;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <Users size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>Общественное давление</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {demands.map((dd) => (
          <div key={dd.id} style={{ fontSize: 11.5, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.rust}`, paddingLeft: 9 }}>
            <span style={{ color: COLOR.rust, fontWeight: 600 }}>{dd.actor}: </span>
            <span style={{ color: COLOR.text }}>{dd.text}</span>
            {dd.quartersActive >= 3 && <span style={{ color: COLOR.faint }}> ({dd.quartersActive}-й квартал подряд)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ============================ ГЛАВНЫЙ ЭКРАН ============================ */
function GameScreen({ setup, initial, onRestart, onLoadState, theme, setTheme }) {
  const roleDef = ROLES.find((r) => r.id === setup.role);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  const goalDef = GOALS.find((g) => g.id === setup.goal);
  const botRole = roleDef.botRole;
  const isTrader = setup.role === 'trader';
  // президент делит с трейдером устройство «оба ведомства — боты», но не его
  // информационную закрытость: он в кабинете и видит намерения ведомств
  const isPresident = setup.role === 'president';
  const bothBots = isTrader || isPresident;
  /* Президент-бот стоит НАД ведомством игрока: он ничего не считает сам, но требует,
     назначает и тратит политический капитал. За саму роль президента его, понятно,
     нет, а у премьера игрок и так вся власть целиком. */
  const presEnabled = !!(setup.president && setup.president.enabled)
    && (setup.role === 'central_bank' || setup.role === 'ministry_finance' || setup.role === 'trader');
  const playerBranch = setup.role === 'central_bank' ? 'monetary' : setup.role === 'ministry_finance' ? 'fiscal' : null;
  const [difficulty, setDifficulty] = useState(setup.difficulty);

  const initEconomy = useMemo(() => (initial ? initial.economy : makeInitialEconomy()), []);
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState(initial ? initial.history : [{ q: 0, label: quarterLabel(1) + ' (старт)', ...initEconomy }]);
  const [decisions, setDecisions] = useState(initial ? initial.decisions : defaultDecisions(initEconomy));
  const [pendingImpulses, setPendingImpulses] = useState(initial ? initial.pendingImpulses || [] : []);
  const [eventCooldowns, setEventCooldowns] = useState(initial ? initial.eventCooldowns || {} : {});
  const [quarterIndex, setQuarterIndex] = useState(initial ? initial.quarterIndex : 1);
  const [newsFeed, setNewsFeed] = useState(initial ? initial.newsFeed || [] : []);
  const [stories, setStories] = useState(initial ? initial.stories || [] : []);
  const [showPaper, setShowPaper] = useState(false);
  const [saveModal, setSaveModal] = useState(null);
  const [showAch, setShowAch] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();
  const [defeat, setDefeat] = useState(initial && initial.defeat ? initial.defeat : null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [view, setView] = useState(setup.role === 'trader' ? 'market' : 'dash');
  // на вкладке «Казино» музыка временно переключается на лаунж-плейлист
  // независимо от режима экономики, а при выходе возвращается к тому, что
  // играло (в том числе к ручному выбору игрока, если он был) — а не всегда
  // к «по режиму экономики»
  React.useEffect(() => {
    if (view !== 'casino') return undefined;
    const prevLocked = Audio.nowPlaying().locked;
    Audio.setPlaylist('casino');
    return () => { Audio.setPlaylist(prevLocked); };
  }, [view]);
  const [flashKey, setFlashKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [dense, setDense] = useState(initial ? !!initial.dense : false);
  const [irf, setIrf] = useState(null);
  const [mobileCol, setMobileCol] = useState('center');
  const [narrow, setNarrow] = useState(false);
  const [dashboards, setDashboards] = useState(() => initDashboards(initial && initial.dashboards));
  const dashActions = useMemo(() => makeDashboardActions(setDashboards), []);
  const initialDash = initial ? initial.activeDash || null : null;
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const { pinned, setPinned, activeDash, setActiveDash } = usePinnedStrip(
    initial && initial.pinned ? initial.pinned : null, initialDash, dashActions);
  const layout = useLayoutColumns();
  const [pendingRequest, setPendingRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(initial ? initial.lastResponse || null : null);
  const [botAction2, setBotAction2] = useState(initial ? initial.botAction2 || null : null);
  const [portfolio, setPortfolio] = useState(initial && initial.portfolio ? initial.portfolio : emptyBook());
  const [cbPersonaId, setCbPersonaId] = useState(initial && initial.cbPersonaId ? initial.cbPersonaId : setup.cbPersona);
  const [presPersonaId] = useState(() => (initial && initial.presPersonaId)
    || ((setup.president && setup.president.persona) || 'technocrat'));
  // план президента на ближайший квартал: требование должно быть видно ДО решений
  const [presidentPlan, setPresidentPlan] = useState(() => (presEnabled
    ? botPresident(initEconomy, presPersonaId, setup.difficulty,
      { playerBranch, cooldowns: {}, cbPersonaId: setup.cbPersona, mofPersonaId: setup.mofPersona })
    : null));
  const [presidentLast, setPresidentLast] = useState(initial ? initial.presidentLast || null : null);
  // сколько кварталов назад президент требовал в прошлый раз и чего именно —
  // чтобы он не повторял одно и то же слово в слово каждый квартал
  const [presDirMemo, setPresDirMemo] = useState({ lastReqId: null, ago: 99 });
  // решения на начало квартала — по ним проверяется, выполнено ли требование
  const [decisionsBaseline, setDecisionsBaseline] = useState(() => defaultDecisions(initEconomy));
  const [mofPersonaId, setMofPersonaId] = useState(initial && initial.mofPersonaId ? initial.mofPersonaId : setup.mofPersona);
  // предвыборные обещания — у премьера и президента: у них нет бота-оппонента
  // с требованиями, и это единственные роли без встречного давления по политике
  const [promises, setPromises] = useState(() => (setup.role !== 'full_control' && setup.role !== 'president' ? null
    : initial && initial.promises ? initial.promises : pickPromises(initEconomy)));
  // пакет решений президента на текущий квартал: списывается движком при завершении
  const [presActions, setPresActions] = useState(initial ? initial.presActions || [] : []);
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  const [lastDirective, setLastDirective] = useState(initial ? initial.lastDirective || null : null);
  const [lastReasons, setLastReasons] = useState(initial && initial.lastReasons ? initial.lastReasons
    : { gdpGrowth: [], inflation: [], exchangeRate: [], budget: [], unemployment: [], banking: [], potential: [] });
  const [lastReport, setLastReport] = useState(initial ? initial.lastReport || '' : '');
  const [botAction, setBotAction] = useState(initial ? initial.botAction || null : null);
  const [showWhy, setShowWhy] = useState(false);
  const [activeTab, setActiveTab] = useState('economy');
  const { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries } = useChartView();
  const [busy, setBusy] = useState(false);

  const activeBotPersona = botRole === 'central_bank' ? getCbPersona(cbPersonaId) : botRole === 'ministry_finance' ? getMofPersona(mofPersonaId) : null;
  const onTrade = (id, amt, side, live) => setPortfolio((b) => {
    const nb = tradeBook(b, id, amt, side, economy, live);
    const instr = INSTR_BY_ID[id];
    return { ...nb, trades: [...(b.trades || []), { q: quarterIndex, id, side, amt, price: priceOf(instr, economy, live) }].slice(-120) };
  });
  const onCasino = (net) => {
    const casinoNet = (portfolio.casinoNet || 0) + net;
    setPortfolio((b) => ({ ...b, cash: Math.max(0, b.cash + net), realized: (b.realized || 0) + net, casinoNet: (b.casinoNet || 0) + net }));
    pushAch(unlockAchievements(casinoAchievementIds({ net, casinoNet })));
  };
  const prevEcon = history.length >= 2 ? history[history.length - 2] : initEconomy;
  const groups = roleDef.groups;
  const levers = LEVERS.filter((l) => groups.includes(l.group)).filter((l) => !l.onlyIf || l.onlyIf(decisions));
  // «Ваши полномочия» разбиты на вкладки по подгруппам, а не одним длинным списком:
  // при роли «оба ведомства» все ~22 ползунка подряд растягивали левую колонку
  // намного выше центральной и правой, оставляя под ними пустое место на странице
  const LEVER_TABS = [
    groups.includes('monetary') && { id: 'monetary-core', label: 'Ставка и курс' },
    groups.includes('monetary') && { id: 'monetary-macropru', label: 'Макропруденциальная' },
    groups.includes('fiscal') && { id: 'fiscal-core', label: 'Расходы' },
    groups.includes('fiscal') && { id: 'fiscal-taxes', label: 'Налоги' },
    groups.includes('fiscal') && { id: 'fiscal-budget', label: 'Бюджет' },
  ].filter(Boolean);
  const [levTab, setLevTab] = useState(LEVER_TABS[0] ? LEVER_TABS[0].id : null);
  const tabs = useMemo(() => tabsForBotRole(botRole), [botRole]);
  const snapshot = () => makeSnapshot({ setup: { ...setup, difficulty }, economy, history, decisions, pendingImpulses, eventCooldowns,
    quarterIndex, newsFeed, stories, lastReport, lastReasons, botAction, botAction2, pinned, cbPersonaId, mofPersonaId,
    portfolio, lastResponse, dense, dashboards, activeDash, defeat, promises, presActions, lastDirective,
    presPersonaId, presidentLast });
  const togglePin = (key) => setPinned((ps) => (ps.includes(key) ? ps.filter((x) => x !== key) : (ps.length >= MAX_PINS ? ps : [...ps, key])));
  const movePin = (key, dir) => setPinned((ps) => {
    const i = ps.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= ps.length) return ps;
    const next = [...ps]; next[i] = ps[j]; next[j] = ps[i]; return next;
  });
  const [dragPin, setDragPin] = useState(null);
  const reorderPin = (from, to) => setPinned((ps) => {
    if (from === to) return ps;
    const fromIdx = ps.indexOf(from); const toIdx = ps.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return ps;
    const next = [...ps]; next.splice(fromIdx, 1); next.splice(toIdx, 0, from); return next;
  });
  const applyDash = (id) => { const d = dashboards.find((x) => x.id === id); if (d) { setPinned(d.pins); setActiveDash(id); } };
  const saveDash = () => dashActions.saveDash(pinned, setActiveDash);
  const { deleteDash, renameDash, resetDash } = dashActions;
  const crisisActive = (economy.activeCrises || []).includes('banking') || economy.bankingRisk > 60;
  const debtCrisisActive = (economy.activeCrises || []).includes('debt') && !(economy.marketLockoutQuartersLeft > 0);

  const finishQuarter = useCallback(() => {
    if (defeat) return;
    setBusy(true);
    let eff = { ...decisions };
    let extraImpulses = [];
    const cbAction0 = (botRole === 'central_bank' || bothBots) ? botCentralBank(economy, cbPersonaId, difficulty) : null;
    const mofAction0 = (botRole === 'ministry_finance' || bothBots) ? botFinanceMinistry(economy, mofPersonaId, difficulty) : null;
    let cbAction = cbAction0; let mofAction = mofAction0;
    if (cbAction) eff = { ...eff, ...cbAction.decisions };
    if (mofAction) eff = { ...eff, ...mofAction.decisions };

    /* Решения президента. Указы, реформы и назначения списывает и применяет сам
       движок (decisions.presidentActions / appointCb / appointMof) — а вот указание
       ведомству разбирается здесь, потому что ему нужны уже посчитанные решения
       ботов; стоимость и последствия возвращаются движку отдельными каналами. */
    let dirResult = null;
    if (isPresident) {
      eff = { ...eff, presidentActions: presActions, appointCb: presAppointCb, appointMof: presAppointMof };
      if (presDirective) {
        dirResult = processPresidentialDirective(presDirective, economy, cbPersonaId, mofPersonaId, eff, presDirStrength);
      }
      if (dirResult) {
        eff = { ...dirResult.decisions, presidentExtraSpend: PRES_DIRECTIVE_COST };
        if (dirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
        else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
        if (dirResult.credibilityHit) {
          extraImpulses.push(makeImpulse('cbCredibilityPush', dirResult.credibilityHit,
            'Центральный банк исполнил указание президента', 'fast', difficulty, 'other'));
        }
        if (dirResult.tension) {
          extraImpulses.push(makeImpulse('tensionPush', dirResult.tension,
            'Ведомство отклонило указание президента', 'fast', difficulty, 'other'));
        }
      }
    }
    /* Президент-бот. Его собственные решения (указы, реформы, назначения) движок
       разбирает тем же кодом, что и решения игрока-президента; указание ведомству
       игрока проверяется здесь, потому что «выполнено» — это про то, что игрок
       сделал с ползунками, а не про то, что получилось в экономике. */
    let presDirResult = null;
    let directiveMet = null;
    if (presEnabled && presidentPlan) {
      const presPersona = presidentPlan.persona;
      eff = { ...eff, presidentActive: true, presidentActions: presidentPlan.actions,
        presidentPatience: presPersona.patience };
      if (presidentPlan.appointBot) {
        const ap = presidentPlan.appointBot;
        eff = { ...eff, [ap.kind === 'central_bank' ? 'appointCb' : 'appointMof']: ap.persona };
      }
      const dir = presidentPlan.directive;
      if (dir && dir.toPlayer) {
        directiveMet = directiveProgress(dir.reqId, decisionsBaseline, decisions, economy);
        // требование стоит президенту капитала — иначе давить можно бесконечно
        eff = { ...eff, presidentDirectiveMet: directiveMet, presidentExtraSpend: PRES_DIRECTIVE_COST };
      } else if (dir) {
        presDirResult = processPresidentialDirective(dir.reqId, economy, cbPersonaId, mofPersonaId, eff);
        if (presDirResult) {
          eff = { ...presDirResult.decisions, presidentActive: true,
            presidentActions: presidentPlan.actions, presidentPatience: presPersona.patience,
            presidentExtraSpend: PRES_DIRECTIVE_COST,
            ...(presidentPlan.appointBot
              ? { [presidentPlan.appointBot.kind === 'central_bank' ? 'appointCb' : 'appointMof']: presidentPlan.appointBot.persona }
              : {}) };
          if (presDirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
          else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
          if (presDirResult.credibilityHit) {
            extraImpulses.push(makeImpulse('cbCredibilityPush', presDirResult.credibilityHit,
              'Центральный банк исполнил указание президента', 'fast', difficulty, 'other'));
          }
        }
      }
    }
    let action = botRole === 'central_bank' ? cbAction : botRole === 'ministry_finance' ? mofAction : cbAction;
    // официальный запрос второму ведомству
    let reqResult = null;
    if (pendingRequest && botRole && botRole !== 'both') {
      reqResult = processRequest(pendingRequest, economy, botRole, botRole === 'central_bank' ? cbPersonaId : mofPersonaId, eff);
      if (reqResult) {
        eff = reqResult.decisions;
        // новость должна описывать то, что реально произошло после запроса,
        // а не изначальное намерение бота до вмешательства (иначе текст
        // расходится с тем, что реально применяется к экономике)
        action = botRole === 'central_bank' ? redescribeCbAction(economy, cbPersonaId, eff)
          : redescribeMofAction(economy, mofPersonaId, eff);
      }
    }

    const cbStance = clamp((eff.keyRate - economy.inflationExpectations - economy.rStar) / 3, -1, 1);
    const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6
      - (eff.vatRate - economy.vatRate + eff.incomeTaxRate - economy.incomeTaxRate) * 0.3, -1, 1);

    // обещания считает движок в момент голосования: от них зависит доля голосов,
    // а не только строчка в новостях постфактум
    if (promises) eff = { ...eff, promises };
    const result = simulateQuarter({
      economy: { ...economy, cbStance, mofStance,
        policyCoordination: clamp(economy.policyCoordination + (reqResult ? reqResult.coordination : 0), 0, 100) },
      decisions: eff, pendingImpulses: extraImpulses.length ? [...pendingImpulses, ...extraImpulses] : pendingImpulses,
      eventCooldowns,
      difficulty, quarterIndex, stories, botAction: action,
      botActions: bothBots ? [mofAction] : [], publicMode: isTrader,
    });
    if (dirResult) {
      const who = dirResult.toCb ? 'ПРЕЗИДЕНТ → ЦБ' : 'ПРЕЗИДЕНТ → МИНФИН';
      result.newsEntries.unshift({ id: `dir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${dirResult.req.label.toUpperCase()} — ${dirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : dirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${dirResult.ask}» ${dirResult.text}${dirResult.credibilityHit
          ? ' Исполненное политическое указание ЦБ рынок читает как потерю независимости — доверие к денежной политике снижается.'
          : dirResult.status === 'rejected' ? ' Публичный отказ ведомства добавляет напряжения в отношения ветвей власти.' : ''}` });
      setLastDirective({ status: dirResult.status, text: dirResult.text });
    }
    if (reqResult) {
      const who = botRole === 'central_bank' ? 'ЦБ → МИНФИН' : 'МИНФИН → ЦБ';
      result.newsEntries.unshift({ id: `req${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${reqResult.req.label.toUpperCase()} — ${reqResult.status === 'accepted' ? 'СОГЛАСОВАНО' : reqResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${reqResult.ask}» ${reqResult.text} Согласованность политики ${reqResult.coordination > 0 ? 'выросла' : 'снизилась'} на ${Math.abs(reqResult.coordination)} пункта.` });
      setLastResponse({ status: reqResult.status, text: reqResult.text });
      setPendingRequest(null);
    }
    let traderEvents = [];
    let bookVal = null;
    if (isTrader) {
      const withBench = portfolio.benchStart ? portfolio : { ...portfolio, benchStart: { stockIndex: economy.stockIndex, bondIndex: economy.bondIndex,
        depositIndex: economy.depositIndex, priceLevel: economy.priceLevel } };
      const nb = settleQuarter(withBench, result.economy);
      traderEvents = nb.lastEvents || [];
      traderEvents.forEach((ev, i) => {
        if (ev.kind === 'call') { Audio.play('alarm'); haptic([60, 80, 60]); }
        result.newsEntries.unshift({ id: `trd${quarterIndex}_${i}`, cat: ev.kind === 'call' ? 'crisis' : 'markets',
          priority: ev.kind === 'call' ? 9 : 5, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: ev.kind === 'call' ? 'МАРЖИН-КОЛЛ: ПОЗИЦИИ ЗАКРЫТЫ ПРИНУДИТЕЛЬНО' : 'РАСЧЁТЫ ПО ВАШИМ ПОЗИЦИЯМ',
          text: ev.text });
      });
      setPortfolio(nb);
      bookVal = bookValue(nb, result.economy, null);
    }
    setEconomy(result.economy);
    const newHistory = [...history, { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy }];
    setHistory(newHistory);
    pushAch(unlockAchievements(questProgressAchievementIds({
      quarterIndex, economy: result.economy, history: newHistory, lastEvents: traderEvents,
      rolesPlayed: recordRolePlayed(setup.role), networkPlayed: isNetworkPlayed(), role: setup.role,
    })));
    const nextDefeat = checkDefeat({ role: setup.role, economy: result.economy, history: newHistory, bookVal,
      presidentActive: presEnabled });
    if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setLastReasons(result.reasons);
    setLastReport(result.report);
    if (presEnabled && presidentPlan) {
      const dir = presidentPlan.directive;
      if (dir && dir.toPlayer) {
        const verdict = directiveVerdict(directiveMet);
        const pct = Number.isFinite(directiveMet) ? Math.round(directiveMet * 100) : null;
        const word = verdict === 'met' ? 'ВЫПОЛНЕНО' : verdict === 'partial' ? 'ВЫПОЛНЕНО ЧАСТИЧНО'
          : verdict === 'ignored' ? 'ПРОИГНОРИРОВАНО' : 'БЕЗ ОТВЕТА';
        result.newsEntries.unshift({ id: `presdir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: `${presDirMemo.lastReqId === dir.reqId
            ? `ПРЕЗИДЕНТ ВНОВЬ ТРЕБУЕТ ОТ ${playerBranch === 'monetary' ? 'ЦБ' : 'МИНФИНА'}`
            : `ПРЕЗИДЕНТ → ${playerBranch === 'monetary' ? 'ЦБ' : 'МИНФИН'}`}: ${dir.req.label.toUpperCase()} — ${word}`,
          text: `«${dir.ask || askText(dir.req, 1, 'president')}» ${verdict === 'met'
            ? 'Ведомство пошло навстречу — администрация это отметила.'
            : verdict === 'partial'
              ? `Ведомство сделало примерно ${pct}% запрошенного. В администрации это считают полумерой.`
              : verdict === 'ignored'
                ? 'Ведомство поступило по-своему. В администрации президента это запомнят.'
                : 'Требование осталось без внятного ответа.'}` });
      } else if (presDirResult) {
        result.newsEntries.unshift({ id: `presdir${quarterIndex}`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: `ПРЕЗИДЕНТ → ${presDirResult.toCb ? 'ЦБ' : 'МИНФИН'}: ${presDirResult.req.label.toUpperCase()} — ${presDirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : presDirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
          text: `«${presDirResult.ask}» ${presDirResult.text}` });
      }
      if (presidentPlan.appointBot) {
        const ap = presidentPlan.appointBot;
        if (ap.kind === 'central_bank') setCbPersonaId(ap.persona); else setMofPersonaId(ap.persona);
      }
      // в тихий квартал не затираем прошлую запись: иначе строка «в прошлый раз»
      // мигает и исчезает, хотя требование как раз и остаётся в силе
      if (presidentPlan.directive || presidentPlan.actions.length) {
        setPresidentLast({ directiveMet, label: presidentPlan.directive ? presidentPlan.directive.req.label : null,
          toPlayer: !!(presidentPlan.directive && presidentPlan.directive.toPlayer),
          // указание соседнему ведомству тоже имеет исход — ответ бота, а не «передано»
          status: presDirResult ? presDirResult.status : null,
          actions: presidentPlan.actions.map((id) => (PRES_BY_ID[id] || {}).label).filter(Boolean) });
      }
      const nextCb = presidentPlan.appointBot && presidentPlan.appointBot.kind === 'central_bank' ? presidentPlan.appointBot.persona : cbPersonaId;
      const nextMof = presidentPlan.appointBot && presidentPlan.appointBot.kind === 'ministry_finance' ? presidentPlan.appointBot.persona : mofPersonaId;
      const memo = presidentPlan.directive
        ? { lastReqId: presidentPlan.directive.reqId, ago: 0 }
        : { lastReqId: presDirMemo.lastReqId, ago: Math.min(99, presDirMemo.ago + 1) };
      setPresDirMemo(memo);
      setPresidentPlan(botPresident(result.economy, presPersonaId, difficulty,
        { playerBranch, cooldowns: result.eventCooldowns, cbPersonaId: nextCb, mofPersonaId: nextMof,
          lastReqId: memo.lastReqId, lastDirectiveAgo: memo.ago }));
    }
    setDecisionsBaseline(defaultDecisions(result.economy, decisions));
    setBotAction(action);
    setBotAction2(bothBots ? mofAction : null);
    if (isPresident) {
      // назначение вступает в силу со следующего квартала: решение уже оплачено
      // и объявлено, дальше ведомство ведёт новый человек
      if (presAppointCb) setCbPersonaId(presAppointCb);
      if (presAppointMof) setMofPersonaId(presAppointMof);
      // «Своими руками» — именно вернуть парламент, распущенный указом, а не тот,
      // который распустил кризис: decreeRule до квартала как раз это и означает
      if (presActions.includes('restore_parliament') && economy.decreeRule) pushAch(unlockAchievements(['own_hands']));
      setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1);
    }
    setStories(result.stories);
    setNewsFeed((f) => [...result.newsEntries, ...f].slice(0, 220));
    // после проигранных выборов новая власть меняет руководство ведомства
    const er = result.economy.electionResult;
    if (er && er !== 'incumbent' && botRole) {
      const changeCb = botRole === 'central_bank' && er === 'landslide';
      const changeMof = botRole === 'ministry_finance';
      if (changeMof) {
        const np = personaAfterElection('ministry_finance', result.economy);
        if (np !== mofPersonaId) {
          setMofPersonaId(np);
          result.newsEntries.unshift({ id: `pers${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
            headline: `НОВЫЙ МИНИСТР ФИНАНСОВ: ${getMofPersona(np).name.toUpperCase()}`,
            text: `${getMofPersona(np).title}. ${getMofPersona(np).desc} Вам предстоит работать с другим бюджетом и другой логикой расходов.` });
        }
      }
      if (changeCb) {
        const np = personaAfterElection('central_bank', result.economy);
        if (np !== cbPersonaId) {
          setCbPersonaId(np);
          result.newsEntries.unshift({ id: `pers${quarterIndex}`, cat: 'cb', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
            headline: `СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА: ${getCbPersona(np).name.toUpperCase()}`,
            text: `${getCbPersona(np).title}. ${getCbPersona(np).desc} Смена руководства ЦБ после выборов — всегда вопрос к независимости политики и к тому, чего стоят её обещания.` });
        }
      }
    }
    // предвыборные обещания подводятся в тот же квартал, когда выборы наступили
    // (quartersToElection обнулился и сформировал electionResult) — не раньше:
    // формально срок ещё не закончился, пока не наступил сам день голосования
    if (promises && er) {
      const kept = promises.map((p) => evaluatePromise(p, result.economy).met);
      const keptCount = Number.isFinite(result.economy.promisesKept) ? result.economy.promisesKept : kept.filter(Boolean).length;
      const broken = promises.length - keptCount;
      result.newsEntries.unshift({ id: `promises${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `ОБЕЩАНИЯ У УРНЫ: СДЕРЖАНО ${keptCount} ИЗ ${promises.length}`,
        text: `${promises.map((p, i) => `«${p.label}» — ${kept[i] ? 'сдержано' : 'провалено'}`).join('; ')}. ${
          keptCount > broken ? `Это добавило власти примерно ${fmt1((keptCount - broken) * 2.2)} п.п. голосов.`
            : keptCount < broken ? `Это стоило власти примерно ${fmt1((broken - keptCount) * 2.2)} п.п. голосов.`
              : 'На итог голосования обещания в сумме не повлияли.'}` });
      if (keptCount === promises.length) pushAch(unlockAchievements(['promises_kept']));
      if (er === 'incumbent') {
        // старые обещания подведены итогом выше — но откуда взяться новым,
        // если их никто не объявил? Без этой новости обещания в шапке менялись
        // молча, и на следующий день после выборов было не понять, что вообще
        // изменилось в условиях игры
        const nextPromises = pickPromises(result.economy);
        setPromises(nextPromises);
        result.newsEntries.unshift({ id: `newpromises${quarterIndex}`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: 'НОВЫЙ СРОК: ОБЪЯВЛЕНЫ ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ',
          text: `На новый срок заявлено: ${nextPromises.map((p) => `«${p.label}» — ${p.text.toLowerCase()}`).join('; ')}.` });
      }
    }
    const newCrisis = (result.economy.activeCrises || []).some((c) => !(economy.activeCrises || []).includes(c));
    if (newCrisis) { setFlashKey(quarterIndex); setShake(true); haptic([45, 70, 45, 70, 90]); setTimeout(() => setShake(false), 950); }
    else if (result.economy.regime !== economy.regime) { setFlashKey(quarterIndex); haptic([28, 60, 28]); }
    else haptic(14);
    Audio.quarterSequence({
      wellbeingDelta: result.economy.wellbeing - economy.wellbeing,
      newCrisis,
      bigNews: result.newsEntries.some((n) => n.priority >= 8),
    });
    setDecisions(defaultDecisions(result.economy, decisions));
    setQuarterIndex((q) => q + 1);
    setBusy(false);
  }, [economy, decisions, pendingImpulses, eventCooldowns, setup, quarterIndex, botRole, stories, cbPersonaId, mofPersonaId,
    pendingRequest, portfolio, isTrader, isPresident, bothBots, history, pushAch, defeat, promises,
    presActions, presAppointCb, presAppointMof, presDirective, presDirStrength,
    presEnabled, presidentPlan, presPersonaId, playerBranch, decisionsBaseline, presDirMemo]);

  const setLever = (id, val) => setDecisions((dd) => ({ ...dd, [id]: val }));

  // музыка следует за режимом экономики и уровнем рисков
  React.useEffect(() => { Audio.setMood(economy); },
    [economy.regime, economy.inflationRisk, economy.bankingRisk, economy.debtRisk, economy.recessionRisk, economy.gdpGrowth]);
  React.useEffect(() => { Audio.setRole(setup.role === 'trader' ? 'trader' : null); }, [setup.role]);
  React.useEffect(() => () => Audio.stopMusic(), []);
  const kpiDelta = (key) => economy[key] - prevEcon[key];
  const shareKey = (id) => (id === 'shareHealth' ? 'health' : id === 'shareEducation' ? 'education' : id === 'shareScience' ? 'science' : id === 'shareDefense' ? 'defense' : 'admin');

  return (
    <div className={`ems-root${shake ? ' ems-shake' : ''}${dense ? ' ems-dense' : ''}`} lang="ru">
      <GlobalStyle />
      {irf && (
        <Suspense fallback={(
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ems-panel-raised" style={{ padding: 18, color: COLOR.faint, fontSize: 12 }}>Загрузка графика…</div>
          </div>
        )}>
          <IRFModal economy={economy} decisions={decisions} lever={irf.lever} value={irf.value} baseValue={irf.base}
            difficulty={difficulty} onClose={() => setIrf(null)} />
        </Suspense>
      )}
      <Atmosphere regime={economy.regime} flashKey={flashKey}
        intensity={clamp((economy.inflationRisk * 0.25 + economy.bankingRisk * 0.3 + economy.debtRisk * 0.2 + economy.recessionRisk * 0.25) / 100, 0, 1)} />
      {showWhy && <WhyModal reasons={lastReasons} onClose={() => setShowWhy(false)} />}
      {showPaper && <NewspaperModal news={newsFeed} history={history} quarterIndex={quarterIndex} economy={economy} onClose={() => setShowPaper(false)} />}
      {saveModal && <SaveLoadModal mode={saveModal} snapshot={snapshot()} onClose={() => setSaveModal(null)}
        onLoad={(d) => { setSaveModal(null); onLoadState(d); }} />}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} leaving={achLeaving} />
      {defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={onRestart} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }} />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: setup.role, quarterIndex, economy, startEconomy: history[0], portfolio, defeat, promises,
      })} />}

      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ems-card-icon" style={{ width: 40, height: 40 }}>
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            <div className="ems-serif" style={{ fontSize: 18 }}>Страна — экономическая панель</div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              {roleDef.title} · сложность: {(DIFFICULTIES.find((x) => x.id === difficulty) || {}).title}
              {activeBotPersona ? ` · вторая ветвь: ${activeBotPersona.name} (бот)`
                : isPresident ? ` · ЦБ: ${getCbPersona(cbPersonaId).name} (бот) · Минфин: ${getMofPersona(mofPersonaId).name} (бот)`
                  : setup.role === 'trader' ? '' : ' · без ботов'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', rowGap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: COLOR.muted }}>Текущий период</div>
            <div className="ems-mono ems-serif" style={{ fontSize: 15, fontWeight: 600 }}>{quarterLabel(quarterIndex)}</div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: COLOR.muted, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
              <Flag size={11} />{economy.noElections ? 'Выборы отменены' : `Выборы через ${economy.quartersToElection} кв.`}
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>
              <span style={{ color: COLOR.muted }}>рейтинг власти </span>
              <span className="ems-mono" style={{ color: economy.approval >= 50 ? COLOR.teal : economy.approval >= 40 ? COLOR.gold : COLOR.rust, fontWeight: 600 }}>{Math.round(economy.approval)}</span>
            </div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: COLOR.muted, marginBottom: 2 }}>Благополучие</div>
            <Gauge value={economy.wellbeing} size={74} />
          </div>
          <div style={{ display: 'flex', gap: 3, marginRight: 4 }}>
            {[['dash', 'Панель', GaugeIcon], ['market', 'Рынок', TrendingUp], ...(isTrader ? [['casino', 'Казино', Dices]] : [])].map(([id, label, Icon]) => (
              <button key={id} className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                background: view === id ? COLOR.gold : COLOR.panelAlt, color: view === id ? COLOR.ink : COLOR.text, borderColor: view === id ? COLOR.gold : COLOR.border }}
                onClick={() => { Audio.play('tab'); setView(id); }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
          <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { Audio.play('click'); setSaveModal('save'); }} title="Сохранить или загрузить партию">
            <Save size={14} />Партия
          </button>
          <div style={{ position: 'relative' }}>
            <select value={difficulty} onChange={(e) => { Audio.play('tab'); setDifficulty(e.target.value); }}
              title="Сложность партии" className="ems-btn"
              style={{ padding: '7px 26px 7px 9px', fontSize: 11.5, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
              {DIFFICULTIES.map((d) => (<option key={d.id} value={d.id}>{d.title}</option>))}
            </select>
            <ChevronDown size={12} color={COLOR.muted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <ViewSettings theme={theme} setTheme={setTheme} dense={dense} setDense={setDense}
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash}
            deleteDash={deleteDash} renameDash={renameDash} resetDash={resetDash}
            layoutEditMode={layout.layoutEditMode} setLayoutEditMode={layout.setLayoutEditMode}
            columnOrder={layout.columnOrder} moveColumn={layout.moveColumn}
            resetLayout={layout.resetLayout} layoutIsDefaultNow={layout.layoutIsDefaultNow} />
          <AudioControls />
          <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowCard(true); }} title="Карточка результата">
            <Share2 size={14} color={COLOR.gold} />
          </button>
          <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowAch(true); }} title="Коллекция достижений">
            <Trophy size={14} color={COLOR.gold} />
          </button>
          <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { Audio.play('paper'); setShowPaper(true); }} title="Экономический вестник">
            <Newspaper size={14} />Газета
          </button>
          <button className="ems-btn" style={{ padding: '7px 9px' }} title="Выйти в меню"
            onClick={() => { if (window.confirm('Выйти в меню? Несохранённый прогресс партии будет потерян — при необходимости сохраните её кнопкой «Партия».')) { Audio.play('click'); onRestart(); } }}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <CrisisBar economy={economy} botAction={botAction} />

      <div style={{ padding: '14px 18px 4px' }}>
        <div className="ems-kpi-strip">
          {pinned.map((key) => {
            const m = ALL_METRICS[key];
            if (!m) return null;
            const val = economy[key];
            return (
              <div key={key} draggable
                onDragStart={(e) => { setDragPin(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from) reorderPin(from, key); setDragPin(null); }}
                onDragEnd={() => setDragPin(null)}
                style={{ position: 'relative', opacity: dragPin === key ? 0.4 : 1, cursor: 'grab' }}>
                <KpiTile label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'} delta={kpiDelta(key)} invert={m.invert} series={history.slice(-8).map((h) => h[key]).filter(Number.isFinite)} />
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <button onClick={() => { Audio.play('tick'); movePin(key, -1); }} aria-label="Левее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>◀</button>
                  <button onClick={() => { Audio.play('tick'); movePin(key, 1); }} aria-label="Правее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>▶</button>
                  <button onClick={() => { Audio.play('tick'); togglePin(key); }} aria-label={`Убрать ${m.label} с полосы`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          {pinned.length < MAX_PINS && (
            <div className="ems-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed' }}>
              <span style={{ fontSize: 10.5, color: COLOR.faint, textAlign: 'center', lineHeight: 1.4 }}>
                <Star size={12} style={{ verticalAlign: -2 }} /> закрепите любой показатель<br />звёздочкой в таблице справа
              </span>
            </div>
          )}
        </div>
        <div className="ems-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10, padding: '9px 13px' }}>
          <RiskBadge label="Инфляционный" value={economy.inflationRisk} />
          <RiskBadge label="Банковский" value={economy.bankingRisk} />
          <RiskBadge label="Долговой" value={economy.debtRisk} />
          <RiskBadge label="Рецессии" value={economy.recessionRisk} />
          <RiskBadge label="Валютный" value={economy.currencyRisk} />
        </div>
      </div>

      <div style={{ margin: '10px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!isTrader && <DemandStrip botAction={botAction} botAction2={isPresident ? botAction2 : null}
          botRole={isPresident ? 'central_bank' : botRole} economy={economy}
          president={presEnabled && presidentPlan && presidentPlan.directive && presidentPlan.directive.toPlayer ? presidentPlan : null} />}
        <RegimeBanner economy={economy} />
        {(economy.activeCrises || []).filter((c) => c !== economy.regime).map((c) => (
          <div key={c} className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '8px 11px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>{CRISIS_INFO[c] ? regimeInfoLabel(CRISIS_INFO[c], economy) : c}.</b> <span style={{ color: COLOR.muted }}>{CRISIS_INFO[c] ? regimeInfoText(CRISIS_INFO[c], economy) : ''}</span></span>
          </div>
        ))}
      </div>

      {view === 'market' && (
        <MarketScreen economy={economy} prev={prevEcon} history={history}
          book={isTrader ? portfolio : null} onTrade={onTrade} />
      )}

      {view === 'casino' && isTrader && (
        <div style={{ padding: '0 18px 18px' }}>
          <CasinoScreen book={portfolio} onCasino={onCasino} />
        </div>
      )}

      {narrow && view === 'dash' && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
          {[['left', setup.role === 'trader' ? 'Капитал' : 'Решения'], ['center', 'Новости и графики'], ['right', 'Показатели']].map(([id, label]) => (
            <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 11.5,
              background: mobileCol === id ? COLOR.gold : COLOR.panelAlt, color: mobileCol === id ? COLOR.ink : COLOR.text,
              borderColor: mobileCol === id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setMobileCol(id); }}>{label}</button>
          ))}
        </div>
      )}

      {(() => {
      /* ЛЕВАЯ ПАНЕЛЬ */
      const leftNode = (
        <div className={narrow && mobileCol !== 'left' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isTrader && (
            <PortfolioSummary book={portfolio} economy={economy} live={null} goal={setup.goal}
              prevValue={portfolio.history && portfolio.history.length > 1 ? portfolio.history[portfolio.history.length - 2] : null} />
          )}
          {isTrader && (
            <div className="ems-panel" style={{ padding: 12, fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>
              Торговля идёт на вкладке <b style={{ color: COLOR.text }}>«Рынок»</b>: там терминал с ценами, которые
              меняются в реальном времени. Сделки исполняются мгновенно по текущей котировке, плечо ограничено 60% капитала
              и стоит ставку по кредитам.
            </div>
          )}
          {isPresident && (
            <>
              <PresidentPanel economy={economy} cooldowns={eventCooldowns}
                selected={presActions} setSelected={setPresActions}
                cbPersonaId={cbPersonaId} mofPersonaId={mofPersonaId}
                appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                directive={presDirective} setDirective={setPresDirective} lastDirective={lastDirective}
                directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              <div className="ems-panel" style={{ padding: 12, fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>
                Приоритет: <b style={{ color: COLOR.text }}>{goalDef.label}</b>. Ставку ведёт бот-ЦБ, бюджет — бот-Минфин;
                их решения и заявления ниже. Вы влияете на экономику только через людей, которых назначаете, указания,
                которые они могут не выполнить, и реформы, которые окупятся уже при следующем президенте.
              </div>
            </>
          )}
          {!isTrader && !isPresident && (
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
              <RoleIcon size={14} />Ваши полномочия
            </div>
            <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 10 }}>Приоритет: {goalDef.label}</div>

            {crisisActive && (
              <div style={{ paddingBottom: 10 }}>
                <button className="ems-btn" style={{ width: '100%', background: decisions.emergency ? COLOR.rust : COLOR.panelAlt, color: decisions.emergency ? '#fff' : COLOR.text, borderColor: COLOR.rust }}
                  onClick={() => { Audio.play(decisions.emergency ? 'click' : 'alarm'); setLever('emergency', !decisions.emergency); }}>
                  {decisions.emergency ? <Check size={13} style={{ verticalAlign: -2 }} /> : <ShieldAlert size={13} style={{ verticalAlign: -2 }} />} Экстренная поддержка банков
                </button>
                <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>Спасёт капитал банков, но ударит по доверию к ЦБ и добавит инфляции.</div>
              </div>
            )}

            {groups.includes('fiscal') && debtCrisisActive && (
              <div style={{ paddingBottom: 10 }}>
                <button className="ems-btn" style={{ width: '100%', background: COLOR.panelAlt, color: COLOR.text, borderColor: COLOR.rust }}
                  onClick={() => {
                    if (!window.confirm('Объявить дефолт по государственному долгу? Часть долга спишется разом, но рынок закроется для новых займов на несколько кварталов, а доверие резко упадёт. Отменить это решение будет нельзя.')) return;
                    Audio.play('alarm'); setLever('sovereignDefault', true);
                  }}>
                  <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Объявить дефолт по госдолгу
                </button>
                <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>
                  Спишет часть долга разом вместо очередного секвестра, но закроет рынок для новых займов на несколько кварталов и сильно ударит по доверию. Разовое и необратимое решение.
                </div>
              </div>
            )}

            {LEVER_TABS.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
                {LEVER_TABS.map((t) => (
                  <span key={t.id} className={`ems-tab ${levTab === t.id ? 'active' : ''}`} style={{ fontSize: 10.5, padding: '4px 8px' }}
                    onClick={() => { Audio.play('tab'); setLevTab(t.id); }}>{t.label}</span>
                ))}
              </div>
            )}

            {levTab === 'monetary-core' && (
              <div>
                {levers.filter((l) => l.group === 'monetary' && l.subgroup === 'core').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} />
                ))}
                <Segmented label="Режим валютного курса" options={FX_REGIMES} value={decisions.fxRegime} onChange={(v) => setLever('fxRegime', v)} />
              </div>
            )}
            {levTab === 'monetary-macropru' && (
              <div>
                {levers.filter((l) => l.group === 'monetary' && l.subgroup === 'macropru').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-core' && (
              <div>
                {economy.sequesterFactor < 0.995 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 4, padding: '8px 10px', marginBottom: 10 }}>
                    <AlertTriangle size={14} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.45 }}>
                      <b>Секвестр действует.</b> Рынок не финансирует дефицит сверх {fmt1(economy.maxDeficitPct)}% ВВП — реальные расходы урезаны на {fmt1((1 - economy.sequesterFactor) * 100)}% от плана независимо от того, что задано ползунками ниже.
                    </div>
                  </div>
                )}
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'core').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-taxes' && (
              <div>
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'taxes').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-budget' && (
              <div>
                <div style={{ fontSize: 10.5, color: COLOR.faint, margin: '2px 0 8px', lineHeight: 1.4 }}>Доли нормализуются к 100%. Образование и здравоохранение растят человеческий капитал, наука — производительность. Эффект — годы, не кварталы.</div>
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'budget').map((l) => (
                  <LeverSlider key={l.id} lever={l} currentDisplay={economy.budgetShares[shareKey(l.id)]}
                    value={decisions[l.id]} onChange={(v) => setLever(l.id, v)} preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} />
                ))}
              </div>
            )}
          </div>
          )}
          <RequestPanel role={setup.role} botRole={botRole} pending={pendingRequest} setPending={setPendingRequest} lastResponse={lastResponse} />
          {groups.includes('fiscal') && <FiscalMath economy={economy} decisions={decisions} />}
          {isTrader ? (
            <InstitutionsPanel economy={economy} cbAction={botAction} mofAction={botAction2} />
          ) : isPresident ? (
            <>
              <PromisesPanel promises={promises} economy={economy} />
              <BotPanel botRole="central_bank" persona={getCbPersona(cbPersonaId)} lastAction={botAction} coordination={economy.policyCoordination} />
              <BotPanel botRole="ministry_finance" persona={getMofPersona(mofPersonaId)} lastAction={botAction2} coordination={economy.policyCoordination} />
            </>
          ) : botRole ? (
            <BotPanel botRole={botRole} persona={activeBotPersona} lastAction={botAction} coordination={economy.policyCoordination} />
          ) : (
            <PromisesPanel promises={promises} economy={economy} />
          )}
          {presEnabled && <PresidentWatchPanel economy={economy} plan={presidentPlan} last={presidentLast} branch={playerBranch} />}
        </div>
      );
      /* ЦЕНТР */
      const centerNode = (
        <div className={narrow && mobileCol !== 'center' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <NewsTerminal items={newsFeed} onOpenPaper={() => setShowPaper(true)} />
          <Suspense fallback={<ChartFallback />}>
            <ChartPanel history={history} chartGroup={chartGroup} setChartGroup={setChartGroup} hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
          </Suspense>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Квартальный отчёт</span>
              {lastReport && <button className="ems-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => { Audio.play('click'); setShowWhy(true); }}><Info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Почему это произошло?</button>}
            </div>
            {/* официальный бюллетень, но в палитре кабинета, а не полноцветной «Газеты»:
                двойная линейка сохраняет жанр, фон и текст остаются тёмными */}
            <div style={{ background: COLOR.panelRaised, color: COLOR.text, padding: '16px 18px',
              borderTop: `3px double ${COLOR.gold}`, borderLeft: `1px solid ${COLOR.border}`,
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              {lastReport ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${COLOR.border}`, paddingBottom: 8, marginBottom: 10 }}>
                    <span className="ems-serif" style={{ fontSize: 14, fontWeight: 700 }}>{history[history.length - 1].label}</span>
                    <span className="ems-mono" style={{ fontSize: 9, color: COLOR.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>бюллетень · {roleDef.short}</span>
                  </div>
                  <div className="ems-serif" style={{ fontSize: 13, lineHeight: 1.65 }} role="status" aria-live="polite">{lastReport}</div>
                </>
              ) : (
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.muted }}>Настройте политику слева и завершите первый квартал. Помните: между решением и результатом стоит цепочка — ставка меняет стоимость кредита, кредит меняет спрос, спрос меняет цены.</div>
              )}
            </div>
          </div>
        </div>
      );
      /* ПРАВАЯ ПАНЕЛЬ */
      const rightNode = (
        <div className={narrow && mobileCol !== 'right' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ScorePanel economy={economy} prev={prevEcon} goalDef={goalDef} />
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 9 }}>Показатели экономики</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 11 }} className="ems-scroll">
              {tabs.map((t) => {
                const TabIcon = t.icon;
                return (
                  <span key={t.id} className={`ems-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setActiveTab(t.id); }}>
                    {TabIcon && <TabIcon size={12} />}{t.label}
                  </span>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(tabs.find((t) => t.id === activeTab) || tabs[0]).rows.map((row, i, arr) => {
                const val = row.get ? row.get(economy) : economy[row.key];
                const prevVal = row.get ? row.get(prevEcon) : prevEcon[row.key];
                const delta = Number.isFinite(prevVal) && Number.isFinite(val) ? val - prevVal : 0;
                if (row.text) {
                  return (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${COLOR.hairline}` : 'none' }}>
                      <span style={{ color: COLOR.muted }}>{row.label}</span>
                      <span className="ems-mono">{(row.map && row.map[val]) || String(val || '—')}</span>
                    </div>
                  );
                }
                return (
                  <div key={row.label || row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${COLOR.hairline}` : 'none' }}>
                    <span style={{ color: COLOR.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ALL_METRICS[row.key] && <PinButton active={pinned.includes(row.key)} onClick={() => togglePin(row.key)} />}
                      {row.label}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="ems-mono">{Number.isFinite(val) ? row.fmt(val) : '—'}</span>
                      {row.noDelta ? <span style={{ width: 34 }} /> : <DeltaTag value={delta} invert={METRIC_INVERT.has(row.key)} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {!isTrader && <DemandsPanel demands={economy.demands} />}
        </div>
      );
      const nodes = { left: leftNode, center: centerNode, right: rightNode };
      const order = layout.wide ? layout.columnOrder : DEFAULT_COLUMN_ORDER;
      const colWidthFor = (id) => (id === 'center' ? 'minmax(0,1fr)' : `${layout.columnWidths[id]}px`);
      const gridStyle = { padding: 18, display: view === 'dash' ? undefined : 'none',
        ...(layout.wide ? { gridTemplateColumns: order.map(colWidthFor).join(' ') } : null) };
      return (
        <div className="ems-grid" style={gridStyle}>
          {order.map((id, i) => (
            <div key={id} style={{ position: 'relative', minWidth: 0 }}>
              {nodes[id]}
              {layout.wide && layout.layoutEditMode && i < order.length - 1 && (
                <ColumnResizeHandle leftId={id} rightId={order[i + 1]} widths={layout.columnWidths}
                  onResize={layout.setColumnWidthsLive} onCommit={layout.commitWidths} />
              )}
            </div>
          ))}
        </div>
      );
      })()}

      {defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={onRestart} />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
          boxShadow: '0 -6px 20px -10px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize: 11.5, color: COLOR.faint, marginRight: 'auto' }}>
            {botRole === 'both' ? 'Центральный банк и Минфин примут решения без вашего участия'
              : botRole ? `${botRole === 'central_bank' ? 'Центральный банк' : 'Минфин'} примет своё решение одновременно с вами`
                : 'Обе ветви политики под вашим контролем'}
          </span>
          <button className="ems-btn primary" style={{ padding: '12px 26px', fontSize: 13.5 }} disabled={busy} onClick={finishQuarter}
            aria-label="Завершить квартал и применить решения">
            {busy ? 'Обработка…' : 'Завершить квартал'}
          </button>
        </div>
      )}
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
        <div className="ems-mono" style={{ fontSize: 11, color: COLOR.faint, background: COLOR.panelAlt,
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
  const [setup, setSetup] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [theme, setThemeState] = useState('ink');
  const [network, setNetwork] = useState(null);
  // 'menu' — главная страница; 'setup' — анкета новой одиночной партии;
  // 'network' — лобби подключения на двоих. Ссылка-приглашение (?room=)
  // ведёт сразу в лобби, минуя меню.
  const [view, setView] = useState(() => (roomCodeFromUrl() ? 'network' : 'menu'));
  applyTheme(theme);
  const setTheme = (id) => { applyTheme(id); setThemeState(id); };
  const startLoaded = (data) => { setLoaded(data); setSetup(data.setup); setNonce((n) => n + 1); };
  const goMenu = () => setView('menu');
  // переключение между меню/анкетой/сетью/игрой не перезагружает страницу,
  // поэтому без явного сброса скролл оставался там, где был на предыдущем
  // экране — короткий новый экран открывался уже наполовину прокрученным
  const screenKey = network ? 'network-game' : setup ? 'game' : view;
  React.useEffect(() => { window.scrollTo(0, 0); }, [screenKey]);

  const backToMenu = () => { setNetwork(null); setLoaded(null); setSetup(null); goMenu(); };
  const screen = (() => {
    if (network) {
      return <NetworkGameScreen network={network} theme={theme} setTheme={setTheme} onExit={() => { setNetwork(null); goMenu(); }} />;
    }
    if (!setup) {
      if (view === 'setup') {
        return (
          <SetupScreen key={theme}
            onStart={(x) => { setLoaded(null); setSetup(x); }}
            onBack={goMenu}
          />
        );
      }
      if (view === 'network') {
        return <NetworkEntryScreen key={theme} onEnter={(net) => setNetwork(net)} onBack={goMenu} />;
      }
      if (view === 'tutorial') {
        return (
          <TutorialHub key={theme}
            onBack={goMenu}
            onStartRealGame={() => setView('setup')}
          />
        );
      }
      return (
        <MainMenu key={theme} theme={theme} setTheme={setTheme}
          onNewGame={() => setView('setup')}
          onNetwork={() => setView('network')}
          onTutorial={() => setView('tutorial')}
          onLoad={startLoaded}
        />
      );
    }
    return (
      <GameScreen key={`${JSON.stringify(setup)}:${nonce}`} setup={setup} initial={loaded}
        theme={theme} setTheme={setTheme}
        onRestart={() => { setLoaded(null); setSetup(null); goMenu(); }} onLoadState={startLoaded} />
    );
  })();
  return <ScreenErrorBoundary resetKey={screenKey} onMenu={backToMenu}>{screen}</ScreenErrorBoundary>;
}
