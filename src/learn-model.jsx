/* ЖИВАЯ МОДЕЛЬ И «ОТКРОЙ САМ»: улица у метро «Торговая» с кофейнями и прохожими, день в
   «Зерне» (ученик ставит цену — точки на графике складываются в кривую спроса) и модель рынка
   капучино, которая собирается по ходу юнита. Логика — src/learn/model.js.
   Подача — как у всего обучения: бумага, тушь, гравюра, PT Serif; фигурки — тушью, без
   мультяшности. Движение короткое (около полутора секунд) и не мешает читать; при «уменьшить
   движение» — без анимации, только смена состояний. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Lock, RotateCcw, Newspaper, Check, Coffee, TrendingDown, Wallet, Leaf, Factory, Wheat, ArrowDownToLine, Spline, LayoutGrid, BadgeCheck, Gauge,
  ChevronsDown, ChevronDown, Minus, ChevronUp, ChevronsUp,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { Mascot } from './mascot.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { Button } from './ds.jsx';
import { plural } from './lib/plural.js';
import {
  DAY, dayResult, distinctPrices, lineShown, discoverDone, fitDemand,
  MODEL_AXES, MODEL_NEWS, MODEL_DEFAULT, modelParts, modelProgress, modelReadout, modelEquilibrium, modelStory, mqd, mqs, BASE, BASE_EQ,
  FACTOR_STEPS, FACTOR_WORDS, CEILING_STEPS, ELASTIC_STEPS,
} from './learn/model.js';

export const MODEL_CSS = `
  .lm-street { width: 100%; display: block; margin: 4px 0 8px; border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); }
  .lm-street text { font-family: var(--ds-head); }
  .lm-chart { width: 100%; max-width: 380px; display: block; margin: 4px auto 6px; }
  .lm-chart text { font: 700 12px var(--ds-mono); fill: var(--ds-ink2); }
  .lm-chart .lm-ax { font: 600 12px var(--ds-sans); fill: var(--ds-ink3); }
  .lm-range { width: 100%; accent-color: var(--u); height: 30px; }
  .lm-read { font-size: 15px; text-align: center; min-height: 22px; margin: 2px 0 6px; }
  .lm-read b { font-family: var(--ds-mono); }
  .lm-days { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; font: 12.5px var(--ds-mono); color: var(--ds-ink2); margin: 2px 0 6px; }
  .lm-say { display: flex; gap: 10px; align-items: center; border: 1px solid var(--u); border-radius: 6px; background: color-mix(in srgb, var(--u) 7%, var(--ds-card)); padding: 10px 12px; margin: 8px 0; font-size: 15.5px; line-height: 1.4; }
  .lm-line { stroke-dasharray: 420; stroke-dashoffset: 420; animation: lm-draw 1.1s ease-out forwards; }
  @keyframes lm-draw { to { stroke-dashoffset: 0; } }
  /* живая модель */
  .lm { position: relative; }
  .lm-head { display: flex; align-items: flex-start; gap: 10px; }
  .lm-title { font: 700 19px/1.25 var(--ds-head); margin-top: 2px; }
  .lm-badge { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 3px 9px 3px 7px; border-radius: 999px; font: 700 12.5px var(--ds-sans);
    color: var(--ds-ok-ink); background: var(--ds-ok-bg); border: 1px solid color-mix(in srgb, var(--ds-ok) 45%, transparent); }
  .lm-ring { position: relative; width: 50px; height: 50px; flex-shrink: 0; }
  .lm-ring svg { transform: rotate(-90deg); display: block; }
  .lm-ring circle { fill: none; stroke-width: 3.5; }
  .lm-ring .bg { stroke: var(--ds-rule); }
  .lm-ring .fg { stroke: var(--u); stroke-linecap: round; transition: stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1); }
  .lm-ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 14px var(--ds-mono); color: var(--u-ink); letter-spacing: -.06em; }
  .lm-ring small { font-size: 12px; color: var(--ds-ink3); font-weight: 600; }
  .lm-stage { margin: 10px 0 2px; border-radius: 10px; background: color-mix(in srgb, var(--ds-card2) 55%, var(--ds-card)); border: 1px solid var(--ds-rule); padding: 4px 4px 0; }
  .lm-stage .lm-chart { max-width: 420px; margin: 0 auto; }
  .lm-guide { fill: none; stroke: var(--ds-ink3); stroke-width: 1.2; stroke-dasharray: 3 4; opacity: .8; }
  .lm-curve-name { font: 700 14px var(--ds-head) !important; }
  .lm-tag rect { fill: var(--ds-ink); }
  .lm-tag text { font: 700 11px var(--ds-mono) !important; fill: var(--ds-paper) !important; }
  .lm-short { font: 700 11.5px var(--ds-sans) !important; fill: var(--ds-bad) !important; }
  .lm-pulse { opacity: .16; transform-box: fill-box; transform-origin: center; animation: lm-pulse 2.2s ease-in-out infinite; }
  @keyframes lm-pulse { 0%, 100% { transform: scale(.7); opacity: .22; } 50% { transform: scale(1.15); opacity: .08; } }
  .lm-board { display: grid; gap: 6px; text-align: center; margin: 8px 0 6px; }
  .lm-board > div { border: 1px solid var(--ds-rule2); border-radius: 8px; padding: 6px 4px 7px; background: var(--ds-card); display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .lm-board-label { font: 600 12px var(--ds-sans); color: var(--ds-ink3); }
  .lm-board b { font: 700 21px/1.15 var(--ds-mono); color: var(--ds-ink); }
  .lm-board .bad b { color: var(--ds-bad); }
  .lm-delta { font: 700 12px var(--ds-mono); border-radius: 999px; padding: 1px 6px; }
  .lm-delta.up { color: var(--ds-ok-ink); background: var(--ds-ok-bg); }
  .lm-delta.down { color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 10%, var(--ds-card)); }
  .lm-story { font-size: 15px; line-height: 1.45; padding: 9px 12px; border-radius: 8px; background: var(--ds-card2); color: var(--ds-ink2); margin-bottom: 10px; }
  .lm-story.on { background: color-mix(in srgb, var(--u) 9%, var(--ds-card)); color: var(--ds-ink); border-left: 3px solid var(--u); padding-left: 10px; }
  .lm-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 7px; }
  .lm-tile { position: relative; display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 7px 9px; text-align: left; cursor: pointer; border-radius: 10px;
    border: 1.5px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink); transition: border-color .15s, background .15s, transform .12s; }
  .lm-tile:active { transform: scale(.97); }
  .lm-tile.on { border-color: var(--u); background: color-mix(in srgb, var(--u) 8%, var(--ds-card)); box-shadow: 0 2px 0 color-mix(in srgb, var(--u) 35%, transparent); }
  .lm-tile.changed::after { content: ''; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--u); }
  .lm-tile-ic { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--ds-card2); color: var(--u-ink); }
  .lm-tile.on .lm-tile-ic { background: var(--u); color: #fff; }
  .lm-tile-txt { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .lm-tile-txt b { font: 700 13.5px var(--ds-sans); }
  .lm-tile-txt span { font-size: 12.5px; color: var(--ds-ink3); margin-top: 2px; }
  .lm-tile.changed .lm-tile-txt span { color: var(--u-ink); font-weight: 700; }
  .lm-panel { margin-top: 8px; padding: 10px 12px 12px; border-radius: 10px; border: 1.5px solid var(--u); background: var(--ds-card); animation: lm-panel .22s ease-out both; }
  @keyframes lm-panel { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .lm-panel-text { font-size: 14.5px; line-height: 1.4; color: var(--ds-ink2); margin-bottom: 9px; }
  .lm-caption { font-size: 13.5px; color: var(--ds-ink3); margin-top: 7px; text-align: center; }
  .lm-caption b { color: var(--ds-ink); }
  .lm-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border: 1.5px solid var(--ds-rule2); border-radius: 10px; overflow: hidden; background: var(--ds-card2); }
  .lm-steps button { min-height: 42px; border: none; border-left: 1px solid var(--ds-rule2); background: none; color: var(--ds-ink2); font: 700 14px var(--ds-mono); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
  .lm-steps button:first-child { border-left: none; }
  .lm-steps button[aria-checked="true"] { background: var(--u); color: #fff; }
  .lm-steps button:focus-visible, .lm-tile:focus-visible, .lm-chip:focus-visible, .lm-news-btn:focus-visible, .lm-switch:focus-visible { outline: 3px solid var(--ds-focus, var(--u)); outline-offset: 2px; }
  .lm-price .lm-scale { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; color: var(--ds-ink3); }
  .lm-price .lm-scale b { font-size: 16px; color: var(--u-ink); }
  .lm-news-list { display: grid; gap: 6px; }
  .lm-news-btn { display: flex; align-items: center; gap: 8px; text-align: left; padding: 9px 11px; border-radius: 8px; border: 1.5px solid var(--ds-rule2); background: var(--ds-card); cursor: pointer;
    font: 600 14px/1.3 var(--ds-news, var(--ds-head)); color: var(--ds-ink); }
  .lm-news-btn[aria-pressed="true"] { border-color: var(--u); background: color-mix(in srgb, var(--u) 9%, var(--ds-card)); }
  .lm-switch { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 4px 0; cursor: pointer; font: 600 14.5px var(--ds-sans); color: var(--ds-ink); }
  .lm-switch .knob { position: relative; width: 40px; height: 24px; border-radius: 999px; background: var(--ds-rule2); transition: background .2s; flex-shrink: 0; }
  .lm-switch .knob::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .2s; }
  .lm-switch[aria-checked="true"] .knob { background: var(--u); }
  .lm-switch[aria-checked="true"] .knob::after { transform: translateX(16px); }
  .lm-chips-wrap { margin-top: 12px; }
  .lm-chips-head { font: 700 12px var(--ds-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ds-ink3); margin-bottom: 6px; }
  .lm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .lm-chip { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 5px 11px; border-radius: 999px; border: 1px dashed var(--ds-rule2); background: none; cursor: pointer;
    font: 600 13px var(--ds-sans); color: var(--ds-ink3); }
  .lm-chip.got { border-style: solid; color: var(--ds-ok-ink); background: var(--ds-ok-bg); border-color: color-mix(in srgb, var(--ds-ok) 40%, transparent); }
  .lm-chip.on { border-color: var(--u); color: var(--ds-ink); }
  .lm-chip-note { margin-top: 7px; font-size: 14px; line-height: 1.4; color: var(--ds-ink2); padding: 8px 11px; border-radius: 8px; background: var(--ds-card2); animation: lm-panel .2s ease-out both; }
  .lm-empty { display: flex; gap: 12px; align-items: center; margin: 10px 0 4px; }
  .lm-ghost { width: 120px; flex-shrink: 0; }
  .lm-thumb { flex-shrink: 0; border-radius: 6px; background: var(--ds-card2); }
  .ln-fold-prog { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
  .ln-fold-bar { display: block; flex: 1; height: 5px; border-radius: 99px; background: var(--ds-rule); overflow: hidden; max-width: 140px; }
  .ln-fold-bar i { display: block; height: 100%; background: var(--u); border-radius: 99px; }
  @media (prefers-reduced-motion: reduce) { .lm-pulse, .lm-panel, .lm-chip-note { animation: none !important; } .lm-ring .fg { transition: none; } }
  @media (prefers-reduced-motion: reduce) { .lm-line { animation: none !important; stroke-dashoffset: 0 !important; } }
`;

/* ------------------------------ УЛИЦА ------------------------------
   Улица у «Торговой»: вход в метро, «Зерно» посередине и две соседние кофейни (на рынке их
   несколько — без имён, у библии мира их нет). queue — сколько фигурок стоит у дверей «Зерна»,
   short — из них не досталось (дефицит), walkers — прохожие идут мимо; t — ход дня от 0 до 1. */
const SW = 320; const SH = 124; const GROUND = 104; const DOOR = 166;
const hashN = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
function Figure({ x, y = GROUND, k, tone = 'var(--ds-ink2)', fill = 'var(--ds-card)', opacity = 1 }) {
  const h = 15 + hashN(k) * 4; const hat = hashN(k + 7) > 0.66; const coat = hashN(k + 3) > 0.5;
  return (
    <g transform={`translate(${x.toFixed(1)},${y})`} opacity={opacity} stroke={tone} fill={fill} strokeWidth="1.1" strokeLinejoin="round">
      <line x1="-1.6" y1="0" x2="-1.2" y2={-h * 0.38} /><line x1="1.6" y1="0" x2="1.2" y2={-h * 0.38} />
      <path d={coat ? `M-4,${-h * 0.32} L-3,${-h * 0.82} L3,${-h * 0.82} L4,${-h * 0.32} Z` : `M-3,${-h * 0.36} L-3,${-h * 0.82} L3,${-h * 0.82} L3,${-h * 0.36} Z`} />
      <circle cx="0" cy={-h - 1.5} r="3" />
      {hat && <path d={`M-3.6,${-h - 2.6} L3.6,${-h - 2.6} M-2.2,${-h - 2.6} L-1.8,${-h - 5.6} L1.8,${-h - 5.6} L2.2,${-h - 2.6}`} fill="none" />}
    </g>
  );
}
function Cafe({ x, w, name, lit, price = null, testid }) {
  return (
    <g data-testid={testid}>
      <rect x={x} y="34" width={w} height={GROUND - 34} fill={lit ? 'color-mix(in srgb, var(--u) 9%, var(--ds-card))' : 'var(--ds-card)'} stroke="var(--ds-ink2)" strokeWidth="1.1" />
      <path d={`M${x - 4},48 L${x + w + 4},48 L${x + w},40 L${x},40 Z`} fill={lit ? 'color-mix(in srgb, var(--u) 30%, var(--ds-card))' : 'none'} stroke="var(--ds-ink2)" strokeWidth="1" />
      {Array.from({ length: Math.floor((w + 8) / 9) }, (_, k) => <path key={k} d={`M${x - 4 + k * 9},48 q4.5,4 9,0`} fill="none" stroke="var(--ds-ink2)" strokeWidth=".8" />)}
      <text x={x + w / 2} y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ds-ink)">{name}</text>
      <rect x={x + 6} y="58" width={w * 0.42} height="22" fill={lit ? 'var(--ds-gold-soft)' : 'none'} stroke="var(--ds-ink2)" strokeWidth=".9" />
      {price == null && <line x1={x + 6} y1="69" x2={x + 6 + w * 0.42} y2="69" stroke="var(--ds-ink2)" strokeWidth=".6" />}
      <rect x={x + w - 20} y="62" width="13" height={GROUND - 62} fill="var(--ds-card2)" stroke="var(--ds-ink2)" strokeWidth=".9" />
      {/* цена — мелом на витрине */}
      {price != null && (
        <g data-testid="street-price">
          <text x={x + 6 + w * 0.21} y="66.5" textAnchor="middle" fontSize="6" fill="var(--ds-ink)">капучино</text>
          <text x={x + 6 + w * 0.21} y="77" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--ds-ink)" style={{ fontFamily: 'var(--ds-mono)' }}>{price} кр.</text>
        </g>
      )}
    </g>
  );
}
export function Street({ queue = 0, short = 0, walkers = 0, t = 1, price = null, cafes = 1, label }) {
  // фигурки: стоящие в очереди — у двери «Зерна», прохожие — по тротуару слева направо
  const figs = [];
  const q = Math.min(queue, 13);
  for (let k = 0; k < q; k += 1) {
    const u = Math.max(0, Math.min(1, t * 1.6 - (k / Math.max(1, q)) * 0.6));
    const end = DOOR - 6 - k * 6.5; const x = -10 + (end + 10) * u;
    figs.push(<Figure key={`q${k}`} k={k} x={x} tone={k >= q - Math.min(short, q) ? 'var(--ds-bad)' : 'var(--ds-ink2)'} />);
  }
  for (let k = 0; k < Math.min(walkers, 10); k += 1) {
    const u = Math.max(0, Math.min(1, t * 1.5 - (k / 10) * 0.5));
    if (u <= 0 || u >= 1) continue;
    figs.push(<Figure key={`w${k}`} k={k + 40} x={-10 + (SW + 20) * u} y={GROUND + 9} opacity={0.75} />);
  }
  return (
    <svg className="lm-street" viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={label || 'Улица у метро «Торговая»'} data-testid="street" data-queue={q}>
      {/* вход в метро слева */}
      <g>
        <rect x="8" y="64" width="44" height={GROUND - 64} fill="var(--ds-card2)" stroke="var(--ds-ink2)" strokeWidth="1" />
        <path d="M8,64 L30,52 L52,64" fill="none" stroke="var(--ds-ink2)" strokeWidth="1" />
        <circle cx="30" cy="40" r="8" fill="none" stroke="var(--u)" strokeWidth="1.6" />
        <text x="30" y="44" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--u-ink)">М</text>
        <text x="30" y="26" textAnchor="middle" fontSize="8.5" fill="var(--ds-ink2)">«Торговая»</text>
      </g>
      <Cafe x={60} w={46} name={cafes > 1 ? 'кофейня' : ''} lit={cafes > 1} testid="street-cafe" />
      <Cafe x={114} w={66} name="«Зерно»" lit price={price} testid="street-zerno" />
      <Cafe x={200} w={58} name={cafes > 2 ? 'кофейня' : ''} lit={cafes > 2} testid="street-cafe" />
      {/* фонарь и скамейка справа */}
      <path d={`M286,${GROUND} L286,46 q0,-6 8,-6`} fill="none" stroke="var(--ds-ink2)" strokeWidth="1.2" />
      <circle cx="296" cy="44" r="3.5" fill="var(--ds-gold-soft)" stroke="var(--ds-ink2)" strokeWidth=".9" />
      <path d={`M268,${GROUND - 9} L310,${GROUND - 9} M272,${GROUND - 9} L272,${GROUND} M306,${GROUND - 9} L306,${GROUND}`} stroke="var(--ds-ink2)" strokeWidth="1.1" />
      <line x1="0" y1={GROUND} x2={SW} y2={GROUND} stroke="var(--ds-ink2)" strokeWidth="1.2" />
      {Array.from({ length: 16 }, (_, k) => <line key={k} x1={6 + k * 20} y1={GROUND + 3} x2={11 + k * 20} y2={GROUND + 6} stroke="var(--ds-ink3)" strokeWidth=".6" />)}
      {figs}
    </svg>
  );
}

// ход дня: t от 0 до 1 за полторы секунды; при «уменьшить движение» — сразу конец
function useDayClock(key, reduced) {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (!key) return undefined;
    if (reduced) { setT(1); return undefined; }
    let raf = 0; const start = performance.now();
    const step = (now) => { const v = Math.min(1, (now - start) / 1500); setT(v); if (v < 1) raf = requestAnimationFrame(step); };
    setT(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced]);
  return t;
}

/* ------------------------------ ГРАФИК ------------------------------ */
const CW = 320; const CH = 218; const L = 38; const R = 12; const T = 20; const B = 34;
const PWc = CW - L - R;
function Frame({ qMax, pMax, qStep, pStep, qLabel = 'чашек в день', pLabel = 'цена, кр.', children, label, testid, ch = CH }) {
  const PHc = ch - T - B;
  const x = (q) => L + (q / qMax) * PWc; const y = (p) => T + PHc - (p / pMax) * PHc;
  const ticksP = []; for (let p = 0; p <= pMax; p += pStep) ticksP.push(p);
  const ticksQ = []; for (let q = 0; q <= qMax; q += qStep) ticksQ.push(q);
  return (
    <svg className="lm-chart" viewBox={`0 0 ${CW} ${ch}`} role="img" aria-label={label} data-testid={testid}>
      {ticksP.map((p) => <g key={`p${p}`}><line x1={L} x2={L + PWc} y1={y(p)} y2={y(p)} stroke="var(--ds-rule)" /><text x={L - 5} y={y(p) + 3.5} textAnchor="end">{p}</text></g>)}
      {ticksQ.map((q) => <text key={`q${q}`} x={x(q)} y={T + PHc + 14} textAnchor="middle">{q}</text>)}
      <line x1={L} y1={T} x2={L} y2={T + PHc} stroke="var(--ds-ink2)" strokeWidth="2" />
      <line x1={L} y1={T + PHc} x2={L + PWc} y2={T + PHc} stroke="var(--ds-ink2)" strokeWidth="2" />
      <text className="lm-ax" x={L - 4} y={T - 9}>{pLabel}</text>
      <text className="lm-ax" x={L + PWc} y={T + PHc + 28} textAnchor="end">{qLabel}</text>
      {children({ x, y, base: T + PHc })}
    </svg>
  );
}
// отрезок прямой Q = a − bP (или Q = c + dP) в пределах поля графика
function linePts(fq, qMax, pMax, x, y) {
  const pts = [];
  for (let k = 0; k <= 60; k += 1) { const p = (pMax * k) / 60; const q = fq(p); if (q >= 0 && q <= qMax) pts.push(`${x(q).toFixed(1)},${y(p).toFixed(1)}`); }
  return pts.length > 1 ? `M${pts.join('L')}` : '';
}

/* ------------------------------ ОТКРОЙ САМ ------------------------------
   День в «Зерне»: цена ползунком, «Открыть день» — по улице идут люди, часть заходит; точка на
   графике. С четырёх разных цен из точек проступает линия, и Инфля её называет. body/foot —
   обёртки урока (как у колоды «Слов»): кнопка «Дальше» — в нижней панели. */
export function DiscoverDay({ card, onDone, body, foot }) {
  const reduced = useReducedMotion();
  const [price, setPrice] = useState(DAY.start);
  const [days, setDays] = useState([]);
  const last = days[days.length - 1] || null;
  const t = useDayClock(days.length, reduced);
  const running = t < 1;
  const shown = lineShown(days);
  const done = discoverDone(days);
  const fit = shown ? fitDemand(days) : null;
  const left = DAY.need - distinctPrices(days);
  const open = () => {
    if (running) return;
    Audio.play('register');
    setDays((d) => [...d, dayResult(price)]);
  };
  const queue = last ? Math.round((last.bought / DAY.passers) * 12) : 0;
  return (
    <>
      {body(
        <div data-testid="discover" data-days={days.length} data-distinct={distinctPrices(days)} data-line={String(shown)}>
          <h2 className="ds-h1" style={{ fontSize: 25 }}>{card.title}</h2>
          <div className="ds-text" style={{ marginTop: 8 }}><Inline nodes={card.text} /></div>
          <Street queue={last ? queue : 0} walkers={last ? 12 - queue : 0} t={last ? t : 1} price={price} label={last ? `День ${days.length}: при цене ${last.price} кр. зашли ${last.bought} человек` : 'Улица у метро «Торговая»: день ещё не начался'} />
          <div className="lm-read" data-testid="discover-day" aria-live="polite">
            {last ? (running ? `День ${days.length}: идут прохожие…` : <>День {days.length}: при цене <b>{last.price} кр.</b> зашли <b>{last.bought}</b> из {DAY.passers}</>) : 'Поставьте цену и откройте день'}
          </div>
          <label className="ds-sub" style={{ fontSize: 14, display: 'block' }} htmlFor="discover-price">Цена капучино: <b style={{ fontFamily: 'var(--ds-mono)' }}>{price} кр.</b></label>
          <input id="discover-price" type="range" className="lm-range" min={DAY.min} max={DAY.max} step={1} value={price} data-testid="discover-price"
            onChange={(e) => { Audio.play('tick'); setPrice(Number(e.target.value)); }} />
          <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 8px' }}>
            <Button variant="secondary" data-testid="discover-open" disabled={running} onClick={open}>Открыть день {days.length + 1}</Button>
          </div>
          <Frame qMax={DAY.passers} pMax={40} qStep={20} pStep={10} qLabel="сколько купили" label="Точки: цена — сколько купили" testid="discover-chart">
            {({ x, y }) => (
              <>
                {fit && <path className="lm-line" d={linePts((p) => fit.a - fit.b * p, DAY.passers, 40, x, y)} stroke="#3E6FA8" strokeWidth="3.5" fill="none" strokeLinecap="round" data-testid="discover-line" />}
                {days.map((d, k) => (
                  <circle key={k} cx={x(d.bought)} cy={y(d.price)} r={k === days.length - 1 ? 5.5 : 4.5} fill={k === days.length - 1 ? 'var(--u)' : 'var(--ds-card)'} stroke="var(--u-ink)" strokeWidth="1.6"
                    opacity={k === days.length - 1 && running ? t : 1} data-testid="discover-point" />
                ))}
                {fit && <text x={x(Math.min(DAY.passers - 6, Math.max(4, fit.a - fit.b * 7))) + 4} y={y(7) - 6} style={{ fill: '#3E6FA8' }}>D</text>}
              </>
            )}
          </Frame>
          {days.length > 0 && <div className="lm-days" aria-label="Дни">{days.map((d, k) => <span key={k}>д{k + 1}: {d.price} кр. → {d.bought}</span>)}</div>}
          {shown ? (
            <div className="lm-say ds-rise" data-testid="discover-infla">
              <Mascot mood="joy" size={40} />
              <span><b>То, что вы нашли, — кривая спроса.</b> Чем дороже чашка, тем меньше её покупают. Точки чуть разбросаны: каждый день немного другой, но линия видна.</span>
            </div>
          ) : (
            <div className="ds-sub" style={{ fontSize: 14, textAlign: 'center' }} data-testid="discover-left">
              {days.length === 0 ? 'Каждый день — точка на графике.' : `Разных цен: ${distinctPrices(days)} из ${DAY.need}. Попробуйте ещё ${left} ${plural(left, 'цену', 'цены', 'цен')}.`}
            </div>
          )}
        </div>,
      )}
      {foot(<Button wide data-testid="discover-next" disabled={!done || running} onClick={() => { Audio.play('paper'); onDone(days); }}>
        {done ? 'Дальше' : `Ещё ${left} ${plural(left, 'цена', 'цены', 'цен')}`}
      </Button>)}
    </>
  );
}

/* ------------------------------ ЖИВАЯ МОДЕЛЬ ------------------------------
   Рынок капучино у «Торговой» в текущем состоянии юнита — игрушка, которую хочется крутить.
   Сверху — график: кривые и точка равновесия плавно перетекают, у точки — ярлык «цена · чашки».
   Под ним — табло (цена, чашки, выручка — с изменением к исходному рынку) и одна строка «что
   произошло». Ниже — плитки открытых факторов: касание выбирает фактор, под плитками — его
   переключатель на пять положений (потолок — «нет» или цена, новости — заголовки «Вестника»).
   Детали без управления и закрытые — строкой значков: касание говорит, что это и в каком уроке
   откроется. */
const PART_ICON = { demand: TrendingDown, income: Wallet, tea: Leaf, supply: Factory, grain: Wheat, ceiling: ArrowDownToLine, news: Newspaper, trace: Spline, board: LayoutGrid, seal: BadgeCheck, elastic: Gauge };
const CONTROL = new Set(['income', 'tea', 'grain', 'ceiling', 'news', 'trace', 'elastic']);
const isControl = (id, open) => CONTROL.has(id) || (id === 'demand' && !open.has('supply'));
const D_INK = '#3E6FA8'; const S_INK = '#C0602A';
const r1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// плавный переход чисел: кривые и точка равновесия перетекают за ~0,4 с; «уменьшить движение» — сразу
function useTween(target, ms = 420) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(target);
  const cur = useRef(target);
  const key = JSON.stringify(target);
  useEffect(() => {
    if (reduced) { cur.current = target; setVal(target); return undefined; }
    const from = cur.current; const t0 = performance.now(); let raf = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms); const e = 1 - (1 - k) ** 3;
      const v = {};
      Object.keys(target).forEach((f) => { const a = from[f]; const b = target[f]; v[f] = a == null || b == null ? b : a + (b - a) * e; });
      cur.current = v; setVal(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  return val;
}

// ярлык у точки: «20 кр. · 60 чашек» — тёмная плашка, справа от точки (у правого края — слева)
function PointTag({ x, y, text, right, testid }) {
  const w = text.length * 6.4 + 14;
  const left = x + 10 + w > right;
  const tx = left ? x - 10 - w : x + 10;
  return (
    <g data-testid={testid} className="lm-tag">
      <rect x={tx} y={y - 21} width={w} height={17} rx="8.5" />
      <text x={tx + w / 2} y={y - 9} textAnchor="middle">{text}</text>
    </g>
  );
}
function LiveChart({ r, open, trace }) {
  const { qMax, pMax } = MODEL_AXES;
  const t = useTween({ a: r.m.a, b: r.m.b, dA: r.m.dA, dC: r.m.dC, price: r.mode === 'demand' ? r.p : null, ceil: r.mode === 'ceiling' ? r.p : null });
  const m = { a: t.a, b: t.b, c: BASE.c, d: BASE.d, dA: t.dA, dC: t.dC };
  const base = { ...BASE, dA: 0, dC: 0 };
  const supply = open.has('supply');
  const eq = supply ? modelEquilibrium(m) : null;
  const moved = Math.abs(r.m.dA) + Math.abs(r.m.dC) > 0.01 || r.m.b !== BASE.b;
  return (
    <Frame qMax={qMax} pMax={pMax} qStep={20} pStep={10} label="Рынок капучино у «Торговой»" testid="model-chart">
      {({ x, y, base: yb }) => {
        const right = L + PWc;
        const guides = (q, p) => <path d={`M${L},${y(p)} H${x(q)} V${yb}`} className="lm-guide" />;
        return (
          <>
            {trace && moved && <path d={linePts((p) => mqd(base, p), qMax, pMax, x, y)} stroke={D_INK} strokeOpacity=".35" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            {trace && moved && supply && <path d={linePts((p) => mqs(base, p), qMax, pMax, x, y)} stroke={S_INK} strokeOpacity=".35" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            <path d={linePts((p) => mqd(m, p), qMax, pMax, x, y)} stroke={D_INK} strokeWidth="3.5" fill="none" strokeLinecap="round" data-curve-line="D" />
            {supply && <path d={linePts((p) => mqs(m, p), qMax, pMax, x, y)} stroke={S_INK} strokeWidth="3.5" fill="none" strokeLinecap="round" data-curve-line="S" />}
            <text x={x(Math.min(qMax - 8, Math.max(4, mqd(m, 5)))) + 5} y={y(5) - 5} className="lm-curve-name" style={{ fill: D_INK }}>D</text>
            {supply && <text x={x(Math.min(qMax - 10, Math.max(4, mqs(m, 30)))) + 4} y={y(30) + 18} className="lm-curve-name" style={{ fill: S_INK }}>S</text>}
            {r.mode === 'demand' && t.price != null && (() => {
              const q = Math.max(0, mqd(m, t.price));
              return (
                <g data-testid="model-price-line">
                  {guides(q, t.price)}
                  <circle cx={x(q)} cy={y(t.price)} r="11" className="lm-pulse" style={{ fill: D_INK }} />
                  <circle cx={x(q)} cy={y(t.price)} r="6" fill={D_INK} stroke="var(--ds-card)" strokeWidth="2" />
                  <PointTag x={x(q)} y={y(t.price)} right={right} text={`${r1(r.p)} кр. · ${Math.round(r.qd)} чаш.`} />
                </g>
              );
            })()}
            {r.mode === 'ceiling' && t.ceil != null && (() => {
              const qd = Math.max(0, mqd(m, t.ceil)); const qs = Math.max(0, mqs(m, t.ceil));
              return (
                <g data-testid="model-ceiling">
                  <line x1={L} x2={right} y1={y(t.ceil)} y2={y(t.ceil)} stroke="var(--ds-bad)" strokeWidth="2" strokeDasharray="6 4" />
                  <line x1={x(qs)} x2={x(qd)} y1={y(t.ceil)} y2={y(t.ceil)} stroke="var(--ds-bad)" strokeWidth="7" opacity=".55" strokeLinecap="round" />
                  <text x={(x(qs) + x(qd)) / 2} y={y(t.ceil) + 19} textAnchor="middle" className="lm-short">дефицит {Math.round(r.shortage)}</text>
                  <text x={right - 2} y={y(t.ceil) - 6} textAnchor="end" className="lm-short">потолок {r.p} кр.</text>
                </g>
              );
            })()}
            {eq && trace && moved && r.mode === 'equilibrium' && Math.hypot(x(eq.q) - x(BASE_EQ.q), y(eq.p) - y(BASE_EQ.p)) > 14 && (
              <g className="lm-shift" data-testid="model-shift">
                <circle cx={x(BASE_EQ.q)} cy={y(BASE_EQ.p)} r="4.5" fill="var(--ds-card)" stroke="var(--ds-ink3)" strokeWidth="1.6" />
                <line x1={x(BASE_EQ.q)} y1={y(BASE_EQ.p)} x2={x(eq.q)} y2={y(eq.p)} stroke="var(--ds-ink3)" strokeWidth="1.6" strokeDasharray="3 3" />
              </g>
            )}
            {eq && (
              <g data-testid="model-eq" opacity={r.mode === 'ceiling' ? 0.35 : 1}>
                {r.mode === 'equilibrium' && guides(eq.q, eq.p)}
                {r.mode === 'equilibrium' && <circle cx={x(eq.q)} cy={y(eq.p)} r="12" className="lm-pulse" style={{ fill: 'var(--ds-ink)' }} />}
                <circle cx={x(eq.q)} cy={y(eq.p)} r="6.5" fill="var(--ds-ink)" stroke="var(--ds-card)" strokeWidth="2" />
                {r.mode === 'equilibrium' && <PointTag x={x(eq.q)} y={y(eq.p)} right={right} text={`${r1(r.eq.p)} кр. · ${Math.round(r.eq.q)} чаш.`} testid="model-eq-tag" />}
              </g>
            )}
          </>
        );
      }}
    </Frame>
  );
}

// табло: числа крупно, рядом — изменение к исходному рынку (20 кр., 60 чашек, выручка 1200)
function Delta({ d, digits = 1 }) {
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return null;
  const v = digits ? r1(Math.abs(d)) : Math.round(Math.abs(d));
  return <span className={`lm-delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'}{v}</span>;
}
function Board({ r, open }) {
  const p = r.mode === 'demand' ? r.p : r.mode === 'ceiling' ? r.p : r.eq.p;
  const q = r.mode === 'demand' ? r.qd : r.sold;
  const cells = [
    { k: 'p', label: 'цена, кр.', v: r1(p), d: <Delta d={p - BASE_EQ.p} /> },
    { k: 'q', label: r.mode === 'ceiling' ? 'продают чашек' : 'чашек в день', v: Math.round(q), d: <Delta d={q - BASE_EQ.q} digits={0} /> },
  ];
  if (r.mode === 'ceiling') cells.push({ k: 's', label: 'не хватило', v: Math.round(r.shortage), bad: true });
  if (open.has('board')) cells.push({ k: 'rev', label: 'выручка, кр.', v: Math.round(p * q), d: <Delta d={p * q - BASE_EQ.p * BASE_EQ.q} digits={0} /> });
  return (
    <div className="lm-board" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }} data-testid={open.has('board') ? 'model-board' : 'model-stats'}>
      {cells.map((c) => (
        <div key={c.k} className={c.bad ? 'bad' : ''}>
          <span className="lm-board-label">{c.label}</span>
          <b className="ds-num">{c.v}</b>{c.d}
        </div>
      ))}
    </div>
  );
}

// переключатель на несколько положений: radiogroup, выбранное — залито
function Steps({ id, label, options, value, onPick }) {
  return (
    <div className="lm-steps" role="radiogroup" aria-label={label} data-testid={`model-${id}`}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} aria-label={o.title} title={o.title} data-v={o.v == null ? 'none' : o.v}
            onClick={() => { if (o.v !== value) { Audio.play('tick'); onPick(o.v); } }}>
            {Icon ? <Icon size={18} aria-hidden="true" /> : o.label}
          </button>
        );
      })}
    </div>
  );
}
const STEP_ICON = [ChevronsDown, ChevronDown, Minus, ChevronUp, ChevronsUp];
const factorOptions = (id) => FACTOR_STEPS.map((v, k) => ({ v, icon: STEP_ICON[k], title: FACTOR_WORDS[id][k] }));
const ceilingOptions = CEILING_STEPS.map((v) => ({ v, label: v == null ? 'нет' : `${v}`, title: v == null ? 'без потолка' : `потолок ${v} кр.` }));
const elasticOptions = ELASTIC_STEPS.map((e, k) => ({ v: e.v, label: ['1', '2', '3', '4', '5'][k], title: e.word }));

// подпись состояния на плитке
function stateWord(id, st, news) {
  switch (id) {
    case 'demand': return `цена ${st.price} кр.`;
    case 'income': case 'tea': case 'grain': return FACTOR_WORDS[id][st[id] + 2];
    case 'ceiling': return st.ceiling == null ? 'нет' : `${st.ceiling} кр.`;
    case 'news': { const n = MODEL_NEWS.find((x) => x.id === news); return n ? n.title : 'новостей нет'; }
    case 'trace': return st.trace !== false ? 'виден' : 'скрыт';
    case 'elastic': return (ELASTIC_STEPS.find((e) => e.v === st.elastic) || ELASTIC_STEPS[2]).word;
    default: return '';
  }
}
const changedPart = (id, st, news) => (id === 'demand' ? st.price !== MODEL_DEFAULT.price : id === 'news' ? !!news : id === 'trace' ? false
  : id === 'ceiling' ? st.ceiling != null : st[id] !== MODEL_DEFAULT[id]);

// кольцо прогресса деталей: «6/10»
function PartsRing({ open, total }) {
  const R = 21; const C = 2 * Math.PI * R;
  return (
    <span className="lm-ring" data-testid="model-progress" role="img" aria-label={`Собрано деталей: ${open} из ${total}`}>
      <svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r={R} className="bg" />
        <circle cx="25" cy="25" r={R} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - (total ? open / total : 0))} />
      </svg>
      <b aria-hidden="true">{open}<small>/{total}</small></b>
    </span>
  );
}

export function MarketModel({ unitId, learn, testid = 'unit-model' }) {
  const parts = useMemo(() => modelParts(unitId, learn), [unitId, learn]);
  const prog = modelProgress(unitId, learn);
  const open = useMemo(() => new Set(parts.filter((p) => p.open).map((p) => p.id)), [parts]);
  const [st, setSt] = useState(MODEL_DEFAULT);
  const [news, setNews] = useState(null);
  const tiles = parts.filter((p) => p.open && isControl(p.id, open));
  const chips = parts.filter((p) => !p.open || !isControl(p.id, open));
  const [sel, setSel] = useState(null);
  const [chip, setChip] = useState(null);
  const cur = tiles.find((p) => p.id === sel) || tiles[0] || null;
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));
  const r = modelReadout(st, open);
  const story = modelStory(st, open);
  const assembled = open.has('seal');
  const touched = tiles.some((p) => changedPart(p.id, st, news));
  const control = (p) => {
    switch (p.id) {
      case 'demand': return (
        <div className="lm-price">
          <input type="range" className="lm-range" min={10} max={35} step={1} value={st.price} aria-label="Цена чашки" data-testid="model-price"
            onChange={(e) => { Audio.play('tick'); set({ price: Number(e.target.value) }); }} />
          <div className="lm-scale"><span>10 кр.</span><b className="ds-num">{st.price} кр.</b><span>35 кр.</span></div>
        </div>
      );
      case 'income': case 'tea': case 'grain': return <Steps id={p.id} label={p.title} options={factorOptions(p.id)} value={st[p.id]} onPick={(v) => set({ [p.id]: v })} />;
      case 'ceiling': return <Steps id="ceiling" label="Потолок цены" options={ceilingOptions} value={st.ceiling} onPick={(v) => set({ ceiling: v })} />;
      case 'elastic': return <Steps id="elastic" label="Чувствительность покупателей к цене" options={elasticOptions} value={st.elastic} onPick={(v) => set({ elastic: v })} />;
      case 'news': return (
        <div className="lm-news-list">
          {MODEL_NEWS.map((n) => (
            <button key={n.id} type="button" className="lm-news-btn" aria-pressed={news === n.id} data-testid={`model-news-${n.id}`}
              onClick={() => { Audio.play('paper'); setNews(n.id); setSt({ ...MODEL_DEFAULT, trace: st.trace, elastic: st.elastic, ...n.set }); }}>
              <Newspaper size={15} aria-hidden="true" /><span>{n.title}</span>
            </button>
          ))}
        </div>
      );
      case 'trace': return (
        <button type="button" role="switch" aria-checked={st.trace !== false} className="lm-switch" data-testid="model-trace" onClick={() => { Audio.play('tick'); set({ trace: st.trace === false }); }}>
          <span className="knob" aria-hidden="true" />Пунктиром — рынок без сдвигов
        </button>
      );
      default: return null;
    }
  };
  const caption = (p) => (p.id === 'demand' ? null : p.id === 'trace' || p.id === 'news' ? null : <div className="lm-caption">Сейчас: <b>{stateWord(p.id, st, news)}</b></div>);
  return (
    <div className="lm" data-testid={testid} data-open={prog.open} data-total={prog.total} data-assembled={String(assembled)}>
      <div className="lm-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-eyebrow">Живая модель юнита</div>
          <div className="lm-title">Рынок капучино у «Торговой»</div>
          {assembled && <span className="lm-badge" data-testid="model-seal"><BadgeCheck size={14} aria-hidden="true" />Модель собрана</span>}
        </div>
        <PartsRing open={prog.open} total={prog.total} />
      </div>
      {prog.open === 0 ? (
        <div className="lm-empty">
          <svg viewBox="0 0 200 120" className="lm-ghost" aria-hidden="true">
            <path d="M24,10 V104 H190" fill="none" stroke="var(--ds-rule2)" strokeWidth="2" />
            <path d="M34,18 L176,98" fill="none" stroke={D_INK} strokeOpacity=".28" strokeWidth="4" strokeDasharray="7 7" strokeLinecap="round" />
            <path d="M34,92 L176,24" fill="none" stroke={S_INK} strokeOpacity=".28" strokeWidth="4" strokeDasharray="7 7" strokeLinecap="round" />
            <circle cx="105" cy="58" r="7" fill="var(--ds-ink3)" opacity=".35" />
          </svg>
          <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.45 }} data-testid="model-empty">Модель соберётся по ходу юнита: каждый урок добавит деталь. Первая — в уроке «{parts[0].where}».</div>
        </div>
      ) : (
        <>
          <div className="lm-stage"><LiveChart r={r} open={open} trace={open.has('trace') && st.trace !== false} /></div>
          <Board r={r} open={open} />
          <div className={`lm-story ${story.changed ? 'on' : ''}`} data-testid="model-readout" aria-live="polite">{story.text}</div>
          {tiles.length > 0 && (
            <div className="lm-tiles" data-testid="model-parts">
              {tiles.map((p) => {
                const Icon = PART_ICON[p.id] || Coffee;
                const on = cur && cur.id === p.id;
                return (
                  <button key={p.id} type="button" className={`lm-tile ${on ? 'on' : ''} ${changedPart(p.id, st, news) ? 'changed' : ''}`} aria-pressed={on}
                    data-testid="model-part" data-part={p.id} data-open="true" onClick={() => { Audio.play('paper'); setSel(p.id); }}>
                    <span className="lm-tile-ic"><Icon size={17} aria-hidden="true" /></span>
                    <span className="lm-tile-txt"><b>{p.id === 'demand' ? 'Цена чашки' : p.title}</b><span>{stateWord(p.id, st, news)}</span></span>
                  </button>
                );
              })}
            </div>
          )}
          {cur && (
            <div className="lm-panel" key={cur.id} data-testid="model-panel" data-panel={cur.id}>
              <div className="lm-panel-text">{cur.id === 'demand' ? 'Поставьте цену — модель покажет, сколько чашек купят по такой цене.' : cur.text}</div>
              {control(cur)}
              {caption(cur)}
            </div>
          )}
        </>
      )}
      {chips.length > 0 && (
        <div className="lm-chips-wrap">
          <div className="lm-chips-head">Детали модели</div>
          <div className="lm-chips">
            {chips.map((p) => {
              const Icon = p.open ? Check : Lock;
              return (
                <button key={p.id} type="button" className={`lm-chip ${p.open ? 'got' : ''} ${chip === p.id ? 'on' : ''}`} aria-expanded={chip === p.id}
                  data-testid="model-part" data-part={p.id} data-open={String(p.open)} onClick={() => { Audio.play('tick'); setChip(chip === p.id ? null : p.id); }}>
                  <Icon size={13} aria-hidden="true" />{p.title}
                </button>
              );
            })}
          </div>
          {chip && (() => {
            const p = parts.find((x) => x.id === chip);
            return (
              <div className="lm-chip-note" data-testid="model-part-note" data-note={p.id}>
                {p.open ? p.text : <>Откроется в уроке «{p.where}»{p.outside ? ` — юнит «${p.outside}»` : ''}.</>}
              </div>
            );
          })()}
        </div>
      )}
      {touched && (
        <Button variant="ghost" small icon={RotateCcw} style={{ marginTop: 8 }} data-testid="model-reset" onClick={() => { Audio.play('paper'); setNews(null); setSt(MODEL_DEFAULT); }}>
          Вернуть как было
        </Button>
      )}
    </div>
  );
}

/* Миниатюра модели для свёрнутой строки на Пути: кривые и точка — без чисел */
export function ModelThumb({ supply = true, empty = false }) {
  return (
    <svg className="lm-thumb" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
      <path d="M6,4 V38 H60" fill="none" stroke="var(--ds-rule2)" strokeWidth="1.5" />
      <path d="M10,8 L56,36" fill="none" stroke={D_INK} strokeWidth="3" strokeLinecap="round" strokeOpacity={empty ? 0.3 : 1} strokeDasharray={empty ? '4 4' : undefined} />
      {supply && <path d="M10,34 L56,10" fill="none" stroke={S_INK} strokeWidth="3" strokeLinecap="round" strokeOpacity={empty ? 0.3 : 1} strokeDasharray={empty ? '4 4' : undefined} />}
      {!empty && supply && <circle cx="33" cy="22" r="3.6" fill="var(--ds-ink)" stroke="var(--ds-card)" strokeWidth="1.2" />}
    </svg>
  );
}

/* ------------------------------ ДОМИНО ------------------------------
   Сверху новость «Вестника», ниже — сцена (график и улица), пустые звенья и колода. Ученик
   выкладывает цепочку: верное звено встаёт на место и оживляет сцену (кривая сдвигается,
   стрелка цены или количества, люди на улице); неверное — домино падает с этого места, под
   цепочкой разбор, почему звено не следует из предыдущего, и ученик продолжает с верного места.
   Когда цепочка собрана, задание проверяется само (onSubmit). */
export const DOMINO_CSS = `
  /* сцена «Домино» прилипает к верху: выкладывая звенья внизу, ученик видит, что они делают */
  .lm-scene { position: sticky; top: 0; z-index: 1; background: var(--ds-paper); padding-bottom: 2px; }
  .lm-scene .lm-chart { max-width: 290px; margin-bottom: 0; }
  .lm-scene .lm-street { max-width: 260px; margin: 0 auto 4px; }
  .lm-news { border: 1px solid var(--ds-rule2); background: var(--ds-card); padding: 8px 12px 10px; text-align: center; margin-bottom: 8px; }
  .lm-news-mast { font: 700 12px var(--ds-news); letter-spacing: .22em; text-transform: uppercase; border-bottom: 3px double var(--ds-ink2); padding-bottom: 4px; margin-bottom: 6px; color: var(--ds-ink2); }
  .lm-news-head { font: 700 19px/1.25 var(--ds-news); }
  .lm-chain { display: grid; gap: 6px; margin: 8px 0; counter-reset: dom; }
  .lm-slot { position: relative; display: flex; align-items: stretch; min-height: 44px; border: 1.5px dashed var(--ds-rule2); border-radius: 5px; background: none; overflow: visible; }
  .lm-slot .n { width: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font: 700 14px var(--ds-mono); color: var(--ds-ink3); border-right: 1.5px dashed var(--ds-rule2); }
  .lm-slot .t { flex: 1; padding: 8px 10px; font-size: 15px; line-height: 1.35; color: var(--ds-ink3); display: flex; align-items: center; }
  .lm-slot.on { border: 1.5px solid var(--ds-ink2); background: var(--ds-card); box-shadow: 0 2px 0 var(--ds-shade); }
  .lm-slot.on .n { color: var(--u-ink); border-right: 1.5px solid var(--ds-ink2); }
  .lm-slot.on .t { color: var(--ds-ink); }
  .lm-slot.on.fresh { animation: lm-set .32s ease-out; }
  @keyframes lm-set { from { transform: translateY(-8px) rotate(-2deg); opacity: .4 } to { transform: none; opacity: 1 } }
  .lm-fall { position: absolute; inset: -1.5px; display: flex; align-items: center; border: 1.5px solid var(--ds-bad); border-radius: 5px; background: var(--ds-card); padding: 8px 10px 8px 44px; font-size: 15px;
    transform-origin: 0% 100%; animation: lm-fall .7s ease-in forwards; pointer-events: none; z-index: 2; }
  @keyframes lm-fall { 0% { transform: none; opacity: 1 } 45% { transform: rotate(-14deg) translateY(4px); opacity: 1 } 100% { transform: rotate(-70deg) translateY(30px); opacity: 0 } }
  .lm-deck { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 6px; }
  .lm-card { font: 14.5px/1.3 var(--ds-sans); text-align: left; padding: 9px 11px; border-radius: 4px; border: 1px solid var(--ds-rule2); border-bottom-width: 2px; background: var(--ds-card); color: var(--ds-ink); cursor: pointer; max-width: 100%; }
  .lm-card:disabled { cursor: default; }
  .lm-card.gone { text-decoration: line-through; color: var(--ds-ink3); background: none; border-style: dashed; }
  .lm-done { border-left: 3px solid var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ok-ink); font-weight: 700; padding: 8px 10px; font-size: 15px; margin: 6px 0; }
  .lm-why { border-left: 3px solid var(--ds-sel-rule); background: color-mix(in srgb, var(--ds-sel-rule) 12%, var(--ds-card)); padding: 8px 10px; font-size: 14.5px; line-height: 1.4; margin: 6px 0; }
  @media (prefers-reduced-motion: reduce) { .lm-slot.on.fresh, .lm-fall { animation: none !important; } .lm-fall { display: none; } }
`;
// сцена «Домино»: что сделали звенья, выложенные до сих пор
function dominoScene(inst, placed) {
  const effects = placed.flatMap((k) => (inst.deck.find((c) => c.key === k) || {}).effects || []);
  const has = (e) => effects.includes(e);
  const dA = (has('D+') ? 24 : 0) - (has('D-') ? 24 : 0);
  const dC = (has('S+') ? 24 : 0) - (has('S-') ? 24 : 0);
  return { dA, dC, P: has('P'), Q: has('Q'), ceil: has('ceil'), street: has('street') };
}
function DominoScene({ inst, sc }) {
  const { qMax, pMax } = MODEL_AXES;
  const m0 = { ...BASE, dA: 0, dC: 0 }; const m = { ...BASE, dA: sc.dA, dC: sc.dC };
  const demandOnly = inst.scene === 'demand';
  const eq = (mm) => { const p = (mm.a + mm.dA - mm.c - mm.dC) / (mm.b + mm.d); return { p, q: mm.a + mm.dA - mm.b * p }; };
  const e0 = eq(m0); const e1 = eq(m);
  const price = demandOnly ? 20 : sc.ceil ? 15 : e1.p;
  const qd = Math.max(0, mqd(m, price)); const qs = Math.max(0, mqs(m, price));
  const sold = demandOnly ? qd : sc.ceil ? Math.min(qd, qs) : e1.q;
  const short = sc.ceil ? Math.max(0, qd - qs) : 0;
  return (
    <div className="lm-scene" data-testid="domino-scene" data-da={sc.dA} data-dc={sc.dC}>
      <Frame qMax={qMax} pMax={pMax} qStep={20} pStep={10} label="Сцена: рынок капучино" testid="domino-chart" ch={160}>
        {({ x, y, base }) => (
          <>
            {sc.dA !== 0 && <path d={linePts((p) => mqd(m0, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            {sc.dC !== 0 && !demandOnly && <path d={linePts((p) => mqs(m0, p), qMax, pMax, x, y)} stroke="#C0602A" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            <path d={linePts((p) => mqd(m, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {!demandOnly && <path d={linePts((p) => mqs(m, p), qMax, pMax, x, y)} stroke="#C0602A" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
            {sc.dA !== 0 && <text x={x(mqd(m, 30)) + (sc.dA > 0 ? 4 : -16)} y={y(30) - 4} style={{ fill: '#3E6FA8', fontSize: 15 }} data-testid="domino-arrow-d">{sc.dA > 0 ? '→' : '←'}</text>}
            {sc.dC !== 0 && !demandOnly && <text x={x(mqs(m, 30)) + (sc.dC > 0 ? 4 : -16)} y={y(30) + 14} style={{ fill: '#C0602A', fontSize: 15 }} data-testid="domino-arrow-s">{sc.dC > 0 ? '→' : '←'}</text>}
            {(demandOnly || sc.ceil) && <line x1={L} x2={L + PWc} y1={y(price)} y2={y(price)} stroke={sc.ceil ? 'var(--ds-bad)' : 'var(--u)'} strokeWidth="1.8" strokeDasharray="4 4" />}
            {sc.ceil && <line x1={x(qs)} x2={x(qd)} y1={y(price)} y2={y(price)} stroke="var(--ds-bad)" strokeWidth="6" opacity=".55" strokeLinecap="round" />}
            {demandOnly ? <circle cx={x(qd)} cy={y(price)} r="5.5" fill="#3E6FA8" /> : <circle cx={x(e1.q)} cy={y(e1.p)} r="5.5" fill="var(--ds-ink)" opacity={sc.ceil ? 0.35 : 1} />}
            {sc.P && Math.abs(e1.p - e0.p) > 0.5 && <path d={`M${L + 7},${y(e0.p)} L${L + 7},${y(e1.p) + (e1.p > e0.p ? 6 : -6)}`} stroke="var(--u-ink)" strokeWidth="2.5" markerEnd="url(#lm-arr)" data-testid="domino-arrow-p" />}
            {sc.Q && (() => {
              // количество: на рынке — от старого равновесия к новому, на сцене спроса — при той же цене
              const q0 = demandOnly ? mqd(m0, price) : e0.q; const q1 = demandOnly ? mqd(m, price) : e1.q;
              return Math.abs(q1 - q0) > 0.5 ? <path d={`M${x(q0)},${base - 7} L${x(q1) + (q1 > q0 ? -6 : 6)},${base - 7}`} stroke="var(--u-ink)" strokeWidth="2.5" markerEnd="url(#lm-arr)" data-testid="domino-arrow-q" /> : null;
            })()}
            <text x={x(Math.min(qMax - 8, Math.max(4, mqd(m, 6)))) + 4} y={y(6) - 5} style={{ fill: '#3E6FA8' }}>D</text>
            {!demandOnly && <text x={x(Math.min(qMax - 10, Math.max(4, mqs(m, 34)))) + 6} y={y(34) + 4} style={{ fill: '#C0602A' }}>S</text>}
            <defs><marker id="lm-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="var(--u-ink)" /></marker></defs>
          </>
        )}
      </Frame>
      <Street queue={Math.round(sold / 8) + Math.round(short / 8)} short={sc.street || sc.ceil ? Math.round(short / 8) : 0} cafes={demandOnly ? 1 : 3} price={Math.round(price)}
        label={`Улица: ${Math.round(sold)} чашек в день по ${Math.round(price)} кр.`} />
    </div>
  );
}
export function DominoEx({ inst, resp, setResp, locked, fb, onSubmit, prompt }) {
  const r = resp || { placed: [], falls: [], done: false };
  const [fall, setFall] = useState(null);
  const [fresh, setFresh] = useState(-1);
  const byKey = Object.fromEntries(inst.deck.map((c) => [c.key, c]));
  const at = r.placed.length;
  const placedSet = new Set(r.placed);
  const goneSet = new Set(r.falls.map((f) => f.key).filter((k) => byKey[k].link == null));
  const shown = locked && fb ? inst.chain : r.placed;
  const sc = dominoScene(inst, shown);
  const tap = (card) => {
    if (locked || r.done) return;
    const want = inst.chain[at];
    if (card.key === want) {
      const placed = [...r.placed, card.key];
      const nr = { ...r, placed, done: placed.length === inst.chain.length };
      Audio.play('tick'); setFall(null); setFresh(at); setResp(nr);
      if (nr.done) onSubmit(nr);
      return;
    }
    const prev = at === 0 ? `новости «${inst.headline}»` : `«${byKey[r.placed[at - 1]].raw}»`;
    const why = card.link == null ? card.why : [{ t: 'text', v: card.link > at
      ? `Это звено в цепочке есть, но позже: из ${prev} оно прямо не следует — сначала нужен шаг между ними.`
      : `Это звено уже было бы раньше: после ${prev} нужен следующий шаг.` }];
    const nr = { ...r, falls: [...r.falls, { key: card.key, at }] };
    Audio.play('down');
    setFall({ key: card.key, at, why, n: nr.falls.length });
    setResp(nr);
  };
  return (
    <div data-testid="domino" data-placed={r.placed.length} data-falls={r.falls.length}>
      <div className="lm-news"><div className="lm-news-mast">Вестник Инфляции</div><div className="lm-news-head" data-testid="domino-headline">{inst.headline}</div></div>
      {prompt}
      <DominoScene inst={inst} sc={sc} />
      <div className="lm-chain" aria-label="Цепочка">
        {inst.chain.map((k, i) => {
          const on = i < shown.length;
          const card = on ? byKey[shown[i]] : null;
          return (
            <div key={k} className={`lm-slot ${on ? 'on' : ''} ${on && i === fresh ? 'fresh' : ''}`} data-testid="domino-slot" data-on={String(on)}>
              <span className="n">{i + 1}</span>
              <span className="t">{card ? <Inline nodes={card.text} /> : i === at && !locked ? 'Что из этого следует?' : '…'}</span>
              {fall && fall.at === i && !on && <span className="lm-fall" key={fall.n} aria-hidden="true"><Inline nodes={byKey[fall.key].text} /></span>}
            </div>
          );
        })}
      </div>
      {r.placed.length === inst.chain.length && (
        <div className="lm-done" data-testid="domino-done" data-falls={r.falls.length} aria-live="polite">Собрано, было падений: {r.falls.length}</div>
      )}
      {fall && !locked && (
        <div className="lm-why" data-testid="domino-why" aria-live="polite">
          <b>Домино упало на звене {fall.at + 1}.</b> «{byKey[fall.key].raw}» — не следующее звено. <Inline nodes={fall.why} /> Продолжайте с этого места.
        </div>
      )}
      {!locked && (
        <div className="lm-deck" aria-label="Колода">
          {inst.deck.filter((c) => !placedSet.has(c.key)).map((c) => (
            <button key={c.key} type="button" className={`lm-card ${goneSet.has(c.key) ? 'gone' : ''}`} data-testid="domino-card" data-key={c.key}
              disabled={goneSet.has(c.key)} onClick={() => tap(c)}><Inline nodes={c.text} /></button>
          ))}
        </div>
      )}
    </div>
  );
}
