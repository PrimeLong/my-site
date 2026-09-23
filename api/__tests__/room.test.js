import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { freshRoom, planPresident, resolveQuarter, publicView, sanitizeRegionPlan } from '../room.js';
import { personaAfterElection, pickPressQuestion } from '../../src/lib/engine.js';

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

/* Пресс-конференция в комнате: от имени власти отвечает один голос. Говорящего
   выбирает сервер (pressSpeakerSeat), а не клиент — иначе любой игрок мог бы
   ответить за президента, прислав pressAnswer в своих решениях. */
describe('resolveQuarter — пресс-конференция в сетевой партии', () => {
  const pressNews = (room) => room.news.find((n) => n.headline.startsWith('ПРЕСС-КОНФЕРЕНЦИЯ'));
  const seated = (room, seats) => ({ ...room, seats: { ...room.seats, ...Object.fromEntries(seats.map((sx) => [sx, `tok-${sx}`])) } });
  // настоящий ход всегда несёт полный набор решений (sanitizeDecisions
  // накладывает рычаги игрока на room.decisions), поэтому и здесь так же
  let base = null;
  // ответ обязан существовать у вопроса этого квартала, иначе движок его не найдёт
  const ANSWER = '__valid__';
  const valid = () => pickPressQuestion(base.economy, base.quarterIndex).options[0].id;
  const sub = (pressAnswer) => ({ decisions: { ...base.decisions }, president: null, note: '',
    pressAnswer: pressAnswer === ANSWER ? valid() : pressAnswer });

  it('без президента отвечает Минфин, и его ответ попадает в новости', () => {
    const room = seated(newRoom({ president: null }), ['central_bank', 'ministry_finance']); base = room;
    const next = resolveQuarter({ ...room, submissions: { central_bank: sub(null), ministry_finance: sub(ANSWER) } });
    expect(pressNews(next)).toBeTruthy();
  });

  it('ответ не того места игнорируется: при занятом месте Минфина ЦБ не говорит за власть', () => {
    const room = seated(newRoom({ president: null }), ['central_bank', 'ministry_finance']); base = room;
    const next = resolveQuarter({ ...room, submissions: { central_bank: sub(ANSWER), ministry_finance: sub(null) } });
    expect(pressNews(next)).toBeFalsy();
  });

  it('живой президент — единственный голос: его ответ идёт, ответ Минфина нет', () => {
    const room = seated(newRoom(), ['ministry_finance', 'president']); base = room;
    const presSub = { ...sub(ANSWER), president: { actions: [], appointCb: null, appointMof: null, directive: null, directiveStrength: 1 } };
    const withPres = resolveQuarter({ ...room, submissions: { ministry_finance: sub(null), president: presSub } });
    expect(pressNews(withPres)).toBeTruthy();
    const mofOnly = resolveQuarter({ ...room, submissions: { ministry_finance: sub(ANSWER), president: { ...presSub, pressAnswer: null } } });
    expect(pressNews(mofOnly)).toBeFalsy();
  });

  it('без людей на местах власти пресс-конференции нет — бот на вопросы не отвечает', () => {
    const next = resolveQuarter(newRoom());
    expect(pressNews(next)).toBeFalsy();
  });
});

describe('комната из сценария', () => {
  it('сервер создаёт экономику выбранного сценария и сообщает его клиенту', () => {
    const r = freshRoom({ id: 'SC1', mode: 'policy', difficulty: 'medium', president: {}, scenario: 'hyperinflation' });
    expect(r.scenario).toBe('hyperinflation');
    expect(r.economy.inflation).toBeGreaterThan(20);
    expect(r.economy.crisisMandateLeft).toBeGreaterThan(0);
    expect(publicView(r).scenario).toBe('hyperinflation');
  });

  it('незнакомый или пустой сценарий — открытая партия', () => {
    ['', 'nope', undefined, '__proto__'].forEach((sc) => {
      const r = freshRoom({ id: 'SC2', mode: 'policy', difficulty: 'medium', president: {}, scenario: sc });
      expect(r.scenario).toBe('sandbox');
      expect(r.economy.inflation).toBeLessThan(6);
    });
  });
});

describe('resolveQuarter — бюджетные потоки Минфина видны партнёру', () => {
  it('lastActions.ministry_finance несёт итоговые ползунки закупок, выплат и инвестиций в пределах ±15%', () => {
    const next = resolveQuarter(newRoom());
    const lv = publicView(next).lastActions.ministry_finance.levers;
    for (const id of ['govSpending', 'transfers', 'govInvestment']) {
      expect(Number.isFinite(lv[id]), id).toBe(true);
      expect(Math.abs(lv[id]), id).toBeLessThanOrEqual(15);
      expect(lv[id]).toBe(next.decisions[id]);
    }
  });
});

describe('resolveQuarter — решения ЦБ видны партнёру', () => {
  it('lastActions.central_bank несёт итоговые ставку, резервы, операции, интервенции, ликвидность и режим курса', () => {
    const next = resolveQuarter(newRoom());
    const lv = publicView(next).lastActions.central_bank.levers;
    for (const id of ['keyRate', 'reserveReq', 'capitalRequirement', 'moneySupplyOp', 'fxIntervention', 'liquidity', 'inflationTarget']) {
      expect(Number.isFinite(lv[id]), id).toBe(true);
    }
    expect(['free', 'managed', 'peg']).toContain(lv.fxRegime);
    expect(typeof lv.emergency).toBe('boolean');
  });
});

describe('округа в сетевой партии: стройки и ответы на события', () => {
  const seat = (room, seats) => ({ ...room, seats: { ...room.seats, ...Object.fromEntries(seats.map((sx) => [sx, `tok-${sx}`])) } });
  const mofSub = (room, extra) => ({ decisions: { ...room.decisions, ...extra }, president: null, note: '' });
  const presSub = (room, region) => ({ decisions: { ...room.decisions }, note: '',
    president: { actions: [], appointCb: null, appointMof: null, directive: null, directiveStrength: 1, region } });

  it('живой Минфин запускает стройку', () => {
    const room = seat(newRoom({ president: null }), ['ministry_finance']);
    const next = resolveQuarter({ ...room, submissions: { ministry_finance: mofSub(room, { startProject: 'metro' }) } });
    expect(next.economy.projects.map((p) => p.id)).toContain('metro');
  });

  it('живой президент решает поверх Минфина', () => {
    const room = seat(newRoom(), ['ministry_finance', 'president']);
    const next = resolveQuarter({ ...room, submissions: {
      ministry_finance: mofSub(room, { startProject: 'metro' }),
      president: presSub(room, { startProject: 'railway', regionResponse: null }) } });
    expect(next.economy.projects.map((p) => p.id)).toEqual(['railway']);
  });

  it('сервер отбрасывает несуществующие стройки, недопустимые сейчас и чужие ответы', () => {
    const room = newRoom();
    const e = { ...room.economy, projectsBuilt: ['metro'],
      regionEvent: { id: 'drought', region: 'agri', options: [{ id: 'import' }, { id: 'wait' }] } };
    expect(sanitizeRegionPlan({ startProject: 'moonbase', regionResponse: 'import' }, e)).toEqual({ startProject: null, regionResponse: 'import', integrate: null });
    expect(sanitizeRegionPlan({ startProject: 'metro', regionResponse: 'pay' }, e)).toEqual({ startProject: null, regionResponse: null, integrate: null });
    expect(sanitizeRegionPlan({ startProject: 'railway' }, { ...e, regionEvent: null })).toEqual({ startProject: 'railway', regionResponse: null, integrate: null });
    // программа интеграции: только присоединённые области
    expect(sanitizeRegionPlan({ integrate: ['halvik', 'capital', 'moon'] }, { ...e, annexed: ['mines'] }).integrate).toEqual(['halvik']);
  });
});

describe('наступательная операция в сетевой партии', () => {
  const seat = (room, seats) => ({ ...room, seats: { ...room.seats, ...Object.fromEntries(seats.map((sx) => [sx, `tok-${sx}`])) } });
  const war = (room) => ({ ...room, economy: { ...room.economy, warQuartersLeft: 6, warType: 'offensive', regionEventCooldown: 99 } });
  const presSub = (room, warOrder) => ({ decisions: { ...room.decisions }, note: '',
    president: { actions: [], appointCb: null, appointMof: null, directive: null, directiveStrength: 1, region: {}, warOrder } });

  it('приказ живого президента исполняется, недоступная цель заменяется доступной', () => {
    const room = war(seat(newRoom(), ['president']));
    // без случайной контратаки: она могла откатить продвижение до нуля
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const next = resolveQuarter({ ...room, submissions: { president: presSub(room, { target: 'mines', stance: 'assault' }) } });
    vi.restoreAllMocks();
    expect(next.economy.warCampaign.last).toMatchObject({ target: 'mines', stance: 'assault' });
    expect(next.economy.warCampaign.progress.mines).toBeGreaterThan(0);
  });

  it('за пустое президентское место командует бот по характеру', () => {
    const room = war(newRoom({ president: { persona: 'strongman' } }));
    const next = resolveQuarter({ ...room, submissions: {} });
    expect(next.economy.warCampaign.last.stance).toBe('assault');
  });
});

describe('штаб кампании в сетевой партии', () => {
  const seat = (room, seats) => ({ ...room, seats: { ...room.seats, ...Object.fromEntries(seats.map((sx) => [sx, `tok-${sx}`])) } });
  const polls = (room) => ({ ...room, economy: { ...room.economy, quartersToElection: 3, regionEventCooldown: 99 } });
  const presSub = (room, campaignPlan) => ({ decisions: { ...room.decisions }, note: '',
    president: { actions: [], appointCb: null, appointMof: null, directive: null, directiveStrength: 1, region: {}, warOrder: null, campaignPlan } });
  const total = (spend) => Object.values(spend || {}).reduce((a, b) => a + b, 0);

  it('живой президент ставит штабы, лишние и выдуманные области отбрасываются', () => {
    const room = polls(seat(newRoom(), ['president']));
    const next = resolveQuarter({ ...room, submissions: { president: presSub(room, { agri: 9, moon: 2 }) } });
    expect(next.economy.campaignSpend).toEqual({ agri: 4 });
  });

  it('за пустое президентское место штабы расставляет штаб власти', () => {
    const room = polls(newRoom());
    const next = resolveQuarter({ ...room, submissions: {} });
    expect(total(next.economy.campaignSpend)).toBe(4);
  });

  it('вне окна опросов кампания ничего не тратит', () => {
    const room = seat(newRoom(), ['president']);
    const next = resolveQuarter({ ...room, economy: { ...room.economy, quartersToElection: 10 },
      submissions: { president: presSub(room, { agri: 4 }) } });
    expect(total(next.economy.campaignSpend)).toBe(0);
  });
});
