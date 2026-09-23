import { describe, it, expect, vi } from 'vitest';
import {
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction,
  clamp, LEVERS, FX_REGIMES, PROMISE_POOL, pickPromises, evaluatePromise,
  POLITICAL_REGIME_INFO, propagandaEditorial, leverPreview, fmtMln, fmtMlnSigned, mlnScale,
  ROLES, PRESIDENT_ACTIONS, PRES_BY_ID, reformShare, politicalCapitalRegen,
  processPresidentialDirective, APPOINT_COST, PRES_DIRECTIVE_COST,
  PRESIDENT_PERSONAS, botPresident, directiveProgress, directiveVerdict, presidentSatisfactionNext, PROMISE_POOL as _POOL,
  askText, REQUESTS, militaryCoupRisk, reqAmount, advanceStories, storyTriggers,
  presActionAvailable, applyPresidentActions, scaleLever, gameChronicle,
  SCENARIOS, PRESS_QUESTIONS, pickPressQuestion,
  MAP_REGIONS, regionStress, regionBlurb, regionVoteShares,
  CAMPAIGN_POINTS, POLL_WINDOW, electionForecast, sanitizeCampaignPlan, botCampaignPlan, swingLabel,
  activeRegions, votingRegions, annexLoyalty, sanitizeIntegration, REGION_PROJECTS, projectBlocker, REGION_EVENTS,
  INTEGRATED_AT, INTEGRATION_COST,
  treatyCost, sanitizeTreaty, botTreaty, revancheGrowth,
  SOCIAL_GROUPS, ACTION_GROUP_EFFECTS, coalitionOf, groupTurnoutShift, groupStatus,
  fmtMoney, fmtIndex,
} from '../engine.js';

function assertFiniteEconomy(economy, label) {
  for (const [key, value] of Object.entries(economy)) {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${label}: ${key} = ${value}`).toBe(true);
    }
  }
}

function runQuarters(n, difficulty = 'medium') {
  let economy = makeInitialEconomy();
  let decisions = defaultDecisions(economy);
  let pendingImpulses = [];
  let eventCooldowns = {};
  let stories = [];
  for (let q = 1; q <= n; q++) {
    const cbAct = botCentralBank(economy, 'pragmatic', difficulty);
    const mofAct = botFinanceMinistry(economy, 'technocrat', difficulty);
    const decisionsForQuarter = { ...decisions, ...cbAct.decisions, ...mofAct.decisions };
    const res = simulateQuarter({
      economy, decisions: decisionsForQuarter, pendingImpulses, eventCooldowns,
      difficulty, quarterIndex: q, stories,
      botAction: cbAct, botActions: [mofAct],
    });
    economy = res.economy;
    pendingImpulses = res.pendingImpulses;
    eventCooldowns = res.eventCooldowns;
    stories = res.stories;
    decisions = defaultDecisions(economy, decisionsForQuarter);
    assertFiniteEconomy(economy, `quarter ${q}`);
  }
  return economy;
}

describe('clamp', () => {
  it('bounds a value to [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('makeInitialEconomy', () => {
  it('produces only finite numeric fields', () => {
    assertFiniteEconomy(makeInitialEconomy(), 'initial');
  });
});

describe('simulateQuarter', () => {
  it('keeps every numeric field finite over a 10-year run (40 кварталов), medium', () => {
    const final = runQuarters(40, 'medium');
    expect(final.gdp).toBeGreaterThan(0);
    expect(final.exchangeRate).toBeGreaterThan(0);
    expect(final.unemployment).toBeGreaterThanOrEqual(0);
  });

  it('stays finite on hard difficulty too (длинные лаги, срывы ожиданий)', () => {
    runQuarters(20, 'hard');
  });

  it('never lets reserves or bank capital go non-finite when key levers are pushed to extremes', () => {
    let economy = makeInitialEconomy();
    let decisions = defaultDecisions(economy);
    for (const lever of LEVERS) {
      if (lever.id in decisions) decisions[lever.id] = lever.max;
    }
    for (const regime of FX_REGIMES) {
      const res = simulateQuarter({
        economy, decisions: { ...decisions, fxRegime: regime.id }, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'hard', quarterIndex: 1, stories: [],
      });
      assertFiniteEconomy(res.economy, `fxRegime=${regime.id}`);
    }
  });
});

describe('rate_hold request (Минфин просит ЦБ не повышать ставку)', () => {
  it('actually caps the hike instead of no-op-ing back to the bot\'s own proposal', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: 2.0, inflation: 5.0,
      inflationExpectations: 5.0, inflationTarget: 4, interestToRevenue: 16 };
    const cbAction = botCentralBank(s, 'dove', 'medium');
    expect(cbAction.decisions.keyRate).toBeGreaterThan(s.keyRate); // ЦБ сам хотел повысить
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_hold', s, 'central_bank', 'dove', eff);
    expect(result.status).toBe('accepted');
    // ставка не должна вырасти выше того, что было до решения ЦБ
    expect(result.decisions.keyRate).toBeLessThanOrEqual(s.keyRate);
  });

  it('leaves a cut alone (hold only blocks hikes, not cuts)', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: -2.0, inflation: 3.0,
      inflationExpectations: 3.0, inflationTarget: 4, interestToRevenue: 5 };
    const cbAction = botCentralBank(s, 'dove', 'medium');
    expect(cbAction.decisions.keyRate).toBeLessThan(s.keyRate); // ЦБ сам режет ставку
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_hold', s, 'central_bank', 'dove', eff);
    if (result.status !== 'rejected') expect(result.decisions.keyRate).toBe(cbAction.decisions.keyRate);
  });
});

describe('redescribeCbAction (новость после межведомственного запроса)', () => {
  it('describes the final rate, not the one the bot originally proposed', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: -1.5, inflation: 3.5,
      inflationExpectations: 3.5, inflationTarget: 4, unemployment: 6 };
    const cbAction = botCentralBank(s, 'pragmatic', 'medium');
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_cut', s, 'central_bank', 'pragmatic', eff);
    expect(result.status).toBe('accepted');
    expect(result.decisions.keyRate).not.toBe(cbAction.decisions.keyRate); // запрос реально что-то изменил
    const redescribed = redescribeCbAction(s, 'pragmatic', result.decisions);
    expect(redescribed.note).toContain(result.decisions.keyRate.toFixed(2));
    expect(redescribed.note).not.toContain(cbAction.decisions.keyRate.toFixed(2));
  });
});

describe('предвыборные обещания (роль «глава государства»)', () => {
  it('picks the requested number of distinct promises with baked-in numeric targets', () => {
    const economy = makeInitialEconomy();
    const promises = pickPromises(economy, 3);
    expect(promises).toHaveLength(3);
    const ids = new Set(promises.map((p) => p.id));
    expect(ids.size).toBe(3); // без повторов
    for (const p of promises) {
      expect(typeof p.target).toBe('number');
      expect(Number.isFinite(p.target)).toBe(true);
      expect(typeof p.text).toBe('string');
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('starts already met for every "don\'t make it worse" ceiling/floor promise', () => {
    // цели для этих обещаний считаются от стартовой экономики, поэтому в момент
    // вступления в должность они обязаны выполняться сами собой — иначе игрок
    // начинал бы уже проигравшим. growth_promise — исключение: это обещание
    // «добиться роста к выборам», а не «не ухудшить», и на старте закономерно не выполнено.
    const economy = makeInitialEconomy();
    for (const def of PROMISE_POOL) {
      const target = def.target(economy);
      const baseline = def.baseline ? def.baseline(economy) : null;
      const promise = { id: def.id, target, baseline };
      const { met } = evaluatePromise(promise, economy);
      expect(met, `${def.id} at term start`).toBe(def.id !== 'growth_promise');
    }
  });

  it('flags a promise as broken once the economy drifts past its target', () => {
    const economy = makeInitialEconomy();
    const promise = pickPromises(economy, 1).find((p) => p.id === 'debt_discipline')
      || { id: 'debt_discipline', target: PROMISE_POOL.find((p) => p.id === 'debt_discipline').target(economy), baseline: null };
    const worse = { ...economy, debtToGdp: promise.target + 20 };
    expect(evaluatePromise(promise, worse).met).toBe(false);
  });
});

describe('noEvents (используется режимом «Обучение»)', () => {
  it('suppresses random crisis events even on hard difficulty over many quarters', () => {
    let economy = makeInitialEconomy();
    let decisions = defaultDecisions(economy);
    let pendingImpulses = [];
    let eventCooldowns = {};
    for (let q = 1; q <= 30; q++) {
      const res = simulateQuarter({
        economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'hard', quarterIndex: q, stories: [], noEvents: true,
      });
      economy = res.economy;
      pendingImpulses = res.pendingImpulses;
      eventCooldowns = res.eventCooldowns;
      decisions = defaultDecisions(economy, decisions);
      /* Проверяем то, что и написано в названии: noEvents глушит СЛУЧАЙНЫЕ
         СОБЫТИЯ. Раньше здесь стояло «activeCrises пуст» — но рецессия и
         прочие кризисы выводятся из порогов самой экономики, а не из события,
         и на hard за 30 кварталов шум (gauss) изредка честно уводил разрыв
         выпуска в спад: тест падал раз в несколько десятков прогонов на
         совершенно правильном поведении движка. */
      expect(economy.activeCrises.filter((c) => c === 'pandemic')).toEqual([]);
      expect(economy.pandemicQuartersLeft || 0).toBe(0);
      expect(economy.warQuartersLeft || 0).toBe(0);
    }
    expect(economy.regime).not.toBe('pandemic');
    expect(economy.regime).not.toBe('war');
  });
});

describe('политический режим и пропаганда', () => {
  it('registers a label for every regime', () => {
    for (const id of ['democracy', 'crisis', 'authoritarian', 'totalitarian']) {
      expect(POLITICAL_REGIME_INFO[id].label).toEqual(expect.any(String));
    }
  });

  it('starts a fresh game in a democratic regime with no propaganda in the editorial', () => {
    const economy = makeInitialEconomy();
    expect(economy.politicalRegime).toBe('democracy');
    expect(propagandaEditorial(economy)).toBeNull();
  });

  it('leaves the editorial untouched under a parliament-president conflict, but rewrites it once the regime turns authoritarian or totalitarian', () => {
    const base = { ...makeInitialEconomy(), warQuartersLeft: 0 };
    expect(propagandaEditorial({ ...base, politicalRegime: 'crisis' })).toBeNull();
    const auth = propagandaEditorial({ ...base, politicalRegime: 'authoritarian' });
    const tot = propagandaEditorial({ ...base, politicalRegime: 'totalitarian' });
    expect(auth.text.length).toBeGreaterThan(0);
    expect(tot.text).not.toEqual(auth.text);
  });

  it('sharpens totalitarian propaganda further once the country is at war', () => {
    const base = { ...makeInitialEconomy(), politicalRegime: 'totalitarian' };
    const peace = propagandaEditorial({ ...base, warQuartersLeft: 0 });
    const war = propagandaEditorial({ ...base, warQuartersLeft: 3 });
    expect(war.text).not.toEqual(peace.text);
    expect(war.text.toLowerCase()).toContain('враг');
  });

  it('rigs the election in favour of the incumbent once the regime has turned authoritarian', () => {
    const economy = { ...makeInitialEconomy(), politicalRegime: 'authoritarian', quartersToElection: 1, approval: 8 };
    const decisions = defaultDecisions(economy);
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(r.economy.electionResult).toBe('incumbent');
  });

  it('holds no election at all under a totalitarian regime — the counter simply stops', () => {
    const economy = { ...makeInitialEconomy(), politicalRegime: 'totalitarian', quartersToElection: 1, approval: 8 };
    const decisions = defaultDecisions(economy);
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(r.economy.electionResult).toBe(null);
    expect(r.economy.quartersToElection).toBe(1);
    expect(r.economy.noElections).toBe(true);
    expect(r.newsEntries.some((n) => /ВЫБОР|ГОЛОСОВАНИ/.test(n.headline))).toBe(false);
  });

  it('escalates democracy -> crisis -> authoritarian -> totalitarian once tension and the odds line up', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // всегда проходит по «эскалационной» ветке
    try {
      const stress = { approval: 5, unemployment: 14, inflation: 16, warQuartersLeft: 4 };
      let economy = { ...makeInitialEconomy(), ...stress };
      let decisions = defaultDecisions(economy);
      let pendingImpulses = []; let eventCooldowns = {};
      const seen = new Set([economy.politicalRegime]);
      let q = 0;
      while (economy.politicalRegime !== 'totalitarian' && q < 40) {
        q += 1;
        const r = simulateQuarter({ economy, decisions, pendingImpulses, eventCooldowns,
          difficulty: 'hard', quarterIndex: q, stories: [] });
        economy = { ...r.economy, ...stress }; // держим давление постоянным, чтобы не зависеть от остальной динамики модели
        pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
        decisions = defaultDecisions(economy, decisions);
        seen.add(economy.politicalRegime);
      }
      expect(economy.politicalRegime).toBe('totalitarian');
      expect(seen.has('crisis')).toBe(true);
      expect(seen.has('authoritarian')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('lets a persistent banking crisis (liquidity crushed, capital never recovering) drag the country out of democracy on its own', () => {
    // ровно сценарий из жалобы: банковский кризис с ликвидностью около нуля — раньше
    // активный кризис экономики не давал напряжённости никакого прямого вклада (только
    // косвенно, через безработицу), так что даже затяжной банковский кризис почти не
    // двигал стрелку к авторитаризму. Здесь форсируется только устойчиво низкий капитал
    // банков (чтобы кризис не рассосался сам собой за пару кварталов) — падение
    // рейтинга, рецессия и долговой стресс дальше нарастают уже сами, без подсказок.
    //
    // Проверяется момент выхода из демократии, а не фиксированный квартал: после
    // исправления двойного дефлирования дохода с капитала кризис разгоняется
    // медленнее, а прибитый в абсолютных единицах капитал со временем перестаёт
    // держать кризис (кредит сжимается, норматив восстанавливается сам). Шум зафиксирован.
    let seed = 7;
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
    let economy = { ...makeInitialEconomy(), approval: 30, bankCapital: 4, bankLiquidity: 0 };
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {};
    let exit = null;
    for (let q = 1; q <= 40 && !exit; q++) {
      const r = simulateQuarter({ economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'medium', quarterIndex: q, stories: [], noEvents: true });
      economy = { ...r.economy, bankCapital: 4 }; // не даём банковскому кризису рассосаться самому
      pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
      decisions = defaultDecisions(economy, decisions);
      if (economy.politicalRegime !== 'democracy') exit = economy;
    }
    spy.mockRestore();
    expect(exit, 'за 40 кварталов банковский кризис так и не вывел страну из демократии').toBeTruthy();
    expect(exit.activeCrises).toContain('banking');
    expect(exit.politicalTension).toBeGreaterThan(60);
  });

  it('lets a catastrophic approval collapse trigger a coup instead of a quiet election defeat', () => {
    // раньше рухнувший в ноль рейтинг всегда тихо заканчивал партию поражением на
    // выборах — до авторитаризма/тоталитаризма дело попросту не успевало дойти
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // худший случай — переворот наверняка проходит
    try {
      const economy = { ...makeInitialEconomy(), politicalRegime: 'democracy', quartersToElection: 1, approval: 0, politicalTension: 80 };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.economy.electionResult).toBe('incumbent');
      expect(r.economy.politicalRegime).toBe('authoritarian');
      expect(r.economy.parliamentDissolved).toBe(true);
      expect(r.newsEntries.some((n) => n.headline.includes('ПЕРЕВОРОТ'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('still lets a mild election loss end in an ordinary defeat when the coup roll does not land', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999); // худший случай для переворота — он не проходит
    try {
      // рейтинг 30 — проигрыш, но не катастрофа: переворота не случается,
      // партия заканчивается обычным поражением на выборах
      const economy = { ...makeInitialEconomy(), politicalRegime: 'democracy', quartersToElection: 1, approval: 30, politicalTension: 10 };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.economy.electionResult).not.toBe('incumbent');
      expect(r.economy.politicalRegime).toBe('democracy');
    } finally {
      spy.mockRestore();
    }
  });

  it('does not announce a real campaign under an authoritarian/totalitarian regime — there is no real race to cover', () => {
    for (const regime of ['authoritarian', 'totalitarian']) {
      const economy = { ...makeInitialEconomy(), politicalRegime: regime, quartersToElection: 3, campaignActive: false };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.newsEntries.some((n) => n.headline.includes('ПРЕДВЫБОРНАЯ КАМПАНИЯ'))).toBe(false);
    }
  });

  it('still announces an ordinary campaign under democracy or a parliament-president conflict', () => {
    for (const regime of ['democracy', 'crisis']) {
      const economy = { ...makeInitialEconomy(), politicalRegime: regime, quartersToElection: 3, campaignActive: false };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.newsEntries.some((n) => n.headline.includes('ПРЕДВЫБОРНАЯ КАМПАНИЯ'))).toBe(true);
    }
  });

  it('does not leak the real approval number in the rigged "unanimous" election result — state media would not print that', () => {
    const economy = { ...makeInitialEconomy(), politicalRegime: 'authoritarian', quartersToElection: 1, approval: 31 };
    const decisions = defaultDecisions(economy);
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    const win = r.newsEntries.find((n) => n.headline.includes('БЕЗ НЕОЖИДАННОСТЕЙ'));
    expect(win).toBeTruthy();
    expect(win.text).not.toContain('31');
  });
});

describe('банковская ликвидность и экстренная поддержка', () => {
  it('scales the liquidity lever\'s effect by its share of GDP, not by its raw slider value', () => {
    // рычаг «liquidity» — в млрд, а диапазон слайдера растёт вместе с ВВП (scaleLever
    // в UI); раньше эффект на bankLiquidity считался от сырого значения слайдера, и
    // на разросшейся экономике один и тот же (в относительных терминах) шаг давал в
    // разы больший скачок индекса 0-100, чем в начале партии
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // обнуляет весь шум формулы (gauss(sigma)=0 при 0.5)
    try {
      const small = makeInitialEconomy(); // nominalGdp ~2000
      const bigGdp = { ...makeInitialEconomy(), nominalGdp: small.nominalGdp * 100 };
      const runLiquidity = (economy, liquidityValue) => {
        const decisions = { ...defaultDecisions(economy), liquidity: liquidityValue };
        const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
          difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
        return r.economy.bankLiquidity;
      };
      const smallEffect = runLiquidity(small, 10) - runLiquidity(small, 0);
      const bigEffect = runLiquidity(bigGdp, 1000) - runLiquidity(bigGdp, 0); // тот же % ВВП, что и 10 при исходном
      expect(bigEffect).toBeCloseTo(smallEffect, 1);
      expect(Math.abs(bigEffect)).toBeLessThan(20); // раньше здесь получались сотни пунктов
    } finally {
      spy.mockRestore();
    }
  });

  it('lets leverPreview show a liquidity-lever effect consistent with the real simulateQuarter result', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const economy = makeInitialEconomy();
      const preview = leverPreview('liquidity', 10, economy, 'medium');
      const liqLine = preview.items.find((i) => i.label === 'Ликвидность банков').text;
      const previewedDelta = parseFloat(liqLine.replace(',', '.'));
      const decisions = { ...defaultDecisions(economy), liquidity: 10 };
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
      const actualDelta = r.economy.bankLiquidity - economy.bankLiquidity;
      // превью не знает о вкладе просрочки/кредитного сжатия того же квартала —
      // сверяем с небольшим запасом на эти второстепенные слагаемые
      expect(Math.abs(previewedDelta - actualDelta)).toBeLessThan(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('actually restores bank liquidity when emergency support is used, not just capital and trust', () => {
    // раньше "Экстренная поддержка банков" поднимала капитал/стабильность/денежную
    // массу, но никак не ликвидность — при её обвале до 0 сообщение "ликвидность
    // восстановлена до X" не было правдой ни на йоту
    const economy = { ...makeInitialEconomy(), bankLiquidity: 0 };
    const withoutHelp = defaultDecisions(economy);
    const withHelp = { ...withoutHelp, emergency: true };
    const rWithout = simulateQuarter({ economy, decisions: withoutHelp, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    const rWith = simulateQuarter({ economy, decisions: withHelp, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(rWith.economy.bankLiquidity).toBeGreaterThan(rWithout.economy.bankLiquidity + 15);
  });
});

describe('дефолт по государственному долгу (решение Минфина)', () => {
  it('lets Минфин declare a default during an actual debt crisis, wiping part of the debt and locking out new borrowing', () => {
    const economy = { ...makeInitialEconomy(), activeCrises: ['debt'], debtToGdp: 120, govDebt: 3000 };
    const decisions = { ...defaultDecisions(economy), sovereignDefault: true };
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(r.economy.justDefaulted).toBe(true);
    expect(r.economy.govDebt).toBeLessThan(economy.govDebt * 0.6);
    expect(r.economy.marketLockoutQuartersLeft).toBeGreaterThan(0);
    expect(r.economy.defaultedEver).toBe(true);
    expect(r.economy.maxDeficitPct).toBeLessThanOrEqual(0.8);
    expect(r.newsEntries.some((n) => n.headline.includes('ДЕФОЛТ'))).toBe(true);
  });

  it('refuses to declare a default outside an actual debt crisis', () => {
    const economy = makeInitialEconomy(); // activeCrises: [], здоровый долг
    const decisions = { ...defaultDecisions(economy), sovereignDefault: true };
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(r.economy.justDefaulted).toBe(false);
    expect(r.economy.defaultedEver).toBe(false);
    expect(r.economy.govDebt).toBeGreaterThan(economy.govDebt * 0.9);
  });

  it('does not let a second default fire while still locked out from the first one', () => {
    let economy = { ...makeInitialEconomy(), activeCrises: ['debt'], debtToGdp: 120, govDebt: 3000 };
    let decisions = { ...defaultDecisions(economy), sovereignDefault: true };
    const r1 = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [] });
    expect(r1.economy.justDefaulted).toBe(true);
    economy = { ...r1.economy, activeCrises: ['debt'] }; // долговой кризис продолжается
    decisions = { ...defaultDecisions(economy, decisions), sovereignDefault: true };
    const r2 = simulateQuarter({ economy, decisions, pendingImpulses: r1.pendingImpulses, eventCooldowns: r1.eventCooldowns,
      difficulty: 'medium', quarterIndex: 2, stories: [] });
    expect(r2.economy.justDefaulted).toBe(false);
    expect(r2.economy.govDebt).toBeGreaterThan(economy.govDebt * 0.9);
  });
});

describe('деньги инвестора в миллионах (fmtMln)', () => {
  it('scales the unit with the amount instead of printing "6118.42 млн"', () => {
    expect(fmtMln(6.5)).toBe('6.50 млн');
    expect(fmtMln(6118.42)).toBe('6.12 млрд');
    expect(fmtMln(2_500_000)).toBe('2.50 трлн');
    expect(fmtMln(-6118.42)).toBe('-6.12 млрд');
    expect(fmtMln(NaN)).toBe('—');
  });

  it('keeps the sign explicit for results and splits value from unit for styled output', () => {
    expect(fmtMlnSigned(3.2)).toBe('+3.20 млн');
    expect(fmtMlnSigned(-1200)).toBe('-1.20 млрд');
    expect(mlnScale(1500)).toEqual({ v: '1.50', unit: 'млрд' });
  });
});

describe('новые торговые инструменты рынка', () => {
  const SERIES = ['bondShortIndex', 'linkerIndex', 'moneyMarketIndex', 'worldEquityIndex'];

  it('starts every new market series at a finite base and keeps it finite over a long run', () => {
    const initial = makeInitialEconomy();
    for (const key of SERIES) expect(Number.isFinite(initial[key]), key).toBe(true);
    const final = runQuarters(40, 'medium');
    for (const key of SERIES) {
      expect(Number.isFinite(final[key]), key).toBe(true);
      expect(final[key], key).toBeGreaterThan(0);
    }
  });

  it('prices short bonds off the two-year yield with a duration near 1.9', () => {
    const economy = makeInitialEconomy();
    const decisions = { ...defaultDecisions(economy), keyRate: economy.keyRate + 4 };
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    const dY2 = r.economy.yield2y - economy.yield2y;
    expect(Math.abs(dY2)).toBeGreaterThan(0.5); // шок ставки действительно двинул короткий конец
    const carry = economy.yield2y / 4;
    const pct = (r.economy.bondShortIndex / economy.bondShortIndex - 1) * 100;
    expect((carry - pct) / dY2).toBeCloseTo(1.9, 1);
  });

  it('moves the short bond more than the ten-year on a policy-rate shock, because the long end is anchored', () => {
    // Не опечатка и не баг: yieldAt() тянет длинный конец к нейтральной ставке, и
    // на ключевую ставку он почти не реагирует. Короткая бумага дешевле по дюрации,
    // но именно она принимает на себя разворот политики — от неё прячутся в
    // денежный рынок, а не наоборот.
    const economy = makeInitialEconomy();
    const decisions = { ...defaultDecisions(economy), keyRate: economy.keyRate + 4 };
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    expect(Math.abs(r.economy.yield2y - economy.yield2y)).toBeGreaterThan(Math.abs(r.economy.yield10y - economy.yield10y));
    expect(Math.abs(r.economy.bondShortIndex / economy.bondShortIndex - 1))
      .toBeGreaterThan(Math.abs(r.economy.bondIndex / economy.bondIndex - 1));
  });

  it('lets inflation-linked bonds gain from a price shock that hurts the plain ten-year', () => {
    const calm = { ...makeInitialEconomy() };
    const hot = { ...makeInitialEconomy(), inflation: 18, inflationExpectations: 16 };
    const run = (e) => simulateQuarter({ economy: e, decisions: defaultDecisions(e), pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true }).economy;
    const linkerCalm = run(calm).linkerIndex / calm.linkerIndex;
    const linkerHot = run(hot).linkerIndex / hot.linkerIndex;
    expect(linkerHot).toBeGreaterThan(linkerCalm);
  });
});

describe('pandemic crisis tracking', () => {
  it('shows up in activeCrises/regime for a few quarters, then clears', () => {
    // pandemicQuartersLeft: 3 здесь эквивалентно "квартал сразу после срабатывания
    // события" (на самом триггере счётчик становится 3 без декремента) — отсюда
    // ещё 2 активных квартала до истечения, всего 3 квартала кризиса от триггера
    let economy = { ...makeInitialEconomy(), pandemicQuartersLeft: 3 };
    let decisions = defaultDecisions(economy);
    const seen = [];
    for (let q = 1; q <= 5; q++) {
      // noEvents: без него случайное событие/переворот того же квартала иногда
      // подмешивал в activeCrises что-то ещё — тест проверяет только таймер
      // пандемии, а не всю ветку случайных событий разом
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: q, stories: [], noEvents: true });
      economy = r.economy;
      decisions = defaultDecisions(economy, decisions);
      seen.push(economy.activeCrises.includes('pandemic'));
    }
    expect(seen).toEqual([true, true, false, false, false]);
    expect(economy.regime).not.toBe('pandemic');
  });
});

/* =========================================================================================
   ПРЕЗИДЕНТ
========================================================================================= */
// прогон президентской партии: оба ведомства ведут боты, игрок отдаёт только указы
function runPresident(actionsAt, quarters, extra) {
  let economy = { ...makeInitialEconomy(), ...extra };
  let pendingImpulses = []; let eventCooldowns = {};
  const rows = [];
  for (let q = 0; q < quarters; q++) {
    const dec = defaultDecisions(economy);
    const cb = botCentralBank(economy, 'pragmatic', 'medium');
    const mof = botFinanceMinistry(economy, 'technocrat', 'medium');
    const decisions = { ...dec, ...cb.decisions, ...mof.decisions, ...actionsAt[q] };
    const r = simulateQuarter({ economy, decisions, pendingImpulses, eventCooldowns,
      difficulty: 'medium', quarterIndex: q, stories: [], botAction: cb, botActions: [mof], noEvents: true });
    economy = r.economy; pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
    rows.push(economy);
  }
  return rows;
}

describe('роль президента', () => {
  it('президент есть в ролях, оба ведомства — боты, ползунков у него нет', () => {
    const pres = ROLES.find((r) => r.id === 'president');
    expect(pres).toBeDefined();
    expect(pres.botRole).toBe('both');
    expect(pres.groups).toEqual([]);
  });

  it('старая роль «глава государства» переименована и осталась ролью без ботов', () => {
    const pm = ROLES.find((r) => r.id === 'full_control');
    expect(pm.title).not.toMatch(/глава государства/i);
    expect(pm.botRole).toBe(null);
    expect(pm.groups).toEqual(['monetary', 'fiscal']);
  });

  it('указ списывает ровно свою цену политического капитала', () => {
    // сравнивать сами остатки нельзя: прирост считается от капитала уже после
    // списания, и обращение к нации к тому же поднимает рейтинг, который в этот
    // прирост входит. Чистая величина — капитал минус прирост этого квартала.
    const spentIn = (e) => 55 - (e.politicalCapital - e.politicalCapitalGain);
    expect(spentIn(runPresident({ 0: { presidentActions: ['address'] } }, 1)[0])).toBeCloseTo(PRES_BY_ID.address.cost, 6);
    expect(spentIn(runPresident({}, 1)[0])).toBeCloseTo(0, 6);
    expect(spentIn(runPresident({ 0: { presidentActions: ['address', 'elite_deal'] } }, 1)[0]))
      .toBeCloseTo(PRES_BY_ID.address.cost + PRES_BY_ID.elite_deal.cost, 6);
  });

  it('решение, на которое не хватает капитала, просто не применяется', () => {
    const poor = { politicalCapital: 5 };
    const rows = runPresident({ 0: { presidentActions: ['pension'] } }, 1, poor);
    expect(rows[0].reforms.pension).toBeUndefined();
    expect(rows[0].politicalCapital).toBeGreaterThan(0);
  });

  it('парламент блокирует реформу при высоком напряжении, списывая только часть капитала', () => {
    const tense = { politicalTension: 70 };
    const rows = runPresident({ 0: { presidentActions: ['education'] } }, 1, tense);
    expect(rows[0].reforms.education).toBeUndefined();
    const spent = 55 - rows[0].politicalCapital + rows[0].politicalCapitalGain;
    expect(spent).toBeCloseTo(Math.round(PRES_BY_ID.education.cost * 0.4), 6);
  });

  it('роспуск парламента и авторитарный режим снимают риск блокировки реформы', () => {
    const dissolved = { politicalTension: 90, parliamentDissolved: true };
    const rowsDissolved = runPresident({ 0: { presidentActions: ['education'] } }, 1, dissolved);
    expect(rowsDissolved[0].reforms.education).toBeDefined();

    const authoritarian = { politicalTension: 90, politicalRegime: 'authoritarian' };
    const rowsAuth = runPresident({ 0: { presidentActions: ['education'] } }, 1, authoritarian);
    expect(rowsAuth[0].reforms.education).toBeDefined();
  });

  it('реформа не действует в квартале объявления и раскрывается годами', () => {
    const rows = runPresident({ 0: { presidentActions: ['education'] } }, 20);
    expect(reformShare(rows[0].reforms, 'education')).toBe(0);
    expect(reformShare(rows[8].reforms, 'education')).toBeGreaterThan(0.4);
    expect(reformShare(rows[8].reforms, 'education')).toBeLessThan(1);
    expect(reformShare(rows[19].reforms, 'education')).toBe(1);
    // человеческий капитал — постоянный эффект, а не затухающий импульс
    expect(rows[19].humanCapitalIndex).toBeGreaterThan(rows[8].humanCapitalIndex);
  });

  it('одноразовую реформу нельзя провести дважды, а капитал за вторую попытку не списывается', () => {
    const rows = runPresident({ 0: { presidentActions: ['deregulation'] }, 4: { presidentActions: ['deregulation'] } }, 6);
    const spentAgain = rows[3].politicalCapital + rows[4].politicalCapitalGain - rows[4].politicalCapital;
    expect(rows[4].reforms.deregulation).toBe(4);
    expect(spentAgain).toBeCloseTo(0, 5);
  });

  it('пенсионная реформа бьёт по рейтингу сразу, а расширяет рабочую силу постепенно', () => {
    // оба прогона — на одной и той же случайности: сравнивается реформа, а не удача
    const seeded = (fn) => { const rnd = Math.random; let x = 12345;
      Math.random = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
      try { return fn(); } finally { Math.random = rnd; } };
    const base = seeded(() => runPresident({}, 16));
    const ref = seeded(() => runPresident({ 2: { presidentActions: ['pension'] } }, 16));
    expect(ref[2].approval).toBeLessThan(base[2].approval - 8);
    expect(ref[15].laborForce).toBeGreaterThan(base[15].laborForce);
    expect(ref[15].potentialGdp).toBeGreaterThan(base[15].potentialGdp);
  });

  it('роспуск парламента указом сразу переводит режим в авторитарный и не отыгрывается сам', () => {
    const rows = runPresident({ 1: { presidentActions: ['dissolve'] } }, 24);
    expect(rows[1].politicalRegime).toBe('authoritarian');
    expect(rows[1].parliamentDissolved).toBe(true);
    expect(rows[1].decreeRule).toBe(true);
    // без отдельного решения президента режим обратно не откатывается
    expect(rows[23].politicalRegime).toBe('authoritarian');
  });

  it('вернуть парламент можно только отдельным решением', () => {
    const rows = runPresident({ 1: { presidentActions: ['dissolve'] }, 12: { presidentActions: ['restore_parliament'] } }, 16);
    expect(rows[11].parliamentDissolved).toBe(true);
    expect(rows[12].parliamentDissolved).toBe(false);
    expect(rows[12].decreeRule).toBe(false);
    expect(rows[12].politicalRegime).not.toBe('authoritarian');
  });

  it('досрочные выборы приближают голосование', () => {
    const rows = runPresident({ 2: { presidentActions: ['snap_election'] } }, 8);
    expect(rows[2].quartersToElection).toBe(2);
    expect(rows[4].electionResult).not.toBe(null);
  });

  it('смена главы ЦБ обнуляет срок и бьёт по доверию тем сильнее, чем она раньше', () => {
    const early = runPresident({ 1: { appointCb: 'hawk' } }, 3);
    const late = runPresident({ 11: { appointCb: 'hawk' } }, 13);
    const base = runPresident({}, 13);
    expect(early[1].cbTenure).toBe(0);
    const earlyHit = base[1].cbCredibility - early[1].cbCredibility;
    const lateHit = base[11].cbCredibility - late[11].cbCredibility;
    expect(earlyHit).toBeGreaterThan(lateHit);
    expect(lateHit).toBeGreaterThan(0);
    // назначение оплачивается тем же капиталом; считаем на первом же квартале,
    // где стартовый капитал заведомо равен 55 и шум прогонов ни при чём
    const first = runPresident({ 0: { appointCb: 'hawk' } }, 1)[0];
    expect(55 - (first.politicalCapital - first.politicalCapitalGain)).toBeCloseTo(APPOINT_COST.central_bank, 6);
  });
});

describe('указания президента ведомствам', () => {
  const setup = (regime) => {
    const economy = { ...makeInitialEconomy(), unemployment: 8, politicalRegime: regime };
    const cb = botCentralBank(economy, 'hawk', 'medium');
    return { economy, decisions: { ...defaultDecisions(economy), ...cb.decisions } };
  };

  it('чем меньше институтов, тем меньше у ЦБ возможности отказать', () => {
    const dem = setup('democracy'); const aut = setup('authoritarian'); const tot = setup('totalitarian');
    const r1 = processPresidentialDirective('rate_cut', dem.economy, 'hawk', 'technocrat', dem.decisions);
    const r2 = processPresidentialDirective('rate_cut', aut.economy, 'hawk', 'technocrat', aut.decisions);
    const r3 = processPresidentialDirective('rate_cut', tot.economy, 'hawk', 'technocrat', tot.decisions);
    expect(r1.score).toBeLessThan(r2.score);
    expect(r2.score).toBeLessThan(r3.score);
    expect(r3.status).toBe('accepted');
  });

  it('исполненное указание ЦБ стоит доверия к нему, а указание Минфину — нет', () => {
    const aut = setup('authoritarian');
    const toCb = processPresidentialDirective('rate_cut', aut.economy, 'hawk', 'technocrat', aut.decisions);
    const toMof = processPresidentialDirective('infra_up', aut.economy, 'hawk', 'technocrat', aut.decisions);
    expect(toCb.toCb).toBe(true);
    expect(toCb.credibilityHit).toBeLessThan(0);
    expect(toMof.toCb).toBe(false);
    expect(toMof.credibilityHit).toBe(0);
  });

  it('у президента есть и жёсткое указание ЦБ, а не только смягчающие', () => {
    const hot = { ...makeInitialEconomy(), inflation: 11, coreInflation: 10, inflationExpectations: 8 };
    const cb = botCentralBank(hot, 'dove', 'medium');
    const decisions = { ...defaultDecisions(hot), ...cb.decisions };
    const hike = processPresidentialDirective('rate_hike', { ...hot, politicalRegime: 'authoritarian' },
      'dove', 'technocrat', decisions);
    expect(hike.toCb).toBe(true);
    expect(hike.status).not.toBe('rejected');
    expect(hike.decisions.keyRate).toBeGreaterThan(decisions.keyRate);
    // при низкой инфляции то же указание ведомство отклоняет
    const calm = makeInitialEconomy();
    const calmCb = botCentralBank(calm, 'dove', 'medium');
    const no = processPresidentialDirective('rate_hike', calm, 'dove', 'technocrat',
      { ...defaultDecisions(calm), ...calmCb.decisions });
    expect(no.status).toBe('rejected');
  });

  it('стоимость указания списывается через presidentExtraSpend', () => {
    const withDirective = runPresident({ 0: { presidentExtraSpend: PRES_DIRECTIVE_COST } }, 1)[0];
    expect(55 - (withDirective.politicalCapital - withDirective.politicalCapitalGain)).toBeCloseTo(PRES_DIRECTIVE_COST, 6);
  });
});

describe('политический капитал', () => {
  it('у капитала есть равновесие: бездействующий президент не копит сотню', () => {
    const rows = runPresident({}, 40);
    const last = rows[rows.length - 1];
    expect(last.politicalCapital).toBeGreaterThan(35);
    expect(last.politicalCapital).toBeLessThan(85);
  });

  it('кризисы и беспорядки уводят прирост в минус, репрессивный режим — в плюс', () => {
    const calm = politicalCapitalRegen({ approval: 55, gdpGrowth: 2.3, potentialGrowth: 2.3,
      activeCrises: [], unrestActive: false, politicalRegime: 'democracy', politicalCapital: 50 });
    const crisis = politicalCapitalRegen({ approval: 25, gdpGrowth: -3, potentialGrowth: 2.3,
      activeCrises: ['banking', 'debt'], unrestActive: true, politicalRegime: 'democracy', politicalCapital: 50 });
    const total = politicalCapitalRegen({ approval: 55, gdpGrowth: 2.3, potentialGrowth: 2.3,
      activeCrises: [], unrestActive: false, politicalRegime: 'totalitarian', politicalCapital: 50 });
    expect(crisis).toBeLessThan(0);
    expect(calm).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(calm);
  });

  it('каталог решений консистентен: уникальные id, положительная цена, есть build', () => {
    const ids = PRESIDENT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    PRESIDENT_ACTIONS.forEach((a) => {
      expect(a.cost).toBeGreaterThan(0);
      expect(typeof a.build).toBe('function');
      expect(PRES_GROUPS).toContain(a.group);
      const built = a.build(makeInitialEconomy(), 'medium');
      expect(Array.isArray(built.impulses)).toBe(true);
      expect(built.news.headline.length).toBeGreaterThan(0);
    });
  });
});
const PRES_GROUPS = ['public', 'reform', 'power', 'war', 'diplomacy'];

describe('президент как третье лицо у ЦБ и Минфина', () => {
  it('характеры описаны полностью и различаются', () => {
    expect(PRESIDENT_PERSONAS.length).toBeGreaterThanOrEqual(4);
    const ids = PRESIDENT_PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PRESIDENT_PERSONAS.forEach((p) => {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.desc.length).toBeGreaterThan(30);
      ['pressure', 'populism', 'reform', 'power', 'patience'].forEach((k) => expect(Number.isFinite(p[k])).toBe(true));
    });
    // популист и реформатор должны тянуть в разные стороны, иначе выбор ничего не значит
    const pop = PRESIDENT_PERSONAS.find((p) => p.id === 'populist');
    const ref = PRESIDENT_PERSONAS.find((p) => p.id === 'reformer');
    expect(pop.populism).toBeGreaterThan(ref.populism);
    expect(ref.reform).toBeGreaterThan(pop.reform);
  });

  it('требует от ветви игрока, а не от послушного бота', () => {
    const e = { ...makeInitialEconomy(), outputGap: -2.5, unemployment: 8 };
    const plan = botPresident(e, 'populist', 'medium', { playerBranch: 'monetary', cooldowns: {} });
    expect(plan.persona.id).toBe('populist');
    if (plan.directive) {
      expect(plan.directive.branch).toBe('monetary');
      expect(plan.directive.toPlayer).toBe(true);
    }
  });

  it('характер решает, чего президент хочет, когда ситуация допускает варианты', () => {
    // цены разгоняются: дисциплинированные требуют ужесточения, популист — чего угодно,
    // только не повышения ставки
    const hot = { ...makeInitialEconomy(), inflation: 6.6, inflationExpectations: 5.6, coreInflation: 6.2, outputGap: 0.8 };
    const ask = (id, e) => {
      const seen = new Set();
      for (let i = 0; i < 120; i++) {
        const p = botPresident(e, id, 'medium', { playerBranch: 'monetary', cooldowns: {} });
        if (p.directive) seen.add(p.directive.reqId);
      }
      return seen;
    };
    expect(ask('technocrat', hot).has('rate_hike')).toBe(true);
    expect(ask('reformer', hot).has('rate_hike')).toBe(true);
    expect(ask('populist', hot).has('rate_hike')).toBe(false);
    // а в явном спаде смягчения хотят все — характер не спорит с очевидным
    const slump = { ...makeInitialEconomy(), outputGap: -1.6, unemployment: 7.2 };
    ['populist', 'reformer', 'technocrat', 'strongman'].forEach((id) => {
      expect(ask(id, slump).has('rate_cut')).toBe(true);
    });
  });

  it('не повторяет требование сразу же, но возвращается к нему позже', () => {
    const e = { ...makeInitialEconomy(), outputGap: -2.5, unemployment: 8 };
    const ctx = { playerBranch: 'fiscal', cooldowns: {} };
    const first = botPresident(e, 'populist', 'medium', ctx);
    expect(first.directive).toBeTruthy();
    const rightAfter = botPresident(e, 'populist', 'medium',
      { ...ctx, lastReqId: first.directive.reqId, lastDirectiveAgo: 0 });
    if (rightAfter.directive) expect(rightAfter.directive.reqId).not.toBe(first.directive.reqId);
    // через несколько кварталов молчания то же требование снова допустимо
    const later = botPresident(e, 'populist', 'medium',
      { ...ctx, lastReqId: first.directive.reqId, lastDirectiveAgo: 5 });
    expect(later.directive).toBeTruthy();
  });

  it('выполнение требования меряется долей, а не «да/нет»', () => {
    const e = makeInitialEconomy();
    const base = defaultDecisions(e);
    const p = (d) => directiveProgress('rate_cut', base, { ...base, keyRate: base.keyRate + d }, e);
    // rate_cut просит снизить ставку на 1 п.п.
    expect(directiveVerdict(p(-1))).toBe('met');
    expect(directiveVerdict(p(-0.75))).toBe('met');
    // половина просьбы — это половина просьбы, а не поблажка
    expect(directiveVerdict(p(-0.5))).toBe('partial');
    expect(directiveVerdict(p(-0.25))).toBe('ignored');
    expect(directiveVerdict(p(0))).toBe('ignored');
    expect(directiveVerdict(p(1))).toBe('ignored');
    expect(directiveProgress('нет такого', base, base, e)).toBe(null);
  });

  it('просьбу «не повышать» выполняют бездействием, а не движением ползунка', () => {
    const e = makeInitialEconomy();
    const base = defaultDecisions(e);
    const p = (d) => directiveProgress('rate_hold', base, { ...base, keyRate: base.keyRate + d }, e);
    expect(directiveVerdict(p(0))).toBe('met');      // не трогал — выполнил
    expect(directiveVerdict(p(-1))).toBe('met');     // снизил — тем более выполнил
    expect(directiveVerdict(p(1.5))).toBe('ignored'); // повысил — нарушил
    // то же для просьбы не наращивать бюджетный импульс
    expect(directiveVerdict(directiveProgress('fiscal_hold', base, base, e))).toBe('met');
    expect(directiveVerdict(directiveProgress('fiscal_hold', base,
      { ...base, govSpending: base.govSpending + 3 }, e))).toBe('ignored');
  });

  it('сила указания меняет и запрошенный объём, и шанс отказа', () => {
    const e = { ...makeInitialEconomy(), outputGap: -2.5, unemployment: 8, politicalRegime: 'authoritarian' };
    const cb = botCentralBank(e, 'pragmatic', 'medium');
    const dec = { ...defaultDecisions(e), ...cb.decisions };
    const soft = processPresidentialDirective('rate_cut', e, 'pragmatic', 'technocrat', dec, 0.5);
    const hard = processPresidentialDirective('rate_cut', e, 'pragmatic', 'technocrat', dec, 2.5);
    expect(hard.score).toBeLessThan(soft.score);
    if (soft.status !== 'rejected' && hard.status === 'accepted') {
      expect(hard.decisions.keyRate).toBeLessThan(soft.decisions.keyRate);
    }
  });

  it('довольство президента растёт за выполнение и падает за игнор', () => {
    const x = { approval: 55, gdpGrowth: 2.3, potentialGrowth: 2.3, activeCrises: [], patience: 1 };
    const met = presidentSatisfactionNext(50, { ...x, directiveMet: true });
    const ignored = presidentSatisfactionNext(50, { ...x, directiveMet: false });
    const quiet = presidentSatisfactionNext(50, { ...x, directiveMet: null });
    expect(met).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThan(ignored);
    expect(ignored).toBeLessThan(50);
    // терпеливый президент наказывает мягче нетерпеливого
    const patient = presidentSatisfactionNext(50, { ...x, directiveMet: false, patience: 1.35 });
    const impatient = presidentSatisfactionNext(50, { ...x, directiveMet: false, patience: 0.55 });
    expect(patient).toBeGreaterThan(impatient);
  });

  it('довольство считается только когда президент в партии есть', () => {
    const e = { ...makeInitialEconomy(), presidentSatisfaction: 60 };
    const run = (extra) => simulateQuarter({ economy: e, decisions: { ...defaultDecisions(e), ...extra },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true }).economy;
    expect(run({}).presidentSatisfaction).toBe(60);
    expect(run({ presidentActive: true, presidentDirectiveMet: false }).presidentSatisfaction).toBeLessThan(60);
  });
});

describe('новости ведомств', () => {
  it('в ленту идёт текст без характера бота в скобках', () => {
    const e = makeInitialEconomy();
    const cb = botCentralBank(e, 'dove', 'medium');
    const mof = botFinanceMinistry(e, 'populist', 'medium');
    // характер бота полезен в панели ведомства и неуместен в новостной ленте
    expect(cb.note).toContain('(Голубь)');
    expect(cb.newsNote).not.toContain('Голубь');
    expect(cb.newsNote.startsWith('Центральный банк ')).toBe(true);
    expect(mof.note).toContain('(Популист)');
    expect(mof.newsNote).not.toContain('Популист');
    expect(mof.newsNote.startsWith('Минфин ')).toBe(true);
  });
});

describe('обещание про уровень жизни', () => {
  it('меряет тот же показатель, что виден в шапке', () => {
    const e = makeInitialEconomy();
    const promise = _POOL.find((p) => p.id === 'living_standards_promise');
    expect(promise.metric(e)).toBe(e.wellbeing);
    expect(promise.describe(promise.target(e))).toContain('Благополучие');
  });
});

describe('выборы считаются голосами, а не рейтингом', () => {
  const vote = (approval, extra) => {
    const economy = { ...makeInitialEconomy(), quartersToElection: 1, approval, ...extra };
    return simulateQuarter({ economy, decisions: { ...defaultDecisions(economy), ...(extra && extra.dec) },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true }).economy;
  };

  it('рейтинг около половины страны — это не поражение', () => {
    // раньше всё, что ниже 50.0, заканчивало партию: 49.6 округлялось в новости
    // до «рейтинг упал до 50», и игрок читал это как издевательство
    let incumbent = 0;
    for (let i = 0; i < 40; i++) if (vote(52).electionResult === 'incumbent') incumbent += 1;
    expect(incumbent).toBeGreaterThan(34);
  });

  it('доля голосов публикуется и отличается от рейтинга', () => {
    const e = vote(60);
    expect(Number.isFinite(e.electionVoteShare)).toBe(true);
    expect(e.electionVoteShare).not.toBe(e.approval);
  });

  it('низкий рейтинг всё ещё проигрывает голоса', () => {
    // именно голоса: сохранить власть при рейтинге 22 можно, но только переворотом,
    // а не победой на выборах — это отдельная ветка модели
    for (let i = 0; i < 40; i++) {
      const e = vote(24);
      expect(e.electionVoteShare).toBeLessThan(50);
      if (e.electionResult === 'incumbent') expect(e.politicalRegime).toBe('authoritarian');
    }
  });

  it('сдержанные обещания добавляют голосов, проваленные — отнимают', () => {
    const mk = (met) => [{ id: 'debt_discipline', label: 'Не наращивать долг',
      target: met ? 999 : 1, baseline: null }];
    const win = (promises) => {
      let n = 0;
      for (let i = 0; i < 30; i++) {
        const economy = { ...makeInitialEconomy(), quartersToElection: 1, approval: 47 };
        const r = simulateQuarter({ economy, decisions: { ...defaultDecisions(economy), promises },
          pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
        if (r.economy.electionResult === 'incumbent') n += 1;
        expect(r.economy.promisesTotal).toBe(promises.length);
      }
      return n;
    };
    expect(win([...mk(true), ...mk(true), ...mk(true)])).toBeGreaterThan(win([...mk(false), ...mk(false), ...mk(false)]));
  });
});

describe('указание с указанной силой', () => {
  const eco = () => makeInitialEconomy();

  it('текст просьбы называет ту величину, которую действительно просят', () => {
    const cut = REQUESTS.find((r) => r.id === 'rate_cut');
    expect(askText(cut, 1)).toContain('на 1 п.п.');
    expect(askText(cut, 0.25)).toContain('на 0,25 п.п.');
    expect(askText(cut, 2)).toContain('на 2 п.п.');
    const infra = REQUESTS.find((r) => r.id === 'infra_up');
    expect(askText(infra, 1)).toContain('1,5% ВВП');
    expect(askText(infra, 2)).toContain('3% ВВП');
  });

  it('частичное согласие на маленькую просьбу всё равно двигает ставку', () => {
    const s = eco();
    const d = defaultDecisions(s);
    // проходим по всем характерам ЦБ: где ответ «частично», ставка обязана измениться
    let sawPartial = false;
    ['dove', 'pragmatic', 'hawk'].forEach((pid) => {
      [0.25, 0.5, 1].forEach((strength) => {
        const r = processPresidentialDirective('rate_cut', s, pid, 'technocrat', d, strength);
        if (!r || r.status === 'rejected') return;
        if (r.status === 'partial') sawPartial = true;
        expect(r.decisions.keyRate, `${pid}/${strength}`).toBeLessThan(d.keyRate);
      });
    });
    expect(sawPartial).toBe(true);
  });

  it('просьба, выполненная ровно, засчитывается полностью', () => {
    const s = eco();
    const d = defaultDecisions(s);
    const done = { ...d, keyRate: d.keyRate - 0.25 };
    expect(directiveVerdict(directiveProgress('rate_cut', d, done, s, 0.25))).toBe('met');
    // и наоборот: ставку не тронули — это не «частично»
    expect(directiveVerdict(directiveProgress('rate_cut', d, d, s, 0.25))).toBe('ignored');
  });

  it('шаг ставки в новостях печатается до сотых', () => {
    const s = makeInitialEconomy();
    const out = simulateQuarter({ economy: s, decisions: { ...defaultDecisions(s), keyRate: s.keyRate + 0.25 },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    const news = out.newsEntries.find((n) => /КЛЮЧЕВУЮ СТАВКУ/.test(n.headline));
    expect(news).toBeTruthy();
    expect(news.text).toContain('+0,25 п.п.');
  });
});

describe('лестница режимов: тоталитаризм как решение', () => {
  it('указ о полном контроле доступен только из авторитарного режима', () => {
    const act = PRES_BY_ID.seize_control;
    expect(act).toBeTruthy();
    expect(act.requires({ politicalRegime: 'democracy', parliamentDissolved: false, warQuartersLeft: 3 })).toBe(false);
    expect(act.requires({ politicalRegime: 'authoritarian', parliamentDissolved: false, warQuartersLeft: 3 })).toBe(false);
    // с этого обновления — только во время войны
    expect(act.requires({ politicalRegime: 'authoritarian', parliamentDissolved: true, warQuartersLeft: 0 })).toBe(false);
    expect(act.requires({ politicalRegime: 'authoritarian', parliamentDissolved: true, warQuartersLeft: 3 })).toBe(true);
  });

  it('указ переводит страну в тоталитарный режим и стоит капитала', () => {
    const s = { ...makeInitialEconomy(), politicalRegime: 'authoritarian', parliamentDissolved: true,
      decreeRule: true, politicalCapital: 90, politicalTension: 40, warQuartersLeft: 4, warType: 'offensive', warByChoice: true };
    const out = simulateQuarter({ economy: s,
      decisions: { ...defaultDecisions(s), presidentActive: true, presidentActions: ['seize_control'] },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 5, stories: [], noEvents: true });
    expect(out.economy.politicalRegime).toBe('totalitarian');
    expect(out.economy.politicalCapital).toBeLessThan(s.politicalCapital);
    assertFiniteEconomy(out.economy, 'после указа о полном контроле');
  });

  it('без капитала указ не проходит', () => {
    const s = { ...makeInitialEconomy(), politicalRegime: 'authoritarian', parliamentDissolved: true,
      decreeRule: true, politicalCapital: 10, politicalTension: 30, warQuartersLeft: 4, warType: 'offensive' };
    const out = simulateQuarter({ economy: s,
      decisions: { ...defaultDecisions(s), presidentActive: true, presidentActions: ['seize_control'] },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 5, stories: [], noEvents: true });
    expect(out.economy.politicalRegime).not.toBe('totalitarian');
  });
});

describe('президент разговаривает с обоими ведомствами', () => {
  it('требования уходят не только ведомству игрока', () => {
    const base = makeInitialEconomy();
    const states = [
      { outputGap: 2.5, inflation: 8, unemployment: 4.5, budgetBalancePctGdp: -5 },
      { outputGap: -3, inflation: 2, unemployment: 9, investmentGrowth: -2 },
      { debtToGdp: 95, budgetBalancePctGdp: -6, interestToRevenue: 18, inflation: 5 },
      {},
    ];
    const seen = new Set();
    states.forEach((patch) => {
      PRESIDENT_PERSONAS.forEach((P) => {
        for (let i = 0; i < 40; i++) {
          const plan = botPresident({ ...base, ...patch, politicalCapital: 80 }, P.id, 'medium',
            { playerBranch: 'monetary', cooldowns: {}, cbPersonaId: 'pragmatic', mofPersonaId: 'technocrat', lastDirectiveAgo: 9 });
          if (plan.directive) seen.add(plan.directive.branch);
        }
      });
    });
    expect(seen.has('monetary')).toBe(true);
    expect(seen.has('fiscal')).toBe(true);
  });

  it('требование к соседнему ведомству помечено как не игроку', () => {
    const base = { ...makeInitialEconomy(), debtToGdp: 95, budgetBalancePctGdp: -6, politicalCapital: 80 };
    const plan = botPresident(base, 'technocrat', 'medium',
      { playerBranch: 'monetary', cooldowns: {}, cbPersonaId: 'pragmatic', mofPersonaId: 'technocrat', lastDirectiveAgo: 9 });
    if (plan.directive && plan.directive.branch === 'fiscal') {
      expect(plan.directive.toPlayer).toBe(false);
      expect(typeof plan.directive.ask).toBe('string');
    }
  });
});

describe('военный переворот как единственный выход при отменённых выборах', () => {
  const repressive = (patch) => ({ ...makeInitialEconomy(), politicalRegime: 'totalitarian',
    parliamentDissolved: true, decreeRule: true, ...patch });

  it('разваливающаяся страна теряет власть не у урны, а через армию', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const economy = repressive({ politicalTension: 95, approval: 6, unemployment: 15, inflation: 30 });
      const r = simulateQuarter({ economy, decisions: defaultDecisions(economy), pendingImpulses: [],
        eventCooldowns: {}, difficulty: 'medium', quarterIndex: 8, stories: [], noEvents: true });
      // при random=0 сначала срабатывает восстание («режим пал»), иначе — армия;
      // в обоих случаях власть потеряна, и это видно снаружи
      expect(['uprising', 'military']).toContain(r.economy.powerLost);
      assertFiniteEconomy(r.economy, 'после потери власти');
    } finally { spy.mockRestore(); }
  });

  it('спокойная страна переворота не видит', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      let economy = repressive({ politicalTension: 10, approval: 70, unemployment: 4.5, inflation: 4 });
      let decisions = defaultDecisions(economy);
      for (let i = 0; i < 12; i++) {
        const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
          difficulty: 'medium', quarterIndex: i + 1, stories: [], noEvents: true });
        expect(r.economy.powerLost).toBe(null);
        economy = r.economy; decisions = defaultDecisions(economy, decisions);
      }
    } finally { spy.mockRestore(); }
  });

  it('два переворота подряд в один квартал невозможны', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      // переворот по итогам выборов уводит в авторитаризм — военный в тот же
      // квартал сверху не накладывается
      const economy = { ...makeInitialEconomy(), politicalRegime: 'democracy', quartersToElection: 1,
        approval: 0, politicalTension: 80 };
      const r = simulateQuarter({ economy, decisions: defaultDecisions(economy), pendingImpulses: [],
        eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.economy.politicalRegime).toBe('authoritarian');
      expect(r.economy.powerLost).toBe(null);
    } finally { spy.mockRestore(); }
  });
});

describe('война как решение президента', () => {
  const warState = (patch) => ({ ...makeInitialEconomy(), politicalCapital: 95, ...patch });
  const quarter = (economy, actions) => simulateQuarter({ economy,
    decisions: { ...defaultDecisions(economy), presidentActive: true, presidentActions: actions },
    pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 3, stories: [], noEvents: true });

  it('указ начинает наступательную войну и помечает её как собственную', () => {
    const r = quarter(warState(), ['war_start']);
    expect(r.economy.warQuartersLeft).toBeGreaterThan(0);
    expect(r.economy.warType).toBe('offensive');
    expect(r.economy.warByChoice).toBe(true);
    expect(r.economy.regime).toBe('war');
    assertFiniteEconomy(r.economy, 'после объявления войны');
  });

  it('своя война подаётся не как кризис, а как решение', () => {
    const r = quarter(warState(), ['war_start']);
    const start = r.newsEntries.find((n) => /ВОЕННОЕ ПОЛОЖЕНИЕ|ВОЕННОЙ ОПЕРАЦИИ/.test(n.headline));
    expect(start).toBeTruthy();
    // ни одна новость о начале войны не идёт под рубрикой кризиса
    expect(r.newsEntries.filter((n) => n.cat === 'crisis' && /ВОЙН/.test(n.headline))).toHaveLength(0);
  });

  it('сплочение вокруг флага поднимает рейтинг, а мобилизация его обваливает', () => {
    const started = quarter(warState({ approval: 55 }), ['war_start']);
    expect(started.economy.approval).toBeGreaterThan(55);
    const mob = quarter({ ...started.economy, politicalCapital: 95 }, ['mobilization']);
    expect(mob.economy.approval).toBeLessThan(started.economy.approval);
    expect(mob.economy.politicalTension).toBeGreaterThan(started.economy.politicalTension);
    expect(mob.economy.warQuartersLeft).toBeGreaterThan(started.economy.warQuartersLeft - 1);
  });

  it('мир заканчивает войну досрочно', () => {
    const started = quarter(warState(), ['war_start']);
    const peace = quarter({ ...started.economy, politicalCapital: 95 }, ['peace_deal']);
    expect(peace.economy.warQuartersLeft).toBe(0);
    expect(peace.economy.regime).not.toBe('war');
    assertFiniteEconomy(peace.economy, 'после мира');
  });

  it('полный контроль над институтами доступен только во время войны', () => {
    const act = PRES_BY_ID.seize_control;
    const base = { politicalRegime: 'authoritarian', parliamentDissolved: true };
    expect(act.requires({ ...base, warQuartersLeft: 0 })).toBe(false);
    expect(act.requires({ ...base, warQuartersLeft: 3 })).toBe(true);
  });
});

describe('переворот случается там, где есть недовольство', () => {
  it('спокойная популярная власть не рискует ничем, даже растратив капитал', () => {
    const calm = { politicalTension: 12, approval: 53, unemployment: 5, inflation: 4,
      nairu: 5, activeCrises: [], politicalCapital: 0 };
    expect(militaryCoupRisk(calm)).toBe(0);
  });

  it('разваливающаяся страна рискует всерьёз', () => {
    const bad = { politicalTension: 75, approval: 20, unemployment: 13, inflation: 25,
      nairu: 5, activeCrises: ['banking', 'currency'], politicalCapital: 0, unrestActive: true };
    expect(militaryCoupRisk(bad)).toBeGreaterThan(0.15);
  });

  it('пустая казна только умножает уже существующее недовольство', () => {
    const base = { politicalTension: 60, approval: 40, unemployment: 7, inflation: 9, nairu: 5, activeCrises: [] };
    const rich = militaryCoupRisk({ ...base, politicalCapital: 80 });
    const broke = militaryCoupRisk({ ...base, politicalCapital: 0 });
    expect(rich).toBeGreaterThan(0);
    expect(broke).toBeGreaterThan(rich);
    expect(broke).toBeLessThan(rich * 2);
  });

  it('тяжёлый кризис не поднимает армию против спокойного и не растратившего популярность лидера', () => {
    // именно этот случай сообщил игрок как незаслуженный переворот: напряжённость
    // 38 (ниже порога 40 у pressure) и рейтинг 52 (выше порога 45 у weakness) —
    // нищета и кризисы раньше суммировались в риск независимо от того, что за
    // лидера некому было выступать против
    const stressedButPopular = { politicalTension: 38, approval: 52, unemployment: 14, inflation: 30,
      nairu: 5, activeCrises: ['banking', 'currency'], politicalCapital: 55, unrestActive: false };
    expect(militaryCoupRisk(stressedButPopular)).toBe(0);
  });
});

describe('одно решение по ставке — одна новость', () => {
  it('сводка ЦБ и общая новость о шаге не печатаются вместе', () => {
    let economy = { ...makeInitialEconomy(), inflation: 9, coreInflation: 8.4, inflationExpectations: 7.5 };
    let decisions = defaultDecisions(economy);
    let stories = []; let pendingImpulses = []; let eventCooldowns = {};
    for (let q = 0; q < 6; q++) {
      const act = botCentralBank(economy, 'hawk', 'medium');
      const r = simulateQuarter({ economy, decisions: { ...decisions, ...act.decisions }, pendingImpulses,
        eventCooldowns, difficulty: 'medium', quarterIndex: q + 1, stories, botAction: act, noEvents: true });
      const rateNews = r.newsEntries.filter((n) => /СТАВК/.test(n.headline) && n.cat === 'cb');
      expect(rateNews.length, `квартал ${q + 1}: ${JSON.stringify(rateNews.map((n) => n.headline))}`).toBeLessThanOrEqual(1);
      economy = r.economy; decisions = defaultDecisions(economy, decisions);
      stories = r.stories; pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
    }
  });
});

/* Регресс на класс бага, который дважды находился и чинился вручную
   (infra_up/vat_relief/defense_up, потом ещё 4 запроса без числа в тексте
   вовсе): scale.base определяет число, напечатанное в askText, а apply()
   отдельно кодирует, на сколько реально двигается рычаг при полном согласии
   (k=1). Если множитель в apply() разойдётся со scale.base — а раньше
   расходился, — игрок делает ровно то, что попросили, но игра пишет
   «частично» или «отказ». Эти тесты проверяют сам факт совпадения, а не
   какое-то конкретное число: если кто-то сознательно перебалансирует один
   коэффициент, тест заставит обновить и второй. */
describe('processRequest — коэффициент в apply() совпадает со scale.base из askText', () => {
  const cases = [
    { id: 'infra_up', lever: 'govInvestment', sign: 1 },
    { id: 'transfers_freeze', lever: 'transfers', sign: -1 },
    { id: 'tax_relief_business', lever: 'profitTaxRate', sign: -1 },
    { id: 'vat_relief', lever: 'vatRate', sign: -1 },
    { id: 'defense_up', lever: 'shareDefense', sign: 1 },
    { id: 'capreq_ease', lever: 'capitalRequirement', sign: -1 },
  ];
  for (const { id, lever, sign } of cases) {
    it(`${id}: при k=1 сдвигает ${lever} ровно на scale.base (знак ${sign > 0 ? '+' : '-'})`, () => {
      const req = REQUESTS.find((r) => r.id === id);
      const economy = makeInitialEconomy();
      const decisions = defaultDecisions(economy);
      const n = reqAmount(req, 1);
      const applied = req.apply(decisions, 1, economy);
      expect(applied[lever] - decisions[lever]).toBeCloseTo(sign * n, 5);
    });
  }

  it('deficit_cut: два рычага, каждый со своим множителем (2× и 1.5× из текста просьбы)', () => {
    const req = REQUESTS.find((r) => r.id === 'deficit_cut');
    const economy = makeInitialEconomy();
    const decisions = defaultDecisions(economy);
    const n = reqAmount(req, 1);
    const applied = req.apply(decisions, 1, economy);
    expect(applied.govSpending - decisions.govSpending).toBeCloseTo(-2 * n, 5);
    expect(applied.transfers - decisions.transfers).toBeCloseTo(-1.5 * n, 5);
  });

  it('fiscal_hold: полное согласие гасит запланированное расширение до нуля роста', () => {
    const req = REQUESTS.find((r) => r.id === 'fiscal_hold');
    const decisions = { govSpending: 4, transfers: 3, govInvestment: 2 };
    const applied = req.apply(decisions, 1);
    expect(applied.govSpending).toBe(0);
    expect(applied.transfers).toBe(0);
    expect(applied.govInvestment).toBe(0);
  });

  it('fiscal_hold: уже отрицательный (консолидирующий) план не трогает', () => {
    const req = REQUESTS.find((r) => r.id === 'fiscal_hold');
    const decisions = { govSpending: -2, transfers: -1, govInvestment: -3 };
    expect(req.apply(decisions, 1)).toEqual(decisions);
  });

  for (const [id, , sign] of [['rate_cut', 'keyRate', -1], ['rate_hike', 'keyRate', 1]]) {
    it(`${id}: полное согласие двигает ставку ровно на scale.base п.п. (с учётом сетки 0.25)`, () => {
      const req = REQUESTS.find((r) => r.id === id);
      const economy = { ...makeInitialEconomy(), keyRate: 6 };
      const decisions = { ...defaultDecisions(economy), keyRate: 6 };
      const n = reqAmount(req, 1);
      const applied = req.apply(decisions, 1, economy);
      expect(applied.keyRate - decisions.keyRate).toBeCloseTo(sign * n, 5);
    });
  }

  // liquidity_help/fx_support масштабируют рычаг по размеру экономики
  // (gdpLeverScale) — точный коэффициент не выразить без доступа к economy
  // внутри apply(), поэтому здесь проверяем то, что можно проверить снаружи:
  // эффект растёт линейно с силой запроса, а не залипает или квадратично разгоняется
  for (const [id, lever, sign] of [['liquidity_help', 'liquidity', 1], ['fx_support', 'fxIntervention', -1]]) {
    it(`${id}: эффект на ${lever} линейно растёт с силой запроса`, () => {
      const req = REQUESTS.find((r) => r.id === id);
      const economy = makeInitialEconomy();
      const decisions = defaultDecisions(economy);
      const d1 = req.apply(decisions, 1, economy)[lever] - decisions[lever];
      const d2 = req.apply(decisions, 2, economy)[lever] - decisions[lever];
      expect(Math.sign(d1)).toBe(sign);
      expect(d2).toBeCloseTo(d1 * 2, 5);
    });
  }
});

describe('storyTriggers / STORY_TEMPLATES — сюжет «Заём про запас» (bond_issuance)', () => {
  it('запускается только при размещении от 0.5% ВВП, а не при символическом', () => {
    const prev = makeInitialEconomy();
    const big = { ...defaultDecisions(prev), bondIssuance: prev.nominalGdp * 0.01 };
    const small = { ...defaultDecisions(prev), bondIssuance: prev.nominalGdp * 0.001 };
    expect(storyTriggers(prev, prev, big, [], {})).toContain('bond_issuance');
    expect(storyTriggers(prev, prev, small, [], {})).not.toContain('bond_issuance');
  });

  it('не запускается повторно, пока сюжет ещё активен или на кулдауне', () => {
    const prev = makeInitialEconomy();
    const decisions = { ...defaultDecisions(prev), bondIssuance: prev.nominalGdp * 0.02 };
    const active = [{ tplId: 'bond_issuance', nextIdx: 0, wait: 1 }];
    expect(storyTriggers(prev, prev, decisions, active, {})).not.toContain('bond_issuance');
    expect(storyTriggers(prev, prev, decisions, [], { 'story:bond_issuance': 3 })).not.toContain('bond_issuance');
  });

  it('advanceStories выдаёт двухшаговый сюжет с правильным quarterIndex и storyId', () => {
    const economy = makeInitialEconomy();
    const active = [{ tplId: 'bond_issuance', nextIdx: 0, wait: 0 }];
    const step1 = advanceStories(active, economy, 5);
    expect(step1.news).toHaveLength(1);
    expect(step1.news[0].storyId).toBe('bond_issuance');
    expect(step1.news[0].q).toBe(5);
    expect(step1.stories).toHaveLength(1); // ждёт второго шага, gap:2 → wait:1
    const step2 = advanceStories(step1.stories, economy, 6);
    expect(step2.news).toHaveLength(0); // ещё ждёт
    const step3 = advanceStories(step2.stories, economy, 7);
    expect(step3.news).toHaveLength(1);
    expect(step3.stories).toHaveLength(0); // сюжет закончен
  });
});

describe('сценарии — другая стартовая точка того же движка', () => {
  it('без сценария (или с sandbox) makeInitialEconomy не меняется', () => {
    const plain = makeInitialEconomy();
    const sandbox = makeInitialEconomy('sandbox');
    expect(sandbox).toEqual(plain);
  });

  it('валютный кризис стартует с низкими резервами и уже разогнанной инфляцией', () => {
    const plain = makeInitialEconomy();
    const crisis = makeInitialEconomy('currency_crisis');
    expect(crisis.reserves).toBeLessThan(plain.reserves);
    expect(crisis.inflation).toBeGreaterThan(plain.inflation);
    assertFiniteEconomy(crisis, 'currency_crisis');
  });

  it('ипотечный пузырь стартует с раздутым кредитом и слабым капиталом банков', () => {
    const plain = makeInitialEconomy();
    const bubble = makeInitialEconomy('housing_bubble');
    expect(bubble.creditVolume).toBeGreaterThan(plain.creditVolume);
    expect(bubble.bankCapitalAdequacy).toBeLessThan(plain.bankCapitalAdequacy);
    assertFiniteEconomy(bubble, 'housing_bubble');
  });

  it('гиперинфляция стартует ниже дефолтного порога 40%, не отдавая мгновенное поражение', () => {
    const hyper = makeInitialEconomy('hyperinflation');
    expect(hyper.inflation).toBeLessThan(40);
    expect(hyper.inflation).toBeGreaterThan(20);
    assertFiniteEconomy(hyper, 'hyperinflation');
  });

  it('неизвестный id сценария не роняет makeInitialEconomy', () => {
    expect(() => makeInitialEconomy('no-such-scenario')).not.toThrow();
    expect(makeInitialEconomy('no-such-scenario')).toEqual(makeInitialEconomy());
  });

  it('каждый сценарий из списка считается движком без NaN/Infinity после квартала', () => {
    SCENARIOS.forEach((sc) => {
      const economy = makeInitialEconomy(sc.id);
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
      assertFiniteEconomy(r.economy, `scenario:${sc.id}`);
    });
  });
});

describe('пресс-конференция — вопрос выбирается детерминированно, ответ двигает доверие', () => {
  it('pickPressQuestion детерминирован: тот же (economy, quarterIndex) даёт тот же вопрос', () => {
    const economy = makeInitialEconomy();
    const a = pickPressQuestion(economy, 3);
    const b = pickPressQuestion(economy, 3);
    expect(a).toBe(b); // одна и та же ссылка на объект из PRESS_QUESTIONS
    expect(a).not.toBeNull();
  });

  it('без ответа (pressAnswer не задан) пресс-конференция не влияет на экономику', () => {
    const economy = makeInitialEconomy();
    const decisions = defaultDecisions(economy);
    expect(decisions.pressAnswer).toBeNull();
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    expect(r.newsEntries.some((n) => n.headline.startsWith('ПРЕСС-КОНФЕРЕНЦИЯ'))).toBe(false);
  });

  it('выбранный ответ создаёт новость и двигает нужный канал (govTrust вверх при честном признании)', () => {
    const economy = makeInitialEconomy();
    const q = pickPressQuestion(economy, 1);
    const honestOpt = q.options.find((o) => o.id === 'honest' || o.id === 'engage' || o.id === 'own_it');
    expect(honestOpt).toBeDefined();
    const decisions = { ...defaultDecisions(economy), pressAnswer: honestOpt.id };
    const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    expect(r.newsEntries.some((n) => n.headline.startsWith('ПРЕСС-КОНФЕРЕНЦИЯ') && n.text.includes(honestOpt.quote))).toBe(true);
    assertFiniteEconomy(r.economy, 'press-answered');
  });

  it('каждый вопрос и каждый вариант ответа считается движком без NaN/Infinity', () => {
    const economy = makeInitialEconomy();
    PRESS_QUESTIONS.forEach((q) => {
      q.options.forEach((opt) => {
        const decisions = { ...defaultDecisions(economy), pressAnswer: opt.id };
        // подбираем quarterIndex, на котором именно этот вопрос будет выбран
        let qi = 0;
        while (pickPressQuestion(economy, qi) !== q && qi < 50) qi++;
        const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
          difficulty: 'medium', quarterIndex: qi, stories: [], noEvents: true });
        assertFiniteEconomy(r.economy, `press:${q.id}:${opt.id}`);
      });
    });
  });

  it('неизвестный pressAnswer (устаревший id из старого сохранения) тихо игнорируется', () => {
    const economy = makeInitialEconomy();
    const decisions = { ...defaultDecisions(economy), pressAnswer: 'no-such-option' };
    expect(() => simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true })).not.toThrow();
  });
});

describe('карта страны — округа реагируют на настоящее состояние экономики', () => {
  it('семь округов, каждый с весами, суммирующими вклад в 0..100', () => {
    expect(MAP_REGIONS).toHaveLength(7);
    const economy = makeInitialEconomy();
    MAP_REGIONS.forEach((region) => {
      const s = regionStress(region, economy);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });

  it('спокойная экономика — все округа в спокойном тоне', () => {
    const calm = { ...makeInitialEconomy(), politicalTension: 5, bankingRisk: 5, debtRisk: 5,
      currencyRisk: 5, recessionRisk: 5, inflationRisk: 5, approval: 60 };
    MAP_REGIONS.forEach((region) => {
      const b = regionBlurb(region, calm);
      expect(b.tier).toBe('calm');
      expect(b.text.length).toBeGreaterThan(0);
    });
  });

  it('разваливающаяся экономика — округа переходят в кризисный тон, а не молчат', () => {
    const bad = { ...makeInitialEconomy(), politicalTension: 90, bankingRisk: 90, debtRisk: 90,
      currencyRisk: 90, recessionRisk: 90, inflationRisk: 90, approval: 15,
      exchangeRate: 210, unemployment: 18, nairu: 5, inflation: 40, riskPremium: 9 };
    MAP_REGIONS.forEach((region) => {
      const b = regionBlurb(region, bad);
      expect(b.tier).toBe('crisis');
      expect(b.text).not.toMatch(/undefined|NaN/);
    });
  });

  it('средний результат по округам сходится с общенациональным', () => {
    // иначе карта и новость о выборах показывали бы разные проценты
    const economy = makeInitialEconomy();
    [35, 47.4, 50, 61.2, 88].forEach((national) => {
      const rows = regionVoteShares(economy, national, false);
      expect(rows).toHaveLength(MAP_REGIONS.length);
      const mean = rows.reduce((a, b) => a + b.share, 0) / rows.length;
      expect(mean).toBeCloseTo(national, 6);
    });
  });

  it('округ, которому живётся хуже среднего, голосует за власть хуже среднего', () => {
    // промышленный пояс завязан на рецессию: при глубоком спаде он должен
    // отвернуться от власти сильнее, чем село, которого спад касается меньше
    const slump = { ...makeInitialEconomy(), recessionRisk: 95, bankingRisk: 60,
      inflationRisk: 10, currencyRisk: 10, debtRisk: 10, politicalTension: 20 };
    const rows = regionVoteShares(slump, 50, false);
    const industry = rows.find((r) => r.id === 'industry').share;
    const periphery = rows.find((r) => r.id === 'periphery').share;
    expect(industry).toBeLessThan(50);
    expect(periphery).toBeGreaterThan(industry);
  });

  it('сфальсифицированные выборы рисуют почти ровный результат по всей стране', () => {
    const autocracy = { ...makeInitialEconomy(), politicalRegime: 'authoritarian',
      politicalTension: 80, recessionRisk: 90, approval: 12 };
    const rows = regionVoteShares(autocracy, 18, true);
    const min = Math.min(...rows.map((r) => r.share));
    const max = Math.max(...rows.map((r) => r.share));
    // настоящий рейтинг 12, «официальный» — под 80 и почти без разброса
    expect(min).toBeGreaterThan(70);
    expect(max - min).toBeLessThan(4);
  });

  it('выборы оставляют результат по округам в экономике до следующего голосования', () => {
    let economy = { ...makeInitialEconomy(), quartersToElection: 1 };
    let decisions = defaultDecisions(economy);
    const first = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
      difficulty: 'medium', quarterIndex: 4, stories: [], noEvents: true });
    expect(first.economy.lastElection).toBeTruthy();
    expect(first.economy.lastElection.byRegion).toHaveLength(MAP_REGIONS.length);
    expect(first.economy.lastElection.qLabel).toBeTruthy();
    // следующий квартал выборами не является, но карта всё ещё должна их помнить
    economy = first.economy;
    decisions = defaultDecisions(economy, decisions);
    const next = simulateQuarter({ economy, decisions, pendingImpulses: first.pendingImpulses,
      eventCooldowns: first.eventCooldowns, difficulty: 'medium', quarterIndex: 5, stories: [], noEvents: true });
    expect(next.economy.electionResult).toBeNull();
    expect(next.economy.lastElection).toEqual(first.economy.lastElection);
  });

  it('новость о выборах называет те же лучший и худший округ, что и карта', () => {
    const economy = { ...makeInitialEconomy(), quartersToElection: 1 };
    const r = simulateQuarter({ economy, decisions: defaultDecisions(economy), pendingImpulses: [],
      eventCooldowns: {}, difficulty: 'medium', quarterIndex: 8, stories: [], noEvents: true });
    const rows = [...r.economy.lastElection.byRegion].sort((a, b) => b.share - a.share);
    const best = MAP_REGIONS.find((x) => x.id === rows[0].id).name;
    const worst = MAP_REGIONS.find((x) => x.id === rows[rows.length - 1].id).name;
    const vote = r.newsEntries.find((n) => /МАНДАТ|ОППОЗИЦИЯ ПОБЕЖДАЕТ|ПОРАЖЕНИЕ ВЛАСТИ/.test(n.headline));
    expect(vote).toBeTruthy();
    expect(vote.text).toContain(best);
    expect(vote.text).toContain(worst);
  });

  it('у столичного округа политическая напряжённость весит больше, чем один лишь банковский риск', () => {
    // вес politicalTension (0.5) — самый большой отдельный вес в профиле округа,
    // больше любого другого показателя по отдельности (bankingRisk 0.2, debtRisk 0.3)
    const capital = MAP_REGIONS.find((r) => r.id === 'capital');
    const politicallyHot = { ...makeInitialEconomy(), politicalTension: 95, bankingRisk: 5, debtRisk: 5 };
    const bankingHot = { ...makeInitialEconomy(), politicalTension: 5, bankingRisk: 95, debtRisk: 5 };
    expect(regionStress(capital, politicallyHot)).toBeGreaterThan(regionStress(capital, bankingHot));
  });
});

describe('жалобы игрока: рынок, бот и сюжеты', () => {
  it('капитализация не считает инфляцию дважды: к ВВП она остаётся правдоподобной', () => {
    // игрок доиграл до капитализации 31273.9% ВВП — priceLevel входил в неё
    // и через индекс (через номинальные прибыли), и ещё раз множителем
    let economy = makeInitialEconomy('hyperinflation');
    const startPrice = economy.priceLevel;
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {};
    for (let q = 1; q <= 60; q++) {
      const r = simulateQuarter({ economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'medium', quarterIndex: q, stories: [], noEvents: true });
      economy = r.economy; pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
      decisions = defaultDecisions(economy, decisions);
      expect(economy.marketCapPctGdp).toBeLessThan(400);
      expect(economy.marketCapPctGdp).toBeGreaterThanOrEqual(0);
    }
    // уровень цен за партию вырос в разы — а отношение капитализации к ВВП нет
    expect(economy.priceLevel).toBeGreaterThan(startPrice * 3);
  });

  it('крупные суммы и индексы не превращаются в нечитаемую ленту цифр', () => {
    expect(fmtMoney(6512258680)).toMatch(/квинтлн|квадрлн|секстлн/);
    expect(fmtMoney(1500)).toBe('1.50 трлн');
    expect(fmtIndex(8374980.7)).toBe('8.37 млн');
    expect(fmtIndex(1234.5)).toBe('1234.5');
  });

  it('досрочные выборы нельзя назначить там, где выборов не бывает', () => {
    const act = PRES_BY_ID.snap_election;
    const base = { quartersToElection: 10, politicalRegime: 'democracy' };
    expect(act.requires(base)).toBe(true);
    expect(act.requires({ ...base, politicalRegime: 'totalitarian' })).toBe(false);
  });

  it('встречные сюжеты не идут одновременно: сырьё не может и падать, и расти', () => {
    const prev = makeInitialEconomy();
    const next = { ...prev, creditGap: 9 };
    const decisions = defaultDecisions(prev);
    // «сырьё вниз» уже идёт — «сырьё вверх» в этот момент стартовать не должно
    const active = [{ tplId: 'commodity_down', nextIdx: 1, wait: 0 }];
    expect(storyTriggers(prev, next, decisions, active, {})).not.toContain('oil_up');
    // а несвязанный сюжет по-прежнему запускается
    expect(storyTriggers(prev, next, decisions, active, {})).toContain('credit_boom');
  });

  it('бот-Минфин двигает налоги той же сеткой, что и игрок (0.5 п.п.)', () => {
    const step = LEVERS.find((l) => l.id === 'vatRate').step;
    const stressed = { ...makeInitialEconomy(), budgetBalancePctGdp: -9, debtToGdp: 120, outputGap: 1 };
    ['technocrat', 'austerity', 'populist'].forEach((persona) => {
      const res = botFinanceMinistry(stressed, persona, 'medium');
      ['vatRate', 'profitTaxRate', 'incomeTaxRate', 'exciseRate', 'capitalTaxRate'].forEach((k) => {
        const v = res.decisions[k];
        if (!Number.isFinite(v)) return;
        // значение обязано лежать на сетке ползунка игрока
        expect(Math.abs(v / step - Math.round(v / step))).toBeLessThan(1e-9);
      });
    });
  });

  it('бот-Минфин не выходит за границы ползунков игрока', () => {
    const stressed = { ...makeInitialEconomy(), outputGap: -7, recessionStreak: 4, unemployment: 12,
      quartersToElection: 1, budgetBalancePctGdp: -1 };
    const res = botFinanceMinistry(stressed, 'populist', 'medium');
    ['govSpending', 'transfers', 'govInvestment'].forEach((id) => {
      const lever = LEVERS.find((l) => l.id === id);
      expect(res.decisions[id]).toBeLessThanOrEqual(lever.max);
      expect(res.decisions[id]).toBeGreaterThanOrEqual(lever.min);
    });
  });
});


/* ============================================================================
   ГОЛОС РЕЖИМА

   Игрок нашёл три места, где игра забывала про режим: отчёт об
   антикоррупционной кампании, «Рейтинг власти 62 ▼» в газете и кнопка
   досрочных выборов там, где выборов нет. Это не три опечатки, а одна
   отсутствующая проверка, поэтому и тест здесь один: он обходит весь
   публичный текст — новости всех действий президента и все вопросы
   пресс-конференции — и валится, если при подконтрольной прессе в нём
   встречаются слова, которых в такой газете быть не может.

   Проверяется именно публичное слово. Панели кабинета, цепочки последствий
   и сводки ведомств остаются честными: правительство знает свой настоящий
   рейтинг, даже когда страна его не читает.
============================================================================ */
describe('голос режима: подконтрольная пресса говорит иначе', () => {
  /* Словарь свободной печати. Не «плохие слова», а признаки взгляда со
     стороны: чужой рейтинг власти, оппозиция, независимые институты, опросы
     про настроения, протест как протест, признание раскола наверху. Именно
     на таких оборотах игрок и поймал игру. */
  const FREE_PRESS = new RegExp([
    'рейтинг власти', 'при рейтинге',
    'оппозици',
    'независим(ые|ых|ая|ой) (медиа|СМИ|суд|пресс)',
    'профсоюзы объявляют протест',
    'раскол (в )?элит',
    'опросы (фиксируют|показывают)',
    'объединяются против власти',
    'сменить эту власть',
  ].join('|'), 'i');
  const unfreeStates = [
    { label: 'авторитарный режим', s: { politicalRegime: 'authoritarian', parliamentDissolved: true } },
    { label: 'тоталитарный режим', s: { politicalRegime: 'totalitarian', parliamentDissolved: true, noElections: true } },
  ];

  unfreeStates.forEach(({ label, s: patch }) => {
    it(`${label}: ни одна новость действия президента не говорит словами свободной прессы`, () => {
      const base = { ...makeInitialEconomy(), politicalCapital: 100, politicalTension: 60,
        unrestActive: true, warQuartersLeft: 8, warByChoice: true, quartersToElection: 12, ...patch };
      PRESIDENT_ACTIONS.forEach((a) => {
        if (!presActionAvailable(a, base, {})) return;
        const r = applyPresidentActions(base, [a.id], {}, 'medium');
        r.newsSpecs.forEach((n) => {
          const printed = `${n.headline} ${n.text}`;
          const bad = FREE_PRESS.exec(printed);
          expect(bad, `${a.id}: газета при режиме «${label}» печатает «${bad && bad[0]}» — нужен вариант textHard/headlineHard`).toBeNull();
        });
      });
    });

    it(`${label}: вопросы пресс-конференции не задаёт свободная пресса`, () => {
      const base = { ...makeInitialEconomy(), inflation: 12, unemployment: 14, nairu: 5, debtToGdp: 95, ...patch };
      PRESS_QUESTIONS.forEach((_, i) => {
        const q = pickPressQuestion(base, i);
        if (!q) return;
        const printed = `${q.shortLabel} ${q.prompt} ${q.options.map((o) => o.quote).join(' ')}`;
        const bad = FREE_PRESS.exec(printed);
        expect(bad, `вопрос «${q.id}» при режиме «${label}» звучит как «${bad && bad[0]}» — нужен promptHard/quoteHard`).toBeNull();
      });
    });
  });

  it('при свободной прессе остаются исходные, честные формулировки', () => {
    const free = { ...makeInitialEconomy(), politicalRegime: 'democracy', politicalCapital: 100, politicalTension: 60, unrestActive: true };
    const q = pickPressQuestion(free, 1);
    expect(q.prompt).toMatch(/Оппозиция/);
    const r = applyPresidentActions(free, ['crackdown'], {}, 'medium');
    expect(r.newsSpecs[0].text).toMatch(/опросы фиксируют не согласие, а страх/);
  });

  it('варианты ответа на пресс-конференции не меняются вместе со словами', () => {
    const free = { ...makeInitialEconomy(), politicalRegime: 'democracy' };
    const hard = { ...makeInitialEconomy(), politicalRegime: 'totalitarian' };
    PRESS_QUESTIONS.forEach((_, i) => {
      const a = pickPressQuestion(free, i); const b = pickPressQuestion(hard, i);
      expect(b.id).toBe(a.id);
      expect(b.options.map((o) => o.id)).toEqual(a.options.map((o) => o.id));
    });
  });
});


/* Потолок ключевой ставки. Отчёт о балансе (npm run balance) показал: сценарий
   «Гиперинфляция» начинался при инфляции 34% и ставке 24% при потолке ползунка
   25% — реальная ставка не могла стать положительной ни у бота, ни у игрока, и
   инфляция стояла на 30+% четыре года. Потолок теперь растёт с инфляцией. */
describe('потолок ключевой ставки растёт вместе с инфляцией', () => {
  const KR = LEVERS.find((l) => l.id === 'keyRate');

  it('в спокойной экономике потолок прежний — 25%', () => {
    expect(scaleLever(KR, makeInitialEconomy()).max).toBe(25);
  });

  it('при высокой инфляции реальная ставка может стать положительной с запасом', () => {
    const e = makeInitialEconomy('hyperinflation');
    const cap = scaleLever(KR, e).max;
    expect(cap).toBeGreaterThanOrEqual(Math.max(e.inflation, e.inflationExpectations) + 15);
  });

  it('движок не срезает ставку выше 25%, если она в пределах ползунка', () => {
    const e = makeInitialEconomy('hyperinflation');
    const r = simulateQuarter({ economy: e, decisions: { ...defaultDecisions(e), keyRate: 45 },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [], noEvents: true });
    expect(r.economy.keyRate).toBe(45);
  });

  it('бот-ЦБ при гиперинфляции поднимает ставку выше старого потолка', () => {
    let e = makeInitialEconomy('hyperinflation');
    let rate = e.keyRate;
    for (let i = 0; i < 6; i++) { rate = botCentralBank({ ...e, keyRate: rate }, 'hawk', 'medium').decisions.keyRate; }
    expect(rate).toBeGreaterThan(25);
  });
});


/* Разбор партии читает историю кварталов и находит переломные моменты. Здесь —
   синтетические истории, где заранее известно, что должно найтись. */
describe('разбор партии', () => {
  const base = { ...makeInitialEconomy(), activeCrises: [], electionResult: null, politicalRegime: 'democracy' };
  const q = (i, patch) => ({ ...base, q: i, label: `Q${i}`, ...patch });

  it('к кризису привязывается решение, которое ему предшествовало', () => {
    const hist = [q(0), q(1), q(2, { keyRate: 2.5 }), q(3, { keyRate: 2.5, activeCrises: ['overheating'] })];
    const { events } = gameChronicle(hist);
    const ev = events.find((e) => e.kind === 'crisis');
    expect(ev).toBeTruthy();
    expect(ev.text).toMatch(/За 1 кв\. до этого: ставка снижена/);
  });

  it('кризис с первого квартала — это стартовые условия, а не чьё-то решение', () => {
    const { events } = gameChronicle([q(0), q(1, { activeCrises: ['currency'] }), q(2, { activeCrises: ['currency'] })]);
    expect(events[0].title).toMatch(/Партия началась в кризисе/);
  });

  it('подтасованные выборы: официальная цифра и честная рядом', () => {
    const hist = [q(0), q(1, { politicalRegime: 'authoritarian' }),
      q(2, { politicalRegime: 'authoritarian', electionResult: 'incumbent', electionVoteShare: 6,
        lastElection: { rigged: true, coup: false, nationalShare: 78 } })];
    const ev = gameChronicle(hist).events.find((e) => e.kind === 'election');
    expect(ev.title).toMatch(/официально 78/);
    expect(ev.text).toMatch(/было бы 6/);
  });

  it('переворот после проигранных выборов не выдаётся за победу', () => {
    const hist = [q(0), q(1), q(2, { electionResult: 'incumbent', electionVoteShare: 4, lastElection: { coup: true, rigged: false } })];
    const ev = gameChronicle(hist).events.find((e) => e.kind === 'election');
    expect(ev.tone).toBe('bad');
    expect(ev.title).toMatch(/итог не признан/);
  });

  it('колебания «конфликт ↔ авторитаризм» не засоряют разбор', () => {
    const seq = ['democracy', 'crisis', 'authoritarian', 'crisis', 'authoritarian', 'crisis', 'authoritarian', 'democracy'];
    const hist = seq.map((r, i) => q(i, { politicalRegime: r }));
    const regime = gameChronicle(hist).events.filter((e) => e.kind === 'regime').map((e) => e.title);
    expect(regime).toEqual(['Режим: Конфликт парламента и президента', 'Режим: Авторитарный режим', 'Режим: Демократия']);
  });

  it('событий не больше десяти и они идут по порядку', () => {
    const hist = [q(0)];
    for (let i = 1; i <= 60; i++) {
      hist.push(q(i, { activeCrises: i % 4 === 0 ? ['recession'] : [], keyRate: i % 2 ? 3 : 8,
        politicalRegime: 'democracy', wellbeing: 40 + (i % 7) * 5 }));
    }
    const { events, summary } = gameChronicle(hist);
    expect(events.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < events.length; i++) expect(events[i].q).toBeGreaterThanOrEqual(events[i - 1].q);
    expect(summary.quarters).toBe(60);
  });

  it('пустая или однокадровая история не ломает разбор', () => {
    expect(gameChronicle([]).events).toEqual([]);
    expect(gameChronicle([q(0)]).summary).toBeNull();
  });
});

/* Стабилизационная программа и мандат спасения. Без них сценарий
   «Гиперинфляция» политически не выигрывался никакой игрой (перебор 1296
   двухфазных стратегий — ноль); с ними выигрывается трудно, а бездействие
   по-прежнему проигрывает. */
describe('стабилизационная программа', () => {
  const run = (patchFn, quarters = 4, scenario = 'hyperinflation') => {
    let e = makeInitialEconomy(scenario); let d = defaultDecisions(e);
    let pend = []; let cd = {}; const out = [];
    for (let q = 1; q <= quarters; q++) {
      const r = simulateQuarter({ economy: e, decisions: { ...d, ...patchFn(e) }, pendingImpulses: pend,
        eventCooldowns: cd, difficulty: 'easy', quarterIndex: q, stories: [], noEvents: true });
      e = r.economy; pend = r.pendingImpulses; cd = r.eventCooldowns; d = defaultDecisions(e, d);
      out.push({ e, news: r.newsEntries });
    }
    return out;
  };
  const hard = (e) => ({ keyRate: Math.round(e.inflationExpectations + 8), govSpending: -6, fxRegime: 'managed' });

  it('жёсткие деньги и бюджет копят доверие к программе быстрее, чем одна ставка', () => {
    const both = run(hard, 2);
    const moneyOnly = run((e) => ({ keyRate: Math.round(e.inflationExpectations + 8), govSpending: 6, transfers: 8 }), 2);
    expect(both[1].e.stabilizationCred).toBeGreaterThan(moneyOnly[1].e.stabilizationCred);
    expect(both[1].e.stabilizationCred).toBeGreaterThanOrEqual(0.5);
  });

  it('печатание денег обрушивает доверие к программе', () => {
    const broken = run(hard, 2);
    const e = broken[1].e;
    const r = simulateQuarter({ economy: e, decisions: { ...defaultDecisions(e), ...hard(e), moneySupplyOp: 4 },
      pendingImpulses: [], eventCooldowns: {}, difficulty: 'easy', quarterIndex: 3, stories: [], noEvents: true });
    expect(r.economy.stabilizationCred).toBeLessThan(e.stabilizationCred * 0.5);
  });

  it('при поверенной программе ожидания падают быстрее, чем при той же ставке без неё', () => {
    const credible = run(hard, 3);
    const printing = run((e) => ({ ...hard(e), moneySupplyOp: 3 }), 3);
    expect(credible[2].e.inflationExpectations).toBeLessThan(printing[2].e.inflationExpectations - 3);
  });

  it('мандат спасения при бездействии сгорает быстрее, чем при работающей программе', () => {
    const acting = run(hard, 4); const idle = run(() => ({}), 4);
    expect(idle[3].e.crisisMandateLeft).toBeLessThan(acting[3].e.crisisMandateLeft);
  });

  it('«Цены остановлены» — один раз, когда программа довела инфляцию до цели', () => {
    const quarters = run(hard, 10);
    const hits = quarters.flatMap((x) => x.news).filter((n) => n.headline.startsWith('ЦЕНЫ ОСТАНОВЛЕНЫ'));
    expect(hits.length).toBe(1);
  });

  it('в спокойной партии программа не включается и ничего не меняет', () => {
    const calm = run(() => ({}), 6, 'sandbox');
    calm.forEach((x) => { expect(x.e.stabilizationCred).toBe(0); expect(x.e.crisisMandateLeft || 0).toBe(0); });
  });
});

describe('сложность сценариев', () => {
  it('у каждого сценария есть уровень и пояснение, а «Гиперинфляция» — единственный самый трудный', () => {
    SCENARIOS.forEach((sc) => {
      expect(sc.level).toBeGreaterThanOrEqual(1);
      expect(sc.level).toBeLessThanOrEqual(4);
      expect(sc.levelLabel).toBeTruthy();
      expect(sc.levelNote).toBeTruthy();
    });
    const max = Math.max(...SCENARIOS.map((sc) => sc.level));
    expect(SCENARIOS.filter((sc) => sc.level === max).map((sc) => sc.id)).toEqual(['hyperinflation']);
  });
});

/* Боты и стабилизационная программа. До этого бот-ЦБ сдвигал ставку на 1,25–1,75
   п.п. за квартал и не успевал довести реальную ставку до +3, пока держался
   мандат: игрок за Минфин или президент в «Гиперинфляции» проигрывал всегда. */
describe('боты в стабилизационной программе', () => {
  const hyper = () => makeInitialEconomy('hyperinflation');

  it('ЦБ-бот при бегстве от денег выводит реальную ставку в плюс: ястреб и прагматик сразу, голубь за два квартала', () => {
    ['hawk', 'pragmatic'].forEach((p) => {
      const e = hyper();
      const r = botCentralBank(e, p, 'medium');
      expect(r.decisions.keyRate - e.inflationExpectations, p).toBeGreaterThanOrEqual(3);
      expect(r.decisions.moneySupplyOp, p).toBeLessThanOrEqual(0);
    });
    const e = hyper();
    const first = botCentralBank(e, 'dove', 'medium').decisions.keyRate;
    const second = botCentralBank({ ...e, keyRate: first }, 'dove', 'medium').decisions.keyRate;
    expect(first).toBeGreaterThan(e.keyRate);
    expect(second - e.inflationExpectations).toBeGreaterThanOrEqual(3);
  });

  it('ястреб выводит ставку выше, чем голубь', () => {
    const e = hyper();
    expect(botCentralBank(e, 'hawk', 'medium').decisions.keyRate)
      .toBeGreaterThan(botCentralBank(e, 'dove', 'medium').decisions.keyRate);
  });

  it('после победы над инфляцией ЦБ-бот снижает сверхжёсткую ставку крупными шагами', () => {
    const e = { ...makeInitialEconomy(), keyRate: 30, inflation: 2, inflationExpectations: 5, outputGap: -8 };
    const r = botCentralBank(e, 'pragmatic', 'medium');
    expect(e.keyRate - r.decisions.keyRate).toBeGreaterThanOrEqual(5);
  });

  it('технократ и консерватор режут расходы под программу, популист держит выплаты', () => {
    const e = hyper();
    const tech = botFinanceMinistry(e, 'technocrat', 'medium').decisions;
    const aust = botFinanceMinistry(e, 'austerity', 'medium').decisions;
    const pop = botFinanceMinistry(e, 'populist', 'medium').decisions;
    expect(tech.govSpending).toBeLessThanOrEqual(-3);
    expect(aust.govSpending).toBeLessThanOrEqual(-4);
    expect(pop.transfers).toBeGreaterThan(tech.transfers);
  });

  it('в спокойной экономике боты не включают режим программы', () => {
    const e = makeInitialEconomy();
    const r = botCentralBank(e, 'hawk', 'medium');
    expect(Math.abs(r.decisions.keyRate - e.keyRate)).toBeLessThan(2);
  });
});

describe('жёсткость цен вниз', () => {
  it('даже при огромном отрицательном разрыве выпуска дефляция не проваливается к −10%', () => {
    let e = { ...makeInitialEconomy(), gdp: makeInitialEconomy().potentialGdp * 0.8, inflationExpectations: 0, inflation: 0 };
    let d = defaultDecisions(e);
    for (let q = 1; q <= 6; q++) {
      const r = simulateQuarter({ economy: e, decisions: { ...d, keyRate: 8 }, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'easy', quarterIndex: q, stories: [], noEvents: true });
      e = r.economy; d = defaultDecisions(e, d);
      expect(e.inflation).toBeGreaterThan(-6);
    }
  });
});

describe('мандат спасения после победы над ценами', () => {
  it('обновляется один раз, когда программа доводит инфляцию до цели', () => {
    let e = makeInitialEconomy('hyperinflation'); let d = defaultDecisions(e);
    let pend = []; let cd = {}; const refills = [];
    for (let q = 1; q <= 12; q++) {
      const dec = { keyRate: Math.round(Math.max(e.inflation, e.inflationExpectations) + 3), govSpending: -6 };
      const r = simulateQuarter({ economy: e, decisions: { ...d, ...dec }, pendingImpulses: pend, eventCooldowns: cd,
        difficulty: 'easy', quarterIndex: q, stories: [], noEvents: true });
      if (r.newsEntries.some((n) => n.headline.startsWith('СТРАНА ДАЁТ ВРЕМЯ'))) refills.push(q);
      e = r.economy; pend = r.pendingImpulses; cd = r.eventCooldowns; d = defaultDecisions(e, d);
    }
    expect(refills.length).toBe(1);
  });
});

describe('стабилизация в разборе партии', () => {
  it('разбор отмечает, что рынок поверил программе и что цены остановлены', () => {
    let e = makeInitialEconomy('hyperinflation'); let d = defaultDecisions(e);
    let pend = []; let cd = {}; const hist = [{ q: 0, label: 'старт', ...e }];
    for (let q = 1; q <= 10; q++) {
      const dec = { keyRate: Math.round(Math.max(e.inflation, e.inflationExpectations) + 3), govSpending: -6 };
      const r = simulateQuarter({ economy: e, decisions: { ...d, ...dec }, pendingImpulses: pend, eventCooldowns: cd,
        difficulty: 'easy', quarterIndex: q, stories: [], noEvents: true });
      e = r.economy; pend = r.pendingImpulses; cd = r.eventCooldowns; d = defaultDecisions(e, d);
      hist.push({ q, label: `Q${q}`, ...e });
    }
    const kinds = gameChronicle(hist).events.map((ev) => ev.kind);
    expect(kinds).toContain('stab-credible');
    expect(kinds).toContain('prices-stopped');
  });
});

describe('стартовый режим экономики в сценариях', () => {
  it('совпадает с тем, что движок присвоит после первого квартала — баннер не пишет «Нормальный режим» посреди кризиса', () => {
    SCENARIOS.forEach((sc) => {
      const e0 = makeInitialEconomy(sc.id);
      const r = simulateQuarter({ economy: e0, decisions: defaultDecisions(e0), pendingImpulses: [], eventCooldowns: {},
        difficulty: 'easy', quarterIndex: 1, stories: [], noEvents: true });
      expect(e0.regime, sc.id).toBe(r.economy.regime);
    });
  });
});

describe('бюджетные потоки: одни пределы у игрока и у бота-Минфина', () => {
  it('закупки, выплаты и инвестиции ходят в пределах ±15% за квартал', () => {
    for (const id of ['govSpending', 'transfers', 'govInvestment']) {
      const l = LEVERS.find((x) => x.id === id);
      expect([l.min, l.max], id).toEqual([-15, 15]);
    }
  });
  it('бот-Минфин любого характера не выходит за пределы ползунков даже в глубоком кризисе', () => {
    const e = { ...makeInitialEconomy('medium'), outputGap: -9, unemployment: 14, recessionStreak: 4, budgetBalancePctGdp: 2, quartersToElection: 1 };
    for (const p of ['technocrat', 'austerity', 'populist']) {
      const d = botFinanceMinistry(e, p, 'medium').decisions;
      for (const id of ['govSpending', 'transfers', 'govInvestment']) expect(Math.abs(d[id]), `${p}/${id}`).toBeLessThanOrEqual(15);
    }
  });
});

describe('округа: стройки и события', () => {
  const step = (economy, decisions, q = 5) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });

  it('стройка идёт свои кварталы, стоит денег и после сдачи надолго снижает напряжение округа', async () => {
    const { REGION_PROJECTS, regionStress, MAP_REGIONS } = await import('../engine.js');
    const p = REGION_PROJECTS.find((x) => x.id === 'irrigation');
    const agri = MAP_REGIONS.find((r) => r.id === 'agri');
    let e = { ...makeInitialEconomy(), regionEventCooldown: 99 };
    const base = step(e, {}).economy;
    let res = step(e, { startProject: 'irrigation' });
    e = res.economy;
    expect(e.projects.map((x) => x.id)).toEqual(['irrigation']);
    expect(res.newsEntries.some((n) => n.headline.startsWith('СТАРТ СТРОЙКИ'))).toBe(true);
    // стройка — госинвестиции сверх ползунка: в квартале старта их больше, чем без неё
    expect(e.govInvestmentNominal).toBeGreaterThan(base.govInvestmentNominal);
    for (let q = 1; q < p.quarters; q++) { res = step({ ...e, regionEventCooldown: 99 }, {}, 5 + q); e = res.economy; }
    expect(e.projects).toEqual([]);
    expect(e.projectsBuilt).toContain('irrigation');
    expect(e.regionMods.agri).toBe(-p.relief);
    expect(res.newsEntries.some((n) => n.headline === 'ПОСТРОЕНО: ИРРИГАЦИЯ И ЭЛЕВАТОРЫ')).toBe(true);
    // в неспокойной стране это видно на карте: напряжение округа ниже на relief
    const tense = { ...e, inflationRisk: 70, recessionRisk: 60, currencyRisk: 60, regionShock: {} };
    expect(regionStress(agri, tense)).toBeCloseTo(regionStress(agri, { ...tense, regionMods: {} }) - p.relief, 5);
  });

  it('повторно ту же стройку и больше трёх одновременно начать нельзя', async () => {
    const { projectBlocker, REGION_PROJECTS } = await import('../engine.js');
    const e = makeInitialEconomy();
    const P = (id) => REGION_PROJECTS.find((x) => x.id === id);
    expect(projectBlocker(P('metro'), e)).toBe(null);
    expect(projectBlocker(P('metro'), { ...e, projectsBuilt: ['metro'] })).toMatch(/построено/);
    expect(projectBlocker(P('metro'), { ...e, projects: [{ id: 'metro', region: 'capital', left: 3, total: 8 }] })).toMatch(/строится/);
    const three = ['deepport', 'railway', 'techpark'].map((id) => ({ id, region: P(id).region, left: 2, total: 5 }));
    expect(projectBlocker(P('metro'), { ...e, projects: three })).toMatch(/не больше 3/);
    // решение, которое движок не пропустит, не создаёт стройку
    const res = step({ ...e, projectsBuilt: ['metro'] }, { startProject: 'metro' });
    expect(res.economy.projects).toEqual([]);
  });

  it('на событие отвечают выбором; без ответа срабатывает «переждать»', async () => {
    const { REGION_EVENTS } = await import('../engine.js');
    const ev = REGION_EVENTS.find((x) => x.id === 'miners_strike');
    const e = { ...makeInitialEconomy(), regionEventCooldown: 99,
      regionEvent: { id: ev.id, region: ev.region, title: ev.title, text: '', q: 4, defaultOption: ev.defaultOption, options: [] } };
    const paid = step(e, { regionResponse: 'pay' });
    expect(paid.economy.regionEvent).toBe(null);
    expect(paid.economy.lastRegionResolution).toMatchObject({ id: 'miners_strike', option: 'pay', byDefault: false });
    expect(paid.economy.regionShock.mining).toBeLessThan(0);
    const ignored = step(e, {});
    expect(ignored.economy.lastRegionResolution).toMatchObject({ option: 'wait', byDefault: true });
    expect(ignored.economy.regionShock.mining).toBeGreaterThan(0);
    expect(ignored.newsEntries.some((n) => /РЕШЕНИЯ НЕ ПРИНЯЛИ/.test(n.headline))).toBe(true);
  });

  it('события вспыхивают сами: за 40 кварталов их несколько, у каждого есть вариант по умолчанию', () => {
    const rnd = Math.random; let seed = 77;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    try {
      let e = makeInitialEconomy(); const seen = [];
      for (let q = 1; q <= 40; q++) {
        const mof = botFinanceMinistry(e, 'technocrat', 'medium');
        const res = simulateQuarter({ economy: e, decisions: { ...defaultDecisions(e), ...botCentralBank(e, 'pragmatic', 'medium').decisions, ...mof.decisions },
          pendingImpulses: [], eventCooldowns: {}, difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [mof] });
        e = res.economy;
        if (e.regionEvent) {
          seen.push(e.regionEvent.id);
          expect(e.regionEvent.options.some((o) => o.id === e.regionEvent.defaultOption)).toBe(true);
        }
      }
      expect(seen.length).toBeGreaterThanOrEqual(3);
      // бот-технократ строит, пока позволяет бюджет
      expect((e.projectsBuilt.length + e.projects.length)).toBeGreaterThan(0);
    } finally { Math.random = rnd; }
  });

  it('бот-Минфин отвечает на событие по характеру', async () => {
    const { REGION_EVENTS } = await import('../engine.js');
    const ev = REGION_EVENTS.find((x) => x.id === 'drought');
    const e = { ...makeInitialEconomy(), regionEvent: { id: ev.id, region: ev.region, title: ev.title, text: '', q: 4, defaultOption: 'wait', options: [] } };
    expect(botFinanceMinistry(e, 'populist', 'medium').decisions.regionResponse).toBe('subsidy');
    expect(botFinanceMinistry(e, 'austerity', 'medium').decisions.regionResponse).toBe('import');
  });
});

describe('война на карте', () => {
  it('прифронтовая область напряжена сильнее тыловых: оборона — Приреченская, наступление — Рудногорская', async () => {
    const { MAP_REGIONS, regionStress, warFrontRegion } = await import('../engine.js');
    const e = { ...makeInitialEconomy(), inflationRisk: 30, recessionRisk: 30, politicalTension: 30, currencyRisk: 30, bankingRisk: 30, debtRisk: 30 };
    const R = (id) => MAP_REGIONS.find((r) => r.id === id);
    expect(warFrontRegion(e)).toBe(null);
    const def = { ...e, warQuartersLeft: 3, warType: 'defensive' };
    expect(warFrontRegion(def)).toBe('agri');
    expect(regionStress(R('agri'), def) - regionStress(R('agri'), e)).toBeCloseTo(22, 5);
    expect(regionStress(R('capital'), def) - regionStress(R('capital'), e)).toBeCloseTo(5, 5);
    expect(warFrontRegion({ ...e, warQuartersLeft: 3, warType: 'offensive' })).toBe('mining');
  });
});

describe('наступательная операция на карте', () => {
  const atWar = (extra) => ({ ...makeInitialEconomy(), warQuartersLeft: 8, warType: 'offensive', warByChoice: true, regionEventCooldown: 99, ...extra });
  const step = (economy, warOrder, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), warOrder }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });

  it('штурм продвигает фронт сильнее осады, операция помнит приказ', () => {
    const rnd = Math.random; Math.random = () => 0.5;
    try {
      const a = step(atWar(), { target: 'mines', stance: 'assault' }).economy.warCampaign;
      const b = step(atWar(), { target: 'mines', stance: 'siege' }).economy.warCampaign;
      expect(a.progress.mines).toBeGreaterThan(b.progress.mines);
      expect(a.last).toMatchObject({ target: 'mines', stance: 'assault' });
    } finally { Math.random = rnd; }
  });

  it('Нордхольм без перевала не штурмуют: приказ переходит на доступную цель', () => {
    const rnd = Math.random; Math.random = () => 0.9;
    try {
      const c = step(atWar(), { target: 'city', stance: 'assault' }).economy.warCampaign;
      expect(c.progress.city).toBe(0);
      expect(c.last.target).not.toBe('city');
    } finally { Math.random = rnd; }
  });

  it('взятая цель остаётся за страной; все три — капитуляция Норланда и конец войны', () => {
    const rnd = Math.random; Math.random = () => 0.9;
    try {
      const almost = atWar({ warCampaign: { progress: { pass: 100, mines: 100, city: 95 }, captured: ['pass', 'mines'], last: null } });
      const res = step(almost, { target: 'city', stance: 'assault' });
      expect(res.economy.warQuartersLeft).toBe(0);
      expect(res.economy.warCampaign).toBe(null);
      expect(res.newsEntries.some((n) => n.headline === 'НОРЛАНД ПОДПИСЫВАЕТ КАПИТУЛЯЦИЮ')).toBe(true);
    } finally { Math.random = rnd; }
  });

  it('перемирие заканчивает войну по линии фронта', () => {
    const res = step(atWar({ warCampaign: { progress: { pass: 100, mines: 40, city: 0 }, captured: ['pass'], last: null } }), { target: null, stance: 'ceasefire' });
    expect(res.economy.warQuartersLeft).toBe(0);
    expect(res.newsEntries.some((n) => n.headline === 'ПЕРЕМИРИЕ С НОРЛАНДОМ' && /Ледяной перевал/.test(n.text))).toBe(true);
  });

  it('больше обороны в бюджете — сильнее армия; бот-президент командует по характеру', async () => {
    const { warStrength, botWarOrder } = await import('../engine.js');
    const e = atWar();
    expect(warStrength({ ...e, budgetShares: { ...e.budgetShares, defense: 30 } })).toBeGreaterThan(warStrength(e));
    expect(botWarOrder(e, 'strongman').stance).toBe('assault');
    expect(botWarOrder({ ...e, approval: 20 }, 'technocrat').stance).toBe('ceasefire');
  });
});

describe('война: бессрочность, внешняя война, присоединение', () => {
  const step = (economy, decisions = {}, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });
  const war = (extra) => ({ ...makeInitialEconomy(), warQuartersLeft: 10, warType: 'offensive', warByChoice: true, warElapsed: 3, regionEventCooldown: 99, ...extra });

  it('своя наступательная война не кончается сама: счётчик не убывает, идёт отсчёт длительности', () => {
    const rnd = Math.random; Math.random = () => 0.99;
    try {
      let e = war({ warQuartersLeft: 1 });
      for (let q = 0; q < 5; q++) e = step(e, { warOrder: { target: 'mines', stance: 'hold' } }, 6 + q).economy;
      expect(e.warQuartersLeft).toBe(1);
      expect(e.warType).toBe('offensive');
      expect(e.warElapsed).toBe(8);
    } finally { Math.random = rnd; }
  });

  it('если приказа нет, армия продолжает прошлый — а не переключается на осаду', () => {
    const rnd = Math.random; Math.random = () => 0.99;
    try {
      const e = war({ warCampaign: { progress: { pass: 0, mines: 10, city: 0 }, captured: [], last: { target: 'mines', stance: 'assault', gained: 10, counter: null } } });
      expect(step(e).economy.warCampaign.last).toMatchObject({ target: 'mines', stance: 'assault' });
    } finally { Math.random = rnd; }
  });

  it('пришедшая извне война всегда оборонительная', () => {
    const rnd = Math.random;
    try {
      for (let i = 0; i < 20; i++) {
        let seed = i + 1;
        Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        let e = makeInitialEconomy();
        for (let q = 1; q <= 30; q++) {
          e = step(e, {}, q).economy;
          if ((e.warQuartersLeft || 0) > 0) expect(e.warType).toBe('defensive');
        }
      }
    } finally { Math.random = rnd; }
  });

  it('после перемирия взятое входит в состав страны; второй раз его не штурмуют; всё взято — войну не начать', async () => {
    const { PRES_BY_ID } = await import('../engine.js');
    const e = war({ warCampaign: { progress: { pass: 100, mines: 100, city: 10 }, captured: ['pass', 'mines'], last: null } });
    const res = step(e, { warOrder: { target: null, stance: 'ceasefire' } });
    expect(res.economy.annexed.sort()).toEqual(['mines', 'pass']);
    expect(res.newsEntries.some((n) => n.headline === 'ГРАНИЦА СДВИНУТА: НОВЫЕ ЗЕМЛИ В СОСТАВЕ СТРАНЫ')).toBe(true);
    const again = step({ ...res.economy, warQuartersLeft: 10, warType: 'offensive', warCampaign: null }, { warOrder: { target: 'pass', stance: 'assault' } });
    expect(again.economy.warCampaign.captured).toEqual(expect.arrayContaining(['pass', 'mines']));
    expect(again.economy.warCampaign.last.target).toBe('city');
    expect(PRES_BY_ID.war_start.requires({ ...res.economy, annexed: ['pass', 'mines', 'city'] })).toBe(false);
    expect(PRES_BY_ID.war_start.requires(res.economy)).toBe(true);
  });
});

describe('опросы и штаб кампании', () => {
  const step = (economy, decisions = {}, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });
  const seeded = (fn) => {
    const rnd = Math.random; let seed = 7;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    try { return fn(); } finally { Math.random = rnd; }
  };
  const before = (toVote, extra) => ({ ...makeInitialEconomy(), quartersToElection: toVote, regionEventCooldown: 99, ...extra });

  it('опрос появляется только за несколько кварталов до голосования и только при выборах', () => {
    expect(electionForecast(before(POLL_WINDOW + 1))).toBe(null);
    const f = electionForecast(before(POLL_WINDOW));
    expect(f.byRegion).toHaveLength(MAP_REGIONS.length);
    expect(f.quartersToElection).toBe(POLL_WINDOW);
    for (const r of f.byRegion) expect(r.label).toBe(swingLabel(r.base));
  });

  it('при несвободном режиме — закрытый замер каждый квартал: шире погрешность, без штабов, ниже официальной цифры', () => {
    const auth = electionForecast(before(12, { politicalRegime: 'authoritarian', approval: 40 }));
    expect(auth.closed).toBe(true);
    expect(auth.margin).toBe(5);
    expect(auth.official).toBeGreaterThan(auth.national + 10);
    expect(electionForecast(before(12, { politicalRegime: 'totalitarian', noElections: true })).margin).toBe(8);
    const withPlan = electionForecast(before(2, { politicalRegime: 'authoritarian' }), { agri: 4 });
    expect(withPlan.byRegion.find((r) => r.id === 'agri').spent).toBe(0);
    expect(botCampaignPlan(before(2, { politicalRegime: 'authoritarian' }))).toEqual({});
  });

  it('метки: колеблющиеся у 50%, потерянные и надёжные — далеко', () => {
    expect(swingLabel(51)).toBe('колеблется');
    expect(swingLabel(44)).toBe('склоняется к оппозиции');
    expect(swingLabel(55)).toBe('склоняется к власти');
    expect(swingLabel(35)).toBe('потеряна');
    expect(swingLabel(70)).toBe('надёжная');
  });

  it('штаб в колеблющейся области даёт больше, чем в потерянной', () => {
    const e = before(3);
    const f0 = electionForecast(e);
    const swing = f0.byRegion.reduce((a, b) => (Math.abs(a.base - 50) < Math.abs(b.base - 50) ? a : b));
    const far = f0.byRegion.reduce((a, b) => (Math.abs(a.base - 50) > Math.abs(b.base - 50) ? a : b));
    const gain = (id) => {
      const f = electionForecast(e, { [id]: 2 });
      return f.byRegion.find((r) => r.id === id).share - f0.byRegion.find((r) => r.id === id).share;
    };
    if (Math.abs(far.base - 50) >= 8 && Math.abs(swing.base - 50) < 4) expect(gain(swing.id)).toBeGreaterThan(gain(far.id) * 3);
    expect(gain(swing.id)).toBeGreaterThan(0);
  });

  it('план штабов: не больше положенного, только настоящие области, целые числа', () => {
    expect(sanitizeCampaignPlan({ agri: 3.7, moon: 5 })).toEqual({ agri: 3 });
    const capped = sanitizeCampaignPlan({ capital: 9, agri: 2 });
    expect(Object.values(capped).reduce((a, b) => a + b, 0)).toBe(CAMPAIGN_POINTS);
    expect(sanitizeCampaignPlan(null)).toEqual({});
    expect(sanitizeCampaignPlan({ agri: -2 })).toEqual({});
    const bot = botCampaignPlan(before(2));
    expect(Object.values(bot).reduce((a, b) => a + b, 0)).toBe(CAMPAIGN_POINTS);
    expect(botCampaignPlan(before(10))).toEqual({});
  });

  it('штабы копятся до голосования, стоят денег, поднимают итог и обнуляются после выборов', () => {
    const plan = { agri: 2, industry: 2 };
    const run = (withCampaign) => seeded(() => {
      let e = before(3, { approval: 50 });
      const trail = [];
      for (let q = 0; q < 3; q++) {
        e = step(e, withCampaign ? { campaignPlan: plan } : {}, 6 + q).economy;
        trail.push(e);
      }
      return trail;
    });
    const withC = run(true); const without = run(false);
    expect(withC[0].campaignSpend).toEqual({ agri: 2, industry: 2 });
    expect(withC[1].campaignSpend).toEqual({ agri: 4, industry: 4 });
    expect(without[1].campaignSpend).toEqual({});
    // третий квартал — день голосования: учёт штабов начинается заново
    expect(withC[2].lastElection).toBeTruthy();
    expect(withC[2].campaignSpend).toEqual({});
    const at = (trail, id) => trail[2].lastElection.byRegion.find((r) => r.id === id).share;
    expect(at(withC, 'agri')).toBeGreaterThan(at(without, 'agri'));
  });
});

describe('новые земли как области', () => {
  const step = (economy, decisions = {}, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });
  const withRandom = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
  const annexedEco = (extra) => ({ ...makeInitialEconomy(), annexed: ['pass', 'mines', 'city'], regionEventCooldown: 99, ...extra });

  it('присоединённые земли — области страны; голосуют только интегрированные', () => {
    const e = annexedEco({ annexIntegrated: ['pereval'] });
    expect(activeRegions(e).map((r) => r.id)).toEqual(expect.arrayContaining(['pereval', 'halvik', 'nordholm']));
    expect(activeRegions(makeInitialEconomy())).toHaveLength(MAP_REGIONS.length);
    expect(votingRegions(e).map((r) => r.id)).toContain('pereval');
    expect(votingRegions(e).map((r) => r.id)).not.toContain('nordholm');
    const shares = regionVoteShares(e, 55, false);
    expect(shares.map((r) => r.id)).toContain('pereval');
    expect(shares.reduce((a, b) => a + b.share, 0) / shares.length).toBeCloseTo(55, 5);
  });

  it('низкая лояльность — неспокойно: напряжение новой области выше, чем у той же земли лояльной', () => {
    const nord = activeRegions(annexedEco()).find((r) => r.id === 'nordholm');
    expect(regionStress(nord, annexedEco({ annexLoyalty: { nordholm: 10 } })))
      .toBeGreaterThan(regionStress(nord, annexedEco({ annexLoyalty: { nordholm: 70 } })) + 20);
  });

  it('интеграция стоит денег и поднимает лояльность; без решения программа продолжается', () => withRandom(0.99, () => {
    const e = annexedEco({ annexLoyalty: { pereval: 40, halvik: 40, nordholm: 40 } });
    const funded = step(e, { integrate: ['halvik'] }).economy;
    const idle = step(e, { integrate: [] }).economy;
    expect(funded.annexLoyalty.halvik - idle.annexLoyalty.halvik).toBeCloseTo(6, 5);
    expect(funded.annexFunded).toEqual(['halvik']);
    // null — не трогали: программа прошлого квартала идёт дальше
    const cont = step(funded, { integrate: null }).economy;
    expect(cont.annexFunded).toEqual(['halvik']);
    expect(sanitizeIntegration(['halvik', 'moon', 'halvik', 'capital'], e)).toEqual(['halvik']);
    expect(INTEGRATION_COST).toBeGreaterThan(0);
  }));

  it('партизаны при низкой лояльности: новость о диверсии', () => withRandom(0, () => {
    const out = step(annexedEco({ annexLoyalty: { pereval: 60, halvik: 60, nordholm: 5 } }));
    expect(out.newsEntries.some((n) => n.headline.includes('НОРДХОЛЬМ'))).toBe(true);
  }));

  it('дошла до порога — область интегрирована и начинает голосовать', () => withRandom(0.99, () => {
    const out = step(annexedEco({ annexLoyalty: { pereval: INTEGRATED_AT - 1, halvik: 20, nordholm: 10 } }));
    expect(out.economy.annexIntegrated).toContain('pereval');
    expect(out.newsEntries.some((n) => n.headline.includes('ВПЕРВЫЕ ГОЛОСУЕТ'))).toBe(true);
  }));

  it('стройки и события новых земель — только когда земля в составе страны', () => {
    const tunnel = REGION_PROJECTS.find((p) => p.region === 'pereval');
    expect(projectBlocker(tunnel, makeInitialEconomy())).toMatch(/не в составе/);
    expect(projectBlocker(tunnel, annexedEco())).toBe(null);
    const nordEvent = REGION_EVENTS.find((ev) => ev.region === 'nordholm');
    expect(nordEvent.eligible(makeInitialEconomy())).toBe(false);
    expect(nordEvent.eligible(annexedEco())).toBe(true);
  });

  it('после присоединения лояльность стартует низкой', () => withRandom(0.99, () => {
    const e = { ...makeInitialEconomy(), warQuartersLeft: 10, warType: 'offensive', warByChoice: true, regionEventCooldown: 99,
      warCampaign: { progress: { pass: 100, mines: 0, city: 0 }, captured: ['pass'], last: null } };
    const out = step(e, { warOrder: { target: 'mines', stance: 'ceasefire' } }).economy;
    expect(out.annexed).toContain('pass');
    expect(annexLoyalty(out, 'pereval')).toBeLessThan(30);
  }));
});

describe('мир с Норландом и реванш', () => {
  const step = (economy, decisions = {}, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });
  const withRandom = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
  const held = (extra) => ({ ...makeInitialEconomy(), annexed: ['pass', 'mines'], annexLoyalty: { pereval: 40, halvik: 40 }, regionEventCooldown: 99, ...extra });
  const talks = (leverage, extra) => held({ peaceTalks: { since: 5, leverage, attempts: 0, origin: 'offensive' }, ...extra });
  const terms = (t) => ({ recognition: false, sanctions: false, reparations: null, returned: [], propose: true, walkAway: false, ...t });

  it('цена условий: признание дороже с каждой областью, уступки со знаком минус', () => {
    const e = held();
    expect(treatyCost(sanitizeTreaty(terms({ recognition: true }), e), e)).toBe(10 + 12 * 2);
    expect(treatyCost(sanitizeTreaty(terms({ recognition: true, returned: ['halvik'] }), e), e)).toBe(10 + 12 - 22);
    expect(treatyCost(sanitizeTreaty(terms({ reparations: 'pay' }), e), e)).toBe(-25);
    expect(sanitizeTreaty(terms({ returned: ['nordholm', 'halvik', 'moon'] }), e).returned).toEqual(['halvik']);
  });

  it('Норланд подписывает, если цена не выше позиции; граница признана, санкции сняты', () => withRandom(0.99, () => {
    const out = step(talks(50), { treaty: terms({ recognition: true, sanctions: true }) });
    expect(out.economy.peaceTalks).toBe(null);
    expect(out.economy.treaty).toMatchObject({ recognized: true, sanctions: true });
    expect(out.newsEntries.some((n) => n.headline.includes('МИРНЫЙ ДОГОВОР'))).toBe(true);
  }));

  it('слишком дорого — отказ, позиция тает; можно прервать переговоры', () => withRandom(0.99, () => {
    const refused = step(talks(30), { treaty: terms({ recognition: true, sanctions: true }) }).economy;
    expect(refused.treaty).toBe(null);
    expect(refused.peaceTalks.attempts).toBe(1);
    expect(refused.peaceTalks.leverage).toBe(28);
    const gone = step(talks(30), { treaty: terms({ walkAway: true, propose: false }) }).economy;
    expect(gone.peaceTalks).toBe(null);
    expect(gone.treaty).toBe(null);
  }));

  it('возврат земли по договору убирает её из страны; репарации идут в доходы', () => withRandom(0.99, () => {
    const out = step(talks(10), { treaty: terms({ returned: ['halvik'], reparations: 'receive' }) });
    expect(out.economy.annexed).toEqual(['pass']);
    expect(out.economy.annexLoyalty.halvik).toBeUndefined();
    // уступка (−22) покрыла цену репараций (25) не полностью: 3 ≤ 10
    expect(out.pendingImpulses.some((i) => i.channel === 'revenue' && i.values[0] > 0)).toBe(true);
  }));

  it('бот берёт самое ценное, на что Норланд согласится', () => {
    const e = talks(40);
    const t = botTreaty(e, 'technocrat');
    expect(t.recognition).toBe(true);
    expect(treatyCost(sanitizeTreaty(t, e), e)).toBeLessThanOrEqual(40);
  });

  it('после своей войны с захватом открываются переговоры', () => withRandom(0.99, () => {
    const e = { ...makeInitialEconomy(), warQuartersLeft: 10, warType: 'offensive', warByChoice: true, regionEventCooldown: 99,
      warCampaign: { progress: { pass: 100, mines: 100, city: 0 }, captured: ['pass', 'mines'], last: null } };
    const out = step(e, { warOrder: { target: 'city', stance: 'ceasefire' } }).economy;
    expect(out.peaceTalks).toBeTruthy();
    expect(out.peaceTalks.leverage).toBe(15 + 18 + 22);
  }));

  it('реваншизм: быстрее без договора, медленнее при признанной границе, гаснет без земель', () => {
    const none = revancheGrowth(held());
    const recognized = revancheGrowth(held({ treaty: { recognized: true } }));
    expect(none).toBeGreaterThan(recognized * 2);
    expect(revancheGrowth(makeInitialEconomy())).toBeLessThan(0);
  });

  it('на 100 Норланд нападает: война за новые земли, переговоры и договор отменены', () => withRandom(0.99, () => {
    const out = step(held({ norlandRevanche: 99.5, treaty: { recognized: false } })).economy;
    expect(out.warType).toBe('revanche');
    expect(out.warQuartersLeft).toBeGreaterThan(0);
    expect(out.revancheCampaign.next).toBeTruthy();
    expect(out.treaty).toBe(null);
    expect(out.norlandRevanche).toBe(0);
  }));

  const atWar = (camp, extra) => held({ warQuartersLeft: 10, warType: 'revanche', warElapsed: 2,
    revancheCampaign: { pressure: { pereval: 0, halvik: 0 }, morale: 80, lost: [], next: 'halvik', last: null, ...camp }, ...extra });

  it('оборона на направлении удара гасит продвижение Норланда', () => withRandom(0.5, () => {
    const guarded = step(atWar(), { warOrder: { target: 'halvik', stance: 'defend' } }).economy.revancheCampaign.pressure.halvik;
    const open = step(atWar(), { warOrder: { target: 'pereval', stance: 'defend' } }).economy.revancheCampaign.pressure.halvik;
    expect(open).toBeGreaterThan(guarded * 2);
  }));

  it('давление до 100 — область потеряна и уходит из страны', () => withRandom(0.99, () => {
    const out = step(atWar({ pressure: { pereval: 0, halvik: 95 } }), { warOrder: { target: 'pereval', stance: 'defend' } }).economy;
    expect(out.annexed).toEqual(['pass']);
    expect(out.warType).toBe('revanche');
  }));

  it('выдохшийся Норланд просит мира; перемирие по приказу открывает переговоры', () => withRandom(0.5, () => {
    const tired = step(atWar({ morale: 3 }), { warOrder: { target: 'halvik', stance: 'defend' } }).economy;
    expect(tired.warQuartersLeft).toBe(0);
    expect(tired.peaceTalks.leverage).toBeGreaterThan(40);
    const asked = step(atWar(), { warOrder: { target: 'halvik', stance: 'talks' } }).economy;
    expect(asked.warQuartersLeft).toBe(0);
    expect(asked.peaceTalks).toBeTruthy();
  }));

  it('во время войны за новые земли «заключить мир» указом нельзя: её кончают на карте', () => {
    const e = atWar();
    expect(PRES_BY_ID.peace_deal.requires(e)).toBe(false);
  });
});

describe('общество: социальные группы', () => {
  const step = (economy, decisions = {}, q = 6) => simulateQuarter({
    economy, decisions: { ...defaultDecisions(economy), ...decisions }, pendingImpulses: [], eventCooldowns: {},
    difficulty: 'medium', quarterIndex: q, stories: [], botAction: null, botActions: [],
  });
  const withRandom = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
  const all = (v) => Object.fromEntries(SOCIAL_GROUPS.map((g) => [g.id, v]));
  const base = (extra) => ({ ...makeInitialEconomy(), regionEventCooldown: 99, ...extra });

  it('веса групп в сумме — единица; рейтинг — взвешенная сумма их поддержки', () => withRandom(0.99, () => {
    expect(SOCIAL_GROUPS.reduce((a, g) => a + g.weight, 0)).toBeCloseTo(1, 6);
    const e = step(base()).economy;
    const weighted = SOCIAL_GROUPS.reduce((a, g) => a + g.weight * e.groupSupport[g.id], 0);
    expect(e.approval).toBeCloseTo(weighted, 6);
  }));

  it('пенсионная реформа бьёт по пенсионерам и нравится бизнесу — и это помнят', () => withRandom(0.99, () => {
    const e0 = base({ groupSupport: all(55), politicalCapital: 100 });
    const e = step(e0, { presidentActions: ['pension'] }).economy;
    const e2 = step(e, {}, 7).economy;
    expect(e2.groupSupport.pensioners).toBeLessThan(e2.groupSupport.business - 5);
    expect(e2.groupMemory.some((m) => m.group === 'pensioners' && m.amount < 0)).toBe(true);
    expect(ACTION_GROUP_EFFECTS.pension.pensioners).toBeLessThan(0);
  }));

  it('потерянные силовики поднимают риск переворота, лояльные — гасят', () => {
    const x = { politicalTension: 55, unemployment: 8, nairu: 5, inflation: 12, activeCrises: ['recession'], approval: 40, politicalCapital: 30 };
    const neutral = militaryCoupRisk({ ...x, groupSupport: all(50) });
    expect(militaryCoupRisk({ ...x, groupSupport: { ...all(50), siloviki: 15 } })).toBeGreaterThan(neutral * 1.8);
    expect(militaryCoupRisk({ ...x, groupSupport: { ...all(50), siloviki: 70 } })).toBeLessThan(neutral * 0.5);
    // спокойная популярная страна, но армия потеряна — риск уже не ноль
    expect(militaryCoupRisk({ politicalTension: 20, approval: 55, groupSupport: { ...all(55), siloviki: 10 } })).toBeGreaterThan(0);
  });

  it('пенсионеры голосуют активнее: их недовольство тянет итог выборов вниз', () => {
    expect(groupTurnoutShift({ groupSupport: all(50) })).toBeCloseTo(0, 6);
    expect(groupTurnoutShift({ groupSupport: { ...all(50), pensioners: 20 } })).toBeLessThan(-1);
    expect(groupTurnoutShift({ groupSupport: { ...all(50), youth: 20 } })).toBeGreaterThan(-1);
  });

  it('область голосует как те, кто в ней живёт: без рабочих Кузнецк отстаёт от страны', () => {
    const e = base({ groupSupport: { ...all(55), workers: 20 } });
    const shares = regionVoteShares(e, 55, false);
    const industry = shares.find((r) => r.id === 'industry').share;
    const finance = shares.find((r) => r.id === 'finance').share;
    expect(industry).toBeLessThan(finance - 5);
  });

  it('лидер потерянной группы переходит к делу — новость с его именем', () => withRandom(0, () => {
    const out = step(base({ groupSupport: { ...all(55), youth: 10 } }));
    expect(out.newsEntries.some((n) => n.text.includes('Кира Лебедь'))).toBe(true);
    expect(out.economy.groupUnrestCd.youth).toBe(3);
  }));

  it('коалиция — группы от 50; статус группы по порогам', () => {
    const c = coalitionOf({ ...all(40), pensioners: 60, workers: 55 });
    expect(c.members).toEqual(['pensioners', 'workers']);
    expect(c.weight).toBeCloseTo(0.4, 6);
    expect(groupStatus(65)).toBe('опора власти');
    expect(groupStatus(20)).toBe('в оппозиции');
  });
});
