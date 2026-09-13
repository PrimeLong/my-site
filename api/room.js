/* Vercel Serverless Function: одна точка входа на все действия комнаты.
   POST /api/room  { action, ... }
   Модель считается ТОЛЬКО здесь: иначе у игроков разойдутся случайные шоки. */
import { getRoom, setRoom, withRoom, hasKv } from './_lib/store.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry,
  quarterLabel, clamp } from './_lib/engine.js';

const SEATS = ['central_bank', 'ministry_finance'];
const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const token = () => Math.random().toString(36).slice(2, 14);

function freshRoom(opts) {
  const economy = makeInitialEconomy();
  return {
    id: opts.id, created: Date.now(), version: 1,
    difficulty: opts.difficulty || 'medium',
    goalCb: opts.goalCb || 'min_inflation', goalMof: opts.goalMof || 'living_standards',
    seats: { central_bank: null, ministry_finance: null },
    names: { central_bank: null, ministry_finance: null },
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
const publicView = (room) => ({
  id: room.id, version: room.version, difficulty: room.difficulty,
  quarterIndex: room.quarterIndex, quarterLabel: quarterLabel(room.quarterIndex),
  economy: room.economy, history: room.history, news: room.news.slice(0, 120),
  report: room.report, reasons: room.reasons, stories: room.stories,
  names: room.names,
  ready: { central_bank: !!room.submissions.central_bank, ministry_finance: !!room.submissions.ministry_finance },
  occupied: { central_bank: !!room.seats.central_bank, ministry_finance: !!room.seats.ministry_finance },
  lastActions: room.lastActions,
  goals: { central_bank: room.goalCb, ministry_finance: room.goalMof },
});

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { id, since } = req.query;
    const room = await getRoom(String(id || '').toUpperCase());
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    if (since && Number(since) === room.version) return res.status(200).json({ unchanged: true, version: room.version });
    return res.status(200).json({ room: publicView(room) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только GET и POST' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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
      return { ...room, seats: { ...room.seats, [seat]: t }, names: { ...room.names, [seat]: body.name || 'игрок' },
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
      const next = { ...room, submissions: { ...room.submissions, [seat]: { decisions: body.decisions, note: body.note || null } },
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

  return res.status(400).json({ error: 'Неизвестное действие' });
}
