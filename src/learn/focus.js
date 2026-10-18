/* УГОЛОК ДЛЯ ФОКУСА (docs/mechanics.md, «Уголок для фокуса»). Маленькое окошко в углу урока на ПК —
   спокойная картинка, на которую можно смотреть краем глаза, пока слушаешь и читаешь, как видео в
   углу у стримеров: тем, кому трудно удерживать внимание, так легче. Каналы: шарик в кольце,
   маятниковая волна, тетрис, который играет сам (его можно перехватить). Открывается с середины
   первого юнита — после четырёх пройденных уроков, и в первый раз — с подсказкой.
   Здесь — физика и игра без DOM: шарик, маятники, тетрис и его бот. */

export const FOCUS = { unlock: 4 };
// пройдено уроков — не меньше четырёх: середина первого юнита
export const focusUnlocked = (learn) => Object.values((learn && learn.lessons) || {}).filter((l) => l && l.runs > 0).length >= FOCUS.unlock;

const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;

/* ------------------------------ ШАРИК В КОЛЬЦЕ ------------------------------
   Шарик падает внутри вращающегося кольца с прорезью и отскакивает от стенки без потерь. С каждым
   ударом он чуть растёт, а прорезь, сперва закрытая, понемногу раскрывается — рано или поздно он вылетает, и раунд начинается
   заново. От каждого удара остаётся точка на кольце: от неё к шарику тянется нить. */
export const RING = { r: 62, gap: 0, gapGrow: 0.008, spin: 0.85, g: 420, r0: 4.5, grow: 0.3, rMax: 16, vMin: 230, hits: 64 };
export function newBall(rand, round = 0) {
  return { x: (rand() - 0.5) * 20, y: -RING.r * 0.45, vx: (rand() - 0.5) * 180, vy: 0, r: RING.r0, gap: RING.gap, hits: [], k: 0, out: false, t: 0, round };
}
// центр прорези в момент t: кольцо поворачивается с постоянной скоростью
export const gapAt = (t) => wrap(RING.spin * t - Math.PI / 2);
export function stepBall(b, dt, rand) {
  const n = { ...b, t: b.t + dt, vy: b.vy + RING.g * dt };
  n.x = b.x + b.vx * dt; n.y = b.y + n.vy * dt;
  if (b.out) return n;
  const d = Math.hypot(n.x, n.y);
  const lim = RING.r - n.r;
  if (d < lim) return n;
  const ang = Math.atan2(n.y, n.x);
  // центр шарика в прорези — вылетает: дальше только падение
  if (Math.abs(wrap(ang - gapAt(n.t))) < n.gap / 2) return { ...n, out: true };
  const nx = n.x / d; const ny = n.y / d;
  const dot = n.vx * nx + n.vy * ny;
  n.x = nx * lim; n.y = ny * lim;
  if (dot <= 0) return n;
  // удар: шарик подрос — ставим его к стенке уже с новым радиусом
  const r = Math.min(RING.rMax, n.r + RING.grow);
  n.x = nx * (RING.r - r); n.y = ny * (RING.r - r);
  let vx = n.vx - 2 * dot * nx; let vy = n.vy - 2 * dot * ny;
  // лёгкий случайный толчок вдоль стенки — чтобы шарик не ходил по одной траектории
  const kick = (rand() - 0.5) * 40;
  vx += -ny * kick; vy += nx * kick;
  const v = Math.hypot(vx, vy);
  if (v < RING.vMin) { vx *= RING.vMin / v; vy *= RING.vMin / v; }
  return { ...n, vx, vy, r, gap: n.gap + RING.gapGrow, hits: [...n.hits, ang].slice(-RING.hits), k: n.k + 1 };
}

/* ------------------------------ МАЯТНИКОВАЯ ВОЛНА ------------------------------
   Маятники разной длины: за цикл i-й делает (k + i) качаний, поэтому все вместе складываются то в
   змейку, то в волну, то в два ряда — и через цикл снова встают в одну линию. */
export const PEND = { n: 15, cycle: 60, k: 18, amp: 0.5 };
export const pendulumAngle = (i, t) => PEND.amp * Math.cos((TAU * (PEND.k + i) * t) / PEND.cycle);
// сколько секунд до того, как маятники снова выстроятся в линию
export const pendulumAlign = (t) => PEND.cycle - (((t % PEND.cycle) + PEND.cycle) % PEND.cycle);

/* ------------------------------ ТЕТРИС САМ С СОБОЙ ------------------------------
   Обычный тетрис 10 × 20: фигуры по «мешку» из семи, поворот с отскоком от стен, сгорание линий.
   Бот выбирает для каждой фигуры поворот и столбец по оценке поля после падения: ниже стопка,
   больше сгоревших линий, меньше дыр и ступенек (веса известного простого бота). Ученик может
   перехватить фигуру кнопками; поле переполнилось — очищается, и игра идёт дальше: проиграть нельзя. */
export const TET = { w: 10, h: 20 };
const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
export const PIECES = Object.keys(SHAPES);
const SIZE = { I: 4, O: 4 };
// клетки фигуры в повороте rot (поворот по часовой внутри её квадрата 3×3 или 4×4)
export function shapeCells(type, rot) {
  const n = SIZE[type] || 3;
  let cells = SHAPES[type];
  if (type !== 'O') for (let k = 0; k < (((rot % 4) + 4) % 4); k += 1) cells = cells.map(([x, y]) => [n - 1 - y, x]);
  return cells;
}
export const emptyBoard = () => Array.from({ length: TET.h }, () => Array(TET.w).fill(0));
export const cellsOf = (p) => shapeCells(p.type, p.rot).map(([x, y]) => [p.x + x, p.y + y]);
export function fits(board, p) {
  return cellsOf(p).every(([x, y]) => x >= 0 && x < TET.w && y < TET.h && (y < 0 || !board[y][x]));
}
export const spawn = (type) => ({ type, rot: 0, x: 3, y: type === 'I' ? -1 : 0 });
export function shift(board, p, dx) { const q = { ...p, x: p.x + dx }; return fits(board, q) ? q : p; }
export function turn(board, p) {
  for (const k of [0, -1, 1, -2, 2]) { const q = { ...p, rot: (p.rot + 1) % 4, x: p.x + k }; if (fits(board, q)) return q; }
  return p;
}
export function fall(board, p) { let q = p; while (fits(board, { ...q, y: q.y + 1 })) q = { ...q, y: q.y + 1 }; return q; }
export function lock(board, p) {
  const b = board.map((row) => row.slice());
  const c = PIECES.indexOf(p.type) + 1;
  cellsOf(p).forEach(([x, y]) => { if (y >= 0) b[y][x] = c; });
  return b;
}
// сгоревшие линии: какие строки и поле после них
export function clearLines(board) {
  const rows = board.map((r, y) => (r.every(Boolean) ? y : -1)).filter((y) => y >= 0);
  if (!rows.length) return { board, rows };
  const kept = board.filter((_, y) => !rows.includes(y));
  return { board: [...Array.from({ length: rows.length }, () => Array(TET.w).fill(0)), ...kept], rows };
}
// мешок из семи фигур в случайном порядке: каждая фигура встречается раз в семь
export function bag(rand) {
  const a = PIECES.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function features(board) {
  const heights = Array.from({ length: TET.w }, (_, x) => { const y = board.findIndex((r) => r[x]); return y < 0 ? 0 : TET.h - y; });
  let holes = 0;
  for (let x = 0; x < TET.w; x += 1) { let roof = false; for (let y = 0; y < TET.h; y += 1) { if (board[y][x]) roof = true; else if (roof) holes += 1; } }
  const bump = heights.slice(1).reduce((a, h, i) => a + Math.abs(h - heights[i]), 0);
  return { agg: heights.reduce((a, h) => a + h, 0), holes, bump, max: Math.max(...heights) };
}
export const BOT = { agg: -0.51, lines: 0.76, holes: -0.36, bump: -0.18 };
// лучший ход бота для фигуры: поворот, столбец и оценка
export function bestMove(board, type) {
  let best = null;
  for (let rot = 0; rot < (type === 'O' ? 1 : 4); rot += 1) {
    for (let x = -2; x < TET.w + 2; x += 1) {
      const p = { ...spawn(type), rot, x };
      if (!fits(board, p)) continue;
      const landed = fall(board, p);
      const { board: after, rows } = clearLines(lock(board, landed));
      const f = features(after);
      const score = BOT.agg * f.agg + BOT.lines * rows.length + BOT.holes * f.holes + BOT.bump * f.bump;
      if (!best || score > best.score) best = { rot, x, score };
    }
  }
  return best;
}
