/* Компоненты на recharts, вынесенные из MacroSimulator.jsx в отдельный чанк:
   recharts — самая тяжёлая зависимость приложения (~104 KB gzip), а нужна она
   только внутри уже запущенной партии (график на панели, мини-графики рынка,
   попап «реакция экономики»). Экран меню/анкеты/обучения её не видит, поэтому
   не должен и грузить — MacroSimulator.jsx подключает этот файл через
   React.lazy(), а не статическим импортом.

   COLOR/Audio — тот же самый общий объект/синглтон, что и в MacroSimulator.jsx
   (экспортирован оттуда), а не копия: смена темы и звук работают как раньше. */
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine, ReferenceArea,
} from 'recharts';
import { Activity, X } from 'lucide-react';
import { CONFIG, fmt1, fmtMoney, fmtSigned1, defaultDecisions, simulateQuarter } from './lib/engine.js';
import { COLOR, Audio, useEscapeClose } from './MacroSimulator.jsx';

// вкладки, которые видны всегда; остальные — в списке «ещё»
const MAIN_GROUPS = ['output', 'prices', 'money', 'labor', 'government'];
const CHART_GROUPS = [
  { id: 'output', label: 'Выпуск', series: [
    { id: 'gdp', label: 'ВВП', axis: 'left', color: COLOR.gold, fmt: 'money' },
    { id: 'potentialGdp', label: 'Потенциальный ВВП', axis: 'left', color: COLOR.blue, fmt: 'money' },
    { id: 'outputGap', label: 'Разрыв выпуска', axis: 'right', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'growth', label: 'Рост', series: [
    { id: 'gdpGrowth', label: 'Рост ВВП', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'potentialGrowth', label: 'Рост потенциала', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'consumptionGrowth', label: 'Потребление', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'investmentGrowth', label: 'Инвестиции', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'wageGrowth', label: 'Зарплаты', axis: 'left', color: '#8E7CC3', fmt: 'pct' },
  ] },
  { id: 'prices', label: 'Цены', series: [
    { id: 'inflation', label: 'Инфляция', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'coreInflation', label: 'Базовая инфляция', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'inflationExpectations', label: 'Ожидания', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'cbCredibility', label: 'Доверие к ЦБ', axis: 'right', color: COLOR.rust, fmt: 'idx' },
  ] },
  { id: 'money', label: 'Ставки', series: [
    { id: 'keyRate', label: 'Ключевая ставка', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'lendingRate', label: 'Ставка по кредитам', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'realLendingRate', label: 'Реальная ставка', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'rStar', label: 'Нейтральная ставка r*', axis: 'left', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'labor', label: 'Труд', series: [
    { id: 'unemployment', label: 'Безработица', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'nairu', label: 'Естественный уровень', axis: 'left', color: COLOR.blue, fmt: 'pct' },
    { id: 'wageGrowth', label: 'Рост зарплат', axis: 'right', color: COLOR.teal, fmt: 'pct' },
    { id: 'unitLaborCostGrowth', label: 'Удельные издержки труда', axis: 'right', color: COLOR.gold, fmt: 'pct' },
  ] },
  { id: 'banking', label: 'Банки', series: [
    { id: 'bankNPL', label: 'Просрочка', axis: 'left', color: COLOR.rust, fmt: 'pct' },
    { id: 'bankCapitalAdequacy', label: 'Достаточность капитала', axis: 'left', color: COLOR.teal, fmt: 'pct' },
    { id: 'creditGrowth', label: 'Рост кредита', axis: 'right', color: COLOR.gold, fmt: 'pct' },
    { id: 'creditGap', label: 'Кредитный разрыв', axis: 'right', color: COLOR.blue, fmt: 'pct' },
  ] },
  { id: 'government', label: 'Бюджет', series: [
    { id: 'debtToGdp', label: 'Госдолг к ВВП', axis: 'left', color: COLOR.gold, fmt: 'pct' },
    { id: 'deficitPctGdp', label: 'Дефицит бюджета', axis: 'right', color: COLOR.rust, fmt: 'pct' },
    { id: 'interestPctGdp', label: 'Процентные расходы', axis: 'right', color: COLOR.blue, fmt: 'pct' },
    { id: 'shadowShare', label: 'Теневая экономика', axis: 'right', color: COLOR.teal, fmt: 'pct' },
  ] },
  { id: 'external', label: 'Внешний сектор', series: [
    { id: 'exchangeRate', label: 'Курс (индекс)', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'realExchangeRate', label: 'Реальный курс', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'currentAccount', label: 'Текущий счёт', axis: 'right', color: COLOR.teal, fmt: 'money' },
    { id: 'netCapitalFlow', label: 'Приток капитала', axis: 'right', color: COLOR.rust, fmt: 'money' },
  ] },
  { id: 'potential', label: 'Потенциал', series: [
    { id: 'productivity', label: 'Производительность', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'humanCapitalIndex', label: 'Человеческий капитал', axis: 'left', color: COLOR.teal, fmt: 'idx' },
    { id: 'infrastructureIndex', label: 'Инфраструктура', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'potentialGrowth', label: 'Рост потенциала', axis: 'right', color: COLOR.rust, fmt: 'pct' },
  ] },
  { id: 'markets', label: 'Рынок', series: [
    { id: 'stockIndex', label: 'Индекс акций', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'bondIndex', label: 'Индекс облигаций', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'yield10y', label: 'Доходность 10 лет', axis: 'right', color: COLOR.teal, fmt: 'pct' },
    { id: 'yield3m', label: 'Доходность 3 месяца', axis: 'right', color: '#8E7CC3', fmt: 'pct' },
    { id: 'volatilityIndex', label: 'Индекс страха', axis: 'right', color: COLOR.rust, fmt: 'idx' },
  ] },
  { id: 'inequality', label: 'Неравенство', series: [
    { id: 'gini', label: 'Джини', axis: 'left', color: COLOR.gold, fmt: 'idx3' },
    { id: 'povertyRate', label: 'Бедность', axis: 'right', color: COLOR.rust, fmt: 'pct' },
  ] },
  { id: 'scores', label: 'Оценки', series: [
    { id: 'scoreStability', label: 'Стабильность', axis: 'left', color: COLOR.gold, fmt: 'idx' },
    { id: 'scoreWelfare', label: 'Благосостояние', axis: 'left', color: COLOR.teal, fmt: 'idx' },
    { id: 'scoreFinancial', label: 'Финансы', axis: 'left', color: COLOR.blue, fmt: 'idx' },
    { id: 'scoreFiscal', label: 'Бюджет', axis: 'left', color: COLOR.rust, fmt: 'idx' },
    { id: 'scorePotential', label: 'Потенциал', axis: 'left', color: '#8E7CC3', fmt: 'idx' },
  ] },
];
const PERIODS = [{ id: '1y', label: '1 год', q: 4 }, { id: '5y', label: '5 лет', q: 20 }, { id: '10y', label: '10 лет', q: 40 }, { id: 'all', label: 'Всё время', q: 1e9 }];
/* На узком диапазоне (например разрыв выпуска от -1.2 до 0) округление до целых
   даёт подряд «0% 0% -1% -1%» — десятая доля появляется только когда она нужна. */
const pctTick = (v) => `${Math.abs(v) < 10 ? Number(v.toFixed(1)) : Math.round(v)}%`;
// idx3 — индекс с тремя знаками (коэффициент Джини от 0 до 1)
const axisTick = (fmtType) => (fmtType === 'money' ? (v) => Math.round(v).toLocaleString('ru-RU') : fmtType === 'idx' ? (v) => Math.round(v)
  : fmtType === 'idx3' ? (v) => v.toFixed(2) : pctTick);
const tooltipVal = (fmtType) => (fmtType === 'money' ? (v) => fmtMoney(v) : fmtType === 'idx' ? (v) => fmt1(v)
  : fmtType === 'idx3' ? (v) => v.toFixed(3) : (v) => `${fmt1(v)}%`);

const FORECAST_ANCHORS = {
  inflation: (e) => e.inflationTarget, coreInflation: (e) => e.inflationTarget,
  inflationExpectations: (e) => e.inflationTarget, gdpGrowth: (e) => e.potentialGrowth,
  potentialGrowth: (e) => e.potentialGrowth, unemployment: (e) => e.nairu, outputGap: () => 0,
  keyRate: (e) => e.rStar + e.inflationTarget, lendingRate: (e) => e.rStar + e.inflationTarget + 2,
  wageGrowth: (e) => e.inflationTarget + e.potentialGrowth, creditGrowth: (e) => e.potentialGrowth + e.inflationTarget,
};
const FORECAST_SIGMA = { inflation: 0.9, inflationExpectations: 0.5, gdpGrowth: 1.1, outputGap: 0.9,
  unemployment: 0.4, keyRate: 0.8, lendingRate: 0.9, wageGrowth: 1.0, stockIndex: 55, exchangeRate: 4 };

/* Сравнение двух точек по графику: зажали мышь на одной, отпустили на другой —
   вместо того чтобы читать всплывающую подсказку дважды и вычитать разницу в
   уме. Один крючок на все графики модуля: recharts сам отдаёт activeLabel в
   мышиных событиях графика, ловить координаты вручную не нужно.
   preventDefault на mousedown — чтобы браузер не запускал попутно выделение
   текста рядом с графиком; userSelect:none на обёртке — вторая, более надёжная
   линия обороны на случай, если событие всё-таки успело уйти дальше. */
function useDragCompare() {
  const [dragStart, setDragStart] = useState(null);
  const [dragRange, setDragRange] = useState(null);
  const onMouseDown = (state, event) => {
    if (event && event.preventDefault) event.preventDefault();
    if (state && state.activeLabel != null) { setDragStart(state.activeLabel); setDragRange(null); }
  };
  const onMouseMove = (state) => {
    if (dragStart == null || !state || state.activeLabel == null) return;
    setDragRange(state.activeLabel === dragStart ? null : { from: dragStart, to: state.activeLabel });
  };
  const onMouseUp = () => setDragStart(null);
  return { dragStart, dragRange, setDragRange, onMouseDown, onMouseMove, onMouseUp };
}
/* Общая карточка с итогом сравнения — одна вёрстка на все графики, которые
   его поддерживают, чтобы не разъезжались стили и поведение. `rows` уже
   содержит готовые подписи и отформатированные значения. */
function CompareBadge({ compare, onReset }) {
  if (!compare) return null;
  return (
    <div className="ems-panel" style={{ padding: '9px 11px', marginTop: 8, background: COLOR.panelAlt, userSelect: 'text' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: COLOR.text }}>
          <b style={{ color: COLOR.goldSoft }}>{compare.labelA}</b> → <b style={{ color: COLOR.goldSoft }}>{compare.labelB}</b>
        </span>
        {compare.quarters != null && <span style={{ fontSize: 12, color: COLOR.faint }}>{compare.quarters} кв.</span>}
        <button className="ems-btn" style={{ marginLeft: 'auto', padding: '2px 7px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onReset(); }}>Сбросить</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {compare.rows.map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            {r.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />}
            <span style={{ color: COLOR.muted, flex: 1, minWidth: 0 }}>{r.label}</span>
            {r.delta === null ? <span style={{ color: COLOR.faint }}>нет данных</span> : (
              <span className="ems-mono">
                {r.fmt(r.a)} → {r.fmt(r.b)} <b style={{ color: r.delta > 0 ? COLOR.teal : r.delta < 0 ? COLOR.rust : COLOR.muted }}>
                  ({r.delta >= 0 ? '+' : ''}{r.deltaPct != null ? `${r.deltaPct.toFixed(1)}%` : r.fmt(r.delta)})</b>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartPanel({ history, chartGroup, setChartGroup, hiddenSeries, setHiddenSeries, period, setPeriod }) {
  const group = CHART_GROUPS.find((g) => g.id === chartGroup);
  const [forecast, setForecast] = useState(false);
  const panelCls = 'ems-panel ems-visual';
  const { dragStart, dragRange, setDragRange, onMouseDown: onChartMouseDown, onMouseMove: onChartMouseMove, onMouseUp: onChartMouseUp } = useDragCompare();
  React.useEffect(() => { setDragRange(null); }, [chartGroup, period, forecast, setDragRange]);
  const data = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period);
    const hist = history.slice(-p.q).map((h) => ({
      ...h,
      deficitPctGdp: -h.budgetBalancePctGdp,
      interestPctGdp: h.gdp ? (h.interestPayment / h.gdp) * 100 : 0,
    }));
    if (!forecast || !hist.length) return hist;
    const last = hist[hist.length - 1];
    const vis = group.series.filter((x) => !hiddenSeries.includes(x.id));
    const out = hist.map((h) => ({ ...h, fanInner: null }));
    const lead = vis[0];
    if (!lead) return out;
    /* Прогноз продолжает линию, а не прыгает к якорю. Раньше он с первого же
       квартала уводил показатель к цели (на четверть расстояния за шаг), и график
       «выравнивался по середине»: пунктир уходил горизонталью, а широкий веер
       95-процентного интервала растягивал вертикальную шкалу так, что вся реальная
       история сплющивалась в узкую полосу. Теперь берётся импульс последних
       кварталов — он затухает, и только потом уровень медленно подтягивается к
       якорю. И продолжаются ВСЕ включённые линии, а не одна первая. */
    const momentum = (id) => {
      const tail = hist.slice(-4).map((h) => h[id]).filter(Number.isFinite);
      if (tail.length < 2) return 0;
      return (tail[tail.length - 1] - tail[0]) / (tail.length - 1);
    };
    const state = {};
    vis.forEach((sx) => { state[sx.id] = { v: last[sx.id], m: momentum(sx.id) }; });
    const sigma = FORECAST_SIGMA[lead.id] || Math.max(0.4, Math.abs(last[lead.id] || 1) * 0.06);
    for (let i = 1; i <= 8; i++) {
      const row = { label: `+${i} кв.`, forecastPoint: true };
      vis.forEach((sx) => {
        const st = state[sx.id];
        if (!Number.isFinite(st.v)) return;
        const anchorFn = FORECAST_ANCHORS[sx.id];
        const anchor = anchorFn ? anchorFn(last) : st.v;
        st.m *= 0.72;
        st.v = st.v + st.m + (anchor - st.v) * 0.12;
        row[`${sx.id}__f`] = st.v;
      });
      const lv = row[`${lead.id}__f`];
      // веер остался, но только ±1σ и только для первого показателя: с широким
      // 95-процентным интервалом шкала жила по вееру, а не по самим данным
      if (Number.isFinite(lv)) { const sd = sigma * Math.sqrt(i) * 0.7; row.fanInner = [lv - sd, lv + sd]; }
      out.push(row);
    }
    // стык: пунктир начинается ровно из последней фактической точки
    const joint = { ...out[hist.length - 1], fanInner: [last[lead.id], last[lead.id]] };
    vis.forEach((sx) => { joint[`${sx.id}__f`] = last[sx.id]; });
    out[hist.length - 1] = joint;
    return out;
  }, [history, period, forecast, chartGroup, hiddenSeries]);

  // граница факта и прогноза: последняя точка реальной истории
  const nowLabel = useMemo(() => {
    const factual = data.filter((r) => !r.forecastPoint);
    return factual.length ? factual[factual.length - 1].label : null;
  }, [data]);
  const toggleSeries = (id) => setHiddenSeries((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const visible = group.series.filter((s) => !hiddenSeries.includes(s.id));
  const leftDef = visible.find((s) => s.axis === 'left');
  const rightDef = visible.find((s) => s.axis === 'right');
  /* Масштаб оси — по данным, но не уже разумного минимума. Раньше шкала ВВП
     начиналась с нуля (линия лежала плоско под потолком), а процентная ось
     подстраивалась под разброс в сотые доли: разрыв выпуска −0,2% за первый
     квартал выглядел обвалом во всю высоту графика. */
  const axisDomainFor = (axis) => {
    const list = visible.filter((x) => x.axis === axis);
    if (!list.length) return ['auto', 'auto'];
    const vals = [];
    data.forEach((row) => {
      list.forEach((x) => { [row[x.id], row[`${x.id}__f`]].forEach((v) => { if (Number.isFinite(v)) vals.push(v); }); });
      if (Array.isArray(row.fanInner) && visible[0] && visible[0].axis === axis) row.fanInner.forEach((v) => { if (Number.isFinite(v)) vals.push(v); });
    });
    if (!vals.length) return ['auto', 'auto'];
    let lo = Math.min(...vals); let hi = Math.max(...vals);
    const level = list[0].fmt === 'money' || list[0].fmt === 'idx';
    const minSpan = list[0].fmt === 'idx3' ? 0.03 : level ? Math.max(Math.abs((lo + hi) / 2) * 0.06, 1) : 2;
    if (hi - lo < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4)));
    return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  };
  const seriesById = Object.fromEntries(group.series.map((s) => [s.id, s]));

  // значение показателя в точке графика: прогнозная точка хранит его под
  // `${id}__f`, фактическая — под самим id
  const valueAt = (row, id) => (row ? (row.forecastPoint ? row[`${id}__f`] : row[id]) : undefined);
  const compare = useMemo(() => {
    if (!dragRange) return null;
    const i1 = data.findIndex((r) => r.label === dragRange.from);
    const i2 = data.findIndex((r) => r.label === dragRange.to);
    if (i1 === -1 || i2 === -1) return null;
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const rowA = data[lo]; const rowB = data[hi];
    const rows = visible.map((s) => {
      const a = valueAt(rowA, s.id); const b = valueAt(rowB, s.id);
      const fmtFn = tooltipVal(s.fmt);
      return { key: s.id, label: s.label, color: s.color, fmt: fmtFn, a, b, delta: (Number.isFinite(a) && Number.isFinite(b)) ? b - a : null };
    });
    return { labelA: rowA.label, labelB: rowB.label, quarters: hi - lo, rows };
  }, [dragRange, data, visible]);

  return (
    <div className={panelCls} style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>График экономики</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12, background: forecast ? COLOR.sel : COLOR.panelAlt,
            color: forecast ? COLOR.selText : COLOR.text, borderColor: forecast ? COLOR.selBorder : COLOR.border }}
            onClick={() => { Audio.play('tab'); setForecast((f) => !f); }}
            title="Дорисовать к графику 8 кварталов вперёд: пунктир — куда показатель придёт сам собой, если ничего не менять, заливка — насколько эта оценка неточна">
            {forecast ? 'скрыть прогноз' : 'прогноз на 8 кв.'}
          </button>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { Audio.play('tab'); setPeriod(p.id); }} className="ems-btn" style={{ padding: '4px 9px', fontSize: 12, background: period === p.id ? COLOR.sel : COLOR.panelAlt, color: period === p.id ? COLOR.selText : COLOR.text, borderColor: period === p.id ? COLOR.selBorder : COLOR.border }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* пять главных вкладок и «ещё ▾» с остальными: одиннадцать вкладок переносились на вторую строку */}
      <div className="ems-tabrow" style={{ borderBottom: `1px solid ${COLOR.border}`, paddingBottom: 4, marginBottom: 10, alignItems: 'center' }}>
        {CHART_GROUPS.filter((g) => MAIN_GROUPS.includes(g.id)).map((g) => (
          <button type="button" key={g.id} className={`ems-tab ${chartGroup === g.id ? 'active' : ''}`} aria-pressed={chartGroup === g.id} style={{ flexShrink: 0 }} onClick={() => { Audio.play('tab'); setChartGroup(g.id); }}>{g.label}</button>
        ))}
        <select className={`ems-tab ${MAIN_GROUPS.includes(chartGroup) ? '' : 'active'}`} aria-label="Другие графики"
          value={MAIN_GROUPS.includes(chartGroup) ? '' : chartGroup}
          onChange={(e) => { if (!e.target.value) return; Audio.play('tab'); setChartGroup(e.target.value); }}
          style={{ flexShrink: 0, width: 'auto', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', background: MAIN_GROUPS.includes(chartGroup) ? 'transparent' : undefined,
            color: MAIN_GROUPS.includes(chartGroup) ? COLOR.muted : undefined, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
          <option value="">ещё ▾</option>
          {CHART_GROUPS.filter((g) => !MAIN_GROUPS.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}{chartGroup === g.id ? ' ▾' : ''}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {group.series.map((s) => {
          const active = !hiddenSeries.includes(s.id);
          return (
            <button key={s.id} onClick={() => { Audio.play('tick'); toggleSeries(s.id); }} className="ems-btn"
              style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: active ? COLOR.panelAlt : 'transparent', borderColor: active ? s.color : COLOR.border, color: active ? COLOR.text : COLOR.muted, opacity: active ? 1 : 0.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />{s.label}
            </button>
          );
        })}
      </div>

      {/* из одной точки линии не получается — на старте вместо пустых осей честная подпись */}
      {history.length < 2 ? (
        <div style={{ height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: `1px dashed ${COLOR.border}`, borderRadius: 6, color: COLOR.muted, fontSize: 13, textAlign: 'center', padding: 16 }}>
          <Activity size={20} color={COLOR.faint} />
          График появится после первого квартала.
          <span style={{ fontSize: 12, color: COLOR.faint }}>Каждый завершённый квартал добавит точку — и станет видно, куда движется экономика.</span>
        </div>
      ) : (
      <div className="ems-visual" style={{ width: '100%', height: 250, cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
            onMouseDown={onChartMouseDown} onMouseMove={onChartMouseMove} onMouseUp={onChartMouseUp} onMouseLeave={onChartMouseUp}>
            <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLOR.muted }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: COLOR.muted }} width={50} tickFormatter={axisTick(leftDef ? leftDef.fmt : 'pct')}
              domain={axisDomainFor('left')} />
            {rightDef && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: COLOR.muted }} width={50} tickFormatter={axisTick(rightDef.fmt)}
              domain={axisDomainFor('right')} />}
            <Tooltip contentStyle={{ background: COLOR.panel, border: `1px solid ${COLOR.border}`, fontSize: 12 }} labelStyle={{ color: COLOR.goldSoft }}
              formatter={(value, name, props) => {
                // прогноз рисуется отдельными ключами (`${id}__f`, `fanInner`) —
                // они не совпадают ни с одним настоящим показателем, formatter
                // проваливался в необработанное число и печатал все 13 знаков
                // после запятой, которые накопились в вычислениях с плавающей точкой
                const rawKey = String(props.dataKey || '').replace(/__f$/, '');
                const def = seriesById[rawKey] || seriesById[(visible[0] || {}).id];
                const fmtFn = def ? tooltipVal(def.fmt) : fmt1;
                if (Array.isArray(value)) return [`${fmtFn(value[0])} – ${fmtFn(value[1])}`, name];
                return [fmtFn(value), name];
              }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {dragRange && (
              <ReferenceArea yAxisId="left" x1={dragRange.from} x2={dragRange.to}
                stroke={COLOR.goldSoft} strokeOpacity={0.5} fill={COLOR.gold} fillOpacity={0.1} />
            )}
            {forecast && nowLabel && (
              <ReferenceLine yAxisId="left" x={nowLabel} stroke={COLOR.faint} strokeDasharray="3 3"
                label={{ value: 'сейчас', position: 'insideTop', fontSize: 12, fill: COLOR.muted }} />
            )}
            {forecast && visible[0] && (
              <Area yAxisId={visible[0].axis} type="monotone" dataKey="fanInner" name="68% интервал"
                stroke="none" fill={visible[0].color} fillOpacity={0.16} isAnimationActive={false} legendType="none" />
            )}
            {forecast && visible.map((s) => (
              <Line key={`${s.id}__f`} yAxisId={s.axis} type="monotone" dataKey={`${s.id}__f`} name="прогноз"
                stroke={s.color} strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} legendType="none" />
            ))}
            {visible.map((s) => (
              <Line key={s.id} yAxisId={s.axis} type="monotone" dataKey={s.id} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      )}
      <CompareBadge compare={compare} onReset={() => setDragRange(null)} />
      <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 4, lineHeight: 1.5 }}>
        {forecast
          ? <>Пунктир справа от отметки «сейчас» продолжает каждую включённую линию туда, куда она идёт <b style={{ color: COLOR.text }}>сама собой</b>,
            если вы больше ничего не меняете: движение последних кварталов затухает, и показатель постепенно подтягивается к своему якорю
            (цель ЦБ по инфляции, потенциальный рост, естественная безработица). Заливка — разброс вокруг
            <b style={{ color: COLOR.text }}> «{(visible[0] || group.series[0]).label}»</b>, первого включённого показателя: не предсказание,
            а линейка неопределённости, и чем дальше горизонт, тем она шире.</>
          : <>Темпы роста и ставки показаны в годовом выражении; траектория рассчитывается по кварталам. Нажмите на показатель выше, чтобы скрыть или показать его линию.
            Кнопка <b style={{ color: COLOR.text }}>«прогноз на 8 кв.»</b> продолжает включённые линии пунктиром: куда они уйдут сами, если ничего не менять.
            Зажмите мышь на графике и потяните в сторону, чтобы сравнить значения между двумя точками.</>}
      </div>
    </div>
  );
}

function MiniChart({ data, color, height = 46, label, fmt, marks }) {
  const rows = (data || []).map((v, i) => ({ i, v: Number.isFinite(v) ? v : null }));
  const { dragStart, dragRange, setDragRange, onMouseDown, onMouseMove, onMouseUp } = useDragCompare();
  React.useEffect(() => { setDragRange(null); }, [data, setDragRange]);
  if (rows.filter((r) => r.v !== null).length < 2) return <div style={{ height }} />;
  const markSet = {};
  (marks || []).forEach((m) => { if (m.idx >= 0) markSet[m.idx] = m; });
  const dot = (props) => {
    const m = markSet[props.payload.i];
    if (!m) return null;
    return (
      <g key={`m${props.payload.i}`}>
        <circle cx={props.cx} cy={props.cy} r={4.2} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust} stroke={COLOR.bg} strokeWidth={1} />
        <text x={props.cx} y={props.cy - 7} textAnchor="middle" fontSize={8} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust}>
          {m.side === 'buy' ? 'B' : 'S'}
        </text>
      </g>
    );
  };
  const fmtFn = fmt || fmt1;
  const pointLabel = (i) => (rows.length - 1 - i === 0 ? 'сейчас' : `${rows.length - 1 - i} кв. назад`);
  const compare = useMemo(() => {
    if (!dragRange) return null;
    const rowA = rows[dragRange.from]; const rowB = rows[dragRange.to];
    if (!rowA || !rowB) return null;
    const [a, b] = dragRange.from <= dragRange.to ? [rowA.v, rowB.v] : [rowB.v, rowA.v];
    const [lo, hi] = dragRange.from <= dragRange.to ? [dragRange.from, dragRange.to] : [dragRange.to, dragRange.from];
    const valid = Number.isFinite(a) && Number.isFinite(b);
    // мини-графики — сплошь рыночные и портфельные ряды (индексы, курс, капитал):
    // изменение в пунктах индекса ничего не говорит без знания шкалы, а вот
    // проценты сравнимы между инструментами и с ожиданиями игрока
    return { labelA: pointLabel(lo), labelB: pointLabel(hi), quarters: hi - lo,
      rows: [{ key: 'v', label: label || 'значение', color, fmt: fmtFn, a, b, delta: valid ? b - a : null,
        deltaPct: valid && a !== 0 ? (b - a) / Math.abs(a) * 100 : null }] };
  }, [dragRange, rows]);
  return (
    <>
      <div className="ems-visual" style={{ width: '100%', height, cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12, padding: '4px 8px' }}
              labelFormatter={(i) => `${(marks && marks.label) || ''}${pointLabel(i)}`}
              formatter={(v) => [fmt ? fmt(v) : fmt1(v), label || 'значение']} />
            {dragRange && <ReferenceArea x1={dragRange.from} x2={dragRange.to} stroke={COLOR.goldSoft} strokeOpacity={0.5} fill={COLOR.gold} fillOpacity={0.12} />}
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={marks && marks.length ? dot : false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <CompareBadge compare={compare} onReset={() => setDragRange(null)} />
    </>
  );
}
export const MemoChart = React.memo(MiniChart);

/* График инструмента в терминале: цена, ваша средняя, отметки сделок и — по
   желанию — эталон, приведённый к той же стартовой точке. Приведение и есть
   смысл сравнения: видно не «что выросло сильнее в пунктах», а обогнали вы
   рынок или отстали, если бы вложились в начале показанного отрезка. */
function InstrumentChartBase({ rows, color, avg, marks, benchLabel, benchColor, height = 190 }) {
  const markSet = {};
  (marks || []).forEach((m) => { if (m.idx >= 0) markSet[m.idx] = m; });
  const dot = (props) => {
    const m = markSet[props.payload.i];
    if (!m) return null;
    return (
      <g key={`m${props.payload.i}`}>
        <circle cx={props.cx} cy={props.cy} r={4.6} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust} stroke={COLOR.bg} strokeWidth={1.2} />
        <text x={props.cx} y={props.cy - 8} textAnchor="middle" fontSize={8.5} fill={m.side === 'buy' ? COLOR.teal : COLOR.rust}>
          {m.side === 'buy' ? 'B' : 'S'}
        </text>
      </g>
    );
  };
  const { dragStart, dragRange, setDragRange, onMouseDown, onMouseMove, onMouseUp } = useDragCompare();
  React.useEffect(() => { setDragRange(null); }, [rows, setDragRange]);
  const compare = useMemo(() => {
    if (!dragRange || !rows) return null;
    const i1 = rows.findIndex((r) => r.label === dragRange.from);
    const i2 = rows.findIndex((r) => r.label === dragRange.to);
    if (i1 === -1 || i2 === -1) return null;
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const rowA = rows[lo]; const rowB = rows[hi];
    // цена инструмента и цена эталона — это рынок: изменение в пунктах цены ничего
    // не говорит без знания её масштаба, а вот в процентах инструменты сравнимы
    // друг с другом и с ожиданиями игрока
    const pricePctValid = Number.isFinite(rowA.price) && Number.isFinite(rowB.price);
    const compareRows = [{ key: 'price', label: 'Цена', color, fmt: fmt1, a: rowA.price, b: rowB.price,
      delta: pricePctValid ? rowB.price - rowA.price : null,
      deltaPct: pricePctValid && rowA.price !== 0 ? (rowB.price - rowA.price) / Math.abs(rowA.price) * 100 : null }];
    if (benchLabel) {
      const benchPctValid = Number.isFinite(rowA.bench) && Number.isFinite(rowB.bench);
      compareRows.push({ key: 'bench', label: benchLabel, color: benchColor || COLOR.faint, fmt: fmt1, a: rowA.bench, b: rowB.bench,
        delta: benchPctValid ? rowB.bench - rowA.bench : null,
        deltaPct: benchPctValid && rowA.bench !== 0 ? (rowB.bench - rowA.bench) / Math.abs(rowA.bench) * 100 : null });
    }
    return { labelA: rowA.label, labelB: rowB.label, quarters: hi - lo, rows: compareRows };
  }, [dragRange, rows, color, benchLabel, benchColor]);
  if (!rows || rows.length < 2) return <div style={{ height }} />;
  return (
    <>
      <div className="ems-visual" style={{ width: '100%', height, cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLOR.faint }} interval="preserveStartEnd" minTickGap={22} />
            <YAxis tick={{ fontSize: 12, fill: COLOR.muted }} width={52} domain={['auto', 'auto']}
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ru-RU') : fmt1(v))} />
            <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12, padding: '5px 9px' }}
              labelStyle={{ color: COLOR.goldSoft }}
              formatter={(v, name) => [fmt1(v), name]} />
            {dragRange && <ReferenceArea x1={dragRange.from} x2={dragRange.to} stroke={COLOR.goldSoft} strokeOpacity={0.5} fill={COLOR.gold} fillOpacity={0.1} />}
            {Number.isFinite(avg) && avg > 0 && (
              <ReferenceLine y={avg} stroke={COLOR.goldSoft} strokeDasharray="4 4" strokeWidth={1.2}
                label={{ value: `ваша средняя ${fmt1(avg)}`, position: 'insideTopRight', fontSize: 12, fill: COLOR.goldSoft }} />
            )}
            {benchLabel && (
              <Line type="monotone" dataKey="bench" name={benchLabel} stroke={benchColor || COLOR.faint}
                strokeWidth={1.3} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
            )}
            <Line type="monotone" dataKey="price" name="цена" stroke={color} strokeWidth={2}
              dot={marks && marks.length ? dot : false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <CompareBadge compare={compare} onReset={() => setDragRange(null)} />
    </>
  );
}
export const InstrumentChart = React.memo(InstrumentChartBase);

function computeIRF(economy, decisions, leverId, baseValue, newValue, difficulty, horizon) {
  const H = horizon || 12;
  const noiseSave = CONFIG.noiseMult[difficulty];
  const evSave = CONFIG.eventProbability[difficulty];
  CONFIG.noiseMult[difficulty] = 0; CONFIG.eventProbability[difficulty] = 0;
  const run = (val) => {
    let e = economy; let d = { ...decisions, [leverId]: val };
    let pend = []; let cds = {}; let st = []; const out = [];
    for (let q = 1; q <= H; q++) {
      const r = simulateQuarter({ economy: e, decisions: d, pendingImpulses: pend, eventCooldowns: cds,
        difficulty, quarterIndex: q, stories: st });
      e = r.economy; pend = r.pendingImpulses; cds = r.eventCooldowns; st = r.stories;
      d = { ...defaultDecisions(e, d), [leverId]: val };
      out.push(e);
    }
    return out;
  };
  let res = [];
  try {
    const base = run(baseValue);
    const alt = run(newValue);
    res = base.map((b, i) => ({
      q: i + 1,
      gdpGrowth: alt[i].gdpGrowth - b.gdpGrowth,
      inflation: alt[i].inflation - b.inflation,
      unemployment: alt[i].unemployment - b.unemployment,
      outputGap: alt[i].outputGap - b.outputGap,
      debtToGdp: alt[i].debtToGdp - b.debtToGdp,
      stockIndex: (alt[i].stockIndex / b.stockIndex - 1) * 100,
      baseGdp: b.gdpGrowth, altGdp: alt[i].gdpGrowth,
      baseInfl: b.inflation, altInfl: alt[i].inflation,
    }));
  } catch { res = []; }
  CONFIG.noiseMult[difficulty] = noiseSave; CONFIG.eventProbability[difficulty] = evSave;
  return res;
}
const IRF_SERIES = [
  { key: 'gdpGrowth', label: 'Рост ВВП', color: COLOR.gold, unit: ' п.п.' },
  { key: 'inflation', label: 'Инфляция', color: COLOR.rust, unit: ' п.п.' },
  { key: 'unemployment', label: 'Безработица', color: COLOR.blue, unit: ' п.п.' },
  { key: 'debtToGdp', label: 'Долг к ВВП', color: COLOR.teal, unit: ' п.п.' },
  { key: 'stockIndex', label: 'Индекс акций', color: '#8E7CC3', unit: '%' },
];
export function IRFModal({ economy, decisions, lever, value, baseValue, difficulty, onClose }) {
  useEscapeClose(onClose);
  const data = useMemo(() => computeIRF(economy, decisions, lever.id, baseValue, value, difficulty, 12),
    [lever.id, baseValue, value]);
  const peak = (key) => data.reduce((a, d) => (Math.abs(d[key]) > Math.abs(a.v) ? { v: d[key], q: d.q } : a), { v: 0, q: 0 });
  const { dragStart, dragRange, setDragRange, onMouseDown, onMouseMove, onMouseUp } = useDragCompare();
  React.useEffect(() => { setDragRange(null); }, [data, setDragRange]);
  const compare = useMemo(() => {
    if (!dragRange) return null;
    const i1 = data.findIndex((r) => r.q === dragRange.from);
    const i2 = data.findIndex((r) => r.q === dragRange.to);
    if (i1 === -1 || i2 === -1) return null;
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const rowA = data[lo]; const rowB = data[hi];
    const rows = IRF_SERIES.map((sr) => {
      const a = rowA[sr.key]; const b = rowB[sr.key];
      return { key: sr.key, label: sr.label, color: sr.color, fmt: (v) => `${fmtSigned1(v)}${sr.unit}`, a, b,
        delta: (Number.isFinite(a) && Number.isFinite(b)) ? b - a : null };
    });
    return { labelA: `${rowA.q}-й кв.`, labelB: `${rowB.q}-й кв.`, quarters: hi - lo, rows };
  }, [dragRange, data]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 720, width: '100%', padding: 18, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Activity size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>Реакция экономики: {lever.label}</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose} aria-label="Закрыть"><X size={13} /></button>
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Модель прогоняется на 12 кварталов вперёд дважды: с текущим значением ({fmt1(decisions[lever.id])}{lever.suffix})
          и с новым ({fmt1(value)}{lever.suffix}), без случайных шоков и событий. На графике — разница между этими двумя мирами,
          то есть чистый эффект именно вашего решения.
        </div>
        <div className="ems-visual" style={{ height: 230, cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
              <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="q" tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border}
                label={{ value: 'кварталов после решения', fill: COLOR.faint, fontSize: 12, position: 'insideBottom', offset: -2 }} />
              <YAxis tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} />
              <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12 }}
                labelFormatter={(v) => `${v}-й квартал`} formatter={(v, n) => [fmtSigned1(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {dragRange && (
                <ReferenceArea x1={dragRange.from} x2={dragRange.to} stroke={COLOR.goldSoft} strokeOpacity={0.5} fill={COLOR.gold} fillOpacity={0.1} />
              )}
              {IRF_SERIES.map((sr) => (
                <Line key={sr.key} type="monotone" dataKey={sr.key} name={sr.label} stroke={sr.color} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <CompareBadge compare={compare} onReset={() => setDragRange(null)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 12 }}>
          {IRF_SERIES.map((sr) => {
            const pk = peak(sr.key);
            return (
              <div key={sr.key} className="ems-panel" style={{ padding: 9 }}>
                <div style={{ fontSize: 12, color: COLOR.muted }}>{sr.label}</div>
                <div className="ems-mono" style={{ fontSize: 15, color: sr.color }}>{fmtSigned1(pk.v)}{sr.unit}</div>
                <div style={{ fontSize: 12, color: COLOR.faint }}>{pk.q ? `пик через ${pk.q} кв.` : 'без заметного эффекта'}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 12, lineHeight: 1.5 }}>
          Это контрфактический расчёт: «что было бы, если бы». Реальная траектория будет отличаться — в ней будут шоки,
          решения второго ведомства и накопленные ожидания. Но знак, форма и задержка эффекта останутся теми же.
        </div>
      </div>
    </div>
  );
}
