/* Карта страны: округа, их напряжение и итоги выборов по округам. Вынесена
   из MacroSimulator.jsx в отдельный чанк и грузится лениво — карта нужна
   только по нажатию вкладки «Карта», а не при первой загрузке сайта. */
import { Anchor, Coins, Factory, Landmark, Pickaxe, Users, Vote, Wheat } from 'lucide-react';
import { MAP_REGIONS, clamp, fmt1, regionBlurb } from './lib/engine.js';
import { useState } from 'react';
import {
  Audio, COLOR, starPath,
} from './MacroSimulator.jsx';

/* ------------------------------ КАРТА СТРАНЫ ------------------------------
   Страна безымянная, но карта у неё должна быть похожа на настоящую: рваный
   берег, сухопутная граница, река, столица — а не ровные шестиугольники,
   которые читаются как инфографика, а не как государство.

   Геометрия собрана из ОБЩИХ отрезков, а не из независимых полигонов: контур
   (MAP_RING) режется шестью опорными точками (MAP_ANCHORS) на дуги, от каждой
   опорной точки внутрь идёт радиальная граница (через изгиб MAP_RADIAL к
   вершине столичного округа MAP_CENTER). Соседние округа переиспользуют один
   и тот же отрезок в обратном порядке — поэтому между ними физически не может
   появиться щель или нахлёст, как бы ни сглаживалась линия.

   Сглаживание — Catmull-Rom, он симметричен относительно разворота списка
   точек: одна и та же дуга, пройденная в обе стороны, даёт одну и ту же
   кривую. Без этого свойства общие границы разъехались бы. */
const MAP_RING = [
  [306, 34], [330, 44], [356, 48], [380, 80], [410, 96], [436, 126],       // северная оконечность
  [470, 140], [506, 176], [528, 222], [552, 262], [530, 300], [496, 342],  // восток с заливом
  [556, 420], [572, 470], [542, 522], [520, 578], [470, 626], [414, 668],  // юго-восток
  [346, 712], [292, 700], [246, 672], [206, 640], [176, 592], [146, 540],  // южная оконечность
  [120, 486], [146, 436], [128, 390], [156, 336], [132, 282], [160, 228],  // западный рубеж
  [150, 170], [186, 140], [214, 104], [246, 96], [268, 62], [284, 40],     // северо-запад
];
const MAP_ANCHORS = [0, 6, 12, 18, 24, 30];
const MAP_CENTER = [[300, 290], [372, 304], [432, 388], [358, 472], [276, 446], [268, 348]];
// лёгкий излом на каждой грани столичного округа: ровный многоугольник в
// середине карты выдавал бы «диаграмму», а сильный изгиб — пузырь; поэтому
// смещение от середины грани маленькое, на несколько единиц
const MAP_CENTER_BEND = [[330, 288], [412, 338], [402, 436], [312, 470], [262, 396], [288, 312]];
// у каждой радиальной границы свой излом — иначе округа читаются как ровные
// доли пирога, а не как губернии, нарезанные по рекам и водоразделам
const MAP_RADIAL = [
  [[330, 124], [300, 222]], [[452, 218], [408, 268]], [[494, 400], [452, 424]],
  [[372, 622], [338, 534]], [[188, 500], [244, 470]], [[196, 246], [232, 292]],
];
// какой округ занимает клин между опорными точками i и i+1 (по часовой стрелке)
const MAP_WEDGES = ['agri', 'port', 'industry', 'mining', 'periphery', 'finance'];
// дуги 0..3 — морской берег, 4 и 5 — сухопутная граница с соседями
const MAP_SEA_ARCS = [0, 1, 2, 3];
const MAP_LAND_ARCS = [4, 5];
const MAP_RIVER = [[168, 556], [230, 522], [292, 494], [338, 458], [392, 430], [446, 400], [492, 346]];
const MAP_CITIES = [[404, 196], [500, 250], [250, 616], [176, 372], [392, 618], [252, 210]];
const MAP_ISLANDS = [[596, 316, 11, 7], [614, 246, 7, 5]];
const REGION_ICON = { capital: Landmark, port: Anchor, industry: Factory, agri: Wheat, finance: Coins, mining: Pickaxe, periphery: Users };

function rawArcPoints(i) {
  const from = MAP_ANCHORS[i]; const to = MAP_ANCHORS[(i + 1) % MAP_ANCHORS.length];
  const out = []; let k = from;
  for (;;) { out.push(MAP_RING[k]); if (k === to) break; k = (k + 1) % MAP_RING.length; }
  return out;
}
/* Изломанность берега и границ. Ровная кривая по десятку точек читается как
   лист или клякса; настоящая береговая линия неровная на любом масштабе.
   Классическое смещение середины отрезка по нормали, два прохода — этого
   хватает, чтобы контур перестал быть «гладким».

   Псевдослучайность выведена из самих координат (детерминированный хэш), а не
   из Math.random(): карта обязана быть одинаковой при каждой перерисовке и в
   каждой партии. Концы отрезка не смещаются никогда — именно поэтому опорные
   точки, где сходятся три округа, остаются общими. */
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
// считаем один раз: и клин округа, и линия берега должны брать ОДИН И ТОТ ЖЕ
// изломанный список точек, иначе заливка и контур разойдутся
const ARC_PTS = MAP_ANCHORS.map((_, i) => roughen(rawArcPoints(i), 30, 3));
const arcPoints = (i) => ARC_PTS[i];
/* Catmull-Rom → кубические безье. Концы дублируются, поэтому кривая проходит
   ровно через первую и последнюю точку и не зависит от того, что было до и
   после отрезка — это и делает разворот списка безопасным. */
function curveTo(points) {
  const n = points.length;
  if (n < 2) return '';
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
const RADIAL_PTS = MAP_ANCHORS.map((_, i) => roughen([MAP_RING[MAP_ANCHORS[i]], ...MAP_RADIAL[i], MAP_CENTER[i]], 17, 2));
const radialPoints = (i) => RADIAL_PTS[i];
/* Грань столичного округа — ДВА прямых отрезка через излом, а не кривая:
   сглаженный шестиугольник с изломами превращается в ровный круг, который
   читается как пузырь, а не как область. Прямые отрезки дают ломаную с
   углами — и при этом тривиально совпадают у соседа при обходе в обратную
   сторону. */
const centerEdge = (i) => [MAP_CENTER[i], MAP_CENTER_BEND[i], MAP_CENTER[(i + 1) % MAP_CENTER.length]];
const lineTo = (points) => points.slice(1).map((p) => ` L${p[0]},${p[1]}`).join('');
function wedgePath(i) {
  const j = (i + 1) % MAP_ANCHORS.length;
  const arc = arcPoints(i);
  return `${mv(arc[0])}${curveTo(arc)}${curveTo(radialPoints(j))}`
    + `${lineTo(centerEdge(i).slice().reverse())}${curveTo(radialPoints(i).slice().reverse())} Z`;
}
const capitalPath = `${mv(MAP_CENTER[0])}${MAP_CENTER.map((_, i) => lineTo(centerEdge(i))).join('')} Z`;
const regionPath = (id) => (id === 'capital' ? capitalPath : wedgePath(MAP_WEDGES.indexOf(id)));
const arcPath = (i) => `${mv(arcPoints(i)[0])}${curveTo(arcPoints(i))}`;
const coastPath = MAP_SEA_ARCS.map(arcPath).join(' ');
const borderPath = MAP_LAND_ARCS.map(arcPath).join(' ');
/* Внутренние границы рисуются ОТДЕЛЬНЫМ слоем, а не обводкой самих округов:
   обводка каждого клина проходила и по внешнему контуру тоже и закрашивала
   промежутки пунктира — сухопутная граница переставала отличаться от берега. */
const innerBorderPath = [
  ...MAP_ANCHORS.map((_, i) => `${mv(radialPoints(i)[0])}${curveTo(radialPoints(i))}`),
  capitalPath,
].join(' ');
// ореол у берега — классический картографический приём; рисуем его только по
// восточным дугам, где смещение копии наружу действительно уходит в море
const coastHaloPath = [1, 2].map(arcPath).join(' ');
// подпись ставится между серединой внутренней грани округа и серединой его
// куска побережья; nudge — ручная поправка там, где клин узкий и надпись
// иначе ложится на границу
const MAP_LABEL_NUDGE = { agri: [6, 4], port: [-12, 8], industry: [-6, -10], mining: [14, -18], periphery: [12, 4], finance: [-14, 18] };
function regionLabelAt(id) {
  if (id === 'capital') return [330, 378];
  const i = MAP_WEDGES.indexOf(id); const j = (i + 1) % MAP_ANCHORS.length;
  const arc = arcPoints(i);
  const mid = arc[Math.floor(arc.length / 2)];
  const inner = [(MAP_CENTER[i][0] + MAP_CENTER[j][0]) / 2, (MAP_CENTER[i][1] + MAP_CENTER[j][1]) / 2];
  const nudge = MAP_LABEL_NUDGE[id] || [0, 0];
  return [inner[0] + (mid[0] - inner[0]) * 0.52 + nudge[0], inner[1] + (mid[1] - inner[1]) * 0.52 + nudge[1]];
}

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

export function CountryMap({ economy }) {
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
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['stress', 'Напряжение'], ['votes', 'Выборы']].map(([id, label]) => (
            <button key={id} className="ems-btn" style={{ padding: '5px 10px', fontSize: 11.5,
              background: mode === id ? COLOR.gold : COLOR.panelAlt, color: mode === id ? COLOR.ink : COLOR.text,
              borderColor: mode === id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setMode(id); }}>{label}</button>
          ))}
        </div>
        <svg viewBox="92 6 516 730" style={{ width: '100%', maxWidth: 372, height: 'auto', display: 'block' }}
          role="img" aria-label="Карта округов страны">
          {/* море: лёгкая заливка по всему полю и ореол вдоль берега — суша
              рисуется поверх, поэтому отдельный полигон моря не нужен */}
          <rect x="92" y="6" width="516" height="730" fill={`${COLOR.blue}12`} />
          {[0, 1].map((k) => (
            <path key={k} d={coastHaloPath} fill="none" stroke={`${COLOR.blue}${['30', '1c'][k]}`} strokeWidth={1.2}
              transform={`translate(${5 + k * 6},${2 + k * 3})`} />
          ))}
          {MAP_ISLANDS.map(([x, y, rx, ry]) => (
            <ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry}
              fill={`${COLOR.text}1a`} stroke={`${COLOR.text}66`} strokeWidth={1.2} />
          ))}
          {/* слой 1 — только заливки: по ним кликают и по ним ходит фокус */}
          {MAP_REGIONS.map((r) => {
            const b = regionBlurb(r, economy);
            const share = voteOf(r.id);
            const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
            const alpha = showVotes && share != null ? voteAlpha(share) : '1f';
            const aria = showVotes
              ? `${r.name}: ${share != null ? `${Math.round(share)}% за действующую власть` : 'выборы ещё не проходили'}`
              : `${r.name}, ${r.sector}: ${tierLabel(b.tier)}, ${Math.round(b.stress)} из 100`;
            return (
              <g key={r.id} role="button" tabIndex={0} aria-label={aria} style={{ cursor: 'pointer' }}
                onClick={() => { Audio.play('tab'); setSelected(r.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Audio.play('tab'); setSelected(r.id); } }}>
                <path d={regionPath(r.id)} fill={`${color}${r.id === selected ? '40' : alpha}`} />
              </g>
            );
          })}
          {/* слой 2 — линии карты: внутренние границы тоньше, берег сплошной и
              толстый, сухопутная граница пунктиром. Раньше пунктир забивала
              обводка самих округов, поэтому границы вынесены сюда отдельно */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={innerBorderPath} fill="none" stroke={`${COLOR.text}55`} strokeWidth={1.2} strokeLinejoin="round" />
            <path d={coastPath} fill="none" stroke={`${COLOR.text}88`} strokeWidth={2.4} strokeLinecap="round" />
            <path d={borderPath} fill="none" stroke={`${COLOR.text}99`} strokeWidth={2.6} strokeDasharray="12 7" strokeLinecap="butt" />
            <path d={`${mv(MAP_RIVER[0])}${curveTo(MAP_RIVER)}`} fill="none" stroke={`${COLOR.blue}aa`} strokeWidth={2.6} strokeLinecap="round" />
            {MAP_CITIES.map(([x, y]) => (
              <circle key={`${x},${y}`} cx={x} cy={y} r={3.2} fill={COLOR.bg} stroke={`${COLOR.text}88`} strokeWidth={1.4} />
            ))}
            <path d={regionPath(selected)} fill="none" stroke={showVotes && sel != null ? voteColor(sel) : tierColor(blurb.tier)}
              strokeWidth={3} strokeLinejoin="round" />
          </g>
          {/* слой 3 — подписи поверх всего; клики проходят сквозь него к заливке */}
          <g style={{ pointerEvents: 'none' }}>
            <path d={starPath(342, 424, 12, 5)} fill={COLOR.gold} stroke={COLOR.ink} strokeWidth={0.8} />
            {MAP_REGIONS.map((r) => {
              const b = regionBlurb(r, economy);
              const share = voteOf(r.id);
              const color = showVotes && share != null ? voteColor(share) : tierColor(b.tier);
              const label = showVotes
                ? (share != null ? `${Math.round(share)}%` : '—')
                : String(Math.round(b.stress));
              const [lx, ly] = regionLabelAt(r.id);
              const RIcon = REGION_ICON[r.icon];
              return (
                <g key={r.id}>
                  {!showVotes && RIcon && <RIcon x={lx - 10} y={ly - 32} width={20} height={20} color={color} />}
                  {/* обводка цветом фона под подписью: иначе название ложится
                      прямо на границу округа и перестаёт читаться */}
                  <text x={lx} y={ly - 6} textAnchor="middle" stroke={COLOR.bg} strokeWidth={3.4}
                    paintOrder="stroke" style={{ fontSize: 14, fill: COLOR.text }}>{r.short}</text>
                  <text x={lx} y={ly + 16} textAnchor="middle" className="ems-numeral" stroke={COLOR.bg} strokeWidth={3.4}
                    paintOrder="stroke" style={{ fontSize: 18, fontWeight: 600, fill: color }}>{label}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
