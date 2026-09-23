/* Карта страны: округа, их напряжение и итоги выборов по округам. Вынесена
   из MacroSimulator.jsx в отдельный чанк и грузится лениво — карта нужна
   только по нажатию вкладки «Карта», а не при первой загрузке сайта. */
import { AlertTriangle, Anchor, Castle, CheckCircle2, Coins, Construction, Factory, Flag, Handshake, Landmark, Lock, Mountain, Pickaxe, Shield, Swords, Trees, Vote, Wheat } from 'lucide-react';
import { MAP_REGIONS, REGION_PROJECTS, clamp, fmt1, fmtMoney, projectBlocker, regionBlurb, warFrontRegion, defaultWarOrder, WAR_OBJECTIVES, WAR_STANCES, warObjectiveOpen, warStrength,
  CAMPAIGN_POINTS, CAMPAIGN_COST, electionForecast, swingLabel,
  regionById, activeRegions, annexLoyalty, PARTISAN_BELOW, INTEGRATED_AT, INTEGRATION_COST,
  DEFENSE_STANCES, REVANCHE_WARN, revancheGrowth, defaultDefenseOrder, sanitizeTreaty, treatyCost } from './lib/engine.js';
import { useState } from 'react';
import {
  Audio, COLOR, starPath,
} from './MacroSimulator.jsx';

/* ------------------------------ КАРТА СТРАНЫ ------------------------------
   Страна безымянная, но карта у неё должна читаться как карта государства, а не
   как инфографика: море с заливом, горы на севере, река от гор к морю, столица
   на реке, соседние государства за международной границей. И каждый округ
   должен выглядеть тем, чем назван: шахты — в горах, порт — на заливе в устье
   реки, биржа — в торговом городе на южном берегу, хлебородье — на равнине,
   окраина — в лесах у границы.

   Геометрия — планарный граф: узлы (NODES) и отрезки границ между ними
   (EDGES). Каждый округ — обход своих узлов, и соседние округа берут ОДИН И ТОТ
   ЖЕ отрезок, только в обратном порядке, — поэтому между ними не бывает ни
   щели, ни нахлёста. Сглаживание Catmull-Rom симметрично относительно разворота
   списка точек: одна и та же граница, пройденная в обе стороны, даёт одну и ту
   же кривую. Координаты — в поле 1000×720. */
// сверху поле продлено за северную границу: у Норланда есть глубина — туда идёт наступление
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
const REGION_ICON = { capital: Landmark, port: Anchor, industry: Factory, agri: Wheat, finance: Coins, mining: Pickaxe, periphery: Trees,
  pereval: Mountain, halvik: Pickaxe, nordholm: Castle };

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
// присоединённые земли рисуются по контурам целей операции (ANNEX_PATH ниже)
const regionPath = (id) => REGION_PATH[id] || ANNEX_PATH[(regionById(id) || {}).objective];
const edgesOfKind = (kinds) => EDGES.filter((e) => kinds.includes(e[2]))
  .map(([a, b]) => `${mv(NODES[a])}${curveTo(edgePts(a, b))}`).join(' ');
const coastPath = edgesOfKind(['coast']);
const nationalBorderPath = edgesOfKind(['north', 'west', 'southwest']);
const innerBorderPath = edgesOfKind(['inner']);
const countryPath = ringPath(['A', 'J1', 'H', 'J4', 'F1', 'F2', 'F3', 'J10', 'E', 'D', 'C', 'K']);

/* Соседние государства: суша за международной границей до края листа. Их
   общие границы между собой — отдельные линии от трёхсторонних стыков. */
const NB_COAST_N = roughen([NODES.H, [832, 96], [880, 44], [905, 0], [930, -70], [952, VIEW_TOP]], 20, 2);
const NB_COAST_SW = roughen([[300, 720], [318, 690], NODES.D], 16, 2);
const NB_BORDER_NW = roughen([NODES.A, [170, 60], [140, 0], [120, VIEW_TOP]], 10, 2);
const NB_BORDER_SW = roughen([NODES.C, [90, 495], [0, 510]], 10, 2);
const NEIGHBORS = [
  { id: 'north', name: 'КОРОЛЕВСТВО НОРЛАНД', short: 'Норланд', of: 'Норланда', gen: 'Норландом', label: [330, -50], rotate: 0,
    path: `${mv(NODES.A)}${curveTo(edgePts('A', 'J1'))}${curveTo(edgePts('J1', 'H'))}${curveTo(NB_COAST_N)}`
      + ` L120,${VIEW_TOP}${curveTo(NB_BORDER_NW.slice().reverse())} Z` },
  { id: 'west', name: 'ВЕСТРАВСКАЯ РЕСПУБЛИКА', short: 'Вестравия', of: 'Вестравии', gen: 'Вестравией', label: [78, 250], rotate: -90,
    path: `${mv(NODES.A)}${curveTo(NB_BORDER_NW)} L0,${VIEW_TOP} L0,510${curveTo(NB_BORDER_SW.slice().reverse())}`
      + `${curveTo(edgePts('C', 'K'))}${curveTo(edgePts('K', 'A'))} Z` },
  { id: 'southwest', name: 'РЕСПУБЛИКА ДЕШТ', short: 'Дешт', of: 'Дешта', gen: 'Республикой Дешт', label: [124, 640], rotate: 0,
    path: `${mv(NODES.C)}${curveTo(NB_BORDER_SW)} L0,720 L300,720${curveTo(NB_COAST_SW)}${curveTo(edgePts('D', 'C'))} Z` },
];
const nbCoastPath = `${mv(NB_COAST_N[0])}${curveTo(NB_COAST_N)} ${mv(NB_COAST_SW[0])}${curveTo(NB_COAST_SW)}`;
const nbBorderPath = `${mv(NB_BORDER_NW[0])}${curveTo(NB_BORDER_NW)} ${mv(NB_BORDER_SW[0])}${curveTo(NB_BORDER_SW)}`;
const ISLANDS = [
  roughen([[900, 300], [930, 316], [922, 346], [890, 342], [884, 318], [900, 300]], 8, 2),
  roughen([[872, 402], [894, 408], [888, 428], [866, 424], [872, 402]], 6, 1),
];

// река Велья: из Рудногорских гор через Кузнецк и Велеград — в Янтарный залив
const RIVER = [[604, 150], [584, 206], [560, 256], [528, 300], [500, 344], [496, 372], [548, 398], [612, 408], [664, 420], [698, 426]];
const TRIBUTARY = [[236, 478], [318, 446], [406, 404], [470, 380], [496, 372]];
// областные центры (названия — из MAP_REGIONS) и райцентры помельче
const CITY_AT = { capital: [496, 372], industry: [604, 302], mining: [742, 204], port: [676, 446], finance: [652, 578], agri: [262, 588], periphery: [352, 176] };
const CITIES = MAP_REGIONS.map((r) => ({ id: r.id, name: r.city, at: CITY_AT[r.id], capital: r.id === 'capital' }));
const TOWNS = [
  { name: 'Заозёрск', at: [236, 304] }, { name: 'Стрелецк', at: [372, 606] }, { name: 'Усть-Велья', at: [772, 300] },
  { name: 'Солнцедар', at: [556, 572] }, { name: 'Кремнёв', at: [528, 196] },
];
/* Железные дороги и шоссе: не лучи из столицы, а сеть — с изгибом посередине
   (детерминированным), как настоящие трассы, огибающие рельеф. */
const RAIL_NET = [['capital', 'industry'], ['industry', 'mining'], ['capital', 'port'], ['port', 'finance'], ['capital', 'agri'], ['capital', 'periphery']];
const ROAD_NET = [['capital', 'finance'], ['agri', 'finance'], ['periphery', 'industry'], ['agri', 'periphery']];
function bentPath(a, b, salt) {
  const [x1, y1] = CITY_AT[a]; const [x2, y2] = CITY_AT[b];
  const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2; const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const k = (hash01(mx, my, salt) - 0.5) * 0.28 * len;
  const c = [mx - ((y2 - y1) / len) * k, my + ((x2 - x1) / len) * k];
  return `M${x1},${y1} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${x2},${y2}`;
}
// подпись и число области — по свободному месту; знаки местности рядом с подписями
// и городами не рисуются, чтобы горы не лезли в буквы
const LABEL_AT = {
  periphery: [292, 246], mining: [652, 174], industry: [520, 276], port: [744, 332],
  capital: [502, 416], finance: [596, 516], agri: [382, 548],
};
const clearOf = (pts, r) => pts.filter(([x, y]) => [...Object.values(LABEL_AT).map(([lx, ly]) => [lx, ly + 8]), ...Object.values(CITY_AT), ...TOWNS.map((t) => t.at)]
  .every(([cx, cy]) => Math.hypot(x - cx, (y - cy) * 1.4) > r));
const MOUNTAINS = clearOf([[548, 136], [592, 118], [634, 130], [676, 118], [714, 150], [770, 170], [612, 196], [690, 214], [520, 170], [800, 214], [740, 126], [566, 176]], 44);
const FORESTS = clearOf([[250, 162], [292, 140], [410, 150], [228, 226], [300, 196], [262, 272], [338, 284], [396, 196], [206, 290], [366, 300], [430, 262], [320, 320], [200, 180], [420, 196], [372, 232]], 38);
const FIELDS = clearOf([[236, 400], [300, 420], [226, 470], [310, 470], [380, 470], [250, 540], [340, 566], [420, 520], [404, 590], [300, 622], [210, 430], [440, 450]], 40);
// природная окраска областей — под слоем напряжения
const TERRAIN = { periphery: 'teal', agri: 'gold', mining: 'muted', pereval: 'muted', halvik: 'muted' };

/* ------------------------------- ВОЙНА -------------------------------
   Фронт проходит вдоль той же границы, что и в движке (warFrontRegion): в
   обороне противник заходит с юго-запада, из Республики Дешт, в Приреченскую
   область; в наступлении армия страны бьёт на север, в Норланд. Линия фронта —
   граница, сдвинутая на глубину прорыва в сторону обороняющегося, с зубцами в
   сторону атаки; между границей и фронтом — зона боёв. */
const WAR_SETUP = {
  defensive: { edge: ['D', 'C'], neighbor: 'southwest', inward: true, depth: 100, labelAt: [232, 668],
    arrows: [[[70, 640], [272, 560]], [[40, 480], [236, 478]]] },
  offensive: { edge: ['J1', 'H'], neighbor: 'north', inward: false, depth: 46, labelAt: [838, -18],
    arrows: [[[598, 190], [586, 48]], [[708, 178], [736, 60]]] },
};
const COUNTRY_CENTER = [495, 380];
/* Фронт — плавная дуга: граница, прорежённая до опорных точек и сдвинутая в ОДНУ
   сторону (перпендикуляр к хорде участка), с глубиной, нарастающей к середине. Так
   линия не закручивается петлями на изломах, а концы сходятся с границей. */
function frontLine(a, b, depth, inward) {
  const coarse = [NODES[a], ...EDGES.find((e) => e[0] === a && e[1] === b)[3], NODES[b]];
  const [x1, y1] = coarse[0]; const [x2, y2] = coarse[coarse.length - 1];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / len; let ny = (x2 - x1) / len;
  const toC = (COUNTRY_CENTER[0] - (x1 + x2) / 2) * nx + (COUNTRY_CENTER[1] - (y1 + y2) / 2) * ny;
  if ((toC < 0) === inward) { nx = -nx; ny = -ny; }
  // равномерно по длине ломаной — 15 точек
  const seg = coarse.slice(1).map((p, i) => Math.hypot(p[0] - coarse[i][0], p[1] - coarse[i][1]));
  const total = seg.reduce((q, v) => q + v, 0);
  const pts = [];
  for (let k = 0; k <= 14; k++) {
    let d = (k / 14) * total; let i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i += 1; }
    const f = seg[i] ? d / seg[i] : 0;
    const x = coarse[i][0] + (coarse[i + 1][0] - coarse[i][0]) * f;
    const y = coarse[i][1] + (coarse[i + 1][1] - coarse[i][1]) * f;
    const dep = depth * Math.sin(Math.PI * (k / 14)) * (0.75 + 0.5 * hash01(Math.round(x), Math.round(y), 7));
    pts.push([+(x + nx * dep).toFixed(1), +(y + ny * dep).toFixed(1)]);
  }
  return { pts, dir: [nx, ny] };
}
/* ------------------------- ПРИСОЕДИНЁННЫЕ ЗЕМЛИ -------------------------
   Взятые в войне цели после её окончания входят в состав страны. Их земли —
   три участка Норланда за северной границей, нарезанные тем же способом, что и
   области: общие отрезки у соседей. У каждого отрезка записано, чья земля по обе
   стороны; отсюда и граница: где с обеих сторон своё — внутренний пунктир, где
   своё только с одной — государственная граница. */
const J1H = edgePts('J1', 'H');
const M_IDX = Math.floor(J1H.length / 2);
const ANNEX_Q = { Q1: [664, 44], Q2: [600, 8], Q3: [522, 22], Q4: [704, 2], Q5: [800, 12], Q7: [652, -92], Q8: [540, -104], Q9: [468, -40] };
const NB_Q6 = NB_COAST_N.findIndex((p) => p[0] === 880 && p[1] === 44);
const rough = (pts) => roughen(pts, 9, 2);
// [точки, сторона A, сторона B]; 'home' — исходная страна, null — Норланд, 'sea' — море
const ANNEX_EDGES = [
  [J1H.slice(0, M_IDX + 1), 'home', 'pass'],
  [J1H.slice(M_IDX), 'home', 'mines'],
  [rough([J1H[M_IDX], ANNEX_Q.Q1]), 'pass', 'mines'],
  [rough([ANNEX_Q.Q1, ANNEX_Q.Q2, ANNEX_Q.Q3]), 'pass', 'city'],
  [rough([ANNEX_Q.Q3, NODES.J1]), 'pass', null],
  [rough([ANNEX_Q.Q1, ANNEX_Q.Q4]), 'mines', 'city'],
  [rough([ANNEX_Q.Q4, ANNEX_Q.Q5, NB_COAST_N[NB_Q6]]), 'mines', null],
  [rough([ANNEX_Q.Q4, ANNEX_Q.Q7, ANNEX_Q.Q8, ANNEX_Q.Q9, ANNEX_Q.Q3]), 'city', null],
];
const edgeD = (pts) => `${mv(pts[0])}${curveTo(pts)}`;
const cont = (pts) => curveTo(pts);
const rev = (pts) => pts.slice().reverse();
const E = ANNEX_EDGES.map((e) => e[0]);
const ANNEX_PATH = {
  pass: `${mv(NODES.J1)}${cont(E[0])}${cont(E[2])}${cont(E[3])}${cont(E[4])} Z`,
  mines: `${mv(J1H[M_IDX])}${cont(E[1])}${cont(NB_COAST_N.slice(0, NB_Q6 + 1))}${cont(rev(E[6]))}${cont(rev(E[5]))}${cont(rev(E[2]))} Z`,
  city: `${mv(ANNEX_Q.Q3)}${cont(rev(E[3]))}${cont(E[5])}${cont(E[7])} Z`,
};
const ANNEX_CITIES = { city: { name: 'Нордхольм', at: [560, -64] }, mines: { name: 'Хальвик', at: [742, 30] }, pass: { name: 'Перевальск', at: [624, 62] } };
// подписи присоединённых областей — по id области
const ANNEX_LABEL_AT = { pereval: [556, 40], halvik: [786, 66], nordholm: [566, -30] };
const labelAt = (id) => LABEL_AT[id] || ANNEX_LABEL_AT[id];
const ANNEX_REGION_ID = { pass: 'pereval', mines: 'halvik', city: 'nordholm' };
// граница с учётом присоединённого: где своё с одной стороны — государственная, с двух — внутренняя
function annexBorders(own) {
  const mine = (side) => side === 'home' || (side && own.includes(side));
  const national = []; const inner = [];
  ANNEX_EDGES.forEach(([pts, a, b]) => {
    if (b === 'sea') return;
    const ma = mine(a); const mb = mine(b);
    if (ma && mb) inner.push(edgeD(pts)); else if (ma || mb) national.push(edgeD(pts));
  });
  return { national: national.join(' '), inner: inner.join(' ') };
}
const nationalBorderNoNorth = edgesOfKind(['west', 'southwest']) + ' ' + `${mv(NODES.A)}${curveTo(edgePts('A', 'J1'))}`;

// цели наступления в Норланде — там же, где их рисует карта
const OBJECTIVE_AT = { city: [560, -64], pass: [612, 50], mines: [742, 30] };
const OBJECTIVE_ICON = { city: Castle, pass: Mountain, mines: Pickaxe };
function warGeometry(warType, depthOverride) {
  const cfg = WAR_SETUP[warType] || WAR_SETUP.defensive;
  const border = edgePts(cfg.edge[0], cfg.edge[1]);
  const { pts: front, dir } = frontLine(cfg.edge[0], cfg.edge[1], depthOverride || cfg.depth, cfg.inward);
  const zone = `${mv(border[0])}${curveTo(border)}${curveTo(front.slice().reverse())} Z`;
  // зубцы — остриём в сторону атаки (туда же, куда сдвинут фронт)
  const [ux, uy] = dir;
  const teeth = front.slice(2, -2).map(([x, y]) => `M${(x - uy * 5).toFixed(1)},${(y + ux * 5).toFixed(1)} L${(x + ux * 8).toFixed(1)},${(y + uy * 8).toFixed(1)} L${(x + uy * 5).toFixed(1)},${(y - ux * 5).toFixed(1)} Z`);
  return { cfg, zone, frontPath: `${mv(front[0])}${curveTo(front)}`, teeth: teeth.join(' '), battles: [front[5], front[9]] };
}

const MAP_MODES = [
  { id: 'stress', label: 'Напряжение' },
  { id: 'votes', label: 'Итоги выборов' },
  // опросы есть только в последние кварталы перед голосованием
  // при несвободном режиме это закрытый замер: выборы рисуют, а знать правду власти нужно
  { id: 'polls', label: (e) => (electionForecast(e) || {}).closed ? 'Закрытый замер' : 'Опросы', when: (e) => !!electionForecast(e) },
];
function tierColor(tier) { return tier === 'crisis' ? COLOR.rust : tier === 'tense' ? COLOR.gold : COLOR.teal; }
function tierLabel(tier) { return tier === 'crisis' ? 'кризис' : tier === 'tense' ? 'напряжённо' : 'спокойно'; }
/* Цвет округа на выборах: за кого он проголосовал и насколько уверенно.
   Считаем по округлённому значению — иначе подпись «52%» могла оказаться
   жёлтой (потому что на самом деле 51.6), и цвет спорил бы с числом. */
function voteColor(share) {
  const v = Math.round(share);
  return v >= 52 ? COLOR.teal : v <= 48 ? COLOR.rust : COLOR.gold;
}
const ELECTION_OUTCOME = {
  incumbent: 'власть сохранила мандат',
  opposition: 'победила оппозиция',
  landslide: 'разгромное поражение власти',
};
function voteAlpha(share) {
  const margin = clamp(Math.abs(share - 50) / 18, 0, 1);
  return `0${Math.round(20 + margin * 45).toString(16)}`.slice(-2);
}

/* plan — решения игрока на карте в этом квартале ({ startProject, regionResponse });
   onPlan — как их менять (нет — карта только показывает); planner — кто решает за
   игрока без права решать («Минфин (бот)»), чтобы было видно, чьё это решение. */
/* warOrder/onWarOrder — приказ президента на квартал в наступательной войне
   ({ target, stance }); без onWarOrder операция только показывается. */
/* campaignPlan/onCampaignPlan — штабы кампании на этот квартал ({ regionId: штабов });
   campaignPlanner — кто распределяет их за игрока без права решать. */
/* treatyPlan/onTreatyPlan — условия мира, которые президент предложит Норланду в этом квартале. */
export function CountryMap({ economy, plan, onPlan, planner, warOrder, onWarOrder, warPlanner, campaignPlan, onCampaignPlan, campaignPlanner,
  treatyPlan, onTreatyPlan, treatyPlanner }) {
  const [selected, setSelected] = useState('capital');
  const [picked, setMode] = useState('stress');
  // слой, который пропал (опросы после выборов), не остаётся выбранным невидимкой
  const modes = MAP_MODES.filter((m) => !m.when || m.when(economy));
  const mode = modes.some((m) => m.id === picked) ? picked : 'stress';
  const election = economy.lastElection || null;
  // прогноз — вместе со штабами, которые игрок расставил, но квартал ещё не завершён
  const forecast = electionForecast(economy, campaignPlan);
  const showPolls = mode === 'polls' && !!forecast;
  const voteOf = (id) => {
    const rows = showPolls ? forecast.byRegion : election && election.byRegion;
    const row = (rows || []).find((x) => x.id === id);
    return row ? row.share : null;
  };
  const regions = activeRegions(economy);
  const region = regions.find((r) => r.id === selected) || MAP_REGIONS[0];
  const blurb = regionBlurb(region, economy);
  const Icon = REGION_ICON[region.icon];
  const showVotes = (mode === 'votes' && !!election) || showPolls;
  const sel = voteOf(region.id);
  const annexed = economy.annexed || [];
  const borders = annexBorders(annexed);
  const atWar = (economy.warQuartersLeft || 0) > 0;
  const camp = atWar && economy.warType === 'offensive' ? (economy.warCampaign || { progress: { pass: 0, mines: 0, city: 0 }, captured: [], last: null }) : null;
  // фронт уходит вглубь Норланда вместе с продвижением операции
  const push = camp ? Math.max(...WAR_OBJECTIVES.map((o) => camp.progress[o.id] || 0)) : 0;
  // война за новые земли: не линия фронта, а удары Норланда по отдельным областям
  const revCamp = atWar && economy.warType === 'revanche' ? economy.revancheCampaign : null;
  const war = atWar && !revCamp ? warGeometry(economy.warType, camp ? 26 + push * 0.42 : null) : null;
  const hotNeighbor = war ? war.cfg.neighbor : revCamp ? 'north' : null;
  const heldIds = regions.filter((r) => r.annex).map((r) => r.id);
  const defStanding = revCamp ? defaultDefenseOrder(revCamp) : null;
  const defOrder = revCamp ? {
    target: warOrder && heldIds.includes(warOrder.target) ? warOrder.target : heldIds.includes(defStanding.target) ? defStanding.target : heldIds[0],
    stance: (warOrder && DEFENSE_STANCES.some((x) => x.id === warOrder.stance) && warOrder.stance) || defStanding.stance,
  } : null;
  const setDefOrder = onWarOrder && revCamp ? (patch) => onWarOrder({ ...defOrder, ...patch }) : null;
  // действующий приказ: новый, если отдан в этом квартале, иначе прошлый (см. defaultWarOrder)
  const standing = camp ? defaultWarOrder(camp) : null;
  const order = camp ? {
    target: warOrder && warObjectiveOpen(warOrder.target, camp) ? warOrder.target : standing.target,
    stance: (warOrder && warOrder.stance) || standing.stance,
  } : null;
  const setOrder = onWarOrder ? (patch) => onWarOrder({ ...order, ...patch }) : null;
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, maxWidth: 720 }}>
        {/* слои карты — отдельной панелью с подписью и отступом: раньше две кнопки
            прилипали к верху экрана и сливались с фоном */}
        <div role="tablist" aria-label="Слой карты"
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '4px 0 10px', padding: '7px 9px',
            background: COLOR.panel, border: `1px solid ${COLOR.borderStrong}`, borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: COLOR.muted, marginRight: 4 }}>Слой карты:</span>
          {modes.map(({ id, label }) => (
            <button key={id} role="tab" aria-selected={mode === id} className="ems-btn" style={{ padding: '6px 12px', fontSize: 12,
              fontWeight: mode === id ? 600 : 400,
              background: mode === id ? COLOR.gold : COLOR.panelAlt, color: mode === id ? COLOR.ink : COLOR.text,
              borderColor: mode === id ? COLOR.gold : COLOR.borderStrong }}
              onClick={() => { Audio.play('tab'); setMode(id); }}>{typeof label === 'function' ? label(economy) : label}</button>
          ))}
        </div>
        <svg viewBox={`0 ${VIEW_TOP} ${VIEW_W} ${VIEW_H - VIEW_TOP}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }}
          role="img" aria-label="Карта областей страны">
          <defs>
            {/* волны на море, пашня на равнине, кварталы в городах — условные знаки
                физической карты, по которым область узнаётся без подписи */}
            <pattern id="map-waves" width="46" height="22" patternUnits="userSpaceOnUse">
              <path d="M2,12 q5,-5 10,0 t10,0" fill="none" stroke={`${COLOR.blue}40`} strokeWidth={1} />
            </pattern>
            <pattern id="map-fields" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
              <line x1="0" y1="0" x2="0" y2="12" stroke={`${COLOR.gold}2e`} strokeWidth={3} />
            </pattern>
            <pattern id="map-blocks" width="14" height="14" patternUnits="userSpaceOnUse">
              <rect x="2" y="2" width="8" height="8" fill={`${COLOR.text}14`} />
            </pattern>
            <pattern id="map-neighbor" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="9" stroke={`${COLOR.text}10`} strokeWidth={1} />
            </pattern>
            <pattern id="map-war" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={COLOR.rust} strokeOpacity={0.55} strokeWidth={3} />
            </pattern>
            <pattern id="map-held" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <line x1="0" y1="0" x2="0" y2="9" stroke={COLOR.gold} strokeOpacity={0.5} strokeWidth={2.5} />
            </pattern>
            <radialGradient id="map-relief" cx="0.5" cy="0.35" r="0.7">
              <stop offset="0" stopColor={COLOR.text} stopOpacity="0.10" />
              <stop offset="1" stopColor={COLOR.text} stopOpacity="0" />
            </radialGradient>
            <marker id="map-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill={COLOR.rust} />
            </marker>
            <clipPath id="map-country"><path d={countryPath} /></clipPath>
          </defs>
          {/* море: заливка, волны и полоса мелководья вдоль берега */}
          <rect x="0" y={VIEW_TOP} width={VIEW_W} height={VIEW_H - VIEW_TOP} fill={`${COLOR.blue}1c`} />
          <rect x="0" y={VIEW_TOP} width={VIEW_W} height={VIEW_H - VIEW_TOP} fill="url(#map-waves)" />
          <path d={coastPath} fill="none" stroke={`${COLOR.blue}26`} strokeWidth={30} strokeLinejoin="round" />
          <path d={coastPath} fill="none" stroke={`${COLOR.blue}30`} strokeWidth={12} strokeLinejoin="round" />
          <path d={nbCoastPath} fill="none" stroke={`${COLOR.blue}26`} strokeWidth={24} />
          {NEIGHBORS.map((n) => (
            <g key={n.id}>
              <path d={n.path} fill={COLOR.panelAlt} />
              <path d={n.path} fill={`${COLOR.muted}22`} />
              <path d={n.path} fill="url(#map-neighbor)" />
            </g>
          ))}
          {ISLANDS.map((pts, i) => (
            <path key={i} d={`${mv(pts[0])}${curveTo(pts)} Z`} fill={`${COLOR.text}1a`} stroke={`${COLOR.text}66`} strokeWidth={1.2} />
          ))}
          <path d={nbCoastPath} fill="none" stroke={`${COLOR.text}55`} strokeWidth={1.6} />
          <path d={nbBorderPath} fill="none" stroke={`${COLOR.text}66`} strokeWidth={2} strokeDasharray="10 4 2 4" />
          {NEIGHBORS.map((n) => (
            <text key={n.id} x={n.label[0]} y={n.label[1]} textAnchor="middle" transform={n.rotate ? `rotate(${n.rotate} ${n.label[0]} ${n.label[1]})` : undefined}
              style={{ fontSize: 14, letterSpacing: '0.26em', fill: hotNeighbor === n.id ? COLOR.rust : COLOR.faint, fontStyle: 'italic', fontWeight: hotNeighbor === n.id ? 600 : 400 }}>{n.name}</text>
          ))}
          <text x={905} y={560} textAnchor="middle" style={{ fontSize: 16, letterSpacing: '0.3em', fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>ЛАЗУРНОЕ</text>
          <text x={905} y={582} textAnchor="middle" style={{ fontSize: 16, letterSpacing: '0.3em', fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>МОРЕ</text>
          <text x={868} y={478} textAnchor="middle" style={{ fontSize: 12, fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>Янтарный залив</text>

          {/* слой 1 — области: подложка, природная окраска и цвет напряжения/выборов */}
          {regions.map((r) => {
            const b = regionBlurb(r, economy);
            const share = voteOf(r.id);
            const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
            const alpha = showVotes && share != null ? voteAlpha(share) : '1e';
            const terrain = TERRAIN[r.id] ? COLOR[TERRAIN[r.id]] : null;
            const aria = showPolls
              ? `${r.name}: ${forecast.closed ? 'закрытый замер' : 'опрос'} — ${Math.round(share)}% за действующую власть, ${forecast.closed ? closedLabel(share) : swingLabel(share)}`
              : showVotes
              ? `${r.name}: ${share != null ? `${Math.round(share)}% за действующую власть` : 'выборы ещё не проходили'}`
              : `${r.name}, ${r.sector}: ${tierLabel(b.tier)}, ${Math.round(b.stress)} из 100`;
            return (
              <g key={r.id} role="button" tabIndex={0} aria-label={aria} style={{ cursor: 'pointer' }}
                onClick={() => { Audio.play('tab'); setSelected(r.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Audio.play('tab'); setSelected(r.id); } }}>
                <path d={regionPath(r.id)} fill={COLOR.bg} />
                {terrain && <path d={regionPath(r.id)} fill={`${terrain}1c`} />}
                <path d={regionPath(r.id)} fill={`${color}${r.id === selected ? '44' : alpha}`} />
              </g>
            );
          })}
          {/* присоединённые земли — своей землёй; взятые армией, но ещё не присоединённые
              (война идёт) — золотой штриховкой «под контролем армии» */}
          <g style={{ pointerEvents: 'none' }}>
            {/* присоединённое рисуется слоем областей выше; здесь — только взятое армией,
                пока идёт война, и штриховка партизанского края */}
            {Object.keys(ANNEX_PATH).map((id) => {
              const own = annexed.includes(id);
              const held = !own && camp && camp.captured.includes(id);
              const unrest = own && annexLoyalty(economy, regionById(ANNEX_REGION_ID[id]).id) < PARTISAN_BELOW;
              if (!held && !unrest) return null;
              return <path key={id} d={ANNEX_PATH[id]} fill="url(#map-held)" opacity={unrest ? 0.55 : 1} />;
            })}
          </g>
          {/* слой 2 — угодья, рельеф, дороги и реки; клики проходят насквозь */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={regionPath('agri')} fill="url(#map-fields)" />
            <path d={regionPath('capital')} fill="url(#map-blocks)" opacity={0.8} />
            <path d={regionPath('finance')} fill="url(#map-blocks)" opacity={0.45} />
            <path d={regionPath('industry')} fill="url(#map-blocks)" opacity={0.3} />
            <path d={regionPath('mining')} fill="url(#map-relief)" />
            {FIELDS.map(([x, y]) => (
              <path key={`f${x},${y}`} d={`M${x - 9},${y} h18 M${x - 7},${y + 5} h14`} stroke={`${COLOR.gold}66`} strokeWidth={1.4} />
            ))}
            {MOUNTAINS.map(([x, y]) => (
              <g key={`m${x},${y}`}>
                <path d={`M${x - 14},${y + 9} L${x},${y - 11} L${x + 14},${y + 9} Z`} fill={`${COLOR.muted}33`} stroke={`${COLOR.text}88`} strokeWidth={1.2} strokeLinejoin="round" />
                <path d={`M${x},${y - 11} L${x + 14},${y + 9} L${x + 3},${y + 9} Z`} fill={`${COLOR.ink}40`} />
                <path d={`M${x - 4},${y - 5} L${x},${y - 11} L${x + 4},${y - 5}`} fill="none" stroke={`${COLOR.text}dd`} strokeWidth={1.5} />
              </g>
            ))}
            {FORESTS.map(([x, y]) => (
              <g key={`t${x},${y}`}>
                <path d={`M${x},${y - 11} L${x + 7},${y + 2} L${x - 7},${y + 2} Z`} fill={`${COLOR.teal}55`} stroke={`${COLOR.teal}aa`} strokeWidth={1} strokeLinejoin="round" />
                <line x1={x} y1={y + 2} x2={x} y2={y + 7} stroke={`${COLOR.teal}aa`} strokeWidth={1.4} />
              </g>
            ))}
            <g clipPath="url(#map-country)">
              {ROAD_NET.map(([a, b], i) => (
                <path key={`r${i}`} d={bentPath(a, b, i + 3)} fill="none" stroke={`${COLOR.text}38`} strokeWidth={1.4} strokeDasharray="5 4" />
              ))}
              {/* железная дорога — классическим «шпальным» пунктиром */}
              {RAIL_NET.map(([a, b], i) => (
                <g key={`w${i}`}>
                  <path d={bentPath(a, b, i)} fill="none" stroke={`${COLOR.text}50`} strokeWidth={2.6} />
                  <path d={bentPath(a, b, i)} fill="none" stroke={COLOR.bg} strokeWidth={1.2} strokeDasharray="6 6" />
                </g>
              ))}
            </g>
            <path d={`${mv(TRIBUTARY[0])}${curveTo(TRIBUTARY)}`} fill="none" stroke={`${COLOR.blue}aa`} strokeWidth={2} strokeLinecap="round" />
            <path d={`${mv(RIVER[0])}${curveTo(RIVER)}`} fill="none" stroke={`${COLOR.blue}cc`} strokeWidth={3.4} strokeLinecap="round" />
            <text x={548} y={242} transform="rotate(-62 548 242)" style={{ fontSize: 11, fill: `${COLOR.blue}dd`, fontStyle: 'italic' }}>р. Велья</text>
          </g>
          {/* слой 3 — линии: границы областей пунктиром, берег сплошной, граница
              государства штрихпунктиром — как на политической карте */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={innerBorderPath} fill="none" stroke={`${COLOR.text}66`} strokeWidth={1.3} strokeDasharray="4 4" strokeLinecap="round" />
            <path d={coastPath} fill="none" stroke={`${COLOR.text}99`} strokeWidth={2.4} strokeLinecap="round" />
            {annexed.length > 0 && <path d={borders.inner} fill="none" stroke={`${COLOR.text}66`} strokeWidth={1.3} strokeDasharray="4 4" />}
            <path d={annexed.length > 0 ? `${nationalBorderNoNorth} ${borders.national}` : nationalBorderPath} fill="none" stroke={COLOR.rust} strokeOpacity={0.75} strokeWidth={3} strokeDasharray="14 5 3 5" />
            <path d={regionPath(selected)} fill="none" stroke={showVotes && sel != null ? voteColor(sel) : tierColor(blurb.tier)}
              strokeWidth={3.2} strokeLinejoin="round" />
          </g>
          {/* слой 4 — война: зона боёв, линия фронта с зубцами, стрелки, сражения */}
          {war && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={war.zone} fill="url(#map-war)" />
              <path d={war.zone} fill={COLOR.rust} opacity={0.2} />
              <path d={war.frontPath} fill="none" stroke={COLOR.bg} strokeWidth={7} strokeLinecap="round" />
              <path d={war.frontPath} fill="none" stroke={COLOR.rust} strokeWidth={4} strokeLinecap="round" />
              <path d={war.teeth} fill={COLOR.rust} />
              {(camp ? [] : war.cfg.arrows).map(([[x1, y1], [x2, y2]], i) => (
                <path key={i} d={`M${x1},${y1} Q${(x1 + x2) / 2 + (i ? 14 : -14)},${(y1 + y2) / 2 - 10} ${x2},${y2}`} fill="none"
                  stroke={COLOR.rust} strokeWidth={5} strokeLinecap="round" markerEnd="url(#map-arrow)" opacity={0.85} />
              ))}
              {war.battles.map(([x, y], i) => (
                <g key={i} transform={`translate(${x},${y})`}>
                  <circle r={14} fill={COLOR.rust} opacity={0.3}>
                    <animate attributeName="r" values="11;19;11" dur="2.2s" begin={`${i * 0.7}s`} repeatCount="indefinite" />
                  </circle>
                  <circle r={10} fill={COLOR.bg} stroke={COLOR.rust} strokeWidth={2} />
                  <Swords x={-7} y={-7} width={14} height={14} color={COLOR.rust} />
                </g>
              ))}
            </g>
          )}
          {/* война за новые земли: кольцо у города — давление Норланда, мечи — куда он
              ударит, щит — какую область укрепили; клик — укрепить её */}
          {revCamp && (
            <g>
              {revCamp.next && ANNEX_CITIES[(regionById(revCamp.next) || {}).objective] && (() => {
                const [tx, ty] = ANNEX_CITIES[regionById(revCamp.next).objective].at;
                return (
                  <path d={`M360,-96 Q${(360 + tx) / 2},${Math.min(-96, ty) - 40} ${tx - 12},${ty - 14}`} fill="none" stroke={COLOR.rust}
                    strokeWidth={5} strokeLinecap="round" markerEnd="url(#map-arrow)" opacity={0.85} style={{ pointerEvents: 'none' }} />
                );
              })()}
              {regions.filter((r) => r.annex).map((r) => {
                const [x, y] = ANNEX_CITIES[r.objective].at;
                const p = revCamp.pressure[r.id] || 0;
                const next = revCamp.next === r.id;
                const guarded = defOrder.target === r.id && defOrder.stance !== 'talks';
                const click = setDefOrder ? () => { Audio.play('tick'); setDefOrder({ target: r.id, stance: defOrder.stance === 'talks' ? 'defend' : defOrder.stance }); } : null;
                const Icon = guarded ? Shield : next ? Swords : Flag;
                return (
                  <g key={`rv${r.id}`} transform={`translate(${x},${y - 30})`} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined}
                    aria-label={`${r.name}: давление Норланда ${Math.round(p)} из 100${next ? ', сюда готовится удар' : ''}${guarded ? ', область укреплена' : ''}`}
                    onClick={click || undefined} onKeyDown={click ? (e) => { if (e.key === 'Enter') click(); } : undefined}
                    style={{ cursor: click ? 'pointer' : 'default' }}>
                    {next && (
                      <circle r={20} fill={COLOR.rust} opacity={0.25}>
                        <animate attributeName="r" values="16;25;16" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={16} fill={COLOR.bg} stroke={guarded ? COLOR.gold : COLOR.border} strokeWidth={guarded ? 2.4 : 1.4} />
                    <circle r={16} fill="none" stroke={COLOR.rust} strokeWidth={3.4}
                      strokeDasharray={`${(p / 100 * 100.5).toFixed(1)} 100.5`} transform="rotate(-90)" />
                    <Icon x={-8} y={-8} width={16} height={16} color={guarded ? COLOR.gold : COLOR.rust} />
                  </g>
                );
              })}
            </g>
          )}
          {/* цели наступательной операции: кольцо — продвижение, флаг — взята,
              замок — к цели пока не подойти; клик — выбрать цель удара */}
          {camp && (
            <g>
              {order.target && OBJECTIVE_AT[order.target] && order.stance !== 'ceasefire' && (
                <path d={`M${CITY_AT.mining[0] - 40},${CITY_AT.mining[1] - 30} Q${(CITY_AT.mining[0] - 40 + OBJECTIVE_AT[order.target][0]) / 2 + 30},${(CITY_AT.mining[1] + OBJECTIVE_AT[order.target][1]) / 2} ${OBJECTIVE_AT[order.target][0]},${OBJECTIVE_AT[order.target][1] + 20}`}
                  fill="none" stroke={COLOR.rust} strokeWidth={order.stance === 'assault' ? 6 : 4} strokeDasharray={order.stance === 'hold' ? '4 6' : undefined}
                  strokeLinecap="round" markerEnd="url(#map-arrow)" opacity={0.9} style={{ pointerEvents: 'none' }} />
              )}
              {WAR_OBJECTIVES.map((o) => {
                const [x, y] = OBJECTIVE_AT[o.id];
                const taken = camp.captured.includes(o.id);
                const open = warObjectiveOpen(o.id, camp);
                const prog = camp.progress[o.id] || 0;
                const Icon = taken ? Flag : open ? OBJECTIVE_ICON[o.id] : Lock;
                const selectedT = order.target === o.id;
                const click = setOrder && open ? () => { Audio.play('tick'); setOrder({ target: o.id, stance: order.stance === 'ceasefire' ? 'siege' : order.stance }); } : null;
                return (
                  <g key={o.id} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined}
                    aria-label={`${o.name}: ${taken ? 'взята' : open ? `продвижение ${Math.round(prog)} из 100` : 'недоступна, пока не взят перевал'}`}
                    onClick={click || undefined} onKeyDown={click ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } } : undefined}
                    style={{ cursor: click ? 'pointer' : 'default' }}>
                    {selectedT && <circle cx={x} cy={y} r={24} fill="none" stroke={COLOR.gold} strokeWidth={1.6} strokeDasharray="4 4" />}
                    <circle cx={x} cy={y} r={17} fill={taken ? COLOR.gold : COLOR.bg} stroke={open || taken ? COLOR.rust : COLOR.border} strokeWidth={1.6} opacity={open || taken ? 1 : 0.8} />
                    {!taken && prog > 0 && (
                      <circle cx={x} cy={y} r={17} fill="none" stroke={COLOR.gold} strokeWidth={4}
                        strokeDasharray={`${(prog / 100 * 106.8).toFixed(1)} 106.8`} transform={`rotate(-90 ${x} ${y})`} />
                    )}
                    <Icon x={x - 9} y={y - 9} width={18} height={18} color={taken ? COLOR.ink : open ? COLOR.rust : COLOR.faint} />
                    <text x={x} y={y + 32} textAnchor="middle" stroke={COLOR.bg} strokeWidth={3.2} paintOrder="stroke"
                      style={{ fontSize: 11.5, fontWeight: 600, fill: taken ? COLOR.goldSoft : COLOR.text }}>{o.name}{!taken && open ? ` · ${Math.round(prog)}` : ''}</text>
                  </g>
                );
              })}
            </g>
          )}
          {/* слой 5 — города и подписи поверх всего */}
          <g style={{ pointerEvents: 'none' }}>
            {!camp && annexed.filter((id) => ANNEX_CITIES[id]).map((id) => {
              const c = ANNEX_CITIES[id];
              return (
                <g key={`ac${id}`}>
                  <circle cx={c.at[0]} cy={c.at[1]} r={5} fill={COLOR.bg} stroke={COLOR.text} strokeWidth={1.6} />
                  <circle cx={c.at[0]} cy={c.at[1]} r={1.8} fill={COLOR.text} />
                  <text x={c.at[0] + 9} y={c.at[1] - 6} stroke={COLOR.bg} strokeWidth={3} paintOrder="stroke" style={{ fontSize: 12, fill: COLOR.muted }}>{c.name}</text>
                </g>
              );
            })}
            {TOWNS.map((t) => (
              <g key={t.name}>
                <circle cx={t.at[0]} cy={t.at[1]} r={2.4} fill={COLOR.muted} />
                <text x={t.at[0] + 5} y={t.at[1] - 4} stroke={COLOR.bg} strokeWidth={2.6} paintOrder="stroke"
                  style={{ fontSize: 10, fill: COLOR.faint }}>{t.name}</text>
              </g>
            ))}
            {CITIES.map((c) => (
              <g key={c.id}>
                {c.capital
                  ? <path d={starPath(c.at[0], c.at[1], 11, 4.6)} fill={COLOR.gold} stroke={COLOR.ink} strokeWidth={0.8} />
                  : (
                    <>
                      <circle cx={c.at[0]} cy={c.at[1]} r={5} fill={COLOR.bg} stroke={COLOR.text} strokeWidth={1.6} />
                      <circle cx={c.at[0]} cy={c.at[1]} r={1.8} fill={COLOR.text} />
                    </>
                  )}
                <text x={c.at[0] + (c.capital ? 14 : 9)} y={c.at[1] - 6} stroke={COLOR.bg} strokeWidth={3} paintOrder="stroke"
                  style={{ fontSize: c.capital ? 13.5 : 12, fill: c.capital ? COLOR.text : COLOR.muted, fontWeight: c.capital ? 600 : 400 }}>{c.name}</text>
              </g>
            ))}
            {regions.map((r) => {
              const b = regionBlurb(r, economy);
              const share = voteOf(r.id);
              const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
              const label = showVotes ? (share != null ? `${Math.round(share)}%` : '—') : String(Math.round(b.stress));
              const [lx, ly] = labelAt(r.id);
              const name = r.short.toUpperCase();
              // новые земли мельче: и сами области меньше, и подпись не должна их закрывать
              const k = r.annex ? 0.82 : 1;
              const w = (name.length * 9.6 + 18) * k;
              return (
                <g key={r.id}>
                  {/* подпись области — на подложке, чтобы читалась поверх любого знака */}
                  <rect x={lx - w / 2} y={ly - 15 * k} width={w} height={45 * k} rx={7} fill={COLOR.bg} opacity={0.78}
                    stroke={r.id === selected ? color : `${COLOR.text}22`} strokeWidth={r.id === selected ? 1.5 : 1} />
                  <text x={lx} y={ly} textAnchor="middle" style={{ fontSize: 13 * k, fontWeight: 600, fill: COLOR.text, letterSpacing: '0.06em' }}>{name}</text>
                  <text x={lx} y={ly + 22 * k} textAnchor="middle" className="ems-numeral" style={{ fontSize: 19 * k, fontWeight: 700, fill: color }}>{label}</text>
                </g>
              );
            })}
            {/* стройки: кран с долей готовности у города области; достроенное — галочка */}
            {[...CITIES, ...regions.filter((r) => r.annex).map((r) => ({ id: r.id, at: ANNEX_CITIES[r.objective].at }))].map((c) => {
              const active = (economy.projects || []).find((x) => x.region === c.id);
              const done = REGION_PROJECTS.find((p) => p.region === c.id && (economy.projectsBuilt || []).includes(p.id));
              const planned = plan && plan.startProject && REGION_PROJECTS.find((p) => p.id === plan.startProject && p.region === c.id);
              if (!active && !done && !planned) return null;
              const [x, y] = [c.at[0] - 24, c.at[1] + 14];
              const share = active ? 1 - (active.left - 1) / active.total : 0;
              return (
                <g key={`pj${c.id}`}>
                  <circle cx={x} cy={y} r={13} fill={COLOR.bg} stroke={active || planned ? COLOR.gold : COLOR.teal} strokeWidth={1.4}
                    strokeDasharray={planned && !active ? '3 3' : undefined} />
                  {active && (
                    <circle cx={x} cy={y} r={13} fill="none" stroke={COLOR.gold} strokeWidth={3.2}
                      strokeDasharray={`${(share * 81.7).toFixed(1)} 81.7`} transform={`rotate(-90 ${x} ${y})`} />
                  )}
                  {done && !active
                    ? <CheckCircle2 x={x - 8} y={y - 8} width={16} height={16} color={COLOR.teal} />
                    : <Construction x={x - 8} y={y - 8} width={16} height={16} color={COLOR.gold} />}
                </g>
              );
            })}
            {economy.regionEvent && labelAt(economy.regionEvent.region) && (() => {
              const [lx, ly] = labelAt(economy.regionEvent.region);
              const reg = regionById(economy.regionEvent.region);
              const w = reg ? reg.short.length * 9.6 + 18 : 100;
              return (
                <g transform={`translate(${lx + w / 2 + 4},${ly - 14})`}>
                  <circle r={15} fill={COLOR.rust} opacity={0.25}>
                    <animate attributeName="r" values="12;22;12" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle r={11} fill={COLOR.rust} />
                  <text y={5} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: COLOR.bg }}>!</text>
                </g>
              );
            })()}
            {war && (
              <text x={war.cfg.labelAt[0]} y={war.cfg.labelAt[1]} textAnchor="middle" stroke={COLOR.bg} strokeWidth={3.4}
                paintOrder="stroke" style={{ fontSize: 12, fontWeight: 700, fill: COLOR.rust, letterSpacing: '0.18em' }}>ЛИНИЯ ФРОНТА</text>
            )}
            {/* роза ветров, масштаб и картуш — без них это схема, а не карта */}
            <g transform="translate(956,-60)">
              <circle r={26} fill={`${COLOR.bg}cc`} stroke={`${COLOR.text}55`} />
              <path d="M0,-22 L6,0 L0,22 L-6,0 Z" fill={`${COLOR.text}33`} stroke={`${COLOR.text}88`} />
              <path d="M0,-22 L6,0 L-6,0 Z" fill={COLOR.rust} />
              <text y={-30} textAnchor="middle" style={{ fontSize: 12, fill: COLOR.text, fontWeight: 600 }}>С</text>
            </g>
            <g transform="translate(790,690)">
              <rect x={0} y={-4} width={50} height={6} fill={COLOR.text} opacity={0.7} />
              <rect x={50} y={-4} width={50} height={6} fill="none" stroke={COLOR.text} strokeOpacity={0.7} />
              <text x={0} y={16} style={{ fontSize: 11, fill: COLOR.muted }}>0</text>
              <text x={100} y={16} textAnchor="end" style={{ fontSize: 11, fill: COLOR.muted }}>100 км</text>
            </g>
          </g>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {camp && <WarOperationPanel economy={economy} camp={camp} order={order} setOrder={setOrder} planner={warPlanner} />}
        {revCamp && <DefensePanel economy={economy} camp={revCamp} order={defOrder} setOrder={setDefOrder} planner={warPlanner}
          onFocus={setSelected} />}
        {!atWar && (heldIds.length > 0 || economy.peaceTalks) && (
          <NorlandPanel economy={economy} plan={treatyPlan} onPlan={onTreatyPlan} planner={treatyPlanner} />
        )}
        {war && !camp && (() => {
          const nb = NEIGHBORS.find((n) => n.id === war.cfg.neighbor);
          const front = MAP_REGIONS.find((r) => r.id === warFrontRegion(economy));
          return (
            <div className="ems-panel" role="button" tabIndex={0} onClick={() => front && setSelected(front.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' && front) setSelected(front.id); }}
              style={{ padding: 14, borderColor: COLOR.rust, borderLeft: `3px solid ${COLOR.rust}`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Swords size={15} color={COLOR.rust} />
                <span className="ems-serif" style={{ fontSize: 14 }}>Война с {nb ? nb.gen : 'соседом'}</span>
                <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>ещё {economy.warQuartersLeft} кв.</span>
              </div>
              <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.55 }}>
                {war.cfg.inward
                  ? `Оборона: войска ${nb ? nb.of : 'противника'} перешли границу и ведут бои в ${front ? front.loc : 'приграничье'}. Прифронтовая область живёт под обстрелом — напряжение там резко выше.`
                  : `Наступление: армия идёт на ${nb ? nb.short : 'соседа'} из ${front ? front.gen : 'приграничья'}. Тыловая область принимает эшелоны и раненых — напряжение там выше, чем по стране.`}
              </div>
            </div>
          );
        })()}
        {economy.regionEvent && (
          <RegionEventPanel event={economy.regionEvent} economy={economy} plan={plan} onPlan={onPlan} planner={planner}
            onFocus={() => setSelected(economy.regionEvent.region)} />
        )}
        {!economy.regionEvent && economy.lastRegionResolution && (
          <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.45 }}>
            Последнее событие — {economy.lastRegionResolution.title.toLowerCase()}: {economy.lastRegionResolution.byDefault
              ? `ответа не было, вышло «${economy.lastRegionResolution.label.toLowerCase()}»` : `решили «${economy.lastRegionResolution.label.toLowerCase()}»`}.
          </div>
        )}
        <div className="ems-panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            {Icon && <Icon size={16} color={showVotes && sel != null ? voteColor(sel) : tierColor(blurb.tier)} />}
            <span className="ems-serif" style={{ fontSize: 15 }}>{region.name}</span>
          </div>
          <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 10 }}>{region.sector}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ position: 'relative', width: 100, height: 5, borderRadius: 3, flexShrink: 0,
              background: `linear-gradient(90deg, ${COLOR.tealDim} 0%, ${COLOR.tealDim} 35%, ${COLOR.goldDim} 35%, ${COLOR.goldDim} 65%, ${COLOR.rustDim} 65%, ${COLOR.rustDim} 100%)` }}>
              <span style={{ position: 'absolute', left: `calc(${blurb.stress}% - 2px)`, top: -2.5, width: 4, height: 10, borderRadius: 1.5, background: tierColor(blurb.tier) }} />
            </span>
            <span className="ems-mono" style={{ color: tierColor(blurb.tier), fontWeight: 600, fontSize: 12 }}>{Math.round(blurb.stress)} · {tierLabel(blurb.tier)}</span>
          </div>
          <div style={{ fontSize: 12.5, color: COLOR.text, lineHeight: 1.55 }}>{blurb.text}</div>
          {region.annex && <AnnexPanel region={region} economy={economy} plan={plan} onPlan={onPlan} planner={planner} />}
          <RegionProject region={region} economy={economy} plan={plan} onPlan={onPlan} planner={planner} />
        </div>
        {forecast && (
          <CampaignPanel economy={economy} forecast={forecast} region={region} plan={campaignPlan} onPlan={onCampaignPlan}
            planner={campaignPlanner} onFocus={(id) => { setSelected(id); setMode('polls'); }} />
        )}
        <ElectionPanel economy={economy} region={region} election={election} share={showPolls ? null : sel} />
      </div>
    </div>
  );
}

/* Штаб кампании: опрос по областям за несколько кварталов до голосования и
   распределение штабов. Штаб сдвигает колеблющуюся область сильнее всего,
   надёжную и потерянную — почти никак: решать, кого убеждать, а кого списать. */
const SWING_ORDER = ['колеблется', 'склоняется к власти', 'склоняется к оппозиции', 'надёжная', 'потеряна'];
function CampaignPanel({ economy, forecast, region, plan, onPlan, planner, onFocus }) {
  if (forecast.closed) return <ClosedPollPanel forecast={forecast} region={region} onFocus={onFocus} />;
  const used = Object.values(plan || {}).reduce((a, b) => a + b, 0);
  const left = CAMPAIGN_POINTS - used;
  const perPoint = fmtMoney(economy.nominalGdp * CAMPAIGN_COST / 100);
  const set = (id, n) => {
    if (!onPlan) return;
    Audio.play('tab');
    const next = { ...plan };
    if (n > 0) next[id] = n; else delete next[id];
    onPlan(next);
  };
  const rows = [...forecast.byRegion].sort((a, b) => SWING_ORDER.indexOf(a.label) - SWING_ORDER.indexOf(b.label)
    || Math.abs(a.base - 50) - Math.abs(b.base - 50));
  const nat = forecast.national;
  const verdict = nat - forecast.margin > 50 ? 'власть впереди с запасом'
    : nat + forecast.margin < 50 ? 'власть проигрывает'
    : 'в пределах погрешности — исход решат колеблющиеся области';
  return (
    <div className="ems-panel" style={{ padding: 14 }} aria-label="Штаб кампании">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <Flag size={15} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5 }}>Штаб кампании · до выборов {forecast.quartersToElection} кв.</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: voteColor(nat), fontWeight: 600 }}>
          {fmt1(nat)}% ±{fmt1(forecast.margin)}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 9, lineHeight: 1.45 }}>
        Опрос: {verdict}. Штаб в колеблющейся области сдвигает её сильнее всего, в надёжной или потерянной — почти ничего.
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.text, marginBottom: 8 }}>
        {onPlan
          ? <>Штабов на этот квартал: <b className="ems-mono" style={{ color: left > 0 ? COLOR.gold : COLOR.muted }}>{left} из {CAMPAIGN_POINTS}</b> · {perPoint} каждый</>
          : <>Штабы распределяет {planner || 'штаб власти'}: {used} из {CAMPAIGN_POINTS} в этом квартале.</>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((row) => {
          const r = regionById(row.id);
          if (!r) return null;
          const now = (plan || {})[row.id] || 0;
          const lostCause = row.label === 'потеряна' || row.label === 'надёжная';
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5,
              color: row.id === region.id ? COLOR.text : COLOR.muted }}>
              <button className="ems-btn" onClick={() => onFocus(row.id)} aria-label={`Показать ${r.short} на карте`}
                style={{ width: 92, flexShrink: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', color: 'inherit',
                  fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{r.short}</button>
              <span className="ems-mono" style={{ width: 40, textAlign: 'right', color: voteColor(row.share), fontWeight: 600 }}>{Math.round(row.share)}%</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: lostCause ? COLOR.faint : voteColor(row.base),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.label}{row.spent - now > 0 ? ` · штабов ${row.spent - now}` : ''}
              </span>
              {onPlan ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <button className="ems-btn" aria-label={`Убрать штаб: ${r.short}`} disabled={now === 0}
                    style={{ width: 22, height: 22, padding: 0, fontSize: 13 }} onClick={() => set(row.id, now - 1)}>−</button>
                  <span className="ems-mono" style={{ width: 14, textAlign: 'center', color: now ? COLOR.gold : COLOR.faint }}>{now}</span>
                  <button className="ems-btn" aria-label={`Добавить штаб: ${r.short}`} disabled={left === 0}
                    style={{ width: 22, height: 22, padding: 0, fontSize: 13 }} onClick={() => set(row.id, now + 1)}>+</button>
                </span>
              ) : now > 0 && <span className="ems-mono" style={{ color: COLOR.gold }}>+{now}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
        Проценты — уже с расставленными штабами. Вложенное копится до дня голосования; каждый следующий штаб в той же области даёт меньше предыдущего.
      </div>
    </div>
  );
}

/* Закрытый замер при несвободном режиме: настоящая поддержка по областям рядом
   с официальной цифрой. Погрешность шире — анонимность не снимает страх целиком. */
const closedLabel = (share) => (share >= 58 ? 'опора власти' : share >= 50 ? 'держится' : share >= 42 ? 'недовольна' : 'враждебна');
function ClosedPollPanel({ forecast, region, onFocus }) {
  const nat = forecast.national;
  const gap = forecast.official - nat;
  const rows = [...forecast.byRegion].sort((a, b) => a.share - b.share);
  return (
    <div className="ems-panel" style={{ padding: 14 }} aria-label="Закрытый замер">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <Lock size={15} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5 }}>Закрытый замер · для служебного пользования</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: voteColor(nat), fontWeight: 600 }}>
          {fmt1(nat)}% ±{fmt1(forecast.margin)}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 9, lineHeight: 1.5 }}>
        {forecast.noElections
          ? 'Выборов больше нет, но знать, на чём держится власть, по-прежнему нужно. '
          : `Официально на выборах будет около ${Math.round(forecast.official)}% — эту цифру нарисуют. `}
        Здесь — анонимные интервью с поправкой на страх отвечать: настоящая поддержка
        {gap > 1 ? ` на ${Math.round(gap)} п.п. ниже официальной` : ''}. Где она ниже 50%, власть держится не на согласии, а на силе.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((row) => {
          const r = regionById(row.id);
          if (!r) return null;
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5,
              color: row.id === region.id ? COLOR.text : COLOR.muted }}>
              <button className="ems-btn" onClick={() => onFocus(row.id)} aria-label={`Показать ${r.short} на карте`}
                style={{ width: 92, flexShrink: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', color: 'inherit',
                  fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{r.short}</button>
              <span className="ems-mono" style={{ width: 40, textAlign: 'right', color: voteColor(row.share), fontWeight: 600 }}>{Math.round(row.share)}%</span>
              <span style={{ flex: 1, fontSize: 10.5, color: voteColor(row.share) }}>{closedLabel(row.share)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElectionPanel({ economy, region, election, share }) {
  if (!election) {
    return (
      <div className="ems-panel" style={{ padding: 14, fontSize: 12, color: COLOR.muted, lineHeight: 1.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <Vote size={15} color={COLOR.faint} /><span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.text }}>Выборы по областям</span>
        </div>
        {economy.noElections
          ? 'Выборы больше не проводятся: распределять по областям нечего.'
          : `Первое голосование ещё впереди — через ${economy.quartersToElection} кв. После него карта покажет, как проголосовала каждая область.`}
      </div>
    );
  }
  const nat = election.nationalShare;
  const margin = share != null ? share - nat : null;
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <Vote size={15} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 13.5 }}>Выборы · {election.qLabel}</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: voteColor(nat), fontWeight: 600 }}>{fmt1(nat)}% по стране</span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 9 }}>
        {ELECTION_OUTCOME[election.result] || 'итог не объявлен'}
      </div>
      {election.rigged && (
        <div style={{ fontSize: 11, color: COLOR.rust, marginBottom: 8, lineHeight: 1.45 }}>
          Официальные результаты. Наблюдатели на участки не допущены — разброс по областям такой же нарисованный, как и итог.
        </div>
      )}
      {election.coup && (
        <div style={{ fontSize: 11, color: COLOR.rust, marginBottom: 8, lineHeight: 1.45 }}>
          Результат аннулирован: власть не признала поражение и объявила чрезвычайное положение.
        </div>
      )}
      {share != null && (
        <div style={{ fontSize: 12.5, color: COLOR.text, lineHeight: 1.55, marginBottom: 10 }}>
          <b style={{ color: voteColor(share) }}>{region.name}: {fmt1(share)}%</b> за действующую власть — это{' '}
          {Math.abs(margin) < 0.5 ? 'ровно как в среднем по стране'
            : `на ${fmt1(Math.abs(margin))} п.п. ${margin > 0 ? 'больше' : 'меньше'}, чем в среднем по стране`}.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...(election.byRegion || [])].sort((a, b) => b.share - a.share).map((row) => {
          const r = regionById(row.id);
          if (!r) return null;
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5,
              color: row.id === region.id ? COLOR.text : COLOR.muted }}>
              <span style={{ width: 96, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.short}</span>
              {/* полоса отсчитывается ОТ СЕРЕДИНЫ, а не от левого края: при
                  результатах в диапазоне 45–65% полосы «от нуля» выглядят
                  одинаково полными, а перевес в пару пунктов — именно то, что
                  и есть результат выборов */}
              <span style={{ flex: 1, height: 7, borderRadius: 2, background: COLOR.panelAlt, position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, bottom: 0, background: voteColor(row.share), opacity: 0.9,
                  left: `${Math.min(50, clamp(row.share, 0, 100))}%`,
                  width: `${Math.abs(clamp(row.share, 0, 100) - 50)}%` }} />
                <span style={{ position: 'absolute', left: '50%', top: -1, bottom: -1, width: 1, background: `${COLOR.text}88` }} />
              </span>
              <span className="ems-mono" style={{ width: 40, textAlign: 'right', color: voteColor(row.share), fontWeight: 600 }}>{fmt1(row.share)}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
        Доля голосов за действующую власть. Засечка посередине полосы — 50%: всё, что левее, область отдала оппозиции.
      </div>
    </div>
  );
}

/* Стройка округа: что это, сколько стоит и идёт, что даст — и кнопка, если
   решать вам. Стоимость показана и в долях ВВП, и в деньгах за квартал. */
function RegionProject({ region, economy, plan, onPlan, planner }) {
  const p = REGION_PROJECTS.find((x) => x.region === region.id);
  if (!p) return null;
  const active = (economy.projects || []).find((x) => x.id === p.id);
  const built = (economy.projectsBuilt || []).includes(p.id);
  const planned = plan && plan.startProject === p.id;
  const blocker = projectBlocker(p, economy);
  const perQuarter = fmtMoney(economy.nominalGdp * p.cost / 100 / 4);
  return (
    <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${COLOR.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        {built ? <CheckCircle2 size={14} color={COLOR.teal} /> : <Construction size={14} color={COLOR.gold} />}
        <span className="ems-serif" style={{ fontSize: 13 }}>{p.name}</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>
          {built ? 'построено' : active ? `ещё ${active.left} кв.` : `${p.quarters} кв.`}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>{p.effect}</div>
      {!built && (
        <div className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5 }}>
          ≈{fmt1(p.cost)}% ВВП в год · ~{perQuarter} за квартал · напряжение области −{p.relief} навсегда
        </div>
      )}
      {active && (
        <div style={{ marginTop: 7, height: 5, borderRadius: 3, background: COLOR.panelAlt, overflow: 'hidden' }}>
          <div style={{ width: `${(1 - active.left / active.total) * 100}%`, height: '100%', background: COLOR.gold }} />
        </div>
      )}
      {!built && !active && (
        onPlan ? (
          <button className="ems-btn" disabled={!!blocker && !planned}
            style={{ marginTop: 8, padding: '5px 10px', fontSize: 11.5, width: '100%',
              background: planned ? COLOR.gold : COLOR.panelAlt, color: planned ? COLOR.ink : COLOR.text,
              borderColor: planned ? COLOR.gold : COLOR.border, opacity: blocker && !planned ? 0.55 : 1 }}
            onClick={() => { Audio.play('click'); onPlan({ ...plan, startProject: planned ? null : p.id }); }}>
            {planned ? 'Стройка начнётся в конце квартала — отменить' : blocker ? `Нельзя: ${blocker}` : 'Начать стройку'}
          </button>
        ) : (
          <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 6 }}>Стройки запускает {planner || 'Минфин'}.</div>
        )
      )}
    </div>
  );
}

/* Новая земля: лояльность, партизаны, голосует ли — и программа интеграции.
   Программа действует, пока её не отменят (как приказ армии). */
function AnnexPanel({ region, economy, plan, onPlan, planner }) {
  const l = annexLoyalty(economy, region.id);
  const integrated = (economy.annexIntegrated || []).includes(region.id);
  const program = (plan && Array.isArray(plan.integrate)) ? plan.integrate : (economy.annexFunded || []);
  const on = program.includes(region.id);
  const color = l < PARTISAN_BELOW ? COLOR.rust : l < INTEGRATED_AT ? COLOR.gold : COLOR.teal;
  const status = l < PARTISAN_BELOW ? 'партизаны и саботаж' : integrated ? 'интегрирована, голосует' : 'спокойно, но ещё не голосует';
  const toggle = () => {
    Audio.play('click');
    onPlan({ ...plan, integrate: on ? program.filter((id) => id !== region.id) : [...program, region.id] });
  };
  return (
    <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${COLOR.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Flag size={14} color={color} />
        <span className="ems-serif" style={{ fontSize: 13 }}>Лояльность новой земли</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color, fontWeight: 600 }}>{Math.round(l)} из 100</span>
      </div>
      {/* шкала с засечками: ниже первой — партизаны, со второй — область голосует */}
      <div style={{ position: 'relative', height: 7, borderRadius: 3, background: COLOR.panelAlt, marginBottom: 4 }}>
        <div style={{ width: `${l}%`, height: '100%', borderRadius: 3, background: color }} />
        {[PARTISAN_BELOW, INTEGRATED_AT].map((m) => (
          <span key={m} style={{ position: 'absolute', left: `${m}%`, top: -2, bottom: -2, width: 1.5, background: COLOR.text, opacity: 0.6 }} />
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 10, color: COLOR.faint, marginBottom: 7 }}>
        <span>{status}</span>
        <span style={{ marginLeft: 'auto' }}>{PARTISAN_BELOW} — конец партизан · {INTEGRATED_AT} — голосует</span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5 }}>
        Программа интеграции — паспорта, пенсии, дороги и школы — прибавляет около 6 пунктов лояльности за квартал сверх того,
        что приходит само. Стройка в области и ответы на её события тоже в счёт; напряжение в стране и война за эти земли отнимают.
      </div>
      {onPlan ? (
        <button className="ems-btn" aria-pressed={on}
          style={{ marginTop: 8, padding: '5px 10px', fontSize: 11.5, width: '100%',
            background: on ? COLOR.gold : COLOR.panelAlt, color: on ? COLOR.ink : COLOR.text, borderColor: on ? COLOR.gold : COLOR.border }}
          onClick={toggle}>
          {on ? `Интеграция идёт · ~${fmtMoney(economy.nominalGdp * INTEGRATION_COST / 100)} за квартал — остановить`
            : `Начать программу интеграции · ~${fmtMoney(economy.nominalGdp * INTEGRATION_COST / 100)} за квартал`}
        </button>
      ) : (
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 6 }}>
          {on ? 'Программа интеграции идёт' : 'Программа интеграции не финансируется'} — решает {planner || 'Минфин'}.
        </div>
      )}
    </div>
  );
}

/* Событие в округе: что случилось и чем можно ответить. Без ответа сработает
   вариант по умолчанию — он подписан, чтобы молчание было осознанным выбором. */
function RegionEventPanel({ event, economy, plan, onPlan, planner, onFocus }) {
  const region = regionById(event.region);
  const chosen = plan && plan.regionResponse;
  const def = event.options.find((o) => o.id === event.defaultOption);
  return (
    <div className="ems-panel" style={{ padding: 14, borderColor: COLOR.rust, borderLeft: `3px solid ${COLOR.rust}` }}>
      <div role="button" tabIndex={0} onClick={onFocus} onKeyDown={(e) => { if (e.key === 'Enter') onFocus(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
        <AlertTriangle size={15} color={COLOR.rust} />
        <span className="ems-serif" style={{ fontSize: 14 }}>{event.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>{region ? region.name : ''}</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.55, marginBottom: 9 }}>{event.text}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {event.options.map((o) => {
          const active = chosen === o.id;
          const cost = o.spend ? `~${fmtMoney(economy.nominalGdp * o.spend / 100)}` : 'без затрат';
          const body = (
            <>
              <span style={{ display: 'flex', gap: 8, width: '100%' }}>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? COLOR.goldSoft : COLOR.text }}>{o.label}</span>
                <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint, whiteSpace: 'nowrap' }}>
                  {cost}{o.loyalty ? ` · лояльность ${o.loyalty > 0 ? '+' : ''}${o.loyalty}` : ''}
                </span>
              </span>
              <span style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.4 }}>{o.effect}</span>
            </>
          );
          return onPlan ? (
            <div key={o.id} role="button" tabIndex={0} className="ems-card-btn" aria-pressed={active}
              onClick={() => { Audio.play('tick'); onPlan({ ...plan, regionResponse: active ? null : o.id }); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlan({ ...plan, regionResponse: active ? null : o.id }); } }}
              style={{ padding: '7px 9px', flexDirection: 'column', alignItems: 'flex-start', gap: 2, cursor: 'pointer',
                borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.goldDim : COLOR.panelAlt }}>
              {body}
            </div>
          ) : (
            <div key={o.id} style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 2, border: `1px solid ${COLOR.border}`, borderRadius: 3 }}>{body}</div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 8, lineHeight: 1.45 }}>
        {onPlan
          ? (chosen ? 'Ответ применится в конце квартала.' : `Без ответа: «${def ? def.label.toLowerCase() : 'переждать'}».`)
          : `Отвечает ${planner || 'Минфин'} — решение станет известно в конце квартала.`}
      </div>
    </div>
  );
}

/* Война за новые земли: куда бьёт Норланд, давление по областям, его боевой дух и
   приказ на квартал — какую область укрепить и как. */
function DefensePanel({ economy, camp, order, setOrder, planner, onFocus }) {
  const held = activeRegions(economy).filter((r) => r.annex);
  const last = camp.last;
  const nameOf = (id) => (regionById(id) || {}).short || '—';
  const next = regionById(camp.next);
  return (
    <div className="ems-panel" style={{ padding: 14, borderColor: COLOR.rust, borderLeft: `3px solid ${COLOR.rust}` }} aria-label="Война за новые земли">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Shield size={15} color={COLOR.rust} />
        <span className="ems-serif" style={{ fontSize: 14 }}>Норланд наступает</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>идёт {economy.warElapsed || 1}-й кв.</span>
      </div>
      {next && (
        <div style={{ fontSize: 11.5, color: COLOR.rust, marginBottom: 6, lineHeight: 1.45 }}>
          Разведка: Норланд стягивает силы для удара в {next.loc}.
        </div>
      )}
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 4 }}>
        Боевой дух Норланда {Math.round(camp.morale)} из 100 — на нуле он сам попросит мира. Сила вашей армии {Math.round(warStrength(economy) * 100)} из 100.
      </div>
      <div style={{ height: 5, borderRadius: 3, background: COLOR.panelAlt, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${camp.morale}%`, height: '100%', background: COLOR.rust }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {held.map((r) => {
          const p = camp.pressure[r.id] || 0;
          const sel = order.target === r.id && order.stance !== 'talks';
          const pick = setOrder ? () => { Audio.play('tick'); onFocus(r.id); setOrder({ target: r.id, stance: order.stance === 'talks' ? 'defend' : order.stance }); } : () => onFocus(r.id);
          return (
            <div key={r.id} role="button" tabIndex={0} onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter') pick(); }}
              style={{ padding: '6px 8px', borderRadius: 3, cursor: 'pointer',
                border: `1px solid ${sel ? COLOR.gold : COLOR.border}`, background: sel ? COLOR.goldDim : COLOR.panelAlt }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                {sel ? <Shield size={13} color={COLOR.gold} /> : camp.next === r.id ? <Swords size={13} color={COLOR.rust} /> : <Flag size={13} color={COLOR.muted} />}
                <span style={{ fontWeight: sel ? 600 : 400 }}>{r.short}</span>
                <span style={{ fontSize: 10, color: COLOR.faint }}>лояльность {Math.round(annexLoyalty(economy, r.id))}</span>
                <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 11, color: p >= 60 ? COLOR.rust : COLOR.muted }}>{Math.round(p)} / 100</span>
              </div>
              <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                <div style={{ width: `${p}%`, height: '100%', background: COLOR.rust }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, marginBottom: 4 }}>Приказ на квартал{order.stance !== 'talks' && order.target ? ` — ${nameOf(order.target)}` : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {DEFENSE_STANCES.map((st) => {
          const active = order.stance === st.id;
          return (
            <button key={st.id} className="ems-btn" disabled={!setOrder} title={st.desc}
              onClick={setOrder ? () => { Audio.play('click'); setOrder({ stance: st.id }); } : undefined}
              style={{ padding: '6px 6px', fontSize: 11, textAlign: 'left', lineHeight: 1.3,
                background: active ? (st.id === 'talks' ? COLOR.teal : COLOR.gold) : COLOR.panelAlt,
                color: active ? COLOR.ink : COLOR.text, borderColor: active ? COLOR.gold : COLOR.border, opacity: setOrder || active ? 1 : 0.55 }}>
              <b>{st.label}</b><br />
              <span style={{ fontSize: 9.5, opacity: 0.85 }}>{st.spend ? `~${fmtMoney(economy.nominalGdp * st.spend / 100)} за кв.` : 'без затрат'}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
        {(DEFENSE_STANCES.find((x) => x.id === order.stance) || {}).desc}{' '}
        {setOrder ? 'Приказ действует, пока вы его не смените. Область, куда целит Норланд, выгоднее укрепить заранее.' : `Приказы отдаёт ${planner || 'президент'}.`}
      </div>
      {last && last.hit && (
        <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 8, paddingTop: 7, borderTop: `1px solid ${COLOR.hairline}`, lineHeight: 1.45 }}>
          Прошлый квартал: Норланд ударил — {nameOf(last.hit)}{last.feint ? ' (разведка ошиблась)' : ''}, +{last.gain}
          {last.stance === 'counter' ? `; контрудар — ${nameOf(last.target)}, −${last.pushed}` : last.target === last.hit ? '; удар пришёлся на укреплённую область' : ''}.
        </div>
      )}
    </div>
  );
}

/* Норланд в мирное время: реваншизм, договор и — если открыты переговоры — стол
   переговоров с условиями и ценой каждого из них. */
function NorlandPanel({ economy, plan, onPlan, planner }) {
  // ниже нуля — Норланд ещё зализывает раны после проигранной войны
  const rev = Math.max(0, economy.norlandRevanche || 0);
  const growth = revancheGrowth(economy);
  const t = economy.treaty;
  const talks = economy.peaceTalks;
  const held = activeRegions(economy).filter((r) => r.annex);
  return (
    <div className="ems-panel" style={{ padding: 14 }} aria-label="Отношения с Норландом">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Handshake size={15} color={talks ? COLOR.gold : COLOR.muted} />
        <span className="ems-serif" style={{ fontSize: 13.5 }}>Норланд{talks ? ' · переговоры о мире' : ''}</span>
      </div>
      {held.length > 0 && (
        <>
          <div style={{ display: 'flex', fontSize: 11.5, marginBottom: 4 }}>
            <span style={{ color: COLOR.muted }}>Реваншизм Норланда</span>
            <span className="ems-mono" style={{ marginLeft: 'auto', color: rev >= REVANCHE_WARN ? COLOR.rust : COLOR.text, fontWeight: 600 }}>
              {Math.round(rev)} из 100 {growth > 0 ? `· +${fmt1(growth)} за кв.` : ''}
            </span>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: COLOR.panelAlt, marginBottom: 5 }}>
            <div style={{ width: `${rev}%`, height: '100%', borderRadius: 3, background: rev >= REVANCHE_WARN ? COLOR.rust : COLOR.gold }} />
            <span style={{ position: 'absolute', left: `${REVANCHE_WARN}%`, top: -2, bottom: -2, width: 1.5, background: COLOR.text, opacity: 0.6 }} />
          </div>
          <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            На 100 Норланд нападает, чтобы вернуть свои земли. Быстрее растёт, когда граница не признана и земель у вас много;
            медленнее — после договора и особенно после признания границы. Сильная армия сдерживает, кризисы в стране подогревают.
          </div>
        </>
      )}
      <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.5, marginBottom: talks ? 10 : 0 }}>
        {t ? (
          <>Договор подписан: граница {t.recognized ? <b style={{ color: COLOR.teal }}>признана</b> : <b style={{ color: COLOR.rust }}>не признана</b>}
            {t.sanctions ? ', санкции сняты' : ''}{t.reparations === 'receive' ? ', Норланд платит репарации' : t.reparations === 'pay' ? ', страна платит репарации' : ''}.
            {!t.recognized && ' Санкции за непризнанную границу продолжаются.'}</>
        ) : held.length > 0 ? (
          <>Договора нет: новая граница <b style={{ color: COLOR.rust }}>не признана</b>, санкции продолжаются каждый квартал.</>
        ) : null}
      </div>
      {talks && <TreatyTalks economy={economy} talks={talks} plan={plan} onPlan={onPlan} planner={planner} held={held} />}
    </div>
  );
}

const TERMS_OFF = { recognition: false, sanctions: false, reparations: null, returned: [], propose: false, walkAway: false };
function TreatyTalks({ economy, talks, plan, onPlan, planner, held }) {
  const terms = { ...TERMS_OFF, ...plan };
  const clean = sanitizeTreaty(terms, economy);
  const cost = treatyCost(clean, economy);
  const ok = cost <= talks.leverage;
  const set = (patch) => { if (!onPlan) return; Audio.play('tick'); onPlan({ ...terms, walkAway: false, ...patch }); };
  const costOf = (patch) => treatyCost(sanitizeTreaty({ ...TERMS_OFF, returned: terms.returned, ...patch }, economy), economy)
    - treatyCost(sanitizeTreaty({ ...TERMS_OFF, returned: terms.returned }, economy), economy);
  const Term = ({ active, onClick, label, price }) => (
    <button className="ems-btn" aria-pressed={active} disabled={!onPlan} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 9px', fontSize: 11.5, textAlign: 'left',
        background: active ? COLOR.goldDim : COLOR.panelAlt, borderColor: active ? COLOR.gold : COLOR.border, color: COLOR.text }}>
      <span style={{ width: 12, height: 12, borderRadius: 2, border: `1.5px solid ${active ? COLOR.gold : COLOR.faint}`, background: active ? COLOR.gold : 'none', flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span className="ems-mono" style={{ fontSize: 10.5, color: price < 0 ? COLOR.teal : COLOR.muted }}>{price > 0 ? `цена ${price}` : `уступка ${-price}`}</span>
    </button>
  );
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 9 }}>
        <Term active={terms.recognition} onClick={() => set({ recognition: !terms.recognition })}
          label="Признание новой границы" price={costOf({ recognition: true })} />
        <Term active={terms.sanctions} onClick={() => set({ sanctions: !terms.sanctions })}
          label="Поддержка снятия санкций" price={costOf({ sanctions: true })} />
        <Term active={terms.reparations === 'receive'} onClick={() => set({ reparations: terms.reparations === 'receive' ? null : 'receive' })}
          label="Норланд платит репарации (~0,6% ВВП в год, 2 года)" price={costOf({ reparations: 'receive' })} />
        <Term active={terms.reparations === 'pay'} onClick={() => set({ reparations: terms.reparations === 'pay' ? null : 'pay' })}
          label="Страна платит репарации Норланду" price={costOf({ reparations: 'pay' })} />
        {held.map((r) => (
          <Term key={r.id} active={terms.returned.includes(r.id)}
            onClick={() => set({ returned: terms.returned.includes(r.id) ? terms.returned.filter((id) => id !== r.id) : [...terms.returned, r.id] })}
            label={`Вернуть Норланду: ${r.name}`} price={treatyCost(sanitizeTreaty({ ...TERMS_OFF, returned: [r.id] }, economy), economy)} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, marginBottom: 4 }}>
        <span style={{ color: COLOR.muted }}>Позиция страны {Math.round(talks.leverage)} · цена требований {Math.round(cost)}</span>
        <b style={{ marginLeft: 'auto', color: ok ? COLOR.teal : COLOR.rust }}>{ok ? 'Норланд согласится' : 'Норланд откажет'}</b>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
        Позиция тает на 2 в квартал, пока тянут время.{talks.refused ? ` В прошлый раз Норланд отверг условия ценой ${talks.refused.cost}.` : ''}
      </div>
      {onPlan ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="ems-btn" style={{ flex: 1, padding: '6px 8px', fontSize: 11.5,
            background: terms.propose ? COLOR.gold : COLOR.panelAlt, color: terms.propose ? COLOR.ink : COLOR.text, borderColor: terms.propose ? COLOR.gold : COLOR.border }}
            onClick={() => set({ propose: !terms.propose })}>
            {terms.propose ? 'Договор будет предложен — отменить' : 'Предложить договор'}
          </button>
          <button className="ems-btn" style={{ padding: '6px 8px', fontSize: 11.5,
            background: terms.walkAway ? COLOR.rust : COLOR.panelAlt, color: terms.walkAway ? COLOR.ink : COLOR.text, borderColor: terms.walkAway ? COLOR.rust : COLOR.border }}
            onClick={() => { Audio.play('tick'); onPlan({ ...terms, propose: false, walkAway: !terms.walkAway }); }}>
            {terms.walkAway ? 'Выход из переговоров — отменить' : 'Прервать переговоры'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: COLOR.faint }}>Переговоры ведёт {planner || 'президент'}.</div>
      )}
    </div>
  );
}

/* Военная операция: цели, их взятие и приказ на квартал. Один приказ — одна цель и
   один способ действий; цена в деньгах и потерях подписана у каждого способа. */
function WarOperationPanel({ economy, camp, order, setOrder, planner }) {
  const strength = warStrength(economy);
  const last = camp.last;
  const nameOf = (id) => (WAR_OBJECTIVES.find((o) => o.id === id) || {}).name || '—';
  return (
    <div className="ems-panel" style={{ padding: 14, borderColor: COLOR.rust, borderLeft: `3px solid ${COLOR.rust}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Swords size={15} color={COLOR.rust} />
        <span className="ems-serif" style={{ fontSize: 14 }}>Наступление на Норланд</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>идёт {economy.warElapsed || 1}-й кв.</span>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 9 }}>
        Сила армии {Math.round(strength * 100)} из 100 — от доли обороны в бюджете и поддержки в стране.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {WAR_OBJECTIVES.map((o) => {
          const taken = camp.captured.includes(o.id);
          const open = warObjectiveOpen(o.id, camp);
          const prog = camp.progress[o.id] || 0;
          const sel = order.target === o.id && order.stance !== 'ceasefire';
          return (
            <div key={o.id} role={setOrder && open ? 'button' : undefined} tabIndex={setOrder && open ? 0 : undefined}
              onClick={setOrder && open ? () => { Audio.play('tick'); setOrder({ target: o.id, stance: order.stance === 'ceasefire' ? 'siege' : order.stance }); } : undefined}
              onKeyDown={setOrder && open ? (e) => { if (e.key === 'Enter') setOrder({ target: o.id }); } : undefined}
              title={o.desc}
              style={{ padding: '6px 8px', borderRadius: 3, cursor: setOrder && open ? 'pointer' : 'default',
                border: `1px solid ${sel ? COLOR.gold : COLOR.border}`, background: sel ? COLOR.goldDim : COLOR.panelAlt, opacity: open || taken ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                {taken ? <Flag size={13} color={COLOR.gold} /> : open ? <Swords size={13} color={COLOR.rust} /> : <Lock size={13} color={COLOR.faint} />}
                <span style={{ fontWeight: sel ? 600 : 400 }}>{o.name}</span>
                <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 11, color: taken ? COLOR.goldSoft : COLOR.muted }}>
                  {taken ? 'взята' : open ? `${Math.round(prog)} / 100` : 'сначала перевал'}
                </span>
              </div>
              {!taken && (
                <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                  <div style={{ width: `${prog}%`, height: '100%', background: COLOR.gold }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, marginBottom: 4 }}>Приказ на квартал{order.target && order.stance !== 'ceasefire' ? ` — цель: ${nameOf(order.target)}` : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {WAR_STANCES.map((st) => {
          const active = order.stance === st.id;
          return (
            <button key={st.id} className="ems-btn" disabled={!setOrder}
              onClick={setOrder ? () => { Audio.play('click'); setOrder({ stance: st.id }); } : undefined}
              title={st.desc}
              style={{ padding: '6px 6px', fontSize: 11, textAlign: 'left', lineHeight: 1.3,
                background: active ? (st.id === 'ceasefire' ? COLOR.teal : COLOR.gold) : COLOR.panelAlt,
                color: active ? COLOR.ink : COLOR.text, borderColor: active ? COLOR.gold : COLOR.border, opacity: setOrder || active ? 1 : 0.55 }}>
              <b>{st.label}</b><br />
              <span style={{ fontSize: 9.5, opacity: 0.85 }}>{st.spend ? `~${fmtMoney(economy.nominalGdp * st.spend / 100)} за квартал` : 'без затрат'}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
        {(WAR_STANCES.find((x) => x.id === order.stance) || {}).desc}{' '}
        {setOrder ? 'Приказ действует, пока вы его не смените: армия продолжит его и в следующих кварталах.' : `Приказы отдаёт ${planner || 'президент'}.`}
      </div>
      {last && (
        <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 8, paddingTop: 7, borderTop: `1px solid ${COLOR.hairline}`, lineHeight: 1.45 }}>
          Прошлый квартал: {last.stance === 'ceasefire' ? 'предложено перемирие'
            : `${(WAR_STANCES.find((x) => x.id === last.stance) || {}).label.toLowerCase()} — ${nameOf(last.target)}, +${last.gained}`}
          {last.counter ? `; контратака у цели «${nameOf(last.counter.target)}», −${last.counter.lost}` : ''}.
        </div>
      )}
    </div>
  );
}
