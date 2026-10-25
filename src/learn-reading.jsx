/* «ЧТЕНИЕ» — экран урока-подборки цитат (содержание и правила — src/learn/reading.js, docs/mechanics.md).
   Страница книги: печать-монограмма автора, годы, книга и год, цитата антиквой — слова проступают, как
   чернила; ниже — контекст и вопрос. «Найдите в цитате»: слова цитаты нажимаются, верное место
   подчёркивается маркером. В конце — полка: прочитанная подборка встаёт книгой к остальным. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, BookOpen, ArrowRight } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, IconButton } from './ds.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { READING_BY_ID, READ_XP, quoteWords, isRead, shelfOf } from './learn/reading.js';
import { finishLesson, markRead } from './textbook/learn-state.js';

const CSS = `
  .rd-root { position: fixed; inset: 0; z-index: 300; overflow-y: auto; overscroll-behavior: contain; color: var(--ds-ink);
    background: radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--rd) 7%, var(--ds-paper)) 0%, var(--ds-paper) 60%), var(--ds-paper); }
  .rd-top { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: color-mix(in srgb, var(--ds-paper) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--ds-rule2); }
  .rd-title { flex: 1; min-width: 0; font: 700 15px var(--ds-head); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rd-marks { display: flex; gap: 5px; }
  .rd-marks i { width: 9px; height: 18px; border-radius: 0 0 3px 3px; background: var(--ds-rule); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); transition: background .3s, transform .3s; }
  .rd-marks i.on { background: var(--rd); transform: translateY(2px); }
  .rd-page { max-width: 680px; margin: 0 auto; padding: 22px 18px 120px; }
  .rd-sheet { position: relative; background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 22px; padding: 26px 24px 22px;
    box-shadow: 0 1px 0 var(--ds-rule2), 0 18px 40px -26px rgba(40, 24, 8, .45); animation: rd-turn .45s cubic-bezier(.2, .9, .3, 1) backwards; }
  .rd-sheet::before { content: ''; position: absolute; inset: 10px; border-radius: 15px; border: 1px solid color-mix(in srgb, var(--rd) 22%, transparent); pointer-events: none; }
  @keyframes rd-turn { from { opacity: 0; transform: translateX(26px) rotate(.6deg); } }
  .rd-who { display: flex; align-items: center; gap: 14px; }
  .rd-seal { flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; color: var(--rd-ink); font: 700 19px var(--ds-news, Georgia, serif); letter-spacing: .04em;
    background: radial-gradient(circle, color-mix(in srgb, var(--rd) 10%, var(--ds-card)) 58%, transparent 59%);
    box-shadow: inset 0 0 0 2px var(--rd), inset 0 0 0 5px var(--ds-card), inset 0 0 0 6px color-mix(in srgb, var(--rd) 55%, transparent); }
  .rd-name { font: 700 17px var(--ds-head); }
  .rd-meta { font-size: 13.5px; color: var(--ds-ink2); line-height: 1.35; margin-top: 2px; }
  .rd-meta em { font-style: italic; }
  .rd-quote { position: relative; margin: 22px 0 18px; padding-left: 26px; font: italic 400 clamp(19px, 2.4vw, 24px)/1.5 var(--ds-news, 'PT Serif', Georgia, serif); color: var(--ds-ink); }
  .rd-quote::before { content: '«'; position: absolute; left: -4px; top: -14px; font: 700 54px/1 var(--ds-news, Georgia, serif); color: var(--rd); opacity: .55; }
  .rd-w { display: inline; animation: rd-ink .7s ease-out backwards; animation-delay: calc(var(--i) * 28ms + 120ms); border-radius: 4px; }
  @keyframes rd-ink { from { opacity: 0; filter: blur(3px); } }
  .rd-w.tap { cursor: pointer; text-decoration: underline dotted color-mix(in srgb, var(--rd) 55%, transparent); text-underline-offset: 4px; }
  .rd-w.tap:hover { background: color-mix(in srgb, var(--rd) 10%, transparent); }
  .rd-w.picked { background: color-mix(in srgb, var(--ds-bad) 16%, transparent); }
  .rd-w.hit { background-image: linear-gradient(transparent 52%, color-mix(in srgb, var(--rd) 34%, transparent) 52%, color-mix(in srgb, var(--rd) 34%, transparent) 92%, transparent 92%);
    background-repeat: no-repeat; background-size: 0% 100%; animation: rd-marker .5s ease-out forwards; animation-delay: calc(var(--j) * 70ms); }
  @keyframes rd-marker { to { background-size: 100% 100%; } }
  .rd-ctx { font-size: 15px; line-height: 1.55; color: var(--ds-ink2); border-top: 1px dashed var(--ds-rule); padding-top: 12px; }
  .rd-ctx b { display: block; font: 700 11.5px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--rd-ink); margin-bottom: 3px; }
  .rd-ask { margin-top: 16px; }
  .rd-ask-q { font: 700 17px/1.35 var(--ds-head); margin-bottom: 10px; }
  .rd-opts { display: grid; gap: 8px; }
  .rd-opt { text-align: left; font: 500 15.5px/1.35 var(--ds-sans); padding: 12px 14px; border-radius: 14px; border: 2px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink); cursor: pointer; transition: border-color .15s, background .15s, transform .1s; }
  .rd-opt:hover:not(:disabled) { border-color: color-mix(in srgb, var(--rd) 60%, var(--ds-rule2)); }
  .rd-opt:active:not(:disabled) { transform: translateY(1px); }
  .rd-opt.ok { border-color: var(--ds-ok); background: var(--ds-ok-bg); }
  .rd-opt.bad { border-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 8%, var(--ds-card)); }
  .rd-opt:disabled { cursor: default; }
  .rd-fb { margin-top: 14px; padding: 12px 14px; border-radius: 14px; font-size: 15px; line-height: 1.5; border-left: 4px solid var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ok-ink); animation: rd-up .3s ease-out backwards; }
  .rd-fb.bad { border-left-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 9%, var(--ds-card)); color: var(--ds-ink); }
  @keyframes rd-up { from { opacity: 0; transform: translateY(6px); } }
  .rd-foot { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--ds-paper) 92%, transparent); border-top: 1px solid var(--ds-rule2); backdrop-filter: blur(8px); }
  .rd-foot > * { max-width: 680px; margin: 0 auto; }
  .rd-shelf { position: relative; margin: 20px auto 6px; max-width: 520px; height: 168px; display: flex; align-items: flex-end; justify-content: center; gap: 6px; padding: 0 18px; }
  .rd-shelf::after { content: ''; position: absolute; left: 0; right: 0; bottom: -12px; height: 12px; border-radius: 3px; background: linear-gradient(#b08a5c, #8a6a44); box-shadow: 0 6px 12px -6px rgba(0,0,0,.4); }
  .ds-dark .rd-shelf::after { background: linear-gradient(#6b5236, #4a3826); }
  .rd-book { position: relative; width: 38px; border-radius: 4px 4px 2px 2px; display: flex; align-items: center; justify-content: center; color: #fff;
    background: linear-gradient(90deg, rgba(0,0,0,.18), transparent 18%, transparent 82%, rgba(0,0,0,.22)), var(--b);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.12), 0 2px 0 rgba(0,0,0,.08); }
  .rd-book span { writing-mode: vertical-rl; transform: rotate(180deg); font: 700 12.5px var(--ds-head); letter-spacing: .04em; white-space: nowrap; }
  .rd-book::before, .rd-book::after { content: ''; position: absolute; left: 4px; right: 4px; height: 2px; background: rgba(255,255,255,.55); }
  .rd-book::before { top: 12px; } .rd-book::after { bottom: 12px; }
  .rd-book.empty { background: color-mix(in srgb, var(--b) 7%, transparent); border: 2px dashed color-mix(in srgb, var(--b) 35%, var(--ds-rule)); box-shadow: none; color: color-mix(in srgb, var(--b) 60%, var(--ds-ink3)); }
  .rd-book.empty::before, .rd-book.empty::after { display: none; }
  .rd-book.new { animation: rd-drop .9s cubic-bezier(.3, 1.4, .5, 1) .2s backwards; }
  @keyframes rd-drop { from { transform: translateY(-180px) rotate(-14deg); opacity: 0; } 60% { opacity: 1; } }
  .rd-done { text-align: center; }
  .rd-done h2 { font: 700 26px var(--ds-head); margin: 18px 0 4px; }
  .rd-keep { margin: 22px auto 0; max-width: 520px; text-align: left; padding: 18px 20px; border-radius: 18px; background: var(--ds-card); border: 1px solid var(--ds-rule2); animation: rd-up .5s ease-out .5s backwards; }
  .rd-keep b { display: block; font: 700 11.5px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--rd-ink); margin-bottom: 6px; }
  .rd-keep q { display: block; font: italic 400 17px/1.5 var(--ds-news, 'PT Serif', Georgia, serif); quotes: '«' '»'; }
  .rd-keep small { display: block; margin-top: 8px; font-size: 13.5px; color: var(--ds-ink2); }
  @media (prefers-reduced-motion: reduce) { .rd-sheet, .rd-w, .rd-w.hit, .rd-book.new, .rd-fb { animation: none; } .rd-w.hit { background-size: 100% 100%; } }
`;

// варианты — в случайном порядке, один раз на страницу
const shuffled = (list) => list.map((o, k) => ({ ...o, k, r: Math.random() })).sort((a, b) => a.r - b.r);

function Page({ p, i, n, answered, onAnswer }) {
  const words = useMemo(() => quoteWords(p.quote, p.ask.kind === 'mark' ? p.ask.mark : ''), [p]);
  const opts = useMemo(() => (p.ask.kind === 'choice' ? shuffled(p.ask.options) : []), [p]);
  const mark = p.ask.kind === 'mark';
  const pick = answered ? answered.pick : null;
  // ответ дан — разбор целиком на экране, а не под нижней кнопкой
  const fbRef = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => { if (answered && fbRef.current) fbRef.current.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }, [!!answered]); // eslint-disable-line react-hooks/exhaustive-deps
  let hitNo = 0;
  return (
    <article className="rd-sheet" key={i} data-testid="reading-page" data-page={i + 1} data-kind={p.ask.kind}>
      <div className="rd-who">
        <span className="rd-seal" aria-hidden="true">{p.initials}</span>
        <div style={{ minWidth: 0 }}>
          <div className="rd-name">{p.author} <span style={{ fontWeight: 400, color: 'var(--ds-ink3)', fontSize: 14 }}>· {p.years}</span></div>
          <div className="rd-meta"><em>{p.book}</em>, {p.year} · страница {i + 1} из {n}</div>
        </div>
      </div>
      <blockquote className="rd-quote" data-testid="reading-quote">
        {words.map((w) => {
          const hit = answered && mark && w.hit;
          const cls = ['rd-w', mark && !answered ? 'tap' : '', hit ? 'hit' : '', mark && answered && pick === w.key && !w.hit ? 'picked' : ''].filter(Boolean).join(' ');
          const style = { '--i': w.key, ...(hit ? { '--j': hitNo++ } : {}) };
          return (
            <React.Fragment key={w.key}>
              {mark && !answered
                ? <span className={cls} style={style} role="button" tabIndex={0} data-testid="reading-word" data-hit={w.hit ? '1' : undefined}
                  onClick={() => onAnswer({ pick: w.key, ok: w.hit })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAnswer({ pick: w.key, ok: w.hit }); } }}>{w.w}</span>
                : <span className={cls} style={style}>{w.w}</span>}
              {' '}
            </React.Fragment>
          );
        })}
      </blockquote>
      <div className="rd-ctx"><b>Контекст</b>{p.context}</div>
      <div className="rd-ask">
        <div className="rd-ask-q">{mark ? 'Найдите в цитате' : 'Вопрос'}: <span style={{ fontWeight: 500 }}>{p.ask.prompt}</span></div>
        {!mark && (
          <div className="rd-opts" role="group" aria-label="Варианты ответа">
            {opts.map((o) => {
              const state = !answered ? '' : o.ok ? 'ok' : pick === o.k ? 'bad' : '';
              return (
                <button key={o.k} type="button" className={`rd-opt ${state}`} disabled={!!answered} data-testid="reading-opt" data-ok={o.ok ? '1' : undefined}
                  onClick={() => onAnswer({ pick: o.k, ok: !!o.ok })}>{o.text}</button>
              );
            })}
          </div>
        )}
        {answered && (
          <div ref={fbRef} style={{ scrollMarginBottom: 96 }} className={`rd-fb${answered.ok ? '' : ' bad'}`} role="status" data-testid="reading-feedback" data-ok={String(answered.ok)}>
            <b>{answered.ok ? 'Верно.' : 'Не совсем.'}</b>{' '}
            {!answered.ok && !mark && (p.ask.options[answered.pick] || {}).why ? <>{p.ask.options[answered.pick].why} </> : null}
            {!answered.ok && mark ? <>Нужные слова подчёркнуты. </> : null}
            {p.ask.explain}
          </div>
        )}
      </div>
    </article>
  );
}

// полка: все подборки, прочитанные — книгами, новая падает на место
function Shelf({ learn, fresh }) {
  return (
    <div className="rd-shelf" data-testid="reading-shelf" aria-label="Полка прочитанного">
      {shelfOf(learn).map((b, k) => {
        const on = b.done || b.id === fresh;
        return (
          <div key={b.id} className={`rd-book${on ? '' : ' empty'}${b.id === fresh ? ' new' : ''}`} data-testid="reading-book" data-done={String(on)}
            style={{ '--b': b.color, height: 118 + (k % 3) * 14 }} title={on ? b.title : `${b.title} — ещё не прочитано`}><span>{on ? b.spine : '?'}</span></div>
        );
      })}
    </div>
  );
}

export default function ReadingView({ id, learn, update, onClose }) {
  const r = READING_BY_ID[id];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);
  const [got, setGot] = useState(0);
  const [startAt] = useState(() => Date.now());
  const reduced = useReducedMotion();
  if (!r) return null;
  const page = r.pages[idx];
  const answered = answers[idx] || null;
  const answer = (a) => {
    if (answers[idx]) return;
    Audio.play(a.ok ? 'up' : 'down');
    setAnswers((list) => { const next = [...list]; next[idx] = a; return next; });
  };
  const next = () => {
    Audio.play('paper');
    if (idx + 1 < r.pages.length) { setIdx(idx + 1); window.requestAnimationFrame(() => { const el = document.querySelector('.rd-root'); if (el) el.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }); return; }
    // дочитали: опыт — один раз, книга — на полку
    const first = !isRead(learn, r.id);
    const right = answers.filter((a) => a && a.ok).length;
    if (first) {
      const seconds = Math.round((Date.now() - startAt) / 1000);
      update((s) => markRead(finishLesson(s, null, { xp: READ_XP, accuracy: (right / r.pages.length) * 100, seconds, kind: 'read' }), r.id));
      setGot(READ_XP);
    }
    setDone(true);
    Audio.play('stamp');
  };
  const style = { '--rd': r.color, '--rd-ink': `color-mix(in srgb, ${r.color} 80%, var(--ds-ink))` };
  return (
    <div className="rd-root" role="dialog" aria-modal="true" aria-label={`Чтение: ${r.title}`} data-testid="reading" data-id={r.id} style={style}>
      <style>{CSS}</style>
      <div className="rd-top">
        <IconButton label="Закрыть чтение" icon={X} data-testid="reading-close" onClick={() => { Audio.play('paper'); onClose(); }} />
        <BookOpen size={18} color="var(--rd)" aria-hidden="true" />
        <span className="rd-title">Чтение · {r.title}</span>
        {!done && <span className="rd-marks" aria-label={`Страница ${idx + 1} из ${r.pages.length}`}>{r.pages.map((_, k) => <i key={k} className={k <= idx ? 'on' : ''} />)}</span>}
      </div>
      {!done ? (
        <div className="rd-page">
          <Page key={idx} p={page} i={idx} n={r.pages.length} answered={answered} onAnswer={answer} />
        </div>
      ) : (
        <div className="rd-page rd-done" data-testid="reading-done">
          <Shelf learn={learn} fresh={r.id} />
          <h2>Книга на полке</h2>
          <div className="ds-sub" style={{ fontSize: 15.5, lineHeight: 1.5 }}>
            «{r.title}»: {answers.filter((a) => a && a.ok).length} из {r.pages.length} верно.{got ? ` +${got} опыта.` : ' Перечитали — опыт уже был.'}
            {' '}На полке — {shelfOf(learn).filter((b) => b.done || b.id === r.id).length} из {shelfOf(learn).length}.
          </div>
          {/* цитата на память — та, с которой подборка начиналась */}
          <div className="rd-keep" data-testid="reading-keep">
            <b>Цитата на память</b>
            <q>{r.pages[0].quote}</q>
            <small>{r.pages[0].author}, {r.pages[0].book}, {r.pages[0].year}</small>
          </div>
        </div>
      )}
      <div className="rd-foot">
        <div>
          {done
            ? <Button wide icon={Check} data-testid="reading-finish" onClick={() => { Audio.play('click'); onClose(); }}>Готово</Button>
            : <Button wide icon={answered && idx + 1 === r.pages.length ? Check : ArrowRight} disabled={!answered} data-testid="reading-next" onClick={next}>
              {!answered ? (page.ask.kind === 'mark' ? 'Коснитесь слов в цитате' : 'Выберите ответ') : idx + 1 < r.pages.length ? 'Дальше' : 'На полку'}</Button>}
        </div>
      </div>
    </div>
  );
}
