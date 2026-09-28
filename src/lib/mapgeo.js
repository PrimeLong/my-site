/* ГЕОМЕТРИЯ КАРТЫ ИНФЛАТИИ — общая для карты страны в партии (src/countrymap.jsx) и для
   Пути обучения (дорога по карте, src/learn.jsx). Чистый модуль без React: узлы и границы
   округов, берег, река, областные центры. Подробности устройства — в src/countrymap.jsx. */
const VIEW_W = 1000; const VIEW_H = 720; const VIEW_TOP = -130;
const NODES = {
  A: [215, 115], J1: [480, 108], H: [790, 140], J4: [835, 250],
  F1: [800, 360], F2: [698, 426], F3: [790, 480], J10: [700, 560],
  E: [560, 630], D: [330, 650], C: [165, 450], K: [180, 320],
  J2: [450, 225], J3: [660, 255],
  S1: [410, 330], S2: [580, 335], S3: [615, 425], S4: [505, 480], S5: [395, 425],
};
/* kind: coast — морской берег, north/west/southwest — сухопутная граница
   с соседним государством, inner — граница между округами. mids — ручные
   изгибы: мысы, бухты, водоразделы. */
const EDGES = [
  ['A', 'J1', 'north', [[300, 92], [390, 122]]],
  ['J1', 'H', 'north', [[560, 86], [640, 122], [720, 104]]],
  ['H', 'J4', 'coast', [[830, 168], [812, 205], [852, 226]]],
  ['J4', 'F1', 'coast', [[866, 298], [828, 334]]],
  ['F1', 'F2', 'coast', [[764, 366], [726, 392]]],
  ['F2', 'F3', 'coast', [[722, 458], [760, 468]]],
  ['F3', 'J10', 'coast', [[812, 500], [762, 532]]],
  ['J10', 'E', 'coast', [[662, 602], [612, 604]]],
  ['E', 'D', 'coast', [[500, 662], [420, 640]]],
  ['D', 'C', 'southwest', [[262, 600], [232, 520]]],
  ['C', 'K', 'west', [[150, 400], [192, 362]]],
  ['K', 'A', 'west', [[148, 250], [192, 190]]],
  ['J1', 'J2', 'inner', [[470, 168]]],
  ['J2', 'J3', 'inner', [[540, 238], [600, 262]]],
  ['J3', 'J4', 'inner', [[732, 246], [790, 262]]],
  ['J2', 'S1', 'inner', [[428, 278]]],
  ['J3', 'S2', 'inner', [[626, 298]]],
  ['S1', 'S2', 'inner', [[492, 318]]],
  ['S2', 'S3', 'inner', [[612, 380]]],
  ['S3', 'J10', 'inner', [[652, 486]]],
  ['S3', 'S4', 'inner', [[562, 455]]],
  ['S4', 'E', 'inner', [[520, 556]]],
  ['S4', 'S5', 'inner', [[448, 456]]],
  ['S5', 'S1', 'inner', [[388, 378]]],
  ['S5', 'K', 'inner', [[282, 372]]],
];
// обход узлов каждого округа
const REGION_RING = {
  periphery: ['A', 'J1', 'J2', 'S1', 'S5', 'K'],
  mining: ['J1', 'H', 'J4', 'J3', 'J2'],
  industry: ['J2', 'J3', 'S2', 'S1'],
  port: ['J3', 'J4', 'F1', 'F2', 'F3', 'J10', 'S3', 'S2'],
  capital: ['S1', 'S2', 'S3', 'S4', 'S5'],
  finance: ['S3', 'J10', 'E', 'S4'],
  agri: ['K', 'S5', 'S4', 'E', 'D', 'C'],
};
/* Изломанность берега и границ: смещение середины отрезка по нормали, по
   детерминированному хэшу координат (карта одинакова в каждой партии). Концы
   отрезка не смещаются — узлы, где сходятся округа, остаются общими. Берег
   ломаем сильнее всего, сухопутную границу — меньше, внутренние границы — едва. */
function hash01(x, y, salt) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function roughen(points, amp, passes) {
  let pts = points;
  for (let p = 0; p < passes; p++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]; const b = pts[i + 1];
      const mx = (a[0] + b[0]) / 2; const my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0]; const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const k = (hash01(mx, my, p) - 0.5) * amp * Math.min(1, len / 38);
      out.push([+(mx - (dy / len) * k).toFixed(1), +(my + (dx / len) * k).toFixed(1)], b);
    }
    pts = out;
  }
  return pts;
}
const ROUGH = { coast: [22, 3], north: [12, 2], west: [12, 2], southwest: [12, 2], inner: [9, 2] };
const EDGE_PTS = {};
EDGES.forEach(([a, b, kind, mids]) => {
  const [amp, passes] = ROUGH[kind];
  EDGE_PTS[`${a}>${b}`] = roughen([NODES[a], ...mids, NODES[b]], amp, passes);
});
// точки отрезка от узла a к узлу b — в нужную сторону
function edgePts(a, b) {
  if (EDGE_PTS[`${a}>${b}`]) return EDGE_PTS[`${a}>${b}`];
  return EDGE_PTS[`${b}>${a}`].slice().reverse();
}
/* Catmull-Rom → кубические безье. Концы дублируются, поэтому кривая проходит
   ровно через первую и последнюю точку и не зависит от соседних отрезков. */
function curveTo(points) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]; const p1 = points[i];
    const p2 = points[i + 1]; const p3 = points[Math.min(i + 2, n - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const mv = (p) => `M${p[0]},${p[1]}`;
function ringPath(ring) {
  let d = mv(NODES[ring[0]]);
  ring.forEach((a, i) => { d += curveTo(edgePts(a, ring[(i + 1) % ring.length])); });
  return `${d} Z`;
}
const REGION_PATH = Object.fromEntries(Object.entries(REGION_RING).map(([id, ring]) => [id, ringPath(ring)]));
const edgesOfKind = (kinds) => EDGES.filter((e) => kinds.includes(e[2]))
  .map(([a, b]) => `${mv(NODES[a])}${curveTo(edgePts(a, b))}`).join(' ');
const coastPath = edgesOfKind(['coast']);
const nationalBorderPath = edgesOfKind(['north', 'west', 'southwest']);
const innerBorderPath = edgesOfKind(['inner']);
const countryPath = ringPath(['A', 'J1', 'H', 'J4', 'F1', 'F2', 'F3', 'J10', 'E', 'D', 'C', 'K']);

// река Велья: из Рудногорских гор через Кузнецк и Велеград — в Янтарный залив
const RIVER = [[604, 150], [584, 206], [560, 256], [528, 300], [500, 344], [496, 372], [548, 398], [612, 408], [664, 420], [698, 426]];
const TRIBUTARY = [[236, 478], [318, 446], [406, 404], [470, 380], [496, 372]];
// областные центры (названия — из MAP_REGIONS) и райцентры помельче
const CITY_AT = { capital: [496, 372], industry: [604, 302], mining: [742, 204], port: [676, 446], finance: [652, 578], agri: [262, 588], periphery: [352, 176] };

export { VIEW_W, VIEW_H, VIEW_TOP, NODES, EDGES, REGION_RING, hash01, roughen, edgePts, curveTo, mv, ringPath, REGION_PATH, edgesOfKind, coastPath, nationalBorderPath, innerBorderPath, countryPath, RIVER, TRIBUTARY, CITY_AT };
