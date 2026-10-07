// «Страховка серии» как настоящая страховка: полис, еженедельные взносы, страховой случай, прекращение и расторжение;
// испытание месяца закреплено на весь месяц (docs/mechanics.md)
import { describe, it, expect } from 'vitest';
import { LESSON_BY_ID } from '../course.js';
import { balance, earn, takePolicy, cancelPolicy, chargePremiums, policyInfo, PREMIUM, monthChallenge, fixMonth, settle, hasClaim } from '../rewards.js';
import { emptyLearn, finishLesson, streak, weekDots, normalizeLearn, mergeLearn, policyActive, setProfile } from '../../textbook/learn-state.js';
import { courseCtx } from '../program.js';

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const lessonOn = (s, day) => finishLesson(s, 'sc-i1', { xp: 10, accuracy: 80, now: at(day), seconds: 240, kind: LESSON_BY_ID['sc-i1'].kind });

describe('страховка серии: полис со взносами', () => {
  it('оформить — первый взнос сразу, дальше взнос каждую неделю сам; деньги — из кошелька', () => {
    let s = earn(emptyLearn(), 30, null, at('2026-09-23'));
    const r = takePolicy(s, at('2026-09-23'));
    expect(r.ok).toBe(true);
    s = r.s;
    expect(policyActive(s)).toBe(true);
    expect(balance(s)).toBe(30 - PREMIUM);
    expect(s.premiums).toEqual({ '2026-09-21': PREMIUM });
    // та же неделя — второго взноса нет; следующая — списывается
    expect(chargePremiums(s, at('2026-09-27'))).toBe(s);
    s = chargePremiums(s, at('2026-09-29'));
    expect(s.premiums['2026-09-28']).toBe(PREMIUM);
    expect(balance(s)).toBe(30 - 2 * PREMIUM);
    // оформить второй раз нельзя
    expect(takePolicy(s, at('2026-09-29')).ok).toBe(false);
  });
  it('не хватило монет на взнос — полис прекращается, неделя не покрыта', () => {
    let s = takePolicy(earn(emptyLearn(), PREMIUM + 3, null, at('2026-09-23')), at('2026-09-23')).s;
    s = chargePremiums(s, at('2026-09-30'));
    expect(policyActive(s)).toBe(false);
    expect(s.premiums['2026-09-28']).toBeUndefined();
    expect(policyInfo(s, at('2026-09-30')).lapsed).toBe(true);
    // снова оформить — можно, когда монеты есть
    const again = takePolicy(earn(s, 20, null, at('2026-10-01')), at('2026-10-01'));
    expect(again.ok).toBe(true);
    expect(policyInfo(again.s, at('2026-10-01')).lapsed).toBe(false);
  });
  it('на первый взнос не хватает — полис не оформляется', () => {
    const r = takePolicy(earn(emptyLearn(), PREMIUM - 1, null, at('2026-09-23')), at('2026-09-23'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/не хватает/);
  });
  it('страховой случай: в оплаченной неделе прощается второй пропуск, третий рвёт серию', () => {
    // неделя 21–27.09: занимался пн, пт, сб, вс; вт и ср пропустил (два пропуска), сегодня пн 28.09
    let s = ['2026-09-21', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].reduce(lessonOn, emptyLearn());
    // без полиса: второй пропуск рвёт серию
    expect(streak(s, at('2026-09-28')).days).toBe(4);
    s = takePolicy(earn(s, 50, null, at('2026-09-21')), at('2026-09-21')).s;
    const st = streak(s, at('2026-09-28'));
    expect(st.days).toBe(5);
    expect(st.insuredDays).toHaveLength(1);
    expect(policyInfo(s, at('2026-09-28')).saved).toBe(1);
    // на экране серии день, спасённый полисом, — со щитом
    expect(weekDots(s, at('2026-09-28')).filter((d) => d.frozen)).toHaveLength(1);
    // третий пропуск в той же неделе — покрытия уже нет
    const three = ['2026-09-21', '2026-09-25', '2026-09-26', '2026-09-27'].reduce(lessonOn, emptyLearn());
    const ins = takePolicy(earn(three, 50, null, at('2026-09-21')), at('2026-09-21')).s;
    expect(streak(ins, at('2026-09-28')).days).toBe(3);
  });
  it('расторгнуть: оплаченная неделя покрыта, новых взносов нет', () => {
    let s = takePolicy(earn(emptyLearn(), 50, null, at('2026-09-22')), at('2026-09-22')).s;
    s = cancelPolicy(s, at('2026-09-23'));
    expect(policyActive(s)).toBe(false);
    expect(chargePremiums(s, at('2026-10-05'))).toBe(s);
    expect(s.premiums['2026-09-21']).toBe(PREMIUM);
    expect(policyInfo(s, at('2026-09-23')).lapsed).toBe(false);
  });
  it('полис и взносы переживают очистку и слияние двух устройств, взнос недели не удваивается', () => {
    const s = takePolicy(earn(emptyLearn(), 50, null, at('2026-09-22')), at('2026-09-22')).s;
    const n = normalizeLearn(s);
    expect(n.policyAt).toBe(s.policyAt);
    expect(n.premiums).toEqual(s.premiums);
    const m = mergeLearn(s, chargePremiums(s, at('2026-09-23')));
    expect(Object.values(m.premiums)).toEqual([PREMIUM]);
    expect(policyActive(m)).toBe(true);
    // расторгли на одном устройстве — расторгнут везде
    expect(policyActive(mergeLearn(s, cancelPolicy(s, at('2026-09-24'))))).toBe(false);
  });
});

describe('испытание месяца — одно на весь месяц', () => {
  it('цель закрепляется при первом показе: сменили цель дня — испытание то же', () => {
    const now = at('2026-10-03');
    let s = setProfile(emptyLearn(), { goal: 'self', minutes: 5 }, now);
    s = fixMonth(s, now);
    const before = monthChallenge(s, now).target;
    const more = setProfile(s, { goal: 'self', minutes: 20 }, at('2026-10-05'));
    expect(monthChallenge(more, at('2026-10-05')).target).toBe(before);
    expect(fixMonth(more, at('2026-10-06'))).toBe(more);
    // в следующем месяце — новое
    expect(monthChallenge(more, at('2026-11-02')).month).toBe('2026-11');
    expect(normalizeLearn(s).monthPlan['2026-10'].target).toBe(before);
  });
  it('марка за месяц получена — до конца месяца испытание выполнено, нового задания нет', () => {
    const now = at('2026-10-20');
    let s = { ...emptyLearn(), claimed: { 'm:2026-10': at('2026-10-15') } };
    s = fixMonth(s, now);
    const m = monthChallenge(s, now);
    expect(m.claimed).toBe(true);
    expect(m.done).toBe(true);
    expect(m.need).toBe(0);
    expect(m.have).toBe(m.target);
    const r = settle(s, courseCtx(s), now);
    expect(r.gains.filter((g) => g.kind === 'month')).toEqual([]);
    expect(hasClaim(r.s, 'm:2026-10')).toBe(true);
  });
});
