/* =========================================================================================
   САУНДТРЕК: нотация, пьесы и плейлисты. Только данные — ни одного обращения к Web Audio,
   поэтому модуль можно импортировать и проверять в тестах без браузера. Движок, который
   эти пьесы играет, — src/audio/engine.js.
========================================================================================= */
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const nn = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 60;
  return NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const H = (str) => str.split('|').map((bar) => bar.trim().split(/\s+/).map(nn));
const MEL = (str) => str.trim().split(/\s+/).filter(Boolean).map((tok) => {
  const [st, note, dur] = tok.split(':');
  return [parseInt(st, 10), nn(note), parseInt(dur, 10)];
});
const drum = (s) => { const out = []; for (let i = 0; i < s.length; i++) if (s[i] !== '.') out.push([i, s[i]]); return out; };
/* DR(бочка, малый, тарелки, опции). В строке тарелок: 'o' — закрытый хэт,
   'O' — открытый, 'r' — райд. Опции: ghost — призрачные удары малого между
   долями, fill:false — не играть сбивку в последнем такте секции. */
const DR = (k, sn, h, opts) => ({ kick: drum(k), snare: drum(sn), hat: drum(h), ...opts });

/* Фигуры левой руки: [шаг в такте, индекс тона аккорда] */
const LH = {
  flow: [[0, 0], [2, 1], [4, 2], [6, 3], [8, 2], [10, 1], [12, 2], [14, 3]],
  wide: [[0, 0], [3, 1], [6, 2], [8, 3], [11, 2], [14, 1]],
  waltz: [[0, 0], [4, 1], [6, 2], [8, 1], [12, 2], [14, 3]],
  sustain: [[0, 0], [0, 1], [0, 2], [0, 3]],
  pulse: [[0, 0], [2, 1], [4, 0], [6, 1], [8, 0], [10, 1], [12, 0], [14, 1]],
  drive: [[0, 0], [2, 0], [3, 1], [5, 0], [6, 1], [8, 0], [10, 0], [11, 1], [13, 0], [14, 1]],
  roll: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [8, 0], [9, 1], [10, 2], [11, 3], [12, 2], [13, 1]],
  air: [[0, 0], [6, 2], [10, 1]],
};
/* Басовые фигуры. Раньше бас во всех без исключения пьесах играл одну и ту же
   ломаную восьмыми — отсюда и ощущение однообразия сильнее всего. Теперь рисунок
   выбирает сама пьеса: рок гонит ровные восьмые, джаз ходит четвертями по тонам
   аккорда, баллада держит половинки, а фанк дышит синкопой. [шаг, ступень]. */
const BASS_LINES = {
  drive: [[0, 0], [2, 0], [4, 7], [6, 0], [8, 0], [10, 12], [12, 7], [14, 0]],
  walk: [[0, 0], [4, 4], [8, 7], [12, 9]],
  root: [[0, 0], [6, 0], [8, 7], [14, 7]],
  half: [[0, 0], [8, 7]],
  synco: [[0, 0], [3, 0], [6, 7], [8, 12], [11, 7], [14, 0]],
  pulse8: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [14, 0]],
};

const sec = (h, mel, lh, arr, dyn, drums) => ({ h, mel, lh, arr, dyn: dyn || 1, drums: drums || null });

const TRACKS = {};
const tr = (id, name, subtitle, mood, cfg) => { TRACKS[id] = { id, name, subtitle, mood, ...cfg }; };

/* ------------------------------- СПОКОЙСТВИЕ ------------------------------- */
tr('dawn', 'Рассвет над министерством', 'фортепиано, струнные, аналоговый пад', 'calm', {
  bpm: 72, swing: 0.12, reverb: 0.42,
  bassLine: 'half',
  A: H('F2 C3 E3 A3 | A2 E3 G3 C4 | Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4'),
  B: H('D3 A3 C4 F4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | G2 D3 F3 Bb3'),
  melA: MEL('0:C5:4 4:F5:4 8:A5:8 16:G5:4 20:E5:4 24:C5:8 32:D5:4 36:F5:4 40:A5:8 48:G5:8 56:E5:8 64:F5:4 68:A5:4 72:C6:8 80:Bb5:4 84:A5:4 88:F5:8 96:D5:4 100:Bb4:4 104:D5:8 112:E5:4 116:G5:4 120:F5:12'),
  melB: MEL('0:A5:4 4:F5:4 8:E5:8 16:C#5:4 20:E5:4 24:A5:8 32:F5:4 36:D5:4 40:C5:8 48:Bb4:4 52:D5:4 56:F5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('A', 'melA', 'flow', 'piano bass pad', 0.85),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 1.0),
    sec('A', 'melA', 'waltz', 'piano bass pad strings violin', 1.0),
  ],
});
tr('ledger', 'Тихая бухгалтерия', 'фортепиано соло', 'calm', {
  bpm: 68, swing: 0.14, reverb: 0.46,
  bassLine: 'half', feel: 'loose',
  A: H('D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 A3 D4 | F2 C3 E3 A3 | G2 D3 F3 Bb3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:4 4:D5:4 8:F5:8 16:E5:4 20:D5:4 24:C5:8 32:A4:4 36:C5:4 40:A4:4 44:F4:4 48:G4:8 56:E4:8 64:A4:4 68:D5:4 72:F5:8 80:G5:4 84:F5:4 88:E5:8 96:D5:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:12'),
  melB: MEL('0:F5:4 4:D5:4 8:A4:8 16:C5:4 20:E5:4 24:F5:8 32:D5:4 36:Bb4:4 40:G4:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.7),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad cello', 1.0),
  ],
});
tr('northlight', 'Северный свет', 'ретро-колокол, фортепиано, аналоговый пад', 'calm', {
  bpm: 64, swing: 0, reverb: 0.62,
  bassLine: 'half',
  A: H('Ab2 Eb3 G3 C4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 Eb4 | Ab2 Eb3 G3 C4 | F2 C3 Ab3 Eb4 | Db3 Ab3 C4 F4 | Eb3 Bb3 D4 G4'),
  B: H('F2 C3 Ab3 C4 | Db3 Ab3 C4 F4 | Bb2 F3 Ab3 D4 | Eb3 Bb3 D4 G4'),
  melA: MEL('0:Eb5:8 8:G5:8 16:F5:8 24:Ab5:8 32:G5:8 40:Bb5:8 48:Eb5:14 64:C5:8 72:Eb5:8 80:Ab5:8 88:G5:8 96:F5:8 104:Db5:8 112:Eb5:14'),
  melB: MEL('0:Ab5:8 8:C6:8 16:Bb5:12 32:F5:8 40:Ab5:8 48:G5:14'),
  sections: [
    sec('A', 'melA', 'air', 'bells pad bass', 0.68),
    sec('B', 'melB', 'sustain', 'bells pad strings bass', 0.9),
    sec('A', 'melA', 'flow', 'piano bells pad strings bass', 1.0),
  ],
});
tr('promenade', 'Прогулка по столице', 'фортепиано и арпеджио', 'calm', {
  bpm: 84, swing: 0.16, reverb: 0.34,
  bassLine: 'root',
  A: H('G2 D3 G3 B3 | E2 B2 E3 G3 | C3 G3 B3 E4 | D3 A3 C4 F#4 | G2 D3 G3 B3 | E2 B2 E3 G3 | A2 E3 G3 C#4 | D3 A3 C4 F#4'),
  B: H('C3 G3 B3 E4 | B2 F#3 A3 D4 | E2 B2 E3 G3 | D3 A3 C4 F#4'),
  melA: MEL('0:D5:4 4:G5:4 8:B5:4 12:A5:4 16:G5:8 24:E5:8 32:G5:4 36:B5:4 40:D6:8 48:C6:4 52:A5:4 56:F#5:8 64:D5:4 68:G5:4 72:B5:4 76:A5:4 80:G5:8 88:E5:8 96:C#5:4 100:E5:4 104:A5:8 112:F#5:4 116:A5:4 120:G5:8'),
  melB: MEL('0:E5:4 4:G5:4 8:B5:8 16:D5:4 20:F#5:4 24:A5:8 32:G5:4 36:E5:4 40:B4:8 48:A5:4 52:F#5:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.72),
    sec('A', 'melA', 'roll', 'piano harp bass pad', 0.92),
    sec('B', 'melB', 'flow', 'piano harp bass pad strings', 1.0),
  ],
});
// Единственная полностью акустическая пьеса саундтрека: ни синт-пэдов, ни дисторшна —
// только нейлоновая гитара и синт-бас (cello), другой жанр, а не ещё один синтвейв-трек.
tr('meadow', 'Загородная тишина', 'нейлоновая гитара и бас — акустическая пьеса саундтрека', 'calm', {
  bpm: 88, swing: 0.1, reverb: 0.3,
  bassLine: 'root', feel: 'loose',
  A: H('G3 D4 G4 B4 | D3 A3 D4 F#4 | E3 B3 E4 G4 | C3 G3 C4 E4 | G3 D4 G4 B4 | D3 A3 D4 F#4 | C3 G3 C4 E4 | D3 A3 D4 F#4'),
  B: H('E3 B3 E4 G4 | C3 G3 C4 E4 | G3 D4 G4 B4 | D3 A3 D4 F#4'),
  melA: MEL('0:B4:4 4:D5:4 8:G5:4 12:D5:4 16:E5:8 24:D5:4 28:B4:4 32:C5:4 36:E5:4 40:G5:4 44:E5:4 48:D5:8 56:B4:4 60:A4:4 64:B4:4 68:D5:4 72:G5:4 76:D5:4 80:E5:8 88:D5:4 92:B4:4 96:C5:4 100:E5:4 104:G5:4 108:E5:4 112:F#5:8 120:D5:8'),
  melB: MEL('0:E5:4 4:G5:4 8:B5:8 16:D5:4 20:C5:4 24:E5:8 32:B4:4 36:D5:4 40:G5:8 48:F#5:4 52:D5:4 56:B4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'nylon cello', 0.68),
    sec('A', 'melA', 'roll', 'nylon cello', 0.88),
    sec('B', 'melB', 'flow', 'nylon cello', 1.0),
  ],
});

/* --------------------------------- ПОДЪЁМ --------------------------------- */
tr('ascent', 'Восхождение', 'фортепиано, бас, драм-машина', 'boom', {
  bpm: 108, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('A2 E3 A3 C#4 | G#2 E3 G#3 B3 | F#2 C#3 F#3 A3 | D3 A3 D4 F#4 | A2 E3 A3 C#4 | E3 B3 E4 G#4 | D3 A3 D4 F#4 | E3 B3 D4 G#4'),
  B: H('D3 A3 D4 F#4 | C#3 G#3 C#4 E4 | B2 F#3 B3 D4 | E3 B3 D4 G#4'),
  melA: MEL('0:E5:4 4:F#5:2 6:E5:2 8:C#5:8 16:B4:4 20:C#5:4 24:E5:8 32:F#5:4 36:E5:2 38:C#5:2 40:A4:8 48:D5:4 52:F#5:4 56:A5:8 64:E5:4 68:F#5:2 70:E5:2 72:C#5:8 80:B4:4 84:E5:4 88:G#5:8 96:A5:4 100:F#5:4 104:D5:8 112:E5:4 116:D5:4 120:C#5:8'),
  melB: MEL('0:F#5:4 4:A5:4 8:D6:8 16:E5:4 20:G#5:4 24:C#6:8 32:D5:4 36:F#5:4 40:B5:8 48:G#5:4 52:E5:4 56:B4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.75, DR('x.......x.......', '................', '..o...o...o...o.')),
    sec('A', 'melA', 'flow', 'piano bass pad', 0.9, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'roll', 'piano harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
  ],
});
tr('boulevard', 'Бульвар', 'аналоговый пад, фортепиано, бас', 'boom', {
  bpm: 116, swing: 0, reverb: 0.3,
  bassLine: 'drive',
  A: H('E2 B2 E3 G#3 | C#3 G#3 B3 E4 | A2 E3 A3 C#4 | B2 F#3 B3 D#4 | E2 B2 E3 G#3 | C#3 G#3 B3 E4 | F#2 C#3 F#3 A3 | B2 F#3 B3 D#4'),
  B: H('A2 E3 A3 C#4 | B2 F#3 B3 D#4 | G#2 D#3 G#3 B3 | C#3 G#3 B3 E4'),
  melA: MEL('0:B4:4 4:E5:4 8:G#5:8 16:F#5:4 20:E5:4 24:C#5:8 32:E5:4 36:A5:4 40:C#6:8 44:B5:4 48:F#5:4 52:D#5:4 56:B4:8 64:B4:4 68:E5:4 72:G#5:8 80:F#5:4 84:G#5:4 88:E5:8 96:A5:4 100:F#5:4 104:C#5:8 112:D#5:4 116:F#5:4 120:B4:8'),
  melB: MEL('0:C#5:4 4:E5:4 8:A5:8 16:B5:4 20:F#5:4 24:D#5:8 32:B4:4 36:D#5:4 40:G#5:8 48:E5:4 52:G#5:4 56:B5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass strings', 0.8, DR('x.......x.......', '....x.......x...', '..o...o...o...o.')),
    sec('B', 'melB', 'roll', 'piano harp bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('overdrive', 'Перегрев', 'фортепиано, бас, барабаны', 'boom', {
  bpm: 126, swing: 0, reverb: 0.22,
  bassLine: 'drive',
  A: H('B2 F#3 B3 D4 | A2 E3 A3 C#4 | G2 D3 G3 B3 | F#2 C#3 F#3 A3 | B2 F#3 B3 D4 | A2 E3 A3 C#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'),
  B: H('G2 D3 G3 B3 | D3 A3 D4 F#4 | E3 B3 E4 G4 | F#2 C#3 F#3 A3'),
  melA: MEL('0:F#5:2 2:A5:2 4:F#5:2 6:D5:2 8:B4:8 16:C#5:4 20:E5:4 24:A5:8 32:B5:4 36:G5:4 40:D5:8 48:C#5:4 52:A4:4 56:F#4:8 64:F#5:2 66:A5:2 68:B5:4 72:F#5:8 80:E5:4 84:C#5:4 88:A4:8 96:B4:4 100:E5:4 104:G5:8 112:A5:4 116:F#5:4 120:C#5:8'),
  melB: MEL('0:D5:4 4:G5:4 8:B5:8 16:A5:4 20:F#5:4 24:D5:8 32:G5:4 36:B5:4 40:E5:8 48:C#5:4 52:A5:4 56:F#5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.85, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass pad strings', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass pad violin', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------------- СПАД --------------------------------- */
tr('longwinter', 'Долгая зима', 'фортепиано и бас', 'slump', {
  bpm: 56, swing: 0.08, reverb: 0.58,
  bassLine: 'half',
  A: H('E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | B2 F#3 A3 D#4 | E2 B2 E3 G3 | C3 G3 B3 E4 | A2 E3 G3 C4 | E2 B2 E3 G3'),
  B: H('C3 G3 B3 E4 | G2 D3 G3 B3 | A2 E3 G3 C4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:G4:8 16:E4:12 32:A4:8 40:C5:8 48:B4:14 64:G4:8 72:E4:8 80:E5:12 96:C5:8 104:B4:8 112:E4:14'),
  melB: MEL('0:G4:8 8:B4:8 16:D5:12 32:C5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass', 0.66),
    sec('B', 'melB', 'air', 'piano bass cello pad', 0.85),
    sec('A', 'melA', 'waltz', 'piano bass cello pad strings', 1.0),
  ],
});
tr('emptyhalls', 'Пустые цеха', 'бас и фортепиано', 'slump', {
  bpm: 60, swing: 0.06, reverb: 0.55,
  bassLine: 'root',
  A: H('A2 E3 A3 C4 | G2 E3 A3 C4 | F2 C3 F3 A3 | E2 C3 G3 C4 | D3 A3 C4 F4 | C3 A3 C4 E4 | E2 B2 E3 A3 | A2 E3 A3 C4'),
  B: H('F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 C4 F4 | E2 B2 E3 G#3'),
  melA: MEL('0:A4:8 8:C5:8 16:B4:12 32:A4:8 40:F4:8 48:G4:14 64:F4:8 72:A4:8 80:E5:12 96:B4:8 104:A4:8 112:A4:14'),
  melB: MEL('0:C5:8 8:A4:8 16:G4:12 32:F4:8 40:D5:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass cello', 0.64),
    sec('A', 'melA', 'sustain', 'piano bass cello pad', 0.82),
    sec('B', 'melB', 'wide', 'piano bass cello pad strings', 1.0),
  ],
});
tr('patience', 'Терпение', 'фортепиано, аналоговый пад', 'slump', {
  bpm: 66, swing: 0.1, reverb: 0.5,
  bassLine: 'half', feel: 'loose',
  A: H('C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 G3 B3'),
  B: H('Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | Ab2 Eb3 Ab3 C4 | G2 D3 G3 B3'),
  melA: MEL('0:G4:8 8:Eb4:8 16:C5:12 32:Bb4:8 40:D5:8 48:G4:14 64:G4:8 72:C5:8 80:Eb5:12 96:C5:8 104:Ab4:8 112:G4:14'),
  melB: MEL('0:Bb4:8 8:Eb5:8 16:D5:12 32:C5:8 40:Ab4:8 48:B4:12'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68),
    sec('B', 'melB', 'wide', 'piano bass pad bells', 0.9),
    sec('A', 'melA', 'flow', 'piano bass pad strings violin', 1.0),
  ],
});

/* ------------------------------ СТАГФЛЯЦИЯ ------------------------------ */
tr('deadlock', 'Тупик', 'арпеджио, низкий пад', 'stag', {
  bpm: 80, swing: 0, reverb: 0.36,
  bassLine: 'pulse8',
  A: H('E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | E2 B2 E3 G3 | F2 C3 F3 A3 | C3 G3 C4 E4 | B2 D#3 F#3 A3'),
  B: H('F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | B2 D#3 F#3 A3'),
  melA: MEL('0:E4:8 8:F4:4 12:E4:4 16:F4:12 32:E4:8 40:D4:8 48:D4:14 64:E4:8 72:G4:8 80:F4:12 96:E4:8 104:C4:8 112:D#4:8 120:E4:8'),
  melB: MEL('0:A4:8 8:F4:8 16:G4:12 32:F4:8 40:D4:8 48:D#4:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass cello', 0.75, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'pulse', 'piano bass cello pad', 0.9, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'piano bass cello pad choir', 1.0, DR('x...x...x...x...', '........x.......', '..o...o...o...o.')),
  ],
});
tr('friction', 'Трение', 'фортепиано, PWM-пад', 'stag', {
  bpm: 86, swing: 0, reverb: 0.4,
  bassLine: 'root',
  A: H('D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | D3 A3 D4 F4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:D4:8 8:Eb4:4 12:D4:4 16:Eb4:12 32:F4:8 40:D4:8 48:C4:14 64:D4:8 72:F4:8 80:G4:12 96:D4:8 104:Bb3:8 112:C#4:8 120:D4:8'),
  melB: MEL('0:Bb4:8 8:F4:8 16:Eb4:12 32:D4:8 40:A4:8 48:C#4:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass choir', 0.75, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass cello choir pad', 0.95, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'piano bass cello choir pad', 1.0, DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')),
  ],
});

/* -------------------------------- КРИЗИС -------------------------------- */
tr('collapse', 'Обвал', 'бас, барабаны, фортепиано', 'crisis', {
  bpm: 128, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 F3 B3'),
  B: H('Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:2 2:Ab4:2 4:G4:2 6:F4:2 8:Eb4:8 16:Eb4:2 18:F4:2 20:Eb4:4 24:C4:8 32:G4:4 36:Bb4:4 40:Eb5:8 48:D5:4 52:Bb4:4 56:F4:8 64:G4:2 66:Ab4:2 68:G4:2 70:F4:2 72:Eb4:8 80:C5:4 84:Ab4:4 88:Eb4:8 96:Ab4:4 100:C5:4 104:F5:8 112:D5:4 116:B4:4 120:G4:8'),
  melB: MEL('0:Ab4:4 4:C5:4 8:Eb5:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:C5:4 40:Eb5:8 48:B4:4 52:D5:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass cello', 0.85, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass cello choir', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass cello choir violin', 1.0, DR('x..x..x.x.x..x..', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
tr('panic', 'Паника', 'аналоговый пад, литавры, бас', 'crisis', {
  bpm: 136, swing: 0, reverb: 0.3,
  bassLine: 'pulse8',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:A4:2 34:C5:2 36:A4:4 40:F4:8 48:E5:4 52:C5:4 56:G4:8 64:A4:2 66:Bb4:2 68:A4:2 70:G4:2 72:F4:8 80:D5:4 84:F5:4 88:Bb4:8 96:G4:4 100:Bb4:4 104:D5:8 112:C#5:4 116:E5:4 120:A4:8'),
  melB: MEL('0:F5:4 4:D5:4 8:Bb4:8 16:E5:4 20:C5:4 24:G4:8 32:A5:4 36:F5:4 40:D5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass strings timpani', 0.9, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass strings choir timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass strings violin timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
tr('bankrun', 'Очередь у банка', 'арпеджио, PWM-пад, бас', 'crisis', {
  bpm: 118, swing: 0, reverb: 0.34,
  bassLine: 'synco',
  A: H('G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | D3 A3 D4 F#4 | G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | D3 A3 D4 F#4'),
  B: H('Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | D3 A3 D4 F#4'),
  melA: MEL('0:D5:4 4:Eb5:4 8:D5:8 16:Bb4:4 20:G5:4 24:Eb5:8 32:C5:4 36:A4:4 40:F4:8 48:F#4:4 52:A4:4 56:D5:8 64:D5:4 68:Eb5:4 72:F5:8 80:G5:4 84:Eb5:4 88:Bb4:8 96:C5:4 100:Eb5:4 104:G5:8 112:F#5:4 116:A5:4 120:D5:8'),
  melB: MEL('0:G5:4 4:Bb5:4 8:Eb5:8 16:C5:4 20:F5:4 24:A4:8 32:Bb4:4 36:D5:4 40:G5:8 48:A5:4 52:F#5:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass cello', 0.85, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass cello choir timpani', 1.0, DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'piano bass cello choir strings timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------------- ВОЙНА --------------------------------- */
// Настоящий марш: пунктирный «длинный-короткий» ритм (3+1 шестнадцатых — то же
// «та-та́» дудочки и барабана, что в строевых маршах), духовые стабы на каждую
// четверть и малый барабан с форшлагами-дробью перед каждой сильной долей —
// вместо синтвейв-пэда и мелодии, унаследованной от «паники».
tr('warmarch', 'Марш', 'духовые стабы, дробь малого барабана, маршевый бас', 'war', {
  bpm: 112, swing: 0, reverb: 0.2,
  bassLine: 'drive',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | D3 A3 D4 F4 | A2 E3 G3 C#4'),
  melA: MEL('0:D4:3 3:F4:1 4:A4:3 7:D5:1 8:D5:4 12:C5:2 14:Bb4:2 16:C5:3 19:A4:1 20:F4:3 23:C5:1 24:Bb4:4 28:A4:2 30:G4:2 32:F4:3 35:A4:1 36:C5:3 39:F5:1 40:F5:4 44:E5:2 46:D5:2 48:E5:3 51:C5:1 52:G4:3 55:C5:1 56:C5:4 60:B4:2 62:A4:2 64:D4:3 67:F4:1 68:A4:3 71:D5:1 72:D5:4 76:C5:2 78:Bb4:2 80:C5:3 83:A4:1 84:F4:3 87:C5:1 88:Bb4:4 92:A4:2 94:G4:2 96:G4:3 99:Bb4:1 100:D5:3 103:G5:1 104:G5:4 108:F5:2 110:Eb5:2 112:E5:3 115:C#5:1 116:A4:3 119:E5:1 120:A4:4 124:D5:4'),
  melB: MEL('0:F4:3 3:Bb4:1 4:D5:3 7:F5:1 8:F5:4 12:D5:2 14:Bb4:2 16:E4:3 19:G4:1 20:C5:3 23:E5:1 24:E5:4 28:C5:2 30:G4:2 32:F4:3 35:A4:1 36:D5:3 39:F5:1 40:F5:4 44:D5:2 46:A4:2 48:C#5:3 51:E5:1 52:A4:3 55:C#5:1 56:A4:6 62:D5:2'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass brass timpani', 0.85, DR('x.......x.......', '....x.......x...', 'o...o...o...o...')),
    sec('B', 'melB', 'drive', 'piano bass brass timpani', 1.0, DR('x.......x.......', '....x.......xxx.', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'drive', 'piano bass brass strings cello timpani', 1.0, DR('x...x...x...x...', '....x.x.....xxx.', 'oooooooooooooooo')),
  ],
});
// Окопы: не марш, а гнетущая, замедленная поступь — редкая, тянущаяся мелодия
// в низком регистре без дроби и стабов, чтобы отчётливо звучать иначе, чем марш.
tr('trenches', 'Окопы', 'литавры, низкая виолончель, редкая поступь', 'war', {
  bpm: 90, swing: 0, reverb: 0.36,
  bassLine: 'half',
  A: H('G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | D3 A3 D4 F#4 | G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | D3 A3 D4 F#4'),
  B: H('Eb3 Bb3 Eb4 G4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | D3 A3 D4 F#4'),
  melA: MEL('0:Bb4:6 8:G4:4 12:D4:4 16:Eb5:6 24:Bb4:4 28:G4:4 32:A4:6 40:F4:4 44:C4:4 48:F#4:6 56:D4:4 60:A3:4 64:Bb4:6 72:G4:4 76:D4:4 80:Eb5:6 88:Bb4:4 92:G4:4 96:Eb4:6 104:C4:4 108:G3:4 112:F#4:6 120:A4:6'),
  melB: MEL('0:G4:4 4:Bb4:4 8:Eb5:8 16:F4:4 20:A4:4 24:C5:8 32:Bb4:4 36:D5:4 40:G5:8 48:F#4:4 52:A4:4 56:D5:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass cello timpani', 0.8, DR('x.......x.......', '....x...........', 'o.......o.......')),
    sec('B', 'melB', 'drive', 'piano bass cello timpani', 0.95, DR('x...x...x...x...', '....x.......x...', 'o...o...o...o...')),
    sec('A', 'melA', 'drive', 'piano bass cello strings timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});

/* ----------------------------- ТОТАЛИТАРНЫЙ РЕЖИМ ----------------------------- */
// Обе пьесы этого настроения нарочно построены только на новых голосах (guitar, growl) и
// драм-машине — ни один другой трек саундтрека не пользуется дисторшном, так что звучание
// тоталитарного режима не может быть спутано ни с чем прежним.
tr('ironmarch', 'Железный марш', 'дисторшн-гитара, тяжёлый бас, драм-машина', 'totalitarian', {
  bpm: 104, swing: 0, reverb: 0.22,
  bassLine: 'pulse8',
  A: H('D3 A3 D4 F4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | A2 E3 A3 C#4 | D3 A3 D4 F4 | D3 A3 D4 F4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | D3 A3 D4 F4 | A2 E3 A3 C#4'),
  melA: MEL('0:D4:3 3:F4:1 8:D4:3 11:F4:1 16:Bb3:3 19:D4:1 24:A3:3 27:C#4:1 32:D4:3 35:F4:1 40:D4:3 43:F4:1 48:G3:3 51:Bb3:1 56:A3:3 59:C#4:1'),
  melB: MEL('0:Bb3:3 3:D4:1 8:G3:3 11:Bb3:1 16:D4:3 19:F4:1 24:A3:3 27:C#4:1'),
  sections: [
    sec('A', 'melA', 'flow', 'guitar growl', 0.85, DR('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('B', 'melB', 'flow', 'guitar growl', 1.0, DR('x...x...x...x...', '....x.......xxx.', 'xxxxxxxxxxxxxxxx')),
    sec('A', 'melA', 'flow', 'guitar growl', 1.0, DR('x...x...x...x...', '....x...x...x...', 'oooooooooooooooo')),
  ],
});
// Комендантский час: не марш, а гнетущая пустота улиц — редкие гитарные вспышки над
// тяжёлым басовым дроном, шаги патруля вместо строевого шага.
tr('curfew', 'Комендантский час', 'бас-дрон, редкие гитарные вспышки', 'totalitarian', {
  bpm: 72, swing: 0, reverb: 0.42,
  bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | A2 E3 A3 C#4 | D3 A3 D4 F4 | A2 E3 A3 C#4'),
  melA: MEL('0:D4:8 16:F4:4 24:D4:4 32:Bb3:8 48:D4:4 56:Bb3:4'),
  melB: MEL('0:Bb3:8 16:D4:4 24:A3:4 32:A3:8 48:C#4:4 56:A3:4'),
  sections: [
    sec('A', 'melA', 'sustain', 'guitar growl', 0.7, DR('x...............', '................', '.......o........')),
    sec('B', 'melB', 'sustain', 'guitar growl', 0.85, DR('x.......x.......', '................', '.......o.......o')),
    sec('A', 'melA', 'sustain', 'guitar growl', 1.0, DR('x.......x.......', '....x...........', 'o.......o.......')),
  ],
});

/* ------------------------------- ДЕФЛЯЦИЯ ------------------------------- */
tr('glass', 'Стеклянный воздух', 'ретро-колокол, PWM-пад', 'frost', {
  bpm: 52, swing: 0, reverb: 0.72,
  bassLine: 'half',
  A: H('F2 C3 E3 A3 | C3 G3 B3 E4 | D3 A3 C4 F4 | Bb2 F3 A3 D4 | F2 C3 E3 A3 | A2 E3 G3 C4 | G2 D3 F3 Bb3 | C3 G3 C4 D4'),
  B: H('Bb2 F3 A3 D4 | C3 G3 B3 E4 | D3 A3 C4 F4 | C3 G3 C4 D4'),
  melA: MEL('0:C6:12 16:A5:12 32:F5:14 48:D5:14 64:C6:12 80:E5:12 96:Bb5:14 112:G5:14'),
  melB: MEL('0:D6:12 16:C6:12 32:A5:14 48:G5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad', 0.65),
    sec('B', 'melB', 'air', 'bells bass pad choir', 0.85),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 1.0),
  ],
});
tr('stillness', 'Ничего не происходит', 'PWM-пад, низкий пад', 'frost', {
  bpm: 48, swing: 0, reverb: 0.75,
  bassLine: 'half',
  A: H('Bb2 F3 A3 D4 | Eb3 Bb3 D4 G4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  B: H('G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  melA: MEL('0:D5:14 16:F5:14 32:G5:14 48:A5:14 64:D5:14 80:Bb4:14 96:G5:14 112:A5:14'),
  melB: MEL('0:Bb4:14 16:E5:14 32:G5:14 48:A5:14'),
  sections: [
    sec('A', 'melA', 'sustain', 'bells bass pad choir', 0.6),
    sec('B', 'melB', 'sustain', 'bells bass pad choir cello', 0.8),
    sec('A', 'melA', 'air', 'bells harp bass pad choir strings', 0.95),
  ],
});
/* ------------------------------ ТОРГОВЫЙ ЗАЛ ------------------------------
   Пьесы звучат только у роли «Частный инвестор»: другая инструментовка,
   другой пульс — рынок, а не министерство.                                 */
tr('openingbell', 'Открытие торгов', 'синт-лид, хай-хэт, синт-бас', 'calm', {
  bpm: 92, swing: 0.18, reverb: 0.32,
  bassLine: 'drive',
  A: H('D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 A3 D4 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:4 4:D5:4 8:F5:8 16:Bb4:4 20:D5:4 24:G5:8 32:E5:4 36:G5:4 40:Bb5:8 48:A5:4 52:F5:4 56:C5:8 64:D5:4 68:F5:4 72:A5:8 80:C#5:4 84:E5:4 88:A5:8 96:F5:4 100:D5:4 104:A4:8 112:C#5:4 116:E5:4 120:D5:8'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:E5:4 20:G5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'synth bass', 0.7, DR('x.......x.......', '................', '..o...o...o...o.')),
    sec('B', 'melB', 'wide', 'synth bass pad', 0.9, DR('x.......x.......', '....x.......x...', '..o...o...o...o.')),
    sec('A', 'melA', 'roll', 'synth harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('bidask', 'Бид и аск', 'синт-лид, драм-машина', 'boom', {
  bpm: 118, swing: 0, reverb: 0.24,
  bassLine: 'drive',
  A: H('C3 G3 C4 E4 | A2 E3 A3 C4 | F2 C3 F3 A3 | G2 D3 G3 B3 | C3 G3 C4 E4 | E3 B3 E4 G#4 | F2 C3 F3 A3 | G2 D3 F3 B3'),
  B: H('F2 C3 F3 A3 | G2 D3 G3 B3 | A2 E3 A3 C4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:2 2:C5:2 4:E5:4 8:G5:8 16:E5:4 20:A5:4 24:C6:8 32:A5:4 36:F5:4 40:C5:8 48:B4:4 52:D5:4 56:G5:8 64:G4:2 66:C5:2 68:E5:4 72:C5:8 80:G#5:4 84:E5:4 88:B4:8 96:A5:4 100:F5:4 104:C5:8 112:B4:4 116:D5:4 120:G4:8'),
  melB: MEL('0:A5:4 4:F5:4 8:C5:8 16:B5:4 20:G5:4 24:D5:8 32:C6:4 36:A5:4 40:E5:8 48:B4:4 52:F5:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'synth bass', 0.8, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'roll', 'synth harp bass pad strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'synth bass pad violin', 1.0, DR('x..x..x...x.....', '....x.......x...', 'oooooooooooooooo')),
  ],
});
tr('bearmarket', 'Медвежий рынок', 'синт-бас, синт-лид', 'slump', {
  bpm: 62, swing: 0.08, reverb: 0.56,
  bassLine: 'root',
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E2 B2 E3 G#3 | A2 E3 A3 C4 | G2 D3 G3 Bb3 | F2 C3 F3 A3 | E2 B2 E3 G#3'),
  B: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | E2 B2 E3 G#3'),
  melA: MEL('0:E5:8 8:C5:8 16:A4:12 32:D5:8 40:F5:8 48:E5:14 64:C5:8 72:A4:8 80:Bb4:12 96:A4:8 104:F4:8 112:G#4:14'),
  melB: MEL('0:F5:8 8:D5:8 16:Bb4:12 32:E5:8 40:C5:8 48:G#4:12'),
  sections: [
    sec('A', 'melA', 'air', 'synth bass cello', 0.64),
    sec('B', 'melB', 'sustain', 'synth bass cello pad', 0.84),
    sec('A', 'melA', 'wide', 'synth bass cello pad strings', 1.0),
  ],
});
tr('thinvolume', 'Тонкий рынок', 'синт-арпеджио, PWM-пад', 'stag', {
  bpm: 76, swing: 0, reverb: 0.38,
  bassLine: 'synco',
  A: H('E2 B2 E3 G3 | A2 E3 G3 C4 | E2 B2 E3 G3 | F2 C3 F3 A3 | E2 B2 E3 G3 | D3 A3 D4 F4 | C3 G3 C4 E4 | B2 F#3 A3 D#4'),
  B: H('A2 E3 G3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:A4:4 12:B4:4 16:G4:12 32:A4:8 40:C5:8 48:B4:14 64:E5:8 72:D5:8 80:C5:12 96:B4:8 104:G4:8 112:D#5:8 120:E4:8'),
  melB: MEL('0:C5:8 8:A4:8 16:F4:12 32:D5:8 40:A4:8 48:D#5:12'),
  sections: [
    sec('A', 'melA', 'pulse', 'synth bass choir', 0.74, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'pulse', 'synth bass cello choir pad', 0.92, DR('x.......x.......', '........x.......', '..o...o...o...o.')),
    sec('A', 'melA', 'pulse', 'synth bass cello choir pad', 1.0, DR('x...x...x...x...', '........x.......', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('marginwire', 'Маржин-колл', 'синт-бас, синт-том, аналоговый пад', 'crisis', {
  bpm: 132, swing: 0, reverb: 0.26,
  bassLine: 'drive',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4 | D3 A3 D4 F4 | F2 C3 F3 A3 | Bb2 F3 Bb3 D4 | A2 E3 G3 C#4'),
  B: H('G2 D3 G3 Bb3 | Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:Bb4:2 4:A4:2 6:G4:2 8:F4:8 16:D5:4 20:Bb4:4 24:F4:8 32:G4:4 36:Bb4:4 40:D5:8 48:C#5:4 52:E5:4 56:A4:8 64:A4:2 66:D5:2 68:F5:4 72:D5:8 80:C5:4 84:A4:4 88:F4:8 96:Bb4:4 100:D5:4 104:F5:8 112:E5:4 116:C#5:4 120:A4:8'),
  melB: MEL('0:Bb4:4 4:D5:4 8:G5:8 16:F5:4 20:D5:4 24:Bb4:8 32:C5:4 36:E5:4 40:G5:8 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'drive', 'synth bass cello', 0.88, DR('x..x..x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'synth bass strings timpani', 1.0, DR('x..x..x.x.x..x..', '....x.......x...', 'oooooooooooooooo')),
    sec('A', 'melA', 'drive', 'synth bass strings violin timpani', 1.0, DR('x.x.x.x.x.x.x.x.', '....x...x...x...', 'oooooooooooooooo')),
  ],
});

/* --------------------------- ЖИВОЙ СОСТАВ ---------------------------
   Пьесы, написанные не под синтезатор, а под состав: рояль, бас-гитара или
   контрабас, барабаны, акустическая гитара. Здесь у баса своя линия, у
   барабанщика — динамика и сбивки, а у мелодии — фразировка с ответом, а не
   ровная цепочка нот одинаковой длины.                                    */
tr('cabinet', 'Кабинет в семь утра', 'фортепианное трио: рояль, контрабас, щётки', 'calm', {
  bpm: 86, swing: 0.26, reverb: 0.38, feel: 'swing', bassLine: 'walk',
  A: H('F2 C3 E3 A3 | D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | A2 E3 G3 C4 | D3 A3 C4 F4 | G2 D3 F3 Bb3 | C3 G3 Bb3 E4'),
  B: H('Bb2 F3 A3 D4 | A2 E3 G3 C#4 | D3 A3 C4 F4 | C3 G3 Bb3 E4'),
  melA: MEL('0:A4:4 4:C5:4 8:F5:6 16:E5:4 20:D5:4 24:A4:8 32:Bb4:4 36:D5:4 40:F5:6 48:E5:8 56:C5:8 64:C5:4 68:E5:4 72:A5:6 80:G5:4 84:F5:4 88:D5:8 96:Bb4:4 100:D5:4 104:G5:6 112:F5:4 116:E5:4 120:C5:10'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:C#5:4 20:E5:4 24:A5:8 32:F5:4 36:A5:4 40:D6:8 48:E5:4 52:G5:4 56:C5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.68, DR('x.......x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('B', 'melB', 'wide', 'piano bass', 0.88, DR('x.....x.x.......', '....x.......x...', 'r..r.r..r..r.r..', { ghost: true })),
    sec('A', 'melA', 'flow', 'piano bass strings', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});
tr('sixstring', 'Шесть струн', 'акустическая гитара, бас, барабаны', 'calm', {
  bpm: 104, swing: 0.1, reverb: 0.34, feel: 'loose', bassLine: 'root',
  A: H('G2 D3 G3 B3 | E2 B2 E3 G3 | C3 G3 C4 E4 | D3 A3 D4 F#4 | G2 D3 G3 B3 | E2 B2 E3 G3 | A2 E3 A3 C4 | D3 A3 D4 F#4'),
  B: H('C3 G3 C4 E4 | D3 A3 D4 F#4 | B2 F#3 B3 D4 | E2 B2 E3 G3'),
  melA: MEL('0:D5:4 4:G5:4 8:B5:6 16:A5:4 20:G5:4 24:E5:8 32:E5:4 36:G5:4 40:C6:6 48:B5:4 52:A5:4 56:D5:8 64:D5:4 68:G5:4 72:B5:6 80:A5:4 84:B5:4 88:G5:8 96:E5:4 100:A5:4 104:C6:6 112:B5:4 116:A5:4 120:G5:10'),
  melB: MEL('0:G5:4 4:C6:4 8:E6:8 16:D6:4 20:A5:4 24:F#5:8 32:B5:4 36:D6:4 40:F#6:8 48:E6:4 52:B5:4 56:G5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'strum bass nylon', 0.7, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'wide', 'strum bass nylon', 0.9, DR('x.....x.x.......', '....x.......x...', 'o.o.o.o.o.o.o.O.')),
    sec('A', 'melA', 'flow', 'strum bass nylon strings', 1.0, DR('x..x..x.x..x....', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});
tr('fullhouse', 'Полный зал', 'рояль, бас, барабаны — быстрый темп', 'boom', {
  bpm: 138, swing: 0, reverb: 0.26, bassLine: 'drive',
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | C3 G3 C4 E4 | G2 D3 G3 B3 | A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E3 B3 E4 G4'),
  B: H('F2 C3 F3 A3 | G2 D3 G3 B3 | A2 E3 A3 C4 | E3 B3 E4 G4'),
  melA: MEL('0:A4:2 2:C5:2 4:E5:4 8:A5:6 16:G5:2 18:F5:2 20:E5:4 24:C5:8 32:C5:2 34:E5:2 36:G5:4 40:C6:6 48:B5:2 50:A5:2 52:G5:4 56:D5:8 64:A4:2 66:C5:2 68:E5:4 72:A5:6 80:C6:2 82:B5:2 84:A5:4 88:F5:8 96:D5:2 98:F5:2 100:A5:4 104:D6:6 112:B5:4 116:G5:4 120:E5:8'),
  melB: MEL('0:F5:2 2:A5:2 4:C6:4 8:F6:6 16:D6:2 18:B5:2 20:G5:4 24:D5:8 32:E5:2 34:A5:2 36:C6:4 40:E6:6 48:D6:4 52:B5:4 56:E5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.82, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass brass', 1.0, DR('x..x....x...x...', '....x.......x..x', 'oooooooooooooooo', { ghost: true })),
    sec('A', 'melA', 'drive', 'piano bass brass strings', 1.0, DR('x..x..x.x...x..x', '....x...x...x...', 'oooooooooooooooo', { ghost: true })),
  ],
});
tr('nightshift', 'Ночная смена', 'рояль и бас, редкие барабаны', 'slump', {
  bpm: 74, swing: 0.18, reverb: 0.5, feel: 'loose', bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 A3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C4 | D3 A3 D4 F4 | F2 C3 F3 A3 | Bb2 F3 A3 D4 | A2 E3 A3 C#4'),
  B: H('G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | Bb2 F3 A3 D4 | A2 E3 A3 C#4'),
  melA: MEL('0:D5:6 8:F5:6 16:A5:10 32:Bb4:6 40:D5:6 48:F5:12 64:G4:6 72:Bb4:6 80:D5:10 96:C5:6 104:A4:6 112:D5:12'),
  melB: MEL('0:Bb4:6 8:D5:6 16:G5:12 32:Eb5:6 40:G5:6 48:C6:12'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano bass', 0.6, DR('x...............', '........x.......', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass pad', 0.8, DR('x.......x.......', '........x.......', 'o...o...o...o...')),
    sec('A', 'melA', 'flow', 'piano bass pad cello', 0.95, DR('x.....x.x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
  ],
});
tr('treadmill', 'Бег на месте', 'синкопированный бас, рояль, барабаны', 'stag', {
  bpm: 112, swing: 0.14, reverb: 0.3, bassLine: 'synco',
  A: H('E2 B2 E3 G3 | C3 G3 C4 E4 | D3 A3 D4 F4 | B2 F#3 B3 D4 | E2 B2 E3 G3 | A2 E3 A3 C4 | C3 G3 C4 E4 | B2 F#3 B3 D4'),
  B: H('A2 E3 A3 C4 | D3 A3 D4 F4 | G2 D3 G3 B3 | B2 F#3 B3 D4'),
  melA: MEL('0:B4:3 3:E5:3 6:G5:6 16:C5:3 19:E5:3 22:G5:6 32:D5:3 35:F5:3 38:A5:6 48:F#5:6 56:D5:6 64:B4:3 67:E5:3 70:B5:6 80:C5:3 83:A4:3 86:E5:6 96:G5:3 99:E5:3 102:C5:6 112:B4:6 120:F#4:6'),
  melB: MEL('0:A4:3 3:C5:3 6:E5:6 16:D5:3 19:F5:3 22:A5:6 32:G5:3 35:B5:3 38:D6:6 48:F#5:6 56:B4:6'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano bass', 0.75, DR('x.....x...x.....', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
    sec('B', 'melB', 'drive', 'piano bass pad', 0.92, DR('x.....x...x...x.', '....x.......x...', 'oo.ooo.ooo.ooo.o', { ghost: true })),
    sec('A', 'melA', 'pulse', 'piano bass pad strings', 1.0, DR('x.....x...x.....', '....x...x...x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});

/* ------------------------------ ОБУЧЕНИЕ ------------------------------
   Курсам нужна своя музыка: не тревожная и не парадная, а такая, под которую
   спокойно читают и решают задачи. Три пьесы на разный темп — от медленной
   первой лекции до бодрого экзамена.                                      */
tr('firstlesson', 'Первый урок', 'рояль и нейлоновая гитара', 'calm', {
  bpm: 92, swing: 0.16, reverb: 0.42, feel: 'loose', bassLine: 'half',
  A: H('C3 G3 C4 E4 | A2 E3 A3 C4 | F2 C3 F3 A3 | G2 D3 G3 B3 | C3 G3 C4 E4 | E3 B3 E4 G4 | F2 C3 F3 A3 | G2 D3 G3 B3'),
  B: H('A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | G2 D3 G3 B3'),
  melA: MEL('0:E5:4 4:G5:4 8:C6:8 16:B5:4 20:A5:4 24:E5:8 32:F5:4 36:A5:4 40:C6:8 48:D6:4 52:B5:4 56:G5:8 64:E5:4 68:C5:4 72:G5:8 80:B5:4 84:G5:4 88:E5:8 96:A5:4 100:F5:4 104:C6:8 112:D6:4 116:B5:4 120:C6:10'),
  melB: MEL('0:C6:4 4:A5:4 8:E5:8 16:A5:4 20:F5:4 24:C5:8 32:D5:4 36:F5:4 40:A5:8 48:B5:4 52:D6:4 56:G5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.62, DR('x.......x.......', '................', '....o.......o...')),
    sec('B', 'melB', 'wide', 'piano bass nylon', 0.82, DR('x.......x.......', '........x.......', 'o...o...o...o...')),
    sec('A', 'melA', 'flow', 'piano bass nylon strings', 0.95, DR('x.....x.x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
  ],
});
tr('chalkboard', 'Мел и доска', 'маримба, бас, щётки', 'calm', {
  bpm: 100, swing: 0.24, reverb: 0.36, feel: 'swing', bassLine: 'walk',
  A: H('Bb2 F3 A3 D4 | G2 D3 F3 Bb3 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3 | Bb2 F3 A3 D4 | D3 A3 C4 F4 | Eb3 Bb3 D4 G4 | F2 C3 E3 A3'),
  B: H('G2 D3 F3 Bb3 | C3 G3 Bb3 E4 | F2 C3 E3 A3 | Bb2 F3 A3 D4'),
  melA: MEL('0:D5:4 4:F5:4 8:Bb5:6 16:A5:4 20:G5:4 24:D5:8 32:G5:4 36:Bb5:4 40:Eb6:6 48:D6:4 52:C6:4 56:A5:8 64:D5:4 68:A5:4 72:F5:6 80:C6:4 84:A5:4 88:F5:8 96:G5:4 100:Bb5:4 104:D6:6 112:C6:4 116:A5:4 120:Bb5:10'),
  melB: MEL('0:Bb5:4 4:D6:4 8:G6:8 16:E6:4 20:C6:4 24:G5:8 32:A5:4 36:C6:4 40:F6:8 48:D6:4 52:Bb5:4 56:F5:10'),
  sections: [
    sec('A', 'melA', 'flow', 'marimba bass', 0.66, DR('x.......x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('B', 'melB', 'wide', 'marimba bass piano', 0.86, DR('x.....x.x.......', '....x.......x...', 'r..r.r..r..r.r..', { ghost: true })),
    sec('A', 'melA', 'flow', 'marimba bass piano strings', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});
tr('graduation', 'Выпуск', 'рояль, бас, барабаны — экзаменационный темп', 'boom', {
  bpm: 126, swing: 0, reverb: 0.3, bassLine: 'drive',
  A: H('D3 A3 D4 F#4 | B2 F#3 B3 D4 | G2 D3 G3 B3 | A2 E3 A3 C#4 | D3 A3 D4 F#4 | F#2 C#3 F#3 A3 | G2 D3 G3 B3 | A2 E3 A3 C#4'),
  B: H('G2 D3 G3 B3 | A2 E3 A3 C#4 | B2 F#3 B3 D4 | E3 B3 E4 G4'),
  melA: MEL('0:D5:2 2:F#5:2 4:A5:4 8:D6:6 16:C#6:2 18:B5:2 20:A5:4 24:F#5:8 32:G5:2 34:B5:2 36:D6:4 40:G6:6 48:F#6:4 52:D6:4 56:A5:8 64:D5:2 66:A5:2 68:F#5:4 72:D6:6 80:C#6:2 82:A5:2 84:F#5:4 88:C#5:8 96:B5:2 98:G5:2 100:D6:4 104:B5:6 112:C#6:4 116:A5:4 120:D6:8'),
  melB: MEL('0:G5:2 2:B5:2 4:D6:4 8:G6:6 16:E6:2 18:C#6:2 20:A5:4 24:E5:8 32:F#5:2 34:B5:2 36:D6:4 40:F#6:6 48:G6:4 52:E6:4 56:B5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass', 0.8, DR('x.......x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass brass', 0.96, DR('x..x....x...x...', '....x.......x..x', 'oooooooooooooooo', { ghost: true })),
    sec('A', 'melA', 'drive', 'piano bass brass strings', 1.0, DR('x..x..x.x...x..x', '....x...x...x...', 'oooooooooooooooo', { ghost: true })),
  ],
});

/* ------------------------------- КАЗИНО ------------------------------- */
// не привязана к режиму экономики — переключается локально при входе на
// вкладку «Казино» (см. Audio.setPlaylist('casino')/(null)), поэтому обе
// темы нарочно бодрые и «фоново-лаунжевые» вне зависимости от состояния
// экономики за окном
tr('chips', 'Фишки и блеск', 'свинг-фортепиано, контрабас, щётки', 'casino', {
  bpm: 124, swing: 0.32, reverb: 0.3,
  bassLine: 'walk', feel: 'swing',
  A: H('C3 A3 C4 E4 | A2 G3 A3 C4 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 A3 C4 E4 | A2 G3 A3 C4 | D3 C4 D4 F4 | G2 F3 G3 B3'),
  B: H('F2 D3 F3 A3 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 A3 C4 E4'),
  melA: MEL('0:E4:2 2:G4:2 4:C5:2 6:E5:2 8:D5:4 12:C5:4 16:C5:2 18:E5:2 20:A4:2 22:C5:2 24:B4:4 28:A4:4 32:F4:2 34:A4:2 36:D5:2 38:F5:2 40:E5:4 44:D5:4 48:D5:2 50:B4:2 52:G4:2 54:D5:2 56:B4:4 60:G4:4 64:E4:2 66:G4:2 68:C5:2 70:E5:2 72:D5:4 76:C5:4 80:C5:2 82:E5:2 84:A4:2 86:C5:2 88:B4:4 92:A4:4 96:F4:2 98:A4:2 100:D5:2 102:Eb5:2 104:D5:4 108:C5:4 112:D5:2 114:B4:2 116:G4:2 118:D5:2 120:G5:4 124:D5:4'),
  melB: MEL('0:A4:2 2:C5:2 4:F5:2 6:A5:2 8:G5:4 12:F5:4 16:D5:2 18:F5:2 20:A5:2 22:C6:2 24:A5:4 28:F5:4 32:B4:2 34:D5:2 36:G5:2 38:B5:2 40:A5:4 44:G5:4 48:E5:2 50:G5:2 52:C6:2 54:E5:2 56:C5:6 62:E5:2'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass cello harp', 0.85, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('B', 'melB', 'drive', 'piano bass cello harp bells', 1.0, DR('x...x...x...x...', '....x...x...x...', 'xxxxxxxxxxxxxxxx')),
    sec('A', 'melA', 'drive', 'piano bass cello harp bells timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'xxxxxxxxxxxxxxxx')),
  ],
});
tr('croupier', 'Крупье', 'вибрафон, фортепиано, контрабас — джаз-лаунж', 'casino', {
  bpm: 96, swing: 0.28, reverb: 0.4,
  bassLine: 'walk', feel: 'swing',
  A: H('D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4 | D3 C4 D4 F4 | G2 F3 G3 B3 | C3 B3 C4 E4 | A2 G3 A3 C#4'),
  B: H('F2 E3 F3 A3 | E3 D4 E4 G4 | A2 G3 A3 C4 | A2 G3 A3 C#4'),
  melA: MEL('0:D4:6 8:A4:4 12:F4:4 16:G4:6 24:B4:4 28:G4:4 32:C5:6 40:E5:4 44:C5:4 48:C#5:6 56:A4:4 60:E4:4 64:D4:6 72:A4:4 76:F4:4 80:G4:6 88:B4:4 92:G4:4 96:C5:6 104:E5:4 108:C5:4 112:C#5:6 120:D5:8'),
  melB: MEL('0:A4:6 8:F4:4 12:E4:4 16:G4:6 24:E4:4 28:D4:4 32:A4:6 40:C5:4 44:A4:4 48:C#5:6 56:A4:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'marimba bass cello timpani', 0.78, DR('x.......x.......', '....x.......x...', 'x...x...x...x...')),
    sec('B', 'melB', 'sustain', 'marimba bass cello strings timpani', 0.92, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('A', 'melA', 'sustain', 'marimba bass cello strings bells timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
  ],
});

/* -------------------------------- ЗАГЛАВНАЯ -------------------------------- */
/* Тема главного меню: рояль ведёт мелодию, струнные держат зал, барабаны почти
   не слышны — это ещё не партия, это дверь в кабинет. */
tr('anthem', 'Герб на двери', 'рояль, струнные, контрабас — заглавная тема', 'calm', {
  bpm: 88, swing: 0.08, reverb: 0.44, bassLine: 'half',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | A2 E3 A3 C#4'),
  melA: MEL('0:D5:4 4:F5:4 8:A5:6 16:G5:4 20:F5:4 24:D5:8 32:F5:4 36:A5:4 40:C6:6 48:Bb5:4 52:A5:4 56:F5:8 64:A5:4 68:G5:4 72:F5:6 80:E5:4 84:D5:4 88:C5:8 96:Bb4:4 100:D5:4 104:G5:6 112:F5:4 116:E5:4 120:D5:10'),
  melB: MEL('0:F5:4 4:Bb5:4 8:D6:8 16:C6:4 20:A5:4 24:F5:8 32:Bb5:4 36:D6:4 40:F6:6 48:E6:4 52:C#6:4 56:A5:10'),
  sections: [
    sec('A', 'melA', 'air', 'piano bass', 0.6, DR('x.......x.......', '................', 'r...r...r...r...')),
    sec('B', 'melB', 'flow', 'piano bass strings', 0.85, DR('x.....x.x.......', '....x.......x...', 'r...r...r...r...', { ghost: true })),
    sec('A', 'melA', 'flow', 'piano bass strings cello', 1.0, DR('x.....x.x.....x.', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
  ],
});

/* ----------------------------- ПРЕДВЫБОРНАЯ КАМПАНИЯ ----------------------------- */
// Звучит в последние кварталы перед голосованием, пока экономика не в кризисе:
// митинговая бодрость с духовыми и песня «от двери к двери» под гитарный бой.
tr('rally', 'Митинг на площади', 'духовые, рояль, бас, барабаны', 'campaign', {
  bpm: 116, swing: 0, reverb: 0.28,
  bassLine: 'drive',
  A: H('G2 D3 G3 B3 | E3 B3 E4 G4 | C3 G3 C4 E4 | D3 A3 D4 F#4 | G2 D3 G3 B3 | B2 F#3 B3 D4 | C3 G3 C4 E4 | D3 A3 C4 F#4'),
  B: H('C3 G3 C4 E4 | D3 A3 D4 F#4 | E3 B3 E4 G4 | D3 A3 C4 F#4'),
  melA: MEL('0:D5:3 3:B4:1 4:G4:4 8:B4:2 10:D5:2 12:G5:4 16:E5:6 22:D5:2 24:B4:4 28:G4:4 32:C5:3 35:E5:1 36:G5:4 40:E5:4 44:C5:4 48:D5:6 54:C5:2 56:A4:8 64:D5:3 67:B4:1 68:G4:4 72:B4:2 74:D5:2 76:G5:4 80:F#5:6 86:D5:2 88:B4:8 96:E5:3 99:G5:1 100:C6:4 104:G5:4 108:E5:4 112:F#5:4 116:A5:4 120:D5:8'),
  melB: MEL('0:E5:4 4:G5:4 8:C6:6 14:B5:2 16:A5:4 20:F#5:4 24:D5:8 32:G5:4 36:E5:4 40:B4:6 46:D5:2 48:C5:4 52:D5:4 56:F#5:4 60:A5:4'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass brass', 0.82, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'drive', 'piano bass brass strings', 0.95, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.oO')),
    sec('A', 'melA', 'drive', 'piano bass brass strings timpani', 1.0, DR('x...x...x.x.x...', '....x.......x.x.', 'oooooooooooooooo')),
  ],
});
tr('doorbell', 'От двери к двери', 'гитарный бой, нейлон, бас, колокольчики', 'campaign', {
  bpm: 100, swing: 0.1, reverb: 0.3,
  bassLine: 'root', feel: 'loose',
  A: H('D3 A3 D4 F#4 | A2 E3 A3 C#4 | B2 F#3 B3 D4 | G2 D3 G3 B3 | D3 A3 D4 F#4 | A2 E3 A3 C#4 | G2 D3 G3 B3 | A2 E3 G3 C#4'),
  B: H('G2 D3 G3 B3 | D3 A3 D4 F#4 | E3 B3 E4 G4 | A2 E3 G3 C#4'),
  melA: MEL('0:F#4:2 2:A4:2 4:D5:4 8:C#5:2 10:D5:2 12:A4:4 16:E4:2 18:A4:2 20:C#5:4 24:B4:2 26:C#5:2 28:E5:4 32:D5:4 36:F#5:4 40:D5:2 42:B4:2 44:F#4:4 48:G4:4 52:B4:4 56:D5:8 64:F#5:2 66:E5:2 68:D5:4 72:A4:4 76:F#4:4 80:E4:2 82:A4:2 84:C#5:4 88:E5:4 92:A4:4 96:B4:4 100:D5:4 104:G5:4 108:B4:4 112:C#5:4 116:E5:2 118:G5:2 120:A4:8'),
  melB: MEL('0:B4:4 4:D5:4 8:G5:8 16:F#5:4 20:D5:4 24:A4:8 32:G4:4 36:B4:4 40:E5:6 46:G5:2 48:E5:4 52:C#5:4 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'strum nylon bass', 0.8, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.', { ghost: true })),
    sec('B', 'melB', 'flow', 'strum nylon bass bells', 0.95, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.oO', { ghost: true })),
    sec('A', 'melA', 'flow', 'strum nylon bass strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo', { ghost: true })),
  ],
});

/* ------------------------------ РУЧНОЕ УПРАВЛЕНИЕ ------------------------------ */
// Авторитарный режим — ещё не тоталитарный грохот гитар, а холодный порядок:
// размеренные струнные с литаврами и синтетические коридоры с пульсирующим басом.
tr('decree', 'Указ', 'струнные, рояль, виолончель, литавры', 'authoritarian', {
  bpm: 84, swing: 0, reverb: 0.4,
  bassLine: 'half',
  A: H('C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | F2 C3 F3 Ab3 | G2 D3 G3 B3 | C3 G3 C4 Eb4 | Eb3 Bb3 Eb4 G4 | F2 C3 F3 Ab3 | G2 D3 F3 B3'),
  B: H('Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | Eb3 Bb3 Eb4 G4 | G2 D3 F3 B3'),
  melA: MEL('0:G4:6 6:Eb4:2 8:C4:4 12:G4:4 16:Ab4:6 22:G4:2 24:Eb4:8 32:F4:6 38:Ab4:2 40:C5:4 44:Ab4:4 48:B4:6 54:D5:2 56:G4:8 64:C5:6 70:Eb5:2 72:G5:4 76:Eb5:4 80:G5:6 86:F5:2 88:Eb5:4 92:Bb4:4 96:Ab4:6 102:C5:2 104:F5:4 108:Ab4:4 112:B4:4 116:D5:4 120:F5:4 124:D5:4'),
  melB: MEL('0:C5:6 6:Eb5:2 8:Ab5:8 16:Bb4:6 22:D5:2 24:F5:8 32:G5:6 38:F5:2 40:Eb5:4 44:Bb4:4 48:B4:6 54:D5:2 56:G5:8'),
  sections: [
    sec('A', 'melA', 'sustain', 'piano cello strings timpani', 0.75, DR('x.......x.......', '................', 'o.......o.......', { fill: false })),
    sec('B', 'melB', 'wide', 'piano cello strings brass timpani', 0.92, DR('x.......x.......', '....x.......x...', 'o...o...o...o...')),
    sec('A', 'melA', 'wide', 'piano violin cello strings timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'o...o...o...o...')),
  ],
});
tr('corridors', 'Коридоры власти', 'синтезатор, пульсирующий бас, пад', 'authoritarian', {
  bpm: 92, swing: 0, reverb: 0.46,
  bassLine: 'pulse8',
  A: H('E3 B3 E4 G4 | C3 G3 C4 E4 | A2 E3 A3 C4 | B2 F#3 B3 D#4 | E3 B3 E4 G4 | C3 G3 C4 E4 | D3 A3 D4 F#4 | B2 F#3 A3 D#4'),
  B: H('C3 G3 C4 E4 | A2 E3 A3 C4 | D3 A3 D4 F#4 | B2 F#3 A3 D#4'),
  melA: MEL('0:B4:8 8:G4:4 12:E5:4 16:E5:8 24:G5:4 28:E5:4 32:C5:8 40:E5:4 44:A4:4 48:D#5:8 56:F#5:4 60:B4:4 64:G5:8 72:E5:4 76:B4:4 80:C5:8 88:E5:4 92:G5:4 96:F#5:8 104:A5:4 108:D5:4 112:D#5:8 120:B4:8'),
  melB: MEL('0:G5:6 6:E5:2 8:C5:8 16:A4:6 22:C5:2 24:E5:8 32:F#5:6 38:D5:2 40:A4:8 48:B4:6 54:D#5:2 56:F#5:8'),
  sections: [
    sec('A', 'melA', 'pulse', 'synth pad bass', 0.75, DR('x.......x.......', '................', '..o...o...o...o.', { fill: false })),
    sec('B', 'melB', 'pulse', 'synth lead pad bass', 0.9, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'pulse', 'synth lead pad bass strings', 1.0, DR('x...x...x...x...', '....x.......x...', 'oooooooooooooooo')),
  ],
});

/* -------------------------------- СТАБИЛИЗАЦИЯ -------------------------------- */
// Программа стабилизации объявлена и ей начинают верить: минор кризиса ещё звучит,
// но припев уходит в мажор — «якорь» держит, «твёрдая рука» ведёт ровным шагом.
tr('anchor', 'Якорь', 'рояль, струнные, колокольчики', 'stabilization', {
  bpm: 80, swing: 0.06, reverb: 0.44,
  bassLine: 'half',
  A: H('A2 E3 A3 C4 | F2 C3 F3 A3 | C3 G3 C4 E4 | G2 D3 G3 B3 | A2 E3 A3 C4 | F2 C3 F3 A3 | D3 A3 D4 F4 | E3 B3 D4 G#4'),
  B: H('C3 G3 C4 E4 | G2 D3 G3 B3 | F2 C3 F3 A3 | C3 G3 C4 E4'),
  melA: MEL('0:E5:4 4:C5:4 8:A4:4 12:C5:4 16:A4:6 22:C5:2 24:F5:8 32:E5:4 36:G5:4 40:C5:4 44:E5:4 48:D5:6 54:B4:2 56:G4:8 64:A4:4 68:C5:4 72:E5:4 76:A5:4 80:A5:6 86:G5:2 88:F5:4 92:C5:4 96:D5:4 100:F5:4 104:A5:4 108:F5:4 112:G#5:6 118:E5:2 120:B4:8'),
  melB: MEL('0:G5:6 6:E5:2 8:C5:8 16:D5:6 22:G5:2 24:B5:8 32:A5:6 38:F5:2 40:C5:4 44:A4:4 48:C5:4 52:E5:4 56:G5:4 60:C6:4'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass pad', 0.72),
    sec('A', 'melA', 'flow', 'piano bass strings', 0.85, DR('x.......x.......', '....x.......x...', 'o...o...o...o...')),
    sec('B', 'melB', 'wide', 'piano bass strings bells', 1.0, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
  ],
});
tr('firmhand', 'Твёрдая рука', 'рояль, виолончель, ровный барабанный шаг', 'stabilization', {
  bpm: 96, swing: 0, reverb: 0.32,
  bassLine: 'root',
  A: H('D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | C3 G3 C4 E4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | A2 E3 G3 C#4'),
  B: H('Bb2 F3 Bb3 D4 | C3 G3 C4 E4 | F2 C3 F3 A3 | A2 E3 G3 C#4'),
  melA: MEL('0:A4:2 2:A4:2 4:D5:4 8:A4:2 10:A4:2 12:F5:4 16:F5:4 20:D5:4 24:Bb4:8 32:C5:2 34:C5:2 36:F5:4 40:C5:2 42:C5:2 44:A5:4 48:G5:4 52:E5:4 56:C5:8 64:D5:2 66:E5:2 68:F5:4 72:A5:4 76:F5:4 80:D5:4 84:F5:4 88:Bb5:8 96:G5:4 100:D5:4 104:Bb4:4 108:D5:4 112:C#5:4 116:E5:4 120:A5:8'),
  melB: MEL('0:D5:4 4:F5:4 8:Bb5:8 16:C6:4 20:G5:4 24:E5:8 32:F5:4 36:A5:4 40:C6:6 46:A5:2 48:G5:4 52:E5:4 56:C#5:4 60:E5:4'),
  sections: [
    sec('A', 'melA', 'pulse', 'piano cello', 0.78, DR('x.......x.......', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('B', 'melB', 'pulse', 'piano cello strings', 0.92, DR('x...x...x...x...', '....x.......x...', 'o.o.o.o.o.o.o.o.')),
    sec('A', 'melA', 'pulse', 'piano cello strings timpani', 1.0, DR('x...x...x...x...', '....x.......x.x.', 'oooooooooooooooo')),
  ],
});

/* --------------------------- ПОПОЛНЕНИЕ ТОНКИХ ПЛЕЙЛИСТОВ --------------------------- */
// Дефляция: иней на стекле — маримба и арфа в высоком регистре, большие септаккорды
tr('hoarfrost', 'Иней', 'маримба, арфа, колокольчики', 'frost', {
  bpm: 60, swing: 0, reverb: 0.7,
  bassLine: 'half',
  A: H('E3 B3 D#4 G#4 | A2 E3 G#3 C#4 | C#3 G#3 B3 E4 | B2 F#3 A3 D#4 | E3 B3 D#4 G#4 | G#2 D#3 F#3 B3 | A2 E3 G#3 C#4 | B2 F#3 A3 E4'),
  B: H('A2 E3 G#3 C#4 | F#2 C#3 E3 A3 | G#2 D#3 F#3 B3 | B2 F#3 A3 D#4'),
  melA: MEL('0:B5:8 8:G#5:8 16:C#6:12 28:G#5:4 32:E5:8 40:G#5:8 48:F#5:12 60:D#5:4 64:G#5:8 72:B5:8 80:D#6:12 92:B5:4 96:C#6:8 104:E6:8 112:B5:16'),
  melB: MEL('0:E6:12 12:C#6:4 16:A5:12 28:C#6:4 32:B5:12 44:F#5:4 48:D#5:16'),
  sections: [
    sec('A', 'melA', 'air', 'marimba bass pad', 0.62),
    sec('B', 'melB', 'air', 'bells harp bass pad', 0.8),
    sec('A', 'melA', 'air', 'bells harp bass pad choir', 0.92),
  ],
});
// Война: не фронт, а тыл — плач струнных и хора, редкое сердцебиение бочки
tr('homefront', 'Тыл', 'струнные, хор, рояль, скрипка', 'war', {
  bpm: 76, swing: 0, reverb: 0.5,
  bassLine: 'half',
  A: H('G2 D3 G3 Bb3 | Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | F2 C3 F3 A3 | G2 D3 G3 Bb3 | C3 G3 C4 Eb4 | D3 A3 C4 F#4 | G2 D3 G3 Bb3'),
  B: H('Eb3 Bb3 Eb4 G4 | Bb2 F3 Bb3 D4 | C3 G3 C4 Eb4 | D3 A3 C4 F#4'),
  melA: MEL('0:D5:6 6:Bb4:2 8:G4:8 16:G4:4 20:Bb4:4 24:Eb5:8 32:D5:6 38:C5:2 40:Bb4:8 48:C5:6 54:A4:2 56:F4:8 64:G4:4 68:Bb4:4 72:D5:8 80:Eb5:6 86:D5:2 88:C5:8 96:A4:4 100:C5:4 104:F#5:4 108:D5:4 112:G5:16'),
  melB: MEL('0:G5:6 6:F5:2 8:Eb5:8 16:F5:6 22:D5:2 24:Bb4:8 32:C5:4 36:Eb5:4 40:G5:8 48:F#5:6 54:D5:2 56:A4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass pad', 0.7),
    sec('B', 'melB', 'wide', 'piano violin bass strings choir', 0.88),
    sec('A', 'melA', 'wide', 'piano violin cello strings choir timpani', 1.0, DR('x.......x.......', '................', '................', { fill: false })),
  ],
});
// Тоталитаризм: парад — те же гитара и рык, что у «Железного марша», но с хором на трибунах
tr('parade', 'Парад', 'дисторшн-гитара, хор, литавры, драм-машина', 'totalitarian', {
  bpm: 96, swing: 0, reverb: 0.3,
  bassLine: 'pulse8',
  A: H('A2 E3 A3 C4 | A2 E3 A3 C4 | F2 C3 F3 A3 | E2 B2 E3 G#3 | A2 E3 A3 C4 | D3 A3 D4 F4 | Bb2 F3 Bb3 D4 | E2 B2 E3 G#3'),
  B: H('F2 C3 F3 A3 | D3 A3 D4 F4 | E2 B2 E3 G#3 | E2 B2 E3 G#3'),
  melA: MEL('0:A3:3 3:C4:1 4:E4:4 8:A3:3 11:C4:1 12:E4:4 16:A4:4 20:G4:2 22:E4:2 24:C4:4 28:E4:4 32:F4:3 35:A4:1 36:C5:4 40:A4:4 44:F4:4 48:E4:6 54:G#4:2 56:B4:8 64:A3:3 67:C4:1 68:E4:4 72:A4:4 76:E4:4 80:D4:3 83:F4:1 84:A4:4 88:D5:4 92:A4:4 96:Bb4:6 102:A4:2 104:F4:4 108:D4:4 112:E4:4 116:G#4:4 120:B4:4 124:E5:4'),
  melB: MEL('0:C5:6 6:A4:2 8:F4:8 16:D5:6 22:A4:2 24:F4:8 32:E4:4 36:G#4:4 40:B4:8 48:E5:8 56:B4:8'),
  sections: [
    sec('A', 'melA', 'flow', 'guitar growl timpani', 0.85, DR('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('B', 'melB', 'flow', 'guitar growl choir timpani', 1.0, DR('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.')),
    sec('A', 'melA', 'flow', 'guitar growl choir timpani', 1.0, DR('x...x...x...x...', '....x...x...x.x.', 'xxxxxxxxxxxxxxxx')),
  ],
});
// Казино: большой выигрыш — быстрый свинг с духовыми и райдом
tr('jackpot', 'Джекпот', 'свинг-рояль, духовые, контрабас, райд', 'casino', {
  bpm: 138, swing: 0.3, reverb: 0.26,
  bassLine: 'walk', feel: 'swing',
  A: H('F2 A3 C4 E4 | D3 C4 F4 A4 | G2 F3 B3 D4 | C3 Bb3 E4 G4 | F2 A3 C4 E4 | Bb2 Ab3 D4 F4 | G2 F3 Bb3 D4 | C3 Bb3 E4 G4'),
  B: H('Bb2 Ab3 D4 F4 | Bb2 Ab3 D4 F4 | F2 A3 C4 E4 | C3 Bb3 E4 G4'),
  melA: MEL('0:A4:2 2:C5:2 4:F5:2 6:E5:2 8:C5:4 12:A4:4 16:D5:2 18:F5:2 20:A5:2 22:G5:2 24:F5:4 28:D5:4 32:B4:2 34:D5:2 36:F5:2 38:G5:2 40:F5:4 44:D5:4 48:E5:2 50:G5:2 52:Bb5:2 54:G5:2 56:E5:4 60:C5:4 64:A4:2 66:C5:2 68:F5:2 70:A5:2 72:G5:4 76:F5:4 80:D5:2 82:F5:2 84:Ab5:2 86:F5:2 88:D5:4 92:Bb4:4 96:Bb4:2 98:D5:2 100:F5:2 102:D5:2 104:G5:4 108:F5:4 112:E5:2 114:G5:2 116:Bb5:2 118:G5:2 120:C6:8'),
  melB: MEL('0:F5:4 4:D5:4 8:Ab5:6 14:F5:2 16:D5:2 18:F5:2 20:Ab5:2 22:Bb5:2 24:Ab5:4 28:F5:4 32:E5:4 36:C5:4 40:A5:6 46:G5:2 48:G5:2 50:Bb5:2 52:C6:4 56:G5:8'),
  sections: [
    sec('A', 'melA', 'drive', 'piano bass brass', 0.85, DR('x...x...x...x...', '....x.......x...', 'r.r.r.r.r.r.r.r.', { ghost: true })),
    sec('B', 'melB', 'drive', 'piano bass brass bells', 1.0, DR('x...x...x...x...', '....x.......x...', 'r.rrr.rrr.rrr.rr', { ghost: true })),
    sec('A', 'melA', 'drive', 'piano bass brass strings', 1.0, DR('x...x...x...x...', '....x.......x.x.', 'r.rrr.rrr.rrr.rr', { ghost: true })),
  ],
});

/* -------------------------------- ПРЕЗИДЕНТ -------------------------------- */
// Своя тема у того, кто сидит в резиденции: торжественный ми-бемоль мажор без маршевости
tr('residence', 'Резиденция', 'рояль, струнные, арфа, скрипка', 'calm', {
  bpm: 76, swing: 0.08, reverb: 0.46,
  bassLine: 'half',
  A: H('Eb3 Bb3 Eb4 G4 | C3 G3 C4 Eb4 | Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | Eb3 Bb3 Eb4 G4 | G2 D3 G3 Bb3 | Ab2 Eb3 Ab3 C4 | Bb2 F3 Ab3 D4'),
  B: H('Ab2 Eb3 Ab3 C4 | Bb2 F3 Bb3 D4 | G2 D3 G3 Bb3 | Bb2 F3 Ab3 D4'),
  melA: MEL('0:G4:4 4:Bb4:4 8:Eb5:6 14:D5:2 16:C5:4 20:Eb5:4 24:G5:8 32:Ab5:6 38:G5:2 40:Eb5:4 44:C5:4 48:D5:6 54:F5:2 56:Bb4:8 64:Eb5:4 68:G5:4 72:Bb5:6 78:G5:2 80:G5:6 86:F5:2 88:D5:8 96:C5:4 100:Eb5:4 104:Ab5:6 110:G5:2 112:F5:6 118:D5:2 120:Bb4:8'),
  melB: MEL('0:C6:6 6:Bb5:2 8:Ab5:8 16:Bb5:6 22:F5:2 24:D5:8 32:D5:4 36:G5:4 40:Bb5:8 48:Ab5:6 54:F5:2 56:D5:8'),
  sections: [
    sec('A', 'melA', 'flow', 'piano bass', 0.7),
    sec('A', 'melA', 'flow', 'piano bass strings harp', 0.85),
    sec('B', 'melB', 'wide', 'piano bass strings bells', 1.0, DR('x.......x.......', '................', 'o...o...o...o...', { fill: false })),
    sec('A', 'melA', 'flow', 'piano violin bass strings harp', 1.0),
  ],
});

const MOOD_PLAYLISTS = {
  calm: ['cabinet', 'dawn', 'sixstring', 'ledger', 'northlight', 'promenade', 'meadow'],
  boom: ['fullhouse', 'ascent', 'boulevard', 'overdrive'],
  slump: ['nightshift', 'longwinter', 'emptyhalls', 'patience'],
  stag: ['treadmill', 'deadlock', 'friction'],
  crisis: ['collapse', 'panic', 'bankrun'],
  frost: ['glass', 'hoarfrost', 'stillness'],
  war: ['warmarch', 'homefront', 'trenches'],
  campaign: ['rally', 'doorbell'],
  stabilization: ['anchor', 'firmhand'],
  authoritarian: ['decree', 'corridors'],
  totalitarian: ['ironmarch', 'parade', 'curfew'],
  casino: ['chips', 'jackpot', 'croupier'],
};
const MOOD_LABEL = { calm: 'Спокойствие', boom: 'Подъём', slump: 'Спад', stag: 'Стагфляция', crisis: 'Кризис', frost: 'Дефляция',
  war: 'Война', campaign: 'Предвыборная кампания', stabilization: 'Стабилизация', authoritarian: 'Ручное управление',
  totalitarian: 'Тоталитаризм', casino: 'Казино' };
const REGIME_MOOD = { normal: 'calm', overheating: 'boom', recession: 'slump', stagflation: 'stag',
  banking: 'crisis', debt: 'crisis', currency: 'crisis', deflation: 'frost', war: 'war', pandemic: 'crisis' };
/* Плейлисты, привязанные к роли: у инвестора свой репертуар, у обучения — свой */
const ROLE_PLAYLISTS = {
  /* В меню нет экономики, а значит нет и настроения: один и тот же спокойный
     репертуар во всех ветках — заглавная тема и то, что к ней прилегает. */
  menu: {
    calm: ['anthem', 'cabinet', 'dawn', 'northlight', 'promenade'],
    boom: ['anthem', 'cabinet', 'dawn'],
    slump: ['anthem', 'dawn', 'northlight'],
    stag: ['anthem', 'cabinet', 'meadow'],
    crisis: ['anthem', 'dawn', 'northlight'],
    frost: ['anthem', 'meadow', 'dawn'],
  },
  tutorial: {
    calm: ['firstlesson', 'chalkboard', 'cabinet'],
    boom: ['graduation', 'sixstring'],
    slump: ['nightshift', 'firstlesson'],
    stag: ['chalkboard', 'treadmill'],
    crisis: ['treadmill', 'graduation'],
    frost: ['firstlesson', 'nightshift'],
  },
  // у президента своя тема — «Резиденция» — и собственный порядок в спокойные времена
  president: {
    calm: ['residence', 'cabinet', 'anthem', 'dawn'],
    boom: ['residence', 'fullhouse', 'ascent'],
    slump: ['residence', 'longwinter', 'patience'],
    campaign: ['rally', 'residence', 'doorbell'],
  },
  trader: {
    calm: ['openingbell', 'ledger'],
    boom: ['bidask', 'ascent'],
    slump: ['bearmarket', 'patience'],
    stag: ['thinvolume', 'friction'],
    crisis: ['marginwire', 'panic'],
    frost: ['thinvolume', 'glass'],
  },
};

/* -------------------------------- ЗАСТАВКИ --------------------------------
   Короткие музыкальные фразы на переломные события партии: выборы, переворот,
   падение и возвращение демократии, остановленные цены. На время заставки
   саундтрек замолкает и возвращается с начала такта (см. playStinger в engine.js).
   Нота: 'шаг:НОТА[.НОТА…]:длительность'; у ударных нот нет — 'шаг::1'. */
const CH = (str) => str.trim().split(/\s+/).filter(Boolean).map((tok) => {
  const [st, notes, dur] = tok.split(':');
  return [parseInt(st, 10), notes ? notes.split('.').map(nn) : [], parseInt(dur, 10)];
});
const STINGERS = {};
const stg = (id, name, bpm, parts) => {
  STINGERS[id] = { id, name, bpm, parts: parts.map(([inst, notes, vel]) => ({ inst, notes: CH(notes), vel: vel === undefined ? 1 : vel })) };
};
// победа на честных выборах: фанфара соль мажор с дробью-затактом
stg('victory', 'Победа на выборах', 104, [
  ['snare', '0::1 1::1 2::1 3::1 12::1', 0.7],
  ['brass', '0:G3.B3.D4:2 2:G3.B3.D4:1 3:G3.B3.D4:1 4:C4.E4.G4:4 8:D4.F#4.A4:4 12:G3.B3.D4.G4:16'],
  ['bass', '0:G2:4 4:C3:4 8:D3:4 12:G2:12'],
  ['timpani', '0:G2:1 4:C3:1 8:D3:1 12:G2:1 14:G2:1'],
  ['kick', '12::1'],
  ['strings', '12:G3.B3.D4.G4:16'],
  ['bell', '12:G5:8 16:B5:8 20:D6:8'],
]);
// «победа» на нарисованных выборах: та же фанфара, но мажор проваливается в минор
stg('hollow', 'Победа, в которую никто не верит', 96, [
  ['brass', '0:G3.B3.D4:2 2:G3.B3.D4:2 4:C4.E4.G4:4 8:C4.Eb4.G4:4 12:G3.Bb3.D4:16'],
  ['timpani', '0:G2:1 8:C3:1 12:G2:1'],
  ['cello', '8:C3:4 12:G2:16'],
  ['strings', '12:G3.Bb3.D4:16', 0.8],
]);
// поражение: нисходящая фраза рояля над низкими струнными
stg('defeat', 'Поражение на выборах', 72, [
  ['piano', '0:A4:4 4:F4:4 8:D4:4 12:C#4:4 16:D4:16'],
  ['strings', '0:D3.F3.A3:8 8:Bb2.D3.F3:8 16:D3.F3.A3:16'],
  ['cello', '0:D3:8 8:Bb2:8 16:D2:16'],
  ['bell', '16:D5:12', 0.6],
]);
// переворот: дробь, удар литавр, низкая медь и рык
stg('coup', 'Военный переворот', 120, [
  ['snare', '0::1 1::1 2::1 3::1 4::1 5::1 6::1 7::1 8::1 9::1 10::1 11::1', 0.55],
  ['kick', '12::1 16::1'],
  ['timpani', '12:D2:1 14:D2:1 16:D2:1'],
  ['brass', '12:D3.F3.Ab3:4 16:D3.F3.A3:12'],
  ['growl', '12:D2:16'],
  ['choir', '16:D3.F3.A3.D4:14'],
]);
// демократия пала: колокол, хор и виолончель
stg('regime_fall', 'Конец демократии', 72, [
  ['bell', '0:D5:8 8:D5:8 16:A4:12'],
  ['choir', '0:D3.F3.A3:16 16:Bb2.D3.F3:12'],
  ['cello', '0:D2:16 16:Bb1:12'],
  ['timpani', '0:D2:1 16:Bb1:1'],
]);
// демократия вернулась: восходящая арфа и струнные до мажор
stg('restoration', 'Возвращение демократии', 88, [
  ['harp', '0:C4:2 2:E4:2 4:G4:2 6:C5:2 8:F4:2 10:A4:2 12:C5:2 14:F5:2 16:G4:2 18:B4:2 20:D5:2 22:G5:2 24:C5:12'],
  ['strings', '0:C4.E4.G4:8 8:F4.A4.C5:8 16:G4.B4.D5:8 24:C4.E4.G4.C5:12'],
  ['bass', '0:C3:8 8:F2:8 16:G2:8 24:C3:12'],
  ['bell', '24:C6:12', 0.7],
]);
// цены остановлены: разрешение из доминанты в фа мажор
stg('prices_stopped', 'Цены остановлены', 96, [
  ['piano', '0:C4:2 2:F4:2 4:A4:2 6:C5:2 8:Bb4:4 12:A4:4 16:G4:4 20:C5:4 24:F5:12'],
  ['strings', '8:Bb3.D4.G4:8 16:Bb3.C4.E4.G4:8 24:A3.C4.F4:12'],
  ['bass', '0:F2:8 8:G2:8 16:C3:8 24:F2:12'],
  ['timpani', '24:F2:1'],
  ['bell', '24:F5:6 28:A5:6 32:C6:8'],
]);

export { nn, hz, H, MEL, DR, LH, BASS_LINES, sec, TRACKS, MOOD_PLAYLISTS, ROLE_PLAYLISTS, MOOD_LABEL, REGIME_MOOD, STINGERS };
