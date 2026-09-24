import { describe, it, expect } from 'vitest';
import handler from '../solo.js';
import { makeTycoon, snapshotTycoon } from '../../src/lib/tycoon.js';

function call(method, { query = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
    handler({ method, query, body }, res);
  });
}

describe('слоты «Своего дела» на сервере', () => {
  it('сохраняются отдельно от обычных партий и отдаются целиком', async () => {
    const snap = snapshotTycoon(makeTycoon({ start: 'retail' }));
    const r = await call('POST', { body: { action: 'save', kind: 'tycoon', playerId: 'ty-1', slot: 1, snapshot: snap } });
    expect(r.status).toBe(200);
    expect(r.data.slots[1]).toMatchObject({ start: 'retail', buildings: 2 });
    const solo = await call('GET', { query: { playerId: 'ty-1' } });
    expect(solo.data.slots.every((x) => x === null)).toBe(true);
    const back = await call('GET', { query: { playerId: 'ty-1', slot: '1', kind: 'tycoon' } });
    expect(back.data.snapshot.mode).toBe('tycoon');
  });

  it('обычная партия в слот тайкуна не ложится, и наоборот', async () => {
    const snap = snapshotTycoon(makeTycoon());
    expect((await call('POST', { body: { action: 'save', playerId: 'ty-2', slot: 0, snapshot: snap } })).status).toBe(400);
    expect((await call('POST', { body: { action: 'save', kind: 'tycoon', playerId: 'ty-2', slot: 0, snapshot: { app: 'economic-panel', setup: {}, economy: {}, history: [] } } })).status).toBe(400);
  });

  it('удаление освобождает слот', async () => {
    const snap = snapshotTycoon(makeTycoon());
    await call('POST', { body: { action: 'save', kind: 'tycoon', playerId: 'ty-3', slot: 2, snapshot: snap } });
    const d = await call('POST', { body: { action: 'delete', kind: 'tycoon', playerId: 'ty-3', slot: 2 } });
    expect(d.data.slots[2]).toBe(null);
  });
});
