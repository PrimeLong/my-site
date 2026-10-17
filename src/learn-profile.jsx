/* ПРОФИЛЬ (docs/mechanics.md, «Профиль»): личные рекорды, коллекции и статистика. Всё техническое —
   тема, звуки, музыка, цель дня, уведомления, аккаунт — под шестерёнкой в правом верхнем углу.

   Коллекции — альбом марок юнитов, печати-достижения и марки месяцев — в профиле коротким рядом:
   четыре марки и плитка «ещё N» со стрелкой. Полный список открывается поверх профиля: полученные и
   ещё не полученные. Под маркой — только её название; касание — марка крупно, за что дана, когда
   получена (или как получить), сколько монет принесла. Данные — src/learn/collections.js. */
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ChevronRight, Settings, Flame, Star, Trophy, Coins, ShieldCheck, Clock, BookOpen, CalendarDays, Target, Flag, UserRound, Lock, Check, Footprints, Landmark,
  Shapes, GraduationCap, ScrollText, ShoppingBag, Shirt, Sunrise, Moon, PiggyBank, Gem, Bell, Palette, X, Award,
  Snowflake, Heart, Flower2, Umbrella, Sprout, Sun, Waves, Wheat, Leaf, CloudRain, TreePine, UserPlus,
} from 'lucide-react';
import { Card, Button, IconButton, TopBar, Toggle, MenuCard, Heading, Sheet } from './ds.jsx';
import { Medal, Engraving, CountUp } from './ds-art.jsx';
import { StatHero, StatTile, Meter, DayBars } from './learn-stats.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { streak, longestStreak, bestWeek, learnStats, studyWeeks, goalToday, ownedFreezes } from './textbook/learn-state.js';
import { balance, policyActive, coinsWord, plural } from './learn/rewards.js';
import { albumItems, sealItems, monthItems, monthsByYear, shelfOrder, fullDate } from './learn/collections.js';
import { NOTIFY_KINDS, REMIND_HOURS } from './learn/notify.js';
import { ProgramCard } from './learn-rewards.jsx';
import { BellButton, browserNotifySupported } from './learn-notify.jsx';
import { learnDark, setLearnDark, learnMusic, setLearnMusic, learnSfx, setLearnSfx } from './ds-tokens.js';
import { ProfileModal, loadAccount } from './account.jsx';
import { reportsMe } from './lib/client.js';
import { PrivacyPage, PRIVACY_TITLE } from './privacy.jsx';
import { BUILD } from './learn-report.jsx';

export const PROFILE_CSS = `
  .pf-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .pf-head-btns { display: flex; gap: 8px; align-self: flex-start; margin-left: auto; }
  .pf-head-btns .nt-bell, .pf-gear { width: 44px; min-height: 44px; border-radius: 14px; }
  .pf-gear { flex: none; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink2); cursor: pointer; padding: 0; }
  .pf-gear svg { transition: transform .5s cubic-bezier(.3,1.4,.5,1); }
  .pf-gear:hover svg { transform: rotate(60deg); }
  .pf-gear:active { transform: scale(.92); }
  /* короткий ряд коллекции: четыре марки и плитка «ещё» */
  .pf-shelf-head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
  .pf-shelf-head .ds-h3 { flex: 1; }
  .pf-count { font: 700 12.5px var(--ds-mono); color: var(--ds-ink3); }
  .pf-all { display: inline-flex; align-items: center; gap: 2px; padding: 6px 4px 6px 10px; border: none; background: none; font: 700 14px var(--ds-sans); color: var(--u-ink); cursor: pointer; border-radius: 10px; }
  .pf-all:hover { background: var(--ds-card2); }
  .pf-all svg { transition: transform .2s; }
  .pf-all:hover svg { transform: translateX(3px); }
  .pf-track { height: 6px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; margin: 6px 0 12px; }
  .pf-track i { display: block; height: 100%; border-radius: 3px; background: var(--u); animation: pf-fill .9s cubic-bezier(.3,.8,.4,1) both; transform-origin: left; }
  @keyframes pf-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  .pf-shelf { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) 42px; gap: 4px; align-items: start; }
  .pf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 14px 8px; }
  .pf-item { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; padding: 4px 2px; border: none; background: none; cursor: pointer; font: inherit; color: inherit;
    border-radius: 14px; animation: pf-in .4s ease-out both; animation-delay: calc(min(var(--i, 0), 12) * 40ms); transition: transform .15s ease; }
  .pf-item:hover { transform: translateY(-2px); }
  .pf-item:active { transform: scale(.94); }
  .pf-item > b { font: 700 12px/1.2 var(--ds-head); text-align: center; overflow-wrap: break-word; hyphens: auto; max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .pf-item[data-got="false"] > b { color: var(--ds-ink2); font-weight: 600; }
  .pf-item:hover .pf-art { filter: drop-shadow(0 4px 6px var(--ds-shade)); }
  .pf-art { display: grid; place-items: center; transition: filter .2s; }
  .pf-more { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 66px; height: 100%; border: 2px dashed var(--ds-rule2); border-radius: 16px;
    background: none; cursor: pointer; color: var(--u-ink); font: 700 13px/1.2 var(--ds-sans); padding: 6px 2px; animation: pf-in .4s ease-out both; animation-delay: .2s; transition: background .15s, border-color .15s; }
  .pf-more:hover { background: var(--ds-card2); border-color: var(--u); }
  .pf-more b { font: 700 18px/1 var(--ds-head); }
  @keyframes pf-in { from { opacity: 0; transform: translateY(8px) scale(.94) } to { opacity: 1; transform: none } }
  /* марка-миниатюра: зубцы по краю, здание юнита; не полученная — блёклая */
  .pf-stamp { display: inline-block; padding: 4px; background-color: var(--ds-card); background-image: radial-gradient(circle, var(--ds-paper) 2.2px, transparent 2.6px);
    background-size: 8px 8px; background-position: -4px -4px; filter: drop-shadow(0 1px 1px var(--ds-shade)); }
  .pf-stamp > span { display: grid; place-items: center; width: 54px; height: 50px; border: 1.5px solid var(--u); background: var(--ds-card); overflow: hidden; }
  .pf-stamp.big { padding: 7px; background-image: radial-gradient(circle, var(--ds-paper) 3.2px, transparent 3.6px); background-size: 12px 12px; background-position: -6px -6px;
    filter: drop-shadow(0 3px 6px var(--ds-shade)); transform: rotate(-2deg); }
  .pf-stamp.big > span { width: 156px; height: 122px; border-width: 2px; }
  .pf-stamp[data-got="false"] { --u: var(--ds-rule2); }
  .pf-stamp[data-got="false"] > span > * { opacity: .42; filter: grayscale(1); }
  .pf-month { position: relative; }
  .pf-friends { display: flex; align-items: center; gap: 12px; width: 100%; margin: 12px 0 0; padding: 10px 14px; }
  .pf-friends-stack { display: flex; align-items: center; min-width: 52px; }
  .pf-friends-stack > span { margin-left: -12px; display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--ds-card2); box-shadow: 0 0 0 2px var(--ds-card); animation: pf-in .4s ease-out both; animation-delay: calc(var(--k, 0) * 80ms); }
  .pf-friends-stack > span:first-child { margin-left: 0; }
  .pf-friends-plus { color: var(--u-ink); background: color-mix(in srgb, var(--u) 12%, var(--ds-card)) !important; }
  /* марка месяца: у каждого месяца свой цвет и рисунок; пропущенный месяц — блёклый, нынешний — пунктиром с прогрессом */
  .pf-mstamp > span { position: relative; background: var(--u); border-color: color-mix(in srgb, var(--u) 70%, #000); }
  .pf-mstamp > span svg { display: block; }
  .pf-mstamp[data-state="current"] > span { background: var(--ds-card); border-style: dashed; }
  .pf-mstamp[data-state="current"] > span > * { opacity: 1; filter: none; }
  .pf-mstamp[data-state="missed"] > span { background: var(--ds-card2); }
  .pf-mstamp[data-state="got"] { animation: pf-shine 4s ease-in-out infinite; }
  @keyframes pf-shine { 0%, 80%, 100% { filter: drop-shadow(0 1px 1px var(--ds-shade)) } 90% { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--u) 60%, transparent)) } }
  .pf-year { display: flex; align-items: baseline; gap: 10px; margin: 18px 0 8px; }
  .pf-year b { font: 700 22px var(--ds-head); }
  .pf-year span { color: var(--ds-ink2); font-size: 14px; }
  /* крупная марка в шторке: «оттиск» — падает с небольшим поворотом */
  .pf-big { display: flex; justify-content: center; margin: 4px 0 10px; animation: pf-press .5s cubic-bezier(.3,1.5,.5,1) both; }
  @keyframes pf-press { 0% { transform: scale(1.5) rotate(-10deg); opacity: 0 } 60% { transform: scale(.95) rotate(2deg); opacity: 1 } 100% { transform: none } }
  .pf-sheet-title { font: 700 22px/1.2 var(--ds-head); text-align: center; }
  .pf-sheet-text { text-align: center; color: var(--ds-ink2); font-size: 15px; line-height: 1.45; margin: 6px 0 12px; }
  .pf-facts { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 14px; }
  .pf-fact { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--ds-card2); font-size: 14.5px; }
  .pf-fact svg { flex: none; color: var(--u-ink); }
  .pf-fact b { font-weight: 700; }
  /* настройки: группы карточек со строками-переключателями */
  .pf-set { margin: 12px 0; }
  .pf-set-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .pf-set-title span { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--t) 14%, var(--ds-card)); color: var(--t); }
  .ds-dark .pf-set-title span { color: color-mix(in srgb, var(--t) 50%, #fff); }
  .pf-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px dotted var(--ds-rule2); }
  .pf-row:last-child { border-bottom: none; }
  .pf-row > span { flex: 1; min-width: 0; }
  .pf-row small { display: block; font-size: 13px; color: var(--ds-ink3); line-height: 1.35; }
  .pf-hours { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 8px; }
  .pf-hours .ds-chip { margin: 0; min-width: 58px; }
  .pf-version { text-align: center; font: 12px var(--ds-mono); color: var(--ds-ink3); margin: 18px 0 4px; }
  @media (prefers-reduced-motion: reduce) { .pf-item, .pf-more, .pf-big, .pf-track i, .pf-mstamp { animation: none !important; } .pf-gear svg, .pf-all svg { transition: none !important; } }
`;

const ACH_ICON = { footprints: Footprints, check: Check, flame: Flame, landmark: Landmark, shapes: Shapes, graduation: GraduationCap, scroll: ScrollText, shopping: ShoppingBag, shirt: Shirt, sunrise: Sunrise, moon: Moon, piggy: PiggyBank, calendar: CalendarDays, gem: Gem, flag: Flag };
const KIND = {
  album: { title: 'Альбом', page: 'Альбом марок', sub: 'Пройденный юнит — марка с его зданием.', word: ['марка', 'марки', 'марок'], testid: 'album-page' },
  seal: { title: 'Печати', page: 'Печати', sub: 'Достижения — оттиски печатей; за каждую — монеты.', word: ['печать', 'печати', 'печатей'], testid: 'achievements' },
  month: { title: 'Марки месяцев', page: 'Марки месяцев', sub: 'У каждого месяца — своя марка: выполните испытание месяца, пока он идёт.', word: ['марка', 'марки', 'марок'], testid: 'months-page' },
};

/* Марка месяца — почтовая марка с зубцами: сокращение месяца сверху, рисунок месяца, год внизу.
   Подписи — внутри рисунка (масштабируются вместе с ним). */
const MONTH_ART = [
  [Snowflake, '#2F6E9E'], [Heart, '#A33A5E'], [Flower2, '#8A4FA0'], [Umbrella, '#2E6B8A'], [Sprout, '#4B7A1E'], [Sun, '#C27A12'],
  [Waves, '#1F7A8C'], [Wheat, '#A5701A'], [BookOpen, '#8A5A2B'], [Leaf, '#B4531A'], [CloudRain, '#5A6E8C'], [TreePine, '#2E6B4A'],
];
const MONTH_ABBR = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
function MonthStamp({ it, big = false }) {
  const [Icon, color] = MONTH_ART[it.month - 1];
  const state = it.got ? 'got' : it.current ? 'current' : 'missed';
  const ink = state === 'got' ? '#fff' : state === 'current' ? color : 'var(--ds-ink3)';
  const share = it.progress ? Math.min(1, it.progress.have / Math.max(1, it.progress.total)) : 0;
  return (
    <span className={`pf-stamp pf-mstamp${big ? ' big' : ''}`} style={state === 'missed' ? undefined : { '--u': color }} data-got={String(it.got)} data-state={state}>
      <span>
        <svg viewBox="0 0 54 50" width={big ? 156 : 54} height={big ? 122 : 50} role="img" aria-label={`${it.title} ${it.year}: ${state === 'got' ? 'получена' : state === 'current' ? 'испытание идёт' : 'не получена'}`}>
          <text x="27" y="11" textAnchor="middle" fontSize="8" fontWeight="700" letterSpacing=".8" fill={ink} fontFamily="var(--ds-head)">{MONTH_ABBR[it.month - 1]}</text>
          <Icon x={17} y={14} width={20} height={20} color={ink} strokeWidth={state === 'got' ? 2.2 : 1.8} />
          {state === 'current' ? (
            <g><rect x="11" y="40" width="32" height="3.5" rx="1.75" fill="var(--ds-rule)" /><rect x="11" y="40" width={Math.max(2, 32 * share)} height="3.5" rx="1.75" fill={color} /></g>
          ) : <text x="27" y="45" textAnchor="middle" fontSize="6.5" fontWeight="700" fill={ink} opacity=".9" fontFamily="var(--ds-mono)">{it.year}</text>}
        </svg>
      </span>
    </span>
  );
}

// рисунок марки любого вида: здание юнита, печать или марка месяца
function Art({ it, big = false }) {
  if (it.kind === 'month' && it.month) return <MonthStamp it={it} big={big} />;
  if (it.kind === 'album') {
    if (big) {
      return (
        <span className="pf-stamp big" style={{ '--u': it.color }} data-got={String(it.got)}>
          <span><Engraving kind={it.building} alive={it.got} size={132} color={it.color} label={`${it.title}${it.got ? '' : ', ещё не получена'}`} /></span>
        </span>
      );
    }
    return (
      <span className="pf-stamp" style={{ '--u': it.color }} data-got={String(it.got)}>
        <span><Engraving kind={it.building} alive={it.got} size={52} color={it.color} label={`${it.title}${it.got ? '' : ', ещё не получена'}`} /></span>
      </span>
    );
  }
  const Icon = it.kind === 'month' ? CalendarDays : ACH_ICON[it.icon] || Award;
  const size = big ? 128 : 56;
  return <Medal icon={<Icon size={24} strokeWidth={it.got ? 2.2 : 1.8} />} got={it.got} color={it.kind === 'month' ? 'var(--ds-gold)' : 'var(--u)'} size={size}
    label={`${it.title}: ${it.got ? 'получена' : 'ещё не получена'}`} />;
}

// одна марка ряда или списка: рисунок и под ним только название
function Item({ it, i, onOpen, testid }) {
  return (
    <button type="button" className="pf-item" style={{ '--i': i }} data-testid={testid} data-ach={it.kind === 'seal' ? it.id : undefined} data-item={it.id} data-got={String(it.got)}
      aria-label={`${it.full || it.title}${it.got ? '' : it.current ? ' — испытание идёт' : it.missed ? ' — не получена' : ' — ещё не получена'}. Подробнее`} onClick={() => { Audio.play('paper'); onOpen(it); }}>
      <span className="pf-art"><Art it={it} /></span>
      <b>{it.title}</b>
    </button>
  );
}

/* Шторка марки: крупно, за что, когда получена (или как получить и сколько осталось), монеты. */
export function ItemSheet({ it, onClose }) {
  const k = KIND[it.kind];
  return (
    <Sheet label={it.title} onClose={onClose} testid="item-sheet">
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-8px -8px 0 0' }}><IconButton label="Закрыть" icon={X} data-nav="back" onClick={onClose} size={22} /></div>
      <div className="ds-eyebrow" style={{ textAlign: 'center' }}>{it.kind === 'month' && it.year ? `Марка месяца · ${it.year}` : k.title}{it.kind === 'album' ? ` · юнит ${it.no}` : ''}</div>
      <div className="pf-big" key={it.id}><Art it={it} big /></div>
      <div className="pf-sheet-title">{it.title}</div>
      <div className="pf-sheet-text" data-testid="item-text">{it.text}</div>
      <div className="pf-facts">
        {it.got ? (
          <div className="pf-fact" data-testid="item-date"><CalendarDays size={20} aria-hidden="true" /><span>{it.at ? <>Получена <b>{fullDate(it.at)}</b></> : 'Получена'}</span></div>
        ) : (
          <div className="pf-fact" data-testid="item-how"><Lock size={20} aria-hidden="true" /><span><b>{it.current ? 'Испытание идёт.' : it.missed ? 'Не получена.' : 'Ещё не получена.'}</b> {it.how}</span></div>
        )}
        {it.progress && !it.got && (
          <div className="pf-track" style={{ margin: '0 4px' }} role="progressbar" aria-valuemin={0} aria-valuemax={it.progress.total} aria-valuenow={it.progress.have} aria-label="Сколько уже сделано">
            <i style={{ width: `${Math.round((Math.min(it.progress.have, it.progress.total) / Math.max(1, it.progress.total)) * 100)}%` }} />
          </div>
        )}
        {it.coins ? <div className="pf-fact"><Coins size={20} color="var(--ds-gold)" aria-hidden="true" /><span>{it.got ? 'Принесла' : 'Принесёт'} <b>{it.coins} {coinsWord(it.coins)}</b></span></div> : null}
      </div>
      <Button wide onClick={onClose}>Хорошо</Button>
    </Sheet>
  );
}

/* Короткий ряд коллекции в профиле: заголовок, «N из M», полоса, четыре марки и «ещё». */
function Shelf({ kind, items, onAll, onOpen, testid, itemTestid, children = null }) {
  const k = KIND[kind];
  const got = items.filter((x) => x.got).length;
  const order = shelfOrder(items);
  const show = order.slice(0, 4);
  const more = items.length - show.length;
  return (
    <Card style={{ margin: '12px 0' }} data-testid={testid}>
      <div className="pf-shelf-head">
        <div className="ds-h3">{k.title}</div>
        <span className="pf-count" data-testid={`${testid}-count`}>{got} из {items.length}</span>
        <button type="button" className="pf-all" data-testid={`${testid}-all`} data-nav-target={`collection:${kind}`} onClick={() => { Audio.play('paper'); onAll(); }}>
          Все<ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="ds-sub" style={{ fontSize: 13.5 }}>{k.sub}</div>
      <div className="pf-track" aria-hidden="true"><i style={{ width: `${Math.round((got / Math.max(1, items.length)) * 100)}%` }} /></div>
      <div className="pf-shelf">
        {show.map((it, i) => <Item key={it.id} it={it} i={i} onOpen={onOpen} testid={itemTestid} />)}
        {more > 0 && (
          <button type="button" className="pf-more" aria-label={`Ещё ${more}: открыть весь список`} onClick={() => { Audio.play('paper'); onAll(); }}>
            <b>+{more}</b><ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

/* Весь список коллекции поверх профиля: сколько получено, полоса, полученные (свежие первыми) и
   ещё не полученные. Один «назад» — в профиль. */
export function CollectionPage({ kind, items, onBack }) {
  const k = KIND[kind];
  const [open, setOpen] = useState(null);
  const got = items.filter((x) => x.got).sort((a, b) => b.at - a.at);
  const rest = items.filter((x) => !x.got);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // окно марки — рядом со страницей: оно выше нижней панели вкладок, страница — ниже
  return (<>
    <div className={`nt-page${open ? ' nt-under' : ''}`} data-testid="collection" data-kind={kind} role="dialog" aria-label={k.page} inert={!!open}>
      <div className="nt-page-in" data-testid={k.testid}>
        <TopBar back={<IconButton label="Назад, в профиль" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />} title={k.page} />
        <div className="ds-sub" style={{ fontSize: 14.5 }}>{k.sub}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
          <span className="ds-num" style={{ font: '700 28px var(--ds-head)' }} data-testid="ach-got-count"><CountUp value={got.length} /></span>
          <span className="ds-sub">из {items.length} {plural(items.length, k.word[0], k.word[1], k.word[2])}</span>
        </div>
        <div className="pf-track"><i style={{ width: `${Math.round((got.length / Math.max(1, items.length)) * 100)}%` }} /></div>
        {kind === 'month' ? monthsByYear(items).map((g) => (
          <section key={g.year} data-testid="collection-year" data-year={g.year}>
            <div className="pf-year"><b>{g.year}</b><span>{g.items.filter((x) => x.got).length} из {g.items.length} {plural(g.items.length, 'марки', 'марок', 'марок')}</span></div>
            <div className="pf-grid">{g.items.map((it, i) => <Item key={it.id} it={it} i={i} onOpen={setOpen} testid="collection-item" />)}</div>
          </section>
        )) : <>
        {got.length > 0 ? (
          <div className="pf-grid" data-testid="collection-got">{got.map((it, i) => <Item key={it.id} it={it} i={i} onOpen={setOpen} testid={kind === 'seal' ? 'ach' : 'collection-item'} />)}</div>
        ) : <div className="ds-sub" style={{ fontSize: 14.5, margin: '8px 0' }}>Пока ни одной — первая уже близко.</div>}
        {rest.length > 0 && (
          <>
            <div className="nt-group" style={{ marginTop: 22 }}>Ещё не получены · {rest.length}</div>
            <div className="pf-grid rw-stamps-locked" data-testid="collection-locked">{rest.map((it, i) => <Item key={it.id} it={it} i={i + got.length} onOpen={setOpen} testid={kind === 'seal' ? 'ach' : 'collection-item'} />)}</div>
          </>
        )}
        </>}
      </div>
    </div>
    {open && <ItemSheet it={open} onClose={() => setOpen(null)} />}
  </>);
}

/* Четыре недели занятий: минуты по дням столбиками (цель — линия, сегодня — отметка), под ними
   три плитки — минуты, уроки, дни с занятиями — и точность с первого раза полосой: за те же
   четыре недели, «N из M» под полосой (docs/mechanics.md). */
export function StudyWeeks({ learn }) {
  const w = studyWeeks(learn);
  const goal = goalToday(learn).goal;
  return (
    <Card style={{ margin: '12px 0' }} data-testid="prof-stats">
      <div className="ds-h3" style={{ marginBottom: 2 }}>Последние четыре недели</div>
      <div className="ds-sub" style={{ fontSize: 13.5, marginBottom: 4 }}>Минуты занятий по дням. Нажмите на столбик — день, минуты и уроки.</div>
      <DayBars days={w.days.map((d) => ({ key: d.day, minutes: d.minutes, lessons: d.lessons, today: d.today, future: d.future }))} goal={goal} testid="prof-calendar" />
      <div className="st-grid three" style={{ marginTop: 14 }}>
        <StatTile icon={Clock} label="Минут" value={w.minutes} testid="prof-minutes" sub={w.active ? `≈ ${Math.round(w.minutes / w.active)} в день` : 'пока нет'} />
        <StatTile icon={BookOpen} label="Уроков" value={w.lessons} testid="prof-lessons" sub="пройдено" />
        <StatTile icon={CalendarDays} label="Дней" value={w.active} sub="с занятиями из 28" />
      </div>
      <Meter label="Верно с первого раза" share={w.accuracy} testid="prof-accuracy-meter"
        text={<b data-testid="prof-accuracy">{w.accuracy == null ? '—' : `${Math.round(w.accuracy * 100)}%`}</b>}
        note={w.accuracy == null ? 'Посчитаем после пяти ответов.' : `${w.right} из ${w.tried} ${plural(w.tried, 'первого ответа', 'первых ответов', 'первых ответов')} за четыре недели — повтор задачи не считается.`} />
    </Card>
  );
}

/* Друзья в профиле: Инфли друзей стопкой, сколько друзей и заявок; касание — страница «Друзья»
   (src/learn-friends.jsx). Без аккаунта — приглашение его завести. */
function FriendsEntry({ friends, guest, onOpen }) {
  const list = (friends && friends.friends) || [];
  const incoming = ((friends && friends.incoming) || []).length;
  const n = list.length;
  return (
    <button type="button" className="ds-card ds-card--button pf-friends" data-testid="prof-friends" data-nav-target="friends" onClick={onOpen}
      aria-label={guest ? 'Друзья — после регистрации' : `Друзья: ${n}${incoming ? `, заявок: ${incoming}` : ''}. Открыть`}>
      <span className="pf-friends-stack" aria-hidden="true">
        {list.slice(0, 3).map((f, k) => <span key={f.login} style={{ '--k': k }}><Mascot mood="hello" size={34} outfit={(f.card && f.card.wear) || {}} /></span>)}
        {!n && <span className="pf-friends-plus"><UserPlus size={20} /></span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>Друзья <b className="ds-num" data-testid="prof-friends-count">{n}</b>
          {incoming > 0 && <span className="fr-badge" data-testid="prof-friends-incoming">+{incoming}</span>}</span>
        <span className="ds-sub" style={{ display: 'block', fontSize: 13.5 }}>{guest ? 'Создайте аккаунт — и добавляйте друзей' : n ? 'Их успехи, профили и забеги' : 'Добавить друга по логину'}</span>
      </span>
      <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />
    </button>
  );
}

export function ProfileView({ learn, onOpenBook, onSettings, onNotify, unread = 0, friends = null, guest = false, onFriends = () => {} }) {
  const st = streak(learn); const stats = learnStats(learn);
  const bw = bestWeek(learn);
  const [page, setPage] = useState(null); // null | 'album' | 'seal' | 'month'
  const [open, setOpen] = useState(null);
  const arrow = <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />;
  const album = albumItems(learn);
  const seals = sealItems(learn);
  const months = monthItems(learn);
  const stampsDone = Object.keys(learn.lessons || {}).filter((id) => (learn.lessons[id] || {}).runs > 0).length;
  const lists = { album, seal: seals, month: months };
  return (
    <div className="ln-wrap" data-testid="learn-profile">
      <style>{PROFILE_CSS}</style>
      {/* пока поверх открыт список или марка, профиль под ними недоступен с клавиатуры и для чтения с экрана */}
      <div inert={!!page || !!open}>
      <div className="pf-head">
        <Mascot mood={st.days >= 3 ? 'joy' : 'hello'} size={52} />
        <Heading eyebrow="Профиль" title="Личные рекорды" sub="Ваш путь: серия, марки и печати." />
        <div className="pf-head-btns">
          <BellButton count={unread} onClick={onNotify} testid="prof-bell" />
          <button type="button" className="pf-gear" data-testid="prof-settings-open" data-nav-target="settings" aria-label="Настройки" title="Настройки" onClick={() => { Audio.play('paper'); onSettings(); }}>
            <Settings size={21} aria-hidden="true" />
          </button>
        </div>
      </div>
      <FriendsEntry friends={friends} guest={guest} onOpen={onFriends} />
      <Card style={{ margin: '12px 0' }} data-testid="prof-records">
        <div className="ds-h3" style={{ marginBottom: 2 }}>Рекорды</div>
        <StatHero icon={Flame} tone="#D9822B" value={st.days} testid="prof-streak" label={`${plural(st.days, 'день', 'дня', 'дней')} подряд — серия сейчас`}
          sub={`Рекорд — ${longestStreak(learn)} дн.${st.freezesUsed.length ? ` · прощено пропусков: ${st.freezesUsed.length}` : ''}`} />
        <div className="st-grid four">
          <StatTile icon={Star} tone="#B8860B" label="Всего опыта" value={stats.totalXp} />
          <StatTile icon={Trophy} tone="#9A6300" label="Лучшая неделя" value={bw.xp ? bw.xp : '—'} sub={bw.xp ? 'опыта' : 'ещё впереди'} />
          <StatTile icon={Coins} tone="#8A6416" label="Монет" value={balance(learn)} testid="prof-coins" sub="в кошельке" />
          <StatTile icon={ShieldCheck} tone="#2E5F8A" label="Страховка серии" value={policyActive(learn) ? 'есть' : ownedFreezes(learn) ? ownedFreezes(learn) : 'нет'}
            sub={policyActive(learn) ? 'полис действует' : ownedFreezes(learn) ? 'старых полисов' : 'в лавке'} />
        </div>
        <div className="ds-faint" style={{ fontSize: 13, marginTop: 8 }}>Один пропущенный день в неделю серию не обнуляет, второй — прощает «Страховка серии» из лавки.</div>
      </Card>

      <Shelf kind="album" items={album} testid="prof-album" itemTestid="album-stamp" onOpen={setOpen} onAll={() => setPage('album')}>
        <div className="ds-faint" style={{ fontSize: 13, marginTop: 8 }}>Каждый пройденный урок — печать в паспорте: их уже {stampsDone}.</div>
      </Shelf>
      <Shelf kind="seal" items={seals} testid="prof-seals" itemTestid="ach-mini" onOpen={setOpen} onAll={() => setPage('seal')} />
      <Shelf kind="month" items={months} testid="prof-months" itemTestid="month-mini" onOpen={setOpen} onAll={() => setPage('month')} />

      <StudyWeeks learn={learn} />
      <MenuCard icon={Target} tone="var(--ds-ok)" title="Мой прогресс в учебнике" data-testid="prof-book-stats" data-nav-target="book:stats" right={arrow} text="Разделы, точность, слабые темы и журнал занятий" onClick={() => { Audio.play('paper'); onOpenBook({ kind: 'stats' }); }} />
      </div>
      {page && <CollectionPage kind={page} items={lists[page]} onBack={() => setPage(null)} />}
      {open && <ItemSheet it={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ------------------------------ НАСТРОЙКИ ------------------------------
   Всё техническое — здесь: программа обучения (цель, минуты в день, вступительный тест), тема и звук,
   уведомления и напоминания, аккаунт и данные; владельцам — разбор сообщений и аналитика. */
function SetGroup({ icon: Icon, tone, title, children, testid }) {
  return (
    <Card className="pf-set" data-testid={testid}>
      <div className="pf-set-title" style={{ '--t': tone }}><span><Icon size={17} aria-hidden="true" /></span><div className="ds-h3">{title}</div></div>
      {children}
    </Card>
  );
}
function SetRow({ title, note = null, on, onChange, testid, disabled = false }) {
  return (
    <div className="pf-row">
      <span>{title}{note && <small>{note}</small>}</span>
      <Toggle on={on} label={title} onChange={onChange} data-testid={testid} disabled={disabled} />
    </div>
  );
}

export function SettingsView({ learn, update, notify, onBack, onThemeChange, onPlacement, onReports, onAnalytics }) {
  // владельцы (OWNER_LOGINS на сервере) видят сообщения об ошибках и аналитику
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    const a = loadAccount();
    if (!a) return undefined;
    let alive = true;
    reportsMe(a.token).then((r) => { if (alive) setOwner(!!r.owner); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [dark, setDark] = useState(learnDark);
  const [music, setMusic] = useState(learnMusic);
  const [sfx, setSfx] = useState(learnSfx);
  const [account, setAccount] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [perm, setPerm] = useState(() => (browserNotifySupported() ? Notification.permission : 'unsupported'));
  const arrow = <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />;
  const prefs = notify.prefs;
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const askBrowser = async (on) => {
    if (!on) { notify.setPrefs({ browser: false }); return; }
    if (!browserNotifySupported()) return;
    let p = Notification.permission;
    if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = Notification.permission; } }
    setPerm(p);
    notify.setPrefs({ browser: p === 'granted' });
    if (p === 'granted') Audio.play('coin');
  };
  // окна аккаунта и данных — рядом со страницей, а не внутри: страница ниже нижней панели вкладок,
  // окна — выше её
  return (<>
    <div className={`nt-page${account || privacy ? ' nt-under' : ''}`} data-testid="settings" role="dialog" aria-label="Настройки" inert={account || privacy}>
      <style>{PROFILE_CSS}</style>
      <div className="nt-page-in">
        <TopBar back={<IconButton label="Назад, в профиль" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />} title="Настройки" />

        <SetGroup icon={Palette} tone="#C2490B" title="Оформление и звук" testid="prof-settings">
          <SetRow title="Тёмная тема" note="Для обучения и «Мира»" on={dark} testid="prof-dark" onChange={(v) => { setLearnDark(v); setDark(v); onThemeChange(); }} />
          <SetRow title="Музыка в обучении" on={music} testid="prof-music" onChange={(v) => { setLearnMusic(v); setMusic(v); onThemeChange(); }} />
          <SetRow title="Звуки ответов" on={sfx} testid="prof-sfx" onChange={(v) => { setLearnSfx(v); setSfx(v); onThemeChange(); if (v) Audio.play('coin'); }} />
        </SetGroup>

        <ProgramCard learn={learn} update={update} onPlacement={onPlacement} />

        <SetGroup icon={Bell} tone="#9A6300" title="Уведомления" testid="prof-notify">
          {NOTIFY_KINDS.map((k) => (
            <SetRow key={k.id} title={k.title} note={k.text} on={prefs[k.id] !== false} testid={`notify-${k.id}`} onChange={(v) => { Audio.play('tick'); notify.setPrefs({ [k.id]: v }); }} />
          ))}
          <div className="pf-row" style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: 6 }}>Напоминать о серии с<small>Если к этому часу сегодня ещё не было урока</small></span>
            <div className="pf-hours" role="group" aria-label="Час напоминания">
              {REMIND_HOURS.map((h) => <button key={h} type="button" className="ds-chip" aria-pressed={prefs.remindAt === h} data-hour={h} onClick={() => { Audio.play('tick'); notify.setPrefs({ remindAt: h }); }}>{h}:00</button>)}
            </div>
          </div>
          <SetRow title="Напоминания в браузере" testid="notify-browser" on={!!prefs.browser && perm === 'granted'} disabled={perm === 'unsupported'} onChange={askBrowser}
            note={perm === 'unsupported' ? 'Этот браузер не умеет показывать уведомления.'
              : perm === 'denied' ? 'Браузер запретил уведомления для сайта — разрешите их в настройках браузера.'
                : 'Придут, пока вкладка Инфляции открыта, даже в фоне: серия ждёт урока, обогнали в лиге, урожай созрел.'} />
        </SetGroup>

        <SetGroup icon={UserRound} tone="#65408F" title="Аккаунт и данные">
          <MenuCard icon={UserRound} tone="#65408F" title="Аккаунт" data-testid="prof-account" data-nav-target="account" right={arrow} text="Имя, значок, пароль, выход; имя в лигах; скачать или удалить свои данные" onClick={() => { Audio.play('paper'); setAccount(true); }} />
          <MenuCard icon={ShieldCheck} tone="var(--ds-ink2)" title={PRIVACY_TITLE} data-testid="prof-privacy" right={arrow} text="Что хранится, где, зачем и сколько" onClick={() => { Audio.play('paper'); setPrivacy(true); }} />
        </SetGroup>
        {owner && (
          <SetGroup icon={Flag} tone="#BF3A2B" title="Для команды">
            <MenuCard icon={Flag} tone="var(--ds-bad)" title="Сообщения об ошибках" data-testid="prof-reports" data-nav-target="reports" right={arrow}
              text="Что заметили ученики: новые и разобранные, «скопировать всё», разбор пачкой по id" onClick={() => { Audio.play('paper'); onReports(); }} />
            <MenuCard icon={Target} tone="var(--u-ink)" title="Аналитика" data-testid="prof-analytics" data-nav-target="analytics" right={arrow}
              text="Воронка за 30 дней и 20 самых трудных упражнений — без персональных данных" onClick={() => { Audio.play('paper'); onAnalytics(); }} />
          </SetGroup>
        )}
        <div className="pf-version">Инфляция · версия {BUILD}</div>
      </div>
    </div>
    {account && <div data-testid="account" style={{ display: 'contents' }}><ProfileModal onClose={() => setAccount(false)} onSwitched={() => setAccount(false)} /></div>}
    {privacy && <PrivacyPage onClose={() => setPrivacy(false)} />}
  </>);
}
