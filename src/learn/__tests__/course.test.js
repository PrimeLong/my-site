/* Путь уроков: у каждого упражнения ровно один верный ответ, неверные варианты уникальны и не
   совпадают с верным, урок укладывается в 3–5 минут, все типы упражнений есть в пилоте. */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { UNITS, UNIT_BY_ID, LESSONS, EXERCISES, pilotUnits, buildLesson, buildUnitCheck, buildLegend, buildPractice, instantiate, check, ready, answerText, estimate, pathState, SECONDS, KIND_LABEL } from '../course.js';
import { collectMath } from '../../textbook/markdown.js';
import { plainText } from '../../textbook/content.js';
import { seeded } from '../../textbook/variants.js';
import { emptyLearn, finishLesson, passUnit, lessonXp, streak, longestStreak, bestWeek, recordAttempt, quitLesson, startLesson, learnStats, normalizeLearn, mergeLearn, addMistake, resolveMistake, dayOf, setGoal, goalToday, missedYesterday } from '../../textbook/learn-state.js';

const PATH = ['scarcity', 'supply-demand'];
const PILOT = 'supply-demand';
const plain = (nodes) => plainText(nodes || []);
const N = 30;

it('на Пути уроками — юниты 1 и 2, с самого начала курса', () => {
  expect(pilotUnits().map((u) => u.id)).toEqual(PATH);
  expect(UNITS.slice(0, 2).map((u) => u.id)).toEqual(PATH);
});

describe.each(PATH)('юнит %s', (unitId) => {
  const unit = UNIT_BY_ID[unitId];
  it('5–6 уроков, у каждого урока карточка идеи до 60 слов', () => {
    expect(unit.lessons.length).toBeGreaterThanOrEqual(5);
    expect(unit.lessons.length).toBeLessThanOrEqual(6);
    unit.lessons.forEach((l) => {
      const words = plain(l.idea.text).split(/\s+/).filter(Boolean).length;
      expect(words, `${l.id}: ${words} слов`).toBeLessThanOrEqual(60);
      expect(l.idea.chart, `${l.id}: мини-график`).toBeTruthy();
      expect(l.section, `${l.id}: раздел главы для «Подробнее в теории»`).toBeTruthy();
    });
  });
  it('все девять типов упражнений есть хотя бы по разу', () => {
    const kinds = new Set(unit.lessons.flatMap((l) => l.exercises.map((e) => e.kind)));
    Object.keys(KIND_LABEL).forEach((k) => expect(kinds, k).toContain(k));
  });
  it('в каждом уроке не меньше 10 упражнений и не больше 15, повторение — около трети', () => {
    unit.lessons.forEach((l) => {
      for (let s = 1; s <= N; s += 1) {
        const { items } = buildLesson(l.id, seeded(s));
        expect(items.length, l.id).toBeGreaterThanOrEqual(10);
        expect(items.length, l.id).toBeLessThanOrEqual(15);
        const rev = items.filter((it) => it.review).length;
        if (l.no > 1) { expect(rev / items.length, l.id).toBeGreaterThanOrEqual(0.25); expect(rev / items.length, l.id).toBeLessThanOrEqual(0.4); }
        expect(items[0].review).toBeFalsy();
        expect(SECONDS[items[0].kind]).toBeLessThanOrEqual(12);
        items.filter((it) => it.review).forEach((it) => expect(EXERCISES[it.id].lesson).not.toBe(l.id));
      }
    });
  });
  it('урок укладывается в 3–5 минут по оценке времени', () => {
    unit.lessons.forEach((l) => {
      for (let s = 1; s <= N; s += 1) {
        const { seconds } = buildLesson(l.id, seeded(s));
        expect(seconds, `${l.id}: ${seconds} с`).toBeGreaterThanOrEqual(180);
        expect(seconds, `${l.id}: ${seconds} с`).toBeLessThanOrEqual(300);
      }
    });
  });
});

describe('упражнения: ровно один верный ответ', () => {
  const all = Object.values(EXERCISES);
  it.each(all.map((e) => [e.id, e]))('%s', (_, ex) => {
    for (let s = 1; s <= 10; s += 1) {
      const inst = instantiate(ex, seeded(s * 13 + 1));
      expect(KIND_LABEL[inst.kind]).toBeTruthy();
      expect(SECONDS[inst.kind]).toBeGreaterThan(0);
      // формулы собираются
      const inl = [...(inst.options || []).map((o) => o.text), ...(inst.items || []).map((o) => o.text), ...(inst.left || []).map((o) => o.text), ...(inst.right || []).map((o) => o.text)];
      [...collectMath([...inst.prompt, ...(inst.explain || [])]), ...inl.flatMap((n) => (n || []).filter((x) => x.t === 'math').map((x) => x.v))]
        .forEach((tex) => expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }), tex).not.toThrow());
      switch (inst.kind) {
        case 'choice': case 'gap': {
          expect(inst.options.filter((o) => o.correct).length).toBe(1);
          expect(inst.options.length).toBeGreaterThanOrEqual(2);
          const raws = inst.options.map((o) => o.raw);
          expect(new Set(raws).size, `${ex.id}: варианты повторяются`).toBe(raws.length);
          inst.options.forEach((o) => expect(check(inst, o.key).ok).toBe(o.correct));
          if (inst.kind === 'gap') expect(JSON.stringify(inst.prompt)).toContain('___');
          break;
        }
        case 'tf': expect(check(inst, inst.answer).ok).toBe(true); expect(check(inst, !inst.answer).ok).toBe(false); break;
        case 'order': {
          expect(inst.items.length).toBeGreaterThanOrEqual(4); expect(inst.items.length).toBeLessThanOrEqual(5);
          expect(new Set(inst.items.map((x) => x.raw)).size).toBe(inst.items.length);
          expect(check(inst, inst.solution).ok).toBe(true);
          expect(check(inst, inst.items.map((x) => x.key)).ok, 'показанный порядок не должен быть верным').toBe(false);
          expect(check(inst, [...inst.solution].reverse()).ok).toBe(false);
          break;
        }
        case 'match': {
          expect(inst.left.length).toBeGreaterThanOrEqual(3);
          expect(new Set(inst.left.map((x) => x.raw)).size).toBe(inst.left.length);
          expect(new Set(inst.right.map((x) => x.raw)).size).toBe(inst.right.length);
          const right = Object.fromEntries(inst.left.map((l) => [l.key, l.key]));
          expect(check(inst, right).ok).toBe(true);
          const keys = inst.left.map((l) => l.key);
          const swapped = { ...right, [keys[0]]: keys[1], [keys[1]]: keys[0] };
          expect(check(inst, swapped).ok).toBe(false);
          break;
        }
        case 'sort': {
          expect(inst.bins.length).toBeGreaterThanOrEqual(2);
          inst.items.forEach((it) => expect(inst.bins, `${ex.id}: «${it.raw}»`).toContain(it.bin));
          expect(new Set(inst.items.map((x) => x.raw)).size).toBe(inst.items.length);
          inst.bins.forEach((b) => expect(inst.items.some((it) => it.bin === b), `${ex.id}: пустая корзина ${b}`).toBe(true));
          const right = Object.fromEntries(inst.items.map((it) => [it.key, it.bin]));
          expect(check(inst, right).ok).toBe(true);
          expect(check(inst, { ...right, [inst.items[0].key]: inst.bins.find((b) => b !== inst.items[0].bin) }).ok).toBe(false);
          break;
        }
        case 'calc': {
          expect(Number.isFinite(inst.answer)).toBe(true);
          expect(check(inst, String(Math.round(inst.answer * 100) / 100).replace('.', ',')).ok).toBe(true);
          inst.traps.forEach((t) => {
            expect(Math.abs(t.value - inst.answer), `${ex.id}: ловушка ${t.value} = ответу`).toBeGreaterThan(Math.max(inst.tol || 0, 0.01 * Math.abs(t.value)));
            const r = check(inst, String(t.value));
            expect(r.ok).toBe(false);
            expect(r.why).toBeTruthy();
          });
          break;
        }
        case 'shift': {
          expect(inst.choices.map((c) => c.key)).toContain(inst.answer);
          expect(new Set(inst.choices.map((c) => c.key)).size).toBe(inst.choices.length);
          inst.choices.forEach((c) => expect(check(inst, c.key).ok).toBe(c.key === inst.answer));
          inst.traps.forEach((t) => expect(t.key).not.toBe(inst.answer));
          break;
        }
        case 'news': {
          expect(inst.vars.length).toBeGreaterThanOrEqual(2);
          inst.vars.forEach((v) => expect(['+', '-', '0'], `${ex.id}: ${v.key}`).toContain(inst.expect[v.key]));
          expect(Object.keys(inst.expect).sort()).toEqual(inst.vars.map((v) => v.key).sort());
          expect(check(inst, inst.expect).ok).toBe(true);
          const v0 = inst.vars[0].key;
          expect(check(inst, { ...inst.expect, [v0]: inst.expect[v0] === '+' ? '-' : '+' }).ok).toBe(false);
          break;
        }
        default: throw new Error(inst.kind);
      }
      expect(answerText(inst).length).toBeGreaterThan(0);
    }
  });
  it('ready: «Проверить» доступна, только когда ответ собран целиком', () => {
    const ord = instantiate(Object.values(EXERCISES).find((e) => e.kind === 'order'), seeded(3));
    expect(ready(ord, [ord.items[0].key])).toBe(false);
    expect(ready(ord, ord.solution)).toBe(true);
  });
});

describe('проверка юнита, уровень легенды, практика, состояние пути', () => {
  it('проверка юнита: 10 упражнений, в том числе расчёты с новыми числами; легенда — задачи уровней 2–3', () => {
    PATH.forEach((id) => {
      const lg = buildLegend(id, seeded(1));
      expect(lg.items.length, id).toBeGreaterThanOrEqual(3);
      expect(buildUnitCheck(id, seeded(3)).items.length, id).toBe(10);
    });
    const a = buildUnitCheck(PILOT, seeded(1)); const b = buildUnitCheck(PILOT, seeded(2));
    expect(a.items.length).toBe(10);
    expect(a.items.some((it) => it.variant)).toBe(true);
    const va = a.items.filter((it) => it.variant).map((it) => it.answer).join(); const vb = b.items.filter((it) => it.variant).map((it) => it.answer).join();
    expect(va).not.toBe(vb);
    const lg = buildLegend(PILOT, seeded(1));
    expect(lg.items.length).toBeGreaterThanOrEqual(3);
  });
  it('путь: следующий урок открывается после предыдущего, проверка юнита открывает все', () => {
    let learn = emptyLearn();
    let [st, st2] = pathState(learn);
    expect(st.lessons.map((l) => l.open)).toEqual(st.lessons.map((_, i) => i === 0));
    expect(st2.lessons.every((l) => !l.open)).toBe(true);
    expect(st.current.id).toBe(st.lessons[0].id);
    learn = finishLesson(learn, st.lessons[0].id, { xp: 10, accuracy: 90, now: 1e12 });
    [st] = pathState(learn);
    expect(st.lessons[1].open).toBe(true);
    expect(st.lessons[2].open).toBe(false);
    // проверка первого юнита отмечает его пройденным и открывает первый урок второго
    learn = passUnit(learn, PATH[0], st.lessons.map((l) => l.id), 1e12);
    [st, st2] = pathState(learn);
    expect(st.complete).toBe(true);
    expect(st.tested).toBe(true);
    expect(st2.lessons.map((l) => l.open)).toEqual(st2.lessons.map((_, i) => i === 0));
    // пройденный урок остаётся открытым для повтора
    const only = finishLesson(emptyLearn(), st2.lessons[2].id, { xp: 1, accuracy: 100, now: 1e12 });
    expect(pathState(only)[1].lessons[2].open).toBe(true);
  });
  it('практика собирается из ошибок', () => {
    const ids = Object.keys(EXERCISES).slice(0, 5);
    expect(buildPractice(ids, seeded(1)).items.map((it) => it.id).sort()).toEqual(ids.sort());
    expect(estimate([])).toBeGreaterThan(0);
    expect(LESSONS.length).toBe(PATH.reduce((n, id) => n + UNIT_BY_ID[id].lessons.length, 0));
    expect(UNITS.length).toBeGreaterThan(10);
  });
});

describe('мотивация: опыт, серия с заморозкой, рекорды, статистика', () => {
  const at = (y, m, d) => new Date(y, m - 1, d, 15).getTime();
  const withDays = (days) => days.reduce((s, t) => finishLesson(s, `l${t}`, { xp: 10, accuracy: 100, now: t }), emptyLearn());
  it('опыт: 2 за верный ответ с первой попытки и 5 за окончание; повтор пройденного — десятая часть', () => {
    expect(lessonXp({ firstTry: 10, replay: false })).toBe(25);
    expect(lessonXp({ firstTry: 10, replay: true })).toBe(3);
    expect(lessonXp({ firstTry: 0, replay: true })).toBe(1);
    // ответ после подсказки к термину — не ошибка, но 1 опыта вместо 2
    expect(lessonXp({ firstTry: 8, hinted: 2, replay: false })).toBe(23);
  });
  it('серия: один пропуск в неделю замораживается, второй в той же неделе рвёт серию', () => {
    // среда 30 сентября 2026; пропущен понедельник 28-го
    const s = withDays([at(2026, 9, 24), at(2026, 9, 25), at(2026, 9, 26), at(2026, 9, 27), at(2026, 9, 29), at(2026, 9, 30)]);
    expect(streak(s, at(2026, 9, 30))).toMatchObject({ days: 6, today: true, freezesUsed: ['2026-09-28'] });
    // сегодня ещё не занимались — серия не обнуляется
    expect(streak(s, at(2026, 10, 1)).days).toBe(6);
    // второй пропуск в той же неделе
    const t = withDays([at(2026, 9, 27), at(2026, 9, 30)]);
    expect(streak(t, at(2026, 9, 30)).days).toBe(1);
    expect(longestStreak(s)).toBe(6);
    expect(bestWeek(s).xp).toBeGreaterThan(0);
    expect(streak(emptyLearn(), at(2026, 9, 30)).days).toBe(0);
  });
  it('цель дня, «спит» ли талисман, статистика профиля', () => {
    let s = setGoal(emptyLearn(), 2, 5);
    s = finishLesson(s, 'a', { xp: 10, accuracy: 80, now: at(2026, 9, 30) });
    expect(goalToday(s, at(2026, 9, 30))).toEqual({ done: 1, goal: 2 });
    expect(missedYesterday(s, at(2026, 10, 2))).toBe(true);
    expect(missedYesterday(s, at(2026, 10, 1))).toBe(false);
    s = startLesson(startLesson(s));
    s = recordAttempt(s, 'calc', true, 20000); s = recordAttempt(s, 'calc', false, 40000);
    s = quitLesson(s, 'order', 7);
    const st = learnStats(s, at(2026, 9, 30));
    expect(st.types.find((t) => t.kind === 'calc')).toMatchObject({ n: 2, accuracy: 0.5, avgSec: 30 });
    expect(st.completion).toBe(0.5);
    expect(st.quitKinds[0]).toEqual(['order', 1]);
    expect(st.quitPos[0]).toEqual({ index: 7, n: 1 });
    expect(st.weeks[0].days).toBe(1);
  });
  it('в профиле: чистка и симметричное слияние', () => {
    let a = finishLesson(emptyLearn(), 'x', { xp: 7, accuracy: 70, now: at(2026, 9, 30) });
    a = addMistake(a, 'm1', 1); a = addMistake(a, 'm2', 2); a = resolveMistake(a, 'm1');
    const b = setGoal(finishLesson(emptyLearn(), 'y', { xp: 3, accuracy: 100, now: at(2026, 9, 29) }), 3, 10);
    const m = mergeLearn(a, b);
    expect(Object.keys(m.lessons).sort()).toEqual(['x', 'y']);
    expect(m.goal).toBe(3);
    expect(m.mistakes.map((x) => x.id)).toEqual(['m2']);
    expect(mergeLearn(m, m)).toEqual(m);
    expect(mergeLearn(a, b)).toEqual(mergeLearn(b, a));
    expect(normalizeLearn({ goal: 99, xp: { bad: 5, '2026-09-30': -3 }, types: { calc: { n: 2, ok: 9 } } })).toMatchObject({ goal: 1, xp: {}, types: { calc: { n: 2, ok: 2 } } });
    expect(dayOf(at(2026, 9, 30))).toBe('2026-09-30');
  });
});
