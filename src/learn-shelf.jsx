/* БИБЛИОТЕКА ПРОФИЛЯ (docs/mechanics.md, «Профиль»): книжная полка — целые абзацы из книг сверх цитат
   урока (src/learn/shelf.js) — и галерея персоналий (src/learn/people.js). Книга на полке — корешок
   цвета книги; закрытая — пунктиром с замком и подсказкой, что её откроет. Касание — книга во весь
   экран: обложка, оглавление, отрывки с буквицей, «Подумайте» после каждого. Галерея — портреты в
   рамах: знакомые — в цвете, остальные — силуэтом; касание знакомого — карточка с главной идеей.
   Отдельный ленивый чанк: тексты книг не грузятся, пока профиль не открыт. */
import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, BookOpen, Lightbulb } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Card, IconButton, Sheet, Button } from './ds.jsx';
import { shelfBooks, BOOK_BY_ID, wordsIn } from './learn/shelf.js';
import { galleryOf } from './learn/people.js';
import { READING_BY_UNIT } from './learn/reading.js';
import { PEOPLE_BY_UNIT } from './learn/people.js';
import { placeOf } from './ds-tokens.js';
import { Portrait, PEOPLE_CSS, photoCredit } from './learn-people.jsx';

const CSS = `
  .lb-shelf { position: relative; display: flex; align-items: flex-end; gap: 6px; padding: 0 10px; margin: 10px 0 18px; min-height: 150px; overflow-x: auto; scrollbar-width: thin; }
  .lb-plank { height: 12px; margin: -18px 0 14px; border-radius: 3px; background: linear-gradient(#b08a5c, #8a6a44); box-shadow: 0 6px 12px -6px rgba(0,0,0,.4); }
  .ds-dark .lb-plank { background: linear-gradient(#6b5236, #4a3826); }
  .lb-book { position: relative; flex: none; width: var(--w, 40px); height: var(--h, 140px); border: 0; border-radius: 4px 4px 2px 2px; cursor: pointer; color: #fff; padding: 0;
    display: flex; align-items: center; justify-content: center; transform-origin: bottom center; transition: transform .2s cubic-bezier(.3, 1.4, .5, 1);
    background: linear-gradient(90deg, rgba(0,0,0,.2), transparent 18%, transparent 80%, rgba(0,0,0,.25)), var(--b); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12), 0 2px 0 rgba(0,0,0,.08); }
  .lb-book:hover:not(.locked) { transform: translateY(-8px) rotate(-2deg); }
  .lb-book span { writing-mode: vertical-rl; transform: rotate(180deg); font: 700 12.5px var(--ds-head); letter-spacing: .03em; white-space: nowrap; max-height: calc(var(--h, 140px) - 34px); overflow: hidden; text-overflow: ellipsis; }
  .lb-book::before, .lb-book::after { content: ''; position: absolute; left: 4px; right: 4px; height: 2px; background: rgba(255,255,255,.5); }
  .lb-book::before { top: 12px; } .lb-book::after { bottom: 12px; }
  .lb-book.locked { cursor: pointer; background: color-mix(in srgb, var(--b) 7%, transparent); border: 2px dashed color-mix(in srgb, var(--b) 40%, var(--ds-rule)); box-shadow: none; color: color-mix(in srgb, var(--b) 70%, var(--ds-ink2)); }
  .lb-book.locked::before, .lb-book.locked::after { display: none; }
  .lb-book.locked svg { position: absolute; bottom: 8px; }
  /* галерея — одной лентой: сначала знакомые, дальше силуэты; листается вбок */
  .lb-gal { display: grid; grid-auto-flow: column; grid-auto-columns: 86px; gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; scroll-snap-type: x proximity; }
  .lb-gal > * { scroll-snap-align: start; }
  .lb-p { border: 0; background: none; padding: 0; cursor: pointer; text-align: center; color: var(--ds-ink); font: 600 12px/1.25 var(--ds-sans); }
  .lb-p .pp-frame { width: 78px; height: 96px; border-radius: 39px 39px 10px 10px; padding: 4px; margin: 0 auto 6px; }
  .lb-p .pp-frame > .pp-pic { border-radius: 35px 35px 7px 7px; }
  .lb-p.locked { cursor: default; color: var(--ds-ink3); }
  .lb-p.locked .pp-frame { filter: grayscale(1) opacity(.45); }
  .lb-reader { position: fixed; inset: 0; z-index: 320; overflow-y: auto; overscroll-behavior: contain; background: var(--ds-paper); color: var(--ds-ink); }
  .lb-top { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: color-mix(in srgb, var(--ds-paper) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--ds-rule2); }
  .lb-top b { flex: 1; min-width: 0; font: 700 15px var(--ds-head); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb-page { max-width: 680px; margin: 0 auto; padding: 22px 18px 80px; }
  .lb-cover { position: relative; margin: 6px auto 26px; width: min(300px, 80vw); aspect-ratio: 3 / 4; border-radius: 6px 14px 14px 6px; padding: 30px 24px; color: #FFF8E8; text-align: center;
    display: flex; flex-direction: column; justify-content: center; gap: 12px; box-shadow: 0 30px 50px -28px rgba(0,0,0,.65), inset 8px 0 0 rgba(0,0,0,.22);
    background: radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,.16), transparent 55%), var(--b); animation: lb-open .7s cubic-bezier(.2, .9, .3, 1) backwards; }
  .lb-cover::before { content: ''; position: absolute; inset: 14px 14px 14px 22px; border: 1.5px solid rgba(255,248,232,.55); border-radius: 4px 10px 10px 4px; pointer-events: none; }
  @keyframes lb-open { from { opacity: 0; transform: perspective(900px) rotateY(-28deg) translateX(-20px) } }
  .lb-cover small { font: 700 11px var(--ds-sans); letter-spacing: .16em; text-transform: uppercase; opacity: .85; }
  .lb-cover h2 { margin: 0; font: 700 22px/1.25 var(--ds-news, 'PT Serif', Georgia, serif); }
  .lb-toc { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 18px; }
  .lb-passage { margin: 30px 0 0; scroll-margin-top: 70px; }
  .lb-passage h3 { margin: 0; font: 700 22px/1.25 var(--ds-news, 'PT Serif', Georgia, serif); }
  .lb-passage .where { font: 600 12.5px var(--ds-sans); color: var(--ds-ink2); margin-top: 2px; letter-spacing: .02em; }
  .lb-passage p { font: 400 18px/1.7 var(--ds-news, 'PT Serif', Georgia, serif); margin: 14px 0 0; text-wrap: pretty; }
  .lb-passage p:first-of-type::first-letter { float: left; font: 700 54px/.9 var(--ds-news, 'PT Serif', Georgia, serif); padding: 6px 8px 0 0; color: var(--b); }
  .lb-think { margin-top: 16px; padding: 14px 16px 14px 48px; position: relative; border-radius: 14px; background: color-mix(in srgb, var(--b) 8%, var(--ds-card)); border: 1px solid color-mix(in srgb, var(--b) 25%, transparent); font: 400 15px/1.5 var(--ds-sans); }
  .lb-think b { display: block; font: 700 11px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2px; }
  .lb-think svg { position: absolute; left: 16px; top: 15px; color: var(--ds-gold); }
  .lb-orn { text-align: center; color: var(--ds-ink3); letter-spacing: .6em; margin-top: 26px; }
  .lb-note { margin-top: 30px; font-size: 13px; color: var(--ds-ink3); line-height: 1.5; border-top: 1px dashed var(--ds-rule); padding-top: 12px; }
  @media (prefers-reduced-motion: reduce) { .lb-cover { animation: none; } .lb-book { transition: none; } }
`;

function Reader({ id, onClose }) {
  const b = BOOK_BY_ID[id];
  const root = useRef(null);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const go = (pid) => { const el = root.current && root.current.querySelector(`[data-passage="${pid}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="lb-reader" ref={root} style={{ '--b': b.color }} role="dialog" aria-label={`${b.author}. ${b.title}`} data-testid="book-reader" data-book={id}>
      <div className="lb-top">
        <IconButton label="Закрыть книгу" icon={X} data-testid="book-close" onClick={() => { Audio.play('paper'); onClose(); }} />
        <b>{b.author} · {b.short}</b>
      </div>
      <div className="lb-page">
        <div className="lb-cover"><small>{b.author}</small><h2>{b.title}</h2><small>{b.year}</small></div>
        {b.passages.length > 1 && (
          <div className="lb-toc" role="navigation" aria-label="Отрывки">
            {b.passages.map((p) => <button key={p.id} type="button" className="ds-chip" onClick={() => go(p.id)}>{p.title}</button>)}
          </div>
        )}
        {b.passages.map((p, i) => (
          <section key={p.id} className="lb-passage" data-passage={p.id} data-testid="book-passage">
            {i > 0 && <div className="lb-orn" aria-hidden="true">✦ ✦ ✦</div>}
            <h3>{p.title}</h3>
            <div className="where">{p.where}</div>
            {p.text.map((t, k) => <p key={k}>{t}</p>)}
            <div className="lb-think"><Lightbulb size={20} aria-hidden="true" /><b>Подумайте</b>{p.think}</div>
          </section>
        ))}
        <div className="lb-note">Перевод — редакции «Инфляции», с сокращениями: пропуски отмечены «[…]». Текст {b.year} года — в общественном достоянии.</div>
      </div>
    </div>
  );
}

const unlockHint = (b) => {
  const parts = [];
  if (READING_BY_UNIT[b.unitId]) parts.push('«Чтение»');
  if (PEOPLE_BY_UNIT[b.unitId]) parts.push('«Персоналии»');
  return `Откроется, когда пройдёте ${parts.join(' или ')} в юните «${placeOf(b.unitId).place}».`;
};

export default function Library({ learn }) {
  const books = shelfBooks(learn);
  // знакомые — первыми
  const people = galleryOf(learn).sort((a, b) => Number(b.met) - Number(a.met));
  const [reading, setReading] = useState(null);
  const [locked, setLocked] = useState(null);
  const [person, setPerson] = useState(null);
  const open = books.filter((b) => b.open).length;
  const met = people.filter((p) => p.met).length;
  return (
    <>
      <style>{PEOPLE_CSS + CSS}</style>
      <Card style={{ margin: '12px 0' }} data-testid="prof-shelf">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div className="ds-h3" style={{ flex: 1 }}>Книжная полка</div>
          <span className="ds-num ds-faint" style={{ fontSize: 13 }} data-testid="shelf-count">{open} из {books.length}</span>
        </div>
        <div className="ds-sub" style={{ fontSize: 13.5, marginTop: 2 }}>Целые отрывки из книг, которые изменили экономику, — больше, чем цитата в уроке.</div>
        <div className="lb-shelf" role="list">
          {books.map((b) => {
            const h = 112 + (wordsIn(b) % 5) * 8; const w = 36 + (b.passages.length - 1) * 4;
            return (
              <button key={b.id} type="button" role="listitem" className={`lb-book${b.open ? '' : ' locked'}`} style={{ '--b': b.color, '--h': `${h}px`, '--w': `${w}px` }}
                data-testid="shelf-book" data-book={b.id} data-open={String(b.open)} aria-label={`${b.author}, «${b.short}», ${b.year}${b.open ? '' : ' — закрыта'}`}
                onClick={() => { Audio.play(b.open ? 'paper' : 'tick'); if (b.open) setReading(b.id); else setLocked(b); }}>
                <span>{b.short}</span>{!b.open && <Lock size={13} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="lb-plank" aria-hidden="true" />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <div className="ds-h3" style={{ flex: 1 }}>Галерея персоналий</div>
          <span className="ds-num ds-faint" style={{ fontSize: 13 }} data-testid="gallery-count">{met} из {people.length}</span>
        </div>
        <div className="lb-gal" data-testid="prof-gallery">
          {people.map((p) => (
            <button key={p.id} type="button" className={`lb-p${p.met ? '' : ' locked'}`} data-testid="gallery-person" data-person={p.id} data-met={String(p.met)} disabled={!p.met}
              aria-label={p.met ? p.name : `${p.name} — откроется в «Персоналиях» юнита`} onClick={() => { Audio.play('paper'); setPerson(p); }}>
              <div className="pp-frame" style={{ '--pp': p.group.color }}><Portrait p={p} color={p.group.color} hidden={!p.met} /></div>
              {p.met ? p.name : '???'}
            </button>
          ))}
        </div>
      </Card>
      {reading && <Reader id={reading} onClose={() => setReading(null)} />}
      {locked && (
        <Sheet label={locked.short} onClose={() => setLocked(null)} testid="shelf-locked">
          <div style={{ textAlign: 'center' }}>
            <BookOpen size={30} color={locked.color} aria-hidden="true" />
            <div className="ds-h3" style={{ marginTop: 6 }}>{locked.author}, «{locked.title}»</div>
            <div className="ds-sub" style={{ fontSize: 15, marginTop: 6 }}>{unlockHint(locked)}</div>
            <Button wide style={{ marginTop: 14 }} onClick={() => setLocked(null)}>Понятно</Button>
          </div>
        </Sheet>
      )}
      {person && (
        <Sheet label={person.name} onClose={() => setPerson(null)} testid="gallery-card">
          <div style={{ '--pp': person.group.color, '--pp-ink': `color-mix(in srgb, ${person.group.color} 82%, #000)` }}>
            <div className="pp-hero" style={{ animation: 'none' }}>
              <div><div className="pp-frame"><Portrait p={person} color={person.group.color} /></div>{photoCredit(person) && <div className="pp-credit">{photoCredit(person)}</div>}</div>
              <div style={{ minWidth: 0 }}>
                <div className="pp-name" style={{ fontSize: 26 }}>{person.name}</div>
                <div className="pp-role"><span>{person.years}</span><span>{person.role}</span></div>
                <div className="pp-lead" style={{ fontSize: 15.5 }}>{person.lead}</div>
              </div>
            </div>
            <div className="pp-idea" style={{ fontSize: 16 }}><Lightbulb size={22} aria-hidden="true" />{person.idea}</div>
          </div>
        </Sheet>
      )}
    </>
  );
}
