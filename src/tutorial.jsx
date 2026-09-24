/* Система обучения (словарь терминов, курс из модулей, тесты и практика),
   вынесенная из MacroSimulator.jsx в отдельный чанк: открывается только по
   клике «Обучение» в главном меню, а не сразу при загрузке приложения,
   поэтому грузится лениво через React.lazy() в MacroSimulator.jsx — как и
   src/casino.jsx и src/newspaper.jsx.

   COLOR/Audio/COURSE_PROGRESS_KEY/... — те же самые общие объекты/функции,
   что и в MacroSimulator.jsx (экспортированы оттуда), а не копия. */
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import {
  Landmark, Coins, Globe2, TrendingUp, Newspaper, Scale, ShieldAlert, RotateCcw, ChevronDown,
  X, Check, AlertTriangle, Target, Zap, Flag, Lock, GraduationCap, Crown, Gavel, Hammer,
  Users, Swords, Calendar, Factory, Compass,
} from 'lucide-react';
import {
  CONFIG, LEVERS, CRISIS_INFO, POLITICAL_REGIME_INFO, SCENARIOS, regimeInfoText, regimeInfoLabel,
  fmt1, fmtSigned1, pctFmt, fmtSignedPct, fmtMoney, fmtMln, quarterLabel,
  defaultDecisions, botCentralBank, botFinanceMinistry, redescribeCbAction, redescribeMofAction,
  processPresidentialDirective, PRES_DIRECTIVE_COST, simulateQuarter, makeInitialEconomy,
} from './lib/engine.js';
import { DAILY_QUARTERS } from './lib/catalog.js';
import {
  COLOR, Audio, AudioControls, GlobalStyle, getPlayerId, syncProfile, COURSE_PROGRESS_KEY,
  loadCourseProgress, MODULE_STATE_KEY, loadModuleState, useEscapeClose,
} from './MacroSimulator.jsx';
import {
  KpiTile, PresidentPanel, RegimeBanner, TradingTerminal, AchievementToast, ALL_METRICS, INSTR_BY_ID,
  unlockAchievements, useAchievementToasts, emptyBook, priceOf, bookValue, tradeBook, settleQuarter,
  scaleLever, haptic,
} from './game.jsx';

/* ================================ СЛОВАРЬ ТЕРМИНОВ ================================
   Курс объясняет механику, но пользуется словами, которых человек мог никогда не
   встречать: «дисконтируется», «бенчмарк», «разрыв выпуска». Раньше их приходилось
   либо угадывать по контексту, либо искать снаружи. Теперь термин в тексте подчёркнут
   пунктиром: наведите (или нажмите с телефона) — и определение раскроется прямо под
   абзацем. Тот же список целиком лежит в «Словаре» на странице курсов. */
const GLOSSARY = {
  discount: { title: 'Дисконтирование', text: 'Приведение будущих денег к сегодняшнему дню. Тысяча через год стоит сегодня меньше тысячи: её можно было бы положить под процент. Чем выше ставка, тем дешевле сегодня стоит одна и та же будущая прибыль — поэтому от роста ставки акции дешевеют даже без изменения самих прибылей.' },
  long: { title: 'Лонг (длинная позиция)', text: 'Покупка в расчёте на рост цены. Максимальный убыток — вся вложенная сумма: ниже нуля цена не падает.' },
  short: { title: 'Шорт (короткая позиция)', text: 'Ставка на падение: вы продаёте занятый актив, чтобы позже выкупить его дешевле. Прибыль ограничена (цена не упадёт ниже нуля), а убыток растёт вместе с ценой и потолка не имеет — на практике позицию раньше закроет маржин-колл.' },
  leverage: { title: 'Плечо', text: 'Сделка на сумму больше собственного капитала: остальное — заём под обеспечение. Во столько же раз растут и прибыль, и убыток, и скорость, с которой вы упираетесь в маржин-колл.' },
  margincall: { title: 'Маржин-колл', text: 'Требование довнести обеспечение, когда убыток съел его запас. Если вносить нечего, позиции закрывают принудительно по текущей цене — и убыток фиксируется независимо от того, что цена сделает дальше.' },
  benchmark: { title: 'Бенчмарк (эталон)', text: 'То, с чем сравнивают результат: индекс акций, облигации, депозит, инфляция. «Заработал 8%» ничего не значит, пока неизвестно, сколько за то же время дал рынок и сколько съели цены.' },
  volatility: { title: 'Волатильность', text: 'Размах колебаний цены. Высокая волатильность — это не «падение», а неопределённость: сильные движения в обе стороны, из-за которых плечо становится опасным.' },
  liquidity: { title: 'Ликвидность', text: 'Насколько быстро актив превращается в деньги без потери цены. У банка — запас средств, которыми он может рассчитаться прямо сейчас; его нехватка останавливает кредитование раньше, чем банк становится неплатёжеспособным.' },
  riskpremium: { title: 'Премия за риск', text: 'Надбавка к ставке, которую требуют за право одолжить именно вам. Растёт от долга, политической неопределённости и слабых институтов — и удорожает весь новый долг государства.' },
  realrate: { title: 'Реальная ставка', text: 'Ставка за вычетом инфляции (точнее — ожидаемой инфляции). Именно она определяет, дорогие деньги или дешёвые: ставка 8% при инфляции 10% — это мягкая политика, а не жёсткая.' },
  rstar: { title: 'Нейтральная ставка (r*)', text: 'Уровень реальной ставки, при котором политика никуда не толкает экономику: не разгоняет и не тормозит. Жёсткость политики измеряют расстоянием до неё, а не абсолютной цифрой.' },
  outputgap: { title: 'Разрыв выпуска', text: 'Насколько фактический ВВП отличается от потенциального, в процентах. Плюс — экономика работает выше своих возможностей (перегрев, цены пойдут вверх), минус — недозагружена (простаивают люди и мощности).' },
  potential: { title: 'Потенциальный рост', text: 'Темп, с которым экономика может расти долго и без разгона цен: определяется людьми, капиталом и производительностью. Спрос можно поднять указом, потенциал — только реформами и инвестициями, и не за квартал.' },
  nairu: { title: 'Естественная безработица (NAIRU)', text: 'Уровень безработицы, при котором зарплаты и цены не ускоряются. Опускать безработицу ниже него можно — но только ценой растущей инфляции.' },
  expectations: { title: 'Инфляционные ожидания', text: 'То, какую инфляцию люди и бизнес закладывают в цены и зарплаты уже сейчас. Это механизм, а не прогноз: если все ждут роста цен, он происходит независимо от первопричины.' },
  anchor: { title: 'Якорь ожиданий', text: 'Состояние, при котором ожидания стоят у цели центрального банка и не реагируют на каждый скачок цен. Якорь держится доверием: сорвать его можно за квартал, вернуть — за годы.' },
  credibility: { title: 'Доверие к ЦБ', text: 'Насколько рынок верит, что объявленная цель будет достигнута. Высокое доверие делает ту же ставку эффективнее: ожидания опускаются сами, без дополнительного ужесточения.' },
  fiscalimpulse: { title: 'Бюджетный импульс', text: 'Насколько бюджет в этом году добавляет спроса по сравнению с прошлым. Положительный импульс разгоняет экономику, даже если дефицит формально не растёт.' },
  consolidation: { title: 'Бюджетная консолидация', text: 'Сокращение дефицита: расходы вниз или налоги вверх. Лечит долг и помогает ставке, но забирает спрос — обычно в самый неподходящий политически момент.' },
  transfers: { title: 'Социальные выплаты (трансферты)', text: 'Пенсии, пособия, индексации. Это не разовая трата, а темп: подняли один раз — расходы растут каждый квартал, пока решение не отменят.' },
  shadow: { title: 'Теневая экономика', text: 'Доля активности, которая не видна бюджету и не платит налогов. Растёт от чрезмерной налоговой нагрузки: часть возможных сборов теряется ровно так, а не из-за «плохого администрирования».' },
  sovereignfund: { title: 'Суверенный фонд', text: 'Резерв бюджета: профицит сначала гасит госдолг, а после того как долг обнулился, идёт сюда, принося доход. Дефицит сначала тратит фонд и только потом занимает — фонд смягчает необходимость экстренных займов в плохие времена.' },
  intervention: { title: 'Валютные интервенции', text: 'Покупка или продажа валюты центральным банком ради курса. Против фундаментальных причин ослабления работают недолго — ровно столько, сколько хватит резервов.' },
  yieldcurve: { title: 'Кривая доходности', text: 'Соотношение доходностей коротких и длинных облигаций. Когда короткие дороже длинных (кривая перевёрнута), рынок ждёт снижения ставки — обычно из-за приближающегося спада.' },
  polcapital: { title: 'Политический капитал', text: 'Ресурс президента вместо ползунков: им оплачиваются указы, кадровые решения, реформы и требования к ведомствам. Копится рейтингом и ростом, тает кризисами и беспорядками.' },
  reform: { title: 'Структурная реформа', text: 'Изменение правил, а не суммы: рынок труда, пенсии, суды, образование. Двигает потенциал экономики, а не её загрузку, платит за себя годами и почти всегда стоит рейтинга сразу.' },
  futures: { title: 'Фьючерс', text: 'Контракт на актив с расчётами по рыночной цене каждый квартал, а не сама покупка. Плечо в нём не берётся отдельно — оно встроено в номинал контракта: вносится лишь гарантийное обеспечение, а прибыль и убыток считаются от полной суммы контракта, поэтому и то, и другое растёт кратно быстрее, чем при прямой покупке актива.' },
  option: { title: 'Опцион', text: 'Право (но не обязанность) купить (call) или продать (put) актив по заранее оговорённой цене (страйку) до определённого срока. Стоит премию — это и есть максимум, который можно потерять; выигрыш при этом ничем не ограничен сверху у call и ограничен нулевой ценой актива у put.' },
};
const GLOSSARY_KEYS = Object.keys(GLOSSARY);

/* Термин в тексте курса: пунктирное подчёркивание, определение раскрывается по
   нажатию (на десктопе работает и обычная подсказка при наведении). */
function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[k];
  if (!g) return <>{children}</>;
  return (
    <span style={{ position: 'relative' }}>
      <span role="button" tabIndex={0} title={`${g.title} — ${g.text}`}
        onClick={() => { Audio.play('tick'); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
        style={{ borderBottom: `1px dashed ${COLOR.gold}`, cursor: 'help', color: COLOR.goldSoft }}>{children}</span>
      {open && (
        <span style={{ display: 'block', margin: '7px 0', padding: '9px 11px', background: COLOR.panelAlt,
          border: `1px solid ${COLOR.border}`, borderRadius: 3, fontSize: 11.5, lineHeight: 1.55, color: COLOR.muted }}>
          <b style={{ color: COLOR.goldSoft }}>{g.title}</b> — {g.text}
        </span>
      )}
    </span>
  );
}

function GlossaryModal({ onClose }) {
  useEscapeClose(onClose);
  const [q, setQ] = useState('');
  const norm = q.trim().toLowerCase();
  const list = GLOSSARY_KEYS.map((k) => GLOSSARY[k])
    .filter((g) => !norm || g.title.toLowerCase().includes(norm) || g.text.toLowerCase().includes(norm))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 620, width: '100%', maxHeight: '86vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <GraduationCap size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Словарь терминов</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} aria-label="Закрыть" onClick={onClose}><X size={13} /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по словарю"
          style={{ width: '100%', padding: '9px 11px', fontSize: 13, marginBottom: 12,
            background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
        {list.map((g) => (
          <div key={g.title} className="ems-panel" style={{ padding: '10px 12px', marginBottom: 7 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: COLOR.goldSoft, marginBottom: 3 }}>{g.title}</div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, lineHeight: 1.55 }}>{g.text}</div>
          </div>
        ))}
        {!list.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Ничего не нашлось.</div>}
      </div>
    </div>
  );
}

/* ============================ ОБУЧЕНИЕ: КУРС ИЗ МОДУЛЕЙ ============================ */
// Курс из последовательных модулей вместо одного урока: каждый — своя
// мини-экономика (без бота-оппонента, кризисов и оценки партии) на настоящем
// движке (simulateQuarter), со сценарием и открываемыми по одному рычагами.
// Модули идут от поверхностного понимания к углублённому и разблокируются по
// порядку — прогресс хранится на устройстве (localStorage), как и достижения.
const markModuleDone = (id) => {
  const p = loadCourseProgress(); p[id] = true;
  try { localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
  return p;
};

/* ============================ ОБУЧЕНИЕ: ПРОВЕРКА ЗНАНИЙ ============================
   Модуль больше нельзя пролистать «Далее»: между теорией и следующим модулем стоят
   два вида проверки — тест (теория) и практика (задача в песочнице). Тест не пускает
   дальше с неверным ответом, но и не наказывает: показывает разбор и даёт ответить
   заново, потому что цель проверки — чтобы человек понял, а не чтобы он отсеялся.
   Практика устроена так же: не получилось за отведённые кварталы — состояние
   откатывается к началу задачи, и можно попробовать ещё раз. */
/* Правильный вариант при написании всегда стоит первым — так удобно автору и
   совершенно негодно для проверяющего: «А» превратилась бы в универсальный ответ.
   Порядок перемешивается детерминированно по тексту вопроса: у одного и того же
   вопроса он всегда одинаковый (иначе варианты прыгали бы при каждом рендере и
   при перепрохождении), но предсказать его по позиции нельзя. */
const hashStr = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// возвращает порядок показа: order[позиция на экране] = индекс в исходном массиве
const shuffleOrder = (question, salt) => {
  const order = question.options.map((_, i) => i);
  let seed = (hashStr(question.q) ^ (salt || 0)) >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order;
};

function QuizStep({ questions, onPass, passed }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  /* Соль перемешивания живёт на время захода в модуль: внутри одной попытки
     варианты не прыгают, а при следующем заходе порядок другой — иначе тест
     запоминается позициями, а не смыслом. */
  const salt = React.useRef(Math.floor(Math.random() * 1e9));
  const orders = useMemo(() => questions.map((q) => shuffleOrder(q, salt.current)), [questions]);
  const allAnswered = questions.every((_, i) => answers[i] !== undefined);
  /* Тест, сданный в прошлый заход, отвечать заново не нужно — прогресс модуля
     сохраняется. Но разбор при этом строился по пустому набору ответов и писал
     «Неверно» под вариантом, который тут же был отмечен галочкой как правильный. */
  const isRight = (i) => (answers[i] === undefined ? !!passed : orders[i][answers[i]] === questions[i].answer);
  const wrongCount = questions.filter((_, i) => !isRight(i)).length;
  const check = () => {
    setChecked(true);
    if (wrongCount === 0) { Audio.play('stamp'); onPass(); } else { Audio.play('alarm'); haptic([40, 60, 40]); }
  };
  const pick = (qi, oi) => {
    if (passed) return;
    Audio.play('tick');
    setAnswers((a) => ({ ...a, [qi]: oi }));
    // после правки ответа разбор прячется: иначе рядом с новым выбором висит
    // вердикт по старому и читается как оценка того, что ещё не проверяли
    setChecked(false);
  };
  return (
    <div>
      {questions.map((q, qi) => {
        const showVerdict = checked || passed;
        return (
          <div key={q.q} className="ems-panel" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 9 }}>
              <span className="ems-mono" style={{ fontSize: 10.5, color: COLOR.faint, flexShrink: 0 }}>{qi + 1} / {questions.length}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: COLOR.text }}>{q.q}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {orders[qi].map((srcIdx, oi) => {
                const opt = q.options[srcIdx];
                const chosen = answers[qi] === oi;
                const right = srcIdx === q.answer;
                // пока задача не пройдена, отмечаем только собственный выбор —
                // иначе неверный ответ тут же подсвечивал правильный вариант,
                // и «сколько угодно попыток» превращалось в «нажми на галочку»
                const mark = showVerdict && (passed ? (right || chosen) : chosen);
                const color = !mark ? (chosen ? COLOR.gold : COLOR.border) : right ? COLOR.teal : COLOR.rust;
                return (
                  <button key={opt} className="ems-btn" onClick={() => pick(qi, oi)} disabled={passed}
                    style={{ textAlign: 'left', padding: '8px 11px', fontSize: 12.5, lineHeight: 1.45, display: 'flex', gap: 9, alignItems: 'flex-start',
                      borderColor: color, background: chosen ? COLOR.goldDim : COLOR.panelAlt,
                      color: COLOR.text, cursor: passed ? 'default' : 'pointer' }}>
                    <span className="ems-mono" style={{ fontSize: 10.5, color, flexShrink: 0, marginTop: 1 }}>
                      {mark ? (right ? '✓' : '✕') : String.fromCharCode(1040 + oi)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {showVerdict && (
              <div style={{ marginTop: 9, fontSize: 11.5, lineHeight: 1.5, paddingLeft: 10,
                borderLeft: `2px solid ${isRight(qi) ? COLOR.teal : COLOR.rust}`, color: COLOR.muted }}>
                <b style={{ color: isRight(qi) ? COLOR.teal : COLOR.rust }}>{isRight(qi) ? 'Верно. ' : 'Неверно. '}</b>{q.explain}
              </div>
            )}
          </div>
        );
      })}
      {!passed && (
        <>
          <button className="ems-btn primary" disabled={!allAnswered} style={{ width: '100%', padding: '11px 0', fontSize: 13 }}
            onClick={check}>
            {checked && wrongCount > 0 ? 'Проверить ещё раз' : 'Проверить ответы'}
          </button>
          <div style={{ fontSize: 11, color: checked && wrongCount ? COLOR.rust : COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
            {checked && wrongCount > 0
              ? `Ошибок: ${wrongCount}. Разбор под каждым вопросом — исправьте ответы и проверьте снова, попытки не считаются.`
              : allAnswered ? 'Дальше пустит только полностью верный ответ — но переотвечать можно сколько угодно.'
                : 'Ответьте на все вопросы, чтобы проверить.'}
          </div>
        </>
      )}
      {passed && (
        <div style={{ fontSize: 12.5, color: COLOR.teal, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Check size={14} />Тест пройден.
        </div>
      )}
    </div>
  );
}

/* Полоса задачи: что нужно сделать, сколько кварталов осталось и где вы сейчас. */
function PracticeStatus({ step, ctx, quartersUsed, passed, failed }) {
  const left = step.maxQuarters - quartersUsed;
  const tone = passed ? COLOR.teal : failed ? COLOR.rust : COLOR.gold;
  return (
    <div className="ems-panel" style={{ padding: '11px 14px', marginBottom: 12, borderColor: tone }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: tone }}>
          {passed ? 'Задача решена' : failed ? 'Задача не решена' : 'Задача'}
        </span>
        <span style={{ fontSize: 12.5, color: COLOR.text, flex: 1, minWidth: 180 }}>{step.goalLabel}</span>
        <span className="ems-mono" style={{ fontSize: 11, color: left <= 1 && !passed ? COLOR.rust : COLOR.faint }}>
          {passed ? `${quartersUsed} кв. потрачено` : `осталось ${left} кв. из ${step.maxQuarters}`}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>{step.goalText(ctx)}</div>
      {failed && step.hint && (
        <div style={{ fontSize: 11.5, color: COLOR.goldSoft, marginTop: 6, lineHeight: 1.45 }}>Подсказка: {step.hint}</div>
      )}
    </div>
  );
}

const TUTORIAL_MODULES = [
  {
    id: 'basics', depth: 'surface', icon: Zap,
    title: 'Основы: ставка и расходы',
    summary: 'Как ключевая ставка и госрасходы двигают экономику — и почему не сразу.',
    pins: ['gdp', 'inflation', 'unemployment', 'debtToGdp'],
    steps: [
      {
        title: 'Добро пожаловать',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Это тренировочный кабинет: мини-экономика без бота-оппонента, кризисов и оценки партии в конце. Настоящая игра сложнее — там второй ветвью власти управляет бот со своим характером, случаются кризисы, а итог партии сравнивается с выбранной целью.</p>
            <p>Экономика считается кварталами, и решение сегодня отражается на показателях с лагом в один-два квартала — эффект не мгновенный. Это главное, что стоит запомнить прямо сейчас.</p>
            <p>Сейчас инфляция {pctFmt(economy.inflation)} при цели {pctFmt(economy.inflationTarget)}, рост в норме. Нажмите «Далее», чтобы посмотреть на квартал без вашего вмешательства.</p>
          </>
        ),
      },
      {
        title: 'Ключевая ставка', pins: ['keyRate', 'inflation', 'gdp', 'unemployment'],
        lever: 'keyRate', minDelta: 1, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Вот единственный рычаг этого шага — ключевая ставка Центрального банка. Выше ставка → дороже кредит → меньше спроса → ниже инфляция, но и медленнее рост. Ниже ставка — наоборот.</p>
            <p>Сейчас ставка {pctFmt(economy.keyRate)}, инфляция {pctFmt(economy.inflation)}.</p>
            <p>Поднимите ставку минимум на 1 п.п. и нажмите «Далее» — квартал завершится с этим решением.</p>
          </>
        ),
      },
      {
        title: 'Лаг и бюджетный рычаг', pins: ['keyRate', 'inflation', 'outputGap', 'gdp'],
        lever: 'govSpending', minDelta: 2, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Инфляция сейчас {pctFmt(economy.inflation)} — почти как и была. Это ожидаемо: решение по ставке действует не мгновенно, а с лагом в один-два квартала — эффект будет виден чуть позже.</p>
            <p>На панели рядом появился новый показатель — <Term k="outputgap">разрыв выпуска</Term>: насколько фактический ВВП отличается от потенциального, в процентах. Сейчас он {fmtSignedPct(economy.outputGap)}: {economy.outputGap >= 0.3
              ? 'экономика работает выше своих возможностей, это и разгоняет инфляцию'
              : economy.outputGap <= -0.3
                ? 'экономика недозагружена — есть свободные мощности и рабочие руки'
                : 'она почти на нуле, экономика работает примерно на пределе своих текущих возможностей'}. Именно за него, а не за сам ВВП, и идёт вся борьба ставкой и бюджетом.</p>
            <p>А вот и второй канал — расходы государства. В отличие от ставки, это решение «по накопительной»: заданный темп роста расходов сохраняется, пока вы его не измените, — не нужно повторять его каждый квартал.</p>
            <p>Поднимите темп роста госрасходов минимум на 2 п.п. и нажмите «Далее».</p>
          </>
        ),
      },
      {
        title: 'Вот и эффект', pins: ['keyRate', 'inflation', 'outputGap', 'unemployment'],
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1].inflation : economy.inflation;
          const now = economy.inflation;
          return (
            <>
              <p>Сравните: сразу после первого квартала инфляция была {pctFmt(before)}. Сейчас, когда ставка и расходы успели подействовать, — {pctFmt(now)}. {now < before
                ? 'Повышение ставки перевесило стимул от расходов — инфляция снижается.'
                : 'Стимул от расходов оказался сильнее охлаждающего эффекта ставки — инфляция подросла.'}</p>
              <p>Это и есть главный урок первого модуля: эффект решений накапливается и проявляется с задержкой.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли первую цепочку: <b>ставка/расходы → кредит и спрос → выпуск → занятость → цены</b>. Дальше — вторая половина государства: бюджет, налоги и то, откуда вообще берётся госдолг.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'budget', depth: 'surface', icon: Coins,
    title: 'Бюджет: налоги и дефицит',
    summary: 'Откуда берутся деньги государства и почему долг — это не просто цифра.',
    pins: ['revenuePctGdp', 'budgetBalancePctGdp', 'debtToGdp', 'interestToRevenue'],
    steps: [
      {
        title: 'Доходы, расходы, долг',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Бюджет — это доходы (в основном налоги) минус расходы. Разница — дефицит (если отрицательная) или профицит. Накопленные из года в год дефициты и есть государственный долг.</p>
            <p>Долг принято мерить не в абсолютных деньгах, а в % ВВП — так можно сравнивать разные по размеру экономики и разные периоды одной и той же.</p>
            <p>Сейчас доходы бюджета {pctFmt(economy.revenuePctGdp)} ВВП, долг {pctFmt(economy.debtToGdp)} ВВП. Нажмите «Далее», чтобы увидеть спокойный квартал.</p>
          </>
        ),
      },
      {
        title: 'Налоги', pins: ['revenuePctGdp', 'shadowShare', 'budgetBalancePctGdp', 'debtToGdp'],
        lever: 'vatRate', minDelta: 3, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Поднимите НДС минимум на 3 п.п. Казалось бы, доходы бюджета должны вырасти пропорционально ставке — но так работает только в теории.</p>
            <p>Сейчас НДС {pctFmt(economy.vatRate)}, <Term k="shadow">теневая экономика</Term> {pctFmt(economy.shadowShare)} ВВП. Чем выше ставка сверх разумного, тем больше активности уходит «в тень» — часть возможных сборов модель теряет именно так.</p>
          </>
        ),
      },
      {
        title: 'Расходы вместо доходов',
        lever: 'transfers', minDelta: 3, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Второй способ повлиять на бюджет — расходы. Поднимите темп роста социальных выплат минимум на 3 п.п.</p>
            <p>В отличие от разовой операции, это тоже «накопительное» решение (как госрасходы в первом модуле): подняли один раз — растёт каждый квартал, пока не измените. Сейчас баланс бюджета {fmtSignedPct(economy.budgetBalancePctGdp)} ВВП.</p>
          </>
        ),
      },
      {
        title: 'Цена долга',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1] : economy;
          return (
            <>
              <p>Доходы бюджета выросли не так сильно, как ставка НДС — часть эффекта съела тень. А рост социальных выплат потянул баланс бюджета вниз: с {fmtSignedPct(before.budgetBalancePctGdp)} до {fmtSignedPct(economy.budgetBalancePctGdp)} ВВП.</p>
              <p>Долг к ВВП сдвинулся с {pctFmt(before.debtToGdp)} до {pctFmt(economy.debtToGdp)}. Обслуживание долга ({pctFmt(economy.interestToRevenue)} от доходов) — это проценты, которые бюджет платит каждый квартал, отъедая от денег на всё остальное.</p>
            </>
          );
        },
      },
      {
        title: 'Резерв на будущее', pins: ['sovereignFund', 'govDebt', 'debtToGdp'],
        lever: 'bondIssuance', minDelta: 10, runsQuarter: true,
        body: () => (
          <>
            <p>Дефицит и так финансируется сам — рынок занимает за вас ровно столько денег, сколько не хватает бюджету. Но есть и отдельный, добровольный рычаг во вкладке «Долг» — «Размещение облигаций»: занять сверх этого специально, не под расходы этого квартала.</p>
            <p>Разместите облигаций минимум на 10 млрд и нажмите «Далее».</p>
          </>
        ),
      },
      {
        title: 'Куда идут деньги',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history.length >= 2 ? history[history.length - 2] : economy;
          return (
            <>
              <p>Долг к ВВП вырос сразу — с {pctFmt(before.debtToGdp)} до {pctFmt(economy.debtToGdp)}. Но эти деньги не ушли на расходы: они легли в <Term k="sovereignfund">суверенный фонд</Term> ({fmtMoney(economy.sovereignFund)}) и останутся там, пока не понадобятся — например, чтобы профинансировать будущий дефицит, не занимая по условиям, которые к тому моменту могут быть хуже нынешних.</p>
              <p>Это компромисс, а не бесплатный доход: занять раньше, чем нужно, — тоже долг, и обслуживать его придётся уже сейчас.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Налоги не масштабируются линейно, а расходы, увеличенные один раз, продолжают давить на баланс каждый квартал. Долг — это не разовая проблема, а нарастающая стоимость обслуживания, и его можно нарастить не только по необходимости, но и заранее, про запас. Дальше — то, что происходит на границе: валютный курс.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'fx', depth: 'surface', icon: Globe2,
    title: 'Валютный курс и резервы',
    summary: 'Что двигает курс и почему ставка и интервенции тянут его в разные стороны.',
    pins: ['exchangeRate', 'reserves', 'currentAccount', 'inflation'],
    steps: [
      {
        title: 'Курс и резервы',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Курс в этой модели устроен так: чем выше число — тем слабее национальная валюта. Резервы — валютная «подушка», которой ЦБ может защищать курс интервенциями, но она не бесконечна.</p>
            <p>Сейчас курс {fmt1(economy.exchangeRate)}, резервы {fmtMoney(economy.reserves)}. Нажмите «Далее», чтобы увидеть спокойный квартал.</p>
          </>
        ),
      },
      {
        title: 'Валютные интервенции',
        lever: 'fxIntervention', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Увеличьте валютные интервенции минимум на 5 млрд. Положительное значение — ЦБ покупает иностранную валюту, тем самым ослабляя национальную (например, чтобы поддержать экспортёров, которым выгоден слабый курс).</p>
            <p>Курс сейчас {fmt1(economy.exchangeRate)}.</p>
          </>
        ),
      },
      {
        title: 'Ставка как противовес',
        lever: 'keyRate', minDelta: 1.5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>У ставки, помимо влияния на инфляцию (модуль 1), есть и валютный эффект: чем она выше, тем привлекательнее актив в национальной валюте для иностранного капитала — курс укрепляется.</p>
            <p>Курс после прошлого шага — {fmt1(economy.exchangeRate)}. Поднимите ключевую ставку минимум на 1.5 п.п. — это противоположно направленная сила.</p>
          </>
        ),
      },
      {
        title: 'Кто перевесил',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] ? history[1].exchangeRate : economy.exchangeRate;
          const now = economy.exchangeRate;
          return (
            <>
              <p>Курс изменился с {fmt1(before)} до {fmt1(now)}. Вы одновременно ослабляли его интервенциями и укрепляли ставкой — {now > before ? 'интервенции оказались сильнее' : 'ставка перевесила'}.</p>
              <p>В реальной партии эти рычаги обычно в руках разных институтов (ЦБ отвечает за оба, но приоритеты у него не всегда однозначны) — управлять курсом в одиночку сложнее, чем кажется.</p>
            </>
          );
        },
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Курс — не отдельный рычаг, а равнодействующая нескольких решений сразу, и резервы, которыми его защищают, конечны. Дальше — тема более тонкая: как рынки верят (или не верят) обещаниям ЦБ.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'expectations', depth: 'deep', icon: Target,
    title: 'Ожидания и доверие к ЦБ',
    summary: 'Почему инфляционные ожидания важнее сиюминутной инфляции.',
    pins: ['inflation', 'inflationExpectations', 'cbCredibility', 'keyRate'],
    steps: [
      {
        title: 'Ожидания важнее цифры',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Инфляционные ожидания — это не прогноз, а то, что закладывают в цены и зарплаты уже сейчас: если все верят, что инфляция будет высокой, продавцы и работники требуют больше — и она правда становится высокой. Это самосбывающийся механизм.</p>
            <p>Доверие к ЦБ измеряет, насколько рынок верит объявленной цели по инфляции. Сейчас ожидания {pctFmt(economy.inflationExpectations)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Соблазн простого решения',
        lever: 'inflationTarget', minDelta: 1, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Есть простой на бумаге способ «побороть» высокую инфляцию — объявить цель повыше, и формально она у цели. Поднимите цель по инфляции минимум на 1 п.п. и посмотрите, что происходит на самом деле.</p>
            <p>Сейчас цель {pctFmt(economy.inflationTarget)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Доверие не восстанавливается по щелчку',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] || economy;
          return (
            <>
              <p>Доверие к ЦБ сдвинулось с {Math.round(before.cbCredibility)} до {Math.round(economy.cbCredibility)}, а ожидания — с {pctFmt(before.inflationExpectations)} до {pctFmt(economy.inflationExpectations)}. Смена цели не прошла бесплатно: рынок теперь меньше верит следующим объявлениям ЦБ.</p>
              <p>Доверие теряется быстро, а восстанавливается медленно — и только делами, а не заявлениями.</p>
            </>
          );
        },
      },
      {
        title: 'Восстановление доверия',
        lever: 'keyRate', minDelta: 2, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Единственный способ вернуть доверие — решительно и последовательно действовать в объявленную сторону. Поднимите ключевую ставку минимум на 2 п.п.</p>
            <p>Сейчас ставка {pctFmt(economy.keyRate)}, доверие {Math.round(economy.cbCredibility)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Компромисс между гибкостью и доверием — сквозная тема настоящей игры: недаром у ботов-глав ЦБ разный характер (Ястреб держит цель жёстко, Голубь готов ею жертвовать). Дальше — последний, самый прикладной модуль: как готовиться к кризису заранее.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'crisis', depth: 'deep', icon: ShieldAlert,
    title: 'Риски и подготовка к кризису',
    summary: 'Макропруденциальные инструменты: не тушить пожар, а не дать ему начаться.',
    pins: ['bankingRisk', 'bankCapitalAdequacy', 'bankNPL', 'financialStability', 'debtRisk'],
    steps: [
      {
        title: 'Пять индикаторов риска',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>В настоящей игре есть панель из пяти рисков: инфляционный, банковский, долговой, рецессии и валютный — заранее показывают, где копится опасность, до того как она стала кризисом. В этом модуле — банковский и долговой.</p>
            <p>Достаточность капитала банков {pctFmt(economy.bankCapitalAdequacy)}, просроченные кредиты {pctFmt(economy.bankNPL)}. Это буфер и его нагрузка: чем толще буфер и меньше просрочка, тем спокойнее банковская система переживёт шок.</p>
          </>
        ),
      },
      {
        title: 'Норматив достаточности капитала', pins: ['bankCapitalAdequacy', 'capitalRequirement', 'bankNPL', 'bankingRisk'],
        lever: 'capitalRequirement', minDelta: 1.5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Это требование к банкам держать больше капитала на случай убытков — амортизатор кризиса, который ставится заранее, а не во время паники. Поднимите норматив минимум на 1.5 п.п.</p>
            <p>Плата за это реальна: банки выдают меньше кредитов — рост чуть замедляется. Сейчас норматив {pctFmt(economy.capitalRequirement)}.</p>
          </>
        ),
      },
      {
        title: 'Быстрая помощь ликвидностью', pins: ['bankLiquidity', 'bankingRisk', 'bankCapitalAdequacy', 'bankNPL'],
        lever: 'liquidity', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Другой инструмент — прямая инъекция ликвидности банкам. В отличие от норматива капитала, это разовая скорая помощь, а не структурное решение. Увеличьте вливание ликвидности минимум на 5 млрд.</p>
            <p>Сейчас банковский риск {Math.round(economy.bankingRisk)} из 100.</p>
          </>
        ),
      },
      {
        title: 'Что изменилось',
        lever: null, runsQuarter: false,
        body: ({ economy, history }) => {
          const before = history[1] || economy;
          return (
            <>
              <p>Достаточность капитала выросла с {pctFmt(before.bankCapitalAdequacy)} до {pctFmt(economy.bankCapitalAdequacy)}, банковский риск изменился с {Math.round(before.bankingRisk)} до {Math.round(economy.bankingRisk)}.</p>
              <p>Норматив капитала — это профилактика на годы вперёд, ликвидность — заплатка на квартал. В реальной партии оба инструмента понадобятся, но по-разному: один заранее, другой — когда индикаторы риска уже красные.</p>
            </>
          );
        },
      },
      {
        title: 'Долговой риск: три причины',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Долговой риск складывается из трёх слагаемых: долг выше 45% ВВП, дефицит бюджета глубже 2% ВВП и, отдельно, ставка по долгу выше номинального роста экономики (ставка минус рост ВВП минус инфляция). Последнее — самое коварное: даже при разумном первичном балансе долг к ВВП может расти сам по себе, если занимать дороже, чем растёт экономика — это называется отрицательным дифференциалом «ставка минус рост», и именно из-за него консолидация иногда не сразу останавливает рост долга, а лишь замедляет его.</p>
            <p>Сейчас долговой риск {Math.round(economy.debtRisk)} из 100, долг {pctFmt(economy.debtToGdp)} ВВП, ставка по долгу {fmt1(economy.effectiveDebtRate)}% против номинального роста {fmt1(economy.gdpGrowth + economy.inflation)}%.</p>
          </>
        ),
      },
      {
        title: 'Когда риск становится кризисом',
        lever: null, runsQuarter: false,
        body: ({ economy }) => (
          <>
            <p>При риске от {CONFIG.thresholds.debtRisk} из 100 объявляется долговой кризис: инвесторы требуют <Term k="riskpremium">премию за риск</Term>, ставка по новому долгу растёт ещё быстрее, начинается отток капитала — тот самый порочный круг «дефицит → ставка → расходы на проценты → дефицит». Пока риск не дошёл до кризиса, снижают его те же рычаги, что и в модуле про бюджет: консолидация и меньший первичный дефицит, — просто эффект виден не сразу, а через несколько кварталов.</p>
            <p>Если кризис всё же наступил, у Минфина есть два инструмента на самый край, а не для повседневного управления бюджетом. Реструктуризация (дефолт) списывает часть долга разом, но закрывает доступ к рынкам на несколько кварталов и бьёт по доверию надолго. Альтернатива — экстренное финансирование МВФ: долг не списывается и рынки не закрываются, ставка и премия за риск сразу снижаются, но взамен два года действует обязательная консолидация расходов и выплат — условие программы, которое нельзя отменить своим решением, не разорвав саму программу. Сейчас премия за риск по новому долгу {Math.round(economy.sovereignSpread)} б.п.</p>
          </>
        ),
      },
      {
        title: 'Начать партию уже в кризисе',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Всё, что разбиралось в этом модуле, обычно приходится ждать: кризис случается сам, когда-нибудь, и до тех пор учиться на нём не на чем. Поэтому в настройке партии кроме открытой игры есть три стартовых сценария — партия начинается в тот момент, когда всё уже произошло.</p>
            <p>Сценарии идут по сложности. <b>Ипотечный пузырь</b> — средний: кредитный бум уже был, просрочка растёт, капитал банков на исходе; институты выдержат, но выборы проиграть легко. <b>Валютный кризис</b> — трудный: половина резервов истрачена, ставка поднята экстренно, доверия нет; защищать курс дальше или отпустить и получить инфляцию. <b>Гиперинфляция</b> — самый трудный: спираль «цены → ожидания → цены» раскручена, и постепенностью её не остановить.</p>
            <p>Из гиперинфляции ведёт одна дорога — стабилизационная программа, как в Боливии в 1985-м или в Бразилии в 1994-м. Реальная ставка не ниже 3 п.п., ЦБ не печатает деньги, дефицит бюджета не больше 3% ВВП: когда рынок видит все три условия сразу, доверие к программе копится, и ожидания падают за кварталы, а не за годы. Одна жёсткая ставка без бюджета работает втрое медленнее, а ослабить деньги раньше времени — значит сорвать программу. У правительства есть мандат спасения, несколько кварталов терпения, — но только пока программа работает.</p>
            <p>Сценарий меняет стартовые цифры и характеры ботов, но не правила: те же рычаги, та же модель. Это способ сразу оказаться в той точке, ради которой и написан этот модуль.</p>
          </>
        ),
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли пять модулей: ставка и расходы → бюджет и долг → валютный курс → ожидания и доверие → риски и подготовка к кризису. Дальше — два углублённых модуля: как кончаются гиперинфляции, самый трудный кризис игры, и политика — что бывает, когда всё перечисленное идёт плохо слишком долго.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'stabilization', depth: 'deep', icon: Coins,
    title: 'Как кончаются гиперинфляции',
    summary: 'Почему постепенность не работает, из чего состоит стабилизационная программа и чем за неё платят.',
    pins: ['inflation', 'inflationExpectations', 'stabilizationCred', 'approval'],
    steps: [
      {
        title: 'Почему постепенность не работает',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>При инфляции в несколько процентов ЦБ поднимает ставку шагами по четверти пункта и ждёт: ожидания сползают вниз вслед за ценами, и через год-полтора всё возвращается к цели. При инфляции 30% этот рецепт не работает. Ожидания уже 25–30%, и каждый шаг ставки отстаёт от них — реальная ставка остаётся отрицательной, деньги продолжают обесцениваться, а люди избавляются от них в тот же день.</p>
            <p>Пока ЦБ «постепенно ужесточает», рецессия уже идёт, рейтинг уже падает, а инфляция стоит. Так проигрывают дважды: и цены не остановлены, и экономика в спаде.</p>
          </>
        ),
      },
      {
        title: 'Три опоры программы',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Большие инфляции в истории кончались не сжатием, а сменой режима — так их описал Томас Сарджент в «Конце четырёх больших инфляций». Рынок начинает верить, когда видит сразу три вещи:</p>
            <p><b>Деньги.</b> Реальная ставка — ставка минус ожидания — не ниже 3 п.п., и ЦБ не печатает деньги: ни выкупа активов, ни экстренной эмиссии. <b>Бюджет.</b> Дефицит не больше 3% ВВП или расходы сокращаются: бюджет, который требует денег у ЦБ, обесценит любую ставку. <b>Якорь.</b> Управляемый курс при достаточных резервах даёт людям видимую опору, пока они ещё не поверили ставке, — это ускоряет, но не заменяет первые две опоры.</p>
            <p>Пока опоры держатся, копится доверие к программе — оно видно в показателях как «Доверие к стабилизации». Одна жёсткая ставка без бюджета копит его втрое медленнее. Ослабить деньги раньше времени — значит сорвать программу: доверие рушится сразу, и второй раз поверят не скоро.</p>
          </>
        ),
      },
      {
        title: 'Мандат и цена победы',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Когда программе верят, ожидания падают за кварталы, а не за годы, — и уже вслед за ними ставку можно снижать. Держать её высокой после победы — вторая классическая ошибка: реальная ставка взлетает, и рецессия добивает то, что пощадила стабилизация.</p>
            <p>У правительства, пришедшего спасать страну, есть мандат — несколько кварталов терпения (так было в Боливии в 1985-м). Но в полную силу он действует, только пока программа работает. Когда инфляция возвращается к цели, страна один раз прощает рецессию тем, кто остановил цены: мандат обновляется, рейтинг подскакивает. После Плана Реал в Бразилии министр финансов, остановивший инфляцию, выиграл президентские выборы.</p>
            <p>И последнее: при дорогом долге рынок может отказаться финансировать дефицит — тогда расходы режет уже не правительство, а секвестр. Программа МВФ снимает часть этого давления ценой двух лет обязательной консолидации.</p>
          </>
        ),
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы знаете, как выглядит выход из самого трудного сценария игры: жёсткие деньги и бюджет вместе, быстро вверх и вслед за ожиданиями вниз, пока держится мандат. Последний модуль курса — о политике: что бывает, когда экономика идёт плохо слишком долго.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'society', depth: 'deep', icon: Users,
    title: 'Общество: семь групп вместо одного рейтинга',
    summary: 'Кто на самом деле стоит за рейтингом, чего требуют лидеры групп и что бывает, когда группа уходит в оппозицию.',
    pins: ['approval', 'politicalTension', 'govTrust', 'unemployment'],
    steps: [
      {
        title: 'Рейтинг — это сумма групп',
        lever: null, runsQuarter: false,
        body: ({ economy }) => (
          <>
            <p>Рейтинг власти ({Math.round(economy.approval)} из 100) — не одна цифра на всю страну, а взвешенная сумма поддержки семи групп: пенсионеров, рабочих, бюджетников, молодёжи, бизнеса, регионов и силовиков. Самые весомые — пенсионеры и рабочие, по пятой части рейтинга; силовиков меньше всех, но их роль особая.</p>
            <p>У каждой группы свои интересы. Пенсионерам важны цены и индексация, рабочим — работа и реальные зарплаты, бизнесу — налоги, ставка и предсказуемость, молодёжи — работа и свободы без войны, бюджетникам — зарплаты и деньги на школы и больницы, регионам — трансферты и стройки, силовикам — оборона и порядок.</p>
            <p>Поэтому одно и то же решение одних радует, а других злит. Рост без инфляции нравится почти всем, а вот сокращение соцрасходов или повышение налогов бьёт по конкретным группам — и рейтинг падает не «вообще», а за счёт тех, кого задели. Вкладка «Общество» в партии показывает поддержку каждой группы и что её двигает.</p>
          </>
        ),
      },
      {
        title: 'Коалиция и оппозиция',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Группа с поддержкой от 50 входит в коалицию власти. Ниже 35 — уходит в оппозицию и начинает действовать, у каждой по-своему:</p>
            <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
              <li>пенсионеры выходят на улицы и приходят на выборы активнее всех — их недовольство сильнее всего бьёт по итогу голосования;</li>
              <li>рабочие бастуют — проседают выпуск и экспорт;</li>
              <li>бизнес выводит капитал и откладывает инвестиции — растёт премия за риск;</li>
              <li>молодёжь протестует и уезжает — растёт напряжённость, страна теряет рабочие руки;</li>
              <li>бюджетники и регионы бастуют и саботируют — падает доверие к государству;</li>
              <li>силовики ропщут в казармах — и риск переворота растёт в разы даже при терпимом общем рейтинге.</li>
            </ul>
            <p>Группы помнят. Пенсионная реформа, мобилизация или разгон протестов остаются в памяти группы на несколько кварталов, так что одно резкое решение может тянуть поддержку вниз ещё долго.</p>
          </>
        ),
      },
      {
        title: 'Требования лидеров',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>У каждой группы есть лидер: председатель Союза пенсионеров, лидер профсоюзов, глава Союза промышленников, начальник Генштаба и другие. Когда поддержка группы опускается ниже 42, её лидер может выдвинуть требование: проиндексировать пенсии, поднять зарплаты бюджетникам, дать денег на оборону и так далее.</p>
            <p>Ответить нужно в следующем квартале — на вкладке «Общество» или прямо в карточке требования. Вариантов три:</p>
            <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
              <li><b>уступить</b> — стоит бюджетных денег, зато поддержка группы заметно растёт;</li>
              <li><b>пообещать</b> — дешевле и немного успокаивает сразу, но через год, если обещание так и осталось словами, группа вспомнит его и спросит строже;</li>
              <li><b>отказать</b> — бесплатно, но поддержка падает, а напряжение растёт.</li>
            </ul>
            <p>Промолчать тоже можно, но это сочтут отказом. Новое требование приходит не чаще раза в несколько кварталов, так что каждое стоит того, чтобы подумать.</p>
          </>
        ),
      },
      {
        title: 'Решения президента делят общество',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Указы президента почти всегда кого-то радуют, а кого-то злят. Сделка с элитами нравится бизнесу, регионам и силовикам, но злит молодёжь и рабочих. Антикоррупционная кампания — наоборот. Силовое подавление протестов успокаивает силовиков, но молодёжь запомнит его надолго. Санкции радуют силовиков и бьют по бизнесу, вступление в торговый блок — ровно наоборот.</p>
            <p>Играя за ЦБ или Минфин, вы общество напрямую не ведёте, но оно отвечает на ваши цифры: инфляция злит пенсионеров и бюджетников, безработица — рабочих и молодёжь, высокая ставка и налог на прибыль — бизнес, урезанные выплаты и госрасходы — пенсионеров, бюджетников и регионы, а доля обороны в бюджете — предмет спора с силовиками. Подсказка у ползунка показывает, каким группам понравится новое значение, а каким нет. Смотрите, кто из групп ближе всего к оппозиции, — ему и будет больнее всего от следующего решения.</p>
          </>
        ),
      },
      {
        title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => <p>Теория этого модуля пройдена. Следующий модуль откроется в программе курса.</p>,
      },
    ],
  },
  {
    id: 'politics', depth: 'deep', icon: Flag,
    title: 'Политический режим: от рейтинга до переворота',
    summary: 'Как провальная политика может стоить не только выборов, но и самой демократии.',
    pins: ['approval', 'politicalTension', 'govTrust', 'quartersToElection'],
    steps: [
      {
        title: 'Рейтинг власти и выборы',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Рейтинг власти — не просто цифра для галочки. Раз в {CONFIG.election.cycle} кварталов проходят выборы, и их итог решает, продолжаете ли вы партию. Для премьер-министра, президента и главы Минфина почти любое поражение заканчивает игру; для Центробанка — только разгромное, ниже 35 из 100.</p>
            <p>Сейчас рейтинг {Math.round(economy.approval)} из 100, до выборов {economy.quartersToElection} кв. Рейтинг реагирует на всё сразу: рост, безработицу, инфляцию, доверие — и реагирует медленно, с задержкой в несколько кварталов, а не мгновенно.</p>
          </>
        ),
      },
      {
        title: 'Обещания и карта областей',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>За несколько кварталов до выборов начинается кампания, и страна получает от вас три обещания — не лозунги, а числа: удержать инфляцию ниже такой-то, не поднимать долг выше такого-то, снизить безработицу до такой-то. У урны их проверяют арифметикой: рядом с каждым написано, что сейчас и что было обещано. Сдержанные добавляют голоса, несдержанные отнимают.</p>
            <p>Итог приходит не одной цифрой на всю страну, а картой из семи областей. Доля голосов за действующую власть складывается из двух вещей: структурной склонности области — столица традиционно голосует против власти, село за неё — и того, как области живётся сейчас. Область, которой хуже среднего по стране, отворачивается сильнее, поэтому одна и та же средняя цифра выглядит на карте по-разному, и видно, чем именно недовольны там, где недовольны.</p>
            <p>За четыре квартала до голосования на карте появляется слой «Опросы»: прогноз по каждой области с погрешностью ±2,5 пункта и метка — колеблется, склоняется к одной из сторон, надёжная или потеряна. Каждый квартал у президента четыре штаба кампании, и каждый стоит денег бюджета. Штаб в колеблющейся области сдвигает её заметно, в надёжной или потерянной — почти никак, а второй и третий штаб в той же области дают меньше первого. Поэтому решение — кого убеждать, а кого списать: вложенное копится до самого дня голосования.</p>
            <p>При несвободном режиме выборы рисуют, но знать правду власти всё равно нужно: вместо опросов на карте каждый квартал есть «Закрытый замер» — настоящая поддержка по областям рядом с официальной цифрой. Погрешность шире: при авторитаризме ±5, при тоталитаризме ±8 пунктов — люди боятся отвечать.</p>
            <p>Рейтинг власти — это взвешенная сумма поддержки семи групп общества: пенсионеров, рабочих, бизнеса, силовиков, бюджетников, молодёжи и регионов. Всё это видно на вкладке «Общество». У каждой группы свои интересы, лидер и память: пенсионная реформа бьёт по пенсионерам и нравится бизнесу, и те и другие помнят её годами. Карточка каждого решения президента показывает, кто за, а кто против. Группы от 50 — коалиция власти; ниже 35 — оппозиция, и её лидеры переходят к делу: пенсионеры выходят на улицы и голосуют активнее всех, рабочие бастуют, бизнес выводит капитал, молодёжь протестует и уезжает. Потерянные силовики делают военный переворот возможным даже при терпимом рейтинге, а лояльные почти его исключают. Области голосуют как те, кто в них живёт: без рабочих отстанет Кузнецк, без бизнеса — Златоград. Лидер группы, которая уходит к оппозиции, приходит с требованием: уступить — дорого, но надолго; пообещать — дёшево, но через год обещание обернётся разочарованием; отказать — группа запомнит. У ползунков соцвыплат, госрасходов, налога на прибыль, ставки и долей бюджета подписано, какой группе нравится выбранное значение.</p>
            <p>При авторитарном и тоталитарном режиме карта меняется до неузнаваемости: ровные высокие проценты почти везде. Это не поддержка, а её изображение — такие выборы считают голоса, а не решают исход.</p>
          </>
        ),
      },
      {
        title: 'Стройки и события в областях',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Карта — не только табло. У каждой области есть своя большая стройка по его характеру: метро в Велеграде, глубоководный порт в Янтарске, электростанция в Рудногорских горах, ирригация в Приреченской области, железная дорога на Боровец. Запускает её Минфин, а живой президент — поверх него, прямо на карте.</p>
            <p>Стройка идёт несколько кварталов и всё это время стоит денег — это госинвестиции сверх ползунка, они добавляют спрос, дефицит и инфраструктуру. Пока идёт работа, в области спокойнее. Достроенная навсегда снижает его напряжение — а значит, и прибавляет голоса там, — и даёт свой эффект: порт — экспорт, электростанция — дешёвую энергию и меньшую инфляцию, модернизация заводов — производительность. Одновременно — не больше трёх строек, и ни одной, пока страна без доступа к рынку.</p>
            <p>Области сами подбрасывают задачи: забастовка шахтёров, засуха, авария в порту, паника вкладчиков, закрытие завода, митинг у правительства, лесные пожары. Событие вспыхивает на карте, и ответить нужно в следующем квартале. У каждого варианта своя цена: щедрый ответ стоит денег и успокаивает область, дешёвый экономит бюджет, жёсткий гасит проблему силой и копит напряжение в стране. Промолчать тоже можно — тогда сработает вариант «переждать», и он подписан заранее.</p>
          </>
        ),
      },
      {
        title: 'Пресс-конференция: рейтинг против доверия',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Раз в квартал вам задают один вопрос — об итогах квартала, о ценах, о безработице или о долге. Платят за ответ не деньгами: показать результаты в лучшем свете — прибавка к рейтингу и потеря доверия, признать проблемы честно — ровно наоборот. Уход от ответа тоже не бесплатен.</p>
            <p>Здесь и становится видна разница между двумя похожими цифрами. Рейтинг покупается словами, доверие — только делами, и чем сильнее слова расходятся с ценами в магазине, тем меньше стоит следующая прибавка к рейтингу.</p>
            <p>Режим переписывает и сам вопрос. Там, где пресса подконтрольна, об обвинениях оппозиции не спрашивают — спрашивают о зарубежных оценках, а увольнения называют оптимизацией штата. Варианты ответа и их последствия при этом те же: меняются слова, а не выбор.</p>
          </>
        ),
      },
      {
        title: 'Цена непопулярных решений',
        lever: 'incomeTaxRate', minDelta: 5, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Поднимите подоходный налог минимум на 5 п.п. — способ профинансировать что угодно, который никогда не проходит бесследно для доверия. Сейчас ставка {pctFmt(economy.incomeTaxRate)}, доверие к правительству {Math.round(economy.govTrust)} из 100.</p>
            <p>Один квартал почти не изменит рейтинг — эффект слабый и с лагом. Но представьте это решение, повторённое из квартала в квартал: именно так рейтинг доходит до по-настоящему опасных значений, а не одним резким обвалом.</p>
          </>
        ),
      },
      {
        title: 'Политическое напряжение',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Помимо рейтинга, в настоящей партии копится ещё один, менее заметный счётчик — политическое напряжение. Оно растёт от провального рейтинга, войны и от любого активного кризиса экономики (банковского, долгового, валютного — какого угодно): страна в кризисе — это прямое политическое давление, а не только статистика.</p>
            <p>Сейчас напряжение {Math.round(economy.politicalTension)} из 100, режим — «{(POLITICAL_REGIME_INFO[economy.politicalRegime] || {}).label}». Когда оно переваливает за порог, демократия сменяется конфликтом парламента и президента, затем — при неудачном стечении обстоятельств — авторитаризмом и тоталитаризмом. Причём подавление само подпитывает напряжение: авторитарный режим копит недовольство даже в тихие кварталы, просто медленнее.</p>
          </>
        ),
      },
      {
        title: 'Переворот вместо капитуляции',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Разгромное поражение на выборах не всегда означает мирный уход. Если рейтинг рухнул катастрофически и напряжение уже накопилось, действующая власть может не признать результат: выборы объявляются недействительными, парламент распущен, режим одним скачком становится авторитарным — вместо обычного экрана поражения.</p>
            <p>Небольшое поражение почти всегда заканчивается обычным проигрышем — переворот остаётся исходом именно катастрофы, а не любой неудачи на выборах.</p>
          </>
        ),
      },
      {
        title: 'Пропаганда и подконтрольная пресса',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Режим меняет не только цифры, но и то, как о них рассказывают. Авторитарные и особенно тоталитарные власти переписывают редакционную колонку газеты в пропаганду: провалы становятся эвфемизмами, а обычные цифры — поводом для победных реляций. Во время войны тон становится ещё жёстче — на первый план выходят враг и бдительность.</p>
            <p>Сама газета при этом визуально темнеет и остывает: чем дальше от демократии и чем выше напряжение, тем мрачнее бумага — это заметно раньше, чем прочитан хоть один заголовок. Ваша собственная панель управления при этом остаётся честной: искажается только то, что видит страна, а не то, что видите вы.</p>
          </>
        ),
      },
      {
        title: 'Курс пройден', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Это был последний модуль. Вы прошли всю цепочку курса: ставка и расходы → бюджет и долг → валютный курс → ожидания и доверие → риски и подготовка к кризису → выход из гиперинфляции → политический режим. В настоящей партии всё это работает одновременно, плюс бот на второй ветви власти со своим характером, случайные кризисы, выборы и оценка партии по выбранной цели.</p>
            <p>Готовы попробовать по-настоящему?</p>
          </>
        ),
      },
    ],
  },
];

/* ============================ ПРОВЕРКИ ПО МОДУЛЯМ ============================
   Теория и практика вынесены из тела модулей в отдельную карту: так видно весь
   набор проверок целиком, а сами модули не расползаются на полтысячи строк.
   Порядок внутри модуля один и тот же: сначала тест на понимание прочитанного,
   потом задача, где это понимание надо применить руками. */
const q = (question, options, answer, explain) => ({ q: question, options, answer, explain });

const MODULE_CHECKS = {
  basics: {
    quiz: {
      kind: 'quiz', title: 'Тест: ставка, расходы и лаг',
      body: () => <p>Три вопроса по пройденному. Неверный ответ ничем не грозит: под каждым вопросом появится разбор, и ответить можно заново.</p>,
      questions: [
        q('Центральный банк поднял ключевую ставку. Когда это сильнее всего скажется на инфляции?',
          ['Через один-два квартала', 'В том же квартале', 'Ровно через год, не раньше', 'Никогда: ставка на цены не влияет'], 0,
          'Между решением и ценами стоит цепочка: ставка → стоимость кредита → спрос → выпуск → цены. Каждое звено берёт время, поэтому основной эффект приходит с лагом в один-два квартала.'),
        q('Чем темп роста госрасходов отличается от ключевой ставки как решение?',
          ['Он накопительный: заданный темп действует каждый квартал, пока его не изменить',
            'Он действует ровно один квартал, потом обнуляется', 'Он влияет только на бюджет, но не на спрос',
            'Он меняет цены мгновенно, без лага'], 0,
          'Ставка — это уровень, который стоит там, где вы его поставили. Темп роста расходов — это скорость: пока он положительный, расходы растут каждый квартал, и стимул накапливается сам собой.'),
        q('Вы подняли ставку, а инфляция в том же квартале не снизилась. Что разумнее сделать?',
          ['Подождать: эффект ещё не дошёл до цен', 'Немедленно поднять ставку ещё раз, вдвое сильнее',
            'Вернуть ставку обратно — она не работает', 'Одновременно нарастить госрасходы'], 0,
          'Реакция на отсутствие мгновенного эффекта — самая частая ошибка. Догоняющее ужесточение накладывается на первое, когда оно наконец доходит, и экономика получает двойной удар уже в рецессии.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: остудить перегрев',
      pins: ['inflation', 'outputGap', 'unemployment', 'gdp'],
      goalLabel: 'Инфляция ≤ 6.0% и разрыв выпуска ≤ 1.0%',
      body: () => (
        <>
          <p>Ситуация задана заранее: экономика перегрета — выпуск заметно выше потенциала, инфляция разогналась, ожидания поползли вверх. У вас два рычага из первого модуля и шесть кварталов.</p>
          <p>Помните про лаг: то, что вы поставите сейчас, дойдёт до цен через квартал-другой. Если задача не выйдет — можно откатить её к началу и попробовать иначе.</p>
        </>
      ),
      // перегрев задаётся через сам выпуск: разрыв — величина производная, её
      // подмена ничего бы не изменила, модель пересчитала бы его в тот же квартал
      setup: (e) => ({ gdp: e.potentialGdp * 1.03, inflation: 8.6, coreInflation: 8.0,
        inflationExpectations: 6.6, unemployment: 4.0, keyRate: 5.5 }),
      levers: ['keyRate', 'govSpending'], maxQuarters: 6,
      goal: ({ economy }) => economy.inflation <= 6 && economy.outputGap <= 1.0,
      goalText: ({ economy }) => `Сейчас инфляция ${pctFmt(economy.inflation)}, разрыв выпуска ${fmtSignedPct(economy.outputGap)}.`,
      hint: 'Ставку в такой ситуации поднимают сразу и заметно, а не по четверти пункта: пока вы добавляете понемногу, ожидания успевают вырасти. И проверьте темп госрасходов — пока он в плюсе, бюджет подогревает спрос каждый квартал.',
    },
  },

  budget: {
    quiz: {
      kind: 'quiz', title: 'Тест: доходы, расходы, долг',
      questions: [
        q('Ставку НДС подняли на 3 п.п. Почему доходы бюджета выросли слабее, чем можно было ожидать?',
          ['Часть активности ушла в тень, и база сборов сузилась', 'НДС не влияет на доходы бюджета',
            'Доходы всегда растут ровно пропорционально ставке', 'Собранное автоматически идёт на погашение долга'], 0,
          'Собираемость зависит от ставки: чем она выше сверх привычного уровня, тем выгоднее уходить в тень. Именно поэтому у налоговых сборов есть потолок, за которым повышение ставки уже уменьшает поступления.'),
        q('Что такое государственный долг в этой модели?',
          ['Накопленные за годы дефициты бюджета', 'Разница между экспортом и импортом',
            'Деньги, которые государство должно центральному банку по ставке', 'Сумма всех налогов за год'], 0,
          'Дефицит — поток за квартал, долг — накопленный запас. Поэтому один хороший квартал долг почти не меняет, а несколько лет дефицита меняют сильно.'),
        q('Почему долг измеряют в процентах ВВП, а не в деньгах?',
          ['Так видно нагрузку на экономику, которая этот долг обслуживает',
            'Так цифра выглядит меньше', 'В деньгах его посчитать невозможно',
            'Потому что кредиторы дают в долг проценты, а не деньги'], 0,
          'Один и тот же долг в деньгах — катастрофа для маленькой экономики и мелочь для большой. Отношение к ВВП как раз и показывает, чем страна способна этот долг обслуживать.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: свести бюджет',
      goalLabel: 'Дефицит не глубже 3.5% ВВП',
      body: () => (
        <>
          <p>Вам достался бюджет с дырой под 7% ВВП: предшественник опустил НДС и налог на прибыль намного ниже разумного уровня, а расходы оставил как были. Задача — довести дефицит до 3.5% ВВП или лучше за шесть кварталов.</p>
          <p>Рычагов четыре: два налога и два темпа расходов. Все работают по-разному, и у каждого своя цена — в том числе та, о которой был весь модуль: выше ставка не значит больше сборов.</p>
        </>
      ),
      // баланс в setup задаётся явно: он производный и пересчитается в первом же
      // квартале, но без него шапка показывала прежние -3.6% и спорила с условием
      setup: { vatRate: 10, profitTaxRate: 13, budgetBalancePctGdp: -6.6 },
      pins: ['budgetBalancePctGdp', 'revenuePctGdp', 'debtToGdp', 'shadowShare'],
      levers: ['vatRate', 'profitTaxRate', 'govSpending', 'transfers'], maxQuarters: 6,
      goal: ({ economy }) => economy.budgetBalancePctGdp >= -3.5,
      goalText: ({ economy }) => `Сейчас баланс ${fmtSignedPct(economy.budgetBalancePctGdp)} ВВП, долг ${pctFmt(economy.debtToGdp)}, обслуживание ${pctFmt(economy.interestToRevenue)} доходов.`,
      hint: 'Начните с налогов: они здесь заниженные, и возврат к нормальным ставкам закрывает бо́льшую часть дыры за один квартал. Но не увлекайтесь — выше определённого уровня ставка начинает кормить тень, а не бюджет, и сборы падают. Расходы — это темпы роста: чтобы они реально сокращались, темп должен уйти в минус, а не просто до нуля.',
    },
  },

  fx: {
    quiz: {
      kind: 'quiz', title: 'Тест: курс, резервы, интервенции',
      questions: [
        q('Курс в модели вырос со 100 до 130. Что это значит?',
          ['Национальная валюта ослабла', 'Национальная валюта укрепилась',
            'Резервы выросли на 30%', 'Инфляция снизилась на 30%'], 0,
          'Курс здесь — сколько национальной валюты стоит иностранная. Чем больше число, тем дешевле национальная валюта и тем дороже импорт, который сразу же попадает в цены.'),
        q('ЦБ продаёт валюту из резервов, чтобы поддержать курс. В чём главное ограничение?',
          ['Резервы конечны, и рынок это видит', 'Продажа валюты запрещена при плавающем курсе',
            'Интервенции не влияют на курс', 'Каждая продажа снижает ключевую ставку'], 0,
          'Интервенции работают, пока у ЦБ есть чем интервенировать. Когда резервы подходят к концу, защита курса рушится разом — и девальвация выходит резче, чем была бы без защиты.'),
        q('Как повышение ключевой ставки действует на курс?',
          ['Укрепляет: активы в национальной валюте становятся привлекательнее для капитала',
            'Ослабляет: дорогой кредит душит экспорт', 'Никак: ставка и курс не связаны',
            'Зависит только от цены на сырьё'], 0,
          'Высокая ставка притягивает капитал, и приток укрепляет валюту. Поэтому ставка и интервенции на покупку валюты тянут курс в разные стороны — и итог зависит от того, что сильнее.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: остановить девальвацию',
      goalLabel: 'Курс ≤ 126 при резервах ≥ 150',
      body: () => (
        <>
          <p>Валюта резко ослабла, а импортируемая инфляция разгоняет цены. Нужно вернуть курс к 126 или крепче — и не спалить при этом резервы ниже 150.</p>
          <p>Два рычага тянут курс в одну сторону, но платите вы за них разным: ставка — ростом, интервенции — резервами.</p>
        </>
      ),
      setup: { exchangeRate: 132, reserves: 205, inflation: 8.2, inflationExpectations: 6.5, riskPremium: 2.6, keyRate: 6 },
      levers: ['keyRate', 'fxIntervention'], maxQuarters: 8,
      goal: ({ economy }) => economy.exchangeRate <= 126 && economy.reserves >= 150,
      goalText: ({ economy }) => `Сейчас курс ${fmt1(economy.exchangeRate)}, резервы ${fmtMoney(economy.reserves)}.`,
      hint: 'Одними интервенциями курс не удержать: тающие резервы рынок читает как слабость, премия за риск растёт — и валюта слабеет быстрее, чем её успевают выкупать. Основой защиты делают ставку, а интервенциями лишь сглаживают, иначе резервов не хватит до конца задачи.',
    },
  },

  expectations: {
    quiz: {
      kind: 'quiz', title: 'Тест: ожидания и доверие',
      questions: [
        q('Почему инфляционные ожидания важнее текущей цифры инфляции?',
          ['Их закладывают в цены и зарплаты уже сейчас, и они сбываются сами',
            'Их публикует статистика раньше, чем инфляцию', 'Они входят в ВВП',
            'Ожидания влияют только на курс валюты'], 0,
          'Ожидания — это механизм, а не прогноз. Если все ждут роста цен, продавцы поднимают цены заранее, а работники требуют индексации — и инфляция становится высокой независимо от того, что было её первопричиной.'),
        q('ЦБ поднял цель по инфляции с 4% до 6%. Что произойдёт с доверием к нему?',
          ['Оно упадёт: цель, которую можно подвинуть, перестаёт быть якорем',
            'Оно вырастет: цель стала реалистичнее', 'Ничего не изменится',
            'Доверие вырастет, но только при высокой ставке'], 0,
          'Ценность цели ровно в том, что она не двигается. Один раз подвинув её под факт, ЦБ показывает, что подвинет и в следующий раз, — и ожидания перестают цепляться за объявленную цифру.'),
        q('Доверие к ЦБ упало. Как его вернуть?',
          ['Последовательно действовать в объявленную сторону несколько кварталов подряд',
            'Объявить новую, более амбициозную цель', 'Один раз резко поднять ставку и сразу отпустить',
            'Перестать публиковать цель по инфляции'], 0,
          'Доверие теряется за квартал, а возвращается годами и только делами. Разовый рывок с быстрым разворотом читается как паника и доверие не восстанавливает.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: вернуть ожидания к якорю',
      goalLabel: 'Ожидания ≤ 6.5% при инфляции ≤ 6.0%',
      body: () => (
        <>
          <p>Ожидания сорвались с якоря, доверие к ЦБ на дне, инфляция почти 10%. Это самая дорогая ситуация в модели: пока ожидания высоко, любая ставка работает хуже, чем должна была бы.</p>
          <p>Рычаг один — ключевая ставка, кварталов девять. Цель по инфляции трогать нельзя: она и так уже подвинута. Доверие к ЦБ будет восстанавливаться дольше самих ожиданий — это нормально, оно всегда идёт последним.</p>
        </>
      ),
      setup: { inflation: 9.6, coreInflation: 9.0, inflationExpectations: 8.8, cbCredibility: 30, inflationTarget: 4, keyRate: 6.5 },
      levers: ['keyRate'], maxQuarters: 9,
      goal: ({ economy }) => economy.inflationExpectations <= 6.5 && economy.inflation <= 6,
      goalText: ({ economy }) => `Сейчас ожидания ${pctFmt(economy.inflationExpectations)}, доверие ${Math.round(economy.cbCredibility)} из 100, инфляция ${pctFmt(economy.inflation)}.`,
      hint: 'Доверие растёт, только пока реальная ставка выше нейтральной и политика не мечется. Поставьте ставку заметно выше ожиданий — и не трогайте её несколько кварталов подряд: постоянство здесь и есть инструмент.',
    },
  },

  crisis: {
    quiz: {
      kind: 'quiz', title: 'Тест: буферы и скорая помощь',
      questions: [
        q('Чем норматив достаточности капитала отличается от инъекции ликвидности?',
          ['Норматив — буфер, который ставят заранее; ликвидность — скорая помощь по факту',
            'Это одно и то же разными словами', 'Норматив помогает в кризис, а ликвидность — до него',
            'Норматив увеличивает объём кредита в экономике'], 0,
          'Норматив капитала работает годами и стоит роста: банки кредитуют осторожнее. Ликвидность спасает от разрыва платежей здесь и сейчас, но ничего не меняет в устойчивости системы.'),
        q('Зачем панель рисков, если есть сами показатели?',
          ['Она показывает, где копится опасность, до того как та станет кризисом',
            'Она заменяет собой отчёт по бюджету', 'Она предсказывает точную дату кризиса',
            'Она нужна только при игре за Минфин'], 0,
          'Кризис в модели — не случайность, а порог, к которому показатели подходят постепенно. Риски и есть способ увидеть это приближение за несколько кварталов.'),
        q('Норматив капитала подняли на 2 п.п. Какова плата за это решение?',
          ['Банки выдают меньше кредита, и рост замедляется', 'Растёт инфляция',
            'Падают резервы центрального банка', 'Никакой платы нет — это бесплатная страховка'], 0,
          'Каждый пункт норматива — это капитал, который банк держит вместо того, чтобы выдать в кредит. Устойчивость всегда покупается за темп роста, и вопрос лишь в том, по какой цене вы её берёте.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: вытащить банки',
      pins: ['bankingRisk', 'bankCapitalAdequacy', 'bankNPL', 'bankLiquidity'],
      goalLabel: 'Банковский риск ≤ 45 и ликвидность банков ≥ 58',
      body: () => (
        <>
          <p>Банковская система в стрессе: просрочка растёт, ликвидность на исходе, риск в красной зоне. Задача — вывести систему из опасной зоны за шесть кварталов.</p>
          <p>Три рычага: норматив капитала, прямые вливания ликвидности и ключевая ставка. Один из них помогает быстро, другой — надолго, третий двигает всю экономику сразу.</p>
        </>
      ),
      setup: { bankNPL: 8.4, bankLiquidity: 36, bankingRisk: 72, financialStability: 42, bankCapital: 118, creditVolume: 1450 },
      levers: ['liquidity', 'capitalRequirement', 'keyRate'], maxQuarters: 6,
      goal: ({ economy }) => economy.bankingRisk <= 45 && economy.bankLiquidity >= 58,
      goalText: ({ economy }) => `Сейчас банковский риск ${Math.round(economy.bankingRisk)} из 100, ликвидность ${Math.round(economy.bankLiquidity)}, просрочка ${pctFmt(economy.bankNPL)}.`,
      hint: 'Ликвидность возвращается быстро и от прямых вливаний. С нормативом капитала в разгар стресса осторожнее: он лечит систему вдолгую, но прямо сейчас заставляет банки сжимать кредит, а сжатие кредита ухудшает просрочку.',
    },
  },

  stabilization: {
    quiz: {
      kind: 'quiz', title: 'Тест: стабилизационная программа',
      questions: [
        q('Инфляция 30%, ожидания 27%, ставка 24%. Почему поднимать ставку на 0,5 п.п. за квартал не работает?',
          ['Реальная ставка остаётся отрицательной: шаги отстают от ожиданий, деньги продолжают обесцениваться',
            'Работает, просто нужно больше времени',
            'Ставка вообще не влияет на инфляцию',
            'Потому что курс валюты важнее ставки'], 0,
          'Реальная ставка — это ставка минус ожидания. При ожиданиях 27% ставка 24,5% всё ещё даёт минус: держать деньги невыгодно, и от них избавляются. Программа начинается там, где реальная ставка становится положительной с запасом.'),
        q('ЦБ поднял ставку до 35% при ожиданиях 27%, а Минфин одновременно раздал выплаты и нарастил дефицит. Что с доверием к программе?',
          ['Копится втрое медленнее: одна денежная опора без бюджетной рынок не убеждает',
            'Копится так же быстро — важна только ставка',
            'Растёт быстрее: выплаты поддерживают спрос',
            'Не меняется'], 0,
          'Бюджет, который требует денег, обесценит любую ставку, — это рынок помнит. Поэтому программа держится на двух опорах сразу, а курс — лишь ускоритель.'),
        q('Инфляция вернулась к цели, ставка всё ещё 30%. Что делать?',
          ['Снижать ставку вслед за ожиданиями — иначе реальная ставка взлетит и рецессия углубится',
            'Держать ставку, пока не вырастет рейтинг',
            'Поднять ещё, чтобы закрепить успех',
            'Отпустить курс и больше ничего не менять'], 0,
          'После победы ожидания падают, и та же номинальная ставка означает всё более высокую реальную. Держать её — вторая классическая ошибка стабилизации.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: остановить цены',
      pins: ['inflation', 'inflationExpectations', 'stabilizationCred', 'approval'],
      goalLabel: 'Инфляция ≤ 7% при сохранённой демократии',
      body: () => (
        <>
          <p>Стартовые условия сценария «Гиперинфляция»: цены растут на 34% в год, ожидания 27%, доверие к ЦБ разрушено, долг дорогой. У правительства есть мандат спасения — несколько кварталов терпения.</p>
          <p>Восемь кварталов и три рычага: ставка, госзакупки и выплаты. Задача — вернуть инфляцию хотя бы к 7%, пока страна ещё демократия.</p>
        </>
      ),
      setup: () => ({ ...(SCENARIOS.find((sc) => sc.id === 'hyperinflation') || {}).overrides }),
      levers: ['keyRate', 'govSpending', 'transfers'], maxQuarters: 8,
      goal: ({ economy }) => economy.inflation <= 7 && economy.politicalRegime === 'democracy',
      goalText: ({ economy }) => `Сейчас инфляция ${pctFmt(economy.inflation)}, ожидания ${pctFmt(economy.inflationExpectations)}, доверие к программе ${Math.round((economy.stabilizationCred || 0) * 100)} из 100, режим — «${(POLITICAL_REGIME_INFO[economy.politicalRegime] || {}).label}».`,
      hint: 'Ставку — сразу на 3 пункта выше того, что сейчас выше: инфляции или ожиданий, — и дальше вслед за ними. Госзакупки сократить: без бюджетной опоры доверие копится втрое медленнее. Постепенность здесь и есть ошибка.',
    },
  },
  politics: {
    quiz: {
      kind: 'quiz', title: 'Тест: рейтинг, напряжение, режим',
      questions: [
        q('От чего в первую очередь зависит рейтинг власти?',
          ['От реальных доходов, безработицы и инфляции', 'Только от размера госдолга',
            'От числа кварталов у власти', 'От характера бота на второй ветви власти'], 0,
          'Рейтинг считается из того, что человек чувствует на себе: растут ли зарплаты быстрее цен, есть ли работа, насколько цены выше цели. Долг сюда попадает косвенно — через то, чем за него платят.'),
        q('Что происходит с политическим напряжением при силовом подавлении протеста?',
          ['Сразу падает, но потом возвращается больше, чем было',
            'Исчезает окончательно', 'Не меняется', 'Растёт сразу и продолжает расти'], 0,
          'Подавление убирает симптом, а не причину. В модели у него есть и мгновенный минус к напряжению, и растянутый плюс: подавленное недовольство никуда не девается, оно копится.'),
        q('Вы обещали не поднимать долг выше 35% ВВП, а к выборам он 36.2%. Что будет с обещанием?',
          ['Оно не сдержано: у урны обещания проверяются числом, а не намерением',
            'Оно сдержано: разница меньше двух процентных пунктов',
            'Оно не учитывается, если долг рос из-за кризиса',
            'Оно превращается в новое обещание на следующий срок'], 0,
          'Каждое обещание — это порог и направление: «не выше» или «не ниже». Рядом с ним на панели написано и то, что сейчас, и то, что было обещано, — чтобы к выборам не оставалось сомнений, на какой вы стороне порога.'),
        q('Авторитарный режим объявил выборы. Чем они отличаются от выборов при демократии?',
          ['Результат предрешён, и настоящей гонки с неопределённостью для рынков нет',
            'Ничем', 'Они всегда заканчиваются поражением власти',
            'Они отменяют политическое напряжение'], 0,
          'При авторитарном и тоталитарном режиме выборы в модели не проигрываются: они считают голоса, а не решают исход. Зато напряжение продолжает копиться, и рано или поздно оно выходит другим путём.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: удержать власть',
      goalLabel: 'Рейтинг ≥ 47 и напряжение ≤ 25',
      pins: ['approval', 'politicalTension', 'inflation', 'unemployment'],
      body: () => (
        <>
          <p>Рейтинг рухнул, безработица высокая, инфляция двузначная, напряжение растёт. До выборов ещё есть время, но если ничего не менять, страна дойдёт до них с конфликтом ветвей власти.</p>
          <p>Девять кварталов и три рычага. Разгонять экономику выплатами легко — сложнее сделать это, не добив цены, потому что инфляция бьёт по рейтингу не слабее безработицы.</p>
        </>
      ),
      setup: (e) => ({ approval: 33, unemployment: 8.2, inflation: 10.2, coreInflation: 9.4, inflationExpectations: 8.0,
        politicalTension: 46, gdp: e.potentialGdp * 0.975, keyRate: 7 }),
      levers: ['keyRate', 'transfers', 'govSpending'], maxQuarters: 9,
      goal: ({ economy }) => economy.approval >= 47 && economy.politicalTension <= 25,
      goalText: ({ economy }) => `Сейчас рейтинг ${Math.round(economy.approval)} из 100, напряжение ${Math.round(economy.politicalTension)}, безработица ${pctFmt(economy.unemployment)}, инфляция ${pctFmt(economy.inflation)}.`,
      hint: 'Рейтинг растёт от реальных доходов — от зарплат за вычетом инфляции — и от занятости. Одной жёсткой ставкой его не поднять: цены вы собьёте, но безработица останется высокой, и рейтинг встанет. Спрос придётся поддержать бюджетом одновременно с тем, как ставка гасит инфляцию.',
    },
  },
  society: {
    quiz: {
      kind: 'quiz', title: 'Тест: общество',
      questions: [
        q('Общий рейтинг власти 52, но силовики на 30. Чем это опасно?',
          ['Силовики в оппозиции: риск переворота растёт даже при терпимом рейтинге',
            'Ничем, пока рейтинг выше 50', 'Упадёт экспорт', 'Пенсионеры не придут на выборы'], 0,
          'Рейтинг — взвешенная сумма групп, и у силовиков вес маленький. Но их уход в оппозицию бьёт не по рейтингу, а по устойчивости власти: вероятность переворота растёт в разы.'),
        q('Лидер пенсионеров требует индексации, а бюджет в дефиците. Вы обещаете, но ничего не делаете. Что будет?',
          ['Сначала поддержка немного подрастёт, а примерно через год упадёт сильнее',
            'Поддержка вырастет и останется', 'Ничего', 'Пенсионеры сразу уйдут в оппозицию'], 0,
          'Обещание — дешёвый ответ с отложенной ценой: группа помнит его, и невыполненное через несколько кварталов бьёт больнее, чем прямой отказ.'),
        q('Вы — ЦБ и поднимаете ставку, чтобы сбить инфляцию. Кто из групп это почувствует первым?',
          ['Бизнес: дорогой кредит; зато пенсионеры выиграют от замедления цен',
            'Никто: общество реагирует только на решения президента', 'Только силовики', 'Только молодёжь'], 0,
          'Общество отвечает на цифры любой ветви власти. Высокая ставка злит бизнес, а победа над инфляцией радует пенсионеров и бюджетников — ровно такие компромиссы и видны на вкладке «Общество».'),
      ],
    },
  },
};

/* ============================ КУРС ИНВЕСТОРА ============================
   Песочница здесь — настоящий терминал: те же инструменты, те же котировки, тот же
   расчёт позиций в конце квартала. Учить торговле на упрощённой имитации смысла нет,
   потому что весь смысл роли в том, как ведут себя настоящие цены. */
const TRADER_MODULES = [
  {
    id: 'tr_market', depth: 'surface', icon: TrendingUp, sandbox: 'trader',
    title: 'Рынок: цена, позиция, результат',
    summary: 'Из чего складывается цена инструмента и почему результат бывает и до продажи.',
    pins: ['stockIndex', 'bondIndex', 'keyRate', 'inflation'],
    steps: [
      {
        title: 'Вы больше не управляете экономикой',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>За инвестора у вас нет ни ставки, ни бюджета: ставку ведёт бот-ЦБ, бюджет — бот-Минфин, а вы живёте внутри их решений. Ваши инструменты — цены, а не рычаги.</p>
            <p>Цены здесь не случайны. Индекс акций считается из прибылей компаний и ставки <Term k="discount">дисконтирования</Term>: дешёвые деньги и растущая прибыль поднимают его, дорогие деньги и риск — опускают. Облигации живут от доходности: выросла доходность — упала цена уже выпущенной бумаги.</p>
            <p>Сейчас индекс акций {fmt1(economy.stockIndex)}, ключевая ставка {pctFmt(economy.keyRate)}. Нажмите «Далее», чтобы посмотреть один квартал со стороны.</p>
          </>
        ),
      },
      {
        kind: 'practice', title: 'Позиция, средняя цена и прибыль',
        goalLabel: 'Открыть любую позицию и завершить квартал',
        body: () => (
          <>
            <p>Купить инструмент — значит открыть <b>позицию</b>. Пока она открыта, её результат называют нереализованным: он меняется каждый квартал вместе с ценой и превращается в деньги только при закрытии.</p>
            <p>Средняя цена входа — та, по которой вы в среднем набрали позицию. Всё, что выше неё, — прибыль; всё, что ниже, — убыток.</p>
            <p>Про это проще один раз увидеть, чем прочитать: выберите любой инструмент в терминале ниже, нажмите «Купить / <Term k="long">лонг</Term>» и завершите квартал. На графике инструмента появится пунктирная линия с подписью <b>«ваша средняя»</b> — это и есть ваша средняя цена входа; по расстоянию до линии цены сразу видно, где вы стоите.</p>
            <p>Есть и обратная сторона: <Term k="short">шорт</Term>. Это ставка на падение — вы продаёте занятый актив, чтобы выкупить его дешевле. Заработать в лонге можно сколько угодно, а потерять — не больше вложенного: ниже нуля цена не падает. В шорте наоборот: заработок ограничен, а убыток растёт вместе с ценой. До бесконечности он, впрочем, не дорастёт — раньше сработает <Term k="margincall">маржин-колл</Term> и закроет позицию принудительно.</p>
          </>
        ),
        levers: [], maxQuarters: 4,
        goal: (c) => Object.values((c.book && c.book.pos) || {}).some((q) => Math.abs(q) > 1e-9),
        goalText: (c) => {
          const open = Object.entries((c.book && c.book.pos) || {}).filter(([, q]) => Math.abs(q) > 1e-9);
          return open.length
            ? `Открыто позиций: ${open.length}. Пунктир «ваша средняя» уже на графике выбранного инструмента.`
            : 'Открытых позиций пока нет — купите что-нибудь в терминале ниже.';
        },
        hint: 'Любой инструмент подойдёт: кнопка «Купить / лонг» под карточкой, сумма сделки задаётся ползунком ниже. После покупки посмотрите на график — пунктир с подписью «ваша средняя» и есть ваша средняя цена входа.',
      },
    ],
  },
  {
    id: 'tr_leverage', depth: 'deep', icon: Zap, sandbox: 'trader',
    title: 'Плечо, обеспечение и маржин-колл',
    summary: 'Почему заёмные деньги увеличивают не доход, а размер ошибки.',
    pins: ['stockIndex', 'volatilityIndex', 'keyRate', 'lendingRate'],
    steps: [
      {
        title: 'Что такое плечо',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Плечо — это торговля на заёмные деньги. Купив на 3 млн при своих 1 млн, вы получаете втрое больший результат и от роста, и от падения: <Term k="leverage">плечо</Term> умножает не доход, а размер вашей ошибки.</p>
            <p>За заёмные деньги брокер берёт ставку по кредитам — сейчас {pctFmt(economy.lendingRate)} годовых. Она капает каждый квартал независимо от того, права позиция или нет.</p>
            <p>Уровень обеспечения — это ваш капитал, делённый на стоимость позиций. Пока он выше поддерживающего уровня, всё в порядке. Как только он падает ниже — брокер закрывает часть позиций сам, по рынку, не спрашивая вас. Это и есть <Term k="margincall">маржин-колл</Term>.</p>
          </>
        ),
      },
      {
        title: 'Фьючерсы: плечо, встроенное в инструмент',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>У <Term k="futures">фьючерса</Term> плечо не нужно брать отдельно — оно уже внутри. Вы вносите гарантийное обеспечение, а результат считается от полного номинала контракта: при плече 8:1 движение цены на 3% меняет ваши деньги на 24%.</p>
            <p>Поэтому в списке инструментов у фьючерсов подписано «плечо N:1»: это не реклама доходности, а предупреждение о том, во сколько раз быстрее закончится ваш счёт.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'tr_portfolio', depth: 'deep', icon: Scale, sandbox: 'trader',
    title: 'Портфель: диверсификация и бенчмарк',
    summary: 'Зачем держать несколько разных активов и с чем сравнивать свой результат.',
    // подсказка практики «обогнать индекс» говорит про растущую экономику и
    // ставку ниже нейтральной — без outputGap/rateGap в закреплённых
    // показателях это не увидеть нигде на экране практики
    pins: ['stockIndex', 'bondIndex', 'exchangeRate', 'inflation', 'outputGap', 'rateGap'],
    steps: [
      {
        title: 'Активы ведут себя по-разному',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Смысл диверсификации не в том, чтобы купить побольше разного, а в том, чтобы держать активы, которые реагируют на одно и то же событие по-разному.</p>
            <p>Повышение ставки бьёт по акциям и по длинным облигациям одновременно — они не диверсифицируют друг друга. А вот денежный рынок на повышении ставки, наоборот, начинает приносить больше, инфляционные линкеры защищают от роста цен, мировые акции живут чужим циклом, а золото дорожает при девальвации.</p>
            <p>Есть и инструмент, который реагирует не на цикл экономики, а на один конкретный риск: своп на дефолт (CDS) в группе «Производные» торгуется по суверенному спреду — премии за риск гособлигаций в базисных пунктах. Индекс акций может расти вместе с экономикой, а CDS одновременно дорожать, если рынок отдельно считает, что Минфин не удержит долг под контролем, — это ставка на платёжеспособность государства, а не на выпуск или спрос.</p>
          </>
        ),
      },
      {
        title: 'С чем сравнивать результат',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>«Заработал 8% за год» само по себе ничего не значит. Если индекс за это время вырос на 15% — вы отстали от рынка, и проще было купить индекс целиком. Если инфляция была 12% — вы потеряли покупательную способность, несмотря на плюс на счёте.</p>
            <p>Поэтому в панели портфеля результат показан сразу тремя способами: номинальный, реальный (за вычетом инфляции) и относительно индекса. На графике инструмента индекс можно наложить прямо поверх цены — расхождение линий и есть ваше опережение или отставание.</p>
          </>
        ),
      },
    ],
  },
];

/* ============================ КУРС ПРЕЗИДЕНТА ============================ */
const PRESIDENT_MODULES = [
  {
    id: 'pr_capital', depth: 'surface', icon: Crown, sandbox: 'president',
    title: 'Политический капитал и кадры',
    summary: 'Власть без ползунков: чем президент платит и через кого действует.',
    pins: ['politicalCapital', 'approval', 'politicalTension', 'keyRate'],
    steps: [
      {
        title: 'У президента нет ни одного ползунка',
        lever: null, runsQuarter: true,
        body: ({ economy }) => (
          <>
            <p>Ни ставки, ни налогов, ни расходов: ЦБ и Минфин ведут боты со своими характерами. Вы влияете на экономику только через людей, которых назначаете, указания, которые они могут не выполнить, и реформы, которые окупятся не в этот срок.</p>
            <p>Единственный ваш ресурс — <Term k="polcapital">политический капитал</Term>, сейчас {Math.round(economy.politicalCapital)} из 100. Он копится рейтингом и ростом, тает в кризисах и при беспорядках, и у него есть равновесие: накопить на одну большую реформу можно, на все сразу — нет.</p>
          </>
        ),
      },
      {
        title: 'Кадры и указания',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Назначение — самый медленный и самый долгий по эффекту инструмент: характер главы ЦБ определяет реакцию на инфляцию на годы вперёд, характер министра финансов — на что и в каком объёме тратится бюджет.</p>
            <p>У смены главы ЦБ есть отдельная цена. Чем меньше человек проработал, тем сильнее досрочная отставка бьёт по доверию к денежной политике и по премии за риск: рынок читает её однозначно — независимость центрального банка заканчивается там, где начинается администрация.</p>
            <p>Указание — быстрый инструмент, но ведомство может отказать. Шанс зависит от того, насколько просьба соответствует ситуации, от характера руководителя и от политического режима: чем меньше в стране институтов, тем меньше у ведомства возможности сказать «нет» — и тем дешевле рынок оценивает его подпись.</p>
          </>
        ),
      },
      {
        title: 'Дипломатия: между бездействием и войной',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Отдельная группа указов — внешняя политика: экономическое давление или сближение с другой страной, без единого выстрела. Санкции против торгового партнёра греют рейтинг сплочением почти сразу, но подорожавший импорт и осторожность инвесторов остаются на годы — а поскольку это разовый скачок цен, а не устойчивый спрос, здравомыслящий ЦБ реагирует на него мягче, чем на обычную инфляцию.</p>
            <p>Вступление в торговый блок работает в обратную сторону: капитал дешевеет, премия за риск падает — но часть регуляторных решений придётся согласовывать с блоком, а не принимать в одиночку. Оба указа доступны, только пока страна не воюет: экономическое давление теряет смысл рядом с настоящим.</p>
            <p>Если до войны всё же дойдёт, воевать придётся на карте. Как вести операцию, что делать с новыми землями, как заключать мир и отбиваться от реванша — в отдельном модуле «Война, мир и реванш».</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'pr_reforms', depth: 'deep', icon: Hammer, sandbox: 'president',
    title: 'Реформы: платить сейчас, получать потом',
    summary: 'Единственные решения в игре, которые двигают потенциал, а не спрос.',
    pins: ['potentialGrowth', 'approval', 'politicalCapital', 'gdp'],
    steps: [
      {
        title: 'Спрос и потенциал — разные вещи',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Всё, чем занимаются ЦБ и Минфин, — это управление спросом: ставка и бюджет решают, насколько загружена экономика относительно своих возможностей. Сами возможности — потенциальный ВВП — от них почти не зависят.</p>
            <p>Потенциал определяется четырьмя вещами: капиталом, рабочей силой, человеческим капиталом и производительностью. Двигать их умеют только структурные реформы, и это единственный способ сделать страну богаче, а не просто разогнать её на пару лет.</p>
          </>
        ),
      },
      {
        title: 'Горизонт и цена',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>У каждой реформы одинаковая форма: рейтинг платится сразу и целиком, эффект приходит годами. Реформа рынка труда разворачивается два года, пенсионная — три, реформа образования — четыре, и полный эффект пенсионной вы увидите уже в следующий срок, возможно, не свой.</p>
            <p>Отсюда главный конфликт роли: реформа, которая нужнее всего, обычно и самая непопулярная, а расплачиваться за неё рейтингом придётся до ближайших выборов. Нацпроект по инфраструктуре — исключение: он платит не политическим капиталом, а бюджетом, и потому виден быстрее.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'pr_regime', depth: 'deep', icon: Gavel, sandbox: 'president',
    title: 'Устройство власти и её цена',
    summary: 'Роспуск парламента, авторитарный поворот и что за это платит экономика.',
    pins: ['politicalTension', 'approval', 'riskPremium', 'politicalCapital'],
    steps: [
      {
        title: 'Лестница режимов',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Режим меняется не по вашему желанию, а по накопленному напряжению: демократия → конфликт ветвей власти → авторитаризм → тоталитаризм. Напряжение растёт от низкого рейтинга, кризисов, безработицы и инфляции — и, отдельно, от самих репрессий.</p>
            <p>Но президент может пройти по этой лестнице и сознательно: распустить парламент указом. Тогда режим становится авторитарным сразу, и — в отличие от чрезвычайного положения, введённого кризисом, — обратно сам уже не отыграется. Вернуть парламент можно только отдельным решением, и стоит оно дороже.</p>
          </>
        ),
      },
      {
        title: 'За что платит экономика',
        lever: null, runsQuarter: true,
        body: () => (
          <>
            <p>Концентрация власти реально работает: политического капитала становится больше, ведомства перестают отказывать, выборы больше не проигрываются. Всё это — настоящие преимущества, и именно поэтому соблазн существует.</p>
            <p>Платит за них экономика, и по всем каналам сразу: <Term k="riskpremium">премия за риск</Term> растёт, доверие бизнеса падает, капитал уходит, прямые инвестиции сокращаются. А напряжение никуда не девается — репрессии его копят, и подавленный протест возвращается больше, чем был.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'pr_war', depth: 'deep', icon: Swords, sandbox: 'president',
    title: 'Война, мир и реванш',
    summary: 'Операция на карте, новые земли, мирный договор, реванш Норланда и оборона от нападения.',
    pins: ['approval', 'politicalCapital', 'debtToGdp', 'riskPremium'],
    steps: [
      {
        title: 'Наступление: приказ на карте',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Военную операцию против Норланда начинает только президент, и воевать приходится на карте. Целей три: Ледяной перевал у границы, Копи Хальвика и столица Нордхольм. К Нордхольму не подойти, пока не взят перевал.</p>
            <p>Приказ — цель и способ — действует, пока вы его не смените. Способов четыре: <b>штурм</b> быстро двигает фронт, но стоит денег и потерь; <b>осада</b> медленнее и дешевле; <b>удержание</b> почти не двигает фронт, зато гасит контратаки; <b>перемирие</b> закрывает войну по нынешней линии фронта.</p>
            <p>Сила армии зависит от доли обороны в бюджете и от поддержки в стране. Война не кончается по расписанию: её заканчивает перемирие или капитуляция Норланда, которая наступает, если взят Нордхольм вместе с остальными целями. Чем дольше идёт война, тем сильнее устаёт страна, а санкции за нападение никуда не деваются.</p>
          </>
        ),
      },
      {
        title: 'Новые земли',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Когда война кончается, взятые земли остаются за вами: граница на карте сдвигается, новые области прибавляют рабочую силу, а копи — экспорт руды.</p>
            <p>Но это полноценные области со своей лояльностью, и стартует она низкой. Пока лояльность ниже 35, там действуют партизаны: подрывы на перевале, саботаж на копях, подполье в Нордхольме. Программа интеграции стоит денег и прибавляет около 6 пунктов за квартал; стройка в области и мягкие ответы на её события тоже помогают. С 50 область считается интегрированной и начинает голосовать на выборах.</p>
          </>
        ),
      },
      {
        title: 'Мирный договор',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Перемирие останавливает стрельбу, но не решает, чья это земля. После войны открываются переговоры, и договор собирается из условий: признание новой границы, поддержка Норландом снятия санкций, репарации, возврат части земель.</p>
            <p>У каждого условия своя цена. Норланд соглашается, если общая цена не выше позиции страны за столом, а позиция тает, пока вы тянете время. Вернуть землю — самый сильный козырь: за возврат Нордхольма можно выторговать больше, чем за перевал.</p>
            <p>Непризнанная граница каждый квартал бьёт по экспорту и инвестициям и кормит реваншизм Норланда. Признанная почти его гасит — поэтому признание обычно важнее репараций.</p>
          </>
        ),
      },
      {
        title: 'Реванш Норланда',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Пока новые земли у вас, Норланд копит реваншизм. Он растёт тем быстрее, чем больше областей вы удерживаете и чем больше в стране кризисов; признанная договором граница и сильная армия его сдерживают. Когда реваншизм подходит к 70, разведка предупреждает. На 100 Норланд нападает, чтобы вернуть своё.</p>
            <p>Каждый квартал войны реванша он бьёт по одной из новых областей, чаще всего там, где уже продвинулся или где новой власти меньше всего рады. Разведка сообщает, куда ждать удара, но иногда ошибается. Вы выбираете область и способ: <b>держать оборону</b> (удар по укреплённой области почти не продвинется), <b>контрудар</b> (дорого, зато отбрасывает противника и ломает его боевой дух) или <b>переговоры</b>. Выдохшийся Норланд сам просит мира, и тогда позиция страны за столом сильная.</p>
          </>
        ),
      },
      {
        title: 'Оборонительная война и бюджет на оборону',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>На страну может напасть и Республика Дешт: с юго-запада, по Приреченской и Боровской областям. Это тоже фронт на карте. Каждый квартал противник давит на одну из двух областей, и вы отдаёте тот же приказ: держать оборону там, где ждут удара, контрудар или перемирие. Если давление на область доходит до 100, она оккупирована, и там рушатся потребление и потенциал, пока её не отобьют (давление ниже 60).</p>
            <p>Воюет армия, а армию оплачивает Минфин. Президент может попросить министра финансов нарастить расходы на оборону. Если министр согласится, это обязательство на два года: бюджет не вернётся к прежней доле через квартал, как делал бы бот по привычке. Попросить может только президент. ЦБ бюджетом не распоряжается, и у него такой просьбы нет.</p>
          </>
        ),
      },
    ],
  },
];

/* Курс «Режимы игры»: не экономика, а то, как устроены сами режимы — вызов дня,
   «Своё дело» и сетевая партия. Модули независимы, практики в песочнице нет —
   практика здесь и есть сам режим. */
const MODES_MODULES = [
  {
    id: 'md_daily', depth: 'surface', icon: Calendar,
    title: 'Вызов дня',
    summary: 'Одна партия на всех: тот же пост, тот же кризис, те же случайности — и общая таблица.',
    pins: [],
    steps: [
      {
        title: 'Одна партия на всех',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Раз в сутки, в полночь по Москве, появляется новый вызов. Условия у всех одинаковые: пост (ЦБ, Минфин, президент или премьер, по кругу), стартовая ситуация (чаще всего кризис), сложность (по выходным — высокая), цель дня и характеры ботов.</p>
            <p>Случайные события тоже одни и те же: у вызова общее «зерно» случайностей. Поэтому разница в итоге — это разница в решениях, а не в удаче: если у соседа по таблице балл выше, он действительно сыграл лучше.</p>
          </>
        ),
      },
      {
        title: 'Как считается балл',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Партия длится {DAILY_QUARTERS} кварталов. Итог — среднее пяти оценок политики: стабильность, благосостояние, финансы, бюджет и потенциал. Оценка, которая совпадает с целью дня, считается дважды.</p>
            <p>Поражение до срока (отставка, переворот, дефолт) обрывает партию и делит итог пополам. Дотянуть до конца с посредственными цифрами выгоднее, чем блестяще начать и рухнуть.</p>
            <p>Пытаться можно сколько угодно раз. В таблице у каждого одна строка — лучший результат за день, и более слабая попытка его не затирает. Таблица открывается кнопкой «Таблица дня» в меню.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'md_tycoon', depth: 'surface', icon: Factory,
    title: 'Своё дело',
    summary: 'Тайкун в реальном времени: цепочки производства, исследования, менеджеры — внутри живой экономики страны.',
    pins: [],
    steps: [
      {
        title: 'Другая игра на той же экономике',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>«Своё дело» — отдельный режим. Здесь вы не управляете страной, а строите компанию внутри неё. Страну ведут боты: ставка, налоги, кризисы, выборы и война идут сами и меняют спрос, цены и кредит для вашего бизнеса. Что происходит в стране, видно на вкладке «Страна».</p>
            <p>Время идёт само: деньги приходят каждую секунду, а раз в минуту проходит квартал страны с налогами, процентами и новостями. Пауза и скорость (½×, 1×, 2×, 4×) — в шапке.</p>
            <p>Начать можно с фермы, лавки или лесопилки. Задания вверху экрана ведут по первым шагам и дают деньги на рост.</p>
          </>
        ),
      },
      {
        title: 'Цепочки и склад',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Основа игры — цепочки: сырьё → переработка → магазин. Зерно с поля идёт на мельницу, мука — на хлебозавод, хлеб — в магазин. Чем дальше товар ушёл по цепочке, тем он дороже. Цеха в одной области экономят на перевозке.</p>
            <p>Своё сырьё выгоднее покупного: лавка может сразу продавать хлеб, но муку ей придётся покупать на рынке втридорога. Лишнее со склада продаётся или уходит на экспорт, а недостающее докупается. Следите, чтобы цеха не стояли без сырья, а склад не забивался готовым товаром.</p>
          </>
        ),
      },
      {
        title: 'Исследования, команда и продажа компании',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>В лаборатории — дерево исследований: новые здания и товары, скидки, финансовый отдел. «Школа управленцев» открывает первых менеджеров: управляющий улучшает здания, коммерческий директор ведёт склад и цены, главный технолог изучает исследования. «Совет директоров» добавляет директора по развитию, который строит сам, и финансового директора, который следит за долгом. Менеджеры получают зарплату, зато снимают с вас рутину.</p>
            <p>Пока вкладка закрыта, страна стоит на паузе, а предприятия работают без присмотра вполсилы, но не дольше трёх часов. Партию можно сохранить в слот на сервере и продолжить на другом устройстве.</p>
            <p>Выросшую компанию можно продать. Новое дело начнётся с нуля, но с репутацией: каждый её пункт даёт +10% ко всему.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'md_network', depth: 'surface', icon: Users,
    title: 'По сети и профиль',
    summary: 'Комнаты, места, профиль игрока и почему нельзя выйти и тут же зайти снова.',
    pins: [],
    steps: [
      {
        title: 'Комната и места',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>В сетевой партии ЦБ, Минфин и президент — разные люди на одной экономике. В режиме «рынок» за одной страной следят два трейдера. Комнату создаёт один игрок, остальные входят по коду или по ссылке. Открытую комнату можно найти и в списке, без кода.</p>
            <p>Квартал считается, когда ход сдали все живые игроки. Свободные места ведут боты. Если игрок пропал, через пять минут квартал пройдёт и без него.</p>
          </>
        ),
      },
      {
        title: 'Профиль игрока',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>По сети играют только с профилем. Он заводится за минуту: логин, пароль и имя, которое видят партнёры. Кнопка профиля — в правом верхнем углу главного меню. В профиле — значок, статистика (комнаты, сыгранные кварталы, выходы из партий) и смена пароля.</p>
            <p>Место в комнате закрепляется за профилем. Вышедший игрок может вернуться не раньше чем через минуту и только на своё прежнее место, которое держится за ним десять минут. Сесть в одну комнату дважды нельзя. Кого создатель комнаты выгнал, того обратно не пустят.</p>
            <p>Профиль переносит и остальное: сохранения, достижения и пройденные курсы. Войдите в него на другом устройстве, и всё окажется там.</p>
          </>
        ),
      },
    ],
  },
];

/* Проверки курсов инвестора и президента. Практика здесь идёт не через ползунки,
   а через настоящий терминал и настоящую панель политического капитала — поэтому
   levers у этих задач пустой, а работа делается в самой песочнице. */
const COURSE_CHECKS = {
  tr_market: {
    quiz: {
      kind: 'quiz', title: 'Тест: цена и позиция',
      questions: [
        q('Центральный банк резко поднял ставку. Что произойдёт с индексом акций?',
          ['Скорее всего упадёт: будущие прибыли дисконтируются дороже',
            'Вырастет: высокая ставка — признак сильной экономики',
            'Не изменится: ставка влияет только на облигации',
            'Вырастет ровно на величину повышения ставки'], 0,
          'Цена акции — это будущие прибыли, приведённые к сегодняшнему дню. Чем выше ставка дисконтирования, тем меньше сегодня стоит та же самая будущая прибыль, поэтому индекс падает даже без изменения самих прибылей.'),
        q('Доходность облигаций выросла. Что стало с ценой уже выпущенной бумаги?',
          ['Упала', 'Выросла', 'Не изменилась', 'Зависит от инфляции, а не от доходности'], 0,
          'Купон у выпущенной бумаги фиксированный. Чтобы её доходность сравнялась с новой рыночной, цена должна упасть — и тем сильнее, чем длиннее бумага. Это и называется дюрацией.'),
        q('Что такое нереализованная прибыль по позиции?',
          ['Результат открытой позиции: он меняется каждый квартал и станет деньгами только при закрытии',
            'Прибыль, которую брокер удерживает до конца года',
            'Разница между вашей средней ценой и ценой покупки',
            'Прибыль от коротких позиций'], 0,
          'Пока позиция открыта, её результат — это переоценка, а не деньги. Он растёт и падает вместе с ценой, и зафиксировать его можно только сделкой в обратную сторону.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: обогнать безрисковую ставку',
      goalLabel: 'Прирост капитала не меньше 10% за шесть кварталов',
      body: ({ ctx }) => (
        <>
          <p>У вас {fmtMln(ctx.startValue)} и шесть кварталов. Задача — вырасти минимум на 10%.</p>
          <p>Просто пересидеть в деньгах не выйдет: денежный рынок и депозит дадут заметно меньше. Придётся выбрать, каким риском вы за эту разницу платите, — и терминал ниже настоящий, со всеми инструментами сразу.</p>
        </>
      ),
      levers: [], maxQuarters: 6,
      goal: (c) => c.value >= c.startValue * 1.10,
      goalText: (c) => `Сейчас капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} на старте — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%.`,
      hint: 'Посмотрите, что делает бот-ЦБ со ставкой: от неё зависит и денежный рынок, и облигации, и акции. Если ставка идёт вниз — выигрывают длинные облигации и акции; если вверх — денежный рынок и короткие бумаги. Плечо доступно, но и убыток оно множит на ту же величину.',
    },
  },

  tr_leverage: {
    quiz: {
      kind: 'quiz', title: 'Тест: плечо и обеспечение',
      questions: [
        q('Вы купили на 4 млн, имея 1 млн своих. Цена упала на 10%. Сколько вы потеряли от своего капитала?',
          ['40%', '10%', '4%', 'Ничего, пока позиция не закрыта'], 0,
          'Плечо 4:1 умножает движение цены на четыре. Падение на 10% от четырёх миллионов — это 0.4 млн, то есть 40% вашего собственного миллиона. Именно так позиции и заканчиваются раньше, чем рынок разворачивается.'),
        q('Что такое маржин-колл?',
          ['Брокер сам закрывает часть позиций, когда обеспечения перестаёт хватать',
            'Требование брокера продать всё до конца дня',
            'Комиссия за использование заёмных средств',
            'Автоматическое увеличение плеча при росте цены'], 0,
          'Это не предупреждение, а действие: закрытие происходит по рынку и в худший момент — когда цена уже упала. Поэтому уровень обеспечения смотрят до сделки, а не после.'),
        q('Чем фьючерс отличается от покупки актива с плечом?',
          ['Плечо в него уже встроено: вы вносите обеспечение, а результат считается от полного номинала',
            'Фьючерс нельзя потерять целиком', 'У фьючерса нет расчётов по кварталам',
            'Фьючерс не зависит от цены базового актива'], 0,
          'Экономически это то же плечо, только оформленное иначе. Разница практическая: у фьючерса плечо фиксированное и указано прямо в инструменте, так что «случайно» набрать его больше, чем собирались, сложнее.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: заработать на падающем рынке',
      goalLabel: 'Прирост не меньше 4% за шесть кварталов на падающем рынке',
      body: () => (
        <>
          <p>Ставка высокая и останется высокой, инфляция двузначная, акции уже упали и падать им есть куда. Цель скромная — плюс 4% — и в этом весь смысл: на таком рынке сохранить капитал уже работа.</p>
          <p>Просто сидеть в деньгах не выйдет: они не приносят ничего. Плечо в лонге здесь — самый быстрый способ закончить партию, зато есть инструменты, которым высокая ставка идёт на пользу.</p>
        </>
      ),
      setup: (e) => ({ keyRate: 12, inflation: 11.5, coreInflation: 10.5, inflationExpectations: 9,
        stockIndex: e.stockIndex * 0.92, riskPremium: 3.0, volatilityIndex: 34 }),
      levers: [], maxQuarters: 6,
      goal: (c) => c.value >= c.startValue * 1.04,
      goalText: (c) => `Капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} на старте — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%.`,
      hint: 'Денежный рынок при ставке 12% приносит примерно 3% за квартал и ничем не рискует. Инфляционные линкеры индексируются на сами цены. Короткие облигации почти не реагируют на движение ставки — в отличие от десятилетних.',
    },
  },

  tr_portfolio: {
    quiz: {
      kind: 'quiz', title: 'Тест: портфель и бенчмарк',
      questions: [
        q('Какая пара активов хуже всего диверсифицирует друг друга?',
          ['Акции и длинные облигации', 'Акции и денежный рынок',
            'Акции и инфляционные линкеры', 'Акции и мировые акции'], 0,
          'И акции, и длинные облигации падают от одного и того же — от роста ставки. Держать их вместе — значит дважды поставить на одно событие, хотя выглядит это как два разных инструмента.'),
        q('Ваш портфель вырос на 9% за год, индекс акций — на 14%, инфляция составила 11%. Как честно описать результат?',
          ['Вы отстали от рынка и потеряли покупательную способность',
            'Вы заработали 9% — это хороший результат', 'Вы обогнали рынок на 9%',
            'Реальный результат +9%, номинальный +14%'], 0,
          'Плюс на счёте не означает прибыли. Относительно индекса вы отстали на 5 п.п., а относительно цен потеряли около 2%: на те же деньги в конце года можно купить меньше, чем в начале.'),
        q('Зачем накладывать индекс на график инструмента?',
          ['Чтобы увидеть, обгоняет ваш инструмент рынок или просто едет вместе с ним',
            'Чтобы предсказать будущую цену', 'Чтобы уменьшить комиссию',
            'Чтобы посчитать уровень обеспечения'], 0,
          'Индекс приводится к стартовой цене инструмента, поэтому важно не то, где проходит его линия, а как она расходится с вашей. Совпали — вы просто купили рынок. Разошлись — вот это и есть ваш собственный результат.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: обогнать индекс',
      goalLabel: 'Портфель растёт быстрее индекса акций и не в минусе',
      body: () => (
        <>
          <p>Экономика на подъёме, ставка ниже нейтральной, спрос растёт — индекс акций в таких условиях сам по себе прибавит заметно за восемь кварталов. Купить сам индекс — доступно всем, и результат будет ровно такой же, как у рынка. Задача — обогнать его, а не просто оказаться в плюсе: на растущем рынке в плюс выйдет почти любая позиция, а вот обогнать сам рынок — уже вопрос выбора.</p>
          <p>Восемь кварталов. Побеждает не тот, кто угадал направление (тут его несложно угадать), а тот, кто держал то, что в этих условиях растёт быстрее широкого индекса.</p>
        </>
      ),
      // экономика на подъёме: индекс акций сам по себе прибавит около 20% за
      // восемь кварталов — просто пересидеть в безрисковых инструментах (денежный
      // рынок при такой ставке даёт не больше 8-10%) этот рубеж не возьмёт, и
      // «купить что угодно» перестаёт быть решением
      setup: (e) => ({ keyRate: 4, inflation: 3.4, coreInflation: 3.3, inflationExpectations: 3.6,
        outputGap: 1.6, businessConfidence: 64, riskPremium: 0.8, unemployment: Math.min(e.unemployment, e.nairu - 0.5) }),
      levers: [], maxQuarters: 8,
      goal: (c) => c.value > c.startValue
        && c.value / Math.max(0.001, c.startValue) >= c.economy.stockIndex / Math.max(0.001, c.start.stockIndex),
      goalText: (c) => `Портфель ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%, индекс ${fmtSigned1((c.economy.stockIndex / Math.max(0.001, c.start.stockIndex) - 1) * 100)}% за то же время.`,
      hint: 'Обогнать индекс на растущем рынке можно плечом на самом индексе или на отдельном секторе, который растёт быстрее рынка, — но тогда вы обгоните его и вниз, если подъём развернётся. Надёжнее — искать то, что в буме растёт сильнее широкого рынка: секторные фонды на пике цикла, мировые акции при крепнущей валюте.',
    },
  },

  pr_capital: {
    quiz: {
      kind: 'quiz', title: 'Тест: капитал, кадры, указания',
      questions: [
        q('Откуда у президента берётся политический капитал?',
          ['Он копится от рейтинга и роста экономики и тает в кризисах',
            'Он выдаётся фиксированной суммой раз в год', 'Он покупается за бюджетные деньги',
            'Он равен рейтингу власти'], 0,
          'Капитал — это следствие того, как идут дела: популярного президента в растущей экономике власть кормит сама. Отсюда и главная ловушка роли: когда рычаги нужнее всего, платить за них уже нечем.'),
        q('Президент меняет главу ЦБ, проработавшего два квартала из двенадцати. Что произойдёт?',
          ['Доверие к денежной политике заметно упадёт, премия за риск вырастет',
            'Ничего: назначение — обычная процедура', 'Вырастет согласованность политики',
            'Инфляция немедленно снизится'], 0,
          'Дело не в том, кто пришёл, а в том, как ушёл предыдущий. Досрочная отставка показывает рынку, что срок главы ЦБ ничего не значит, — и ожидания перестают верить его обещаниям, кто бы их ни давал.'),
        q('При каком режиме ведомство с наименьшей вероятностью откажет президенту?',
          ['При тоталитарном', 'При демократии', 'При конфликте ветвей власти',
            'Вероятность отказа от режима не зависит'], 0,
          'Возможность сказать «нет» — это и есть институт. Чем меньше институтов, тем послушнее ведомство и тем меньше стоит его подпись: рынок дисконтирует решения управляемого центробанка независимо от их содержания.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: сбить инфляцию чужими руками',
      pins: ['inflation', 'inflationExpectations', 'keyRate', 'politicalCapital'],
      goalLabel: 'Инфляция ≤ 6.3% — но ставку задаёте не вы',
      body: () => (
        <>
          <p>Инфляция под 10%, а во главе ЦБ сидит Голубь: он терпит рост цен ради занятости и ставку поднимать не спешит. Ключевой ставки у вас нет — есть кадры и указания.</p>
          <p>Шесть кварталов. Оба инструмента стоят политического капитала, и у каждого свои последствия помимо инфляции.</p>
        </>
      ),
      setup: () => ({ inflation: 9.8, coreInflation: 9.2, inflationExpectations: 8.2, keyRate: 5.5, cbTenure: 11 }),
      personas: { cb: 'dove' },
      levers: [], maxQuarters: 6,
      goal: (c) => shown1(c.economy.inflation) <= 6.3,
      goalText: (c) => `Инфляция ${pctFmt(c.economy.inflation)}, ставка ${pctFmt(c.economy.keyRate)}, ожидания ${pctFmt(c.economy.inflationExpectations)}.`,
      hint: 'Глава ЦБ отработал одиннадцать кварталов из двенадцати — смена почти плановая и обойдётся дёшево. Ястреб реагирует на инфляцию вдвое жёстче Голубя. Есть и быстрый путь — указание «решительно подавить инфляцию», но Голубь на него скорее всего ответит отказом.',
    },
  },

  pr_reforms: {
    quiz: {
      kind: 'quiz', title: 'Тест: реформы и горизонт',
      questions: [
        q('Чем структурная реформа отличается от снижения ставки?',
          ['Реформа двигает потенциал экономики, ставка — только загрузку имеющегося',
            'Реформа действует быстрее', 'Реформа не требует политического капитала',
            'Ставка влияет на потенциал, а реформа — на спрос'], 0,
          'Ставка и бюджет решают, работает ли экономика ниже или выше своих возможностей. Сами возможности — капитал, рабочая сила, человеческий капитал, производительность — меняются только реформами.'),
        q('Почему пенсионная реформа — самое дорогое решение в наборе?',
          ['Рейтинг падает сразу и целиком, а эффект приходит через три года',
            'Она стоит больше всего бюджетных денег', 'Она снижает потенциальный ВВП',
            'Она требует роспуска парламента'], 0,
          'Форма у всех реформ одна: платите сегодня, получаете потом. У пенсионной этот разрыв максимальный — и по величине удара по рейтингу, и по длине горизонта, на котором окупается расширение рабочей силы.'),
        q('Чем национальный проект по инфраструктуре отличается от остальных реформ?',
          ['За него платит бюджет — дефицитом и долгом, а не политический капитал',
            'Он не влияет на потенциал', 'Он действует мгновенно',
            'Его нельзя провести дважды'], 0,
          'Указ обязывает Минфин ускорить реальные госинвестиции на несколько лет. Инфраструктура и потенциал растут — вместе с дефицитом и долгом, считать который будет уже не президент.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: реформировать и удержаться',
      goalLabel: 'Две реформы за восемь кварталов при рейтинге ≥ 42',
      body: () => (
        <>
          <p>Провести реформу легко — сложно провести её и остаться у власти. Задача: объявить минимум две структурные реформы за восемь кварталов и подойти к концу с рейтингом не ниже 42.</p>
          <p>Капитала на всё сразу не хватит, и после непопулярной реформы рейтинг придётся чем-то чинить.</p>
        </>
      ),
      levers: [], maxQuarters: 8,
      goal: (c) => Object.keys(c.economy.reforms || {}).length >= 2 && shown0(c.economy.approval) >= 42,
      goalText: (c) => `Проведено реформ: ${Object.keys(c.economy.reforms || {}).length}. Рейтинг ${Math.round(c.economy.approval)}, капитал ${Math.round(c.economy.politicalCapital)}.`,
      hint: 'Начните с дешёвых и не самых болезненных: дерегулирование и судебная реформа стоят меньше и по рейтингу почти не бьют. Обращение к нации восстанавливает поддержку быстро — но работает тем хуже, чем сильнее слова расходятся с ценами.',
    },
  },

  pr_regime: {
    quiz: {
      kind: 'quiz', title: 'Тест: режим и его цена',
      questions: [
        q('Президент распустил парламент указом при спокойной экономике. Что будет дальше?',
          ['Режим станет авторитарным и сам обратно не вернётся',
            'Ничего не изменится, пока не вырастет напряжение',
            'Режим станет авторитарным на два квартала и вернётся',
            'Начнётся тоталитарный режим'], 0,
          'Чрезвычайное положение, введённое в кризис, снимается, когда кризис проходит. Осознанный роспуск — другое: власть, взятая указом, отдаётся только таким же указом, и стоит это дороже.'),
        q('Что происходит с политическим напряжением при авторитарном режиме?',
          ['У него появляется собственная подпитка: репрессии сами добавляют напряжения',
            'Оно перестаёт расти', 'Оно обнуляется при роспуске парламента',
            'Оно зависит только от инфляции'], 0,
          'Подавление убирает проявления недовольства, а не его причины. В модели у репрессивного режима есть постоянное слагаемое в напряжении — поэтому авторитаризм устойчив ровно до тех пор, пока экономика позволяет.'),
        q('Чем экономика расплачивается за концентрацию власти?',
          ['Премией за риск, доверием бизнеса, оттоком капитала и прямых инвестиций',
            'Только инфляцией', 'Ничем: это чисто политическое решение',
            'Ростом безработицы в первый же квартал'], 0,
          'Издержки идут не одним каналом, а сразу всеми и не мгновенно. Именно поэтому размен выглядит выгодным в квартале, когда его совершают, и невыгодным через несколько лет.'),
      ],
    },
    practice: {
      kind: 'practice', title: 'Практика: удержать страну, не распуская парламент',
      goalLabel: 'Напряжение ≤ 15 при работающем парламенте',
      body: () => (
        <>
          <p>Напряжение почти на пороге конфликта ветвей власти, рейтинг низкий, элиты нервничают. Самый быстрый выход — указ о роспуске парламента, и он вам доступен.</p>
          <p>Задача в том, чтобы обойтись без него: снять напряжение до 15 за шесть кварталов, сохранив парламент. Если распустите — задача считается проваленной.</p>
          <p>Само оно так низко не опустится: напряжение тянется к уровню, который задают рейтинг и экономика, а он сейчас куда выше пятнадцати. Придётся либо поднимать рейтинг, либо снимать напряжение напрямую.</p>
        </>
      ),
      setup: () => ({ politicalTension: 58, approval: 36, unemployment: 7.4, inflation: 8.4, coreInflation: 7.8 }),
      levers: [], maxQuarters: 6,
      goal: (c) => shown0(c.economy.politicalTension) <= 15 && !c.economy.parliamentDissolved && c.economy.politicalRegime !== 'authoritarian',
      goalText: (c) => `Напряжение ${Math.round(c.economy.politicalTension)}, рейтинг ${Math.round(c.economy.approval)}, режим — ${(POLITICAL_REGIME_INFO[c.economy.politicalRegime] || {}).label || c.economy.politicalRegime}.`,
      hint: 'Напряжение считается от рейтинга, кризисов, безработицы и инфляции — то есть чинится тем же, чем чинится экономика. Сделка с элитами снимает его быстро и прямо; силовое подавление — тоже, но потом возвращает больше, чем сняло.',
    },
  },
  pr_war: {
    quiz: {
      kind: 'quiz', title: 'Тест: война, мир и реванш',
      questions: [
        q('Почему к Нордхольму нельзя сразу отдать приказ о штурме?',
          ['Сначала нужно взять Ледяной перевал', 'Столицу можно брать только осадой',
            'Нордхольм штурмуют только после перемирия', 'Нужна доля обороны в бюджете не ниже 30%'], 0,
          'Перевал — ворота к столице: пока он у Норланда, до Нордхольма не дойти. Заодно взятый перевал облегчает следующие штурмы.'),
        q('Лояльность новой области 28. Что там происходит и что поможет?',
          ['Действуют партизаны; помогут программа интеграции, стройка и мягкие ответы на события',
            'Ничего: лояльность важна только на выборах', 'Область сразу вернётся Норланду',
            'Помогает только силовое подавление'], 0,
          'Ниже 35 в новых землях партизаны: подрывы, саботаж, подполье. Интеграция прибавляет около 6 пунктов за квартал, с 50 область интегрирована и голосует.'),
        q('Какое условие мирного договора сильнее всего гасит реваншизм Норланда?',
          ['Признание новой границы', 'Репарации', 'Поддержка снятия санкций', 'Затянуть переговоры'], 0,
          'Непризнанная граница каждый квартал кормит реваншизм и бьёт по экспорту и инвестициям. Признанная почти его останавливает, а вот затягивание переговоров только ослабляет позицию страны.'),
        q('Министр финансов согласился нарастить расходы на оборону. Что дальше?',
          ['Доля обороны держится на новом уровне два года, а не возвращается через квартал',
            'Расходы вырастут на один квартал', 'Ничего: Минфин всё равно вернёт бюджет по привычке',
            'Решение примет ЦБ'], 0,
          'Согласие — это обязательство на восемь кварталов: бот Минфина держит новую долю обороны и не откатывает её к своему обычному уровню. Попросить об этом может только президент.'),
      ],
    },
  },

  md_daily: {
    quiz: {
      kind: 'quiz', title: 'Тест: вызов дня',
      questions: [
        q('Почему у двух игроков в вызове дня случаются одни и те же события?',
          ['У вызова общее зерно случайностей: разница в итоге — это разница в решениях',
            'Сервер присылает события по сети', 'Это совпадение', 'События в вызове отключены'], 0,
          'Вызов дня — одна партия на всех, вплоть до случайных шоков. Поэтому таблица сравнивает решения, а не удачу.'),
        q('Вы блестяще провели восемь кварталов и проиграли на девятом. Что с баллом?',
          ['Итог делится пополам', 'Засчитывается как есть', 'Ставится ноль', 'Засчитывается лучший квартал'], 0,
          'Поражение до срока обрывает партию и делит итог пополам. Дотянуть до конца с посредственными цифрами выгоднее.'),
        q('Вторая попытка за день вышла хуже первой. Что будет в таблице?',
          ['Останется лучший результат', 'Запишется последняя попытка', 'Обе строки', 'Попытка не засчитается вовсе'], 0,
          'У каждого игрока в таблице одна строка — лучший результат за день.'),
      ],
    },
  },

  md_tycoon: {
    quiz: {
      kind: 'quiz', title: 'Тест: своё дело',
      questions: [
        q('Почему хлеб из своей муки выгоднее, чем из покупной?',
          ['Покупное сырьё на рынке дорогое, а своё обходится по себестоимости', 'Свой хлеб продаётся дороже',
            'Покупную муку облагают отдельным налогом', 'Разницы нет'], 0,
          'Магазину можно торговать и покупным товаром, но наценка съедается ценой рынка. Своя цепочка забирает маржу на каждом шаге.'),
        q('ЦБ резко поднял ставку. Как это скажется на вашей компании?',
          ['Кредит подорожает, а спрос может просесть', 'Никак: страна живёт отдельно',
            'Выручка сразу вырастет', 'Здания начнут строиться быстрее'], 0,
          'Экономика страны — фон вашей игры: ставка, кризисы и выборы меняют спрос, цены и стоимость кредита.'),
        q('Зачем продавать выросшую компанию?',
          ['Новое дело начнётся с репутацией: каждый пункт даёт +10% ко всему', 'Чтобы получить достижение и больше ничего',
            'Продажа закрывает режим', 'Чтобы вернуть стартовые деньги'], 0,
          'Продажа — это перезапуск с бонусом: чем дороже продали, тем больше репутации унесёте в следующее дело.'),
      ],
    },
  },

  md_network: {
    quiz: {
      kind: 'quiz', title: 'Тест: сеть и профиль',
      questions: [
        q('Вы вышли из сетевой партии. Когда и куда можно вернуться?',
          ['Через минуту и только на своё прежнее место', 'Сразу и на любое место',
            'Только после конца партии', 'Никогда'], 0,
          'Место закреплено за профилем: вернуться можно не раньше чем через минуту, и десять минут место держится именно за вами — другой игрок его не займёт.'),
        q('Что будет, если партнёр пропал и не сдаёт ход?',
          ['Через пять минут квартал пройдёт, за него решит бот', 'Партия остановится навсегда',
            'Его место сразу займёт бот насовсем', 'Квартал пройдёт без его рычагов, а он проиграет'], 0,
          'Квартал ждёт живых игроков, но не бесконечно: через пять минут за пропавшего решает бот, а место остаётся за ним.'),
      ],
    },
  },
};

/* ============================ ЭКЗАМЕНЫ ============================
   Экзамен — это отдельный модуль в конце курса: сначала теория по всему
   пройденному, потом одна задача, где взаимодействуют сразу несколько
   механизмов и однозначно правильного рычага уже нет. */
const EXAM_MODULES = [
  {
    id: 'policy_exam', depth: 'deep', icon: GraduationCap, isExam: true,
    title: 'Экзамен: экономическая политика',
    summary: 'Шесть вопросов по всему курсу и стагфляция напоследок.',
    pins: ['inflation', 'unemployment', 'gdpGrowth', 'debtToGdp'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Шесть вопросов по всем шести модулям сразу, а после них — задача, в которой ни один рычаг не работает в одну сторону.</p>
            <p>Как и в тестах модулей, ошибиться не страшно: разбор появится под каждым вопросом, а задачу можно перезапустить.</p>
          </>
        ),
      },
      {
        kind: 'quiz', title: 'Теория: весь курс',
        questions: [
          q('Экономика перегрета, инфляция 9%, бюджет в дефиците 6% ВВП. Какая пара решений последовательна?',
            ['Поднять ставку и сократить темп госрасходов',
              'Снизить ставку и нарастить выплаты',
              'Поднять ставку и одновременно нарастить госрасходы',
              'Ничего не делать: перегрев проходит сам'], 0,
            'При перегреве обе ветви политики должны тянуть в одну сторону. Если бюджет продолжает подогревать спрос, ЦБ придётся держать ставку выше — и за несогласованность заплатит выпуск.'),
          q('Что произойдёт с ценой десятилетней облигации, если ЦБ резко поднимет ставку?',
            ['Упадёт сильнее, чем цена двухлетней', 'Вырастет', 'Упадёт слабее, чем цена двухлетней',
              'Не изменится: длинные бумаги от ставки не зависят'], 0,
            'Чем длиннее бумага, тем сильнее её цена реагирует на изменение доходности. Это и есть дюрация — и именно поэтому в ожидании роста ставок уходят в короткие бумаги.'),
          q('Инфляционные ожидания 9% при цели 4%. Почему это дороже, чем просто высокая инфляция?',
            ['Ожидания закладываются в цены и зарплаты и делают инфляцию устойчивой',
              'Ожидания напрямую входят в расчёт ВВП',
              'Ожидания увеличивают государственный долг',
              'Ожидания влияют только на курс валюты'], 0,
            'Разовый скачок цен проходит сам. Сорванные ожидания превращают его в самоподдерживающийся процесс: чтобы его остановить, ставку приходится держать выше и дольше, а платит за это выпуск.'),
          q('Резервы тают, а курс продолжает слабеть. Что это чаще всего означает?',
            ['Защита курса одними интервенциями не работает: рынок видит конечность резервов',
              'Интервенции проводятся в неверную сторону',
              'Нужно ускорить продажу резервов', 'Курс скоро развернётся сам'], 0,
            'Интервенции работают, пока рынок верит, что резервов хватит. Как только видно дно, тающие резервы сами становятся аргументом против валюты — и премия за риск добавляет к девальвации больше, чем снимают интервенции.'),
          q('Банковский риск 70, ликвидность банков 35. Что делать в первую очередь?',
            ['Дать ликвидность: это скорая помощь, которая действует сразу',
              'Резко поднять норматив капитала', 'Поднять ключевую ставку',
              'Сократить государственные расходы'], 0,
            'Норматив капитала — профилактика на годы, и в разгар стресса он только заставляет банки сжимать кредит. Ликвидность закрывает разрыв платежей здесь и сейчас; укреплять буферы будете, когда система перестанет гореть.'),
          q('Рейтинг власти третий год ниже 35, инфляция двузначная, идут протесты. Что говорит модель?',
            ['Политическое напряжение растёт, и режим может сойти с демократической ветки',
              'Ничего: рейтинг влияет только на исход выборов',
              'Экономика автоматически стабилизируется',
              'Центральный банк потеряет независимость по закону'], 0,
            'Рейтинг — не только счётчик к выборам. Через политическое напряжение он выводит страну на лестницу режимов: конфликт ветвей власти, авторитаризм, тоталитаризм — и каждый шаг оплачивается премией за риск и оттоком капитала.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: стагфляция',
        pins: ['inflation', 'unemployment', 'outputGap', 'gdpGrowth'],
        goalLabel: 'Инфляция ≤ 6.5% и безработица ≤ 6.5% одновременно',
        body: () => (
          <>
            <p>Худшее сочетание из возможных: цены растут, а экономика при этом стоит. Ставка лечит одно и калечит другое, бюджет — ровно наоборот.</p>
            <p>Десять кварталов и четыре рычага. Однозначно правильного ответа здесь нет — есть последовательность, в которой рычаги применяют.</p>
          </>
        ),
        setup: (e) => ({ inflation: 11.4, coreInflation: 10.6, inflationExpectations: 8.6, unemployment: 7.8,
          gdp: e.potentialGdp * 0.972, keyRate: 7, cbCredibility: 42 }),
        levers: ['keyRate', 'govSpending', 'transfers', 'vatRate'], maxQuarters: 10,
        goal: (c) => shown1(c.economy.inflation) <= 6.5 && shown1(c.economy.unemployment) <= 6.5,
        goalText: (c) => `Инфляция ${pctFmt(c.economy.inflation)}, безработица ${pctFmt(c.economy.unemployment)}, разрыв выпуска ${fmtSignedPct(c.economy.outputGap)}.`,
        hint: 'Сначала цены, потом занятость: пока ожидания высоко, любой бюджетный стимул уходит в инфляцию, а не в выпуск. Сбейте инфляцию жёсткой ставкой, а когда ожидания опустятся — отпускайте её и поддерживайте спрос бюджетом.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => (
          <>
            <p>Вы прошли курс целиком: ставка и расходы, бюджет и долг, курс и резервы, ожидания и доверие, риски и буферы, политический режим — и свели всё это вместе в одной задаче без правильного ответа.</p>
            <p>Дальше два прикладных курса: за частного инвестора и за президента. Или сразу настоящая партия — там всё перечисленное работает одновременно.</p>
            <p>В настоящей партии прогресс автоматически сохраняется в этом браузере после каждого квартала — можно спокойно закрыть вкладку и продолжить позже с того же места.</p>
          </>
        ),
      },
    ],
  },
  {
    id: 'tr_exam', depth: 'deep', icon: GraduationCap, isExam: true, sandbox: 'trader',
    title: 'Экзамен: частный инвестор',
    summary: 'Теория по трём модулям и портфель на развороте ставки.',
    // подсказка практики говорит «ставка вдвое выше нейтральной» и «инфляция уже
    // у цели» — без rateGap/outputGap в закреплённых показателях это никак не
    // проверить и негде увидеть, а разрыв выпуска нужен, чтобы убедиться, что
    // сценарий про нормализацию ставки, а не про рецессию
    pins: ['keyRate', 'rateGap', 'inflation', 'outputGap', 'stockIndex', 'bondIndex'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => <p>Четыре вопроса и одна задача. В задаче важно не угадать направление рынка, а понять, какие инструменты в этих условиях работают.</p>,
      },
      {
        kind: 'quiz', title: 'Теория: рынок, плечо, портфель',
        questions: [
          q('Ставка идёт вниз третий квартал подряд. Какой инструмент выигрывает больше всех?',
            ['Длинные облигации', 'Денежный рынок', 'Короткие облигации', 'Депозит'], 0,
            'Чем длиннее бумага, тем сильнее растёт её цена при снижении доходности. Денежный рынок и депозит, наоборот, начинают приносить меньше — они живут текущей ставкой, а не переоценкой.'),
          q('Инфляция 14%, ваш портфель за год вырос на 9%. Что произошло с вашими деньгами?',
            ['Покупательная способность упала примерно на 4%',
              'Вы заработали 9%', 'Вы заработали 23%', 'Ничего не изменилось'], 0,
            'Реальный результат — это номинальный за вычетом инфляции. Плюс на счёте и прибыль — разные вещи, и различать их важнее всего именно в те годы, когда цены растут быстрее всего.'),
          q('Уровень обеспечения 28% при поддерживающем уровне терминала 25%. Что это значит?',
            ['Падение позиций примерно на 11% приведёт к принудительному закрытию',
              'У вас нет заёмных средств', 'Брокер закроет позиции прямо сейчас',
              'Можно безопасно увеличить плечо вдвое'], 0,
            'Запас до маржин-колла считается от текущего уровня к поддерживающему: (28 − 25) / 28 ≈ 11%. Три пункта запаса при высокой волатильности — это одно неудачное движение рынка, а не комфортная подушка.'),
          q('Что защищает портфель от девальвации национальной валюты?',
            ['Золото и мировые акции', 'Длинные государственные облигации',
              'Депозит в национальной валюте', 'Акции банков'], 0,
            'Активы, чья цена выражена в чужой валюте или в сырье, при ослаблении национальной валюты дорожают в местных деньгах. Депозит и облигации в национальной валюте, наоборот, обесцениваются вместе с ней.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: разворот ставки',
        goalLabel: 'Прирост капитала не меньше 12% за восемь кварталов',
        body: () => (
          <>
            <p>Инфляция уже сбита, но ставка ещё высокая: бот-ЦБ будет снижать её по мере того, как ожидания опускаются. Это самый предсказуемый момент рынка — и самый упускаемый.</p>
            <p>Восемь кварталов, цель — плюс 12%. Подумайте, что дорожает, когда ставка идёт вниз, и что перестаёт приносить.</p>
          </>
        ),
        setup: () => ({ keyRate: 12, inflation: 4.6, coreInflation: 4.4, inflationExpectations: 5.0, cbCredibility: 58 }),
        levers: [], maxQuarters: 8,
        goal: (c) => c.value >= c.startValue * 1.12,
        goalText: (c) => `Капитал ${fmtMln(c.value)} против ${fmtMln(c.startValue)} — ${fmtSigned1((c.value / Math.max(0.001, c.startValue) - 1) * 100)}%. Ставка ${pctFmt(c.economy.keyRate)}.`,
        hint: 'Когда инфляция уже у цели, а ставка вдвое выше нейтральной, ЦБ будет смягчать политику. От снижения ставки выигрывают длинные облигации и акции — а денежный рынок с каждым снижением приносит всё меньше.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => <p>Курс инвестора пройден: цена и позиция, плечо и обеспечение, портфель и <Term k="benchmark">бенчмарк</Term>. В настоящей партии добавятся случайные кризисы, опционы и казино — но правила те же.</p>,
      },
    ],
  },
  {
    id: 'pr_exam', depth: 'deep', icon: GraduationCap, isExam: true, sandbox: 'president',
    title: 'Экзамен: президент',
    summary: 'Теория по трём модулям и страна, которую надо вытащить чужими руками.',
    pins: ['politicalCapital', 'approval', 'politicalTension', 'inflation'],
    steps: [
      {
        title: 'Экзамен',
        lever: null, runsQuarter: false,
        body: () => <p>Четыре вопроса и одна задача. В задаче у вас по-прежнему нет ни одного ползунка — только люди, указания и реформы.</p>,
      },
      {
        kind: 'quiz', title: 'Теория: капитал, реформы, режим',
        questions: [
          q('Кризис, беспорядки, рейтинг 25. Что происходит с политическим капиталом?',
            ['Он уходит в минус и быстро обнуляется', 'Он растёт: в кризис власть концентрируется',
              'Он не меняется', 'Он превращается в рейтинг'], 0,
            'В этом и состоит ловушка роли: рычаги отключаются ровно тогда, когда они нужнее всего. Копить капитал имеет смысл до кризиса, а не во время него.'),
          q('Вы хотите поднять потенциальный ВВП. Что для этого нужно?',
            ['Структурная реформа: они единственные двигают потенциал',
              'Указание Минфину нарастить выплаты', 'Снижение ключевой ставки через указание ЦБ',
              'Обращение к нации'], 0,
            'Спрос можно двигать быстро, возможности экономики — нет. Труд, суды, дерегулирование, образование и инфраструктура и есть тот единственный канал, через который страна становится богаче, а не просто загруженнее.'),
          q('ЦБ выполнил ваше указание снизить ставку. Что при этом произошло помимо ставки?',
            ['Доверие к денежной политике снизилось: рынок увидел управляемый центробанк',
              'Выросла согласованность и доверие', 'Ничего: указание — обычная процедура',
              'Политическое напряжение выросло'], 0,
            'Цена управляемости — сама управляемость. Исполненное политическое указание обесценивает будущие обещания ЦБ, и возвращать ожидания к якорю потом придётся более высокой ставкой, чем понадобилась бы.'),
          q('Что отличает роспуск парламента указом от авторитарного поворота из-за кризиса?',
            ['Указ обратно сам не отыгрывается — власть придётся возвращать отдельным решением',
              'Указ не меняет политический режим', 'Указ не влияет на премию за риск',
              'Указ снижает политическое напряжение навсегда'], 0,
            'Чрезвычайное положение снимают, когда отпадают обстоятельства. Осознанный захват полномочий обстоятельствами не объясняется, и модель это различает: обратный ход возможен только как такое же осознанное решение.'),
        ],
      },
      {
        kind: 'practice', title: 'Экзаменационная задача: вытащить страну',
        goalLabel: 'Рейтинг ≥ 48, инфляция ≤ 6.5%, хотя бы одна реформа, парламент работает',
        body: () => (
          <>
            <p>Вам достаётся страна с двузначной инфляцией, высокой безработицей, низким рейтингом и Голубем во главе ЦБ. Десять кварталов.</p>
            <p>Ни ставки, ни бюджета у вас нет. Есть кадры, указания, реформы, публичная политика — и соблазн решить всё указом о роспуске парламента, который здесь считается провалом задачи.</p>
            <p>Вытащить экономику мало: за срок нужно ещё и оставить после себя хотя бы одну проведённую <Term k="reform">структурную реформу</Term>. Разбираться с ценами и при этом тратить капитал на то, что окупится после вас, — и есть работа президента.</p>
          </>
        ),
        setup: () => ({ inflation: 10.4, coreInflation: 9.8, inflationExpectations: 8.4, unemployment: 7.6,
          approval: 34, politicalTension: 44, keyRate: 6, cbTenure: 10, politicalCapital: 60 }),
        personas: { cb: 'dove', mof: 'populist' },
        levers: [], maxQuarters: 10,
        goal: (c) => shown0(c.economy.approval) >= 48 && shown1(c.economy.inflation) <= 6.5
          && Object.keys(c.economy.reforms || {}).length >= 1 && !c.economy.parliamentDissolved,
        goalText: (c) => `Рейтинг ${Math.round(c.economy.approval)}, инфляция ${pctFmt(c.economy.inflation)}, реформ ${Object.keys(c.economy.reforms || {}).length}, капитал ${Math.round(c.economy.politicalCapital)}.`,
        hint: 'Начните с ЦБ: с Голубем инфляцию не сбить, а без этого рейтинг не вырастет — реальные доходы съедаются ценами. Дальше рейтинг чинится тем же, чем чинится экономика, плюс обращением к нации, которое работает тем лучше, чем ближе цифры к обещаниям.',
      },
      {
        title: 'Экзамен сдан', isFinal: true, lever: null, runsQuarter: false,
        body: () => <p>Курс президента пройден: капитал и кадры, реформы и горизонт, режим и его цена. Осталось попробовать это в настоящей партии — там ещё случайные кризисы, выборы и бот, который вас не слушается.</p>,
      },
    ],
  },
];
/* Задача сверяется с теми же числами, которые видит игрок. Иначе «Рейтинг 48»
   при цели «≥ 48» читается как обман: под округлением там 47.6. */
const shown0 = (v) => Math.round(v);
const shown1 = (v) => Math.round(v * 10) / 10;

const EXAM_BY_ID = {};
EXAM_MODULES.forEach((m) => { EXAM_BY_ID[m.id] = m; });

// вставляем проверки перед финальным шагом каждого модуля
TUTORIAL_MODULES.forEach((m) => {
  const c = MODULE_CHECKS[m.id];
  if (!c) return;
  const fin = m.steps.pop();
  if (c.quiz) m.steps.push(c.quiz);
  if (c.practice) m.steps.push(c.practice);
  m.steps.push(fin);
});
/* Модули курсов инвестора и президента написаны без финального шага: он
   одинаковый по смыслу, поэтому дописывается здесь вместе с проверками. */
[...TRADER_MODULES, ...PRESIDENT_MODULES, ...MODES_MODULES].forEach((m) => {
  const c = COURSE_CHECKS[m.id];
  if (c && c.quiz) m.steps.push(c.quiz);
  if (c && c.practice) m.steps.push(c.practice);
  m.steps.push({
    title: 'Модуль пройден', isFinal: true, lever: null, runsQuarter: false,
    body: () => <p>Теория и практика этого модуля пройдены. Следующий модуль откроется в программе курса.</p>,
  });
});

/* ============================ ПРОГРАММА КУРСОВ ============================ */
const TUTORIAL_COURSES = [
  { id: 'policy', icon: Landmark, title: 'Экономическая политика',
    lede: 'Базовый курс: как ставка, бюджет, курс валюты и ожидания связаны между собой. Девять модулей — от ставки и бюджета до общества и политического режима, от поверхностного понимания к углублённому, каждый заканчивается тестом и практической задачей.',
    modules: [...TUTORIAL_MODULES, EXAM_BY_ID.policy_exam] },
  { id: 'trader', icon: TrendingUp, title: 'Частный инвестор',
    lede: 'Прикладной курс для роли трейдера: цена и позиция, плечо и маржин-колл, портфель и бенчмарк. Практика идёт в настоящем терминале, с настоящими котировками и расчётом позиций.',
    modules: [...TRADER_MODULES, EXAM_BY_ID.tr_exam] },
  { id: 'president', icon: Crown, title: 'Президент',
    lede: 'Прикладной курс для роли президента: политический капитал, кадры, указания ведомствам, структурные реформы, цена концентрации власти, а также война, мирный договор и реванш Норланда. Ни одного ползунка — только решения.',
    modules: [...PRESIDENT_MODULES, EXAM_BY_ID.pr_exam] },
  // режимы не выстраиваются в цепочку: каждый модуль открыт сразу (open)
  { id: 'modes', icon: Compass, title: 'Режимы игры', open: true,
    lede: 'Не экономика, а сами режимы: вызов дня и его таблица, «Своё дело» с цепочками и менеджерами, сетевая партия и профиль игрока. Короткие модули с тестами, открыты в любом порядке.',
    modules: MODES_MODULES },
];

/* Экран модуля. Три песочницы под три курса: политическая (ползунки ЦБ/Минфина),
   трейдерская (настоящий терминал и расчёт позиций) и президентская (панель
   политического капитала с двумя ботами). Общее у них одно — «Завершить квартал»
   двигает одну и ту же модель, поэтому практика в обучении считается ровно тем же
   кодом, что и настоящая партия, а не отдельной облегчённой имитацией. */
function TutorialModuleScreen({ module, isLastModule, onExit, onComplete, onGoNext, onGoHub, onStartRealGame,
  saved, onSaveProgress, completed }) {
  const sandbox = module.sandbox || 'policy';
  const initEconomy = useMemo(() => makeInitialEconomy(), [module.id]);
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState([{ q: 0, label: `${quarterLabel(1)} (старт)`, ...initEconomy }]);
  const [decisions, setDecisions] = useState(() => defaultDecisions(initEconomy));
  const [pendingImpulses, setPendingImpulses] = useState([]);
  const [eventCooldowns, setEventCooldowns] = useState({});
  const [quarterIndex, setQuarterIndex] = useState(1);
  /* Шаг и пройденные проверки хранятся снаружи: раньше выход «к программе курса»
     на четвёртом шаге из пяти означал проходить модуль заново. Отдельно от step
     живёт maxStep — докуда дошли: назад можно вернуться перечитать теорию, но
     кварталы при этом заново не проигрываются. */
  /* Докуда дошли (maxStep) и где стоим сейчас (step) — это разные величины, и
     наружу надо отдавать обе. Раньше сохранялся только step: стоило на пройденном
     модуле вернуться по содержанию с седьмого шага на четвёртый и выйти — и шаги
     5–7 снова оказывались закрыты. Пройденный модуль открыт целиком независимо от
     того, что лежит в сохранении. */
  const [step, setStep] = useState(() => (saved && (saved.at ?? saved.step)) || 0);
  const [maxStep, setMaxStep] = useState(() => (completed ? module.steps.length - 1
    : Math.max((saved && saved.step) || 0, (saved && saved.at) || 0)));
  const [leverBaseline, setLeverBaseline] = useState(0);
  const [passed, setPassed] = useState(() => (saved && saved.passed) || {});
  const [newsLog, setNewsLog] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  React.useEffect(() => { onSaveProgress(module.id, { step: maxStep, at: step, passed }); },
    [module.id, step, maxStep, passed, onSaveProgress]);
  const [practice, setPractice] = useState(null);
  const [book, setBook] = useState(() => emptyBook());
  const [cbPersonaId, setCbPersonaId] = useState('pragmatic');
  const [mofPersonaId, setMofPersonaId] = useState('technocrat');
  const [presActions, setPresActions] = useState([]);
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  const prevEcon = history.length >= 2 ? history[history.length - 2] : initEconomy;

  // музыка курса реагирует на состояние песочницы так же, как в настоящей партии
  React.useEffect(() => { Audio.setMood(economy); },
    [economy.regime, economy.inflationRisk, economy.bankingRisk, economy.recessionRisk, economy.inflation, economy.stabilizationCred]);

  const cur = module.steps[step];
  const kind = cur.kind || 'read';
  const lever = cur.lever ? LEVERS.find((l) => l.id === cur.lever) : null;
  const delta = lever ? decisions[cur.lever] - leverBaseline : 0;

  const startEconomy = practice ? practice.anchor.economy : initEconomy;
  const startBook = practice ? practice.anchor.book : book;
  const ctx = { economy, history, book, decisions, start: startEconomy, startBook,
    value: bookValue(book, economy, null), startValue: bookValue(startBook, startEconomy, null) };

  /* Вход в практику фиксирует состояние песочницы: не получилось — откатываемся сюда.
     step.setup задаёт исходную ситуацию задачи (перегрев, сорванные ожидания,
     банковский стресс): без него условие задачи зависело бы от того, как именно
     человек прошёл теоретические шаги, и одна и та же задача у разных людей была
     бы то невыполнимой, то уже выполненной. */
  React.useEffect(() => {
    const st = module.steps[step];
    if (st && (st.kind === 'practice')) {
      let eco = economy; let hist = history; let dec = decisions;
      if (st.personas) {
        // характер ведомства — такое же условие задачи, как инфляция или долг:
        // «сбить инфляцию при Голубе во главе ЦБ» без этого было бы не воспроизвести
        if (st.personas.cb) setCbPersonaId(st.personas.cb);
        if (st.personas.mof) setMofPersonaId(st.personas.mof);
      }
      if (st.setup) {
        // setup может быть функцией: часть величин имеет смысл задавать только
        // относительно текущего состояния (долг к ВВП — это доля от номинального
        // ВВП, перегрев — превышение над потенциалом, а не абсолютное число)
        const patch = typeof st.setup === 'function' ? st.setup(economy) : st.setup;
        eco = { ...economy, ...patch };
        hist = [...history.slice(0, -1), { ...history[history.length - 1], ...patch }];
        dec = defaultDecisions(eco, decisions);
        setEconomy(eco); setHistory(hist); setDecisions(dec); setPendingImpulses([]);
        // setup переписывает сценарий (ставка, инфляция и т.д.) заново — новости из
        // предыдущих шагов рассказывали про старое состояние экономики и теперь
        // прямо противоречат тому, что показано на дашборде («ставка 12%» на панели
        // и тут же в ленте «ЦБ сохраняет ставку 5.5%» из шага до setup)
        setNewsLog([]);
      }
      setPractice({ used: 0, anchor: { economy: eco, history: hist, decisions: dec,
        pendingImpulses: st.setup ? [] : pendingImpulses, eventCooldowns, quarterIndex, book } });
    } else setPractice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, module.id]);

  const practicePassed = !!passed[step];
  const practiceFailed = kind === 'practice' && !!practice && !practicePassed && practice.used >= cur.maxQuarters;
  const canAdvance = kind === 'quiz' || kind === 'practice' ? !!passed[step]
    : (!lever || delta >= cur.minDelta - 1e-9);

  // один квартал модели; отличается только тем, кто принимает решения помимо игрока
  const runQuarter = (extraDecisions) => {
    let eff = { ...decisions, ...extraDecisions };
    let cbAction = null; let mofAction = null;
    if (sandbox !== 'policy') {
      cbAction = botCentralBank(economy, cbPersonaId, 'easy');
      mofAction = botFinanceMinistry(economy, mofPersonaId, 'easy');
      eff = { ...eff, ...cbAction.decisions, ...mofAction.decisions };
    }
    /* Указание ведомству в песочнице раньше только выбиралось: разбирал его
       интерфейс настоящей партии, а не курс, — и в обучении оно не делало ровно
       ничего. Теперь считается тем же кодом и с той же силой, которую выставили
       ползунком. */
    let dirResult = null;
    if (sandbox === 'president') {
      eff = { ...eff, presidentActions: presActions, appointCb: presAppointCb, appointMof: presAppointMof };
      if (presDirective) {
        dirResult = processPresidentialDirective(presDirective, economy, cbPersonaId, mofPersonaId, eff, presDirStrength);
        if (dirResult) {
          eff = { ...dirResult.decisions, presidentActions: presActions,
            appointCb: presAppointCb, appointMof: presAppointMof, presidentExtraSpend: PRES_DIRECTIVE_COST };
          if (dirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
          else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
        }
      }
    }
    const result = simulateQuarter({
      economy, decisions: eff, pendingImpulses, eventCooldowns,
      difficulty: 'easy', quarterIndex, stories: [],
      botAction: cbAction, botActions: mofAction ? [mofAction] : [], noEvents: true,
    });
    if (dirResult) {
      result.newsEntries.unshift({ id: `dir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex,
        headline: `ПРЕЗИДЕНТ → ${dirResult.toCb ? 'ЦБ' : 'МИНФИН'}: ${dirResult.req.label.toUpperCase()} — ${dirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : dirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${dirResult.ask}» ${dirResult.text}` });
    }
    const newHistory = [...history, { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy }];
    const newDecisions = defaultDecisions(result.economy, decisions);
    let newBook = book;
    if (sandbox === 'trader') {
      const withBench = book.benchStart ? book : { ...book, benchStart: { stockIndex: economy.stockIndex,
        bondIndex: economy.bondIndex, depositIndex: economy.depositIndex, priceLevel: economy.priceLevel } };
      newBook = settleQuarter(withBench, result.economy);
      setBook(newBook);
    }
    if (sandbox === 'president') {
      if (presAppointCb) setCbPersonaId(presAppointCb);
      if (presAppointMof) setMofPersonaId(presAppointMof);
      setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1);
    }
    setEconomy(result.economy);
    setHistory(newHistory);
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setQuarterIndex((q) => q + 1);
    setDecisions(newDecisions);
    // без ленты новостей в песочнице непонятно, что вообще произошло за квартал —
    // согласился ли ЦБ, сработал ли указ, что случилось с ценами
    /* Новости копятся: раньше лента показывала только последний квартал, и
       вернуться к тому, что было два хода назад, было невозможно — а в задаче
       на несколько кварталов это как раз то, по чему и отслеживают, сработало
       решение или нет. Заголовки уже отсортированы движком по важности.
       «Мнения» (cat: 'opinion') — атмосферные цитаты для настоящей игры, в
       обучении это шум: они не говорят, сработало ли решение, а место в
       коротком списке отнимают у новостей, которые как раз об этом. */
    const tutorialNews = (result.newsEntries || []).filter((n) => n.cat !== 'opinion');
    setNewsLog((log) => [
      { q: quarterIndex, label: quarterLabel(quarterIndex), items: tutorialNews.slice(0, 6) },
      ...log,
    ].slice(0, 12));
    return { economy: result.economy, history: newHistory, decisions: newDecisions, book: newBook };
  };

  const runPracticeQuarter = () => {
    Audio.play('stamp');
    const out = runQuarter();
    const used = (practice ? practice.used : 0) + 1;
    setPractice((pr) => (pr ? { ...pr, used } : pr));
    const nextCtx = { ...out, start: startEconomy, startBook,
      value: bookValue(out.book, out.economy, null), startValue: ctx.startValue };
    if (cur.goal(nextCtx)) { setPassed((s2) => ({ ...s2, [step]: true })); Audio.play('up'); }
  };

  const resetPractice = () => {
    if (!practice) return;
    Audio.play('click');
    const a = practice.anchor;
    setEconomy(a.economy); setHistory(a.history); setDecisions(a.decisions);
    setPendingImpulses(a.pendingImpulses); setEventCooldowns(a.eventCooldowns);
    setQuarterIndex(a.quarterIndex); setBook(a.book);
    setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1);
    setNewsLog([]);
    // характер ЦБ/Минфина — условие задачи («сбить инфляцию при Голубе»), а
    // не что-то, что игрок настраивает сам: кадровая перестановка внутри
    // неудачной попытки меняла его насовсем, и «начать заново» возвращало
    // экономику к исходной точке, но оставляло уже другого главу ведомства
    if (cur.personas) {
      setCbPersonaId(cur.personas.cb || 'pragmatic');
      setMofPersonaId(cur.personas.mof || 'technocrat');
    }
    setPractice({ ...practice, used: 0 });
  };

  const advance = () => {
    Audio.play('stamp');
    // если вернулись перечитать теорию, «далее» просто листает вперёд по уже
    // пройденному: кварталы второй раз не играются
    if (step < maxStep) { setStep((v) => v + 1); return; }
    if (cur.runsQuarter) {
      const out = runQuarter();
      const nextStep = module.steps[step + 1];
      if (nextStep && nextStep.lever) setLeverBaseline(out.decisions[nextStep.lever]);
    }
    const willReachFinal = step + 1 >= module.steps.length - 1;
    if (willReachFinal) onComplete();
    setStep((v) => v + 1); setMaxStep((v) => Math.max(v, step + 1));
  };
  const goStep = (i) => { if (i <= maxStep) { Audio.play('tab'); setStep(i); setShowToc(false); } };

  const onTrade = (id, amt, side, live) => setBook((b) => {
    const nb = tradeBook(b, id, amt, side, economy, live);
    const instr = INSTR_BY_ID[id];
    return { ...nb, trades: [...(b.trades || []), { q: quarterIndex, id, side, amt, price: priceOf(instr, economy, live) }].slice(-120) };
  });

  const leverIds = kind === 'practice' ? (cur.levers || []) : lever ? [cur.lever] : [];
  // широкий макет нужен только терминалу: панель президента узкая, и на 1180 px
  // рядом с ней оставалось бы полэкрана пустоты
  const wide = kind === 'practice' && sandbox === 'trader';
  /* Курс раньше жил в колонке 640 px посреди пустого экрана: на компьютере это
     выглядело как страница из телефона. Читать всё ещё удобнее в узкой колонке —
     поэтому текст не растягиваем до края, а вот рабочие панели практики (рычаги,
     панель президента, лента новостей) на широком экране уходят во второй столбец,
     рядом с условием задачи, а не под него. */
  const twoCol = kind === 'practice' && sandbox !== 'trader';

  /* Рабочие панели практики: на широком экране уходят во второй столбец. */
  const sideBlocks = (
    <>
      {newsLog.length > 0 && (
              <div className="ems-panel" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: COLOR.faint,
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                  <Newspaper size={11} />Что происходило по кварталам
                  <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
              {newsLog.length > 1 ? 'сверху — последний' : ''}
                  </span>
                </div>
                {/* лента прокручивается: по задаче на восемь-десять кварталов важно
                    уметь отмотать назад и сверить, после чего что произошло */}
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {newsLog.map((qn) => (
                    <div key={qn.q} style={{ marginBottom: 8 }}>
                      <div className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint, marginBottom: 4 }}>{qn.label}</div>
                      {qn.items.map((n) => (
                        <div key={n.id} style={{ fontSize: 11.5, lineHeight: 1.45, marginBottom: 6, paddingLeft: 9,
                          borderLeft: `2px solid ${n.priority >= 8 ? COLOR.gold : COLOR.border}` }}>
                          <div style={{ color: COLOR.text }}>{n.headline}</div>
                          <div style={{ color: COLOR.muted }}>{n.text}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
      {sandbox === 'president' && (
              <div style={{ marginBottom: 14 }}>
                <PresidentPanel economy={economy} cooldowns={eventCooldowns}
                  selected={presActions} setSelected={setPresActions}
                  cbPersonaId={cbPersonaId} mofPersonaId={mofPersonaId}
                  appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                  appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                  directive={presDirective} setDirective={setPresDirective} lastDirective={null}
                  directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              </div>
            )}
      {leverIds.length > 0 && (
          <div className="ems-panel" style={{ padding: 16, marginBottom: 22 }}>
          {leverIds.map((id) => {
              const lv = scaleLever(LEVERS.find((l) => l.id === id), economy);
              return (
                <div key={id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                    <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{lv.label}</span>
                    <span className="ems-mono" style={{ fontSize: 13 }}>{decisions[id].toFixed(2)}{lv.suffix}</span>
                  </div>
                  <input type="range" className="ems-slider" min={lv.min} max={lv.max} step={lv.step} value={decisions[id]}
                    disabled={practicePassed}
                    onChange={(e) => { Audio.play('tick'); setDecisions((d) => ({ ...d, [id]: Number(e.target.value) })); }} />
                </div>
              );
            })}
            {lever && (
              <div style={{ fontSize: 11, color: canAdvance ? COLOR.teal : COLOR.faint }}>
                Изменение: {fmtSigned1(delta)}{lever.suffix} — нужно не меньше +{cur.minDelta}{lever.suffix}
              </div>
            )}
          </div>
        )}

    </>
  );

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: wide ? 1180 : twoCol ? 1120 : 900, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <button className="ems-btn" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); onExit(); }}>
            ← К программе курса
          </button>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); setShowGlossary(true); }}>Словарь</button>
          <AudioControls />
        </div>
        {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

        <div key={step} className="ems-fade-in">
          <div className="ems-hero-eyebrow">{module.title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4, marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
            <span className="ems-serif" style={{ fontSize: 22, fontWeight: 600 }}>{cur.title}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {kind === 'quiz' && <span className="ems-hero-badge" style={{ marginTop: 0 }}>теория</span>}
              {kind === 'practice' && <span className="ems-hero-badge" style={{ marginTop: 0 }}>практика</span>}
              <button className="ems-btn" style={{ padding: '4px 10px', fontSize: 11 }}
                title="Содержание модуля: можно вернуться и перечитать пройденное"
                onClick={() => { Audio.play('tab'); setShowToc((v) => !v); }}>
                шаг {step + 1} из {module.steps.length} <ChevronDown size={11} style={{ verticalAlign: -1 }} />
              </button>
            </span>
          </div>
        </div>
        {/* Содержание модуля. Без него нельзя было вернуться и перечитать теорию —
            особенно неудобно в тесте, где вопрос как раз про прочитанное. */}
        {showToc && (
          <div className="ems-panel ems-fade-in" style={{ padding: 10, marginBottom: 12 }}>
            {module.steps.map((st, i) => {
              const reached = i <= maxStep;
              const k = st.kind || 'read';
              return (
                <div key={st.title} role="button" tabIndex={reached ? 0 : -1}
                  onClick={() => goStep(i)} onKeyDown={(e) => { if (e.key === 'Enter') goStep(i); }}
                  className={reached ? 'ems-row-hover' : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 7px', borderRadius: 4, fontSize: 11.5,
                    cursor: reached ? 'pointer' : 'default', opacity: reached ? 1 : 0.45,
                    background: i === step ? COLOR.goldDim : 'transparent' }}>
                  <span className="ems-mono" style={{ fontSize: 10, color: COLOR.faint, width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: i === step ? COLOR.goldSoft : COLOR.text }}>{st.title}</span>
                  {k !== 'read' && <span style={{ fontSize: 9.5, color: COLOR.faint }}>{k === 'quiz' ? 'тест' : 'практика'}</span>}
                  {passed[i] && <Check size={11} color={COLOR.teal} />}
                  {!reached && <Lock size={10} color={COLOR.faint} />}
                </div>
              );
            })}
          </div>
        )}
        <div className="ems-hr" style={{ marginBottom: 18 }} />

        <div className="ems-kpi-strip" style={{ marginBottom: 18 }}>
          {/* незнакомый ключ в списке — опечатка автора курса, а не повод показать
              человеку пустой экран вместо урока: просто пропускаем плитку */}
          {(cur.pins || module.pins).filter((key) => ALL_METRICS[key]).map((key) => {
            const m = ALL_METRICS[key];
            const val = economy[key];
            return (
              <KpiTile key={key} label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'}
                delta={economy[key] - prevEcon[key]} invert={m.invert}
                series={history.slice(-6).map((h) => h[key]).filter(Number.isFinite)} />
            );
          })}
        </div>

        {/* В настоящей партии кризис виден баннером и бейджами сразу на экране;
            в практике его не было вообще — в задаче на несколько кварталов
            банковский или валютный кризис мог развернуться и погаситься
            незаметно для того, кто его как раз должен был разгребать. */}
        {kind === 'practice' && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RegimeBanner economy={economy} />
            {(economy.activeCrises || []).filter((c) => c !== economy.regime).map((c) => (
              <div key={c} className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '8px 11px', fontSize: 12 }}>
                <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
                <span><b style={{ color: COLOR.rust }}>{CRISIS_INFO[c] ? regimeInfoLabel(CRISIS_INFO[c], economy) : c}.</b> <span style={{ color: COLOR.muted }}>{CRISIS_INFO[c] ? regimeInfoText(CRISIS_INFO[c], economy) : ''}</span></span>
              </div>
            ))}
          </div>
        )}

        <div className={twoCol ? 'ems-tut-cols' : undefined}>
          <div style={{ minWidth: 0 }}>
            {cur.body && (
              <div className="ems-panel" style={{ padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: COLOR.text, marginBottom: 18 }}>
                {cur.body({ economy, history, decisions, book, ctx })}
              </div>
            )}
            {twoCol && (
              <PracticeStatus step={cur} ctx={ctx} quartersUsed={practice ? practice.used : 0}
                passed={practicePassed} failed={practiceFailed} />
            )}
          </div>
          {twoCol && <div style={{ minWidth: 0 }}>{sideBlocks}</div>}
        </div>

        {kind === 'quiz' && (
          <QuizStep questions={cur.questions} passed={!!passed[step]}
            onPass={() => setPassed((s2) => ({ ...s2, [step]: true }))} />
        )}

        {kind === 'practice' && (
          <>
            {!twoCol && (
              <PracticeStatus step={cur} ctx={ctx} quartersUsed={practice ? practice.used : 0}
                passed={practicePassed} failed={practiceFailed} />
            )}
            {sandbox === 'trader' && (
              <div style={{ marginBottom: 14 }}>
                <Suspense fallback={<div style={{ padding: 18, color: COLOR.faint, fontSize: 12 }}>Загрузка терминала…</div>}>
                  <TradingTerminal economy={economy} prev={prevEcon} history={history} book={book} onTrade={onTrade} />
                </Suspense>
              </div>
            )}
          </>
        )}

        {twoCol ? null : sideBlocks}
        {kind === 'practice' && !practicePassed && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="ems-btn primary" disabled={practiceFailed} style={{ flex: 1, minWidth: 200, padding: '12px 0', fontSize: 13.5 }}
              onClick={runPracticeQuarter}>
              Завершить квартал
            </button>
            <button className="ems-btn" style={{ padding: '12px 18px', fontSize: 12.5 }} onClick={resetPractice}>
              <RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Начать задачу заново
            </button>
          </div>
        )}

        {cur.isFinal ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isLastModule ? (
              <button className="ems-btn primary" style={{ flex: 1, minWidth: 220, padding: '13px 0', fontSize: 14 }}
                onClick={() => { Audio.prime(); onStartRealGame(); }}>
                Начать настоящую партию
              </button>
            ) : (
              <button className="ems-btn primary" style={{ flex: 1, minWidth: 220, padding: '13px 0', fontSize: 14 }}
                onClick={() => { Audio.prime(); Audio.play('tab'); onGoNext(); }}>
                Следующий модуль →
              </button>
            )}
            <button className="ems-btn" style={{ padding: '13px 20px', fontSize: 13 }} onClick={() => { Audio.play('click'); onGoHub(); }}>
              К программе курса
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ems-btn" disabled={step === 0} style={{ padding: '13px 18px', fontSize: 13 }}
                onClick={() => goStep(step - 1)}>← Назад</button>
              <button disabled={!canAdvance} className="ems-btn primary" style={{ flex: 1, padding: '13px 0', fontSize: 14 }}
                onClick={advance}>
                {step < maxStep ? 'Далее →' : 'Далее'}
              </button>
            </div>
            {!canAdvance && (kind === 'quiz' || kind === 'practice') && (
              <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 7, textAlign: 'center' }}>
                {kind === 'quiz' ? 'Следующий шаг откроется после верных ответов на все вопросы.'
                  : 'Следующий шаг откроется, когда задача будет решена.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TutorialHub({ onBack, onStartRealGame }) {
  const playerId = useMemo(getPlayerId, []);
  const [progress, setProgress] = useState(loadCourseProgress);
  // незаконченные модули: на каком шаге остановились и что уже сдали
  const [moduleState, setModuleState] = useState(loadModuleState);
  /* Прогресс курса раньше синхронизировался только в главном меню — если
     человек прошёл несколько уроков и закрыл вкладку, не заходя в меню снова,
     второе связанное устройство об этом так и не узнавало. Здесь синхронизация
     срабатывает трижды: при входе в хаб (подтянуть то, что сделали на другом
     устройстве), при каждом сохранении шага (отправить своё) и при выходе. */
  React.useEffect(() => {
    let alive = true;
    syncProfile(playerId).then(() => {
      if (!alive) return;
      setProgress(loadCourseProgress());
      setModuleState(loadModuleState());
    });
    return () => { alive = false; syncProfile(playerId); };
  }, [playerId]);
  const saveModuleProgress = useCallback((id, st) => {
    setModuleState((prev) => {
      if (prev[id] && prev[id].step === st.step && prev[id].at === st.at
        && Object.keys(prev[id].passed || {}).length === Object.keys(st.passed).length) return prev;
      const next = { ...prev, [id]: st };
      try { localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
      syncProfile(playerId);
      return next;
    });
  }, [playerId]);
  /* Своя музыка курса: спокойные пьесы под чтение и разбор задач. Роль ставится
     на весь хаб, поэтому переходы между модулями её не сбрасывают. */
  React.useEffect(() => {
    Audio.setRole('tutorial');
    return () => { Audio.setRole(null); Audio.stopMusic(); };
  }, []);
  const [courseId, setCourseId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();

  const course = TUTORIAL_COURSES.find((c) => c.id === courseId) || null;
  const doneIn = (c) => c.modules.filter((m) => progress[m.id]).length;

  const completeModule = (mod) => {
    const next = markModuleDone(mod.id);
    setProgress(next);
    syncProfile(playerId);
    /* Пройденный модуль остаётся открытым целиком: его шаги не «сбрасываются», а
       фиксируются пройденными — вернуться по содержанию к четвёртому шагу из семи
       и выйти теперь не значит закрыть себе пятый, шестой и седьмой. */
    setModuleState((prev) => {
      const cur = prev[mod.id] || { passed: {} };
      const full = { ...cur, step: mod.steps.length - 1, at: cur.at ?? (mod.steps.length - 1) };
      const nextState = { ...prev, [mod.id]: full };
      try { localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(nextState)); } catch { /* приватный режим */ }
      return nextState;
    });
    const achIds = ['tutorial_done'];
    // «Экономист» — за базовый курс целиком, включая экзамен; отдельные значки
    // за прикладные курсы, чтобы у каждого была своя цель, а не общий счётчик
    const policy = TUTORIAL_COURSES[0];
    if (policy.modules.every((m) => next[m.id])) achIds.push('tutorial_course_done');
    if (TUTORIAL_COURSES[1].modules.every((m) => next[m.id])) achIds.push('course_trader');
    if (TUTORIAL_COURSES[2].modules.every((m) => next[m.id])) achIds.push('course_president');
    // «Красный диплом» — за три курса с экзаменами; справочник по режимам в него не входит
    if (TUTORIAL_COURSES.slice(0, 3).every((c) => c.modules.every((m) => next[m.id]))) achIds.push('course_all');
    pushAch(unlockAchievements(achIds));
  };

  if (activeId && course) {
    const idx = course.modules.findIndex((m) => m.id === activeId);
    const mod = course.modules[idx];
    const next = course.modules[idx + 1];
    return (
      <>
        <AchievementToast toast={achToast} leaving={achLeaving} />
        <TutorialModuleScreen key={mod.id} module={mod} isLastModule={idx === course.modules.length - 1}
          saved={moduleState[mod.id]} onSaveProgress={saveModuleProgress} completed={!!progress[mod.id]}
          onExit={() => setActiveId(null)}
          onComplete={() => completeModule(mod)}
          onGoNext={next ? () => setActiveId(next.id) : null}
          onGoHub={() => setActiveId(null)}
          onStartRealGame={onStartRealGame}
        />
      </>
    );
  }

  const totalDone = TUTORIAL_COURSES.reduce((n, c) => n + doneIn(c), 0);
  const totalModules = TUTORIAL_COURSES.reduce((n, c) => n + c.modules.length, 0);

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <AchievementToast toast={achToast} leaving={achLeaving} />
      <div style={{ maxWidth: 640, width: '100%' }}>
        {/* В обучении музыки не было вообще и включить её было нечем — та же панель
            саундтрека, что и в партии, только прижата к строке навигации. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <button className="ems-btn" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); if (course) setCourseId(null); else onBack(); }}>
            ← {course ? 'Ко всем курсам' : 'Назад в меню'}
          </button>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }}
            onClick={() => { Audio.play('click'); setShowGlossary(true); }}>Словарь терминов</button>
          <AudioControls />
        </div>
        {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}

        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 30 }}>
          <div className="ems-hero-eyebrow">{course ? 'Программа курса' : 'Обучение'}</div>
          <div className="ems-hero-title small">{course ? course.title : 'Четыре курса'}</div>
          <div className="ems-hero-rule" />
          <span className="ems-hero-badge">
            <GraduationCap size={11} color={COLOR.gold} />
            {course ? `Пройдено ${doneIn(course)} из ${course.modules.length}` : `Пройдено ${totalDone} из ${totalModules} модулей`}
          </span>
          <div className="ems-hero-lede">
            {course ? course.lede
              : 'Каждый модуль заканчивается тестом на понимание и практической задачей в песочнице: дальше пускает только верный ответ и решённая задача. В конце каждого курса — экзамен. Прогресс сохраняется, проходить заново можно сколько угодно.'}
          </div>
        </div>

        {!course && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {TUTORIAL_COURSES.map((c, i) => {
              const Icon = c.icon;
              const done = doneIn(c);
              const complete = done === c.modules.length;
              return (
                <div key={c.id} onClick={() => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); setCourseId(c.id); }}
                  className="ems-card-btn ems-fade-in" style={{ padding: '17px 20px', animationDelay: `${80 + i * 55}ms` }}
                  role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCourseId(c.id); }}>
                  <div className="ems-card-icon">
                    {complete ? <Check size={19} color={COLOR.teal} /> : <Icon size={19} color={COLOR.gold} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{c.title}</span>
                      <span className="ems-mono" style={{ fontSize: 10, color: complete ? COLOR.teal : COLOR.faint }}>
                        {done} / {c.modules.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>{c.lede}</div>
                    <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                      <span style={{ display: 'block', width: `${done / c.modules.length * 100}%`, height: '100%',
                        background: complete ? COLOR.teal : COLOR.gold }} />
                    </div>
                  </div>
                  <ChevronDown className="ems-card-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}

        {course && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {course.modules.map((mod, i) => {
              const unlocked = course.open || i === 0 || !!progress[course.modules[i - 1].id];
              const done = !!progress[mod.id];
              const Icon = mod.icon;
              const label = mod.isExam ? 'экзамен' : mod.depth === 'deep' ? 'углублённо' : 'поверхностно';
              const depthColor = mod.isExam ? COLOR.gold : mod.depth === 'deep' ? COLOR.rust : COLOR.teal;
              const depthDim = mod.isExam ? COLOR.goldDim : mod.depth === 'deep' ? COLOR.rustDim : COLOR.tealDim;
              const nChecks = mod.steps.filter((st) => st.kind === 'quiz' || st.kind === 'practice').length;
              return (
                <div key={mod.id} onClick={() => { if (unlocked) { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); setActiveId(mod.id); } }}
                  className="ems-card-btn ems-fade-in"
                  style={{ padding: '17px 20px', animationDelay: `${80 + i * 45}ms`,
                    opacity: unlocked ? 1 : 0.55, cursor: unlocked ? 'pointer' : 'not-allowed' }}
                  role="button" tabIndex={unlocked ? 0 : -1}
                  onKeyDown={(e) => { if (unlocked && (e.key === 'Enter' || e.key === ' ')) setActiveId(mod.id); }}>
                  <div className="ems-card-icon">
                    {done ? <Check size={19} color={COLOR.teal} /> : unlocked ? <Icon size={19} color={COLOR.gold} /> : <Lock size={17} color={COLOR.faint} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ems-serif" style={{ fontSize: 15.5, color: COLOR.text }}>{mod.title}</span>
                      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999,
                        color: depthColor, border: `1px solid ${depthDim}`, background: depthDim }}>{label}</span>
                      {nChecks > 0 && (
                        <span className="ems-mono" style={{ fontSize: 9.5, color: COLOR.faint }}>
                          {mod.steps.some((st) => st.kind === 'quiz') ? 'тест' : ''}
                          {mod.steps.some((st) => st.kind === 'quiz') && mod.steps.some((st) => st.kind === 'practice') ? ' + ' : ''}
                          {mod.steps.some((st) => st.kind === 'practice') ? 'практика' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 3, lineHeight: 1.45 }}>
                      {unlocked ? mod.summary : `Сначала пройдите «${course.modules[i - 1].title}»`}
                    </div>
                    {unlocked && !done && moduleState[mod.id] && moduleState[mod.id].step > 0 && (
                      <div style={{ fontSize: 10.5, color: COLOR.goldSoft, marginTop: 3 }}>
                        Начат — продолжить с шага {(moduleState[mod.id].at ?? moduleState[mod.id].step) + 1} из {mod.steps.length}
                      </div>
                    )}
                  </div>
                  {unlocked && <ChevronDown className="ems-card-chevron" size={14} color={COLOR.faint} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
