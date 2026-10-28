/* «ПЕРСОНАЛИИ» — экран особого урока на дороге юнита (данные — src/learn/people.js, docs/mechanics.md).
   Три человека по очереди. Карточка: портрет в раме (фото с Wikimedia Commons или гравированный
   медальон с инициалами), имя крупно, кто он, годы жизни на ленте веков с отметкой главного года,
   рассказ, главная идея, «Знаете ли вы» и вопрос. В конце — стена галереи: три портрета
   повисают в рамах, опыт — один раз. Отдельный ленивый чанк. */
import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, Sparkles, Lightbulb, Check } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, IconButton } from './ds.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { PEOPLE_BY_ID, MET_XP, isMet, initialsOf, eraPos, galleryOf } from './learn/people.js';
import { cachedPhoto, loadPhoto } from './learn/portraits.js';
import { finishLesson, markMet } from './textbook/learn-state.js';

export const PEOPLE_CSS = `
  .pp-root { position: fixed; inset: 0; z-index: 300; overflow-y: auto; overscroll-behavior: contain; color: var(--ds-ink);
    background: radial-gradient(130% 70% at 50% -10%, color-mix(in srgb, var(--pp) 16%, var(--ds-paper)) 0%, var(--ds-paper) 62%), var(--ds-paper); }
  .pp-top { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: color-mix(in srgb, var(--ds-paper) 86%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ds-rule2); }
  .pp-title { flex: 1; min-width: 0; font: 700 15px var(--ds-head); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pp-title small { display: block; font: 700 10.5px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ds-ink2); }
  .pp-pips { display: flex; gap: 6px; }
  .pp-pips i { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 10px var(--ds-sans); color: var(--ds-ink3);
    border: 2px solid var(--ds-rule2); background: var(--ds-card); font-style: normal; transition: all .3s; }
  .pp-pips i.on { border-color: var(--pp); color: var(--pp-ink); }
  .pp-pips i.ok { background: var(--pp); border-color: var(--pp); color: #fff; }
  .pp-page { max-width: 720px; margin: 0 auto; padding: 18px 16px 130px; }

  /* герой: портрет в раме слева, имя и роль справа; на телефоне — друг под другом */
  .pp-hero { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center; animation: pp-in .55s cubic-bezier(.2, .9, .3, 1) backwards; }
  @keyframes pp-in { from { opacity: 0; transform: translateY(16px) } }
  .pp-frame { position: relative; width: 168px; height: 208px; flex: none; border-radius: 84px 84px 18px 18px; padding: 7px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--pp) 40%, #F3E3B5), color-mix(in srgb, var(--pp) 70%, #3A2A12));
    box-shadow: 0 22px 40px -22px rgba(30, 20, 8, .7), inset 0 0 0 1px rgba(255,255,255,.35); }
  .pp-frame > .pp-pic { width: 100%; height: 100%; border-radius: 78px 78px 13px 13px; overflow: hidden; background: var(--ds-card2); position: relative; }
  .pp-pic img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; filter: sepia(.25) contrast(1.04); animation: pp-ken 14s ease-in-out infinite alternate; }
  @keyframes pp-ken { from { transform: scale(1.02) } to { transform: scale(1.1) translate(-2%, -2%) } }
  .pp-pic::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.28) 50%, transparent 65%); background-size: 260% 100%;
    animation: pp-sheen 5s ease-in-out 1s infinite; pointer-events: none; }
  @keyframes pp-sheen { 0% { background-position: 130% 0 } 40%, 100% { background-position: -40% 0 } }
  .pp-credit { margin-top: 6px; font-size: 12px; line-height: 1.3; color: var(--ds-ink2); max-width: 168px; overflow-wrap: anywhere; }
  .pp-credit a { color: inherit; }
  .pp-name { font: 700 clamp(26px, 4.4vw, 36px)/1.08 var(--ds-news, 'PT Serif', Georgia, serif); letter-spacing: -.01em; }
  .pp-role { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .pp-role span { padding: 4px 10px; border-radius: 999px; font: 600 13px var(--ds-sans); background: color-mix(in srgb, var(--pp) 12%, var(--ds-card)); color: var(--pp-ink);
    border: 1px solid color-mix(in srgb, var(--pp) 28%, transparent); }
  .pp-lead { margin-top: 12px; font: 400 17px/1.45 var(--ds-sans); color: var(--ds-ink2); }

  /* лента веков: шкала 1640–2030, годы жизни — полоса, главный год — флажок */
  .pp-era { position: relative; margin: 26px 4px 8px; height: 58px; }
  .pp-era-axis { position: absolute; left: 0; right: 0; top: 26px; height: 2px; background: var(--ds-rule2); }
  .pp-era-tick { position: absolute; top: 22px; width: 1px; height: 10px; background: var(--ds-rule2); }
  .pp-era-tick span { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); font: 600 11px var(--ds-mono); color: var(--ds-ink3); }
  .pp-era-life { position: absolute; top: 21px; height: 12px; border-radius: 6px; background: linear-gradient(90deg, color-mix(in srgb, var(--pp) 55%, #fff), var(--pp));
    transform-origin: left; animation: pp-life .9s cubic-bezier(.2, .9, .3, 1) .25s backwards; box-shadow: 0 2px 8px -2px color-mix(in srgb, var(--pp) 60%, transparent); }
  @keyframes pp-life { from { transform: scaleX(0) } }
  .pp-era-mark { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; animation: pp-drop .5s cubic-bezier(.3, 1.5, .5, 1) 1s backwards; }
  .pp-era-mark b { font: 700 11.5px var(--ds-mono); padding: 2px 7px; border-radius: 6px; background: var(--pp); color: #fff; }
  .pp-era-mark i { width: 2px; height: 10px; background: var(--pp); }
  @keyframes pp-drop { from { opacity: 0; transform: translate(-50%, -10px) } }

  .pp-story p { font: 400 16.5px/1.6 var(--ds-sans); margin: 14px 0 0; }
  .pp-idea { position: relative; margin: 20px 0 0; padding: 18px 20px 18px 54px; border-radius: 18px; font: italic 600 18px/1.45 var(--ds-news, 'PT Serif', Georgia, serif);
    background: color-mix(in srgb, var(--pp) 10%, var(--ds-card)); border: 1px solid color-mix(in srgb, var(--pp) 30%, transparent); }
  .pp-idea svg { position: absolute; left: 18px; top: 19px; color: var(--pp-ink); }
  .pp-fact { margin-top: 12px; padding: 14px 16px 14px 48px; position: relative; border-radius: 16px; font: 400 15px/1.5 var(--ds-sans); background: var(--ds-card); border: 1px dashed var(--ds-rule); color: var(--ds-ink2); }
  .pp-fact b { display: block; font: 700 11px var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--pp-ink); margin-bottom: 2px; }
  .pp-fact svg { position: absolute; left: 16px; top: 15px; color: var(--ds-gold); }
  .pp-ask { margin-top: 22px; }
  .pp-ask-q { font: 700 18px/1.35 var(--ds-head); margin-bottom: 10px; }
  .pp-opts { display: grid; gap: 8px; }
  .pp-opt { text-align: left; font: 500 15.5px/1.35 var(--ds-sans); padding: 13px 15px; border-radius: 14px; border: 2px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink); cursor: pointer; transition: border-color .15s, background .15s, transform .1s; }
  .pp-opt:hover:not(:disabled) { border-color: color-mix(in srgb, var(--pp) 60%, var(--ds-rule2)); }
  .pp-opt.ok { border-color: var(--ds-ok); background: var(--ds-ok-bg); }
  .pp-opt.bad { border-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 8%, var(--ds-card)); }
  .pp-opt:disabled { cursor: default; }
  .pp-fb { margin-top: 12px; padding: 12px 14px; border-radius: 14px; font-size: 15px; line-height: 1.5; border-left: 4px solid var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ok-ink); animation: pp-in .3s ease-out backwards; }
  .pp-fb.bad { border-left-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 9%, var(--ds-card)); color: var(--ds-ink); }
  .pp-foot { position: fixed; left: 0; right: 0; bottom: 0; z-index: 3; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--ds-paper) 92%, transparent); border-top: 1px solid var(--ds-rule2); backdrop-filter: blur(8px); }
  .pp-foot > * { max-width: 720px; margin: 0 auto; }

  /* стена галереи: три рамы повисают на гвоздях и качаются */
  .pp-wall { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin: 26px 0 10px; }
  .pp-hang { position: relative; padding-top: 22px; transform-origin: 50% 0; animation: pp-hang 1.2s cubic-bezier(.3, 1.4, .5, 1) backwards; animation-delay: calc(var(--i) * .25s + .2s); }
  .pp-hang::before { content: ''; position: absolute; left: 50%; top: 0; width: 46px; height: 24px; margin-left: -23px; border: 1.5px solid var(--ds-ink3); border-bottom: 0; border-radius: 50% 50% 0 0 / 100% 100% 0 0; }
  .pp-hang::after { content: ''; position: absolute; left: 50%; top: -3px; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: var(--ds-ink2); }
  @keyframes pp-hang { 0% { opacity: 0; transform: translateY(-60px) rotate(-14deg) } 55% { opacity: 1; transform: rotate(7deg) } 75% { transform: rotate(-3deg) } 100% { transform: rotate(0) } }
  .pp-hang .pp-frame { width: 112px; height: 138px; border-radius: 56px 56px 12px 12px; padding: 5px; }
  .pp-hang .pp-frame > .pp-pic { border-radius: 51px 51px 8px 8px; }
  .pp-hang figcaption { margin-top: 8px; text-align: center; font: 700 13px var(--ds-head); max-width: 120px; }
  .pp-done { text-align: center; }
  .pp-done h2 { font: 700 26px var(--ds-head); margin: 10px 0 4px; }
  @media (max-width: 560px) {
    .pp-hero { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 14px; }
    .pp-role { justify-content: center; }
    .pp-frame { width: 140px; height: 174px; border-radius: 70px 70px 16px 16px; }
    .pp-frame > .pp-pic { border-radius: 64px 64px 11px 11px; }
    .pp-credit { margin: 6px auto 0; text-align: center; }
  }
  @media (prefers-reduced-motion: reduce) { .pp-hero, .pp-pic img, .pp-pic::after, .pp-era-life, .pp-era-mark, .pp-hang, .pp-fb { animation: none; } }
`;

/* Фото человека: скачанное заранее или с Википедии (src/learn/portraits.js) — пока грузится или если
   свободного фото нет, null */
export function usePhoto(p, off = false) {
  const [ph, setPh] = useState(() => (off ? null : cachedPhoto(p) || null));
  useEffect(() => {
    if (off) { setPh(null); return undefined; }
    let alive = true;
    loadPhoto(p).then((x) => { if (alive) setPh(x || null); });
    return () => { alive = false; };
  }, [p.id, off]); // eslint-disable-line react-hooks/exhaustive-deps
  return ph;
}
/* Портрет: фото с Commons (свободная лицензия), иначе — гравированный медальон: штриховка гравюры,
   двойная рамка и инициалы антиквой. Фото не загрузилось — тоже медальон. */
export function Portrait({ p, color, hidden = false }) {
  const loaded = usePhoto(p, hidden);
  const [broken, setBroken] = useState(false);
  const photo = loaded && !broken ? loaded : null;
  const gid = `pp-h-${p.id}`;
  return (
    <div className="pp-pic" data-testid="people-portrait" data-photo={photo ? 'true' : 'false'}>
      {photo ? <img src={photo.file} alt={`Портрет: ${p.name}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : (
          <svg viewBox="0 0 120 150" width="100%" height="100%" role="img" aria-label={hidden ? 'Ещё не знакомы' : `${p.name} — медальон с инициалами`} preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id={gid} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="1" opacity=".22" /></pattern>
              <radialGradient id={`${gid}-g`} cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="#FFF8E8" /><stop offset="1" stopColor={color} stopOpacity=".28" /></radialGradient>
            </defs>
            <rect width="120" height="150" fill={`url(#${gid}-g)`} />
            <rect width="120" height="150" fill={`url(#${gid})`} />
            {/* силуэт бюста — гравюрной штриховкой */}
            <path d="M60 30 C44 30 37 43 38 57 C39 70 46 79 52 82 L50 92 C34 96 22 106 18 150 L102 150 C98 106 86 96 70 92 L68 82 C74 79 81 70 82 57 C83 43 76 30 60 30 Z" fill={color} opacity=".16" />
            <path d="M60 30 C44 30 37 43 38 57 C39 70 46 79 52 82 L50 92 C34 96 22 106 18 150 L102 150 C98 106 86 96 70 92 L68 82 C74 79 81 70 82 57 C83 43 76 30 60 30 Z" fill="none" stroke={color} strokeWidth="1.1" opacity=".45" />
            <circle cx="60" cy="112" r="22" fill="#FFF8E8" stroke={color} strokeWidth="1.6" />
            <circle cx="60" cy="112" r="18.5" fill="none" stroke={color} strokeWidth=".7" opacity=".7" />
            <text x="60" y="119" textAnchor="middle" fontFamily="'PT Serif', Georgia, serif" fontWeight="700" fontSize="19" fill={color}>{hidden ? '?' : initialsOf(p.name)}</text>
          </svg>
        )}
    </div>
  );
}
// подпись под портретом: автор и лицензия, ссылка — на страницу файла (Commons или другой источник);
// у фото, положенного руками без строки в people/credits.csv, подписи нет
export function PhotoCredit({ p }) {
  const ph = usePhoto(p);
  if (!ph || (!ph.author && !ph.license)) return null;
  const where = /wikimedia\.org|wikipedia\.org/.test(ph.source || '') || /^https:\/\/upload\.wikimedia/.test(ph.file || '') ? 'Wikimedia Commons' : 'источник';
  return (
    <div className="pp-credit" data-testid="people-credit">
      Фото: {[ph.author, ph.license].filter(Boolean).join(' · ')}{ph.source ? <> · <a href={ph.source} target="_blank" rel="noopener noreferrer">{where}</a></> : where === 'Wikimedia Commons' ? ' · Wikimedia Commons' : ''}
    </div>
  );
}

function Era({ p }) {
  const ticks = [1700, 1800, 1900, 2000];
  const pc = (y) => `${(eraPos(y) * 100).toFixed(2)}%`;
  return (
    <div className="pp-era" role="img" aria-label={`Годы жизни ${p.years}; главный год — ${p.mark}`} data-testid="people-era">
      <div className="pp-era-axis" />
      {ticks.map((t) => <div key={t} className="pp-era-tick" style={{ left: pc(t) }}><span>{t}</span></div>)}
      <div className="pp-era-life" style={{ left: pc(p.born), width: `calc(${pc(p.died)} - ${pc(p.born)})` }} />
      <div className="pp-era-mark" style={{ left: pc(p.mark) }}><b>{p.mark}</b><i /></div>
    </div>
  );
}

export default function PeopleView({ id, learn, update, onClose }) {
  const g = PEOPLE_BY_ID[id];
  const reduced = useReducedMotion();
  const [k, setK] = useState(0);
  const [picked, setPicked] = useState({});
  const [order] = useState(() => g.people.map((p) => p.ask.options.map((o, i) => ({ ...o, i })).sort(() => Math.random() - 0.5)));
  const [finished, setFinished] = useState(false);
  const started = useRef(Date.now());
  const firstOk = useRef({});
  const root = useRef(null);
  // знакомы ли были до этого захода: после финиша прогресс уже отмечен, а на экране — «+12 опыта»
  const [already] = useState(() => isMet(learn, id));
  useEffect(() => { if (root.current) root.current.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }, [k, finished, reduced]);
  const p = g.people[k];
  const choice = picked[k];
  const answered = choice != null && order[k][choice].ok;
  const pick = (i) => {
    if (answered) return;
    const ok = !!order[k][i].ok;
    if (!(k in firstOk.current)) firstOk.current[k] = ok;
    Audio.play(ok ? 'coin' : 'down');
    setPicked((m) => ({ ...m, [k]: i }));
  };
  const next = () => {
    Audio.play('paper');
    if (k < g.people.length - 1) { setK(k + 1); return; }
    const acc = (Object.values(firstOk.current).filter(Boolean).length / g.people.length) * 100;
    if (!already) update((s) => markMet(finishLesson(s, null, { xp: MET_XP, accuracy: acc, seconds: Math.min(900, (Date.now() - started.current) / 1000), kind: 'people', extra: { fresh: true } }), id));
    setFinished(true);
  };
  const style = { '--pp': g.color, '--pp-ink': `color-mix(in srgb, ${g.color} 82%, #000)` };
  const met = galleryOf({ ...learn, met: { ...learn.met, [id]: 1 } }).filter((x) => x.met).length;
  return (
    <div className="pp-root" ref={root} style={style} data-testid="people" data-id={id} role="dialog" aria-label={`Персоналии: ${g.title}`}>
      <style>{PEOPLE_CSS}</style>
      <div className="pp-top">
        <IconButton label="Закрыть" icon={X} data-testid="people-close" onClick={() => { Audio.play('paper'); onClose(); }} />
        <div className="pp-title"><small>Персоналии</small>{g.title}</div>
        <div className="pp-pips" aria-hidden="true">
          {g.people.map((x, i) => <i key={x.id} className={finished || i < k ? 'ok' : i === k ? 'on' : ''}>{finished || i < k ? <Check size={13} strokeWidth={3} /> : i + 1}</i>)}
        </div>
      </div>
      {!finished ? (
        <div className="pp-page" key={p.id} data-testid="people-page" data-person={p.id}>
          <div className="pp-hero">
            <div>
              <div className="pp-frame"><Portrait p={p} color={g.color} /></div>
              <PhotoCredit p={p} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="pp-name" data-testid="people-name">{p.name}</div>
              <div className="pp-role"><span>{p.years}</span><span>{p.role}</span></div>
              <div className="pp-lead">{p.lead}</div>
            </div>
          </div>
          <Era p={p} />
          <div className="pp-story">{p.story.map((t, i) => <p key={i}>{t}</p>)}</div>
          <div className="pp-idea" data-testid="people-idea"><Lightbulb size={22} aria-hidden="true" />{p.idea}</div>
          <div className="pp-fact"><Sparkles size={20} aria-hidden="true" /><b>Знаете ли вы</b>{p.fact}</div>
          <div className="pp-ask">
            <div className="pp-ask-q">{p.ask.prompt}</div>
            <div className="pp-opts" role="group" aria-label="Варианты ответа">
              {order[k].map((o, i) => {
                const st = choice === i ? (o.ok ? 'ok' : 'bad') : answered && o.ok ? 'ok' : '';
                return <button key={o.i} type="button" className={`pp-opt ${st}`} disabled={answered} data-testid="people-opt" data-ok={o.ok ? 'true' : 'false'} onClick={() => pick(i)}>{o.text}</button>;
              })}
            </div>
            {choice != null && (
              <div className={`pp-fb ${order[k][choice].ok ? '' : 'bad'}`} role="status" data-testid="people-feedback" data-ok={String(!!order[k][choice].ok)}>
                {order[k][choice].ok ? <><b>Верно.</b> {p.idea}</> : <><b>Не совсем.</b> {order[k][choice].why} Попробуйте ещё раз.</>}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pp-page pp-done" data-testid="people-done">
          <div className="ds-eyebrow">Новые знакомства</div>
          <h2>{g.title}</h2>
          <div className="ds-sub" style={{ fontSize: 15 }}>{already ? 'Вы уже знакомы — портреты висят в галерее профиля.' : `+${MET_XP} опыта · портреты — в галерее профиля`}</div>
          <div className="pp-wall" data-testid="people-wall">
            {g.people.map((x, i) => (
              <figure key={x.id} className="pp-hang" style={{ '--i': i, margin: 0 }}>
                <div className="pp-frame"><Portrait p={x} color={g.color} /></div>
                <figcaption>{x.name}</figcaption>
              </figure>
            ))}
          </div>
          <div className="ds-sub" style={{ fontSize: 14 }} data-testid="people-count">В галерее: {met} из {galleryOf(learn).length}</div>
        </div>
      )}
      <div className="pp-foot">
        <div>
          {finished
            ? <Button wide data-testid="people-finish" onClick={() => { Audio.play('click'); onClose(); }}>Готово</Button>
            : <Button wide icon={ArrowRight} disabled={!answered} data-testid="people-next" onClick={next}>{k < g.people.length - 1 ? 'Следующий человек' : 'В галерею'}</Button>}
        </div>
      </div>
    </div>
  );
}
