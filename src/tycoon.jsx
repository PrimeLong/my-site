/* «Своё дело» — тайкун предпринимателя. Отдельный экран и отдельный чанк: игра в
   реальном времени, где страна (боты ЦБ, Минфина и президента) живёт фоном, а игрок
   строит производственные цепочки по областям карты. Модель — src/lib/tycoon.js,
   финансы и связь с макроэкономикой — src/lib/business.js, карта — BusinessMap
   в countrymap.jsx, ползунки и строки отчёта — src/business.jsx. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wheat, Trees, Pickaxe, Mountain, Factory, Store, Building2, Anchor, Warehouse, FlaskConical, Pause, Play,
  FastForward, Landmark, Coins, Newspaper, ArrowRight, Hammer, ArrowUpCircle, Power, Trash2, Handshake,
  Globe2, AlertTriangle, TrendingUp, X, Map as MapIcon, Boxes, Lock, Check, Trophy, DoorOpen, Save, Users, Gift, Sparkles,
} from 'lucide-react';
import {
  COLOR, Audio, AudioControls, GlobalStyle, ACHIEVEMENTS, ACHIEVEMENTS_KEY, loadUnlockedAchievements, TYCOON_SAVE_KEY,
  TYCOON_META_KEY, loadTycoonMeta, getPlayerId,
} from './MacroSimulator.jsx';
import { fetchTycoonSlots, fetchTycoonSlot, saveTycoonSlot, deleteTycoonSlot } from './lib/client.js';
import { BusinessMap } from './countrymap.jsx';
import { PlanSlider, Toggle, Row, MiniSpark } from './business.jsx';
import { fmtMln, fmt1, fmtSigned1, quarterLabel, getCbPersona, getMofPersona, getPresPersona, POLITICAL_REGIME_INFO, SCENARIOS } from './lib/engine.js';
import { SECTORS } from './lib/catalog.js';
import { fxLoanRate } from './lib/business.js';
import * as T from './lib/tycoon.js';

const ICONS = { wheat: Wheat, trees: Trees, pickaxe: Pickaxe, mountain: Mountain, factory: Factory, store: Store,
  building: Building2, anchor: Anchor, warehouse: Warehouse, flask: FlaskConical };
const CAT_LABEL = { extract: 'Добыча', process: 'Производство', sell: 'Торговля', support: 'Службы' };
const CAT_COLOR = { extract: 'teal', process: 'gold', sell: 'blue', support: 'muted' };

// деньги: мелочь — в тысячах, дальше — млн/млрд/трлн как во всей игре
const money = (v) => {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1) return `${(v * 1000).toFixed(0)} тыс`;
  return fmtMln(v);
};
const moneySigned = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const perMin = (v) => (v * 60 < 10 ? (v * 60).toFixed(1) : Math.round(v * 60).toString());
const units = (v) => (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('ru-RU'));

const TY_CSS = `
  .ty-work { position: relative; height: 4px; border-radius: 2px; background: ${'var(--ty-track)'}; overflow: hidden; }
  .ty-work > span { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left; animation: tyWork linear infinite; }
  @keyframes tyWork { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .ty-pulse { animation: tyPulse .5s ease; }
  @keyframes tyPulse { 0% { color: inherit; } 30% { filter: brightness(1.5); } 100% { filter: none; } }
  .ty-toast { animation: tyToast 3.6s ease forwards; }
  @keyframes tyToast { 0% { opacity: 0; transform: translateY(8px); } 8% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(-4px); } }
  .ty-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .ty-head { position: sticky; top: 0; }
  @media (max-width: 1000px) { .ty-grid { grid-template-columns: minmax(0, 1fr); } .ty-head { position: relative; } }
  @media (prefers-reduced-motion: reduce) { .ty-work > span, .ty-pulse, .ty-toast { animation: none; } }
`;

function saveLocal(st) {
  try { localStorage.setItem(TYCOON_SAVE_KEY, JSON.stringify(T.snapshotTycoon(st))); } catch { /* квота или приватный режим */ }
}
function saveMeta(meta) {
  try { localStorage.setItem(TYCOON_META_KEY, JSON.stringify(meta)); } catch { /* см. выше */ }
}
// достижения тайкуна пишутся в ту же коллекцию, что и у остальной игры
function unlockAch(ids) {
  const cur = loadUnlockedAchievements();
  const fresh = [];
  ids.forEach((id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a && !cur[id]) { cur[id] = Date.now(); fresh.push(a); }
  });
  if (fresh.length) { try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(cur)); } catch { /* приватный режим */ } }
  return fresh;
}

// узкий экран: карта уходит во вкладку, а не висит слева
function useNarrow() {
  const q = '(max-width: 1000px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const upd = () => setNarrow(mq.matches);
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);
  return narrow;
}

/* ------------------------------ ЭКРАН ------------------------------ */
export function TycoonScreen({ initial, setupNew, onExit }) {
  const [boot] = useState(() => {
    if (initial) return T.catchUp(T.normalizeTycoon(initial));
    const meta = loadTycoonMeta();
    return { st: T.makeTycoon({ ...setupNew, legacy: meta.legacy || 0 }), away: 0, earned: 0 };
  });
  const [st, setSt] = useState(boot.st);
  const [offline, setOffline] = useState(boot.away > 0 ? boot : null);
  const narrow = useNarrow();
  const [tabPicked, setTab] = useState(null);
  // по умолчанию: на телефоне — карта со стройкой, на компьютере карта и так слева — производство
  const tab = tabPicked === 'build' && !narrow ? 'prod' : tabPicked || (narrow ? 'build' : 'prod');
  const [region, setRegion] = useState(() => (boot.st.buildings[0] ? boot.st.buildings[0].region : 'capital'));
  const [hoverType, setHoverType] = useState(null);
  const [showSaves, setShowSaves] = useState(false);
  const [toasts, setToasts] = useState([]);
  const stRef = useRef(st);
  stRef.current = st;

  const toast = (text, tone = 'info') => {
    const id = `${Date.now()}${Math.random()}`;
    setToasts((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3700);
  };

  // главный цикл: полсекунды реального времени — полсекунды игрового на скорость
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      setSt((prev) => (prev.paused || prev.bankrupt ? prev : T.tick(prev, dt * prev.speed)));
    }, 500);
    return () => clearInterval(id);
  }, []);
  // автосохранение: каждые пять секунд и при уходе со страницы
  useEffect(() => {
    const id = setInterval(() => saveLocal(stRef.current), 5000);
    const onHide = () => saveLocal(stRef.current);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(id); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); saveLocal(stRef.current); };
  }, []);
  useEffect(() => { Audio.setRole('trader'); return () => Audio.setRole(null); }, []);

  // новости своего бизнеса — всплывающими плашками; кварталы — вехи и достижения
  const seenNews = useRef(new Set(st.news.map((n) => n.id)));
  const q = st.country.quarterIndex;
  useEffect(() => {
    st.news.filter((n) => n.own && !seenNews.current.has(n.id)).slice(0, 2).forEach((n) => toast(n.headline, 'warn'));
    st.news.forEach((n) => seenNews.current.add(n.id));
    const checked = T.checkMilestones(st);
    if (checked !== st) setSt(checked);
    const ids = [];
    if (st.milestones.chain_bread) ids.push('tycoon_chain');
    if (T.companyValue(st) >= 1000) ids.push('tycoon_billion');
    if (st.history.length >= 4 && T.ownerWealth(st) >= 3 * Math.max(1, st.value0 || 1)) ids.push('biz_triple');
    if (st.setup.scenario !== 'sandbox' && st.history.length >= 12 && !st.bankrupt) ids.push('biz_survivor');
    unlockAch(ids).forEach((a) => { Audio.play('coin'); toast(`Достижение: ${a.title}`, 'gold'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const act = (fn, sound = 'click') => {
    const r = fn(stRef.current);
    if (r.error) { Audio.play('error'); toast(r.error, 'warn'); return false; }
    Audio.play(sound);
    setSt(r.st);
    return true;
  };

  const e = st.country.economy;
  const nextGoal = T.MILESTONES.find((m) => !st.milestones[m.id]);
  const flowsKey = Math.floor(st.t / 2);
  const mapInfo = useMemo(() => {
    const info = {};
    st.buildings.forEach((b) => {
      const x = info[b.region] || (info[b.region] = { count: 0, extract: 0, process: 0, sell: 0, support: 0 });
      x.count += 1; x[T.BLD[b.type].cat] += 1;
    });
    return info;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.buildings.length, st.buildings.map((b) => b.region + b.type).join()]);
  const flows = useMemo(() => Object.entries(st.stats.flows || {})
    .map(([k, v]) => { const [a, b] = k.split('>'); return [a, b, v]; })
    .filter(([, , v]) => v > 0.002).sort((x, y) => y[2] - x[2]).slice(0, 12),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [flowsKey]);
  const highlight = useMemo(() => {
    if (!hoverType) return null;
    const h = {};
    T.regionsOpen(st).forEach((r) => { const b = T.siteBonus(hoverType, r); if (b != null) h[r] = b; });
    return h;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverType, e.annexed && e.annexed.length]);

  const tabs = [['build', 'Карта и стройка', MapIcon], ['prod', 'Производство', Factory], ['stock', 'Склад и рынок', Boxes],
    ['lab', 'Исследования', FlaskConical], ['team', 'Команда', Users], ['money', 'Финансы', Coins], ['country', 'Страна', Landmark]];
  const mapPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 10 }}>
        <BusinessMap economy={e} selected={region} onSelect={setRegion} info={mapInfo} flows={flows}
          highlight={highlight} hit={st.events.regionHit ? st.events.regionHit.region : null} routes={T.ROUTE_LINKS} />
        <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 6, lineHeight: 1.45 }}>
          Нажмите на область, чтобы строить там. Золотые линии — ваши грузы между областями: чем толще, тем больше везёте
          (перевозка стоит денег, соседство цехов экономит). Наведите на здание в списке — карта покажет, где оно работает лучше.
        </div>
      </div>
      <RegionPanel st={st} region={region} act={act} setHoverType={setHoverType} />
    </div>
  );

  return (
    <div className="ems-root" style={{ minHeight: '100vh', '--ty-track': COLOR.border }}>
      <GlobalStyle />
      <style>{TY_CSS}</style>
      <TyHeader st={st} setSt={setSt} onExit={() => { saveLocal(stRef.current); onExit(); }} onSaves={() => { Audio.play('click'); setShowSaves(true); }} />
      <QuestCard st={st} act={act} onGo={(t) => { Audio.play('tab'); setTab(t); }} />
      {st.log[0] && (
        <div style={{ padding: '8px 18px', fontSize: 11.5, color: COLOR.muted, borderBottom: `1px solid ${COLOR.hairline}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ArrowRight size={12} color={COLOR.gold} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, flex: '1 1 240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.log[0].text}</span>
          {nextGoal && <span style={{ fontSize: 11, color: COLOR.goldSoft, whiteSpace: 'nowrap' }}><Trophy size={11} style={{ verticalAlign: -1 }} /> следующая веха: {nextGoal.title}</span>}
        </div>
      )}
      <div style={{ padding: '14px 16px 40px', maxWidth: 1500, margin: '0 auto' }}>
        <div className="ty-grid">
          {!narrow && <div>{mapPanel}</div>}
          <div style={{ minWidth: 0 }}>
            <div className="ems-seg" role="tablist" aria-label="Разделы" style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 12, width: '100%' }}>
              {tabs.map(([id, label, Icon]) => (
                id === 'build' && !narrow ? null : <button key={id} role="tab" aria-pressed={tab === id}
                  style={{ flex: '1 1 auto', padding: '8px 10px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  onClick={() => { Audio.play('tab'); setTab(id); }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            {tab === 'build' && mapPanel}
            {tab === 'prod' && <ProductionTab st={st} act={act} setRegion={setRegion} />}
            {tab === 'stock' && <StockTab st={st} act={act} />}
            {tab === 'lab' && <LabTab st={st} act={act} />}
            {tab === 'team' && <TeamTab st={st} act={act} />}
            {tab === 'money' && <MoneyTab st={st} act={act} onSell={() => {
              const value = T.companyValue(stRef.current);
              const gain = T.legacyFor(value);
              if (!window.confirm(`Продать компанию за ${money(value)}? Новое дело начнётся с нуля, но с репутацией +${gain} (каждый пункт — +10% ко всему).`)) return;
              const meta = loadTycoonMeta();
              const next = { legacy: (meta.legacy || 0) + gain, runs: (meta.runs || 0) + 1, best: Math.max(meta.best || 0, value) };
              saveMeta(next);
              Audio.play('stamp');
              const fresh = T.makeTycoon({ ...stRef.current.setup, legacy: next.legacy });
              setSt(fresh); setRegion(fresh.buildings[0].region);
              toast(`Компания продана. Репутация: ${next.legacy}`, 'gold');
            }} />}
            {tab === 'country' && <CountryTab st={st} />}
          </div>
        </div>
      </div>

      {!st.introSeen && !offline && (
        <Modal title="Своё дело" onClose={() => setSt((p) => ({ ...p, introSeen: true }))}>
          <div style={{ fontSize: 12.5, color: COLOR.muted, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div><b style={{ color: COLOR.text }}>Время идёт само.</b> Деньги капают каждую секунду, раз в минуту проходит квартал страны — налоги, проценты, новости. Пауза и скорость — в шапке.</div>
            <div><b style={{ color: COLOR.text }}>Цепочки.</b> Сырьё → переработка → магазин. Чем дальше по цепочке, тем дороже товар; рядом стоящие цеха экономят на перевозке.</div>
            <div><b style={{ color: COLOR.text }}>Страна живёт без вас.</b> Ставка, кризисы, выборы и война меняют спрос, цены и кредит — следите за вкладкой «Страна».</div>
            <div><b style={{ color: COLOR.text }}>Задания</b> вверху экрана проведут по первым шагам и дадут денег на рост.</div>
          </div>
          <button className="ems-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={() => { Audio.play('stamp'); setSt((p) => ({ ...p, introSeen: true })); }}>Начать</button>
        </Modal>
      )}
      {showSaves && <SavesModal st={st} onClose={() => setShowSaves(false)} onLoad={(snap) => {
        const r = T.catchUp(T.normalizeTycoon(snap));
        setSt(r.st); setShowSaves(false); setRegion(r.st.buildings[0] ? r.st.buildings[0].region : 'capital');
        if (r.away > 0) setOffline(r);
        toast('Партия загружена', 'gold');
      }} toast={toast} />}
      {offline && (
        <Modal onClose={() => setOffline(null)} title="Пока вас не было">
          <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.55 }}>
            Прошло {Math.floor(offline.away / 3600) ? `${Math.floor(offline.away / 3600)} ч ` : ''}{Math.round((offline.away % 3600) / 60)} мин.
            Предприятия работали без присмотра — вполсилы, а страна ждала вас: кварталы не шли.
          </div>
          <div className="ems-mono" style={{ fontSize: 28, color: offline.earned >= 0 ? COLOR.teal : COLOR.rust, margin: '12px 0', fontWeight: 600 }}>
            {moneySigned(offline.earned)}
          </div>
          <button className="ems-btn primary" style={{ width: '100%' }} onClick={() => setOffline(null)}>К делу</button>
        </Modal>
      )}
      {st.bankrupt && (
        <Modal title="Банкротство" tone="rust">
          <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.55, marginBottom: 14 }}>
            Второй квартал подряд денег нет даже с кредитом. Кредиторы подали в суд, компания уходит под внешнее управление.
            Репутация от прошлых проданных компаний остаётся при вас.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ems-btn primary" style={{ flex: 1 }} onClick={() => {
              const fresh = T.makeTycoon({ ...st.setup, legacy: loadTycoonMeta().legacy || 0 });
              setSt(fresh); setRegion(fresh.buildings[0].region);
            }}>Начать заново</button>
            <button className="ems-btn" style={{ flex: 1 }} onClick={() => { try { localStorage.removeItem(TYCOON_SAVE_KEY); } catch { /* нет */ } onExit(); }}>В меню</button>
          </div>
        </Modal>
      )}
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 80, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340 }}>
        {toasts.map((t) => (
          <div key={t.id} className="ems-panel-raised ty-toast" role="status" style={{ padding: '9px 13px', fontSize: 12,
            borderColor: t.tone === 'warn' ? COLOR.rust : t.tone === 'gold' ? COLOR.gold : COLOR.border,
            color: t.tone === 'gold' ? COLOR.goldSoft : COLOR.text }}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, tone }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" role="dialog" aria-label={title} onClick={(ev) => ev.stopPropagation()}
        style={{ maxWidth: 420, width: '100%', padding: 22, borderColor: tone === 'rust' ? COLOR.rust : COLOR.gold }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <span className="ems-serif" style={{ fontSize: 17, color: tone === 'rust' ? COLOR.rust : COLOR.goldSoft }}>{title}</span>
          {onClose && <button onClick={onClose} aria-label="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: COLOR.faint, cursor: 'pointer', lineHeight: 0 }}><X size={16} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ ШАПКА ------------------------------ */
function TyHeader({ st, setSt, onExit, onSaves }) {
  const e = st.country.economy;
  const net = st.stats.income - st.stats.costs;
  const value = T.companyValue(st);
  const qp = Math.min(1, st.qTime / T.QUARTER_SEC);
  const regime = POLITICAL_REGIME_INFO[e.politicalRegime] || POLITICAL_REGIME_INFO.democracy;
  const chips = [
    ['Ставка', `${fmt1(e.keyRate)}%`], ['Инфляция', `${fmt1(e.inflation)}%`], ['Курс', `${Math.round(e.exchangeRate)}`],
    ['ВВП', `${fmtSigned1(e.gdpGrowth)}%`], ['Безработица', `${fmt1(e.unemployment)}%`],
  ];
  const setSpeed = (speed, paused = false) => { Audio.play('tick'); setSt((p) => ({ ...p, speed, paused })); };
  return (
    <div className="ty-head" style={{ zIndex: 20, borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`,
      background: `linear-gradient(180deg, ${COLOR.panelRaised} 0%, ${COLOR.panel} 100%)`, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div className="ems-card-icon" style={{ width: 38, height: 38 }}><Factory size={18} color={COLOR.gold} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="ems-serif" style={{ fontSize: 16 }}>Своё дело{st.legacy ? <span style={{ fontSize: 11, color: COLOR.gold, marginLeft: 6 }}>репутация {st.legacy}</span> : null}</div>
          <div style={{ fontSize: 11, color: COLOR.muted }}>{quarterLabel(st.country.quarterIndex)} · {regime.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="ems-mono" style={{ fontSize: 24, fontWeight: 600, color: st.cash < 0 ? COLOR.rust : COLOR.goldSoft }} aria-label="Деньги на счёте">{money(st.cash)}</span>
        <span className="ems-mono" style={{ fontSize: 12, color: net >= 0 ? COLOR.teal : COLOR.rust }}>{moneySigned(net * 60)}/мин</span>
        <span style={{ fontSize: 11.5, color: COLOR.muted }}>стоимость <b className="ems-mono" style={{ color: COLOR.text }}>{money(value)}</b></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <div title="До конца квартала: страна сделает ход, придут налоги и проценты" style={{ width: 90 }}>
          <div style={{ fontSize: 10, color: COLOR.faint, marginBottom: 3 }}>квартал {Math.round(qp * 100)}%</div>
          <div style={{ height: 4, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${qp * 100}%`, height: '100%', background: COLOR.gold, transition: 'width .5s linear' }} />
          </div>
        </div>
        <div className="ems-seg" role="group" aria-label="Скорость времени" style={{ display: 'flex' }}>
          <button aria-pressed={st.paused} aria-label="Пауза" style={{ padding: '6px 9px' }} onClick={() => setSpeed(st.speed, !st.paused)}>
            {st.paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          {[0.5, 1, 2, 4].map((s) => (
            <button key={s} aria-pressed={!st.paused && st.speed === s} aria-label={`Скорость ${s === 0.5 ? '0,5' : s}×`} style={{ padding: '6px 8px', fontSize: 12 }} onClick={() => setSpeed(s)}>
              {s === 4 ? <><FastForward size={12} style={{ verticalAlign: -2 }} />4×</> : s === 0.5 ? '½×' : `${s}×`}
            </button>
          ))}
        </div>
        <AudioControls />
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={onSaves}>
          <Save size={13} />Партии
        </button>
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={onExit}>
          <DoorOpen size={13} />Меню
        </button>
      </div>
      <div style={{ flexBasis: '100%', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(([k, v]) => (
          <span key={k} className="ems-mono" style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${COLOR.border}`, borderRadius: 999, color: COLOR.muted, background: COLOR.panelAlt }}>
            {k} <b style={{ color: COLOR.text }}>{v}</b>
          </span>
        ))}
        {(e.activeCrises || []).length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${COLOR.rust}`, borderRadius: 999, color: COLOR.rust, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} />кризис
          </span>
        )}
        {st.paused && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: COLOR.goldDim, color: COLOR.goldSoft }}>пауза</span>}
      </div>
    </div>
  );
}

/* ------------------------------ ОБЛАСТЬ И СТРОЙКА ------------------------------ */
function recipeText(d) {
  const part = (m) => Object.entries(m).map(([r, qv]) => `${qv} ${T.RES[r].name.toLowerCase()}`).join(' + ');
  if (d.in && d.out) return `${part(d.in)} → ${part(d.out)} в секунду`;
  if (d.out) return `${part(d.out)} в секунду`;
  if (d.sells) return `продаёт ${d.sells} ед. товара в секунду людям области`;
  if (d.exports) return `вывозит ${d.exports} ед. в секунду по мировым ценам`;
  if (d.storage) return `+${d.storage} к вместимости склада по каждому товару`;
  if (d.research) return `${d.research} очка исследований в секунду`;
  return '';
}

function RegionPanel({ st, region, act, setHoverType }) {
  const open = T.regionsOpen(st);
  const reg = open.includes(region) ? region : open[0];
  const here = st.buildings.filter((b) => b.region === reg);
  const used = T.usedIn(st, reg); const slots = T.slotsIn(st, reg);
  const all = T.BUILDINGS.filter((d) => T.siteBonus(d.id, reg) != null);
  const options = all.filter((d) => !d.unlock || T.has(st, d.unlock));
  const locked = all.filter((d) => d.unlock && !T.has(st, d.unlock));
  const info = T.regionInfo(st, reg);
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>{T.regionName(reg)} область</span>
        <span style={{ fontSize: 11, color: COLOR.faint }}>участков {used} из {slots}</span>
        <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 9px', fontSize: 11 }}
          onClick={() => act((s) => T.buySlot(s, reg), 'coin')}>+ участок · {money(T.slotCost(st, reg))}</button>
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5 }}>
        {info.sector} · покупателей {Math.round(info.pop * 100)}% страны · зарплаты {info.wage >= 1 ? '+' : ''}{Math.round((info.wage - 1) * 100)}% к среднему ·
        настроение <span style={{ color: info.mood < 0.9 ? COLOR.rust : info.mood > 1.05 ? COLOR.teal : COLOR.text }}>{info.mood < 0.9 ? 'тревожное' : info.mood > 1.05 ? 'хорошее' : 'обычное'}</span>
        {info.hit ? <span style={{ color: COLOR.rust }}> · {info.hit}</span> : null}
      </div>
      {here.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 12px' }}>
          {here.map((b) => <BuildingCard key={b.uid} st={st} b={b} act={act} compact />)}
        </div>
      )}
      <div style={{ fontSize: 11, color: COLOR.faint, margin: '6px 0' }}>Что можно построить здесь</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {options.map((d) => {
          const Icon = ICONS[d.icon] || Factory;
          const err = T.canBuild(st, d.id, reg);
          const bonus = T.siteBonus(d.id, reg);
          return (
            <div key={d.id} onMouseEnter={() => setHoverType(d.id)} onMouseLeave={() => setHoverType(null)}
              onFocus={() => setHoverType(d.id)} onBlur={() => setHoverType(null)}
              style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon size={15} color={COLOR[CAT_COLOR[d.cat]]} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{d.name}</span>
                {bonus !== 1 && <span className="ems-mono" style={{ fontSize: 10.5, color: bonus > 1 ? COLOR.teal : COLOR.rust }}>×{bonus.toFixed(2)}</span>}
              </div>
              <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.4, flex: 1 }}>{recipeText(d)}</div>
              <button className="ems-btn" disabled={!!err} title={err || ''} style={{ padding: '5px 8px', fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                borderColor: err ? COLOR.border : COLOR.gold, color: err ? COLOR.faint : COLOR.goldSoft }}
                onClick={() => act((s) => T.build(s, d.id, reg), 'stamp')}>
                <Hammer size={11} />{money(d.cost)}
              </button>
            </div>
          );
        })}
      </div>
      {locked.length > 0 && (
        <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
          <Lock size={11} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>После исследований: {locked.map((d) => `${d.name.toLowerCase()} (${T.RSR[d.unlock].name})`).join(', ')}.</span>
        </div>
      )}
    </div>
  );
}

function BuildingCard({ st, b, act, compact, onLocate }) {
  const d = T.BLD[b.type];
  const Icon = ICONS[d.icon] || Factory;
  const power = T.buildingPower(st, b);
  const run = st.stats.runK && st.stats.runK[b.uid] != null ? st.stats.runK[b.uid] : (d.out ? 0 : 1);
  const need = T.requiredStaff(st, b);
  const eff = power * (d.out ? run : 1);
  const mainRate = d.out ? Object.values(d.out)[0] * eff : d.sells ? d.sells * power : d.exports ? d.exports * power : d.research ? d.research * power : 0;
  const cycle = mainRate > 0.01 ? Math.min(8, 1 / mainRate) : 0;
  const upCost = T.upgradeCost(b);
  const struck = st.events.strike && st.events.strike.uid === b.uid && st.t < st.events.strike.until;
  const status = !b.enabled ? 'остановлено' : struck ? 'забастовка' : b.staff < need - 0.5 ? `набор людей ${Math.floor(b.staff)}/${need}`
    : d.out && run < 0.95 ? (run < 0.05 ? 'нет сырья или места на складе' : `простаивает ${Math.round((1 - run) * 100)}%`) : 'работает';
  const bad = status !== 'работает' && !status.startsWith('набор');
  return (
    <div style={{ background: COLOR.panelAlt, border: `1px solid ${bad ? `${COLOR.rust}88` : COLOR.border}`, padding: compact ? '8px 10px' : '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon size={15} color={COLOR[CAT_COLOR[d.cat]]} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.name}</span>
        <span className="ems-mono" style={{ fontSize: 10.5, color: COLOR.gold }}>ур. {b.level}</span>
        {!compact && (
          <button onClick={onLocate} style={{ background: 'none', border: 'none', padding: 0, color: COLOR.muted, fontSize: 11, cursor: 'pointer', textDecoration: 'underline dotted' }}>
            {T.regionName(b.region)}
          </button>
        )}
        <span style={{ fontSize: 10.5, color: bad ? COLOR.rust : COLOR.faint, marginLeft: 'auto' }}>{status}</span>
      </div>
      <div className="ty-work" style={{ margin: '7px 0 5px' }}>
        {cycle > 0 && b.enabled && <span style={{ background: COLOR[CAT_COLOR[d.cat]], animationDuration: `${cycle.toFixed(2)}s` }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, color: COLOR.muted, flex: 1, minWidth: 140 }}>
          {d.out ? `${Object.keys(d.out).map((r) => `${T.RES[r].name}: ${perMin(d.out[r] * eff)}/мин`).join(', ')}`
            : d.sells ? `до ${perMin(d.sells * power)} покупок/мин` : d.exports ? `до ${perMin(d.exports * power)} ед./мин на экспорт`
              : d.research ? `${perMin(d.research * power)} очков/мин` : d.storage ? `склад +${Math.round(d.storage * T.levelMult(b.level))}` : ''}
          {' · '}{Math.floor(b.staff)} чел.
        </span>
        <button className="ems-btn" disabled={b.level >= T.MAX_LEVEL || st.cash < upCost} style={{ padding: '3px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Уровень: выработка ×1,5, людей ×1,25" onClick={() => act((s) => T.upgrade(s, b.uid), 'coin')}>
          <ArrowUpCircle size={11} />{b.level >= T.MAX_LEVEL ? 'макс.' : money(upCost)}
        </button>
        <button className="ems-btn" aria-label={b.enabled ? 'Остановить' : 'Запустить'} title={b.enabled ? 'Остановить (содержание — 30%)' : 'Запустить'}
          style={{ padding: '3px 7px', lineHeight: 0 }} onClick={() => act((s) => T.toggle(s, b.uid), 'tick')}>
          <Power size={12} color={b.enabled ? COLOR.teal : COLOR.faint} />
        </button>
        <button className="ems-btn" aria-label="Снести" title="Снести: вернётся треть вложенного" style={{ padding: '3px 7px', lineHeight: 0 }}
          onClick={() => { if (window.confirm(`Снести «${d.name}»? Вернётся треть вложенного.`)) act((s) => T.demolish(s, b.uid)); }}>
          <Trash2 size={12} color={COLOR.faint} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ ПРОИЗВОДСТВО ------------------------------ */
function ProductionTab({ st, act, setRegion }) {
  const groups = ['extract', 'process', 'sell', 'support'].map((c) => [c, st.buildings.filter((b) => T.BLD[b.type].cat === c)]).filter(([, l]) => l.length);
  const wages = st.buildings.reduce((a, b) => a + b.staff, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: COLOR.muted }}>
        <span>Зданий: <b style={{ color: COLOR.text }}>{st.buildings.length}</b></span>
        <span>Работников: <b style={{ color: COLOR.text }}>{Math.round(wages)}</b></span>
        <span>Выручка: <b className="ems-mono" style={{ color: COLOR.teal }}>{money(st.stats.income * 60)}/мин</b></span>
        <span>Расходы: <b className="ems-mono" style={{ color: COLOR.rust }}>{money(st.stats.costs * 60)}/мин</b></span>
      </div>
      {groups.map(([cat, list]) => (
        <div key={cat} className="ems-panel" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{CAT_LABEL[cat]}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((b) => <BuildingCard key={b.uid} st={st} b={b} act={act} onLocate={() => setRegion(b.region)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ СКЛАД И РЫНОК ------------------------------ */
function StockTab({ st, act }) {
  const cap = T.storageCap(st);
  const usedInputs = new Set(); const produced = new Set();
  st.buildings.forEach((b) => { const d = T.BLD[b.type]; if (d.in) Object.keys(d.in).forEach((r) => usedInputs.add(r)); if (d.out) Object.keys(d.out).forEach((r) => produced.add(r)); });
  const hasTerminal = st.buildings.some((b) => T.BLD[b.type].exports);
  const hasShops = st.buildings.some((b) => T.BLD[b.type].sells);
  const list = T.RESOURCES.filter((r) => produced.has(r.id) || usedInputs.has(r.id) || (st.stock[r.id] || 0) > 0.5);
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Склад общий, по {Math.round(cap)} ед. каждого товара (больше — склады и исследования). Свои цеха берут сырьё первыми;
        «Продавать» отдаёт оптовикам всё сверх запаса — чем больше льёте, тем ниже цена. «Докупать» берёт недостающее на рынке с наценкой 15%.
      </div>
      {!list.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Пока нечего хранить — постройте первое производство.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((r) => {
          const rate = st.stats.rates[r.id] || { prod: 0, cons: 0, sold: 0, bought: 0 };
          const stock = st.stock[r.id] || 0;
          const full = stock / cap;
          const net = rate.prod + rate.bought - rate.cons - rate.sold;
          return (
            <div key={r.id} style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, padding: '9px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</span>
                <span className="ems-mono" style={{ fontSize: 11.5, color: full > 0.95 ? COLOR.rust : COLOR.text }}>{units(stock)} {r.unit}</span>
                <span className="ems-mono" style={{ fontSize: 10.5, color: net >= 0 ? COLOR.teal : COLOR.rust }}>{net >= 0 ? '+' : ''}{perMin(net)}/мин</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: COLOR.faint }}>
                  опт: купить {money(T.buyPrice(st, r.id))} · продать {money(T.sellPrice(st, r.id))}
                </span>
              </div>
              <div style={{ height: 3, background: COLOR.border, borderRadius: 2, overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: `${Math.min(100, full * 100)}%`, height: '100%', background: full > 0.95 ? COLOR.rust : COLOR.gold, transition: 'width .5s linear' }} />
              </div>
              <div style={{ fontSize: 10.5, color: COLOR.muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>выпуск {perMin(rate.prod)}/мин</span><span>в цеха {perMin(rate.cons)}/мин</span>
                <span>продано {perMin(rate.sold)}/мин</span>{rate.bought > 0.001 && <span>куплено {perMin(rate.bought)}/мин</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
                {!r.buyOnly && (
                  <Chip on={!!st.autoSell[r.id]} onClick={() => act((s) => T.setMap(s, 'autoSell', r.id, !s.autoSell[r.id]), 'tick')}>Продавать излишки</Chip>
                )}
                {(usedInputs.has(r.id) || r.buyOnly) && (
                  <Chip on={!!st.autoBuy[r.id] || r.buyOnly} disabled={r.buyOnly} onClick={() => act((s) => T.setMap(s, 'autoBuy', r.id, !s.autoBuy[r.id]), 'tick')}>
                    {r.buyOnly ? 'Только импорт' : 'Докупать'}
                  </Chip>
                )}
                {r.export && hasTerminal && (
                  <Chip on={!!st.exportList[r.id]} onClick={() => act((s) => T.setMap(s, 'exportList', r.id, !s.exportList[r.id]), 'tick')}>
                    <Anchor size={10} style={{ verticalAlign: -1 }} /> Экспорт · {money(T.exportPrice(st, r.id))}
                  </Chip>
                )}
                {!r.buyOnly && (
                  <span style={{ fontSize: 10.5, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    держать запас
                    <button className="ems-btn" style={{ padding: '1px 7px', fontSize: 11 }} aria-label="Меньше запас"
                      onClick={() => act((s) => T.setMap(s, 'reserve', r.id, Math.max(0, (s.reserve[r.id] || 0) - 20)), 'tick')}>−</button>
                    <span className="ems-mono" style={{ color: COLOR.text, minWidth: 26, textAlign: 'center' }}>{st.reserve[r.id] || 0}</span>
                    <button className="ems-btn" style={{ padding: '1px 7px', fontSize: 11 }} aria-label="Больше запас"
                      onClick={() => act((s) => T.setMap(s, 'reserve', r.id, Math.min(cap, (s.reserve[r.id] || 0) + 20)), 'tick')}>+</button>
                  </span>
                )}
              </div>
              {r.consumer && (
                <div style={{ marginTop: 4 }}>
                  <PlanSlider label={`Цена в магазинах: ${money(T.retailPrice(st, r.id))}`} value={st.markup[r.id] || 0} min={-20} max={40} step={1}
                    hint={hasShops
                      ? `Дешевле рынка — больше покупателей, дороже — выше маржа. Не хватило товара или полок: ${perMin(st.stats.unmet[r.id] || 0)}/мин.`
                      : 'Нужен магазин: без него товар идёт только оптом.'}
                    format={(v) => `${v > 0 ? '+' : ''}${v}% к рынку`} onChange={(v) => act((s) => T.setMap(s, 'markup', r.id, v), null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children, disabled }) {
  return (
    <button className="ems-btn" aria-pressed={on} disabled={disabled} onClick={onClick}
      style={{ padding: '3px 9px', fontSize: 11, borderRadius: 999, borderColor: on ? COLOR.gold : COLOR.border,
        background: on ? COLOR.goldDim : 'transparent', color: on ? COLOR.goldSoft : COLOR.muted }}>
      {on && <Check size={10} style={{ verticalAlign: -1, marginRight: 3 }} />}{children}
    </button>
  );
}

/* ------------------------------ ИССЛЕДОВАНИЯ: ДЕРЕВО ------------------------------
   Узлы стоят по колонкам (tier) и строкам-веткам (row), линии — зависимости. На узком
   экране дерево прокручивается вбок внутри своей рамки, страница — нет. */
const NODE_W = 176; const NODE_H = 92; const GAP_X = 44; const GAP_Y = 18;
function LabTab({ st, act }) {
  const rate = st.buildings.reduce((a, b) => a + (T.BLD[b.type].research ? T.BLD[b.type].research * T.buildingPower(st, b) : 0), 0) + 0.02;
  const [picked, setPicked] = useState(null);
  const tiers = Math.max(...T.RESEARCH.map((r) => r.tier)) + 1;
  const rows = Math.max(...T.RESEARCH.map((r) => r.row)) + 1;
  const W = tiers * NODE_W + (tiers - 1) * GAP_X + 24;
  const H = rows * NODE_H + (rows - 1) * GAP_Y + 24;
  const pos = (r) => ({ x: 12 + r.tier * (NODE_W + GAP_X), y: 12 + r.row * (NODE_H + GAP_Y) });
  const sel = picked ? T.RSR[picked] : null;
  const state = (r) => (T.has(st, r.id) ? 'done' : T.reqsOf(r).every((x) => T.has(st, x)) ? 'open' : 'locked');
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <FlaskConical size={15} color={COLOR.gold} />
        <span className="ems-mono" style={{ fontSize: 20, color: COLOR.goldSoft, fontWeight: 600 }}>{Math.floor(st.rp)}</span>
        <span style={{ fontSize: 11.5, color: COLOR.muted }}>очков · +{perMin(rate)}/мин. Лаборатории ускоряют (лучше в столице). Каждое изучение дороже следующего. Дерево шире экрана — прокрутите его вбок.</span>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        <div style={{ position: 'relative', width: W, height: H }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
            {T.RESEARCH.flatMap((r) => T.reqsOf(r).map((q) => {
              const a = pos(T.RSR[q]); const b = pos(r);
              const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2; const x2 = b.x; const y2 = b.y + NODE_H / 2;
              const done = T.has(st, q);
              return <path key={`${q}>${r.id}`} d={`M${x1},${y1} C${x1 + GAP_X / 2},${y1} ${x2 - GAP_X / 2},${y2} ${x2},${y2}`}
                fill="none" stroke={done ? COLOR.gold : COLOR.border} strokeWidth={done ? 2 : 1.4} strokeDasharray={done ? undefined : '4 4'} />;
            }))}
          </svg>
          {T.RESEARCH.map((r) => {
            const p = pos(r); const stt = state(r);
            const cost = T.researchCost(st, r.id);
            const can = !T.canResearch(st, r.id);
            return (
              <button key={r.id} onClick={() => { Audio.play('tick'); setPicked(r.id); }} aria-pressed={picked === r.id}
                style={{ position: 'absolute', left: p.x, top: p.y, width: NODE_W, height: NODE_H, textAlign: 'left', cursor: 'pointer', padding: '8px 10px',
                  borderRadius: 8, font: 'inherit', color: COLOR.text, display: 'flex', flexDirection: 'column', gap: 4,
                  background: stt === 'done' ? COLOR.goldDim : COLOR.panelAlt,
                  border: `1.5px solid ${picked === r.id ? COLOR.goldSoft : stt === 'done' ? COLOR.gold : can ? COLOR.teal : COLOR.border}`,
                  opacity: stt === 'locked' ? 0.55 : 1, boxShadow: can ? `0 0 0 3px ${COLOR.tealDim}` : 'none', transition: 'box-shadow .3s, border-color .3s' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                  {stt === 'done' ? <Check size={13} color={COLOR.gold} /> : stt === 'locked' ? <Lock size={12} color={COLOR.faint} /> : <FlaskConical size={13} color={COLOR.teal} />}
                  {r.name}
                </span>
                <span style={{ fontSize: 10, color: COLOR.faint }}>{T.RESEARCH_BRANCHES[r.branch]}</span>
                <span className="ems-mono" style={{ fontSize: 11, marginTop: 'auto', color: stt === 'done' ? COLOR.gold : can ? COLOR.teal : COLOR.muted }}>
                  {stt === 'done' ? 'изучено' : `${cost} очков`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {sel && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{sel.name}</div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5, marginTop: 3 }}>{sel.desc}</div>
            {T.reqsOf(sel).length > 0 && <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 3 }}>Нужно: {T.reqsOf(sel).map((x) => T.RSR[x].name).join(', ')}</div>}
          </div>
          {!T.has(st, sel.id) && (
            <button className="ems-btn" disabled={!!T.canResearch(st, sel.id)} title={T.canResearch(st, sel.id) || ''}
              style={{ padding: '7px 12px', fontSize: 12, borderColor: COLOR.teal, color: COLOR.teal }}
              onClick={() => act((s2) => T.research(s2, sel.id), 'stamp')}>
              {T.canResearch(st, sel.id) || `Изучить · ${T.researchCost(st, sel.id)}`}
            </button>
          )}
        </div>
      )}
      {!sel && <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 8 }}>Нажмите на узел, чтобы прочитать, что он даёт, и изучить. Подсвеченные бирюзовым можно изучить прямо сейчас.</div>}
    </div>
  );
}

/* ------------------------------ КОМАНДА: МЕНЕДЖЕРЫ ------------------------------ */
function TeamTab({ st, act }) {
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Менеджеры сами делают рутину каждые пять секунд — и пока вкладка закрыта тоже. Зарплата растёт вместе с компанией.
        Тем, кто тратит деньги, задайте бюджет: какую долю денег на счёте можно пустить в дело за раз.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {T.MANAGERS.map((m) => {
          const hired = st.managers && st.managers[m.id];
          const unlocked = T.has(st, m.unlock);
          return (
            <div key={m.id} style={{ background: hired ? COLOR.goldDim : COLOR.panelAlt, border: `1px solid ${hired ? COLOR.gold : COLOR.border}`, padding: '10px 12px', opacity: unlocked || hired ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Users size={14} color={hired ? COLOR.gold : COLOR.muted} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                <span className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint }}>{money(T.managerSalaryOf(st, m.id) * 60)}/мин</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {hired ? (
                    <>
                      <button className="ems-btn" style={{ padding: '3px 9px', fontSize: 11 }} aria-pressed={hired.on !== false}
                        onClick={() => act((s2) => T.setManager(s2, m.id, { on: hired.on === false }), 'tick')}>{hired.on === false ? 'В отпуске — вернуть' : 'Работает — отпуск'}</button>
                      <button className="ems-btn" style={{ padding: '3px 9px', fontSize: 11 }}
                        onClick={() => { if (window.confirm(`Уволить: ${m.name}?`)) act((s2) => T.fireManager(s2, m.id)); }}>Уволить</button>
                    </>
                  ) : (
                    <button className="ems-btn" disabled={!unlocked || st.cash < m.hire} style={{ padding: '4px 10px', fontSize: 11.5, borderColor: unlocked ? COLOR.gold : COLOR.border }}
                      onClick={() => act((s2) => T.hireManager(s2, m.id), 'coin')}>
                      {unlocked ? `Нанять · ${money(m.hire)}` : <><Lock size={11} style={{ verticalAlign: -1 }} /> {T.RSR[m.unlock].name}</>}
                    </button>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.45, marginTop: 5 }}>{m.desc}</div>
              {hired && m.spends && (
                <PlanSlider label="Бюджет за раз" value={hired.budget ?? 30} min={5} max={100} step={5}
                  hint="Доля денег на счёте, которую можно потратить одним решением."
                  format={(v) => `${v}% денег`} onChange={(v) => act((s2) => T.setManager(s2, m.id, { budget: v }), null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ ЗАДАНИЯ ------------------------------ */
function QuestCard({ st, act, onGo }) {
  const q = T.currentQuest(st);
  if (!q) return null;
  const done = q.test(st);
  const n = (st.quest || 0) + 1;
  return (
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLOR.hairline}`, background: done ? COLOR.goldDim : 'transparent' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {done ? <Sparkles size={16} color={COLOR.gold} /> : <Gift size={16} color={COLOR.gold} />}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 12.5 }}>
            <b style={{ color: COLOR.goldSoft }}>Задание {n} из {T.QUESTS.length}: {q.title}</b>
            <span className="ems-mono" style={{ fontSize: 11, color: COLOR.faint, marginLeft: 8 }}>награда {money(q.reward)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.45 }}>{done ? 'Готово — заберите награду.' : T.questText(st, q)}</div>
        </div>
        {done ? (
          <button className="ems-btn primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => act((s2) => T.claimQuest(s2), 'coin')}>Забрать {money(q.reward)}</button>
        ) : (
          <button className="ems-btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onGo(q.tab)}>Где это? <ArrowRight size={12} style={{ verticalAlign: -2 }} /></button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ СОХРАНЕНИЯ ------------------------------
   Автосохранение живёт в браузере; четыре слота — на сервере, общие для связанных
   устройств (как у обычных партий). */
function SavesModal({ st, onClose, onLoad, toast }) {
  const [slots, setSlots] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const pid = getPlayerId();
  useEffect(() => {
    fetchTycoonSlots(pid).then((d) => setSlots(d.slots)).catch((e2) => setErr(e2.message || 'Хранилище недоступно'));
  }, [pid]);
  const save = async (i) => {
    if (slots && slots[i] && !window.confirm('Перезаписать этот слот?')) return;
    setBusy(i); setErr('');
    try { setSlots(await saveTycoonSlot(pid, i, T.snapshotTycoon(st))); Audio.play('stamp'); toast('Сохранено', 'gold'); } catch (e2) { setErr(e2.message); }
    setBusy(null);
  };
  const load = async (i) => {
    if (!window.confirm('Загрузить? Текущая партия останется только в автосохранении, если её не сохранить.')) return;
    setBusy(i); setErr('');
    try { onLoad(await fetchTycoonSlot(pid, i)); } catch (e2) { setErr(e2.message); setBusy(null); }
  };
  const remove = async (i) => {
    if (!window.confirm('Удалить сохранение?')) return;
    try { setSlots(await deleteTycoonSlot(pid, i)); } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal title="Партии «Своего дела»" onClose={onClose}>
      <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Партия сама сохраняется в этом браузере каждые пять секунд. Слоты ниже — на сервере: их видно и на связанных устройствах.
      </div>
      {err && <div style={{ fontSize: 11.5, color: COLOR.rust, marginBottom: 8 }}>{err}</div>}
      {!slots && !err && <div style={{ fontSize: 11.5, color: COLOR.faint }}>Загружаем слоты…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(slots || []).map((sl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12, flexWrap: 'wrap' }}>
            <span className="ems-mono" style={{ color: COLOR.faint }}>{i + 1}</span>
            <span style={{ flex: '1 1 140px', minWidth: 0, color: sl ? COLOR.text : COLOR.faint }}>
              {sl ? `${quarterLabel(sl.quarterIndex || 1)} · ${sl.buildings} зданий · ${money(sl.cash || 0)}${sl.legacy ? ` · репутация ${sl.legacy}` : ''}` : 'пусто'}
              {sl && <span style={{ display: 'block', fontSize: 10, color: COLOR.faint }}>{new Date(sl.savedAt).toLocaleString('ru-RU')}</span>}
            </span>
            <button className="ems-btn" disabled={busy === i} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => save(i)}>{busy === i ? '…' : 'Сохранить сюда'}</button>
            {sl && <button className="ems-btn" disabled={busy === i} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => load(i)}>Загрузить</button>}
            {sl && <button onClick={() => remove(i)} aria-label="Удалить" style={{ background: 'none', border: 'none', color: COLOR.faint, cursor: 'pointer', lineHeight: 0 }}><X size={12} /></button>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------ ФИНАНСЫ ------------------------------ */
function MoneyTab({ st, act, onSell }) {
  const e = st.country.economy;
  const lim = T.creditLimitT(st);
  const debt = T.totalDebtT(st);
  const value = T.companyValue(st);
  const last = st.history[st.history.length - 1];
  const hard = e.politicalRegime === 'authoritarian' || e.politicalRegime === 'totalitarian';
  const canSell = value >= T.SELL_MIN_VALUE;
  const [fx, setFx] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><TrendingUp size={14} />Компания</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {[['Стоимость', money(value), 'оценка рынка'], ['Состояние владельца', money(T.ownerWealth(st)), 'в ценах старта'],
            ['Деньги', money(st.cash), 'на счёте'], ['Долг', money(debt), st.debtFx > 0 ? `валютный ${money(st.debtFx * e.exchangeRate / 100)}` : 'в рублях'],
            ['Ставка по долгу', `${fmt1(st.loanRate)}%`, `рынок ${fmt1(e.lendingRate)}%`], ['Банк даст ещё', money(lim), e.creditCrunch ? 'кредитное сжатие' : 'по EBITDA']].map(([k, v, sub]) => (
            <div key={k} style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, padding: '8px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: COLOR.faint }}>{k}</div>
              <div className="ems-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{v}</div>
              <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
        {st.history.length >= 2 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginBottom: 3 }}>Стоимость компании по кварталам</div>
            <MiniSpark series={st.history.map((h) => h.value)} color={COLOR.gold} />
          </div>
        )}
      </div>

      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><Landmark size={14} />Кредит</div>
        <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Проценты платятся раз в квартал. Рублёвый долг переоценивается по новой ставке постепенно, валютный дешевле
          ({fmt1(fxLoanRate(e))}% против {fmt1(e.lendingRate)}%), но растёт вместе с курсом.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0.25, 0.5, 1].map((k) => (
            <button key={k} className="ems-btn" disabled={lim < 0.05} style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => act((s) => T.borrow(s, T.creditLimitT(s) * k, fx), 'coin')}>Взять {k === 1 ? 'всё' : `${k * 100}%`} · {money(lim * k)}</button>
          ))}
          <button className="ems-btn" disabled={debt < 0.01 || st.cash <= 0} style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={() => act((s) => T.repay(s, Math.min(T.totalDebtT(s), s.cash * 0.5)))}>Погасить из половины денег</button>
        </div>
        <Toggle on={fx} onClick={() => setFx((v) => !v)} icon={Globe2} label={`Новые кредиты в валюте: ${fx ? 'да' : 'нет'}`}
          hint="Дешевле сейчас, опаснее при девальвации." />
      </div>

      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}><Handshake size={14} />Люди и власть</div>
        <PlanSlider label="Надбавка к рыночной зарплате" value={st.wagePremium} min={-10} max={30} step={1}
          hint="Больше рынка — быстрее набор людей. Урезание при низкой безработице кончается забастовкой."
          format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={(v) => act((s) => T.setField(s, { wagePremium: v }), null)} />
        <Toggle on={st.gr} onClick={() => act((s) => T.setField(s, { gr: !s.gr }), 'tick')} icon={Handshake}
          label={`Работа с властями (GR): ${st.gr ? 'ведётся' : 'нет'}`}
          hint={`Реже проверки${hard ? ' — при нынешнем режиме это важнее всего' : ''}.`} />
      </div>

      {last && (
        <div className="ems-panel" style={{ padding: 14 }}>
          <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6 }}>Итоги квартала · {last.label}</div>
          <Row k="Продажи в магазинах" v={money(last.retail)} />
          <Row k="Оптом" v={money(last.wholesale)} />
          {last.exports > 0 && <Row k="Экспорт" v={money(last.exports)} />}
          <Row k="Закупки сырья" v={`−${money(last.purchases)}`} />
          <Row k="Зарплаты" v={`−${money(last.wages)}`} />
          <Row k="Содержание зданий" v={`−${money(last.upkeep)}`} />
          <Row k="Перевозки" v={`−${money(last.transport)}`} />
          <Row k="Проценты" v={`−${money(last.interest)}`} />
          <Row k="Налог на прибыль" v={`−${money(last.tax)}`} />
          {last.fine > 0 && <Row k="Штрафы и «взносы»" v={`−${money(last.fine)}`} color={COLOR.rust} />}
          <Row k="Чистая прибыль" v={moneySigned(last.profit)} color={last.profit < 0 ? COLOR.rust : COLOR.teal} strong />
        </div>
      )}

      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><Trophy size={14} />Вехи</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {T.MILESTONES.map((m) => (
            <span key={m.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, border: `1px solid ${st.milestones[m.id] ? COLOR.gold : COLOR.border}`,
              color: st.milestones[m.id] ? COLOR.goldSoft : COLOR.faint }}>{st.milestones[m.id] ? '✓ ' : ''}{m.title}</span>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLOR.hairline}` }}>
          <div style={{ fontSize: 12, color: COLOR.text, marginBottom: 4 }}>Продать компанию</div>
          <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
            Когда компания стоит больше {money(T.SELL_MIN_VALUE)}, её можно продать и начать новое дело с репутацией:
            каждый пункт — +10% к выработке и спросу. Сейчас это дало бы +{T.legacyFor(value)}.
          </div>
          <button className="ems-btn" disabled={!canSell} onClick={onSell} style={{ padding: '6px 12px', fontSize: 12, borderColor: canSell ? COLOR.gold : COLOR.border }}>
            {canSell ? `Продать за ${money(value)}` : `Нужно ${money(T.SELL_MIN_VALUE)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ СТРАНА ------------------------------ */
function CountryTab({ st }) {
  const c = st.country; const e = c.economy; const p = c.prev || e;
  const d = (k) => (e[k] ?? 0) - (p[k] ?? 0);
  const rows = [
    ['Рост ВВП', `${fmtSigned1(e.gdpGrowth)}%`, d('gdpGrowth'), 'спрос во всех магазинах'],
    ['Инфляция', `${fmt1(e.inflation)}%`, d('inflation'), 'цены вашего товара и сырья, зарплаты'],
    ['Ключевая ставка', `${fmt1(e.keyRate)}%`, d('keyRate'), 'кредит, спрос на мебель и технику'],
    ['Курс', `${Math.round(e.exchangeRate)}`, d('exchangeRate'), 'экспортная выручка и импортные комплектующие'],
    ['Безработица', `${fmt1(e.unemployment)}%`, d('unemployment'), 'как быстро набираются люди'],
    ['Доверие потребителей', `${Math.round(e.consumerConfidence)}`, d('consumerConfidence'), 'спрос в магазинах'],
    ['Налог на прибыль', `${fmt1(e.profitTaxRate)}%`, d('profitTaxRate'), 'сколько останется после квартала'],
  ];
  const hints = [];
  if (e.creditCrunch) hints.push('Банки сжали кредит: лимит для бизнеса урезан.');
  if ((e.sanctionsQuartersLeft || 0) > 0) hints.push('Санкции: экспорт почти вдвое дешевле.');
  if ((e.warQuartersLeft || 0) > 0) hints.push('Война: оборонный заказ поднял цены стали и станков на четверть.');
  if (e.politicalRegime === 'authoritarian' || e.politicalRegime === 'totalitarian') hints.push('Жёсткий режим: проверки чаще и дороже, GR окупается.');
  if (st.events.regionHit) hints.push(`${st.events.regionHit.title}: ваши здания в области ${T.regionName(st.events.regionHit.region)} работают вполсилы.`);
  const scen = SCENARIOS.find((x) => x.id === st.setup.scenario);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 4 }}>Страна живёт сама</div>
        <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Квартал — минута игрового времени. ЦБ: {getCbPersona(c.cbPersona).name}, Минфин: {getMofPersona(c.mofPersona).name}
          {c.president ? `, президент: ${getPresPersona(c.presPersona).name}` : ''}. {scen && scen.id !== 'sandbox' ? `Сценарий: ${scen.title}.` : ''}
        </div>
        {rows.map(([k, v, dv, why]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, padding: '5px 0', borderBottom: `1px solid ${COLOR.hairline}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12 }}>{k}</div>
              <div style={{ fontSize: 10.5, color: COLOR.faint }}>{why}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ems-mono" style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              {Math.abs(dv) > 0.05 && <div className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint }}>{dv > 0 ? '+' : ''}{dv.toFixed(1)}</div>}
            </div>
          </div>
        ))}
        {hints.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hints.map((h) => <div key={h} style={{ fontSize: 11.5, color: COLOR.gold, display: 'flex', gap: 6 }}><AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />{h}</div>)}
          </div>
        )}
      </div>
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><Newspaper size={14} />Новости</div>
        {!st.news.length && <div style={{ fontSize: 11.5, color: COLOR.faint }}>Первые новости придут в конце квартала.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {st.news.slice(0, 30).map((n) => (
            <div key={n.id} style={{ borderLeft: `2px solid ${n.own ? COLOR.gold : COLOR.border}`, paddingLeft: 9 }}>
              <div style={{ fontSize: 10, color: COLOR.faint }}>{n.qLabel}{n.own ? ' · ваша компания' : ''}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: n.own ? COLOR.goldSoft : COLOR.text }}>{n.headline}</div>
              {n.text && <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.45 }}>{n.text}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// старт нового дела: выбор отрасли показан на экране новой партии, здесь — её подпись
export const startLabel = (id) => (SECTORS.find((s) => s.id === id) || SECTORS[0]).title;
