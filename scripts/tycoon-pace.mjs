/* Прогон темпа «Своего дела»: игрок-бот (все менеджеры с первой секунды — как
   активный игрок, который строит, улучшает, исследует и торгует) играет N минут
   на каждом старте. Печатает, когда открываются вехи и задания, сколько стоит
   компания по минутам, как идут дела у конкурентов и какая у игрока доля рынка.
   node scripts/tycoon-pace.mjs [минут=40] [зёрен=3] */
import { withSeededRandom } from '../src/lib/catalog.js';
import * as T from '../src/lib/tycoon.js';

const MIN = Number(process.argv[2] || 40);
const SEEDS = Number(process.argv[3] || 3);
const fmt = (v) => (v >= 100 ? Math.round(v) : v.toFixed(1));

/* Игрок-бот: доводит цепочки до полки, ставит магазины под спрос, сырьё — под
   закупки, лабораторию — как только по карману; остальное — улучшения. Склад и
   цены ведёт коммерческий директор, улучшения — управляющий. */
const NEXT = { flour: 'bakery', boards: 'furniture_plant', steel: 'machine_plant' };
function bestSite(st, type) {
  return T.regionsOpen(st).filter((rg) => T.siteBonus(type, rg) != null)
    .sort((a, b) => (T.siteBonus(type, b) - T.siteBonus(type, a)) || (T.usedIn(st, a) - T.usedIn(st, b)))[0];
}
function place(st, type, region) {
  const rg = region || bestSite(st, type);
  if (!rg) return null;
  let s = st;
  if (T.usedIn(s, rg) >= T.slotsIn(s, rg)) {
    if (s.cash < T.slotCost(s, rg) + T.BLD[type].cost) return null;
    s = T.buySlot(s, rg).st;
  }
  const r = T.build(s, type, rg);
  return r.st || null;
}
function play(st) {
  const has = (t) => st.buildings.some((b) => b.type === t);
  const tryPlace = (type, region) => { const n = place(st, type, region); if (n) { st = n; return true; } return false; };
  // лаборатория — как только по карману: она ускоряет всё остальное
  if (!has('lab') && has('shop') && st.cash > T.BLD.lab.cost * 1.5 && tryPlace('lab', 'capital')) return st;
  // исследование: самое дешёвое из доступного
  const avail = T.RESEARCH.filter((r) => !T.canResearch(st, r.id)).sort((a, b) => T.researchCost(st, a.id) - T.researchCost(st, b.id));
  if (avail[0]) st = T.research(st, avail[0].id).st;
  // 1) следующее звено цепочки для того, что уходит оптом: если такой цех не простаивает
  //    и после стройки останутся деньги на магазин под новый товар
  for (const [res, nxt] of Object.entries(NEXT)) {
    const rate = st.stats.rates[res] || {};
    const d = T.BLD[nxt];
    if (d.unlock && !T.has(st, d.unlock)) continue;
    const idle = st.buildings.some((b) => b.type === nxt && (st.stats.runK || {})[b.uid] < 0.8);
    const sellsToPeople = Object.keys(d.out).some((r) => T.RES[r].consumer);
    const need = d.cost + (sellsToPeople && !has('shop') ? T.BLD.shop.cost : 0) + 2;
    if (!idle && (rate.prod || 0) > 0.2 && (rate.sold || 0) > (rate.prod || 0) * 0.3 && st.cash >= need) { if (tryPlace(nxt)) return st; }
  }
  // 2) потребительский товар есть — магазин туда, где спрос не обслужен
  const goods = T.RESOURCES.filter((r) => r.consumer && ((st.stats.rates[r.id] || {}).prod || 0) > 0.05);
  if (goods.length && (!has('shop') || goods.some((g) => (st.stock[g.id] || 0) > 40))) {
    const g = goods[0];
    const rg = T.regionsOpen(st).sort((a, b) => T.regionDemand(st, b, g.id) / (1 + st.buildings.filter((x) => x.region === b && T.BLD[x.type].sells).length)
      - T.regionDemand(st, a, g.id) / (1 + st.buildings.filter((x) => x.region === a && T.BLD[x.type].sells).length))[0];
    if (tryPlace('shop', rg)) return st;
  }
  // 3) цехам не хватает сырья — своё производство
  const short = T.RESOURCES.filter((r) => !r.buyOnly && ((st.stats.rates[r.id] || {}).bought || 0) > 0.1)[0];
  if (short) { const prod = T.BUILDINGS.find((d) => d.out && d.out[short.id] && (!d.unlock || T.has(st, d.unlock))); if (prod && tryPlace(prod.id)) return st; }
  return st;
}

for (const start of Object.keys(T.STARTS)) {
  const rows = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    withSeededRandom(seed, () => {
      let st = T.makeTycoon({ start });
      st = { ...st, introSeen: true, flags: { touched_autoSell: true }, managers: Object.fromEntries(['foreman', 'trader'].map((id) => [id, { on: true, budget: 40 }])) };
      const marks = {}; const values = {}; const quests = {};
      for (let s = 0; s < MIN * 60; s += 5) {
        st = T.tick(st, 5);
        st = play(st);
        st = T.checkMilestones(st);
        for (;;) { const r = T.claimQuest(st); if (!r.st) break; quests[T.QUESTS[st.quest].id] = (s / 60).toFixed(1); st = r.st; }
        Object.keys(st.milestones).forEach((k) => { if (!marks[k]) marks[k] = (s / 60).toFixed(1); });
        if (Object.keys(st.research).length && !marks.research1) marks.research1 = (s / 60).toFixed(1);
        const m = (s + 5) / 60;
        if (process.env.TRACE === start && seed === Number(process.env.SEED || 1) && Number.isInteger(m) && m % 4 === 0) {
          const h = st.history[st.history.length - 1] || {};
          console.log(`  [${m}м] деньги ${fmt(st.cash)} долг ${fmt(T.totalDebtT(st))} выручка ${fmt(h.revenue || 0)} (розн ${fmt(h.retail || 0)} опт ${fmt(h.wholesale || 0)}) закупки ${fmt(h.purchases || 0)} зп ${fmt(h.wages || 0)} содерж ${fmt(h.upkeep || 0)} перев ${fmt(h.transport || 0)} | ${st.rivals.filter((c) => c.entered).map((c) => `${c.id}:${c.mode}:${Math.round(c.markup)}:${Object.entries(c.shops).map(([r, v]) => r + v).join('/')}`).join(' ')} | наценка ${JSON.stringify(st.markup)} | ${st.buildings.map((b) => b.type + b.level + '@' + b.region).join(' ')}`);
        }
        if ([5, 10, 20, 40, 60].includes(m)) values[m] = T.companyValue(st);
        if (st.bankrupt) { marks.bankrupt = (s / 60).toFixed(1); break; }
      }
      const sh = T.marketShares(st);
      rows.push({ seed, marks, values, quests, research: Object.keys(st.research).length, buildings: st.buildings.length,
        rivals: st.rivals.map((c) => `${T.RIVAL[c.id].short}:${c.alive ? T.RIVAL_MODE_LABEL[c.mode] : T.RIVAL_MODE_LABEL[c.mode] || 'нет'}(${fmt(c.cash)})`).join(' '),
        share: Object.entries(sh).map(([g, v]) => `${g} ${Math.round(v.mine * 100)}%`).join(', '),
        news: st.news.filter((n) => n.own && /«/.test(n.headline)).length });
    });
  }
  console.log(`\n=== старт: ${start} ===`);
  rows.forEach((r) => {
    console.log(`зерно ${r.seed}: стоимость ${Object.entries(r.values).map(([m, v]) => `${m}м=${fmt(v)}`).join(' ')} | зданий ${r.buildings}, исследований ${r.research}`);
    console.log(`  вехи: ${Object.entries(r.marks).map(([k, v]) => `${k}@${v}`).join(' ')}`);
    console.log(`  задания: ${Object.entries(r.quests).map(([k, v]) => `${k}@${v}`).join(' ')}`);
    console.log(`  конкуренты: ${r.rivals} | доля: ${r.share} | новостей о конкурентах: ${r.news}`);
  });
}
