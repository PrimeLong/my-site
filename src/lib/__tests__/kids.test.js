import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  SCENARIOS, makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, botPresident, PRESIDENT_ACTIONS, presActionAvailable,
} from '../engine.js';
import { kidsBlocked } from '../politics/president.js';
import { KIDS_AGE, PARENT_AGE, ageFromYear, isKid, needsParent, kidsModeOf, validBirthYear } from '../age.js';

/* Детский режим «Мира»: до 16 лет (или по выбору в профиле) в партии нет войн, присоединений,
   переворотов и несвободных режимов — ни в решениях, ни в событиях, ни в газете. Партии
   длинные и с ботом-президентом самого жёсткого характера: если что-то из этого может
   случиться, оно здесь случится. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
afterEach(() => { vi.restoreAllMocks(); });

// слова, которых в детском режиме не должно быть ни в заголовке, ни в тексте новости
const ADULT = /войн|военн(ая|ый|ую|ой|ые) (операц|переворот|положен)|переворот|аннекс|присоедин|оккупац|мобилизац|тоталитар|диктат|роспуск парламента|парламент распущен|(подавлен|разогна)[а-яё]* (сил|демонстр|протест|мятеж|митинг)|беспорядки подавлены|(^|[^а-яё])танк|(^|[^а-яё])оружи/i;

function play({ seed, scenario, pres, quarters, kids, difficulty = 'hard', presidentActions = null }) {
  const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
  try {
    let economy = { ...makeInitialEconomy(scenario), ...(kids ? { kidsMode: true } : {}) };
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {}; let stories = [];
    const seen = { regimes: new Set(), war: 0, annexed: 0, news: [], coups: 0 };
    for (let q = 1; q <= quarters; q += 1) {
      const cb = botCentralBank(economy, 'dove', difficulty);
      const mof = botFinanceMinistry(economy, 'populist', difficulty);
      const plan = botPresident(economy, pres, difficulty, { cooldowns: eventCooldowns });
      const r = simulateQuarter({
        economy, decisions: { ...decisions, ...cb.decisions, ...mof.decisions, presidentActive: true,
          presidentActions: presidentActions || (plan && plan.actions) || [] },
        pendingImpulses, eventCooldowns, difficulty, quarterIndex: q, stories, botAction: cb, botActions: [mof],
      });
      economy = r.economy; pendingImpulses = r.pendingImpulses; eventCooldowns = r.eventCooldowns; stories = r.stories || stories;
      decisions = defaultDecisions(economy, decisions);
      seen.regimes.add(economy.politicalRegime);
      if ((economy.warQuartersLeft || 0) > 0) seen.war += 1;
      seen.annexed = Math.max(seen.annexed, (economy.annexed || []).length);
      if (economy.lastElection && economy.lastElection.coup) seen.coups += 1;
      (r.newsEntries || []).forEach((n) => seen.news.push({ q, text: `${n.headline} ${n.text}` }));
    }
    return { economy, seen };
  } finally { spy.mockRestore(); }
}

describe('возраст: год рождения', () => {
  const now = Date.UTC(2026, 9, 5);
  it('по году рождения считаем младший возможный возраст: день рождения мог ещё не наступить', () => {
    expect(ageFromYear(2010, now)).toBe(15);
    expect(ageFromYear(2000, now)).toBe(25);
    expect(KIDS_AGE).toBe(16); expect(PARENT_AGE).toBe(14);
    expect(isKid(2010, now)).toBe(true);   // в 2026 году ему 15 или 16 — считаем 15
    expect(isKid(2009, now)).toBe(false);  // 16 или 17
    expect(needsParent(2012, now)).toBe(true);  // 13 или 14
    expect(needsParent(2011, now)).toBe(false); // 14 или 15
  });
  it('год проверяется: от 100 лет назад до 4 лет назад, целое число', () => {
    expect(validBirthYear(2010, now)).toBe(true);
    expect(validBirthYear(1926, now)).toBe(true);
    expect(validBirthYear(1925, now)).toBe(false);
    expect(validBirthYear(2023, now)).toBe(false);
    expect(validBirthYear('2010', now)).toBe(false);
    expect(validBirthYear(2010.5, now)).toBe(false);
  });
  it('до 16 детский режим включён всегда; старше — по выбору; год не указан — включён', () => {
    expect(kidsModeOf({ birthYear: 2012 }, now)).toBe(true);
    expect(kidsModeOf({ birthYear: 2012, kidsMode: false }, now)).toBe(true);
    expect(kidsModeOf({ birthYear: 1990 }, now)).toBe(false);
    expect(kidsModeOf({ birthYear: 1990, kidsMode: true }, now)).toBe(true);
    expect(kidsModeOf({}, now)).toBe(true);
    expect(kidsModeOf(null, now)).toBe(true);
  });
});

describe('детский режим «Мира»', () => {
  it('указы о войне, роспуске парламента, силовом подавлении и параде недоступны', () => {
    const e = { ...makeInitialEconomy('sandbox'), kidsMode: true, politicalTension: 70, warQuartersLeft: 0 };
    const blocked = PRESIDENT_ACTIONS.filter((a) => kidsBlocked(a)).map((a) => a.id);
    expect(blocked).toEqual(expect.arrayContaining(['war_start', 'mobilization', 'seize_control', 'dissolve', 'crackdown', 'military_parade']));
    blocked.forEach((id) => expect(presActionAvailable(PRESIDENT_ACTIONS.find((a) => a.id === id), e, {}), id).toBe(false));
    // реформы, обращение и дипломатия остаются
    ['address', 'labor', 'trade_bloc'].forEach((id) => expect(kidsBlocked(PRESIDENT_ACTIONS.find((a) => a.id === id)), id).toBe(false));
  });

  it('указы, пришедшие в решениях напрямую, движок тоже не проводит', () => {
    const { seen } = play({ seed: 3, scenario: 'sandbox', pres: 'strongman', quarters: 16, kids: true,
      presidentActions: ['war_start', 'dissolve', 'crackdown', 'military_parade', 'mobilization'] });
    expect(seen.war).toBe(0);
    expect([...seen.regimes].every((r) => r === 'democracy' || r === 'crisis')).toBe(true);
  });

  it('длинные партии без войн, присоединений, переворотов и несвободных режимов — и без них в газете', () => {
    const scenarios = SCENARIOS.filter((sc) => !sc.noRoles).map((sc) => sc.id);
    let n = 0;
    scenarios.forEach((scenario, i) => {
      ['strongman', 'populist'].forEach((pres, j) => {
        const { seen } = play({ seed: 40 + i * 7 + j, scenario, pres, quarters: 60, kids: true });
        const ctx = `${scenario}/${pres}`;
        expect(seen.war, `${ctx}: война`).toBe(0);
        expect(seen.annexed, `${ctx}: присоединение`).toBe(0);
        expect(seen.coups, `${ctx}: переворот на выборах`).toBe(0);
        expect([...seen.regimes].filter((r) => r !== 'democracy' && r !== 'crisis'), `${ctx}: режим`).toEqual([]);
        seen.news.forEach((x) => { const m = ADULT.exec(x.text); expect(m, `${ctx} q${x.q}: «${m && m[0]}» в «${m && x.text.slice(Math.max(0, m.index - 80), m.index + 60)}»`).toBeNull(); });
        n += seen.news.length;
      });
    });
    expect(n).toBeGreaterThan(500);
  });

  it('тот же жёсткий президент без детского режима до этого доходит — тест не пустой', () => {
    let hard = 0;
    for (let seed = 1; seed <= 6 && !hard; seed += 1) {
      const { seen } = play({ seed, scenario: 'sandbox', pres: 'strongman', quarters: 60, kids: false });
      hard += seen.war + seen.coups + [...seen.regimes].filter((r) => r === 'authoritarian' || r === 'totalitarian').length
        + seen.news.filter((x) => ADULT.test(x.text)).length;
    }
    expect(hard).toBeGreaterThan(0);
  });

  it('флаг живёт в состоянии партии из квартала в квартал', () => {
    const { economy } = play({ seed: 9, scenario: 'sandbox', pres: 'reformer', quarters: 3, kids: true });
    expect(economy.kidsMode).toBe(true);
  });
});
