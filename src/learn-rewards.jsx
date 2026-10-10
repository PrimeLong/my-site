/* ЭКРАНЫ НАГРАД И ПРОГРАММЫ: кошелёк, лавка с курсом дня, задания дня и испытание месяца,
   сундук юнита, утренний экран серии, печати-достижения, «Моя программа» в профиле и
   приглашение на вступительный тест. Всё — из компонентов дизайн-системы (src/ds.jsx,
   src/ds-art.jsx); расчёты — в чистых модулях src/learn/rewards.js и src/learn/program.js. */
import React, { useEffect, useRef, useState } from 'react';
import {
  X, Wallet, ShieldCheck, Shirt, Sunrise, Moon, PiggyBank, CalendarDays, Footprints, Check, Flame, Landmark, Shapes, GraduationCap,
  ScrollText, Timer, Map as MapIcon, Target, Coins, ShoppingBag, TrendingUp, TrendingDown, Minus, Gem, Zap, ListChecks, ChevronRight,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Mascot } from './mascot.jsx';
import { Button, IconButton, Card, Heading, Row, Sheet } from './ds.jsx';
import { Rosette, Stamp, CoinShower, CountUp, Guilloche, Chest } from './ds-art.jsx';
import {
  balance, rateOn, rateHistory, priceOf, buy, setWear, outfitOf, FREEZE, BOOST, OUTFITS, OUTFIT_BY_ID, SLOT_LABEL, shopDay, boostActive, DEAL_OFF, questsFor, QUEST_ICON, monthChallenge, monthStamps, policyInfo, takePolicy, cancelPolicy, PREMIUM,
  chestCoins, chestKey, hasClaim, openChest, achievementsOf, coinsWord, plural, greetingAt, COIN, PIGGY, piggyState, piggyPut, piggyTake, piggyCurve, piggyValue, forgone, PIGGY_YEARLY, REAL_RATE, realCurve,
} from './learn/rewards.js';
import { skillLevel, LEVEL_NAME, LEVEL_TEXT } from './learn/program.js';
import {
  dayOf, addDays, streak, ownedFreezes, weekDots, setProfile, PROFILE_GOALS, PROFILE_MINUTES, PROFILE_GOAL_LABEL, goalMinutes, goalToday,
} from './textbook/learn-state.js';

export const REWARD_CSS = `
  .rw-bar { height: 6px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .rw-bar > i { display: block; height: 100%; background: var(--u); border-radius: 3px; transition: width .3s ease-out; }
  .rw-bar.ok > i { background: var(--ds-ok); }
  .rw-quest { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 0; border-top: 1px dotted var(--ds-rule2); }
  .rw-quest:first-of-type { border-top: none; }
  .rw-ico { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--ds-rule2); color: var(--u-ink); background: var(--ds-card); }
  .rw-tasks-entry { margin: 0 0 12px; padding: 12px 14px; }
  .rw-ico.ok { background: var(--ds-ok-btn); border-color: var(--ds-ok-btn); color: #fff; }
  .rw-coin { font: 700 13px var(--ds-mono); color: var(--ds-ink2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .rw-page { position: fixed; inset: 0; z-index: 250; overflow-y: auto; background: var(--ds-paper); padding: 8px 16px calc(40px + env(safe-area-inset-bottom)); }
  .rw-page-in { max-width: 560px; margin: 0 auto; }
  .rw-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .rw-item { border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); padding: 10px 10px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule); }
  .rw-item[data-on="true"] { box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--u); }
  .rw-price { font: 700 14px var(--ds-mono); }
  .rw-price small { font: 12px var(--ds-sans); color: var(--ds-ink3); margin-left: 4px; }
  .rw-dots { display: flex; justify-content: center; gap: 8px; }
  .rw-forgone { font-size: 12px; line-height: 1.25; color: var(--ds-ink3); }
  .rw-piggy-chart { width: 100%; display: block; margin: 6px 0 2px; }
  .rw-piggy-chart text { font: 700 12px var(--ds-mono); fill: var(--ds-ink2); }
  .rw-dot { width: 34px; display: flex; flex-direction: column; align-items: center; gap: 4px; font: 700 12px var(--ds-sans); color: var(--ds-ink3); }
  .rw-dot i { width: 26px; height: 26px; border-radius: 50%; border: 1.5px dashed var(--ds-rule2); display: flex; align-items: center; justify-content: center; }
  .rw-dot.done i { border: none; background: var(--ds-bad); color: #fff; }
  .rw-dot.frozen i { border: none; background: #3E6FA8; color: #fff; }
  .rw-dot.today { color: var(--ds-ink); }
  .rw-stamps { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px 6px; justify-items: center; }
  .rw-stamp { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  /* ещё не полученная печать: блёклый серый оттиск, а подпись читается полным контрастом */
  .rw-stamp[data-got="false"] > svg, .rw-stamp[data-got="false"] > .ds-stamp { opacity: .38; filter: grayscale(1); }
  .rw-stamp[data-got="false"] b { color: var(--ds-ink2); }
  .rw-stamp b { font: 700 12px/1.2 var(--ds-serif); }
  .rw-stamp span { font: 12px/1.25 var(--ds-sans); color: var(--ds-ink2); }
  .rw-morning { position: fixed; inset: 0; z-index: 320; display: flex; flex-direction: column; background: var(--ds-paper); padding: 24px 20px calc(24px + env(safe-area-inset-bottom)); }
  .rw-morning-in { flex: 1; max-width: 460px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .rw-big { font: 700 64px/1 var(--ds-serif); color: var(--ds-bad); }
  .rw-flame { animation: rw-flame .9s ease-out 1 both; }
  @keyframes rw-flame { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
  /* сундук при открытии чуть подпрыгивает и пружинит — без поворота и крена */
  .rw-chest-open { animation: rw-chest-pop .5s ease-out 1 both; transform-origin: 50% 90%; }
  @keyframes rw-chest-pop { 0% { transform: none; } 30% { transform: scale(1.08, .92); } 60% { transform: scale(.96, 1.05) translateY(-4px); } 100% { transform: none; } }
  .rw-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .rw-rate { width: 100%; height: 64px; display: block; touch-action: none; }
  .rw-item { position: relative; }
  .rw-deal { position: absolute; top: -8px; right: -6px; transform: rotate(6deg); background: var(--ds-bad-btn); color: #fff; font: 700 12px var(--ds-sans); letter-spacing: .04em; padding: 3px 7px; border-radius: 2px; box-shadow: 0 1px 2px var(--ds-shade); }
  .rw-rare { position: absolute; top: -9px; left: -6px; transform: rotate(-6deg); display: inline-flex; align-items: center; gap: 3px; background: linear-gradient(135deg, #8A2F45, #6B4357); color: #fff; font: 700 12px var(--ds-sans); letter-spacing: .06em; text-transform: uppercase; padding: 3px 7px; border-radius: 2px; box-shadow: 0 1px 3px var(--ds-shade); }
  /* редкая вещь: золотистая карточка, по ней пробегает блик, Инфля в ней крупнее */
  .rw-item[data-rare="true"] { border-color: #C9A43A;
    background: linear-gradient(110deg, transparent 35%, rgba(255, 246, 214, .75) 48%, transparent 61%) 0 0 / 260% 100% no-repeat, color-mix(in srgb, var(--ds-card) 84%, #E3B53C);
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--ds-card) 84%, #E3B53C), inset 0 0 0 4px #C9A43A, 0 2px 10px rgba(201, 164, 58, .28);
    animation: rw-shine 5s ease-in-out infinite; }
  .rw-item[data-rare="true"][data-owned="true"] { animation: none; }
  @keyframes rw-shine { 0%, 55% { background-position: 130% 0, 0 0 } 100% { background-position: -30% 0, 0 0 } }
  .rw-note { font: italic 12px/1.3 var(--ds-sans); color: var(--ds-ink2); }
  .rw-price s { color: var(--ds-ink3); font-weight: 400; margin-right: 4px; }
  .rw-goal { height: 5px; width: 100%; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .rw-goal > i { display: block; height: 100%; background: #8A2F45; }
  @media (prefers-reduced-motion: reduce) { .rw-flame, .rw-chest-open, .rw-item[data-rare="true"] { animation: none; } .rw-bar > i { transition: none; } }
`;

const ACH_ICON = { footprints: Footprints, check: Check, flame: Flame, landmark: Landmark, shapes: Shapes, graduation: GraduationCap, scroll: ScrollText, shopping: ShoppingBag, shirt: Shirt, sunrise: Sunrise, moon: Moon, piggy: PiggyBank, calendar: CalendarDays, gem: Gem };
const Q_ICON = { timer: Timer, map: MapIcon, check: Check, target: Target, coins: Coins, flame: Flame, spark: Zap };
const fmtRate = (r) => r.toFixed(2).replace('.', ',');
const Bar = ({ have, target, ok }) => <div className={`rw-bar ${ok ? 'ok' : ''}`} role="presentation"><i style={{ width: `${Math.round((Math.min(have, target) / target) * 100)}%` }} /></div>;
const CoinTag = ({ n, testid }) => <span className="rw-coin" data-testid={testid}><Coins size={14} color="var(--ds-gold)" aria-hidden="true" />{n}</span>;

/* ------------------------------ КОШЕЛЁК ------------------------------ */
// монеты в кошельке; тратятся во вкладке «Лавка» нижней панели
export function WalletStat({ learn }) {
  const b = balance(learn);
  return (
    <span className="ln-stat" title="Монеты — тратятся во вкладке «Лавка»" data-testid="wallet">
      <Wallet size={17} color="var(--ds-gold)" aria-hidden="true" /><span className="ds-sr">Монеты: </span><span data-testid="wallet-balance">{b}</span>
    </span>
  );
}

/* Карточка «Задания» наверху Пути: сколько заданий дня сделано, цель в минутах и испытание
   месяца — одной строкой. Касание открывает экран заданий (задания дня, испытание, практика). */
export function TasksEntry({ learn, onOpen, now = Date.now() }) {
  const quests = questsFor(learn, now);
  const g = goalToday(learn, now);
  const m = monthChallenge(learn, now);
  const done = quests.filter((q) => q.done).length;
  const goalOk = g.done >= g.goal;
  const text = `Задания дня: ${done} из 3 · цель ${Math.min(g.done, g.goal)}/${g.goal} мин · испытание месяца ${m.claimed ? 'выполнено' : `${m.have} из ${m.target}`}`;
  return (
    <button type="button" className="ds-card ds-card--button rw-tasks-entry" data-testid="tasks-card" data-nav-target="tasks" aria-label={`Задания. ${text}`}
      onClick={() => { Audio.play('paper'); onOpen(); }}>
      <span className={`rw-ico ${done === 3 && goalOk ? 'ok' : ''}`}>{done === 3 && goalOk ? <Check size={16} aria-hidden="true" /> : <ListChecks size={16} aria-hidden="true" />}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15.5 }}>Задания</span>
        <span className="ds-sub" style={{ display: 'block', fontSize: 13, lineHeight: 1.35 }} data-testid="tasks-card-text">{text}</span>
      </span>
      <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------ ЗАДАНИЯ ДНЯ ------------------------------ */
export function QuestsCard({ learn, now = Date.now(), testid = 'quests' }) {
  const quests = questsFor(learn, now);
  const g = goalToday(learn, now);
  const done = quests.filter((q) => q.done).length;
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid={testid}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="ds-h3">Задания дня</div>
        <span className="ds-num ds-faint" style={{ fontSize: 13 }} data-testid="quests-done">{done}/3</span>
      </div>
      <div>
      {/* цель дня — минуты занятий: у всех своя скорость, а время честно сравнивается само с собой */}
      <div className="rw-quest" data-testid="goal-row" data-done={String(g.done >= g.goal)}>
        <span className={`rw-ico ${g.done >= g.goal ? 'ok' : ''}`}>{g.done >= g.goal ? <Check size={16} aria-hidden="true" /> : <Timer size={16} aria-hidden="true" />}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Цель дня: {g.goal} минут занятий</div>
          <Bar have={g.done} target={g.goal} ok={g.done >= g.goal} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <CoinTag n={`+${COIN.goal}`} />
          <div className="ds-num ds-faint" style={{ fontSize: 12 }}>{Math.min(g.done, g.goal)}/{g.goal} мин</div>
        </div>
      </div>
        {quests.map((q) => {
          const Icon = Q_ICON[QUEST_ICON[q.id]] || Target;
          return (
            <div key={q.id} className="rw-quest" data-testid="quest" data-quest={q.id} data-done={String(q.done)}>
              <span className={`rw-ico ${q.done ? 'ok' : ''}`}>{q.done ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{q.title}</div>
                <Bar have={q.have} target={q.target} ok={q.done} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <CoinTag n={`+${q.coins}`} />
                <div className="ds-num ds-faint" style={{ fontSize: 12 }}>{q.have}/{q.target}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 6 }}>Все три — ещё +{COIN.allQuests}. Новые задания — завтра, с нуля.</div>
    </Card>
  );
}
// испытание месяца: цель от самого ученика (цель дня в минутах, прошлый месяц) — и откуда она взялась
export function MonthCard({ learn, now = Date.now() }) {
  const m = monthChallenge(learn, now);
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid="month" data-done={String(m.done)} data-kind={m.id}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <CalendarDays size={18} color="var(--u-ink)" aria-hidden="true" />
        <span className="ds-h3" style={{ flex: 1 }}>Испытание месяца</span>
        <CoinTag n={`+${m.coins}`} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{m.title}</div>
      <Bar have={m.have} target={m.target} ok={m.done} />
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 4 }}>
        {m.claimed ? `Выполнено — марка «${m.name}» в альбоме.`
          : `${m.have} из ${m.target}${m.need ? ` · нужно ещё ${m.need} ${m.unit}` : ''} · до конца месяца ${m.daysLeft} ${plural(m.daysLeft, 'день', 'дня', 'дней')}${m.daysLeft === 1 ? ' — сегодня последний' : ''}`}
      </div>
      <div className="ds-faint" style={{ fontSize: 12, marginTop: 2 }} data-testid="month-why">{m.why}</div>
    </Card>
  );
}

/* ------------------------------ ГРАФИК КУРСА ------------------------------
   Одна линия за 14 дней, пунктир — 1,0 (крона = монета). Касание или наведение — день и курс. */
/* График курса: ширина рисунка — ширина экрана (иначе рисунок сжимается к середине, и
   наведение показывает не тот день). Подпись точки — «сегодня», «вчера», «позавчера»,
   «N дн. назад» и дата. */
const agoText = (n) => (n === 0 ? 'сегодня' : n === 1 ? 'вчера' : n === 2 ? 'позавчера' : `${n} ${plural(n, 'день', 'дня', 'дней')} назад`);
function RateChart({ hist }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(300);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width) || 300));
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 64; const pad = 8;
  const lo = Math.min(0.9, ...hist.map((h) => h.rate)); const hi = Math.max(1.1, ...hist.map((h) => h.rate));
  const x = (i) => pad + (i / (hist.length - 1)) * (W - pad * 2);
  const y = (r) => pad + (1 - (r - lo) / (hi - lo)) * (H - pad * 2);
  const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.rate).toFixed(1)}`).join(' ');
  // ближайшая к пальцу точка — в тех же координатах, в которых нарисована
  const pick = (e) => { const b = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; const k = Math.round(((px - pad) / (W - pad * 2)) * (hist.length - 1)); setHover(Math.max(0, Math.min(hist.length - 1, k))); };
  const h = hover != null ? hist[hover] : null;
  const last = hist.length - 1;
  /* подсказка не выходит за края графика: шире экрана документ — и телефон перемасштабирует
     страницу, нижняя панель «уезжает» вниз (было у правого края, где подпись длиннее) */
  const tip = useRef(null);
  const [tipW, setTipW] = useState(150);
  React.useLayoutEffect(() => { if (tip.current) setTipW(tip.current.offsetWidth); }, [hover]);
  const tipLeft = h ? Math.max(0, Math.min(W - tipW, x(hover) - tipW / 2)) : 0;
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="rw-rate" role="img" data-testid="rate-chart"
        aria-label={`Курс за ${hist.length} дней: от ${fmtRate(Math.min(...hist.map((q) => q.rate)))} до ${fmtRate(Math.max(...hist.map((q) => q.rate)))} монеты за крону, сегодня ${fmtRate(hist[last].rate)}`}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        <line x1={pad} x2={W - pad} y1={y(1)} y2={y(1)} stroke="var(--ds-rule2)" strokeWidth="1" strokeDasharray="3 4" />
        <polyline points={pts} fill="none" stroke="var(--u-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hist.map((q, i) => <circle key={q.day} cx={x(i)} cy={y(q.rate)} r={i === last ? 4 : 1.8} fill="var(--u-ink)" stroke={i === last ? 'var(--ds-card)' : 'none'} strokeWidth="2" />)}
        {h && <><line x1={x(hover)} x2={x(hover)} y1={pad / 2} y2={H - pad / 2} stroke="var(--ds-ink3)" strokeWidth="1" /><circle cx={x(hover)} cy={y(h.rate)} r="4.5" fill="var(--u-ink)" stroke="var(--ds-card)" strokeWidth="2" /></>}
      </svg>
      {h && (
        <div ref={tip} className="ds-num" data-testid="rate-tip" style={{ position: 'absolute', top: -8, left: tipLeft, maxWidth: W, overflow: 'hidden', background: 'var(--ds-ink)', color: 'var(--ds-paper)', fontSize: 12, padding: '3px 6px', borderRadius: 2, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {agoText(last - hover)} · {h.day.slice(8)}.{h.day.slice(5, 7)} · {fmtRate(h.rate)}
        </div>
      )}
      <div className="ds-faint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>две недели назад</span><span>пунктир — 1,00</span><span>сегодня</span></div>
    </div>
  );
}

/* ------------------------------ ЛАВКА ------------------------------ */
// до полуночи — когда обновится витрина
const untilMidnight = (now) => { const d = new Date(now); const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now; const hh = Math.floor(m / 3600000); const mm = Math.floor((m % 3600000) / 60000); return `${hh} ч ${mm} мин`; };
// карточка вещи: Инфля в ней, цена по курсу (со скидкой — старая зачёркнута), купить / надеть
function ShopItem({ o, learn, day, wear, b, onBuy, onToggle, deal = false, goal = false }) {
  const owned = !!(learn.owned || {})[o.id]; const on = wear[o.slot] === o.id;
  const price = priceOf(o.id, day, learn); const full = priceOf(o.id, day);
  return (
    <div className="rw-item" data-testid="shop-item" data-item={o.id} data-owned={String(owned)} data-on={String(on)} data-deal={deal ? 'true' : undefined} data-rare={o.rare ? 'true' : undefined}>
      {deal && !owned && <span className="rw-deal" data-testid="shop-deal">−{Math.round(DEAL_OFF * 100)}%</span>}
      {o.rare && <span className="rw-rare"><Gem size={11} aria-hidden="true" />редкое</span>}
      <Mascot mood="hello" size={o.rare ? 62 : 50} outfit={{ [o.slot]: o.id }} label={`Инфля: ${o.title}`} />
      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{o.title}</div>
      {o.note && <div className="rw-note">{o.note}</div>}
      {owned
        ? <Button small variant={on ? 'secondary' : 'primary'} onClick={() => onToggle(o)}>{on ? 'Снять' : 'Надеть'}</Button>
        : <>
          <div className="rw-price">{price < full && <s>{full}</s>}{price} <span style={{ fontWeight: 400 }}>мон.</span><small>{o.crowns} кр.</small></div>
          {/* цена отказа: чего стоит вещь, кроме монет */}
          <div className="rw-forgone" data-testid="shop-forgone" title={`Цена отказа: ${forgone(price).text} или +${forgone(price).week} в копилке за неделю`}>{forgone(price).text} · копилка дала бы +{forgone(price).week}</div>
          {goal && b < price && <div className="rw-goal" role="progressbar" aria-label="Накоплено на покупку" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor((b / price) * 100)}><i style={{ width: `${Math.min(100, (b / price) * 100)}%` }} /></div>}
          <Button small variant="secondary" disabled={b < price} onClick={() => onBuy(o.id)}>Купить</Button>
        </>}
    </div>
  );
}
/* «Страховка серии» — полис: взнос каждую неделю, второй пропуск в оплаченной неделе прощается.
   Видно, сколько уже заплачено и сколько дней полис спас: окупается ли страховка. */
const fmtDay = (d) => `${d.slice(8)}.${d.slice(5, 7)}`;
function PolicyCard({ learn, update, now, b, onMsg }) {
  const p = policyInfo(learn, now);
  const old = ownedFreezes(learn);
  const take = () => {
    const r = takePolicy(learn, now);
    if (!r.ok) { Audio.play('down'); onMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register'); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: r.price ? `Полис оформлен: первый взнос — ${r.price} ${coinsWord(r.price)}, дальше по ${PREMIUM} в неделю.` : 'Полис снова действует: эта неделя уже оплачена.' });
  };
  const cancel = () => { Audio.play('paper'); update((s) => cancelPolicy(s, now)); onMsg({ ok: true, text: `Полис расторгнут. Оплаченная неделя покрыта${p.paidUntil ? ` до ${fmtDay(p.paidUntil)}` : ''}.` }); };
  return (
    <Card style={{ margin: '8px 0 10px' }} data-testid="shop-freeze" data-policy={p.active ? 'on' : 'off'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Rosette size={54} opacity={0.5}><ShieldCheck size={24} color="#3E6FA8" aria-hidden="true" /></Rosette>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{FREEZE.title}{p.active && <span className="ds-badge" style={{ marginLeft: 6 }} data-testid="policy-on">полис действует</span>}</div>
          <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.35 }}>
            Взнос — <b>{PREMIUM} {coinsWord(PREMIUM)} в неделю</b>, сам в начале недели. В оплаченной неделе прощается ещё один пропуск сверх бесплатной поблажки — это страховой случай. Расторгнуть можно в любой момент.
          </div>
        </div>
      </div>
      <div className="ds-sub" style={{ fontSize: 13, margin: '8px 0 0', lineHeight: 1.4 }} data-testid="policy-stats">
        {p.active && p.paidUntil ? `Оплачено до ${fmtDay(p.paidUntil)}. ` : ''}Всего взносов: {p.paidTotal} {coinsWord(p.paidTotal)} · полис спас дней: {p.saved}{old ? ` · старых разовых полисов: ${old}` : ''}
      </div>
      {p.lapsed && <div role="status" data-testid="policy-lapsed" style={{ fontSize: 13.5, color: 'var(--ds-bad-ink)', marginTop: 6 }}>Полис прекращён: на взнос не хватило монет. Неоплаченная неделя не покрыта.</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        {p.active
          ? <Button small variant="secondary" onClick={cancel} data-testid="policy-cancel">Расторгнуть</Button>
          : <Button small disabled={b < PREMIUM} onClick={take} data-testid="policy-take">Оформить полис · {PREMIUM} мон.</Button>}
      </div>
    </Card>
  );
}
export function ShopView({ learn, update, now = Date.now() }) {
  const day = dayOf(now);
  const rate = rateOn(day); const prev = rateOn(addDays(day, -1));
  const [msg, setMsg] = useState(null);
  const b = balance(learn);
  const wear = outfitOf(learn);
  const today = shopDay(learn, day);
  const boosted = boostActive(learn, now);
  const Trend = rate > prev ? TrendingUp : rate < prev ? TrendingDown : Minus;
  const doBuy = (id) => {
    const r = buy(learn, id, now);
    if (!r.ok) { Audio.play('down'); setMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register');
    update(() => r.s, { settle: true });
    setMsg({ ok: true, text: id === BOOST.id ? `Двойной опыт на ${BOOST.minutes} минут — за ${r.price} ${coinsWord(r.price)}.` : `Куплено за ${r.price} ${coinsWord(r.price)} — Инфля уже в обновке.` });
  };
  const toggle = (o) => { Audio.play('paper'); update((s) => setWear(s, o.slot, wear[o.slot] === o.id ? null : o.id, now)); };
  const ownedList = OUTFITS.filter((o) => (learn.owned || {})[o.id]);
  const itemProps = { learn, day, wear, b, onBuy: doBuy, onToggle: toggle };
  return (
    <div className="ln-wrap" data-testid="shop">
      <div>
        <Heading eyebrow="Лавка" title="Лавка Инфли" sub="Монеты — за уроки, серию и задания. Цены в кронах, платите по курсу дня." />
        <Card style={{ margin: '10px 0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Mascot mood="joy" size={58} outfit={wear} />
            <div style={{ flex: 1 }}>
              <div className="ds-eyebrow">В кошельке</div>
              <div className="ds-num" style={{ fontSize: 28, fontWeight: 700 }} data-testid="shop-balance">{b} <span style={{ fontSize: 15 }}>{coinsWord(b)}</span></div>
            </div>
          </div>
          <div style={{ borderTop: '1px dotted var(--ds-rule2)', marginTop: 12, paddingTop: 10 }} data-testid="rate">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>Курс дня: <b className="ds-num" data-testid="rate-value">1 крона = {fmtRate(rate)} монеты</b></span>
              <span className="ds-num ds-sub" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Trend size={14} aria-hidden="true" />вчера {fmtRate(prev)}</span>
            </div>
            <RateChart hist={rateHistory(day, 14)} />
            <div className="ds-sub" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
              Цены в лавке назначены в кронах, а платите вы монетами по курсу дня. Курс ниже — товар дешевле в монетах: можно подождать удачного дня.
            </div>
          </div>
        </Card>
        {msg && <div role="status" data-testid="shop-msg" style={{ margin: '0 0 12px', fontSize: 14.5, color: msg.ok ? 'var(--ds-ok)' : 'var(--ds-bad)' }}>{msg.text}</div>}

        <Heading level={3} title="Витрина дня" sub={`Обновится через ${untilMidnight(now)}. На одну вещь — скидка дня ${Math.round(DEAL_OFF * 100)}%.`} />
        <div className="rw-items" style={{ margin: '10px 0 16px' }} data-testid="shop-showcase">
          {today.showcase.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} deal={id === today.deal} {...itemProps} />)}
          {!today.showcase.length && <div className="ds-sub" style={{ gridColumn: '1 / -1', fontSize: 14.5 }}>Всё обычное уже ваше — дальше только витрина ювелира.</div>}
        </div>

        <PiggyCard learn={learn} update={update} now={now} b={b} onMsg={setMsg} />

        <Heading level={3} title="Полезное" />
        <PolicyCard learn={learn} update={update} now={now} b={b} onMsg={setMsg} />
        <Card style={{ margin: '0 0 16px' }} data-testid="shop-boost">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rosette size={54} opacity={0.5}><Zap size={24} color="var(--ds-gold)" aria-hidden="true" /></Rosette>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{BOOST.title}{boosted && <span className="ds-badge" style={{ marginLeft: 6 }} data-testid="boost-on">действует до {new Date(learn.boost).toTimeString().slice(0, 5)}</span>}</div>
              <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.35 }}>{BOOST.text}</div>
              <div className="rw-price">{priceOf(BOOST.id, day)} <span style={{ fontWeight: 400 }}>мон.</span><small>{BOOST.crowns} кр.</small></div>
            </div>
            <Button small disabled={boosted} onClick={() => doBuy(BOOST.id)} data-testid="buy-boost">Купить</Button>
          </div>
        </Card>

        <Heading level={3} title="Витрина ювелира" sub="Редкие вещи — всегда здесь. На них копят: полоска показывает, сколько уже собрано." />
        <div className="rw-items" style={{ margin: '10px 0 16px' }} data-testid="shop-rare">
          {today.rare.map((id) => <ShopItem key={id} o={OUTFIT_BY_ID[id]} goal {...itemProps} />)}
        </div>

        <Heading level={3} title="Гардероб" sub={ownedList.length ? 'Купленное можно снять и надеть снова: по одной вещи на голову, лицо, шею, в руку и рамку.' : 'Пока пусто — купленные вещи будут здесь.'} />
        {Object.keys(SLOT_LABEL).filter((slot) => ownedList.some((o) => o.slot === slot)).map((slot) => (
          <div key={slot} style={{ margin: '10px 0 14px' }} data-testid="shop-wardrobe">
            <div className="ds-eyebrow" style={{ marginBottom: 6 }}>{SLOT_LABEL[slot]}</div>
            <div className="rw-items">
              {ownedList.filter((o) => o.slot === slot).map((o) => <ShopItem key={o.id} o={o} {...itemProps} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ КОПИЛКА ИНФЛИ ------------------------------
   Положить монеты под 2% в день на неделю; график — как растёт вклад по дням: столбик каждого дня
   чуть выше прошлого не на 2 монеты, а на 2% от уже накопленного. Забрать раньше — процент сгорит. */
function PiggyChart({ amount, day = null }) {
  const pts = piggyCurve(amount);
  const W = 300; const H = 92; const pad = 18; const top = pts[pts.length - 1].value; const lo = amount * 0.97;
  const bw = (W - pad * 2) / pts.length;
  const h = (v) => ((v - lo) / (top - lo)) * (H - 30);
  return (
    <svg className="rw-piggy-chart" viewBox={`0 0 ${W} ${H}`} role="img" data-testid="piggy-chart"
      aria-label={`Вклад ${amount}: через неделю ${piggyValue(amount, PIGGY.days)}`}>
      {pts.map((p) => (
        <g key={p.day}>
          <rect x={pad + p.day * bw + 3} y={H - 14 - h(p.value)} width={bw - 6} height={h(p.value) + 1} rx="1.5"
            fill={day != null && p.day <= day ? 'var(--u)' : 'color-mix(in srgb, var(--u) 28%, var(--ds-card))'} stroke="var(--u-ink)" strokeWidth={day === p.day ? 1.6 : 0.6} />
          <text x={pad + p.day * bw + bw / 2} y={H - 3} textAnchor="middle">{p.day === 0 ? 'сейч.' : `д${p.day}`}</text>
        </g>
      ))}
      <text x={pad + 7 * bw + bw / 2} y={H - 18 - h(top)} textAnchor="middle">{Math.floor(top + 1e-9)}</text>
      <text x={pad + bw / 2} y={H - 18 - h(amount)} textAnchor="middle">{amount}</text>
    </svg>
  );
}
/* Честно про проценты: 2% в день — 730% годовых, такого не бывает; а вот реальные 8% годовых —
   1000 крон за 10 лет (docs/mechanics.md). */
function RealRate() {
  const pts = realCurve();
  const W = 300; const H = 70; const pad = 14; const top = pts[pts.length - 1].value;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => H - 14 - ((v - 900) / (top - 900)) * (H - 30);
  return (
    <div data-testid="piggy-real" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dotted var(--ds-rule2)' }}>
      <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.4 }}>
        {Math.round(PIGGY.rate * 100)}% в день ≈ {PIGGY_YEARLY}% годовых — в жизни так не бывает, а вот как выглядят реальные {Math.round(REAL_RATE * 100)}% годовых:
      </div>
      <svg className="rw-piggy-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`1000 крон под ${Math.round(REAL_RATE * 100)}% годовых: через 10 лет ${top}`}>
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--u-ink)" strokeWidth="1.6" />
        {pts.map((p, i) => <circle key={p.year} cx={x(i)} cy={y(p.value)} r={i === 0 || i === pts.length - 1 ? 2.6 : 1.4} fill="var(--u-ink)" />)}
        <text x={x(0)} y={y(1000) - 5} textAnchor="start">1000</text>
        <text x={x(pts.length - 1)} y={y(top) - 5} textAnchor="end">{top}</text>
        <text x={x(0)} y={H - 2} textAnchor="start">сейчас</text>
        <text x={x(pts.length - 1)} y={H - 2} textAnchor="end">через 10 лет</text>
      </svg>
    </div>
  );
}
function PiggyCard({ learn, update, now, b, onMsg }) {
  const st = piggyState(learn, now);
  const [amount, setAmount] = useState(() => Math.max(PIGGY.min, Math.min(100, Math.floor(b / 2))));
  const can = b >= PIGGY.min;
  const n = Math.max(PIGGY.min, Math.min(amount, b));
  const put = () => {
    const r = piggyPut(learn, n, now);
    if (!r.ok) { Audio.play('down'); onMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register'); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: `В копилке ${r.amount} ${coinsWord(r.amount)}. Через ${PIGGY.days} дней станет ${piggyValue(r.amount, PIGGY.days)}.` });
  };
  const take = () => {
    const r = piggyTake(learn, now);
    if (!r.ok) { onMsg({ ok: false, text: r.reason }); return; }
    Audio.play(r.early ? 'paper' : 'register'); update(() => r.s, { settle: true });
    onMsg({ ok: true, text: !r.early ? `Забрано ${r.payout} ${coinsWord(r.payout)} — с процентами за неделю.` : r.lost ? `Забрано ${r.payout} ${coinsWord(r.payout)}: раньше срока процент сгорел (−${r.lost}).` : `Забрано ${r.payout} ${coinsWord(r.payout)}: проценты не успели набежать.` });
  };
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid="shop-piggy" data-open={String(!!st)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Rosette size={54} opacity={0.5}><PiggyBank size={24} color="var(--u-ink)" aria-hidden="true" /></Rosette>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Копилка Инфли</div>
          <div className="ds-sub" style={{ fontSize: 13, lineHeight: 1.35 }}>
            {Math.round(PIGGY.rate * 100)}% в день на накопленное, срок — {PIGGY.days} дней. Раньше срока забрать можно, но процент сгорит.
          </div>
        </div>
      </div>
      {st ? (
        <>
          <PiggyChart amount={st.amount} day={st.days} />
          <div style={{ fontSize: 14.5, margin: '2px 0 8px' }} data-testid="piggy-state">
            Положено <b className="ds-num">{st.amount}</b>, день {st.days} из {PIGGY.days}: сейчас <b className="ds-num">{st.value}</b>{st.ripe ? ' — срок вышел, можно забирать.' : `, через ${PIGGY.days - st.days} ${plural(PIGGY.days - st.days, 'день', 'дня', 'дней')} — ${st.final}.`}
          </div>
          <Button small variant={st.ripe ? 'primary' : 'ghost'} data-testid="piggy-take" onClick={take}>
            {st.ripe ? `Забрать ${st.payout} ${coinsWord(st.payout)}` : `Забрать раньше: только ${st.payout}`}
          </Button>
        </>
      ) : can ? (
        <>
          <PiggyChart amount={n} />
          <label className="ds-sub" style={{ fontSize: 14, display: 'block' }} htmlFor="piggy-amount">Положить: <b className="ds-num">{n}</b> {coinsWord(n)} → через неделю <b className="ds-num">{piggyValue(n, PIGGY.days)}</b></label>
          <input id="piggy-amount" type="range" min={PIGGY.min} max={Math.max(PIGGY.min, b)} step={1} value={n} data-testid="piggy-amount" style={{ width: '100%', accentColor: 'var(--u)' }}
            onChange={(e) => { Audio.play('tick'); setAmount(Number(e.target.value)); }} />
          <Button small data-testid="piggy-put" onClick={put}>Положить {n} {coinsWord(n)}</Button>
        </>
      ) : (
        <div className="ds-sub" style={{ fontSize: 14, marginTop: 8 }}>Положить можно от {PIGGY.min} монет — их дают уроки.</div>
      )}
      <RealRate />
    </Card>
  );
}

/* ------------------------------ СУНДУК ЮНИТА ------------------------------ */
export function ChestSheet({ unitId, place, learn, update, onClose }) {
  const n = chestCoins(unitId);
  const [opened, setOpened] = useState(false);
  const was = hasClaim(learn, chestKey(unitId));
  const open = () => { Audio.play('register'); update((s) => openChest(s, unitId), { settle: true }); setOpened(true); };
  return (
    <Sheet label={`Сундук: ${place}`} onClose={onClose} testid="chest-sheet">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginRight: -8 }}><IconButton label="Закрыть" icon={X} data-nav="back" onClick={onClose} size={22} /></div>
      <div style={{ textAlign: 'center' }}>
        {opened && <CoinShower seed={n} n={18} />}
        <div className="ds-eyebrow">Сундук юнита · {place}</div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }} className={opened ? 'rw-chest-open' : ''}>
          <Chest size={132} open={opened} animate spent={was && !opened} label={opened ? 'Сундук открыт: монеты' : was ? 'Сундук пуст' : 'Сундук закрыт'} />
        </div>
        {opened ? (
          <><div className="ds-h2" data-testid="chest-coins">+{n} {coinsWord(n)}</div><div className="ds-sub" style={{ fontSize: 14.5, margin: '4px 0 14px' }}>Место на карте ваше — монеты в кошельке.</div>
            <Button wide onClick={onClose}>Забрать</Button></>
        ) : was ? (
          <div className="ds-sub" style={{ fontSize: 15 }}>Сундук уже открыт — монеты в кошельке.</div>
        ) : (
          <><div className="ds-sub" style={{ fontSize: 15, marginBottom: 14 }}>Юнит пройден — внутри монеты.</div><Button wide data-testid="chest-open" onClick={open}>Открыть</Button></>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------ УТРЕННИЙ ЭКРАН СЕРИИ ------------------------------
   Один раз в день, при первом открытии: «Вы на N дней подряд», неделя и страховка серии. */
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export function MorningStreak({ learn, onClose, now = Date.now() }) {
  const st = streak(learn, now);
  const hello = greetingAt(new Date(now).getHours());
  const pol = policyInfo(learn, now);
  return (
    <div className="rw-morning" data-testid="morning" role="dialog" aria-label="Серия дней">
      <div className="rw-morning-in">
        <Guilloche height={22} />
        <div className="ds-eyebrow" style={{ marginTop: 18 }}>{hello}</div>
        <div className="rw-flame" style={{ margin: '14px 0 4px' }}><Flame size={72} color="var(--ds-bad)" fill="color-mix(in srgb, var(--ds-bad) 25%, transparent)" aria-hidden="true" /></div>
        <div className="rw-big" data-testid="morning-days"><CountUp value={st.days} /></div>
        <h1 className="ds-h1" style={{ margin: '6px 0 4px' }}>{`Вы на ${st.days} ${plural(st.days, 'день', 'дня', 'дней')} подряд`}</h1>
        <div className="ds-sub" style={{ fontSize: 15.5, marginBottom: 18 }}>{st.today ? 'Сегодня уже занимались — серия продлена.' : 'Один урок сегодня — и серия продолжится.'}</div>
        <div className="rw-dots" data-testid="morning-week">
          {weekDots(learn, now).map((d) => (
            <div key={d.day} className={`rw-dot ${d.done ? 'done' : d.frozen ? 'frozen' : ''} ${d.today ? 'today' : ''}`}>
              <i>{d.done ? <Flame size={14} aria-hidden="true" /> : d.frozen ? <ShieldCheck size={14} aria-hidden="true" /> : null}</i>{DOW[d.dow]}
            </div>
          ))}
        </div>
        <div className="ds-faint" style={{ fontSize: 13, marginTop: 14 }}>
          <ShieldCheck size={13} style={{ verticalAlign: -2 }} aria-hidden="true" /> {pol.active ? `Страховка серии действует: в эту неделю прощается ещё один пропуск. Взнос — ${pol.premium} ${coinsWord(pol.premium)} в неделю.` : 'Один пропуск в неделю серию не рвёт. Страховка серии в лавке прощает ещё один.'}
        </div>
        <Guilloche height={22} style={{ marginTop: 18 }} />
      </div>
      <div style={{ maxWidth: 460, width: '100%', margin: '0 auto' }}><Button wide autoFocus data-testid="morning-go" onClick={() => { Audio.play('paper'); onClose(); }}>В путь</Button></div>
    </div>
  );
}

/* ------------------------------ ПЕЧАТИ ------------------------------ */
export function Achievements({ learn }) {
  const list = achievementsOf(learn);
  const months = monthStamps(learn);
  return (
    <div data-testid="achievements">
      <div className="rw-stamps">
        {list.map((a) => {
          const Icon = ACH_ICON[a.icon] || Check;
          return (
            <div key={a.id} className="rw-stamp" data-testid="ach" data-ach={a.id} data-got={String(a.got)} title={a.text}>
              <Stamp text={a.title.toUpperCase()} center={<Icon size={20} aria-hidden="true" />} size={72} rotate={a.got ? -8 : 0} color={a.got ? 'var(--u-ink)' : 'var(--ds-ink3)'} />
              <b>{a.title}</b><span>{a.text}</span>
            </div>
          );
        })}
        {months.map((m) => (
          <div key={m.key} className="rw-stamp" data-testid="ach-month" data-got="true">
            <Stamp text="ИСПЫТАНИЕ МЕСЯЦА" center={<CalendarDays size={20} aria-hidden="true" />} size={72} rotate={6} color="var(--ds-gold)" />
            <b>{m.name}</b><span>марка месяца</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ НАГРАДЫ ЗА УРОК ------------------------------ */
export function GainsList({ coins, gains }) {
  const total = coins + gains.reduce((a, g) => a + g.coins, 0);
  if (!total) return null;
  return (
    <div style={{ marginTop: 14, textAlign: 'left' }} data-testid="result-coins" data-total={total}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: '700 18px var(--ds-mono)' }}>
        <Coins size={20} color="var(--ds-gold)" aria-hidden="true" /><CountUp value={total} prefix="+" /> <span style={{ font: '15px var(--ds-sans)' }}>{coinsWord(total)}</span>
      </div>
      <div style={{ marginTop: 6 }}>
        {coins > 0 && <div className="ds-row" style={{ fontSize: 13.5 }}><span>За урок</span><b className="ds-num">+{coins}</b></div>}
        {gains.map((g) => <div key={g.key} className="ds-row" style={{ fontSize: 13.5 }} data-testid="gain" data-kind={g.kind}><span>{g.title}</span><b className="ds-num">+{g.coins}</b></div>)}
      </div>
    </div>
  );
}

/* ------------------------------ МОЯ ПРОГРАММА ------------------------------ */
export function ProgramCard({ learn, update, onPlacement }) {
  const p = learn.profile || {};
  const level = skillLevel(learn);
  const setMinutes = (m) => { Audio.play('tick'); update((s) => setProfile(s, { minutes: m })); };
  const mins = goalMinutes(learn);
  return (
    <Card style={{ margin: '12px 0' }} data-testid="prof-program">
      <div className="ds-h3" style={{ marginBottom: 8 }}>Моя программа</div>
      <div className="ds-eyebrow" style={{ marginBottom: 6 }}>Цель</div>
      <div className="rw-chip-row" role="group" aria-label="Цель">
        {PROFILE_GOALS.map((g) => <button key={g} type="button" className="ds-chip" aria-pressed={p.goal === g} onClick={() => { Audio.play('tick'); update((s) => setProfile(s, { goal: g })); }}>{PROFILE_GOAL_LABEL[g]}</button>)}
      </div>
      <div className="ds-eyebrow" style={{ margin: '12px 0 6px' }}>Цель дня · минут занятий</div>
      <div className="rw-chip-row" role="group" aria-label="Минут в день">
        {PROFILE_MINUTES.map((m) => (
          <button key={m} type="button" className="ds-chip" aria-pressed={mins === m} onClick={() => setMinutes(m)}>{m} мин</button>
        ))}
      </div>
      <Row label="Уровень заданий" value={LEVEL_NAME[level]} data-testid="prof-level" data-level={level} />
      <div className="ds-faint" style={{ fontSize: 13, marginTop: 4 }}>{LEVEL_TEXT[level]}</div>
      <div style={{ marginTop: 12 }}>
        <Button small variant="secondary" icon={GraduationCap} data-testid="prof-placement" data-nav-target="run:placement" onClick={() => { Audio.prime(); onPlacement(); }}>
          {(learn.placement || {}).at ? 'Вступительный тест ещё раз' : 'Вступительный тест'}
        </Button>
      </div>
    </Card>
  );
}

/* Приглашение на вступительный тест — на Пути, если при регистрации выбрано «Кое-что знаю». */
export function PlacementCard({ onStart, onSkip }) {
  return (
    <Card style={{ margin: '0 0 14px', background: 'color-mix(in srgb, var(--u) 7%, var(--ds-card))' }} data-testid="placement-card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Rosette size={58} opacity={0.5}><GraduationCap size={26} color="var(--u-ink)" aria-hidden="true" /></Rosette>
        <div style={{ flex: 1 }}>
          <div className="ds-h3">Вступительный тест</div>
          <div className="ds-sub" style={{ fontSize: 14, lineHeight: 1.4 }}>Пять вопросов на юнит. Что знаете — откроется сразу, дальше Путь продолжится с нужного места.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small data-testid="placement-start" data-nav-target="run:placement" onClick={() => { Audio.prime(); onStart(); }}>Пройти тест</Button>
        <Button small variant="ghost" data-testid="placement-skip" onClick={onSkip}>Начать с начала</Button>
      </div>
    </Card>
  );
}
