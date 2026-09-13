/* Vercel Serverless Function: одна точка входа на все действия комнаты.
   POST /api/room  { action, ... }
   Модель считается ТОЛЬКО здесь: иначе у игроков разойдутся случайные шоки. */
import { randomUUID, randomBytes } from 'node:crypto';
import { getRoom, setRoom, withRoom, hasKv } from './_lib/store.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry,
  describeHumanCbAction, describeHumanMofAction,
  quarterLabel, clamp, LEVERS, FX_REGIMES, DIFFICULTIES, GOALS } from './_lib/engine.js';

// «политика» (ЦБ vs Минфин) и «рынок» (трейдер vs трейдер) — два независимых
// режима комнаты с разными парами мест; SEATS — объединение обеих пар для общей
// валидации (место, не принадлежащее текущему режиму комнаты, просто всегда
// пустует и нигде не читается — см. seatsFor)
const SEATS_BY_MODE = { policy: ['central_bank', 'ministry_finance'], trader: ['trader1', 'trader2'] };
const SEATS = [...SEATS_BY_MODE.policy, ...SEATS_BY_MODE.trader];
const seatsFor = (room) => SEATS_BY_MODE[room.mode === 'trader' ? 'trader' : 'policy'];
const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((d) => d.id));
const GOAL_IDS = new Set(GOALS.map((g) => g.id));
const FX_REGIME_IDS = new Set(FX_REGIMES.map((r) => r.id));
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
   второго игрока для его же рычагов теряется при слиянии (см. resolveQuarter). */
function sanitizeDecisions(base, submitted, seat) {
  const out = { ...base };
  if (!submitted || typeof submitted !== 'object') return out;
  const group = SEAT_GROUP[seat];
  for (const lever of LEVERS) {
    if (lever.group !== group) continue;
    const v = submitted[lever.id];
    if (typeof v === 'number' && Number.isFinite(v)) out[lever.id] = clamp(v, lever.min, lever.max);
  }
  if (group === 'monetary') {
    if (FX_REGIME_IDS.has(submitted.fxRegime)) out.fxRegime = submitted.fxRegime;
    if (typeof submitted.emergency === 'boolean') out.emergency = submitted.emergency;
  }
  return out;
}

function freshRoom(opts) {
  const economy = makeInitialEconomy();
  const mode = opts.mode === 'trader' ? 'trader' : 'policy';
  const seats = SEATS_BY_MODE[mode];
  const zip = (v) => ({ [seats[0]]: v, [seats[1]]: v });
  return {
    id: opts.id, created: Date.now(), version: 1, mode,
    ownerToken: token(), // владелец лобби — тот, кто нажал «Создать комнату»; не привязан к месту,
    // потому что место выбирается отдельным шагом уже ПОСЛЕ создания
    difficulty: DIFFICULTY_IDS.has(opts.difficulty) ? opts.difficulty : 'medium',
    goalCb: GOAL_IDS.has(opts.goalCb) ? opts.goalCb : 'min_inflation',
    goalMof: GOAL_IDS.has(opts.goalMof) ? opts.goalMof : 'living_standards',
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

const CHAT_LOG_CAP = 60;

/* публичный вид комнаты: без токенов игроков. ready/occupied/connected несут
   ключи для ОБЕИХ пар мест (политика и рынок), а не только текущего режима
   комнаты — так клиент читает свою пару единообразно, а неиспользуемая просто
   всегда пустая */
const publicView = (room) => {
  const lastSeen = room.lastSeen || {};
  const isConnected = (seat) => !!room.seats[seat] && !!lastSeen[seat] && (Date.now() - lastSeen[seat]) < PRESENCE_TIMEOUT_MS;
  const perSeat = (fn) => Object.fromEntries(SEATS.map((sx) => [sx, fn(sx)]));
  return {
    id: room.id, version: room.version, difficulty: room.difficulty, mode: room.mode === 'trader' ? 'trader' : 'policy',
    quarterIndex: room.quarterIndex, quarterLabel: quarterLabel(room.quarterIndex), quarterStartedAt: room.quarterStartedAt,
    economy: room.economy, history: room.history, news: room.news.slice(0, 120),
    report: room.report, reasons: room.reasons, stories: room.stories,
    names: room.names,
    ready: perSeat((sx) => !!room.submissions[sx]),
    occupied: perSeat((sx) => !!room.seats[sx]),
    connected: perSeat(isConnected),
    lastActions: room.lastActions,
    goals: { central_bank: room.goalCb, ministry_finance: room.goalMof },
    chat: room.chat || [],
    portfolioValues: room.portfolioValues || {},
  };
};

function resolveQuarter(room) {
  const subs = room.submissions;
  // пустое место занимает бот с характером по умолчанию
  const cbAct = subs.central_bank ? null : botCentralBank(room.economy, 'pragmatic', room.difficulty);
  const mofAct = subs.ministry_finance ? null : botFinanceMinistry(room.economy, 'technocrat', room.difficulty);
  const cbDecisions = cbAct ? cbAct.decisions : subs.central_bank.decisions;
  const mofDecisions = mofAct ? mofAct.decisions : subs.ministry_finance.decisions;
  // новость/цитата о решении живого игрока — тем же способом, что у бота,
  // иначе действия партнёра-человека никогда не попадали в ленту новостей
  // (generateNews строит эти новости только из botAction/botActions)
  const cbNewsAct = cbAct || describeHumanCbAction(room.economy, room.names.central_bank, cbDecisions);
  const mofNewsAct = mofAct || describeHumanMofAction(room.economy, room.names.ministry_finance, mofDecisions);
  // рычаги берём именно по группе, а не полным объектом: иначе нетронутые
  // (но всё равно присутствующие в decisions) поля одного игрока при слиянии
  // затирают реальные изменения другого — это и было причиной, что применялось
  // решение только одного из игроков
  const eff = {
    ...room.decisions,
    ...pickFields(cbDecisions, LEVER_IDS_BY_GROUP.monetary),
    fxRegime: 'fxRegime' in cbDecisions ? cbDecisions.fxRegime : room.decisions.fxRegime,
    emergency: 'emergency' in cbDecisions ? cbDecisions.emergency : room.decisions.emergency,
    ...pickFields(mofDecisions, LEVER_IDS_BY_GROUP.fiscal),
  };
  const cbStance = clamp((eff.keyRate - room.economy.inflationExpectations - room.economy.rStar) / 3, -1, 1);
  const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6, -1, 1);
  const res = simulateQuarter({
    economy: { ...room.economy, cbStance, mofStance },
    decisions: eff, pendingImpulses: room.pendingImpulses, eventCooldowns: room.eventCooldowns,
    difficulty: room.difficulty, quarterIndex: room.quarterIndex, stories: room.stories,
    botAction: cbNewsAct, botActions: [mofNewsAct],
  });
  return {
    ...room,
    economy: res.economy,
    history: [...room.history, { q: room.quarterIndex, label: quarterLabel(room.quarterIndex), ...res.economy }].slice(-160),
    news: [...res.newsEntries, ...room.news].slice(0, 240),
    report: res.report, reasons: res.reasons,
    pendingImpulses: res.pendingImpulses, eventCooldowns: res.eventCooldowns, stories: res.stories,
    decisions: defaultDecisions(res.economy, eff),
    quarterIndex: room.quarterIndex + 1,
    quarterStartedAt: Date.now(),
    submissions: { ...room.submissions, [seatsFor(room)[0]]: null, [seatsFor(room)[1]]: null },
    lastActions: {
      // timedOut: место было занято человеком, но за него в итоге решал бот
      // (не отправил решение вовремя) — отличаем от «место просто пустует»,
      // чтобы при возвращении показать именно «пока вас не было» и что можно
      // продолжать, а не путать с обычным заполнением пустого места ботом
      central_bank: cbAct ? { bot: true, timedOut: !!room.seats.central_bank, note: cbAct.note, quote: cbAct.quote } : { bot: false, note: subs.central_bank.note || null },
      ministry_finance: mofAct ? { bot: true, timedOut: !!room.seats.ministry_finance, note: mofAct.note, quote: mofAct.quote } : { bot: false, note: subs.ministry_finance.note || null },
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
    const { id, since, seat, token: seatToken } = req.query;
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
    const room = freshRoom({ id, mode: body.mode, difficulty: body.difficulty, goalCb: body.goalCb, goalMof: body.goalMof });
    await setRoom(id, room);
    return res.status(200).json({ id, ownerToken: room.ownerToken, storage: hasKv() ? 'kv' : 'memory', room: publicView(room) });
  }

  if (action === 'join') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    const out = await withRoom(id, (room) => {
      if (!seatsFor(room).includes(seat)) return { error: 'Эта роль недоступна в этом режиме партии', status: 400 };
      if (room.seats[seat]) return { error: 'Место уже занято', status: 409 };
      const t = token();
      return { ...room, seats: { ...room.seats, [seat]: t }, names: { ...room.names, [seat]: cleanString(body.name, 40) || 'игрок' },
        version: room.version + 1, __token: t };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    const t = out.room.__token; delete out.room.__token;
    await setRoom(id, out.room);
    return res.status(200).json({ token: t, seat, storage: hasKv() ? 'kv' : 'memory', room: publicView(out.room) });
  }

  if (action === 'submit') {
    const id = String(body.id || '').toUpperCase();
    const out = await withRoom(id, (room) => {
      const seat = body.seat;
      if (!SEATS.includes(seat)) return { error: 'Неизвестная роль', status: 400 };
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      const decisions = sanitizeDecisions(room.decisions, body.decisions, seat);
      // стоимость портфеля трейдера — сообщается им самим при готовности к
      // следующему кварталу; сервер её не считает (позиции клиентские), просто
      // хранит, чтобы соперник видел её в своём списке эталонов (см. publicView)
      const portfolioValues = Number.isFinite(body.portfolioValue)
        ? { ...room.portfolioValues, [seat]: clamp(body.portfolioValue, 0, 1e9) } : room.portfolioValues;
      const next = { ...room, submissions: { ...room.submissions, [seat]: { decisions, note: cleanString(body.note, 280) } },
        portfolioValues, version: room.version + 1 };
      const bothIn = SEATS.every((sx) => next.submissions[sx] || !next.seats[sx]);
      return bothIn ? resolveQuarter(next) : next;
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
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
    const out = await withRoom(id, (room) => {
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      return { ...room, seats: { ...room.seats, [seat]: null }, names: { ...room.names, [seat]: null },
        submissions: { ...room.submissions, [seat]: null }, lastSeen: { ...room.lastSeen, [seat]: null },
        version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    return res.status(200).json({ room: publicView(out.room) });
  }

  if (action === 'kick') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    const out = await withRoom(id, (room) => {
      if (room.ownerToken !== body.ownerToken) return { error: 'Только владелец лобби может кикать', status: 403 };
      // владелец может «кикнуть» и собственное место — считаем это уходом, не ошибкой
      return { ...room, seats: { ...room.seats, [seat]: null }, names: { ...room.names, [seat]: null },
        submissions: { ...room.submissions, [seat]: null }, lastSeen: { ...room.lastSeen, [seat]: null },
        version: room.version + 1 };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
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
