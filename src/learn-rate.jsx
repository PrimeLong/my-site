/* Лавка · Сад: переключатель вверху лавки и плашка «Ставка недели» (в копилке и на рынке сада).
   Лёгкий модуль в чанке обучения; сам сад — ленивый чанк src/learn-garden.jsx. */
import React, { useEffect, useState } from 'react';
import { Sprout, Landmark, PiggyBank } from 'lucide-react';
import { ripeCount } from './learn/garden.js';
import { RATE_STEPS, rateStep, weekRate, weekDemand, PIGGY } from './learn/rewards.js';

const RATE_CSS = `
  .gd-switch { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--ds-rule2); border-radius: 999px; background: var(--ds-card2); margin: 0 0 14px; }
  .gd-switch button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 9px 10px; font: 700 15px var(--ds-sans); color: var(--ds-ink2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; }
  .gd-switch button[aria-selected="true"] { background: var(--ds-card); color: var(--ds-ink); box-shadow: 0 1px 3px var(--ds-shade); }
  .gd-switch .gd-ripe { font: 700 12px var(--ds-sans); color: #fff; background: var(--ds-ok); border-radius: 999px; padding: 1px 7px; }
  /* ставка недели: шкала из пяти делений, что она значит для вклада и для рынка сада */
  .rt-week { margin: 10px 0 12px; padding: 10px 12px; border: 1px solid var(--ds-rule2); border-radius: 8px; background: var(--ds-card2); }
  .rt-top { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; font: 14px var(--ds-sans); }
  .rt-top b { font: 700 22px var(--ds-mono); color: var(--ds-ink); }
  .rt-meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; margin: 6px 0 2px; }
  .rt-meter i { height: 7px; border-radius: 2px; background: var(--ds-rule); }
  .rt-meter i.on { background: linear-gradient(90deg, #4B692C, #B65F14 60%, #8A2F45); background-size: 500% 100%; }
  .rt-scale { display: flex; justify-content: space-between; font: 12px var(--ds-mono); color: var(--ds-ink3); }
  .rt-lines { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 8px 0 4px; font: 13.5px var(--ds-sans); }
  .rt-lines > span { display: inline-flex; align-items: center; gap: 5px; }
  .rt-lines > span[data-on="true"] { font-weight: 700; }
  .rt-hint { font: 13px/1.4 var(--ds-sans); color: var(--ds-ink2); }
`;
const useNow = (ms = 30000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
};

// переключатель «Лавка · Сад» вверху лавки; на «Саде» — сколько созрело
export function ShopSwitch({ view, onView, learn }) {
  const now = useNow();
  const ripe = ripeCount(learn, now);
  return (
    <div className="gd-switch" role="tablist" aria-label="Лавка или сад" data-testid="shop-switch">
      <style>{RATE_CSS}</style>
      <button type="button" role="tab" aria-selected={view === 'shop'} data-view="shop" onClick={() => onView('shop')}>Лавка</button>
      <button type="button" role="tab" aria-selected={view === 'garden'} data-view="garden" onClick={() => onView('garden')}>
        <Sprout size={17} aria-hidden="true" />Сад{ripe > 0 && <span className="gd-ripe" data-testid="garden-ripe">{ripe}</span>}
      </button>
    </div>
  );
}

/* СТАВКА НЕДЕЛИ — одна плашка в копилке и на рынке сада (docs/mechanics.md, «Копилка и сад»):
   какая ставка, что она даёт вкладу за неделю и во сколько раз меняет цены урожая */
const pct = (x, d = 1) => `${String(Math.round(x * 100 * 10 ** d) / 10 ** d).replace('.', ',')}%`;
export function RateWeek({ day, focus = null }) {
  const step = rateStep(day); const rate = weekRate(day); const demand = weekDemand(day);
  const week = (1 + rate) ** PIGGY.days - 1;
  const hint = step >= 3 ? 'Ставка высокая: копить выгодно, а цветы покупают хуже — цены на рынке ниже.'
    : step <= 1 ? 'Ставка низкая: вклад даёт мало, зато цветы раскупают — цены на рынке выше.'
      : 'Ставка обычная: и вклад, и рынок сада — как обычно.';
  return (
    <div className="rt-week" data-testid="rate-week" data-step={step} data-rate={rate}>
      <div className="rt-top"><Landmark size={16} aria-hidden="true" style={{ alignSelf: 'center' }} />Ставка недели <b data-testid="rate-week-value">{pct(rate)}</b> в день</div>
      <div className="rt-meter" aria-hidden="true">{RATE_STEPS.map((r, k) => <i key={r} className={k <= step ? 'on' : ''} style={{ backgroundPosition: `${k * 25}% 0` }} />)}</div>
      <div className="rt-scale" aria-hidden="true"><span>{pct(RATE_STEPS[0])}</span><span>{pct(RATE_STEPS[RATE_STEPS.length - 1])}</span></div>
      <div className="rt-lines">
        <span data-on={String(focus === 'piggy')}><PiggyBank size={15} aria-hidden="true" />вклад за неделю: +{pct(week, 0)}</span>
        <span data-on={String(focus === 'garden')} data-testid="rate-week-demand"><Sprout size={15} aria-hidden="true" />цены на рынке сада: ×{String(demand).replace('.', ',')}</span>
      </div>
      <div className="rt-hint">{hint} Новая ставка — с понедельника.</div>
    </div>
  );
}
