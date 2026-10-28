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

describe('уровень в курсе — число условных единиц из 1000, без ступеней', async () => {
  const grade = await import('../grade.js');
  const { courseLevel, LEVEL_POINTS, LEVEL_FROM, SCALE_MAX, lessonQuality, unitPoints } = grade;
  const { UNITS } = await import('../course.js');
  const { LEVELS, UNIT_LEVEL } = await import('../../textbook/levels.js');
  const doneAll = (ids, best = 100) => Object.fromEntries(ids.map((id) => [id, { at: T('2026-10-20T10:00:00Z'), runs: 1, best }]));
  const ids = (level) => UNITS.filter((u) => u.level === level).flatMap((u) => u.lessons.map((l) => l.id));
  it('весь курс — 1000 ед.: уровни 100/200/250/250/200 подряд на шкале; ступеней A1…C2 больше нет', () => {
    expect(Object.values(LEVEL_POINTS).reduce((a, b) => a + b, 0)).toBe(SCALE_MAX);
    expect(LEVELS.map((l) => l.id)).toEqual(Object.keys(LEVEL_POINTS));
    expect(LEVEL_FROM).toEqual({ start: 0, basic: 100, middle: 300, advanced: 550, pro: 800 });
    expect(grade.BANDS).toBeUndefined();
    expect(grade.bandOf).toBeUndefined();
    // юниты уровня, и будущие, делят его единицы поровну
    Object.keys(LEVEL_POINTS).forEach((lv) => {
      const sum = Object.keys(UNIT_LEVEL).filter((u) => UNIT_LEVEL[u] === lv).reduce((a, u) => a + unitPoints(u), 0);
      expect(sum).toBeCloseTo(LEVEL_POINTS[lv]);
    });
  });
  // Начальный уровень — «Мастерская» и будущий «Рынок труда»: вышедшая «Мастерская» весит половину уровня
  const startOpen = unitPoints('scarcity');
  it('без уроков — 0 ед., уровень курса «Начальный» 0 из 100; всё вышедшее в Начальном пройдено на 100% — дальше Базовый', () => {
    const none = courseLevel(emptyLearn());
    expect(none).toMatchObject({ points: 0, past: [], level: { id: 'start', got: 0, max: 100 } });
    expect(none.band).toBeUndefined();
    expect(startOpen).toBe(50);
    const start = { ...emptyLearn(), lessons: doneAll(ids('start')) };
    // уровень не застревает в ожидании будущего юнита: Начальный — пройден, дальше Базовый
    expect(courseLevel(start)).toMatchObject({ points: startOpen, past: ['start'], level: { id: 'basic', got: 0, max: 200 } });
    const sloppy = { ...emptyLearn(), lessons: doneAll(ids('start'), 50) };
    expect(Math.abs(courseLevel(sloppy).points - startOpen * lessonQuality(50))).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(courseLevel(sloppy).level.id).toBe('start');
  });
  it('Базовый пройден — Начальный и Базовый позади; доля урока: 70% за прохождение и до 30% за точность; алмаз — полная', () => {
    const basic = { ...emptyLearn(), lessons: doneAll([...ids('start'), ...ids('basic')]) };
    const c = courseLevel(basic);
    expect(c.points).toBe(startOpen + 200);
    expect(c.byLevel).toMatchObject({ start: startOpen, basic: 200 });
    expect(c.past).toEqual(['start', 'basic']);
    expect(c.level.id).toBe('middle');
    expect(lessonQuality(0)).toBe(0.7);
    expect(lessonQuality(100)).toBe(1);
    expect(lessonQuality(50, true)).toBe(1);
  });
  it('юнит, сданный тестом без уроков, — 85% его единиц', () => {
    const tested = { ...emptyLearn(), units: { scarcity: { tested: T('2026-10-20T10:00:00Z') } } };
    expect(Math.abs(courseLevel(tested).points - unitPoints('scarcity') * 0.85)).toBeLessThanOrEqual(0.5 + 1e-9);
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

const wordsOf = (t) => t.split(/\s+/).filter(Boolean).length;

describe('«Персоналии» — данные', async () => {
  const { PEOPLE, PERSON_BY_ID, initialsOf, eraPos, galleryOf } = await import('../people.js');
  const { UNIT_BY_ID } = await import('../course.js');
  it('по три человека на каждый готовый юнит; годы, роль, рассказ, идея, факт', () => {
    expect(PEOPLE).toHaveLength(10);
    expect(new Set(PEOPLE.map((g) => g.unitId)).size).toBe(10);
    PEOPLE.forEach((g) => {
      expect(UNIT_BY_ID[g.unitId] && UNIT_BY_ID[g.unitId].lessons.length, g.id).toBeTruthy();
      expect(g.people, g.id).toHaveLength(3);
      expect(g.color).toMatch(/^#[0-9A-F]{6}$/i);
    });
    const all = PEOPLE.flatMap((g) => g.people);
    expect(Object.keys(PERSON_BY_ID)).toHaveLength(all.length);
    all.forEach((p) => {
      expect(p.years, p.id).toBe(`${p.born}–${p.died}`);
      expect(p.born, p.id).toBeLessThan(p.died);
      expect(p.mark, p.id).toBeGreaterThanOrEqual(p.born + 15);
      expect(p.mark, p.id).toBeLessThanOrEqual(p.died);
      expect(p.wiki, p.id).toMatch(/^[A-Za-z_.,()-]+$/);
      expect(p.story, p.id).toHaveLength(2);
      p.story.forEach((t) => expect(wordsOf(t), p.id).toBeLessThanOrEqual(45));
      expect(wordsOf(p.idea), p.id).toBeLessThanOrEqual(16);
      expect(wordsOf(p.fact), p.id).toBeLessThanOrEqual(40);
      expect(eraPos(p.born)).toBeGreaterThan(0);
      expect(eraPos(p.died)).toBeLessThan(1);
    });
  });
  it('вопрос: один верный, у неверных — почему; верный не длиннее неверных больше чем на четверть', () => {
    PEOPLE.flatMap((g) => g.people).forEach((p) => {
      const ok = p.ask.options.filter((o) => o.ok);
      expect(ok, p.id).toHaveLength(1);
      p.ask.options.filter((o) => !o.ok).forEach((o) => expect(o.why, `${p.id}: ${o.text}`).toBeTruthy());
      const wrong = Math.max(...p.ask.options.filter((o) => !o.ok).map((o) => o.text.length));
      expect(ok[0].text.length, p.id).toBeLessThanOrEqual(wrong * 1.25 + 3);
    });
  });
  it('инициалы для медальона и галерея профиля', () => {
    expect(initialsOf('Джон Д. Рокфеллер')).toBe('ДР');
    expect(initialsOf('Адам Смит')).toBe('АС');
    expect(initialsOf('Антуан Огюстен Курно')).toBe('АК');
    const g = galleryOf({ met: { 'people-market': 1 } });
    expect(g).toHaveLength(30);
    expect(g.filter((p) => p.met).map((p) => p.id)).toEqual(['smith', 'jenkin', 'marshall']);
  });
});

describe('книжная полка', async () => {
  const { BOOKS, bookOpen, shelfBooks } = await import('../shelf.js');
  const { UNIT_BY_ID } = await import('../course.js');
  const { markRead, markMet } = await import('../../textbook/learn-state.js');
  it('только тексты в общественном достоянии (не позже 1923 года); у каждого отрывка — откуда и «Подумайте»', () => {
    expect(BOOKS.length).toBeGreaterThanOrEqual(8);
    BOOKS.forEach((b) => {
      expect(b.year, b.id).toBeLessThanOrEqual(1923);
      expect(UNIT_BY_ID[b.unitId], b.id).toBeTruthy();
      b.passages.forEach((p) => {
        expect(p.text.length, `${b.id}/${p.id}`).toBeGreaterThan(0);
        expect(p.where, `${b.id}/${p.id}`).toBeTruthy();
        expect(p.think, `${b.id}/${p.id}`).toMatch(/[?.]$/);
      });
    });
  });
  it('книга открывается «Чтением» или «Персоналиями» своего юнита', () => {
    const smith = BOOKS.find((b) => b.id === 'smith-wealth');
    expect(bookOpen(emptyLearn(), smith)).toBe(false);
    expect(bookOpen(markRead(emptyLearn(), 'read-choice'), smith)).toBe(true);
    expect(bookOpen(markMet(emptyLearn(), 'people-scarcity'), smith)).toBe(true);
    expect(shelfBooks(markMet(emptyLearn(), 'people-consumer')).filter((b) => b.open).map((b) => b.id)).toEqual(['jevons-coal']);
  });
});

describe('остановки дороги юнита', async () => {
  const { unitStops } = await import('../stops.js');
  const { pathState, UNIT_BY_ID } = await import('../course.js');
  const { markRead } = await import('../../textbook/learn-state.js');
  const ids = UNIT_BY_ID.scarcity.lessons.map((l) => l.id);
  const doneFirst = (n) => ({ ...emptyLearn(), lessons: Object.fromEntries(ids.slice(0, n).map((id) => [id, { at: T('2026-10-20T10:00:00Z'), runs: 1, best: 90 }])) });
  const stopsOf = (learn) => unitStops(pathState(learn).find((s) => s.course.id === 'scarcity'), learn);
  it('«Персоналии» — после второго урока, «Чтение» — на середине; открываются, когда пройден урок перед ними', () => {
    const s0 = stopsOf(emptyLearn());
    // в «Мастерской» 14 уроков: «Персоналии» — после 2-го, «Разбор графика» — сразу после 4-го, где КПВ появляется (выпуск 28 октября), «Чтение» — после 8-го
    expect(s0.map((x) => x.type)).toEqual(['lesson', 'lesson', 'people', 'lesson', 'lesson', 'graph', 'lesson', 'lesson', 'lesson', 'lesson', 'read', ...Array(6).fill('lesson')]);
    expect(s0.find((x) => x.type === 'people')).toMatchObject({ id: 'people-scarcity', open: false, done: false });
    const s2 = stopsOf(doneFirst(2));
    expect(s2.find((x) => x.type === 'people').open).toBe(true);
    expect(s2.find((x) => x.type === 'read').open).toBe(false);
    expect(stopsOf(markRead(doneFirst(8), 'read-choice')).find((x) => x.type === 'read')).toMatchObject({ open: true, done: true });
  });
});

describe('«Работа над ошибками»', async () => {
  const { pathState, UNIT_BY_ID, canPractice, FIX_MIN, fixIds, buildFix } = await import('../course.js');
  const { markFixed, addMistake } = await import('../../textbook/learn-state.js');
  const { unitStops } = await import('../stops.js');
  const lessonIds = (u) => UNIT_BY_ID[u].lessons.map((l) => l.id);
  const exIds = (u) => UNIT_BY_ID[u].lessons.flatMap((l) => l.exercises.map((e) => e.id)).filter(canPractice);
  const learner = (doneN, mistakes, unit = 'scarcity') => {
    let s = { ...emptyLearn(), lessons: Object.fromEntries(lessonIds('scarcity').slice(0, doneN).map((id) => [id, { at: T('2026-10-20T10:00:00Z'), runs: 1, best: 70 }])) };
    exIds(unit).slice(0, mistakes).forEach((id, k) => { s = addMistake(s, id, T('2026-10-20T10:00:00Z') + k); });
    return s;
  };
  const sc = (learn) => pathState(learn).find((s) => s.course.id === 'scarcity');
  it(`${FIX_MIN} ошибок юнита — перед следующим уроком встаёт обязательный урок, следующий урок закрыт`, () => {
    expect(sc(learner(3, FIX_MIN - 1)).fix).toBe(null);
    const s = learner(3, FIX_MIN);
    const st = sc(s);
    expect(st.fix).toMatchObject({ unitId: 'scarcity', at: 3, count: FIX_MIN });
    expect(st.lessons[3]).toMatchObject({ open: false, fixLock: true });
    expect(st.lessons[4].open).toBe(false);
    const stops = unitStops(st, s);
    expect(stops.findIndex((x) => x.type === 'fix')).toBe(stops.findIndex((x) => x.id === st.lessons[3].id) - 1);
    // урок — из ошибок этого юнита
    const items = buildFix(s, 'scarcity', () => 0.3).items;
    expect(items.length).toBeGreaterThanOrEqual(FIX_MIN);
    expect(fixIds(s, 'scarcity')).toHaveLength(FIX_MIN);
  });
  it('пройдена — Путь открыт, и второй раз в этом юните она не встанет; ошибки другого юнита не в счёт', () => {
    const s = markFixed(learner(3, FIX_MIN), 'scarcity', T('2026-10-21T10:00:00Z'));
    expect(sc(s).fix).toBe(null);
    expect(sc(s).lessons[3].open).toBe(true);
    let more = s; exIds('scarcity').slice(FIX_MIN, FIX_MIN * 2).forEach((id) => { more = addMistake(more, id); });
    expect(sc(more).fix).toBe(null);
    expect(sc(learner(3, FIX_MIN, 'supply-demand')).fix).toBe(null);
  });
  it('ошибки набрались в последнем уроке юнита — урок в конце юнита, первый урок следующего закрыт', () => {
    const s = learner(lessonIds('scarcity').length, FIX_MIN);
    const states = pathState(s);
    const st = states.find((x) => x.course.id === 'scarcity');
    expect(st.fix).toMatchObject({ at: st.lessons.length });
    const next = states[states.indexOf(st) + 1];
    expect(next.lessons[0]).toMatchObject({ open: false, fixLock: true });
  });
});

describe('темы урока — в лавке «Для урока»', async () => {
  const { OUTFIT_BY_ID, THEME_ITEMS, WARDROBE, RATE_MAX, courseIncome, shopDay, buy, setWear, themeOf, outfitOf } = await import('../rewards.js');
  const rich = { ...emptyLearn(), coins: { '2026-01-01': 9000 } };
  const now = T('2026-10-25T10:00:00Z');
  it('четыре темы, все дорогие и всё же доступные за курс; ни в гардеробе, ни у ювелира', () => {
    expect(THEME_ITEMS).toEqual(['theme-mint', 'theme-exchange', 'theme-blueprint', 'theme-aurora']);
    THEME_ITEMS.forEach((id) => {
      const o = OUTFIT_BY_ID[id];
      expect(o.slot).toBe('theme');
      expect(o.crowns).toBeGreaterThanOrEqual(1300);
      expect(Math.ceil(o.crowns * RATE_MAX), id).toBeLessThanOrEqual(0.7 * courseIncome().total);
    });
    expect(WARDROBE.some((o) => o.slot === 'theme')).toBe(false);
    const day = shopDay(rich, '2026-10-25');
    expect(day.theme).toEqual(THEME_ITEMS);
    expect(day.rare.some((id) => THEME_ITEMS.includes(id))).toBe(false);
  });
  it('купленная тема сразу включена; выключить и включить другую — одна тема на все уроки; Инфле она не надевается', () => {
    const r = buy(rich, 'theme-aurora', now);
    expect(r.ok).toBe(true);
    expect(themeOf(r.s)).toBe('theme-aurora');
    expect(outfitOf(r.s).theme).toBeUndefined();
    const off = setWear(r.s, 'theme', null, now);
    expect(themeOf(off)).toBe(null);
    // не купленную не включить
    expect(themeOf(setWear(off, 'theme', 'theme-mint', now))).toBe(null);
    const both = buy(off, 'theme-mint', now).s;
    expect(themeOf(both)).toBe('theme-mint');
    expect(themeOf(setWear(both, 'theme', 'theme-aurora', now))).toBe('theme-aurora');
  });
});
