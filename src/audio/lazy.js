/* Лёгкая обёртка над звуковым движком для стартового экрана.

   Движок с саундтреком (engine.js + tracks.js) — около 140 КБ исходников, и раньше
   он ехал в стартовом файле вместе с меню, хотя до первого клика не звучит ничего.
   Теперь меню получает эту обёртку с тем же набором методов, а сам движок
   загружается при первом звуке или первом «prime» — то есть по первому клику.

   Всё, что вызвали до загрузки, ставится в очередь и проигрывается после неё
   (кроме коротких звуков интерфейса — их, опоздавших, лучше пропустить). AudioContext
   создаётся сразу внутри клика: Safari на iPhone разрешает звук только контексту,
   запущенному прямо в жесте, а движок потом подхватывает его (adopt). */
const opts = { music: true, sfx: true, volume: 0.6 };
let real = null;
let meta = null;
let loading = null;
let earlyCtx = null;
const queue = [];
const listeners = new Set();
const notify = () => listeners.forEach((f) => { try { f(); } catch { /* подписчик сам разберётся */ } });

function load() {
  if (loading) return loading;
  loading = Promise.all([import('./engine.js'), import('./tracks.js')]).then(([eng, tr]) => {
    real = eng.Audio;
    meta = { TRACKS: tr.TRACKS, STINGERS: tr.STINGERS, MOOD_LABEL: tr.MOOD_LABEL };
    if (earlyCtx) real.adopt(earlyCtx);
    // настройки, выставленные до загрузки, переезжают в движок
    real.setVolume(opts.volume); real.setSfx(opts.sfx);
    if (!opts.music) real.setMusic(false);
    listeners.forEach((f) => real.onChange(f));
    queue.splice(0).forEach(([name, args]) => { try { real[name](...args); } catch { /* тихо */ } });
    notify();
    return real;
  }).catch(() => { loading = null; });
  return loading;
}

const makeEarlyCtx = () => {
  if (earlyCtx || typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { earlyCtx = new AC({ latencyHint: 'playback' }); } catch { try { earlyCtx = new AC(); } catch { earlyCtx = null; } }
  try { if (earlyCtx && earlyCtx.state === 'suspended') earlyCtx.resume(); } catch { /* тихо */ }
};

// метод, который до загрузки движка откладывается (или молча пропускается)
const deferred = (name, { drop = false } = {}) => (...args) => {
  if (real) return real[name](...args);
  if (!drop) queue.push([name, args]);
  makeEarlyCtx(); load();
  return undefined;
};

export const Audio = {
  get opts() { return real ? real.opts : opts; },
  prime() {
    if (real) return real.prime();
    makeEarlyCtx(); queue.push(['prime', []]); load();
    return !!earlyCtx;
  },
  primed() { return real ? real.primed() : !!earlyCtx; },
  play: deferred('play', { drop: true }),
  startMusic: deferred('startMusic'),
  stopMusic: deferred('stopMusic'),
  setRole: deferred('setRole'),
  setPlaylist: deferred('setPlaylist'),
  setMood: deferred('setMood'),
  skip: deferred('skip'),
  playTrack: deferred('playTrack'),
  quarterSequence: deferred('quarterSequence', { drop: true }),
  stinger(id) { if (real) return real.stinger(id); load(); return 0; },
  setVolume(v) { opts.volume = v; if (real) real.setVolume(v); },
  setSfx(v) { opts.sfx = v; if (real) real.setSfx(v); },
  setMusic(v) { opts.music = v; if (real) real.setMusic(v); else if (v) { queue.push(['setMusic', [v]]); load(); } },
  nowPlaying() { return real ? real.nowPlaying() : { name: 'Саундтрек загрузится по первому клику', subtitle: '', moodLabel: '', bpm: '—', locked: null }; },
  playlist() { return real ? real.playlist() : []; },
  onChange(fn) {
    listeners.add(fn);
    const off = real ? real.onChange(fn) : null;
    return () => { listeners.delete(fn); if (off) off(); };
  },
  // названия пьес и заставок — для панели саундтрека; до загрузки их ещё нет
  meta() { if (!meta) load(); return meta; },
};
