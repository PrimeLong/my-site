import { describe, it, expect, vi } from 'vitest';
import {
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction,
  clamp, LEVERS, FX_REGIMES, PROMISE_POOL, pickPromises, evaluatePromise,
  POLITICAL_REGIME_INFO, propagandaEditorial, leverPreview,
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
      expect(economy.activeCrises).toEqual([]);
    }
    expect(economy.regime).toBe('normal');
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

  it('rigs the election in favour of the incumbent once the regime has turned authoritarian or totalitarian', () => {
    for (const regime of ['authoritarian', 'totalitarian']) {
      const economy = { ...makeInitialEconomy(), politicalRegime: regime, quartersToElection: 1, approval: 8 };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.economy.electionResult).toBe('incumbent');
    }
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
    let economy = { ...makeInitialEconomy(), approval: 30, bankCapital: 4, bankLiquidity: 0 };
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {};
    for (let q = 1; q <= 25; q++) {
      const r = simulateQuarter({ economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'medium', quarterIndex: q, stories: [], noEvents: true });
      economy = { ...r.economy, bankCapital: 4 }; // не даём банковскому кризису рассосаться самому
      pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns;
      decisions = defaultDecisions(economy, decisions);
    }
    expect(economy.activeCrises).toContain('banking');
    expect(economy.politicalTension).toBeGreaterThan(60);
    expect(economy.politicalRegime).not.toBe('democracy');
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
      const economy = { ...makeInitialEconomy(), politicalRegime: 'democracy', quartersToElection: 1, approval: 45, politicalTension: 10 };
      const decisions = defaultDecisions(economy);
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: 1, stories: [] });
      expect(r.economy.electionResult).toBe('opposition');
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
    const economy = { ...makeInitialEconomy(), politicalRegime: 'totalitarian', quartersToElection: 1, approval: 31 };
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

describe('pandemic crisis tracking', () => {
  it('shows up in activeCrises/regime for a few quarters, then clears', () => {
    // pandemicQuartersLeft: 3 здесь эквивалентно "квартал сразу после срабатывания
    // события" (на самом триггере счётчик становится 3 без декремента) — отсюда
    // ещё 2 активных квартала до истечения, всего 3 квартала кризиса от триггера
    let economy = { ...makeInitialEconomy(), pandemicQuartersLeft: 3 };
    let decisions = defaultDecisions(economy);
    const seen = [];
    for (let q = 1; q <= 5; q++) {
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: q, stories: [] });
      economy = r.economy;
      decisions = defaultDecisions(economy, decisions);
      seen.push(economy.activeCrises.includes('pandemic'));
    }
    expect(seen).toEqual([true, true, false, false, false]);
    expect(economy.regime).not.toBe('pandemic');
  });
});
