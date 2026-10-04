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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Flame, Coins, Target, Lock, Check, Gem, Calculator, BookOpenText, BookOpen, Trophy, Timer, Delete, ChevronRight, RotateCcw, Sparkles, Dumbbell,
  Clock, Scale, Hourglass, Ticket, TrendingUp, CircleCheck, Medal, ArrowLeftRight, Handshake, Coffee, Wallet, Link, Utensils, Boxes, Users,
  Snowflake, ArrowDownToLine, ArrowUpToLine, UserRound, Languages, MessageCircle, Headphones, Gamepad2, Repeat, Flag, Croissant, Landmark, Radio, MapPin,
} from 'lucide-react';
import { Audio, getPlayerId, syncProfile } from './MacroSimulator.jsx';
import { Blocks, Inline, ChartSvg, TEXTBOOK_CSS, TextbookScreen } from './textbook.jsx';
import { CHARTS, chartDefaults } from './textbook/charts.js';
import { loadProgress, saveProgress, reviewQueue } from './textbook/progress.js';
import {
  UNITS, LESSON_BY_ID, KIND_LABEL, SHIFT_CURVES, LESSON_KIND, GAME_KINDS, OPEN_MIN, buildLesson, buildUnitCheck, buildPractice, check, ready, answerText, pathState,
  buildPlacement, placementOpened, placementFailed, retryOf,
} from './learn/course.js';
import {
  startLesson, recordAttempt, abandonLesson, addMistake, resolveMistake, addHinted, clearHinted, finishLesson, passUnit, lessonDone, lessonXp, streak, longestStreak, bestWeek,
  goalToday, missedYesterday, learnStats, studyWeeks, XP, applyFreezes, setPlacement, ownedFreezes, dayOf, recordSeen, recordBest, DIAMOND_ACCURACY,
} from './textbook/learn-state.js';
import { runCoins, runKey, earn, settle, balance, chestKey, hasClaim, outfitOf, boostActive } from './learn/rewards.js';
import { lessonOpts, weakLessons, recommend, courseCtx, theoryNotice } from './learn/program.js';
import {
  REWARD_CSS, WalletStat, QuestsCard, MonthCard, ShopView, ChestSheet, MorningStreak, Achievements, GainsList, ProgramCard, PlacementCard,
} from './learn-rewards.jsx';
import { saveResume, dropResume, getResume, takeExpiredResumes, resumeIds } from './learn/resume.js';
import { Mascot, OutfitContext } from './mascot.jsx';
import { markTerms, termTitle, termText } from './learn/terms.js';
import {
  PLAY_CSS, CurveEx, PriceEx, PointEx, TilesEx, TimerBar, GameRound, WordDeck, Calculator as CalcPad,
} from './learn-play.jsx';
import { Feed, FEED_CSS } from './learn-feed.jsx';
import { symbolsOf } from './textbook/symbols.js';
import { ReportFlag, ReportsView, REPORT_CSS, exerciseContext, flatText } from './learn-report.jsx';
import { reportsMe } from './lib/client.js';
import { loadAccount } from './account.jsx';
import { DsRoot, Button, IconButton, Card, MenuCard, Heading, Row, Toggle, AnswerBar, Sheet } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette, Stamp, Chest, PostStamp, Engraving, EngravingG, ProgressChart, InflaMeter, CoinShower, CountUp, useReducedMotion } from './ds-art.jsx';
import { placeOf, unitColor, DIAMOND_COLOR, dsThemeId, learnDark, setLearnDark, learnMusic, setLearnMusic, learnSfx, setLearnSfx } from './ds-tokens.js';
import { countryPath, innerBorderPath, RIVER, curveTo } from './lib/mapgeo.js';
import { ProfileModal } from './account.jsx';

export { SCREENS } from './learn/screens.js';

// раскладка экранов обучения; цвета, шрифты и компоненты — из дизайн-системы
const CSS = `
  .ln-root { padding: 12px 16px 104px; }
  .ln-wrap { max-width: 560px; margin: 0 auto; }
  .ln-stats { display: flex; gap: 6px; padding: 2px 0 12px; }
  .ln-stat { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px; border: 1px solid var(--ds-rule2); border-radius: 3px;
    background: var(--ds-card); font: 700 15px var(--ds-mono); white-space: nowrap; box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px var(--ds-rule); }
  .ln-stat small { font: 11px var(--ds-sans); color: var(--ds-ink3); letter-spacing: .04em; }
  .ln-atlas { position: relative; padding: 10px 10px 8px; margin: 4px 0 18px; }
  .ln-atlas svg text { font-family: var(--ds-serif); }
  .ln-bill { position: relative; overflow: hidden; padding: 0; margin: 20px 0 6px; background: color-mix(in srgb, var(--u) 7%, var(--ds-card)); }
  .ln-bill-in { display: flex; align-items: center; gap: 12px; padding: 12px 14px 10px; }
  .ln-bill-no { font: 700 30px/1 var(--ds-serif); color: var(--u-ink); }
  .ln-bill-btns { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 14px 12px; }
  .ln-route { position: relative; margin: 0 auto; }
  .ln-route > svg { position: absolute; inset: 0; pointer-events: none; }
  .ln-stop { position: absolute; width: 170px; margin-left: -85px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ln-token { position: relative; width: 62px; height: 62px; border-radius: 50%; border: 1.5px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink2); cursor: pointer;
    display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 4px var(--ds-card), inset 0 0 0 5px var(--ds-rule), 0 2px 3px var(--ds-shade); transition: transform .08s; }
  .ln-token:active { transform: translateY(1px); }
  .ln-token.done { background: var(--u); color: #fff; border-color: color-mix(in srgb, var(--u) 70%, #000);
    box-shadow: inset 0 0 0 4px var(--u), inset 0 0 0 5px rgba(255,255,255,.55), 0 2px 3px var(--ds-shade); }
  .ln-token.locked { border-style: dashed; color: var(--ds-ink3); box-shadow: none; background: var(--ds-paper); }
  .ln-token.cur { border-color: var(--ds-gold); border-width: 2.5px; color: var(--u-ink); }
  .ln-token.cur::after { content: ''; position: absolute; inset: -8px; border-radius: 50%; border: 2px solid var(--ds-gold); animation: ds-ring 1.8s ease-out infinite; pointer-events: none; }
  .ln-seal { position: absolute; right: -4px; bottom: -4px; width: 24px; height: 24px; border-radius: 50%; background: var(--ds-bad); color: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 2px var(--ds-paper), inset 0 0 0 2px rgba(255,255,255,.35); transform: rotate(-12deg); }
  /* урок, взятый на алмазном уровне: гранёный камень вместо цвета юнита */
  .ln-token.diamond { background: linear-gradient(135deg, #8ED8F2 0%, #3FA2CC 45%, #2E8FB8 60%, #1D6A8E 100%); border-color: #1C5F80;
    box-shadow: inset 0 0 0 4px rgba(255,255,255,0), inset 0 0 0 5px rgba(255,255,255,.7), 0 2px 8px rgba(46,143,184,.45); }
  .ln-seal.diamond { background: #2E8FB8; }
  .ln-pin { position: absolute; top: -28px; left: 50%; transform: translateX(-50%); white-space: nowrap; font: 700 11px/1 var(--ds-sans); letter-spacing: .12em; text-transform: uppercase;
    color: var(--ds-paper); background: var(--ds-ink); padding: 5px 8px 4px; border-radius: 2px; }
  .ln-pin.rec { background: var(--ds-gold); color: #2A1D05; }
  .ln-pin.rec::after { border-top-color: var(--ds-gold); }
  .ln-chest { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: inherit; cursor: pointer; font: 700 13.5px/1.25 var(--ds-serif); }
  .ln-chest-art { display: inline-flex; filter: drop-shadow(0 2px 2px var(--ds-shade)); transition: transform .15s; }
  .ln-chest:hover .ln-chest-art { transform: translateY(-2px) rotate(-2deg); }
  .ln-chest[data-opened="false"] .ln-chest-art { animation: ln-chest-wiggle 2.8s ease-in-out infinite; }
  @keyframes ln-chest-wiggle { 0%, 82%, 100% { transform: none; } 86% { transform: rotate(-5deg); } 90% { transform: rotate(4deg); } 94% { transform: rotate(-2deg); } }
  @media (prefers-reduced-motion: reduce) { .ln-chest[data-opened="false"] .ln-chest-art { animation: none; } }
  .ln-pin::after { content: ''; position: absolute; left: 50%; bottom: -4px; margin-left: -4px; border: 4px solid transparent; border-bottom: 0; border-top-color: var(--ds-ink); }
  .ln-stop-title { background: none; border: none; padding: 2px 4px; font: 700 13.5px/1.25 var(--ds-serif); max-width: 170px; text-align: center; cursor: pointer; color: var(--ds-ink); }
  .ln-stop-title.locked { color: var(--ds-ink3); }
  .ln-overlay { position: fixed; inset: 0; z-index: 300; display: flex; flex-direction: column; }
  .ln-head { display: flex; align-items: center; gap: 10px; padding: calc(10px + env(safe-area-inset-top)) 14px 4px; max-width: 592px; width: 100%; margin: 0 auto; }
  /* прокрутка урока — только по вертикали и только когда содержимое правда длиннее экрана:
     встряска после ошибки и свайп карточки двигают его вбок (без overflow-x: hidden из-за
     overflow-y: auto появлялся горизонтальный ползунок), а появление шага — не сдвигом вниз
     (сдвиг на 14 px на миг давал вертикальный), а проявлением */
  .ln-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 14px 16px 24px; }
  .ln-body .ds-rise { animation-name: ln-appear; }
  @keyframes ln-appear { from { opacity: 0; } to { opacity: 1; } }
  .ln-inner { max-width: 560px; margin: 0 auto; }
  .ln-foot { border-top: 1px solid var(--ds-rule2); padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); background: var(--ds-paper); }
  .ln-foot.fb { padding: 0; border-top: none; }
  .ln-kind { margin-bottom: 8px; }
  .ln-prompt { margin-bottom: 12px; }
  .tb-term { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: help; text-decoration: underline dotted var(--u-ink); text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .ln-term-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: var(--ds-card); border-top: 1px solid var(--ds-rule2); border-radius: 10px 10px 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: inset 0 3px 0 var(--ds-card), inset 0 4px 0 var(--u), 0 -10px 30px rgba(0,0,0,.2); }
  .ln-tickets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ln-tickets > div { border: 1px dashed var(--ds-rule2); border-radius: 3px; padding: 8px 4px; text-align: center; background: var(--ds-card); }
  .ln-tickets .v { font: 700 21px var(--ds-mono); margin-top: 2px; }
  .ln-ticket { display: flex; border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); overflow: hidden; box-shadow: 0 2px 4px var(--ds-shade); }
  .ln-ticket-main { flex: 1; min-width: 0; padding: 14px 14px 12px; }
  .ln-ticket-stub { width: 86px; border-left: 2px dashed var(--ds-rule2); background: color-mix(in srgb, var(--u) 12%, var(--ds-card)); display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 6px; color: var(--u-ink); position: relative; }
  .ln-ticket-stub::before, .ln-ticket-stub::after { content: ''; position: absolute; left: -9px; width: 16px; height: 16px; border-radius: 50%; background: var(--ds-card2); }
  .ln-ticket-stub::before { top: -9px; } .ln-ticket-stub::after { bottom: -9px; }
  .ln-album { display: flex; flex-wrap: wrap; gap: 10px; }
  .ln-legend { margin-top: 12px; padding: 8px 10px; border-left: 3px solid var(--u); background: color-mix(in srgb, var(--u) 6%, var(--ds-card)); font-size: 14.5px; line-height: 1.55; border-radius: 0 3px 3px 0; }
  .ln-how { background: none; border: none; padding: 4px 0; margin-top: 6px; font: 700 14px var(--ds-sans); color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
  .ln-verdict { margin-top: 10px; padding: 10px 12px; border-radius: 3px; border-left: 3px solid; }
  .ln-verdict.ok { background: var(--ds-ok-bg); border-color: var(--ds-ok); }
  .ln-verdict.bad { background: var(--ds-bad-bg); border-color: var(--ds-bad); }
  .ln-verdict.ok .ds-answer-stamp { color: var(--ds-ok); font-size: 13px; }
  .ln-verdict.bad .ds-answer-stamp { color: var(--ds-bad); font-size: 13px; }
  .ln-book { min-height: 100vh; margin: -12px -16px 0; }
  /* кнопки учебника-справочника — те же, что у дизайн-системы: билет и бумажная кнопка */
  .ln-textbook .ems-btn { font: 700 13.5px/1.25 var(--ds-sans); border: 1px solid var(--ds-rule2); border-bottom-width: 2px; border-radius: 3px; background: var(--ds-card);
    color: var(--u-ink); box-shadow: none; letter-spacing: 0; }
  .ln-textbook .ems-btn:hover { background: var(--ds-card2); border-color: var(--ds-rule2); box-shadow: none; }
  .ln-textbook .ems-btn.primary { background: var(--u); color: #fff; border-color: color-mix(in srgb, var(--u) 70%, #000); font: 700 13.5px/1.25 var(--ds-serif); letter-spacing: .06em; text-transform: uppercase; }
  .ln-textbook .ems-btn.primary:hover { background: var(--u); filter: brightness(1.07); }
  .ln-textbook .ems-btn[aria-pressed="true"] { background: var(--ds-sel); color: var(--ds-sel-ink); border-color: var(--ds-sel-rule); }
  .ln-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; max-width: 360px; }
  .ln-cal-wd { font: 700 11px/1 var(--ds-sans); color: var(--ds-ink3); text-align: center; text-transform: uppercase; letter-spacing: .06em; padding-bottom: 2px; }
  .ln-cal-d { aspect-ratio: 1; border-radius: 4px; border: 1px solid var(--ds-rule2); display: flex; align-items: center; justify-content: center;
    font: 700 11px/1 var(--ds-mono); color: var(--ds-ink2); background: var(--ds-card); }
  .ln-cal-d.t1 { background: color-mix(in srgb, var(--u) 22%, var(--ds-card)); }
  .ln-cal-d.t2 { background: color-mix(in srgb, var(--u) 50%, var(--ds-card)); color: var(--ds-ink); }
  .ln-cal-d.t3 { background: var(--u); color: #fff; border-color: transparent; }
  .ln-cal-d.today { outline: 2px solid var(--ds-ink); outline-offset: 1px; }
  .ln-cal-d.future { opacity: .35; border-style: dashed; }
  .ln-cal-sum { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px; text-align: center; }
  .ln-cal-sum b { display: block; font-size: 24px; color: var(--u-ink); }
  .ln-cal-sum span { font-size: 12.5px; color: var(--ds-ink3); }
  .ln-theory { border: 1px solid var(--ds-rule2); border-left: 4px solid var(--u); border-radius: 4px; background: var(--ds-card2); padding: 12px 14px; }
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
    case 'swipe': case 'rush': return JSON.stringify('game');
    case 'open': return JSON.stringify('open');
    default: return undefined;
  }
};
const noopCtx = { progress: { problems: {}, read: {} }, go: () => {}, onAnswer: () => {} };
const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* нет вибрации */ } };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const plural = (n, one, few, many) => { const a = n % 10; const b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

/* ------------------------------ ПРОГРЕСС ------------------------------ */
function useLearn() {
  const [progress, setProgress] = useState(loadProgress);
  const playerId = useMemo(getPlayerId, []);
  const timer = useRef(null);
  // opts.settle — после изменения выдать всё выполненное: задания дня, печати, бонусы серии
  const update = (fn, opts = {}) => {
    setProgress((p) => {
      let learn = fn(p.learn);
      if (opts.settle) learn = settle(learn, courseCtx(learn)).s;
      return learn === p.learn ? p : saveProgress({ ...p, learn });
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; syncProfile(playerId).catch(() => {}); }, 2000);
  };
  useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((pf) => { if (alive && pf) setProgress(loadProgress()); }).catch(() => {});
    // уроки, которые не продолжили за сутки, — брошенные: только они портят долю доведённых
    const expired = takeExpiredResumes();
    if (expired.length) update((s) => expired.reduce((acc, r) => abandonLesson(acc, r.kind || 'choice', r.pos || 0), s));
    // купленные заморозки спасают серию сами — при открытии, если пропуск уже не покрыт недельной
    update((s) => applyFreezes(s));
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
  return <div style={{ maxWidth: 360, margin: '8px auto' }}><ChartSvg scene={def.build(attrs, v)} /></div>;
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
const fillBlank = (blocks, word) => JSON.parse(JSON.stringify(blocks), (k, v) => (k === 'v' && typeof v === 'string' && v.includes('___') ? v.replace('___', word) : v));

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
          <div className="ln-prompt ds-text tb-body"><Blocks blocks={fillBlank(inst.prompt, chosen ? `[${chosen.raw}]` : '_____')} ctx={ctx} /></div>
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
            <div key={v.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '6px 0' }}>
              <span style={{ fontSize: 15 }}>{v.label}</span>
              <span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '10px 0 14px' }}>
            <input value={val} onChange={(e) => !locked && setResp(e.target.value.replace(/[^0-9.,\-−/]/g, '').slice(0, 10))} inputMode="none" aria-label="Ответ числом"
              className="ds-field ds-num" style={{ width: 180, fontSize: 26, textAlign: 'center', padding: '8px 10px' }} />
            {inst.unit && <span style={{ fontSize: 16, color: 'var(--ds-ink2)' }} data-testid="calc-unit">{inst.unit}</span>}
          </div>
          {!locked && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }} role="group" aria-label="Способ ввода">
              <button type="button" className="ds-chip" aria-pressed={!inst._calc} onClick={() => inst._setCalc(false)}>Ответ</button>
              <button type="button" className="ds-chip" aria-pressed={!!inst._calc} data-testid="calc-open" onClick={() => { Audio.play('tick'); inst._setCalc(true); }}>
                <Calculator size={15} style={{ verticalAlign: -3, marginRight: 4 }} aria-hidden="true" />Калькулятор
              </button>
            </div>
          )}
          {inst._calc && !locked ? <CalcPad onUse={(v) => { setResp(v.slice(0, 10)); inst._setCalc(false); }} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 320, margin: '0 auto' }} role="group" aria-label="Цифровая клавиатура">
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
  if (run.mode === 'lesson') { const p = buildLesson(run.lessonId, Math.random, { ...lessonOpts(learn), diamond: !!run.diamond }); return { items: p.items, cards: p.cards, seconds: p.seconds, diamond: !!run.diamond }; }
  if (run.mode === 'check') { const p = buildUnitCheck(run.unitId, Math.random, { seen: learn.seen || {} }); return { items: p.items, cards: {}, passMistakes: p.passMistakes }; }
  if (run.mode === 'placement') return { items: buildPlacement().items, cards: {} };
  return { items: buildPractice(learn.mistakes.map((m) => m.id), Math.random, { weak: weakLessons(learn).map((w) => w.id) }).items, cards: {} };
}
function Runner({ run, learn, update, onClose, onOpenBook, hidden }) {
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
  const acc = useRef({
    first: rs ? rs.first : {}, hinted: rs ? rs.hinted : {}, solved: new Set(rs ? rs.solved : []),
    start: Date.now() - (rs ? rs.elapsed || 0 : 0), itemStart: Date.now(), retries: rs ? rs.retries : 0,
  });
  const [started, setStarted] = useState(!!rs);
  const retryable = run.mode === 'lesson' || run.mode === 'practice';
  const total = plan.items.length;
  const cur = queue[pos];
  const orig = cur ? (cur.orig || cur.uid) : null;
  // вступительный тест — в цвете юнита, который сейчас проверяется; алмазный уровень — в своём
  const color = diamond ? DIAMOND_COLOR : unitColor(lesson ? lesson.unitId : run.unitId || (cur && cur.placeUnit) || 'scarcity');

  const doCheck = (given) => {
    const answer = given !== undefined ? given : resp;
    if (!cur || fb || (given === undefined && !ready(cur, answer))) return;
    const r = check(cur, answer);
    if (r.empty) { setFb({ ok: false, why: null, empty: true }); return; }
    const a = acc.current;
    // урок начат — с первого ответа
    if (!started) { setStarted(true); update(startLesson); }
    const firstTime = !(orig in a.first);
    const ms = Date.now() - a.itemStart;
    if (firstTime) {
      a.first[orig] = r.ok;
      setLog((l) => [...l, r.ok]);
      if (r.ok && run3 >= 1) setPulse((p) => p + 1);
      // встреченное упражнение: в повторение и проверки первыми пойдут те, что виделись реже
      const seenId = cur.of || cur.id;
      update((s) => recordSeen(recordAttempt(s, cur.kind, r.ok, ms, { lesson: cur.lesson || null, run: r.ok ? run3 + 1 : 0 }), seenId));
      if (GAME_KINDS.includes(cur.kind) && answer && answer.score) update((s) => recordBest(s, cur.id, answer.score));
    }
    if (r.ok) {
      a.solved.add(orig);
      // похожая задача вместо исходной отвечает за исходную: ошибка по ней снимается, подсказка переходит
      const baseId = cur.of || cur.id;
      if (run.mode === 'practice') update((s) => resolveMistake(s, baseId));
      // решено с подсказкой — невидимо уходит в «Повторение» пораньше; без подсказки — снимается
      update((s) => (a.hinted[orig] ? addHinted(s, baseId) : clearHinted(s, baseId)));
      if (firstTime) setRun3((n) => n + 1);
      Audio.play('coin'); vibrate(15);
    } else {
      setRun3(0);
      Audio.play('down'); vibrate([30, 40, 30]);
      if (run.mode === 'lesson') update((s) => addMistake(s, cur.of || cur.id));
      // повтор в конце урока — не та же задача: новые числа или похожий вопрос на ту же мысль
      if (retryable && !cur.noRetry) {
        a.retries += 1;
        const copy = retryOf(cur, Math.random, queue.map((q) => q.of || q.id));
        setQueue((q) => [...q, { ...copy, uid: `${cur.uid}r${a.retries}`, orig, retry: true }]);
      }
      else a.solved.add(orig);
    }
    setAnim((x) => ({ k: x.k + 1, kind: r.ok ? 'flash' : 'shake' }));
    setFb({ ok: r.ok, why: r.why });
  };
  const finish = () => {
    const a = acc.current;
    // подсказка ничем не наказывается: верно с первой попытки — полный опыт
    const firstOk = Object.values(a.first).filter(Boolean).length;
    const mistakes = Object.values(a.first).filter((x) => !x).length;
    // вступительный тест может закончиться раньше — точность по заданным вопросам
    const asked = run.mode === 'placement' ? Object.keys(a.first).length : total;
    const accuracy = asked ? (firstOk / asked) * 100 : 0;
    const ms = Date.now() - a.start;
    const now = Date.now();
    let xp = 0; let pass = null; let opened = null;
    const done = { accuracy, now, seconds: ms / 1000, kind: lesson ? lesson.kind : null, mode: run.mode };
    let apply;
    if (run.mode === 'lesson') {
      xp = lessonXp({ firstTry: firstOk, replay, diamond });
      apply = (s) => finishLesson(s, run.lessonId, { xp, ...done, diamond });
      dropResume(run.lessonId);
    } else if (run.mode === 'check') {
      pass = mistakes <= plan.passMistakes;
      xp = firstOk * XP.correct;
      apply = (s) => { const t = finishLesson(s, null, { xp, ...done }); return pass ? passUnit(t, run.unitId, { ace: mistakes === 0, now }) : t; };
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
    update((s) => full(s).s);
    // касса: урок сдан
    Audio.play('register'); vibrate([20, 30, 20, 30, 60]);
    setResult({ xp, accuracy, ms, pass, mistakes, coins: key && hasClaim(learn, key) ? 0 : coins, gains: preview.gains, opened, boosted });
    setStage('done');
  };
  const next = () => {
    Audio.play('paper');
    if (feed && cur && fb) setHistory((h) => [...h, { type: 'q', key: `q:${cur.uid}`, inst: marked, resp, fb }]);
    if (pos + 1 >= queue.length) { finish(); return; }
    // вступительный тест: пятёрка юнита провалена — дальше спрашивать незачем
    if (run.mode === 'placement' && cur && placementFailed(plan.items, acc.current.first, cur.placeUnit)) { finish(); return; }
    setPos(pos + 1); setResp(null); setFb(null); setSel(null); setTerm(null); setCalcOpen(false); setHow(false);
    acc.current.itemStart = Date.now();
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
        first: a.first, hinted: a.hinted, solved: [...a.solved], retries: a.retries, elapsed: Date.now() - a.start,
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
  const title = run.mode === 'lesson' ? `${diamond ? 'Алмазный уровень: ' : ''}${lesson.title}` : run.mode === 'check' ? 'Проверка юнита' : run.mode === 'placement' ? 'Вступительный тест' : 'Практика';

  const kindName = cur ? KIND_LABEL[cur.kind] : '';
  // плашка ответа в нижней панели — одна на все виды уроков: её видно без прокрутки
  const verdictBar = inst && fb && !fb.empty ? (
    <AnswerBar ok={fb.ok} stamp={GAME_KINDS.includes(inst.kind) ? (fb.ok ? 'Засчитано' : 'Не засчитано') : inst.kind === 'open' ? 'Ответ записан' : null} className={fb.ok ? 'ds-flash' : ''} key={`fb${anim.k}`}>
      <div style={{ marginTop: 10 }} data-testid="ex-feedback" data-ok={String(fb.ok)}>
        {inst.kind === 'open' && inst.explain && (
          <div className="tb-body" style={{ fontSize: 15, color: 'inherit' }} data-testid="open-review"><b>Разбор.</b> <Blocks blocks={inst.explain} ctx={noopCtx} /></div>
        )}
        {GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15 }} data-testid="game-result">{gameLine(inst, resp)}{!fb.ok && ` Нужно: ${answerText(inst)}.`}</div>}
        {!fb.ok && !GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15 }}>Правильно: <b>{answerText(inst)}</b></div>}
        {!fb.ok && fb.why && <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.5 }} data-testid="ex-why"><Inline nodes={fb.why} ctx={noopCtx} /></div>}
        {!fb.ok && !fb.why && inst.explain && !inst.steps && <div className="tb-body" style={{ fontSize: 15, marginTop: 4, color: 'inherit' }}><Blocks blocks={inst.explain} ctx={noopCtx} /></div>}
        {!fb.ok && inst.explain && inst.steps && <StepsExplain blocks={inst.explain} key={inst.uid} />}
        {/* верный ответ на расчёт — ход решения по кнопке: важно не только число, но и почему так считают */}
        {fb.ok && inst.explain && !GAME_KINDS.includes(inst.kind) && inst.kind !== 'open' && (
          how ? <div className="tb-body" style={{ fontSize: 15, marginTop: 6, color: 'inherit' }} data-testid="ex-how"><Blocks blocks={inst.explain} ctx={noopCtx} /></div>
            : <button type="button" className="ln-how" data-testid="ex-how-open" onClick={() => { Audio.play('paper'); setHow(true); }}>Как решать</button>
        )}
        {!fb.ok && retryable && !inst.noRetry && <div className="ds-sub" style={{ fontSize: 13.5, marginTop: 4 }}>{feed ? 'Вопрос вернётся в конце урока.' : 'Задача вернётся в конце урока.'}</div>}
        <Button variant={fb.ok ? 'ok' : 'bad'} wide onClick={next} autoFocus style={{ marginTop: 12 }}>Дальше</Button>
      </div>
    </AnswerBar>
  ) : null;
  const unitId = lesson ? lesson.unitId : run.unitId;

  return (
    <DsRoot theme={dsThemeId()} accent={color} className="ln-overlay" data-testid="lesson" data-mode={run.mode} data-diamond={diamond ? 'true' : undefined} role="dialog" aria-label={title}
      style={{ display: hidden ? 'none' : undefined }}>
      <ArtStyle /><style>{CSS + PLAY_CSS + FEED_CSS + REPORT_CSS}</style>
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
          cardsSeen.current.add(cur.uid); acc.current.itemStart = Date.now(); setCardIdx(0); setStage('work');
        };
        const picture = c.chart ? <MiniChart type={c.chart} attrs={c.attrs} /> : c.pic ? <Pic name={c.pic} /> : null;
        // «Слова» — колода со своими кнопками: вспомнить, открыть, «Знаю» / «Ещё раз»
        if (c.flash) {
          const done = () => { cardsSeen.current.add(cur.uid); acc.current.itemStart = Date.now(); setCardIdx(0); setStage('work'); };
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
                  <StepLegend nodes={c.text} unitId={unitId} />
                  {picture}
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
                {!GAME_KINDS.includes(inst.kind) && <Button wide disabled={!ready(inst, resp)} onClick={() => doCheck()}>{inst.kind === 'open' ? 'Ответить' : 'Проверить'}</Button>}
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
          cardsSeen.current.add(cur.uid); acc.current.itemStart = Date.now(); setCardIdx(0); setStage('work');
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
                      {inst && !GAME_KINDS.includes(inst.kind) && <Button wide disabled={!ready(inst, resp)} onClick={() => doCheck()}>{inst.kind === 'open' ? 'Ответить' : 'Проверить'}</Button>}
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
              <h2 className="ds-h1">{run.mode === 'check' ? (result.pass ? 'Проверка сдана' : 'Почти получилось') : run.mode === 'practice' ? 'Практика окончена' : run.mode === 'placement' ? 'Тест пройден' : 'Урок пройден'}</h2>
              <div className="ds-sub" style={{ fontSize: 15.5, margin: '6px 0 16px' }} data-testid="result-text">
                {run.mode === 'placement' ? (result.opened.length
                  ? `Открыто сразу: ${result.opened.map((u) => `«${placeOf(u).place}»`).join(', ')}. ${result.opened.length >= UNITS.filter((u) => u.lessons.length).length ? 'Пройденные уроки можно взять на алмазном уровне.' : 'Путь продолжится со следующего места.'}`
                  : 'Начнём с самого начала — так надёжнее. Первые уроки короткие.')
                  : run.mode === 'check' ? (result.pass ? 'Уроки юнита открыты — можно идти дальше.' : `Ошибок с первой попытки: ${result.mistakes}. Для зачёта — не больше ${plan.passMistakes}. Уроки юнита никуда не делись.`)
                  : lesson && lesson.kind === 'summary' ? `Тест юнита: верно ${Math.round((result.accuracy * total) / 100)} из ${total}. «${placeOf(unitId).place}» пройден.`
                    : lesson && lesson.kind === 'game' ? (result.accuracy >= 100 ? 'Игра засчитана.' : 'Игра не засчитана — попробуйте ещё раз, планка та же.')
                      : result.mistakes === 0 ? 'Без единой ошибки.' : result.accuracy >= 90 ? (result.mistakes === 1 ? 'Всего одна ошибка — она уже разобрана.' : `Ошибок всего ${result.mistakes} — они разобраны и вернутся в практике.`) : 'Ошибки разобраны — они вернутся в практике.'}
                {diamond && <div style={{ marginTop: 6, color: 'var(--u-ink)', fontWeight: 700 }} data-testid="result-diamond">
                  {result.accuracy >= DIAMOND_ACCURACY ? '◆ Алмазный уровень взят' : `◆ Для алмаза нужно от ${DIAMOND_ACCURACY}% верных`}
                </div>}
              </div>
              <div className="ln-tickets">
                <div data-testid="result-xp"><div className="ds-eyebrow" style={{ fontSize: 10.5 }}>Опыт{result.boosted ? ' ×2' : ''}</div><div className="v"><CountUp value={result.xp} prefix="+" /></div></div>
                <div data-testid="result-acc"><div className="ds-eyebrow" style={{ fontSize: 10.5 }}>Точность</div><div className="v">{Math.round(result.accuracy)}%</div></div>
                <div data-testid="result-time"><div className="ds-eyebrow" style={{ fontSize: 10.5 }}>Время</div><div className="v">{mmss(result.ms)}</div></div>
              </div>
              <GainsList coins={result.coins} gains={result.gains} />
              {replay && !diamond && <div className="ds-faint" style={{ fontSize: 13.5, marginTop: 12 }}>Урок уже был пройден: за простой повтор — немного опыта и монет. На алмазном уровне задачи сложнее, а награда больше.</div>}
            </div>
            <Guilloche height={22} />
          </Card>
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
      <span className="ds-answer-stamp">{fb.ok ? 'Верно' : 'Не совсем'}</span>
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
function StepLegend({ nodes, unitId }) {
  const list = symbolsOf(mathIn(nodes), unitId);
  if (!list.length) return null;
  return (
    <div className="ln-legend" data-testid="step-legend">
      <div className="ds-eyebrow" style={{ fontSize: 10.5, marginBottom: 2 }}>Обозначения</div>
      {list.map((x) => <div key={x.key}><Inline nodes={[{ t: 'math', v: x.key }]} ctx={noopCtx} /> — {x.text}</div>)}
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
function LessonSheet({ l, learn, weak = false, onStart, onClose, onOpenBook }) {
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Coins size={15} aria-hidden="true" />до {info.xp} XP</span>
          </div>
        </div>
        <div className="ln-ticket-stub">
          <Icon size={30} aria-hidden="true" />
          <span className="ds-num" style={{ fontSize: 12 }}>№ {String(l.no).padStart(2, '0')}</span>
        </div>
      </div>
      {l.done && <div style={{ display: 'flex', justifyContent: 'center', marginTop: -18, pointerEvents: 'none' }}>
        {l.diamond ? <Stamp text="АЛМАЗ" center={<Gem size={20} />} size={70} color={DIAMOND_COLOR} /> : <Stamp text="ПРОЙДЕНО" center={<Check size={20} />} size={70} color="var(--ds-bad)" />}
      </div>}
      <div style={{ marginTop: 16 }}>
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
          <Button wide data-testid="lesson-start" onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id, resume }); }}>
            {resume ? 'Продолжить' : 'Начать'}
          </Button>
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
              Алмазный уровень: задачи сложнее{lesson.inner.some((c) => c.diamond) ? ', теория глубже' : ''}, ≈{gemInfo.min} мин, до {gemInfo.xp} XP и {l.diamond ? '5' : '25–35'} монет.
              {weak && ' Тема пока даётся трудно — сначала стоит повторить.'}
            </div>
          </div>
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

function TopStats({ learn }) {
  const st = streak(learn); const g = goalToday(learn);
  const totalXp = Object.values(learn.xp).reduce((a, b) => a + b, 0);
  return (
    <div className="ln-stats" data-testid="path-stats">
      <span className="ln-stat" title="Серия дней"><Flame size={17} color={st.days ? 'var(--ds-bad)' : 'var(--ds-ink3)'} aria-hidden="true" /><span data-testid="streak">{st.days}</span><small>дн.</small></span>
      <span className="ln-stat" title="Опыт"><Sparkles size={16} color="var(--u-ink)" aria-hidden="true" />{totalXp}<small>XP</small></span>
      <WalletStat learn={learn} />
      <span className="ln-stat" title={`Цель дня — ${g.goal} минут занятий`} data-testid="goal" style={{ color: g.done >= g.goal ? 'var(--ds-ok)' : undefined }}><Target size={17} aria-hidden="true" />{Math.min(g.done, g.goal)}/{g.goal}<small>мин</small></span>
    </div>
  );
}

/* Карта Инфлатии: берег, округа, река Велья, и дорога через места юнитов. Здание места —
   гравюра; пройденный юнит его «оживляет» (цвет, свет в окнах, дым). Нажатие по месту —
   прокрутка к юниту на дороге ниже. */
const MAP_BOX = { x: 130, y: 70, w: 780, h: 610 };
function Atlas({ states, onPick }) {
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
        <div><div className="ds-eyebrow">Путь</div><div className="ds-h3">Дорога по Инфлатии</div></div>
        <span className="ds-faint ds-num" style={{ fontSize: 12 }}>{onPath.filter((x) => x.st.complete).length}/{UNITS.length} мест</span>
      </div>
      <svg viewBox={`${MAP_BOX.x} ${MAP_BOX.y} ${MAP_BOX.w} ${MAP_BOX.h}`} width="100%" role="img" aria-label="Карта Инфлатии: места юнитов на дороге" style={{ display: 'block', borderRadius: 4 }}>
        <defs>
          <pattern id="ln-sea" width="16" height="12" patternUnits="userSpaceOnUse"><path d="M0,8 q4,-4 8,0 t8,0" fill="none" stroke="#5F82B3" strokeWidth="1.1" opacity=".45" /></pattern>
        </defs>
        {/* море — голубоватая тушь с волнами, суша — бумага */}
        <rect x={MAP_BOX.x} y={MAP_BOX.y} width={MAP_BOX.w} height={MAP_BOX.h} fill="color-mix(in srgb, #5F82B3 13%, var(--ds-card))" />
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
            <g key={u.id} style={{ '--u': pl.color, cursor: 'pointer' }} data-testid="atlas-place" data-unit={u.id} data-alive={String(alive)}
              onClick={() => onPick(u.id)} role="button" aria-label={`${pl.place}: к юниту`}>
              {here && <circle cx={x} cy={y - 26} r="58" fill="none" stroke="var(--ds-gold)" strokeWidth="3.5" strokeDasharray="5 6" />}
              <circle cx={x} cy={y - 26} r="50" fill="var(--ds-card)" opacity=".85" />
              <EngravingG kind={pl.building} alive={alive} x={x - 54} y={y - 72} scale={0.9} color={pl.color} />
              <text x={x} y={y + 30} textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--ds-ink)" stroke="var(--ds-paper)" strokeWidth="7" paintOrder="stroke">{pl.place}</text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

/* Остановки юнита на дороге: жетоны вдоль извилистой дороги. Пройденная — в цвете юнита с
   сургучной печатью, текущая — с золотым кольцом и флажком «Вы здесь», закрытая — пунктир. */
const ROW = 118; const ZIG = [0, 64, 92, 64, 0, -64, -92, -64];
/* Убранство дороги: у каждой остановки, на другой стороне от неё, — дерево, фонарь, куст или
   верстовой столб с номером урока; в начале юнита — указатель с названием места. У пройденных
   остановок убранство в цвете юнита («дорога оживает»), у закрытых — серое. Чисто украшение:
   скрыто от чтения с экрана и не ловит нажатий. */
function Prop({ kind, x, y, alive, no }) {
  const ink = alive ? 'var(--u-ink)' : 'var(--ds-ink3)';
  const fill = alive ? 'var(--u)' : 'var(--ds-rule2)';
  const o = alive ? 1 : 0.55;
  return (
    <g transform={`translate(${x},${y})`} opacity={o} className="ln-prop" data-prop={kind}>
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
        <text x="0" y="12" textAnchor="middle" fontSize="10" fontWeight="700" fill={ink} fontFamily="var(--ds-serif)">{no}</text>
        <line x1="-13" y1="22" x2="13" y2="22" stroke={ink} strokeWidth="1.2" />
      </>}
    </g>
  );
}
const PROPS = ['tree', 'lamp', 'bush', 'mile'];
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
          return <Prop key={l.id} kind={PROPS[i % PROPS.length]} x={left ? 30 : W - 30} y={pts[i][1] - 4} alive={l.done} no={l.no} />;
        })}
      </svg>
      {st.lessons.map((l, i) => {
        const isCur = st.current && st.current.id === l.id;
        const isRec = rec === l.id;
        const lesson = LESSON_BY_ID[l.id];
        const unlocking = !reduced && visible && l.open && !l.done && !seen.has(l.id);
        const KindIcon = KIND_ICON[lesson.kind] || Dumbbell;
        const cls = l.done ? `done${l.diamond ? ' diamond' : ''}` : l.open ? '' : 'locked';
        return (
          <div key={l.id} className="ln-stop" style={{ left: pts[i][0], top: pts[i][1] - 31 }}>
            {/* отметка: прерванный урок — «продолжить»; программа советует — «рекомендуем сейчас» */}
            {(isCur || isRec) && (
              <span className={`ln-pin ${isRec && !resumes.has(l.id) ? 'rec' : ''}`} data-testid={isRec ? 'path-rec' : undefined}>
                {resumes.has(l.id) ? 'продолжить' : isRec ? 'рекомендуем сейчас' : 'вы здесь'}
              </span>
            )}
            <button type="button" className={`ln-token ${cls} ${isCur ? 'cur' : ''}`} data-testid="path-lesson" data-lesson={l.id} data-kind={lesson.kind} data-rec={isRec ? 'true' : undefined}
              data-state={l.done ? 'done' : l.open ? 'open' : 'locked'} data-diamond={l.diamond ? 'true' : undefined} data-nav-target={`lesson:${l.id}`}
              aria-label={`${LESSON_KIND[lesson.kind]} ${l.no}: ${l.title}${l.diamond ? ', взят на алмазном уровне' : l.done ? ', пройден' : l.open ? '' : ', закрыт'}`}
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
            <button type="button" className={`ln-stop-title ${l.open ? '' : 'locked'}`} tabIndex={-1} aria-hidden="true" data-testid="path-lesson-title" data-lesson={l.id}
              onClick={() => { Audio.play('click'); onLesson(l); }}>{l.title}</button>
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

function PathView({ learn, update, onLesson, onStart, onOpenBook, onChest, visible }) {
  const states = pathState(learn);
  const rec = recommend(learn, states);
  const recTitle = rec ? LESSON_BY_ID[rec.lessonId].title : null;
  const askPlacement = !!(learn.profile && learn.profile.knows) && !(learn.placement && learn.placement.at);
  const sleepy = missedYesterday(learn);
  const g = goalToday(learn);
  const hello = g.done >= g.goal ? 'joy' : sleepy ? 'sleep' : 'hello';
  const first = states.find((x) => x.current) || states[0];
  const soon = UNITS.map((u, k) => ({ u, no: k + 1 })).filter(({ u }) => !states.some((x) => x.course.id === u.id));
  const [soonOpen, setSoonOpen] = useState(false);
  /* Пройденный юнит с открытым сундуком сворачивается в одну карточку: новые модули не уезжают
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
  const pick = (id) => { const el = document.getElementById(`unit-${id}`); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); };
  return (
    <div className="ln-wrap" data-testid="path">
      <TopStats learn={learn} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Mascot mood={hello} size={44} />
        <div className="ds-sub" style={{ fontSize: 15, lineHeight: 1.4 }}>
          {rec && rec.why === 'weak' ? `Рекомендуем сейчас: «${recTitle}» — здесь было больше всего ошибок.`
            : g.done >= g.goal ? 'Цель дня выполнена — можно и дальше.' : sleepy ? 'Инфля заскучала. Одна остановка — и снова в пути.' : first && first.current ? `Следующая остановка: «${first.current.title}»` : 'Уроки по 3–5 минут.'}
        </div>
      </div>
      {askPlacement && <PlacementCard onStart={() => onStart({ mode: 'placement' })} onSkip={() => { Audio.play('paper'); update((s) => setPlacement(s, [])); }} />}
      <Atlas states={states} onPick={pick} />
      {UNITS.map((u, k) => ({ u, no: k + 1, st: states.find((x) => x.course.id === u.id), pl: placeOf(u.id) })).filter((x) => x.st).map(({ u, no, st, pl }) => {
        const folded = st.complete && hasClaim(learn, chestKey(u.id)) && !unfolded[u.id];
        return (
        <section key={u.id} id={`unit-${u.id}`} data-testid="path-unit" data-unit={u.id} data-folded={String(folded)} style={{ '--u': pl.color, scrollMarginTop: 12 }}>
          {/* шапка юнита — как купюра своего достоинства: гильош, номер, место и здание */}
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
              {!st.complete && <Button variant="secondary" small icon={Sparkles} data-testid="unit-check" data-nav-target={`check:${u.id}`} onClick={() => { Audio.prime(); onStart({ mode: 'check', unitId: u.id }); }}>Проверка юнита</Button>}
              {st.complete && hasClaim(learn, chestKey(u.id)) && (
                <Button variant="ghost" small icon={ChevronRight} data-testid="unit-fold" aria-expanded={!folded}
                  onClick={() => { Audio.play('paper'); setUnfolded((m) => ({ ...m, [u.id]: !m[u.id] })); }}>{folded ? `Уроки: ${st.lessons.length}` : 'Свернуть'}</Button>
              )}
              {st.complete && <span className="ds-sub" style={{ fontSize: 13, alignSelf: 'center' }} data-testid="unit-diamonds"><Gem size={14} style={{ verticalAlign: -2, color: DIAMOND_COLOR }} aria-hidden="true" /> алмазов: {st.lessons.filter((l) => l.diamond).length} из {st.lessons.length}</span>}
            </div>
            <Guilloche height={16} opacity={0.45} />
          </Card>
          {!folded && <Route st={st} seen={seen} reduced={reduced} visible={visible} resumes={resumes} onLesson={onLesson} rec={rec ? rec.lessonId : null}
            chest={st.complete ? { unitId: u.id, opened: hasClaim(learn, chestKey(u.id)) } : null} onChest={onChest} />}
        </section>
        );
      })}
      {soon.length > 0 && (
        <Card flat style={{ padding: 0, marginTop: 8 }} data-testid="path-soon">
          <button type="button" className="ln-soon-head" aria-expanded={soonOpen} onClick={() => { Audio.play('paper'); setSoonOpen((v) => !v); }}>
            <MapPin size={18} color="var(--ds-ink3)" aria-hidden="true" />
            <span style={{ flex: 1 }}><span className="ds-h3" style={{ display: 'block' }}>Дальше по дороге: {soon.length} {plural(soon.length, 'место строится', 'места строятся', 'мест строятся')}</span>
              <span className="ds-faint" style={{ fontSize: 13 }}>гайды готовых глав уже можно читать</span></span>
            <ChevronRight size={18} style={{ transform: soonOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
          </button>
          {soonOpen && (
            <div style={{ padding: '0 14px 10px' }} data-testid="path-soon-list">
              {soon.map(({ u, no }) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px dotted var(--ds-rule2)' }} data-unit={u.id}>
                  <span style={{ flex: 1, fontSize: 14.5 }}><b style={{ fontFamily: 'var(--ds-serif)' }}>{placeOf(u.id).place}</b> <span className="ds-faint">· юнит {no} · {u.title}</span></span>
                  {u.ready && <Button variant="ghost" small data-nav-target={`book:chapter:${u.id}`} onClick={() => onOpenBook({ kind: 'chapter', id: u.id })}>Гайд</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ ПРАКТИКА ------------------------------ */
/* ------------------------------ ЗАДАНИЯ ------------------------------
   Отдельная вкладка: цель дня в минутах и три задания дня, персональное испытание месяца,
   ниже — практика: ошибки уроков, задачи вперемешку и итоговая проверка. */
function TasksView({ learn, onStart, onOpenBook }) {
  const n = learn.mistakes.length;
  // задачи и вопросы учебника, которым подошёл срок повторения
  const [due] = useState(() => reviewQueue(loadProgress()).due.length);
  const arrow = <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />;
  return (
    <div className="ln-wrap" data-testid="tasks">
      <Heading eyebrow="Задания" title="На сегодня и на месяц" sub="Задания дня обновляются в полночь и начинаются с нуля." style={{ marginBottom: 10 }} />
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
   Личные рекорды, альбом марок (пройденный юнит — марка с его зданием), цель дня,
   статистика, учебник, аккаунт и настройки: тёмная тема, музыка, звуки ответов. */
/* Четыре недели занятий: календарь — клетка дня темнее, чем больше минут; три числа под ним.
   Без разбивки по типам упражнений: она мало что говорит ученику. */
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
function StudyWeeks({ learn }) {
  const w = studyWeeks(learn);
  const goal = goalToday(learn).goal;
  const tone = (m) => (m <= 0 ? 0 : m < goal / 2 ? 1 : m < goal ? 2 : 3);
  return (
    <Card style={{ margin: '12px 0' }} data-testid="prof-stats">
      <div className="ds-h3" style={{ marginBottom: 2 }}>Мои четыре недели</div>
      <div className="ds-sub" style={{ fontSize: 13.5, marginBottom: 10 }}>Клетка — день: чем темнее, тем больше минут. Полный цвет — цель дня ({goal} мин) выполнена.</div>
      <div className="ln-cal" data-testid="prof-calendar">
        {WD.map((d) => <span key={d} className="ln-cal-wd">{d}</span>)}
        {w.days.map((d) => (
          <span key={d.day} className={`ln-cal-d t${tone(d.minutes)}${d.today ? ' today' : ''}${d.future ? ' future' : ''}`} title={`${d.day}: ${d.minutes} мин, уроков ${d.lessons}`} data-minutes={d.minutes}>
            {d.minutes > 0 ? d.minutes : ''}
          </span>
        ))}
      </div>
      <div className="ln-cal-sum">
        <div><b className="ds-num" data-testid="prof-minutes">{w.minutes}</b><span>минут</span></div>
        <div><b className="ds-num" data-testid="prof-lessons">{w.lessons}</b><span>{plural(w.lessons, 'урок', 'урока', 'уроков')}</span></div>
        <div><b className="ds-num" data-testid="prof-accuracy">{w.accuracy == null ? '—' : `${Math.round(w.accuracy * 100)}%`}</b><span>верно с первого раза</span></div>
      </div>
    </Card>
  );
}

function ProfileView({ learn, update, onOpenBook, onThemeChange, onStart, onReports }) {
  // владельцы (OWNER_LOGINS на сервере) видят сообщения об ошибках
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    const a = loadAccount();
    if (!a) return undefined;
    let alive = true;
    reportsMe(a.token).then((r) => { if (alive) setOwner(!!r.owner); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const st = streak(learn); const stats = learnStats(learn);
  const bw = bestWeek(learn);
  const [dark, setDark] = useState(learnDark);
  const [music, setMusic] = useState(learnMusic);
  const [sfx, setSfx] = useState(learnSfx);
  const [account, setAccount] = useState(false);
  const states = pathState(learn);
  const arrow = <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />;
  const lessonsDone = Object.keys(learn.lessons).filter((id) => lessonDone(learn, id)).length;
  return (
    <div className="ln-wrap" data-testid="learn-profile">
      {account && <div data-testid="account" style={{ display: 'contents' }}><ProfileModal onClose={() => setAccount(false)} onSwitched={() => setAccount(false)} /></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Mascot mood={st.days >= 3 ? 'joy' : 'hello'} size={52} />
        <Heading eyebrow="Профиль" title="Личные рекорды" sub="Без лиг и соревнований — только ваш путь." />
      </div>
      <Card style={{ margin: '12px 0' }}>
        <div className="ds-h3" style={{ marginBottom: 6 }}>Рекорды</div>
        <Row label="Серия сейчас" value={`${st.days} дн.${st.freezesUsed.length ? ` · заморожено: ${st.freezesUsed.length}` : ''}`} data-testid="prof-streak" />
        <Row label="Самая длинная серия" value={`${longestStreak(learn)} дн.`} />
        <Row label="Лучшая неделя" value={bw.xp ? `${bw.xp} XP` : '—'} />
        <Row label="Всего опыта" value={`${stats.totalXp} XP`} />
        <Row label="Монет в кошельке" value={`${balance(learn)}`} data-testid="prof-coins" />
        <Row label="Заморозок в запасе" value={`${ownedFreezes(learn)}`} />
        <div className="ds-faint" style={{ fontSize: 13, marginTop: 6 }}>Один пропущенный день в неделю серию не обнуляет, второй — спасает купленная заморозка.</div>
      </Card>
      <ProgramCard learn={learn} update={update} onPlacement={() => onStart({ mode: 'placement' })} />

      <Card style={{ margin: '12px 0' }} data-testid="prof-album">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="ds-h3">Альбом</div><span className="ds-faint ds-num" style={{ fontSize: 12.5 }}>печатей: {lessonsDone}</span>
        </div>
        <div className="ds-sub" style={{ fontSize: 13.5, margin: '2px 0 10px' }}>Пройденный юнит — марка с его зданием, каждый урок — печать.</div>
        <div className="ln-album">
          {states.map((s, k) => {
            const pl = placeOf(s.course.id);
            return (
              <PostStamp key={s.course.id} color={pl.color} value={k + 1} caption={pl.place} dim={!s.complete} testid="album-stamp">
                <Engraving kind={pl.building} alive={s.complete} size={78} color={pl.color} />
              </PostStamp>
            );
          })}
        </div>
        <div className="ds-h3" style={{ margin: '16px 0 4px' }}>Печати</div>
        <div className="ds-sub" style={{ fontSize: 13.5, margin: '0 0 10px' }}>Достижения — оттиски печатей; за каждую — монеты.</div>
        <Achievements learn={learn} />
      </Card>
      <StudyWeeks learn={learn} />
      <MenuCard icon={Target} tone="var(--ds-ok)" title="Мой прогресс в учебнике" data-testid="prof-book-stats" data-nav-target="book:stats" right={arrow} text="Разделы, точность, слабые темы и журнал занятий" onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'stats' }); }} />
      {owner && <MenuCard icon={Flag} tone="var(--ds-bad)" title="Сообщения об ошибках" data-testid="prof-reports" data-nav-target="reports" right={arrow}
        text="Что заметили ученики: новые и разобранные, «скопировать всё»" onClick={() => { Audio.play('paper'); onReports(); }} />}
      <MenuCard icon={UserRound} tone="#65408F" title="Аккаунт" data-testid="prof-account" data-nav-target="account" right={arrow} text="Имя, значок, пароль, выход" onClick={() => setAccount(true)} />
      <Card style={{ margin: '12px 0' }} data-testid="prof-settings">
        <div className="ds-h3" style={{ marginBottom: 4 }}>Настройки</div>
        {[
          ['Тёмная тема', dark, (v) => { setLearnDark(v); setDark(v); onThemeChange(); }, 'prof-dark'],
          ['Музыка в обучении', music, (v) => { setLearnMusic(v); setMusic(v); onThemeChange(); }, 'prof-music'],
          ['Звуки ответов', sfx, (v) => { setLearnSfx(v); setSfx(v); onThemeChange(); if (v) Audio.play('coin'); }, 'prof-sfx'],
        ].map(([label, on, set, testid]) => (
          <div key={testid} className="ds-row" style={{ alignItems: 'center' }}>
            <span>{label}</span><Toggle on={on} label={label} onChange={set} data-testid={testid} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ------------------------------ ВКЛАДКИ ------------------------------
   Корень экранов обучения. Учебник — подэкран поверх вкладки (или поверх итогов урока):
   его «назад» возвращает туда, откуда открыли. Нижняя панель — в корне приложения. */
const MORNING_KEY = 'ems-learn-morning';
export function LearnTab({ tab, bookHandlers = {}, reopenBook = false, onBookReopened = () => {}, onThemeChange = () => {} }) {
  const [learn, update] = useLearn();
  const [run, setRun] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [book, setBook] = useState(null);
  const [bookKey, setBookKey] = useState(0);
  const [reports, setReports] = useState(false);
  const [chest, setChest] = useState(null);
  // утренний экран серии: один раз в день, при первом открытии Пути, если серия уже идёт
  const [morning, setMorning] = useState(() => {
    if (tab !== 'path') return false;
    const today = dayOf(Date.now());
    let seen = null; try { seen = localStorage.getItem(MORNING_KEY); localStorage.setItem(MORNING_KEY, today); } catch { /* приватный режим */ }
    return seen !== today && streak(loadProgress().learn).days >= 1;
  });
  const openBook = (page, resume = false) => { setBook({ page, resume }); setBookKey((k) => k + 1); window.scrollTo(0, 0); };
  // смена вкладки закрывает подэкраны
  useEffect(() => { setBook(null); setSheet(null); setChest(null); setReports(false); }, [tab]);
  // вернулись из Лаборатории или партии, открытой из учебника, — снова в учебник, на то же место
  useEffect(() => { if (reopenBook) { openBook(null, true); onBookReopened(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenBook]);
  const start = (r) => { setSheet(null); setRun(r); };
  // «Сообщить об ошибке» в учебнике: на странице (вверху) и у каждой задачи
  const bookReports = {
    reportSlot: (cur) => <ReportFlag context={() => ({ screen: 'textbook', page: `${cur.kind}${cur.id ? `:${cur.id}` : ''}${cur.anchor ? `#${cur.anchor}` : ''}`, unit: cur.kind === 'chapter' ? cur.id : '' })} />,
    reportFlag: (context) => <ReportFlag context={context} label="Сообщить об ошибке" withText />,
  };
  const accent = placeOf((pathState(learn).find((s) => s.current) || pathState(learn)[0] || { course: { id: 'supply-demand' } }).course.id).color;
  // наряд из лавки — на всех Инфлях обучения: в уроке, на итогах, на Пути и в профиле
  const outfitKey = JSON.stringify(outfitOf(learn));
  const outfit = useMemo(() => JSON.parse(outfitKey), [outfitKey]);
  return (
    <OutfitContext.Provider value={outfit}>
    <DsRoot theme={dsThemeId()} accent={accent} page className="ln-root">
      <ArtStyle />
      <style>{TEXTBOOK_CSS + CSS + PLAY_CSS + REWARD_CSS + REPORT_CSS}</style>
      {book && (
        <div className="ln-book" data-testid="learn-book">
          <TextbookScreen key={bookKey} startPage={book.page} resume={book.resume} onExit={() => setBook(null)} {...bookHandlers} {...bookReports} />
        </div>
      )}
      {/* пока идёт урок или открыт учебник, экран под ними недоступен ни с клавиатуры, ни для чтения с экрана */}
      <div inert={!!run || !!sheet || !!book || !!chest || morning || reports} style={book || reports ? { display: 'none' } : undefined}>
        {tab === 'path' && <PathView learn={learn} update={update} onLesson={setSheet} onStart={start} onOpenBook={openBook} onChest={setChest}
          visible={!run && !sheet && !book && !chest && !morning} />}
        {tab === 'book' && <div className="ln-book" data-testid="book-tab"><TextbookScreen asTab {...bookHandlers} {...bookReports} /></div>}
        {tab === 'shop' && <ShopView learn={learn} update={update} />}
        {tab === 'tasks' && <TasksView learn={learn} onStart={start} onOpenBook={openBook} />}
        {tab === 'profile' && <ProfileView learn={learn} update={update} onOpenBook={openBook} onThemeChange={onThemeChange} onStart={start}
          onReports={() => { setReports(true); window.scrollTo(0, 0); }} />}
      </div>
      {reports && <ReportsView onBack={() => { Audio.play('paper'); setReports(false); }} />}
      {chest && <ChestSheet unitId={chest} place={placeOf(chest).place} learn={learn} update={update} onClose={() => setChest(null)} />}
      {morning && !run && <MorningStreak learn={learn} onClose={() => setMorning(false)} />}
      {sheet && <LessonSheet l={sheet} learn={learn} weak={weakLessons(learn).some((w) => w.id === sheet.id)} onStart={start} onClose={() => setSheet(null)} onOpenBook={openBook} />}
      {run && <Runner key={JSON.stringify({ ...run, resume: !!run.resume })} run={run} learn={learn} update={update} hidden={!!book}
        onClose={() => setRun(null)} onOpenBook={(page) => openBook(page)} />}
    </DsRoot>
    </OutfitContext.Provider>
  );
}
export default LearnTab;
