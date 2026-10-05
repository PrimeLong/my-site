// Тексты Пути по библии (docs/world.md): реплики героев от первого лица, деньги в кронах, герои вместо условных имён
import { describe, it, expect } from 'vitest';
import { LESSONS } from '../course.js';
import { CAST } from '../cast.js';

// формы имени героя в третьем лице: «Маша», «у Маши», «Мария», «Гриша», «Григорий»…
const OWN = {
  masha: /(^|[^а-яё])(Маш[аиеуойё]|Мари[яиюей])([^а-яё]|$)/i,
  grisha: /(^|[^а-яё])(Гриш[аиеуой]|Григори[йяюе])([^а-яё]|$)/i,
  oleg: /(^|[^а-яё])Олег[ауе]?([^а-яё]|$)/i,
  vera: /Вер[аыеуой] Павловн/i,
  timur: /(^|[^а-яё])Тимур[ауе]?([^а-яё]|$)/i,
  host: /(^|[^а-яё])Лад[аыеуой]([^а-яё]|$)/i,
};
const flat = (blocks) => JSON.stringify(blocks || '').replace(/\\"/g, '"');

describe('реплики героев — от первого лица', () => {
  const lines = LESSONS.flatMap((l) => l.inner.filter((c) => c.idea && c.idea.who).map((c) => ({ lesson: l.id, id: c.idea.id, who: c.idea.who, text: flat(c.idea.text || c.idea.blocks) })));
  it('у каждого героя из cast.js есть правило', () => {
    Object.keys(CAST).filter((k) => k !== 'narrator').forEach((k) => expect(OWN[k], k).toBeTruthy());
    expect(lines.length).toBeGreaterThan(20);
  });
  it('в своей реплике герой не говорит о себе в третьем лице', () => {
    lines.forEach((x) => {
      const m = OWN[x.who] && OWN[x.who].exec(x.text);
      expect(m, `${x.id} (${x.who}): «${m && m[0].trim()}»`).toBeNull();
    });
  });
});

describe('деньги на Пути — в кронах, герои — из cast.js', () => {
  const PATH_TEXT = LESSONS.flatMap((l) => [
    ...l.inner.map((c) => ({ id: (c.idea && c.idea.id) || l.id, text: JSON.stringify(c.idea || c) })),
    ...l.exercises.map((e) => ({ id: e.id, text: JSON.stringify(e) })),
  ]);
  it('во всех шагах и заданиях Пути, включая алмазный уровень, нет рублей', () => {
    PATH_TEXT.forEach((x) => { const m = /руб(?!аш)|₽/i.exec(x.text); expect(m, `${x.id}: «${m && x.text.slice(Math.max(0, m.index - 40), m.index + 30)}»`).toBeNull(); });
  });
  it('условных Ани, Бориса, Вики и Кати нет — вместо них герои', () => {
    PATH_TEXT.forEach((x) => { const m = /(^|[^а-яё])(Ан[яиеюй]|Борис|Вик[аиеуой]|Кат[яиеюй])([^а-яё]|$)/.exec(x.text); expect(m, `${x.id}: «${m && m[0]}»`).toBeNull(); });
  });
  it('обозначения и подписи графиков на Пути переводятся в кроны', async () => {
    const { inCrowns, sceneInCrowns } = await import('../money.js');
    expect(inCrowns('цена самого товара, руб.')).toBe('цена самого товара, кр.');
    expect(inCrowns('на сколько единиц меньше покупают, когда цена выше на рубль')).toBe('на сколько единиц меньше покупают, когда цена выше на крону');
    expect(inCrowns('330 тыс. руб. и 5 рублей, 2 рубля')).toBe('330 тыс. кр. и 5 крон, 2 кроны');
    expect(inCrowns('рубашки')).toBe('рубашки');
    expect(sceneInCrowns({ yLabel: 'руб.', points: [{ x: 1, y: 2 }], readout: [{ label: 'Цена', value: '20 руб.' }] }))
      .toEqual({ yLabel: 'кр.', points: [{ x: 1, y: 2 }], readout: [{ label: 'Цена', value: '20 кр.' }] });
  });
});

describe('обращение на «вы»', () => {
  // повелительное наклонение на «ты», которое встречалось в подписях
  const TY = /(^|[^а-яё])(Найди|Сдвинь|Отметь|Собери|Разложи|Сопоставь|Заполни|Открой сам|Заверши|Пройди|Продержись|Удержи|Удвой|Опусти|Снизь|Выведи|Останься|Доведи|Доиграй|Переживи|Проведи|Верни|Получи|Сохрани|Введи|Договорись|Соверши|Выбери|Нажми)([^а-яё]|$)/;
  it('названия видов заданий — на «вы»', async () => {
    const { KIND_LABEL } = await import('../course.js');
    Object.entries(KIND_LABEL).forEach(([k, v]) => expect(TY.exec(v), `${k}: ${v}`).toBeNull());
    expect(KIND_LABEL.price).toBe('Найдите цену');
    expect(KIND_LABEL.curve).toBe('Сдвиньте кривую');
  });
  it('описания уровней Пути — на «вы»', async () => {
    const { LEVELS } = await import('../course.js');
    const TY2 = /(^|[^а-яё])(знаешь|понимаешь|можешь|умеешь|ты)([^а-яё]|$)/i;
    LEVELS.forEach((l) => { expect(TY2.exec(l.text), l.text).toBeNull(); expect(l.text).toMatch(/^Вы /); });
  });
  it('описания достижений «Мира» — на «вы»', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../MacroSimulator.jsx', import.meta.url), 'utf8');
    const descs = [...src.matchAll(/desc: '([^']+)'/g)].map((m) => m[1]);
    expect(descs.length).toBeGreaterThan(20);
    descs.forEach((d) => expect(TY.exec(d), d).toBeNull());
  });
  it('шаг «Откройте сами» и шаги Пути — без «ты»-повелительного', () => {
    LESSONS.forEach((l) => l.inner.forEach((c) => {
      const t = `${(c.idea && c.idea.title) || ''}`;
      expect(TY.exec(t), `${l.id}: ${t}`).toBeNull();
    }));
  });
});

describe('термины по библии', () => {
  it('sc-e5-gap: движение вдоль КПВ — изменение сочетания выпускаемых товаров', () => {
    const ex = LESSONS.flatMap((l) => l.exercises).find((e) => e.id === 'sc-e5-gap');
    expect(JSON.stringify(ex)).toContain('сочетания выпускаемых товаров');
  });
  it('в интерфейсе Пути — «опыт», а не «XP»; «Страховка серии», а не «заморозка»', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = ['../../learn.jsx', '../../learn-rewards.jsx', '../../learn-play.jsx'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    // строки интерфейса: текст между > и < и в кавычках, без комментариев и идентификаторов
    const visible = ui.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
    // «XP» как слово на экране, а не идентификатор XP.correct / { XP } / lessonXp
    const shown = visible.split('\n').filter((l) => /(?<![\w.])XP(?![\w.(]|\s*[,}=:])/.test(l) && !/^\s*import|^\s*[A-Za-z,\s]+\}? from/.test(l));
    expect(shown).toEqual([]);
    expect(visible.split('\n').filter((l) => /[Зз]аморозк/.test(l))).toEqual([]);
  });
});
