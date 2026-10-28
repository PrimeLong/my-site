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
