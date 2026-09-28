/* СКРИНШОТЫ ВСЕХ ЭКРАНОВ ОБУЧЕНИЯ — на телефоне, в светлой и тёмной теме, в одну папку
   screens/ (имена: NN-экран-light.png / NN-экран-dark.png). Смысл — увидеть разнобой
   сразу: все экраны собраны из одной дизайн-системы (src/ds.jsx, src/ds-art.jsx), и рядом
   в папке любое отступление бросается в глаза. Тест заодно проверяет, что каждый экран
   открывается без ошибок и ничего не уезжает вбок. Запуск:
   npx playwright test e2e/screens.e2e.js --project=phone */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const DIR = 'screens';
const ACCOUNT = { token: 't', login: 'tester', name: 'Тест', emblem: 'star' };
// пройдено всё, кроме «Итогов юнита»: на Пути видно и пройденное, и текущее; любой урок открыт для повтора
const DONE = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev'];

async function setup(page, { theme, account = true }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(({ theme: th, account: acc, a, done }) => {
    try {
      window.__INFLATIA_TEST__ = true;
      if (acc) localStorage.setItem('ems-account', JSON.stringify(a));
      if (th === 'dark') localStorage.setItem('ems-learn-dark', '1');
      if (!localStorage.getItem('ems-textbook-v1')) {
        const at = Date.now() - 86400000;
        localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(done.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
      }
    } catch { /* нет хранилища */ }
  }, { theme, account, a: ACCOUNT, done: DONE });
  return errors;
}
const shot = async (page, name, theme, opts = {}) => {
  fs.mkdirSync(DIR, { recursive: true });
  await page.waitForTimeout(opts.wait ?? 350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: страницу можно прокрутить вбок`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${DIR}/${name}-${theme}.png`, fullPage: !!opts.full, animations: 'disabled' });
};
const foot = (page) => page.getByTestId('lesson').locator('.ln-foot button');
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
  else if (kind === 'point') {
    const svg = ex.getByTestId('market-chart'); const pl = JSON.parse(await svg.getAttribute('data-plot')); const box = await svg.boundingBox();
    await svg.click({ position: { x: ((pl.x0 + (ans.q / pl.qMax) * pl.w) / pl.vw) * box.width, y: ((pl.y0 + pl.h - (ans.p / pl.pMax) * pl.h) / pl.vh) * box.height } });
  } else if (kind === 'match') {
    for (const l of Object.keys(ans)) { await ex.locator(`[data-side=left][data-key="${l}"]`).click(); await ex.locator(`[data-side=right][data-key="${ans[l]}"]`).click(); }
  } else if (kind === 'swipe' || kind === 'rush') {
    if (kind === 'rush') await ex.getByTestId('game-start').click();
    const card = ex.getByTestId('game-card');
    while (await card.count()) await ex.locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
    return kind;
  }
  await page.getByRole('button', { name: 'Проверить' }).click();
  return kind;
}
const next = (page) => page.getByRole('button', { name: 'Дальше', exact: true }).click();
// карточки перед упражнением: шаг, слово, пункт итогов
async function passCards(page) {
  const card = page.getByTestId('lesson-card');
  for (let i = 0; i < 12 && await card.isVisible(); i += 1) { await foot(page).click(); await page.waitForTimeout(120); }
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
      await shot(page, '03-welcome-register', theme);
      await page.getByRole('button', { name: 'Назад' }).click(); await page.getByRole('button', { name: 'Назад' }).click();
      await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
      await shot(page, '04-welcome-login', theme);
      expect(errors).toEqual([]);
    });

    test(`путь, уроки всех видов, итоги (${theme})`, async ({ page }) => {
      test.setTimeout(150_000);
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
      await page.getByTestId('flash-card').click();
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
      await answer(page); await next(page);
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
      await openLesson(page, 'sd-g');
      await shot(page, '22-game-swipe', theme);
      await answer(page);
      await shot(page, '23-game-round-done', theme);
      await next(page);
      await page.getByTestId('game-start').click();
      await shot(page, '24-game-rush', theme);
      await exitLesson(page);
      await openLesson(page, 'sd-sum');
      await shot(page, '25-summary-point', theme);
      await exitLesson(page);
      expect(errors).toEqual([]);
    });

    test(`практика, профиль, справочник, мир, витрина (${theme})`, async ({ page }) => {
      const errors = await setup(page, { theme });
      await page.goto('/', { waitUntil: 'networkidle' });
      const tab = (id) => page.getByTestId('bottom-nav').locator(`[data-tab="${id}"]`).click();
      await tab('practice');
      await shot(page, '26-practice', theme);
      await tab('profile');
      await shot(page, '27-profile', theme);
      await shot(page, '28-profile-full', theme, { full: true });
      await page.getByTestId('prof-account').click();
      await shot(page, '29-account', theme);
      await page.getByRole('button', { name: 'Закрыть' }).click();
      await page.getByTestId('prof-book').click();
      await expect(page.getByTestId('textbook')).toBeVisible();
      await shot(page, '30-book-toc', theme);
      await tab('path');
      await page.getByTestId('unit-guide').first().click();
      await expect(page.getByTestId('chapter')).toBeVisible();
      await shot(page, '31-book-chapter', theme);
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
