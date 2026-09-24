import { describe, it, expect } from 'vitest';
import * as T from '../tycoon.js';
import { withSeededRandom } from '../catalog.js';
import { makeCountry, advanceCountry } from '../autopilot.js';

const fresh = (opts = {}) => T.makeTycoon({ start: 'farm', ...opts });
const run = (st, sec) => withSeededRandom(5, () => T.tick(st, sec));

describe('автопилот страны', () => {
  it('десять кварталов без игрока — без поломанных чисел', () => {
    let c = makeCountry({ scenario: 'currency_crisis' });
    for (let i = 0; i < 10; i++) c = withSeededRandom(i, () => advanceCountry(c)).country;
    expect(c.quarterIndex).toBe(11);
    Object.entries(c.economy).forEach(([k, v]) => { if (typeof v === 'number') expect(Number.isFinite(v), k).toBe(true); });
  });
});

describe('Своё дело', () => {
  it('каждый старт с первых секунд зарабатывает', () => {
    for (const start of ['farm', 'retail', 'factory']) {
      const st = run(T.makeTycoon({ start }), 20);
      expect(st.stats.income - st.stats.costs, start).toBeGreaterThan(0);
      expect(st.cash, start).toBeGreaterThan(4);
    }
  });

  it('цепочка поле → мельница → хлебозавод → магазин продаёт хлеб людям', () => {
    let st = fresh({ start: 'retail' });
    st = { ...st, cash: 50, autoBuy: {} };
    st = T.buySlot(st, 'capital').st;
    for (const [t, r] of [['farm', 'agri'], ['farm', 'agri'], ['mill', 'agri']]) st = T.build(st, t, r).st;
    st = run(st, 30);
    expect(st.stats.rates.bread.sold).toBeGreaterThan(0.5);
    expect(st.stats.rates.flour.bought).toBe(0);
    expect(st.quarter.retail).toBeGreaterThan(0);
    // мука едет из Приреченской в столицу — это поток на карте и расход на перевозку
    expect(st.stats.flows['agri>capital']).toBeGreaterThan(0);
    expect(st.quarter.transport).toBeGreaterThan(0);
  });

  it('автопродажа не сливает сырьё, которое нужно своим цехам', () => {
    let st = fresh();
    st = { ...st, cash: 20, autoSell: { ...st.autoSell, grain: true } };
    st = T.buySlot(st, 'agri').st;
    st = run(st, 20);
    expect(st.stats.rates.flour.prod).toBeGreaterThan(0.9);
  });

  it('полный склад останавливает цех', () => {
    let st = fresh();
    st = { ...st, autoSell: {} };
    st = run(st, 400);
    const cap = T.storageCap(st);
    expect(st.stock.flour).toBeLessThanOrEqual(cap + 1e-6);
    expect(st.stats.rates.flour.prod).toBeLessThan(0.1);
  });

  it('стройка: участки, исследования, место', () => {
    let st = { ...fresh(), cash: 1000 };
    expect(T.canBuild(st, 'farm', 'agri')).toMatch(/участков/);
    expect(T.canBuild(st, 'farm', 'capital')).toMatch(/Здесь/);
    expect(T.canBuild(st, 'steelworks', 'industry')).toMatch(/Металлургия/);
    expect(T.canBuild(st, 'terminal', 'port')).toMatch(/Внешняя торговля/);
    expect(T.build(st, 'shop', 'capital').st.buildings.length).toBe(4);
    st = T.buySlot(st, 'agri').st;
    expect(T.canBuild(st, 'farm', 'agri')).toBeNull();
    expect(T.canBuild({ ...st, cash: 0 }, 'farm', 'agri')).toMatch(/денег/);
  });

  it('улучшение: выработка ×1,5, людей больше, цена растёт', () => {
    let st = { ...fresh(), cash: 100 };
    const b = st.buildings[0];
    const cost1 = T.upgradeCost(b);
    st = T.upgrade(st, b.uid).st;
    const b2 = st.buildings[0];
    expect(b2.level).toBe(2);
    expect(T.upgradeCost(b2)).toBeGreaterThan(cost1);
    expect(T.requiredStaff(st, b2)).toBeGreaterThan(T.requiredStaff(st, b));
  });

  it('каждое следующее исследование дороже', () => {
    let st = { ...fresh(), rp: 10000 };
    const c0 = T.researchCost(st, 'logistics1');
    st = T.research(st, 'furniture').st;
    expect(T.researchCost(st, 'logistics1')).toBeGreaterThan(c0);
    expect(T.canResearch(st, 'logistics2')).toMatch(/Сначала/);
    expect(T.canBuild({ ...st, cash: 100 }, 'furniture_plant', 'industry')).toBeNull();
  });

  it('квартал: страна делает ход, приходят налоги, история растёт', () => {
    let st = fresh();
    st = run(st, T.QUARTER_SEC + 1);
    expect(st.country.quarterIndex).toBe(2);
    expect(st.history).toHaveLength(1);
    expect(st.history[0].revenue).toBeGreaterThan(0);
    expect(st.history[0].tax).toBeGreaterThan(0);
    expect(st.qTime).toBeLessThan(2);
  });

  it('кредит: не больше лимита, валютный долг растёт с курсом, погашение', () => {
    let st = run(fresh(), 30);
    const lim = T.creditLimitT(st);
    expect(lim).toBeGreaterThan(0);
    st = T.borrow(st, 1e9).st;
    expect(T.totalDebtT(st)).toBeCloseTo(lim, 5);
    expect(T.borrow(st, 1).error).toBeTruthy();
    let fx = T.borrow(run(fresh(), 30), 2, true).st;
    const before = T.totalDebtT(fx);
    fx = { ...fx, country: { ...fx.country, economy: { ...fx.country.economy, exchangeRate: 200 } } };
    expect(T.totalDebtT(fx)).toBeCloseTo(before * 2, 5);
    const paid = T.repay(st, 1).st;
    expect(T.totalDebtT(paid)).toBeCloseTo(T.totalDebtT(st) - 1, 5);
  });

  it('пока вкладка закрыта: работа вполсилы, страна стоит', () => {
    const st = { ...fresh(), savedAt: Date.now() - 3600 * 1000 };
    const r = withSeededRandom(3, () => T.catchUp(st));
    expect(r.away).toBeCloseTo(3600, -1);
    expect(r.earned).toBeGreaterThan(0);
    expect(r.st.country.quarterIndex).toBe(1);
    const cap = withSeededRandom(3, () => T.catchUp({ ...fresh(), savedAt: Date.now() - 10 * 3600 * 1000 }));
    expect(cap.away).toBe(T.OFFLINE_CAP_SEC);
  });

  it('при одном зерне игра повторяется', () => {
    const a = withSeededRandom(9, () => T.tick(fresh(), 200));
    const b = withSeededRandom(9, () => T.tick(fresh(), 200));
    expect(b.cash).toBeCloseTo(a.cash, 9);
    expect(b.country.economy.gdp).toBeCloseTo(a.country.economy.gdp, 9);
  });

  it('два квартала без денег — банкротство', () => {
    let st = { ...fresh(), cash: -1000 };
    st = run(st, T.QUARTER_SEC * 2 + 2);
    expect(st.bankrupt).toBe(true);
  });

  it('репутация растёт со стоимостью проданной компании и ускоряет новое дело', () => {
    expect(T.legacyFor(T.SELL_MIN_VALUE)).toBeGreaterThanOrEqual(3);
    const a = run(fresh(), 20); const b = run(T.makeTycoon({ start: 'farm', legacy: 5 }), 20);
    expect(b.stats.income).toBeGreaterThan(a.stats.income * 1.3);
  });

  it('снимок можно проверить и восстановить', () => {
    const snap = JSON.parse(JSON.stringify(T.snapshotTycoon(run(fresh(), 10))));
    expect(T.validateTycoon(snap)).toBe(true);
    expect(T.validateTycoon({ mode: 'tycoon' })).toBe(false);
    expect(run(snap, 10).t).toBeGreaterThan(snap.t);
  });

  it('дерево технологий: несколько требований, у каждого узла место в дереве', () => {
    let st = { ...fresh(), rp: 1e6 };
    expect(T.canResearch(st, 'board')).toMatch(/Сначала/);
    for (const id of ['hr', 'management', 'finance_dept']) st = T.research(st, id).st;
    expect(T.canResearch(st, 'board')).toBeNull();
    const cells = new Set(T.RESEARCH.map((r) => `${r.tier}:${r.row}`));
    expect(cells.size).toBe(T.RESEARCH.length);
    T.RESEARCH.forEach((r) => T.reqsOf(r).forEach((q) => expect(T.RSR[q].tier).toBeLessThan(r.tier)));
  });

  it('менеджера нельзя нанять без исследования; нанятый получает зарплату', () => {
    let st = { ...fresh(), cash: 100 };
    expect(T.hireManager(st, 'foreman').error).toMatch(/Школа управленцев/);
    st = { ...st, research: { hr: true, management: true } };
    st = T.hireManager(st, 'foreman').st;
    expect(st.cash).toBeCloseTo(95, 5);
    expect(T.managerSalary(st)).toBeGreaterThan(0);
    expect(T.hireManager(st, 'foreman').error).toMatch(/Уже/);
  });

  it('управляющий сам улучшает работающие здания, технолог сам изучает', () => {
    let st = { ...fresh(), cash: 200, rp: 1000, research: { hr: true, management: true } };
    st = T.hireManager(st, 'foreman').st;
    st = T.hireManager(st, 'scientist').st;
    st = T.setManager(st, 'foreman', { budget: 100 }).st;
    st = run(st, 30);
    expect(st.buildings.some((b) => b.level >= 2)).toBe(true);
    expect(Object.keys(st.research).length).toBeGreaterThan(2);
  });

  it('коммерческий директор включает докупку, когда своего сырья не хватает', () => {
    let st = { ...T.makeTycoon({ start: 'retail' }), cash: 50, autoBuy: {}, research: { hr: true, management: true } };
    st = T.hireManager(st, 'trader').st;
    st = run(st, 12);
    expect(st.autoBuy.flour).toBe(true);
    expect(st.stats.rates.bread.sold).toBeGreaterThan(0.3);
  });

  it('директор по развитию строит производство сырья, которое приходится покупать', () => {
    let st = { ...T.makeTycoon({ start: 'retail' }), cash: 200, research: { hr: true, management: true, finance_dept: true, board: true } };
    st = T.hireManager(st, 'developer').st;
    st = T.setManager(st, 'developer', { budget: 100 }).st;
    const n0 = st.buildings.length;
    st = run(st, 30);
    expect(st.buildings.length).toBeGreaterThan(n0);
    expect(st.buildings.some((b) => b.type === 'mill')).toBe(true);
  });

  it('задания идут по одному, награду нельзя забрать раньше времени', () => {
    let st = { ...fresh(), cash: 10 };
    expect(T.currentQuest(st).id).toBe('build');
    expect(T.claimQuest(st).error).toBeTruthy();
    st = T.build(st, 'shop', 'capital').st;
    const c0 = st.cash;
    st = T.claimQuest(st).st;
    expect(st.cash).toBeCloseTo(c0 + T.QUESTS[0].reward, 5);
    expect(T.currentQuest(st).id).toBe('market');
    st = T.setMap(st, 'autoSell', 'grain', true).st;
    expect(T.currentQuest(st).test(st)).toBe(true);
  });

  it('старое сохранение дополняется новыми полями', () => {
    const old = { ...fresh() }; delete old.managers; delete old.quest; delete old.lifetime;
    const n = T.normalizeTycoon(old);
    expect(n.managers).toEqual({});
    expect(n.quest).toBe(0);
    expect(run(n, 5).t).toBeGreaterThan(0);
  });
});

