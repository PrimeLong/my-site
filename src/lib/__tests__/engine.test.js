import { describe, it, expect, vi } from 'vitest';
import {
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction,
  clamp, LEVERS, FX_REGIMES, PROMISE_POOL, pickPromises, evaluatePromise,
  POLITICAL_REGIME_INFO, propagandaEditorial, leverPreview, fmtMln, fmtMlnSigned, mlnScale,
  ROLES, PRESIDENT_ACTIONS, PRES_BY_ID, reformShare, politicalCapitalRegen,
  processPresidentialDirective, APPOINT_COST, PRES_DIRECTIVE_COST,
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
    const base = runPresident({}, 16);
    const ref = runPresident({ 2: { presidentActions: ['pension'] } }, 16);
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
const PRES_GROUPS = ['public', 'reform', 'power'];
