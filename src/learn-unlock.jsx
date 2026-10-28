/* ЗАКРЫТАЯ ПОКА ВОЗМОЖНОСТЬ (docs/mechanics.md, «Открытия»; правила — src/learn/unlocks.js): вкладка или
   отдел на месте, но вместо содержимого — карточка «откроется после N-го урока»: что там будет, сколько
   уроков осталось (кружки) и кнопка к уроку. Открытие празднует церемония (src/learn-celebrate.jsx).
   Автотест (Playwright, navigator.webdriver) видит всё открытым, если сам не включил замки
   (ems-unlock-test) — как с церемониями: иначе каждая проверка лавки начиналась бы с уроков. */
import React from 'react';
import { Lock, Trophy, ShoppingBag, PiggyBank, Sprout, Globe, ArrowRight } from 'lucide-react';
import { Card, Button } from './ds.jsx';
import { UNLOCK_BY_ID, isUnlocked, lessonsLeft, progressOf } from './learn/unlocks.js';
import { plural } from './lib/plural.js';

export const unlockBypass = () => {
  try { return typeof navigator !== 'undefined' && !!navigator.webdriver && localStorage.getItem('ems-unlock-test') !== '1'; } catch { return false; }
};
/* «Мир» уже открывали до замка (есть сохранённая партия или выбрана тема «Мира») — он и остаётся
   открытым: у игравших игру не отнимаем */
const WORLD_TRACES = ['ems-autosave-v1', 'ems-tycoon-v1', 'ems-world-theme', 'ems-world-music'];
export const worldPlayed = () => { try { return WORLD_TRACES.some((k) => localStorage.getItem(k) != null); } catch { return false; } };
export const featureOpen = (learn, id) => unlockBypass() || isUnlocked(learn, id) || (id === 'world' && worldPlayed());
export const ICON = { trophy: Trophy, shop: ShoppingBag, piggy: PiggyBank, sprout: Sprout, globe: Globe };

const CSS = `
  .fl { text-align: center; padding: 22px 18px 18px; }
  .fl-ico { position: relative; width: 104px; height: 104px; margin: 4px auto 12px; border-radius: 50%; display: grid; place-items: center;
    color: var(--fl); background: color-mix(in srgb, var(--fl) 10%, var(--ds-card)); border: 2px dashed color-mix(in srgb, var(--fl) 45%, var(--ds-rule)); }
  .fl-ico .lk { position: absolute; right: -2px; bottom: -2px; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
    background: var(--ds-card); color: var(--ds-ink2); border: 2px solid var(--ds-rule2); animation: fl-wiggle 3.6s ease-in-out 1s infinite; }
  @keyframes fl-wiggle { 0%, 86%, 100% { transform: none } 89% { transform: rotate(-14deg) } 92% { transform: rotate(10deg) } 95% { transform: rotate(-6deg) } }
  .fl h2 { margin: 0; font: 700 22px/1.25 var(--ds-head); }
  .fl p { margin: 8px auto 0; max-width: 34ch; font: 400 15px/1.5 var(--ds-sans); color: var(--ds-ink2); }
  .fl-dots { display: flex; justify-content: center; gap: 8px; margin: 14px 0 6px; }
  .fl-dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--fl) 55%, var(--ds-rule)); }
  .fl-dots i.on { background: var(--fl); border-color: var(--fl); }
  .fl-left { font: 700 14px var(--ds-sans); color: var(--ds-ink); }
  .fl.compact { padding: 14px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; align-items: center; text-align: left; }
  .fl.compact .fl-ico { width: 56px; height: 56px; margin: 0; grid-row: span 3; }
  .fl.compact .fl-ico .lk { width: 24px; height: 24px; }
  .fl.compact h2 { font-size: 17px; }
  .fl.compact p { margin: 0; font-size: 14px; max-width: none; }
  .fl.compact .fl-dots { justify-content: flex-start; margin: 4px 0 0; }
  @media (prefers-reduced-motion: reduce) { .fl-ico .lk { animation: none; } }
`;

export function FeatureLocked({ id, learn, onPath = null, compact = false }) {
  const u = UNLOCK_BY_ID[id];
  if (!u) return null;
  const Icon = ICON[u.icon] || Lock;
  const left = lessonsLeft(learn, id); const have = Math.min(u.lessons, progressOf(learn));
  return (
    <Card className={`fl${compact ? ' compact' : ''}`} style={{ '--fl': u.color, margin: compact ? '0 0 14px' : '8px 0 14px' }} data-testid="feature-locked" data-feature={id} data-left={left}>
      <style>{CSS}</style>
      <div className="fl-ico" aria-hidden="true"><Icon size={compact ? 28 : 50} strokeWidth={1.8} /><span className="lk"><Lock size={compact ? 13 : 17} /></span></div>
      <h2>{u.title} — после {u.lessons}-го урока</h2>
      <p>{u.text}</p>
      <div>
        <div className="fl-dots" aria-hidden="true">{Array.from({ length: u.lessons }, (_, k) => <i key={k} className={k < have ? 'on' : ''} />)}</div>
        <span className="fl-left">{left ? `Осталось ${left} ${plural(left, 'урок', 'урока', 'уроков')}` : 'Уже открыто'}</span>
      </div>
      {onPath && !compact && <Button style={{ marginTop: 14 }} onClick={onPath} data-testid="feature-locked-go">К уроку<ArrowRight size={17} aria-hidden="true" /></Button>}
    </Card>
  );
}
