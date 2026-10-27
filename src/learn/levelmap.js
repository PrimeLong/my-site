/* ОБЛАСТИ УРОВНЕЙ НА КАРТЕ ПУТИ: карта Инфляции делится не на административные округа, а на пять
   областей — по уровням курса (Начальный, Базовый, Средний, Продвинутый, Профессиональный).
   Каждое место юнита стоит на карте (placeOf(...).at); клетка Вороного вокруг места — земля этого
   юнита, клетки юнитов одного уровня — область уровня. Граница рисуется только между разными
   уровнями. Новый юнит на карте сам двигает границы — рисовать их руками не нужно.
   Модуль чистый: его читают карта Пути (src/learn.jsx) и тесты. */
import { UNITS, LEVELS } from './course.js';
import { placeOf, SOON_PLACES } from '../ds-tokens.js';
import { countryPoints } from '../lib/mapgeo.js';

// поле карты Пути (src/learn.jsx, MAP_BOX) с запасом: клетки потом обрезаются по контуру страны
export const LEVEL_BOX = { x: 100, y: 40, w: 840, h: 680 };
// цвет области уровня: спокойные, различимые, с тёмным оттенком для подписи
export const LEVEL_TINT = { start: '#3F8A1F', basic: '#D9590F', middle: '#C0267E', advanced: '#1E73B8', pro: '#5B3FB8' };

/* Клетка Вороного — прямоугольник поля, обрезанный серединными перпендикулярами ко всем другим
   местам. У каждой вершины — метка ребра, которое в неё входит: номер соседнего места или −1
   (край поля), чтобы потом знать, с кем граничит ребро. */
function clip(poly, si, sj, j) {
  const mx = (si[0] + sj[0]) / 2; const my = (si[1] + sj[1]) / 2;
  const dx = sj[0] - si[0]; const dy = sj[1] - si[1];
  const f = (p) => (p[0] - mx) * dx + (p[1] - my) * dy;
  const out = [];
  for (let k = 0; k < poly.length; k += 1) {
    const a = poly[k]; const b = poly[(k + 1) % poly.length];
    const fa = f(a.p); const fb = f(b.p);
    const ina = fa <= 0; const inb = fb <= 0;
    const cut = () => { const t = fa / (fa - fb); return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t]; };
    if (ina && inb) out.push({ p: b.p, lab: b.lab });
    else if (ina && !inb) out.push({ p: cut(), lab: b.lab });
    else if (!ina && inb) { out.push({ p: cut(), lab: j }); out.push({ p: b.p, lab: b.lab }); }
  }
  return out;
}
export function voronoi(sites, box = LEVEL_BOX) {
  const rect = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]].map((p) => ({ p, lab: -1 }));
  return sites.map((si, i) => sites.reduce((poly, sj, j) => (j === i || !poly.length ? poly : clip(poly, si, sj, j)), rect));
}

const r1 = (v) => Math.round(v * 10) / 10;
const polyPath = (poly) => `M${poly.map((v) => `${r1(v.p[0])},${r1(v.p[1])}`).join('L')}Z`;
// центр тяжести многоугольника (для подписи области)
function centroid(polys) {
  let A = 0; let cx = 0; let cy = 0;
  polys.forEach((poly) => {
    poly.forEach((v, k) => {
      const [x0, y0] = v.p; const [x1, y1] = poly[(k + 1) % poly.length].p;
      const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    });
  });
  return A ? [cx / (3 * A), cy / (3 * A)] : [0, 0];
}

// точка внутри многоугольника (луч вправо)
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
// расстояние до отрезка
function segDist2(p, a, b) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return dist2(p, [a[0] + dx * t, a[1] + dy * t]);
}
/* Где поставить номер уровня: на суше, внутри его области и подальше от зданий мест (их рисунок —
   круг около 60 px над точкой места), от дороги и от края страны. Перебор по сетке — карта маленькая. */
function badgeSpot(polys, sites, road, border) {
  const pts = polys.flatMap((poly) => poly.map((v) => v.p));
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  let best = null; let bestScore = -Infinity;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 8) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 8) {
      const p = [x, y];
      if (!inside(p, countryPoints) || !polys.some((poly) => inside(p, poly.map((v) => v.p)))) continue;
      const toSite = Math.min(...sites.map((s) => Math.min(dist2(p, s), dist2(p, [s[0], s[1] - 30]))));
      const toRoad = Math.min(...road.slice(1).map((b, k) => segDist2(p, road[k], b)));
      const toEdge = Math.min(...countryPoints.map((q) => dist2(p, q)));
      const toBorder = border.length ? Math.min(...border.map(([a, b]) => segDist2(p, a, b))) : Infinity;
      // подпись места — строка под зданием шириной около 110 px
      const toName = Math.min(...sites.map((q) => segDist2(p, [q[0] - 58, q[1] + 26], [q[0] + 58, q[1] + 26])));
      const score = Math.min(Math.sqrt(toSite) - 62, Math.sqrt(toRoad) - 22, Math.sqrt(toEdge) - 26, Math.sqrt(toBorder) - 26, Math.sqrt(toName) - 30);
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

/* Места карты по порядку дороги: юниты уровня, за ними — места под будущие юниты этого уровня
   (SOON_PLACES, id «soon:уровень:N»). По пять на уровень — 25 мест. */
export const PER_LEVEL = 5;
export function mapSlots(units = UNITS) {
  return LEVELS.flatMap((l) => [
    ...units.filter((u) => u.level === l.id).map((u) => ({ id: u.id, level: l.id, at: placeOf(u.id).at, soon: false })),
    ...(SOON_PLACES[l.id] || []).map((at, k) => ({ id: `soon:${l.id}:${k + 1}`, level: l.id, at, soon: true })),
  ]);
}

/* Области уровней: для каждого уровня — путь заливки (все клетки его мест), места и точка
   номера; borders — отрезки границ между разными уровнями (каждый один раз). */
export function levelRegions(units = mapSlots()) {
  const sites = units.map((u) => u.at || placeOf(u.id).at);
  const cells = voronoi(sites);
  const levelOfSite = units.map((u) => u.level);
  const regions = LEVELS.map((l, k) => {
    const idx = units.map((u, i) => (u.level === l.id ? i : -1)).filter((i) => i >= 0);
    const polys = idx.map((i) => cells[i]).filter((p) => p.length >= 3);
    // граница области — рёбра её клеток с соседями другого уровня
    const border = idx.flatMap((i) => cells[i].map((v, k) => (v.lab >= 0 && levelOfSite[v.lab] !== l.id ? [cells[i][(k - 1 + cells[i].length) % cells[i].length].p, v.p] : null)).filter(Boolean));
    return { id: l.id, no: k + 1, title: l.title, tint: LEVEL_TINT[l.id], units: idx.map((i) => units[i].id), d: polys.map(polyPath).join(' '),
      label: polys.length ? badgeSpot(polys, sites, sites, border) || centroid(polys) : null };
  }).filter((r) => r.units.length);
  const borders = [];
  cells.forEach((poly, i) => {
    poly.forEach((v, k) => {
      const j = v.lab;
      if (j <= i || levelOfSite[j] === levelOfSite[i]) return;
      const a = poly[(k - 1 + poly.length) % poly.length].p; const b = v.p;
      borders.push({ a: [r1(a[0]), r1(a[1])], b: [r1(b[0]), r1(b[1])], between: [levelOfSite[i], levelOfSite[j]] });
    });
  });
  return { regions, borders };
}
