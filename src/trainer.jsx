/* ТРЕНАЖЁР: экраны вне партии, которые учат читать модель, а не выигрывать.
   • Лаборатория — импульсный отклик одного рычага (src/lib/lab.js);
   • Модель и учебник — «игра ↔ учебник» и чем модель не похожа на настоящую;
   • Задачи на 10 минут — список задач (сама партия идёт в обычном экране игры).
   Отдельный ленивый чанк: в меню и в партии этот код не нужен. */
import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlaskConical, BookOpenText, Target } from 'lucide-react';
import { COLOR, Audio, GlobalStyle } from './MacroSimulator.jsx';
import { SCENARIOS, fmt1, fmtSigned1 } from './lib/engine.js';
import { impulseResponse, impulseBand, peakOf, zeroTicks, LAB_LEVERS, LAB_METRICS, LEVEL_KEY, quarterLevelShift, defaultLabMode, defaultLabCb, TAYLOR_SMOOTH, SHOCK_DECAY } from './lib/lab.js';
import { DRILLS, drillSetup, loadDrillRecords } from './lib/drills.js';

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
          style={{ flex: '1 1 0', whiteSpace: 'normal', lineHeight: 1.25 }}>{o.label}</button>
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
  govSpending: 'Госзакупки — прямой спрос: выпуск растёт сразу, с мультипликатором. Цены подтягиваются позже, через разогрев рынка труда. Если ЦБ отвечает по правилу Тейлора, он поднимает ставку и гасит часть эффекта; если ставка стоит — эффект держится.',
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

// мелкие отклики (сотые доли пункта) не должны превращаться в «+0.0»
const signedSmall = (v) => (Math.abs(v) < 0.095 && v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(2)}` : fmtSigned1(v));

function DiffChart({ data, metric, color }) {
  const pk = peakOf(data, metric.key);
  const bandKey = `${metric.key}Band`;
  const hasBand = data.length && Array.isArray(data[0][bandKey]);
  const axis = zeroTicks(data.flatMap((r) => [r[metric.key], ...(hasBand ? r[bandKey] : [])]).filter(Number.isFinite));
  return (
    <div className="ems-panel" style={{ padding: '10px 10px 6px', minWidth: 0 }}>
      <div className="row-between" style={{ alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: COLOR.text }}>{metric.label}</span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>
          {pk.q ? <>пик <b className="ems-mono" style={{ color }}>{signedSmall(pk.v)} {metric.unit}</b> на {pk.q}-м кв.</> : 'без эффекта'}
        </span>
      </div>
      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="q" tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} />
            {/* ноль на шкале всегда: отклик читается как отклонение от базы, а не как плавающий масштаб */}
            <YAxis tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} width={46} tickFormatter={(v) => v.toFixed(axis.digits)}
              domain={axis.domain} ticks={axis.ticks} interval={0} />
            <ReferenceLine y={0} stroke={COLOR.faint} />
            <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12 }}
              labelFormatter={(v) => `${v}-й квартал после решения`}
              formatter={(v) => (Array.isArray(v) ? [`${signedSmall(v[0])} … ${signedSmall(v[1])} ${metric.unit}`, '10–90% прогонов']
                : [`${signedSmall(v)} ${metric.unit}`, hasBand ? 'медиана разницы с базой' : 'разница с базой'])} />
            {hasBand && <Area type="monotone" dataKey={bandKey} stroke="none" fill={color} fillOpacity={0.18} isAnimationActive={false} />}
            <Line type="monotone" dataKey={metric.key} stroke={color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const METRIC_COLORS = { inflation: COLOR.rust, outputGap: COLOR.teal, unemployment: COLOR.blue, exchangeRate: COLOR.gold, keyRate: COLOR.goldSoft };
const RATE_METRIC = { key: 'keyRate', label: 'Ключевая ставка', unit: 'п.п.' };
const NOISE_RUNS = 12;

export function LabScreen({ onBack, initialLever = 'keyRate' }) {
  const [scenario, setScenario] = useState('sandbox');
  const [leverId, setLeverId] = useState(LAB_LEVERS.some((l) => l.id === initialLever) ? initialLever : 'keyRate');
  const lever = LAB_LEVERS.find((l) => l.id === leverId);
  const [delta, setDelta] = useState(DEFAULT_DELTA[leverId] ?? lever.step * 4);
  const [mode, setMode] = useState(defaultLabMode(lever));
  const [cb, setCb] = useState(defaultLabCb(lever));
  const [horizon, setHorizon] = useState(24);
  const [noise, setNoise] = useState('off');
  const pickLever = (id) => {
    const l = LAB_LEVERS.find((x) => x.id === id);
    setLeverId(id); setDelta(DEFAULT_DELTA[id] ?? l.step * 4); setMode(defaultLabMode(l)); setCb(defaultLabCb(l));
  };
  const res = useMemo(() => {
    try {
      const opts = { scenario, leverId, delta, mode, cb, horizon };
      return noise === 'on' ? impulseBand(opts, NOISE_RUNS) : impulseResponse(opts);
    } catch { return null; }
  }, [scenario, leverId, delta, mode, cb, noise, horizon]);
  // темп роста расходов: сколько это в уровне — через квартал и к концу горизонта
  const levelKey = LEVEL_KEY[leverId];
  const levelNow = res && levelKey ? res.diff[0][levelKey] : null;
  const levelEnd = res && levelKey ? res.diff[res.diff.length - 1][levelKey] : null;
  const isRate = leverId === 'keyRate';
  const ruleOn = res ? res.cb === 'taylor' : false;
  const metrics = ruleOn || isRate ? [...LAB_METRICS, RATE_METRIC] : LAB_METRICS;
  const sc = SCENARIOS.find((x) => x.id === scenario);
  const union = sc && sc.overrides && sc.overrides.currencyUnion && lever.group === 'monetary';
  const range = deltaRange(lever);
  const unit = lever.suffix.trim() === '%' ? (lever.type === 'level' ? ' п.п.' : lever.persistent ? ' п.п. годового темпа' : ' п.п.') : lever.suffix;
  // подписи режимов — по смыслу рычага: для темпов роста расходов «держать» значит «расти быстрее каждый год»
  const modeOptions = lever.persistent
    ? [{ id: 'pulse', label: 'расходы разово выше навсегда' }, { id: 'hold', label: 'расходы растут быстрее каждый год' }]
    : lever.type === 'level'
      ? [{ id: 'hold', label: 'весь срок' }, { id: 'pulse', label: 'один квартал' }]
      : [{ id: 'pulse', label: 'один квартал' }, { id: 'hold', label: 'каждый квартал' }];

  return (
    <TrainerPage eyebrow="Тренажёр" title="Лаборатория" onBack={onBack} wide
      lede="Один рычаг — два мира. Модель прогоняется из одной точки дважды: в базовом мире рычаг не трогают, в другом — меняют. События выключены, шумы — по выбору (одинаковые в обоих мирах), ЦБ в обоих мирах ведёт себя одинаково. Линии — разница между мирами: чистый эффект рычага, квартал за кварталом (импульсный отклик).">
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
              {res && !lever.persistent && <span> (с {fmt1(res.baseValue)} до {fmt1(res.newValue)}{lever.suffix})</span>}
              {lever.persistent && <span> — за квартал это {fmtSigned1(quarterLevelShift(delta))}% уровня расходов</span>}</span>
            <input type="range" min={-range} max={range} step={lever.step} value={delta} aria-label="Изменение рычага"
              onChange={(e) => setDelta(Number(e.target.value))} />
          </label>
          {isRate ? (
            <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
              <span>Что ЦБ делает после шока</span>
              <Seg label="Что ЦБ делает после шока" value={mode} onChange={setMode}
                options={[{ id: 'taylor', label: 'правило Тейлора, шок затухает' }, { id: 'hold', label: 'держит ставку выше' }, { id: 'pulse', label: 'один квартал, потом как было' }]} />
            </div>
          ) : (<>
            <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>{lever.persistent ? 'Как меняются расходы' : 'Сколько держать'}</span>
              <Seg label={lever.persistent ? 'Как меняются расходы' : 'Сколько держать'} value={mode} onChange={setMode} options={modeOptions} />
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Центральный банк</span>
              <Seg label="Центральный банк" value={cb} onChange={setCb}
                options={[{ id: 'taylor', label: 'отвечает по Тейлору' }, { id: 'fixed', label: 'ставка стоит' }]} />
            </div>
          </>)}
          <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Горизонт</span>
            <Seg label="Горизонт" value={String(horizon)} onChange={(v) => setHorizon(Number(v))}
              options={[{ id: '12', label: '12 кв.' }, { id: '24', label: '24 кв.' }, { id: '40', label: '40 кв.' }]} />
          </div>
          <label style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Стартовая экономика</span>
            <select className="ems-input" value={scenario} onChange={(e) => setScenario(e.target.value)}
              style={{ padding: '6px 8px', background: COLOR.panelAlt, color: COLOR.text, border: `1px solid ${COLOR.border}`, borderRadius: 6 }}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Фон</span>
            <Seg label="Фон" value={noise} onChange={setNoise}
              options={[{ id: 'off', label: 'без шумов' }, { id: 'on', label: `на фоне шумов (${NOISE_RUNS} прогонов)` }]} />
          </div>
        </div>
      </div>

      {union && (
        <div className="ems-panel" style={{ padding: 12, marginBottom: 12, fontSize: 12, color: COLOR.goldSoft, lineHeight: 1.5 }}>
          В этой экономике валютный союз: ставку, эмиссию и курс ведёт внешний ЦБ, и рычаг ничего не меняет — линии лежат на нуле.
          Это и есть урок еврозоны: у страны нет своей денежной политики.
        </div>
      )}

      {levelKey && res && (
        <div className="ems-panel" data-testid="lab-level" style={{ padding: '10px 12px', marginBottom: 12, fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
          Уровень расходов против базы: через квартал <b className="ems-mono" style={{ color: COLOR.text }}>{fmtSigned1(levelNow)}%</b>,
          к {res.diff.length}-му кварталу <b className="ems-mono" style={{ color: COLOR.text }}>{fmtSigned1(levelEnd)}%</b>.{' '}
          {mode === 'pulse'
            ? 'Темп вырос на один квартал — уровень сдвинулся разово и остаётся выше базы. Это учебный бюджетный шок: отклик выпуска затухает.'
            : 'Темп выше каждый квартал — уровень уходит от базы всё дальше, стимул не кончается, и разрыв выпуска растёт весь горизонт.'}
        </div>
      )}

      {res ? (
        <div data-testid="lab-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 10 }}>
          {metrics.map((m) => <DiffChart key={m.key} data={res.diff} metric={m} color={METRIC_COLORS[m.key]} />)}
        </div>
      ) : <div className="ems-panel" style={{ padding: 14, fontSize: 13, color: COLOR.muted }}>Расчёт не удался.</div>}

      <div className="ems-panel" style={{ padding: 14, marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
        <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 6 }}>Как читать</div>
        <div style={{ color: COLOR.text, marginBottom: 8 }}>{LAB_NOTES[leverId]}</div>
        <div style={{ color: COLOR.text, marginBottom: 8 }} data-testid="lab-cb-note">
          {ruleOn ? (isRate
            ? `ЦБ в обоих мирах ставит ставку по правилу Тейлора со сглаживанием (${Math.round(TAYLOR_SMOOTH * 100)}% веса — прошлой ставке). Шок — добавка к правилу, которая затухает на ${Math.round((1 - SHOCK_DECAY) * 100)}% за квартал. Когда шок уходит, правило видит отрицательный разрыв и низкую инфляцию и опускает ставку ниже базы — поэтому отклик горбатый и возвращается к нулю, как на лекции.`
            : 'ЦБ в обоих мирах отвечает правилом Тейлора: бюджетный стимул разгоняет спрос и цены — ЦБ поднимает ставку и гасит часть эффекта (вытеснение). Переключите на «ставка стоит» и сравните: мультипликатор без ответа ЦБ заметно больше и эффект не затухает.')
            : 'Ставка в обоих мирах стоит на месте. Без реакции ЦБ модель к потенциалу сама почти не возвращается: спрос задан темпами роста, а якорь уровня слабый — доли потребления и инвестиций тянутся к своей норме медленно, за десятки кварталов; потерянные инвестиции ещё и уменьшают капитал, то есть потенциал. Цены экономику тоже не возвращают: зарплаты вниз жёсткие, ожидания смотрят назад, а при неподвижной номинальной ставке падающая инфляция даже поднимает реальную. Поэтому разовый шок оставляет почти постоянный след, а удержанный — копится. В жизни разрыв закрывает прежде всего ЦБ, реагирующий на инфляцию сильнее чем один к одному (принцип Тейлора).'}
        </div>
        <div style={{ color: COLOR.muted, fontSize: 12 }}>
          По оси — кварталы после решения, по вертикали — насколько мир с изменённым рычагом отличается от базового
          (инфляция, разрыв, безработица и ставка — в процентных пунктах, курс — в процентах; выше — валюта слабее).
          Минфин в обоих мирах не отвечает ни на что — это эксперимент «при прочих равных», а не прогноз.
          Форма отклика зависит от того, как ведёт себя ЦБ: сравните режимы, прежде чем делать выводы.
          {noise === 'on'
            ? ` Сейчас оба мира живут с обычным квартальным шумом — одним и тем же в каждой паре, — пара прогоняется ${NOISE_RUNS} раз с разными зёрнами; линия — медиана, заливка — 10–90% прогонов. Полоса узкая: в модели эффект рычага почти просто складывается с шоками, и отклик от фона мало зависит.`
            : ' Шумы выключены, поэтому отклик детерминирован — повторный расчёт даёт тот же результат до знака. Включите «на фоне шумов», чтобы увидеть, насколько он зависит от фона.'}
        </div>
      </div>
    </TrainerPage>
  );
}

/* ---------------- ИГРА ↔ УЧЕБНИК ----------------
   Каждая идея из учебника — формулой, как она устроена в движке (с настоящими
   коэффициентами из catalog.js), и где её видно в игре. */
const TEXTBOOK = [
  { id: 'fisher', title: 'Уравнение Фишера', formula: 'реальная ставка ≈ номинальная − ожидаемая инфляция',
    model: 'Движок считает реальную ключевую (ключевая − ожидания) и реальную ставку по кредитам (кредитная − ожидания). Спрос, инвестиции, капитал и фирмы реагируют на реальную ставку против нейтральной r*, а не на номинал.',
    where: 'Панель ЦБ → «Компас ставки»; график «Ставки» → «Реальная ключевая»; показатели → «Реальная ставка по кредитам», «Жёсткость условий».',
    lab: 'keyRate', try: 'Поднимите ставку на 1 п.п. при высокой инфляции: номинал вырос, а реальная ставка может остаться отрицательной.' },
  { id: 'okun', title: 'Закон Оукена', formula: 'u − u* ≈ −β · (разрыв выпуска),  β = 0,45',
    model: 'Безработица тянется к естественному уровню минус 0,45 × разрыв выпуска, догоняя его примерно на треть за квартал. Долгая безработица поднимает сам естественный уровень (гистерезис).',
    where: 'График «Труд» (безработица и естественный уровень), «Почему это произошло?» после квартала — строка про закон Оукена.',
    lab: 'govSpending', try: 'В Лаборатории сравните графики разрыва выпуска и безработицы: второй — зеркало первого с запозданием.' },
  { id: 'phillips', title: 'Кривая Филлипса (с ожиданиями)', formula: 'π = ожидания + 0,15·разрыв + 0,022·разрыв·|разрыв| + издержки',
    model: 'Инфляция — это ожидания плюс давление спроса: линейная часть и выпуклая, так что перегрев разгоняет цены сильнее, чем спад их тормозит. Вниз цены идут вдвое хуже (асимметрия 0,55). Сверху — издержки: курс, зарплаты, мировые цены, НДС.',
    where: 'График «Цены» (инфляция, базовая, ожидания); «Почему это произошло?» — разложение инфляции на слагаемые.',
    lab: 'keyRate', try: 'Держите ставку выше на 1 п.п. 12 кварталов: инфляция реагирует позже выпуска — сначала должен открыться отрицательный разрыв.' },
  { id: 'solow', title: 'Модель Солоу (потенциал)', formula: 'Y* = A · K^0,32 · (L·H)^0,68 · инфраструктура',
    model: 'Потенциальный выпуск — функция Кобба — Дугласа: капитал (копится инвестициями, выбывает 5% в год), труд с поправкой на человеческий капитал, производительность A (наука) и инфраструктура. Кризисы оставляют «шрамы» — потерю потенциала.',
    where: 'График «Выпуск» (ВВП и потенциальный ВВП), вкладка показателей «Потенциал»; расходы на образование, науку и госинвестиции.',
    lab: 'govInvestment', try: 'Госинвестиции и госзакупки в Лаборатории, режим «один квартал»: у закупок разрыв выпуска стоит на месте, у инвестиций медленно сужается — потенциал подрастает вслед за спросом.' },
  { id: 'multiplier', title: 'Бюджетный мультипликатор', formula: 'ΔY ≈ m · ΔG,  m растёт с простоем экономики',
    model: 'Мультипликатор закупок — от 0,55 у потенциала до 1,15 в глубоком спаде; у выплат — 0,30…0,80 (часть сберегают); у госинвестиций — 0,60…1,15. Чем глубже спад, тем больше денег доходит до выпуска, а не до цен.',
    where: '«Почему это произошло?» — строка «Бюджетный импульс … мультипликатор расходов»; подсказки у ползунков Минфина.',
    lab: 'govSpending', try: 'Сравните в Лаборатории госзакупки и выплаты при одинаковом шаге: у выплат отклик выпуска слабее.' },
  { id: 'trilemma', title: 'Невозможная троица', formula: 'свободный капитал + фиксированный курс + своя ставка — выбрать два',
    model: 'Капитал в модели свободен: он идёт за разницей реальных ставок. Хотите держать курс — ЦБ тратит резервы, и когда они кончаются, режим срывается девальвацией. Хотите свою ставку — курс плавает. В валютном союзе (Греция) страна отдала ставку внешнему ЦБ.',
    where: 'Панель ЦБ → «Режим валютного курса», резервы и интервенции во вкладке «Курс»; сценарий «Вы против Афин».',
    lab: 'fxIntervention', try: 'Сценарий «Вы против Афин» в Лаборатории: денежные рычаги не двигают ничего — курса и ставки у страны нет.' },
  { id: 'laffer', title: 'Кривая Лаффера', formula: 'сбор = ставка × база × собираемость(ставка)',
    model: 'Выше ставки над привычным уровнем собираемость падает нелинейно (степень 1,35), а доля теневой экономики растёт. Поэтому после некоторого уровня повышение налога даёт меньше денег, чем обещает арифметика.',
    where: 'Показатели → «Теневая экономика», доходы бюджета; ползунки налогов у Минфина.',
    lab: 'incomeTaxRate', try: 'Поднимите подоходный налог сильно и посмотрите на сальдо бюджета в отчёте после квартала.' },
  { id: 'lorenz', title: 'Кривая Лоренца и Джини', formula: 'G = 1 − Σ 0,2·(L(k−1) + L(k)) по пяти квинтилям',
    model: 'Доходы разложены на пять групп по 20% с разными источниками (зарплаты, трансферты, капитал) и разной корзиной. Джини — по располагаемым доходам после налогов. Бедность — двумя мерами рядом: относительная (ниже 60% сегодняшней медианы, как в ЕС) и абсолютная (ниже порога, зафиксированного на старте в ценах старта).',
    where: 'Вкладка «Общество» → «Доходы по слоям»; график «Неравенство».',
    lab: 'transfers', try: 'Сыграйте «Гиперинфляцию» и сравните две бедности на экране «Общество»: за три года относительная сдвигается на 2–3 пункта, абсолютная — больше чем на десяток: беднеют почти все, и отставание низа от медианы меняется мало.' },
];

/* ---------------- ЧЕМ МОДЕЛЬ НЕ ПОХОЖА НА НАСТОЯЩУЮ ---------------- */
const LIMITS = [
  { title: 'Коэффициенты подобраны руками', text: 'Числа вроде 0,45 в законе Оукена или 0,15 в кривой Филлипса не оценены по данным какой-то страны, а подобраны так, чтобы поведение было правдоподобным и игра — играбельной. Знаки и порядок величин похожи на эмпирику, точные значения — нет.' },
  { title: 'Адаптивные ожидания', text: 'Люди в модели смотрят назад: ожидания подтягиваются к прошлой инфляции и к цели ЦБ с весом доверия. В современных моделях ожидания рациональные — агенты знают модель и заглядывают вперёд, поэтому объявленная политика действует сразу. Обещание ЦБ о пути ставки здесь — упрощённая заплатка.' },
  { title: 'Нет микрооснований', text: 'Нет домохозяйств, которые выбирают между потреблением и сбережением, и фирм, которые максимизируют прибыль. Есть агрегированные уравнения «спрос реагирует на ставку так-то». Поэтому модель не отвечает на вопросы о благосостоянии и уязвима к критике Лукаса: при смене политики коэффициенты должны меняться, а здесь они постоянны.' },
  { title: 'Квартал — один шаг', text: 'Всё происходит квартальными шагами, без дней и недель: паника на рынке, набег на банк или валютная атака укладываются в одно обновление. Лаги заданы вручную, а не возникают из поведения.' },
  { title: 'Одна страна, мир — фон', text: 'Мировая экономика, ставки и цены на сырьё — внешние ряды с шумом. Ваша политика не влияет на соседей и не вызывает ответных мер, кроме сценарных событий.' },
  { title: 'Упрощённые финансы', text: 'Одна ставка по кредитам, один банковский сектор, один индекс акций. Нет кривой доходности, построенной из ожиданий, нет разных заёмщиков и цепочек дефолтов между банками.' },
  { title: 'Распределение — надстройка', text: 'Пять квинтилей раскладывают уже посчитанный квартал: неравенство не влияет обратно на спрос (у богатых склонность к потреблению ниже — здесь этого нет в ВВП). Бедность считается по кривой квантилей из пяти точек, а не по реальному распределению.' },
  { title: 'Политика и события — сценарий, а не модель', text: 'Выборы, президент, войны и события — игровые механизмы с вероятностями, заданными вручную. Они нужны, чтобы экономика жила, но не претендуют на политологию.' },
  { title: 'Без ЦБ экономика сама к потенциалу не возвращается', text: 'Спрос в модели задан темпами роста, а якорь уровня слабый: доли потребления и инвестиций тянутся к своей норме за десятки кварталов, а потерянные инвестиции ещё и уменьшают капитал — то есть сам потенциал. Цены тоже не выручают: зарплаты вниз жёсткие, ожидания адаптивные, и при неподвижной номинальной ставке падающая инфляция поднимает реальную ставку. В учебных моделях возврат к равновесию обеспечивает прежде всего ЦБ, реагирующий на инфляцию сильнее чем один к одному (принцип Тейлора), и вдобавок гибкие цены и эффекты богатства. Поэтому в Лаборатории отклик горбатый и затухает, только когда ЦБ отвечает по правилу; если ставку заморозить, разовый шок оставляет почти постоянный след. Это свойство модели, а не экономики.' },
  { title: 'Что с этим делать', text: 'Использовать модель для интуиции: знаки, лаги, компромиссы (инфляция против безработицы, курс против ставки, дефицит против долга). Не использовать для прогнозов и точных чисел. Форма отклика в Лаборатории зависит от того, как отвечает ЦБ: знаки и порядок лагов устойчивы, а величина и то, затухает ли эффект, — условны.' },
];

// тема задачи → заголовок раздела учебника
const TOPIC_TITLE = () => Object.fromEntries(TEXTBOOK.map((t) => [t.id, t.title]));

function TextbookTab({ onOpenLab, onStartDrill }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="textbook">
      {TEXTBOOK.map((t) => (
        <div key={t.id} className="ems-panel" style={{ padding: 14 }}>
          <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>{t.title}</span>
            <span className="ems-mono" style={{ fontSize: 12, color: COLOR.text, overflowWrap: 'anywhere' }}>{t.formula}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginTop: 8, fontSize: 13, lineHeight: 1.55 }}>
            <div><div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 2 }}>Как устроено в модели</div>{t.model}</div>
            <div><div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 2 }}>Где увидеть в игре</div>{t.where}
              <div style={{ color: COLOR.muted, marginTop: 6, fontSize: 12 }}>Попробуйте: {t.try}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {onOpenLab && t.lab && (
                  <button type="button" className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => { Audio.play('click'); onOpenLab(t.lab); }}>Открыть в Лаборатории</button>
                )}
                {onStartDrill && DRILLS.filter((d) => d.topic === t.id).map((d) => (
                  <button key={d.id} type="button" className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={() => { Audio.prime(); Audio.play('stamp'); onStartDrill(drillSetup(d)); }}>Задача: {d.title}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LimitsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="limits">
      {LIMITS.map((l) => (
        <div key={l.title} className="ems-panel" style={{ padding: 14 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 4 }}>{l.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>{l.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ModelScreen({ onBack, onOpenLab, onStartDrill, initialTab = 'textbook' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <TrainerPage eyebrow="Тренажёр" title="Модель и учебник" icon={BookOpenText} onBack={onBack}
      lede="Какие идеи из учебника работают внутри игры, где их увидеть на экране — и где модель честно расходится с настоящей экономикой.">
      <div style={{ marginBottom: 14 }}>
        <Seg label="Раздел" value={tab} onChange={setTab}
          options={[{ id: 'textbook', label: 'Игра ↔ учебник' }, { id: 'limits', label: 'Чем модель не похожа на настоящую' }]} />
      </div>
      {tab === 'textbook' ? <TextbookTab onOpenLab={onOpenLab} onStartDrill={onStartDrill} /> : <LimitsTab />}
    </TrainerPage>
  );
}

/* ---------------- ЗАДАЧИ НА 10 МИНУТ ---------------- */
const ROLE_NAME = { central_bank: 'Центральный банк', ministry_finance: 'Минфин' };
export function DrillsScreen({ onBack, onStart }) {
  const records = useMemo(loadDrillRecords, []);
  const topics = TOPIC_TITLE();
  return (
    <TrainerPage eyebrow="Тренажёр" title="Задачи на 10 минут" icon={Target} onBack={onBack}
      lede="Десять задач — по темам страницы «Модель и учебник». Одна цель, несколько кварталов, никаких случайных событий. Соседнее ведомство ведёт бот, у каждой задачи своё зерно — попытки можно сравнивать. Перед каждым ходом можно записать слепой прогноз инфляции: он проверится через четыре квартала. В конце — разбор.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="drills">
        {DRILLS.map((d) => {
          const rec = records[d.id];
          return (
            <div key={d.id} className="ems-panel" style={{ padding: 14 }}>
              <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>{d.title}</span>
                <span style={{ fontSize: 12, color: COLOR.muted }}>{topics[d.topic] ? `${topics[d.topic]} · ` : ''}{ROLE_NAME[d.role]} · {d.quarters} кварталов
                  {rec ? <> · {rec.passed ? <b style={{ color: COLOR.teal }}>выполнено</b> : 'не выполнено'}, попыток {rec.tries}</> : null}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, margin: '6px 0' }}>{d.brief}</div>
              <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: COLOR.muted }}>
                {d.goals.map((g) => <li key={g.key + g.when}>{g.label}</li>)}
              </ul>
              <button type="button" className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 13 }}
                onClick={() => { Audio.prime(); Audio.play('stamp'); onStart(drillSetup(d)); }}>
                {rec ? 'Ещё раз' : 'Начать'}
              </button>
            </div>
          );
        })}
      </div>
    </TrainerPage>
  );
}
