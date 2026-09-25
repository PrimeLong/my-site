/* Выделено из engine.js: content/news.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG } from '../catalog.js';
import { REGIME_INFO, fmt1, fmt2, fmtMoney, fmtMoneySigned, fmtSigned1, regimeInfoText } from '../engine.js';
import { makeImpulse } from './events.js';
import { pressControlled } from '../politics/president.js';

/* =========================================================================================
   НОВОСТНОЙ ДВИЖОК: заголовки генерируются из состояния модели, а события разворачиваются
   в многоквартальные сюжеты (цепочки последствий), а не в одно сообщение.
========================================================================================= */
export const ru = (v) => String(v).replace('.', ',');
export const rf1 = (v) => ru(fmt1(v));
export const rf2 = (v) => ru(fmt2(v));
export const rfs = (v) => ru(fmtSigned1(v));
// шаг ставки ходит по сетке 0,25 — округление до десятых превращало его в «+0,3»
export const rfs2 = (v) => ru(Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) : '—');
export let __newsId = 1;
// счётчик живёт в модуле новостей, а поднимать его может и главный цикл квартала
export function bumpNewsId(min) { __newsId = Math.max(__newsId, min); }
export function mkNews(cat, headline, text, opts) {
  const o = opts || {};
  return { id: `n${__newsId++}`, cat, headline, text, priority: o.priority || 4, chain: o.chain || null,
    storyId: o.storyId || null, storyTitle: o.storyTitle || null, step: o.step || null, steps: o.steps || null, tag: o.tag || null };
}

/* ----------------------- СЮЖЕТЫ: цепочки последствий ----------------------- */
export const STORY_TEMPLATES = {
  commodity_down: { id: 'commodity_down', title: 'Падение сырьевых цен', steps: [
    { make: (s) => mkNews('world', `МИРОВЫЕ ЦЕНЫ НА СЫРЬЁ ПАДАЮТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
      'Сырьевые рынки развернулись вниз. Для экспортёров это прямой удар по выручке, для бюджета — по доходам, а дальше цепочка дойдёт до курса и цен в магазинах.', { priority: 7,
        chain: ['Сырьё ↓', 'Экспортная выручка ↓', 'Доходы бюджета ↓', 'Курс ↓', 'Импортные цены ↑', 'Реальные доходы ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `ЭКСПОРТ СОКРАЩАЕТСЯ ДО ${fmtMoney(s.exports)}`,
      `Экспортная выручка падает вслед за ценами. Текущий счёт ${fmtMoneySigned(s.currentAccount)} — приток валюты в страну слабеет, и это уже вопрос курса.`, { priority: 6 }) },
    { gap: 1, make: (s) => (s.budgetBalancePctGdp < 0
      ? mkNews('gov', `БЮДЖЕТ НЕДОСЧИТЫВАЕТСЯ ДОХОДОВ: ДЕФИЦИТ ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП`,
        `Сужение налоговой базы экспортёров бьёт по доходам казны при долге ${rf1(s.debtToGdp)}% ВВП — Минфину предстоит выбирать между сокращением расходов и займами.`, { priority: 6 })
      : mkNews('gov', `БЮДЖЕТ ВЫДЕРЖАЛ СЫРЬЕВОЙ УДАР: ПРОФИЦИТ ${rf1(s.budgetBalancePctGdp)}% ВВП`,
        `Доходы от экспортёров просели, но запас прочности бюджета оказался достаточным. Долг ${rf1(s.debtToGdp)}% ВВП, резервный фонд ${fmtMoney(s.sovereignFund || 0)}.`, { priority: 5 })) },
    { gap: 1, make: (s) => (s.fxDeprAnnual > 0.5
      ? mkNews('markets', `ВАЛЮТА СЛАБЕЕТ: ${rfs(s.fxDeprAnnual)}% В ГОДОВОМ ВЫРАЖЕНИИ`,
        'Платёжный баланс ухудшился — валюта пошла вниз. Следующий шаг цепочки предсказуем: дорожает импорт.', { priority: 6 })
      : mkNews('markets', 'КУРС УСТОЯЛ ВОПРЕКИ УХУДШЕНИЮ БАЛАНСА',
        'Отток валюты по торговому счёту компенсирован притоком капитала или интервенциями. Импортная инфляция в этот раз не придёт — но резервы и доверие инвесторов не бесконечны.', { priority: 5 })) },
    { gap: 1, make: (s) => mkNews('households', `ИМПОРТ ДОРОЖАЕТ, РЕАЛЬНЫЕ ЗАРПЛАТЫ ${s.wageGrowth - s.inflation >= 0 ? 'ЕДВА РАСТУТ' : 'ПАДАЮТ'}`,
      `Цены импорта растут на ${rf1(s.importPriceInflation)}% в год при инфляции ${rf1(s.inflation)}%. Зарплаты прибавляют ${rf1(s.wageGrowth)}% — реальный доход ${rfs(s.wageGrowth - s.inflation)}%. Замыкающее звено цепочки — уровень жизни.`, { priority: 6 }) },
  ] },
  oil_up: { id: 'oil_up', title: 'Сырьевой рост', steps: [
    { make: (s) => mkNews('world', `СЫРЬЁ ДОРОЖАЕТ: ИНДЕКС ${rf1(s.commodityIndex)}`,
      'Мировые цены на сырьё пошли вверх. Для экспортёра это валютная выручка, для импортёра — удар по издержкам.', { priority: 6,
        chain: ['Сырьё ↑', 'Торговый баланс', 'Курс', 'Издержки и цены', 'Решение ЦБ'] }) },
    { gap: 1, make: (s) => (s.tradeBalance >= 0
      ? mkNews('markets', `ПРИТОК ВАЛЮТЫ УКРЕПЛЯЕТ ПОЗИЦИИ: ТОРГОВЫЙ БАЛАНС ${fmtMoneySigned(s.tradeBalance)}`,
        'Экспортная выручка растёт быстрее импорта. Крепкий курс сдержит инфляцию, но ударит по конкурентоспособности несырьевых отраслей.', { priority: 5 })
      : mkNews('business', `ИЗДЕРЖКИ ПРОИЗВОДСТВА РАСТУТ ВСЛЕД ЗА СЫРЬЁМ`,
        `Экономика покупает сырьё дороже, чем продаёт. Инфляция ${rf1(s.inflation)}% — и это инфляция издержек, которую ставкой лечить больнее всего.`, { priority: 6 })) },
    { gap: 2, make: (s) => mkNews('cb', `ЦБ ОЦЕНИВАЕТ ПЕРЕНОС СЫРЬЕВЫХ ЦЕН: ОЖИДАНИЯ ${rf1(s.inflationExpectations)}%`,
      `Ключевой вопрос — закрепится ли ценовой шок в ожиданиях. Пока доверие к ЦБ ${Math.round(s.cbCredibility)} из 100, и от него зависит, придётся ли жертвовать выпуском.`, { priority: 5 }) },
  ] },
  global_rate_hike: { id: 'global_rate_hike', title: 'Ужесточение в мире', steps: [
    { make: (s) => mkNews('world', `МИРОВЫЕ СТАВКИ РАСТУТ ДО ${rf1(s.worldRate)}%`,
      'Крупнейшие центробанки ужесточают политику. Капитал разворачивается в сторону безопасных активов — развивающиеся рынки первыми чувствуют отток.', { priority: 7,
        chain: ['Мировые ставки ↑', 'Отток капитала', 'Курс ↓', 'Импортные цены ↑', 'Ставка ЦБ ↑', 'Кредит ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `ОТТОК КАПИТАЛА: ${fmtMoneySigned(s.netCapitalFlow)} В ГОДОВОМ ВЫРАЖЕНИИ`,
      `Разница реальных ставок с миром ${rfs(s.carry)} п.п. при премии за риск ${rf1(s.riskPremium)} п.п. Инвесторы уходят — резервы ${fmtMoney(s.reserves)}.`, { priority: 6 }) },
    { gap: 1, make: (s) => mkNews('cb', `ДАВЛЕНИЕ НА КУРС СТАВИТ ЦБ ПЕРЕД ВЫБОРОМ`,
      `Валюта ${s.fxDeprAnnual > 0 ? `слабеет на ${rf1(s.fxDeprAnnual)}% годовых` : 'держится'}, инфляция ${rf1(s.inflation)}%. Поднять ставку — задушить кредит; не поднимать — импортировать инфляцию.`, { priority: 6 }) },
  ] },
  bank_run: { id: 'bank_run', title: 'Банковская паника', steps: [
    { make: (s) => mkNews('crisis', 'ВКЛАДЧИКИ ЗАБИРАЮТ ДЕНЬГИ ИЗ БАНКОВ',
      `Ликвидность банковской системы упала до ${Math.round(s.bankLiquidity)} из 100. Банки сокращают выдачу новых кредитов, чтобы удержать наличность.`, { priority: 9,
        chain: ['Отток депозитов', 'Ликвидность ↓', 'Кредит ↓', 'Инвестиции ↓', 'ВВП ↓', 'Просрочка ↑'] }) },
    { gap: 1, make: (s) => mkNews('business', `КРЕДИТ ДЛЯ БИЗНЕСА ПЕРЕСЫХАЕТ: РОСТ ПОРТФЕЛЯ ${rfs(s.creditGrowth)}%`,
      `Ставка по кредитам ${rf1(s.lendingRate)}%, достаточность капитала банков ${rf1(s.bankCapitalAdequacy)}%. Компании откладывают инвестиционные проекты.`, { priority: 7 }) },
    { gap: 1, make: (s) => mkNews('households', `РЫНОК ТРУДА ЧУВСТВУЕТ КРЕДИТНОЕ СЖАТИЕ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}%`,
      `Сокращение инвестиций дошло до занятости. Разрыв выпуска ${rfs(s.outputGap)}% — и чем дольше он отрицательный, тем выше естественный уровень безработицы в будущем.`, { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('markets', `ПРОСРОЧКА РАСТЁТ ДО ${rf1(s.bankNPL)}%: ПЕТЛЯ ЗАМКНУЛАСЬ`,
      'Слабая экономика возвращается в банки неплатежами, неплатежи съедают капитал, капитал ограничивает кредит. Разорвать круг можно только извне — рекапитализацией или смягчением политики.', { priority: 8 }) },
  ] },
  sanctions: { id: 'sanctions', title: 'Внешние ограничения', steps: [
    { make: (_s) => mkNews('world', 'ВВЕДЕНЫ ВНЕШНИЕ ОГРАНИЧЕНИЯ НА ТОРГОВЛЮ И ФИНАНСЫ',
      'Часть торговых и финансовых каналов закрыта. Экономика теряет не только спрос, но и производственные возможности: это шок предложения.', { priority: 9,
        chain: ['Ограничения', 'Экспорт и импорт ↓', 'Отток капитала', 'Курс ↓', 'Инфляция ↑', 'Потенциал ↓'] }) },
    { gap: 1, make: (s) => mkNews('markets', `КУРС ПОД ДАВЛЕНИЕМ, ПРЕМИЯ ЗА РИСК ${rf1(s.riskPremium)} П.П.`,
      `Инвесторы требуют больше за страновой риск, новый госдолг обходится в ${rf1(s.effectiveDebtRate)}%. Резервы ${fmtMoney(s.reserves)} — вопрос, тратить ли их на защиту курса.`, { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('business', `ПОТЕНЦИАЛЬНЫЙ ВЫПУСК СНИЖАЕТСЯ: РОСТ ПОТЕНЦИАЛА ${rf1(s.potentialGrowth)}%`,
      'Разорванные цепочки поставок — это не временная просадка спроса, а утраченные мощности. Стимулировать такую экономику деньгами значит получить инфляцию без выпуска.', { priority: 7 }) },
  ] },
  pandemic: { id: 'pandemic', title: 'Пандемия', steps: [
    { make: (_s) => mkNews('crisis', 'ВСПЫШКА ЗАБОЛЕВАНИЯ: ОГРАНИЧЕНИЯ ЭКОНОМИЧЕСКОЙ АКТИВНОСТИ',
      'Одновременно падают и спрос, и предложение. Редкий случай, когда бюджетная поддержка нужна быстрее денежной.', { priority: 9,
        chain: ['Ограничения', 'Спрос ↓ и мощности ↓', 'Безработица ↑', 'Расходы бюджета ↑', 'Долг ↑'] }) },
    { gap: 1, make: (s) => mkNews('households', `БЕЗРАБОТИЦА ${rf1(s.unemployment)}%, ДОВЕРИЕ НАСЕЛЕНИЯ ${Math.round(s.consumerConfidence)}`,
      'Домохозяйства сокращают расходы и наращивают сбережения. Трансферты сейчас работают сильнее обычного: склонность тратить у людей без дохода максимальна.', { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('gov', `СЧЁТ ЗА КРИЗИС: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Поддержка экономики оплачена займами. Обслуживание долга забирает ${rf1(s.interestToRevenue)}% доходов бюджета — это уже структурное ограничение на будущую политику.`, { priority: 6 }) },
  ] },
  war: { id: 'war', title: 'Война', steps: [
    { make: (s) => mkNews('crisis', 'НАЧАЛАСЬ ВОЙНА: ЭКОНОМИКА ПЕРЕХОДИТ НА ВОЕННЫЕ РЕЛЬСЫ',
      `Торговля и инвестиции сжимаются, инвесторы уходят в защитные активы. ${s.warType === 'offensive'
        ? 'Война носит наступательный характер: партнёры вводят санкции, торговые и финансовые каналы сворачиваются быстрее, чем от одного военного шока.'
        : s.warType === 'defensive'
          ? 'Война носит оборонительный характер: союзники открывают кредитные линии и наращивают закупки — часть удара компенсирует иностранная помощь.'
          : 'Насколько тяжёлым будет удар — во многом решили расходы на оборону, сделанные ещё до войны.'}`, { priority: 10,
        chain: ['Война', 'Торговля ↓ и инвестиции ↓', 'Доверие ↓', 'Издержки ↑', 'Отток капитала'] }) },
    { gap: 1, make: (s) => mkNews('world', `ОБОРОННЫЕ РАСХОДЫ — ${rf1(s.budgetShares.defense)}% БЮДЖЕТА`,
      s.budgetShares.defense >= 20
        ? 'Заранее укреплённая оборона и логистика смягчили удар по экономике — тыл оказался готов.'
        : 'Война застала экономику с низкими расходами на оборону: адаптация обходится дороже и медленнее.', { priority: 7 }) },
    { gap: 2, make: (s) => mkNews('gov', `ЦЕНА ВОЙНЫ: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Военные расходы и потери выпуска ложатся на бюджет. ${s.warType === 'offensive'
        ? 'Санкции отрезали часть внешнего финансирования — дефицит приходится закрывать более дорогим внутренним долгом.'
        : s.warType === 'defensive'
          ? 'Иностранная помощь и льготные кредиты союзников частично разгружают бюджет, но обслуживание долга и оборона всё равно конкурируют за каждый процент.'
          : 'Обслуживание долга и оборона теперь конкурируют за каждый бюджетный процент.'}`, { priority: 6 }) },
  ] },
  tech_breakthrough: { id: 'tech_breakthrough', title: 'Технологический скачок', steps: [
    { make: (s) => mkNews('business', `ТЕХНОЛОГИЧЕСКИЙ ПРОРЫВ: ПРОИЗВОДИТЕЛЬНОСТЬ ${rf1(s.productivity)}`,
      'Новые технологии повышают совокупную факторную производительность. Это редкий шок, который одновременно увеличивает выпуск и снижает инфляцию.', { priority: 6,
        chain: ['Производительность ↑', 'Потенциал ↑', 'Издержки ↓', 'Реальные зарплаты ↑'] }) },
    { gap: 2, make: (s) => mkNews('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rfs(s.wageGrowth - s.inflation)}%`,
      `Рост производительности позволяет платить больше без инфляции: удельные издержки труда ${rf1(s.unitLaborCostGrowth)}%. Потенциальный рост ВВП ${rf1(s.potentialGrowth)}%.`, { priority: 5 }) },
  ] },
  supply_chain: { id: 'supply_chain', title: 'Шок предложения', steps: [
    { make: (_s) => mkNews('world', 'НАРУШЕНЫ ЦЕПОЧКИ ПОСТАВОК',
      'Логистика встала: часть производственных мощностей физически не может работать. Это не падение спроса — это падение того, сколько экономика вообще способна произвести.', { priority: 8 }) },
    { make: (s) => mkNews('business', 'СБОИ ПОСТАВОК: ИЗДЕРЖКИ РАСТУТ, ПОТЕНЦИАЛ СНИЖАЕТСЯ',
      `Производство встало без комплектующих: выпуск падает, разрыв ${rfs(s.outputGap)}%, рост потенциала снизился до ${rf1(s.potentialGrowth)}%. Падает и то, что экономика производит, и то, что она в принципе способна произвести — но цены при этом растут.`, { priority: 8,
        chain: ['Сбои поставок', 'Выпуск ↓', 'Потенциал ↓', 'Издержки ↑', 'Инфляция ↑', 'Дилемма ЦБ'] }) },
    { gap: 1, make: (s) => (s.outputGap < 0 && s.inflation > s.inflationTarget
      ? mkNews('cb', `ДИЛЕММА ЦБ: ИНФЛЯЦИЯ ${rf1(s.inflation)}% ПРИ РАЗРЫВЕ ВЫПУСКА ${rfs(s.outputGap)}%`,
        `Ожидания ${rf1(s.inflationExpectations)}%. Подавлять инфляцию — углублять спад. Терпеть — рисковать срывом ожиданий, после которого возврат к цели обойдётся дороже.`, { priority: 8 })
      : s.outputGap >= 0
        ? mkNews('cb', `ШОК ПРОШЁЛ, НО РАЗРЫВ ВЫПУСКА УЖЕ ${rfs(s.outputGap)}%`,
          `Пока экономика подстраивалась под сбой поставок, спрос успел обогнать восстановившееся предложение: инфляция ${rf1(s.inflation)}% при ожиданиях ${rf1(s.inflationExpectations)}%. Дилемма сменилась на обратную — сдерживать перегрев, а не спасать от спада.`, { priority: 7 })
        : mkNews('cb', `ШОК ПОСТАВОК ПОЗАДИ: ИНФЛЯЦИЯ ${rf1(s.inflation)}% ПРИ РАЗРЫВЕ ВЫПУСКА ${rfs(s.outputGap)}%`,
          `Издержки перестали расти быстрее спроса — цены отпустило раньше, чем закрылся разрыв выпуска. Дилеммы уже нет: пространство поддержать спрос есть, инфляция не мешает.`, { priority: 6 })) },
  ] },
  demographic: { id: 'demographic', title: 'Демографический сдвиг', steps: [
    { make: (_s) => mkNews('households', 'СТАРЕНИЕ НАСЕЛЕНИЯ СЖИМАЕТ РАБОЧУЮ СИЛУ',
      'Предложение труда сокращается. В краткосрочной перспективе это разгон зарплат, в долгосрочной — более низкий потенциальный рост и более низкая нейтральная ставка.', { priority: 6,
        chain: ['Рабочая сила ↓', 'Зарплаты ↑', 'Потенциал ↓', 'Нагрузка на бюджет ↑'] }) },
    { gap: 2, make: (s) => mkNews('gov', `СОЦИАЛЬНЫЕ ОБЯЗАТЕЛЬСТВА ДАВЯТ НА БЮДЖЕТ: БАЛАНС ${rfs(s.budgetBalancePctGdp)}% ВВП`,
      `Меньше работников — меньше налоговая база, больше получателей выплат. Нейтральная ставка r* опустилась до ${rf1(s.rStar)}%: это меняет всю шкалу того, что считать жёсткой политикой.`, { priority: 6 }) },
  ] },
  consumer_boom: { id: 'consumer_boom', title: 'Потребительский бум', steps: [
    { make: (_s) => mkNews('households', 'ДОМОХОЗЯЙСТВА НАРАЩИВАЮТ РАСХОДЫ И СПРОС НА КРЕДИТ',
      'Потребительский оптимизм разгоняет спрос. Пока есть свободные мощности, это рост; когда они закончатся — инфляция.', { priority: 6,
        chain: ['Спрос ↑', 'Разрыв выпуска ↑', 'Инфляция ↑', 'Реакция ЦБ'] }) },
    { gap: 2, make: (s) => (s.outputGap > 1.5
      ? mkNews('markets', `ЭКОНОМИКА ПЕРЕГРЕВАЕТСЯ: РАЗРЫВ ВЫПУСКА ${rfs(s.outputGap)}%`,
        `Инфляция ${rf1(s.inflation)}% при безработице ${rf1(s.unemployment)}% — ниже естественного уровня. Дефицит работников толкает зарплаты вверх на ${rf1(s.wageGrowth)}%.`, { priority: 7 })
      : mkNews('business', 'СПРОС АБСОРБИРОВАН БЕЗ ПЕРЕГРЕВА',
        `Экономика переварила всплеск спроса: разрыв выпуска ${rfs(s.outputGap)}%, инфляция ${rf1(s.inflation)}%. Свободные мощности сделали своё дело.`, { priority: 4 })) },
  ] },
  /* --- сюжеты, которые запускает сам игрок --- */
  /* Сюжет начинается не с объявления решения — его и так печатают либо сводка ЦБ,
     либо общая новость о шаге ставки, — а с того, что происходит дальше. */
  rate_hike: { id: 'rate_hike', title: 'Ужесточение денежной политики', steps: [
    { gap: 2, make: (s) => mkNews('markets', `БАНКИ ПЕРЕНОСЯТ СТАВКУ В КРЕДИТЫ: ${rf1(s.lendingRate)}%`,
      `Перенос ключевой ставки в рыночные идёт с лагом. Рост кредитного портфеля ${rfs(s.creditGrowth)}%, спрос на заёмные деньги остывает.`, { priority: 6 }) },
    { gap: 1, make: (s) => mkNews('business', `ИНВЕСТИЦИИ ЗАМЕДЛЯЮТСЯ: ${rfs(s.investmentGrowth)}%`,
      `Дорогие деньги переписывают инвестиционные планы. Доверие бизнеса ${Math.round(s.businessConfidence)}, разрыв выпуска ${rfs(s.outputGap)}%.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('households', `ЦЕНА ДЕЗИНФЛЯЦИИ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}%, ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
      `Замедление цен оплачено занятостью — это и есть коэффициент жертв. Ожидания ${rf1(s.inflationExpectations)}%: чем выше доверие к ЦБ, тем дешевле обходится такой манёвр.`, { priority: 7 }) },
  ] },
  rate_cut: { id: 'rate_cut', title: 'Смягчение денежной политики', steps: [
    { gap: 2, make: (s) => mkNews('business', `КРЕДИТ ОЖИВАЕТ: ПОРТФЕЛЬ ${rfs(s.creditGrowth)}%`,
      `Инвестиции ${rfs(s.investmentGrowth)}%, доверие бизнеса ${Math.round(s.businessConfidence)}. Кредитный разрыв ${rfs(s.creditGap)} п.п. ВВП — за этим показателем стоит следить: сегодняшний бум завтра вернётся просрочкой.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('cb', `ПРОВЕРКА ОЖИДАНИЙ: ${rf1(s.inflationExpectations)}% ПРИ ЦЕЛИ 4%`,
      `Инфляция ${rf1(s.inflation)}%, доверие к ЦБ ${Math.round(s.cbCredibility)}. Если ожидания сдвинулись вверх, возврат к цели обойдётся дороже, чем стоило смягчение.`, { priority: 6 }) },
  ] },
  vat_hike: { id: 'vat_hike', title: 'Повышение НДС', steps: [
    { make: (s) => mkNews('gov', `НДС ПОВЫШЕН ДО ${rf1(s.vatRate)}%`,
      `Минфин закрывает дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП за счёт косвенного налога. Цены отреагируют почти сразу — это разовый скачок, но ожидания могут его подхватить.`, { priority: 7,
        chain: ['НДС ↑', 'Цены ↑ сразу', 'Реальные доходы ↓', 'Спрос ↓', 'База налога ↓'] }) },
    { gap: 1, make: (s) => mkNews('households', `ЦЕНЫ В МАГАЗИНАХ РАСТУТ: ИНФЛЯЦИЯ ${rf1(s.inflation)}%`,
      `Реальные зарплаты ${rfs(s.wageGrowth - s.inflation)}%, доверие населения ${Math.round(s.consumerConfidence)}. Косвенный налог всегда платит покупатель.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('gov', `СБОР НАЛОГОВ: ${rf1(s.revenuePctGdp)}% ВВП, ТЕНЕВАЯ ЭКОНОМИКА ${rf1(s.shadowShare)}%`,
      'База реагирует на ставку медленно, но необратимо: часть оборота уходит в тень и обратно возвращается неохотно.', { priority: 6 }) },
  ] },
  social_boost: { id: 'social_boost', title: 'Социальный пакет', steps: [
    { make: (s) => mkNews('gov', 'ПРАВИТЕЛЬСТВО РАСШИРЯЕТ СОЦИАЛЬНЫЕ ВЫПЛАТЫ',
      `Выплаты растут при безработице ${rf1(s.unemployment)}% и разрыве выпуска ${rfs(s.outputGap)}%. Мультипликатор трансфертов тем выше, чем больше в экономике свободных мощностей.`, { priority: 7,
        chain: ['Выплаты ↑', 'Располагаемый доход ↑', 'Потребление ↑', 'Спрос ↑', 'Дефицит ↑'] }) },
    { gap: 1, make: (s) => mkNews('households', `ПОТРЕБЛЕНИЕ РАЗГОНЯЕТСЯ: ${rfs(s.consumptionGrowth)}%`,
      `Доверие населения ${Math.round(s.consumerConfidence)}, реальные доходы ${rfs(s.wageGrowth - s.inflation)}%. Деньги дошли до спроса — вопрос, дойдут ли до выпуска или до цен.`, { priority: 6 }) },
    { gap: 2, make: (s) => mkNews('markets', `СЧЁТ ЗА ЩЕДРОСТЬ: ДЕФИЦИТ ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП, ДОЛГ ${rf1(s.debtToGdp)}%`,
      `Премия за риск ${rf1(s.riskPremium)} п.п., ставка по новому долгу ${rf1(s.effectiveDebtRate)}%. Трансферты почти не повышают потенциал — в отличие от инвестиций.`, { priority: 7 }) },
  ] },
  credit_boom: { id: 'credit_boom', title: 'Кредитный бум', steps: [
    { make: (s) => mkNews('markets', `КРЕДИТНЫЙ БУМ: РАЗРЫВ ${rfs(s.creditGap)} П.П. ВВП`,
      `Портфель растёт на ${rfs(s.creditGrowth)}% при номинальном ВВП заметно медленнее. Пока просрочка низкая — ${rf1(s.bankNPL)}%, но именно так начинаются все банковские кризисы.`, { priority: 7,
        chain: ['Дешёвый кредит', 'Долговая нагрузка ↑', 'Просрочка ↑ через 2–3 года', 'Капитал банков ↓', 'Кредитное сжатие'] }) },
    { gap: 4, make: (s) => mkNews('markets', `НАСЛЕДИЕ БУМА: ПРОСРОЧКА ${rf1(s.bankNPL)}%`,
      `Выданные в лёгкие времена кредиты выходят на просрочку. Достаточность капитала банков ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%.`, { priority: 7 }) },
    { gap: 3, make: (s) => (s.bankCapitalAdequacy < s.capitalRequirement + 1.5
      ? mkNews('crisis', 'БАНКИ УПИРАЮТСЯ В НОРМАТИВ КАПИТАЛА',
        `Капитал ${fmtMoney(s.bankCapital)} больше не позволяет наращивать портфель. Кредитное сжатие ударит по инвестициям, инвестиции — по ВВП, ВВП — снова по просрочке.`, { priority: 9 })
      : mkNews('markets', 'БАНКОВСКАЯ СИСТЕМА ПЕРЕВАРИЛА БУМ',
        `Достаточность капитала ${rf1(s.bankCapitalAdequacy)}% — запас прочности выдержал. Кредитный цикл прошёл без срыва.`, { priority: 5 })) },
  ] },
  debt_spiral: { id: 'debt_spiral', title: 'Долговая спираль', steps: [
    { make: (s) => mkNews('gov', `ГОСДОЛГ ПРЕВЫСИЛ ${Math.floor(s.debtToGdp / 5) * 5}% ВВП`,
      `Обслуживание забирает ${rf1(s.interestToRevenue)}% доходов бюджета при ставке ${rf1(s.effectiveDebtRate)}%. Пока номинальный рост экономики выше ставки, долг стабилизируется сам; если нет — начинается спираль.`, { priority: 8,
        chain: ['Долг ↑', 'Премия за риск ↑', 'Ставка по долгу ↑', 'Процентные расходы ↑', 'Дефицит ↑'] }) },
    { gap: 2, make: (s) => mkNews('markets', `ИНВЕСТОРЫ ТРЕБУЮТ ПРЕМИЮ: ${rf1(s.riskPremium)} П.П.`,
      `Каждый новый выпуск дороже предыдущего: средняя ставка по долгу ${rf1(s.effectiveDebtRate)}% против номинального роста ВВП около ${rf1(s.gdpGrowth + s.inflation)}%. Это арифметика, из которой не выйти обещаниями.`, { priority: 8 }) },
  ] },
  credit_crunch: { id: 'credit_crunch', title: 'Кредитное сжатие', steps: [
    { make: (s) => mkNews('crisis', 'КАПИТАЛ БАНКОВ ОГРАНИЧИЛ ВЫДАЧУ КРЕДИТОВ',
      `Достаточность капитала ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%: спрос на кредит есть, предложения нет. Снижение ставки в такой ситуации почти не работает.`, { priority: 9,
        chain: ['Капитал ↓', 'Предложение кредита ↓', 'Инвестиции ↓', 'ВВП ↓', 'Просрочка ↑', 'Капитал ↓'] }) },
    { gap: 2, make: (s) => mkNews('business', `ЭКОНОМИКА БЕЗ КРЕДИТА: ИНВЕСТИЦИИ ${rfs(s.investmentGrowth)}%`,
      `Разрыв выпуска ${rfs(s.outputGap)}%, безработица ${rf1(s.unemployment)}%. Разорвать петлю можно рекапитализацией банков или смягчением норматива — у обоих решений есть цена.`, { priority: 8 }) },
  ] },
  bond_issuance: { id: 'bond_issuance', title: 'Заём про запас', steps: [
    { make: (s) => mkNews('markets', `МИНФИН ЗАНИМАЕТ СВЕРХ НЕОБХОДИМОГО: ДОЛГ ${rf1(s.debtToGdp)}% ВВП`,
      `Размещение прошло не под дефицит этого квартала, а про запас — рынок это видит и закладывает в цену: премия за риск ${rf1(s.riskPremium)} п.п. Резерв в суверенном фонде вырос, но занять заранее — тоже занять.`,
      { priority: 6, chain: ['Размещение сверх дефицита', 'Долг ↑ сразу', 'Премия за риск ↑', 'Резерв в фонде ↑', 'Доступен без нового займа позже'] }) },
    { gap: 2, make: (s) => (s.sovereignFund > 1
      ? mkNews('gov', `СУВЕРЕННЫЙ ФОНД: ${fmtMoney(s.sovereignFund)} В РЕЗЕРВЕ`,
        `Отложенное про запас разместилось не в расходы, а в фонд. Обслуживание долга при этом уже обходится в ${rf1(s.interestToRevenue)}% доходов бюджета — резерв не бесплатен, он занят заранее.`, { priority: 5 })
      : mkNews('markets', 'РЕЗЕРВ УЖЕ РАЗОШЁЛСЯ НА ДЕФИЦИТ',
        `Фонд, пополненный про запас, снова пуст — дефицит следующих кварталов забрал его раньше, чем он успел пригодиться при более выгодных условиях займа.`, { priority: 5 })) },
  ] },
  cds_spike: { id: 'cds_spike', title: 'Ставка против суверена', steps: [
    { make: (s) => mkNews('markets', `СВОП НА ДЕФОЛТ (CDS) ПОДСКОЧИЛ ДО ${Math.round(s.sovereignSpread)} Б.П.`,
      `Инструмент, который прежде почти не двигался, за квартал резко переоценил риск: премия за риск ${rf1(s.riskPremium)} п.п. Это не абстрактная цифра из сводки, а ставка, которую можно купить или продать прямо в трейдерском терминале, — и рынок свопов уже сделал свою.`,
      { priority: 8, chain: ['Скачок спреда', 'CDS дорожает', 'Рынок закладывает риск дефолта', 'Занимать дороже для всех'] }) },
    { gap: 2, make: (s) => (s.sovereignSpread > 250
      ? mkNews('markets', `ПРЕМИЯ ЗА ДЕФОЛТ ОСТАЁТСЯ ВЫСОКОЙ: ${Math.round(s.sovereignSpread)} Б.П.`,
        `Рынок CDS не разворачивается — устойчиво повышенная премия означает, что инвесторы всё ещё считают риск дефолта реальным, а не разовой паникой. Каждый новый выпуск долга занимает по этой цене.`, { priority: 6 })
      : mkNews('markets', 'ПРЕМИЯ ЗА ДЕФОЛТ ОТКАТИЛАСЬ',
        `Своп на дефолт подешевел обратно — рынок решил, что скачок был паникой, а не переоценкой фундаментальных рисков. Доверие к платёжеспособности страны восстановилось быстрее, чем сам долг.`, { priority: 5 })) },
  ] },
};

/* Взаимоисключающие сюжеты. Игрок видел в одной ленте «Падение сырьевых цен,
   часть 4 из 5» и «Сырьевой рост, часть 2 из 3» — мировая цена не может
   одновременно падать и расти, и обе новости объясняли курс противоположными
   причинами. Пока идёт один сюжет пары, встречный не начинается. */
export const STORY_CONFLICTS = {
  commodity_down: ['oil_up'], oil_up: ['commodity_down'],
  credit_boom: ['credit_crunch'], credit_crunch: ['credit_boom'],
  rate_hike: ['rate_cut'], rate_cut: ['rate_hike'],
};
export const storyConflicts = (id, active) => (STORY_CONFLICTS[id] || [])
  .some((other) => (active || []).some((x) => x.tplId === other));

// пауза перед первым шагом сюжета: у части сюжетов первое сообщение — это уже
// следствие, и печатать его в тот же квартал, что и само решение, рано
export const storyStartWait = (id) => {
  const tpl = STORY_TEMPLATES[id];
  return tpl && tpl.steps.length ? Math.max(0, (tpl.steps[0].gap || 1) - 1) : 0;
};

export function advanceStories(stories, next, quarterIndex) {
  const out = []; const keep = [];
  for (const st of (stories || [])) {
    const tpl = STORY_TEMPLATES[st.tplId];
    if (!tpl) continue;
    if (st.wait > 0) { keep.push({ ...st, wait: st.wait - 1 }); continue; }
    const step = tpl.steps[st.nextIdx];
    if (!step) continue;
    const item = step.make(next);
    if (item) out.push({ ...item, q: quarterIndex, storyId: tpl.id, storyTitle: tpl.title, step: st.nextIdx + 1, steps: tpl.steps.length });
    const nextIdx = st.nextIdx + 1;
    if (nextIdx < tpl.steps.length) keep.push({ tplId: st.tplId, nextIdx, wait: (tpl.steps[nextIdx].gap || 1) - 1 });
  }
  return { news: out, stories: keep };
}

/* Что запускает новый сюжет: решения игрока и накопленные состояния */
export function storyTriggers(prev, next, decisions, active, cooldowns) {
  const fire = [];
  const busy = (id) => active.some((x) => x.tplId === id) || (cooldowns[`story:${id}`] || 0) > 0
    || storyConflicts(id, active);
  const dRate = decisions.keyRate - prev.keyRate;
  if (dRate >= 0.75 && !busy('rate_hike')) fire.push('rate_hike');
  if (dRate <= -0.75 && !busy('rate_cut')) fire.push('rate_cut');
  if (decisions.vatRate - prev.vatRate >= 0.5 && !busy('vat_hike')) fire.push('vat_hike');
  if (decisions.transfers >= 3 && prev.transfersGrowth < next.transfersGrowth && !busy('social_boost')) fire.push('social_boost');
  if (next.creditGap > 5.5 && !busy('credit_boom')) fire.push('credit_boom');
  if (next.creditCrunch && !prev.creditCrunch && !busy('credit_crunch')) fire.push('credit_crunch');
  // раньше «Долговая спираль» объясняла разгон долга только выше 80% ВВП — а
  // разрыв «ставка минус рост», из-за которого долг растёт даже при
  // консолидации Минфина, реально кусается и при более скромном долге:
  // вторая ветка ловит это раньше, не дожидаясь, пока цифра станет пугающей
  const debtGrowthGap = next.effectiveDebtRate - next.gdpGrowth - next.inflation;
  if (!busy('debt_spiral') && ((next.debtToGdp > 80 && Math.floor(next.debtToGdp / 10) > Math.floor(prev.debtToGdp / 10))
    || (next.debtToGdp > 50 && next.debtToGdp > prev.debtToGdp + 0.1 && debtGrowthGap > 3))) fire.push('debt_spiral');
  // порог в % ВВП, а не в абсолютных млрд — иначе в разросшейся вдвое экономике
  // тот же сюжет либо запускался бы от любого чиха, либо не запускался вовсе
  if ((decisions.bondIssuance || 0) / Math.max(1, next.nominalGdp) * 100 >= 0.5 && !busy('bond_issuance')) fire.push('bond_issuance');
  // резкий скачок CDS-спреда — отдельное событие от общего «долг дорожает»
  // (та новость про обслуживание долга остаётся, но она про бюджет; здесь —
  // про то, что рынок деривативов уже поставил на дефолт, а инструмент для
  // этого лежит прямо в трейдерском терминале)
  if (!busy('cds_spike') && next.sovereignSpread > 250 && next.sovereignSpread - (prev.sovereignSpread || 0) > 45) fire.push('cds_spike');
  return fire;
}

/* ----------------------- ЕЖЕКВАРТАЛЬНАЯ ЛЕНТА ----------------------- */
export function generateNews(prev, s, decisions, quarterIndex, botAction, cd, extraActions, publicMode) {
  const out = [];
  const push = (cat, headline, text, priority, chain) => out.push({ ...mkNews(cat, headline, text, { priority, chain }), q: quarterIndex });
  // одна и та же тема не повторяется каждый квартал
  const once = (key, gap) => { if ((cd[`news:${key}`] || 0) > 0) return false; cd[`news:${key}`] = gap; return true; };
  const tgt = Number.isFinite(s.inflationTarget) ? s.inflationTarget : CONFIG.target.inflation;

  /* Решение второй ветви власти. Печатается ПЕРЕД блоком ЦБ намеренно: ниже нужно
     знать, попала ли сводка ведомства в ленту. Если попала — общая новость о шаге
     ставки будет тем же фактом второй раз подряд, только с другими цифрами
     инфляции (до и после квартала); если нет (сводка повторяет прошлый курс и
     придержана) — общая новость остаётся единственной, и без неё изменение ставки
     вообще пропало бы из ленты. Порядок в ленте задаётся приоритетом, а не местом
     в коде, так что перестановка ничего не ломает. */
  let cbReported = false;
  const actions = [botAction, ...(extraActions || [])].filter(Boolean);
  // раньше сюда же подмешивался периодический «отчёт о том, что ничего не
  // изменилось» раз в 8 кварталов (once(`bot${ix}`, 8)) — без реального повода
  // это читалось как «зачем вообще об этом писать»; сводка ведомства теперь
  // попадает в ленту, только когда курс или требование правда изменились
  actions.forEach((act) => {
    const isCb = act.institution === 'cb';
    const changedCourse = (isCb ? prev.botHeadline : prev.botHeadline2) !== act.headline;
    const newDemand = act.demand && (isCb ? prev.botDemand : prev.botDemand2) !== act.demand;
    if (changedCourse || newDemand) {
      if (isCb) cbReported = true;
      if (publicMode) {
        push(isCb ? 'cb' : 'gov', act.publicHeadline || act.newsHeadline,
          `${act.publicNote || ''}${act.quote ? ` Из заявления по итогам решения: «${act.quote}»` : ''}`, 7);
      } else {
        push(isCb ? 'cb' : 'gov', act.newsHeadline,
          `${act.newsNote || act.note}${act.quote ? ` Из заявления по итогам решения: «${act.quote}»` : ''}${act.demand ? ` ${act.demand}` : ''}`,
          changedCourse || newDemand ? 8 : 5);
      }
    }
  });

  /* 🏦 ЦЕНТРАЛЬНЫЙ БАНК */
  /* Решение по ставке описывает ЛИБО сводка ведомства (у неё есть и цитата, и
     требование к соседу), ЛИБО — если такой сводки нет, то есть ставку двигал сам
     игрок, — общая новость о шаге. Раньше в ленте стояли обе: «ЦБ ПОВЫШАЕТ СТАВКУ
     ДО 8,75%» и следом «ЦБ УЖЕСТОЧАЕТ ПОЛИТИКУ: СТАВКА 8,75%», да ещё и с разными
     цифрами инфляции — до и после квартала. */
  const dRate = s.keyRate - prev.keyRate;
  if (!cbReported) {
    // верхней границы у шага больше нет: раньше крупное движение (больше 0,75 п.п.)
    // намеренно уступало место сводке ЦБ, а теперь сводка и так печатается отдельно —
    // и без этого условия резкий разворот ставки просто пропадал из ленты
    if (Math.abs(dRate) > 0.01) {
      push('cb', `${dRate > 0 ? 'ЦБ ПОВЫШАЕТ' : 'ЦБ СНИЖАЕТ'} КЛЮЧЕВУЮ СТАВКУ ДО ${rf2(s.keyRate)}%`,
        `Шаг ${rfs2(dRate)} п.п. при инфляции ${rf1(s.inflation)}% и цели ${rf1(tgt)}%. Реальная ставка ${rfs(s.realPolicyRate)}% против нейтральной ${rf1(s.rStar)}% — условия ${s.rateGap > 0.3 ? 'жёстче нейтральных' : s.rateGap < -0.3 ? 'мягче нейтральных' : 'близки к нейтральным'}.`, 6);
    } else if (Math.abs(dRate) < 0.01 && Math.abs(s.inflation - tgt) > 2 && once('hold', 4)) {
      push('cb', `ЦБ СОХРАНЯЕТ СТАВКУ ${rf2(s.keyRate)}% ПРИ ИНФЛЯЦИИ ${rf1(s.inflation)}%`,
        `Бездействие — тоже решение. Ожидания ${rf1(s.inflationExpectations)}%, доверие к ЦБ ${Math.round(s.cbCredibility)} из 100.`, 5);
    }
  }
  const dTarget = tgt - (Number.isFinite(prev.inflationTarget) ? prev.inflationTarget : CONFIG.target.inflation);
  if (Math.abs(dTarget) > 0.01) {
    push('cb', `ЦБ ${dTarget > 0 ? 'ПОВЫШАЕТ' : 'СНИЖАЕТ'} ЦЕЛЬ ПО ИНФЛЯЦИИ ДО ${rf2(tgt)}%`,
      `Смена цели — не бухгалтерская правка, а заявление о намерениях. Доверие к ЦБ ${Math.round(s.cbCredibility)}: ожидания будут привыкать к новой цифре не один квартал, а пока они плавают, любое решение по ставке работает хуже.`, 9,
      ['Смена цели', 'Доверие ↓', 'Ожидания плывут', 'Цена управления инфляцией ↑']);
  }
  if (decisions.fxRegime !== 'free' && Math.abs((decisions.fxTarget || 0) - (prev.fxTarget || 0)) > 0.5) {
    push('cb', `ЦБ ОБЪЯВЛЯЕТ НОВЫЙ ОРИЕНТИР КУРСА: ${rf1(decisions.fxTarget)}`,
      `Защита ориентира оплачивается резервами: сейчас ${fmtMoney(s.reserves)}, расход на удержание курса ${fmtMoneySigned(s.defenseIntervention || 0)} в год.`, 8);
  }
  if (decisions.emergency) {
    push('cb', 'ЦБ ЗАПУСКАЕТ ЭКСТРЕННУЮ ПОДДЕРЖКУ БАНКОВ',
      `Капитал банковской системы пополнен, ликвидность восстановлена до ${Math.round(s.bankLiquidity)}. Плата — денежная эмиссия, инфляционный след и −доверие к ЦБ.`, 9,
      ['Экстренная помощь', 'Капитал банков ↑', 'Денежная масса ↑', 'Инфляция ↑', 'Доверие к ЦБ ↓']);
  }
  if (s.cbCredibility < 40 && prev.cbCredibility >= 40) {
    push('cb', `ДОВЕРИЕ К ЦБ ПАДАЕТ ДО ${Math.round(s.cbCredibility)}: ОЖИДАНИЯ СРЫВАЮТСЯ С ЯКОРЯ`,
      `Инфляционные ожидания ${rf1(s.inflationExpectations)}% вместо цели ${rf1(tgt)}%. Теперь любое снижение инфляции потребует большего падения выпуска, чем раньше.`, 9,
      ['Доверие ↓', 'Ожидания ↑', 'Кривая Филлипса хуже', 'Цена дезинфляции ↑']);
  }
  if (Math.abs(decisions.moneySupplyOp || 0) > 0.5 && once('qe', 2)) {
    push('cb', `ЦБ ${decisions.moneySupplyOp > 0 ? 'ВЫКУПАЕТ АКТИВЫ' : 'ИЗЫМАЕТ ЛИКВИДНОСТЬ'}: ${rfs(decisions.moneySupplyOp)}% ДЕНЕЖНОЙ МАССЫ`,
      `Нестандартные операции при ставке ${rf2(s.keyRate)}%. Эффект на спрос быстрый, на цены — отложенный.`, 6);
  }
  if (decisions.fxRegime !== prev.fxRegime) {
    push('cb', `СМЕНА ВАЛЮТНОГО РЕЖИМА: ${decisions.fxRegime === 'free' ? 'СВОБОДНОЕ ПЛАВАНИЕ' : decisions.fxRegime === 'managed' ? 'УПРАВЛЯЕМЫЙ КУРС' : 'ФИКСИРОВАННЫЙ КУРС'}`,
      `Резервы ${fmtMoney(s.reserves)}. Фиксировать курс значит обменивать инфляцию на резервы — пока резервы есть.`, 8);
  }

  /* 🏛 ПРАВИТЕЛЬСТВО */
  const taxChanges = [
    ['vatRate', 'НДС'], ['incomeTaxRate', 'ПОДОХОДНЫЙ НАЛОГ'], ['profitTaxRate', 'НАЛОГ НА ПРИБЫЛЬ'],
    ['exciseRate', 'АКЦИЗЫ'], ['capitalTaxRate', 'НАЛОГ НА КАПИТАЛ'], ['socialContribRate', 'СОЦИАЛЬНЫЕ ВЗНОСЫ'],
  ];
  taxChanges.forEach(([key, label]) => {
    const dv = s[key] - prev[key];
    if (key === 'vatRate' && dv >= 0.5) return;   // о повышении НДС рассказывает отдельный сюжет
    if (Math.abs(dv) > 0.01) {
      push('gov', `${label} ${dv > 0 ? 'ПОВЫШЕН' : 'СНИЖЕН'} ДО ${rf1(s[key])}%`,
        `Доходы бюджета ${rf1(s.revenuePctGdp)}% ВВП, теневая экономика ${rf1(s.shadowShare)}%. ${dv > 0 ? 'Ставка растёт быстрее, чем доходы: часть базы уходит из-под налога.' : 'Выпадающие доходы придётся компенсировать — займами или расходами.'}`, 6,
        dv > 0 ? ['Ставка ↑', 'Собираемость ↓', 'Теневая экономика ↑', 'База ↓', 'Доходы ↑ слабее ожидаемого'] : null);
    }
  });
  if (Math.abs(s.fiscalImpulse) > 0.35 && once('fiscalImpulse', 4)) {
    push('gov', `БЮДЖЕТНЫЙ ИМПУЛЬС ${rfs(s.fiscalImpulse)} П.П. ВВП`,
      `Мультипликатор сейчас ${s.outputGap < -1 ? 'высокий: свободные мощности превращают расходы в выпуск' : 'низкий: экономика близка к пределу, деньги уходят в цены'}. Дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП.`, 6);
  }
  if (s.interestToRevenue > 15 && prev.interestToRevenue <= 15) {
    push('gov', `ОБСЛУЖИВАНИЕ ДОЛГА ЗАБИРАЕТ ${rf1(s.interestToRevenue)}% ДОХОДОВ БЮДЖЕТА`,
      'Проценты вытесняют из бюджета всё остальное — прежде всего инвестиции и образование, то есть будущий рост.', 8);
  }
  const dSci = s.budgetShares.science - prev.budgetShares.science;
  const dEdu = s.budgetShares.education - prev.budgetShares.education;
  if ((Math.abs(dSci) > 0.4 || Math.abs(dEdu) > 0.4) && once('shares', 8)) {
    push('gov', `ПРИОРИТЕТЫ БЮДЖЕТА МЕНЯЮТСЯ: НАУКА ${rf1(s.budgetShares.science)}%, ОБРАЗОВАНИЕ ${rf1(s.budgetShares.education)}%`,
      `Эти статьи не дают эффекта в этом квартале. Они меняют производительность и человеческий капитал — потенциальный рост сейчас ${rf1(s.potentialGrowth)}%.`, 5,
      ['Наука и образование', 'Человеческий капитал ↑', 'Производительность ↑', 'Потенциальный ВВП ↑ через годы']);
  }

  /* 📊 РЫНКИ */
  if (Math.abs(s.fxDeprAnnual) > 6 && once('fx', 3)) {
    push('markets', `ВАЛЮТА ${s.fxDeprAnnual > 0 ? 'ПАДАЕТ' : 'УКРЕПЛЯЕТСЯ'}: ${rfs(s.fxDeprAnnual)}% В ГОДОВОМ ВЫРАЖЕНИИ`,
      `Текущий счёт ${fmtMoneySigned(s.currentAccount)}, приток капитала ${fmtMoneySigned(s.netCapitalFlow)}, резервы ${fmtMoney(s.reserves)}. Перенос курса в цены импорта: ${rf1(s.importPriceInflation)}%.`, 7,
      s.fxDeprAnnual > 0 ? ['Отток валюты', 'Курс ↓', 'Импорт дорожает', 'Инфляция ↑', 'Реальные доходы ↓'] : null);
  }
  if (s.riskPremium - prev.riskPremium > 0.35 && once('risk', 5)) {
    push('markets', `ПРЕМИЯ ЗА СТРАНОВОЙ РИСК РАСТЁТ ДО ${rf1(s.riskPremium)} П.П.`,
      `Инвесторы закладывают долг ${rf1(s.debtToGdp)}% ВВП, банковский риск ${Math.round(s.bankingRisk)} и согласованность политики ${Math.round(s.policyCoordination)} из 100. Дороже становится всё: госдолг, кредит, капитал.`, 7);
  }
  if (s.reserves < 150 && prev.reserves >= 150) {
    push('markets', `РЕЗЕРВЫ СОКРАТИЛИСЬ ДО ${fmtMoney(s.reserves)}`,
      'Запас прочности для защиты курса тает. Если режим не свободный, рынок начнёт проверять его на прочность.', 8);
  }
  if (s.bankNPL > 7 && s.bankNPL - prev.bankNPL > 0.25 && once('npl', 4)) {
    push('markets', `ПРОСРОЧКА В БАНКАХ ДОСТИГЛА ${rf1(s.bankNPL)}%`,
      `Убытки съедают капитал: достаточность ${rf1(s.bankCapitalAdequacy)}% при требовании ${rf1(s.capitalRequirement)}%. Прибыль сектора ${fmtMoneySigned(s.bankProfit)} за квартал.`, 8,
      ['Просрочка ↑', 'Убытки ↑', 'Капитал ↓', 'Кредитование ↓', 'ВВП ↓', 'Просрочка ↑']);
  }

  /* 🏭 БИЗНЕС */
  if (s.investmentGrowth < -3 && prev.investmentGrowth >= -3 && once('inv', 5)) {
    push('business', `ИНВЕСТИЦИИ ПАДАЮТ НА ${rf1(Math.abs(s.investmentGrowth))}%`,
      `Реальная ставка по кредитам ${rf1(s.realLendingRate)}% против нейтральных ${rf1(s.rStar + 2)}%. Сокращение инвестиций сегодня — это меньший капитал и меньший потенциал завтра.`, 7);
  }
  if (s.businessConfidence < 40 && prev.businessConfidence >= 40) {
    push('business', `ДЕЛОВЫЕ НАСТРОЕНИЯ УХУДШАЮТСЯ: ИНДЕКС ${Math.round(s.businessConfidence)}`,
      `Компании откладывают найм и инвестиции. Разрыв выпуска ${rfs(s.outputGap)}%, банковский риск ${Math.round(s.bankingRisk)}.`, 6);
  }
  if (s.tfpGrowth > prev.tfpGrowth + 0.15 && once('tfp', 6)) {
    push('business', `ПРОИЗВОДИТЕЛЬНОСТЬ УСКОРЯЕТСЯ: ${rf1(s.tfpGrowth)}% В ГОД`,
      `Индекс TFP ${rf1(s.productivity)}, инфраструктура ${rf1(s.infrastructureIndex)}. Единственный источник роста, который не оплачивается инфляцией.`, 5);
  }

  /* 👥 НАСЕЛЕНИЕ */
  const realWage = s.wageGrowth - s.inflation;
  const prevRealWage = prev.wageGrowth - prev.inflation;
  if (realWage < 0 && prevRealWage >= 0) {
    push('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ ПЕРЕШЛИ К ПАДЕНИЮ: ${rfs(realWage)}%`,
      `Номинальный рост ${rf1(s.wageGrowth)}% не поспевает за инфляцией ${rf1(s.inflation)}%. Дальше — слабое потребление и требования индексации.`, 7,
      ['Инфляция ↑', 'Реальные доходы ↓', 'Потребление ↓', 'Спрос ↓']);
  } else if (realWage > 3 && prevRealWage <= 3) {
    push('households', `РЕАЛЬНЫЕ ЗАРПЛАТЫ РАСТУТ НА ${rf1(realWage)}%`,
      `При напряжённости рынка труда ${rfs(s.tightness)} п.п. и производительности ${rf1(s.tfpGrowth)}% рост зарплат ${realWage > s.tfpGrowth + 1.5 ? 'опережает производительность — это будущая инфляция издержек' : 'обеспечен производительностью'}.`, 6);
  }
  if (s.unemployment - prev.unemployment > 0.35 && once('unemp', 4)) {
    push('households', `БЕЗРАБОТИЦА РАСТЁТ ДО ${rf1(s.unemployment)}%`,
      `Естественный уровень ${rf1(s.nairu)}% — разрыв ${rfs(s.unemployment - s.nairu)} п.п. Долгая безработица поднимает и сам естественный уровень: часть потерь станет необратимой.`, 7);
  }
  if (s.tightness > 1.2 && prev.tightness <= 1.2) {
    push('households', `ДЕФИЦИТ РАБОТНИКОВ: БЕЗРАБОТИЦА ${rf1(s.unemployment)}% НИЖЕ ЕСТЕСТВЕННОЙ`,
      `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты ускоряются до ${rf1(s.wageGrowth)}%. Низкая безработица не бесплатна: удельные издержки труда ${rf1(s.unitLaborCostGrowth)}% переходят в цены.`, 7,
      ['Безработица ↓', 'Дефицит кадров', 'Зарплаты ↑', 'Издержки ↑', 'Инфляция ↑', 'Ставка ↑']);
  }
  if (s.consumerConfidence < 35 && prev.consumerConfidence >= 35) {
    push('households', `ПОТРЕБИТЕЛЬСКИЕ НАСТРОЕНИЯ НА МИНИМУМЕ: ${Math.round(s.consumerConfidence)}`,
      'Домохозяйства переходят к сберегательной модели. Спрос будет слабым даже при снижении ставки.', 6);
  }

  /* 🌍 МИР */
  if (Math.abs(s.worldGdpGrowth - prev.worldGdpGrowth) > 0.5 && once('world', 5)) {
    push('world', `МИРОВАЯ ЭКОНОМИКА ${s.worldGdpGrowth > prev.worldGdpGrowth ? 'УСКОРЯЕТСЯ' : 'ЗАМЕДЛЯЕТСЯ'}: ${rf1(s.worldGdpGrowth)}%`,
      `Внешний спрос — это ваш экспорт ${fmtMoney(s.exports)}. Индекс мирового спроса ${rf1(s.worldDemandIndex)}.`, 5);
  }
  if (Math.abs(s.commodityIndex - prev.commodityIndex) > 6 && once('comm', 4)) {
    push('world', `СЫРЬЕВОЙ ИНДЕКС ${s.commodityIndex > prev.commodityIndex ? 'РАСТЁТ' : 'ПАДАЕТ'} ДО ${rf1(s.commodityIndex)}`,
      `Торговый баланс ${fmtMoneySigned(s.tradeBalance)}: страна ${s.tradeBalance >= 0 ? 'выигрывает от дорогого сырья' : 'платит за него'}.`, 5);
  }

  /* ⚠️ КРИЗИС / РЕЖИМ
     Вход в любой кризисный режим уже объявлен ниже, в переходах activeCrises,
     своим более конкретным текстом — а для пандемии и случайно начавшейся войны
     ещё и сюжетной цепочкой с первым эпизодом день в день. Раньше этот общий
     переход дублировал их слово в слово, и игрок получал по три новости об
     одном и том же событии за один квартал. Выход из войны и пандемии тоже
     объявлен отдельно и точнее (санкции снимутся не сразу, помощь союзников
     свернётся и т.д.). Единственный случай, для которого объявлять больше
     нечему, — возврат к норме из порогового режима (рецессия, перегрев,
     дефляция, стагфляция, банковский/долговой/валютный кризис): для них нет
     отдельного текста о выходе. */
  if (s.regime === 'normal' && prev.regime !== 'normal' && prev.regime !== 'war' && prev.regime !== 'pandemic') {
    const info = REGIME_INFO.normal;
    push('crisis', `ЭКОНОМИКА ВОЗВРАЩАЕТСЯ В НОРМАЛЬНЫЙ РЕЖИМ`, regimeInfoText(info, s), 6);
  }

  /* 📊 РЫНОК */
  if (s.stockReturn < -9 && once('crash', 3)) {
    push('markets', `ОБВАЛ НА ФОНДОВОМ РЫНКЕ: ИНДЕКС ${rf1(s.stockReturn)}%`,
      `Индекс опустился до ${rf1(s.stockIndex)}, капитализация ${rf1(s.marketCapPctGdp)}% ВВП. Ставка дисконтирования выросла до ${rf1(s.discountRate)}% — рынок пересчитал будущие прибыли по новой цене денег. Индекс страха ${rf1(s.volatilityIndex)}.`, 8,
      ['Ставка ↑ / риск ↑', 'Дисконт ↑', 'Оценка активов ↓', 'Капитализация ↓', 'Богатство и залоги ↓']);
  } else if (s.stockReturn > 9 && once('rally', 4)) {
    push('markets', `РАЛЛИ НА РЫНКЕ АКЦИЙ: ИНДЕКС ${rfs(s.stockReturn)}%`,
      `Капитализация выросла до ${rf1(s.marketCapPctGdp)}% ВВП при P/E ${rf1(s.stockPE)}. Дешёвые деньги поднимают цены активов быстрее, чем прибыли — именно так надуваются пузыри, которые потом приходится разбирать ставкой.`, 6);
  }
  const SECTORS = [['sectorBanks', 'БАНКОВСКИЙ', 'банки живут маржой и качеством портфеля'],
    ['sectorIndustry', 'ПРОМЫШЛЕННЫЙ', 'промышленность зависит от инвестиционного цикла и стоимости денег'],
    ['sectorConsumer', 'ПОТРЕБИТЕЛЬСКИЙ', 'потребительский сектор следует за реальными доходами'],
    ['sectorResources', 'СЫРЬЕВОЙ', 'сырьевой сектор торгует мировыми ценами и курсом'],
    ['reitIndex', 'НЕДВИЖИМОСТЬ', 'недвижимость переоценивается вслед за ставкой по кредитам']];
  let bestSec = null;
  SECTORS.forEach(([key, label, why]) => {
    if (!prev[key] || !s[key]) return;
    const r = (s[key] / prev[key] - 1) * 100;
    const rel = r - s.stockReturn;
    if (!bestSec || Math.abs(rel) > Math.abs(bestSec.rel)) bestSec = { key, label, why, r, rel };
  });
  if (bestSec && Math.abs(bestSec.rel) > 4.5 && once('sector', 3)) {
    push('markets', `${bestSec.label} СЕКТОР ${bestSec.r >= 0 ? 'ВЫРОС' : 'УПАЛ'} НА ${rf1(Math.abs(bestSec.r))}% — ${bestSec.rel >= 0 ? 'ЛУЧШЕ' : 'ХУЖЕ'} РЫНКА НА ${rf1(Math.abs(bestSec.rel))} П.П.`,
      `Рынок целиком ${rfs(s.stockReturn)}%, но ${bestSec.why}. Расхождение секторов — это подсказка о том, какой канал политики работает прямо сейчас.`, 7);
  }
  if (s.curveInverted && !prev.curveInverted && once('invert', 6)) {
    push('markets', `КРИВАЯ ДОХОДНОСТИ ИНВЕРТИРОВАЛАСЬ: ${rf1(s.curveSlope)} П.П.`,
      `Короткие ставки ${rf1(s.yield3m)}% выше длинных ${rf1(s.yield10y)}%. Рынок фактически говорит: нынешняя жёсткость сломает спрос, и ставку придётся снижать. Исторически это лучший из ранних сигналов рецессии.`, 8,
      ['Ставка ↑', 'Ожидания снижения', 'Инверсия кривой', 'Рецессия через 3–6 кв.']);
  }
  if (s.sovereignSpread > 400 && s.sovereignSpread - (prev.sovereignSpread || 0) > 60 && once('spread', 4)) {
    push('markets', `СУВЕРЕННЫЙ СПРЕД РАСШИРИЛСЯ ДО ${Math.round(s.sovereignSpread)} Б.П.`,
      `Занимать становится дорого: доходность 10 лет ${rf1(s.yield10y)}% при долге ${rf1(s.debtToGdp)}% ВВП. Корпоративный спред ${Math.round(s.corporateSpread)} б.п. — стоимость денег растёт для всех, а не только для бюджета.`, 8);
  }
  if (s.bankPB < 0.35 && once('bankpb', 6)) {
    push('markets', `РЫНОК ОЦЕНИВАЕТ БАНКИ ДЕШЕВЛЕ ИХ КАПИТАЛА: P/B ${rf2(s.bankPB)}`,
      `Инвесторы не верят в отчётный капитал: просрочка ${rf1(s.bankNPL)}%, рентабельность ${rf1(s.bankROE)}%. Привлечь новый капитал с рынка в таком состоянии почти невозможно — а именно он ограничивает кредитование.`, 8,
      ['Просрочка ↑', 'Прибыль ↓', 'Оценка банков ↓', 'Капитал не привлечь', 'Кредит ↓']);
  }

  /* 💬 ГОЛОСА: субъективные реакции людей на то, что происходит */
  const realW = s.wageGrowth - s.inflation;
  const VOICES = [
    { id: 'pensioner_infl', p: 8, when: () => s.inflation > 7,
      q: '«Я перестала смотреть на ценники — всё равно они другие каждую неделю»',
      who: 'Тамара Николаевна, 68 лет, получатель социальных выплат',
      t: () => `Инфляция ${rf1(s.inflation)}% при индексации выплат, отстающей от цен. Для людей с фиксированным доходом инфляция — это не показатель, а прямой вычет из тарелки.` },
    { id: 'mortgage', p: 7, when: () => s.lendingRate > 11,
      q: '«Ставка по кредиту такая, что мы просто отложили покупку квартиры»',
      who: 'Артём и Лена, семья из областного центра',
      t: () => `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(s.inflation)}%. Жёсткая политика работает именно так: сначала отменяются чужие планы, и только потом замедляются цены.` },
    { id: 'smb', p: 7, when: () => s.rateGap > 1.2 || s.creditCrunch,
      q: '«Банк не отказал напрямую — просто перестал отвечать»',
      who: 'Игорь, владелец мебельного производства, 40 сотрудников',
      t: () => `${s.creditCrunch ? 'Капитал банков упёрся в норматив' : 'Кредит подорожал'}: рост портфеля ${rfs(s.creditGrowth)}%. Малый бизнес чувствует денежную политику раньше статистики.` },
    { id: 'worker', p: 8, when: () => s.unemployment > s.nairu + 1.2,
      q: '«На заводе третий месяц неполная неделя»',
      who: 'Сергей, оператор линии',
      t: () => `Безработица ${rf1(s.unemployment)}% против естественных ${rf1(s.nairu)}%. За разрывом выпуска ${rfs(s.outputGap)}% стоят конкретные смены, которых больше нет.` },
    { id: 'hr', p: 6, when: () => s.tightness > 1.0,
      q: '«Мы поднимаем зарплату дважды в год и всё равно не закрываем вакансии»',
      who: 'Марина, директор по персоналу в логистике',
      t: () => `Доля вакансий ${rf1(s.vacancyRate)}%, зарплаты растут на ${rf1(s.wageGrowth)}%. Дефицит кадров приятен для работника и тяжёл для цен.` },
    { id: 'trader', p: 6, when: () => Math.abs(s.fxDeprAnnual) > 7 || s.riskPremium > 3,
      q: '«Рынок торгует не вашей статистикой, а доверием к ней»',
      who: 'Дмитрий, управляющий портфелем',
      t: () => `Премия за риск ${rf1(s.riskPremium)} п.п., курс ${rfs(s.fxDeprAnnual)}% годовых. Резервы ${fmtMoney(s.reserves)} — цифра, которую считают все, кто решает, оставаться ли в стране.` },
    { id: 'foreign_aid', p: 9, when: () => (s.warQuartersLeft || 0) > 0 && s.warType === 'defensive',
      q: '«Кредитная линия союзников пришла быстрее, чем собственный бюджетный перевод»',
      who: 'Представитель профильного ведомства',
      t: () => `Оборонительная война вызывает сочувствие союзников: чистый приток капитала ${fmtMoney(s.netCapitalFlow)}, резервы ${fmtMoney(s.reserves)}. Опираться на чужую щедрость долго нельзя — но пока она держит платёжный баланс.` },
    { id: 'sanctions_exporter', p: 9, when: () => (s.warQuartersLeft || 0) > 0 && s.warType === 'offensive',
      q: '«Полгода назад у нас были контракты на три года вперёд, теперь — ни одного»',
      who: 'Экспортёр промышленного оборудования',
      t: () => `Наступательная война обернулась санкциями: торговый баланс ${fmtMoney(s.tradeBalance)}, премия за риск ${rf1(s.riskPremium)} п.п. Рынки закрываются быстрее, чем открываются новые.` },
    { id: 'econ_hawk', p: 7, when: () => s.inflationExpectations > tgt + 2,
      q: '«Проблема уже не в ценах, а в том, что в цель никто не верит»',
      who: 'Ольга Р., экономист, колонка в деловом еженедельнике',
      t: () => `Ожидания ${rf1(s.inflationExpectations)}% при цели ${rf1(tgt)}%. Заякоренные ожидания — это бесплатный инструмент, а разъякоренные приходится выкупать безработицей.` },
    // «держать жёсткие условия» — упрёк, который имеет смысл, только если условия
    // и правда жёстче нейтральных (s.rateGap > 0.3, тот же порог, что и в остальной
    // ленте): без этого экономист критиковал бы жёсткость на фоне уже смягчённой
    // ставки, а дашборд рядом показывал бы «мягче нейтральных» — прямое противоречие
    { id: 'econ_dove', p: 6, when: () => s.outputGap < -2.5 && s.inflation < tgt + 1 && s.rateGap > 0.3,
      q: '«Мы лечим болезнь, которой нет, и получаем ту, что есть»',
      who: 'Павел К., профессор макроэкономики',
      t: () => `Разрыв выпуска ${rfs(s.outputGap)}% при инфляции ${rf1(s.inflation)}%. Держать жёсткие условия, когда спрос и так слаб, — значит превращать циклическую безработицу в структурную.` },
    { id: 'union', p: 7, when: () => realW < -1,
      q: '«Индексация ниже инфляции — это не повышение, это торг о размере потери»',
      who: 'Представитель профсоюза работников транспорта',
      t: () => `Реальные зарплаты ${rfs(realW)}% при росте номинальных ${rf1(s.wageGrowth)}%. Требования индексации — следующий пункт повестки, а за ними инфляция издержек.` },
    { id: 'biz_tax', p: 7, when: () => s.taxWedgeValue > 42 || s.shadowShare > 20,
      q: '«Половина знакомых перешла на серые схемы — не от жадности, а от арифметики»',
      who: 'Анна, бухгалтер, ведёт два десятка ИП',
      t: () => `Теневая экономика ${rf1(s.shadowShare)}% при налоговом клине ${rf1(s.taxWedgeValue)}. База уходит тихо и возвращается неохотно — даже если ставки потом снизить.` },
    { id: 'depositor', p: 9, when: () => s.bankingRisk > 60,
      q: '«В очереди у банкомата стояли люди, которые никогда там не стояли»',
      who: 'Наблюдение корреспондента в областном центре',
      t: () => `Банковский риск ${Math.round(s.bankingRisk)} из 100, ликвидность ${Math.round(s.bankLiquidity)}. Паника — единственный экономический процесс, который разгоняет сам себя быстрее, чем кто-либо успевает среагировать.` },
    { id: 'optimist', p: 5, when: () => s.gdpGrowth > 3 && s.inflation < tgt + 1.5 && s.unemployment < s.nairu + 0.5,
      q: '«Впервые за годы мы планируем на три года вперёд, а не на квартал»',
      who: 'Руслан, основатель производственной компании',
      t: () => `Рост ${rf1(s.gdpGrowth)}% при инфляции ${rf1(s.inflation)}% и разрыве выпуска ${rfs(s.outputGap)}%. Предсказуемость — тот редкий ресурс, который создаётся политикой, а не покупается.` },
    { id: 'region', p: 6, when: () => (s.sequesterFactor || 1) < 0.995 || s.budgetBalancePctGdp < -7,
      q: '«Нам сказали: стройку заморозить, зарплаты оставить»',
      who: 'Глава администрации небольшого города',
      t: () => `Дефицит ${rf1(Math.abs(s.budgetBalancePctGdp))}% ВВП. Когда бюджет режут, первыми уходят инвестиции — то есть будущий рост, у которого нет своего профсоюза.` },
    { id: 'student', p: 5, when: () => s.unemployment > 6.5,
      q: '«Диплом есть, работы нет — беру любую подработку»',
      who: 'Камиль, выпускник технического вуза',
      t: () => `Безработица ${rf1(s.unemployment)}%. Молодёжь всегда первой выпадает из найма и последней возвращается — отсюда и растущий естественный уровень безработицы ${rf1(s.nairu)}%.` },
    { id: 'farmer', p: 5, when: () => s.commodityIndex > 108 || s.inflation > 7,
      q: '«Солярка подорожала раньше, чем мы успели продать урожай»',
      who: 'Владимир, фермерское хозяйство',
      t: () => `Сырьевой индекс ${rf1(s.commodityIndex)} при инфляции ${rf1(s.inflation)}%. Издержки приходят к производителю быстрее, чем цены его продукции.` },
    { id: 'importer', p: 6, when: () => s.fxDeprAnnual > 5,
      q: '«Мы пересчитываем прайс раз в две недели, и клиенты это ненавидят»',
      who: 'Ксения, импорт бытовой техники',
      t: () => `Курс ослаб на ${rf1(s.fxDeprAnnual)}% годовых, цены импорта растут на ${rf1(s.importPriceInflation)}%. Перенос курса в ценники — самый быстрый канал инфляции.` },
    { id: 'exporter', p: 5, when: () => s.fxDeprAnnual > 4 && s.exports > s.imports * 0.95,
      q: '«Слабый курс — наш единственный бонус за последние годы»',
      who: 'Директор экспортного предприятия',
      t: () => `Торговый баланс ${fmtMoneySigned(s.tradeBalance)}. Девальвация перекладывает доход от покупателя импорта к экспортёру — это перераспределение, а не рост.` },
    { id: 'banker', p: 6, when: () => s.netInterestMargin > 5 || s.bankROE > 15,
      q: '«Мы зарабатываем на разнице ставок, а не на экономике — это тревожный признак»',
      who: 'Зампред одного из крупных банков',
      t: () => `Процентная маржа ${rf2(s.netInterestMargin)} п.п., рентабельность ${rf1(s.bankROE)}%. Когда банкам выгоднее держать деньги, чем кредитовать, страдает инвестиционный цикл.` },
    { id: 'realtor', p: 5, when: () => s.creditGap > 4,
      q: '«Очереди на ипотеку — как в лучшие годы, и это меня пугает»',
      who: 'Агент по недвижимости',
      t: () => `Кредитный разрыв ${rfs(s.creditGap)} п.п. ВВП. Кредитные бумы приятны в моменте и дороги через два-три года, когда приходит просрочка.` },
    { id: 'nurse', p: 6, when: () => s.budgetShares.health < 15,
      q: '«В больнице снова нет расходников, зато есть оптимизация»',
      who: 'Медсестра районной больницы',
      t: () => `Доля здравоохранения ${rf1(s.budgetShares.health)}% бюджетных расходов. Это не только про людей — человеческий капитал ${rf1(s.humanCapitalIndex)} прямо входит в потенциальный ВВП.` },
    { id: 'teacher', p: 6, when: () => s.budgetShares.education < 14,
      q: '«Молодые учителя не приходят, а старые уходят»',
      who: 'Директор школы',
      t: () => `На образование идёт ${rf1(s.budgetShares.education)}% расходов. Эффект этой цифры вы увидите не в этом квартале, а через десять лет — в темпе роста потенциала ${rf1(s.potentialGrowth)}%.` },
    { id: 'scientist', p: 5, when: () => s.budgetShares.science < 3,
      q: '«Лаборатория закрыта, гранта нет, коллеги уехали»',
      who: 'Научный сотрудник института',
      t: () => `Наука получает ${rf1(s.budgetShares.science)}% расходов. Производительность ${rf1(s.productivity)} растёт на ${rf1(s.tfpGrowth)}% в год — единственный источник роста, который не оплачивается инфляцией.` },
    { id: 'engineer_boom', p: 5, when: () => s.investmentGrowth > 5,
      q: '«Нам впервые за годы согласовали новую линию»',
      who: 'Главный инженер завода',
      t: () => `Инвестиции растут на ${rf1(s.investmentGrowth)}% при реальной ставке по кредитам ${rf1(s.realLendingRate)}%. Сегодняшние инвестиции — это завтрашний потенциал, а не сегодняшний спрос.` },
    { id: 'retiree_ok', p: 4, when: () => s.inflation < s.inflationTarget + 0.5 && s.wageGrowth - s.inflation > 0,
      q: '«Я снова понимаю, сколько стоит поход в магазин»',
      who: 'Галина Петровна, пенсионерка',
      t: () => `Инфляция ${rf1(s.inflation)}% при цели ${rf1(tgt)}%. Предсказуемость цен — та форма благополучия, которую замечают, только когда её теряют.` },
    { id: 'fund_manager', p: 6, when: () => s.volatilityIndex > 45,
      q: '«Мы вышли в короткие облигации и ждём — рынок не про фундамент сейчас»',
      who: 'Управляющий пенсионным фондом',
      t: () => `Индекс страха ${rf1(s.volatilityIndex)}, премия за риск акций ${rf1(s.equityRiskPremium)}%. Когда все уходят в короткие бумаги, длинные деньги для экономики исчезают.` },
    { id: 'ceo_invert', p: 7, when: () => s.curveInverted,
      q: '«Банк предлагает депозит доходнее, чем мой собственный проект»',
      who: 'Основатель промышленной группы',
      t: () => `Короткие ставки ${rf1(s.yield3m)}% против длинных ${rf1(s.yield10y)}%. Инверсия кривой — это когда экономике выгоднее ждать, чем строить.` },
    { id: 'accountant_sequester', p: 8, when: () => (s.sequesterFactor || 1) < 0.995,
      q: '«Контракты подписаны, деньги отозваны — объясняйте это подрядчикам сами»',
      who: 'Финансовый директор госпредприятия',
      t: () => `Секвестр урезал расходы на ${rf1((1 - s.sequesterFactor) * 100)}%. Когда рынок отказывается финансировать дефицит, выбор делает уже не правительство.` },
    /* Голос обозревателя перед выборами. Двойная проверка режима: при
       тоталитаризме счётчик до выборов замирает на своём последнем значении
       (выборов больше нет), и без первого условия этот голос звучал бы в
       стране без урн бесконечно — «До выборов 3 кв.» кряду десятки лет.
       А подконтрольная пресса, даже когда выборы формально проводятся, не
       печатает рейтинг власти — ровно то, на что жаловался игрок. */
    { id: 'journalist_elect', p: 6, when: () => !s.noElections && s.quartersToElection <= 3,
      q: '«Обещаний в этом квартале больше, чем в предыдущие два года»',
      who: 'Политический обозреватель',
      t: () => (pressControlled(s)
        ? `До голосования ${s.quartersToElection} кв. Предвыборные расходы государства всё равно оплачиваются после голосования — обычно ставкой.`
        : `До выборов ${s.quartersToElection} кв., рейтинг власти ${Math.round(s.approval)}. Предвыборные расходы всегда оплачиваются после выборов — обычно ставкой.`) },
    { id: 'mayor_fund', p: 4, when: () => (s.fundPctGdp || 0) > 4,
      q: '«Впервые за долгое время у страны есть подушка, а не только долги»',
      who: 'Экономический обозреватель',
      t: () => `Суверенный фонд ${fmtMoney(s.sovereignFund)} (${rf1(s.fundPctGdp)}% ВВП) при долге ${rf1(s.debtToGdp)}% ВВП. Чистый долг ${rf1(s.netDebtToGdp)}% — именно эту цифру смотрят инвесторы.` },
    { id: 'trader_street', p: 5, when: () => Math.abs(s.stockReturn) > 6,
      q: () => (s.stockReturn > 0 ? '«Все вдруг стали экспертами по акциям»' : '«Портфель за квартал похудел сильнее, чем я за год»'),
      who: 'Частный инвестор',
      t: () => `Индекс ${rfs(s.stockReturn)}% за квартал, капитализация ${rf1(s.marketCapPctGdp)}% ВВП. Цены активов реагируют на ставку раньше, чем выпуск и занятость.` },
    { id: 'union_strike', p: 8, when: () => (s.wageGrowth - s.inflation) < -2.5,
      q: '«Если индексации не будет, встанут цеха»',
      who: 'Забастовочный комитет',
      t: () => `Реальные зарплаты ${rfs(s.wageGrowth - s.inflation)}%. Дальше либо индексация и инфляция издержек, либо конфликт — третьего пути у этой развилки обычно нет.` },
    { id: 'econ_coord', p: 6, when: () => s.policyCoordination < 35,
      q: '«Одно ведомство жмёт газ, другое — тормоз, а изнашивается вся машина»',
      who: 'Профессор, бывший советник правительства',
      t: () => `Согласованность политики ${Math.round(s.policyCoordination)} из 100. Несогласованность стоит стране премии за риск ${rf1(s.riskPremium)} п.п. и лишних процентов по долгу.` },
    { id: 'young_family', p: 5, when: () => s.lendingRate < 7 && s.inflation < 6,
      q: '«Мы взяли кредит на ремонт — впервые ставка выглядит разумной»',
      who: 'Молодая семья',
      t: () => `Ставка по кредитам ${rf1(s.lendingRate)}% при инфляции ${rf1(s.inflation)}%. Дешёвые деньги приятны домохозяйствам и опасны балансам банков — вопрос в том, надолго ли.` },
    { id: 'saver', p: 5, when: () => s.depositRate - s.inflation < -2,
      q: '«Деньги на вкладе тают, но куда их ещё нести — непонятно»',
      who: 'Виктор, инженер, откладывает на образование детей',
      t: () => `Реальная ставка по депозитам ${rfs(s.depositRate - s.inflation)}%. Отрицательная реальная доходность — это налог, который никто не голосовал.` },
  ];
  const BASELINE_VOICES = [
    { id: 'base_wage', p: 3, when: () => realW >= 0.5,
      q: '«Зарплата наконец обгоняет ценники — не сильно, но обгоняет»',
      who: 'Николай, мастер на складе',
      t: () => `Реальные доходы ${rfs(realW)}% при инфляции ${rf1(s.inflation)}%. Такие кварталы люди запоминают лучше, чем любые показатели с панели.` },
    { id: 'base_orders', p: 3, when: () => s.gdpGrowth < s.potentialGrowth - 0.3,
      q: '«Заказов стало меньше, но увольнять пока некого»',
      who: 'Елена, владелица типографии',
      t: () => `Рост ${rf1(s.gdpGrowth)}% при потенциале ${rf1(s.potentialGrowth)}%. Бизнес сначала теряет выручку и только потом сокращает людей — поэтому безработица всегда опаздывает.` },
    { id: 'base_analyst', p: 3, when: () => true,
      q: () => (s.policyCoordination < 45
        ? '«Два ведомства тянут экономику в разные стороны, и оплачивает это третий — гражданин»'
        : '«Политика выглядит связной, а связность сама по себе стоит процента роста»'),
      who: 'Еженедельный экономический обзор',
      t: () => `Согласованность политики ${Math.round(s.policyCoordination)} из 100 при ставке ${rf2(s.keyRate)}% и балансе бюджета ${rfs(s.budgetBalancePctGdp)}% ВВП. Когда бюджет разгоняет спрос, а ЦБ его тормозит, обе стороны тратят ресурсы впустую.` },
    { id: 'base_street', p: 2, when: () => true,
      q: () => (s.inflation > tgt + 1 ? '«Цены в магазине у дома объясняют экономику лучше любого отчёта»' : '«Ценники стоят на месте, и это уже новость»'),
      who: 'Опрос на улице, областной центр',
      t: () => `Инфляция ${rf1(s.inflation)}% при цели ${rf1(tgt)}%, потребительские настроения ${Math.round(s.consumerConfidence)} из 100. Люди судят об экономике по корзине, а не по разрыву выпуска.` },
  ];
  // не больше одного мнения за квартал: два голоса подряд в одной и той же
  // рубрике читались как заполнение места, а не как две отдельные причины
  // говорить с читателем
  let picked = VOICES.filter((v) => v.when()).sort((a, b) => b.p - a.p).filter((v) => once(`op:${v.id}`, 7)).slice(0, 1);
  if (picked.length === 0) {
    const pool = BASELINE_VOICES.filter((v) => v.when());
    const rot = pool.map((_, i) => pool[(((i + quarterIndex) % pool.length) + pool.length) % pool.length]); // предыстория — отрицательные кварталы
    picked = rot.filter((v) => once(`op:${v.id}`, 4)).slice(0, 1);
  }
  picked.forEach((v) => push('opinion', typeof v.q === 'function' ? v.q() : v.q, `${v.who}. ${v.t()}`, 4));

  return out;
}

/* Импульсы решений: то, что действует не мгновенно и не через запас (ставки, кредит) */
export function buildDecisionImpulses(dec, s, difficulty) {
  const out = [];
  const dVat = dec.vatRate - s.vatRate;
  if (Math.abs(dVat) > 1e-6) {
    out.push(makeImpulse('vatPrices', dVat * CONFIG.coef.vatPass, `Изменение НДС до ${dec.vatRate.toFixed(1)}% напрямую переносится в розничные цены`, 'fast', difficulty, 'inflation'));
    out.push(makeImpulse('consumption', -dVat * 0.35, `Изменение НДС до ${dec.vatRate.toFixed(1)}% меняет реальные доходы домохозяйств`, 'default', difficulty));
  }
  const dExcise = dec.exciseRate - s.exciseRate;
  if (Math.abs(dExcise) > 1e-6) {
    out.push(makeImpulse('vatPrices', dExcise * 0.12, `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`, 'fast', difficulty, 'inflation'));
    out.push(makeImpulse('consumption', -dExcise * 0.14, `Изменение акцизов до ${dec.exciseRate.toFixed(1)}%`, 'default', difficulty));
  }
  const dIncome = dec.incomeTaxRate - s.incomeTaxRate;
  if (Math.abs(dIncome) > 1e-6) out.push(makeImpulse('consumption', -dIncome * 0.30, `${dIncome > 0 ? 'Повышение' : 'Снижение'} подоходного налога до ${dec.incomeTaxRate.toFixed(1)}% меняет располагаемый доход`, 'default', difficulty));
  const dSocial = dec.socialContribRate - s.socialContribRate;
  if (Math.abs(dSocial) > 1e-6) {
    out.push(makeImpulse('unemployment', dSocial * 0.045, `Изменение социальных взносов до ${dec.socialContribRate.toFixed(1)}% меняет стоимость труда для работодателя`, 'default', difficulty));
    out.push(makeImpulse('investment', -dSocial * 0.20, `Изменение социальных взносов до ${dec.socialContribRate.toFixed(1)}%`, 'default', difficulty));
  }
  const dProfit = dec.profitTaxRate - s.profitTaxRate;
  if (Math.abs(dProfit) > 1e-6) out.push(makeImpulse('businessConfidence', -dProfit * 0.8, `${dProfit > 0 ? 'Повышение' : 'Снижение'} налога на прибыль до ${dec.profitTaxRate.toFixed(1)}%`, 'default', difficulty, 'other'));
  const dCapital = dec.capitalTaxRate - s.capitalTaxRate;
  if (Math.abs(dCapital) > 1e-6) out.push(makeImpulse('capitalFlow', -dCapital * 6, `Изменение налога на капитал до ${dec.capitalTaxRate.toFixed(1)}% влияет на приток капитала`, 'default', difficulty));
  if (Math.abs(dec.moneySupplyOp || 0) > 1e-6) {
    out.push(makeImpulse('inflationSupply', dec.moneySupplyOp * 0.14, `${dec.moneySupplyOp > 0 ? 'Расширение' : 'Сжатие'} денежной массы на ${fmtSigned1(dec.moneySupplyOp)}%`, 'slow', difficulty, 'inflation'));
    out.push(makeImpulse('investment', dec.moneySupplyOp * 0.35, `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`, 'default', difficulty));
    out.push(makeImpulse('creditDemand', dec.moneySupplyOp * 0.4, `Операции с денежной массой (${fmtSigned1(dec.moneySupplyOp)}%)`, 'default', difficulty));
  }
  if (dec.emergency) {
    out.push(makeImpulse('inflationSupply', 0.45, 'Экстренная поддержка банков: эмиссионное финансирование', 'slow', difficulty, 'inflation'));
    out.push(makeImpulse('govTrust', -2.5, 'Экстренная поддержка банков за счёт бюджета и эмиссии', 'fast', difficulty, 'other'));
  }
  const dReserve = dec.reserveReq - s.reserveReq;
  if (Math.abs(dReserve) > 1e-6) out.push(makeImpulse('creditDemand', -dReserve * 0.5, `Изменение нормы резервирования до ${dec.reserveReq.toFixed(1)}%`, 'default', difficulty, 'banking'));
  const bondIssuance = Math.max(0, dec.bondIssuance || 0);
  if (bondIssuance > 0.01) {
    // рынок читает размещение сверх необходимого как сигнал: раз занимают, не
    // будучи прижатыми дефицитом, значит готовятся к чему-то — премия растёт
    // пропорционально размеру размещения относительно экономики, а не самой сумме
    out.push(makeImpulse('riskPremium', bondIssuance / Math.max(1, s.nominalGdp) * 100 * 0.6,
      `Минфин разместил облигации на ${fmtMoney(bondIssuance)} сверх необходимого для покрытия дефицита`, 'default', difficulty));
  }
  return out.filter((im) => im.values.some((x) => Math.abs(x) > 1e-9));
}

