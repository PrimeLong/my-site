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

describe('открытия: возможности — постепенно', async () => {
  const { UNLOCKS, isUnlocked, lessonsLeft, progressOf, unlockedAt, TESTED_WEIGHT } = await import('../unlocks.js');
  const { momentsOf, pendingMoments } = await import('../celebrate.js');
  const done = (n, from = T('2026-10-27T08:00:00Z')) => ({ ...emptyLearn(), lessons: Object.fromEntries(['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5'].slice(0, n).map((id, k) => [id, { at: from + k * 600000, runs: 1, best: 90 }])) });
  it('лиги — после 1-го урока, лавка — после 2-го, копилка — после 4-го, сад — после 6-го, Мир — после 10-го', () => {
    expect(UNLOCKS.map((u) => [u.id, u.lessons])).toEqual([['league', 1], ['shop', 2], ['piggy', 4], ['garden', 6], ['world', 10]]);
    expect(UNLOCKS.every((u) => !isUnlocked(emptyLearn(), u.id))).toBe(true);
    expect(isUnlocked(done(1), 'league')).toBe(true);
    expect(isUnlocked(done(1), 'shop')).toBe(false);
    expect(lessonsLeft(done(1), 'shop')).toBe(1);
    expect(isUnlocked(done(2), 'shop')).toBe(true);
    expect(isUnlocked(done(5), 'garden')).toBe(false);
    expect(isUnlocked(done(6), 'garden')).toBe(true);
  });
  it('юнит, сданный проверкой, — за пять уроков: знающий курс не ждёт', () => {
    const tested = { ...emptyLearn(), units: { scarcity: { tested: T('2026-10-27T08:00:00Z') } } };
    expect(progressOf(tested)).toBe(TESTED_WEIGHT);
    expect(isUnlocked(tested, 'piggy')).toBe(true);
    expect(isUnlocked(tested, 'garden')).toBe(false);
  });
  it('открытие — церемония в момент нужного урока; давнее — без сцены', () => {
    const l = done(2);
    expect(unlockedAt(l).map((u) => [u.id, u.at])).toEqual([['league', l.lessons['sc-i1'].at], ['shop', l.lessons['sc-l1'].at]]);
    expect(momentsOf(l).filter((m) => m.kind === 'unlock').map((m) => m.key)).toEqual(['o:league', 'o:shop']);
    expect(pendingMoments(l, {}, T('2026-10-27T09:00:00Z')).filter((m) => m.kind === 'unlock')).toHaveLength(2);
    expect(pendingMoments(l, { 'o:league': 1 }, T('2026-10-27T09:00:00Z')).filter((m) => m.kind === 'unlock').map((m) => m.key)).toEqual(['o:shop']);
    expect(pendingMoments(l, {}, T('2026-11-05T09:00:00Z')).filter((m) => m.kind === 'unlock')).toHaveLength(0);
  });
});

describe('разбор графика: шаги и числа совпадают с моделями', async () => {
  const { GRAPHS, GRAPH_BY_UNIT, stepView } = await import('../graphs.js');
  const { CHARTS } = await import('../../textbook/charts.js');
  const { UNIT_BY_ID } = await import('../course.js');
  const { unitStops } = await import('../stops.js');
  const { pathState } = await import('../course.js');
  const sceneAt = (g, k) => {
    const def = CHARTS[g.chart];
    const v = { ...Object.fromEntries(def.controls(g.attrs).map((c) => [c.id, c.def])), ...stepView(g, k).values };
    return def.build(g.attrs, v);
  };
  const idsOf = (sc) => new Set(['axes', ...sc.curves.map((c) => c.id), ...sc.points.flatMap((p, i) => [`pt:${p.label}`, `pt#${i}`, `guide:${p.label}`, `guide#${i}`]),
    ...(sc.rects || []).map((r, i) => `rect:${i}`), ...(sc.polys || []).flatMap((p, i) => [`poly:${p.label}`, `poly#${i}`])]);
  it('каждый шаг ссылается только на то, что есть на графике в этот момент', () => {
    GRAPHS.forEach((g) => {
      expect(UNIT_BY_ID[g.unitId], g.id).toBeTruthy();
      expect(g.steps.length, g.id).toBeGreaterThanOrEqual(6);
      g.steps.forEach((s, k) => {
        const have = idsOf(sceneAt(g, k));
        [...(s.add || []), ...(s.focus || [])].forEach((id) => expect(have.has(id), `${g.id} шаг ${k + 1}: ${id}`).toBe(true));
        expect(s.text.length, `${g.id} шаг ${k + 1}`).toBeGreaterThan(40);
      });
      expect(g.quiz.options.filter((o) => o.ok)).toHaveLength(1);
      g.quiz.options.forEach((o) => expect(o.why, g.id).toBeTruthy());
    });
  });
  it('числа в текстах — из моделей: равновесие, монополия, издержки, КПВ', () => {
    const sd = GRAPH_BY_UNIT['supply-demand'];
    const e0 = sceneAt(sd, 3).points.find((p) => p.label === 'E'); expect([e0.x, e0.y]).toEqual([60, 20]);
    const e1 = sceneAt(sd, 6).points.find((p) => p.label === 'E'); expect([e1.x, e1.y]).toEqual([80, 25]);
    const mon = GRAPH_BY_UNIT['competition-monopoly'];
    const m = sceneAt(mon, 7);
    expect(m.points.find((p) => p.label === 'M')).toMatchObject({ x: 40, y: 60 });
    expect(m.rects[0]).toMatchObject({ x0: 0, x1: 40, y0: 20, y1: 60 });
    expect(CHARTS.monopoly.measure(mon.attrs, { dA: 0, mc: 20 }).dwl).toBe(800);
    const costs = GRAPH_BY_UNIT.costs;
    expect(sceneAt(costs, 4).points.find((p) => p.label === 'P = MC').x).toBeCloseTo(6);
    const avc = sceneAt(costs, 1).points.find((p) => p.label === 'min AVC'); expect(avc.x).toBeCloseTo(3); expect(avc.y).toBeCloseTo(11);
    const atc = sceneAt(costs, 2).points.find((p) => p.label === 'min ATC'); expect(atc.x).toBeCloseTo(5); expect(atc.y).toBeCloseTo(35);
    const ppf = GRAPH_BY_UNIT.scarcity;
    expect(Math.round(sceneAt(ppf, 5).points.find((p) => p.label === 'A').y)).toBe(44);
  });
  it('на дороге юнита — остановка «Разбор графика» после трети уроков; открывается, когда пройден урок перед ней', () => {
    const st = pathState(emptyLearn()).find((s) => s.course.id === 'competition-monopoly');
    const stop = unitStops(st, emptyLearn()).find((x) => x.type === 'graph');
    expect(stop).toMatchObject({ id: 'graph-monopoly', title: 'Монополия и безвозвратные потери', open: false, done: false });
    expect(unitStops(st, { ...emptyLearn(), graphs: { 'graph-monopoly': 1 } }).find((x) => x.type === 'graph').done).toBe(true);
  });
});

describe('портреты «Персоналий»: проверка свободных файлов Commons (для сборки) и никакой сети в браузере', async () => {
  const { commonsFile, photoFromCommons, isFreeLicense, loadPhoto } = await import('../portraits.js');
  const meta = (license, artist = 'John Doe') => ({ extmetadata: { LicenseShortName: { value: license }, Artist: { value: `<a href="x">${artist}</a>` } },
    thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Smith.jpg/480px-Smith.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Smith.jpg' });
  it('файл Commons из ссылки на картинку; локальный файл Википедии — нет', () => {
    expect(commonsFile('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Adam_Smith.jpg/320px-Adam_Smith.jpg')).toBe('Adam_Smith.jpg');
    expect(commonsFile('https://upload.wikimedia.org/wikipedia/commons/a/ab/Adam_Smith.jpg')).toBe('Adam_Smith.jpg');
    expect(commonsFile('https://upload.wikimedia.org/wikipedia/en/a/ab/Fair.jpg')).toBeNull();
    expect(commonsFile('https://example.com/wikipedia/commons/a/ab/X.jpg')).toBeNull();
  });
  it('лицензия: общественное достояние и CC — да, fair use — нет; автор без разметки', () => {
    ['Public domain', 'PD-US', 'CC0', 'CC BY-SA 4.0', 'CC BY 2.0'].forEach((l) => expect(isFreeLicense(l), l).toBe(true));
    ['Fair use', 'Non-free media', '', 'All rights reserved'].forEach((l) => expect(isFreeLicense(l), l).toBe(false));
    expect(photoFromCommons(meta('Public domain'))).toMatchObject({ author: 'John Doe', license: 'Public domain', file: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Smith.jpg/480px-Smith.jpg' });
    expect(photoFromCommons(meta('Fair use'))).toBeNull();
    expect(photoFromCommons(meta('CC BY 4.0', 'Elliott &amp; Fry &#8212; studio&nbsp;London')).author).toBe('Elliott & Fry — studio London');
  });
  it('браузер ученика в Википедию не ходит: нет своего файла — медальон, сеть не трогается', async () => {
    const real = globalThis.fetch;
    const calls = [];
    try {
      globalThis.fetch = (url) => { calls.push(String(url)); return Promise.reject(new Error('нельзя')); };
      expect(await loadPhoto({ id: 'test-a', wiki: 'Adam_Smith' })).toBeNull();
      expect(await loadPhoto({ id: 'king', wiki: 'Gregory_King' })).toBeNull();
      expect(calls).toEqual([]);
    } finally { globalThis.fetch = real; }
  });
});
