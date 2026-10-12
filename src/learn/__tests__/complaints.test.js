// Исправленные жалобы учеников: каждая — проверка, чтобы ошибка не вернулась
import { describe, it, expect } from 'vitest';
import { parseBlocks } from '../../textbook/markdown.js';
import { EXERCISES, LESSONS, instantiate, check } from '../course.js';
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
    // цена покупателей при налоге — итоговая формула, но задачи уроков решают прямо по ней (mv3vifty)
    expect(keyFormulas('market-failures')).toEqual(['P_d - P_s = t.', 'P_d = \\frac{a - c + d\\,t}{b + d}, \\qquad P_s = P_d - t.', 'DWL = \\tfrac12\\, t\\,(Q_0 - Q_t).', 'P = MC + \\text{ущерб с единицы}.']);
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

describe('жалобы из выгрузки: новые числа в повторах (mv3hqkqi) и налог Пигу на картинке (mv3gw37a)', () => {
  const words = (x) => texts(x).join('');
  it('формулы параметров: арифметика, сравнения, «и» как произведение; без eval', async () => {
    const { evalFormula } = await import('../../textbook/markdown.js');
    expect(evalFormula('t*dq/2', { t: 6, dq: 8 })).toBe(24);
    expect(evalFormula('2^3 - (1 + 1)')).toBe(6);
    expect(evalFormula('(a>1)*(a<5)', { a: 3 })).toBe(1);
    expect(evalFormula('dq*3<q0', { dq: 8, q0: 20 })).toBe(0);
    expect(() => evalFormula('alert(1)')).toThrow();
    expect(() => evalFormula('x+1', {})).toThrow(/Неизвестный параметр/);
  });
  it('в тексте — число с согласованным словом, в формуле — запятая для TeX', async () => {
    const { substituteVary } = await import('../../textbook/markdown.js');
    expect(substituteVary('Налог {=t|крона|кроны|крон}, продали {=q|чашку|чашки|чашек}', { t: 21, q: 52 })).toBe('Налог 21 крона, продали 52 чашки');
    expect(substituteVary('$\\tfrac12 \\cdot {=t/4}$ и {=t/4}', { t: 10 })).toBe('$\\tfrac12 \\cdot 2{,}5$ и 2,5');
    expect(substituteVary('$x = {=q}$ {|q|чашка|чашки|чашек}; {=n} и ${=n}$', { q: 3, n: 12500 })).toBe('$x = 3$ чашки; 12\u00a0500 и $12\\,500$');
  });
  it('текст по условию: «эластичный» или «неэластичный» — по числам задачи', async () => {
    const { substituteVary } = await import('../../textbook/markdown.js');
    const line = 'спрос {?1-e|эластичный|с единичной эластичностью|неэластичный}, {?e>1|выручка падает|выручка не падает: {=e}}';
    expect(substituteVary(line, { e: 2 })).toBe('спрос эластичный, выручка падает');
    expect(substituteVary(line, { e: 1 })).toBe('спрос с единичной эластичностью, выручка не падает: 1');
    expect(substituteVary(line, { e: 0.5 })).toBe('спрос неэластичный, выручка не падает: 0,5');
  });
  it('единица в ответе согласована с числом: «Правильно: 2 чашки»', async () => {
    const { instantiate, answerText } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    const ex = EXERCISES['cs-d1-rest'];
    expect(ex.unit).toBe('чашек');
    expect(answerText(instantiate(ex, seeded(1)))).toBe('6 чашек');
    const forms = new Set();
    for (let s = 1; s <= 30; s += 1) { const it = instantiate(ex, seeded(s), { renumber: true }); forms.add(answerText(it).replace(/\d+ /, '')); }
    expect([...forms].sort()).toEqual(['чашек', 'чашки']);
  });
  it('ошибка в задаче с параметрами ловится при сборке: ответ не по формуле или ловушка равна ответу', () => {
    expect(() => parseBlocks(':::ex calc id=x answer=5 vary="a=2:1..3" calc="a*2"\nСколько {=a}?\n:::')).toThrow(/calc по умолчанию даёт 4/);
    expect(() => parseBlocks(':::ex calc id=x answer=4 vary="a=2:1..3" calc="a*2"\nСколько {=a}?\n!! {=a+a} | Неверно\n:::')).toThrow(/ловушка/);
  });
  it('все задачи с параметрами: в 100 наборах чисел ответ — число не 0, ловушки не совпадают с ответом, подстановок не осталось', async () => {
    const { varyInstance } = await import('../../textbook/markdown.js');
    const { seeded } = await import('../../textbook/variants.js');
    const list = Object.values(EXERCISES).filter((e) => e.vary);
    expect(list.length).toBeGreaterThanOrEqual(10);
    list.forEach((e) => {
      const rand = seeded(7);
      const answers = new Set();
      for (let k = 0; k < 100; k += 1) {
        const v = varyInstance(e.vary, rand);
        expect(Number.isFinite(v.answer) && v.answer !== 0, e.id).toBe(true);
        v.traps.forEach((t) => expect(Math.abs(t.value - v.answer), e.id).toBeGreaterThan(1e-6));
        expect(JSON.stringify([v.prompt, v.explain, v.traps]), e.id).not.toMatch(/\{=/);
        answers.add(v.answer);
      }
      expect(answers.size, e.id).toBeGreaterThan(2);
    });
  });
  it('алмазный повтор «Налог и излишек»: задача о потерях каждый раз с новыми числами, ответ сходится с условием', async () => {
    const { buildLesson } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    const seen = new Set();
    for (let s = 1; s <= 10; s += 1) {
      const it = buildLesson('mf-i1', seeded(s), { diamond: true }).items.find((x) => x.id === 'mf-d1-dwl');
      const [, t, q0, q1] = words(it.prompt).match(/Налог (\d+) \S+ с чашки\. Без налога продавали (\d+) \S+, с налогом — (\d+)/).map(Number);
      expect(it.answer).toBe((t * (q0 - q1)) / 2);
      seen.add(words(it.prompt));
    }
    expect(seen.size).toBeGreaterThan(5);
  });
  it('первый проход урока — числа как в тексте главы, повтор пройденного урока — новые', async () => {
    const { buildLesson } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    expect(buildLesson('mf-i1', seeded(3)).items.find((x) => x.id === 'mf-q1-area').answer).toBe(900);
    const again = new Set([1, 2, 3, 4, 5, 6].map((s) => buildLesson('mf-i1', seeded(s), { replay: true }).items.find((x) => x.id === 'mf-q1-area').answer));
    expect(again.size).toBeGreaterThan(2);
  });
  it('в повторении задача с параметрами считается «с новыми числами», а не повтором', async () => {
    const { freshCopy } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    const it = freshCopy(EXERCISES['mf-d1-dwl'], seeded(11));
    expect([it.fresh, it.of]).toEqual(['numbers', 'mf-d1-dwl']);
  });
  it('шаг «Налог Пигу» показывает рынок уже с налогом: издержки подняты, прежние — бледной линией', async () => {
    const { CHARTS, chartDefaults } = await import('../../textbook/charts.js');
    const c = LESSONS.flatMap((l) => l.inner).find((x) => x.idea.id === 'mf-i2-pigou');
    const v = chartDefaults(c.idea.chart, c.idea.attrs);
    expect(v.pigou).toBe(true);
    const scene = CHARTS[c.idea.chart].build(c.idea.attrs, v);
    expect(scene.curves.find((x) => x.id === 'MC0').ghost).toBe(true);
    expect(scene.curves.find((x) => x.id === 'MC').label).toBe('MC + налог');
    expect(scene.readout.find((r) => r.label === 'Налог Пигу с единицы').value).toBe('20');
    expect(scene.readout.find((r) => r.label === 'Безвозвратные потери').value).toBe('0');
  });
});

describe('жалобы из выгрузки: задачи семинарского уровня и единицы (mv4j2khb, mv4j067n)', () => {
  it('в алмазном «Повторении» задача учебника с шаблоном приходит с новыми числами и не дважды', async () => {
    const { buildLesson } = await import('../course.js');
    const { seeded } = await import('../../textbook/variants.js');
    const answers = new Set();
    for (let s = 1; s <= 30; s += 1) {
      const hard = buildLesson('sc-rev', seeded(s), { diamond: true }).items.filter((it) => it.hard);
      hard.forEach((it) => expect(it.id, it.id).not.toBe('auto:sc-ppf-cost'));
      const ppf = hard.filter((it) => it.variant === 'v-sc-ppf');
      expect(ppf.length).toBeLessThanOrEqual(1);
      ppf.forEach((it) => answers.add(it.answer));
    }
    expect(answers.size).toBeGreaterThan(2);
  });
  it('у поля ответа единица по набранному числу: «3 станка», «5 станков», «1 станок» (sc-e4-slope)', async () => {
    const { unitFor } = await import('../course.js');
    const e = EXERCISES['sc-e4-slope'];
    expect(['', '3', '5', '1', '2,5', '-'].map((v) => unitFor(e, v))).toEqual(['станков', 'станка', 'станков', 'станок', 'станка', 'станков']);
    expect(unitFor({ unit: 'руб.' }, '3')).toBe('руб.');
  });
});

describe('жалобы из выгрузки: общественно оптимальный выпуск (mv3wxy9b, mv3wu6mz)', () => {
  it('«общественно оптимальный выпуск» — в словаре с формулой, в главе и нажимается в задаче', async () => {
    const { GLOSSARY } = await import('../../textbook/glossary.js');
    const { termsIn, termFormula } = await import('../terms.js');
    const { CHAPTER_BLOCKS } = await import('../../textbook/content.js');
    expect(GLOSSARY.socialopt.title).toBe('Общественно оптимальный выпуск');
    expect(termFormula('socialopt')).toContain('MC');
    expect(JSON.stringify(CHAPTER_BLOCKS['market-failures'])).toContain('"kind":"term","target":"socialopt"');
    expect([...termsIn(EXERCISES['auto:mf-pigou'].prompt)]).toContain('socialopt');
  });
});

describe('жалобы из выгрузки: формула шага урока (mv3wjucx)', () => {
  it('у алмазного шага, после которого считают, есть формула «Запомнить»', () => {
    const missing = LESSONS.flatMap((l) => l.inner.filter((c) => c.idea.diamond && (l.exercises[c.at] || {}).kind === 'calc' && !c.idea.remember).map((c) => c.idea.id));
    expect(missing).toEqual([]);
    const opt = LESSONS.flatMap((l) => l.inner).find((c) => c.idea.id === 'mf-i2-d-opt').idea;
    expect(opt.remember).toBe('P = MC + \\text{ущерб с единицы}');
  });
});

describe('жалобы из выгрузки: плитки с двумя верными порядками (mv5dk28k)', () => {
  it('«из-за налога» не отрывается от «которые»: второго верного порядка нет', () => {
    const ex = EXERCISES['mf-w:tiles:deadweight'];
    expect(ex.solution).toEqual(['выгода от сделок,', 'которые из-за налога', 'не состоялись:', 'её не получил никто']);
  });
  it('другой верный порядок, названный автором после «~», засчитывается', () => {
    const inst = instantiate(EXERCISES['cs-w:tiles:indifference'], () => 0.3);
    const key = (txt) => inst.tiles.find((t) => t.text === txt).key;
    expect(check(inst, ['наборы,', 'одинаково хорошие', 'для человека'].map(key)).ok).toBe(true);
    expect(check(inst, ['наборы,', 'для человека', 'одинаково хорошие'].map(key)).ok).toBe(true);
    expect(check(inst, ['для человека', 'наборы,', 'одинаково хорошие'].map(key)).ok).toBe(false);
  });
  it('у каждой плитки «Слов» — разметка автора, порядок после «~» — из тех же плиток', () => {
    const tiles = Object.values(EXERCISES).filter((e) => e.kind === 'tiles');
    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach((e) => expect(e.solution.length, e.id).toBeGreaterThanOrEqual(3));
    expect(() => parseBlocks(':::idea id=x-w kind=words title="Слова"\nСлова.\n- demand: сколько / покупатели ~ сколько / продавцы\n:::')).toThrow(/из тех же плиток/);
  });
});

describe('жалобы из выгрузки: общая КПВ (mv54yu3v)', () => {
  it('до задачи sc-joint в главе разобрано, как построить общую КПВ', async () => {
    const fs = await import('node:fs');
    const md = fs.readFileSync(new URL('../../textbook/chapters/scarcity.md', import.meta.url), 'utf8');
    const how = md.indexOf('### Как построить общую КПВ');
    expect(how).toBeGreaterThan(0);
    expect(how).toBeLessThan(md.indexOf('id=sc-joint'));
    expect(md.slice(how, how + 2500)).toMatch(/\(8; 32\)/);
  });
});
