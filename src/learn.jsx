/* ПУТЬ «КАК В ДУОЛИНГО»: главный экран учёбы (дорожка уроков), урок во весь экран,
   практика и профиль учёбы. Отдельный ленивый чанк вместе с учебником — формулы и графики
   те же. Данные и правила — src/learn/course.js (уроки и упражнения) и
   src/textbook/learn-state.js (опыт, серия, статистика). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Flame, Zap, Target, Lock, Check, Crown, BookOpenText, Trophy, Timer, Delete, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { COLOR, Audio, getPlayerId, syncProfile } from './MacroSimulator.jsx';
import { Blocks, Inline, ChartSvg, TEXTBOOK_CSS } from './textbook.jsx';
import { CHARTS, chartDefaults } from './textbook/charts.js';
import { CHAPTER_SECTIONS } from './textbook/content.js';
import { loadProgress, saveProgress } from './textbook/progress.js';
import { UNITS, UNIT_BY_ID, LESSON_BY_ID, KIND_LABEL, SHIFT_CURVES, buildLesson, buildUnitCheck, buildLegend, buildPractice, check, ready, answerText, pathState } from './learn/course.js';
import { startLesson, recordAttempt, quitLesson, addMistake, resolveMistake, finishLesson, passUnit, lessonXp, streak, longestStreak, bestWeek, goalToday, missedYesterday, learnStats, setGoal, GOALS, XP } from './textbook/learn-state.js';
import { Mascot } from './mascot.jsx';
import { todayCard } from './textbook/today-snapshot.js';
import { markTerms, termTitle, termText } from './learn/terms.js';

const CSS = `
  .ln-root { min-height: 100vh; background: var(--c-bg, ${COLOR.bg}); color: ${COLOR.text}; padding: 16px 16px 96px; }
  .ln-wrap { max-width: 560px; margin: 0 auto; }
  .ln-top { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
  .ln-stat { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 700; }
  .ln-unit { border: 1px solid ${COLOR.border}; background: ${COLOR.panel}; border-radius: 14px; padding: 14px; margin: 18px 0 10px; }
  .ln-node { width: 70px; height: 70px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font: inherit; position: relative; box-shadow: 0 5px 0 rgba(0,0,0,.35); }
  .ln-node[disabled] { cursor: default; }
  .ln-node.current { outline: 3px solid ${COLOR.gold}; outline-offset: 5px; }
  .ln-soon { border: 1px dashed ${COLOR.border}; border-radius: 12px; padding: 10px 12px; margin: 8px 0; display: flex; align-items: center; gap: 10px; color: ${COLOR.muted}; font-size: 13.5px; }
  .ln-overlay { position: fixed; inset: 0; z-index: 300; background: ${COLOR.bg}; display: flex; flex-direction: column; }
  .ln-bar { height: 12px; border-radius: 6px; background: ${COLOR.hairline}; overflow: hidden; flex: 1; }
  .ln-bar > span { display: block; height: 100%; background: ${COLOR.teal}; border-radius: 6px; transition: width .3s; }
  .ln-body { flex: 1; overflow-y: auto; padding: 18px 16px 24px; }
  .ln-inner { max-width: 560px; margin: 0 auto; }
  .ln-foot { border-top: 1px solid ${COLOR.hairline}; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); }
  .ln-foot.ok { background: rgba(79,163,143,.16); border-top-color: ${COLOR.teal}; }
  .ln-foot.bad { background: rgba(224,122,95,.14); border-top-color: ${COLOR.rust}; }
  .ln-cta { width: 100%; padding: 14px; font-size: 16px; font-weight: 700; border-radius: 12px; }
  .ln-opt { display: block; width: 100%; text-align: left; padding: 13px 14px; margin: 8px 0; border: 2px solid ${COLOR.border}; border-radius: 12px; background: ${COLOR.panel}; color: ${COLOR.text}; font: inherit; font-size: 15px; cursor: pointer; }
  .ln-opt[aria-pressed="true"] { border-color: ${COLOR.blue}; background: ${COLOR.panelAlt}; }
  .ln-opt.right { border-color: ${COLOR.teal}; }
  .ln-opt.wrong { border-color: ${COLOR.rust}; }
  .ln-chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 44px; padding: 9px 12px; margin: 4px; border: 2px solid ${COLOR.border}; border-radius: 10px; background: ${COLOR.panel}; color: ${COLOR.text}; font: inherit; font-size: 14.5px; cursor: pointer; }
  .ln-chip[aria-pressed="true"] { border-color: ${COLOR.blue}; background: ${COLOR.panelAlt}; }
  .ln-chip.used { opacity: .35; }
  .ln-key { padding: 14px 0; font-size: 20px; border-radius: 10px; border: 1px solid ${COLOR.border}; background: ${COLOR.panel}; color: ${COLOR.text}; font-family: inherit; cursor: pointer; }
  .ln-prompt { font-size: 16px; line-height: 1.55; margin-bottom: 12px; }
  .ln-prompt p { margin: 0 0 10px; }
  .ln-kind { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: ${COLOR.goldSoft}; margin-bottom: 8px; }
  .ln-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; }
  .ln-node-title { background: none; border: none; padding: 2px 4px; font: inherit; font-size: 12.5px; max-width: 160px; text-align: center; cursor: pointer; }
  .ln-node-title[disabled] { cursor: default; }
  .ln-soon-head { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; color: inherit; font: inherit; padding: 10px 12px; cursor: pointer; }
  .tb-term { background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: help; text-decoration: underline dotted ${COLOR.goldSoft}; text-underline-offset: 4px; text-decoration-thickness: 2px; }
  .tb-term:focus-visible { outline: 2px solid ${COLOR.gold}; outline-offset: 2px; }
  .ln-sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: ${COLOR.panel}; border-top: 2px solid ${COLOR.gold}; border-radius: 16px 16px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -10px 30px rgba(0,0,0,.45); }
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
  useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((pf) => { if (alive && pf) setProgress(loadProgress()); }).catch(() => {});
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); syncProfile(playerId).catch(() => {}); };
  }, [playerId]);
  const update = (fn) => {
    setProgress((p) => { const learn = fn(p.learn); return learn === p.learn ? p : saveProgress({ ...p, learn }); });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; syncProfile(playerId).catch(() => {}); }, 2000);
  };
  return [progress.learn, update];
}

/* ------------------------------ МИНИ-ГРАФИК ------------------------------ */
function MiniChart({ type, attrs, values = null }) {
  const def = CHARTS[type];
  if (!def) return null;
  const v = { ...chartDefaults(type, attrs), ...values };
  return <div style={{ maxWidth: 360, margin: '8px auto' }}><ChartSvg scene={def.build(attrs, v)} /></div>;
}

/* ------------------------------ УПРАЖНЕНИЯ ------------------------------ */
// «___» в тексте вопроса → выбранная плитка
const fillBlank = (blocks, word) => JSON.parse(JSON.stringify(blocks), (k, v) => (k === 'v' && typeof v === 'string' && v.includes('___') ? v.replace('___', word) : v));

function ExerciseView({ inst, resp, setResp, locked, fb, ctx = noopCtx }) {
  const pick = (v) => { if (!locked) { Audio.play('tick'); setResp(v); } };
  const optClass = (key, correct) => (!fb ? '' : correct ? 'right' : key === resp && !fb.ok ? 'wrong' : '');
  switch (inst.kind) {
    case 'choice':
      return (
        <div>
          <div className="ln-prompt tb-body"><Blocks blocks={inst.prompt} ctx={ctx} /></div>
          {inst.options.map((o) => (
            <button key={o.key} type="button" className={`ln-opt ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
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
              <button key={o.key} type="button" className={`ln-chip ${optClass(o.key, o.correct)}`} aria-pressed={resp === o.key} data-key={o.key} disabled={locked}
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
              <button key={l} type="button" className={`ln-opt ${!fb ? '' : v === inst.answer ? 'right' : v === resp ? 'wrong' : ''}`} style={{ textAlign: 'center', fontWeight: 700 }}
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
              <button key={c.key} type="button" className={`ln-opt ${optClass(c.key, c.key === inst.answer)}`} style={{ textAlign: 'center', margin: 0 }}
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
                  <button key={d} type="button" className={`ln-chip ${fb && inst.expect[v.key] === d ? 'right' : ''}`} aria-pressed={r[v.key] === d} data-var={v.key} data-dir={d}
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
          <div style={{ minHeight: 60, border: `2px dashed ${COLOR.border}`, borderRadius: 12, padding: 6, marginBottom: 10 }} data-testid="ln-order-answer">
            {seq.map((k, i) => { const it = inst.items.find((x) => x.key === k); return (
              <button key={k} type="button" className="ln-opt" style={{ margin: '4px 0' }} disabled={locked} onClick={() => pick(seq.filter((x) => x !== k))}>
                <b style={{ color: COLOR.goldSoft }}>{i + 1}.</b> <Inline nodes={it.text} ctx={ctx} />
              </button>
            ); })}
            {!seq.length && <div style={{ fontSize: 13, color: COLOR.faint, padding: 10, textAlign: 'center' }}>Нажимайте карточки по порядку</div>}
          </div>
          {inst.items.filter((it) => !seq.includes(it.key)).map((it) => (
            <button key={it.key} type="button" className="ln-opt" data-key={it.key} disabled={locked} onClick={() => pick([...seq, it.key])}><Inline nodes={it.text} ctx={ctx} /></button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>{inst.left.map((l) => (
              <button key={l.key} type="button" className="ln-opt" data-side="left" data-key={l.key} aria-pressed={sel === l.key} disabled={locked}
                style={{ fontSize: 14, borderColor: l.key in pairNo ? tone(pairNo[l.key]) : undefined }}
                onClick={() => { Audio.play('tick'); if (l.key in r) { const n = { ...r }; delete n[l.key]; setResp(n); setSel(null); } else setSel(l.key); }}>
                <Inline nodes={l.text} ctx={ctx} /></button>
            ))}</div>
            <div>{inst.right.map((x) => (
              <button key={x.key} type="button" className="ln-opt" data-side="right" data-key={x.key} disabled={locked || (!sel && !(x.key in rightOwner))}
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
            <div key={it.key} style={{ border: `1px solid ${fb ? (r[it.key] === it.bin ? COLOR.teal : COLOR.rust) : COLOR.border}`, borderRadius: 12, padding: '8px 10px', margin: '8px 0', background: COLOR.panel }}>
              <div style={{ fontSize: 14.5, marginBottom: 4 }}><Inline nodes={it.text} ctx={ctx} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {inst.bins.map((b) => (
                  <button key={b} type="button" className="ln-chip" style={{ fontSize: 13, padding: '6px 10px' }} aria-pressed={r[it.key] === b} data-item={it.key} data-bin={b} disabled={locked}
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
              style={{ width: 180, fontSize: 26, textAlign: 'center', padding: '8px 10px', borderRadius: 12, border: `2px solid ${COLOR.border}`, background: COLOR.panel, color: COLOR.text, fontFamily: 'inherit' }} />
            {inst.unit && <span style={{ fontSize: 16, color: COLOR.muted }}>{inst.unit}</span>}
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
    default: return null;
  }
}

/* ------------------------------ УРОК ------------------------------
   mode: lesson — урок пути; check — проверка юнита (ошибки не возвращаются, сдана при ≤ 1
   ошибке); legend — уровень легенды; practice — повторение ошибок. */
function Runner({ run, learn, update, onClose, onOpenTheory }) {
  const [plan] = useState(() => {
    if (run.mode === 'lesson') return buildLesson(run.lessonId);
    if (run.mode === 'check') return buildUnitCheck(run.unitId);
    if (run.mode === 'legend') return buildLegend(run.unitId);
    return buildPractice(learn.mistakes.map((m) => m.id));
  });
  const lesson = run.lessonId ? LESSON_BY_ID[run.lessonId] : null;
  // пройден ли урок раньше — на момент начала (после финиша он уже в прогрессе)
  const [replay] = useState(() => run.mode === 'lesson' && !!learn.lessons[run.lessonId]);
  const [stage, setStage] = useState(run.mode === 'lesson' ? 'idea' : 'work');
  const [queue, setQueue] = useState(() => plan.items);
  const [pos, setPos] = useState(0);
  const [resp, setResp] = useState(null);
  const [fb, setFb] = useState(null);
  const [sel, setSel] = useState(null);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const acc = useRef({ first: {}, hinted: {}, solved: new Set(), start: Date.now(), itemStart: Date.now(), retries: 0 });
  const [term, setTerm] = useState(null);
  const cardsSeen = useRef(new Set());
  const cardFor = (item) => (item && plan.cards && plan.cards[item.uid] && !cardsSeen.current.has(item.uid) ? plan.cards[item.uid] : null);
  const retryable = run.mode === 'lesson' || run.mode === 'practice';
  useEffect(() => { update(startLesson); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const total = plan.items.length;
  const cur = queue[pos];
  const orig = cur ? (cur.orig || cur.uid) : null;
  const pct = total ? Math.round((acc.current.solved.size / total) * 100) : 0;

  const doCheck = () => {
    if (!cur || !ready(cur, resp)) return;
    const r = check(cur, resp);
    if (r.empty) { setFb({ ok: false, why: null, empty: true }); return; }
    const a = acc.current;
    const firstTime = !(orig in a.first);
    const ms = Date.now() - a.itemStart;
    if (firstTime) {
      a.first[orig] = r.ok;
      update((s) => recordAttempt(s, cur.kind, r.ok, ms));
    }
    if (r.ok) {
      a.solved.add(orig);
      if (run.mode === 'practice') update((s) => resolveMistake(s, cur.id));
      Audio.play('coin'); vibrate(15);
    } else {
      Audio.play('tick'); vibrate([30, 40, 30]);
      if (run.mode === 'lesson') update((s) => addMistake(s, cur.id));
      if (retryable) { a.retries += 1; setQueue((q) => [...q, { ...cur, uid: `${cur.uid}r${a.retries}`, orig, retry: true }]); }
      else a.solved.add(orig);
    }
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
    // перед упражнением на новое понятие — вторая карточка идеи
    if (cardFor(queue[pos + 1])) setStage('card');
  };
  const openTerm = (id) => {
    Audio.play('tick');
    if (!fb && orig) acc.current.hinted[orig] = true;
    setTerm(id);
  };
  const termCtx = useMemo(() => ({ ...noopCtx, onTerm: openTerm }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [orig, fb]);
  const quit = () => {
    if (stage !== 'done' && cur) update((s) => quitLesson(s, cur.kind, pos));
    onClose();
  };
  // пустой план (упражнения ошибок убраны из курса) — сразу итог
  useEffect(() => { if (stage === 'work' && !cur && !result) finish(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, cur, result]);
  const exit = () => { if (stage === 'done') onClose(); else setAsking(true); };
  // термины условия — с подсказками; варианты ответа не размечаем: нажатие по ним — это выбор
  const marked = useMemo(() => (cur ? { ...cur, prompt: markTerms(cur.prompt) } : null), [cur]);
  const inst = marked ? { ...marked, _sel: sel, _setSel: setSel } : null;
  const title = run.mode === 'lesson' ? lesson.title : run.mode === 'check' ? 'Проверка юнита' : run.mode === 'legend' ? 'Уровень легенды' : 'Практика';

  return (
    <div className="ln-overlay" data-testid="lesson" data-mode={run.mode} role="dialog" aria-label={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 6px', maxWidth: 592, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" className="ems-btn ghost" aria-label="Выйти из урока" style={{ padding: 6 }} onClick={exit}><X size={20} /></button>
        <div className="ln-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} data-testid="lesson-progress"><span style={{ width: `${stage === 'done' ? 100 : pct}%` }} /></div>
      </div>

      {asking && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="ems-panel" style={{ width: '100%', maxWidth: 560, padding: 18, borderRadius: '16px 16px 0 0', textAlign: 'center' }}>
            <Mascot mood="cheer" size={56} />
            <div className="ems-serif" style={{ fontSize: 18, margin: '8px 0 4px' }}>Выйти из урока?</div>
            <div style={{ fontSize: 13.5, color: COLOR.muted, marginBottom: 14 }}>Урок можно начать заново в любой момент.</div>
            <button type="button" className="ems-btn primary ln-cta" onClick={() => setAsking(false)}>Продолжить урок</button>
            <button type="button" className="ems-btn ghost" style={{ marginTop: 8, width: '100%', padding: 10 }} onClick={quit}>Выйти</button>
          </div>
        </div>
      )}

      {stage === 'idea' && lesson && (
        <>
          <div className="ln-body"><div className="ln-inner" data-testid="lesson-idea">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <Mascot mood="think" size={52} />
              <div><div className="ln-kind">Новая идея · урок {lesson.no}</div><div className="ems-serif" style={{ fontSize: 22, fontWeight: 700 }}>{lesson.title}</div></div>
            </div>
            <div className="ln-prompt tb-body" style={{ fontSize: 16.5 }}><Inline nodes={lesson.idea.text} ctx={noopCtx} /></div>
            {lesson.idea.chart && <MiniChart type={lesson.idea.chart} attrs={lesson.idea.attrs} />}
            <div style={{ fontSize: 12.5, color: COLOR.faint, textAlign: 'center' }}>{total} упражнений · около {Math.round(plan.seconds / 60)} мин</div>
          </div></div>
          <div className="ln-foot"><div className="ln-inner">
            <button type="button" className="ems-btn primary ln-cta" onClick={() => { Audio.play('click'); setStage(cardFor(queue[0]) ? 'card' : 'work'); acc.current.start = Date.now(); acc.current.itemStart = Date.now(); }}>Начать</button>
          </div></div>
        </>
      )}

      {stage === 'card' && cur && cardFor(cur) && (() => {
        const c = cardFor(cur);
        return (
          <>
            <div className="ln-body"><div className="ln-inner" data-testid="lesson-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <Mascot mood="think" size={48} />
                <div><div className="ln-kind">Ещё одна идея</div><div className="ems-serif" style={{ fontSize: 21, fontWeight: 700 }}>{c.title}</div></div>
              </div>
              <div className="ln-prompt tb-body" style={{ fontSize: 16.5 }}><Inline nodes={c.text} ctx={noopCtx} /></div>
              {c.chart && <MiniChart type={c.chart} attrs={c.attrs} />}
            </div></div>
            <div className="ln-foot"><div className="ln-inner">
              <button type="button" className="ems-btn primary ln-cta" onClick={() => { Audio.play('click'); cardsSeen.current.add(cur.uid); acc.current.itemStart = Date.now(); setStage('work'); }}>Понятно</button>
            </div></div>
          </>
        );
      })()}

      {stage === 'work' && inst && (
        <>
          <div className="ln-body"><div className="ln-inner" key={inst.uid} data-testid="ex" data-kind={inst.kind} data-answer={testAnswer(inst)}>
            <div className="ln-kind" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {KIND_LABEL[inst.kind]}{inst.review && <span className="tb-chip">повторение</span>}
            </div>
            {inst.retry && !fb && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13.5, color: COLOR.muted }} data-testid="ex-retry">
                <Mascot mood="think" size={36} /> Эта задача уже была — попробуем ещё раз.
              </div>
            )}
            <ExerciseView inst={inst} ctx={termCtx} resp={resp} setResp={(v) => { setResp(v); if (fb && fb.empty) setFb(null); }} locked={!!fb && !fb.empty} fb={fb && !fb.empty ? fb : null} />
          </div></div>
          <div className={`ln-foot ${fb && !fb.empty ? (fb.ok ? 'ok' : 'bad') : ''}`} data-testid="lesson-foot"><div className="ln-inner">
            {fb && !fb.empty && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }} data-testid="ex-feedback" data-ok={String(fb.ok)}>
                <Mascot mood={fb.ok ? 'joy' : 'cheer'} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: fb.ok ? COLOR.teal : COLOR.rust }}>{fb.ok ? phrase(['Верно!', 'Отлично!', 'Так и есть!'], inst.uid) : 'Не совсем'}</div>
                  {!fb.ok && <div style={{ fontSize: 14, marginTop: 2 }}>Правильно: <b>{answerText(inst)}</b></div>}
                  {!fb.ok && fb.why && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }} data-testid="ex-why"><Inline nodes={fb.why} ctx={noopCtx} /></div>}
                  {!fb.ok && !fb.why && inst.explain && <div className="tb-body" style={{ fontSize: 14, marginTop: 4 }}><Blocks blocks={inst.explain} ctx={noopCtx} /></div>}
                  {!fb.ok && retryable && <div style={{ fontSize: 12.5, color: COLOR.muted, marginTop: 4 }}>Задача вернётся в конце урока.</div>}
                </div>
              </div>
            )}
            {fb && fb.empty && <div style={{ fontSize: 13.5, color: COLOR.rust, marginBottom: 8 }}>Введите число: например, 25 или −0,5.</div>}
            {fb && !fb.empty
              ? <button type="button" className="ems-btn primary ln-cta" onClick={next} autoFocus>Дальше</button>
              : <button type="button" className="ems-btn primary ln-cta" disabled={!ready(inst, resp)} onClick={doCheck}>Проверить</button>}
          </div></div>
        </>
      )}

      {term && stage === 'work' && (
        <div className="ln-sheet" role="dialog" aria-label={`Термин: ${termTitle(term)}`} data-testid="term-sheet">
          <div className="ln-inner">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div className="ems-serif" style={{ fontSize: 18, fontWeight: 700, color: COLOR.goldSoft }}>{termTitle(term)}</div>
              <span style={{ fontSize: 11.5, color: COLOR.faint }}>подсказка · опыта за ответ меньше</span>
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 12px' }}>{termText(term)}</div>
            <button type="button" className="ems-btn ln-cta" style={{ padding: 11, fontSize: 15 }} onClick={() => setTerm(null)} autoFocus>Понятно</button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="ln-body"><div className="ln-inner" style={{ textAlign: 'center', paddingTop: 24 }} data-testid="lesson-result">
          <Mascot mood={run.mode === 'check' && !result.pass ? 'cheer' : result.accuracy >= 60 ? 'party' : 'cheer'} size={110} />
          <div className="ems-serif" style={{ fontSize: 26, fontWeight: 700, margin: '10px 0 4px', color: COLOR.goldSoft }}>
            {run.mode === 'check' ? (result.pass ? 'Проверка сдана!' : 'Почти получилось') : run.mode === 'practice' ? 'Практика окончена' : 'Урок пройден!'}
          </div>
          <div style={{ fontSize: 14, color: COLOR.muted, marginBottom: 18 }}>
            {run.mode === 'check' ? (result.pass ? 'Уроки юнита открыты — можно идти дальше.' : `Ошибок с первой попытки: ${result.mistakes}. Для зачёта — не больше ${plan.passMistakes}. Уроки юнита никуда не делись.`)
              : result.accuracy >= 90 ? 'Почти без ошибок.' : 'Ошибки разобраны — они вернутся в практике.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
            <Tile icon={Zap} label="Опыт" value={`+${result.xp}`} testid="result-xp" />
            <Tile icon={Target} label="Точность" value={`${Math.round(result.accuracy)}%`} testid="result-acc" />
            <Tile icon={Timer} label="Время" value={mmss(result.ms)} testid="result-time" />
          </div>
          {replay && <div style={{ fontSize: 12.5, color: COLOR.faint, marginBottom: 12 }}>Урок уже был пройден: за повтор — немного опыта, главное — закрепление.</div>}
          <button type="button" className="ems-btn primary ln-cta" onClick={onClose}>Дальше</button>
          {lesson && (
            <button type="button" className="ems-btn ghost" style={{ marginTop: 10, padding: 10, width: '100%' }} data-testid="result-theory"
              onClick={() => { onClose(); onOpenTheory({ kind: 'chapter', id: lesson.unit, anchor: lesson.section }); }}>
              <BookOpenText size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Подробнее в теории
            </button>
          )}
        </div></div>
      )}
    </div>
  );
}
const phrase = (list, seed) => list[Math.abs([...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % list.length];
function Tile({ icon: Icon, label, value, testid }) {
  return (
    <div className="ems-panel" style={{ padding: '10px 6px', borderRadius: 12 }} data-testid={testid}>
      <div style={{ fontSize: 11.5, color: COLOR.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon size={12} />{label}</div>
      <div className="ems-mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ------------------------------ ПУТЬ ------------------------------ */
const ZIG = [0, 56, 84, 56, 0, -56, -84, -56];
function TopStats({ learn }) {
  const st = streak(learn); const g = goalToday(learn);
  const totalXp = Object.values(learn.xp).reduce((a, b) => a + b, 0);
  return (
    <div className="ln-top" data-testid="path-stats">
      <span className="ln-stat" title="Серия дней" data-testid="streak" style={{ color: st.days ? '#E8914A' : COLOR.faint }}><Flame size={18} />{st.days}</span>
      <span className="ln-stat" title="Опыт" style={{ color: COLOR.gold }}><Zap size={18} />{totalXp}</span>
      <span className="ln-stat" title="Цель дня" data-testid="goal" style={{ color: g.done >= g.goal ? COLOR.teal : COLOR.muted }}>
        <Target size={18} />{Math.min(g.done, g.goal)}/{g.goal} {g.goal === 1 ? 'урок' : 'урока'}
      </span>
    </div>
  );
}
function PathView({ learn, onStart, onOpenTheory }) {
  const states = pathState(learn);
  const sleepy = missedYesterday(learn);
  const g = goalToday(learn);
  const hello = g.done >= g.goal ? 'joy' : sleepy ? 'sleep' : 'hello';
  const first = states.find((x) => x.current) || states[0];
  const soon = UNITS.map((u, k) => ({ u, no: k + 1 })).filter(({ u }) => !states.some((x) => x.unit.id === u.id));
  const [soonOpen, setSoonOpen] = useState(false);
  return (
    <div className="ln-wrap" data-testid="path">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mascot mood={hello} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ems-serif" style={{ fontSize: 20, fontWeight: 700 }}>Путь</div>
          <div style={{ fontSize: 13, color: COLOR.muted }}>
            {g.done >= g.goal ? 'Цель дня выполнена — можно и дальше.' : sleepy ? 'Инфля заскучала. Один урок — и снова в пути.' : first && first.current ? `Дальше: «${first.current.title}»` : 'Уроки по 3–5 минут.'}
          </div>
        </div>
      </div>
      <TopStats learn={learn} />
      {UNITS.map((u, k) => ({ u, no: k + 1, st: states.find((x) => x.unit.id === u.id) })).filter((x) => x.st).map(({ u, no: unitNo, st }) => {
        const sections = CHAPTER_SECTIONS[u.id] || [];
        const problemsAt = (sections.find((x) => x.title === 'Задачи') || {}).id;
        return (
          <div key={u.id} data-testid="path-unit" data-unit={u.id}>
            <div className="ln-unit" style={{ borderColor: st.complete ? COLOR.gold : COLOR.border }}>
              <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: COLOR.goldSoft }}>Юнит {unitNo}{st.complete ? ' · пройден' : ''}</div>
              <div className="ems-serif" style={{ fontSize: 19, fontWeight: 700, margin: '2px 0 8px' }}>{u.title}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!st.complete && <button type="button" className="ems-btn" style={{ padding: '6px 10px', fontSize: 12.5 }} data-testid="unit-check" onClick={() => onStart({ mode: 'check', unitId: u.id })}>
                  <Sparkles size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Проверка юнита — перескочить</button>}
                {st.complete && <button type="button" className="ems-btn primary" style={{ padding: '6px 10px', fontSize: 12.5 }} data-testid="unit-legend" onClick={() => onStart({ mode: 'legend', unitId: u.id })}>
                  <Crown size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Уровень легенды</button>}
                {st.complete && problemsAt && <button type="button" className="ems-btn ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => onOpenTheory({ kind: 'chapter', id: u.id, anchor: problemsAt })}>Задачи глубже</button>}
                <button type="button" className="ems-btn ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => onOpenTheory({ kind: 'chapter', id: u.id })}>
                  <BookOpenText size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Теория</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '10px 0 20px' }}>
              {st.lessons.map((l, i) => {
                const isCur = st.current && st.current.id === l.id;
                const bg = l.done ? COLOR.gold : l.open ? COLOR.teal : COLOR.hairline;
                return (
                  <div key={l.id} style={{ transform: `translateX(${ZIG[i % ZIG.length]}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <button type="button" className={`ln-node ${isCur ? 'current' : ''}`} style={{ background: bg, color: l.open ? '#10131a' : COLOR.faint }}
                      disabled={!l.open} data-testid="path-lesson" data-lesson={l.id} data-state={l.done ? 'done' : l.open ? 'open' : 'locked'}
                      aria-label={`Урок ${l.no}: ${l.title}${l.done ? ', пройден' : l.open ? '' : ', закрыт'}`}
                      onClick={() => { Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id }); }}>
                      {l.done ? <Check size={30} strokeWidth={3} /> : l.open ? <span className="ems-serif" style={{ fontSize: 24, fontWeight: 700 }}>{l.no}</span> : <Lock size={24} />}
                    </button>
                    {/* название — тоже кнопка урока: в кружок на телефоне попадают не всегда */}
                    <button type="button" className="ln-node-title" disabled={!l.open} tabIndex={-1} aria-hidden="true" data-testid="path-lesson-title" data-lesson={l.id}
                      style={{ color: l.open ? COLOR.text : COLOR.faint }} onClick={() => { Audio.play('click'); onStart({ mode: 'lesson', lessonId: l.id }); }}>{l.title}</button>
                    {isCur && <span style={{ fontSize: 11.5, color: COLOR.gold, fontWeight: 700 }}>{l.done ? 'повторить' : 'начать'}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {soon.length > 0 && (
        <div className="ln-soon" style={{ display: 'block', padding: 0 }} data-testid="path-soon">
          <button type="button" className="ln-soon-head" aria-expanded={soonOpen} onClick={() => { Audio.play('tab'); setSoonOpen((v) => !v); }}>
            <Lock size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Дальше на Пути: {soon.length} {soon.length % 10 === 1 && soon.length % 100 !== 11 ? 'юнит готовится' : 'юнитов готовятся'}
              <span style={{ display: 'block', fontSize: 12, color: COLOR.faint }}>учебник по готовым главам уже в «Теории»</span></span>
            <ChevronRight size={16} style={{ transform: soonOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {soonOpen && (
            <div style={{ padding: '0 12px 8px' }} data-testid="path-soon-list">
              {soon.map(({ u, no }) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${COLOR.hairline}` }} data-unit={u.id}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>Юнит {no} · {u.title}</span>
                  {u.ready && <button type="button" className="ems-btn ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => onOpenTheory({ kind: 'chapter', id: u.id })}>Теория</button>}
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
function PracticeView({ learn, onStart, onOpenTheory }) {
  const n = learn.mistakes.length;
  // раздел учебника на сегодня и повторение — тот же расчёт минут, что и в самом учебнике
  const [today] = useState(() => todayCard());
  const card = (title, text, action, icon, testid, disabled = false) => (
    <button type="button" className="ln-unit" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', font: 'inherit', color: COLOR.text, opacity: disabled ? 0.6 : 1 }}
      onClick={disabled ? undefined : action} data-testid={testid} disabled={disabled}>
      {React.createElement(icon, { size: 22, color: COLOR.gold })}
      <span style={{ flex: 1 }}><span className="ems-serif" style={{ fontSize: 17, fontWeight: 700, display: 'block' }}>{title}</span><span style={{ fontSize: 13, color: COLOR.muted }}>{text}</span></span>
      {!disabled && <ChevronRight size={18} color={COLOR.muted} />}
    </button>
  );
  return (
    <div className="ln-wrap" data-testid="practice">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Mascot mood={n ? 'think' : 'joy'} size={52} />
        <div><div className="ems-serif" style={{ fontSize: 20, fontWeight: 700 }}>Практика</div><div style={{ fontSize: 13, color: COLOR.muted }}>Ошибки уроков возвращаются сюда, пока не решите их верно.</div></div>
      </div>
      {card('Повторить ошибки', n ? `${n} ${n === 1 ? 'упражнение' : n < 5 ? 'упражнения' : 'упражнений'} из прошлых уроков` : 'Ошибок нет — всё решено верно', () => onStart({ mode: 'practice' }), RotateCcw, 'practice-mistakes', !n)}
      {card('На сегодня', today.section ? `«${today.section.title}» · ≈${today.section.minutes} мин · на повторение: ${today.due}` : `Все разделы готовых глав пройдены · на повторение: ${today.due}`,
        () => onOpenTheory({ kind: 'today' }), BookOpenText, 'practice-today')}
      {card('Задачи вперемешку', 'Из начатых глав, без подсказки, какая нужна модель', () => onOpenTheory({ kind: 'mixed' }), Target, 'practice-mixed')}
      {card('Итоговая проверка: Микро', 'Шестнадцать задач с новыми числами при каждой попытке', () => onOpenTheory({ kind: 'exam', id: 'micro' }), Trophy, 'practice-exam')}
    </div>
  );
}

/* ------------------------------ ПРОФИЛЬ ------------------------------ */
function ProfileView({ learn, update, onOpenTheory }) {
  const st = streak(learn); const stats = learnStats(learn);
  const bw = bestWeek(learn);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const row = (label, value, testid) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '4px 0' }} data-testid={testid}><span style={{ color: COLOR.muted }}>{label}</span><b>{value}</b></div>
  );
  return (
    <div className="ln-wrap" data-testid="learn-profile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Mascot mood={st.days >= 3 ? 'joy' : 'hello'} size={52} />
        <div><div className="ems-serif" style={{ fontSize: 20, fontWeight: 700 }}>Профиль</div><div style={{ fontSize: 13, color: COLOR.muted }}>Личные рекорды — без лиг и соревнований.</div></div>
      </div>
      <div className="ln-unit">
        <div className="ems-serif" style={{ fontSize: 16, marginBottom: 6, color: COLOR.goldSoft }}>Рекорды</div>
        {row('Серия сейчас', `${st.days} дн.${st.freezesUsed.length ? ` · заморожено дней: ${st.freezesUsed.length}` : ''}`, 'prof-streak')}
        {row('Самая длинная серия', `${longestStreak(learn)} дн.`)}
        {row('Лучшая неделя', bw.xp ? `${bw.xp} XP` : '—')}
        {row('Всего опыта', `${stats.totalXp} XP`)}
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 4 }}>Один пропущенный день в неделю серию не обнуляет.</div>
      </div>
      <div className="ln-unit">
        <div className="ems-serif" style={{ fontSize: 16, marginBottom: 6, color: COLOR.goldSoft }}>Цель дня</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Уроков в день">
          {GOALS.map((g) => <button key={g} type="button" className="ln-chip" aria-pressed={learn.goal === g} onClick={() => update((s) => setGoal(s, g))}>{g} {g === 1 ? 'урок' : g < 5 ? 'урока' : 'уроков'}</button>)}
        </div>
      </div>
      <div className="ln-unit" data-testid="prof-stats">
        <div className="ems-serif" style={{ fontSize: 16, marginBottom: 6, color: COLOR.goldSoft }}>Как идёт учёба</div>
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 4 }}>Дней занятий по неделям (эта — справа)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60, marginBottom: 10 }} data-testid="prof-weeks">
          {[...stats.weeks].reverse().map((w) => (
            <div key={w.week} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: Math.max(3, (w.days / 7) * 44), background: w.days ? COLOR.teal : COLOR.hairline, borderRadius: 4 }} />
              <div style={{ fontSize: 11, color: COLOR.muted }}>{w.days}/7</div>
            </div>
          ))}
        </div>
        {row('Уроков доведено до конца', stats.completion == null ? '—' : pct(stats.completion), 'prof-completion')}
        {stats.types.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: '3px 12px', fontSize: 13 }} data-testid="prof-types">
              <span style={{ color: COLOR.faint }}>тип</span><span style={{ color: COLOR.faint }}>точность</span><span style={{ color: COLOR.faint }}>время</span>
              {stats.types.map((t) => (
                <React.Fragment key={t.kind}><span>{KIND_LABEL[t.kind] || t.kind}</span><span className="ems-mono">{pct(t.accuracy)}</span><span className="ems-mono">{Math.round(t.avgSec)} с</span></React.Fragment>
              ))}
            </div>
          </div>
        )}
        {stats.quitKinds.length > 0 && (
          <div style={{ fontSize: 13, marginTop: 8, color: COLOR.muted }} data-testid="prof-quits">
            Уроки чаще всего прерывали на упражнении «{KIND_LABEL[stats.quitKinds[0][0]] || stats.quitKinds[0][0]}»{stats.quitPos[0] ? `, обычно на ${stats.quitPos[0].index + 1}-м` : ''}.
          </div>
        )}
      </div>
      <button type="button" className="ems-btn" style={{ width: '100%', padding: 12 }} onClick={() => onOpenTheory({ kind: 'stats' })}>Прогресс в учебнике и журнал занятий</button>
    </div>
  );
}

/* ------------------------------ ВКЛАДКИ ------------------------------ */
export function LearnTab({ tab, onOpenTheory }) {
  const [learn, update] = useLearn();
  const [run, setRun] = useState(null);
  return (
    <div className="ln-root">
      <style>{TEXTBOOK_CSS + CSS}</style>
      {/* пока идёт урок, экран под ним недоступен ни с клавиатуры, ни для чтения с экрана */}
      <div inert={!!run}>
        {tab === 'path' && <PathView learn={learn} onStart={setRun} onOpenTheory={onOpenTheory} />}
        {tab === 'practice' && <PracticeView learn={learn} onStart={setRun} onOpenTheory={onOpenTheory} />}
        {tab === 'profile' && <ProfileView learn={learn} update={update} onOpenTheory={onOpenTheory} />}
      </div>
      {run && <Runner key={JSON.stringify(run)} run={run} learn={learn} update={update} onClose={() => setRun(null)} onOpenTheory={onOpenTheory} />}
    </div>
  );
}
export default LearnTab;
