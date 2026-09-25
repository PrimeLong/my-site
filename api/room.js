/* Vercel Serverless Function: одна точка входа на все действия комнаты.
   POST /api/room  { action, ... }
   Модель считается ТОЛЬКО здесь: иначе у игроков разойдутся случайные шоки. */
import { randomUUID, randomBytes } from 'node:crypto';
import { getRoom, setRoom, withRoom, hasKv, addPublicRoom, removePublicRoom, listPublicRoomIds } from './_lib/store.js';
import { userBySession, bumpStats } from './_lib/accounts.js';

import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry,
  describeHumanCbAction, describeHumanMofAction, redescribeCbAction, redescribeMofAction,
  botPresident, getPresPersona, processPresidentialDirective, directiveProgress, directiveVerdict,
  makeImpulse, askText, PRES_DIRECTIVE_COST, PRES_BY_ID, PRESIDENT_ACTIONS, REQUESTS,
  quarterLabel, clamp, LEVERS, FX_REGIMES, DIFFICULTIES, GOALS, fmt1,
  pickPromises, evaluatePromise, personaAfterElection, getCbPersona, getMofPersona,
  CB_PERSONAS, MOF_PERSONAS, PRESIDENT_PERSONAS, pressSpeakerSeat, PRESS_OPTION_IDS, scaleLever, SCENARIOS, REGION_PROJECTS, projectBlocker, WAR_STANCES, warObjectiveOpen, botWarOrder,
  sanitizeCampaignPlan, botCampaignPlan, sanitizeIntegration, DEFENSE_STANCES, sanitizeTreaty, botTreaty, botDefenseOrder, botFrontOrder, DEF_FRONT,
  sanitizeDiplomacy, botDiplomacy } from './_lib/engine.js';

/* Места в комнате закреплены за профилем. Вышедший игрок может вернуться только на
   своё место и не раньше чем через REJOIN_COOLDOWN; пока он не вернулся, место
   RESERVE_MS держится за ним — другой игрок его не займёт, а играет за него бот. */
const REJOIN_COOLDOWN_MS = 60 * 1000;
const RESERVE_MS = 10 * 60 * 1000;
export function seatAccessError(room, seat, login, now = Date.now()) {
  const accounts = room.accounts || {};
  const left = room.left || {};
  const mine = Object.entries(accounts).find(([sx, l]) => l === login && room.seats[sx]);
  if (mine) return mine[0] === seat ? 'Вы уже на этом месте' : 'Вы уже сидите в этой комнате на другом месте';
  const myLeft = left[login];
  // выгнанного создателем комнаты обратно не пускаем: иначе кнопка «выгнать» ничего не значит
  if (myLeft && myLeft.kicked) return 'Создатель комнаты убрал вас из этой партии';
  if (myLeft) {
    const wait = myLeft.at + REJOIN_COOLDOWN_MS - now;
    if (wait > 0) return `Вы только что вышли — вернуться можно через ${Math.ceil(wait / 1000)} с`;
    if (myLeft.seat !== seat && !room.seats[myLeft.seat] && now - myLeft.at < RESERVE_MS) return 'Вернуться можно только на своё прежнее место';
  }
  const holder = Object.entries(left).find(([l, x]) => l !== login && x.seat === seat && now - x.at < RESERVE_MS && !x.kicked);
  if (holder) return `Место держится за вышедшим игроком ещё ${Math.ceil((holder[1].at + RESERVE_MS - now) / 60000)} мин`;
  return null;
}

// «политика» (ЦБ vs Минфин) и «рынок» (трейдер vs трейдер) — два независимых
// режима комнаты с разными парами мест; SEATS — объединение обеих пар для общей
// валидации (место, не принадлежащее текущему режиму комнаты, просто всегда
// пустует и нигде не читается — см. seatsFor)
/* У «политики» появилось третье место — президент. Он не двигает ни одного рычага:
   его ход — это указы, кадры, реформы и требование к ведомству, то же самое, что в
   одиночной игре. Место существует, только если президент в комнате включён; пока
   за него никто не сел, за него играет бот. */
const SEATS_BY_MODE = { policy: ['central_bank', 'ministry_finance', 'president'], trader: ['trader1', 'trader2'] };
const SEATS = [...SEATS_BY_MODE.policy, ...SEATS_BY_MODE.trader];
const seatsFor = (room) => SEATS_BY_MODE[room.mode === 'trader' ? 'trader' : 'policy'];
const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((d) => d.id));
const GOAL_IDS = new Set(GOALS.map((g) => g.id));
const FX_REGIME_IDS = new Set(FX_REGIMES.map((r) => r.id));
const CB_PERSONA_IDS = new Set(CB_PERSONAS.map((p) => p.id));
const MOF_PERSONA_IDS = new Set(MOF_PERSONAS.map((p) => p.id));
const PRES_PERSONA_IDS = new Set(PRESIDENT_PERSONAS.map((p) => p.id));
const randomOf = (list) => list[Math.floor(Math.random() * list.length)].id;
/* «Классика» в лобби — это ровно то же, что и в одиночной игре: характеры ведомств
   бросаются случайно, президент включён. Поэтому «не указано» здесь значит «бросить
   кубик», а не «взять значение по умолчанию». */
const pickPersona = (v, ids, list) => (ids.has(v) ? v : randomOf(list));
const code = () => randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
const token = () => randomUUID();
const cleanString = (v, maxLen) => (typeof v === 'string' ? v.slice(0, maxLen) : null);
// партнёр опрашивает раз в ~2.5с; если дольше 12с не было ни одного запроса с его
// токеном — считаем, что вкладка закрыта/сеть легла, и показываем это второму игроку
const PRESENCE_TIMEOUT_MS = 12000;
// если партнёр занял место, но не отправляет решение (ушёл, закрыл вкладку, не
// вернулся) — без этого квартал стоит вечно: ни бот его не подхватывает (место же
// занято), ни второй игрок ничего не может сделать. Через 5 минут после начала
// квартала бот один раз решает за него, но МЕСТО остаётся его — он может вернуться
// и продолжить со следующего квартала
const QUARTER_TIMEOUT_MS = 5 * 60 * 1000;

// какой группой рычагов распоряжается каждое место — используется и при приёме
// решений, и при их слиянии, чтобы игроки не затирали рычаги друг друга
const SEAT_GROUP = { central_bank: 'monetary', ministry_finance: 'fiscal' };
const LEVER_IDS_BY_GROUP = { monetary: LEVERS.filter((l) => l.group === 'monetary').map((l) => l.id),
  fiscal: LEVERS.filter((l) => l.group === 'fiscal').map((l) => l.id) };
const pickFields = (obj, ids) => { const out = {}; for (const id of ids) if (id in obj) out[id] = obj[id]; return out; };

/* Решения приходят от клиента как есть: обрезаем каждый рычаг до его
   допустимого диапазона и отбрасываем всё незнакомое, чтобы NaN/Infinity
   или произвольные поля не попали в модель и не сломали комнату сразу
   для обоих игроков. Меняем только рычаги СВОЕЙ группы — иначе решение
   второго игрока для его же рычагов теряется при слиянии (см. resolveQuarter).
   Границы — те же, что игрок видит на ползунке при этой экономике (scaleLever):
   раньше сервер резал по статичным, и в сети срезались бы и ставка выше 25%
   при высокой инфляции, и рычаги в миллиардах, растущие вместе с ВВП. */
/* Решения на карте: стройка — только из каталога и только допустимая сейчас,
   ответ — только один из вариантов текущего события округа. */
export function sanitizeRegionPlan(o, economy) {
  const src = o && typeof o === 'object' ? o : {};
  const project = REGION_PROJECTS.find((p) => p.id === src.startProject);
  const ev = economy && economy.regionEvent;
  return {
    startProject: project && economy && !projectBlocker(project, economy) ? project.id : null,
    regionResponse: ev && (ev.options || []).some((x) => x.id === src.regionResponse) ? src.regionResponse : null,
    // программа интеграции новых земель; null — продолжать прошлую
    integrate: Array.isArray(src.integrate) && economy ? sanitizeIntegration(src.integrate, economy) : null,
    // ответ на требование группы — только один из предложенных вариантов
    groupResponse: economy && economy.groupDemand && (economy.groupDemand.options || []).some((x) => x.id === src.groupResponse) ? src.groupResponse : null,
  };
}

function sanitizeDecisions(base, submitted, seat, economy) {
  const out = { ...base };
  if (!submitted || typeof submitted !== 'object') return out;
  const group = SEAT_GROUP[seat];
  for (const lever of LEVERS) {
    if (lever.group !== group) continue;
    const v = submitted[lever.id];
    const l = economy ? scaleLever(lever, economy) : lever;
    if (typeof v === 'number' && Number.isFinite(v)) out[lever.id] = clamp(v, l.min, l.max);
  }
  if (group === 'monetary') {
    if (FX_REGIME_IDS.has(submitted.fxRegime)) out.fxRegime = submitted.fxRegime;
    if (typeof submitted.emergency === 'boolean') out.emergency = submitted.emergency;
    // обещание о пути ставки — одно из объявленных вариантов (см. model/guidance.js)
    out.guidance = ['none', 'cut', 'hold', 'hike'].includes(submitted.guidance) ? submitted.guidance : null;
  }
  if (group === 'fiscal') {
    if (typeof submitted.sovereignDefault === 'boolean') out.sovereignDefault = submitted.sovereignDefault;
    if (typeof submitted.imfProgram === 'boolean') out.imfProgram = submitted.imfProgram;
    Object.assign(out, sanitizeRegionPlan(submitted, economy));
  }
  return out;
}

const PRES_ACTION_IDS = new Set(PRESIDENT_ACTIONS.map((a) => a.id));
const REQUEST_IDS = new Set(REQUESTS.map((r) => r.id));
/* Ход президента — это не ползунки, а набор решений: указы и реформы, назначения,
   одно указание ведомству и его сила. Всё незнакомое отбрасываем так же, как рычаги. */
const WAR_STANCE_IDS = new Set(WAR_STANCES.map((x) => x.id));
const DEFENSE_STANCE_IDS = new Set(DEFENSE_STANCES.map((x) => x.id));
// приказ армии: только известный способ действий и только доступная сейчас цель
function sanitizeWarOrder(o, economy) {
  if (!o || typeof o !== 'object') return null;
  // в войне за новые земли цель — своя присоединённая область, способы — оборонительные
  if (economy && economy.warType === 'revanche') {
    if (!DEFENSE_STANCE_IDS.has(o.stance)) return null;
    const held = Object.keys((economy.revancheCampaign || {}).pressure || {}).filter((id) => !((economy.revancheCampaign || {}).lost || []).includes(id));
    return { stance: o.stance, target: held.includes(o.target) ? o.target : null };
  }
  // оборонительная война с Дештом: цель — одна из фронтовых областей
  if (economy && economy.warType === 'defensive') {
    if (!DEFENSE_STANCE_IDS.has(o.stance)) return null;
    return { stance: o.stance, target: DEF_FRONT.includes(o.target) ? o.target : null };
  }
  if (!WAR_STANCE_IDS.has(o.stance)) return null;
  const camp = (economy && economy.warCampaign) || { progress: {}, captured: [] };
  return { stance: o.stance, target: warObjectiveOpen(o.target, camp) ? o.target : null };
}
function sanitizePresident(v, economy) {
  const o = v && typeof v === 'object' ? v : {};
  return {
    region: sanitizeRegionPlan(o.region, economy),
    warOrder: sanitizeWarOrder(o.warOrder, economy),
    campaignPlan: sanitizeCampaignPlan(o.campaignPlan, economy),
    treaty: economy ? sanitizeTreaty(o.treaty, economy) : null,
    diplomacy: economy ? sanitizeDiplomacy(o.diplomacy, economy) : null,
    // кому объявлена война — одному из соседей (проверку «можно ли» делает движок)
    warTarget: ['north', 'west', 'southwest'].includes(o.warTarget) ? o.warTarget : null,
    actions: Array.isArray(o.actions) ? o.actions.filter((x) => PRES_ACTION_IDS.has(x)).slice(0, 4) : [],
    appointCb: CB_PERSONA_IDS.has(o.appointCb) ? o.appointCb : null,
    appointMof: MOF_PERSONA_IDS.has(o.appointMof) ? o.appointMof : null,
    directive: REQUEST_IDS.has(o.directive) ? o.directive : null,
    directiveStrength: Number.isFinite(o.directiveStrength) ? clamp(o.directiveStrength, 0.2, 4) : 1,
  };
}

/* Стартовая ситуация комнаты — те же сценарии, что в одиночной игре. Любой
   незнакомый идентификатор (или его отсутствие) — открытая партия: так же
   себя ведёт «классика» в лобби. */
// в сетевой партии всегда есть место ЦБ — сценарии без него (валютный союз) только для одиночной
const SCENARIO_IDS = new Set(SCENARIOS.filter((sc) => !sc.noRoles).map((sc) => sc.id));
export function freshRoom(opts) {
  const scenario = SCENARIO_IDS.has(opts.scenario) ? opts.scenario : 'sandbox';
  const economy = makeInitialEconomy(scenario);
  const mode = opts.mode === 'trader' ? 'trader' : 'policy';
  const seats = SEATS_BY_MODE[mode];
  const zip = (v) => Object.fromEntries(seats.map((sx) => [sx, v]));
  return {
    id: opts.id, created: Date.now(), version: 1, mode, scenario,
    ownerToken: token(), // владелец лобби — тот, кто нажал «Создать комнату»; не привязан к месту,
    // потому что место выбирается отдельным шагом уже ПОСЛЕ создания
    // общедоступная комната видна всем в браузере комнат и не требует кода;
    // приватная (по умолчанию) — только по коду/ссылке, как было раньше
    isPublic: !!opts.public,
    difficulty: DIFFICULTY_IDS.has(opts.difficulty) ? opts.difficulty : 'medium',
    goalCb: GOAL_IDS.has(opts.goalCb) ? opts.goalCb : 'min_inflation',
    goalMof: GOAL_IDS.has(opts.goalMof) ? opts.goalMof : 'living_standards',
    /* Характеры ведомств — не только для пустых мест: в «рыночной» комнате ими
       управляют боты всегда, и трейдерам важно, кто именно ведёт ставку и бюджет.
       Раньше здесь были захардкоженные 'pragmatic'/'technocrat' — одна и та же
       партия в каждой комнате. */
    cbPersona: pickPersona(opts.cbPersona, CB_PERSONA_IDS, CB_PERSONAS),
    mofPersona: pickPersona(opts.mofPersona, MOF_PERSONA_IDS, MOF_PERSONAS),
    /* Президент в сетевой партии — тот же бот, что и в одиночной: требует от
       ведомств, назначает руководителей тех из них, за которыми никто не сидит,
       и тратит политический капитал на реформы и указы. Выключается при создании
       комнаты. */
    president: opts.president === null ? null
      : { persona: pickPersona(opts.president && opts.president.persona, PRES_PERSONA_IDS, PRESIDENT_PERSONAS) },
    presidentPlan: null,
    presidentLast: null,
    presidentDemand: null,
    presMemo: { lastReqId: null, ago: 99 },
    // предвыборные обещания — только там, где вообще есть президентский пост
    // (мест «премьер-министр» в сетевой игре нет — за оба ведомства сразу
    // здесь не садятся); та же логика, что и в одиночной игре
    promises: mode === 'policy' && opts.president !== null ? pickPromises(economy) : null,
    seats: zip(null),
    names: zip(null),
    lastSeen: zip(null),
    economy, quarterIndex: 1, quarterStartedAt: Date.now(),
    decisions: defaultDecisions(economy),
    pendingImpulses: [], eventCooldowns: {}, stories: [],
    history: [{ q: 0, label: `${quarterLabel(1)} (старт)`, ...economy }],
    news: [], report: '', reasons: null,
    submissions: zip(null),
    // lastActions описывает институты (ЦБ/Минфин), а не места: в режиме
    // «рынок» обоими всегда управляют боты, но новости об их решениях всё
    // равно нужны трейдерам как контекст рынка — см. resolveQuarter
    lastActions: { central_bank: null, ministry_finance: null },
    chat: [],
    // стоимость портфеля трейдера — единственное, что сервер вообще знает про
    // портфели (сами позиции/сделки клиентские, см. onTrade в MacroSimulator.jsx):
    // без этого числа соперник не мог сравнить себя с чужим результатом, только
    // со статичными эталонами (индекс/облигации/депозит/инфляция)
    portfolioValues: {},
  };
}

/* Слепок решений президента на ближайший квартал — только то, что переживает JSON:
   сами объекты просьб содержат функции (fit/apply/ask) и в хранилище попасть не
   должны, а разбирать указание умеют processPresidentialDirective/directiveProgress
   по одному только reqId. */
const slimPlan = (plan) => (!plan ? null : {
  persona: plan.persona.id, personaName: plan.persona.name, personaTitle: plan.persona.title,
  actions: plan.actions, mood: plan.mood, quote: plan.quote, satisfaction: plan.satisfaction,
  appointBot: plan.appointBot,
  directive: plan.directive ? { reqId: plan.directive.reqId, branch: plan.directive.branch,
    label: plan.directive.req.label, ask: plan.directive.ask } : null,
});

/* Кому президент адресует требование, зависит от того, где сидит живой человек:
   давить на бота неинтересно. Если заняты оба места (или оба пусты — «рыночная»
   комната), предпочтения нет и требование идёт туда, где оно уместнее по ситуации. */
export function planPresident(room, economy, cooldowns) {
  if (!room.president) return null;
  const humanCb = !!room.seats.central_bank;
  const humanMof = !!room.seats.ministry_finance;
  const playerBranch = humanCb && !humanMof ? 'monetary' : humanMof && !humanCb ? 'fiscal' : null;
  const memo = room.presMemo || { lastReqId: null, ago: 99 };
  return slimPlan(botPresident(economy, room.president.persona, room.difficulty, {
    playerBranch, cooldowns: cooldowns || room.eventCooldowns || {},
    cbPersonaId: room.cbPersona, mofPersonaId: room.mofPersona,
    lastReqId: memo.lastReqId, lastDirectiveAgo: memo.ago,
  }));
}

const CHAT_LOG_CAP = 60;

/* публичный вид комнаты: без токенов игроков. ready/occupied/connected несут
   ключи для ОБЕИХ пар мест (политика и рынок), а не только текущего режима
   комнаты — так клиент читает свою пару единообразно, а неиспользуемая просто
   всегда пустая */
export const publicView = (room) => {
  const lastSeen = room.lastSeen || {};
  const isConnected = (seat) => !!room.seats[seat] && !!lastSeen[seat] && (Date.now() - lastSeen[seat]) < PRESENCE_TIMEOUT_MS;
  const perSeat = (fn) => Object.fromEntries(SEATS.map((sx) => [sx, fn(sx)]));
  return {
    id: room.id, version: room.version, difficulty: room.difficulty, mode: room.mode === 'trader' ? 'trader' : 'policy',
    scenario: room.scenario || 'sandbox',
    isPublic: !!room.isPublic,
    // время сервера: таймер квартала считается от него, а часы на устройствах
    // расходятся на минуты — и у двух игроков были разные цифры на экране
    now: Date.now(),
    quarterIndex: room.quarterIndex, quarterLabel: quarterLabel(room.quarterIndex), quarterStartedAt: room.quarterStartedAt,
    economy: room.economy, history: room.history, news: room.news.slice(0, 120),
    report: room.report, reasons: room.reasons, stories: room.stories,
    names: room.names,
    // значок профиля на месте — партнёр видит, что за местом живой игрок с профилем
    emblems: room.emblems || {},
    ready: perSeat((sx) => !!room.submissions[sx]),
    occupied: perSeat((sx) => !!room.seats[sx]),
    connected: perSeat(isConnected),
    lastActions: room.lastActions,
    goals: { central_bank: room.goalCb, ministry_finance: room.goalMof },
    personas: { central_bank: room.cbPersona || 'pragmatic', ministry_finance: room.mofPersona || 'technocrat' },
    // кулдауны указов — чтобы живой президент видел, что сейчас недоступно, а не
    // нажимал кнопку, решение по которой сервер молча отбросит
    presCooldowns: Object.fromEntries(Object.entries(room.eventCooldowns || {}).filter(([k]) => k.startsWith('pres:'))),
    president: room.president
      ? { ...room.president, human: !!room.seats.president, plan: room.seats.president ? null : (room.presidentPlan || null),
        demand: room.seats.president ? (room.presidentDemand || null) : null, last: room.presidentLast || null }
      : null,
    chat: room.chat || [],
    portfolioValues: room.portfolioValues || {},
    promises: room.promises || null,
  };
};

export function resolveQuarter(room) {
  const subs = room.submissions;
  const cbPersona = room.cbPersona || 'pragmatic';
  const mofPersona = room.mofPersona || 'technocrat';
  // пустое место занимает бот с характером комнаты
  let cbAct = subs.central_bank ? null : botCentralBank(room.economy, cbPersona, room.difficulty);
  let mofAct = subs.ministry_finance ? null : botFinanceMinistry(room.economy, mofPersona, room.difficulty);
  let cbDecisions = cbAct ? cbAct.decisions : subs.central_bank.decisions;
  let mofDecisions = mofAct ? mofAct.decisions : subs.ministry_finance.decisions;
  // новость/цитата о решении живого игрока — тем же способом, что у бота,
  // иначе действия партнёра-человека никогда не попадали в ленту новостей
  // (generateNews строит эти новости только из botAction/botActions)
  const cbNewsAct = cbAct || describeHumanCbAction(room.economy, room.names.central_bank, cbDecisions);
  const mofNewsAct = mofAct || describeHumanMofAction(room.economy, room.names.ministry_finance, mofDecisions);
  // рычаги берём именно по группе, а не полным объектом: иначе нетронутые
  // (но всё равно присутствующие в decisions) поля одного игрока при слиянии
  // затирают реальные изменения другого — это и было причиной, что применялось
  // решение только одного из игроков
  let eff = {
    ...room.decisions,
    ...pickFields(cbDecisions, LEVER_IDS_BY_GROUP.monetary),
    fxRegime: 'fxRegime' in cbDecisions ? cbDecisions.fxRegime : room.decisions.fxRegime,
    emergency: 'emergency' in cbDecisions ? cbDecisions.emergency : room.decisions.emergency,
    ...pickFields(mofDecisions, LEVER_IDS_BY_GROUP.fiscal),
  };
  // карта: живой президент решает поверх Минфина (живого или бота)
  const presRegion = subs.president && subs.president.president ? subs.president.president.region : null;
  eff.startProject = (presRegion && presRegion.startProject) || mofDecisions.startProject || null;
  eff.regionResponse = (presRegion && presRegion.regionResponse) || mofDecisions.regionResponse || null;
  eff.integrate = presRegion && presRegion.integrate != null ? presRegion.integrate : mofDecisions.integrate ?? null;
  eff.groupResponse = (presRegion && presRegion.groupResponse) || mofDecisions.groupResponse || null;
  // наступательная война: приказ живого президента, иначе — бота-президента по характеру
  if (room.economy.warType === 'offensive' && (room.economy.warQuartersLeft || 0) > 0) {
    const humanOrder = subs.president && subs.president.president ? subs.president.president.warOrder : null;
    eff.warOrder = humanOrder || (room.president && !room.seats.president ? botWarOrder(room.economy, room.president.persona) : null);
  }
  // война за новые земли и переговоры с Норландом: живой президент, иначе бот по характеру
  if (room.economy.warType === 'revanche' && (room.economy.warQuartersLeft || 0) > 0) {
    const humanOrder = subs.president && subs.president.president ? subs.president.president.warOrder : null;
    eff.warOrder = humanOrder || (room.president && !room.seats.president ? botDefenseOrder(room.economy, room.president.persona) : null);
  }
  if (room.economy.warType === 'defensive' && (room.economy.warQuartersLeft || 0) > 0) {
    const humanOrder = subs.president && subs.president.president ? subs.president.president.warOrder : null;
    eff.warOrder = humanOrder || (room.seats.president ? null : botFrontOrder(room.economy, room.president ? room.president.persona : 'technocrat'));
  }
  if (room.economy.peaceTalks) {
    const humanTreaty = subs.president && subs.president.president ? subs.president.president.treaty : null;
    eff.treaty = room.seats.president ? humanTreaty : botTreaty(room.economy, room.president ? room.president.persona : 'technocrat');
  }
  // дипломатия: живой президент, иначе бот по характеру; без президента МИД только отвечает соседям
  {
    const humanDiplo = subs.president && subs.president.president ? subs.president.president.diplomacy : null;
    const cap = Number.isFinite(room.economy.politicalCapital) ? room.economy.politicalCapital : 55;
    eff.diplomacy = room.seats.president ? humanDiplo : botDiplomacy(room.economy, room.president ? room.president.persona : 'technocrat', room.president ? cap : 0);
  }
  // кампания: штабы живого президента, иначе — штаб власти по опросам
  const presSub = subs.president && subs.president.president;
  eff.campaignPlan = presSub ? presSub.campaignPlan : botCampaignPlan(room.economy);
  /* Решения президента разбираются здесь — им нужны уже посчитанные решения обоих
     ведомств. Требование к живому игроку проверяется по тому, куда он сдвинул свои
     рычаги (directiveProgress), требование к боту — по тому, согласился ли тот его
     исполнить (processPresidentialDirective). Всё остальное — указы, реформы,
     назначения — считает движок теми же полями решений, что и в одиночной игре. */
  /* За президента может сидеть человек. Тогда план на квартал — это его решения,
     а не решения бота: тот же набор полей, только приходит из submit.

     Указание при этом живёт квартал. Раньше оно выдвигалось и проверялось в одном
     и том же квартале: ведомство физически не могло его увидеть — решения идут
     одновременно, — и в следующем же квартале приходила новость «ПРОИГНОРИРОВАНО».
     Теперь требование, выданное в этом квартале, публикуется сразу, а исполнение
     сверяется по решениям СЛЕДУЮЩЕГО. У бота-президента такая же фора и была:
     его план считается до квартала и показан игроку заранее. */
  const humanSeat = !!room.seats.president;
  const humanPres = subs.president && subs.president.president ? subs.president.president : null;
  const demandOf = (reqId, strength) => {
    const req = REQUESTS.find((r) => r.id === reqId);
    if (!req) return null;
    return { reqId: req.id, branch: req.from === 'ministry_finance' ? 'monetary' : 'fiscal',
      label: req.label, ask: askText(req, strength), strength };
  };
  const activeDemand = humanSeat ? (room.presidentDemand || null) : null;
  const newDemand = humanSeat && humanPres && humanPres.directive
    ? demandOf(humanPres.directive, humanPres.directiveStrength) : null;
  const plan = humanSeat
    ? { human: true, actions: humanPres ? humanPres.actions : [], appointBot: null, directive: activeDemand }
    : (room.president ? room.presidentPlan : null);
  const extraImpulses = [...(room.pendingImpulses || [])];
  let presDirResult = null;
  let directiveMet = null;
  // новое требование оплачивается сразу, исполнение проверяется бесплатно
  if (newDemand) eff = { ...eff, presidentExtraSpend: PRES_DIRECTIVE_COST };
  if (plan) {
    const persona = humanSeat ? null : getPresPersona(room.president.persona);
    eff = { ...eff, presidentActive: true, presidentActions: plan.actions,
      presidentPatience: persona ? persona.patience : 1,
      presidentExtraSpend: eff.presidentExtraSpend || 0 };
    if (humanPres) {
      if (humanPres.appointCb) eff.appointCb = humanPres.appointCb;
      if (humanPres.appointMof) eff.appointMof = humanPres.appointMof;
      if (humanPres.warTarget) eff.warTarget = humanPres.warTarget;
    }
    if (plan.appointBot) eff[plan.appointBot.kind === 'central_bank' ? 'appointCb' : 'appointMof'] = plan.appointBot.persona;
    const dir = plan.directive;
    if (dir) {
      const seat = dir.branch === 'monetary' ? 'central_bank' : 'ministry_finance';
      const live = !!subs[seat];
      if (live) {
        directiveMet = directiveProgress(dir.reqId, room.decisions,
          seat === 'central_bank' ? cbDecisions : mofDecisions, room.economy, dir.strength);
        eff = { ...eff, presidentDirectiveMet: directiveMet };
      } else {
        presDirResult = processPresidentialDirective(dir.reqId, room.economy, cbPersona, mofPersona, eff, dir.strength);
        if (presDirResult) {
          eff = { ...presDirResult.decisions };
          if (presDirResult.toCb) {
            cbDecisions = { ...cbDecisions, ...pickFields(eff, LEVER_IDS_BY_GROUP.monetary) };
            cbAct = redescribeCbAction(room.economy, cbPersona, eff);
          } else {
            mofDecisions = { ...mofDecisions, ...pickFields(eff, LEVER_IDS_BY_GROUP.fiscal) };
            mofAct = redescribeMofAction(room.economy, mofPersona, eff);
          }
          if (presDirResult.credibilityHit) {
            extraImpulses.push(makeImpulse('cbCredibilityPush', presDirResult.credibilityHit,
              'Центральный банк исполнил указание президента', 'fast', room.difficulty, 'other'));
          }
        }
      }
    }
  }
  const cbStance = clamp((eff.keyRate - room.economy.inflationExpectations - room.economy.rStar) / 3, -1, 1);
  const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6, -1, 1);
  // без этого обещания никогда не попадают в decisions, которые видит движок, —
  // голоса на выборах считались бы так, будто обещаний вообще не было (то же
  // самое делает solo в MacroSimulator.jsx перед своим вызовом simulateQuarter)
  if (room.promises) eff = { ...eff, promises: room.promises };
  /* Пресс-конференция: отвечает один голос власти (pressSpeakerSeat). Ответ
     не того места игнорируется — сервер не доверяет клиенту в том, кто сейчас
     говорит от имени власти. Бот на вопрос не отвечает, как и в одиночной
     игре: пропущенная пресс-конференция просто ничего не стоит и не даёт. */
  const speaker = pressSpeakerSeat(room.seats);
  const speakerSub = speaker ? subs[speaker] : null;
  eff = { ...eff, pressAnswer: speakerSub && speakerSub.pressAnswer ? speakerSub.pressAnswer : null };
  const res = simulateQuarter({
    economy: { ...room.economy, cbStance, mofStance },
    decisions: eff, pendingImpulses: extraImpulses, eventCooldowns: room.eventCooldowns,
    difficulty: room.difficulty, quarterIndex: room.quarterIndex, stories: room.stories,
    botAction: cbAct || cbNewsAct, botActions: [mofAct || mofNewsAct],
  });
  if (plan && plan.directive) {
    const dir = plan.directive;
    const to = dir.branch === 'monetary' ? 'ЦБ' : 'МИНФИН';
    if (presDirResult) {
      res.newsEntries.unshift({ id: `presdir${room.quarterIndex}`, cat: 'gov', priority: 8,
        q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
        headline: `ПРЕЗИДЕНТ → ${to}: ${dir.label.toUpperCase()} — ${presDirResult.status === 'accepted' ? 'ИСПОЛНЕНО'
          : presDirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${presDirResult.ask}» ${presDirResult.text}` });
    } else {
      const verdict = directiveVerdict(directiveMet);
      const pct = Number.isFinite(directiveMet) ? Math.round(directiveMet * 100) : null;
      const word = verdict === 'met' ? 'ВЫПОЛНЕНО' : verdict === 'partial' ? 'ВЫПОЛНЕНО ЧАСТИЧНО'
        : verdict === 'ignored' ? 'ПРОИГНОРИРОВАНО' : 'БЕЗ ОТВЕТА';
      res.newsEntries.unshift({ id: `presdir${room.quarterIndex}`, cat: 'gov', priority: 9,
        q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
        headline: `ПРЕЗИДЕНТ → ${to}: ${dir.label.toUpperCase()} — ${word}`,
        text: `«${dir.ask}» ${verdict === 'met' ? 'Ведомство пошло навстречу — администрация это отметила.'
          : verdict === 'partial' ? `Ведомство сделало примерно ${pct}% запрошенного. В администрации это считают полумерой.`
            : verdict === 'ignored' ? 'Ведомство поступило по-своему. В администрации президента это запомнят.'
              : 'Требование осталось без внятного ответа.'}` });
    }
  }
  if (newDemand) {
    const to = newDemand.branch === 'monetary' ? 'ЦБ' : 'МИНФИН';
    res.newsEntries.unshift({ id: `presask${room.quarterIndex}`, cat: 'gov', priority: 9,
      q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
      headline: `ПРЕЗИДЕНТ → ${to}: ${newDemand.label.toUpperCase()} — ТРЕБОВАНИЕ ВЫДВИНУТО`,
      text: `«${newDemand.ask}» Ответ ведомства будет виден по решениям следующего квартала.` });
  }
  // то же объявление обещаний на старте срока, что и в одиночной игре (см.
  // finishQuarter в MacroSimulator.jsx) — без него игрок узнавал о своих
  // обещаниях только на дне голосования, приговором «сдержано/провалено»,
  // хотя сам их никогда не выбирал (их назначает pickPromises при создании комнаты)
  if (room.quarterIndex === 1 && room.promises && room.promises.length) {
    res.newsEntries.unshift({ id: 'promisesstart', cat: 'gov', priority: 8,
      q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
      headline: 'ПРИНЯТА ПРИСЯГА: ОБЪЯВЛЕНЫ ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ',
      text: `На этот срок заявлено: ${room.promises.map((p) => `«${p.label}» — ${p.text.toLowerCase()}`).join('; ')}. К дню голосования по каждому подведут итог — сдержано оно или нет.` });
  }
  // предвыборные обещания подводятся тем же способом и в тот же момент, что и
  // в одиночной игре (см. finishQuarter в MacroSimulator.jsx): в квартал, когда
  // electionResult сформировался, а не раньше. При поражении на выборах партия
  // для этого места уже закончилась (см. checkDefeat на клиенте) — обещания
  // просто остаются как есть, следующего срока не будет.
  let nextPromises = room.promises;
  if (room.promises && res.economy.electionResult) {
    const er = res.economy.electionResult;
    const kept = room.promises.map((p) => evaluatePromise(p, res.economy).met);
    const keptCount = Number.isFinite(res.economy.promisesKept) ? res.economy.promisesKept : kept.filter(Boolean).length;
    const broken = room.promises.length - keptCount;
    res.newsEntries.unshift({ id: `promises${room.quarterIndex}`, cat: 'gov', priority: 9,
      q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
      headline: `ОБЕЩАНИЯ У УРНЫ: СДЕРЖАНО ${keptCount} ИЗ ${room.promises.length}`,
      text: `${room.promises.map((p, i) => `«${p.label}» — ${kept[i] ? 'сдержано' : 'провалено'}`).join('; ')}. ${
        keptCount > broken ? `Это добавило власти примерно ${fmt1((keptCount - broken) * 2.2)} п.п. голосов.`
          : keptCount < broken ? `Это стоило власти примерно ${fmt1((broken - keptCount) * 2.2)} п.п. голосов.`
            : 'На итог голосования обещания в сумме не повлияли.'}` });
    if (er === 'incumbent') {
      nextPromises = pickPromises(res.economy);
      res.newsEntries.unshift({ id: `newpromises${room.quarterIndex}`, cat: 'gov', priority: 8,
        q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
        headline: 'НОВЫЙ СРОК: ОБЪЯВЛЕНЫ ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ',
        text: `На новый срок заявлено: ${nextPromises.map((p) => `«${p.label}» — ${p.text.toLowerCase()}`).join('; ')}.` });
    }
  }
  let nextCbPersona = (humanPres && humanPres.appointCb)
    || (plan && plan.appointBot && plan.appointBot.kind === 'central_bank' ? plan.appointBot.persona : cbPersona);
  let nextMofPersona = (humanPres && humanPres.appointMof)
    || (plan && plan.appointBot && plan.appointBot.kind === 'ministry_finance' ? plan.appointBot.persona : mofPersona);
  // после проигранных выборов новая власть меняет руководство ведомства — тем же
  // способом и с теми же условиями, что в одиночной игре (см. finishQuarter в
  // MacroSimulator.jsx): Минфин при любой смене власти, ЦБ — только при разгромном
  // результате. Меняем только место, за которым сейчас нет живого игрока: если оно
  // занято человеком, это его партия, а не бота, и выборы её не отменяют.
  {
    const er = res.economy.electionResult;
    if (er && er !== 'incumbent') {
      if (!room.seats.ministry_finance) {
        const np = personaAfterElection('ministry_finance', res.economy);
        if (np !== nextMofPersona) {
          nextMofPersona = np;
          res.newsEntries.unshift({ id: `pers${room.quarterIndex}`, cat: 'gov', priority: 9,
            q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
            headline: `НОВЫЙ МИНИСТР ФИНАНСОВ: ${getMofPersona(np).name.toUpperCase()}`,
            text: `${getMofPersona(np).title}. ${getMofPersona(np).desc} Другому месту предстоит работать с другим бюджетом и другой логикой расходов.` });
        }
      }
      if (!room.seats.central_bank && er === 'landslide') {
        const np = personaAfterElection('central_bank', res.economy);
        if (np !== nextCbPersona) {
          nextCbPersona = np;
          res.newsEntries.unshift({ id: `perscb${room.quarterIndex}`, cat: 'cb', priority: 9,
            q: room.quarterIndex, qLabel: quarterLabel(room.quarterIndex),
            headline: `СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА: ${getCbPersona(np).name.toUpperCase()}`,
            text: `${getCbPersona(np).title}. ${getCbPersona(np).desc} Смена руководства ЦБ после выборов — всегда вопрос к независимости политики и к тому, чего стоят её обещания.` });
        }
      }
    }
  }
  const presMemo = plan && plan.directive ? { lastReqId: plan.directive.reqId, ago: 0 }
    : { lastReqId: (room.presMemo || {}).lastReqId || null, ago: Math.min(99, ((room.presMemo || {}).ago ?? 99) + 1) };
  const afterPresident = { ...room, cbPersona: nextCbPersona, mofPersona: nextMofPersona,
    presMemo, eventCooldowns: res.eventCooldowns };
  return {
    ...afterPresident,
    economy: res.economy,
    history: [...room.history, { q: room.quarterIndex, label: quarterLabel(room.quarterIndex), ...res.economy }].slice(-160),
    news: [...res.newsEntries, ...room.news].slice(0, 240),
    report: res.report, reasons: res.reasons,
    promises: nextPromises,
    pendingImpulses: res.pendingImpulses, eventCooldowns: res.eventCooldowns, stories: res.stories,
    decisions: defaultDecisions(res.economy, eff),
    quarterIndex: room.quarterIndex + 1,
    quarterStartedAt: Date.now(),
    presidentPlan: room.seats.president ? null : planPresident(afterPresident, res.economy, res.eventCooldowns),
    // требование, выданное в этом квартале, ведомства исполняют в следующем
    presidentDemand: humanSeat ? newDemand : null,
    presidentLast: plan && (plan.directive || plan.actions.length || newDemand)
      ? { label: plan.directive ? plan.directive.label : null,
        branch: plan.directive ? plan.directive.branch : null,
        directiveMet, status: presDirResult ? presDirResult.status : null,
        actions: plan.actions.map((idx) => (PRES_BY_ID[idx] || {}).label).filter(Boolean) }
      : room.presidentLast || null,
    submissions: Object.fromEntries(SEATS.map((sx) => [sx, seatsFor(room).includes(sx) ? null : room.submissions[sx]])),
    lastActions: {
      // timedOut: место было занято человеком, но за него в итоге решал бот
      // (не отправил решение вовремя) — отличаем от «место просто пустует»,
      // чтобы при возвращении показать именно «пока вас не было» и что можно
      // продолжать, а не путать с обычным заполнением пустого места ботом
      central_bank: { ...(cbAct ? { bot: true, timedOut: !!room.seats.central_bank, note: cbAct.note, quote: cbAct.quote }
        : { bot: false, note: subs.central_bank.note || null }),
      levers: { ...pickFields(eff, LEVER_IDS_BY_GROUP.monetary), fxRegime: eff.fxRegime, emergency: !!eff.emergency } },
      // levers — итоговые решения ведомства за квартал (после указаний президента):
      // партнёр видит их теми же ползунками, что и у себя, а не только текстом новости
      ministry_finance: { ...(mofAct ? { bot: true, timedOut: !!room.seats.ministry_finance, note: mofAct.note, quote: mofAct.quote }
        : { bot: false, note: subs.ministry_finance.note || null }),
      levers: { govSpending: eff.govSpending, transfers: eff.transfers, govInvestment: eff.govInvestment } },
    },
    version: room.version + 1,
  };
}

/* если квартал открыт дольше QUARTER_TIMEOUT_MS и кто-то из занявших место так и не
   отправил решение — резолвим квартал за него ботом один раз, не трогая само место */
function maybeForceResolve(room) {
  const bothIn = SEATS.every((sx) => room.submissions[sx] || !room.seats[sx]);
  if (bothIn) return room;
  const startedAt = room.quarterStartedAt || room.created || 0;
  if (Date.now() - startedAt < QUARTER_TIMEOUT_MS) return room;
  return resolveQuarter(room);
}

async function handleRequest(req, res) {
  if (req.method === 'GET') {
    const { id, since, seat, token: seatToken, list } = req.query;
    if (list === 'public') {
      const ids = await listPublicRoomIds();
      const rooms = [];
      for (const rid of ids) {
        const r = await getRoom(rid);
        // индекс не знает о TTL самой комнаты — протухшую запись подчищаем сразу,
        // а не оставляем висеть до следующего случайного обращения к ней
        if (!r) { await removePublicRoom(rid); continue; }
        const seatsList = seatsFor(r);
        rooms.push({
          id: r.id, mode: r.mode === 'trader' ? 'trader' : 'policy', difficulty: r.difficulty,
          president: !!r.president, quarterIndex: r.quarterIndex, created: r.created,
          seatsTotal: seatsList.length, seatsFree: seatsList.filter((sx) => !r.seats[sx]).length,
          activeCrises: (r.economy && r.economy.activeCrises) || [],
          scenario: r.scenario || 'sandbox',
        });
      }
      rooms.sort((a, b) => b.created - a.created);
      return res.status(200).json({ rooms: rooms.slice(0, 40) });
    }
    let room = await getRoom(String(id || '').toUpperCase());
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    const forceResolved = maybeForceResolve(room);
    if (forceResolved !== room) { room = forceResolved; await setRoom(room.id, room); }
    // хартбит присутствия: не версия комнаты, поэтому не должен будить второго
    // игрока полным обновлением — пишем без bump-а version
    if (SEATS.includes(seat) && room.seats[seat] && room.seats[seat] === seatToken) {
      room.lastSeen = { ...room.lastSeen, [seat]: Date.now() };
      await setRoom(room.id, room);
    }
    // «не изменилось» — валидная экономия трафика только пока оба присутствующих
    // игрока ещё в пределах таймаута: иначе партнёр никогда не узнает об отключении,
    // ведь version сам по себе от ухода со связи не меняется
    const lastSeen = room.lastSeen || { central_bank: null, ministry_finance: null };
    const anyStale = SEATS.some((sx) => room.seats[sx] && (!lastSeen[sx] || (Date.now() - lastSeen[sx]) >= PRESENCE_TIMEOUT_MS));
    if (!anyStale && since && Number(since) === room.version) return res.status(200).json({ unchanged: true, version: room.version });
    return res.status(200).json({ storage: hasKv() ? 'kv' : 'memory', room: publicView(room) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только GET и POST' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Некорректный JSON' });
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Некорректное тело запроса' });
  const { action } = body;

  if (action === 'create') {
    const id = code();
    // president: null — «выключить»; объект или отсутствие — включён (в «классике»
    // характер бросается случайно, ровно как в одиночной игре)
    const president = body.president === null || (body.president && body.president.enabled === false)
      ? null : (body.president || {});
    const base = freshRoom({ id, mode: body.mode, difficulty: body.difficulty, goalCb: body.goalCb, goalMof: body.goalMof,
      cbPersona: body.cbPersona, mofPersona: body.mofPersona, president, public: !!body.public, scenario: body.scenario });
    const room = { ...base, presidentPlan: planPresident(base, base.economy, {}) };
    await setRoom(id, room);
    if (room.isPublic) await addPublicRoom(id);
    return res.status(200).json({ id, ownerToken: room.ownerToken, storage: hasKv() ? 'kv' : 'memory', room: publicView(room) });
  }

  if (action === 'join') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    // по сети играют только с профилем: место закрепляется за ним
    const user = await userBySession(body.session);
    if (!user) return res.status(401).json({ error: 'Для игры по сети войдите в профиль' });
    let firstTime = false;
    const out = await withRoom(id, (room) => {
      if (!seatsFor(room).includes(seat)) return { error: 'Эта роль недоступна в этом режиме партии', status: 400 };
      if (seat === 'president' && !room.president) return { error: 'В этой комнате президента нет', status: 400 };
      if (room.seats[seat]) return { error: 'Место уже занято', status: 409 };
      const denied = seatAccessError(room, seat, user.login);
      if (denied) return { error: denied, status: 409 };
      firstTime = !(room.everJoined || []).includes(user.login);
      const left = { ...room.left }; delete left[user.login];
      const t = token();
      const next = { ...room, seats: { ...room.seats, [seat]: t },
        names: { ...room.names, [seat]: user.name },
        emblems: { ...room.emblems, [seat]: user.emblem || 'star' },
        accounts: { ...room.accounts, [seat]: user.login }, left,
        everJoined: firstTime ? [...(room.everJoined || []), user.login].slice(-20) : room.everJoined,
        version: room.version + 1, __token: t };
      // требование президента адресуется живому игроку — пересчитываем план, как
      // только становится известно, кто вообще сидит за пультом
      return { ...next, presidentPlan: planPresident(next, next.economy, next.eventCooldowns) };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    const t = out.room.__token; delete out.room.__token;
    await setRoom(id, out.room);
    // заполненную общедоступную комнату незачем предлагать в браузере комнат —
    // всё равно ни одно место не занять; освобождённое место возвращает её обратно
    if (out.room.isPublic && seatsFor(out.room).every((sx) => out.room.seats[sx])) await removePublicRoom(id);
    if (firstTime) await bumpStats(user.login, { rooms: 1, lastRoom: id });
    return res.status(200).json({ token: t, seat, storage: hasKv() ? 'kv' : 'memory', room: publicView(out.room) });
  }

  if (action === 'submit') {
    const id = String(body.id || '').toUpperCase();
    const out = await withRoom(id, (room) => {
      const seat = body.seat;
      if (!SEATS.includes(seat)) return { error: 'Неизвестная роль', status: 400 };
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      const decisions = sanitizeDecisions(room.decisions, body.decisions, seat, room.economy);
      const presidentMove = seat === 'president' ? sanitizePresident(body.president, room.economy) : null;
      // стоимость портфеля трейдера — сообщается им самим при готовности к
      // следующему кварталу; сервер её не считает (позиции клиентские), просто
      // хранит, чтобы соперник видел её в своём списке эталонов (см. publicView)
      const portfolioValues = Number.isFinite(body.portfolioValue)
        ? { ...room.portfolioValues, [seat]: clamp(body.portfolioValue, 0, 1e9) } : room.portfolioValues;
      const next = { ...room,
        // ответ на пресс-конференции хранится при сдаче хода, а не в decisions
        // комнаты: иначе он переживал бы квартал и отвечал на следующий вопрос
        submissions: { ...room.submissions, [seat]: { decisions, president: presidentMove, note: cleanString(body.note, 280),
          pressAnswer: body.decisions && PRESS_OPTION_IDS.has(body.decisions.pressAnswer) ? body.decisions.pressAnswer : null } },
        portfolioValues, version: room.version + 1 };
      const allIn = SEATS.every((sx) => next.submissions[sx] || !next.seats[sx]);
      return allIn ? resolveQuarter(next) : next;
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    // квартал сыгран — каждому сидящему профилю в статистику
    if (out.room.accounts) {
      const resolved = SEATS.every((sx) => !out.room.submissions[sx]);
      if (resolved) {
        await Promise.all(SEATS.filter((sx) => out.room.seats[sx] && out.room.accounts[sx])
          .map((sx) => bumpStats(out.room.accounts[sx], { quarters: 1 })));
      }
    }
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'report_portfolio') {
    // трейдер сообщает текущую стоимость портфеля не только при готовности к
    // следующему кварталу, а после каждой сделки (см. клиент) — иначе соперник
    // видел бы только значение на момент ПРОШЛОГО «готов», и половину квартала
    // список эталонов выглядел бы так, будто ничего не пишется
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    if (!Number.isFinite(body.value)) return res.status(400).json({ error: 'Некорректное значение' });
    const out = await withRoom(id, (room) => {
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      // не версия партии и не будит партнёра полным обновлением по сути дела —
      // но клиент опрашивает по version, поэтому бампаем, иначе партнёр не увидит
      return { ...room, portfolioValues: { ...room.portfolioValues, [seat]: clamp(body.value, 0, 1e9) }, version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'chat') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    const text = cleanString(body.text, 500);
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустое сообщение' });
    const out = await withRoom(id, (room) => {
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      const entry = { seat, text: text.trim(), at: Date.now() };
      const chat = [...(room.chat || []), entry].slice(-CHAT_LOG_CAP);
      return { ...room, chat, version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'unsubmit') {
    const id = String(body.id || '').toUpperCase();
    const out = await withRoom(id, (room) => ({ ...room,
      submissions: { ...room.submissions, [body.seat]: null }, version: room.version + 1 }));
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'set_difficulty') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    if (!DIFFICULTY_IDS.has(body.difficulty)) return res.status(400).json({ error: 'Неизвестная сложность' });
    const out = await withRoom(id, (room) => {
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      return { ...room, difficulty: body.difficulty, version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'leave') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    let leaver = null;
    const out = await withRoom(id, (room) => {
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      leaver = (room.accounts || {})[seat] || null;
      const accounts = { ...room.accounts }; delete accounts[seat];
      return { ...room, seats: { ...room.seats, [seat]: null }, names: { ...room.names, [seat]: null }, emblems: { ...room.emblems, [seat]: null },
        submissions: { ...room.submissions, [seat]: null }, lastSeen: { ...room.lastSeen, [seat]: null },
        accounts, left: leaver ? { ...room.left, [leaver]: { seat, at: Date.now() } } : room.left,
        version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    if (leaver) await bumpStats(leaver, { leaves: 1 });
    // освободившееся место в общедоступной комнате возвращает её в браузер комнат
    if (out.room.isPublic) await addPublicRoom(id);
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'kick') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    const out = await withRoom(id, (room) => {
      if (room.ownerToken !== body.ownerToken) return { error: 'Только владелец лобби может кикать', status: 403 };
      // владелец может «кикнуть» и собственное место — считаем это уходом, не ошибкой;
      // выгнанному место не держится, но и вернуться сразу он не может
      const kicked = (room.accounts || {})[seat] || null;
      const accounts = { ...room.accounts }; delete accounts[seat];
      return { ...room, seats: { ...room.seats, [seat]: null }, names: { ...room.names, [seat]: null }, emblems: { ...room.emblems, [seat]: null },
        submissions: { ...room.submissions, [seat]: null }, lastSeen: { ...room.lastSeen, [seat]: null },
        accounts, left: kicked ? { ...room.left, [kicked]: { seat, at: Date.now(), kicked: true } } : room.left,
        version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    if (out.room.isPublic) await addPublicRoom(id);
    return res.status(200).json({ room: publicView(out.room) });
  }

  return res.status(400).json({ error: 'Неизвестное действие' });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('room handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
