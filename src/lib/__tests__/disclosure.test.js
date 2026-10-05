import { describe, it, expect, beforeEach } from 'vitest';
import { advancedOpen, readLearnLevel, writeLearnLevel, ADVANCED_QUARTER, ADVANCED_LEVEL, ADVANCED_TABS, ADVANCED_ROWS, ADVANCED_CHAPTERS } from '../disclosure.js';
import { LEVELS } from '../../learn/course.js';
import { INDICATOR_TABS } from '../../game.jsx';
import { LEVER_BOOK } from '../booklinks.js';

/* Прогрессивное раскрытие первого экрана партии (docs/mechanics.md, «Первый экран партии»). */
describe('прогрессивное раскрытие', () => {
  // тесты идут в Node: хранилище браузера — простая подмена
  beforeEach(() => { const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; });
  it('открыто с 4-го квартала или с уровня «Средний» на Пути', () => {
    expect(ADVANCED_QUARTER).toBe(4);
    expect(LEVELS[ADVANCED_LEVEL].title).toBe('Средний');
    [1, 2, 3].forEach((q) => expect(advancedOpen({ quarterIndex: q, level: 0 })).toBe(false));
    expect(advancedOpen({ quarterIndex: 3, level: ADVANCED_LEVEL - 1 })).toBe(false);
    expect(advancedOpen({ quarterIndex: 4, level: 0 })).toBe(true);
    expect(advancedOpen({ quarterIndex: 1, level: ADVANCED_LEVEL })).toBe(true);
  });
  it('уровень Пути живёт в хранилище; без записи — Начальный', () => {
    expect(readLearnLevel()).toBe(0);
    writeLearnLevel(2);
    expect(readLearnLevel()).toBe(2);
    // уровень не снижается: вернулись к юниту пониже — «Средний» уже достигнут
    writeLearnLevel(0);
    expect(readLearnLevel()).toBe(2);
  });
  it('то, что прячется, существует: вкладка рисков, строка Тейлора, ссылка на IS-LM у ставки', () => {
    ADVANCED_TABS.forEach((id) => expect(INDICATOR_TABS.some((t) => t.id === id), id).toBe(true));
    ADVANCED_ROWS.forEach((key) => expect(INDICATOR_TABS.some((t) => t.rows.some((r) => r.key === key)), key).toBe(true));
    ADVANCED_CHAPTERS.forEach((ch) => expect(LEVER_BOOK.keyRate.some((to) => to.chapter === ch), ch).toBe(true));
  });
});
