/* Выделено из engine.js: politics/requests.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG, clamp } from '../catalog.js';
import { clampToLeverRange, getCbPersona, getMofPersona, keyRateCap, roundTo } from '../engine.js';
import { rf2 } from '../content/news.js';

/* =========================================================================================
   МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ: официальное обращение одного ведомства к другому
========================================================================================= */
/* Число в тексте просьбы — «1», «1,5», «0,25»: без хвостовых нулей и с запятой,
   как это читается вслух, а не как в отчёте. */
export const askNum = (n) => String(Number(Number(n).toFixed(2))).replace('.', ',');
/* Сколько именно просят: сила указания — множитель к базовой величине просьбы. */
export const reqAmount = (req, strength) => (req && req.scale ? req.scale.base : 1)
  * (Number.isFinite(strength) ? strength : 1);
/* Текст просьбы. «Снизить ставку на 1 п.п.» и «на 0,25 п.п.» — разные просьбы, и в
   новостях обязана стоять та, которую действительно выдвинули: раньше в кавычках
   всегда висела базовая формулировка, сколько бы ни просили на самом деле. */
export const askText = (req, strength, bySpeaker, regime) => {
  if (!req) return '';
  const raw = typeof req.ask === 'function' ? req.ask(reqAmount(req, strength)) : req.ask;
  let text = raw;
  // указание ведомству от имени президента передаёт он сам, а не то ведомство,
  // чьим голосом написан текст просьбы («...вынудит НАС держать ставку выше» —
  // это фраза ЦБ о себе). Без замены президент рассказывал бы про ставку так,
  // будто сам её устанавливает, хотя ни одного рычага у него нет.
  if (bySpeaker === 'president' && req.from) {
    const institutionName = req.from === 'central_bank' ? 'ЦБ' : 'Минфин';
    // \b в JS-регулярках размечает границы по ASCII \w и кириллицу словом не
    // считает — «\bнас\b» поэтому вообще не находит «нас» внутри кириллического
    // текста ни разу. \p{L} с флагом u распознаёт кириллицу как буквы корректно.
    text = text.replace(/(?<!\p{L})нас(?!\p{L})/giu, institutionName)
      .replace(/(?<!\p{L})нам(?!\p{L})/giu, institutionName);
  }
  // «Просим»/«Требуем»/«Предлагаем» — формулировки для ведомства, у которого
  // есть право отказать. При тоталитарном режиме отказать почти невозможно
  // (см. authority = 4.0 в processPresidentialDirective) — и президент,
  // который «просит» при таком раскладе, звучит фальшиво: это не просьба,
  // а распоряжение с заранее известным ответом.
  if (bySpeaker === 'president' && regime === 'totalitarian') {
    text = text.replace(/^(Просим|Требуем|Предлагаем) /, 'Приказываем ');
  }
  return text;
};
/* «Согласились наполовину» у ставочных запросов считается от того, что бот и
   так планировал сделать в этом квартале (decisions.keyRate ДО применения
   запроса — а это уже решение бота, которое само может быть повышением на
   фоне высокой инфляции), а не от ставки, которая реально действовала
   прошлый квартал (economy.keyRate). Если инфляция достаточно сильна,
   уступка в сторону смягчения может не спасти ставку от роста — и тогда
   статический текст «снижает вдвое меньше запрошенного» прямо противоречит
   соседней новости о повышении ставки, которая смотрит именно на факт:
   выросла ставка относительно прошлого квартала или нет. Поэтому текст у
   rate_cut/rate_hike сравнивает итог именно с economy.keyRate. */
export function requestOutcomeText(req, status, economyBefore, after) {
  if ((req.id === 'rate_cut' || req.id === 'rate_hike') && status !== 'rejected') {
    const beforeRate = Number.isFinite(economyBefore.keyRate) ? economyBefore.keyRate : 0;
    const afterRate = Number.isFinite(after.keyRate) ? after.keyRate : beforeRate;
    const cut = afterRate < beforeRate - 0.01;
    const hike = afterRate > beforeRate + 0.01;
    if (req.id === 'rate_cut') {
      if (cut) return status === 'accepted' ? req.yes : req.partial;
      return hike
        ? `Центральный банк смягчает свою реакцию, но инфляция всё равно требует более высокой ставки — она растёт до ${rf2(afterRate)}%, просто меньше, чем без уступки.`
        : `Центральный банк идёт навстречу и отказывается от дальнейшего повышения, но снизить ставку пока не готов — она остаётся на ${rf2(afterRate)}%.`;
    }
    if (hike) return status === 'accepted' ? req.yes : req.partial;
    return cut
      ? `Центральный банк ужесточает тон, но экономика требует смягчения — ставка всё равно снижается до ${rf2(afterRate)}%.`
      : `Центральный банк соглашается не смягчать политику дальше, но и на решительное повышение пока не идёт — ставка остаётся на ${rf2(afterRate)}%.`;
  }
  return status === 'accepted' ? req.yes : status === 'partial' ? req.partial : req.no;
}

// liquidity/fxIntervention — рычаги в номинальных млрд, а не в % ВВП: их диапазон
// растёт вместе с экономикой (см. scaleLever в интерфейсе). Просьба, двигающая их
// на фиксированное число миллиардов, в позднем ВВП, выросшем в разы, превращается
// в неразличимую на глаз поправку — «исполнено», а по факту ничего не изменилось.
export const gdpLeverScale = (s) => Math.max(1, (s && s.nominalGdp ? s.nominalGdp : CONFIG.initial.gdp) / CONFIG.initial.gdp);

/* Налоги, которые население чувствует напрямую: подоходный выше 28% или НДС выше
   23% — и появляется требование «налоговая нагрузка невыносима» (см. раздел 16). */
export const TAX_DEMAND_CAP = { incomeTaxRate: 28, vatRate: 23 };
export const TAX_KEYS = ['incomeTaxRate', 'vatRate', 'socialContribRate', 'profitTaxRate', 'exciseRate', 'capitalTaxRate'];
export const taxSum = (d) => TAX_KEYS.reduce((a, k) => a + (Number.isFinite(d[k]) ? d[k] : 0), 0);
/* Общая просьба «снизить налоги»: какие именно — решает Минфин. Снижает по шагу
   ползунка (0,5 п.п.) тот налог, что сейчас «больнее всего»: сначала те, из-за
   которых протестует население, потом — самые завышенные против стартовых ставок. */
export function taxCutPlan(d, total) {
  const out = {};
  TAX_KEYS.forEach((k) => { out[k] = d[k]; });
  const start = CONFIG.initial;
  const pain = (k) => (TAX_DEMAND_CAP[k] && out[k] > TAX_DEMAND_CAP[k] ? 100 + out[k] - TAX_DEMAND_CAP[k] : 0)
    + (out[k] - (start[k] || 0)) / Math.max(5, start[k] || 5);
  for (let left = Math.round(total / 0.5); left > 0; left--) {
    const k = TAX_KEYS.filter((x) => Number.isFinite(out[x]) && out[x] >= 0.5).sort((a, b) => pain(b) - pain(a))[0];
    if (!k) break;
    out[k] = roundTo(out[k] - 0.5, 0.5);
  }
  return out;
}

export const REQUESTS = [
  { id: 'infra_up', from: 'central_bank', label: 'Нарастить госинвестиции',
    scale: { base: 1.5, min: 0.5, max: 3, step: 0.5, unit: '% ВВП' },
    ask: (n) => `Просим увеличить расходы на инфраструктуру на ${askNum(n)}% ВВП для поддержки совокупного спроса.`,
    fit: (s) => (s.outputGap < -1 ? 1.5 : s.outputGap > 1.5 ? -1.6 : 0.1) + (s.debtToGdp > 85 ? -0.9 : 0.2),
    bias: { technocrat: 0.7, populist: 0.5, austerity: -0.7 },
    // множитель здесь обязан совпадать с scale.base (1.5): тот же scale.base
    // умножается на strength и печатается в тексте просьбы как «на N% ВВП» —
    // раньше apply двигал рычаг вдвое сильнее того, что было напечатано, и
    // игрок, выполнивший ровно заявленное, всё равно получал «частично»
    apply: (d, k) => ({ govInvestment: clamp(d.govInvestment + 1.5 * k, -15, 15) }),
    yes: 'Минфин согласен: инфраструктурная программа будет расширена уже в этом квартале.',
    partial: 'Минфин готов на половину запрошенного — бюджетное правило не позволяет больше.',
    no: 'Минфин отказывает: наращивать расходы при нынешнем состоянии бюджета он не намерен.' },
  { id: 'deficit_cut', from: 'central_bank', label: 'Сократить дефицит бюджета',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // «×2» читалось как «дефицит уменьшится вдвое», хотя запрос двигает не сам
    // дефицит, а темп роста двух статей расходов — итоговый эффект на баланс
    // бюджета зависит ещё и от доходов, процентных платежей и остальных
    // статей, которых запрос не касается. Текст явно называет то, что
    // реально просят, а не то, что могло бы показаться пропорциональным.
    ask: (n) => `Требуем притормозить рост расходов на ${askNum(2 * n)} п.п. и социальных выплат на ${askNum(1.5 * n)} п.п.: нынешний бюджетный импульс вынуждает нас держать ставку выше, чем требовалось бы.`,
    fit: (s) => (s.budgetBalancePctGdp < -4 ? 1.4 : 0.2) + (s.outputGap > 1 ? 0.8 : -0.3) + (s.inflation > 6 ? 0.6 : 0),
    bias: { technocrat: 0.6, austerity: 1.0, populist: -0.9 },
    apply: (d, k) => ({ govSpending: clampToLeverRange('govSpending', d.govSpending - 2 * k), transfers: clampToLeverRange('transfers', d.transfers - 1.5 * k) }),
    yes: 'Минфин соглашается на консолидацию: расходы будут урезаны.',
    partial: 'Минфин идёт на частичное сокращение, защитив социальные статьи.',
    no: 'Минфин отвечает, что сокращать расходы в текущей ситуации политически невозможно.' },
  { id: 'transfers_freeze', from: 'central_bank', label: 'Заморозить рост социальных выплат',
    scale: { base: 1, min: 0.5, max: 2, step: 0.5, unit: ' п.п.' },
    // множитель в apply (1.0) обязан совпадать с scale.base — та же причина,
    // что и у infra_up/vat_relief: иначе выполненная ровно по тексту просьба
    // всё равно читалась бы игрой как «частично»
    ask: (n) => `Просим приостановить рост социальных выплат минимум на ${askNum(n)} п.п.: их рост напрямую транслируется в потребительский спрос и цены.`,
    fit: (s) => (s.inflation > 6 ? 1.3 : -0.4) + (s.unemployment > 7 ? -1.0 : 0.3),
    bias: { austerity: 1.0, technocrat: 0.3, populist: -1.4 },
    apply: (d, k) => ({ transfers: clampToLeverRange('transfers', Math.min(d.transfers, 0) - 1.0 * k) }),
    yes: 'Минфин замораживает индексацию выплат до нормализации инфляции.',
    partial: 'Минфин ограничивает рост выплат, но полной заморозки не допускает.',
    no: 'Минфин отвечает, что заморозка выплат при текущем положении людей исключена.' },
  /* Одна просьба на все налоги вместо отдельных «снизить НДС» и «снизить налог на
     прибыль»: президент и ЦБ говорят, насколько снизить нагрузку, а какие налоги —
     решает Минфин. Согласие — обязательство: полтора года бот-Минфин не поднимает
     эти налоги обратно (см. taxCommit). Раньше Минфин снижал НДС по просьбе и через
     квартал повышал снова — требование населения висело десятки кварталов. */
  { id: 'tax_cut', from: 'central_bank', label: 'Снизить налоги',
    scale: { base: 2, min: 1, max: 5, step: 0.5, unit: ' п.п.' },
    ask: (n) => `Просим снизить налоговую нагрузку — в сумме на ${askNum(n)} п.п. ставок и не повышать их полтора года. Какие налоги снижать, решает Минфин.`,
    fit: (s) => ((s.incomeTaxRate > TAX_DEMAND_CAP.incomeTaxRate || s.vatRate > TAX_DEMAND_CAP.vatRate) ? 1.2 : -0.3)
      + (s.budgetBalancePctGdp > -3 ? 0.4 : s.budgetBalancePctGdp < -6 ? -1.0 : -0.4) + (s.outputGap < -1 ? 0.3 : 0),
    bias: { technocrat: 0.2, austerity: -0.6, populist: 0.9 },
    apply: (d, k) => taxCutPlan(d, 2 * k),
    // засчитывается снижение суммы ставок — неважно, какие именно налоги снизили
    progress: (base, fin, str) => clamp((taxSum(base) - taxSum(fin)) / Math.max(0.5, roundTo(2 * (str || 1), 0.5)), 0, 1),
    yes: 'Минфин снижает налоги и обещает не поднимать их полтора года.',
    partial: 'Минфин снижает налоги вдвое меньше запрошенного — и тоже обещает их не поднимать.',
    no: 'Минфин отказывается: выпадающие доходы бюджета нечем закрыть.' },
  // retired: старые просьбы по одному налогу — вместо них tax_cut. Остаются для
  // старых сохранений и сетевых комнат, но в списках и у ботов их больше нет
  { id: 'tax_relief_business', retired: true, from: 'central_bank', label: 'Снизить налог на прибыль',
    scale: { base: 2, min: 0.5, max: 4, step: 0.5, unit: ' п.п.' },
    // раньше текст не называл величину вовсе («снизить налог на прибыль», без
    // числа) — игрок не мог понять, сколько нужно сдвинуть ползунок, чтобы
    // просьба засчиталась выполненной
    ask: (n) => `Предлагаем снизить налог на прибыль на ${askNum(n)} п.п.: инвестиции сдерживаются и стоимостью денег, и налоговой нагрузкой сразу.`,
    fit: (s) => (s.investmentGrowth < 0 ? 1.2 : 0) + (s.budgetBalancePctGdp > -3 ? 0.5 : -0.9),
    bias: { technocrat: 0.4, austerity: 0.2, populist: -0.8 },
    apply: (d, k) => ({ profitTaxRate: clamp(d.profitTaxRate - 2 * k, 0, 45) }),
    yes: 'Минфин снижает налог на прибыль, рассчитывая вернуть выпадающие доходы ростом базы.',
    partial: 'Минфин идёт на символическое снижение ставки.',
    no: 'Минфин отказывается: выпадающие доходы нечем закрыть.' },
  { id: 'vat_relief', retired: true, from: 'central_bank', label: 'Снизить НДС',
    scale: { base: 1.5, min: 0.5, max: 3, step: 0.5, unit: ' п.п.' },
    ask: (n) => `Просим снизить НДС на ${askNum(n)} п.п.: налоговая нагрузка бьёт по спросу населения раньше, чем по цифрам роста.`,
    fit: (s) => (s.vatRate > 20 ? 1.3 : -0.5) + (s.budgetBalancePctGdp > -3 ? 0.4 : -1.0),
    bias: { technocrat: 0.1, austerity: -0.7, populist: 0.9 },
    // множитель должен совпадать с scale.base (1.5): текст просьбы называет
    // именно эту величину, и полное согласие обязано двигать рычаг ровно на неё
    apply: (d, k) => ({ vatRate: clamp(d.vatRate - 1.5 * k, 0, 30) }),
    yes: 'Минфин снижает НДС, рассчитывая компенсировать выпадающие доходы ростом потребления.',
    partial: 'Минфин идёт на символическое снижение НДС.',
    no: 'Минфин отказывается: выпадающие доходы бюджета нечем закрыть.' },
  { id: 'fiscal_hold', from: 'central_bank', label: 'Не наращивать бюджетный импульс',
    hold: [{ key: 'govSpending', dir: 1 }, { key: 'transfers', dir: 1 }, { key: 'govInvestment', dir: 1 }],
    ask: 'Просим не расширять бюджетный импульс дальше: дополнительное стимулирование сейчас разгонит инфляцию и вынудит нас держать ставку выше.',
    fit: (s) => (s.inflation > s.inflationTarget + 1.5 ? 1.2 : -0.4) + (s.outputGap > 1 ? 0.8 : -0.2) + (s.debtToGdp > 80 ? 0.3 : 0),
    bias: { technocrat: 0.5, austerity: 0.9, populist: -1.0 },
    // «не наращивать» гасит уже запланированное РАСШИРЕНИЕ (govSpending/transfers/govInvestment —
    // это темпы роста, а не уровни), а не обнуляет их целиком: если статья и так в минусе
    // (уже консолидация), просьба её не трогает — как rate_hold гасит только повышение ставки
    apply: (d, k) => ({
      govSpending: d.govSpending > 0 ? roundTo(d.govSpending * (1 - k), 0.5) : d.govSpending,
      transfers: d.transfers > 0 ? roundTo(d.transfers * (1 - k), 0.5) : d.transfers,
      govInvestment: d.govInvestment > 0 ? roundTo(d.govInvestment * (1 - k), 0.5) : d.govInvestment,
    }),
    yes: 'Минфин соглашается не расширять бюджетный импульс дальше.',
    partial: 'Минфин частично сдерживает рост расходов, но не отказывается от него полностью.',
    no: 'Минфин отвечает, что взятые бюджетные обязательства снижать не намерен.' },
  // военные расходы — не дело Центробанка: эту просьбу к Минфину отдаёт только президент
  { id: 'defense_up', from: 'central_bank', presidentOnly: true, label: 'Нарастить военные расходы',
    scale: { base: 3, min: 1, max: 6, step: 1, unit: ' п.п. бюджета' },
    ask: (n) => `Просим увеличить долю военных расходов в бюджете на ${askNum(n)} п.п.: недофинансированная оборона в нынешней обстановке — риск дороже, чем строчка в бюджете.`,
    // вне войны эта просьба почти не имеет смысла для ЦБ — а во время войны
    // недофинансированная оборона бьёт по премии за риск и по доверию сильнее,
    // чем сам факт военных расходов
    fit: (s) => ((s.warQuartersLeft || 0) > 0 ? 1.5 : -0.9) + (s.debtToGdp > 85 ? -0.5 : 0.2),
    bias: { technocrat: -0.1, austerity: -0.4, populist: 0.1 },
    // множитель должен совпадать с scale.base (3), как и у infra_up
    apply: (d, k) => ({ shareDefense: clamp(d.shareDefense + 3 * k, 2, 40) }),
    yes: 'Минфин соглашается нарастить долю военных расходов за счёт остальных статей и держать её два года.',
    partial: 'Минфин идёт на скромное увеличение военной доли бюджета.',
    no: 'Минфин отказывает: перекраивать бюджет в пользу обороны сейчас не готовы.' },
  { id: 'rate_cut', from: 'ministry_finance', label: 'Снизить ключевую ставку',
    scale: { base: 1, min: 0.25, max: 2.5, step: 0.25, unit: ' п.п.' },
    ask: (n) => `Просим снизить ключевую ставку на ${askNum(n)} п.п.: стоимость кредита душит инвестиции и обслуживание долга.`,
    fit: (s) => (s.outputGap < -1 ? 1.3 : -0.6) + (s.inflation < s.inflationTarget + 1 ? 0.9 : -1.4) + (s.unemployment > 7 ? 0.6 : 0),
    bias: { dove: 0.9, pragmatic: 0.2, hawk: -0.9 },
    // округление к сетке 0,25 не должно съедать частичное согласие целиком: просьба
    // снизить на 0,25 при ответе «наполовину» давала −0,125 → та же ставка, и новость
    // «исполнено частично» выходила при неизменившейся ставке. Согласился — двигай.
    apply: (d, k, economy) => ({ keyRate: k <= 0 ? d.keyRate
      : clamp(Math.min(roundTo(d.keyRate - 1 * k, 0.25), roundTo(d.keyRate, 0.25) - 0.25), 0, keyRateCap(economy)) }),
    yes: 'Центральный банк соглашается и снижает ставку — инфляционная картина это позволяет.',
    partial: 'Центральный банк снижает ставку вдвое меньше запрошенного.',
    no: 'Центральный банк отказывает: снижение ставки при текущей инфляции стоило бы доверия к цели.' },
  /* Зеркало rate_cut: до появления президента все просьбы к ЦБ были «помягче» —
     Минфину жёсткость нужна редко. Президенту, который сам ставку не задаёт,
     нужен и обратный рычаг, иначе при голубином ЦБ инфляцию нечем давить. */
  { id: 'rate_hike', from: 'ministry_finance', label: 'Решительно подавить инфляцию',
    scale: { base: 2, min: 0.5, max: 4, step: 0.5, unit: ' п.п.' },
    ask: (n) => `Требуем повысить ключевую ставку на ${askNum(n)} п.п.: рост цен обесценивает доходы и расходы быстрее, чем их успевают индексировать.`,
    fit: (s) => (s.inflation > s.inflationTarget + 2 ? 1.4 : -1.0) + (s.inflationExpectations > s.inflationTarget + 1.5 ? 0.7 : -0.3)
      + (s.outputGap < -2 ? -0.8 : 0.2),
    bias: { hawk: 0.9, pragmatic: 0.2, dove: -0.9 },
    apply: (d, k, economy) => ({ keyRate: k <= 0 ? d.keyRate
      : clamp(Math.max(roundTo(d.keyRate + 2 * k, 0.25), roundTo(d.keyRate, 0.25) + 0.25), 0, keyRateCap(economy)) }),
    yes: 'Центральный банк соглашается и повышает ставку решительнее, чем планировал.',
    partial: 'Центральный банк добавляет к своему решению половину запрошенного шага.',
    no: 'Центральный банк отказывает: он считает, что уже сделал достаточно, а переужесточение обойдётся выпуском.' },
  { id: 'rate_hold', from: 'ministry_finance', label: 'Не повышать ставку',
    hold: [{ key: 'keyRate', dir: 1 }],
    ask: 'Просим воздержаться от повышения ставки: бюджет и без того несёт растущие процентные расходы.',
    fit: (s) => (s.inflation < s.inflationTarget + 2 ? 0.9 : -1.5) + (s.interestToRevenue > 14 ? 0.8 : 0),
    bias: { dove: 0.8, pragmatic: 0.1, hawk: -1.0 },
    // «не повышать» должно реально гасить запланированное повышение, а не быть
    // самоприсваиванием d.keyRate — иначе ЦБ повышает ставку, будто просьбы не было
    apply: (d, k, economy) => {
      const hike = d.keyRate - economy.keyRate;
      return hike <= 0 ? { keyRate: d.keyRate } : { keyRate: roundTo(economy.keyRate + hike * (1 - k), 0.25) };
    },
    yes: 'Центральный банк берёт паузу в ужесточении.',
    partial: 'Центральный банк обещает действовать осторожнее, но связывать себе руки не готов.',
    no: 'Центральный банк отвечает, что независимость политики не обсуждается.' },
  { id: 'liquidity_help', from: 'ministry_finance', label: 'Поддержать ликвидность банков',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // apply масштабирует рычаг по размеру экономики (gdpLeverScale) — точную
    // сумму в млрд в тексте просьбы не назвать без доступа к economy здесь,
    // поэтому число называет саму силу запроса (то же n, что двигает ползунок
    // «Насколько» у президента), а не производную от неё величину
    ask: (n) => `Просим предоставить банковской системе поддержку объёмом не менее ${askNum(n)}× обычного пакета ликвидности: кредитование останавливается, страдают предприятия.`,
    fit: (s) => (s.bankLiquidity < 60 ? 1.4 : -0.3) + (s.creditCrunch ? 1.0 : 0) + (s.inflation > 8 ? -0.7 : 0.2),
    bias: { dove: 0.6, pragmatic: 0.5, hawk: 0.1 },
    apply: (d, k, economy) => ({ liquidity: clamp(d.liquidity + 12 * k * gdpLeverScale(economy), -100 * gdpLeverScale(economy), 200 * gdpLeverScale(economy)) }),
    yes: 'Центральный банк открывает окно ликвидности для банков.',
    partial: 'Центральный банк предоставляет ограниченный объём ликвидности.',
    no: 'Центральный банк считает поддержку преждевременной.' },
  { id: 'capreq_ease', from: 'ministry_finance', label: 'Смягчить норматив капитала',
    scale: { base: 1, min: 0.5, max: 2, step: 0.5, unit: ' п.п.' },
    // множитель в apply (1.0) совпадает с scale.base — то же правило, что и у
    // остальных запросов с числом в тексте
    ask: (n) => `Просим временно смягчить требование к капиталу банков минимум на ${askNum(n)} п.п., чтобы разблокировать кредитование экономики.`,
    fit: (s) => (s.creditCrunch ? 1.5 : -0.5) + (s.creditGap > 5 ? -1.2 : 0.3) + (s.bankNPL > 8 ? -0.8 : 0),
    bias: { dove: 0.5, pragmatic: 0.1, hawk: -0.8 },
    apply: (d, k) => ({ capitalRequirement: clamp(d.capitalRequirement - 1.0 * k, 8, 18) }),
    yes: 'Центральный банк временно снижает норматив, признавая остроту кредитного сжатия.',
    partial: 'Центральный банк идёт на минимальное послабление.',
    no: 'Центральный банк отказывает: ослабление норматива в такой момент готовит следующий кризис.' },
  { id: 'fx_support', from: 'ministry_finance', label: 'Поддержать курс интервенциями',
    scale: { base: 1, min: 0.5, max: 2.5, step: 0.5, unit: '×' },
    // «выйти на валютный рынок» — фраза, в которой не сказано, что «поддержать
    // курс» значит толкнуть ползунок ВНИЗ, в минус, а не вверх: рычаг «валютные
    // интервенции» в плюсе — это покупка валюты, то есть ослабление, ровно
    // противоположное тому, чего просят. Явное направление в тексте просьбы
    // экономит игроку одно неверно понятое задание.
    // apply тоже масштабирует рычаг по размеру экономики (gdpLeverScale) —
    // число в тексте называет силу запроса (n), а не сумму в млрд, той же
    // логикой, что и liquidity_help
    ask: (n) => `Просим выйти на валютный рынок и продавать резервы объёмом не менее ${askNum(n)}× обычной интервенции (сдвиньте валютные интервенции в минус): ослабление курса разгоняет цены и стоимость импорта для бюджета.`,
    fit: (s) => (s.fxDeprAnnual > 6 ? 1.3 : -0.6) + (s.reserves > 200 ? 0.5 : -1.0),
    bias: { hawk: 0.5, pragmatic: 0.3, dove: 0.0 },
    apply: (d, k, economy) => ({ fxIntervention: clamp(d.fxIntervention - 12 * k * gdpLeverScale(economy), -400 * gdpLeverScale(economy), 400 * gdpLeverScale(economy)) }),
    yes: 'Центральный банк выходит на рынок в поддержку курса.',
    partial: 'Центральный банк проводит ограниченные интервенции.',
    no: 'Центральный банк отвечает, что тратить резервы против фундаментальных факторов бессмысленно.' },
];
export function processRequest(reqId, economy, botKind, personaId, decisions) {
  const req = REQUESTS.find((r) => r.id === reqId);
  if (!req) return null;
  const persona = botKind === 'central_bank' ? getCbPersona(personaId) : getMofPersona(personaId);
  const score = req.fit(economy) + (req.bias[persona.id] || 0)
    + (economy.policyCoordination > 70 ? 0.3 : economy.policyCoordination < 35 ? -0.4 : 0);
  const status = score >= 1.0 ? 'accepted' : score >= 0.1 ? 'partial' : 'rejected';
  const k = status === 'accepted' ? 1 : status === 'partial' ? 0.5 : 0;
  const finalDecisions = k > 0 ? { ...decisions, ...req.apply(decisions, k, economy), ...(req.id === 'tax_cut' ? { taxPledge: true } : {}) } : decisions;
  return {
    req, status, score, ask: askText(req, 1),
    decisions: finalDecisions,
    text: requestOutcomeText(req, status, economy, finalDecisions),
    coordination: status === 'accepted' ? 9 : status === 'partial' ? 4 : -7,
  };
}

