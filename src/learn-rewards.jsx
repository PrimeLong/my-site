/* ЭКРАНЫ НАГРАД И ПРОГРАММЫ: кошелёк, лавка с курсом дня, задания дня и испытание месяца,
   сундук юнита, утренний экран серии, печати-достижения, «Моя программа» в профиле и
   приглашение на вступительный тест. Всё — из компонентов дизайн-системы (src/ds.jsx,
   src/ds-art.jsx); расчёты — в чистых модулях src/learn/rewards.js и src/learn/program.js. */
import React, { useState } from 'react';
import {
  ArrowLeft, X, Wallet, Snowflake, Shirt, Sunrise, Moon, PiggyBank, CalendarDays, Footprints, Check, Flame, Landmark, Shapes, GraduationCap,
  ScrollText, Timer, Map as MapIcon, Target, Coins, ShoppingBag, Vault, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Mascot } from './mascot.jsx';
import { Button, IconButton, Card, Heading, Row, Sheet, TopBar } from './ds.jsx';
import { Rosette, Stamp, CoinShower, CountUp, Guilloche } from './ds-art.jsx';
import {
  balance, rateOn, rateHistory, priceOf, buy, setWear, outfitOf, FREEZE, OUTFITS, SLOT_LABEL, questsFor, QUEST_ICON, monthChallenge, monthStamps,
  chestCoins, chestKey, hasClaim, openChest, achievementsOf, coinsWord, plural,
} from './learn/rewards.js';
import { skillLevel, LEVEL_NAME, LEVEL_TEXT } from './learn/program.js';
import {
  dayOf, addDays, streak, ownedFreezes, weekDots, MAX_FREEZES, setProfile, setGoal, PROFILE_GOALS, PROFILE_MINUTES, PROFILE_GOAL_LABEL, LESSONS_FOR_MINUTES,
} from './textbook/learn-state.js';

export const REWARD_CSS = `
  .rw-bar { height: 6px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .rw-bar > i { display: block; height: 100%; background: var(--u); border-radius: 3px; transition: width .3s ease-out; }
  .rw-bar.ok > i { background: var(--ds-ok); }
  .rw-quest { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 0; border-top: 1px dotted var(--ds-rule2); }
  .rw-quest:first-of-type { border-top: none; }
  .rw-ico { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--ds-rule2); color: var(--u-ink); background: var(--ds-card); }
  .rw-ico.ok { background: var(--ds-ok-btn); border-color: var(--ds-ok-btn); color: #fff; }
  .rw-coin { font: 700 13px var(--ds-mono); color: var(--ds-ink2); display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .rw-page { position: fixed; inset: 0; z-index: 250; overflow-y: auto; background: var(--ds-paper); padding: 8px 16px calc(40px + env(safe-area-inset-bottom)); }
  .rw-page-in { max-width: 560px; margin: 0 auto; }
  .rw-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .rw-item { border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); padding: 10px 10px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule); }
  .rw-item[data-on="true"] { box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--u); }
  .rw-price { font: 700 14px var(--ds-mono); }
  .rw-price small { font: 11.5px var(--ds-sans); color: var(--ds-ink3); margin-left: 4px; }
  .rw-dots { display: flex; justify-content: center; gap: 8px; }
  .rw-dot { width: 34px; display: flex; flex-direction: column; align-items: center; gap: 4px; font: 700 11px var(--ds-sans); color: var(--ds-ink3); }
  .rw-dot i { width: 26px; height: 26px; border-radius: 50%; border: 1.5px dashed var(--ds-rule2); display: flex; align-items: center; justify-content: center; }
  .rw-dot.done i { border: none; background: var(--ds-bad); color: #fff; }
  .rw-dot.frozen i { border: none; background: #3E6FA8; color: #fff; }
  .rw-dot.today { color: var(--ds-ink); }
  .rw-stamps { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px 6px; justify-items: center; }
  .rw-stamp { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  .rw-stamp[data-got="false"] { opacity: .38; filter: grayscale(1); }
  .rw-stamp b { font: 700 12px/1.2 var(--ds-serif); }
  .rw-stamp span { font: 11px/1.25 var(--ds-sans); color: var(--ds-ink3); }
  .rw-morning { position: fixed; inset: 0; z-index: 320; display: flex; flex-direction: column; background: var(--ds-paper); padding: 24px 20px calc(24px + env(safe-area-inset-bottom)); }
  .rw-morning-in { flex: 1; max-width: 460px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .rw-big { font: 700 64px/1 var(--ds-serif); color: var(--ds-bad); }
  .rw-flame { animation: rw-flame .9s ease-out 1 both; }
  @keyframes rw-flame { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
  .rw-chest-open { animation: ds-stamp .4s ease-out 1 both; }
  .rw-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .rw-rate { width: 100%; height: 64px; display: block; touch-action: none; }
  @media (prefers-reduced-motion: reduce) { .rw-flame, .rw-chest-open { animation: none; } .rw-bar > i { transition: none; } }
`;

const ACH_ICON = { footprints: Footprints, check: Check, flame: Flame, landmark: Landmark, shapes: Shapes, graduation: GraduationCap, scroll: ScrollText, shopping: ShoppingBag, shirt: Shirt, sunrise: Sunrise, moon: Moon, piggy: PiggyBank, calendar: CalendarDays };
const Q_ICON = { timer: Timer, map: MapIcon, check: Check, target: Target, coins: Coins, flame: Flame };
const fmtRate = (r) => r.toFixed(2).replace('.', ',');
const Bar = ({ have, target, ok }) => <div className={`rw-bar ${ok ? 'ok' : ''}`} role="presentation"><i style={{ width: `${Math.round((Math.min(have, target) / target) * 100)}%` }} /></div>;
const CoinTag = ({ n, testid }) => <span className="rw-coin" data-testid={testid}><Coins size={14} color="var(--ds-gold)" aria-hidden="true" />{n}</span>;

/* ------------------------------ КОШЕЛЁК ------------------------------ */
export function WalletStat({ learn, onOpen }) {
  const b = balance(learn);
  return (
    <button type="button" className="ln-stat" title="Монеты — в лавку" aria-label={`Монеты: ${b}. Открыть лавку`} data-testid="wallet" data-nav-target="shop"
      onClick={() => { Audio.play('coin'); onOpen(); }} style={{ cursor: 'pointer', color: 'inherit' }}>
      <Wallet size={17} color="var(--ds-gold)" aria-hidden="true" /><span data-testid="wallet-balance">{b}</span>
    </button>
  );
}

/* ------------------------------ ЗАДАНИЯ ДНЯ ------------------------------ */
export function QuestsCard({ learn, now = Date.now() }) {
  const quests = questsFor(learn, now);
  const m = monthChallenge(learn, now);
  const done = quests.filter((q) => q.done).length;
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid="quests">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="ds-h3">Задания дня</div>
        <span className="ds-num ds-faint" style={{ fontSize: 13 }} data-testid="quests-done">{done}/3</span>
      </div>
      <div style={{ marginTop: 4 }}>
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
                <div className="ds-num ds-faint" style={{ fontSize: 11.5 }}>{q.have}/{q.target}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--ds-rule2)', marginTop: 6, paddingTop: 10 }} data-testid="month" data-done={String(m.done)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CalendarDays size={16} color="var(--u-ink)" aria-hidden="true" />
          <span style={{ flex: 1, fontSize: 14 }}><b>Испытание месяца.</b> {m.title}</span>
          <CoinTag n={`+${m.coins}`} />
        </div>
        <Bar have={m.have} target={m.target} ok={m.done} />
        <div className="ds-faint" style={{ fontSize: 12, marginTop: 4 }}>
          {m.claimed ? `Выполнено — марка «${m.name}» в альбоме.` : `${m.have} из ${m.target} · ${m.daysLeft ? `осталось ${m.daysLeft} ${plural(m.daysLeft, 'день', 'дня', 'дней')}` : 'последний день'}`}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ ГРАФИК КУРСА ------------------------------
   Одна линия за 14 дней, пунктир — 1,0 (крона = монета). Касание или наведение — день и курс. */
function RateChart({ hist }) {
  const [hover, setHover] = useState(null);
  const W = 300; const H = 64; const pad = 6;
  const lo = Math.min(0.9, ...hist.map((h) => h.rate)); const hi = Math.max(1.1, ...hist.map((h) => h.rate));
  const x = (i) => pad + (i / (hist.length - 1)) * (W - pad * 2);
  const y = (r) => pad + (1 - (r - lo) / (hi - lo)) * (H - pad * 2);
  const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.rate).toFixed(1)}`).join(' ');
  const pick = (e) => { const b = e.currentTarget.getBoundingClientRect(); const k = Math.round(((e.clientX - b.left) / b.width) * (hist.length - 1)); setHover(Math.max(0, Math.min(hist.length - 1, k))); };
  const h = hover != null ? hist[hover] : null;
  const last = hist.length - 1;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="rw-rate" role="img" data-testid="rate-chart"
        aria-label={`Курс за ${hist.length} дней: от ${fmtRate(Math.min(...hist.map((q) => q.rate)))} до ${fmtRate(Math.max(...hist.map((q) => q.rate)))} монеты за крону, сегодня ${fmtRate(hist[last].rate)}`}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        <line x1={pad} x2={W - pad} y1={y(1)} y2={y(1)} stroke="var(--ds-rule2)" strokeWidth="1" strokeDasharray="3 4" />
        <polyline points={pts} fill="none" stroke="var(--u-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(hist[last].rate)} r="4" fill="var(--u-ink)" stroke="var(--ds-card)" strokeWidth="2" />
        {h && <><line x1={x(hover)} x2={x(hover)} y1={pad} y2={H - pad} stroke="var(--ds-ink3)" strokeWidth="1" /><circle cx={x(hover)} cy={y(h.rate)} r="4" fill="var(--u-ink)" stroke="var(--ds-card)" strokeWidth="2" /></>}
      </svg>
      {h && (
        <div className="ds-num" style={{ position: 'absolute', top: -6, left: `${Math.min(70, Math.max(0, (hover / last) * 100 - 12))}%`, background: 'var(--ds-ink)', color: 'var(--ds-paper)', fontSize: 12, padding: '3px 6px', borderRadius: 2, pointerEvents: 'none' }}>
          {h.day.slice(8)}.{h.day.slice(5, 7)} · {fmtRate(h.rate)}
        </div>
      )}
      <div className="ds-faint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span>две недели назад</span><span>пунктир — 1,00</span><span>сегодня</span></div>
    </div>
  );
}

/* ------------------------------ ЛАВКА ------------------------------ */
export function ShopView({ learn, update, onBack, now = Date.now() }) {
  const day = dayOf(now);
  const rate = rateOn(day); const prev = rateOn(addDays(day, -1));
  const [msg, setMsg] = useState(null);
  const b = balance(learn);
  const wear = outfitOf(learn);
  const freezes = ownedFreezes(learn);
  const Trend = rate > prev ? TrendingUp : rate < prev ? TrendingDown : Minus;
  const doBuy = (id) => {
    const r = buy(learn, id, now);
    if (!r.ok) { Audio.play('down'); setMsg({ ok: false, text: r.reason }); return; }
    Audio.play('register');
    update(() => r.s, { settle: true });
    setMsg({ ok: true, text: id === FREEZE.id ? `Заморозка куплена за ${r.price} ${coinsWord(r.price)}.` : `Куплено за ${r.price} ${coinsWord(r.price)} — Инфля уже в обновке.` });
  };
  const toggle = (o) => { Audio.play('paper'); update((s) => setWear(s, o.slot, wear[o.slot] === o.id ? null : o.id, now)); };
  return (
    <div className="rw-page" data-testid="shop" role="dialog" aria-label="Лавка">
      <div className="rw-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Лавка Инфли" />
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

        <Heading level={3} title="Заморозка серии" sub={FREEZE.text} />
        <Card style={{ margin: '8px 0 16px' }} data-testid="shop-freeze">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rosette size={54} opacity={0.5}><Snowflake size={24} color="#3E6FA8" aria-hidden="true" /></Rosette>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>В запасе: <span className="ds-num" data-testid="freeze-owned">{freezes}</span> из {MAX_FREEZES}</div>
              <div className="rw-price">{priceOf(FREEZE.id, day)} <span style={{ fontWeight: 400 }}>мон.</span><small>{FREEZE.crowns} кр.</small></div>
            </div>
            <Button small disabled={freezes >= MAX_FREEZES} onClick={() => doBuy(FREEZE.id)} data-testid="buy-freeze">Купить</Button>
          </div>
        </Card>

        <Heading level={3} title="Наряды Инфли" sub="По одному на голову, лицо и шею. Купленное можно снять и надеть снова." />
        {Object.keys(SLOT_LABEL).map((slot) => (
          <div key={slot} style={{ margin: '10px 0 14px' }}>
            <div className="ds-eyebrow" style={{ marginBottom: 6 }}>{SLOT_LABEL[slot]}</div>
            <div className="rw-items">
              {OUTFITS.filter((o) => o.slot === slot).map((o) => {
                const owned = !!(learn.owned || {})[o.id]; const on = wear[slot] === o.id; const price = priceOf(o.id, day);
                return (
                  <div key={o.id} className="rw-item" data-testid="shop-item" data-item={o.id} data-owned={String(owned)} data-on={String(on)}>
                    <Mascot mood="hello" size={50} outfit={{ [slot]: o.id }} label={`Инфля: ${o.title}`} />
                    <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{o.title}</div>
                    {owned
                      ? <Button small variant={on ? 'secondary' : 'primary'} onClick={() => toggle(o)}>{on ? 'Снять' : 'Надеть'}</Button>
                      : <><div className="rw-price">{price} <span style={{ fontWeight: 400 }}>мон.</span><small>{o.crowns} кр.</small></div>
                        <Button small variant="secondary" disabled={b < price} onClick={() => doBuy(o.id)}>Купить</Button></>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
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
          <Rosette size={120} opacity={0.5}><Vault size={52} color={opened || was ? 'var(--ds-gold)' : 'var(--u-ink)'} aria-hidden="true" /></Rosette>
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
   Один раз в день, при первом открытии: «Вы на N дней подряд», неделя и заморозки. */
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export function MorningStreak({ learn, onClose, now = Date.now() }) {
  const st = streak(learn, now);
  const hour = new Date(now).getHours();
  const hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const fr = ownedFreezes(learn);
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
              <i>{d.done ? <Flame size={14} aria-hidden="true" /> : d.frozen ? <Snowflake size={14} aria-hidden="true" /> : null}</i>{DOW[d.dow]}
            </div>
          ))}
        </div>
        <div className="ds-faint" style={{ fontSize: 13, marginTop: 14 }}>
          <Snowflake size={13} style={{ verticalAlign: -2 }} aria-hidden="true" /> Заморозок в запасе: {fr}. Один пропуск в неделю серию не рвёт и без них.
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
  const setMinutes = (m) => { Audio.play('tick'); update((s) => setGoal(setProfile(s, { minutes: m }), LESSONS_FOR_MINUTES[m])); };
  return (
    <Card style={{ margin: '12px 0' }} data-testid="prof-program">
      <div className="ds-h3" style={{ marginBottom: 8 }}>Моя программа</div>
      <div className="ds-eyebrow" style={{ marginBottom: 6 }}>Цель</div>
      <div className="rw-chip-row" role="group" aria-label="Цель">
        {PROFILE_GOALS.map((g) => <button key={g} type="button" className="ds-chip" aria-pressed={p.goal === g} onClick={() => { Audio.play('tick'); update((s) => setProfile(s, { goal: g })); }}>{PROFILE_GOAL_LABEL[g]}</button>)}
      </div>
      <div className="ds-eyebrow" style={{ margin: '12px 0 6px' }}>Минут в день · цель дня</div>
      <div className="rw-chip-row" role="group" aria-label="Минут в день">
        {PROFILE_MINUTES.map((m) => (
          <button key={m} type="button" className="ds-chip" aria-pressed={p.minutes === m || (!p.minutes && learn.goal === LESSONS_FOR_MINUTES[m])} onClick={() => setMinutes(m)}>
            {m} мин · {LESSONS_FOR_MINUTES[m]} {plural(LESSONS_FOR_MINUTES[m], 'урок', 'урока', 'уроков')}
          </button>
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
