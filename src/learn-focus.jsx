/* УГОЛОК ДЛЯ ФОКУСА — окошко в углу урока на ПК (docs/mechanics.md, «Уголок для фокуса»). Как видео
   в углу у стримеров: пока читаешь и слушаешь урок, глазу есть за что зацепиться, а голова остаётся
   в уроке — тем, кому трудно удерживать внимание, так легче. Картинка — из формул, а не из рисунков
   (learn/focus.js): шарик в кольце, маятниковая волна и тетрис, который играет сам, — его можно
   перехватить. Окошко перетаскивается в любой угол, ○ сворачивает его в живой кружок, × скрывает
   (вернуть — сразу или в настройках). Открывается после четырёх уроков, в первый раз — со
   знакомством: урок тускнеет, окошко подсвечено. Только на ПК с мышью — там же, где черновик на полях. */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X, Circle, ArrowLeft, ArrowRight, RotateCw, ArrowDownToLine, Move, Sparkles } from 'lucide-react';
import {
  RING, newBall, stepBall, gapAt, PEND, pendulumAngle, pendulumAlign,
  TET, PIECES, emptyBoard, cellsOf, fits, spawn, shift, turn, fall, lock, clearLines, bag, bestMove,
} from './learn/focus.js';
import { Button } from './ds.jsx';
import { Audio } from './MacroSimulator.jsx';

const KEY = { off: 'ems-focus', min: 'ems-focus-min', corner: 'ems-focus-corner', ch: 'ems-focus-ch', intro: 'ems-focus-intro', test: 'ems-focus-test' };
const stored = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* нет хранилища */ } };
// скрыт крестиком или в настройках; включили в настройках — снова развёрнут
export const focusHidden = () => stored(KEY.off) === 'off';
export const setFocusShown = (on) => { store(KEY.off, on ? null : 'off'); if (on) store(KEY.min, null); };
// автотесты: окошко не мешает чужим проверкам урока — только по флагу ems-focus-test
export const focusBlocked = () => typeof navigator !== 'undefined' && !!navigator.webdriver && stored(KEY.test) !== '1';

const TAU = Math.PI * 2;
// экран канала и окошко вокруг него; кружок; отступ от края; слева внизу — над доком черновика
const W = 232; const H = 164;
const SHELL = { w: 244, h: 206 }; const BUBBLE = 58; const EDGE = 16; const DOCK = 124;
const CORNERS = ['tl', 'tr', 'bl', 'br'];
function spot(corner, vp, min) {
  const w = min ? BUBBLE : SHELL.w; const h = min ? BUBBLE : SHELL.h;
  return { left: corner[1] === 'l' ? EDGE : vp.w - w - EDGE, top: corner[0] === 't' ? EDGE : vp.h - h - (corner === 'bl' ? DOCK : EDGE) };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function backdrop(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#231e33'); g.addColorStop(1, '#0f0d16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function caption(ctx, text, font, x = 9, y = 15, align = 'left') {
  ctx.font = `600 9.5px ${font}`; ctx.textAlign = align; ctx.fillStyle = 'rgba(255, 255, 255, .5)';
  ctx.fillText(text, x, y);
}
function glowDot(ctx, x, y, r, hue) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, `hsl(${hue}, 100%, 92%)`); g.addColorStop(0.55, `hsl(${hue}, 90%, 70%)`); g.addColorStop(1, `hsl(${hue}, 80%, 52%)`);
  ctx.save(); ctx.shadowBlur = r * 1.6; ctx.shadowColor = `hsla(${hue}, 95%, 65%, .8)`;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}

/* Шарик в кольце: кольцо с прорезью вращается, шарик отскакивает и растёт, от каждого удара к нему
   тянется нить — получается узор, как в «string art». Вылетел — нити гаснут, новый раунд другого цвета. */
function ringChannel(rand) {
  const s = (H / 2 - 10) / RING.r; const cx = W / 2; const cy = H / 2;
  let b = newBall(rand); let hue = Math.floor(rand() * 360); let gone = 0; let ripples = []; let trail = [];
  return {
    step(dt) {
      const n = Math.max(1, Math.ceil(dt * 240));
      for (let i = 0; i < n; i += 1) {
        const k = b.k;
        b = stepBall(b, dt / n, rand);
        if (b.k > k) ripples.push({ a: b.hits[b.hits.length - 1], t: 0, h: hue + b.k * 7 });
      }
      ripples = ripples.filter((r) => (r.t += dt) < 0.6);
      trail = [[b.x, b.y], ...trail].slice(0, 8);
      if (b.out && (Math.abs(b.y * s) > H / 2 + 26 || Math.abs(b.x * s) > W / 2 + 26)) {
        gone += dt;
        if (gone > 1) { b = newBall(rand, b.round + 1); hue = (hue + 67) % 360; gone = 0; trail = []; }
      }
    },
    draw(ctx, font) {
      const fade = 1 - Math.min(1, gone / 0.8);
      const R = RING.r * s; const bx = cx + b.x * s; const by = cy + b.y * s;
      ctx.lineWidth = 0.8;
      b.hits.forEach((a, i) => {
        ctx.strokeStyle = `hsla(${hue + (b.k - b.hits.length + i + 1) * 7}, 90%, 72%, ${0.34 * fade})`;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(bx, by); ctx.stroke();
      });
      const g = gapAt(b.t);
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = `hsl(${hue}, 90%, 62%)`; ctx.strokeStyle = `hsla(${hue}, 85%, 80%, ${0.3 + 0.7 * fade})`;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R, g + b.gap / 2, g - b.gap / 2 + TAU); ctx.stroke();
      ctx.restore();
      ripples.forEach((r) => {
        const k = r.t / 0.6;
        ctx.strokeStyle = `hsla(${r.h}, 95%, 78%, ${0.8 * (1 - k)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx + Math.cos(r.a) * R, cy + Math.sin(r.a) * R, 2 + k * 18, 0, TAU); ctx.stroke();
      });
      const h = hue + b.k * 7;
      trail.slice(1).forEach(([x, y], i) => {
        ctx.fillStyle = `hsla(${h}, 90%, 70%, ${0.16 * (1 - i / trail.length)})`;
        ctx.beginPath(); ctx.arc(cx + x * s, cy + y * s, b.r * s * (1 - i * 0.07), 0, TAU); ctx.fill();
      });
      glowDot(ctx, bx, by, b.r * s, h);
      caption(ctx, `ударов: ${b.k}`, font);
    },
  };
}

/* Маятниковая волна, вид сверху: у каждого маятника своя частота, вместе они складываются в змейку,
   волну, два ряда — и раз в минуту снова выстраиваются в линию. Внизу — сколько до линии. */
function waveChannel() {
  let t = 0;
  const n = PEND.n; const x0 = 20; const dx = (W - 2 * x0) / (n - 1); const cy = H / 2 + 2; const A = H * 0.34;
  const at = (i, tt) => [x0 + i * dx, cy - (A * pendulumAngle(i, tt)) / PEND.amp];
  const hueOf = (i) => 175 + (i / (n - 1)) * 150;
  return {
    step(dt) { t += dt; },
    draw(ctx, font) {
      ctx.strokeStyle = 'rgba(255, 255, 255, .06)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i += 1) { const x = x0 + i * dx; ctx.beginPath(); ctx.moveTo(x, cy - A - 7); ctx.lineTo(x, cy + A + 7); ctx.stroke(); }
      for (let k = 6; k >= 1; k -= 1) {
        for (let i = 0; i < n; i += 1) {
          const [x, y] = at(i, t - k * 0.03);
          ctx.fillStyle = `hsla(${hueOf(i)}, 85%, 68%, ${0.045 * (7 - k)})`;
          ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fill();
        }
      }
      const pts = Array.from({ length: n }, (_, i) => at(i, t));
      const grad = ctx.createLinearGradient(x0, 0, W - x0, 0);
      grad.addColorStop(0, `hsl(${hueOf(0)}, 85%, 68%)`); grad.addColorStop(1, `hsl(${hueOf(n - 1)}, 85%, 70%)`);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i += 1) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]); ctx.stroke(); ctx.restore();
      pts.forEach(([x, y], i) => glowDot(ctx, x, y, 4.6, hueOf(i)));
      const left = pendulumAlign(t);
      ctx.fillStyle = 'rgba(255, 255, 255, .08)'; ctx.fillRect(x0, H - 7, W - 2 * x0, 2);
      ctx.fillStyle = grad; ctx.fillRect(x0, H - 7, (W - 2 * x0) * (1 - left / PEND.cycle), 2);
      caption(ctx, left < 1.5 || left > PEND.cycle - 1.5 ? 'в линию!' : `в линию через ${Math.ceil(left)} с`, font);
    },
  };
}

/* Тетрис: бот ставит фигуры, двигая их, как человек. Нажали ←, ⟳, →, ⤓ (или стрелки, пока мышь над
   окошком) — фигура ваша; не трогали 4 секунды — следующая снова у бота. Поле переполнилось —
   рассыпается, и игра идёт дальше. */
const TET_COLORS = { I: '#7DE3F4', O: '#FBE38E', T: '#C9B6FC', S: '#8FEAB0', Z: '#FBA5A5', J: '#9CC3FB', L: '#FBBE85' };
const TET_TIME = { gravity: 0.5, act: 0.1, drop: 0.035, flash: 0.3, reset: 1.1, own: 4 };
function cell(ctx, x, y, c, type, a = 1) {
  ctx.globalAlpha = a;
  ctx.fillStyle = TET_COLORS[type];
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, c - 1, c - 1, 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, .4)'; ctx.fillRect(x + 1.6, y + 1.2, c - 3.2, 1);
  ctx.globalAlpha = 1;
}
function tetrisChannel(rand) {
  const c = 7.6; const bw = TET.w * c; const bh = TET.h * c; const bx = (W - bw) / 2; const by = (H - bh) / 2;
  const st = { board: emptyBoard(), queue: [], next: null, piece: null, goal: null, drop: false, lines: 0, t: 0, fallT: 0, actT: 0, manual: false, input: -99, flash: null, reset: 0 };
  const take = () => { if (!st.queue.length) st.queue = bag(rand); return st.queue.shift(); };
  // нажали, пока фигуры нет (линия сгорает), — следующая уже ваша
  const yours = () => st.manual || st.t - st.input < TET_TIME.own;
  const enter = () => {
    const type = st.next || take(); st.next = take();
    const p = spawn(type);
    if (!fits(st.board, p)) { st.piece = null; st.reset = 0.001; return; }
    st.piece = p; st.fallT = 0; st.actT = 0; st.drop = false;
    st.manual = st.t - st.input < TET_TIME.own;
    st.goal = st.manual ? null : bestMove(st.board, type);
  };
  const settle = () => {
    st.board = lock(st.board, st.piece); st.piece = null;
    const { rows } = clearLines(st.board);
    if (rows.length) st.flash = { rows, t: 0 }; else enter();
  };
  // ход бота: сперва поворот, потом сдвиг к цели; на месте или путь закрыт — вниз
  const botAct = () => {
    const p = st.piece; const g = st.goal;
    let q = p;
    if (g && p.rot !== g.rot) q = turn(st.board, p);
    else if (g && p.x !== g.x) q = shift(st.board, p, Math.sign(g.x - p.x));
    if (q === p) st.drop = true; else st.piece = q;
  };
  return {
    step(dt) {
      st.t += dt;
      if (st.reset) { st.reset += dt; if (st.reset > TET_TIME.reset) { st.board = emptyBoard(); st.reset = 0; enter(); } return; }
      if (st.flash) {
        st.flash.t += dt;
        if (st.flash.t > TET_TIME.flash) { const r = clearLines(st.board); st.board = r.board; st.lines += r.rows.length; st.flash = null; enter(); }
        return;
      }
      if (!st.piece) { enter(); return; }
      if (!st.manual) { st.actT += dt; while (st.actT >= TET_TIME.act && !st.drop) { st.actT -= TET_TIME.act; botAct(); } }
      const every = st.drop ? TET_TIME.drop : TET_TIME.gravity;
      st.fallT += dt;
      while (st.piece && st.fallT >= every) {
        st.fallT -= every;
        const q = { ...st.piece, y: st.piece.y + 1 };
        if (fits(st.board, q)) st.piece = q; else { settle(); st.fallT = 0; }
      }
    },
    input(a) {
      st.input = st.t;
      const p = st.piece;
      if (!p) return;
      st.manual = true; st.goal = null; st.drop = false;
      if (a === 'left' || a === 'right') st.piece = shift(st.board, p, a === 'left' ? -1 : 1);
      else if (a === 'turn') st.piece = turn(st.board, p);
      else if (a === 'down') { st.piece = fall(st.board, p); settle(); }
    },
    player: () => (yours() ? 'you' : 'bot'),
    draw(ctx, font) {
      ctx.fillStyle = 'rgba(255, 255, 255, .045)';
      ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .08)';
      for (let y = 0; y < TET.h; y += 1) for (let x = 0; x < TET.w; x += 1) ctx.fillRect(bx + x * c + c / 2 - 0.5, by + y * c + c / 2 - 0.5, 1, 1);
      const fade = st.reset ? Math.max(0, 1 - st.reset / 0.9) : 1;
      const sink = st.reset ? st.reset * st.reset * 50 : 0;
      st.board.forEach((row, y) => row.forEach((v, x) => { if (v) cell(ctx, bx + x * c, by + y * c + sink * (0.6 + (x % 3) * 0.2), c, PIECES[v - 1], fade); }));
      if (st.flash) {
        const k = 1 - st.flash.t / TET_TIME.flash;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * k})`;
        st.flash.rows.forEach((y) => ctx.fillRect(bx, by + y * c, bw, c));
      }
      if (st.piece) {
        const ghost = fall(st.board, st.piece);
        ctx.strokeStyle = 'rgba(255, 255, 255, .22)'; ctx.lineWidth = 1;
        cellsOf(ghost).forEach(([x, y]) => { if (y >= 0) { ctx.beginPath(); ctx.roundRect(bx + x * c + 1, by + y * c + 1, c - 2, c - 2, 1.5); ctx.stroke(); } });
        cellsOf(st.piece).forEach(([x, y]) => { if (y >= 0) cell(ctx, bx + x * c, by + y * c, c, st.piece.type); });
      }
      // слева — линии, справа — следующая фигура
      const lx = bx / 2; const rx = bx + bw + (W - bx - bw) / 2;
      caption(ctx, 'ЛИНИИ', font, lx, 24, 'center');
      ctx.font = `700 22px ${font}`; ctx.fillStyle = 'rgba(255, 255, 255, .88)'; ctx.fillText(String(st.lines), lx, 50);
      caption(ctx, 'ДАЛЬШЕ', font, rx, 24, 'center');
      if (st.next) {
        const cs = cellsOf({ ...spawn(st.next), x: 0, y: 0 }); const m = 6.4;
        const xs = cs.map(([x]) => x); const ys = cs.map(([, y]) => y);
        const ox = rx - ((Math.max(...xs) - Math.min(...xs) + 1) * m) / 2 - Math.min(...xs) * m;
        const oy = 34 - Math.min(...ys) * m;
        cs.forEach(([x, y]) => cell(ctx, ox + x * m, oy + y * m, m, st.next));
      }
      caption(ctx, yours() ? 'играете вы' : 'играет бот', font, lx, H - 54, 'center');
    },
  };
}

const CHANNELS = [
  { id: 'ring', title: 'Шарик в кольце', make: ringChannel },
  { id: 'wave', title: 'Маятники', make: waveChannel },
  { id: 'tetris', title: 'Тетрис', full: 'Тетрис сам с собой', make: tetrisChannel },
];
const PAD_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'turn', ArrowDown: 'down', ' ': 'down' };

export const FOCUS_CSS = `
  .fc { position: absolute; z-index: 5; width: ${SHELL.w}px; height: ${SHELL.h}px; border-radius: 20px; overflow: hidden; touch-action: none; user-select: none;
    border: 1px solid color-mix(in srgb, var(--ds-rule2) 75%, transparent); background: color-mix(in srgb, var(--ds-card) 78%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.6); backdrop-filter: blur(16px) saturate(1.6);
    box-shadow: 0 22px 46px -20px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 color-mix(in srgb, #fff 45%, transparent);
    transition: left .55s cubic-bezier(.2, .9, .3, 1.08), top .55s cubic-bezier(.2, .9, .3, 1.08), width .45s cubic-bezier(.2, .9, .3, 1), height .45s cubic-bezier(.2, .9, .3, 1),
      border-radius .45s, opacity .3s ease, transform .3s cubic-bezier(.2, .9, .3, 1.2), box-shadow .3s;
    animation: fc-in .7s cubic-bezier(.2, .9, .3, 1.15) .35s backwards; }
  .ds-dark .fc { box-shadow: 0 22px 46px -20px var(--ds-shade), 0 2px 10px -4px var(--ds-shade), inset 0 1px 0 rgba(255, 255, 255, .07); }
  @keyframes fc-in { from { opacity: 0; transform: translateY(14px) scale(.9); } }
  .fc.drag { transition: width .45s, height .45s, border-radius .45s, transform .2s, box-shadow .2s; transform: scale(1.04); cursor: grabbing;
    box-shadow: 0 30px 60px -22px var(--ds-shade), 0 4px 14px -4px var(--ds-shade); }
  .fc.bye { opacity: 0; transform: scale(.86); }
  .fc-head { position: absolute; left: 6px; right: 6px; top: 4px; height: 30px; display: flex; align-items: center; gap: 1px; cursor: grab;
    transition: opacity .25s; }
  .fc-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; padding: 0 2px;
    font: 700 12.5px var(--ds-sans); color: var(--ds-ink); animation: fc-name .4s cubic-bezier(.2, .9, .3, 1.2) backwards; }
  @keyframes fc-name { from { opacity: 0; transform: translateY(5px); } }
  .fc-btn { flex-shrink: 0; width: 24px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 9px; padding: 0;
    background: transparent; color: var(--ds-ink2); cursor: pointer; transition: background .15s, color .15s, transform .15s; }
  .fc-btn:hover { background: color-mix(in srgb, var(--ds-ink) 8%, transparent); color: var(--ds-ink); }
  .fc-btn:active { transform: scale(.9); }
  .fc-btn:focus-visible, .fc-pad button:focus-visible, .fc-open:focus-visible { outline: 2px solid var(--u); outline-offset: 1px; }
  .fc-gap { width: 4px; flex-shrink: 0; }
  .fc-screen { position: absolute; left: 6px; top: 36px; width: ${W}px; height: ${H}px; border-radius: 14px; overflow: hidden; background: #0f0d16; cursor: grab;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06); transform-origin: 50% 50%;
    transition: left .45s cubic-bezier(.2, .9, .3, 1), top .45s cubic-bezier(.2, .9, .3, 1), transform .45s cubic-bezier(.2, .9, .3, 1), border-radius .45s; }
  .fc-screen canvas { display: block; width: ${W}px; height: ${H}px; }
  /* переключение канала — короткая рябь, как у телевизора */
  .fc-tune { position: absolute; inset: 0; pointer-events: none; opacity: 0;
    background: repeating-linear-gradient(0deg, rgba(255, 255, 255, .16) 0 1px, transparent 1px 3px), radial-gradient(circle, rgba(255, 255, 255, .5), rgba(255, 255, 255, .05));
    animation: fc-tune .55s ease-out; }
  @keyframes fc-tune { from { opacity: 1; } }
  .fc-pause { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: rgba(255, 255, 255, .8);
    background: rgba(10, 8, 16, .35); animation: fc-fade .3s ease backwards; }
  .fc-pad { position: absolute; bottom: 8px; display: flex; gap: 6px; opacity: 0; transition: opacity .2s; }
  .fc-pad.l { left: 9px; } .fc-pad.r { right: 9px; }
  .fc:hover .fc-pad, .fc-pad:focus-within { opacity: 1; }
  .fc-pad button { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 9px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .09); color: #fff; transition: background .15s, transform .12s; }
  .fc-pad button:hover { background: rgba(255, 255, 255, .18); }
  .fc-pad button:active { transform: scale(.88); }
  /* свёрнут — живой кружок: тот же экран, только мельче, по краю бежит радужное кольцо */
  .fc.min { width: ${BUBBLE}px; height: ${BUBBLE}px; border-radius: 50%; }
  .fc.min .fc-head { opacity: 0; pointer-events: none; visibility: hidden; transition: opacity .2s, visibility 0s .2s; }
  .fc.min .fc-screen { left: ${(BUBBLE - W) / 2}px; top: ${(BUBBLE - H) / 2}px; transform: scale(.44); border-radius: 50%; }
  .fc-ring { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; opacity: 0; transition: opacity .3s;
    background: conic-gradient(#7DE3F4, #C9B6FC, #FBA5A5, #FBE38E, #8FEAB0, #7DE3F4);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
    animation: fc-spin 6s linear infinite; }
  .fc.min .fc-ring { opacity: 1; }
  @keyframes fc-spin { to { transform: rotate(1turn); } }
  .fc-open { position: absolute; inset: 0; border: none; padding: 0; border-radius: 50%; background: transparent; cursor: pointer; }
  .fc.min:hover { transform: scale(1.08); }
  .fc-snack { position: absolute; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px; white-space: nowrap;
    border: 1px solid color-mix(in srgb, var(--ds-rule2) 75%, transparent); background: color-mix(in srgb, var(--ds-card) 86%, transparent);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); box-shadow: 0 16px 34px -18px var(--ds-shade);
    font: 600 13px var(--ds-sans); color: var(--ds-ink2); animation: fc-in .4s cubic-bezier(.2, .9, .3, 1.2) backwards; }
  .fc-snack button { height: 30px; padding: 0 13px; border: none; border-radius: 999px; cursor: pointer; background: var(--ds-ink); color: var(--ds-paper); font: 700 13px var(--ds-sans); }

  /* знакомство: урок тускнеет, окошко — в светлом вырезе, рядом карточка */
  .fc-intro { position: absolute; inset: 0; z-index: 60; animation: fc-fade .5s ease backwards; }
  @keyframes fc-fade { from { opacity: 0; } }
  .fc-hole { position: absolute; border-radius: 28px; pointer-events: none; box-shadow: 0 0 0 200vmax rgba(12, 10, 20, .64); }
  .fc-hole::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; border: 2px solid color-mix(in srgb, var(--u) 80%, #fff);
    animation: fc-halo 1.8s ease-out .5s infinite; }
  @keyframes fc-halo { 0% { opacity: .9; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(1.09); } }
  .fc.tour .fc-tour { animation: fc-ping 1.6s ease-out .8s infinite; }
  @keyframes fc-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--u) 70%, transparent); } 70%, 100% { box-shadow: 0 0 0 9px transparent; } }
  .fc-card { position: absolute; width: 330px; padding: 20px 20px 16px; border-radius: 22px; background: var(--ds-card); color: var(--ds-ink);
    box-shadow: 0 30px 60px -24px rgba(0, 0, 0, .55); animation: fc-card .55s cubic-bezier(.2, .9, .3, 1.2) .25s backwards; }
  @keyframes fc-card { from { opacity: 0; transform: translateY(12px) scale(.95); } }
  .fc-new { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border-radius: 999px; background: var(--u); color: #fff; font: 800 12px var(--ds-sans); letter-spacing: .02em; }
  .fc-card h2 { margin: 10px 0 6px; font: 800 21px/1.15 var(--ds-head); letter-spacing: -.01em; }
  .fc-card p { margin: 0 0 12px; font: 500 14.5px/1.45 var(--ds-sans); color: var(--ds-ink2); }
  .fc-card ul { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 8px; }
  .fc-card li { display: flex; align-items: center; gap: 10px; font: 500 13.5px/1.35 var(--ds-sans); color: var(--ds-ink2); }
  .fc-card li b { color: var(--ds-ink); font-weight: 700; }
  .fc-key { flex-shrink: 0; min-width: 30px; height: 26px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;
    background: color-mix(in srgb, var(--ds-ink) 7%, transparent); color: var(--ds-ink); }
  @media (prefers-reduced-motion: reduce) {
    .fc, .fc-name, .fc-tune, .fc-ring, .fc-snack, .fc-intro, .fc-card, .fc-hole::after, .fc.tour .fc-tour, .fc-pause { animation: none; }
    .fc, .fc-screen { transition: opacity .2s; }
  }
`;

export function FocusCorner({ paused = false }) {
  const [phase, setPhase] = useState('on'); // on — окошко, bye — уходит, gone — «Уголок скрыт · Вернуть», off — нет
  const [min, setMin] = useState(() => stored(KEY.min) === '1');
  const [corner, setCorner] = useState(() => (CORNERS.includes(stored(KEY.corner)) ? stored(KEY.corner) : 'br'));
  const [ch, setCh] = useState(() => Math.max(0, CHANNELS.findIndex((c) => c.id === stored(KEY.ch))));
  // при «уменьшить движение» канал стоит, пока его не запустят
  const [play, setPlay] = useState(() => !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [intro, setIntro] = useState(false);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [drag, setDrag] = useState(null);
  const shell = useRef(null);
  const canvas = useRef(null);
  const sim = useRef(null);
  const dragged = useRef(false);
  const over = useRef(false);
  const font = useRef('monospace');
  const C = CHANNELS[ch];
  const shown = phase === 'on' || phase === 'bye';
  const live = phase === 'on' && play && !paused;

  const paint = () => {
    const cv = canvas.current; const s = sim.current;
    if (!cv || !s) return;
    const ctx = cv.getContext('2d');
    backdrop(ctx); s.draw(ctx, font.current);
    const who = s.player ? s.player() : null;
    if (who && shell.current && shell.current.dataset.player !== who) shell.current.dataset.player = who;
  };
  const act = (a) => {
    if (!sim.current || !sim.current.input) return;
    sim.current.input(a);
    if (!live) paint();
  };

  useEffect(() => {
    const resize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    // первый раз — знакомство, когда урок уже на экране
    const t = stored(KEY.intro) ? 0 : setTimeout(() => setIntro(true), 700);
    return () => { window.removeEventListener('resize', resize); clearTimeout(t); };
  }, []);
  // экран: чёткий на любом экране; шрифт подписей — моноширинный шрифт приложения
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const d = window.devicePixelRatio || 1;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    font.current = getComputedStyle(cv).getPropertyValue('--ds-mono').trim() || 'monospace';
    paint();
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // тетрис со стрелок — пока мышь над окошком; уроку эти нажатия не достаются
  useEffect(() => {
    if (C.id !== 'tetris' || phase !== 'on' || min) return undefined;
    const key = (e) => {
      const a = PAD_KEYS[e.key];
      if (!a || !over.current || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); e.stopImmediatePropagation();
      act(a);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [ch, phase, min]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const zap = (d) => { Audio.play('tick'); setCh((i) => (i + d + CHANNELS.length) % CHANNELS.length); };
  const fold = (v) => { Audio.play('tick'); setMin(v); store(KEY.min, v ? '1' : null); };
  const hide = () => { Audio.play('paper'); store(KEY.off, 'off'); setPhase('bye'); };
  const restore = () => { Audio.play('tick'); store(KEY.off, null); setPhase('on'); };

  /* Перетаскивание за любое место, кроме кнопок; отпустили — окошко едет в ближайший угол. Движение
     слушает окно: мышь, рванувшая быстрее окошка, его не теряет. */
  const onDown = (e) => {
    if (e.button !== 0 || intro) return;
    const b = e.target.closest('button');
    if (b && !b.classList.contains('fc-open')) return;
    e.preventDefault();
    dragged.current = false;
    const r = shell.current.getBoundingClientRect();
    const size = min ? { w: BUBBLE, h: BUBBLE } : SHELL;
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, at: null };
    const move = (ev) => {
      if (ev.pointerId !== g.id) return;
      const dx = ev.clientX - g.x; const dy = ev.clientY - g.y;
      if (!g.at && Math.hypot(dx, dy) < 5) return;
      g.at = { left: clamp(r.left + dx, 4, vp.w - size.w - 4), top: clamp(r.top + dy, 4, vp.h - size.h - 4) };
      setDrag(g.at);
    };
    const up = (ev) => {
      if (ev.pointerId !== g.id) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!g.at) return;
      // щелчок, который браузер пришлёт следом за перетаскиванием, кружок не разворачивает
      dragged.current = true;
      setTimeout(() => { dragged.current = false; }, 0);
      const cx = g.at.left + size.w / 2; const cy = g.at.top + size.h / 2;
      const next = `${cy < vp.h / 2 ? 't' : 'b'}${cx < vp.w / 2 ? 'l' : 'r'}`;
      Audio.play('tick');
      setCorner(next); store(KEY.corner, next); setDrag(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  if (phase === 'off') return null;
  const at = spot(corner, vp, min);
  if (phase === 'gone') {
    const side = corner[1] === 'l' ? { left: EDGE } : { right: EDGE };
    const edge = corner[0] === 't' ? { top: EDGE } : { bottom: corner === 'bl' ? DOCK : EDGE };
    return (
      <div className="fc-snack" role="status" data-testid="focus-snack" style={{ ...side, ...edge }}>
        <style>{FOCUS_CSS}</style>
        Уголок скрыт — вернуть можно в настройках
        <button type="button" data-testid="focus-restore" onClick={restore}>Вернуть</button>
      </div>
    );
  }
  const pos = drag || at;
  const tetris = C.id === 'tetris';
  const cardAt = {
    ...(corner[1] === 'r' ? { right: vp.w - at.left + 22 } : { left: at.left + SHELL.w + 22 }),
    ...(corner[0] === 'b' ? { bottom: vp.h - at.top - SHELL.h } : { top: at.top }),
  };
  return (
    <>
      <style>{FOCUS_CSS}</style>
      <section ref={shell} className={`fc${min ? ' min' : ''}${drag ? ' drag' : ''}${phase === 'bye' ? ' bye' : ''}${intro ? ' tour' : ''}`}
        style={{ left: pos.left, top: pos.top }} aria-label={`Уголок для фокуса: ${C.full || C.title}`} data-testid="focus" data-channel={C.id} data-min={String(min)}
        data-corner={corner} data-playing={String(live)} onPointerDown={onDown} onPointerEnter={() => { over.current = true; }} onPointerLeave={() => { over.current = false; }}>
        <div className="fc-head" inert={min}>
          <button type="button" className="fc-btn" aria-label="Предыдущий канал" title="Предыдущий канал" data-testid="focus-prev" onClick={() => zap(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <span key={C.id} className="fc-name" title={C.full || C.title} data-testid="focus-name">{C.title}</span>
          <button type="button" className="fc-btn fc-tour" aria-label="Следующий канал" title="Следующий канал" data-testid="focus-next" onClick={() => zap(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          <span className="fc-gap" />
          <button type="button" className="fc-btn" aria-label={play ? 'Пауза' : 'Запустить'} title={play ? 'Пауза' : 'Запустить'} data-testid="focus-play" onClick={() => { Audio.play('tick'); setPlay(!play); }}>
            {play ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          </button>
          <button type="button" className="fc-btn fc-tour" aria-label="Свернуть в кружок" title="Свернуть в кружок" data-testid="focus-min" onClick={() => fold(true)}><Circle size={13} strokeWidth={2.6} aria-hidden="true" /></button>
          <button type="button" className="fc-btn fc-tour" aria-label="Скрыть уголок" title="Скрыть — вернуть можно в настройках" data-testid="focus-hide" onClick={hide}><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="fc-screen">
          <canvas ref={canvas} aria-hidden="true" data-testid="focus-canvas" />
          <span key={ch} className="fc-tune" aria-hidden="true" />
          {!play && !min && <span className="fc-pause" aria-hidden="true"><Play size={30} fill="currentColor" /></span>}
          {tetris && !min && <>
            <div className="fc-pad l" role="group" aria-label="Тетрис: влево и поворот">
              <button type="button" aria-label="Влево" title="Влево (←)" data-testid="focus-left" onClick={() => act('left')}><ArrowLeft size={15} aria-hidden="true" /></button>
              <button type="button" aria-label="Повернуть" title="Повернуть (↑)" data-testid="focus-turn" onClick={() => act('turn')}><RotateCw size={14} aria-hidden="true" /></button>
            </div>
            <div className="fc-pad r" role="group" aria-label="Тетрис: вправо и вниз">
              <button type="button" aria-label="Вправо" title="Вправо (→)" data-testid="focus-right" onClick={() => act('right')}><ArrowRight size={15} aria-hidden="true" /></button>
              <button type="button" aria-label="Бросить вниз" title="Бросить вниз (↓ или пробел)" data-testid="focus-drop" onClick={() => act('down')}><ArrowDownToLine size={14} aria-hidden="true" /></button>
            </div>
          </>}
        </div>
        <span className="fc-ring" aria-hidden="true" />
        {min && <button type="button" className="fc-open" aria-label="Развернуть уголок для фокуса" title="Развернуть" data-testid="focus-expand" onClick={() => { if (!dragged.current) fold(false); }} />}
      </section>
      {intro && !min && phase === 'on' && (
        <div className="fc-intro" role="dialog" aria-modal="true" aria-labelledby="fc-intro-title" data-testid="focus-intro">
          <div className="fc-hole" style={{ left: at.left - 8, top: at.top - 8, width: SHELL.w + 16, height: SHELL.h + 16 }} />
          <div className="fc-card" style={cardAt}>
            <span className="fc-new"><Sparkles size={13} aria-hidden="true" />Новое</span>
            <h2 id="fc-intro-title">Уголок для фокуса</h2>
            <p>Если внимание ускользает, поглядывайте сюда, пока читаете урок, — как на видео в углу у стримеров. Глазам есть за что зацепиться, а голова остаётся в уроке.</p>
            <ul>
              <li><span className="fc-key"><ChevronLeft size={15} aria-hidden="true" /><ChevronRight size={15} aria-hidden="true" /></span><span><b>Каналы:</b> шарик в кольце, маятники и тетрис, который играет сам — его можно перехватить</span></li>
              <li><span className="fc-key"><Circle size={12} strokeWidth={2.6} aria-hidden="true" /></span><span><b>Свернуть</b> в маленький кружок</span></li>
              <li><span className="fc-key"><X size={15} aria-hidden="true" /></span><span><b>Скрыть</b> совсем — вернуть можно в настройках</span></li>
              <li><span className="fc-key"><Move size={14} aria-hidden="true" /></span><span>Окошко можно <b>перетащить</b> в любой угол</span></li>
            </ul>
            <Button wide onClick={closeIntro} autoFocus data-testid="focus-intro-ok">Понятно</Button>
          </div>
        </div>
      )}
    </>
  );
}
