/* Путь уроков: у каждого упражнения ровно один верный ответ, неверные варианты уникальны и не
   совпадают с верным, урок укладывается в 3–5 минут, все типы упражнений есть в пилоте. */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  UNITS, UNIT_BY_ID, LESSONS, EXERCISES, pilotUnits, buildLesson, buildUnitCheck, buildPractice, instantiate, check, ready, answerText, estimate, pathState, SECONDS, KIND_LABEL, STEP_PICS,
  GAME_KINDS, LESSON_KIND, LEVELS, levelOf, flashCards, equilibrium, marketAxes, qd, qs, gameOk, freshCopy, retryOf, gameScore, comboOf, GAME_PASS, DIAMOND_HARD,
} from '../course.js';
import { CAST } from '../cast.js';
import { placeOf } from '../../ds-tokens.js';
import { collectMath, collectBlocks } from '../../textbook/markdown.js';
import { CHAPTER_BLOCKS } from '../../textbook/content.js';
import { plainText } from '../../textbook/content.js';
import { seeded } from '../../textbook/variants.js';
import { parseBlocks, ROUND_EFFECTS } from '../../textbook/markdown.js';
import { recordSeen, recordBest, DIAMOND_ACCURACY } from '../../textbook/learn-state.js';
import { runCoins, runKey, COIN } from '../rewards.js';
import { XP, addHinted, clearHinted, emptyLearn, finishLesson, passUnit, lessonXp, streak, longestStreak, bestWeek, recordAttempt, abandonLesson, startLesson, learnStats, normalizeLearn, mergeLearn, addMistake, resolveMistake, dayOf, setGoal, goalToday, missedYesterday } from '../../textbook/learn-state.js';

// Путь идёт по уровням: Начальный (scarcity), Базовый (supply-demand, elasticity), Средний (consumer)
const PATH = ['scarcity', 'supply-demand', 'elasticity', 'consumer'];
const PILOT = 'supply-demand';
const plain = (nodes) => plainText(nodes || []);
const N = 30;

it('на Пути уроками — четыре юнита по уровням: от Начального к Среднему', () => {
  expect(pilotUnits().map((u) => u.id)).toEqual(PATH);
  // юниты идут по уровням; внутри уровня — по порядку глав учебника
  const ranks = UNITS.map((u) => LEVELS.findIndex((l) => l.id === u.level));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(levelOf('scarcity').title).toBe('Начальный');
  expect(levelOf('elasticity').title).toBe('Базовый');
  expect(levelOf('consumer').title).toBe('Средний');
  expect(LEVELS.map((l) => l.title)).toEqual(['Начальный', 'Базовый', 'Средний', 'Продвинутый', 'Профессиональный']);
});

// карта «Дорога по Инфляции»: места идут по порядку Пути, дорога не пересекает себя,
// здания и подписи мест с уроками не наезжают друг на друга
it('карта Пути: дорога без самопересечений, места с уроками не перекрываются', () => {
  const pts = UNITS.map((u) => placeOf(u.id).at);
  const cross = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  for (let i = 0; i + 1 < pts.length; i += 1) {
    for (let j = i + 2; j + 1 < pts.length; j += 1) expect(cross(pts[i], pts[i + 1], pts[j], pts[j + 1]), `${UNITS[i].id}–${UNITS[j].id}`).toBe(false);
  }
  // без резких поворотов «зигзагом» (буквой Z): дорога в каждом месте поворачивает не круче, чем на 130°
  for (let i = 1; i + 1 < pts.length; i += 1) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const v1 = [a[0] - b[0], a[1] - b[1]]; const v2 = [c[0] - b[0], c[1] - b[1]];
    const angle = (Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / Math.hypot(...v1) / Math.hypot(...v2)) * 180) / Math.PI;
    expect(angle, `${UNITS[i].id}: угол дороги`).toBeGreaterThanOrEqual(50);
  }
  const on = pilotUnits().map((u) => ({ id: u.id, ...placeOf(u.id) }));
  for (let i = 0; i < on.length; i += 1) {
    for (let j = i + 1; j < on.length; j += 1) {
      const [a, b] = [on[i], on[j]];
      const [dx, dy] = [Math.abs(a.at[0] - b.at[0]), Math.abs(a.at[1] - b.at[1])];
      // круг здания r=50; подпись — 28px, ~16px на букву
      expect(Math.hypot(dx, dy), `${a.id}/${b.id}: здания`).toBeGreaterThanOrEqual(100);
      const labelsMeet = dx < (a.place.length + b.place.length) * 8 + 8 && dy < 34;
      expect(labelsMeet, `${a.id}/${b.id}: подписи`).toBe(false);
    }
  }
});

// девять исходных видов упражнений — в каждом юните Пути
// «собери цепочку» убрана: порядок слов проверял русский язык, а не экономику
const CORE = ['choice', 'gap', 'tf', 'match', 'sort', 'calc', 'shift', 'news'];
// уроки из шагов: шаг — одна мысль, после каждого — вопрос
const STEPPED = ['intro', 'story', 'listen'];
const stepOk = (c) => {
  const text = plain(c.idea.text);
  return { words: text.split(/\s+/).filter(Boolean).length, sentences: text.split(/[.!?…](?:\s|$)/).filter((x) => x.trim()).length };
};

describe.each(PATH)('юнит %s', (unitId) => {
  const unit = UNIT_BY_ID[unitId];
  const intros = unit.lessons.filter((l) => l.kind === 'intro');
  const stepped = unit.lessons.filter((l) => STEPPED.includes(l.kind));
  const practice = unit.lessons.filter((l) => l.kind === 'practice');
  it('первый урок темы — «Знакомство»; у каждого урока раздел главы для «Подробнее»', () => {
    expect(unit.lessons[0].kind).toBe('intro');
    expect(intros.length).toBeGreaterThanOrEqual(2);
    expect(practice.length).toBeGreaterThanOrEqual(2);
    unit.lessons.forEach((l) => expect(l.section, `${l.id}: раздел главы`).toBeTruthy());
  });
  it('«Знакомство», «История», «Слушай»: экран — одна мысль (1–3 предложения, до 45 слов, график, картинка или герой), после каждого — вопрос', () => {
    stepped.forEach((l) => {
      expect(l.inner.length, l.id).toBeGreaterThanOrEqual(l.kind === 'intro' ? 4 : 3);
      expect(l.inner.filter((c) => !c.diamond).length, l.id).toBeLessThanOrEqual(10);
      expect(l.inner.filter((c) => c.diamond).length, l.id).toBeLessThanOrEqual(3);
      l.inner.forEach((c, i) => {
        const { words, sentences } = stepOk(c);
        expect(words, `${c.idea.id}: ${words} слов`).toBeLessThanOrEqual(45);
        expect(sentences, `${c.idea.id}: ${sentences} предложений`).toBeLessThanOrEqual(3);
        // в истории шаг без героя — рассказчик со своим аватаром (docs/world.md)
        // у «Откройте сами» своя картинка — улица у метро и график, который строит сам ученик
        expect(c.discover || c.idea.chart || STEP_PICS.includes(c.idea.pic) || (l.kind === 'story' && (!c.idea.who || CAST[c.idea.who])), `${c.idea.id}: график, картинка или герой`).toBeTruthy();
        const next = i + 1 < l.inner.length ? l.inner[i + 1].at : l.exercises.length;
        // в истории до вопроса — не больше двух сообщений подряд (реплика героя и слова рассказчика), в остальных — одно
        if (l.kind === 'story') {
          const run = l.inner.filter((d) => d.at === c.at).length;
          expect(run, `${c.idea.id}: подряд без вопроса`).toBeLessThanOrEqual(2);
          if (i + 1 === l.inner.length) expect(l.exercises.length - c.at, `${c.idea.id}: после последнего шага — вопрос`).toBeGreaterThanOrEqual(1);
        // после «Откройте сами» — карточка-идея урока: сначала ученик нашёл сам, потом это назвали
        } else if (c.discover) expect(l.inner[i + 1].idea, `${c.idea.id}: дальше — карточка-идея`).toBe(l.idea);
        else expect(next - c.at, `${c.idea.id}: вопрос сразу после шага`).toBeGreaterThanOrEqual(1);
      });
      expect(l.inner[0].at).toBe(0);
    });
  });
  it('«Практика» — только упражнения, без карточек перед ними', () => {
    practice.forEach((l) => {
      expect(l.inner, l.id).toEqual([]);
      expect(Object.keys(buildLesson(l.id, seeded(1)).cards), l.id).toEqual([]);
    });
  });
  it('все восемь исходных видов упражнений есть хотя бы по разу, «собери цепочку» — нет', () => {
    const kinds = new Set(unit.lessons.flatMap((l) => l.exercises.map((e) => e.kind)));
    CORE.forEach((k) => expect(kinds, k).toContain(k));
    expect(kinds.has('order')).toBe(false);
    expect(kinds.has('chain')).toBe(false);
  });
  it('в практике 10–15 упражнений, повторение — около трети; «Знакомство» — по порядку и без повторения', () => {
    practice.forEach((l) => {
      for (let s = 1; s <= N; s += 1) {
        const { items } = buildLesson(l.id, seeded(s));
        expect(items.length, l.id).toBeGreaterThanOrEqual(10);
        expect(items.length, l.id).toBeLessThanOrEqual(15);
        const rev = items.filter((it) => it.review).length;
        expect(rev / items.length, l.id).toBeGreaterThanOrEqual(0.25);
        expect(rev / items.length, l.id).toBeLessThanOrEqual(0.4);
        expect(items[0].review).toBeFalsy();
        expect(SECONDS[items[0].kind]).toBeLessThanOrEqual(12);
        items.filter((it) => it.review).forEach((it) => expect(EXERCISES[it.id].lesson).not.toBe(l.id));
      }
    });
    stepped.forEach((l) => {
      const { items, cards } = buildLesson(l.id, seeded(3));
      // алмазные шаги и вопросы после них — только на алмазном уровне
      expect(items.map((it) => it.id)).toEqual(l.exercises.filter((e) => !e.diamond).map((e) => e.id));
      expect(items.some((it) => it.review)).toBe(false);
      expect(Object.values(cards).flat().length).toBe(l.inner.filter((c) => !c.diamond).length);
    });
  });
  it('урок укладывается в 3–5 минут по оценке времени (уроки из шагов — от двух минут, мини-игра — ровно минута)', () => {
    unit.lessons.forEach((l) => {
      for (let s = 1; s <= N; s += 1) {
        const { seconds } = buildLesson(l.id, seeded(s));
        if (l.kind === 'game') { expect(seconds, l.id).toBe(60); continue; }
        expect(seconds, `${l.id}: ${seconds} с`).toBeGreaterThanOrEqual(STEPPED.includes(l.kind) ? 120 : 180);
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
        case 'tiles': {
          expect(inst.solution.length).toBeGreaterThanOrEqual(3);
          expect(check(inst, inst.solution).ok).toBe(true);
          expect(check(inst, [...inst.solution].reverse()).ok).toBe(false);
          expect(check(inst, inst.solution.slice(0, -1)).ok).toBe(false);
          // лишние плитки не дают собрать второе определение: у них нет общих слов с верным
          const words = (list) => new Set(list.flatMap((k) => inst.tiles.find((t) => t.key === k).text.toLowerCase().split(/[\s,]+/).filter(Boolean)));
          const own = words(inst.solution);
          [...words(inst.tiles.filter((t) => !inst.solution.includes(t.key)).map((t) => t.key))].forEach((w) => expect(own.has(w), `${ex.id}: «${w}»`).toBe(false));
          break;
        }
        case 'curve': {
          const [c, d] = inst.answer;
          if (inst.only) expect(c).toBe(inst.only);
          const other = c === 'D' ? 'S' : 'D';
          expect(check(inst, { [c]: d === '+' ? 10 : -10, [other]: 0 }).ok).toBe(true);
          expect(check(inst, { [c]: d === '+' ? -10 : 10 }).ok).toBe(false);
          expect(check(inst, { [c]: d === '+' ? 10 : -10, [other]: 10 }).ok, 'сдвинуть можно только одну кривую').toBe(false);
          inst.traps.forEach((t) => { expect(t.key).not.toBe(inst.answer); expect(check(inst, { [t.key[0]]: t.key[1] === '+' ? 10 : -10 }).why).toBeTruthy(); });
          break;
        }
        case 'price': {
          const ax = marketAxes(inst.market);
          expect(Number.isInteger(inst.answer), `${ex.id}: цена — целое деление ползунка`).toBe(true);
          expect(inst.answer).toBeGreaterThan(0); expect(inst.answer).toBeLessThan(ax.pMax);
          expect(inst.start).not.toBe(inst.answer);
          expect(qd(inst.market, inst.answer)).toBeCloseTo(qs(inst.market, inst.answer));
          expect(check(inst, inst.answer).ok).toBe(true);
          [inst.answer - 1, inst.answer + 1].forEach((p) => { const r = check(inst, p); expect(r.ok).toBe(false); expect(plain(r.why)).toMatch(p < inst.answer ? /дефицит/ : /избыток/); });
          break;
        }
        case 'point': {
          const ax = marketAxes(inst.market);
          expect(inst.answer.q).toBeGreaterThan(0); expect(inst.answer.q).toBeLessThan(ax.qMax);
          expect(inst.answer.p).toBeGreaterThan(0); expect(inst.answer.p).toBeLessThan(ax.pMax);
          expect(check(inst, inst.answer).ok).toBe(true);
          // старое равновесие (до сдвига) — не ответ
          const old = equilibrium({ ...inst.market, dA: 0, dC: 0 });
          if (inst.market.dA || inst.market.dC) expect(check(inst, old).ok, `${ex.id}: старое равновесие засчиталось`).toBe(false);
          expect(check(inst, { q: 0, p: 0 }).ok).toBe(false);
          break;
        }
        case 'swipe': case 'rush': {
          const sides = Object.keys(inst.labels);
          inst.items.forEach((it) => expect(sides).toContain(it.side));
          sides.forEach((sd) => expect(inst.items.some((it) => it.side === sd), `${ex.id}: нет карточек «${sd}»`).toBe(true));
          expect(new Set(inst.items.map((x) => x.raw)).size).toBe(inst.items.length);
          // карточек хватает, чтобы колода не повторялась каждые несколько секунд
          expect(inst.items.length, ex.id).toBeGreaterThanOrEqual(12);
          expect(check(inst, { right: GAME_PASS, answered: GAME_PASS, done: true }).ok).toBe(true);
          expect(check(inst, { right: GAME_PASS - 1, answered: GAME_PASS - 1, done: true }).ok, 'меньше восьми верных').toBe(false);
          expect(check(inst, { right: GAME_PASS, answered: 12, done: true }).ok, 'точность ниже 70%').toBe(false);
          expect(check(inst, { right: 10, answered: 10 }).ok, 'игра не окончена').toBe(false);
          break;
        }
        case 'open': {
          // открытый вопрос: короткая отписка не принимается, продуманный ответ — засчитан; разбор есть всегда
          expect(ready(inst, 'да')).toBe(false);
          expect(check(inst, 'Я бы ввёл студенческую карту, потому что…').ok).toBe(true);
          expect(inst.explain && inst.explain.length).toBeTruthy();
          break;
        }
        case 'domino': {
          // 4–5 звеньев, 7–8 карточек; засчитано, только если цепочка собрана без падений
          expect(inst.chain.length).toBeGreaterThanOrEqual(4); expect(inst.chain.length).toBeLessThanOrEqual(5);
          expect(inst.deck.length).toBeGreaterThanOrEqual(7); expect(inst.deck.length).toBeLessThanOrEqual(8);
          expect(new Set(inst.deck.map((c) => c.raw)).size, `${ex.id}: карточки не повторяются`).toBe(inst.deck.length);
          inst.deck.filter((c) => c.link == null).forEach((c) => expect(plain(c.why).length, `${ex.id}: «${c.raw}» без объяснения`).toBeGreaterThan(20));
          expect(ready(inst, { placed: inst.chain.slice(0, -1), falls: [], done: false })).toBe(false);
          expect(check(inst, { placed: inst.chain, falls: [], done: true }).ok).toBe(true);
          expect(check(inst, { placed: inst.chain, falls: [{ key: 'f0', at: 1 }], done: true }).ok).toBe(false);
          // сцена: звенья со сдвигом кривой — те, что про кривую; цепочка про новость газеты
          inst.deck.filter((c) => c.link != null).forEach((c) => c.effects.filter((e) => /^[DS][+-]$/.test(e)).forEach((e) => expect(c.raw, `${ex.id}: ${e}`).toMatch(e[0] === 'D' ? /спрос/i : /предложени/i)));
          expect(inst.headline).toMatch(/^[^a-zа-яё]*$/);
          break;
        }
        default: throw new Error(inst.kind);
      }
      expect(answerText(inst).length).toBeGreaterThan(0);
    }
  });
  it('ready: «Проверить» доступна, только когда ответ собран целиком', () => {
    const m = instantiate(Object.values(EXERCISES).find((e) => e.kind === 'match'), seeded(3));
    expect(ready(m, { [m.left[0].key]: m.right[0].key })).toBe(false);
    expect(ready(m, Object.fromEntries(m.left.map((l) => [l.key, l.key])))).toBe(true);
  });
});

describe('расчёт: рядом с полем — единица измерения из разметки главы', () => {
  const ids = new Set([...UNITS.map((u) => u.id), ...LESSONS.map((l) => l.id)]);
  const blockOf = (unitId, id) => collectBlocks(CHAPTER_BLOCKS[unitId], (b) => b.type === 'ex' && b.id === id)[0];
  it.each(pilotUnits().flatMap((u) => u.lessons.flatMap((l) => l.exercises.filter((e) => e.kind === 'calc').map((e) => [`${l.id} / ${e.id}`, u.id, e.id]))))('%s', (_, unitId, id) => {
    for (let s = 1; s <= 5; s += 1) {
      const inst = instantiate(EXERCISES[id], seeded(s));
      expect(typeof inst.unit).toBe('string');
      expect(ids.has(inst.unit), `«${inst.unit}» — идентификатор юнита или урока`).toBe(false);
      expect(/^[a-z_-]+$/i.test(inst.unit), `«${inst.unit}» — латиница`).toBe(false);
      // написанное руками — ровно то, что в разметке главы (unit=…)
      const b = blockOf(unitId, id);
      if (b && !b.variant) expect(inst.unit).toBe(b.unit);
      expect(inst.unitId).toBe(unitId);
    }
  });
});

describe.each(PATH)('юнит %s: полноценный — все восемь видов уроков', (unitId) => {
  const unit = UNIT_BY_ID[unitId];
  const of = (kind) => unit.lessons.filter((l) => l.kind === kind);
  it('есть «Знакомство», «Практика», «Слова», «История», «Слушай», «Мини-игра», «Повторение» и «Итоги»; «Итоги» — последний урок', () => {
    Object.keys(LESSON_KIND).forEach((k) => expect(of(k).length, `${unitId}: ${k}`).toBeGreaterThanOrEqual(1));
    expect(unit.lessons[unit.lessons.length - 1].kind).toBe('summary');
    expect(unit.lessons[unit.lessons.length - 2].kind).toBe('review');
  });
  it('«Слова»: восемь слов, три плитки, пары на время; «Мини-игра»: одна игра с графиком; «История» — голосами героев', () => {
    const [w] = of('words');
    expect(w.terms.length).toBe(8);
    const { items } = buildLesson(w.id, seeded(2));
    expect(items.filter((i) => i.kind === 'tiles').length).toBe(3);
    expect(items.filter((i) => i.kind === 'match').length).toBe(2);
    const [g] = of('game');
    const game = buildLesson(g.id, seeded(4)).items;
    expect(game.length).toBe(1);
    expect(GAME_KINDS).toContain(game[0].kind);
    expect(game[0].chart).toBeTruthy();
    game[0].items.forEach((it) => expect(it.effect, it.raw).toBeTruthy());
    const [st] = of('story');
    // шаг без героя — голос рассказчика; первый шаг — герой, героев не меньше трёх
    st.inner.forEach((c) => expect(!c.idea.who || CAST[c.idea.who], c.idea.id).toBeTruthy());
    expect(CAST[st.idea.who]).toBeTruthy();
    expect(new Set(st.inner.map((c) => c.idea.who).filter(Boolean)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('повтор без зубрёжки: вернувшаяся задача — новые числа или похожий вопрос', () => {
  it('расчёт по варианту возвращается с новыми числами', () => {
    const v = Object.values(EXERCISES).find((e) => e.variant);
    const a = freshCopy(v, seeded(1)); const b = freshCopy(v, seeded(2));
    expect(a.fresh).toBe('numbers');
    expect(a.of).toBe(v.id);
    expect(JSON.stringify(a.prompt)).not.toBe(JSON.stringify(b.prompt));
  });
  it('автоупражнение из задачи с параллельным вариантом — расчётом с новыми числами', () => {
    const auto = Object.values(EXERCISES).find((e) => e.source && freshCopy(e, seeded(1)).fresh === 'numbers');
    expect(auto).toBeTruthy();
    expect(freshCopy(auto, seeded(1)).kind).toBe('calc');
  });
  it('шаг «Знакомства» с несколькими вопросами или урок с вопросами того же вида дают похожий вопрос; повтор в уроке — не та же задача, где есть замена', () => {
    let fresh = 0; let total = 0;
    PATH.forEach((id) => UNIT_BY_ID[id].lessons.filter((l) => l.kind === 'practice').forEach((l) => {
      const { items } = buildLesson(l.id, seeded(3));
      items.filter((it) => !it.review).forEach((it) => {
        const r = retryOf(it, seeded(5), items.map((x) => x.of || x.id));
        total += 1;
        if (r.fresh !== 'same') { fresh += 1; expect(r.of).toBe(it.of || it.id); expect(items.map((x) => x.id)).not.toContain(r.fresh === 'sibling' ? r.id : '—'); }
      });
    }));
    // в «Практиках» почти всегда есть чем заменить
    expect(fresh / total).toBeGreaterThan(0.8);
  });
});

describe('юнит «Спрос и предложение»: все виды уроков', () => {
  const unit = UNIT_BY_ID[PILOT];
  const of = (kind) => unit.lessons.filter((l) => l.kind === kind);
  it('два «Знакомства», две «Практики», «Слова», «История», «Слушай», «Мини-игра», «Повторение», «Итоги» — в порядке Пути', () => {
    expect(unit.lessons.map((l) => l.kind)).toEqual(['intro', 'practice', 'words', 'intro', 'practice', 'story', 'listen', 'game', 'review', 'summary']);
    unit.lessons.forEach((l) => expect(LESSON_KIND[l.kind]).toBeTruthy());
  });
  it('все виды упражнений есть в двух юнитах вместе (мини-игра «смахни» — в юните 1, «60 секунд» — здесь)', () => {
    const kinds = new Set(PATH.flatMap((id) => UNIT_BY_ID[id].lessons.flatMap((l) => l.exercises.map((e) => e.kind))));
    Object.keys(KIND_LABEL).forEach((k) => expect(kinds, k).toContain(k));
  });
  it('«Слова»: карточка на каждое слово, потом плитки, пары на время и «какой это термин?»', () => {
    const [w] = of('words');
    const { items, cards } = buildLesson(w.id, seeded(2));
    expect(Object.values(cards)[0]).toEqual(flashCards(w));
    expect(flashCards(w).length).toBe(w.terms.length);
    expect(items.filter((i) => i.kind === 'tiles').length).toBe(3);
    const pairs = items.filter((i) => i.kind === 'match');
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    pairs.forEach((m) => expect(m.timer).toBeGreaterThan(0));
    expect(items.filter((i) => i.kind === 'choice').length).toBeGreaterThanOrEqual(3);
  });
  it('«История»: шаги ведут герои — Маша из кофейни, Гриша из пекарни и Вера Павловна из министерства', () => {
    const [st] = of('story');
    const who = st.inner.map((c) => c.idea.who).filter(Boolean);
    who.forEach((x) => expect(CAST[x], x).toBeTruthy());
    // по библии мира: Маша, Гриша, Вера Павловна и Тимур — глаза ученика; авторский текст — рассказчик
    expect(new Set(who)).toEqual(new Set(['masha', 'grisha', 'vera', 'timur']));
    expect(st.inner.some((c) => !c.idea.who)).toBe(true);
    // в конце — открытый вопрос «Как бы вы поступили…?» с разбором
    expect(st.exercises[st.exercises.length - 1].kind).toBe('open');
    // в истории — новые взаимодействия: цена ползунком, точка равновесия и кривая пальцем
    expect(st.exercises.map((e) => e.kind)).toEqual(expect.arrayContaining(['price', 'point', 'curve']));
  });
  it('«Мини-игра»: одна игра на минуту, рынок с кривыми; не возвращается как ошибка', () => {
    const [g] = of('game');
    const { items } = buildLesson(g.id, seeded(4));
    expect(items.map((i) => i.kind)).toEqual(['rush']);
    const rush = items[0];
    expect(rush.noRetry).toBe(true);
    expect(rush.seconds).toBe(60);
    expect(rush.chart).toBe('market');
    expect(gameOk(rush, { right: 8, answered: 11, done: true })).toBe(true);
    expect(gameOk(rush, { right: 7, answered: 7, done: true }), 'меньше восьми верных').toBe(false);
  });
  it('«Повторение»: ошибки юнита первыми, раундов игр нет, 12–15 упражнений из прошлых уроков', () => {
    const [r] = of('review');
    const wrong = 'sd-e2-petrol';
    for (let s = 1; s <= N; s += 1) {
      const { items } = buildLesson(r.id, seeded(s), { mistakes: [wrong] });
      expect(items.length).toBeGreaterThanOrEqual(12);
      expect(items.length).toBeLessThanOrEqual(15);
      // ошибка возвращается, но не той же задачей: похожей или с новыми числами
      const back = items.find((i) => (i.of || i.id) === wrong);
      expect(back).toBeTruthy();
      expect(back.fresh).not.toBe('same');
      items.forEach((i) => { expect(GAME_KINDS).not.toContain(i.kind); expect(UNIT_BY_ID[PILOT].lessons.find((l) => l.id === EXERCISES[i.of || i.id].lesson).no).toBeLessThan(r.no); });
    }
  });
  it('«Итоги юнита»: 5–7 пунктов с картинкой или графиком, потом тест — десять упражнений без игр', () => {
    const [sum] = of('summary');
    expect(sum.inner.length).toBeGreaterThanOrEqual(5);
    expect(sum.inner.length).toBeLessThanOrEqual(7);
    sum.inner.forEach((c) => {
      expect(c.at).toBe(0);
      expect(c.idea.chart || STEP_PICS.includes(c.idea.pic), c.idea.id).toBeTruthy();
      expect(stepOk(c).words, c.idea.id).toBeLessThanOrEqual(45);
    });
    const { items, cards } = buildLesson(sum.id, seeded(5));
    expect(items.length).toBe(10);
    expect(cards[items[0].uid].length).toBe(sum.inner.length);
    items.forEach((i) => expect(GAME_KINDS).not.toContain(i.kind));
  });
  it('проверка юнита и практика ошибок не берут раунды мини-игр', () => {
    for (let s = 1; s <= N; s += 1) buildUnitCheck(PILOT, seeded(s)).items.forEach((i) => expect(GAME_KINDS).not.toContain(i.kind));
    expect(buildPractice(['sd-g-market', 'sd-e2-petrol']).items.map((i) => i.of || i.id)).toEqual(['sd-e2-petrol']);
  });
});

describe('проверка юнита, практика, состояние пути', () => {
  it('проверка юнита: 10 упражнений, в том числе расчёты с новыми числами', () => {
    PATH.forEach((id) => {
      expect(buildUnitCheck(id, seeded(3)).items.length, id).toBe(10);
    });
    const a = buildUnitCheck(PILOT, seeded(1)); const b = buildUnitCheck(PILOT, seeded(2));
    expect(a.items.length).toBe(10);
    expect(a.items.some((it) => it.variant)).toBe(true);
    const va = a.items.filter((it) => it.variant).map((it) => it.answer).join(); const vb = b.items.filter((it) => it.variant).map((it) => it.answer).join();
    expect(va).not.toBe(vb);
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
    // проверка первого юнита открывает все его уроки и первый урок второго, но не засчитывает их
    learn = passUnit(learn, PATH[0], { now: 1e12 });
    [st, st2] = pathState(learn);
    expect(st.complete).toBe(false);
    expect(st.tested).toBe(true);
    expect(st.lessons.every((l) => l.open)).toBe(true);
    expect(st.lessons.filter((l) => l.done)).toHaveLength(1);
    expect(st2.lessons.map((l) => l.open)).toEqual(st2.lessons.map((_, i) => i === 0));
    // старые записи вступительного теста (runs: 0) — открыто, но не пройдено
    const legacy = { ...emptyLearn(), lessons: { [st.lessons[3].id]: { at: 1, runs: 0, best: 0 } } };
    expect(pathState(legacy)[0].lessons[3].done).toBe(false);
    // пройденный урок остаётся открытым для повтора
    const only = finishLesson(emptyLearn(), st2.lessons[2].id, { xp: 1, accuracy: 100, now: 1e12 });
    expect(pathState(only)[1].lessons[2].open).toBe(true);
  });
  it('практика собирается из ошибок', () => {
    const ids = Object.keys(EXERCISES).slice(0, 5);
    expect(buildPractice(ids, seeded(1)).items.map((it) => it.of || it.id).sort()).toEqual(ids.sort());
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
    // подсказка ничем не наказывается: опыт за ответ после неё — тот же
    expect(lessonXp({ firstTry: 10, hinted: 2, replay: false })).toBe(25);
    expect(XP.hinted).toBeUndefined();
  });
  it('подсказка: упражнение невидимо уходит в «Повторение» раньше остальных, решённое без неё — снимается', () => {
    let s = addHinted(emptyLearn(), 'sd-e2-gap', 5);
    expect(s.hinted).toEqual([{ id: 'sd-e2-gap', at: 5 }]);
    expect(normalizeLearn(s).hinted).toEqual(s.hinted);
    expect(mergeLearn(s, addHinted(emptyLearn(), 'sd-e2-gap', 9)).hinted).toEqual([{ id: 'sd-e2-gap', at: 9 }]);
    const rev = UNIT_BY_ID[PILOT].lessons.find((l) => l.kind === 'review');
    for (let k = 1; k <= N; k += 1) {
      const { items } = buildLesson(rev.id, seeded(k), { mistakes: ['sd-e2-petrol'], hinted: ['sd-e2-gap'] });
      const ids = items.map((i) => i.of || i.id);
      expect(ids).toContain('sd-e2-petrol');
      expect(ids).toContain('sd-e2-gap');
    }
    s = clearHinted(s, 'sd-e2-gap');
    expect(s.hinted).toEqual([]);
    expect(clearHinted(s, 'нет-такого')).toBe(s);
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
    // цель дня — минуты занятий (10 по умолчанию), уроки — для подписи
    let s = finishLesson(emptyLearn(), 'a', { xp: 10, accuracy: 80, now: at(2026, 9, 30), seconds: 330 });
    expect(goalToday(s, at(2026, 9, 30))).toEqual({ done: 5, goal: 10, lessons: 1 });
    expect(goalToday(setGoal(s, 2, 5), at(2026, 9, 30)).goal).toBe(10);
    // урок, начатый до полуночи: в новый день идут только минуты после полуночи
    const night = finishLesson(emptyLearn(), 'b', { xp: 10, accuracy: 80, now: new Date(2026, 9, 1, 0, 2).getTime(), seconds: 900 });
    expect(goalToday(night, new Date(2026, 9, 1, 0, 2).getTime()).done).toBe(2);
    expect(missedYesterday(s, at(2026, 10, 2))).toBe(true);
    expect(missedYesterday(s, at(2026, 10, 1))).toBe(false);
    s = startLesson(startLesson(s));
    s = recordAttempt(s, 'calc', true, 20000); s = recordAttempt(s, 'calc', false, 40000);
    // начатый, но ещё не брошенный урок (его можно продолжить) долю доведённых не портит
    expect(learnStats(s, at(2026, 9, 30)).completion).toBe(1);
    s = abandonLesson(s, 'order', 7);
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


/* Мини-игра: эффект карточки — то, что на самом деле происходит с графиком, и он согласован
   с верной стороной: на рынке рост спроса или падение предложения поднимает цену; на КПВ
   сдвиг кривой — «сдвиг», точка по кривой — «движение». */
describe('мини-игра: одна на урок, карточки двигают график', () => {
  const games = Object.values(EXERCISES).filter((e) => GAME_KINDS.includes(e.kind));
  it('в каждом юните Пути — ровно одна игра, на минуту', () => {
    PATH.forEach((id) => {
      const g = UNIT_BY_ID[id].lessons.filter((l) => l.kind === 'game');
      expect(g.length).toBe(1);
      expect(g[0].exercises.length, id).toBe(1);
      expect(g[0].exercises[0].seconds).toBe(60);
    });
  });
  it('эффект карточки согласован с верной стороной', () => {
    const PRICE = { 'D+': 'up', 'D-': 'down', 'S+': 'down', 'S-': 'up' };
    games.forEach((g) => {
      expect(ROUND_EFFECTS[g.chart], g.id).toBeTruthy();
      g.items.forEach((it) => {
        expect(ROUND_EFFECTS[g.chart], `${g.id}: ${it.raw}`).toContain(it.effect);
        if (g.chart === 'market') expect(it.side, `${it.raw}: ${it.effect}`).toBe(PRICE[it.effect]);
        if (g.chart === 'ppf') expect(it.side, `${it.raw}: ${it.effect}`).toBe(['x', 'y'].includes(it.effect) ? 'left' : 'right');
        // бюджет: доход сдвигает линию (влево), цена поворачивает (вправо)
        if (g.chart === 'budget') expect(it.side, `${it.raw}: ${it.effect}`).toBe(['out', 'in'].includes(it.effect) ? 'left' : 'right');
        // эластичность: неэластичный — влево, эластичный — вправо
        if (g.chart === 'elastic') expect(it.side, `${it.raw}: ${it.effect}`).toBe(it.effect === 'in' ? 'left' : 'right');
      });
      // эффект виден на графике: каждая сторона и оба направления встречаются
      const effs = new Set(g.items.map((it) => it.effect));
      expect(effs.size, g.id).toBeGreaterThanOrEqual(Math.min(4, ROUND_EFFECTS[g.chart].length));
    });
  });
  it('очки: 10 за верный ответ, каждые три подряд — множитель выше (не больше ×4), ошибка обнуляет серию', () => {
    expect(comboOf(0)).toBe(1); expect(comboOf(3)).toBe(2); expect(comboOf(6)).toBe(3); expect(comboOf(30)).toBe(4);
    expect(gameScore([true, true, true]).score).toBe(30);
    expect(gameScore([true, true, true, true]).score).toBe(50);
    expect(gameScore([true, true, true, false, true])).toEqual({ score: 40, bestRun: 3 });
  });
  it('разметка: «цепочки» нет ни в упражнениях, ни в играх; эффект без графика — ошибка', () => {
    expect(() => parseBlocks(':::ex order id=x\nА\n1. раз\n2. два\n:::')).toThrow(/Неизвестное упражнение/);
    expect(() => parseBlocks(':::round chain id=x\n1. а\n2. б\n3. в\n:::')).toThrow(/Неизвестный раунд/);
    expect(() => parseBlocks(':::round swipe id=x left=a right=b\n- а >> left out\n- б >> right\n- в >> left\n:::')).toThrow(/эффект/);
    expect(() => parseBlocks(':::round swipe id=x chart=ppf left=a right=b\n- а >> left\n- б >> right out\n- в >> left x\n:::')).toThrow(/нет эффекта/);
    const [g] = parseBlocks(':::round rush id=x chart=market a=100 b=2 c=10 d=2 up=a down=b\n- а >> up D+\n- б >> down S+\n- в >> up S-\n:::');
    expect(g.items.map((i) => i.effect)).toEqual(['D+', 'S+', 'S-']);
    expect(g.market).toMatchObject({ a: 100, b: 2, c: 10, d: 2 });
  });
});

/* Алмазный уровень: пройденный урок — ещё раз, с усложнением. */
describe('алмазный уровень', () => {
  const lessons = PATH.flatMap((id) => UNIT_BY_ID[id].lessons);
  const of = (kind) => lessons.filter((l) => l.kind === kind);
  it('все упражнения помечены diamond; урок — те же 3–5 минут (игра — 45 секунд)', () => {
    lessons.forEach((l) => {
      for (let s = 1; s <= 5; s += 1) {
        const p = buildLesson(l.id, seeded(s), { diamond: true });
        expect(p.diamond, l.id).toBe(true);
        expect(p.items.length, l.id).toBeGreaterThanOrEqual(1);
        p.items.forEach((it) => expect(it.diamond, `${l.id}: ${it.id}`).toBe(true));
        if (l.kind === 'game') { expect(p.seconds).toBe(45); continue; }
        expect(p.seconds, `${l.id}: ${p.seconds} с`).toBeGreaterThanOrEqual(Math.min(180, buildLesson(l.id, seeded(s)).seconds));
        expect(p.seconds, `${l.id}: ${p.seconds} с`).toBeLessThanOrEqual(330);
      }
    });
  });
  it('«Знакомство» с алмазными шагами: шаги и вопросы после них есть только на алмазном уровне', () => {
    const deep = lessons.filter((l) => l.inner.some((c) => c.diamond));
    expect(deep.map((l) => l.id).sort()).toEqual(['cs-i1', 'cs-i2', 'el-i1', 'el-i2', 'sc-i1', 'sc-i2', 'sd-i1', 'sd-i2']);
    deep.forEach((l) => {
      const plainIds = buildLesson(l.id, seeded(1)).items.map((it) => it.id);
      const gemPlan = buildLesson(l.id, seeded(1), { diamond: true });
      const gemIds = gemPlan.items.map((it) => it.id);
      const extra = l.exercises.filter((e) => e.diamond).map((e) => e.id);
      expect(extra.length, l.id).toBeGreaterThanOrEqual(2);
      extra.forEach((id) => { expect(plainIds).not.toContain(id); expect(gemIds).toContain(id); });
      // «Откройте сами» на алмазном повторе не нужен: кривую ученик уже нашёл
      expect(Object.values(gemPlan.cards).flat().length).toBe(l.inner.filter((c) => !c.discover).length);
      // алмазные упражнения не попадают в повторение и проверки тех, кто их не видел
      for (let s = 1; s <= 10; s += 1) {
        buildUnitCheck(l.unitId, seeded(s)).items.forEach((it) => expect(extra).not.toContain(it.of || it.id));
        UNIT_BY_ID[l.unitId].lessons.filter((x) => x.kind === 'review' || x.kind === 'practice').forEach((x) => buildLesson(x.id, seeded(s)).items.forEach((it) => expect(extra).not.toContain(it.of || it.id)));
      }
    });
  });
  it('«Практика»: задачи семинарского и олимпиадного уровня, остальное — с новыми числами, где они есть', () => {
    of('practice').forEach((l) => {
      for (let s = 1; s <= 5; s += 1) {
        const { items } = buildLesson(l.id, seeded(s), { diamond: true });
        const hard = items.filter((it) => it.hard);
        expect(hard.length, l.id).toBeGreaterThanOrEqual(Math.min(DIAMOND_HARD, 2));
      }
    });
  });
  it('«Мини-игра» — 45 секунд; «Слова» — пары на 25 секунд; «Повторение» и «Итоги» — с задачами посложнее', () => {
    of('game').forEach((l) => buildLesson(l.id, seeded(1), { diamond: true }).items.forEach((it) => expect(it.seconds).toBe(45)));
    of('words').forEach((l) => buildLesson(l.id, seeded(1), { diamond: true }).items.filter((it) => it.kind === 'match').forEach((it) => expect(it.timer).toBe(25)));
    [...of('review'), ...of('summary')].forEach((l) => expect(buildLesson(l.id, seeded(2), { diamond: true }).items.filter((it) => it.hard).length, l.id).toBeGreaterThanOrEqual(2));
  });
  it('алмаз урока — от 80% верных на алмазном уровне; сохраняется при слиянии устройств', () => {
    let s = finishLesson(emptyLearn(), 'sd-i1', { xp: 10, accuracy: 100, now: 1e12 });
    expect(s.lessons['sd-i1'].diamond).toBeUndefined();
    s = finishLesson(s, 'sd-i1', { xp: 10, accuracy: DIAMOND_ACCURACY - 1, now: 2e12, diamond: true });
    expect(s.lessons['sd-i1'].diamond).toBeUndefined();
    s = finishLesson(s, 'sd-i1', { xp: 10, accuracy: DIAMOND_ACCURACY, now: 3e12, diamond: true });
    expect(s.lessons['sd-i1'].diamond).toBe(3e12);
    // простой повтор алмаз не снимает
    s = finishLesson(s, 'sd-i1', { xp: 1, accuracy: 50, now: 4e12 });
    expect(s.lessons['sd-i1'].diamond).toBe(3e12);
    expect(normalizeLearn(s).lessons['sd-i1'].diamond).toBe(3e12);
    const other = finishLesson(emptyLearn(), 'sd-i1', { xp: 10, accuracy: 100, now: 5e12 });
    expect(mergeLearn(s, other).lessons['sd-i1'].diamond).toBe(3e12);
    expect(mergeLearn(other, s)).toEqual(mergeLearn(s, other));
    expect(pathState(s)[1].lessons.find((l) => l.id === 'sd-i1').diamond).toBe(true);
  });
  it('награда: опыт ×1,5; монеты — 25 за первый алмаз (+10 без ошибок), потом по 5; ниже 80% — ничего', () => {
    expect(lessonXp({ firstTry: 10, replay: true, diamond: true })).toBe(Math.round((10 * XP.correct + XP.finish) * 1.5));
    expect(runCoins({ mode: 'lesson', diamond: true, accuracy: 90 })).toBe(COIN.diamond);
    expect(runCoins({ mode: 'lesson', diamond: true, accuracy: 100 })).toBe(COIN.diamond + COIN.diamondPerfect);
    expect(runCoins({ mode: 'lesson', diamond: true, gem: true, accuracy: 100 })).toBe(COIN.diamondReplay);
    expect(runCoins({ mode: 'lesson', diamond: true, accuracy: 70 })).toBe(0);
    expect(runKey({ mode: 'lesson', lessonId: 'x', replay: true, diamond: true, gem: false })).toBe('d:x');
    expect(runKey({ mode: 'lesson', lessonId: 'x', replay: true, diamond: true, gem: true })).toBe(null);
    expect(runKey({ mode: 'lesson', lessonId: 'x', replay: false })).toBe('l:x');
  });
});

/* Меньше повторов: упражнение, которое ученик уже видел, идёт в повторение и проверки позже
   тех, что он видел реже. */
describe('меньше повторов в юните', () => {
  it('seen: счётчик встреч, слияние — по максимуму; рекорды игр — лучший счёт', () => {
    let s = recordSeen(recordSeen(emptyLearn(), 'sd-e2-petrol'), 'sd-e2-petrol');
    expect(s.seen['sd-e2-petrol']).toBe(2);
    const t = recordSeen(emptyLearn(), 'sd-e2-petrol');
    expect(mergeLearn(s, t).seen['sd-e2-petrol']).toBe(2);
    expect(normalizeLearn({ seen: { ok: 3, bad: -1, '': 2 } }).seen).toEqual({ ok: 3 });
    s = recordBest(recordBest(s, 'sd-g-market', 120), 'sd-g-market', 90);
    expect(s.best['sd-g-market']).toBe(120);
    expect(mergeLearn(s, emptyLearn()).best['sd-g-market']).toBe(120);
  });
  it('«Повторение» берёт сначала невиденное: виденные много раз уходят в конец', () => {
    const [r] = UNIT_BY_ID[PILOT].lessons.filter((l) => l.kind === 'review');
    const pool = UNIT_BY_ID[PILOT].lessons.filter((l) => l.no < r.no).flatMap((l) => l.exercises).filter((e) => !GAME_KINDS.includes(e.kind) && !e.diamond && !e.variant && !e.source);
    // половину пула ученик видел по три раза
    const seen = Object.fromEntries(pool.filter((_, k) => k % 2 === 0).map((e) => [e.id, 3]));
    for (let s = 1; s <= 10; s += 1) {
      const { items } = buildLesson(r.id, seeded(s), { seen });
      const ids = items.map((it) => it.of || it.id).filter((id) => pool.some((e) => e.id === id));
      const fresh = ids.filter((id) => !seen[id]).length;
      // невиденных хватает на весь урок — виденных трижды в нём почти нет
      expect(fresh / ids.length).toBeGreaterThanOrEqual(0.8);
    }
  });
  it('повторение в «Практике» и проверка юнита тоже предпочитают невиденное', () => {
    const l = UNIT_BY_ID[PILOT].lessons.filter((x) => x.kind === 'practice').slice(-1)[0];
    const prev = UNIT_BY_ID[PILOT].lessons.filter((x) => x.no < l.no).flatMap((x) => x.exercises).filter((e) => !GAME_KINDS.includes(e.kind) && !e.diamond && !e.variant && !e.source);
    const seen = Object.fromEntries(prev.slice(0, Math.floor(prev.length * 0.6)).map((e) => [e.id, 5]));
    for (let s = 1; s <= 10; s += 1) {
      const rev = buildLesson(l.id, seeded(s), { seen }).items.filter((it) => it.review && prev.some((e) => e.id === (it.of || it.id)));
      rev.forEach((it) => expect(seen[it.of || it.id], it.id).toBeUndefined());
      const chk = buildUnitCheck(PILOT, seeded(s), { seen }).items.filter((it) => !it.variant);
      expect(chk.filter((it) => seen[it.id]).length).toBeLessThanOrEqual(2);
    }
  });
});

/* «Слушай»: вопрос не пересказывает эфир; вне эфира (повторение, практика, проверка) перед
   условием встаёт то, что прозвучало, — иначе вопрос «что эта новость сделает?» без смысла. */
describe('«Слушай»: вопрос без пересказа, вне эфира — с контекстом', () => {
  const listen = PATH.flatMap((id) => UNIT_BY_ID[id].lessons.filter((l) => l.kind === 'listen'));
  it('в радиоуроке условие — без контекста; в повторении — с ним', () => {
    listen.forEach((l) => l.exercises.filter((e) => e.context).forEach((e) => {
      const air = instantiate(EXERCISES[e.id], seeded(1));
      expect(JSON.stringify(air.prompt)).not.toContain(JSON.stringify(e.context).slice(1, -1));
      const out = instantiate(EXERCISES[e.id], seeded(1), { review: true });
      expect(out.prompt[0]).toEqual({ type: 'p', inline: e.context });
    }));
  });
  it('у вопросов «Слушай», которые без эфира непонятны, есть context', () => {
    listen.forEach((l) => l.exercises.filter((e) => !e.diamond).forEach((e) => {
      const p = plain(e.prompt);
      if (/эт(а|у|ой|и) новост|по итогам|ведущ|слушател|Аня|Ане/.test(p)) expect(e.context, `${e.id}: «${p}»`).toBeTruthy();
    }));
  });
});

/* Связность: урок не спрашивает того, чему ещё не учил. Ни в обычном прохождении, ни сильному
   ученику, ни на алмазном уровне, ни в повторе после ошибки в урок не попадает задача из
   урока дальше по Пути или задача семинарского уровня на тему, которой ещё не было. */
describe('последовательность уроков: задачи только из пройденного', () => {
  PATH.forEach((unitId) => {
    const unit = UNIT_BY_ID[unitId];
    it(`${unitId}: в каждом уроке — только свои задачи, задачи прошлых уроков и усложнения на их темы`, () => {
      const problems = [];
      unit.lessons.forEach((l) => {
        if (l.kind === 'review' || l.kind === 'summary') return;
        const before = unit.lessons.filter((x) => x.no <= l.no);
        const known = new Set(before.flatMap((x) => x.exercises.map((e) => e.id)));
        const hard = new Set(before.flatMap((x) => x.hard));
        const ok = (id) => known.has(id) || hard.has(id) || (id.startsWith('auto:') && hard.has(id.slice(5)));
        const look = (it, how) => {
          const id = it.of || it.id;
          if (ok(id)) return;
          const src = EXERCISES[id];
          if (src ? src.unitId !== unitId || UNIT_BY_ID[unitId].lessons.find((x) => x.id === src.lesson).no > l.no : !ok(id)) problems.push(`${l.id} (${how}): ${id}`);
        };
        for (let s = 1; s <= 8; s += 1) {
          [['обычно', {}], ['сильному', { level: 'hard' }], ['алмаз', { diamond: true }]].forEach(([how, opts]) => {
            const { items } = buildLesson(l.id, seeded(s * 31 + 7), opts);
            items.forEach((it) => {
              look(it, how);
              if (!GAME_KINDS.includes(it.kind)) look(retryOf(it, seeded(s), items.map((x) => x.of || x.id)), `${how}, повтор`);
            });
          });
        }
      });
      expect([...new Set(problems)]).toEqual([]);
    });
  });
  it('у каждой «Практики» есть усложнения на уже пройденные темы', () => {
    PATH.forEach((unitId) => UNIT_BY_ID[unitId].lessons.filter((l) => l.kind === 'practice').forEach((l) => {
      const hard = UNIT_BY_ID[unitId].lessons.filter((x) => x.no <= l.no).flatMap((x) => x.hard);
      expect(hard.length, l.id).toBeGreaterThanOrEqual(2);
    }));
  });
});

describe('«История» вне урока', () => {
  it('во вступительном тесте, проверке и повторении перед вопросом «Истории» — шаг, после которого он шёл', () => {
    PATH.forEach((id) => UNIT_BY_ID[id].lessons.filter((l) => l.kind === 'story').forEach((l) => l.exercises.forEach((e, k) => {
      const step = l.inner.filter((c) => c.at <= k).pop();
      expect(e.context, e.id).toEqual(step.idea.text);
      const out = instantiate(EXERCISES[e.id], seeded(1), { check: true });
      expect(out.prompt[0], e.id).toEqual({ type: 'p', inline: step.idea.text });
      // в самом уроке шаг на экране — условие без повтора
      expect(instantiate(EXERCISES[e.id], seeded(1)).prompt[0]).not.toEqual({ type: 'p', inline: step.idea.text });
    })));
  });
});
