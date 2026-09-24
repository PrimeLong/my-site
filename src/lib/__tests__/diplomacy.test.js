import { describe, it, expect } from 'vitest';
import {
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  RELATIONS_START, relationsOf, diploActionAvailable, deshtWarMultiplier, diplomacyStep, botDiplomacy,
  sanitizeDiplomacy, neighborEventView, PRES_BY_ID,
} from '../engine.js';
import { withSeededRandom } from '../catalog.js';

const quarter = (economy, diplomacy, extra = {}) => simulateQuarter({
  economy, decisions: { ...defaultDecisions(economy), diplomacy, ...extra }, pendingImpulses: [], eventCooldowns: {},
  difficulty: 'medium', quarterIndex: 4, stories: [], noEvents: true,
});

describe('живые соседи: отношения как ресурс', () => {
  it('партия начинается с отношениями по умолчанию, и они сохраняются после квартала', () => {
    const e = makeInitialEconomy();
    expect(e.relations).toEqual(RELATIONS_START);
    const r = quarter(e, null);
    ['north', 'west', 'southwest'].forEach((c) => expect(Number.isFinite(r.economy.relations[c])).toBe(true));
  });

  it('торговый договор с Вестравией: договор на 12 кварталов, отношения растут, капитал тратится', () => {
    const e = makeInitialEconomy();
    const r = quarter(e, { action: { country: 'west', kind: 'trade' } });
    expect(r.economy.diploTreaties.west).toBe(11);
    expect(r.economy.relations.west).toBeGreaterThan(e.relations.west + 5);
    expect(r.economy.diploLast).toMatchObject({ country: 'west', kind: 'trade', ok: true });
    expect(r.newsEntries.some((n) => /ТОРГОВЫЙ ДОГОВОР/.test(n.headline))).toBe(true);
  });

  it('договор недоступен при плохих отношениях, а санкции против Вестравии включают прежний механизм санкций', () => {
    const cold = { ...makeInitialEconomy(), relations: { ...RELATIONS_START, west: 30 } };
    expect(diploActionAvailable(cold, 'west', 'trade')).toBe(false);
    expect(sanitizeDiplomacy({ action: { country: 'west', kind: 'trade' } }, cold).action).toBe(null);
    const r = quarter(makeInitialEconomy(), { action: { country: 'west', kind: 'sanctions' } });
    expect(r.economy.sanctionsQuartersLeft).toBe(10);
    expect(r.economy.relations.west).toBeLessThan(40);
  });

  it('с воюющим соседом дипломатии нет', () => {
    const e = { ...makeInitialEconomy(), warQuartersLeft: 3, warType: 'defensive' };
    expect(diploActionAvailable(e, 'southwest', 'aid')).toBe(false);
    expect(diploActionAvailable(e, 'west', 'aid')).toBe(true);
  });

  it('помощь стоит бюджету и заметно улучшает отношения', () => {
    const e = makeInitialEconomy();
    const out = diplomacyStep(e, { diplomacy: { action: { country: 'southwest', kind: 'aid' } } }, 'medium', 4, 55, true, []);
    expect(out.relations.southwest).toBeGreaterThan(e.relations.southwest + 10);
    expect(out.impulses.some((i) => i.channel === 'revenue' && i.values[0] < 0)).toBe(true);
    expect(out.cooldown['aid:southwest']).toBe(4);
  });

  it('ультиматум: принят — Дешт отводит войска; отвергнут — отношения рушатся сильнее', () => {
    const e = { ...makeInitialEconomy(), deshtMobilized: 4 };
    const dec = { diplomacy: { action: { country: 'southwest', kind: 'ultimatum' } } };
    let accepted = null; let refused = null;
    for (let seed = 1; seed < 60 && !(accepted && refused); seed += 1) {
      const out = withSeededRandom(seed, () => diplomacyStep(e, dec, 'medium', 4, 55, true, []));
      if (out.last.ok) accepted = accepted || out; else refused = refused || out;
    }
    expect(accepted.mobilized).toBe(0);
    expect(accepted.calm).toBe(8);
    expect(refused.relations.southwest).toBeLessThan(accepted.relations.southwest);
  });

  it('плохие отношения с Дештом повышают риск нападения, договор и отведённые войска — снижают', () => {
    const warm = { ...makeInitialEconomy(), relations: { ...RELATIONS_START, southwest: 75 } };
    const cold = { ...makeInitialEconomy(), relations: { ...RELATIONS_START, southwest: 10 }, deshtMobilized: 3 };
    expect(deshtWarMultiplier(cold)).toBeGreaterThan(2 * deshtWarMultiplier(warm));
    expect(deshtWarMultiplier({ ...cold, deshtCalm: 5 })).toBeLessThan(deshtWarMultiplier(cold));
  });

  it('Дешт с войсками у границы и отношениями на дне в конце концов нападает сам', () => {
    let attacked = false;
    for (let seed = 1; seed < 40 && !attacked; seed += 1) {
      const e = { ...makeInitialEconomy(), relations: { ...RELATIONS_START, southwest: 5 }, deshtMobilized: 4 };
      const r = withSeededRandom(seed, () => simulateQuarter({ economy: e, decisions: defaultDecisions(e), pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 4, stories: [] }));
      if (r.economy.warType === 'defensive' && r.economy.warQuartersLeft > 0) attacked = true;
    }
    expect(attacked).toBe(true);
  });

  it('соседи-боты начинают конфликт сами: Вестравия при отношениях на дне вводит пошлины', () => {
    let tariffs = false;
    for (let seed = 1; seed < 40 && !tariffs; seed += 1) {
      const e = { ...makeInitialEconomy(), relations: { ...RELATIONS_START, west: 2 } };
      const out = withSeededRandom(seed, () => diplomacyStep(e, {}, 'medium', 4, 55, false, []));
      tariffs = out.news.some((n) => /ПОШЛИНЫ/.test(n[1]));
    }
    expect(tariffs).toBe(true);
  });

  it('событие соседа: без ответа до срока срабатывает вариант по умолчанию, ответ — меняет исход', () => {
    const e = { ...makeInitialEconomy(), neighborEvent: { id: 'loan_request', country: 'west', q: 3, deadline: 4 } };
    expect(neighborEventView(e).options.map((o) => o.id)).toEqual(['lend', 'decline']);
    const byDefault = diplomacyStep(e, {}, 'medium', 4, 55, true, []);
    expect(byDefault.resolved.option).toBe('decline');
    expect(byDefault.event).toBe(null);
    const lend = diplomacyStep(e, { diplomacy: { reply: 'lend' } }, 'medium', 4, 55, true, []);
    expect(lend.relations.west).toBeGreaterThan(byDefault.relations.west + 15);
    // сделка с дедлайном в два квартала не сгорает в первый же квартал
    const deal = { ...makeInitialEconomy(), neighborEvent: { id: 'west_deal', country: 'west', q: 4, deadline: 6 } };
    expect(diplomacyStep(deal, {}, 'medium', 5, 55, true, []).event).not.toBe(null);
  });

  it('старые указы тоже двигают отношения: санкции против партнёра — вниз, торговый блок — вверх', () => {
    const e = makeInitialEconomy();
    const sanc = diplomacyStep(e, {}, 'medium', 4, 55, true, ['sanctions_impose']);
    const bloc = diplomacyStep(e, {}, 'medium', 4, 55, true, ['trade_bloc']);
    expect(sanc.relations.west).toBeLessThan(relationsOf(e).west - 20);
    expect(bloc.relations.west).toBeGreaterThan(relationsOf(e).west + 8);
    expect(PRES_BY_ID.sanctions_impose).toBeTruthy();
  });

  it('бот-президент отвечает на события по характеру и не тратит капитал, которого нет', () => {
    const e = { ...makeInitialEconomy(), neighborEvent: { id: 'border_incident', country: 'southwest', q: 3, deadline: 4 } };
    expect(botDiplomacy(e, 'strongman').reply).toBe('retaliate');
    expect(botDiplomacy(e, 'technocrat').reply).toBe('hush');
    expect(botDiplomacy(e, 'technocrat', 0).action).toBe(null);
  });
});

describe('войну можно объявить любому соседу', () => {
  const declare = (economy, target, seed = 3) => withSeededRandom(seed, () => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), presidentActions: ['war_start'], warTarget: target },
    pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 4, stories: [], noEvents: true,
  }));
  it('объявленная Дешту война: цели в Деште, фронт от Приреченской, отношения рушатся', () => {
    const e = { ...makeInitialEconomy(), politicalCapital: 90 };
    const r = declare(e, 'southwest');
    expect(r.economy.warType).toBe('offensive');
    expect(r.economy.warTarget).toBe('southwest');
    expect(Object.keys(r.economy.warCampaign.progress).sort()).toEqual(['ashkala', 'oil', 'steppe']);
    // квартал войны — отношения с Дештом у дна, с Норландом война не идёт
    const r2 = withSeededRandom(4, () => simulateQuarter({ economy: r.economy, decisions: { ...defaultDecisions(r.economy), warOrder: { target: 'steppe', stance: 'assault' } },
      pendingImpulses: r.pendingImpulses, eventCooldowns: r.eventCooldowns, difficulty: 'medium', quarterIndex: 5, stories: [], noEvents: true }));
    expect(r2.economy.relations.southwest).toBeLessThan(35);
    expect(r2.economy.warCampaign.progress.steppe).toBeGreaterThan(0);
  });
  it('без выбора цели войну объявляют Норланду, как раньше; взятому Норланду — нельзя', () => {
    const e = { ...makeInitialEconomy(), politicalCapital: 90 };
    expect(declare(e, null).economy.warTarget).toBe('north');
    const full = { ...e, annexed: ['pass', 'mines', 'city'] };
    expect(declare(full, 'north').economy.warTarget).not.toBe('north');
  });
  it('Вестравию брать труднее, а торговля с ней рушится каждый квартал войны', () => {
    const base = { ...makeInitialEconomy(), politicalCapital: 90 };
    const w = declare(base, 'west').economy;
    const s = declare(base, 'southwest').economy;
    const step = (e, target) => withSeededRandom(7, () => simulateQuarter({ economy: e, decisions: { ...defaultDecisions(e), warOrder: { target, stance: 'assault' } },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 5, stories: [], noEvents: true })).economy;
    expect(step(w, 'fort').warCampaign.progress.fort).toBeLessThan(step(s, 'steppe').warCampaign.progress.steppe);
  });
});
