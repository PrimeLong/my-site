/* ЛЕНТА «НОВОСТИ» — вкладка под «⋯» (docs/mechanics.md, «Новости и уведомления»): один поток по дням,
   свежее сверху — выпуски «Что нового» из src/learn/news.js и успехи друзей вперемешку, без отдельного
   блока «Новости друзей». Выпуск свёрнут до главного, «Подробнее» — целиком; ещё не открытые и вышедшие
   после первого дня ученика — с плашкой «Новое». События одного друга за день — одной записью.
   На ПК поля по бокам ленты — черновик (learn-sketch.jsx), как в уроке.
   Отдельный ленивый чанк: грузится, только когда ленту открыли. Оформление — NOTIFY_CSS. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './ds.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { NIcon } from './learn-notify.jsx';
import { NEWS, newsDate, readNewsSeen, markNewsSeen, learnerSince, newsForLearner, feedDays, readFeedSeenAt, markFeedSeen } from './learn/news.js';
import { dayOf, addDays } from './textbook/learn-state.js';
import { friendFeed, eventText, EVENT_ICON } from './learn/friends.js';
import { markSeen, agoText } from './learn/notify.js';
import { useMedia, useReducedMotion } from './ds-art.jsx';
import { Sketch, SKETCH_CSS, SKETCH_QUERY } from './learn-sketch.jsx';

/* Выпуск — коротко: заголовок, строка вступления и названия пунктов (не больше четырёх).
   «Подробнее» раскрывает пункты целиком, с текстом, и остальные пункты выпуска. */
const SHORT = 4;
function Issue({ n, i, fresh, today, open, onToggle }) {
  const items = open ? n.items : n.items.slice(0, SHORT);
  const rest = n.items.length - SHORT;
  const cardRef = useRef(null); const itemsRef = useRef(null); const from = useRef(null);
  const reduced = useReducedMotion();
  /* Раскрыть и свернуть — плавно по высоте: перед сменой запоминаем высоту пунктов, после — тянем
     от неё к новой. Свернули длинный выпуск, а его начало осталось выше экрана — выпуск подъезжает обратно. */
  useLayoutEffect(() => {
    const el = itemsRef.current; const h0 = from.current;
    from.current = null;
    if (!el || h0 == null) return;
    const h1 = el.offsetHeight;
    if (!reduced && el.animate && Math.abs(h1 - h0) > 2) {
      el.style.overflow = 'hidden';
      const a = el.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1)' });
      const done = () => { el.style.overflow = ''; };
      a.onfinish = done; a.oncancel = done;
    }
    const top = cardRef.current ? cardRef.current.getBoundingClientRect().top : 0;
    if (!open && top < 0) window.scrollBy({ top: top - 12, behavior: reduced ? 'auto' : 'smooth' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => { from.current = itemsRef.current ? itemsRef.current.offsetHeight : null; Audio.play('paper'); onToggle(); };
  return (
    <article className="nw-post" style={{ '--i': i }}>
      <span className="nw-ava nw-ava-issue" style={{ '--t': n.color }} aria-hidden="true"><NIcon name={n.icon} size={21} /></span>
      <Card ref={cardRef} className="nw-issue" style={{ '--t': n.color }} data-testid="news-issue" data-id={n.id} data-new={String(fresh)} data-open={String(open)}>
        <div className="nw-meta">Обновление · {newsDate(n.date, today)}{fresh && <span className="nw-new">Новое</span>}</div>
        <h2 className="ds-h2 nw-title">{n.title}</h2>
        <div className="nw-lead">{n.lead}</div>
        <div ref={itemsRef} className={`nw-items ${open ? 'open' : 'short'}`}>
          {items.map((it, k) => (
            <div key={it.title} className="nw-item" style={{ '--i': k }}>
              <span className="nw-item-ico"><NIcon name={it.icon} size={open ? 18 : 16} /></span>
              <div><b>{it.title}</b>{open && <span className="nw-item-text" data-testid="news-item-text">{it.text}</span>}</div>
            </div>
          ))}
        </div>
        <button type="button" className="nw-more" aria-expanded={open} data-testid="news-more" onClick={toggle}>
          {open ? 'Свернуть' : rest > 0 ? `Подробнее · ещё ${rest}` : 'Подробнее'}<ChevronDown size={16} aria-hidden="true" />
        </button>
      </Card>
    </article>
  );
}

/* Успехи друга за день — одна запись: его Инфля на нити ленты, имя, когда и значки событий.
   Нажатие открывает профиль друга. */
function FriendPost({ p, i, now, onOpen, fresh = false }) {
  return (
    <article className="nw-post" style={{ '--i': i }} data-new={String(fresh)}>
      <span className="nw-ava nw-ava-friend" aria-hidden="true"><Mascot mood="joy" size={36} outfit={p.wear} /></span>
      <button type="button" className="nw-friend" data-testid="news-friend" data-login={p.login} onClick={() => { Audio.play('paper'); onOpen(p.login); }}>
        <span className="nw-who"><b>{p.name}</b><small>{whenText(p.at || p.evs[0].at, now)}</small>{fresh && <span className="nw-new">Новое</span>}</span>
        <span className="nw-evs">
          {p.evs.map((e) => <span key={`${e.k}${e.at}`} className="nw-ev"><NIcon name={EVENT_ICON[e.k] || 'sparkles'} size={15} />{eventText(e)}</span>)}
        </span>
      </button>
    </article>
  );
}

// время записи: сегодня — «2 ч назад», в прошлые дни (день уже стоит над записями) — часы и минуты
const whenText = (ts, now) => { if (dayOf(ts) === dayOf(now)) return agoText(ts, now); const t = new Date(ts); return `в ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`; };
const dayLabel = (d, today) => (d === today ? 'Сегодня' : d === addDays(today, -1) ? 'Вчера' : newsDate(d, today));

export default function NewsView({ learn = null, friends = null, onFriend = () => {} }) {
  const now = Date.now();
  const today = dayOf(now);
  // «новое» — то, что не открывали до этого захода и что вышло после первого дня ученика;
  // открытая лента отмечает выпуски прочитанными
  const [seen] = useState(readNewsSeen);
  const [since] = useState(() => (learn ? learnerSince(learn) : null));
  // события друзей «новые» — после прошлого открытия ленты на этом устройстве
  const [feedSeenAt] = useState(() => readFeedSeenAt(now));
  useEffect(() => { markNewsSeen(NEWS.map((n) => n.id)); markSeen(NEWS.map((n) => `news:${n.id}`)); markFeedSeen(); }, []);
  // все выпуски — свёрнутыми: только главное, подробности — по кнопке
  const [open, setOpen] = useState({});
  const sketch = useMedia(SKETCH_QUERY);
  const days = feedDays(NEWS, friendFeed((friends && friends.friends) || [], now));
  let k = 0; // порядковый номер записи — для каскада появления
  return (
    <div className="ln-wrap" data-testid="news">
      {sketch && <><style>{SKETCH_CSS}</style><Sketch mode="page" /></>}
      <div className="nw-hero">
        <Mascot mood="joy" size={56} />
        <div>
          <div className="ds-eyebrow">Новости</div>
          <h1 className="ds-h1">Что нового</h1>
          <div className="ds-sub" style={{ fontSize: 14.5, marginTop: 2 }}>Обновления Инфляции и успехи друзей — в одной ленте.</div>
        </div>
      </div>
      <div className="nw-feed" data-testid="news-feed">
        {days.map((d) => (
          <section key={d.day} className="nw-day" data-day={d.day}>
            <h3 className="nw-day-label"><span>{dayLabel(d.day, today)}</span></h3>
            {d.items.map((it) => (it.type === 'issue'
              ? <Issue key={it.n.id} n={it.n} i={k++} today={today} fresh={!seen[it.n.id] && newsForLearner(it.n, since)} open={!!open[it.n.id]} onToggle={() => setOpen((m) => ({ ...m, [it.n.id]: !m[it.n.id] }))} />
              : <FriendPost key={it.p.login} p={it.p} i={k++} now={now} onOpen={onFriend} fresh={it.p.at > feedSeenAt} />))}
          </section>
        ))}
      </div>
    </div>
  );
}
