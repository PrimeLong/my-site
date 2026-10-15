/* ПУТЬ ПО ИНФЛАТИИ: главный экран учёбы — дорога по карте страны, юниты — места (Рынок,
   Мастерская, Банк…), уроки — остановки на дороге; пройденный юнит «оживляет» своё здание.
   Здесь же карточка урока (билет), урок во весь экран, итоги, практика, профиль с альбомом
   марок и учебник-справочник. Отдельный ленивый чанк вместе с учебником.

   Оформление — только дизайн-система: src/ds.jsx (кнопка-билет, карточка-документ, плашка
   ответа-штамп, заголовки, панели) и src/ds-art.jsx (гравюры, гильош, печати, марки, график
   прогресса, Инфля). Данные — src/learn/course.js, src/textbook/learn-state.js,
   src/learn/resume.js. Места юнитов и их цвета — src/ds-tokens.js (PLACES).

   Навигация: у каждого экрана один «назад» (data-nav="back"), переходы помечены
   data-nav-target — e2e проверяет, что на одном экране нет двух путей в одно место.
   Карта экранов — src/learn/screens.js. */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  X, ArrowLeft, Flame, Coins, Target, Lock, Check, Gem, ChevronLeft, Calculator, BookOpenText, BookOpen, Trophy, Timer, Delete, ChevronRight, RotateCcw, Sparkles, Dumbbell,
  Clock, Scale, Hourglass, Ticket, TrendingUp, CircleCheck, Medal, ArrowLeftRight, Handshake, Coffee, Wallet, Link, Utensils, Boxes, Users,
  Snowflake, ArrowDownToLine, ArrowUpToLine, Languages, MessageCircle, Headphones, Gamepad2, Repeat, Flag, Croissant, Landmark, Radio, MapPin, ArrowUp, ChevronDown,
} from 'lucide-react';
import { STATS_CSS } from './learn-stats.jsx';
import { askSave } from './lib/guest.js';
import { writeLearnLevel } from './lib/disclosure.js';
import { track } from './lib/client.js';
import { Audio, getPlayerId, syncProfile } from './MacroSimulator.jsx';
import { Blocks, Inline, ChartSvg, TEXTBOOK_CSS, TextbookScreen } from './textbook.jsx';
import { CHARTS, chartDefaults } from './textbook/charts.js';
import { loadProgress, saveProgress, latestProgress, PROGRESS_EVENT, reviewQueue } from './textbook/progress.js';
import { afterPathAnswer, dropFromReview } from './textbook/review-sync.js';
import { activeClock, tickClock, actClock } from './learn/active-time.js';
import {
  UNITS, LESSONS, LEVELS, LEVEL_BY_ID, levelOf, levelUnits, LESSON_BY_ID, KIND_LABEL, SHIFT_CURVES, LESSON_KIND, GAME_KINDS, SELF_CHECK, OPEN_MIN, buildLesson, buildUnitCheck, buildLevelCheck, buildPractice, check, ready, answerText, unitFor, pathState,
  buildPlacement, placementOpened, placementFailed, retryOf, gameLeft, GAME_PASS,
} from './learn/course.js';
import {
  startLesson, recordAttempt, abandonLesson, addMistake, resolveMistake, skipLesson, addHinted, clearHinted, finishLesson, passUnit, lessonDone, lessonXp, streak,
  goalToday, missedYesterday, XP, applyFreezes, setPlacement, dayOf, recordSeen, recordBest, DIAMOND_ACCURACY,
} from './textbook/learn-state.js';
import { runCoins, runKey, earn, settle, chestKey, hasClaim, outfitOf, boostActive, chargePremiums, fixMonth } from './learn/rewards.js';
import { pickPhrase, situation, endKind } from './learn/voice.js';
import { lessonOpts, weakLessons, recommend, courseCtx, theoryNotice } from './learn/program.js';
import {
  REWARD_CSS, WalletStat, QuestsCard, MonthCard, TasksEntry, ShopView, ChestSheet, MorningStreak, GainsList, PlacementCard,
} from './learn-rewards.jsx';
import { saveResume, dropResume, getResume, takeExpiredResumes, resumeIds } from './learn/resume.js';
import { Mascot, OutfitContext } from './mascot.jsx';
import { markTerms, termTitle, termText, termFormula } from './learn/terms.js';
import { LeagueView } from './learn-league.jsx';
import { NOTIFY_CSS, useNotify, useToasts, useBrowserReminders, NotifyCenter, NotifyToast, BellButton } from './learn-notify.jsx';
import {
  PLAY_CSS, CurveEx, PriceEx, PointEx, TilesEx, TimerBar, GameRound, KeepRound, WordDeck, Calculator as CalcPad,
} from './learn-play.jsx';
import { Feed, FEED_CSS } from './learn-feed.jsx';
import { DiscoverDay, MarketModel, MODEL_CSS, DOMINO_CSS, DominoEx } from './learn-model.jsx';
import { hasModel, partsOfLesson, modelProgress } from './learn/model.js';
import { callbackFor } from './learn/callbacks.js';
import { symbolsOf } from './textbook/symbols.js';
import { inCrowns, sceneInCrowns } from './learn/money.js';
import { ReportFlag, QuoteReport, ReportsView, AnalyticsView, REPORT_CSS, THEORY_REASONS, exerciseContext, flatText } from './learn-report.jsx';
import { DsRoot, Button, IconButton, Card, MenuCard, Heading, AnswerBar, Sheet, TopBar } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette, Chest, Engraving, EngravingG, ProgressChart, InflaMeter, CoinShower, CountUp, useReducedMotion, useWide } from './ds-art.jsx';
import { placeOf, unitColor, DIAMOND_COLOR, dsThemeId } from './ds-tokens.js';
import { countryPath, innerBorderPath, RIVER, curveTo } from './lib/mapgeo.js';
import { plural } from './lib/plural.js';

export { SCREENS } from './learn/screens.js';

// раскладка экранов обучения; цвета, шрифты и компоненты — из дизайн-системы
const CSS = `
  .ln-root { padding: 12px 16px 104px; }
  .ln-wrap { max-width: 560px; margin: 0 auto; }
  .ln-path-wide { max-width: 1120px; display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 28px; align-items: start; }
  .ln-path-side { position: sticky; top: 12px; max-height: calc(100vh - 110px); overflow: auto; padding-bottom: 8px; }
  .ln-stats { display: flex; gap: 6px; padding: 2px 0 12px; }
  .ln-stat { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px; border: 1px solid var(--ds-rule2); border-radius: 3px;
    background: var(--ds-card); font: 700 15px var(--ds-mono); white-space: nowrap; box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px var(--ds-rule); }
  .ln-stat small { font: 12px var(--ds-sans); color: var(--ds-ink3); letter-spacing: .04em; }
  .ln-streak.on { background: color-mix(in srgb, var(--ds-bad) 12%, var(--ds-card)); border-color: color-mix(in srgb, var(--ds-bad) 55%, var(--ds-rule2)); color: var(--ds-bad); }
  .ln-streak.on small { color: inherit; }
  .ln-streak.wait { border-style: dashed; color: var(--ds-ink3); }
  .ln-flame-wrap { position: relative; display: inline-flex; }
  .ln-flame-ok { position: absolute; right: -5px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; background: var(--ds-ok); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
  /* серия на итогах — без надписи: огонёк вспыхивает, разлетаются искры, счётчик дней перещёлкивается */
  .ln-burst { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 0 0 14px; color: var(--ds-bad); }
  .ln-burst-flame { position: relative; display: inline-flex; transform-origin: 50% 90%; animation: ln-ignite .8s cubic-bezier(.2, 1.5, .4, 1) both, ln-flicker 1.3s ease-in-out .8s 2; }
  .ln-burst-flame::before { content: ''; position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--ds-bad) 35%, transparent), transparent 70%); animation: ln-glow 1.6s ease-out .2s both; }
  .ln-burst-flame svg { position: relative; }
  .ln-burst-flame i { position: absolute; left: 50%; top: 45%; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: var(--ds-bad); opacity: 0; animation: ln-spark .9s ease-out .45s both; }
  .ln-burst-num { position: relative; display: inline-block; height: 40px; min-width: 1.2ch; overflow: hidden; font: 800 36px/40px var(--ds-sans); font-variant-numeric: tabular-nums; }
  .ln-burst-num > span { display: block; }
  .ln-burst-num .old { position: absolute; left: 0; right: 0; animation: ln-num-out .45s ease-in .55s both; }
  .ln-burst-num .new { animation: ln-num-in .5s cubic-bezier(.2, 1.4, .4, 1) .7s both; }
  .ln-burst-cap { display: block; font: 700 13.5px var(--ds-sans); color: var(--ds-ink2); }
  @keyframes ln-ignite { 0% { transform: scale(.2) translateY(12px); opacity: 0; filter: grayscale(1) } 60% { transform: scale(1.25); opacity: 1; filter: none } 100% { transform: scale(1) } }
  @keyframes ln-flicker { 0%, 100% { transform: scale(1) rotate(0) } 30% { transform: scale(1.06, .95) rotate(-3deg) } 65% { transform: scale(.97, 1.05) rotate(2deg) } }
  @keyframes ln-glow { 0% { opacity: 0; transform: scale(.4) } 40% { opacity: 1; transform: scale(1.1) } 100% { opacity: .35; transform: scale(1) } }
  @keyframes ln-spark { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1) } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-36px) scale(.3) } }
  @keyframes ln-num-out { to { transform: translateY(-100%); opacity: 0 } }
  @keyframes ln-num-in { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .ln-burst-flame, .ln-burst-flame::before, .ln-burst-num .new { animation: none; } .ln-burst-flame i, .ln-burst-num .old { display: none; } }
  .ln-atlas { position: relative; padding: 10px 10px 8px; margin: 4px 0 18px; }
  .ln-atlas svg text { font-family: var(--ds-head); }
  .ln-bill { position: relative; overflow: hidden; padding: 0; margin: 20px 0 6px; background: color-mix(in srgb, var(--u) 7%, var(--ds-card)); }
  .ln-bill-in { display: flex; align-items: center; gap: 12px; padding: 12px 14px 10px; }
  .ln-bill-no { font: 700 30px/1 var(--ds-head); color: var(--u-ink); }
  .ln-bill-btns { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 14px 12px; }
  /* пройденный юнит свёрнут в одну строку: номер, место, алмазы, гайд и «уроки» */
  .ln-mini-guide { width: 36px; height: 36px; }
  .ln-bill-mini .ln-mini-fold { padding: 6px 4px; gap: 2px; }
  .ln-mini-title { line-height: 1.2; font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ln-bill-mini > * { flex-shrink: 0; }
  .ln-bill-mini { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; margin: 10px 0 4px; background: color-mix(in srgb, var(--u) 7%, var(--ds-card)); }
  /* юнит только что свернулся после сундука: строка «впечатывается», по ней пробегает блик */
  .ln-just-folded .ln-bill-mini { position: relative; overflow: hidden; animation: ln-mini-in .55s cubic-bezier(.3,1.4,.5,1) both; }
  .ln-just-folded .ln-bill-mini::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(105deg, transparent 30%, color-mix(in srgb, var(--ds-gold-soft) 55%, transparent) 48%, transparent 66%) no-repeat; background-size: 250% 100%;
    animation: ln-sheen 1.3s ease-out .25s both; }
  @keyframes ln-mini-in { 0% { transform: scale(1.06); opacity: 0 } 100% { transform: none; opacity: 1 } }
  @keyframes ln-sheen { from { background-position: 130% 0 } to { background-position: -40% 0 } }
  .ln-unit-body { overflow-anchor: none; transform-origin: 50% 0; }
  /* смена вкладки: экран мягко проявляется */
  /* только прозрачность: сдвиг (transform) сделал бы вкладку рамкой для fixed-слоёв внутри — шторки и
     страницы поверх профиля встали бы не по экрану, а по вкладке */
  .ln-tab { animation: ln-tab-in .3s ease-out; }
  @keyframes ln-tab-in { from { opacity: 0 } to { opacity: 1 } }
  /* плашка уровня наверху Пути: стрелки к соседним уровням, касание — список уровней */
  .ln-switch { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 6px; margin: 4px -4px 8px; padding: 6px 4px;
    background: color-mix(in srgb, var(--ds-paper) 92%, transparent); backdrop-filter: blur(6px); }
  .ln-switch-arrow { width: 40px; height: 40px; flex-shrink: 0; color: var(--u-ink); }
  .ln-switch-arrow:disabled { opacity: .3; cursor: default; }
  .ln-switch-plate { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 7px 12px 7px 8px; border-radius: 16px; cursor: pointer; text-align: left; font: inherit; color: var(--ds-ink);
    background: color-mix(in srgb, var(--u) 9%, var(--ds-card)); border: 2px solid color-mix(in srgb, var(--u) 40%, var(--ds-rule2)); box-shadow: 0 4px 0 color-mix(in srgb, var(--u) 35%, var(--ds-rule2)); margin-bottom: 4px; }
  .ln-switch-plate:active { transform: translateY(3px); box-shadow: 0 1px 0 color-mix(in srgb, var(--u) 35%, var(--ds-rule2)); }
  .ln-switch-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ln-switch-place { font: 700 18px/1.2 var(--ds-head); color: var(--u-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ln-switch-count { font: 600 12.5px/1 var(--ds-sans); color: var(--ds-ink2); margin-left: 4px; }
  .ln-unit-no { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font: 700 17px/1 var(--ds-head);
    color: #fff; background: var(--u); border: none; box-shadow: 0 3px 0 color-mix(in srgb, var(--u) 68%, #000); }
  .ln-pick { display: flex; flex-direction: column; gap: 6px; max-height: min(58vh, 520px); overflow-y: auto; margin: 0 -4px; padding: 2px 4px; }
  .ln-pick-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 14px; text-align: left; font: inherit; color: var(--ds-ink);
    background: color-mix(in srgb, var(--u) 6%, var(--ds-card)); border: 2px solid var(--ds-rule2); }
  button.ln-pick-row { cursor: pointer; }
  .ln-pick-row[aria-current="true"] { border-color: var(--u-ink); box-shadow: inset 0 0 0 1px var(--u-ink); }
  .ln-pick-row[data-state="locked"] { background: var(--ds-card); }
  .ln-pick-row[data-state="locked"] .ln-unit-no { color: var(--ds-ink3); background: var(--ds-card2); box-shadow: inset 0 0 0 2px var(--ds-rule2); }
  .ln-pick-txt { flex: 1; min-width: 0; }
  .ln-pick-title { font: 700 16px/1.25 var(--ds-head); }
  .ln-pick-sub { font-size: 13px; color: var(--ds-ink2); line-height: 1.3; }
  /* живая модель на телефоне — свёрнутой строкой; касание раскрывает */
  .ln-fold-row { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; padding: 10px 12px; text-align: left; cursor: pointer; color: var(--ds-ink); font: inherit; }
  .ln-fold-row .lm-pips { margin-right: 4px; }
  /* «К карте»: появляется, когда карта уехала за верх экрана */
  .ln-to-map { position: fixed; right: 12px; bottom: calc(84px + env(safe-area-inset-bottom)); z-index: 30; width: 46px; height: 46px; display: inline-flex; align-items: center; justify-content: center;
    padding: 0; border-radius: 50%; border: 2px solid var(--ds-rule); background: var(--ds-card); color: var(--u-ink); box-shadow: 0 3px 0 var(--ds-rule2), 0 6px 16px var(--ds-shade); cursor: pointer; }
  @media (min-width: 1024px) { .ln-to-map { right: max(16px, calc(50vw - 560px)); } }
  .ln-route { position: relative; margin: 0 auto; }
  /* телефон уже 340 px (320 px — старые и маленькие): дорога чуть мельче, чтобы не вылезать за экран */
  @media (max-width: 340px) { .ln-route { zoom: .9; } }
  .ln-route > svg { position: absolute; inset: 0; pointer-events: none; }
  .ln-stop { position: absolute; width: 170px; margin-left: -85px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  /* остановка Пути — объёмная монета: снизу кромка темнее, нажатие опускает её */
  .ln-token { position: relative; width: 62px; height: 62px; border-radius: 50%; border: 3px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink2); cursor: pointer;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 0 var(--ds-rule2); margin-bottom: 5px; transition: transform .08s, box-shadow .08s; }
  .ln-token:not(.locked):hover { transform: translateY(-2px); }
  .ln-token:not(.locked):hover > svg { animation: ds-wiggle .5s ease-in-out; }
  .ln-token:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--ds-rule2); }
  .ln-token.done { background: var(--u); color: #fff; border-color: color-mix(in srgb, var(--u) 82%, #fff); box-shadow: 0 5px 0 color-mix(in srgb, var(--u) 68%, #000); }
  .ln-token.done:active { box-shadow: 0 1px 0 color-mix(in srgb, var(--u) 68%, #000); }
  .ln-token.locked { border-style: dashed; color: var(--ds-ink3); box-shadow: none; background: var(--ds-card2); }
  /* пропущенный «Слушай»: открыт, но не пройден — пунктир цвета юнита */
  .ln-token.skipped { border-style: dashed; border-color: color-mix(in srgb, var(--u) 60%, var(--ds-rule2)); color: var(--u-ink); }
  .ln-token.cur { border-color: var(--u); border-width: 3px; color: var(--u-ink); box-shadow: 0 5px 0 color-mix(in srgb, var(--u) 45%, var(--ds-rule2)); }
  .ln-token.cur::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--u) 55%, transparent); animation: ds-ring 1.8s ease-out infinite; pointer-events: none; }
  /* пройдено — золотая отметка (не красная: красный читается как ошибка) */
  .ln-seal { position: absolute; right: -5px; bottom: -5px; width: 25px; height: 25px; border-radius: 50%; background: var(--ds-gold-soft); color: #3A2600; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 2.5px var(--ds-paper); transform: rotate(-12deg); }
  /* урок, взятый на алмазном уровне: гранёный камень вместо цвета юнита */
  .ln-token.diamond { background: linear-gradient(135deg, #FFC2D2 0%, #E5527B 45%, #B3123F 62%, #7A0C2B 100%); border-color: #FFD6E1;
    box-shadow: 0 5px 0 #7A0C2B, 0 6px 14px rgba(179,18,63,.35); }
  .ln-seal.diamond { background: #B3123F; color: #fff; }
  .ln-pin { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); white-space: nowrap; font: 700 12px/1 var(--ds-sans); letter-spacing: .08em; text-transform: uppercase;
    color: #fff; background: var(--u); padding: 6px 10px 5px; border-radius: 10px; box-shadow: 0 2px 0 color-mix(in srgb, var(--u) 68%, #000); }
  .ln-pin.rec { background: var(--ds-gold); color: var(--ds-card); animation: ln-bob 2.8s ease-in-out infinite; }
  @keyframes ln-bob { 0%, 100% { transform: translateX(-50%) translateY(0) } 50% { transform: translateX(-50%) translateY(-3px) } }
  /* счётчики наверху Пути: изменилось число — оно коротко подпрыгивает */
  .ln-bump { display: inline-block; animation: ln-bump .45s cubic-bezier(.3,1.6,.5,1); }
  @keyframes ln-bump { 0% { transform: scale(1) } 35% { transform: scale(1.3); color: var(--u-ink) } 100% { transform: scale(1) } }
  .ln-stat { transition: border-color .2s, background-color .2s; }
  .ln-pin.rec::after { border-top-color: var(--ds-gold); }
  .ln-chest { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: inherit; cursor: pointer; font: 700 13.5px/1.25 var(--ds-head); }
  .ln-chest-art { display: inline-flex; filter: drop-shadow(0 2px 2px var(--ds-shade)); transition: transform .15s; }
  .ln-chest:hover .ln-chest-art { transform: translateY(-2px) rotate(-2deg); }
  .ln-chest[data-opened="false"] .ln-chest-art { animation: ln-chest-wiggle 2.8s ease-in-out infinite; }
  @keyframes ln-chest-wiggle { 0%, 82%, 100% { transform: none; } 86% { transform: rotate(-5deg); } 90% { transform: rotate(4deg); } 94% { transform: rotate(-2deg); } }
  @media (prefers-reduced-motion: reduce) { .ln-chest[data-opened="false"] .ln-chest-art { animation: none; } }
  .ln-pin::after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -5px; border: 5px solid transparent; border-bottom: 0; border-top-color: var(--u); }
  .ln-stop-title { background: none; border: none; padding: 2px 4px; font: 700 13.5px/1.25 var(--ds-head); max-width: 170px; text-align: center; cursor: pointer; color: var(--ds-ink); }
  .ln-stop-title.locked { color: var(--ds-ink3); }
  .ln-skip-tag { font: 700 12px var(--ds-sans); color: var(--ds-ink2); }
  .ln-overlay { position: fixed; inset: 0; z-index: 300; display: flex; flex-direction: column; }
  .ln-head { display: flex; align-items: center; gap: 10px; padding: calc(10px + env(safe-area-inset-top)) 14px 4px; max-width: 592px; width: 100%; margin: 0 auto; }
  /* прокрутка урока — только по вертикали и только когда содержимое правда длиннее экрана:
     встряска после ошибки и свайп карточки двигают его вбок (без overflow-x: hidden из-за
     overflow-y: auto появлялся горизонтальный ползунок), а появление шага — не сдвигом вниз
     (сдвиг на 14 px на миг давал вертикальный), а проявлением */
  /* «Газета»: подпись слева переносится, три кнопки справа — всегда в одну строку (жалоба mv79vr3e: съезжали на 360 px) */
  .ln-news-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 6px 0; padding: 6px 0; border-bottom: 1px dashed var(--ds-rule2); }
  .ln-news-row:last-child { border-bottom: none; }
  .ln-news-label { flex: 1; min-width: 0; font-size: 15px; line-height: 1.35; }
  .ln-news-btns { display: flex; gap: 6px; flex-shrink: 0; }
  .ln-news-btns .ds-chip { margin: 0; min-width: 46px; padding: 8px 0; }
  .ln-hard-note { display: flex; align-items: center; justify-content: space-between; gap: 6px 12px; flex-wrap: wrap; margin-top: 6px; font-size: 13.5px; }
  .ln-hard-note .ln-how { margin-top: 0; }
  .ln-calc-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px 12px; margin: 8px 0 10px; }
  .ln-numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-width: 320px; margin: 0 auto; }
  @media (max-width: 600px) { .ln-numpad .ds-key { padding: 10px 0; } }
  .ln-body { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 14px 16px 24px; }
  .ln-body .ds-rise { animation-name: ln-appear; }
  @keyframes ln-appear { from { opacity: 0; } to { opacity: 1; } }
  .ln-inner { max-width: 560px; margin: 0 auto; }
  .ln-foot { border-top: 2px solid var(--ds-rule); padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); background: var(--ds-paper); }
  .ln-foot.fb { padding: 0; border-top: none; }
  .ln-kind { margin-bottom: 8px; }
  .ln-prompt { margin-bottom: 12px; }
  /* урок на ПК — крупнее: на большом экране колонка телефона в 560 px терялась посередине. Шрифт
     крупнее всегда; весь урок (шапка, текст, графики, кнопки, плашка ответа) увеличивается целиком,
     только если окно достаточно высокое: по высоте после увеличения остаётся не меньше 760 px —
     не меньше, чем на телефоне (docs/mechanics.md). Низкое окно ноутбука — без увеличения */
  @media (min-width: 1000px) {
    .ln-body .ds-text { font-size: 19px; line-height: 1.5; }
    .ln-body .ds-opt { font-size: 18px; line-height: 1.4; padding: 15px 18px; }
    .ln-body .ds-h1 { font-size: 30px !important; }
  }
  @media (min-width: 1000px) and (min-height: 836px) { .ln-overlay .ln-head, .ln-overlay .ln-body, .ln-overlay .ln-foot { zoom: 1.1; } }
  @media (min-width: 1200px) and (min-height: 912px) { .ln-overlay .ln-head, .ln-overlay .ln-body, .ln-overlay .ln-foot { zoom: 1.2; } }
  @media (min-width: 1400px) and (min-height: 1003px) { .ln-overlay .ln-head, .ln-overlay .ln-body, .ln-overlay .ln-foot { zoom: 1.32; } }
  /* урок на телефоне — крупнее: экран почти пустой, а читать и попадать пальцем должно быть легко */
  @media (max-width: 600px) {
    .ln-body .ds-text { font-size: 19px; line-height: 1.5; }
    .ln-body .ln-prompt { margin-bottom: 14px; }
    .ln-body .ds-opt { font-size: 18px; line-height: 1.4; padding: 16px 14px 16px 16px; margin: 10px 0; }
    .ln-body .ds-h1 { font-size: 28px !important; }
    .ln-body .ds-eyebrow { font-size: 13px; }
    .ln-body .ln-legend, .ln-body .ln-key { font-size: 16px; }
    .ln-body .ln-key-tex { font-size: 22px; }
  }
  .tb-term { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: help; text-decoration: underline dotted var(--u-ink); text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .ln-term-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: var(--ds-card); border-top: 4px solid var(--u); border-radius: 22px 22px 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -10px 30px rgba(60,30,0,.16); }
  .ln-tickets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ln-tickets > div { border: 2px solid var(--ds-rule); border-radius: 14px; padding: 8px 4px; text-align: center; background: var(--ds-card); }
  .ln-tickets .v { font: 700 21px var(--ds-mono); margin-top: 2px; }
  .ln-ticket { display: flex; border: 2px solid var(--ds-rule); border-radius: 18px; background: var(--ds-card); overflow: hidden; box-shadow: 0 2px 0 var(--ds-rule); }
  .ln-ticket-main { flex: 1; min-width: 0; padding: 14px 14px 12px; }
  .ln-ticket-stub { width: 86px; background: color-mix(in srgb, var(--u) 13%, var(--ds-card)); display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 6px; color: var(--u-ink); position: relative; }
  .ln-album { display: flex; flex-wrap: wrap; gap: 10px; }
  .ln-key { margin-top: 14px; padding: 8px 12px 10px; border: 2px solid var(--u); border-radius: 10px; background: color-mix(in srgb, var(--u) 8%, var(--ds-card)); }
  .ln-key .ds-eyebrow { color: var(--u-ink); }
  .ln-key-tex { font-size: 19px; text-align: center; margin-top: 4px; overflow-x: auto; overflow-y: hidden; }
  .ln-legend { margin-top: 12px; padding: 8px 12px; border-left: 4px solid var(--u); background: color-mix(in srgb, var(--u) 6%, var(--ds-card)); font-size: 14.5px; line-height: 1.55; border-radius: 4px 12px 12px 4px; }
  .ln-how { background: none; border: none; padding: 4px 0; margin-top: 6px; font: 700 14px var(--ds-sans); color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
  .ln-verdict { margin-top: 10px; padding: 10px 12px; border-radius: 4px 12px 12px 4px; border-left: 4px solid; }
  .ln-verdict.ok { background: var(--ds-ok-bg); border-color: var(--ds-ok); }
  .ln-verdict.bad { background: color-mix(in srgb, var(--ds-sel-rule) 14%, var(--ds-card)); border-color: var(--ds-sel-rule); }
  .ln-verdict.ok .ds-answer-stamp { color: var(--ds-ok-ink); font-size: 13px; }
  .ln-verdict.bad .ds-answer-stamp { color: var(--ds-sel-ink); font-size: 13px; }
  .ln-book { min-height: 100vh; margin: -12px -16px 0; }
  /* кнопки учебника-справочника — те же, что у дизайн-системы: объёмные, со скруглением */
  .ln-textbook .ems-btn { font: 700 13.5px/1.25 var(--ds-sans); border: 2px solid var(--ds-rule2); border-bottom-width: 4px; border-radius: 12px; background: var(--ds-card);
    color: var(--u-ink); box-shadow: none; letter-spacing: 0; }
  .ln-textbook .ems-btn:hover { background: var(--ds-card2); border-color: var(--ds-rule2); box-shadow: none; }
  .ln-textbook .ems-btn.primary { background: var(--u); color: #fff; border-color: color-mix(in srgb, var(--u) 70%, #000); font: 700 13.5px/1.25 var(--ds-head); letter-spacing: .06em; text-transform: uppercase; }
  .ln-textbook .ems-btn.primary:hover { background: var(--u); filter: brightness(1.07); }
  .ln-textbook .ems-btn[aria-pressed="true"] { background: var(--ds-sel); color: var(--ds-sel-ink); border-color: var(--ds-sel-rule); }
  .ln-theory { border: 2px solid var(--ds-rule); border-left: 5px solid var(--u); border-radius: 6px 16px 16px 6px; background: var(--ds-card2); padding: 12px 14px; }
  .ln-level-text { font-size: 13.5px; line-height: 1.35; margin: -2px 2px 4px; }
  .ln-soon-head { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; color: inherit; font: inherit; padding: 12px 14px; cursor: pointer; text-align: left; }
`;

// ответы для e2e-тестов: только если тест сам включил флаг
const testAnswer = (inst) => {
  if (typeof window === 'undefined' || !window.__INFLATIA_TEST__) return undefined;
  switch (inst.kind) {
    case 'choice': case 'gap': return JSON.stringify(inst.options.find((o) => o.correct).key);
    case 'tf': return JSON.stringify(inst.answer);
    case 'match': return JSON.stringify(Object.fromEntries(inst.left.map((l) => [l.key, l.key])));
    case 'sort': return JSON.stringify(Object.fromEntries(inst.items.map((it) => [it.key, it.bin])));
    case 'calc': return JSON.stringify(String(Math.round(inst.answer * 100) / 100).replace('.', ','));
    case 'shift': return JSON.stringify(inst.answer);
    case 'news': return JSON.stringify(inst.expect);
    case 'tiles': return JSON.stringify(inst.solution);
    case 'curve': case 'price': case 'point': return JSON.stringify(inst.answer);
    case 'swipe': case 'rush': case 'keep': return JSON.stringify('game');
    case 'open': return JSON.stringify('open');
    case 'domino': return JSON.stringify(inst.chain);
    default: return undefined;
  }
};
const noopCtx = { progress: { problems: {}, read: {} }, go: () => {}, onAnswer: () => {} };
const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* нет вибрации */ } };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ------------------------------ ПРОГРЕСС ------------------------------ */
function useLearn() {
  const [progress, setProgress] = useState(loadProgress);
  const playerId = useMemo(getPlayerId, []);
  const timer = useRef(null);
  // opts.settle — после изменения выдать всё выполненное: задания дня, печати, бонусы серии
  // opts.whole — fn получает весь прогресс (с задачами учебника), а не только Путь
  const update = (fn, opts = {}) => {
    setProgress((mem) => {
      const p = latestProgress(mem);
      if (opts.whole) { const next = fn(p); return next === p ? mem : saveProgress(next); }
      let learn = fn(p.learn);
      if (opts.settle) learn = settle(learn, courseCtx(learn)).s;
      return learn === p.learn ? mem : saveProgress({ ...p, learn });
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; syncProfile(playerId).catch(() => {}); }, 2000);
  };
  /* тихая синхронизация (docs/mechanics.md): вернулись на вкладку (разблокировали телефон, пришли
     домой к компьютеру) и раз в минуту, пока вкладка открыта, — забираем общий прогресс профиля.
     Пройденный на телефоне урок появляется на компьютере сам, без перезагрузки. Не чаще раза в 20 с. */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let last = Date.now(); let alive = true;
    const pull = () => {
      if (document.hidden || Date.now() - last < 20000) return;
      last = Date.now();
      syncProfile(playerId).then((pf) => { if (alive && pf) setProgress(loadProgress()); }).catch(() => {});
    };
    const id = setInterval(pull, 60000);
    document.addEventListener('visibilitychange', pull);
    window.addEventListener('focus', pull);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', pull); window.removeEventListener('focus', pull); };
  }, [playerId]);
  // учебник записал прогресс (ответ снял ошибку с повторения Пути) — перечитываем
  useEffect(() => {
    const reload = (e) => { if (e.detail) setProgress((p) => (p === e.detail ? p : e.detail)); };
    window.addEventListener(PROGRESS_EVENT, reload);
    return () => window.removeEventListener(PROGRESS_EVENT, reload);
  }, []);
  useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((pf) => { if (alive && pf) setProgress(loadProgress()); }).catch(() => {});
    // уроки, которые не продолжили за сутки, — брошенные: только они портят долю доведённых
    const expired = takeExpiredResumes();
    if (expired.length) update((s) => expired.reduce((acc, r) => abandonLesson(acc, r.kind || 'choice', r.pos || 0), s));
    // купленные заморозки спасают серию сами — при открытии, если пропуск уже не покрыт недельной
    update((s) => fixMonth(chargePremiums(applyFreezes(s))));
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); syncProfile(playerId).catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);
  return [progress.learn, update];
}

// значок вида урока: на остановке Пути и в билете урока
export const KIND_ICON = { intro: BookOpen, practice: Dumbbell, words: Languages, story: MessageCircle, listen: Headphones, game: Gamepad2, review: Repeat, summary: Flag };

/* ------------------------------ ГРАФИК И КАРТИНКА ШАГА ------------------------------ */
function MiniChart({ type, attrs, values = null }) {
  const def = CHARTS[type];
  if (!def) return null;
  const v = { ...chartDefaults(type, attrs), ...values };
  // на Пути деньги — в кронах (src/learn/money.js)
  return <div style={{ maxWidth: 360, margin: '8px auto' }}><ChartSvg scene={sceneInCrowns(def.build(attrs, v))} /></div>;
}
const PICS = {
  clock: Clock, scale: Scale, hourglass: Hourglass, ticket: Ticket, 'trending-up': TrendingUp, 'circle-check': CircleCheck, medal: Medal,
  'arrow-left-right': ArrowLeftRight, handshake: Handshake, coffee: Coffee, wallet: Wallet, link: Link, utensils: Utensils, boxes: Boxes, users: Users,
  snowflake: Snowflake, 'arrow-down-to-line': ArrowDownToLine, 'arrow-up-to-line': ArrowUpToLine, croissant: Croissant, landmark: Landmark, radio: Radio, flag: Flag,
};
// картинка шага — значок в медальоне с розеткой, как клеймо на купюре
function Pic({ name }) {
  const Icon = PICS[name];
  if (!Icon) return null;
  return <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }} aria-hidden="true"><Rosette size={132} opacity={0.45}><Icon size={50} color="var(--u-ink)" strokeWidth={1.6} /></Rosette></div>;
}

/* ------------------------------ УПРАЖНЕНИЯ ------------------------------ */
// «___» в тексте вопроса → выбранная плитка
// пропуск «___» в условии: подставляем выбранный вариант узлами (с формулами), а не сырым текстом
const fillBlank = (blocks, word) => {
  const fill = (x) => {
    if (Array.isArray(x)) return x.flatMap((n) => {
      if (n && n.t === 'text' && n.v.includes('___')) {
        const k = n.v.indexOf('___');
        return [{ t: 'text', v: n.v.slice(0, k) }, ...(typeof word === 'string' ? [{ t: 'text', v: word }] : [{ t: 'b', c: word }]), { t: 'text', v: n.v.slice(k + 3) }];
      }
      return [fill(n)];
    });
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fill(v)]));
    return x;
  };
  return fill(blocks);
};

function ExerciseView({ inst, resp, setResp, locked, fb, ctx = noopCtx, onSubmit = () => {} }) {
  const pick = (v) => { if (!locked) { Audio.play('tick'); setResp(v); } };
  const optClass = (key, correct) => (!fb ? '' : correct ? 'right' : key === resp && !fb.ok ? 'wrong' : '');
  switch (inst.kind) {
    case 'choice': {
      // варианты — числа: задача на расчёт, и калькулятор нужен так же, как в «Расчёте»
      const numOf = (o) => { const m = String(o.raw).replace('−', '-').match(/^-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
      const numeric = inst.options.every((o) => numOf(o) != null);
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {numeric && !locked && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <button type="button" className="ds-chip" aria-pressed={!!inst._calc} data-testid="calc-open" onClick={() => { Audio.play('tick'); inst._setCalc(!inst._calc); }}>
                <Calculator size={15} style={{ verticalAlign: -3, marginRight: 4 }} aria-hidden="true" />Калькулятор
              </button>
            </div>
          )}
          {numeric && inst._calc && !locked && (
            <div style={{ marginBottom: 12 }}>
              <CalcPad useLabel="Выбрать ответ" onUse={(v) => {
                const x = Number(v.replace(',', '.'));
                const hit = inst.options.find((o) => Math.abs(numOf(o) - x) <= 0.011 * Math.max(1, Math.abs(x)));
                if (hit) { pick(hit.key); inst._setCalc(false); }
              }} />
            </div>
          )}
          {inst.options.map((o) => (
            <button key={o.key} type="button" className={`ds-opt ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
              onClick={() => pick(o.key)}><Inline nodes={o.text} ctx={ctx} /></button>
          ))}
        </div>
      );
    }
    case 'gap': {
      const chosen = inst.options.find((o) => o.key === resp);
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={fillBlank(inst.prompt, chosen ? chosen.text : '_____')} ctx={ctx} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
            {inst.options.map((o) => (
              <button key={o.key} type="button" className={`ds-chip ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
                onClick={() => pick(o.key)}><Inline nodes={o.text} ctx={ctx} /></button>
            ))}
          </div>
        </div>
      );
    }
    case 'tf':
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[[true, 'Верно'], [false, 'Неверно']].map(([v, l]) => (
              <button key={l} type="button" className={`ds-opt ${!fb ? '' : v === inst.answer ? 'right' : v === resp ? 'wrong' : ''}`} style={{ textAlign: 'center', fontWeight: 700 }}
                aria-pressed={resp === v} data-key={String(v)} disabled={locked} onClick={() => pick(v)}>{l}</button>
            ))}
          </div>
        </div>
      );
    case 'shift': {
      const curves = SHIFT_CURVES[inst.chart];
      const shown = fb ? inst.answer : resp;
      const ctl = shown ? CHARTS[inst.chart].controls(inst.chartAttrs).find((c) => c.id === curves[shown[0]].control) : null;
      const values = ctl ? { [ctl.id]: Math.round(ctl.max / 2) * (shown[1] === '+' ? 1 : -1) } : null;
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <MiniChart type={inst.chart} attrs={inst.chartAttrs} values={values} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {inst.choices.map((c) => (
              <button key={c.key} type="button" className={`ds-opt ${optClass(c.key, c.key === inst.answer)}`} style={{ textAlign: 'center', margin: 0 }}
                aria-pressed={resp === c.key} data-key={c.key} disabled={locked} onClick={() => pick(c.key)}>
                {c.button}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case 'news': {
      const r = resp || {};
      return (
        <div>
          <div className="tb-news" style={{ marginTop: 0 }}><div className="ems-mono tb-news-mast">ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div><div className="ems-serif tb-news-head">{inst.headline}</div></div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.vars.map((v) => (
            <div key={v.key} className="ln-news-row">
              <span className="ln-news-label">{v.label}</span>
              <span className="ln-news-btns">
                {[['+', '↑'], ['-', '↓'], ['0', '—']].map(([d, l]) => (
                  <button key={d} type="button" className={`ds-chip ${fb && inst.expect[v.key] === d ? 'right' : ''}`} aria-pressed={r[v.key] === d} data-var={v.key} data-dir={d}
                    aria-label={`${v.label}: ${({ '+': 'вверх', '-': 'вниз', 0: 'не изменится' })[d]}`} disabled={locked}
                    onClick={() => pick({ ...r, [v.key]: d })}>{l}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case 'match': {
      const r = resp || {};
      const [sel, setSel] = [inst._sel, inst._setSel];
      const pairNo = Object.fromEntries(Object.keys(r).map((l, i) => [l, i]));
      const rightOwner = Object.fromEntries(Object.entries(r).map(([l, rr]) => [rr, l]));
      const tone = (i) => ['#3E6FA8', '#2D7A4B', '#9C7218', '#B0392D', '#65408F'][i % 5];
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {/* пары на время: по нулю ответ уходит на проверку таким, какой есть */}
          {inst.timer && <TimerBar seconds={inst.timer} running={!locked} onEnd={() => onSubmit(inst._resp.current || {})} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>{inst.left.map((l) => (
              <button key={l.key} type="button" className="ds-opt" data-side="left" data-key={l.key} aria-pressed={sel === l.key} disabled={locked}
                style={{ fontSize: 14, borderColor: l.key in pairNo ? tone(pairNo[l.key]) : undefined }}
                onClick={() => { Audio.play('tick'); if (l.key in r) { const n = { ...r }; delete n[l.key]; setResp(n); setSel(null); } else setSel(l.key); }}>
                <Inline nodes={l.text} ctx={ctx} /></button>
            ))}</div>
            <div>{inst.right.map((x) => (
              <button key={x.key} type="button" className="ds-opt" data-side="right" data-key={x.key} disabled={locked || (!sel && !(x.key in rightOwner))}
                style={{ fontSize: 14, borderColor: x.key in rightOwner ? tone(pairNo[rightOwner[x.key]]) : undefined }}
                onClick={() => {
                  Audio.play('tick');
                  const n = { ...r };
                  if (x.key in rightOwner) delete n[rightOwner[x.key]];
                  if (sel) n[sel] = x.key;
                  setResp(n); setSel(null);
                }}><Inline nodes={x.text} ctx={ctx} /></button>
            ))}</div>
          </div>
        </div>
      );
    }
    case 'sort': {
      const r = resp || {};
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.items.map((it) => (
            <div key={it.key} style={{ border: `2px solid ${fb ? (r[it.key] === it.bin ? 'var(--ds-ok)' : 'var(--ds-bad)') : 'var(--ds-rule2)'}`, borderRadius: 14, padding: '9px 11px', margin: '9px 0', background: 'var(--ds-card)' }}>
              <div style={{ fontSize: 14.5, marginBottom: 4 }}><Inline nodes={it.text} ctx={ctx} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {inst.bins.map((b) => (
                  <button key={b} type="button" className="ds-chip" style={{ fontSize: 13, padding: '6px 10px' }} aria-pressed={r[it.key] === b} data-item={it.key} data-bin={b} disabled={locked}
                    onClick={() => pick({ ...r, [it.key]: b })}>{b}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'calc': {
      const val = resp || '';
      const press = (k) => { if (locked) return; Audio.play('tick'); if (k === 'del') setResp(val.slice(0, -1)); else if (val.length < 10) setResp(val + k); };
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {/* поле ответа и «Ответ / Калькулятор» — одной строкой: на телефоне задача и клавиши помещаются на экран */}
          <div className="ln-calc-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input value={val} onChange={(e) => !locked && setResp(e.target.value.replace(/[^0-9.,\-−/]/g, '').slice(0, 10))} inputMode="none" aria-label="Ответ числом"
                className="ds-field ds-num" style={{ width: 132, fontSize: 22, textAlign: 'center', padding: '6px 8px' }} />
              {inst.unit && <span style={{ fontSize: 15, color: 'var(--ds-ink2)' }} data-testid="calc-unit">{unitFor(inst, val)}</span>}
            </span>
            {!locked && (
              <span style={{ display: 'inline-flex', gap: 4 }} role="group" aria-label="Способ ввода">
                <button type="button" className="ds-chip" style={{ margin: 0 }} aria-pressed={!inst._calc} onClick={() => inst._setCalc(false)}>Ответ</button>
                <button type="button" className="ds-chip" style={{ margin: 0 }} aria-pressed={!!inst._calc} data-testid="calc-open" onClick={() => { Audio.play('tick'); inst._setCalc(true); }}>
                  <Calculator size={15} style={{ verticalAlign: -3, marginRight: 4 }} aria-hidden="true" />Калькулятор
                </button>
              </span>
            )}
          </div>
          {inst._calc && !locked ? <CalcPad onUse={(v) => { setResp(v.slice(0, 10)); inst._setCalc(false); }} /> : (
            <div className="ln-numpad" role="group" aria-label="Цифровая клавиатура">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map((k) => <button key={k} type="button" className="ds-key" disabled={locked} onClick={() => press(k)}>{k}</button>)}
              <button type="button" className="ds-key" aria-label="Стереть" disabled={locked} onClick={() => press('del')}><Delete size={20} /></button>
              <button type="button" className="ds-key" style={{ gridColumn: 'span 3', fontSize: 15 }} disabled={locked} onClick={() => press(val.startsWith('-') ? '' : '-')}
                aria-label="Минус">{val.startsWith('-') ? 'минус уже есть' : '− минус'}</button>
            </div>
          )}
        </div>
      );
    }
    // открытый вопрос: свой ответ словами, потом — разбор (неверного ответа нет)
    case 'open': {
      const val = resp || '';
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <textarea className="ds-field" data-testid="open-answer" value={val} disabled={locked} rows={5} maxLength={600}
            onChange={(e) => setResp(e.target.value)} aria-label="Ваш ответ" placeholder="Как бы вы поступили и почему? Пара предложений — своими словами."
            style={{ width: '100%', fontSize: 16, lineHeight: 1.45, resize: 'vertical', minHeight: 120 }} />
          {!locked && val.trim().length < OPEN_MIN && <div className="ds-sub" style={{ fontSize: 13, marginTop: 4 }}>Ещё пару слов — и можно отвечать.</div>}
        </div>
      );
    }
    case 'tiles': case 'curve': case 'price': case 'point': {
      const View = { tiles: TilesEx, curve: CurveEx, price: PriceEx, point: PointEx }[inst.kind];
      return (
        <div>
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <View inst={inst} resp={resp} setResp={(v) => !locked && setResp(v)} locked={locked} fb={fb} />
        </div>
      );
    }
    case 'domino':
      // цепочка собрана — задание уходит на проверку само
      return <DominoEx inst={inst} resp={resp} setResp={(v) => !locked && setResp(v)} locked={locked} fb={fb} onSubmit={onSubmit}
        prompt={<div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>} />;
    case 'keep':
      return (
        <div>
          <div className="ds-h2" style={{ marginBottom: 6 }}>{inst.title}</div>
          <KeepRound inst={inst} locked={locked} result={resp} best={inst._best || 0} intro={<div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>}
            onDone={(r) => { setResp(r); onSubmit(r); }} />
        </div>
      );
    case 'swipe': case 'rush': {
      return (
        <div>
          <div className="ds-h2" style={{ marginBottom: 6 }}>{inst.title}</div>
          {/* игра сама решает, когда она окончена, — и сразу уходит на проверку */}
          <GameRound inst={inst} locked={locked} result={resp} best={inst._best || 0} intro={<div className="ln-prompt ds-text tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>}
            onDone={(r) => { setResp(r); onSubmit(r); }} />
        </div>
      );
    }
    default: return null;
  }
}
// подпись повтора: что вернулось вместо задачи с ошибкой
const RETRY_TEXT = {
  numbers: 'Похожая задача с новыми числами — решите её сами.',
  sibling: 'Похожий вопрос на ту же тему.',
  same: 'Эта задача уже была — попробуем ещё раз.',
};
// итог урока с игрой: засчитана — с цифрами; нет — сколько не хватило и что это значит
const gameResultText = (result) => {
  const g = result.game;
  if (!g) return result.accuracy >= 100 ? 'Игра засчитана.' : 'Урок пройден, игра — без зачёта.';
  const wrong = g.answered - g.right;
  if (g.ok) return `Игра засчитана: верных ${g.right}, ошибок ${wrong}.`;
  return `Урок пройден, игра — без зачёта: не хватило ${gameLeft(g.right, g.answered)} (верных ${g.right}, ошибок ${wrong}). Нужно, чтобы верных было на ${GAME_PASS} больше, чем ошибок. Засчитанная игра даёт урок без помарок и алмаз.`;
};
// итог мини-игры для плашки
const gameLine = (inst, r) => (r ? `Верно ${r.right} из ${r.answered} · ${r.score} очков${r.record ? ' — новый рекорд!' : ''}` : '');

/* ------------------------------ УРОК ------------------------------
   mode: lesson — урок пути (diamond — на алмазном уровне); check — проверка юнита (ошибки не
   возвращаются, сдана при ≤ 1 ошибке); practice — повторение ошибок.
   Урок начат только с первого ответа: открыть и закрыть его — не считается нигде. Выход
   после первого ответа — с подтверждением; урок сохраняется и продолжается с того же места
   в течение суток (resume). */
// урок собирается под ученика: уровень сложности, ошибки, подсказки и слабые темы (src/learn/program.js)
function newPlan(run, learn) {
  // урок уже пройден — расчёты в нём с новыми числами
  if (run.mode === 'lesson') { const p = buildLesson(run.lessonId, Math.random, { ...lessonOpts(learn), diamond: !!run.diamond, replay: !!((learn.lessons || {})[run.lessonId] || {}).runs }); return { items: p.items, cards: p.cards, seconds: p.seconds, diamond: !!run.diamond }; }
  // проверка юнита или тест уровня (levelId): сдан — юнит или все юниты уровня сданы
  if (run.mode === 'check') { const p = run.levelId ? buildLevelCheck(run.levelId, Math.random, { seen: learn.seen || {} }) : buildUnitCheck(run.unitId, Math.random, { seen: learn.seen || {} }); return { items: p.items, cards: {}, passMistakes: p.passMistakes }; }
  if (run.mode === 'placement') return { items: buildPlacement().items, cards: {} };
  return { items: buildPractice(learn.mistakes.map((m) => m.id), Math.random, { weak: weakLessons(learn).map((w) => w.id) }).items, cards: {} };
}
function Runner({ run, learn, update, onClose, onOpenBook, hidden, guest = false }) {
  const rs = run.resume || null;
  const [plan] = useState(() => (rs ? rs.plan : newPlan(run, learn)));
  const lesson = run.lessonId ? LESSON_BY_ID[run.lessonId] : null;
  // пройден ли урок раньше — на момент начала (после финиша он уже в прогрессе); был ли уже алмаз
  const [replay] = useState(() => run.mode === 'lesson' && lessonDone(learn, run.lessonId));
  const diamond = !!plan.diamond;
  const [gem] = useState(() => !!(run.lessonId && learn.lessons[run.lessonId] && learn.lessons[run.lessonId].diamond));
  const [queue, setQueue] = useState(() => (rs ? rs.queue : plan.items));
  const [pos, setPos] = useState(rs ? rs.pos : 0);
  const cardsSeen = useRef(new Set(rs ? rs.cardsSeen : []));
  // голос Инфли: какие фразы уже звучали в этом уроке и сколько ошибок подряд
  const said = useRef(new Set());
  const wrongRun = useRef(0);
  const cardFor = (item) => (item && plan.cards && plan.cards[item.uid] && !cardsSeen.current.has(item.uid) ? plan.cards[item.uid] : null);
  const [stage, setStage] = useState(() => (cardFor((rs ? rs.queue : plan.items)[rs ? rs.pos : 0]) ? 'card' : 'work'));
  // карточки перед упражнением идут подряд: шаг, слово, пункт итогов
  const [cardIdx, setCardIdx] = useState(0);
  const respRef = useRef(null);
  const [resp, setResp] = useState(null);
  const [fb, setFb] = useState(null);
  const [sel, setSel] = useState(null);
  // калькулятор расчётного упражнения открыт; на следующем упражнении — снова клавиатура ответа
  const [calcOpen, setCalcOpen] = useState(false);
  const [how, setHow] = useState(false);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [term, setTerm] = useState(null);
  const [anim, setAnim] = useState({ k: 0, kind: null });
  /* Встряска после неверного ответа — перезапуском CSS-анимации на том же узле: обёртка
     упражнения после ответа не пересоздаётся, и раунд мини-игры не теряет свой счёт. */
  const shakeRef = useRef(null);
  useEffect(() => {
    const el = shakeRef.current;
    if (!el || anim.kind !== 'shake') return;
    el.classList.remove('ds-shake'); void el.offsetWidth; el.classList.add('ds-shake');
  }, [anim]);
  useEffect(() => { if (shakeRef.current) shakeRef.current.classList.remove('ds-shake'); }, [pos]);
  const [run3, setRun3] = useState(rs ? rs.streak || 0 : 0);
  // линия графика прогресса: первые попытки по порядку; pulse — короткая вспышка на верном ответе серии
  const [log, setLog] = useState(rs ? rs.log || [] : []);
  /* «Слушай» и «История» — лента: прошлые сообщения и отвеченные вопросы остаются в ней
     (и сохраняются вместе с прерванным уроком) */
  const feed = !!lesson && (lesson.kind === 'story' || lesson.kind === 'listen');
  const [history, setHistory] = useState(rs ? rs.history || [] : []);
  const [pulse, setPulse] = useState(0);
  /* время урока — только активное: вкладка видна и ученик недавно что-то делал (src/learn/active-time.js);
     itemStart — отметка этих часов на начале задания */
  const clock = useRef(activeClock(Date.now(), rs ? rs.elapsed || 0 : 0));
  const visibleNow = () => typeof document === 'undefined' || !document.hidden;
  const activeNow = () => { clock.current = tickClock(clock.current, Date.now(), visibleNow()); return clock.current.ms; };
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const act = () => { clock.current = actClock(clock.current, Date.now(), visibleNow()); };
    const vis = () => { clock.current = tickClock(clock.current, Date.now(), visibleNow()); };
    const id = setInterval(vis, 1000);
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, act, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); evs.forEach((e) => window.removeEventListener(e, act, { capture: true })); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const acc = useRef({
    first: rs ? rs.first : {}, hinted: rs ? rs.hinted : {}, solved: new Set(rs ? rs.solved : []),
    itemStart: clock.current.ms, retries: rs ? rs.retries : 0,
  });
  const [started, setStarted] = useState(!!rs);
  /* урок — слой поверх страницы: пока он открыт, страница под ним не прокручивается и не
     показывает свой ползунок (на ПК он висел сбоку урока, даже когда прокручивать нечего) */
  useEffect(() => {
    if (hidden || typeof document === 'undefined') return undefined;
    const els = [document.documentElement, document.body]; const was = els.map((el) => el.style.overflow);
    els.forEach((el) => { el.style.overflow = 'hidden'; });
    return () => { els.forEach((el, k) => { el.style.overflow = was[k]; }); };
  }, [hidden]);
  const retryable = run.mode === 'lesson' || run.mode === 'practice';
  const total = plan.items.length;
  const cur = queue[pos];
  const orig = cur ? (cur.orig || cur.uid) : null;
  // вступительный тест — в цвете юнита, который сейчас проверяется; алмазный уровень — в своём
  const color = diamond ? DIAMOND_COLOR : unitColor(lesson ? lesson.unitId : run.unitId || (cur && cur.placeUnit) || 'scarcity');

  // «Убрать из повторения» после ошибки в трудной задаче: из ошибок Пути и из повторения учебника,
  // повтор в конце урока тоже снимается
  const [dropped, setDropped] = useState(false);
  useEffect(() => { setDropped(false); }, [pos]);
  const dropHard = () => {
    if (!cur) return;
    Audio.play('paper');
    update((p) => dropFromReview(p, cur.of || cur.id), { whole: true });
    setQueue((q) => q.filter((x, i) => i <= pos || (x.orig || x.uid) !== orig));
    acc.current.solved.add(orig);
    setDropped(true);
  };
  const doCheck = (given) => {
    const answer = given !== undefined ? given : resp;
    if (!cur || fb || (given === undefined && !ready(cur, answer))) return;
    const r = check(cur, answer);
    if (r.empty) { setFb({ ok: false, why: null, empty: true }); return; }
    const a = acc.current;
    // урок начат — с первого ответа
    if (!started) { setStarted(true); update(startLesson); if (run.mode === 'lesson') track('lesson_start', { lesson: run.lessonId }); }
    const firstTime = !(orig in a.first);
    const ms = activeNow() - a.itemStart;
    if (firstTime) {
      a.first[orig] = r.ok;
      // аналитика без персональных данных: верно ли с первой попытки — по упражнению (api/events.js)
      track(r.ok ? 'ex_first_try_ok' : 'ex_first_try_fail', { exercise: String(cur.of || cur.id), ok: r.ok, ms });
      setLog((l) => [...l, r.ok]);
      if (r.ok && run3 >= 1) setPulse((p) => p + 1);
      // встреченное упражнение: в повторение и проверки первыми пойдут те, что виделись реже
      const seenId = cur.of || cur.id;
      update((s) => recordSeen(recordAttempt(s, cur.kind, r.ok, ms, { lesson: cur.lesson || null }), seenId));
      if (GAME_KINDS.includes(cur.kind) && answer && answer.score) update((s) => recordBest(s, cur.id, answer.score));
      if (GAME_KINDS.includes(cur.kind) && answer) a.game = { right: answer.right, answered: answer.answered, ok: r.ok };
    }
    if (r.ok) {
      a.solved.add(orig);
      // похожая задача вместо исходной отвечает за исходную: ошибка по ней снимается, подсказка переходит
      const baseId = cur.of || cur.id;
      if (run.mode === 'practice') update((s) => resolveMistake(s, baseId));
      // решено с подсказкой — невидимо уходит в «Повторение» пораньше; без подсказки — снимается
      update((s) => (a.hinted[orig] ? addHinted(s, baseId) : clearHinted(s, baseId)));
      // та же задача ждёт повторения в учебнике — это и есть её повторение (review-sync.js)
      if (!a.hinted[orig]) update((p) => afterPathAnswer(p, baseId), { whole: true });
      if (firstTime) setRun3((n) => n + 1);
      Audio.play('coin'); vibrate(15);
    } else {
      setRun3(0);
      Audio.play('down'); vibrate([30, 40, 30]);
      if (run.mode === 'lesson') update((s) => addMistake(s, cur.of || cur.id));
      // повтор в конце урока — не та же задача: новые числа или похожий вопрос на ту же мысль;
      // трудная задача (семинарская, олимпиадная) возвращается один раз, а не до победного
      if (retryable && !cur.noRetry && !(cur.hard && cur.retry)) {
        a.retries += 1;
        const copy = retryOf(cur, Math.random, queue.map((q) => q.of || q.id));
        setQueue((q) => [...q, { ...copy, uid: `${cur.uid}r${a.retries}`, orig, retry: true }]);
      }
      else a.solved.add(orig);
    }
    setAnim((x) => ({ k: x.k + 1, kind: r.ok ? 'flash' : 'shake' }));
    wrongRun.current = r.ok ? 0 : wrongRun.current + 1;
    const say = pickPhrase(situation({ ok: r.ok, streak: r.ok && firstTime ? run3 + 1 : 0, hinted: !!a.hinted[orig], retry: !!cur.retry, wrongRun: wrongRun.current }), said.current);
    setFb({ ok: r.ok, why: r.why, say });
  };
  const finish = () => {
    const a = acc.current;
    // подсказка ничем не наказывается: верно с первой попытки — полный опыт
    const firstOk = Object.values(a.first).filter(Boolean).length;
    const mistakes = Object.values(a.first).filter((x) => !x).length;
    // вступительный тест может закончиться раньше — точность по заданным вопросам
    const asked = run.mode === 'placement' ? Object.keys(a.first).length : total;
    const accuracy = asked ? (firstOk / asked) * 100 : 0;
    const ms = activeNow();
    const now = Date.now();
    let xp = 0; let pass = null; let opened = null;
    const done = { accuracy, now, seconds: ms / 1000, kind: lesson ? lesson.kind : null, mode: run.mode };
    let apply;
    if (run.mode === 'lesson') {
      track('lesson_done', { lesson: run.lessonId, ms });
      xp = lessonXp({ firstTry: firstOk, replay, diamond });
      apply = (s) => finishLesson(s, run.lessonId, { xp, ...done, diamond });
      dropResume(run.lessonId);
    } else if (run.mode === 'check') {
      pass = mistakes <= plan.passMistakes;
      xp = firstOk * XP.correct;
      const ids = run.levelId ? levelUnits(run.levelId).map((u) => u.id) : [run.unitId];
      apply = (s) => { const t = finishLesson(s, null, { xp, ...done }); return pass ? ids.reduce((x, id) => passUnit(x, id, { ace: mistakes === 0, now }), t) : t; };
    } else if (run.mode === 'placement') {
      // открытые тестом юниты — как сданные проверкой; тест не засчитывается уроком дня
      opened = placementOpened(plan.items, a.first);
      apply = (s) => setPlacement(opened.reduce((t, u) => passUnit(t, u, { now }), s), opened, now);
    } else {
      xp = firstOk * XP.correct;
      apply = (s) => finishLesson(s, null, { xp, ...done });
    }
    // купленный в лавке «двойной опыт»: пока действует, опыт за урок, практику и проверку — вдвое
    // (apply читает xp в момент вызова — удвоенный)
    const boosted = xp > 0 && boostActive(learn, now);
    if (boosted) xp *= 2;
    // монеты за урок и всё, что он выполнил: цель дня, задания, серия, печати
    const coins = runCoins({ mode: run.mode, replay, accuracy, pass, items: total, diamond, gem });
    const key = runKey({ mode: run.mode, lessonId: run.lessonId, replay, diamond, gem });
    const full = (s) => { const t = earn(apply(s), coins, key, now); return settle(t, courseCtx(t), now); };
    const preview = full(learn);
    // первый урок дня продлил серию — огонёк загорается на итогах крупно
    const before = streak(learn, now); const after = streak(preview.s, now);
    const streakUp = !before.today && after.today ? after.days : 0;
    update((s) => full(s).s);
    // касса: урок сдан
    Audio.play('register'); vibrate([20, 30, 20, 30, 60]);
    setResult({ xp, accuracy, ms, pass, mistakes, coins: key && hasClaim(learn, key) ? 0 : coins, gains: preview.gains, opened, boosted, streakUp, game: a.game || null });
    setStage('done');
  };
  const next = () => {
    Audio.play('paper');
    if (feed && cur && fb) setHistory((h) => [...h, { type: 'q', key: `q:${cur.uid}`, inst: marked, resp, fb }]);
    if (pos + 1 >= queue.length) { finish(); return; }
    // вступительный тест: пятёрка юнита провалена — дальше спрашивать незачем
    if (run.mode === 'placement' && cur && placementFailed(plan.items, acc.current.first, cur.placeUnit)) { finish(); return; }
    setPos(pos + 1); setResp(null); setFb(null); setSel(null); setTerm(null); setCalcOpen(false); setHow(false);
    acc.current.itemStart = activeNow();
    if (cardFor(queue[pos + 1])) setStage('card');
  };
  const openTerm = (id) => {
    Audio.play('tick');
    if (!fb && orig) acc.current.hinted[orig] = true;
    setTerm(id);
  };
  const termCtx = useMemo(() => ({ ...noopCtx, onTerm: openTerm }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [orig, fb]);
  // выход после первого ответа: урок сохраняется целиком и продолжается с того же места
  const leave = () => {
    if (run.mode === 'lesson' && started && stage !== 'done') {
      const a = acc.current;
      const at = fb && !fb.empty ? pos + 1 : pos;
      saveResume(run.lessonId, {
        plan: { items: plan.items, cards: plan.cards, seconds: plan.seconds, diamond }, queue, pos: Math.min(at, queue.length - 1),
        first: a.first, hinted: a.hinted, solved: [...a.solved], retries: a.retries, elapsed: activeNow(),
        cardsSeen: [...cardsSeen.current], streak: run3, log, kind: cur ? cur.kind : 'choice', history,
      });
      if (at >= queue.length) dropResume(run.lessonId);
    }
    onClose();
  };
  // пустой план (упражнения ошибок убраны из курса) — сразу итог
  useEffect(() => { if (stage === 'work' && !cur && !result) finish(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, cur, result]);
  // до первого ответа выход ничего не стоит и не спрашивает
  const exit = () => { if (stage === 'done' || !started) onClose(); else setAsking(true); };
  // термины условия — с подсказками; варианты ответа не размечаем: нажатие по ним — это выбор
  const marked = useMemo(() => (cur ? { ...cur, prompt: markTerms(cur.prompt) } : null), [cur]);
  respRef.current = resp;
  const inst = marked ? { ...marked, _sel: sel, _setSel: setSel, _resp: respRef, _calc: calcOpen, _setCalc: setCalcOpen, _best: (learn.best || {})[marked.id] || 0 } : null;
  const title = run.mode === 'lesson' ? `${diamond ? 'Алмазный уровень: ' : ''}${lesson.title}` : run.mode === 'check' ? (run.levelId ? `Тест уровня «${LEVEL_BY_ID[run.levelId].title}»` : 'Проверка юнита') : run.mode === 'placement' ? 'Вступительный тест' : 'Практика';

  const kindName = cur ? KIND_LABEL[cur.kind] : '';
  // плашка ответа в нижней панели — одна на все виды уроков: её видно без прокрутки
  const verdictBar = inst && fb && !fb.empty ? (
    <AnswerBar ok={fb.ok} stamp={GAME_KINDS.includes(inst.kind) ? (fb.ok ? 'Игра засчитана' : 'Игра без зачёта') : inst.kind === 'open' ? 'Ответ записан' : null}
      say={GAME_KINDS.includes(inst.kind) || inst.kind === 'open' ? null : fb.say} className={fb.ok ? 'ds-flash' : ''} key={`fb${anim.k}`}>
      <div style={{ marginTop: 10 }} data-testid="ex-feedback" data-ok={String(fb.ok)}>
        {inst.kind === 'open' && inst.explain && (
          <div className="tb-body" style={{ fontSize: 15, color: 'inherit' }} data-testid="open-review"><b>Разбор.</b> <Blocks blocks={inst.explain} ctx={noopCtx} /></div>
        )}
        {GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15 }} data-testid="game-result">{gameLine(inst, resp)}{!fb.ok && ` Для зачёта нужно: ${answerText(inst)}.`}</div>}
        {/* «не засчитано» читалось как «урок не засчитан» — а урок с игрой пройден в любом случае (docs/mechanics.md) */}
        {GAME_KINDS.includes(inst.kind) && !fb.ok && run.mode === 'lesson' && <div style={{ fontSize: 15, marginTop: 4 }} data-testid="game-lesson-note">Урок это не отменяет — он будет пройден, только без алмаза.</div>}
        {!fb.ok && !GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15 }}>Правильно: <b>{answerText(inst)}</b></div>}
        {!fb.ok && fb.why && <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.5 }} data-testid="ex-why"><Inline nodes={fb.why} ctx={noopCtx} /></div>}
        {!fb.ok && !fb.why && inst.explain && !inst.steps && <div className="tb-body" style={{ fontSize: 15, marginTop: 4, color: 'inherit' }}><Blocks blocks={inst.explain} ctx={noopCtx} /></div>}
        {!fb.ok && inst.explain && inst.steps && <StepsExplain blocks={inst.explain} key={inst.uid} />}
        {/* верный ответ на расчёт — ход решения по кнопке: важно не только число, но и почему так считают */}
        {fb.ok && inst.explain && !GAME_KINDS.includes(inst.kind) && inst.kind !== 'open' && (
          how ? <div className="tb-body" style={{ fontSize: 15, marginTop: 6, color: 'inherit' }} data-testid="ex-how"><Blocks blocks={inst.explain} ctx={noopCtx} /></div>
            : <button type="button" className="ln-how" data-testid="ex-how-open" onClick={() => { Audio.play('paper'); setHow(true); }}>Как решать</button>
        )}
        {!fb.ok && retryable && !inst.noRetry && !inst.hard && <div className="ds-sub" style={{ fontSize: 13.5, marginTop: 4 }}>{feed ? 'Вопрос вернётся в конце урока.' : 'Задача вернётся в конце урока.'}</div>}
        {/* трудная задача: вернётся один раз; не знаете, как решать, — можно убрать из повторения (docs/mechanics.md) */}
        {!fb.ok && retryable && inst.hard && (
          <div className="ln-hard-note" data-testid="hard-note">
            <span className="ds-sub">{dropped ? 'Убрано из повторения. Решить её можно в учебнике.' : inst.retry ? 'В этом уроке задача больше не вернётся.' : 'Задача вернётся в конце урока — один раз.'}</span>
            {!dropped && <button type="button" className="ln-how" data-testid="drop-review" onClick={dropHard}>Убрать из повторения</button>}
          </div>
        )}
        <Button variant={fb.ok ? 'ok' : 'warm'} wide onClick={next} autoFocus style={{ marginTop: 12 }}>Дальше</Button>
      </div>
    </AnswerBar>
  ) : null;
  const unitId = lesson ? lesson.unitId : run.unitId;

  return (
    <DsRoot theme={dsThemeId()} accent={color} className="ln-overlay" data-testid="lesson" data-mode={run.mode} data-diamond={diamond ? 'true' : undefined} role="dialog" aria-label={title}
      style={{ display: hidden ? 'none' : undefined }}>
      <ArtStyle /><style>{CSS + PLAY_CSS + FEED_CSS + REPORT_CSS + MODEL_CSS + DOMINO_CSS}</style>
      <div className="ln-head">
        {stage !== 'done' && <IconButton label="Выйти из урока" icon={X} data-nav="back" onClick={exit} />}
        <ProgressChart answers={log} total={total} pulse={pulse} />
        {/* Инфля надувается с каждым верным ответом подряд и мягко сдувается после ошибки */}
        <InflaMeter streak={run3} mood={fb && !fb.empty ? (fb.ok ? 'joy' : 'cheer') : 'hello'} size={34} />
      </div>

      {asking && (
        <Sheet label="Выйти из урока?" onClose={() => setAsking(false)}>
          <div style={{ textAlign: 'center' }}>
            <Heading level={2} title="Выйти из урока?" sub={run.mode === 'lesson' ? 'Прогресс урока сохранится — продолжить можно в течение суток.' : 'Эту проверку можно будет пройти заново.'} />
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              <Button wide onClick={() => setAsking(false)} autoFocus>Продолжить урок</Button>
              <Button variant="ghost" wide onClick={leave} style={{ '--u': 'var(--ds-bad-btn)' }}>Выйти</Button>
            </div>
          </div>
        </Sheet>
      )}

      {!feed && stage === 'card' && cur && cardFor(cur) && (() => {
        const list = cardFor(cur);
        const c = list[Math.min(cardIdx, list.length - 1)];
        const last = cardIdx >= list.length - 1;
        const firstStep = lesson && c === lesson.idea;
        const kind = lesson ? lesson.kind : 'intro';
        const heading = firstStep ? bareTitle(lesson.title) : c.title;
        // подпись над карточкой: вид урока на первой, дальше — «шаг», «слово», «итог N из M»
        const eyebrow = firstStep ? LESSON_KIND[kind] : kind === 'summary' ? `Итог ${cardIdx + 1} из ${list.length}` : kind === 'words' ? `Слово ${cardIdx + 1} из ${list.length}`
          : kind === 'story' ? 'История продолжается' : kind === 'listen' ? 'Слушаем дальше' : 'Шаг дальше';
        const go = () => {
          Audio.play('paper');
          if (!last) { setCardIdx(cardIdx + 1); return; }
          cardsSeen.current.add(cur.uid); acc.current.itemStart = activeNow(); setCardIdx(0); setStage('work');
        };
        const picture = c.chart ? <MiniChart type={c.chart} attrs={c.attrs} /> : c.pic ? <Pic name={c.pic} /> : null;
        // «Слова» — колода со своими кнопками: вспомнить, открыть, «Знаю» / «Ещё раз»
        if (c.flash) {
          const done = () => { cardsSeen.current.add(cur.uid); acc.current.itemStart = activeNow(); setCardIdx(0); setStage('work'); };
          return (
            <WordDeck key={cur.uid} cards={list} onDone={done}
              body={(inner) => (
                <div className="ln-body"><div className="ln-inner ds-rise" data-testid="lesson-card" data-style="flash">
                  <div className="ds-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="ln-kind" style={{ margin: 0 }}>{LESSON_KIND.words}</span><span style={{ flex: 1 }} />
                    <ReportFlag context={() => stepContext(c, lesson, 'Слова')} />
                  </div>
                  {inner}
                </div></div>
              )}
              foot={(buttons) => <div className="ln-foot"><div className="ln-inner">{buttons}</div></div>} />
          );
        }
        // «Откройте сами» — исследование со своей кнопкой: дальше — с четырёх разных цен
        if (c.discover) {
          return (
            <DiscoverDay key={`${cur.uid}:${c.id}`} card={c} onDone={go}
              body={(inner) => (
                <div className="ln-body"><div className="ln-inner ds-rise" data-testid="lesson-card" data-style="discover">
                  <div className="ds-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="ln-kind" style={{ margin: 0 }}>Откройте сами</span><span style={{ flex: 1 }} />
                    <ReportFlag context={() => stepContext(c, lesson, 'Откройте сами')} />
                  </div>
                  {inner}
                </div></div>
              )}
              foot={(button) => <div className="ln-foot"><div className="ln-inner">{button}</div></div>} />
          );
        }
        return (
          <>
            <div className="ln-body"><div className="ln-inner ds-rise" data-testid="lesson-card" data-style={kind} key={c.id}>
              <div className="ds-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="ln-kind" style={{ margin: 0 }}>{eyebrow}</span><span style={{ flex: 1 }} />
                <ReportFlag context={() => stepContext(c, lesson, eyebrow)} />
              </div>
              {kind === 'summary' ? (
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Rosette size={54} opacity={0.6}><span className="ds-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--u-ink)' }}>{cardIdx + 1}</span></Rosette>
                    <h2 className="ds-h2" style={{ flex: 1 }}>{heading}</h2>
                  </div>
                  <div className="ds-text" style={{ marginTop: 12 }}><Inline nodes={c.text} ctx={noopCtx} /></div>
                  <StepLegend nodes={c.text} unitId={unitId} />
                  {picture}
                </Card>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Mascot mood="think" size={46} />
                    <h2 className="ds-h1" style={{ flex: 1, fontSize: 25 }}>{heading}</h2>
                  </div>
                  <div className="ds-text" style={{ marginTop: 14 }}><Inline nodes={c.text} ctx={noopCtx} /></div>
                  {c.remember && <StepRemember tex={c.remember} />}
                  <StepLegend nodes={c.remember ? [...c.text, { t: 'math', v: c.remember }] : c.text} unitId={unitId} />
                  {picture}
                  {/* Инфля вспоминает механику лавки, которой ученик уже пользовался: тема знакома на деле */}
                  {(() => { const cb = callbackFor(c.id, learn); return cb ? <div className="lm-say" data-testid="step-callback" data-callback={cb.id}><Mascot mood="joy" size={38} /><span>{cb.text}</span></div> : null; })()}
                </>
              )}
            </div></div>
            <div className="ln-foot"><div className="ln-inner">
              <Button wide onClick={go}>{last ? (kind === 'summary' ? 'К тесту юнита' : 'Понятно') : 'Дальше'}</Button>
            </div></div>
          </>
        );
      })()}

      {!feed && stage === 'work' && inst && (
        <>
          <div className="ln-body"><div className="ln-inner" ref={shakeRef} key={inst.uid}
            data-testid="ex" data-kind={inst.kind} data-answer={testAnswer(inst)}>
            <div className="ln-kind ds-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {kindName}{inst.review && <span className="ds-badge">повторение</span>}
              {inst.hard && <span className="ds-badge" data-testid="ex-hard">{inst.hard >= 3 ? 'олимпиада' : 'семинар'}</span>}
              {inst.weak && <span className="ds-badge">слабая тема</span>}
              {inst.placeUnit && <span className="ds-badge">{placeOf(inst.placeUnit).place}</span>}
              <span style={{ flex: 1 }} />
              <ReportFlag context={() => exerciseContext(inst, { lesson, resp: respRef.current, correct: answerText(inst), mode: run.mode })} />
            </div>
            {inst.retry && !fb && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14 }} className="ds-sub" data-testid="ex-retry" data-fresh={inst.fresh || 'same'}>
                <RotateCcw size={16} aria-hidden="true" /> {RETRY_TEXT[inst.fresh] || RETRY_TEXT.same}
              </div>
            )}
            <ExerciseView inst={inst} ctx={termCtx} resp={resp} setResp={(v) => { setResp(v); if (fb && fb.empty) setFb(null); }} locked={!!fb && !fb.empty} fb={fb && !fb.empty ? fb : null}
              onSubmit={(v) => doCheck(v)} />
          </div></div>
          <div className={`ln-foot ${fb && !fb.empty ? `fb ${fb.ok ? 'ok' : 'bad'}` : ''}`} data-testid="lesson-foot">
            {fb && !fb.empty ? verdictBar : (
              <div className="ln-inner">
                {fb && fb.empty && <div style={{ fontSize: 14, color: 'var(--ds-bad)', marginBottom: 8 }}>Введите число: например, 25 или −0,5.</div>}
                {!GAME_KINDS.includes(inst.kind) && !SELF_CHECK.includes(inst.kind) && <Button wide disabled={!ready(inst, resp)} onClick={() => doCheck()}>{inst.kind === 'open' ? 'Ответить' : 'Проверить'}</Button>}
              </div>
            )}
          </div>
        </>
      )}

      {feed && stage !== 'done' && cur && (() => {
        const list = stage === 'card' ? cardFor(cur) : null;
        const idx = list ? Math.min(cardIdx, list.length - 1) : 0;
        const liveCard = list ? list[idx] : null;
        const last = !list || idx >= list.length - 1;
        let n = 0;
        const entries = history.map((h) => (h.type === 'msg'
          ? { kind: 'msg', key: h.key, card: h.card, index: (n += 1) }
          : { kind: 'q', key: h.key, node: <FeedAnswer h={h} />, flag: <ReportFlag context={() => exerciseContext(h.inst, { lesson, resp: h.resp, correct: answerText(h.inst) })} /> }));
        if (liveCard) entries.push({ kind: 'msg', key: `m:${cur.uid}:${idx}`, card: liveCard, index: (n += 1), live: true });
        else if (stage === 'work' && inst) {
          entries.push({ kind: 'q', key: `q:${inst.uid}`, live: true, flag: <ReportFlag context={() => exerciseContext(inst, { lesson, resp: respRef.current, correct: answerText(inst) })} />, node: (
            <div className={anim.kind === 'shake' && fb && !fb.ok ? 'ds-shake' : ''} data-testid="ex" data-kind={inst.kind} data-answer={testAnswer(inst)}>
              {inst.retry && !fb && <div className="ds-sub" style={{ fontSize: 14, marginBottom: 6 }} data-testid="ex-retry" data-fresh={inst.fresh || 'same'}><RotateCcw size={15} aria-hidden="true" style={{ verticalAlign: -2 }} /> {RETRY_TEXT[inst.fresh] || RETRY_TEXT.same}</div>}
              <ExerciseView inst={inst} ctx={termCtx} resp={resp} setResp={(v) => { setResp(v); if (fb && fb.empty) setFb(null); }} locked={!!fb && !fb.empty} fb={fb && !fb.empty ? fb : null} onSubmit={(v) => doCheck(v)} />
            </div>
          ) });
        }
        // аудиоурок: текст сообщений перед отвеченным вопросом открыт сам
        const lastQ = entries.map((e, i) => (e.kind === 'q' && !e.live ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
        entries.forEach((e, i) => { if (e.kind === 'msg') e.revealed = i < lastQ || (stage === 'work' && !!fb && !fb.empty && i < entries.length - 1); });
        const feedGo = () => {
          Audio.play('paper');
          setHistory((h) => [...h, { type: 'msg', key: `m:${cur.uid}:${idx}`, card: liveCard }]);
          if (!last) { setCardIdx(cardIdx + 1); return; }
          cardsSeen.current.add(cur.uid); acc.current.itemStart = activeNow(); setCardIdx(0); setStage('work');
        };
        return (
          <>
            <div className="ln-body"><div className="ln-inner">
              <Feed mode={lesson.kind} title={bareTitle(lesson.title)} skipTitle={lesson.title} entries={entries}
                flagFor={(e) => <ReportFlag context={() => stepContext(e.card, lesson, `сообщение ${e.index}`)} />}
                picture={(c) => (c.chart ? <MiniChart type={c.chart} attrs={c.attrs} /> : c.pic ? <Pic name={c.pic} /> : null)} />
            </div></div>
            <div className={`ln-foot ${fb && !fb.empty ? `fb ${fb.ok ? 'ok' : 'bad'}` : ''}`} data-testid="lesson-foot">
              {!liveCard && fb && !fb.empty ? verdictBar : (
                <div className="ln-inner">
                  {liveCard ? <Button wide onClick={feedGo}>{lesson.kind === 'listen' ? 'К вопросу' : 'Дальше'}</Button>
                    : <>
                      {fb && fb.empty && <div style={{ fontSize: 14, color: 'var(--ds-bad)', marginBottom: 8 }}>Введите число: например, 25 или −0,5.</div>}
                      {inst && !GAME_KINDS.includes(inst.kind) && !SELF_CHECK.includes(inst.kind) && <Button wide disabled={!ready(inst, resp)} onClick={() => doCheck()}>{inst.kind === 'open' ? 'Ответить' : 'Проверить'}</Button>}
                    </>}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {term && stage === 'work' && (
        <div className="ln-term-sheet ds-rise" role="dialog" aria-label={`Термин: ${termTitle(term)}`} data-testid="term-sheet">
          <div className="ln-inner">
            <div className="ds-eyebrow">Словарь</div>
            <div className="ds-h2" style={{ marginTop: 2 }}>{termTitle(term)}</div>
            <div className="ds-text" style={{ fontSize: 15.5, margin: '8px 0 14px' }}>{termText(term)}</div>
            {termFormula(term) && <div className="ln-key-tex" style={{ margin: '-4px 0 14px' }} data-testid="term-formula"><Inline nodes={[{ t: 'math', v: termFormula(term) }]} ctx={noopCtx} /></div>}
            <Button variant="secondary" wide onClick={() => setTerm(null)} autoFocus>Понятно</Button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="ln-body"><div className="ln-inner" data-testid="lesson-result">
          {(run.mode !== 'check' || result.pass) && <CoinShower seed={result.xp + 1} />}
          {/* итоги — как сертификат: гильош по краям, розетка-печать с Инфлей */}
          <Card style={{ padding: 0, overflow: 'hidden', textAlign: 'center', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 30, right: 14 }}>
              <ReportFlag context={() => ({ screen: 'result', mode: run.mode, lesson: lesson ? lesson.id : '', unit: unitId || '', answer: `точность ${Math.round(result.accuracy)}%, ошибок ${result.mistakes}, опыт ${result.xp}` })} />
            </span>
            <Guilloche height={22} />
            <div style={{ padding: '14px 16px 18px' }}>
              <div className="ds-eyebrow">{lesson ? `${placeOf(unitId).place} · ${LESSON_KIND[lesson.kind]}` : title}</div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
                <Rosette size={128} opacity={0.5}><Mascot mood={run.mode === 'check' && !result.pass ? 'cheer' : result.accuracy >= 60 ? 'party' : 'cheer'} size={70} /></Rosette>
              </div>
              <h2 className="ds-h1">{run.mode === 'check' ? (result.pass ? 'Проверка сдана' : 'Проверка пока не сдана') : run.mode === 'practice' ? 'Практика окончена' : run.mode === 'placement' ? 'Тест пройден' : 'Урок пройден'}</h2>
              {run.mode !== 'placement' && (
                <div className="ds-h3" style={{ color: 'var(--u-ink)', marginTop: 4 }} data-testid="result-say">
                  {pickPhrase(endKind({ mistakes: result.mistakes, accuracy: result.accuracy, failedCheck: run.mode === 'check' && !result.pass }), new Set())}
                </div>
              )}
              <div className="ds-sub" style={{ fontSize: 15.5, margin: '6px 0 16px' }} data-testid="result-text">
                {run.mode === 'placement' ? (result.opened.length
                  ? `Открыто сразу: ${result.opened.map((u) => `«${placeOf(u).place}»`).join(', ')}. ${result.opened.length >= UNITS.filter((u) => u.lessons.length).length ? 'Пройденные уроки можно взять на алмазном уровне.' : 'Путь продолжится со следующего места.'}`
                  : 'Начнём с самого начала — так надёжнее. Первые уроки короткие.')
                  : run.mode === 'check' && run.levelId ? (result.pass ? `${nextLevelText(run.levelId)} Уроки пройденного уровня тоже открыты.` : `Ошибок с первой попытки: ${result.mistakes}. Для зачёта — не больше ${plan.passMistakes}. Уроки уровня никуда не делись.`)
                  : run.mode === 'check' && run.review ? (result.pass ? 'Юнит не забыт: знания на месте.' : `Ошибок с первой попытки: ${result.mistakes}, для зачёта — не больше ${plan.passMistakes}. Стоит повторить уроки юнита — они открыты.`)
                  : run.mode === 'check' ? (result.pass ? 'Уроки юнита открыты — можно идти дальше.' : `Ошибок с первой попытки: ${result.mistakes}. Для зачёта — не больше ${plan.passMistakes}. Уроки юнита никуда не делись.`)
                  : lesson && lesson.kind === 'summary' ? `Тест юнита: верно ${Math.round((result.accuracy * total) / 100)} из ${total}. «${placeOf(unitId).place}» пройден.`
                    : lesson && lesson.kind === 'game' ? gameResultText(result)
                      : result.mistakes === 0 ? 'Все ответы — с первой попытки.' : `Ошибок с первой попытки: ${result.mistakes}.`}
                {diamond && <div style={{ marginTop: 6, color: 'var(--u-ink)', fontWeight: 700 }} data-testid="result-diamond">
                  {result.accuracy >= DIAMOND_ACCURACY ? '◆ Алмазный уровень взят' : `◆ Для алмаза нужно от ${DIAMOND_ACCURACY}% верных`}
                </div>}
              </div>
              {result.streakUp > 0 && <StreakBurst days={result.streakUp} />}
              <div className="ln-tickets">
                <div data-testid="result-xp"><div className="ds-eyebrow" style={{ fontSize: 12 }}>Опыт{result.boosted ? ' ×2' : ''}</div><div className="v"><CountUp value={result.xp} prefix="+" /></div></div>
                <div data-testid="result-acc"><div className="ds-eyebrow" style={{ fontSize: 12 }}>Точность</div><div className="v">{Math.round(result.accuracy)}%</div></div>
                <div data-testid="result-time"><div className="ds-eyebrow" style={{ fontSize: 12 }}>Время</div><div className="v">{mmss(result.ms)}</div></div>
              </div>
              <GainsList coins={result.coins} gains={result.gains} />
              {lesson && run.mode === 'lesson' && !replay && partsOfLesson(lesson.id).length > 0 && (
                <div className="ds-sub" style={{ fontSize: 14.5, marginTop: 10 }} data-testid="result-model">
                  В модель рынка добавлено: {partsOfLesson(lesson.id).map((p) => `«${p.title}»`).join(', ')}. Покрутить её можно на Пути, под юнитом.
                </div>
              )}
              {replay && !diamond && <div className="ds-faint" style={{ fontSize: 13.5, marginTop: 12 }}>Урок уже был пройден: за простой повтор — немного опыта и монет. На алмазном уровне задачи сложнее, а награда больше.</div>}
            </div>
            <Guilloche height={22} />
          </Card>
          {guest && <GuestSave learn={learn} afterLesson />}
          <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
            <Button wide data-nav="back" onClick={onClose}>Дальше</Button>
            {lesson && (
              <Button variant="ghost" wide icon={BookOpenText} data-testid="result-theory" data-nav-target={`book:chapter:${lesson.unitId}`}
                onClick={() => onOpenBook({ kind: 'chapter', id: lesson.unitId, anchor: lesson.section })}>Подробнее в учебнике</Button>
            )}
          </div>
        </div></div>
      )}
    </DsRoot>
  );
}
// контекст шага урока или сообщения ленты для «Сообщить об ошибке»
const stepContext = (card, lesson, where) => ({
  screen: 'step', lesson: lesson ? lesson.id : '', unit: lesson ? lesson.unitId : '', kind: lesson ? lesson.kind : '',
  step: `${where}${card && card.id ? ` · ${card.id}` : ''}${card && card.title ? ` · ${card.title}` : ''}`, prompt: flatText(card && card.text).slice(0, 1500),
});
/* Отвеченный вопрос в ленте (история, архив эфира): условие, выбор ученика и короткая
   отметка — верно или что было правильно. Живой вопрос получает плашку в нижней панели. */
function FeedVerdict({ inst, fb }) {
  return (
    <div className={`ln-verdict ${fb.ok ? 'ok' : 'bad'}`} data-ok={String(fb.ok)}>
      <span className="ds-answer-stamp">{fb.say || (fb.ok ? 'Верно' : 'Не совсем')}</span>
      {!fb.ok && <span style={{ fontSize: 14.5, marginLeft: 8 }}>Правильно: <b>{answerText(inst)}</b></span>}
    </div>
  );
}
function FeedAnswer({ h }) {
  const inst = { ...h.inst, _sel: null, _setSel: () => {}, _resp: { current: h.resp } };
  return (
    <div data-kind={inst.kind}>
      <ExerciseView inst={inst} resp={h.resp} setResp={() => {}} locked fb={h.fb} />
      <FeedVerdict inst={inst} fb={h.fb} />
    </div>
  );
}
/* Разбор по шагам — на уровне «по шагам» (точность ниже 60%): решение открывается по одному
   шагу, чтобы каждый можно было осмыслить. */
function StepsExplain({ blocks }) {
  const [n, setN] = useState(1);
  return (
    <div style={{ marginTop: 8 }} data-testid="steps" data-shown={n}>
      {blocks.slice(0, n).map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <span className="ds-num" style={{ fontWeight: 700, fontSize: 13, minWidth: 54 }}>Шаг {i + 1}</span>
          <div className="tb-body" style={{ fontSize: 15, color: 'inherit', flex: 1 }}><Blocks blocks={[b]} ctx={noopCtx} /></div>
        </div>
      ))}
      {n < blocks.length && <Button small variant="secondary" style={{ marginTop: 8 }} data-testid="steps-next" onClick={() => { Audio.play('paper'); setN(n + 1); }}>Следующий шаг</Button>}
    </div>
  );
}
/* Обозначения под шагом с формулами: каждая буква — что она значит (src/textbook/symbols.js).
   Шаг «В формуле Q_D = 100 − 2P …» — и под ним «Q_D — объём спроса…; P — цена…». */
const mathIn = (nodes, out = []) => { (nodes || []).forEach((n) => { if (n.t === 'math') out.push(n.v); else if (n.c) mathIn(n.c, out); }); return out; };
// серия на итогах урока: огонёк вспыхивает, счётчик дней перещёлкивается с прошлого на сегодняшний
const SPARKS = [-70, -35, 0, 35, 70, 110, -110];
function StreakBurst({ days }) {
  return (
    <div className="ln-burst" data-testid="result-streak" data-days={days} role="img" aria-label={`Серия: ${days} ${plural(days, 'день', 'дня', 'дней')} подряд`}>
      <span className="ln-burst-flame">
        {SPARKS.map((a) => <i key={a} style={{ '--a': `${a}deg` }} />)}
        <Flame size={52} color="var(--ds-bad)" fill="color-mix(in srgb, var(--ds-bad) 30%, transparent)" aria-hidden="true" />
      </span>
      <span style={{ textAlign: 'left' }} aria-hidden="true">
        <span className="ln-burst-num"><span className="old">{days - 1}</span><span className="new">{days}</span></span>
        <span className="ln-burst-cap">{plural(days, 'день', 'дня', 'дней')} подряд</span>
      </span>
    </div>
  );
}
// формула шага, по которой считают упражнения после него, — с пометкой «Запомнить», как в главе
function StepRemember({ tex }) {
  return (
    <div className="ln-key" data-testid="step-remember">
      <div className="ds-eyebrow" style={{ fontSize: 12 }}>Запомнить</div>
      <div className="ln-key-tex"><Inline nodes={[{ t: 'math', v: tex }]} ctx={noopCtx} /></div>
    </div>
  );
}
function StepLegend({ nodes, unitId }) {
  const list = symbolsOf(mathIn(nodes), unitId);
  if (!list.length) return null;
  return (
    <div className="ln-legend" data-testid="step-legend">
      <div className="ds-eyebrow" style={{ fontSize: 12, marginBottom: 2 }}>Обозначения</div>
      {list.map((x) => <div key={x.key}><Inline nodes={[{ t: 'math', v: x.key }]} ctx={noopCtx} /> — {inCrowns(x.text)}</div>)}
    </div>
  );
}
// «Знакомство: спрос» под подписью вида урока — просто «Спрос»
const bareTitle = (t) => { const x = String(t).replace(/^Знакомство:\s*/, ''); return x.charAt(0).toUpperCase() + x.slice(1); };

/* ------------------------------ БИЛЕТ УРОКА ------------------------------
   Нажатие на остановку ещё ничего не начинает: сначала билет — вид урока, название, минуты
   и опыт — и кнопка «Начать» (или «Продолжить», если урок был прерван). Пройденный урок
   можно взять на алмазном уровне — задачи сложнее, опыт и монеты больше — или просто
   повторить. Если тема слабая, первым предлагается простой повтор. */
/* «Теория уже была в уроке»: разделы, про которые больше не спрашиваем (удобство устройства) */
const THEORY_KEY = 'ems-learn-theory-known';
const readKnown = () => { try { const v = JSON.parse(localStorage.getItem(THEORY_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const addKnown = (id) => { try { localStorage.setItem(THEORY_KEY, JSON.stringify([...new Set([...readKnown(), id])].slice(-200))); } catch { /* приватный режим */ } };
function LessonSheet({ l, learn, weak = false, onStart, onClose, onOpenBook, onSkip = null }) {
  const lesson = LESSON_BY_ID[l.id];
  // уроку нужна теория из учебника, которой ученик ещё не видел — спросим перед стартом
  const [theory] = useState(() => (l.open && !l.done && !getResume(l.id) ? theoryNotice(lesson, learn, loadProgress(), readKnown()) : null));
  const [info] = useState(() => { const p = buildLesson(l.id); return { min: Math.max(2, Math.round(p.seconds / 60)), xp: p.items.length * XP.correct + XP.finish }; });
  const [gemInfo] = useState(() => { if (!l.done) return null; const p = buildLesson(l.id, Math.random, { diamond: true }); return { min: Math.max(2, Math.round(p.seconds / 60)), xp: Math.round((p.items.length * XP.correct + XP.finish) * XP.diamond) }; });
  const resume = l.open ? getResume(l.id) : null;
  const Icon = KIND_ICON[lesson.kind] || Dumbbell;
  const pl = placeOf(lesson.unitId);
  return (
    <Sheet label={`Урок: ${l.title}`} onClose={onClose} testid="lesson-sheet" data-lesson={l.id} style={{ '--u': pl.color }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginRight: -8 }}><IconButton label="Закрыть" icon={X} data-nav="back" onClick={onClose} size={22} /></div>
      <div className="ln-ticket">
        <div className="ln-ticket-main">
          <div className="ds-eyebrow">{LESSON_KIND[lesson.kind]} · {pl.place}</div>
          <div className="ds-h2" style={{ marginTop: 4 }}>{bareTitle(l.title)}</div>
          <div className="ds-num ds-sub" style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={15} aria-hidden="true" />≈{info.min} мин</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Coins size={15} aria-hidden="true" />до {info.xp} опыта</span>
            {/* пройденный урок — короткая отметка в строке билета, без печати поверх */}
            {l.done && <span data-testid="lesson-done-mark" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: l.diamond ? DIAMOND_COLOR : 'var(--ds-ok)', fontWeight: 700 }}>
              {l.diamond ? <Gem size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{l.diamond ? 'алмаз' : 'пройден'}
            </span>}
          </div>
        </div>
        <div className="ln-ticket-stub">
          <Icon size={30} aria-hidden="true" />
          <span className="ds-num" style={{ fontSize: 12 }}>№ {String(l.no).padStart(2, '0')}</span>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {l.skipped && <div className="ds-sub" style={{ fontSize: 14, textAlign: 'center', marginBottom: 10 }} data-testid="lesson-skipped-note">Урок пропущен: следующие уже открыты. Вернитесь, когда сможете слушать, — или пройдите текстом: «Не могу слушать» внутри урока.</div>}
        {!l.open ? (
          <div className="ds-sub" style={{ fontSize: 15, textAlign: 'center' }} data-testid="lesson-sheet-locked">
            <Lock size={15} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />Откроется после предыдущего урока — или сдайте проверку юнита.
          </div>
        ) : theory ? (
          <div className="ln-theory" data-testid="theory-notice">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <BookOpenText size={22} color="var(--u-ink)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.45 }}>
                Для этого урока нужна теория из учебника: раздел <b>«{theory.section.title}»</b>{theory.section.minutes ? `, ≈${theory.section.minutes} мин` : ''}.
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <Button wide variant="secondary" icon={BookOpenText} data-testid="theory-open"
                onClick={() => { Audio.play('paper'); onClose(); onOpenBook({ kind: 'chapter', id: theory.chapter, anchor: theory.section.id }); }}>Открыть теорию</Button>
              <Button wide data-testid="lesson-start" onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id }); }}>Начать без теории</Button>
              <Button wide variant="ghost" data-testid="theory-known"
                onClick={() => { Audio.prime(); Audio.play('click'); addKnown(theory.section.id); onStart({ mode: 'lesson', lessonId: l.id }); }}>Теория уже была в уроке</Button>
            </div>
          </div>
        ) : resume || !l.done ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <Button wide data-testid="lesson-start" onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id, resume }); }}>
              {resume ? 'Продолжить' : 'Начать'}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {(() => {
              const gemBtn = (
                <Button key="gem" wide variant={weak ? 'secondary' : 'primary'} icon={Gem} data-testid="lesson-diamond" style={{ '--u': DIAMOND_COLOR }}
                  onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id, diamond: true }); }}>
                  Алмазный уровень
                </Button>
              );
              const plainBtn = (
                <Button key="plain" wide variant={weak ? 'primary' : 'ghost'} data-testid="lesson-start" onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id }); }}>
                  Повторить без усложнения
                </Button>
              );
              return weak ? [plainBtn, gemBtn] : [gemBtn, plainBtn];
            })()}
            <div className="ds-sub" style={{ fontSize: 13.5, textAlign: 'center' }} data-testid="lesson-diamond-info">
              Алмазный уровень: задачи сложнее{lesson.inner.some((c) => c.diamond) ? ', теория глубже' : ''}, ≈{gemInfo.min} мин, до {gemInfo.xp} опыта и {l.diamond ? '5' : '25–35'} монет.
              {weak && ' Тема пока даётся трудно — сначала стоит повторить.'}
            </div>
          </div>
        )}
        {/* «Слушай» можно пропустить, не заходя в урок: следующий урок откроется (docs/mechanics.md) */}
        {lesson.kind === 'listen' && l.open && !l.done && !l.skipped && onSkip && (
          <Button wide variant="ghost" data-testid="lesson-skip" style={{ marginTop: 8 }} onClick={() => onSkip(l.id)}>Не могу слушать сейчас — пропустить</Button>
        )}
        {resume && <div className="ds-faint" style={{ fontSize: 13, textAlign: 'center', marginTop: 8 }}>Урок сохранён с того места, где вы вышли.</div>}
      </div>
    </Sheet>
  );
}

/* ------------------------------ ПУТЬ ------------------------------ */
const SEEN_KEY = 'ems-learn-open-seen';
const readSeen = () => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); return Array.isArray(v) ? new Set(v) : null; } catch { return null; } };
const writeSeen = (set) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* приватный режим */ } };

function TopStats({ learn, bell = null }) {
  const st = streak(learn); const g = goalToday(learn);
  const totalXp = Object.values(learn.xp).reduce((a, b) => a + b, 0);
  return (
    // у каждого счётчика подпись для чтения с экрана: значок и сокращение её не заменяют
    <div className="ln-stats" data-testid="path-stats" role="group" aria-label="Ваш прогресс">
      {/* огонёк: сегодня уже занимались — горит (цветной, с галочкой); ещё нет — блёклый, ждёт урока */}
      <span className={`ln-stat ln-streak${st.today ? ' on' : st.days ? ' wait' : ''}`} data-testid="streak-chip" data-today={String(st.today)}
        title={st.today ? 'Серия продлена сегодня' : st.days ? 'Сегодня ещё не занимались: один урок — и серия продлится' : 'Серия дней'}>
        <span className="ln-flame-wrap"><Flame size={17} color={st.today ? 'var(--ds-bad)' : 'var(--ds-ink3)'} fill={st.today ? 'color-mix(in srgb, var(--ds-bad) 35%, transparent)' : 'none'} aria-hidden="true" />
          {st.today && <i className="ln-flame-ok" aria-hidden="true"><Check size={9} strokeWidth={4} /></i>}</span>
        <span className="ds-sr">Серия, дней: </span><span data-testid="streak" key={st.days} className="ln-bump">{st.days}</span><small aria-hidden="true">дн.</small>
        <span className="ds-sr">{st.today ? ', сегодня продлена' : st.days ? ', сегодня ещё не продлена' : ''}</span>
      </span>
      <span className="ln-stat" title="Опыт"><Sparkles size={16} color="var(--u-ink)" aria-hidden="true" /><span className="ds-sr">Опыт: </span><span key={totalXp} className="ln-bump">{totalXp}</span><small aria-hidden="true">опыт</small></span>
      <WalletStat learn={learn} />
      <span className="ln-stat" title={`Цель дня — ${g.goal} минут занятий`} data-testid="goal" style={{ color: g.done >= g.goal ? 'var(--ds-ok)' : undefined }}><Target size={17} aria-hidden="true" /><span className="ds-sr">Цель дня, минут занятий: </span><span key={Math.min(g.done, g.goal)} className="ln-bump">{Math.min(g.done, g.goal)}</span>/{g.goal}<small aria-hidden="true">мин</small></span>
      {bell}
    </div>
  );
}

/* Карта Инфляции: берег, округа, река Велья, и дорога через места юнитов. Здание места —
   гравюра; пройденный юнит его «оживляет» (цвет, свет в окнах, дым). Нажатие по месту —
   прокрутка к юниту на дороге ниже. */
const MAP_BOX = { x: 130, y: 70, w: 780, h: 610 };
// sel — юниты, которые сейчас на экране Пути (выбранный уровень): их места в сплошном кольце
function Atlas({ states, sel = [], onPick }) {
  const units = UNITS.map((u, k) => ({ u, no: k + 1, st: states.find((x) => x.course.id === u.id), pl: placeOf(u.id) }));
  const onPath = units.filter((x) => x.st);
  const route = units.map((x) => x.pl.at);
  const doneTill = onPath.reduce((k, x, i) => (x.st.complete ? i + 1 : k), 0);
  // места ещё без уроков — точки на дороге; их здания появятся, когда юнит выйдет на Путь
  const cur = onPath.find((x) => !x.st.complete) || null;
  const pathD = (pts) => (pts.length > 1 ? `M${pts[0][0]},${pts[0][1]}${curveTo(pts)}` : '');
  return (
    <Card className="ln-atlas" data-testid="atlas">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px 6px' }}>
        <div><div className="ds-eyebrow">Путь</div><div className="ds-h3">Дорога по Инфляции</div></div>
        <span className="ds-faint ds-num" style={{ fontSize: 12 }}>{onPath.filter((x) => x.st.complete).length}/{UNITS.length} мест</span>
      </div>
      <svg viewBox={`${MAP_BOX.x} ${MAP_BOX.y} ${MAP_BOX.w} ${MAP_BOX.h}`} width="100%" role="img" aria-label="Карта Инфляции: места юнитов на дороге" style={{ display: 'block', borderRadius: 4 }}>
        <defs>
          <pattern id="ln-sea" width="28" height="18" patternUnits="userSpaceOnUse"><path d="M0,10 q7,-5 14,0 t14,0" fill="none" stroke="#5F82B3" strokeWidth="1" opacity=".22" /></pattern>
        </defs>
        {/* море — голубоватая тушь с волнами, суша — бумага */}
        <rect x={MAP_BOX.x} y={MAP_BOX.y} width={MAP_BOX.w} height={MAP_BOX.h} fill="color-mix(in srgb, #5F82B3 8%, var(--ds-card))" />
        <rect x={MAP_BOX.x} y={MAP_BOX.y} width={MAP_BOX.w} height={MAP_BOX.h} fill="url(#ln-sea)" />
        <path d={countryPath} fill="var(--ds-paper)" stroke="var(--ds-ink2)" strokeWidth="2.6" />
        <path d={innerBorderPath} fill="none" stroke="var(--ds-rule2)" strokeWidth="1.6" strokeDasharray="6 6" />
        <path d={`M${RIVER[0][0]},${RIVER[0][1]}${curveTo(RIVER)}`} fill="none" stroke="#5F82B3" strokeWidth="3.2" opacity=".75" />
        {/* дорога через все места: пройденная часть — сплошная тушь, дальше — пунктир */}
        <path d={pathD(route)} fill="none" stroke="var(--ds-card2)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathD(route)} fill="none" stroke="var(--ds-ink3)" strokeWidth="2.4" strokeDasharray="8 8" strokeLinecap="round" />
        {doneTill > 0 && <path d={pathD(route.slice(0, doneTill + 1))} fill="none" stroke="var(--u-ink)" strokeWidth="4" strokeLinecap="round" />}
        {units.filter((x) => !x.st).map(({ u, pl }) => (
          <circle key={u.id} cx={pl.at[0]} cy={pl.at[1]} r="7" fill="var(--ds-card)" stroke="var(--ds-ink3)" strokeWidth="2" data-testid="atlas-place" data-unit={u.id} data-alive="false" />
        ))}
        {onPath.map(({ u, st, pl }) => {
          const alive = st.complete; const here = cur && cur.u.id === u.id;
          const [x, y] = pl.at;
          return (
            <g key={u.id} style={{ '--u': pl.color, cursor: 'pointer' }} data-testid="atlas-place" data-unit={u.id} data-alive={String(alive)} data-selected={String(sel.includes(u.id))}
              onClick={() => onPick(u.id)} role="button" aria-label={`${pl.place}: к юниту`} aria-current={sel.includes(u.id) ? 'true' : undefined}>
              {/* спокойно: места уровня на экране — тонкое кольцо приглушённого цвета юнита, текущее — пунктир цвета юнита
                  (жалоба «карта вырвиглазная»: пять толстых ярких колец подряд кричали) */}
              {here && <circle cx={x} cy={y - 26} r="57" fill="none" stroke="color-mix(in srgb, var(--u) 70%, var(--ds-card))" strokeWidth="2.5" strokeDasharray="5 6" />}
              {sel.includes(u.id) && <circle cx={x} cy={y - 26} r="51" fill="none" stroke="color-mix(in srgb, var(--u) 45%, var(--ds-card))" strokeWidth="2.5" />}
              <circle cx={x} cy={y - 26} r="49" fill="var(--ds-card)" opacity=".8" />
              <EngravingG kind={pl.building} alive={alive} x={x - 54} y={y - 72} scale={0.9} color={pl.color} />
              <text x={x} y={y + 28} textAnchor="middle" fontSize="23" fontWeight="700" fill="var(--ds-ink)" stroke="var(--ds-paper)" strokeWidth="6" paintOrder="stroke">{pl.place}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

// после сданного теста уровня: какой уровень открылся
const nextLevelText = (levelId) => { const k = LEVELS.findIndex((l) => l.id === levelId); const next = LEVELS[k + 1]; return next ? `Уровень «${next.title}» открыт — Путь уже на нём.` : 'Это последний уровень курса.'; };

/* Остановки юнита на дороге: жетоны вдоль извилистой дороги. Пройденная — в цвете юнита с
   сургучной печатью, текущая — с золотым кольцом и флажком «Вы здесь», закрытая — пунктир. */
const ROW = 118; const ZIG = [0, 64, 92, 64, 0, -64, -92, -64];
// название остановки (170 px) не выходит за края дороги шириной W
const STOP_HALF = 85;
const titleShift = (x, W) => Math.max(0, STOP_HALF - x) - Math.max(0, x + STOP_HALF - W);
/* Убранство дороги: у каждой остановки, на другой стороне от неё, — дерево, фонарь, куст или
   верстовой столб с номером урока; в начале юнита — указатель с названием места. У пройденных
   остановок убранство в цвете юнита («дорога оживает»), у закрытых — серое. Чисто украшение:
   скрыто от чтения с экрана и не ловит нажатий. */
function Prop({ kind, x, y, alive, no, scale = 1, flip = false }) {
  const ink = alive ? 'var(--u-ink)' : 'var(--ds-ink3)';
  const fill = alive ? 'var(--u)' : 'var(--ds-rule2)';
  const o = alive ? 1 : 0.55;
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -scale : scale},${scale})`} opacity={o} className="ln-prop" data-prop={kind}>
      {kind === 'tree' && <>
        <line x1="0" y1="2" x2="0" y2="22" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="0" cy="-8" r="13" fill={fill} fillOpacity=".22" stroke={ink} strokeWidth="1.6" />
        <circle cx="-7" cy="-2" r="7" fill={fill} fillOpacity=".18" stroke={ink} strokeWidth="1.2" />
        <path d="M-6 -12 l4 4 M2 -14 l4 4 M-2 -4 l4 4" stroke={ink} strokeWidth="1" opacity=".7" />
        <line x1="-9" y1="22" x2="9" y2="22" stroke={ink} strokeWidth="1.2" opacity=".6" />
      </>}
      {kind === 'lamp' && <>
        <line x1="0" y1="-16" x2="0" y2="22" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <path d="M0 -16 q8 0 10 6" fill="none" stroke={ink} strokeWidth="1.6" />
        <circle cx="10" cy="-7" r="4" fill={alive ? 'var(--ds-gold)' : 'none'} fillOpacity=".8" stroke={ink} strokeWidth="1.4" />
        {alive && <circle cx="10" cy="-7" r="9" fill="var(--ds-gold)" opacity=".18" />}
        <line x1="-6" y1="22" x2="6" y2="22" stroke={ink} strokeWidth="1.6" />
      </>}
      {kind === 'bush' && <>
        <circle cx="-8" cy="14" r="8" fill={fill} fillOpacity=".2" stroke={ink} strokeWidth="1.3" />
        <circle cx="6" cy="12" r="10" fill={fill} fillOpacity=".24" stroke={ink} strokeWidth="1.3" />
        <circle cx="-1" cy="6" r="7" fill={fill} fillOpacity=".2" stroke={ink} strokeWidth="1.2" />
        <line x1="-16" y1="22" x2="16" y2="22" stroke={ink} strokeWidth="1.2" opacity=".6" />
      </>}
      {kind === 'mile' && <>
        <path d="M-9 22 V2 q0 -9 9 -9 q9 0 9 9 V22 Z" fill="var(--ds-card)" stroke={ink} strokeWidth="1.6" />
        <text x="0" y="12" textAnchor="middle" fontSize="10" fontWeight="700" fill={ink} fontFamily="var(--ds-head)">{no}</text>
        <line x1="-13" y1="22" x2="13" y2="22" stroke={ink} strokeWidth="1.2" />
      </>}
    </g>
  );
}
/* Расстановка без линейки: вид, смещение, размер и соседи у каждой остановки свои, но
   постоянные — из хэша id урока (дорога не «пляшет» при каждом открытии). Иногда у
   остановки пусто, иногда дерево с кустом; верстовой столб — изредка, с номером урока. */
const hashOf = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };
function propsFor(id, i, W, y, left) {
  const r = rng(hashOf(id));
  if (r() < 0.18) return [];
  const pick = r();
  const kind = i % 5 === 3 && pick < 0.5 ? 'mile' : pick < 0.45 ? 'tree' : pick < 0.7 ? 'bush' : pick < 0.9 ? 'lamp' : 'tree';
  const side = (dx) => (left ? dx : W - dx);
  const main = { kind, x: side(26 + r() * 42), y: y - 30 + r() * 56, scale: 0.72 + r() * 0.44, flip: kind !== 'mile' && r() < 0.5 };
  const out = [main];
  // у дерева иногда куст рядом — пара, а не одиночка
  if (kind === 'tree' && r() < 0.45) out.push({ kind: 'bush', x: main.x + (left ? 1 : -1) * (14 + r() * 10), y: main.y + 8 + r() * 6, scale: 0.55 + r() * 0.2, flip: r() < 0.5 });
  return out;
}
function Route({ st, seen, reduced, visible, resumes, onLesson, rec = null, chest = null, onChest }) {
  const W = 300;
  // пройденный юнит — в конце дороги сундук
  const n = st.lessons.length + (chest ? 1 : 0);
  const pts = Array.from({ length: n }, (_, i) => [W / 2 + ZIG[i % ZIG.length], i * ROW + 60]);
  const lastDone = st.lessons.reduce((k, l, i) => (l.done ? i : k), -1);
  const seg = (list) => (list.length > 1 ? `M${list[0][0]},${list[0][1]}${curveTo(list)}` : '');
  return (
    <div className="ln-route" style={{ width: W, height: n * ROW + 10 }}>
      <svg viewBox={`0 0 ${W} ${n * ROW + 10}`} width={W} height={n * ROW + 10} aria-hidden="true">
        <path d={seg(pts)} fill="none" stroke="var(--ds-rule2)" strokeWidth="16" strokeLinecap="round" opacity=".55" />
        <path d={seg(pts)} fill="none" stroke="var(--ds-card)" strokeWidth="11" strokeLinecap="round" />
        <path d={seg(pts)} fill="none" stroke="var(--ds-rule2)" strokeWidth="1.5" strokeDasharray="6 7" />
        {lastDone >= 0 && <path d={seg(pts.slice(0, lastDone + 2))} fill="none" stroke="var(--u-ink)" strokeWidth="2.5" strokeDasharray="6 7" />}
        {st.lessons.map((l, i) => {
          // на другой стороне дороги от остановки; у остановки посередине — по очереди слева и справа
          const z = ZIG[i % ZIG.length];
          const left = z > 0 || (z === 0 && i % 8 === 0);
          return propsFor(l.id, i, W, pts[i][1] - 4, left).map((pp, k) => <Prop key={`${l.id}:${k}`} {...pp} alive={l.done} no={l.no} />);
        })}
      </svg>
      {st.lessons.map((l, i) => {
        const isCur = st.current && st.current.id === l.id;
        const isRec = rec === l.id;
        const lesson = LESSON_BY_ID[l.id];
        const unlocking = !reduced && visible && l.open && !l.done && !seen.has(l.id);
        const KindIcon = KIND_ICON[lesson.kind] || Dumbbell;
        const cls = l.done ? `done${l.diamond ? ' diamond' : ''}` : l.skipped ? 'skipped' : l.open ? '' : 'locked';
        return (
          <div key={l.id} className="ln-stop" style={{ left: pts[i][0], top: pts[i][1] - 31 }}>
            {/* отметка: прерванный урок — «продолжить»; программа советует — «рекомендуем сейчас» */}
            {(isCur || isRec) && (
              <span className={`ln-pin ${isRec && !resumes.has(l.id) ? 'rec' : ''}`} data-testid={isRec ? 'path-rec' : undefined}>
                {resumes.has(l.id) ? 'продолжить' : isRec ? 'рекомендуем сейчас' : 'вы здесь'}
              </span>
            )}
            <button type="button" className={`ln-token ${cls} ${isCur ? 'cur' : ''}`} data-testid="path-lesson" data-lesson={l.id} data-kind={lesson.kind} data-rec={isRec ? 'true' : undefined}
              data-state={l.done ? 'done' : l.open ? 'open' : 'locked'} data-diamond={l.diamond ? 'true' : undefined} data-skipped={l.skipped ? 'true' : undefined} data-nav-target={`lesson:${l.id}`}
              aria-label={`${LESSON_KIND[lesson.kind]} ${l.no}: ${l.title}${l.diamond ? ', взят на алмазном уровне' : l.done ? ', пройден' : l.skipped ? ', пропущен' : l.open ? '' : ', закрыт'}`}
              onClick={() => { Audio.prime(); Audio.play('click'); onLesson(l); }}>
              {l.done ? <><KindIcon size={26} /><span className={`ln-seal ${l.diamond ? 'diamond' : ''}`} aria-hidden="true">{l.diamond ? <Gem size={13} strokeWidth={2.6} /> : <Check size={13} strokeWidth={3.2} />}</span></>
                : unlocking ? (
                  <span style={{ position: 'relative', display: 'inline-flex' }} data-testid="unlock-anim">
                    <Lock size={24} className="ds-unlock" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
                    <KindIcon size={26} className="ds-appear" style={{ animationDelay: '.7s', animationFillMode: 'backwards' }} />
                  </span>
                ) : l.open ? <KindIcon size={26} /> : <Lock size={22} />}
            </button>
            {/* название — тоже кнопка урока: в жетон на телефоне попадают не всегда */}
            {/* у остановки с краю дороги название сдвинуто внутрь: иначе оно вылезает за экран
                узкого телефона, страница становится шире, и нижняя панель обрезается */}
            <button type="button" className={`ln-stop-title ${l.open ? '' : 'locked'}`} tabIndex={-1} aria-hidden="true" data-testid="path-lesson-title" data-lesson={l.id}
              style={{ transform: titleShift(pts[i][0], W) ? `translateX(${titleShift(pts[i][0], W)}px)` : undefined }}
              onClick={() => { Audio.play('click'); onLesson(l); }}>{l.title}{l.skipped && <span className="ln-skip-tag"> · пропущен</span>}</button>
          </div>
        );
      })}
      {chest && (
        <div className="ln-stop" style={{ left: pts[n - 1][0], top: pts[n - 1][1] - 31 }}>
          <button type="button" className="ln-chest" data-testid="chest" data-unit={chest.unitId} data-opened={String(chest.opened)} data-nav-target={`chest:${chest.unitId}`}
            aria-label={chest.opened ? 'Сундук юнита открыт' : 'Сундук юнита: открыть'} onClick={() => { Audio.play('click'); onChest(chest.unitId); }}>
            <span className="ln-chest-art"><Chest size={60} open={false} spent={chest.opened} label={chest.opened ? 'Сундук открыт' : 'Сундук юнита'} /></span>
            <span>{chest.opened ? 'Сундук открыт' : 'Сундук юнита'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* Живая модель юнита: свёрнутая — одной строкой (что это, сколько деталей собрано), касание
   раскрывает саму модель (улица, график, ползунки), «Свернуть» — обратно. На телефоне она
   свёрнута, пока её не откроют; на ПК (side — правая колонка) открыта, но тоже сворачивается,
   и выбор запоминается на устройстве. */
const MODEL_SIDE_KEY = 'ems-model-side-open';
function ModelFold({ unitId, learn, side = false }) {
  const [open, setOpenRaw] = useState(() => {
    if (!side) return false;
    try { return localStorage.getItem(MODEL_SIDE_KEY) !== '0'; } catch { return true; }
  });
  const setOpen = (v) => {
    setOpenRaw(v);
    if (side) { try { localStorage.setItem(MODEL_SIDE_KEY, v ? '1' : '0'); } catch { /* приватный режим */ } }
  };
  const prog = modelProgress(unitId, learn);
  const gap = side ? 0 : 10;
  if (open) {
    return (
      <Card style={{ marginTop: gap }} data-testid="model-open">
        <MarketModel unitId={unitId} learn={learn} compact />
        <Button variant="ghost" small icon={ChevronDown} data-testid="model-fold-close" style={{ marginTop: 6 }} onClick={() => { Audio.play('paper'); setOpen(false); }}>Свернуть модель</Button>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: gap, padding: 0 }}>
      <button type="button" className="ln-fold-row" data-testid="model-fold" data-open={prog.open} aria-expanded="false" onClick={() => { Audio.play('paper'); setOpen(true); }}>
        <Coffee size={20} color="var(--u-ink)" aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="ds-eyebrow" style={{ display: 'block' }}>Живая модель юнита</span>
          <span style={{ font: '700 15px var(--ds-head)' }}>{prog.open ? `Рынок капучино: ${prog.open} из ${prog.total} деталей` : 'Соберётся по ходу юнита'}</span>
        </span>
        <ChevronRight size={18} color="var(--ds-ink3)" aria-hidden="true" />
      </button>
    </Card>
  );
}
// «К карте»: видна, пока карта Пути за верхом экрана
function ToMap({ target }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  if (!show) return null;
  return (
    <button type="button" className="ln-to-map" data-testid="to-map" aria-label="Наверх, к карте" title="Наверх, к карте" onClick={() => { Audio.play('paper'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
      <ArrowUp size={22} aria-hidden="true" />
    </button>
  );
}
// урок, к которому ведёт Путь: «рекомендуем», иначе текущий, иначе первый открытый
const focusLesson = (root, unitId = null) => {
  if (!root) return null;
  const scope = unitId ? root.querySelector(`[data-testid="path-unit"][data-unit="${unitId}"]`) : root;
  if (!scope) return null;
  return scope.querySelector('[data-testid="path-lesson"][data-rec="true"]') || scope.querySelector('.ln-token.cur') || scope.querySelector('[data-testid="path-lesson"][data-state="open"]');
};

/* Юниты Пути: номер, место, уровень; reach — в юните есть открытый урок. */
const pathUnits = (states) => UNITS.map((u, k) => ({ u, no: k + 1, st: states.find((x) => x.course.id === u.id), pl: placeOf(u.id), lv: levelOf(u.id) }))
  .filter((x) => x.st).map((x) => ({ ...x, reach: x.st.lessons.some((l) => l.open) }));
/* Уровни Пути: юниты с уроками на каждом уровне; open — в уровне есть открытый урок (туда можно
   перейти), done — сколько юнитов пройдено или сдано, soon — готовых юнитов пока нет. test — у
   первого закрытого уровня после открытых: его открывает тест предыдущего уровня (prev). */
function pathLevels(list) {
  const rows = LEVELS.map((lv, k) => {
    const units = list.filter((x) => x.u.level === lv.id);
    return { lv: { ...lv, no: k + 1 }, units, open: units.some((x) => x.reach), done: units.filter((x) => x.st.complete || x.st.tested).length, soon: !units.length };
  });
  const real = rows.filter((x) => !x.soon);
  const k = real.findIndex((x) => !x.open);
  if (k > 0) real[k].test = real[k - 1].lv.id;
  return rows;
}
const levelColor = (row) => (row.units[0] ? row.units[0].pl.color : 'var(--ds-ink3)');
function levelStatus(row, levels) {
  if (row.soon) return 'строится — гайды готовых глав уже можно читать';
  const cur = row.units.find((x) => x.st.current);
  if (row.done === row.units.length && row.units.every((x) => x.st.complete)) return `пройден · юнитов ${row.units.length} из ${row.units.length}`;
  if (row.open) return `${cur ? `сейчас: «${cur.st.current.title}» · ` : ''}юнитов пройдено ${row.done} из ${row.units.length}`;
  if (row.test) return `тест по уровню «${LEVEL_BY_ID[row.test].title}»: сдадите — этот уровень откроется`;
  const before = levels.slice(0, row.lv.no - 1).reverse().find((x) => !x.soon && !x.open);
  return `закрыт · сначала откройте уровень «${(before || row).lv.title}»`;
}

/* Плашка уровня наверху Пути: номер, название, «из скольких» и сколько юнитов пройдено.
   ‹ — на уровень назад, › — на следующий, если он открыт; закрыт — замок, касание открывает
   список уровней с тестом. Касание плашки — тот же список. */
function LevelSwitch({ levels, sel, onSel, onOpen }) {
  const real = levels.filter((x) => !x.soon);
  const k = real.findIndex((x) => x.lv.id === sel);
  const cur = real[k]; const prev = real[k - 1]; const next = real[k + 1];
  const nextLocked = !!(next && !next.open);
  const prevLocked = !!(prev && !prev.open);
  return (
    <div className="ln-switch" data-testid="level-switch" data-level={sel} style={{ '--u': levelColor(cur) }}>
      <IconButton label={!prev ? 'Это первый уровень' : prevLocked ? `Уровень «${prev.lv.title}» закрыт` : `Уровень назад: «${prev.lv.title}»`} icon={prevLocked ? Lock : ChevronLeft} size={prevLocked ? 20 : 24}
        className="ln-switch-arrow" data-testid="level-prev" data-locked={String(prevLocked)} disabled={!prev}
        onClick={() => { if (!prev) return; Audio.play('paper'); if (prevLocked) onOpen(prev.lv.id); else onSel(prev.lv.id); }} />
      <button type="button" className="ln-switch-plate" data-testid="level-switch-open" aria-haspopup="dialog" aria-label={`Уровень ${cur.lv.no} из ${LEVELS.length}: ${cur.lv.title}. Выбрать уровень`}
        onClick={() => { Audio.play('paper'); onOpen(); }}>
        <span className="ln-unit-no" aria-hidden="true">{cur.lv.no}</span>
        <span className="ln-switch-txt">
          <span className="ds-eyebrow">Уровень {cur.lv.no} из {LEVELS.length}</span>
          <span className="ln-switch-place">{cur.lv.title} <span className="ln-switch-count">юнитов {cur.done} из {cur.units.length}</span></span>
        </span>
        <ChevronDown size={20} color="var(--ds-ink3)" aria-hidden="true" />
      </button>
      <IconButton label={!next ? 'Дальше уровни строятся' : nextLocked ? `Уровень «${next.lv.title}» закрыт: пройти тест` : `Следующий уровень: «${next.lv.title}»`} icon={nextLocked ? Lock : ChevronRight} size={nextLocked ? 20 : 24}
        className="ln-switch-arrow" data-testid="level-next" data-locked={String(nextLocked)} disabled={!next}
        onClick={() => { if (!next) return; Audio.play('paper'); if (nextLocked) onOpen(next.lv.id); else onSel(next.lv.id); }} />
    </div>
  );
}

/* Список уровней: в открытый — перейти, у первого закрытого — «Пройти тест» (тест предыдущего
   уровня), дальние закрытые — после него, уровни без готовых юнитов — «строится». */
function LevelPicker({ levels, sel, focus, onSel, onTest, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current && ref.current.querySelector(`[data-level="${focus || sel}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [focus, sel]);
  return (
    <Sheet label="Уровни Пути" onClose={onClose} testid="level-picker">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <IconButton label="Закрыть" icon={X} data-nav="back" onClick={onClose} />
        <div className="ds-h3" style={{ flex: 1 }}>Уровни Пути</div>
      </div>
      <div className="ds-sub" style={{ fontSize: 13.5, margin: '0 0 10px' }}>На Пути — юниты одного уровня. Назад можно всегда; следующий уровень откроется, когда пройдёте уроки уровня или сдадите его тест.</div>
      <div className="ln-pick" ref={ref}>
        {levels.map((x) => {
          const state = x.soon ? 'soon' : x.open ? (x.units.every((y) => y.st.complete) ? 'done' : 'open') : 'locked';
          const body = (
            <>
              <span className="ln-unit-no" aria-hidden="true">{x.lv.no}</span>
              <span className="ln-pick-txt">
                <span className="ln-pick-title" style={{ display: 'block', color: x.open ? 'var(--u-ink)' : 'var(--ds-ink2)' }}>{x.lv.title}</span>
                <span className="ln-pick-sub" style={{ display: 'block' }}>{x.lv.text}</span>
                {x.units.length > 0 && <span className="ln-pick-sub" style={{ display: 'block' }}>Юниты: {x.units.map((y) => y.pl.place).join(' · ')}</span>}
                <span className="ln-pick-sub" style={{ display: 'block', fontWeight: 600 }} data-testid="level-pick-status">{levelStatus(x, levels)}</span>
                {x.test && (
                  <span style={{ display: 'block', marginTop: 8 }}>
                    <Button small variant={x.lv.id === focus ? 'primary' : 'secondary'} icon={Sparkles} data-testid="level-pick-test" data-nav-target={`check:level:${x.test}`}
                      onClick={() => { Audio.prime(); onTest(x.test, x.lv.id); }}>Пройти тест</Button>
                  </span>
                )}
              </span>
            </>
          );
          if (x.open) {
            return (
              <button key={x.lv.id} type="button" className="ln-pick-row" data-testid="level-pick" data-level={x.lv.id} data-state={state} aria-current={x.lv.id === sel ? 'true' : undefined}
                style={{ '--u': levelColor(x) }} onClick={() => { Audio.play('paper'); onSel(x.lv.id); }}>
                {body}
                {x.lv.id === sel ? <Check size={20} color="var(--u-ink)" aria-label="сейчас на экране" /> : <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />}
              </button>
            );
          }
          return (
            <div key={x.lv.id} className="ln-pick-row" data-testid="level-pick" data-level={x.lv.id} data-state={state}
              style={{ '--u': levelColor(x), ...(x.soon ? { background: 'transparent', borderStyle: 'dashed' } : {}) }}>
              {body}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* Выбранный уровень Пути помнится и после ухода на другую вкладку (экран Пути при этом
   закрывается) — пока не сменился текущий уровень; jump — уровень, который откроет сдаваемый тест. */
let pathMem = { level: null, cur: null, jump: null };

/* Свёртка пройденного юнита после сундука: тело юнита (модель и дорога) плавно сжимается в ноль,
   соседи снизу подъезжают — без скачка прокрутки. */
function Collapse({ closing, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !closing) return;
    el.style.maxHeight = `${el.scrollHeight}px`; el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'max-height .62s cubic-bezier(.4,0,.2,1), opacity .4s ease, transform .62s ease';
    el.style.maxHeight = '0px'; el.style.opacity = '0'; el.style.transform = 'scale(.97)';
  }, [closing]);
  return <div ref={ref} className="ln-unit-body">{children}</div>;
}

function PathView({ learn, update, onLesson, onStart, onOpenBook, onChest, onTasks, visible, homeTick = 0, folded: foldReq = null, bell = null }) {
  const states = pathState(learn);
  const rec = recommend(learn, states);
  const recTitle = rec ? LESSON_BY_ID[rec.lessonId].title : null;
  const askPlacement = !!(learn.profile && learn.profile.knows) && !(learn.placement && learn.placement.at);
  const sleepy = missedYesterday(learn);
  const g = goalToday(learn);
  const hello = g.done >= g.goal ? 'joy' : sleepy ? 'sleep' : 'hello';
  const first = states.find((x) => x.current) || states[0];
  // уровень текущего юнита — «Миру» (хранится наибольший): с «Среднего» продвинутые панели партии открыты сразу
  const levelNo = first ? LEVELS.indexOf(levelOf(first.course.id)) : 0;
  useEffect(() => { writeLearnLevel(Math.max(0, levelNo)); }, [levelNo]);
  const [soonOpen, setSoonOpen] = useState(false);
  /* На Пути — юниты одного уровня. По умолчанию — уровень, где ученик сейчас (иначе последний
     открытый); выбранный вручную держится, пока текущий уровень не сменился. Сданный тест
     уровня — сразу на открытом им уровне. */
  const list = pathUnits(states);
  const levels = pathLevels(list);
  const curUnit = first && first.current ? list.find((x) => x.u.id === first.course.id) : [...list].reverse().find((x) => x.reach) || list[0];
  const curLevel = curUnit ? curUnit.u.level : null;
  const [chosen, setChosenState] = useState(() => (pathMem.cur === curLevel ? pathMem.level : null));
  const setChosen = (id) => { pathMem = { ...pathMem, level: id, cur: curLevel }; setChosenState(id); };
  const [picker, setPicker] = useState(null); // null — закрыт, иначе { focus }
  useEffect(() => { if (pathMem.cur !== curLevel) { pathMem = { ...pathMem, level: null, cur: curLevel }; setChosenState(null); } }, [curLevel]);
  const openLevel = (id) => levels.some((x) => x.lv.id === id && x.open);
  useEffect(() => {
    const id = pathMem.jump;
    if (id && openLevel(id)) { pathMem = { level: id, cur: curLevel, jump: null }; setChosenState(id); }
  });
  const sel = chosen && openLevel(chosen) ? chosen : curLevel;
  const selRow = levels.find((x) => x.lv.id === sel);
  const shown = list.filter((x) => x.u.level === sel);
  /* Пройденный юнит с открытым сундуком сворачивается в одну карточку: уровень не уезжает
     вниз длинной лентой. Развернуть — по кнопке, на время этого экрана. */
  const [unfolded, setUnfolded] = useState({});
  const resumes = new Set(resumeIds());
  /* Замок открывшегося урока анимируется один раз, когда Путь снова на виду (урок и билет
     его закрывают). При первом запуске уже открытое — без анимации. */
  const reduced = useReducedMotion();
  const openIds = states.flatMap((s) => s.lessons.filter((l) => l.open).map((l) => l.id));
  const [seen, setSeen] = useState(() => readSeen() || new Set(openIds));
  useEffect(() => {
    if (!visible) return undefined;
    const fresh = openIds.filter((id) => !seen.has(id));
    if (!fresh.length) { writeSeen(seen); return undefined; }
    const t = setTimeout(() => { const next = new Set([...seen, ...fresh]); writeSeen(next); setSeen(next); }, 1600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIds.join(), visible]);
  /* Выбор уровня в списке — его юниты на экране, к уроку, который советует Путь; касание места
     на карте — к этому юниту (уровень закрыт — список уровней с тестом). При открытии Путь
     сразу стоит на рекомендованном уроке — посередине экрана. */
  const rootRef = useRef(null);
  const atlasRef = useRef(null);
  const [scrollTo, setScrollTo] = useState({ n: 0, unit: null });
  const show = (levelId, unit = null) => { setPicker(null); setChosen(levelId); setScrollTo((x) => ({ n: x.n + 1, unit })); };
  const pick = (unitId) => {
    const x = list.find((y) => y.u.id === unitId);
    if (x && openLevel(x.u.level)) show(x.u.level, unitId); else if (x) setPicker({ focus: x.u.level });
  };
  useEffect(() => {
    if (!scrollTo.n) return;
    const lesson = focusLesson(rootRef.current, scrollTo.unit);
    const el = lesson || (scrollTo.unit && document.getElementById(`unit-${scrollTo.unit}`));
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: lesson ? 'center' : 'start' });
  }, [scrollTo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = focusLesson(rootRef.current);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, []);
  /* Сундук открыт (docs/mechanics.md, «Навигация»): Путь подводит шапку юнита к верху экрана, дорога
     юнита сворачивается, юнит становится строкой — и Путь сам едет к рекомендованному уроку. */
  const [folding, setFolding] = useState(null);
  const [justFolded, setJustFolded] = useState(null);
  useEffect(() => {
    if (!foldReq || !foldReq.n) return undefined;
    const unit = foldReq.unit;
    const head = document.getElementById(`unit-${unit}`);
    if (reduced || !head) { setScrollTo((x) => ({ n: x.n + 1, unit: null })); return undefined; }
    setFolding(unit);
    head.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t1 = setTimeout(() => setFolding((f) => (f === unit ? `${unit}:closing` : f)), 420);
    const t2 = setTimeout(() => { setFolding(null); setJustFolded(unit); setScrollTo((x) => ({ n: x.n + 1, unit: null })); }, 1100);
    const t3 = setTimeout(() => setJustFolded(null), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [foldReq && foldReq.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // повторное касание вкладки «Путь» — снова текущий уровень и рекомендованный урок, где бы ни был экран
  useEffect(() => {
    if (!homeTick) return;
    setChosen(null); setPicker(null); setScrollTo((x) => ({ n: x.n + 1, unit: null }));
  }, [homeTick]);
  // строящиеся юниты выбранного уровня — строкой внизу; будущих уровней на Пути не видно
  const soon = UNITS.map((u, k) => ({ u, no: k + 1 })).filter(({ u }) => u.level === sel && !states.some((x) => x.course.id === u.id));
  /* ПК (от 1024 px): две колонки — слева карта и юниты уровня, справа закреплены задания дня и
     живая модель юнита этого уровня (под самим юнитом её тогда нет). На телефоне — одна колонка. */
  const wide = useWide();
  const sideModel = wide ? ((shown.find((x) => hasModel(x.u.id)) || { u: {} }).u.id || null) : null;
  return (
    <div ref={rootRef} className={`ln-wrap${wide ? ' ln-path-wide' : ''}`} data-testid="path" data-layout={wide ? 'columns' : 'column'}>
      <div className="ln-path-main">
      <TopStats learn={learn} bell={bell} />
      {!wide && <TasksEntry learn={learn} onOpen={onTasks} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Mascot mood={hello} size={44} />
        <div className="ds-sub" style={{ fontSize: 15, lineHeight: 1.4 }}>
          {rec && rec.weak ? `Слабое место — «${LESSON_BY_ID[rec.weak.lessonId].title}»: его задачи первыми придут в «Повторение». А дальше по Пути — «${recTitle}».`
            : g.done >= g.goal ? 'Цель дня выполнена — можно и дальше.' : sleepy ? 'Инфля заскучала. Одна остановка — и снова в пути.' : first && first.current ? `Следующая остановка: «${first.current.title}»` : 'Уроки по 3–5 минут.'}
        </div>
      </div>
      {askPlacement && <PlacementCard onStart={() => onStart({ mode: 'placement' })} onSkip={() => { Audio.play('paper'); update((s) => setPlacement(s, [])); }} />}
      <div ref={atlasRef}><Atlas states={states} sel={shown.map((x) => x.u.id)} onPick={pick} /></div>
      <ToMap target={atlasRef} />
      {selRow && <LevelSwitch levels={levels} sel={sel} onSel={show} onOpen={(focus = null) => setPicker({ focus })} />}
      {picker && <LevelPicker levels={levels} sel={sel} focus={picker.focus} onSel={show} onClose={() => setPicker(null)}
        onTest={(levelId, target) => {
          setPicker(null); pathMem = { ...pathMem, jump: target };
          onStart({ mode: 'check', levelId, unitId: (levels.find((x) => x.lv.id === levelId).units[0] || { u: {} }).u.id });
        }} />}
      {selRow && <div className="ds-sub ln-level-text" data-testid="path-level" data-level={sel}>{selRow.lv.text}</div>}
      {shown.map(({ u, no, st, pl }) => {
        const isFolding = !!folding && folding.split(':')[0] === u.id;
        const folded = st.complete && hasClaim(learn, chestKey(u.id)) && !unfolded[u.id] && !isFolding;
        return (
        <section key={u.id} id={`unit-${u.id}`} data-testid="path-unit" data-unit={u.id} data-folded={String(folded)} data-folding={isFolding ? 'true' : undefined}
          className={justFolded === u.id ? 'ln-just-folded' : undefined} style={{ '--u': pl.color, scrollMarginTop: 64 }}>
          {/* шапка юнита — как купюра своего достоинства: гильош, номер, место и здание;
              пройденный и свёрнутый — одной строкой */}
          {folded ? (
            <Card className="ln-bill-mini">
              <span className="ln-unit-no" aria-hidden="true">{no}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ds-h3 ln-mini-title" style={{ color: 'var(--u-ink)' }}>{pl.place}</div>
                <div className="ds-sub" style={{ fontSize: 13, whiteSpace: 'nowrap' }} data-testid="unit-diamonds"><span className="ds-sr">Юнит {no}, </span>пройден · <Gem size={13} style={{ verticalAlign: -2, color: DIAMOND_COLOR }} aria-hidden="true" /> {st.lessons.filter((l) => l.diamond).length}/{st.lessons.length}<span className="ds-sr"> алмазов</span></div>
              </div>
              <IconButton label="Гайд юнита" icon={BookOpenText} size={20} className="ln-mini-guide" data-testid="unit-guide" data-nav-target={`book:chapter:${u.id}`} onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'chapter', id: u.id }); }} />
              <Button variant="ghost" small icon={ChevronRight} className="ln-mini-fold" data-testid="unit-fold" aria-expanded="false"
                aria-label={`Показать уроки: ${st.lessons.length}`}
                onClick={() => { Audio.play('paper'); setUnfolded((m) => ({ ...m, [u.id]: true })); }}>Уроки</Button>
            </Card>
          ) : (
          <Card className="ln-bill">
            <Guilloche height={16} opacity={0.45} />
            <div className="ln-bill-in">
              <Rosette size={58} opacity={0.5}><span className="ln-bill-no">{no}</span></Rosette>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ds-eyebrow">Юнит {no}{st.complete ? ' · пройден' : ''}</div>
                <div className="ds-h2" style={{ color: 'var(--u-ink)' }}>{pl.place}</div>
                <div className="ds-sub" style={{ fontSize: 13.5, lineHeight: 1.3 }}>{u.title}</div>
              </div>
              <Engraving kind={pl.building} alive={st.complete} size={92} color={pl.color} label={`${pl.place}${st.complete ? ', юнит пройден' : ''}`} />
            </div>
            <div className="ln-bill-btns">
              <Button variant="secondary" small icon={BookOpenText} data-testid="unit-guide" data-nav-target={`book:chapter:${u.id}`} onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'chapter', id: u.id }); }}>Гайд юнита</Button>
              {/* и у пройденного юнита: проверить себя можно в любой момент */}
              <Button variant="secondary" small icon={Sparkles} data-testid="unit-check" data-nav-target={`check:${u.id}`} onClick={() => { Audio.prime(); onStart({ mode: 'check', unitId: u.id, ...(st.complete ? { review: true } : {}) }); }}>Проверка юнита</Button>
              {st.complete && hasClaim(learn, chestKey(u.id)) && (
                <Button variant="ghost" small icon={ChevronRight} data-testid="unit-fold" aria-expanded={!folded}
                  onClick={() => { Audio.play('paper'); setUnfolded((m) => ({ ...m, [u.id]: !m[u.id] })); }}>{folded ? `Уроки: ${st.lessons.length}` : 'Свернуть'}</Button>
              )}
              {st.complete && <span className="ds-sub" style={{ fontSize: 13, alignSelf: 'center' }} data-testid="unit-diamonds"><Gem size={14} style={{ verticalAlign: -2, color: DIAMOND_COLOR }} aria-hidden="true" /> алмазов: {st.lessons.filter((l) => l.diamond).length} из {st.lessons.length}</span>}
            </div>
            <Guilloche height={16} opacity={0.45} />
          </Card>
          )}
          {/* живая модель юнита: собирается урок за уроком — главный видимый прогресс юнита; на
              телефоне — свёрнутой строкой, у свёрнутого юнита её нет */}
          {!folded && (
            <Collapse closing={isFolding && folding.endsWith(':closing')}>
              {hasModel(u.id) && !wide && <ModelFold unitId={u.id} learn={learn} />}
              <Route st={st} seen={seen} reduced={reduced} visible={visible} resumes={resumes} onLesson={onLesson} rec={rec ? rec.lessonId : null}
                chest={st.complete ? { unitId: u.id, opened: hasClaim(learn, chestKey(u.id)) } : null} onChest={onChest} />
            </Collapse>
          )}
        </section>
        );
      })}
      {soon.length > 0 && (
        <Card flat style={{ padding: 0, marginTop: 8 }} data-testid="path-soon">
          <button type="button" className="ln-soon-head" aria-expanded={soonOpen} onClick={() => { Audio.play('paper'); setSoonOpen((v) => !v); }}>
            <MapPin size={18} color="var(--ds-ink3)" aria-hidden="true" />
            <span style={{ flex: 1 }}><span className="ds-h3" style={{ display: 'block' }}>Ещё в этом уровне: {soon.length} {plural(soon.length, 'место строится', 'места строятся', 'мест строятся')}</span>
              <span className="ds-faint" style={{ fontSize: 13 }}>гайды готовых глав уже можно читать</span></span>
            <ChevronRight size={18} style={{ transform: soonOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
          </button>
          {soonOpen && (
            <div style={{ padding: '0 14px 10px' }} data-testid="path-soon-list">
              {soon.map(({ u, no }) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px dotted var(--ds-rule2)' }} data-unit={u.id}>
                  <span style={{ flex: 1, fontSize: 14.5 }}><b style={{ fontFamily: 'var(--ds-head)' }}>{placeOf(u.id).place}</b> <span className="ds-faint">· юнит {no} · {u.title}</span></span>
                  {u.ready && <Button variant="ghost" small data-nav-target={`book:chapter:${u.id}`} onClick={() => onOpenBook({ kind: 'chapter', id: u.id })}>Гайд</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      </div>
      {wide && (
        <aside className="ln-path-side" data-testid="path-side" aria-label="Задания дня и живая модель">
          <TasksEntry learn={learn} onOpen={onTasks} />
          <QuestsCard learn={learn} testid="side-quests" />
          {sideModel && <ModelFold unitId={sideModel} learn={learn} side />}
        </aside>
      )}
    </div>
  );
}

/* ------------------------------ ПРАКТИКА ------------------------------ */
/* ------------------------------ ЗАДАНИЯ ------------------------------
   Экран поверх Пути (открывается карточкой «Задания» наверху): цель дня в минутах и три
   задания дня, персональное испытание месяца, ниже — практика: ошибки уроков, задачи
   вперемешку и итоговая проверка. Один «назад» — на Путь. */
function TasksView({ learn, onStart, onOpenBook, onBack }) {
  const n = learn.mistakes.length;
  // задачи и вопросы учебника, которым подошёл срок повторения
  const [due] = useState(() => reviewQueue(loadProgress()).due.length);
  const arrow = <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />;
  return (
    <div className="ln-wrap" data-testid="tasks">
      <TopBar back={<IconButton label="Назад, на Путь" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Задания" />
      <div className="ds-sub" style={{ fontSize: 14, margin: '6px 0 12px' }}>На сегодня, на неделю и на месяц. Задания дня обновляются в полночь и начинаются с нуля.</div>
      <QuestsCard learn={learn} />
      <MonthCard learn={learn} />
      <div data-testid="practice">
        <div className="ds-h3" style={{ margin: '18px 0 6px' }}>Практика</div>
        <MenuCard icon={RotateCcw} tone="var(--ds-bad)" title="Повторить ошибки" data-testid="practice-mistakes" data-nav-target={n ? 'run:practice' : undefined} disabled={!n}
          text={n ? `${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')} из прошлых уроков` : 'Ошибок нет — всё решено верно'} right={n ? arrow : null}
          onClick={() => { Audio.prime(); onStart({ mode: 'practice' }); }} />
        <MenuCard icon={BookOpenText} tone="#3E6FA8" title="Повторить задачи учебника" data-testid="practice-review" data-nav-target={due ? 'book:review' : undefined} disabled={!due}
          text={due ? `${due} ${plural(due, 'задача или вопрос', 'задачи или вопроса', 'задач или вопросов')} — подошёл срок` : 'Сегодня повторять нечего'} right={due ? arrow : null}
          onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'review' }); }} />
        <MenuCard icon={Target} tone="#65408F" title="Задачи вперемешку" data-testid="practice-mixed" data-nav-target="book:mixed" right={arrow} text="Из начатых глав учебника, без подсказки, какая нужна модель"
          onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'mixed' }); }} />
        <MenuCard icon={Trophy} tone="var(--ds-gold)" title="Итоговая проверка: Микро" data-testid="practice-exam" data-nav-target="book:exam:micro" right={arrow} text="Шестнадцать задач с новыми числами при каждой попытке"
          onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'exam', id: 'micro' }); }} />
      </div>
    </div>
  );
}

/* ------------------------------ ПРОФИЛЬ ------------------------------
   Профиль, коллекции и настройки — src/learn-profile.jsx; уведомления и новости — src/learn-notify.jsx. */

// профиль с настройками и лента новостей — свои ленивые чанки: нужны не при каждом открытии
const ProfileView = React.lazy(() => import('./learn-profile.jsx').then((m) => ({ default: m.ProfileView })));
const SettingsView = React.lazy(() => import('./learn-profile.jsx').then((m) => ({ default: m.SettingsView })));
const NewsView = React.lazy(() => import('./learn-news.jsx'));
const Lazy = ({ children }) => <React.Suspense fallback={<div className="ds-sub" style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>{children}</React.Suspense>;

/* ------------------------------ ВКЛАДКИ ------------------------------
   Корень экранов обучения. Учебник — подэкран поверх вкладки (или поверх итогов урока):
   его «назад» возвращает туда, откуда открыли. Нижняя панель — в корне приложения. */
const MORNING_KEY = 'ems-learn-morning';
/* Гость (src/lib/guest.js): прогресс пока только на этом устройстве — карточка зовёт создать
   аккаунт. После урока — на итогах, потом — вверху Пути. Регистрация заберёт прогресс. */
function GuestSave({ learn, afterLesson = false }) {
  const done = Object.values(learn.lessons || {}).filter((l) => l && l.runs > 0).length;
  return (
    <Card data-testid="guest-save" style={{ margin: afterLesson ? '14px 0 0' : '0 0 12px', textAlign: 'left' }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Сохраните прогресс</div>
      <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.45, margin: '4px 0 10px' }}>
        {done ? `${done} ${plural(done, 'урок', 'урока', 'уроков')} и монеты пока хранятся только в этом браузере.` : 'Пока прогресс хранится только в этом браузере.'} Создайте аккаунт — и он будет с вами на любом устройстве.
      </div>
      <Button wide small data-testid="guest-register" onClick={() => { Audio.play('click'); askSave(); }}>Создать аккаунт</Button>
    </Card>
  );
}

export function LearnTab({ tab, bookHandlers = {}, reopenBook = false, onBookReopened = () => {}, onThemeChange = () => {}, onBookOver = () => {}, closeTick = 0, bookHome = 0, pathHome = 0, guest = false, firstLesson = false, onFirstLesson = () => {}, onTab = () => {} }) {
  const [learn, update] = useLearn();
  const [run, setRun] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [book, setBook] = useState(null);
  const [bookKey, setBookKey] = useState(0);
  const [reports, setReports] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  // «Задания» — экран поверх Пути (карточка наверху Пути)
  const [tasks, setTasks] = useState(false);
  const [chest, setChest] = useState(null);
  // сундук открыт — пройденный юнит сворачивается, Путь едет к рекомендованному уроку
  const [folded, setFolded] = useState({ n: 0, unit: null });
  // настройки (шестерёнка в профиле) и центр уведомлений (колокольчик на Пути и в профиле)
  const [settings, setSettings] = useState(false);
  const [bell, setBell] = useState(false);
  // куда вести после смены вкладки из уведомления: задания поверх Пути, сад или копилка в лавке
  const afterTab = useRef(null);
  const [shopFocus, setShopFocus] = useState({ n: 0, to: null });
  // утренний экран серии: один раз в день, при первом открытии Пути, если серия уже идёт
  const [morning, setMorning] = useState(() => {
    if (tab !== 'path') return false;
    const today = dayOf(Date.now());
    let seen = null; try { seen = localStorage.getItem(MORNING_KEY); localStorage.setItem(MORNING_KEY, today); } catch { /* приватный режим */ }
    return seen !== today && streak(loadProgress().learn).days >= 1;
  });
  const notify = useNotify(learn);
  const [toast, toastDone] = useToasts(notify, !!run || !!sheet || !!chest || morning || bell);
  useBrowserReminders(notify);
  const openBook = (page, resume = false) => { setBook({ page, resume }); setBookKey((k) => k + 1); window.scrollTo(0, 0); };
  // смена вкладки закрывает подэкраны; переход из уведомления может открыть нужный сразу
  useEffect(() => {
    setBook(null); setSheet(null); setChest(null); setReports(false); setAnalytics(false); setTasks(false); setSettings(false); setBell(false);
    const go = afterTab.current; afterTab.current = null;
    if (go && go.tasks) setTasks(true);
    if (go && go.chest) setChest(go.chest);
  }, [tab]);
  // нажата вкладка внизу, пока открыт учебник поверх (в том числе та же самая) — закрываем его
  useEffect(() => { if (closeTick) { setBook(null); setSheet(null); setSettings(false); setBell(false); } }, [closeTick]);
  useEffect(() => { if (pathHome) { setTasks(false); setBell(false); } }, [pathHome]);
  // учебник поверх вкладки — нижняя панель отмечает «Учебник»
  useEffect(() => { onBookOver(!!book && !run); }, [book, run]); // eslint-disable-line react-hooks/exhaustive-deps
  // вернулись из Лаборатории или партии, открытой из учебника, — снова в учебник, на то же место
  useEffect(() => { if (reopenBook) { openBook(null, true); onBookReopened(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenBook]);
  const start = (r) => { setSheet(null); setRun(r); };
  // гость: после выбора цели — сразу первый урок Пути, без карточки урока
  useEffect(() => { if (firstLesson) { onFirstLesson(); start({ mode: 'lesson', lessonId: LESSONS[0].id }); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLesson]);
  /* Касание уведомления (в центре или на плашке): туда, где можно действовать. Та же вкладка —
     сразу, другая — после её открытия (смена вкладки закрывает подэкраны). */
  const goNotify = (n) => {
    notify.markOne(n.id);
    setBell(false);
    const want = { path: 'path', tasks: 'path', league: 'league', shop: 'shop', garden: 'shop', piggy: 'shop', news: 'news' }[n.go] || 'path';
    const extra = n.go === 'tasks' ? { tasks: true } : n.id.startsWith('chest:') ? { chest: n.id.slice(6) } : null;
    if (n.go === 'garden' || n.go === 'piggy') setShopFocus((f) => ({ n: f.n + 1, to: n.go }));
    if (want === tab) {
      if (extra && extra.tasks) setTasks(true);
      if (extra && extra.chest) setChest(extra.chest);
      if (want !== 'shop') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    afterTab.current = extra;
    onTab(want);
  };
  // «Сообщить об ошибке» в учебнике: на странице (вверху) и у каждой задачи
  const bookReports = {
    reportSlot: (cur) => {
      const context = () => ({ screen: 'textbook', page: `${cur.kind}${cur.id ? `:${cur.id}` : ''}${cur.anchor ? `#${cur.anchor}` : ''}`, unit: cur.kind === 'chapter' ? cur.id : '' });
      // флажок страницы — про теорию; выделенный в тексте кусок приложится цитатой
      return <><ReportFlag context={context} reasons={THEORY_REASONS} /><QuoteReport context={context} /></>;
    },
    reportFlag: (context) => <ReportFlag context={context} label="Сообщить об ошибке" />,
  };
  const accent = placeOf((pathState(learn).find((s) => s.current) || pathState(learn)[0] || { course: { id: 'supply-demand' } }).course.id).color;
  // наряд из лавки — на всех Инфлях обучения: в уроке, на итогах, на Пути и в профиле
  const outfitKey = JSON.stringify(outfitOf(learn));
  const outfit = useMemo(() => JSON.parse(outfitKey), [outfitKey]);
  const over = !!run || !!sheet || !!book || !!chest || morning || reports || analytics || settings || bell;
  return (
    <OutfitContext.Provider value={outfit}>
    <DsRoot theme={dsThemeId()} accent={accent} page className="ln-root">
      <ArtStyle />
      <style>{TEXTBOOK_CSS + CSS + PLAY_CSS + REWARD_CSS + REPORT_CSS + MODEL_CSS + STATS_CSS + NOTIFY_CSS}</style>
      {book && (
        <div className="ln-book" data-testid="learn-book">
          <TextbookScreen key={bookKey} startPage={book.page} resume={book.resume} onExit={() => setBook(null)} {...bookHandlers} {...bookReports} />
        </div>
      )}
      {/* пока идёт урок или открыт учебник, экран под ними недоступен ни с клавиатуры, ни для чтения с экрана */}
      <div inert={over} style={book || reports || analytics ? { display: 'none' } : undefined} className="ln-tab" key={tab}>
        {tab === 'path' && !tasks && guest && <GuestSave learn={learn} />}
        {tab === 'path' && !tasks && <PathView learn={learn} update={update} onLesson={setSheet} onStart={start} onOpenBook={openBook} onChest={setChest}
          onTasks={() => { setTasks(true); window.scrollTo(0, 0); }} visible={!over} homeTick={pathHome} folded={folded}
          bell={<BellButton count={notify.unread.length} onClick={() => setBell(true)} />} />}
        {tab === 'path' && tasks && <TasksView learn={learn} onStart={start} onOpenBook={openBook} onBack={() => { Audio.play('paper'); setTasks(false); window.scrollTo(0, 0); }} />}
        {tab === 'book' && <div className="ln-book" data-testid="book-tab"><TextbookScreen asTab homeTick={bookHome} {...bookHandlers} {...bookReports} /></div>}
        {tab === 'shop' && <ShopView key={shopFocus.n} learn={learn} update={update} focus={shopFocus.to} />}
        {tab === 'league' && <div className="ln-wrap"><LeagueView learn={learn} update={update} /></div>}
        {tab === 'news' && <Lazy><NewsView /></Lazy>}
        {tab === 'profile' && <Lazy><ProfileView learn={learn} onOpenBook={openBook} onSettings={() => setSettings(true)} onNotify={() => setBell(true)} unread={notify.unread.length} /></Lazy>}
      </div>
      {settings && !reports && !analytics && <Lazy><SettingsView learn={learn} update={update} notify={notify} onBack={() => setSettings(false)} onThemeChange={onThemeChange}
        onPlacement={() => { setSettings(false); start({ mode: 'placement' }); }}
        onReports={() => { setReports(true); window.scrollTo(0, 0); }} onAnalytics={() => { setAnalytics(true); window.scrollTo(0, 0); }} /></Lazy>}
      {bell && <NotifyCenter notify={notify} onClose={() => setBell(false)} onGo={goNotify} />}
      {toast && <NotifyToast n={toast} onGo={(n) => { toastDone(); goNotify(n); }} onClose={toastDone} />}
      {reports && <ReportsView onBack={() => { Audio.play('paper'); setReports(false); }} />}
      {analytics && <AnalyticsView onBack={() => { Audio.play('paper'); setAnalytics(false); }} />}
      {chest && <ChestSheet unitId={chest} place={placeOf(chest).place} learn={learn} update={update}
        onClose={(opened) => { setChest(null); if (opened) setFolded((f) => ({ n: f.n + 1, unit: chest })); }} />}
      {morning && !run && <MorningStreak learn={learn} onClose={() => setMorning(false)} />}
      {sheet && <LessonSheet l={sheet} learn={learn} weak={weakLessons(learn).some((w) => w.id === sheet.id)} onStart={start} onClose={() => setSheet(null)} onOpenBook={openBook}
        onSkip={(id) => { Audio.play('paper'); update((s) => skipLesson(s, id)); setSheet(null); }} />}
      {run && <Runner key={JSON.stringify({ ...run, resume: !!run.resume })} run={run} learn={learn} update={update} hidden={!!book} guest={guest}
        onClose={() => setRun(null)} onOpenBook={(page) => openBook(page)} />}
    </DsRoot>
    </OutfitContext.Provider>
  );
}
export default LearnTab;
