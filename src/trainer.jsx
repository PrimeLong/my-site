/* ТРЕНАЖЁР: экраны вне партии, которые учат читать модель, а не выигрывать.
   • Лаборатория — импульсный отклик одного рычага (src/lib/lab.js);
   • Задачи на 10 минут — список задач (сама партия идёт в обычном экране игры).
   Отдельный ленивый чанк: в меню и в партии этот код не нужен. */
import React, { useMemo, useState } from 'react';
import { ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlaskConical, Target } from 'lucide-react';
import { COLOR, Audio, GlobalStyle } from './MacroSimulator.jsx';
import { SCENARIOS, fmt1, fmtSigned1 } from './lib/engine.js';
import { impulseResponse, impulseBand, peakOf, zeroTicks, LAB_LEVERS, LAB_METRICS, LEVEL_KEY, quarterLevelShift, defaultLabMode, defaultLabCb, TAYLOR_SMOOTH, SHOCK_DECAY } from './lib/lab.js';
import { DRILLS, drillSetup, loadDrillRecords } from './lib/drills.js';
import { GAME_CARDS } from './textbook/appendix.js';
import { GAMES, SCALES, expectedValue, convergence, scaleRow } from './lib/casino-odds.js';

/* Общая рамка страницы тренажёра: кнопка назад, заголовок, вводный абзац. */
export function TrainerPage({ eyebrow, title, lede, onBack, children, icon: Icon = FlaskConical, wide = false, backLabel = '← Назад в меню' }) {
  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: wide ? 960 : 760, width: '100%', minWidth: 0 }}>
        <button type="button" className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }} data-nav="back"
          onClick={() => { Audio.play('click'); onBack(); }}>{backLabel}</button>
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

/* initial — откуда пришли: из учебника можно открыть рычаг сразу с нужным сценарием,
   режимом и ответом ЦБ ({ lever, scenario, mode, cb }); из меню — только рычаг. */
export function LabScreen({ onBack, initialLever = 'keyRate', initial = null }) {
  const init = initial || {};
  const [scenario, setScenario] = useState(SCENARIOS.some((x) => x.id === init.scenario) ? init.scenario : 'sandbox');
  const startLever = init.lever || initialLever;
  const [leverId, setLeverId] = useState(LAB_LEVERS.some((l) => l.id === startLever) ? startLever : 'keyRate');
  const lever = LAB_LEVERS.find((l) => l.id === leverId);
  const [delta, setDelta] = useState(DEFAULT_DELTA[leverId] ?? lever.step * 4);
  const [mode, setMode] = useState(init.mode || defaultLabMode(lever));
  const [cb, setCb] = useState(init.cb || defaultLabCb(lever));
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
      <CasinoOdds />
    </TrainerPage>
  );
}

/* ---------------- ПОЧЕМУ КАЗИНО ВСЕГДА В ПЛЮСЕ ----------------
   Не игра: ставок и наград нет. Пять гостей делают по 10, 100 или 1000 ставок по 1 кроне —
   график показывает, как их средний результат на ставку прижимается к матожиданию. Таблица —
   точный расчёт: сколько в среднем оставляют казино и какая доля гостей ещё в плюсе. */
const GUEST_COLORS = () => [COLOR.teal, COLOR.blue, COLOR.gold, COLOR.rust, COLOR.goldSoft];
const pct = (v, d = 1) => `${v.toFixed(d).replace('.', ',')}%`;
export function CasinoOdds() {
  const [gameId, setGameId] = useState('roulette');
  const [n, setN] = useState(1000);
  const [seed, setSeed] = useState(1);
  const g = GAMES[gameId];
  const ev = expectedValue(g) * 100;
  const data = useMemo(() => convergence(g, n, 5, seed), [g, n, seed]);
  const rows = useMemo(() => SCALES.map((k) => scaleRow(g, k)), [g]);
  const colors = GUEST_COLORS();
  return (
    <div className="ems-panel" data-testid="lab-casino" style={{ padding: 14, marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
      <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 6 }}>Почему казино всегда в плюсе</div>
      <div style={{ color: COLOR.text, marginBottom: 10 }}>
        У каждой ставки в казино средний результат чуть ниже нуля — это <b>матожидание</b>. На рулетке есть зелёный ноль:
        на красное выпадает 18 ячеек из 37, а платят как за половину. Одному гостю может повезти на десяти ставках.
        Но чем больше ставок, тем точнее средний итог совпадает с матожиданием — это <b>закон больших чисел</b>.
        У казино ставок миллионы, поэтому его доход почти не зависит от удачи.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Игра</span>
          <Seg label="Игра" value={gameId} onChange={setGameId} options={[{ id: 'roulette', label: 'рулетка, на красное' }, { id: 'binary', label: 'бинарный опцион' }]} />
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Сколько ставок у каждого гостя</span>
          <Seg label="Сколько ставок" value={String(n)} onChange={(v) => setN(Number(v))} options={SCALES.map((k) => ({ id: String(k), label: String(k) }))} />
        </div>
      </div>
      <div className="row-between" style={{ alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: COLOR.muted }}>Средний результат на ставку у пяти гостей, % от ставки</span>
        <button type="button" className="ems-btn" style={{ padding: '4px 10px', fontSize: 12 }} data-testid="lab-casino-reroll"
          onClick={() => { Audio.play('click'); setSeed((x) => x + 1); }}>Другие пять гостей</button>
      </div>
      <div style={{ height: 190 }} data-testid="lab-casino-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="k" tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} />
            <YAxis tick={{ fill: COLOR.faint, fontSize: 12 }} stroke={COLOR.border} width={46} domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} />
            <ReferenceLine y={0} stroke={COLOR.faint} />
            <ReferenceLine y={ev} stroke={COLOR.rust} strokeDasharray="5 4" label={{ value: `матожидание ${pct(ev)}`, fill: COLOR.rust, fontSize: 12, position: 'insideBottomRight' }} />
            <Tooltip contentStyle={{ background: COLOR.panelRaised, border: `1px solid ${COLOR.border}`, fontSize: 12 }}
              labelFormatter={(v) => `после ${v}-й ставки`} formatter={(v, name) => [pct(v), `гость ${Number(name.slice(1)) + 1}`]} />
            {colors.map((c, i) => <Line key={i} type="monotone" dataKey={`g${i}`} stroke={c} strokeWidth={1.6} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table data-testid="lab-casino-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
        <thead>
          <tr style={{ color: COLOR.muted, textAlign: 'left' }}>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>Ставок по 1 кроне</th>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>Казино оставляет себе в среднем</th>
            <th style={{ padding: '4px 6px', fontWeight: 500 }}>Гостей в плюсе</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} style={{ borderTop: `1px solid ${COLOR.hairline}`, color: COLOR.text }}>
              <td className="ems-mono" style={{ padding: '4px 6px' }}>{r.n}</td>
              <td className="ems-mono" style={{ padding: '4px 6px' }}>{r.house.toFixed(r.n < 100 ? 2 : 1).replace('.', ',')} кр.</td>
              <td className="ems-mono" style={{ padding: '4px 6px' }}>{pct(r.ahead * 100, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ color: COLOR.muted, fontSize: 12, marginTop: 6 }}>
        Доля гостей в плюсе посчитана точно, по формуле Бернулли. На 10 ставках «остался при своих» в плюс не засчитан, поэтому
        цифры для 10 и 100 ставок близки. На 1000 ставках видно главное: везение гостей усредняется, а преимущество казино остаётся.
      </div>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, margin: '14px 0 6px' }}>Бинарные опционы — та же рулетка</div>
      <div style={{ color: COLOR.text }} data-testid="lab-casino-binary">
        Бинарный опцион обещает: угадайте, будет ли цена через минуту выше или ниже, и заработайте 85%. Звучит как торговля на бирже,
        но устроено как казино:
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          <li>за минуту цена ходит почти случайно — угадать можно примерно в половине случаев, как с монеткой;</li>
          <li>за верный ответ платят 85% ставки, за неверный забирают 100%. Средний итог ставки: 0,5 · 85% − 0,5 · 100% = −7,5%.
            Это почти втрое хуже рулетки;</li>
          <li>чем чаще и быстрее ставки, тем быстрее работает закон больших чисел — против игрока;</li>
          <li>другой стороной сделки обычно выступает сама площадка: ваш проигрыш — её доход, ей выгодно, чтобы вы играли больше.</li>
        </ul>
        <div style={{ marginTop: 6 }}>
          Инвестиции работают иначе: акция — доля в бизнесе, облигация — долг с процентом. У них средний результат за годы выше нуля,
          потому что деньги работают в экономике. У ставки на минуту средний результат ниже нуля, сколько бы раз её ни повторять.
        </div>
      </div>
    </div>
  );
}

// тема задачи → заголовок раздела «игра ↔ учебник»
const TOPIC_TITLE = () => Object.fromEntries(GAME_CARDS.map((t) => [t.id, t.title]));

/* ---------------- ЗАДАЧИ НА 10 МИНУТ ---------------- */
const ROLE_NAME = { central_bank: 'Центральный банк', ministry_finance: 'Минфин' };
export function DrillsScreen({ onBack, onStart }) {
  const records = useMemo(loadDrillRecords, []);
  const topics = TOPIC_TITLE();
  return (
    <TrainerPage eyebrow="Тренажёр" title="Задачи на 10 минут" icon={Target} onBack={onBack}
      lede="Десять задач — по темам приложения «Игра ↔ учебник» в Учебнике. Одна цель, несколько кварталов, никаких случайных событий. Соседнее ведомство ведёт бот, у каждой задачи своё зерно — попытки можно сравнивать. Перед каждым ходом можно записать слепой прогноз инфляции: он проверится через четыре квартала. В конце — разбор.">
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
