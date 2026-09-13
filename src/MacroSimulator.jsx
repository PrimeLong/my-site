import React, { useState, useMemo, useCallback } from 'react';
import { createRoom, joinRoom, submitDecisions, cancelSubmission, watchRoom, leaveRoom, fetchRoom, setRoomDifficulty, sendChatMessage, kickFromRoom,
  reportPortfolioValue, fetchSoloSlots, fetchSoloSlot, saveSoloSlot, deleteSoloSlot } from './lib/client.js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area,
} from 'recharts';
import {
  Landmark, Coins, Globe2, TrendingUp, Users, Activity, Newspaper, Factory, Scale, Banknote,
  ShieldAlert, ChevronDown, ChevronUp, Info, RotateCcw, ArrowUpRight, ArrowDownRight,
  X, Check, AlertTriangle, Bot, Gauge as GaugeIcon, Target, Zap, Volume2, VolumeX, Music, Save, Copy, Star, Flag, Megaphone, Sliders, Dices, Clock,
  Trophy, Lock, Share2, Download, GraduationCap,
} from 'lucide-react';
import {
  CONFIG, ROLES, DIFFICULTIES, GOALS, FX_REGIMES, LEVERS,
  CB_PERSONAS, MOF_PERSONAS, REQUESTS, REGIME_INFO, CRISIS_INFO, MANDATE_LABEL, regimeInfoText,
  clamp, fmt1, fmt2, fmtSigned1, pctFmt, fmtSignedPct, fmtMoney, fmtMoneySigned, romanQ, quarterLabel,
  defaultDecisions, getCbPersona, personaAfterElection, getMofPersona,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction, redescribeMofAction,
  simulateQuarter, makeInitialEconomy, leverPreview,
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
const COLOR = { ...THEMES.ink.colors };
let CURRENT_THEME = 'ink';
function applyTheme(id) {
  const t = THEMES[id] || THEMES.ink;
  Object.assign(COLOR, t.colors);
  CURRENT_THEME = t.id;
}const FONT = {
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
    .ems-panel { background:${COLOR.panel}; border:1px solid ${COLOR.border}; border-radius:4px; }
    .ems-panel-raised { background:${COLOR.panelRaised}; border:1px solid ${COLOR.borderStrong}; border-radius:4px; }
    .ems-hr { height:1px; background:${COLOR.hairline}; border:none; margin:0; }
    .ems-btn { font-family:${FONT.sans}; cursor:pointer; border:1px solid ${COLOR.border}; background:${COLOR.panelAlt}; color:${COLOR.text}; padding:8px 14px; border-radius:3px; font-size:13px; transition:background .15s, border-color .15s, transform .1s; }
    .ems-btn:hover { background:${COLOR.panelRaised}; border-color:${COLOR.borderStrong}; }
    .ems-btn:active { transform: scale(0.98); }
    .ems-btn.primary { background:${COLOR.gold}; color:${COLOR.ink}; border-color:${COLOR.gold}; font-weight:600; }
    .ems-btn.primary:hover { background:${COLOR.goldSoft}; border-color:${COLOR.goldSoft}; }
    .ems-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }
    .ems-slider { -webkit-appearance:none; width:100%; height:4px; background:${COLOR.border}; outline:none; border-radius:2px; }
    .ems-slider::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-slider::-moz-range-thumb { width:15px; height:15px; border-radius:50%; background:${COLOR.gold}; cursor:pointer; border:2.5px solid ${COLOR.bg}; box-shadow:0 0 0 1px ${COLOR.gold}; }
    .ems-scroll::-webkit-scrollbar { width:6px; height:6px; }
    .ems-scroll::-webkit-scrollbar-thumb { background:${COLOR.border}; border-radius:3px; }
    .ems-tab { padding:7px 12px; font-size:12.5px; cursor:pointer; border-radius:3px; color:${COLOR.muted}; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; transition:background .15s, color .15s; }
    .ems-tab:hover { color:${COLOR.text}; background:${COLOR.panelAlt}; }
    .ems-tab.active { color:${COLOR.ink}; background:${COLOR.gold}; font-weight:600; }
    .ems-tab.active:hover { background:${COLOR.goldSoft}; color:${COLOR.ink}; }
    .ems-fade-in { animation: emsFade .35s ease; }
    @keyframes emsFade { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
    @media (prefers-reduced-motion: reduce) { .ems-fade-in { animation:none; } .ems-btn, .ems-tab { transition:none; } }
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
    .ems-terminal { display:grid; grid-template-columns: minmax(230px, 0.85fr) minmax(300px, 1.15fr); }
    @media (max-width: 900px) { .ems-terminal { grid-template-columns: minmax(0,1fr); } }
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


const ROLE_ICON = { landmark: Landmark, coins: Coins, globe: Globe2, chart: TrendingUp };

/* ============================ ГРАФИКИ ============================ */
const CHART_GROUPS = [
  { id: 'output', label: 'Выпуск', series: [
    { id: 'gdp', label: 'ВВП', axis: 'left', color: COLOR.gold, fmt: 'money' },
    { id: 'potentialGdp', label: 'Потенциальный ВВП', axis: 'left', color: COLOR.blue, fmt: 'money' },
    { id: 'outputGap', label: 'Разрыв выпуска', axis: 'right', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'growth', label: 'Рост', series: [
    { id: 'gdpGrowth', label: 'Рост ВВП', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'potentialGrowth', label: 'Рост потенциала', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'consumptionGrowth', label: 'Потребление', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'investmentGrowth', label: 'Инвестиции', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'wageGrowth', label: 'Зарплаты', axis: 'left', color: '#8E7CC3', fmt: 'pct' },
  ] },
  { id: 'prices', label: 'Цены', series: [
    { id: 'inflation', label: 'Инфляция', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'coreInflation', label: 'Базовая инфляция', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'inflationExpectations', label: 'Ожидания', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'cbCredibility', label: 'Доверие к ЦБ', axis: 'right', color: COLOR.rust, fmt: 'idx' },
  ] },
  { id: 'money', label: 'Ставки', series: [
    { id: 'keyRate', label: 'Ключевая ставка', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'lendingRate', label: 'Ставка по кредитам', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'realLendingRate', label: 'Реальная ставка', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'rStar', label: 'Нейтральная ставка r*', axis: 'left', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'labor', label: 'Труд', series: [
    { id: 'unemployment', label: 'Безработица', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'nairu', label: 'Естественный уровень', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'wageGrowth', label: 'Рост зарплат', axis: 'right', color: COLOR.teal, fmt: 'pct' },
    { id: 'unitLaborCostGrowth', label: 'Удельные издержки труда', axis: 'right', color: COLOR.gold, fmt: 'pct' },
  ] },
  { id: 'banking', label: 'Банки', series: [
    { id: 'bankNPL', label: 'Просрочка', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'bankCapitalAdequacy', label: 'Достаточность капитала', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'creditGrowth', label: 'Рост кредита', axis: 'right', color: COLOR.gold, fmt: 'pct' },
    { id: 'creditGap', label: 'Кредитный разрыв', axis: 'right', color: COLOR.blue, fmt: 'pct' },
  ] },
  { id: 'government', label: 'Бюджет', series: [
    { id: 'debtToGdp', label: 'Госдолг к ВВП', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'deficitPctGdp', label: 'Дефицит бюджета', axis: 'right', color: COLOR.rust, fmt: 'pct' },
    { id: 'interestPctGdp', label: 'Процентные расходы', axis: 'right', color: COLOR.blue, fmt: 'pct' },
    { id: 'shadowShare', label: 'Теневая экономика', axis: 'right', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'external', label: 'Внешний сектор', series: [
    { id: 'exchangeRate', label: 'Курс (индекс)', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'realExchangeRate', label: 'Реальный курс', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'currentAccount', label: 'Текущий счёт', axis: 'right', color: COLOR.teal, fmt: 'money' },
    { id: 'netCapitalFlow', label: 'Приток капитала', axis: 'right', color: COLOR.rust, fmt: 'money' },
  ] },
  { id: 'potential', label: 'Потенциал', series: [
    { id: 'productivity', label: 'Производительность', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'humanCapitalIndex', label: 'Человеческий капитал', axis: 'left', color: COLOR.teal, fmt: 'idx' },
    { id: 'infrastructureIndex', label: 'Инфраструктура', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'potentialGrowth', label: 'Рост потенциала', axis: 'right', color: COLOR.rust, fmt: 'pct' },
  ] },
  { id: 'markets', label: 'Рынок', series: [
    { id: 'stockIndex', label: 'Индекс акций', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'bondIndex', label: 'Индекс облигаций', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'yield10y', label: 'Доходность 10 лет', axis: 'right', color: COLOR.teal, fmt: 'pct' },
    { id: 'yield3m', label: 'Доходность 3 месяца', axis: 'right', color: '#8E7CC3', fmt: 'pct' },
    { id: 'volatilityIndex', label: 'Индекс страха', axis: 'right', color: COLOR.rust, fmt: 'idx' },
  ] },
  { id: 'scores', label: 'Оценки', series: [
    { id: 'scoreStability', label: 'Стабильность', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'scoreWelfare', label: 'Благосостояние', axis: 'left', color: COLOR.teal, fmt: 'idx' },
    { id: 'scoreFinancial', label: 'Финансы', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'scoreFiscal', label: 'Бюджет', axis: 'left', color: COLOR.rust, fmt: 'idx' },
    { id: 'scorePotential', label: 'Потенциал', axis: 'left', color: '#8E7CC3', fmt: 'idx' },
  ] },
];
const PERIODS = [{ id: '1y', label: '1 год', q: 4 }, { id: '5y', label: '5 лет', q: 20 }, { id: '10y', label: '10 лет', q: 40 }, { id: 'all', label: 'Всё время', q: 1e9 }];
const axisTick = (fmtType) => (fmtType === 'money' ? (v) => Math.round(v).toLocaleString('ru-RU') : fmtType === 'idx' ? (v) => Math.round(v) : (v) => `${Math.round(v)}%`);
const tooltipVal = (fmtType) => (fmtType === 'money' ? (v) => fmtMoney(v) : fmtType === 'idx' ? (v) => fmt1(v) : (v) => `${fmt1(v)}%`);

const FORECAST_ANCHORS = {
  inflation: (e) => e.inflationTarget, coreInflation: (e) => e.inflationTarget,
  inflationExpectations: (e) => e.inflationTarget, gdpGrowth: (e) => e.potentialGrowth,
  potentialGrowth: (e) => e.potentialGrowth, unemployment: (e) => e.nairu, outputGap: () => 0,
  keyRate: (e) => e.rStar + e.inflationTarget, lendingRate: (e) => e.rStar + e.inflationTarget + 2,
  wageGrowth: (e) => e.inflationTarget + e.potentialGrowth, creditGrowth: (e) => e.potentialGrowth + e.inflationTarget,
};
const FORECAST_SIGMA = { inflation: 0.9, inflationExpectations: 0.5, gdpGrowth: 1.1, outputGap: 0.9,
  unemployment: 0.4, keyRate: 0.8, lendingRate: 0.9, wageGrowth: 1.0, stockIndex: 55, exchangeRate: 4 };

function ChartPanel({ history, chartGroup, setChartGroup, hiddenSeries, setHiddenSeries, period, setPeriod }) {
  const group = CHART_GROUPS.find((g) => g.id === chartGroup);
  const [forecast, setForecast] = useState(false);
  const panelCls = 'ems-panel ems-visual';
  const data = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period);
    const hist = history.slice(-p.q).map((h) => ({
      ...h,
      deficitPctGdp: -h.budgetBalancePctGdp,
      interestPctGdp: h.gdp ? (h.interestPayment / h.gdp) * 100 : 0,
    }));
    if (!forecast || !hist.length) return hist;
    // веер неопределённости: инерционный прогноз к якорю с расширяющимися границами
    const last = hist[hist.length - 1];
    const vis = group.series.filter((x) => !hiddenSeries.includes(x.id));
    const lead = vis[0];
    const out = hist.map((h) => ({ ...h, fanBand: null }));
    if (!lead) return out;
    const anchorFn = FORECAST_ANCHORS[lead.id];
    const anchor = anchorFn ? anchorFn(last) : last[lead.id];
    const sigma = FORECAST_SIGMA[lead.id] || Math.max(0.4, Math.abs(last[lead.id] || 1) * 0.06);
    let v = last[lead.id];
    for (let i = 1; i <= 8; i++) {
      v += (anchor - v) * 0.28;
      const sd = sigma * Math.sqrt(i) * 0.9;
      out.push({ label: `+${i} кв.`, forecastPoint: true,
        [`${lead.id}__f`]: v, fanBand: [v - 1.96 * sd, v + 1.96 * sd], fanInner: [v - sd, v + sd] });
    }
    out[hist.length - 1] = { ...out[hist.length - 1], [`${lead.id}__f`]: last[lead.id],
      fanBand: [last[lead.id], last[lead.id]], fanInner: [last[lead.id], last[lead.id]] };
    return out;
  }, [history, period, forecast, chartGroup, hiddenSeries]);

  const toggleSeries = (id) => setHiddenSeries((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const visible = group.series.filter((s) => !hiddenSeries.includes(s.id));
  const leftDef = visible.find((s) => s.axis === 'left');
  const rightDef = visible.find((s) => s.axis === 'right');
  const seriesById = Object.fromEntries(group.series.map((s) => [s.id, s]));

  return (
    <div className={panelCls} style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>График экономики</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 11, background: forecast ? COLOR.gold : COLOR.panelAlt,
            color: forecast ? COLOR.ink : COLOR.text, borderColor: forecast ? COLOR.gold : COLOR.border }}
            onClick={() => { Audio.play('tab'); setForecast((f) => !f); }} title="Веер неопределённости на 8 кварталов вперёд">
            прогноз
          </button>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { Audio.play('tab'); setPeriod(p.id); }} className="ems-btn" style={{ padding: '4px 9px', fontSize: 11, background: period === p.id ? COLOR.gold : COLOR.panelAlt, color: period === p.id ? COLOR.ink : COLOR.text, borderColor: period === p.id ? COLOR.gold : COLOR.border }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ems-scroll" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${COLOR.border}`, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {CHART_GROUPS.map((g) => (
          <span key={g.id} className={`ems-tab ${chartGroup === g.id ? 'active' : ''}`} style={{ flexShrink: 0 }} onClick={() => { Audio.play('tab'); setChartGroup(g.id); }}>{g.label}</span>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {group.series.map((s) => {
          const active = !hiddenSeries.includes(s.id);
          return (
            <button key={s.id} onClick={() => { Audio.play('tick'); toggleSeries(s.id); }} className="ems-btn"
              style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: active ? COLOR.panelAlt : 'transparent', borderColor: active ? s.color : COLOR.border, color: active ? COLOR.text : COLOR.muted, opacity: active ? 1 : 0.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />{s.label}
            </button>
          );
        })}
      </div>

      <div className="ems-visual" style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLOR.muted }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: COLOR.muted }} width={50} tickFormatter={axisTick(leftDef ? leftDef.fmt : 'pct')} />
            {rightDef && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: COLOR.muted }} width={50} tickFormatter={axisTick(rightDef.fmt)} />}
            <Tooltip contentStyle={{ background: COLOR.panel, border: `1px solid ${COLOR.border}`, fontSize: 12 }} labelStyle={{ color: COLOR.goldSoft }}
              formatter={(value, name, props) => { const def = seriesById[props.dataKey]; return [def ? tooltipVal(def.fmt)(value) : value, name]; }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {forecast && visible[0] && (
              <Area yAxisId={visible[0].axis} type="monotone" dataKey="fanBand" name="95% интервал"
                stroke="none" fill={visible[0].color} fillOpacity={0.10} isAnimationActive={false} legendType="none" />
            )}
            {forecast && visible[0] && (
              <Area yAxisId={visible[0].axis} type="monotone" dataKey="fanInner" name="68% интервал"
                stroke="none" fill={visible[0].color} fillOpacity={0.18} isAnimationActive={false} legendType="none" />
            )}
            {forecast && visible[0] && (
              <Line yAxisId={visible[0].axis} type="monotone" dataKey={`${visible[0].id}__f`} name="прогноз"
                stroke={visible[0].color} strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} legendType="none" />
            )}
            {visible.map((s) => (
              <Line key={s.id} yAxisId={s.axis} type="monotone" dataKey={s.id} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, marginTop: 4 }}>
        {forecast
          ? `Веер построен для показателя «${(visible[0] || group.series[0]).label}»: пунктир — инерционная траектория к якорю (цель ЦБ, потенциал, естественная безработица), заливка — интервалы 68% и 95%. Чем дальше горизонт, тем шире неопределённость.`
          : 'Темпы роста и ставки показаны в годовом выражении; траектория рассчитывается по кварталам. Нажмите на показатель выше, чтобы скрыть или показать его линию.'}
      </div>
    </div>
  );
}

function WhyModal({ reasons, onClose }) {
  const [tab, setTab] = useState('gdpGrowth');
  const TABS = [
    { id: 'gdpGrowth', label: 'ВВП' }, { id: 'inflation', label: 'Инфляция' },
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
const DR = (k, sn, h) => ({ kick: drum(k), snare: drum(sn), hat: drum(h) });

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
tr('dawn', 'Рассвет над министерством', 'синт-лид, аналоговый пад', 'calm', {
  bpm: 72, swing: 0.12, reverb: 0.42,
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
tr('ledger', 'Тихая бухгалтерия', 'синт-лид соло', 'calm', {
  bpm: 68, swing: 0.14, reverb: 0.46,
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
tr('northlight', 'Северный свет', 'ретро-колокол, аналоговый пад', 'calm', {
  bpm: 64, swing: 0, reverb: 0.62,
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
tr('promenade', 'Прогулка по столице', 'синт-лид, синт-арпеджио', 'calm', {
  bpm: 84, swing: 0.16, reverb: 0.34,
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

/* --------------------------------- ПОДЪЁМ --------------------------------- */
tr('ascent', 'Восхождение', 'синт-лид, драм-машина', 'boom', {
  bpm: 108, swing: 0, reverb: 0.26,
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
tr('boulevard', 'Бульвар', 'аналоговый пад, синт-лид', 'boom', {
  bpm: 116, swing: 0, reverb: 0.3,
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
tr('overdrive', 'Перегрев', 'синт-лид, драм-машина', 'boom', {
  bpm: 126, swing: 0, reverb: 0.22,
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
tr('longwinter', 'Долгая зима', 'синт-лид, синт-бас', 'slump', {
  bpm: 56, swing: 0.08, reverb: 0.58,
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
tr('emptyhalls', 'Пустые цеха', 'синт-бас, синт-лид', 'slump', {
  bpm: 60, swing: 0.06, reverb: 0.55,
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
tr('patience', 'Терпение', 'синт-лид, аналоговый пад', 'slump', {
  bpm: 66, swing: 0.1, reverb: 0.5,
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
tr('deadlock', 'Тупик', 'синт-арпеджио, низкий пад', 'stag', {
  bpm: 80, swing: 0, reverb: 0.36,
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
tr('friction', 'Трение', 'синт-лид, PWM-пад', 'stag', {
  bpm: 86, swing: 0, reverb: 0.4,
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
tr('collapse', 'Обвал', 'синт-бас, драм-машина, синт-лид', 'crisis', {
  bpm: 128, swing: 0, reverb: 0.26,
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
tr('panic', 'Паника', 'аналоговый пад, синт-том', 'crisis', {
  bpm: 136, swing: 0, reverb: 0.3,
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
tr('bankrun', 'Очередь у банка', 'синт-арпеджио, PWM-пад', 'crisis', {
  bpm: 118, swing: 0, reverb: 0.34,
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

/* ------------------------------- ДЕФЛЯЦИЯ ------------------------------- */
tr('glass', 'Стеклянный воздух', 'ретро-колокол, PWM-пад', 'frost', {
  bpm: 52, swing: 0, reverb: 0.72,
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
  A: H('D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:4 4:D5:4 8:F5:8 16:Bb4:4 20:D5:4 24:G5:8 32:E5:4 36:G5:4 40:Bb5:8 48:A5:4 52:F5:4 56:C5:8 64:D5:4 68:F5:4 72:A5:8 80:C#5:4 84:E5:4 88:A5:8 96:F5:4 100:D5:4 104:A4:8 112:C#5:4 116:E5:4 120:D5:8'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:E5:4 20:G5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.7, DR('x.......x.......', '................', '..o...o...o...o.')),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.9, DR('x.......x.......', '....x.......x...', '..o...o...o...o.')),
    sec('A', 'melA', 'roll', 'piano harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('bidask', 'Бид и аск', 'синт-лид, драм-машина', 'boom', {
  bpm: 118, swing: 0, reverb: 0.24,
  A: H('C3 G3 C4 E4 | A2 E3 A3 C4 | F2 C3 F3 A3 | G2 D3 G3 B3 | C3 G3 C4 E4 | E3 B3 E4 G#4 | F2 C3 F3 A3 | G2 D3 F3 B3'),
  B: H('F2 C3 F3 A3 | G2 D3 G3 B3 | A2 E3 A3 C4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:2 2:C5:2 4:E5:4 8:G5:8 16:E5:4 20:A5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:B4:4 52:D5:4 56:G5:8 64:G4:2 66:C5:2 68:E5:4 72:C5:8 80:G#5:4 84:E5:4 88:B4:8 96:A5:4 100:F5:4 104:C5:8 112:B4:4 116:D5:4 120:G4:8'),
  melB: MEL('0:A5:4 4:F5:4 8:C5:8 16:B5:4 20:G5:4 24:D5:8 32:C6:4 36:A5:4 40:E5:8 48:B4:4 52:F5:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.8, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'roll', 'piano harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass pad violin', 1.0, DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')),
  ],
});
tr('bearmarket', 'Медвежий рынок', 'синт-бас, синт-лид', 'slump', {
  bpm: 62, swing: 0.08, reverb: 0.56,
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E2 B2 E3 G#3 | A2 E3 A3 C4 | G2 D3 G3 Bb3 | F2 C3 F3 A3 | E2 B2 E3 G#3'),
  B: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | E2 B2 E3 G#3'),
  melA: MEL('0:E5:8 8:C5:8 16:A4:12 32:D5:8 40:F5:8 48:E5:14 64:C5:8 72:A4:8 80:Bb4:12 96:A4:8 104:F4:8 112:G#4:14'),
  melB: MEL('0:F5:8 8:D5:8 16:Bb4:12 32:E5:8 40:C5:8 48:G#4:12'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass cello', 0.64),
    sec('B', 'melB', 'sustain', 'piano bass cello pad', 0.84),
    sec('A', 'melA', 'wide', 'piano bass cello pad strings', 1.0),
  ],
});
tr('thinvolume', 'Тонкий рынок', 'синт-арпеджио, PWM-пад', 'stag', {
  bpm: 76, swing: 0, reverb: 0.38,
  A: H('E2 B2 E3 G3 | A2 E3 G3 C4 | E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | C3 G3 C4 E4 | B2 F#3 A3 D#4'),
  B: H('A2 E3 G3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:A4:4 12:B4:4 16:G4:12 32:A4:8 40:C5:8 48:B4:14 64:E5:8 72:D5:8 80:C5:12 96:B4:8 104:G4:8 112:D#5:8 120:E4:8'),
  melB: MEL('0:C5:8 8:A4:8 16:F4:12 32:D5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass choir', 0.74, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'pulse', 'piano bass cello choir pad', 0.92, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'piano bass cello choir pad', 1.0, DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('marginwire', 'Маржин-колл', 'синт-бас, синт-том, аналоговый пад', 'crisis', {
  bpm: 132, swing: 0, reverb: 0.26,
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4 | D3 A3 D4 F4 | F2 C3 F3 A3 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'),
  B: H('G2 D3 G3 Bb3 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:Bb4:4 40:D5:8 48:C#5:4 52:E5:4 56:A4:8 64:A4:2 66:D5:2 68:F5:4 72:D5:8 80:C5:4 84:A4:4 88:F4:8 96:Bb4:4 100:D5:4 104:F5:8 112:E5:4 116:C#5:4 120:A4:8'),
  melB: MEL('0:Bb4:4 4:D5:4 8:G5:8 16:F5:4 20:D5:4 24:Bb4:8 32:C5:4 36:E5:4 40:G5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass cello', 0.88, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass strings timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass strings violin timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});

/* ------------------------------- КАЗИНО ------------------------------- */
// не привязана к режиму экономики — переключается локально при входе на
// вкладку «Казино» (см. Audio.setPlaylist('casino')/(null)), поэтому обе
// темы нарочно бодрые и «фоново-лаунжевые» вне зависимости от состояния
// экономики за окном
tr('chips', 'Фишки и блеск', 'свинг-пианино, ксилофонные блики', 'casino', {
  bpm: 124, swing: 0.32, reverb: 0.3,
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
tr('croupier', 'Крупье', 'ночной джаз-бар, виолончель', 'casino', {
  bpm: 96, swing: 0.28, reverb: 0.4,
  A: H('D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4'),
  B: H('F2 E3 F3 A3 | E3 D4 E4 G4 | A2 G3 A3 C4 | A2 G3 A3 C#4'),
  melA: MEL('0:D4:6 8:A4:4 12:F4:4 16:G4:6 24:B4:4 28:G4:4 32:C5:6 40:E5:4 44:C5:4 48:C#5:6 56:A4:4 60:E4:4 64:D4:6 72:A4:4 76:F4:4 80:G4:6 88:B4:4 92:G4:4 96:C5:6 104:E5:4 108:C5:4 112:C#5:6 120:D5:8'),
  melB: MEL('0:A4:6 8:F4:4 12:E4:4 16:G4:6 24:E4:4 28:D4:4 32:A4:6 40:C5:4 44:A4:4 48:C#5:6 56:A4:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass cello timpani', 0.78, DR('x.......x.......', '....x.......x...', 'x...x...x...x...')),
    sec('B', 'melB', 'sustain', 'piano bass cello strings timpani', 0.92, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('A', 'melA', 'sustain', 'piano bass cello strings bells timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
  ],
});

const MOOD_PLAYLISTS = {
  calm: ['dawn', 'ledger', 'northlight', 'promenade'],
  boom: ['ascent', 'boulevard', 'overdrive'],
  slump: ['longwinter', 'emptyhalls', 'patience'],
  stag: ['deadlock', 'friction'],
  crisis: ['collapse', 'panic', 'bankrun'],
  frost: ['glass', 'stillness'],
  war: ['warmarch', 'trenches'],
  casino: ['chips', 'croupier'],
};
const MOOD_LABEL = { calm: 'Спокойствие', boom: 'Подъём', slump: 'Спад', stag: 'Стагфляция', crisis: 'Кризис', frost: 'Дефляция', war: 'Война', casino: 'Казино' };
const REGIME_MOOD = { normal: 'calm', overheating: 'boom', recession: 'slump', stagflation: 'stag',
  banking: 'crisis', debt: 'crisis', currency: 'crisis', deflation: 'frost', war: 'war', pandemic: 'crisis' };
/* Плейлисты, привязанные к роли: у инвестора свой репертуар */
const ROLE_PLAYLISTS = {
  trader: {
    calm: ['openingbell', 'ledger'],
    boom: ['bidask', 'ascent'],
    slump: ['bearmarket', 'patience'],
    stag: ['thinvolume', 'friction'],
    crisis: ['marginwire', 'panic'],
    frost: ['thinvolume', 'glass'],
  },
};

const Audio = (() => {
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
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 0.8; body.gain.value = 2.5;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5400; air.gain.value = -4;
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
      [[0.014, 0.31], [0.021, 0.23]].forEach(([base, rate], i) => {
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

  /* ------------------------------- ИНСТРУМЕНТЫ (синтвейв) ------------------------------- */
  // Основной синт-лид/плак: пила+квадрат в унисон с суб-осциллятором и нисходящей
  // фильтр-огибающей — тот самый «плак», который держит арпеджио и мелодию в синтвейве.
  const piano = (t, midi, vel, sustain, maxParts) => {
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
    const maxN = maxParts || 8; // сохраняем параметр ради обратной совместимости вызовов
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
  // «808»-бочка: синус с резким питч-дропом плюс щелчок атаки полосовым шумом.
  const kick = (t, vel) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.22 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.36);
    noiseHit(t, 0.012, 0.06 * vel, 'bandpass', 1800, 1.2);
  };
  const noiseHit = (t, dur, gain, type, freq, q, bus) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || dry); src.start(t); src.stop(t + dur + 0.05);
  };
  // Снейр+хлопок внахлёст, короче и жёстче прежнего — ближе к драм-машине, чем к оркестру.
  const snare = (t, vel) => {
    noiseHit(t, 0.13, 0.075 * vel, 'bandpass', 2200, 1.1);
    noiseHit(t, 0.05, 0.05 * vel, 'highpass', 3800, 0.8);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(210, t);
    g.gain.setValueAtTime(0.03 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.1);
  };
  const hat = (t, open) => noiseHit(t, open ? 0.14 : 0.045, open ? 0.022 : 0.026, 'highpass', 8200, 1.4);

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
  const BASS_DEG = [0, 7, 12, 3];

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

    // гармония
    if (pos === 0) {
      if (has('pad')) strings(t, voicing.slice(1, 3), sd * 16 * 0.96, 0.055 * dyn);
      if (has('choir')) choir(t, voicing.slice(1), sd * 16 * 0.94, 0.05 * dyn);
      if (has('strings')) strings(t, voicing.slice(1, 4), sd * 16 * 0.92, 0.042 * dyn);
      if (has('timpani') && (bar % 2 === 0)) timpani(t, voicing[0] - 12, 0.8 * dyn);
    }
    // духовые стабы на каждую четверть — маршевое «ум-па», а не длинная педаль
    if (has('brass') && pos % 4 === 0) brass(t, voicing.slice(0, 3), sd * 3.4, 0.1 * dyn);
    // бас — постоянные восьмые с движением по тонам аккорда (root/fifth/octave/third),
    // а не статичная педаль: главный источник «драйва» в синтвейве
    if (pos % 2 === 0) {
      const root = voicing[0] - 12;
      const note = root + BASS_DEG[(pos / 2) % BASS_DEG.length];
      const vel = (pos % 8 === 0 ? 0.95 : pos % 4 === 0 ? 0.72 : 0.56) * dyn;
      if (has('cello')) cello(t, note, sd * 1.9, vel);
      else if (has('bass')) piano(t + jitter(), note, 0.5 * vel, 0.45, 4);
    }
    // арпеджио по аккорду шестнадцатыми — накладывается на «полные» секции без
    // собственной арпеджио-партии в аранжировке, характерный слой синтвейва
    if (has('pad') && !has('harp')) {
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
      if (has('piano')) piano(t + jitter(), note, vel, track.bpm > 100 ? 0.55 : sc.lh === 'sustain' ? 1.0 : 0.85, sc.lh === 'sustain' ? 4 : 5);
      else if (has('bells') && !has('harp') && (st % 4 === 0)) bell(t, note + 12, sd * 6, 0.6 * vel);
    });
    // мелодия
    melody.forEach(([st, midi, dur]) => {
      if (st !== stepIn) return;
      const vel = (0.78 + 0.20 * accent(pos)) * dyn;
      if (has('violin')) violin(t, midi, sd * dur * 1.05, vel);
      if (has('bells')) bell(t, midi, sd * dur * 1.7, vel * 0.9);
      if (!has('violin') && !has('bells')) {
        piano(t + jitter(), midi, Math.min(1, vel), 1);
        if (dur >= 8 && track.mood !== 'crisis') piano(t + jitter(), midi - 12, vel * 0.32, 0.8);
      } else if (has('piano') && has('violin')) {
        piano(t + jitter(), midi, vel * 0.5, 0.9, 5);
      }
    });
    // ударные
    const d = sc.drums;
    if (d) {
      d.kick.forEach(([st]) => { if (st === pos) kick(t, (0.75 + 0.3 * intensity) * dyn); });
      d.snare.forEach(([st]) => { if (st === pos) snare(t, (0.75 + 0.3 * intensity) * dyn); });
      d.hat.forEach(([st, c]) => { if (st === pos) hat(t, c === 'O'); });
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
      // синтвейву нужна ровная механическая сетка, а не джазовый свинг — приглушаем его
      const swing = (stepIdx % 2 === 1) ? track.swing * sd * 0.35 : 0;
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
      const m = REGIME_MOOD[e.regime] || 'calm';
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  React.useEffect(() => {
    const onOther = () => { if (dropdownActiveId !== idRef.current) setOpen(false); };
    dropdownListeners.add(onOther);
    return () => dropdownListeners.delete(onOther);
  }, []);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        dropdownActiveId = idRef.current;
        dropdownListeners.forEach((fn) => fn());
        const r = btnRef.current && btnRef.current.getBoundingClientRect();
        if (r) {
          const vw = window.innerWidth;
          const left = Math.max(8, Math.min(r.right - width, vw - width - 8));
          setPos({ top: r.bottom + 6, left });
        }
      }
      return next;
    });
  };
  return { open, setOpen, toggle, btnRef, pos };
}

function AudioControls() {
  const DD_WIDTH = 268;
  const { open, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
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
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, left: pos.left, width: DD_WIDTH, padding: 13, zIndex: 60, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Music size={13} color={COLOR.gold} />
            <span className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft }}>Саундтрек</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{np.moodLabel} · {np.bpm} BPM</span>
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
            Семнадцать пьес в шести настроениях. Каждая состоит из нескольких частей с разной оркестровкой и доигрывается до конца, прежде чем уступить место следующей.
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

/* Газета: выпуск квартала, хроника страны и сюжетные линии */
function NewspaperModal({ news, history, quarterIndex, onClose }) {
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

  const PaperBox = ({ children, style }) => (
    <div style={{ background: COLOR.paper, color: COLOR.paperText, border: `1px solid ${COLOR.paperRule}`, padding: '18px 20px', ...style }}>{children}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', overflowY: 'auto' }} onClick={onClose}>
      <div className="ems-fade-in" style={{ maxWidth: 940, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <PaperBox>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px double ${COLOR.paperRule}`, paddingBottom: 10 }}>
            <div>
              <div className="ems-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1 }}>ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div>
              <div className="ems-mono" style={{ fontSize: 10, color: COLOR.paperMuted, marginTop: 6, letterSpacing: '0.08em' }}>
                ЕЖЕКВАРТАЛЬНОЕ ИЗДАНИЕ · {latest ? latest[1][0].qLabel : quarterLabel(quarterIndex)} · ВЫПУСК № {latest ? latest[0] : 0}
              </div>
            </div>
            <button className="ems-btn" style={{ padding: '4px 7px', background: 'transparent', color: COLOR.paperText, borderColor: COLOR.paperRule }} onClick={onClose}><X size={14} /></button>
          </div>

          <div style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${COLOR.paperRule}`, padding: '8px 0', marginBottom: 14 }}>
            {[['issue', 'Выпуск'], ['chronicle', 'Хроника страны'], ['stories', 'Сюжетные линии']].map(([id, label]) => (
              <span key={id} onClick={() => { Audio.play('paper'); setTab(id); }} style={{ cursor: 'pointer', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
                fontWeight: tab === id ? 700 : 400, color: tab === id ? COLOR.paperText : COLOR.paperMuted, borderBottom: tab === id ? `2px solid ${COLOR.paperText}` : '2px solid transparent', paddingBottom: 3 }}>{label}</span>
            ))}
          </div>

          {tab === 'issue' && (
            <div>
              {!lead && <div className="ems-serif" style={{ fontSize: 13, color: COLOR.paperMuted }}>Первый выпуск выйдет после завершения квартала.</div>}
              {lead && (
                <div style={{ borderBottom: `1px solid ${COLOR.paperRule}`, paddingBottom: 14, marginBottom: 14 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.paperMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                    {catOf(lead.cat).icon} {catOf(lead.cat).label.toUpperCase()} · ГЛАВНАЯ ТЕМА
                  </div>
                  <div className="ems-serif" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.12, marginBottom: 8 }}>{lead.headline}</div>
                  <div className="ems-serif" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{lead.text}</div>
                  {lead.chain && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 10 }}>
                      {lead.chain.map((st, i) => (
                        <React.Fragment key={i}>
                          <span style={{ fontSize: 10.5, padding: '2px 7px', border: `1px solid ${COLOR.paperRule}`, color: COLOR.paperText }}>{st}</span>
                          {i < lead.chain.length - 1 && <span style={{ color: COLOR.paperMuted }}>→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {snapshot && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', border: `1px solid ${COLOR.paperRule}`, padding: '9px 12px', marginBottom: 14 }}>
                  {[['ВВП', fmtSignedPct(snapshot.gdpGrowth)], ['Инфляция', pctFmt(snapshot.inflation)], ['Безработица', pctFmt(snapshot.unemployment)],
                    ['Ставка', pctFmt(snapshot.keyRate)], ['Курс', fmt1(snapshot.exchangeRate)], ['Долг/ВВП', pctFmt(snapshot.debtToGdp)]].map(([k, v]) => (
                      <span key={k} className="ems-mono" style={{ fontSize: 10.5, color: COLOR.paperMuted }}>{k}: <b style={{ color: COLOR.paperText }}>{v}</b></span>
                    ))}
                </div>
              )}

              <div style={{ columnCount: 2, columnGap: 22, columnRule: `1px solid ${COLOR.paperRule}` }} className="ems-paper-cols">
                {rest.map((n) => (
                  <div key={n.id} style={{ breakInside: 'avoid', marginBottom: 14 }}>
                    <div className="ems-mono" style={{ fontSize: 9, color: COLOR.paperMuted, letterSpacing: '0.08em' }}>{catOf(n.cat).icon} {catOf(n.cat).label.toUpperCase()}</div>
                    <div className="ems-serif" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, margin: '3px 0 4px' }}>{n.headline}</div>
                    <div className="ems-serif" style={{ fontSize: 12, lineHeight: 1.55 }}>{n.text}</div>
                    {n.storyTitle && <div style={{ fontSize: 10, color: COLOR.paperMuted, marginTop: 4 }}>Сюжет «{n.storyTitle}», часть {n.step} из {n.steps}</div>}
                  </div>
                ))}
              </div>

              {editorial && (
                <div style={{ borderTop: `3px double ${COLOR.paperRule}`, marginTop: 6, paddingTop: 12 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.paperMuted, letterSpacing: '0.1em', marginBottom: 5 }}>ОТ РЕДАКЦИИ · СВОДКА КВАРТАЛА</div>
                  <div className="ems-serif" style={{ fontSize: 12.5, lineHeight: 1.65 }}>{editorial.text}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'chronicle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {quarters.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: COLOR.paperMuted }}>Хроника начнётся с первого завершённого квартала.</div>}
              {quarters.map(([q, list]) => {
                const snap = history.find((h) => h.q === q);
                const top = list.filter((n) => n.cat !== 'editorial').slice(0, 3);
                return (
                  <div key={q} style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${COLOR.paperRule}`, padding: '11px 0' }}>
                    <div style={{ width: 92, flexShrink: 0 }}>
                      <div className="ems-mono ems-serif" style={{ fontSize: 12, fontWeight: 700 }}>{list[0].qLabel}</div>
                      {snap && (
                        <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.paperMuted, lineHeight: 1.5, marginTop: 3 }}>
                          ВВП {fmtSigned1(snap.gdpGrowth)}%<br />инфл. {fmt1(snap.inflation)}%<br />безр. {fmt1(snap.unemployment)}%<br />ставка {fmt1(snap.keyRate)}%
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {top.map((n) => (
                        <div key={n.id}>
                          <span style={{ fontSize: 10 }}>{catOf(n.cat).icon} </span>
                          <span className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700 }}>{n.headline}</span>
                          <div className="ems-serif" style={{ fontSize: 11.5, color: COLOR.paperMuted, lineHeight: 1.45 }}>{n.text}</div>
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
              {stories.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: COLOR.paperMuted }}>Сюжетов пока нет. Они рождаются из шоков и ваших собственных решений — и разворачиваются несколько кварталов подряд.</div>}
              {stories.map((st) => (
                <div key={st.id} style={{ borderLeft: `2px solid ${COLOR.paperRule}`, paddingLeft: 14 }}>
                  <div className="ems-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Сюжет: {st.title}</div>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.paperMuted, marginBottom: 8 }}>
                    {st.steps[0].qLabel} — {st.steps[st.steps.length - 1].qLabel} · {st.steps.length} из {st.steps[0].steps} частей
                  </div>
                  {st.steps.map((n, i) => (
                    <div key={n.id} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                      <div style={{ width: 74, flexShrink: 0 }} className="ems-mono">
                        <div style={{ fontSize: 9.5, color: COLOR.paperMuted }}>{n.qLabel}</div>
                        <div style={{ fontSize: 9, color: COLOR.paperMuted }}>часть {i + 1}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{n.headline}</div>
                        <div className="ems-serif" style={{ fontSize: 11.5, color: COLOR.paperMuted, lineHeight: 1.5 }}>{n.text}</div>
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
const isCrisisRegime = (r) => ['banking', 'debt', 'currency', 'stagflation'].indexOf(r) >= 0;

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
        <span className="ems-mono" style={{ fontSize: 11, color: a.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{info.label}</span>
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
    'corpBondIndex', 'fxIndex', 'goldIndex', 'depositIndex'];
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

const MemoChart = React.memo(MiniChart);

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
            <MemoChart data={ser('stockIndex')} color={COLOR.gold} height={64} label="Индекс акций" fmt={(v) => v.toFixed(1)} />
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
            <MemoChart data={ser('bondIndex')} color={COLOR.blue} height={54} label="Индекс облигаций" fmt={(v) => v.toFixed(1)} />
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
          <MemoChart data={ser('sectorBanks')} color={COLOR.blue} height={48} label="Индекс банков" fmt={(v) => v.toFixed(0)} />
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
            <MemoChart data={ser('exchangeRate')} color={COLOR.rust} height={54} label="Курс" fmt={(v) => v.toFixed(2)} />
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
      <div><b style={{ color: c, fontSize: isCrisis ? 12.5 : 12 }}>Режим экономики: {info.label}.</b> <span style={{ color: COLOR.muted }}>{regimeInfoText(info, economy)}</span></div>
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
function BotPanel({ botRole, persona, lastAction, economy, coordination }) {
  if (!botRole) return null;
  const isCb = botRole === 'central_bank';
  const Icon = isCb ? Landmark : Coins;
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <Bot size={14} color={COLOR.blue} />
        <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.blue }}>{isCb ? 'Центральный банк' : 'Министерство финансов'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>бот</span>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{persona.name}</b> · {persona.title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, marginBottom: 4 }}>
        {isCb ? (
          <>
            <span style={{ color: COLOR.muted }}>Ставка: <span className="ems-mono" style={{ color: COLOR.text }}>{fmt2(economy.keyRate)}%</span></span>
            <span style={{ color: COLOR.muted }}>Норматив капитала: <span className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.capitalRequirement)}%</span></span>
            <span style={{ color: COLOR.muted }}>Реальная ставка − r*: <span className="ems-mono" style={{ color: COLOR.text }}>{fmtSigned1(economy.policyStance)}</span></span>
          </>
        ) : (
          <>
            <span style={{ color: COLOR.muted }}>Баланс бюджета: <span className="ems-mono" style={{ color: COLOR.text }}>{fmtSigned1(economy.budgetBalancePctGdp)}% ВВП</span></span>
            <span style={{ color: COLOR.muted }}>Долг: <span className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.debtToGdp)}%</span></span>
            <span style={{ color: COLOR.muted }}>НДС: <span className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.vatRate)}%</span></span>
          </>
        )}
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
  const slim = (state.history || []).map((h) => { const { revenueParts, ...rest } = h; return rest; });
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
const getPlayerId = () => {
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
const ACHIEVEMENTS_KEY = 'ems-achievements';
const ROLES_PLAYED_KEY = 'ems-roles-played';
const NETWORK_PLAYED_KEY = 'ems-network-played';
const ALL_ROLE_IDS = ['central_bank', 'ministry_finance', 'full_control', 'trader'];
const ACHIEVEMENTS = [
  { id: 'first_quarter', icon: '🎬', title: 'Первый квартал', desc: 'Заверши первый квартал у руля экономики.' },
  { id: 'survivor_20', icon: '🗓️', title: 'Ветеран', desc: 'Продержись 20 кварталов в одной партии.' },
  { id: 'survivor_40', icon: '📜', title: 'Долгожитель', desc: 'Продержись 40 кварталов в одной партии.' },
  { id: 'inflation_target', icon: '🎯', title: 'В яблочко', desc: 'Удержи инфляцию рядом с целью 4 квартала подряд.' },
  { id: 'gdp_double', icon: '📈', title: 'Удвоение', desc: 'Удвой реальный ВВП от старта партии.' },
  { id: 'low_unemployment', icon: '🧑‍🏭', title: 'Полная занятость', desc: 'Опусти безработицу ниже 4%.' },
  { id: 'debt_control', icon: '🏦', title: 'Долговая дисциплина', desc: 'Снизь госдолг ниже 40% ВВП.' },
  { id: 'survived_crisis', icon: '⛈️', title: 'Пережили бурю', desc: 'Выведи страну из кризисного режима обратно к норме.' },
  { id: 'won_election', icon: '🗳️', title: 'Мандат доверия', desc: 'Останься у власти на выборах.' },
  { id: 'all_roles', icon: '🎭', title: 'Все ветви власти', desc: 'Доведи до конца хотя бы один квартал за Центробанк, Минфин, главу государства и трейдера.' },
  { id: 'network_played', icon: '🌐', title: 'На двоих', desc: 'Доиграй хотя бы один квартал в партии по сети.' },
  { id: 'casino_win', icon: '🎲', title: 'Дебют в казино', desc: 'Выиграй свою первую ставку в казино.' },
  { id: 'casino_jackpot', icon: '💰', title: 'Куш', desc: 'Выиграй разом от 3 млн в одной игре казино.' },
  { id: 'casino_ahead', icon: '🥂', title: 'Дом не всегда выигрывает', desc: 'Уйди из казино в плюс на 5 млн суммарно за партию.' },
  { id: 'margin_call', icon: '⚠️', title: 'Маржин-колл', desc: 'Переживи принудительное закрытие позиций брокером и продолжи торговать.' },
  { id: 'tutorial_done', icon: '🎓', title: 'Курс молодого бойца', desc: 'Пройди обучение — три квартала в тренировочном кабинете.' },
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
function questProgressAchievementIds({ quarterIndex, economy, history, rolesPlayed, networkPlayed, lastEvents }) {
  const ids = [];
  if (quarterIndex >= 1) ids.push('first_quarter');
  if (quarterIndex >= 20) ids.push('survivor_20');
  if (quarterIndex >= 40) ids.push('survivor_40');
  if (inflationOnTargetStreak(history) >= 4) ids.push('inflation_target');
  if (history && history.length > 1 && history[0].gdp > 0 && economy.gdp >= history[0].gdp * 2) ids.push('gdp_double');
  if (economy.unemployment < 4) ids.push('low_unemployment');
  if (economy.debtToGdp < 40) ids.push('debt_control');
  if (survivedCrisis(history)) ids.push('survived_crisis');
  if (economy.electionResult === 'incumbent') ids.push('won_election');
  if (rolesPlayed && ALL_ROLE_IDS.every((r) => rolesPlayed.includes(r))) ids.push('all_roles');
  if (networkPlayed) ids.push('network_played');
  if ((lastEvents || []).some((e) => e.kind === 'call')) ids.push('margin_call');
  return ids;
}
function casinoAchievementIds({ net, casinoNet }) {
  const ids = [];
  if (net > 0) ids.push('casino_win');
  if (net >= 3) ids.push('casino_jackpot');
  if (casinoNet >= 5) ids.push('casino_ahead');
  return ids;
}
// очередь тостов «достижение открыто» — общая для соло- и сетевого экрана
function useAchievementToasts() {
  const [toast, setToast] = useState(null);
  const queueRef = React.useRef([]);
  const showingRef = React.useRef(false);
  const timerRef = React.useRef(null);
  const advance = React.useCallback(() => {
    const next = queueRef.current.shift();
    showingRef.current = !!next;
    setToast(next || null);
    if (next) { Audio.play('coin'); timerRef.current = setTimeout(advance, 4200); }
  }, []);
  React.useEffect(() => () => clearTimeout(timerRef.current), []);
  const push = React.useCallback((list) => {
    if (!list || !list.length) return;
    queueRef.current.push(...list);
    if (!showingRef.current) advance();
  }, [advance]);
  return { toast, push };
}
const AchievementToast = ({ toast }) => (!toast ? null : (
  <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 90, maxWidth: 300,
    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderColor: COLOR.gold, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
    <span style={{ fontSize: 26, lineHeight: 1 }}>{toast.icon}</span>
    <div>
      <div style={{ fontSize: 10, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Достижение открыто</div>
      <div className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft, marginTop: 1 }}>{toast.title}</div>
    </div>
  </div>
));
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
          Открыто {count} из {ACHIEVEMENTS.length}. Хранится на этом устройстве и не зависит от сохранений партии.
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
function checkDefeat({ role, economy, history, bookVal }) {
  if (history && history.length >= 4) {
    const last4 = history.slice(-4);
    if (last4.every((h) => h.inflation != null && h.inflation >= 40)) {
      return { id: 'hyperinflation', title: 'Гиперинфляционный коллапс',
        text: `Инфляция держится выше 40% четыре квартала подряд (сейчас ${fmt1(economy.inflation)}%). Деньги теряют смысл быстрее, чем правительство успевает отреагировать — экономика срывается в неуправляемую спираль, а вместе с ней и ваш мандат.` };
    }
  }
  const er = economy.electionResult;
  if (er && er !== 'incumbent' && (role === 'full_control' || role === 'ministry_finance' || (role === 'central_bank' && er === 'landslide'))) {
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
  <div style={{ borderTop: `1px solid ${COLOR.rust}`, background: COLOR.panel, padding: '14px 18px',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0 }}>
    <span style={{ fontSize: 12, color: COLOR.rust, marginRight: 'auto', fontWeight: 600 }}>Партия окончена: {defeat.title}</span>
    <button className="ems-btn" style={{ padding: '10px 16px', fontSize: 12.5 }} onClick={onReopen}>Подробнее</button>
    <button className="ems-btn primary" style={{ padding: '10px 20px', fontSize: 12.5 }} onClick={onRestart}>{restartLabel}</button>
  </div>
);

/* Карточка результата: не только на конце партии (поражение), но и в любой
   момент по кнопке в шапке — так шансов поделиться и позвать друга в сеть
   больше, чем ждать финала. Рисуется на canvas и скачивается/копируется как
   текст: ни бэкенда, ни аккаунтов для «шаринга» этой игре не требуется. */
const RESULT_CARD_EMOJI = { central_bank: '🏛️', ministry_finance: '💰', full_control: '👑', trader: '📈' };
function ruPlural(n, one, few, many) {
  const n10 = n % 10; const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}
const countUnlockedAchievements = () => { const u = loadUnlockedAchievements(); return ACHIEVEMENTS.filter((a) => u[a.id]).length; };
function buildResultCard({ role, quarterIndex, economy, startEconomy, portfolio, defeat }) {
  const roleLabel = (ROLES.find((r) => r.id === role) || {}).short || role;
  const isTrader = role === 'trader';
  const stats = [];
  if (isTrader && portfolio) {
    const val = bookValue(portfolio, economy, null);
    const start = portfolio.startValue || 10;
    const ret = ((val / start) - 1) * 100;
    stats.push(['Капитал', `${val.toFixed(2)} млн`]);
    stats.push(['Доходность', `${ret >= 0 ? '+' : ''}${ret.toFixed(0)}%`]);
    stats.push(['Сделок на рынке', String((portfolio.trades || []).length)]);
    stats.push(['Итог казино', `${(portfolio.casinoNet || 0) >= 0 ? '+' : ''}${(portfolio.casinoNet || 0).toFixed(2)} млн`]);
  } else {
    const gdpChange = startEconomy && startEconomy.gdp > 0 ? ((economy.gdp / startEconomy.gdp) - 1) * 100 : null;
    stats.push(['ВВП с начала партии', gdpChange != null ? `${gdpChange >= 0 ? '+' : ''}${gdpChange.toFixed(0)}%` : '—']);
    stats.push(['Инфляция', `${fmt1(economy.inflation)}%`]);
    stats.push(['Безработица', `${fmt1(economy.unemployment)}%`]);
    stats.push(['Долг к ВВП', `${fmt1(economy.debtToGdp)}%`]);
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
      .catch((e) => { if (!cancelled) { setSlots(Array(3).fill(null)); setError(e.message); } });
    return () => { cancelled = true; };
  }, [playerId]);

  const slotLabel = (s) => {
    const roleTitle = (ROLES.find((r) => r.id === s.role) || {}).short || s.role;
    return `${roleTitle} · ${quarterLabel(Math.max(1, (s.quarterIndex || 1) - 1))}`;
  };
  const saveToSlot = async (idx) => {
    if (!snapshot) return;
    if (slots[idx] && !window.confirm(`Перезаписать слот ${idx + 1}?`)) return;
    setBusyIdx(idx); setError('');
    try { validateSnapshot(snapshot); setSlots(await saveSoloSlot(playerId, idx, snapshot)); Audio.play('stamp'); }
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
            ? 'Партия хранится на сервере — как и сетевые комнаты. 3 слота на это устройство.'
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
                <span style={{ flex: 1, color: slot ? COLOR.text : COLOR.faint }}>
                  Слот {idx + 1}: {slot ? slotLabel(slot) : 'пусто'}
                </span>
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
  central_bank: { id: 'summary', label: 'Сводка ЦБ', icon: Landmark, rows: [
    { key: 'keyRate', label: 'Ключевая ставка', fmt: pctFmt },
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
  ministry_finance: { id: 'summary', label: 'Сводка Минфина', icon: Coins, rows: [
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
  { id: 'bond_gov', name: 'Гособлигации 10 лет', ticker: 'GOV', group: 'Облигации', color: COLOR.blue, key: 'bondIndex', fee: 0.001, kind: 'spot',
    note: 'Индекс полной доходности: купон уже внутри цены и реинвестируется, отдельной выплаты нет, бумага не гасится. Дюрация 7,4: доходность +1 п.п. отнимает около 7% цены.' },
  { id: 'bond_corp', name: 'Корпоративные облигации', ticker: 'CRP', group: 'Облигации', color: COLOR.teal, key: 'corpBondIndex', fee: 0.0015, kind: 'spot',
    note: 'То же самое, но с кредитным спредом: доходность выше, а в кризис спред расширяется и цена падает сильнее государственной. Дюрация 4,1.' },
  { id: 'dep', name: 'Банковский депозит', ticker: 'DEP', group: 'Деньги', color: COLOR.teal, key: 'depositIndex', fee: 0, kind: 'spot',
    note: 'Ставка по депозитам. Безопасно ровно до тех пор, пока реальная ставка не уйдёт в минус.' },
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
function tradeBook(book, instrId, amountMln, side, economy, live, quarterIndex) {
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
function settleQuarter(book, economy, quarterIndex) {
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
        text: `Опцион ${lot.type === 'call' ? 'call' : 'put'} со страйком ${lot.strike.toFixed(0)} исполнен: выплата ${payoff.toFixed(2)} млн при уплаченной премии ${(lot.premium * lot.qty / 1000).toFixed(2)} млн.` });
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
  if (borrow > 0.005) events.push({ kind: 'info', text: `Плата за короткие позиции: ${borrow.toFixed(3)} млн за квартал.` });
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
    events.push({ kind: 'call', text: `Маржин-колл: уровень обеспечения упал до ${(lvl * 100).toFixed(0)}% при минимуме ${MAINTENANCE * 100}%. Брокер принудительно закрыл ${(cut * 100).toFixed(0)}% позиций (${closedValue.toFixed(2)} млн) по рынку со штрафом 0,5%.` });
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
  bond_gov: 'Госдолг', bond_corp: 'Корпоративный долг',
  dep: 'Депозит', fx: 'Валюта', gold: 'Товары',
  fut_idx: 'Плечо: индекс', fut_fx: 'Плечо: валюта', fut_bond: 'Плечо: долг',
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
      <text x={c} y={c + 12} textAnchor="middle" fontSize={14} fill={COLOR.text}>{total.toFixed(2)}</text>
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
function InstrumentPrimer({ instr, economy, prev, price, amt }) {
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
        <Row k="Вы вносите (гарантийное обеспечение)" v={`${m.toFixed(2)} млн`} />
        <Row k={`Работает позиция размером (×${instr.lev})`} v={`${notional.toFixed(2)} млн`} />
        <Row k="Движение цены на 1%" v={`± ${perPct.toFixed(2)} млн = ${instr.lev}% вашего ГО`}
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
  const hist28 = useMemo(() => (history || []).slice(-28), [history]);
  const series = useMemo(() => hist28.map((h) => h[instr.key]), [hist28, instr.key]);
  const marks = useMemo(() => {
    const firstQ = hist28.length ? hist28[0].q : 0;
    const last = hist28.length - 1;
    return (book.trades || []).filter((t) => t.id === sel)
      // сделки текущего, ещё не закрытого квартала прижимаем к последней точке графика
      .map((t) => ({ idx: Math.min(t.q - firstQ, last), side: t.side }))
      .filter((m) => m.idx >= 0 && m.idx <= last);
  }, [hist28, book.trades, sel]);
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
        {[['Капитал', `${equity.toFixed(2)} млн`, COLOR.text],
          ['Деньги', `${book.cash.toFixed(2)}`, book.cash < 0 ? COLOR.rust : COLOR.text],
          ['Экспозиция', `${parts.gross.toFixed(2)}`, COLOR.text],
          ['Зафиксировано', `${fmtSigned1(book.realized)} млн`, book.realized >= 0 ? COLOR.teal : COLOR.rust]].map(([l, v, c]) => (
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

      <div className="ems-terminal">
        <div className="ems-scroll" style={{ maxHeight: 460, overflowY: 'auto', borderRight: `1px solid ${COLOR.border}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '8px 12px 4px' }}>
            <span className={`ems-tab ${activeGroup === 'all' ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
              onClick={() => { Audio.play('tab'); setActiveGroup('all'); }}>Все</span>
            {[...new Set(INSTRUMENTS.map((i) => i.group))].map((g) => (
              <span key={g} className={`ems-tab ${activeGroup === g ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
                onClick={() => { Audio.play('tab'); setActiveGroup(g); }}>{g}</span>
            ))}
          </div>
          {[...new Set(INSTRUMENTS.map((i) => i.group))].filter((g) => activeGroup === 'all' || activeGroup === g).map((g) => (
            <div key={g}>
              <div style={{ padding: '7px 12px 3px', fontSize: 9.5, color: COLOR.blue, letterSpacing: '0.08em' }}>{g.toUpperCase()}</div>
              {INSTRUMENTS.filter((i) => i.group === g).map((i) => {
                const pr = priceOf(i, economy, live);
                const q = book.pos[i.id] || 0;
                const myLots = (book.opts || []).filter((l) => l.instr === i.id);
                const val = i.kind === 'opt'
                  ? myLots.reduce((a, l) => a + optionValue(l.type, pr, l.strike, vol, l.left) * l.qty / 1000, 0)
                  : i.kind === 'fut' ? q * (pr - (book.avg[i.id] || pr)) / 1000 : q * pr / 1000;
                const dq = prev && prev[i.key] ? (economy[i.key] / prev[i.key] - 1) * 100 : 0;
                const active = sel === i.id;
                const has = Math.abs(q) > 0.001 || myLots.length > 0;
                return (
                  <div key={i.id} onClick={() => { Audio.play('tick'); setSel(i.id); setAmount(1); setSide('buy'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer',
                      background: active ? COLOR.goldDim : 'transparent',
                      borderLeft: `2px solid ${active ? COLOR.gold : has ? i.color : 'transparent'}` }}>
                    <span className="ems-mono" style={{ fontSize: 10, color: i.color, width: 40 }}>{i.ticker}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: active ? COLOR.text : COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                      {has && (
                        <div style={{ fontSize: 10, color: q < 0 ? COLOR.rust : COLOR.faint }}>
                          {i.kind === 'opt' ? `${myLots.length} серии · ${val.toFixed(2)} млн`
                            : `${q < 0 ? 'шорт' : 'лонг'} ${i.kind === 'fut' ? `${(Math.abs(q) * pr / 1000).toFixed(1)} млн номинала` : `${val.toFixed(2)} млн`}`}
                        </div>
                      )}
                      {i.kind === 'fut' && !has && <div style={{ fontSize: 10, color: COLOR.faint }}>плечо {i.lev}:1</div>}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <div><PriceCell value={pr} size={11.5} /></div>
                      <div className="ems-mono" style={{ fontSize: 10, color: dq > 0.01 ? COLOR.teal : dq < -0.01 ? COLOR.rust : COLOR.faint }}>
                        {dq > 0.01 ? '▲' : dq < -0.01 ? '▼' : '·'} {fmtSigned1(dq)}%
                      </div>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
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

          {series.length > 2 && (
            <>
              <MemoChart data={series} color={instr.color} height={70} label={instr.name} marks={marks} fmt={fmt2} />
              {marks.length > 0 && (
                <div style={{ fontSize: 10, color: COLOR.faint, marginTop: -4 }}>
                  <span style={{ color: COLOR.teal }}>B</span> — ваши покупки, <span style={{ color: COLOR.rust }}>S</span> — продажи
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: COLOR.panelAlt,
            border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 10px' }}>
            {[['Позиция', posLabel(instr, held)],
              [instr.kind === 'opt' ? 'Страйк' : 'Средняя', instr.kind === 'opt' ? (lots[0] ? lots[0].strike.toFixed(0) : '—') : (avg ? avg.toFixed(2) : '—')],
              [instr.kind === 'fut' ? 'Номинал' : 'Стоимость',
                instr.kind === 'opt' ? (lotsValue > 0 ? `${lotsValue.toFixed(2)} млн` : '—')
                  : Math.abs(held) > 0.001 ? `${Math.abs(heldValue).toFixed(2)} млн` : '—'],
              ['Прибыль', Math.abs(unreal) > 0.0005 ? `${fmtSigned1(unreal)} млн` : '—']].map(([l, v], idx) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: COLOR.muted }}>{l}</div>
                  <div className="ems-mono" style={{ fontSize: 12, color: idx === 3 && Math.abs(unreal) > 0.0005 ? (unreal >= 0 ? COLOR.teal : COLOR.rust) : COLOR.text }}>{v}</div>
                </div>
              ))}
          </div>
          <InstrumentPrimer instr={instr} economy={economy} prev={prev} price={price} amt={amt} />

          {instr.kind === 'opt' && lots.length > 0 && (
            <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.5 }}>
              {lots.map((l, i) => (
                <div key={l.id}>серия {i + 1}: страйк {l.strike.toFixed(0)}, до экспирации {l.left} кв., премия {(l.premium * l.qty / 1000).toFixed(2)} млн, сейчас {(optionValue(l.type, price, l.strike, vol, l.left) * l.qty / 1000).toFixed(2)} млн</div>
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
              <div style={{ color: COLOR.blue, marginBottom: 3 }}>Исполнено</div>
              {(book.trades || []).slice(-5).reverse().map((t, k) => {
                const ins = INSTR_BY_ID[t.id];
                return (
                  <div key={`${t.q}-${k}`} style={{ display: 'flex', gap: 8, padding: '1.5px 0', color: COLOR.muted }}>
                    <span className="ems-mono" style={{ color: t.side === 'buy' ? COLOR.teal : COLOR.rust, width: 62 }}>
                      {t.side === 'buy' ? 'покупка' : 'продажа'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ins ? ins.name : t.id}
                    </span>
                    <span className="ems-mono">{t.amt.toFixed(2)} млн</span>
                    <span className="ems-mono" style={{ color: COLOR.faint, width: 54, textAlign: 'right' }}>
                      по {t.price.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: COLOR.muted }}>
                {instr.kind === 'fut' ? 'Гарантийное обеспечение' : instr.kind === 'opt' ? 'Премия' : 'Сумма сделки'}
              </span>
              <span className="ems-mono" style={{ fontSize: 14 }}>{amt.toFixed(2)} <span style={{ fontSize: 10, color: COLOR.faint }}>млн</span></span>
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
                  {useMargin ? `Доступно ${maxBuy.toFixed(2)} млн, из них ${Math.max(0, maxBuy - Math.max(0, book.cash)).toFixed(2)} заёмных под ${fmt1(economy.lendingRate)}% годовых.`
                    : `Сделки только на свои: доступно ${Math.max(0, book.cash).toFixed(2)} млн.`}
                </span>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, borderLeft: `2px solid ${side === 'buy' ? COLOR.teal : COLOR.rust}`, paddingLeft: 9 }}>
            {amt <= 0.001 ? 'Выберите сумму сделки.' : instr.kind === 'opt' ? (
              side === 'buy'
                ? <>Покупка <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> контрактов со страйком {price.toFixed(0)} и экспирацией через {instr.life} кв.
                  Премия {amt.toFixed(2)} млн — это максимум, который можно потерять. Волатильность в цене опциона: {(vol * 100).toFixed(0)}%.</>
                : <>Закрытие позиций по опционам на {amt.toFixed(2)} млн по текущей оценке.</>
            ) : (
              <>
                {side === 'buy' ? 'Покупка' : willShort ? 'Продажа в шорт' : 'Продажа'} <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> ед.
                по <b className="ems-mono" style={{ color: COLOR.text }}>{price.toFixed(2)}</b>
                {instr.kind === 'fut' && <> · номинал <b className="ems-mono" style={{ color: COLOR.text }}>{(amt * instr.lev).toFixed(2)} млн</b> при плече {instr.lev}:1</>}
                , комиссия {(amt * instr.fee * (instr.lev || 1) * 100 / 100).toFixed(3)} млн.
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
              {side === 'buy' ? 'Купить' : willShort ? 'Открыть шорт' : 'Продать'} на {amt.toFixed(2)} млн
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
  const rows = INSTRUMENTS.map((i) => {
    const q = book.pos[i.id] || 0;
    const pr = priceOf(i, economy, live);
    const v = i.kind === 'fut' ? Math.abs(q) * pr / 1000 : q * pr / 1000;
    return { i, v, short: q < 0 };
  }).filter((r) => Math.abs(r.v) > 0.005);
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
    if (goal === 'beat_index') return `Индекс: ${bench.stock.toFixed(2)} млн против вашего ${equity.toFixed(2)} — вы ${equity >= bench.stock ? 'впереди' : 'позади'} на ${Math.abs(equity - bench.stock).toFixed(2)} млн.`;
    if (goal === 'beat_inflation') return `Сохранение покупательной способности требует ${bench.infl.toFixed(2)} млн — у вас ${equity.toFixed(2)}.`;
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
          <div className="ems-mono" style={{ fontSize: 22 }}>{equity.toFixed(2)}<span style={{ fontSize: 11, color: COLOR.faint }}> млн</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>В ценах старта</div>
          <div className="ems-mono" style={{ fontSize: 15, color: real >= start ? COLOR.teal : COLOR.rust }}>{real.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>За квартал</div>
          <div className="ems-mono" style={{ fontSize: 15, color: qRet >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(qRet)}%</div>
        </div>
      </div>
      {book.history && book.history.length > 2 && (
        <MemoChart data={book.history} color={COLOR.gold} height={54} label="Капитал" fmt={fmt2} />
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
                <span className="ems-mono">{r.v.toFixed(2)}</span>
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
                  <span className="ems-mono" style={{ color: r.net < 0 ? COLOR.rust : COLOR.text }}>{r.value.toFixed(2)}</span>
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
        <span className="ems-mono" style={{ color: book.cash < 0 ? COLOR.rust : COLOR.text }}>{book.cash.toFixed(2)} млн</span>
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
        <span>Ставка</span><span className="ems-mono">{amount.toFixed(2)} млн</span>
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
    {net > 0 ? `+${net.toFixed(2)}` : net.toFixed(2)} млн
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
            <span style={{ color: COLOR.muted }}>Свободные деньги</span><span className="ems-mono" style={{ color: cash < 0.01 ? COLOR.rust : COLOR.text }}>{cash.toFixed(2)} млн</span>
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

/* Интерактивный мини-график: подсказка по наведению и отметки сделок */
function MiniChart({ data, color, height = 46, label, fmt, marks }) {
  const rows = (data || []).map((v, i) => ({ i, v: Number.isFinite(v) ? v : null }));
  if (rows.filter((r) => r.v !== null).length < 2) return <div style={{ height }} />;
  const markSet = {};
  (marks || []).forEach((m) => { if (m.idx >= 0) markSet[m.idx] = m; });
  const dot = (props) => {
    const m = markSet[props.payload.i];
    if (!m) return null;
    return (
      <g key={`m${props.payload.i}`}>
        <circle cx={props.cx} cy={props.cy} r={4.2} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust} stroke={COLOR.bg} strokeWidth={1} />
        <text x={props.cx} y={props.cy - 7} textAnchor="middle" fontSize={8} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust}>
          {m.side === 'buy' ? 'B' : 'S'}
        </text>
      </g>
    );
  };
  return (
    <div className="ems-visual" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 11, padding: '4px 8px' }}
            labelFormatter={(i) => `${(marks && marks.label) || ''}${rows.length - 1 - i === 0 ? 'сейчас' : `${rows.length - 1 - i} кв. назад`}`}
            formatter={(v) => [fmt ? fmt(v) : fmt1(v), label || 'значение']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={marks && marks.length ? dot : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
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
          «{cur.ask}»
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
const haptic = (pattern) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch { /* не поддерживается */ } };

function ViewSettings({ theme, setTheme, dense, setDense, dashboards, activeDash, applyDash, saveDash, deleteDash }) {
  const DD_WIDTH = 250;
  const { open, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="ems-btn" style={{ padding: '7px 9px' }} title="Вид, тема и доступность" aria-label="Настройки вида"
        onClick={() => { Audio.play('click'); toggle(); }}>
        <Sliders size={14} />
      </button>
      {open && (
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, left: pos.left, width: DD_WIDTH, padding: 13, zIndex: 60, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
          <div className="ems-serif" style={{ fontSize: 12.5, color: COLOR.goldSoft, marginBottom: 8 }}>Тема оформления</div>
          {Object.values(THEMES).map((t) => (
            <button key={t.id} className="ems-btn" style={{ width: '100%', textAlign: 'left', padding: '6px 9px', fontSize: 11.5, marginBottom: 4,
              background: theme === t.id ? COLOR.gold : COLOR.panelAlt, color: theme === t.id ? COLOR.ink : COLOR.text,
              borderColor: theme === t.id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setTheme(t.id); }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {dashboards.map((d) => (
              <span key={d.id} className={`ems-tab ${activeDash === d.id ? 'active' : ''}`} style={{ fontSize: 10.5, padding: '3px 8px' }}
                onClick={() => { Audio.play('tab'); applyDash(d.id); }}>
                {d.name}{d.custom && <span style={{ color: COLOR.faint }} onClick={(e) => { e.stopPropagation(); deleteDash(d.id); }}> ×</span>}
              </span>
            ))}
          </div>
          <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 10.5 }}
            onClick={() => { Audio.play('stamp'); saveDash(); }}>Сохранить текущий набор</button>
        </div>
      )}
    </div>
  );
}

/* ============================ РЕАКЦИЯ ЭКОНОМИКИ НА РЕШЕНИЕ ============================ */
function computeIRF(economy, decisions, leverId, baseValue, newValue, difficulty, horizon) {
  const H = horizon || 12;
  const noiseSave = CONFIG.noiseMult[difficulty];
  const evSave = CONFIG.eventProbability[difficulty];
  CONFIG.noiseMult[difficulty] = 0; CONFIG.eventProbability[difficulty] = 0;
  const run = (val) => {
    let e = economy; let d = { ...decisions, [leverId]: val };
    let pend = []; let cds = {}; let st = []; const out = [];
    for (let q = 1; q <= H; q++) {
      const r = simulateQuarter({ economy: e, decisions: d, pendingImpulses: pend, eventCooldowns: cds,
        difficulty, quarterIndex: q, stories: st });
      e = r.economy; pend = r.pendingImpulses; cds = r.eventCooldowns; st = r.stories;
      d = { ...defaultDecisions(e, d), [leverId]: val };
      out.push(e);
    }
    return out;
  };
  let res = [];
  try {
    const base = run(baseValue);
    const alt = run(newValue);
    res = base.map((b, i) => ({
      q: i + 1,
      gdpGrowth: alt[i].gdpGrowth - b.gdpGrowth,
      inflation: alt[i].inflation - b.inflation,
      unemployment: alt[i].unemployment - b.unemployment,
      outputGap: alt[i].outputGap - b.outputGap,
      debtToGdp: alt[i].debtToGdp - b.debtToGdp,
      stockIndex: (alt[i].stockIndex / b.stockIndex - 1) * 100,
      baseGdp: b.gdpGrowth, altGdp: alt[i].gdpGrowth,
      baseInfl: b.inflation, altInfl: alt[i].inflation,
    }));
  } catch { res = []; }
  CONFIG.noiseMult[difficulty] = noiseSave; CONFIG.eventProbability[difficulty] = evSave;
  return res;
}
const IRF_SERIES = [
  { key: 'gdpGrowth', label: 'Рост ВВП', color: COLOR.gold, unit: ' п.п.' },
  { key: 'inflation', label: 'Инфляция', color: COLOR.rust, unit: ' п.п.' },
  { key: 'unemployment', label: 'Безработица', color: COLOR.blue, unit: ' п.п.' },
  { key: 'debtToGdp', label: 'Долг к ВВП', color: COLOR.teal, unit: ' п.п.' },
  { key: 'stockIndex', label: 'Индекс акций', color: '#8E7CC3', unit: '%' },
];
function IRFModal({ economy, decisions, lever, value, baseValue, difficulty, onClose }) {
  const data = useMemo(() => computeIRF(economy, decisions, lever.id, baseValue, value, difficulty, 12),
    [lever.id, baseValue, value]);
  const peak = (key) => data.reduce((a, d) => (Math.abs(d[key]) > Math.abs(a.v) ? { v: d[key], q: d.q } : a), { v: 0, q: 0 });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 720, width: '100%', padding: 18, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Activity size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>Реакция экономики: {lever.label}</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose} aria-label="Закрыть"><X size={13} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Модель прогоняется на 12 кварталов вперёд дважды: с текущим значением ({fmt1(decisions[lever.id])}{lever.suffix})
          и с новым ({fmt1(value)}{lever.suffix}), без случайных шоков и событий. На графике — разница между этими двумя мирами,
          то есть чистый эффект именно вашего решения.
        </div>
        <div className="ems-visual" style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="q" tick={{ fill: COLOR.faint, fontSize: 10 }} stroke={COLOR.border}
                label={{ value: 'кварталов после решения', fill: COLOR.faint, fontSize: 10, position: 'insideBottom', offset: -2 }} />
              <YAxis tick={{ fill: COLOR.faint, fontSize: 10 }} stroke={COLOR.border} />
              <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 11 }}
                labelFormatter={(v) => `${v}-й квартал`} formatter={(v, n) => [fmtSigned1(v), n]} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              {IRF_SERIES.map((sr) => (
                <Line key={sr.key} type="monotone" dataKey={sr.key} name={sr.label} stroke={sr.color} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 12 }}>
          {IRF_SERIES.map((sr) => {
            const pk = peak(sr.key);
            return (
              <div key={sr.key} className="ems-panel" style={{ padding: 9 }}>
                <div style={{ fontSize: 10.5, color: COLOR.muted }}>{sr.label}</div>
                <div className="ems-mono" style={{ fontSize: 15, color: sr.color }}>{fmtSigned1(pk.v)}{sr.unit}</div>
                <div style={{ fontSize: 10, color: COLOR.faint }}>{pk.q ? `пик через ${pk.q} кв.` : 'без заметного эффекта'}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 12, lineHeight: 1.5 }}>
          Это контрфактический расчёт: «что было бы, если бы». Реальная траектория будет отличаться — в ней будут шоки,
          решения второго ведомства и накопленные ожидания. Но знак, форма и задержка эффекта останутся теми же.
        </div>
      </div>
    </div>
  );
}


/* =========================================================================================
   СЕТЕВАЯ ИГРА: лобби (создать/войти) и экран партии, синхронизированный с сервером.
   Сервер (api/room.js) считает квартал, когда решения прислали оба места; здесь — только
   отображение состояния комнаты и отправка своих решений.
========================================================================================= */
const NETWORK_SEATS = ['central_bank', 'ministry_finance'];
const TRADER_SEATS = ['trader1', 'trader2'];
const seatsForMode = (mode) => (mode === 'trader' ? TRADER_SEATS : NETWORK_SEATS);
// оба трейдерских места делят одну и ту же роль из ROLES (id 'trader') — нумеруем
// их отдельно только в подписи, чтобы «Трейдер 1» и «Трейдер 2» не выглядели одним
// и тем же местом в UI
const seatRole = (seat) => {
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
    const validSeats = seatsForMode(roomPreview.mode);
    const occ = roomPreview.occupied || {};
    if (!validSeats.includes(seat) || occ[seat]) {
      const free = validSeats.find((sx) => !occ[sx]) || validSeats[0];
      setSeat(free);
    }
  }, [roomPreview]);
  const bothSeatsTaken = !!(roomPreview && roomPreview.occupied
    && seatsForMode(roomPreview.mode).every((sx) => roomPreview.occupied[sx]));

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
      const r = await createRoom({ difficulty, mode });
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
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                  background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, fontSize: 12 }}>
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
              {seatsForMode(roomPreview ? roomPreview.mode : mode).map((sx) => {
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
    <div className="ems-root" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 640, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <NetworkLobby onEnter={onEnter} />
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
  const { toast: achToast, push: pushAch } = useAchievementToasts();
  const [showAch, setShowAch] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [defeat, setDefeat] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const onTrade = (instrId, amt, side, liveQuotes) => setPortfolio((b) => {
    const nb = tradeBook(b, instrId, amt, side, room.economy, liveQuotes, room.quarterIndex);
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
        rolesPlayed: recordRolePlayed(seat), networkPlayed: true,
      })));
      const roleForDefeat = seatRole(seat).id;
      // расчёт по портфелю (переоценка, экспирация опционов, маржин-колл) —
      // тем же способом, что и в соло-игре трейдера, только экономику берём
      // из ответа сервера, а не считаем сами
      if (r.mode === 'trader') {
        setPortfolio((b) => {
          const withBench = b.benchStart ? b : { ...b, benchStart: { stockIndex: r.economy.stockIndex, bondIndex: r.economy.bondIndex,
            depositIndex: r.economy.depositIndex, priceLevel: r.economy.priceLevel } };
          const nb = settleQuarter(withBench, r.economy, r.quarterIndex);
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

  const isTraderRoom = room.mode === 'trader';
  const roleDef = seatRole(seat);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  const roomSeats = seatsForMode(room.mode);
  const otherSeat = roomSeats[0] === seat ? roomSeats[1] : roomSeats[0];
  const otherRole = seatRole(otherSeat);
  const OtherRoleIcon = ROLE_ICON[otherRole.icon];
  const levers = LEVERS.filter((l) => roleDef.groups.includes(l.group)).filter((l) => !l.onlyIf || l.onlyIf(decisions));
  const economy = room.economy;
  const prevEcon = room.history.length >= 2 ? room.history[room.history.length - 2] : economy;
  const setLever = (id2, v) => setDecisions((d) => ({ ...d, [id2]: v }));
  const shareKey = (lid) => (lid === 'shareHealth' ? 'health' : lid === 'shareEducation' ? 'education' : lid === 'shareScience' ? 'science' : lid === 'shareDefense' ? 'defense' : 'admin');
  const leverDisplay = (l) => (l.subgroup === 'budget' ? economy.budgetShares[shareKey(l.id)] : economy[l.id]);
  const [chartGroup, setChartGroup] = useState('output');
  const [hiddenSeries, setHiddenSeries] = useState([]);
  const [period, setPeriod] = useState('5y');
  const [activeTab, setActiveTab] = useState('economy');
  const [dense, setDense] = useState(false);
  const [dashboards, setDashboards] = useState(DASHBOARD_PRESETS);
  const [activeDash, setActiveDash] = useState('overview');
  const [pinned, setPinned] = useState(DEFAULT_PINS);
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
  const saveDash = () => {
    const name = `Мой набор ${dashboards.filter((d) => d.custom).length + 1}`;
    const did = `custom${Date.now()}`;
    setDashboards((ds) => [...ds, { id: did, name, pins: [...pinned], custom: true }]);
    setActiveDash(did);
  };
  const deleteDash = (did) => setDashboards((ds) => ds.filter((d) => d.id !== did));
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
      const r = await submitDecisions(id, seat, token, decisions, null, portfolioValue);
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

  const waitingForOther = sent && !room.ready[otherSeat];
  // сколько времени осталось до того, как сервер решит за отсутствующего игрока
  // ботом (см. QUARTER_TIMEOUT_MS/maybeForceResolve в api/room.js) — держим в поле
  // зрения, чтобы «квартал стоит» не выглядело так, будто ничего не произойдёт
  const timeLeftMs = room.quarterStartedAt ? Math.max(0, room.quarterStartedAt + QUARTER_TIMEOUT_MS - nowTick) : null;
  const timeLeftLabel = timeLeftMs === null ? null
    : `${Math.floor(timeLeftMs / 60000)}:${String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')}`;
  // таймер общий на квартал, а не «мой» — он должен быть виден, пока ХОТЬ ОДНО
  // занятое место не отправило решение, а не только пока не ответил партнёр:
  // раньше условие держалось на room.ready[otherSeat], и как только партнёр
  // отправлял решение раньше меня, мой собственный (всё ещё тикающий) таймер
  // необъяснимо пропадал с моего же экрана
  const quarterPending = roomSeats.some((sx) => room.occupied[sx] && !room.ready[sx]);
  const otherAction = room.lastActions ? room.lastActions[otherSeat] : null;
  const otherDisconnected = room.occupied[otherSeat] && room.connected && !room.connected[otherSeat];
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
      {showPaper && <NewspaperModal news={room.news} history={room.history} quarterIndex={room.quarterIndex} onClose={() => setShowPaper(false)} />}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} />
      {defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={room.quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={exit} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }} restartLabel="В меню" />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: seatRole(seat).id, quarterIndex: room.quarterIndex, economy: room.economy,
        startEconomy: room.history && room.history[0], portfolio, defeat,
      })} />}

      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, background: COLOR.panel,
        padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 4, background: COLOR.goldDim, border: `1px solid ${COLOR.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash} deleteDash={deleteDash} />
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
            <div><b style={{ color: COLOR.rust }}>{room.names[otherSeat] || 'Партнёр'} не на связи.</b> <span style={{ color: COLOR.muted }}>
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

      <div className="ems-grid" style={{ padding: 18 }}>
        <div className={narrow && mobileCol !== 'left' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isTraderRoom ? (
            <PortfolioSummary book={portfolio} economy={economy} live={null} goal="max_wealth"
              prevValue={portfolio.history && portfolio.history.length > 1 ? portfolio.history[portfolio.history.length - 2] : null}
              opponent={{ label: room.names[otherSeat] || otherRole.short, value: (room.portfolioValues || {})[otherSeat] }} />
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
          <ChartPanel history={room.history} chartGroup={chartGroup} setChartGroup={setChartGroup}
            hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
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
      </div>

      {defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={exit} restartLabel="В меню" />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '14px 18px',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0 }}>
          {error && <span style={{ color: COLOR.rust, fontSize: 12, marginRight: 'auto' }}>{error}</span>}
          {!error && (
            <span style={{ fontSize: 11.5, color: COLOR.faint, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
              {isTraderRoom
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
              {busy ? 'Отправка…' : isTraderRoom ? 'Готов к следующему кварталу' : 'Отправить решения квартала'}
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
// Стили только для главного меню — не трогают общие .ems-* классы, которыми
// пользуются остальные экраны. Пилот редизайна: если приживётся, эти же приёмы
// (мягкая тень на панелях, скруглённые карточки, градиентный заголовок) можно
// будет вынести в GlobalStyle и распространить на всё приложение.
const MenuStyle = () => (
  <style>{`
    .ems-menu-shell { position: relative; z-index: 0; }
    .ems-menu-shell::before {
      content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
      background:
        radial-gradient(760px 460px at 12% -12%, ${COLOR.goldDim} 0%, transparent 62%),
        radial-gradient(640px 420px at 105% 8%, ${COLOR.tealDim} 0%, transparent 58%);
      opacity: 0.8;
    }
    .ems-menu-eyebrow { font-family: ${FONT.mono}; font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: ${COLOR.gold}; }
    .ems-menu-title { font-family: ${FONT.serif}; font-size: 42px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.12; margin: 12px 0 0;
      color: ${COLOR.text}; background: linear-gradient(180deg, ${COLOR.text} 0%, ${COLOR.muted} 145%);
      background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .ems-menu-rule { width: 88px; height: 3px; margin: 18px auto 0; border-radius: 2px;
      background: linear-gradient(90deg, transparent, ${COLOR.gold}, transparent); }
    .ems-menu-badge { display: inline-flex; align-items: center; gap: 7px; font-family: ${FONT.mono}; font-size: 11px; color: ${COLOR.muted};
      padding: 6px 13px; border: 1px solid ${COLOR.border}; border-radius: 999px; background: ${COLOR.panelAlt}; margin-top: 18px; }
    .ems-menu-lede { color: ${COLOR.muted}; font-size: 14px; margin: 16px auto 0; max-width: 520px; line-height: 1.65; }
    .ems-menu-card { position: relative; display: flex; align-items: center; gap: 15px; padding: 17px 20px; cursor: pointer;
      border-radius: 13px; border: 1px solid ${COLOR.border}; background: ${COLOR.panel};
      box-shadow: 0 1px 2px rgba(0,0,0,0.14), 0 12px 28px -16px rgba(0,0,0,0.55);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background-color .18s ease; }
    .ems-menu-card:hover, .ems-menu-card:focus-visible { transform: translateY(-2px); border-color: ${COLOR.gold};
      background: ${COLOR.panelRaised}; box-shadow: 0 1px 2px rgba(0,0,0,0.18), 0 18px 36px -16px rgba(0,0,0,0.65); }
    .ems-menu-card:active { transform: translateY(0); }
    .ems-menu-icon { width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, ${COLOR.goldDim}, transparent); border: 1px solid ${COLOR.goldDim};
      transition: transform .18s ease, border-color .18s ease; }
    .ems-menu-card:hover .ems-menu-icon { transform: scale(1.07) rotate(-2deg); border-color: ${COLOR.gold}; }
    .ems-menu-chevron { transition: transform .18s ease; }
    .ems-menu-card:hover .ems-menu-chevron { transform: translateX(3px) rotate(-90deg); }
    .ems-menu-panel { border-radius: 13px !important; box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 8px 20px -14px rgba(0,0,0,0.5); }
    .ems-menu-save-row { border-radius: 9px !important; transition: background-color .15s ease, border-color .15s ease; }
    .ems-menu-save-row:hover { background: ${COLOR.panelRaised} !important; border-color: ${COLOR.borderStrong} !important; }
    .ems-menu-theme-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 9px; border-radius: 999px; font-size: 10.5px;
      cursor: pointer; transition: border-color .15s ease, background-color .15s ease, transform .15s ease; }
    .ems-menu-theme-chip:hover { transform: translateY(-1px); }
    .ems-menu-theme-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2); }
    @media (prefers-reduced-motion: reduce) {
      .ems-menu-card, .ems-menu-icon, .ems-menu-chevron, .ems-menu-theme-chip { transition: none !important; }
      .ems-menu-card:hover, .ems-menu-card:hover .ems-menu-icon, .ems-menu-card:hover .ems-menu-chevron { transform: none !important; }
    }
    @media (max-width: 480px) {
      .ems-menu-title { font-size: 31px; }
    }
  `}</style>
);

function MainMenu({ theme, setTheme, onNewGame, onNetwork, onTutorial, onLoad }) {
  const playerId = useMemo(getPlayerId, []);
  const [soloSlots, setSoloSlots] = useState(null);
  const [slotBusy, setSlotBusy] = useState(null);
  const [slotError, setSlotError] = useState('');
  const [storageMode, setStorageMode] = useState(null);
  const [showAch, setShowAch] = useState(false);
  React.useEffect(() => {
    fetchSoloSlots(playerId).then((d) => { setSoloSlots(d.slots); setStorageMode(d.storage || null); })
      .catch(() => setSoloSlots(Array(3).fill(null)));
  }, [playerId]);
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
    { id: 'tutorial', icon: GraduationCap, title: 'Обучение', desc: 'Три квартала в тренировочном кабинете: как ставка и расходы меняют экономику.',
      action: () => { Audio.prime(); Audio.play('tab'); onTutorial(); } },
    { id: 'network', icon: Users, title: 'Игра по сети — вдвоём', desc: 'ЦБ и Минфин (или два трейдера) — разные игроки на одной экономике.',
      action: () => { Audio.prime(); Audio.play('tab'); onNetwork(); } },
    { id: 'achievements', icon: Trophy, title: 'Достижения', desc: 'Коллекция наград, открытых за все ваши партии на этом устройстве.',
      action: () => { Audio.play('click'); setShowAch(true); } },
  ];

  return (
    <div className="ems-root ems-menu-shell" style={{ display: 'flex', justifyContent: 'center', padding: '56px 16px' }}>
      <GlobalStyle />
      <MenuStyle />
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <div style={{ maxWidth: 640, width: '100%' }}>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="ems-menu-eyebrow">Симулятор макроэкономической политики</div>
          <div className="ems-menu-title">Экономическая панель государства</div>
          <div className="ems-menu-rule" />
          <span className="ems-menu-badge"><Clock size={11} color={COLOR.gold} />{romanQ(1)} кв. {CONFIG.startYear} · вступление в должность</span>
          <div className="ems-menu-lede">
            Ставка → кредит → спрос → выпуск → занятость → цены → ожидания. Управляйте центральным банком, Минфином
            или обоими сразу — соло против ботов со своим характером или вдвоём по сети.
          </div>
        </div>

        {storageMode === 'memory' && (
          <div className="ems-panel ems-menu-panel ems-fade-in" style={{ padding: 13, marginBottom: 16, borderColor: COLOR.rust, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
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
          <div className="ems-panel ems-menu-panel ems-fade-in" style={{ padding: 15, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <Clock size={13} color={COLOR.teal} />
              <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>
                Продолжить ({soloSlots.filter(Boolean).length}/3)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {soloSlots.map((slot, idx) => {
                if (!slot) return null;
                const roleTitle = (ROLES.find((r) => r.id === slot.role) || {}).short || slot.role;
                return (
                  <div key={idx} className="ems-menu-save-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12 }}>
                    <span style={{ flex: 1, color: COLOR.text }}>{roleTitle} · {quarterLabel(Math.max(1, (slot.quarterIndex || 1) - 1))}</span>
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
              <div key={item.id} onClick={item.action} className="ems-menu-card ems-fade-in"
                style={{ animationDelay: `${80 + i * 55}ms` }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') item.action(); }}>
                <div className="ems-menu-icon">
                  <Icon size={19} color={COLOR.gold} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{item.title}</div>
                  <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>{item.desc}</div>
                </div>
                <ChevronDown className="ems-menu-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>

        <div className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: COLOR.faint, marginRight: 2 }}>Оформление:</span>
          {Object.values(THEMES).map((t) => (
            <button key={t.id} className="ems-menu-theme-chip" style={{
              background: theme === t.id ? COLOR.gold : COLOR.panelAlt, color: theme === t.id ? COLOR.ink : COLOR.muted,
              border: `1px solid ${theme === t.id ? COLOR.gold : COLOR.border}` }}
              onClick={() => { Audio.play('tab'); setTheme(t.id); }}>
              <span className="ems-menu-theme-dot" style={{ background: t.colors.gold }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ ОБУЧЕНИЕ ============================ */
// Отдельный, сильно упрощённый режим: своя мини-экономика (без бота-оппонента,
// кризисов и оценки партии), четыре квартала со сценарием и один открываемый
// рычаг за шаг. Использует настоящий движок (simulateQuarter), поэтому цифры
// в уроке — не постановочные, а результат тех же формул, что и в игре.
const TUTORIAL_PINS = ['gdp', 'inflation', 'unemployment', 'debtToGdp'];
const TUTORIAL_STEPS = [
  {
    title: 'Добро пожаловать',
    lever: null, runsQuarter: true,
    body: ({ economy }) => (
      <>
        <p>Это тренировочный кабинет: три квартала на калькуляторе, без бота-оппонента, кризисов и оценки партии в конце. Настоящая игра сложнее — там второй ветвью власти управляет бот со своим характером, случаются кризисы, а итог партии сравнивается с выбранной целью.</p>
        <p>Экономика считается кварталами, и решение сегодня отражается на показателях с лагом в один-два квартала — эффект не мгновенный. Это главное, что стоит запомнить прямо сейчас.</p>
        <p>Сейчас инфляция {pctFmt(economy.inflation)} при цели {pctFmt(economy.inflationTarget)}, рост в норме. Нажмите «Далее», чтобы посмотреть на квартал без вашего вмешательства.</p>
      </>
    ),
  },
  {
    title: 'Ключевая ставка',
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
    title: 'Лаг и бюджетный рычаг',
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
    title: 'Вот и эффект',
    lever: null, runsQuarter: false,
    body: ({ economy, history }) => {
      const before = history[1] ? history[1].inflation : economy.inflation;
      const now = economy.inflation;
      return (
        <>
          <p>Сравните: сразу после первого квартала инфляция была {pctFmt(before)}. Сейчас, когда ставка и расходы успели подействовать, — {pctFmt(now)}. {now < before
            ? 'Повышение ставки перевесило стимул от расходов — инфляция снижается.'
            : 'Стимул от расходов оказался сильнее охлаждающего эффекта ставки — инфляция подросла.'}</p>
          <p>Это и есть главный урок: эффект решений накапливается и проявляется с задержкой. В настоящей партии придётся действовать на несколько кварталов вперёд, а не подстраиваться под сиюминутную цифру.</p>
        </>
      );
    },
  },
  {
    title: 'Занятие окончено', isFinal: true, lever: null, runsQuarter: false,
    body: () => (
      <>
        <p>Вы прошли всю цепочку: <b>ставка/расходы → кредит и спрос → выпуск → занятость → цены → ожидания</b>. В настоящей партии добавятся: бот на второй ветви власти со своим характером и требованиями, случайные кризисы, выборы и оценка партии по выбранной цели.</p>
        <p>Готовы попробовать по-настоящему?</p>
      </>
    ),
  },
];

function TutorialScreen({ onFinish }) {
  const initEconomy = useMemo(() => makeInitialEconomy(), []);
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState([{ q: 0, label: `${quarterLabel(1)} (старт)`, ...initEconomy }]);
  const [decisions, setDecisions] = useState(() => defaultDecisions(initEconomy));
  const [pendingImpulses, setPendingImpulses] = useState([]);
  const [eventCooldowns, setEventCooldowns] = useState({});
  const [quarterIndex, setQuarterIndex] = useState(1);
  const [step, setStep] = useState(0);
  const [leverBaseline, setLeverBaseline] = useState(initEconomy.keyRate);
  const { toast: achToast, push: pushAch } = useAchievementToasts();
  const prevEcon = history.length >= 2 ? history[history.length - 2] : initEconomy;

  const cur = TUTORIAL_STEPS[step];
  const lever = cur.lever ? LEVERS.find((l) => l.id === cur.lever) : null;
  const delta = lever ? decisions[cur.lever] - leverBaseline : 0;
  const canAdvance = !lever || delta >= cur.minDelta - 1e-9;

  const advance = () => {
    Audio.play('stamp');
    if (cur.runsQuarter) {
      const result = simulateQuarter({
        economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'easy', quarterIndex, stories: [],
        botAction: null, botActions: [], noEvents: true,
      });
      const newHistory = [...history, { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy }];
      const newDecisions = defaultDecisions(result.economy, decisions);
      setEconomy(result.economy);
      setHistory(newHistory);
      setPendingImpulses(result.pendingImpulses);
      setEventCooldowns(result.eventCooldowns);
      setQuarterIndex((q) => q + 1);
      setDecisions(newDecisions);
      const nextStep = TUTORIAL_STEPS[step + 1];
      if (nextStep && nextStep.lever) setLeverBaseline(newDecisions[nextStep.lever]);
    }
    const isLast = step + 1 >= TUTORIAL_STEPS.length - 1;
    if (isLast) pushAch(unlockAchievements(['tutorial_done']));
    setStep((s) => s + 1);
  };

  return (
    <div className="ems-root" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <AchievementToast toast={achToast} />
      <div style={{ maxWidth: 640, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onFinish('menu'); }}>
          ← Прервать обучение
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="ems-serif" style={{ fontSize: 22, fontWeight: 600 }}>{cur.title}</span>
          <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>шаг {step + 1} из {TUTORIAL_STEPS.length}</span>
        </div>
        <div className="ems-hr" style={{ marginBottom: 18 }} />

        <div className="ems-kpi-strip" style={{ marginBottom: 18 }}>
          {TUTORIAL_PINS.map((key) => {
            const m = ALL_METRICS[key];
            const val = economy[key];
            return (
              <KpiTile key={key} label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'}
                delta={economy[key] - prevEcon[key]} invert={m.invert}
                series={history.slice(-6).map((h) => h[key]).filter(Number.isFinite)} />
            );
          })}
        </div>

        <div className="ems-panel" style={{ padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: COLOR.text, marginBottom: 18 }}>
          {cur.body({ economy, history, decisions })}
        </div>

        {lever && (
          <div className="ems-panel" style={{ padding: 16, marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{lever.label}</span>
              <span className="ems-mono" style={{ fontSize: 13 }}>{decisions[cur.lever].toFixed(2)}{lever.suffix}</span>
            </div>
            <input type="range" className="ems-slider" min={lever.min} max={lever.max} step={lever.step} value={decisions[cur.lever]}
              onChange={(e) => { Audio.play('tick'); setDecisions((d) => ({ ...d, [cur.lever]: Number(e.target.value) })); }} />
            <div style={{ fontSize: 11, color: canAdvance ? COLOR.teal : COLOR.faint, marginTop: 8 }}>
              Изменение: {fmtSigned1(delta)}{lever.suffix} — нужно не меньше +{cur.minDelta}{lever.suffix}
            </div>
          </div>
        )}

        {cur.isFinal ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ems-btn primary" style={{ flex: 1, padding: '13px 0', fontSize: 14 }}
              onClick={() => { Audio.prime(); onFinish('setup'); }}>
              Начать настоящую партию
            </button>
            <button className="ems-btn" style={{ padding: '13px 20px', fontSize: 13 }}
              onClick={() => onFinish('menu')}>
              В меню
            </button>
          </div>
        ) : (
          <button disabled={!canAdvance} className="ems-btn primary" style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
            onClick={advance}>
            Далее
          </button>
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
  const roleDef = ROLES.find((r) => r.id === role);
  const botRole = roleDef ? roleDef.botRole : null;
  const personaBlocks = botRole === 'central_bank' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' }]
    : botRole === 'ministry_finance' ? [{ list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }]
      : botRole === 'both' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' },
        { list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }] : [];
  const personas = personaBlocks.length ? personaBlocks : null;

  return (
    <div className="ems-root" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 800, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div className="ems-serif" style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.01em' }}>Новая партия</div>
          <div className="ems-mono" style={{ color: COLOR.faint, fontSize: 11, marginTop: 9 }}>{romanQ(1)} кв. {CONFIG.startYear} · вступление в должность</div>
          <div style={{ color: COLOR.muted, fontSize: 13.5, marginTop: 14, maxWidth: 600, margin: '14px auto 0', lineHeight: 1.55 }}>
            Экономика работает как цепочка причин: ставка → рыночные ставки → кредит → спрос → выпуск → занятость → зарплаты → цены → ожидания. Второй ветвью власти управляет бот со своим характером — и у него будут к вам требования.
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
              <div key={r.id} onClick={() => { Audio.prime(); Audio.play('click'); setRole(r.id); }} className="ems-panel"
                style={{ padding: 16, cursor: 'pointer', position: 'relative', borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}>
                {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 14, right: 14 }} />}
                <Icon size={20} color={active ? COLOR.gold : COLOR.muted} />
                <div className="ems-serif" style={{ fontSize: 14.5, margin: '9px 0 5px', color: active ? COLOR.goldSoft : COLOR.text }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            );
          })}
        </div>

        {personaBlocks.map((blk, bi) => (
          <React.Fragment key={blk.title}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>{bi === 0 ? 2 : ''}</span>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{blk.title}</span>
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10 }}>
              {botRole === 'both' ? 'Вы не управляете этим ведомством — но от его решений зависит стоимость ваших активов.'
                : blk.list === CB_PERSONAS ? 'Ставкой будет управлять бот-ЦБ. От его характера зависит, насколько дорого вам обойдётся бюджетная экспансия.'
                  : 'Бюджетом будет управлять бот-Минфин. От его характера зависит, с какой инфляцией и каким долгом вам придётся иметь дело.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 22 }}>
              {blk.list.map((p) => {
                const active = blk.value === p.id;
                return (
                  <div key={p.id} onClick={() => { Audio.play('click'); blk.set(p.id); }} className="ems-panel"
                    style={{ padding: 14, cursor: 'pointer', position: 'relative', borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}>
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
                  <div onClick={() => { Audio.play('click'); blk.set('random'); }} className="ems-panel"
                    style={{ padding: 14, cursor: 'pointer', position: 'relative', borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}>
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
          <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint }}>{personas ? 3 : 2}</span>
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
            const finalCb = cbPersona === 'random' ? pick(CB_PERSONAS) : cbPersona;
            const finalMof = mofPersona === 'random' ? pick(MOF_PERSONAS) : mofPersona;
            onStart({ role, difficulty, goal, cbPersona: finalCb, mofPersona: finalMof });
          }}>
          Принять полномочия
        </button>
      </div>
    </div>
  );
}

/* ============================ ТАБЛИЦЫ ПОКАЗАТЕЛЕЙ ============================ */
const idx0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
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
  'riskPremium', 'exchangeRate', 'importPriceInflation', 'lendingRate', 'nairu', 'creditGap', 'rateGap', 'quartersToElection']);
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
function DemandStrip({ botAction, botRole, economy }) {
  const items = [];
  if (economy.mandate) items.push({ who: 'Мандат власти', text: `Новое правительство пришло с задачей: ${MANDATE_LABEL[economy.mandate] || economy.mandate}.`, color: COLOR.gold });
  if (botAction && botAction.demand) items.push({ who: botRole === 'central_bank' ? 'Центральный банк' : 'Минфин', text: botAction.demand, color: COLOR.blue });
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
  const botPersona = null;
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
  const { toast: achToast, push: pushAch } = useAchievementToasts();
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
  const [dashboards, setDashboards] = useState(initial && initial.dashboards ? initial.dashboards : DASHBOARD_PRESETS);
  const [activeDash, setActiveDash] = useState(initial ? initial.activeDash || 'overview' : 'overview');
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const [pinned, setPinned] = useState(initial && initial.pinned ? initial.pinned : DEFAULT_PINS);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(initial ? initial.lastResponse || null : null);
  const [botAction2, setBotAction2] = useState(initial ? initial.botAction2 || null : null);
  const [portfolio, setPortfolio] = useState(initial && initial.portfolio ? initial.portfolio : emptyBook());
  const [cbPersonaId, setCbPersonaId] = useState(initial && initial.cbPersonaId ? initial.cbPersonaId : setup.cbPersona);
  const [mofPersonaId, setMofPersonaId] = useState(initial && initial.mofPersonaId ? initial.mofPersonaId : setup.mofPersona);
  const [lastReasons, setLastReasons] = useState(initial && initial.lastReasons ? initial.lastReasons
    : { gdpGrowth: [], inflation: [], exchangeRate: [], budget: [], unemployment: [], banking: [], potential: [] });
  const [lastReport, setLastReport] = useState(initial ? initial.lastReport || '' : '');
  const [botAction, setBotAction] = useState(initial ? initial.botAction || null : null);
  const [showWhy, setShowWhy] = useState(false);
  const [activeTab, setActiveTab] = useState('economy');
  const [chartGroup, setChartGroup] = useState('output');
  const [hiddenSeries, setHiddenSeries] = useState([]);
  const [period, setPeriod] = useState('5y');
  const [busy, setBusy] = useState(false);

  const activeBotPersona = botRole === 'central_bank' ? getCbPersona(cbPersonaId) : botRole === 'ministry_finance' ? getMofPersona(mofPersonaId) : null;
  const onTrade = (id, amt, side, live) => setPortfolio((b) => {
    const nb = tradeBook(b, id, amt, side, economy, live, quarterIndex);
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
  const tabs = useMemo(() => (botRole && SUMMARY_TABS[botRole] ? [...INDICATOR_TABS, SUMMARY_TABS[botRole]] : INDICATOR_TABS), [botRole]);
  const snapshot = () => makeSnapshot({ setup: { ...setup, difficulty }, economy, history, decisions, pendingImpulses, eventCooldowns,
    quarterIndex, newsFeed, stories, lastReport, lastReasons, botAction, botAction2, pinned, cbPersonaId, mofPersonaId,
    portfolio, lastResponse, dense, dashboards, activeDash, defeat });
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
  const saveDash = () => {
    const name = `Мой набор ${dashboards.filter((d) => d.custom).length + 1}`;
    const id = `custom${Date.now()}`;
    setDashboards((ds) => [...ds, { id, name, pins: [...pinned], custom: true }]);
    setActiveDash(id);
  };
  const deleteDash = (id) => setDashboards((ds) => ds.filter((d) => d.id !== id));
  const crisisActive = (economy.activeCrises || []).includes('banking') || economy.bankingRisk > 60;

  const finishQuarter = useCallback(() => {
    if (defeat) return;
    setBusy(true);
    let eff = { ...decisions };
    const cbAction = (botRole === 'central_bank' || isTrader) ? botCentralBank(economy, cbPersonaId, difficulty) : null;
    const mofAction = (botRole === 'ministry_finance' || isTrader) ? botFinanceMinistry(economy, mofPersonaId, difficulty) : null;
    if (cbAction) eff = { ...eff, ...cbAction.decisions };
    if (mofAction) eff = { ...eff, ...mofAction.decisions };
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

    const result = simulateQuarter({
      economy: { ...economy, cbStance, mofStance,
        policyCoordination: clamp(economy.policyCoordination + (reqResult ? reqResult.coordination : 0), 0, 100) },
      decisions: eff, pendingImpulses, eventCooldowns,
      difficulty, quarterIndex, stories, botAction: action,
      botActions: isTrader ? [mofAction] : [], publicMode: isTrader,
    });
    if (reqResult) {
      const who = botRole === 'central_bank' ? 'ЦБ → МИНФИН' : 'МИНФИН → ЦБ';
      result.newsEntries.unshift({ id: `req${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${reqResult.req.label.toUpperCase()} — ${reqResult.status === 'accepted' ? 'СОГЛАСОВАНО' : reqResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${reqResult.req.ask}» ${reqResult.text} Согласованность политики ${reqResult.coordination > 0 ? 'выросла' : 'снизилась'} на ${Math.abs(reqResult.coordination)} пункта.` });
      setLastResponse({ status: reqResult.status, text: reqResult.text });
      setPendingRequest(null);
    }
    let traderEvents = [];
    let bookVal = null;
    if (isTrader) {
      const withBench = portfolio.benchStart ? portfolio : { ...portfolio, benchStart: { stockIndex: economy.stockIndex, bondIndex: economy.bondIndex,
        depositIndex: economy.depositIndex, priceLevel: economy.priceLevel } };
      const nb = settleQuarter(withBench, result.economy, quarterIndex);
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
      rolesPlayed: recordRolePlayed(setup.role), networkPlayed: isNetworkPlayed(),
    })));
    const nextDefeat = checkDefeat({ role: setup.role, economy: result.economy, history: newHistory, bookVal });
    if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setLastReasons(result.reasons);
    setLastReport(result.report);
    setBotAction(action);
    setBotAction2(isTrader ? mofAction : null);
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
  }, [economy, decisions, pendingImpulses, eventCooldowns, setup, quarterIndex, botRole, stories, cbPersonaId, mofPersonaId, pendingRequest, portfolio, isTrader, history, pushAch, defeat]);

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
      {irf && <IRFModal economy={economy} decisions={decisions} lever={irf.lever} value={irf.value} baseValue={irf.base}
        difficulty={difficulty} onClose={() => setIrf(null)} />}
      <Atmosphere regime={economy.regime} flashKey={flashKey}
        intensity={clamp((economy.inflationRisk * 0.25 + economy.bankingRisk * 0.3 + economy.debtRisk * 0.2 + economy.recessionRisk * 0.25) / 100, 0, 1)} />
      {showWhy && <WhyModal reasons={lastReasons} onClose={() => setShowWhy(false)} />}
      {showPaper && <NewspaperModal news={newsFeed} history={history} quarterIndex={quarterIndex} onClose={() => setShowPaper(false)} />}
      {saveModal && <SaveLoadModal mode={saveModal} snapshot={snapshot()} onClose={() => setSaveModal(null)}
        onLoad={(d) => { setSaveModal(null); onLoadState(d); }} />}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} />
      {defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={onRestart} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }} />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: setup.role, quarterIndex, economy, startEconomy: history[0], portfolio, defeat,
      })} />}

      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 4, background: COLOR.goldDim, border: `1px solid ${COLOR.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            <div className="ems-serif" style={{ fontSize: 18 }}>Страна — экономическая панель</div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              {roleDef.title} · сложность: {(DIFFICULTIES.find((x) => x.id === difficulty) || {}).title}
              {activeBotPersona ? ` · вторая ветвь: ${activeBotPersona.name} (бот)` : setup.role === 'trader' ? '' : ' · без ботов'}
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
              <Flag size={11} />Выборы через {economy.quartersToElection} кв.
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
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash} deleteDash={deleteDash} />
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
        {!isTrader && <DemandStrip botAction={botAction} botRole={botRole} economy={economy} />}
        <RegimeBanner economy={economy} />
        {(economy.activeCrises || []).filter((c) => c !== economy.regime).map((c) => (
          <div key={c} className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '8px 11px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>{CRISIS_INFO[c] ? CRISIS_INFO[c].label : c}.</b> <span style={{ color: COLOR.muted }}>{CRISIS_INFO[c] ? regimeInfoText(CRISIS_INFO[c], economy) : ''}</span></span>
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

      <div className="ems-grid" style={{ padding: 18, display: view === 'dash' ? undefined : 'none' }}>
        {/* ЛЕВАЯ ПАНЕЛЬ */}
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
          {!isTrader && (
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
          ) : (
            <BotPanel botRole={botRole} persona={activeBotPersona} lastAction={botAction} economy={economy} coordination={economy.policyCoordination} />
          )}
        </div>

        {/* ЦЕНТР */}
        <div className={narrow && mobileCol !== 'center' ? 'ems-col-hidden' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <NewsTerminal items={newsFeed} onOpenPaper={() => setShowPaper(true)} />
          <ChartPanel history={history} chartGroup={chartGroup} setChartGroup={setChartGroup} hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
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

        {/* ПРАВАЯ ПАНЕЛЬ */}
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
      </div>

      {defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={onRestart} />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0 }}>
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
        <TutorialScreen key={theme}
          onFinish={(next) => setView(next === 'setup' ? 'setup' : 'menu')}
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
}
