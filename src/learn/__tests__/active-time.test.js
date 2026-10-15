// Время урока — только когда ученик на месте (src/learn/active-time.js)
import { describe, it, expect } from 'vitest';
import { activeClock, tickClock, actClock, IDLE_MS } from '../active-time.js';

const T = 1e12;
// часы, которые тикают раз в секунду от from до to (видимость — visible)
const run = (c, from, to, visible = true) => { let x = c; for (let t = from + 1000; t <= to; t += 1000) x = tickClock(x, t, visible); return x; };

describe('время урока', () => {
  it('ученик отвечает — секунды идут', () => {
    let c = activeClock(T);
    for (let k = 1; k <= 6; k += 1) { c = run(c, T + (k - 1) * 10000, T + k * 10000); c = actClock(c, T + k * 10000); }
    expect(c.ms).toBe(60000);
  });
  it('телефон выключили на три часа — пауза не считается; продолжил — время идёт дальше', () => {
    let c = actClock(activeClock(T), T + 20000);
    c = run(c, T, T + 20000);
    const before = c.ms;
    // вкладка скрыта три часа: тиков почти нет, а после возвращения — один большой разрыв
    c = tickClock(c, T + 20000 + 3 * 3600000, false);
    c = actClock(c, T + 20000 + 3 * 3600000 + 1000);
    expect(c.ms - before).toBeLessThanOrEqual(5000);
    c = run(c, T + 20000 + 3 * 3600000 + 1000, T + 20000 + 3 * 3600000 + 31000);
    expect(c.ms - before).toBeGreaterThanOrEqual(30000);
    expect(c.ms).toBeLessThan(60000);
  });
  it('вкладка открыта, но без касаний дольше минуты — время стоит', () => {
    let c = actClock(activeClock(T), T);
    c = run(c, T, T + 10 * 60000);
    expect(c.ms).toBe(IDLE_MS);
  });
  it('продолжение прерванного урока начинается с уже набранного', () => {
    expect(activeClock(T, 42000).ms).toBe(42000);
  });
});
