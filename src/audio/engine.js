/* =========================================================================================
   ЗВУКОВОЙ ДВИЖОК: интерфейсные эффекты и генеративный саундтрек, реагирующий на состояние
   экономики. Всё синтезируется через Web Audio прямо в браузере — внешних файлов нет.

   Движок — фабрика, а не единственный объект: игра пользуется одним экземпляром (Audio),
   а для измерений создаётся второй поверх OfflineAudioContext (см. renderTrackOffline) —
   так громкость и пики каждой пьесы можно измерить честно, отрендерив её, а не на слух.
========================================================================================= */
import { clamp } from '../lib/engine.js';
import { hz, LH, BASS_LINES, TRACKS, MOOD_PLAYLISTS, ROLE_PLAYLISTS, MOOD_LABEL, REGIME_MOOD, STINGERS } from './tracks.js';
import { TRACK_GAIN_DB, STINGER_GAIN_DB } from './loudness.js';

/* Настроение саундтрека по состоянию страны. Порядок — от самого властного к фону:
   тоталитаризм и война перекрывают всё; программа стабилизации, которой начали
   верить, звучит поверх кризиса — слышно, что выход есть; ручное управление и
   предвыборная кампания окрашивают только некризисные времена. */
export const moodFor = (e) => {
  if (e.politicalRegime === 'totalitarian') return 'totalitarian';
  const base = REGIME_MOOD[e.regime] || 'calm';
  if (base === 'war') return 'war';
  if ((e.stabilizationCred || 0) >= 0.3 && !e.stabilizationWon) return 'stabilization';
  if (base === 'crisis') return 'crisis';
  if (e.politicalRegime === 'authoritarian') return 'authoritarian';
  if (e.campaignActive) return 'campaign';
  return base;
};

const REGIME_RANK = { democracy: 0, crisis: 1, authoritarian: 2, totalitarian: 3 };
/* Какая заставка положена кварталу: одна, самая значимая из случившегося. */
export const stingerFor = (prev, cur) => {
  if (!prev || !cur) return null;
  const le = cur.lastElection || {};
  if (cur.electionResult && le.coup) return 'coup';
  const rp = REGIME_RANK[prev.politicalRegime] || 0; const rc = REGIME_RANK[cur.politicalRegime] || 0;
  if (rc >= 2 && rc > rp) return 'regime_fall';
  if (cur.electionResult === 'opposition' || cur.electionResult === 'landslide') return 'defeat';
  if (cur.electionResult === 'incumbent') return le.rigged ? 'hollow' : 'victory';
  if (rp >= 1 && rc === 0) return 'restoration';
  if (cur.stabilizationWon && !prev.stabilizationWon) return 'prices_stopped';
  return null;
};

export function createAudioEngine(options = {}) {
  let ctx = null; let master = null; let comp = null; let musicBus = null; let songBus = null; let sfxBus = null; let noiseBuf = null;
  let dry = null; let verbIn = null; let echo = null; let pianoBus = null; let chorusIn = null;
  const opts = { music: true, sfx: true, volume: 0.6 };
  let lastTick = 0; const listeners = [];
  let track = TRACKS.dawn; let mood = 'calm'; let lockedMood = null; let playlistIdx = 0;
  let roleId = null;
  const listOf = (m) => (
    (roleId && ROLE_PLAYLISTS[roleId] && ROLE_PLAYLISTS[roleId][m])
    || MOOD_PLAYLISTS[m] || MOOD_PLAYLISTS.calm
  );
  let pending = null; let tempoMod = 1; let tempoTarget = 1; let intensity = 0.3;
  // переход: 'outro' — доиграть такт с затуханием (смена настроения), 'cut' — быстро
  // увести громкость (человек сам нажал «следующий»); outroEnd — шаг, на котором пьеса сменится
  let pendingKind = 'outro'; let outroEnd = -1;
  let stingerUntil = 0;   // пока звучит заставка, секвенсор молчит
  const plays = {};   // сколько раз пьеса уже звучала — повторные проходы играются с вариациями
  let timer = null; let nextTime = 0; let stepIdx = 0; let running = false;

  const now = () => (ctx ? ctx.currentTime : 0);
  // уровень пьесы: поправка из замера громкости (scripts/loudness.mjs)
  const songLevel = (t) => (options.trackGain === false ? 1 : Math.pow(10, (TRACK_GAIN_DB[t.id] || 0) / 20));
  const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  const jitter = () => (Math.random() - 0.5) * 0.014;
  const notify = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
  // у каждой секции — номер её повтора в форме: второй и третий проход той же мелодии
  // играются с украшениями, а не копией первого
  const plan = (t) => {
    let bar = 0; const seen = {};
    return t.sections.map((s, i) => {
      const start = bar; bar += t[s.h].length;
      const rep = seen[s.mel] || 0; seen[s.mel] = rep + 1;
      return { ...s, start, bars: t[s.h].length, rep, idx: i };
    });
  };
  let sectionPlan = plan(track);
  let formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);

  const makeIR = (seconds, decay) => {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, decay);
        lp += ((Math.random() * 2 - 1) - lp) * (0.30 - 0.22 * (i / len));
        d[i] = lp * env;
      }
    }
    return buf;
  };

  const ensure = () => {
    if (ctx) return ctx;
    if (options.context) ctx = options.context;
    else {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    master = ctx.createGain(); master.gain.value = opts.volume;
    try {
      // для замеров громкости компрессор снимается: он сплющил бы ту самую разницу,
      // которую нужно измерить
      if (options.bypassCompressor) throw new Error('bypass');
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.28;
      master.connect(comp); comp.connect(ctx.destination);
    } catch { master.connect(ctx.destination); }
    musicBus = ctx.createGain(); musicBus.gain.value = opts.music ? 0.55 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = opts.sfx ? 0.9 : 0; sfxBus.connect(master);
    // шина пьесы: всё, что играет саундтрек (вместе с реверберацией и эхом), проходит
    // через неё — здесь живёт поправка громкости пьесы и затухание на переходах
    songBus = ctx.createGain(); songBus.gain.value = songLevel(track); songBus.connect(musicBus);
    dry = ctx.createGain(); dry.gain.value = 1; dry.connect(songBus);
    try {
      // шельф на верхах был сделан под пилу старого синт-лида и душил бы настоящий
      // рояль: у него в этой полосе как раз живёт молоточек и «воздух» инструмента
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 0.8; body.gain.value = 2.0;
      const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5400; air.gain.value = -1.5;
      pianoBus = ctx.createGain(); pianoBus.gain.value = 1;
      pianoBus.connect(body); body.connect(air); air.connect(dry);
    } catch { pianoBus = dry; }
    try {
      // короче и суше, чем концертный зал: маленькая комната/плата — характернее для синтвейва
      const conv = ctx.createConvolver(); conv.buffer = makeIR(1.5, 2.6);
      const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.014;
      verbIn = ctx.createGain(); verbIn.gain.value = 1;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      verbIn.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(songBus);
    } catch { verbIn = ctx.createGain(); verbIn.gain.value = 0; verbIn.connect(songBus); }
    // хорус для струнных и хора: две модулированные линии задержки
    try {
      chorusIn = ctx.createGain(); chorusIn.gain.value = 1; chorusIn.connect(dry);
      [[0.014, 0.31], [0.021, 0.23]].forEach(([base, rate]) => {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = base;
        const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
        const amt = ctx.createGain(); amt.gain.value = 0.0035;
        const g = ctx.createGain(); g.gain.value = 0.5;
        lfo.connect(amt); amt.connect(dl.delayTime); lfo.start();
        chorusIn.connect(dl); dl.connect(g); g.connect(dry);
      });
    } catch { chorusIn = dry; }
    try {
      // слэп-дилей на синт-лид/арпеджио — фирменный приём синтвейва вместо диффузного эха
      const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.16;
      const fb = ctx.createGain(); fb.gain.value = 0.24;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
      echo = ctx.createGain(); echo.gain.value = 0.5;
      echo.connect(dl); dl.connect(damp); damp.connect(fb); fb.connect(dl); dl.connect(songBus);
    } catch { echo = dry; }
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dat = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) dat[i] = Math.random() * 2 - 1;
    return ctx;
  };
  const panFor = (midi, width) => {
    try { const p = ctx.createStereoPanner(); p.pan.value = clamp((midi - 62) / 30, -1, 1) * (width || 0.35); return p; } catch { return ctx.createGain(); }
  };
  const sendTo = (node, bus, amt) => { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(bus); };

  /* ------------------------------- ИНСТРУМЕНТЫ ------------------------------- */
  /* Рояль. Раньше под именем piano() играла пила с квадратом — то есть каждый трек
     саундтрека, что бы ни было написано в его аранжировке, звучал одним и тем же
     синтезаторным плаком. Теперь это настоящий фортепианный голос: собственная
     волна с фортепианным набором обертонов, две слегка расстроенные «струны»
     (отсюда живое биение), стук молоточка в атаке и двухступенчатое затухание —
     быстрый спад первых миллисекунд и длинный хвост, который у басов тянется
     дольше, чем у верхов. Старый синтезаторный голос никуда не делся, он живёт
     отдельно под именем synth() — там, где синтвейв нужен осознанно. */
  let pianoWave = null;
  const ensurePianoWave = () => {
    if (pianoWave || !ctx) return pianoWave;
    // амплитуды обертонов, снятые с характера рояля: сильная первая и вторая,
    // быстро убывающие верхние — отсюда «деревянный», а не «жужжащий» тембр
    const amps = [0, 1, 0.58, 0.36, 0.26, 0.17, 0.11, 0.082, 0.058, 0.04, 0.028, 0.02, 0.014, 0.01];
    const real = new Float32Array(amps.length);
    const imag = new Float32Array(amps.length);
    amps.forEach((a, i) => { imag[i] = a; });
    try { pianoWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false }); }
    catch { pianoWave = null; }
    return pianoWave;
  };
  const piano = (t, midi, vel, sustain) => {
    const f = hz(midi);
    if (f > 5000 || f < 25) return;
    // низкие струны звучат дольше высоких — это и создаёт ощущение инструмента,
    // а не одинаково обрубленных нот
    const pitchLen = clamp(2.6 - (midi - 36) * 0.022, 0.55, 2.6);
    const dec = clamp(pitchLen * (sustain || 1), 0.16, 3.4);
    const out = ctx.createGain(); out.gain.value = 0.105 * vel;
    const pan = panFor(midi, 0.28); out.connect(pan); pan.connect(pianoBus);
    sendTo(out, verbIn, track.reverb * 0.5);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.6;
    filt.frequency.setValueAtTime(Math.min(12000, f * 11 + 1400), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 3.2, 950), t + dec * 0.55);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    // двухступенчатое затухание: резкий спад молоточка, затем долгий хвост струны
    g.gain.exponentialRampToValueAtTime(0.42, t + Math.min(0.16, dec * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    g.connect(filt);
    const wave = ensurePianoWave();
    [[0, 0.62], [vel > 0.6 ? 3.5 : 2.2, 0.38]].forEach(([det, amp]) => {
      const o = ctx.createOscillator();
      if (wave) o.setPeriodicWave(wave); else o.type = 'triangle';
      o.frequency.value = f; o.detune.value = det;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dec + 0.06);
    });
    // стук молоточка по струне: короткий полосовой шум, громче при сильной ноте
    const hs = ctx.createBufferSource(); hs.buffer = noiseBuf;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(6500, f * 3.2); hf.Q.value = 0.9;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.030 * vel * vel, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    hs.connect(hf); hf.connect(hg); hg.connect(out); hs.start(t); hs.stop(t + 0.07);
  };
  // Синт-лид: прежний голос движка — пила с квадратом, суб-осциллятором и
  // нисходящим фильтром. Остаётся для пьес, где синтезатор — осознанный выбор.
  const synth = (t, midi, vel, sustain, maxParts) => {
    const f = hz(midi);
    if (f > 5000 || f < 25) return;
    const dec = clamp(0.85 * (sustain || 1), 0.14, 3.0);
    const out = ctx.createGain(); out.gain.value = 0.095 * vel;
    const pan = panFor(midi); out.connect(pan); pan.connect(pianoBus);
    sendTo(out, verbIn, track.reverb * 0.45);
    sendTo(out, echo, 0.22);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 3.5;
    filt.frequency.setValueAtTime(Math.min(9500, f * 7 + 600), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t + dec * 0.7);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    g.connect(filt);
    const maxN = maxParts || 8;
    [[1, 'sawtooth', 0, 0.5], [1, 'square', 7, 0.34], [0.5, 'sine', 0, Math.min(0.4, maxN / 20)]].forEach(([mul, wave, det, amp]) => {
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f * mul; o.detune.value = det;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dec + 0.05);
    });
    const hs = ctx.createBufferSource(); hs.buffer = noiseBuf;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = Math.min(7000, f * 4); hf.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.020 * vel * vel, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    hs.connect(hf); hf.connect(hg); hg.connect(out); hs.start(t); hs.stop(t + 0.06);
  };
  /* Бас-гитара. Раньше басовую линию играл тот же piano() вполсилы — то есть баса
     как отдельного инструмента в движке просто не было. Здесь он свой: синус на
     фундаменте, поверх — фильтрованная пила с быстрым фильтр-спадом (щипок
     пальцем), сверху короткий призвук струны о лад. */
  const bass = (t, midi, dur, vel) => {
    const f = hz(midi);
    if (f < 20 || f > 700) return;
    const out = ctx.createGain(); out.gain.value = 0.18 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.12);
    const d = clamp(dur, 0.08, 1.6);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 4.5;
    filt.frequency.setValueAtTime(Math.min(2600, f * 12), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 90), t + Math.min(0.22, d * 0.6));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.55, t + Math.min(0.12, d * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f;
    const subG = ctx.createGain(); subG.gain.value = 0.85;
    sub.connect(subG); subG.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = 5;
    const oG = ctx.createGain(); oG.gain.value = 0.42;
    o.connect(oG); oG.connect(g);
    sub.start(t); sub.stop(t + d + 0.05); o.start(t); o.stop(t + d + 0.05);
    // призвук струны о порожек — то, по чему бас-гитара и узнаётся
    const cl = ctx.createBufferSource(); cl.buffer = noiseBuf;
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1400; cf.Q.value = 1.1;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.022 * vel, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    cl.connect(cf); cf.connect(cg); cg.connect(out); cl.start(t); cl.stop(t + 0.05);
  };
  // Плак для аккордовых фигур/арпеджио — короткая пила с нисходящим фильтром,
  // подпёртая слэп-дилеем (см. echo в ensure()) вместо арфового «звона».
  const harp = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.08 * vel;
    const pan = panFor(midi, 0.5); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.3); sendTo(out, echo, 0.3);
    const d = Math.min(dur, 0.2);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 2.5;
    filt.frequency.setValueAtTime(Math.min(8500, f * 8), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 400), t + d);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(g); o.start(t); o.stop(t + d + 0.05);
  };
  // Ретро-«колокол»: та же идея, только квадрат+пила вместо синусоидальных парциалов.
  const bell = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.075 * (vel || 1);
    const pan = panFor(midi, 0.45); out.connect(pan); pan.connect(chorusIn);
    sendTo(out, verbIn, track.reverb * 0.4); sendTo(out, echo, 0.28);
    const d = Math.min(dur, 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(out);
    [[1, 'square', 0.55], [2, 'sawtooth', 0.22], [1, 'sawtooth', 0.3]].forEach(([mul, wave, amp]) => {
      const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f * mul;
      const a = ctx.createGain(); a.gain.value = amp;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + d + 0.05);
    });
  };
  // Синт-медь: три пилы в унисон через ФНЧ с восходящей атакой фильтра («открывающийся»
  // тембр classic synth-brass) — духовые стабы для военной/маршевой темы, единственный
  // голос в движке с настоящим фанфарным характером.
  const brass = (t, notes, dur, vel) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), t + 0.045);
    g.gain.setValueAtTime(Math.max(0.0004, vel), t + Math.max(dur - 0.09, 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 4;
    filt.frequency.setValueAtTime(480, t);
    filt.frequency.exponentialRampToValueAtTime(3600, t + 0.07);
    filt.frequency.exponentialRampToValueAtTime(1500, t + dur);
    filt.connect(g); g.connect(dry);
    sendTo(g, verbIn, track.reverb * 0.3); sendTo(g, echo, 0.12);
    notes.forEach((midi) => {
      [-6, 0, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(midi); o.detune.value = det;
        const a = ctx.createGain(); a.gain.value = 0.38 / notes.length;
        o.connect(a); a.connect(filt); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  };
  // Синт-бас: пила + суб-осциллятор на октаву ниже через резонансный ФНЧ с щелчком атаки.
  const cello = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.12 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.2);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 5;
    filt.frequency.setValueAtTime(Math.min(2400, f * 10), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 90), t + Math.min(dur, 0.2));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.008);
    g.gain.setValueAtTime(1, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f / 2;
    const a2 = ctx.createGain(); a2.gain.value = 0.7;
    o1.connect(g); o2.connect(a2); a2.connect(g);
    o1.start(t); o1.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
  };
  // Второй синт-лид, ярче основного: пара расстроенных пил с вибрато — держит мелодию,
  // когда в аранжировке заявлен «violin».
  const violin = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.08 * vel;
    const pan = panFor(midi, 0.4); out.connect(pan); pan.connect(chorusIn);
    sendTo(out, verbIn, track.reverb * 0.4); sendTo(out, echo, 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + Math.min(0.04, dur * 0.2));
    g.gain.setValueAtTime(1, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
    const lg = ctx.createGain(); lg.gain.value = 5;
    lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.1);
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      lg.connect(o.detune);
      const a = ctx.createGain(); a.gain.value = 0.5;
      o.connect(a); a.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
  };
  // Аналоговый пад: стек расстроенных пил/квадратов под медленный ФНЧ-свип — вместо
  // смычковых струнных несёт длинные гармонии.
  const strings = (t, notes, dur, level) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, level), t + dur * 0.3);
    g.gain.setValueAtTime(Math.max(0.0004, level), t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(420, t);
    filt.frequency.linearRampToValueAtTime(1300 + 900 * intensity, t + dur * 0.5);
    filt.Q.value = 0.6;
    filt.connect(g); g.connect(chorusIn);
    sendTo(g, verbIn, track.reverb * 0.6);
    notes.forEach((midi, i) => {
      [-9, 0, 9].forEach((det) => {
        const o = ctx.createOscillator(); o.type = i % 2 ? 'square' : 'sawtooth'; o.frequency.value = hz(midi + 12);
        o.detune.value = det;
        const a = ctx.createGain(); a.gain.value = 0.5 / notes.length;
        o.connect(a); a.connect(filt); o.start(t); o.stop(t + dur + 0.2);
      });
    });
  };
  // Яркий PWM-пад (два квадрата на голос, разведённых по detune с медленным LFO) — вместо
  // формантного «хора» несёт верхний слой гармонии там, где заявлен «choir».
  const choir = (t, notes, dur, level) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, level * 0.9), t + dur * 0.35);
    g.gain.setValueAtTime(Math.max(0.0004, level * 0.9), t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(chorusIn); sendTo(g, verbIn, track.reverb * 0.65);
    notes.forEach((midi, i) => {
      const f = hz(midi + 12);
      const a = ctx.createGain(); a.gain.value = 0.4 / notes.length;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3 + i * 0.05;
      const lg = ctx.createGain(); lg.gain.value = 6;
      lfo.start(t); lfo.stop(t + dur + 0.2);
      [-8, 8].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.detune.value = det;
        lg.connect(o.detune); lfo.connect(lg);
        o.connect(a); o.start(t); o.stop(t + dur + 0.2);
      });
      a.connect(g);
    });
  };
  // Синт-том вместо литавры: короткий питч-свип синусоиды.
  const timpani = (t, midi, vel) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hz(midi) * 2.2, t); o.frequency.exponentialRampToValueAtTime(hz(midi) * 0.9, t + 0.12);
    g.gain.setValueAtTime(0.15 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(dry); sendTo(g, verbIn, 0.25); o.start(t); o.stop(t + 0.35);
  };
  const noiseHit = (t, dur, gain, type, freq, q, bus) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || dry); src.start(t); src.stop(t + dur + 0.05);
  };
  /* УДАРНЫЕ. Раньше это были три ноты без динамики: бочка, шум-снейр и шум-хэт,
     всегда одной громкости. Теперь у каждого удара есть velocity, у бочки — тело и
     щелчок колотушки, у снейра — пружина, а к набору добавились том и райд, без
     которых не сыграть ни сбивку, ни джазовый грув. */
  const kick = (t, vel) => {
    const v = clamp(vel, 0.1, 1.4);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.055);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.38);
    // щелчок колотушки — то, за счёт чего бочка слышна в миксе, а не только ощущается
    noiseHit(t, 0.010, 0.055 * v, 'bandpass', 2600, 1.4);
  };
  const snare = (t, vel) => {
    const v = clamp(vel, 0.05, 1.4);
    // тело барабана — две расстроенные головки
    [188, 242].forEach((fr, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(fr, t);
      o.frequency.exponentialRampToValueAtTime(fr * 0.82, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((i ? 0.022 : 0.034) * v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.12);
    });
    // пружина: два слоя шума, длинный и короткий
    noiseHit(t, 0.11 + 0.05 * v, 0.070 * v, 'bandpass', 1900, 0.9);
    noiseHit(t + 0.004, 0.055, 0.045 * v, 'highpass', 4200, 0.7);
  };
  // Том — нужен и для сбивок, и для маршевой дроби
  const tom = (t, midi, vel) => {
    const f = hz(midi);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.35, t); o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(dry); sendTo(g, verbIn, track.reverb * 0.3);
    o.start(t); o.stop(t + 0.38);
    noiseHit(t, 0.04, 0.018 * vel, 'bandpass', 900, 0.8);
  };
  // Хэт с динамикой: закрытый щелчок, открытый «шшш» — и тихие призрачные удары
  const hat = (t, open, vel) => {
    const v = clamp(vel === undefined ? 1 : vel, 0.1, 1.4);
    noiseHit(t, open ? 0.16 : 0.036, (open ? 0.024 : 0.028) * v, 'highpass', open ? 7200 : 8800, 1.4);
    if (!open) noiseHit(t, 0.012, 0.010 * v, 'bandpass', 11000, 2.0);
  };
  // Райд: металлический звон с длинным хвостом — без него джазовый грув не собрать
  const ride = (t, vel) => {
    const v = clamp(vel, 0.1, 1.4);
    noiseHit(t, 0.42, 0.011 * v, 'highpass', 6200, 0.8);
    [3140, 4270, 5630].forEach((fr, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.006 * v / (i + 1), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 - i * 0.1);
      o.connect(g); g.connect(dry); sendTo(g, verbIn, track.reverb * 0.25);
      o.start(t); o.stop(t + 0.6);
    });
  };

  /* Мягкий клиппинг для гитары и нового баса тоталитарного режима — ни один другой
     голос в движке им не пользуется, поэтому у этих двух треков не может быть звучания,
     похожего на остальной саундтрек. */
  const distCurve = (() => {
    const n = 1024; const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 3.2); }
    return curve;
  })();
  // Дисторшн-гитара: пила через waveshaper с кабинетным ФНЧ и серединным пиком.
  // power=true — режущий «пауэр-аккорд» (терция + квинта), false — сольная линия.
  const guitar = (t, midi, dur, vel, power) => {
    const notes = power ? [midi, midi + 7] : [midi];
    const out = ctx.createGain(); out.gain.value = 0.10 * vel;
    const pan = panFor(midi, 0.3); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.25); sendTo(out, echo, 0.18);
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3200; cab.Q.value = 0.7;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 1.1; mid.gain.value = 4;
    cab.connect(mid); mid.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.setValueAtTime(1, t + Math.max(0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(cab);
    notes.forEach((m) => {
      const shaper = ctx.createWaveShaper(); shaper.curve = distCurve; shaper.oversample = '2x';
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m);
      const pre = ctx.createGain(); pre.gain.value = 2.6;
      o.connect(pre); pre.connect(shaper); shaper.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    });
  };
  // Новый бас, отдельный от cello/piano-баса: суб-синус на октаву ниже плюс расстроенная
  // пила через тот же дисторшн, что и guitar — тяжёлый, давящий низ без «щелчка» атаки.
  const growl = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.16 * vel;
    out.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.15);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 2;
    filt.frequency.setValueAtTime(Math.min(900, f * 5), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.4, 70), t + Math.min(dur, 0.25));
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2;
    sub.connect(g);
    const shaper = ctx.createWaveShaper(); shaper.curve = distCurve; shaper.oversample = '2x';
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const pre = ctx.createGain(); pre.gain.value = 1.8;
    const distAmt = ctx.createGain(); distAmt.gain.value = 0.6;
    o.connect(pre); pre.connect(shaper); shaper.connect(distAmt); distAmt.connect(g);
    sub.start(t); sub.stop(t + dur + 0.05); o.start(t); o.stop(t + dur + 0.05);
  };
  // Маримба: синус с треугольным «стуком» атаки и очень быстрым затуханием — тёплый
  // деревянный щелчок, совсем другой характер, чем звонкие bell()/harp(); настоящий
  // мэллет-тембр для джазовых и лаунж-пьес вместо синтвейвового пэда.
  const marimba = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.11 * vel;
    const pan = panFor(midi, 0.4); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.35);
    const d = Math.min(dur, 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 4;
    const a2 = ctx.createGain();
    a2.gain.setValueAtTime(0.35 * vel, t); a2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o1.connect(g); o2.connect(a2); a2.connect(out);
    o1.start(t); o1.stop(t + d + 0.05); o2.start(t); o2.stop(t + 0.08);
  };
  // Нейлоновая гитара: щипок без дисторшна — треугольник с расстроенной пилой под
  // быстро закрывающимся ФНЧ. Единственный «акустический», чистый щипковый голос
  // движка — фолковый/акустический характер вместо синтвейвовых пэдов и арпеджио.
  const nylon = (t, midi, dur, vel) => {
    const f = hz(midi);
    const out = ctx.createGain(); out.gain.value = 0.10 * vel;
    const pan = panFor(midi, 0.35); out.connect(pan); pan.connect(dry);
    sendTo(out, verbIn, track.reverb * 0.3); sendTo(out, echo, 0.1);
    const d = Math.min(dur, 0.9);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(Math.min(5200, f * 6), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 300), t + d * 0.6);
    filt.connect(out);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(filt);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 4;
    const a2 = ctx.createGain(); a2.gain.value = 0.3;
    o.connect(g); o2.connect(a2); a2.connect(g);
    o.start(t); o.stop(t + d + 0.05); o2.start(t); o2.stop(t + d + 0.05);
  };

  /* ------------------------------- СЕКВЕНСОР ------------------------------- */
  /* Атмосферный слой: низкий гул, «ветер» и сердцебиение под музыкой */
  let amb = null; let heartTimer = null;
  const ensureAmb = () => {
    if (amb || !ctx) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(musicBus);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.8; f.connect(g);
    const a1 = ctx.createOscillator(); a1.type = 'sine'; a1.frequency.value = 41.2;
    const a2 = ctx.createOscillator(); a2.type = 'sawtooth'; a2.frequency.value = 41.2; a2.detune.value = 8;
    const ag = ctx.createGain(); ag.gain.value = 0.5;
    a1.connect(f); a2.connect(ag); ag.connect(f); a1.start(); a2.start();
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320;
    const wg = ctx.createGain(); wg.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(wg.gain); lfo.start();
    wind.connect(wf); wf.connect(wg); wg.connect(g); wind.start();
    amb = { gain: g, filter: f, oscB: a2, wind: wf };
  };
  const heartbeat = () => {
    if (!ctx || !amb) return;
    const t = now();
    [0, 0.26].forEach((d, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(58, t + d); o.frequency.exponentialRampToValueAtTime(30, t + d + 0.12);
      g.gain.setValueAtTime(i ? 0.05 : 0.075, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
      o.connect(g); g.connect(musicBus); o.start(t + d); o.stop(t + d + 0.35);
    });
  };
  const stepDur = () => 60 / (track.bpm * tempoMod) / 4;
  const accent = (pos) => (pos === 0 ? 1 : pos % 8 === 0 ? 0.92 : pos % 4 === 0 ? 0.84 : 0.72);

  const setTrack = (id) => {
    if (!TRACKS[id]) return;
    track = TRACKS[id]; sectionPlan = plan(track); formBars = sectionPlan.reduce((a, s) => a + s.bars, 0);
    plays[id] = (plays[id] || 0) + 1;
    stepIdx = 0; outroEnd = -1; notify();
  };
  const advancePlaylist = (forward) => {
    const list = listOf(lockedMood || mood);
    playlistIdx = (playlistIdx + (forward === false ? -1 : 1) + list.length) % list.length;
    pending = list[playlistIdx]; pendingKind = 'cut';
  };
  // автоматическая смена (настроение, роль, плейлист): доиграть такт и связать пьесы
  const queue = (id) => {
    if (!running) { pending = id; pendingKind = 'cut'; return; }
    if (pending && pendingKind === 'outro' && outroEnd >= 0) { pending = id; return; }   // затихание уже идёт
    pending = id; pendingKind = 'outro'; outroEnd = -1;
  };

  // человеческая неровность: одинаковая громкость у всех ударов — первое, по чему
  // слышно, что играет не живой барабанщик, а сетка
  const humanVel = (base) => base * (0.86 + Math.random() * 0.2);
  // детерминированная «случайность» вариаций: одна и та же пьеса на том же проходе
  // украшается одинаково — это аранжировка, а не шум
  const vhash = (a, b, c) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // ближайший тон аккорда сверху — из него растёт форшлаг, чтобы украшение не спорило с гармонией
  const upperNeighbor = (midi, voicing) => {
    for (let k = 1; k <= 5; k++) if (voicing.some((v) => (v - midi - k) % 12 === 0)) return midi + k;
    return midi + 2;
  };

  const scheduleStep = (idx, t) => {
    const totalSteps = formBars * 16;
    const i = ((idx % totalSteps) + totalSteps) % totalSteps;
    const bar = Math.floor(i / 16); const pos = i % 16;
    const sc = sectionPlan.find((x) => bar >= x.start && bar < x.start + x.bars) || sectionPlan[0];
    const harmony = track[sc.h];
    const barIn = bar - sc.start;
    const voicing = harmony[barIn % harmony.length];
    const melody = track[sc.mel] || [];
    const stepIn = barIn * 16 + pos;
    const sd = stepDur();
    const arr = sc.arr;
    const has = (k) => arr.indexOf(k) >= 0;
    const dyn = sc.dyn * (0.88 + 0.18 * intensity);
    const lastBarOfSection = barIn === sc.bars - 1;
    // уровень вариаций: повтор секции внутри формы и повторное звучание пьесы
    const vary = Math.min(2, sc.rep + ((plays[track.id] || 1) > 1 ? 1 : 0));
    const trackSeed = track.bpm * 131 + track.id.length * 17 + (plays[track.id] || 1);

    // гармония
    if (pos === 0) {
      if (has('pad')) strings(t, voicing.slice(1, 3), sd * 16 * 0.96, 0.055 * dyn);
      if (has('choir')) choir(t, voicing.slice(1), sd * 16 * 0.94, 0.05 * dyn);
      if (has('strings')) strings(t, voicing.slice(1, 4), sd * 16 * 0.92, 0.042 * dyn);
      if (has('timpani') && (bar % 2 === 0)) timpani(t, voicing[0] - 12, 0.8 * dyn);
    }
    // духовые стабы на каждую четверть — маршевое «ум-па», а не длинная педаль
    if (has('brass') && pos % 4 === 0) brass(t, voicing.slice(0, 3), sd * 3.4, 0.1 * dyn);
    // гитарный «чуг» на каждую четверть — тот же маршевый приём, что и духовые стабы,
    // но режущий и жёсткий: собственный узнаваемый ритм тоталитарного саундтрека
    if (has('guitar') && has('growl') && pos % 4 === 0) guitar(t, voicing[0], sd * 3.4, 0.11 * dyn, true);
    // бой акустической гитары: перебор аккорда восьмыми со сменой направления
    if (has('strum') && pos % 2 === 0) {
      const dirDown = (pos / 2) % 2 === 0;
      const order = dirDown ? [0, 1, 2, 3] : [3, 2, 1, 0];
      order.forEach((k, n) => {
        const note = voicing[k % voicing.length] + (k > 1 ? 12 : 0);
        nylon(t + n * 0.011 + jitter() * 0.4, note, sd * 3.2, (dirDown ? 0.5 : 0.34) * dyn);
      });
    }
    // бас
    const bassFig = BASS_LINES[track.bassLine || 'drive'] || BASS_LINES.drive;
    bassFig.forEach(([st, deg]) => {
      if (st !== pos) return;
      const root = voicing[0] - 12;
      const note = root + deg;
      const vel = (pos === 0 ? 1.0 : pos % 8 === 0 ? 0.82 : pos % 4 === 0 ? 0.7 : 0.56) * dyn;
      const len = sd * (track.bassLine === 'walk' ? 3.6 : track.bassLine === 'half' ? 7 : 1.9);
      if (has('growl')) growl(t, note, len, vel);
      else if (has('cello')) cello(t, note, len, vel);
      else if (has('bass')) bass(t + jitter() * 0.5, note, len, vel);
    });
    // арпеджио по аккорду шестнадцатыми — накладывается на «полные» секции без
    // собственной арпеджио-партии в аранжировке, характерный слой синтвейва
    if (has('pad') && !has('harp') && !has('strum')) {
      const arpDeg = [1, 2, 3, 2][(pos / 2) % 4];
      if (pos % 2 === 0) harp(t + jitter(), voicing[arpDeg % voicing.length] + 12, sd * 2.2, 0.3 * dyn);
    }
    // фигура левой руки
    const fig = LH[sc.lh] || LH.flow;
    fig.forEach(([st, deg]) => {
      if (st !== pos) return;
      const vel = (0.38 + 0.16 * accent(pos)) * dyn;
      const note = voicing[deg % voicing.length];
      if (has('harp')) harp(t + jitter(), note + 12, sd * 6, vel);
      if (has('piano')) piano(t + jitter(), note, vel, track.bpm > 100 ? 0.7 : sc.lh === 'sustain' ? 1.15 : 0.95);
      else if (has('synth')) synth(t + jitter(), note, vel, track.bpm > 100 ? 0.55 : sc.lh === 'sustain' ? 1.0 : 0.85, sc.lh === 'sustain' ? 4 : 5);
      else if (has('nylon') && !has('strum')) nylon(t + jitter(), note + 12, sd * 4.5, vel);
      else if (has('marimba')) marimba(t + jitter(), note + 12, sd * 3, vel * 0.9);
      else if (has('bells') && !has('harp') && (st % 4 === 0)) bell(t, note + 12, sd * 6, 0.6 * vel);
    });
    // мелодия
    melody.forEach(([st, midi, dur]) => {
      if (st !== stepIn) return;
      const vel = (0.78 + 0.20 * accent(pos)) * dyn;
      // вариации повторного прохода: форшлаг к длинной ноте и октавная подголоска
      // в кульминации — мелодия та же, но исполнитель её уже «знает»
      if (vary > 0 && dur >= 4) {
        const r = vhash(trackSeed, sc.idx, st);
        if (r < 0.22 * vary && !has('guitar') && track.mood !== 'totalitarian') {
          const g = upperNeighbor(midi, voicing);
          if (has('violin') || has('lead')) synth(t - sd * 0.45, g, vel * 0.35, 0.3, 6);
          else piano(t - sd * 0.45 + jitter(), g, vel * 0.42, 0.35);
        } else if (r > 1 - 0.14 * vary && dur >= 8 && sc.dyn >= 0.95) {
          if (has('bells') || has('harp')) harp(t + sd * 0.02, midi + 12, sd * dur, vel * 0.32);
          else bell(t + sd * 0.02, midi + 12, sd * dur * 1.2, vel * 0.3);
        }
      }
      if (has('violin')) violin(t, midi, sd * dur * 1.05, vel);
      if (has('bells')) bell(t, midi, sd * dur * 1.7, vel * 0.9);
      if (has('lead')) synth(t + jitter(), midi, vel, 1.1, 8);
      if (has('guitar') && !has('violin') && !has('bells') && !has('lead')) guitar(t + jitter(), midi, sd * dur * 0.9, vel * 0.7, false);
      if (has('marimba') && !has('violin') && !has('bells') && !has('guitar') && !has('lead')) marimba(t + jitter(), midi, sd * dur * 0.8, vel * 0.85);
      if (has('nylon') && !has('violin') && !has('bells') && !has('guitar') && !has('marimba') && !has('lead')) nylon(t + jitter(), midi, sd * dur * 0.9, vel * 0.8);
      if (!has('violin') && !has('bells') && !has('guitar') && !has('marimba') && !has('nylon') && !has('lead')) {
        piano(t + jitter(), midi, Math.min(1, vel), 1.25);
        if (dur >= 8 && track.mood !== 'crisis') piano(t + jitter(), midi - 12, vel * 0.32, 0.9);
      } else if (has('piano') && has('violin')) {
        piano(t + jitter(), midi, vel * 0.5, 1.0);
      }
    });
    // ударные
    const d = sc.drums;
    if (d) {
      const power = (0.75 + 0.3 * intensity) * dyn;
      // сбивка в последнем такте секции: барабанщик объявляет смену, а не молча
      // доигрывает один и тот же такт по кругу
      const fillBar = lastBarOfSection && sc.bars >= 4 && d.fill !== false;
      if (fillBar && pos >= 8) {
        const TOMS = [52, 50, 47, 43];
        if (pos % 2 === 0) tom(t, TOMS[Math.min(3, Math.floor((pos - 8) / 2))], humanVel(power * 0.95));
        if (pos === 15) snare(t, humanVel(power * 1.1));
        if (pos === 8) kick(t, humanVel(power));
      } else {
        d.kick.forEach(([st]) => { if (st === pos) kick(t, humanVel(power)); });
        // подхваты на повторе: бочка-затакт в конце чётного такта и открытый хэт
        // перед сильной долей — барабанщик не играет одну и ту же петлю дважды
        if (vary > 0 && barIn % 2 === 1 && pos === 14 && !d.kick.some(([st]) => st === 14)
          && vhash(trackSeed, sc.idx, bar) < 0.5 * vary) kick(t, humanVel(power * 0.7));
        if (vary > 0 && barIn % 4 === 3 && pos === 14 && d.hat.length) hat(t, true, humanVel(power * 0.8));
        d.snare.forEach(([st]) => { if (st === pos) snare(t, humanVel(power)); });
        d.hat.forEach(([st, c]) => {
          if (st !== pos) return;
          if (c === 'r') ride(t, humanVel(power * 0.8));
          else hat(t, c === 'O', humanVel(pos % 4 === 0 ? power : power * 0.62));
        });
        // призрачные удары малого между долями — то, что отличает грув от метронома
        if (d.ghost && pos % 4 === 2 && Math.random() < 0.45) snare(t, power * 0.18);
      }
    }
  };

  /* Нарастающий шум-«вдох» перед сменой пьесы: связывает затихающую пьесу с новой,
     как тарелочный свип у живого ансамбля. Идёт мимо шины пьесы — её в этот момент уводят. */
  const swell = (t, dur, gain) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.92); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.18);
    src.connect(f); f.connect(g); g.connect(musicBus); sendTo(g, verbIn, 0.4);
    src.start(t); src.stop(t + dur + 0.25);
  };
  const barSeconds = () => stepDur() * 16;
  // поставить новую пьесу: громкость пьесы — с нуля до её уровня, первый такт — с удара
  const enterTrack = (id, t, soft) => {
    setTrack(id);
    if (!songBus) return;
    const lvl = songLevel(track);
    songBus.gain.cancelScheduledValues(t);
    songBus.gain.setValueAtTime(soft ? lvl * 0.35 : lvl * 0.7, t);
    songBus.gain.linearRampToValueAtTime(lvl, t + (soft ? 1.6 : 0.5));
  };

  /* Заставка события. Саундтрек быстро уходит (то, что уже расписано наперёд,
     затухает), фраза играется поверх тишины, а музыка возвращается с начала такта —
     сразу новой пьесой, если за время заставки сменилось настроение. */
  const STINGER_VOICES = {
    piano: (t, n, d, v) => n.forEach((m) => piano(t, m, 0.85 * v, 1.2)),
    brass: (t, n, d, v) => brass(t, n, d, 0.12 * v),
    strings: (t, n, d, v) => strings(t, n, d, 0.05 * v),
    choir: (t, n, d, v) => choir(t, n, d, 0.06 * v),
    bell: (t, n, d, v) => n.forEach((m) => bell(t, m, d * 1.5, 0.8 * v)),
    harp: (t, n, d, v) => n.forEach((m) => harp(t, m, d * 2.2, 0.5 * v)),
    cello: (t, n, d, v) => n.forEach((m) => cello(t, m, d, 0.9 * v)),
    bass: (t, n, d, v) => n.forEach((m) => bass(t, m, d, 0.9 * v)),
    growl: (t, n, d, v) => n.forEach((m) => growl(t, m, d, 0.8 * v)),
    violin: (t, n, d, v) => n.forEach((m) => violin(t, m, d, 0.85 * v)),
    timpani: (t, n, d, v) => n.forEach((m) => timpani(t, m, 0.95 * v)),
    snare: (t, n, d, v) => snare(t, 0.8 * v),
    kick: (t, n, d, v) => kick(t, 0.9 * v),
  };
  const playStinger = (id) => {
    const S = STINGERS[id];
    if (!S || !ctx || !songBus) return 0;
    const sd = 60 / S.bpm / 4;
    // за пределами окна упреждения: уже расписанные ноты саундтрека успеют затихнуть
    const t0 = now() + 0.26;
    songBus.gain.cancelScheduledValues(now());
    songBus.gain.setTargetAtTime(0.0001, now(), 0.05);
    songBus.gain.setValueAtTime(Math.pow(10, (STINGER_GAIN_DB || 0) / 20), t0 - 0.01);
    let len = 0;
    S.parts.forEach((p) => {
      const fn = STINGER_VOICES[p.inst]; if (!fn) return;
      p.notes.forEach(([st, notes, dur]) => {
        len = Math.max(len, (st + dur) * sd);
        fn(t0 + st * sd, notes, dur * sd, p.vel);
      });
    });
    stingerUntil = t0 + len + 0.35;
    outroEnd = -1; if (pending) pendingKind = 'cut';
    return len;
  };

  const scheduler = () => {
    if (!ctx || !running) return;
    if (stingerUntil) {
      if (now() < stingerUntil - 0.2) return;
      // заставка отзвучала: музыка входит с сильной доли следующего такта
      nextTime = Math.max(nextTime, stingerUntil); stingerUntil = 0; outroEnd = -1;
      stepIdx = Math.ceil(stepIdx / 16) * 16;
      if (pending && pending !== track.id) { enterTrack(pending, nextTime, false); pending = null; }
      else if (songBus) {
        const lvl = songLevel(track);
        songBus.gain.cancelScheduledValues(nextTime);
        songBus.gain.setValueAtTime(lvl * 0.6, nextTime); songBus.gain.linearRampToValueAtTime(lvl, nextTime + 0.8);
      }
    }
    if (nextTime < now() - 0.4) nextTime = now() + 0.06;
    let guard = 0;
    while (nextTime < now() + 0.22 && guard++ < 24) {
      const totalSteps = formBars * 16;
      if (stepIdx % 16 === 0) {
        // темп подтягивается к целевому потактово, а не скачком посреди фразы
        tempoMod += (tempoTarget - tempoMod) * 0.35;
        if (stepIdx > 0 && stepIdx % totalSteps === 0 && !pending) {
          // пьеса сыграна целиком — следующая входит сразу, хвост реверберации её встречает
          advancePlaylist(true);
          if (pending && pending !== track.id) { enterTrack(pending, nextTime, true); pending = null; }
        }
        if (pending === track.id) {
          // настроение вернулось раньше, чем пьеса успела смениться, — остаёмся и возвращаем громкость
          pending = null;
          if (outroEnd >= 0 && songBus) {
            songBus.gain.cancelScheduledValues(nextTime);
            songBus.gain.setTargetAtTime(songLevel(track), nextTime, 0.4);
          }
          outroEnd = -1;
        }
        if (pending && pending !== track.id) {
          if (pendingKind === 'cut' || outroEnd === stepIdx) {
            if (pendingKind === 'cut' && songBus) {
              songBus.gain.cancelScheduledValues(nextTime);
              songBus.gain.setTargetAtTime(0.0001, nextTime - 0.3 > now() ? nextTime - 0.3 : now(), 0.08);
            }
            enterTrack(pending, nextTime, pendingKind === 'outro'); pending = null;
          } else if (outroEnd < 0) {
            // смена настроения: текущая пьеса доигрывает такт, затихая, под нарастающий «вдох»
            const bs = barSeconds();
            outroEnd = stepIdx + 16;
            if (songBus) {
              songBus.gain.cancelScheduledValues(nextTime);
              songBus.gain.setValueAtTime(songLevel(track), nextTime);
              songBus.gain.linearRampToValueAtTime(songLevel(track) * 0.12, nextTime + bs);
            }
            swell(nextTime + bs * 0.35, bs * 0.65, 0.05 * (0.6 + intensity * 0.6));
          }
        }
      }
      const sd = stepDur();
      /* Свинг по характеру пьесы, а не один на всех: синтвейву и маршу нужна ровная
         механическая сетка, а джазу и лаунжу — та самая неровность восьмых, без
         которой они звучат как упражнение из учебника. */
      const feelK = track.feel === 'swing' ? 1 : track.feel === 'loose' ? 0.6 : 0.3;
      const swing = (stepIdx % 2 === 1) ? track.swing * sd * feelK : 0;
      scheduleStep(stepIdx, nextTime + swing);
      nextTime += sd; stepIdx += 1;
    }
  };

  /* ---------------------------- ЗВУКИ ИНТЕРФЕЙСА ---------------------------- */
  const tone = (freq, t0, dur, gain, wave) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = wave || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  const SFX = {
    tick: () => tone(1250, now(), 0.035, 0.028, 'triangle'),
    click: () => { const t = now(); tone(760, t, 0.05, 0.045, 'square'); tone(1140, t + 0.015, 0.05, 0.025, 'triangle'); },
    tab: () => tone(560, now(), 0.06, 0.032, 'triangle'),
    paper: () => { const t = now(); noiseHit(t, 0.28, 0.055, 'bandpass', 2600, 0.7, sfxBus); noiseHit(t + 0.09, 0.22, 0.035, 'bandpass', 3400, 0.9, sfxBus); },
    stamp: () => {
      const t = now(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.35);
      noiseHit(t, 0.09, 0.08, 'bandpass', 1800, 0.6, sfxBus);
    },
    up: () => { const t = now(); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.075, 0.4, 0.04, 'triangle')); },
    down: () => { const t = now(); [659.25, 523.25, 392.0].forEach((f, i) => tone(f, t + i * 0.085, 0.45, 0.04, 'triangle')); },
    alarm: () => { const t = now(); [0, 0.22, 0.44].forEach((d) => { tone(233, t + d, 0.18, 0.06, 'square'); tone(175, t + d + 0.09, 0.18, 0.05, 'square'); }); },
    news: () => { const t = now(); tone(1500, t, 0.04, 0.025, 'sine'); tone(2100, t + 0.05, 0.05, 0.02, 'sine'); },
    coin: () => { const t = now(); tone(988, t, 0.09, 0.035, 'triangle'); tone(1319, t + 0.05, 0.16, 0.03, 'triangle'); },
  };

  return {
    opts,
    trackName: () => track.name,
    nowPlaying: () => ({ id: track.id, name: track.name, subtitle: track.subtitle, mood: track.mood,
      moodLabel: MOOD_LABEL[track.mood], bpm: Math.round(track.bpm * tempoMod), locked: lockedMood }),
    playlist: () => listOf(lockedMood || mood).map((id) => ({ id, name: TRACKS[id].name, current: id === track.id })),
    setRole(id) {
      if (roleId === id) return;
      roleId = id || null;
      playlistIdx = 0;
      if (!lockedMood) { queue(listOf(mood)[0]); notify(); }
    },
    onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    skip(forward) { if (!ensure()) return; resume(); advancePlaylist(forward); if (!running) this.startMusic(); },
    playTrack(id) { if (!ensure()) return; resume(); pending = id; pendingKind = 'cut'; const list = listOf(lockedMood || mood); const i = list.indexOf(id); if (i >= 0) playlistIdx = i; if (!running) this.startMusic(); },
    setPlaylist(moodId) {
      lockedMood = moodId || null;
      const list = MOOD_PLAYLISTS[lockedMood || mood] || MOOD_PLAYLISTS.calm;
      playlistIdx = 0; queue(list[0]); notify();
      if (!running && opts.music) this.startMusic();
    },
    prime() { const c = ensure(); if (c) resume(); return !!c; },
    // «контекст уже создан и играет» — без создания нового: до первого действия
    // человека браузер всё равно держал бы его выключенным
    primed: () => !!ctx && ctx.state === 'running',
    play(name) {
      if (!opts.sfx) return;
      if (name === 'tick') { const t = Date.now(); if (t - lastTick < 70) return; lastTick = t; }
      if (!ensure()) return; resume();
      const fn = SFX[name]; if (fn) { try { fn(); } catch { /* тишина важнее падения */ } }
    },
    startMusic() {
      if (!ensure()) return; resume();
      if (running || !opts.music) return;
      running = true; stepIdx = 0; nextTime = now() + 0.2;
      if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 1.5);
      timer = setInterval(() => {
        try { scheduler(); } catch (err) { if (import.meta.env && import.meta.env.DEV) console.error(err); /* музыка не ломает игру */ }
      }, 40);
      notify();
    },
    stopMusic() {
      running = false;
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (musicBus) musicBus.gain.setTargetAtTime(0.0001, now(), 0.3);
      notify();
    },
    setMusic(on) {
      opts.music = on;
      if (!ensure()) return;
      if (on) { if (musicBus) musicBus.gain.setTargetAtTime(0.55, now(), 0.5); this.startMusic(); } else this.stopMusic();
    },
    setSfx(on) { opts.sfx = on; if (ensure() && sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.1); },
    setVolume(v) { opts.volume = v; if (ensure() && master) master.gain.setTargetAtTime(v, now(), 0.1); },
    setAmbience(regime, k) {
      if (!ensure()) return;
      ensureAmb();
      if (!amb) return;
      const crisis = ['banking', 'debt', 'currency', 'stagflation'].indexOf(regime) >= 0;
      const lvl = crisis ? 0.055 + 0.075 * k : regime === 'recession' ? 0.026 : regime === 'overheating' ? 0.018 : 0.005;
      amb.gain.gain.setTargetAtTime(lvl, now(), 2.2);
      amb.filter.frequency.setTargetAtTime(crisis ? 180 + 260 * k : 120, now(), 2.5);
      amb.oscB.detune.setTargetAtTime(crisis ? 20 + 14 * k : 6, now(), 2.5);
      amb.wind.frequency.setTargetAtTime(crisis ? 420 + 300 * k : 260, now(), 2.5);
      if (crisis && k > 0.5) {
        if (!heartTimer) heartTimer = setInterval(() => { try { heartbeat(); } catch { /* тихо */ } }, 1700);
      } else if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
    },
    setMood(e) {
      const m = moodFor(e);
      intensity = clamp((e.inflationRisk * 0.3 + e.bankingRisk * 0.3 + e.debtRisk * 0.2 + e.recessionRisk * 0.2) / 100, 0, 1);
      /* Темп дышит экономикой: рост и тревога его подгоняют, а инфляция разгоняет
         сильнее всего — при гиперинфляции музыка буквально не успевает за ценами. */
      const inflPush = clamp(((e.inflation || 0) - 6) * 0.0035, 0, 0.14);
      tempoTarget = clamp(0.95 + (e.gdpGrowth - 2.0) * 0.012 + intensity * 0.05 + inflPush, 0.9, 1.22);
      if (!running) tempoMod = tempoTarget;
      this.setAmbience(e.regime, intensity);
      if (m !== mood) {
        mood = m; playlistIdx = 0;
        if (!lockedMood) {
          // если играющая пьеса подходит и новому настроению — она остаётся
          // (быстрый возврат настроения отменяет уже начатое затухание)
          const list = listOf(m); const i = list.indexOf(track.id);
          if (i >= 0 && running) { playlistIdx = i; pending = track.id; } else queue(list[0]);
          notify();
        }
      }
    },
    // сыграть заставку вне квартала (например, из обучения); возвращает длительность в секундах
    stinger(id) { if (!opts.music || !ensure()) return 0; resume(); return playStinger(id); },
    // офлайн-заставка: то же, что в игре, но поверх OfflineAudioContext
    stingerOffline(id) { if (!options.context || !ensure()) return 0; return playStinger(id); },
    /* Офлайн-рендер: расписать пьесу целиком наперёд, без таймеров. Работает только
       поверх OfflineAudioContext, переданного в фабрику, — см. renderTrackOffline. */
    scheduleOffline(id, seconds) {
      if (!options.context || !ensure() || !TRACKS[id]) return 0;
      setTrack(id); tempoMod = 1; running = true; nextTime = 0.05;
      songBus.gain.cancelScheduledValues(0); songBus.gain.value = songLevel(track);
      const total = formBars * 16;
      while (stepIdx < total && nextTime < seconds) {
        const sd = stepDur();
        const feelK = track.feel === 'swing' ? 1 : track.feel === 'loose' ? 0.6 : 0.3;
        scheduleStep(stepIdx, nextTime + ((stepIdx % 2 === 1) ? track.swing * sd * feelK : 0));
        nextTime += sd; stepIdx += 1;
      }
      running = false;
      return nextTime;
    },
    quarterSequence({ wellbeingDelta, newCrisis, bigNews, stinger }) {
      if (!ensure()) return; resume();
      // заставка — это музыка: звучит, если включена музыка, даже при выключенных звуках интерфейса
      const staged = !!(stinger && opts.music && playStinger(stinger));
      if (!opts.sfx) return;
      SFX.stamp();
      setTimeout(() => { if (bigNews && !staged) SFX.news(); }, 240);
      setTimeout(() => {
        if (staged) return;
        if (newCrisis) SFX.alarm();
        else if (wellbeingDelta > 0.6) SFX.up();
        else if (wellbeingDelta < -0.6) SFX.down();
      }, 430);
    },
  };
}

export const Audio = createAudioEngine();

/* Длительность одного прохода формы пьесы в секундах (без учёта модуляции темпа). */
export const trackSeconds = (id) => {
  const t = TRACKS[id];
  const bars = t.sections.reduce((a, s) => a + t[s.h].length, 0);
  return bars * 16 * (60 / t.bpm / 4);
};

/* Отрендерить пьесу в буфер без звука в колонках. Нужен браузер с OfflineAudioContext;
   используется скриптом замера громкости (scripts/loudness.mjs). */
export async function renderTrackOffline(id, { seconds, sampleRate = 22050, bypassCompressor = true, trackGain = true } = {}) {
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!OAC || !TRACKS[id]) return null;
  const len = Math.min(seconds || trackSeconds(id), 240) + 2.5;   // хвост реверберации
  const ctx = new OAC(2, Math.ceil(len * sampleRate), sampleRate);
  const eng = createAudioEngine({ context: ctx, bypassCompressor, trackGain });
  eng.opts.volume = 1;
  eng.scheduleOffline(id, len - 2.5);
  return ctx.startRendering();
}

/* Отрендерить заставку события — для замера её громкости рядом с пьесами. */
export async function renderStingerOffline(id, { sampleRate = 22050 } = {}) {
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  const S = STINGERS[id];
  if (!OAC || !S) return null;
  const steps = S.parts.reduce((a, p) => Math.max(a, ...p.notes.map(([st, , d]) => st + d)), 0);
  const len = steps * 60 / S.bpm / 4 + 3;
  const ctx = new OAC(2, Math.ceil(len * sampleRate), sampleRate);
  const eng = createAudioEngine({ context: ctx, bypassCompressor: true });
  eng.opts.volume = 1;
  eng.stingerOffline(id);
  return ctx.startRendering();
}

/* Громкость буфера: RMS в дБ полной шкалы (по окнам 400 мс, тихие окна отброшены,
   как в стробируемой громкости), пик и крест-фактор. */
export const measureBuffer = (buf) => {
  const chans = []; for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
  const win = Math.floor(buf.sampleRate * 0.4);
  const blocks = []; let peak = 0;
  for (let i = 0; i + win <= buf.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) {
      for (const d of chans) { const v = d[j]; sum += v * v; const a = v < 0 ? -v : v; if (a > peak) peak = a; }
    }
    blocks.push(sum / (win * chans.length));
  }
  const db = (x) => 10 * Math.log10(Math.max(x, 1e-12));
  const loud = blocks.filter((b) => db(b) > -70);
  const ungated = loud.reduce((a, b) => a + b, 0) / Math.max(1, loud.length);
  const gated = loud.filter((b) => db(b) > db(ungated) - 10);
  const rms = db(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
  return { rms: Math.round(rms * 10) / 10, peak: Math.round(20 * Math.log10(Math.max(peak, 1e-9)) * 10) / 10 };
};
