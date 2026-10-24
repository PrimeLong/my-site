/* ДРУЗЬЯ И ЗАБЕГ — экраны (docs/mechanics.md, «Друзья и забег»): страница «Друзья» поверх профиля
   (заявки, список, добавить по логину), профиль друга — Инфля в его наряде, серия, лига, печати,
   события и «Позвать на забег»; карточка забега на Пути (дорожка с двумя бегущими Инфлями),
   предложение забега после урока и лента событий друзей в «Новостях». Данные — src/lib/friends-store.js,
   правила — src/learn/friends.js. */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus, Users, Check, X, ChevronRight, Copy, Flag, Flame, Sparkles, Trophy, Landmark, Stamp, CalendarDays, Award, Footprints, GraduationCap, ScrollText, ShoppingBag, Shirt, Sunrise, Moon, PiggyBank, Gem, Shapes } from 'lucide-react';
import { Button, Card, IconButton, TopBar, Sheet } from './ds.jsx';
import { Medal, CoinShower } from './ds-art.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { loadAccount, emblemIcon } from './account.jsx';
import { LeagueBadge } from './learn-league.jsx';
import { friendsApi } from './lib/friends-store.js';
import { ACHIEVEMENTS, coinsWord, plural } from './learn/rewards.js';
import { LEAGUE_BY_ID } from './learn/league.js';
import { dayOf, addDays } from './textbook/learn-state.js';
import { eventText, EVENT_ICON, friendFeed, seenText, lastSeenDays, raceable, raceReadyIn, raceView, raceCoins, raceClaimed, claimRace, levelTitle, RACE } from './learn/friends.js';
import { agoText } from './learn/notify.js';

export const FRIENDS_CSS = `
  .fr-row { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; width: 100%; padding: 10px 4px; border: none; border-top: 1px solid var(--ds-rule);
    background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; animation: fr-in .35s ease-out both; animation-delay: calc(min(var(--i, 0), 8) * 40ms); }
  .fr-row:first-child { border-top: none; }
  .fr-row:hover { background: var(--ds-card2); }
  .fr-ava { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--u) 10%, var(--ds-card)); overflow: visible; }
  .fr-name { font: 700 16px/1.25 var(--ds-head); }
  .fr-sub { font-size: 13px; color: var(--ds-ink2); margin-top: 2px; }
  .fr-add { display: flex; gap: 8px; margin-top: 10px; }
  .fr-add input { flex: 1; min-width: 0; }
  .fr-me { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; color: var(--ds-ink2); margin-top: 8px; }
  .fr-me b { color: var(--ds-ink); font-family: var(--ds-mono); }
  .fr-copy { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; border: 1.5px solid var(--ds-rule2); background: var(--ds-card); color: var(--u-ink); font: 700 13px var(--ds-sans); cursor: pointer; }
  .fr-group { font: 700 12px/1.2 var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ds-ink2); margin: 18px 0 4px; }
  .fr-empty { text-align: center; padding: 18px 8px 8px; }
  .fr-hero { text-align: center; padding: 6px 0 4px; }
  .fr-hero .fr-big { display: inline-block; animation: fr-pop .6s cubic-bezier(.3,1.5,.5,1) both; }
  .fr-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
  .fr-tile { padding: 10px 12px; border-radius: 14px; background: var(--ds-card2); display: flex; align-items: center; gap: 10px; animation: fr-in .4s ease-out both; animation-delay: calc(var(--i) * 60ms); }
  .fr-tile b { display: block; font: 700 18px/1.1 var(--ds-head); }
  .fr-tile small { display: block; font-size: 12.5px; color: var(--ds-ink2); }
  /* печати друга — та же сетка, что в своём профиле (rw-stamps): ячейка не уже 92 px, подпись
     переносится внутри неё и не вылезает к соседям и за край (жалоба «печати съехали») */
  .fr-seals { margin-bottom: 4px; }
  .fr-seal { min-width: 0; animation: fr-pop .45s cubic-bezier(.3,1.5,.5,1) both; animation-delay: calc(min(var(--i), 12) * 50ms); }
  .fr-seal b { overflow-wrap: anywhere; max-width: 100%; }
  .fr-ev { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 0; border-top: 1px dotted var(--ds-rule2); animation: fr-in .35s ease-out both; animation-delay: calc(min(var(--i, 0), 8) * 40ms); }
  .fr-ev:first-child { border-top: none; }
  .fr-ev-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: var(--u-ink); background: color-mix(in srgb, var(--u) 13%, var(--ds-card)); }
  .fr-ev small { display: block; color: var(--ds-ink3); font-size: 12px; }
  .fr-badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--ds-bad); color: #fff; font: 700 12px var(--ds-sans); }
  /* забег: две строки — кто, опыт и полоса до флажка, по полосе бежит Инфля в своём наряде */
  .fr-race { position: relative; overflow: hidden; }
  .fr-track { display: grid; gap: 4px; margin: 12px 0 8px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--u) 6%, var(--ds-card)); border: 1px solid var(--ds-rule); }
  .fr-lane { display: grid; grid-template-columns: 78px minmax(0, 1fr); align-items: end; gap: 10px; min-height: 44px; }
  .fr-who { display: flex; flex-direction: column; line-height: 1.15; padding-bottom: 2px; min-width: 0; }
  .fr-who b { font: 700 14px var(--ds-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fr-who > span { font: 13px var(--ds-sans); font-variant-numeric: tabular-nums; color: var(--ds-ink2); }
  .fr-lane.lead .fr-who b { color: var(--u-ink); }
  .fr-road { position: relative; height: 44px; margin-right: 22px; }
  .fr-road::before, .fr-fill { content: ''; position: absolute; left: 0; bottom: 6px; height: 8px; border-radius: 999px; }
  .fr-road::before { right: 0; background: var(--ds-rule); }
  .fr-fill { width: calc(var(--p) * 100%); background: color-mix(in srgb, var(--ds-ink3) 55%, var(--ds-rule)); transition: width 1s cubic-bezier(.3,.8,.4,1); }
  .fr-lane.me .fr-fill { background: var(--u); }
  .fr-runner { position: absolute; bottom: 9px; left: calc(var(--p) * 100%); transform: translateX(-50%); transition: left 1s cubic-bezier(.3,.8,.4,1); line-height: 0; }
  .fr-runner .fr-run { display: inline-block; animation: fr-run .5s ease-in-out infinite alternate; }
  .fr-goal { position: absolute; right: -20px; bottom: 2px; color: var(--ds-bad); fill: currentColor; animation: fr-wave 1.4s ease-in-out infinite; transform-origin: 2px 15px; }
  .fr-race-state { font-size: 14px; }
  .fr-race-ava { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--u) 10%, var(--ds-card)); flex: none; overflow: hidden; }
  .fr-race-facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .fr-race-facts span { padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--u) 8%, var(--ds-card)); border: 1px solid var(--ds-rule); font: 600 13px var(--ds-sans); color: var(--ds-ink2); }
  .fr-race-head { display: flex; align-items: center; gap: 10px; }
  .fr-race-ico { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--ds-bad) 14%, var(--ds-card)); color: var(--ds-bad); animation: fr-wave 2s ease-in-out infinite; }
  .fr-race-res { font: 700 22px/1.2 var(--ds-head); text-align: center; margin: 4px 0; animation: fr-pop .5s cubic-bezier(.3,1.5,.5,1) both; }
  .fr-offer { position: relative; overflow: hidden; text-align: left; margin-top: 14px; border: 2px solid color-mix(in srgb, var(--ds-bad) 40%, var(--ds-rule2)); animation: fr-pop .5s cubic-bezier(.3,1.4,.5,1) .3s both; }
  .fr-dash { position: relative; height: 64px; margin: 4px -16px 6px; overflow: hidden; background: linear-gradient(180deg, transparent 0 70%, color-mix(in srgb, var(--u) 12%, var(--ds-card)) 70%); }
  .fr-dash > span { position: absolute; bottom: 4px; animation: fr-dash 3.2s linear infinite; }
  .fr-dash > span:nth-child(2) { animation-duration: 3.6s; animation-delay: -.8s; }
  .fr-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 10px; }
  .fr-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: 999px; border: 2px solid var(--ds-rule2); background: var(--ds-card); color: var(--ds-ink); font: 700 14px var(--ds-sans); cursor: pointer; transition: transform .15s; }
  .fr-chip[aria-pressed="true"] { border-color: var(--u); background: color-mix(in srgb, var(--u) 10%, var(--ds-card)); transform: scale(1.04); }
  @keyframes fr-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  @keyframes fr-pop { from { opacity: 0; transform: scale(.7) } to { opacity: 1; transform: none } }
  @keyframes fr-run { from { transform: translateY(0) rotate(-4deg) } to { transform: translateY(-5px) rotate(4deg) } }
  @keyframes fr-wave { 0%, 100% { transform: rotate(0) } 50% { transform: rotate(-10deg) } }
  @keyframes fr-dash { from { left: -60px } to { left: 105% } }
  @media (prefers-reduced-motion: reduce) { .fr-row, .fr-tile, .fr-seal, .fr-ev, .fr-hero .fr-big, .fr-runner .fr-run, .fr-goal, .fr-race-ico, .fr-race-res, .fr-offer, .fr-dash > span { animation: none !important; } .fr-runner, .fr-fill { transition: none; } }
`;

const SEAL_ICON = { footprints: Footprints, check: Check, flame: Flame, landmark: Landmark, shapes: Shapes, graduation: GraduationCap, scroll: ScrollText, shopping: ShoppingBag, shirt: Shirt, sunrise: Sunrise, moon: Moon, piggy: PiggyBank, calendar: CalendarDays, gem: Gem, flag: Flag };
const EV_ICON = { landmark: Landmark, fire: Flame, stamp: Stamp, calendar: CalendarDays, trophy: Trophy, flag: Flag };
const wearOf = (f) => (f && f.card && f.card.wear) || {};
const leagueName = (id) => (LEAGUE_BY_ID[id] ? `${LEAGUE_BY_ID[id].title} лига` : 'Лига ещё впереди');
const friendSub = (f, now) => {  // серия, лига и «в сети»
  const c = f.card;
  if (!c) return 'ещё не заходил в обновлённое приложение';
  return [c.streak ? `серия ${c.streak} ${plural(c.streak, 'день', 'дня', 'дней')}` : null, c.league && LEAGUE_BY_ID[c.league] ? `${LEAGUE_BY_ID[c.league].title} лига` : null, seenText(f, now)].filter(Boolean).join(' · ');
};

// строка друга: Инфля в его наряде, имя, серия, лига, когда был в сети
function FriendRow({ f, i, onOpen, right = null, now }) {
  const Em = emblemIcon(f.emblem);
  return (
    <button type="button" className="fr-row" style={{ '--i': i }} data-testid="friend-row" data-login={f.login} onClick={() => { Audio.play('paper'); onOpen(f.login); }}>
      <span className="fr-ava"><Mascot mood="hello" size={44} outfit={wearOf(f)} /></span>
      <span style={{ minWidth: 0 }}>
        <span className="fr-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Em size={14} color="var(--u-ink)" aria-hidden="true" />{f.name}</span>
        <span className="fr-sub" style={{ display: 'block' }}>{friendSub(f, now)}</span>
      </span>
      {right || <ChevronRight size={20} color="var(--ds-ink3)" aria-hidden="true" />}
    </button>
  );
}

/* Страница «Друзья»: добавить по логину (и свой логин — скопировать), заявки, друзья, отправленные. */
export function FriendsPage({ data, onBack, onOpen }) {
  const account = loadAccount();
  const now = Date.now();
  const [login, setLogin] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); friendsApi.refresh(); }, []);
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); Audio.play('up'); if (ok) setMsg({ ok: true, text: typeof ok === 'function' ? ok(r) : ok }); } catch (e) { Audio.play('down'); setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const add = (e) => {
    e.preventDefault();
    const l = login.trim().replace(/^@/, '');
    if (!l) return;
    run(() => friendsApi.add(l), (r) => (r.status === 'friends' ? `Вы с @${l.toLowerCase()} теперь друзья!` : `Заявка ушла @${l.toLowerCase()}: друг увидит её и сможет принять.`)).then(() => setLogin(''));
  };
  const copy = () => {
    Audio.play('tick');
    try { navigator.clipboard.writeText(account.login).then(() => setCopied(true)).catch(() => setCopied(true)); } catch { setCopied(true); }
  };
  const friends = (data && data.friends) || []; const incoming = (data && data.incoming) || []; const outgoing = (data && data.outgoing) || [];
  return (
    <div className="nt-page" data-testid="friends" role="dialog" aria-label="Друзья">
      <div className="nt-page-in">
        <TopBar back={<IconButton label="Назад, в профиль" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />} title="Друзья" />
        {!account ? (
          <Card className="fr-empty"><Mascot mood="hello" size={64} /><div className="ds-h3" style={{ marginTop: 8 }}>Друзья — с аккаунтом</div>
            <div className="ds-sub" style={{ fontSize: 14.5 }}>Создайте аккаунт — и сможете добавлять друзей, видеть их успехи и звать на забег.</div></Card>
        ) : (<>
          <Card>
            <div className="ds-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={20} color="var(--u-ink)" aria-hidden="true" />Добавить друга</div>
            <div className="ds-sub" style={{ fontSize: 14, marginTop: 2 }}>По логину — он есть в профиле у каждого. Друг получит заявку и сможет её принять.</div>
            <form className="fr-add" onSubmit={add}>
              <input className="ds-field" style={{ margin: 0 }} value={login} onChange={(e) => setLogin(e.target.value)} placeholder="логин друга" autoCapitalize="none" autoComplete="off" aria-label="Логин друга" data-testid="friend-login" />
              <Button small type="submit" disabled={busy || login.trim().length < 3} data-testid="friend-add">Добавить</Button>
            </form>
            {msg && <div role="status" data-testid="friend-msg" style={{ fontSize: 14, marginTop: 8, color: msg.ok ? 'var(--ds-ok-ink)' : 'var(--ds-bad)' }}>{msg.text}</div>}
            <div className="fr-me">Ваш логин: <b data-testid="my-login">@{account.login}</b>
              <button type="button" className="fr-copy" onClick={copy}><Copy size={13} aria-hidden="true" />{copied ? 'Скопировано' : 'Скопировать'}</button></div>
          </Card>
          {incoming.length > 0 && <>
            <div className="fr-group">Заявки · {incoming.length}</div>
            <Card style={{ padding: '4px 12px' }} data-testid="friend-requests">
              {incoming.map((f, i) => (
                <div key={f.login} className="fr-row" style={{ '--i': i, cursor: 'default' }} data-testid="friend-request" data-login={f.login}>
                  <span className="fr-ava"><Mascot mood="wave" size={44} outfit={(f.card && f.card.wear) || {}} /></span>
                  <span style={{ minWidth: 0 }}><span className="fr-name" style={{ display: 'block' }}>{f.name}</span><span className="fr-sub" style={{ display: 'block' }}>@{f.login} · хочет дружить</span></span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <IconButton label={`Принять заявку: ${f.name}`} icon={Check} data-testid="friend-accept" onClick={() => run(() => friendsApi.answer(f.login, true), `${f.name} теперь в друзьях`)} />
                    <IconButton label={`Отклонить заявку: ${f.name}`} icon={X} onClick={() => run(() => friendsApi.answer(f.login, false))} />
                  </span>
                </div>
              ))}
            </Card>
          </>}
          <div className="fr-group">Друзья · {friends.length}</div>
          {friends.length ? (
            <Card style={{ padding: '4px 12px' }} data-testid="friend-list">
              {friends.map((f, i) => <FriendRow key={f.login} f={f} i={i} now={now} onOpen={onOpen} />)}
            </Card>
          ) : (
            <Card className="fr-empty" data-testid="friends-empty">
              <span className="fr-hero"><span className="fr-big"><Mascot mood="wave" size={70} /></span></span>
              <div className="ds-h3" style={{ marginTop: 6 }}>Вместе — веселее</div>
              <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.45 }}>Друзья видят ваши успехи, а вы — их: пройденные юниты, серии, новые лиги. С другом можно устроить забег — кто за три дня наберёт больше опыта.</div>
            </Card>
          )}
          {outgoing.length > 0 && <>
            <div className="fr-group">Ждут ответа · {outgoing.length}</div>
            <Card style={{ padding: '4px 12px' }}>
              {outgoing.map((f, i) => (
                <div key={f.login} className="fr-row" style={{ '--i': i, cursor: 'default' }}>
                  <span className="fr-ava"><Mascot mood="hello" size={44} outfit={(f.card && f.card.wear) || {}} /></span>
                  <span><span className="fr-name">{f.name}</span><span className="fr-sub" style={{ display: 'block' }}>@{f.login} · заявка {agoText(f.at, now)}</span></span>
                  <Button small variant="ghost" onClick={() => run(() => friendsApi.cancel(f.login))}>Отменить</Button>
                </div>
              ))}
            </Card>
          </>}
        </>)}
      </div>
    </div>
  );
}

/* Дорожка забега: две строки — кто, сколько опыта и полоса до финишного флажка; Инфля в своём наряде
   бежит по полосе к флажку. Место на полосе — доля опыта от лидера. Пока забег идёт — бегут, после — стоят. */
export function RaceTrack({ v, myWear }) {
  const top = Math.max(1, v.my || 0, v.their || 0);
  const running = v.status === 'active';
  const lane = (wear, x, name, me) => {
    const p = Math.max(0, Math.min(1, (x || 0) / top));
    const lead = me ? v.lead > 0 : v.lead < 0;
    const mood = running ? 'joy' : v.result === (me ? 'won' : 'lost') ? 'party' : 'hello';
    return (
      <div className={`fr-lane${lead ? ' lead' : ''}${me ? ' me' : ''}`}>
        <span className="fr-who"><b>{name}</b><span>{x || 0} опыта</span></span>
        <span className="fr-road" style={{ '--p': p }}>
          <i className="fr-fill" />
          <span className="fr-runner"><span className={running ? 'fr-run' : ''} style={{ animationDelay: me ? '0s' : '.25s' }}><Mascot mood={mood} size={30} outfit={wear} /></span></span>
          <Flag className="fr-goal" size={15} aria-hidden="true" />
        </span>
      </div>
    );
  };
  return (
    <div className="fr-track" aria-hidden="true">
      {lane(myWear, v.my, 'Вы', true)}
      {lane(v.wear, v.their, v.name, false)}
    </div>
  );
}

/* Карточка забега на Пути и в профиле друга: приглашение (принять за сутки), ожидание ответа,
   идущий забег (дорожка, день, кто впереди) и итог с наградой. */
export function RaceCard({ v, learn, update, myWear, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [got, setGot] = useState(null);
  const answer = async (accept) => {
    setBusy(true); setErr(null);
    // опыт, уже набранный сегодня, — точка отсчёта забега: в счёт идёт только то, что после принятия
    const day = dayOf(Date.now());
    try { await friendsApi.answerRace(v.id, accept, day, ((learn && learn.xp) || {})[day] || 0); Audio.play(accept ? 'up' : 'paper'); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const take = () => { Audio.play('register'); const coins = raceCoins(v); update((s) => claimRace(s, v, Date.now()), { settle: true }); setGot(coins); };
  const lead = v.lead > 0 ? `Вы впереди на ${v.my - v.their} опыта` : v.lead < 0 ? `${v.name} впереди на ${v.their - v.my} опыта` : 'Пока ровно';
  return (
    <Card className="fr-race" style={{ margin: compact ? '10px 0' : '0 0 12px' }} data-testid="race-card" data-status={v.status}>
      {got != null && <CoinShower seed={got + 3} n={14} />}
      <div className="fr-race-head">
        {v.status === 'incoming' || v.status === 'outgoing'
          ? <span className="fr-race-ava"><Mascot mood={v.status === 'incoming' ? 'wave' : 'hello'} size={40} outfit={v.wear} /></span>
          : <span className="fr-race-ico"><Flag size={20} aria-hidden="true" /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-eyebrow">Забег с другом{v.status === 'active' ? ` · ${v.dayNo ? `день ${v.dayNo} из ${v.days.length}` : 'начнётся завтра'}` : ''}</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {v.status === 'incoming' ? `${v.name} зовёт на забег` : v.status === 'outgoing' ? `Ждём ответа: ${v.name}` : v.status === 'finished' ? 'Забег окончен' : `Вы и ${v.name}`}
          </div>
        </div>
      </div>
      {(v.status === 'incoming' || v.status === 'outgoing') && (
        <div className="fr-race-facts">
          <span>{RACE.days} дня, кто больше опыта</span>
          <span>победа: {RACE.win} монет</span>
          <span>ответ: ещё {v.hoursLeft} ч</span>
        </div>
      )}
      {v.status === 'incoming' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button small wide disabled={busy} data-testid="race-accept" onClick={() => answer(true)}>Принять</Button>
          <Button small wide variant="ghost" disabled={busy} onClick={() => answer(false)}>Отказаться</Button>
        </div>
      )}
      {v.status === 'outgoing' && <div className="ds-sub" style={{ fontSize: 14 }}>Забег начнётся с того дня, когда {v.name} примет приглашение.</div>}
      {(v.status === 'active' || v.status === 'finished') && <RaceTrack v={v} myWear={myWear} />}
      {v.status === 'active' && <div className="fr-race-state" data-testid="race-state"><b>{lead}</b>{v.dayNo ? ` · до финиша ${v.daysLeft} ${plural(v.daysLeft, 'день', 'дня', 'дней')}` : ''}</div>}
      {v.status === 'finished' && (
        <div data-testid="race-result">
          <div className="fr-race-res">{v.result === 'won' ? 'Победа!' : v.result === 'tie' ? 'Ничья' : `Победа у ${v.name}`}</div>
          <div className="ds-sub" style={{ textAlign: 'center', fontSize: 14 }}>Опыт за {v.days.length} дня: вы — {v.my}, {v.name} — {v.their}.</div>
          {got != null ? <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 6 }} data-testid="race-got">+{got} {coinsWord(got)} в кошельке</div>
            : !raceClaimed(learn, v) && raceCoins(v) > 0 ? <Button small wide style={{ marginTop: 8 }} data-testid="race-claim" onClick={take}>Забрать {raceCoins(v)} {coinsWord(raceCoins(v))}</Button> : null}
        </div>
      )}
      {err && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14, marginTop: 6 }}>{err}</div>}
    </Card>
  );
}
// забеги, которые стоит показать на Пути: приглашения, идущие и законченные, но не забранные
export function racesToShow(data, learn, now = Date.now()) {
  if (!data || !data.races) return [];
  const byLogin = Object.fromEntries((data.friends || []).map((f) => [f.login, f]));
  return data.races.map((r) => raceView(r, learn, byLogin[r.other], now))
    // законченный и не забранный — неделю после финиша
    .filter((v) => ['incoming', 'outgoing', 'active'].includes(v.status) || (v.status === 'finished' && !raceClaimed(learn, v) && raceCoins(v) > 0 && dayOf(now) <= addDays(v.end, 7)));
}

/* После урока, иногда: «Забег с другом?» — две Инфли пробегают по дорожке, выбрать друга (из тех,
   кто был в сети за неделю) и позвать. Сутки у друга на ответ. */
export function RaceOffer({ friends, onDone }) {
  const [pick, setPick] = useState(friends[0] ? friends[0].login : null);
  const [state, setState] = useState(null);
  const send = async () => {
    setState('busy');
    try { await friendsApi.invite(pick); Audio.play('up'); setState('sent'); } catch (e) { Audio.play('down'); setState(e.message); }
  };
  const f = friends.find((x) => x.login === pick);
  return (
    <Card className="fr-offer" data-testid="race-offer">
      <div className="fr-dash" aria-hidden="true">
        <span><Mascot mood="joy" size={46} /></span>
        <span><Mascot mood="joy" size={46} outfit={wearOf(f)} /></span>
      </div>
      <div className="ds-eyebrow">Забег с другом</div>
      {state === 'sent' ? (
        <div style={{ fontSize: 15, marginTop: 4 }} data-testid="race-offer-sent"><b>Приглашение ушло.</b> У {f ? f.name : 'друга'} сутки, чтобы принять. Забег — на Пути, когда начнётся.</div>
      ) : (<>
        <div style={{ fontWeight: 700, fontSize: 17, marginTop: 2 }}>Кто за три дня наберёт больше опыта?</div>
        <div className="ds-sub" style={{ fontSize: 14 }}>Победителю — {RACE.win} монет и печать «Забег».</div>
        <div className="fr-chips" role="group" aria-label="С кем бежать">
          {friends.map((x) => (
            <button key={x.login} type="button" className="fr-chip" aria-pressed={pick === x.login} onClick={() => { Audio.play('tick'); setPick(x.login); }}>
              <Mascot mood="hello" size={28} outfit={wearOf(x)} />{x.name}
            </button>
          ))}
        </div>
        {state && state !== 'busy' && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14, marginBottom: 6 }}>{state}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button small wide disabled={!pick || state === 'busy'} data-testid="race-invite" onClick={send}>Позвать на забег</Button>
          <Button small variant="ghost" onClick={() => { Audio.play('paper'); onDone(); }}>Не сейчас</Button>
        </div>
      </>)}
    </Card>
  );
}

/* Профиль друга: Инфля в его наряде, серия, опыт, лига, уровень, печати, недавние события,
   забег (идущий или «Позвать на забег»), убрать из друзей. */
export function FriendProfile({ login, data, learn, update, myWear, onBack }) {
  const now = Date.now();
  const f = ((data && data.friends) || []).find((x) => x.login === login);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [login]);
  if (!f) {
    return (
      <div className="nt-page" data-testid="friend" role="dialog" aria-label="Друг"><div className="nt-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Друг" />
        <div className="ds-sub">Этого ученика больше нет в друзьях.</div>
      </div></div>
    );
  }
  const c = f.card || {};
  const Em = emblemIcon(f.emblem);
  const race = ((data && data.races) || []).map((r) => raceView(r, learn, f, now)).find((v) => v.other === login && ['incoming', 'outgoing', 'active', 'finished'].includes(v.status) && !(v.status === 'finished' && raceClaimed(learn, v)));
  const canRace = !race && raceable([f], now).length > 0;
  const seals = ACHIEVEMENTS.filter((a) => (c.seals || []).includes(a.id));
  const events = friendFeed([f], now, 60);
  const invite = async () => { setBusy(true); setMsg(null); try { await friendsApi.invite(login); Audio.play('up'); } catch (e) { setMsg(e.message); } setBusy(false); };
  const remove = async () => { setBusy(true); try { await friendsApi.remove(login); Audio.play('paper'); onBack(); } catch (e) { setMsg(e.message); setBusy(false); } };
  return (<>
    <div className="nt-page" data-testid="friend" data-login={login} role="dialog" aria-label={`Профиль: ${f.name}`} inert={confirm}>
      <div className="nt-page-in">
        <TopBar back={<IconButton label="Назад, к друзьям" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />} title={f.name} />
        <div className="fr-hero">
          <span className="fr-big"><Mascot mood="wave" size={120} outfit={c.wear || {}} label={`Инфля ${f.name}`} /></span>
          <div className="ds-h1" style={{ fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}><Em size={20} color="var(--u-ink)" aria-hidden="true" />{f.name}</div>
          <div className="ds-sub" style={{ fontSize: 14 }}>@{f.login} · {seenText(f, now)}</div>
        </div>
        <div className="fr-tiles">
          <div className="fr-tile" style={{ '--i': 0 }}><Flame size={22} color="var(--ds-bad)" aria-hidden="true" /><span><b>{c.streak || 0}</b><small>{plural(c.streak || 0, 'день', 'дня', 'дней')} подряд</small></span></div>
          <div className="fr-tile" style={{ '--i': 1 }}><Sparkles size={22} color="var(--u-ink)" aria-hidden="true" /><span><b>{c.xp || 0}</b><small>опыта всего</small></span></div>
          <div className="fr-tile" style={{ '--i': 2 }}>{c.league ? <LeagueBadge id={c.league} size={30} /> : <Trophy size={22} aria-hidden="true" />}<span><b style={{ fontSize: 15 }}>{leagueName(c.league)}</b><small>лига недели</small></span></div>
          <div className="fr-tile" style={{ '--i': 3 }}><Award size={22} color="var(--ds-gold)" aria-hidden="true" /><span><b style={{ fontSize: 15 }}>{c.level ? levelTitle(c.level) : '—'}</b><small>уровень Пути · марок {c.album || 0}</small></span></div>
        </div>
        {race ? <RaceCard v={race} learn={learn} update={update} myWear={myWear} compact /> : canRace ? (
          <Button wide icon={Flag} disabled={busy} data-testid="friend-race" onClick={invite}>Позвать на забег</Button>
        ) : <div className="ds-sub" style={{ fontSize: 13.5, textAlign: 'center' }} data-testid="friend-race-later">{raceReadyIn(f, now) > 0
          ? `Позвать на забег можно через сутки дружбы — ещё ${raceReadyIn(f, now)} ${plural(raceReadyIn(f, now), 'час', 'часа', 'часов')}.`
          : `Позвать на забег можно друга, который заходил за последние ${RACE.onlineDays} дней.`}</div>}
        {msg && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14, marginTop: 6 }}>{msg}</div>}
        <div className="fr-group">Печати · {seals.length} из {ACHIEVEMENTS.length}</div>
        {seals.length ? (
          <div className="rw-stamps fr-seals" data-testid="friend-seals">
            {seals.map((a, i) => { const Icon = SEAL_ICON[a.icon] || Award; return <div key={a.id} className="rw-stamp fr-seal" style={{ '--i': i }}><Medal icon={<Icon size={22} />} size={60} label={a.title} /><b>{a.title}</b></div>; })}
          </div>
        ) : <div className="ds-sub" style={{ fontSize: 14 }}>Печатей пока нет — всё впереди.</div>}
        <div className="fr-group">Недавно</div>
        {events.length ? (
          <Card style={{ padding: '4px 12px' }}>
            {events.map((e, i) => { const Icon = EV_ICON[EVENT_ICON[e.k]] || Sparkles; return <div key={`${e.k}${e.at}`} className="fr-ev" style={{ '--i': i }}><span className="fr-ev-ico"><Icon size={17} aria-hidden="true" /></span><span>{eventText(e)}<small>{agoText(e.at, now)}</small></span></div>; })}
          </Card>
        ) : <div className="ds-sub" style={{ fontSize: 14 }}>Пока ничего — новости друга появятся здесь.</div>}
        <div style={{ marginTop: 22 }}><Button small variant="ghost" wide onClick={() => setConfirm(true)} data-testid="friend-remove">Убрать из друзей</Button></div>
      </div>
    </div>
    {confirm && (
      <Sheet label="Убрать из друзей?" onClose={() => setConfirm(false)}>
        <div style={{ textAlign: 'center' }}>
          <div className="ds-h2">Убрать {f.name} из друзей?</div>
          <div className="ds-sub" style={{ fontSize: 14.5, margin: '6px 0 14px' }}>Вы перестанете видеть успехи друг друга. Добавить снова можно в любой момент.</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <Button wide onClick={() => setConfirm(false)} autoFocus>Оставить</Button>
            <Button wide variant="ghost" disabled={busy} onClick={remove} data-testid="friend-remove-yes">Убрать</Button>
          </div>
        </div>
      </Sheet>
    )}
  </>);
}

/* «Друзья» в «Новостях»: знаменательные события друзей за две недели. */
export function FriendFeed({ data, onOpen }) {
  const now = Date.now();
  const feed = friendFeed((data && data.friends) || [], now);
  if (!feed.length) return null;
  return (
    <Card style={{ margin: '0 0 14px', padding: '10px 12px 6px' }} data-testid="friend-feed">
      <div className="ds-h3" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}><Users size={19} color="var(--u-ink)" aria-hidden="true" />Новости друзей</div>
      {feed.slice(0, 8).map((e, i) => (
        <button key={`${e.login}${e.k}${e.at}`} type="button" className="fr-ev" style={{ '--i': i, width: '100%', background: 'none', border: 'none', borderTop: i ? '1px dotted var(--ds-rule2)' : 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
          onClick={() => { Audio.play('paper'); onOpen(e.login); }}>
          <span style={{ width: 34, display: 'grid', placeItems: 'center' }}><Mascot mood="joy" size={32} outfit={e.wear} /></span>
          <span><b>{e.name}</b>: {eventText(e)}<small>{agoText(e.at, now)}</small></span>
        </button>
      ))}
    </Card>
  );
}

// счётчик в профиле: друзей и заявок
export const friendsCount = (data) => ({ friends: ((data && data.friends) || []).length, incoming: ((data && data.incoming) || []).length });
export { lastSeenDays };
