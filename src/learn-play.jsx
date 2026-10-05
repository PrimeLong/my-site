/* ВЗАИМОДЕЙСТВИЯ УРОКОВ ЭТАПА 2: рынок на графике (сдвинуть кривую пальцем, двигать цену,
   пока не исчезнет дефицит, поставить точку равновесия), определение из плиток, мини-игра
   на минуту с живым графиком, таймер, карточки видов уроков
   (слово с оборотом, герой «Истории», «Слушай» с голосом браузера и подсветкой текста).
   Всё своё: SVG и Web Speech API, без библиотек и внешних запросов. При «уменьшить движение»
   карточки не летают, подсветка текста не бежит. */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Coffee, Croissant, Landmark, ScrollText, RotateCcw, Play, Timer, Delete, Trophy, GraduationCap, Radio, Feather,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { equilibrium, marketAxes, qd, qs, gameScore, comboOf } from './learn/course.js';
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
  /* «Слова» — колода: сверху карточка слова, под ней край ещё не открытых. Значение сначала
     закрыто: вспомнить — открыть — честно отметить «Знаю» или «Ещё раз». */
  .lp-deck { position: relative; margin: 6px 0 14px; padding-bottom: 14px; }
  .lp-deck-ghost { position: absolute; left: 12px; right: 12px; height: 40px; bottom: 6px; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card2); }
  .lp-deck-ghost.g2 { left: 24px; right: 24px; bottom: 0; opacity: .7; }
  .lp-word { position: relative; z-index: 1; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); box-shadow: 0 3px 10px var(--ds-shade);
    padding: 18px 18px 20px; min-height: 250px; display: flex; flex-direction: column; touch-action: pan-y; user-select: none;
    transition: transform .26s ease-in, opacity .26s ease-in; border-top: 5px solid var(--u); }
  .lp-word.in { animation: lp-word-in .3s ease-out both; }
  @keyframes lp-word-in { from { transform: translateY(14px) scale(.97); opacity: 0 } to { transform: none; opacity: 1 } }
  .lp-word.out-r { transform: translateX(115%) rotate(9deg); opacity: 0; }
  .lp-word.out-l { transform: translateX(-115%) rotate(-9deg); opacity: 0; }
  .lp-word-top { display: flex; align-items: center; gap: 8px; font: 700 12px var(--ds-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ds-ink3); }
  .lp-word-term { font: 700 30px/1.15 var(--ds-serif); color: var(--u-ink); margin: 18px 0 6px; text-align: center; }
  .lp-word-rule { width: 56px; height: 2px; background: var(--u); opacity: .5; margin: 0 auto 16px; border-radius: 1px; }
  .lp-word-def { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 18.5px; line-height: 1.45; }
  .lp-word-def.open { animation: lp-def .35s ease-out both; }
  @keyframes lp-def { from { opacity: 0; transform: translateY(6px); filter: blur(3px) } to { opacity: 1; transform: none; filter: none } }
  .lp-word-hide { width: 100%; border: 1.5px dashed var(--ds-rule2); border-radius: 6px; padding: 18px 12px; color: var(--ds-ink3); font-size: 15px; background: none; cursor: pointer; font-family: inherit; }
  .lp-word-hint .fine { display: none; }
  @media (hover: hover) and (pointer: fine) { .lp-word-hint .fine { display: inline; } .lp-word-hint .touch { display: none; } .lp-word { cursor: grab; } }
  .lp-word-dots { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .lp-word-dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--ds-rule); }
  .lp-word-dots i.know { background: var(--u); }
  .lp-word-dots i.again { background: none; box-shadow: inset 0 0 0 2px var(--ds-gold); }
  .lp-word-dots i.cur { box-shadow: 0 0 0 2px var(--ds-paper), 0 0 0 3.5px var(--u); }
  .lp-calc { max-width: 320px; margin: 0 auto; }
  .lp-calc-screen { border: 1px solid var(--ds-rule2); border-radius: 3px; background: var(--ds-card2); padding: 6px 10px; margin-bottom: 8px; text-align: right; }
  .lp-op { color: var(--u-ink); font-weight: 700; }
  .lp-game-rules { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-size: 13.5px; margin-top: 4px; }
  .lp-game-rules span { display: inline-flex; align-items: center; gap: 4px; }
  /* «Как играть» перед стартом: три шага и пробный заголовок без таймера */
  .lp-howto { border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); padding: 12px 14px; margin: 10px 0; }
  .lp-howto ol { margin: 6px 0 0; padding-left: 20px; font-size: 14.5px; line-height: 1.45; }
  .lp-howto li { margin: 3px 0; }
  .lp-trial { border: 1.5px dashed var(--ds-rule2); border-radius: 6px; padding: 10px 12px; margin: 10px 0; }
  .lp-trial-card { font: 700 17px/1.35 var(--ds-serif); text-align: center; margin: 6px 0 10px; }
  .lp-game-hud { display: flex; align-items: center; gap: 8px; margin: -4px 0 2px; }
  .lp-game-score { font-size: 26px; font-weight: 700; color: var(--u-ink); min-width: 48px; }
  .lp-combo { font: 700 14px var(--ds-mono); color: #fff; background: var(--u); border-radius: 999px; padding: 2px 9px; animation: lp-combo .35s ease-out; }
  @keyframes lp-combo { 0% { transform: scale(.4); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
  .lp-game-stage { position: relative; }
  .lp-game .lp-chart { margin: 0 auto 2px; max-width: 340px; }
  .lp-effect { position: absolute; top: 6px; right: 8px; font: 700 13px var(--ds-sans); background: var(--ds-card); border: 1.5px solid var(--u); color: var(--u-ink); border-radius: 3px; padding: 3px 8px;
    animation: lp-effect 1.6s ease-out forwards; pointer-events: none; }
  @keyframes lp-effect { 0% { opacity: 0; transform: translateY(6px); } 12% { opacity: 1; transform: none; } 75% { opacity: 1; } 100% { opacity: 0; } }
  .lp-game-card { min-height: 104px; margin: 8px 0 10px; font-size: 19px; }
  .lp-game-final { flex-direction: column; gap: 2px; min-height: 0; margin-top: 8px; }
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
const effectLabel = (chart, eff) => (chart === 'budget' ? BUDGET_LABEL[eff] : chart === 'elastic' ? ELASTIC_LABEL[eff] : EFFECT_LABEL[eff]);
const BUDGET0 = { I: 100, px: 1.25, py: 1.25 };
const MARKET_STEP = 16;
// состояние графика после карточки: сдвиги понемногу забываются, чтобы график не уезжал за край
function applyEffect(chart, st, eff) {
  // эластичность: крутая или пологая кривая спроса через одну точку
  if (chart === 'elastic') return { e: eff === 'in' ? 0.4 : eff === 'el' ? 2.5 : st.e };
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
const startState = (chart) => (chart === 'market' ? { D: 0, S: 0 } : chart === 'budget' ? { ...BUDGET0 } : chart === 'elastic' ? { e: 1 } : { rx: 100, ry: 100, t: 0.5 });
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
  const p1 = 22; const q1 = Math.max(0, qAt(p1));
  const r0 = 20 * 60; const r1 = p1 * q1;
  const up = r1 >= r0;
  return (
    <svg className="lp-chart lp-game-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Спрос ${st.e < 1 ? 'неэластичный' : 'эластичный'}: выручка после подорожания ${Math.round(r1)} против ${r0}`}
      data-testid="game-chart" data-chart="elastic" data-state={JSON.stringify({ e: Math.round(st.e * 100) / 100, up })}>
      <rect x={sx(0)} y={sy(20)} width={sx(60) - sx(0)} height={sy(0) - sy(20)} fill="var(--ds-ink3)" opacity=".12" />
      <rect x={sx(0)} y={sy(p1)} width={sx(q1) - sx(0)} height={sy(0) - sy(p1)} fill="none" stroke={up ? 'var(--ds-ok)' : 'var(--ds-bad)'} strokeWidth="2" strokeDasharray="5 4" />
      <line x1={sx(qAt(PM))} y1={sy(PM)} x2={sx(qAt(0))} y2={sy(0)} stroke="var(--u)" strokeWidth="4" strokeLinecap="round" />
      <circle cx={sx(60)} cy={sy(20)} r="4.5" fill="var(--u)" />
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--ds-ink2)" strokeWidth="1.5" />
      <text x={W - R} y={H - 8} textAnchor="end" className="lp-ax">Q</text>
      <text x={L - 6} y={T + 8} textAnchor="end" className="lp-ax">P</text>
      <text x={W - R - 4} y={T + 14} textAnchor="end" className="lp-ax" style={{ fill: up ? 'var(--ds-ok)' : 'var(--ds-bad)', fontWeight: 700 }}>
        выручка при +10% цены: {up ? '↑' : '↓'} {Math.round(r1)}
      </text>
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
  // колода по кругу: кончилась — перемешиваем заново, первой не идёт только что показанная
  const deck = useRef(inst.items.slice());
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
  const finish = () => {
    if (done.current) return; done.current = true;
    const a = ans.current; const sc = gameScore(a);
    setPhase('over');
    onDone({ right: a.filter(Boolean).length, answered: a.length, score: sc.score, bestRun: sc.bestRun, record: sc.score > best && sc.score > 0, timeout: true, done: true });
  };
  const decide = (side) => {
    if (phase !== 'play' || locked || done.current || !item) return;
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
    if ((idx + 1) % deck.current.length === 0) {
      const last = item; let d = shuffleList(inst.items);
      for (let t = 0; t < 5 && d[0] === last; t += 1) d = shuffleList(inst.items);
      deck.current = d; setIdx(0);
    } else setIdx(idx + 1);
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
  const sample = inst.items.find((x) => x.effect) || inst.items[0];
  const [trial, setTrial] = useState(null);
  const tryIt = (side) => {
    if (trial) return;
    const ok = side === sample.side;
    Audio.play(ok ? 'coin' : 'down');
    setTrial({ ok });
    if (sample.effect) setSt(applyEffect(inst.chart, startState(inst.chart), sample.effect));
  };
  const begin = () => { Audio.play('click'); setSt(startState(inst.chart)); setPhase('play'); };
  const sideHint = inst.kind === 'swipe' ? `кнопки внизу, стрелки ← → или смахните карточку` : 'кнопки внизу или стрелки ↑ ↓ на клавиатуре';
  const r = result || (phase === 'over' ? { right: answers.filter(Boolean).length, answered: answers.length, score, bestRun, record: false } : null);
  const chart = inst.chart === 'market'
    ? <><MarketChart m={inst.market} shift={{ D: shown.D || 0, S: shown.S || 0 }} ghost eq label="Рынок в игре: спрос и предложение" /><PriceTicker prices={prices} /></>
    : inst.chart === 'ppf' ? <PpfGameChart st={shown} /> : inst.chart === 'budget' ? <BudgetGameChart st={shown} /> : inst.chart === 'elastic' ? <ElasticGameChart st={shown} /> : null;
  return (
    <div data-testid="game" data-phase={phase} className="lp-game">
      {phase === 'ready' && (
        <>
          {intro}
          <div className="lp-howto" data-testid="game-howto">
            <div className="ds-eyebrow">Как играть</div>
            <ol>
              <li>Появляется заголовок новости.</li>
              <li>Решите: {inst.labels[sides[0]].toLowerCase()} или {inst.labels[sides[1]].toLowerCase()}? Отвечайте — {sideHint}.</li>
              <li>График покажет, что сдвинулось. Три верных подряд — очки ×2, дальше ещё больше; ошибка обнуляет серию.</li>
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
            <span>засчитывается от 8 верных при точности от 70%</span>
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
            <span className="ds-sub" style={{ fontSize: 13 }}>верно {answers.filter(Boolean).length} из {answers.length}</span>
          </div>
          <div className="lp-game-stage">
            {chart}
            {tag && <span className="lp-effect" key={`t${tag.k}`} data-testid="game-effect">{tag.text}</span>}
          </div>
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
            <div className="ds-eyebrow">Время!</div>
            <div className="ds-num" style={{ fontSize: 34, fontWeight: 700, color: 'var(--u-ink)' }}>{r.score}</div>
            <div style={{ fontSize: 16 }}>очков · верно {r.right} из {r.answered} · лучшая серия {r.bestRun}</div>
            {r.record && <div className="ds-badge" style={{ marginTop: 6 }} data-testid="game-record">Новый рекорд!</div>}
          </div>
        </>
      )}
    </div>
  );
}
function shuffleList(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
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
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }} data-testid="portrait" data-who={who}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill={`color-mix(in srgb, ${c.color} 18%, white)`} stroke={c.color} strokeWidth="2" />
        <path d="M14 58c2-11 9-16 18-16s16 5 18 16" fill={c.color} />
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
export function WordDeck({ cards, onDone, body, foot }) {
  const [queue, setQueue] = useState(() => cards.map((_, i) => i));
  const [marks, setMarks] = useState({});
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(null);
  const [dx, setDx] = useState(0);
  const drag = useRef(null);
  const reduced = useReducedMotion();
  const idx = queue[0];
  const card = cards[idx];
  const repeat = marks[idx] === 'again';
  const reveal = () => { if (!open) { Audio.play('paper'); setOpen(true); } };
  const decide = (know) => {
    if (!open || out) return;
    Audio.play(know ? 'tick' : 'paper');
    setOut(know ? 'r' : 'l');
    const finish = () => {
      const again = !know && marks[idx] !== 'again';
      const rest = queue.slice(1);
      const nextQ = again ? [...rest, idx] : rest;
      setMarks((m) => ({ ...m, [idx]: know ? (m[idx] === 'again' ? 'again-know' : 'know') : 'again' }));
      setOut(null); setDx(0); setOpen(false);
      if (!nextQ.length) onDone(); else setQueue(nextQ);
    };
    if (reduced) finish(); else setTimeout(finish, 260);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); reveal(); }
      else if (e.key === 'ArrowRight') decide(true);
      else if (e.key === 'ArrowLeft') decide(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!card) return null;
  const left = queue.length - 1;
  /* Смахивание и мышью: карточка захватывает указатель (рука может уйти за её край), порог —
     треть ширины пальцем и 50 px мышью; на ПК подсказка — стрелки ← →. */
  const onDown = (e) => {
    if (!open || out) return;
    drag.current = { x: e.clientX, mouse: e.pointerType === 'mouse' };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* старый браузер */ }
  };
  const onMove = (e) => { if (drag.current) setDx(e.clientX - drag.current.x); };
  const onUp = () => { if (!drag.current) return; const d = dx; const lim = drag.current.mouse ? 50 : 80; drag.current = null; if (Math.abs(d) > lim) decide(d > 0); else setDx(0); };
  const style = dx && !out ? { transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: 'none' } : undefined;
  return (
    <>
      {body(<>
      <div className="lp-deck">
        {left > 0 && <div className="lp-deck-ghost" aria-hidden="true" />}
        {left > 1 && <div className="lp-deck-ghost g2" aria-hidden="true" />}
        <div className={`lp-word ${out ? `out-${out}` : 'in'}`} key={`${idx}-${repeat}`} style={style} data-testid="flash-card" data-flipped={String(open)}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => { if (!open) reveal(); }}>
          <div className="lp-word-top">
            <span>Слово {idx + 1} из {cards.length}</span>
            {repeat && <span className="ds-badge" style={{ textTransform: 'none', letterSpacing: 0 }}>ещё раз</span>}
            <span style={{ flex: 1 }} />
            {open && <span className="lp-word-hint" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}><span className="touch">смахните →</span><span className="fine">← → на клавиатуре</span></span>}
          </div>
          <div className="lp-word-term">{card.title}</div>
          <div className="lp-word-rule" />
          {open
            ? <div className="lp-word-def open" data-testid="word-def"><span><Inline nodes={card.text} /></span></div>
            : <div className="lp-word-def"><button type="button" className="lp-word-hide" onClick={(e) => { e.stopPropagation(); reveal(); }}>Вспомните, что это значит, — и откройте</button></div>}
        </div>
      </div>
      <div className="lp-word-dots" data-testid="word-dots" role="img" aria-label={`Слов отмечено: ${Object.keys(marks).length} из ${cards.length}`}>
        {cards.map((_, i) => <i key={i} className={`${marks[i] === 'know' || marks[i] === 'again-know' ? 'know' : marks[i] === 'again' ? 'again' : ''} ${i === idx ? 'cur' : ''}`} />)}
      </div>
      </>)}
      {foot(open
        ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Button variant="secondary" onClick={() => decide(false)} data-testid="word-again">Ещё раз</Button>
          <Button onClick={() => decide(true)} data-testid="word-know">Знаю</Button>
        </div>
        : <Button variant="secondary" wide onClick={reveal} data-testid="word-show">Показать значение</Button>)}
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
  const KEYS = [['7', '8', '9', '÷'], ['4', '5', '6', '×'], ['1', '2', '3', '−'], ['0', ',', '^', '+'], ['(', ')', '√', '=']];
  return (
    <div className="lp-calc" data-testid="calculator">
      <div className="lp-calc-screen" aria-live="polite">
        <div className="ds-num" data-testid="calc-expr" style={{ minHeight: 22, fontSize: 17, wordBreak: 'break-all' }}>{expr.replace(/-/g, '−') || ' '}</div>
        <div className="ds-num" data-testid="calc-value" style={{ fontSize: 24, fontWeight: 700 }}>{v != null ? `= ${fmtResult(v)}` : expr ? '…' : '0'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }} role="group" aria-label="Калькулятор">
        {KEYS.flat().map((k) => (
          <button key={k} type="button" className={`ds-key ${'÷×−+^√='.includes(k) ? 'lp-op' : ''}`} disabled={disabled} data-calc={k}
            aria-label={({ '÷': 'Разделить', '×': 'Умножить', '−': 'Вычесть', '+': 'Прибавить', '^': 'Степень', '√': 'Квадратный корень', '=': 'Равно' })[k] || k}
            onClick={() => press(k === '÷' ? '/' : k === '×' ? '*' : k === '−' ? '-' : k)}>{k}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" className="ds-key" style={{ flex: 1 }} aria-label="Стереть символ" disabled={disabled} onClick={() => press('del')}><Delete size={18} /></button>
        <button type="button" className="ds-key" style={{ flex: 1 }} aria-label="Очистить" data-calc="C" disabled={disabled} onClick={() => press('C')}>C</button>
        {onUse && <button type="button" className="ds-btn" style={{ flex: 2.6 }} disabled={disabled || v == null} data-testid="calc-use" onClick={() => { Audio.play('click'); onUse(fmtResult(v).replace('−', '-')); }}>{useLabel}</button>}
      </div>
    </div>
  );
}
