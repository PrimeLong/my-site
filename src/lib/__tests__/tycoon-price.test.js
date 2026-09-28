import { describe, it, expect } from 'vitest';
import * as T from '../tycoon.js';
import { withSeededRandom } from '../catalog.js';

const run = (st, sec) => withSeededRandom(5, () => T.tick(st, sec));
const must = (res) => { if (res.error) throw new Error(res.error); return res.st; };
// здание в области, при нехватке участков — докупить участок
const place = (st, type, region) => {
  let r = T.build({ ...st, cash: 500 }, type, region);
  if (r.error) r = T.build({ ...must(T.buySlot({ ...st, cash: 500 }, region)), cash: 500 }, type, region);
  return must(r);
};
// мебель: магазины, экспортный терминал в порту и мебельные фабрики с докупкой досок
function setup({ shops = [], plants = 0, stock = 0, markup = 0 }) {
  let st = { ...T.makeTycoon({ start: 'retail' }), cash: 500, rp: 100000 };
  for (const r of ['storage', 'logistics1', 'export', 'furniture']) st = must(T.research(st, r));
  st = place(st, 'terminal', 'port');
  shops.forEach((reg) => { st = place(st, 'shop', reg); });
  for (let n = 0; n < plants; n++) st = place(st, 'furniture_plant', 'industry');
  return { ...st, cash: 500, stock: { ...st.stock, furniture: stock }, exportList: { furniture: true }, markup: { furniture: markup },
    autoSell: {}, autoBuy: { ...st.autoBuy, boards: true } };
}

describe('Своё дело: продавать там, где выгоднее', () => {
  it('полок хватает — цена в магазинах сходится к экспортной, мебель идёт и туда, и туда', () => {
    for (const m0 of [40, -20]) {
      const st = run(setup({ shops: ['capital', 'capital', 'industry', 'agri', 'agri'], plants: 3, markup: m0 }), 300);
      const retail = T.retailPrice(st, 'furniture'); const exp = T.exportPrice(st, 'furniture');
      expect(Math.abs(retail - exp) / exp, `старт ${m0}%: магазин ${retail.toFixed(3)}, экспорт ${exp.toFixed(3)}`).toBeLessThan(0.05);
      expect(T.autoPriced(st, 'furniture')).toBe(true);
      expect(st.stats.shopSold.furniture).toBeGreaterThan(0.1);
      expect(st.stats.exportEma.furniture || st.quarter.exports).toBeGreaterThan(0);
    }
  });
  it('полки забиты — цена в магазинах растёт до предела: дома продают столько же, но дороже, остальное — на экспорт', () => {
    const st = run(setup({ stock: 4000, markup: 0 }), 200);
    // у верхнего предела покупателей почти хватает полкам — цена держится там
    expect(st.markup.furniture).toBeGreaterThan(T.PRICE_MAX - 5);
    expect(T.retailPrice(st, 'furniture')).toBeGreaterThan(T.exportPrice(st, 'furniture'));
    expect(st.quarter.exports).toBeGreaterThan(0);
  });
  it('ручная цена отключает автоматику и остаётся как задана', () => {
    const st = run({ ...setup({ stock: 1000, markup: 25 }), manualPrice: { furniture: true } }, 120);
    expect(st.markup.furniture).toBe(25);
    expect(T.autoPriced(st, 'furniture')).toBe(false);
  });
});

describe('Своё дело: иностранная сеть и терпение её владельцев', () => {
  it('при доле ниже 10% и торговле в убыток владельцы платят FOREIGN_PATIENCE кварталов, потом сеть сворачивается и продаётся', () => {
    let st = setup({ shops: ['capital', 'capital', 'capital', 'capital', 'capital', 'capital'], stock: 6000, markup: -20 });
    st = { ...st, stock: { ...st.stock, bread: 3000, appliances: 2000 } };
    st = { ...st, manualPrice: { furniture: true, bread: true, appliances: true }, markup: { furniture: -20, bread: -20, appliances: -20 },
      rivals: st.rivals.map((c) => (c.id === 'westra' ? { ...c, entered: true, mode: 'hold', markup: 0, cash: 40 } : { ...c, alive: false, mode: 'gone' })) };
    const w = (x) => x.rivals.find((c) => c.id === 'westra');
    st = run(st, T.QUARTER_SEC * 2 + 1);
    const o = T.rivalOutlook(st, 'westra');
    expect(o.losing).toBe(true);
    expect(o.subsidy).toBeGreaterThan(0);
    expect(o.buyableIn).toBeGreaterThan(0);
    expect(o.buyableIn).toBeLessThanOrEqual(T.FOREIGN_PATIENCE);
    expect(T.canBuyRival({ ...st, cash: 1e6 }, 'westra')).toMatch(/не продают/);
    st = run(st, T.QUARTER_SEC * (T.FOREIGN_PATIENCE + 1));
    expect(['retreat', 'gone']).toContain(w(st).mode);
    if (w(st).mode === 'retreat') {
      expect(T.canBuyRival({ ...st, cash: 1e6 }, 'westra')).toBeNull();
      expect(T.rivalOutlook(st, 'westra').subsidy).toBe(0);
    }
  });
});
