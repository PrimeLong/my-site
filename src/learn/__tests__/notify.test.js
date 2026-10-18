/* Уведомления и коллекции профиля (docs/mechanics.md, «Новости и уведомления», «Профиль»):
   список выводится из прогресса и времени — пройденное уходит само, одно событие — один id. */
import { describe, it, expect } from 'vitest';
import { notificationsOf, unreadOf, agoText, firstDayOf } from '../notify.js';
import { albumItems, sealItems, monthItems, monthsByYear, shelfOrder, fullDate } from '../collections.js';
import { NEWS, unreadNews, newsDate } from '../news.js';
import { emptyLearn, addDays, dayOf } from '../../textbook/learn-state.js';
import { LESSONS, UNITS } from '../course.js';

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const TODAY = '2026-10-14'; // среда
const done = (ids, ts) => Object.fromEntries(ids.map((id) => [id, { at: ts, runs: 1, best: 90 }]));
const unitIds = (id) => UNITS.find((u) => u.id === id).lessons.map((l) => l.id);
// занимался вчера и позавчера: серия два дня, сегодня ещё не было урока
const learner = (extra = {}) => ({
  ...emptyLearn(), lessons: done([LESSONS[0].id], at(addDays(TODAY, -2))),
  done: { [addDays(TODAY, -2)]: 1, [addDays(TODAY, -1)]: 1 }, xp: { [addDays(TODAY, -2)]: 20, [addDays(TODAY, -1)]: 25 },
  profile: { goal: 'self', minutes: 10, knows: false, at: at(addDays(TODAY, -20)) }, ...extra,
});

describe('уведомления: серия и напоминание', () => {
  it('с выбранного часа, если сегодня ещё не было урока, — «серия ждёт урока»', () => {
    const s = learner();
    expect(notificationsOf(s, at(TODAY, 15), { prefs: { remindAt: 19 } }).some((n) => n.kind === 'streak' && n.id.startsWith('streak:'))).toBe(false);
    const evening = notificationsOf(s, at(TODAY, 20), { prefs: { remindAt: 19 } }).find((n) => n.id === `streak:${TODAY}`);
    expect(evening).toMatchObject({ go: 'path', push: true });
    expect(evening.title).toContain('Серия 2 дня');
    // урок сегодня — напоминания нет
    const today = { ...s, done: { ...s.done, [TODAY]: 1 }, xp: { ...s.xp, [TODAY]: 10 } };
    expect(notificationsOf(today, at(TODAY, 20)).some((n) => n.id.startsWith('streak:'))).toBe(false);
    // выключенный вид не приходит
    expect(notificationsOf(s, at(TODAY, 20), { prefs: { streak: false } }).some((n) => n.kind === 'streak')).toBe(false);
  });
  it('новичок без единого урока не получает напоминаний о серии', () => {
    expect(notificationsOf(emptyLearn(), at(TODAY, 22)).filter((n) => n.kind === 'streak')).toEqual([]);
  });
});

describe('уведомления: Путь, сад, копилка', () => {
  it('пройденный юнит с закрытым сундуком — «Сундук ждёт», открыли — уведомления нет', () => {
    const s = learner({ lessons: done(unitIds('scarcity'), at(addDays(TODAY, -1))) });
    expect(notificationsOf(s, at(TODAY, 10)).find((n) => n.id === 'chest:scarcity')).toMatchObject({ go: 'path', title: 'Сундук «Мастерская» ждёт' });
    const opened = { ...s, claimed: { 'c:scarcity': at(TODAY, 9) } };
    expect(notificationsOf(opened, at(TODAY, 10)).some((n) => n.id === 'chest:scarcity')).toBe(false);
  });
  it('созревшее растение — «Созрело», собрали — ушло', () => {
    const planted = at(TODAY, 6);
    const s = learner({ garden: { [planted]: 'chamomile@0' } });
    expect(notificationsOf(s, at(TODAY, 7)).some((n) => n.id === `ripe:${planted}`)).toBe(false);
    expect(notificationsOf(s, at(TODAY, 9)).find((n) => n.id === `ripe:${planted}`)).toMatchObject({ go: 'garden', toast: true });
    const picked = { ...s, harvest: { [planted]: at(TODAY, 9) } };
    expect(notificationsOf(picked, at(TODAY, 10)).some((n) => n.id === `ripe:${planted}`)).toBe(false);
  });
  it('вклад созрел через неделю — «Вклад созрел»', () => {
    const put = at(addDays(TODAY, -8), 10);
    const s = learner({ coins: { [addDays(TODAY, -9)]: 100 }, piggy: { [put]: 50 } });
    expect(notificationsOf(s, at(TODAY, 11)).find((n) => n.id === `piggy:${put}`)).toMatchObject({ go: 'piggy' });
  });
});

describe('уведомления: лига и новости', () => {
  it('много опыта на неделе — «Вы в зоне повышения», один раз за неделю', () => {
    const s = learner({ xp: { [addDays(TODAY, -2)]: 900 } });
    const list = notificationsOf(s, at(TODAY, 12));
    const up = list.filter((n) => n.id.startsWith('lg-zone-up:'));
    expect(up).toHaveLength(1);
    expect(up[0].go).toBe('league');
  });
  it('новость — только свежий выпуск и только вышедший после первого дня ученика: новичку прошлое обновление не новость', () => {
    const s = learner();
    const news = notificationsOf(s, at(NEWS[0].date, 18), { since: addDays(NEWS[0].date, -1) }).filter((n) => n.kind === 'news');
    expect(news.map((n) => n.id)).toEqual([`news:${NEWS[0].id}`]);
    // пришёл в день выпуска или позже — уведомления нет
    expect(notificationsOf(s, at(NEWS[0].date, 18), { since: NEWS[0].date }).some((n) => n.kind === 'news')).toBe(false);
    expect(notificationsOf(s, at(NEWS[0].date, 18), { since: addDays(NEWS[0].date, 1) }).some((n) => n.kind === 'news')).toBe(false);
    expect(unreadNews({}, NEWS[0].date).map((n) => n.id)).not.toContain(NEWS[0].id);
    expect(unreadNews({}, addDays(NEWS[0].date, -1)).map((n) => n.id)).toContain(NEWS[0].id);
  });
  it('непрочитанные — те, что ещё не открывали; список отсортирован от свежего', () => {
    const s = learner({ lessons: done(unitIds('scarcity'), at(addDays(TODAY, -1))) });
    const list = notificationsOf(s, at(TODAY, 20));
    expect(list.map((n) => n.at)).toEqual(list.map((n) => n.at).sort((a, b) => b - a));
    const seen = { [list[0].id]: 1 };
    expect(unreadOf(list, seen)).toHaveLength(list.length - 1);
    // ничего не «из будущего»
    list.forEach((n) => expect(n.at).toBeLessThanOrEqual(at(TODAY, 20) + 60000));
  });
  it('время по-человечески: «только что», минуты, часы, «вчера», дата', () => {
    const now = at(TODAY, 15);
    expect(agoText(now - 30000, now)).toBe('только что');
    expect(agoText(now - 12 * 60000, now)).toBe('12 мин назад');
    expect(agoText(now - 3 * 3600000, now)).toBe('3 ч назад');
    expect(agoText(at(addDays(TODAY, -1), 10), now)).toBe('вчера');
    expect(agoText(at('2026-10-02', 10), now)).toBe('2 октября');
  });
  it('лента: у каждого выпуска дата, заголовок, вступление и пункты со значками; свежий — первым', () => {
    expect(NEWS.length).toBeGreaterThan(3);
    expect(NEWS.map((n) => n.date)).toEqual(NEWS.map((n) => n.date).sort().reverse());
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    NEWS.forEach((n) => {
      expect(n.title.length).toBeGreaterThan(5); expect(n.lead.length).toBeGreaterThan(20);
      expect(n.items.length).toBeGreaterThan(2);
      n.items.forEach((it) => { expect(it.icon).toBeTruthy(); expect(it.title).toBeTruthy(); expect(it.text.length).toBeGreaterThan(20); });
      // без технических слов: ученику не нужны «чанки», «кэш» и «API»
      // «баг» — отдельным словом: «золотой багет» — это рамка, а не ошибка
      expect(JSON.stringify(n)).not.toMatch(/чанк|кэш|API|e2e|рефактор|(^|[^а-яё])баг([^а-яё]|$)|localStorage|компонент/i);
    });
    expect(newsDate('2026-10-15', '2026-10-20')).toBe('15 октября');
    expect(newsDate('2025-12-31', '2026-10-20')).toBe('31 декабря 2025');
    expect(unreadNews({ [NEWS[0].id]: 1 }).map((n) => n.id)).not.toContain(NEWS[0].id);
  });
  it('первый день ученика — регистрация или первое занятие; совсем новый — сегодня', () => {
    const s = learner();
    expect(firstDayOf(s)).toBe(dayOf(s.profile.at));
    expect(firstDayOf(emptyLearn(), at(TODAY, 10))).toBe(TODAY);
  });
});

describe('коллекции профиля', () => {
  it('альбом: марка на каждый юнит Пути, получена — с датой последнего урока юнита', () => {
    const last = at(addDays(TODAY, -3), 18);
    const ids = unitIds('scarcity');
    const s = { ...emptyLearn(), lessons: { ...done(ids.slice(0, -1), at(addDays(TODAY, -5))), [ids[ids.length - 1]]: { at: last, runs: 1, best: 80 } } };
    const album = albumItems(s);
    expect(album.length).toBe(UNITS.filter((u) => u.lessons.length).length);
    expect(album[0]).toMatchObject({ id: 'scarcity', got: true, at: last, title: 'Мастерская' });
    expect(album[1]).toMatchObject({ got: false, at: 0 });
    expect(album[1].how).toMatch(/уроков юнита|из/);
    expect(fullDate(last)).toMatch(/^\d+ октября 2026$/);
  });
  it('печати и марки месяцев: полученные — с датой, испытание месяца — пока не получено, с прогрессом', () => {
    const s = { ...emptyLearn(), claimed: { 'a:first': at(TODAY, 9), 'm:2026-09': at('2026-09-28', 20) } };
    const seals = sealItems(s);
    expect(seals.find((x) => x.id === 'first')).toMatchObject({ got: true, at: at(TODAY, 9) });
    expect(seals.find((x) => x.id === 'ace')).toMatchObject({ got: false });
    const months = monthItems(s, at(TODAY, 12));
    // все месяцы с появления испытаний (сентябрь 2026) по нынешний — их два; будущих нет
    expect(months.map((m) => m.id)).toEqual(['m:2026-09', 'm:2026-10']);
    expect(months[0]).toMatchObject({ got: true, title: 'Сентябрь', year: 2026 });
    expect(months[1]).toMatchObject({ got: false, current: true });
    expect(months[1].progress.total).toBeGreaterThan(0);
    // по годам: раздел 2026 с двумя марками; пропущенный месяц — блёклый, без прогресса
    expect(monthsByYear(months)).toEqual([{ year: 2026, items: months }]);
    const later = monthItems(emptyLearn(), at('2027-01-10', 12));
    expect(later.map((m) => m.id)).toEqual(['m:2026-09', 'm:2026-10', 'm:2026-11', 'm:2026-12', 'm:2027-01']);
    expect(later[0]).toMatchObject({ missed: true, got: false });
    expect(monthsByYear(later).map((g) => [g.year, g.items.length])).toEqual([[2027, 1], [2026, 4]]);
  });
  it('короткий ряд: сначала недавно полученные, потом ближайшие к получению', () => {
    const items = [
      { id: 'a', got: true, at: 5 }, { id: 'b', got: false, progress: { have: 1, total: 10 } }, { id: 'c', got: true, at: 9 },
      { id: 'd', got: false, progress: { have: 8, total: 10 } }, { id: 'e', got: false },
    ];
    expect(shelfOrder(items).map((x) => x.id)).toEqual(['c', 'a', 'd', 'b', 'e']);
  });
});
