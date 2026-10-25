/* УКРАШЕНИЯ УРОКА — живые вещицы из лавки (docs/mechanics.md, «Украшения урока»). Узкая полоса между
   шапкой урока и заданием: её можно трогать, а вещица отзывается и на ответы (событие ems-answer из
   урока). Три вещицы, у каждой своя физика:
   • «Гирлянда флажков» — верёвка из звеньев (интегрирование Верле): потяните — флажки качаются;
     верный ответ — порыв ветра, ошибка — гирлянда вздрагивает и провисает;
   • «Колыбель Ньютона» — пять шариков-маятников: оттяните крайний — удар проходит по ряду;
     верный ответ — щелчок сам;
   • «Мобиле из монет» — монетки на нитях разной длины: качаются и вращаются, касание закручивает;
     верный ответ — все крутятся и вспыхивают.
   Цикл анимации засыпает, когда вещица успокоилась, — в покое она не тратит ни кадра. При «уменьшить
   движение» вещица нарисована неподвижно. */
import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from './ds-art.jsx';

export const DECOR_IDS = ['desk-bunting', 'desk-cradle', 'desk-mobile'];
export const ANSWER_EVENT = 'ems-answer';
// урок сообщает вещице об ответе
export const tellAnswer = (ok) => { try { window.dispatchEvent(new CustomEvent(ANSWER_EVENT, { detail: { ok } })); } catch { /* нет окна */ } };

const FLAG_COLORS = ['#C2490B', '#D9A21B', '#4D7C0F', '#2E5F8A', '#B0198F', '#C21E56'];
const css = (el, name, def) => { const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : ''; return v || def; };

/* ---------- гирлянда: натянутая струна с флажками ----------
   Точки висят на параболе покоя; соседи тянут друг друга (волновое уравнение), каждую —
   слабая пружина к месту покоя, трение гасит. Потянули одну — волна бежит по гирлянде. */
function makeBunting(W, H) {
  const n = Math.max(8, Math.round(W / 26));
  const span = W - 16; const sag = Math.min(12, (H - 26) * 0.5);
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n; const rx = 8 + span * t; const ry = 6 + sag * 4 * t * (1 - t);
    return { rx, ry, x: rx, y: ry, ox: 0, oy: 0, vx: 0, vy: 0, pin: i === 0 || i === n };
  });
  return { kind: 'bunting', pts, wind: 0, sag: 0, t: 0 };
}
const placePt = (p, x, y, H) => { p.ox = x - p.rx; p.oy = Math.max(-p.ry, Math.min(H - 22 - p.ry, y - p.ry)); p.x = p.rx + p.ox; p.y = p.ry + p.oy; };
function stepBunting(m, dt, H) {
  const sub = 4; const h = dt / sub; const P = m.pts;
  for (let s = 0; s < sub; s += 1) {
    // сначала скорости всех точек по старым положениям, потом шаг — иначе струна раскачивается сама
    for (let i = 1; i < P.length - 1; i += 1) {
      const p = P[i];
      if (p.drag) { p.vx = 0; p.vy = 0; continue; }
      p.vx += (2400 * (P[i - 1].ox - 2 * p.ox + P[i + 1].ox) - 30 * p.ox - 3.2 * p.vx + m.wind * Math.sin(i * 0.9 + m.t * 9) * 900) * h;
      p.vy += (2400 * (P[i - 1].oy - 2 * p.oy + P[i + 1].oy) - 30 * p.oy - 3.2 * p.vy + m.sag * 500 - m.wind * 260) * h;
    }
    for (let i = 1; i < P.length - 1; i += 1) {
      const p = P[i];
      if (p.drag) continue;
      const y = p.y + p.vy * h; placePt(p, p.x + p.vx * h, y, H);
      // упёрлась в край полосы — скорость поперёк гасится
      if (p.y !== y) p.vy = 0;
    }
  }
  m.wind *= 0.96; m.sag *= 0.97;
  return P.reduce((e, p) => e + (Math.abs(p.vx) + Math.abs(p.vy)) * dt + (Math.abs(p.ox) + Math.abs(p.oy)) * 0.01, 0) + Math.abs(m.wind) * 5 + m.sag * 5;
}
function drawBunting(ctx, m, col) {
  ctx.lineWidth = 1.6; ctx.strokeStyle = col.ink; ctx.globalAlpha = 0.55;
  ctx.beginPath(); m.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.globalAlpha = 1;
  for (let i = 0; i < m.pts.length - 1; i += 1) {
    const a = m.pts[i]; const b = m.pts[i + 1];
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const sway = (a.vx + b.vx) * 0.004;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang * 0.6 + sway);
    ctx.fillStyle = FLAG_COLORS[i % FLAG_COLORS.length];
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, 0); ctx.lineTo(-1, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/* ---------- колыбель Ньютона: маятники и упругие удары соседей ---------- */
function makeCradle(W, H) {
  const r = 7; const gap = r * 2 + 0.6; const top = 5; const L = H - top - r - 4; const cx = W / 2;
  const balls = Array.from({ length: 5 }, (_, i) => ({ ax: cx + (i - 2) * gap, a: 0, w: 0 }));
  return { kind: 'cradle', r, L, balls, top, clicks: 0, t: 0 };
}
const ballPos = (m, b) => ({ x: b.ax + Math.sin(b.a) * m.L, y: m.top + Math.cos(b.a) * m.L });
function stepCradle(m, dt) {
  const sub = 8; const h = dt / sub; let hit = 0;
  for (let s = 0; s < sub; s += 1) {
    m.balls.forEach((b) => { if (b.drag) return; b.w += (-(980 / m.L) * Math.sin(b.a)) * h; b.w *= 0.998; b.a += b.w * h; });
    // соседи касаются и сближаются — обмен скоростями (равные массы, упругий удар)
    for (let i = 0; i < m.balls.length - 1; i += 1) {
      const p = m.balls[i]; const q = m.balls[i + 1];
      const pp = ballPos(m, p); const qq = ballPos(m, q);
      if (qq.x - pp.x < m.r * 2 && p.w > q.w) {
        const t = p.w; p.w = q.w; q.w = t;
        if (Math.abs(t) > 1.2) hit += 1;
        const over = m.r * 2 - (qq.x - pp.x);
        if (!p.drag) p.a -= over / m.L / 2;
        if (!q.drag) q.a += over / m.L / 2;
      }
    }
  }
  m.clicks += hit;
  return m.balls.reduce((e, b) => e + Math.abs(b.w) + Math.abs(b.a) * 4, 0);
}
function drawCradle(ctx, m, col) {
  const x0 = m.balls[0].ax - 16; const x1 = m.balls[4].ax + 16;
  ctx.strokeStyle = col.ink; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, m.top); ctx.lineTo(x1, m.top); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
  m.balls.forEach((b) => { const p = ballPos(m, b); ctx.beginPath(); ctx.moveTo(b.ax, m.top); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  ctx.globalAlpha = 1;
  m.balls.forEach((b) => {
    const p = ballPos(m, b);
    const g = ctx.createRadialGradient(p.x - 2.5, p.y - 2.5, 1, p.x, p.y, m.r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d9dde3'); g.addColorStop(1, '#7c8591');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, m.r, 0, Math.PI * 2); ctx.fill();
  });
}

/* ---------- мобиле: монеты на нитях — качаются и вращаются ---------- */
// нити разной длины, но монета (радиус 9) всегда целиком в полосе
function makeMobile(W, H) {
  const n = Math.max(5, Math.min(9, Math.round(W / 60)));
  const top = 4; const Lmin = 8; const Lmax = Math.max(Lmin, H - top - 9 - 11);
  const coins = Array.from({ length: n }, (_, i) => ({ ax: 22 + ((W - 44) * i) / (n - 1), L: Lmin + ((((i * 7) % 5) / 4) * (Lmax - Lmin)), a: i % 2 ? 0.12 : -0.12, w: 0, spin: 0, sv: 2 + (i % 3), glow: 0 }));
  return { kind: 'mobile', coins, top, t: 0 };
}
/* Монета на нити — два маятника: качание в плоскости полосы и кручение. Закрученная нить
   раскручивается обратно, так что в покое монета смотрит на вас, а не застывает ребром. */
function stepMobile(m, dt) {
  m.coins.forEach((c) => {
    if (!c.drag) { c.w += (-(980 / (c.L + 10)) * Math.sin(c.a)) * dt; c.w *= 0.984; c.a += c.w * dt; }
    c.sv += -7 * Math.sin(c.spin) * dt; c.sv *= 0.976; c.spin += c.sv * dt; c.glow *= 0.96;
  });
  return m.coins.reduce((e, c) => e + Math.abs(c.w) + Math.abs(c.a) + Math.abs(c.sv) + Math.abs(Math.sin(c.spin)) + c.glow, 0);
}
function drawMobile(ctx, m, col) {
  const x0 = m.coins[0].ax - 10; const x1 = m.coins[m.coins.length - 1].ax + 10;
  ctx.strokeStyle = col.ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, m.top); ctx.lineTo(x1, m.top); ctx.stroke();
  m.coins.forEach((c) => {
    const x = c.ax + Math.sin(c.a) * c.L; const y = m.top + Math.cos(c.a) * c.L;
    ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.ax, m.top); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1;
    const sx = Math.max(0.12, Math.abs(Math.cos(c.spin)));
    ctx.save(); ctx.translate(x, y + 9); ctx.scale(sx, 1);
    const g = ctx.createLinearGradient(-9, -9, 9, 9);
    g.addColorStop(0, '#FFE9A3'); g.addColorStop(0.5, Math.cos(c.spin) > 0 ? '#E0AE2E' : '#C99417'); g.addColorStop(1, '#9A7413');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(122, 88, 10, .7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
    if (c.glow > 0.05) { ctx.globalAlpha = Math.min(1, c.glow); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -3, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  });
}

const MAKE = { 'desk-bunting': makeBunting, 'desk-cradle': makeCradle, 'desk-mobile': makeMobile };
const STEP = { bunting: stepBunting, cradle: stepCradle, mobile: stepMobile };
// для тестов: модель вещицы без холста — создать, сделать шаг, толкнуть
export const decorModel = (id, W, H) => MAKE[id](W, H);
export const decorStep = (m, dt, H) => STEP[m.kind](m, dt, H);
const DRAW = { bunting: drawBunting, cradle: drawCradle, mobile: drawMobile };

// реакция на ответ урока
export function kick(m, ok) {
  if (m.kind === 'bunting') { if (ok) m.wind = 1.4; else { m.sag = 1; m.pts.forEach((p, i) => { if (!p.pin) p.vy -= Math.sin(i) * 120; }); } }
  if (m.kind === 'cradle') { const b = m.balls[0]; if (ok) { b.a = -0.75; b.w = 0; } else { m.balls.forEach((x) => { x.w += (Math.random() - 0.5) * 0.6; }); } }
  if (m.kind === 'mobile') m.coins.forEach((c, i) => { c.sv += ok ? 5 + (i % 3) : 1.2; c.glow = ok ? 1 : 0; c.w += ok ? 0.6 * (i % 2 ? 1 : -1) : 0.2; });
}

export function DeskDecor({ id, height = 56, preview = false, label = null }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = wrap.current; const cv = canvas.current;
    if (!el || !cv || !MAKE[id]) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    let W = Math.max(120, el.clientWidth); const H = height;
    let m = MAKE[id](W, H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { W = Math.max(120, el.clientWidth); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = `${W}px`; cv.style.height = `${H}px`; };
    size();
    const col = { ink: css(el, '--ds-ink2', '#5b4a3a') };
    let raf = 0; let last = 0; let calm = 0; let drag = null; let awake = null;
    const mark = (v) => { if (awake !== v) { awake = v; el.dataset.awake = String(v); } };
    const draw = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); DRAW[m.kind](ctx, m, col); };
    const frame = (ts) => {
      const dt = Math.min(1 / 30, last ? (ts - last) / 1000 : 1 / 60); last = ts; m.t += dt;
      const energy = STEP[m.kind](m, dt, H);
      draw();
      calm = energy < 0.05 && !drag ? calm + 1 : 0;
      mark(true);
      if (calm > 50) { raf = 0; last = 0; mark(false); return; }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && !reduced) { calm = 0; raf = requestAnimationFrame(frame); } };
    // покой: в начале вещица устраивается — несколько кадров, потом сон
    if (reduced) { for (let k = 0; k < 240; k += 1) STEP[m.kind](m, 1 / 60, H); draw(); } else wake();

    // касание: ближайшая точка вещицы в радиусе — тянется за пальцем
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pick = (p) => {
      if (m.kind === 'bunting') { let best = null; m.pts.forEach((q) => { if (q.pin) return; const d = Math.hypot(q.x - p.x, q.y + 8 - p.y); if (d < 30 && (!best || d < best.d)) best = { q, d }; }); return best && { kind: 'pt', q: best.q, dy: best.q.y - p.y }; }
      if (m.kind === 'cradle') { const ends = [m.balls[0], m.balls[4]]; const b = ends.find((x) => { const q = ballPos(m, x); return Math.hypot(q.x - p.x, q.y - p.y) < 26; }); return b && { kind: 'ball', b }; }
      const c = m.coins.find((x) => Math.hypot(x.ax + Math.sin(x.a) * x.L - p.x, m.top + Math.cos(x.a) * x.L + 9 - p.y) < 20);
      return c && { kind: 'coin', c, x0: p.x };
    };
    const down = (e) => {
      if (reduced) return;
      const p = local(e); const g = pick(p);
      if (!g) return;
      drag = g; el.dataset.drag = 'true';
      if (g.kind === 'pt') g.q.drag = true;
      if (g.kind === 'ball') g.b.drag = true;
      if (g.kind === 'coin') { g.c.sv += 3.5; g.c.glow = 0.6; }
      try { cv.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
      e.preventDefault(); wake();
    };
    const move = (e) => {
      if (!drag) return;
      const p = local(e);
      if (drag.kind === 'pt') placePt(drag.q, p.x, p.y + drag.dy, H);
      if (drag.kind === 'ball') { const b = drag.b; const dx = Math.max(-m.L * 0.9, Math.min(m.L * 0.9, p.x - b.ax)); const na = Math.asin(dx / m.L); const left = b === m.balls[0]; b.a = left ? Math.min(0, na) : Math.max(0, na); b.w = 0; }
      if (drag.kind === 'coin') { const c = drag.c; c.a = Math.max(-0.9, Math.min(0.9, (p.x - c.ax) / (c.L + 10))); c.w = 0; }
      wake();
    };
    const up = () => {
      if (!drag) return;
      if (drag.kind === 'pt') drag.q.drag = false;
      if (drag.kind === 'ball') drag.b.drag = false;
      if (drag.kind === 'coin') drag.c.drag = false;
      drag = null; el.dataset.drag = 'false'; wake();
    };
    const onAnswer = (e) => { if (preview || reduced) return; kick(m, !!(e.detail && e.detail.ok)); wake(); };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    window.addEventListener(ANSWER_EVENT, onAnswer);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - W) > 2) { size(); m = MAKE[id](W, H); if (reduced) { for (let k = 0; k < 240; k += 1) STEP[m.kind](m, 1 / 60, H); draw(); } else wake(); } }) : null;
    if (ro) ro.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      window.removeEventListener(ANSWER_EVENT, onAnswer);
      if (ro) ro.disconnect();
    };
  }, [id, height, preview, reduced]);
  if (!MAKE[id]) return null;
  return (
    <div ref={wrap} className={`ln-decor${preview ? ' preview' : ''}`} data-testid={preview ? 'decor-preview' : 'lesson-decor'} data-decor={id} data-awake="false"
      role="img" aria-label={label || 'Украшение урока — его можно потрогать'} style={{ height, position: 'relative', touchAction: 'none', userSelect: 'none' }}>
      <canvas ref={canvas} style={{ display: 'block', cursor: reduced ? 'default' : 'grab' }} />
    </div>
  );
}
