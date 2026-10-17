/* ЛЕНТА «НОВОСТИ» — вкладка под «⋯» (docs/mechanics.md, «Новости и уведомления»): выпуски «Что
   нового» из src/learn/news.js, свежий — первым; выпуск свёрнут до главного, «Подробнее» — целиком;
   ещё не открытые и вышедшие после первого дня ученика — с плашкой «Новое».
   Отдельный ленивый чанк: грузится, только когда ленту открыли. Оформление — NOTIFY_CSS. */
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './ds.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { NIcon } from './learn-notify.jsx';
import { markSeen } from './learn/notify.js';
import { NEWS, newsDate, readNewsSeen, markNewsSeen, learnerSince, newsForLearner } from './learn/news.js';
import { dayOf } from './textbook/learn-state.js';

/* Выпуск — коротко: заголовок, строка вступления и названия пунктов (не больше четырёх).
   «Подробнее» раскрывает пункты целиком, с текстом, и остальные пункты выпуска. */
const SHORT = 4;
function Issue({ n, i, fresh, today, open, onToggle }) {
  const items = open ? n.items : n.items.slice(0, SHORT);
  const rest = n.items.length - SHORT;
  return (
    <Card className="nw-issue" style={{ '--t': n.color, '--i': i }} data-testid="news-issue" data-id={n.id} data-new={String(fresh)} data-open={String(open)}>
      <div className="nw-head">
        <div>
          <span className="nw-date">{newsDate(n.date, today)}{fresh && <span className="nw-new">Новое</span>}</span>
          <h2 className="ds-h2">{n.title}</h2>
        </div>
        <span className="nw-head-ico" aria-hidden="true"><NIcon name={n.icon} size={24} color="#fff" /></span>
      </div>
      <div className="nw-lead">{n.lead}</div>
      <div className={`nw-items ${open ? 'open' : 'short'}`}>
        {items.map((it, k) => (
          <div key={it.title} className="nw-item" style={{ '--i': k }}>
            <span className="nw-item-ico"><NIcon name={it.icon} size={open ? 18 : 16} /></span>
            <div><b>{it.title}</b>{open && <span className="nw-item-text" data-testid="news-item-text">{it.text}</span>}</div>
          </div>
        ))}
      </div>
      <button type="button" className="nw-more" aria-expanded={open} data-testid="news-more" onClick={() => { Audio.play('paper'); onToggle(); }}>
        {open ? 'Свернуть' : rest > 0 ? `Подробнее · ещё ${rest}` : 'Подробнее'}<ChevronDown size={16} aria-hidden="true" />
      </button>
    </Card>
  );
}
export default function NewsView({ learn = null, friendFeed = null }) {
  const today = dayOf(Date.now());
  // «новое» — то, что не открывали до этого захода и что вышло после первого дня ученика;
  // открытая лента отмечает выпуски прочитанными
  const [seen] = useState(readNewsSeen);
  const [since] = useState(() => (learn ? learnerSince(learn) : null));
  useEffect(() => { markNewsSeen(NEWS.map((n) => n.id)); markSeen(NEWS.map((n) => `news:${n.id}`)); }, []);
  // все выпуски — свёрнутыми: только главное, подробности — по кнопке
  const [open, setOpen] = useState({});
  return (
    <div className="ln-wrap" data-testid="news">
      <div className="nw-hero">
        <Mascot mood="joy" size={56} />
        <div>
          <div className="ds-eyebrow">Новости</div>
          <h1 className="ds-h1">Что нового в Инфляции</h1>
          <div className="ds-sub" style={{ fontSize: 14.5, marginTop: 2 }}>Рассказываем о новом — коротко и по делу.</div>
        </div>
      </div>
      {friendFeed}
      {NEWS.map((n, i) => <Issue key={n.id} n={n} i={i} today={today} fresh={!seen[n.id] && newsForLearner(n, since)} open={!!open[n.id]} onToggle={() => setOpen((m) => ({ ...m, [n.id]: !m[n.id] }))} />)}
    </div>
  );
}
