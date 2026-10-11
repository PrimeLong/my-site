/* САД ИНФЛИ — экран (правила — src/learn/garden.js, docs/mechanics.md «Сад»). Шесть грядок,
   семена по курсу дня, растения растут по часам и без приложения; созревшее — в гербарий. */
import React, { useEffect, useState } from 'react';
import { Lock, Sprout, Clock } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, Card, Heading } from './ds.jsx';
import { PLANTS, PLANT_BY_ID, RARITY, GARDEN_PLOTS, gardenPlots, growth, leftText, plant, harvest, herbarium, plantPrice, ripeCount, STAGE_LABEL } from './learn/garden.js';
import { balance, coinsWord } from './learn/rewards.js';
import { dayOf } from './textbook/learn-state.js';

const GARDEN_CSS = `
  .gd-switch { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--ds-rule2); border-radius: 999px; background: var(--ds-card2); margin: 0 0 14px; }
  .gd-switch button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 9px 10px; font: 700 15px var(--ds-sans); color: var(--ds-ink2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; }
  .gd-switch button[aria-selected="true"] { background: var(--ds-card); color: var(--ds-ink); box-shadow: 0 1px 3px var(--ds-shade); }
  .gd-switch .gd-ripe { font: 700 12px var(--ds-sans); color: #fff; background: var(--ds-ok); border-radius: 999px; padding: 1px 7px; }
  .gd-plots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 16px; }
  .gd-plot { border: 1px solid var(--ds-rule2); border-radius: 6px; background: linear-gradient(var(--ds-card), var(--ds-card) 70%, color-mix(in srgb, #8a5a2b 14%, var(--ds-card))); padding: 6px 6px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .gd-plot.empty { border-style: dashed; background: transparent; color: var(--ds-ink3); justify-content: center; min-height: 150px; font-size: 13px; }
  .gd-plot.ripe { border-color: var(--ds-ok); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-ok) 30%, transparent); }
  .gd-plot .gd-art { width: 100%; max-width: 92px; height: auto; display: block; }
  .gd-name { font: 700 13.5px/1.2 var(--ds-sans); overflow-wrap: anywhere; }
  .gd-left { font: 12.5px var(--ds-mono); color: var(--ds-ink2); }
  .gd-bar { width: 100%; height: 5px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .gd-bar span { display: block; height: 100%; background: var(--ds-ok); }
  .gd-chip { display: inline-block; font: 700 11px var(--ds-sans); letter-spacing: .03em; text-transform: uppercase; color: #fff; border-radius: 3px; padding: 1px 6px; }
  .gd-seeds { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 16px; }
  .gd-seed { display: flex; align-items: center; gap: 10px; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); padding: 6px 10px 6px 6px; }
  .gd-seed .gd-art { width: 52px; height: 58px; flex: none; }
  .gd-seed-main { flex: 1; min-width: 0; }
  .gd-seed-price { font: 700 15px var(--ds-mono); white-space: nowrap; text-align: right; }
  .gd-seed-price small { display: block; font: 400 11.5px var(--ds-mono); color: var(--ds-ink3); }
  .gd-herb { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 16px; }
  .gd-herb > div { border: 1px solid var(--ds-rule2); border-radius: 6px; padding: 6px; text-align: center; background: var(--ds-card); }
  .gd-herb > div.no { border-style: dashed; background: transparent; color: var(--ds-ink3); }
  .gd-herb .gd-art { width: 100%; max-width: 70px; height: auto; }
  .gd-herb .no .gd-art { filter: grayscale(1); opacity: .28; }
  .gd-sway { transform-origin: 40px 74px; animation: gd-sway 4s ease-in-out infinite; }
  @keyframes gd-sway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
  @media (prefers-reduced-motion: reduce) { .gd-sway { animation: none; } }
  @media (min-width: 720px) { .gd-plots, .gd-herb { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
`;

/* Растение в горшке: стадия рисует семечко, росток, бутон или цветок. Цветок у каждого свой:
   число и форма лепестков, сердцевина; у лаванды — колос, у денежного дерева — крона с монетами. */
const PETALS = { chamomile: [12, 3, 10], cornflower: [10, 4, 9], calendula: [14, 3.5, 9], sunflower: [16, 3.5, 11], peony: [9, 7, 9], orchid: [5, 7, 10] };
function Bloom({ p }) {
  if (p.id === 'tulip') {
    return (
      <g>
        <path d="M30 26 Q28 8 34 4 Q37 14 40 12 Q43 14 46 4 Q52 8 50 26 Q40 34 30 26 Z" fill={p.color} stroke={p.heart} strokeWidth="1" />
        <path d="M40 12 Q40 22 40 30" stroke={p.heart} strokeWidth="1" fill="none" opacity=".6" />
      </g>
    );
  }
  if (p.id === 'lavender') {
    return <g>{Array.from({ length: 9 }, (_, k) => <ellipse key={k} cx={40 + (k % 2 ? 3 : -3)} cy={6 + k * 3.2} rx="3.4" ry="2.6" fill={k % 3 ? p.color : p.heart} />)}</g>;
  }
  if (p.id === 'moneytree') {
    return (
      <g>
        <circle cx="40" cy="18" r="17" fill="#4B692C" />
        <circle cx="29" cy="24" r="9" fill="#5C7E36" /><circle cx="51" cy="22" r="9" fill="#5C7E36" />
        {[[32, 12], [46, 10], [40, 22], [28, 26], [52, 26], [38, 4]].map(([x, y]) => <g key={`${x}${y}`}><circle cx={x} cy={y} r="3.6" fill={p.color} stroke={p.heart} strokeWidth=".8" /><text x={x} y={y + 1.6} textAnchor="middle" fontSize="4.5" fontWeight="700" fill={p.heart}>к</text></g>)}
      </g>
    );
  }
  const [n, w, len] = PETALS[p.id] || [8, 4, 9];
  return (
    <g>
      {Array.from({ length: n }, (_, k) => <ellipse key={k} cx="40" cy={18 - len / 2 - 2} rx={w} ry={len / 2 + 1} fill={p.color} stroke={p.id === 'chamomile' ? '#D9D2BE' : 'none'} strokeWidth=".6" transform={`rotate(${(360 / n) * k} 40 18)`} />)}
      <circle cx="40" cy="18" r={p.id === 'sunflower' ? 7 : 4.2} fill={p.heart} />
    </g>
  );
}
export function PlantArt({ id, stage = 'bloom', title = '' }) {
  const p = PLANT_BY_ID[id];
  const tree = id === 'moneytree';
  const stem = { seed: 0, sprout: 16, bud: 32, bloom: 46 }[stage];
  return (
    <svg className="gd-art" viewBox="0 0 80 96" role="img" aria-label={title || `${p.title}: ${STAGE_LABEL[stage]}`} data-stage={stage}>
      <g className={stage === 'bloom' ? 'gd-sway' : undefined}>
        {stem > 0 && <path d={`M40 76 Q${tree ? 40 : 38} ${76 - stem / 2} 40 ${76 - stem}`} stroke={tree ? '#6B4A2A' : '#4B692C'} strokeWidth={tree ? 5 : 2.4} fill="none" strokeLinecap="round" />}
        {stage !== 'seed' && !tree && <><path d={`M40 ${70 - stem / 3} q-10 -2 -12 -9 q8 0 12 7`} fill="#5C7E36" /><path d={`M40 ${72 - stem / 2} q10 -2 12 -9 q-8 0 -12 7`} fill="#5C7E36" /></>}
        {stage === 'bud' && !tree && <ellipse cx="40" cy={76 - stem - 3} rx="4.5" ry="6.5" fill={p.color} stroke={p.heart} strokeWidth=".8" />}
        {stage === 'bud' && tree && <circle cx="40" cy={76 - stem - 6} r="10" fill="#5C7E36" />}
        {stage === 'bloom' && <g transform={`translate(0 ${76 - stem - 18 - (tree ? 4 : 0)})`}><Bloom p={p} /></g>}
      </g>
      {stage === 'seed' && <ellipse cx="40" cy="73" rx="3.5" ry="2.4" fill="#6B4A2A" />}
      <ellipse cx="40" cy="76" rx="20" ry="4" fill="#5A3B22" />
      <path d="M20 76 L25 94 H55 L60 76 Z" fill="#A65A32" />
      <rect x="18" y="73" width="44" height="6" rx="2" fill="#B8693B" />
    </svg>
  );
}

// срок роста: до 30 часов — в часах, дольше — в днях
const growText = (h) => (h <= 30 ? `${h} ч` : `${h / 24} дн`);
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
      <style>{GARDEN_CSS}</style>
      <button type="button" role="tab" aria-selected={view === 'shop'} data-view="shop" onClick={() => onView('shop')}>Лавка</button>
      <button type="button" role="tab" aria-selected={view === 'garden'} data-view="garden" onClick={() => onView('garden')}>
        <Sprout size={17} aria-hidden="true" />Сад{ripe > 0 && <span className="gd-ripe" data-testid="garden-ripe">{ripe}</span>}
      </button>
    </div>
  );
}

export function GardenView({ learn, update }) {
  const now = useNow(15000);
  const [msg, setMsg] = useState(null);
  const day = dayOf(now);
  const b = balance(learn);
  const { plots } = gardenPlots(learn);
  const free = plots.filter((x) => !x).length;
  const herb = herbarium(learn);
  const doPlant = (id) => {
    const r = plant(learn, id, Date.now());
    if (!r.ok) { Audio.play('down'); setMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register');
    update(() => r.s, { settle: true });
    const p = PLANT_BY_ID[id];
    setMsg({ ok: true, text: `Посадили: ${p.title} — за ${r.price} ${coinsWord(r.price)}. Зацветёт через ${growText(p.hours)}.` });
  };
  const doHarvest = (at) => {
    const r = harvest(learn, at, Date.now());
    if (!r.ok) { setMsg({ ok: false, text: r.reason }); return; }
    Audio.play('coin');
    update(() => r.s, { settle: true });
    const p = PLANT_BY_ID[r.plant];
    setMsg({ ok: true, text: r.first ? `${p.title} — новое растение в гербарии.` : `${p.title} — в гербарий, теперь их ${herb[r.plant] + 1}.` });
  };
  return (
    <div data-testid="garden">
      <Heading level={2} title="Сад Инфли" sub="Семена — за монеты по курсу дня. Растения растут сами, даже когда приложение закрыто. Чем реже растение, тем дольше ждать цветения." />
      <div className="ds-sub" style={{ fontSize: 14, margin: '6px 0 0' }}>В кошельке <b className="ds-num" data-testid="garden-balance">{b}</b> {coinsWord(b)} · свободных грядок: <b data-testid="garden-free">{free}</b> из {GARDEN_PLOTS}</div>
      {msg && <div role="status" data-testid="garden-msg" style={{ margin: '8px 0 0', fontSize: 14.5, color: msg.ok ? 'var(--ds-ok)' : 'var(--ds-bad)' }}>{msg.text}</div>}

      <div className="gd-plots" data-testid="garden-plots">
        {plots.map((g, k) => {
          if (!g) return <div key={`e${k}`} className="gd-plot empty" data-testid="garden-plot" data-empty="true"><Sprout size={22} aria-hidden="true" />Свободная грядка</div>;
          const st = growth(g, now); const p = PLANT_BY_ID[g.plant];
          return (
            <div key={g.at} className={`gd-plot${st.ripe ? ' ripe' : ''}`} data-testid="garden-plot" data-plant={g.plant} data-stage={st.stage}>
              <PlantArt id={g.plant} stage={st.stage} />
              <div className="gd-name">{p.title}</div>
              {st.ripe
                ? <Button small data-testid="garden-harvest" onClick={() => doHarvest(g.at)}>Собрать</Button>
                : <>
                  <div className="gd-bar" aria-hidden="true"><span style={{ width: `${Math.round(st.p * 100)}%` }} /></div>
                  <div className="gd-left" data-testid="garden-left"><Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> {leftText(st.left)}</div>
                </>}
            </div>
          );
        })}
      </div>

      <Heading level={3} title="Семена" sub={free ? 'Посадить — на первую свободную грядку.' : 'Все грядки заняты — соберите, что созрело.'} />
      <div className="gd-seeds" data-testid="garden-seeds">
        {PLANTS.map((p) => {
          const price = plantPrice(p.id, day);
          return (
            <div key={p.id} className="gd-seed" data-testid="garden-seed" data-plant={p.id}>
              <PlantArt id={p.id} title={p.title} />
              <div className="gd-seed-main">
                <div style={{ fontWeight: 700 }}>{p.title} <span className="gd-chip" style={{ background: RARITY[p.rarity].color }}>{RARITY[p.rarity].title}</span></div>
                <div className="ds-sub" style={{ fontSize: 13 }}>растёт {growText(p.hours)}</div>
                {p.note && <div className="ds-sub" style={{ fontSize: 12.5, fontStyle: 'italic' }}>{p.note}</div>}
              </div>
              <div className="gd-seed-price">{price} <span style={{ fontWeight: 400 }}>мон.</span><small>{p.crowns} кр.</small></div>
              <Button small variant="secondary" disabled={!free} data-testid="garden-plant" onClick={() => doPlant(p.id)}>Посадить</Button>
            </div>
          );
        })}
      </div>

      <Heading level={3} title="Гербарий" sub={`Выращено видов: ${Object.keys(herb).length} из ${PLANTS.length}.`} />
      <div className="gd-herb" data-testid="garden-herbarium">
        {PLANTS.map((p) => (
          <div key={p.id} className={herb[p.id] ? '' : 'no'} data-testid="herb-item" data-plant={p.id} data-got={String(!!herb[p.id])}>
            <PlantArt id={p.id} title={herb[p.id] ? p.title : `${p.title}: ещё не выращено`} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.title}</div>
            <div style={{ fontSize: 12 }}>{herb[p.id] ? `×${herb[p.id]}` : <><Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> ещё нет</>}</div>
          </div>
        ))}
      </div>
      <Card flat style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 16 }}>
        Растения не приносят ни монет, ни опыта — сад для радости. Монеты, которые растут, — в копилке, и там проценты честно показаны рядом с настоящими.
      </Card>
    </div>
  );
}
