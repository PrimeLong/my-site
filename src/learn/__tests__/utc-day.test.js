/* Один часовой пояс на всё: день, неделя и час дня — по всемирному времени, какой бы пояс ни стоял на
   устройстве (перевод часов не даёт ни лишнего дня серии, ни лишних часов в лиге или забеге). */
import { describe, it, expect, afterEach } from 'vitest';
import { dayOf, addDays, weekOf, dowOf, dayStart, dayHour, dayAt, emptyLearn, finishLesson } from '../../textbook/learn-state.js';
import { dayKey } from '../../textbook/progress.js';
import { journalWeeks } from '../../textbook/check.js';

const TZ = process.env.TZ;
afterEach(() => { if (TZ === undefined) delete process.env.TZ; else process.env.TZ = TZ; });

describe('всемирное время', () => {
  for (const zone of ['UTC', 'Europe/Moscow', 'Asia/Vladivostok', 'America/Los_Angeles']) {
    it(`на устройстве ${zone} — те же дни, неделя и час`, () => {
      process.env.TZ = zone;
      // 25 октября 2026, 22:30 UTC: во Владивостоке уже 26-е, в Лос-Анджелесе ещё 25-е днём
      const t = Date.UTC(2026, 9, 25, 22, 30);
      expect(dayOf(t)).toBe('2026-10-25');
      expect(dayKey(t)).toBe('2026-10-25');
      expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
      expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // перевод часов в Европе — день не теряется
      expect(weekOf('2026-10-25')).toBe('2026-10-19');
      expect(dowOf('2026-10-26')).toBe(0);
      expect(dayStart(t)).toBe(Date.UTC(2026, 9, 25));
      expect(dayHour(t)).toBe(22.5);
      expect(dayAt('2026-10-25', 9)).toBe(Date.UTC(2026, 9, 25, 9));
      expect(journalWeeks({}, t, 1)[0].map((d) => d.key)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    });
  }

  it('урок в 01:00 по Москве засчитывается в предыдущий день — как у всех', () => {
    process.env.TZ = 'Europe/Moscow';
    const t = Date.UTC(2026, 9, 25, 22); // 26 октября, 01:00 по Москве
    const s = finishLesson(emptyLearn(), 'sd-l1', { xp: 15, accuracy: 90, seconds: 200, now: t });
    expect(Object.keys(s.xp)).toEqual(['2026-10-25']);
  });
});
