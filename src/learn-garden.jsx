/* САД ИНФЛИ — экран (правила — src/learn/garden.js, docs/mechanics.md «Сад»). Огород за забором:
   шесть грядок с табличками, пакетики семян (на кнопке видно, можно ли купить и что мешает),
   урожай одной строкой на растение и редкость — с ценой покупки семян и рынка, гербарий.
   Редкость урожая видна на рисунке: ореол, искры, золотое или радужное сияние. */
import React, { useEffect, useRef, useState } from 'react';
import { Lock, Sprout, Clock, Coins, X, ArrowDown, Landmark, PiggyBank } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, Heading } from './ds.jsx';
import { PLANTS, PLANT_BY_ID, RARITY, GARDEN_PLOTS, GRADES, GRADE_BY_ID, MARKET_DROP, gardenPlots, growth, leftText, plant, harvest, herbarium, grown, collection,
  plantPrice, salePrice, sell, sellAll, soldToday, ripeCount, cropGroups, paidPrice, STAGE_LABEL } from './learn/garden.js';
import { balance, coinsWord, RATE_STEPS, rateStep, weekRate, weekDemand, PIGGY } from './learn/rewards.js';
import { dayOf } from './textbook/learn-state.js';
import { plural } from './lib/plural.js';

const RAINBOW = '#E8B840, #D2463C, #C46FC0, #4F7BC0, #4B692C, #E8B840';
const GARDEN_CSS = `
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
  .gd-wallet { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
  .gd-wallet > span { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--ds-rule2); border-radius: 999px; background: var(--ds-card); font: 14px var(--ds-sans); }
  /* огород: трава, забор из штакетника, грядки с землёй и деревянные таблички */
  .gd-yard { position: relative; margin: 12px 0 20px; padding: 30px 10px 12px; border-radius: 10px; border: 1px solid #5F7A3A; overflow: hidden;
    background: radial-gradient(circle at 20% 30%, rgba(255,255,255,.10) 0 2px, transparent 3px) 0 0 / 22px 22px, radial-gradient(circle at 70% 60%, rgba(0,0,0,.06) 0 2px, transparent 3px) 0 0 / 26px 26px, linear-gradient(#A3BE6E, #7E9A4F); }
  .gd-yard::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 22px;
    background: linear-gradient(transparent 7px, #9C7442 7px 10px, transparent 10px 15px, #9C7442 15px 18px, transparent 18px), repeating-linear-gradient(90deg, #E2C28A 0 11px, transparent 11px 17px);
    -webkit-mask: linear-gradient(#000, #000); }
  .gd-beds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 10px; }
  .gd-bed { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; }
  /* грядка — холмик вскопанной земли, растение поднимается над ним */
  .gd-soil { position: relative; width: 100%; aspect-ratio: 1 / .9; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .gd-soil::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 44%; border-radius: 50% 50% 10px 10px / 46% 46% 10px 10px;
    background: repeating-linear-gradient(0deg, #6E4C2B 0 6px, #5C3E22 6px 8px); box-shadow: inset 0 3px 0 rgba(255,255,255,.10), inset 0 -6px 10px rgba(0,0,0,.28), 0 2px 0 rgba(0,0,0,.18); }
  .gd-soil .gd-art { position: relative; width: 96%; max-width: 112px; height: auto; display: block; margin-bottom: 6%; }
  .gd-bed.ripe .gd-soil::before { box-shadow: inset 0 0 0 3px #F2E36B, inset 0 -6px 10px rgba(0,0,0,.28), 0 0 12px rgba(242,227,107,.7); }
  .gd-bed.ripe .gd-art { filter: drop-shadow(0 0 6px rgba(242,227,107,.95)); animation: gd-ripe 1.8s ease-in-out infinite; }
  .gd-bed.empty { cursor: pointer; }
  .gd-bed.empty .gd-soil { padding-bottom: 12%; color: #F3E6C8; }
  .gd-bed.empty .gd-soil > * { position: relative; }
  .gd-bed.empty .gd-soil::before { outline: 2px dashed rgba(243,230,200,.6); outline-offset: -5px; opacity: .85; }
  .gd-sign { width: 100%; min-height: 44px; padding: 4px 4px 5px; border: 1px solid #9C7442; border-radius: 4px; background: #F5E9CC; color: #3B2A16; text-align: center; box-shadow: 0 2px 0 #7A5A2E; }
  .gd-name { font: 700 13px/1.2 var(--ds-sans); overflow-wrap: anywhere; }
  .gd-left { font: 12px var(--ds-mono); color: #5B4630; }
  .gd-bar { width: 100%; height: 5px; margin: 3px 0 2px; border-radius: 3px; background: #D9C69B; overflow: hidden; }
  .gd-bar span { display: block; height: 100%; background: #4B692C; }
  .gd-sign .ds-btn { width: 100%; margin-top: 3px; padding: 6px 4px; letter-spacing: 0; }
  /* пакетики семян: цветная лента редкости растения, рисунок, цена, кнопка с причиной */
  .gd-packets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 10px 0 20px; }
  .gd-packet { --r: #4B692C; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 8px 8px; text-align: center; overflow: hidden; border-radius: 3px 3px 8px 8px;
    border: 1px solid color-mix(in srgb, var(--r) 45%, var(--ds-rule2)); background: linear-gradient(color-mix(in srgb, var(--r) 12%, var(--ds-card)), var(--ds-card) 70%); }
  .gd-packet-band { align-self: stretch; margin: 0 -8px 2px; padding: 4px 6px; background: var(--r); color: #fff; font: 700 12px var(--ds-sans); letter-spacing: .05em; text-transform: uppercase;
    -webkit-mask: radial-gradient(circle 4px at 50% 0, transparent 98%, #000) 0 0 / 10px 100%; }
  .gd-packet[data-rarity="legend"] .gd-packet-band { background: linear-gradient(90deg, #8A2F45, #C9A040, #8A2F45); background-size: 200% 100%; animation: gd-shine 3s linear infinite; }
  .gd-packet .gd-art { width: 74px; height: auto; }
  .gd-packet-name { font: 700 15px/1.2 var(--ds-sans); }
  .gd-packet-meta { font: 12.5px var(--ds-sans); color: var(--ds-ink2); }
  .gd-packet-note { font: italic 12px/1.35 var(--ds-sans); color: var(--ds-ink2); }
  .gd-packet-price { display: inline-flex; align-items: center; gap: 4px; margin: 3px 0 5px; font: 700 16px var(--ds-mono); }
  .gd-packet-price small { font: 400 12px var(--ds-mono); color: var(--ds-ink3); }
  .gd-packet .ds-btn { margin-top: auto; }
  .gd-packet.off { opacity: .66; }
  .gd-packet.off .gd-art { filter: saturate(.35); }
  @media (min-width: 560px) { .gd-packets { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 900px) { .gd-packets { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  /* редкость урожая: плашка и ореол вокруг рисунка */
  .gd-grade { display: inline-block; font: 700 12px var(--ds-sans); color: #fff; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
  .gd-grade[data-grade="myth"] { background: linear-gradient(90deg, #1F5F6B, #6B3A8A, #8A6416) !important; }
  .gd-grades { display: flex; flex-wrap: wrap; gap: 6px 10px; margin: 6px 0 4px; font: 13px var(--ds-sans); color: var(--ds-ink2); }
  .gd-aura { position: relative; display: inline-grid; place-items: center; isolation: isolate; }
  .gd-aura::before { content: ''; position: absolute; inset: 4% 0 12%; border-radius: 50%; z-index: -1; }
  .gd-aura.g-good::before { background: radial-gradient(circle, rgba(75,105,44,.30) 35%, transparent 70%); }
  .gd-aura.g-fine::before { background: radial-gradient(circle, rgba(47,93,140,.38) 35%, transparent 70%); }
  .gd-aura.g-rare::before { background: radial-gradient(circle, rgba(134,68,106,.55) 30%, transparent 72%); animation: gd-pulse 2.4s ease-in-out infinite; }
  .gd-aura.g-legend::before { background: radial-gradient(circle, rgba(232,184,64,.85) 28%, rgba(232,184,64,.25) 55%, transparent 74%); animation: gd-pulse 1.8s ease-in-out infinite; }
  .gd-aura.g-myth::before { inset: -4%; background: conic-gradient(from 0deg, ${RAINBOW}); filter: blur(7px); opacity: .85; animation: gd-spin 4s linear infinite; }
  .gd-aura.g-rare::after, .gd-aura.g-legend::after, .gd-aura.g-myth::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(circle at 16% 24%, var(--spark, #fff) 0 1.6px, transparent 2.6px), radial-gradient(circle at 84% 28%, var(--spark, #fff) 0 1.6px, transparent 2.6px),
      radial-gradient(circle at 72% 80%, var(--spark, #fff) 0 1.3px, transparent 2.3px), radial-gradient(circle at 24% 72%, var(--spark, #fff) 0 1.3px, transparent 2.3px), radial-gradient(circle at 50% 8%, var(--spark, #fff) 0 1.2px, transparent 2.2px);
    animation: gd-twinkle 1.6s ease-in-out infinite; }
  .gd-aura.g-legend::after { --spark: #FFF1B8; }
  /* урожай одной строкой на растение и редкость */
  .gd-crops { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 8px; }
  .gd-crop { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 4px 10px; align-items: center; padding: 6px 8px 6px 4px; border: 1px solid var(--ds-rule2); border-radius: 6px; background: var(--ds-card); }
  .gd-crop > .gd-aura { grid-row: span 2; }
  .gd-crop .gd-art { width: 50px; height: 60px; }
  .gd-crop[data-grade="legend"] { border-color: #C9A040; background: color-mix(in srgb, #E8B840 10%, var(--ds-card)); }
  .gd-crop[data-grade="myth"] { border: 2px solid transparent; background: linear-gradient(var(--ds-card), var(--ds-card)) padding-box, conic-gradient(${RAINBOW}) border-box; }
  .gd-crop-title { font: 700 14.5px/1.3 var(--ds-sans); }
  .gd-count { font: 700 14px var(--ds-mono); margin-left: 4px; }
  .gd-crop-price { font: 12.5px/1.4 var(--ds-sans); color: var(--ds-ink2); }
  .gd-profit { font: 700 12.5px var(--ds-mono); }
  .gd-profit[data-sign="+"] { color: var(--ds-ok); } .gd-profit[data-sign="-"] { color: var(--ds-bad); }
  .gd-crop-btns { display: flex; flex-wrap: wrap; gap: 6px; }
  @media (min-width: 560px) { .gd-crop { grid-template-columns: 54px minmax(0, 1fr) auto; } .gd-crop > .gd-aura { grid-row: auto; } .gd-crop-btns { flex-direction: column; align-items: stretch; } }
  .gd-dots { display: flex; justify-content: center; gap: 3px; margin-top: 3px; }
  .gd-dots i { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid currentColor; opacity: .35; }
  .gd-dots i.on { opacity: 1; background: currentColor; }
  .gd-result { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; align-items: center; border: 2px solid var(--ds-ok); border-radius: 8px; background: var(--ds-card); padding: 8px 10px; margin: 10px 0 0; position: relative; }
  .gd-result[data-grade="legend"] { border-color: #C9A040; }
  .gd-result[data-grade="myth"] { border-color: transparent; background: linear-gradient(var(--ds-card), var(--ds-card)) padding-box, conic-gradient(${RAINBOW}) border-box; }
  .gd-result .gd-art { width: 64px; height: 76px; }
  .gd-result-close { position: absolute; top: 4px; right: 4px; }
  .gd-odds { font-size: 13px; line-height: 1.5; color: var(--ds-ink2); margin: 4px 0 0; }
  .gd-herb { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 16px; }
  .gd-herb > div { border: 1px solid var(--ds-rule2); border-radius: 6px; padding: 6px; text-align: center; background: var(--ds-card); }
  .gd-herb > div.no { border-style: dashed; background: transparent; color: var(--ds-ink3); }
  .gd-herb .gd-art { width: 100%; max-width: 70px; height: auto; }
  .gd-herb .no .gd-art { filter: grayscale(1); opacity: .28; }
  .gd-sway { transform-origin: 40px 74px; animation: gd-sway 4s ease-in-out infinite; }
  @keyframes gd-sway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
  @keyframes gd-ripe { 50% { filter: drop-shadow(0 0 10px rgba(242,227,107,1)) brightness(1.06); } }
  @keyframes gd-pulse { 0%, 100% { transform: scale(.94); opacity: .8; } 50% { transform: scale(1.06); opacity: 1; } }
  @keyframes gd-spin { to { transform: rotate(360deg); } }
  @keyframes gd-twinkle { 0%, 100% { opacity: .2; } 50% { opacity: 1; } }
  @keyframes gd-shine { to { background-position: 200% 0; } }
  @media (prefers-reduced-motion: reduce) { .gd-sway, .gd-bed.ripe .gd-art, .gd-aura::before, .gd-aura::after, .gd-packet-band { animation: none !important; } }
  @media (min-width: 720px) { .gd-herb, .gd-beds { grid-template-columns: repeat(6, minmax(0, 1fr)); } .gd-yard { padding: 34px 18px 16px; } .gd-beds { gap: 12px 14px; } }
`;

/* Растение в горшке (или в земле): стадия рисует семечко, росток, бутон или цветок. Цветок у каждого свой:
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
// pot={false} — растение прямо в земле грядки или на пакетике семян, без горшка
export function PlantArt({ id, stage = 'bloom', title = '', pot = true }) {
  const p = PLANT_BY_ID[id];
  const tree = id === 'moneytree';
  const stem = { seed: 0, sprout: 16, bud: 32, bloom: 46 }[stage];
  return (
    <svg className="gd-art" viewBox={pot ? '0 0 80 96' : '0 0 80 84'} role="img" aria-label={title || `${p.title}: ${STAGE_LABEL[stage]}`} data-stage={stage}>
      <g className={stage === 'bloom' ? 'gd-sway' : undefined}>
        {stem > 0 && <path d={`M40 76 Q${tree ? 40 : 38} ${76 - stem / 2} 40 ${76 - stem}`} stroke={tree ? '#6B4A2A' : '#4B692C'} strokeWidth={tree ? 5 : 2.4} fill="none" strokeLinecap="round" />}
        {stage !== 'seed' && !tree && <><path d={`M40 ${70 - stem / 3} q-10 -2 -12 -9 q8 0 12 7`} fill="#5C7E36" /><path d={`M40 ${72 - stem / 2} q10 -2 12 -9 q-8 0 -12 7`} fill="#5C7E36" /></>}
        {stage === 'bud' && !tree && <ellipse cx="40" cy={76 - stem - 3} rx="4.5" ry="6.5" fill={p.color} stroke={p.heart} strokeWidth=".8" />}
        {stage === 'bud' && tree && <circle cx="40" cy={76 - stem - 6} r="10" fill="#5C7E36" />}
        {stage === 'bloom' && <g transform={`translate(0 ${76 - stem - 18 - (tree ? 4 : 0)})`}><Bloom p={p} /></g>}
      </g>
      {pot ? <>
        {stage === 'seed' && <ellipse cx="40" cy="73" rx="3.5" ry="2.4" fill="#6B4A2A" />}
        <ellipse cx="40" cy="76" rx="20" ry="4" fill="#5A3B22" />
        <path d="M20 76 L25 94 H55 L60 76 Z" fill="#A65A32" />
        <rect x="18" y="73" width="44" height="6" rx="2" fill="#B8693B" />
      </> : <>
        <ellipse cx="40" cy="78" rx="26" ry="5.5" fill="#4A3019" />
        <ellipse cx="40" cy="76.5" rx="18" ry="3.2" fill="#6B4A2A" />
        {stage === 'seed' && <ellipse cx="40" cy="74.5" rx="3.5" ry="2.4" fill="#3B2512" />}
      </>}
    </svg>
  );
}

// срок роста: до 30 часов — в часах, дольше — в днях
const growText = (h) => (h <= 30 ? `${h} ч` : `${h / 24} дн`);
const Grade = ({ id }) => <span className="gd-grade" style={{ background: GRADE_BY_ID[id].color }} data-grade={id}>{GRADE_BY_ID[id].title}</span>;
// рисунок урожая с ореолом его редкости
const GradeArt = ({ plantId, grade, title }) => <span className={`gd-aura g-${grade}`} data-aura={grade}><PlantArt id={plantId} title={title} /></span>;
const multText = (m) => `×${String(m).replace('.', ',')}`;
const CROPS_SHOWN = 6;
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

// что мешает посадить: можно, мало монет или нет свободной грядки
const seedState = (free, b, price) => (!free ? 'plots' : b < price ? 'coins' : 'ok');

export function GardenView({ learn, update }) {
  const now = useNow(15000);
  const [msg, setMsg] = useState(null);
  const [allCrops, setAllCrops] = useState(false);
  const seedsRef = useRef(null);
  const day = dayOf(now);
  const b = balance(learn);
  const { plots } = gardenPlots(learn);
  const free = plots.filter((x) => !x).length;
  const herb = herbarium(learn);
  const ever = grown(learn);
  const coll = collection(learn);
  const groups = cropGroups(learn);
  const keptN = groups.reduce((a, g) => a + g.ats.length, 0);
  const affordable = PLANTS.filter((p) => plantPrice(p.id, day) <= b).length;
  const [got, setGot] = useState(null); // только что собранное: { at, plant, grade }
  const doSell = (ats) => {
    const r = ats.length > 1 ? sellAll(learn, ats, Date.now()) : sell(learn, ats[0], Date.now());
    if (!r.ok) { Audio.play('down'); setMsg({ ok: false, text: r.reason || 'Рынок не берёт' }); return; }
    Audio.play('coin');
    update(() => r.s, { settle: true });
    if (got && ats.includes(got.at)) setGot(null);
    const at = ats[0]; const id = (learn.garden[at] || '').split('@')[0]; const grade = gradeOfGroup(groups, at);
    setMsg({ ok: true, text: `Продано: ${PLANT_BY_ID[id].title}${ats.length > 1 ? ` ×${ats.length}` : ''}, урожай «${GRADE_BY_ID[grade].title}» — +${r.coins} ${coinsWord(r.coins)}.` });
  };
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
    Audio.play(r.grade === 'rare' || r.grade === 'legend' || r.grade === 'myth' ? 'register' : 'coin');
    update(() => r.s, { settle: true });
    setMsg(null);
    setGot({ at: r.at, plant: r.plant, grade: r.grade, first: r.first });
  };
  const toSeeds = () => { Audio.play('tick'); if (seedsRef.current) seedsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const shown = allCrops ? groups : groups.slice(0, CROPS_SHOWN);
  return (
    <div data-testid="garden">
      <Heading level={2} title="Сад Инфли" sub="Посадите семена — растения растут сами, даже когда приложение закрыто. Урожай можно продать на рынке или оставить в гербарии." />
      <div className="gd-wallet">
        <span><Coins size={15} aria-hidden="true" /><b className="ds-num" data-testid="garden-balance">{b}</b> {coinsWord(b)}</span>
        <span><Sprout size={15} aria-hidden="true" />свободных грядок: <b data-testid="garden-free">{free}</b> из {GARDEN_PLOTS}</span>
      </div>
      {msg && <div role="status" data-testid="garden-msg" style={{ margin: '8px 0 0', fontSize: 14.5, color: msg.ok ? 'var(--ds-ok)' : 'var(--ds-bad)' }}>{msg.text}</div>}
      {got && (() => {
        const p = PLANT_BY_ID[got.plant]; const price = salePrice(learn, got.at, now); const paid = paidPrice(learn, got.at);
        const big = got.grade === 'legend' || got.grade === 'myth';
        return (
          <div className="gd-result" role="status" data-testid="garden-result" data-grade={got.grade}>
            <GradeArt plantId={got.plant} grade={got.grade} title={p.title} />
            <div style={{ minWidth: 0 }}>
              <div className="ds-eyebrow">{big ? `${GRADE_BY_ID[got.grade].title} урожай!` : got.first ? 'Новое растение в гербарии' : 'Урожай собран'}</div>
              <div style={{ fontWeight: 700, fontSize: 17, margin: '2px 0 2px' }}>{p.title}<span style={{ fontWeight: 400, fontSize: 14.5 }}>, урожай</span> <Grade id={got.grade} /></div>
              {price && <div className="gd-crop-price" style={{ marginBottom: 6 }}>семена стоили {paid} · на рынке {price.coins} <Profit d={price.coins - paid} /></div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {price && <Button small icon={Coins} onClick={() => doSell([got.at])} data-testid="garden-result-sell">Продать за {price.coins} {coinsWord(price.coins)}</Button>}
                <Button small variant="secondary" onClick={() => setGot(null)} data-testid="garden-result-keep">Оставить в гербарии</Button>
              </div>
            </div>
            <span className="gd-result-close"><Button small variant="ghost" aria-label="Закрыть" onClick={() => setGot(null)}><X size={16} aria-hidden="true" /></Button></span>
          </div>
        );
      })()}

      <div className="gd-yard" data-testid="garden-plots" aria-label="Грядки">
        <div className="gd-beds">
          {plots.map((g, k) => {
            if (!g) {
              return (
                <button type="button" key={`e${k}`} className="gd-bed empty" data-testid="garden-plot" data-empty="true" onClick={toSeeds} aria-label="Свободная грядка: выбрать семена">
                  <span className="gd-soil"><Sprout size={26} aria-hidden="true" /></span>
                  <span className="gd-sign"><span className="gd-name">Свободно</span><span className="gd-left" style={{ display: 'block' }}>посадить <ArrowDown size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /></span></span>
                </button>
              );
            }
            const st = growth(g, now); const p = PLANT_BY_ID[g.plant];
            return (
              <div key={g.at} className={`gd-bed${st.ripe ? ' ripe' : ''}`} data-testid="garden-plot" data-plant={g.plant} data-stage={st.stage}>
                <div className="gd-soil"><PlantArt id={g.plant} stage={st.stage} pot={false} /></div>
                <div className="gd-sign">
                  <div className="gd-name">{p.title}</div>
                  {st.ripe
                    ? <Button small data-testid="garden-harvest" onClick={() => doHarvest(g.at)}>Собрать</Button>
                    : <>
                      <div className="gd-bar" aria-hidden="true"><span style={{ width: `${Math.round(st.p * 100)}%` }} /></div>
                      <div className="gd-left" data-testid="garden-left" aria-label={leftText(st.left)}><Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> {leftText(st.left, { short: true })}</div>
                    </>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div ref={seedsRef} style={{ scrollMarginTop: 70 }}>
        <Heading level={3} title="Семена" sub={!free ? 'Все грядки заняты — соберите, что созрело, и сажайте снова.' : affordable ? `Сейчас по карману: ${affordable} из ${PLANTS.length}. Посадить — на первую свободную грядку.` : 'Пока ни на что не хватает монет — их дают уроки.'} />
      </div>
      <div className="gd-packets" data-testid="garden-seeds">
        {PLANTS.map((p) => {
          const price = plantPrice(p.id, day); const state = seedState(free, b, price);
          return (
            <div key={p.id} className={`gd-packet${state === 'ok' ? '' : ' off'}`} style={{ '--r': RARITY[p.rarity].color }} data-testid="garden-seed" data-plant={p.id} data-rarity={p.rarity} data-state={state}>
              <div className="gd-packet-band">{RARITY[p.rarity].title}</div>
              <PlantArt id={p.id} title={p.title} pot={false} />
              <div className="gd-packet-name">{p.title}</div>
              <div className="gd-packet-meta"><Clock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> растёт {growText(p.hours)}</div>
              {p.note && <div className="gd-packet-note">{p.note}</div>}
              <div className="gd-packet-price"><Coins size={14} aria-hidden="true" />{price}<small>· {p.crowns} кр.</small></div>
              <Button small wide variant={state === 'ok' ? 'primary' : 'secondary'} disabled={state !== 'ok'} data-testid="garden-plant" onClick={() => doPlant(p.id)}>
                {state === 'ok' ? 'Посадить' : state === 'coins' ? `Не хватает ${price - b}` : 'Грядки заняты'}
              </Button>
            </div>
          );
        })}
      </div>

      <RateWeek day={day} focus="garden" />
      <Heading level={3} title="Урожай" sub={keptN ? `Собрано и не продано: ${keptN}. Одинаковое лежит одной строкой.` : 'Соберите созревшее — урожай появится здесь.'} />
      <div className="gd-odds" data-testid="garden-odds">Редкость урожая выпадает при сборе: чем реже, тем дороже на рынке. Цена — цена семян в кронах × редкость × спрос недели, по курсу дня.</div>
      <div className="gd-grades" data-testid="garden-grades">
        {GRADES.map((g) => <span key={g.id}><Grade id={g.id} /> {multText(g.mult)}</span>)}
      </div>
      {groups.length > 0 && (
        <div className="gd-crops" data-testid="garden-crops">
          {shown.map((g) => {
            const p = PLANT_BY_ID[g.plant]; const price = salePrice(learn, g.ats[0], now); const n = soldToday(learn, g.plant, now);
            const paidLast = paidPrice(learn, g.ats[0]);
            return (
              <div key={g.key} className="gd-crop" data-testid="garden-crop" data-plant={g.plant} data-grade={g.grade} data-count={g.ats.length}>
                <GradeArt plantId={g.plant} grade={g.grade} title={p.title} />
                <div style={{ minWidth: 0 }}>
                  <div className="gd-crop-title">{p.title} <Grade id={g.grade} />{g.ats.length > 1 && <span className="gd-count">×{g.ats.length}</span>}</div>
                  <div className="gd-crop-price" data-testid="garden-crop-price">
                    семена — {g.paid[0] === g.paid[1] ? g.paid[0] : `${g.paid[0]}–${g.paid[1]}`} · на рынке — {price.coins} <Profit d={price.coins - paidLast} />
                    {n > 0 ? <><br />сегодня продано {n} — цена ниже на {Math.round((1 - price.factor) * 100)}%</> : null}
                  </div>
                </div>
                <div className="gd-crop-btns">
                  <Button small variant="secondary" icon={Coins} onClick={() => doSell([g.ats[0]])} data-testid="garden-sell">Продать</Button>
                  {g.ats.length > 1 && <Button small variant="ghost" onClick={() => doSell(g.ats)} data-testid="garden-sell-all">Все ×{g.ats.length}</Button>}
                </div>
              </div>
            );
          })}
          {groups.length > CROPS_SHOWN && (
            <Button small variant="ghost" data-testid="garden-crops-more" aria-expanded={allCrops} onClick={() => { Audio.play('paper'); setAllCrops((v) => !v); }}>
              {allCrops ? 'Свернуть' : `Ещё ${groups.length - CROPS_SHOWN} ${plural(groups.length - CROPS_SHOWN, 'строка', 'строки', 'строк')}`}
            </Button>
          )}
        </div>
      )}
      <div className="gd-odds" style={{ marginBottom: 14 }}>Спрос насыщается: каждая продажа того же растения за день снижает его цену на {Math.round(MARKET_DROP * 100)}%. Завтра цена снова полная.</div>

      <Heading level={3} title="Гербарий" sub={`Выращено видов: ${Object.keys(ever).length} из ${PLANTS.length}. Точки — редкости урожая в коллекции.`} />
      <div className="gd-herb" data-testid="garden-herbarium">
        {PLANTS.map((p) => (
          <div key={p.id} className={ever[p.id] ? '' : 'no'} data-testid="herb-item" data-plant={p.id} data-got={String(!!ever[p.id])} data-kept={herb[p.id] || 0}>
            <PlantArt id={p.id} title={ever[p.id] ? p.title : `${p.title}: ещё не выращено`} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{p.title}</div>
            {ever[p.id]
              ? <>
                <div style={{ fontSize: 12 }}>{herb[p.id] ? `в коллекции ×${herb[p.id]}` : 'всё продано'}</div>
                <div className="gd-dots" aria-label={`Редкости в коллекции: ${GRADES.filter((g) => (coll[p.id] || {})[g.id]).map((g) => g.title).join(', ') || 'нет'}`}>
                  {GRADES.map((g) => <i key={g.id} className={(coll[p.id] || {})[g.id] ? 'on' : ''} style={{ color: g.color }} title={g.title} />)}
                </div>
              </>
              : <div style={{ fontSize: 12 }}><Lock size={11} aria-hidden="true" style={{ verticalAlign: -1 }} /> ещё нет</div>}
          </div>
        ))}
      </div>
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
// разница цены рынка и цены семян: «+3» зелёным, «−2» красным
function Profit({ d }) {
  if (d == null || Number.isNaN(d)) return null;
  const sign = d > 0 ? '+' : d < 0 ? '-' : '0';
  return <span className="gd-profit" data-testid="garden-profit" data-sign={sign}>({d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'})</span>;
}
const gradeOfGroup = (groups, at) => (groups.find((g) => g.ats.includes(at)) || { grade: 'plain' }).grade;
