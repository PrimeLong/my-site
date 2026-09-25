/* ЗАДАЧИ НА 10 МИНУТ. Короткая партия с одной целью: стартовые условия заданы,
   кварталов мало, случайных событий нет (шум квартала остаётся), зерно у задачи своё —
   попытку можно повторить и сравнить стратегии. В конце — разбор: какие условия
   выполнены, с какими цифрами, и что об этом говорит учебник.

   goals: key — показатель экономики; op — '<=' или '>='; value — порог;
   when — 'final' (в последнем квартале) или 'always' (в каждом квартале задачи). */

export const DRILLS = [
  { id: 'disinflation', title: 'Инфляция с 12% до 4%', role: 'central_bank', quarters: 8, scenario: 'sandbox',
    overrides: { inflation: 12, coreInflation: 11, inflationExpectations: 10, keyRate: 10, lendingRate: 14, depositRate: 8.5, cbCredibility: 45, wageGrowth: 13 },
    brief: 'Инфляция 12%, ожидания 10%, ставка 10%. За восемь кварталов верните инфляцию к цели и не устройте рецессию.',
    goals: [
      { key: 'inflation', op: '<=', value: 4.5, when: 'final', label: 'инфляция к концу ≤ 4,5%' },
      { key: 'unemployment', op: '<=', value: 7, when: 'always', label: 'безработица ≤ 7% в каждом квартале' },
    ],
    debrief: 'Дезинфляция требует положительной реальной ставки: номинал должен быть выше ожиданий, иначе политика только выглядит жёсткой. Чем раньше поднять ставку, тем меньше её придётся держать высокой — ожидания адаптивные и тянутся за фактической инфляцией. Цена — отрицательный разрыв выпуска и рост безработицы по Оукену; кто ужесточает поздно, получает и инфляцию, и безработицу.' },
  { id: 'recession', title: 'Вытащить из спада', role: 'central_bank', quarters: 6, scenario: 'sandbox',
    overrides: { gdp: 1900, unemployment: 7.8, inflation: 2.2, coreInflation: 2.4, inflationExpectations: 3, keyRate: 7, lendingRate: 11, consumerConfidence: 38, businessConfidence: 40 },
    brief: 'Выпуск на 5% ниже потенциала, безработица 7,8%, инфляция ниже цели, ставка 7%. За шесть кварталов верните безработицу к норме, не разогнав цены.',
    goals: [
      { key: 'unemployment', op: '<=', value: 5.7, when: 'final', label: 'безработица к концу ≤ 5,7%' },
      { key: 'inflation', op: '<=', value: 6, when: 'always', label: 'инфляция ≤ 6% в каждом квартале' },
    ],
    debrief: 'При отрицательном разрыве и инфляции ниже цели правило Тейлора требует ставку заметно ниже нейтральной. Смягчение работает с лагом: кредит → спрос → выпуск → занятость. Кривая Филлипса в спаде пологая — цены почти не реагируют, поэтому смягчать можно смело, а вот держать мягкую политику после закрытия разрыва — уже инфляция.' },
  { id: 'consolidation', title: 'Сократить дефицит без рецессии', role: 'ministry_finance', quarters: 8, scenario: 'sandbox',
    overrides: { budgetBalancePctGdp: -6.5, govDebt: 1500, riskPremium: 2.2 },
    brief: 'Дефицит 6,5% ВВП, долг растёт, рынок нервничает. За восемь кварталов сведите дефицит к 3% ВВП так, чтобы экономика не ушла в минус.',
    goals: [
      { key: 'budgetBalancePctGdp', op: '>=', value: -3, when: 'final', label: 'дефицит к концу ≤ 3% ВВП' },
      { key: 'gdpGrowth', op: '>=', value: -1, when: 'always', label: 'рост ВВП не ниже −1% ни в одном квартале' },
    ],
    debrief: 'Консолидация сжимает спрос через мультипликатор: урезанные закупки бьют по выпуску сильнее, чем выплаты, а госинвестиции ещё и по потенциалу. Резкая экономия в первые кварталы роняет рост и налоговую базу — дефицит сокращается хуже, чем обещала арифметика. Постепенность и выбор инструмента (налоги с низким мультипликатором, закупки аппарата, а не инвестиции) — главный урок.' },
];

// проверка целей по ходу партии: history — записи кварталов 1..N (без стартовой q = 0)
export function evaluateDrill(drill, history) {
  const rows = (history || []).filter((h) => Number.isFinite(h.q) && h.q >= 1 && h.q <= drill.quarters);
  const done = rows.length >= drill.quarters;
  const cmp = (v, g) => (g.op === '<=' ? v <= g.value + 1e-9 : v >= g.value - 1e-9);
  const goals = drill.goals.map((g) => {
    const vals = rows.map((r) => r[g.key]).filter(Number.isFinite);
    if (!vals.length) return { ...g, status: 'pending', value: null };
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
