import { describe, it, expect } from 'vitest';
import handler, { sanitizeEntry, rankBoard, openDays } from '../daily.js';
import { dailyKey } from '../../src/lib/catalog.js';

// минимальные req/res в духе Vercel: хранилище без Redis — память процесса
function call(method, { query = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
    handler({ method, query, body }, res);
  });
}
const today = dailyKey();

describe('таблица вызова дня', () => {
  it('принимает результат и показывает место', async () => {
    const r = await call('POST', { body: { playerId: 'p-alpha', day: today, name: 'Альфа', score: 61.24, role: 'central_bank', quarters: 12 } });
    expect(r.status).toBe(200);
    expect(r.data.you).toMatchObject({ rank: 1, name: 'Альфа', score: 61.2, you: true });
    // чужой playerId наружу не уходит
    expect(JSON.stringify(r.data)).not.toContain('p-alpha');
  });

  it('худший повтор не затирает лучший результат, но имя обновляет', async () => {
    await call('POST', { body: { playerId: 'p-beta', day: today, name: 'Бета', score: 70, role: 'president', quarters: 12 } });
    const r = await call('POST', { body: { playerId: 'p-beta', day: today, name: 'Бета-2', score: 50, role: 'president', quarters: 12 } });
    expect(r.data.improved).toBe(false);
    expect(r.data.you).toMatchObject({ score: 70, name: 'Бета-2', rank: 1 });
    const g = await call('GET', { query: { day: today, playerId: 'p-alpha' } });
    expect(g.data.rows.map((x) => x.name)).toEqual(['Бета-2', 'Альфа']);
    expect(g.data.you).toMatchObject({ rank: 2, you: true });
  });

  it('старые дни и неправдоподобные результаты не принимаются', async () => {
    expect((await call('POST', { body: { playerId: 'p', day: '2020-01-01', score: 50, role: 'central_bank' } })).status).toBe(400);
    expect((await call('POST', { body: { playerId: 'p', day: today, score: 'много', role: 'central_bank' } })).status).toBe(400);
    expect((await call('POST', { body: { playerId: 'p', day: today, score: 50, role: 'trader' } })).status).toBe(400);
    expect(sanitizeEntry({ score: 500, role: 'central_bank' }).score).toBe(100);
    expect(sanitizeEntry({ score: 50, role: 'central_bank', name: '  \u0007  ' }).name).toBe('Без имени');
  });

  it('приём открыт сегодня и вчера по Москве', () => {
    expect(openDays(new Date('2026-09-24T12:00:00Z'))).toEqual(['2026-09-24', '2026-09-23']);
  });

  it('равные баллы — выше тот, кто раньше', () => {
    const rows = rankBoard({ a: { score: 50, at: 2 }, b: { score: 50, at: 1 }, c: { score: 60, at: 3 } });
    expect(rows.map((x) => x.playerId)).toEqual(['c', 'b', 'a']);
  });
});
