/* ВЗАИМОДЕЙСТВИЯ УРОКОВ ЭТАПА 2: рынок на графике (сдвинуть кривую пальцем, двигать цену,
   пока не исчезнет дефицит, поставить точку равновесия), определение из плиток, мини-игра
   на минуту с живым графиком, таймер, карточки видов уроков
   (слово с оборотом, герой «Истории», «Слушай» с голосом браузера и подсветкой текста).
   Всё своё: SVG и Web Speech API, без библиотек и внешних запросов. При «уменьшить движение»
   карточки не летают, подсветка текста не бежит. */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Coffee, Croissant, Landmark, ScrollText, RotateCcw, Play, Timer, Delete, Trophy, GraduationCap, Radio, Feather, Check,
  Banknote, ShoppingBasket, Thermometer, X,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { equilibrium, marketAxes, qd, qs, gameScore, comboOf, gameLeft, timeBonus, GAME_PASS, GAME_TIME_BONUS } from './learn/course.js';
import { WALLET, WALLET_OPTIONS, FORECAST, walletPath, walletResult, realPct } from './learn/wallet.js';
import { plural } from './lib/plural.js';
import { CAST } from './learn/cast.js';
import { useReducedMotion } from './ds-art.jsx';
import { Button } from './ds.jsx';
import { evalExpr, fmtResult, pressRoot } from './learn/calc.js';

export const PLAY_CSS = `
  .lp-chart { width: 100%; max-width: 380px; display: block; margin: 6px auto 10px; touch-action: none; user-select: none; -webkit-user-select: none; }
  .lp-chart text { font: 700 12px var(--ds-mono); fill: var(--ds-ink2); }
  .lp-hit { cursor: grab; }
  .lp-hit:active { cursor: grabbing; }
  .lp-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
  .lp-readout { text-align: center; font-size: 15px; margin: 4px 0 10px; min-height: 22px; }
  .lp-readout b { font-family: var(--ds-mono); }
  /* спрос и предложение в подписи — оттенки линий графика, но с контрастом не ниже 4,5:1 в обеих темах */
  .lp-dem { color: #345E92; } .lp-sup { color: #9A4A1C; }
  .ds-dark .lp-dem { color: #8FB3E0; } .ds-dark .lp-sup { color: #E39A6B; }
  .lp-range { width: 100%; accent-color: var(--u); height: 32px; }
  .lp-tiles { min-height: 64px; border: 1px dashed var(--ds-rule2); border-radius: 4px; padding: 8px; margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; background: var(--ds-card2); }
  .lp-tile { font: 15px/1.2 var(--ds-head); padding: 9px 12px; border-radius: 2px; border: 1px solid var(--ds-rule2); border-bottom-width: 2px; background: var(--ds-card); color: var(--ds-ink); cursor: pointer; }
  .lp-tile:active:not(:disabled) { transform: translateY(1px); }
  .lp-timer { height: 8px; border-radius: 1px; background: var(--ds-card2); border: 1px solid var(--ds-rule2); overflow: hidden; margin: 4px 0 12px; }
  .lp-timer > span { display: block; height: 100%; background: var(--u); transition: width .1s linear; }
  .lp-timer.low > span { background: var(--ds-bad); }
  .lp-card { position: relative; min-height: 150px; border-radius: 6px; border: 1px solid var(--ds-rule2); background: var(--ds-card);
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule), 0 2px 4px var(--ds-shade);
    display: flex; align-items: center; justify-content: center; text-align: center; padding: 22px 18px; font: 700 20px/1.3 var(--ds-head); margin: 10px 0 14px; touch-action: pan-y; user-select: none; }
  .lp-card.ok { border-color: var(--ds-ok); box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-ok); }
  .lp-card.bad { border-color: var(--ds-bad); box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-bad); }
  .lp-score { display: flex; justify-content: space-between; font: 700 13px var(--ds-mono); color: var(--ds-ink2); }
  /* «Слова» — колода: сверху карточка слова, под ней край ещё не открытых. Значение сначала
     закрыто: вспомнить — открыть — честно отметить «Знаю» или «Ещё раз». */
  .lp-deck { position: relative; margin: 6px 0 14px; padding-bottom: 14px; }
  .lp-deck-ghost { position: absolute; left: 12px; right: 12px; height: 40px; bottom: 6px; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card2); }
  .lp-deck-ghost.g2 { left: 24px; right: 24px; bottom: 0; opacity: .7; }
  .lp-word { position: relative; z-index: 1; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); box-shadow: 0 3px 10px var(--ds-shade);
    padding: 18px 18px 20px; min-height: 250px; display: flex; flex-direction: column; touch-action: pan-y; user-select: none;
    transition: transform .26s ease-in, opacity .26s ease-in; border-top: 5px solid var(--u); }
  /* появление — только «до» (backwards): после него карточкой двигает палец или мышь, а не анимация */
  .lp-word.in { animation: lp-word-in .3s ease-out backwards; }
  @keyframes lp-word-in { from { transform: translateX(var(--from, 0)) translateY(var(--rise, 14px)) scale(.97); opacity: 0 } to { transform: none; opacity: 1 } }
  .lp-word.drag { cursor: grabbing; box-shadow: 0 10px 24px var(--ds-shade); }
  .lp-swipe-tag { position: absolute; top: 46px; padding: 3px 10px; border: 2px solid var(--u); border-radius: 4px; font: 700 14px var(--ds-sans); letter-spacing: .06em; text-transform: uppercase; color: var(--u-ink); background: var(--ds-card); pointer-events: none; }
  .lp-swipe-tag.next { right: 14px; transform: rotate(8deg); }
  .lp-swipe-tag.prev { left: 14px; transform: rotate(-8deg); }
  .lp-word-top { display: flex; align-items: center; gap: 8px; font: 700 12px var(--ds-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ds-ink3); }
  .lp-word-term { font: 700 30px/1.15 var(--ds-head); color: var(--u-ink); margin: 18px 0 6px; text-align: center; }
  .lp-word-rule { width: 56px; height: 2px; background: var(--u); opacity: .5; margin: 0 auto 16px; border-radius: 1px; }
  .lp-word-def { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 18.5px; line-height: 1.45; }
  .lp-word-def.open { animation: lp-def .35s ease-out both; }
  .lp-word-ex { display: block; margin-top: 12px; font-size: 15px; line-height: 1.4; color: var(--ds-ink2); }
  @keyframes lp-def { from { opacity: 0; transform: translateY(6px); filter: blur(3px) } to { opacity: 1; transform: none; filter: none } }
  .lp-word-tip { margin-top: 14px; font-size: 13.5px; line-height: 1.4; color: var(--ds-ink3); text-align: center; }
  .lp-word-hint .fine { display: none; }
  @media (hover: hover) and (pointer: fine) { .lp-word-hint .fine { display: inline; } .lp-word-hint .touch { display: none; } .lp-word { cursor: grab; } }
  .lp-word-dots { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .lp-word-dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--ds-rule); }
  .lp-word-dots i.know { background: var(--u); }
  .lp-word-dots i.cur { box-shadow: 0 0 0 2px var(--ds-paper), 0 0 0 3.5px var(--u); }
  .lp-calc { max-width: 340px; margin: 0 auto; }
  .lp-calc-screen { display: flex; align-items: baseline; gap: 8px; border: 1px solid var(--ds-rule2); border-radius: 3px; background: var(--ds-card2); padding: 6px 10px; margin-bottom: 6px; min-height: 42px; }
  .lp-calc-expr { flex: 1; min-width: 0; font-size: 16px; color: var(--ds-ink2); overflow-wrap: anywhere; }
  .lp-calc-val { font-size: 21px; font-weight: 700; white-space: nowrap; }
  .lp-calc-keys { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .lp-calc-keys .ds-key { padding: 9px 0; font-size: 18px; }
  .lp-calc-use { grid-column: span 3; min-height: 0; padding: 8px 6px; }
  .lp-op { color: var(--u-ink); font-weight: 700; }
  .lp-game-rules { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-size: 13.5px; margin-top: 4px; }
  .lp-game-rules span { display: inline-flex; align-items: center; gap: 4px; }
  /* «Как играть» перед стартом: три шага и пробный заголовок без таймера */
  .lp-howto { border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); padding: 12px 14px; margin: 10px 0; }
  .lp-howto ol { margin: 6px 0 0; padding-left: 20px; font-size: 14.5px; line-height: 1.45; }
  .lp-howto li { margin: 3px 0; }
  .lp-trial { border: 1.5px dashed var(--ds-rule2); border-radius: 6px; padding: 10px 12px; margin: 10px 0; }
  .lp-trial-card { font: 700 17px/1.35 var(--ds-head); text-align: center; margin: 6px 0 10px; }
  .lp-game-hud { display: flex; align-items: center; gap: 8px; margin: -4px 0 2px; }
  .lp-game-score { font-size: 26px; font-weight: 700; color: var(--u-ink); min-width: 48px; }
  .lp-combo { font: 700 14px var(--ds-mono); color: #fff; background: var(--u); border-radius: 999px; padding: 2px 9px; animation: lp-combo .35s ease-out; }
  @keyframes lp-combo { 0% { transform: scale(.4); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
  .lp-game-stage { position: relative; }
  .lp-game .lp-chart { margin: 0 auto 2px; max-width: 340px; }
  /* что сдвинулось — строкой под графиком, а не поверх него: не закрывает цены и подписи */
  .lp-effect-row { min-height: 26px; display: flex; justify-content: center; align-items: center; }
  .lp-effect { font: 700 13px var(--ds-sans); background: var(--ds-card); border: 1.5px solid var(--u); color: var(--u-ink); border-radius: 3px; padding: 3px 8px;
    animation: lp-effect 1.6s ease-out forwards; pointer-events: none; }
  @keyframes lp-effect { 0% { opacity: 0; transform: translateY(6px); } 12% { opacity: 1; transform: none; } 75% { opacity: 1; } 100% { opacity: 0; } }
  .lp-game-card { min-height: 104px; margin: 8px 0 10px; font-size: 19px; }
  .lp-game-final { flex-direction: column; gap: 2px; min-height: 0; margin-top: 8px; }
  .lp-pass { display: inline-flex; align-items: center; gap: 3px; font: 700 13px var(--ds-sans); padding: 2px 8px; border-radius: 10px; border: 1px dashed var(--ds-rule2); color: var(--ds-ink2); }
  .lp-pass.ok { border-style: solid; border-color: var(--ds-ok); color: var(--ds-ok); background: color-mix(in srgb, var(--ds-ok) 10%, transparent); }
  /* «Сбереги кошелёк» */
  .lw-years { display: flex; gap: 6px; justify-content: center; margin: 0 0 8px; }
  .lw-years i { width: 30px; height: 7px; border-radius: 99px; background: var(--ds-rule); transition: background .3s; }
  .lw-years i.now { background: var(--u); }
  .lw-years i.ok { background: var(--ds-ok); }
  .lw-years i.bad { background: var(--ds-bad); }
  .lw-purse { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .lw-purse > div { border: 1px solid var(--ds-rule2); border-radius: 10px; background: var(--ds-card); padding: 6px 4px 5px; text-align: center; transition: border-color .3s, background .3s; }
  .lw-purse > div.hot { border-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 7%, var(--ds-card)); }
  .lw-purse small { display: block; font: 600 12px var(--ds-sans); color: var(--ds-ink3); }
  .lw-purse b { display: block; font: 700 21px/1.15 var(--ds-mono); color: var(--ds-ink); }
  .lw-cups-wrap { position: relative; max-width: 320px; margin: 8px auto 2px; }
  .lw-cups { display: block; width: 100%; }
  .lw-cup { transition: opacity .35s; }
  .lw-cup .b { fill: var(--u); transition: fill .35s; }
  .lw-cup .h { fill: none; stroke: var(--u); stroke-width: 1.3; stroke-linecap: round; transition: stroke .35s; }
  .lw-cup.off .b { fill: var(--ds-rule2); }
  .lw-cup.off .h { stroke: var(--ds-rule2); }
  .lw-cup.off { opacity: .55; }
  .lw-more { position: absolute; right: -4px; top: -10px; font: 700 12px var(--ds-mono); color: #fff; background: var(--ds-ok); border-radius: 999px; padding: 1px 7px; }
  .lw-paper { border: 1px solid var(--ds-rule2); background: var(--ds-card); padding: 8px 12px 10px; margin: 10px 0 4px; box-shadow: 0 2px 0 var(--ds-shade); animation: lw-paper .35s ease-out both; }
  @keyframes lw-paper { from { opacity: 0; transform: translateY(8px) rotate(-.6deg); } to { opacity: 1; transform: none; } }
  .lw-mast { font: 700 12px var(--ds-news); letter-spacing: .2em; text-transform: uppercase; border-bottom: 3px double var(--ds-ink2); padding-bottom: 4px; margin-bottom: 6px; color: var(--ds-ink2); text-align: center; }
  .lw-head { font: 700 18px/1.28 var(--ds-news); text-align: center; }
  .lw-fore { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 7px; font: 700 14.5px var(--ds-sans); color: var(--ds-bad); text-align: center; }
  .lw-scale { display: block; max-width: 380px; margin: 2px auto 0; overflow: visible; }
  .lw-scale .lw-band { fill: color-mix(in srgb, var(--ds-bad) 30%, transparent); stroke: var(--ds-bad); stroke-width: 1; }
  .lw-tick { font: 600 12px var(--ds-mono); fill: var(--ds-ink3); }
  .lw-rate { fill: #3E6FA8; }
  .lw-rate-t { font: 700 12px var(--ds-sans); fill: #345E92; }
  .ds-dark .lw-rate-t { fill: #8FB3E0; }
  .lw-pi line { stroke: var(--ds-ink); }
  .lw-pi text { font: 700 12px var(--ds-sans); fill: var(--ds-ink); }
  .lw-opts { display: grid; gap: 7px; margin-top: 10px; }
  .lw-opt { display: flex; align-items: center; gap: 11px; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1.5px solid var(--ds-rule2); border-bottom-width: 3px;
    background: var(--ds-card); cursor: pointer; color: var(--ds-ink); transition: transform .12s, border-color .15s; animation: lw-opt .3s ease-out both; }
  .lw-opt:nth-child(2) { animation-delay: .05s; } .lw-opt:nth-child(3) { animation-delay: .1s; }
  @keyframes lw-opt { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .lw-opt:hover { border-color: var(--u); }
  .lw-opt:active { transform: scale(.98); }
  .lw-opt:focus-visible { outline: 3px solid var(--u); outline-offset: 2px; }
  .lw-opt .ic { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--ds-card2); color: var(--u-ink); flex-shrink: 0; }
  .lw-opt b { display: block; font: 700 15.5px var(--ds-sans); }
  .lw-opt .h { display: block; font-size: 13.5px; line-height: 1.3; color: var(--ds-ink3); margin-top: 1px; }
  .lw-verdict { margin-top: 10px; border-radius: 12px; padding: 10px 12px 12px; border: 1.5px solid; animation: lw-paper .3s ease-out both; }
  .lw-verdict.ok { border-color: color-mix(in srgb, var(--ds-ok) 55%, transparent); background: var(--ds-ok-bg); }
  .lw-verdict.bad { border-color: color-mix(in srgb, var(--ds-sel-rule) 70%, transparent); background: color-mix(in srgb, var(--ds-sel-rule) 10%, var(--ds-card)); }
  .lw-verdict-head { display: flex; align-items: center; gap: 6px; font: 700 16px var(--ds-head); }
  .lw-verdict.ok .lw-verdict-head { color: var(--ds-ok-ink); }
  .lw-verdict.bad .lw-verdict-head { color: var(--ds-sel-ink); }
  .lw-verdict-text { font-size: 14.5px; line-height: 1.45; margin: 4px 0 8px; color: var(--ds-ink2); }
  .lw-bars { display: grid; gap: 5px; }
  .lw-bar-row { display: grid; grid-template-columns: 6.2em 1fr 4.2em; align-items: center; gap: 8px; font-size: 13.5px; }
  .lw-bar-name { display: inline-flex; align-items: center; gap: 3px; color: var(--ds-ink2); }
  .lw-bar-row.best .lw-bar-name { color: var(--ds-ok-ink); font-weight: 700; }
  .lw-bar-row.picked .lw-bar-name { text-decoration: underline; text-underline-offset: 3px; }
  .lw-bar-track { position: relative; height: 12px; border-radius: 99px; background: var(--ds-card2); }
  .lw-bar-track::before { content: ''; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1.5px; background: var(--ds-ink3); }
  .lw-bar-track i { position: absolute; top: 0; bottom: 0; border-radius: 99px; animation: lw-bar .6s ease-out both; }
  .lw-bar-track i.up { background: var(--ds-ok); }
  .lw-bar-track i.down { background: var(--ds-bad); }
  @keyframes lw-bar { from { clip-path: inset(0 50% 0 50%); } to { clip-path: inset(0 0 0 0); } }
  .lw-bar-row b { font: 700 13.5px var(--ds-mono); text-align: right; }
  .lw-final { align-items: stretch !important; text-align: center; }
  .lw-final-num { font-size: 16px; }
  .lw-final-num b { font-size: 38px; color: var(--u-ink); }
  .lw-path { display: block; max-width: 380px; margin: 4px auto 0; }
  .lw-path-100 { stroke: var(--ds-rule2); stroke-dasharray: 4 4; }
  .lw-path-cash { fill: none; stroke: var(--ds-ink3); stroke-width: 2; stroke-dasharray: 5 4; }
  .lw-path-best { fill: none; stroke: var(--ds-ok); stroke-width: 2; stroke-dasharray: 2 3; }
  .lw-path-mine { fill: none; stroke: var(--u); stroke-width: 3.2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 600; stroke-dashoffset: 600; animation: lm-draw 1.2s ease-out forwards; }
  @keyframes lm-draw { to { stroke-dashoffset: 0; } }
  .lw-path-dot { fill: var(--u); stroke: var(--ds-card); stroke-width: 1.5; }
  .lw-legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; margin: 2px 0 4px; }
  .lw-legend span::before { content: ''; display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
  .lw-legend .mine::before { background: var(--u); }
  .lw-legend .best::before { background: var(--ds-ok); }
  .lw-legend .cash::before { background: var(--ds-ink3); }
  @media (prefers-reduced-motion: reduce) { .lw-paper, .lw-opt, .lw-verdict, .lw-bar-track i, .lw-path-mine { animation: none !important; stroke-dashoffset: 0; } }
  .lp-verdict { margin-top: 6px; font: 700 14.5px var(--ds-sans); color: var(--ds-bad); text-align: center; }
  .lp-verdict.ok { color: var(--ds-ok); }
  .lp-side { margin: 0; text-align: center; font-weight: 700; min-height: 52px; }
  .lp-pop { position: absolute; left: 50%; top: 0; z-index: 2; font-size: 20px; font-weight: 700; color: var(--ds-ok); animation: lp-pop .7s ease-out forwards; pointer-events: none; }
  @keyframes lp-pop { 0% { opacity: 0; transform: translate(-50%, 10px) scale(.8); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -26px) scale(1.15); } }
  .lp-ticker { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; max-width: 340px; margin: 0 auto; }
  .lp-ticker svg { width: 100%; height: 30px; display: block; }
  .lp-bubble { position: relative; background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 4px; padding: 14px 16px; font-size: 17.5px; line-height: 1.5; margin-top: 12px; }
  @media (prefers-reduced-motion: reduce) { .lp-word, .lp-timer > span { transition: none !important; } .lp-word.in, .lp-word-def.open { animation: none !important; } .lp-combo, .lp-effect, .lp-pop { animation: none !important; } }
`;

/* ------------------------------ ГРАФИК РЫНКА ------------------------------ */
const VW = 320; const VH = 232; const PL = 34; const PR = 14; const PT = 12; const PB = 28;
const PW = VW - PL - PR; const PH = VH - PT - PB;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
// линия кривой: точки на сетке цен, которые попадают в поле графика
function curvePath(fq, ax) {
  const pts = [];
  for (let k = 0; k <= 80; k += 1) {
    const p = (ax.pMax * k) / 80; const q = fq(p);
    if (q >= -0.001 && q <= ax.qMax + 0.001) pts.push([PL + (q / ax.qMax) * PW, PT + PH - (p / ax.pMax) * PH]);
  }
  return pts.length > 1 ? `M${pts.map((x) => x.map((v) => v.toFixed(1)).join(',')).join('L')}` : '';
}
const xOf = (q, ax) => PL + (q / ax.qMax) * PW;
const yOf = (p, ax) => PT + PH - (p / ax.pMax) * PH;
/* m — рынок упражнения; shift — { D, S } сдвиг кривых поверх m; show — какие кривые рисовать;
   ghost — исходные кривые пунктиром; price — горизонталь цены с объёмами; mark — точка ученика;
   good — верная точка (после ответа); onDrag / onPlot — перетаскивание кривой и нажатие по полю. */
export function MarketChart({ m, shift = { D: 0, S: 0 }, show = ['D', 'S'], ghost = false, price = null, mark = null, good = null, onDrag = null, onPlot = null, eq = false, label = 'График рынка' }) {
  const ax = marketAxes(m);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const dm = { ...m, dA: (m.dA || 0) + (shift.D || 0) }; const sm = { ...m, dC: (m.dC || 0) + (shift.S || 0) };
  const fD = (mm) => (p) => qd(mm, p); const fS = (mm) => (p) => qs(mm, p);
  const toUnits = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const sx = VW / r.width; const sy = VH / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy, sx };
  };
  const down = (curve) => (e) => {
    if (!onDrag) return;
    e.preventDefault();
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { curve, x0: toUnits(e).x, start: shift[curve] || 0 };
  };
  const move = (e) => {
    if (!drag.current || !onDrag) return;
    const { x } = toUnits(e);
    const dq = ((x - drag.current.x0) / PW) * ax.qMax;
    onDrag(drag.current.curve, drag.current.start + dq);
  };
  const up = () => { drag.current = null; };
  const click = (e) => {
    if (!onPlot) return;
    const { x, y } = toUnits(e);
    const q = clampN(((x - PL) / PW) * ax.qMax, 0, ax.qMax); const p = clampN(((PT + PH - y) / PH) * ax.pMax, 0, ax.pMax);
    onPlot(Math.round(q), Math.round(p * 2) / 2);
  };
  const e0 = show.length === 2 && eq ? equilibrium({ ...m, dA: dm.dA, dC: sm.dC }) : null;
  const ticksP = []; for (let p = 0; p <= ax.pMax; p += ax.pMax > 40 ? 20 : 10) ticksP.push(p);
  const ticksQ = []; for (let q = 0; q <= ax.qMax; q += ax.qMax > 100 ? 40 : 20) ticksQ.push(q);
  return (
    <svg ref={svgRef} className="lp-chart" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={label} data-testid="market-chart"
      data-plot={JSON.stringify({ x0: PL, y0: PT, w: PW, h: PH, vw: VW, vh: VH, qMax: ax.qMax, pMax: ax.pMax })}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} style={{ cursor: onPlot ? 'crosshair' : undefined }}>
      <rect x={PL} y={PT} width={PW} height={PH} fill="none" />
      {ticksP.map((p) => <g key={`p${p}`}><line x1={PL} x2={PL + PW} y1={yOf(p, ax)} y2={yOf(p, ax)} stroke="var(--ds-rule)" strokeWidth="1" /><text x={PL - 6} y={yOf(p, ax) + 4} textAnchor="end">{p}</text></g>)}
      {ticksQ.map((q) => <text key={`q${q}`} x={xOf(q, ax)} y={PT + PH + 16} textAnchor="middle">{q}</text>)}
      <line x1={PL} y1={PT} x2={PL} y2={PT + PH} stroke="var(--ds-ink2)" strokeWidth="2" />
      <line x1={PL} y1={PT + PH} x2={PL + PW} y2={PT + PH} stroke="var(--ds-ink2)" strokeWidth="2" />
      <text x={PL + 4} y={PT + 10}>P</text><text x={PL + PW - 4} y={PT + PH - 6} textAnchor="end">Q</text>
      {ghost && show.includes('D') && (shift.D || m.dA) ? <path d={curvePath(fD({ ...m, dA: 0 }), ax)} stroke="#3E6FA8" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="6 5" fill="none" /> : null}
      {ghost && show.includes('S') && (shift.S || m.dC) ? <path d={curvePath(fS({ ...m, dC: 0 }), ax)} stroke="#C0602A" strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="6 5" fill="none" /> : null}
      {show.includes('D') && <path d={curvePath(fD(dm), ax)} stroke="#3E6FA8" strokeWidth="4" fill="none" strokeLinecap="round" data-curve-line="D" />}
      {show.includes('S') && <path d={curvePath(fS(sm), ax)} stroke="#C0602A" strokeWidth="4" fill="none" strokeLinecap="round" data-curve-line="S" />}
      {onDrag && show.map((c) => (
        <path key={c} d={curvePath(c === 'D' ? fD(dm) : fS(sm), ax)} stroke="transparent" strokeWidth="26" fill="none" className="lp-hit" onPointerDown={down(c)} data-hit={c} />
      ))}
      {show.includes('D') && (() => { const q = clampN(qd(dm, ax.pMax * 0.12), 0, ax.qMax); return <text x={xOf(q, ax) + 4} y={yOf(ax.pMax * 0.12, ax) - 6} style={{ fill: '#3E6FA8' }}>D</text>; })()}
      {show.includes('S') && (() => { const p = ax.pMax * 0.9; const q = clampN(qs(sm, p), 0, ax.qMax); return <text x={xOf(q, ax) + 6} y={yOf(p, ax) + 4} style={{ fill: '#C0602A' }}>S</text>; })()}
      {price != null && (() => {
        const d = clampN(qd(dm, price), 0, ax.qMax); const s = clampN(qs(sm, price), 0, ax.qMax);
        return (
          <g data-testid="price-line">
            <line x1={PL} x2={PL + PW} y1={yOf(price, ax)} y2={yOf(price, ax)} stroke="var(--u)" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={xOf(Math.min(d, s), ax)} x2={xOf(Math.max(d, s), ax)} y1={yOf(price, ax)} y2={yOf(price, ax)} stroke={d > s ? 'var(--ds-bad)' : '#C0602A'} strokeWidth="7" strokeLinecap="round" opacity=".75" />
            <circle cx={xOf(d, ax)} cy={yOf(price, ax)} r="5" fill="#3E6FA8" /><circle cx={xOf(s, ax)} cy={yOf(price, ax)} r="5" fill="#C0602A" />
          </g>
        );
      })()}
      {e0 && <circle cx={xOf(e0.q, ax)} cy={yOf(e0.p, ax)} r="6" fill="var(--ds-ink)" />}
      {good && <circle cx={xOf(good.q, ax)} cy={yOf(good.p, ax)} r="9" fill="none" stroke="var(--ds-ok)" strokeWidth="3" data-testid="point-good" />}
      {mark && <circle cx={xOf(mark.q, ax)} cy={yOf(mark.p, ax)} r="7" fill="var(--u)" stroke="#fff" strokeWidth="2" data-testid="point-mark" />}
    </svg>
  );
}

const CURVE_NAME = { D: 'спрос', S: 'предложение' };
const CURVE_TITLE = { D: 'Спрос', S: 'Предложение' };
// сдвиг кривой пальцем: шаг — 10 единиц объёма, не дальше ±40; кнопки — то же без пальца
export function CurveEx({ inst, resp, setResp, locked, fb }) {
  const r = resp || { D: 0, S: 0 };
  const curves = inst.only ? [inst.only] : ['D', 'S'];
  const set = (curve, v) => {
    if (locked) return;
    const n = clampN(Math.round(v / inst.step) * inst.step, -40, 40);
    if (n !== (r[curve] || 0)) { Audio.play('tick'); setResp({ ...r, [curve]: n }); }
  };
  const shown = fb && !fb.ok ? { D: 0, S: 0, [inst.answer[0]]: inst.answer[1] === '+' ? 20 : -20 } : r;
  return (
    <div data-testid="curve-ex">
      <MarketChart m={inst.market} show={curves} shift={shown} ghost eq={curves.length === 2} onDrag={locked ? null : set} label="Кривые рынка: перетащите нужную кривую" />
      <div className="lp-readout ds-sub">{fb && !fb.ok ? 'Так должна была сдвинуться кривая' : curves.some((c) => r[c]) ? curves.filter((c) => r[c]).map((c) => `${CURVE_TITLE[c]} ${r[c] > 0 ? 'вправо' : 'влево'} на ${Math.abs(r[c])}`).join(', ') : 'Потяните кривую пальцем или нажмите стрелку'}</div>
      {curves.map((c) => (
        <div key={c} className="lp-row">
          <button type="button" className="ds-chip" data-curve={c} data-dir="-" aria-label={`Сдвинуть ${CURVE_NAME[c]} влево`} disabled={locked} onClick={() => set(c, (r[c] || 0) - inst.step)}><ArrowLeft size={16} /> {CURVE_TITLE[c]}</button>
          <button type="button" className="ds-chip" data-curve={c} data-dir="+" aria-label={`Сдвинуть ${CURVE_NAME[c]} вправо`} disabled={locked} onClick={() => set(c, (r[c] || 0) + inst.step)}>{CURVE_TITLE[c]} <ArrowRight size={16} /></button>
        </div>
      ))}
      {curves.some((c) => r[c]) && !locked && (
        <div className="lp-row"><button type="button" className="ds-btn ds-btn--ghost" style={{ padding: '6px 10px', fontSize: 14 }} onClick={() => setResp(null)}><RotateCcw size={14} style={{ verticalAlign: -2 }} /> Вернуть кривые</button></div>
      )}
    </div>
  );
}

// цена ползунком: видно, сколько хотят купить и сколько продают, и разрыв между ними
export function PriceEx({ inst, resp, setResp, locked }) {
  const ax = marketAxes(inst.market);
  const p = resp == null ? inst.start : resp;
  const d = Math.round(qd(inst.market, p)); const s = Math.round(qs(inst.market, p));
  const gap = d - s;
  return (
    <div data-testid="price-ex">
      <MarketChart m={inst.market} price={p} label={`Рынок при цене ${p}`} />
      <div className="lp-readout" data-testid="price-readout">
        Цена <b>{p}</b>: хотят купить <b className="lp-dem">{Math.max(0, d)}</b>, продают <b className="lp-sup">{Math.max(0, s)}</b>
        {gap > 0 ? <> — <b style={{ color: 'var(--ds-bad-ink)' }}>дефицит {gap}</b></> : gap < 0 ? <> — <b className="lp-sup">избыток {-gap}</b></> : <> — <b style={{ color: 'var(--ds-ok-ink)' }}>ни дефицита, ни избытка</b></>}
      </div>
      <input type="range" className="lp-range" min={0} max={ax.pMax} step={1} value={p} disabled={locked} aria-label="Цена"
        onChange={(e) => { Audio.play('tick'); setResp(Number(e.target.value)); }} />
    </div>
  );
}

// точка равновесия: нажать по графику там, где пересекаются кривые
export function PointEx({ inst, resp, setResp, locked, fb }) {
  return (
    <div data-testid="point-ex">
      <MarketChart m={inst.market} ghost mark={resp} good={fb ? inst.answer : null} onPlot={locked ? null : (q, p) => { Audio.play('tick'); setResp({ q, p }); }}
        label="Нажмите на график там, где новое равновесие" />
      <div className="lp-readout ds-sub">{resp ? <>Ваша точка: объём <b>{resp.q}</b>, цена <b>{String(resp.p).replace('.', ',')}</b></> : 'Нажмите на график, чтобы поставить точку'}</div>
    </div>
  );
}

// определение из плиток: нажатые плитки встают в строку, нажатие по плитке в строке — убирает её
export function TilesEx({ inst, resp, setResp, locked, fb }) {
  const seq = resp || [];
  const tile = (k) => inst.tiles.find((t) => t.key === k);
  return (
    <div data-testid="tiles-ex">
      <div className="lp-tiles" data-testid="tiles-answer" style={fb ? { borderColor: fb.ok ? 'var(--ds-ok)' : 'var(--ds-bad)', borderStyle: 'solid' } : undefined}>
        {seq.map((k) => (
          <button key={k} type="button" className="lp-tile" disabled={locked} onClick={() => { Audio.play('tick'); setResp(seq.filter((x) => x !== k)); }}>{tile(k).text}</button>
        ))}
        {!seq.length && <span style={{ fontSize: 14, color: 'var(--ds-ink3)', padding: 8 }}>Нажимайте плитки по порядку</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }} role="group" aria-label="Плитки">
        {inst.tiles.filter((t) => !seq.includes(t.key)).map((t) => (
          <button key={t.key} type="button" className="lp-tile" data-tile={t.key} disabled={locked} onClick={() => { Audio.play('tick'); setResp([...seq, t.key]); }}>{t.text}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ ТАЙМЕР И РАУНДЫ ------------------------------ */
// полоса времени: идёт, пока running; по нулю — onEnd (один раз)
export function TimerBar({ seconds, running, onEnd }) {
  const [left, setLeft] = useState(seconds * 1000);
  const end = useRef(onEnd); end.current = onEnd;
  const fired = useRef(false);
  useEffect(() => {
    if (!running) return undefined;
    const t0 = Date.now(); const from = left;
    const id = setInterval(() => {
      const l = Math.max(0, from - (Date.now() - t0));
      setLeft(l);
      if (l <= 0 && !fired.current) { fired.current = true; clearInterval(id); end.current(); }
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const pct = (left / (seconds * 1000)) * 100;
  return (
    <div>
      <div className="lp-score"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={14} />{Math.ceil(left / 1000)} с</span></div>
      <div className={`lp-timer ${pct < 25 ? 'low' : ''}`} role="timer" aria-label={`Осталось ${Math.ceil(left / 1000)} секунд`} data-testid="timer"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const testing = () => typeof window !== 'undefined' && !!window.__INFLATIA_TEST__;

/* ------------------------------ МИНИ-ИГРА ------------------------------
   Одна игра на урок, на время. Карточки идут по кругу, пока не кончится время; за верный
   ответ — очки с множителем серии (comboOf), ошибка серию обнуляет. Каждая карточка меняет
   график игры — так видно, что делает с рынком заголовок или со страной решение:
   chart=market — кривая спроса или предложения сдвигается, цена едет, внизу — её история;
   chart=ppf — КПВ растёт или сжимается, точка страны скользит по кривой;
   chart=budget — бюджетная линия: доход сдвигает её параллельно, цена товара поворачивает.
   Ответ — смахнуть карточку (swipe), кнопки или стрелки клавиатуры. */
const EFFECT_LABEL = {
  'D+': 'Спрос вправо', 'D-': 'Спрос влево', 'S+': 'Предложение вправо', 'S-': 'Предложение влево',
  out: 'КПВ наружу', in: 'КПВ внутрь', ox: 'КПВ наружу по хлебу', oy: 'КПВ наружу по станкам', ix: 'КПВ внутрь по хлебу', iy: 'КПВ внутрь по станкам',
  x: 'Точка — к хлебу', y: 'Точка — к станкам',
};
const BUDGET_LABEL = { out: 'Доход вырос', in: 'Доход упал', ox: 'Товар X дешевле', ix: 'Товар X дороже', oy: 'Товар Y дешевле', iy: 'Товар Y дороже' };
const ELASTIC_LABEL = { in: 'Неэластичный: выручка растёт', el: 'Эластичный: выручка падает' };
const COSTS_LABEL = { fc: 'Постоянные: поднялись только средние', vc: 'Переменные: поднялись все три кривые' };
const POWER_LABEL = { pt: 'Ценополучатель: цена с рынка, P = MC', mp: 'Власть над ценой: цена выше MC' };
const effectLabel = (chart, eff) => (chart === 'budget' ? BUDGET_LABEL[eff] : chart === 'elastic' ? ELASTIC_LABEL[eff] : chart === 'costs' ? COSTS_LABEL[eff] : chart === 'power' ? POWER_LABEL[eff] : EFFECT_LABEL[eff]);
const BUDGET0 = { I: 100, px: 1.25, py: 1.25 };
const MARKET_STEP = 16;
// состояние графика после карточки: сдвиги понемногу забываются, чтобы график не уезжал за край
function applyEffect(chart, st, eff) {
  // эластичность: крутая или пологая кривая спроса через одну точку
  if (chart === 'elastic') return { e: eff === 'in' ? 0.4 : eff === 'el' ? 2.5 : st.e };
  // издержки: постоянная трата поднимает только средние общие, переменная — все три кривые
  if (chart === 'costs') return { fc: eff === 'fc' ? 1 : eff ? 0 : st.fc, vc: eff === 'vc' ? 1 : eff ? 0 : st.vc };
  // рыночная власть: спрос на товар фирмы — горизонтальный у ценополучателя, падающий у монополиста
  if (chart === 'power') return { m: eff === 'mp' ? 1 : eff === 'pt' ? 0 : st.m };
  if (chart === 'market') {
    const d = { D: st.D * 0.6, S: st.S * 0.6 };
    if (eff) d[eff[0]] = clampN(d[eff[0]] + (eff[1] === '+' ? MARKET_STEP : -MARKET_STEP), -32, 32);
    return d;
  }
  if (chart === 'budget') {
    // доход и цены понемногу возвращаются к исходным, чтобы линия не уезжала за край
    const back = (key, v) => BUDGET0[key] + (v - BUDGET0[key]) * 0.85;
    let { I, px, py } = { I: back('I', st.I), px: back('px', st.px), py: back('py', st.py) };
    if (eff === 'out') I = clampN(I * 1.2, 60, 160);
    if (eff === 'in') I = clampN(I / 1.2, 60, 160);
    if (eff === 'ox') px = clampN(px / 1.25, 0.9, 2.6);
    if (eff === 'ix') px = clampN(px * 1.25, 0.9, 2.6);
    if (eff === 'oy') py = clampN(py / 1.25, 0.9, 2.6);
    if (eff === 'iy') py = clampN(py * 1.25, 0.9, 2.6);
    return { I, px, py };
  }
  const k = (v) => 100 + (v - 100) * 0.85;
  let { rx, ry, t } = { rx: k(st.rx), ry: k(st.ry), t: st.t };
  const mul = { out: [1.14, 1.14], in: [0.88, 0.88], ox: [1.18, 1], oy: [1, 1.18], ix: [0.84, 1], iy: [1, 0.84] }[eff];
  if (mul) { rx = clampN(rx * mul[0], 62, 138); ry = clampN(ry * mul[1], 62, 138); }
  if (eff === 'x') t = clampN(t - 0.16, 0.08, 0.92);
  if (eff === 'y') t = clampN(t + 0.16, 0.08, 0.92);
  return { rx, ry, t };
}
const startState = (chart) => (chart === 'market' ? { D: 0, S: 0 } : chart === 'budget' ? { ...BUDGET0 } : chart === 'elastic' ? { e: 1 } : chart === 'costs' ? { fc: 0, vc: 0 } : chart === 'power' ? { m: 0.5 } : { rx: 100, ry: 100, t: 0.5 });
// плавный переход к новому состоянию графика (при «уменьшить движение» — сразу)
function useTween(target, ms = 420) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced) { setV(target); from.current = target; return undefined; }
    const a = from.current; const t0 = performance.now(); let id;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms); const e = 1 - (1 - k) ** 3;
      const cur = Object.fromEntries(Object.keys(target).map((key) => [key, a[key] + (target[key] - a[key]) * e]));
      setV(cur); from.current = cur;
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target), reduced]);
  return v;
}
// бюджетная линия игры: от «всё на Y» до «всё на X», закрашены доступные наборы; пунктир — с чего начинали
function BudgetGameChart({ st }) {
  const W = 300; const H = 200; const L = 34; const B = 26; const T = 10; const R = 12; const M = 170;
  const sx = (v) => L + (Math.min(v, M) / M) * (W - L - R); const sy = (v) => H - B - (Math.min(v, M) / M) * (H - B - T);
  const xm = st.I / st.px; const ym = st.I / st.py;
  const x0 = BUDGET0.I / BUDGET0.px; const y0 = BUDGET0.I / BUDGET0.py;
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Бюджетная линия: всё на X — ${Math.round(xm)}, всё на Y — ${Math.round(ym)}`} data-testid="game-chart" data-chart="budget"
      data-state={JSON.stringify({ x: Math.round(xm), y: Math.round(ym) })}>
      <path d={`M${sx(0)},${sy(0)}L${sx(0)},${sy(ym)}L${sx(xm)},${sy(0)}Z`} fill="var(--u)" opacity=".12" />
      <line x1={sx(0)} y1={sy(y0)} x2={sx(x0)} y2={sy(0)} stroke="var(--ds-ink3)" strokeWidth="2" strokeDasharray="5 5" />
      <line x1={sx(0)} y1={sy(ym)} x2={sx(xm)} y2={sy(0)} stroke="var(--u)" strokeWidth="4" strokeLinecap="round" />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <text x={W - R} y={H - 8} textAnchor="end" className="lp-ax">X</text>
      <text x={L - 6} y={T + 8} textAnchor="end" className="lp-ax">Y</text>
      <circle cx={sx(xm)} cy={sy(0)} r="4.5" fill="var(--u)" /><circle cx={sx(0)} cy={sy(ym)} r="4.5" fill="var(--u)" />
      <text x={sx(xm)} y={H - B - 8} textAnchor="middle" className="lp-ax">{Math.round(xm)}</text>
      <text x={L + 8} y={sy(ym) + 4} className="lp-ax">{Math.round(ym)}</text>
    </svg>
  );
}
/* Эластичность в игре: спрос через точку «цена 20, покупают 60». Крутая кривая — неэластичный
   спрос, пологая — эластичный. Прямоугольники — выручка сейчас и после подорожания на 10%. */
function ElasticGameChart({ st }) {
  const W = 300; const H = 200; const L = 34; const B = 26; const T = 10; const R = 12;
  const QM = 140; const PM = 40;
  const sx = (q) => L + (Math.max(0, Math.min(q, QM)) / QM) * (W - L - R); const sy = (p) => H - B - (Math.max(0, Math.min(p, PM)) / PM) * (H - B - T);
  const b = 3 * st.e; // |E| = b·P/Q в точке (60, 20)
  const qAt = (p) => 60 - b * (p - 20);
  const pAt = (q) => 20 - (q - 60) / b;
  // концы прямой — там, где она входит в рамку графика и выходит из неё (а не по отдельности по осям: иначе наклон врёт)
  const top = qAt(PM) >= 0 ? { q: qAt(PM), p: PM } : { q: 0, p: pAt(0) };
  const bottom = qAt(0) <= QM ? { q: qAt(0), p: 0 } : { q: QM, p: pAt(QM) };
  const p1 = 22; const q1 = Math.max(0, qAt(p1));
  const r0 = 20 * 60; const r1 = p1 * q1;
  const up = r1 >= r0;
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Спрос ${st.e < 1 ? 'неэластичный' : 'эластичный'}: выручка после подорожания ${Math.round(r1)} против ${r0}`}
      data-testid="game-chart" data-chart="elastic" data-state={JSON.stringify({ e: Math.round(st.e * 100) / 100, up })}>
      <rect x={sx(0)} y={sy(20)} width={sx(60) - sx(0)} height={sy(0) - sy(20)} fill="var(--ds-ink3)" opacity=".12" />
      <rect x={sx(0)} y={sy(p1)} width={sx(q1) - sx(0)} height={sy(0) - sy(p1)} fill="none" stroke={up ? 'var(--ds-ok)' : 'var(--ds-bad)'} strokeWidth="2" strokeDasharray="5 4" />
      <line x1={sx(top.q)} y1={sy(top.p)} x2={sx(bottom.q)} y2={sy(bottom.p)} stroke="var(--u)" strokeWidth="4" strokeLinecap="round" data-testid="elastic-demand" />
      <circle cx={sx(60)} cy={sy(20)} r="4.5" fill="var(--u)" />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <text x={W - R} y={H - 8} textAnchor="end" className="lp-ax">Q</text>
      <text x={L - 6} y={T + 8} textAnchor="end" className="lp-ax">P</text>
      {/* подложка цвета фона: крутая кривая спроса проходит под надписью, но не перечёркивает её */}
      <text x={W - R - 4} y={T + 14} textAnchor="end" className="lp-ax" style={{ fill: up ? 'var(--ds-ok)' : 'var(--ds-bad)', fontWeight: 700, stroke: 'var(--ds-paper)', strokeWidth: 5, paintOrder: 'stroke', strokeLinejoin: 'round' }}>
        выручка при +10% цены: {up ? '↑' : '↓'} {Math.round(r1)}
      </text>
    </svg>
  );
}
/* Издержки игры: средние общие (ATC), средние переменные (AVC) и предельные (MC) пекарни; пунктир —
   с чего начинали. Постоянная трата поднимает только ATC, переменная — все три кривые: так видно,
   почему аренда не меняет цену ещё одной партии. fc и vc — доля сдвига от 0 до 1 (плавный переход). */
function CostsGameChart({ st }) {
  const W = 300; const H = 200; const L = 34; const B = 26; const T = 10; const R = 12;
  const QM = 8; const PM = 60;
  const sx = (q) => L + (q / QM) * (W - L - R); const sy = (p) => H - B - (Math.max(0, Math.min(p, PM)) / PM) * (H - B - T);
  const curve = (f) => { const pts = []; for (let k = 0; k <= 40; k += 1) { const q = 0.6 + (k / 40) * (QM - 0.6); pts.push(`${sx(q).toFixed(1)},${sy(f(q)).toFixed(1)}`); } return `M${pts.join('L')}`; };
  const fc = 30 + 25 * (st.fc || 0); const v = 6 * (st.vc || 0);
  const avc = (q, dv) => 14 - 3 * q + 0.5 * q * q + dv;
  const mc = (q, dv) => 14 - 6 * q + 1.5 * q * q + dv;
  const atc = (q, f, dv) => f / q + avc(q, dv);
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={st.fc > 0.5 ? 'Постоянные издержки выросли: поднялись только средние общие' : st.vc > 0.5 ? 'Переменные издержки выросли: поднялись все три кривые' : 'Кривые издержек пекарни'}
      data-testid="game-chart" data-chart="costs" data-state={JSON.stringify({ fc: Math.round((st.fc || 0) * 100) / 100, vc: Math.round((st.vc || 0) * 100) / 100 })}>
      <path d={curve((q) => atc(q, 30, 0))} fill="none" stroke="var(--ds-ink3)" strokeWidth="1.5" strokeDasharray="4 4" />
      <path d={curve((q) => mc(q, 0))} fill="none" stroke="var(--ds-ink3)" strokeWidth="1.5" strokeDasharray="4 4" opacity=".7" />
      <path d={curve((q) => avc(q, v))} fill="none" stroke="var(--ds-ok)" strokeWidth="2.5" data-testid="costs-avc" />
      <path d={curve((q) => mc(q, v))} fill="none" stroke="var(--ds-bad)" strokeWidth="2.5" data-testid="costs-mc" />
      <path d={curve((q) => atc(q, fc, v))} fill="none" stroke="var(--u)" strokeWidth="3.5" strokeLinecap="round" data-testid="costs-atc" />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <text x={W - R} y={H - 8} textAnchor="end" className="lp-ax">Q</text>
      <text x={L - 6} y={T + 8} textAnchor="end" className="lp-ax">C</text>
      {[['ATC', atc(7.2, fc, v), 'var(--u)'], ['AVC', avc(7.2, v), 'var(--ds-ok)'], ['MC', mc(6.1, v), 'var(--ds-bad)']].map(([t, y, c], k) => (
        <text key={t} x={k === 2 ? sx(6.1) - 4 : sx(7.6)} y={sy(y) - 4} textAnchor="end" className="lp-ax" style={{ fill: c, fontWeight: 700, stroke: 'var(--ds-paper)', strokeWidth: 4, paintOrder: 'stroke' }}>{t}</text>
      ))}
    </svg>
  );
}
/* Рыночная власть: спрос на товар фирмы. У ценополучателя он горизонтален на уровне рыночной цены —
   фирма продаёт там, где цена равна MC. У монополиста спрос падает, предельная выручка MR ниже
   него, выпуск — где MR = MC, а цена со спроса выше MC: между ними — наценка. m — от 0 к 1. */
function PowerGameChart({ st }) {
  const W = 300; const H = 200; const L = 34; const B = 26; const T = 10; const R = 12;
  const QM = 12; const PM = 64;
  const sx = (q) => L + (Math.max(0, Math.min(q, QM)) / QM) * (W - L - R); const sy = (p) => H - B - (Math.max(0, Math.min(p, PM)) / PM) * (H - B - T);
  const m = Math.max(0, Math.min(1, st.m));
  const mc = (q) => 10 + 2.5 * q;
  const dem = (q) => (1 - m) * 30 + m * (60 - 5 * q);
  const mr = (q) => (1 - m) * 30 + m * (60 - 10 * q);
  const line = (f, q0, q1) => `M${sx(q0).toFixed(1)},${sy(f(q0)).toFixed(1)}L${sx(q1).toFixed(1)},${sy(f(q1)).toFixed(1)}`;
  const q = 8 - 4 * m; const p = 30 + 10 * m; const markup = Math.round(p - mc(q));
  const halo = { stroke: 'var(--ds-paper)', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' };
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={m > 0.5 ? `Власть над ценой: цена ${Math.round(p)} выше предельных издержек на ${markup}` : 'Ценополучатель: цена с рынка равна предельным издержкам'}
      data-testid="game-chart" data-chart="power" data-state={JSON.stringify({ m: Math.round(m * 100) / 100, markup })}>
      <rect x={sx(0)} y={sy(p)} width={sx(q) - sx(0)} height={Math.max(0, sy(mc(q)) - sy(p))} fill="var(--u)" opacity={0.14 * m} />
      <path d={line(mc, 0, 9.6)} fill="none" stroke="var(--ds-ok)" strokeWidth="2.5" />
      <path d={line(mr, 0, Math.min(QM, 6))} fill="none" stroke="var(--ds-ink3)" strokeWidth="2" strokeDasharray="5 4" opacity={m} />
      <path d={line(dem, 0, QM)} fill="none" stroke="var(--u)" strokeWidth="4" strokeLinecap="round" data-testid="power-demand" />
      <line x1={sx(q)} y1={sy(p)} x2={sx(q)} y2={sy(0)} stroke="var(--ds-ink3)" strokeDasharray="3 3" />
      <line x1={sx(q) + 7} y1={sy(p)} x2={sx(q) + 7} y2={sy(mc(q))} stroke="var(--u)" strokeWidth="2" opacity={m} />
      <circle cx={sx(q)} cy={sy(p)} r="5" fill="var(--u)" />
      <circle cx={sx(q)} cy={sy(mc(q))} r="3.5" fill="var(--ds-ok)" opacity={m} />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <text x={W - R} y={H - 8} textAnchor="end" className="lp-ax">Q</text>
      <text x={L - 6} y={T + 8} textAnchor="end" className="lp-ax">P</text>
      <text x={sx(1.2)} y={sy(mc(1.2)) - 7} className="lp-ax" style={{ fill: 'var(--ds-ok)', fontWeight: 700, ...halo }}>MC</text>
      <text x={sx(1)} y={sy(dem(1)) - 8} className="lp-ax" style={{ fill: 'var(--u-ink)', fontWeight: 700, ...halo }}>спрос</text>
      {m > 0.15 && <text x={sx(Math.min(QM, 5.6)) + 4} y={sy(mr(5.6)) + 12} className="lp-ax" style={{ opacity: m, ...halo }}>MR</text>}
      {m > 0.15 && <text x={sx(q) + 12} y={(sy(p) + sy(mc(q))) / 2 + 4} className="lp-ax" style={{ opacity: m, fill: 'var(--u-ink)', fontWeight: 700, ...halo }}>наценка +{markup}</text>}
      <text x={W - R - 4} y={T + 14} textAnchor="end" className="lp-ax" style={{ fill: m > 0.5 ? 'var(--u-ink)' : 'var(--ds-ok)', fontWeight: 700, ...halo }}>{m > 0.5 ? 'цена выше MC' : 'цена = MC'}</text>
    </svg>
  );
}
// КПВ игры: четверть эллипса с концами rx (хлеб) и ry (станки); пунктир — с чего начинали
function PpfGameChart({ st }) {
  const W = 300; const H = 200; const L = 34; const B = 26; const T = 10; const R = 12;
  const sx = (v) => L + (v / 140) * (W - L - R); const sy = (v) => H - B - (v / 140) * (H - B - T);
  const path = (rx, ry) => { const pts = []; for (let k = 0; k <= 40; k += 1) { const a = (k / 40) * (Math.PI / 2); pts.push(`${sx(rx * Math.cos(a)).toFixed(1)},${sy(ry * Math.sin(a)).toFixed(1)}`); } return `M${pts.join('L')}`; };
  const a = st.t * (Math.PI / 2);
  const px = sx(st.rx * Math.cos(a)); const py = sy(st.ry * Math.sin(a));
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`КПВ: хлеба до ${Math.round(st.rx)}, станков до ${Math.round(st.ry)}`} data-testid="game-chart" data-chart="ppf"
      data-state={JSON.stringify({ rx: Math.round(st.rx), ry: Math.round(st.ry), t: Math.round(st.t * 100) / 100 })}>
      <path d={`${path(st.rx, st.ry)}L${sx(0)},${sy(0)}Z`} fill="var(--u)" opacity=".1" />
      <path d={path(100, 100)} stroke="var(--ds-ink3)" strokeWidth="2" strokeDasharray="5 5" fill="none" />
      <path d={path(st.rx, st.ry)} stroke="var(--u)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="2" />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="2" />
      <text x={L + 4} y={T + 10}>станки</text><text x={W - R} y={H - B - 6} textAnchor="end">хлеб</text>
      <line x1={px} y1={py} x2={px} y2={H - B} stroke="var(--u)" strokeDasharray="3 4" opacity=".6" />
      <line x1={L} y1={py} x2={px} y2={py} stroke="var(--u)" strokeDasharray="3 4" opacity=".6" />
      <circle cx={px} cy={py} r="8" fill="var(--ds-card)" stroke="var(--u)" strokeWidth="4" />
    </svg>
  );
}
// история цены за игру: маленькая линия под графиком рынка
function PriceTicker({ prices }) {
  if (prices.length < 2) return null;
  const W = 300; const H = 34; const lo = Math.min(...prices) - 1; const hi = Math.max(...prices) + 1;
  const pts = prices.map((p, i) => `${((i / (prices.length - 1)) * (W - 8) + 4).toFixed(1)},${(H - 4 - ((p - lo) / (hi - lo)) * (H - 8)).toFixed(1)}`);
  const last = prices[prices.length - 1]; const prev = prices[prices.length - 2];
  return (
    <div className="lp-ticker" data-testid="price-ticker">
      <span className="ds-eyebrow" style={{ fontSize: 12 }}>Цена</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts.join(' ')} fill="none" stroke="var(--u)" strokeWidth="2.5" strokeLinejoin="round" /></svg>
      <b className="ds-num" style={{ color: last > prev ? 'var(--ds-bad)' : last < prev ? 'var(--ds-ok)' : 'inherit' }}>{fmtResult(Math.round(last * 10) / 10)} {last > prev ? '↑' : last < prev ? '↓' : ''}</b>
    </div>
  );
}
const SIDE_ICON = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown };
const KEY_SIDE = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
export function GameRound({ inst, onDone, locked, result = null, best = 0, intro = null }) {
  const reduced = useReducedMotion();
  const sides = inst.kind === 'swipe' ? ['left', 'right'] : ['up', 'down'];
  const [phase, setPhase] = useState(locked ? 'over' : 'ready');
  /* колода — каждая новость один раз (пробная — в самом конце): разобрали всё раньше времени —
     игра кончается, а секунды в запасе идут в очки */
  const sample = inst.items.find((x) => x.effect) || inst.items[0];
  const deck = useRef([...inst.items.filter((x) => x !== sample), sample]);
  const t0 = useRef(0);
  const [bonus, setBonus] = useState(0);
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useState(() => startState(inst.chart));
  const [prices, setPrices] = useState(() => (inst.market ? [equilibrium(inst.market).p] : []));
  const [answers, setAnswers] = useState([]);
  const [flash, setFlash] = useState(null);
  const [pop, setPop] = useState(null);
  const [tag, setTag] = useState(null);
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const done = useRef(false);
  const ans = useRef([]);
  const shown = useTween(st);
  const item = deck.current[idx % deck.current.length];
  const { score, bestRun } = gameScore(answers);
  const run = (() => { let n = 0; for (let k = answers.length - 1; k >= 0 && answers[k]; k -= 1) n += 1; return n; })();
  const combo = comboOf(run);
  const seconds = testing() && window.__INFLATIA_GAME_SECONDS__ ? Number(window.__INFLATIA_GAME_SECONDS__) : inst.seconds;
  const finish = (early = false) => {
    if (done.current) return; done.current = true;
    const a = ans.current; const sc = gameScore(a);
    const tb = early ? timeBonus(seconds - (Date.now() - t0.current) / 1000) : 0;
    const total = sc.score + tb;
    setBonus(tb); setPhase('over');
    onDone({ right: a.filter(Boolean).length, answered: a.length, score: total, timeBonus: tb, bestRun: sc.bestRun, record: total > best && total > 0, timeout: !early, done: true });
  };
  const decide = (side) => {
    if (phase !== 'play' || locked || done.current || !item || ans.current.length >= deck.current.length) return;
    const ok = side === item.side;
    Audio.play(ok ? 'coin' : 'down');
    const next = [...ans.current, ok]; ans.current = next; setAnswers(next);
    if (ok) { const r = (() => { let n = 0; for (let k = next.length - 1; k >= 0 && next[k]; k -= 1) n += 1; return n; })(); setPop({ k: next.length, v: 10 * comboOf(r - 1) }); }
    setFlash(ok ? 'ok' : 'bad'); setDx(0);
    setTimeout(() => setFlash(null), 260);
    if (item.effect) {
      const ns = applyEffect(inst.chart, st, item.effect);
      setSt(ns); setTag({ k: next.length, text: effectLabel(inst.chart, item.effect) });
      if (inst.market) setPrices((p) => [...p, equilibrium({ ...inst.market, dA: ns.D, dC: ns.S }).p].slice(-24));
    }
    if (idx + 1 >= deck.current.length) setTimeout(() => finish(true), 280);
    else setIdx(idx + 1);
  };
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const key = (e) => { const side = KEY_SIDE[e.key]; if (side && sides.includes(side)) { e.preventDefault(); decide(side); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const down = (e) => { if (phase !== 'play' || inst.kind !== 'swipe') return; start.current = e.clientX; if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (start.current != null) setDx(e.clientX - start.current); };
  const up = () => { if (start.current == null) return; const d = dx; start.current = null; if (Math.abs(d) > 80) decide(d > 0 ? 'right' : 'left'); else setDx(0); };
  /* Пробный ход: один заголовок без таймера и без очков — ответ с объяснением, график показывает
     сдвиг. Перед стартом график возвращается на место. */
  const [trial, setTrial] = useState(null);
  const tryIt = (side) => {
    if (trial) return;
    const ok = side === sample.side;
    Audio.play(ok ? 'coin' : 'down');
    setTrial({ ok });
    if (sample.effect) setSt(applyEffect(inst.chart, startState(inst.chart), sample.effect));
  };
  const begin = () => { Audio.play('click'); setSt(startState(inst.chart)); t0.current = Date.now(); setPhase('play'); };
  const sideHint = inst.kind === 'swipe' ? `кнопки внизу, стрелки ← → или смахните карточку` : 'кнопки внизу или стрелки ↑ ↓ на клавиатуре';
  const r = result || (phase === 'over' ? { right: answers.filter(Boolean).length, answered: answers.length, score: score + bonus, timeBonus: bonus, bestRun, record: false } : null);
  const chart = inst.chart === 'market'
    ? <><MarketChart m={inst.market} shift={{ D: shown.D || 0, S: shown.S || 0 }} ghost eq label="Рынок в игре: спрос и предложение" /><PriceTicker prices={prices} /></>
    : inst.chart === 'ppf' ? <PpfGameChart st={shown} /> : inst.chart === 'budget' ? <BudgetGameChart st={shown} /> : inst.chart === 'elastic' ? <ElasticGameChart st={shown} />
      : inst.chart === 'costs' ? <CostsGameChart st={shown} /> : inst.chart === 'power' ? <PowerGameChart st={shown} /> : null;
  return (
    <div data-testid="game" data-phase={phase} className="lp-game">
      {phase === 'ready' && (
        <>
          {intro}
          <div className="lp-howto" data-testid="game-howto">
            <div className="ds-eyebrow">Как играть</div>
            <ol>
              <li>Появляется заголовок новости — каждая по одному разу, всего {inst.items.length}.</li>
              <li>Решите: {inst.labels[sides[0]].toLowerCase()} или {inst.labels[sides[1]].toLowerCase()}? Отвечайте — {sideHint}.</li>
              <li>График покажет, что сдвинулось. Три верных подряд — очки ×2, дальше ещё больше; ошибка обнуляет серию. Разобрали все раньше времени — секунды в запасе тоже идут в очки, а очки — в опыт урока.</li>
            </ol>
          </div>
          {chart}
          <div className="lp-trial" data-testid="game-trial">
            <div className="ds-eyebrow">Пробный заголовок — без таймера</div>
            <div className="lp-trial-card" data-answer={testing() ? sample.side : undefined}><Inline nodes={sample.text} /></div>
            {!trial ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {sides.map((sd) => <button key={sd} type="button" className="ds-opt lp-side" data-trial={sd} onClick={() => tryIt(sd)}>{inst.labels[sd]}</button>)}
              </div>
            ) : (
              <div style={{ fontSize: 14.5, lineHeight: 1.45 }} data-testid="game-trial-result" data-ok={String(trial.ok)}>
                <b style={{ color: trial.ok ? 'var(--ds-ok)' : 'var(--ds-bad)' }}>{trial.ok ? 'Верно.' : 'Не совсем.'}</b>{' '}
                Ответ — «{inst.labels[sample.side]}»{sample.effect ? `: ${effectLabel(inst.chart, sample.effect).toLowerCase()}, это видно на графике` : ''}. В игре так же — только быстро.
              </div>
            )}
          </div>
          <div className="lp-game-rules ds-sub">
            <span><Timer size={14} aria-hidden="true" /> {seconds} секунд</span>
            <span>зачёт — когда верных на {GAME_PASS} больше, чем ошибок</span>
            {best > 0 && <span data-testid="game-best"><Trophy size={14} aria-hidden="true" /> рекорд: {best}</span>}
          </div>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="ds-btn" data-testid="game-start" onClick={begin}><Play size={16} style={{ verticalAlign: -3 }} /> {trial ? 'Старт' : 'Сразу к игре'}</button>
          </div>
        </>
      )}
      {phase === 'play' && (
        <>
          <TimerBar seconds={seconds} running={!locked} onEnd={finish} />
          <div className="lp-game-hud">
            <span className="ds-num lp-game-score" data-testid="game-score">{score}</span>
            {combo > 1 && <span className="lp-combo" key={`c${combo}`} data-testid="game-combo">×{combo}</span>}
            <span style={{ flex: 1 }} />
            {/* до зачёта — всё время на виду: набрал — отметка, дальше игра на очки и рекорд */}
            {(() => { const left = gameLeft(answers.filter(Boolean).length, answers.length); return (
              <span className={`lp-pass${left ? '' : ' ok'}`} data-testid="game-pass" data-left={left}>{left ? `до зачёта: ${left}` : <><Check size={13} strokeWidth={3} aria-hidden="true" /> зачёт есть</>}</span>
            ); })()}
          </div>
          <div className="lp-game-stage">{chart}</div>
          <div className="lp-effect-row">{tag && <span className="lp-effect" key={`t${tag.k}`} data-testid="game-effect">{tag.text}</span>}</div>
          <div style={{ position: 'relative' }}>
            {pop && <span className="lp-pop ds-num" key={`p${pop.k}`}>+{pop.v}</span>}
            <div className={`lp-card lp-game-card ${flash || ''}`} data-testid="game-card" data-answer={testing() ? item.side : undefined}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} key={`${idx}:${answers.length}`}
              style={{ transform: reduced || inst.kind !== 'swipe' ? undefined : `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: start.current != null || reduced ? 'none' : 'transform .2s' }}>
              <Inline nodes={item.text} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {sides.map((sd) => { const Icon = SIDE_ICON[sd]; return (
              <button key={sd} type="button" className="ds-opt lp-side" data-side={sd} onClick={() => decide(sd)}>
                {sd === 'right' ? <>{inst.labels[sd]} <Icon size={16} style={{ verticalAlign: -3 }} /></> : <><Icon size={16} style={{ verticalAlign: -3 }} /> {inst.labels[sd]}</>}
              </button>
            ); })}
          </div>
        </>
      )}
      {phase === 'over' && r && (
        <>
          {chart}
          <div className="lp-card lp-game-final" data-testid="game-final">
            <div className="ds-eyebrow">{r.timeBonus ? 'Все новости разобраны!' : 'Время!'}</div>
            <div className="ds-num" style={{ fontSize: 34, fontWeight: 700, color: 'var(--u-ink)' }}>{r.score}</div>
            <div style={{ fontSize: 16 }}>очков · верно {r.right} из {r.answered} · лучшая серия {r.bestRun}</div>
            {r.timeBonus > 0 && <div className="ds-sub" data-testid="game-time-bonus">в том числе +{r.timeBonus} за {r.timeBonus / GAME_TIME_BONUS} {plural(r.timeBonus / GAME_TIME_BONUS, 'секунду', 'секунды', 'секунд')} в запасе</div>}
            {(() => { const left = gameLeft(r.right, r.answered); const wrong = r.answered - r.right; return (
              <div className={`lp-verdict${left ? '' : ' ok'}`} data-testid="game-verdict" data-ok={String(!left)}>
                {left ? `Зачёта нет, не хватило ${left}: верных ${r.right}, ошибок ${wrong} — нужно, чтобы верных было на ${GAME_PASS} больше` : `Игра засчитана: верных ${r.right}, ошибок ${wrong}`}
              </div>
            ); })()}
            {r.record && <div className="ds-badge" style={{ marginTop: 6 }} data-testid="game-record">Новый рекорд!</div>}
          </div>
        </>
      )}
    </div>
  );
}
/* ------------------------------ «СБЕРЕГИ КОШЕЛЁК» ------------------------------
   Мини-игра юнита «Инфляция» (src/learn/wallet.js): пять лет, в каждом — полоса «Вестника» с
   новостью и прогнозом инфляции, шкала, где рядом прогноз и ставка банка, и три решения:
   наличными дома, во вклад, купить впрок. Год проигрывается на глазах: стрелка инфляции идёт по
   шкале, ценник чашки растёт, кошелёк пересчитывается, а чашки, на которые его хватает, гаснут
   или прибавляются. Разбор года — полоски реального итога трёх вариантов. В конце — путь
   сбережений по годам против «всё время наличными». */
const WALLET_OPT = {
  cash: { icon: Banknote, title: 'Наличными дома', hint: () => 'Крон останется столько же' },
  deposit: { icon: Landmark, title: 'Во вклад', hint: (y) => `Банк добавит ${y.r}% к сумме` },
  stock: { icon: ShoppingBasket, title: 'Купить впрок', hint: () => 'Кофе и крупы: дорожают вместе с ценами, но 3% в год портится' },
};
const OPT_NAME = { cash: 'держать наличными', deposit: 'положить во вклад', stock: 'купить впрок' };
const BAR_NAME = { cash: 'Наличные', deposit: 'Вклад', stock: 'Запас' };
const signPct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${String(Math.abs(v)).replace('.', ',')}%`;
const kr = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// шкала года: полоса прогноза инфляции, отметка ставки банка и, после хода, — сколько вышло
function RateScale({ year, pi = null }) {
  const [lo, hi] = FORECAST[year.level];
  const X = (v) => 12 + (Math.max(0, Math.min(25, v)) / 25) * 276;
  return (
    <svg viewBox="0 0 300 66" width="100%" className="lw-scale" role="img" data-testid="wallet-scale"
      aria-label={`Прогноз инфляции ${lo}–${hi}%, вклад ${year.r}%${pi != null ? `, вышло ${pi}%` : ''}`}>
      <line x1="12" x2="288" y1="30" y2="30" stroke="var(--ds-rule2)" strokeWidth="6" strokeLinecap="round" />
      <rect x={X(lo)} y="24" width={Math.max(6, X(hi) - X(lo))} height="12" rx="6" className="lw-band" />
      {/* деления — там, где их не закрывает подпись ставки */}
      {[0, 5, 10, 15, 20, 25].filter((v) => Math.abs(X(v) - X(year.r)) > 34).map((v) => <text key={v} x={X(v)} y="60" textAnchor="middle" className="lw-tick">{v}%</text>)}
      <g style={{ transform: `translateX(${X(year.r)}px)` }} data-testid="wallet-rate-mark">
        <path d="M0,38 l-6,9 h12 Z" className="lw-rate" />
        <text x="0" y="60" textAnchor="middle" className="lw-rate-t">вклад {year.r}%</text>
      </g>
      {pi != null && (
        <g style={{ transform: `translateX(${X(pi)}px)` }} className="lw-pi">
          <line x1="0" x2="0" y1="18" y2="42" strokeWidth="3" />
          <text x="0" y="13" textAnchor="middle">вышло {String(Math.round(pi * 10) / 10).replace('.', ',')}%</text>
        </g>
      )}
    </svg>
  );
}
// чашки, на которые хватает сбережений: 100 мест сеткой 20 × 5; сверх сотни — бейдж «+N»
// чашка на блюдце: корпус, ручка справа, блюдце снизу — узнаётся и в 12 пикселях
const CUP_BODY = 'M1.4,2.6 h7.6 l-.9,5.6 a1.3,1.3 0 0 1 -1.3,1.1 h-3.2 a1.3,1.3 0 0 1 -1.3,-1.1 Z';
const CUP_HANDLE = 'M8.8,3.9 h1.2 a1.6,1.6 0 0 1 0,3.2 h-1.6';
function Cups({ n }) {
  const on = Math.max(0, Math.min(100, Math.round(n)));
  return (
    <div className="lw-cups-wrap">
      <svg viewBox="0 0 280 72" className="lw-cups" role="img" aria-label={`Хватает на ${Math.round(n)} чашек`} data-testid="wallet-cups" data-cups={Math.round(n)}>
        {Array.from({ length: 100 }, (_, i) => (
          <g key={i} transform={`translate(${(i % 20) * 14},${Math.floor(i / 20) * 14 + 1})`} className={`lw-cup${i < on ? '' : ' off'}`}>
            <path d={CUP_BODY} className="b" /><path d={CUP_HANDLE} className="h" /><path d="M0.4,11 h9.8" className="h" />
          </g>
        ))}
      </svg>
      {n > 100.5 && <span className="lw-more">+{Math.round(n) - 100}</span>}
    </div>
  );
}
// разбор года: реальный итог трёх вариантов полосками от нуля; лучший — с галочкой
function YearBars({ year, picked }) {
  const vals = WALLET_OPTIONS.map((o) => ({ o, v: realPct(o, year.pi, year.r) }));
  const max = Math.max(4, ...vals.map((x) => Math.abs(x.v)));
  return (
    <div className="lw-bars" data-testid="wallet-bars">
      {vals.map(({ o, v }) => (
        <div key={o} className={`lw-bar-row${o === year.best ? ' best' : ''}${o === picked ? ' picked' : ''}`}>
          <span className="lw-bar-name">{o === year.best && <Check size={13} strokeWidth={3} aria-hidden="true" />}{BAR_NAME[o]}</span>
          <span className="lw-bar-track"><i className={v >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(v) / max) * 50}%`, [v >= 0 ? 'left' : 'right']: '50%' }} /></span>
          <b className="ds-num">{signPct(v)}</b>
        </div>
      ))}
    </div>
  );
}
// путь сбережений по годам: ваш против «всё время наличными»
function WalletPathChart({ years, choices }) {
  const mine = walletPath(years, choices).map((p) => p.cups);
  const cash = walletPath(years, years.map(() => 'cash')).map((p) => p.cups);
  const best = walletPath(years, years.map((y) => y.best)).map((p) => p.cups);
  const top = Math.max(110, ...mine, ...best); const bot = Math.min(60, ...cash);
  const W = 300; const H = 130; const X = (k) => 34 + (k / years.length) * (W - 46); const Y = (v) => 10 + ((top - v) / (top - bot)) * (H - 34);
  const line = (arr) => arr.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="lw-path" role="img" aria-label={`Чашек по годам: ${mine.map((v) => Math.round(v)).join(', ')}`} data-testid="wallet-path">
      <line x1="34" x2={W - 12} y1={Y(100)} y2={Y(100)} className="lw-path-100" />
      <text x="30" y={Y(100) + 4} textAnchor="end" className="lw-tick">100</text>
      <path d={line(cash)} className="lw-path-cash" />
      <path d={line(best)} className="lw-path-best" />
      <path d={line(mine)} className="lw-path-mine" />
      {mine.map((v, k) => <circle key={k} cx={X(k)} cy={Y(v)} r="3.6" className="lw-path-dot" />)}
      {years.map((y, k) => <text key={k} x={X(k + 1)} y={H - 6} textAnchor="middle" className="lw-tick">{choices[k] === y.best ? '✓' : '✗'} {k + 1}</text>)}
    </svg>
  );
}
export function WalletRound({ inst, onDone, locked, result = null, best = 0, intro = null }) {
  const reduced = useReducedMotion();
  const years = inst.years;
  const [phase, setPhase] = useState(locked ? 'over' : 'ready');
  const [k, setK] = useState(0);
  const [choices, setChoices] = useState(result && result.choices ? result.choices : []);
  const [t, setT] = useState(1);
  const done = useRef(false);
  // в тестах год можно проиграть быстрее
  const speed = testing() && window.__INFLATIA_GAME_SPEED__ ? Number(window.__INFLATIA_GAME_SPEED__) : 1;
  const path = walletPath(years, choices);
  const year = years[Math.min(k, years.length - 1)];
  const pick = (o) => {
    if (phase !== 'pick') return;
    Audio.play('paper');
    setChoices((c) => [...c.slice(0, k), o]);
    setPhase('reveal');
  };
  // год идёт около полутора секунд: стрелка инфляции, ценник, кошелёк, чашки
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    if (reduced) { setT(1); return undefined; }
    let raf = 0; const t0 = performance.now(); const ms = 1500 / speed;
    const step = (now) => { const v = Math.min(1, (now - t0) / ms); setT(v); if (v < 1) raf = requestAnimationFrame(step); };
    setT(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, k]);
  const revealed = phase === 'reveal' && t >= 1;
  useEffect(() => { if (revealed) Audio.play(choices[k] === year.best ? 'coin' : 'down'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);
  const finish = (all) => {
    if (done.current) return; done.current = true;
    const res = walletResult(years, all);
    setPhase('over');
    onDone({ ...res, done: true, choices: all, bestRun: res.right, record: res.score > best && res.score > 0 });
  };
  const next = () => {
    Audio.play('click');
    if (k + 1 >= years.length) { finish(choices); return; }
    setK(k + 1); setPhase('pick');
  };
  const ease = 1 - (1 - t) ** 3;
  const from = path[k]; const to = path[Math.min(k + 1, path.length - 1)];
  const lerp = (a, b) => a + (b - a) * (phase === 'reveal' ? ease : 0);
  const now = phase === 'reveal' ? { wallet: lerp(from.wallet, to.wallet), cup: lerp(from.cup, to.cup), cups: lerp(from.cups, to.cups) } : path[Math.min(k, path.length - 1)];
  const r = result || (phase === 'over' ? { ...walletResult(years, choices), record: false } : null);
  const strip = (
    <div className="lw-years" aria-label="Годы">
      {years.map((y, i) => <i key={i} className={i < choices.length && (i < k || revealed || phase === 'over') ? (choices[i] === y.best ? 'ok' : 'bad') : i === k && phase !== 'over' ? 'now' : ''} />)}
    </div>
  );
  return (
    <div data-testid="game" data-phase={phase} data-kind="wallet" className="lp-game lw">
      {phase === 'ready' && (
        <>
          {intro}
          <div className="lp-howto" data-testid="game-howto">
            <div className="ds-eyebrow">Как играть</div>
            <ol>
              <li>Каждый год «Вестник» даёт новость и прогноз: на сколько вырастут цены.</li>
              <li>Банк предлагает вклад. Сравните ставку с прогнозом — на шкале они рядом.</li>
              <li>Решите, где держать деньги год: наличными дома, во вкладе или купить впрок.</li>
              <li>Цель — чтобы сбережений хватало на столько же чашек. Зачёт — лучший выбор хотя бы в {WALLET.pass} годах из {WALLET.years}.</li>
            </ol>
          </div>
          <div className="lw-purse">
            <div><small>кошелёк</small><b className="ds-num">{kr(WALLET.start)}</b><small>крон</small></div>
            <div><small>чашка</small><b className="ds-num">{WALLET.cup}</b><small>крон</small></div>
            <div><small>хватит на</small><b className="ds-num">100</b><small>чашек</small></div>
          </div>
          <Cups n={100} />
          <div className="lp-game-rules ds-sub">
            <span><Timer size={14} aria-hidden="true" /> {WALLET.years} лет, без спешки</span>
            {best > 0 && <span data-testid="game-best"><Trophy size={14} aria-hidden="true" /> рекорд: {best} чашек</span>}
          </div>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="ds-btn" data-testid="game-start" onClick={() => { Audio.play('click'); setPhase('pick'); }}><Play size={16} style={{ verticalAlign: -3 }} /> Начать</button>
          </div>
        </>
      )}
      {(phase === 'pick' || phase === 'reveal') && (
        <div className="lw-year" key={k} data-testid="wallet-year" data-year={k + 1} data-best={testing() ? year.best : undefined}>
          {strip}
          <div className="lw-purse" aria-live="polite">
            <div><small>кошелёк</small><b className="ds-num" data-testid="wallet-sum">{kr(now.wallet)}</b><small>крон</small></div>
            <div className={phase === 'reveal' ? 'hot' : ''}><small>чашка</small><b className="ds-num" data-testid="wallet-cup">{kr(now.cup)}</b><small>крон</small></div>
            <div><small>хватит на</small><b className="ds-num">{Math.round(now.cups)}</b><small>чашек</small></div>
          </div>
          <Cups n={now.cups} />
          <div className="lw-paper">
            <div className="lw-mast">Вестник Инфляции · год {k + 1} из {years.length}</div>
            <div className="lw-head" data-testid="wallet-news"><Inline nodes={year.text} /></div>
            <div className="lw-fore"><Thermometer size={16} aria-hidden="true" />Прогноз: цены за год вырастут на {FORECAST[year.level][0]}–{FORECAST[year.level][1]}%</div>
          </div>
          <RateScale year={year} pi={phase === 'reveal' ? year.pi * ease : null} />
          {phase === 'pick' && (
            <div className="lw-opts" role="group" aria-label="Где держать деньги год">
              {WALLET_OPTIONS.map((o) => {
                const O = WALLET_OPT[o]; const Icon = O.icon;
                return (
                  <button key={o} type="button" className="lw-opt" data-testid="wallet-opt" data-opt={o} onClick={() => pick(o)}>
                    <span className="ic"><Icon size={20} aria-hidden="true" /></span>
                    <span><b>{o === 'deposit' ? `Во вклад под ${year.r}%` : O.title}</b><span className="h">{O.hint(year)}</span></span>
                  </button>
                );
              })}
            </div>
          )}
          {revealed && (
            <div className={`lw-verdict ${choices[k] === year.best ? 'ok' : 'bad'}`} data-testid="wallet-verdict" data-ok={String(choices[k] === year.best)}>
              <div className="lw-verdict-head">
                {choices[k] === year.best ? <><Check size={17} strokeWidth={3} aria-hidden="true" />Лучший выбор в этом году</> : <><X size={17} strokeWidth={3} aria-hidden="true" />Лучше было {OPT_NAME[year.best]}</>}
              </div>
              <div className="lw-verdict-text">
                Цены выросли на {year.pi}%. Вклад: ≈ {year.r} − {year.pi} = {signPct(year.r - year.pi)} реально. Запас теряет только порчу — 3%. Наличные — столько, сколько выросли цены.
              </div>
              <YearBars year={year} picked={choices[k]} />
              <Button wide data-testid="wallet-next" onClick={next} style={{ marginTop: 10 }}>{k + 1 >= years.length ? 'Итоги' : 'Следующий год'}</Button>
            </div>
          )}
        </div>
      )}
      {phase === 'over' && r && (
        <div className="lp-card lp-game-final lw-final" data-testid="game-final">
          <div className="ds-eyebrow">Через {years.length} лет</div>
          <div className="lw-final-num"><b className="ds-num">{r.cups}</b> {plural(r.cups, 'чашка', 'чашки', 'чашек')}<span className="ds-sub"> вместо 100 в начале</span></div>
          {(r.choices || choices).length === years.length && <WalletPathChart years={years} choices={r.choices || choices} />}
          <div className="lw-legend ds-sub"><span className="mine">ваш путь</span><span className="best">лучший выбор</span><span className="cash">всё время наличными</span></div>
          <div className={`lp-verdict${r.right >= WALLET.pass ? ' ok' : ''}`} data-testid="game-verdict" data-ok={String(r.right >= WALLET.pass)}>
            {r.right >= WALLET.pass ? `Игра засчитана: лучший выбор в ${r.right} ${plural(r.right, 'году', 'годах', 'годах')} из ${years.length}` : `Зачёта нет: лучший выбор в ${r.right} ${plural(r.right, 'году', 'годах', 'годах')} из ${years.length} — нужно хотя бы ${WALLET.pass}`}
          </div>
          {r.record && <div className="ds-badge" style={{ marginTop: 6 }} data-testid="game-record">Новый рекорд!</div>}
        </div>
      )}
    </div>
  );
}
/* ------------------------------ КАРТОЧКИ ВИДОВ УРОКОВ ------------------------------ */
const CAST_ICON = { coffee: Coffee, croissant: Croissant, landmark: Landmark, 'scroll-text': ScrollText, graduation: GraduationCap, radio: Radio, feather: Feather };
// причёски: у каждого героя своя
const HAIR = {
  vera: 'M19 27c0-10 6-15 13-15s13 5 13 15c-3-5-8-7-13-7s-10 2-13 7z',
  masha: 'M18 30c-1-12 6-18 14-18s15 6 14 18c-2-6-6-9-9-10-3 3-10 5-19 10z',
  host: 'M17 36c-2-14 5-23 15-23s17 9 15 23c-1-7-4-12-7-14-5 2-12 3-18 4-2 3-4 6-5 10z',
  timur: 'M20 25c0-8 5-12 12-12s12 4 12 12c-2-2-5-4-9-4l-1 3-2-3c-5 0-9 2-12 4z',
};
// портрет героя: лицо, причёска его цвета и значок его дела
export function Portrait({ who, size = 64 }) {
  const clip = `pt-${React.useId().replace(/:/g, '')}`;
  const c = CAST[who];
  if (!c) return null;
  const Icon = CAST_ICON[c.icon] || Coffee;
  // рассказчик — не человек в кадре: вместо лица перо
  if (c.nofs) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, borderRadius: '50%',
        background: `color-mix(in srgb, ${c.color} 12%, var(--ds-card))`, border: `2px solid ${c.color}`, color: c.color }} data-testid="portrait" data-who={who}>
        <Icon size={size * 0.46} aria-hidden="true" />
      </span>
    );
  }
  /* погрудный портрет в медальоне: плечи уходят за край круга, а не обрываются ровной линией
     посреди него; шея соединяет голову с телом */
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }} data-testid="portrait" data-who={who}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <defs><clipPath id={clip}><circle cx="32" cy="32" r="30" /></clipPath></defs>
        <circle cx="32" cy="32" r="31" fill={`color-mix(in srgb, ${c.color} 18%, white)`} />
        <g clipPath={`url(#${clip})`}>
          <path d="M28 36h8v9c-1.3 1.2-2.6 1.8-4 1.8s-2.7-.6-4-1.8z" fill="#E9BFA2" />
          <path d="M3 72c0-17 12.5-27.5 29-27.5S61 55 61 72z" fill={c.color} />
          <path d="M26.5 44.8l5.5 5.4 5.5-5.4" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
        <circle cx="32" cy="32" r="31" fill="none" stroke={c.color} strokeWidth="2" />
        <circle cx="32" cy="28" r="12.5" fill="#F6D2B8" />
        <path d={HAIR[who] || 'M20 24c1-7 6-10 12-10s11 3 12 10c-4-3-8-4-12-4s-8 1-12 4z'} fill={c.hair} />
        <circle cx="27.5" cy="29" r="1.6" fill="#3B2A20" /><circle cx="36.5" cy="29" r="1.6" fill="#3B2A20" />
        <path d="M28 34c2.4 2 5.6 2 8 0" stroke="#3B2A20" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.4, height: size * 0.4, borderRadius: '50%', background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--ds-card)' }}>
        <Icon size={size * 0.22} />
      </span>
    </span>
  );
}
export function StoryCard({ card, children }) {
  const c = CAST[card.who];
  return (
    <div data-style="story">
      {c && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Portrait who={card.who} size={64} />
          <div><div className="ds-h3" style={{ fontSize: 19 }}>{c.name}</div><div className="ds-sub" style={{ fontSize: 13.5 }}>{c.role}</div></div>
        </div>
      )}
      <div className="lp-bubble">{children}</div>
    </div>
  );
}

/* «Слова»: колода карточек. На карточке — слово, значение закрыто: сначала вспомнить, потом
   открыть (кнопка, касание карточки или пробел) и отметить «Знаю» или «Ещё раз». «Ещё раз»
   возвращает слово в конец колоды (один раз), «Знаю» — убирает. Можно и смахнуть:
   вправо — «Знаю», влево — «Ещё раз»; на клавиатуре — стрелки. Точки внизу — все слова урока. */
/* «Слова» — знакомство со словами, а не проверка (docs/mechanics.md): каждое слово сразу со
   значением и примером — до этого урока ученик мог его не встречать. Листать — «Дальше» и
   «Назад», стрелками или смахиванием: смахнуть в любую сторону — следующее слово (запоминать
   направление не нужно), вернуться — «Назад»; после последнего — лёгкие упражнения на эти слова. */
export function WordDeck({ cards, onDone, body, foot }) {
  const [idx, setIdx] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState(0); // карточка улетает: −1 влево, 1 вправо — в ту сторону, куда смахнули
  const [dir, setDir] = useState(0); // откуда въезжает новая: 1 — справа, −1 — слева
  const drag = useRef(null);
  const card = cards[idx];
  const last = idx === cards.length - 1;
  // from — откуда въезжает новая карточка: по умолчанию «дальше» справа, «назад» слева
  const go = (d, from = d) => {
    const n = idx + d;
    if (n < 0) return;
    Audio.play('paper'); setDx(0); setFly(0); setDir(from);
    if (n >= cards.length) { onDone(); return; }
    setIdx(n); setSeen((st) => new Set([...st, n]));
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!card) return null;
  /* смахнуть в любую сторону — следующее слово. Карточка едет за пальцем или мышью и наклоняется,
     сверху — «Дальше»; отпустили дальше порога — улетает в ту же сторону, а новая въезжает с
     другой; не дотянули — пружинит обратно. Назад — кнопкой «Назад» или стрелкой влево. */
  const onDown = (e) => {
    if (fly || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, mouse: e.pointerType === 'mouse' };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* старый браузер */ }
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setDx(e.clientX - drag.current.x);
  };
  const onUp = () => {
    if (!drag.current) return;
    const d = dx; const lim = drag.current.mouse ? 60 : 80; drag.current = null;
    if (Math.abs(d) <= lim) { setDx(0); return; }
    const side = d < 0 ? -1 : 1;
    setFly(side);
    setTimeout(() => go(1, -side), 190);
  };
  const style = fly ? { transform: `translateX(${fly * 130}%) rotate(${fly * 16}deg)`, opacity: 0, transition: 'transform .19s ease-in, opacity .19s ease-in' }
    : dx ? { transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: 'none' }
      : dir ? { '--from': `${dir * 60}px`, '--rise': '0px' } : undefined;
  const pull = Math.min(1, Math.abs(dx) / 80);
  return (
    <>
      {body(<>
      <div className="lp-deck">
        {!last && <div className="lp-deck-ghost" aria-hidden="true" />}
        <div className={`lp-word in${dx || fly ? ' drag' : ''}`} key={idx} style={style} data-testid="flash-card" data-word={idx} data-dx={Math.round(dx)}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDragStart={(e) => e.preventDefault()}>
          {dx !== 0 && <span className={`lp-swipe-tag ${dx < 0 ? 'next' : 'prev'}`} style={{ opacity: pull }} aria-hidden="true">{last ? 'К упражнениям' : 'Дальше'}</span>}
          <div className="lp-word-top">
            <span>Новое слово {idx + 1} из {cards.length}</span>
            <span style={{ flex: 1 }} />
            <span className="lp-word-hint" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}><span className="touch">смахните ↔</span><span className="fine">← → на клавиатуре</span></span>
          </div>
          <div className="lp-word-term">{card.title}</div>
          <div className="lp-word-rule" />
          <div className="lp-word-def open" data-testid="word-def"><span><Inline nodes={card.text} />{card.example && <span className="lp-word-ex"><b>Пример:</b> <Inline nodes={card.example} /></span>}</span></div>
          {idx === 0 && <div className="lp-word-tip" data-testid="word-tip">Прочитайте и запомните: после слов — пара лёгких упражнений на них.</div>}
        </div>
      </div>
      <div className="lp-word-dots" data-testid="word-dots" role="img" aria-label={`Прочитано слов: ${seen.size} из ${cards.length}`}>
        {cards.map((_, i) => <i key={i} className={`${seen.has(i) ? 'know' : ''} ${i === idx ? 'cur' : ''}`} />)}
      </div>
      </>)}
      {foot(
        <div style={{ display: 'grid', gridTemplateColumns: idx > 0 ? '1fr 2fr' : '1fr', gap: 10 }}>
          {idx > 0 && <Button variant="secondary" onClick={() => go(-1)} data-testid="word-prev">Назад</Button>}
          <Button onClick={() => go(1)} data-testid="word-next">{last ? 'К упражнениям' : 'Дальше'}</Button>
        </div>,
      )}
    </>
  );
}

/* Калькулятор расчётного упражнения: выражение, результат по ходу набора и «В ответ» —
   результат уходит в поле ответа. Подсказкой не считается: считать в уме никто не просит. */
export function Calculator({ onUse = null, disabled = false, useLabel = 'В ответ' }) {
  const [expr, setExpr] = useState('');
  const v = evalExpr(expr);
  const press = (k) => {
    if (disabled) return;
    Audio.play('tick');
    if (k === 'C') setExpr('');
    else if (k === 'del') setExpr((e) => e.slice(0, -1));
    else if (k === '=') { if (v != null) setExpr(fmtResult(v).replace('−', '-')); }
    else if (k === '√') setExpr((e) => pressRoot(e));
    else setExpr((e) => (e.length < 40 ? e + k : e));
  };
  /* Компактно, чтобы на телефоне задача и калькулятор помещались на один экран: экран в одну
     строку (выражение слева, результат справа), пять колонок клавиш, «стереть» и «очистить» —
     в той же сетке, «В ответ» — в последнем ряду. */
  const KEYS = [['7', '8', '9', '÷', 'del'], ['4', '5', '6', '×', 'C'], ['1', '2', '3', '−', '('], ['0', ',', '^', '+', ')'], ['√', '=']];
  const LABEL = { '÷': 'Разделить', '×': 'Умножить', '−': 'Вычесть', '+': 'Прибавить', '^': 'Степень', '√': 'Квадратный корень', '=': 'Равно', del: 'Стереть символ', C: 'Очистить' };
  return (
    <div className="lp-calc" data-testid="calculator">
      <div className="lp-calc-screen" aria-live="polite">
        <span className="ds-num lp-calc-expr" data-testid="calc-expr">{expr.replace(/-/g, '−') || ' '}</span>
        <span className="ds-num lp-calc-val" data-testid="calc-value">{v != null ? `= ${fmtResult(v)}` : expr ? '…' : '0'}</span>
      </div>
      <div className="lp-calc-keys" role="group" aria-label="Калькулятор">
        {KEYS.flat().map((k) => (
          <button key={k} type="button" className={`ds-key ${'÷×−+^√='.includes(k) ? 'lp-op' : ''}`} disabled={disabled} data-calc={k} aria-label={LABEL[k] || k}
            onClick={() => press(k === '÷' ? '/' : k === '×' ? '*' : k === '−' ? '-' : k)}>{k === 'del' ? <Delete size={18} aria-hidden="true" /> : k}</button>
        ))}
        {onUse && <button type="button" className="ds-btn lp-calc-use" disabled={disabled || v == null} data-testid="calc-use" onClick={() => { Audio.play('click'); onUse(fmtResult(v).replace('−', '-')); }}>{useLabel}</button>}
      </div>
    </div>
  );
}
