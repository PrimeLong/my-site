/* РАЗБОР ГРАФИКА (docs/mechanics.md, «Разбор графика»; шаги — src/learn/graphs.js): график юнита
   собирается на глазах. Новое на шаге прорисовывается (линии — чертятся, точки — выскакивают, площади —
   наливаются), то, о чём речь, — ярко, остальное приглушено; сдвиги — плавной перестройкой модели.
   Внизу — одна мысль простыми словами, «Назад» и «Дальше»; в конце — вопрос на понимание и «+10 опыта»
   (один раз). Открывается остановкой на дороге юнита и кнопкой «Разобрать график по шагам» на карточке
   урока с этим графиком — тогда без опыта (peek), поверх урока. При «уменьшить движение» — без анимаций. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Check, ChartSpline, RotateCcw } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, IconButton } from './ds.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { CHARTS } from './textbook/charts.js';
import { sceneInCrowns } from './learn/money.js';
import { GRAPH_BY_ID, GRAPH_XP, isGraphDone, stepView } from './learn/graphs.js';
import { finishLesson, markGraph } from './textbook/learn-state.js';

const CSS = `
  .gl { --g-blue: #2459A6; --g-rust: #B4441A; --g-teal: #0E7A72; --g-gold: #9A6A00; --g-grid: color-mix(in srgb, var(--ds-ink) 9%, transparent);
    position: fixed; inset: 0; z-index: 320; overflow-y: auto; overscroll-behavior: contain; color: var(--ds-ink);
    background: radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--g-blue) 12%, var(--ds-paper)), var(--ds-paper) 60%), var(--ds-paper); }
  .ds-dark .gl, .gl.dark { --g-blue: #8DB6F2; --g-rust: #F29A6E; --g-teal: #5ED3C4; --g-gold: #E9C25A; }
  .gl-top { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: color-mix(in srgb, var(--ds-paper) 86%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ds-rule2); }
  .gl-title { flex: 1; min-width: 0; font: 700 15px var(--ds-head); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gl-title small { display: block; font: 700 10.5px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ds-ink2); }
  .gl-bar { display: flex; gap: 4px; padding: 0 14px 10px; max-width: 720px; margin: 0 auto; }
  .gl-bar i { flex: 1; height: 5px; border-radius: 3px; background: var(--ds-rule2); overflow: hidden; position: relative; }
  .gl-bar i::after { content: ''; position: absolute; inset: 0; background: var(--g-blue); transform: scaleX(0); transform-origin: 0 50%; transition: transform .45s cubic-bezier(.3, .8, .4, 1); }
  .gl-bar i.on::after { transform: none; }
  .gl-page { max-width: 720px; margin: 0 auto; padding: 14px 16px 130px; }
  .gl-stage { position: relative; background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 22px; padding: 10px 6px 4px;
    box-shadow: 0 18px 40px -28px rgba(0,0,0,.45); }
  .gl-stage svg { display: block; width: 100%; height: auto; max-width: 560px; margin: 0 auto; overflow: visible; }
  .gl-replay { position: absolute; right: 10px; top: 10px; }
  .gl-text { margin-top: 14px; padding: 16px 18px; border-radius: 18px; background: color-mix(in srgb, var(--g-blue) 7%, var(--ds-card)); border: 1px solid color-mix(in srgb, var(--g-blue) 22%, var(--ds-rule));
    font: 400 17px/1.55 var(--ds-sans); animation: gl-rise .45s cubic-bezier(.2, .9, .3, 1) backwards; }
  .gl-text b { color: var(--ds-ink); background: linear-gradient(transparent 60%, color-mix(in srgb, var(--g-gold) 28%, transparent) 60%); }
  .gl-step { display: inline-block; margin-bottom: 6px; font: 700 12px var(--ds-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ds-ink2); }
  @keyframes gl-rise { from { opacity: 0; transform: translateY(10px) } }
  .gl-foot { position: fixed; left: 0; right: 0; bottom: 0; z-index: 3; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--ds-paper) 92%, transparent); border-top: 1px solid var(--ds-rule2); backdrop-filter: blur(8px); }
  .gl-foot > div { max-width: 720px; margin: 0 auto; display: flex; gap: 10px; }
  .gl-foot > div > :last-child { flex: 1; }

  /* сцена */
  .gl svg text { font-family: var(--ds-sans); }
  .g-el { transition: opacity .45s ease, stroke-width .3s ease, filter .3s ease; }
  .g-el.dim { opacity: .22; }
  .g-el.on path.c, .g-el.on line.c { stroke-width: 3.6; }
  .g-el.on { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--k, var(--g-blue)) 45%, transparent)); }
  .g-in .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: g-draw .95s cubic-bezier(.45, .05, .25, 1) forwards; }
  @keyframes g-draw { to { stroke-dashoffset: 0 } }
  .g-in .pop { transform-box: fill-box; transform-origin: center; animation: g-pop .5s cubic-bezier(.3, 1.6, .5, 1) .35s backwards; }
  @keyframes g-pop { from { transform: scale(0); opacity: 0 } }
  .g-in .fade { animation: g-fade .6s ease .5s backwards; }
  @keyframes g-fade { from { opacity: 0 } }
  .g-in .grow { transform-box: fill-box; transform-origin: 50% 100%; animation: g-grow .8s cubic-bezier(.3, .9, .3, 1) .2s backwards; }
  @keyframes g-grow { from { transform: scaleY(0); opacity: 0 } }
  .g-pulse { animation: g-pulse 1.8s ease-in-out infinite; }
  @keyframes g-pulse { 50% { fill-opacity: .42 } }
  .g-axes.on line { stroke: var(--g-blue); stroke-width: 2.6; }
  .g-axes.on text { fill: var(--g-blue); font-weight: 800; }
  .g-mark { animation: g-fade .5s ease .25s backwards; }

  /* вопрос и финал */
  .gl-quiz h2 { margin: 18px 0 12px; font: 700 21px/1.3 var(--ds-head); }
  .gl-opts { display: grid; gap: 10px; }
  .gl-opt { text-align: left; padding: 14px 16px; border-radius: 16px; border: 2px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink);
    font: 600 16px/1.35 var(--ds-sans); cursor: pointer; transition: transform .15s, border-color .2s; }
  .gl-opt:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--g-blue); }
  .gl-opt.ok { border-color: var(--ds-ok); background: color-mix(in srgb, var(--ds-ok) 10%, var(--ds-card)); }
  .gl-opt.bad { border-color: var(--ds-warn, #D9822B); background: color-mix(in srgb, var(--ds-warn, #D9822B) 10%, var(--ds-card)); }
  .gl-fb { margin-top: 12px; padding: 12px 14px; border-radius: 14px; font: 400 15px/1.5 var(--ds-sans); background: color-mix(in srgb, var(--ds-ok) 10%, var(--ds-card)); }
  .gl-fb.bad { background: color-mix(in srgb, var(--ds-warn, #D9822B) 12%, var(--ds-card)); }
  .gl-done { text-align: center; padding-top: 18px; }
  .gl-done h2 { margin: 6px 0; font: 700 24px/1.25 var(--ds-head); }
  .gl-medal { width: 120px; height: 120px; margin: 12px auto 8px; border-radius: 50%; display: grid; place-items: center; color: #fff;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--g-blue) 55%, #fff), var(--g-blue) 65%); box-shadow: 0 0 0 8px color-mix(in srgb, var(--g-blue) 18%, transparent);
    animation: g-pop .6s cubic-bezier(.3, 1.6, .5, 1) backwards; }
  @media (prefers-reduced-motion: reduce) { .gl *, .gl { animation: none !important; transition: none !important; } .g-in .draw { stroke-dashoffset: 0; } }
`;

// **жирное** в тексте шага
const rich = (t) => String(t).split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>));
const KCOLOR = { blue: 'var(--g-blue)', rust: 'var(--g-rust)', teal: 'var(--g-teal)', gold: 'var(--g-gold)' };
const W = 360; const H = 290; const M = { l: 42, r: 16, t: 14, b: 34 };
function ticks(lo, hi, n = 4) {
  const span = hi - lo; const raw = span / n; const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((x) => x >= raw) || 10 * pow;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* значения ползунков на шаге: по умолчанию модели, поверх — значения шага; переход — плавный */
function useTweenValues(target, reduced) {
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const key = JSON.stringify(target);
  useEffect(() => {
    if (reduced) { setCur(target); from.current = target; return undefined; }
    const a = { ...from.current }; const b = target; const t0 = performance.now(); let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 850); const e = ease(t);
      const v = Object.fromEntries(Object.keys(b).map((k) => [k, (a[k] ?? b[k]) + (b[k] - (a[k] ?? b[k])) * e]));
      from.current = v; setCur(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

export function GraphStage({ g, k }) {
  const reduced = useReducedMotion();
  const def = CHARTS[g.chart];
  const view = stepView(g, k);
  const defaults = useMemo(() => Object.fromEntries((def.controls ? def.controls(g.attrs) : []).map((c) => [c.id, c.def])), [def, g.attrs]);
  const vals = useTweenValues({ ...defaults, ...view.values }, reduced);
  const scene = sceneInCrowns(def.build(g.attrs, vals));
  const [x0, x1] = scene.xDomain; const [y0, y1] = scene.yDomain;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const anyFocus = view.focus.size > 0;
  // состояние элемента: не показан — нет; новый — анимация; в фокусе — ярко; остальное — приглушено
  const cls = (id) => `g-el${view.focus.has(id) ? ' on' : anyFocus ? ' dim' : ''}`;
  const isIn = (id) => view.added.has(id);
  const ptId = (p, i) => (view.shown.has(`pt#${i}`) ? `pt#${i}` : `pt:${p.label}`);
  const guideId = (p, i) => (view.shown.has(`guide#${i}`) ? `guide#${i}` : `guide:${p.label}`);
  const clip = `glc${g.id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`График: ${g.title}`} data-testid="graph-stage" data-step={k}>
      <defs><clipPath id={clip}><rect x={M.l} y={M.t - 6} width={W - M.l - M.r + 6} height={H - M.t - M.b + 6} /></clipPath></defs>
      {ticks(x0, x1).map((t) => <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke="var(--g-grid)" />)}
      {ticks(y0, y1).map((t) => <line key={`gy${t}`} x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--g-grid)" />)}
      <g className={`g-axes${view.focus.has('axes') ? ' on' : ''}`} data-testid="graph-el" data-el="axes" data-on={String(view.focus.has('axes'))}>
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--ds-ink2)" strokeWidth="1.6" />
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--ds-ink2)" strokeWidth="1.6" />
        {ticks(x0, x1).map((t) => <text key={`tx${t}`} x={sx(t)} y={H - M.b + 15} fontSize="12" fill="var(--ds-ink3)" textAnchor="middle">{fmt(t)}</text>)}
        {ticks(y0, y1).map((t) => (sy(t) - M.t > 10 ? <text key={`ty${t}`} x={M.l - 6} y={sy(t) + 4} fontSize="12" fill="var(--ds-ink3)" textAnchor="end">{fmt(t)}</text> : null))}
        <text x={W - M.r} y={H - 4} fontSize="13" fill="var(--ds-ink2)" textAnchor="end" fontStyle="italic">{scene.xLabel}</text>
        <text x={M.l - 34} y={M.t + 2} fontSize="13" fill="var(--ds-ink2)" fontStyle="italic">{scene.yLabel}</text>
      </g>
      <g clipPath={`url(#${clip})`}>
        {(scene.rects || []).map((r, i) => {
          const id = `rect:${i}`; if (!view.shown.has(id)) return null;
          const c = r.tone === 'rust' ? 'var(--g-rust)' : 'var(--g-gold)';
          return (
            <g key={`${id}-${isIn(id) ? k : 0}`} className={`${cls(id)}${isIn(id) ? ' g-in' : ''}`} style={{ '--k': c }} data-testid="graph-el" data-el={id} data-on={String(view.focus.has(id))}>
              <rect className="grow" x={sx(r.x0)} y={sy(r.y1)} width={Math.max(0, sx(r.x1) - sx(r.x0))} height={Math.max(0, sy(r.y0) - sy(r.y1))} fill={c} fillOpacity=".2" stroke={c} strokeOpacity=".6" />
            </g>
          );
        })}
        {(scene.polys || []).map((p, i) => {
          const id = view.shown.has(`poly#${i}`) ? `poly#${i}` : `poly:${p.label}`; if (!view.shown.has(id)) return null;
          const c = KCOLOR[p.tone] || 'var(--g-rust)';
          return (
            <g key={`${id}-${isIn(id) ? k : 0}`} className={`${cls(id)}${isIn(id) ? ' g-in' : ''}`} style={{ '--k': c }} data-testid="graph-el" data-el={id} data-on={String(view.focus.has(id))}>
              <polygon className={`grow${view.focus.has(id) ? ' g-pulse' : ''}`} points={p.points.map((q) => `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ')} fill={c} fillOpacity=".24" stroke={c} strokeOpacity=".6" />
            </g>
          );
        })}
        {scene.curves.map((c) => {
          if (!view.shown.has(c.id)) return null;
          const col = KCOLOR[c.color] || 'var(--g-gold)'; const d = path(c.points);
          const dashed = c.ghost || c.dashed;
          const mid = `glm${g.id}${c.id}${k}`.replace(/[^A-Za-z0-9-]/g, '');
          return (
            <g key={`${c.id}-${isIn(c.id) ? k : 0}`} className={`${cls(c.id)}${isIn(c.id) ? ' g-in' : ''}`} style={{ '--k': col }} data-testid="graph-el" data-el={c.id} data-on={String(view.focus.has(c.id))}>
              {/* линия чертится: маска-копия рисуется от начала к концу и открывает настоящую (с пунктиром) */}
              {isIn(c.id) && <mask id={mid}><path className="draw" pathLength="1" d={d} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" /></mask>}
              <path className="c" d={d} fill="none" stroke={col} strokeWidth={c.ghost ? 1.8 : 2.8} strokeOpacity={c.ghost ? 0.45 : 1} strokeDasharray={dashed ? '6 5' : undefined}
                strokeLinecap="round" mask={isIn(c.id) ? `url(#${mid})` : undefined} />
            </g>
          );
        })}
      </g>
      {/* пунктир от точки к осям и её координаты — вне обрезки: подписи под осью видны */}
      {scene.points.map((p, i) => {
        const id = guideId(p, i); if (!p.guide || !view.shown.has(id)) return null;
        return (
          <g key={`${id}-${isIn(id) ? k : 0}`} className={`${cls(id)}${isIn(id) ? ' g-in' : ''}`} data-testid="graph-el" data-el={id} data-on={String(view.focus.has(id))}>
            <line className="draw" pathLength="1" x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={H - M.b} stroke="var(--ds-ink3)" strokeWidth="1.4" strokeDasharray="4 4" />
            <line className="draw" pathLength="1" x1={sx(p.x)} x2={M.l} y1={sy(p.y)} y2={sy(p.y)} stroke="var(--ds-ink3)" strokeWidth="1.4" strokeDasharray="4 4" />
            <text className="fade" x={sx(p.x)} y={H - M.b + 28} fontSize="12" fontWeight="700" fill="var(--ds-ink)" textAnchor="middle" stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">{fmt(p.x)}</text>
            <text className="fade" x={M.l + 4} y={sy(p.y) - 5} fontSize="12" fontWeight="700" fill="var(--ds-ink)" stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">{fmt(p.y)}</text>
          </g>
        );
      })}
      {scene.curves.filter((c) => c.label && !c.ghost && view.shown.has(c.id)).map((c) => {
        const vis = c.points.filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
        const p = typeof c.labelPos === 'number' ? c.points[Math.round(c.labelPos * (c.points.length - 1))] : (vis[vis.length - 1] || c.points[c.points.length - 1]);
        const x = Math.min(W - M.r - 4, sx(p.x) + 6); const y = Math.min(H - M.b - 8, Math.max(M.t + 12, sy(p.y) - 8));
        return <text key={`l${c.id}-${isIn(c.id) ? k : 0}`} className={`${cls(c.id)}${isIn(c.id) ? ' g-in' : ''}`} x={x} y={y} fontSize="14" fontWeight="800" fill={KCOLOR[c.color] || 'var(--g-gold)'} textAnchor={x > W - 70 ? 'end' : 'start'} stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">
          <tspan className={isIn(c.id) ? 'fade' : undefined}>{c.label}</tspan></text>;
      })}
      {scene.points.map((p, i) => {
        const id = ptId(p, i); if (!view.shown.has(id) || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return null;
        const col = p.color ? KCOLOR[p.color] : p.small ? 'var(--ds-ink2)' : 'var(--g-gold)';
        const right = sx(p.x) > W - 90;
        return (
          <g key={`${id}-${isIn(id) ? k : 0}`} className={`${cls(id)}${isIn(id) ? ' g-in' : ''}`} style={{ '--k': col }} data-testid="graph-el" data-el={id} data-on={String(view.focus.has(id))}>
            <circle className="pop" cx={sx(p.x)} cy={sy(p.y)} r={p.small ? 4.5 : 6.5} fill={col} stroke="var(--ds-card)" strokeWidth="2" />
            <text className="pop" x={right ? sx(p.x) - 9 : sx(p.x) + 9} y={sy(p.y) - 9} fontSize={p.small ? 12 : 14} fontWeight="800" fill={col} textAnchor={right ? 'end' : 'start'} stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">{p.label}</text>
          </g>
        );
      })}
      {view.marks.map((m, i) => {
        const col = KCOLOR[m.tone] || 'var(--ds-ink)';
        const key = `m${k}-${i}`;
        if (m.t === 'pt') {
          const right = sx(m.x) > W - 100;
          return (
            <g key={key} className="g-mark g-in" data-testid="graph-mark">
              <circle className="pop" cx={sx(m.x)} cy={sy(m.y)} r="5" fill="var(--ds-card)" stroke={m.tone ? col : 'var(--g-blue)'} strokeWidth="2.6" />
              <text x={right ? sx(m.x) - 9 : sx(m.x) + 9} y={m.below ? sy(m.y) + 19 : Math.max(M.t + 10, sy(m.y) - 9)} fontSize="12.5" fontWeight="700" fill={m.tone ? col : 'var(--ds-ink)'} textAnchor={right ? 'end' : 'start'} stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">{m.label}</text>
            </g>
          );
        }
        if (m.t === 'x') {
          return (
            <g key={key} className="g-mark g-in" data-testid="graph-mark">
              <line className="draw" pathLength="1" x1={sx(m.x)} x2={sx(m.x)} y1={H - M.b} y2={sy(m.y ?? y1)} stroke="var(--g-teal)" strokeWidth="1.8" strokeDasharray="4 4" />
              <rect x={sx(m.x) - 30} y={H - M.b + 18} width="60" height="17" rx="8.5" fill="var(--g-teal)" />
              <text x={sx(m.x)} y={H - M.b + 30.5} fontSize="12" fontWeight="800" fill="#fff" textAnchor="middle">{m.label}</text>
            </g>
          );
        }
        if (m.t === 'y') {
          return (
            <g key={key} className="g-mark g-in" data-testid="graph-mark">
              <line className="draw" pathLength="1" x1={M.l} x2={sx(m.x ?? x1)} y1={sy(m.y)} y2={sy(m.y)} stroke="var(--g-teal)" strokeWidth="1.8" strokeDasharray="4 4" />
              <text x={M.l + 4} y={sy(m.y) - 5} fontSize="12" fontWeight="800" fill="var(--g-teal)">{m.label}</text>
            </g>
          );
        }
        if (m.t === 'seg') {
          const a = sx(m.x0); const b = sx(m.x1); const y = sy(m.y);
          return (
            <g key={key} className="g-mark g-in" data-testid="graph-mark">
              <line className="draw" pathLength="1" x1={a} x2={b} y1={y} y2={y} stroke={col} strokeWidth="6" strokeLinecap="round" strokeOpacity=".75" />
              <text className="fade" x={(a + b) / 2} y={y - 9} fontSize="12.5" fontWeight="800" fill={col} textAnchor="middle" stroke="var(--ds-card)" strokeWidth="4" paintOrder="stroke">{m.label}</text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function GraphLesson({ id, learn, update, onClose, peek = false }) {
  const g = GRAPH_BY_ID[id];
  const [k, setK] = useState(0);
  const [replay, setReplay] = useState(0);
  const [phase, setPhase] = useState('tour'); // tour → quiz → done
  const [order] = useState(() => (g ? g.quiz.options.map((o, i) => ({ ...o, i })).sort(() => Math.random() - 0.5) : []));
  const [picked, setPicked] = useState(null);
  const firstOk = useRef(null);
  const started = useRef(Date.now());
  const root = useRef(null);
  const [already] = useState(() => isGraphDone(learn, id));
  useEffect(() => { if (root.current) root.current.scrollTo({ top: 0 }); }, [k, phase]);
  useEffect(() => { const esc = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onClose]);
  if (!g) return null;
  const n = g.steps.length;
  const view = stepView(g, k);
  const answered = picked != null && order[picked].ok;
  const pick = (i) => {
    if (answered) return;
    const ok = !!order[i].ok;
    if (firstOk.current == null) firstOk.current = ok;
    Audio.play(ok ? 'coin' : 'down');
    setPicked(i);
  };
  const finish = () => {
    Audio.play('register');
    if (!peek && !already && update) update((s) => markGraph(finishLesson(s, null, { xp: GRAPH_XP, accuracy: firstOk.current ? 100 : 60, seconds: Math.min(900, (Date.now() - started.current) / 1000), kind: 'graph' }), id));
    setPhase('done');
  };
  const next = () => {
    Audio.play('paper');
    if (phase === 'tour') { if (k < n - 1) setK(k + 1); else setPhase('quiz'); return; }
    if (phase === 'quiz') finish();
  };
  const back = () => { Audio.play('paper'); if (phase === 'quiz') { setPhase('tour'); return; } if (k > 0) setK(k - 1); };
  const body = (
    <div className="gl" ref={root} role="dialog" aria-label={`Разбор графика: ${g.title}`} data-testid="graph-lesson" data-id={id} data-phase={phase}>
      <style>{CSS}</style>
      <div className="gl-top">
        <IconButton label="Закрыть" icon={X} data-testid="graph-close" onClick={() => { Audio.play('paper'); onClose(); }} />
        <div className="gl-title"><small>Разбор графика</small>{g.title}</div>
      </div>
      <div className="gl-bar" aria-hidden="true">{[...g.steps, null].map((_, i) => <i key={i} className={phase !== 'tour' || i <= k ? 'on' : ''} />)}</div>
      {phase === 'tour' && (
        <div className="gl-page">
          <div className="gl-stage">
            <GraphStage g={g} k={k} key={replay} />
            <div className="gl-replay"><IconButton label="Ещё раз" icon={RotateCcw} data-testid="graph-replay" onClick={() => { Audio.play('tick'); setReplay((x) => x + 1); }} /></div>
          </div>
          <div className="gl-text" key={k} data-testid="graph-text" aria-live="polite">
            <span className="gl-step">Шаг {k + 1} из {n}</span>
            <div>{rich(view.text)}</div>
          </div>
        </div>
      )}
      {phase === 'quiz' && (
        <div className="gl-page gl-quiz" data-testid="graph-quiz">
          <div className="gl-stage"><GraphStage g={g} k={n - 1} /></div>
          <h2>{g.quiz.q}</h2>
          <div className="gl-opts" role="group" aria-label="Варианты ответа">
            {order.map((o, i) => {
              const st = picked === i ? (o.ok ? 'ok' : 'bad') : answered && o.ok ? 'ok' : '';
              return <button key={o.i} type="button" className={`gl-opt ${st}`} disabled={answered} data-testid="graph-opt" data-ok={o.ok ? 'true' : 'false'} onClick={() => pick(i)}>{o.text}</button>;
            })}
          </div>
          {picked != null && (
            <div className={`gl-fb${order[picked].ok ? '' : ' bad'}`} role="status" data-testid="graph-feedback" data-ok={String(!!order[picked].ok)}>
              <b>{order[picked].ok ? 'Верно.' : 'Не совсем.'}</b> {order[picked].why}{order[picked].ok ? '' : ' Попробуйте ещё раз.'}
            </div>
          )}
        </div>
      )}
      {phase === 'done' && (
        <div className="gl-page gl-done" data-testid="graph-done">
          <div className="gl-medal" aria-hidden="true"><ChartSpline size={58} strokeWidth={1.8} /></div>
          <div className="ds-eyebrow">Разбор графика</div>
          <h2>{g.title}</h2>
          <div className="ds-sub" style={{ fontSize: 15 }}>{peek || already ? 'График разобран — к нему можно вернуться на дороге юнита.' : `+${GRAPH_XP} опыта · график разобран`}</div>
        </div>
      )}
      <div className="gl-foot">
        <div>
          {phase === 'done'
            ? <Button wide data-testid="graph-finish" onClick={() => { Audio.play('click'); onClose(); }}>Готово</Button>
            : <>
              <Button variant="ghost" icon={ArrowLeft} disabled={phase === 'tour' && k === 0} data-testid="graph-back" onClick={back}>Назад</Button>
              <Button wide icon={phase === 'quiz' ? Check : ArrowRight} disabled={phase === 'quiz' && !answered} data-testid="graph-next" onClick={next}>
                {phase === 'quiz' ? 'Готово' : k < n - 1 ? 'Дальше' : 'К вопросу'}
              </Button>
            </>}
        </div>
      </div>
    </div>
  );
  return body;
}

