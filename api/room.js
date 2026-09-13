/* Vercel Serverless Function: одна точка входа на все действия комнаты.
   POST /api/room  { action, ... }
   Модель считается ТОЛЬКО здесь: иначе у игроков разойдутся случайные шоки. */
import { randomUUID, randomBytes } from 'node:crypto';
import { getRoom, setRoom, withRoom, hasKv } from './_lib/store.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry,
  quarterLabel, clamp, LEVERS, FX_REGIMES, DIFFICULTIES, GOALS } from './_lib/engine.js';

const SEATS = ['central_bank', 'ministry_finance'];
const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((d) => d.id));
const GOAL_IDS = new Set(GOALS.map((g) => g.id));
const FX_REGIME_IDS = new Set(FX_REGIMES.map((r) => r.id));
const code = () => randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
const token = () => randomUUID();
const cleanString = (v, maxLen) => (typeof v === 'string' ? v.slice(0, maxLen) : null);
// партнёр опрашивает раз в ~2.5с; если дольше 12с не было ни одного запроса с его
// токеном — считаем, что вкладка закрыта/сеть легла, и показываем это второму игроку
const PRESENCE_TIMEOUT_MS = 12000;

/* Решения приходят от клиента как есть: обрезаем каждый рычаг до его
   допустимого диапазона и отбрасываем всё незнакомое, чтобы NaN/Infinity
   или произвольные поля не попали в модель и не сломали комнату сразу
   для обоих игроков. */
function sanitizeDecisions(base, submitted) {
  const out = { ...base };
  if (!submitted || typeof submitted !== 'object') return out;
  for (const lever of LEVERS) {
    const v = submitted[lever.id];
    if (typeof v === 'number' && Number.isFinite(v)) out[lever.id] = clamp(v, lever.min, lever.max);
  }
  if (FX_REGIME_IDS.has(submitted.fxRegime)) out.fxRegime = submitted.fxRegime;
  if (typeof submitted.emergency === 'boolean') out.emergency = submitted.emergency;
  return out;
}

function freshRoom(opts) {
  const economy = makeInitialEconomy();
  return {
    id: opts.id, created: Date.now(), version: 1,
    difficulty: DIFFICULTY_IDS.has(opts.difficulty) ? opts.difficulty : 'medium',
    goalCb: GOAL_IDS.has(opts.goalCb) ? opts.goalCb : 'min_inflation',
    goalMof: GOAL_IDS.has(opts.goalMof) ? opts.goalMof : 'living_standards',
    seats: { central_bank: null, ministry_finance: null },
    names: { central_bank: null, ministry_finance: null },
    lastSeen: { central_bank: null, ministry_finance: null },
    economy, quarterIndex: 1,
    decisions: defaultDecisions(economy),
    pendingImpulses: [], eventCooldowns: {}, stories: [],
    history: [{ q: 0, label: `${quarterLabel(1)} (старт)`, ...economy }],
    news: [], report: '', reasons: null,
    submissions: { central_bank: null, ministry_finance: null },
    lastActions: { central_bank: null, ministry_finance: null },
  };
}

/* публичный вид комнаты: без токенов игроков */
const publicView = (room) => {
  const lastSeen = room.lastSeen || { central_bank: null, ministry_finance: null };
  const isConnected = (seat) => !!room.seats[seat] && !!lastSeen[seat] && (Date.now() - lastSeen[seat]) < PRESENCE_TIMEOUT_MS;
  return {
    id: room.id, version: room.version, difficulty: room.difficulty,
    quarterIndex: room.quarterIndex, quarterLabel: quarterLabel(room.quarterIndex),
    economy: room.economy, history: room.history, news: room.news.slice(0, 120),
    report: room.report, reasons: room.reasons, stories: room.stories,
    names: room.names,
    ready: { central_bank: !!room.submissions.central_bank, ministry_finance: !!room.submissions.ministry_finance },
    occupied: { central_bank: !!room.seats.central_bank, ministry_finance: !!room.seats.ministry_finance },
    connected: { central_bank: isConnected('central_bank'), ministry_finance: isConnected('ministry_finance') },
    lastActions: room.lastActions,
    goals: { central_bank: room.goalCb, ministry_finance: room.goalMof },
  };
};

function resolveQuarter(room) {
  const subs = room.submissions;
  // пустое место занимает бот с характером по умолчанию
  const cbAct = subs.central_bank ? null : botCentralBank(room.economy, 'pragmatic', room.difficulty);
  const mofAct = subs.ministry_finance ? null : botFinanceMinistry(room.economy, 'technocrat', room.difficulty);
  const eff = {
    ...room.decisions,
    ...(cbAct ? cbAct.decisions : subs.central_bank.decisions),
    ...(mofAct ? mofAct.decisions : subs.ministry_finance.decisions),
  };
  const cbStance = clamp((eff.keyRate - room.economy.inflationExpectations - room.economy.rStar) / 3, -1, 1);
  const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6, -1, 1);
  const res = simulateQuarter({
    economy: { ...room.economy, cbStance, mofStance },
    decisions: eff, pendingImpulses: room.pendingImpulses, eventCooldowns: room.eventCooldowns,
    difficulty: room.difficulty, quarterIndex: room.quarterIndex, stories: room.stories,
    botAction: cbAct || null, botActions: mofAct ? [mofAct] : [],
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
    submissions: { central_bank: null, ministry_finance: null },
    lastActions: {
      central_bank: cbAct ? { bot: true, note: cbAct.note, quote: cbAct.quote } : { bot: false, note: subs.central_bank.note || null },
      ministry_finance: mofAct ? { bot: true, note: mofAct.note, quote: mofAct.quote } : { bot: false, note: subs.ministry_finance.note || null },
    },
    version: room.version + 1,
  };
}

async function handleRequest(req, res) {
  if (req.method === 'GET') {
    const { id, since, seat, token: seatToken } = req.query;
    const room = await getRoom(String(id || '').toUpperCase());
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
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
    return res.status(200).json({ room: publicView(room) });
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
    const room = freshRoom({ id, difficulty: body.difficulty, goalCb: body.goalCb, goalMof: body.goalMof });
    await setRoom(id, room);
    return res.status(200).json({ id, storage: hasKv() ? 'kv' : 'memory', room: publicView(room) });
  }

  if (action === 'join') {
    const id = String(body.id || '').toUpperCase();
    const seat = body.seat;
    if (!SEATS.includes(seat)) return res.status(400).json({ error: 'Неизвестная роль' });
    const out = await withRoom(id, (room) => {
      if (room.seats[seat]) return { error: 'Место уже занято', status: 409 };
      const t = token();
      return { ...room, seats: { ...room.seats, [seat]: t }, names: { ...room.names, [seat]: cleanString(body.name, 40) || 'игрок' },
        version: room.version + 1, __token: t };
    });
    if (out.error) return res.status(out.status || 400).json({ error: out.error });
    const t = out.room.__token; delete out.room.__token;
    await setRoom(id, out.room);
    return res.status(200).json({ token: t, seat, room: publicView(out.room) });
  }

  if (action === 'submit') {
    const id = String(body.id || '').toUpperCase();
    const out = await withRoom(id, (room) => {
      const seat = body.seat;
      if (!SEATS.includes(seat)) return { error: 'Неизвестная роль', status: 400 };
      if (room.seats[seat] && room.seats[seat] !== body.token) return { error: 'Неверный токен', status: 403 };
      const decisions = sanitizeDecisions(room.decisions, body.decisions);
      const next = { ...room, submissions: { ...room.submissions, [seat]: { decisions, note: cleanString(body.note, 280) } },
        version: room.version + 1 };
      const bothIn = SEATS.every((sx) => next.submissions[sx] || !next.seats[sx]);
      return bothIn ? resolveQuarter(next) : next;
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
