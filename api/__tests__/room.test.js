import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { freshRoom, planPresident, resolveQuarter, publicView } from '../room.js';
import { personaAfterElection } from '../../src/lib/engine.js';

/* Комната без единого занятого места: ЦБ, Минфин и президент — боты, каждый
   submit тут же резолвит квартал (см. handleRequest/action==='submit' — allIn
   истинен, когда мест ни у кого нет). Это позволяет прогонять resolveQuarter
   напрямую, без HTTP-обёртки и без KV. */
function newRoom(opts = {}) {
  const base = freshRoom({ id: 'TEST', mode: 'policy', difficulty: 'medium', president: {},
    cbPersona: 'hawk', mofPersona: 'austerity', ...opts });
  return { ...base, presidentPlan: planPresident(base, base.economy, {}) };
}

describe('publicView — обещания не теряются на выходе к клиенту', () => {
  it('promises присутствуют и совпадают с room.promises и до, и после квартала', () => {
    const room = newRoom();
    expect(room.promises).toBeTruthy();
    expect(publicView(room).promises).toEqual(room.promises);

    const next = resolveQuarter(room);
    expect(publicView(next).promises).toEqual(next.promises);
  });
});

describe('resolveQuarter — обещания объявляются в начале срока, не только на голосовании', () => {
  it('первый же квартал сообщает игроку, что за обещания на нём висят', () => {
    // раньше об обещаниях узнавали только на дне голосования, приговором
    // «сдержано/провалено», хотя игрок их вообще не выбирал (см. pickPromises
    // в freshRoom) — теперь первый квартал сразу называет их
    const room = newRoom();
    expect(room.quarterIndex).toBe(1);
    const next = resolveQuarter(room);
    const oath = next.news.find((n) => n.id === 'promisesstart');
    expect(oath).toBeTruthy();
    expect(oath.headline).toMatch(/ПРИНЯТА ПРИСЯГА/);
    room.promises.forEach((p) => expect(oath.text).toContain(p.label));
  });
});

describe('resolveQuarter — обещания доходят до движка (голоса на выборах)', () => {
  it('decisions, переданные в simulateQuarter, содержат promises комнаты', () => {
    const room = newRoom();
    // симулируем квартал прямо перед выборами: если бы promises не долетали до
    // decisions (реальный баг, найденный при написании этого теста — solo
    // перед вызовом simulateQuarter добавляет их в decisions, room.js этого не
    // делал), новость об исходе выборов никогда не отражала бы обещания
    const preElection = { ...room, economy: { ...room.economy, quartersToElection: 1 } };
    const next = resolveQuarter(preElection);
    expect(next.economy.electionResult).toBeTruthy();
    const promiseNews = next.news.find((n) => n.id === `promises${room.quarterIndex}`);
    expect(promiseNews).toBeTruthy();
    expect(promiseNews.text).toMatch(/сдержано|провалено/);
  });
});

// исход голосования считается с шумом (gauss) и шансом переворота при
// поражении — оба завязаны на Math.random(). Фиксируем его на середину: шум
// обнуляется, а шанс переворота (всегда небольшой на нужных нам approval)
// гарантированно не выпадает, и результат выборов становится детерминированным.
describe('resolveQuarter — персоны ведомств после выборов (сеть)', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('при разгромном поражении и обоих местах без игрока меняются и ЦБ, и Минфин', () => {
    const room = newRoom();
    const preElection = { ...room, economy: { ...room.economy, quartersToElection: 1, approval: 2 } };
    const next = resolveQuarter(preElection);
    expect(next.economy.electionResult).toBe('landslide');
    expect(next.mofPersona).toBe(personaAfterElection('ministry_finance', next.economy));
    expect(next.cbPersona).toBe(personaAfterElection('central_bank', next.economy));
    expect(next.mofPersona).not.toBe(room.mofPersona);
    expect(next.cbPersona).not.toBe(room.cbPersona);
    expect(next.news.some((n) => /НОВЫЙ МИНИСТР ФИНАНСОВ/.test(n.headline))).toBe(true);
    expect(next.news.some((n) => /СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА/.test(n.headline))).toBe(true);
  });

  it('при обычной смене власти (не landslide) меняется только Минфин, ЦБ остаётся', () => {
    const room = newRoom();
    const preElection = { ...room, economy: { ...room.economy, quartersToElection: 1, approval: 30 } };
    const next = resolveQuarter(preElection);
    expect(next.economy.electionResult).toBe('opposition');
    expect(next.mofPersona).toBe(personaAfterElection('ministry_finance', next.economy));
    expect(next.mofPersona).not.toBe(room.mofPersona);
    expect(next.cbPersona).toBe(room.cbPersona);
    expect(next.news.some((n) => /НОВЫЙ МИНИСТР ФИНАНСОВ/.test(n.headline))).toBe(true);
    expect(next.news.some((n) => /СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА/.test(n.headline))).toBe(false);
  });

  it('при переизбрании действующей власти персоны не меняются', () => {
    const room = newRoom();
    const preElection = { ...room, economy: { ...room.economy, quartersToElection: 1, approval: 98 } };
    const next = resolveQuarter(preElection);
    expect(next.economy.electionResult).toBe('incumbent');
    expect(next.mofPersona).toBe(room.mofPersona);
    expect(next.cbPersona).toBe(room.cbPersona);
  });

  it('занятое место — это партия живого игрока, выборы её не отменяют', () => {
    const room = newRoom();
    const seated = { ...room, seats: { ...room.seats, ministry_finance: 'tok-mof', central_bank: 'tok-cb' },
      submissions: { ...room.submissions, ministry_finance: { decisions: room.decisions, president: null, note: null },
        central_bank: { decisions: room.decisions, president: null, note: null } },
      economy: { ...room.economy, quartersToElection: 1, approval: 2 } };
    const next = resolveQuarter(seated);
    expect(next.economy.electionResult).toBe('landslide');
    expect(next.mofPersona).toBe(room.mofPersona);
    expect(next.cbPersona).toBe(room.cbPersona);
  });
});
