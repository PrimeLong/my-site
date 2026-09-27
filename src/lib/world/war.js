/* Выделено из engine.js: world/war.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { clamp, rng } from '../catalog.js';
import { makeImpulse, sustainedImpulse, taperedImpulse } from '../content/events.js';
import { relationsOf } from './diplomacy.js';
import { INTEGRATED_AT, INTEGRATION_COST, PARTISAN_BELOW, REGION_PROJECTS, activeRegions, annexLoyalty, regionById } from './regions.js';

/* ======================== НАСТУПАТЕЛЬНАЯ ОПЕРАЦИЯ ========================
   Своя война — не только счётчик кварталов и санкции. Пока страна наступает на
   Норланд, у операции три цели, и каждый квартал президент отдаёт приказ: куда
   бить и как. Штурм быстр, дорог и стоит жизней; осада медленнее и дешевле;
   удержание почти не двигает фронт, зато гасит контратаки; перемирие закрывает
   войну по линии фронта. Продвижение зависит от доли обороны в бюджете и от
   того, насколько страна поддерживает армию. Взятые цели — не только флажок на
   карте: копи дают экспорт, перевал открывает дорогу на Нордхольм, падение
   Нордхольма при уже взятых остальных целях — капитуляция Норланда. */
export const WAR_OBJECTIVES = [
  { id: 'pass', name: 'Ледяной перевал', headline: 'ВЗЯТ ЛЕДЯНОЙ ПЕРЕВАЛ', desc: 'Горный проход: без него к Нордхольму не подойти. Взятый — облегчает все следующие штурмы и гасит контратаки.' },
  { id: 'mines', name: 'Копи Хальвика', headline: 'ВЗЯТЫ КОПИ ХАЛЬВИКА', desc: 'Рудники у самой границы. Взятые — дают стране экспорт руды и удешевляют сырьё.' },
  // к столице ведут два пути: через перевал и с востока, от копей Хальвика
  { id: 'city', name: 'Нордхольм', headline: 'ВЗЯТ НОРДХОЛЬМ', desc: 'Столица Норланда. Подойти можно через перевал или со стороны копей Хальвика; её падение при уже взятых целях — капитуляция противника.', requiresAny: ['pass', 'mines'] },
];
/* Войну можно объявить любому соседу. У каждой страны свои цели операции; земли
   присоединяются только у Норланда (горный край, который и так спорный) — у Дешта и
   Вестравии взятое возвращается по миру, а счёт закрывают репарации. enemyK — насколько
   трудно продвигаться: Вестравия втрое больше и лучше вооружена, Дешт держит армию. */
export const WAR_OBJECTIVES_SW = [
  { id: 'steppe', target: 'southwest', name: 'Приграничные степи', headline: 'ВЗЯТЫ ПРИГРАНИЧНЫЕ СТЕПИ', desc: 'Равнина за Приреченской областью: без неё к нефтепромыслам не подойти.' },
  { id: 'oil', target: 'southwest', name: 'Кумсайские нефтепромыслы', headline: 'ВЗЯТЫ КУМСАЙСКИЕ НЕФТЕПРОМЫСЛЫ', desc: 'Нефть Дешта. Взятые — дешевле топливо и дороже экспорт, пока идёт война.', requiresAny: ['steppe'] },
  { id: 'ashkala', target: 'southwest', name: 'Ашкала', headline: 'ВЗЯТА АШКАЛА', desc: 'Столица Дешта: её падение — капитуляция и репарации.', requiresAny: ['oil'] },
];
export const WAR_OBJECTIVES_W = [
  { id: 'fort', target: 'west', name: 'Пограничные укрепления', headline: 'ПРОРВАНА ПОГРАНИЧНАЯ ЛИНИЯ ВЕСТРАВИИ', desc: 'Долговременная оборона вдоль границы — первое, что нужно прорвать.' },
  { id: 'limmern', target: 'west', name: 'Лиммерн', headline: 'ВЗЯТ ЛИММЕРН', desc: 'Промышленный город на пути к столице.', requiresAny: ['fort'] },
  { id: 'westgrad', target: 'west', name: 'Вестград', headline: 'ВЗЯТ ВЕСТГРАД', desc: 'Столица Вестравии: её падение — капитуляция и репарации.', requiresAny: ['limmern'] },
];
export const WAR_OBJECTIVE_BY_ID = Object.fromEntries([...WAR_OBJECTIVES, ...WAR_OBJECTIVES_SW, ...WAR_OBJECTIVES_W].map((o) => [o.id, o]));
export const WAR_TARGETS = {
  north: { name: 'Норланд', gen: 'Норланда', ins: 'с Норландом', up: 'НОРЛАНД', objectives: WAR_OBJECTIVES, enemyK: 1, front: 'mining' },
  southwest: { name: 'Дешт', gen: 'Дешта', ins: 'с Дештом', up: 'ДЕШТ', objectives: WAR_OBJECTIVES_SW, enemyK: 0.8, front: 'agri' },
  west: { name: 'Вестравия', gen: 'Вестравии', ins: 'с Вестравией', up: 'ВЕСТРАВИЯ', objectives: WAR_OBJECTIVES_W, enemyK: 0.5, front: 'periphery', partner: true },
};
export const warTargetOf = (s) => (WAR_TARGETS[s && s.warTarget] ? s.warTarget : 'north');
export const warObjectivesFor = (target) => (WAR_TARGETS[target] || WAR_TARGETS.north).objectives;
// кому можно объявить войну: у Норланда — пока ещё есть что взять
export function warTargetAvailable(s, target) {
  if (s.economyOnly || !WAR_TARGETS[target] || (s.warQuartersLeft || 0) > 0) return false;
  if (target === 'north') return (s.annexed || []).length < 3;
  return true;
}
// бот-президент, решивший воевать, идёт на того, с кем отношения хуже всего
export function defaultWarTarget(s) {
  const rel = relationsOf(s);
  const ok = Object.keys(WAR_TARGETS).filter((t) => warTargetAvailable(s, t));
  return ok.sort((a, b) => rel[a] - rel[b])[0] || 'north';
}
// цель не выбрана (указ из кабинета, а не с карты) — как и раньше, Норланд, пока у него есть что взять
export const sanitizeWarTarget = (t, s) => (warTargetAvailable(s, t) ? t
  : !t && warTargetAvailable(s, 'north') ? 'north' : defaultWarTarget(s));
export const WAR_STANCES = [
  { id: 'assault', label: 'Штурм', spend: 0.35, desc: 'Быстрое продвижение, но большие потери и расходы.' },
  { id: 'siege', label: 'Осада и обстрел', spend: 0.2, desc: 'Медленнее, дешевле, потерь меньше.' },
  { id: 'hold', label: 'Держать позиции', spend: 0.1, desc: 'Фронт почти не движется, контратаки противника слабее.' },
  { id: 'ceasefire', label: 'Предложить перемирие', spend: 0, desc: 'Закончить войну по нынешней линии фронта; взятые цели остаются за страной.' },
];
// уже присоединённое после прошлой войны считается взятым: второй раз его не штурмуют
export const newWarCampaign = (annexed, target = 'north') => {
  const own = target === 'north' ? (annexed || []) : [];
  return { progress: Object.fromEntries(warObjectivesFor(target).map((o) => [o.id, own.includes(o.id) ? 100 : 0])), captured: [...own], last: null };
};
// что даёт присоединение: люди, руда, но и сопротивление на новых землях
export const ANNEX_EFFECT = {
  pass: { name: 'Перевальский район', impulses: (d) => [makeImpulse('laborForce', 0.2, 'Присоединён Перевальский район', 'slow', d, 'other')] },
  mines: { name: 'Хальвикский край', impulses: (d) => [makeImpulse('laborForce', 0.3, 'Присоединён Хальвикский край', 'slow', d, 'other'),
    sustainedImpulse('exportsGrowth', 0.8, 16, 'Руда Хальвикского края'), makeImpulse('inflationSupply', -0.2, 'Своя руда Хальвика', 'slow', d, 'other')] },
  city: { name: 'Нордхольмская область', impulses: (d) => [makeImpulse('laborForce', 0.8, 'Присоединена Нордхольмская область', 'slow', d, 'other'),
    makeImpulse('approvalPush', 3, 'Присоединена Нордхольмская область', 'fast', d, 'other')] },
};
export const warObjectiveOpen = (id, camp) => {
  const o = WAR_OBJECTIVE_BY_ID[id];
  const cap = camp.captured || [];
  return !!o && !cap.includes(id) && (!o.requires || cap.includes(o.requires))
    && (!o.requiresAny || o.requiresAny.some((x) => cap.includes(x)));
};
// сила армии: доля обороны в бюджете и поддержка в обществе
export function warStrength(s) {
  const defense = (s.budgetShares && s.budgetShares.defense) || 15;
  return clamp(0.55 + (defense - 10) / 20 + ((s.approval || 50) - 50) / 200, 0.45, 1.5);
}
/* Приказ действует, пока его не отменят: без нового приказа армия продолжает
   прошлый (та же цель, если её ещё не взяли, и тот же способ). Самый первый
   приказ по умолчанию — осада ближайшей цели, армия действует по уставу. */
export function defaultWarOrder(camp, enemy = 'north') {
  const last = camp.last && camp.last.stance !== 'ceasefire' ? camp.last : null;
  const first = warObjectivesFor(enemy).find((o) => warObjectiveOpen(o.id, camp));
  const target = last && warObjectiveOpen(last.target, camp) ? last.target : first ? first.id : null;
  return { target, stance: last ? last.stance : 'siege' };
}
/* Бот-президент командует по характеру: силовик штурмует, популист штурмует,
   пока его поддерживают, технократ и реформатор осаждают и ищут перемирие,
   когда взято хоть что-то, а поддержка тает. */
export function botWarOrder(s, personaId) {
  const target = warTargetOf(s);
  const camp = s.warCampaign || newWarCampaign(s.annexed, target);
  const order = defaultWarOrder(camp, target);
  if (!order.target) return { target: null, stance: 'ceasefire' };
  const approval = s.approval || 50;
  if (personaId === 'strongman') order.stance = approval > 20 ? 'assault' : 'ceasefire';
  else if (personaId === 'populist') order.stance = approval > 45 ? 'assault' : approval > 30 ? 'hold' : 'ceasefire';
  else {
    order.stance = 'siege';
    if ((camp.captured.length >= 1 && approval < 45) || approval < 30) order.stance = 'ceasefire';
  }
  // копи выгоднее перевала, если перевал уже стоит дорого, — но сначала то, что ближе к взятию
  const best = warObjectivesFor(target).filter((o) => warObjectiveOpen(o.id, camp)).sort((a, b) => camp.progress[b.id] - camp.progress[a.id])[0];
  if (best) order.target = best.id;
  return order;
}
export function warCampaignStep(s, decisions, difficulty) {
  const out = { impulses: [], news: [], spendPct: 0, endWar: false, victory: false };
  const active = (s.warQuartersLeft || 0) > 0 && s.warType === 'offensive';
  if (!active) return { ...out, campaign: null };
  const tgt = warTargetOf(s);
  const T = WAR_TARGETS[tgt];
  const OBJ = T.objectives;
  const camp = s.warCampaign ? { progress: { ...s.warCampaign.progress }, captured: [...(s.warCampaign.captured || [])], last: s.warCampaign.last } : newWarCampaign(s.annexed, tgt);
  const def = defaultWarOrder(camp, tgt);
  const raw = decisions.warOrder || {};
  const stance = WAR_STANCES.find((x) => x.id === raw.stance) || WAR_STANCES.find((x) => x.id === def.stance) || WAR_STANCES[1];
  const target = warObjectiveOpen(raw.target, camp) ? raw.target : def.target;
  out.spendPct = stance.spend;
  const pressFree = s.politicalRegime !== 'authoritarian' && s.politicalRegime !== 'totalitarian';
  if (stance.id === 'ceasefire' || !target) {
    out.endWar = true;
    const n = camp.captured.length;
    out.impulses.push(makeImpulse('approvalPush', n ? 2 * n : -3, `Перемирие ${T.ins}`, 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 4, 'Боевые действия прекращены', 'default', difficulty, 'other'),
      makeImpulse('tensionPush', n ? -2 : 3, `Перемирие ${T.ins}`, 'fast', difficulty, 'other'));
    // у Дешта и Вестравии земли не берут: взятое возвращается, а за него платят
    if (tgt !== 'north' && n) out.impulses.push(sustainedImpulse('revenue', (s.nominalGdp || 0) * 0.25 * n / 100, 6, `Выплаты ${T.gen} по перемирию`));
    out.news.push(['gov', `ПЕРЕМИРИЕ ${T.ins.toUpperCase()}`, n
      ? (tgt === 'north'
        ? `Боевые действия остановлены по линии фронта. За страной остаётся: ${camp.captured.map((id) => WAR_OBJECTIVE_BY_ID[id].name).join(', ')}.`
        : `Боевые действия остановлены. Взятое (${camp.captured.map((id) => WAR_OBJECTIVE_BY_ID[id].name).join(', ')}) возвращается ${T.gen === 'Вестравии' ? 'Вестравии' : 'Дешту'} — в обмен на выплаты полтора года.`)
      : `Боевые действия остановлены там же, где начались.${pressFree ? ' Цели операции не достигнуты — и это понятно всем.' : ' Официально — ради сохранения жизней.'}`, 10]);
    camp.last = { target: null, stance: 'ceasefire', gained: 0, counter: null };
    return { ...out, campaign: camp };
  }
  // затяжная война: санкции и усталость давят всё сильнее, пока её не закончат
  if ((s.warElapsed || 0) >= 10) {
    out.impulses.push(makeImpulse('exportsGrowth', -0.6, 'Санкции за затяжную войну', 'fast', difficulty, 'other'),
      makeImpulse('approvalPush', -0.6, 'Усталость от затяжной войны', 'fast', difficulty, 'other'),
      makeImpulse('riskPremium', 0.04, 'Затяжная война', 'fast', difficulty));
  }
  // война с главным торговым партнёром бьёт по экспорту и капиталу каждый квартал
  if (T.partner) out.impulses.push(makeImpulse('exportsGrowth', -1.5, 'Торговля с Вестравией закрыта', 'fast', difficulty, 'other'),
    makeImpulse('capitalFlow', -5, 'Вестравские банки отзывают кредиты', 'fast', difficulty));
  const strength = warStrength(s) * T.enemyK;
  const passBonus = camp.captured.includes('pass') || camp.captured.includes('steppe') || camp.captured.includes('fort') ? 1.25 : 1;
  const gain = stance.id === 'assault' ? strength * (16 + 18 * rng()) * passBonus
    : stance.id === 'siege' ? strength * (6 + 8 * rng()) * passBonus : strength * 2 * rng();
  camp.progress[target] = clamp(camp.progress[target] + gain, 0, 100);
  // потери и настроение: штурм бьёт по поддержке сильнее всего
  if (stance.id === 'assault') out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при штурме', 'fast', difficulty, 'other'),
    makeImpulse('tensionPush', 1.5, 'Потери при штурме', 'fast', difficulty, 'other'));
  else if (stance.id === 'siege') out.impulses.push(makeImpulse('approvalPush', -0.5, 'Затяжная осада', 'fast', difficulty, 'other'));
  // контратака противника по недобранной цели
  let counter = null;
  const counterChance = (stance.id === 'hold' ? 0.1 : 0.25) * (camp.captured.includes('pass') ? 0.5 : 1) / Math.sqrt(T.enemyK);
  if (rng() < counterChance) {
    const cands = OBJ.filter((o) => !camp.captured.includes(o.id) && camp.progress[o.id] > 0);
    if (cands.length) {
      const o = cands[Math.floor(rng() * cands.length)];
      const lost = 8 + 8 * rng();
      camp.progress[o.id] = clamp(camp.progress[o.id] - lost, 0, 100);
      counter = { target: o.id, lost: Math.round(lost) };
      out.news.push(['crisis', `КОНТРАТАКА У ЦЕЛИ «${o.name.toUpperCase()}»`, `Противник отбил часть позиций: продвижение откатилось на ${Math.round(lost)} п.`, 7]);
    }
  }
  // взятие цели
  if (camp.progress[target] >= 100 && !camp.captured.includes(target)) {
    camp.captured.push(target);
    const o = WAR_OBJECTIVE_BY_ID[target];
    if (target === 'mines') out.impulses.push(sustainedImpulse('exportsGrowth', 1.2, 8, 'Руда Хальвика идёт на экспорт'),
      makeImpulse('inflationSupply', -0.2, 'Сырьё Хальвика дешевле', 'slow', difficulty, 'other'));
    if (target === 'oil') out.impulses.push(sustainedImpulse('exportsGrowth', 0.8, 6, 'Нефть Кумсая'),
      makeImpulse('inflationSupply', -0.3, 'Топливо дешевле: нефть Кумсая', 'slow', difficulty, 'other'));
    out.impulses.push(makeImpulse('approvalPush', target === 'city' ? 4 : 2, `Взята цель: ${o.name}`, 'fast', difficulty, 'other'));
    out.news.push(['gov', o.headline, o.desc, 9]);
  }
  if (OBJ.every((o) => camp.captured.includes(o.id))) {
    out.endWar = true; out.victory = true;
    out.impulses.push(makeImpulse('approvalPush', 6, `Победа над ${T.gen === 'Вестравии' ? 'Вестравией' : T.gen === 'Дешта' ? 'Дештом' : 'Норландом'}`, 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', -4, 'Победа в войне', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 3, 'Война окончена', 'default', difficulty, 'other'));
    if (tgt !== 'north') out.impulses.push(sustainedImpulse('revenue', (s.nominalGdp || 0) * 0.9 / 100, 8, `Репарации ${T.gen}`));
    out.news.push(['gov', `${T.up} ПОДПИСЫВАЕТ КАПИТУЛЯЦИЮ`, tgt === 'north'
      ? 'Все цели операции взяты, противник принимает условия. Санкции за войну никуда не деваются — они снимаются дольше, чем вводились.'
      : `Все цели операции взяты. Войска уходят домой, а ${T.gen === 'Дешта' ? 'Дешт' : 'Вестравия'} два года платит репарации — около 0,9% ВВП в год. Соседи этого не забудут.`, 10]);
  }
  camp.last = { target, stance: stance.id, gained: Math.round(gain), counter };
  return { ...out, campaign: camp };
}

/* ============================ НОВЫЕ ЗЕМЛИ ============================
   Присоединить — не значит удержать. Каждый квартал лояльность новой области
   сама понемногу растёт (люди привыкают), программа интеграции — пособия,
   паспорта, дороги — ускоряет это за деньги, стройка в области тоже. Напряжение
   в стране и война за эти земли отбрасывают назад. Пока лояльность ниже
   PARTISAN_BELOW, там партизаны: подрывы, саботаж, подполье. Когда она впервые
   доходит до INTEGRATED_AT, область интегрирована и голосует вместе со страной. */
export const PARTISAN_INCIDENTS = {
  pereval: { headline: 'ПОДРЫВ НА ПЕРЕВАЛЬСКОЙ ДОРОГЕ',
    text: (l) => `Ночью подорвали мост на серпантине, колонны с грузом стоят. Лояльность района ${Math.round(l)} из 100 — новой власти здесь пока не рады.`,
    impulses: (d) => [makeImpulse('exportsGrowth', -0.8, 'Подрыв на перевальской дороге', 'fast', d, 'other'),
      makeImpulse('riskPremium', 0.03, 'Диверсии на новых землях', 'fast', d),
      makeImpulse('tensionPush', 1, 'Диверсия на перевале', 'fast', d, 'other')] },
  halvik: { headline: 'САБОТАЖ НА ХАЛЬВИКСКИХ КОПЯХ',
    text: (l) => `На копях Хальвика залиты две шахты и сожжён склад взрывчатки. Лояльность края ${Math.round(l)} из 100.`,
    impulses: (d) => [makeImpulse('exportsGrowth', -1.2, 'Саботаж на копях Хальвика', 'fast', d, 'other'),
      makeImpulse('inflationSupply', 0.1, 'Руда Хальвика встала', 'fast', d, 'other')] },
  nordholm: { headline: 'ПОДПОЛЬЕ В НОРДХОЛЬМЕ: НАПАДЕНИЕ НА КОМЕНДАТУРУ',
    text: (l) => `В Нордхольме обстреляна комендатура, в городе комендантский час. Лояльность области ${Math.round(l)} из 100 — город ждёт возвращения Норланда.`,
    impulses: (d) => [makeImpulse('tensionPush', 2, 'Нападение на комендатуру в Нордхольме', 'fast', d, 'other'),
      makeImpulse('approvalPush', -1, 'Новые земли неспокойны', 'fast', d, 'other'),
      makeImpulse('govTrust', -1, 'Подполье в Нордхольме', 'default', d, 'other')] },
};
// только присоединённые области и без повторов
// программа интеграции области с полной лояльностью закрывается сама — платить больше не за что
export const INTEGRATION_DONE = 100;
export function sanitizeIntegration(list, s) {
  const own = activeRegions(s).filter((r) => r.annex && annexLoyalty(s, r.id) < INTEGRATION_DONE).map((r) => r.id);
  return Array.isArray(list) ? [...new Set(list.filter((id) => own.includes(id)))] : [];
}
export function annexBlurb(region, s) {
  const l = annexLoyalty(s, region.id);
  const integrated = (s.annexIntegrated || []).includes(region.id);
  if (l < PARTISAN_BELOW) return `Лояльность ${Math.round(l)} из 100: власть держится на комендатурах, по ночам — подрывы и листовки. Пока здесь не станет спокойнее, область не голосует.`;
  if (!integrated) return `Лояльность ${Math.round(l)} из 100: партизан почти не слышно, но своей эта земля ещё не стала. Голосовать область начнёт с ${INTEGRATED_AT}.`;
  return `Лояльность ${Math.round(l)} из 100: область интегрирована и голосует вместе со страной — но помнит, откуда пришла.`;
}
export function annexStep(s, decisions, difficulty, loyaltyDelta) {
  const out = { impulses: [], news: [], spendPct: 0, loyalty: {}, integrated: [...(s.annexIntegrated || [])], shock: {}, funded: [] };
  const regions = activeRegions(s).filter((r) => r.annex);
  if (!regions.length) return out;
  // программа интеграции действует, пока её не сменят: null — продолжать прошлую
  const plan = new Set(sanitizeIntegration(decisions.integrate == null ? s.annexFunded : decisions.integrate, s));
  const underAttack = (s.warQuartersLeft || 0) > 0 && s.warType === 'revanche';
  regions.forEach((r) => {
    let l = annexLoyalty(s, r.id);
    let d = 1 + ((loyaltyDelta || {})[r.id] || 0);
    const wasFunded = (s.annexFunded || []).includes(r.id);
    if (plan.has(r.id)) { d += 6; out.spendPct += INTEGRATION_COST; out.funded.push(r.id); }
    if ((s.projects || []).some((x) => x.region === r.id)) d += 2;
    if (underAttack) d -= 3;
    if ((s.politicalTension || 0) > 45) d -= (s.politicalTension - 45) * 0.06;
    l = clamp(l + d, 0, 100);
    if (l >= INTEGRATION_DONE && (plan.has(r.id) || wasFunded)) {
      out.funded = out.funded.filter((id) => id !== r.id);
      out.news.push(['gov', `${r.name.toUpperCase()}: ПРОГРАММА ИНТЕГРАЦИИ ВЫПОЛНЕНА`,
        `Лояльность ${r.gen} достигла 100 из 100 — деньги на интеграцию больше не нужны, программа закрыта.`, 6]);
    }
    if (l < PARTISAN_BELOW && rng() < 0.15 + ((PARTISAN_BELOW - l) / PARTISAN_BELOW) * 0.45) {
      const inc = PARTISAN_INCIDENTS[r.id];
      out.impulses.push(...inc.impulses(difficulty));
      out.spendPct += 0.03;
      out.shock[r.id] = (out.shock[r.id] || 0) + 6;
      out.news.push(['crisis', inc.headline, inc.text(l), 7]);
    }
    if (l >= INTEGRATED_AT && !out.integrated.includes(r.id)) {
      out.integrated.push(r.id);
      out.impulses.push(makeImpulse('approvalPush', 1, `${r.name}: интеграция завершена`, 'fast', difficulty, 'other'));
      out.news.push(['gov', `${r.name.toUpperCase()} ВПЕРВЫЕ ГОЛОСУЕТ ВМЕСТЕ СО СТРАНОЙ`,
        `Комендатуры сменяются обычной администрацией, партизан больше не слышно. Лояльность ${r.gen} — ${Math.round(l)} из 100: теперь это не только новая земля на карте, но и новые избиратели.`, 8]);
    }
    out.loyalty[r.id] = l;
  });
  return out;
}

/* ========================= МИР С НОРЛАНДОМ =========================
   Перемирие останавливает стрельбу, но не решает, чья это земля. После войны,
   в которой страна что-то взяла, открываются переговоры: каждый квартал можно
   предложить договор — признание новой границы, поддержку Норландом снятия
   санкций, репарации (получить или выплатить), возврат части земель. Норланд
   соглашается, если цена требований не выше позиции страны на переговорах
   (leverage): она тем сильнее, чем больше взято, и тает, пока тянут время.
   Непризнанная граница продлевает санкции и кормит реваншизм Норланда. */
export const TREATY_LAND_VALUE = { pereval: 18, halvik: 22, nordholm: 35 };
export const OBJECTIVE_VALUE = { pass: 18, mines: 22, city: 35 };
export const heldAnnex = (s) => activeRegions(s).filter((r) => r.annex).map((r) => r.id);
export function sanitizeTreaty(t, s) {
  if (!t || typeof t !== 'object') return null;
  const held = heldAnnex(s);
  return {
    recognition: !!t.recognition, sanctions: !!t.sanctions,
    reparations: t.reparations === 'receive' || t.reparations === 'pay' ? t.reparations : null,
    returned: Array.isArray(t.returned) ? [...new Set(t.returned.filter((id) => held.includes(id)))] : [],
    propose: !!t.propose, walkAway: !!t.walkAway,
  };
}
// во что Норланду обходятся требования; уступки (выплата, возврат земель) — со знаком минус
export function treatyCost(terms, s) {
  if (!terms) return 0;
  const kept = heldAnnex(s).filter((id) => !terms.returned.includes(id));
  let c = 0;
  if (terms.recognition) c += 10 + 12 * kept.length + (kept.includes('nordholm') ? 15 : 0);
  if (terms.sanctions) c += 15;
  if (terms.reparations === 'receive') c += 25;
  if (terms.reparations === 'pay') c -= 25;
  terms.returned.forEach((id) => { c -= TREATY_LAND_VALUE[id] || 0; });
  return c;
}
// бот за столом переговоров: берёт самое ценное, на что Норланд согласится, по своим приоритетам
export function botTreaty(s, personaId) {
  const talks = s.peaceTalks;
  if (!talks) return null;
  const order = personaId === 'strongman' ? ['reparations', 'recognition', 'sanctions']
    : personaId === 'populist' ? ['recognition', 'reparations', 'sanctions'] : ['recognition', 'sanctions', 'reparations'];
  const terms = { recognition: false, sanctions: false, reparations: null, returned: [], propose: true, walkAway: false };
  order.forEach((k) => {
    const next = { ...terms, [k]: k === 'reparations' ? 'receive' : true };
    if (treatyCost(next, s) <= talks.leverage) Object.assign(terms, next);
  });
  return terms;
}
// земля уходит из состава страны: вместе с её стройками, событием и лояльностью
export function dropAnnexed(state, regionIds) {
  const objs = regionIds.map((id) => (regionById(id) || {}).objective).filter(Boolean);
  const lostProjects = new Set(REGION_PROJECTS.filter((p) => regionIds.includes(p.region)).map((p) => p.id));
  const loyalty = { ...state.annexLoyalty };
  regionIds.forEach((id) => { delete loyalty[id]; });
  return {
    annexed: (state.annexed || []).filter((o) => !objs.includes(o)),
    annexLoyalty: loyalty,
    annexIntegrated: (state.annexIntegrated || []).filter((id) => !regionIds.includes(id)),
    annexFunded: (state.annexFunded || []).filter((id) => !regionIds.includes(id)),
    projects: (state.projects || []).filter((x) => !lostProjects.has(x.id)),
    projectsBuilt: (state.projectsBuilt || []).filter((id) => !lostProjects.has(id)),
    regionEvent: state.regionEvent && regionIds.includes(state.regionEvent.region) ? null : state.regionEvent,
  };
}

/* ========================== РЕВАНШ НОРЛАНДА ==========================
   Пока у страны есть земли Норланда, Норланд копит реваншизм (norlandRevanche,
   0..100): быстрее, если граница не признана и земель много; медленнее, если
   договор подписан, и ещё медленнее, если граница признана; сильная армия
   сдерживает, кризисы в стране — подталкивают. На 100 Норланд нападает.
   Тогда война идёт за новые земли: каждый квартал Норланд бьёт по одной из них
   (куда — разведка сообщает заранее, campaign.next), а президент выбирает,
   какую область укрепить и как: держать оборону, контрудар или переговоры.
   Давление на область до 100 — она потеряна. Боевой дух Норланда тает, пока
   его атаки захлёбываются; на нуле он сам просит мира. */
export const DEFENSE_STANCES = [
  { id: 'defend', label: 'Держать оборону', spend: 0.15, desc: 'Укрепить выбранную область: удар по ней почти не продвинется, но остальные прикрыты слабее.' },
  { id: 'counter', label: 'Контрудар', spend: 0.35, desc: 'Отбросить противника там, где он уже продвинулся. Дорого и с потерями, зато ломает его боевой дух.' },
  { id: 'talks', label: 'Переговоры о перемирии', spend: 0, desc: 'Остановить войну и сесть за стол. Чем больше потеряно, тем хуже условия.' },
];
export const REVANCHE_WARN = 70;
export function revancheGrowth(s) {
  const n = heldAnnex(s).length;
  if (!n) return -10;
  const t = s.treaty;
  const mult = (t && t.recognized ? 0.05 : t ? 0.6 : 1) * (s.peaceTalks ? 0.5 : 1);
  const deter = (warStrength(s) - 1) * 6;
  const crisis = (s.activeCrises || []).filter((c) => c !== 'war').length * 1.5;
  return Math.max(0, (3 + 3 * n + crisis) * mult - deter);
}
// куда Норланд ударит: где он уже продвинулся и где новой власти меньше всего рады
export function revancheTarget(s, camp) {
  const held = heldAnnex(s).filter((id) => !(camp.lost || []).includes(id));
  return held.sort((a, b) => ((camp.pressure[b] || 0) + (60 - annexLoyalty(s, b))) - ((camp.pressure[a] || 0) + (60 - annexLoyalty(s, a))))[0] || null;
}
export function defaultDefenseOrder(camp) {
  const last = camp.last && camp.last.stance !== 'talks' ? camp.last : null;
  return { target: camp.next, stance: last ? last.stance : 'defend' };
}
export function botDefenseOrder(s, personaId) {
  const camp = s.revancheCampaign;
  if (!camp) return null;
  const worst = Object.entries(camp.pressure).filter(([id]) => heldAnnex(s).includes(id)).sort((a, b) => b[1] - a[1])[0];
  const approval = s.approval || 50;
  if (personaId === 'strongman') return worst && worst[1] > 40 ? { target: worst[0], stance: 'counter' } : { target: camp.next, stance: 'defend' };
  if (personaId === 'populist') return approval < 30 ? { target: camp.next, stance: 'talks' } : { target: camp.next, stance: 'defend' };
  if ((camp.lost || []).length || approval < 35) return { target: camp.next, stance: 'talks' };
  return { target: camp.next, stance: 'defend' };
}
export function revancheStep(s, decisions, difficulty, q, blockStart) {
  const out = { impulses: [], news: [], spendPct: 0, start: false, endWar: false, lost: [], campaign: null, revanche: s.norlandRevanche || 0, talks: null, warned: !!s.revancheWarned };
  const atWar = (s.warQuartersLeft || 0) > 0;
  if (!atWar) {
    // ниже нуля — Норланд ещё не оправился от прошлой проигранной войны
    out.revanche = clamp(out.revanche + revancheGrowth(s), -50, 100);
    if (out.revanche >= REVANCHE_WARN && !out.warned && heldAnnex(s).length) {
      out.warned = true;
      out.news.push(['crisis', 'НОРЛАНД СТЯГИВАЕТ ВОЙСКА К НОВОЙ ГРАНИЦЕ', `Разведка докладывает: реваншизм в Норланде ${Math.round(out.revanche)} из 100. Сильная армия и признанная граница остужают его, кризисы в стране — подогревают.`, 8]);
    }
    if (out.revanche < 50) out.warned = false;
    if (out.revanche >= 100 && heldAnnex(s).length && !blockStart) {
      out.start = true;
      const camp = { pressure: Object.fromEntries(heldAnnex(s).map((id) => [id, 0])), morale: 100, lost: [], last: null, next: null };
      camp.next = revancheTarget(s, camp);
      out.campaign = camp;
      out.impulses.push(taperedImpulse('approvalPush', [4, 2, 1], 'Страну атаковали: сплочение', 'other'),
        makeImpulse('tensionPush', 8, 'Норланд напал', 'fast', difficulty, 'other'),
        makeImpulse('riskPremium', 0.5, 'Война на новой границе', 'default', difficulty),
        makeImpulse('capitalFlow', -12, 'Война на новой границе', 'default', difficulty),
        makeImpulse('businessConfidence', -8, 'Война на новой границе', 'default', difficulty, 'other'),
        makeImpulse('inflationSupply', 0.5, 'Война на новой границе', 'default', difficulty),
        makeImpulse('exportsGrowth', -2, 'Война на новой границе', 'default', difficulty, 'other'),
        makeImpulse('stockShock', -8, 'Война на новой границе', 'fast', difficulty));
      out.news.push(['crisis', 'НОРЛАНД НАЧАЛ ВОЙНУ ЗА ПОТЕРЯННЫЕ ЗЕМЛИ', `Норландские войска перешли новую границу. Первые бои идут в ${regionById(camp.next).loc}.${s.treaty && s.treaty.recognized ? ' Норланд нарушил договор, в котором сам признал границу.' : ''}`, 10]);
      out.revanche = 0;
    }
    return out;
  }
  if (s.warType !== 'revanche' || !s.revancheCampaign) return out;
  const camp = { ...s.revancheCampaign, pressure: { ...s.revancheCampaign.pressure }, lost: [...(s.revancheCampaign.lost || [])] };
  const held = heldAnnex(s).filter((id) => !camp.lost.includes(id));
  const def = defaultDefenseOrder(camp);
  const raw = decisions.warOrder || {};
  const stance = DEFENSE_STANCES.find((x) => x.id === raw.stance) || DEFENSE_STANCES.find((x) => x.id === def.stance) || DEFENSE_STANCES[0];
  const target = held.includes(raw.target) ? raw.target : held.includes(def.target) ? def.target : held[0];
  out.spendPct = stance.spend;
  if (stance.id === 'talks' || !held.length) {
    out.endWar = true;
    out.talks = held.length ? { since: q, leverage: Math.max(0, 5 + 6 * held.length - 10 * camp.lost.length + (100 - camp.morale) * 0.3), attempts: 0, origin: 'revanche' } : null;
    out.impulses.push(makeImpulse('approvalPush', -2, 'Перемирие на условиях войны', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 3, 'Бои на границе прекращены', 'default', difficulty, 'other'));
    out.revanche = -10 - (100 - camp.morale) * 0.3;
    out.news.push(['gov', 'ПЕРЕМИРИЕ С НОРЛАНДОМ НА НОВОЙ ГРАНИЦЕ', 'Стрельба прекращена, стороны садятся за стол. Условия будут зависеть от того, что удалось удержать.', 9]);
    camp.last = { target, stance: 'talks', hit: null, gain: 0, pushed: 0 };
    out.campaign = camp;
    return out;
  }
  // удар Норланда
  // разведка ошибается: примерно каждый третий удар приходится не туда, куда ждали
  const planned = held.includes(camp.next) ? camp.next : revancheTarget(s, camp);
  const others = held.filter((id) => id !== planned);
  const feint = others.length > 0 && rng() < 0.3;
  const hit = feint ? others[Math.floor(rng() * others.length)] : planned;
  const nStr = 0.5 + camp.morale / 200;
  const loyal = 1 + Math.max(0, 50 - annexLoyalty(s, hit)) / 100;
  let gain = (12 + 10 * rng()) * nStr * loyal / warStrength(s);
  if (target === hit) gain *= stance.id === 'defend' ? 0.3 : 0.6;
  camp.pressure[hit] = clamp((camp.pressure[hit] || 0) + gain, 0, 100);
  let pushed = 0;
  if (stance.id === 'counter') {
    pushed = warStrength(s) * (10 + 12 * rng());
    camp.pressure[target] = clamp((camp.pressure[target] || 0) - pushed, 0, 100);
    camp.morale -= 6 + 6 * rng();
    out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при контрударе', 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', 1, 'Потери при контрударе', 'fast', difficulty, 'other'));
  }
  if (target === hit && stance.id === 'defend') camp.morale -= 5;
  camp.morale = Math.max(0, camp.morale - 3);
  if (feint) out.news.push(['crisis', 'РАЗВЕДКА ОШИБЛАСЬ', `Норланд ударил не туда, где его ждали: бои идут в ${regionById(hit).loc}.`, 7]);
  if (camp.pressure[hit] >= 100) {
    camp.lost.push(hit);
    out.lost.push(hit);
    const r = regionById(hit);
    out.impulses.push(makeImpulse('approvalPush', -4, `Потерян ${r.name}`, 'fast', difficulty, 'other'),
      makeImpulse('tensionPush', 4, `Потерян ${r.name}`, 'fast', difficulty, 'other'));
    out.news.push(['crisis', `НОРЛАНД ВЕРНУЛ СЕБЕ: ${r.name.toUpperCase()}`, `Оборона ${r.gen} прорвана. Земля, за которую воевали, снова норландская.`, 10]);
  }
  const stillHeld = held.filter((id) => !camp.lost.includes(id));
  if (!stillHeld.length) {
    out.endWar = true;
    out.news.push(['crisis', 'НОРЛАНД ВЕРНУЛ ВСЕ ПОТЕРЯННЫЕ ЗЕМЛИ', 'Война за новые земли проиграна: граница там же, где была до первой войны.', 10]);
  } else if (camp.morale <= 0) {
    out.endWar = true;
    out.talks = { since: q, leverage: 35 + 10 * stillHeld.length, attempts: 0, origin: 'revanche' };
    out.impulses.push(makeImpulse('approvalPush', 4, 'Норланд отступил', 'fast', difficulty, 'other'));
    out.revanche = -40;
    out.news.push(['gov', 'НОРЛАНД ПРОСИТ МИРА', 'Атаки захлебнулись, армия Норланда выдохлась и предлагает переговоры. Позиция страны за столом сильная.', 10]);
  }
  camp.last = { target, stance: stance.id, hit, gain: Math.round(gain), pushed: Math.round(pushed), feint };
  camp.next = stillHeld.length ? revancheTarget(s, camp) : null;
  out.campaign = camp;
  return out;
}

/* ======================= ОБОРОНИТЕЛЬНАЯ ВОЙНА =======================
   На страну напала Республика Дешт — с юго-запада, по равнинам Приреченской и
   лесам Боровской области. Раньше такая война просто шла четыре квартала, а
   игроку оставалось только капитулировать. Теперь это фронт: каждый квартал
   противник давит на одну из двух областей (разведка иногда ошибается), президент
   или премьер отдаёт приказ — держать оборону там, где ждут удара, контрударом
   отбросить противника или просить перемирия. Область, где давление дошло до 100,
   оккупирована: там рушатся напряжение, потребление и потенциал, пока её не отобьют
   (давление ниже 60). Выдохшийся противник уходит сам, срок войны — прежний. */
export const DEF_FRONT = ['agri', 'periphery'];
export const DEF_ENEMY = 'Республика Дешт';
export function newDefenseCampaign() {
  return { pressure: { agri: 0, periphery: 0 }, occupied: [], morale: 100, last: null, next: 'agri' };
}
export function defenseTarget(camp) {
  const free = DEF_FRONT.filter((id) => !camp.occupied.includes(id));
  return free.sort((a, b) => (camp.pressure[b] || 0) - (camp.pressure[a] || 0))[0] || null;
}
export function defaultFrontOrder(camp) {
  const last = camp.last && camp.last.stance !== 'talks' ? camp.last : null;
  return { target: (last && last.stance === 'counter' && camp.occupied.includes(last.target)) ? last.target : camp.next || DEF_FRONT[0],
    stance: last ? last.stance : 'defend' };
}
export function botFrontOrder(s, personaId) {
  const camp = s.defenseCampaign;
  if (!camp) return null;
  const occ = camp.occupied[0];
  if (personaId === 'strongman') return occ ? { target: occ, stance: 'counter' } : { target: camp.next, stance: 'defend' };
  if (occ && warStrength(s) >= 0.85) return { target: occ, stance: 'counter' };
  if (personaId === 'populist' && (s.approval || 50) < 30) return { target: camp.next, stance: 'talks' };
  if (camp.occupied.length >= 2) return { target: camp.next, stance: 'talks' };
  return { target: camp.next || DEF_FRONT[0], stance: 'defend' };
}
export function defenseStep(s, decisions, difficulty, q, starting) {
  const out = { impulses: [], news: [], spendPct: 0, endWar: false, campaign: null, shock: {} };
  if (starting) { out.campaign = newDefenseCampaign(); return out; }
  if (!((s.warQuartersLeft || 0) > 0 && s.warType === 'defensive')) return out;
  const prev = s.defenseCampaign || newDefenseCampaign();
  const camp = { ...prev, pressure: { ...prev.pressure }, occupied: [...(prev.occupied || [])] };
  const raw = decisions.warOrder || {};
  const def = defaultFrontOrder(camp);
  const stance = DEFENSE_STANCES.find((x) => x.id === raw.stance) || DEFENSE_STANCES.find((x) => x.id === def.stance) || DEFENSE_STANCES[0];
  const target = DEF_FRONT.includes(raw.target) ? raw.target : def.target;
  const nameOf = (id) => regionById(id);
  out.spendPct = stance.spend;
  if (stance.id === 'talks') {
    out.endWar = true;
    const lost = camp.occupied.length;
    out.impulses.push(makeImpulse('approvalPush', -2 - 3 * lost, 'Перемирие с Дештом', 'fast', difficulty, 'other'),
      makeImpulse('businessConfidence', 4, 'Бои прекращены', 'default', difficulty, 'other'));
    out.news.push(['gov', `ПЕРЕМИРИЕ: ${DEF_ENEMY.toUpperCase()} ОСТАНАВЛИВАЕТ НАСТУПЛЕНИЕ`, lost
      ? `Стрельба прекращена. Занятые районы ${camp.occupied.map((id) => nameOf(id).gen).join(' и ')} возвращаются по соглашению — ценой уступок, которые оппозиция назовёт капитуляцией.`
      : 'Стрельба прекращена, фронт удержан. Мир дороже войны, но его цену ещё будут вспоминать.', 9]);
    camp.last = { target, stance: 'talks', hit: null, gain: 0, pushed: 0 };
    out.campaign = camp;
    return out;
  }
  // удар противника: туда, где он уже продвинулся; примерно каждый четвёртый — не туда
  const free = DEF_FRONT.filter((id) => !camp.occupied.includes(id));
  const planned = free.includes(camp.next) ? camp.next : defenseTarget(camp);
  const others = free.filter((id) => id !== planned);
  const feint = !!planned && others.length > 0 && rng() < 0.25;
  const hit = feint ? others[Math.floor(rng() * others.length)] : planned;
  let gain = 0;
  if (hit) {
    const nStr = 0.5 + camp.morale / 200;
    gain = (11 + 9 * rng()) * nStr / warStrength(s);
    if (target === hit) gain *= stance.id === 'defend' ? 0.3 : 0.6;
    camp.pressure[hit] = clamp((camp.pressure[hit] || 0) + gain, 0, 100);
    if (camp.pressure[hit] >= 100 && !camp.occupied.includes(hit)) {
      camp.occupied.push(hit);
      out.impulses.push(makeImpulse('approvalPush', -4, `Оккупирована ${nameOf(hit).name}`, 'fast', difficulty, 'other'),
        makeImpulse('tensionPush', 4, `Оккупирована ${nameOf(hit).name}`, 'fast', difficulty, 'other'));
      out.news.push(['crisis', `ФРОНТ ПРОРВАН: ЗАНЯТА ${nameOf(hit).name.toUpperCase()}`, `Войска Дешта вошли в ${nameOf(hit).city}. Пока область под оккупацией, её хозяйство стоит, а люди бегут в тыл. Отбить её можно только контрударом.`, 10]);
    }
  }
  let pushed = 0;
  if (stance.id === 'counter') {
    pushed = warStrength(s) * (10 + 12 * rng());
    camp.pressure[target] = clamp((camp.pressure[target] || 0) - pushed, 0, 100);
    camp.morale -= 6 + 6 * rng();
    out.impulses.push(makeImpulse('approvalPush', -1.5, 'Потери при контрударе', 'fast', difficulty, 'other'));
    if (camp.occupied.includes(target) && camp.pressure[target] < 60) {
      camp.occupied = camp.occupied.filter((id) => id !== target);
      out.impulses.push(makeImpulse('approvalPush', 4, `Освобождена ${nameOf(target).name}`, 'fast', difficulty, 'other'));
      out.news.push(['gov', `ОСВОБОЖДЕНА ${nameOf(target).name.toUpperCase()}`, `Контрудар отбросил противника: ${nameOf(target).city} снова под контролем страны.`, 10]);
    }
  }
  if (hit && target === hit && stance.id === 'defend') camp.morale -= 5;
  camp.morale = Math.max(0, camp.morale - 4);
  if (feint) out.news.push(['crisis', 'РАЗВЕДКА ОШИБЛАСЬ', `${DEF_ENEMY} ударила не там, где её ждали: бои идут в ${nameOf(hit).loc}.`, 7]);
  // оккупация: область живёт без хозяйства, пока её не отобьют
  camp.occupied.forEach((id) => {
    out.shock[id] = 25;
    out.impulses.push(makeImpulse('potentialShock', -0.25, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty),
      makeImpulse('consumption', -0.8, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty),
      makeImpulse('approvalPush', -1.2, `Оккупация: ${nameOf(id).name}`, 'fast', difficulty, 'other'));
  });
  if (camp.morale <= 0) {
    out.endWar = true;
    out.impulses.push(makeImpulse('approvalPush', 5, `${DEF_ENEMY} отступила`, 'fast', difficulty, 'other'));
    out.news.push(['gov', `${DEF_ENEMY.toUpperCase()} ОТСТУПАЕТ`, 'Наступление захлебнулось: армия противника выдохлась и уходит за границу. Занятые районы освобождены.', 10]);
  } else {
    /* Срока у войны нет: никто не знает заранее, когда она кончится. Дешт сам идёт на
       перемирие — тем вероятнее, чем дольше война и чем ниже боевой дух его армии;
       занятое он при этом возвращает не даром — это перемирие, а не победа. */
    const elapsed = (s.warElapsed || 1);
    const pStop = clamp(0.04 + 0.035 * elapsed + (100 - camp.morale) / 350, 0, 0.55);
    if (rng() < pStop) {
      out.endWar = true;
      const lost = camp.occupied.length;
      out.impulses.push(makeImpulse('approvalPush', lost ? 1 : 3, `${DEF_ENEMY} согласилась на перемирие`, 'fast', difficulty, 'other'),
        makeImpulse('businessConfidence', 4, 'Бои прекращены', 'default', difficulty, 'other'));
      out.news.push(['gov', `${DEF_ENEMY.toUpperCase()} ПРЕДЛАГАЕТ ПЕРЕМИРИЕ`, lost
        ? `Армия противника устала: Ашкала соглашается остановить бои и вывести войска из ${camp.occupied.map((id) => nameOf(id).gen).join(' и ')} в обмен на прекращение огня.`
        : 'Армия противника устала: Ашкала соглашается остановить бои по линии границы.', 10]);
    }
  }
  camp.last = { target, stance: stance.id, hit, gain: Math.round(gain), pushed: Math.round(pushed), feint };
  camp.next = defenseTarget(camp);
  out.campaign = camp;
  return out;
}

