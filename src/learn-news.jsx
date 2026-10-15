/* ЛЕНТА «НОВОСТИ» — вкладка под «⋯» (docs/mechanics.md, «Новости и уведомления»): выпуски «Что
   нового» из src/learn/news.js, свежий — первым и развёрнутым, ещё не открытые — с плашкой «Новое».
   Отдельный ленивый чанк: грузится, только когда ленту открыли. Оформление — NOTIFY_CSS. */
import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './ds.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { NIcon } from './learn-notify.jsx';
import { markSeen } from './learn/notify.js';
import { NEWS, newsDate, readNewsSeen, markNewsSeen } from './learn/news.js';
import { dayOf } from './textbook/learn-state.js';

function Issue({ n, i, fresh, today, open, onToggle }) {
  const items = open ? n.items : n.items.slice(0, 3);
  return (
    <Card className="nw-issue" style={{ '--t': n.color, '--i': i }} data-testid="news-issue" data-id={n.id} data-new={String(fresh)}>
      <div className="nw-head">
        <div>
          <span className="nw-date">{newsDate(n.date, today)}{fresh && <span className="nw-new">Новое</span>}</span>
          <h2 className="ds-h2">{n.title}</h2>
        </div>
        <span className="nw-head-ico" aria-hidden="true"><NIcon name={n.icon} size={24} color="#fff" /></span>
      </div>
      <div className="nw-lead">{n.lead}</div>
      <div className="nw-items">
        {items.map((it, k) => (
          <div key={it.title} className="nw-item" style={{ '--i': k }}>
            <span className="nw-item-ico"><NIcon name={it.icon} size={18} /></span>
            <div><b>{it.title}</b><span>{it.text}</span></div>
          </div>
        ))}
      </div>
      {n.items.length > 3 && (
        <button type="button" className="nw-more" aria-expanded={open} data-testid="news-more" onClick={() => { Audio.play('paper'); onToggle(); }}>
          {open ? 'Свернуть' : `Ещё ${n.items.length - 3}`}<ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    </Card>
  );
}
export default function NewsView() {
  const today = dayOf(Date.now());
  // «новое» — то, что не открывали до этого захода; открытая лента отмечает выпуски прочитанными
  const [seen] = useState(readNewsSeen);
  useEffect(() => { markNewsSeen(NEWS.map((n) => n.id)); markSeen(NEWS.map((n) => `news:${n.id}`)); }, []);
  const [open, setOpen] = useState(() => ({ [NEWS[0].id]: true }));
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
      {NEWS.map((n, i) => <Issue key={n.id} n={n} i={i} today={today} fresh={!seen[n.id]} open={!!open[n.id]} onToggle={() => setOpen((m) => ({ ...m, [n.id]: !m[n.id] }))} />)}
    </div>
  );
}
