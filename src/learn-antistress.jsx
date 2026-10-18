/* АНТИСТРЕСС — окошко в углу урока на ПК (docs/mechanics.md, «Антистресс»). Маленький экран, на
   который приятно поглядывать краем глаза, пока читаешь урок: шарик в кольце, сквозь кольца, битва
   цветов, маятники, лава-лампа, стая, песок, поп-ит, тетрис и змейка (каналы —
   learn-antistress-channels.js). Окошко
   перетаскивается в любой угол и тянется за внутренний уголок — но только по полю рядом с уроком и
   не выше 62 % окна: учиться оно не мешает. ○ сворачивает его в живой кружок, × скрывает (вернуть —
   сразу или в настройках). Открывается после четырёх уроков, в первый раз — со знакомством: урок
   тускнеет, окошко подсвечено. Только на ПК с мышью — там же, где черновик на полях. */
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Pause, Play, X, Circle, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCw, ArrowDownToLine,
  Move, MoveDiagonal2, Sparkles, Orbit, Target, Swords, Waves, Lamp, Fish, Hourglass, Grid3x3, Blocks, Worm,
} from 'lucide-react';
import { CHANNELS, W, H, paintChannel } from './learn-antistress-channels.js';
import { Button } from './ds.jsx';
import { Audio } from './MacroSimulator.jsx';

const KEY = {
  off: 'ems-antistress', min: 'ems-antistress-min', corner: 'ems-antistress-corner', ch: 'ems-antistress-ch',
  size: 'ems-antistress-size', intro: 'ems-antistress-intro', test: 'ems-antistress-test',
};
const stored = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* нет хранилища */ } };
// скрыт крестиком или в настройках; включили в настройках — снова развёрнут
export const antistressHidden = () => stored(KEY.off) === 'off';
export const setAntistressShown = (on) => { store(KEY.off, on ? null : 'off'); if (on) store(KEY.min, null); };
// автотесты: окошко не мешает чужим проверкам урока — только по флагу ems-antistress-test
export const antistressBlocked = () => typeof navigator !== 'undefined' && !!navigator.webdriver && stored(KEY.test) !== '1';

/* Окошко: экран W × H, увеличенный в k раз, плюс рамка 6 px и шапка. Кружок; отступ от края; слева
   внизу — над доком черновика. Крупнее, чем в 1,8 раза, окошко не бывает. */
const FRAME = { x: 12, y: 42 }; const BUBBLE = 58; const EDGE = 16; const DOCK = 124; const K_MAX = 1.8;
const CORNERS = ['tl', 'tr', 'bl', 'br'];
const ICONS = { ring: Orbit, rings: Target, battle: Swords, wave: Waves, lava: Lamp, flock: Fish, sand: Hourglass, pop: Grid3x3, tetris: Blocks, snake: Worm };
const PAD_ICONS = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown, turn: RotateCw };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spot(corner, vp, w, h) {
  return { left: corner[1] === 'l' ? EDGE : vp.w - w - EDGE, top: corner[0] === 't' ? EDGE : vp.h - h - (corner === 'bl' ? DOCK : EDGE) };
}
// насколько можно растянуть: поле рядом с колонкой урока и не выше 62 % окна
function roomOf(host) {
  const col = host && host.querySelector('.ln-body > .ln-inner');
  const cw = col ? col.getBoundingClientRect().width : 640;
  return Math.max(1, Math.min(K_MAX, ((window.innerWidth - cw) / 2 - 2 * EDGE - FRAME.x) / W, (window.innerHeight * 0.62 - FRAME.y) / H));
}

export const ANTISTRESS_CSS = `
  .ast { position: absolute; z-index: 5; border-radius: 20px; overflow: hidden; touch-action: none; user-select: none;
    border: 1px solid color-mix(in srgb, var(--ds-rule2) 75%, transparent); background: color-mix(in srgb, var(--ds-card) 78%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.6); backdrop-filter: blur(16px) saturate(1.6);
    box-shadow: 0 22px 46px -20px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 color-mix(in srgb, #fff 45%, transparent);
    transition: left .55s cubic-bezier(.2, .9, .3, 1.08), top .55s cubic-bezier(.2, .9, .3, 1.08), width .45s cubic-bezier(.2, .9, .3, 1), height .45s cubic-bezier(.2, .9, .3, 1),
      border-radius .45s, opacity .3s ease, transform .3s cubic-bezier(.2, .9, .3, 1.2), box-shadow .3s;
    animation: ast-in .7s cubic-bezier(.2, .9, .3, 1.15) .35s backwards; }
  .ds-dark .ast { box-shadow: 0 22px 46px -20px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 rgba(255, 255, 255, .07); }
  @keyframes ast-in { from { opacity: 0; transform: translateY(14px) scale(.9); } }
  .ast.drag { transition: width .45s, height .45s, border-radius .45s, transform .2s, box-shadow .2s; transform: scale(1.04); cursor: grabbing;
    box-shadow: 0 30px 60px -22px var(--ds-shade), 0 4px 14px -4px var(--ds-shade); }
  .ast.sizing, .ast.sizing .ast-screen { transition: none; }
  .ast.bye { opacity: 0; transform: scale(.86); }
  .ast-head { position: absolute; left: 6px; right: 6px; top: 4px; height: 30px; display: flex; align-items: center; gap: 1px; cursor: grab; transition: opacity .25s; }
  .ast-name { flex: 1; min-width: 0; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; border: none; border-radius: 9px;
    background: transparent; color: var(--ds-ink); cursor: pointer; font: 700 12.5px var(--ds-sans); transition: background .15s; }
  .ast-name:hover, .ast-name[aria-expanded="true"] { background: color-mix(in srgb, var(--ds-ink) 7%, transparent); }
  .ast-name span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: ast-name .4s cubic-bezier(.2, .9, .3, 1.2) backwards; }
  @keyframes ast-name { from { opacity: 0; transform: translateY(5px); } }
  .ast-btn { flex-shrink: 0; width: 24px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 9px; padding: 0;
    background: transparent; color: var(--ds-ink2); cursor: pointer; transition: background .15s, color .15s, transform .15s; }
  .ast-btn:hover { background: color-mix(in srgb, var(--ds-ink) 8%, transparent); color: var(--ds-ink); }
  .ast-btn:active { transform: scale(.9); }
  .ast-btn:focus-visible, .ast-name:focus-visible, .ast-pad button:focus-visible, .ast-open:focus-visible, .ast-menu button:focus-visible { outline: 2px solid var(--u); outline-offset: 1px; }
  .ast-gap { width: 4px; flex-shrink: 0; }
  .ast-screen { position: absolute; border-radius: 14px; overflow: hidden; background: #0f0d16; cursor: grab;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06); transform-origin: 50% 50%;
    transition: left .45s cubic-bezier(.2, .9, .3, 1), top .45s cubic-bezier(.2, .9, .3, 1), width .45s cubic-bezier(.2, .9, .3, 1), height .45s cubic-bezier(.2, .9, .3, 1),
      transform .45s cubic-bezier(.2, .9, .3, 1), border-radius .45s; }
  .ast-screen canvas { display: block; width: 100%; height: 100%; }
  /* переключение канала — короткая рябь, как у телевизора */
  .ast-tune { position: absolute; inset: 0; pointer-events: none; opacity: 0;
    background: repeating-linear-gradient(0deg, rgba(255, 255, 255, .16) 0 1px, transparent 1px 3px), radial-gradient(circle, rgba(255, 255, 255, .5), rgba(255, 255, 255, .05));
    animation: ast-tune .55s ease-out; }
  @keyframes ast-tune { from { opacity: 1; } }
  .ast-pause { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: rgba(255, 255, 255, .8);
    background: rgba(10, 8, 16, .35); animation: ast-fade .3s ease backwards; }
  .ast-pad { position: absolute; bottom: 8px; display: flex; gap: 6px; opacity: 0; transition: opacity .2s; }
  .ast-pad.l { left: 9px; } .ast-pad.r { right: 9px; }
  .ast:hover .ast-pad, .ast-pad:focus-within { opacity: 1; }
  .ast-pad button { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 9px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, .14); background: rgba(15, 13, 22, .55); color: #fff; transition: background .15s, transform .12s; }
  .ast-pad button:hover { background: rgba(255, 255, 255, .18); }
  .ast-pad button:active { transform: scale(.88); }
  /* меню каналов поверх экрана */
  .ast-menu { position: absolute; inset: 0; z-index: 2; display: grid; grid-template-columns: 1fr 1fr; align-content: center; gap: 4px; padding: 6px; cursor: default;
    background: rgba(15, 13, 22, .82); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: ast-fade .2s ease backwards; }
  .ast-menu button { height: 26px; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0 8px; border-radius: 8px; cursor: pointer; text-align: left; white-space: nowrap;
    border: 1px solid rgba(255, 255, 255, .1); background: rgba(255, 255, 255, .06); color: rgba(255, 255, 255, .88); font: 600 11.5px var(--ds-sans);
    animation: ast-name .3s cubic-bezier(.2, .9, .3, 1.2) backwards; transition: background .15s; }
  .ast-menu button:hover { background: rgba(255, 255, 255, .14); }
  .ast-menu button[aria-current="true"] { background: color-mix(in srgb, var(--u) 55%, transparent); border-color: transparent; color: #fff; }
  .ast-menu button svg { flex-shrink: 0; opacity: .8; }
  /* уголок растягивания — с внутренней стороны, у угла, противоположного прижатому */
  .ast-grip { position: absolute; z-index: 3; width: 16px; height: 16px; }
  .ast-grip::after { content: ''; position: absolute; width: 9px; height: 9px; opacity: 0; transition: opacity .2s; border: 0 solid color-mix(in srgb, var(--ds-ink) 45%, transparent); }
  .ast:hover .ast-grip::after, .ast.sizing .ast-grip::after { opacity: 1; }
  .ast-grip.tl { left: 0; top: 0; cursor: nwse-resize; } .ast-grip.tl::after { left: 4px; top: 4px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 6px; }
  .ast-grip.tr { right: 0; top: 0; cursor: nesw-resize; } .ast-grip.tr::after { right: 4px; top: 4px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 6px; }
  .ast-grip.bl { left: 0; bottom: 0; cursor: nesw-resize; } .ast-grip.bl::after { left: 4px; bottom: 4px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 6px; border-color: rgba(255, 255, 255, .55); }
  .ast-grip.br { right: 0; bottom: 0; cursor: nwse-resize; } .ast-grip.br::after { right: 4px; bottom: 4px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 6px; border-color: rgba(255, 255, 255, .55); }
  /* свёрнут — живой кружок: тот же экран, только мельче, по краю бежит радужное кольцо */
  .ast.min { width: ${BUBBLE}px; height: ${BUBBLE}px; border-radius: 50%; }
  .ast.min .ast-head, .ast.min .ast-grip { opacity: 0; pointer-events: none; visibility: hidden; transition: opacity .2s, visibility 0s .2s; }
  .ast.min .ast-screen { border-radius: 50%; }
  .ast-ring { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; opacity: 0; transition: opacity .3s;
    background: conic-gradient(#7DE3F4, #C9B6FC, #FBA5A5, #FBE38E, #8FEAB0, #7DE3F4);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
    animation: ast-spin 6s linear infinite; }
  .ast.min .ast-ring { opacity: 1; }
  @keyframes ast-spin { to { transform: rotate(1turn); } }
  .ast-open { position: absolute; inset: 0; border: none; padding: 0; border-radius: 50%; background: transparent; cursor: pointer; }
  .ast.min:hover { transform: scale(1.08); }
  .ast-snack { position: absolute; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px; white-space: nowrap;
    border: 1px solid color-mix(in srgb, var(--ds-rule2) 75%, transparent); background: color-mix(in srgb, var(--ds-card) 86%, transparent);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); box-shadow: 0 16px 34px -18px var(--ds-shade);
    font: 600 13px var(--ds-sans); color: var(--ds-ink2); animation: ast-in .4s cubic-bezier(.2, .9, .3, 1.2) backwards; }
  .ast-snack button { height: 30px; padding: 0 13px; border: none; border-radius: 999px; cursor: pointer; background: var(--ds-ink); color: var(--ds-paper); font: 700 13px var(--ds-sans); }

  /* знакомство: урок тускнеет, окошко — в светлом вырезе, рядом карточка */
  .ast-intro { position: absolute; inset: 0; z-index: 60; animation: ast-fade .5s ease backwards; }
  @keyframes ast-fade { from { opacity: 0; } }
  .ast-hole { position: absolute; border-radius: 28px; pointer-events: none; box-shadow: 0 0 0 200vmax rgba(12, 10, 20, .64); }
  .ast-hole::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; border: 2px solid color-mix(in srgb, var(--u) 80%, #fff);
    animation: ast-halo 1.8s ease-out .5s infinite; }
  @keyframes ast-halo { 0% { opacity: .9; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(1.09); } }
  .ast.tour .ast-tour { animation: ast-ping 1.6s ease-out .8s infinite; }
  .ast.tour .ast-grip::after { opacity: 1; }
  @keyframes ast-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--u) 70%, transparent); } 70%, 100% { box-shadow: 0 0 0 9px transparent; } }
  .ast-card { position: absolute; width: 340px; padding: 20px 20px 16px; border-radius: 22px; background: var(--ds-card); color: var(--ds-ink);
    box-shadow: 0 30px 60px -24px rgba(0, 0, 0, .55); animation: ast-card .55s cubic-bezier(.2, .9, .3, 1.2) .25s backwards; }
  @keyframes ast-card { from { opacity: 0; transform: translateY(12px) scale(.95); } }
  .ast-new { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--u); color: #fff; font: 800 12px var(--ds-sans); letter-spacing: .02em; }
  .ast-card h2 { margin: 10px 0 6px; font: 800 21px/1.15 var(--ds-head); letter-spacing: -.01em; }
  .ast-card p { margin: 0 0 12px; font: 500 14.5px/1.45 var(--ds-sans); color: var(--ds-ink2); }
  .ast-card ul { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 8px; }
  .ast-card li { display: flex; align-items: center; gap: 10px; font: 500 13.5px/1.35 var(--ds-sans); color: var(--ds-ink2); }
  .ast-card li b { color: var(--ds-ink); font-weight: 700; }
  .ast-key { flex-shrink: 0; min-width: 30px; height: 26px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;
    background: color-mix(in srgb, var(--ds-ink) 7%, transparent); color: var(--ds-ink); }
  @media (prefers-reduced-motion: reduce) {
    .ast, .ast-name span, .ast-tune, .ast-ring, .ast-snack, .ast-intro, .ast-card, .ast-hole::after, .ast.tour .ast-tour, .ast-pause, .ast-menu, .ast-menu button { animation: none; }
    .ast, .ast-screen { transition: opacity .2s; }
  }
`;

export function Antistress({ paused = false }) {
  const [phase, setPhase] = useState('on'); // on — окошко, bye — уходит, gone — «Антистресс скрыт · Вернуть», off — нет
  const [min, setMin] = useState(() => stored(KEY.min) === '1');
  const [corner, setCorner] = useState(() => (CORNERS.includes(stored(KEY.corner)) ? stored(KEY.corner) : 'br'));
  const [ch, setCh] = useState(() => Math.max(0, CHANNELS.findIndex((c) => c.id === stored(KEY.ch))));
  // при «уменьшить движение» канал стоит, пока его не запустят
  const [play, setPlay] = useState(() => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [intro, setIntro] = useState(false);
  const [menu, setMenu] = useState(false);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [size, setSize] = useState(() => clamp(Number(stored(KEY.size)) || 1, 1, K_MAX));
  const [room, setRoom] = useState(K_MAX);
  const [drag, setDrag] = useState(null);
  const [sizing, setSizing] = useState(false);
  const shell = useRef(null);
  const screen = useRef(null);
  const canvas = useRef(null);
  const sim = useRef(null);
  const dragged = useRef(false);
  const over = useRef(false);
  const C = CHANNELS[ch];
  const shown = phase === 'on' || phase === 'bye';
  const live = phase === 'on' && play && !paused;
  const k = clamp(size, 1, room);

  const paint = () => {
    const cv = canvas.current; const s = sim.current;
    if (!cv || !s) return;
    paintChannel(cv.getContext('2d'), s);
    const who = s.player ? s.player() : null;
    if (who && shell.current && shell.current.dataset.player !== who) shell.current.dataset.player = who;
  };
  const act = (a) => {
    if (!sim.current || !sim.current.input) return;
    sim.current.input(a);
    if (!live) paint();
  };

  useEffect(() => {
    const resize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); setRoom(roomOf(shell.current && shell.current.parentElement)); };
    resize();
    window.addEventListener('resize', resize);
    // первый раз — знакомство, когда урок уже на экране
    const t = stored(KEY.intro) ? 0 : setTimeout(() => setIntro(true), 700);
    return () => { window.removeEventListener('resize', resize); clearTimeout(t); };
  }, []);
  // экран: чёткий при любом увеличении
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const d = (window.devicePixelRatio || 1) * k;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    paint();
  }, [shown, k]); // eslint-disable-line react-hooks/exhaustive-deps
  // канал: свой мир с нуля и сразу первый кадр
  useEffect(() => {
    sim.current = C.make(Math.random);
    if (shell.current) delete shell.current.dataset.player;
    store(KEY.ch, C.id);
    paint();
  }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live) return undefined;
    let raf = 0; let last = 0;
    const tick = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      sim.current.step(dt); paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, ch]); // eslint-disable-line react-hooks/exhaustive-deps
  // игра со стрелок — пока мышь над окошком; уроку эти нажатия не достаются. Esc закрывает меню каналов
  useEffect(() => {
    if (phase !== 'on' || min || (!C.keys && !menu)) return undefined;
    const key = (e) => {
      if (menu && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setMenu(false); return; }
      const a = C.keys && C.keys[e.key];
      if (!a || !over.current || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); e.stopImmediatePropagation();
      act(a);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [ch, phase, min, menu]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase === 'bye') { const t = setTimeout(() => setPhase('gone'), 260); return () => clearTimeout(t); }
    if (phase === 'gone') { const t = setTimeout(() => setPhase('off'), 7000); return () => clearTimeout(t); }
    return undefined;
  }, [phase]);
  const closeIntro = () => { store(KEY.intro, '1'); setIntro(false); Audio.play('tick'); };
  useEffect(() => {
    if (!intro) return undefined;
    const key = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopImmediatePropagation();
      closeIntro();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [intro]); // eslint-disable-line react-hooks/exhaustive-deps

  const zap = (d) => { Audio.play('tick'); setMenu(false); setCh((i) => (i + d + CHANNELS.length) % CHANNELS.length); };
  const pick = (i) => { Audio.play('tick'); setMenu(false); setCh(i); };
  const fold = (v) => { Audio.play('tick'); setMenu(false); setMin(v); store(KEY.min, v ? '1' : null); };
  const hide = () => { Audio.play('paper'); store(KEY.off, 'off'); setPhase('bye'); };
  const restore = () => { Audio.play('tick'); store(KEY.off, null); setPhase('on'); };

  const sw = W * k + FRAME.x; const sh = H * k + FRAME.y;
  const box = min ? { w: BUBBLE, h: BUBBLE } : { w: sw, h: sh };
  // тянуть за грань и следить за мышью — по всему окну: быстрое движение не теряется
  const follow = (move, up) => {
    const done = (ev) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); up(ev); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', done); window.addEventListener('pointercancel', done);
  };
  /* Перетаскивание за любое место, кроме кнопок (за название канала и кружок — можно); отпустили —
     окошко едет в ближайший угол. У каналов, которые отвечают на мышь (песок, поп-ит), экран —
     для игры, а двигают окошко за шапку. */
  const onDown = (e) => {
    if (e.button !== 0 || intro) return;
    const b = e.target.closest('button');
    if (b && !b.classList.contains('ast-grab')) return;
    if (C.touch && !min && !menu && e.target.closest('.ast-screen')) {
      e.preventDefault();
      const r = screen.current.getBoundingClientRect();
      const at = (ev) => [(ev.clientX - r.left) / k, (ev.clientY - r.top) / k];
      const send = (type, ev) => { if (sim.current && sim.current.pointer) { sim.current.pointer(type, ...at(ev)); if (!live) paint(); } };
      send('down', e);
      follow((ev) => send('move', ev), (ev) => send('up', ev));
      return;
    }
    e.preventDefault();
    dragged.current = false;
    const r = shell.current.getBoundingClientRect();
    const g = { x: e.clientX, y: e.clientY, at: null };
    follow((ev) => {
      const dx = ev.clientX - g.x; const dy = ev.clientY - g.y;
      if (!g.at && Math.hypot(dx, dy) < 5) return;
      g.at = { left: clamp(r.left + dx, 4, vp.w - box.w - 4), top: clamp(r.top + dy, 4, vp.h - box.h - 4) };
      setDrag(g.at);
    }, () => {
      if (!g.at) return;
      // щелчок, который браузер пришлёт следом за перетаскиванием, ничего не открывает
      dragged.current = true;
      setTimeout(() => { dragged.current = false; }, 0);
      const cx = g.at.left + box.w / 2; const cy = g.at.top + box.h / 2;
      const next = `${cy < vp.h / 2 ? 't' : 'b'}${cx < vp.w / 2 ? 'l' : 'r'}`;
      Audio.play('tick');
      setCorner(next); store(KEY.corner, next); setDrag(null);
    });
  };
  // мышь просто над экраном — каналу, который её чувствует (рыбки шарахаются)
  const onHover = (e) => {
    if (!C.hover || min || menu || !sim.current || !sim.current.pointer) return;
    if (e.type === 'pointerleave') { sim.current.pointer('leave'); return; }
    const r = screen.current.getBoundingClientRect();
    sim.current.pointer('hover', (e.clientX - r.left) / k, (e.clientY - r.top) / k);
  };
  // растягивание за внутренний уголок: прижатый угол стоит, окошко растёт к уроку, но не дальше поля
  const onGrip = (e) => {
    if (e.button !== 0 || intro) return;
    e.preventDefault(); e.stopPropagation();
    const r = shell.current.getBoundingClientRect();
    const right = corner[1] === 'r'; const bottom = corner[0] === 'b';
    let next = k;
    setSizing(true); setMenu(false);
    follow((ev) => {
      const w = right ? r.right - ev.clientX : ev.clientX - r.left;
      const h = bottom ? r.bottom - ev.clientY : ev.clientY - r.top;
      next = clamp(Math.max((w - FRAME.x) / W, (h - FRAME.y) / H), 1, room);
      setSize(next);
    }, () => { setSizing(false); store(KEY.size, next > 1.01 ? next.toFixed(3) : null); });
  };

  if (phase === 'off') return null;
  const at = spot(corner, vp, box.w, box.h);
  if (phase === 'gone') {
    const side = corner[1] === 'l' ? { left: EDGE } : { right: EDGE };
    const edge = corner[0] === 't' ? { top: EDGE } : { bottom: corner === 'bl' ? DOCK : EDGE };
    return (
      <div className="ast-snack" role="status" data-testid="antistress-snack" style={{ ...side, ...edge }}>
        <style>{ANTISTRESS_CSS}</style>
        Антистресс скрыт — вернуть можно в настройках
        <button type="button" data-testid="antistress-restore" onClick={restore}>Вернуть</button>
      </div>
    );
  }
  const pos = drag || at;
  const full = spot(corner, vp, sw, sh);
  // внутренний уголок — напротив прижатого
  const grip = `${corner[0] === 't' ? 'b' : 't'}${corner[1] === 'l' ? 'r' : 'l'}`;
  const screenAt = min
    ? { left: (BUBBLE - W * k) / 2, top: (BUBBLE - H * k) / 2, width: W * k, height: H * k, transform: `scale(${0.44 / k})` }
    : { left: 6, top: 36, width: W * k, height: H * k, transform: 'scale(1)' };
  const cardAt = {
    ...(corner[1] === 'r' ? { right: vp.w - full.left + 22 } : { left: full.left + sw + 22 }),
    ...(corner[0] === 'b' ? { bottom: vp.h - full.top - sh } : { top: full.top }),
  };
  return (
    <>
      <style>{ANTISTRESS_CSS}</style>
      <section ref={shell} className={`ast${min ? ' min' : ''}${drag ? ' drag' : ''}${sizing ? ' sizing' : ''}${phase === 'bye' ? ' bye' : ''}${intro ? ' tour' : ''}`}
        style={{ left: pos.left, top: pos.top, ...(min ? null : { width: sw, height: sh }) }} aria-label={`Антистресс: ${C.title}`} data-testid="antistress"
        data-channel={C.id} data-min={String(min)} data-corner={corner} data-playing={String(live)} data-size={k.toFixed(2)}
        onPointerDown={onDown} onPointerEnter={() => { over.current = true; }} onPointerLeave={() => { over.current = false; }}>
        <div className="ast-head" inert={min}>
          <button type="button" className="ast-btn" aria-label="Предыдущий канал" title="Предыдущий канал" data-testid="antistress-prev" onClick={() => zap(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" className="ast-name ast-grab ast-tour" aria-haspopup="true" aria-expanded={menu} title="Все каналы" data-testid="antistress-name"
            onClick={() => { if (dragged.current) return; Audio.play('tick'); setMenu(!menu); }}>
            <span key={C.id}>{C.title}</span>
          </button>
          <button type="button" className="ast-btn ast-tour" aria-label="Следующий канал" title="Следующий канал" data-testid="antistress-next" onClick={() => zap(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          <span className="ast-gap" />
          <button type="button" className="ast-btn" aria-label={play ? 'Пауза' : 'Запустить'} title={play ? 'Пауза' : 'Запустить'} data-testid="antistress-play" onClick={() => { Audio.play('tick'); setPlay(!play); }}>
            {play ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          </button>
          <button type="button" className="ast-btn ast-tour" aria-label="Свернуть в кружок" title="Свернуть в кружок" data-testid="antistress-min" onClick={() => fold(true)}><Circle size={13} strokeWidth={2.6} aria-hidden="true" /></button>
          <button type="button" className="ast-btn ast-tour" aria-label="Скрыть антистресс" title="Скрыть — вернуть можно в настройках" data-testid="antistress-hide" onClick={hide}><X size={16} aria-hidden="true" /></button>
        </div>
        <div ref={screen} className="ast-screen" style={{ ...screenAt, cursor: C.touch && !min ? (C.id === 'sand' ? 'crosshair' : 'pointer') : undefined }}
          onPointerMove={onHover} onPointerLeave={onHover}>
          <canvas ref={canvas} aria-hidden="true" data-testid="antistress-canvas" />
          <span key={ch} className="ast-tune" aria-hidden="true" />
          {!play && !min && <span className="ast-pause" aria-hidden="true"><Play size={30} fill="currentColor" /></span>}
          {C.pad && !min && C.pad.map((group, gi) => (
            <div key={`${C.id}-${gi}`} className={`ast-pad ${gi ? 'r' : 'l'}`} role="group" aria-label={`${C.title}: управление`}>
              {group.map(([a, label]) => {
                const PadIcon = a === 'down' && C.id === 'tetris' ? ArrowDownToLine : PAD_ICONS[a];
                return <button key={a} type="button" aria-label={label} title={label} data-testid={`antistress-pad-${a}`} onClick={() => act(a)}><PadIcon size={15} aria-hidden="true" /></button>;
              })}
            </div>
          ))}
          {menu && !min && (
            <div className="ast-menu" role="menu" aria-label="Каналы" data-testid="antistress-menu" onPointerDown={(e) => { if (e.target === e.currentTarget) setMenu(false); }}>
              {CHANNELS.map((c, i) => {
                const I = ICONS[c.id];
                return (
                  <button key={c.id} type="button" role="menuitem" aria-current={i === ch} data-testid="antistress-pick" data-channel={c.id} style={{ animationDelay: `${i * 25}ms` }}
                    onClick={() => pick(i)}><I size={14} aria-hidden="true" />{c.title}</button>
                );
              })}
            </div>
          )}
        </div>
        {!min && <span className={`ast-grip ${grip}`} aria-hidden="true" title="Потяните — окошко станет больше" data-testid="antistress-grip" onPointerDown={onGrip} />}
        <span className="ast-ring" aria-hidden="true" />
        {min && <button type="button" className="ast-open ast-grab" aria-label={`Развернуть антистресс: ${C.title}`} title="Развернуть" data-testid="antistress-expand" onClick={() => { if (!dragged.current) fold(false); }} />}
      </section>
      {intro && !min && phase === 'on' && (
        <div className="ast-intro" role="dialog" aria-modal="true" aria-labelledby="ast-intro-title" data-testid="antistress-intro">
          <div className="ast-hole" style={{ left: full.left - 8, top: full.top - 8, width: sw + 16, height: sh + 16 }} />
          <div className="ast-card" style={cardAt}>
            <span className="ast-new"><Sparkles size={13} aria-hidden="true" />Новое</span>
            <h2 id="ast-intro-title">Антистресс</h2>
            <p>Маленькое окошко, на которое приятно поглядывать, пока читаете урок. Кольца, битва цветов, маятники, лава-лампа и стая — просто смотреть; песок, поп-ит, тетрис и змейка — можно и поиграть.</p>
            <ul>
              <li><span className="ast-key"><ChevronLeft size={15} aria-hidden="true" /><ChevronRight size={15} aria-hidden="true" /></span><span><b>Каналы</b> — стрелками или нажмите на название</span></li>
              <li><span className="ast-key"><MoveDiagonal2 size={14} aria-hidden="true" /></span><span>Потяните за <b>уголок</b> — окошко станет больше</span></li>
              <li><span className="ast-key"><Circle size={12} strokeWidth={2.6} aria-hidden="true" /></span><span><b>Свернуть</b> в маленький кружок</span></li>
              <li><span className="ast-key"><X size={15} aria-hidden="true" /></span><span><b>Скрыть</b> совсем — вернуть можно в настройках</span></li>
              <li><span className="ast-key"><Move size={14} aria-hidden="true" /></span><span>Окошко можно <b>перетащить</b> в любой угол</span></li>
            </ul>
            <Button wide onClick={closeIntro} autoFocus data-testid="antistress-intro-ok">Понятно</Button>
          </div>
        </div>
      )}
    </>
  );
}
