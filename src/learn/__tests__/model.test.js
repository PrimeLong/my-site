// «Открой сам» и живая модель юнита: скрытый спрос дня, точки → линия, детали модели по урокам
import { describe, it, expect } from 'vitest';
import {
  DAY, dayResult, hiddenDemand, distinctPrices, lineShown, discoverDone, fitDemand,
  MODEL_PARTS, MODEL_NEWS, MODEL_DEFAULT, BASE, modelParts, modelProgress, modelReadout, partsOfLesson, VERBS, lessonVerbs,
} from '../model.js';
import { KIND_LABEL } from '../course.js';
import { UNIT_BY_ID, LESSON_BY_ID, LESSONS, buildLesson } from '../course.js';
import { seeded } from '../../textbook/variants.js';

const days = (list) => list.map(([price, bought]) => ({ price, bought }));

describe('«Открой сам»: день в «Зерне»', () => {
  it('покупателей считает скрытый спрос с шумом не больше ±4 человек; цена — от 10 до 35', () => {
    [10, 20, 35].forEach((p) => {
      const lo = dayResult(p, () => 0); const hi = dayResult(p, () => 0.999999);
      expect(lo.bought).toBeGreaterThanOrEqual(hiddenDemand(p) - DAY.noise);
      expect(hi.bought).toBeLessThanOrEqual(hiddenDemand(p) + DAY.noise);
      expect(lo.bought).toBeLessThanOrEqual(DAY.passers);
    });
    expect(dayResult(3, () => 0.5).price).toBe(DAY.min);
    expect(dayResult(50, () => 0.5).price).toBe(DAY.max);
    // чем дороже, тем меньше заходят — даже с худшим шумом между крайними ценами
    expect(dayResult(10, () => 0).bought).toBeGreaterThan(dayResult(35, () => 0.999).bought);
  });
  it('дальше — с четырёх разных цен; одна цена много раз не считается', () => {
    expect(discoverDone(days([[20, 60], [20, 61], [20, 59], [20, 60], [20, 62]]))).toBe(false);
    expect(discoverDone(days([[12, 84], [18, 66], [25, 45]]))).toBe(false);
    expect(discoverDone(days([[12, 84], [18, 66], [25, 45], [32, 24]]))).toBe(true);
    expect(distinctPrices(days([[12, 84], [12, 80], [30, 30]]))).toBe(2);
  });
  it('линия проступает с четырёх разных цен или с пятого дня при трёх ценах', () => {
    expect(lineShown(days([[12, 84], [18, 66], [25, 45]]))).toBe(false);
    expect(lineShown(days([[12, 84], [18, 66], [25, 45], [25, 47], [12, 85]]))).toBe(true);
    expect(lineShown(days([[12, 84], [18, 66], [25, 45], [33, 21]]))).toBe(true);
  });
  it('прямая по точкам без шума — ровно скрытый спрос; с шумом — близко к нему', () => {
    const exact = fitDemand([10, 15, 22, 30].map((p) => ({ price: p, bought: hiddenDemand(p) })));
    expect(exact.a).toBeCloseTo(DAY.a, 6); expect(exact.b).toBeCloseTo(DAY.b, 6);
    const r = seeded(7);
    const noisy = fitDemand([10, 14, 18, 22, 26, 30, 34].map((p) => dayResult(p, r)));
    expect(Math.abs(noisy.b - DAY.b)).toBeLessThan(0.6);
    expect(fitDemand(days([[20, 60], [20, 58]]))).toBeNull();
  });
  it('первый урок юнита начинается с «Открой сам», потом — карточка-идея', () => {
    const l = LESSON_BY_ID['sd-i1'];
    expect(l.inner[0].discover).toBe(true);
    expect(l.inner[0].idea.discover).toBe('demand');
    expect(l.inner[1].idea).toBe(l.idea);
    const plan = buildLesson('sd-i1', seeded(1));
    const first = plan.cards[plan.items[0].uid];
    expect(first[0].discover).toBe('demand');
    expect(first[1]).toBe(l.idea);
    // «Открой сам» только в supply-demand: остальные юниты не тронуты
    Object.values(LESSON_BY_ID).filter((x) => x.unitId !== 'supply-demand').forEach((x) => expect(x.inner.some((c) => c.discover), x.id).toBe(false));
  });
});

describe('живая модель юнита supply-demand', () => {
  const unit = UNIT_BY_ID['supply-demand'];
  const parts = MODEL_PARTS['supply-demand'];
  const own = parts.filter((p) => LESSON_BY_ID[p.lesson].unitId === 'supply-demand');
  it('каждый урок юнита добавляет одну деталь — по порядку уроков', () => {
    expect(own.map((p) => p.lesson)).toEqual(unit.lessons.map((l) => l.id));
    own.forEach((p) => expect(partsOfLesson(p.lesson).map((x) => x.id)).toEqual([p.id]));
    // эластичность — из урока следующего юнита: в модели она силуэтом со ссылкой на тот урок
    const el = parts.find((p) => p.id === 'elastic');
    expect(LESSON_BY_ID[el.lesson].unitId).toBe('elasticity');
  });
  it('открыто то, что пройдено; закрытое знает, в каком уроке откроется', () => {
    const learn = { lessons: { 'sd-i1': { runs: 1 }, 'sd-l1': { runs: 2 }, 'sd-w': { runs: 0 } } };
    const list = modelParts('supply-demand', learn);
    expect(list.filter((p) => p.open).map((p) => p.id)).toEqual(['demand', 'income']);
    expect(list.find((p) => p.id === 'supply').where).toBe(LESSON_BY_ID['sd-i2'].title);
    expect(list.find((p) => p.id === 'elastic').outside).toBe(UNIT_BY_ID.elasticity.title);
    expect(modelProgress('supply-demand', learn)).toEqual({ open: 2, total: unit.lessons.length });
    expect(modelProgress('supply-demand', { lessons: {} }).open).toBe(0);
  });
  const all = new Set(parts.map((p) => p.id));
  it('без сдвигов равновесие — 20 крон и 60 чашек; без предложения — объём спроса при выбранной цене', () => {
    const r = modelReadout(MODEL_DEFAULT, all);
    expect(r.mode).toBe('equilibrium'); expect(r.eq.p).toBeCloseTo(20, 9); expect(r.eq.q).toBeCloseTo(60, 9);
    const d = modelReadout({ ...MODEL_DEFAULT, price: 30 }, new Set(['demand', 'income']));
    expect(d.mode).toBe('demand'); expect(d.qd).toBe(BASE.a - BASE.b * 30);
  });
  it('сдвиги ведут себя как в учебнике: доходы ↑ — цена и количество ↑; зерно ↑ — цена ↑, количество ↓; чай дешевле — цена ↓', () => {
    const base = modelReadout(MODEL_DEFAULT, all).eq;
    const inc = modelReadout({ ...MODEL_DEFAULT, income: 2 }, all).eq;
    expect(inc.p).toBeGreaterThan(base.p); expect(inc.q).toBeGreaterThan(base.q);
    const grain = modelReadout({ ...MODEL_DEFAULT, grain: 2 }, all).eq;
    expect(grain.p).toBeGreaterThan(base.p); expect(grain.q).toBeLessThan(base.q);
    const tea = modelReadout({ ...MODEL_DEFAULT, tea: -2 }, all).eq;
    expect(tea.p).toBeLessThan(base.p); expect(tea.q).toBeLessThan(base.q);
    // закрытая деталь не действует
    expect(modelReadout({ ...MODEL_DEFAULT, grain: 2 }, new Set(['demand', 'supply'])).eq.p).toBeCloseTo(20, 9);
  });
  it('потолок ниже равновесия — дефицит; выше — ни на что не влияет', () => {
    const r = modelReadout({ ...MODEL_DEFAULT, ceiling: 15 }, all);
    expect(r.mode).toBe('ceiling'); expect(r.qd).toBe(75); expect(r.qs).toBe(35); expect(r.shortage).toBe(40); expect(r.sold).toBe(35);
    expect(modelReadout({ ...MODEL_DEFAULT, ceiling: 25 }, all).mode).toBe('equilibrium');
  });
  it('эластичность поворачивает спрос вокруг исходного равновесия', () => {
    [1, 3, 6].forEach((b) => { const r = modelReadout({ ...MODEL_DEFAULT, elastic: b }, all); expect(r.eq.p).toBeCloseTo(20, 9); expect(r.eq.q).toBeCloseTo(60, 9); });
    const flat = modelReadout({ ...MODEL_DEFAULT, elastic: 6, grain: 2 }, all).eq;
    const steep = modelReadout({ ...MODEL_DEFAULT, elastic: 1, grain: 2 }, all).eq;
    // при эластичном спросе тот же удар по предложению сильнее бьёт по количеству, слабее — по цене
    expect(flat.q).toBeLessThan(steep.q); expect(flat.p).toBeLessThan(steep.p);
  });
  it('новости двигают только существующие ползунки модели', () => {
    MODEL_NEWS.forEach((n) => Object.keys(n.set).forEach((k) => expect(Object.keys(MODEL_DEFAULT), `${n.id}: ${k}`).toContain(k)));
  });
});

describe('«Домино»', () => {
  const dominoes = LESSONS.flatMap((l) => l.exercises.filter((e) => e.kind === 'domino').map((e) => ({ ...e, lesson: l.id })));
  it('четыре «Домино» — только в supply-demand: доходы, морозы, потолок, чай', () => {
    expect(dominoes.map((d) => d.id).sort()).toEqual(['sd-dom-ceiling', 'sd-dom-frost', 'sd-dom-income', 'sd-dom-tea']);
    dominoes.forEach((d) => expect(LESSON_BY_ID[d.lesson].unitId).toBe('supply-demand'));
    // доходы — урок про спрос, до предложения: на сцене только спрос
    expect(dominoes.find((d) => d.id === 'sd-dom-income').scene).toBe('demand');
  });
  it('практика берёт своё «Домино» всегда, при любом наборе и уровне', () => {
    ['sd-l1', 'sd-l3'].forEach((id) => {
      const own = LESSON_BY_ID[id].exercises.filter((e) => e.kind === 'domino').map((e) => e.id);
      expect(own.length, id).toBeGreaterThan(0);
      for (let s = 1; s <= 12; s += 1) {
        ['normal', 'hard'].forEach((level) => {
          const ids = buildLesson(id, seeded(s), { level }).items.map((it) => it.id);
          own.forEach((d) => expect(ids, `${id} s=${s} ${level}`).toContain(d));
        });
      }
    });
  });
});

describe('глаголы учёбы (docs/mechanics.md)', () => {
  it('у каждого вида задания есть глагол', () => {
    Object.keys(KIND_LABEL).forEach((k) => expect(VERBS[k], k).toBeTruthy());
  });
  it('supply-demand: в уроке два разных глагола и хотя бы один шаг с моделью (кроме «Слов», игры, повторения и итогов)', () => {
    UNIT_BY_ID['supply-demand'].lessons.filter((l) => ['intro', 'practice', 'story', 'listen'].includes(l.kind)).forEach((l) => {
      const v = lessonVerbs(l);
      expect(v.verbs.length, `${l.id}: ${v.verbs.join(', ')}`).toBeGreaterThanOrEqual(2);
      expect(v.model, `${l.id}: нет шага с моделью`).toBe(true);
    });
  });
});
