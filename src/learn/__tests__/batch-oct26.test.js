/* Выпуск 26 октября. */
import { describe, it, expect, afterEach } from 'vitest';
import { emptyLearn, finishLesson } from '../../textbook/learn-state.js';
import { ACHIEVEMENTS } from '../rewards.js';

const got = (s, id) => !!ACHIEVEMENTS.find((a) => a.id === id).test(s);

const T = (iso) => Date.parse(iso);

describe('«Ранняя пташка» и «Сова» — по часам устройства', () => {
  const tz = process.env.TZ;
  afterEach(() => { process.env.TZ = tz; });
  it('в Москве урок в 23:30 — «Сова», хотя по UTC это 20:30; в 07:00 — «Ранняя пташка», по UTC 04:00', () => {
    process.env.TZ = 'Europe/Moscow';
    const owl = finishLesson(emptyLearn(), 'sc-i1', { xp: 10, accuracy: 90, now: T('2026-10-25T20:30:00Z') });
    expect(got(owl, 'owl')).toBe(true);
    expect(got(owl, 'early')).toBe(false);
    const early = finishLesson(emptyLearn(), 'sc-i1', { xp: 10, accuracy: 90, now: T('2026-10-26T04:00:00Z') });
    expect(got(early, 'early')).toBe(true);
    // в Лос-Анджелесе то же мгновение 20:30 UTC — 13:30: ни то, ни другое
    process.env.TZ = 'America/Los_Angeles';
    const day = finishLesson(emptyLearn(), 'sc-i1', { xp: 10, accuracy: 90, now: T('2026-10-25T20:30:00Z') });
    expect([got(day, 'owl'), got(day, 'early')]).toEqual([false, false]);
  });
});

describe('лента новостей — по времени внутри дня', () => {
  it('печать друга час назад стоит над утренним выпуском; утренняя печать — под ним', async () => {
    const { feedDays, issueAt, freshFriendEvents } = await import('../news.js');
    const news = [{ id: 'x', date: '2026-10-25' }];
    const evs = [
      { login: 'alina', name: 'Алина', k: 'seal', id: 'early', at: T('2026-10-25T22:00:00Z') },
      { login: 'boris', name: 'Борис', k: 'streak', n: 5, at: T('2026-10-25T06:00:00Z') },
    ];
    const [d] = feedDays(news, evs);
    expect(d.items.map((it) => (it.type === 'issue' ? it.n.id : it.p.login))).toEqual(['alina', 'x', 'boris']);
    expect(issueAt(news[0])).toBe(T('2026-10-25T09:00:00Z'));
    expect(issueAt({ date: '2026-10-25', at: '2026-10-25T11:25:00Z' })).toBe(T('2026-10-25T11:25:00Z'));
    // новое от друзей — то, что позже прошлого открытия ленты
    expect(freshFriendEvents(evs, T('2026-10-25T12:00:00Z')).map((e) => e.login)).toEqual(['alina']);
  });
});

describe('время по Гринвичу — с местным временем начала дня', () => {
  const tz = process.env.TZ;
  afterEach(() => { process.env.TZ = tz; });
  it('в Москве новый день — в 03:00, в Лондоне зимой — в 00:00', async () => {
    const { rolloverLocal } = await import('../../textbook/learn-state.js');
    process.env.TZ = 'Europe/Moscow';
    expect(rolloverLocal(T('2026-10-25T12:00:00Z'))).toBe('03:00');
    process.env.TZ = 'Europe/London';
    expect(rolloverLocal(T('2026-11-25T12:00:00Z'))).toBe('00:00');
  });
});

describe('уровень в курсе — шкала A1…C2 в условных единицах', async () => {
  const { courseLevel, BANDS, LEVEL_POINTS, SCALE_MAX, bandOf, lessonQuality, unitPoints } = await import('../grade.js');
  const { UNITS } = await import('../course.js');
  const { LEVELS, UNIT_LEVEL } = await import('../../textbook/levels.js');
  const doneAll = (ids, best = 100) => Object.fromEntries(ids.map((id) => [id, { at: T('2026-10-20T10:00:00Z'), runs: 1, best }]));
  const ids = (level) => UNITS.filter((u) => u.level === level).flatMap((u) => u.lessons.map((l) => l.id));
  it('весь курс — 1000 ед.: уровни 100/200/250/250/200, ступени по порядку с A1 с нуля; порог — 85% уровней до него', () => {
    const cum = [0, 100, 300, 550, 800, 1000];
    BANDS.slice(1).forEach((b, k) => expect(b.from).toBe(Math.round(cum[k + 1] * 0.85 / 5) * 5));
    expect(Object.values(LEVEL_POINTS).reduce((a, b) => a + b, 0)).toBe(SCALE_MAX);
    expect(LEVELS.map((l) => l.id)).toEqual(Object.keys(LEVEL_POINTS));
    expect(BANDS.map((b) => b.id)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(BANDS[0].from).toBe(0);
    BANDS.slice(1).forEach((b, k) => expect(b.from).toBeGreaterThan(BANDS[k].from));
    // юниты уровня, и будущие, делят его единицы поровну
    Object.keys(LEVEL_POINTS).forEach((lv) => {
      const sum = Object.keys(UNIT_LEVEL).filter((u) => UNIT_LEVEL[u] === lv).reduce((a, u) => a + unitPoints(u), 0);
      expect(sum).toBeCloseTo(LEVEL_POINTS[lv]);
    });
  });
  it('без уроков — A1, 0 ед.; Начальный пройден на 100% — A2 и ровно 100 ед.; на 50% точности — всё равно A2', () => {
    expect(courseLevel(emptyLearn())).toMatchObject({ points: 0, band: { id: 'A1' }, next: { id: 'A2' }, toNext: 85 });
    const start = { ...emptyLearn(), lessons: doneAll(ids('start')) };
    expect(courseLevel(start)).toMatchObject({ points: 100, band: { id: 'A2' } });
    const sloppy = { ...emptyLearn(), lessons: doneAll(ids('start'), 50) };
    expect(courseLevel(sloppy).band.id).toBe('A2');
    expect(courseLevel(sloppy).points).toBe(Math.round(100 * lessonQuality(50)));
  });
  it('Базовый пройден — B1; доля урока: 70% за прохождение и до 30% за точность; алмаз — полная', () => {
    const basic = { ...emptyLearn(), lessons: doneAll([...ids('start'), ...ids('basic')]) };
    const c = courseLevel(basic);
    expect(c.points).toBe(300);
    expect(c.band.id).toBe('B1');
    expect(c.toNext).toBe(170);
    expect(lessonQuality(0)).toBe(0.7);
    expect(lessonQuality(100)).toBe(1);
    expect(lessonQuality(50, true)).toBe(1);
    expect(bandOf(849).id).toBe('C1');
    expect(bandOf(850).id).toBe('C2');
  });
  it('юнит, сданный тестом без уроков, — 85% его единиц', () => {
    const tested = { ...emptyLearn(), units: { scarcity: { tested: T('2026-10-20T10:00:00Z') } } };
    expect(courseLevel(tested).points).toBe(Math.round(unitPoints('scarcity') * 0.85));
  });
});

describe('итоги лиги — церемония', () => {
  it('неделя кончилась — момент lg:<неделя> со временем конца недели; свежий — в очереди сцен, раз показанный — нет', async () => {
    const { momentsOf, pendingMoments, leagueEnd } = await import('../celebrate.js');
    const learn = { ...emptyLearn(), lessons: { 'sc-i1': { at: T('2026-10-12T08:00:00Z'), runs: 1, best: 90 } }, xp: { '2026-10-12': 200, '2026-10-13': 150 } };
    const now = T('2026-10-19T10:00:00Z');
    const lg = momentsOf(learn, now).filter((m) => m.kind === 'league');
    expect(lg.map((m) => m.key)).toEqual(['lg:2026-10-12']);
    expect(lg[0].at).toBe(leagueEnd('2026-10-12'));
    expect(lg[0].at).toBe(T('2026-10-18T00:00:00Z'));
    expect(lg[0].it).toMatchObject({ week: '2026-10-12', league: 'bronze' });
    expect(pendingMoments(learn, {}, now).map((m) => m.key)).toContain('lg:2026-10-12');
    expect(pendingMoments(learn, { 'lg:2026-10-12': now }, now).map((m) => m.key)).not.toContain('lg:2026-10-12');
    // через неделю — уже не новость
    expect(pendingMoments(learn, {}, T('2026-10-25T10:00:00Z')).map((m) => m.key)).not.toContain('lg:2026-10-12');
    // идущая неделя — не итог
    expect(momentsOf(learn, T('2026-10-14T10:00:00Z')).filter((m) => m.kind === 'league')).toEqual([]);
  });
});
