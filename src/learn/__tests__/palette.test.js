import { describe, it, expect } from 'vitest';
import { PLACES, WARM, DIAMOND_COLOR } from '../../ds-tokens.js';

/* Тёплая палитра (docs/world.md, «Цвета»): места юнитов, их кнопки и алмазный уровень — без
   синих, голубых и сине-фиолетовых; белый текст на каждом цвете — с контрастом от 4,5:1. */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const c = rgb(h).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrastWhite = (h) => 1.05 / (lum(h) + 0.05);
function hue(h) {
  const [r, g, b] = rgb(h); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (!d) return 0;
  const k = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (k * 60 + 360) % 360;
}
// тёплые оттенки: от красного через оранжевый и охру до оливы (≤ 90°) и сливово-гранатовые (≥ 300°)
const warm = (h) => { const x = hue(h); return x <= 90 || x >= 300; };

describe('тёплая палитра', () => {
  const colors = { ...Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [`место ${k}`, p.color])), ...Object.fromEntries(Object.entries(WARM).map(([k, c]) => [`WARM.${k}`, c])), 'алмаз': DIAMOND_COLOR };
  it('места юнитов, палитра и алмаз — тёплые', () => {
    Object.entries(colors).forEach(([name, c]) => expect(warm(c), `${name} ${c}: оттенок ${Math.round(hue(c))}°`).toBe(true));
  });
  it('белый текст на кнопках юнита и алмаза — контраст не ниже 4,5:1', () => {
    Object.entries(colors).forEach(([name, c]) => expect(contrastWhite(c), `${name} ${c}`).toBeGreaterThanOrEqual(4.5));
  });
  it('алмаз — из палитры WARM', () => {
    expect(Object.values(WARM)).toContain(DIAMOND_COLOR);
  });
});
