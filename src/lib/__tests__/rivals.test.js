import { describe, it, expect } from 'vitest';
import * as T from '../tycoon.js';
import { withSeededRandom } from '../catalog.js';

const run = (st, sec, seed = 5) => withSeededRandom(seed, () => T.tick(st, sec));
const withRival = (st, id, patch) => ({ ...st, rivals: st.rivals.map((c) => (c.id === id ? { ...c, entered: true, mode: 'hold', ...patch } : c)) });

describe('Своё дело: конкуренты', () => {
  it('новая партия начинается с конкурентами, которые выходят на рынок по очереди', () => {
    const st = T.makeTycoon({ start: 'retail' });
    expect(st.rivals.map((c) => c.id)).toEqual(T.RIVALS.map((r) => r.id));
    const later = run(st, 60 * 3 + 5);
    const entered = later.rivals.filter((c) => c.entered).map((c) => c.id);
    expect(entered).toContain('kolos');
    expect(entered).not.toContain('westra');
    expect(later.news.some((n) => /НА РЫНОК ВЫХОДИТ/.test(n.headline))).toBe(true);
  });

  it('конкурент рядом отнимает часть покупателей, и чем он дешевле — тем больше', () => {
    const st = T.makeTycoon({ start: 'retail' });
    const alone = T.marketSplit(st, 'capital', 'bread', 1.5).share;
    const near = withRival(st, 'kolos', { shops: { capital: 1.5 }, markup: 8 });
    const cheap = withRival(st, 'kolos', { shops: { capital: 1.5 }, markup: -15 });
    expect(alone).toBe(1);
    expect(T.marketSplit(near, 'capital', 'bread', 1.5).share).toBeLessThan(0.7);
    expect(T.marketSplit(cheap, 'capital', 'bread', 1.5).share).toBeLessThan(T.marketSplit(near, 'capital', 'bread', 1.5).share);
  });

  it('оптовик-конкурент сбивает цену, по которой вы продаёте излишки', () => {
    const st = T.makeTycoon({ start: 'farm' });
    const before = T.sellPrice(st, 'steel', 0);
    const after = T.sellPrice(withRival(st, 'stal', {}), 'steel', 0);
    expect(after).toBeLessThan(before);
  });

  it('конкуренты в области поднимают там зарплаты', () => {
    const st = T.makeTycoon({ start: 'farm' });
    expect(T.rivalWageK(st, 'capital')).toBe(1);
    expect(T.rivalWageK(withRival(st, 'westra', { shops: { capital: 4.5 } }), 'capital')).toBeGreaterThan(1.05);
  });

  it('при вашей большой доле рынка конкурент начинает ценовую войну', () => {
    let st = T.makeTycoon({ start: 'retail' });
    st = run(st, 30);
    st = withRival(st, 'kolos', { shops: { agri: 1.5 }, cash: 20 });
    st = { ...st, stats: { ...st.stats, rivalSold: { bread: { kolos: 0.01 } } } };
    st = run(st, 31);
    const k = st.rivals.find((c) => c.id === 'kolos');
    expect(k.mode).toBe('war');
    expect(k.markup).toBeLessThan(0);
  });

  it('разорившийся конкурент уходит с рынка', () => {
    let st = T.makeTycoon({ start: 'retail' });
    st = withRival(st, 'kolos', { cash: -20, distress: 3 });
    st = run(st, 61);
    const k = st.rivals.find((c) => c.id === 'kolos');
    expect(k.alive).toBe(false);
    expect(st.news.some((n) => /УШЁЛ С РЫНКА/.test(n.headline))).toBe(true);
  });

  it('конкурента можно купить: его магазины становятся вашими, участки под них добавляются', () => {
    let st = T.makeTycoon({ start: 'retail' });
    st = withRival(st, 'kolos', { shops: { capital: 3, agri: 1.5 }, cash: 2, distress: 1 });
    const price = T.rivalPrice(st, 'kolos');
    expect(T.canBuyRival(st, 'kolos')).toBe('Не хватает денег');
    st = { ...st, cash: price + 5 };
    const shops0 = st.buildings.filter((b) => b.type === 'shop').length;
    const r = T.buyRival(st, 'kolos');
    expect(r.st.buildings.filter((b) => b.type === 'shop').length).toBe(shops0 + 3);
    expect(T.usedIn(r.st, 'capital')).toBeLessThanOrEqual(T.slotsIn(r.st, 'capital'));
    expect(r.st.rivals.find((c) => c.id === 'kolos').mode).toBe('bought');
    expect(r.st.cash).toBeCloseTo(5, 5);
    // здоровую вестравскую сеть не продают
    const w = withRival(T.makeTycoon({ start: 'retail' }), 'westra', { distress: 0 });
    expect(T.canBuyRival({ ...w, cash: 1e6 }, 'westra')).toMatch(/не продают/);
  });

  it('сговор: при согласии конкурент держит цены, а за нарушение отвечает войной', () => {
    let st = T.makeTycoon({ start: 'retail' });
    st = withRival(st, 'kolos', { shops: { agri: 1.5 }, distress: 1, cash: 10 });
    let agreed = null;
    for (let seed = 1; seed < 30 && !agreed; seed++) {
      const r = withSeededRandom(seed, () => T.proposeCartel(st, 'kolos'));
      if (r.ok) agreed = r.st;
    }
    expect(agreed.rivals.find((c) => c.id === 'kolos')).toMatchObject({ mode: 'cartel', markup: 15 });
    // игрок демпингует — договорённость рушится, начинается война (если не пришёл штраф раньше)
    let broke = { ...agreed, markup: { bread: -10 }, events: { ...agreed.events } };
    broke = withSeededRandom(99, () => T.tick(broke, 61));
    expect(['war', 'hold']).toContain(broke.rivals.find((c) => c.id === 'kolos').mode);
    expect(T.proposeCartel(withRival(st, 'stal', {}), 'stal').error).toMatch(/оптом/);
  });

  it('вестравская сеть уходит из страны при санкциях против Вестравии', () => {
    let st = T.makeTycoon({ start: 'retail' });
    st = withRival(st, 'westra', { shops: { capital: 3 } });
    st = { ...st, country: { ...st.country, economy: { ...st.country.economy, sanctionsQuartersLeft: 5 } } };
    st = run(st, 61);
    expect(st.rivals.find((c) => c.id === 'westra').alive).toBe(false);
  });

  it('старое сохранение без конкурентов получает их при загрузке', () => {
    const st = T.makeTycoon({ start: 'farm' });
    const old = { ...st };
    delete old.rivals; delete old.startQ;
    const n = T.normalizeTycoon(old);
    expect(n.rivals).toHaveLength(T.RIVALS.length);
    expect(Number.isFinite(n.startQ)).toBe(true);
  });
});
