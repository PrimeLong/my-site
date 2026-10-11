/* ЛИГА НЕДЕЛИ — карточка на экране «Задания» (правила — src/learn/league.js, docs/mechanics.md
   «Лиги недели»): лига, место, сколько опыта до зоны повышения, таблица группы с зонами и
   награды прошлых недель. */
import React, { useEffect, useState } from 'react';
import { Trophy, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, Card } from './ds.jsx';
import { LEAGUE_BY_ID, LEAGUES, PROMOTE, GROUP, DEMOTE, leagueState, claimLeague, pendingRewards } from './learn/league.js';
import { coinsWord, plural } from './learn/rewards.js';
import { loadAccount, accountKidsMode } from './account.jsx';
import { accountLeagueNames } from './lib/client.js';
import { dayOf } from './textbook/learn-state.js';

const LEAGUE_CSS = `
  .lg-head { display: flex; align-items: center; gap: 12px; }
  .lg-medal { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; color: #fff; flex: none; box-shadow: inset 0 0 0 3px rgba(255,255,255,.35), 0 1px 3px var(--ds-shade); }
  .lg-table { list-style: none; margin: 10px 0 0; padding: 0; }
  .lg-row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px dotted var(--ds-rule); font-size: 14.5px; }
  .lg-row.me { background: var(--ds-sel); color: var(--ds-selInk); font-weight: 700; border-radius: 4px; }
  .lg-place { width: 24px; text-align: right; font: 700 13px var(--ds-mono); color: var(--ds-ink3); }
  .lg-ava { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: #fff; font: 700 12px var(--ds-sans); flex: none; }
  .lg-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lg-xp { font: 700 13.5px var(--ds-mono); white-space: nowrap; }
  .lg-zone { display: flex; align-items: center; gap: 6px; font: 700 12px var(--ds-sans); letter-spacing: .04em; text-transform: uppercase; padding: 6px 4px 2px; }
  .lg-zone.up { color: var(--ds-ok); } .lg-zone.down { color: var(--ds-bad); }
  .lg-zone::after { content: ''; flex: 1; border-top: 1px dashed currentColor; opacity: .6; }
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
// строка для карточки «Задания» на Пути
export function leagueLine(learn, now = Date.now()) {
  const st = leagueState(learn, now);
  return st.joined ? `${LEAGUE_BY_ID[st.league].title} лига, ${placeWord(st.me.place)}` : `${LEAGUE_BY_ID[st.league].title} лига`;
}

export function LeagueCard({ learn, update, now = Date.now() }) {
  const names = useLeagueNames();
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState(null);
  const st = leagueState(learn, now, names);
  const lg = LEAGUE_BY_ID[st.league];
  const pending = pendingRewards(learn, now);
  const last = st.history[st.history.length - 1] || null;
  const claim = () => {
    const r = claimLeague(learn, Date.now());
    if (!r.coins) return;
    Audio.play('coin');
    update(() => r.s, { settle: true });
    setMsg(`+${r.coins} ${coinsWord(r.coins)} за ${r.weeks.length > 1 ? 'прошлые недели' : 'прошлую неделю'}`);
  };
  // в свёрнутом виде — первые пять, вы и соседи, последние пять
  const near = new Set([...st.table.slice(0, PROMOTE), ...st.table.slice(-DEMOTE)].map((r) => r.id));
  const myIdx = st.table.findIndex((r) => r.me);
  [myIdx - 1, myIdx, myIdx + 1].forEach((k) => { if (st.table[k]) near.add(st.table[k].id); });
  const rows = all ? st.table : st.table.filter((r) => near.has(r.id));
  const topTier = LEAGUES[LEAGUES.length - 1].id === st.league;
  const bottomTier = LEAGUES[0].id === st.league;
  let shownPrev = null;
  return (
    <Card style={{ margin: '0 0 14px' }} data-testid="league" data-league={st.league} data-place={st.me.place}>
      <style>{LEAGUE_CSS}</style>
      <div className="lg-head">
        <div className="lg-medal" style={{ background: lg.color }} aria-hidden="true"><Trophy size={26} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-eyebrow">Лига недели</div>
          <div style={{ fontWeight: 700, fontSize: 18 }} data-testid="league-title">{lg.title} лига</div>
          <div className="ds-sub" style={{ fontSize: 13.5, lineHeight: 1.4 }} data-testid="league-status">
            {st.joined
              ? <>{placeWord(st.me.place)} из {GROUP} · {st.me.xp} опыта{st.toPromote > 0 ? ` · до зоны повышения ${st.toPromote}` : st.me.zone === 'up' ? ' · в зоне повышения' : ''}</>
              : 'Пройдите урок на этой неделе — и вы в лиге'}
            {' · '}{st.daysLeft} {plural(st.daysLeft, 'день', 'дня', 'дней')} до итогов
          </div>
        </div>
      </div>
      {pending.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 0', padding: '8px 10px', background: 'var(--ds-okBg)', borderRadius: 4 }} data-testid="league-reward">
          <span style={{ flex: 1, fontSize: 14 }}>Итоги недели: {pending.map((h) => `${placeWord(h.place)} в ${LEAGUE_BY_ID[h.league].title.replace(/ая$/, 'ой')} лиге`).join(', ')}</span>
          <Button small onClick={claim} data-testid="league-claim">Забрать {pending.reduce((a, h) => a + h.coins, 0)} {coinsWord(pending.reduce((a, h) => a + h.coins, 0))}</Button>
        </div>
      )}
      {msg && <div role="status" style={{ marginTop: 8, fontSize: 14, color: 'var(--ds-ok)' }} data-testid="league-msg">{msg}</div>}
      {last && !pending.length && (
        <div className="ds-sub" style={{ fontSize: 13, marginTop: 8 }} data-testid="league-last">
          Прошлая неделя: {placeWord(last.place)} в {LEAGUE_BY_ID[last.league].title.replace(/ая$/, 'ой')} лиге{last.move === 'up' ? ` — повышение в ${LEAGUE_BY_ID[last.to].title.replace(/ая$/, 'ую')}` : last.move === 'down' ? ` — понижение в ${LEAGUE_BY_ID[last.to].title.replace(/ая$/, 'ую')}` : ''}.
        </div>
      )}
      <ol className="lg-table" data-testid="league-table">
        {rows.map((r) => {
          const gap = shownPrev != null && r.place - shownPrev > 1;
          const upLine = !topTier && shownPrev != null && shownPrev <= PROMOTE && r.place > PROMOTE;
          const downLine = !bottomTier && (shownPrev == null ? r.place > GROUP - DEMOTE : shownPrev <= GROUP - DEMOTE && r.place > GROUP - DEMOTE);
          shownPrev = r.place;
          return (
            <React.Fragment key={r.id}>
              {upLine && <li className="lg-zone up" aria-hidden="true"><ArrowUp size={12} />выше — повышение</li>}
              {gap && !downLine && <li className="lg-zone" aria-hidden="true" style={{ color: 'var(--ds-ink3)' }}>…</li>}
              {downLine && <li className="lg-zone down" aria-hidden="true"><ArrowDown size={12} />ниже — понижение</li>}
              <li className={`lg-row${r.me ? ' me' : ''}`} data-testid="league-row" data-me={r.me ? 'true' : undefined} data-zone={r.zone}>
                <span className="lg-place">{r.place}</span>
                <span className="lg-ava" style={{ background: r.me ? 'var(--u)' : r.color }} aria-hidden="true">{r.name.charAt(0)}</span>
                <span className="lg-name">{r.name}</span>
                <span className="lg-xp">{r.xp}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Button small variant="ghost" icon={ChevronDown} aria-expanded={all} onClick={() => setAll(!all)} data-testid="league-all">{all ? 'Свернуть' : `Вся таблица — ${GROUP}`}</Button>
        <span style={{ flex: 1 }} />
        <span className="ds-sub" style={{ fontSize: 12.5 }}>1–3 место: 50, 30, 20 монет</span>
      </div>
      <div className="ds-sub" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }} data-testid="league-note">
        Соперники — ученики-боты. Под некоторыми могут стоять имена учеников, которые разрешили их показывать; опыт у них выдуманный.
      </div>
    </Card>
  );
}
