/* Каналы антистресса (learn-antistress.jsx): каждый рисует себя на экране W × H в своих координатах
   (окошко растягивается — экран масштабирует холст целиком) и умеет шаг времени. Физика и игры —
   в learn/antistress.js; здесь — картинка, частицы и управление. Текста на экранах нет — только
   картинка. Интерфейс канала: step(dt), draw(ctx); по желанию input(действие) — кнопки и стрелки,
   pointer(тип, x, y) — мышь по экрану (down/move/up при зажатой кнопке, hover/leave — просто над
   экраном), player() — кто играет: бот или ученик. */
import {
  RING, newBall, stepBall, gapAt, RINGS, newRings, stepRings, ringsGap, PEND, pendulumAngle, pendulumAlign,
  TET, PIECES, emptyBoard, cellsOf, fits, spawn, shift, turn, fall, lock, clearLines, bag, bestMove,
  SAND, stepSand, drainSand, SNAKE, SNAKE_DIRS, newSnake, snakeMove, snakeBot, snakeWon,
  BATTLE, newBattle, stepBattle, battleShare, swordTip,
} from './learn/antistress.js';
import { Audio } from './MacroSimulator.jsx';

export const W = 232; export const H = 164;
const TAU = Math.PI * 2;
// нажали недавно — играет ученик; столько секунд без нажатий — снова бот
const OWN = 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
// цвет HSL → [r, g, b] 0…255
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
};
// пиксель ImageData (RGBA, младший байт — R)
const rgba = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
// маленький холст для попиксельной картинки: рисуем в нём, потом растягиваем на экран
function pixels(w, h) {
  const img = new ImageData(w, h);
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  return { img, px: new Uint32Array(img.data.buffer), off, octx: off.getContext('2d') };
}

function backdrop(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#231e33'); g.addColorStop(1, '#0f0d16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glowDot(ctx, x, y, r, hue) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, `hsl(${hue}, 100%, 92%)`); g.addColorStop(0.55, `hsl(${hue}, 90%, 70%)`); g.addColorStop(1, `hsl(${hue}, 80%, 52%)`);
  ctx.save(); ctx.shadowBlur = r * 1.6; ctx.shadowColor = `hsla(${hue}, 95%, 65%, .8)`;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
export function paintChannel(ctx, ch) { backdrop(ctx); ch.draw(ctx); }

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
    draw(ctx) {
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
    },
  };
}

/* Сквозь кольца: шарик прыгает внутри самого маленького целого кольца; проскочил в прорезь — кольцо
   разлетается осколками и искрами, экран коротко вспыхивает, и шарик уже внутри следующего. */
function ringsChannel(rand) {
  const cx = W / 2; const cy = H / 2;
  let s = newRings(rand); let hue = Math.floor(rand() * 360); let gone = 0; let shards = []; let sparks = []; let flash = 0; let trail = [];
  const hueOf = (i) => hue + i * 26;
  const shatter = (i) => {
    const ring = s.rings[i]; const g = ringsGap(ring, s.t); const n = 12; const span = (TAU - RINGS.gap) / n;
    for (let k = 0; k < n; k += 1) {
      const a = g + RINGS.gap / 2 + span * (k + 0.5); const v = 35 + rand() * 55;
      shards.push({ a, span: span * 0.82, r: ring.r, ox: 0, oy: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25, rot: 0, w: (rand() - 0.5) * 6, t: 0, h: hueOf(i) });
    }
    for (let k = 0; k < 18; k += 1) {
      const a = rand() * TAU; const v = 40 + rand() * 100;
      sparks.push({ x: cx + s.x, y: cy + s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, h: hueOf(i) + rand() * 40 });
    }
    flash = 1;
  };
  return {
    step(dt) {
      const n = Math.max(1, Math.ceil(dt * 240));
      for (let k = 0; k < n; k += 1) { const r = stepRings(s, dt / n, rand); s = r.s; if (r.broke >= 0) shatter(r.broke); }
      shards = shards.filter((p) => { p.t += dt; p.vy += 170 * dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.rot += p.w * dt; return p.t < 1.2; });
      sparks = sparks.filter((p) => { p.t += dt; p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < 0.7; });
      flash = Math.max(0, flash - dt * 4);
      trail = [[s.x, s.y], ...trail].slice(0, 7);
      if (s.cur >= RINGS.n && (Math.abs(s.y) > H / 2 + 20 || Math.abs(s.x) > W / 2 + 20)) {
        gone += dt;
        if (gone > 1) { s = newRings(rand); hue = (hue + 80) % 360; gone = 0; trail = []; }
      }
    },
    draw(ctx) {
      ctx.lineCap = 'round';
      s.rings.forEach((ring, i) => {
        if (i < s.cur) return;
        const g = ringsGap(ring, s.t); const h = hueOf(i);
        ctx.save();
        ctx.lineWidth = 2.4; ctx.strokeStyle = `hsl(${h}, 85%, 70%)`;
        if (i === s.cur) { ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${h}, 90%, 60%)`; } else ctx.globalAlpha = 0.72;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, g + RINGS.gap / 2, g - RINGS.gap / 2 + TAU); ctx.stroke();
        ctx.restore();
      });
      // осколок — кусок дуги, летит от центра и крутится вокруг своей середины
      shards.forEach((p) => {
        const mx = cx + Math.cos(p.a) * p.r + p.ox; const my = cy + Math.sin(p.a) * p.r + p.oy; const a = p.a + p.rot;
        ctx.strokeStyle = `hsla(${p.h}, 85%, 72%, ${1 - p.t / 1.2})`; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(mx - Math.cos(a) * p.r, my - Math.sin(a) * p.r, p.r, a - p.span / 2, a + p.span / 2); ctx.stroke();
      });
      sparks.forEach((p) => {
        ctx.fillStyle = `hsla(${p.h}, 95%, 80%, ${1 - p.t / 0.7})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, TAU); ctx.fill();
      });
      const h = hueOf(Math.min(s.cur, RINGS.n - 1));
      trail.slice(1).forEach(([x, y], i) => {
        ctx.fillStyle = `hsla(${h}, 90%, 72%, ${0.18 * (1 - i / trail.length)})`;
        ctx.beginPath(); ctx.arc(cx + x, cy + y, RINGS.r * (1 - i * 0.08), 0, TAU); ctx.fill();
      });
      glowDot(ctx, cx + s.x, cy + s.y, RINGS.r, h);
      if (flash) { ctx.fillStyle = `rgba(255, 255, 255, ${0.14 * flash})`; ctx.fillRect(0, 0, W, H); }
    },
  };
}

/* Битва цветов: восемь цветов делят поле из квадратиков. Боец ходит только по своей земле, меч
   крутится вокруг и перекрашивает клетки под собой — только что захваченные вспыхивают; задетый
   мечом чужой боец переходит на его сторону (вокруг — кольцо). Сверху — полоска: кому сколько земли.
   Победил один цвет — от середины поля его цвет волной заливает всё, и новая битва. */
const TEAMS = [[355, 0], [22, 2], [48, 8], [132, -2], [174, -2], [212, 0], [266, 2], [318, 2]];
function battleChannel(rand) {
  const { cols, rows, cell } = BATTLE;
  const ox = (W - cols * cell) / 2; const oy = (H - rows * cell) / 2;
  // клетка: цвет команды, захваченная только что — светлее (4 ступени вспышки); жёлтому — чуть светлее
  const paint = TEAMS.map(([h, l]) => [0, 1, 2, 3].map((k) => `hsl(${h}, ${62 + k * 8}%, ${40 + l + k * 8}%)`));
  const flash = new Float32Array(cols * rows);
  let s = newBattle(rand); let acc = 0; let rings = []; let end = 0;
  return {
    step(dt) {
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const { painted, turned } = stepBattle(s, 1 / 60, rand);
        painted.forEach((i) => { flash[i] = 1; });
        turned.forEach((g) => rings.push({ x: g.x, y: g.y, t: 0, h: TEAMS[g.team][0] }));
      }
      for (let i = 0; i < flash.length; i += 1) if (flash[i]) flash[i] = Math.max(0, flash[i] - dt * 2.2);
      rings = rings.filter((r) => (r.t += dt) < 0.6);
      if (s.winner < 0) return;
      // победа: цвет победителя волной от середины заливает поле
      end += dt;
      const R = end * 95;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const i = y * cols + x;
          if (s.cells[i] !== s.winner && Math.hypot((x + 0.5) * cell - (cols * cell) / 2, (y + 0.5) * cell - (rows * cell) / 2) < R) { s.cells[i] = s.winner; flash[i] = 1; }
        }
      }
      if (end > 3.4) { s = newBattle(rand); flash.fill(0); rings = []; end = 0; }
    },
    draw(ctx) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const i = y * cols + x;
          ctx.fillStyle = paint[s.cells[i]][Math.min(3, Math.ceil(flash[i] * 3))];
          ctx.fillRect(ox + x * cell + 0.4, oy + y * cell + 0.4, cell - 0.8, cell - 0.8);
        }
      }
      ctx.lineCap = 'round';
      s.fighters.forEach((f) => {
        const x = ox + f.x; const y = oy + f.y; const h = TEAMS[f.team][0];
        const [tx, ty] = swordTip(f);
        // след взмаха — светлый веер за клинком
        ctx.fillStyle = `hsla(${h}, 90%, 85%, .25)`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, BATTLE.sword, f.a - Math.sign(f.w) * 0.9, f.a, f.w < 0); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = `hsl(${h}, 95%, 70%)`;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(f.a) * 3.5, y + Math.sin(f.a) * 3.5); ctx.lineTo(ox + tx, oy + ty); ctx.stroke();
        ctx.restore();
        if (f.safe > 0 && Math.floor(f.safe * 10) % 2) return;
        ctx.fillStyle = 'rgba(0, 0, 0, .3)'; ctx.beginPath(); ctx.arc(x + 0.8, y + 1.4, BATTLE.r + 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(${h}, 90%, 64%)`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(x, y, BATTLE.r + 0.6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#16131f';
        [-1, 1].forEach((k) => { ctx.beginPath(); ctx.arc(x + k * 1.3, y - 0.6, 0.65, 0, TAU); ctx.fill(); });
      });
      rings.forEach((r) => {
        const k = r.t / 0.6;
        ctx.strokeStyle = `hsla(${r.h}, 95%, 82%, ${1 - k})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(ox + r.x, oy + r.y, 4 + k * 14, 0, TAU); ctx.stroke();
      });
      // полоска земли вдоль верхнего края: кому сколько
      let sx = ox;
      battleShare(s).forEach((v, team) => { ctx.fillStyle = `hsl(${TEAMS[team][0]}, 90%, 66%)`; ctx.fillRect(sx, oy, (W - 2 * ox) * v, 3); sx += (W - 2 * ox) * v; });
      if (s.winner >= 0) {
        const R = end * 95; const h = TEAMS[s.winner][0];
        ctx.strokeStyle = `hsla(${h}, 100%, 88%, ${Math.max(0, 1 - end / 3)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, TAU); ctx.stroke();
      }
    },
  };
}

/* Маятниковая волна, вид сверху: у каждого маятника своя частота, вместе они складываются в змейку,
   волну, два ряда — и раз в минуту снова выстраиваются в линию. Внизу — полоска до линии. */
function waveChannel() {
  let t = 0;
  const n = PEND.n; const x0 = 20; const dx = (W - 2 * x0) / (n - 1); const cy = H / 2 - 2; const A = H * 0.36;
  const at = (i, tt) => [x0 + i * dx, cy - (A * pendulumAngle(i, tt)) / PEND.amp];
  const hueOf = (i) => 175 + (i / (n - 1)) * 150;
  return {
    step(dt) { t += dt; },
    draw(ctx) {
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
    },
  };
}

/* Лава-лампа: настоящая лампа посреди тёмной комнаты — металлическая крышка и подставка, стеклянная
   колба с прозрачной цветной жидкостью, внутри — много воска. Воск — метаболы (сумма полей капель, где
   поле выше порога — воск), но рисуется не картинкой из точек, а гладким контуром: границу находят
   «марширующими квадратами» с интерполяцией и заливают одним путём в полном разрешении экрана, сверху —
   объём (свет снизу, блики на каплях, тёмная кромка). У дна над нагревателем — большая лужа: капля
   внизу греется и всплывает, наверху остывает и медленно тонет, по пути капли сливаются и делятся.
   Цвета лампы раз в минуту плавно меняются. */
const LAMPS = [
  { wax: [255, 92, 52], liquid: [74, 20, 96], glow: '255, 120, 80' },
  { wax: [255, 200, 48], liquid: [24, 44, 128], glow: '255, 210, 90' },
  { wax: [255, 84, 160], liquid: [16, 70, 100], glow: '255, 110, 170' },
  { wax: [110, 232, 104], liquid: [74, 20, 78], glow: '140, 240, 130' },
];
// поле капли — компактное: (1 − d²/R²)², R = r·√2; на пороге 0,25 одинокая капля ровно радиуса r
const LAVA = { top: 26, bottom: 128, cell: 2, thr: 0.25, reach: Math.SQRT2 };
function lavaChannel(rand) {
  const cx = W / 2; const { top, bottom, cell, thr, reach } = LAVA;
  // колба: квадратичная кривая от горлышка (полуширина 13) через пузо к дну (полуширина 24)
  const glass = (t) => [(1 - t) ** 2 * 13 + 2 * (1 - t) * t * 40 + t * t * 24, (1 - t) ** 2 * top + 2 * (1 - t) * t * 96 + t * t * bottom];
  const half = new Float32Array(H + 1);
  for (let k = 0; k <= 200; k += 1) { const [hw, y] = glass(k / 200); half[Math.round(y)] = hw; }
  for (let y = top; y <= bottom; y += 1) if (!half[y]) half[y] = half[y - 1];
  const blobs = Array.from({ length: 6 }, (_, i) => ({ x: cx + (rand() - 0.5) * 14, y: top + 14 + (i / 5) * 72, r: 9.5 + rand() * 4, vy: 0, heat: i / 5, ph: rand() * TAU, s: 1 }));
  const pool = [{ x: cx - 13, y: bottom - 1, r0: 13, ph: 0 }, { x: cx, y: bottom + 1, r0: 16, ph: 2 }, { x: cx + 13, y: bottom - 1, r0: 13, ph: 4 }].map((q) => ({ ...q, r: q.r0, s: 1 }));
  const all = [...blobs, ...pool];
  // сетка поля: шаг 2 единицы — контур между узлами интерполируется, так что края гладкие
  const gx0 = cx - 42; const gy0 = top - 2; const nx = Math.ceil(84 / cell) + 1; const ny = Math.ceil((bottom + 4 - gy0) / cell) + 1;
  const field = new Float32Array(nx * ny);
  let t = rand() * 60;
  const outline = (ctx) => {
    ctx.beginPath(); ctx.moveTo(cx - 13, top);
    ctx.quadraticCurveTo(cx - 40, 96, cx - 24, bottom); ctx.lineTo(cx + 24, bottom);
    ctx.quadraticCurveTo(cx + 40, 96, cx + 13, top); ctx.closePath();
  };
  const metal = (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#3a3d48'); g.addColorStop(0.35, '#c9ccd6'); g.addColorStop(0.55, '#f2f3f7'); g.addColorStop(1, '#4a4e5a');
    return g;
  };
  // воск одним путём: в каждой клетке — многоугольник её «внутренней» части (углы выше порога и
  // точки пересечения порога на рёбрах); соседние куски сходятся по общим рёбрам без щелей
  const waxPath = () => {
    for (let j = 0; j < ny; j += 1) {
      const y = gy0 + j * cell;
      for (let i = 0; i < nx; i += 1) {
        const x = gx0 + i * cell; let f = 0;
        for (let k = 0; k < all.length; k += 1) {
          // капля в движении вытягивается по вертикали (s > 1), объём тот же
          const q = all[k]; const R2 = (q.r * reach) ** 2; const d2 = ((x - q.x) * q.s) ** 2 + ((y - q.y) / q.s) ** 2;
          if (d2 < R2) f += (1 - d2 / R2) ** 2;
        }
        field[j * nx + i] = f;
      }
    }
    const path = new Path2D(); const edge = new Path2D();
    for (let j = 0; j < ny - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const v = c.map(([a, b]) => field[b * nx + a]);
        const ins = v.map((q) => q >= thr);
        if (!ins.some(Boolean)) continue;
        const poly = []; const cross = [];
        for (let k = 0; k < 4; k += 1) {
          const k2 = (k + 1) % 4;
          if (ins[k]) poly.push([gx0 + c[k][0] * cell, gy0 + c[k][1] * cell]);
          if (ins[k] !== ins[k2]) {
            const u = (thr - v[k]) / (v[k2] - v[k]);
            const pt = [gx0 + (c[k][0] + (c[k2][0] - c[k][0]) * u) * cell, gy0 + (c[k][1] + (c[k2][1] - c[k][1]) * u) * cell];
            poly.push(pt); cross.push(pt);
          }
        }
        path.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k += 1) path.lineTo(poly[k][0], poly[k][1]);
        path.closePath();
        // граница воска — только отрезки между точками пересечения порога (у «седла» их два)
        for (let k = 0; k + 1 < cross.length; k += 2) { edge.moveTo(cross[k][0], cross[k][1]); edge.lineTo(cross[k + 1][0], cross[k + 1][1]); }
      }
    }
    return { path, edge };
  };
  return {
    step(dt) {
      t += dt;
      blobs.forEach((b) => {
        if (b.y > bottom - 18) b.heat = Math.min(1, b.heat + dt * 0.28);
        else if (b.y < top + 24) b.heat = Math.max(0, b.heat - dt * 0.28);
        b.vy = clamp((b.vy + (0.5 - b.heat) * 36 * dt) * (1 - 0.9 * dt), -14, 14);
        b.y = clamp(b.y + b.vy * dt, top + b.r * 0.7, bottom + 2);
        const hw = half[Math.round(clamp(b.y, top, bottom))] - b.r * 0.55;
        b.x = clamp(b.x + Math.sin(t * 0.35 + b.ph) * 4 * dt, cx - Math.max(0, hw), cx + Math.max(0, hw));
        b.s += (1 + Math.min(0.45, Math.abs(b.vy) / 22) - b.s) * Math.min(1, dt * 3);
      });
      // лужа над нагревателем дышит
      pool.forEach((q) => { q.r = q.r0 + Math.sin(t * 0.7 + q.ph) * 1.4; });
    },
    draw(ctx) {
      // лампа сменяет цвета раз в минуту — плавно, через смешивание соседних наборов
      const phase = (t / 60) % LAMPS.length; const a = LAMPS[Math.floor(phase)]; const b2 = LAMPS[(Math.floor(phase) + 1) % LAMPS.length];
      const mixK = smooth(0.85, 1, phase % 1);
      const mix = (u, v) => u.map((q, i) => Math.round(q + (v[i] - q) * mixK));
      const wax = mix(a.wax, b2.wax); const liquid = mix(a.liquid, b2.liquid);
      const tint = (k) => `rgb(${wax.map((q) => Math.round(k >= 0 ? q + (255 - q) * k : q * (1 + k))).join(', ')})`;
      // комната и свет от лампы
      ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, W, H);
      const room = ctx.createRadialGradient(cx, 84, 6, cx, 84, 125);
      room.addColorStop(0, `rgba(${wax.join(', ')}, .34)`); room.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = room; ctx.fillRect(0, 0, W, H);
      // колба: жидкость светится сильнее у нагревателя
      ctx.save(); outline(ctx); ctx.clip();
      const liq = ctx.createLinearGradient(0, top, 0, bottom);
      liq.addColorStop(0, `rgb(${liquid.map((q) => Math.round(q * 0.7)).join(', ')})`); liq.addColorStop(1, `rgb(${liquid.map((q) => Math.min(255, q + 70)).join(', ')})`);
      ctx.fillStyle = liq; ctx.fillRect(cx - 44, top, 88, bottom - top);
      // воск: сначала мягкое свечение в жидкость, потом сам воск — снизу светлее (нагреватель), к верху гуще
      const { path, edge } = waxPath();
      ctx.save(); ctx.shadowColor = `rgba(${wax.join(', ')}, .75)`; ctx.shadowBlur = 9;
      const body = ctx.createLinearGradient(0, top, 0, bottom + 4);
      body.addColorStop(0, tint(-0.28)); body.addColorStop(0.55, tint(0)); body.addColorStop(1, tint(0.42));
      ctx.fillStyle = body; ctx.fill(path); ctx.restore();
      // объём: блики на каждой капле и кромка темнее середины
      ctx.save(); ctx.clip(path);
      blobs.forEach((q) => {
        const hx = q.x - q.r * 0.38; const hy = q.y - q.r * 0.42;
        const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, q.r * 0.8);
        hl.addColorStop(0, 'rgba(255, 255, 255, .3)'); hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hl; ctx.fillRect(q.x - q.r * 1.4, q.y - q.r * 1.4, q.r * 2.8, q.r * 2.8);
      });
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(${wax.map((q) => Math.round(q * 0.6)).join(', ')}, .5)`; ctx.stroke(edge);
      ctx.restore();
      // нагреватель: горячее пятно у дна
      const heat = ctx.createRadialGradient(cx, bottom + 2, 1, cx, bottom + 2, 26);
      heat.addColorStop(0, 'rgba(255, 245, 220, .55)'); heat.addColorStop(1, 'rgba(255, 245, 220, 0)');
      ctx.fillStyle = heat; ctx.fillRect(cx - 30, bottom - 26, 60, 30);
      // блик на стекле
      const shine = ctx.createLinearGradient(cx - 30, 0, cx - 10, 0);
      shine.addColorStop(0, 'rgba(255, 255, 255, 0)'); shine.addColorStop(0.5, 'rgba(255, 255, 255, .2)'); shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = shine; ctx.fillRect(cx - 30, top + 6, 20, bottom - top - 12);
      ctx.restore();
      outline(ctx); ctx.strokeStyle = 'rgba(255, 255, 255, .25)'; ctx.lineWidth = 1; ctx.stroke();
      // крышка и подставка — металл
      ctx.fillStyle = metal(ctx, cx - 15, cx + 15);
      ctx.beginPath(); ctx.moveTo(cx - 14, top + 1); ctx.lineTo(cx - 6, 9); ctx.quadraticCurveTo(cx, 6, cx + 6, 9); ctx.lineTo(cx + 14, top + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = metal(ctx, cx - 36, cx + 36);
      ctx.beginPath(); ctx.moveTo(cx - 25, bottom - 1); ctx.lineTo(cx - 35, 156); ctx.quadraticCurveTo(cx, 160, cx + 35, 156); ctx.lineTo(cx + 25, bottom - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, .35)'; ctx.fillRect(cx - 25, bottom - 1, 50, 2.5);
      // пол: отражение света под лампой
      const floor = ctx.createRadialGradient(cx, 159, 2, cx, 159, 64);
      floor.addColorStop(0, `rgba(${wax.join(', ')}, .25)`); floor.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = floor; ctx.fillRect(0, 152, W, 12);
    },
  };
}

/* Стая: рыбки плывут косяком по трём простым правилам (не толкаться, плыть как соседи, держаться
   вместе — «boids»). Время от времени косяк гоняет хищник, и стая разлетается и собирается снова.
   Наведите мышь на экран — рыбки шарахаются и от неё. */
const FISH = { n: 64, view: 26, sep: 9, maxV: 62, minV: 32, coh: 0.9, ali: 2.2, sepK: 900, edge: 16, edgeK: 140, flee: 44, fleeK: 320 };
function flockChannel(rand) {
  const fish = Array.from({ length: FISH.n }, (_, i) => {
    const a = rand() * TAU;
    return { x: W * (0.2 + rand() * 0.6), y: H * (0.2 + rand() * 0.6), vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, h: 168 + (i / FISH.n) * 90, s: 0.8 + rand() * 0.45 };
  });
  const shark = { x: -30, y: H / 2, vx: 30, vy: 0, chase: 0 };
  const bubbles = Array.from({ length: 9 }, () => ({ x: rand() * W, y: rand() * H, r: 0.8 + rand() * 1.6, v: 6 + rand() * 10 }));
  let t = 0; let hand = null; let acc = 0;
  const tick = (dt) => {
    // хищник: то бродит, то бросается к середине косяка
    let mx = 0; let my = 0;
    fish.forEach((f) => { mx += f.x; my += f.y; });
    mx /= fish.length; my /= fish.length;
    shark.chase -= dt;
    if (shark.chase < -6) shark.chase = 3 + rand() * 2;
    const goal = shark.chase > 0 ? [mx, my] : [W / 2 + Math.cos(t * 0.2) * W * 0.7, H / 2 + Math.sin(t * 0.33) * H * 0.4];
    const sa = Math.atan2(goal[1] - shark.y, goal[0] - shark.x); const sv = shark.chase > 0 ? 52 : 26;
    shark.vx += (Math.cos(sa) * sv - shark.vx) * dt * 1.4; shark.vy += (Math.sin(sa) * sv - shark.vy) * dt * 1.4;
    shark.x += shark.vx * dt; shark.y += shark.vy * dt;
    const threats = hand ? [shark, hand] : [shark];
    fish.forEach((f) => {
      let cx = 0; let cy = 0; let ax = 0; let ay = 0; let sx = 0; let sy = 0; let n = 0;
      fish.forEach((g) => {
        if (g === f) return;
        const dx = g.x - f.x; const dy = g.y - f.y; const d2 = dx * dx + dy * dy;
        if (d2 > FISH.view * FISH.view) return;
        n += 1; cx += g.x; cy += g.y; ax += g.vx; ay += g.vy;
        if (d2 < FISH.sep * FISH.sep) { sx -= dx / (d2 + 1); sy -= dy / (d2 + 1); }
      });
      let fx = sx * FISH.sepK; let fy = sy * FISH.sepK;
      if (n) { fx += (cx / n - f.x) * FISH.coh + (ax / n - f.vx) * FISH.ali; fy += (cy / n - f.y) * FISH.coh + (ay / n - f.vy) * FISH.ali; }
      if (f.x < FISH.edge) fx += FISH.edgeK * (1 - f.x / FISH.edge); else if (f.x > W - FISH.edge) fx -= FISH.edgeK * (1 - (W - f.x) / FISH.edge);
      if (f.y < FISH.edge) fy += FISH.edgeK * (1 - f.y / FISH.edge); else if (f.y > H - FISH.edge) fy -= FISH.edgeK * (1 - (H - f.y) / FISH.edge);
      threats.forEach((p) => {
        const dx = f.x - p.x; const dy = f.y - p.y; const d = Math.hypot(dx, dy);
        if (d < FISH.flee && d > 0.1) { fx += (dx / d) * FISH.fleeK * (1 - d / FISH.flee); fy += (dy / d) * FISH.fleeK * (1 - d / FISH.flee); }
      });
      f.vx += fx * dt; f.vy += fy * dt;
      const v = Math.hypot(f.vx, f.vy); const k = clamp(v, FISH.minV, FISH.maxV) / (v || 1);
      f.vx *= k; f.vy *= k;
      f.x = clamp(f.x + f.vx * dt, 1, W - 1); f.y = clamp(f.y + f.vy * dt, 1, H - 1);
    });
    bubbles.forEach((b) => { b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.r * 9) * 4 * dt; if (b.y < -4) { b.y = H + 4; b.x = rand() * W; } });
  };
  const body = (ctx, x, y, a, len, wid) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len / 2 + 1, 0); ctx.lineTo(-len / 2 - len * 0.32, -wid * 0.6); ctx.lineTo(-len / 2 - len * 0.32, wid * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  return {
    step(dt) { t += dt; acc += dt; while (acc >= 1 / 60) { acc -= 1 / 60; tick(1 / 60); } },
    pointer(type, x, y) { if (type === 'hover' || type === 'down' || type === 'move') hand = { x, y }; else if (type === 'leave') hand = null; },
    draw(ctx) {
      const sea = ctx.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, '#123a4a'); sea.addColorStop(1, '#0a1530');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
      // лучи света сверху, медленно покачиваются
      for (let k = 0; k < 3; k += 1) {
        const x = W * (0.2 + k * 0.3) + Math.sin(t * 0.3 + k * 2) * 18;
        const ray = ctx.createLinearGradient(0, 0, 0, H);
        ray.addColorStop(0, 'rgba(180, 240, 255, .09)'); ray.addColorStop(1, 'rgba(180, 240, 255, 0)');
        ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 12, 0); ctx.lineTo(x + 40, H); ctx.lineTo(x + 6, H); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(200, 245, 255, .25)';
      bubbles.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); });
      ctx.fillStyle = 'rgba(30, 44, 70, .9)';
      body(ctx, shark.x, shark.y, Math.atan2(shark.vy, shark.vx), 22, 7.5);
      fish.forEach((f) => {
        ctx.fillStyle = `hsl(${f.h}, 80%, 70%)`;
        body(ctx, f.x, f.y, Math.atan2(f.vy, f.vx), 7.2 * f.s, 2.8 * f.s);
      });
      if (hand) { ctx.strokeStyle = 'rgba(255, 255, 255, .18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hand.x, hand.y, 9, 0, TAU); ctx.stroke(); }
    },
  };
}

/* Песок: сверху сыплет струйка, цвет понемногу меняется — слоистые барханы, у верхних песчинок —
   светлый край; насыпалось почти до половины — в дне открывается дырка, и песок утекает. Зажали
   мышь на экране — песок сыплется оттуда. */
let sandPalette = null;
// 64 оттенка × 4 яркости, и то же посветлее — для верхних песчинок
function sandColors() {
  if (sandPalette) return sandPalette;
  const base = new Uint32Array(256); const top = new Uint32Array(256);
  for (let i = 0; i < 64; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      base[i * 4 + j] = rgba(...hsl((i * 360) / 64, 0.72, 0.58 + j * 0.035));
      top[i * 4 + j] = rgba(...hsl((i * 360) / 64, 0.8, 0.74 + j * 0.03));
    }
  }
  sandPalette = { base, top };
  return sandPalette;
}
function sandChannel(rand) {
  const { w, h } = SAND;
  const g = new Uint16Array(w * h);
  const { img, px, off, octx } = pixels(w, h);
  const pal = sandColors();
  let t = 0; let acc = 0; let hue = rand() * 64; let drain = false; let grains = 0; let hand = null; let handT = -99;
  const drop = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h || g[y * w + x]) return;
    g[y * w + x] = 1 + ((Math.floor(hue) % 64) * 4 + Math.floor(rand() * 4)); grains += 1;
  };
  const tick = () => {
    hue += 0.05;
    if (hand) for (let k = 0; k < 5; k += 1) drop(hand.x / 2 + (rand() - 0.5) * 5, hand.y / 2 + (rand() - 0.5) * 5);
    else if (!drain && t - handT > 2) { const x = w / 2 + Math.sin(t * 0.6) * w * 0.36; drop(x + (rand() - 0.5) * 3, 0); drop(x + (rand() - 0.5) * 3, 0); }
    stepSand(g, w, h, rand);
    if (drain) { grains -= drainSand(g, w, h); if (grains <= 0) { grains = 0; drain = false; } } else if (grains > SAND.full * w * h) drain = true;
  };
  return {
    step(dt) {
      t += dt; acc += dt;
      while (acc >= 1 / 60) { acc -= 1 / 60; tick(); }
    },
    player: () => (hand || t - handT < OWN ? 'you' : 'bot'),
    pointer(type, x, y) {
      if (type === 'down') { hand = { x, y }; handT = t; } else if (type === 'move' && hand) { hand = { x, y }; handT = t; } else if (type === 'up') { hand = null; handT = t; }
    },
    draw(ctx) {
      for (let i = 0; i < g.length; i += 1) px[i] = g[i] ? (i >= w && !g[i - w] ? pal.top : pal.base)[g[i] - 1] : 0;
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
      // дырка в дне — светлая щель, пока песок утекает
      if (drain) {
        ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#FBE38E'; ctx.fillStyle = 'rgba(251, 227, 142, .9)';
        ctx.fillRect(W / 2 - SAND.hole * 2, H - 1.5, SAND.hole * 4, 1.5); ctx.restore();
      }
    },
  };
}

/* Поп-ит: силиконовая игрушка с пупырками цветами радуги — то квадрат, то круг, то сердце. Нажали —
   пупырка с хлопком вдавилась (можно провести по ряду, не отпуская); вдавлены все — поп-ит
   переворачивается другой формой. Пока его не трогают, его неторопливо прожимает невидимый палец
   змейкой по рядам — беззвучно. */
const POP = { cols: 9, rows: 7, d: 15, gap: 3.4 };
const POP_HUES = [352, 22, 48, 140, 190, 226, 268];
const POP_SHAPES = ['square', 'circle', 'heart'];
// сердце: точки контура (классическая кривая), середина — около нуля
const HEART = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * TAU;
  return [16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) - 2.5];
});
const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
function popLayout(shape) {
  const { cols, rows, d, gap } = POP; const step = d + gap;
  const cx = W / 2; const cy = H / 2 + 1;
  const hw = (cols / 2) * step; const hh = (rows / 2) * step;
  const heart = HEART.map(([x, y]) => [cx + (x / 16) * (hw + 8), cy + (y / 14.5) * (hh + 8)]);
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = cx + (c - (cols - 1) / 2) * step; const y = cy + (r - (rows - 1) / 2) * step;
      const u = (c - (cols - 1) / 2) / (cols / 2); const v = (r - (rows - 1) / 2) / (rows / 2);
      const keep = shape === 'square' || (shape === 'circle' ? u * u + v * v <= 0.92 : inPoly(heart, cx + (x - cx) * 1.12, cy + (y - cy) * 1.12));
      if (keep) cells.push({ x, y, r, c });
    }
  }
  // палец-автомат идёт змейкой: ряд слева направо, следующий — справа налево
  const order = cells.map((_, i) => i).sort((a, b) => cells[a].r - cells[b].r || (cells[a].r % 2 ? cells[b].c - cells[a].c : cells[a].c - cells[b].c));
  const outline = (ctx) => {
    ctx.beginPath();
    if (shape === 'square') ctx.roundRect(cx - hw - 6 + gap / 2, cy - hh - 6 + gap / 2, 2 * hw + 12 - gap, 2 * hh + 12 - gap, 18);
    else if (shape === 'circle') ctx.ellipse(cx, cy, hw + 6, hh + 6, 0, 0, TAU);
    else heart.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  return { cells, order, outline, top: cy - hh - 10, bottom: cy + hh + 10 };
}
function popChannel() {
  const r0 = POP.d / 2;
  let shape = 0; let L = popLayout(POP_SHAPES[shape]);
  let down = L.cells.map(() => false); let at = L.cells.map(() => -9);
  // палец-автомат начинает через 3 секунды тишины — и с открытия канала тоже
  let t = 0; let flip = 0; let held = false; let handT = 0; let mineT = -99; let lastMine = false; let autoT = 0; let finger = null; let ripples = [];
  const press = (i, mine) => {
    if (i < 0 || down[i] || flip) return;
    down[i] = true; at[i] = t; lastMine = mine;
    ripples.push({ x: L.cells[i].x, y: L.cells[i].y, t: 0 });
    if (mine) { mineT = t; Audio.play('pop'); }
  };
  const hit = (x, y) => L.cells.findIndex((p) => Math.hypot(x - p.x, y - p.y) < r0 + 1.5);
  return {
    step(dt) {
      t += dt;
      ripples = ripples.filter((p) => (p.t += dt) < 0.32);
      if (flip) {
        flip += dt;
        // на середине переворота — новая форма, все пупырки снова выпуклые
        if (flip > 0.3 && down.some(Boolean)) {
          shape = (shape + 1) % POP_SHAPES.length; L = popLayout(POP_SHAPES[shape]);
          down = L.cells.map(() => false); at = L.cells.map(() => -9);
        }
        if (flip > 0.6) flip = 0;
        return;
      }
      if (down.every(Boolean)) { flip = 0.001; finger = null; if (lastMine) Audio.play('flip'); return; }
      if (t - handT > 3) {
        autoT += dt;
        if (autoT > 0.24) { autoT = 0; const i = L.order.find((k) => !down[k]); finger = [L.cells[i].x, L.cells[i].y]; press(i, false); }
      } else finger = null;
    },
    player: () => (t - mineT < OWN ? 'you' : 'bot'),
    pointer(type, x, y) {
      if (type === 'down') { held = true; handT = t; press(hit(x, y), true); } else if (type === 'move' && held) { handT = t; press(hit(x, y), true); } else if (type === 'up') { held = false; handT = t; }
    },
    draw(ctx) {
      const k = flip ? Math.abs(Math.cos((flip / 0.6) * Math.PI)) : 1;
      ctx.save(); ctx.translate(W / 2, 0); ctx.scale(Math.max(0.02, k), 1); ctx.translate(-W / 2, 0);
      // тень под игрушкой
      ctx.save(); ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; ctx.shadowColor = 'rgba(0, 0, 0, .5)'; ctx.fillStyle = '#000'; L.outline(ctx); ctx.fill(); ctx.restore();
      // силикон: ряды цветами радуги, мягкий блик сверху и светлый кант
      ctx.save(); L.outline(ctx); ctx.clip();
      const span = L.bottom - L.top;
      const base = ctx.createLinearGradient(0, L.top, 0, L.bottom);
      POP_HUES.forEach((hh, i) => base.addColorStop((i + 0.5) / POP_HUES.length, `hsl(${hh}, 82%, 70%)`));
      ctx.fillStyle = base; ctx.fillRect(0, L.top - 2, W, span + 4);
      const sheen = ctx.createLinearGradient(0, L.top, 0, L.top + span * 0.55);
      sheen.addColorStop(0, 'rgba(255, 255, 255, .32)'); sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sheen; ctx.fillRect(0, L.top - 2, W, span);
      ctx.restore();
      L.outline(ctx); ctx.strokeStyle = 'rgba(255, 255, 255, .55)'; ctx.lineWidth = 1.4; ctx.stroke();
      L.cells.forEach((p, i) => {
        const hh = POP_HUES[p.r];
        const sq = t - at[i] < 0.16 ? 1 - Math.sin(((t - at[i]) / 0.16) * Math.PI) * 0.12 : 1;
        const r = r0 * sq;
        if (down[i]) {
          // вдавлена: ямка — темнее у верхнего края, светлый серп снизу
          ctx.fillStyle = `hsl(${hh}, 74%, 63%)`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          const pit = ctx.createRadialGradient(p.x + r * 0.25, p.y + r * 0.35, r * 0.2, p.x, p.y, r * 1.05);
          pit.addColorStop(0, 'rgba(0, 0, 0, 0)'); pit.addColorStop(0.7, 'rgba(0, 0, 0, .06)'); pit.addColorStop(1, 'rgba(0, 0, 0, .26)');
          ctx.fillStyle = pit; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, .5)'; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.78, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
        } else {
          // выпуклая: мягкая тень, купол с бликом
          ctx.fillStyle = 'rgba(0, 0, 0, .16)'; ctx.beginPath(); ctx.arc(p.x + 0.7, p.y + 1.3, r, 0, TAU); ctx.fill();
          const dome = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.05, p.x, p.y, r * 1.1);
          dome.addColorStop(0, `hsl(${hh}, 95%, 90%)`); dome.addColorStop(0.45, `hsl(${hh}, 85%, 74%)`); dome.addColorStop(1, `hsl(${hh}, 75%, 62%)`);
          ctx.fillStyle = dome; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, .6)';
          ctx.beginPath(); ctx.ellipse(p.x - r * 0.33, p.y - r * 0.42, r * 0.3, r * 0.17, -0.6, 0, TAU); ctx.fill();
        }
      });
      ctx.restore();
      ripples.forEach((p) => {
        const q = p.t / 0.32;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - q)})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(p.x, p.y, r0 + q * 7, 0, TAU); ctx.stroke();
      });
      if (finger) { ctx.fillStyle = 'rgba(255, 255, 255, .25)'; ctx.beginPath(); ctx.arc(finger[0] + 3, finger[1] + 3, 6, 0, TAU); ctx.fill(); }
    },
  };
}

/* Тетрис: бот ставит фигуры, двигая их, как человек. Нажали ←, ⟳, →, ⤓ (или стрелки, пока мышь над
   окошком) — фигура ваша; не трогали 4 секунды — следующая снова у бота. Сгоревшая линия рассыпается
   искрами, слева растёт столбик линий; поле переполнилось — рассыпается, и игра идёт дальше. */
const TET_COLORS = { I: '#7DE3F4', O: '#FBE38E', T: '#C9B6FC', S: '#8FEAB0', Z: '#FBA5A5', J: '#9CC3FB', L: '#FBBE85' };
const TET_TIME = { gravity: 0.5, act: 0.1, drop: 0.035, flash: 0.3, reset: 1.1 };
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
  let sparks = [];
  const take = () => { if (!st.queue.length) st.queue = bag(rand); return st.queue.shift(); };
  // нажали, пока фигуры нет (линия сгорает), — следующая уже ваша
  const yours = () => st.manual || st.t - st.input < OWN;
  const enter = () => {
    const type = st.next || take(); st.next = take();
    const p = spawn(type);
    if (!fits(st.board, p)) { st.piece = null; st.reset = 0.001; return; }
    st.piece = p; st.fallT = 0; st.actT = 0; st.drop = false;
    st.manual = st.t - st.input < OWN;
    st.goal = st.manual ? null : bestMove(st.board, type);
  };
  const settle = () => {
    st.board = lock(st.board, st.piece); st.piece = null;
    const { rows } = clearLines(st.board);
    if (!rows.length) { enter(); return; }
    st.flash = { rows, t: 0 };
    rows.forEach((y) => st.board[y].forEach((v, x) => {
      for (let k = 0; k < 2; k += 1) sparks.push({ x: bx + (x + 0.5) * c, y: by + (y + 0.5) * c, vx: (rand() - 0.5) * 120, vy: -30 - rand() * 70, t: 0, col: TET_COLORS[PIECES[v - 1]] });
    }));
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
      sparks = sparks.filter((p) => { p.t += dt; p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < 0.8; });
      if (st.reset) { st.reset += dt; if (st.reset > TET_TIME.reset) { st.board = emptyBoard(); st.reset = 0; st.lines = 0; enter(); } return; }
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
    draw(ctx) {
      ctx.fillStyle = yours() ? 'rgba(255, 255, 255, .07)' : 'rgba(255, 255, 255, .045)';
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
      sparks.forEach((p) => { ctx.globalAlpha = 1 - p.t / 0.8; ctx.fillStyle = p.col; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); });
      ctx.globalAlpha = 1;
      // слева — столбик сгоревших линий (по 20 в столбике), справа — следующая фигура
      const lx = bx / 2; const rx = bx + bw + (W - bx - bw) / 2;
      for (let k = 0; k < st.lines % 20; k += 1) {
        ctx.fillStyle = `hsl(${(k * 18 + 180) % 360}, 75%, 70%)`;
        ctx.beginPath(); ctx.roundRect(lx - 9, by + bh - 4 - k * 7.6, 18, 5, 2); ctx.fill();
      }
      if (st.next) {
        const cs = cellsOf({ ...spawn(st.next), x: 0, y: 0 }); const m = 6.4;
        const xs = cs.map(([x]) => x); const ys = cs.map(([, y]) => y);
        const qx = rx - ((Math.max(...xs) - Math.min(...xs) + 1) * m) / 2 - Math.min(...xs) * m;
        const qy = by + 10 - Math.min(...ys) * m;
        cs.forEach(([x, y]) => cell(ctx, qx + x * m, qy + y * m, m, st.next, 0.85));
      }
    },
  };
}

/* Змейка: бот ищет путь к еде и не загоняет себя в угол; стрелками или кнопками змейку можно взять
   себе, 4 секунды без нажатий — снова бот. Ползёт плавно: голова и хвост скользят из клетки в клетку,
   изгибы стоят в клетках. Врезалась — рассыпается и начинает заново; выросла до победы — вспышка и тоже заново. */
function snakeChannel(rand) {
  const c = 9; const bw = SNAKE.w * c; const bh = SNAKE.h * c; const ox = (W - bw) / 2; const oy = (H - bh) / 2;
  let s = newSnake(rand); let prev = s.body; let t = 0; let acc = 0; let input = -99; let want = null; let end = 0;
  const yours = () => t - input < OWN;
  const every = () => (yours() ? 0.15 : 0.11);
  const mid = ([x, y]) => [ox + x * c + c / 2, oy + y * c + c / 2];
  return {
    step(dt) {
      t += dt;
      if (end) { end += dt; if (end > 1.4) { s = newSnake(rand); prev = s.body; end = 0; acc = 0; } return; }
      acc += dt;
      while (acc >= every() && !end) {
        acc -= every();
        prev = s.body;
        s = snakeMove(s, yours() ? want || s.dir : snakeBot(s), rand);
        want = null;
        if (s.dead || snakeWon(s)) end = 0.001;
      }
    },
    input(a) { input = t; want = SNAKE_DIRS[a]; },
    player: () => (yours() ? 'you' : 'bot'),
    draw(ctx) {
      ctx.fillStyle = 'rgba(255, 255, 255, .04)'; ctx.beginPath(); ctx.roundRect(ox - 2, oy - 2, bw + 4, bh + 4, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .07)';
      for (let y = 0; y < SNAKE.h; y += 1) for (let x = 0; x < SNAKE.w; x += 1) ctx.fillRect(ox + x * c + c / 2 - 0.5, oy + y * c + c / 2 - 0.5, 1, 1);
      if (s.food) { const [fx, fy] = mid(s.food); glowDot(ctx, fx, fy, 3.2 + Math.sin(t * 6) * 0.5, 45); }
      /* Плавно, но без срезанных углов: изгибы тела стоят точно в клетках, движутся только голова
         (из прошлой клетки в новую) и кончик хвоста (из освободившейся клетки к нынешней). */
      const p = end ? 1 : clamp(acc / every(), 0, 1);
      const lerp = (a, b) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
      const cells = s.body.map(mid);
      const n = cells.length;
      const pts = [lerp(n > 1 ? cells[1] : cells[0], cells[0]), ...cells.slice(1), lerp(mid(prev[prev.length - 1]), cells[n - 1])];
      const fade = s.dead ? Math.max(0, 1 - end / 1.2) : 1;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = c * 0.7;
      for (let i = pts.length - 1; i > 0; i -= 1) {
        const shake = s.dead ? Math.sin(i * 7 + end * 40) * end * 4 : 0;
        ctx.strokeStyle = `hsla(${150 + (i / Math.max(1, pts.length - 1)) * 140}, 75%, 66%, ${fade})`;
        ctx.beginPath(); ctx.moveTo(pts[i][0] + shake, pts[i][1]); ctx.lineTo(pts[i - 1][0] + shake, pts[i - 1][1]); ctx.stroke();
      }
      const [hx, hy] = pts[0];
      if (yours() && !s.dead) { ctx.strokeStyle = 'rgba(255, 255, 255, .35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx, hy, c * 0.75, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = s.dead ? `rgba(251, 165, 165, ${fade})` : '#8FEAB0';
      ctx.beginPath(); ctx.arc(hx, hy, c * 0.48, 0, TAU); ctx.fill();
      // глаза смотрят туда, куда ползёт
      const [dx, dy] = s.dir;
      ctx.fillStyle = '#0f0d16';
      [-1, 1].forEach((side) => { ctx.beginPath(); ctx.arc(hx + dx * 1.6 - dy * side * 2, hy + dy * 1.6 + dx * side * 2, 1.1, 0, TAU); ctx.fill(); });
      if (end && !s.dead) { ctx.fillStyle = `rgba(251, 227, 142, ${0.25 * (1 - end / 1.4)})`; ctx.fillRect(0, 0, W, H); }
    },
  };
}

/* Каналы по порядку; pad — кнопки игры (по две слева и справа внизу экрана), keys — стрелки, пока
   мышь над окошком; touch — экран отвечает на зажатую мышь (сыпать песок, жать пупырки), тогда
   окошко двигают за шапку; hover — экран чувствует мышь и без нажатия (рыбки шарахаются). */
export const CHANNELS = [
  { id: 'ring', title: 'Шарик в кольце', make: ringChannel },
  { id: 'rings', title: 'Сквозь кольца', make: ringsChannel },
  { id: 'battle', title: 'Битва цветов', make: battleChannel },
  { id: 'wave', title: 'Маятники', make: waveChannel },
  { id: 'lava', title: 'Лава-лампа', make: lavaChannel },
  { id: 'flock', title: 'Стая', make: flockChannel, hover: true },
  { id: 'sand', title: 'Песок', make: sandChannel, touch: true },
  { id: 'pop', title: 'Поп-ит', make: popChannel, touch: true },
  { id: 'tetris', title: 'Тетрис', make: tetrisChannel,
    keys: { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'turn', ArrowDown: 'down', ' ': 'down' },
    pad: [[['left', 'Влево (←)'], ['turn', 'Повернуть (↑)']], [['right', 'Вправо (→)'], ['down', 'Бросить вниз (↓ или пробел)']]] },
  { id: 'snake', title: 'Змейка', make: snakeChannel,
    keys: { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' },
    pad: [[['left', 'Влево (←)'], ['up', 'Вверх (↑)']], [['down', 'Вниз (↓)'], ['right', 'Вправо (→)']]] },
];
