import { describe, it, expect } from 'vitest';
import { voiceFor, HERO_VOICE, VOICE_CAPTION, speechText } from '../voices.js';
import { CAST } from '../cast.js';

/* Голоса героев: у каждого свой темп и высота, а при нескольких русских голосах — свой голос. */
const V = (name, lang = 'ru-RU') => ({ name, lang });
const BROWSER = [V('Google US English', 'en-US'), V('Microsoft Irina'), V('Microsoft Pavel'), V('Milena'), V('Yuri'), V('Microsoft Svetlana'), V('Microsoft Dmitry')];

describe('голоса героев', () => {
  it('у каждого героя из cast.js свой голос: темп и высота не совпадают ни у одной пары', () => {
    const ids = Object.keys(CAST);
    ids.forEach((id) => expect(HERO_VOICE[id], id).toBeTruthy());
    const sig = ids.map((id) => `${HERO_VOICE[id].rate}/${HERO_VOICE[id].pitch}`);
    expect(new Set(sig).size).toBe(ids.length);
  });
  it('женщины — женскими голосами, мужчины — мужскими, и у героев одного пола голоса разные', () => {
    const f = ['host', 'masha', 'vera'].map((id) => voiceFor(id, BROWSER).voice.name);
    const m = ['timur', 'grisha', 'oleg'].map((id) => voiceFor(id, BROWSER).voice.name);
    f.forEach((n) => expect(n).toMatch(/Irina|Milena|Svetlana/));
    m.forEach((n) => expect(n).toMatch(/Pavel|Yuri|Dmitry/));
    expect(new Set(f).size).toBe(3);
    expect(new Set(m).size).toBe(3);
  });
  it('только один русский голос — у всех он, но с разным темпом и высотой; русских нет — null', () => {
    const one = [V('Google русский'), V('Samantha', 'en-US')];
    const a = voiceFor('host', one); const b = voiceFor('grisha', one);
    expect(a.voice.name).toBe('Google русский'); expect(b.voice.name).toBe('Google русский');
    expect([a.rate, a.pitch]).not.toEqual([b.rate, b.pitch]);
    expect(voiceFor('host', [V('Samantha', 'en-US')])).toBeNull();
    expect(voiceFor('host', [])).toBeNull();
  });
  it('порядок голосов в браузере не меняет голос героя', () => {
    expect(voiceFor('oleg', [...BROWSER].reverse()).voice.name).toBe(voiceFor('oleg', BROWSER).voice.name);
  });
  it('подпись под эфиром', () => { expect(VOICE_CAPTION).toBe('голос синтезирован браузером'); });
});

/* Озвучка чисел: «10 000» голос читал как «10» и «000» — разряды склеиваются; «кр.» — «крон».
   Подсветка слов идёт по исходному тексту: каждый символ озвучки помнит, откуда он. */
describe('текст для голоса', () => {
  it('склеивает разряды с обычным, неразрывным и узким пробелом', () => {
    expect(speechText('корзина подорожала с 10 000 до 10 700 крон').say).toBe('корзина подорожала с 10000 до 10700 крон');
    expect(speechText('бюджет 1 250 000 крон').say).toBe('бюджет 1250000 крон');
  });
  it('ударение в «батонов» — на «о́»: голос не читает «бОтанов»; подсветка идёт по исходному слову', () => {
    const { say, map } = speechText('печёт 50 000 Батонов в день, батон — 6 крон, «батоны»');
    expect(say).toBe('печёт 50000 Бато\u0301нов в день, бато\u0301н — 6 крон, «бато\u0301ны»');
    // знак ударения указывает на ту же букву исходного текста, что и ударная гласная
    const k = say.indexOf('\u0301');
    expect(map[k]).toBe(map[k - 1]);
    // похожие слова не трогаем
    expect(speechText('батончик и Батонова').say).toBe('батончик и Батонова');
  });
  it('не склеивает разные числа и годы с числами', () => {
    expect(speechText('с 10 до 12').say).toBe('с 10 до 12');
    expect(speechText('в 2026 году 15 человек').say).toBe('в 2026 году 15 человек');
  });
  it('«кр.» читается как «крон», точка в конце предложения остаётся', () => {
    expect(speechText('Чашка — 100 кр. в день').say).toBe('Чашка — 100 крон в день');
    expect(speechText('Чашка стоит 100 кр. Дорого.').say).toBe('Чашка стоит 100 крон. Дорого.');
    expect(speechText('покупки — 300 кр.').say).toBe('покупки — 300 крон.');
  });
  it('карта символов ведёт обратно в исходный текст', () => {
    const text = 'с 10 000 крон';
    const { say, map } = speechText(text);
    expect(map).toHaveLength(say.length + 1);
    // «крон» в озвучке начинается там же, где в исходном тексте
    expect(map[say.indexOf('крон')]).toBe(text.indexOf('крон'));
  });
});
