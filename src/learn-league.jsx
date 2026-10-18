/* ЛИГИ НЕДЕЛИ — вкладка «Лиги» (правила — src/learn/league.js, docs/mechanics.md «Лиги недели»).
   Наверху медаль лиги, место и что нужно сейчас; итоги прошлой недели и награда — отдельной
   карточкой, «Забрать» открывает окно вручения; лестница всех семи лиг; таблица группы,
   разделённая на три зоны: повышение, «остаётесь в лиге», понижение. В воскресенье — перерыв. */
import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Minus, ChevronDown, Lock, Coffee, X, Hourglass } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, Card, Sheet, IconButton } from './ds.jsx';
import { LEAGUE_BY_ID, LEAGUES, PROMOTE, GROUP, DEMOTE, PLACE_COINS, leagueState, claimLeague, pendingRewards } from './learn/league.js';
import { coinsWord, plural } from './learn/rewards.js';
import { loadAccount, accountKidsMode } from './account.jsx';
import { accountLeagueNames } from './lib/client.js';
import { dayOf } from './textbook/learn-state.js';
import { newsDate } from './learn/news.js';
import { CoinShower } from './ds-art.jsx';

const LEAGUE_CSS = `
  .lg-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: center; }
  .lg-hero h1 { font: 700 24px/1.15 var(--ds-head); margin: 2px 0 4px; }
  .lg-place { font: 700 15px var(--ds-sans); color: var(--ds-ink); }
  .lg-when { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font: 700 13px var(--ds-sans); padding: 3px 10px; border-radius: 999px; background: var(--ds-card2); color: var(--ds-ink2); }
  .lg-goal { margin: 14px 0 0; padding: 12px 14px; border-radius: 8px; border: 1.5px solid var(--ds-rule2); background: var(--ds-card); }
  .lg-goal.up { border-color: var(--ds-ok); background: color-mix(in srgb, var(--ds-ok) 8%, var(--ds-card)); }
  .lg-goal.down { border-color: var(--ds-bad); background: color-mix(in srgb, var(--ds-bad) 7%, var(--ds-card)); }
  .lg-goal b { font-size: 16px; }
  .lg-bar { height: 10px; border-radius: 6px; background: var(--ds-rule); overflow: hidden; margin-top: 8px; }
  .lg-bar span { display: block; height: 100%; border-radius: 6px; background: var(--ds-ok); transition: width .5s; }
  .lg-ladder { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 4px 0 8px; }
  @media (min-width: 560px) { .lg-ladder { grid-template-columns: repeat(7, minmax(0, 1fr)); } }
  .lg-tier { min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px 6px; border-radius: 8px; text-align: center; font: 700 12px/1.2 var(--ds-sans); color: var(--ds-ink2); }
  .lg-tier[data-state="now"] { background: var(--ds-sel); color: var(--ds-sel-ink); box-shadow: inset 0 0 0 2px var(--ds-sel-rule); }
  .lg-tier[data-state="locked"] { color: var(--ds-ink3); }
  .lg-tier small { font: 400 12px var(--ds-sans); }
  .lg-zone-head { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; font: 700 13px var(--ds-sans); letter-spacing: .03em; text-transform: uppercase; }
  .lg-zone-head span:last-child { margin-left: auto; font: 400 12.5px var(--ds-sans); text-transform: none; letter-spacing: 0; color: var(--ds-ink3); }
  .lg-zone-head.up { color: var(--ds-ok); } .lg-zone-head.down { color: var(--ds-bad); } .lg-zone-head.stay { color: var(--ds-ink2); }
  .lg-rows { list-style: none; margin: 0; padding: 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--ds-rule2); }
  /* колонка опыта одной ширины во всех строках: иначе дорожка полоски была разной длины и 94 выглядело дальше 97 */
  .lg-row { display: grid; grid-template-columns: 30px 30px minmax(0, 1fr) 80px; gap: 8px; align-items: center; padding: 7px 10px 7px 8px; background: var(--ds-card); border-top: 1px solid var(--ds-rule); position: relative; }
  .lg-row:first-child { border-top: none; }
  .lg-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--zone, transparent); }
  .lg-row.me { background: var(--ds-sel); color: var(--ds-sel-ink); }
  .lg-row { animation: lg-in .35s ease-out both; animation-delay: calc(min(var(--i, 0), 20) * 22ms); }
  .lg-row.me { animation: lg-in .35s ease-out both, lg-glow 1.6s ease-out .6s 1; animation-delay: calc(min(var(--i, 0), 20) * 22ms), .7s; }
  @keyframes lg-in { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }
  @keyframes lg-glow { 0% { box-shadow: inset 0 0 0 0 var(--u) } 30% { box-shadow: inset 0 0 0 2px var(--u) } 100% { box-shadow: inset 0 0 0 0 transparent } }
  .lg-row.me .lg-name { font-weight: 800; }
  .lg-no { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 13px var(--ds-mono); color: var(--ds-ink2); }
  .lg-no.medal { color: #fff; box-shadow: inset 0 0 0 2px rgba(255,255,255,.4); }
  .lg-ava { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font: 700 13px var(--ds-sans); }
  .lg-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
  .lg-xpbar { height: 4px; border-radius: 2px; background: var(--ds-rule); margin-top: 4px; overflow: hidden; }
  .lg-xpbar span { display: block; height: 100%; background: var(--zone-bar, var(--ds-ink3)); opacity: .7; }
  .lg-xp { font: 700 14px var(--ds-mono); text-align: right; white-space: nowrap; }
  .lg-xp small { display: block; font: 700 12px var(--ds-sans); color: var(--ds-gold, #9a6300); }
  .lg-reward { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; margin: 14px 0 0; padding: 12px; border-radius: 10px; border: 2px solid var(--ds-gold, #9a7413);
    background: color-mix(in srgb, var(--ds-gold, #9a7413) 10%, var(--ds-card)); }
  .lg-rules { margin-top: 16px; }
  .lg-rules summary { cursor: pointer; font: 700 15px var(--ds-sans); padding: 6px 0; }
  .lg-rules ul { margin: 6px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.5; }
  .lg-rest { display: flex; gap: 10px; align-items: center; }
  /* ждём понедельника: песочные часы покачиваются, места группы — пустые кружки, которые «занимаются» по очереди */
  .lg-wait { border-color: color-mix(in srgb, var(--u) 50%, var(--ds-rule2)); background: color-mix(in srgb, var(--u) 6%, var(--ds-card)); }
  .lg-wait-ico { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--u-ink); background: color-mix(in srgb, var(--u) 14%, var(--ds-card)); animation: lg-tilt 2.6s ease-in-out infinite; }
  @keyframes lg-tilt { 0%, 70%, 100% { transform: rotate(0) } 80% { transform: rotate(180deg) } }
  .lg-wait-seats { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; max-width: 260px; margin: 4px auto 10px; }
  .lg-wait-seats i { aspect-ratio: 1; border-radius: 50%; border: 1.5px dashed var(--ds-rule2); animation: lg-seat 3s ease-in-out infinite; animation-delay: calc(var(--i) * 120ms); }
  @keyframes lg-seat { 0%, 60%, 100% { background: transparent } 30% { background: color-mix(in srgb, var(--u) 30%, transparent); border-color: transparent } }
  @media (prefers-reduced-motion: reduce) { .lg-wait-ico, .lg-wait-seats i { animation: none; } }
`;
const NAMES_KEY = 'ems-league-names';
/* Имена учеников, разрешивших показ в лигах: раз в день с сервера, хранятся на устройстве.
   В детском режиме и без входа — только боты. */
function useLeagueNames() {
  const [names, setNames] = useState(() => {
    try { const c = JSON.parse(localStorage.getItem(NAMES_KEY) || 'null'); return c && Array.isArray(c.names) ? c.names : []; } catch { return []; }
  });
  useEffect(() => {
    const a = loadAccount();
    if (!a || accountKidsMode(a)) { setNames([]); return undefined; }
    let alive = true;
    const today = dayOf(Date.now());
    try { const c = JSON.parse(localStorage.getItem(NAMES_KEY) || 'null'); if (c && c.day === today) return undefined; } catch { /* нет хранилища */ }
    accountLeagueNames(a.token).then((r) => {
      if (!alive || !r || !Array.isArray(r.names)) return;
      setNames(r.names);
      try { localStorage.setItem(NAMES_KEY, JSON.stringify({ day: today, names: r.names })); } catch { /* приватный режим */ }
    }).catch(() => { /* нет сети — играем с ботами */ });
    return () => { alive = false; };
  }, []);
  return names;
}
const placeWord = (n) => `${n}-е место`;
const inLeague = (id) => `${LEAGUE_BY_ID[id].title.replace(/ая$/, 'ой')} лиге`;
const toLeague = (id) => `${LEAGUE_BY_ID[id].title.replace(/ая$/, 'ую')}`;
const MEDAL = ['#C9A227', '#9AA3AD', '#B0703A'];

/* Медаль лиги: щит в цвете лиги с ободком; в середине — звёзды по номеру ступени (до трёх) или
   огранённый камень у трёх старших лиг. locked — ещё не открытая лига, бесцветная. */
export function LeagueBadge({ id, size = 56, locked = false, label = null }) {
  const lg = LEAGUE_BY_ID[id]; const tier = LEAGUES.findIndex((l) => l.id === id);
  const fill = locked ? '#B9B2A2' : lg.color;
  const gid = `lgb-${id}-${locked ? 'l' : 'o'}`;
  const stars = tier < 4 ? Array.from({ length: Math.min(3, tier + 1) }, (_, k) => k) : [];
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 64 72" role="img" aria-label={label || `${lg.title} лига`} data-testid="league-badge" data-league={id}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M32 2 L60 12 V35 C60 53 47 63 32 70 C17 63 4 53 4 35 V12 Z" fill={fill} stroke="rgba(0,0,0,.25)" strokeWidth="1.2" />
      <path d="M32 8 L54 16 V35 C54 49 44 57 32 63 C20 57 10 49 10 35 V16 Z" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
      <path d="M32 2 L60 12 V35 C60 53 47 63 32 70 C17 63 4 53 4 35 V12 Z" fill={`url(#${gid})`} />
      {tier >= 4 ? (
        <g transform="translate(32 34)">
          <path d="M-11 -5 L-6 -11 H6 L11 -5 L0 12 Z" fill="rgba(255,255,255,.92)" />
          <path d="M-11 -5 H11 M-6 -11 L-3 -5 L0 12 M6 -11 L3 -5 L0 12" stroke={fill} strokeWidth="1.1" fill="none" />
        </g>
      ) : (
        <g>
          {stars.map((k) => {
            const n = stars.length; const x = 32 + (k - (n - 1) / 2) * 13; const y = n === 3 && k === 1 ? 30 : 34;
            return <path key={k} transform={`translate(${x} ${y}) scale(${n === 1 ? 1.4 : 0.95})`} d="M0 -8 L2.4 -2.5 L8 -2.5 L3.5 1.2 L5.2 7 L0 3.6 L-5.2 7 L-3.5 1.2 L-8 -2.5 L-2.4 -2.5 Z" fill="rgba(255,255,255,.92)" />;
          })}
        </g>
      )}
      {locked && <g transform="translate(32 52)"><circle r="7" fill="rgba(0,0,0,.35)" /><path d="M-3 -1 V-3 A3 3 0 0 1 3 -3 V-1 M-4 -1 H4 V4 H-4 Z" fill="none" stroke="#fff" strokeWidth="1.4" /></g>}
    </svg>
  );
}

// окно вручения награды: медаль лиги, место, переход и монеты
function RewardSheet({ got, onClose }) {
  const last = got.weeks[got.weeks.length - 1];
  return (
    <Sheet label="Итоги недели" onClose={onClose} testid="league-reward-sheet">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginRight: -8 }}><IconButton label="Закрыть" icon={X} onClick={onClose} size={22} /></div>
      <div style={{ textAlign: 'center' }}>
        <CoinShower seed={got.coins} n={18} />
        <div className="ds-eyebrow">Итоги {got.weeks.length > 1 ? 'прошлых недель' : 'недели'}</div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 6px' }}><LeagueBadge id={last.league} size={92} /></div>
        <div className="ds-h2" style={{ margin: '4px 0' }}>{placeWord(last.place)} в {inLeague(last.league)}</div>
        {last.move === 'up' && <div style={{ color: 'var(--ds-ok)', fontWeight: 700 }}>Повышение: теперь {LEAGUE_BY_ID[last.to].title.toLowerCase()} лига</div>}
        <div className="ds-num" style={{ font: '700 34px var(--ds-mono)', margin: '10px 0 2px' }} data-testid="league-msg">+{got.coins} {coinsWord(got.coins)}</div>
        <div className="ds-sub" style={{ fontSize: 14.5, margin: '0 0 14px' }}>Монеты уже в кошельке.</div>
        <Button wide onClick={onClose} data-testid="league-reward-ok">Отлично</Button>
      </div>
    </Sheet>
  );
}

// что нужно сейчас — одной карточкой: до повышения, удержаться, выбраться из понижения
function GoalCard({ st }) {
  const lg = LEAGUE_BY_ID[st.league];
  // пришли посреди недели: соперники набирают опыт с понедельника — начнём честно, с нуля
  if (st.waiting) {
    return (
      <div className="lg-goal lg-wait" data-testid="league-goal" data-kind="wait">
        <div className="lg-rest"><span className="lg-wait-ico" aria-hidden="true"><Hourglass size={20} /></span>
          <div><b>Ваша первая неделя лиги — с понедельника, {newsDate(st.startsOn)}</b>
            <div style={{ fontSize: 14, marginTop: 2 }}>Эта неделя уже идёт: соперники набирают опыт с понедельника. Чтобы всё было честно, вы начнёте вместе со всеми — в группе из {GROUP} учеников Бронзовой лиги. А пока проходите уроки на Пути — серия, задания дня и копилка уже работают.</div>
          </div>
        </div>
      </div>
    );
  }
  if (st.rest) {
    const h = st.history[st.history.length - 1];
    const moved = h && h.week === st.week ? h : null;
    return (
      <div className={`lg-goal ${moved && moved.move === 'up' ? 'up' : moved && moved.move === 'down' ? 'down' : ''}`} data-testid="league-goal" data-kind="rest">
        <div className="lg-rest"><Coffee size={22} aria-hidden="true" />
          <div><b>Перерыв: итоги недели подведены</b>
            <div style={{ fontSize: 14, marginTop: 2 }}>
              {moved ? (moved.move === 'up' ? `${placeWord(moved.place)} — повышение в ${toLeague(moved.to)} лигу.` : moved.move === 'down' ? `${placeWord(moved.place)} — понижение в ${toLeague(moved.to)} лигу.` : `${placeWord(moved.place)} — остаётесь в ${inLeague(moved.league)}.`) : 'На этой неделе вас не было в лиге.'}
              {' '}Новая неделя лиги — с понедельника.
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!st.joined) return <div className="lg-goal" data-testid="league-goal" data-kind="join"><b>Пройдите урок — и вы в лиге</b><div style={{ fontSize: 14, marginTop: 2 }}>Место — по опыту за неделю, с понедельника по субботу.</div></div>;
  const me = st.me;
  if (me.zone === 'up') {
    return <div className="lg-goal up" data-testid="league-goal" data-kind="up"><b><ArrowUp size={16} aria-hidden="true" style={{ verticalAlign: -2 }} /> Вы в зоне повышения</b><div style={{ fontSize: 14, marginTop: 2 }}>Держитесь в первой пятёрке до субботы — и со следующей недели вы в {toLeague(LEAGUES[LEAGUES.findIndex((l) => l.id === st.league) + 1].id)} лиге.</div></div>;
  }
  if (me.zone === 'down') {
    return (
      <div className="lg-goal down" data-testid="league-goal" data-kind="down">
        <b><ArrowDown size={16} aria-hidden="true" style={{ verticalAlign: -2 }} /> Зона понижения</b>
        <div style={{ fontSize: 14, marginTop: 2 }}>Ещё {st.toSafe} опыта — и вы выше {GROUP - DEMOTE}-го места, в безопасности.</div>
      </div>
    );
  }
  const top = LEAGUES[LEAGUES.length - 1].id === st.league;
  if (top) return <div className="lg-goal" data-testid="league-goal" data-kind="top"><b>Высшая лига</b><div style={{ fontSize: 14, marginTop: 2 }}>Выше подниматься некуда — боритесь за первые три места и монеты.</div></div>;
  const pct = Math.max(4, Math.min(100, Math.round((me.xp / (me.xp + st.toPromote)) * 100)));
  return (
    <div className="lg-goal" data-testid="league-goal" data-kind="stay">
      <b>До зоны повышения — {st.toPromote} опыта</b>
      <div style={{ fontSize: 14, marginTop: 2 }}>Сейчас вы остаётесь в {inLeague(lg.id)}. Урок — это 10–20 опыта.</div>
      <div className="lg-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function LeagueView({ learn, update, now = Date.now() }) {
  const names = useLeagueNames();
  const [got, setGot] = useState(null);
  const [rules, setRules] = useState(false);
  const st = leagueState(learn, now, names);
  const lg = LEAGUE_BY_ID[st.league];
  const tier = LEAGUES.findIndex((l) => l.id === st.league);
  const pending = pendingRewards(learn, now);
  const last = st.history[st.history.length - 1] || null;
  const claim = () => {
    const r = claimLeague(learn, Date.now());
    if (!r.coins) return;
    Audio.play('register');
    update(() => r.s, { settle: true });
    setGot(r);
  };
  const topTier = tier === LEAGUES.length - 1; const bottomTier = tier === 0;
  const leader = Math.max(1, ...st.table.map((r) => r.xp));
  const zones = [
    !topTier && { id: 'up', title: 'Зона повышения', range: `1–${PROMOTE} место`, icon: ArrowUp, rows: st.table.filter((r) => r.zone === 'up') },
    { id: 'stay', title: 'Остаётесь в лиге', range: `${topTier ? 1 : PROMOTE + 1}–${bottomTier ? GROUP : GROUP - DEMOTE} место`, icon: Minus, rows: st.table.filter((r) => r.zone === 'stay') },
    !bottomTier && { id: 'down', title: 'Зона понижения', range: `${GROUP - DEMOTE + 1}–${GROUP} место`, icon: ArrowDown, rows: st.table.filter((r) => r.zone === 'down') },
  ].filter(Boolean);
  const ZONE_COLOR = { up: 'var(--ds-ok)', stay: 'transparent', down: 'var(--ds-bad)' };
  return (
    <div data-testid="league" data-league={st.league} data-place={st.me.place} data-rest={String(st.rest)}>
      <style>{LEAGUE_CSS}</style>
      <div className="lg-hero">
        <LeagueBadge id={st.league} size={78} />
        <div style={{ minWidth: 0 }}>
          <div className="ds-eyebrow">Лига недели</div>
          <h1 data-testid="league-title">{lg.title} лига</h1>
          <div className="lg-place" data-testid="league-status">
            {st.waiting ? 'Старт — в понедельник' : st.joined ? <>{placeWord(st.me.place)} из {GROUP} · {st.me.xp} опыта</> : 'Вы ещё не в лиге на этой неделе'}
          </div>
          <div className="lg-when" data-testid="league-when">
            {st.waiting ? <><Hourglass size={14} aria-hidden="true" /> {newsDate(st.startsOn)} — первая неделя</>
              : st.rest ? <><Coffee size={14} aria-hidden="true" /> Перерыв до понедельника</> : <>{st.daysLeft} {plural(st.daysLeft, 'день', 'дня', 'дней')} до итогов</>}
          </div>
        </div>
      </div>

      <GoalCard st={st} />

      {pending.length > 0 && (
        <div className="lg-reward" data-testid="league-reward">
          <LeagueBadge id={pending[pending.length - 1].league} size={52} />
          <div style={{ minWidth: 0 }}>
            <div className="ds-eyebrow">Итоги {pending.length > 1 ? 'прошлых недель' : 'недели'}</div>
            <div style={{ fontWeight: 700, fontSize: 15.5, margin: '2px 0 8px' }}>{pending.map((h) => `${placeWord(h.place)} в ${inLeague(h.league)}`).join(', ')}</div>
            <Button small onClick={claim} data-testid="league-claim">Забрать {pending.reduce((a, h) => a + h.coins, 0)} {coinsWord(pending.reduce((a, h) => a + h.coins, 0))}</Button>
          </div>
        </div>
      )}
      {last && !pending.length && !st.rest && (
        <div className="ds-sub" style={{ fontSize: 13.5, marginTop: 10 }} data-testid="league-last">
          Прошлая неделя: {placeWord(last.place)} в {inLeague(last.league)}{last.move === 'up' ? ` — повышение в ${toLeague(last.to)}` : last.move === 'down' ? ` — понижение в ${toLeague(last.to)}` : ''}.
        </div>
      )}

      <h2 className="ds-h2" style={{ fontSize: 18, margin: '18px 0 6px' }}>Все лиги</h2>
      <div className="lg-ladder" data-testid="league-ladder" role="list">
        {LEAGUES.map((l, k) => {
          const state = k === tier ? 'now' : k < tier ? 'passed' : 'locked';
          return (
            <div key={l.id} className="lg-tier" role="listitem" data-testid="league-tier" data-tier={l.id} data-state={state}>
              <LeagueBadge id={l.id} size={38} locked={state === 'locked'} label={`${l.title} лига${state === 'now' ? ' — вы здесь' : state === 'locked' ? ' — ещё впереди' : ' — пройдена'}`} />
              <span>{l.title}</span>
              <small>{state === 'now' ? 'вы здесь' : state === 'locked' ? <Lock size={11} aria-hidden="true" /> : 'пройдена'}</small>
            </div>
          );
        })}
      </div>

      {st.waiting ? (
        <Card flat style={{ marginTop: 14, textAlign: 'center', fontSize: 14.5 }} data-testid="league-wait-table">
          <div className="lg-wait-seats" aria-hidden="true">{Array.from({ length: GROUP }, (_, k) => <i key={k} style={{ '--i': k }} />)}</div>
          Группа из {GROUP} учеников соберётся в понедельник.
        </Card>
      ) : (<>
      <h2 className="ds-h2" style={{ fontSize: 18, margin: '14px 0 0' }}>{st.rest ? 'Итоги недели' : 'Ваша группа'}</h2>
      <div data-testid="league-table">
        {zones.map((z) => {
          const Icon = z.icon;
          return (
            <section key={z.id} data-testid="league-zone" data-zone={z.id}>
              <div className={`lg-zone-head ${z.id}`}><Icon size={15} aria-hidden="true" /><span>{z.title}</span><span>{z.range}</span></div>
              <ol className="lg-rows" start={z.rows[0] ? z.rows[0].place : 1}>
                {z.rows.map((r) => (
                  <li key={r.id} className={`lg-row${r.me ? ' me' : ''}`} style={{ '--i': r.place, '--zone': ZONE_COLOR[r.zone], '--zone-bar': r.zone === 'down' ? 'var(--ds-bad)' : r.zone === 'up' ? 'var(--ds-ok)' : 'var(--ds-ink3)' }}
                    data-testid="league-row" data-me={r.me ? 'true' : undefined} data-zone={r.zone} data-place={r.place}>
                    <span className={`lg-no${r.place <= 3 ? ' medal' : ''}`} style={r.place <= 3 ? { background: MEDAL[r.place - 1] } : undefined}>{r.place}</span>
                    <span className="lg-ava" style={{ background: r.me ? 'var(--u)' : r.color }} aria-hidden="true">{r.name.charAt(0)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="lg-name" style={{ display: 'block' }}>{r.me ? 'Вы' : r.name}</span>
                      <span className="lg-xpbar" aria-hidden="true" style={{ display: 'block' }}><span style={{ width: `${Math.round((r.xp / leader) * 100)}%` }} /></span>
                    </span>
                    <span className="lg-xp">{r.xp}{r.place <= 3 && <small>+{PLACE_COINS[r.place - 1]} мон.</small>}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      </>)}

      <div className="lg-rules">
        <Button small variant="ghost" icon={ChevronDown} aria-expanded={rules} onClick={() => setRules((x) => !x)} data-testid="league-rules-toggle">Как устроены лиги</Button>
        {rules && (
          <ul data-testid="league-rules">
            <li>Неделя лиги — с понедельника по субботу, место — по опыту за эти дни. Воскресенье — перерыв: итоги и награда.</li>
            <li>По итогам первые {PROMOTE} поднимаются в следующую лигу, последние {DEMOTE} опускаются, остальные остаются.</li>
            <li>1–3 место: {PLACE_COINS.join(', ')} монет. Неделя без уроков лигу не меняет.</li>
            <li>Новичок начинает с ближайшего понедельника: в уже идущую неделю не попадают.</li>
          </ul>
        )}
      </div>
      <Card flat style={{ fontSize: 13, lineHeight: 1.45, marginTop: 10 }} data-testid="league-note">
        Соперники — ученики-боты. Под некоторыми могут стоять имена учеников, которые разрешили их показывать; опыт у них выдуманный.
      </Card>
      {got && <RewardSheet got={got} onClose={() => { Audio.play('paper'); setGot(null); }} />}
    </div>
  );
}
