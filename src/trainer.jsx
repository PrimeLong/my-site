/* ТРЕНАЖЁР: экраны вне партии, которые учат читать модель, а не выигрывать.
   • Лаборатория — импульсный отклик одного рычага (src/lib/lab.js).
   Отдельный ленивый чанк: в меню и в партии этот код не нужен. */
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlaskConical } from 'lucide-react';
import { COLOR, Audio, GlobalStyle } from './MacroSimulator.jsx';
import { SCENARIOS, fmt1, fmtSigned1 } from './lib/engine.js';
import { impulseResponse, peakOf, LAB_LEVERS, LAB_METRICS, defaultLabMode } from './lib/lab.js';

/* Общая рамка страницы тренажёра: кнопка назад, заголовок, вводный абзац. */
export function TrainerPage({ eyebrow, title, lede, onBack, children, icon: Icon = FlaskConical, wide = false }) {
  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: wide ? 960 : 760, width: '100%', minWidth: 0 }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>← Назад в меню</button>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="ems-hero-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={12} />{eyebrow}</div>
          <div className="ems-hero-title small">{title}</div>
          <div className="ems-hero-rule" />
          {lede && <div className="ems-hero-lede">{lede}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="ems-seg" role="group" aria-label={label} style={{ display: 'flex' }}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => { Audio.play('click'); onChange(o.id); }}
          style={{ flex: '1 1 0', whiteSpace: 'nowrap' }}>{o.label}</button>
      ))}
    </div>
  );
}

// шаг эксперимента по умолчанию — заметный, но реалистичный для одного решения
const DEFAULT_DELTA = { keyRate: 1, govSpending: 2, transfers: 2, govInvestment: 2, incomeTaxRate: 2, vatRate: 2,
  profitTaxRate: 2, socialContribRate: 2, moneySupplyOp: 2, fxIntervention: 10, reserveReq: 2, capitalRequirement: 1 };
const deltaRange = (l) => (l.scale === 'gdp' ? 25 : Math.max(l.step * 4, Math.round((l.max - l.min) / 4)));

// цепочка передачи: что должно произойти и почему — чтобы график читался, а не угадывался
const LAB_NOTES = {
  keyRate: 'Ставка → ставки по кредитам → кредит и инвестиции → спрос → разрыв выпуска → безработица (Оукен) → инфляция (Филлипс). Параллельно: выше ставка — приток капитала — курс крепче — импорт дешевле. Инфляция отвечает позже выпуска: у неё свой лаг через ожидания и зарплаты.',
  govSpending: 'Госзакупки — прямой спрос: выпуск растёт сразу, с мультипликатором. Цены подтягиваются позже, через разогрев рынка труда. Ставка здесь не отвечает — в партии ЦБ мог бы погасить часть эффекта.',
  transfers: 'Выплаты доходят до спроса через потребление домохозяйств: мультипликатор ниже, чем у закупок, — часть денег сберегают.',
  govInvestment: 'Госинвестиции — спрос сейчас и потенциал потом: инфраструктура повышает производительность, поэтому инфляционный след слабее, чем у закупок.',
  incomeTaxRate: 'Подоходный налог забирает располагаемый доход: потребление и выпуск ниже. Выше ставка — больше теневой занятости (кривая Лаффера на краях).',
  vatRate: 'НДС сразу поднимает уровень цен (разовый скачок инфляции), а потом давит на потребление — инфляция уходит ниже базы вслед за спросом.',
  profitTaxRate: 'Налог на прибыль бьёт по инвестициям бизнеса: эффект на спрос медленнее, зато копится в капитале и потенциале.',
  socialContribRate: 'Взносы — налог на труд: дороже найм, выше издержки, часть занятости уходит в тень.',
  moneySupplyOp: 'Операция с денежной массой (QE/QT) действует через ликвидность и ожидания: разовый импульс, который быстро рассеивается, если ставка не меняется.',
  fxIntervention: 'Покупка валюты ослабляет национальную валюту: импорт дороже, экспорт выгоднее. Эффект на курс держится, пока резервы не тратятся обратно.',
  reserveReq: 'Норма резервирования связывает часть депозитов: банки дают меньше кредитов, спред растёт — похоже на повышение ставки, но грубее.',
  capitalRequirement: 'Норматив капитала заставляет банки копить капитал вместо выдачи кредитов: кредитный цикл остывает, финансовая устойчивость растёт.',
};

function DiffChart({ data, metric, color }) {
  const pk = peakOf(data, metric.key);
  return (
    <div className="ems-panel" style={{ padding: '10px 10px 6px', minWidth: 0 }}>
      <div className="row-between" style={{ alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: COLOR.text }}>{metric.label}</span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>
          {pk.q ? <>пик <b className="ems-mono" style={{ color }}>{fmtSigned1(pk.v)} {metric.unit}</b> на {pk.q}-м кв.</> : 'без эффекта'}
        </span>
      </div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="q" tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} />
            <YAxis tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} width={46} tickFormatter={(v) => (Math.abs(v) < 1 ? v.toFixed(2) : fmt1(v))} />
            <ReferenceLine y={0} stroke={COLOR.faint} />
            <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12 }}
              labelFormatter={(v) => `${v}-й квартал после решения`} formatter={(v) => [`${fmtSigned1(v)} ${metric.unit}`, 'разница с базой']} />
            <Line type="monotone" dataKey={metric.key} stroke={color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const METRIC_COLORS = { inflation: COLOR.rust, outputGap: COLOR.teal, unemployment: COLOR.blue, exchangeRate: COLOR.gold };

export function LabScreen({ onBack }) {
  const [scenario, setScenario] = useState('sandbox');
  const [leverId, setLeverId] = useState('keyRate');
  const lever = LAB_LEVERS.find((l) => l.id === leverId);
  const [delta, setDelta] = useState(DEFAULT_DELTA.keyRate);
  const [mode, setMode] = useState(defaultLabMode(lever));
  const [seed, setSeed] = useState(1);
  const pickLever = (id) => {
    const l = LAB_LEVERS.find((x) => x.id === id);
    setLeverId(id); setDelta(DEFAULT_DELTA[id] ?? l.step * 4); setMode(defaultLabMode(l));
  };
  const res = useMemo(() => {
    try { return impulseResponse({ scenario, leverId, delta, mode, seed }); } catch { return null; }
  }, [scenario, leverId, delta, mode, seed]);
  const sc = SCENARIOS.find((x) => x.id === scenario);
  const union = sc && sc.overrides && sc.overrides.currencyUnion && lever.group === 'monetary';
  const range = deltaRange(lever);
  const unit = lever.suffix.trim() === '%' ? (lever.type === 'level' ? ' п.п.' : ' п.п. темпа') : lever.suffix;

  return (
    <TrainerPage eyebrow="Тренажёр" title="Лаборатория" onBack={onBack} wide
      lede="Один рычаг — два мира. Модель прогоняется 12 кварталов из одной точки: в базовом мире ничего не меняется, в другом — только выбранный рычаг. Шоки и события выключены, случайное зерно одно и то же. Линии — разница между мирами: чистый эффект рычага, квартал за кварталом (импульсный отклик).">
      <div className="ems-panel" style={{ padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 6 }}>Рычаг</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LAB_LEVERS.map((l) => (
              <button key={l.id} type="button" className="ems-btn" aria-pressed={l.id === leverId}
                onClick={() => { Audio.play('click'); pickLever(l.id); }}
                style={{ padding: '5px 10px', fontSize: 12, background: l.id === leverId ? COLOR.sel : COLOR.panelAlt,
                  color: l.id === leverId ? COLOR.selText : COLOR.text, borderColor: l.id === leverId ? COLOR.selBorder : COLOR.border }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Изменение: <b className="ems-mono" style={{ color: COLOR.text }}>{delta > 0 ? '+' : ''}{fmt1(delta)}{unit}</b>
              {res && <span> (с {fmt1(res.baseValue)} до {fmt1(res.newValue)}{lever.suffix})</span>}</span>
            <input type="range" min={-range} max={range} step={lever.step} value={delta} aria-label="Изменение рычага"
              onChange={(e) => setDelta(Number(e.target.value))} />
          </label>
          <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Сколько держать</span>
            <Seg label="Сколько держать" value={mode} onChange={setMode}
              options={[{ id: 'hold', label: 'все 12 кварталов' }, { id: 'pulse', label: 'один квартал' }]} />
          </div>
          <label style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Стартовая экономика</span>
            <select className="ems-input" value={scenario} onChange={(e) => setScenario(e.target.value)}
              style={{ padding: '6px 8px', background: COLOR.panelAlt, color: COLOR.text, border: `1px solid ${COLOR.border}`, borderRadius: 6 }}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Случайное зерно (одно на оба мира)</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <input type="number" min={1} max={9999} value={seed} aria-label="Случайное зерно"
                onChange={(e) => setSeed(Math.max(1, Math.min(9999, Math.round(Number(e.target.value) || 1))))}
                style={{ width: 90, padding: '6px 8px', background: COLOR.panelAlt, color: COLOR.text, border: `1px solid ${COLOR.border}`, borderRadius: 6 }} />
              <button type="button" className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => { Audio.play('click'); setSeed(1 + Math.floor(Math.random() * 9999)); }}>другое</button>
            </span>
          </label>
        </div>
      </div>

      {union && (
        <div className="ems-panel" style={{ padding: 12, marginBottom: 12, fontSize: 12, color: COLOR.goldSoft, lineHeight: 1.5 }}>
          В этой экономике валютный союз: ставку, эмиссию и курс ведёт внешний ЦБ, и рычаг ничего не меняет — линии лежат на нуле.
          Это и есть урок еврозоны: у страны нет своей денежной политики.
        </div>
      )}

      {res ? (
        <div data-testid="lab-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 10 }}>
          {LAB_METRICS.map((m) => <DiffChart key={m.key} data={res.diff} metric={m} color={METRIC_COLORS[m.key]} />)}
        </div>
      ) : <div className="ems-panel" style={{ padding: 14, fontSize: 13, color: COLOR.muted }}>Расчёт не удался.</div>}

      <div className="ems-panel" style={{ padding: 14, marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6 }}>Как читать</div>
        <div style={{ color: COLOR.text, marginBottom: 8 }}>{LAB_NOTES[leverId]}</div>
        <div style={{ color: COLOR.muted, fontSize: 12 }}>
          По оси — кварталы после решения, по вертикали — насколько мир с изменённым рычагом отличается от базового
          (инфляция, разрыв и безработица — в процентных пунктах, курс — в процентах; выше — валюта слабее).
          Остальные рычаги в обоих мирах не двигаются: ЦБ не отвечает на бюджет, Минфин — на ставку. В партии так не бывает —
          поэтому это эксперимент «при прочих равных», а не прогноз. Смените зерно: форма отклика почти не меняется —
          значит, она задана устройством модели, а не случаем.
        </div>
      </div>
    </TrainerPage>
  );
}
