/* ОГЛАВЛЕНИЕ УЧЕБНИКА. Порядок глав — как в первом годе экономического факультета:
   сначала микро, потом макро. Текст готовых глав лежит в chapters/<id>.md (разметка —
   в markdown.js), здесь — только порядок, статус, о чём глава и настоящие учебники.

   Ссылки на учебники даны по названию главы, а не по номеру: номера меняются от
   издания к изданию (и в переводах), названия — почти нет. В скобках — оригинал. */

export const BOOKS = {
  mankiwPrinciples: 'Н. Г. Мэнкью. «Принципы экономикс»',
  mankiwMacro: 'Н. Г. Мэнкью. «Макроэкономика»',
  varian: 'Х. Р. Вэриан. «Микроэкономика. Промежуточный уровень. Современный подход»',
};

export const PARTS = [
  {
    id: 'micro', title: 'Микроэкономика',
    chapters: [
      { id: 'supply-demand', title: 'Спрос и предложение', status: 'ready',
        summary: 'Кривые спроса и предложения, равновесие, сдвиги и движение вдоль кривой, потолок и пол цен.',
        refs: [
          { book: 'mankiwPrinciples', chapter: '«Рыночные силы спроса и предложения» (The Market Forces of Supply and Demand)' },
          { book: 'varian', chapter: '«Рынок» (The Market) и «Равновесие» (Equilibrium)' },
        ] },
      { id: 'elasticity', title: 'Эластичность', status: 'ready',
        summary: 'Эластичность по цене, доходу и перекрёстная; выручка и эластичность; почему спрос на товар фирмы эластичнее рыночного.',
        refs: [
          { book: 'mankiwPrinciples', chapter: '«Эластичность и её применение» (Elasticity and Its Application)' },
          { book: 'varian', chapter: '«Рыночный спрос» (Market Demand)' },
        ] },
      { id: 'costs', title: 'Издержки и прибыль', status: 'ready',
        summary: 'Постоянные и переменные издержки, средние и предельные, бухгалтерская и экономическая прибыль, короткий и длинный период.',
        refs: [
          { book: 'mankiwPrinciples', chapter: '«Издержки производства» (The Costs of Production)' },
          { book: 'varian', chapter: '«Минимизация издержек» (Cost Minimization) и «Кривые издержек» (Cost Curves)' },
        ] },
      { id: 'competition-monopoly', title: 'Совершенная конкуренция и монополия', status: 'ready',
        summary: 'Цена равна предельным издержкам против монопольной наценки; правило закрытия; правило Лернера; безвозвратные потери; ценовая дискриминация.',
        refs: [
          { book: 'mankiwPrinciples', chapter: '«Фирмы на конкурентных рынках» (Firms in Competitive Markets) и «Монополия» (Monopoly)' },
          { book: 'varian', chapter: '«Предложение фирмы» (Firm Supply), «Предложение отрасли» (Industry Supply), «Монополия» (Monopoly) и «Поведение монополии» (Monopoly Behavior)' },
        ] },
      { id: 'oligopoly', title: 'Олигополия и картели', status: 'ready',
        summary: 'Модели Курно и Бертрана, картель и дилемма заключённого: почему сговор выгоден и почему он разваливается.',
        refs: [
          { book: 'mankiwPrinciples', chapter: '«Олигополия» (Oligopoly)' },
          { book: 'varian', chapter: '«Олигополия» (Oligopoly) и «Теория игр» (Game Theory)' },
        ] },
      { id: 'market-failures', title: 'Провалы рынка и налоги', status: 'planned',
        summary: 'Излишки потребителя и производителя, безвозвратные потери от налога, внешние эффекты, общественные блага.',
        cards: ['laffer'] },
    ],
  },
  {
    id: 'macro', title: 'Макроэкономика',
    chapters: [
      { id: 'gdp', title: 'ВВП и система национальных счетов', status: 'planned',
        summary: 'Три способа посчитать ВВП, номинальный и реальный ВВП, дефлятор и индекс потребительских цен.' },
      { id: 'money-banks', title: 'Деньги и банки', status: 'planned',
        summary: 'Функции денег, денежная база и денежная масса, банковский (денежный) мультипликатор.' },
      { id: 'ad-as', title: 'Совокупный спрос и совокупное предложение', status: 'planned',
        summary: 'Модель AD-AS: короткий и длинный период, шоки спроса и предложения, закон Оукена.',
        cards: ['okun'] },
      { id: 'is-lm', title: 'Модель IS-LM', status: 'ready',
        summary: 'Кейнсианский крест, кривые IS и LM, бюджетная и денежная политика, вытеснение, ловушка ликвидности, вывод кривой AD.',
        refs: [
          { book: 'mankiwMacro', chapter: '«Совокупный спрос I: построение модели IS-LM» (Aggregate Demand I: Building the IS–LM Model)' },
          { book: 'mankiwMacro', chapter: '«Совокупный спрос II: применение модели IS-LM» (Aggregate Demand II: Applying the IS–LM Model)' },
          { book: 'mankiwPrinciples', chapter: '«Влияние денежной и бюджетной политики на совокупный спрос» (The Influence of Monetary and Fiscal Policy on Aggregate Demand)' },
        ] },
      { id: 'phillips', title: 'Кривая Филлипса и ожидания', status: 'planned',
        summary: 'Компромисс инфляции и безработицы в коротком периоде, роль ожиданий, естественный уровень безработицы.',
        cards: ['phillips', 'fisher'] },
      { id: 'policy', title: 'Денежная и бюджетная политика', status: 'planned',
        summary: 'Правило Тейлора, трансмиссия ставки, бюджетный мультипликатор, лаги политики.',
        cards: ['multiplier'] },
      { id: 'growth', title: 'Экономический рост: модель Солоу', status: 'planned',
        summary: 'Накопление капитала, устойчивое состояние, золотое правило, технический прогресс.',
        cards: ['solow'] },
      { id: 'open-economy', title: 'Открытая экономика', status: 'planned',
        summary: 'Модель Манделла — Флеминга, плавающий и фиксированный курс, невозможная троица.',
        cards: ['trilemma'] },
      { id: 'public-debt', title: 'Государственный долг', status: 'planned',
        summary: 'Динамика долга, разница ставки и роста, первичный баланс, долговые кризисы.' },
      { id: 'inequality', title: 'Неравенство', status: 'planned',
        summary: 'Кривая Лоренца, коэффициент Джини, относительная и абсолютная бедность, перераспределение.',
        cards: ['lorenz'] },
    ],
  },
];

export const CHAPTERS = PARTS.flatMap((p) => p.chapters.map((c) => ({ ...c, part: p.id })));
export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
// номер главы в сквозной нумерации
export const chapterNo = (id) => CHAPTERS.findIndex((c) => c.id === id) + 1;

// приложения — после глав, в одном порядке чтения с ними
export const APPENDICES = [
  { id: 'cards', title: 'Игра ↔ учебник', summary: 'Восемь идей из учебника: формула, как она устроена в движке и где её видно в игре.' },
  { id: 'limits', title: 'Чем модель не похожа на настоящую', summary: 'Где игра честно расходится с настоящей экономикой и что с этим делать.' },
  { id: 'glossary', title: 'Словарь', summary: 'Все термины курсов и учебника с поиском.' },
];
