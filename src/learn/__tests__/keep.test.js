import { describe, it, expect } from 'vitest';
import { KEEP, keepStart, keepNews, keepRate, keepStep, keepGoal, inBand, keepHint } from '../keep.js';

const run = (st, ms, t0 = 0) => { let s = st; for (let t = t0; t <= t0 + ms; t += KEEP.tickMs) s = keepStep(s, t); return s; };

describe('«Держи инфляцию»: ставка против давления на цены', () => {
  it('на старте инфляция у цели и в коридоре', () => {
    const st = keepStart();
    expect(st.infl).toBe(KEEP.target);
    expect(inBand(st.infl)).toBe(true);
    expect(keepGoal(st)).toBe(KEEP.target);
  });
  it('новость «+3» без ответа уводит инфляцию из коридора — раунд не засчитан', () => {
    let st = keepNews(keepStart(), { key: 'g0', effect: 3 }, 0);
    expect(keepHint(st)).toBe('up');
    st = run(st, KEEP.windowMs + 300);
    expect(st.infl).toBeGreaterThan(KEEP.target + KEEP.band);
    expect(st.answers).toEqual([false]);
  });
  it('подняли ставку на три пункта — инфляция вернулась в коридор, раунд засчитан', () => {
    let st = keepNews(keepStart(), { key: 'g0', effect: 3 }, 0);
    st = keepRate(keepRate(keepRate(st, 'up'), 'up'), 'up');
    expect(keepGoal(st)).toBe(KEEP.target);
    st = run(st, 3000);
    expect(st.answers).toEqual([true]);
  });
  it('перестарались — инфляция падает ниже коридора: не засчитан', () => {
    let st = keepNews(keepStart(), { key: 'g0', effect: 2 }, 0);
    for (let k = 0; k < 6; k += 1) st = keepRate(st, 'up');
    expect(keepHint(st)).toBe('down');
    st = run(st, KEEP.windowMs + 300);
    expect(st.answers).toEqual([false]);
  });
  it('ставка — от 0 до 20%, давление ограничено', () => {
    let st = keepStart();
    for (let k = 0; k < 30; k += 1) st = keepRate(st, 'down');
    expect(st.rate).toBe(KEEP.minRate);
    for (let k = 0; k < 10; k += 1) st = keepNews(st, { key: 'x', effect: 3 }, 0);
    expect(st.pressure).toBe(KEEP.maxPressure);
  });
});

describe('держи инфляцию: слабая новость', () => {
  it('если цель осталась в коридоре, новость просит не трогать ставку — и раунд засчитан без нажатий', () => {
    let st = keepNews(keepStart(), { key: 'a', effect: 1 }, 0);
    expect(st.news.need).toBe('hold');
    for (let t = 250; t <= 3000 && !st.news.done; t += 250) st = keepStep(st, t);
    expect(st.news.ok).toBe(true);
  });
  it('сильная новость просит сдвинуть ставку в нужную сторону', () => {
    expect(keepNews(keepStart(), { key: 'a', effect: 3 }, 0).news.need).toBe('up');
    expect(keepNews(keepStart(), { key: 'a', effect: -3 }, 0).news.need).toBe('down');
  });
});

describe('держи инфляцию: уровень на краю коридора', () => {
  it('уровень ровно 3% — инфляция подходит к нему снизу и раунд всё равно засчитан', () => {
    // инфляция 1%, уровень — 3%: плавно она к 3% не дойдёт, но устоится рядом
    let st = { ...keepStart(), infl: 1 };
    st = keepNews(st, { key: 'a', effect: -1 }, 0);
    expect(keepGoal(st)).toBe(3);
    expect(st.news.need).toBe('hold');
    st = run(st, 4000, KEEP.tickMs);
    expect(st.infl).toBeLessThan(3);
    expect(st.answers).toEqual([true]);
  });
});

