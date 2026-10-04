/* Этап 3: персональная программа (уровень, слабые темы, «рекомендуем сейчас», вступительный
   тест) и награды (монеты, курс, лавка, заморозки, задания дня, сундук, печати, испытание месяца). */
import { describe, it, expect } from 'vitest';
import { LESSON_BY_ID, UNIT_BY_ID, EXERCISES, buildLesson, buildPractice, buildPlacement, placementOpened, placementFailed, pathState, pilotUnits, PLACE_PER_UNIT, PRACTICE_MIN, HARD_IN_PRACTICE } from '../course.js';
import { skillLevel, weakLessons, recommend, courseCtx, lessonOpts, theoryNotice } from '../program.js';
import { evalExpr, fmtResult, pressRoot } from '../calc.js';
import {
  balance, earn, runCoins, rateOn, rateHistory, priceOf, buy, setWear, outfitOf, FREEZE, BOOST, OUTFITS, shopDay, SHOWCASE_SIZE, DEAL_OFF, boostActive, questsFor, openChest, chestCoins, chestKey,
  settle, monthChallenge, achievementsOf, hash01, COIN,
} from '../rewards.js';
import {
  emptyLearn, recordAttempt, finishLesson, setProfile, setPlacement, passUnit, normalizeLearn, mergeLearn, streak, applyFreezes, ownedFreezes,
  dayOf, addDays, weekDots, dailyOf, MAX_FREEZES, goalToday,
} from '../../textbook/learn-state.js';

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const T = at('2026-09-28');
const withRecent = (s, str) => ({ ...s, recent: str, recentAt: T });
// урок пройден в заданный день
const lessonOn = (s, id, day, accuracy = 80) => finishLesson(s, id, { xp: 10, accuracy, now: at(day), seconds: 240, kind: LESSON_BY_ID[id] ? LESSON_BY_ID[id].kind : null });

describe('ответы при регистрации', () => {
  it('цель, минуты и знания сохраняются, неверные значения отбрасываются, едут через чистку и слияние', () => {
    let s = setProfile(emptyLearn(), { goal: 'olymp', minutes: 15, knows: true }, T);
    expect(s.profile).toEqual({ goal: 'olymp', minutes: 15, knows: true, at: T });
    s = setProfile(s, { goal: 'nope', minutes: 7 }, T + 1);
    expect(s.profile.goal).toBe('olymp');
    expect(s.profile.minutes).toBe(15);
    expect(normalizeLearn(JSON.parse(JSON.stringify(s))).profile).toEqual(s.profile);
    const older = setProfile(emptyLearn(), { goal: 'self', minutes: 5, knows: false }, T - 10);
    expect(mergeLearn(older, s).profile.goal).toBe('olymp');
    expect(mergeLearn(s, older).profile.goal).toBe('olymp');
  });
});

describe('уровень сложности', () => {
  it('меньше десяти ответов — обычный; выше 90% — повышенный, ниже 60% — по шагам; олимпиадникам — порог 85%', () => {
    const s = emptyLearn();
    expect(skillLevel(withRecent(s, '111111111'))).toBe('normal');
    expect(skillLevel(withRecent(s, '1111111111'))).toBe('hard');
    expect(skillLevel(withRecent(s, '1111111110'))).toBe('normal');
    expect(skillLevel(withRecent(s, '1100110000'))).toBe('easy');
    const olymp = setProfile(s, { goal: 'olymp' }, T);
    expect(skillLevel(withRecent(olymp, '11111111111111111110'))).toBe('hard');
    expect(skillLevel(withRecent(s, '11111111111111111110'))).toBe('hard');
    expect(skillLevel(withRecent(s, '11111111111111111100'))).toBe('normal');
    expect(skillLevel(withRecent(olymp, '1111111111111111110' + '0'))).toBe('hard');
  });
  it('recordAttempt: последние 30 первых попыток и точность по уроку в окне ~20', () => {
    let s = emptyLearn();
    for (let k = 0; k < 40; k += 1) s = recordAttempt(s, 'choice', k % 4 !== 0, 1000, { lesson: 'sd-l1', run: k, now: T });
    expect(s.recent).toHaveLength(30);
    expect(s.topics['sd-l1'].n).toBe(20);
    expect(s.topics['sd-l1'].ok / s.topics['sd-l1'].n).toBeCloseTo(0.75, 1);
    expect(dailyOf(s, T).c).toBe(30);
    // серия дня не длиннее сегодняшних верных ответов (урок, начатый вчера, её не приносит)
    expect(dailyOf(s, T).r).toBe(30);
  });
  it('«по шагам»: в выборе ответа три варианта и разбор по шагам; «повышенный»: в практике задачи семинара и олимпиады', () => {
    let easyChoices = 0;
    for (let seed = 0; seed < 10; seed += 1) {
      const p = buildLesson('sd-l1', () => ((seed * 7919 + 1) % 97) / 97, { level: 'easy' });
      p.items.forEach((it) => {
        expect(it.steps).toBe(true);
        if (it.kind === 'choice' || it.kind === 'gap') { expect(it.options.length).toBeLessThanOrEqual(3); expect(it.options.filter((o) => o.correct)).toHaveLength(1); easyChoices += 1; }
      });
    }
    expect(easyChoices).toBeGreaterThan(0);
    for (const id of ['sc-l1', 'sd-l1']) {
      const p = buildLesson(id, Math.random, { level: 'hard' });
      const hard = p.items.filter((it) => it.hard);
      expect(hard.length, id).toBe(HARD_IN_PRACTICE);
      hard.forEach((it) => expect([2, 3]).toContain(it.hard));
      expect(p.items.length).toBeGreaterThanOrEqual(10);
      expect(p.items.length).toBeLessThanOrEqual(15);
    }
    // обычный уровень ничего не меняет
    expect(buildLesson('sd-l1', Math.random, { level: 'normal' }).items.some((it) => it.hard || it.steps)).toBe(false);
  });
});

describe('слабые темы и «рекомендуем сейчас»', () => {
  const done = (ids) => ids.reduce((s, id) => lessonOn(s, id, '2026-09-27'), emptyLearn());
  const topics = (s, map) => ({ ...s, topics: Object.fromEntries(Object.entries(map).map(([id, [ok, n]]) => [id, { ok, n }])) });
  it('слабая тема — пройденный урок с точностью ниже 70% (от четырёх попыток), слабейшие первыми', () => {
    const s = topics(done(['sc-i1', 'sc-l1', 'sc-l2']), { 'sc-i1': [9, 10], 'sc-l1': [2, 6], 'sc-l2': [3, 5], 'sc-l3': [0, 5] });
    expect(weakLessons(s).map((w) => w.id)).toEqual(['sc-l1', 'sc-l2']);
    expect(lessonOpts(s).weak).toEqual(['sc-l1', 'sc-l2']);
  });
  it('рекомендуем: урок с точностью ниже 60%, если он открыт; иначе — следующая остановка', () => {
    const base = done(['sc-i1', 'sc-l1', 'sc-l2']);
    const cur = pathState(base).find((x) => x.current).current.id;
    expect(recommend(base)).toEqual({ lessonId: cur, why: 'next' });
    expect(recommend(topics(base, { 'sc-l2': [3, 5] })).lessonId).toBe(cur);
    const r = recommend(topics(base, { 'sc-l1': [1, 5], 'sc-l2': [2, 5] }));
    expect(r.lessonId).toBe('sc-l1');
    expect(r.why).toBe('weak');
  });
  it('«Повторение» ставит упражнения слабых уроков раньше остальных; практика добирает слабыми темами до восьми', () => {
    const rev = Object.values(LESSON_BY_ID).find((l) => l.kind === 'review');
    const unit = UNIT_BY_ID[rev.unitId];
    const weakId = unit.lessons.find((l) => l.kind === 'practice' && l.no < rev.no).id;
    for (let seed = 0; seed < 5; seed += 1) {
      const p = buildLesson(rev.id, Math.random, { weak: [weakId] });
      const fromWeak = p.items.filter((it) => EXERCISES[it.id].lesson === weakId).length;
      const poolWeak = LESSON_BY_ID[weakId].exercises.filter((e) => !['swipe', 'rush'].includes(e.kind)).length;
      expect(fromWeak).toBe(Math.min(poolWeak, p.items.length));
    }
    const pr = buildPractice([], Math.random, { weak: [weakId] });
    expect(pr.items).toHaveLength(PRACTICE_MIN);
    pr.items.forEach((it) => { expect(it.weak).toBe(true); expect(EXERCISES[it.id].lesson).toBe(weakId); });
    expect(buildPractice([], Math.random).items).toHaveLength(0);
  });
});

describe('вступительный тест', () => {
  const plan = buildPlacement(Math.random);
  const answer = (wrongByUnit) => {
    const first = {}; const seen = {};
    plan.items.forEach((it) => { seen[it.placeUnit] = (seen[it.placeUnit] || 0) + 1; first[it.uid] = seen[it.placeUnit] > (wrongByUnit[it.placeUnit] || 0); });
    return first;
  };
  it('по пять упражнений на каждый юнит Пути, по порядку; без мини-игр', () => {
    const units = pilotUnits().map((u) => u.id);
    expect(plan.items).toHaveLength(units.length * PLACE_PER_UNIT);
    expect([...new Set(plan.items.map((it) => it.placeUnit))]).toEqual(units);
    plan.items.forEach((it) => expect(['swipe', 'rush']).not.toContain(it.kind));
  });
  it('юнит открыт, если в пятёрке не больше одной ошибки; первая проваленная пятёрка останавливает', () => {
    expect(placementOpened(plan.items, answer({}))).toEqual(['scarcity', 'supply-demand', 'elasticity', 'consumer']);
    expect(placementOpened(plan.items, answer({ 'supply-demand': 1 }))).toEqual(['scarcity', 'supply-demand', 'elasticity', 'consumer']);
    expect(placementOpened(plan.items, answer({ 'supply-demand': 2 }))).toEqual(['scarcity']);
    expect(placementOpened(plan.items, answer({ scarcity: 2 }))).toEqual([]);
    const first = answer({ scarcity: 2 });
    expect(placementFailed(plan.items, first, 'scarcity')).toBe(true);
    expect(placementFailed(plan.items, first, 'supply-demand')).toBe(false);
  });
  it('открытые тестом юниты — уроки открыты, но не пройдены: ни сундука, ни печатей за них', () => {
    const s = setPlacement(passUnit(emptyLearn(), 'scarcity', { now: T }), ['scarcity'], T);
    const st = pathState(s);
    expect(st[0].complete).toBe(false);
    expect(st[0].lessons.every((l) => l.open && !l.done)).toBe(true);
    expect(st[1].lessons[0].open).toBe(true);
    expect(courseCtx(s).lessonsDone).toBe(0);
    expect(courseCtx(s).unitsDone).toBe(0);
    // печать за тест не выдаётся; «Знаток» — только за проверку юнита без ошибок
    expect(settle(s, courseCtx(s), T).gains.map((g) => g.key)).not.toContain('a:ace');
    const ace = passUnit(emptyLearn(), 'scarcity', { ace: true, now: T });
    expect(settle(ace, courseCtx(ace), T).gains.map((g) => g.key)).toContain('a:ace');
    expect(mergeLearn(ace, s).units.scarcity.ace).toBe(T);
    expect(normalizeLearn(JSON.parse(JSON.stringify(s))).placement).toEqual({ at: T, opened: ['scarcity'] });
  });
});

describe('монеты и курс', () => {
  it('за урок впервые — 10 (без ошибок — 15), повтор — 2, практика — 5, проверка — 20 только при сдаче', () => {
    expect(runCoins({ mode: 'lesson', accuracy: 80 })).toBe(10);
    expect(runCoins({ mode: 'lesson', accuracy: 100 })).toBe(15);
    expect(runCoins({ mode: 'lesson', replay: true, accuracy: 100 })).toBe(2);
    expect(runCoins({ mode: 'practice', items: 5 })).toBe(5);
    expect(runCoins({ mode: 'check', pass: false })).toBe(0);
    expect(runCoins({ mode: 'check', pass: true })).toBe(20);
    expect(runCoins({ mode: 'placement' })).toBe(0);
  });
  it('награда с ключом — один раз; баланс — заработано минус потрачено', () => {
    let s = earn(emptyLearn(), 30, 'x', T);
    s = earn(s, 30, 'x', T);
    s = earn(s, 5, null, T);
    expect(balance(s)).toBe(35);
  });
  it('курс колеблется вокруг единицы в пределах 0,8–1,25, одинаков для всех и в течение дня', () => {
    const hist = rateHistory('2026-09-28', 120).map((r) => r.rate);
    hist.forEach((r) => { expect(r).toBeGreaterThanOrEqual(0.8); expect(r).toBeLessThanOrEqual(1.25); });
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    expect(Math.abs(mean - 1)).toBeLessThan(0.05);
    expect(new Set(hist).size).toBeGreaterThan(5);
    expect(rateOn('2026-09-28')).toBe(rateOn('2026-09-28'));
    expect(priceOf('tophat', '2026-09-28')).toBe(Math.ceil(900 * rateOn('2026-09-28')));
  });
});

describe('лавка и заморозки', () => {
  const rich = earn(emptyLearn(), 20000, null, T);
  const day = dayOf(T);
  it('покупка списывает цену по курсу дня; денег не хватает — не покупается; наряд — один раз, сразу надет', () => {
    const { showcase, deal } = shopDay(rich, day);
    const id = showcase.find((x) => x !== deal);
    const o = OUTFITS.find((x) => x.id === id);
    const r = buy(rich, id, T);
    expect(r.ok).toBe(true);
    expect(balance(r.s)).toBe(20000 - priceOf(id, day));
    expect(outfitOf(r.s)[o.slot]).toBe(id);
    expect(buy(r.s, id, T).ok).toBe(false);
    expect(buy(emptyLearn(), id, T).reason).toMatch(/Не хватает/);
    // снять и надеть можно только купленное и в свой слот
    expect(outfitOf(setWear(r.s, o.slot, null, T))[o.slot]).toBe(null);
    const other = OUTFITS.find((x) => x.slot !== o.slot);
    expect(outfitOf(setWear(r.s, other.slot, id, T))[other.slot]).toBe(null);
  });
  it('цены: обычные вещи — 150–1500 крон, редкие — от 2500; всю лавку за неделю не скупить', () => {
    OUTFITS.forEach((o) => {
      if (o.rare) expect(o.crowns, o.id).toBeGreaterThanOrEqual(2500);
      else { expect(o.crowns, o.id).toBeGreaterThanOrEqual(150); expect(o.crowns, o.id).toBeLessThanOrEqual(1500); }
    });
    const total = OUTFITS.reduce((a, o) => a + o.crowns, 0);
    // старательный ученик: три урока без ошибок, все задания, цель — около 120 монет в день
    expect(total / 120).toBeGreaterThan(90);
    expect(new Set(OUTFITS.map((o) => o.slot))).toEqual(new Set(['head', 'face', 'neck', 'hand', 'frame']));
    expect(OUTFITS.filter((o) => o.rare).length).toBeGreaterThanOrEqual(3);
  });
  it('витрина дня: шесть некупленных обычных вещей, одинаковая у всех и меняется по дням; скидка дня — 30% на одну', () => {
    const a = shopDay(emptyLearn(), day);
    expect(a.showcase).toHaveLength(SHOWCASE_SIZE);
    a.showcase.forEach((id) => expect(OUTFITS.find((o) => o.id === id).rare).toBeFalsy());
    expect(shopDay(emptyLearn(), day)).toEqual(a);
    const days = Array.from({ length: 7 }, (_, k) => shopDay(emptyLearn(), addDays(day, k)).showcase.join());
    expect(new Set(days).size).toBeGreaterThan(4);
    expect(priceOf(a.deal, day, emptyLearn())).toBe(Math.ceil(priceOf(a.deal, day) * 0.7));
    expect(priceOf(a.showcase[1], day, emptyLearn())).toBe(priceOf(a.showcase[1], day));
    // покупка витрину дня не меняет: купленное остаётся на месте («Надеть»), скидка — на той же вещи
    const r = buy(rich, a.showcase[2], T).s;
    expect(shopDay(r, day)).toEqual(shopDay(rich, day));
    const r2 = buy(rich, a.deal, T).s;
    expect(shopDay(r2, day).deal).toBe(a.deal);
    // назавтра купленное уходит — на его место встаёт следующая вещь
    const next = addDays(day, 1);
    expect(shopDay(r, next).showcase).not.toContain(a.showcase[2]);
    expect(shopDay(r, next).showcase).toHaveLength(SHOWCASE_SIZE);
    // вещи не с витрины сегодня не купить; редкие — всегда
    const off = OUTFITS.find((o) => !o.rare && !a.showcase.includes(o.id));
    expect(buy(rich, off.id, T).reason).toMatch(/витрин/);
    expect(buy(rich, a.rare[0], T).ok).toBe(true);
    expect(DEAL_OFF).toBe(0.3);
  });
  it('редкие вещи: у каждой своя подпись про анимацию; купленный «Золотой слиток» становится шаром «Инфляция»', () => {
    OUTFITS.filter((o) => o.rare).forEach((o) => expect(o.note, o.id).toBeTruthy());
    expect(OUTFITS.find((o) => o.id === 'goldbar')).toBeUndefined();
    const s = normalizeLearn({ owned: { goldbar: T, cap: T }, wear: { hand: 'goldbar', head: 'cap', at: T } });
    expect(s.owned).toEqual({ balloon: T, cap: T });
    expect(outfitOf(s).hand).toBe('balloon');
  });
  it('«двойной опыт»: полчаса после покупки, второй раз во время действия не купить', () => {
    const r = buy(rich, BOOST.id, T);
    expect(r.ok).toBe(true);
    expect(boostActive(r.s, T + 60000)).toBe(true);
    expect(boostActive(r.s, T + 31 * 60000)).toBe(false);
    expect(buy(r.s, BOOST.id, T + 60000).ok).toBe(false);
    expect(normalizeLearn(r.s).boost).toBe(T + BOOST.minutes * 60000);
  });
  it('заморозок в запасе — не больше двух', () => {
    let s = rich;
    for (let k = 0; k < MAX_FREEZES; k += 1) { const r = buy(s, FREEZE.id, T); expect(r.ok).toBe(true); s = r.s; }
    expect(ownedFreezes(s)).toBe(MAX_FREEZES);
    expect(buy(s, FREEZE.id, T).ok).toBe(false);
  });
  it('купленная заморозка спасает второй пропуск в неделе, и только если за пропуском есть занятия', () => {
    // пн 21.09 и чт 24.09 занимался, вт и ср пропустил, пт–вс занимался; сегодня пн 28.09
    let s = ['2026-09-21', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].reduce((acc, d) => lessonOn(acc, 'sc-i1', d), emptyLearn());
    expect(streak(s, T).days).toBe(4);
    s = earn(s, 100, null, T);
    s = buy(s, FREEZE.id, T).s;
    const t = applyFreezes(s, T);
    expect(Object.keys(t.frozen)).toHaveLength(1);
    expect(streak(t, T).days).toBe(5);
    expect(ownedFreezes(t)).toBe(0);
    expect(applyFreezes(t, T)).toBe(t);
    // ни одного занятия за пропуском — заморозка не тратится
    const empty = buy(earn(emptyLearn(), 100, null, T), FREEZE.id, T).s;
    expect(applyFreezes(empty, T)).toBe(empty);
    // неделя экрана серии: семь дней, сегодня — последний
    const dots = weekDots(t, T);
    expect(dots).toHaveLength(7);
    expect(dots[6].today).toBe(true);
    expect(dots.filter((d) => d.frozen)).toHaveLength(1);
  });
});

describe('задания дня, сундук, печати, испытание месяца', () => {
  it('три задания: про уроки, про ответы, про опыт или новый урок; размер — от цели в минутах; набор одинаков весь день', () => {
    const s = setProfile(emptyLearn(), { minutes: 15 }, T);
    const q = questsFor(s, T);
    expect(q).toHaveLength(3);
    // минуты — это цель дня, заданием они не дублируются
    expect(q.map((x) => x.id)).not.toContain('minutes');
    expect(['lessons', 'perfect']).toContain(q[0].id);
    expect(['correct', 'run']).toContain(q[1].id);
    expect(['xp', 'fresh']).toContain(q[2].id);
    q.forEach((x) => expect(x).toMatchObject({ have: 0, done: false }));
    expect(questsFor(s, T + 3600e3).map((x) => x.id)).toEqual(q.map((x) => x.id));
    const ids = new Set();
    for (let d = 0; d < 30; d += 1) questsFor(s, T + d * 86400e3).forEach((x) => ids.add(x.id));
    expect(ids.size).toBe(6);
    // больше минут в цели — больше задания
    const small = setProfile(emptyLearn(), { minutes: 5 }, T);
    const sum = (st) => { let n = 0; for (let d = 0; d < 30; d += 1) questsFor(st, T + d * 86400e3).forEach((x) => { n += x.target; }); return n; };
    expect(sum(s)).toBeGreaterThan(sum(small));
  });
  it('новый день начинается с нуля: вчерашний урок, законченный после полуночи, не выполняет задания', () => {
    const late = new Date(2026, 8, 29, 0, 1).getTime();
    let s = setProfile(emptyLearn(), { minutes: 10 }, T);
    // урок шёл с вечера: двенадцать верных подряд, законченных в 00:01
    for (let k = 0; k < 12; k += 1) s = recordAttempt(s, 'choice', true, 1000, { lesson: 'sc-l1', run: k + 1, now: k < 11 ? T : late });
    const d = dailyOf(s, late);
    expect(d.c).toBe(1);
    expect(d.r).toBe(1);
    s = finishLesson(s, 'sc-l1', { xp: 10, accuracy: 100, now: late, seconds: 900 });
    expect(goalToday(s, late).done).toBe(1);
  });
  it('выполненные задания и цель дня приносят монеты один раз; все три — ещё бонус', () => {
    let s = setProfile(emptyLearn(), { minutes: 5 }, T);
    for (let k = 0; k < 20; k += 1) s = recordAttempt(s, 'choice', true, 1000, { lesson: 'sc-l1', run: k + 1, now: T });
    s = finishLesson(s, 'sc-l1', { xp: 10, accuracy: 100, now: T, seconds: 400 });
    s = finishLesson(s, 'sc-l2', { xp: 10, accuracy: 100, now: T, seconds: 400 });
    const r = settle(s, courseCtx(s), T);
    const keys = r.gains.map((g) => g.key);
    expect(keys).toContain(`g:${dayOf(T)}`);
    questsFor(s, T).forEach((q) => expect(keys).toContain(q.key));
    expect(keys).toContain(`q:${dayOf(T)}:all`);
    expect(keys).toContain('a:first');
    expect(keys).toContain('a:perfect');
    expect(balance(r.s)).toBe(r.gains.reduce((a, g) => a + g.coins, 0));
    expect(settle(r.s, courseCtx(r.s), T).gains).toEqual([]);
  });
  it('сундук юнита: 40–80 монет, открывается один раз', () => {
    const c = chestCoins('scarcity');
    expect(c).toBeGreaterThanOrEqual(40); expect(c).toBeLessThanOrEqual(80);
    const s = openChest(emptyLearn(), 'scarcity', T);
    expect(balance(s)).toBe(c);
    expect(s.claimed[chestKey('scarcity')]).toBe(T);
    expect(openChest(s, 'scarcity', T)).toBe(s);
  });
  it('испытание месяца считает только этот месяц и даёт марку', () => {
    let s = emptyLearn();
    const m = monthChallenge(s, T);
    expect(m.month).toBe('2026-09');
    expect(m.name).toBe('сентябрь 2026');
    expect(m.have).toBe(0);
    for (let d = 1; d <= 28; d += 1) {
      const day = `2026-09-${String(d).padStart(2, '0')}`;
      for (let k = 0; k < 2; k += 1) s = finishLesson(s, `sc-i${k + 1}`, { xp: 10, accuracy: 100, now: at(day), seconds: 900 });
    }
    s = { ...s, xp: { ...s.xp, '2026-09-01': 600 } };
    expect(monthChallenge(s, T).done).toBe(true);
    const r = settle(s, courseCtx(s), T);
    expect(r.gains.map((g) => g.key)).toContain('m:2026-09');
    expect(achievementsOf(r.s).find((a) => a.id === 'month').got).toBe(true);
  });
  it('печати: у каждой картинка, название и награда; «Ранняя пташка» — урок до восьми утра', () => {
    achievementsOf(emptyLearn()).forEach((a) => { expect(a.icon).toBeTruthy(); expect(a.title).toBeTruthy(); expect(a.coins).toBeGreaterThan(0); expect(a.got).toBe(false); });
    const s = finishLesson(emptyLearn(), 'sc-i1', { xp: 5, accuracy: 70, now: at('2026-09-28', 7) });
    expect(settle(s, courseCtx(s), at('2026-09-28', 7)).gains.map((g) => g.key)).toContain('a:early');
  });
});

describe('правки: печать «Без помарок», испытание месяца, калькулятор', () => {
  it('«Без помарок» — только когда урок пройден без ошибок сейчас, а не за старый лучший результат', () => {
    // урок когда-то был пройден на 100%, а сейчас повторён с ошибкой — печати нет
    let s = { ...emptyLearn(), lessons: { 'sc-i1': { at: T - 86400e3 * 30, runs: 1, best: 100 } } };
    s = finishLesson(s, 'sc-i1', { xp: 1, accuracy: 80, now: T });
    expect(settle(s, courseCtx(s), T).gains.map((g) => g.key)).not.toContain('a:perfect');
    s = finishLesson(s, 'sc-l1', { xp: 10, accuracy: 100, now: T });
    expect(settle(s, courseCtx(s), T).gains.map((g) => g.key)).toContain('a:perfect');
  });
  it('испытание месяца персональное: от цели в минутах и прошлого месяца, без «заниматься 2 дня»', () => {
    // нижние планки высокие: испытание месяца — трудное, не «3 урока без ошибок»
    const FLOOR = { minutes: 150, lessons: 15, perfect: 8, xp: 300 };
    const late = setProfile(emptyLearn(), { minutes: 10 }, at('2026-09-29'));
    const m = monthChallenge(late, at('2026-09-29'));
    expect(m.daysLeft).toBe(2);
    expect(Object.keys(FLOOR)).toContain(m.id);
    // пришёл в конце месяца — цель не ниже нижней планки
    expect(m.target).toBe(FLOOR[m.id]);
    expect(m.need).toBe(m.target - m.have);
    expect(m.title).toContain(String(m.target));
    expect(m.why).toContain('10 минут');
    // за весь месяц: больше минут в цели — больше испытание
    for (const day of ['2026-09-29', '2026-10-15', '2026-11-15', '2026-12-15']) {
      const five = setProfile(emptyLearn(), { minutes: 5 }, at('2026-07-01'));
      const twenty = setProfile(emptyLearn(), { minutes: 20 }, at('2026-07-01'));
      const a = monthChallenge(five, at(day)); const b = monthChallenge(twenty, at(day));
      expect(a.target).toBeGreaterThanOrEqual(FLOOR[a.id]);
      expect(b.target).toBeGreaterThan(a.target);
    }
    // в прошлом месяце сделано много — теперь чуть больше прошлого
    let busy = setProfile(emptyLearn(), { minutes: 5 }, at('2026-07-01'));
    for (let d = 1; d <= 31; d += 1) {
      const day = `2026-08-${String(d).padStart(2, '0')}`;
      for (let k = 0; k < 3; k += 1) busy = finishLesson(busy, `sc-i${k + 1}`, { xp: 30, accuracy: 100, now: at(day), seconds: 900 });
    }
    const calm = monthChallenge(setProfile(emptyLearn(), { minutes: 5 }, at('2026-07-01')), at('2026-09-29'));
    const hard = monthChallenge(busy, at('2026-09-29'));
    expect(hard.target).toBeGreaterThan(calm.target);
    expect(hard.why).toContain('В прошлом месяце');
    // «чуть больше» — правда: цель строго больше прошлого месяца (раньше бывало «в прошлом — 5», а цель 3)
    const [, before, now] = hard.why.match(/В прошлом месяце — (\d+), теперь (\d+)/).map(Number);
    expect(now).toBe(hard.target);
    expect(hard.target).toBeGreaterThan(before);
  });
  it('калькулятор: скобки, приоритет, унарный минус, степень, запятая; неполное и деление на ноль — ничего', () => {
    expect(evalExpr('100/50')).toBe(2);
    expect(evalExpr('2+3*4')).toBe(14);
    expect(evalExpr('(2+3)×4')).toBe(20);
    expect(evalExpr('−5+2')).toBe(-3);
    expect(evalExpr('0,5*4')).toBe(2);
    expect(evalExpr('10^2')).toBe(100);
    expect(evalExpr('2^3^2')).toBe(512);
    expect(evalExpr('1500+500')).toBe(2000);
    expect(evalExpr('5/0')).toBe(null);
    expect(evalExpr('√16')).toBe(4);
    expect(evalExpr('√(9+16)')).toBe(5);
    expect(evalExpr('2*√9')).toBe(6);
    expect(evalExpr('√9^2')).toBe(9);
    expect(evalExpr('−√4')).toBe(-2);
    expect(evalExpr('√(0−4)')).toBe(null);
    expect(evalExpr('√')).toBe(null);
    expect(evalExpr('2+')).toBe(null);
    expect(evalExpr('(2')).toBe(null);
    expect(evalExpr('2..3')).toBe(null);
    expect(evalExpr('alert(1)')).toBe(null);
    expect(fmtResult(1 / 3)).toBe('0,3333');
    expect(fmtResult(-2.5)).toBe('−2,5');
  });
});

describe('слияние двух устройств', () => {
  it('монеты по дням — по максимуму, награды и покупки — объединение, наряд — более поздний; симметрично', () => {
    const cheap = shopDay(emptyLearn(), dayOf(T)).showcase[1];
    const slot = OUTFITS.find((o) => o.id === cheap).slot;
    const a = buy(earn(emptyLearn(), 2000, 'q:2026-09-28:minutes', T), cheap, T).s;
    const b = earn(setProfile(emptyLearn(), { minutes: 10 }, T), 60, 'c:scarcity', T + 5);
    const ab = mergeLearn(a, b); const ba = mergeLearn(b, a);
    expect(ab).toEqual(ba);
    expect(Object.keys(ab.claimed).sort()).toEqual(['c:scarcity', 'q:2026-09-28:minutes']);
    expect(ab.coins[dayOf(T)]).toBe(2000);
    expect(ab.owned[cheap]).toBe(T);
    expect(ab.wear[slot]).toBe(cheap);
    expect(mergeLearn(ab, ab)).toEqual(ab);
  });
  it('чистка не пропускает мусор', () => {
    const n = normalizeLearn({ recent: '12ab', coins: { 'x': 5, '2026-09-28': -3 }, claimed: { '': 1, ok: 'x' }, wear: { head: 5 }, daily: { '2026-09-28': { c: -1, s: 1e9 } }, topics: { a: { n: 99, ok: 120 } } });
    expect(n.recent).toBe('');
    expect(n.coins).toEqual({});
    expect(n.claimed).toEqual({});
    expect(n.wear.head).toBe(null);
    expect(n.daily['2026-09-28'].c).toBe(0);
    expect(n.daily['2026-09-28'].s).toBe(86400);
    expect(n.topics.a).toEqual({ n: 20, ok: 20 });
  });
  it('хеш — детерминированный и в [0, 1)', () => {
    expect(hash01('a')).toBe(hash01('a'));
    for (let k = 0; k < 100; k += 1) { const h = hash01(`k${k}`); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
    expect(addDays('2026-09-28', 3)).toBe('2026-10-01');
    expect(COIN.lesson).toBe(10);
    expect(OUTFITS.length).toBeGreaterThanOrEqual(9);
  });
});

describe('напоминание о теории перед уроком', () => {
  it('нужна теория раздела, которой не было ни в учебнике, ни в «Знакомстве»; «теория уже была» — больше не спрашиваем', () => {
    const l1 = LESSON_BY_ID['sc-l1'];
    const n = theoryNotice(l1, emptyLearn(), { read: {}, problems: {} });
    expect(n).toMatchObject({ chapter: 'scarcity', section: { id: l1.section } });
    expect(n.section.title).toBeTruthy();
    // «Знакомство» по тому же разделу пройдено — теория дана в уроке
    const intro = finishLesson(emptyLearn(), 'sc-i1', { xp: 5, accuracy: 100, now: T });
    expect(theoryNotice(l1, intro, { read: {}, problems: {} })).toBeNull();
    // глава прочитана в учебнике
    expect(theoryNotice(l1, emptyLearn(), { read: { scarcity: T }, problems: {} })).toBeNull();
    // ученик сказал «теория уже была в уроке»
    expect(theoryNotice(l1, emptyLearn(), { read: {}, problems: {} }, [l1.section])).toBeNull();
    // сам урок «Знакомство» теорию даёт
    expect(theoryNotice(LESSON_BY_ID['sc-i1'], emptyLearn(), { read: {}, problems: {} })).toBeNull();
  });
});

describe('корень как на обычном калькуляторе', () => {
  it('число, потом √ — корень сразу; скобка, потом √ — корень из скобки; иначе — знак перед числом', () => {
    expect(pressRoot('16')).toBe('4');
    expect(pressRoot('9+16')).toBe('9+4');
    expect(pressRoot('2')).toBe('1,4142');
    expect(evalExpr(pressRoot('2'))).toBeCloseTo(1.4142, 4);
    expect(pressRoot('√16')).toBe('2');
    expect(pressRoot('(9+16)')).toBe('√(9+16)');
    expect(evalExpr(pressRoot('3*(9+16)'))).toBe(15);
    expect(pressRoot('')).toBe('√');
    expect(pressRoot('5+')).toBe('5+√');
    expect(evalExpr(`${pressRoot('5+')}9`)).toBe(8);
  });
});
