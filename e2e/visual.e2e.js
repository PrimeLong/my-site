/* ВИЗУАЛЬНЫЕ ЭТАЛОНЫ десяти ключевых экранов (toHaveScreenshot): приветствие, Путь, задания,
   карточка урока, первый шаг урока, лавка, профиль, оглавление учебника, глава, «Мир».
   Снимаются на телефоне (проект phone) с замороженными часами, детерминированным Math.random
   и выключенными анимациями — разница с эталоном больше 2% пикселей валит тест.
   Обновить эталоны после намеренной правки вида:
   npx playwright test e2e/visual.e2e.js --project=phone --update-snapshots */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import utilsBundle from 'playwright-core/lib/utilsBundle';

const { PNG } = utilsBundle;

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
      localStorage.setItem('ems-storage-notice', '1');
      if (acc) localStorage.setItem('ems-account', JSON.stringify(a));
      // утренний экран серии уже показан сегодня
      localStorage.setItem('ems-learn-morning', '2026-10-05');
    } catch { /* нет хранилища */ }
  }, { acc: account, a: ACCOUNT });
  return errors;
}
/* Снимок не совпал — в ошибке сказано, где: полосы строк с отличиями и элементы под ними. На CI
   картинки расхождений лежат в артефакте, а причина нужна прямо в логе. */
async function match(page, name, opts = SHOT) {
  try {
    await expect(page).toHaveScreenshot(name, opts);
  } catch (e) {
    let base = null;
    try { base = PNG.sync.read(readFileSync(test.info().snapshotPath(name))); } catch { /* эталона нет */ }
    const now = PNG.sync.read(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
    if (base && base.width === now.width && base.height === now.height) {
      const bands = [];
      for (let y = 0; y < base.height; y += 1) {
        let hit = false;
        for (let x = 0; x < base.width && !hit; x += 1) {
          const i = (y * base.width + x) * 4;
          hit = Math.abs(base.data[i] - now.data[i]) + Math.abs(base.data[i + 1] - now.data[i + 1]) + Math.abs(base.data[i + 2] - now.data[i + 2]) > 60;
        }
        if (!hit) continue;
        const b = bands[bands.length - 1];
        if (b && y - b[1] <= 3) b[1] = y; else bands.push([y, y]);
      }
      const where = await page.evaluate((list) => list.map(([a, b]) => {
        const name = (el) => {
          if (!el) return '—';
          const cls = String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || '').split(' ')[0];
          return `${el.tagName.toLowerCase()}${el.dataset && el.dataset.testid ? `[${el.dataset.testid}]` : ''}${cls ? `.${cls}` : ''} «${(el.textContent || '').trim().slice(0, 24)}»`;
        };
        // у длинной полосы — и её начало: там обычно то, что сдвинуло всё ниже
        const ys = b - a > 120 ? [a + 4, (a + b) / 2] : [(a + b) / 2];
        return `${a}–${b}: ${ys.map((y) => [60, 206, 350].map((x) => name(document.elementFromPoint(x, y))).join(' | ')).join(' ‖ ')}`;
      }), bands.slice(0, 14));
      e.message += `\n${name}: прокрутка ${await page.evaluate(() => Math.round(window.scrollY))}, полосы отличий (y — элементы):\n  ${where.join('\n  ')}`;
    }
    throw e;
  }
}
// Мир и Профиль — под вкладкой «⋯»
async function tab(page, id) {
  if (id === 'world' || id === 'profile') {
    await page.getByTestId('bottom-nav').locator('[data-tab="more"]').click();
    await page.getByTestId('more-menu').locator(`[data-tab="${id}"]`).click();
    return;
  }
  await page.getByTestId('bottom-nav').locator(`[data-tab="${id}"]`).click();
}

test.describe('визуальные эталоны', () => {
  test.beforeEach(({ isMobile, browserName }) => { test.skip(!isMobile || browserName !== 'chromium', 'эталоны — телефон в Chromium'); });

  test('приветствие', async ({ page }) => {
    const errors = await prepare(page, { account: false });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('welcome')).toBeVisible();
    await match(page, '01-welcome.png');
    expect(errors).toEqual([]);
  });

  test('обучение: Путь, задания, карточка и шаг урока, лавка, профиль', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('path')).toBeVisible();
    await match(page, '02-path.png');
    await page.getByTestId('tasks-card').click();
    await expect(page.getByTestId('tasks')).toBeVisible();
    await match(page, '03-tasks.png');
    await page.locator('[data-nav="back"]').filter({ visible: true }).click();
    await page.locator('[data-testid=path-lesson][data-lesson="sc-i1"]').click();
    await expect(page.getByTestId('lesson-sheet')).toBeVisible();
    await match(page, '04-lesson-sheet.png');
    await page.getByTestId('lesson-start').click();
    await expect(page.getByTestId('lesson')).toBeVisible();
    await match(page, '05-lesson-step.png');
    await page.getByRole('button', { name: 'Выйти из урока' }).click();
    await expect(page.getByTestId('lesson')).toHaveCount(0);
    await tab(page, 'shop');
    await expect(page.getByTestId('shop')).toBeVisible();
    await match(page, '06-shop.png');
    await tab(page, 'profile');
    await expect(page.getByTestId('learn-profile')).toBeVisible();
    await match(page, '07-profile.png');
    expect(errors).toEqual([]);
  });

  test('учебник: оглавление и глава', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await tab(page, 'book');
    await expect(page.getByTestId('textbook')).toBeVisible();
    await match(page, '08-book-toc.png');
    await page.getByTestId('textbook').getByRole('button', { name: /Спрос и предложение/ }).click();
    await expect(page.getByTestId('chapter')).toBeVisible();
    await match(page, '09-chapter.png');
    expect(errors).toEqual([]);
  });

  test('«Мир»', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await tab(page, 'world');
    await expect(page.getByTestId('world')).toBeVisible();
    // бегущая строка с курсами — живая, её прячем
    await match(page, '10-world.png', { ...SHOT, mask: [page.locator('.menu-ticker')] });
    expect(errors).toEqual([]);
  });
});
