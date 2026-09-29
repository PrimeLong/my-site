/* ЛЕНТА «СЛУШАЙ» И «ИСТОРИЯ» — один компонент с разными настройками.
   Сообщения героев появляются по одному (кнопка «Дальше» в уроке), вопросы встают в ленту
   прямо между ними — про то, что только что прозвучало, и ответ с плашкой верно/неверно
   остаётся там же. Всё прошлое можно пролистать и перечитать.
   mode = 'story' — переписка героев на полосе «Вестника»: текст виден сразу.
   mode = 'listen' — радиоэфир: у каждого сообщения «прослушать» (Web Speech API, русский
   голос; читаемое сообщение и слово подсвечены); текст скрыт — открывается «показать текст»,
   а после ответа на вопрос, который идёт за сообщением, виден сам. Голоса в браузере нет —
   текст виден сразу, подсветка идёт в темпе чтения вслух. */
import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Eye, EyeOff, Newspaper, Radio, Volume2 } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { Guilloche } from './ds-art.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { Portrait } from './learn-play.jsx';
import { CAST } from './learn/cast.js';
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
  .fd-bubble.speaking { border-color: var(--u); box-shadow: inset 0 0 0 2px var(--ds-card), inset 0 0 0 3px var(--u); }
  .fd-who { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
  .fd-who b { font: 700 14px var(--ds-serif); color: var(--u-ink); }
  .fd-who span { font: 12px var(--ds-sans); color: var(--ds-ink3); }
  .fd-title { font: 700 15px/1.3 var(--ds-serif); margin: 2px 0 4px; }
  .fd-text { font-size: 16px; line-height: 1.55; }
  .fd-hidden { font: 13.5px var(--ds-sans); color: var(--ds-ink3); letter-spacing: .02em; }
  .fd-tools { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .fd-tool { background: none; border: none; padding: 2px 0; font: 700 13px var(--ds-sans); color: var(--u-ink); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  .fd-word.on { background: color-mix(in srgb, var(--u) 28%, transparent); border-radius: 3px; }
  .fd-word.done { color: var(--ds-ink); }
  .fd-q { border-left: 3px solid var(--u); padding: 2px 0 2px 12px; }
  .fd-q-label { margin-bottom: 6px; }
  .fd-new { animation: ds-rise .25s ease-out 1 both; }
  @media (prefers-reduced-motion: reduce) { .fd-new { animation: none; } .fd-bubble { transition: none; } }
`;

/* Голос: одна озвучка на ленту. speak(key, text) читает сообщение и подсвечивает слово;
   без голоса — подсветка в темпе чтения вслух (около 2,6 слова в секунду). */
const ruVoice = () => {
  try { const s = window.speechSynthesis; if (!s) return null; return s.getVoices().find((v) => /^ru/i.test(v.lang)) || null; } catch { return null; }
};
const splitWords = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const starts = []; words.reduce((pos, w) => { const k = text.indexOf(w, pos); starts.push(k); return k + w.length; }, 0);
  return { words, starts };
};
function useSpeech() {
  const reduced = useReducedMotion();
  const [voice, setVoice] = useState(ruVoice);
  const [now, setNow] = useState({ key: null, at: -1 });
  const timer = useRef(null);
  useEffect(() => {
    const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!s || !s.addEventListener) return undefined;
    const f = () => setVoice(ruVoice());
    s.addEventListener('voiceschanged', f);
    return () => { s.removeEventListener('voiceschanged', f); try { s.cancel(); } catch { /* нет голоса */ } clearInterval(timer.current); };
  }, []);
  const speak = (key, text) => {
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
      u.voice = voice; u.lang = voice.lang; u.rate = 0.95;
      u.onboundary = (e) => { const k = starts.findIndex((p, i) => e.charIndex >= p && (i === starts.length - 1 || e.charIndex < starts[i + 1])); if (k >= 0) setNow({ key, at: k }); };
      u.onend = () => setNow((n) => (n.key === key ? { key: null, at: -1 } : n));
      u.onerror = () => { setNow({ key: null, at: -1 }); setVoice(null); };
      setNow({ key, at: 0 }); s.speak(u);
    } catch { setVoice(null); }
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
  const who = card.who ? CAST[card.who] : null;
  const [shown, setShown] = useState(false);
  const listen = mode === 'listen';
  const speaking = speech.now.key === entry.key;
  // аудиоурок: текст скрыт, пока его не открыли или пока не отвечен вопрос после сообщения
  const visible = !listen || !speech.voice || shown || revealed;
  const text = msgText(card);
  return (
    <div className={`fd-msg ${live ? 'fd-new' : ''}`} data-testid={live ? 'lesson-card' : 'feed-msg'} data-style={mode} data-key={entry.key}>
      {who ? <Portrait who={card.who} size={44} /> : <span className="fd-ava" aria-hidden="true">{listen ? <Radio size={20} /> : <Newspaper size={20} />}</span>}
      <div className={`fd-bubble ${speaking ? 'speaking' : ''}`}>
        <div className="fd-who">
          <b>{who ? who.name : listen ? 'Эфир' : '«Вестник»'}</b>
          {who && <span>{who.role}</span>}
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
            <button type="button" className="fd-tool" data-testid="feed-play" aria-label={`Прослушать сообщение ${index}`} onClick={() => speech.speak(entry.key, text)}>
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
    if (lastRef.current && lastRef.current.scrollIntoView) lastRef.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: last.kind === 'q' ? 'start' : 'nearest' });
    if (mode === 'listen' && last.kind === 'msg' && last.live && speech.voice) speech.speak(last.key, msgText(last.card));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);
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
