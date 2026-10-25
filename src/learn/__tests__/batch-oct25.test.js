/* Выпуск 25 октября: уведомления о забеге, показанное на всех устройствах, оценка в курсе,
   уведомление о нике и лига только после первого урока. */
import { describe, it, expect } from 'vitest';
import { notificationsOf } from '../notify.js';
import { emptyLearn, markShown, shownWith, normalizeLearn, mergeLearn, SHOWN_MAX, finishLesson } from '../../textbook/learn-state.js';
import { courseGrade, gradeOf, gradeWord } from '../grade.js';
import { leagueState, leagueStart, firstLessonDay } from '../league.js';

const T = (iso) => Date.parse(iso);
const ids = (list, prefix) => list.filter((n) => n.id.startsWith(prefix)).map((n) => n.id);

describe('уведомления о забеге', () => {
  const friend = { login: 'alina', name: 'Алина', card: { xpDays: { '2026-10-20': 60, '2026-10-21': 30 } } };
  const race = { id: 'r1', other: 'alina', mine: true, status: 'active', start: '2026-10-20', days: 3, at: T('2026-10-19T10:00:00Z'), acceptedAt: T('2026-10-20T08:00:00Z') };
  const learnWith = (xp) => ({ ...emptyLearn(), xp });

  it('друг впереди — раз в день «впереди в забеге» с разницей; вы впереди — «Вы впереди»', () => {
    const now = T('2026-10-21T15:00:00Z');
    const behind = notificationsOf(learnWith({ '2026-10-20': 20 }), now, { friends: { friends: [friend], races: [race] } });
    expect(ids(behind, 'race-behind:')).toEqual(['race-behind:r1:2026-10-21']);
    expect(behind.find((n) => n.id.startsWith('race-behind:')).text).toContain('90 опыта против ваших 20');
    const ahead = notificationsOf(learnWith({ '2026-10-20': 80, '2026-10-21': 40 }), now, { friends: { friends: [friend], races: [race] } });
    expect(ids(ahead, 'race-ahead:')).toEqual(['race-ahead:r1:2026-10-21']);
    expect(ids(ahead, 'race-behind:')).toEqual([]);
  });

  it('последний день — отдельное уведомление; отказ и истёкшее приглашение — тоже', () => {
    const last = notificationsOf(learnWith({ '2026-10-20': 20 }), T('2026-10-22T10:00:00Z'), { friends: { friends: [friend], races: [race] } });
    expect(ids(last, 'race-last:')).toEqual(['race-last:r1']);
    expect(last.find((n) => n.id === 'race-last:r1').text).toContain('Алина впереди на 70 опыта');
    const declined = { ...race, status: 'declined', answeredAt: T('2026-10-19T12:00:00Z') };
    const no = notificationsOf(emptyLearn(), T('2026-10-19T13:00:00Z'), { friends: { friends: [friend], races: [declined] } });
    expect(no.find((n) => n.id === 'race-no:r1')).toMatchObject({ title: 'Забег отклонён', text: expect.stringContaining('Алина: пока без забега') });
    // через три дня — уже не новость
    expect(ids(notificationsOf(emptyLearn(), T('2026-10-23T13:00:00Z'), { friends: { friends: [friend], races: [declined] } }), 'race-no:')).toEqual([]);
    // чужое приглашение, на которое отказали вы, — без уведомления
    expect(ids(notificationsOf(emptyLearn(), T('2026-10-19T13:00:00Z'), { friends: { friends: [friend], races: [{ ...declined, mine: false }] } }), 'race-no:')).toEqual([]);
  });
});

describe('показанное — общее для всех устройств', () => {
  it('markShown добавляет только новые ключи и не меняет состояние, если всё уже показано', () => {
    const s = markShown(emptyLearn(), ['c:stamp-1', 'n:goal:2026-10-25'], 1000);
    expect(shownWith(s, 'c:')).toEqual({ 'stamp-1': 1000 });
    expect(shownWith(s, 'n:')).toEqual({ 'goal:2026-10-25': 1000 });
    expect(markShown(s, ['c:stamp-1'], 2000)).toBe(s);
  });
  it('слияние двух устройств — объединение, время — более раннее; храним не больше SHOWN_MAX', () => {
    const pc = markShown(emptyLearn(), ['c:unit-sd', 't:lg-down:1'], 5000);
    const phone = markShown(emptyLearn(), ['c:unit-sd', 'm:2026-10-25'], 3000);
    const both = mergeLearn(normalizeLearn(pc), normalizeLearn(phone));
    expect(both.shown).toEqual({ 'c:unit-sd': 3000, 't:lg-down:1': 5000, 'm:2026-10-25': 3000 });
    const many = { ...emptyLearn(), shown: Object.fromEntries(Array.from({ length: SHOWN_MAX + 50 }, (_, k) => [`n:x${k}`, 1000 + k])) };
    const kept = normalizeLearn(many).shown;
    expect(Object.keys(kept)).toHaveLength(SHOWN_MAX);
    // уходят самые старые
    expect(kept['n:x0']).toBeUndefined();
    expect(kept[`n:x${SHOWN_MAX + 49}`]).toBe(1000 + SHOWN_MAX + 49);
  });
});

describe('оценка в курсе экономики', () => {
  it('2–5 с десятыми по точности; без уроков оценки нет', () => {
    expect(gradeOf(100)).toBe(5); expect(gradeOf(95)).toBe(5); expect(gradeOf(80)).toBe(4); expect(gradeOf(65)).toBe(3); expect(gradeOf(40)).toBe(2);
    expect(gradeOf(90)).toBe(4.7);
    expect(gradeWord(4.7)).toBe('отлично'); expect(gradeWord(3.6)).toBe('хорошо'); expect(gradeWord(2.9)).toBe('удовлетворительно');
    expect(courseGrade(emptyLearn())).toMatchObject({ grade: null, done: 0 });
  });
  it('точность — лучшая по уроку; алмазный урок — 100%; полоска — доля пройденных уроков', () => {
    let s = finishLesson(emptyLearn(), 'sc-i1', { xp: 10, accuracy: 70, now: T('2026-10-20T10:00:00Z') });
    s = finishLesson(s, 'sc-i1', { xp: 1, accuracy: 90, now: T('2026-10-21T10:00:00Z') });
    s = finishLesson(s, 'sc-l1', { xp: 10, accuracy: 85, now: T('2026-10-21T11:00:00Z'), diamond: true });
    const g = courseGrade(s);
    expect(g.done).toBe(2);
    expect(g.diamonds).toBe(1);
    expect(g.accuracy).toBe(95);
    expect(g.grade).toBe(5);
    expect(g.share).toBeCloseTo(2 / g.total);
  });
});

describe('ник под запретом — уведомление', () => {
  it('«Смените ник» с датой; нет срока — нет уведомления; отключить в настройках нельзя', () => {
    const by = T('2026-11-01T12:00:00Z');
    const list = notificationsOf(emptyLearn(), T('2026-10-25T12:00:00Z'), { account: { renameBy: by, name: 'Грубиян' }, prefs: { friends: false, news: false, streak: false, league: false, garden: false, path: false } });
    const n = list.find((x) => x.id === `rename:${by}`);
    expect(n.title).toBe('Смените ник');
    expect(n.text).toContain('«Грубиян»');
    expect(n.text).toContain('1 ноября');
    expect(n.go).toBe('rename');
    expect(ids(notificationsOf(emptyLearn(), T('2026-10-25T12:00:00Z'), { account: null }), 'rename:')).toEqual([]);
  });
});

describe('лига — после первого урока', () => {
  it('без уроков лиги нет; первый урок открывает её с ближайшего понедельника', () => {
    const fresh = { ...emptyLearn(), profile: { ...emptyLearn().profile, at: T('2026-10-27T10:00:00Z') } };
    expect(firstLessonDay(fresh)).toBe(null);
    expect(leagueStart(fresh)).toBe(null);
    expect(leagueState(fresh, T('2026-10-28T10:00:00Z')).noLesson).toBe(true);
    const s = finishLesson(fresh, 'sc-i1', { xp: 10, accuracy: 90, now: T('2026-10-28T10:00:00Z') });
    expect(firstLessonDay(s)).toBe('2026-10-28');
    // среда — в идущую неделю не попадает: со следующего понедельника
    expect(leagueStart(s)).toBe('2026-11-02');
    expect(leagueState(s, T('2026-10-28T12:00:00Z')).noLesson).toBe(false);
  });
});
