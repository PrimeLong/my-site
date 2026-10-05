/* «СЛУШАЙ» И «ИСТОРИЯ».
   mode = 'story' — лента переписки героев на полосе «Вестника»: сообщения появляются по
   одному (кнопка «Дальше» в уроке), вопросы встают в ленту прямо между ними; текст виден сразу.
   mode = 'listen' — радиоприёмник: на экране один сюжет эфира — крупная кнопка «слушать»
   (Web Speech API, русский голос; читаемое слово подсвечено), под ним — вопрос про этот сюжет.
   Текст сюжета скрыт — открывается «показать текст», а после ответа на вопрос виден сам.
   Вопрос эфир не пересказывает: ответ — в том, что прозвучало. Прошлые сюжеты — в архиве
   эфира под вопросом: их можно переслушать и перечитать. Голоса в браузере нет — текст
   виден сразу, подсветка идёт в темпе чтения вслух.
   Плашка «верно / не совсем» у живого вопроса — в нижней панели урока, как у остальных
   упражнений: её видно без прокрутки. */
import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Eye, EyeOff, Newspaper, Radio, Volume2, Play, RotateCcw, ChevronRight } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { Guilloche } from './ds-art.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { Portrait } from './learn-play.jsx';
import { CAST, DEFAULT_VOICE } from './learn/cast.js';
import { voiceFor, VOICE_CAPTION } from './learn/voices.js';
import { plainText } from './textbook/content.js';

export const FEED_CSS = `
  .fd { display: flex; flex-direction: column; gap: 12px; }
  .fd-mast { border: 1px solid var(--ds-rule2); border-radius: 3px; background: var(--ds-card); padding: 0 0 10px; text-align: center; overflow: hidden; }
  .fd-mast-name { font: 700 12px/1 var(--ds-serif); letter-spacing: .28em; text-transform: uppercase; color: var(--ds-ink2); margin: 10px 0 4px; display: inline-flex; align-items: center; gap: 6px; }
  .fd-mast h2 { margin: 2px 12px 0; }
  .fd-msg { display: flex; gap: 10px; align-items: flex-start; }
  .fd-ava { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--ds-card2); color: var(--u-ink); border: 1.5px solid var(--ds-rule2); }
  .fd-bubble { flex: 1; min-width: 0; background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 3px 12px 12px 12px; padding: 9px 12px 10px;
    box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px var(--ds-rule); transition: box-shadow .2s, border-color .2s; }
  .fd[data-mode="story"] .fd-bubble { font-family: var(--ds-serif); background: color-mix(in srgb, #F3E6C4 45%, var(--ds-card)); }
  /* тёмная тема: светлая «бумага» под светлым текстом давала контраст ниже 4,5:1 — здесь лишь лёгкий тёплый оттенок */
  .ds-dark .fd[data-mode="story"] .fd-bubble { background: color-mix(in srgb, #F3E6C4 7%, var(--ds-card)); }
  .fd-bubble.speaking { border-color: var(--u); box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px var(--u); }
  .fd-who { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
  .fd-who b { font: 700 14px var(--ds-serif); color: var(--u-ink); }
  .fd-who span { font: 12px var(--ds-sans); color: var(--ds-ink3); }
  .fd-title { font: 700 15px/1.3 var(--ds-serif); margin: 2px 0 4px; }
  .fd-text { font-size: 16px; line-height: 1.55; }
  .fd-hidden { font: 13.5px var(--ds-sans); color: var(--ds-ink3); letter-spacing: .02em; }
  .fd-voice-note { font: 12px/1.3 var(--ds-sans); color: var(--ds-ink2); margin-top: 2px; }
  .fd-tools { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .fd-tool { background: none; border: none; padding: 2px 0; font: 700 13px var(--ds-sans); color: var(--u-ink); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  .fd-word.on { background: color-mix(in srgb, var(--u) 28%, transparent); border-radius: 3px; }
  .fd-word.done { color: var(--ds-ink); }
  .fd-q { border-left: 3px solid var(--u); padding: 2px 0 2px 12px; }
  .fd-q-label { margin-bottom: 6px; }
  .fd-new { animation: ds-rise .25s ease-out 1 both; }
  /* радиоприёмник «Слушай» */
  .fd-set { position: relative; border: 1px solid var(--ds-rule2); border-radius: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--u) 9%, var(--ds-card)), var(--ds-card));
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule), 0 2px 4px var(--ds-shade); padding: 12px 14px 12px; }
  .fd-set-top { display: flex; align-items: center; gap: 8px; font: 700 12px var(--ds-sans); letter-spacing: .14em; text-transform: uppercase; color: var(--ds-ink2); }
  .fd-onair { display: inline-flex; align-items: center; gap: 5px; color: var(--ds-bad); }
  .fd-onair::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-bad) 25%, transparent); }
  .fd-set[data-speaking="true"] .fd-onair::before { animation: fd-blink 1s steps(2) infinite; }
  @keyframes fd-blink { 50% { opacity: .25; } }
  .fd-set-main { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
  .fd-play { width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; border: none; cursor: pointer; background: var(--u); color: #fff; display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 0 0 3px var(--u), inset 0 0 0 5px rgba(255,255,255,.45), 0 3px 0 color-mix(in srgb, var(--u) 60%, #000); }
  .fd-play:active { transform: translateY(2px); box-shadow: inset 0 0 0 3px var(--u), inset 0 0 0 5px rgba(255,255,255,.45), 0 1px 0 color-mix(in srgb, var(--u) 60%, #000); }
  .fd-set-title { font: 700 18px/1.25 var(--ds-serif); }
  .fd-eq { display: flex; align-items: flex-end; gap: 3px; height: 22px; margin-top: 6px; }
  .fd-eq i { width: 5px; height: 4px; border-radius: 1px; background: var(--u); opacity: .55; }
  .fd-set[data-speaking="true"] .fd-eq i { animation: fd-eq .9s ease-in-out infinite alternate; opacity: 1; }
  .fd-eq i:nth-child(2n) { animation-delay: -.3s !important; } .fd-eq i:nth-child(3n) { animation-delay: -.6s !important; } .fd-eq i:nth-child(5n) { animation-duration: .7s !important; }
  @keyframes fd-eq { 0% { height: 4px; } 100% { height: 22px; } }
  .fd-set .fd-text { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--ds-rule2); }
  .fd-set .fd-hidden { margin-top: 10px; }
  .fd-archive { border-top: 1px solid var(--ds-rule2); padding-top: 6px; }
  .fd-archive-head { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; padding: 8px 0; font: 700 14px var(--ds-sans); color: var(--ds-ink2); cursor: pointer; text-align: left; }
  @media (prefers-reduced-motion: reduce) { .fd-new { animation: none; } .fd-bubble { transition: none; } .fd-set .fd-eq i, .fd-onair::before { animation: none !important; } }
`;

/* Голос: одна озвучка на ленту. speak(key, text, who) читает сообщение голосом героя
   (src/learn/voices.js: свой темп, высота и голос) и подсвечивает слово; без голоса —
   подсветка в темпе чтения вслух (около 2,6 слова в секунду). */
const browserVoices = () => {
  try { const s = window.speechSynthesis; return s ? s.getVoices() : []; } catch { return []; }
};
const splitWords = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const starts = []; words.reduce((pos, w) => { const k = text.indexOf(w, pos); starts.push(k); return k + w.length; }, 0);
  return { words, starts };
};
function useSpeech() {
  const reduced = useReducedMotion();
  const [voices, setVoices] = useState(browserVoices);
  const [broken, setBroken] = useState(false);
  // voice — есть ли русский голос вообще; какой именно, решает voiceFor по герою
  const voice = !broken && voices.some((v) => /^ru/i.test(v.lang));
  const [now, setNow] = useState({ key: null, at: -1 });
  const timer = useRef(null);
  useEffect(() => {
    const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!s || !s.addEventListener) return undefined;
    const f = () => setVoices(browserVoices());
    s.addEventListener('voiceschanged', f);
    return () => { s.removeEventListener('voiceschanged', f); try { s.cancel(); } catch { /* нет голоса */ } clearInterval(timer.current); };
  }, []);
  const speak = (key, text, who = 'narrator') => {
    Audio.prime();
    const { words, starts } = splitWords(text);
    clearInterval(timer.current);
    if (!voice) {
      if (reduced) { setNow({ key, at: words.length }); return; }
      let k = 0; setNow({ key, at: 0 });
      timer.current = setInterval(() => { k += 1; setNow({ key, at: k }); if (k >= words.length) { clearInterval(timer.current); setNow({ key: null, at: -1 }); } }, 380);
      return;
    }
    try {
      const s = window.speechSynthesis; s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voiceFor(who, voices);
      u.voice = v.voice; u.lang = v.voice.lang; u.rate = v.rate; u.pitch = v.pitch;
      u.onboundary = (e) => { const k = starts.findIndex((p, i) => e.charIndex >= p && (i === starts.length - 1 || e.charIndex < starts[i + 1])); if (k >= 0) setNow({ key, at: k }); };
      u.onend = () => setNow((n) => (n.key === key ? { key: null, at: -1 } : n));
      u.onerror = () => { setNow({ key: null, at: -1 }); setBroken(true); };
      setNow({ key, at: 0 }); s.speak(u);
    } catch { setBroken(true); }
  };
  return { voice, now, speak };
}

const msgText = (card) => plainText(card.text || []);
function Words({ text, at }) {
  const { words } = splitWords(text);
  return <>{words.map((w, i) => <React.Fragment key={i}><span className={`fd-word ${i === at ? 'on' : i < at ? 'done' : ''}`}>{w}</span>{' '}</React.Fragment>)}</>;
}

function Message({ entry, mode, speech, picture, skipTitle, flag }) {
  const { card, live, revealed, index } = entry;
  const listen = mode === 'listen';
  // шаг без героя — голос рассказчика (в эфире — ведущей), со своим аватаром
  const whoId = card.who || DEFAULT_VOICE[listen ? 'listen' : 'story'];
  const who = CAST[whoId];
  const [shown, setShown] = useState(false);
  const speaking = speech.now.key === entry.key;
  // аудиоурок: текст скрыт, пока его не открыли или пока не отвечен вопрос после сообщения
  const visible = !listen || !speech.voice || shown || revealed;
  const text = msgText(card);
  return (
    <div className={`fd-msg ${live ? 'fd-new' : ''}`} data-testid={live ? 'lesson-card' : 'feed-msg'} data-style={mode} data-key={entry.key}>
      <Portrait who={whoId} size={44} />
      <div className={`fd-bubble ${speaking ? 'speaking' : ''}`}>
        <div className="fd-who">
          <b>{who.name}</b>
          <span>{who.role}</span>
          <span className="ln-kind">сообщение {index}</span>
          <span style={{ flex: 1 }} />{flag}
        </div>
        {card.title && card.title !== skipTitle && <div className="fd-title">{card.title}</div>}
        {visible ? (
          <div className="fd-text" data-testid={listen ? 'listen-text' : 'feed-text'}>
            {speaking || (listen && !speech.voice && speech.now.key === entry.key) ? <Words text={text} at={speech.now.at} /> : <Inline nodes={card.text} />}
          </div>
        ) : <div className="fd-hidden" data-testid="feed-hidden">Текст скрыт — это аудиоурок. Послушайте сообщение.</div>}
        {visible && picture}
        {listen && (
          <div className="fd-tools">
            <button type="button" className="fd-tool" data-testid="feed-play" aria-label={`Прослушать сообщение ${index}`} onClick={() => speech.speak(entry.key, text, whoId)}>
              {speaking ? <Volume2 size={15} aria-hidden="true" /> : <Headphones size={15} aria-hidden="true" />}{speaking ? 'читаю…' : 'прослушать'}
            </button>
            {speech.voice && !revealed && (
              <button type="button" className="fd-tool" data-testid="feed-toggle" onClick={() => { Audio.play('paper'); setShown((v) => !v); }}>
                {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}{shown ? 'скрыть текст' : 'показать текст'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Сюжет эфира крупно: «в эфире», номер сюжета, кнопка «слушать», эквалайзер, пока читают;
   текст — по «показать текст» или после ответа на вопрос. */
function RadioSet({ entry, speech, picture, skipTitle, flag }) {
  const { card, live, revealed, index } = entry;
  const [shown, setShown] = useState(false);
  const speaking = speech.now.key === entry.key;
  const visible = !speech.voice || shown || revealed;
  const text = msgText(card);
  return (
    <div className={`fd-set ${live ? 'fd-new' : ''}`} data-testid={live ? 'lesson-card' : 'feed-msg'} data-style="listen" data-key={entry.key} data-speaking={String(speaking)}>
      <div className="fd-set-top">
        <Portrait who={card.who || DEFAULT_VOICE.listen} size={26} />
        <span className="fd-onair">в эфире</span><span className="ln-kind" style={{ margin: 0 }}>· {(CAST[card.who] || CAST[DEFAULT_VOICE.listen]).name} · сюжет {index}</span><span style={{ flex: 1 }} />{flag}
      </div>
      <div className="fd-set-main">
        <button type="button" className="fd-play" data-testid="feed-play" aria-label={`${speaking ? 'Читаю' : 'Слушать'}: сюжет ${index}`} onClick={() => speech.speak(entry.key, text, card.who || DEFAULT_VOICE.listen)}>
          {speaking ? <Volume2 size={28} aria-hidden="true" /> : <Play size={28} aria-hidden="true" style={{ marginLeft: 3 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fd-set-title">{card.title && card.title !== skipTitle ? card.title : index === 1 ? 'Начало эфира' : 'Эфир'}</div>
          <div className="fd-eq" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
        </div>
      </div>
      {visible ? (
        <div className="fd-text" data-testid="listen-text">
          {speaking || (!speech.voice && speech.now.key === entry.key) ? <Words text={text} at={speech.now.at} /> : <Inline nodes={card.text} />}
        </div>
      ) : <div className="fd-hidden" data-testid="feed-hidden">Текст скрыт — это аудиоурок. Нажмите «слушать».</div>}
      {visible && picture}
      {speech.voice && !revealed && (
        <div className="fd-tools">
          <button type="button" className="fd-tool" data-testid="feed-toggle" onClick={() => { Audio.play('paper'); setShown((v) => !v); }}>
            {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}{shown ? 'скрыть текст' : 'показать текст'}
          </button>
        </div>
      )}
    </div>
  );
}
// прошлые сюжеты — в архиве эфира: переслушать, перечитать, посмотреть свой ответ
function RadioArchive({ items, speech, picture, skipTitle, flagFor }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const n = items.filter((e) => e.kind === 'msg').length;
  return (
    <div className="fd-archive" data-testid="radio-archive">
      <button type="button" className="fd-archive-head" aria-expanded={open} onClick={() => { Audio.play('paper'); setOpen((v) => !v); }}>
        <RotateCcw size={16} aria-hidden="true" /><span style={{ flex: 1 }}>Архив эфира: {n} {n === 1 ? 'сюжет' : n < 5 ? 'сюжета' : 'сюжетов'}</span>
        <ChevronRight size={16} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
      </button>
      {open && (
        <div className="fd" style={{ gap: 10 }}>
          {items.map((e) => (e.kind === 'msg'
            ? <Message key={e.key} entry={e} mode="listen" speech={speech} picture={picture(e.card)} skipTitle={skipTitle} flag={flagFor(e)} />
            : <div key={e.key} className="fd-q" data-testid="feed-q"><div className="ds-eyebrow fd-q-label" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Вопрос</span>{e.flag}</div>{e.node}</div>))}
        </div>
      )}
    </div>
  );
}

/* entries: [{ kind: 'msg', key, card, index, live, revealed }, { kind: 'q', key, node, live }].
   picture(card) — картинка или мини-график шага (их рисует урок). */
export function Feed({ mode, title, entries, picture, skipTitle = null, flagFor = () => null }) {
  const speech = useSpeech();
  const reduced = useReducedMotion();
  const lastRef = useRef(null);
  const last = entries[entries.length - 1];
  const lastKey = last ? last.key : null;
  // новое сообщение или вопрос — прокрутка к нему; новое сообщение эфира — сразу читается голосом
  useEffect(() => {
    if (!last) return;
    if (mode !== 'listen' && lastRef.current && lastRef.current.scrollIntoView) lastRef.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: last.kind === 'q' ? 'start' : 'nearest' });
    if (mode === 'listen' && last.kind === 'msg' && last.live && speech.voice) speech.speak(last.key, msgText(last.card), last.card.who || DEFAULT_VOICE.listen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);
  if (mode === 'listen') {
    // на экране — последний сюжет и вопрос к нему; всё, что раньше, — в архиве
    const at = entries.map((e, i) => (e.kind === 'msg' ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    const cur = at >= 0 ? entries[at] : null;
    const q = entries.slice(at + 1).find((e) => e.kind === 'q' && e.live) || null;
    const past = entries.slice(0, Math.max(0, at));
    return (
      <div className="fd" data-mode="listen" data-testid="listen-card" data-voice={speech.voice ? 'on' : 'off'}>
        <div className="fd-mast">
          <Guilloche height={14} opacity={0.45} />
          <div className="fd-mast-name"><Radio size={14} aria-hidden="true" />Радио Инфлатии · эфир</div>
          <h2 className="ds-h2">{title}</h2>
          {speech.voice && <div className="fd-voice-note" data-testid="voice-caption">{VOICE_CAPTION}</div>}
        </div>
        {/* значок сюжета в приёмнике не нужен — только график, если он есть: вопрос остаётся рядом */}
        {cur && <RadioSet entry={cur} speech={speech} picture={cur.card.chart ? picture(cur.card) : null} skipTitle={skipTitle} flag={flagFor(cur)} />}
        {q && <div className={`fd-q ${q.live ? 'fd-new' : ''}`}><div className="ds-eyebrow fd-q-label" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Вопрос к сюжету</span>{q.flag}</div>{q.node}</div>}
        <RadioArchive items={past} speech={speech} picture={picture} skipTitle={skipTitle} flagFor={flagFor} />
      </div>
    );
  }
  return (
    <div className="fd" data-mode={mode} data-testid={mode === 'listen' ? 'listen-card' : 'story-feed'} data-voice={speech.voice ? 'on' : 'off'}>
      <div className="fd-mast">
        <Guilloche height={14} opacity={0.45} />
        <div className="fd-mast-name">{mode === 'listen' ? <><Radio size={14} aria-hidden="true" />Радио Инфлатии · эфир</> : <><Newspaper size={14} aria-hidden="true" />Вестник Инфлатии · переписка</>}</div>
        <h2 className="ds-h2">{title}</h2>
      </div>
      {entries.map((e) => (
        <div key={e.key} ref={e === last ? lastRef : undefined} style={{ scrollMarginTop: 12, scrollMarginBottom: 12 }}>
          {e.kind === 'msg'
            ? <Message entry={e} mode={mode} speech={speech} picture={picture(e.card)} skipTitle={skipTitle} flag={flagFor(e)} />
            : <div className={`fd-q ${e.live ? 'fd-new' : ''}`} data-testid={e.live ? undefined : 'feed-q'}><div className="ds-eyebrow fd-q-label" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Вопрос</span>{e.flag}</div>{e.node}</div>}
        </div>
      ))}
    </div>
  );
}
