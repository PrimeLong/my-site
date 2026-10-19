// Прогресс глав учебника — по разделам; все разделы пройдены — глава прочитана сама; задача с первой попытки — монеты
import { describe, it, expect } from 'vitest';
import { chapterRead, chapterShare, sectionProgress } from '../study.js';
import { studySections } from '../content.js';
import { bookFirstTry } from '../../learn/rewards.js';

const base = () => ({ read: {}, unread: {}, problems: {}, last: null, lastAt: 0, days: {} });
// пройти первые n разделов главы: вопрос «Вспомните» решён верно
const passed = (p, id, n) => ({ ...p, problems: { ...p.problems, ...Object.fromEntries(studySections(id).slice(0, n).map((s) => [s.recall, { tries: 1, ok: true, box: null, due: null }])) } });

describe('учебник: прогресс глав', () => {
  const id = 'supply-demand';
  const total = studySections(id).length;
  it('процент главы — по пройденным разделам, задачи в него не входят', () => {
    expect(total).toBeGreaterThan(1);
    expect(chapterShare(base(), id)).toBe(0);
    const half = passed(base(), id, 1);
    expect(chapterShare(half, id)).toBeCloseTo(1 / total, 6);
    // решённая задача главы процент не двигает
    const withTask = { ...half, problems: { ...half.problems, 'sd-p-anything': { tries: 1, ok: true } } };
    expect(chapterShare(withTask, id)).toBeCloseTo(1 / total, 6);
  });
  it('все разделы пройдены — глава прочитана сама, без кнопки; отмеченная вручную — тоже прочитана', () => {
    expect(chapterRead(passed(base(), id, total - 1), id)).toBe(false);
    const all = passed(base(), id, total);
    expect(sectionProgress(all, id)).toEqual({ done: total, total });
    expect(chapterRead(all, id)).toBe(true);
    expect(chapterShare(all, id)).toBe(1);
    expect(chapterRead({ ...base(), read: { [id]: 1 } }, id)).toBe(true);
  });
});

describe('учебник: монеты за задачу', () => {
  it('только верно с первой попытки и без подсмотренного решения — один раз', () => {
    expect(bookFirstTry(undefined, true)).toBe(true);
    expect(bookFirstTry({ tries: 0 }, true)).toBe(true);
    expect(bookFirstTry(undefined, false)).toBe(false);
    expect(bookFirstTry(undefined, true, true)).toBe(false);
    // вторая попытка — уже без монет
    expect(bookFirstTry({ tries: 1, ok: false }, true)).toBe(false);
    expect(bookFirstTry({ tries: 1, ok: true }, true)).toBe(false);
  });
});
