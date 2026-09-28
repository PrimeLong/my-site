import { describe, it, expect } from 'vitest';
import { pilotUnits, instantiate } from '../course.js';
import { findTerms, markTerms, termsIn, TERM_FORMS, termText } from '../terms.js';
import { GLOSSARY } from '../../textbook/glossary.js';
import { plainText } from '../../textbook/content.js';
import { seeded } from '../../textbook/variants.js';

const txt = (v) => [{ t: 'text', v }];
// всё, что ученик видит в упражнении до ответа: условие, варианты, карточки, пары, корзины
const shown = (e) => [e.prompt, ...(e.options || []).map((o) => o.text), ...(e.items || []).map((i) => i.text), ...(e.left || []).map((x) => x.text),
  ...(e.right || []).map((x) => x.text), e.headline ? txt(e.headline) : null, ...(e.vars || []).map((v) => txt(v.label)), ...(e.bins || []).map((b) => txt(b))];
// экземпляры упражнения с разными числами (у расчёта по варианту условие каждый раз новое)
const samples = (e) => (e.variant ? Array.from({ length: 8 }, (_, k) => instantiate(e, seeded(k + 1))) : [instantiate(e, seeded(1))]);

describe('термины: формы слов', () => {
  it('находит термины в разных падежах и не цепляет части слов', () => {
    expect(findTerms('Часть покупок уходит к заменителям').map((f) => f.id)).toEqual(['substitute']);
    expect(findTerms('Эффекта замещения здесь нет, есть эффект дохода').map((f) => f.id)).toEqual(['subeffect', 'incomeeffect']);
    expect(findTerms('альтернативную стоимость вечера').map((f) => f.id)).toEqual(['opportunity']);
    expect(findTerms('точка внутри КПВ').map((f) => f.id)).toEqual(['ppf']);
    expect(findTerms('Спросили у продавца')).toEqual([]);
    expect(findTerms('объём спроса упал').map((f) => f.text)).toEqual(['спроса']);
  });
  it('у каждого термина с формами есть определение в словаре', () => {
    Object.keys(TERM_FORMS).forEach((id) => expect(GLOSSARY[id], id).toBeTruthy());
    Object.keys(TERM_FORMS).forEach((id) => expect(termText(id).length, id).toBeGreaterThan(20));
  });
  it('разметка не теряет текст и не трогает формулы', () => {
    const nodes = [{ t: 'text', v: 'Спрос и предложение: ' }, { t: 'math', v: 'Q_D = a - bP' }, { t: 'b', c: [{ t: 'text', v: ' равновесие' }] }];
    const marked = markTerms(nodes);
    const unmark = (list) => list.map((n) => (n.t === 'term' ? { t: 'text', v: n.v } : n.c ? { ...n, c: unmark(n.c) } : n));
    expect(plainText(unmark(marked))).toBe(plainText(nodes));
    expect(marked.filter((n) => n.t === 'term').map((n) => n.id)).toEqual(['demand', 'supply']);
    expect(marked[marked.length - 1].c.some((n) => n.t === 'term' && n.id === 'equilibrium')).toBe(true);
    expect(marked.find((n) => n.t === 'math')).toEqual(nodes[1]);
  });
});

describe('урок не спрашивает того, чему ещё не учил', () => {
  it('каждый термин упражнения объяснён шагом «Знакомства» раньше — в этом или прошлом уроке', () => {
    const known = new Set();
    const problems = [];
    pilotUnits().forEach((u) => u.lessons.forEach((l) => {
      // объясняют только шаги «Знакомства» (карточка урока — его первый шаг); у «Практики» карточек нет
      l.exercises.forEach((e, k) => {
        l.inner.filter((c) => c.at === k).forEach((c) => termsIn([txt(c.idea.title), c.idea.text]).forEach((t) => known.add(t)));
        samples({ ...e, lesson: l.id, unit: u.id }).forEach((inst) => {
          termsIn(shown(inst)).forEach((t) => { if (!known.has(t)) problems.push(`${l.id} / ${e.id}: «${GLOSSARY[t].title}» ещё не вводили`); });
        });
      });
    }));
    expect([...new Set(problems)]).toEqual([]);
  });
  it('шаги «Знакомства» — до 60 слов и стоят перед упражнением', () => {
    // у «Итогов» пункты идут подряд перед тестом юнита, своих упражнений у урока нет
    pilotUnits().forEach((u) => u.lessons.filter((l) => l.kind !== 'summary').forEach((l) => l.inner.forEach((c) => {
      expect(plainText(c.idea.text).split(/\s+/).filter(Boolean).length, c.idea.id).toBeLessThanOrEqual(60);
      expect(c.at, c.idea.id).toBeLessThan(l.exercises.length);
    })));
  });
  it('подсказки к терминам есть в условии хотя бы половины упражнений каждого урока', () => {
    // у мини-игры — скорость, а не чтение; у «Повторения» и «Итогов» своих упражнений нет
    pilotUnits().forEach((u) => u.lessons.filter((l) => l.exercises.length && l.kind !== 'game').forEach((l) => {
      // подсказки — в условии (по вариантам ответа нажатие означает выбор)
      const withHints = l.exercises.filter((e) => termsIn(instantiate({ ...e, lesson: l.id, unit: u.id }, seeded(1)).prompt).size > 0).length;
      expect(withHints / l.exercises.length, `${l.id}: ${withHints} из ${l.exercises.length}`).toBeGreaterThanOrEqual(0.5);
    }));
  });
});
