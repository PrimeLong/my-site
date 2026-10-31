/* ЭКРАНЫ НАГРАД И ПРОГРАММЫ: кошелёк, лавка с курсом дня, задания дня и испытание месяца,
   сундук юнита, утренний экран серии, печати-достижения, «Моя программа» в профиле и
   приглашение на вступительный тест. Всё — из компонентов дизайн-системы (src/ds.jsx,
   src/ds-art.jsx); расчёты — в чистых модулях src/learn/rewards.js и src/learn/program.js. */
import React, { useEffect, useRef, useState } from 'react';
import { trackDaily } from './lib/client.js';
import { loadAccount } from './account.jsx';
import { noScarcity } from './lib/age.js';
import {
  X, Wallet, ShieldCheck, CalendarDays, Check, Flame, GraduationCap, Timer, Map as MapIcon, Target, Coins, TrendingUp, TrendingDown, Minus, Gem, Zap,
  ListChecks, ChevronRight, Ghost, Crown, Lock, Plus, Store, Palette, Shirt, PiggyBank, ChevronDown,
} from 'lucide-react';
import { ACH_ICON } from './award-art.js';
import { Audio } from './MacroSimulator.jsx';
import { Mascot } from './mascot.jsx';
import { Button, IconButton, Card, Heading, Row, Sheet } from './ds.jsx';
import { halloween, seasonLeftText, WEB_FRAME } from './learn/halloween.js';
import { Rosette, Medal, CoinShower, CountUp, Chest, Guilloche } from './ds-art.jsx';
import { ShopSwitch, RateWeek } from './learn-rate.jsx';
import { featureOpen, FeatureLocked } from './learn-unlock.jsx';
import { DeskDecor } from './learn-decor.jsx';
import { SkinPreview, SKIN_CSS } from './learn-skins.jsx';
// сад — отдельный ленивый чанк: грузится, только когда открыли «Сад»
const GardenView = React.lazy(() => import('./learn-garden.jsx').then((m) => ({ default: m.GardenView })));
const DustGame = React.lazy(() => import('./learn-dust.jsx'));
import {
  balance, rateOn, rateHistory, priceOf, buy, setWear, outfitOf, deskOf, themeOf, FREEZE, BOOST, WARDROBE, OUTFIT_BY_ID, SLOT_LABEL, shopDay, boostActive, DEAL_OFF, questsFor, QUEST_ICON, monthChallenge, monthStamps, policyInfo, takePolicy, cancelPolicy, PREMIUM,
  chestCoins, chestKey, hasClaim, openChest, achievementsOf, coinsWord, plural, greetingAt, COIN, PIGGY, piggyState, piggyPut, piggyTake, piggyAdd, topupRate, piggyValue, forgone, REAL_RATE, realCurve, weekRate,
  goalCoins,
} from './learn/rewards.js';
import { skillLevel, LEVEL_NAME, LEVEL_TEXT } from './learn/program.js';
import { DUST, dustDone, dustItem } from './learn/dust.js';
import {
  dayOf, addDays, dayStart, streak, ownedFreezes, weekDots, rolloverLocal, setProfile, PROFILE_GOALS, PROFILE_MINUTES, PROFILE_GOAL_LABEL, goalMinutes, goalToday, pendingGoal,
} from './textbook/learn-state.js';

export const REWARD_CSS = `
  .rw-bar { height: 6px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .rw-bar > i { display: block; height: 100%; background: var(--u); border-radius: 3px; transition: width .3s ease-out; animation: rw-fill .8s cubic-bezier(.3,.8,.4,1) both; transform-origin: 0 50%; }
  @keyframes rw-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .rw-quest { animation: rw-in .35s ease-out both; }
  .rw-quest:nth-of-type(2) { animation-delay: .05s; } .rw-quest:nth-of-type(3) { animation-delay: .1s; } .rw-quest:nth-of-type(4) { animation-delay: .15s; }
  @keyframes rw-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .rw-ico.ok { animation: rw-ok .45s cubic-bezier(.3,1.6,.5,1) both; }
  @keyframes rw-ok { 0% { transform: scale(.6) } 100% { transform: scale(1) } }
  .rw-bar.ok > i { background: var(--ds-ok); }
  .rw-quest { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 0; border-top: 1px dotted var(--ds-rule2); }
  .rw-quest:first-of-type { border-top: none; }
  .rw-ico { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--ds-rule2); color: var(--u-ink); background: var(--ds-card); }
  .rw-tasks-entry { margin: 0 0 12px; padding: 12px 14px; }
  .rw-money { display: grid; gap: 8px; margin: 0 0 12px; font-size: 14px; line-height: 1.4; }
  .rw-money > div:not(.rw-money-rate) { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: center; }
  .rw-money-ico { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; }
  .rw-money-ico.coin { color: #8A6416; background: color-mix(in srgb, var(--ds-gold) 22%, var(--ds-card)); }
  .rw-money-ico.crown { color: #fff; background: color-mix(in srgb, var(--u) 85%, #000); }
  .ds-dark .rw-money-ico.coin { color: var(--ds-gold); }
  .rw-money-rate { font-size: 13px; color: var(--ds-ink2); margin-top: 6px; line-height: 1.4; }
  /* цель дня — отдельно от заданий: кольцо минут, а не четвёртая строка списка */
  .rw-goalbox { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 12px; margin: 0 -2px 12px;
    border-radius: 14px; background: color-mix(in srgb, var(--u) 9%, var(--ds-card)); animation: rw-in .35s ease-out both; }
  .rw-ring { position: relative; width: 52px; height: 52px; }
  /* поворот — только кольцу прогресса (дуга начинается сверху), не галочке внутри */
  .rw-ring > svg { display: block; transform: rotate(-90deg); }
  .rw-ring circle { fill: none; stroke-width: 6; }
  .rw-ring .bg { stroke: var(--ds-rule); }
  .rw-ring .fg { stroke: var(--u); stroke-linecap: round; transition: stroke-dashoffset .6s cubic-bezier(.3,.8,.4,1); animation: rw-ring 1s cubic-bezier(.3,.8,.4,1) both; }
  .rw-ring[data-ok="true"] .fg { stroke: var(--ds-ok); }
  .rw-ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 13px var(--ds-mono); color: var(--ds-ink); }
  @keyframes rw-ring { from { stroke-dashoffset: var(--len) } }
  .rw-qhead { display: flex; align-items: baseline; justify-content: space-between; padding-top: 2px; }
  .rw-ico.ok { background: var(--ds-ok-btn); border-color: var(--ds-ok-btn); color: #fff; }
  .rw-coin { font: 700 13px var(--ds-mono); color: var(--ds-ink2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .rw-page { position: fixed; inset: 0; z-index: 250; overflow-y: auto; background: var(--ds-paper); padding: 8px 16px calc(40px + env(safe-area-inset-bottom)); }
  .rw-page-in { max-width: 560px; margin: 0 auto; }
  .rw-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .rw-item { border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); padding: 10px 10px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule); }
  .rw-item[data-on="true"] { box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--u); }
  .rw-item { transition: transform .15s ease; }
  .rw-item:hover { transform: translateY(-2px); }
  /* гардероб — примерочная: Инфля в зеркале, вкладки по местам, плитки купленных вещей */
  .rw-ward { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 520px) { .rw-ward { grid-template-columns: 170px minmax(0, 1fr); align-items: start; } }
  .rw-mirror { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .rw-mirror-glass { width: 150px; height: 176px; border-radius: 75px 75px 18px 18px; display: grid; place-items: center;
    background: radial-gradient(ellipse at 40% 30%, color-mix(in srgb, #fff 55%, var(--ds-card)), var(--ds-card2) 70%);
    border: 6px solid #B8923A; box-shadow: inset 0 0 0 2px rgba(255,255,255,.6), 0 0 0 2px #7D5A10, 0 6px 14px var(--ds-shade); }
  .rw-worn { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 100%; }
  .rw-worn span { font: 12px var(--ds-sans); padding: 2px 8px; border-radius: 999px; background: var(--ds-card2); color: var(--ds-ink2); }
  .rw-slots { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .rw-slots button { border: 1.5px solid var(--ds-rule2); background: var(--ds-card); border-radius: 999px; padding: 7px 12px; min-height: 40px; font: 700 13.5px var(--ds-sans); color: var(--ds-ink2); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
  .rw-slots button[aria-selected="true"] { border-color: var(--u); color: var(--u-ink); background: var(--ds-sel); }
  .rw-slots button:disabled { opacity: .45; cursor: default; }
  .rw-slots b { font: 700 12px var(--ds-mono); }
  .rw-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
  .rw-tile { border: 1.5px solid var(--ds-rule2); border-radius: 8px; background: var(--ds-card); padding: 6px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; font: 700 12.5px/1.2 var(--ds-sans); color: var(--ds-ink); position: relative; min-height: 112px; }
  .rw-tile[aria-pressed="true"] { border-color: var(--u); box-shadow: 0 0 0 2px color-mix(in srgb, var(--u) 35%, transparent); }
  .rw-tile .rw-on { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--u); color: #fff; display: grid; place-items: center; }
  .rw-tile.none { color: var(--ds-ink3); justify-content: center; border-style: dashed; }
  .rw-price { font: 700 14px var(--ds-mono); }
  .rw-price small { font: 12px var(--ds-sans); color: var(--ds-ink3); margin-left: 4px; }
  .rw-dots { display: flex; justify-content: center; gap: 8px; }
  .rw-forgone { font-size: 12px; line-height: 1.25; color: var(--ds-ink3); }
  /* на ПК график не растягивается во всю карточку: подписи остаются размером с текст */
  .rw-piggy-chart { width: 100%; max-width: 460px; display: block; margin: 6px auto 2px; overflow: visible; }
  .rw-book { border: 1px solid var(--ds-rule2); border-radius: 14px; background: var(--ds-card); padding: 10px 12px 12px; }
  .rw-book-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font: 14.5px var(--ds-sans); padding: 3px 0; border-bottom: 1px dotted var(--ds-rule2); }
  .rw-book-row b { font-size: 16px; } .rw-book-row small { font: 12.5px var(--ds-mono); color: var(--ds-ok); }
  .rw-book-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 8px 0 2px; }
  .rw-book-days i { height: 8px; border-radius: 4px; background: var(--ds-rule); }
  .rw-book-days i.on { background: var(--u); animation: rw-fill .5s ease-out both; animation-delay: calc(var(--i) * 60ms); transform-origin: 0 50%; }
  .rw-book-days i.cur { background: color-mix(in srgb, var(--u) 35%, var(--ds-rule)); animation: rw-pulse 1.6s ease-in-out infinite; }
  @keyframes rw-pulse { 50% { opacity: .45 } }
  .rw-piggy-head { display: flex; align-items: center; gap: 12px; padding: 12px 14px 4px; background: linear-gradient(180deg, color-mix(in srgb, var(--u) 8%, var(--ds-card)), var(--ds-card)); }
  .rw-pig { flex: none; overflow: visible; }
  .rw-pig-coin { animation: rw-coin-drop .7s cubic-bezier(.5,0,.8,.5) both; }
  @keyframes rw-coin-drop { 0% { transform: translateY(-18px); opacity: 0 } 25% { opacity: 1 } 85% { transform: translateY(12px); opacity: 1 } 100% { transform: translateY(14px); opacity: 0 } }
  .rw-pig-in .spark { animation: rw-pop .4s cubic-bezier(.3,1.6,.5,1) both; animation-delay: calc(var(--i) * 90ms + .45s); transform-box: fill-box; transform-origin: center; }
  .rw-pig-peek { animation: rw-peek .5s .25s cubic-bezier(.3,1.5,.5,1) both; }
  @keyframes rw-peek { from { transform: translateY(8px) } }
  @keyframes rw-pop { from { transform: scale(0) } }
  /* забрали вклад: свинка подпрыгивает и встряхивается, из прорези фонтаном вылетают монеты, всплывает «+N»;
     раньше срока — сгоревший процент падает серыми монетками вниз */
  .rw-pig-box { position: relative; flex: none; line-height: 0; }
  .rw-pig-box.taking .rw-pig { animation: rw-pig-shake .95s cubic-bezier(.3,1.2,.5,1) both; transform-origin: 50% 92%; }
  @keyframes rw-pig-shake { 0% { transform: none } 14% { transform: translateY(3px) scale(1.06, .9) } 30% { transform: translateY(-9px) rotate(-7deg) } 46% { transform: translateY(-2px) rotate(6deg) } 62% { transform: rotate(-4deg) } 78% { transform: rotate(2deg) } 100% { transform: none } }
  .rw-pig-out { position: absolute; left: 31px; top: 11px; width: 13px; height: 13px; border-radius: 50%; pointer-events: none; opacity: 0;
    background: radial-gradient(circle at 35% 32%, #FFF3C4, #E3B23C 55%, #A8800F); box-shadow: inset 0 0 0 1.4px #8A6416;
    animation: rw-out 1s cubic-bezier(.2,.75,.35,1) both; animation-delay: calc(var(--i) * 65ms + .18s); }
  .rw-pig-out.lost { background: radial-gradient(circle at 35% 32%, #eee, #a7a29b 60%, #6f6a63); box-shadow: inset 0 0 0 1.4px #5f5a54; animation-name: rw-lost; animation-duration: 1.1s; }
  @keyframes rw-out { 0% { transform: translate(0, 0) scale(.3); opacity: 0 } 12% { opacity: 1 } 40% { transform: translate(calc(var(--dx) * .5), var(--up)) scale(1) rotate(160deg); animation-timing-function: cubic-bezier(.5, 0, .9, .6) } 85% { transform: translate(var(--dx), var(--dy)) scale(.9) rotate(380deg); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.9) rotate(380deg); opacity: 0 } }
  @keyframes rw-lost { 0% { transform: translate(0, 0) scale(.3); opacity: 0 } 15% { opacity: .9 } 35% { transform: translate(calc(var(--dx) * .4), -14px) scale(.9) } 100% { transform: translate(var(--dx), 46px) scale(.6) rotate(-120deg); opacity: 0 } }
  .rw-pig-plus { position: absolute; left: 50%; top: -4px; z-index: 1; transform: translateX(-50%); white-space: nowrap; pointer-events: none; line-height: 1.15; text-align: center;
    padding: 3px 10px; border-radius: 12px; background: var(--ds-card); border: 2px solid #E3B23C; box-shadow: 0 6px 14px -8px rgba(0,0,0,.45);
    font: 800 16px var(--ds-mono); color: #7A5600; animation: rw-plus 1.7s .4s ease-out both; }
  .ds-dark .rw-pig-plus { color: #F2C14E; }
  .rw-pig-plus small { display: block; font: 700 12px var(--ds-sans); color: var(--ds-ink2); }
  @keyframes rw-plus { 0% { opacity: 0; transform: translate(-50%, 12px) scale(.7) } 22% { opacity: 1; transform: translate(-50%, -6px) scale(1.1) } 75% { opacity: 1; transform: translate(-50%, -10px) scale(1) } 100% { opacity: 0; transform: translate(-50%, -16px) } }
  .rw-book-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font: 700 14px var(--ds-sans); }
  .rw-book-kind { padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--u) 12%, var(--ds-card)); color: var(--u-ink); }
  .rw-book-sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .rw-book-sum > div { padding: 8px 10px; border-radius: 12px; background: var(--ds-card2); }
  .rw-book-sum small { display: block; font: 12px/1.25 var(--ds-sans); color: var(--ds-ink2); }
  .rw-book-sum b { font-size: 19px; }
  .rw-book-sum .fin { background: color-mix(in srgb, var(--ds-ok) 12%, var(--ds-card)); }
  .rw-book-sum .fin b { color: var(--ds-ok-ink); }
  .rw-grow .axis { stroke: var(--ds-rule2); stroke-width: 1; }
  /* график вклада оживает по очереди: заливка проявляется, линия рисуется, точки выскакивают по дням */
  .rw-grow .area { fill: color-mix(in srgb, var(--u) 14%, transparent); stroke: none; animation: rw-area .9s ease-out .15s backwards; }
  .rw-grow .main { fill: none; stroke: var(--u); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; animation: rw-draw .9s ease-out backwards; }
  .rw-grow .other { fill: none; stroke: var(--ds-ink3); stroke-width: 1.8; stroke-dasharray: 4 4; animation: rw-area .6s ease-out .5s backwards; }
  .rw-grow .dot { fill: var(--ds-card); stroke: var(--u); stroke-width: 1.8; transform-box: fill-box; transform-origin: center;
    animation: rw-pop .35s cubic-bezier(.3, 1.6, .5, 1) backwards; animation-delay: calc(var(--i) * 90ms + .2s); }
  .rw-grow .dot.past { fill: var(--u); }
  .rw-grow .now line { stroke: var(--u-ink); stroke-width: 1; stroke-dasharray: 2 3; }
  .rw-grow .now rect { fill: var(--u); }
  .rw-grow .now text { font: 700 11px var(--ds-sans); fill: #fff; letter-spacing: .02em; }
  .rw-grow .now { animation: rw-drop .45s cubic-bezier(.3, 1.4, .5, 1) .7s backwards; }
  .rw-grow .now circle { fill: var(--u); stroke: var(--ds-card); stroke-width: 2.5; transform-box: fill-box; transform-origin: center; animation: rw-beat 1.6s ease-in-out infinite; }
  .rw-grow text { font: 600 11.5px var(--ds-sans); fill: var(--ds-ink2); }
  .rw-grow text.end { font: 700 14px var(--ds-mono); fill: var(--ds-ink); animation: rw-area .4s ease-out .9s backwards; }
  .rw-grow text.other-t { font-size: 12px; fill: var(--ds-ink3); }
  .rw-grow text.step { font: 700 11px var(--ds-mono); fill: var(--ds-ok-ink); animation: rw-area .4s ease-out 1s backwards; }
  @keyframes rw-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
  @keyframes rw-area { from { opacity: 0 } }
  @keyframes rw-drop { from { opacity: 0; transform: translateY(-8px) } }
  @keyframes rw-beat { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.25) } }
  .rw-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--ds-ink2); margin: -2px 0 6px; }
  .rw-legend span::before { content: ''; display: inline-block; width: 16px; height: 0; margin-right: 6px; vertical-align: middle; border-top: 3px solid var(--u); }
  .rw-legend .o::before { border-top: 2px dashed var(--ds-ink3); }
  .rw-presets { display: flex; gap: 6px; margin: 2px 0 4px; }
  /* вид вклада: срочный или пополняемый — две плитки со ставкой */
  .rw-kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 2px 0 10px; }
  .rw-kinds button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 11px; text-align: left; border: 2px solid var(--ds-rule2); border-radius: 14px; background: var(--ds-card); color: var(--ds-ink); font: 700 14px/1.25 var(--ds-sans); cursor: pointer; box-shadow: 0 3px 0 var(--ds-rule2); }
  .rw-kinds button small { font: 400 12.5px/1.3 var(--ds-sans); color: var(--ds-ink2); }
  .rw-kinds button b { font: 700 15px var(--ds-mono); color: var(--u-ink); }
  .rw-kinds button[aria-pressed="true"] { border-color: var(--u); background: color-mix(in srgb, var(--u) 10%, var(--ds-card)); box-shadow: 0 3px 0 color-mix(in srgb, var(--u) 60%, var(--ds-card)); }
  .rw-kinds .t { display: inline-flex; align-items: center; gap: 5px; }
  .rw-kinds .res { font: 400 13px var(--ds-mono); color: var(--ds-ink2); margin-top: 2px; }
  .rw-kinds .res em { font-style: normal; font-weight: 700; color: var(--ds-ink); font-size: 15px; }
  .rw-kinds .res i { font-style: normal; color: var(--ds-ok-ink); font-weight: 700; }
  .rw-add { margin: 4px 0 10px; padding: 10px 12px; border-radius: 14px; background: var(--ds-card2); }
  .rw-presets button { flex: 1; min-height: 36px; border: 1.5px solid var(--ds-rule2); border-radius: 999px; background: var(--ds-card2); font: 700 13.5px var(--ds-sans); color: var(--ds-ink2); cursor: pointer; }
  .rw-book .ds-btn { margin-top: 8px; }
  .rw-real { margin-top: 10px; padding-top: 8px; border-top: 1px dotted var(--ds-rule2); }
  .rw-real summary { cursor: pointer; font: 700 14px var(--ds-sans); color: var(--u-ink); }
  .rw-piggy-chart text { font: 600 11.5px var(--ds-sans); fill: var(--ds-ink2); }
  .rw-piggy-chart text.num { font: 700 12px var(--ds-mono); }
  .rw-piggy-chart text.end { paint-order: stroke; stroke: var(--ds-card); stroke-width: 4px; stroke-linejoin: round; }
  .rw-book-dayline { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 10px 0 6px; font: 600 13.5px var(--ds-sans); color: var(--ds-ink2); }
  .rw-book-dayline b { color: var(--ds-ink); }
  .rw-dot { width: 38px; display: flex; flex-direction: column; align-items: center; gap: 5px; font: 700 12px var(--ds-sans); color: var(--ds-ink2); }
  .rw-dot i { width: 34px; height: 34px; border-radius: 50%; border: 1.5px dashed var(--ds-rule2); display: flex; align-items: center; justify-content: center; color: var(--ds-ink3); }
  /* день с уроком — оттиск: кольцо цветом огня, внутри огонёк чернилами; ставится как печать */
  .rw-dot.done i { border: 2px solid var(--rw-fire, #C2531E); color: var(--rw-fire-ink, #8E3512); background: var(--rw-fire-tint, #FBE7D9);
    box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px color-mix(in srgb, var(--rw-fire, #C2531E) 45%, transparent);
    animation: rw-dot-press .42s cubic-bezier(.3,1.4,.5,1) both; animation-delay: calc(1.1s + var(--i, 0) * 80ms); }
  .rw-dot.frozen i { border: 2px solid #3E6FA8; color: #2B4F7A; background: color-mix(in srgb, #3E6FA8 12%, var(--ds-card));
    animation: rw-dot-press .42s cubic-bezier(.3,1.4,.5,1) both; animation-delay: calc(1.1s + var(--i, 0) * 80ms); }
  .rw-dot.today { color: var(--ds-ink); }
  .rw-dot.today:not(.done) i { border: 2px dashed var(--rw-fire, #C2531E); animation: rw-today 1.8s ease-in-out 1.8s infinite; }
  @keyframes rw-dot-press { 0% { transform: scale(1.5) rotate(-14deg); opacity: 0 } 60% { opacity: 1 } 100% { transform: none; opacity: 1 } }
  @keyframes rw-today { 0%, 100% { transform: none } 50% { transform: scale(1.08) } }
  .rw-stamps { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px 6px; justify-items: center; }
  .rw-stamp { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  /* ещё не полученная печать: блёклый серый оттиск, а подпись читается полным контрастом */
  .rw-stamp[data-got="false"] b { color: var(--ds-ink2); font-weight: 600; }
  .rw-stamp[data-got="false"] span { color: var(--ds-ink3); }
  .rw-stamp b { font: 700 12px/1.2 var(--ds-head); }
  .rw-stamp span { font: 12px/1.25 var(--ds-sans); color: var(--ds-ink2); }
  /* утренний экран серии — в языке сайта: бумажный билет с гильошной каймой, розетка-печать с огоньком,
     нарисованным чернилами (контур и штриховка, как гравюра), цифра шрифтом заголовков и неделя —
     оттисками печатей. Огонёк чуть дышит, розетка дорисовывается, оттиски дней ставятся по очереди */
  .rw-morning { --rw-fire: #C2531E; --rw-fire-ink: #8E3512; --rw-fire-tint: color-mix(in srgb, #E27A3A 16%, var(--ds-card));
    position: fixed; inset: 0; z-index: 320; display: flex; flex-direction: column; overflow: auto; background: var(--ds-paper); padding: 24px 20px calc(24px + env(safe-area-inset-bottom)); }
  .ds-dark .rw-morning, .rw-morning.ds-dark { --rw-fire: #F08A4B; --rw-fire-ink: #F3A877; --rw-fire-tint: color-mix(in srgb, #F08A4B 18%, var(--ds-card)); }
  .rw-morning-in { position: relative; flex: 1; max-width: 420px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; align-items: stretch; justify-content: center; text-align: center; }
  @media (min-width: 700px) { .rw-morning { justify-content: center; } .rw-morning-in { flex: 0 0 auto; } }
  .rw-ticket { position: relative; background: var(--ds-card); border: 2px solid var(--ds-rule2); border-radius: 18px; box-shadow: 0 3px 0 var(--ds-rule), inset 0 0 0 5px var(--ds-card), inset 0 0 0 6px var(--ds-rule);
    padding: 10px 6px; animation: rw-up .45s ease-out both; }
  .rw-ticket-in { padding: 6px 18px 4px; display: flex; flex-direction: column; align-items: center; }
  .rw-seal { position: relative; margin: 10px 0 2px; }
  .rw-seal > span > svg path, .rw-seal > span > svg circle { stroke-dasharray: 900; stroke-dashoffset: 900; animation: rw-draw 1.6s ease-out .15s forwards; }
  @keyframes rw-draw { to { stroke-dashoffset: 0; } }
  .rw-flame { display: block; overflow: visible; }
  .rw-flame .sway { transform-box: fill-box; transform-origin: 50% 100%; animation: rw-sway 3.2s ease-in-out 1s infinite; }
  @keyframes rw-sway { 0%, 100% { transform: none } 30% { transform: skewX(-2.5deg) scaleY(1.03) } 65% { transform: skewX(2deg) scaleY(.98) } }
  .rw-flame .rise { animation: rw-rise .7s cubic-bezier(.3,1.5,.5,1) .35s both; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes rw-rise { from { transform: scale(.4); opacity: 0 } }
  .rw-days { display: flex; justify-content: center; font: 800 76px/1 var(--ds-head); font-variant-numeric: tabular-nums; color: var(--rw-fire-ink); letter-spacing: -.01em; margin-top: 4px; }
  .rw-days span { display: inline-block; animation: rw-digit .5s cubic-bezier(.3,1.5,.5,1) both; animation-delay: calc(.6s + var(--i, 0) * 90ms); }
  @keyframes rw-digit { 0% { transform: translateY(-24px); opacity: 0 } 100% { transform: none; opacity: 1 } }
  .rw-days-label { font: 700 13px/1.2 var(--ds-sans); letter-spacing: .16em; text-transform: uppercase; color: var(--ds-ink2); margin-top: 6px; animation: rw-up .45s ease-out .8s both; }
  .rw-days-sub { font-size: 15px; line-height: 1.45; color: var(--ds-ink2); margin: 12px 0 14px; max-width: 300px; animation: rw-up .45s ease-out .9s both; }
  @keyframes rw-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  .rw-week { width: 100%; border-top: 1px dashed var(--ds-rule2); padding: 14px 0 6px; }
  .rw-dots { display: flex; justify-content: center; gap: 6px; }
  /* сундук при открытии чуть подпрыгивает и пружинит — без поворота и крена */
  .rw-chest-open { animation: rw-chest-pop .5s ease-out 1 both; transform-origin: 50% 90%; }
  @keyframes rw-chest-pop { 0% { transform: none; } 30% { transform: scale(1.08, .92); } 60% { transform: scale(.96, 1.05) translateY(-4px); } 100% { transform: none; } }
  .rw-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .rw-rate { width: 100%; height: 64px; display: block; touch-action: none; }
  /* палец ведёт по графику — подписи вокруг не выделяются и не всплывает меню «Копировать» */
  .rw-rate-box, .rw-piggy-chart { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .rw-item { position: relative; }
  .rw-deal { position: absolute; top: -8px; right: -6px; transform: rotate(6deg); background: var(--ds-bad-btn); color: #fff; font: 700 12px var(--ds-sans); letter-spacing: .04em; padding: 3px 7px; border-radius: 2px; box-shadow: 0 1px 2px var(--ds-shade); }
  .rw-rare.rw-season { background: linear-gradient(135deg, #3B2D52, #7B3FA0); }
  .rw-hw { margin: 4px -6px 6px; padding: 10px 6px 2px; border-radius: 18px; background: linear-gradient(180deg, color-mix(in srgb, #7B3FA0 10%, transparent), transparent 70%); }
  .rw-rare { position: absolute; top: -9px; left: -6px; transform: rotate(-6deg); display: inline-flex; align-items: center; gap: 3px; background: linear-gradient(135deg, #B3123F, #9B2C8F); color: #fff; font: 700 12px var(--ds-sans); letter-spacing: .06em; text-transform: uppercase; padding: 3px 8px; border-radius: 8px; box-shadow: 0 1px 3px var(--ds-shade); }
  /* редкая вещь: золотистая карточка, по ней пробегает блик, Инфля в ней крупнее */
  .rw-item[data-rare="true"] { border-color: #C9A43A;
    background: linear-gradient(110deg, transparent 35%, rgba(255, 246, 214, .75) 48%, transparent 61%) 0 0 / 260% 100% no-repeat, color-mix(in srgb, var(--ds-card) 84%, #E3B53C);
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--ds-card) 84%, #E3B53C), inset 0 0 0 4px #C9A43A, 0 2px 10px rgba(201, 164, 58, .28);
    animation: rw-shine 5s ease-in-out infinite; }
  .rw-item[data-rare="true"][data-owned="true"] { animation: none; }
  @keyframes rw-shine { 0%, 55% { background-position: 130% 0, 0 0 } 100% { background-position: -30% 0, 0 0 } }
  .rw-note { font: italic 12px/1.3 var(--ds-sans); color: var(--ds-ink2); }
  .rw-desk-items { grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); }
  .rw-desk-stage { width: 100%; border-radius: 4px; background: repeating-linear-gradient(0deg, transparent 0 15px, var(--ds-rule) 15px 16px), var(--ds-paper); padding-top: 4px; }
  .rw-desk-tag { background: linear-gradient(135deg, #2E5F8A, #4D7C0F); }
  .rw-theme-tag { background: linear-gradient(135deg, #0F6B4A, #3B2D8F); }
  /* лавка: кошелёк и курс сверху, вкладки отделов */
  .sh-head-card { margin: 0 0 12px; padding: 12px 14px; }
  .sh-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; }
  .sh-bal { font-size: 26px; font-weight: 700; line-height: 1.15; }
  .sh-bal span { font-size: 14.5px; }
  .sh-rate { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px; padding: 8px 12px; min-height: 48px; border: 1px solid var(--ds-rule2); border-radius: 12px;
    background: var(--ds-card2); color: var(--ds-ink); font: 14px var(--ds-sans); text-align: left; cursor: pointer; }
  .sh-rate:hover { border-color: var(--u); }
  .sh-rate-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sh-rate-k { font: 600 12px var(--ds-sans); letter-spacing: .05em; text-transform: uppercase; color: var(--ds-ink3); }
  .sh-rate-prev { font-size: 12.5px; color: var(--ds-ink2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .sh-chev { flex: none; color: var(--ds-ink3); transition: transform .2s ease; }
  .sh-rate[aria-expanded="true"] .sh-chev { transform: rotate(180deg); }
  .sh-more { margin-top: 12px; animation: rw-in .25s ease-out both; }
  .sh-tabs { display: flex; gap: 3px; padding: 4px; margin: 0 0 12px; border: 1px solid var(--ds-rule2); border-radius: 16px; background: var(--ds-card2); overflow-x: auto; scrollbar-width: none; }
  .sh-tabs::-webkit-scrollbar { display: none; }
  .sh-tab { position: relative; flex: 1 1 0; min-width: 58px; min-height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 4px;
    border: 0; border-radius: 12px; background: transparent; color: var(--ds-ink2); font: 600 12px/1.15 var(--ds-sans); white-space: nowrap; cursor: pointer; transition: background .15s ease, color .15s ease; }
  .sh-tab:hover { color: var(--ds-ink); }
  .sh-tab[aria-selected="true"] { background: var(--ds-card); color: var(--ds-ink); box-shadow: 0 1px 3px var(--ds-shade); }
  .sh-tab[aria-selected="true"] svg { color: var(--u-ink); }
  .sh-badge { position: absolute; top: 1px; right: 1px; display: inline-flex; align-items: center; font: 700 12px/1.2 var(--ds-sans); color: #fff; background: var(--ds-bad-btn); border-radius: 999px; padding: 0 5px; }
  .sh-badge.hw { background: #6B3FA0; padding: 2px 4px; }
  .sh-dot { position: absolute; top: 6px; right: calc(50% - 16px); width: 8px; height: 8px; border-radius: 50%; background: var(--ds-ok); box-shadow: 0 0 0 2px var(--ds-card2); }
  .sh-msg { margin: 0 0 12px; font-size: 14.5px; color: var(--ds-bad); }
  .sh-msg[data-ok="true"] { color: var(--ds-ok); }
  .sh-panel { animation: rw-in .25s ease-out both; }
  .sh-intro { margin: 0 0 12px; font-size: 14px; line-height: 1.4; color: var(--ds-ink2); }
  .rw-price s { color: var(--ds-ink3); font-weight: 400; margin-right: 4px; }
  .rw-goal { height: 5px; width: 100%; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .rw-goal > i { display: block; height: 100%; background: #8A2F45; }
  @media (prefers-reduced-motion: reduce) { .rw-ticket, .rw-seal svg *, .rw-flame *, .rw-days span, .rw-days-label, .rw-days-sub, .rw-dot i { animation: none !important; stroke-dashoffset: 0 !important; } }
  @media (prefers-reduced-motion: reduce) { .sh-panel, .sh-more, .rw-flame, .rw-chest-open, .rw-item[data-rare="true"], .rw-bar > i, .rw-quest, .rw-ico.ok, .rw-goalbox, .rw-ring .fg, .rw-book-days i, .rw-pig-coin, .rw-pig-in .spark, .rw-pig-peek, .rw-pig-box.taking .rw-pig, .rw-pig-plus, .rw-grow .main, .rw-grow .now circle, .rw-grow .area, .rw-grow .other, .rw-grow .dot, .rw-grow .now, .rw-grow text { animation: none; } .rw-grow .main { stroke-dasharray: none; } .rw-bar > i, .rw-item { transition: none; } }
`;

const Q_ICON = { timer: Timer, map: MapIcon, check: Check, target: Target, coins: Coins, flame: Flame, spark: Zap };
const fmtRate = (r) => r.toFixed(2).replace('.', ',');
const Bar = ({ have, target, ok }) => <div className={`rw-bar ${ok ? 'ok' : ''}`} role="presentation"><i style={{ width: `${Math.round((Math.min(have, target) / target) * 100)}%` }} /></div>;
const CoinTag = ({ n, testid }) => <span className="rw-coin" data-testid={testid}><Coins size={14} color="var(--ds-gold)" aria-hidden="true" />{n}</span>;

/* ------------------------------ КОШЕЛЁК ------------------------------ */
// монеты в кошельке; тратятся во вкладке «Лавка» нижней панели
export function WalletStat({ learn }) {
  const b = balance(learn);
  return (
    <span className="ln-stat" title="Монеты — тратятся во вкладке «Лавка»" data-testid="wallet">
      <Wallet size={17} color="var(--ds-gold)" aria-hidden="true" /><span className="ds-sr">Монеты: </span><span data-testid="wallet-balance">{b}</span>
    </span>
  );
}

/* Карточка «Задания» наверху Пути: сколько заданий дня сделано, цель в минутах и испытание
   месяца — одной строкой. Касание открывает экран заданий (задания дня, испытание, практика). */
export function TasksEntry({ learn, onOpen, now = Date.now() }) {
  const quests = questsFor(learn, now);
  const g = goalToday(learn, now);
  const m = monthChallenge(learn, now);
  const done = quests.filter((q) => q.done).length;
  const goalOk = g.done >= g.goal;
  const month = m.claimed ? 'выполнено' : m.waiting ? `с ${m.startsText}` : `${m.have} из ${m.target}`;
  const text = `Задания дня: ${done} из 3 · цель ${Math.min(g.done, g.goal)}/${g.goal} мин · испытание месяца ${month}`;
  return (
    <button type="button" className="ds-card ds-card--button rw-tasks-entry" data-testid="tasks-card" data-nav-target="tasks" aria-label={`Задания. ${text}`}
      onClick={() => { Audio.play('paper'); onOpen(); }}>
      <span className={`rw-ico ${done === 3 && goalOk ? 'ok' : ''}`}>{done === 3 && goalOk ? <Check size={16} aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15.5 }}>Задания</span>
        <span className="ds-sub" style={{ display: 'block', fontSize: 13, lineHeight: 1.35 }} data-testid="tasks-card-text">{text}</span>
      </span>
      <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------ ЗАДАНИЯ ДНЯ ------------------------------
   Цель дня (минуты) — отдельным блоком с кольцом, а не четвёртой строкой: раньше под заголовком
   «Задания дня 0/3» стояло четыре строки, и было непонятно, почему заданий четыре. */
function GoalRing({ have, goal }) {
  const r = 22; const len = 2 * Math.PI * r; const k = Math.min(1, have / goal);
  return (
    <span className="rw-ring" data-ok={String(have >= goal)} aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 52 52"><circle className="bg" cx="26" cy="26" r={r} />
        <circle className="fg" cx="26" cy="26" r={r} strokeDasharray={len} strokeDashoffset={len * (1 - k)} style={{ '--len': len }} /></svg>
      <b>{have >= goal ? <Check size={20} color="var(--ds-ok)" /> : Math.min(have, goal)}</b>
    </span>
  );
}
export function QuestsCard({ learn, now = Date.now(), testid = 'quests' }) {
  const quests = questsFor(learn, now);
  const g = goalToday(learn, now);
  const done = quests.filter((q) => q.done).length;
  const goalOk = g.done >= g.goal;
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid={testid}>
      {/* цель дня — минуты занятий: у всех своя скорость, а время честно сравнивается само с собой */}
      <div className="rw-goalbox" data-testid="goal-row" data-done={String(goalOk)}>
        <GoalRing have={g.done} goal={g.goal} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Цель дня: {g.goal} минут занятий</div>
          <div className="ds-sub" style={{ fontSize: 13 }}>{goalOk ? 'Выполнена — монеты уже в кошельке' : `Сделано ${Math.min(g.done, g.goal)} из ${g.goal} мин · осталось ${g.goal - g.done}`}</div>
        </div>
        <CoinTag n={`+${goalCoins(g.goal)}`} />
      </div>
      <div className="rw-qhead">
        <div className="ds-h3">Задания дня</div>
        <span className="ds-num ds-faint" style={{ fontSize: 13 }} data-testid="quests-done">{done} из 3</span>
      </div>
      <div className="ds-sub" style={{ fontSize: 12.5, margin: '-2px 0 6px' }} data-testid="quests-utc">Новые — в {rolloverLocal(now)} по вашему времени (полночь по Гринвичу)</div>
      <div>
        {quests.map((q) => {
          const Icon = Q_ICON[QUEST_ICON[q.id]] || Target;
          return (
            <div key={q.id} className="rw-quest" data-testid="quest" data-quest={q.id} data-done={String(q.done)}>
              <span className={`rw-ico ${q.done ? 'ok' : ''}`}>{q.done ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{q.title}</div>
                <Bar have={q.have} target={q.target} ok={q.done} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <CoinTag n={`+${q.coins}`} />
                <div className="ds-num ds-faint" style={{ fontSize: 12 }}>{q.have}/{q.target}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 6 }}>Все три задания — ещё +{COIN.allQuests}. Новые задания — завтра, с нуля.</div>
    </Card>
  );
}
// испытание месяца: цель от самого ученика (цель дня в минутах, прошлый месяц) — и откуда она взялась
export function MonthCard({ learn, now = Date.now() }) {
  const m = monthChallenge(learn, now);
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid="month" data-done={String(m.done)} data-kind={m.id || undefined} data-waiting={m.waiting ? 'true' : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <CalendarDays size={18} color="var(--u-ink)" aria-hidden="true" />
        <span className="ds-h3" style={{ flex: 1 }}>Испытание месяца</span>
        <CoinTag n={`+${m.coins}`} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }} data-testid="month-title">{m.title}</div>
      {m.waiting ? <div className="ds-faint" style={{ fontSize: 12, marginTop: 2 }} data-testid="month-why">{m.why}</div> : <>
      <Bar have={m.have} target={m.target} ok={m.done} />
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 4 }}>
        {m.claimed ? `Выполнено — марка «${m.name}» в альбоме.`
          : `${m.have} из ${m.target}${m.need ? ` · нужно ещё ${m.need} ${m.unit}` : ''} · до конца месяца ${m.daysLeft} ${plural(m.daysLeft, 'день', 'дня', 'дней')}${m.daysLeft === 1 ? ' — сегодня последний' : ''}`}
      </div>
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 2 }} data-testid="month-why">{m.why}</div>
      </>}
    </Card>
  );
}

/* ------------------------------ ГРАФИК КУРСА ------------------------------
   Одна линия за 14 дней, пунктир — 1,0 (крона = монета). Касание или наведение — день и курс. */
/* График курса: ширина рисунка — ширина экрана (иначе рисунок сжимается к середине, и
   наведение показывает не тот день). Подпись точки — «сегодня», «вчера», «позавчера»,
   «N дн. назад» и дата. */
const agoText = (n) => (n === 0 ? 'сегодня' : n === 1 ? 'вчера' : n === 2 ? 'позавчера' : `${n} ${plural(n, 'день', 'дня', 'дней')} назад`);
function RateChart({ hist }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(300);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width) || 300));
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 64; const pad = 8;
  const lo = Math.min(0.9, ...hist.map((h) => h.rate)); const hi = Math.max(1.1, ...hist.map((h) => h.rate));
  const x = (i) => pad + (i / (hist.length - 1)) * (W - pad * 2);
  const y = (r) => pad + (1 - (r - lo) / (hi - lo)) * (H - pad * 2);
  const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.rate).toFixed(1)}`).join(' ');
  // ближайшая к пальцу точка — в тех же координатах, в которых нарисована
  const pick = (e) => { const b = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; const k = Math.round(((px - pad) / (W - pad * 2)) * (hist.length - 1)); setHover(Math.max(0, Math.min(hist.length - 1, k))); };
  const h = hover != null ? hist[hover] : null;
  const last = hist.length - 1;
  /* подсказка не выходит за края графика: шире экрана документ — и телефон перемасштабирует
     страницу, нижняя панель «уезжает» вниз (было у правого края, где подпись длиннее) */
  const tip = useRef(null);
  const [tipW, setTipW] = useState(150);
  React.useLayoutEffect(() => { if (tip.current) setTipW(tip.current.offsetWidth); }, [hover]);
  const tipLeft = h ? Math.max(0, Math.min(W - tipW, x(hover) - tipW / 2)) : 0;
  return (
    <div className="rw-rate-box" style={{ position: 'relative' }} ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="rw-rate" role="img" data-testid="rate-chart"
        aria-label={`Курс за ${hist.length} дней: от ${fmtRate(Math.min(...hist.map((q) => q.rate)))} до ${fmtRate(Math.max(...hist.map((q) => q.rate)))} монеты за крону, сегодня ${fmtRate(hist[last].rate)}`}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        <line x1={pad} x2={W - pad} y1={y(1)} y2={y(1)} stroke="var(--ds-rule2)" strokeWidth="1" strokeDasharray="3 4" />
        <polyline points={pts} fill="none" stroke="var(--u-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hist.map((q, i) => <circle key={q.day} cx={x(i)} cy={y(q.rate)} r={i === last ? 4 : 1.8} fill="var(--u-ink)" stroke={i === last ? 'var(--ds-card)' : 'none'} strokeWidth="2" />)}
        {h && <><line x1={x(hover)} x2={x(hover)} y1={pad / 2} y2={H - pad / 2} stroke="var(--ds-ink3)" strokeWidth="1" /><circle cx={x(hover)} cy={y(h.rate)} r="4.5" fill="var(--u-ink)" stroke="var(--ds-card)" strokeWidth="2" /></>}
      </svg>
      {h && (
        <div ref={tip} className="ds-num" data-testid="rate-tip" style={{ position: 'absolute', top: -8, left: tipLeft, maxWidth: W, overflow: 'hidden', background: 'var(--ds-ink)', color: 'var(--ds-paper)', fontSize: 12, padding: '3px 6px', borderRadius: 2, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {agoText(last - hover)} · {h.day.slice(8)}.{h.day.slice(5, 7)} · {fmtRate(h.rate)}
        </div>
      )}
      <div className="ds-faint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>две недели назад</span><span>пунктир — 1,00</span><span>сегодня</span></div>
    </div>
  );
}

/* ------------------------------ ЛАВКА ------------------------------ */
// до полуночи по всемирному времени — когда обновится витрина
const untilMidnight = (now) => { const m = dayStart(now) + 24 * 3600000 - now; const hh = Math.floor(m / 3600000); const mm = Math.floor((m % 3600000) / 60000); return `${hh} ч ${mm} мин`; };
// карточка вещи: Инфля в ней, цена по курсу (со скидкой — старая зачёркнута), купить / надеть
function ShopItem({ o, learn, day, wear, b, onBuy, onToggle, deal = false, goal = false, hw = null, calm = false }) {
  const desk = o.slot === 'desk'; const theme = o.slot === 'theme';
  const owned = !!(learn.owned || {})[o.id]; const on = (desk ? deskOf(learn) : theme ? themeOf(learn) : wear[o.slot]) === o.id;
  const price = priceOf(o.id, day, learn); const full = priceOf(o.id, day);
  return (
    <div className="rw-item" data-testid="shop-item" data-item={o.id} data-owned={String(owned)} data-on={String(on)} data-deal={deal ? 'true' : undefined} data-rare={o.rare && !o.season ? 'true' : undefined} data-season={o.season || undefined}>
      {deal && !owned && !calm && <span className="rw-deal" data-testid="shop-deal">−{Math.round(DEAL_OFF * 100)}%</span>}
      {o.season ? <span className="rw-rare rw-season"><Ghost size={11} aria-hidden="true" />хеллоуин</span> : theme ? <span className="rw-rare rw-theme-tag"><Palette size={11} aria-hidden="true" />тема урока</span> : desk ? <span className="rw-rare rw-desk-tag"><Gem size={11} aria-hidden="true" />в урок</span> : o.rare && <span className="rw-rare"><Gem size={11} aria-hidden="true" />редкое</span>}
      {/* украшение урока — живое прямо на витрине: его можно потрогать до покупки */}
      {theme ? <SkinPreview id={o.id} /> : desk ? <div className="rw-desk-stage"><DeskDecor id={o.id} height={64} preview label={`${o.title}: потрогайте`} /></div>
        : <Mascot mood="hello" size={o.rare ? 62 : 50} outfit={{ [o.slot]: o.id }} label={`Инфля: ${o.title}`} />}
      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{o.title}</div>
      {o.note && <div className="rw-note">{o.note}</div>}
      {owned
        ? <Button small variant={on ? 'secondary' : 'primary'} onClick={() => onToggle(o)} data-testid={desk ? 'desk-toggle' : theme ? 'theme-toggle' : undefined}>{on ? (desk ? 'Убрать из уроков' : theme ? 'Выключить' : 'Снять') : (desk ? 'Повесить в уроки' : theme ? 'Включить в уроках' : 'Надеть')}</Button>
        : o.reward ? <>
          {/* награда события: не продаётся — собирается тыквами за уроки */}
          <div className="rw-forgone" data-testid="shop-reward">Не продаётся: {hw ? `тыкв ${hw.pumpkins} из ${hw.goal}` : 'награда за 13 тыкв'}</div>
          {hw && <div className="rw-goal" role="progressbar" aria-label="Собрано тыкв" aria-valuemin={0} aria-valuemax={hw.goal} aria-valuenow={hw.pumpkins}><i style={{ width: `${(hw.pumpkins / hw.goal) * 100}%` }} /></div>}
          <div className="ds-sub" style={{ fontSize: 12.5 }}>{hw && hw.ready ? 'Заберите её на Пути' : 'Каждый урок — тыква'}</div>
        </> : <>
          <div className="rw-price">{price < full && !calm && <s>{full}</s>}{price} <span style={{ fontWeight: 400 }}>мон.</span><small>{o.crowns} кр.</small></div>
          {/* цена отказа: чего стоит вещь, кроме монет */}
          <div className="rw-forgone" data-testid="shop-forgone" title={`Цена отказа: ${forgone(price).text} или +${forgone(price).week} в копилке за неделю`}>{forgone(price).text} · копилка дала бы +{forgone(price).week}</div>
          {goal && b < price && <div className="rw-goal" role="progressbar" aria-label="Накоплено на покупку" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor((b / price) * 100)}><i style={{ width: `${Math.min(100, (b / price) * 100)}%` }} /></div>}
          <Button small variant="secondary" disabled={b < price} onClick={() => onBuy(o.id)}>Купить</Button>
        </>}
    </div>
  );
}
/* «Страховка серии» — полис: взнос каждую неделю, второй пропуск в оплаченной неделе прощается.
   Видно, сколько уже заплачено и сколько дней полис спас: окупается ли страховка. */
const fmtDay = (d) => `${d.slice(8)}.${d.slice(5, 7)}`;
function PolicyCard({ learn, update, now, b, onMsg }) {
  const p = policyInfo(learn, now);
  const old = ownedFreezes(learn);
  const take = () => {
    const r = takePolicy(learn, now);
    if (!r.ok) { Audio.play('down'); onMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register'); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: r.price ? `Полис оформлен: первый взнос — ${r.price} ${coinsWord(r.price)}, дальше по ${PREMIUM} в неделю.` : 'Полис снова действует: эта неделя уже оплачена.' });
  };
  const cancel = () => { Audio.play('paper'); update((s) => cancelPolicy(s, now)); onMsg({ ok: true, text: `Полис расторгнут. Оплаченная неделя покрыта${p.paidUntil ? ` до ${fmtDay(p.paidUntil)}` : ''}.` }); };
  return (
    <Card style={{ margin: '8px 0 10px' }} data-testid="shop-freeze" data-policy={p.active ? 'on' : 'off'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Rosette size={54} opacity={0.5}><ShieldCheck size={24} color="#3E6FA8" aria-hidden="true" /></Rosette>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{FREEZE.title}{p.active && <span className="ds-badge" style={{ marginLeft: 6 }} data-testid="policy-on">полис действует</span>}</div>
          <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.35 }}>
            Взнос — <b>{PREMIUM} {coinsWord(PREMIUM)} в неделю</b>, сам в начале недели. В оплаченной неделе прощается ещё один пропуск сверх бесплатной поблажки — это страховой случай. Расторгнуть можно в любой момент.
          </div>
        </div>
      </div>
      <div className="ds-sub" style={{ fontSize: 13, margin: '8px 0 0', lineHeight: 1.4 }} data-testid="policy-stats">
        {p.active && p.paidUntil ? `Оплачено до ${fmtDay(p.paidUntil)}. ` : ''}Всего взносов: {p.paidTotal} {coinsWord(p.paidTotal)} · полис спас дней: {p.saved}{old ? ` · старых разовых полисов: ${old}` : ''}
      </div>
      {p.lapsed && <div role="status" data-testid="policy-lapsed" style={{ fontSize: 13.5, color: 'var(--ds-bad-ink)', marginTop: 6 }}>Полис прекращён: на взнос не хватило монет. Неоплаченная неделя не покрыта.</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        {p.active
          ? <Button small variant="secondary" onClick={cancel} data-testid="policy-cancel">Расторгнуть</Button>
          : <Button small disabled={b < PREMIUM} onClick={take} data-testid="policy-take">Оформить полис · {PREMIUM} мон.</Button>}
      </div>
    </Card>
  );
}
/* ГАРДЕРОБ — примерочная: Инфля в зеркале во всём надетом, вкладки по местам (голова, лицо,
   шея, в руке, рамка) и плитки купленных вещей. Касание плитки надевает вещь или снимает её,
   «Без вещи» — снять с этого места, «Снять всё» — всё сразу. Открыто место последней покупки. */
function Wardrobe({ learn, wear, onWear }) {
  const owned = learn.owned || {};
  const list = WARDROBE.filter((o) => owned[o.id]);
  const slots = Object.keys(SLOT_LABEL);
  const latest = list.slice().sort((a, b) => (owned[b.id] || 0) - (owned[a.id] || 0))[0];
  const [slot, setSlot] = useState(latest ? latest.slot : slots[0]);
  // новая покупка — сразу её место: купленную вещь видно и можно примерить
  const latestId = latest ? latest.id : null;
  useEffect(() => { if (latest) setSlot(latest.slot); }, [latestId]); // eslint-disable-line react-hooks/exhaustive-deps
  const here = list.filter((o) => o.slot === slot);
  const worn = slots.filter((k) => wear[k]).map((k) => OUTFIT_BY_ID[wear[k]]).filter(Boolean);
  return (
    <Card style={{ margin: '10px 0 16px' }} data-testid="shop-wardrobe">
      <div className="rw-ward">
        <div className="rw-mirror">
          <div className="rw-mirror-glass"><Mascot mood="joy" size={110} outfit={wear} label={worn.length ? `Инфля в зеркале: ${worn.map((o) => o.title).join(', ')}` : 'Инфля в зеркале, без нарядов'} /></div>
          <div className="rw-worn" data-testid="wardrobe-worn">{worn.length ? worn.map((o) => <span key={o.id}>{o.title}</span>) : <span>ничего не надето</span>}</div>
          {worn.length > 0 && <Button small variant="ghost" data-testid="wardrobe-clear" onClick={() => slots.forEach((k) => wear[k] && onWear(k, null))}>Снять всё</Button>}
        </div>
        <div style={{ minWidth: 0 }}>
          {list.length ? (
            <>
              <div className="rw-slots" role="tablist" aria-label="Место вещи">
                {slots.map((k) => {
                  const n = list.filter((o) => o.slot === k).length;
                  return <button key={k} type="button" role="tab" aria-selected={slot === k} disabled={!n} data-slot={k} onClick={() => { Audio.play('tick'); setSlot(k); }}>{SLOT_LABEL[k]} <b>{n}</b></button>;
                })}
              </div>
              <div className="rw-tiles" role="group" aria-label={`Вещи: ${SLOT_LABEL[slot].toLowerCase()}`}>
                <button type="button" className="rw-tile none" aria-pressed={!wear[slot]} data-testid="wardrobe-none" onClick={() => onWear(slot, null)}>Без вещи</button>
                {here.map((o) => {
                  const on = wear[o.slot] === o.id;
                  return (
                    <button key={o.id} type="button" className="rw-tile" aria-pressed={on} data-item={o.id} data-on={String(on)} onClick={() => onWear(o.slot, on ? null : o.id)}>
                      {on && <span className="rw-on" aria-hidden="true"><Check size={13} /></span>}
                      <Mascot mood="hello" size={50} outfit={{ [o.slot]: o.id }} label={`Инфля: ${o.title}`} />
                      <span>{o.title}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : <div className="ds-sub" style={{ fontSize: 14.5 }}>Пока пусто — купленные вещи будут здесь, и их можно будет примерить.</div>}
          <div className="ds-sub" style={{ fontSize: 13, marginTop: 10 }} data-testid="wardrobe-count">В гардеробе вещей: {list.length} из {WARDROBE.length}.</div>
        </div>
      </div>
    </Card>
  );
}

/* «Пыльная витрина» — карточка мини-игры на «Витрине» (src/learn-dust.jsx): окошко в пыли с протёртой
   полосой, сколько витрин оплачено сегодня и кнопка «Протереть» */
const DUST_CSS = `
  .sh-dust { display: flex; align-items: center; gap: 14px; margin: 4px 0 18px; padding: 14px; border-radius: 20px; color: #F6EEE2; position: relative; overflow: hidden;
    background: radial-gradient(120% 120% at 0% 0%, #4A3628, #21180F 70%); box-shadow: 0 16px 30px -22px rgba(0,0,0,.8); }
  .sh-dust-win { position: relative; flex: none; width: 74px; height: 92px; border-radius: 12px; padding: 5px; background: linear-gradient(145deg, #E2C084, #8A6532 40%, #D9B97D 60%, #6E4B22); }
  .sh-dust-win > div { position: relative; width: 100%; height: 100%; border-radius: 8px; overflow: hidden; display: grid; place-items: end center; padding-bottom: 6px;
    background: radial-gradient(80% 60% at 50% 30%, #FFF8E8, #C6A472); }
  .sh-dust-win > div::after { content: ''; position: absolute; inset: 0; background:
      radial-gradient(circle at 20% 30%, rgba(120,108,90,.35) 0 2px, transparent 3px) 0 0 / 9px 11px,
      linear-gradient(rgba(176,164,144,.88), rgba(150,138,118,.92));
    -webkit-mask: linear-gradient(118deg, #000 30%, transparent 36%, transparent 52%, #000 60%); mask: linear-gradient(118deg, #000 30%, transparent 36%, transparent 52%, #000 60%);
    animation: sh-dust-wipe 3.6s ease-in-out infinite; }
  @keyframes sh-dust-wipe { 0%, 100% { -webkit-mask-position: 0 0; mask-position: 0 0; } 50% { -webkit-mask-position: 12px 0; mask-position: 12px 0; } }
  .sh-dust-t { flex: 1; min-width: 0; }
  .sh-dust-t b { display: block; font: 700 17px var(--ds-head); }
  .sh-dust-t span { display: block; margin-top: 3px; font: 500 13.5px/1.4 var(--ds-sans); color: rgba(246,238,226,.78); }
  .sh-dust-dots { display: flex; gap: 5px; margin-top: 8px; }
  .sh-dust-dots i { width: 22px; height: 6px; border-radius: 3px; background: rgba(246,238,226,.18); }
  .sh-dust-dots i.on { background: #F3D98E; }
  .sh-dust .ds-btn { flex: none; }
  @media (max-width: 420px) { .sh-dust { flex-wrap: wrap; } .sh-dust .ds-btn { width: 100%; } }
  @media (prefers-reduced-motion: reduce) { .sh-dust-win > div::after { animation: none; } }
`;
function DustCard({ learn, onOpen }) {
  const done = dustDone(learn);
  const item = dustItem(learn, dayOf(Date.now()), done);
  return (
    <div className="sh-dust" data-testid="shop-dust" data-done={done}>
      <style>{DUST_CSS}</style>
      <div className="sh-dust-win" aria-hidden="true"><div><Mascot mood="hello" size={44} outfit={item ? { [OUTFIT_BY_ID[item].slot]: item } : outfitOf(learn)} /></div></div>
      <div className="sh-dust-t">
        <b>Пыльная витрина</b>
        <span>{done < DUST.perDay ? `Протрите стекло — под пылью новинка дня. За витрину — ${DUST.coins} ${coinsWord(DUST.coins)}.` : 'Монеты за сегодня собраны. Протирать можно и просто так.'}</span>
        <div className="sh-dust-dots" aria-label={`Сегодня протёрто ${Math.min(done, DUST.perDay)} из ${DUST.perDay}`} role="img">
          {Array.from({ length: DUST.perDay }, (_, k) => <i key={k} className={k < done ? 'on' : ''} />)}
        </div>
      </div>
      <Button small variant="warm" onClick={() => { Audio.play('paper'); onOpen(); }} data-testid="dust-open">Протереть</Button>
    </div>
  );
}
/* ЛАВКА — вкладки вместо одной длинной ленты (docs/mechanics.md, «Лавка»): сверху кошелёк и курс
   дня (касание — график и что такое кроны), ниже пять вкладок: «Витрина» (вещи дня, на Хеллоуин —
   и сезонные), «Для урока» (темы и украшения урока), «Ювелир» (редкое, на что копят), «Гардероб»
   (примерочная) и «Полезное» (копилка, страховка серии, двойной опыт). Вкладка помнится, пока
   открыто приложение; из уведомления «вклад созрел» лавка открывается на «Полезном». */
const SHOP_TABS = [
  { id: 'showcase', label: 'Витрина', icon: Store },
  { id: 'lesson', label: 'Для урока', icon: Palette },
  { id: 'rare', label: 'Ювелир', icon: Gem },
  { id: 'wardrobe', label: 'Гардероб', icon: Shirt },
  { id: 'useful', label: 'Полезное', icon: PiggyBank },
];
let lastShopTab = 'showcase';
export function ShopView({ learn, update, now = Date.now(), focus = null }) {
  // аналитика: раздел открыт — не чаще раза в день с устройства (docs/mechanics.md, «Аналитика»)
  useEffect(() => { trackDaily('shop_open'); }, []);
  const day = dayOf(now);
  const rate = rateOn(day); const prev = rateOn(addDays(day, -1));
  const [msg, setMsg] = useState(null);
  // «Лавка · Сад»: сад — в той же вкладке, переключателем вверху
  const [view, setView] = useState(focus === 'garden' ? 'garden' : 'shop');
  const [tab, setTabState] = useState(focus === 'piggy' ? 'useful' : lastShopTab);
  const [rateOpen, setRateOpen] = useState(false);
  const [dust, setDust] = useState(false);
  const setTab = (t) => { lastShopTab = t; setTabState(t); setMsg(null); };
  // из уведомления «вклад созрел» — сразу к копилке
  useEffect(() => {
    if (focus !== 'piggy') return undefined;
    lastShopTab = 'useful';
    const t = setTimeout(() => { const el = document.querySelector('[data-testid="shop-piggy"]'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
    return () => clearTimeout(t);
  }, [focus]);
  const b = balance(learn);
  const wear = outfitOf(learn);
  const today = shopDay(learn, day);
  const boosted = boostActive(learn, now);
  const pig = piggyState(learn, now);
  const Trend = rate > prev ? TrendingUp : rate < prev ? TrendingDown : Minus;
  const doBuy = (id) => {
    const r = buy(learn, id, now);
    if (!r.ok) { Audio.play('down'); setMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register');
    update(() => r.s, { settle: true });
    const slot = id === BOOST.id ? null : OUTFIT_BY_ID[id].slot;
    setMsg({ ok: true, text: id === BOOST.id ? `Двойной опыт на ${BOOST.minutes} минут — за ${r.price} ${coinsWord(r.price)}.`
      : slot === 'desk' ? `Куплено за ${r.price} ${coinsWord(r.price)} — украшение уже висит в уроках.`
        : slot === 'theme' ? `Куплено за ${r.price} ${coinsWord(r.price)} — тема уже включена: откройте любой урок.`
          : `Куплено за ${r.price} ${coinsWord(r.price)} — Инфля уже в обновке. Снять и переодеть — во вкладке «Гардероб».` });
  };
  const toggle = (o) => { Audio.play('paper'); update((s) => setWear(s, o.slot, (s.wear || {})[o.slot] === o.id ? null : o.id, now)); };
  const putOn = (slot, id) => { Audio.play('paper'); update((s) => setWear(s, slot, id, now)); };
  /* младше 16 (или возраст не известен) — без давления дефицитом: ни «−30%», ни зачёркнутой цены, ни отсчётов
     (docs/mechanics.md, «Хеллоуин»); скидка дня остаётся — просто без плашки */
  const calm = noScarcity((loadAccount() || {}).birthYear, now);
  const itemProps = { learn, day, wear, b, onBuy: doBuy, onToggle: toggle, calm };
  const dealOpen = today.deal && !(learn.owned || {})[today.deal];
  const hw = today.season.length > 0 ? halloween(learn, now) : null;
  return (
    <div className="ln-wrap" data-testid="shop" data-view={view} data-tab={view === 'shop' ? tab : undefined}>
      <div>
        <ShopSwitch view={view} onView={(v) => { Audio.play('paper'); setView(v); setMsg(null); }} learn={learn} gardenLocked={!featureOpen(learn, 'garden')} />
        {/* сад и копилка открываются не сразу (src/learn/unlocks.js): до того — карточка «откроется после N-го урока» */}
        {view === 'garden' ? (featureOpen(learn, 'garden')
          ? <React.Suspense fallback={<div className="ds-sub" style={{ padding: 20 }}>Сад загружается…</div>}><GardenView learn={learn} update={update} /></React.Suspense>
          : <FeatureLocked id="garden" learn={learn} />) : <>
        <Card className="sh-head-card" data-testid="rate">
          <div className="sh-head">
            <Mascot mood="joy" size={52} outfit={wear} />
            <div style={{ minWidth: 0 }}>
              <div className="ds-eyebrow">В кошельке</div>
              <div className="ds-num sh-bal" data-testid="shop-balance">{b} <span>{coinsWord(b)}</span></div>
            </div>
          </div>
          <button type="button" className="sh-rate" aria-expanded={rateOpen} data-testid="rate-toggle" onClick={() => { Audio.play('paper'); setRateOpen((v) => !v); }}>
            <span className="sh-rate-main">
              <span className="sh-rate-k">Курс дня</span>
              <b className="ds-num" data-testid="rate-value">1 крона = {fmtRate(rate)} монеты</b>
            </span>
            <span className="ds-num sh-rate-prev"><Trend size={14} aria-hidden="true" />вчера {fmtRate(prev)}</span>
            <ChevronDown size={18} className="sh-chev" aria-hidden="true" />
          </button>
          {rateOpen && (
            <div className="sh-more" data-testid="rate-more">
              {/* новичок не знает, что такое кроны и «кр.»: две строки — что своё, что чужое, и как одно меняется на другое */}
              <div className="rw-money" data-testid="coins-crowns">
                <div><span className="rw-money-ico coin"><Coins size={17} aria-hidden="true" /></span>
                  <span><b>Монеты</b> — ваши: за уроки, серию, задания и печати.</span></div>
                <div><span className="rw-money-ico crown"><Crown size={17} aria-hidden="true" /></span>
                  <span><b>Кроны (кр.)</b> — деньги страны Инфляции, где живут герои уроков. В них назначены цены — как в настоящем магазине.</span></div>
              </div>
              <RateChart hist={rateHistory(day, 14)} />
              <div className="rw-money-rate">Платите монетами по курсу дня. Курс ниже — покупка дешевле: можно подождать удачного дня.</div>
            </div>
          )}
        </Card>

        <div className="sh-tabs" role="tablist" aria-label="Отделы лавки" data-testid="shop-tabs">
          {SHOP_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" role="tab" className="sh-tab" aria-selected={tab === t.id} data-testid="shop-tab" data-tab={t.id}
                onClick={() => { if (tab !== t.id) { Audio.play('paper'); setTab(t.id); } }}>
                <Icon size={19} aria-hidden="true" /><span>{t.label}</span>
                {t.id === 'showcase' && dealOpen && !calm && <span className="sh-badge" aria-label="скидка дня">−{Math.round(DEAL_OFF * 100)}%</span>}
                {t.id === 'showcase' && (!dealOpen || calm) && hw && <span className="sh-badge hw" aria-label="хеллоуин"><Ghost size={10} aria-hidden="true" /></span>}
                {t.id === 'useful' && pig && pig.ripe && <span className="sh-dot" aria-label="вклад созрел" />}
              </button>
            );
          })}
        </div>
        {msg && <div role="status" data-testid="shop-msg" className="sh-msg" data-ok={String(msg.ok)}>{msg.text}</div>}

        <div className="sh-panel" role="tabpanel" key={tab} data-testid="shop-panel" data-tab={tab}>
          {tab === 'showcase' && <>
            {hw && (
              <div className="rw-hw" data-testid="shop-halloween">
                <Heading level={3} title="Хеллоуинская витрина" sub={calm ? 'Хеллоуинские вещи для Инфли. Купленное остаётся навсегда.' : `Только на Хеллоуин — ${seasonLeftText(hw)}, потом через год. Купленное остаётся навсегда.`} />
                <div className="rw-items" style={{ margin: '10px 0 16px' }}>
                  {[...today.season, WEB_FRAME].map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} goal={OUTFIT_BY_ID[id].rare} hw={hw} {...itemProps} />)}
                </div>
              </div>
            )}
            <Heading level={3} title="Витрина дня" sub={calm ? 'Каждый день — новые вещи.' : `Обновится через ${untilMidnight(now)} — в ${rolloverLocal(now)} по вашему времени (полночь по Гринвичу). На одну вещь — скидка дня ${Math.round(DEAL_OFF * 100)}%.`} />
            <div className="rw-items" style={{ margin: '10px 0 16px' }} data-testid="shop-showcase">
              {today.showcase.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} deal={id === today.deal} {...itemProps} />)}
              {!today.showcase.length && <div className="ds-sub" style={{ gridColumn: '1 / -1', fontSize: 14.5 }}>Всё обычное уже ваше — дальше вкладки «Ювелир» и «Для урока».</div>}
            </div>
            <DustCard learn={learn} onOpen={() => setDust(true)} />
          </>}

          {tab === 'lesson' && <>
            <style>{SKIN_CSS}</style>
            <p className="sh-intro">Не для Инфли, а для самих уроков. Тема меняет урок целиком, украшение висит над заданием. Включить и выключить — здесь же, в любой момент.</p>
            <Heading level={3} title="Темы урока" sub="Живой фон, свои кнопки вариантов и отклик на каждый ответ. Включена может быть одна тема." />
            <div className="rw-items rw-desk-items" style={{ margin: '10px 0 18px' }} data-testid="shop-themes">
              {today.theme.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} goal {...itemProps} />)}
            </div>
            <Heading level={3} title="Украшения урока" sub="Висят над заданием: живые — их можно потрогать, и они отзываются на ваши ответы." />
            <div className="rw-items rw-desk-items" style={{ margin: '10px 0 16px' }} data-testid="shop-desk">
              {today.desk.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} goal {...itemProps} />)}
            </div>
          </>}

          {tab === 'rare' && <>
            <Heading level={3} title="Витрина ювелира" sub="Редкие вещи для Инфли — всегда здесь. На них копят: полоска показывает, сколько уже собрано." />
            <div className="rw-items" style={{ margin: '10px 0 16px' }} data-testid="shop-rare">
              {today.rare.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} goal {...itemProps} />)}
            </div>
          </>}

          {tab === 'wardrobe' && <>
            <p className="sh-intro">Примерочная: по одной вещи на голову, лицо, шею, в руку и рамку. Касание — надеть или снять.</p>
            <Wardrobe learn={learn} wear={wear} onWear={putOn} />
          </>}

          {tab === 'useful' && <>
            <p className="sh-intro">Не вещи, а сделки: вклад под процент, страховка серии и двойной опыт.</p>
            {featureOpen(learn, 'piggy') ? <PiggyCard learn={learn} update={update} now={now} b={b} onMsg={setMsg} /> : <FeatureLocked id="piggy" learn={learn} compact />}
            <PolicyCard learn={learn} update={update} now={now} b={b} onMsg={setMsg} />
            <Card style={{ margin: '0 0 16px' }} data-testid="shop-boost">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Rosette size={54} opacity={0.5}><Zap size={24} color="var(--ds-gold)" aria-hidden="true" /></Rosette>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{BOOST.title}{boosted && <span className="ds-badge" style={{ marginLeft: 6 }} data-testid="boost-on">действует до {new Date(learn.boost).toTimeString().slice(0, 5)}</span>}</div>
                  <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.35 }}>{BOOST.text}</div>
                  <div className="rw-price">{priceOf(BOOST.id, day)} <span style={{ fontWeight: 400 }}>мон.</span><small>{BOOST.crowns} кр.</small></div>
                </div>
                <Button small disabled={boosted} onClick={() => doBuy(BOOST.id)} data-testid="buy-boost">Купить</Button>
              </div>
            </Card>
          </>}
        </div>
        </>}
      </div>
      {dust && (
        <React.Suspense fallback={null}>
          <DustGame learn={learn} update={update} onClose={() => setDust(false)} onShowcase={() => { setDust(false); setView('shop'); setTab('showcase'); }} />
        </React.Suspense>
      )}
    </div>
  );
}

/* ------------------------------ КОПИЛКА ИНФЛИ ------------------------------
   Сберкнижка: положить монеты на неделю под ставку недели; рост по дням — столбики, каждый чуть
   выше прошлого не на одно и то же число, а на процент от уже накопленного. Забрать раньше —
   процент сгорит. Ставка и что она значит для сада — плашка «Ставка недели» сверху. */
const fmtPct = (r) => `${String(Math.round(r * 1000) / 10).replace('.', ',')}%`;
/* Рост вклада за неделю — на ОБЩЕЙ шкале для обоих видов вклада: выбранный вклад — яркая линия
   с заливкой, другой вид — пунктир рядом. Открытый вклад — его настоящий путь по дням (path):
   пополнение — ступенька вверх с подписью «+N», точка «сейчас» и плашка «сейчас» над графиком.
   Подписи снизу — только «начало»/«сегодня» и «через 7 дней»: «сейчас» наверху их не задевает. Итог —
   над концом линии, внутри графика (а не справа от него: длинное число съедало поле, и справа был
   большой пустой отступ); итог другого вида — под концом пунктира. */
function PiggyChart({ amount, rate, other = null, day = null, path = null, steps = [] }) {
  const W = 300; const H = 134; const L = 10; const R = 10; const T = 28; const B = 24; const N = PIGGY.days;
  const curve = (r) => Array.from({ length: N + 1 }, (_, d) => amount * (1 + r) ** d);
  const vals = path || curve(rate);
  const otherVals = other != null ? curve(other) : null;
  const end = vals[N]; const otherEnd = otherVals ? otherVals[N] : null;
  const base = Math.min(vals[0], otherVals ? otherVals[0] : vals[0]);
  const top = Math.max(end, otherEnd || 0);
  const x = (d) => L + (d / N) * (W - L - R);
  const y = (v) => H - B - ((v - base) / Math.max(1e-9, top - base)) * (H - T - B);
  const line = (list) => list.map((v, d) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0)},${H - B} ${line(vals)} ${x(N)},${H - B}`;
  const endY = y(end); const otherY = otherEnd != null ? y(otherEnd) : null;
  // итог — над концом линии; итог другого вида — под концом пунктира (но не ниже оси)
  const endLabelY = endY - 10;
  const otherLabelY = otherY != null ? Math.min(otherY + 16, H - B - 4) : null;
  const live = day != null && day < N;
  // плашка «сейчас» у правого края не наезжает на итог над концом линии: сдвигается левее него
  const endW = String(Math.floor(end + 1e-9)).length * 7.5 + 4;
  const nowMax = endLabelY < T + 4 ? x(N) - 4 - endW - 28 : W - R - 26;
  const nowX = live ? Math.min(nowMax, Math.max(L + 26, x(day))) : 0;
  return (
    <svg className="rw-piggy-chart rw-grow" viewBox={`0 0 ${W} ${H}`} role="img" data-testid="piggy-chart"
      aria-label={`${amount} под ${fmtPct(rate)} в день: через неделю ${Math.floor(end + 1e-9)}${otherEnd != null ? `; другой вид вклада — ${Math.floor(otherEnd + 1e-9)}` : ''}`}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis" />
      {vals.map((_, d) => <line key={d} x1={x(d)} x2={x(d)} y1={H - B} y2={H - B + 4} className="axis" />)}
      {otherVals && <polyline points={line(otherVals)} className="other" />}
      <polygon points={area} className="area" />
      <polyline points={line(vals)} className="main" pathLength="1" />
      {vals.map((v, d) => <circle key={d} cx={x(d)} cy={y(v)} r={d === N ? 4.4 : 2.6} className={`dot${day != null && d <= day ? ' past' : ''}`} style={{ '--i': d }} />)}
      {steps.map((st) => <text key={st.day} x={x(st.day)} y={y(vals[st.day]) - 9} textAnchor="middle" className="step" data-testid="piggy-step">+{st.n}</text>)}
      {live && (
        <g className="now" data-testid="piggy-now">
          <line x1={x(day)} x2={x(day)} y1={T - 6} y2={H - B} />
          <rect x={nowX - 24} y={2} width={48} height={18} rx={9} />
          <text x={nowX} y={15} textAnchor="middle">сейчас</text>
          <circle cx={x(day)} cy={y(vals[day])} r="5.5" />
        </g>
      )}
      <text x={x(N) - 4} y={endLabelY} textAnchor="end" className="end num">{Math.floor(end + 1e-9)}</text>
      {otherEnd != null && <text x={x(N) - 4} y={otherLabelY} textAnchor="end" className="end other-t num">{Math.floor(otherEnd + 1e-9)}</text>}
      <text x={x(0)} y={H - 6} textAnchor="start">{path ? 'начало' : 'сегодня'}</text>
      <text x={x(N)} y={H - 6} textAnchor="end">через {N} дней</text>
    </svg>
  );
}
/* Честно про проценты: ставка в день — сотни процентов годовых, такого не бывает; а вот реальные
   8% годовых — 1000 крон за 10 лет (docs/mechanics.md). Свёрнуто: «Это много или мало?» */
function RealRate({ rate }) {
  const pts = realCurve();
  const W = 300; const H = 70; const pad = 14; const top = pts[pts.length - 1].value;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => H - 14 - ((v - 900) / (top - 900)) * (H - 30);
  return (
    <details className="rw-real" data-testid="piggy-real">
      <summary>Это много или мало?</summary>
      <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.4, marginTop: 6 }}>
        {fmtPct(rate)} в день ≈ {Math.round(rate * 365 * 100)}% годовых — в жизни так не бывает, а вот как выглядят реальные {Math.round(REAL_RATE * 100)}% годовых:
      </div>
      <svg className="rw-piggy-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`1000 крон под ${Math.round(REAL_RATE * 100)}% годовых: через 10 лет ${top}`}>
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--u-ink)" strokeWidth="1.6" />
        {pts.map((p, i) => <circle key={p.year} cx={x(i)} cy={y(p.value)} r={i === 0 || i === pts.length - 1 ? 2.6 : 1.4} fill="var(--u-ink)" />)}
        <text x={x(0)} y={y(1000) - 7} textAnchor="start" className="num">1000</text>
        <text x={x(pts.length - 1)} y={y(top) - 7} textAnchor="end" className="num">{top}</text>
        <text x={x(0)} y={H - 2} textAnchor="start">сейчас</text>
        <text x={x(pts.length - 1)} y={H - 2} textAnchor="end">через 10 лет</text>
      </svg>
    </details>
  );
}
const PRESETS = [['¼', 0.25], ['½', 0.5], ['Всё', 1]];
/* Копилка-свинка: монета падает в прорезь, когда кладёте; пока вклад лежит — монета выглядывает из
   прорези и рядом искорки. Свинка розовая и улыбается (жалоба: прежняя, зелёная и с хвостом-клином,
   выглядела страшно), цвета свои — не цвет юнита. */
const PIG = { body: '#F8BACA', far: '#EE9CB0', ear: '#F4A7BA', snout: '#F49AB0', line: '#A84E68', ink: '#5A2434' };
// монеты, вылетающие при «Забрать»: фонтаном из прорези и рассыпаются у ног свинки; число — от суммы, 3…9
const outCoins = (payout, lost) => {
  const n = Math.max(3, Math.min(9, Math.round(payout / 15)));
  const gold = Array.from({ length: n }, (_, i) => ({ i, dx: (i % 2 ? 1 : -1) * (10 + ((i * 17) % 40)) + 8, up: -14 - ((i * 11) % 16), dy: 30 + ((i * 7) % 12) }));
  const grey = lost ? Array.from({ length: Math.min(3, Math.max(1, Math.round(lost / 10))) }, (_, i) => ({ i: n + i, dx: -22 + i * 16, lost: true })) : [];
  return [...gold, ...grey];
};
function PiggyArt({ full = false, drop = 0, out = null }) {
  const clip = `pig${React.useId().replace(/:/g, '')}`;
  const leg = (x, fill) => <rect x={x} y="44" width="7.5" height="15" rx="3.4" fill={fill} stroke={PIG.line} strokeWidth="2" />;
  const ear = (d) => <path d={d} fill={PIG.ear} stroke={PIG.line} strokeWidth="2" strokeLinejoin="round" />;
  return (
    <span className={`rw-pig-box${out ? ' taking' : ''}`} data-testid="piggy-art" data-taking={out ? 'true' : undefined}>
    {out && (
      <React.Fragment key={out.k}>
        {outCoins(out.payout, out.lost).map((c) => (
          <i key={c.i} className={`rw-pig-out${c.lost ? ' lost' : ''}`} style={{ '--i': c.i, '--dx': `${c.dx}px`, '--up': `${c.up || 0}px`, '--dy': `${c.dy || 0}px` }} aria-hidden="true" />
        ))}
        <span className="rw-pig-plus" data-testid="piggy-plus" aria-hidden="true">+{out.payout}{out.lost ? <small>−{out.lost} сгорело</small> : null}</span>
      </React.Fragment>
    )}
    <svg className="rw-pig" viewBox="0 0 80 64" width="80" height="64" aria-hidden="true">
      <defs><clipPath id={clip}><rect x="20" y="-20" width="40" height="38.4" /></clipPath></defs>
      {drop > 0 && <g key={drop} className="rw-pig-coin"><circle cx="37.5" cy="6" r="6" fill="#E3B23C" stroke="#8A6416" strokeWidth="1.4" /><circle cx="37.5" cy="6" r="3" fill="none" stroke="#8A6416" strokeWidth="1" /></g>}
      <ellipse cx="39" cy="60" rx="23" ry="2.6" fill="#000" opacity=".08" />
      <path d="M14.5 33.5c-3.2-.6-5.6 1.2-5 3.6.5 2 3.4 2.2 4-.1.5-2-1.6-3-3.1-1.9" fill="none" stroke={PIG.line} strokeWidth="2" strokeLinecap="round" />
      {leg(26, PIG.far)}{leg(48, PIG.far)}{leg(19, PIG.body)}{leg(41, PIG.body)}
      {ear('M44 21.5c1-6.5 5.5-9.5 10.5-9 .3 5-2.2 9-6.5 11z')}
      <ellipse cx="38" cy="35" rx="25" ry="17.5" fill={PIG.body} stroke={PIG.line} strokeWidth="2" />
      <path d="M22 26c3-4 8-6.5 13-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".6" />
      {ear('M50 21c1.5-5.5 5-8 9-7.6.2 4.4-2 7.6-5.6 9.4z')}
      <ellipse cx="63.5" cy="38" rx="5.6" ry="6.6" fill={PIG.snout} stroke={PIG.line} strokeWidth="2" />
      <ellipse cx="62.4" cy="36" rx="1.1" ry="1.6" fill={PIG.line} /><ellipse cx="65.2" cy="38.6" rx="1.1" ry="1.6" fill={PIG.line} />
      <path d="M50.5 31.5q2.6-3 5.2 0" fill="none" stroke={PIG.ink} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="54" cy="40.5" rx="3.4" ry="2" fill="#EF6F8E" opacity=".45" />
      <path d="M53 45q3 2 6 .2" fill="none" stroke={PIG.line} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="31" y="17" width="13" height="3.2" rx="1.6" fill={PIG.ink} />
      {full && (
        <g className="rw-pig-in">
          <g clipPath={`url(#${clip})`}><g className="rw-pig-peek"><circle cx="37.5" cy="15" r="6" fill="#E3B23C" stroke="#8A6416" strokeWidth="1.4" /><circle cx="37.5" cy="15" r="3" fill="none" stroke="#8A6416" strokeWidth="1" /></g></g>
          {[[27, 9, 1.6], [48.5, 7.5, 1.3], [52, 13.5, 1]].map(([cx, cy, r], k) => <circle key={k} className="spark" cx={cx} cy={cy} r={r} fill="#E3B23C" style={{ '--i': k }} />)}
        </g>
      )}
    </svg>
    </span>
  );
}
function PiggyCard({ learn, update, now, b, onMsg }) {
  const st = piggyState(learn, now);
  const day = dayOf(now);
  const rateNow = weekRate(day);
  const [amount, setAmount] = useState(() => Math.max(PIGGY.min, Math.min(100, Math.floor(b / 2))));
  // вид вклада: срочный (без пополнений, ставка недели) или пополняемый (ставка ниже) — docs/mechanics.md
  const [topup, setTopup] = useState(false);
  const [addAmt, setAddAmt] = useState(() => Math.max(PIGGY.addMin, Math.min(50, Math.floor(b / 4))));
  const [drop, setDrop] = useState(0);
  // «Забрать»: сколько вылетело и сколько сгорело — для анимации свинки
  const [out, setOut] = useState(null);
  useEffect(() => { if (!out) return undefined; const t = setTimeout(() => setOut(null), 2200); return () => clearTimeout(t); }, [out]);
  const can = b >= PIGGY.min;
  const n = Math.max(PIGGY.min, Math.min(amount, b));
  const rTop = topupRate(rateNow);
  const rateFor = topup ? rTop : rateNow;
  const fixedEnd = piggyValue(n, PIGGY.days, rateNow); const topEnd = piggyValue(n, PIGGY.days, rTop);
  const put = () => {
    const r = piggyPut(learn, n, now, { topup });
    if (!r.ok) { Audio.play('down'); onMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register'); setDrop((k) => k + 1); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: `${r.topup ? 'Пополняемый вклад' : 'Срочный вклад'}: ${r.amount} ${coinsWord(r.amount)} под ${fmtPct(r.rate)} в день. Через ${PIGGY.days} дней станет ${piggyValue(r.amount, PIGGY.days, r.rate)}${r.topup ? ' — и больше, если пополнять' : ''}.` });
  };
  const addN = Math.max(PIGGY.addMin, Math.min(addAmt, b));
  const add = () => {
    const r = piggyAdd(learn, addN, now);
    if (!r.ok) { Audio.play('down'); onMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register'); setDrop((k) => k + 1); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: `Пополнено на ${r.amount} ${coinsWord(r.amount)}: эти монеты растут с сегодняшнего дня до конца срока.` });
  };
  const take = () => {
    const r = piggyTake(learn, now);
    if (!r.ok) { onMsg({ ok: false, text: r.reason }); return; }
    Audio.play(r.early ? 'paper' : 'register'); update(() => r.s, { settle: true });
    setOut((o) => ({ k: (o ? o.k : 0) + 1, payout: r.payout, lost: r.lost || 0 }));
    onMsg({ ok: true, text: !r.early ? `Забрано ${r.payout} ${coinsWord(r.payout)} — с процентами за неделю.` : r.lost ? `Забрано ${r.payout} ${coinsWord(r.payout)}: раньше срока процент сгорел (−${r.lost}).` : `Забрано ${r.payout} ${coinsWord(r.payout)}: проценты не успели набежать.` });
  };
  return (
    <Card className="rw-piggy" style={{ margin: '0 0 14px', padding: 0, overflow: 'hidden' }} data-testid="shop-piggy" data-open={String(!!st)}>
      <div className="rw-piggy-head">
        <PiggyArt full={!!st} drop={drop} out={out} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-eyebrow">Сберкнижка</div>
          <div className="ds-h3">Копилка Инфли</div>
          <div className="ds-sub" style={{ fontSize: 13.5, lineHeight: 1.35 }}>Положите монеты на {PIGGY.days} дней — вернутся с процентами. Раньше срока процент сгорит.</div>
        </div>
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <RateWeek day={day} focus="piggy" />
        {st ? (
          <div className="rw-book" data-testid="piggy-open">
            <div className="rw-book-top">
              <span className="rw-book-kind" data-testid="piggy-kind">{st.topup ? 'пополняемый' : 'срочный, без пополнений'}</span>
              <span className="ds-num" data-testid="piggy-rate">{fmtPct(st.rate)} в день</span>
            </div>
            <div className="rw-book-sum">
              <div><small>Положено{st.adds ? ` · пополнений: ${st.adds}` : ''}</small><b className="ds-num" data-testid="piggy-amount-in">{st.amount}</b></div>
              <div><small>Сейчас</small><b className="ds-num">{st.value}</b></div>
              <div className="fin"><small>{st.ripe ? 'Готово' : `Через ${PIGGY.days - st.days} ${plural(PIGGY.days - st.days, 'день', 'дня', 'дней')}`}</small><b className="ds-num">{st.final}</b></div>
            </div>
            <div className="rw-book-dayline" data-testid="piggy-state">
              <b>День {st.days} из {PIGGY.days}</b>
              <span>{st.ripe ? 'срок вышел — можно забирать' : `ещё ${PIGGY.days - st.days} ${plural(PIGGY.days - st.days, 'день', 'дня', 'дней')}`}</span>
            </div>
            <div className="rw-book-days" aria-hidden="true">{Array.from({ length: PIGGY.days }, (_, k) => <i key={k} className={k < st.days ? 'on' : k === st.days ? 'cur' : ''} style={{ '--i': k }} />)}</div>
            <PiggyChart amount={st.amount} rate={st.rate} day={st.days} path={st.path} steps={st.steps} />
            {st.canAdd && (b >= PIGGY.addMin ? (
              <div className="rw-add" data-testid="piggy-add-form">
                <label className="rw-book-row" htmlFor="piggy-add-amount"><span>Пополнить</span><b className="ds-num">{addN} {coinsWord(addN)}</b></label>
                <input id="piggy-add-amount" type="range" min={PIGGY.addMin} max={Math.max(PIGGY.addMin, b)} step={1} value={addN} style={{ width: '100%', accentColor: 'var(--u)' }}
                  onChange={(e) => { Audio.play('tick'); setAddAmt(Number(e.target.value)); }} />
                <Button small wide variant="secondary" data-testid="piggy-add" onClick={add}>Пополнить на {addN} {coinsWord(addN)}</Button>
              </div>
            ) : <div className="ds-sub" style={{ fontSize: 13, margin: '0 0 8px' }}>Пополнить можно от {PIGGY.addMin} монет.</div>)}
            <Button small wide={st.ripe} variant={st.ripe ? 'primary' : 'ghost'} data-testid="piggy-take" onClick={take}>
              {st.ripe ? `Забрать ${st.payout} ${coinsWord(st.payout)}` : `Забрать раньше: только ${st.payout}`}
            </Button>
          </div>
        ) : can ? (
          <div className="rw-book" data-testid="piggy-form">
            <label className="rw-book-row" htmlFor="piggy-amount"><span>Положить</span><b className="ds-num">{n} {coinsWord(n)}</b></label>
            <input id="piggy-amount" type="range" min={PIGGY.min} max={Math.max(PIGGY.min, b)} step={1} value={n} data-testid="piggy-amount" style={{ width: '100%', accentColor: 'var(--u)' }}
              onChange={(e) => { Audio.play('tick'); setAmount(Number(e.target.value)); }} />
            <div className="rw-presets" role="group" aria-label="Сколько положить">
              {PRESETS.map(([label, k]) => <button key={label} type="button" onClick={() => { Audio.play('tick'); setAmount(Math.max(PIGGY.min, Math.floor(b * k))); }}>{label}</button>)}
            </div>
            {/* вид вклада — с итогом для этой суммы: сравнение честное, цифрами */}
            <div className="rw-kinds" role="group" aria-label="Вид вклада">
              <button type="button" aria-pressed={!topup} data-testid="piggy-kind-fixed" onClick={() => { Audio.play('tick'); setTopup(false); }}>
                <span className="t"><Lock size={14} aria-hidden="true" /> Срочный</span>
                <b>{fmtPct(rateNow)} в день</b>
                <span className="res">{n} → <em>{fixedEnd}</em> <i>+{fixedEnd - n}</i></span>
                <small>Больше процент, но докладывать нельзя</small>
              </button>
              <button type="button" aria-pressed={topup} data-testid="piggy-kind-topup" onClick={() => { Audio.play('tick'); setTopup(true); }}>
                <span className="t"><Plus size={14} aria-hidden="true" /> Пополняемый</span>
                <b>{fmtPct(rTop)} в день</b>
                <span className="res">{n} → <em>{topEnd}</em> <i>+{topEnd - n}</i></span>
                <small>Процент ниже, зато можно докладывать</small>
              </button>
            </div>
            <PiggyChart amount={n} rate={rateFor} other={topup ? rateNow : rTop} />
            <div className="rw-legend" aria-hidden="true"><span className="m">{topup ? 'пополняемый' : 'срочный'}</span><span className="o">{topup ? 'срочный' : 'пополняемый'} — для сравнения</span></div>
            <div className="rw-book-row"><span>Через {PIGGY.days} дней</span><b className="ds-num" data-testid="piggy-final">{piggyValue(n, PIGGY.days, rateFor)} <small>(+{piggyValue(n, PIGGY.days, rateFor) - n})</small></b></div>
            {topup && <div className="ds-sub" style={{ fontSize: 13, marginTop: 4 }}>Без пополнений пополняемый всегда даёт меньше срочного: он выгоден, только если докладывать.</div>}
            <Button small wide data-testid="piggy-put" onClick={put}>Положить {n} {coinsWord(n)}</Button>
          </div>
        ) : (
          <div className="ds-sub" style={{ fontSize: 14, marginTop: 8 }}>Положить можно от {PIGGY.min} монет — их дают уроки.</div>
        )}
        <RealRate rate={st ? st.rate : rateNow} />
      </div>
    </Card>
  );
}

/* ------------------------------ СУНДУК ЮНИТА ------------------------------ */
export function ChestSheet({ unitId, place, learn, update, onClose }) {
  const n = chestCoins(unitId);
  const [opened, setOpened] = useState(false);
  const was = hasClaim(learn, chestKey(unitId));
  const open = () => { Audio.play('register'); update((s) => openChest(s, unitId), { settle: true }); setOpened(true); };
  // закрытие сообщает, открыли ли сундук сейчас: тогда Путь свернёт пройденный юнит и поедет дальше
  const close = () => onClose(opened);
  return (
    <Sheet label={`Сундук: ${place}`} onClose={close} testid="chest-sheet">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginRight: -8 }}><IconButton label="Закрыть" icon={X} data-nav="back" onClick={close} size={22} /></div>
      <div style={{ textAlign: 'center' }}>
        {opened && <CoinShower seed={n} n={18} />}
        <div className="ds-eyebrow">Сундук юнита · {place}</div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }} className={opened ? 'rw-chest-open' : ''}>
          <Chest size={132} open={opened} animate spent={was && !opened} label={opened ? 'Сундук открыт: монеты' : was ? 'Сундук пуст' : 'Сундук закрыт'} />
        </div>
        {opened ? (
          <><div className="ds-h2" data-testid="chest-coins">+{n} {coinsWord(n)}</div><div className="ds-sub" style={{ fontSize: 14.5, margin: '4px 0 14px' }}>Место на карте ваше — монеты в кошельке.</div>
            <Button wide data-testid="chest-take" onClick={close}>Забрать</Button></>
        ) : was ? (
          <div className="ds-sub" style={{ fontSize: 15 }}>Сундук уже открыт — монеты в кошельке.</div>
        ) : (
          <><div className="ds-sub" style={{ fontSize: 15, marginBottom: 14 }}>Юнит пройден — внутри монеты.</div><Button wide data-testid="chest-open" onClick={open}>Открыть</Button></>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------ УТРЕННИЙ ЭКРАН СЕРИИ ------------------------------
   Один раз в день, при первом открытии — бумажный билет в стиле сайта: розетка-печать с огоньком-
   гравюрой, число дней, «дней подряд», что делать сегодня и неделя оттисками печатей. Без мелкого текста. */
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/* Огонёк серии — гравюра: контуры чернилами, штриховка внутри, сердцевина — светлой бумагой;
   при появлении поднимается, потом чуть колышется. */
const FLAME_OUT = 'M32 4 C 36 20, 54 30, 54 52 C 54 68, 44 76, 32 76 C 20 76, 10 68, 10 52 C 10 40, 17 33, 21 24 C 23 33, 26 37, 29 38 C 27 26, 28 14, 32 4 Z';
const FLAME_MID = 'M32 32 C 36 43, 46 49, 46 59 C 46 69, 40 74, 32 74 C 24 74, 18 69, 18 59 C 18 52, 23 47, 25 42 C 27 49, 29 51, 31 52 C 30 45, 30 39, 32 32 Z';
const FLAME_CORE = 'M32 53 C 35 59, 39 62, 39 66.5 C 39 70.5, 36 72.5, 32 72.5 C 28 72.5, 25 70.5, 25 66.5 C 25 62, 29 59, 32 53 Z';
export function EngravedFlame({ size = 64 }) {
  const id = `fl${React.useId().replace(/:/g, '')}`;
  const hatch = (step, from = -40, to = 110) => Array.from({ length: Math.ceil((to - from) / step) }, (_, k) => `M${from + k * step} 80 L${from + k * step + 60} 0`).join(' ');
  return (
    <svg className="rw-flame" viewBox="0 0 64 80" width={size} height={size * 1.25} aria-hidden="true">
      <defs>
        <clipPath id={`${id}o`}><path d={FLAME_OUT} /></clipPath>
        <clipPath id={`${id}m`}><path d={FLAME_MID} /></clipPath>
      </defs>
      <ellipse cx="32" cy="77.5" rx="17" ry="2.2" fill="var(--rw-fire-ink)" opacity=".14" />
      <g className="rise"><g className="sway">
        <path d={FLAME_OUT} fill="var(--rw-fire-tint)" />
        <path d={hatch(3.2)} stroke="var(--rw-fire)" strokeWidth=".9" opacity=".75" clipPath={`url(#${id}o)`} />
        <path d={FLAME_MID} fill="var(--ds-card)" />
        <path d={hatch(5.2)} stroke="var(--rw-fire)" strokeWidth=".7" opacity=".45" clipPath={`url(#${id}m)`} />
        <path d={FLAME_CORE} fill="var(--ds-card)" stroke="var(--rw-fire-ink)" strokeWidth="1" />
        <path d={FLAME_MID} fill="none" stroke="var(--rw-fire-ink)" strokeWidth="1.2" strokeLinejoin="round" />
        <path d={FLAME_OUT} fill="none" stroke="var(--rw-fire-ink)" strokeWidth="1.8" strokeLinejoin="round" />
      </g></g>
    </svg>
  );
}
export function MorningStreak({ learn, onClose, now = Date.now() }) {
  const st = streak(learn, now);
  const hello = greetingAt(new Date(now).getHours());
  const label = `${plural(st.days, 'день', 'дня', 'дней')} подряд`;
  return (
    <div className="rw-morning" data-testid="morning" role="dialog" aria-label="Серия дней">
      <div className="rw-morning-in">
        <div className="rw-ticket">
          <Guilloche height={20} color="var(--rw-fire)" opacity={0.4} />
          <div className="rw-ticket-in">
            <div className="ds-eyebrow" style={{ color: 'var(--rw-fire-ink)', marginTop: 8 }}>{hello}</div>
            <div className="rw-seal"><Rosette size={146} color="var(--rw-fire)" opacity={0.32}><EngravedFlame size={76} /></Rosette></div>
            <div className="rw-days" data-testid="morning-days" data-value={st.days} role="img" aria-label={`${st.days} ${label}`}>
              {String(st.days).split('').map((c, k) => <span key={k} style={{ '--i': k }} aria-hidden="true">{c}</span>)}
            </div>
            <div className="rw-days-label">{label}</div>
            <div className="rw-days-sub">{st.today ? 'Сегодня уже занимались — серия продлена.' : 'Один урок сегодня — и огонёк горит дальше.'}</div>
            <div className="rw-week">
              <div className="rw-dots" data-testid="morning-week">
                {weekDots(learn, now).map((d, k) => (
                  <div key={d.day} className={`rw-dot ${d.done ? 'done' : d.frozen ? 'frozen' : ''} ${d.today ? 'today' : ''}`}>
                    <i style={{ '--i': k }}>{d.done ? <Flame size={16} strokeWidth={2.2} aria-hidden="true" /> : d.frozen ? <ShieldCheck size={15} aria-hidden="true" /> : null}</i>{DOW[d.dow]}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Guilloche height={20} color="var(--rw-fire)" opacity={0.4} />
        </div>
      </div>
      <div style={{ position: 'relative', maxWidth: 420, width: '100%', margin: '18px auto 0' }}><Button wide autoFocus data-testid="morning-go" onClick={() => { Audio.play('paper'); onClose(); }}>{st.today ? 'В путь' : 'Продолжить серию'}</Button></div>
    </div>
  );
}

/* ------------------------------ ПЕЧАТИ ------------------------------
   Полученные — цветные сургучные печати, первыми; ещё не полученные — отдельно, пунктирным
   контуром с замком и подписью «как получить»: что есть, а чего нет, видно с первого взгляда. */
export function Achievements({ learn }) {
  const list = achievementsOf(learn);
  const months = monthStamps(learn);
  const got = list.filter((a) => a.got); const rest = list.filter((a) => !a.got);
  const item = (a) => {
    const Icon = ACH_ICON[a.icon] || Check;
    return (
      <div key={a.id} className="rw-stamp" data-testid="ach" data-ach={a.id} data-got={String(a.got)} title={a.text}>
        <Medal icon={<Icon size={24} strokeWidth={a.got ? 2.2 : 1.8} />} got={a.got} color="var(--u)" size={68} label={`${a.title}: ${a.got ? 'получена' : 'ещё не получена'}`} />
        <b>{a.title}</b><span>{a.got ? a.text : a.how || a.text}</span>
      </div>
    );
  };
  return (
    <div data-testid="achievements">
      <div className="ds-eyebrow" style={{ margin: '2px 0 8px' }} data-testid="ach-got-count">Получено: {got.length + months.length} из {list.length + months.length}</div>
      {(got.length > 0 || months.length > 0) ? (
        <div className="rw-stamps">
          {got.map(item)}
          {months.map((m) => (
            <div key={m.key} className="rw-stamp" data-testid="ach-month" data-got="true">
              <Medal icon={<CalendarDays size={24} strokeWidth={2.2} />} got color="var(--ds-gold)" size={68} label={`Марка месяца: ${m.name}`} />
              <b>{m.name}</b><span>марка месяца</span>
            </div>
          ))}
        </div>
      ) : <div className="ds-sub" style={{ fontSize: 14 }}>Пока ни одной — первая печать за первый пройденный урок.</div>}
      {rest.length > 0 && (
        <>
          <div className="ds-eyebrow" style={{ margin: '16px 0 8px', color: 'var(--ds-ink2)' }}>Ещё не получены</div>
          <div className="rw-stamps rw-stamps-locked">{rest.map(item)}</div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ НАГРАДЫ ЗА УРОК ------------------------------ */
export function GainsList({ coins, gains }) {
  const total = coins + gains.reduce((a, g) => a + g.coins, 0);
  if (!total) return null;
  return (
    <div style={{ marginTop: 14, textAlign: 'left' }} data-testid="result-coins" data-total={total}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: '700 18px var(--ds-mono)' }}>
        <Coins size={20} color="var(--ds-gold)" aria-hidden="true" /><CountUp value={total} prefix="+" /> <span style={{ font: '15px var(--ds-sans)' }}>{coinsWord(total)}</span>
      </div>
      <div style={{ marginTop: 6 }}>
        {coins > 0 && <div className="ds-row" style={{ fontSize: 13.5 }}><span>За урок</span><b className="ds-num">+{coins}</b></div>}
        {gains.map((g) => <div key={g.key} className="ds-row" style={{ fontSize: 13.5 }} data-testid="gain" data-kind={g.kind}><span>{g.title}</span><b className="ds-num">+{g.coins}</b></div>)}
      </div>
    </div>
  );
}

/* ------------------------------ МОЯ ПРОГРАММА ------------------------------ */
export function ProgramCard({ learn, update, onPlacement }) {
  const p = learn.profile || {};
  const level = skillLevel(learn);
  const setMinutes = (m) => { Audio.play('tick'); update((s) => setProfile(s, { minutes: m })); };
  const mins = goalMinutes(learn);
  const next = pendingGoal(learn);
  // выбранная кнопка — цель, которую выбрали (новая действует с завтра)
  const chosen = next ? next.minutes : mins;
  return (
    <Card style={{ margin: '12px 0' }} data-testid="prof-program">
      <div className="ds-h3" style={{ marginBottom: 8 }}>Моя программа</div>
      <div className="ds-eyebrow" style={{ marginBottom: 6 }}>Цель</div>
      <div className="rw-chip-row" role="group" aria-label="Цель">
        {PROFILE_GOALS.map((g) => <button key={g} type="button" className="ds-chip" aria-pressed={p.goal === g} onClick={() => { Audio.play('tick'); update((s) => setProfile(s, { goal: g })); }}>{PROFILE_GOAL_LABEL[g]}</button>)}
      </div>
      <div className="ds-eyebrow" style={{ margin: '12px 0 6px' }}>Цель дня · минут занятий</div>
      <div className="rw-chip-row" role="group" aria-label="Минут в день">
        {PROFILE_MINUTES.map((m) => (
          <button key={m} type="button" className="ds-chip" aria-pressed={chosen === m} data-minutes={m} onClick={() => setMinutes(m)}>{m} мин</button>
        ))}
      </div>
      <div className="ds-faint" style={{ fontSize: 13, marginTop: 6 }} data-testid="prof-goal-note">
        {next ? `Сегодня цель — ${mins} мин. Новая, ${next.minutes} мин, — с завтрашнего дня.` : `За выполненную цель — ${goalCoins(mins)} ${coinsWord(goalCoins(mins))}: столько, сколько минут. Новая цель начинает действовать с завтрашнего дня.`}
      </div>
      <Row label="Уровень заданий" value={LEVEL_NAME[level]} data-testid="prof-level" data-level={level} />
      <div className="ds-faint" style={{ fontSize: 13, marginTop: 4 }}>{LEVEL_TEXT[level]}</div>
      <div style={{ marginTop: 12 }}>
        <Button small variant="secondary" icon={GraduationCap} data-testid="prof-placement" data-nav-target="run:placement" onClick={() => { Audio.prime(); onPlacement(); }}>
          {(learn.placement || {}).at ? 'Вступительный тест ещё раз' : 'Вступительный тест'}
        </Button>
      </div>
    </Card>
  );
}

/* Приглашение на вступительный тест — на Пути, если при регистрации выбрано «Кое-что знаю». */
export function PlacementCard({ onStart, onSkip }) {
  return (
    <Card style={{ margin: '0 0 14px', background: 'color-mix(in srgb, var(--u) 7%, var(--ds-card))' }} data-testid="placement-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Rosette size={58} opacity={0.5}><GraduationCap size={26} color="var(--u-ink)" aria-hidden="true" /></Rosette>
        <div style={{ flex: 1 }}>
          <div className="ds-h3">Вступительный тест</div>
          <div className="ds-sub" style={{ fontSize: 14, lineHeight: 1.4 }}>Пять вопросов на юнит. Что знаете — откроется сразу, дальше Путь продолжится с нужного места.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small data-testid="placement-start" data-nav-target="run:placement" onClick={() => { Audio.prime(); onStart(); }}>Пройти тест</Button>
        <Button small variant="ghost" data-testid="placement-skip" onClick={onSkip}>Начать с начала</Button>
      </div>
    </Card>
  );
}
