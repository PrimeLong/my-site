// карта Пути: пять областей уровней вместо административных округов (docs/mechanics.md, «Навигация»)
import { describe, it, expect } from 'vitest';
import { levelRegions, voronoi, LEVEL_TINT } from '../levelmap.js';
import { UNITS, LEVELS } from '../course.js';
import { placeOf } from '../../ds-tokens.js';

describe('карта: области уровней', () => {
  const { regions, borders } = levelRegions();
  it('пять областей — по уровням, в порядке курса, у каждой цвет, номер и место для номера', () => {
    expect(regions.map((r) => r.id)).toEqual(LEVELS.map((l) => l.id));
    regions.forEach((r, k) => {
      expect(r.no).toBe(k + 1);
      expect(LEVEL_TINT[r.id]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(r.d.length).toBeGreaterThan(10);
      expect(r.label).toHaveLength(2);
    });
    // каждый юнит — в области своего уровня
    UNITS.forEach((u) => expect(regions.find((r) => r.units.includes(u.id)).id).toBe(u.level));
  });
  it('граница — только между разными уровнями; клетка Вороного держит своё место', () => {
    expect(borders.length).toBeGreaterThan(4);
    borders.forEach((b) => expect(b.between[0]).not.toBe(b.between[1]));
    const sites = UNITS.map((u) => placeOf(u.id).at);
    const cells = voronoi(sites);
    cells.forEach((poly, i) => {
      // место внутри своей клетки: ни одна вершина клетки не ближе к другому месту, чем к своему
      poly.forEach((v) => {
        const own = Math.hypot(v.p[0] - sites[i][0], v.p[1] - sites[i][1]);
        sites.forEach((s) => expect(own).toBeLessThanOrEqual(Math.hypot(v.p[0] - s[0], v.p[1] - s[1]) + 1e-6));
      });
    });
  });
});

describe('карта: 25 мест — по пять на уровень', async () => {
  const { mapSlots, PER_LEVEL } = await import('../levelmap.js');
  const slots = mapSlots();
  it('на каждом уровне пять мест: юниты уровня и места под будущие юниты', () => {
    expect(slots).toHaveLength(25);
    LEVELS.forEach((l) => expect(slots.filter((x) => x.level === l.id), l.id).toHaveLength(PER_LEVEL));
    // юниты — каждый ровно один раз, в порядке Пути (по уровням)
    expect(slots.filter((x) => !x.soon).map((x) => x.id)).toEqual(UNITS.map((u) => u.id));
    expect(new Set(slots.map((x) => x.id)).size).toBe(25);
  });
  it('места не налезают друг на друга, дорога не пересекает себя', () => {
    slots.forEach((a, i) => slots.forEach((b, j) => { if (i < j) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${a.id}–${b.id}`).toBeGreaterThan(70); }));
    const seg = slots.slice(1).map((b, k) => [slots[k].at, b.at]);
    const cross = ([p1, p2], [p3, p4]) => {
      const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
    };
    seg.forEach((s1, i) => seg.forEach((s2, j) => { if (j > i + 1) expect(cross(s1, s2), `${i}×${j}`).toBe(false); }));
  });
});
