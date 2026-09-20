/* Торговый терминал (донат-диаграмма портфеля, разбор цены инструмента,
   сам терминал и сводка портфеля), вынесенный из MacroSimulator.jsx в
   отдельный чанк: виден только трейдеру и только на вкладке «Рынок», а
   не сразу при загрузке приложения, поэтому грузится лениво через
   React.lazy() в MacroSimulator.jsx — как и src/casino.jsx и src/tutorial.jsx.

   COLOR/Audio/INSTR_BY_ID/... — те же самые общие объекты/функции, что и
   в MacroSimulator.jsx (экспортированы оттуда), а не копия. */
import React, { useState, useMemo, Suspense } from 'react';
import { Coins, TrendingUp } from 'lucide-react';
import { GOALS, clamp, fmt1, fmt2, fmtSigned1, fmtMoney, mlnScale, fmtMln, fmtMlnSigned, quarterLabel } from './lib/engine.js';
import {
  COLOR, Audio, ChartFallback, MemoChart, InstrumentChart,
  INSTRUMENTS, INSTR_BY_ID, GOV_BOND_INVESTOR_SHARE, MAINTENANCE, BORROW_FEE,
  bookParts, impliedVol, optionValue, priceOf, useLiveQuotes,
} from './MacroSimulator.jsx';

/* Эталоны сравнения: индекс, облигации, депозит и просто сохранённая покупательная способность */
const BENCHMARKS = [
  { id: 'stock', label: 'Индекс акций', key: 'stockIndex', color: COLOR.gold },
  { id: 'bond', label: 'Гособлигации', key: 'bondIndex', color: COLOR.blue },
  { id: 'dep', label: 'Депозит', key: 'depositIndex', color: COLOR.teal },
  { id: 'infl', label: 'Инфляция (сохранение покупательной способности)', key: 'priceLevel', color: COLOR.rust },
];
/* Отраслевая принадлежность позиций — для круговой диаграммы портфеля */
const SECTOR_OF = {
  eq_broad: 'Рынок целиком', eq_banks: 'Банки', eq_industry: 'Промышленность',
  eq_consumer: 'Потребительский сектор', eq_resources: 'Сырьевой сектор', reit: 'Недвижимость',
  eq_world: 'Мировые акции',
  bond_gov: 'Госдолг', bond_short: 'Госдолг', bond_linker: 'Линкеры', bond_corp: 'Корпоративный долг',
  dep: 'Депозит', mm: 'Денежный рынок', fx: 'Валюта', gold: 'Товары',
  fut_idx: 'Плечо: индекс', fut_fx: 'Плечо: валюта', fut_bond: 'Плечо: долг', fut_cmd: 'Плечо: сырьё',
};

function AllocationDonut({ rows, size = 124, thickness = 16 }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!(total > 0)) return null;
  const c = size / 2; const rad = c - thickness / 2; const CIRC = 2 * Math.PI * rad;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      <circle cx={c} cy={c} r={rad} fill="none" stroke={COLOR.hairline} strokeWidth={thickness} />
      {rows.map((row) => {
        const frac = row.value / total; const off = acc; acc += frac;
        return (
          <circle key={row.label} cx={c} cy={c} r={rad} fill="none" stroke={row.color}
            strokeWidth={thickness} strokeLinecap="butt" opacity={row.short ? 0.5 : 1}
            strokeDasharray={`${Math.max(0.5, frac * CIRC - 1.5)} ${CIRC}`}
            strokeDashoffset={-off * CIRC} transform={`rotate(-90 ${c} ${c})`} />
        );
      })}
      <text x={c} y={c - 3} textAnchor="middle" fontSize={9} fill={COLOR.muted}>ЭКСПОЗИЦИЯ</text>
      <text x={c} y={c + 12} textAnchor="middle" fontSize={13} fill={COLOR.text}>{fmtMln(total)}</text>
    </svg>
  );
}
function benchValues(book, economy) {
  // benchStart обычно проставляется в settleQuarter при первом переходе
  // квартала — но до этого момента (весь первый квартал партии) книга его
  // ещё не имеет, а не «нет данных»: значит, отсчёт эталонов = сейчас, и
  // все они совпадают со стартовым капиталом, а не пропадают из интерфейса
  const start = book.benchStart || { stockIndex: economy.stockIndex, bondIndex: economy.bondIndex,
    depositIndex: economy.depositIndex, priceLevel: economy.priceLevel };
  const out = {};
  BENCHMARKS.forEach((b) => { out[b.id] = (book.startValue || 10) * economy[b.key] / start[b.key]; });
  return out;
}

function PriceCell({ value, size = 12, bold }) {
  const prevRef = React.useRef(value);
  const [dir, setDir] = useState(0);
  React.useEffect(() => {
    if (value > prevRef.current + 1e-9) setDir(1);
    else if (value < prevRef.current - 1e-9) setDir(-1);
    prevRef.current = value;
    const t = setTimeout(() => setDir(0), 650);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className="ems-mono" style={{ fontSize: size, fontWeight: bold ? 600 : 400, transition: 'color 0.45s ease',
      color: dir > 0 ? COLOR.teal : dir < 0 ? COLOR.rust : COLOR.text }}>
      {Number.isFinite(value) ? value.toFixed(2) : '—'}
    </span>
  );
}

/* Разбор механики инструмента живыми цифрами: фьючерс и облигация — самые непонятные */
function InstrumentPrimer({ instr, economy, prev, amt }) {
  const Row = ({ k, v, tone }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '1.5px 0' }}>
      <span style={{ color: COLOR.muted }}>{k}</span>
      <span className="ems-mono" style={{ color: tone || COLOR.text, textAlign: 'right' }}>{v}</span>
    </div>
  );
  const box = { fontSize: 10.5, lineHeight: 1.5, background: COLOR.panelAlt,
    border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 10px' };

  if (instr.kind === 'fut') {
    const m = Math.max(0.01, amt);
    const notional = m * instr.lev;
    const perPct = notional * 0.01;
    return (
      <div style={box}>
        <div style={{ color: COLOR.goldSoft, marginBottom: 5 }}>Как считается фьючерс</div>
        <Row k="Вы вносите (гарантийное обеспечение)" v={fmtMln(m)} />
        <Row k={`Работает позиция размером (×${instr.lev})`} v={fmtMln(notional)} />
        <Row k="Движение цены на 1%" v={`± ${fmtMln(perPct)} = ${instr.lev}% вашего ГО`}
          tone={COLOR.gold} />
        <Row k="Убыток съедает ГО полностью при" v={`падении на ${(100 / instr.lev).toFixed(1)}%`} tone={COLOR.rust} />
        <div style={{ color: COLOR.faint, marginTop: 6 }}>
          Прибыль и убыток считаются от всей позиции, а не от внесённых денег, и живут в строке
          «Прибыль» — на счёт они попадают только когда вы нажмёте «Закрыть». Продажа при нулевой
          позиции открывает шорт: заработок на падении.
        </div>
      </div>
    );
  }

  if (instr.id === 'bond_gov' || instr.id === 'bond_corp') {
    const corp = instr.id === 'bond_corp';
    const y = corp ? economy.corpYield : economy.yield10y;
    const yPrev = prev ? (corp ? prev.corpYield : prev.yield10y) : y;
    const dur = corp ? 4.1 : 7.4;
    const coupon = y / 4;
    const reval = -dur * (y - yPrev);
    const total = Number.isFinite(corp ? economy.corpReturn : economy.bondReturn)
      ? (corp ? economy.corpReturn : economy.bondReturn) : coupon + reval;
    return (
      <div style={box}>
        <div style={{ color: COLOR.goldSoft, marginBottom: 5 }}>Откуда берётся результат</div>
        <Row k={`Купон за квартал (доходность ${fmt2(y)}% ÷ 4)`} v={`+${fmt2(coupon)}%`} tone={COLOR.teal} />
        <Row k={`Переоценка (дюрация ${dur} × изменение доходности)`} v={`${fmtSigned1(reval)}%`}
          tone={reval >= 0 ? COLOR.teal : COLOR.rust} />
        <Row k="Итого за прошлый квартал" v={`${fmtSigned1(total)}%`} tone={total >= 0 ? COLOR.teal : COLOR.rust} />
        <div style={{ color: COLOR.faint, marginTop: 6 }}>
          Это индекс постоянной дюрации, а не одна бумага: он <b style={{ color: COLOR.muted }}>не гасится</b>,
          и купон <b style={{ color: COLOR.muted }}>не приходит отдельной выплатой</b> — он уже внутри цены
          и сразу реинвестируется. Позиция закрывается только вашей продажей. Доходность вверх — цена вниз.
        </div>
      </div>
    );
  }
  return null;
}

export function TradingTerminal({ economy, prev, book, onTrade, history }) {
  const live = useLiveQuotes(economy);
  const [sel, setSel] = useState('eq_broad');
  const [activeGroup, setActiveGroup] = useState('all');
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState(1);
  const [useMargin, setUseMargin] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [sortBy, setSortBy] = useState('group');
  const [chartRange, setChartRange] = useState(20);
  const [showBench, setShowBench] = useState(false);
  const parts = bookParts(book, economy, live);
  const equity = book.cash + parts.spot + parts.futPnl + parts.optVal;
  const lvl = parts.gross > 0.01 ? equity / parts.gross : 9;
  const freeRisk = Math.max(0, equity / MAINTENANCE - parts.gross);
  const instr = INSTR_BY_ID[sel];
  const price = priceOf(instr, economy, live);
  const held = book.pos[sel] || 0;
  const heldValue = held * price / 1000;
  const avg = book.avg[sel];
  const lots = (book.opts || []).filter((l) => l.instr === sel);
  const vol = impliedVol(economy);
  const lotsValue = lots.reduce((a, l) => a + optionValue(l.type, price, l.strike, vol, l.left) * l.qty / 1000, 0);
  const unreal = instr.kind === 'opt' ? lotsValue - lots.reduce((a, l) => a + l.premium * l.qty / 1000, 0)
    : held !== 0 && avg ? held * (price - avg) / 1000 : 0;
  let maxBuy = instr.kind === 'fut' ? Math.max(0, freeRisk / (instr.lev || 1))
    : instr.kind === 'opt' ? Math.max(0, book.cash)
      : useMargin ? Math.max(0, Math.min(book.cash + Math.max(0, equity * 0.6), freeRisk)) : Math.max(0, book.cash);
  // гособлигации существуют в конечном количестве — весь госдолг разом. Один
  // инвестор не может выкупить в него больше разумной доли рынка, иначе
  // «купить гособлигаций» превращается в «купить сколько угодно денег из
  // ниоткуда». Фьючерс на облигации — расчётный дериватив, а не сама бумага,
  // поэтому его это ограничение не касается.
  const govBondRoom = instr.id === 'bond_gov'
    ? Math.max(0, (economy.govDebt || 0) * 1000 * GOV_BOND_INVESTOR_SHARE - Math.max(0, heldValue))
    : Infinity;
  if (instr.id === 'bond_gov') maxBuy = Math.min(maxBuy, govBondRoom);
  const maxSell = instr.kind === 'opt' ? lotsValue
    : instr.kind === 'fut' ? Math.max(0, freeRisk / (instr.lev || 1))
      : Math.max(0, heldValue) + (useMargin ? Math.max(0, Math.min(equity * 0.5, freeRisk)) : 0);
  const maxAmount = side === 'buy' ? maxBuy : maxSell;
  const amt = clamp(amount, 0, maxAmount);
  const chg = prev && prev[instr.key] ? (economy[instr.key] / prev[instr.key] - 1) * 100 : 0;
  const histWin = useMemo(() => (history || []).slice(-chartRange), [history, chartRange]);
  // Эталон приводим к стартовой точке самого инструмента: сравнение имеет смысл
  // только как «обогнали рынок или отстали», а не как разница абсолютных пунктов
  const chartRows = useMemo(() => {
    const first = histWin.find((h) => Number.isFinite(h[instr.key]));
    const benchFirst = histWin.find((h) => Number.isFinite(h.stockIndex));
    const k = first && benchFirst && benchFirst.stockIndex ? first[instr.key] / benchFirst.stockIndex : 1;
    return histWin.map((h, idx) => ({
      i: idx,
      label: h.label || h.q || '',
      price: Number.isFinite(h[instr.key]) ? h[instr.key] : null,
      bench: showBench && Number.isFinite(h.stockIndex) ? h.stockIndex * k : null,
    }));
  }, [histWin, instr.key, showBench]);
  const marks = useMemo(() => {
    const firstQ = histWin.length ? histWin[0].q : 0;
    const last = histWin.length - 1;
    return (book.trades || []).filter((t) => t.id === sel)
      // сделки текущего, ещё не закрытого квартала прижимаем к последней точке графика
      .map((t) => ({ idx: Math.min(t.q - firstQ, last), side: t.side }))
      .filter((m) => m.idx >= 0 && m.idx <= last);
  }, [histWin, book.trades, sel]);
  // одна таблица «как на бирже»: цена, изменение, позиция и результат по каждой
  // строке считаются в одном месте — и для сортировки, и для отрисовки
  const rows = useMemo(() => INSTRUMENTS.map((i) => {
    const pr = priceOf(i, economy, live);
    const q = book.pos[i.id] || 0;
    const myLots = (book.opts || []).filter((l) => l.instr === i.id);
    const value = i.kind === 'opt'
      ? myLots.reduce((a, l) => a + optionValue(l.type, pr, l.strike, vol, l.left) * l.qty / 1000, 0)
      : i.kind === 'fut' ? Math.abs(q) * pr / 1000 : q * pr / 1000;
    const avgP = book.avg[i.id];
    const pnl = i.kind === 'opt'
      ? value - myLots.reduce((a, l) => a + l.premium * l.qty / 1000, 0)
      : (q !== 0 && avgP) ? q * (pr - avgP) / 1000 : 0;
    const chgQ = prev && prev[i.key] ? (economy[i.key] / prev[i.key] - 1) * 100 : 0;
    return { i, pr, q, myLots, value, pnl, chgQ, has: Math.abs(q) > 0.001 || myLots.length > 0 };
  }), [economy, live, book, prev, vol]);
  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const out = rows.filter((r) => (activeGroup === 'all' || r.i.group === activeGroup)
      && (!onlyMine || r.has)
      && (!term || r.i.name.toLowerCase().includes(term) || r.i.ticker.toLowerCase().includes(term)));
    if (sortBy === 'chg') return [...out].sort((a, b) => b.chgQ - a.chgQ);
    if (sortBy === 'pnl') return [...out].sort((a, b) => b.pnl - a.pnl);
    return out;
  }, [rows, activeGroup, onlyMine, query, sortBy]);
  const openCount = rows.filter((r) => r.has).length;
  // «Движение квартала»: три лидера и три аутсайдера среди спот-инструментов —
  // производные повторяют базовый актив и в этой строке были бы дублями
  const movers = useMemo(() => {
    const spot = rows.filter((r) => r.i.kind === 'spot' && Math.abs(r.chgQ) > 0.05).sort((a, b) => b.chgQ - a.chgQ);
    if (spot.length < 2) return [];
    return [...spot.slice(0, 3), ...spot.slice(-3).filter((r) => !spot.slice(0, 3).includes(r)).reverse()];
  }, [rows]);
  const premium = instr.kind === 'opt' ? optionValue(instr.optType, price, price, vol, instr.life) : 0;
  const qty = instr.kind === 'opt' ? (premium > 0 ? amt * 1000 / (premium * (1 + instr.fee)) : 0)
    : amt * (instr.lev || 1) * 1000 / price;
  const willShort = instr.kind !== 'opt' && side === 'sell' && amt > Math.max(0, heldValue) + 1e-9;
  const setPct = (p) => { Audio.play('tick'); setAmount(Math.round(maxAmount * p * 100) / 100); };
  const posLabel = (i, q) => {
    if (i.kind === 'opt') return lots.length ? `${lots.length} серии` : '—';
    if (!q) return '—';
    return `${q > 0 ? 'лонг' : 'шорт'} ${Math.abs(q).toFixed(1)}`;
  };

  return (
    <div className="ems-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', padding: '9px 13px',
        borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panelAlt }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TrendingUp size={13} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Терминал</span>
        </span>
        {[['Капитал', fmtMln(equity), COLOR.text],
          ['Деньги', fmtMln(book.cash), book.cash < 0 ? COLOR.rust : COLOR.text],
          ['Экспозиция', fmtMln(parts.gross), COLOR.text],
          ['Зафиксировано', fmtMlnSigned(book.realized), book.realized >= 0 ? COLOR.teal : COLOR.rust]].map(([l, v, c]) => (
            <span key={l} style={{ fontSize: 11.5, display: 'flex', gap: 5, alignItems: 'baseline' }}>
              <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono" style={{ color: c }}>{v}</span>
            </span>
          ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', minWidth: 190 }}>
          <span style={{ fontSize: 11, color: COLOR.muted }}>Обеспечение</span>
          <span style={{ flex: 1, height: 5, background: COLOR.border, borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
            <span style={{ display: 'block', height: '100%', width: `${clamp(lvl / 1.2 * 100, 0, 100)}%`,
              background: lvl < MAINTENANCE ? COLOR.rust : lvl < 0.45 ? COLOR.gold : COLOR.teal }} />
          </span>
          <span className="ems-mono" style={{ fontSize: 11.5, color: lvl < MAINTENANCE ? COLOR.rust : lvl < 0.45 ? COLOR.gold : COLOR.teal }}>
            {parts.gross > 0.01 ? `${Math.round(lvl * 100)}%` : '—'}
          </span>
        </span>
      </div>
      {parts.gross > 0.01 && lvl < 0.45 && (
        <div style={{ padding: '6px 13px', fontSize: 11.5, background: lvl < MAINTENANCE ? COLOR.rustDim : COLOR.goldDim,
          color: lvl < MAINTENANCE ? COLOR.rust : COLOR.goldSoft, borderBottom: `1px solid ${COLOR.border}` }}>
          {lvl < MAINTENANCE
            ? `Уровень обеспечения ниже ${MAINTENANCE * 100}%: в конце квартала брокер принудительно закроет часть позиций по рынку.`
            : `Обеспечение ${Math.round(lvl * 100)}% — запас до маржин-колла невелик. Падение рынка на ${Math.round((lvl - MAINTENANCE) / Math.max(0.01, lvl) * 100)}% приведёт к принудительному закрытию.`}
        </div>
      )}
      {movers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 13px', flexWrap: 'wrap',
          borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panel }}>
          <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.blue, letterSpacing: '0.08em' }}>ДВИЖЕНИЕ КВАРТАЛА</span>
          {movers.map((r) => (
            <span key={r.i.id} onClick={() => { Audio.play('tick'); setSel(r.i.id); setAmount(1); setSide('buy'); }}
              title={r.i.name}
              style={{ display: 'flex', gap: 5, alignItems: 'baseline', cursor: 'pointer', fontSize: 11 }}>
              <span className="ems-mono" style={{ color: r.i.color }}>{r.i.ticker}</span>
              <span className="ems-mono" style={{ color: r.chgQ >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(r.chgQ)}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="ems-terminal">
        <div className="ems-scroll" style={{ borderRight: `1px solid ${COLOR.border}` }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: COLOR.panel, borderBottom: `1px solid ${COLOR.border}`, padding: '8px 12px 6px' }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: тикер или название" aria-label="Поиск инструмента"
                style={{ flex: 1, minWidth: 0, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 4,
                  color: COLOR.text, fontSize: 11, padding: '5px 8px', outline: 'none', fontFamily: 'inherit' }} />
              <button className="ems-btn" title="Показать только инструменты, где у вас есть позиция"
                style={{ padding: '3px 9px', fontSize: 10.5, whiteSpace: 'nowrap',
                  background: onlyMine ? COLOR.gold : COLOR.panelAlt, color: onlyMine ? COLOR.ink : COLOR.muted,
                  borderColor: onlyMine ? COLOR.gold : COLOR.border }}
                onClick={() => { Audio.play('tick'); setOnlyMine((v) => !v); }}>мои {openCount > 0 ? `· ${openCount}` : ''}</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <span className={`ems-tab ${activeGroup === 'all' ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
                onClick={() => { Audio.play('tab'); setActiveGroup('all'); }}>Все</span>
              {[...new Set(INSTRUMENTS.map((i) => i.group))].map((g) => (
                <span key={g} className={`ems-tab ${activeGroup === g ? 'active' : ''}`} style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={() => { Audio.play('tab'); setActiveGroup(g); }}>{g}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 9.5, color: COLOR.faint, letterSpacing: '0.06em' }}>СОРТИРОВКА</span>
              {[['group', 'по группам'], ['chg', 'по движению'], ['pnl', 'по результату']].map(([id, label]) => (
                <span key={id} className={`ems-tab ${sortBy === id ? 'active' : ''}`} style={{ padding: '2px 7px', fontSize: 10 }}
                  onClick={() => { Audio.play('tab'); setSortBy(id); }}>{label}</span>
              ))}
            </div>
          </div>
          {visibleRows.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 11.5, color: COLOR.faint }}>
              {onlyMine ? 'Открытых позиций нет — снимите фильтр «мои», чтобы увидеть весь список.' : 'Ничего не найдено по этому запросу.'}
            </div>
          )}
          {visibleRows.map((r, idx) => {
            const { i, pr, q, myLots, value, pnl, chgQ, has } = r;
            const active = sel === i.id;
            const groupHeader = sortBy === 'group' && (idx === 0 || visibleRows[idx - 1].i.group !== i.group);
            return (
              <React.Fragment key={i.id}>
                {groupHeader && (
                  <div style={{ padding: '7px 12px 3px', fontSize: 9.5, color: COLOR.blue, letterSpacing: '0.08em' }}>{i.group.toUpperCase()}</div>
                )}
                <div onClick={() => { Audio.play('tick'); setSel(i.id); setAmount(1); setSide('buy'); }}
                  className="ems-row-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer',
                    background: active ? COLOR.goldDim : 'transparent',
                    borderLeft: `2px solid ${active ? COLOR.gold : has ? i.color : 'transparent'}` }}>
                  <span className="ems-mono" style={{ fontSize: 10, color: i.color, width: 44, flexShrink: 0 }}>{i.ticker}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: active ? COLOR.text : COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                    {has && (
                      <div style={{ fontSize: 10, color: q < 0 ? COLOR.rust : COLOR.faint }}>
                        {i.kind === 'opt' ? `${myLots.length} серии · ${fmtMln(value)}`
                          : `${q < 0 ? 'шорт' : 'лонг'} ${fmtMln(Math.abs(value))}${i.kind === 'fut' ? ' номинала' : ''}`}
                      </div>
                    )}
                    {i.kind === 'fut' && !has && <div style={{ fontSize: 10, color: COLOR.faint }}>плечо {i.lev}:1</div>}
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div><PriceCell value={pr} size={11.5} /></div>
                    <div className="ems-mono" style={{ fontSize: 10, color: chgQ > 0.01 ? COLOR.teal : chgQ < -0.01 ? COLOR.rust : COLOR.faint }}>
                      {chgQ > 0.01 ? '▲' : chgQ < -0.01 ? '▼' : '·'} {fmtSigned1(chgQ)}%
                    </div>
                  </span>
                  {has && (
                    <span className="ems-mono" style={{ fontSize: 10.5, width: 62, textAlign: 'right', flexShrink: 0,
                      color: pnl > 0.0005 ? COLOR.teal : pnl < -0.0005 ? COLOR.rust : COLOR.faint }}>
                      {Math.abs(pnl) > 0.0005 ? fmtMlnSigned(pnl) : '—'}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* карточка выбранного инструмента — единственное место, где реально
            происходит действие (сделка); отделяем её от списка цветом инструмента,
            а не просто нейтральной панелью того же веса, что и список слева */}
        <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10, background: COLOR.panelRaised, borderTop: `2px solid ${instr.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: COLOR.text }}>
                <span className="ems-mono" style={{ color: instr.color, marginRight: 7 }}>{instr.ticker}</span>{instr.name}
              </div>
              <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 3, maxWidth: 340, lineHeight: 1.4 }}>{instr.note}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <PriceCell value={price} size={21} bold />
              <div className="ems-mono" style={{ fontSize: 11, color: chg >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(chg)}% за квартал</div>
            </div>
          </div>

          {chartRows.length > 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {[[8, '2 года'], [20, '5 лет'], [1000, 'всё время']].map(([q, label]) => (
                  <span key={label} className={`ems-tab ${chartRange === q ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}
                    onClick={() => { Audio.play('tab'); setChartRange(q); }}>{label}</span>
                ))}
                <span className={`ems-tab ${showBench ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10, marginLeft: 'auto' }}
                  title="Наложить сводный индекс, приведённый к той же стартовой точке: видно, обгоняет инструмент рынок или отстаёт"
                  onClick={() => { Audio.play('tab'); setShowBench((v) => !v); }}>
                  {showBench ? 'скрыть индекс' : 'сравнить с индексом'}
                </span>
              </div>
              <Suspense fallback={<ChartFallback height={190} />}>
                <InstrumentChart rows={chartRows} color={instr.color} avg={instr.kind === 'opt' ? null : avg}
                  marks={marks} benchLabel={showBench && instr.key !== 'stockIndex' ? 'сводный индекс' : null}
                  benchColor={COLOR.faint} height={190} />
              </Suspense>
              <div style={{ fontSize: 10, color: COLOR.faint, marginTop: -2, lineHeight: 1.4 }}>
                {marks.length > 0 && <><span style={{ color: COLOR.teal }}>B</span> — ваши покупки, <span style={{ color: COLOR.rust }}>S</span> — продажи. </>}
                {showBench && instr.key !== 'stockIndex' && 'Индекс приведён к стартовой цене инструмента: расхождение линий — это опережение или отставание от рынка. '}
                {Number.isFinite(avg) && instr.kind !== 'opt' && 'Пунктир с подписью «ваша средняя» — ваша средняя цена входа.'}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: COLOR.panelAlt,
            border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 10px' }}>
            {[['Позиция', posLabel(instr, held)],
              [instr.kind === 'opt' ? 'Страйк' : 'Средняя', instr.kind === 'opt' ? (lots[0] ? lots[0].strike.toFixed(0) : '—') : (avg ? avg.toFixed(2) : '—')],
              [instr.kind === 'fut' ? 'Номинал' : 'Стоимость',
                instr.kind === 'opt' ? (lotsValue > 0 ? fmtMln(lotsValue) : '—')
                  : Math.abs(held) > 0.001 ? fmtMln(Math.abs(heldValue)) : '—'],
              ['Прибыль', Math.abs(unreal) > 0.0005 ? fmtMlnSigned(unreal) : '—']].map(([l, v], idx) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: COLOR.muted }}>{l}</div>
                  <div className="ems-mono" style={{ fontSize: 12, color: idx === 3 && Math.abs(unreal) > 0.0005 ? (unreal >= 0 ? COLOR.teal : COLOR.rust) : COLOR.text }}>{v}</div>
                </div>
              ))}
          </div>
          <InstrumentPrimer instr={instr} economy={economy} prev={prev} amt={amt} />

          {instr.kind === 'opt' && lots.length > 0 && (
            <div style={{ fontSize: 10.5, color: COLOR.muted, lineHeight: 1.5 }}>
              {lots.map((l, i) => (
                <div key={l.id}>серия {i + 1}: страйк {l.strike.toFixed(0)}, до экспирации {l.left} кв., премия {fmtMln(l.premium * l.qty / 1000)}, сейчас {fmtMln(optionValue(l.type, price, l.strike, vol, l.left) * l.qty / 1000)}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            {[['buy', instr.kind === 'opt' ? 'Купить' : 'Купить / лонг'], ['sell', instr.kind === 'opt' ? 'Закрыть' : 'Продать / шорт']].map(([id, label]) => (
              <button key={id} className="ems-btn" style={{ flex: 1, padding: '7px 0', fontSize: 12,
                background: side === id ? (id === 'buy' ? COLOR.teal : COLOR.rust) : COLOR.panelAlt,
                color: side === id ? COLOR.ink : COLOR.muted,
                borderColor: side === id ? (id === 'buy' ? COLOR.teal : COLOR.rust) : COLOR.border }}
                onClick={() => { Audio.play('tick'); setSide(id); setAmount(1); }}>{label}</button>
            ))}
          </div>
          {(book.trades || []).length > 0 && (
            <div style={{ borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7, fontSize: 10.5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
                <span style={{ color: COLOR.blue }}>Исполнено</span>
                <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint }}>{book.trades.length} сделок за партию</span>
              </div>
              {/* журнал прокручивается внутри себя: раньше он рос вместе с числом
                  сделок и растягивал карточку, а с ней и всю страницу */}
              <div className="ems-scroll" style={{ maxHeight: 112, overflowY: 'auto' }}>
              {(() => {
                const list = (book.trades || []).slice(-40).reverse();
                let lastQ = null;
                // сделки шли слитной лентой без единого разделителя — за несколько
                // кварталов не разобрать, где кончился один и начался следующий
                return list.map((t, k) => {
                  const ins = INSTR_BY_ID[t.id];
                  const showQ = t.q !== lastQ;
                  lastQ = t.q;
                  return (
                    <React.Fragment key={`${t.q}-${k}`}>
                      {showQ && (
                        <div className="ems-mono" style={{ fontSize: 9, color: COLOR.faint, letterSpacing: '0.05em',
                          padding: '4px 0 2px', borderTop: k === 0 ? 'none' : `1px solid ${COLOR.hairline}`,
                          marginTop: k === 0 ? 0 : 2 }}>
                          {(t.label || quarterLabel(t.q)).toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, padding: '1.5px 0', color: COLOR.muted }}>
                        <span className="ems-mono" style={{ color: t.side === 'buy' ? COLOR.teal : COLOR.rust, width: 62 }}>
                          {t.side === 'buy' ? 'покупка' : 'продажа'}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ins ? ins.name : t.id}
                        </span>
                        <span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{fmtMln(t.amt)}</span>
                        <span className="ems-mono" style={{ color: COLOR.faint, width: 78, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          по {t.price.toFixed(2)}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
              </div>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: COLOR.muted }}>
                {instr.kind === 'fut' ? 'Гарантийное обеспечение' : instr.kind === 'opt' ? 'Премия' : 'Сумма сделки'}
              </span>
              <span className="ems-mono" style={{ fontSize: 14 }}>{mlnScale(amt).v} <span style={{ fontSize: 10, color: COLOR.faint }}>{mlnScale(amt).unit}</span></span>
            </div>
            <input type="range" className="ems-slider" min={0} max={Math.max(0.1, Math.round(maxAmount * 100) / 100)} step={0.05}
              aria-label="Сумма сделки" value={amt} onChange={(e) => { Audio.play('tick'); setAmount(parseFloat(e.target.value)); }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[[0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, 'макс.']].map(([p, l]) => (
                <button key={l} className="ems-btn" style={{ flex: 1, padding: '3px 0', fontSize: 10.5 }} onClick={() => setPct(p)}>{l}</button>
              ))}
            </div>
            {instr.kind === 'spot' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button className="ems-btn" style={{ padding: '3px 10px', fontSize: 10.5,
                  background: useMargin ? COLOR.rust : COLOR.panelAlt, color: useMargin ? COLOR.ink : COLOR.muted,
                  borderColor: useMargin ? COLOR.rust : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setUseMargin((m) => !m); setAmount(1); }}>
                  {useMargin ? 'кредитное плечо включено' : 'торговать в кредит'}
                </button>
                <span style={{ fontSize: 10, color: COLOR.faint, flex: 1, lineHeight: 1.35 }}>
                  {useMargin ? `Доступно ${fmtMln(maxBuy)}, из них ${fmtMln(Math.max(0, maxBuy - Math.max(0, book.cash)))} заёмных под ${fmt1(economy.lendingRate)}% годовых.`
                    : `Сделки только на свои: доступно ${fmtMln(Math.max(0, book.cash))}.`}
                </span>
              </div>
            )}
            {instr.id === 'bond_gov' && side === 'buy' && (
              <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 6, lineHeight: 1.35 }}>
                Гособлигации — не бездонный инструмент: рынок ограничен размером госдолга ({fmtMoney(economy.govDebt)}), и один инвестор не может выкупить больше {Math.round(GOV_BOND_INVESTOR_SHARE * 100)}% от него. Свободно ещё {fmtMln(govBondRoom)}.
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.5, borderLeft: `2px solid ${side === 'buy' ? COLOR.teal : COLOR.rust}`, paddingLeft: 9 }}>
            {amt <= 0.001 ? 'Выберите сумму сделки.' : instr.kind === 'opt' ? (
              side === 'buy'
                ? <>Покупка <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> контрактов со страйком {price.toFixed(0)} и экспирацией через {instr.life} кв.
                  Премия {fmtMln(amt)} — это максимум, который можно потерять. Волатильность в цене опциона: {(vol * 100).toFixed(0)}%.</>
                : <>Закрытие позиций по опционам на {fmtMln(amt)} по текущей оценке.</>
            ) : (
              <>
                {side === 'buy' ? 'Покупка' : willShort ? 'Продажа в шорт' : 'Продажа'} <b className="ems-mono" style={{ color: COLOR.text }}>{qty.toFixed(1)}</b> ед.
                по <b className="ems-mono" style={{ color: COLOR.text }}>{price.toFixed(2)}</b>
                {instr.kind === 'fut' && <> · номинал <b className="ems-mono" style={{ color: COLOR.text }}>{fmtMln(amt * instr.lev)}</b> при плече {instr.lev}:1</>}
                , комиссия {fmtMln(amt * instr.fee * (instr.lev || 1))}.
                {willShort && <span style={{ color: COLOR.rust }}> Шорт: прибыль при падении цены, плата за заём {(BORROW_FEE * 100).toFixed(1)}% годовых, убыток теоретически не ограничен.</span>}
                {instr.kind === 'spot' && side === 'buy' && book.cash - amt < 0 && <span style={{ color: COLOR.rust }}> Сделка в плечо под {fmt1(economy.lendingRate)}% годовых.</span>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <button className="ems-btn" disabled={amt <= 0.001}
              style={{ flex: 1, padding: '10px 0', fontSize: 13, background: side === 'buy' ? COLOR.tealDim : COLOR.rustDim,
                borderColor: side === 'buy' ? COLOR.teal : COLOR.rust, color: side === 'buy' ? COLOR.teal : COLOR.rust, fontWeight: 600 }}
              onClick={() => { Audio.play(side === 'buy' ? 'coin' : 'click'); onTrade(sel, amt, side, live); setAmount(1); }}>
              {side === 'buy' ? 'Купить' : willShort ? 'Открыть шорт' : 'Продать'} на {fmtMln(amt)}
            </button>
            {(Math.abs(held) > 0.001 || lots.length > 0) && (
              <button className="ems-btn" style={{ padding: '10px 14px', fontSize: 12 }}
                onClick={() => { Audio.play('click'); onTrade(sel, instr.kind === 'opt' ? lotsValue : Math.abs(heldValue) / (instr.lev || 1), held < 0 ? 'buy' : 'sell', live); }}>
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioSummary({ book, economy, live, prevValue, goal, opponent }) {
  const parts = bookParts(book, economy, live);
  const equity = book.cash + parts.spot + parts.futPnl + parts.optVal;
  const real = equity * 100 / economy.priceLevel;
  const qRet = prevValue ? (equity / prevValue - 1) * 100 : 0;
  const start = book.startValue || 10;
  const totalRet = (equity / start - 1) * 100;
  const bench = benchValues(book, economy);
  const optVal = parts.optVal;
  const alloc = useMemo(() => {
    const map = {};
    const put = (label, color, v, short) => {
      if (!map[label]) map[label] = { label, color, value: 0, net: 0, short: false };
      map[label].value += Math.abs(v); map[label].net += v;
      if (short) map[label].short = true;
    };
    INSTRUMENTS.forEach((i) => {
      const q = book.pos[i.id] || 0;
      if (!q) return;
      const pr = priceOf(i, economy, live);
      put(SECTOR_OF[i.id] || i.group, i.color, q * pr / 1000, q < 0);
    });
    (book.opts || []).forEach((lot) => {
      const ins = INSTR_BY_ID[lot.instr];
      if (!ins) return;
      const S = priceOf(ins, economy, live);
      put('Опционы', COLOR.teal, optionValue(lot.type, S, lot.strike, impliedVol(economy), lot.left) * lot.qty / 1000, false);
    });
    if (book.cash > 0.005) put('Свободные деньги', COLOR.faint, book.cash, false);
    return Object.values(map).filter((r) => r.value > 0.005).sort((a, b) => b.value - a.value);
  }, [book, economy, live]);
  const allocTotal = alloc.reduce((a, r) => a + r.value, 0);
  const goalDef = GOALS.find((g) => g.id === goal);
  const goalLine = () => {
    if (!bench) return null;
    if (goal === 'beat_index') return `Индекс: ${fmtMln(bench.stock)} против вашего ${fmtMln(equity)} — вы ${equity >= bench.stock ? 'впереди' : 'позади'} на ${fmtMln(Math.abs(equity - bench.stock))}.`;
    if (goal === 'beat_inflation') return `Сохранение покупательной способности требует ${fmtMln(bench.infl)} — у вас ${fmtMln(equity)}.`;
    if (goal === 'survive') return `Маржин-коллов: ${book.marginCalls || 0}. Цель — пройти цикл без принудительных закрытий.`;
    return `Капитал вырос на ${fmtSigned1(totalRet)}% с начала игры.`;
  };
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Coins size={14} />Ваш капитал
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 9, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>Стоимость</div>
          <div className="ems-mono" style={{ fontSize: 22 }}>{mlnScale(equity).v}<span style={{ fontSize: 11, color: COLOR.faint }}> {mlnScale(equity).unit}</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>В ценах старта</div>
          <div className="ems-mono" style={{ fontSize: 15, color: real >= start ? COLOR.teal : COLOR.rust }}>{mlnScale(real).v}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: COLOR.muted }}>За квартал</div>
          <div className="ems-mono" style={{ fontSize: 15, color: qRet >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(qRet)}%</div>
        </div>
      </div>
      {book.history && book.history.length > 2 && (
        <Suspense fallback={<ChartFallback height={54} />}>
          <MemoChart data={book.history} color={COLOR.gold} height={54} label="Капитал" fmt={fmt2} />
        </Suspense>
      )}
      {bench && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7 }}>
          <div style={{ fontSize: 11, color: COLOR.blue, marginBottom: 4 }}>Против эталонов</div>
          {[{ id: 'me', label: 'Ваш портфель', v: equity, color: COLOR.gold }]
            .concat(BENCHMARKS.map((b) => ({ id: b.id, label: b.label, v: bench[b.id], color: b.color })))
            .concat(opponent && Number.isFinite(opponent.value) ? [{ id: 'opponent', label: opponent.label, v: opponent.value, color: COLOR.rust }] : [])
            .sort((a, b) => b.v - a.v)
            .map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, padding: '2px 0',
                color: r.id === 'me' ? COLOR.text : COLOR.muted, fontWeight: r.id === 'me' ? 600 : 400 }}>
                <span className="ems-mono" style={{ width: 14, color: COLOR.faint }}>{idx + 1}</span>
                <span style={{ width: 8, height: 8, background: r.color, borderRadius: 1, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span className="ems-mono">{fmtMln(r.v)}</span>
                <span className="ems-mono" style={{ width: 52, textAlign: 'right', color: (r.v / start - 1) >= 0 ? COLOR.teal : COLOR.rust }}>
                  {fmtSigned1((r.v / start - 1) * 100)}%
                </span>
              </div>
            ))}
          {opponent && !Number.isFinite(opponent.value) && (
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 3 }}>{opponent.label} ещё не выходил на рынок в этой партии.</div>
          )}
        </div>
      )}
      {alloc.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7 }}>
          <div style={{ fontSize: 11, color: COLOR.blue, marginBottom: 6 }}>Портфель по отраслям</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <AllocationDonut rows={alloc} />
            <div style={{ flex: 1, minWidth: 165 }}>
              {alloc.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '1.5px 0' }}>
                  <span style={{ width: 8, height: 8, background: r.color, borderRadius: 1, flexShrink: 0, opacity: r.short ? 0.5 : 1 }} />
                  <span style={{ flex: 1, minWidth: 0, color: COLOR.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}{r.short ? ' · шорт' : ''}
                  </span>
                  <span className="ems-mono" style={{ color: r.net < 0 ? COLOR.rust : COLOR.text }}>{fmtMln(r.value)}</span>
                  <span className="ems-mono" style={{ width: 38, textAlign: 'right', color: COLOR.faint }}>
                    {Math.round(r.value / Math.max(0.0001, allocTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          {Math.abs(optVal) > 0.005 && (
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5 }}>
              Опционы учтены по текущей оценке, фьючерсы — по номиналу позиции, шорты — по модулю: диаграмма показывает риск, а не вложенные деньги.
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0 0', color: COLOR.muted }}>
        <span>Свободные деньги</span>
        <span className="ems-mono" style={{ color: book.cash < 0 ? COLOR.rust : COLOR.text }}>{fmtMln(book.cash)}</span>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 9, lineHeight: 1.45 }}>
        <b style={{ color: COLOR.goldSoft }}>Ваша цель: {goalDef ? goalDef.label.toLowerCase() : 'приумножить капитал'}.</b> {goalLine()}
        {' '}Инфляция за квартал забирает {fmt1(economy.inflation / 4)}% номинальной стоимости, поэтому «ничего не делать» — это тоже ставка, и обычно проигрышная.
      </div>
      {(book.lastEvents || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {book.lastEvents.map((ev, i) => (
            <div key={i} style={{ fontSize: 11, lineHeight: 1.45, color: ev.kind === 'call' ? COLOR.rust : ev.kind === 'ok' ? COLOR.teal : COLOR.muted,
              borderLeft: `2px solid ${ev.kind === 'call' ? COLOR.rust : COLOR.border}`, paddingLeft: 8, marginTop: 4 }}>
              {ev.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
