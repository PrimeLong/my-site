/* ЧЕРНОВИК НА ПОЛЯХ УРОКА — холсты под уроком и док инструментов (docs/mechanics.md, «Урок на ПК»).
   Только на ПК с мышью и широким окном. Кнопка «Черновик» внизу слева включает и выключает режим,
   выбор запоминается на устройстве. Выключен — обычный курсор, поля не рисуют, записи видны.
   Включён — на полях проступает сетка точек, курсор показывает инструмент, из кнопки выезжает
   панель: ручка, маркер, ластик, «Отменить», «Стереть всё», а над ней — цвета и толщина.
   Нажатие на сам урок (текст, варианты, кнопки) работает как раньше — рисует только поле.
   Холсты лежат под уроком: запись видна на полях и не закрывает задание. Готовые штрихи — на
   основном холсте; штрих, который ведут прямо сейчас, — на живом: маркер полупрозрачный, и
   нарисованный кусками он темнел бы на стыках. */
import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Highlighter, Eraser, Undo2, Trash2, RotateCcw } from 'lucide-react';
import { SKETCH, SKETCH_TOOLS, SKETCH_SIZES, SKETCH_COLORS, strokeWidth, toLocal, addPoint, segmentsOf, pieceAt, pushStroke, restoreStrokes } from './learn/sketch.js';
import { useReducedMotion } from './ds-art.jsx';
import { Audio } from './MacroSimulator.jsx';

/* Поля у колонки урока шире дока при любом увеличении урока — от 1280 px (у 1260 px и урока ×1,2
   поле 294 px, док — 286 px); и мышь или перо, а не палец. */
export const SKETCH_QUERY = '(min-width: 1280px) and (hover: hover) and (pointer: fine)';
const ON_KEY = 'ems-sketch-on';
const TRIED_KEY = 'ems-sketch-tried';
const stored = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* нет хранилища */ } };
const TOOLS = [{ id: 'pen', icon: PenLine }, { id: 'marker', icon: Highlighter }, { id: 'eraser', icon: Eraser }];

// курсор из SVG; у ручки кончик — текущего цвета, у маркера и ластика — круг их толщины
const svgCursor = (svg, x, y) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, crosshair`;
const penCursor = (color) => svgCursor(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">`
  + `<path d="M4 24l1.7-6.4L19 4.3a2.3 2.3 0 0 1 3.2 0l1.5 1.5a2.3 2.3 0 0 1 0 3.2L10.4 22.3z" fill="#26201C" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`
  + `<path d="M4 24l1.7-6.4 4.7 4.7z" fill="${color}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`, 4, 24);
const ringCursor = (d, fill) => {
  const s = Math.ceil(d) + 6; const c = s / 2;
  return svgCursor(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`
    + `<circle cx="${c}" cy="${c}" r="${d / 2}" fill="${fill || '#fff'}" fill-opacity="${fill ? 0.35 : 0.3}" stroke="#26201C" stroke-width="1.2"/>`
    + `<circle cx="${c}" cy="${c}" r="${d / 2 + 1.2}" fill="none" stroke="#fff" stroke-width="1"/></svg>`, Math.round(c), Math.round(c));
};

export const SKETCH_CSS = `
  .sk-grid { position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .45s ease;
    background-image: radial-gradient(circle, color-mix(in srgb, var(--ds-ink) 22%, transparent) 1.1px, transparent 1.7px); background-size: 22px 22px; background-position: 11px 11px;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(var(--l, 35%) - 80px), transparent calc(var(--l, 35%) - 18px), transparent calc(var(--r, 65%) + 18px), #000 calc(var(--r, 65%) + 80px));
    mask-image: linear-gradient(90deg, #000 calc(var(--l, 35%) - 80px), transparent calc(var(--l, 35%) - 18px), transparent calc(var(--r, 65%) + 18px), #000 calc(var(--r, 65%) + 80px)); }
  .sk-grid.on { opacity: 1; }
  .sk-canvas { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; transition: opacity .26s ease, filter .26s ease; }
  .sk-canvas.wipe { opacity: 0; filter: blur(6px); }
  .ln-overlay[data-sketch], .ln-overlay[data-sketch] > .ln-body { cursor: var(--sk-cursor, crosshair); }
  .ln-overlay[data-sketch] > :not(.ln-body), .ln-overlay[data-sketch] > .ln-body > * { cursor: auto; }
  .ln-overlay[data-sketching] * { cursor: inherit !important; user-select: none; }

  .sk-dock { position: absolute; left: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 7; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
  .sk-glass { border: 1px solid color-mix(in srgb, var(--ds-rule2) 75%, transparent); background: color-mix(in srgb, var(--ds-card) 76%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.6); backdrop-filter: blur(16px) saturate(1.6);
    box-shadow: 0 18px 40px -18px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 color-mix(in srgb, #fff 50%, transparent); }
  .ds-dark .sk-glass { box-shadow: 0 18px 40px -18px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 rgba(255, 255, 255, .07); }
  .sk-bar { position: relative; display: flex; align-items: center; padding: 4px; border-radius: 999px; }
  /* выключатель режима: «✎ Черновик» с тумблером; включён — остаётся один тумблер, из него выезжают инструменты */
  .sk-toggle { display: flex; align-items: center; height: 36px; padding: 0 9px 0 11px; border: none; border-radius: 999px; cursor: pointer; white-space: nowrap;
    background: transparent; color: var(--ds-ink); font: 700 14px var(--ds-sans); transition: background .25s, padding .4s cubic-bezier(.2, .9, .3, 1); }
  .sk-toggle:hover { background: color-mix(in srgb, var(--ds-ink) 7%, transparent); }
  .sk-toggle-icon, .sk-toggle-label { display: inline-flex; overflow: hidden; max-width: 90px; margin-right: 8px; transition: max-width .4s cubic-bezier(.2, .9, .3, 1), margin .4s cubic-bezier(.2, .9, .3, 1), opacity .2s; }
  .sk-toggle-icon svg { transition: transform .35s cubic-bezier(.3, 1.4, .5, 1); }
  .sk-toggle:hover .sk-toggle-icon svg { transform: rotate(-12deg) translateY(-1px); }
  .sk-switch { position: relative; flex-shrink: 0; width: 32px; height: 19px; border-radius: 999px; background: color-mix(in srgb, var(--ds-ink) 20%, transparent); transition: background .3s, box-shadow .3s; }
  .sk-switch::after { content: ''; position: absolute; top: 2.5px; left: 2.5px; width: 14px; height: 14px; border-radius: 50%; background: var(--ds-card);
    box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .35s cubic-bezier(.3, 1.4, .5, 1), background .3s; }
  .sk-dock.on .sk-toggle { padding: 0 8px; }
  .sk-dock.on .sk-toggle-icon, .sk-dock.on .sk-toggle-label { max-width: 0; margin-right: 0; opacity: 0; }
  .sk-dock.on .sk-switch { background: var(--u); box-shadow: 0 4px 12px -4px var(--u); }
  .sk-dock.on .sk-switch::after { transform: translateX(13px); background: #fff; }
  .sk-tools { display: flex; align-items: center; overflow: hidden; max-width: 0; opacity: 0; transition: max-width .45s cubic-bezier(.2, .9, .3, 1), opacity .25s ease; }
  .sk-dock.on .sk-tools { max-width: 260px; opacity: 1; }
  .sk-group { position: relative; display: flex; gap: 2px; }
  .sk-ind { position: absolute; top: 0; left: 0; width: 36px; height: 36px; border-radius: 999px; background: var(--c); box-shadow: 0 6px 14px -6px var(--c);
    transform: translateX(calc(var(--i) * 38px)); transition: transform .34s cubic-bezier(.3, 1.35, .5, 1), background .25s; }
  .sk-tool { position: relative; width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; border: none; display: grid; place-items: center; cursor: pointer;
    background: transparent; color: var(--ds-ink2); transition: color .2s, transform .15s, background .15s, opacity .2s; }
  .sk-tool svg { transition: transform .25s cubic-bezier(.3, 1.4, .5, 1); }
  .sk-tool:hover:not(:disabled) svg { transform: translateY(-1px) rotate(-8deg); }
  .sk-tool:hover:not([aria-pressed="true"]):not(:disabled) { color: var(--ds-ink); background: color-mix(in srgb, var(--ds-ink) 7%, transparent); }
  .sk-tool:active:not(:disabled) { transform: scale(.88); }
  .sk-tool[aria-pressed="true"] { color: var(--on, var(--ds-paper)); }
  .sk-tool:disabled { opacity: .32; cursor: default; }
  .sk-sep { width: 1px; height: 22px; margin: 0 6px; flex-shrink: 0; background: var(--ds-rule2); }
  .sk-props { display: flex; align-items: center; gap: 3px; padding: 6px 8px; border-radius: 18px; transform-origin: bottom left;
    transition: opacity .25s, transform .35s cubic-bezier(.2, .9, .3, 1.2), visibility .35s; }
  .sk-props[data-show="false"] { opacity: 0; visibility: hidden; transform: translateY(10px) scale(.95); }
  .sk-dot { position: relative; width: 22px; height: 22px; margin: 0 2px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: var(--c);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, #fff 20%, transparent); transition: transform .2s cubic-bezier(.3, 1.4, .5, 1); }
  .sk-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--c); opacity: 0; transform: scale(.7); transition: opacity .2s, transform .25s cubic-bezier(.3, 1.4, .5, 1); }
  .sk-dot[aria-pressed="true"]::after { opacity: 1; transform: none; }
  .sk-dot:hover { transform: scale(1.14); }
  .sk-size { width: 30px; height: 30px; padding: 0; border: none; border-radius: 999px; cursor: pointer; display: grid; place-items: center; background: transparent; transition: background .2s; }
  .sk-size::before { content: ''; width: var(--d); height: var(--d); border-radius: 50%; background: var(--c); opacity: var(--a, 1); transition: transform .2s; }
  .sk-size:hover::before { transform: scale(1.15); }
  .sk-size[aria-pressed="true"] { background: color-mix(in srgb, var(--ds-ink) 9%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ds-ink) 22%, transparent); }
  .sk-snack { display: flex; align-items: center; gap: 10px; padding: 5px 5px 5px 14px; border-radius: 999px; font: 600 13.5px var(--ds-sans); color: var(--ds-ink2); animation: sk-pop .35s cubic-bezier(.2, .9, .3, 1.25) both; }
  .sk-back { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px 0 11px; border: none; border-radius: 999px; cursor: pointer;
    background: var(--ds-ink); color: var(--ds-paper); font: 700 13.5px var(--ds-sans); }
  .sk-back:hover { filter: brightness(1.15); }
  .sk-tool:focus-visible, .sk-toggle:focus-visible, .sk-dot:focus-visible, .sk-size:focus-visible, .sk-back:focus-visible { outline: 2px solid var(--u); outline-offset: 2px; }
  .sk-callout { position: absolute; left: 0; bottom: calc(100% + 12px); white-space: nowrap; padding: 8px 13px; border-radius: 12px; pointer-events: none;
    background: var(--ds-ink); color: var(--ds-paper); font: 600 13px var(--ds-sans); box-shadow: 0 10px 24px -10px var(--ds-shade); animation: sk-pop .5s cubic-bezier(.2, .9, .3, 1.3) .9s both; }
  .sk-callout::before { content: ''; position: absolute; left: 22px; top: 100%; border: 6px solid transparent; border-bottom: 0; border-top-color: var(--ds-ink); }
  .sk-bar[data-new]::after { content: ''; position: absolute; inset: -1px; border-radius: 999px; border: 2px solid var(--u); pointer-events: none; animation: sk-ring 1.8s ease-out 1s 3 both; }
  @keyframes sk-pop { from { opacity: 0; transform: translateY(8px) scale(.94); } to { opacity: 1; transform: none; } }
  @keyframes sk-ring { 0% { opacity: .8; transform: scale(1); } 100% { opacity: 0; transform: scale(1.25, 1.6); } }
  @media (prefers-reduced-motion: reduce) {
    .sk-snack, .sk-callout, .sk-bar[data-new]::after { animation: none; }
    .sk-canvas, .sk-grid, .sk-tools, .sk-toggle, .sk-toggle-icon, .sk-toggle-label, .sk-switch, .sk-switch::after, .sk-ind, .sk-props { transition: none; }
  }
`;

// поле урока — сам слой урока и его тело вне колонки; полоса прокрутки тела — не поле
function onMargin(e, root) {
  const t = e.target;
  if (t === root) return true;
  if (!(t instanceof Element) || t.parentElement !== root || !t.classList.contains('ln-body')) return false;
  const r = t.getBoundingClientRect();
  const k = t.offsetWidth ? r.width / t.offsetWidth : 1;
  return e.clientX < r.left + t.clientWidth * k;
}
const typing = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
// цвета кисти из темы урока — в тёмной теме чернила светлые
function inks(root) {
  const cs = getComputedStyle(root);
  return Object.fromEntries(SKETCH_COLORS.map((c) => [c.id, cs.getPropertyValue(c.css).trim() || '#26201C']));
}
// маркер на тёмной бумаге плотнее — иначе он мутный
const markerAlpha = (root) => (root.classList.contains('ds-dark') ? SKETCH_TOOLS.marker.dark : SKETCH_TOOLS.marker.alpha);

function trace(ctx, seg, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  if (seg.op === 'dot') { ctx.arc(seg.x, seg.y, width / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.moveTo(seg.from.x, seg.from.y);
  if (seg.op === 'quad') ctx.quadraticCurveTo(seg.via.x, seg.via.y, seg.to.x, seg.to.y); else ctx.lineTo(seg.to.x, seg.to.y);
  ctx.stroke();
}
/* Ручка — кусками разной толщины (нажим), маркер и ластик — одной линией: у полупрозрачного
   маркера стыки кусков не темнеют. Ластик выбивает уже нарисованное. */
function drawStroke(ctx, s, color, alpha) {
  const segs = segmentsOf(s.points);
  if (!segs.length) return;
  const width = strokeWidth(s.tool, s.size);
  ctx.save();
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = s.tool === 'marker' ? alpha : 1;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.tool === 'pen' || segs[0].op === 'dot') segs.forEach((seg) => trace(ctx, seg, s.tool === 'pen' ? width * seg.w : width));
  else {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(segs[0].from.x, segs[0].from.y);
    segs.forEach((seg) => (seg.op === 'quad' ? ctx.quadraticCurveTo(seg.via.x, seg.via.y, seg.to.x, seg.to.y) : ctx.lineTo(seg.to.x, seg.to.y)));
    ctx.stroke();
  }
  ctx.restore();
}
// холст — по размеру слоя урока и плотности экрана; x — от середины слоя
function fit(c, w, h, dpr) {
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, (w / 2) * dpr, 0);
  ctx.clearRect(-w / 2, 0, w, h);
  return ctx;
}

export function LessonSketch() {
  const mainRef = useRef(null);
  const liveRef = useRef(null);
  const gridRef = useRef(null);
  const strokes = useRef([]);
  const live = useRef(null);
  const frame = useRef(0);
  const wipeTimer = useRef(null);
  const [on, setOn] = useState(() => stored(ON_KEY) === '1');
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('ink');
  const [size, setSize] = useState('m');
  const [count, setCount] = useState(0);
  const [cleared, setCleared] = useState(null);
  const [wiping, setWiping] = useState(false);
  const [tried, setTried] = useState(() => stored(TRIED_KEY) === '1');
  const reduced = useReducedMotion();
  const pick = useRef(null);
  pick.current = { on, tool, color, size };
  const rootOf = () => mainRef.current && mainRef.current.parentElement;

  const drawLive = () => {
    frame.current = 0;
    const L = live.current; const r = rootOf();
    if (!L || !r) return;
    const ctx = liveRef.current.getContext('2d');
    ctx.clearRect(-r.clientWidth / 2, 0, r.clientWidth, r.clientHeight);
    drawStroke(ctx, L.s, L.ink, markerAlpha(r));
  };
  // сетка — только на полях: колонку урока она обходит с мягким краем
  const measure = (r) => {
    const g = gridRef.current;
    if (!g) return;
    const col = r.querySelector(':scope > .ln-body > .ln-inner') || r.querySelector(':scope > .ln-foot .ln-inner');
    const box = r.getBoundingClientRect();
    if (!col) return;
    const b = col.getBoundingClientRect();
    g.style.setProperty('--l', `${Math.round(b.left - box.left)}px`);
    g.style.setProperty('--r', `${Math.round(b.right - box.left)}px`);
  };
  // весь черновик заново: окно сменило размер или тему, отмена, «Стереть всё»
  const paint = () => {
    const r = rootOf();
    if (!r || !r.clientWidth) return;
    const w = r.clientWidth; const h = r.clientHeight; const dpr = window.devicePixelRatio || 1;
    const ctx = fit(mainRef.current, w, h, dpr);
    fit(liveRef.current, w, h, dpr);
    const ink = inks(r); const alpha = markerAlpha(r);
    for (const s of strokes.current) drawStroke(ctx, s, ink[s.color], alpha);
    if (live.current && live.current.s.tool !== 'eraser') drawLive();
    measure(r);
  };
  const undo = () => {
    if (!strokes.current.length) return;
    strokes.current = strokes.current.slice(0, -1);
    paint(); setCount(strokes.current.length);
  };

  useEffect(() => {
    const r = rootOf();
    if (!r) return undefined;
    const at = (e) => { const b = r.getBoundingClientRect(); return { ...toLocal(e.clientX - b.left, e.clientY - b.top, r.clientWidth), t: e.timeStamp }; };
    // ластик стирает на лету прямо на основном холсте
    const erase = (k) => {
      const L = live.current; const ctx = mainRef.current.getContext('2d');
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
      trace(ctx, pieceAt(L.s.points, k), strokeWidth('eraser', L.s.size));
      ctx.restore();
    };
    const schedule = () => { if (!frame.current) frame.current = requestAnimationFrame(drawLive); };
    const down = (e) => {
      const p = pick.current;
      if (!p.on || e.button !== 0 || e.pointerType === 'touch' || live.current || !onMargin(e, r)) return;
      e.preventDefault();
      paint();
      const s = { tool: p.tool, color: p.color, size: p.size, points: [] };
      addPoint(s, at(e));
      live.current = { s, id: e.pointerId, ink: inks(r)[p.color] };
      try { r.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
      r.dataset.sketching = 'true';
      if (s.tool === 'eraser') erase(0); else schedule();
    };
    const move = (e) => {
      const L = live.current;
      if (!L || e.pointerId !== L.id) return;
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      let added = false;
      for (const ev of (list.length ? list : [e])) {
        if (!addPoint(L.s, at(ev))) continue;
        added = true;
        if (L.s.tool === 'eraser') erase(L.s.points.length - 1);
      }
      if (added && L.s.tool !== 'eraser') schedule();
    };
    const up = (e) => {
      const L = live.current;
      if (!L || e.pointerId !== L.id) return;
      live.current = null;
      cancelAnimationFrame(frame.current); frame.current = 0;
      delete r.dataset.sketching;
      const full = strokes.current.length >= SKETCH.maxStrokes;
      strokes.current = pushStroke(strokes.current, L.s);
      // готовый штрих — на основной холст, живой слой — чистый; черновик переполнен — старейший штрих ушёл, холст заново
      liveRef.current.getContext('2d').clearRect(-r.clientWidth / 2, 0, r.clientWidth, r.clientHeight);
      if (full) paint(); else drawStroke(mainRef.current.getContext('2d'), L.s, L.ink, markerAlpha(r));
      setCount(strokes.current.length); setCleared(null);
    };
    // Ctrl+Z — отменить последний штрих (не когда печатают ответ: там своя отмена; и не при скрытом уроке)
    const key = (e) => {
      if (!pick.current.on || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyZ' || typing(document.activeElement) || !r.clientWidth) return;
      if (!strokes.current.length) return;
      e.preventDefault();
      undo();
    };
    r.addEventListener('pointerdown', down);
    r.addEventListener('pointermove', move);
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    // окно сменило размер или тему — черновик перерисовывается в новых размерах и цветах
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => paint()) : null;
    if (ro) ro.observe(r);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => paint()) : null;
    if (mo) mo.observe(r, { attributes: true, attributeFilter: ['class', 'data-ds-theme'] });
    return () => {
      r.removeEventListener('pointerdown', down);
      r.removeEventListener('pointermove', move);
      r.removeEventListener('pointerup', up);
      r.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      cancelAnimationFrame(frame.current);
      clearTimeout(wipeTimer.current);
      delete r.dataset.sketching;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // режим включён — курсор над полями показывает инструмент: ручка с кончиком цвета, круг толщины маркера или ластика
  useEffect(() => {
    const r = rootOf();
    if (!r || !on) return undefined;
    const ink = inks(r)[color];
    r.dataset.sketch = tool;
    r.style.setProperty('--sk-cursor', tool === 'pen' ? penCursor(ink) : ringCursor(strokeWidth(tool, size), tool === 'marker' ? ink : null));
    const g = gridRef.current; if (g) measure(r);
    return () => { delete r.dataset.sketch; r.style.removeProperty('--sk-cursor'); };
  }, [on, tool, color, size]); // eslint-disable-line react-hooks/exhaustive-deps

  // «Вернуть» после «Стереть всё» — пять секунд
  useEffect(() => {
    if (!cleared) return undefined;
    const t = setTimeout(() => setCleared(null), 5000);
    return () => clearTimeout(t);
  }, [cleared]);

  const toggle = () => {
    Audio.play('tab');
    const next = !on;
    setOn(next);
    store(ON_KEY, next ? '1' : null);
    if (next && !tried) { setTried(true); store(TRIED_KEY, '1'); }
  };
  const choose = (patch) => {
    Audio.play('tick');
    if (patch.tool) setTool(patch.tool);
    if (patch.color) setColor(patch.color);
    if (patch.size) setSize(patch.size);
  };
  const wipe = () => {
    if (!strokes.current.length || wiping) return;
    Audio.play('paper');
    const done = () => {
      setCleared(strokes.current);
      strokes.current = [];
      paint(); setCount(0); setWiping(false);
      if (pick.current.tool === 'eraser') setTool('pen');
    };
    if (reduced) { done(); return; }
    setWiping(true);
    wipeTimer.current = setTimeout(done, 260);
  };
  const restore = () => {
    if (!cleared) return;
    Audio.play('paper');
    strokes.current = restoreStrokes(cleared, strokes.current);
    paint(); setCount(strokes.current.length); setCleared(null);
  };

  const colorCss = `var(${SKETCH_COLORS.find((c) => c.id === color).css})`;
  const toolIdx = TOOLS.findIndex((t) => t.id === tool);
  const sizes = SKETCH_TOOLS[tool].sizes;
  const dotOf = (px) => Math.max(5, Math.min(18, tool === 'pen' ? px * 2.4 : px * 0.62));
  const snack = on && !!cleared && !count;
  return (
    <>
      <div ref={gridRef} className={`sk-grid ${on ? 'on' : ''}`} aria-hidden="true" data-testid="sketch-grid" />
      <canvas ref={mainRef} className={`sk-canvas ${wiping ? 'wipe' : ''}`} aria-hidden="true" data-testid="sketch-canvas" data-strokes={count} />
      <canvas ref={liveRef} className="sk-canvas" aria-hidden="true" />
      <div className={`sk-dock ${on ? 'on' : ''}`} data-testid="sketch-dock" data-on={String(on)}>
        {snack ? (
          <div className="sk-snack sk-glass" role="status" data-testid="sketch-snack">
            Черновик стёрт
            <button type="button" className="sk-back" data-testid="sketch-restore" onClick={restore}><RotateCcw size={15} aria-hidden="true" />Вернуть</button>
          </div>
        ) : (
          <div className="sk-props sk-glass" data-show={String(on)} inert={!on} data-testid="sketch-props" role="group" aria-label="Цвет и толщина">
            {tool !== 'eraser' && <>
              {SKETCH_COLORS.map((c) => (
                <button key={c.id} type="button" className="sk-dot" aria-pressed={color === c.id} aria-label={c.label} title={c.label} data-testid={`sketch-color-${c.id}`}
                  style={{ '--c': `var(${c.css})` }} onClick={() => choose({ color: c.id })} />
              ))}
              <span className="sk-sep" aria-hidden="true" />
            </>}
            {SKETCH_SIZES.map((z) => (
              <button key={z.id} type="button" className="sk-size" aria-pressed={size === z.id} aria-label={z.label} title={z.label} data-testid={`sketch-size-${z.id}`}
                style={{ '--d': `${dotOf(sizes[z.id])}px`, '--c': tool === 'eraser' ? 'var(--ds-ink3)' : colorCss, '--a': tool === 'marker' ? 0.55 : 1 }}
                onClick={() => choose({ size: z.id })} />
            ))}
          </div>
        )}
        <div className="sk-bar sk-glass" role="toolbar" aria-label="Черновик на полях" data-new={!tried ? '' : undefined}>
          <button type="button" className="sk-toggle" role="switch" aria-checked={on} aria-label="Черновик на полях" data-testid="sketch-toggle"
            title={on ? 'Выключить черновик — обычный курсор' : 'Черновик на полях: пишите мышью заметки и формулы'} onClick={toggle}>
            <span className="sk-toggle-icon" aria-hidden="true"><PenLine size={18} /></span><span className="sk-toggle-label" aria-hidden="true">Черновик</span>
            <span className="sk-switch" aria-hidden="true" />
          </button>
          {!tried && !on && <div className="sk-callout" data-testid="sketch-callout">Новое: пишите на полях урока</div>}
          <div className="sk-tools" inert={!on}>
            <span className="sk-sep" aria-hidden="true" />
            <div className="sk-group" style={{ '--i': toolIdx }}>
              <span className="sk-ind" aria-hidden="true" style={{ '--c': tool === 'eraser' ? 'var(--ds-ink)' : colorCss }} />
              {TOOLS.map(({ id, icon: Icon }) => (
                <button key={id} type="button" className="sk-tool" aria-pressed={tool === id} aria-label={SKETCH_TOOLS[id].label} title={SKETCH_TOOLS[id].label}
                  data-testid={`sketch-${id}`} style={tool === id && id !== 'eraser' && color === 'unit' ? { '--on': '#fff' } : undefined}
                  onClick={() => choose({ tool: id })}><Icon size={18} aria-hidden="true" /></button>
              ))}
            </div>
            <span className="sk-sep" aria-hidden="true" />
            <button type="button" className="sk-tool" aria-label="Отменить" title="Отменить (Ctrl+Z)" data-testid="sketch-undo" disabled={!count} onClick={() => { Audio.play('tick'); undo(); }}><Undo2 size={18} aria-hidden="true" /></button>
            <button type="button" className="sk-tool" aria-label="Стереть всё" title="Стереть всё" data-testid="sketch-clear" disabled={!count} onClick={wipe}><Trash2 size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </>
  );
}
