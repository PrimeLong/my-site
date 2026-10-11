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

describe('жалобы из выгрузки: «Правильно: …» без TeX-разметки', () => {
  it('формула в верном ответе читается как текст: 0,3 вместо 0{,}3', async () => {
    const { EXERCISES, instantiate, answerText, texPlain } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    expect(answerText(instantiate(EXERCISES['el-q1-type'], seeded(1)))).toBe('Неэластичный: |E| = 0,3 < 1');
    expect(texPlain('\\frac{3}{10} \\cdot 100\\%')).toBe('3/10 · 100%');
    expect(texPlain('\\sqrt{2500} = 50')).toBe('√(2500) = 50');
    expect(texPlain('X^{2} + Y^2')).toBe('X^2 + Y^2');
    // ни в одном верном ответе Пути не остаётся команд и фигурных скобок TeX
    Object.values(EXERCISES).filter((e) => ['choice', 'gap', 'match', 'sort'].includes(e.kind)).forEach((e) => {
      expect(answerText(instantiate(e, seeded(2))), e.id).not.toMatch(/[{}\\$]/);
    });
  });
});

describe('жалобы из выгрузки: тексты и картинки уроков', () => {
  const lesson = (id) => LESSONS.find((x) => x.id === id);
  const step = (lessonId, ideaId) => lesson(lessonId).inner.find((c) => c.idea.id === ideaId);
  it('«Мимо, но рядом» не говорим: ошибка может быть и далеко от ответа (mv06s3na)', async () => {
    const { PHRASES } = await import('../voice.js');
    expect([...PHRASES.wrong, ...PHRASES.wrong2].join(' ')).not.toMatch(/рядом/);
  });
  it('«Сдвиг в числах» показывает новый спрос рядом со старым, пунктирным (mv1y0c7c)', async () => {
    const { CHARTS, chartDefaults } = await import('../../textbook/charts.js');
    const c = step('sd-i1', 'sd-i1-d-shift');
    expect(c.idea.chart).toBe('demand');
    const scene = CHARTS.demand.build(c.idea.attrs, chartDefaults('demand', c.idea.attrs));
    expect(scene.curves.find((x) => x.id === 'D0').ghost).toBe(true);
    expect(scene.curves.find((x) => x.id === 'D').points[0].x).toBe(120);
  });
  it('«Рыночный спрос» — график суммы по горизонтали, с числами задачи про кофе (mv1y1egg)', async () => {
    const { CHARTS, chartDefaults, marketQ } = await import('../../textbook/charts.js');
    const c = step('sd-i1', 'sd-i1-d-market');
    expect(c.idea.chart).toBe('market-demand');
    const scene = CHARTS['market-demand'].build(c.idea.attrs, chartDefaults('market-demand', c.idea.attrs));
    expect(scene.readout.map((r) => r.value)).toEqual(['4 ст.', '6 ст.', '0 ст.', '10 ст.']);
    expect(marketQ(150)).toBe(EXERCISES['sd-d1-market'].answer);
    // излом: выше 120 крон Олег не покупает
    expect(scene.curves.find((x) => x.id === 'D').points.map((p) => p.y)).toEqual([300, 250, 120, 0]);
  });
  it('излишек по одной формуле спроса — обычный шаг до задач урока, верх треугольника — из формулы (muzgnpge)', () => {
    const c = step('mf-i1', 'mf-i1-area');
    expect(c.diamond).toBeUndefined();
    expect(JSON.stringify(c.idea.body || c.idea)).toMatch(/спрос нулевой/);
    expect(EXERCISES['mf-q1-area'].diamond).toBeUndefined();
    expect(JSON.stringify(EXERCISES['mf-q1-area'].prompt)).not.toMatch(/спрос нулевой/);
    expect(lesson('mf-i1').exercises.filter((e) => e.diamond).length).toBeGreaterThanOrEqual(2);
  });
  it('первая карточка излишка объясняет, что значит площадь на графике (muze2emk)', () => {
    expect(JSON.stringify(step('mf-i1', 'mf-i1').idea)).toMatch(/каждый следующий гость/);
  });
  it('в уроке «Налог и излишек» нет повторов одного вопроса и сопоставления «мест на графике» (mv0bctho, mv08mxdt, mv08jwmw)', () => {
    expect(lesson('mf-l1').exercises.map((e) => e.id)).not.toContain('auto:mf-tf-who');
    expect(EXERCISES['mf-e1-match'].pairs.map((p) => p[1].raw).join(' ')).not.toMatch(/график|прямоугольник|треугольник/);
    expect(JSON.stringify(EXERCISES['mf-e1-tf'].prompt)).toMatch(/по новому закону/);
  });
  it('«при какой цене выручка максимальна» в повторах — с новыми числами (muyy8r5x)', async () => {
    const { freshCopy } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    const seen = new Set();
    for (let s = 1; s <= 8; s += 1) {
      const it = freshCopy(EXERCISES['el-q2-top'], seeded(s));
      expect(it.fresh).toBe('numbers');
      expect(it.of).toBe('el-q2-top');
      const [, a, b] = JSON.stringify(it.prompt).match(/Q = (\d+) - (\d+)P/);
      expect(it.answer).toBe(Number(a) / (2 * Number(b)));
      seen.add(it.answer);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
  it('задача про хлеб: подсказка ведёт к калькулятору, и он считает дробную степень (muy7kr2a)', async () => {
    const { evalExpr } = await import('../calc.js');
    const { PROBLEMS } = await import('../../textbook/content.js');
    expect(JSON.stringify(PROBLEMS['el-game-bread'].block)).toMatch(/калькулятор/);
    expect((evalExpr('1,1^(−0,2)') - 1) * 100).toBeCloseTo(-1.89, 2);
  });
  it('в «Сообщить об ошибке» есть причина «выглядит не так», сервер её принимает (muzgfgl4)', async () => {
    const { REASONS, THEORY_REASONS } = await import('../../learn-report.jsx');
    const api = await import('../../../api/reports.js');
    expect(REASONS.map((r) => r[0])).toContain('visual');
    expect(THEORY_REASONS.map((r) => r[0])).toContain('visual');
    expect(api.sanitizeReport({ reason: 'visual' }).reason).toBe('visual');
  });
});

describe('жалобы из выгрузки: учебник', () => {
  it('ключевые формулы помечены «запомнить» — $$! … $$; в главе их немного (muyynod2)', async () => {
    const [b] = parseBlocks('$$!P_d - P_s = t.$$');
    expect(b).toMatchObject({ type: 'math', tex: 'P_d - P_s = t.', key: true });
    expect(parseBlocks('$$x = 1$$')[0].key).toBeUndefined();
    const { keyFormulas } = await import('../../textbook/content.js');
    const { CHAPTERS } = await import('../../textbook/toc.js');
    expect(keyFormulas('market-failures')).toEqual(['P_d - P_s = t.', 'DWL = \\tfrac12\\, t\\,(Q_0 - Q_t).']);
    CHAPTERS.forEach((c) => expect(keyFormulas(c.id).length, c.id).toBeLessThanOrEqual(4));
  });
  it('теорема Коуза: понятно, что именно «нужно» (mv1rhkbr); вопрос про бремя — без двусмысленности (muzajz73)', async () => {
    const { GLOSSARY } = await import('../../textbook/glossary.js');
    const { RECALLS } = await import('../../textbook/content.js');
    expect(GLOSSARY.coase.text).not.toMatch(/почему нужно государство/);
    expect(GLOSSARY.coase.text).toMatch(/вмешательства государства/);
    expect(JSON.stringify(RECALLS['mf-r-tax'].block)).toMatch(/большую часть/);
  });
});
