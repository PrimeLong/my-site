/* «Чтение»: подборки цитат — у каждой страницы автор, книга и год, контекст и вопрос с одним
   верным ответом; «найдите в цитате» — искомые слова действительно в цитате; прочитанное — одно на
   все устройства, опыт — один раз. */
import { describe, it, expect } from 'vitest';
import { READINGS, READING_BY_UNIT, quoteWords, isRead, readingOpen, shelfOf } from '../reading.js';
import { UNIT_BY_ID, pathState } from '../course.js';
import { emptyLearn, markRead, normalizeLearn, mergeLearn, finishLesson } from '../../textbook/learn-state.js';

const words = (t) => t.split(/\s+/).filter(Boolean).length;

describe('подборки цитат', () => {
  it('у каждой — юнит Пути с уроками, цвет, корешок и 3–4 страницы', () => {
    expect(READINGS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(READINGS.map((r) => r.id)).size).toBe(READINGS.length);
    READINGS.forEach((r) => {
      expect(UNIT_BY_ID[r.unitId] && UNIT_BY_ID[r.unitId].lessons.length, r.id).toBeTruthy();
      expect(r.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(r.spine.length, r.id).toBeLessThanOrEqual(10);
      expect(r.pages.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.pages.length, r.id).toBeLessThanOrEqual(4);
    });
    expect(Object.keys(READING_BY_UNIT)).toHaveLength(READINGS.length);
  });
  it('страница: автор и годы, книга и год, короткий контекст, вопрос', () => {
    READINGS.flatMap((r) => r.pages.map((p, k) => [`${r.id}/${k + 1}`, p])).forEach(([id, p]) => {
      expect(p.author, id).toMatch(/^[А-ЯЁ][а-яё]+ /);
      expect(p.years, id).toMatch(/\d{4}/);
      expect(p.year, id).toBeGreaterThan(1700);
      expect(p.year, id).toBeLessThan(2000);
      expect(p.book.length, id).toBeGreaterThan(5);
      expect(p.initials, id).toMatch(/^[А-ЯЁ]{2}$/);
      expect(words(p.quote), id).toBeLessThanOrEqual(45);
      expect(words(p.context), id).toBeLessThanOrEqual(45);
      expect(words(p.ask.explain), id).toBeLessThanOrEqual(50);
      expect(['choice', 'mark'], id).toContain(p.ask.kind);
    });
  });
  it('выбор: один верный, у неверных — почему; верный не длиннее неверных больше чем на четверть', () => {
    READINGS.flatMap((r) => r.pages).filter((p) => p.ask.kind === 'choice').forEach((p) => {
      const ok = p.ask.options.filter((o) => o.ok);
      expect(ok, p.ask.prompt).toHaveLength(1);
      p.ask.options.filter((o) => !o.ok).forEach((o) => expect(o.why, o.text).toBeTruthy());
      const right = ok[0].text.length; const wrong = Math.max(...p.ask.options.filter((o) => !o.ok).map((o) => o.text.length));
      expect(right, p.ask.prompt).toBeLessThanOrEqual(wrong * 1.25 + 3);
    });
  });
  it('«найдите в цитате»: искомые слова есть в цитате, нажатие на любое из них — верно', () => {
    const marks = READINGS.flatMap((r) => r.pages).filter((p) => p.ask.kind === 'mark');
    expect(marks.length).toBeGreaterThanOrEqual(4);
    marks.forEach((p) => {
      expect(p.quote, p.ask.mark).toContain(p.ask.mark);
      const ws = quoteWords(p.quote, p.ask.mark);
      expect(ws.filter((w) => w.hit).map((w) => w.w).join(' ').replace(/[.,;:]$/, '')).toBe(p.ask.mark);
      expect(ws.map((w) => w.w).join(' ')).toBe(p.quote.split(/\s+/).join(' '));
    });
  });
});

describe('прочитанное', () => {
  it('открывается после первого урока юнита', () => {
    const unit = (learn) => pathState(learn).find((s) => s.course.id === 'scarcity');
    expect(readingOpen(unit(emptyLearn()))).toBe(false);
    const s = finishLesson(emptyLearn(), 'sc-i1', { xp: 10, accuracy: 90, now: 1e12 });
    expect(readingOpen(unit(s))).toBe(true);
  });
  it('markRead — один раз; при слиянии устройств — более раннее время; на полке — прочитанные', () => {
    let s = markRead(emptyLearn(), 'read-choice', 5000);
    expect(isRead(s, 'read-choice')).toBe(true);
    expect(markRead(s, 'read-choice', 9000)).toBe(s);
    const other = markRead(markRead(emptyLearn(), 'read-choice', 3000), 'read-hand', 4000);
    s = mergeLearn(normalizeLearn(s), normalizeLearn(other));
    expect(s.read).toEqual({ 'read-choice': 3000, 'read-hand': 4000 });
    expect(shelfOf(s).filter((b) => b.done).map((b) => b.id)).toEqual(['read-choice', 'read-hand']);
  });
});
