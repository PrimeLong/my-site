import { describe, it, expect } from 'vitest';
import { TRACKS, MOOD_PLAYLISTS, ROLE_PLAYLISTS, MOOD_LABEL, REGIME_MOOD, LH, BASS_LINES, STINGERS } from '../tracks.js';
import { createAudioEngine, trackSeconds, moodFor, stingerFor } from '../engine.js';

// всё, что аранжировка умеет превратить в звук (см. scheduleStep в engine.js)
const INSTRUMENTS = ['piano', 'synth', 'lead', 'bass', 'cello', 'growl', 'harp', 'bells', 'brass', 'guitar',
  'strum', 'nylon', 'marimba', 'violin', 'strings', 'pad', 'choir', 'timpani'];
const FEELS = [undefined, 'straight', 'swing', 'loose'];

describe('саундтрек: целостность данных', () => {
  const ids = Object.keys(TRACKS);

  it('у каждой пьесы есть имя, подзаголовок, настроение с подписью и разумный темп', () => {
    for (const id of ids) {
      const t = TRACKS[id];
      expect(t.id).toBe(id);
      expect(t.name, id).toBeTruthy();
      expect(t.subtitle, id).toBeTruthy();
      expect(MOOD_LABEL[t.mood], `${id}: настроение ${t.mood}`).toBeTruthy();
      expect(t.bpm, id).toBeGreaterThanOrEqual(40);
      expect(t.bpm, id).toBeLessThanOrEqual(180);
      expect(FEELS, `${id}: feel`).toContain(t.feel);
      if (t.bassLine) expect(BASS_LINES[t.bassLine], `${id}: bassLine ${t.bassLine}`).toBeTruthy();
    }
  });

  it('секции ссылаются на существующую гармонию, мелодию и фигуру левой руки', () => {
    for (const id of ids) {
      const t = TRACKS[id];
      expect(t.sections.length, id).toBeGreaterThan(0);
      for (const s of t.sections) {
        expect(Array.isArray(t[s.h]), `${id}: гармония ${s.h}`).toBe(true);
        expect(Array.isArray(t[s.mel]), `${id}: мелодия ${s.mel}`).toBe(true);
        expect(LH[s.lh], `${id}: фигура ${s.lh}`).toBeTruthy();
        expect(s.dyn, id).toBeGreaterThan(0);
        expect(s.dyn, id).toBeLessThanOrEqual(1.3);
      }
    }
  });

  it('в аранжировке только известные инструменты', () => {
    for (const id of ids) {
      for (const s of TRACKS[id].sections) {
        for (const w of s.arr.split(/\s+/).filter(Boolean)) {
          expect(INSTRUMENTS, `${id}: «${w}»`).toContain(w);
        }
      }
    }
  });

  it('аккорды из четырёх настоящих нот, мелодия укладывается в свою секцию', () => {
    for (const id of ids) {
      const t = TRACKS[id];
      for (const s of t.sections) {
        const bars = t[s.h];
        for (const chord of bars) {
          expect(chord.length, `${id}/${s.h}`).toBeGreaterThanOrEqual(3);
          for (const m of chord) expect(m, id).toBeGreaterThanOrEqual(24);
        }
        const steps = bars.length * 16;
        for (const [st, midi, dur] of t[s.mel]) {
          expect(Number.isInteger(st) && st >= 0 && st < steps, `${id}/${s.mel}: шаг ${st} из ${steps}`).toBe(true);
          expect(dur, `${id}/${s.mel}`).toBeGreaterThan(0);
          expect(midi, id).toBeGreaterThanOrEqual(36);
          expect(midi, id).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('ударные: шаги в пределах такта, известные символы', () => {
    for (const id of ids) {
      for (const s of TRACKS[id].sections) {
        if (!s.drums) continue;
        for (const k of ['kick', 'snare', 'hat']) {
          for (const [st, c] of s.drums[k]) {
            expect(st, id).toBeLessThan(16);
            if (k === 'hat') expect(['o', 'O', 'r', 'x'], `${id}: ${c}`).toContain(c);
          }
        }
      }
    }
  });

  it('плейлисты ссылаются на существующие пьесы, у каждого настроения режима — свой плейлист', () => {
    const all = [MOOD_PLAYLISTS, ...Object.values(ROLE_PLAYLISTS)];
    for (const lists of all) {
      for (const [m, list] of Object.entries(lists)) {
        expect(list.length, m).toBeGreaterThan(0);
        for (const id of list) expect(TRACKS[id], `${m}: ${id}`).toBeTruthy();
      }
    }
    for (const m of Object.values(REGIME_MOOD)) expect(MOOD_PLAYLISTS[m], m).toBeTruthy();
    for (const m of Object.keys(MOOD_LABEL)) expect(MOOD_PLAYLISTS[m], m).toBeTruthy();
  });

  it('каждая пьеса где-нибудь звучит', () => {
    const used = new Set();
    for (const lists of [MOOD_PLAYLISTS, ...Object.values(ROLE_PLAYLISTS)]) {
      for (const list of Object.values(lists)) list.forEach((id) => used.add(id));
    }
    for (const id of Object.keys(TRACKS)) expect(used.has(id), id).toBe(true);
  });

  it('проход формы — от полуминуты до четырёх минут', () => {
    for (const id of Object.keys(TRACKS)) {
      const s = trackSeconds(id);
      expect(s, id).toBeGreaterThan(30);
      expect(s, id).toBeLessThan(240);
    }
  });
});

describe('звуковой движок без Web Audio', () => {
  it('без AudioContext не падает и молчит', () => {
    const a = createAudioEngine();
    expect(a.prime()).toBe(false);
    expect(() => {
      a.play('click');
      a.startMusic();
      a.setMood({ regime: 'recession', politicalRegime: 'democracy', inflationRisk: 10, bankingRisk: 10, debtRisk: 10, recessionRisk: 60, gdpGrowth: -2 });
      a.quarterSequence({ wellbeingDelta: 1, newCrisis: false, bigNews: false });
    }).not.toThrow();
    expect(a.nowPlaying().mood).toBeTruthy();
  });

  it('настроение следует режиму экономики, тоталитаризм перекрывает всё', () => {
    const a = createAudioEngine();
    const base = { politicalRegime: 'democracy', inflationRisk: 0, bankingRisk: 0, debtRisk: 0, recessionRisk: 0, gdpGrowth: 2 };
    a.setMood({ ...base, regime: 'banking' });
    expect(a.playlist().map((p) => p.id)).toEqual(MOOD_PLAYLISTS.crisis);
    a.setMood({ ...base, regime: 'normal', politicalRegime: 'totalitarian' });
    expect(a.playlist().map((p) => p.id)).toEqual(MOOD_PLAYLISTS.totalitarian);
  });
});

describe('настроение и заставки', () => {
  const base = { regime: 'normal', politicalRegime: 'democracy', stabilizationCred: 0, campaignActive: false };

  it('настроение: тоталитаризм и война главнее всего, стабилизация — поверх кризиса', () => {
    expect(moodFor(base)).toBe('calm');
    expect(moodFor({ ...base, regime: 'recession' })).toBe('slump');
    expect(moodFor({ ...base, campaignActive: true })).toBe('campaign');
    expect(moodFor({ ...base, regime: 'banking', campaignActive: true })).toBe('crisis');
    expect(moodFor({ ...base, politicalRegime: 'authoritarian', campaignActive: true })).toBe('authoritarian');
    expect(moodFor({ ...base, regime: 'currency', stabilizationCred: 0.4 })).toBe('stabilization');
    expect(moodFor({ ...base, regime: 'currency', stabilizationCred: 0.4, stabilizationWon: true })).toBe('crisis');
    expect(moodFor({ ...base, regime: 'war', stabilizationCred: 0.9 })).toBe('war');
    expect(moodFor({ ...base, regime: 'war', politicalRegime: 'totalitarian' })).toBe('totalitarian');
    for (const m of ['campaign', 'stabilization', 'authoritarian']) expect(MOOD_PLAYLISTS[m].length).toBeGreaterThanOrEqual(2);
  });

  it('заставка выбирается по самому значимому событию квартала', () => {
    expect(stingerFor(null, base)).toBe(null);
    expect(stingerFor(base, base)).toBe(null);
    expect(stingerFor(base, { ...base, electionResult: 'incumbent', lastElection: {} })).toBe('victory');
    expect(stingerFor(base, { ...base, electionResult: 'incumbent', lastElection: { rigged: true } })).toBe('hollow');
    expect(stingerFor(base, { ...base, electionResult: 'landslide', lastElection: {} })).toBe('defeat');
    expect(stingerFor(base, { ...base, electionResult: 'incumbent', lastElection: { coup: true }, politicalRegime: 'authoritarian' })).toBe('coup');
    expect(stingerFor(base, { ...base, politicalRegime: 'authoritarian' })).toBe('regime_fall');
    expect(stingerFor({ ...base, politicalRegime: 'authoritarian' }, { ...base, politicalRegime: 'totalitarian' })).toBe('regime_fall');
    expect(stingerFor({ ...base, politicalRegime: 'crisis' }, base)).toBe('restoration');
    expect(stingerFor(base, { ...base, stabilizationWon: true })).toBe('prices_stopped');
    expect(stingerFor({ ...base, stabilizationWon: true }, { ...base, stabilizationWon: true })).toBe(null);
  });

  it('каждая возможная заставка существует, её партии укладываются в несколько секунд', () => {
    const ids = ['victory', 'hollow', 'defeat', 'coup', 'regime_fall', 'restoration', 'prices_stopped'];
    const voices = ['piano', 'brass', 'strings', 'choir', 'bell', 'harp', 'cello', 'bass', 'growl', 'violin', 'timpani', 'snare', 'kick'];
    for (const id of ids) {
      const S = STINGERS[id];
      expect(S, id).toBeTruthy();
      let steps = 0;
      for (const p of S.parts) {
        expect(voices, `${id}: ${p.inst}`).toContain(p.inst);
        for (const [st, notes, dur] of p.notes) {
          steps = Math.max(steps, st + dur);
          const drum = p.inst === 'snare' || p.inst === 'kick';
          expect(notes.length > 0, `${id}/${p.inst}@${st}`).toBe(!drum);
          for (const m of notes) expect(m, id).toBeGreaterThanOrEqual(30);
        }
      }
      const seconds = steps * 60 / S.bpm / 4;
      expect(seconds, id).toBeGreaterThan(2);
      expect(seconds, id).toBeLessThan(8);
    }
  });

  it('движок принимает заставку и без Web Audio не падает', () => {
    const a = createAudioEngine();
    expect(a.stinger('victory')).toBe(0);
    expect(() => a.quarterSequence({ wellbeingDelta: 0, newCrisis: false, bigNews: false, stinger: 'coup' })).not.toThrow();
  });
});
