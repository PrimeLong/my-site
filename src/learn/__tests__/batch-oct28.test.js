// выпуск 28 октября: подписи графиков, полоса прогресса урока и прочее (docs/mechanics.md)
import { describe, it, expect } from 'vitest';
describe('подписи на графике не налезают друг на друга (src/learn/label-place.js)', () => {
  it('вторая подпись у той же точки уходит на свободное место', async () => {
    const { placeLabels, aroundPoint, textBox, boxOverlap } = await import('../label-place.js');
    const spots = placeLabels([
      { id: 'a', text: 'min ATC', size: 12, cands: aroundPoint(100, 100) },
      { id: 'b', text: 'P = MC', size: 14, cands: aroundPoint(104, 102) },
    ], { bounds: { x0: 0, x1: 360, y0: 0, y1: 290 } });
    const box = (id, t, size) => textBox(t, spots[id].x, spots[id].y, size, spots[id].anchor);
    expect(boxOverlap(box('a', 'min ATC', 12), box('b', 'P = MC', 14))).toBe(0);
  });
  it('у края поля подпись встаёт внутрь; деление под названием оси прячется', async () => {
    const { placeLabels, aroundPoint, freeTicks, textBox } = await import('../label-place.js');
    const spots = placeLabels([{ id: 'a', text: 'всё на X: 60', size: 12, cands: aroundPoint(350, 50) }], { bounds: { x0: 0, x1: 360, y0: 0, y1: 290 } });
    expect(spots.a.anchor).toBe('end');
    const axis = textBox('хлеб X', 344, 286, 13, 'end');
    const ticks = [{ t: 0, box: textBox('0', 42, 271, 12, 'middle') }, { t: 150, box: textBox('150', 335, 271, 12, 'middle') }];
    expect(freeTicks(ticks, [axis]).map((t) => t.t)).toEqual([0]);
  });
});

describe('полоса прогресса урока на телефоне (ProgressChart, src/ds-art.jsx)', () => {
  it('влезают все — без окна; не влезают — окно вокруг текущего, два будущих впереди', async () => {
    const { segWindow, SEG_MIN } = await import('../../ds-art.jsx');
    expect(segWindow(8, 3, 300)).toEqual({ from: 0, to: 8, cut: false });
    const w = 150; const cap = Math.floor((w + 3) / (SEG_MIN + 3));
    expect(segWindow(20, 2, w)).toEqual({ from: 0, to: cap, cut: false });
    expect(segWindow(20, 12, w)).toEqual({ from: 15 - cap, to: 15, cut: true });
    expect(segWindow(20, 20, w)).toEqual({ from: 20 - cap, to: 20, cut: true });
    // ширина ещё не измерена — все отрезки
    expect(segWindow(20, 12, 0).cut).toBe(false);
  });
});

describe('особые уроки дороги — такие же уроки: следующий ждёт их, считаются в заданиях дня', () => {
  it('Персоналии после второго урока закрывают третий; пройдены — третий открыт; ждущий особый урок — текущая остановка', async () => {
    const { pathState, UNIT_BY_ID } = await import('../course.js');
    const { recommend } = await import('../program.js');
    const { PEOPLE_BY_UNIT } = await import('../people.js');
    const { emptyLearn, finishLesson, markMet } = await import('../../textbook/learn-state.js');
    const unit = UNIT_BY_ID.scarcity; const pp = PEOPLE_BY_UNIT.scarcity;
    let s = emptyLearn();
    unit.lessons.slice(0, 2).forEach((l, i) => { s = finishLesson(s, l.id, { xp: 10, accuracy: 100, now: 1e12 + i }); });
    let st = pathState(s)[0];
    expect(st.lessons[2].open).toBe(false);
    expect(st.lessons[1].waits).toEqual(['people']);
    expect(st.waiting).toMatchObject({ id: pp.id, extra: 'people' });
    expect(st.current).toMatchObject({ id: pp.id, extra: 'people', title: pp.title });
    expect(recommend(s)).toMatchObject({ lessonId: pp.id, extra: 'people', title: pp.title });
    s = markMet(s, pp.id);
    st = pathState(s)[0];
    expect(st.lessons[2].open).toBe(true);
    expect(st.current.id).toBe(unit.lessons[2].id);
    expect(st.waiting).toBe(null);
  });
  it('юнит, сданный проверкой, особых уроков не ждёт', async () => {
    const { pathState, UNIT_BY_ID } = await import('../course.js');
    const { emptyLearn, finishLesson, passUnit } = await import('../../textbook/learn-state.js');
    let s = emptyLearn();
    UNIT_BY_ID.scarcity.lessons.slice(0, 2).forEach((l) => { s = finishLesson(s, l.id, { xp: 10, accuracy: 100, now: 1e12 }); });
    s = passUnit(s, 'scarcity');
    expect(pathState(s)[0].lessons.every((l) => l.open)).toBe(true);
  });
  it('пройденный впервые особый урок — урок дня и новый урок на Пути; повтор — просто урок', async () => {
    const { emptyLearn, finishLesson, dayOf } = await import('../../textbook/learn-state.js');
    const now = Date.parse('2026-10-28T10:00:00Z');
    let s = finishLesson(emptyLearn(), null, { xp: 10, accuracy: 100, now, kind: 'graph', extra: { fresh: true } });
    expect(s.daily[dayOf(now)]).toMatchObject({ l: 1, n: 1, p: 1 });
    s = finishLesson(s, null, { xp: 10, accuracy: 60, now: now + 1000, kind: 'read', extra: { fresh: false } });
    expect(s.daily[dayOf(now)]).toMatchObject({ l: 2, n: 1, p: 1 });
  });
});

describe('новости: прочитанный выпуск — не «новый» и на другом устройстве', () => {
  it('отметка в прогрессе (w:<id>) читается вместе с отметкой устройства', async () => {
    const { readNewsSeen, newsShownKeys, NEWS } = await import('../news.js');
    const { emptyLearn, markShown, mergeLearn, normalizeLearn } = await import('../../textbook/learn-state.js');
    const id = NEWS[0].id;
    expect(newsShownKeys([id])).toEqual([`w:${id}`, `n:news:${id}`]);
    const pc = markShown(emptyLearn(), newsShownKeys([id]), 1000);
    // телефон: своя отметка пуста, прогресс пришёл с ПК
    const phone = mergeLearn(normalizeLearn(emptyLearn()), normalizeLearn(pc));
    expect(readNewsSeen(phone)[id]).toBe(1000);
    expect(readNewsSeen(emptyLearn())[id]).toBeUndefined();
  });
});

describe('учебник по уровням курса: выше нынешнего — под замком (src/learn/grade.js)', () => {
  it('новичку открыт только Начальный; пройденный проверкой Начальный открывает Базовый', async () => {
    const { openBookLevels } = await import('../grade.js');
    const { emptyLearn } = await import('../../textbook/learn-state.js');
    expect([...openBookLevels(emptyLearn())]).toEqual(['start']);
    expect([...openBookLevels(null)]).toEqual(['start']);
    const passed = { ...emptyLearn(), units: { scarcity: { tested: 1 } } };
    expect([...openBookLevels(passed)]).toEqual(['start', 'basic']);
  });
});

describe('книги полки: больше текста и озвучка одной записью (src/learn/shelf.js)', () => {
  it('в каждой книге не меньше двух отрывков, всего — втрое больше прежних 15', async () => {
    const { BOOKS } = await import('../shelf.js');
    BOOKS.forEach((b) => expect(b.passages.length, b.id).toBeGreaterThanOrEqual(2));
    expect(BOOKS.reduce((a, b) => a + b.passages.length, 0)).toBeGreaterThanOrEqual(40);
    // id отрывков внутри книги не повторяются — по ним проигрыватель перематывает
    BOOKS.forEach((b) => expect(new Set(b.passages.map((p) => p.id)).size, b.id).toBe(b.passages.length));
  });
  it('текст для озвучки без «[…]» и без пробела перед знаком препинания', async () => {
    const { BOOKS, speechScript, speakable } = await import('../shelf.js');
    BOOKS.forEach((b) => {
      const t = speechScript(b);
      expect(t, b.id).not.toMatch(/\[|\]/);
      expect(t, b.id).not.toMatch(/ [,.;:!?]/);
      expect(t.startsWith(`${b.author}. «${b.title}». Год издания: ${b.year}.`)).toBe(true);
    });
    expect(speakable('делу […], едва')).toBe('делу, едва');
    expect(speakable('человек. […] Они')).toBe('человек. Они');
    expect(speakable('операции […].')).toBe('операции.');
  });
  it('доли записи идут подряд от 0 до 1; отрывок по доле и начало отрывка согласованы', async () => {
    const { BOOK_BY_ID, bookSpeech, passageAt, passageStart } = await import('../shelf.js');
    const parts = bookSpeech(BOOK_BY_ID['smith-wealth']);
    expect(parts[0].from).toBe(0);
    expect(parts[parts.length - 1].to).toBeCloseTo(1, 10);
    parts.slice(1).forEach((p, k) => expect(p.from).toBeCloseTo(parts[k].to, 10));
    BOOK_BY_ID['smith-wealth'].passages.forEach((p) => expect(passageAt(parts, passageStart(parts, p.id))).toBe(p.id));
    expect(passageAt(parts, 0)).toBe(null);
  });
});

describe('«Пыльная витрина» в лавке (src/learn/dust.js)', () => {
  it('за витрину — 3 монеты, до трёх в день; четвёртая — без монет; назавтра снова', async () => {
    const { DUST, dustClaim, dustDone, dustLeft } = await import('../dust.js');
    const { balance } = await import('../rewards.js');
    const { emptyLearn } = await import('../../textbook/learn-state.js');
    const T = Date.parse('2026-10-28T10:00:00Z');
    let s = emptyLearn();
    for (let k = 0; k < 4; k += 1) s = dustClaim(s, T + k * 60000);
    expect(balance(s)).toBe(DUST.coins * DUST.perDay);
    expect(dustDone(s, T)).toBe(3);
    expect(dustLeft(s, T)).toBe(0);
    expect(dustLeft(s, T + 86400000)).toBe(3);
    s = dustClaim(s, T + 86400000);
    expect(balance(s)).toBe(DUST.coins * (DUST.perDay + 1));
  });
  it('тряпка: один проход оставляет середину мутной, второй — чисто; край круга почти не тронут', async () => {
    const { DUST, dustGrid, wipeAt, cleanShare, stampsAlong, shownPercent } = await import('../dust.js');
    const g = dustGrid(80, 80, 8);
    expect(g.cols).toBe(10); expect(cleanShare(g)).toBe(0);
    wipeAt(g, 44, 44, 30);
    const mid = g.v[5 * 10 + 5];
    expect(mid).toBeGreaterThan(DUST.thr);
    wipeAt(g, 44, 44, 30);
    expect(g.v[5 * 10 + 5]).toBeLessThan(DUST.thr);
    expect(g.v[0]).toBe(1);
    const pts = stampsAlong(0, 0, 30, 0, 9);
    expect(pts.length).toBe(10);
    expect(pts[pts.length - 1]).toEqual([30, 0]);
    expect(shownPercent(DUST.clean)).toBe(100);
    expect(shownPercent(0.45)).toBe(50);
  });
  it('ключи витрин хранятся отдельно и не вытесняют награды за уроки', async () => {
    const { normalizeLearn, emptyLearn } = await import('../../textbook/learn-state.js');
    const claimed = { 'l:sc-i1': 1000 };
    for (let d = 1; d <= 20; d += 1) for (let k = 1; k <= 3; k += 1) claimed[`dust:2026-09-${String(d).padStart(2, '0')}:${k}`] = 2000 + d;
    const s = normalizeLearn({ ...emptyLearn(), claimed });
    expect(s.claimed['l:sc-i1']).toBe(1000);
    const dust = Object.keys(s.claimed).filter((k) => k.startsWith('dust:'));
    expect(dust.length).toBe(30);
    expect(dust).toContain('dust:2026-09-20:3');
    expect(dust).not.toContain('dust:2026-09-01:1');
  });
});
