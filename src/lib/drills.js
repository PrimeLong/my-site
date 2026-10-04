/* ЗАДАЧИ НА 10 МИНУТ. Короткая партия с одной целью: стартовые условия заданы,
   кварталов мало, случайных событий нет (шум квартала остаётся), зерно у задачи своё —
   попытку можно повторить и сравнить стратегии. В конце — разбор: какие условия
   выполнены, с какими цифрами, и что об этом говорит учебник.

   goals: key — показатель экономики; op — '<=' или '>='; value — порог;
   when — 'final' (в последнем квартале), 'always' (в каждом квартале задачи) или
   'avg' (в среднем за все кварталы задачи).
   topic — раздел страницы «игра ↔ учебник», к которому привязана задача;
   impulses — стартовые импульсы (шок, который уже в пути). */
import { makeImpulse, makeInitialEconomy } from './engine.js';
import { PRE_KEYS, makePrehistory } from './autopilot.js';

export const DRILLS = [
  { id: 'disinflation', title: 'Инфляция с 12% до 4%', topic: 'phillips', role: 'central_bank', quarters: 8, scenario: 'sandbox',
    overrides: { inflation: 12, coreInflation: 11, inflationExpectations: 10, keyRate: 10, lendingRate: 14, depositRate: 8.5, cbCredibility: 45, wageGrowth: 13 },
    brief: 'Инфляция 12%, ожидания 10%, ставка 10%. За восемь кварталов верните инфляцию к цели и не устройте рецессию.',
    goals: [
      { key: 'inflation', op: '<=', value: 4.5, when: 'final', label: 'инфляция к концу ≤ 4,5%' },
      { key: 'unemployment', op: '<=', value: 7, when: 'always', label: 'безработица ≤ 7% в каждом квартале' },
    ],
    debrief: 'Дезинфляция требует положительной реальной ставки: номинал должен быть выше ожиданий, иначе политика только выглядит жёсткой. Чем раньше поднять ставку, тем меньше её придётся держать высокой — ожидания адаптивные и тянутся за фактической инфляцией. Цена — отрицательный разрыв выпуска и рост безработицы по Оукену; кто ужесточает поздно, получает и инфляцию, и безработицу.' },
  { id: 'recession', title: 'Вытащить из спада', topic: 'okun', role: 'central_bank', quarters: 6, scenario: 'sandbox',
    overrides: { gdp: 1900, unemployment: 7.8, inflation: 2.2, coreInflation: 2.4, inflationExpectations: 3, keyRate: 7, lendingRate: 11, consumerConfidence: 38, businessConfidence: 40 },
    brief: 'Выпуск на 5% ниже потенциала, безработица 7,8%, инфляция ниже цели, ставка 7%. За шесть кварталов опустите безработицу до 6,8%, не разогнав цены.',
    goals: [
      { key: 'unemployment', op: '<=', value: 6.8, when: 'final', label: 'безработица к концу ≤ 6,8%' },
      { key: 'inflation', op: '<=', value: 6, when: 'always', label: 'инфляция ≤ 6% в каждом квартале' },
    ],
    debrief: 'При отрицательном разрыве и инфляции ниже цели правило Тейлора требует ставку заметно ниже нейтральной. Смягчение работает с лагом: кредит → спрос → выпуск → занятость. Кривая Филлипса в спаде пологая — цены почти не реагируют, поэтому смягчать можно смело, а вот держать мягкую политику после закрытия разрыва — уже инфляция.' },
  { id: 'consolidation', title: 'Сократить дефицит без рецессии', topic: 'multiplier', role: 'ministry_finance', quarters: 8, scenario: 'sandbox',
    overrides: { budgetBalancePctGdp: -6.5, govDebt: 1500, riskPremium: 2.2 },
    brief: 'Дефицит 6,5% ВВП: социальные выплаты раздуты, долг растёт, рынок нервничает. За восемь кварталов сведите дефицит к 4,5% ВВП так, чтобы экономика не ушла в минус. Бюджетные рычаги — темпы роста: расходы сокращаются постепенно, квартал за кварталом.',
    goals: [
      { key: 'budgetBalancePctGdp', op: '>=', value: -4.5, when: 'final', label: 'дефицит к концу ≤ 4,5% ВВП' },
      { key: 'gdpGrowth', op: '>=', value: -1, when: 'always', label: 'рост ВВП не ниже −1% ни в одном квартале' },
    ],
    debrief: 'Консолидация сжимает спрос через мультипликатор: урезанные закупки бьют по выпуску сильнее, чем выплаты, а госинвестиции ещё и по потенциалу. Резкая экономия в первые кварталы роняет рост и налоговую базу — дефицит сокращается хуже, чем обещала арифметика. Постепенность и выбор инструмента (налоги с низким мультипликатором, закупки аппарата, а не инвестиции) — главный урок.' },
  { id: 'fisher', title: 'Реальная ставка при инфляции 25%', topic: 'fisher', role: 'central_bank', quarters: 8, scenario: 'sandbox',
    overrides: { inflation: 25, coreInflation: 23, inflationExpectations: 22, keyRate: 18, lendingRate: 22, depositRate: 15, cbCredibility: 30, wageGrowth: 26 },
    brief: 'Инфляция 25%, ожидания 22%, ключевая 18% — на вид жёстко. Сбейте инфляцию до 12% за восемь кварталов, не отправив безработицу за 9%.',
    goals: [
      { key: 'inflation', op: '<=', value: 12, when: 'final', label: 'инфляция к концу ≤ 12%' },
      { key: 'unemployment', op: '<=', value: 9, when: 'always', label: 'безработица ≤ 9% в каждом квартале' },
    ],
    debrief: 'Ставка 18% при ожиданиях 22% — это реальная ставка минус 4%: политика стимулирует, а не сдерживает. По Фишеру номинал нужно поднять выше ожиданий, иначе инфляция кормит сама себя. Когда ожидания пошли вниз, номинал можно снижать вслед, не теряя жёсткости — реальная ставка остаётся положительной.' },
  { id: 'peg', title: 'Удержать фиксированный курс', topic: 'trilemma', role: 'central_bank', quarters: 8, scenario: 'sandbox',
    overrides: { fxRegime: 'peg', fxTarget: 100, reserves: 140, riskPremium: 4.5, inflation: 6.5, coreInflation: 6, inflationExpectations: 6.5, keyRate: 5.5, lendingRate: 9.5 },
    brief: 'Курс привязан на уровне 100, капитал утекает, резервов 140 млрд, ставка 5,5% при ожиданиях 6,5%. Восемь кварталов держите привязку и не растратьте резервы.',
    goals: [
      { key: 'exchangeRate', op: '<=', value: 105, when: 'always', label: 'курс не слабее 105 в каждом квартале' },
      { key: 'reserves', op: '>=', value: 80, when: 'final', label: 'резервы к концу ≥ 80 млрд' },
    ],
    debrief: 'Невозможная троица: при свободном движении капитала фиксированный курс и своя ставка несовместимы. Держать привязку можно резервами — пока они есть — или ставкой: выше доходность, капитал остаётся. Тот, кто пытается держать и курс, и мягкую ставку, платит резервами и в конце получает срыв режима. Цена привязки — денежная политика подчинена курсу, а не экономике.' },
  { id: 'laffer', title: 'Больше денег от меньших налогов', topic: 'laffer', role: 'ministry_finance', quarters: 8, scenario: 'sandbox',
    overrides: { incomeTaxRate: 32, profitTaxRate: 38, socialContribRate: 30, shadowShare: 24 },
    brief: 'Подоходный 32%, на прибыль 38%, взносы 30%, четверть экономики в тени. Поднимите доходы бюджета до 27% ВВП и выведите часть экономики из тени.',
    goals: [
      { key: 'revenuePctGdp', op: '>=', value: 27, when: 'final', label: 'доходы к концу ≥ 27% ВВП' },
      { key: 'shadowShare', op: '<=', value: 21, when: 'final', label: 'теневая экономика к концу ≤ 21%' },
    ],
    debrief: 'Далеко за привычным уровнем собираемость падает быстрее, чем растёт ставка, и часть базы уходит в тень — это правая ветвь кривой Лаффера. Снижение ставок здесь увеличивает сбор: растёт собираемость, база выходит из тени. Но у кривой есть и левая ветвь — снижать до бесконечности нельзя, и в модели тень возвращается медленно, за несколько кварталов.' },
  { id: 'slump_stimulus', title: 'Стимул в ловушке ликвидности', topic: 'multiplier', role: 'ministry_finance', quarters: 6, scenario: 'sandbox',
    overrides: { gdp: 1880, unemployment: 8.6, inflation: 0.8, coreInflation: 1.0, inflationExpectations: 1.5, keyRate: 0.75, lendingRate: 4.5, depositRate: 0.25, consumerConfidence: 34, businessConfidence: 36 },
    brief: 'Выпуск на 6% ниже потенциала, безработица 8,6%, инфляция под нулём, ставка ЦБ 0,75% — снижать почти некуда. За шесть кварталов опустите безработицу до 6,7%, не раздув дефицит больше 7% ВВП.',
    goals: [
      { key: 'unemployment', op: '<=', value: 6.7, when: 'final', label: 'безработица к концу ≤ 6,7%' },
      { key: 'budgetBalancePctGdp', op: '>=', value: -7, when: 'always', label: 'дефицит ≤ 7% ВВП в каждом квартале' },
    ],
    debrief: 'Ставка у нуля — ЦБ больше не может помочь, это ловушка ликвидности. В глубоком спаде мультипликатор высок: деньги доходят до выпуска, а не до цен, и ЦБ не гасит стимул ставкой. Сильнее всего работают закупки и госинвестиции, слабее — выплаты (часть сберегают) и снижение налогов. Сравните с задачей «при полной занятости»: там тот же рубль уходит в цены.' },
  { id: 'full_stimulus', title: 'Стимул при полной занятости', topic: 'multiplier', role: 'ministry_finance', quarters: 8, scenario: 'sandbox',
    overrides: { gdp: 2030, unemployment: 4.4, inflation: 4.8, coreInflation: 4.6, inflationExpectations: 4.4 },
    brief: 'Экономика чуть выше потенциала, безработица 4,4%, ЦБ следит за инфляцией. Правительство хочет рост 2,9% в год в среднем за два года — и не готово ради него раздувать дефицит больше 4% ВВП.',
    goals: [
      { key: 'gdpGrowth', op: '>=', value: 2.9, when: 'avg', label: 'рост ВВП в среднем ≥ 2,9%' },
      { key: 'budgetBalancePctGdp', op: '>=', value: -4, when: 'always', label: 'дефицит ≤ 4% ВВП в каждом квартале' },
    ],
    debrief: 'У потенциала мультипликатор вдвое ниже, чем в спаде: спрос упирается в мощности, а ЦБ отвечает на разгон ставкой — это вытеснение. В модели «грубый» стимул закупками и выплатами поднимает ключевую с 6,25% до 7,5%, и рост остаётся ниже цели при дефиците под 5% ВВП. Дальше идёт то, что двигает сам потенциал: госинвестиции в инфраструктуру и сдержанность в текущих расходах. Сравните с задачей «ловушка ликвидности»: там ЦБ ставку не поднимет, и тот же рубль работает сильнее.' },
  { id: 'supply_shock', title: 'Шок предложения', topic: 'phillips', role: 'central_bank', quarters: 8, scenario: 'sandbox',
    overrides: { inflation: 7.5, coreInflation: 4.8, inflationExpectations: 5, commodityIndex: 135 },
    impulses: [['inflationSupply', 3.2, 'Скачок цен на сырьё', 'slow'], ['potentialShock', -0.4, 'Дорогое сырьё тормозит производство', 'default']],
    brief: 'Сырьё подорожало на треть: инфляция 7,5% при базовой 4,8%, впереди ещё волна издержек, а выпуск начнёт проседать. Верните инфляцию к 5% за восемь кварталов, не отправив безработицу за 5,9%.',
    goals: [
      { key: 'inflation', op: '<=', value: 5, when: 'final', label: 'инфляция к концу ≤ 5%' },
      { key: 'unemployment', op: '<=', value: 5.9, when: 'always', label: 'безработица ≤ 5,9% в каждом квартале' },
    ],
    debrief: 'Шок предложения двигает кривую Филлипса вверх: инфляция растёт, а выпуск падает — стагфляция. Задавить её ставкой можно, но ценой безработицы; смотреть сквозь шок — риск, что ожидания сорвутся. Учебный выход — не реагировать на первый круг (сырьё), но не дать разогнаться второму (зарплаты, ожидания): следить за базовой инфляцией и ожиданиями, а не за общей.' },
  { id: 'greece', title: 'Греция без своей ставки', topic: 'trilemma', role: 'ministry_finance', quarters: 8, scenario: 'greece2010',
    brief: 'Весна 2010-го: долг 130% ВВП, рынок требует 9% за риск, курса и ставки нет — их ведёт ЕЦБ. Свести долг экономией не выйдет: выпуск падает быстрее, чем дефицит. За восемь кварталов опустите долг до 130% ВВП, не дав безработице подняться выше 13,5%. Подсказка: у Минфина есть программа МВФ и реструктуризация долга — обе доступны, только когда рынок признал долговой кризис.',
    goals: [
      { key: 'debtToGdp', op: '<=', value: 130, when: 'final', label: 'госдолг к концу ≤ 130% ВВП' },
      { key: 'unemployment', op: '<=', value: 13.5, when: 'always', label: 'безработица ≤ 13,5% в каждом квартале' },
    ],
    debrief: 'В валютном союзе нет двух амортизаторов: девальвация не удешевит экспорт, ЦБ не снизит ставку под ваш спад. Поэтому экономия бьёт по выпуску в полную силу, а долг к ВВП растёт даже при сокращённом дефиците — знаменатель падает быстрее числителя («экономия, которая себя не окупает»). Программа МВФ удешевляет долг, но за два года почти не меняет его уровень. Реальная Греция в 2012 году провела крупнейшую в истории реструктуризацию — списание части долга частным кредиторам. В модели это тоже единственный быстрый путь, и у него своя цена: доверие к правительству, бегство капитала и закрытый на два года рынок.' },
];

// проверка целей по ходу партии: history — записи кварталов 1..N (без стартовой q = 0)
export function evaluateDrill(drill, history) {
  const rows = (history || []).filter((h) => Number.isFinite(h.q) && h.q >= 1 && h.q <= drill.quarters);
  const done = rows.length >= drill.quarters;
  const cmp = (v, g) => (g.op === '<=' ? v <= g.value + 1e-9 : v >= g.value - 1e-9);
  const goals = drill.goals.map((g) => {
    const vals = rows.map((r) => r[g.key]).filter(Number.isFinite);
    if (!vals.length) return { ...g, status: 'pending', value: null };
    if (g.when === 'avg') {
      const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
      return { ...g, value: mean, status: done ? (cmp(mean, g) ? 'ok' : 'fail') : 'pending' };
    }
    if (g.when === 'always') {
      const worst = g.op === '<=' ? Math.max(...vals) : Math.min(...vals);
      const ok = cmp(worst, g);
      return { ...g, value: worst, status: !ok ? 'fail' : done ? 'ok' : 'pending' };
    }
    const last = vals[vals.length - 1];
    return { ...g, value: last, status: done ? (cmp(last, g) ? 'ok' : 'fail') : 'pending' };
  });
  return { done, passed: done && goals.every((g) => g.status === 'ok'), goals };
}

/* Значение цели словами — в тех же единицах, что и формулировка цели. Сальдо бюджета
   хранится со знаком (−2,6), а цель звучит «дефицит ≤ 3%»: показываем «дефицит 2,6% ВВП»,
   иначе «итог −2,6» при цели «≤ 3» читается как невыполненная. */
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace('-', '−');
export function goalValueText(g) {
  if (g.value == null) return '—';
  const v = g.value;
  const pre = g.when === 'always' ? 'худшее: ' : g.when === 'avg' ? 'в среднем: ' : 'итог: ';
  switch (g.key) {
    case 'budgetBalancePctGdp': return `${pre}${v < 0 ? `дефицит ${f1(-v)}` : `профицит ${f1(v)}`}% ВВП`;
    case 'debtToGdp': case 'revenuePctGdp': return `${pre}${f1(v)}% ВВП`;
    case 'reserves': return `${pre}${f1(v)}`;
    case 'exchangeRate': return `${pre}${f1(v)}`;
    default: return `${pre}${f1(v)}%`;
  }
}

// рекорды задач на этом устройстве: пройдена ли и за сколько попыток
const BEST_KEY = 'ems-drills';
export function loadDrillRecords() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch { return {}; }
}
export function recordDrillResult(id, passed) {
  const all = loadDrillRecords();
  const cur = all[id] || { tries: 0, passed: false };
  all[id] = { tries: cur.tries + 1, passed: cur.passed || passed };
  try { localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch { /* приватный режим */ }
  return all[id];
}

// настройки партии для задачи: всё фиксировано, чтобы попытки были сравнимы
export function drillSetup(drill) {
  return { role: drill.role, difficulty: 'medium', goal: 'living_standards', scenario: drill.scenario, drill: drill.id,
    economyOnly: true, tour: false, cbPersona: 'pragmatic', mofPersona: 'technocrat',
    president: { enabled: false, persona: 'technocrat' } };
}

/* Вводный отрезок задачи (и кризисного вызова дня): в обычной партии перед стартом три года
   страну ведут боты, и на графике видно, куда шла экономика. Задача начинается со своей
   завязки — здесь её предыстория. Раньше это была гладкая кривая от обычной экономики к
   завязке: прямые линии, ВВП и курс без единого изменения. Теперь кварталы настоящие: боты
   ведут обычную экономику (makePrehistory — рост, колебания, связанные показатели), а к
   старту её плавно сводит в завязку — ставки и доли получают нарастающую добавку, уровни
   (ВВП, курс, индексы) — один общий множитель, так что темпы роста между кварталами
   сохраняются. Цели задачи считаются только по её собственным кварталам. */
const LEVEL_KEYS = new Set(['gdp', 'potentialGdp', 'productivity', 'stockIndex', 'bondIndex', 'exchangeRate', 'realExchangeRate', 'humanCapitalIndex', 'infrastructureIndex']);
/* Инфляция не разгоняется сама по себе. Если к завязке она выросла сильно (гиперинфляция:
   с 4% до 34%), вводный отрезок рассказывает связную историю: сначала экономика перегрета —
   разрыв выпуска растёт, рост ВВП выше обычного, безработица ниже, — инфляция и ожидания
   разгоняются; потом ЦБ поднимает ставку, перегрев гаснет, и к старту разрыв возвращается к
   завязке, а инфляция остаётся высокой — её держат ожидания. Раньше каждый ряд тянулся к
   завязке сам по себе, и на графике было «инфляция 34%, разрыв 0,1%» без всякой причины. */
export const OVERHEAT = { minJump: 3, perPoint: 0.12, max: 4, okun: 0.4 };
export const overheatAmp = (jump) => (jump > OVERHEAT.minJump ? Math.min(OVERHEAT.max, jump * OVERHEAT.perPoint) : 0);
export function drillPrehistory(drill, quarters = 8, { difficulty = 'medium', cbPersona = 'pragmatic', mofPersona = 'technocrat', presPersona = 'technocrat' } = {}) {
  const run = makePrehistory({ quarters, difficulty, cbPersona, mofPersona, presPersona });
  const end = run.economy;
  const to = makeInitialEconomy(drill.scenario, drill.overrides);
  const n = run.prehistory.length;
  const amp = overheatAmp((to.inflation || 0) - (end.inflation || 0));
  return run.prehistory.map((sim, k) => {
    const t = (k + 1) / (n + 1);
    const w = t * t * (3 - 2 * t);
    const row = { q: sim.q, label: sim.label, pre: true, drillLeadIn: true };
    PRE_KEYS.forEach((key) => {
      const a = sim[key]; const e = end[key]; const b = to[key];
      if (Number.isFinite(a) && Number.isFinite(e) && Number.isFinite(b)) {
        const v = LEVEL_KEYS.has(key) && e > 0 && b > 0 ? a * (b / e) : a + (b - e) * w;
        row[key] = a >= 0 && b >= 0 ? Math.max(0, v) : v;
      } else if (b !== undefined) row[key] = b;
    });
    if (amp > 0) {
      // горб перегрева: растёт в первой половине отрезка и гаснет к старту; рост ВВП — его наклон (годовых)
      const hump = amp * Math.sin(Math.PI * t);
      const slope = amp * Math.PI * Math.cos(Math.PI * t) * (4 / (n + 1)) * 0.5;
      if (Number.isFinite(row.outputGap)) row.outputGap += hump;
      if (Number.isFinite(row.gdpGrowth)) row.gdpGrowth += slope;
      if (Number.isFinite(row.unemployment)) row.unemployment = Math.max(0, row.unemployment - OVERHEAT.okun * hump);
    }
    return row;
  });
}

// стартовые импульсы задачи: шок, который уже в пути
export function drillImpulses(drill, difficulty = 'medium') {
  return (drill.impulses || []).map(([channel, amount, reason, speed]) => makeImpulse(channel, amount, reason, speed || 'default', difficulty));
}
