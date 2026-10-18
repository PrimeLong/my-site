/* Каналы антистресса (learn-antistress.jsx): каждый рисует себя на экране W × H в своих координатах
   (окошко растягивается — экран масштабирует холст целиком) и умеет шаг времени. Физика и игры —
   в learn/antistress.js; здесь — картинка, частицы и управление. Интерфейс канала: step(dt),
   draw(ctx, font); по желанию input(действие) — кнопки и стрелки, pointer(тип, x, y) — мышь по
   экрану, player() — кто играет: бот или ученик. */
import {
  RING, newBall, stepBall, gapAt, RINGS, newRings, stepRings, ringsGap, PEND, pendulumAngle, pendulumAlign,
  TET, PIECES, emptyBoard, cellsOf, fits, spawn, shift, turn, fall, lock, clearLines, bag, bestMove,
  SAND, stepSand, drainSand, SNAKE, SNAKE_DIRS, newSnake, snakeMove, snakeBot, snakeWon, BATTLE, newBattle, stepBattle, battleShare, swordTip,
} from './learn/antistress.js';
import { Audio } from './MacroSimulator.jsx';

export const W = 232; export const H = 164;
const TAU = Math.PI * 2;
// нажали недавно — играет ученик; столько секунд без нажатий — снова бот
const OWN = 4;

function backdrop(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#231e33'); g.addColorStop(1, '#0f0d16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// подпись канала; pill — на тёмной подложке, если под ней что-то движется
function caption(ctx, text, font, x = 9, y = 15, align = 'left', pill = false) {
  ctx.font = `600 9.5px ${font}`; ctx.textAlign = align;
  if (pill) {
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(15, 13, 22, .6)'; ctx.beginPath(); ctx.roundRect(align === 'left' ? x - 6 : x - w - 6, y - 10.5, w + 12, 15, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, .5)';
  ctx.fillText(text, x, y);
}
function glowDot(ctx, x, y, r, hue) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, `hsl(${hue}, 100%, 92%)`); g.addColorStop(0.55, `hsl(${hue}, 90%, 70%)`); g.addColorStop(1, `hsl(${hue}, 80%, 52%)`);
  ctx.save(); ctx.shadowBlur = r * 1.6; ctx.shadowColor = `hsla(${hue}, 95%, 65%, .8)`;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
export function paintChannel(ctx, ch, font) { backdrop(ctx); ch.draw(ctx, font); }

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
    draw(ctx, font) {
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
      caption(ctx, s.cur < RINGS.n ? `колец: ${RINGS.n - s.cur}` : 'на свободе!', font);
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

/* Битва цветов: поле из квадратиков, у каждого бойца вокруг крутится меч. Клетки под мечом
   становятся цвета бойца — только что захваченные вспыхивают; задетый мечом чужой боец переходит на
   его сторону (вокруг — кольцо). Сверху — полоска: кому сколько земли. Остался один цвет — «Победа»,
   и новая битва. */
// жёлтый на тёмном быстро становится болотным — ему чуть светлее
const TEAMS = [{ name: 'красные', h: 355, l: 0 }, { name: 'синие', h: 214, l: 0 }, { name: 'жёлтые', h: 46, l: 8 }, { name: 'зелёные', h: 142, l: -2 }];
function battleChannel(rand) {
  const { cols, rows, cell } = BATTLE;
  const ox = (W - cols * cell) / 2; const oy = (H - rows * cell) / 2;
  // клетка: цвет команды, захваченная только что — светлее (4 ступени вспышки)
  const paint = TEAMS.map((tm) => [0, 1, 2, 3].map((k) => `hsl(${tm.h}, ${62 + k * 8}%, ${38 + tm.l + k * 8}%)`));
  const flash = new Float32Array(cols * rows);
  let s = newBattle(rand); let acc = 0; let rings = []; let end = 0;
  return {
    step(dt) {
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        const { painted, turned } = stepBattle(s, 1 / 60, rand);
        painted.forEach((i) => { flash[i] = 1; });
        turned.forEach((g) => rings.push({ x: g.x, y: g.y, t: 0, h: TEAMS[g.team].h }));
      }
      for (let i = 0; i < flash.length; i += 1) if (flash[i]) flash[i] = Math.max(0, flash[i] - dt * 2.2);
      rings = rings.filter((r) => (r.t += dt) < 0.6);
      if (s.winner >= 0) { end += dt; if (end > 3) { s = newBattle(rand); flash.fill(0); rings = []; end = 0; } }
    },
    draw(ctx, font) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const i = y * cols + x;
          ctx.fillStyle = paint[s.cells[i]][Math.min(3, Math.ceil(flash[i] * 3))];
          ctx.fillRect(ox + x * cell + 0.4, oy + y * cell + 0.4, cell - 0.8, cell - 0.8);
        }
      }
      ctx.lineCap = 'round';
      s.fighters.forEach((f) => {
        const x = ox + f.x; const y = oy + f.y; const h = TEAMS[f.team].h;
        const [tx, ty] = swordTip(f);
        // след взмаха — светлый веер за клинком
        ctx.fillStyle = `hsla(${h}, 90%, 80%, .22)`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, BATTLE.sword, f.a - Math.sign(f.w) * 0.9, f.a, f.w < 0); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = `hsl(${h}, 95%, 70%)`;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(f.a) * 3, y + Math.sin(f.a) * 3); ctx.lineTo(ox + tx, oy + ty); ctx.stroke();
        ctx.restore();
        if (f.safe > 0 && Math.floor(f.safe * 10) % 2) return;
        ctx.fillStyle = `hsl(${h}, 85%, 62%)`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, BATTLE.r + 0.6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#16131f';
        [-1, 1].forEach((k) => { ctx.beginPath(); ctx.arc(x + k * 1.3, y - 0.6, 0.6, 0, TAU); ctx.fill(); });
      });
      rings.forEach((r) => {
        const k = r.t / 0.6;
        ctx.strokeStyle = `hsla(${r.h}, 95%, 80%, ${1 - k})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ox + r.x, oy + r.y, 4 + k * 14, 0, TAU); ctx.stroke();
      });
      // полоска земли: кому сколько
      const share = battleShare(s); const bw = 96; const bx = W - bw - 9; let sx = bx;
      ctx.fillStyle = 'rgba(15, 13, 22, .6)'; ctx.beginPath(); ctx.roundRect(bx - 5, 5, bw + 10, 13, 6.5); ctx.fill();
      share.forEach((v, team) => { ctx.fillStyle = `hsl(${TEAMS[team].h}, 80%, 62%)`; ctx.fillRect(sx, 9.5, bw * v, 4); sx += bw * v; });
      caption(ctx, `бойцов: ${s.fighters.length}`, font, 11, 15, 'left', true);
      if (s.winner >= 0) {
        const tm = TEAMS[s.winner];
        ctx.fillStyle = `rgba(15, 13, 22, ${Math.min(0.55, end)})`; ctx.fillRect(0, 0, W, H);
        ctx.font = `800 18px ${font}`; ctx.textAlign = 'center'; ctx.fillStyle = `hsl(${tm.h}, 90%, 72%)`;
        ctx.fillText(`Победа: ${tm.name}!`, W / 2, H / 2 + 6);
      }
    },
  };
}

/* Песок: сверху сыплет струйка, цвет понемногу меняется — слоистые барханы; насыпалось почти до
   половины — в дне открывается дырка, и песок утекает. Зажали мышь на экране — песок сыплется оттуда. */
const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
};
let sandPalette = null;
// 64 оттенка × 4 яркости, пиксели в порядке ImageData (RGBA, младший байт — R)
function sandColors() {
  if (sandPalette) return sandPalette;
  sandPalette = new Uint32Array(256);
  for (let i = 0; i < 64; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const [r, g, b] = hsl((i * 360) / 64, 0.72, 0.6 + j * 0.035);
      sandPalette[i * 4 + j] = (255 << 24 | b << 16 | g << 8 | r) >>> 0;
    }
  }
  return sandPalette;
}
function sandChannel(rand) {
  const { w, h } = SAND;
  const g = new Uint16Array(w * h);
  const img = new ImageData(w, h); const px = new Uint32Array(img.data.buffer);
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const octx = off.getContext('2d');
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
    else if (!drain && t - handT > 2) { const x = w / 2 + Math.sin(t * 0.6) * w * 0.36; drop(x, 0); drop(x + 1, 0); }
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
    draw(ctx, font) {
      for (let i = 0; i < g.length; i += 1) px[i] = g[i] ? pal[g[i] - 1] : 0;
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
      // дырка в дне — светлая щель, пока песок утекает
      if (drain) {
        ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#FBE38E'; ctx.fillStyle = 'rgba(251, 227, 142, .9)';
        ctx.fillRect(W / 2 - SAND.hole * 2, H - 1.5, SAND.hole * 4, 1.5); ctx.restore();
      }
      caption(ctx, drain ? 'песок утекает…' : `песчинок: ${grains}`, font, 11, 15, 'left', true);
    },
  };
}

/* Поп-ит: ряды силиконовых пупырок цветами радуги. Нажали — пупырка вдавилась (можно провести по
   ряду, не отпуская); вдавлены все — поп-ит переворачивается, и всё сначала. Пока не трогают, его
   неторопливо прожимает сам невидимый палец — змейкой по рядам. */
const POP_HUES = [355, 22, 46, 140, 196, 262];
function popChannel() {
  const cols = 8; const rows = POP_HUES.length; const d = 17; const gap = 3.6;
  const bw = cols * (d + gap) - gap; const bh = rows * (d + gap) - gap; const ox = (W - bw) / 2; const oy = (H - bh) / 2 + 4;
  const down = Array(rows * cols).fill(false); const at = Array(rows * cols).fill(-9);
  // змейкой: первый ряд слева направо, второй — справа налево…
  const order = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r * cols + (r % 2 ? cols - 1 - c : c))).flat();
  // палец-автомат начинает через 3 секунды тишины — и с открытия канала тоже
  let t = 0; let flip = 0; let held = false; let handT = 0; let mineT = -99; let autoT = 0; let finger = null; let pops = 0;
  const center = (i) => [ox + (i % cols) * (d + gap) + d / 2, oy + Math.floor(i / cols) * (d + gap) + d / 2];
  const press = (i, mine) => {
    if (i < 0 || down[i] || flip) return;
    down[i] = true; at[i] = t; pops += 1;
    if (mine) { mineT = t; Audio.play('tick'); }
  };
  const hit = (x, y) => down.findIndex((_, i) => { const [cx, cy] = center(i); return Math.hypot(x - cx, y - cy) < d / 2 + 1.5; });
  return {
    step(dt) {
      t += dt;
      if (flip) {
        flip += dt;
        if (flip > 0.28 && down.some(Boolean)) down.fill(false);
        if (flip > 0.56) flip = 0;
        return;
      }
      if (down.every(Boolean)) { flip = 0.001; finger = null; return; }
      if (t - handT > 3) {
        autoT += dt;
        if (autoT > 0.24) { autoT = 0; const i = order.find((k) => !down[k]); finger = center(i); press(i, false); }
      } else finger = null;
    },
    player: () => (t - mineT < OWN ? 'you' : 'bot'),
    pointer(type, x, y) {
      if (type === 'down') { held = true; handT = t; press(hit(x, y), true); } else if (type === 'move' && held) { handT = t; press(hit(x, y), true); } else if (type === 'up') { held = false; handT = t; }
    },
    draw(ctx, font) {
      const k = flip ? Math.abs(Math.cos((flip / 0.56) * Math.PI)) : 1;
      ctx.save(); ctx.translate(W / 2, 0); ctx.scale(Math.max(0.02, k), 1); ctx.translate(-W / 2, 0);
      // силиконовая подложка — радуга по рядам
      const base = ctx.createLinearGradient(0, oy, 0, oy + bh);
      POP_HUES.forEach((hh, r) => base.addColorStop(r / (rows - 1), `hsl(${hh}, 70%, 62%)`));
      ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(ox - 9, oy - 9, bw + 18, bh + 18, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, .35)'; ctx.lineWidth = 1; ctx.stroke();
      down.forEach((isDown, i) => {
        const [cx, cy] = center(i); const hh = POP_HUES[Math.floor(i / cols)];
        const sq = t - at[i] < 0.16 ? 1 - Math.sin(((t - at[i]) / 0.16) * Math.PI) * 0.14 : 1;
        const r = (d / 2) * sq;
        const gr = isDown
          ? ctx.createRadialGradient(cx + r * 0.35, cy + r * 0.4, r * 0.1, cx, cy, r)
          : ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
        if (isDown) { gr.addColorStop(0, `hsl(${hh}, 70%, 70%)`); gr.addColorStop(0.7, `hsl(${hh}, 62%, 56%)`); gr.addColorStop(1, `hsl(${hh}, 60%, 42%)`); } else {
          gr.addColorStop(0, `hsl(${hh}, 100%, 88%)`); gr.addColorStop(0.6, `hsl(${hh}, 75%, 66%)`); gr.addColorStop(1, `hsl(${hh}, 65%, 50%)`);
          ctx.fillStyle = 'rgba(0, 0, 0, .18)'; ctx.beginPath(); ctx.arc(cx + 0.8, cy + 1.6, r, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      });
      ctx.restore();
      if (finger) { ctx.fillStyle = 'rgba(255, 255, 255, .22)'; ctx.beginPath(); ctx.arc(finger[0] + 3, finger[1] + 3, 6, 0, TAU); ctx.fill(); }
      caption(ctx, `поп: ${pops}`, font, 9, 13);
    },
  };
}

/* Тетрис: бот ставит фигуры, двигая их, как человек. Нажали ←, ⟳, →, ⤓ (или стрелки, пока мышь над
   окошком) — фигура ваша; не трогали 4 секунды — следующая снова у бота. Поле переполнилось —
   рассыпается, и игра идёт дальше. */
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
        const qx = rx - ((Math.max(...xs) - Math.min(...xs) + 1) * m) / 2 - Math.min(...xs) * m;
        const qy = 34 - Math.min(...ys) * m;
        cs.forEach(([x, y]) => cell(ctx, qx + x * m, qy + y * m, m, st.next));
      }
      caption(ctx, yours() ? 'играете вы' : 'играет бот', font, lx, H - 54, 'center');
    },
  };
}

/* Змейка: бот ищет путь к еде и не загоняет себя в угол; стрелками или кнопками змейку можно взять
   себе, 4 секунды без нажатий — снова бот. Врезалась — рассыпается и начинает заново; выросла до
   победы — салют и тоже заново. */
function snakeChannel(rand) {
  const c = 9; const bw = SNAKE.w * c; const bh = SNAKE.h * c; const ox = (W - bw) / 2; const oy = (H - bh) / 2;
  let s = newSnake(rand); let t = 0; let acc = 0; let input = -99; let want = null; let end = 0; let best = s.body.length;
  const yours = () => t - input < OWN;
  const mid = ([x, y]) => [ox + x * c + c / 2, oy + y * c + c / 2];
  return {
    step(dt) {
      t += dt;
      if (end) { end += dt; if (end > 1.4) { s = newSnake(rand); end = 0; } return; }
      const every = yours() ? 0.15 : 0.11;
      acc += dt;
      while (acc >= every && !end) {
        acc -= every;
        s = snakeMove(s, yours() ? want || s.dir : snakeBot(s), rand);
        want = null;
        best = Math.max(best, s.body.length);
        if (s.dead || snakeWon(s)) end = 0.001;
      }
    },
    input(a) { input = t; want = SNAKE_DIRS[a]; },
    player: () => (yours() ? 'you' : 'bot'),
    draw(ctx, font) {
      ctx.fillStyle = 'rgba(255, 255, 255, .04)'; ctx.beginPath(); ctx.roundRect(ox - 2, oy - 2, bw + 4, bh + 4, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .07)';
      for (let y = 0; y < SNAKE.h; y += 1) for (let x = 0; x < SNAKE.w; x += 1) ctx.fillRect(ox + x * c + c / 2 - 0.5, oy + y * c + c / 2 - 0.5, 1, 1);
      if (s.food) {
        const [fx, fy] = mid(s.food);
        glowDot(ctx, fx, fy, 3.2 + Math.sin(t * 6) * 0.5, 45);
      }
      const n = s.body.length; const fade = s.dead ? Math.max(0, 1 - end / 1.2) : 1;
      ctx.lineCap = 'round'; ctx.lineWidth = c * 0.7;
      for (let i = n - 1; i > 0; i -= 1) {
        const [ax, ay] = mid(s.body[i]); const [bx2, by2] = mid(s.body[i - 1]);
        const shake = s.dead ? (Math.sin(i * 7 + end * 40) * end * 4) : 0;
        ctx.strokeStyle = `hsla(${150 + (i / Math.max(1, n - 1)) * 140}, 75%, 66%, ${fade})`;
        ctx.beginPath(); ctx.moveTo(ax + shake, ay); ctx.lineTo(bx2 + shake, by2); ctx.stroke();
      }
      const [hx, hy] = mid(s.body[0]);
      ctx.fillStyle = s.dead ? `rgba(251, 165, 165, ${fade})` : '#8FEAB0';
      ctx.beginPath(); ctx.arc(hx, hy, c * 0.48, 0, TAU); ctx.fill();
      // глаза смотрят туда, куда ползёт
      const [dx, dy] = s.dir;
      ctx.fillStyle = '#0f0d16';
      [-1, 1].forEach((side) => { ctx.beginPath(); ctx.arc(hx + dx * 1.6 - dy * side * 2, hy + dy * 1.6 + dx * side * 2, 1.1, 0, TAU); ctx.fill(); });
      if (end && !s.dead) { ctx.fillStyle = `rgba(251, 227, 142, ${0.25 * (1 - end / 1.4)})`; ctx.fillRect(0, 0, W, H); }
      caption(ctx, `длина: ${n} · ${yours() ? 'играете вы' : 'играет бот'}`, font, 11, 14.5, 'left', true);
      if (best > n && !end) caption(ctx, `рекорд: ${best}`, font, W - 9, 14.5, 'right');
    },
  };
}

/* Каналы по порядку; pad — кнопки игры (по две слева и справа внизу экрана), keys — стрелки, пока
   мышь над окошком; touch — экран отвечает на мышь (сыпать песок, жать пупырки), тогда окошко
   двигают за шапку. */
export const CHANNELS = [
  { id: 'ring', title: 'Шарик в кольце', make: ringChannel },
  { id: 'rings', title: 'Сквозь кольца', make: ringsChannel },
  { id: 'battle', title: 'Битва цветов', make: battleChannel },
  { id: 'wave', title: 'Маятники', make: waveChannel },
  { id: 'sand', title: 'Песок', make: sandChannel, touch: true },
  { id: 'pop', title: 'Поп-ит', make: popChannel, touch: true },
  { id: 'tetris', title: 'Тетрис', make: tetrisChannel,
    keys: { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'turn', ArrowDown: 'down', ' ': 'down' },
    pad: [[['left', 'Влево (←)'], ['turn', 'Повернуть (↑)']], [['right', 'Вправо (→)'], ['down', 'Бросить вниз (↓ или пробел)']]] },
  { id: 'snake', title: 'Змейка', make: snakeChannel,
    keys: { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' },
    pad: [[['left', 'Влево (←)'], ['up', 'Вверх (↑)']], [['down', 'Вниз (↓)'], ['right', 'Вправо (→)']]] },
];
