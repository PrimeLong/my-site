/* «Своё дело» — тайкун предпринимателя. Отдельный экран и отдельный чанк: игра в
   реальном времени, где страна (боты ЦБ, Минфина и президента) живёт фоном, а игрок
   строит производственные цепочки по областям карты. Модель — src/lib/tycoon.js,
   финансы и связь с макроэкономикой — src/lib/business.js, карта — BusinessMap
   в countrymap.jsx, ползунки и строки отчёта — src/business.jsx. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wheat, Trees, Pickaxe, Mountain, Factory, Store, Building2, Anchor, Warehouse, FlaskConical, Pause, Play,
  FastForward, Landmark, Coins, Newspaper, ArrowRight, Hammer, ArrowUpCircle, Power, Trash2, Handshake,
  Globe2, AlertTriangle, TrendingUp, X, Map as MapIcon, Boxes, Lock, Check, Trophy, DoorOpen, Save, Users, Gift, Sparkles, Swords, ChevronDown,
} from 'lucide-react';
import {
  COLOR, Audio, AudioControls, GlobalStyle, ACHIEVEMENTS, ACHIEVEMENTS_KEY, loadUnlockedAchievements, TYCOON_SAVE_KEY,
  TYCOON_META_KEY, loadTycoonMeta, getPlayerId, loadAccount, emblemIcon, loadFold, saveFold,
} from './MacroSimulator.jsx';
import { fetchTycoonSlots, fetchTycoonSlot, saveTycoonSlot, deleteTycoonSlot, fetchRecords, submitRecord } from './lib/client.js';
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
  /* пауза — цеха и грузовики на карте тоже замирают */
  .ty-paused .ty-work > span, .ty-paused .map-flow { animation-play-state: paused; }
  @media (prefers-reduced-motion: reduce) { .ty-work > span, .ty-pulse, .ty-toast { animation: none; } }
`;

// возвращает время сохранения — или 0, если браузер не дал записать
function saveLocal(st) {
  try { const snap = T.snapshotTycoon(st); localStorage.setItem(TYCOON_SAVE_KEY, JSON.stringify(snap)); return snap.savedAt; } catch { return 0; /* квота или приватный режим */ }
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
  const [showRecords, setShowRecords] = useState(false);
  const [toasts, setToasts] = useState([]);
  const stRef = useRef(st);
  stRef.current = st;
  // когда партия в последний раз легла в браузер — видно в шапке, чтобы не гадать, сохраняется ли она
  const discarded = useRef(false);
  const [savedAt, setSavedAt] = useState(() => (initial && Number(initial.savedAt)) || 0);

  const toast = (text, tone = 'info') => {
    const id = `${Date.now()}${Math.random()}`;
    setToasts((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3700);
  };

  // пока игрок читает вводные правила или сводку «пока вас не было», время стоит:
  // раньше деньги копились и квартал шёл, пока окно было открыто
  const held = !st.introSeen || !!offline;
  const heldRef = useRef(held);
  heldRef.current = held;
  // главный цикл: полсекунды реального времени — полсекунды игрового на скорость
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      if (heldRef.current) return;
      setSt((prev) => (prev.paused || prev.bankrupt ? prev : T.tick(prev, dt * prev.speed)));
    }, 500);
    return () => clearInterval(id);
  }, []);
  // автосохранение: сразу при входе, каждые пять секунд и при уходе со страницы
  useEffect(() => {
    const save = () => { if (discarded.current) return; const t = saveLocal(stRef.current); if (t) setSavedAt(t); };
    save();
    const id = setInterval(save, 5000);
    const onHide = () => { if (!discarded.current) saveLocal(stRef.current); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    // партию, выброшенную после банкротства, при закрытии экрана не записываем обратно
    return () => { clearInterval(id); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); if (!discarded.current) saveLocal(stRef.current); };
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
    if (T.quartersPlayed(st) >= 4 && T.ownerWealth(st) >= 3 * Math.max(1, st.value0 || 1)) ids.push('biz_triple');
    if (st.setup.scenario !== 'sandbox' && T.quartersPlayed(st) >= 12 && !st.bankrupt) ids.push('biz_survivor');
    unlockAch(ids).forEach((a) => { Audio.play('coin'); toast(`Достижение: ${a.title}`, 'gold'); });
    sendRecord(st);
    // смена квартала — веха: сохраняемся сразу, не дожидаясь пятисекундного таймера
    { const t = saveLocal(st); if (t) setSavedAt(t); }
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
  // где стоят магазины конкурентов — цветные метки у городов на карте
  const rivalKey = (st.rivals || []).map((c) => `${c.id}${c.alive && c.entered ? JSON.stringify(c.shops) : ''}`).join('|');
  const rivalMarks = useMemo(() => (st.rivals || []).filter((c) => c.alive && c.entered)
    .flatMap((c) => Object.entries(c.shops).filter(([, v]) => v > 0).map(([region, v]) => ({ region, color: COLOR[T.RIVAL[c.id].color], n: Math.round(v / 1.5), name: T.RIVAL[c.id].short }))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rivalKey]);
  const highlight = useMemo(() => {
    if (!hoverType) return null;
    const h = {};
    T.regionsOpen(st).forEach((r) => { const b = T.siteBonus(hoverType, r); if (b != null) h[r] = b; });
    return h;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverType, e.annexed && e.annexed.length]);

  // слой карты «где торговать»: пересчёт раз в пять секунд — спрос меняется медленно
  const [mapLayer, setMapLayer] = useState('mine');
  const tradeKey = Math.floor(st.t / 5);
  const shopOpp = useMemo(() => (mapLayer === 'trade' ? T.shopOpportunities(st) : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapLayer, tradeKey, st.buildings.length]);
  const demandLayer = useMemo(() => {
    if (!shopOpp) return null;
    const top = Math.max(1e-6, ...shopOpp.map((x) => x.gain));
    return Object.fromEntries(shopOpp.map((x) => [x.region, { k: x.gain / top, label: `+${money(x.gain)}/мин` }]));
  }, [shopOpp]);

  const tabs = [['build', 'Карта и стройка', MapIcon], ['prod', 'Производство', Factory], ['stock', 'Склад и рынок', Boxes],
    ['rivals', 'Конкуренты', Swords], ['lab', 'Исследования', FlaskConical], ['team', 'Команда', Users], ['money', 'Финансы', Coins], ['country', 'Страна', Landmark]];
  const mapPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 10 }}>
        <div role="group" aria-label="Слой карты" style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {[['mine', 'Мои здания'], ['trade', 'Где торговать']].map(([id, label]) => (
            <button key={id} className="ems-btn" aria-pressed={mapLayer === id} onClick={() => { Audio.play('tab'); setMapLayer(id); }}
              style={{ padding: '4px 10px', fontSize: 12, borderColor: mapLayer === id ? COLOR.gold : COLOR.border, color: mapLayer === id ? COLOR.goldSoft : COLOR.muted }}>{label}</button>
          ))}
        </div>
        <BusinessMap economy={e} selected={region} onSelect={setRegion} info={mapInfo} flows={mapLayer === 'trade' ? [] : flows}
          highlight={highlight} hit={st.events.regionHit ? st.events.regionHit.region : null} routes={T.ROUTE_LINKS} rivals={rivalMarks} demand={demandLayer} />
        {mapLayer === 'trade' && shopOpp && <TradePanel st={st} opp={shopOpp} onPick={setRegion} />}
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 6, lineHeight: 1.45 }}>
          Нажмите на область, чтобы строить там. Золотые линии — ваши грузы между областями: чем толще, тем больше везёте
          (перевозка стоит денег, соседство цехов экономит). Наведите на здание в списке — карта покажет, где оно работает лучше.
        </div>
      </div>
      <RegionPanel st={st} region={region} act={act} setHoverType={setHoverType} />
    </div>
  );

  return (
    <div className={`ems-root${st.paused || st.bankrupt || held ? ' ty-paused' : ''}`} style={{ minHeight: '100vh', '--ty-track': COLOR.border }}>
      <GlobalStyle />
      <style>{TY_CSS}</style>
      <TyHeader st={st} setSt={setSt} savedAt={savedAt} onExit={() => { saveLocal(stRef.current); onExit(); }} onSaves={() => { Audio.play('click'); setShowSaves(true); }}
        onRecords={() => { Audio.play('click'); setShowRecords(true); }} />
      {showRecords && <RecordsModal st={st} onClose={() => setShowRecords(false)} />}
      <QuestCard st={st} act={act} onGo={(t) => { Audio.play('tab'); setTab(t); }} />
      {st.log[0] && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: COLOR.muted, borderBottom: `1px solid ${COLOR.hairline}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ArrowRight size={12} color={COLOR.gold} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, flex: '1 1 240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.log[0].text}</span>
          {nextGoal && <span style={{ fontSize: 12, color: COLOR.goldSoft, whiteSpace: 'nowrap' }}><Trophy size={11} style={{ verticalAlign: -1 }} /> следующая веха: {nextGoal.title}</span>}
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
            {tab === 'rivals' && <RivalsTab st={st} act={act} onRegion={(r) => { setRegion(r); if (narrow) setTab('build'); }} />}
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
          <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div><b style={{ color: COLOR.text }}>Время идёт само.</b> Деньги капают каждую секунду, раз в минуту проходит квартал страны — налоги, проценты, новости. Пауза и скорость — в шапке.</div>
            <div><b style={{ color: COLOR.text }}>Цепочки.</b> Сырьё → переработка → магазин. Чем дальше по цепочке, тем дороже товар; рядом стоящие цеха экономят на перевозке.</div>
            <div><b style={{ color: COLOR.text }}>Вы не одни.</b> «Колос», «Северолес», «Стальной союз», а позже вестравские гипермаркеты делят с вами покупателей и оптовый рынок. Сидеть на месте — терять долю. Их можно пережить, купить или договориться с ними — вкладка «Конкуренты».</div>
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
            Предприятия работали без присмотра — вполсилы. Страна ждала вас, а компания жила своей жизнью:
            платила проценты и налог, гасила кредит, встречала проверки и ходы конкурентов.
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
            <button className="ems-btn" style={{ flex: 1 }} onClick={() => { discarded.current = true; try { localStorage.removeItem(TYCOON_SAVE_KEY); } catch { /* нет */ } onExit(); }}>В меню</button>
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

/* Рекорд уходит в общую таблицу раз в квартал страны и только если вырос заметно
   (на 2%): таблица — про лучший результат, а не про каждую минуту игры. */
const RECORD_SENT_KEY = 'ems-tycoon-record-sent';
function sendRecord(st) {
  const account = loadAccount();
  if (!account) return;
  const value = T.companyValue(st);
  let sent = 0;
  try { sent = Number(localStorage.getItem(RECORD_SENT_KEY)) || 0; } catch { /* приватный режим */ }
  if (!(value > 0) || value <= sent * 1.02) return;
  try { localStorage.setItem(RECORD_SENT_KEY, String(value)); } catch { /* приватный режим */ }
  submitRecord(account.token, { value, start: st.setup.start, quarters: T.quartersPlayed(st), legacy: st.legacy || 0 }).catch(() => {
    try { localStorage.setItem(RECORD_SENT_KEY, String(sent)); } catch { /* повторим в следующем квартале */ }
  });
}

const START_LABEL = { farm: 'ферма', retail: 'лавка', factory: 'лесопилка' };
function RecordsModal({ st, onClose }) {
  const account = loadAccount();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    fetchRecords('tycoon', account ? account.login : undefined)
      .then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rows = (data && data.rows) || [];
  const you = data && data.you && !rows.some((r) => r.you) ? data.you : null;
  const row = (r) => {
    const Em = emblemIcon(r.emblem);
    return (
      <div key={r.login} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: 8, alignItems: 'center', padding: '6px 9px', fontSize: 12,
        background: r.you ? COLOR.goldDim : COLOR.panelAlt, border: `1px solid ${r.you ? COLOR.gold : COLOR.border}` }}>
        <span className="ems-mono" style={{ color: r.rank <= 3 ? COLOR.gold : COLOR.faint, fontWeight: 600 }}>{r.rank}</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Em size={11} color={COLOR.gold} style={{ verticalAlign: -1, marginRight: 4 }} />{r.name}{r.you ? ' (вы)' : ''}
          <span style={{ color: COLOR.faint, fontSize: 12 }}>{r.start ? ` · ${START_LABEL[r.start] || r.start}` : ''}{r.legacy ? ` · репутация ${r.legacy}` : ''}</span>
        </span>
        <span className="ems-mono" style={{ fontWeight: 600, color: r.you ? COLOR.gold : COLOR.text }}>{money(r.value)}</span>
      </div>
    );
  };
  return (
    <Modal title="Рекорды «Своего дела»" onClose={onClose}>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Лучшая стоимость компании каждого игрока. Ваша сейчас — <b className="ems-mono" style={{ color: COLOR.text }}>{money(T.companyValue(st))}</b>.
        {account ? ' Рекорд записывается сам раз в квартал, когда растёт.' : ' Чтобы попасть в таблицу, войдите в профиль в главном меню.'}
      </div>
      {err && <div style={{ fontSize: 12, color: COLOR.rust }}>{err}</div>}
      {!data && !err && <div style={{ fontSize: 12, color: COLOR.faint }}>Загружаем…</div>}
      {data && !rows.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Пока пусто — станьте первым.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '55vh', overflowY: 'auto' }}>
        {rows.map(row)}
        {you && <div style={{ textAlign: 'center', color: COLOR.faint, fontSize: 12, lineHeight: 1 }}>⋯</div>}
        {you && row(you)}
      </div>
    </Modal>
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
function savedAgo(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 5 ? 'только что' : s < 60 ? `${s} с назад` : `${Math.round(s / 60)} мин назад`;
}
function TyHeader({ st, setSt, savedAt, onExit, onSaves, onRecords }) {
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
          <div className="ems-serif" style={{ fontSize: 16 }}>Своё дело{st.legacy ? <span style={{ fontSize: 12, color: COLOR.gold, marginLeft: 6 }}>репутация {st.legacy}</span> : null}</div>
          <div style={{ fontSize: 12, color: COLOR.muted }}>{quarterLabel(st.country.quarterIndex)} · {regime.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="ems-mono" style={{ fontSize: 24, fontWeight: 600, color: st.cash < 0 ? COLOR.rust : COLOR.goldSoft }} aria-label="Деньги на счёте">{money(st.cash)}</span>
        <span className="ems-mono" style={{ fontSize: 12, color: net >= 0 ? COLOR.teal : COLOR.rust }}>{moneySigned(net * 60)}/мин</span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>стоимость <b className="ems-mono" style={{ color: COLOR.text }}>{money(value)}</b></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <div title="До конца квартала: страна сделает ход, придут налоги и проценты" style={{ width: 90 }}>
          <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 3 }}>квартал {Math.round(qp * 100)}%</div>
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
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={onRecords}>
          <Trophy size={13} />Рекорды
        </button>
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={onSaves}>
          <Save size={13} />Партии
        </button>
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={onExit}>
          <DoorOpen size={13} />Меню
        </button>
      </div>
      <div style={{ flexBasis: '100%', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(([k, v]) => (
          <span key={k} className="ems-mono" style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${COLOR.border}`, borderRadius: 999, color: COLOR.muted, background: COLOR.panelAlt }}>
            {k} <b style={{ color: COLOR.text }}>{v}</b>
          </span>
        ))}
        {(e.activeCrises || []).length > 0 && (
          <span style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${COLOR.rust}`, borderRadius: 999, color: COLOR.rust, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} />кризис
          </span>
        )}
        {st.paused && <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: COLOR.goldDim, color: COLOR.goldSoft }}>пауза</span>}
        {/* прогресс к «Выжить в кризис» — видно, что считается и сколько осталось */}
        {st.setup.scenario !== 'sandbox' && !st.bankrupt && (
          <span title="Достижение «Выжить в кризис»: 12 кварталов кризисного сценария без банкротства"
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: `1px solid ${COLOR.border}`, color: T.quartersPlayed(st) >= 12 ? COLOR.teal : COLOR.muted }}>
            кризис: {Math.min(12, T.quartersPlayed(st))} из 12 кв.
          </span>
        )}
        <span aria-live="off" title="Партия сама сохраняется в этом браузере каждые пять секунд, в конце квартала и при закрытии вкладки; после перезагрузки страницы она откроется с того же места"
          style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 8px', borderRadius: 999, color: savedAt ? COLOR.teal : COLOR.rust, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Save size={11} />{savedAt ? `автосохранение · ${savedAgo(savedAt)}` : 'браузер не даёт сохранять'}
        </span>
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
        <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>{T.regionFullName(reg)}</span>
        <span style={{ fontSize: 12, color: COLOR.faint }}>участков {used} из {slots}</span>
        <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 9px', fontSize: 12 }}
          onClick={() => act((s) => T.buySlot(s, reg), 'coin')}>+ участок · {money(T.slotCost(st, reg))}</button>
      </div>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
        {info.sector} · покупателей {Math.round(info.pop * 100)}% страны · зарплаты {info.wage >= 1 ? '+' : ''}{Math.round((info.wage - 1) * 100)}% к среднему ·
        настроение <span style={{ color: info.mood < 0.9 ? COLOR.rust : info.mood > 1.05 ? COLOR.teal : COLOR.text }}>{info.mood < 0.9 ? 'тревожное' : info.mood > 1.05 ? 'хорошее' : 'обычное'}</span>
        {info.hit ? <span style={{ color: COLOR.rust }}> · {info.hit}</span> : null}
      </div>
      {(() => {
        const here2 = (st.rivals || []).filter((c) => c.alive && c.entered && (c.shops[reg] || 0) > 0);
        if (!here2.length) return null;
        return (
          <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Swords size={11} color={COLOR.rust} />Конкуренты здесь:
            {here2.map((c) => (
              <span key={c.id} style={{ color: COLOR[T.RIVAL[c.id].color] }}>
                {T.RIVAL[c.id].short} — {Math.round(c.shops[reg] / 1.5)} маг.{c.markup < -1 ? `, цены ${Math.round(c.markup)}%` : ''}
              </span>
            ))}
          </div>
        );
      })()}
      {here.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 12px' }}>
          {here.map((b) => <BuildingCard key={b.uid} st={st} b={b} act={act} compact />)}
        </div>
      )}
      <div style={{ fontSize: 12, color: COLOR.faint, margin: '6px 0' }}>Что можно построить здесь</div>
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
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{d.name}</span>
                {bonus !== 1 && <span className="ems-mono" style={{ fontSize: 12, color: bonus > 1 ? COLOR.teal : COLOR.rust }}>×{bonus.toFixed(2)}</span>}
              </div>
              <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.4, flex: 1 }}>{recipeText(d)}</div>
              <button className="ems-btn" disabled={!!err} title={err || ''} style={{ padding: '5px 8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                borderColor: err ? COLOR.border : COLOR.gold, color: err ? COLOR.faint : COLOR.goldSoft }}
                onClick={() => act((s) => T.build(s, d.id, reg), 'stamp')}>
                <Hammer size={11} />{money(d.cost)}
              </button>
            </div>
          );
        })}
      </div>
      {locked.length > 0 && (
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
          <Lock size={11} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>После исследований: {locked.map((d) => `${d.name.toLowerCase()} (${T.RSR[d.unlock].name})`).join(', ')}.</span>
        </div>
      )}
    </div>
  );
}

// что происходит со зданием — одной строкой; «плохо» — всё, кроме работы и набора людей
function buildingStatus(st, b) {
  const d = T.BLD[b.type];
  const run = st.stats.runK && st.stats.runK[b.uid] != null ? st.stats.runK[b.uid] : (d.out ? 0 : 1);
  const need = T.requiredStaff(st, b);
  const struck = st.events.strike && st.events.strike.uid === b.uid && st.t < st.events.strike.until;
  const status = !b.enabled ? 'остановлено' : struck ? 'забастовка' : b.staff < need - 0.5 ? `набор людей ${Math.floor(b.staff)}/${need}`
    : d.out && run < 0.95 ? (run < 0.05 ? 'нет сырья или места на складе' : `простаивает ${Math.round((1 - run) * 100)}%`) : 'работает';
  return { run, need, status, bad: status !== 'работает' && !status.startsWith('набор') };
}

function BuildingCard({ st, b, act, compact, onLocate }) {
  const d = T.BLD[b.type];
  const Icon = ICONS[d.icon] || Factory;
  const power = T.buildingPower(st, b);
  const { run, status, bad } = buildingStatus(st, b);
  const eff = power * (d.out ? run : 1);
  const mainRate = d.out ? Object.values(d.out)[0] * eff : d.sells ? d.sells * power : d.exports ? d.exports * power : d.research ? d.research * power : 0;
  const cycle = mainRate > 0.01 ? Math.min(8, 1 / mainRate) : 0;
  const upCost = T.upgradeCost(b);
  return (
    <div style={{ background: COLOR.panelAlt, border: `1px solid ${bad ? `${COLOR.rust}88` : COLOR.border}`, padding: compact ? '8px 10px' : '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon size={15} color={COLOR[CAT_COLOR[d.cat]]} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
        <span className="ems-mono" style={{ fontSize: 12, color: COLOR.gold }}>ур. {b.level}</span>
        {!compact && (
          <button onClick={onLocate} style={{ background: 'none', border: 'none', padding: 0, color: COLOR.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline dotted' }}>
            {T.regionName(b.region)}
          </button>
        )}
        <span style={{ fontSize: 12, color: bad ? COLOR.rust : COLOR.faint, marginLeft: 'auto' }}>{status}</span>
      </div>
      <div className="ty-work" style={{ margin: '7px 0 5px' }}>
        {cycle > 0 && b.enabled && <span style={{ background: COLOR[CAT_COLOR[d.cat]], animationDuration: `${cycle.toFixed(2)}s` }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: COLOR.muted, flex: 1, minWidth: 140 }}>
          {d.out ? `${Object.keys(d.out).map((r) => `${T.RES[r].name}: ${perMin(d.out[r] * eff)}/мин`).join(', ')}`
            : d.sells ? `до ${perMin(d.sells * power)} покупок/мин` : d.exports ? `до ${perMin(d.exports * power)} ед./мин на экспорт`
              : d.research ? `${perMin(d.research * power)} очков/мин` : d.storage ? `склад +${Math.round(d.storage * T.levelMult(b.level))}` : ''}
          {' · '}{Math.floor(b.staff)} чел.
        </span>
        <button className="ems-btn" disabled={b.level >= T.MAX_LEVEL || st.cash < upCost} style={{ padding: '3px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
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

/* «Где торговать»: лучшие области для нового магазина и выгода экспорта по товарам. */
function TradePanel({ st, opp, onPick }) {
  const exp = T.exportOpportunities(st);
  const goods = (opp[0] && opp[0].goods) || [];
  return (
    <div style={{ marginTop: 8, fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
      <div>Ярче — выгоднее. Цифра — сколько выручки в минуту принёс бы ещё один магазин ({goods.join(', ') || 'ваши товары'}) при достаточном запасе товара:
        покупатели области минус доля конкурентов и ваши полки, которые там уже стоят.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
        {opp.slice(0, 5).map((x) => (
          <button key={x.region} className="ems-btn ghost" onClick={() => onPick(x.region)}
            style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 6px', fontSize: 12, textAlign: 'left' }}>
            <span style={{ color: COLOR.text, minWidth: 110 }}>{T.regionName(x.region)}</span>
            <span className="ems-mono" style={{ color: COLOR.blue }}>+{money(x.gain)}/мин</span>
            <span style={{ marginLeft: 'auto', color: COLOR.faint }}>
              {x.mine > 0 ? `ваших полок ${Math.round(x.mine / T.BLD.shop.sells)}` : 'вас там нет'}{x.rivals > 0 ? ` · конкурентов ${Math.round(x.rivals / 1.5)}` : ''}
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, color: COLOR.text }}>Мировой экспорт — через терминал в {exp[0] && exp[0].ports.length ? exp[0].ports.map(T.regionName).join(', ') : 'порту'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
        {exp.slice(0, 6).map((x) => (
          <div key={x.id} style={{ display: 'flex', gap: 8 }}>
            <span style={{ minWidth: 110, color: x.have ? COLOR.text : COLOR.muted }}>{x.name}{x.have ? ' · есть на складе' : ''}</span>
            <span className="ems-mono" style={{ color: x.edge > 0.05 ? COLOR.teal : x.edge < -0.05 ? COLOR.rust : COLOR.faint }}>
              {x.edge >= 0 ? '+' : '−'}{Math.abs(Math.round(x.edge * 100))}% к опту
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4, color: COLOR.faint }}>Санкции, война и дорогой курс съедают экспортную выгоду — список пересчитывается вместе с экономикой.</div>
    </div>
  );
}

/* ------------------------------ ПРОИЗВОДСТВО ------------------------------ */
/* К середине партии зданий десятки, и все шли одной лентой — до нужного приходилось
   долго листать. Теперь сверху фильтры (отрасль, область, «только проблемные»), а
   одинаковые здания собраны в сворачиваемую строку «Ферма ×6» со сводкой. Фильтры
   помнятся в этом браузере. */
const PROD_FILTER_KEY = 'ems.ty.prodFilter';
const loadProdFilter = () => {
  try { const v = JSON.parse(localStorage.getItem(PROD_FILTER_KEY) || '{}'); return { cat: v.cat || 'all', region: v.region || 'all', bad: !!v.bad }; } catch { return { cat: 'all', region: 'all', bad: false }; }
};

function ProductionTab({ st, act, setRegion }) {
  const [filter, setFilterRaw] = useState(loadProdFilter);
  const setFilter = (patch) => setFilterRaw((f) => {
    const n = { ...f, ...patch };
    try { localStorage.setItem(PROD_FILTER_KEY, JSON.stringify(n)); } catch { /* приватный режим */ }
    return n;
  });
  const statuses = Object.fromEntries(st.buildings.map((b) => [b.uid, buildingStatus(st, b)]));
  const regions = Array.from(new Set(st.buildings.map((b) => b.region)));
  // область из фильтра могла опустеть (здание снесли) — тогда показываем все
  const region = filter.region !== 'all' && regions.includes(filter.region) ? filter.region : 'all';
  const badCount = st.buildings.filter((b) => statuses[b.uid].bad).length;
  const shown = st.buildings.filter((b) => (filter.cat === 'all' || T.BLD[b.type].cat === filter.cat)
    && (region === 'all' || b.region === region) && (!filter.bad || statuses[b.uid].bad));
  const cats = ['extract', 'process', 'sell', 'support'].filter((c) => st.buildings.some((b) => T.BLD[b.type].cat === c));
  const groups = cats.map((c) => [c, shown.filter((b) => T.BLD[b.type].cat === c)]).filter(([, l]) => l.length);
  const wages = st.buildings.reduce((a, b) => a + b.staff, 0);
  const chip = (on) => ({ padding: '4px 10px', fontSize: 12, borderRadius: 999, borderColor: on ? COLOR.gold : COLOR.border, color: on ? COLOR.goldSoft : COLOR.muted });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: COLOR.muted }}>
        <span>Зданий: <b style={{ color: COLOR.text }}>{st.buildings.length}</b></span>
        <span>Работников: <b style={{ color: COLOR.text }}>{Math.round(wages)}</b></span>
        <span>Выручка: <b className="ems-mono" style={{ color: COLOR.teal }}>{money(st.stats.income * 60)}/мин</b></span>
        <span>Расходы: <b className="ems-mono" style={{ color: COLOR.rust }}>{money(st.stats.costs * 60)}/мин</b></span>
      </div>
      {st.buildings.length > 3 && (
        <div role="group" aria-label="Фильтры зданий" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="ems-btn" aria-pressed={filter.cat === 'all'} style={chip(filter.cat === 'all')} onClick={() => setFilter({ cat: 'all' })}>Все</button>
          {cats.map((c) => (
            <button key={c} className="ems-btn" aria-pressed={filter.cat === c} style={chip(filter.cat === c)} onClick={() => setFilter({ cat: filter.cat === c ? 'all' : c })}>
              {CAT_LABEL[c]} <span className="ems-mono" style={{ color: COLOR.faint }}>{st.buildings.filter((b) => T.BLD[b.type].cat === c).length}</span>
            </button>
          ))}
          {badCount > 0 && (
            <button className="ems-btn" aria-pressed={filter.bad} onClick={() => setFilter({ bad: !filter.bad })}
              style={{ ...chip(filter.bad), borderColor: filter.bad ? COLOR.rust : COLOR.border, color: filter.bad ? COLOR.rust : COLOR.muted }}>
              <AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 4 }} />с проблемами {badCount}
            </button>
          )}
          {regions.length > 1 && (
            <select className="ems-btn" aria-label="Область" value={region} onChange={(e) => setFilter({ region: e.target.value })}
              style={{ ...chip(region !== 'all'), marginLeft: 'auto', maxWidth: '100%' }}>
              <option value="all">Все области</option>
              {regions.map((r) => <option key={r} value={r}>{T.regionName(r)} ({st.buildings.filter((b) => b.region === r).length})</option>)}
            </select>
          )}
        </div>
      )}
      {groups.length === 0 && (
        <div className="ems-panel" style={{ padding: 12, fontSize: 12, color: COLOR.muted }}>
          {filter.bad ? 'Под эти фильтры проблемных зданий нет — всё работает.' : 'Под эти фильтры зданий нет.'}{' '}
          <button className="ems-btn ghost" style={{ fontSize: 12, padding: '2px 6px' }} onClick={() => setFilter({ cat: 'all', region: 'all', bad: false })}>Сбросить фильтры</button>
        </div>
      )}
      {groups.map(([cat, list]) => {
        const byType = [];
        list.forEach((b) => { const g = byType.find((x) => x[0] === b.type); if (g) g[1].push(b); else byType.push([b.type, [b]]); });
        return (
          <div key={cat} className="ems-panel" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{CAT_LABEL[cat]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byType.map(([type, same]) => {
                const cards = same.map((b) => <BuildingCard key={b.uid} st={st} b={b} act={act} onLocate={() => setRegion(b.region)} />);
                if (same.length < 3) return <React.Fragment key={type}>{cards}</React.Fragment>;
                const bad = same.filter((b) => statuses[b.uid].bad).length;
                return (
                  <FoldRow key={type} id={`prod.${type}`} title={`${T.BLD[type].name} ×${same.length}`}
                    summary={<span style={{ color: bad ? COLOR.rust : COLOR.faint }}>{bad ? `с проблемами: ${bad}` : 'все в порядке'}</span>}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{cards}</div>
                  </FoldRow>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ СКЛАД И РЫНОК ------------------------------ */
/* Сворачиваемая строка внутри карточки: заголовок со сводкой, по нажатию — содержимое.
   Положение помнится между заходами (как у панелей партии за государство). */
function FoldRow({ id, title, summary, children }) {
  const [open, setOpen] = useState(() => loadFold(id, false));
  const toggle = () => { const v = !open; setOpen(v); saveFold(id, v); };
  return (
    <div style={{ marginTop: 6 }}>
      <button className="ems-btn ghost" aria-expanded={open} onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12, textAlign: 'left' }}>
        <ChevronDown size={13} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .2s ease', flexShrink: 0 }} />
        <span style={{ color: COLOR.text }}>{title}</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', color: COLOR.goldSoft }}>{summary}</span>
      </button>
      {open && <div style={{ marginTop: 2 }}>{children}</div>}
    </div>
  );
}

function StockTab({ st, act }) {
  const cap = T.storageCap(st);
  const usedInputs = new Set(); const produced = new Set();
  st.buildings.forEach((b) => { const d = T.BLD[b.type]; if (d.in) Object.keys(d.in).forEach((r) => usedInputs.add(r)); if (d.out) Object.keys(d.out).forEach((r) => produced.add(r)); });
  const hasTerminal = st.buildings.some((b) => T.BLD[b.type].exports);
  const hasShops = st.buildings.some((b) => T.BLD[b.type].sells);
  const list = T.RESOURCES.filter((r) => produced.has(r.id) || usedInputs.has(r.id) || (st.stock[r.id] || 0) > 0.5);
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10, lineHeight: 1.5 }}>
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
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                <span className="ems-mono" style={{ fontSize: 12, color: full > 0.95 ? COLOR.rust : COLOR.text }}>{units(stock)} {r.unit}</span>
                <span className="ems-mono" style={{ fontSize: 12, color: net >= 0 ? COLOR.teal : COLOR.rust }}>{net >= 0 ? '+' : ''}{perMin(net)}/мин</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint }}>
                  опт: купить {money(T.buyPrice(st, r.id))} · продать {money(T.sellPrice(st, r.id))}
                </span>
              </div>
              <div style={{ height: 3, background: COLOR.border, borderRadius: 2, overflow: 'hidden', margin: '6px 0' }}>
                <div style={{ width: `${Math.min(100, full * 100)}%`, height: '100%', background: full > 0.95 ? COLOR.rust : COLOR.gold, transition: 'width .5s linear' }} />
              </div>
              <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                  <span style={{ fontSize: 12, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    держать запас
                    <button className="ems-btn" style={{ padding: '1px 7px', fontSize: 12 }} aria-label="Меньше запас"
                      onClick={() => act((s) => T.setMap(s, 'reserve', r.id, Math.max(0, (s.reserve[r.id] || 0) - 20)), 'tick')}>−</button>
                    <span className="ems-mono" style={{ color: COLOR.text, minWidth: 26, textAlign: 'center' }}>{st.reserve[r.id] || 0}</span>
                    <button className="ems-btn" style={{ padding: '1px 7px', fontSize: 12 }} aria-label="Больше запас"
                      onClick={() => act((s) => T.setMap(s, 'reserve', r.id, Math.min(cap, (s.reserve[r.id] || 0) + 20)), 'tick')}>+</button>
                  </span>
                )}
              </div>
              {r.consumer && (
                <FoldRow id={`price.${r.id}`} title={`Цена в магазинах: ${money(T.retailPrice(st, r.id))}`}
                  summary={`${(st.markup[r.id] || 0) > 0 ? '+' : ''}${st.markup[r.id] || 0}% к рынку`}>
                  <PlanSlider label={`Цена в магазинах: ${money(T.retailPrice(st, r.id))}`} value={st.markup[r.id] || 0} min={-20} max={40} step={1}
                    hint={hasShops
                      ? `Дешевле рынка — больше покупателей, дороже — выше маржа. Не хватило товара или полок: ${perMin(st.stats.unmet[r.id] || 0)}/мин.`
                      : 'Нужен магазин: без него товар идёт только оптом.'}
                    format={(v) => `${v > 0 ? '+' : ''}${v}% к рынку`} onChange={(v) => act((s) => T.setMap(s, 'markup', r.id, v), null)} />
                </FoldRow>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Конкуренты: доли рынка по товарам, карточки компаний с их положением и что с ними
   можно сделать — купить или договориться о ценах. */
const RIVAL_TONE = { grow: 'gold', hold: 'muted', war: 'rust', retreat: 'teal', cartel: 'blue', wait: 'faint', gone: 'faint', bought: 'teal' };
function RivalsTab({ st, act, onRegion }) {
  const shares = T.marketShares(st);
  const goods = T.RESOURCES.filter((r) => r.consumer && (shares[r.id] || (st.stats.rates[r.id] || {}).sold > 0));
  const risk = Math.round(T.cartelFineRisk(st) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 4 }}>Доля рынка</div>
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
          Покупатели области делятся между магазинами: у кого больше полок и ниже цены — тому больше людей.
          Цены в магазинах задаются во вкладке «Склад и рынок».
        </div>
        {goods.length === 0 && <div style={{ fontSize: 12, color: COLOR.faint }}>Вы пока не продаёте людям — делить нечего.</div>}
        {goods.map((g) => {
          const sh = shares[g.id] || { mine: 1, rivals: {} };
          const parts = [['you', sh.mine, COLOR.gold, 'вы'], ...Object.entries(sh.rivals).map(([id, v]) => [id, v, COLOR[T.RIVAL[id].color], T.RIVAL[id].short])];
          return (
            <div key={g.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <b>{g.name}</b><span className="ems-mono" style={{ color: COLOR.goldSoft }}>вы {Math.round(sh.mine * 100)}%</span>
              </div>
              <div role="img" aria-label={`${g.name}: ${parts.map(([, v, , n]) => `${n} ${Math.round(v * 100)}%`).join(', ')}`}
                style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: COLOR.panelAlt }}>
                {parts.map(([id, v, c]) => <div key={id} style={{ width: `${v * 100}%`, background: c, transition: 'width .6s ease' }} />)}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: COLOR.muted, marginTop: 3 }}>
                {parts.slice(1).map(([id, v, c, n]) => <span key={id}><span style={{ color: c }}>●</span> {n} {Math.round(v * 100)}%</span>)}
              </div>
            </div>
          );
        })}
      </div>
      {(st.rivals || []).map((c) => {
        const def = T.RIVAL[c.id];
        const tone = COLOR[RIVAL_TONE[c.alive ? c.mode : c.mode] || 'muted'];
        const shops = Object.entries(c.shops || {}).filter(([, v]) => v > 0);
        const price = T.rivalPrice(st, c.id);
        const buyErr = T.canBuyRival(st, c.id);
        const live = c.alive && c.entered;
        const supplies = Object.entries(c.supply || {}).filter(([, v]) => v > 0.02);
        return (
          <div key={c.id} className="ems-panel" style={{ padding: 14, borderLeft: `3px solid ${COLOR[def.color]}`, opacity: c.alive ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="ems-serif" style={{ fontSize: 15 }}>{def.name}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, border: `1px solid ${tone}`, color: tone }}>
                {T.RIVAL_MODE_LABEL[c.mode] || c.mode}{c.mode === 'war' || c.mode === 'cartel' ? ` · ещё ${c.modeQ} кв.` : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, margin: '5px 0 8px' }}>{def.about}</div>
            {live && (
              <>
                {def.goods.length > 0 && <Row k="Цены" v={c.markup >= 0 ? `+${Math.round(c.markup)}% к рынку` : `${Math.round(c.markup)}% к рынку`} />}
                {shops.length > 0 && (
                  <div style={{ fontSize: 12, margin: '4px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: COLOR.faint }}>Магазины:</span>
                    {shops.map(([r, v]) => (
                      <button key={r} className="ems-btn ghost" style={{ padding: '0 4px', fontSize: 12 }} onClick={() => onRegion(r)}>
                        {T.regionName(r)} ×{Math.round(v / 1.5)}
                      </button>
                    ))}
                  </div>
                )}
                {supplies.length > 0 && <Row k="Льёт на оптовый рынок" v={supplies.map(([r]) => T.RES[r].name.toLowerCase()).join(', ')} />}
                <Row k="Положение" v={c.distress > 0 ? 'в долгах' : c.profitQ > 1 ? 'прибыльна' : c.profitQ > 0 ? 'еле в плюсе' : 'в убытке'} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <button className="ems-btn" disabled={!!buyErr} title={buyErr || 'Её магазины станут вашими'}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={() => { if (window.confirm(`Купить «${def.short}» за ${money(price)}?`)) act((s) => T.buyRival(s, c.id), 'stamp'); }}>
                    Купить · {money(price)}
                  </button>
                  {def.goods.length > 0 && c.mode !== 'cartel' && (
                    <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12 }}
                      title={`Согласится с вероятностью около ${Math.round(T.cartelChance(st, c.id) * 100)}%. Пока договорённость действует, каждый квартал ${risk}% риска штрафа 15% денег.`}
                      onClick={() => act((s) => T.proposeCartel(s, c.id))}>
                      Договориться о ценах · шанс {Math.round(T.cartelChance(st, c.id) * 100)}%
                    </button>
                  )}
                </div>
                {c.mode === 'cartel' && (
                  <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 6 }}>
                    Держите свои цены не ниже +5% — иначе договор рухнет. Риск штрафа антимонопольной службы — {risk}% в квартал.
                  </div>
                )}
              </>
            )}
            {!c.entered && c.alive && <div style={{ fontSize: 12, color: COLOR.faint }}>Выйдет на рынок позже{def.foreign ? ' — если с Вестравией всё будет в порядке' : ''}.</div>}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ on, onClick, children, disabled }) {
  return (
    <button className="ems-btn" aria-pressed={on} disabled={disabled} onClick={onClick}
      style={{ padding: '3px 9px', fontSize: 12, borderRadius: 999, borderColor: on ? COLOR.gold : COLOR.border,
        background: on ? COLOR.goldDim : 'transparent', color: on ? COLOR.goldSoft : COLOR.muted }}>
      {on && <Check size={10} style={{ verticalAlign: -1, marginRight: 3 }} />}{children}
    </button>
  );
}

/* ------------------------------ ИССЛЕДОВАНИЯ: ДЕРЕВО ------------------------------
   Узлы стоят по колонкам (tier) и строкам-веткам (row), линии — зависимости. На узком
   экране дерево прокручивается вбок внутри своей рамки, страница — нет. */
const NODE_W = 176; const NODE_H = 92; const GAP_X = 44; const GAP_Y = 18;
/* Широкое дерево листается не только полосой прокрутки: его можно тянуть пальцем или
   мышью за любую точку. Вертикаль остаётся странице (touch-action: pan-y), горизонталь
   ведём сами; клик после перетаскивания не открывает узел. */
function useDragScroll() {
  const ref = useRef(null);
  const d = useRef(null);
  /* Раньше при сильном рывке дерево «колбасило»: мышь одновременно начинала выделять
     текст узлов, а выделение само прокручивает рамку к краю — две прокрутки спорили.
     Теперь выделение на время жеста отключено, а сдвиг применяется раз в кадр. */
  const apply = () => {
    const g = d.current;
    if (!g) return;
    g.raf = 0;
    if (ref.current) ref.current.scrollLeft = g.left - g.dx;
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.button && e.button !== 0) return;
      d.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false, id: e.pointerId, dx: 0, raf: 0 };
    },
    onPointerMove: (e) => {
      const g = d.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      if (!g.moved && Math.abs(dx) < 6) return;
      if (!g.moved) {
        g.moved = true;
        try { ref.current.setPointerCapture(e.pointerId); } catch { /* уже отпущен */ }
        try { window.getSelection().removeAllRanges(); } catch { /* нет выделения */ }
      }
      e.preventDefault();
      g.dx = dx;
      if (!g.raf) g.raf = requestAnimationFrame(apply);
    },
    onPointerUp: () => { const g = d.current; if (g && g.raf) cancelAnimationFrame(g.raf); setTimeout(() => { d.current = null; }, 0); },
    onPointerCancel: () => { const g = d.current; if (g && g.raf) cancelAnimationFrame(g.raf); d.current = null; },
    // мышь не выделяет текст узлов, пока тянут дерево
    onDragStart: (e) => e.preventDefault(),
  };
  const onClickCapture = (e) => { if (d.current && d.current.moved) { e.stopPropagation(); e.preventDefault(); } };
  return { ref, handlers, onClickCapture };
}

function LabTab({ st, act }) {
  const drag = useDragScroll();
  const rate = st.buildings.reduce((a, b) => a + (T.BLD[b.type].research ? T.BLD[b.type].research * T.buildingPower(st, b) : 0), 0) + T.RP_BASE;
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
        <span style={{ fontSize: 12, color: COLOR.muted }}>очков · +{perMin(rate)}/мин. Лаборатории ускоряют (лучше в столице). Каждое изучение дороже следующего. Дерево шире экрана — прокрутите его вбок.</span>
      </div>
      <div ref={drag.ref} {...drag.handlers} onClickCapture={drag.onClickCapture}
        style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, touchAction: 'pan-y', cursor: 'grab',
          userSelect: 'none', WebkitUserSelect: 'none', overscrollBehaviorX: 'contain' }}>
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
                <span style={{ fontSize: 12, color: COLOR.faint }}>{T.RESEARCH_BRANCHES[r.branch]}</span>
                <span className="ems-mono" style={{ fontSize: 12, marginTop: 'auto', color: stt === 'done' ? COLOR.gold : can ? COLOR.teal : COLOR.muted }}>
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
            <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginTop: 3 }}>{sel.desc}</div>
            {T.reqsOf(sel).length > 0 && <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 3 }}>Нужно: {T.reqsOf(sel).map((x) => T.RSR[x].name).join(', ')}</div>}
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
      {!sel && <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 8 }}>Нажмите на узел, чтобы прочитать, что он даёт, и изучить. Подсвеченные бирюзовым можно изучить прямо сейчас.</div>}
    </div>
  );
}

/* ------------------------------ КОМАНДА: МЕНЕДЖЕРЫ ------------------------------ */
function TeamTab({ st, act }) {
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
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
                <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{money(T.managerSalaryOf(st, m.id) * 60)}/мин</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {hired ? (
                    <>
                      <button className="ems-btn" style={{ padding: '3px 9px', fontSize: 12 }} aria-pressed={hired.on !== false}
                        onClick={() => act((s2) => T.setManager(s2, m.id, { on: hired.on === false }), 'tick')}>{hired.on === false ? 'В отпуске — вернуть' : 'Работает — отпуск'}</button>
                      <button className="ems-btn" style={{ padding: '3px 9px', fontSize: 12 }}
                        onClick={() => { if (window.confirm(`Уволить: ${m.name}?`)) act((s2) => T.fireManager(s2, m.id)); }}>Уволить</button>
                    </>
                  ) : (
                    <button className="ems-btn" disabled={!unlocked || st.cash < m.hire} style={{ padding: '4px 10px', fontSize: 12, borderColor: unlocked ? COLOR.gold : COLOR.border }}
                      onClick={() => act((s2) => T.hireManager(s2, m.id), 'coin')}>
                      {unlocked ? `Нанять · ${money(m.hire)}` : <><Lock size={11} style={{ verticalAlign: -1 }} /> {T.RSR[m.unlock].name}</>}
                    </button>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45, marginTop: 5 }}>{m.desc}</div>
              {hired && m.spends && (
                <PlanSlider label="Бюджет на квартал" value={hired.budget ?? 30} min={5} max={100} step={5}
                  hint={`Сколько денег со счёта можно потратить за квартал (всего, а не на каждое решение). Запас на два квартала расходов менеджер не трогает. Осталось в этом квартале: ${money(T.mgrBudget(st, m.id))}.`}
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
          <div style={{ fontSize: 13 }}>
            <b style={{ color: COLOR.goldSoft }}>Задание {n} из {T.QUESTS.length}: {q.title}</b>
            <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, marginLeft: 8 }}>награда {money(q.reward)}</span>
          </div>
          <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{done ? 'Готово — заберите награду.' : T.questText(st, q)}</div>
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
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Партия сама сохраняется в этом браузере каждые пять секунд. Слоты ниже — на сервере: их видно и на связанных устройствах.
      </div>
      {err && <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 8 }}>{err}</div>}
      {!slots && !err && <div style={{ fontSize: 12, color: COLOR.faint }}>Загружаем слоты…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(slots || []).map((sl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12, flexWrap: 'wrap' }}>
            <span className="ems-mono" style={{ color: COLOR.faint }}>{i + 1}</span>
            <span style={{ flex: '1 1 140px', minWidth: 0, color: sl ? COLOR.text : COLOR.faint }}>
              {sl ? `${quarterLabel(sl.quarterIndex || 1)} · ${sl.buildings} зданий · ${money(sl.cash || 0)}${sl.legacy ? ` · репутация ${sl.legacy}` : ''}` : 'пусто'}
              {sl && <span style={{ display: 'block', fontSize: 12, color: COLOR.faint }}>{new Date(sl.savedAt).toLocaleString('ru-RU')}</span>}
            </span>
            <button className="ems-btn" disabled={busy === i} style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => save(i)}>{busy === i ? '…' : 'Сохранить сюда'}</button>
            {sl && <button className="ems-btn" disabled={busy === i} style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => load(i)}>Загрузить</button>}
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
              <div style={{ fontSize: 12, color: COLOR.faint }}>{k}</div>
              <div className="ems-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{v}</div>
              <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
        {st.history.length >= 2 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 3 }}>Стоимость компании по кварталам</div>
            <MiniSpark series={st.history.map((h) => h.value)} color={COLOR.gold} />
          </div>
        )}
      </div>

      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><Landmark size={14} />Кредит</div>
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Раз в квартал банк списывает проценты и {Math.round(T.AMORT_Q * 100)}% самого долга — кредит гасится сам примерно за пять лет
          {debt > 0.01 && <> (в этом квартале погашение ≈ {money(debt * T.AMORT_Q)})</>}. Рублёвый долг переоценивается по новой ставке постепенно, валютный дешевле
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
          {last.principal > 0 && <Row k="Погашение долга (не расход — долг уменьшился)" v={`−${money(last.principal)}`} />}
          <Row k="Налог на прибыль" v={`−${money(last.tax)}`} />
          {last.fine > 0 && <Row k="Штрафы и «взносы»" v={`−${money(last.fine)}`} color={COLOR.rust} />}
          <Row k="Чистая прибыль" v={moneySigned(last.profit)} color={last.profit < 0 ? COLOR.rust : COLOR.teal} strong />
        </div>
      )}

      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><Trophy size={14} />Вехи</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {T.MILESTONES.map((m) => (
            <span key={m.id} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, border: `1px solid ${st.milestones[m.id] ? COLOR.gold : COLOR.border}`,
              color: st.milestones[m.id] ? COLOR.goldSoft : COLOR.faint }}>{st.milestones[m.id] ? '✓ ' : ''}{m.title}</span>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLOR.hairline}` }}>
          <div style={{ fontSize: 12, color: COLOR.text, marginBottom: 4 }}>Продать компанию</div>
          <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
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
/* Связь в обратную сторону: компания — часть своей экономики. Чем она больше, тем
   заметнее её стройки (инвестиции), терминалы (экспорт) и штат (занятость), а области
   с её заводами спокойнее. */
function FootprintPanel({ st }) {
  const f = T.firmFootprint(st);
  const pct = Math.round(f.k * 100);
  const regions = Object.entries(f.regions).filter(([, v]) => v >= 0.1).sort((a, b) => b[1] - a[1]);
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 4 }}>Ваш след в экономике</div>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
        {pct < 3 ? 'Пока компания слишком мала, чтобы страна её заметила. С ростом её стройки, экспорт и рабочие места начнут двигать экономику.'
          : `Вес компании в экономике — ${pct} из 100. Каждый квартал: стройки добавляют инвестиций, терминалы — экспорта, штат снижает безработицу.`}
      </div>
      {pct >= 3 && (
        <div style={{ fontSize: 12, color: COLOR.text, marginTop: 6, lineHeight: 1.6 }}>
          Инвестиции +{fmt1(f.investment)} п.п. · экспорт +{fmt1(f.exports)} п.п. · безработица −{fmt1(f.jobs)} п.п.
          {regions.length > 0 && <div style={{ color: COLOR.muted }}>Спокойнее в областях: {regions.map(([r, v]) => `${T.regionName(r)} (−${fmt1(v)})`).join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

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
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Квартал — минута игрового времени. ЦБ: {getCbPersona(c.cbPersona).name}, Минфин: {getMofPersona(c.mofPersona).name}
          {c.president ? `, президент: ${getPresPersona(c.presPersona).name}` : ''}. {scen && scen.id !== 'sandbox' ? `Сценарий: ${scen.title}.` : ''}
        </div>
        {rows.map(([k, v, dv, why]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, padding: '5px 0', borderBottom: `1px solid ${COLOR.hairline}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12 }}>{k}</div>
              <div style={{ fontSize: 12, color: COLOR.faint }}>{why}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ems-mono" style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
              {Math.abs(dv) > 0.05 && <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{dv > 0 ? '+' : ''}{dv.toFixed(1)}</div>}
            </div>
          </div>
        ))}
        {hints.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hints.map((h) => <div key={h} style={{ fontSize: 12, color: COLOR.gold, display: 'flex', gap: 6 }}><AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />{h}</div>)}
          </div>
        )}
      </div>
      <FootprintPanel st={st} />
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><Newspaper size={14} />Новости</div>
        {!st.news.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Первые новости придут в конце квартала.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {st.news.slice(0, 30).map((n) => (
            <div key={n.id} style={{ borderLeft: `2px solid ${n.own ? COLOR.gold : COLOR.border}`, paddingLeft: 9 }}>
              <div style={{ fontSize: 12, color: COLOR.faint }}>{n.qLabel}{n.own ? ' · ваша компания' : ''}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: n.own ? COLOR.goldSoft : COLOR.text }}>{n.headline}</div>
              {n.text && <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{n.text}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// старт нового дела: выбор отрасли показан на экране новой партии, здесь — её подпись
export const startLabel = (id) => (SECTORS.find((s) => s.id === id) || SECTORS[0]).title;
