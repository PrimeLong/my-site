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
