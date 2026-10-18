/* АНТИСТРЕСС (docs/mechanics.md, «Антистресс»). Маленькое окошко в углу урока на ПК: на него приятно
   поглядывать краем глаза, пока читаешь урок, а в паре каналов — и поиграть. Каналы: шарик в кольце,
   сквозь кольца, битва цветов, маятниковая волна, песок, поп-ит, тетрис и змейка, которые играют
   сами (их можно перехватить). Открывается с середины первого юнита — после четырёх пройденных уроков, в первый
   раз — со знакомством. Здесь — физика и игры без DOM. */

export const ANTISTRESS = { unlock: 4 };
// пройдено уроков — не меньше четырёх: середина первого юнита
export const antistressUnlocked = (learn) => Object.values((learn && learn.lessons) || {}).filter((l) => l && l.runs > 0).length >= ANTISTRESS.unlock;

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

/* ------------------------------ СКВОЗЬ КОЛЬЦА ------------------------------
   Девять колец одно в другом, у каждого своя прорезь и своя скорость, соседние крутятся в разные
   стороны. Шарик прыгает внутри самого маленького целого кольца; проскочил в прорезь — кольцо
   разлетается, и шарик уже внутри следующего. Разбиты все — шарик улетает, раунд заново. */
export const RINGS = { n: 9, r0: 18, r1: 74, gap: 0.62, spin: 0.75, g: 320, r: 3.2, vMin: 185 };
export function newRings(rand) {
  const rings = Array.from({ length: RINGS.n }, (_, i) => ({
    r: RINGS.r0 + (i * (RINGS.r1 - RINGS.r0)) / (RINGS.n - 1),
    phase: rand() * TAU,
    w: RINGS.spin * (1 + i * 0.06) * (i % 2 ? -1 : 1),
  }));
  return { x: 0, y: 0, vx: (rand() - 0.5) * 80, vy: 0, t: 0, cur: 0, rings, hits: 0 };
}
export const ringsGap = (ring, t) => wrap(ring.phase + ring.w * t);
// шаг: новое состояние и номер кольца, которое разбилось на этом шаге (−1 — ни одно)
export function stepRings(s, dt, rand) {
  const n = { ...s, t: s.t + dt, vy: s.vy + RINGS.g * dt };
  n.x = s.x + s.vx * dt; n.y = s.y + n.vy * dt;
  if (n.cur >= RINGS.n) return { s: n, broke: -1 };
  const ring = n.rings[n.cur];
  const d = Math.hypot(n.x, n.y);
  const lim = ring.r - RINGS.r;
  if (d < lim) return { s: n, broke: -1 };
  if (Math.abs(wrap(Math.atan2(n.y, n.x) - ringsGap(ring, n.t))) < RINGS.gap / 2) return { s: { ...n, cur: n.cur + 1 }, broke: n.cur };
  const nx = n.x / d; const ny = n.y / d;
  const dot = n.vx * nx + n.vy * ny;
  n.x = nx * lim; n.y = ny * lim;
  if (dot <= 0) return { s: n, broke: -1 };
  let vx = n.vx - 2 * dot * nx; let vy = n.vy - 2 * dot * ny;
  const kick = (rand() - 0.5) * 50;
  vx += -ny * kick; vy += nx * kick;
  const v = Math.hypot(vx, vy);
  if (v < RINGS.vMin) { vx *= RINGS.vMin / v; vy *= RINGS.vMin / v; }
  return { s: { ...n, vx, vy, hits: n.hits + 1 }, broke: -1 };
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

/* ------------------------------ ПЕСОК ------------------------------
   Клеточный песок: песчинка падает вниз, а если там занято — скатывается вниз-влево или вниз-вправо.
   Сверху сыплет струйка, цвет понемногу меняется — получаются слоистые барханы; насыпалось почти до
   половины — в дне открывается дырка, дно наклоняется к ней, и песок утекает, как в песочных часах. Мышью можно сыпать
   самому. Поле — массив w × h, 0 — пусто, иначе цвет песчинки. */
export const SAND = { w: 116, h: 82, full: 0.42, hole: 6 };
export function stepSand(g, w, h, rand) {
  for (let y = h - 2; y >= 0; y -= 1) {
    const ltr = rand() < 0.5;
    for (let k = 0; k < w; k += 1) {
      const x = ltr ? k : w - 1 - k;
      const i = y * w + x;
      const v = g[i];
      if (!v) continue;
      const b = i + w;
      if (!g[b]) { g[b] = v; g[i] = 0; continue; }
      const d = rand() < 0.5 ? -1 : 1;
      if (x + d >= 0 && x + d < w && !g[b + d]) { g[b + d] = v; g[i] = 0; } else if (x - d >= 0 && x - d < w && !g[b - d]) { g[b - d] = v; g[i] = 0; }
    }
  }
}
/* Дырка в дне: песчинки над ней уходят вниз, за край, а дно наклоняется к дырке — нижний ряд
   съезжает к середине, и утекает всё. Сколько ушло. */
export function drainSand(g, w, h) {
  let out = 0;
  const row = (h - 1) * w; const a = Math.floor(w / 2 - SAND.hole); const b = Math.ceil(w / 2 + SAND.hole);
  for (let x = a; x < b; x += 1) if (g[row + x]) { g[row + x] = 0; out += 1; }
  for (let x = a; x > 0; x -= 1) if (g[row + x - 1] && !g[row + x]) { g[row + x] = g[row + x - 1]; g[row + x - 1] = 0; }
  for (let x = b - 1; x < w - 1; x += 1) if (g[row + x + 1] && !g[row + x]) { g[row + x] = g[row + x + 1]; g[row + x + 1] = 0; }
  return out;
}

/* ------------------------------ ЗМЕЙКА ------------------------------
   Змейка на поле 24 × 17. Бот ищет кратчайший путь к еде (поиск в ширину) и идёт по нему, только если
   после еды сможет добраться до своего хвоста, — иначе тянется за хвостом, выбирая самый длинный
   безопасный путь. Ученик может перехватить стрелками; врезалась — начинает заново; выросла до
   120 клеток — победа, и тоже заново. */
export const SNAKE = { w: 24, h: 17, win: 120 };
export const SNAKE_DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const cellKey = (x, y) => y * SNAKE.w + x;
const onField = (x, y) => x >= 0 && y >= 0 && x < SNAKE.w && y < SNAKE.h;
const busyOf = (body) => new Set(body.map(([x, y]) => cellKey(x, y)));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
function placeFood(body, rand) {
  const busy = busyOf(body);
  const free = [];
  for (let y = 0; y < SNAKE.h; y += 1) for (let x = 0; x < SNAKE.w; x += 1) if (!busy.has(cellKey(x, y))) free.push([x, y]);
  return free.length ? free[Math.floor(rand() * free.length)] : null;
}
export const snakeWon = (s) => s.body.length >= SNAKE.win || !s.food;
export function newSnake(rand) {
  const y = Math.floor(SNAKE.h / 2);
  const body = [[5, y], [4, y], [3, y]];
  return { body, dir: [1, 0], food: placeFood(body, rand), dead: false, eaten: 0 };
}
// ход головой в сторону dir (развернуться назад нельзя); съела — растёт; в стену или в себя — dead
export function snakeMove(s, dir, rand) {
  const d = dir[0] === -s.dir[0] && dir[1] === -s.dir[1] ? s.dir : dir;
  const head = [s.body[0][0] + d[0], s.body[0][1] + d[1]];
  const eat = !!s.food && same(head, s.food);
  const rest = eat ? s.body : s.body.slice(0, -1);
  if (!onField(...head) || rest.some((c) => same(c, head))) return { ...s, dir: d, dead: true };
  const body = [head, ...rest];
  return { ...s, body, dir: d, food: eat ? placeFood(body, rand) : s.food, eaten: s.eaten + (eat ? 1 : 0) };
}
// кратчайший путь от from до to в обход занятых клеток (to может быть занята — это хвост): клетки без from или null
function route(from, to, busy) {
  const prev = new Map([[cellKey(...from), null]]);
  const q = [from];
  for (let i = 0; i < q.length; i += 1) {
    const c = q[i];
    if (same(c, to)) {
      const out = [];
      for (let p = c; prev.get(cellKey(...p)); p = prev.get(cellKey(...p))) out.unshift(p);
      return out;
    }
    for (const [dx, dy] of Object.values(SNAKE_DIRS)) {
      const n = [c[0] + dx, c[1] + dy]; const k = cellKey(...n);
      if (!onField(...n) || prev.has(k) || (busy.has(k) && !same(n, to))) continue;
      prev.set(k, c); q.push(n);
    }
  }
  return null;
}
// тело после того, как голова прошла по клеткам path (на еде — растёт)
function walk(body, path, food) {
  let v = body;
  path.forEach((c) => { v = [c, ...(food && same(c, food) ? v : v.slice(0, -1))]; });
  return v;
}
const tailReachable = (v) => !!route(v[0], v[v.length - 1], busyOf(v.slice(1, -1)));
export function snakeBot(s) {
  const { body, food } = s;
  const head = body[0];
  // к еде — если потом хвост достижим
  const toFood = food && route(head, food, busyOf(body.slice(0, -1)));
  if (toFood && tailReachable(walk(body, toFood, food))) return [toFood[0][0] - head[0], toFood[0][1] - head[1]];
  // иначе — ход, после которого хвост достижим и до него дальше всего: змейка тянет время, пока место освободится
  let best = null;
  for (const d of Object.values(SNAKE_DIRS)) {
    const n = [head[0] + d[0], head[1] + d[1]];
    if (!onField(...n) || (d[0] === -s.dir[0] && d[1] === -s.dir[1])) continue;
    const v = walk(body, [n], food);
    if (v.slice(1).some((c) => same(c, n))) continue;
    const back = route(n, v[v.length - 1], busyOf(v.slice(1, -1)));
    const score = back ? back.length + 1000 : 0;
    if (!best || score > best.score) best = { d, score };
  }
  return best ? best.d : s.dir;
}

/* ------------------------------ БИТВА ЦВЕТОВ ------------------------------
   Поле из квадратиков поделено между четырьмя цветами, у каждого — по два бойца. Вокруг бойца
   крутится меч: клетки, по которым он проводит, становятся цвета бойца. Бойцы бродят и заходят на
   чужую землю — каждый выбирает себе чужую клетку и идёт к ней. Задел мечом чужого бойца — тот
   переходит на твою сторону. Раз в несколько секунд у цвета с заметной территорией появляется
   подкрепление. Остался один цвет — победа; затянулось дольше 2,5 минуты — побеждает тот, у кого
   больше земли. И заново. */
export const BATTLE = { cols: 46, rows: 32, cell: 5, teams: 4, start: 2, r: 3.4, sword: 11, speed: 30, spin: 4.2, aim: 2.5, spawn: 5, share: 0.15, cap: 4, safe: 0.8, limit: 150 };
const fighter = (x, y, team, rand, safe = 0) => {
  const a = rand() * Math.PI * 2;
  return { x, y, vx: Math.cos(a) * BATTLE.speed, vy: Math.sin(a) * BATTLE.speed, a, w: BATTLE.spin * (rand() < 0.5 ? -1 : 1), team, safe, goal: null, goalT: 0 };
};
export function newBattle(rand) {
  const { cols, rows, cell } = BATTLE;
  const cells = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) cells[y * cols + x] = (x < cols / 2 ? 0 : 1) + (y < rows / 2 ? 0 : 2);
  const fighters = [];
  for (let team = 0; team < BATTLE.teams; team += 1) {
    for (let k = 0; k < BATTLE.start; k += 1) {
      const qx = team % 2 ? cols / 2 : 0; const qy = team > 1 ? rows / 2 : 0;
      fighters.push(fighter((qx + cols / 4 + (k ? 5 : -5)) * cell, (qy + rows / 4 + (k ? 3 : -3)) * cell, team, rand));
    }
  }
  return { cells, fighters, t: 0, spawnT: 0, winner: -1, turns: 0 };
}
export const battleShare = (s) => {
  const n = Array(BATTLE.teams).fill(0);
  s.cells.forEach((c) => { n[c] += 1; });
  return n.map((v) => v / s.cells.length);
};
// расстояние от точки до отрезка
const toSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax; const dy = by - ay;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - k * dx, py - ay - k * dy);
};
export const swordTip = (f) => [f.x + Math.cos(f.a) * BATTLE.sword, f.y + Math.sin(f.a) * BATTLE.sword];
// чужая клетка поблизости: из нескольких случайных — ближайшая
function enemyCell(s, f, rand) {
  const { cols, cell } = BATTLE;
  let best = null; let bd = Infinity;
  for (let k = 0; k < 24; k += 1) {
    const i = Math.floor(rand() * s.cells.length);
    if (s.cells[i] === f.team) continue;
    const x = (i % cols + 0.5) * cell; const y = (Math.floor(i / cols) + 0.5) * cell;
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}
/* Шаг битвы (на месте): двигает бойцов и мечи, красит клетки, переманивает задетых, даёт
   подкрепление. Возвращает события: painted — номера перекрашенных клеток, turned — кто перешёл. */
export function stepBattle(s, dt, rand) {
  const { cols, rows, cell, r } = BATTLE;
  const W = cols * cell; const H = rows * cell;
  const painted = []; const turned = [];
  s.t += dt;
  if (s.winner >= 0) return { painted, turned };
  for (const f of s.fighters) {
    f.goalT -= dt;
    if (f.goalT <= 0) { f.goal = enemyCell(s, f, rand); f.goalT = BATTLE.aim * (0.6 + rand() * 0.8); }
    let ang = Math.atan2(f.vy, f.vx) + (rand() - 0.5) * 3 * dt;
    if (f.goal) {
      const want = Math.atan2(f.goal[1] - f.y, f.goal[0] - f.x);
      const diff = ((want - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      ang += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    }
    f.vx = Math.cos(ang) * BATTLE.speed; f.vy = Math.sin(ang) * BATTLE.speed;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < r) { f.x = r; f.vx = Math.abs(f.vx); } else if (f.x > W - r) { f.x = W - r; f.vx = -Math.abs(f.vx); }
    if (f.y < r) { f.y = r; f.vy = Math.abs(f.vy); } else if (f.y > H - r) { f.y = H - r; f.vy = -Math.abs(f.vy); }
    f.a += f.w * dt; f.safe = Math.max(0, f.safe - dt);
    // меч красит клетки под собой — от бойца до острия
    for (let k = 0; k <= 8; k += 1) {
      const d = (BATTLE.sword * k) / 8;
      const cx = Math.floor((f.x + Math.cos(f.a) * d) / cell); const cy = Math.floor((f.y + Math.sin(f.a) * d) / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const i = cy * cols + cx;
      if (s.cells[i] !== f.team) { s.cells[i] = f.team; painted.push(i); }
    }
  }
  // меч задел чужого — тот переходит на сторону владельца меча
  for (const f of s.fighters) {
    const [tx, ty] = swordTip(f);
    for (const g of s.fighters) {
      if (g === f || g.team === f.team || g.safe > 0 || f.safe > 0) continue;
      if (toSegment(g.x, g.y, f.x, f.y, tx, ty) < r + 1) { g.team = f.team; g.safe = BATTLE.safe; g.goalT = 0; turned.push(g); s.turns += 1; }
    }
  }
  // подкрепление: цвету, у которого есть бойцы и заметная территория, — новый боец на своей клетке
  s.spawnT += dt;
  if (s.spawnT >= BATTLE.spawn) {
    s.spawnT = 0;
    const share = battleShare(s);
    for (let team = 0; team < BATTLE.teams; team += 1) {
      const mine = s.fighters.filter((f) => f.team === team).length;
      if (!mine || mine >= BATTLE.cap || share[team] < BATTLE.share) continue;
      for (let k = 0; k < 40; k += 1) {
        const i = Math.floor(rand() * s.cells.length);
        if (s.cells[i] !== team) continue;
        s.fighters.push({ ...fighter((i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.5) * cell, team, rand, BATTLE.safe), born: s.t });
        break;
      }
    }
  }
  if (new Set(s.fighters.map((f) => f.team)).size === 1) s.winner = s.fighters[0].team;
  else if (s.t > BATTLE.limit) { const share = battleShare(s); s.winner = share.indexOf(Math.max(...share)); }
  return { painted, turned };
}
