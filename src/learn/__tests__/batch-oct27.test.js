/* Выпуск 27 октября. */
import { describe, it, expect } from 'vitest';
import { emptyLearn, markBook, markMet, normalizeLearn, mergeLearn } from '../../textbook/learn-state.js';
import { shelfBooks, bookReadAt } from '../shelf.js';

const T = (iso) => Date.parse(iso);

describe('книжная полка: отметка «прочитано»', () => {
  it('отметка — один раз, с датой; на полке книга помечена прочитанной', () => {
    const s0 = markMet(emptyLearn(), 'people-scarcity');
    const s1 = markBook(s0, 'smith-wealth', T('2026-10-27T10:00:00Z'));
    expect(bookReadAt(s1, 'smith-wealth')).toBe(T('2026-10-27T10:00:00Z'));
    // повторная отметка не сдвигает дату
    expect(markBook(s1, 'smith-wealth', T('2026-10-28T10:00:00Z'))).toBe(s1);
    const smith = shelfBooks(s1).find((b) => b.id === 'smith-wealth');
    expect(smith.open && smith.read).toBe(true);
    expect(shelfBooks(s0).some((b) => b.read)).toBe(false);
  });
  it('переживает сохранение и сливается между устройствами — с более ранней датой', () => {
    const a = markBook(emptyLearn(), 'smith-wealth', T('2026-10-27T10:00:00Z'));
    const b = markBook(markBook(emptyLearn(), 'smith-wealth', T('2026-10-26T09:00:00Z')), 'jevons-coal', T('2026-10-27T11:00:00Z'));
    expect(normalizeLearn(JSON.parse(JSON.stringify(a))).books).toEqual({ 'smith-wealth': T('2026-10-27T10:00:00Z') });
    const m = mergeLearn(normalizeLearn(a), normalizeLearn(b));
    expect(m.books).toEqual({ 'smith-wealth': T('2026-10-26T09:00:00Z'), 'jevons-coal': T('2026-10-27T11:00:00Z') });
  });
});

describe('учебник: редкое «Загляните в учебник»', async () => {
  const { notificationsOf, bookNudge, BOOK_NUDGE_DAYS } = await import('../notify.js');
  const now = T('2026-10-27T17:00:00Z');
  // прошёл два урока «Ограниченности» вчера — сейчас проходит этот юнит
  const learn = { ...emptyLearn(), lessons: { 'sc-i1': { at: now - 86400000, runs: 1, best: 90 }, 'sc-l1': { at: now - 86400000, runs: 1, best: 90 } }, recentAt: now - 86400000 };
  const nudges = (l, t, book) => notificationsOf(l, t, { book }).filter((n) => n.id.startsWith('book-read:'));
  it('глава текущего юнита, ведёт в главу учебника', () => {
    const [n] = nudges(learn, now, { read: {}, days: {} });
    expect(n).toBeTruthy();
    expect(n.go).toBe('book-chapter');
    expect(n.chapter).toBe('scarcity');
    expect(n.text).toContain('«Ограниченность и выбор');
  });
  it('не напоминаем: глава прочитана, учебник открывали недавно, на Пути неделю не занимались, нет прогресса учебника', () => {
    expect(nudges(learn, now, { read: { scarcity: 1 }, days: {} })).toHaveLength(0);
    expect(nudges(learn, now, { read: {}, days: { '2026-10-20': 5 } })).toHaveLength(0);
    expect(nudges(learn, now, { read: {}, days: { '2026-10-10': 5 } })).toHaveLength(1);
    expect(nudges({ ...learn, recentAt: now - 9 * 86400000, lessons: { 'sc-i1': { at: now - 9 * 86400000, runs: 1, best: 90 } } }, now, { read: {}, days: {} })).toHaveLength(0);
    expect(nudges(emptyLearn(), now, { read: {}, days: {} })).toHaveLength(0);
    expect(nudges(learn, now, undefined)).toHaveLength(0);
  });
  it('редко: одно и то же напоминание все дни окна, новое — не раньше чем через BOOK_NUDGE_DAYS дней', () => {
    const ids = new Set();
    for (let d = 0; d < 28; d += 1) {
      const t = now + d * 86400000;
      const l = { ...learn, recentAt: t - 3600000 };
      const n = bookNudge(l, t, { read: {}, days: {} });
      if (n) ids.add(n.slot);
    }
    expect(ids.size).toBeLessThanOrEqual(Math.ceil(28 / BOOK_NUDGE_DAYS) + 1);
  });
});
