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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine,
} from 'recharts';
import { Activity, X } from 'lucide-react';
import { CONFIG, fmt1, fmtMoney, fmtSigned1, defaultDecisions, simulateQuarter } from './lib/engine.js';
import { COLOR, Audio } from './MacroSimulator.jsx';

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
const axisTick = (fmtType) => (fmtType === 'money' ? (v) => Math.round(v).toLocaleString('ru-RU') : fmtType === 'idx' ? (v) => Math.round(v) : pctTick);
const tooltipVal = (fmtType) => (fmtType === 'money' ? (v) => fmtMoney(v) : fmtType === 'idx' ? (v) => fmt1(v) : (v) => `${fmt1(v)}%`);

const FORECAST_ANCHORS = {
  inflation: (e) => e.inflationTarget, coreInflation: (e) => e.inflationTarget,
  inflationExpectations: (e) => e.inflationTarget, gdpGrowth: (e) => e.potentialGrowth,
  potentialGrowth: (e) => e.potentialGrowth, unemployment: (e) => e.nairu, outputGap: () => 0,
  keyRate: (e) => e.rStar + e.inflationTarget, lendingRate: (e) => e.rStar + e.inflationTarget + 2,
  wageGrowth: (e) => e.inflationTarget + e.potentialGrowth, creditGrowth: (e) => e.potentialGrowth + e.inflationTarget,
};
const FORECAST_SIGMA = { inflation: 0.9, inflationExpectations: 0.5, gdpGrowth: 1.1, outputGap: 0.9,
  unemployment: 0.4, keyRate: 0.8, lendingRate: 0.9, wageGrowth: 1.0, stockIndex: 55, exchangeRate: 4 };

export function ChartPanel({ history, chartGroup, setChartGroup, hiddenSeries, setHiddenSeries, period, setPeriod }) {
  const group = CHART_GROUPS.find((g) => g.id === chartGroup);
  const [forecast, setForecast] = useState(false);
  const panelCls = 'ems-panel ems-visual';
  const data = useMemo(() => {
    const p = PERIODS.find((x) => x.id === period);
    const hist = history.slice(-p.q).map((h) => ({
      ...h,
      deficitPctGdp: -h.budgetBalancePctGdp,
      interestPctGdp: h.gdp ? (h.interestPayment / h.gdp) * 100 : 0,
    }));
    if (!forecast || !hist.length) return hist;
    // веер неопределённости: инерционный прогноз к якорю с расширяющимися границами
    const last = hist[hist.length - 1];
    const vis = group.series.filter((x) => !hiddenSeries.includes(x.id));
    const lead = vis[0];
    const out = hist.map((h) => ({ ...h, fanBand: null }));
    if (!lead) return out;
    const anchorFn = FORECAST_ANCHORS[lead.id];
    const anchor = anchorFn ? anchorFn(last) : last[lead.id];
    const sigma = FORECAST_SIGMA[lead.id] || Math.max(0.4, Math.abs(last[lead.id] || 1) * 0.06);
    let v = last[lead.id];
    for (let i = 1; i <= 8; i++) {
      v += (anchor - v) * 0.28;
      const sd = sigma * Math.sqrt(i) * 0.9;
      out.push({ label: `+${i} кв.`, forecastPoint: true,
        [`${lead.id}__f`]: v, fanBand: [v - 1.96 * sd, v + 1.96 * sd], fanInner: [v - sd, v + sd] });
    }
    out[hist.length - 1] = { ...out[hist.length - 1], [`${lead.id}__f`]: last[lead.id],
      fanBand: [last[lead.id], last[lead.id]], fanInner: [last[lead.id], last[lead.id]] };
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
  const seriesById = Object.fromEntries(group.series.map((s) => [s.id, s]));

  return (
    <div className={panelCls} style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>График экономики</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 11, background: forecast ? COLOR.gold : COLOR.panelAlt,
            color: forecast ? COLOR.ink : COLOR.text, borderColor: forecast ? COLOR.gold : COLOR.border }}
            onClick={() => { Audio.play('tab'); setForecast((f) => !f); }}
            title="Дорисовать к графику 8 кварталов вперёд: пунктир — куда показатель придёт сам собой, если ничего не менять, заливка — насколько эта оценка неточна">
            {forecast ? 'скрыть прогноз' : 'прогноз на 8 кв.'}
          </button>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { Audio.play('tab'); setPeriod(p.id); }} className="ems-btn" style={{ padding: '4px 9px', fontSize: 11, background: period === p.id ? COLOR.gold : COLOR.panelAlt, color: period === p.id ? COLOR.ink : COLOR.text, borderColor: period === p.id ? COLOR.gold : COLOR.border }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ems-scroll" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${COLOR.border}`, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {CHART_GROUPS.map((g) => (
          <span key={g.id} className={`ems-tab ${chartGroup === g.id ? 'active' : ''}`} style={{ flexShrink: 0 }} onClick={() => { Audio.play('tab'); setChartGroup(g.id); }}>{g.label}</span>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {group.series.map((s) => {
          const active = !hiddenSeries.includes(s.id);
          return (
            <button key={s.id} onClick={() => { Audio.play('tick'); toggleSeries(s.id); }} className="ems-btn"
              style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: active ? COLOR.panelAlt : 'transparent', borderColor: active ? s.color : COLOR.border, color: active ? COLOR.text : COLOR.muted, opacity: active ? 1 : 0.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />{s.label}
            </button>
          );
        })}
      </div>

      <div className="ems-visual" style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLOR.muted }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: COLOR.muted }} width={50} tickFormatter={axisTick(leftDef ? leftDef.fmt : 'pct')} />
            {rightDef && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: COLOR.muted }} width={50} tickFormatter={axisTick(rightDef.fmt)} />}
            <Tooltip contentStyle={{ background: COLOR.panel, border: `1px solid ${COLOR.border}`, fontSize: 12 }} labelStyle={{ color: COLOR.goldSoft }}
              formatter={(value, name, props) => { const def = seriesById[props.dataKey]; return [def ? tooltipVal(def.fmt)(value) : value, name]; }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {forecast && nowLabel && (
              <ReferenceLine yAxisId="left" x={nowLabel} stroke={COLOR.faint} strokeDasharray="3 3"
                label={{ value: 'сейчас', position: 'insideTop', fontSize: 9.5, fill: COLOR.muted }} />
            )}
            {forecast && visible[0] && (
              <Area yAxisId={visible[0].axis} type="monotone" dataKey="fanBand" name="95% интервал"
                stroke="none" fill={visible[0].color} fillOpacity={0.10} isAnimationActive={false} legendType="none" />
            )}
            {forecast && visible[0] && (
              <Area yAxisId={visible[0].axis} type="monotone" dataKey="fanInner" name="68% интервал"
                stroke="none" fill={visible[0].color} fillOpacity={0.18} isAnimationActive={false} legendType="none" />
            )}
            {forecast && visible[0] && (
              <Line yAxisId={visible[0].axis} type="monotone" dataKey={`${visible[0].id}__f`} name="прогноз"
                stroke={visible[0].color} strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} legendType="none" />
            )}
            {visible.map((s) => (
              <Line key={s.id} yAxisId={s.axis} type="monotone" dataKey={s.id} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10.5, color: COLOR.muted, marginTop: 4, lineHeight: 1.5 }}>
        {forecast
          ? <>Прогноз для показателя <b style={{ color: COLOR.text }}>«{(visible[0] || group.series[0]).label}»</b> — первого включённого в списке выше.
            Пунктир справа от отметки «сейчас» — куда показатель придёт <b style={{ color: COLOR.text }}>сам собой</b>, если вы больше ничего не меняете:
            он затухает к своему якорю (цель ЦБ по инфляции, потенциальный рост, естественная безработица) примерно на четверть расстояния за квартал.
            Заливка — насколько этой оценке можно верить: тёмная полоса это 68%, светлая 95%. Это не предсказание модели, а линейка неопределённости:
            чем дальше горизонт, тем она шире.</>
          : <>Темпы роста и ставки показаны в годовом выражении; траектория рассчитывается по кварталам. Нажмите на показатель выше, чтобы скрыть или показать его линию.
            Кнопка <b style={{ color: COLOR.text }}>«прогноз на 8 кв.»</b> дорисовывает справа, куда первый включённый показатель уйдёт сам, если ничего не менять — с веером неопределённости.</>}
      </div>
    </div>
  );
}

function MiniChart({ data, color, height = 46, label, fmt, marks }) {
  const rows = (data || []).map((v, i) => ({ i, v: Number.isFinite(v) ? v : null }));
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
  return (
    <div className="ems-visual" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 11, padding: '4px 8px' }}
            labelFormatter={(i) => `${(marks && marks.label) || ''}${rows.length - 1 - i === 0 ? 'сейчас' : `${rows.length - 1 - i} кв. назад`}`}
            formatter={(v) => [fmt ? fmt(v) : fmt1(v), label || 'значение']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={marks && marks.length ? dot : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
  if (!rows || rows.length < 2) return <div style={{ height }} />;
  return (
    <div className="ems-visual" style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.border} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: COLOR.faint }} interval="preserveStartEnd" minTickGap={22} />
          <YAxis tick={{ fontSize: 9.5, fill: COLOR.muted }} width={52} domain={['auto', 'auto']}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ru-RU') : fmt1(v))} />
          <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 11.5, padding: '5px 9px' }}
            labelStyle={{ color: COLOR.goldSoft }}
            formatter={(v, name) => [fmt1(v), name]} />
          {Number.isFinite(avg) && avg > 0 && (
            <ReferenceLine y={avg} stroke={COLOR.goldSoft} strokeDasharray="4 4" strokeWidth={1.2}
              label={{ value: `ваша средняя ${fmt1(avg)}`, position: 'insideTopRight', fontSize: 9.5, fill: COLOR.goldSoft }} />
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
  const data = useMemo(() => computeIRF(economy, decisions, lever.id, baseValue, value, difficulty, 12),
    [lever.id, baseValue, value]);
  const peak = (key) => data.reduce((a, d) => (Math.abs(d[key]) > Math.abs(a.v) ? { v: d[key], q: d.q } : a), { v: 0, q: 0 });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 720, width: '100%', padding: 18, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Activity size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>Реакция экономики: {lever.label}</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose} aria-label="Закрыть"><X size={13} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Модель прогоняется на 12 кварталов вперёд дважды: с текущим значением ({fmt1(decisions[lever.id])}{lever.suffix})
          и с новым ({fmt1(value)}{lever.suffix}), без случайных шоков и событий. На графике — разница между этими двумя мирами,
          то есть чистый эффект именно вашего решения.
        </div>
        <div className="ems-visual" style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="q" tick={{ fill: COLOR.faint, fontSize: 10 }} stroke={COLOR.border}
                label={{ value: 'кварталов после решения', fill: COLOR.faint, fontSize: 10, position: 'insideBottom', offset: -2 }} />
              <YAxis tick={{ fill: COLOR.faint, fontSize: 10 }} stroke={COLOR.border} />
              <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 11 }}
                labelFormatter={(v) => `${v}-й квартал`} formatter={(v, n) => [fmtSigned1(v), n]} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              {IRF_SERIES.map((sr) => (
                <Line key={sr.key} type="monotone" dataKey={sr.key} name={sr.label} stroke={sr.color} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 12 }}>
          {IRF_SERIES.map((sr) => {
            const pk = peak(sr.key);
            return (
              <div key={sr.key} className="ems-panel" style={{ padding: 9 }}>
                <div style={{ fontSize: 10.5, color: COLOR.muted }}>{sr.label}</div>
                <div className="ems-mono" style={{ fontSize: 15, color: sr.color }}>{fmtSigned1(pk.v)}{sr.unit}</div>
                <div style={{ fontSize: 10, color: COLOR.faint }}>{pk.q ? `пик через ${pk.q} кв.` : 'без заметного эффекта'}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 12, lineHeight: 1.5 }}>
          Это контрфактический расчёт: «что было бы, если бы». Реальная траектория будет отличаться — в ней будут шоки,
          решения второго ведомства и накопленные ожидания. Но знак, форма и задержка эффекта останутся теми же.
        </div>
      </div>
    </div>
  );
}
