import { describe, it, expect } from 'vitest';
import { voiceFor, HERO_VOICE, VOICE_CAPTION } from '../voices.js';
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
