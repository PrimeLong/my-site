/* СКРИНШОТЫ ВСЕХ ЭКРАНОВ ОБУЧЕНИЯ — на телефоне, в светлой и тёмной теме, в одну папку
   screens/ (имена: NN-экран-light.png / NN-экран-dark.png). Смысл — увидеть разнобой
   сразу: все экраны собраны из одной дизайн-системы (src/ds.jsx, src/ds-art.jsx), и рядом
   в папке любое отступление бросается в глаза. Тест заодно проверяет, что каждый экран
   открывается без ошибок и ничего не уезжает вбок. Запуск:
   npx playwright test e2e/screens.e2e.js --project=phone */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const DIR = 'screens';
const ACCOUNT = { token: 't', login: 'tester', name: 'Тест', emblem: 'star', kidsMode: false };
// пройдено всё, кроме «Итогов юнита»: на Пути видно и пройденное, и текущее; любой урок открыт для повтора
const DONE = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev'];

async function setup(page, { theme, account = true, learn = null }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(({ theme: th, account: acc, a, done, extra }) => {
    try {
      window.__INFLATIA_TEST__ = true;
      if (acc) localStorage.setItem('ems-account', JSON.stringify(a));
      if (th === 'dark') localStorage.setItem('ems-learn-dark', '1');
      if (!localStorage.getItem('ems-textbook-v1')) {
        const at = Date.now() - 86400000;
        localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(done.map((id) => [id, { at, runs: 1, best: 90 }])), ...extra } }));
      }
    } catch { /* нет хранилища */ }
  }, { theme, account, a: ACCOUNT, done: DONE, extra: learn });
  return errors;
}
const shot = async (page, name, theme, opts = {}) => {
  fs.mkdirSync(DIR, { recursive: true });
  await page.waitForTimeout(opts.wait ?? 350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: страницу можно прокрутить вбок`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${DIR}/${name}-${theme}.png`, fullPage: !!opts.full, animations: 'disabled' });
};
const foot = (page) => page.getByTestId('lesson').locator('.ln-foot button').last();
const openLesson = async (page, id) => {
  await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click().catch(() => {});
  await page.locator(`[data-testid=path-lesson][data-lesson="${id}"]`).click();
  await page.getByTestId('lesson-start').click();
  await expect(page.getByTestId('lesson')).toBeVisible();
};
const exitLesson = async (page) => {
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  const ask = page.getByRole('dialog', { name: 'Выйти из урока?' });
  if (await ask.isVisible().catch(() => false)) await ask.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
};
// ответ на текущее упражнение (верно или нарочно неверно) и «Проверить»
async function answer(page, wrong = false) {
  const ex = page.getByTestId('ex');
  const kind = await ex.getAttribute('data-kind');
  const ans = JSON.parse(await ex.getAttribute('data-answer'));
  if (['choice', 'gap', 'shift'].includes(kind)) await ex.locator(wrong ? `[data-key]:not([data-key="${ans}"])` : `[data-key="${ans}"]`).first().click();
  else if (kind === 'tf') await ex.locator(`[data-key="${wrong ? !ans : ans}"]`).click();
  else if (kind === 'price') await ex.getByRole('slider', { name: 'Цена' }).fill(String(wrong ? ans + 3 : ans));
  else if (kind === 'curve') await ex.locator(`[data-curve="${ans[0]}"][data-dir="${ans[1]}"]`).click();
  else if (kind === 'tiles') { for (const k of ans) await ex.locator(`[data-tile="${k}"]`).click(); }
  else if (kind === 'calc') {
    for (const ch of wrong ? '99999' : ans) {
      if (ch === '-') await ex.getByRole('button', { name: 'Минус' }).click();
      else await ex.getByRole('group', { name: 'Цифровая клавиатура' }).getByRole('button', { name: ch, exact: true }).click();
    }
  } else if (kind === 'sort') { for (const [it, b] of Object.entries(ans)) await ex.locator(`[data-item="${it}"][data-bin="${b}"]`).click(); }
  else if (kind === 'news') { for (const [v, d] of Object.entries(ans)) await ex.locator(`[data-var="${v}"][data-dir="${d}"]`).click(); }
  else if (kind === 'point') {
    const svg = ex.getByTestId('market-chart'); const pl = JSON.parse(await svg.getAttribute('data-plot')); const box = await svg.boundingBox();
    await svg.click({ position: { x: ((pl.x0 + (ans.q / pl.qMax) * pl.w) / pl.vw) * box.width, y: ((pl.y0 + pl.h - (ans.p / pl.pMax) * pl.h) / pl.vh) * box.height } });
  } else if (kind === 'match') {
    for (const l of Object.keys(ans)) { await ex.locator(`[data-side=left][data-key="${l}"]`).click(); await ex.locator(`[data-side=right][data-key="${ans[l]}"]`).click(); }
  } else if (kind === 'swipe' || kind === 'rush') {
    await playGame(page);
    return kind;
  }
  if (kind === 'open') await ex.getByTestId('open-answer').fill('Я бы не вводил потолок, а помог студентам адресно.');
  if (kind === 'domino') {
    const dom = ex.getByTestId('domino');
    await dom.locator(`[data-key="${ans[0]}"]`).click();
    if (wrong) await dom.locator('[data-testid="domino-card"][data-key^="f"]').first().click();
    for (const k of ans.slice(1)) await dom.locator(`[data-key="${k}"]`).click();
    return kind;
  }
  await page.getByRole('button', { name: kind === 'open' ? 'Ответить' : 'Проверить' }).click();
  return kind;
}
const next = (page) => page.getByRole('button', { name: 'Дальше', exact: true }).click();
// мини-игра: в тесте короче; max — сколько карточек ответить (остальное время — ждать)
async function playGame(page, { seconds = 5, max = Infinity } = {}) {
  const ex = page.getByTestId('ex');
  await page.evaluate((sec) => { window.__INFLATIA_GAME_SECONDS__ = sec; }, seconds);
  if (await ex.getByTestId('game-start').isVisible()) await ex.getByTestId('game-start').click();
  const card = ex.getByTestId('game-card');
  for (let i = 0; i < max && await card.count(); i += 1) {
    const side = await card.getAttribute('data-answer', { timeout: 1000 }).catch(() => null);
    if (!side) break;
    await ex.locator(`button[data-side="${side}"]`).click({ timeout: 1500 }).catch(() => {});
  }
  await expect(ex.getByTestId('game-final')).toBeVisible({ timeout: (seconds + 5) * 1000 });
}
// «Откройте сами»: четыре дня с разными ценами
async function playDiscover(page, prices = [12, 18, 26, 33]) {
  const d = page.getByTestId('discover');
  for (const p of prices) {
    await d.getByTestId('discover-price').fill(String(p));
    await expect(d.getByTestId('discover-open')).toBeEnabled({ timeout: 4000 });
    await d.getByTestId('discover-open').click();
  }
  await expect(page.getByTestId('discover-next')).toBeEnabled({ timeout: 4000 });
}
// карточки перед упражнением: шаг, слово, пункт итогов, «Откройте сами»
async function passCards(page) {
  const card = page.getByTestId('lesson-card');
  for (let i = 0; i < 24 && await card.isVisible(); i += 1) {
    if (await card.getAttribute('data-style') === 'discover') await playDiscover(page);
    await foot(page).click(); await page.waitForTimeout(320);
  }
}

for (const theme of ['light', 'dark']) {
  test.describe(`экраны: тема ${theme}`, () => {
    test.beforeEach(({ isMobile }) => { test.skip(!isMobile, 'скриншоты — телефонные'); });

    test(`вход и регистрация (${theme})`, async ({ page }) => {
      const errors = await setup(page, { theme, account: false });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('welcome')).toBeVisible();
      await shot(page, '01-welcome', theme);
      await page.getByRole('button', { name: 'Начать' }).click();
      await shot(page, '02-welcome-goal', theme);
      for (const g of ['Цель', 'Минут в день', 'Знания']) await page.getByRole('group', { name: g }).getByRole('button').first().click();
      await page.getByRole('button', { name: 'Продолжить' }).click();
      // гость: сразу первый урок; выйти — и с Пути «Сохраните прогресс» → регистрация
      await expect(page.getByTestId('lesson')).toBeVisible();
      await shot(page, '02a-guest-lesson', theme);
      await page.getByRole('button', { name: 'Выйти из урока' }).click();
      await shot(page, '02b-guest-path', theme);
      await page.getByTestId('guest-register').click();
      await shot(page, '03-welcome-register', theme);
      await page.getByTestId('consent-privacy').click();
      await shot(page, '03a-privacy', theme);
      await page.getByTestId('privacy').getByRole('button', { name: 'Закрыть' }).click();
      await page.evaluate(() => localStorage.removeItem('ems-guest'));
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
      await shot(page, '04-welcome-login', theme);
      expect(errors).toEqual([]);
    });

    test(`путь, уроки всех видов, итоги (${theme})`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors = await setup(page, { theme });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('path')).toBeVisible();
      await shot(page, '05-path', theme);
      await page.locator('[data-testid="path-unit"][data-unit="supply-demand"]').scrollIntoViewIfNeeded();
      await shot(page, '06-path-route', theme);
      // билет урока, шаг «Знакомства», упражнение, верный ответ, вопрос о выходе
      await page.locator('[data-testid=path-lesson][data-lesson="sd-i2"]').click();
      await shot(page, '07-lesson-ticket', theme);
      await page.getByTestId('lesson-start').click();
      await shot(page, '08-intro-step', theme);
      await foot(page).click();
      await shot(page, '09-exercise', theme);
      await answer(page);
      await shot(page, '10-answer-ok', theme);
      await next(page);
      await page.getByRole('button', { name: 'Выйти из урока' }).click();
      await shot(page, '11-exit-question', theme);
      await page.getByRole('dialog', { name: 'Выйти из урока?' }).getByRole('button', { name: 'Выйти', exact: true }).click();
      // неверный ответ и итоги урока
      await openLesson(page, 'sd-i1');
      await passCards(page);
      await answer(page, true);
      await shot(page, '12-answer-bad', theme);
      await next(page);
      for (let i = 0; i < 20 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) { await passCards(page); await answer(page); await next(page); }
      await expect(page.getByTestId('lesson-result')).toBeVisible();
      await shot(page, '13-result', theme, { wait: 3200 });
      await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
      // «Слова»: карточка, оборот, плитки
      await openLesson(page, 'sd-w');
      await shot(page, '14-words-card', theme);
      await page.getByTestId('word-show').click();
      await shot(page, '15-words-flip', theme, { wait: 700 });
      await passCards(page);
      await shot(page, '16-words-tiles', theme);
      await exitLesson(page);
      // «История»: вырезка из «Вестника», цена ползунком, точка равновесия, кривая пальцем
      await openLesson(page, 'sd-s1');
      await shot(page, '17-story', theme);
      await passCards(page); await answer(page); await next(page); await passCards(page);
      await page.getByTestId('ex').getByRole('slider', { name: 'Цена' }).fill('17');
      await shot(page, '18-price', theme);
      await answer(page); await next(page); await passCards(page);
      await answer(page);
      await shot(page, '19-point', theme);
      await next(page); await passCards(page);
      await page.getByTestId('ex').locator('[data-curve="S"][data-dir="-"]').click();
      await shot(page, '20-curve', theme);
      await exitLesson(page);
      // «Слушай», «Мини-игра», «Итоги юнита»
      await openLesson(page, 'sd-l-radio');
      await shot(page, '21-listen', theme, { wait: 1500 });
      await exitLesson(page);
      // мини-игра «Рынок кофе»: старт, игра с живым графиком, итог
      await openLesson(page, 'sd-g');
      await shot(page, '22-game-ready', theme);
      await page.evaluate(() => { window.__INFLATIA_GAME_SECONDS__ = 30; });
      await page.getByTestId('game-start').click();
      const card = page.getByTestId('game-card');
      for (let i = 0; i < 7; i += 1) await page.getByTestId('ex').locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
      await shot(page, '23-game-play', theme, { wait: 600 });
      await exitLesson(page);
      await openLesson(page, 'sd-g');
      await playGame(page, { seconds: 4, max: 9 });
      await shot(page, '24-game-done', theme);
      await exitLesson(page);
      // мини-игра «Мастерская»: КПВ растёт и сжимается от решений
      await openLesson(page, 'sc-g');
      await page.evaluate(() => { window.__INFLATIA_GAME_SECONDS__ = 30; });
      await page.getByTestId('game-start').click();
      for (let i = 0; i < 6; i += 1) await page.getByTestId('ex').locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
      await shot(page, '24b-game-ppf', theme, { wait: 600 });
      await exitLesson(page);
      // алмазный уровень: билет пройденного урока и алмазный шаг с обозначениями (sd-i2 прерван выше — у него «Продолжить»)
      await page.locator('[data-testid=path-lesson][data-lesson="sd-i1"]').click();
      await shot(page, '25a-diamond-ticket', theme);
      await page.getByTestId('lesson-diamond').click();
      for (let i = 0; i < 30 && !(await page.getByTestId('step-legend').isVisible()); i += 1) {
        if (await page.getByTestId('lesson-card').isVisible()) await foot(page).click(); else { await answer(page); await next(page); }
      }
      await shot(page, '25b-diamond-step', theme);
      await exitLesson(page);
      await openLesson(page, 'sd-sum');
      await shot(page, '25-summary-point', theme);
      await exitLesson(page);
      expect(errors).toEqual([]);
    });

    test(`награды и программа: утро, задания, лавка, сундук, вступительный тест (${theme})`, async ({ page }) => {
      test.setTimeout(120_000);
      // серия три дня, 240 монет, при регистрации — «кое-что знаю»: на Пути ждёт вступительный тест
      const day = (back) => { const d = new Date(Date.now() - back * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const errors = await setup(page, { theme, learn: {
        done: { [day(1)]: 2, [day(2)]: 1, [day(3)]: 1 }, xp: { [day(1)]: 40, [day(2)]: 20, [day(3)]: 20 }, coins: { [day(1)]: 2400 },
        profile: { goal: 'exam', minutes: 10, knows: true, at: Date.now() - 86400000 },
        claimed: { 'a:first': Date.now() - 86400000, 'a:streak3': Date.now() - 86400000 },
      } });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('morning')).toBeVisible();
      await shot(page, '35-morning', theme, { wait: 1200 });
      await page.getByTestId('morning-go').click();
      await expect(page.getByTestId('placement-card')).toBeVisible();
      await shot(page, '36-path', theme);
      await page.getByTestId('bottom-nav').locator('[data-tab="tasks"]').click();
      await expect(page.getByTestId('quests')).toBeVisible();
      await shot(page, '36a-tasks', theme, { full: true });
      await page.getByTestId('bottom-nav').locator('[data-tab="shop"]').click();
      await expect(page.getByTestId('shop')).toBeVisible();
      await shot(page, '37-shop', theme);
      // витрина дня со скидкой, полезное и витрина ювелира с полоской накопления
      await page.getByTestId('rate-chart').hover({ position: { x: 300, y: 30 } });
      await expect(page.getByTestId('rate-tip')).toBeVisible();
      await shot(page, '37a-shop-rate-tip', theme);
      await page.getByTestId('shop-showcase').scrollIntoViewIfNeeded();
      await shot(page, '37b-shop-showcase', theme);
      await page.getByTestId('shop-rare').scrollIntoViewIfNeeded();
      await shot(page, '37c-shop-rare', theme);
      const first = page.getByTestId('shop-showcase').getByTestId('shop-item').first();
      const bought = await first.getAttribute('data-item');
      await first.getByRole('button', { name: 'Купить' }).click();
      await expect(page.getByTestId('shop-msg')).toContainText('Куплено');
      await page.locator(`[data-testid=shop-wardrobe] [data-item="${bought}"]`).scrollIntoViewIfNeeded();
      await shot(page, '38-shop-bought', theme);
      await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click();
      await page.getByTestId('chest').first().scrollIntoViewIfNeeded();
      await page.getByTestId('chest').first().click();
      await shot(page, '39-chest', theme);
      await page.getByTestId('chest-open').click();
      await expect(page.getByTestId('chest-coins')).toBeVisible();
      await shot(page, '40-chest-open', theme, { wait: 600 });
      await page.getByRole('button', { name: 'Забрать' }).click();
      await page.getByTestId('placement-start').scrollIntoViewIfNeeded();
      await page.getByTestId('placement-start').click();
      await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'placement');
      await shot(page, '41-placement', theme);
      for (let i = 0; i < 20 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) { await answer(page); await next(page); }
      await expect(page.getByTestId('lesson-result')).toBeVisible();
      await shot(page, '42-placement-result', theme, { wait: 1500 });
      await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
      await page.getByTestId('bottom-nav').locator('[data-tab="profile"]').click();
      await page.getByTestId('prof-program').scrollIntoViewIfNeeded();
      await shot(page, '43-profile-program', theme);
      await page.getByTestId('achievements').scrollIntoViewIfNeeded();
      await shot(page, '44-achievements', theme);
      expect(errors).toEqual([]);
    });

    test(`лента «История» и «Слушай», сообщение об ошибке (${theme})`, async ({ page }) => {
      const errors = await setup(page, { theme });
      await page.route('**/api/reports', (r) => {
        let body = {}; try { body = r.request().postDataJSON(); } catch { body = {}; }
        const reports = [{ id: 'r1', at: Date.now() - 60000, login: 'kate', name: 'Катя', status: 'new', reason: 'answer', comment: 'в ответе 25, а должно быть 20',
          context: { screen: 'exercise', exercise: 'sd-l1:x', lesson: 'sd-l1', answer: '"25"', correct: '20 станков', build: 'abc1234 · 2026-09-29' } }];
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.action === 'me' ? { owner: true } : body.action === 'list' ? { reports, counts: { new: 1, done: 0 } } : { ok: true }) });
      });
      await page.goto('/', { waitUntil: 'networkidle' });
      await openLesson(page, 'sd-s1');
      await passCards(page); await answer(page, true);
      await shot(page, '45-story-feed', theme);
      await next(page); await page.getByTestId('lesson').locator('.ln-foot button').click();
      await shot(page, '46-story-feed-more', theme);
      await exitLesson(page);
      await openLesson(page, 'sd-l-radio');
      await passCards(page); await answer(page);
      await shot(page, '47-listen-feed', theme);
      await page.locator('.fd-q').last().getByTestId('report-flag').click();
      await page.getByTestId('report-sheet').locator('[data-reason="answer"]').click();
      await shot(page, '48-report-sheet', theme);
      await page.getByTestId('report-send').click();
      await shot(page, '49-report-thanks', theme);
      await page.getByRole('button', { name: 'Продолжить' }).click();
      await exitLesson(page);
      await page.getByTestId('bottom-nav').locator('[data-tab="profile"]').click();
      await page.getByTestId('prof-reports').click();
      await shot(page, '50-reports', theme);
      // юнит 1: «История» Гриши и калькулятор в расчёте
      await page.getByTestId('reports').getByRole('button', { name: 'Назад' }).click();
      await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click();
      await openLesson(page, 'sc-s1');
      await shot(page, '51-sc-story', theme);
      await passCards(page);
      await page.getByTestId('ex').getByTestId('calc-open').click();
      for (const k of ['1', '0', '0', '÷', '5', '0']) await page.getByTestId('ex').locator(`[data-calc="${k}"]`).click();
      await shot(page, '52-calculator', theme);
      expect(errors).toEqual([]);
    });

    test(`модуль 3: свёрнутый юнит, напоминание о теории, шаг урока (${theme})`, async ({ page }) => {
      const CS = ['cs-i1', 'cs-l1', 'cs-i2', 'cs-l2', 'cs-w'];
      const errors = await setup(page, { theme, learn: { claimed: { 'c:scarcity': Date.now() - 86400000 } } });
      await page.addInitScript((ids) => {
        try {
          const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
          const at = Date.now() - 86400000;
          ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-sum', 'el-sum', ...ids].forEach((id) => { p.learn.lessons[id] = { at, runs: 1, best: 90 }; });
          localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
        } catch { /* нет хранилища */ }
      }, CS);
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-testid=path-unit][data-unit="scarcity"]')).toHaveAttribute('data-folded', 'true');
      await shot(page, '53-path-folded', theme);
      await page.locator('[data-testid=path-unit][data-unit="consumer"]').scrollIntoViewIfNeeded();
      await shot(page, '54-path-consumer', theme);
      await page.locator('[data-testid=path-lesson][data-lesson="cs-s1"]').click();
      await expect(page.getByTestId('theory-notice')).toBeVisible();
      await shot(page, '55-theory-notice', theme);
      await page.getByTestId('theory-known').click();
      await expect(page.getByTestId('lesson')).toBeVisible();
      await exitLesson(page);
      await openLesson(page, 'cs-i1');
      await shot(page, '56-consumer-step', theme);
      await exitLesson(page);
      expect(errors).toEqual([]);
    });

    test(`новые глаголы: «Откройте сами», живая модель, «Домино», копилка (${theme})`, async ({ page }) => {
      test.setTimeout(180_000);
      // пройдено всё до юнита 2: первый урок «Рынка» — с «Откройте сами»
      const errors = await setup(page, { theme, learn: { coins: { '2026-01-01': 400 } } });
      await page.addInitScript(() => {
        try {
          if (localStorage.getItem('shots-trimmed')) return;
          const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
          ['sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev'].forEach((id) => { delete p.learn.lessons[id]; });
          localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
          localStorage.setItem('shots-trimmed', '1');
        } catch { /* нет хранилища */ }
      });
      await page.goto('/', { waitUntil: 'networkidle' });
      await openLesson(page, 'sd-i1');
      await expect(page.getByTestId('discover')).toBeVisible();
      await shot(page, '57-discover', theme);
      await playDiscover(page);
      await page.getByTestId('discover-chart').scrollIntoViewIfNeeded();
      await shot(page, '57a-discover-line', theme);
      await exitLesson(page);
      // живая модель: открыты три детали (пройдены sd-i1, sd-l1, sd-w — как будто)
      await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
        ['sd-i1', 'sd-l1', 'sd-w', 'sd-i2'].forEach((id) => { p.learn.lessons[id] = { at: Date.now() - 86400000, runs: 1, best: 90 }; });
        localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
      });
      await page.reload({ waitUntil: 'networkidle' });
      const model = page.locator('[data-testid=unit-model]').first();
      await model.scrollIntoViewIfNeeded();
      await shot(page, '58-unit-model', theme);
      await model.getByTestId('model-toggle').click();
      await model.getByTestId('model-parts').scrollIntoViewIfNeeded();
      await shot(page, '58a-unit-model-parts', theme);
      // «Домино» — в практике «Предложение и равновесие»
      await openLesson(page, 'sd-l3');
      for (let i = 0; i < 20; i += 1) {
        const ex = page.getByTestId('ex');
        await expect(ex).toBeVisible();
        if (await ex.getAttribute('data-kind') === 'domino') break;
        await answer(page); await next(page);
      }
      const dom = page.getByTestId('domino');
      await shot(page, '59-domino', theme);
      const chain = JSON.parse(await page.getByTestId('ex').getAttribute('data-answer'));
      await dom.locator(`[data-key="${chain[0]}"]`).click();
      await dom.locator('[data-testid="domino-card"][data-key^="f"]').first().click();
      await page.waitForTimeout(800);
      await dom.getByTestId('domino-why').scrollIntoViewIfNeeded();
      await shot(page, '59a-domino-fall', theme);
      for (const k of chain.slice(1)) await dom.locator(`[data-key="${k}"]`).click();
      await shot(page, '59b-domino-done', theme);
      await exitLesson(page);
      // копилка Инфли в лавке
      await page.getByTestId('bottom-nav').locator('[data-tab="shop"]').click();
      const piggy = page.getByTestId('shop-piggy');
      await piggy.scrollIntoViewIfNeeded();
      await shot(page, '60-piggy', theme);
      await piggy.getByTestId('piggy-amount').fill('120');
      await piggy.getByTestId('piggy-put').click();
      await piggy.scrollIntoViewIfNeeded();
      await shot(page, '60a-piggy-open', theme);
      expect(errors).toEqual([]);
    });

    test(`практика, профиль, справочник, мир, витрина (${theme})`, async ({ page }) => {
      const errors = await setup(page, { theme });
      await page.goto('/', { waitUntil: 'networkidle' });
      const tab = (id) => page.getByTestId('bottom-nav').locator(`[data-tab="${id}"]`).click();
      await tab('tasks');
      await shot(page, '26-tasks', theme);
      await tab('profile');
      await shot(page, '27-profile', theme);
      await shot(page, '28-profile-full', theme, { full: true });
      await page.getByTestId('prof-account').click();
      await shot(page, '29-account', theme);
      await page.getByRole('button', { name: 'Закрыть' }).click();
      await tab('book');
      await expect(page.getByTestId('textbook')).toBeVisible();
      await shot(page, '30-book-toc', theme);
      // задача учебника: «Сообщить об ошибке» и проверка по пунктам
      await page.getByTestId('textbook').getByRole('button', { name: /Ограниченность и выбор/ }).click();
      const prob = page.locator('[data-testid=tb-problem][data-problem="sc-inside"]');
      await prob.scrollIntoViewIfNeeded();
      await prob.getByRole('textbox').nth(0).fill('8');
      await prob.getByRole('textbox').nth(1).fill('10');
      await prob.getByRole('button', { name: 'Уверен', exact: true }).click();
      await prob.getByRole('button', { name: 'Проверить' }).click();
      await expect(prob.getByTestId('tb-verdict')).toContainText('Не сошлось: б)');
      await shot(page, '30a-book-problem', theme);
      await tab('path');
      await page.getByTestId('unit-guide').first().click();
      await expect(page.getByTestId('chapter')).toBeVisible();
      await shot(page, '31-book-chapter', theme);
      // формула с обозначениями, пример на числах и калькулятор задачи
      await page.getByTestId('tb-legend').first().scrollIntoViewIfNeeded();
      await shot(page, '31a-book-legend', theme);
      await page.getByTestId('tb-box-numbers').first().scrollIntoViewIfNeeded();
      await shot(page, '31b-book-example', theme);
      await page.getByTestId('tb-calc-open').first().scrollIntoViewIfNeeded();
      await page.getByTestId('tb-calc-open').first().click();
      await page.getByRole('textbox', { name: 'Выражение для калькулятора' }).fill('√(120−20)×3');
      await shot(page, '31c-book-calc', theme);
      await tab('world');
      await expect(page.getByTestId('world')).toBeVisible();
      await shot(page, '32-world', theme);
      await page.getByTestId('daily-card').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await shot(page, '33-daily', theme);
      await page.goto('/#ds', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('ds-showcase')).toBeVisible();
      await shot(page, '34-showcase', theme, { full: true });
      expect(errors).toEqual([]);
    });
  });
}
