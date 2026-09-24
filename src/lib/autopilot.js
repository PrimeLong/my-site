/* Автопилот страны: квартал экономики без игрока за ведомства. ЦБ, Минфин и
   президент — боты со своими характерами, война, переговоры, кампания и карта
   решаются теми же ботами, что и в одиночной игре. Нужен тайкуну предпринимателя:
   там страна живёт фоном, пока игрок строит своё дело. */
import {
  botCentralBank, botFinanceMinistry, botPresident, processPresidentialDirective, redescribeCbAction,
  redescribeMofAction, botWarOrder, botDefenseOrder, botTreaty, botCampaignPlan, simulateQuarter,
  defaultDecisions, makeImpulse, clamp, PRES_DIRECTIVE_COST, personaAfterElection, getCbPersona, getMofPersona,
  quarterLabel, makeInitialEconomy,
} from './engine.js';

export function makeCountry({ scenario = 'sandbox', difficulty = 'medium', cbPersona = 'pragmatic',
  mofPersona = 'technocrat', presPersona = 'technocrat', president = true } = {}) {
  const economy = makeInitialEconomy(scenario);
  return {
    economy, prev: economy, quarterIndex: 1, difficulty, scenario,
    cbPersona, mofPersona, presPersona, president,
    pendingImpulses: [], eventCooldowns: {}, stories: [], presMemo: { lastReqId: null, ago: 99 },
    decisions: defaultDecisions(economy),
  };
}

/* Один квартал. Возвращает новое состояние страны и новости квартала (уже с
   решениями ботов), чтобы тайкун мог показать их в своей ленте. */
export function advanceCountry(country) {
  const { economy, difficulty, quarterIndex } = country;
  let { cbPersona, mofPersona } = country;
  const cbAction0 = botCentralBank(economy, cbPersona, difficulty);
  const mofAction0 = botFinanceMinistry(economy, mofPersona, difficulty);
  let cbAction = cbAction0; let mofAction = mofAction0;
  let eff = { ...country.decisions, ...cbAction.decisions, ...mofAction.decisions };
  const extraImpulses = [];

  // президент-бот: указы, реформы, назначения — движком, указание ведомству — здесь
  let plan = null;
  if (country.president) {
    plan = botPresident(economy, country.presPersona, difficulty, {
      playerBranch: null, cooldowns: country.eventCooldowns, cbPersonaId: cbPersona, mofPersonaId: mofPersona,
      lastReqId: country.presMemo.lastReqId, lastDirectiveAgo: country.presMemo.ago,
    });
    const appoint = plan.appointBot
      ? { [plan.appointBot.kind === 'central_bank' ? 'appointCb' : 'appointMof']: plan.appointBot.persona } : {};
    eff = { ...eff, presidentActive: true, presidentActions: plan.actions, presidentPatience: plan.persona.patience, ...appoint };
    if (plan.directive && !plan.directive.toPlayer) {
      const res = processPresidentialDirective(plan.directive.reqId, economy, cbPersona, mofPersona, eff);
      if (res) {
        eff = { ...res.decisions, presidentActive: true, presidentActions: plan.actions,
          presidentPatience: plan.persona.patience, presidentExtraSpend: PRES_DIRECTIVE_COST, ...appoint };
        if (res.toCb) cbAction = redescribeCbAction(economy, cbPersona, eff);
        else mofAction = redescribeMofAction(economy, mofPersona, eff);
        if (res.credibilityHit) {
          extraImpulses.push(makeImpulse('cbCredibilityPush', res.credibilityHit,
            'Центральный банк исполнил указание президента', 'fast', difficulty, 'other'));
        }
      }
    }
  }
  if (economy.warType === 'offensive' && (economy.warQuartersLeft || 0) > 0) {
    eff = { ...eff, warOrder: country.president ? botWarOrder(economy, country.presPersona) : null };
  }
  if (economy.warType === 'revanche' && (economy.warQuartersLeft || 0) > 0) {
    eff = { ...eff, warOrder: country.president ? botDefenseOrder(economy, country.presPersona) : null };
  }
  if (economy.peaceTalks) eff = { ...eff, treaty: botTreaty(economy, country.president ? country.presPersona : 'technocrat') };
  eff = { ...eff, campaignPlan: botCampaignPlan(economy) };

  const cbStance = clamp((eff.keyRate - economy.inflationExpectations - economy.rStar) / 3, -1, 1);
  const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6
    - (eff.vatRate - economy.vatRate + eff.incomeTaxRate - economy.incomeTaxRate) * 0.3, -1, 1);
  const result = simulateQuarter({
    economy: { ...economy, cbStance, mofStance },
    decisions: eff,
    pendingImpulses: extraImpulses.length ? [...country.pendingImpulses, ...extraImpulses] : country.pendingImpulses,
    eventCooldowns: country.eventCooldowns, difficulty, quarterIndex, stories: country.stories,
    botAction: cbAction, botActions: [mofAction], publicMode: true,
  });

  // кадры: назначения президента и смена руководства после проигранных выборов
  if (plan && plan.appointBot) {
    if (plan.appointBot.kind === 'central_bank') cbPersona = plan.appointBot.persona; else mofPersona = plan.appointBot.persona;
  }
  const er = result.economy.electionResult;
  if (er && er !== 'incumbent') {
    const np = personaAfterElection('ministry_finance', result.economy);
    if (np !== mofPersona) {
      mofPersona = np;
      result.newsEntries.unshift({ id: `pers${quarterIndex}`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `НОВЫЙ МИНИСТР ФИНАНСОВ: ${getMofPersona(np).name.toUpperCase()}`, text: getMofPersona(np).desc });
    }
    if (er === 'landslide') {
      const nc = personaAfterElection('central_bank', result.economy);
      if (nc !== cbPersona) {
        cbPersona = nc;
        result.newsEntries.unshift({ id: `persc${quarterIndex}`, cat: 'cb', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: `СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА: ${getCbPersona(nc).name.toUpperCase()}`, text: getCbPersona(nc).desc });
      }
    }
  }
  const presMemo = plan && plan.directive
    ? { lastReqId: plan.directive.reqId, ago: 0 }
    : { lastReqId: country.presMemo.lastReqId, ago: Math.min(99, country.presMemo.ago + 1) };
  return {
    country: {
      ...country, economy: result.economy, prev: economy, quarterIndex: quarterIndex + 1,
      cbPersona, mofPersona, presMemo,
      pendingImpulses: result.pendingImpulses, eventCooldowns: result.eventCooldowns, stories: result.stories,
      decisions: defaultDecisions(result.economy, eff),
    },
    news: result.newsEntries,
  };
}
