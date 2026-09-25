/* Выделено из engine.js: politics/groups.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG, clamp, rng } from '../catalog.js';
import { REGIME_INFO, ema, fmt1, fmtSigned1, regimeInfoLabel, regimeInfoText } from '../engine.js';
import { makeImpulse, sustainedImpulse } from '../content/events.js';
import { annexLoyalty, regionStress, votingRegions } from '../world/regions.js';
import { annexBlurb } from '../world/war.js';

/* ======================== ОБЩЕСТВО: СОЦИАЛЬНЫЕ ГРУППЫ ========================
   Рейтинг власти — не одна цифра на всю страну, а взвешенная сумма поддержки
   семи групп. У каждой свои интересы (groupDrivers — что и насколько двигает её
   поддержку сверх общего фона), память (groupMemory — решения, которые она
   помнит кварталами: пенсионная реформа, мобилизация, разгон протестов) и лидер.
   Группа с поддержкой от 50 — в коалиции власти; ниже 35 — в оппозиции и
   действует: пенсионеры выходят на улицы и голосуют активнее всех, рабочие
   бастуют, бизнес выводит капитал, молодёжь протестует и уезжает, силовики
   ропщут — и именно их потеря делает переворот вероятнее.
   В нейтральной экономике отклонения групп в сумме около нуля — рейтинг
   ведёт себя как раньше; разница появляется, когда политика выигрывает у одних
   и проигрывает у других. */
export const SOCIAL_GROUPS = [
  { id: 'pensioners', name: 'Пенсионеры', weight: 0.2, turnout: 1.5, icon: 'pensioners',
    leader: { name: 'Галина Воронцова', title: 'председатель Союза пенсионеров' },
    wants: 'Стабильные цены и индексацию пенсий и соцвыплат.',
    lost: 'Выходят на улицы и приходят на выборы активнее всех: их недовольство сильнее всего бьёт по итогу голосования.' },
  { id: 'workers', name: 'Рабочие', weight: 0.2, turnout: 1, icon: 'workers',
    leader: { name: 'Степан Грачёв', title: 'лидер Федерации профсоюзов' },
    wants: 'Работу, растущие реальные зарплаты и заказы заводам.',
    lost: 'Бастуют: встают заводы и шахты, проседают выпуск и экспорт.' },
  { id: 'business', name: 'Бизнес', weight: 0.12, turnout: 1, icon: 'business',
    leader: { name: 'Аркадий Левин', title: 'глава Союза промышленников' },
    wants: 'Низкие налоги и ставки, предсказуемые правила, никакой войны и произвола.',
    lost: 'Выводит капитал и откладывает инвестиции: растёт премия за риск.' },
  { id: 'siloviki', name: 'Силовики', weight: 0.08, turnout: 1, icon: 'siloviki',
    leader: { name: 'генерал Олег Рубцов', title: 'начальник Генштаба' },
    wants: 'Деньги на оборону, порядок и сильную руку.',
    lost: 'Ропщут в казармах: риск военного переворота растёт в разы даже при терпимом рейтинге.' },
  { id: 'public', name: 'Бюджетники', weight: 0.15, turnout: 1.1, icon: 'public',
    leader: { name: 'Нина Сомова', title: 'председатель профсоюза учителей и врачей' },
    wants: 'Зарплаты в бюджетной сфере, деньги на школы и больницы.',
    lost: 'Учителя и врачи бастуют: падает доверие к государству.' },
  { id: 'youth', name: 'Молодёжь', weight: 0.15, turnout: 0.6, icon: 'youth',
    leader: { name: 'Кира Лебедь', title: 'лидер студенческого движения' },
    wants: 'Работу, свободы и будущее — без войны и цензуры.',
    lost: 'Протестует и уезжает: растёт напряжённость, страна теряет рабочие руки.' },
  { id: 'regions', name: 'Регионы', weight: 0.1, turnout: 1.1, icon: 'regions',
    leader: { name: 'Павел Мирошник', title: 'глава Ассоциации губернаторов' },
    wants: 'Трансферты и стройки в областях, спокойствие на местах.',
    lost: 'Губернаторы саботируют решения центра: растут напряжённость и недоверие.' },
];
// что каждое решение президента значит для групп: кто выиграл, кто проиграл
export const ACTION_GROUP_EFFECTS = {
  address: { pensioners: 2, public: 1, regions: 1 },
  elite_deal: { business: 8, regions: 6, siloviki: 4, youth: -6, workers: -3 },
  anticorruption: { youth: 8, workers: 4, public: 3, business: -5, regions: -6, siloviki: -3 },
  crackdown: { siloviki: 10, youth: -18, workers: -8, business: -4, public: -4 },
  military_parade: { siloviki: 6, pensioners: 4, youth: -4 },
  sanctions_impose: { siloviki: 4, business: -8, workers: -2 },
  trade_bloc: { business: 8, youth: 4, workers: -3, siloviki: -3 },
  dissolve: { siloviki: 6, youth: -15, business: -6, public: -4 },
  restore_parliament: { youth: 10, business: 5, siloviki: -8 },
  war_start: { siloviki: 14, pensioners: 3, youth: -14, business: -12, workers: -3 },
  mobilization: { youth: -22, workers: -10, pensioners: -6, siloviki: 6 },
  war_economy: { workers: 6, siloviki: 8, business: -10, youth: -3 },
  peace_deal: { business: 8, youth: 8, siloviki: -10 },
  seize_control: { siloviki: 10, youth: -20, business: -10, public: -6, regions: -4 },
  labor: { business: 12, workers: -14, youth: 3 },
  pension: { pensioners: -22, business: 6, youth: 4, public: -3 },
  courts: { business: 8, youth: 5, siloviki: -6, regions: -3 },
  deregulation: { business: 12, youth: 3, public: -6, regions: -2 },
  education: { youth: 8, public: 6, pensioners: -2 },
  infra_program: { regions: 12, workers: 6, business: 3 },
};
export const groupMemoryOf = (effects, text, quarters) => Object.entries(effects || {})
  .filter(([, v]) => v).map(([group, amount]) => ({ group, amount, left: quarters, total: quarters, text }));
// что двигает группу сверх общего фона: [подпись, вклад в пунктах]
export function groupDrivers(id, x) {
  const infGap = Math.max(0, x.inflation - x.infTarget);
  const uGap = x.unemployment - x.nairu;
  const d = x.decisions || {};
  const sh = x.budgetShares || {};
  const num = (v, def) => (Number.isFinite(v) ? v : def);
  switch (id) {
    case 'pensioners': return [['Цены', -1.2 * infGap], ['Соцвыплаты', 0.7 * num(d.transfers, 0)]];
    case 'workers': return [['Безработица', -1.8 * uGap], ['Реальные зарплаты', 1.2 * (x.wageGrowth - x.inflation - 2)]];
    case 'business': return [['Ставка', -0.7 * (num(d.keyRate, 5.5) - (x.infTarget + 2))], ['Налог на прибыль', -0.8 * (num(d.profitTaxRate, 20) - 20)],
      ['Настроения бизнеса', 0.15 * (x.businessConfidence - 55)], ['Война', x.offensiveWar ? -6 : 0], ['Произвол', -8 * x.repression]];
    case 'siloviki': return [['Оборона в бюджете', 1.2 * (num(sh.defense, 15) - 15)], ['Сильная рука', 10 * x.repression], ['Война', x.atWar ? 4 : 0]];
    case 'public': return [['Госрасходы', 0.8 * num(d.govSpending, 0)], ['Школы и больницы', 0.5 * (num(sh.health, 19) + num(sh.education, 16) - 35)], ['Цены', -0.8 * infGap]];
    case 'youth': return [['Работа', -1.5 * uGap], ['Свободы', -14 * x.repression], ['Война', x.atWar ? -6 : 0]];
    case 'regions': return [['Напряжение в областях', -0.3 * (x.avgStress - 15)], ['Соцвыплаты', 0.5 * num(d.transfers, 0)], ['Стройки', 2 * x.projects]];
    default: return [];
  }
}
/* Что ползунок при этом значении значит для групп — те же коэффициенты, что и
   в groupDrivers, только по одному рычагу: [[группа, пункты], …]. */
export const LEVER_GROUP_SENS = {
  transfers: (v) => [['pensioners', 0.7 * v], ['regions', 0.5 * v]],
  govSpending: (v) => [['public', 0.8 * v]],
  profitTaxRate: (v) => [['business', -0.8 * (v - 20)]],
  keyRate: (v, t) => [['business', -0.7 * (v - (t + 2))]],
  shareDefense: (v) => [['siloviki', 1.2 * (v - 15)]],
  shareHealth: (v) => [['public', 0.5 * (v - 19)]],
  shareEducation: (v) => [['public', 0.5 * (v - 16)]],
};
export function leverGroupEffects(leverId, value, infTarget) {
  const f = LEVER_GROUP_SENS[leverId];
  if (!f || !Number.isFinite(value)) return [];
  return f(value, Number.isFinite(infTarget) ? infTarget : CONFIG.target.inflation)
    .map(([g, v]) => [g, Math.round(v * 10) / 10]).filter(([, v]) => Math.abs(v) >= 0.5);
}
export function groupStep(s, ctx) {
  const base = Number.isFinite(s.approval) ? s.approval : 55;
  const prev = s.groupSupport || {};
  // запись с wait > 0 ещё не действует: так живёт невыполненное обещание — сначала
  // благодарность, а через несколько кварталов разочарование
  const memory = [...(s.groupMemory || []).map((m) => (m.wait > 0 ? { ...m, wait: m.wait - 1 } : { ...m, left: m.left - 1 }))
    .filter((m) => m.left > 0), ...(ctx.newMemory || [])];
  const support = {}; const drivers = {};
  const meanDev = SOCIAL_GROUPS.reduce((acc, g) => acc + g.weight
    * clamp(groupDrivers(g.id, ctx).reduce((x, [, v]) => x + v, 0), -25, 25), 0);
  SOCIAL_GROUPS.forEach((g) => {
    const parts = groupDrivers(g.id, ctx).filter(([, v]) => Math.abs(v) >= 0.05);
    drivers[g.id] = parts.map(([k, v]) => [k, Math.round(v * 10) / 10]);
    // интересы групп в основном перераспределяют поддержку, а не опускают её всем
    // сразу: цены и безработица уже сидят в общем рейтинге (approvalTarget), и без
    // центрирования в кризисе они учитывались дважды — каждая группа тонула ещё и
    // по своим поводам. 80% среднего отклонения вычитаем; остаток — то, насколько
    // политика нравится обществу в целом сверх базового рейтинга
    const dev = clamp(parts.reduce((a, [, v]) => a + v, 0) - 0.8 * meanDev, -25, 25);
    const mem = memory.filter((m) => m.group === g.id && !(m.wait > 0)).reduce((a, m) => a + (m.amount * m.left) / m.total, 0);
    const target = clamp(ctx.approvalTarget + dev + mem, 0, 100);
    support[g.id] = clamp(ema(Number.isFinite(prev[g.id]) ? prev[g.id] : base, target, 0.28) + (ctx.push || 0), 0, 100);
  });
  const approval = clamp(SOCIAL_GROUPS.reduce((a, g) => a + g.weight * support[g.id], 0), 0, 100);
  // группы, отставшие от среднего по стране, добавляют напряжённости сверх той, что
  // даёт низкий рейтинг: расколотое общество неспокойнее ровно недовольного. Раньше
  // здесь считался просто уровень (40 − поддержка), и в кризисе, когда недовольны
  // все, общее недовольство учитывалось дважды — через рейтинг и ещё раз здесь:
  // в «Валютном кризисе» переворот случался почти в каждой партии
  const unrest = SOCIAL_GROUPS.reduce((a, g) => a + g.weight * Math.max(0, approval - 8 - support[g.id]), 0) * 1.2;
  return { support, memory, drivers, approval, unrest };
}
export const groupStatus = (v) => (v >= 60 ? 'опора власти' : v >= 50 ? 'лояльны' : v >= 35 ? 'колеблются' : 'в оппозиции');
export function coalitionOf(support) {
  const members = SOCIAL_GROUPS.filter((g) => (support || {})[g.id] >= 50);
  return { members: members.map((g) => g.id), weight: members.reduce((a, g) => a + g.weight, 0) };
}
// пенсионеры голосуют чаще молодёжи: итог выборов считается по явке, а не только по весу
export function groupTurnoutShift(s) {
  const sup = s.groupSupport;
  if (!sup) return 0;
  let tw = 0; let ts = 0; let plain = 0;
  SOCIAL_GROUPS.forEach((g) => {
    const v = Number.isFinite(sup[g.id]) ? sup[g.id] : 50;
    tw += g.weight * g.turnout; ts += g.weight * g.turnout * v; plain += g.weight * v;
  });
  return tw > 0 ? ts / tw - plain : 0;
}
// кто в какой области живёт — отсюда и разница в голосовании областей
export const REGION_GROUP_MIX = {
  capital: { youth: 0.25, public: 0.2, business: 0.2, pensioners: 0.15, workers: 0.1, siloviki: 0.1 },
  port: { workers: 0.3, business: 0.2, youth: 0.2, pensioners: 0.15, public: 0.1, regions: 0.05 },
  industry: { workers: 0.45, pensioners: 0.2, public: 0.15, youth: 0.1, regions: 0.1 },
  agri: { pensioners: 0.35, regions: 0.3, workers: 0.15, public: 0.15, youth: 0.05 },
  finance: { business: 0.4, youth: 0.2, public: 0.15, pensioners: 0.15, workers: 0.1 },
  mining: { workers: 0.45, regions: 0.2, pensioners: 0.15, siloviki: 0.1, public: 0.1 },
  periphery: { pensioners: 0.35, regions: 0.3, public: 0.2, workers: 0.1, youth: 0.05 },
};
export const ANNEX_GROUP_MIX = { regions: 0.4, workers: 0.3, pensioners: 0.2, youth: 0.1 };
export function regionGroupSupport(regionId, s) {
  const sup = s.groupSupport;
  if (!sup) return null;
  const mix = REGION_GROUP_MIX[regionId] || ANNEX_GROUP_MIX;
  return Object.entries(mix).reduce((a, [g, w]) => a + w * (Number.isFinite(sup[g]) ? sup[g] : 50), 0);
}
// лидер потерянной группы переходит к делу: протест, забастовка, бегство капитала
export const GROUP_UNREST = {
  pensioners: { headline: 'ПЕНСИОНЕРЫ ВЫШЛИ НА УЛИЦЫ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Пенсия не поспевает за ценами. Мы помним, кто это допустил, — и придём на выборы».`,
    impulses: (d) => [makeImpulse('tensionPush', 2, 'Протесты пенсионеров', 'fast', d, 'other')] },
  workers: { headline: 'ЗАБАСТОВКА: ПРОФСОЮЗЫ ОСТАНОВИЛИ ЗАВОДЫ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Работать за такие деньги — и при таких решениях — мы больше не будем».`,
    impulses: (d) => [makeImpulse('exportsGrowth', -0.8, 'Забастовка рабочих', 'fast', d, 'other'),
      makeImpulse('tensionPush', 2, 'Забастовка рабочих', 'fast', d, 'other')] },
  business: { headline: 'БИЗНЕС ВЫВОДИТ КАПИТАЛ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Вкладываться туда, где правила меняются каждый квартал, никто не будет».`,
    impulses: (d) => [makeImpulse('capitalFlow', -8, 'Бизнес выводит капитал', 'fast', d),
      makeImpulse('riskPremium', 0.05, 'Бизнес не верит власти', 'fast', d), makeImpulse('businessConfidence', -3, 'Бизнес не верит власти', 'fast', d, 'other')] },
  siloviki: { headline: 'РОПОТ В ГЕНШТАБЕ',
    text: (g) => `${g.leader.name}, ${g.leader.title}, на закрытом совещании: «Армию держат впроголодь и не слушают. Долго так продолжаться не может».`,
    impulses: (d) => [makeImpulse('tensionPush', 1, 'Недовольство силовиков', 'fast', d, 'other')] },
  public: { headline: 'УЧИТЕЛЯ И ВРАЧИ БАСТУЮТ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Школы и больницы держатся на нашем терпении. Оно кончилось».`,
    impulses: (d) => [makeImpulse('govTrust', -2, 'Забастовка бюджетников', 'default', d, 'other'),
      makeImpulse('tensionPush', 1.5, 'Забастовка бюджетников', 'fast', d, 'other')] },
  youth: { headline: 'МОЛОДЁЖЬ ПРОТЕСТУЕТ — И УЕЗЖАЕТ',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Здесь нам не оставили ни работы, ни голоса. Кто не выходит на площадь — покупает билет».`,
    impulses: (d) => [makeImpulse('tensionPush', 3, 'Протесты молодёжи', 'fast', d, 'other'),
      makeImpulse('laborForce', -0.05, 'Молодые уезжают', 'slow', d, 'other')] },
  regions: { headline: 'ГУБЕРНАТОРЫ ПРОТИВ ЦЕНТРА',
    text: (g) => `${g.leader.name}, ${g.leader.title}: «Области забыты. Решения центра на местах исполнять некому и незачем».`,
    impulses: (d) => [makeImpulse('govTrust', -1, 'Губернаторы против центра', 'default', d, 'other'),
      makeImpulse('tensionPush', 1, 'Губернаторы против центра', 'fast', d, 'other')] },
};
export function groupEpisodes(s, support, difficulty) {
  const out = { impulses: [], news: [], cd: {} };
  Object.entries(s.groupUnrestCd || {}).forEach(([id, v]) => { if (v > 1) out.cd[id] = v - 1; });
  /* Не больше одного выступления за квартал — от самой обиженной группы. Раньше каждая
     группа в оппозиции выходила сама по себе, и в глубоком кризисе, когда в оппозиции
     почти все, их толчки напряжения складывались (плюс пачка одинаковых заголовков
     в газете) — это и доводило кризисные сценарии до переворота почти всегда. */
  const angry = SOCIAL_GROUPS.filter((g) => support[g.id] < 35 && !out.cd[g.id]).sort((a, b) => support[a.id] - support[b.id]);
  const g = angry[0];
  if (g && rng() < 0.5) {
    const u = GROUP_UNREST[g.id];
    out.impulses.push(...u.impulses(difficulty));
    out.news.push(['crisis', u.headline, u.text(g), 7]);
    out.cd[g.id] = 3;
  }
  return out;
}

/* Требования лидеров групп. Когда группа уходит к оппозиции, её лидер приходит
   с конкретным требованием — и на него надо ответить в следующем квартале, как на
   событие в области: уступить (деньги, группа довольна надолго), пообещать (дёшево,
   благодарность сейчас — разочарование потом), отказать (группа запомнит).
   Отвечают Минфин и президент; без ответа — отказ. */
export const GROUP_DEMANDS = {
  pensioners: { title: 'Пенсионеры требуют внеочередной индексации', concede: 'Проиндексировать пенсии', spend: 0.2,
    text: (s) => `Инфляция ${fmt1(s.inflation)}%, пенсия за ценами не поспевает. Союз пенсионеров требует внеочередной индексации.` },
  workers: { title: 'Профсоюзы требуют заказов и индексации зарплат', concede: 'Госзаказ заводам и индексация', spend: 0.15,
    text: (s) => `Безработица ${fmt1(s.unemployment)}%. Федерация профсоюзов требует госзаказов и индексации зарплат на госпредприятиях.`,
    extra: (d) => [makeImpulse('inflationSupply', 0.1, 'Индексация зарплат по требованию профсоюзов', 'slow', d, 'other')] },
  business: { title: 'Бизнес требует снизить налоговую нагрузку', concede: 'Налоговые каникулы для бизнеса', spend: 0,
    text: (s) => `Премия за риск ${fmt1(s.riskPremium)} п.п., ставка ${fmt1(s.keyRate)}%. Союз промышленников требует налоговых каникул — иначе инвестиции уйдут за границу.`,
    extra: (d, s) => [sustainedImpulse('revenue', -(s.nominalGdp || 0) * 0.4 / 100, 6, 'Налоговые каникулы для бизнеса'),
      makeImpulse('businessConfidence', 4, 'Налоговые каникулы', 'default', d, 'other')] },
  siloviki: { title: 'Генштаб требует денег на перевооружение', concede: 'Выделить деньги на перевооружение', spend: 0.25,
    text: () => 'Генштаб докладывает: техника изношена, довольствие отстаёт от цен. Требование — внеочередное финансирование перевооружения.' },
  public: { title: 'Учителя и врачи требуют повышения зарплат', concede: 'Поднять зарплаты бюджетникам', spend: 0.2,
    text: () => 'Профсоюз учителей и врачей грозит забастовкой: зарплаты в школах и больницах отстали от цен и от частного сектора.' },
  youth: { title: 'Студенты требуют работы и свобод', concede: 'Молодёжная программа: рабочие места и гранты', spend: 0.08,
    text: (s) => `Молодёжная безработица растёт вдвое быстрее общей (${fmt1(s.unemployment)}%). Студенческое движение требует программы рабочих мест${s.politicalRegime === 'authoritarian' || s.politicalRegime === 'totalitarian' ? ' и отмены цензуры' : ''}.` },
  regions: { title: 'Губернаторы требуют трансфертов', concede: 'Увеличить трансферты областям', spend: 0.15,
    text: () => 'Ассоциация губернаторов: областные бюджеты пусты, зарплаты бюджетникам на местах платить нечем. Требование — трансферты из центра.' },
};
export function publicGroupDemand(groupId, s, q) {
  const g = SOCIAL_GROUPS.find((x) => x.id === groupId);
  const t = GROUP_DEMANDS[groupId];
  return { group: groupId, title: t.title, text: t.text(s), q, leader: g.leader, defaultOption: 'refuse',
    options: [
      { id: 'concede', tone: 'generous', label: t.concede, spend: t.spend, support: 10,
        effect: 'Группа довольна надолго — но это стоит денег.' },
      { id: 'promise', tone: 'cheap', label: 'Пообещать и отложить', spend: 0, support: 5,
        effect: 'Сейчас — благодарность, через год — разочарование, если обещание так и не выполнят.' },
      { id: 'refuse', tone: 'hard', label: 'Отказать', spend: 0, support: -7,
        effect: 'Бюджет цел, группа запомнит отказ — и её лидер перейдёт к делу.' },
    ] };
}
export function groupDemandStep(s, decisions, difficulty, q) {
  const out = { impulses: [], news: [], spendPct: 0, memory: [], demand: null, cooldown: Math.max(0, (s.groupDemandCooldown || 0) - 1), resolution: null };
  const pend = s.groupDemand;
  if (pend) {
    const t = GROUP_DEMANDS[pend.group];
    const chosen = pend.options.find((o) => o.id === decisions.groupResponse);
    const opt = chosen || pend.options.find((o) => o.id === pend.defaultOption);
    const g = SOCIAL_GROUPS.find((x) => x.id === pend.group);
    out.spendPct += opt.spend || 0;
    if (opt.id === 'concede') {
      out.memory.push(...groupMemoryOf({ [pend.group]: 10 }, pend.title, 10));
      if (t.extra) out.impulses.push(...t.extra(difficulty, s));
    } else if (opt.id === 'promise') {
      out.memory.push(...groupMemoryOf({ [pend.group]: 5 }, `Обещание: ${t.concede.toLowerCase()}`, 4));
      out.memory.push(...groupMemoryOf({ [pend.group]: -8 }, `Обещание не выполнено: ${t.concede.toLowerCase()}`, 8).map((m) => ({ ...m, wait: 4 })));
    } else {
      out.memory.push(...groupMemoryOf({ [pend.group]: -7 }, `Отказ: ${pend.title.toLowerCase()}`, 8));
      out.impulses.push(makeImpulse('tensionPush', 1, `${g.name}: требование отклонено`, 'fast', difficulty, 'other'));
    }
    out.resolution = { group: pend.group, title: pend.title, option: opt.id, label: opt.label, byDefault: !chosen, q };
    out.news.push(['gov', `${g.name.toUpperCase()}: ${chosen ? opt.label.toUpperCase() : 'ОТВЕТА НЕ ДАЛИ'}`,
      `${pend.title}. ${chosen ? `Ответ власти: «${opt.label}».` : 'Ответа так и не последовало — это читается как отказ.'} ${opt.effect}`, 7]);
    out.cooldown = Math.max(out.cooldown, 3);
    return out;
  }
  if (out.cooldown > 0 || q < 4) return out;
  const sup = s.groupSupport || {};
  const worst = SOCIAL_GROUPS.filter((g) => Number.isFinite(sup[g.id]) && sup[g.id] < 42).sort((a, b) => sup[a.id] - sup[b.id])[0];
  if (!worst || rng() >= 0.45) return out;
  out.demand = publicGroupDemand(worst.id, s, q);
  out.news.push(['crisis', out.demand.title.toUpperCase(), `${worst.leader.name}, ${worst.leader.title}: ${out.demand.text} Ответ нужен в следующем квартале.`, 8]);
  return out;
}

export const REGION_TEXT = {
  capital: {
    calm: (e) => `Аппарат работает штатно, рейтинг власти держится на ${Math.round(e.approval)} из 100 — столице нечего обсуждать сверх обычной повестки.`,
    tense: (e) => `Напряжённость в стране ${Math.round(e.politicalTension)} из 100 ощущается здесь острее всего — ближе всего к власти, ближе всего к недовольству ею.`,
    crisis: (e) => `Улицы Велеграда — первыми на очереди у любой перемены власти: рейтинг ${Math.round(e.approval)}, напряжённость ${Math.round(e.politicalTension)} из 100.`,
  },
  port: {
    calm: () => 'Погрузка идёт по графику, курс не пугает импортёров — обычный квартал для внешней торговли.',
    tense: (e) => `Курс ${fmt1(e.exchangeRate)} держит трейдеров в напряжении: контракты на следующий квартал подписывают с оговорками.`,
    crisis: (e) => `Резервы истрачены, курс ${fmt1(e.exchangeRate)} — импортные контракты замораживают, а не подписывают.`,
  },
  industry: {
    calm: () => 'Цеха загружены, заказы есть — обычный квартал для кузнецких заводов.',
    tense: (e) => `Безработица ${fmt1(e.unemployment)}% при норме ${fmt1(e.nairu)}% — часть цехов уже перешла на неполную неделю.`,
    crisis: (e) => `Заказы встали, безработица ${fmt1(e.unemployment)}% — не статистика, а очередь у проходной.`,
  },
  agri: {
    calm: () => 'Цены на урожай предсказуемы, кредит на посевную доступен — обычный квартал для приреченских хозяйств.',
    tense: (e) => `Инфляция ${fmt1(e.inflation)}% съедает выручку быстрее, чем успевает вырасти цена на зерно.`,
    crisis: (e) => `При инфляции ${fmt1(e.inflation)}% продавать урожай по контрактным ценам — значит себе в убыток; хозяйства придерживают запасы.`,
  },
  finance: {
    calm: () => 'Спреды узкие, кредит доступен — обычный квартал для златоградских банков.',
    tense: (e) => `Премия за риск ${fmt1(e.riskPremium)} п.п. — кредит дорожает быстрее, чем успевают пересчитать ставки по старым займам.`,
    crisis: (e) => `Премия за риск ${fmt1(e.riskPremium)} п.п. и банковский риск ${Math.round(e.bankingRisk)} из 100 — межбанк торгуется нервно, лимиты друг на друга урезаны.`,
  },
  mining: {
    calm: () => 'Добыча и энергогенерация идут ровным ходом — обычный квартал для рудногорских шахт.',
    tense: (e) => `Инфляция ${fmt1(e.inflation)}% при просевшем спросе — не лучшее время закладывать новую смену.`,
    crisis: () => 'Часть добывающих мощностей встала на консервацию — дешевле переждать, чем работать в убыток.',
  },
  periphery: {
    calm: () => 'Обычный квартал: ни ажиотажа, ни оттока — Боровская область этим и живёт.',
    tense: () => 'Отток молодёжи в Велеград ускоряется — там хотя бы платят вовремя.',
    crisis: (e) => `При напряжённости ${Math.round(e.politicalTension)} из 100 периферия голосует не бюллетенем, а переездом.`,
  },
};
export function regionBlurb(region, economy) {
  const stress = regionStress(region, economy);
  const tier = stress >= 65 ? 'crisis' : stress >= 35 ? 'tense' : 'calm';
  const fn = (REGION_TEXT[region.id] || {})[tier];
  if (region.annex) return { stress, tier, text: annexBlurb(region, economy) };
  return { stress, tier, text: fn ? fn(economy) : '' };
}

/* Результат выборов по округам. Отдельной «региональной явки» движок не
   считает — доля голосов за действующую власть в округе выводится из уже
   посчитанного общенационального результата тремя понятными слагаемыми:
   структурная склонность округа (lean), то, насколько именно ему живётся
   хуже или лучше среднего по стране (regionStress), и поправка, которая
   возвращает среднее по округам ровно к национальному результату — иначе
   сумма по карте не сходилась бы с цифрой в новостях.

   Без rng(): один и тот же квартал всегда даёт одну и ту же карту.
   При сфальсифицированных выборах (авторитаризм/тоталитаризм) рисуется не
   этот расчёт, а «официальный результат» — почти ровный по всей стране,
   потому что рисуют его в одном кабинете, а не считают по участкам. */
export function regionVoteShares(economy, nationalShare, rigged) {
  if (rigged) {
    // официальная цифра тем «единодушнее», чем жёстче режим
    const official = economy.politicalRegime === 'totalitarian' ? 91 : 78;
    return votingRegions(economy).map((r, i) => ({
      id: r.id,
      // разброс в пределах пары процентов — чтобы таблица не выглядела
      // напечатанной под копирку, но и не походила на настоящий подсчёт
      share: clamp(official + ((i % 3) - 1) * 1.4, 0, 100),
    }));
  }
  const regions = votingRegions(economy);
  const stresses = regions.map((r) => regionStress(r, economy));
  const avgStress = stresses.reduce((a, b) => a + b, 0) / (stresses.length || 1);
  // новая земля голосует ещё и по тому, насколько она уже своя
  // и по тому, кто в ней живёт: область рабочих голосует как рабочие
  const national = economy.groupSupport ? SOCIAL_GROUPS.reduce((a, g) => a + g.weight * (economy.groupSupport[g.id] ?? 50), 0) : 0;
  const raw = regions.map((r, i) => (r.lean || 0) + (avgStress - stresses[i]) * 0.35
    + (r.annex ? (annexLoyalty(economy, r.id) - 60) * 0.15 : 0)
    + (economy.groupSupport ? (regionGroupSupport(r.id, economy) - national) * 0.5 : 0));
  const mean = raw.reduce((a, b) => a + b, 0) / (raw.length || 1);
  return regions.map((r, i) => ({
    id: r.id,
    share: clamp(nationalShare + (raw[i] - mean), 0, 100),
  }));
}

/* «От редакции» под властью, которая контролирует прессу: не искажаем цифры, которые видит
   игрок (report остаётся точным и используется отдельно), а полностью пересобираем тон
   газетной колонки из тех же показателей — эвфемизмы вместо признаний, победные реляции
   вместо анализа. Во время войны пропаганда при тоталитаризме усиливается ещё сильнее. */
export function propagandaEditorial(e) {
  const regime = e.politicalRegime;
  const war = (e.warQuartersLeft || 0) > 0;
  /* Свободная пресса о той же войне пишет иначе — и это и есть влияние режима на
     газету: не только шрифт и вёрстка, но и то, чей счёт она предъявляет. */
  if (regime !== 'authoritarian' && regime !== 'totalitarian') {
    if (!war || !e.warByChoice) return null;
    return {
      headline: 'ВОЙНА И ЭКОНОМИКА: СЧЁТ, КОТОРЫЙ ПРИДЁТ ПОЗЖЕ',
      text: `Рейтинг власти ${Math.round(e.approval)} из 100: сплочение вокруг флага работает первые кварталы и не работает дальше. Санкции уже видны в торговле и инвестициях, премия за риск ${fmt1(e.riskPremium)} п.п., капитал уходит. Редакция напоминает: потенциал экономики, из которого забрали людей и мощности, не возвращается вместе с прекращением огня.`,
    };
  }
  const totalitarian = regime === 'totalitarian';
  const growthLine = e.gdpGrowth >= 0
    ? `Рост экономики составил ${fmt1(e.gdpGrowth)}% — государство подтверждает верность выбранного курса.`
    : `Плановая перестройка экономики (формально ${fmt1(e.gdpGrowth)}%) — необходимый и временный этап на пути к устойчивому подъёму.`;
  const jobsLine = e.unemployment <= e.nairu + 1
    ? 'Занятость держится на исторически комфортном уровне.'
    : 'Трудовые резервы проходят оптимизацию в интересах государства — временные неудобства окупятся сторицей.';
  const pricesLine = e.inflation <= e.inflationTarget + 2
    ? 'Цены — под полным контролем компетентных ведомств.'
    : 'Отдельные колебания цен носят исключительно технический характер и не должны беспокоить граждан: обеспечение всем необходимым остаётся приоритетом номер один.';
  const debtLine = totalitarian
    ? (e.debtToGdp > 80 ? ' Финансовая система работает с полной отдачей, мобилизуя все доступные резервы.' : '')
    : '';
  const warLine = war && e.warByChoice
    ? (totalitarian
      ? ' Операция развивается по плану, и каждый её этап приближает неизбежную победу. Сомневающийся в успехе действует на руку противнику.'
      : ' Особые меры, введённые в связи с операцией, носят временный характер и будут сняты по мере достижения поставленных целей.')
    : war
    ? (totalitarian
      ? ' Все трудности — достойная цена, которую нация с гордостью платит за неизбежную победу над врагом. Тот, кто сомневается в успехе, действует на руку противнику.'
      : ' Особые меры военного времени объясняют часть текущих трудностей и постепенно снимаются по мере стабилизации обстановки.')
    : '';
  const closing = totalitarian
    ? ' Инакомыслие в такой момент — не мнение, а угроза единству нации; редакция напоминает читателям о бдительности.'
    : ' Правительство призывает сохранять спокойствие и доверие к принимаемым мерам.';
  const headline = totalitarian
    ? (war ? 'ЕДИНСТВО ПЕРЕД ЛИЦОМ ВРАГА: ЭКОНОМИКА РАБОТАЕТ НА ПОБЕДУ' : 'СТРАНА УВЕРЕННО ИДЁТ ВПЕРЁД')
    : 'ВЛАСТЬ ДЕРЖИТ КУРС: СТАБИЛЬНОСТЬ ПРЕВЫШЕ ВСЕГО';
  return { headline, text: `${growthLine} ${jobsLine} ${pricesLine}${debtLine}${warLine}${closing}` };
}

export function buildReport({ prev, next, reasons }) {
  const p = [];
  p.push(`ВВП ${next.gdpGrowth >= 0 ? 'вырос' : 'сократился'} на ${fmt1(Math.abs(next.gdpGrowth))}% в годовом выражении при потенциальном росте ${fmt1(next.potentialGrowth)}%; разрыв выпуска ${fmtSigned1(next.outputGap)}%.`);
  p.push(`Инфляция ${next.inflation >= prev.inflation ? 'ускорилась' : 'замедлилась'} до ${fmt1(next.inflation)}% при ожиданиях ${fmt1(next.inflationExpectations)}%, безработица ${fmt1(next.unemployment)}% против естественного уровня ${fmt1(next.nairu)}%.`);
  p.push(`Бюджет: ${next.budgetBalancePctGdp >= 0 ? 'профицит' : 'дефицит'} ${fmt1(Math.abs(next.budgetBalancePctGdp))}% ВВП, долг ${fmt1(next.debtToGdp)}% ВВП, обслуживание забирает ${fmt1(next.interestToRevenue)}% доходов.`);
  p.push(`Ставка по кредитам ${fmt1(next.lendingRate)}% при нейтральной реальной ${fmt1(next.rStar)}%: денежные условия ${next.rateGap > 0.3 ? 'жёстче нейтральных' : next.rateGap < -0.3 ? 'мягче нейтральных' : 'близки к нейтральным'}, кредит ${fmtSigned1(next.creditGrowth)}%.`);
  if (next.creditCrunch) p.push('Капитал банков ограничивает выдачу кредитов — спрос на заёмные средства не удовлетворён.');
  if (Math.abs(next.inflationExpectations - prev.inflationExpectations) > 0.25) {
    p.push(`Инфляционные ожидания ${next.inflationExpectations > prev.inflationExpectations ? 'сдвинулись вверх' : 'опустились'} — доверие к ЦБ ${fmt1(next.cbCredibility)}. Чем ниже доверие, тем дороже обойдётся возврат инфляции к цели.`);
  }
  const top = reasons.gdpGrowth[0];
  if (top) p.push(`Главный фактор динамики выпуска: ${top.reasonText.charAt(0).toLowerCase()}${top.reasonText.slice(1)}.`);
  if (next.regime !== 'normal' && REGIME_INFO[next.regime]) p.push(`Режим экономики — ${regimeInfoLabel(REGIME_INFO[next.regime], next).toLowerCase()}. ${regimeInfoText(REGIME_INFO[next.regime], next)}`);
  return p.join(' ');
}

