/* СТАТИСТИКА — одни детали для профиля и «Моего прогресса» в учебнике.
   - Главная цифра одна на карточку (серия), рядом — плитки: подпись, значение, пояснение.
   - Доля (точность, пройдено разделов) — полоса: заливка и светлая дорожка того же цвета.
   - Минуты по дням — столбики одного цвета: цель выполнена — полный цвет, меньше — светлее,
     пустой день — тонкая чёрточка; цель — тонкая сплошная линия; сегодня — отметка под столбиком.
     Касание или наведение на столбик — подсказка с днём, минутами и уроками.
   Цвета — из токенов дизайн-системы (в учебнике вне обучения — из его палитры), текст — цветами текста. */
import React, { useState } from 'react';
import { plural } from './lib/plural.js';

export const STATS_CSS = `
  .st-hero { display: flex; align-items: center; gap: 14px; padding: 4px 0 12px; }
  .st-hero-ico { flex-shrink: 0; width: 58px; height: 58px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--st-tone, #D9822B) 16%, var(--ds-card, var(--c-panel, #fff))); color: var(--st-tone, #D9822B); }
  .st-hero-val { font: 700 48px/1 var(--ds-sans, system-ui, sans-serif); color: var(--ds-ink, var(--c-text, #222)); letter-spacing: -.02em; }
  .st-hero-lab { font: 600 15px/1.3 var(--ds-sans, sans-serif); color: var(--ds-ink2, var(--c-muted, #555)); }
  .st-hero-sub { font: 13px/1.35 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); margin-top: 2px; }
  .st-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .st-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .st-grid.three .st-tile { padding: 9px 10px; }
  @media (min-width: 560px) { .st-grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .st-tile { min-width: 0; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--st-tone, var(--u, #4D7C0F)) 7%, var(--ds-card, var(--c-panel, #fff)));
    border: 1px solid color-mix(in srgb, var(--st-tone, var(--u, #4D7C0F)) 18%, var(--ds-rule, var(--c-hairline, #ddd))); }
  .st-tile-top { display: flex; align-items: center; gap: 6px; font: 600 12.5px/1.25 var(--ds-sans, sans-serif); color: var(--ds-ink2, var(--c-muted, #555)); }
  .st-tile-top svg { color: var(--st-tone, var(--u, #4D7C0F)); flex-shrink: 0; }
  .st-tile-val { font: 700 24px/1.15 var(--ds-sans, sans-serif); color: var(--ds-ink, var(--c-text, #222)); margin-top: 4px; overflow-wrap: anywhere; }
  .st-tile-sub { font: 12px/1.35 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); margin-top: 2px; }
  .st-meter { margin: 10px 0 2px; }
  .st-meter-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font: 14px/1.35 var(--ds-sans, sans-serif); color: var(--ds-ink, var(--c-text, #222)); }
  .st-meter-head b { font-weight: 700; }
  .st-meter-track { height: 10px; border-radius: 5px; margin-top: 5px; overflow: hidden; background: color-mix(in srgb, var(--st-tone, var(--u, #4D7C0F)) 16%, var(--ds-card, var(--c-panel, #fff))); }
  .st-meter-fill { height: 100%; border-radius: 5px; background: var(--st-tone, var(--u, #4D7C0F)); transition: width .6s ease; }
  .st-meter-note { font: 12.5px/1.4 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); margin-top: 3px; }
  .st-bars { position: relative; margin: 8px 0 0; padding: 0 0 4px; }
  .st-bars-plot { position: relative; height: 112px; display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--ds-rule2, var(--c-border, #ccc)); }
  .st-goal { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid var(--ds-ink3, var(--c-faint, #888)); opacity: .55; pointer-events: none; }
  .st-goal span { position: absolute; right: 0; bottom: 2px; font: 12px/1 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); background: var(--ds-card, var(--c-panel, #fff)); padding: 0 0 0 4px; }
  .st-col { flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; justify-content: center; padding: 0; border: 0; background: none; cursor: pointer; position: relative; }
  .st-col i { display: block; width: 100%; max-width: 24px; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--st-tone, var(--u, #4D7C0F)) 42%, var(--ds-card, var(--c-panel, #fff))); transition: height .5s ease; }
  .st-col i { animation: st-grow .6s cubic-bezier(.3,.9,.4,1) both; animation-delay: calc(var(--i, 0) * 14ms); transform-origin: 50% 100%; }
  @keyframes st-grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
  .st-meter-fill { animation: st-fill .9s cubic-bezier(.3,.8,.4,1) both; transform-origin: 0 50%; }
  @keyframes st-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .st-tile { transition: transform .15s ease; }
  .st-tile:hover { transform: translateY(-2px); }
  @media (prefers-reduced-motion: reduce) { .st-col i, .st-meter-fill { animation: none; } .st-tile { transition: none; } }
  .st-col.met i { background: var(--st-tone, var(--u, #4D7C0F)); }
  .st-col.none i { height: 3px !important; background: var(--ds-rule2, var(--c-border, #ccc)); border-radius: 2px; }
  .st-col.future i { height: 3px !important; background: transparent; border-bottom: 1px dashed transparent; }
  .st-col.today::after { content: ''; position: absolute; bottom: -9px; left: 50%; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--ds-gold, #C9A227); }
  .st-col.sel i { outline: 2px solid var(--ds-ink, #222); outline-offset: 1px; }
  .st-weeks { display: flex; margin-top: 12px; }
  .st-weeks span { flex: 1 1 0; font: 12px/1.2 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); border-left: 1px solid var(--ds-rule, var(--c-hairline, #ddd)); padding-left: 4px; white-space: nowrap; overflow: hidden; }
  .st-tip { position: absolute; top: -6px; transform: translate(-50%, -100%); z-index: 3; padding: 6px 9px; border-radius: 6px; pointer-events: none; white-space: nowrap;
    background: var(--ds-ink, #222); color: var(--ds-card, #fff); font: 12.5px/1.35 var(--ds-sans, sans-serif); box-shadow: 0 4px 12px rgba(0,0,0,.2); }
  .st-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; font: 12px/1.3 var(--ds-sans, sans-serif); color: var(--ds-ink3, var(--c-faint, #777)); }
  .st-legend span { display: inline-flex; align-items: center; gap: 5px; }
  .st-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; background: var(--st-tone, var(--u, #4D7C0F)); }
  .st-legend i.half { background: color-mix(in srgb, var(--st-tone, var(--u, #4D7C0F)) 42%, var(--ds-card, var(--c-panel, #fff))); }
`;

// главная цифра карточки: значок в круге, число крупно, подпись и пояснение
export function StatHero({ icon: Icon, tone, value, label, sub, testid }) {
  return (
    <div className="st-hero" style={tone ? { '--st-tone': tone } : undefined}>
      {Icon && <span className="st-hero-ico" aria-hidden="true"><Icon size={30} strokeWidth={2} /></span>}
      <div style={{ minWidth: 0 }}>
        <div className="st-hero-val" data-testid={testid}>{value}</div>
        <div className="st-hero-lab">{label}</div>
        {sub && <div className="st-hero-sub">{sub}</div>}
      </div>
    </div>
  );
}

// плитка: подпись со значком, значение, пояснение
export function StatTile({ icon: Icon, tone, label, value, sub, testid }) {
  return (
    <div className="st-tile" style={tone ? { '--st-tone': tone } : undefined}>
      <div className="st-tile-top">{Icon && <Icon size={15} aria-hidden="true" />}<span>{label}</span></div>
      <div className="st-tile-val" data-testid={testid}>{value}</div>
      {sub && <div className="st-tile-sub">{sub}</div>}
    </div>
  );
}

// доля: подпись, «верно 8 из 10», полоса; share = null — данных пока нет
export function Meter({ label, share, text, note, tone, testid }) {
  const w = share == null ? 0 : Math.round(Math.max(0, Math.min(1, share)) * 100);
  return (
    <div className="st-meter" style={tone ? { '--st-tone': tone } : undefined} data-testid={testid}>
      <div className="st-meter-head"><span>{label}</span><span>{text}</span></div>
      <div className="st-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w}><div className="st-meter-fill" style={{ width: `${w}%` }} /></div>
      {note && <div className="st-meter-note">{note}</div>}
    </div>
  );
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const parseDay = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const dayName = (key) => { const t = parseDay(key); return `${WD[t.getDay()]}, ${t.getDate()} ${MONTHS[t.getMonth()]}`; };
const weekName = (key) => { const t = parseDay(key); return `${t.getDate()} ${MONTHS[t.getMonth()]}`; };

/* Минуты по дням за четыре недели: days — [{ key, minutes, lessons?, today, future }] по порядку,
   с понедельника; goal — цель дня в минутах (линия) или null. */
export function DayBars({ days, goal = null, tone, testid }) {
  const [sel, setSel] = useState(null);
  const top = Math.max(goal ? goal * 1.4 : 0, ...days.map((d) => d.minutes), 10);
  const tip = sel != null ? days[sel] : null;
  const pick = (k) => setSel((x) => (x === k ? null : k));
  return (
    <div className="st-bars" style={tone ? { '--st-tone': tone } : undefined} data-testid={testid} onMouseLeave={() => setSel(null)}>
      <div className="st-bars-plot">
        {goal ? <div className="st-goal" style={{ bottom: `${(goal / top) * 100}%` }}><span>цель {goal} мин</span></div> : null}
        {days.map((d, k) => {
          // без цели (журнал учебника) — каждый день с занятиями полным цветом
          const cls = d.future ? 'future' : d.minutes <= 0 ? 'none' : !goal || d.minutes >= goal ? 'met' : '';
          const label = `${dayName(d.key)}: ${d.future ? 'ещё впереди' : `${d.minutes} мин${d.lessons != null ? `, ${d.lessons} ${plural(d.lessons, 'урок', 'урока', 'уроков')}` : ''}`}`;
          return (
            <button key={d.key} type="button" className={`st-col ${cls}${d.today ? ' today' : ''}${sel === k ? ' sel' : ''}`} data-minutes={d.minutes} aria-label={label}
              onMouseEnter={() => setSel(k)} onFocus={() => setSel(k)} onClick={() => pick(k)} disabled={d.future}>
              <i style={{ height: `${Math.max(3, (d.minutes / top) * 100)}%`, '--i': k }} />
            </button>
          );
        })}
        {tip && !tip.future && (
          <div className="st-tip" role="status" style={{ left: `${((sel + 0.5) / days.length) * 100}%` }}>
            <b>{dayName(tip.key)}</b> · {tip.minutes} мин{tip.lessons != null ? ` · ${tip.lessons} ${plural(tip.lessons, 'урок', 'урока', 'уроков')}` : ''}
          </div>
        )}
      </div>
      <div className="st-weeks" aria-hidden="true">
        {[0, 7, 14, 21].map((k) => days[k] && <span key={k}>{k === 21 ? 'эта неделя' : `с ${weekName(days[k].key)}`}</span>)}
      </div>
      {goal ? (
        <div className="st-legend"><span><i />цель выполнена</span><span><i className="half" />меньше цели</span><span><i style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ds-gold, #C9A227)' }} />сегодня</span></div>
      ) : null}
    </div>
  );
}
