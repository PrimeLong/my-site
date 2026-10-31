// Разовые события воронки и открытия разделов: отметки — только в памяти браузера (docs/mechanics.md, «Аналитика»)
import { describe, it, expect } from 'vitest';
import { trackOnce, trackDaily } from '../client.js';

const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const DAY = 86400000;

describe('разовые события', () => {
  it('first_lesson_start уходит один раз с устройства; без памяти браузера — не уходит вовсе', () => {
    const store = memStore(); const sent = [];
    const send = (e, x) => sent.push([e, x]);
    expect(trackOnce('first_lesson_start', {}, { store, send })).toBe(true);
    expect(trackOnce('first_lesson_start', {}, { store, send })).toBe(false);
    expect(trackOnce('first_lesson_done', {}, { store, send })).toBe(true);
    expect(sent.map((x) => x[0])).toEqual(['first_lesson_start', 'first_lesson_done']);
    expect(JSON.parse(store.m['ems-events-once'])).toEqual({ first_lesson_start: 1, first_lesson_done: 1 });
    // память недоступна или запись не удалась — лучше недосчитать, чем считать устройство много раз
    expect(trackOnce('welcome_start', {}, { store: null, send })).toBe(false);
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(trackOnce('welcome_start', {}, { store: broken, send })).toBe(false);
    expect(sent).toHaveLength(2);
  });
  it('открытие раздела — не чаще раза в день (UTC) с устройства', () => {
    const store = memStore(); const sent = [];
    const send = (e) => sent.push(e);
    const t = Date.UTC(2026, 9, 5, 10);
    expect(trackDaily('garden_open', { store, send, now: t })).toBe(true);
    expect(trackDaily('garden_open', { store, send, now: t + 3600000 })).toBe(false);
    expect(trackDaily('shop_open', { store, send, now: t })).toBe(true);
    expect(trackDaily('garden_open', { store, send, now: t + DAY })).toBe(true);
    expect(sent).toEqual(['garden_open', 'shop_open', 'garden_open']);
  });
});
