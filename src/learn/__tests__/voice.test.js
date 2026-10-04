import { describe, it, expect } from 'vitest';
import { PHRASES, situation, pickPhrase, endKind } from '../voice.js';
import { seeded } from '../../textbook/variants.js';

describe('голос Инфли: банк фраз', () => {
  const all = Object.values(PHRASES).flat();
  it('25–30 коротких фраз по ситуациям, без повторов, без «неправильно» и восклицаний', () => {
    expect(all.length).toBeGreaterThanOrEqual(25);
    expect(all.length).toBeLessThanOrEqual(30);
    expect(new Set(all).size).toBe(all.length);
    all.forEach((p) => {
      expect(p.split(/\s+/).filter((w) => /[а-яё0-9]/i.test(w)).length, p).toBeLessThanOrEqual(8);
      expect(p, p).not.toMatch(/!|неправильно|глуп|стыд|легко же/i);
    });
    ['ok', 'streak3', 'streak5', 'streak10', 'hinted', 'retry', 'wrong', 'wrong2', 'perfect', 'good', 'mixed', 'checkFail'].forEach((k) => expect(PHRASES[k].length, k).toBeGreaterThan(0));
  });
  it('ситуация: серия 3/5/10, верно после подсказки, повтор решён, вторая ошибка подряд', () => {
    expect(situation({ ok: true, streak: 1 })).toBe('ok');
    expect(situation({ ok: true, streak: 3 })).toBe('streak3');
    expect(situation({ ok: true, streak: 5 })).toBe('streak5');
    expect(situation({ ok: true, streak: 10 })).toBe('streak10');
    expect(situation({ ok: true, streak: 3, hinted: true })).toBe('hinted');
    expect(situation({ ok: true, retry: true })).toBe('retry');
    expect(situation({ ok: false, wrongRun: 1 })).toBe('wrong');
    expect(situation({ ok: false, wrongRun: 2 })).toBe('wrong2');
    expect(endKind({ mistakes: 0, accuracy: 100 })).toBe('perfect');
    expect(endKind({ mistakes: 3, accuracy: 60, failedCheck: true })).toBe('checkFail');
  });
  it('внутри урока фраза не повторяется: десять верных ответов — десять разных фраз', () => {
    const used = new Set(); const rand = seeded(7);
    const said = Array.from({ length: 10 }, (_, i) => pickPhrase(situation({ ok: true, streak: i + 1 }), used, rand));
    expect(new Set(said).size).toBe(10);
    // ошибки: три обычных и вторые подряд — тоже без повторов
    const wrong = [1, 2, 1, 2, 1].map((n) => pickPhrase(situation({ ok: false, wrongRun: n }), used, rand));
    expect(new Set(wrong).size).toBe(5);
  });
});
