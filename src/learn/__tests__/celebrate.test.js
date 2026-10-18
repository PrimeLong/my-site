// Церемонии: какие моменты есть, какие ещё не показаны, первое знакомство и не больше трёх сцен подряд
import { describe, it, expect } from 'vitest';
import { CELEBRATE, momentsOf, pendingMoments, baselineSeen, nextBatch } from '../celebrate.js';
import { emptyLearn } from '../../textbook/learn-state.js';

const NOW = new Date(2026, 9, 18, 12).getTime();
const HOUR = 3600000;
const UNIT1 = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
// юнит 1 пройден час назад, печати «Первый шаг» (вчера) и «Место на карте» (час назад), марка октября
const learn = () => ({
  ...emptyLearn(),
  lessons: Object.fromEntries(UNIT1.map((id) => [id, { at: NOW - HOUR, runs: 1, best: 90 }])),
  claimed: { 'a:first': NOW - 26 * HOUR, 'a:unit': NOW - HOUR, 'm:2026-10': NOW - 2 * HOUR },
});

describe('церемонии', () => {
  it('моменты: марка юнита, марка месяца, печати — с временем получения', () => {
    const ms = momentsOf(learn(), NOW);
    expect(ms.find((m) => m.key === 'u:scarcity')).toMatchObject({ kind: 'album', at: NOW - HOUR });
    expect(ms.find((m) => m.key === 'm:2026-10')).toMatchObject({ kind: 'month', at: NOW - 2 * HOUR });
    expect(ms.filter((m) => m.kind === 'seal').map((m) => m.key).sort()).toEqual(['a:first', 'a:unit']);
    expect(ms.every((m) => m.it && m.it.title)).toBe(true);
  });
  it('по порядку: марка юнита, марка месяца, печати по времени; показанное — не повторяется', () => {
    const p = pendingMoments(learn(), {}, NOW);
    expect(p.map((m) => m.key)).toEqual(['u:scarcity', 'm:2026-10', 'a:first', 'a:unit']);
    expect(pendingMoments(learn(), { 'u:scarcity': NOW, 'a:first': NOW }, NOW).map((m) => m.key)).toEqual(['m:2026-10', 'a:unit']);
  });
  it('старше трёх дней — без сцены', () => {
    const later = NOW + CELEBRATE.fresh - 3 * HOUR;
    expect(pendingMoments(learn(), {}, later).map((m) => m.key)).toEqual(['u:scarcity', 'm:2026-10', 'a:unit']);
    expect(pendingMoments(learn(), {}, NOW + CELEBRATE.fresh + HOUR)).toEqual([]);
  });
  it('первое знакомство: всё уже полученное — как показанное, новое потом — со сценой', () => {
    const s = learn();
    const seen = baselineSeen(s, NOW);
    expect(pendingMoments(s, seen, NOW)).toEqual([]);
    const next = { ...s, claimed: { ...s.claimed, 'a:shop': NOW } };
    expect(pendingMoments(next, seen, NOW).map((m) => m.key)).toEqual(['a:shop']);
  });
  it('новичок: ничего нет — и праздновать нечего', () => {
    expect(momentsOf(emptyLearn(), NOW)).toEqual([]);
    expect(baselineSeen(emptyLearn(), NOW)).toEqual({});
  });
  it('сцен подряд — не больше трёх, остальное — без сцен', () => {
    const { show, skip } = nextBatch(pendingMoments(learn(), {}, NOW));
    expect(show.map((m) => m.key)).toEqual(['u:scarcity', 'm:2026-10', 'a:first']);
    expect(skip.map((m) => m.key)).toEqual(['a:unit']);
  });
});
