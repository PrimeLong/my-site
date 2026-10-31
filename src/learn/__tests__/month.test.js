// Испытание месяца новичку: цель — пропорционально оставшимся дням; меньше недели до конца месяца —
// первое испытание с 1-го числа следующего (docs/mechanics.md, «Экономика наград»)
import { describe, it, expect } from 'vitest';
import { monthChallenge, fixMonth, settle, FIRST_MIN_DAYS } from '../rewards.js';
import { emptyLearn, finishLesson, setProfile } from '../../textbook/learn-state.js';
import { courseCtx } from '../program.js';
import { monthItems } from '../collections.js';
import { notificationsOf } from '../notify.js';

const at = (day, h = 12) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00Z`);
const newcomer = (day, minutes = 10) => setProfile(emptyLearn(), { minutes }, at(day));
const FLOOR = { minutes: 200, lessons: 18, perfect: 8, xp: 450, days: 15, quests: 8 };

describe('испытание месяца для новичка', () => {
  it('пришёл 29-го (2 дня до конца) — испытания нет, первое — с 1-го числа следующего месяца', () => {
    const s = newcomer('2026-10-30');
    const m = monthChallenge(s, at('2026-10-30'));
    expect(m.daysLeft).toBe(2);
    expect(m.waiting).toBe(true);
    expect(m.startsOn).toBe('2026-11-01');
    expect(m.title).toBe('Первое испытание — с 1 ноября');
    expect(m.target).toBe(0);
    expect(m.done).toBe(false);
    // не закрепляется и не выдаётся
    expect(fixMonth(s, at('2026-10-30'))).toBe(s);
    const played = finishLesson(s, 'sc-i1', { xp: 10, accuracy: 100, now: at('2026-10-30'), seconds: 600 });
    expect(settle(played, courseCtx(played), at('2026-10-30')).gains.map((g) => g.key)).not.toContain('m:2026-10');
    // в альбоме марок нет «текущей» марки этого месяца, напоминаний «испытание: 2 дня» нет
    expect(monthItems(s, at('2026-10-30')).some((x) => x.current)).toBe(false);
    // 1-го числа — обычное испытание за целый месяц
    const nov = monthChallenge(s, at('2026-11-01'));
    expect(nov.waiting).toBeUndefined();
    expect(nov.target).toBeGreaterThanOrEqual(FLOOR[nov.id]);
    expect(nov.daysLeft).toBe(30);
  });
  it(`граница — ${FIRST_MIN_DAYS} дней: с 25-го по 31-е испытание уже есть, с 26-го — ещё нет`, () => {
    expect(FIRST_MIN_DAYS).toBe(7);
    expect(monthChallenge(newcomer('2026-10-25'), at('2026-10-25')).waiting).toBeUndefined();
    expect(monthChallenge(newcomer('2026-10-26'), at('2026-10-26')).waiting).toBe(true);
    // старый ученик (с прошлых месяцев) получает испытание и в последние дни: оно у него с 1-го числа
    const old = newcomer('2026-09-01');
    expect(monthChallenge(old, at('2026-10-30')).waiting).toBeUndefined();
  });
  it('цель — пропорционально оставшимся дням: за неделю посильно при цели дня, без «половины месяца»', () => {
    for (const day of ['2026-10-25', '2026-11-24', '2026-12-25', '2027-01-25', '2027-02-22', '2027-03-25']) {
      const s = newcomer(day);
      const m = monthChallenge(s, at(day));
      expect(m.waiting, day).toBeUndefined();
      expect(m.daysLeft).toBe(7);
      // все дни по цели дня (10 минут) с запасом выполняют испытание: оно не больше, чем 7 дней × цель
      const most = { minutes: 7 * 10, lessons: 7 * 4, perfect: 7 * 4, xp: 7 * 60, days: 7, quests: 7 }[m.id];
      expect(m.target, `${day} ${m.id}`).toBeLessThanOrEqual(most);
      // и не меньше доли месячной планки по оставшимся дням
      const last = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();
      expect(m.target, `${day} ${m.id}`).toBeGreaterThanOrEqual(Math.floor((FLOOR[m.id] * 7) / last));
    }
    // середина месяца: 16 дней из 31 — планка около половины, не «вся месячная»
    const mid = monthChallenge(newcomer('2026-10-16'), at('2026-10-16'));
    expect(mid.target).toBeLessThan(FLOOR[mid.id]);
  });
  it('уведомление «испытание месяца: N дней» новичку без испытания не приходит', () => {
    const s = finishLesson(newcomer('2026-10-30'), 'sc-i1', { xp: 10, accuracy: 100, now: at('2026-10-30'), seconds: 600 });
    expect(notificationsOf(s, at('2026-10-30', 9)).some((n) => n.id.startsWith('month:'))).toBe(false);
  });
});
