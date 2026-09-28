/* ПУТЬ «КАК В ДУОЛИНГО»: главный экран учёбы (дорожка уроков), карточка урока, урок во весь
   экран, практика, профиль и учебник-справочник. Отдельный ленивый чанк вместе с учебником —
   формулы и графики те же. Данные и правила — src/learn/course.js (уроки и упражнения),
   src/textbook/learn-state.js (опыт, серия, статистика), src/learn/resume.js (незаконченный
   урок). Оформление — src/learn-ui.jsx.

   Навигация: у каждого экрана один «назад» (data-nav="back"), переходы помечены
   data-nav-target — e2e проверяет, что на одном экране нет двух путей в одно место.
   Карта экранов — SCREENS ниже. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Flame, Zap, Target, Lock, Check, Crown, BookOpenText, BookOpen, Trophy, Timer, Delete, ChevronRight, RotateCcw, Sparkles, Dumbbell,
  Clock, Scale, Hourglass, Ticket, TrendingUp, CircleCheck, Medal, ArrowLeftRight, Handshake, Coffee, Wallet, Link, Utensils, Boxes, Users,
  Snowflake, ArrowDownToLine, ArrowUpToLine, Moon, UserRound, Languages, MessageCircle, Headphones, Gamepad2, Repeat, Flag, Croissant, Landmark, Radio,
} from 'lucide-react';
import { Audio, getPlayerId, syncProfile } from './MacroSimulator.jsx';
import { Blocks, Inline, ChartSvg, TEXTBOOK_CSS, TextbookScreen } from './textbook.jsx';
import { CHARTS, chartDefaults } from './textbook/charts.js';
import { loadProgress, saveProgress } from './textbook/progress.js';
import {
  UNITS, UNIT_BY_ID, LESSON_BY_ID, KIND_LABEL, SHIFT_CURVES, LESSON_KIND, GAME_KINDS, buildLesson, buildUnitCheck, buildLegend, buildPractice, check, ready, answerText, pathState,
} from './learn/course.js';
import {
  startLesson, recordAttempt, abandonLesson, addMistake, resolveMistake, finishLesson, passUnit, lessonXp, streak, longestStreak, bestWeek,
  goalToday, missedYesterday, learnStats, setGoal, GOALS, XP,
} from './textbook/learn-state.js';
import { saveResume, dropResume, getResume, takeExpiredResumes, resumeIds } from './learn/resume.js';
import { Mascot } from './mascot.jsx';
import { todayCard } from './textbook/today-snapshot.js';
import { markTerms, termTitle, termText } from './learn/terms.js';
import { plainText } from './textbook/content.js';
import {
  PLAY_CSS, CurveEx, PriceEx, PointEx, TilesEx, TimerBar, SwipeRound, RushRound, ChainRound, StoryCard, FlashCard, ListenCard,
} from './learn-play.jsx';
import { LearnStyle, Confetti, CountUp, unitColor, learnDark, setLearnDark, useReducedMotion } from './learn-ui.jsx';
import { ProfileModal } from './account.jsx';

export { SCREENS } from './learn/screens.js';

const CSS = `
  .ln-root { padding: 14px 16px 104px; }
  .ln-wrap { max-width: 560px; margin: 0 auto; }
  .ln-stats { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 2px 12px; }
  .ln-stat { display: inline-flex; align-items: center; gap: 5px; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 16px; }
  .ln-banner { border-radius: 18px; padding: 16px 16px 14px; color: #fff; background: var(--u); box-shadow: 0 4px 0 color-mix(in srgb, var(--u) 70%, #000); margin: 14px 0 8px; }
  .ln-banner .lx-h { color: #fff; }
  .ln-banner-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; margin: 10px 8px 0 0; border-radius: 12px; border: 2px solid rgba(255,255,255,.55);
    background: rgba(255,255,255,.14); color: #fff; font: 800 13.5px 'Nunito', sans-serif; cursor: pointer; }
  .ln-banner-btn:active { transform: translateY(1px); }
  .lx-node { --nb: var(--u); width: 76px; height: 70px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;
    color: #fff; background: var(--nb); box-shadow: 0 7px 0 color-mix(in srgb, var(--nb) 68%, #000); transition: transform .06s, box-shadow .06s; position: relative; }
  .lx-node:active:not(:disabled) { transform: translateY(6px); box-shadow: 0 1px 0 color-mix(in srgb, var(--nb) 68%, #000); }
  .lx-node.cur { animation: lx-hop .9s ease-out 1; }
  .lx-node.cur::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 4px solid var(--nb); opacity: .35; animation: lx-ring 1.8s ease-out infinite; pointer-events: none; }
  @keyframes lx-hop { 0% { transform: translateY(0) } 25% { transform: translateY(-14px) } 50% { transform: translateY(0) } 70% { transform: translateY(-6px) } 100% { transform: translateY(0) } }
  @keyframes lx-ring { 0% { transform: scale(.92); opacity: .5 } 100% { transform: scale(1.18); opacity: 0 } }
  .lx-node.done { --nb: #FFC800; color: #6B4A00; }
  .ln-done-badge { position: absolute; right: -2px; bottom: -2px; width: 24px; height: 24px; border-radius: 50%; background: #58A700; color: #fff; display: flex; align-items: center; justify-content: center; border: 3px solid var(--c-bg); }
  .lx-node.locked { --nb: var(--c-border); color: var(--c-faint); cursor: pointer; }
  .ln-node-title { background: none; border: none; padding: 2px 4px; font: 700 13px 'Nunito', sans-serif; max-width: 170px; text-align: center; cursor: pointer; color: var(--c-text); }
  .ln-node-title.locked { color: var(--c-faint); }
  .ln-bubble { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); background: var(--c-panel); color: var(--u); border: 2px solid var(--c-border);
    border-radius: 10px; padding: 3px 10px; font: 800 12.5px 'Nunito', sans-serif; white-space: nowrap; text-transform: uppercase; letter-spacing: .04em; }
  .ln-soon-head { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; color: inherit; font: inherit; padding: 12px 14px; cursor: pointer; text-align: left; }
  .ln-overlay { position: fixed; inset: 0; z-index: 300; background: var(--c-bg); display: flex; flex-direction: column; }
  .ln-bar { height: 16px; border-radius: 8px; background: var(--c-border); overflow: hidden; flex: 1; position: relative; }
  .ln-bar > span { display: block; height: 100%; background: #58CC02; border-radius: 8px; transition: width .35s ease; position: relative; }
  .ln-bar > span::after { content: ''; position: absolute; left: 8px; right: 8px; top: 3px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.35); }
  .ln-bar.glow { animation: lx-glow 1.2s ease-in-out infinite; }
  .ln-bar.glow > span { background: linear-gradient(90deg, #58CC02, #FFC800, #58CC02); background-size: 200px 100%; animation: lx-shine 1.4s linear infinite; }
  .ln-body { flex: 1; overflow-y: auto; padding: 16px 16px 24px; }
  .ln-inner { max-width: 560px; margin: 0 auto; }
  .ln-foot { border-top: 2px solid var(--c-border); padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
  .ln-foot.ok { background: #D7FFB8; border-top-color: transparent; color: #235C00; }
  .ln-foot.bad { background: #FFDFE0; border-top-color: transparent; color: #8A1C1F; }
  .lx .ln-foot.ok .lx-btn { --u: #58A700; }
  .lx .ln-foot.bad .lx-btn { --u: #D93A3F; }
  .ln-prompt { font-size: 17px; line-height: 1.55; margin-bottom: 12px; }
  .ln-prompt p { margin: 0 0 10px; }
  .ln-kind { font: 800 13px 'Nunito', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--u); margin-bottom: 8px; }
  .ln-key { padding: 14px 0; font-size: 20px; border-radius: 12px; border: 2px solid var(--c-border); border-bottom-width: 4px; background: var(--c-panel); color: var(--c-text); font-family: inherit; cursor: pointer; }
  .ln-key:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 2px; }
  .tb-term { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: help; text-decoration: underline dotted var(--u); text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .tb-term:focus-visible { outline: 2px solid var(--c-blue); outline-offset: 2px; }
  .ln-sheet-back { position: fixed; inset: 0; z-index: 320; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
  .ln-sheet { width: 100%; max-width: 560px; background: var(--c-panel); border-radius: 22px 22px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom)); box-shadow: 0 -10px 30px rgba(0,0,0,.25); }
  .ln-term-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: var(--c-panel); border-top: 3px solid var(--u); border-radius: 18px 18px 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -10px 30px rgba(0,0,0,.2); }
  .ln-tile { background: var(--c-panel); border: 2px solid var(--c-border); border-radius: 16px; padding: 10px 6px; text-align: center; }
  .ln-tile .v { font: 800 22px 'Nunito', sans-serif; margin-top: 2px; }
  .ln-row { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; padding: 5px 0; }
  .ln-row span:first-child { color: var(--c-muted); }
  .ln-toggle { width: 48px; height: 28px; border-radius: 14px; border: none; background: var(--c-border); position: relative; cursor: pointer; flex-shrink: 0; }
  .ln-toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
  .ln-toggle[aria-checked="true"] { background: #58CC02; }
  .ln-toggle[aria-checked="true"]::after { left: 23px; }
  .ln-menu-btn { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; font: inherit; color: var(--c-text); padding: 14px; margin: 10px 0; cursor: pointer; }
  .ln-menu-btn:active:not(:disabled) { transform: translateY(2px); }
  .ln-menu-btn:disabled { opacity: .55; cursor: default; }
  /* учебник во всю ширину: свои поля у него уже есть */
  .ln-book { background: var(--c-bg); min-height: 100vh; margin: -14px -16px 0; }
`;

// ответы для e2e-тестов: только если тест сам включил флаг
const testAnswer = (inst) => {
  if (typeof window === 'undefined' || !window.__INFLATIA_TEST__) return undefined;
  switch (inst.kind) {
    case 'choice': case 'gap': return JSON.stringify(inst.options.find((o) => o.correct).key);
    case 'tf': return JSON.stringify(inst.answer);
    case 'order': return JSON.stringify(inst.solution);
    case 'match': return JSON.stringify(Object.fromEntries(inst.left.map((l) => [l.key, l.key])));
    case 'sort': return JSON.stringify(Object.fromEntries(inst.items.map((it) => [it.key, it.bin])));
    case 'calc': return JSON.stringify(String(Math.round(inst.answer * 100) / 100).replace('.', ','));
    case 'shift': return JSON.stringify(inst.answer);
    case 'news': return JSON.stringify(inst.expect);
    case 'tiles': case 'chain': return JSON.stringify(inst.solution);
    case 'curve': return JSON.stringify(inst.answer);
    case 'price': return JSON.stringify(inst.answer);
    case 'point': return JSON.stringify(inst.answer);
    case 'swipe': case 'rush': return JSON.stringify('game');
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
  const update = (fn) => {
    setProgress((p) => { const learn = fn(p.learn); return learn === p.learn ? p : saveProgress({ ...p, learn }); });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; syncProfile(playerId).catch(() => {}); }, 2000);
  };
  useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((pf) => { if (alive && pf) setProgress(loadProgress()); }).catch(() => {});
    // уроки, которые не продолжили за сутки, — брошенные: только они портят долю доведённых
    const expired = takeExpiredResumes();
    if (expired.length) update((s) => expired.reduce((acc, r) => abandonLesson(acc, r.kind || 'choice', r.pos || 0), s));
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); syncProfile(playerId).catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);
  return [progress.learn, update];
}

// значок вида урока: на кружке Пути и в карточке урока
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
function Pic({ name }) {
  const Icon = PICS[name];
  if (!Icon) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }} aria-hidden="true">
      <div style={{ width: 128, height: 128, borderRadius: 32, background: 'color-mix(in srgb, var(--u) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={64} color="var(--u)" strokeWidth={1.8} />
      </div>
    </div>
  );
}

/* ------------------------------ УПРАЖНЕНИЯ ------------------------------ */
// «___» в тексте вопроса → выбранная плитка
const fillBlank = (blocks, word) => JSON.parse(JSON.stringify(blocks), (k, v) => (k === 'v' && typeof v === 'string' && v.includes('___') ? v.replace('___', word) : v));

function ExerciseView({ inst, resp, setResp, locked, fb, ctx = noopCtx, onSubmit = () => {} }) {
  const pick = (v) => { if (!locked) { Audio.play('tick'); setResp(v); } };
  const optClass = (key, correct) => (!fb ? '' : correct ? 'right' : key === resp && !fb.ok ? 'wrong' : '');
  switch (inst.kind) {
    case 'choice':
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.options.map((o) => (
            <button key={o.key} type="button" className={`lx-opt ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
              onClick={() => pick(o.key)}><Inline nodes={o.text} ctx={ctx} /></button>
          ))}
        </div>
      );
    case 'gap': {
      const chosen = inst.options.find((o) => o.key === resp);
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={fillBlank(inst.prompt, chosen ? `[${chosen.raw}]` : '_____')} ctx={ctx} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
            {inst.options.map((o) => (
              <button key={o.key} type="button" className={`lx-chip ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
                onClick={() => pick(o.key)}><Inline nodes={o.text} ctx={ctx} /></button>
            ))}
          </div>
        </div>
      );
    }
    case 'tf':
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[[true, 'Верно'], [false, 'Неверно']].map(([v, l]) => (
              <button key={l} type="button" className={`lx-opt ${!fb ? '' : v === inst.answer ? 'right' : v === resp ? 'wrong' : ''}`} style={{ textAlign: 'center', fontWeight: 700 }}
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
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <MiniChart type={inst.chart} attrs={inst.chartAttrs} values={values} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {inst.choices.map((c) => (
              <button key={c.key} type="button" className={`lx-opt ${optClass(c.key, c.key === inst.answer)}`} style={{ textAlign: 'center', margin: 0 }}
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
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.vars.map((v) => (
            <div key={v.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '6px 0' }}>
              <span style={{ fontSize: 15 }}>{v.label}</span>
              <span>
                {[['+', '↑'], ['-', '↓'], ['0', '—']].map(([d, l]) => (
                  <button key={d} type="button" className={`lx-chip ${fb && inst.expect[v.key] === d ? 'right' : ''}`} aria-pressed={r[v.key] === d} data-var={v.key} data-dir={d}
                    aria-label={`${v.label}: ${({ '+': 'вверх', '-': 'вниз', 0: 'не изменится' })[d]}`} disabled={locked}
                    onClick={() => pick({ ...r, [v.key]: d })}>{l}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case 'order': {
      const seq = resp || [];
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <div style={{ minHeight: 60, border: '2px dashed var(--c-border)', borderRadius: 12, padding: 6, marginBottom: 10 }} data-testid="ln-order-answer">
            {seq.map((k, i) => { const it = inst.items.find((x) => x.key === k); return (
              <button key={k} type="button" className="lx-opt" style={{ margin: '4px 0' }} disabled={locked} onClick={() => pick(seq.filter((x) => x !== k))}>
                <b style={{ color: 'var(--u)' }}>{i + 1}.</b> <Inline nodes={it.text} ctx={ctx} />
              </button>
            ); })}
            {!seq.length && <div style={{ fontSize: 13, color: 'var(--c-faint)', padding: 10, textAlign: 'center' }}>Нажимайте карточки по порядку</div>}
          </div>
          {inst.items.filter((it) => !seq.includes(it.key)).map((it) => (
            <button key={it.key} type="button" className="lx-opt" data-key={it.key} disabled={locked} onClick={() => pick([...seq, it.key])}><Inline nodes={it.text} ctx={ctx} /></button>
          ))}
        </div>
      );
    }
    case 'match': {
      const r = resp || {};
      const [sel, setSel] = [inst._sel, inst._setSel];
      const pairNo = Object.fromEntries(Object.keys(r).map((l, i) => [l, i]));
      const rightOwner = Object.fromEntries(Object.entries(r).map(([l, rr]) => [rr, l]));
      const tone = (i) => ['#6FA8DC', '#4FA38F', '#D9B23A', '#E07A5F', '#A78BDA'][i % 5];
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {/* пары на время: по нулю ответ уходит на проверку таким, какой есть */}
          {inst.timer && <TimerBar seconds={inst.timer} running={!locked} onEnd={() => onSubmit(inst._resp.current || {})} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>{inst.left.map((l) => (
              <button key={l.key} type="button" className="lx-opt" data-side="left" data-key={l.key} aria-pressed={sel === l.key} disabled={locked}
                style={{ fontSize: 14, borderColor: l.key in pairNo ? tone(pairNo[l.key]) : undefined }}
                onClick={() => { Audio.play('tick'); if (l.key in r) { const n = { ...r }; delete n[l.key]; setResp(n); setSel(null); } else setSel(l.key); }}>
                <Inline nodes={l.text} ctx={ctx} /></button>
            ))}</div>
            <div>{inst.right.map((x) => (
              <button key={x.key} type="button" className="lx-opt" data-side="right" data-key={x.key} disabled={locked || (!sel && !(x.key in rightOwner))}
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
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.items.map((it) => (
            <div key={it.key} style={{ border: `2px solid ${fb ? (r[it.key] === it.bin ? 'var(--c-teal)' : 'var(--c-rust)') : 'var(--c-border)'}`, borderRadius: 14, padding: '9px 11px', margin: '9px 0', background: 'var(--c-panel)' }}>
              <div style={{ fontSize: 14.5, marginBottom: 4 }}><Inline nodes={it.text} ctx={ctx} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {inst.bins.map((b) => (
                  <button key={b} type="button" className="lx-chip" style={{ fontSize: 13, padding: '6px 10px' }} aria-pressed={r[it.key] === b} data-item={it.key} data-bin={b} disabled={locked}
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
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '10px 0 14px' }}>
            <input value={val} onChange={(e) => !locked && setResp(e.target.value.replace(/[^0-9.,\-−/]/g, '').slice(0, 10))} inputMode="none" aria-label="Ответ числом"
              className="lx-field" style={{ width: 180, fontSize: 26, textAlign: 'center', padding: '8px 10px' }} />
            {inst.unit && <span style={{ fontSize: 16, color: 'var(--c-muted)' }}>{inst.unit}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 320, margin: '0 auto' }} role="group" aria-label="Цифровая клавиатура">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map((k) => <button key={k} type="button" className="ln-key" disabled={locked} onClick={() => press(k)}>{k}</button>)}
            <button type="button" className="ln-key" aria-label="Стереть" disabled={locked} onClick={() => press('del')}><Delete size={20} /></button>
            <button type="button" className="ln-key" style={{ gridColumn: 'span 3', fontSize: 15 }} disabled={locked} onClick={() => press(val.startsWith('-') ? '' : '-')}
              aria-label="Минус">{val.startsWith('-') ? 'минус уже есть' : '− минус'}</button>
          </div>
        </div>
      );
    }
    case 'tiles': case 'curve': case 'price': case 'point': {
      const View = { tiles: TilesEx, curve: CurveEx, price: PriceEx, point: PointEx }[inst.kind];
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          <View inst={inst} resp={resp} setResp={(v) => !locked && setResp(v)} locked={locked} fb={fb} />
        </div>
      );
    }
    case 'swipe': case 'rush': case 'chain': {
      const Round = { swipe: SwipeRound, rush: RushRound, chain: ChainRound }[inst.kind];
      return (
        <div>
          <div className="lx-h" style={{ fontSize: 20, marginBottom: 6 }}>{inst.title}</div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {/* раунд сам решает, когда он окончен, — и сразу уходит на проверку */}
          <Round inst={inst} locked={locked} onDone={(r) => { setResp(r); onSubmit(r); }} />
        </div>
      );
    }
    default: return null;
  }
}
// итог раунда мини-игры для плашки
const gameLine = (inst, r) => {
  if (!r) return '';
  if (inst.kind === 'chain') return r.timeout ? 'Время вышло — цепочка не собрана.' : 'Цепочка собрана.';
  return `Верно ${r.right} из ${inst.kind === 'rush' ? r.answered : r.total}.`;
};

/* ------------------------------ УРОК ------------------------------
   mode: lesson — урок пути; check — проверка юнита (ошибки не возвращаются, сдана при ≤ 1
   ошибке); legend — уровень легенды; practice — повторение ошибок.
   Урок начат только с первого ответа: открыть и закрыть его — не считается нигде. Выход
   после первого ответа — с подтверждением; урок сохраняется и продолжается с того же места
   в течение суток (resume). */
function newPlan(run, learn) {
  if (run.mode === 'lesson') { const p = buildLesson(run.lessonId, Math.random, { mistakes: learn.mistakes.map((m) => m.id) }); return { items: p.items, cards: p.cards, seconds: p.seconds }; }
  if (run.mode === 'check') { const p = buildUnitCheck(run.unitId); return { items: p.items, cards: {}, passMistakes: p.passMistakes }; }
  if (run.mode === 'legend') return { items: buildLegend(run.unitId).items, cards: {} };
  return { items: buildPractice(learn.mistakes.map((m) => m.id)).items, cards: {} };
}
function Runner({ run, learn, update, onClose, onOpenBook, hidden }) {
  const rs = run.resume || null;
  const [plan] = useState(() => (rs ? rs.plan : newPlan(run, learn)));
  const lesson = run.lessonId ? LESSON_BY_ID[run.lessonId] : null;
  // пройден ли урок раньше — на момент начала (после финиша он уже в прогрессе)
  const [replay] = useState(() => run.mode === 'lesson' && !!learn.lessons[run.lessonId]);
  const [queue, setQueue] = useState(() => (rs ? rs.queue : plan.items));
  const [pos, setPos] = useState(rs ? rs.pos : 0);
  const cardsSeen = useRef(new Set(rs ? rs.cardsSeen : []));
  const cardFor = (item) => (item && plan.cards && plan.cards[item.uid] && !cardsSeen.current.has(item.uid) ? plan.cards[item.uid] : null);
  const [stage, setStage] = useState(() => (cardFor((rs ? rs.queue : plan.items)[rs ? rs.pos : 0]) ? 'card' : 'work'));
  // карточки перед упражнением идут подряд: шаг, слово, пункт итогов; flipped — оборот слова
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const respRef = useRef(null);
  const [resp, setResp] = useState(null);
  const [fb, setFb] = useState(null);
  const [sel, setSel] = useState(null);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [term, setTerm] = useState(null);
  const [anim, setAnim] = useState({ k: 0, kind: null });
  const [run3, setRun3] = useState(rs ? rs.streak || 0 : 0);
  const acc = useRef({
    first: rs ? rs.first : {}, hinted: rs ? rs.hinted : {}, solved: new Set(rs ? rs.solved : []),
    start: Date.now() - (rs ? rs.elapsed || 0 : 0), itemStart: Date.now(), retries: rs ? rs.retries : 0,
  });
  const [started, setStarted] = useState(!!rs);
  const retryable = run.mode === 'lesson' || run.mode === 'practice';
  const total = plan.items.length;
  const cur = queue[pos];
  const orig = cur ? (cur.orig || cur.uid) : null;
  const pct = total ? Math.round((acc.current.solved.size / total) * 100) : 0;
  const color = unitColor(lesson ? lesson.unit : run.unitId);

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
      update((s) => recordAttempt(s, cur.kind, r.ok, ms));
    }
    if (r.ok) {
      a.solved.add(orig);
      if (run.mode === 'practice') update((s) => resolveMistake(s, cur.id));
      if (firstTime) setRun3((n) => n + 1);
      Audio.play('coin'); vibrate(15);
    } else {
      setRun3(0);
      Audio.play('down'); vibrate([30, 40, 30]);
      if (run.mode === 'lesson') update((s) => addMistake(s, cur.id));
      if (retryable && !cur.noRetry) { a.retries += 1; setQueue((q) => [...q, { ...cur, uid: `${cur.uid}r${a.retries}`, orig, retry: true }]); }
      else a.solved.add(orig);
    }
    setAnim((x) => ({ k: x.k + 1, kind: r.ok ? 'flash' : 'shake' }));
    setFb({ ok: r.ok, why: r.why });
  };
  const finish = () => {
    const a = acc.current;
    const firstOk = Object.values(a.first).filter(Boolean).length;
    // подсказка — не ошибка, но опыта за такой ответ меньше
    const hintedOk = Object.keys(a.first).filter((k) => a.first[k] && a.hinted[k]).length;
    const cleanOk = firstOk - hintedOk;
    const mistakes = Object.values(a.first).filter((x) => !x).length;
    const accuracy = total ? (firstOk / total) * 100 : 0;
    const ms = Date.now() - a.start;
    let xp = 0; let pass = null;
    if (run.mode === 'lesson') {
      xp = lessonXp({ firstTry: cleanOk, hinted: hintedOk, replay });
      update((s) => finishLesson(s, run.lessonId, { xp, accuracy }));
      dropResume(run.lessonId);
    } else if (run.mode === 'check') {
      pass = mistakes <= plan.passMistakes;
      xp = cleanOk * XP.correct + hintedOk * XP.hinted;
      const ids = UNIT_BY_ID[run.unitId].lessons.map((l) => l.id);
      update((s) => { const t = finishLesson(s, null, { xp, accuracy }); return pass ? passUnit(t, run.unitId, ids) : t; });
    } else {
      xp = cleanOk * XP.correct + hintedOk * XP.hinted;
      update((s) => finishLesson(s, null, { xp, accuracy }));
    }
    Audio.play('up'); vibrate([20, 30, 20, 30, 60]);
    setResult({ xp, accuracy, ms, pass, mistakes });
    setStage('done');
  };
  const next = () => {
    Audio.play('click');
    if (pos + 1 >= queue.length) { finish(); return; }
    setPos(pos + 1); setResp(null); setFb(null); setSel(null); setTerm(null);
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
        plan: { items: plan.items, cards: plan.cards, seconds: plan.seconds }, queue, pos: Math.min(at, queue.length - 1),
        first: a.first, hinted: a.hinted, solved: [...a.solved], retries: a.retries, elapsed: Date.now() - a.start,
        cardsSeen: [...cardsSeen.current], streak: run3, kind: cur ? cur.kind : 'choice',
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
  const inst = marked ? { ...marked, _sel: sel, _setSel: setSel, _resp: respRef } : null;
  const title = run.mode === 'lesson' ? lesson.title : run.mode === 'check' ? 'Проверка юнита' : run.mode === 'legend' ? 'Уровень легенды' : 'Практика';
  const glow = run3 >= 3 && stage !== 'done';

  return (
    <div className="ln-overlay" data-testid="lesson" data-mode={run.mode} role="dialog" aria-label={title} style={{ '--u': color, display: hidden ? 'none' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 6px', maxWidth: 592, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {stage !== 'done' && <button type="button" className="lx-icon-btn" aria-label="Выйти из урока" data-nav="back" onClick={exit}><X size={26} /></button>}
        <div className={`ln-bar ${glow ? 'glow' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} data-testid="lesson-progress" data-glow={glow ? 'on' : 'off'}>
          <span style={{ width: `${stage === 'done' ? 100 : Math.max(pct, 3)}%` }} />
        </div>
        {glow && <span className="lx-h lx-pop" key={run3} style={{ color: '#E89B00', fontSize: 15, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2 }} data-testid="lesson-streak"><Flame size={18} />{run3}</span>}
      </div>

      {asking && (
        <div className="ln-sheet-back" style={{ position: 'absolute' }}>
          <div className="ln-sheet lx-rise" style={{ textAlign: 'center' }} role="dialog" aria-label="Выйти из урока?">
            <Mascot mood="cheer" size={64} />
            <div className="lx-h" style={{ fontSize: 22, margin: '8px 0 4px' }}>Выйти из урока?</div>
            <div className="lx-sub" style={{ fontSize: 15, marginBottom: 16 }}>
              {run.mode === 'lesson' ? 'Прогресс урока сохранится — продолжить можно в течение суток.' : 'Эту проверку можно будет пройти заново.'}
            </div>
            <button type="button" className="lx-btn wide" onClick={() => setAsking(false)} autoFocus>Продолжить урок</button>
            <button type="button" className="lx-btn ghost wide" style={{ marginTop: 8, '--b': 'var(--c-rust)' }} onClick={leave}>Выйти</button>
          </div>
        </div>
      )}

      {stage === 'card' && cur && cardFor(cur) && (() => {
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
          Audio.play('click');
          if (!last) { setCardIdx(cardIdx + 1); setFlipped(false); return; }
          cardsSeen.current.add(cur.uid); acc.current.itemStart = Date.now(); setCardIdx(0); setFlipped(false); setStage('work');
        };
        const picture = c.chart ? <MiniChart type={c.chart} attrs={c.attrs} /> : c.pic ? <Pic name={c.pic} /> : null;
        return (
          <>
            <div className="ln-body"><div className="ln-inner lx-rise" data-testid="lesson-card" data-style={c.flash ? 'flash' : kind} key={c.id}>
              <div className="ln-kind">{eyebrow}</div>
              {c.flash ? (
                <FlashCard card={c} flipped={flipped} onFlip={() => { Audio.play('tick'); setFlipped((v) => !v); }} />
              ) : kind === 'story' && c.who ? (
                <>
                  <h2 className="lx-h" style={{ fontSize: 22, margin: '0 0 12px' }}>{heading}</h2>
                  <StoryCard card={c}><Inline nodes={c.text} ctx={noopCtx} /></StoryCard>
                  {picture}
                </>
              ) : kind === 'listen' ? (
                <>
                  <ListenCard key={c.id} text={plainText(c.text)} title={heading} />
                  {picture}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Mascot mood={kind === 'summary' ? 'joy' : 'think'} size={52} />
                    <h2 className="lx-h" style={{ fontSize: 24, margin: '4px 0 0' }}>{heading}</h2>
                  </div>
                  <div className="ln-prompt" style={{ fontSize: 18, marginTop: 14 }}><Inline nodes={c.text} ctx={noopCtx} /></div>
                  {picture}
                </>
              )}
            </div></div>
            <div className="ln-foot"><div className="ln-inner">
              {c.flash && !flipped
                ? <button type="button" className="lx-btn secondary wide" onClick={() => { Audio.play('tick'); setFlipped(true); }}>Перевернуть</button>
                : <button type="button" className="lx-btn wide" onClick={go}>{last ? (kind === 'summary' ? 'К тесту юнита' : 'Понятно') : 'Дальше'}</button>}
            </div></div>
          </>
        );
      })()}

      {stage === 'work' && inst && (
        <>
          <div className="ln-body"><div className={`ln-inner ${anim.kind === 'shake' && fb && !fb.ok ? 'lx-shake' : ''}`} key={`${inst.uid}:${anim.kind === 'shake' ? anim.k : 0}`}
            data-testid="ex" data-kind={inst.kind} data-answer={testAnswer(inst)}>
            <div className="ln-kind" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {GAME_KINDS.includes(inst.kind) ? `Раунд ${plan.items.findIndex((x) => x.uid === orig) + 1} из ${plan.items.length}` : KIND_LABEL[inst.kind]}
              {inst.review && <span className="tb-chip">повторение</span>}
            </div>
            {inst.retry && !fb && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14 }} className="lx-sub" data-testid="ex-retry">
                <Mascot mood="think" size={36} /> Эта задача уже была — попробуем ещё раз.
              </div>
            )}
            <ExerciseView inst={inst} ctx={termCtx} resp={resp} setResp={(v) => { setResp(v); if (fb && fb.empty) setFb(null); }} locked={!!fb && !fb.empty} fb={fb && !fb.empty ? fb : null}
              onSubmit={(v) => doCheck(v)} />
          </div></div>
          <div className={`ln-foot ${fb && !fb.empty ? (fb.ok ? 'ok lx-flash' : 'bad') : ''}`} key={`foot${anim.k}`} data-testid="lesson-foot"><div className="ln-inner">
            {fb && !fb.empty && (
              <div className="lx-rise" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }} data-testid="ex-feedback" data-ok={String(fb.ok)}>
                <Mascot mood={fb.ok ? 'joy' : 'cheer'} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lx-h" style={{ fontSize: 21 }}>{GAME_KINDS.includes(inst.kind) ? (fb.ok ? 'Раунд пройден!' : 'Раунд не засчитан') : fb.ok ? phrase(['Верно!', 'Отлично!', 'Так и есть!'], inst.uid) : 'Не совсем'}</div>
                  {GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15, marginTop: 2 }} data-testid="game-result">{gameLine(inst, resp)}{!fb.ok && ` Нужно: ${answerText(inst)}.`}</div>}
                  {!fb.ok && !GAME_KINDS.includes(inst.kind) && <div style={{ fontSize: 15, marginTop: 2 }}>Правильно: <b>{answerText(inst)}</b></div>}
                  {!fb.ok && fb.why && <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.5 }} data-testid="ex-why"><Inline nodes={fb.why} ctx={noopCtx} /></div>}
                  {!fb.ok && !fb.why && inst.explain && <div className="tb-body" style={{ fontSize: 15, marginTop: 4, color: 'inherit' }}><Blocks blocks={inst.explain} ctx={noopCtx} /></div>}
                  {!fb.ok && retryable && !inst.noRetry && <div style={{ fontSize: 13.5, marginTop: 4, opacity: 0.85 }}>Задача вернётся в конце урока.</div>}
                </div>
              </div>
            )}
            {fb && fb.empty && <div style={{ fontSize: 14, color: 'var(--c-rust)', marginBottom: 8 }}>Введите число: например, 25 или −0,5.</div>}
            {fb && !fb.empty
              ? <button type="button" className="lx-btn wide" onClick={next} autoFocus>Дальше</button>
              : GAME_KINDS.includes(inst.kind) ? null : <button type="button" className="lx-btn wide" disabled={!ready(inst, resp)} onClick={() => doCheck()}>Проверить</button>}
          </div></div>
        </>
      )}

      {term && stage === 'work' && (
        <div className="ln-term-sheet lx-rise" role="dialog" aria-label={`Термин: ${termTitle(term)}`} data-testid="term-sheet">
          <div className="ln-inner">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div className="lx-h" style={{ fontSize: 19, color: 'var(--u)' }}>{termTitle(term)}</div>
              <span style={{ fontSize: 12, color: 'var(--c-faint)' }}>подсказка · опыта за ответ меньше</span>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, margin: '8px 0 14px' }}>{termText(term)}</div>
            <button type="button" className="lx-btn secondary wide" onClick={() => setTerm(null)} autoFocus>Понятно</button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="ln-body"><div className="ln-inner" style={{ textAlign: 'center', paddingTop: 20 }} data-testid="lesson-result">
          {(run.mode !== 'check' || result.pass) && <Confetti seed={result.xp + 1} />}
          <Mascot mood={run.mode === 'check' && !result.pass ? 'cheer' : result.accuracy >= 60 ? 'party' : 'cheer'} size={120} />
          <h2 className="lx-h lx-pop" style={{ fontSize: 30, margin: '12px 0 4px', color: '#E89B00' }}>
            {run.mode === 'check' ? (result.pass ? 'Проверка сдана!' : 'Почти получилось') : run.mode === 'practice' ? 'Практика окончена' : 'Урок пройден!'}
          </h2>
          <div className="lx-sub" style={{ fontSize: 15.5, marginBottom: 20 }}>
            {run.mode === 'check' ? (result.pass ? 'Уроки юнита открыты — можно идти дальше.' : `Ошибок с первой попытки: ${result.mistakes}. Для зачёта — не больше ${plan.passMistakes}. Уроки юнита никуда не делись.`)
              : lesson && lesson.kind === 'summary' ? `Тест юнита: верно ${Math.round((result.accuracy * total) / 100)} из ${total}. Юнит «${UNIT_BY_ID[lesson.unit].title}» позади.`
                : lesson && lesson.kind === 'game' ? `Раундов засчитано: ${Math.round((result.accuracy * total) / 100)} из ${total}.`
                  : result.accuracy >= 90 ? 'Почти без ошибок.' : 'Ошибки разобраны — они вернутся в практике.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
            <Tile icon={Zap} label="Опыт" value={<CountUp value={result.xp} prefix="+" />} testid="result-xp" tone="#E89B00" />
            <Tile icon={Target} label="Точность" value={`${Math.round(result.accuracy)}%`} testid="result-acc" tone="#58A700" />
            <Tile icon={Timer} label="Время" value={mmss(result.ms)} testid="result-time" tone="#1CB0F6" />
          </div>
          {replay && <div style={{ fontSize: 13.5, color: 'var(--c-faint)', marginBottom: 12 }}>Урок уже был пройден: за повтор — немного опыта, главное — закрепление.</div>}
          <button type="button" className="lx-btn wide" data-nav="back" onClick={onClose}>Дальше</button>
          {lesson && (
            <button type="button" className="lx-btn ghost wide" style={{ marginTop: 8 }} data-testid="result-theory" data-nav-target={`book:chapter:${lesson.unit}`}
              onClick={() => onOpenBook({ kind: 'chapter', id: lesson.unit, anchor: lesson.section })}>
              <BookOpenText size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Подробнее в учебнике
            </button>
          )}
        </div></div>
      )}
    </div>
  );
}
// «Знакомство: спрос» под подписью вида урока — просто «Спрос»
const bareTitle = (t) => { const x = String(t).replace(/^Знакомство:\s*/, ''); return x.charAt(0).toUpperCase() + x.slice(1); };
const phrase = (list, seed) => list[Math.abs([...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % list.length];
function Tile({ icon: Icon, label, value, testid, tone }) {
  return (
    <div className="ln-tile" data-testid={testid} style={{ borderColor: tone }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon size={13} />{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

/* ------------------------------ КАРТОЧКА УРОКА ------------------------------
   Нажатие на кружок урока ещё ничего не начинает: сначала карточка — название, вид урока,
   минуты и опыт — и кнопка «Начать» (или «Продолжить», если урок был прерван). */
function LessonSheet({ l, onStart, onClose }) {
  const lesson = LESSON_BY_ID[l.id];
  const [info] = useState(() => { const p = buildLesson(l.id); return { min: Math.max(2, Math.round(p.seconds / 60)), xp: p.items.length * XP.correct + XP.finish }; });
  const resume = l.open ? getResume(l.id) : null;
  const Icon = KIND_ICON[lesson.kind] || Dumbbell;
  return (
    <div className="ln-sheet-back" onClick={onClose} data-testid="lesson-sheet-back">
      <div className="ln-sheet lx-rise" role="dialog" aria-label={`Урок: ${l.title}`} data-testid="lesson-sheet" data-lesson={l.id} onClick={(e) => e.stopPropagation()}
        style={{ '--u': unitColor(lesson.unit) }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--u)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={26} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ln-kind" style={{ marginBottom: 2 }}>{LESSON_KIND[lesson.kind]}</div>
            <div className="lx-h" style={{ fontSize: 21 }}>{bareTitle(l.title)}</div>
          </div>
          <button type="button" className="lx-icon-btn" aria-label="Закрыть" data-nav="back" onClick={onClose}><X size={22} /></button>
        </div>
        <div style={{ display: 'flex', gap: 16, margin: '14px 0 16px', fontSize: 15, fontWeight: 700 }} className="lx-sub">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Timer size={16} />≈{info.min} мин</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#E89B00' }}><Zap size={16} />до {info.xp} XP</span>
          {l.done && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--c-teal)' }}><Check size={16} />пройден</span>}
        </div>
        {!l.open ? (
          <div className="lx-sub" style={{ fontSize: 15, textAlign: 'center', padding: '6px 0 4px' }} data-testid="lesson-sheet-locked">
            <Lock size={15} style={{ verticalAlign: -2, marginRight: 4 }} />Откроется после предыдущего урока — или сдайте проверку юнита.
          </div>
        ) : (
          <button type="button" className="lx-btn wide" data-testid="lesson-start" onClick={() => { Audio.prime(); Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id, resume }); }}>
            {resume ? 'Продолжить' : l.done ? 'Повторить' : 'Начать'}
          </button>
        )}
        {resume && <div style={{ fontSize: 13, color: 'var(--c-faint)', textAlign: 'center', marginTop: 8 }}>Урок сохранён с того места, где вы вышли.</div>}
      </div>
    </div>
  );
}

/* ------------------------------ ПУТЬ ------------------------------ */
const ZIG = [0, 58, 86, 58, 0, -58, -86, -58];
const SEEN_KEY = 'ems-learn-open-seen';
const readSeen = () => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); return Array.isArray(v) ? new Set(v) : null; } catch { return null; } };
const writeSeen = (set) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* приватный режим */ } };

function TopStats({ learn }) {
  const st = streak(learn); const g = goalToday(learn);
  const totalXp = Object.values(learn.xp).reduce((a, b) => a + b, 0);
  return (
    <div className="ln-stats" data-testid="path-stats">
      <span className="ln-stat" title="Серия дней" data-testid="streak" style={{ color: st.days ? '#FF9600' : 'var(--c-faint)' }}><Flame size={22} />{st.days}</span>
      <span className="ln-stat" title="Опыт" style={{ color: '#E89B00' }}><Zap size={22} />{totalXp}</span>
      <span className="ln-stat" title="Цель дня" data-testid="goal" style={{ color: g.done >= g.goal ? '#58A700' : 'var(--c-faint)' }}>
        <Target size={22} />{Math.min(g.done, g.goal)}/{g.goal}
      </span>
    </div>
  );
}
function PathView({ learn, onLesson, onStart, onOpenBook, visible }) {
  const states = pathState(learn);
  const sleepy = missedYesterday(learn);
  const g = goalToday(learn);
  const hello = g.done >= g.goal ? 'joy' : sleepy ? 'sleep' : 'hello';
  const first = states.find((x) => x.current) || states[0];
  const soon = UNITS.map((u, k) => ({ u, no: k + 1 })).filter(({ u }) => !states.some((x) => x.unit.id === u.id));
  const [soonOpen, setSoonOpen] = useState(false);
  const resumes = new Set(resumeIds());
  /* Замок открывшегося урока анимируется один раз, когда Путь снова на виду (урок и карточка
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
  return (
    <div className="ln-wrap" data-testid="path">
      <TopStats learn={learn} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mascot mood={hello} size={60} />
        <div className="lx-sub" style={{ fontSize: 15, lineHeight: 1.4 }}>
          {g.done >= g.goal ? 'Цель дня выполнена — можно и дальше.' : sleepy ? 'Инфля заскучала. Один урок — и снова в пути.' : first && first.current ? `Дальше: «${first.current.title}»` : 'Уроки по 3–5 минут.'}
        </div>
      </div>
      {UNITS.map((u, k) => ({ u, no: k + 1, st: states.find((x) => x.unit.id === u.id) })).filter((x) => x.st).map(({ u, no: unitNo, st }) => (
        <div key={u.id} data-testid="path-unit" data-unit={u.id} style={{ '--u': unitColor(u.id) }}>
          <div className="ln-banner">
            <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.9 }}>Юнит {unitNo}{st.complete ? ' · пройден' : ''}</div>
            <div className="lx-h" style={{ fontSize: 21, marginTop: 2 }}>{u.title}</div>
            <div>
              <button type="button" className="ln-banner-btn" data-testid="unit-guide" data-nav-target={`book:chapter:${u.id}`} onClick={() => { Audio.play('click'); onOpenBook({ kind: 'chapter', id: u.id }); }}>
                <BookOpenText size={16} />Гайд юнита
              </button>
              {!st.complete && <button type="button" className="ln-banner-btn" data-testid="unit-check" data-nav-target={`check:${u.id}`} onClick={() => { Audio.prime(); onStart({ mode: 'check', unitId: u.id }); }}>
                <Sparkles size={16} />Проверка юнита</button>}
              {st.complete && <button type="button" className="ln-banner-btn" data-testid="unit-legend" data-nav-target={`legend:${u.id}`} onClick={() => { Audio.prime(); onStart({ mode: 'legend', unitId: u.id }); }}>
                <Crown size={16} />Уровень легенды</button>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '22px 0 26px' }}>
            {st.lessons.map((l, i) => {
              const isCur = st.current && st.current.id === l.id;
              const lesson = LESSON_BY_ID[l.id];
              const unlocking = !reduced && visible && l.open && !l.done && !seen.has(l.id);
              const KindIcon = KIND_ICON[lesson.kind] || Dumbbell;
              const cls = l.done ? 'done' : l.open ? '' : 'locked';
              return (
                <div key={l.id} style={{ transform: `translateX(${ZIG[i % ZIG.length]}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                  {isCur && <span className="ln-bubble lx-bounce">{resumes.has(l.id) ? 'продолжить' : 'начать'}</span>}
                  <button type="button" className={`lx-node ${cls} ${isCur ? 'cur' : ''}`} data-testid="path-lesson" data-lesson={l.id} data-kind={lesson.kind}
                    data-state={l.done ? 'done' : l.open ? 'open' : 'locked'} data-nav-target={`lesson:${l.id}`}
                    aria-label={`${LESSON_KIND[lesson.kind]} ${l.no}: ${l.title}${l.done ? ', пройден' : l.open ? '' : ', закрыт'}`}
                    onClick={() => { Audio.prime(); Audio.play('click'); onLesson(l); }}>
                    {l.done ? <><KindIcon size={30} /><span className="ln-done-badge" aria-hidden="true"><Check size={13} strokeWidth={3.4} /></span></>
                      : unlocking ? (
                        <span style={{ position: 'relative', display: 'inline-flex' }} data-testid="unlock-anim">
                          <Lock size={28} className="lx-unlock" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
                          <KindIcon size={30} className="lx-appear" style={{ animationDelay: '.75s', animationFillMode: 'backwards' }} />
                        </span>
                      ) : l.open ? <KindIcon size={30} /> : <Lock size={28} />}
                  </button>
                  {/* название — тоже кнопка урока: в кружок на телефоне попадают не всегда */}
                  <button type="button" className={`ln-node-title ${l.open ? '' : 'locked'}`} tabIndex={-1} aria-hidden="true" data-testid="path-lesson-title" data-lesson={l.id}
                    onClick={() => { Audio.play('click'); onLesson(l); }}>{l.title}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {soon.length > 0 && (
        <div className="lx-card" data-testid="path-soon">
          <button type="button" className="ln-soon-head" aria-expanded={soonOpen} onClick={() => { Audio.play('tab'); setSoonOpen((v) => !v); }}>
            <Lock size={18} color="var(--c-faint)" />
            <span style={{ flex: 1 }}><span className="lx-h" style={{ fontSize: 16 }}>Дальше на Пути: {soon.length} {plural(soon.length, 'юнит готовится', 'юнита готовятся', 'юнитов готовятся')}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--c-faint)' }}>гайды готовых глав уже можно читать</span></span>
            <ChevronRight size={18} style={{ transform: soonOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {soonOpen && (
            <div style={{ padding: '0 14px 10px' }} data-testid="path-soon-list">
              {soon.map(({ u, no }) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '2px solid var(--c-hairline)' }} data-unit={u.id}>
                  <span style={{ flex: 1, fontSize: 14.5 }}>Юнит {no} · {u.title}</span>
                  {u.ready && <button type="button" className="lx-btn ghost" style={{ padding: '4px 8px', fontSize: 13, '--b': 'var(--c-blue)' }} data-nav-target={`book:chapter:${u.id}`}
                    onClick={() => onOpenBook({ kind: 'chapter', id: u.id })}>Гайд</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ПРАКТИКА ------------------------------ */
function MenuCard({ icon, title, text, onClick, testid, target, disabled = false, tone = '#1CB0F6' }) {
  return (
    <button type="button" className="lx-card ln-menu-btn" onClick={disabled ? undefined : onClick} data-testid={testid} data-nav-target={disabled ? undefined : target} disabled={disabled}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: tone, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.createElement(icon, { size: 24 })}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}><span className="lx-h" style={{ fontSize: 17, display: 'block' }}>{title}</span><span style={{ fontSize: 14, color: 'var(--c-muted)' }}>{text}</span></span>
      {!disabled && <ChevronRight size={20} color="var(--c-faint)" />}
    </button>
  );
}
function PracticeView({ learn, onStart, onOpenBook }) {
  const n = learn.mistakes.length;
  // раздел учебника на сегодня и повторение — тот же расчёт минут, что и в самом учебнике
  const [today] = useState(() => todayCard());
  return (
    <div className="ln-wrap" data-testid="practice">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Mascot mood={n ? 'think' : 'joy'} size={56} />
        <div><h1 className="lx-h" style={{ fontSize: 26, margin: 0 }}>Практика</h1><div className="lx-sub" style={{ fontSize: 14.5 }}>Ошибки уроков возвращаются сюда, пока не решите их верно.</div></div>
      </div>
      <MenuCard icon={RotateCcw} tone="#FF9600" title="Повторить ошибки" testid="practice-mistakes" target="run:practice" disabled={!n}
        text={n ? `${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')} из прошлых уроков` : 'Ошибок нет — всё решено верно'}
        onClick={() => { Audio.prime(); onStart({ mode: 'practice' }); }} />
      <MenuCard icon={BookOpenText} title="На сегодня" testid="practice-today" target="book:today"
        text={today.section ? `«${today.section.title}» · ≈${today.section.minutes} мин · на повторение: ${today.due}` : `Все разделы готовых глав пройдены · на повторение: ${today.due}`}
        onClick={() => onOpenBook({ kind: 'today' })} />
      <MenuCard icon={Target} tone="#CE82FF" title="Задачи вперемешку" testid="practice-mixed" target="book:mixed" text="Из начатых глав, без подсказки, какая нужна модель" onClick={() => onOpenBook({ kind: 'mixed' })} />
      <MenuCard icon={Trophy} tone="#FFC800" title="Итоговая проверка: Микро" testid="practice-exam" target="book:exam:micro" text="Шестнадцать задач с новыми числами при каждой попытке" onClick={() => onOpenBook({ kind: 'exam', id: 'micro' })} />
    </div>
  );
}

/* ------------------------------ ПРОФИЛЬ ------------------------------ */
function ProfileView({ learn, update, onOpenBook, onThemeChange }) {
  const st = streak(learn); const stats = learnStats(learn);
  const bw = bestWeek(learn);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const [dark, setDark] = useState(learnDark);
  const [account, setAccount] = useState(false);
  const row = (label, value, testid) => <div className="ln-row" data-testid={testid}><span>{label}</span><b>{value}</b></div>;
  return (
    <div className="ln-wrap" data-testid="learn-profile">
      {account && <div data-testid="account" style={{ display: 'contents' }}><ProfileModal onClose={() => setAccount(false)} onSwitched={() => setAccount(false)} /></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Mascot mood={st.days >= 3 ? 'joy' : 'hello'} size={56} />
        <div><h1 className="lx-h" style={{ fontSize: 26, margin: 0 }}>Профиль</h1><div className="lx-sub" style={{ fontSize: 14.5 }}>Личные рекорды — без лиг и соревнований.</div></div>
      </div>
      <div className="lx-card" style={{ padding: 16, margin: '12px 0' }}>
        <div className="lx-h" style={{ fontSize: 18, marginBottom: 6 }}>Рекорды</div>
        {row('Серия сейчас', `${st.days} дн.${st.freezesUsed.length ? ` · заморожено дней: ${st.freezesUsed.length}` : ''}`, 'prof-streak')}
        {row('Самая длинная серия', `${longestStreak(learn)} дн.`)}
        {row('Лучшая неделя', bw.xp ? `${bw.xp} XP` : '—')}
        {row('Всего опыта', `${stats.totalXp} XP`)}
        <div style={{ fontSize: 13, color: 'var(--c-faint)', marginTop: 4 }}>Один пропущенный день в неделю серию не обнуляет.</div>
      </div>
      <div className="lx-card" style={{ padding: 16, margin: '12px 0' }}>
        <div className="lx-h" style={{ fontSize: 18, marginBottom: 8 }}>Цель дня</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Уроков в день">
          {GOALS.map((g) => <button key={g} type="button" className="lx-chip" aria-pressed={learn.goal === g} onClick={() => update((s) => setGoal(s, g))}>{g} {plural(g, 'урок', 'урока', 'уроков')}</button>)}
        </div>
      </div>
      <div className="lx-card" style={{ padding: 16, margin: '12px 0' }} data-testid="prof-stats">
        <div className="lx-h" style={{ fontSize: 18, marginBottom: 6 }}>Как идёт учёба</div>
        <div style={{ fontSize: 14, color: 'var(--c-muted)', marginBottom: 4 }}>Дней занятий по неделям (эта — справа)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 64, marginBottom: 10 }} data-testid="prof-weeks">
          {[...stats.weeks].reverse().map((w) => (
            <div key={w.week} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: Math.max(4, (w.days / 7) * 46), background: w.days ? '#58CC02' : 'var(--c-border)', borderRadius: 6 }} />
              <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{w.days}/7</div>
            </div>
          ))}
        </div>
        {row('Уроков доведено до конца', stats.completion == null ? '—' : pct(stats.completion), 'prof-completion')}
        {stats.types.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: '3px 12px', fontSize: 14, marginTop: 8 }} data-testid="prof-types">
            <span style={{ color: 'var(--c-faint)' }}>тип</span><span style={{ color: 'var(--c-faint)' }}>точность</span><span style={{ color: 'var(--c-faint)' }}>время</span>
            {stats.types.map((t) => (
              <React.Fragment key={t.kind}><span>{KIND_LABEL[t.kind] || t.kind}</span><b>{pct(t.accuracy)}</b><b>{Math.round(t.avgSec)} с</b></React.Fragment>
            ))}
          </div>
        )}
        {stats.quitKinds.length > 0 && (
          <div style={{ fontSize: 14, marginTop: 8, color: 'var(--c-muted)' }} data-testid="prof-quits">
            Брошенные уроки чаще всего прерывали на упражнении «{KIND_LABEL[stats.quitKinds[0][0]] || stats.quitKinds[0][0]}»{stats.quitPos[0] ? `, обычно на ${stats.quitPos[0].index + 1}-м` : ''}.
          </div>
        )}
      </div>
      <MenuCard icon={BookOpenText} title="Учебник" testid="prof-book" target="book:toc" text="Все главы, формулы и задачи — как справочник" onClick={() => onOpenBook({ kind: 'toc' })} />
      <MenuCard icon={Target} tone="#58CC02" title="Мой прогресс в учебнике" testid="prof-book-stats" target="book:stats" text="Разделы, точность, слабые темы и журнал занятий" onClick={() => onOpenBook({ kind: 'stats' })} />
      <MenuCard icon={UserRound} tone="#CE82FF" title="Аккаунт" testid="prof-account" target="account" text="Имя, значок, пароль, выход" onClick={() => setAccount(true)} />
      <div className="lx-card" style={{ padding: '12px 16px', margin: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Moon size={22} color="var(--c-muted)" />
        <span style={{ flex: 1, fontWeight: 700 }}>Тёмная тема</span>
        <button type="button" role="switch" aria-checked={dark} aria-label="Тёмная тема" className="ln-toggle" data-testid="prof-dark"
          onClick={() => { setLearnDark(!dark); setDark(!dark); onThemeChange(); }} />
      </div>
    </div>
  );
}

/* ------------------------------ ВКЛАДКИ ------------------------------
   Корень экранов обучения. Учебник — подэкран поверх вкладки (или поверх итогов урока):
   его «назад» возвращает туда, откуда открыли. Нижняя панель — в корне приложения. */
export function LearnTab({ tab, bookHandlers = {}, reopenBook = false, onBookReopened = () => {}, onThemeChange = () => {} }) {
  const [learn, update] = useLearn();
  const [run, setRun] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [book, setBook] = useState(null);
  const [bookKey, setBookKey] = useState(0);
  const openBook = (page, resume = false) => { setBook({ page, resume }); setBookKey((k) => k + 1); window.scrollTo(0, 0); };
  // смена вкладки закрывает подэкраны
  useEffect(() => { setBook(null); setSheet(null); }, [tab]);
  // вернулись из Лаборатории или партии, открытой из учебника, — снова в учебник, на то же место
  useEffect(() => { if (reopenBook) { openBook(null, true); onBookReopened(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenBook]);
  const start = (r) => { setSheet(null); setRun(r); };
  return (
    <div className="lx ln-root">
      <LearnStyle />
      <style>{TEXTBOOK_CSS + CSS + PLAY_CSS}</style>
      {book && (
        <div className="ln-book" data-testid="learn-book">
          <TextbookScreen key={bookKey} startPage={book.page} resume={book.resume} onExit={() => setBook(null)} {...bookHandlers} />
        </div>
      )}
      {/* пока идёт урок или открыт учебник, экран под ними недоступен ни с клавиатуры, ни для чтения с экрана */}
      <div inert={!!run || !!sheet || !!book} style={book ? { display: 'none' } : undefined}>
        {tab === 'path' && <PathView learn={learn} onLesson={setSheet} onStart={start} onOpenBook={openBook} visible={!run && !sheet && !book} />}
        {tab === 'practice' && <PracticeView learn={learn} onStart={start} onOpenBook={openBook} />}
        {tab === 'profile' && <ProfileView learn={learn} update={update} onOpenBook={openBook} onThemeChange={onThemeChange} />}
      </div>
      {sheet && <LessonSheet l={sheet} onStart={start} onClose={() => setSheet(null)} />}
      {run && <Runner key={JSON.stringify({ ...run, resume: !!run.resume })} run={run} learn={learn} update={update} hidden={!!book}
        onClose={() => setRun(null)} onOpenBook={(page) => openBook(page)} />}
    </div>
  );
}
export default LearnTab;
