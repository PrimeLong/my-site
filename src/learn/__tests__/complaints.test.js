// Исправленные жалобы учеников: каждая — проверка, чтобы ошибка не вернулась
import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../../textbook/markdown.js';
import { EXERCISES, LESSONS } from '../course.js';
import { makeVariant } from '../../textbook/variants.js';

// все строки-тексты разобранного узла: формулы ($…$) в них уже вынесены в узлы math
const texts = (x, out = []) => {
  if (Array.isArray(x)) x.forEach((n) => texts(n, out));
  else if (x && typeof x === 'object') { if (x.t === 'text') out.push(x.v); Object.entries(x).forEach(([k, v]) => { if (k !== 'raw' && typeof v === 'object') texts(v, out); }); }
  return out;
};

describe('жалобы', () => {
  it('«|» внутри формулы варианта — модуль, а не разделитель объяснения (el-q1-type)', () => {
    const [ex] = parseBlocks(':::ex choice id=t\nВопрос?\n+ Неэластичный: $|E| = 0{,}3 < 1$\n- Эластичный | Потому что $3/10$\n:::');
    expect(ex.options[0].text.find((n) => n.t === 'math').v).toBe('|E| = 0{,}3 < 1');
    expect(ex.options[0].why).toBe(null);
    expect(ex.options[1].why.length).toBeGreaterThan(0);
  });
  it('ни в одном упражнении Пути нет сырых долларов в тексте', () => {
    const bad = Object.values(EXERCISES).filter((e) => texts([e.prompt, e.options, e.explain]).some((s) => s.includes('$'))).map((e) => e.id);
    expect(bad).toEqual([]);
  });
  it('у эластичности на карточке «Слов» — пример, а в плитках его нет', () => {
    const l = LESSONS.find((x) => x.id === 'el-w');
    const t = l.terms.find((x) => x.term === 'elasticity');
    expect(t.example).toMatch(/2%/);
    expect(t.text).not.toMatch(/\|/);
  });
  it('разбор дуговой эластичности — по шагам со средними (v-el-arc)', () => {
    const v = makeVariant('v-el-arc', 3);
    const s = JSON.stringify(v.solution);
    expect(s).toMatch(/Средняя цена/);
    expect(s).toMatch(/среднее количество/);
  });
  it('в КПВ-варианте корни извлекаются из небольших чисел (v-sc-ppf)', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const v = makeVariant('v-sc-ppf', seed);
      const R2 = Number(JSON.stringify(v.statement).match(/Y\^2 = (\d+)/)[1]);
      expect(R2).toBeLessThanOrEqual(900);
    }
  });
});

describe('текст жалобы', () => {
  it('flatText не теряет термины и ссылки', async () => {
    const { flatText } = await import('../../learn-report.jsx');
    expect(flatText([{ t: 'text', v: 'это капучино или' }, { t: 'link', kind: 'term', target: 'tea', label: 'чай' }, { t: 'text', v: '?' }])).toBe('это капучино или чай ?');
  });
});
