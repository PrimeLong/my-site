/* ПЫЛЬНАЯ ВИТРИНА — мини-игра лавки (src/learn/dust.js, docs/mechanics.md, «Лавка»). Ночная лавка,
   латунная витрина, за стеклом под лампой — Инфля в новинке витрины дня и ценник; стекло в пыли, в углу
   паутина, пальцем выведено «протри». Тряпка-микрофибра ходит за мышью или пальцем и стирает пыль
   мягкой кистью; пыль сыплется облачками. Чисто на 100% — по стеклу пробегает блик, искры, монеты.
   Холст рисует пыль, сетка (src/learn/dust.js) считает, сколько протёрто, — они стирают одинаково.
   Клавиатура: Enter или пробел на стекле — протереть очередную полосу. Отдельный ленивый чанк. */
import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, RotateCcw, Store, Coins } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Mascot } from './mascot.jsx';
import { Button } from './ds.jsx';
import { CoinShower, useReducedMotion } from './ds-art.jsx';
import { DUST, dustLeft, dustDone, dustClaim, dustItem, dustGrid, wipeAt, stampsAlong, cleanShare, shownPercent } from './learn/dust.js';
import { OUTFIT_BY_ID, priceOf, coinsWord, outfitOf } from './learn/rewards.js';
import { dayOf } from './textbook/learn-state.js';

const CSS = `
  .dg { position: fixed; inset: 0; z-index: 330; overflow-y: auto; overscroll-behavior: contain; color: #F6EEE2; padding: 14px 16px 32px;
    background: radial-gradient(120% 70% at 50% 0%, #4A3628 0%, #21180F 55%, #120D09 100%); animation: dg-in .35s ease-out; }
  @keyframes dg-in { from { opacity: 0 } }
  .dg-wrap { width: min(420px, 100%); margin: 0 auto; }
  .dg-top { display: flex; align-items: center; gap: 12px; }
  .dg-x { flex: none; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(246,238,226,.25); background: rgba(246,238,226,.08); color: inherit; display: grid; place-items: center; cursor: pointer; }
  .dg-x:hover { background: rgba(246,238,226,.16); }
  .dg-h { flex: 1; min-width: 0; }
  .dg-h b { display: block; font: 700 21px/1.15 var(--ds-head, Georgia, serif); letter-spacing: .01em; }
  .dg-h span { display: block; margin-top: 2px; font: 500 13.5px/1.35 var(--ds-sans, sans-serif); color: rgba(246,238,226,.72); }
  .dg-meter { flex: none; min-width: 74px; padding: 7px 12px; border-radius: 999px; text-align: center; font: 800 14px var(--ds-sans, sans-serif); font-variant-numeric: tabular-nums;
    background: rgba(246,238,226,.1); border: 1px solid rgba(233,194,90,.45); color: #F3D98E; position: relative; overflow: hidden; }
  .dg-meter i { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(233,194,90,.22); transition: width .25s ease-out; }
  .dg-meter span { position: relative; }
  .dg-case { position: relative; width: 100%; aspect-ratio: 4 / 5; margin: 16px 0 0; padding: 12px; border-radius: 26px;
    background: linear-gradient(145deg, #E2C084, #8A6532 32%, #D9B97D 55%, #6E4B22 100%);
    box-shadow: 0 34px 60px -24px rgba(0,0,0,.85), inset 0 2px 0 rgba(255,255,255,.4), inset 0 -3px 0 rgba(0,0,0,.3); }
  .dg-case::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 34%; height: 18px; transform: translateX(-50%); border-radius: 0 0 12px 12px;
    background: linear-gradient(#7A5426, #4E3416); box-shadow: 0 6px 14px rgba(0,0,0,.5); }
  .dg-glass { position: relative; width: 100%; height: 100%; border-radius: 16px; overflow: hidden; isolation: isolate;
    background: radial-gradient(75% 55% at 50% 30%, #FFF8E8 0%, #F5E2BD 42%, #C6A472 100%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.3), inset 0 0 50px rgba(80,50,10,.35); }
  .dg-lamp { position: absolute; left: 50%; top: -6%; width: 70%; height: 60%; transform: translateX(-50%); background: radial-gradient(closest-side, rgba(255,250,235,.85), transparent); pointer-events: none; }
  .dg-stand { position: absolute; left: 22%; right: 22%; bottom: 12%; height: 8%; border-radius: 50%; background: radial-gradient(60% 60% at 50% 40%, #C79C5E, #7B5A30); box-shadow: 0 12px 20px -8px rgba(0,0,0,.5); }
  .dg-item { position: absolute; left: 50%; bottom: 17%; transform: translateX(-50%); line-height: 0; }
  .dg-tag { position: absolute; right: 7%; top: 8%; transform: rotate(7deg); transform-origin: 70% -20px; max-width: 46%; padding: 7px 10px 8px; border-radius: 6px;
    background: #FFFBF2; color: #3A2A14; font: 600 12px/1.25 var(--ds-sans, sans-serif); box-shadow: 0 6px 12px -6px rgba(0,0,0,.45); }
  .dg-tag::before { content: ''; position: absolute; left: 50%; top: -22px; height: 22px; border-left: 1px solid rgba(58,42,20,.5); }
  .dg-tag::after { content: ''; position: absolute; left: calc(50% - 4px); top: 5px; width: 6px; height: 6px; border-radius: 50%; background: #C6A472; }
  .dg-tag b { display: block; margin-top: 4px; font: 800 14px var(--ds-sans, sans-serif); color: #8A5A12; }
  .dg-glare { position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(115deg, transparent 28%, rgba(255,255,255,.32) 31%, transparent 37%, transparent 56%, rgba(255,255,255,.16) 58%, transparent 63%); }
  .dg-dust, .dg-fx { position: absolute; inset: 0; width: 100%; height: 100%; }
  .dg-dust { touch-action: none; cursor: none; transition: opacity .7s ease-out; outline: none; }
  .dg-dust:focus-visible { box-shadow: inset 0 0 0 3px #F3D98E; }
  .dg-dust.gone { opacity: 0; pointer-events: none; }
  .dg-fx { pointer-events: none; }
  .dg-rag { position: absolute; left: 0; top: 0; width: 60px; height: 46px; margin: -22px 0 0 -30px; pointer-events: none; opacity: 0; transition: opacity .15s; filter: drop-shadow(0 6px 6px rgba(0,0,0,.35)); }
  .dg-rag.on { opacity: 1; }
  .dg-shine { position: absolute; top: -20%; bottom: -20%; left: -60%; width: 38%; pointer-events: none; transform: skewX(-18deg);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); animation: dg-sweep 1.1s cubic-bezier(.4, 0, .2, 1) forwards; }
  @keyframes dg-sweep { to { left: 130%; } }
  .dg-foot { margin-top: 24px; text-align: center; font: 500 14px/1.45 var(--ds-sans, sans-serif); color: rgba(246,238,226,.78); }
  .dg-foot b { color: #F3D98E; }
  .dg-res { position: relative; margin-top: 22px; padding: 18px 18px 16px; border-radius: 22px; text-align: center; overflow: hidden;
    background: linear-gradient(160deg, rgba(246,238,226,.12), rgba(246,238,226,.04)); border: 1px solid rgba(233,194,90,.35); animation: dg-up .45s cubic-bezier(.2, 1.2, .4, 1) backwards; }
  @keyframes dg-up { from { opacity: 0; transform: translateY(14px) } }
  .dg-res h3 { margin: 4px 0 2px; font: 700 22px var(--ds-head, Georgia, serif); }
  .dg-res p { margin: 6px 0 0; font: 500 14.5px/1.45 var(--ds-sans, sans-serif); color: rgba(246,238,226,.8); }
  .dg-coins { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; padding: 7px 16px 7px 8px; border-radius: 999px; background: #F3D98E; color: #3A2A04; font: 800 17px var(--ds-sans, sans-serif); animation: dg-pop .5s cubic-bezier(.3, 1.6, .5, 1) .15s backwards; }
  .dg-coins i { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-style: normal; color: #7A5408; background: radial-gradient(circle at 35% 30%, #FFF0B8, #D9A93A); box-shadow: inset 0 0 0 2px #B98A1E; }
  @keyframes dg-pop { from { transform: scale(.4); opacity: 0 } }
  .dg-acts { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 16px; }
  .dg .ds-coins { position: fixed; }
  @media (prefers-reduced-motion: reduce) { .dg, .dg-res, .dg-coins, .dg-shine { animation: none; } .dg-shine { display: none; } .dg-dust { transition: none; } }
`;

// повторяемый шум: одно зерно — одна и та же пыль
const rng = (seed) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// пыль: тёплая серая пелена, облака светлее и темнее, пылинки, ворсинки, паутина в углу, «протри» пальцем
function paintDust(ctx, w, h, seed) {
  const r = rng(seed);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, 0, w * 0.35, h);
  g.addColorStop(0, 'rgba(190,178,158,0.95)'); g.addColorStop(1, 'rgba(156,144,124,0.98)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i += 1) {
    const x = r() * w; const y = r() * h; const rad = (0.05 + r() * 0.16) * w; const dark = r() < 0.5;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, dark ? `rgba(108,96,78,${0.12 + r() * 0.2})` : `rgba(216,207,190,${0.14 + r() * 0.22})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < (w * h) / 170; i += 1) {
    ctx.fillStyle = r() < 0.6 ? `rgba(92,82,66,${0.15 + r() * 0.35})` : `rgba(238,231,218,${0.2 + r() * 0.4})`;
    const s = 0.6 + r() * 1.5; ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  for (let i = 0; i < 26; i += 1) {
    const x = r() * w; const y = r() * h; const a = r() * Math.PI * 2; const l = 6 + r() * 14;
    ctx.strokeStyle = `rgba(78,68,56,${0.25 + r() * 0.3})`;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // паутина: из верхнего угла — лучи и провисшие дуги
  const left = r() < 0.5; const cx = left ? 0 : w; const sg = left ? 1 : -1; const R = w * 0.3;
  const angs = Array.from({ length: 6 }, (_, i) => (i / 5) * (Math.PI / 2));
  ctx.strokeStyle = 'rgba(246,242,234,0.6)'; ctx.lineWidth = 0.9;
  angs.forEach((a) => { ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + sg * Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); });
  for (let k = 1; k <= 5; k += 1) {
    const rr = (k / 5) * R * 0.95;
    ctx.beginPath();
    angs.forEach((a, i) => {
      const px = cx + sg * Math.cos(a) * rr; const py = Math.sin(a) * rr;
      if (!i) { ctx.moveTo(px, py); return; }
      const m = (a + angs[i - 1]) / 2;
      ctx.quadraticCurveTo(cx + sg * Math.cos(m) * rr * 0.86, Math.sin(m) * rr * 0.86, px, py);
    });
    ctx.stroke();
  }
  // где пыль тоньше: «протри», выведенное пальцем, и пара старых разводов
  ctx.globalCompositeOperation = 'destination-out';
  ctx.save(); ctx.translate(w * 0.4, h * 0.31); ctx.rotate(-0.08);
  ctx.font = `700 ${Math.round(w * 0.12)}px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.016; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText('протри', 0, 0);
  ctx.restore();
  for (let i = 0; i < 2; i += 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = w * (0.06 + r() * 0.05);
    ctx.beginPath(); const y = h * (0.25 + r() * 0.4);
    ctx.moveTo(-10, y); ctx.bezierCurveTo(w * 0.3, y - h * 0.1, w * 0.6, y + h * 0.12, w + 10, y - h * 0.05); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
// мазок тряпки: мягкая круглая кисть, в середине стирает DUST.wipe пыли, к краю — ничего
function stamp(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${DUST.wipe})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// звёздочка-искра
function star(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) { const a = (i * Math.PI) / 4; const l = i % 2 ? s * 0.32 : s; ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
  ctx.closePath(); ctx.fill();
}

const Rag = () => (
  <svg viewBox="0 0 60 46" width="60" height="46" aria-hidden="true">
    <path d="M6 12 Q3 4 12 4 L46 3 Q57 3 56 13 L55 33 Q55 43 45 42 L13 43 Q4 43 5 33 Z" fill="#3B8DB0" />
    <path d="M10 10 L50 9 L49 36 L12 37 Z" fill="none" stroke="#9FD3E8" strokeWidth="1.2" strokeDasharray="3 2.5" opacity=".8" />
    <path d="M14 18 Q28 13 46 17 M13 27 Q30 23 47 28" fill="none" stroke="#2A6F8E" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
    <path d="M8 13 Q10 7 18 7" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".45" />
  </svg>
);

export default function DustGame({ learn, update, onClose, onShowcase = null }) {
  const reduced = useReducedMotion();
  const day = dayOf(Date.now());
  const [n, setN] = useState(() => dustDone(learn));
  const [seed, setSeed] = useState(() => (Date.now() % 100000) + 7);
  const [phase, setPhase] = useState('play');
  const [pct, setPct] = useState(0);
  const [size, setSize] = useState(null);
  const [paid, setPaid] = useState(0);
  const glass = useRef(null); const dust = useRef(null); const fx = useRef(null); const rag = useRef(null);
  const grid = useRef(null); const down = useRef(null); const phaseRef = useRef('play'); const pctRef = useRef(0);
  const parts = useRef([]); const raf = useRef(0); const lastSound = useRef(0); const keyRow = useRef(0); const tilt = useRef(0);
  const left = dustLeft(learn);
  const item = dustItem(learn, day, n);
  const o = item ? OUTFIT_BY_ID[item] : null;
  const outfit = o ? { [o.slot]: item } : outfitOf(learn);

  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // размер стекла — при открытии; пыль рисуется заново на каждую витрину
  useEffect(() => {
    const el = glass.current; if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);
  useEffect(() => {
    if (!size || !dust.current) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    [dust.current, fx.current].forEach((c) => { c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr); c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); });
    const ctx = dust.current.getContext('2d');
    paintDust(ctx, size.w, size.h, seed);
    let img = null;
    try { img = ctx.getImageData(0, 0, dust.current.width, dust.current.height); } catch { img = null; }
    const cw = dust.current.width; const ch = dust.current.height;
    grid.current = dustGrid(size.w, size.h, 8, (x, y) => {
      if (!img) return 1;
      const px = Math.min(cw - 1, Math.floor(x * dpr)); const py = Math.min(ch - 1, Math.floor(y * dpr));
      return img.data[(py * cw + px) * 4 + 3] / 255;
    });
    keyRow.current = 0; pctRef.current = 0; setPct(0);
  }, [size, seed]);

  // частицы: пыль сыплется и тает, искры всплывают
  const runFx = () => {
    if (raf.current || !fx.current) return;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const ctx = fx.current && fx.current.getContext('2d');
      if (!ctx || !size) { raf.current = 0; return; }
      ctx.clearRect(0, 0, size.w, size.h);
      parts.current = parts.current.filter((p) => (p.life -= dt) > 0);
      parts.current.forEach((p) => {
        p.vy += (p.star ? -30 : 260) * dt; p.vx *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, p.life / p.max);
        if (p.star) { ctx.fillStyle = `rgba(255,${226 + Math.round(29 * a)},150,${a})`; star(ctx, p.x, p.y, p.s * (0.6 + a * 0.6)); }
        else { ctx.fillStyle = `rgba(206,193,170,${a * 0.85})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); }
      });
      raf.current = parts.current.length ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };
  const puff = (x, y, vx) => {
    if (reduced || parts.current.length > 180) return;
    for (let i = 0; i < 2; i += 1) parts.current.push({ x, y, vx: vx * 0.25 + (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 50, s: 0.8 + Math.random() * 1.8, life: 0.6 + Math.random() * 0.5, max: 1.1 });
    runFx();
  };
  const sparkle = () => {
    if (reduced || !size) return;
    for (let i = 0; i < 26; i += 1) {
      const a = Math.random() * Math.PI * 2; const d = size.w * (0.1 + Math.random() * 0.35);
      parts.current.push({ star: true, x: size.w / 2 + Math.cos(a) * d, y: size.h * 0.5 + Math.sin(a) * d * 1.1, vx: Math.cos(a) * 30, vy: -20 - Math.random() * 40, s: 4 + Math.random() * 6, life: 0.7 + Math.random() * 0.8, max: 1.5 });
    }
    runFx();
  };

  const finish = () => {
    phaseRef.current = 'shine'; setPhase('shine'); setPct(100);
    const pay = dustLeft(learn) > 0;
    if (pay) update((s) => dustClaim(s, Date.now()), { settle: true });
    setPaid(pay ? DUST.coins : 0);
    Audio.play(pay ? 'coin' : 'up');
    try { if (navigator.vibrate) navigator.vibrate(14); } catch { /* нет вибрации */ }
    sparkle();
    setTimeout(() => { phaseRef.current = 'done'; setPhase('done'); }, reduced ? 0 : 950);
  };
  // протереть: от прошлой точки до новой (или одно касание) — и холст, и сетка
  const wipeTo = (p, from) => {
    const g = grid.current; const ctx = dust.current && dust.current.getContext('2d');
    if (!g || !ctx || phaseRef.current !== 'play') return;
    const R = size.w * 0.085;
    const pts = from ? stampsAlong(from.x, from.y, p.x, p.y, R) : [[p.x, p.y]];
    const col = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell))); const row = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell)));
    const dusty = g.v[row * g.cols + col] > DUST.thr;
    ctx.globalCompositeOperation = 'destination-out';
    pts.forEach(([x, y]) => { stamp(ctx, x, y, R); wipeAt(g, x, y, R); });
    ctx.globalCompositeOperation = 'source-over';
    if (dusty) {
      puff(p.x, p.y, from ? (p.x - from.x) * 20 : 0);
      const t = performance.now();
      if (t - lastSound.current > 420) { lastSound.current = t; Audio.play('paper'); }
    }
    const share = cleanShare(g);
    const shown = shownPercent(share);
    if (shown !== pctRef.current) { pctRef.current = shown; setPct(shown); }
    if (share >= DUST.clean) finish();
  };
  const at = (e) => {
    const rect = dust.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * size.w) / rect.width, y: ((e.clientY - rect.top) * size.h) / rect.height };
  };
  const moveRag = (p, from) => {
    const el = rag.current; if (!el) return;
    if (from) tilt.current = tilt.current * 0.7 + Math.max(-22, Math.min(22, (p.x - from.x) * 1.2)) * 0.3;
    el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${tilt.current.toFixed(1)}deg)`;
    el.classList.add('on');
  };
  const onDown = (e) => {
    if (phaseRef.current !== 'play' || !size) return;
    e.preventDefault();
    try { dust.current.setPointerCapture(e.pointerId); } catch { /* без захвата */ }
    const p = at(e); down.current = p; moveRag(p, null); wipeTo(p, null);
  };
  const onMove = (e) => {
    if (!size) return;
    const p = at(e); moveRag(p, down.current || p);
    if (!down.current) return;
    wipeTo(p, down.current); down.current = p;
  };
  const onUp = () => { down.current = null; };
  const onLeave = (e) => { if (e.pointerType === 'mouse' && rag.current) rag.current.classList.remove('on'); };
  // клавиатура: полоса за полосой сверху вниз, по два прохода
  const onKey = (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || phaseRef.current !== 'play' || !size) return;
    e.preventDefault();
    const R = size.w * 0.085; const y = R * 0.7 + keyRow.current * R * 1.1;
    keyRow.current = y + R * 1.1 > size.h + R ? 0 : keyRow.current + 1;
    for (let pass = 0; pass < 2 && phaseRef.current === 'play'; pass += 1) wipeTo({ x: size.w + R, y }, { x: -R, y });
  };
  const again = () => {
    Audio.play('paper');
    phaseRef.current = 'play'; setPhase('play'); setPaid(0);
    setN((k) => k + 1); setSeed((s) => s + 101);
  };

  const price = item ? priceOf(item, day, learn) : 0;
  const mascot = size ? Math.round(size.w * 0.5) : 150;
  return (
    <div className="dg" role="dialog" aria-label="Пыльная витрина" data-testid="dust-game" data-phase={phase}>
      <style>{CSS}</style>
      <div className="dg-wrap">
        <div className="dg-top">
          <button type="button" className="dg-x" aria-label="Закрыть витрину" data-testid="dust-close" onClick={() => { Audio.play('paper'); onClose(); }}><X size={20} /></button>
          <div className="dg-h"><b>Пыльная витрина</b><span>{phase === 'play' ? 'Протрите стекло — мышью или пальцем' : 'Стекло блестит'}</span></div>
          <div className="dg-meter" data-testid="dust-percent" data-value={pct} aria-live="polite"><i style={{ width: `${pct}%` }} /><span>{pct}%</span></div>
        </div>
        <div className="dg-case">
          <div className="dg-glass" ref={glass}>
            <div className="dg-lamp" aria-hidden="true" />
            <div className="dg-stand" aria-hidden="true" />
            <div className="dg-item"><Mascot mood={phase === 'play' ? 'hello' : 'joy'} size={mascot} outfit={outfit} label={o ? `Инфля: ${o.title}` : 'Инфля'} /></div>
            {o && <div className="dg-tag" data-testid="dust-tag">{o.title}<b>{price} мон.</b></div>}
            <div className="dg-glare" aria-hidden="true" />
            <canvas ref={dust} className={`dg-dust${phase === 'play' ? '' : ' gone'}`} tabIndex={phase === 'play' ? 0 : -1} data-testid="dust-glass"
              role="img" aria-label="Пыльное стекло витрины. Протрите его мышью или пальцем; с клавиатуры — Enter или пробел протирает полосу."
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onLeave} onKeyDown={onKey} />
            <canvas ref={fx} className="dg-fx" aria-hidden="true" />
            <div ref={rag} className="dg-rag" aria-hidden="true"><Rag /></div>
            {phase !== 'play' && !reduced && <div className="dg-shine" aria-hidden="true" />}
          </div>
        </div>
        {phase === 'play' && (
          <div className="dg-foot" data-testid="dust-hint">
            {left > 0
              ? <>За чистую витрину — <b>{DUST.coins} {coinsWord(DUST.coins)}</b>. Сегодня ещё {left} из {DUST.perDay}.</>
              : <>Монеты за сегодня собраны — завтра витрины снова запылятся. А протирать можно и просто так.</>}
          </div>
        )}
        {phase === 'done' && (
          <div className="dg-res" data-testid="dust-result" data-paid={paid}>
            <Sparkles size={26} color="#F3D98E" aria-hidden="true" />
            <h3>Блестит!</h3>
            {paid > 0 && <div className="dg-coins" data-testid="dust-coins"><i aria-hidden="true"><Coins size={15} /></i>+{paid} {coinsWord(paid)}</div>}
            <p>{o ? <>За стеклом — Инфля в «{o.title}». На витрине дня — {price} мон.</> : 'Витрина как новая.'}</p>
            <p style={{ fontSize: 13 }}>{dustLeft(learn) > 0 ? `Сегодня можно протереть ещё ${dustLeft(learn)} из ${DUST.perDay}.` : 'Монеты за сегодня собраны — дальше только ради удовольствия.'}</p>
            <div className="dg-acts">
              <Button variant="secondary" icon={RotateCcw} onClick={again} data-testid="dust-again">Ещё витрина</Button>
              {o && onShowcase && <Button icon={Store} onClick={() => { Audio.play('paper'); onShowcase(); }} data-testid="dust-showcase">К витрине</Button>}
            </div>
            {paid > 0 && <CoinShower seed={seed} n={16} />}
          </div>
        )}
      </div>
    </div>
  );
}
