/* =========================================================================================
   ПРЕДПРИНИМАТЕЛЬ: своя компания внутри экономики страны
   Игрок не двигает ни одного государственного рычага — ставку ведёт бот-ЦБ, бюджет
   бот-Минфин. Зато всё, что они делают, приходит к нему как к бизнесу: спрос идёт от
   ВВП и доверия, цены сырья — от курса и инфляции, кредит — от ставки и состояния
   банков, налог — от решения Минфина, а проверки и «добровольные взносы» — от режима.
   Компания маленькая относительно страны и на макроэкономику не влияет: она живёт в
   ней, как трейдер, только не на бирже, а в цеху.

   Деньги — в тех же «млн», что и остальная игра. Один квартал — один ход.
========================================================================================= */
import { clamp, rng, SECTORS } from './catalog.js';

export { SECTORS };

const Q = 4;
const sectorOf = (id) => SECTORS.find((s) => s.id === id) || SECTORS[0];

/* Параметры отраслей: сколько стоит единица продукции и сырья, какая доля сырья
   импортная, насколько покупатель чувствителен к цене, сколько выпускает работник,
   во что обходится расширение и от чего зависит спрос. Отличаются отрасли прежде
   всего тем, какой макропоказатель для них главный: курс, доверие людей или ставка. */
const P = {
  factory: { price: 0.4, mat: 0.2, imp: 0.45, elast: 1.8, wage: 0.12, prod: 1.25, fixed: 0.026,
    dom: 760, exp: 360, capex: 0.8, capacity: 1100, staff: 800, cash: 120, debt: 300 },
  retail: { price: 0.4, mat: 0.24, imp: 0.55, elast: 3.0, wage: 0.1, prod: 1.0, fixed: 0.028,
    dom: 980, exp: 0, capex: 0.5, capacity: 1100, staff: 1000, cash: 150, debt: 200 },
  builder: { price: 0.4, mat: 0.19, imp: 0.2, elast: 1.3, wage: 0.13, prod: 1.4, fixed: 0.028,
    dom: 950, exp: 0, capex: 0.6, capacity: 1100, staff: 715, cash: 200, debt: 420 },
};

// спрос на рынке компании относительно стартовой экономики — у каждой отрасли свой «мотор»
export function demandIndex(sector, e) {
  const g = Math.max(0.2, (e.gdp || 2000) / 2000);
  const cc = clamp((e.consumerConfidence ?? 55) / 55, 0.3, 1.8);
  const bc = clamp((e.businessConfidence ?? 55) / 55, 0.3, 1.8);
  if (sector === 'retail') return g * Math.pow(cc, 0.6);
  // жильё покупают в ипотеку: ставка по кредитам — главный рычаг спроса
  if (sector === 'builder') return Math.pow(g, 1.4) * Math.pow(cc, 0.4) * Math.exp(-0.06 * ((e.lendingRate ?? 7.92) - 7.92));
  return Math.pow(g, 1.2) * Math.pow(bc, 0.35);
}

// внешний спрос: слабая валюта делает экспорт дешевле для покупателя, санкции закрывают рынки
export function exportIndex(e) {
  const fx = clamp((e.exchangeRate || 100) / 100, 0.3, 4);
  const sanc = (e.sanctionsQuartersLeft || 0) > 0 ? 0.45 : 1;
  const war = (e.warQuartersLeft || 0) > 0 && e.warType === 'offensive' ? 0.7 : 1;
  const bloc = e.tradeBlocActive ? 1.15 : 1;
  return Math.pow(fx, 0.9) * sanc * war * bloc;
}

export function makeCompany(sectorId, economy) {
  const s = P[sectorId] ? sectorId : 'factory';
  const p = P[s];
  const c = {
    sector: s,
    cash: p.cash,
    debtRub: p.debt,
    debtFx: 0,                 // в валюте (единицы по курсу 100 на старте)
    // средняя ставка по рублёвому долгу: старые кредиты взяты до кризиса и
    // переоцениваются постепенно, по мере погашения и перекредитования
    loanRate: Math.min((economy && economy.lendingRate) || 7.92, 9),
    capacity: p.capacity,
    pipeline: [],              // расширения, которые ещё строятся: { q, units }
    staff: p.staff,
    wageIdx: 1,                // рыночная зарплата относительно старта
    worldIdx: 1,               // мировые цены в валюте
    brand: 1,                  // лояльность покупателей: от цены, сервиса и зарплат
    capitalValue: p.capacity * p.capex,
    dividendsTotal: 0,         // выплачено владельцу за всю партию, в ценах старта
    startPrice: (economy && economy.priceLevel) || 100,
    history: [],
    last: null,
    strikeCd: 0, inspectionCd: 0,
    distressQuarters: 0,
    bankrupt: false,
    prodIdx: 1,                // выработка на работника: растёт вместе со страной
    startProductivity: (economy && economy.productivity) || 1,
    ebitda0: null,
  };
  // стартовая EBITDA — по спокойному прогнозу первого квартала: на ней держатся
  // оценка компании и кредитный лимит, пока своей истории ещё нет
  if (economy) {
    /* штат под спрос стартовой экономики: компания жила в ней и до вас, и кризисный
       сценарий застаёт её уже подстроенной под упавший спрос, а не с людьми на
       докризисный объём — иначе в первом же квартале нечем платить зарплату */
    const d0 = runQuarter(c, defaultPlan(c), economy, { events: false });
    const need = (d0.domDemand + (s === 'factory' ? Math.min(d0.expDemand, c.capacity * 0.3) : 0)) / p.prod;
    c.staff = Math.round(clamp(need * 0.98, p.staff * 0.55, p.staff));
    c.ebitda0 = runQuarter(c, defaultPlan(c), economy, { events: false }).ebitda;
    c.wealth0 = ownerWealth(c, economy);
  }
  return c;
}

export function defaultPlan(company) {
  const prev = company && company.plan;
  return {
    markup: prev ? prev.markup : 0,
    wagePremium: prev ? prev.wagePremium : 0,
    hire: 0,
    expand: 0,
    borrow: 0,
    fxLoan: prev ? !!prev.fxLoan : false,
    exportShare: prev ? prev.exportShare : (company && company.sector === 'factory' ? 30 : 0),
    dividend: prev ? prev.dividend : 30,
    gr: prev ? !!prev.gr : false,
  };
}

export const fxRate = (e) => clamp((e.exchangeRate || 100) / 100, 0.1, 20);
export const priceIdx = (e) => Math.max(0.05, (e.priceLevel || 100) / 100);
export const fxLoanRate = (e) => clamp((e.worldRate ?? 3) + (e.riskPremium ?? 1.4) + 2.5, 1, 40);
export const rubLoanRate = (e) => clamp(e.lendingRate ?? 7.92, 0.5, 80);

// долг в местной валюте по текущему курсу
export const totalDebt = (c, e) => c.debtRub + c.debtFx * fxRate(e);

// мультипликатор EV/EBITDA следует за оценкой рынка акций
export const evMultiple = (e) => clamp(0.55 * (e.stockPE || 11.5), 2.5, 12);

// средняя EBITDA за последние кварталы — одна удачная четверть не делает компанию дорогой
function ebitdaRun(c) {
  const h = c.history.slice(-4).map((x) => x.ebitda);
  if (!h.length) {
    if (Number.isFinite(c.ebitda0)) return c.ebitda0;
    const p = P[c.sector];
    return (p.dom * p.price - p.dom * p.mat - p.staff * p.wage - p.fixed * p.capacity) * 0.9;
  }
  return h.reduce((a, b) => a + b, 0) / h.length;
}

export function companyValue(c, e) {
  const ev = Math.max(0, ebitdaRun(c)) * Q * evMultiple(e) * clamp(c.brand, 0.6, 1.4) ** 0.5;
  return Math.max(0, ev + c.cash - totalDebt(c, e));
}

// богатство владельца в ценах старта: стоимость доли плюс всё, что уже выплачено
export function ownerWealth(c, e) {
  return companyValue(c, e) * c.startPrice / Math.max(1, e.priceLevel || 100) + c.dividendsTotal;
}

/* Сколько банки готовы дать ещё. Потолок — 3,5 годовой EBITDA, а при кредитном
   сжатии и больных банках он складывается: в кризис кредит пропадает первым
   именно для бизнеса. */
export function creditMultiple(e) {
  let k = 3.5;
  if (e.creditCrunch) k *= 0.4;
  k *= clamp(1.25 - (e.bankingRisk ?? 24) / 100, 0.35, 1.1);
  if (e.regime === 'banking') k *= 0.6;
  return k;
}
export function creditLimit(c, e) {
  const annual = Math.max(0, ebitdaRun(c)) * Q;
  return Math.max(0, annual * creditMultiple(e) - totalDebt(c, e));
}

/* Риски, общие для любой частной компании в этой стране. Забастовка — когда
   зарплату урезают при низкой безработице (уйти есть куда, терпеть незачем).
   Проверка — всегда возможна, но при авторитаризме и тоталитаризме она частая и
   растёт с размером бизнеса; связи во власти (GR) её заметно реже зовут. */
export const hardRegime = (regime) => regime === 'authoritarian' || regime === 'totalitarian';
export function strikeChance(wagePremium, unemployment) {
  if (!(wagePremium < 0) || !((unemployment ?? 5) < 6.5)) return 0;
  return 0.18 + (-wagePremium) * 0.02;
}
export function inspectionChance(regime, sizeBn, gr) {
  const hard = hardRegime(regime);
  return (hard ? 0.1 + sizeBn * 0.04 : 0.03) * (gr ? (hard ? 0.3 : 0.6) : 1);
}

const maxHirePct = (e) => clamp(25 * ((e.unemployment ?? 5) - 2) / 5, 5, 25);

/* Сердце модели: квартал компании при данной экономике. Используется и для прогноза
   (по текущей экономике, без случайных событий), и для расчёта итога. */
function runQuarter(c, plan, e, { events = true, regime } = {}) {
  const p = P[c.sector];
  const pi = priceIdx(e); const fx = fxRate(e);
  const log = [];
  const news = [];

  // рынок труда: зарплаты растут вслед за экономикой, найм упирается в безработицу
  const wageIdx = c.wageIdx * Math.pow(1 + (e.wageGrowth ?? 6) / 100, 1 / Q);
  const hirePct = clamp(plan.hire, -25, plan.wagePremium > 8 ? maxHirePct(e) + 5 : maxHirePct(e));
  const hired = Math.round(c.staff * hirePct / 100);
  const staff = Math.max(20, c.staff + hired);
  const wage = p.wage * wageIdx * (1 + plan.wagePremium / 100);

  // мощности: достроенное добавляется, старое изнашивается
  const pipeline = c.pipeline.map((x) => ({ ...x, q: x.q - 1 }));
  const ready = pipeline.filter((x) => x.q <= 0).reduce((a, x) => a + x.units, 0);
  const capacity = c.capacity * 0.994 + ready;
  const expandUnits = Math.max(0, Math.round(capacity * clamp(plan.expand, 0, 20) / 100));
  const capexCost = expandUnits * p.capex * (pi * (1 - p.imp) + fx * p.imp);

  /* производительность растёт вместе со страной (иначе рыночные зарплаты, которые
     растут быстрее цен, съели бы любую маржу), а надбавка к зарплате немного
     поднимает отдачу, урезание — роняет */
  const prodIdx = e.productivity && c.startProductivity
    ? clamp(e.productivity / c.startProductivity, 0.5, 3) : (c.prodIdx || 1) * 1.0045;
  const productivity = p.prod * prodIdx * (1 + clamp(plan.wagePremium, -10, 30) * 0.006);
  let output = Math.min(capacity, staff * productivity);

  // события квартала
  let strike = false; let fine = 0; let govOrder = 1;
  if (events) {
    if (c.strikeCd <= 0 && rng() < strikeChance(plan.wagePremium, e.unemployment)) {
      strike = true; output *= 0.7;
      log.push('Забастовка: цеха стояли почти месяц — выпуск упал на треть.');
      news.push({ headline: 'ЗАБАСТОВКА НА ПРЕДПРИЯТИИ', text: 'Работники остановили производство, требуя индексации зарплат. Выпуск за квартал сократился примерно на треть.' });
    }
    const hard = hardRegime(regime);
    if (c.inspectionCd <= 0 && rng() < inspectionChance(regime, companyValue(c, e) / 1000, plan.gr)) {
      fine = Math.max(5, c.cash * (hard ? 0.18 : 0.07));
      log.push(hard ? `«Внеплановая проверка» закончилась «добровольным взносом» ${fine.toFixed(0)} млн.`
        : `Налоговая проверка: доначисления и штраф ${fine.toFixed(0)} млн.`);
      news.push({ headline: hard ? 'К КОМПАНИИ ПРИШЛИ С ПРОВЕРКОЙ' : 'НАЛОГОВАЯ ПРОВЕРКА В КОМПАНИИ',
        text: hard ? `Силовики провели обыски в офисе. Компания «добровольно» перечислила ${fine.toFixed(0)} млн в фонд поддержки региона — вопросы к ней сняты.`
          : `По итогам проверки компании доначислено ${fine.toFixed(0)} млн налогов и штрафов.` });
    }
    // госзаказ: война, госинвестиции и связи во власти
    const orderChance = (plan.gr ? 0.12 : 0.03) + ((e.warQuartersLeft || 0) > 0 && c.sector === 'factory' ? 0.15 : 0)
      + ((e.govInvestment || 0) > 1 && c.sector === 'builder' ? 0.1 : 0);
    if (c.sector !== 'retail' && rng() < orderChance) {
      govOrder = 1.18;
      log.push('Получен госзаказ: спрос за квартал вырос почти на пятую часть.');
      news.push({ headline: 'КОМПАНИЯ ПОЛУЧИЛА ГОСЗАКАЗ', text: 'Контракт с государством загрузил мощности сверх обычного спроса.' });
    }
  }

  /* цена рынка в отрасли: конкуренты закупают то же импортное сырьё, и когда оно
     дорожает, дорожает вся отрасль, а не только вы — «наценка к рынку» считается
     от этой цены, а не от общей инфляции. Сама отрасль, подорожавшая быстрее
     остальных цен, при этом теряет часть покупателей. */
  const worldIdx = c.worldIdx * 1.005;
  const marketPrice = p.price * (pi * (1 - p.imp * 0.7) + fx * worldIdx * p.imp * 0.7);
  const sectorRel = clamp(marketPrice / (p.price * pi), 0.3, 5);

  // спрос: собственная цена против рынка, лояльность покупателей, макроэкономика
  const markup = clamp(plan.markup, -15, 25) / 100;
  const priceFactor = Math.pow(1 + markup, -p.elast) * Math.pow(sectorRel, -0.6);
  const domDemand = p.dom * demandIndex(c.sector, e) * priceFactor * c.brand * govOrder * prodIdx;
  const expDemand = p.exp * exportIndex(e) * Math.pow(1 + markup, -p.elast * 0.8) * c.brand;
  const expCap = output * clamp(plan.exportShare, 0, 70) / 100;
  const exported = c.sector === 'factory' ? Math.min(expDemand, expCap) : 0;
  const domestic = Math.min(domDemand, output - exported);
  const sold = domestic + exported;
  const unmet = Math.max(0, domDemand - domestic);
  const domPrice = marketPrice * (1 + markup);
  const expPrice = p.price * fx * worldIdx * (1 + markup);
  const revenue = domestic * domPrice + exported * expPrice;
  // выработка растёт — единица продукции требует меньше и сырья: цена и сырьё в «единицах» стартовой выработки
  const materials = sold * p.mat * (pi * (1 - p.imp) + fx * worldIdx * p.imp);
  const depositIncome = Math.max(0, c.cash) * clamp((e.depositRate ?? 6) * 0.8, 0, 60) / 100 / Q;
  const wages = staff * wage;
  const severance = hired < 0 ? -hired * wage * 0.5 : 0;
  const fixed = p.fixed * capacity * pi;
  const grCost = plan.gr ? revenue * 0.012 : 0;
  const ebitda = revenue - materials - wages - fixed - grCost - severance;
  const depreciation = c.capitalValue * 0.015;
  const loanRate = Number.isFinite(c.loanRate) ? c.loanRate : rubLoanRate(e);
  const interest = c.debtRub * loanRate / 100 / Q + c.debtFx * fx * fxLoanRate(e) / 100 / Q;
  const pretax = ebitda - depreciation - interest - fine + depositIncome;
  const tax = Math.max(0, pretax) * clamp(e.profitTaxRate ?? 20, 0, 60) / 100;
  const netProfit = pretax - tax;
  const dividends = netProfit > 0 ? netProfit * clamp(plan.dividend, 0, 100) / 100 : 0;

  // заём или погашение: погасить можно не больше долга, занять — не больше лимита
  const limit = creditLimit(c, e);
  const debtNow = totalDebt(c, e);
  const borrow = clamp(plan.borrow, -debtNow, limit);
  let debtRub = c.debtRub; let debtFx = c.debtFx;
  if (borrow >= 0) {
    if (plan.fxLoan) debtFx += borrow / fx; else debtRub += borrow;
  } else {
    // гасим сначала валютный долг: курсовой риск дороже
    let rep = -borrow;
    const fxPart = Math.min(rep, debtFx * fx);
    debtFx -= fxPart / fx; rep -= fxPart;
    debtRub = Math.max(0, debtRub - rep);
  }
  const cash = c.cash + ebitda + depositIncome - interest - fine - tax - capexCost - dividends + borrow;

  // четверть старого долга за квартал перекредитовывается по текущей ставке, новый заём — сразу по ней
  const newRub = Math.max(0, debtRub - c.debtRub);
  const nextLoanRate = debtRub > 0
    ? ((Math.max(0, debtRub - newRub)) * (loanRate + 0.25 * (rubLoanRate(e) - loanRate)) + newRub * rubLoanRate(e)) / debtRub
    : rubLoanRate(e);
  const utilization = capacity > 0 ? output / capacity : 0;
  const sellThrough = domDemand > 0 ? domestic / domDemand : 1;
  // лояльность: дешевле рынка и без очередей — растёт; дорого и дефицит — падает
  const brand = clamp(c.brand * (1 + (-markup * 0.08) + (sellThrough < 0.85 ? -0.015 : 0.004) + plan.wagePremium * 0.0006), 0.5, 1.6);

  return {
    wageIdx, worldIdx, prodIdx, depositIncome, loanRate: nextLoanRate, staff, hired, capacity, pipeline: [
      ...pipeline.filter((x) => x.q > 0),
      ...(expandUnits > 0 ? [{ q: 2, units: expandUnits }] : []),
    ],
    expandUnits, capexCost, output, domestic, exported, sold, unmet, domDemand, expDemand,
    domPrice, marketPrice, revenue, materials, wages, fixed, grCost, severance, ebitda, depreciation, interest, fine, tax,
    netProfit, dividends, borrow, debtRub, debtFx, cash, utilization, brand, strike, govOrder: govOrder > 1,
    limit, log, news,
  };
}

// прогноз на квартал по текущей экономике — без случайных событий
export function companyPreview(c, plan, economy) {
  return runQuarter(c, plan, economy, { events: false });
}

/* Итог квартала: экономика уже пересчитана движком (after), компания живёт в ней.
   Если денег не хватает — банк дотягивает до нуля в пределах лимита; не хватает и
   его — это кассовый разрыв, а два квартала подряд в разрыве — банкротство. */
export function settleCompany(c, plan, after, quarterIndex) {
  const r = runQuarter(c, plan, after, { events: true, regime: after.politicalRegime });
  let { cash, debtRub } = r;
  const log = [...r.log];
  const news = [...r.news];
  if (cash < 0) {
    const extra = Math.min(-cash, Math.max(0, creditLimit(c, after) - Math.max(0, r.borrow)));
    if (extra > 0) {
      cash += extra; debtRub += extra;
      log.push(`Кассовый разрыв закрыт экстренным кредитом ${extra.toFixed(0)} млн.`);
    }
  }
  const distress = cash < 0 ? c.distressQuarters + 1 : 0;
  if (cash < 0 && distress === 1) {
    log.push('Денег не хватает даже с кредитом: поставщики и работники ждут оплаты. Ещё квартал — и банкротство.');
    news.push({ headline: 'КОМПАНИЯ ЗАДЕРЖИВАЕТ ПЛАТЕЖИ', text: 'Кассовый разрыв: банки отказали в новых кредитах, поставщики переходят на предоплату.' });
  }
  const bankrupt = distress >= 2;
  if (bankrupt) news.push({ headline: 'КОМПАНИЯ ПРИЗНАНА БАНКРОТОМ', text: 'Кредиторы подали иск, суд ввёл внешнее управление.' });
  if (r.unmet > r.domDemand * 0.12 && !r.strike) log.push(`Мощностей не хватило: недопродано ${Math.round(r.unmet)} ед. — покупатели уходят к конкурентам.`);
  if (r.utilization < 0.65) log.push(`Загрузка мощностей ${Math.round(r.utilization * 100)}% — оборудование простаивает, а постоянные издержки идут.`);

  const next = {
    ...c,
    cash, debtRub, debtFx: r.debtFx, capacity: r.capacity, pipeline: r.pipeline, staff: r.staff,
    wageIdx: r.wageIdx, worldIdx: r.worldIdx, prodIdx: r.prodIdx, brand: r.brand,
    loanRate: debtRub > r.debtRub ? (r.loanRate * r.debtRub + rubLoanRate(after) * (debtRub - r.debtRub)) / debtRub : r.loanRate,
    capitalValue: c.capitalValue * 0.985 + r.capexCost,
    dividendsTotal: c.dividendsTotal + r.dividends * c.startPrice / Math.max(1, after.priceLevel || 100),
    strikeCd: r.strike ? 6 : Math.max(0, c.strikeCd - 1),
    inspectionCd: r.fine > 0 ? 6 : Math.max(0, c.inspectionCd - 1),
    distressQuarters: distress, bankrupt,
    plan: { ...plan, hire: 0, expand: 0, borrow: 0 },
  };
  const last = { q: quarterIndex, revenue: r.revenue, ebitda: r.ebitda, netProfit: r.netProfit, dividends: r.dividends,
    materials: r.materials, wages: r.wages, fixed: r.fixed + r.grCost + r.severance, interest: r.interest, tax: r.tax, fine: r.fine,
    capex: r.capexCost, sold: r.sold, exported: r.exported, unmet: r.unmet, utilization: r.utilization,
    domPrice: r.domPrice, log };
  next.last = last;
  next.history = [...c.history, { q: quarterIndex, ebitda: r.ebitda, netProfit: r.netProfit, revenue: r.revenue,
    cash, debt: debtRub + r.debtFx * fxRate(after) }].slice(-40);
  next.history[next.history.length - 1].value = companyValue(next, after);
  next.history[next.history.length - 1].wealth = ownerWealth(next, after);
  return { company: next, news, log };
}

// «доля рынка» — продажи внутри страны к объёму рынка на старте с поправкой на макро
export function marketShare(c, e) {
  const p = P[c.sector];
  const sold = c.last ? c.last.sold - c.last.exported : p.dom;
  const market = p.dom * demandIndex(c.sector, e) / 0.12;
  return clamp(sold / market * 100, 0, 100);
}

export const sectorLabel = (id) => sectorOf(id).title;
