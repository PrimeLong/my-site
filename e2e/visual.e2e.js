/* ВИЗУАЛЬНЫЕ ЭТАЛОНЫ десяти ключевых экранов (toHaveScreenshot): приветствие, Путь, задания,
   карточка урока, первый шаг урока, лавка, профиль, оглавление учебника, глава, «Мир».
   Снимаются на телефоне (проект phone) с замороженными часами, детерминированным Math.random
   и выключенными анимациями — разница с эталоном больше 2% пикселей валит тест.
   Обновить эталоны после намеренной правки вида:
   npx playwright test e2e/visual.e2e.js --project=phone --update-snapshots */
import { test, expect } from '@playwright/test';

const ACCOUNT = { token: 't', login: 'tester', name: 'Тест', emblem: 'star', kidsMode: false };
const NOW = new Date('2026-10-05T10:00:00');
const SHOT = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.02 };

async function prepare(page, { account = true } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(NOW);
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(({ acc, a }) => {
    let x = 42; Math.random = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
    try {
      window.__INFLATIA_TEST__ = true;
      if (acc) localStorage.setItem('ems-account', JSON.stringify(a));
      // утренний экран серии уже показан сегодня
      localStorage.setItem('ems-learn-morning', '2026-10-05');
    } catch { /* нет хранилища */ }
  }, { acc: account, a: ACCOUNT });
  return errors;
}
const tab = (page, id) => page.getByTestId('bottom-nav').locator(`[data-tab="${id}"]`).click();

test.describe('визуальные эталоны', () => {
  test.beforeEach(({ isMobile, browserName }) => { test.skip(!isMobile || browserName !== 'chromium', 'эталоны — телефон в Chromium'); });

  test('приветствие', async ({ page }) => {
    const errors = await prepare(page, { account: false });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('welcome')).toBeVisible();
    await expect(page).toHaveScreenshot('01-welcome.png', SHOT);
    expect(errors).toEqual([]);
  });

  test('обучение: Путь, задания, карточка и шаг урока, лавка, профиль', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('path')).toBeVisible();
    await expect(page).toHaveScreenshot('02-path.png', SHOT);
    await page.getByTestId('tasks-card').click();
    await expect(page.getByTestId('tasks')).toBeVisible();
    await expect(page).toHaveScreenshot('03-tasks.png', SHOT);
    await page.locator('[data-nav="back"]').filter({ visible: true }).click();
    await page.locator('[data-testid=path-lesson][data-lesson="sc-i1"]').click();
    await expect(page.getByTestId('lesson-sheet')).toBeVisible();
    await expect(page).toHaveScreenshot('04-lesson-sheet.png', SHOT);
    await page.getByTestId('lesson-start').click();
    await expect(page.getByTestId('lesson')).toBeVisible();
    await expect(page).toHaveScreenshot('05-lesson-step.png', SHOT);
    await page.getByRole('button', { name: 'Выйти из урока' }).click();
    await expect(page.getByTestId('lesson')).toHaveCount(0);
    await tab(page, 'shop');
    await expect(page.getByTestId('shop')).toBeVisible();
    await expect(page).toHaveScreenshot('06-shop.png', SHOT);
    await tab(page, 'profile');
    await expect(page.getByTestId('learn-profile')).toBeVisible();
    await expect(page).toHaveScreenshot('07-profile.png', SHOT);
    expect(errors).toEqual([]);
  });

  test('учебник: оглавление и глава', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await tab(page, 'book');
    await expect(page.getByTestId('textbook')).toBeVisible();
    await expect(page).toHaveScreenshot('08-book-toc.png', SHOT);
    await page.getByTestId('textbook').getByRole('button', { name: /Спрос и предложение/ }).click();
    await expect(page.getByTestId('chapter')).toBeVisible();
    await expect(page).toHaveScreenshot('09-chapter.png', SHOT);
    expect(errors).toEqual([]);
  });

  test('«Мир»', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await tab(page, 'world');
    await expect(page.getByTestId('world')).toBeVisible();
    // бегущая строка с курсами — живая, её прячем
    await expect(page).toHaveScreenshot('10-world.png', { ...SHOT, mask: [page.locator('.menu-ticker')] });
    expect(errors).toEqual([]);
  });
});
