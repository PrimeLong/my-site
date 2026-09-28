/* ИГРА → УЧЕБНИК: какой раздел учебника объясняет то, что игрок видит в партии. Чистые
   таблицы — их читают тесты (все ссылки ведут в готовые главы и на существующие разделы). */
const L = (chapter, anchor, label) => ({ chapter, anchor, label });
const ISLM = L('is-lm', 'policy', 'IS-LM: бюджетная и денежная политика');
const AD = L('ad-as', 'ad', 'AD-AS: совокупный спрос');
const AS = L('ad-as', 'as', 'AD-AS: совокупное предложение');
const SHOCKS = L('ad-as', 'shocks', 'AD-AS: шоки спроса и предложения');
const MULT = L('money-banks', 'multiplier', 'Деньги и банки: как банки создают деньги');
const TAX = L('market-failures', 'tax', 'Провалы рынка: налог и его бремя');
const PHILLIPS = L('phillips', 'expectations', 'Кривая Филлипса: ожидания и естественная безработица');
const TAYLOR = L('policy', 'taylor', 'Политика: правило Тейлора и реальная ставка');
const STAB = L('policy', 'fiscal', 'Политика: автоматические стабилизаторы');
const SOLOW = L('growth', 'steady', 'Модель Солоу: устойчивое состояние');

// подсказки у рычагов
export const LEVER_BOOK = {
  keyRate: [ISLM, AD],
  govSpending: [ISLM],
  incomeTaxRate: [TAX], vatRate: [TAX], profitTaxRate: [TAX], socialContribRate: [TAX],
  reserveReq: [MULT],
};

// вкладки «Почему это произошло?»
export const WHY_BOOK = {
  gdpGrowth: AD, outputGap: AS, inflation: PHILLIPS, unemployment: PHILLIPS, budget: STAB, banking: MULT, potential: SOLOW,
};

// «Компас ставки» на панели ЦБ
export const COMPASS_BOOK = TAYLOR;

// новости с цепочкой причин: по звеньям цепочки
export function bookForChain(chain) {
  if (!chain || !chain.length) return null;
  const has = (s) => chain.some((x) => x.includes(s));
  if (has('Секвестр')) return ISLM;
  if (has('Кредитное сжатие') || has('Предложение кредита') || has('Ликвидность ↓')) return MULT;
  if (has('Девальвация') || (has('Курс ↓') && has('Импортные цены'))) return SHOCKS;
  if (has('Дилемма ЦБ') || has('Шок издержек') || (has('Издержки ↑') && has('Инфляция ↑'))) return SHOCKS;
  if (has('НДС')) return TAX;
  if (has('Выплаты ↑')) return ISLM;
  if (has('Инфляция ↑') && (has('Реакция ЦБ') || has('Ожидания'))) return PHILLIPS;
  if (has('Спрос ↑') && has('Инфляция ↑')) return AD;
  if (has('Производительность ↑') || has('Потенциал ↑')) return SOLOW;
  return null;
}

export const ALL_BOOK_LINKS = [ISLM, AD, AS, SHOCKS, MULT, TAX, PHILLIPS, TAYLOR, STAB, SOLOW];
