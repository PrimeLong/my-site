/* ВЗАИМОДЕЙСТВИЯ УРОКОВ ЭТАПА 2: рынок на графике (сдвинуть кривую пальцем, двигать цену,
   пока не исчезнет дефицит, поставить точку равновесия), определение из плиток, раунды
   мини-игр (смахнуть карточку, 60 секунд, цепочка на время), таймер, карточки видов уроков
   (слово с оборотом, герой «Истории», «Слушай» с голосом браузера и подсветкой текста).
   Всё своё: SVG и Web Speech API, без библиотек и внешних запросов. При «уменьшить движение»
   карточки не летают, подсветка текста не бежит. */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Coffee, Croissant, Landmark, ScrollText, RotateCcw, Play, Timer,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { equilibrium, marketAxes, qd, qs } from './learn/course.js';
import { CAST } from './learn/cast.js';
import { useReducedMotion } from './ds-art.jsx';

export const PLAY_CSS = `
  .lp-chart { width: 100%; max-width: 380px; display: block; margin: 6px auto 10px; touch-action: none; user-select: none; -webkit-user-select: none; }
  .lp-chart text { font: 700 11px var(--ds-mono); fill: var(--ds-ink2); }
  .lp-hit { cursor: grab; }
  .lp-hit:active { cursor: grabbing; }
  .lp-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
  .lp-readout { text-align: center; font-size: 15px; margin: 4px 0 10px; min-height: 22px; }
  .lp-readout b { font-family: var(--ds-mono); }
  .lp-range { width: 100%; accent-color: var(--u); height: 32px; }
  .lp-tiles { min-height: 64px; border: 1px dashed var(--ds-rule2); border-radius: 4px; padding: 8px; margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; background: var(--ds-card2); }
  .lp-tile { font: 15px/1.2 var(--ds-serif); padding: 9px 12px; border-radius: 2px; border: 1px solid var(--ds-rule2); border-bottom-width: 2px; background: var(--ds-card); color: var(--ds-ink); cursor: pointer; }
  .lp-tile:active:not(:disabled) { transform: translateY(1px); }
  .lp-timer { height: 8px; border-radius: 1px; background: var(--ds-card2); border: 1px solid var(--ds-rule2); overflow: hidden; margin: 4px 0 12px; }
  .lp-timer > span { display: block; height: 100%; background: var(--u); transition: width .1s linear; }
  .lp-timer.low > span { background: var(--ds-bad); }
  .lp-card { position: relative; min-height: 150px; border-radius: 6px; border: 1px solid var(--ds-rule2); background: var(--ds-card);
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule), 0 2px 4px var(--ds-shade);
    display: flex; align-items: center; justify-content: center; text-align: center; padding: 22px 18px; font: 700 20px/1.3 var(--ds-serif); margin: 10px 0 14px; touch-action: pan-y; user-select: none; }
  .lp-card.ok { border-color: var(--ds-ok); box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-ok); }
  .lp-card.bad { border-color: var(--ds-bad); box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-bad); }
  .lp-score { display: flex; justify-content: space-between; font: 700 13px var(--ds-mono); color: var(--ds-ink2); }
  .lp-flash { perspective: 900px; margin: 12px 0; }
  .lp-flash-in { position: relative; min-height: 200px; transition: transform .45s; transform-style: preserve-3d; }
  .lp-flash-in.flip { transform: rotateY(180deg); }
  /* слово — библиотечная каталожная карточка: красная линейка сверху, отверстие внизу */
  .lp-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 3px; border: 1px solid var(--ds-rule2); background: var(--ds-card);
    background-image: linear-gradient(transparent 38px, #C0392B 38px, #C0392B 39.5px, transparent 39.5px), repeating-linear-gradient(transparent 0 27px, var(--ds-rule) 27px 28px);
    background-position: 0 0, 0 40px; background-repeat: no-repeat, repeat; box-shadow: 0 2px 5px var(--ds-shade);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 18px 26px; text-align: center; }
  .lp-face::after { content: ''; position: absolute; bottom: 8px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: var(--ds-paper); box-shadow: inset 0 1px 2px var(--ds-shade); }
  .lp-face.back { transform: rotateY(180deg); }
  .lp-bubble { position: relative; background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 4px; padding: 14px 16px; font-size: 17.5px; line-height: 1.5; margin-top: 12px; }
  @media (prefers-reduced-motion: reduce) { .lp-flash-in, .lp-timer > span { transition: none !important; } }
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
        Цена <b>{p}</b>: хотят купить <b style={{ color: '#3E6FA8' }}>{Math.max(0, d)}</b>, продают <b style={{ color: '#C0602A' }}>{Math.max(0, s)}</b>
        {gap > 0 ? <> — <b style={{ color: 'var(--ds-bad)' }}>дефицит {gap}</b></> : gap < 0 ? <> — <b style={{ color: '#C0602A' }}>избыток {-gap}</b></> : <> — <b style={{ color: 'var(--ds-ok)' }}>ни дефицита, ни избытка</b></>}
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

/* Итог раунда на карточке — из результата, который раунд передал наверх (result), а не из
   своего состояния: так счёт верен, даже если раунд пересоздан после проверки. */
// «смахни»: карточка уходит влево или вправо; кнопки — то же без жеста
export function SwipeRound({ inst, onDone, locked, result = null }) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [right, setRight] = useState(0);
  const [dx, setDx] = useState(0);
  const [flash, setFlash] = useState(null);
  const start = useRef(null);
  const item = inst.items[idx];
  const decide = (side) => {
    if (locked || !item) return;
    const ok = side === item.side;
    Audio.play(ok ? 'coin' : 'down');
    const nr = right + (ok ? 1 : 0);
    setRight(nr); setFlash(ok ? 'ok' : 'bad'); setDx(0);
    setTimeout(() => setFlash(null), 250);
    if (idx + 1 >= inst.items.length) onDone({ right: nr, total: inst.items.length, done: true });
    else setIdx(idx + 1);
  };
  const down = (e) => { if (locked) return; start.current = e.clientX; if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (start.current != null) setDx(e.clientX - start.current); };
  const up = () => { if (start.current == null) return; const d = dx; start.current = null; if (Math.abs(d) > 90) decide(d > 0 ? 'right' : 'left'); else setDx(0); };
  return (
    <div data-testid="swipe-round">
      <div className="lp-score"><span>Карточка {result ? inst.items.length : Math.min(idx + 1, inst.items.length)} из {inst.items.length}</span><span data-testid="game-score">верно: {result ? result.right : right}</span></div>
      {item && !locked ? (
        <div className={`lp-card ${flash || ''}`} data-testid="game-card" data-answer={testing() ? item.side : undefined}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ transform: reduced ? undefined : `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: start.current != null || reduced ? 'none' : 'transform .2s' }}>
          <Inline nodes={item.text} />
        </div>
      ) : <div className="lp-card" style={{ fontSize: 17 }} data-testid="game-final">Раунд окончен: верно {result ? result.right : right} из {inst.items.length}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="ds-opt" style={{ margin: 0, textAlign: 'center', fontWeight: 700 }} data-side="left" disabled={locked || !item} onClick={() => decide('left')}><ArrowLeft size={16} style={{ verticalAlign: -3 }} /> {inst.labels.left}</button>
        <button type="button" className="ds-opt" style={{ margin: 0, textAlign: 'center', fontWeight: 700 }} data-side="right" disabled={locked || !item} onClick={() => decide('right')}>{inst.labels.right} <ArrowRight size={16} style={{ verticalAlign: -3 }} /></button>
      </div>
    </div>
  );
}

// «60 секунд»: заголовок за заголовком, пока не кончится время или заголовки
export function RushRound({ inst, onDone, locked, result = null }) {
  const [on, setOn] = useState(false);
  const [idx, setIdx] = useState(0);
  const [right, setRight] = useState(0);
  const [flash, setFlash] = useState(null);
  const done = useRef(false);
  const score = useRef({ right: 0, answered: 0 });
  // timeout — время действительно вышло; иначе заголовки кончились раньше
  const finish = (timeout = false) => { if (done.current) return; done.current = true; onDone({ right: score.current.right, answered: score.current.answered, total: inst.items.length, timeout, done: true }); };
  const item = inst.items[idx];
  const decide = (side) => {
    if (!on || locked || !item || done.current) return;
    const ok = side === item.side;
    Audio.play(ok ? 'coin' : 'down');
    score.current = { right: score.current.right + (ok ? 1 : 0), answered: score.current.answered + 1 };
    setRight(score.current.right); setFlash(ok ? 'ok' : 'bad'); setTimeout(() => setFlash(null), 200);
    if (idx + 1 >= inst.items.length) finish(); else setIdx(idx + 1);
  };
  if (!on && !locked) {
    return (
      <div data-testid="rush-round" style={{ textAlign: 'center' }}>
        <div className="ds-sub" style={{ margin: '8px 0 14px' }}>{inst.items.length} заголовков, {inst.seconds} секунд. Засчитывается от шести верных.</div>
        <button type="button" className="ds-btn" data-testid="game-start" onClick={() => { Audio.play('click'); setOn(true); }}><Play size={16} style={{ verticalAlign: -3 }} /> Старт</button>
      </div>
    );
  }
  return (
    <div data-testid="rush-round">
      {!locked && <TimerBar seconds={inst.seconds} running={on && !locked} onEnd={() => finish(true)} />}
      <div className="lp-score"><span>{result ? result.answered : Math.min(idx + 1, inst.items.length)} / {inst.items.length}</span><span data-testid="game-score">верно: {result ? result.right : right}</span></div>
      {item && !locked ? <div className={`lp-card ${flash || ''}`} data-testid="game-card" data-answer={testing() ? item.side : undefined}><Inline nodes={item.text} /></div>
        : <div className="lp-card" style={{ fontSize: 17 }} data-testid="game-final">
          {result && result.timeout ? 'Время!' : 'Готово!'} Верно {result ? result.right : right} из {result ? result.answered : score.current.answered}
        </div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="ds-opt" style={{ margin: 0, textAlign: 'center', fontWeight: 700 }} data-side="up" disabled={locked || !item} onClick={() => decide('up')}><ArrowUp size={16} style={{ verticalAlign: -3 }} /> {inst.labels.up}</button>
        <button type="button" className="ds-opt" style={{ margin: 0, textAlign: 'center', fontWeight: 700 }} data-side="down" disabled={locked || !item} onClick={() => decide('down')}><ArrowDown size={16} style={{ verticalAlign: -3 }} /> {inst.labels.down}</button>
      </div>
    </div>
  );
}

// цепочка на время: звенья по порядку; собрана — проверяется сразу
export function ChainRound({ inst, onDone, locked, result = null }) {
  const [on, setOn] = useState(false);
  const [own, setSeq] = useState([]);
  // после проверки — собранное из результата раунда
  const seq = locked && result && result.seq ? result.seq : own;
  const done = useRef(false);
  const finish = (s, timeout = false) => { if (done.current) return; done.current = true; onDone({ seq: s, timeout, done: true }); };
  const add = (k) => { if (locked || done.current) return; Audio.play('tick'); const s = [...seq, k]; setSeq(s); if (s.length === inst.items.length) finish(s); };
  if (!on && !locked) {
    return (
      <div data-testid="chain-round" style={{ textAlign: 'center' }}>
        <div className="ds-sub" style={{ margin: '8px 0 14px' }}>{inst.items.length} звеньев, {inst.seconds} секунд.</div>
        <button type="button" className="ds-btn" data-testid="game-start" onClick={() => { Audio.play('click'); setOn(true); }}><Play size={16} style={{ verticalAlign: -3 }} /> Старт</button>
      </div>
    );
  }
  return (
    <div data-testid="chain-round">
      {locked && result ? <div className="lp-score" data-testid="game-final"><span>{result.timeout ? 'Время!' : 'Готово!'} Собрано {result.seq.length} из {inst.items.length}</span></div>
        : <TimerBar seconds={inst.seconds} running={on && !locked} onEnd={() => finish(seq, true)} />}
      <div style={{ minHeight: 56, border: '2px dashed var(--ds-rule2)', borderRadius: 12, padding: 6, marginBottom: 10 }}>
        {seq.map((k, i) => (
          <button key={k} type="button" className="ds-opt" style={{ margin: '4px 0' }} disabled={locked} onClick={() => setSeq(seq.filter((x) => x !== k))}>
            <b style={{ color: 'var(--u)' }}>{i + 1}.</b> <Inline nodes={inst.items.find((x) => x.key === k).text} />
          </button>
        ))}
      </div>
      {inst.items.filter((it) => !seq.includes(it.key)).map((it) => (
        <button key={it.key} type="button" className="ds-opt" data-key={it.key} disabled={locked} onClick={() => add(it.key)}><Inline nodes={it.text} /></button>
      ))}
    </div>
  );
}

/* ------------------------------ КАРТОЧКИ ВИДОВ УРОКОВ ------------------------------ */
const CAST_ICON = { coffee: Coffee, croissant: Croissant, landmark: Landmark, 'scroll-text': ScrollText };
// портрет героя: лицо, причёска его цвета и значок его дела
export function Portrait({ who, size = 64 }) {
  const c = CAST[who];
  if (!c) return null;
  const Icon = CAST_ICON[c.icon] || Coffee;
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }} data-testid="portrait" data-who={who}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill={`color-mix(in srgb, ${c.color} 18%, white)`} stroke={c.color} strokeWidth="2" />
        <path d="M14 58c2-11 9-16 18-16s16 5 18 16" fill={c.color} />
        <circle cx="32" cy="28" r="12.5" fill="#F6D2B8" />
        <path d={who === 'vera' ? 'M19 27c0-10 6-15 13-15s13 5 13 15c-3-5-8-7-13-7s-10 2-13 7z' : who === 'masha' ? 'M18 30c-1-12 6-18 14-18s15 6 14 18c-2-6-6-9-9-10-3 3-10 5-19 10z' : 'M20 24c1-7 6-10 12-10s11 3 12 10c-4-3-8-4-12-4s-8 1-12 4z'} fill={c.hair} />
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

// слово: лицевая сторона — термин, оборот — короткое определение
export function FlashCard({ card, flipped, onFlip }) {
  return (
    <div className="lp-flash" data-style="flash">
      <button type="button" className={`lp-flash-in ${flipped ? 'flip' : ''}`} onClick={onFlip} aria-label={flipped ? 'Карточка перевёрнута' : `Перевернуть карточку «${card.title}»`}
        style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'block' }} data-testid="flash-card" data-flipped={String(flipped)}>
        <span className="lp-face" aria-hidden={flipped}>
          <span className="ds-h3" style={{ fontSize: 28, color: 'var(--u)' }}>{card.title}</span>
          <span className="ds-sub" style={{ fontSize: 13.5, marginTop: 10 }}>нажмите, чтобы перевернуть</span>
        </span>
        <span className="lp-face back" aria-hidden={!flipped}>
          <span style={{ fontSize: 19, lineHeight: 1.45, fontWeight: 700 }}><Inline nodes={card.text} /></span>
        </span>
      </button>
    </div>
  );
}
