/* ТРЕНАЖЁР: экраны вне партии, которые учат читать модель, а не выигрывать.
   • Лаборатория — импульсный отклик одного рычага (src/lib/lab.js);
   • Модель и учебник — «игра ↔ учебник» и чем модель не похожа на настоящую.
   Отдельный ленивый чанк: в меню и в партии этот код не нужен. */
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlaskConical, BookOpenText } from 'lucide-react';
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

export function LabScreen({ onBack, initialLever = 'keyRate' }) {
  const [scenario, setScenario] = useState('sandbox');
  const [leverId, setLeverId] = useState(LAB_LEVERS.some((l) => l.id === initialLever) ? initialLever : 'keyRate');
  const lever = LAB_LEVERS.find((l) => l.id === leverId);
  const [delta, setDelta] = useState(DEFAULT_DELTA[leverId] ?? lever.step * 4);
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
    model: 'Доходы разложены на пять групп по 20% с разными источниками (зарплаты, трансферты, капитал) и разной корзиной. Джини — по располагаемым доходам после налогов; бедность — доля ниже 60% медианы, как в ЕС.',
    where: 'Вкладка «Общество» → «Доходы по слоям»; график «Неравенство».',
    lab: 'transfers', try: 'Урежьте выплаты в партии на пару кварталов и посмотрите, как растут Джини и бедность.' },
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
  { title: 'Что с этим делать', text: 'Использовать модель для интуиции: знаки, лаги, компромиссы (инфляция против безработицы, курс против ставки, дефицит против долга). Не использовать для прогнозов и точных чисел. Лаборатория полезна именно этим: форма отклика устойчива, а величина — условна.' },
];

function TextbookTab({ onOpenLab }) {
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
              {onOpenLab && t.lab && (
                <button type="button" className="ems-btn" style={{ marginTop: 8, padding: '5px 10px', fontSize: 12 }}
                  onClick={() => { Audio.play('click'); onOpenLab(t.lab); }}>Открыть в Лаборатории</button>
              )}
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

export function ModelScreen({ onBack, onOpenLab, initialTab = 'textbook' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <TrainerPage eyebrow="Тренажёр" title="Модель и учебник" icon={BookOpenText} onBack={onBack}
      lede="Какие идеи из учебника работают внутри игры, где их увидеть на экране — и где модель честно расходится с настоящей экономикой.">
      <div style={{ marginBottom: 14 }}>
        <Seg label="Раздел" value={tab} onChange={setTab}
          options={[{ id: 'textbook', label: 'Игра ↔ учебник' }, { id: 'limits', label: 'Чем модель не похожа на настоящую' }]} />
      </div>
      {tab === 'textbook' ? <TextbookTab onOpenLab={onOpenLab} /> : <LimitsTab />}
    </TrainerPage>
  );
}
