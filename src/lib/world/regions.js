/* Выделено из engine.js: world/regions.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { clamp, rng } from '../catalog.js';
import { fmt1 } from '../engine.js';
import { makeImpulse, sustainedImpulse } from '../content/events.js';
import { WAR_TARGETS, warTargetOf } from './war.js';

/* Карта страны — семь округов правильным шестиугольным кластером (центр и
   кольцо из шести): осевые координаты гарантируют, что фигуры точно
   стыкуются без наложений и дыр, без ручной подгонки полигонов. Экономику
   отдельно по округам не считаем — это отдельный, гораздо более рискованный
   слой поверх движка (новое измерение состояния, новый баланс); вместо
   этого «напряжение округа» — взвешенная сумма уже существующих индексов
   риска (0..100) с весами по профилю сектора округа, так что карта реагирует
   на настоящее состояние экономики, а не рисует отдельную придуманную цифру. */
/* lean — структурная политическая склонность округа, а не реакция на экономику:
   город исторически голосует против действующей власти, село — за неё, и так
   почти везде, независимо от того, какой сейчас квартал. Реакция на экономику
   добавляется сверху (см. regionVoteShares): округ, которому живётся хуже
   среднего по стране, отворачивается от власти дополнительно. */
export const MAP_REGIONS = [
  { id: 'capital', name: 'Велеградский столичный округ', short: 'Велеградский', city: 'Велеград', loc: 'Велеградском столичном округе', gen: 'Велеградского столичного округа', sector: 'Управление', icon: 'capital', lean: -6,
    weights: { politicalTension: 0.5, bankingRisk: 0.2, debtRisk: 0.3 } },
  { id: 'port', name: 'Янтарская область', short: 'Янтарская', city: 'Янтарск', loc: 'Янтарской области', gen: 'Янтарской области', sector: 'Внешняя торговля', icon: 'port', lean: -2,
    weights: { currencyRisk: 0.55, recessionRisk: 0.25, debtRisk: 0.2 } },
  { id: 'industry', name: 'Кузнецкая область', short: 'Кузнецкая', city: 'Кузнецк', loc: 'Кузнецкой области', gen: 'Кузнецкой области', sector: 'Промышленность', icon: 'industry', lean: -3,
    weights: { recessionRisk: 0.5, inflationRisk: 0.2, bankingRisk: 0.3 } },
  { id: 'agri', name: 'Приреченская область', short: 'Приреченская', city: 'Приреченск', loc: 'Приреченской области', gen: 'Приреченской области', sector: 'Сельское хозяйство', icon: 'agri', lean: 6,
    weights: { inflationRisk: 0.6, recessionRisk: 0.2, currencyRisk: 0.2 } },
  { id: 'finance', name: 'Златоградская область', short: 'Златоградская', city: 'Златоград', loc: 'Златоградской области', gen: 'Златоградской области', sector: 'Финансы', icon: 'finance', lean: -1,
    weights: { bankingRisk: 0.45, debtRisk: 0.35, currencyRisk: 0.2 } },
  { id: 'mining', name: 'Рудногорская область', short: 'Рудногорская', city: 'Рудногорск', loc: 'Рудногорской области', gen: 'Рудногорской области', sector: 'Добыча и энергетика', icon: 'mining', lean: 2,
    weights: { inflationRisk: 0.35, recessionRisk: 0.35, bankingRisk: 0.3 } },
  { id: 'periphery', name: 'Боровская область', short: 'Боровская', city: 'Боровец', loc: 'Боровской области', gen: 'Боровской области', sector: 'Лес, село и услуги', icon: 'periphery', lean: 7,
    weights: { politicalTension: 0.2, recessionRisk: 0.3, inflationRisk: 0.2, currencyRisk: 0.3 } },
];
/* Земли, которые могут войти в состав страны после войны с Норландом (см.
   ANNEX_EFFECT). objective — цель операции, которой была эта земля. Пока земля
   не присоединена, её нет ни на карте областей, ни в голосовании. Присоединённая
   живёт как область, но с лояльностью (annexLoyalty): она стартует низкой, пока
   она ниже PARTISAN_BELOW — там партизаны и саботаж, а голосовать область
   начинает, когда лояльность впервые дойдёт до INTEGRATED_AT. */
export const ANNEX_REGIONS = [
  { id: 'pereval', objective: 'pass', name: 'Перевальский район', short: 'Перевальский', city: 'Перевальск', loc: 'Перевальском районе', gen: 'Перевальского района',
    sector: 'Горный транзит', icon: 'pereval', lean: -4, annex: true, loyalty0: 22,
    weights: { politicalTension: 0.4, recessionRisk: 0.3, currencyRisk: 0.3 } },
  { id: 'halvik', objective: 'mines', name: 'Хальвикский край', short: 'Хальвикский', city: 'Хальвик', loc: 'Хальвикском крае', gen: 'Хальвикского края',
    sector: 'Рудники', icon: 'halvik', lean: -3, annex: true, loyalty0: 18,
    weights: { inflationRisk: 0.35, recessionRisk: 0.35, bankingRisk: 0.3 } },
  { id: 'nordholm', objective: 'city', name: 'Нордхольмская область', short: 'Нордхольмская', city: 'Нордхольм', loc: 'Нордхольмской области', gen: 'Нордхольмской области',
    sector: 'Бывшая столица Норланда', icon: 'nordholm', lean: -9, annex: true, loyalty0: 8,
    weights: { politicalTension: 0.5, recessionRisk: 0.25, inflationRisk: 0.25 } },
];
export const ALL_REGIONS = [...MAP_REGIONS, ...ANNEX_REGIONS];
export const REGION_BY_ID = Object.fromEntries(ALL_REGIONS.map((r) => [r.id, r]));
export const regionById = (id) => REGION_BY_ID[id] || null;
export const ANNEX_REGION_OF = Object.fromEntries(ANNEX_REGIONS.map((r) => [r.objective, r.id]));
export const PARTISAN_BELOW = 35;
export const INTEGRATED_AT = 50;
export const INTEGRATION_COST = 0.08; // % ВВП за квартал на одну область
// области страны сейчас: исходные и присоединённые
export const activeRegions = (s) => [...MAP_REGIONS, ...ANNEX_REGIONS.filter((r) => (s.annexed || []).includes(r.objective))];
// голосуют исходные и уже интегрированные
export const votingRegions = (s) => activeRegions(s).filter((r) => !r.annex || (s.annexIntegrated || []).includes(r.id));
export const annexLoyalty = (s, id) => {
  const v = (s.annexLoyalty || {})[id];
  return Number.isFinite(v) ? v : (regionById(id) || {}).loyalty0 || 0;
};
export function regionStress(region, economy) {
  const fields = {
    politicalTension: clamp(economy.politicalTension || 0, 0, 100),
    bankingRisk: clamp(economy.bankingRisk || 0, 0, 100),
    debtRisk: clamp(economy.debtRisk || 0, 0, 100),
    currencyRisk: clamp(economy.currencyRisk || 0, 0, 100),
    recessionRisk: clamp(economy.recessionRisk || 0, 0, 100),
    inflationRisk: clamp(economy.inflationRisk || 0, 0, 100),
  };
  let sum = 0; let wsum = 0;
  Object.entries(region.weights).forEach(([k, w]) => { sum += (fields[k] || 0) * w; wsum += w; });
  const base = wsum > 0 ? sum / wsum : 0;
  // поверх общенационального фона — то, что случилось именно здесь: достроенные
  // объекты (надолго), недавние события (сходят) и работа на идущей стройке
  const built = (economy.regionMods || {})[region.id] || 0;
  const shock = (economy.regionShock || {})[region.id] || 0;
  const building = (economy.projects || []).some((x) => x.region === region.id) ? -4 : 0;
  // война: прифронтовая область живёт под обстрелом, остальные — в тылу
  const atWar = (economy.warQuartersLeft || 0) > 0;
  const war = atWar ? (warFrontRegion(economy) === region.id ? 22 : 5) : 0;
  // новые земли: чем ниже лояльность, тем неспокойнее
  const unrest = region.annex ? Math.max(0, 60 - annexLoyalty(economy, region.id)) * 0.75 : 0;
  return clamp(base + built + shock + building + war + unrest, 0, 100);
}
/* Где проходит фронт. В обороне противник заходит со степной границы на юго-западе
   (Приреченская область), в наступлении страна сама бьёт на север, из Рудногорской
   области. Карта рисует фронт по той же привязке. */
export const WAR_FRONT_REGION = { defensive: 'agri', offensive: 'mining' };
export function warFrontRegion(economy) {
  if (!((economy.warQuartersLeft || 0) > 0)) return null;
  // в войне за новые земли фронт там, куда бьёт Норланд
  if (economy.warType === 'revanche') return (economy.revancheCampaign && economy.revancheCampaign.next) || null;
  if (economy.warType === 'defensive' && economy.defenseCampaign) return economy.defenseCampaign.next || economy.defenseCampaign.occupied[0] || null;
  if (economy.warType === 'offensive') return WAR_TARGETS[warTargetOf(economy)].front;
  return WAR_FRONT_REGION[economy.warType] || WAR_FRONT_REGION.defensive;
}
/* ============================ СТРОЙКИ В ОКРУГАХ ============================
   У каждого округа — своя большая стройка, отвечающая его характеру: метро в
   Велеграде, глубоководный порт в Янтарске, электростанция в Рудногорских горах. Стройка идёт
   несколько кварталов и всё это время стоит денег (cost — % ВВП в год: это
   госинвестиции сверх ползунка, они входят в ВВП, дефицит и индекс
   инфраструктуры). Пока идёт стройка, в округе есть работа — напряжение ниже.
   Достроенная — навсегда снижает напряжение округа (relief) и даёт свой эффект
   на экономику. Запускает стройку Минфин; живой президент — поверх него. */
export const REGION_PROJECTS = [
  { id: 'metro', region: 'capital', name: 'Велеградское метро', doneHeadline: 'ОТКРЫТО ВЕЛЕГРАДСКОЕ МЕТРО', quarters: 8, cost: 0.35, relief: 12,
    effect: 'Инфраструктура и доверие к власти: столица видит результат каждый день.',
    done: (d) => [makeImpulse('infrastructureIndex', 2.5, 'Открыто велеградское метро', 'fast', d, 'other'),
      makeImpulse('approvalPush', 2.5, 'Открыто велеградское метро', 'fast', d, 'other')] },
  { id: 'deepport', region: 'port', name: 'Глубоководный порт', doneHeadline: 'ОТКРЫТ ГЛУБОКОВОДНЫЙ ПОРТ В ЯНТАРСКЕ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Экспорт растёт: к причалам встают суда, которые раньше шли к соседям.',
    done: (d) => [sustainedImpulse('exportsGrowth', 1.2, 4, 'Глубоководный порт принимает крупные суда'),
      makeImpulse('infrastructureIndex', 1.5, 'Глубоководный порт', 'fast', d, 'other')] },
  { id: 'factories', region: 'industry', name: 'Модернизация заводов', doneHeadline: 'ЗАВОДЫ КУЗНЕЦКА МОДЕРНИЗИРОВАНЫ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Производительность: новые станки выпускают больше тем же числом рук.',
    done: (d) => [makeImpulse('productivity', 1.6, 'Заводы Кузнецкой области модернизированы', 'slow', d, 'other')] },
  { id: 'irrigation', region: 'agri', name: 'Ирригация и элеваторы', doneHeadline: 'ИРРИГАЦИЯ И ЭЛЕВАТОРЫ ПРИРЕЧЬЯ ГОТОВЫ', quarters: 4, cost: 0.2, relief: 12,
    effect: 'Дешевле продовольствие: урожай меньше зависит от погоды и доезжает до города.',
    done: (d) => [makeImpulse('inflationSupply', -0.35, 'Ирригация Приреченской области снижает цены на продовольствие', 'slow', d, 'other')] },
  { id: 'powerplant', region: 'mining', name: 'Новая электростанция', doneHeadline: 'НОВАЯ ЭЛЕКТРОСТАНЦИЯ ДАЛА ТОК', quarters: 8, cost: 0.4, relief: 12,
    effect: 'Дешевле энергия для всей страны: ниже издержки и инфляция предложения.',
    done: (d) => [makeImpulse('inflationSupply', -0.45, 'Новая электростанция удешевляет энергию', 'slow', d, 'other'),
      makeImpulse('infrastructureIndex', 1.5, 'Новая электростанция', 'fast', d, 'other')] },
  { id: 'techpark', region: 'finance', name: 'Технопарк при бирже', doneHeadline: 'ОТКРЫТ ТЕХНОПАРК ЗЛАТОГРАДА', quarters: 5, cost: 0.25, relief: 10,
    effect: 'Производительность и доверие бизнеса: деньги и идеи находят друг друга.',
    done: (d) => [makeImpulse('productivity', 1.0, 'Открыт технопарк Златограда', 'slow', d, 'other'),
      makeImpulse('businessConfidence', 4, 'Открыт технопарк Златограда', 'default', d, 'other')] },
  { id: 'railway', region: 'periphery', name: 'Железная дорога на Боровец', doneHeadline: 'ЖЕЛЕЗНАЯ ДОРОГА ДОШЛА ДО БОРОВЦА', quarters: 7, cost: 0.3, relief: 14,
    effect: 'Боровская область перестаёт пустеть: работа и рынки становятся ближе.',
    done: (d) => [makeImpulse('infrastructureIndex', 2.2, 'Железная дорога дошла до Боровца', 'fast', d, 'other'),
      makeImpulse('laborForce', 0.25, 'Боровская область перестаёт пустеть', 'slow', d, 'other')] },
  // новые земли: стройка там ещё и поднимает лояльность (см. annexStep и regionStep)
  { id: 'tunnel', region: 'pereval', name: 'Тоннель под перевалом', doneHeadline: 'ОТКРЫТ ТОННЕЛЬ ПОД ПЕРЕВАЛОМ', quarters: 6, cost: 0.3, relief: 12,
    effect: 'Перевал проходим круглый год: транзит и экспорт, а район — часть страны не только на карте.',
    done: (d) => [makeImpulse('infrastructureIndex', 1.5, 'Открыт тоннель под перевалом', 'fast', d, 'other'),
      sustainedImpulse('exportsGrowth', 0.8, 4, 'Транзит через тоннель')] },
  { id: 'halvik_mines', region: 'halvik', name: 'Модернизация Хальвикских копей', doneHeadline: 'ХАЛЬВИКСКИЕ КОПИ МОДЕРНИЗИРОВАНЫ', quarters: 5, cost: 0.3, relief: 10,
    effect: 'Новые шахты и обогатительная фабрика: больше руды на экспорт и работа для края.',
    done: (d) => [sustainedImpulse('exportsGrowth', 1.0, 6, 'Модернизированные копи Хальвика'),
      makeImpulse('inflationSupply', -0.2, 'Руда Хальвика дешевеет', 'slow', d, 'other')] },
  { id: 'nordholm_rebuild', region: 'nordholm', name: 'Восстановление Нордхольма', doneHeadline: 'НОРДХОЛЬМ ВОССТАНОВЛЕН', quarters: 8, cost: 0.4, relief: 14,
    effect: 'Город отстраивают после войны: лучший довод для тех, кто ещё ждёт возвращения Норланда.',
    done: (d) => [makeImpulse('approvalPush', 1, 'Нордхольм восстановлен', 'fast', d, 'other'),
      makeImpulse('laborForce', 0.2, 'Нордхольм снова живёт', 'slow', d, 'other')] },
];
export const PROJECT_BY_ID = Object.fromEntries(REGION_PROJECTS.map((p) => [p.id, p]));
export const MAX_ACTIVE_PROJECTS = 3;
// почему стройку сейчас нельзя начать — или null, если можно
export function projectBlocker(p, s) {
  if (!p) return 'такой стройки нет';
  if (!activeRegions(s).some((r) => r.id === p.region)) return 'эта земля не в составе страны';
  if ((s.projectsBuilt || []).includes(p.id)) return 'уже завершено';
  const active = s.projects || [];
  if (active.some((x) => x.id === p.id)) return 'уже строится';
  if (active.length >= MAX_ACTIVE_PROJECTS) return `одновременно — не больше ${MAX_ACTIVE_PROJECTS} строек`;
  if ((s.marketLockoutQuartersLeft || 0) > 0 || s.imfActive) return 'бюджет без доступа к рынку: большие стройки заморожены';
  return null;
}
// первая и последняя очередь стройки стоят меньше полной: разворачивание и сдача
export const projectRamp = (x) => (x.left === x.total || x.left === 1 ? 0.6 : 1);
export const projectSpendPct = (projects) => (projects || []).reduce((a, x) => a + (PROJECT_BY_ID[x.id] || { cost: 0 }).cost * projectRamp(x), 0);

/* ============================ СОБЫТИЯ В ОКРУГАХ ============================
   Округ сам подбрасывает задачу: забастовку, неурожай, аварию. Событие
   вспыхивает в конце квартала, и на следующий квартал на него надо ответить —
   иначе срабатывает вариант «переждать» (defaultOption). Ответ стоит денег
   (spend — % ВВП разово), двигает экономику импульсами и напряжение округа
   (shock — сколько пунктов прибавить к его напряжению; сходит на треть за квартал).
   tone — для ботов: щедрый, дешёвый, жёсткий или выжидательный ответ. */
export const REGION_EVENTS = [
  { id: 'miners_strike', region: 'mining', title: 'Забастовка шахтёров',
    text: (s) => `Горняки Рудногорска остановили добычу: при инфляции ${fmt1(s.inflation)}% зарплата не покрывает жизнь. Профсоюз требует индексации.`,
    weight: (s) => 1 + 0.12 * Math.max(0, s.inflation - 5) + 0.3 * Math.max(0, s.unemployment - 6),
    defaultOption: 'wait',
    options: [
      { id: 'pay', tone: 'generous', label: 'Проиндексировать зарплаты горнякам', spend: 0.15, shock: -12,
        effect: 'Добыча возобновится, но индексация разгоняет цены.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.15, 'Индексация зарплат шахтёрам', 'slow', d, 'other'),
          makeImpulse('approvalPush', 1, 'Требования шахтёров выполнены', 'fast', d, 'other')] },
      { id: 'talks', tone: 'cheap', label: 'Переговоры и обещания', spend: 0.03, shock: -4,
        effect: 'Дёшево, но обещания придётся выполнять — иначе забастовка вернётся.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1, 'Шахтёрам дали обещания', 'fast', d, 'other')] },
      { id: 'crush', tone: 'hard', label: 'Разогнать пикеты', spend: 0, shock: -6,
        effect: 'Шахты заработают, но страна запомнит дубинки.',
        impulses: (s, d) => [makeImpulse('tensionPush', 4, 'Разгон забастовки шахтёров', 'fast', d, 'other'),
          makeImpulse('approvalPush', -3, 'Разгон забастовки шахтёров', 'fast', d, 'other'),
          makeImpulse('govTrust', -3, 'Разгон забастовки шахтёров', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Переждать', spend: 0, shock: 12,
        effect: 'Добыча стоит, энергия дорожает, забастовка расползается.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.25, 'Шахты стоят: энергия дорожает', 'default', d, 'other'),
          makeImpulse('exportsGrowth', -1.5, 'Шахты стоят', 'default', d, 'other'),
          makeImpulse('tensionPush', 2.5, 'Забастовка шахтёров расползается', 'fast', d, 'other')] },
    ] },
  { id: 'drought', region: 'agri', title: 'Засуха и неурожай',
    text: () => 'В Приреченской области засуха: урожай на треть ниже прошлогоднего, хозяйства просят помощи, а в городах начинают дорожать хлеб и крупа.',
    weight: () => 1.1,
    defaultOption: 'wait',
    options: [
      { id: 'import', tone: 'cheap', label: 'Закупить зерно за рубежом', spend: 0.08, shock: -5,
        effect: 'Цены не взлетят, но деньги уйдут соседям, а не своим фермерам.',
        impulses: (s, d) => [makeImpulse('importsGrowth', 2, 'Закупки зерна за рубежом', 'fast', d, 'other')] },
      { id: 'subsidy', tone: 'generous', label: 'Субсидировать фермеров', spend: 0.15, shock: -12,
        effect: 'Хозяйства переживут год, а цены вырастут умеренно.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.15, 'Неурожай: цены на продовольствие', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Пусть рынок разберётся', spend: 0, shock: 10,
        effect: 'Продовольствие заметно дорожает, село злится.',
        impulses: (s, d) => [makeImpulse('inflationSupply', 0.6, 'Неурожай: продовольствие дорожает', 'default', d, 'other'),
          makeImpulse('approvalPush', -1.5, 'Неурожай и дорогой хлеб', 'fast', d, 'other')] },
    ] },
  { id: 'port_accident', region: 'port', title: 'Авария в порту',
    text: () => 'В Янтарске обрушился старый причал: треть терминалов закрыта, суда уходят на рейд или к соседям.',
    weight: (s) => 0.8 + 0.01 * (s.currencyRisk || 0),
    defaultOption: 'wait',
    options: [
      { id: 'repair', tone: 'generous', label: 'Срочный ремонт за счёт бюджета', spend: 0.12, shock: -7,
        effect: 'Через квартал порт работает в полную силу.',
        impulses: (s, d) => [makeImpulse('exportsGrowth', 0.5, 'Порт быстро восстановлен', 'fast', d, 'other')] },
      { id: 'concession', tone: 'cheap', label: 'Отдать терминал в концессию', spend: 0, shock: 3,
        effect: 'Ремонт за счёт инвестора: бизнес доволен, портовики — нет.',
        impulses: (s, d) => [makeImpulse('businessConfidence', 2.5, 'Порт отдан в концессию', 'default', d, 'other'),
          makeImpulse('fdi', 1, 'Порт отдан в концессию', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Чинить в плановом порядке', spend: 0, shock: 8,
        effect: 'Экспорт проседает на несколько кварталов.',
        impulses: (s, d) => [makeImpulse('exportsGrowth', -2.5, 'Порт работает вполсилы', 'default', d, 'other')] },
    ] },
  { id: 'bank_panic', region: 'finance', title: 'Паника вкладчиков в Златограде',
    text: (s) => `У отделений местного банка очереди: слух о его проблемах разошёлся быстрее опровержения. Банковский риск по стране ${Math.round(s.bankingRisk || 0)} из 100.`,
    weight: (s) => 0.5 + 0.03 * Math.max(0, (s.bankingRisk || 0) - 25),
    defaultOption: 'wait',
    options: [
      { id: 'guarantee', tone: 'generous', label: 'Гарантировать вклады', spend: 0.1, shock: -9,
        effect: 'Очереди расходятся, доверие к банкам цело.',
        impulses: (s, d) => [makeImpulse('riskPremium', -0.05, 'Вклады в Златограде гарантированы', 'fast', d, 'other'),
          makeImpulse('consumerConfidence', 1.5, 'Вклады гарантированы', 'fast', d, 'other')] },
      { id: 'bail_in', tone: 'cheap', label: 'Санировать за счёт акционеров', spend: 0, shock: 3,
        effect: 'Бюджет цел, но инвесторы запомнят, что держать акции банков опасно.',
        impulses: (s, d) => [makeImpulse('stockShock', -2, 'Санация банка за счёт акционеров', 'fast', d, 'other'),
          makeImpulse('businessConfidence', -1.5, 'Санация банка за счёт акционеров', 'default', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Не вмешиваться', spend: 0, shock: 10,
        effect: 'Банк лопается, паника перекидывается на соседей.',
        impulses: (s, d) => [makeImpulse('consumerConfidence', -3, 'Лопнул банк в Златограде', 'fast', d, 'other'),
          makeImpulse('riskPremium', 0.12, 'Лопнул банк в Златограде', 'default', d, 'other')] },
    ] },
  { id: 'plant_closure', region: 'industry', title: 'Закрывается градообразующий завод',
    text: (s) => `Кузнецкий машиностроительный объявил о закрытии: заказов нет, кредит дорог (ставка ${fmt1(s.keyRate)}%). Без работы останутся тысячи людей.`,
    weight: (s) => 0.6 + 0.35 * Math.max(0, -(s.outputGap || 0)) + 0.05 * Math.max(0, (s.keyRate || 0) - 8),
    defaultOption: 'wait',
    options: [
      { id: 'order', tone: 'generous', label: 'Дать заводу госзаказ', spend: 0.15, shock: -12,
        effect: 'Завод работает, город спокоен — пока не кончится заказ.',
        impulses: () => [] },
      { id: 'retrain', tone: 'cheap', label: 'Переобучение и пособия', spend: 0.06, shock: -4,
        effect: 'Люди переходят в новые отрасли — медленно, зато навсегда.',
        impulses: (s, d) => [makeImpulse('productivity', 0.3, 'Переобучение рабочих Кузнецка', 'slow', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Не мешать рынку', spend: 0, shock: 10,
        effect: 'Безработица в поясе растёт, рейтинг власти падает.',
        impulses: (s, d) => [makeImpulse('unemployment', 0.25, 'Закрыт завод в Кузнецке', 'default', d, 'other'),
          makeImpulse('approvalPush', -1, 'Закрыт завод в Кузнецке', 'fast', d, 'other')] },
    ] },
  { id: 'capital_rally', region: 'capital', title: 'Митинг у стен правительства',
    // при ручном управлении пресса не пишет ни о рейтинге, ни о «десятках тысяч» —
    // только о «несогласованной акции»
    text: (s) => (s.politicalRegime === 'authoritarian'
      ? `У здания правительства — несогласованная акция. Власти призывают граждан не поддаваться на провокации; напряжённость ${Math.round(s.politicalTension || 0)} из 100.`
      : `На площади перед правительством десятки тысяч человек. Одобрение власти ${Math.round(s.approval)} из 100, напряжённость ${Math.round(s.politicalTension || 0)} из 100.`),
    weight: (s) => 0.3 + 0.03 * Math.max(0, (s.politicalTension || 0) - 30) + 0.03 * Math.max(0, 50 - (s.approval || 50)),
    eligible: (s) => s.politicalRegime !== 'totalitarian',
    defaultOption: 'allow',
    options: [
      { id: 'meet', tone: 'generous', label: 'Выйти к людям', spend: 0, shock: -8,
        effect: 'Разговор вместо оцепления — рейтинг растёт, если есть что сказать.',
        impulses: (s, d) => [makeImpulse('approvalPush', 2, 'Власть вышла к митингующим', 'fast', d, 'other'),
          makeImpulse('tensionPush', -2, 'Власть вышла к митингующим', 'fast', d, 'other')] },
      { id: 'allow', tone: 'cheap', label: 'Разрешить и не мешать', spend: 0, shock: -2,
        effect: 'Митинг проходит спокойно и расходится.',
        impulses: (s, d) => [makeImpulse('tensionPush', -1, 'Митинг прошёл спокойно', 'fast', d, 'other')] },
      { id: 'ban', tone: 'hard', label: 'Запретить митинг', spend: 0, shock: -4,
        effect: 'Площадь пустеет, недовольство уходит внутрь.',
        impulses: (s, d) => [makeImpulse('tensionPush', 3, 'Митинг запрещён', 'fast', d, 'other'),
          makeImpulse('govTrust', -2, 'Митинг запрещён', 'default', d, 'other')] },
    ] },
  { id: 'wildfire', region: 'periphery', title: 'Лесные пожары под Боровцом',
    text: () => 'Горят боровские леса: огонь подходит к посёлкам, дым висит над Боровцом вторую неделю.',
    weight: (s, q) => 0.5 + ((((q % 4) + 4) % 4) === 2 || (((q % 4) + 4) % 4) === 3 ? 0.6 : 0),
    defaultOption: 'regional',
    options: [
      { id: 'army', tone: 'generous', label: 'Бросить армию и авиацию', spend: 0.08, shock: -8,
        effect: 'Огонь сбит за неделю, область видит, что о ней помнят.',
        impulses: (s, d) => [makeImpulse('approvalPush', 1, 'Пожары под Боровцом потушены', 'fast', d, 'other')] },
      { id: 'regional', tone: 'wait', label: 'Пусть справляется область', spend: 0, shock: 9,
        effect: 'Посёлки горят, Боровская область снова чувствует себя забытой.',
        impulses: (s, d) => [makeImpulse('approvalPush', -1.5, 'Боровскую область оставили один на один с пожарами', 'fast', d, 'other')] },
    ] },
  { id: 'youth_exodus', region: 'periphery', title: 'Молодёжь уезжает из Боровской области',
    text: () => 'Школы Боровской области выпускают больше, чем остаётся: молодые семьи уезжают в столицу и за границу.',
    weight: (s) => 0.3 + 0.2 * Math.max(0, (s.unemployment || 0) - 6),
    defaultOption: 'wait',
    options: [
      { id: 'grants', tone: 'generous', label: 'Подъёмные и жильё для молодых', spend: 0.06, shock: -7,
        effect: 'Часть семей остаётся — область стареет медленнее.',
        impulses: () => [] },
      { id: 'wait', tone: 'wait', label: 'Ничего не делать', spend: 0, shock: 5,
        effect: 'Рабочих рук в стране становится чуть меньше.',
        impulses: (s, d) => [makeImpulse('laborForce', -0.15, 'Отток из Боровской области', 'slow', d, 'other')] },
    ] },
  /* Новые земли: события только там, где земля уже присоединена. loyalty — сколько
     пунктов лояльности области прибавит или отнимет ответ (см. annexStep). */
  { id: 'nordholm_underground', region: 'nordholm', title: 'Подполье в Нордхольме',
    text: (s) => `В Нордхольме раскрыта подпольная сеть: листовки, склады оружия, списки «пособников». Лояльность области ${Math.round(annexLoyalty(s, 'nordholm'))} из 100.`,
    eligible: (s) => (s.annexed || []).includes('city'),
    weight: (s) => 0.6 + Math.max(0, 50 - annexLoyalty(s, 'nordholm')) / 30,
    defaultOption: 'wait',
    options: [
      { id: 'amnesty', tone: 'generous', label: 'Амнистия тем, кто сдаст оружие', spend: 0.06, shock: -8, loyalty: 10,
        effect: 'Часть подполья выходит из тени; в столице ворчат о мягкости.',
        impulses: (s, d) => [makeImpulse('approvalPush', -0.5, 'Амнистия подпольщикам Нордхольма', 'fast', d, 'other')] },
      { id: 'sweep', tone: 'hard', label: 'Зачистка кварталов', spend: 0.03, shock: -4, loyalty: -8,
        effect: 'Сеть разгромлена, но каждый обыск рождает новых подпольщиков.',
        impulses: (s, d) => [makeImpulse('tensionPush', 2, 'Зачистка в Нордхольме', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Наблюдать', spend: 0, shock: 8, loyalty: -4,
        effect: 'Подполье растёт и готовит следующий удар.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1.5, 'Подполье в Нордхольме растёт', 'fast', d, 'other')] },
    ] },
  { id: 'halvik_schools', region: 'halvik', title: 'Школы на норландском языке',
    text: () => 'Родители в Хальвике требуют оставить школы на норландском языке. Министерство образования готовит единую программу для всей страны.',
    eligible: (s) => (s.annexed || []).includes('mines'),
    weight: () => 0.9,
    defaultOption: 'wait',
    options: [
      { id: 'allow', tone: 'generous', label: 'Оставить школы на родном языке', spend: 0.02, shock: -6, loyalty: 9,
        effect: 'Край успокаивается; националисты в столице недовольны.',
        impulses: (s, d) => [makeImpulse('approvalPush', -0.6, 'Уступка хальвикским школам', 'fast', d, 'other')] },
      { id: 'ban', tone: 'hard', label: 'Единая программа для всех', spend: 0, shock: 5, loyalty: -10,
        effect: 'Одна страна — одна школа; край запомнит.',
        impulses: (s, d) => [makeImpulse('tensionPush', 1, 'Хальвикские школы закрыты', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Отложить решение', spend: 0, shock: 4, loyalty: -3,
        effect: 'Вопрос висит, и обе стороны считают, что их не слышат.',
        impulses: () => [] },
    ] },
  { id: 'pereval_smuggling', region: 'pereval', title: 'Контрабанда через перевал',
    text: () => 'Через перевал идут фуры без документов: старые норландские связи работают лучше новых таможен.',
    eligible: (s) => (s.annexed || []).includes('pass'),
    weight: () => 0.8,
    defaultOption: 'wait',
    options: [
      { id: 'customs', tone: 'hard', label: 'Закрыть перевал таможней', spend: 0.05, shock: 3, loyalty: -5,
        effect: 'Бюджет получает пошлины, район теряет заработок.',
        impulses: (s, d) => [makeImpulse('importsGrowth', -0.6, 'Таможня на перевале', 'fast', d, 'other')] },
      { id: 'legalize', tone: 'generous', label: 'Легализовать приграничную торговлю', spend: 0, shock: -6, loyalty: 7,
        effect: 'Торговля выходит из тени, а район — из подполья.',
        impulses: (s, d) => [makeImpulse('importsGrowth', 0.8, 'Приграничная торговля на перевале', 'fast', d, 'other')] },
      { id: 'wait', tone: 'wait', label: 'Закрывать глаза', spend: 0, shock: 2, loyalty: 0,
        effect: 'Всё идёт как шло: мимо бюджета.',
        impulses: () => [] },
    ] },
];
export const REGION_EVENT_BY_ID = Object.fromEntries(REGION_EVENTS.map((e) => [e.id, e]));
// то, что видит интерфейс: без функций, с текстом на момент события
export function publicRegionEvent(ev, s, q) {
  return { id: ev.id, region: ev.region, title: ev.title, text: ev.text(s), q, defaultOption: ev.defaultOption,
    options: ev.options.map((o) => ({ id: o.id, label: o.label, effect: o.effect, spend: o.spend, shock: o.shock, tone: o.tone, loyalty: o.loyalty || 0 })) };
}

/* Шаг округов за квартал: ответ на прошлое событие, ход строек, новое событие.
   Возвращает импульсы, разовые расходы и новое состояние — simulateQuarter
   вплетает это в бюджет, ВВП и ленту новостей. */
export function regionStep(s, decisions, difficulty, quarterIndex) {
  const out = { impulses: [], news: [], eventPct: 0, loyaltyDelta: {} };
  // напряжение от прошлых событий сходит на треть за квартал
  const shock = {};
  Object.entries(s.regionShock || {}).forEach(([id, v]) => { const nv = v * 0.65; if (Math.abs(nv) >= 0.5) shock[id] = nv; });
  // 1) ответ на событие прошлого квартала
  let resolution = null;
  const pend = s.regionEvent ? REGION_EVENT_BY_ID[s.regionEvent.id] : null;
  if (pend) {
    const chosen = pend.options.find((o) => o.id === decisions.regionResponse);
    const opt = chosen || pend.options.find((o) => o.id === pend.defaultOption);
    out.impulses.push(...opt.impulses(s, difficulty));
    out.eventPct += opt.spend;
    shock[pend.region] = (shock[pend.region] || 0) + opt.shock;
    if (opt.loyalty) out.loyaltyDelta[pend.region] = (out.loyaltyDelta[pend.region] || 0) + opt.loyalty;
    const region = regionById(pend.region);
    resolution = { id: pend.id, region: pend.region, title: pend.title, option: opt.id, label: opt.label, byDefault: !chosen, q: quarterIndex };
    out.news.push(['gov', `${region.name.toUpperCase()}: ${pend.title.toUpperCase()} — ${chosen ? opt.label.toUpperCase() : 'РЕШЕНИЯ НЕ ПРИНЯЛИ'}`,
      `${chosen ? `Ответ власти: «${opt.label}».` : `Ответа так и не дали — вышло «${opt.label.toLowerCase()}».`} ${opt.effect}${opt.spend ? ` Стоимость — около ${fmt1(opt.spend)}% ВВП.` : ''}`, 7]);
  }
  // 2) стройки: старт, ход, сдача
  let projects = (s.projects || []).map((x) => ({ ...x }));
  const built = [...(s.projectsBuilt || [])];
  const mods = { ...s.regionMods };
  const startP = PROJECT_BY_ID[decisions.startProject];
  if (startP && !projectBlocker(startP, s)) {
    projects.push({ id: startP.id, region: startP.region, left: startP.quarters, total: startP.quarters, startedQ: quarterIndex });
    const region = regionById(startP.region);
    out.news.push(['gov', `СТАРТ СТРОЙКИ: ${startP.name.toUpperCase()}`,
      `${region.name}: ${startP.name.toLowerCase()} — ${startP.quarters} кв. работ, около ${fmt1(startP.cost)}% ВВП в год из бюджета. ${startP.effect}`, 6]);
  }
  const projectPct = projectSpendPct(projects);
  const still = [];
  projects.forEach((x) => {
    const left = x.left - 1;
    if (left > 0) { still.push({ ...x, left }); return; }
    const p = PROJECT_BY_ID[x.id];
    built.push(x.id);
    mods[x.region] = (mods[x.region] || 0) - p.relief;
    out.impulses.push(...p.done(difficulty), makeImpulse('approvalPush', 1, `Сдан объект: ${p.name}`, 'fast', difficulty, 'other'));
    const region = regionById(x.region);
    // на новой земле построенное — лучший довод, что она теперь своя
    if (region.annex) out.loyaltyDelta[x.region] = (out.loyaltyDelta[x.region] || 0) + 15;
    // у каждой стройки свой глагол: метро открывают, копи модернизируют, город восстанавливают
    out.news.push(['gov', p.doneHeadline || `ЗАВЕРШЕНО: ${p.name.toUpperCase()}`, `${region.name}: работы завершены — «${p.name}». ${p.effect} Напряжение в области снижается надолго.`, 8]);
  });
  projects = still;
  // 3) новое событие — не каждый квартал и не раньше третьего
  let cooldown = Math.max(0, (Number.isFinite(s.regionEventCooldown) ? s.regionEventCooldown : 1) - 1);
  let regionEvent = null;
  if (pend) cooldown = Math.max(cooldown, 1);
  if (!pend && cooldown === 0 && quarterIndex >= 3) {
    const pool = REGION_EVENTS.filter((e) => (!e.eligible || e.eligible(s)));
    const stressOf = (id) => regionStress(regionById(id), s);
    const maxStress = Math.max(...activeRegions(s).map((r) => stressOf(r.id)));
    if (pool.length && rng() < clamp(0.22 + 0.004 * maxStress, 0.22, 0.55)) {
      const weights = pool.map((e) => Math.max(0.05, e.weight(s, quarterIndex)) * (1 + stressOf(e.region) / 50));
      let r = rng() * weights.reduce((a, b) => a + b, 0);
      const ev = pool.find((e, i) => { r -= weights[i]; return r <= 0; }) || pool[pool.length - 1];
      regionEvent = publicRegionEvent(ev, s, quarterIndex);
      cooldown = 2;
      const region = regionById(ev.region);
      out.news.push(['crisis', `${region.name.toUpperCase()}: ${ev.title.toUpperCase()}`, `${regionEvent.text} Решение — за правительством: ответ нужен в следующем квартале.`, 8]);
    }
  }
  return { ...out, projects, projectsBuilt: built, regionMods: mods, regionShock: shock, regionEvent,
    regionEventCooldown: cooldown, lastRegionResolution: resolution || s.lastRegionResolution || null, projectPct };
}

/* Бот-Минфин на карте: запускает стройку там, где хуже всего, если бюджет
   позволяет, и отвечает на событие по характеру — популист платит, консерватор
   экономит, технократ платит, только если округ уже на грани. */
export function botRegionPlan(s, P, consolidationNeed) {
  const plan = { startProject: null, regionResponse: null };
  const active = (s.projects || []).length;
  const limit = P.investBias >= 1.2 ? 2 : 1;
  const room = consolidationNeed < 0.5 || (s.outputGap < -2 && P.id !== 'austerity');
  if (active < limit && room) {
    const cands = REGION_PROJECTS.filter((p) => !projectBlocker(p, s))
      .map((p) => ({ p, stress: regionStress(regionById(p.region), s) }))
      .sort((a, b) => b.stress - a.stress);
    if (cands.length) plan.startProject = cands[0].p.id;
  }
  const ev = s.regionEvent ? REGION_EVENT_BY_ID[s.regionEvent.id] : null;
  if (ev) {
    const byTone = (t) => ev.options.find((o) => o.tone === t);
    const stress = regionStress(regionById(ev.region), s);
    const pick = P.id === 'populist' ? (byTone('generous') || byTone('cheap'))
      : P.id === 'austerity' ? (byTone('cheap') || byTone('wait'))
        : (stress >= 45 ? byTone('generous') : byTone('cheap')) || byTone('generous');
    plan.regionResponse = (pick || ev.options.find((o) => o.id === ev.defaultOption)).id;
  }
  // требование группы: популист уступает, экономный обещает, остальные уступают,
  // только если группа уже на грани
  if (s.groupDemand) {
    const v = (s.groupSupport || {})[s.groupDemand.group] ?? 40;
    plan.groupResponse = P.id === 'populist' ? 'concede' : P.id === 'austerity' ? 'promise' : v < 32 ? 'concede' : 'promise';
  }
  // новые земли: популист интегрирует всё, экономный — только самую неспокойную,
  // остальные — пока область не стала своей, если бюджет позволяет
  const annex = activeRegions(s).filter((r) => r.annex && annexLoyalty(s, r.id) < 70)
    .sort((a, b) => annexLoyalty(s, a.id) - annexLoyalty(s, b.id));
  plan.integrate = P.id === 'populist' ? annex.map((r) => r.id)
    : P.id === 'austerity' || consolidationNeed >= 0.8 ? annex.slice(0, 1).map((r) => r.id)
      : annex.map((r) => r.id);
  return plan;
}

