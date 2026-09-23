import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  CB_PERSONAS, MOF_PERSONAS, PRESIDENT_PERSONAS, SCENARIOS, LEVERS, DIFFICULTIES,
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, botPresident, scaleLever,
} from '../engine.js';

/* ============================================================================
   СТЕНД ДЛИННЫХ ПАРТИЙ

   Три из последних замечаний игрока — капитализация 31 273% ВВП, биржевой
   индекс в миллионах пунктов и бот, ходивший мельче ползунка игрока — были
   найдены не тестом, а тем, что человек доиграл партию до больших чисел.
   Обычные юнит-тесты этого не ловят: каждый из них смотрит на один квартал
   или на одну функцию, а такие поломки копятся десятками кварталов.

   Здесь партия играется целиком — 120 кварталов (30 лет) по всем сценариям,
   персонам и сложностям — и на каждом квартале проверяются инварианты:
   ничего не NaN, ничего не улетает на порядки, отношения остаются
   правдоподобными, бот не выходит за пределы, доступные игроку.

   Math.random подменяется семенным генератором: иначе тест на 120 кварталов
   с шумом либо ловит ложные срабатывания, либо (если ослабить проверки) не
   ловит ничего. Несколько семян дают разные траектории, но каждая из них
   воспроизводима — упавший прогон всегда можно повторить по номеру семени.
============================================================================ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withSeed(seed, fn) {
  const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
  try { return fn(); } finally { spy.mockRestore(); }
}
afterEach(() => { vi.restoreAllMocks(); });

const QUARTERS = 120;

/* Диапазоны намеренно широкие: тест ловит не «баланс не такой, как хочется»,
   а «число перестало быть числом из этой вселенной». Проваливаться он должен
   только там, где показатель сломан, а не там, где партия сложилась плохо. */
const BANDS = {
  gdp: [1, 1e9],
  priceLevel: [1, 1e12],
  inflation: [-60, 1e4],
  unemployment: [0, 100],
  debtToGdp: [0, 1500],
  approval: [0, 100],
  politicalTension: [0, 100],
  keyRate: [0, 100],
  exchangeRate: [0.01, 1e9],
  stockIndex: [1, 1e12],
  // капитализация к ВВП — ровно тот показатель, который уезжал в 31 273%
  marketCapPctGdp: [0, 900],
  wellbeing: [0, 100],
  bankCapitalAdequacy: [0, 100],
  reserves: [0, 1e9],
  potentialGdp: [1, 1e9],
};

function checkEconomy(e, ctx) {
  Object.entries(BANDS).forEach(([key, [min, max]]) => {
    const v = e[key];
    if (v === undefined) return;
    if (!Number.isFinite(v)) throw new Error(`${ctx}: ${key} не число (${v})`);
    if (v < min || v > max) throw new Error(`${ctx}: ${key} = ${v} вне диапазона [${min}, ${max}]`);
  });
  // ни одно поле экономики не должно стать NaN/Infinity, даже не перечисленное выше
  Object.entries(e).forEach(([key, v]) => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`${ctx}: поле ${key} = ${v}`);
  });
}

/* Бот обязан оставаться в тех же границах и на той же сетке, что и игрок —
   это ровно то, на что жаловался игрок про налоги Минфина. Сравнивать надо не
   со статическим описанием рычага, а с тем ползунком, который игрок видит при
   этой экономике: часть рычагов масштабируется (scaleLever). Значение,
   унаследованное из состояния и ботом не тронутое, не проверяется: игрок тоже
   получает его как данность — например, курсовой ориентир после срыва
   фиксации оказывается далеко от нового рынка не по чьему-то ходу. */
function checkBotDecisions(decisions, economy, ctx) {
  LEVERS.forEach((base) => {
    const v = decisions[base.id];
    if (!Number.isFinite(v)) return;
    const inherited = economy[base.id];
    if (Number.isFinite(inherited) && Math.abs(v - inherited) < 1e-9) return;
    const l = scaleLever(base, economy);
    if (v < l.min - 1e-9 || v > l.max + 1e-9) throw new Error(`${ctx}: ${l.id} = ${v} вне ползунка [${l.min}, ${l.max}]`);
    const offGrid = Math.abs(v / l.step - Math.round(v / l.step));
    if (offGrid > 1e-6) throw new Error(`${ctx}: ${l.id} = ${v} не на сетке шага ${l.step}`);
  });
}

/* Один прогон партии: оба ведомства ведут боты, президент — тоже бот, то есть
   экономика крутится сама. Так проверяется именно движок, а не конкретная
   стратегия игрока. */
function playGame({ seed, scenario, difficulty, cbPersona, mofPersona, presPersona }) {
  return withSeed(seed, () => {
    let economy = makeInitialEconomy(scenario);
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {}; let stories = [];
    const ctxBase = `seed=${seed} ${scenario}/${difficulty}/${cbPersona}+${mofPersona}`;
    for (let q = 1; q <= QUARTERS; q++) {
      const ctx = `${ctxBase} q${q}`;
      const cb = botCentralBank(economy, cbPersona, difficulty);
      const mof = botFinanceMinistry(economy, mofPersona, difficulty);
      checkBotDecisions(cb.decisions, economy, `${ctx} ЦБ`);
      checkBotDecisions(mof.decisions, economy, `${ctx} Минфин`);
      const plan = botPresident(economy, presPersona, difficulty, { cooldowns: eventCooldowns });
      const merged = {
        ...decisions, ...cb.decisions, ...mof.decisions,
        presidentActive: true,
        presidentActions: (plan && plan.actions) || [],
      };
      const r = simulateQuarter({
        economy, decisions: merged, pendingImpulses, eventCooldowns,
        difficulty, quarterIndex: q, stories, botAction: cb, botActions: [mof],
      });
      economy = r.economy; pendingImpulses = r.pendingImpulses;
      eventCooldowns = r.eventCooldowns; stories = r.stories || stories;
      decisions = defaultDecisions(economy, decisions);
      checkEconomy(economy, ctx);
      // новости за квартал не должны содержать «дыр» от несобранных строк
      (r.newsEntries || []).forEach((n) => {
        if (/undefined|NaN|\[object/.test(`${n.headline} ${n.text}`)) {
          throw new Error(`${ctx}: в новости пустая подстановка — ${n.headline}`);
        }
      });
      // взаимоисключающие сюжеты не могут идти одновременно
      const ids = (stories || []).map((x) => x.tplId);
      if (ids.includes('commodity_down') && ids.includes('oil_up')) {
        throw new Error(`${ctx}: встречные сюжеты о сырье идут одновременно`);
      }
    }
    return economy;
  });
}

/* Отдельная партия при несвободном режиме: сюда попадают не только новости
   действий президента (их проверяет engine.test.js), но и всё, что газета
   печатает сама — голоса улицы, колонка «от редакции», сюжетные линии,
   комментарии к событиям. Проверка именно длинной партией не случайна: так и
   нашёлся голос обозревателя «До выборов 3 кв., рейтинг власти 0», который в
   стране без выборов повторялся из квартала в квартал, потому что счётчик до
   выборов там навсегда замер на последнем значении. */
function playUnfree({ seed, regime, presPersona, scenario, quarters, onNews }) {
  withSeed(seed, () => {
    let economy = { ...makeInitialEconomy(scenario), politicalRegime: regime,
      parliamentDissolved: true, noElections: regime === 'totalitarian' };
    let decisions = defaultDecisions(economy);
    let pendingImpulses = []; let eventCooldowns = {}; let stories = [];
    for (let q = 1; q <= quarters; q++) {
      const before = economy.politicalRegime;
      const cb = botCentralBank(economy, 'pragmatic', 'medium');
      const mof = botFinanceMinistry(economy, 'populist', 'medium');
      const plan = botPresident(economy, presPersona, 'medium', { cooldowns: eventCooldowns });
      const r = simulateQuarter({
        economy, decisions: { ...decisions, ...cb.decisions, ...mof.decisions,
          presidentActive: true, presidentActions: (plan && plan.actions) || [] },
        pendingImpulses, eventCooldowns, difficulty: 'medium', quarterIndex: q, stories,
        botAction: cb, botActions: [mof],
      });
      /* Квартал, в котором режим сменился, не проверяем: новость о падении
         режима пишет уже освобождённая пресса, и это правильно. */
      if (before === r.economy.politicalRegime && (before === 'authoritarian' || before === 'totalitarian')) {
        (r.newsEntries || []).forEach((n) => onNews(n, { q, regime: before, economy: r.economy }));
      }
      economy = r.economy; pendingImpulses = r.pendingImpulses;
      eventCooldowns = r.eventCooldowns; stories = r.stories || stories;
      decisions = defaultDecisions(economy, decisions);
    }
  });
}

describe('голос режима в длинной партии', () => {
  /* Тот же словарь свободной печати, что и в engine.test.js: признаки взгляда
     со стороны — чужой рейтинг власти, оппозиция, независимые институты,
     опросы про настроения, признание раскола наверху. */
  const FREE_PRESS = new RegExp([
    'рейтинг власти', 'при рейтинге', 'оппозици',
    'независим(ые|ых|ая|ой) (медиа|СМИ|суд|пресс)',
    'профсоюзы объявляют протест', 'раскол (в )?элит',
    'опросы (фиксируют|показывают)', 'объединяются против власти',
    'сменить эту власть', 'свободн(ые|ых) выбор',
  ].join('|'), 'i');

  ['authoritarian', 'totalitarian'].forEach((regime) => {
    it(`${regime}: за 60 кварталов газета ни разу не заговорила языком свободной прессы`, () => {
      ['strongman', 'populist', 'reformer'].forEach((pres, i) => {
        playUnfree({ seed: 900 + i, regime, presPersona: pres, scenario: 'sandbox', quarters: 60,
          onNews: (n, ctx) => {
            const printed = `${n.headline} ${n.text}`;
            const bad = FREE_PRESS.exec(printed);
            if (bad) throw new Error(`${regime}/${pres} q${ctx.q}: «${bad[0]}» в тексте — ${n.headline}`);
          } });
      });
    });
  });

  it('там, где выборы отменены, газета о них не пишет', () => {
    playUnfree({ seed: 951, regime: 'totalitarian', presPersona: 'strongman', scenario: 'sandbox', quarters: 60,
      onNews: (n, ctx) => {
        if (!ctx.economy.noElections) return;
        const printed = `${n.headline} ${n.text}`;
        if (/до выборов|предвыборн|у урны|избирател/i.test(printed)) {
          throw new Error(`q${ctx.q}: в стране без выборов напечатано «${printed.slice(0, 120)}»`);
        }
      } });
  });
});

describe('длинная партия: 120 кварталов не ломают экономику', () => {
  const seeds = [1, 7, 20260922];
  SCENARIOS.forEach((sc) => {
    it(`сценарий «${sc.title}» переживает 30 лет на трёх семенах`, () => {
      seeds.forEach((seed) => {
        expect(() => playGame({
          seed, scenario: sc.id, difficulty: 'medium',
          cbPersona: 'pragmatic', mofPersona: 'technocrat', presPersona: 'technocrat',
        })).not.toThrow();
      });
    });
  });

  it('любая пара персон ведомств и любая сложность доживают до конца партии', () => {
    let n = 0;
    DIFFICULTIES.forEach((d) => {
      CB_PERSONAS.forEach((cb) => {
        MOF_PERSONAS.forEach((mof) => {
          n += 1;
          expect(() => playGame({
            seed: 100 + n, scenario: 'sandbox', difficulty: d.id,
            cbPersona: cb.id, mofPersona: mof.id, presPersona: 'technocrat',
          })).not.toThrow();
        });
      });
    });
    expect(n).toBeGreaterThan(8);
  });

  it('любой характер президента не выводит партию за пределы разумного', () => {
    PRESIDENT_PERSONAS.forEach((p, i) => {
      expect(() => playGame({
        seed: 500 + i, scenario: 'sandbox', difficulty: 'hard',
        cbPersona: 'hawk', mofPersona: 'populist', presPersona: p.id,
      })).not.toThrow();
    });
  });

  it('одно и то же семя даёт одну и ту же партию (иначе баг не воспроизвести)', () => {
    const a = playGame({ seed: 42, scenario: 'sandbox', difficulty: 'medium',
      cbPersona: 'pragmatic', mofPersona: 'technocrat', presPersona: 'technocrat' });
    const b = playGame({ seed: 42, scenario: 'sandbox', difficulty: 'medium',
      cbPersona: 'pragmatic', mofPersona: 'technocrat', presPersona: 'technocrat' });
    expect(a.gdp).toBe(b.gdp);
    expect(a.priceLevel).toBe(b.priceLevel);
    expect(a.approval).toBe(b.approval);
  });
});
