/* Выделено из engine.js: world/diplomacy.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { clamp, rng } from '../catalog.js';
import { fmt1 } from '../engine.js';
import { makeImpulse, sustainedImpulse, taperedImpulse } from '../content/events.js';
import { PRES_BY_ID } from '../politics/president.js';
import { regionById } from './regions.js';
import { heldAnnex, sanitizeTreaty, treatyCost, warStrength, warTargetOf } from './war.js';

/* =========================================================================================
   ЖИВЫЕ СОСЕДИ: ОТНОШЕНИЯ КАК РЕСУРС

   У каждого соседа — отношения от 0 до 100. Они сами тянутся к «естественному»
   уровню (торговый блок, признанная граница, реваншизм, война), а сдвигают их
   действия президента (договор, помощь, ультиматум, санкции), ответы на события
   от соседей и их собственные ходы. Отношения — не табличка: Вестравия при
   хороших отношениях покупает наш экспорт и даёт дешёвый кредит, Дешт при плохих
   стягивает войска и может напасть, Норланд — копит реваншизм.
========================================================================================= */
export const NEIGHBOR_IDS = ['north', 'west', 'southwest'];
export const NB = {
  north: { name: 'Норланд', gen: 'Норланда', dat: 'Норланду', ins: 'с Норландом', up: 'НОРЛАНД' },
  west: { name: 'Вестравия', gen: 'Вестравии', dat: 'Вестравии', ins: 'с Вестравией', up: 'ВЕСТРАВИЯ' },
  southwest: { name: 'Дешт', gen: 'Дешта', dat: 'Дешту', ins: 'с Дештом', up: 'ДЕШТ' },
};
export const RELATIONS_START = { north: 50, west: 64, southwest: 40 };
export function relationsOf(s) { return { ...RELATIONS_START, ...s.relations }; }
// воюем ли мы с этим соседом прямо сейчас
export function atWarWith(s, c) {
  if (!((s.warQuartersLeft || 0) > 0)) return false;
  if (s.warType === 'offensive') return warTargetOf(s) === c;
  return c === 'southwest' ? s.warType === 'defensive' : c === 'north' ? s.warType === 'revanche' : false;
}
// куда отношения тянутся сами, если ничего не делать
export function relationTarget(s, c) {
  if (atWarWith(s, c)) return 4;
  const tr = (s.diploTreaties || {})[c] > 0 ? 10 : 0;
  const sanc = (s.diploSanctions || {})[c] > 0 ? -30 : 0;
  if (c === 'west') {
    if ((s.sanctionsQuartersLeft || 0) > 0) return 15;
    return clamp(62 + (s.tradeBlocActive ? 14 : 0) + tr + sanc, 5, 92);
  }
  if (c === 'north') {
    const held = (s.annexed || []).length;
    const t = s.treaty;
    const base = held ? (t && t.recognized ? 58 : 38) - Math.max(0, s.norlandRevanche || 0) * 0.3 : 50;
    return clamp(base + tr + sanc, 5, 90);
  }
  return clamp(40 + tr + sanc - ((s.deshtMobilized || 0) > 0 ? 8 : 0), 5, 85);
}
/* Во сколько раз Дешт вероятнее нападёт, чем «в среднем»: плохие отношения и
   стянутые к границе войска поднимают риск, договор и отведённые войска — гасят. */
export function deshtWarMultiplier(s) {
  const rel = relationsOf(s).southwest;
  const calm = (s.deshtCalm || 0) > 0 ? 0.3 : 1;
  const mob = (s.deshtMobilized || 0) > 0 ? 1.6 : 1;
  return clamp((1 + (40 - rel) / 25) * calm * mob, 0.2, 3.5);
}
// Дешт стянул войска и отношения на дне — нападение вне общей лотереи событий
export function deshtAttackRoll(s) {
  const rel = relationsOf(s).southwest;
  if ((s.warQuartersLeft || 0) > 0 || !((s.deshtMobilized || 0) > 0) || rel >= 22 || (s.deshtCalm || 0) > 0) return false;
  return rng() < 0.3 + (22 - rel) * 0.02;
}
// что даёт экономике нынешний уровень отношений — для подсказок в карточке страны
export function relationEffects(s, c) {
  const rel = relationsOf(s)[c];
  if (atWarWith(s, c)) return ['идёт война — торговли нет'];
  if (c === 'west') {
    const x = (rel - 60) / 40;
    return [`экспорт ${x >= 0 ? '+' : '−'}${fmt1(Math.abs(0.5 * x)).replace('.', ',')} п.п. роста в квартал`, x >= 0 ? 'кредит дешевле: банки Вестравии охотно дают в долг' : 'кредит дороже: банки Вестравии осторожничают'];
  }
  if (c === 'southwest') {
    const m = deshtWarMultiplier(s);
    return [`риск нападения ×${fmt1(m).replace('.', ',')}${(s.deshtMobilized || 0) > 0 ? ' — войска у границы' : ''}`, rel >= 40 ? 'дешёвое зерно и нефть сдерживают цены' : 'зерно и нефть идут мимо нас'];
  }
  return [(s.annexed || []).length ? `реваншизм ${rel >= 50 ? 'остывает' : 'растёт быстрее'} от отношений` : 'руда и лес: небольшой, но стабильный торговый оборот'];
}

export const DIPLO_ACTIONS = [
  { id: 'trade', label: 'Торговый договор', cost: 12,
    desc: 'Снять пошлины на три года: растёт экспорт, а отношения держатся выше. Нужны хотя бы ровные отношения.',
    can: (s, c) => (relationsOf(s)[c] >= 45 && !((s.diploTreaties || {})[c] > 0) && !((s.diploSanctions || {})[c] > 0))
      || null, why: 'нужны отношения от 45, без санкций и без уже действующего договора' },
  { id: 'aid', label: 'Помощь', cost: 6,
    desc: 'Гуманитарная помощь и льготный кредит: около 0,3% ВВП из бюджета, зато отношения заметно теплеют.',
    can: (s, c) => !((s.diploCooldown || {})[`aid:${c}`] > 0) || null, why: 'помощь уже отправлялась недавно' },
  { id: 'ultimatum', label: 'Ультиматум', cost: 10,
    desc: 'Потребовать уступки под угрозой. Сильная армия повышает шансы; отказ — удар по отношениям и повод для ответа.',
    can: (s, c) => !((s.diploCooldown || {})[`ultimatum:${c}`] > 0) || null, why: 'ультиматум уже звучал недавно' },
  { id: 'sanctions', label: 'Санкции', cost: 14,
    desc: 'Ограничить торговлю: внутри — сплочение, снаружи — разрыв. Против Вестравии бьёт по своим же ценам и инвестициям.',
    can: (s, c) => !((s.diploSanctions || {})[c] > 0) && !(c === 'west' && (s.sanctionsQuartersLeft || 0) > 0) || null, why: 'санкции уже действуют' },
];
export const DIPLO_BY_ID = Object.fromEntries(DIPLO_ACTIONS.map((a) => [a.id, a]));
export const ULTIMATUM_DEMAND = { west: 'снизить пошлины на наш экспорт', north: 'отвести войска от новой границы и прекратить провокации', southwest: 'отвести войска от границы' };
export function diploActionAvailable(s, c, id) {
  const a = DIPLO_BY_ID[id];
  if (!a || !NB[c] || atWarWith(s, c)) return false;
  return !!a.can(s, c);
}
export function ultimatumChance(s, c) {
  const base = { west: 0.25, north: 0.4, southwest: 0.35 }[c];
  const rel = relationsOf(s)[c];
  return clamp(base + (warStrength(s) - 1) * 0.35 + (rel < 15 ? -0.1 : 0), 0.08, 0.8);
}

/* События от соседей: у каждого — варианты ответа и срок. Не ответили до срока —
   срабатывает вариант по умолчанию (протест, отказ, упущенная сделка). */
export const NEIGHBOR_EVENTS = [
  { id: 'border_incident', weight: 3, countries: ['north', 'southwest'], when: (s, c) => relationsOf(s)[c] < 62, days: 1, def: 'protest',
    title: (c) => `Пограничный инцидент ${NB[c].ins}`,
    text: (c) => `Патруль ${NB[c].gen} задержал наших пограничников на спорном участке. Ждут реакции президента.`,
    options: [
      { id: 'protest', label: 'Нота протеста', note: 'отношения −4, рейтинг +1', rel: -4, approval: 1 },
      { id: 'hush', label: 'Замять тихо', note: 'отношения +4, рейтинг −1,5', rel: 4, approval: -1.5 },
      { id: 'retaliate', label: 'Ответить силой', note: 'отношения −14, рейтинг +3, риск эскалации', rel: -14, approval: 3, escalate: true },
    ] },
  { id: 'loan_request', weight: 2, countries: ['north', 'west', 'southwest'], when: (s, c) => relationsOf(s)[c] >= 30, days: 1, def: 'decline',
    title: (c) => `${NB[c].name} просит кредит`,
    text: (c) => `Правительство ${NB[c].gen} просит заём около 0,4% нашего ВВП на два года — под проценты, но с риском, что отдавать будут долго.`,
    options: [
      { id: 'lend', label: 'Дать заём', note: 'бюджет −0,4% ВВП сейчас, возврат с процентами позже; отношения +15', rel: 15, loan: true },
      { id: 'decline', label: 'Отказать', note: 'отношения −6', rel: -6 },
    ] },
  { id: 'refugees', weight: 1.5, countries: ['southwest', 'north'], when: (s, c) => !atWarWith(s, c), days: 1, def: 'close',
    title: (c) => `Беженцы из ${NB[c].gen}`,
    text: (c) => `В ${NB[c].dat} кризис: у нашей границы около 80 тысяч человек. Принять — это рабочие руки и расходы, закрыть — тишина внутри и холод снаружи.`,
    options: [
      { id: 'accept', label: 'Принять', note: 'рабочая сила ↑, выплаты ↑, напряжение +2; Вестравия и сосед теплеют', rel: 6, westRel: 5, accept: true },
      { id: 'close', label: 'Закрыть границу', note: 'напряжение −1; Вестравия −4', rel: -3, westRel: -4, tension: -1 },
    ] },
  { id: 'west_deal', weight: 2, countries: ['west'], when: (s) => relationsOf(s).west >= 45 && (s.sanctionsQuartersLeft || 0) <= 0, days: 2, def: 'pass',
    title: () => 'Вестравия предлагает контракт',
    text: () => 'Концерны Вестравии готовы закупать нашу продукцию по контракту на два года — если ответим в течение двух кварталов. Взамен просят открыть рынок для своих станков.',
    options: [
      { id: 'sign', label: 'Подписать', note: 'экспорт ↑ на два года, отношения +6; свой бизнес поворчит', rel: 6, deal: 'west' },
      { id: 'pass', label: 'Отказаться', note: 'отношения −3', rel: -3 },
    ] },
  { id: 'desht_deal', weight: 1.5, countries: ['southwest'], when: (s) => relationsOf(s).southwest >= 30 && !atWarWith(s, 'southwest'), days: 2, def: 'pass',
    title: () => 'Дешт предлагает дешёвое зерно и нефть',
    text: () => 'Ашкала готова продавать зерно и нефть ниже рынка — два квартала на ответ. Вестравия такое сближение не одобрит.',
    options: [
      { id: 'sign', label: 'Согласиться', note: 'цены ниже на год, Дешт +8, Вестравия −4', rel: 8, westRel: -4, deal: 'southwest' },
      { id: 'pass', label: 'Отказаться', note: 'Дешт −3', rel: -3 },
    ] },
];
export const NB_EVENT_BY_ID = Object.fromEntries(NEIGHBOR_EVENTS.map((e) => [e.id, e]));
// событие соседа в виде, пригодном для интерфейса (варианты и срок)
export function neighborEventView(s) {
  const ev = s.neighborEvent;
  if (!ev || !NB_EVENT_BY_ID[ev.id]) return null;
  const def = NB_EVENT_BY_ID[ev.id];
  return { ...ev, title: def.title(ev.country), text: def.text(ev.country), options: def.options, def: def.def };
}

/* Бот-президент по характеру: отвечает на события соседей и изредка сам делает
   ход. Популист — за рейтинг, силовик — жёстко, технократ — за экономику. */
export function botDiplomacy(s, personaId, capitalLeft = 99) {
  const out = { action: null, reply: null };
  const ev = s.neighborEvent;
  if (ev && NB_EVENT_BY_ID[ev.id]) {
    const pick = {
      border_incident: personaId === 'strongman' ? 'retaliate' : personaId === 'technocrat' ? 'hush' : 'protest',
      loan_request: personaId === 'technocrat' && s.debtToGdp < 70 ? 'lend' : personaId === 'populist' ? 'decline' : relationsOf(s)[ev.country] < 45 ? 'lend' : 'decline',
      refugees: personaId === 'technocrat' && s.unemployment < 6.5 ? 'accept' : 'close',
      west_deal: personaId === 'strongman' ? 'pass' : 'sign',
      desht_deal: personaId === 'technocrat' ? 'sign' : personaId === 'strongman' ? 'sign' : 'pass',
    }[ev.id];
    out.reply = pick || NB_EVENT_BY_ID[ev.id].def;
  }
  const rel = relationsOf(s);
  const tryAct = (c, id) => { if (!out.action && diploActionAvailable(s, c, id) && DIPLO_BY_ID[id].cost <= capitalLeft) out.action = { country: c, kind: id }; };
  if ((s.deshtMobilized || 0) > 0) tryAct('southwest', personaId === 'technocrat' ? 'aid' : 'ultimatum');
  if (personaId === 'technocrat') tryAct('west', 'trade');
  if (rel.west < 50 && personaId !== 'strongman') tryAct('west', 'aid');
  if (personaId === 'populist' && rel.southwest >= 45) tryAct('southwest', 'trade');
  return out;
}
export function sanitizeDiplomacy(raw, s) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const a = r.action && typeof r.action === 'object' && diploActionAvailable(s, r.action.country, r.action.kind) ? { country: r.action.country, kind: r.action.kind } : null;
  const ev = s.neighborEvent && NB_EVENT_BY_ID[s.neighborEvent.id];
  const reply = ev && ev.options.some((o) => o.id === r.reply) ? r.reply : null;
  return { action: a, reply };
}

export function diplomacyStep(s, decisions, difficulty, q, capitalLeft, noEvents, presApplied) {
  const out = { impulses: [], news: [], spent: 0, sanctionsWest: false, revancheDelta: 0, last: null };
  const rel = relationsOf(s);
  const treaties = { ...s.diploTreaties };
  const sanctions = { ...s.diploSanctions };
  const cooldown = { ...s.diploCooldown };
  Object.keys(cooldown).forEach((k) => { cooldown[k] = Math.max(0, cooldown[k] - 1); });
  let mobilized = Math.max(0, (s.deshtMobilized || 0) - 1);
  let calm = Math.max(0, (s.deshtCalm || 0) - 1);
  let event = s.neighborEvent || null;
  const nGdp = s.nominalGdp || 0;
  const push = (...imps) => out.impulses.push(...imps);
  const shift = (c, v) => { rel[c] = clamp(rel[c] + v, 0, 100); };

  // 1. дрейф к естественному уровню
  NEIGHBOR_IDS.forEach((c) => { rel[c] = clamp(rel[c] + 0.15 * (relationTarget(s, c) - rel[c]), 0, 100); });
  // старые президентские указы тоже двигают отношения с Вестравией
  if ((presApplied || []).includes('sanctions_impose')) shift('west', -30);
  if ((presApplied || []).includes('trade_bloc')) shift('west', 12);

  // 2. ответ на событие соседа: выбранный вариант — или вариант по умолчанию, когда срок вышел
  const dip = sanitizeDiplomacy(decisions.diplomacy, s);
  if (event && NB_EVENT_BY_ID[event.id]) {
    const def = NB_EVENT_BY_ID[event.id];
    const expired = q >= event.deadline;
    const optId = dip.reply || (expired ? def.def : null);
    if (optId) {
      const o = def.options.find((x) => x.id === optId) || def.options[0];
      const c = event.country;
      shift(c, o.rel || 0);
      if (o.westRel) shift('west', o.westRel);
      if (o.approval) push(makeImpulse('approvalPush', o.approval, def.title(c), 'fast', difficulty, 'other'));
      if (o.tension) push(makeImpulse('tensionPush', o.tension, def.title(c), 'fast', difficulty, 'other'));
      if (o.escalate && c === 'southwest' && rel.southwest < 30) mobilized = Math.max(mobilized, 4);
      if (o.escalate && c === 'north') out.revancheDelta += 8;
      if (o.loan) {
        push(sustainedImpulse('revenue', -nGdp * 0.8 / 100, 2, `Заём ${NB[c].dat}`),
          taperedImpulse('revenue', [0, 0, 0, 0, 0, 0, 0.26, 0.26, 0.26, 0.26].map((k) => k * nGdp / 100 * (rel[c] >= 25 ? 1 : 0.4)), `${NB[c].name} возвращает заём`));
      }
      if (o.accept) {
        push(makeImpulse('laborForce', 0.25, 'Беженцы пополнили рабочую силу', 'slow', difficulty, 'other'),
          sustainedImpulse('transfersPressure', 0.25, 4, 'Расходы на размещение беженцев'),
          makeImpulse('tensionPush', 2, 'Беженцы: часть общества против', 'fast', difficulty, 'other'));
      }
      // подписанный контракт не предлагают заново, пока он действует (плюс год
      // тишины): раньше то же предложение приходило через пару кварталов после подписи
      if (o.deal === 'west') cooldown['ev:west_deal'] = 12;
      if (o.deal === 'southwest') cooldown['ev:desht_deal'] = 8;
      if (o.deal === 'west') {
        push(sustainedImpulse('exportsGrowth', 0.5, 8, 'Долгий контракт с концернами Вестравии'),
          makeImpulse('businessConfidence', 2, 'Контракт с Вестравией', 'default', difficulty, 'other'),
          makeImpulse('tensionPush', 1.2, 'Рынок открыт для станков Вестравии', 'fast', difficulty, 'other'));
      }
      if (o.deal === 'southwest') push(sustainedImpulse('inflationSupply', -0.2, 4, 'Дешёвое зерно и нефть из Дешта'));
      out.news.push(['world', `${def.title(c).toUpperCase()}: ${o.label.toUpperCase()}`, `${dip.reply ? 'Президент выбрал' : 'Срок ответа вышел — по умолчанию'}: ${o.label.toLowerCase()}. ${o.note}.`, 6]);
      out.resolved = { id: event.id, country: c, option: o.id, q };
      event = null;
    }
  }

  // 3. действие президента
  const act = dip.action;
  if (act && DIPLO_BY_ID[act.kind].cost <= capitalLeft) {
    const a = DIPLO_BY_ID[act.kind]; const c = act.country;
    out.spent += a.cost;
    let ok = true;
    if (a.id === 'trade') {
      treaties[c] = 12; shift(c, 8);
      push(makeImpulse('businessConfidence', 2, `Торговый договор ${NB[c].ins}`, 'default', difficulty, 'other'));
      out.news.push(['world', `ТОРГОВЫЙ ДОГОВОР ${NB[c].ins.toUpperCase()}`, `Пошлины сняты на три года. ${c === 'west' ? 'Вестравия — главный рынок для нашего экспорта: эффект будет заметным.' : 'Оборот невелик, но отношения держатся ровнее.'}`, 7]);
    } else if (a.id === 'aid') {
      cooldown[`aid:${c}`] = 4; shift(c, 14);
      push(sustainedImpulse('revenue', -nGdp * 0.6 / 100, 2, `Помощь ${NB[c].dat}`));
      out.news.push(['world', `ПОМОЩЬ ${NB[c].dat.toUpperCase()}`, `Гуманитарные грузы и льготный кредит — около 0,3% ВВП. В ${NB[c].gen === 'Дешта' ? 'Ашкале' : NB[c].gen === 'Норланда' ? 'Эльвборге' : 'Вестграде'} благодарят.`, 6]);
    } else if (a.id === 'ultimatum') {
      cooldown[`ultimatum:${c}`] = 6;
      ok = rng() < ultimatumChance(s, c);
      shift(c, ok ? -12 : -24);
      push(makeImpulse('approvalPush', ok ? 3 : -1, `Ультиматум ${NB[c].dat}`, 'fast', difficulty, 'other'));
      if (ok) {
        if (c === 'west') push(sustainedImpulse('exportsGrowth', 0.5, 6, 'Вестравия снизила пошлины после ультиматума'));
        if (c === 'north') out.revancheDelta -= 30;
        if (c === 'southwest') { mobilized = 0; calm = 8; }
      } else {
        push(makeImpulse('riskPremium', 0.15, `${NB[c].name} отверг ультиматум`, 'default', difficulty));
        if (c === 'southwest') mobilized = Math.max(mobilized, 3);
        if (c === 'north') out.revancheDelta += 10;
      }
      out.news.push(['world', ok ? `${NB[c].up} УСТУПИЛ УЛЬТИМАТУМУ` : `${NB[c].up} ОТВЕРГ УЛЬТИМАТУМ`,
        ok ? `Требование ${ULTIMATUM_DEMAND[c]} выполнено. Отношения испорчены, но своё страна получила.`
          : `Требование ${ULTIMATUM_DEMAND[c]} отвергнуто. Отношения рухнули, а угроза, которую не исполнили, стоит репутации.`, 8]);
    } else if (a.id === 'sanctions') {
      shift(c, -30);
      if (c === 'west') {
        out.sanctionsWest = true;
        push(...PRES_BY_ID.sanctions_impose.build(s, difficulty).impulses);
      } else {
        sanctions[c] = 8;
        push(makeImpulse('approvalPush', 2, `Санкции против ${NB[c].gen}`, 'fast', difficulty, 'other'));
      }
      out.news.push(['world', `САНКЦИИ ПРОТИВ ${NB[c].gen.toUpperCase()}`, c === 'west'
        ? 'Главный торговый партнёр под ограничениями: подорожает импорт, осторожнее станут инвесторы.'
        : `Торговля ${NB[c].ins} ограничена на два года. Оборот невелик — удар больше политический.`, 8]);
    }
    out.last = { country: c, kind: a.id, ok, q };
  }

  // 4. текущие эффекты отношений, договоров и санкций
  NEIGHBOR_IDS.forEach((c) => {
    if (treaties[c] > 0) treaties[c] -= 1;
    if (sanctions[c] > 0) sanctions[c] -= 1;
  });
  if (!atWarWith(s, 'west')) {
    const x = clamp((rel.west - 60) / 40, -1.5, 1);
    const tr = (s.diploTreaties || {}).west > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.5 * x + 0.6 * tr, 1, 'Отношения с Вестравией'),
      sustainedImpulse('capitalFlow', 3 * x, 1, 'Банки Вестравии'),
      sustainedImpulse('riskPremium', -0.03 * x, 1, 'Кредит банков Вестравии'));
  }
  if (!atWarWith(s, 'southwest')) {
    const x = clamp((rel.southwest - 40) / 40, -1, 1);
    const tr = (s.diploTreaties || {}).southwest > 0 ? 1 : 0;
    const sc = (s.diploSanctions || {}).southwest > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.15 * x + 0.3 * tr - 0.3 * sc, 1, 'Торговля с Дештом'),
      sustainedImpulse('inflationSupply', -0.05 * x - 0.05 * tr + 0.1 * sc, 1, 'Зерно и нефть Дешта'));
  }
  if (!atWarWith(s, 'north')) {
    const x = clamp((rel.north - 50) / 50, -1, 1);
    const tr = (s.diploTreaties || {}).north > 0 ? 1 : 0;
    const sc = (s.diploSanctions || {}).north > 0 ? 1 : 0;
    push(sustainedImpulse('exportsGrowth', 0.12 * x + 0.2 * tr - 0.25 * sc, 1, 'Торговля с Норландом'));
    if ((s.annexed || []).length) out.revancheDelta += -(rel.north - 45) * 0.06;
  }

  // 5. ходы соседей-ботов: при плохих отношениях они начинают конфликт сами
  if (!noEvents) {
    NEIGHBOR_IDS.forEach((c) => {
      if (atWarWith(s, c) || (cooldown[`hostile:${c}`] || 0) > 0 || rel[c] >= 25) return;
      if (rng() >= (25 - rel[c]) / 25 * 0.3) return;
      cooldown[`hostile:${c}`] = 6;
      if (c === 'west') {
        push(sustainedImpulse('exportsGrowth', -0.7, 6, 'Пошлины Вестравии'), makeImpulse('capitalFlow', -8, 'Пошлины Вестравии', 'default', difficulty));
        out.news.push(['world', 'ВЕСТРАВИЯ ВВОДИТ ПОШЛИНЫ НА НАШ ЭКСПОРТ', `Отношения ${Math.round(rel.west)} из 100 — и Вестград отвечает своим ходом: пошлины на полтора года. Экспорт просядет.`, 8]);
      } else if (c === 'north') {
        push(sustainedImpulse('exportsGrowth', -0.3, 4, 'Норланд перекрыл транзит'));
        out.revancheDelta += 12; shift('north', -3);
        out.news.push(['world', 'НОРЛАНД ПЕРЕКРЫЛ ТРАНЗИТ И РЫБОЛОВНЫЕ ВОДЫ', `Эльвборг наказывает за холодные отношения (${Math.round(rel.north)} из 100): грузы идут в обход, реваншисты в Норланде громче.`, 8]);
      } else if (!(mobilized > 0)) {
        mobilized = 6;
        push(makeImpulse('businessConfidence', -3, 'Дешт стягивает войска', 'default', difficulty, 'other'), makeImpulse('riskPremium', 0.1, 'Дешт стягивает войска', 'default', difficulty));
        out.news.push(['crisis', 'ДЕШТ СТЯГИВАЕТ ВОЙСКА К ГРАНИЦЕ', `Отношения ${Math.round(rel.southwest)} из 100. Если их не поправить — помощью, договором или ультиматумом, — Дешт может напасть.`, 9]);
      }
    });
  }

  // 6. новое событие от соседа
  if (!event && !noEvents && rng() < 0.18) {
    const pool = [];
    NEIGHBOR_EVENTS.forEach((e) => e.countries.forEach((c) => { if (!atWarWith(s, c) && e.when(s, c) && !(cooldown[`ev:${e.id}`] > 0)) pool.push([e, c]); }));
    if (pool.length) {
      const total = pool.reduce((a, [e]) => a + e.weight, 0);
      let r = rng() * total; let pick = pool[0];
      for (const p of pool) { r -= p[0].weight; if (r <= 0) { pick = p; break; } }
      const [e, c] = pick;
      event = { id: e.id, country: c, q, deadline: q + e.days };
      cooldown[`ev:${e.id}`] = 6;
      out.news.push(['world', e.title(c).toUpperCase(), `${e.text(c)} Ответ — за президентом${e.days > 1 ? `, срок — ${e.days} квартала` : ' в этом квартале'}.`, 7]);
    }
  }

  out.relations = Object.fromEntries(NEIGHBOR_IDS.map((c) => [c, Math.round(rel[c] * 10) / 10]));
  Object.assign(out, { treaties, sanctions, cooldown, mobilized, calm, event });
  return out;
}

export function peaceStep(s, decisions, difficulty, q) {
  const out = { impulses: [], news: [], talks: s.peaceTalks || null, treaty: s.treaty || null, returned: [] };
  const held = heldAnnex(s);
  // непризнанная граница: партнёры не снимают ограничения, пока Норланд её не признал
  if (held.length && !(s.treaty && s.treaty.recognized)) {
    out.impulses.push(makeImpulse('exportsGrowth', -0.3, 'Санкции за непризнанную границу', 'fast', difficulty, 'other'),
      makeImpulse('fdi', -1, 'Непризнанная граница отпугивает инвесторов', 'fast', difficulty, 'other'));
  }
  const talks = s.peaceTalks;
  if (!talks) return out;
  const terms = sanitizeTreaty(decisions.treaty, s);
  if (terms && terms.walkAway) {
    out.talks = null;
    out.news.push(['gov', 'ПЕРЕГОВОРЫ С НОРЛАНДОМ ПРЕРВАНЫ', 'Договора не будет: граница остаётся непризнанной, санкции — в силе, а в Норланде говорят о реванше всё громче.', 8]);
    return out;
  }
  if (!terms || !terms.propose) {
    out.talks = { ...talks, leverage: Math.max(0, talks.leverage - 2) };
    return out;
  }
  const cost = treatyCost(terms, s);
  if (cost > talks.leverage) {
    out.talks = { ...talks, leverage: Math.max(0, talks.leverage - 2), attempts: (talks.attempts || 0) + 1, refused: { cost: Math.round(cost), q } };
    out.news.push(['gov', 'НОРЛАНД ОТВЕРГ УСЛОВИЯ МИРА', `Делегация Норланда покинула зал: требования (${Math.round(cost)}) выше того, что позволяет нынешняя позиция страны (${Math.round(talks.leverage)}). Позиция тает с каждым кварталом.`, 8]);
    return out;
  }
  // договор подписан
  out.talks = null;
  const kept = held.filter((id) => !terms.returned.includes(id));
  out.treaty = { q, recognized: terms.recognition, sanctions: terms.sanctions, reparations: terms.reparations, returned: terms.returned, kept };
  out.returned = terms.returned;
  out.impulses.push(makeImpulse('approvalPush', terms.returned.length || terms.reparations === 'pay' ? -2 : 3, 'Мирный договор с Норландом', 'fast', difficulty, 'other'),
    makeImpulse('tensionPush', -2, 'Мирный договор', 'fast', difficulty, 'other'),
    makeImpulse('businessConfidence', 4, 'Мирный договор', 'default', difficulty, 'other'));
  if (terms.recognition) out.impulses.push(makeImpulse('riskPremium', -0.3, 'Граница признана', 'default', difficulty),
    makeImpulse('fdi', 6, 'Граница признана', 'default', difficulty, 'other'), makeImpulse('exportsGrowth', 1.5, 'Граница признана', 'default', difficulty, 'other'));
  if (terms.sanctions) out.impulses.push(makeImpulse('exportsGrowth', 3, 'Санкции сняты', 'default', difficulty, 'other'),
    makeImpulse('importsGrowth', 2, 'Санкции сняты', 'default', difficulty, 'other'), makeImpulse('capitalFlow', 12, 'Санкции сняты', 'default', difficulty),
    makeImpulse('fdi', 8, 'Санкции сняты', 'default', difficulty, 'other'), makeImpulse('riskPremium', -0.4, 'Санкции сняты', 'default', difficulty),
    makeImpulse('stockShock', 6, 'Санкции сняты', 'fast', difficulty));
  const rep = s.nominalGdp * 0.6 / 100;
  if (terms.reparations === 'receive') out.impulses.push(sustainedImpulse('revenue', rep, 8, 'Репарации Норланда'));
  if (terms.reparations === 'pay') out.impulses.push(sustainedImpulse('revenue', -rep, 8, 'Выплата репараций Норланду'));
  const parts = [
    terms.recognition ? `Норланд признаёт новую границу${kept.length ? ` — за страной остаются: ${kept.map((id) => regionById(id).name).join(', ')}` : ''}.` : 'Граница остаётся непризнанной: это перемирие на бумаге, а не мир.',
    terms.sanctions ? 'Норланд поддерживает снятие санкций — партнёры возвращаются.' : '',
    terms.reparations === 'receive' ? 'Норланд выплатит репарации: около 0,6% ВВП в год два года.' : terms.reparations === 'pay' ? 'Страна выплатит Норланду репарации: около 0,6% ВВП в год два года.' : '',
    terms.returned.length ? `Норланду возвращаются: ${terms.returned.map((id) => regionById(id).name).join(', ')}.` : '',
  ].filter(Boolean);
  out.news.push(['gov', 'ПОДПИСАН МИРНЫЙ ДОГОВОР С НОРЛАНДОМ', parts.join(' '), 10]);
  return out;
}

