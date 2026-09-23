/* Карта страны: округа, их напряжение и итоги выборов по округам. Вынесена
   из MacroSimulator.jsx в отдельный чанк и грузится лениво — карта нужна
   только по нажатию вкладки «Карта», а не при первой загрузке сайта. */
import { AlertTriangle, Anchor, CheckCircle2, Coins, Construction, Factory, Landmark, Pickaxe, Trees, Vote, Wheat } from 'lucide-react';
import { MAP_REGIONS, REGION_PROJECTS, clamp, fmt1, fmtMoney, projectBlocker, regionBlurb } from './lib/engine.js';
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
const VIEW_W = 1000; const VIEW_H = 720;
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
const REGION_ICON = { capital: Landmark, port: Anchor, industry: Factory, agri: Wheat, finance: Coins, mining: Pickaxe, periphery: Trees };

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
const regionPath = (id) => REGION_PATH[id];
const edgesOfKind = (kinds) => EDGES.filter((e) => kinds.includes(e[2]))
  .map(([a, b]) => `${mv(NODES[a])}${curveTo(edgePts(a, b))}`).join(' ');
const coastPath = edgesOfKind(['coast']);
const nationalBorderPath = edgesOfKind(['north', 'west', 'southwest']);
const innerBorderPath = edgesOfKind(['inner']);
const countryPath = ringPath(['A', 'J1', 'H', 'J4', 'F1', 'F2', 'F3', 'J10', 'E', 'D', 'C', 'K']);

/* Соседние государства: суша за международной границей до края листа. Их
   общие границы между собой — отдельные линии от трёхсторонних стыков. */
const NB_COAST_N = roughen([NODES.H, [832, 96], [880, 44], [905, 0]], 20, 2);
const NB_COAST_SW = roughen([[300, 720], [318, 690], NODES.D], 16, 2);
const NB_BORDER_NW = roughen([NODES.A, [170, 60], [140, 0]], 10, 2);
const NB_BORDER_SW = roughen([NODES.C, [90, 495], [0, 510]], 10, 2);
const NEIGHBORS = [
  { id: 'north', name: 'СЕВЕРНОЕ КОРОЛЕВСТВО', label: [520, 44], rotate: 0,
    path: `${mv(NODES.A)}${curveTo(edgePts('A', 'J1'))}${curveTo(edgePts('J1', 'H'))}${curveTo(NB_COAST_N)}`
      + ` L140,0${curveTo(NB_BORDER_NW.slice().reverse())} Z` },
  { id: 'west', name: 'ЗАПАДНАЯ ФЕДЕРАЦИЯ', label: [78, 250], rotate: -90,
    path: `${mv(NODES.A)}${curveTo(NB_BORDER_NW)} L0,0 L0,510${curveTo(NB_BORDER_SW.slice().reverse())}`
      + `${curveTo(edgePts('C', 'K'))}${curveTo(edgePts('K', 'A'))} Z` },
  { id: 'southwest', name: 'СТЕПНОЙ СОЮЗ', label: [118, 640], rotate: 0,
    path: `${mv(NODES.C)}${curveTo(NB_BORDER_SW)} L0,720 L300,720${curveTo(NB_COAST_SW)}${curveTo(edgePts('D', 'C'))} Z` },
];
const nbCoastPath = `${mv(NB_COAST_N[0])}${curveTo(NB_COAST_N)} ${mv(NB_COAST_SW[0])}${curveTo(NB_COAST_SW)}`;
const nbBorderPath = `${mv(NB_BORDER_NW[0])}${curveTo(NB_BORDER_NW)} ${mv(NB_BORDER_SW[0])}${curveTo(NB_BORDER_SW)}`;
const ISLANDS = [
  roughen([[900, 300], [930, 316], [922, 346], [890, 342], [884, 318], [900, 300]], 8, 2),
  roughen([[872, 402], [894, 408], [888, 428], [866, 424], [872, 402]], 6, 1),
];

// река: из шахтёрских гор через Кузнечный пояс и столицу — в залив у порта
const RIVER = [[604, 150], [584, 206], [560, 256], [528, 300], [500, 344], [496, 372], [548, 398], [612, 408], [664, 420], [698, 426]];
const TRIBUTARY = [[236, 478], [318, 446], [406, 404], [470, 380], [496, 372]];
// города: столица, центр каждого округа и связывающие их дороги
const CITIES = [
  { id: 'capital', name: 'Столица', at: [496, 372], capital: true },
  { id: 'industry', name: 'Кузнецк', at: [604, 302] },
  { id: 'mining', name: 'Рудногорск', at: [742, 204] },
  { id: 'port', name: 'Портовск', at: [676, 446] },
  { id: 'finance', name: 'Златоград', at: [652, 578] },
  { id: 'agri', name: 'Хлебный', at: [262, 588] },
  { id: 'periphery', name: 'Глухов', at: [352, 176] },
];
const ROADS = CITIES.filter((c) => !c.capital).map((c) => [CITIES[0].at, c.at]);
// рельеф и угодья — условными знаками, как на физической карте
const MOUNTAINS = [[548, 136], [592, 118], [634, 146], [676, 128], [714, 160], [770, 176], [612, 188], [660, 198], [700, 222], [520, 170], [800, 214]];
const FORESTS = [[250, 162], [292, 140], [410, 150], [228, 226], [300, 212], [262, 272], [338, 252], [396, 196], [206, 290], [366, 292], [430, 262], [320, 310]];
const FIELDS = [[236, 400], [300, 420], [226, 470], [310, 486], [380, 470], [260, 540], [340, 560], [420, 520], [400, 590], [300, 612]];
// подпись и число округа — вручную, по свободному месту между знаками
const LABEL_AT = {
  periphery: [292, 246], mining: [652, 176], industry: [520, 280], port: [744, 318],
  capital: [502, 416], finance: [596, 516], agri: [318, 516],
};

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
export function CountryMap({ economy, plan, onPlan, planner }) {
  const [selected, setSelected] = useState('capital');
  const [mode, setMode] = useState('stress');
  const election = economy.lastElection || null;
  const voteOf = (id) => {
    const row = election && (election.byRegion || []).find((x) => x.id === id);
    return row ? row.share : null;
  };
  const region = MAP_REGIONS.find((r) => r.id === selected) || MAP_REGIONS[0];
  const blurb = regionBlurb(region, economy);
  const Icon = REGION_ICON[region.icon];
  const showVotes = mode === 'votes' && !!election;
  const sel = voteOf(region.id);
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 460px', minWidth: 0, maxWidth: 720 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['stress', 'Напряжение'], ['votes', 'Выборы']].map(([id, label]) => (
            <button key={id} className="ems-btn" style={{ padding: '5px 10px', fontSize: 11.5,
              background: mode === id ? COLOR.gold : COLOR.panelAlt, color: mode === id ? COLOR.ink : COLOR.text,
              borderColor: mode === id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setMode(id); }}>{label}</button>
          ))}
        </div>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }}
          role="img" aria-label="Карта округов страны">
          <defs>
            {/* волны на море, пашня на равнине, кварталы в городах — условные знаки
                физической карты, по которым округ узнаётся без подписи */}
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
            <clipPath id="map-country"><path d={countryPath} /></clipPath>
          </defs>
          {/* море и соседи — фон; страна рисуется поверх */}
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`${COLOR.blue}1c`} />
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#map-waves)" />
          {[0, 1, 2].map((k) => (
            <path key={k} d={coastPath} fill="none" stroke={`${COLOR.blue}${['38', '24', '14'][k]}`} strokeWidth={1.2}
              transform={`translate(${5 + k * 6},${3 + k * 4})`} />
          ))}
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
              style={{ fontSize: 15, letterSpacing: '0.28em', fill: COLOR.faint, fontStyle: 'italic' }}>{n.name}</text>
          ))}
          <text x={905} y={560} textAnchor="middle" style={{ fontSize: 17, letterSpacing: '0.3em', fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>ТЁПЛОЕ</text>
          <text x={905} y={582} textAnchor="middle" style={{ fontSize: 17, letterSpacing: '0.3em', fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>МОРЕ</text>
          <text x={868} y={478} textAnchor="middle" style={{ fontSize: 12, fill: `${COLOR.blue}cc`, fontStyle: 'italic' }}>Янтарный залив</text>

          {/* слой 1 — заливки округов: по ним кликают и по ним ходит фокус */}
          {MAP_REGIONS.map((r) => {
            const b = regionBlurb(r, economy);
            const share = voteOf(r.id);
            const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
            const alpha = showVotes && share != null ? voteAlpha(share) : '24';
            const aria = showVotes
              ? `${r.name}: ${share != null ? `${Math.round(share)}% за действующую власть` : 'выборы ещё не проходили'}`
              : `${r.name}, ${r.sector}: ${tierLabel(b.tier)}, ${Math.round(b.stress)} из 100`;
            return (
              <g key={r.id} role="button" tabIndex={0} aria-label={aria} style={{ cursor: 'pointer' }}
                onClick={() => { Audio.play('tab'); setSelected(r.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Audio.play('tab'); setSelected(r.id); } }}>
                <path d={regionPath(r.id)} fill={COLOR.bg} />
                <path d={regionPath(r.id)} fill={`${color}${r.id === selected ? '48' : alpha}`} />
              </g>
            );
          })}
          {/* слой 2 — угодья и рельеф условными знаками; клики проходят насквозь */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={regionPath('agri')} fill="url(#map-fields)" />
            <path d={regionPath('capital')} fill="url(#map-blocks)" opacity={0.8} />
            <path d={regionPath('finance')} fill="url(#map-blocks)" opacity={0.45} />
            {FIELDS.map(([x, y]) => (
              <path key={`f${x},${y}`} d={`M${x - 9},${y} h18 M${x - 7},${y + 5} h14`} stroke={`${COLOR.gold}66`} strokeWidth={1.4} />
            ))}
            {MOUNTAINS.map(([x, y]) => (
              <g key={`m${x},${y}`}>
                <path d={`M${x - 13},${y + 9} L${x},${y - 10} L${x + 13},${y + 9} Z`} fill={`${COLOR.text}1f`} stroke={`${COLOR.text}88`} strokeWidth={1.2} strokeLinejoin="round" />
                <path d={`M${x - 4},${y - 4} L${x},${y - 10} L${x + 4},${y - 4}`} fill="none" stroke={`${COLOR.text}cc`} strokeWidth={1.4} />
              </g>
            ))}
            {FORESTS.map(([x, y]) => (
              <g key={`t${x},${y}`}>
                <circle cx={x} cy={y - 3} r={6.5} fill={`${COLOR.teal}40`} stroke={`${COLOR.teal}99`} strokeWidth={1} />
                <line x1={x} y1={y + 3} x2={x} y2={y + 8} stroke={`${COLOR.teal}99`} strokeWidth={1.4} />
              </g>
            ))}
            {ROADS.map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={`${COLOR.text}40`} strokeWidth={1.6} strokeDasharray="6 5" clipPath="url(#map-country)" />
            ))}
            <path d={`${mv(TRIBUTARY[0])}${curveTo(TRIBUTARY)}`} fill="none" stroke={`${COLOR.blue}aa`} strokeWidth={2} strokeLinecap="round" />
            <path d={`${mv(RIVER[0])}${curveTo(RIVER)}`} fill="none" stroke={`${COLOR.blue}cc`} strokeWidth={3.2} strokeLinecap="round" />
          </g>
          {/* слой 3 — линии: границы округов пунктиром, берег сплошной, граница
              государства штрихпунктиром — как на политической карте */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={innerBorderPath} fill="none" stroke={`${COLOR.text}66`} strokeWidth={1.3} strokeDasharray="4 4" strokeLinecap="round" />
            <path d={coastPath} fill="none" stroke={`${COLOR.text}99`} strokeWidth={2.4} strokeLinecap="round" />
            <path d={nationalBorderPath} fill="none" stroke={COLOR.rust} strokeOpacity={0.75} strokeWidth={3} strokeDasharray="14 5 3 5" />
            <path d={regionPath(selected)} fill="none" stroke={showVotes && sel != null ? voteColor(sel) : tierColor(blurb.tier)}
              strokeWidth={3.2} strokeLinejoin="round" />
          </g>
          {/* слой 4 — города и подписи поверх всего */}
          <g style={{ pointerEvents: 'none' }}>
            {CITIES.map((c) => (
              <g key={c.id}>
                {c.capital
                  ? <path d={starPath(c.at[0], c.at[1], 11, 4.6)} fill={COLOR.gold} stroke={COLOR.ink} strokeWidth={0.8} />
                  : <circle cx={c.at[0]} cy={c.at[1]} r={4.2} fill={COLOR.bg} stroke={COLOR.text} strokeWidth={1.6} />}
                <text x={c.at[0] + (c.capital ? 14 : 8)} y={c.at[1] - 6} stroke={COLOR.bg} strokeWidth={3} paintOrder="stroke"
                  style={{ fontSize: 12, fill: COLOR.muted, fontStyle: 'italic' }}>{c.name}</text>
              </g>
            ))}
            {MAP_REGIONS.map((r) => {
              const b = regionBlurb(r, economy);
              const share = voteOf(r.id);
              const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
              const label = showVotes ? (share != null ? `${Math.round(share)}%` : '—') : String(Math.round(b.stress));
              const [lx, ly] = LABEL_AT[r.id];
              return (
                <g key={r.id}>
                  <text x={lx} y={ly} textAnchor="middle" stroke={COLOR.bg} strokeWidth={4} paintOrder="stroke"
                    style={{ fontSize: 15, fontWeight: 600, fill: COLOR.text, letterSpacing: '0.04em' }}>{r.short.toUpperCase()}</text>
                  <text x={lx} y={ly + 23} textAnchor="middle" className="ems-numeral" stroke={COLOR.bg} strokeWidth={4}
                    paintOrder="stroke" style={{ fontSize: 20, fontWeight: 700, fill: color }}>{label}</text>
                </g>
              );
            })}
            {/* стройки: кран с долей готовности у города округа; достроенное — галочка */}
            {CITIES.map((c) => {
              const active = (economy.projects || []).find((x) => x.region === c.id);
              const done = REGION_PROJECTS.find((p) => p.region === c.id && (economy.projectsBuilt || []).includes(p.id));
              const planned = plan && plan.startProject && REGION_PROJECTS.find((p) => p.id === plan.startProject && p.region === c.id);
              if (!active && !done && !planned) return null;
              const [x, y] = [c.at[0] - 26, c.at[1] + 6];
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
            {economy.regionEvent && LABEL_AT[economy.regionEvent.region] && (() => {
              const [lx, ly] = LABEL_AT[economy.regionEvent.region];
              return (
                <g transform={`translate(${lx + 46},${ly - 18})`}>
                  <circle r={15} fill={COLOR.rust} opacity={0.25}>
                    <animate attributeName="r" values="12;22;12" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle r={11} fill={COLOR.rust} />
                  <text y={5} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: COLOR.bg }}>!</text>
                </g>
              );
            })()}
            {/* роза ветров и масштаб — без них это схема, а не карта */}
            <g transform="translate(940,96)">
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
          <RegionProject region={region} economy={economy} plan={plan} onPlan={onPlan} planner={planner} />
        </div>
        <ElectionPanel economy={economy} region={region} election={election} share={sel} />
      </div>
    </div>
  );
}

function ElectionPanel({ economy, region, election, share }) {
  if (!election) {
    return (
      <div className="ems-panel" style={{ padding: 14, fontSize: 12, color: COLOR.muted, lineHeight: 1.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <Vote size={15} color={COLOR.faint} /><span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.text }}>Выборы по округам</span>
        </div>
        {economy.noElections
          ? 'Выборы больше не проводятся: распределять по округам нечего.'
          : `Первое голосование ещё впереди — через ${economy.quartersToElection} кв. После него карта покажет, как проголосовал каждый округ.`}
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
          Официальные результаты. Наблюдатели на участки не допущены — разброс по округам такой же нарисованный, как и итог.
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
          const r = MAP_REGIONS.find((x) => x.id === row.id);
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
        Доля голосов за действующую власть. Засечка посередине полосы — 50%: всё, что левее, округ отдал оппозиции.
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
          ≈{fmt1(p.cost)}% ВВП в год · ~{perQuarter} за квартал · напряжение округа −{p.relief} навсегда
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

/* Событие в округе: что случилось и чем можно ответить. Без ответа сработает
   вариант по умолчанию — он подписан, чтобы молчание было осознанным выбором. */
function RegionEventPanel({ event, economy, plan, onPlan, planner, onFocus }) {
  const region = MAP_REGIONS.find((r) => r.id === event.region);
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
                <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint, whiteSpace: 'nowrap' }}>{cost}</span>
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
