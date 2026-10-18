/* ЧЕРНОВИК НА ПОЛЯХ УРОКА — холст под уроком и панель инструментов (docs/mechanics.md, «Урок на ПК»).
   Только на ПК с мышью и широким окном: поля по бокам колонки урока — это фон, на нём можно писать.
   Нажатие на сам урок (текст, варианты, кнопки) работает как раньше — рисует только нажатие на поле.
   Холст лежит под уроком: запись видна на полях и сквозь пустые места, но не закрывает задание. */
import React, { useEffect, useRef, useState } from 'react';
import { Brush, Eraser, Trash2, Undo2, PenLine } from 'lucide-react';
import { SKETCH, SKETCH_COLORS, toLocal, addPoint, segmentsOf, pieceAt, pushStroke, restoreStrokes } from './learn/sketch.js';
import { useReducedMotion } from './ds-art.jsx';
import { Audio } from './MacroSimulator.jsx';

// поля у колонки урока шире панели инструментов — от 1180 px; и мышь или перо, а не палец
export const SKETCH_QUERY = '(min-width: 1180px) and (hover: hover) and (pointer: fine)';
const TRIED_KEY = 'ems-sketch-tried';

const PEN_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'%3E%3Cpath d='M3 23l1.6-6L17.5 4.1a2.1 2.1 0 0 1 3 0l1.4 1.4a2.1 2.1 0 0 1 0 3L9 21.4z' fill='%2326201C' stroke='white' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E") 3 23, crosshair`;
const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='rgba(255,255,255,.35)' stroke='%2326201C' stroke-width='1.5'/%3E%3Ccircle cx='16' cy='16' r='15.2' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E") 16 16, cell`;

export const SKETCH_CSS = `
  .sk-canvas { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; transition: opacity .26s ease, filter .26s ease; }
  .sk-canvas.wipe { opacity: 0; filter: blur(6px); }
  .ln-overlay[data-sketch="pen"], .ln-overlay[data-sketch="pen"] > .ln-body { cursor: ${PEN_CURSOR}; }
  .ln-overlay[data-sketch="eraser"], .ln-overlay[data-sketch="eraser"] > .ln-body { cursor: ${ERASER_CURSOR}; }
  .ln-overlay[data-sketch] > :not(.ln-body), .ln-overlay[data-sketch] > .ln-body > * { cursor: auto; }
  .ln-overlay[data-sketching] * { cursor: inherit !important; user-select: none; }
  .sk-bar, .sk-hint { position: absolute; left: 20px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 7; }
  .sk-bar { display: flex; align-items: center; gap: 4px; padding: 5px; border-radius: 999px; border: 1px solid var(--ds-rule2);
    background: color-mix(in srgb, var(--ds-card) 84%, transparent); -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
    box-shadow: 0 14px 34px -14px var(--ds-shade), 0 2px 8px -3px var(--ds-shade); animation: sk-in .38s cubic-bezier(.2, .9, .3, 1.25) both; }
  @keyframes sk-in { from { opacity: 0; transform: translateY(18px) scale(.94); } to { opacity: 1; transform: none; } }
  .sk-tool { width: 38px; height: 38px; border-radius: 999px; border: none; display: grid; place-items: center; cursor: pointer; background: transparent; color: var(--ds-ink2);
    transition: background .16s, color .16s, transform .16s; }
  .sk-tool:hover { background: var(--ds-card2); color: var(--ds-ink); }
  .sk-tool:active { transform: scale(.9); }
  .sk-tool[aria-pressed="true"] { background: var(--c, var(--ds-ink)); color: var(--ds-paper); box-shadow: 0 4px 12px -4px var(--c, var(--ds-ink)); }
  .sk-tool:focus-visible, .sk-dot:focus-visible { outline: 2px solid var(--u); outline-offset: 2px; }
  .sk-dot { width: 22px; height: 22px; margin: 0 2px; border-radius: 50%; border: 3px solid var(--ds-card); background: var(--c); cursor: pointer; padding: 0;
    box-shadow: 0 0 0 1.5px var(--ds-rule2); transition: transform .16s, box-shadow .16s; }
  .sk-dot:hover { transform: scale(1.12); }
  .sk-dot[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--c); transform: scale(1.12); }
  .sk-sep { width: 1px; height: 22px; margin: 0 4px; background: var(--ds-rule2); }
  .sk-back { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px 0 12px; border: none; border-radius: 999px; cursor: pointer;
    background: var(--ds-ink); color: var(--ds-paper); font: 700 14px var(--ds-sans); animation: sk-in .3s ease both; }
  .sk-hint { display: flex; align-items: center; gap: 8px; max-width: 230px; padding: 8px 14px 8px 11px; border-radius: 999px; border: 1px dashed var(--ds-rule2);
    color: var(--ds-ink3); font: 13px/1.3 var(--ds-sans); pointer-events: none; animation: sk-hint .6s ease .8s both; }
  @keyframes sk-hint { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .sk-bar, .sk-back, .sk-hint { animation: none; } .sk-canvas { transition: none; } }
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

function trace(ctx, seg, size) {
  ctx.beginPath();
  if (seg.op === 'dot') { ctx.arc(seg.x, seg.y, size / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.moveTo(seg.from.x, seg.from.y);
  if (seg.op === 'quad') ctx.quadraticCurveTo(seg.via.x, seg.via.y, seg.to.x, seg.to.y); else ctx.lineTo(seg.to.x, seg.to.y);
  ctx.stroke();
}
// цвета кисти из темы урока — в тёмной теме чернила светлые
function inks(root) {
  const cs = getComputedStyle(root);
  return Object.fromEntries(SKETCH_COLORS.map((c) => [c.id, cs.getPropertyValue(c.css).trim() || '#26201C']));
}
// перо штриха; ластик выбивает уже нарисованное
function pen(ctx, stroke, color) {
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = stroke.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

export function LessonSketch() {
  const canvasRef = useRef(null);
  const strokes = useRef([]);
  const live = useRef(null);
  const wipeTimer = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('ink');
  const [count, setCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [cleared, setCleared] = useState(null);
  const [wiping, setWiping] = useState(false);
  const [tried, setTried] = useState(() => { try { return localStorage.getItem(TRIED_KEY) === '1'; } catch { return false; } });
  const reduced = useReducedMotion();
  const pick = useRef({ tool, color });
  pick.current = { tool, color };

  // холст — по размеру слоя урока и плотности экрана; весь черновик заново
  const paint = () => {
    const c = canvasRef.current;
    const root = c && c.parentElement;
    if (!root || !root.clientWidth) return;
    const w = root.clientWidth; const h = root.clientHeight; const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, 0);
    ctx.clearRect(-w / 2, 0, w, h);
    const ink = inks(root);
    for (const s of strokes.current) { pen(ctx, s, ink[s.color]); segmentsOf(s.points).forEach((seg) => trace(ctx, seg, s.size)); }
  };

  useEffect(() => {
    const c = canvasRef.current;
    const root = c && c.parentElement;
    if (!root) return undefined;
    const at = (e) => { const r = root.getBoundingClientRect(); return toLocal(e.clientX - r.left, e.clientY - r.top, root.clientWidth); };
    const piece = (k) => {
      const L = live.current; const ctx = c.getContext('2d');
      pen(ctx, L.s, L.ink); trace(ctx, pieceAt(L.s.points, k), L.s.size);
    };
    const down = (e) => {
      if (e.button !== 0 || e.pointerType === 'touch' || live.current || !onMargin(e, root)) return;
      e.preventDefault();
      const { tool: t, color: col } = pick.current;
      const s = { tool: t, color: col, size: t === 'eraser' ? SKETCH.eraser : SKETCH.pen, points: [] };
      addPoint(s, at(e));
      live.current = { s, id: e.pointerId, ink: inks(root)[col] };
      try { root.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
      root.dataset.sketching = 'true';
      paint();
      piece(0);
      setDrawing(true);
    };
    const move = (e) => {
      const L = live.current;
      if (!L || e.pointerId !== L.id) return;
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of (list.length ? list : [e])) if (addPoint(L.s, at(ev))) piece(L.s.points.length - 1);
    };
    const up = (e) => {
      const L = live.current;
      if (!L || e.pointerId !== L.id) return;
      live.current = null;
      delete root.dataset.sketching;
      strokes.current = pushStroke(strokes.current, L.s);
      paint();
      setCount(strokes.current.length); setDrawing(false); setCleared(null);
      setTried(true);
      try { localStorage.setItem(TRIED_KEY, '1'); } catch { /* нет хранилища */ }
    };
    // Ctrl+Z — убрать последний штрих (не когда печатают ответ: там своя отмена; и не при скрытом уроке)
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyZ' || typing(document.activeElement) || !strokes.current.length || !root.clientWidth) return;
      e.preventDefault();
      strokes.current = strokes.current.slice(0, -1);
      paint(); setCount(strokes.current.length);
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    // окно сменило размер или тему — черновик перерисовывается в новых размерах и цветах
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => paint()) : null;
    if (ro) ro.observe(root);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => paint()) : null;
    if (mo) mo.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      clearTimeout(wipeTimer.current);
      delete root.dataset.sketching;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // курсор над полями — перо или ластик
  useEffect(() => {
    const root = canvasRef.current && canvasRef.current.parentElement;
    if (!root) return undefined;
    root.dataset.sketch = tool;
    return () => { delete root.dataset.sketch; };
  }, [tool]);

  // «Вернуть» после «Стереть всё» — пять секунд
  useEffect(() => {
    if (!cleared) return undefined;
    const t = setTimeout(() => setCleared(null), 5000);
    return () => clearTimeout(t);
  }, [cleared]);

  const choose = (t, col = color) => { Audio.play('tick'); setTool(t); setColor(col); };
  const wipe = () => {
    if (!strokes.current.length || wiping) return;
    Audio.play('paper');
    const done = () => {
      setCleared(strokes.current);
      strokes.current = [];
      paint(); setCount(0); setWiping(false); setTool('pen');
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

  const bar = count > 0 || drawing || wiping || !!cleared;
  return (
    <>
      <canvas ref={canvasRef} className={`sk-canvas ${wiping ? 'wipe' : ''}`} aria-hidden="true" data-testid="sketch-canvas" data-strokes={count} />
      {bar ? (
        <div className="sk-bar" role="toolbar" aria-label="Черновик на полях" data-testid="sketch-bar">
          <button type="button" className="sk-tool" aria-pressed={tool === 'pen'} aria-label="Кисть" title="Кисть" data-testid="sketch-pen"
            style={{ '--c': `var(${SKETCH_COLORS.find((c) => c.id === color).css})` }} onClick={() => choose('pen')}><Brush size={19} aria-hidden="true" /></button>
          <button type="button" className="sk-tool" aria-pressed={tool === 'eraser'} aria-label="Ластик" title="Ластик" data-testid="sketch-eraser"
            onClick={() => choose('eraser')}><Eraser size={19} aria-hidden="true" /></button>
          <span className="sk-sep" aria-hidden="true" />
          {/* стёрто всё — вместо цветов «Вернуть»: панель не шире обычной и не наезжает на кнопку урока */}
          {cleared && !count
            ? <button type="button" className="sk-back" data-testid="sketch-restore" onClick={restore}><Undo2 size={17} aria-hidden="true" />Вернуть</button>
            : <>
              {SKETCH_COLORS.map((c) => (
                <button key={c.id} type="button" className="sk-dot" aria-pressed={tool === 'pen' && color === c.id} aria-label={c.label} title={c.label} data-testid={`sketch-color-${c.id}`}
                  style={{ '--c': `var(${c.css})` }} onClick={() => choose('pen', c.id)} />
              ))}
              <span className="sk-sep" aria-hidden="true" />
              <button type="button" className="sk-tool" aria-label="Стереть всё" title="Стереть всё" data-testid="sketch-clear" disabled={!count} onClick={wipe}><Trash2 size={19} aria-hidden="true" /></button>
            </>}
        </div>
      ) : !tried && (
        <div className="sk-hint" data-testid="sketch-hint"><PenLine size={16} aria-hidden="true" style={{ flexShrink: 0 }} />Поля — черновик: зажмите мышь и пишите</div>
      )}
    </>
  );
}
