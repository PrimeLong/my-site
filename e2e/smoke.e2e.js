import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import katex from 'katex';
import { parseChapter, collectBlocks } from '../src/textbook/markdown.js';
import { freshRoom, resolveQuarter, publicView } from '../api/room.js';
import { makeInitialEconomy, defaultDecisions } from '../src/lib/engine.js';
import { SCREENS } from '../src/learn/screens.js';

/* Общая подготовка каждой страницы: серверные функции подменены, внешние
   запросы и ошибки страницы собираются — тест падает, если сайт полез за
   чем-то наружу (шрифты должны быть свои) или упал JavaScript. */
async function openApp(page, path = '/', apiBody = '{}', { tab = 'world' } = {}) {
  const errors = []; const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) external.push(r.url()); });
  // свой API — только на своём адресе: чужие …/api/… (например, Википедия) тест подменяет сам
  await page.route('**/api/**', (r) => (!r.request().url().startsWith('http://localhost') ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json',
    body: typeof apiBody === 'function' ? apiBody(r.request()) : apiBody })));
  await gotoApp(page, path, tab);
  return { errors, external };
}
/* Главный экран — Путь с нижней панелью; игровые тесты начинают с вкладки «Мир» (там
   прежнее меню). Если открылась партия из автосохранения, панели нет — ничего не жмём. */
async function gotoApp(page, path = '/', tab = 'world') {
  await page.goto(path, { waitUntil: 'networkidle' });
  if (tab && tab !== 'path' && await page.getByTestId('bottom-nav').isVisible()) await openTab(page, tab);
}
// лавка — по отделам: вкладки «Витрина», «Для урока», «Ювелир», «Гардероб», «Полезное»
async function shopTab(page, tab) {
  await page.getByTestId('shop-tabs').locator(`[data-tab="${tab}"]`).click();
  await expect(page.getByTestId('shop-panel')).toHaveAttribute('data-tab', tab);
}
/* вкладки нижней панели; Мир и Профиль — под «⋯»: касание открывает выбор из двух */
async function openTab(page, tab) {
  const nav = page.getByTestId('bottom-nav');
  if (tab === 'world' || tab === 'profile' || tab === 'news') {
    await nav.locator('[data-tab="more"]').click();
    await nav.getByTestId('more-menu').locator(`[data-tab="${tab}"]`).click();
    return;
  }
  await nav.locator(`[data-tab="${tab}"]`).click();
}
// «Задания» — не вкладка, а экран поверх Пути: вкладка «Путь» (повторное нажатие закрывает
// открытый подэкран) и карточка «Задания» наверху
async function openTasks(page) {
  await openTab(page, 'path');
  await page.getByTestId('tasks-card').click();
  await expect(page.getByTestId('tasks')).toBeVisible();
}
/* Вход обязателен: во всех тестах, кроме тестов первого запуска («вход: …»), пользователь уже
   вошёл — аккаунт лежит на устройстве до загрузки страницы. */
const ACCOUNT = { token: 't', login: 'tester', name: 'Тест', emblem: 'star', kidsMode: false };
test.beforeEach(async ({ page }, info) => {
  // уведомление о памяти браузера уже прочитано — кроме теста самого уведомления
  if (!info.title.startsWith('память браузера:')) await page.context().addInitScript(() => { try { localStorage.setItem('ems-storage-notice', '1'); } catch { /* нет хранилища */ } });
  // знакомство с живой моделью уже показано — кроме теста самого знакомства
  if (!info.title.startsWith('живая модель: знакомство')) await page.context().addInitScript(() => { try { localStorage.setItem('ems-model-intro', JSON.stringify(['supply-demand'])); } catch { /* нет хранилища */ } });
  if (info.title.startsWith('вход:')) return;
  await page.context().addInitScript((a) => { try { localStorage.setItem('ems-account', JSON.stringify(a)); } catch { /* нет хранилища */ } }, ACCOUNT);
});
// учебник — своя вкладка внизу; поверх урока он открывается справочником
async function openBook(page) {
  await openTab(page, 'book');
  await expect(page.getByTestId('textbook')).toBeVisible();
}
// у учебника в обучении один «назад»: на прошлую страницу, с первой — в оглавление (вкладка) или туда, откуда открыли
const bookBack = (page) => page.locator('[data-testid=learn-book], [data-testid=book-tab]').locator('[data-nav="back"]').filter({ visible: true }).first().click();
async function toToc(page) {
  for (let k = 0; k < 6 && !(await page.getByTestId('textbook').isVisible()); k += 1) await bookBack(page);
  await expect(page.getByTestId('textbook')).toBeVisible();
}

// ничего на странице не шире окна — ровно та жалоба «сайт можно увести вбок»
async function expectNoSidewaysScroll(page) {
  // с clientWidth, а не innerWidth: на телефоне широкая страница раздвигает и innerWidth, и сравнение молчит
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - Math.min(window.innerWidth, document.documentElement.clientWidth));
  expect(overflow, 'страницу можно прокрутить вбок').toBeLessThanOrEqual(1);
}

async function startSoloGame(page, role = 'Глава Центрального банка') {
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText(role, { exact: true }).click();
  await page.getByRole('checkbox', { name: /Обучение по экрану/ }).uncheck();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  await expect(page.getByRole('button', { name: 'Завершить квартал и применить решения' })).toBeVisible();
}

test('заголовки безопасности: CSP без нарушений на Пути, в уроке, учебнике, лавке и «Мире»', async ({ page }) => {
  const violations = [];
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI}`); }); });
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  const resp = await page.goto('/', { waitUntil: 'networkidle' });
  const h = resp.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBeTruthy();
  expect(h['permissions-policy']).toBeTruthy();
  await expect(page.getByTestId('path')).toBeVisible();
  await startLesson(page, 'sc-i1');
  await expect(page.getByTestId('lesson')).toBeVisible();
  await page.goto('/', { waitUntil: 'networkidle' });
  for (const tab of ['book', 'shop', 'world']) { await openTab(page, tab); await page.waitForTimeout(300); }
  const caught = await page.evaluate(() => window.__csp || []);
  expect([...violations, ...caught]).toEqual([]);
});

test('меню открывается, шрифты свои, внешних запросов нет', async ({ page }) => {
  const { errors, external } = await openApp(page);
  await expect(page.getByRole('heading', { name: 'Инфляция' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  expect(families.map((f) => f.replace(/"/g, ''))).toContain('PT Sans');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await expectNoSidewaysScroll(page);
});

test('одиночная партия: квартал проходит, газета закрывается, карта рисуется', async ({ page, isMobile }) => {
  const { errors } = await openApp(page);
  await startSoloGame(page);
  await expectNoSidewaysScroll(page);

  const finish = page.getByRole('button', { name: 'Завершить квартал и применить решения' });
  await finish.click();
  // газета открывается сама после квартала или по кнопке — закрыть её обязаны оба способа
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (!(await close.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /Газета/ }).first().click();
  }
  await expect(close).toBeVisible();
  await expectNoSidewaysScroll(page);
  await close.click();
  await expect(close).toBeHidden();

  if (!isMobile) {
    await page.getByRole('button', { name: 'Карта', exact: true }).click();
    await expect(page.locator('svg path').first()).toBeVisible();
    expect(await page.locator('svg path').count()).toBeGreaterThan(50);
    // соседняя страна открывает свою карточку; карта разворачивается во весь экран и сворачивается по Esc
    await page.getByRole('button', { name: 'Вестравия', exact: true }).click();
    await expect(page.getByText('Вестравская Республика', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Развернуть карту на весь экран' }).click();
    await expect(page.getByText('Карта открыта во весь экран.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Развернуть карту на весь экран' })).toBeVisible();
    // мир больше листа: карту можно отдалить до всего мира и вернуться к своей стране
    await page.getByRole('button', { name: 'Отдалить карту' }).click();
    await page.getByRole('button', { name: 'Отдалить карту' }).click();
    await expect(page.getByRole('button', { name: 'Отдалить карту' })).toBeDisabled();
    await page.getByRole('button', { name: 'Вернуться к нашей стране' }).click();
    await expect(page.getByRole('button', { name: 'Вернуться к нашей стране' })).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test('обучение: хаб и программа курса открываются', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByText('Как играть', { exact: true }).click();
  await expect(page.getByText('Четыре курса')).toBeVisible();
  await page.getByText('Экономическая политика', { exact: true }).first().click();
  await expect(page.getByText('ПРОГРАММА КУРСА', { exact: false })).toBeVisible();
  await expect(page.getByText('Общество: семь групп вместо одного рейтинга', { exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
  // режимы игры открыты в любом порядке: сразу в «Своё дело», пройти тест
  await page.getByRole('button', { name: /Ко всем курсам/ }).click();
  await page.getByText('Режимы игры', { exact: true }).click();
  await page.getByText('Своё дело', { exact: true }).click();
  await expect(page.getByText('Другая игра на той же экономике')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByText('Тест: своё дело')).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('сетевая партия: лобби, вход, пресс-конференция и карта', async ({ page, isMobile }) => {
  // настоящая комната из серверного кода: Минфин и ЦБ заняты людьми, выборы уже прошли
  let r = freshRoom({ id: 'E2E', mode: 'policy', difficulty: 'medium', president: null, cbPersona: 'hawk', mofPersona: 'austerity' });
  r = { ...r, names: { ...r.names, central_bank: 'Анна', ministry_finance: 'Борис' },
    seats: { ...r.seats, central_bank: 'tok', ministry_finance: 'tok' }, economy: { ...r.economy, quartersToElection: 1 } };
  const sub = () => ({ decisions: { ...r.decisions }, president: null, note: '', pressAnswer: null });
  r = resolveQuarter({ ...r, submissions: { central_bank: sub(), ministry_finance: sub() } });
  const room = publicView(r);
  const lobby = { ...room, occupied: { ...room.occupied, central_bank: false, ministry_finance: false } };
  let joined = false; let submitted = null;
  const { errors } = await openApp(page, '/?room=E2E', (req) => {
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    if (body && body.action === 'join') {
      if (body.session !== ACCOUNT.token) return JSON.stringify({ error: 'нет сессии' });
      joined = true; return JSON.stringify({ token: 'tok', seat: 'ministry_finance', storage: 'memory', room });
    }
    if (body && body.action === 'submit') submitted = body;
    return JSON.stringify({ room: joined ? room : lobby, storage: 'memory' });
  });

  await page.getByText('Минфин', { exact: true }).first().click();
  // по сети — только с профилем: вход уже выполнен, место занимается под ним
  await expect(page.getByText('@tester')).toBeVisible();
  await page.getByRole('button', { name: 'Войти в партию' }).click();

  // на телефоне колонки переключаются вкладками: решения — в первой
  if (isMobile) await page.getByText('Решения', { exact: true }).click();
  // без президента голос власти — Минфин: ему и отвечать на вопрос прессы
  const press = page.locator('.ems-panel').filter({ has: page.locator('> .ems-serif', { hasText: 'Пресс-конференция' }) });
  await expect(press).toBeVisible();
  await press.locator('.ems-card-btn').first().click();
  await expectNoSidewaysScroll(page);

  if (isMobile) await page.getByText('Новости и графики', { exact: true }).click();
  await page.getByRole('tab', { name: /Карта страны/ }).click();
  await expect(page.locator('svg path').first()).toBeVisible();

  await page.getByRole('button', { name: /Отправить решения/ }).first().click();
  await expect.poll(() => submitted && submitted.decisions && submitted.decisions.pressAnswer).toBeTruthy();
  expect(errors).toEqual([]);
});

test('разбор партии открывается из меню «⋯» и показывает сводку', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors } = await openApp(page);
  await startSoloGame(page);
  const finish = page.getByRole('button', { name: 'Завершить квартал и применить решения' });
  for (let i = 0; i < 3; i++) {
    await expect(finish).toBeEnabled({ timeout: 10_000 });
    await finish.click();
    const close = page.getByRole('button', { name: 'Закрыть газету' });
    if (await close.isVisible({ timeout: 2000 }).catch(() => false)) await close.click();
  }
  await page.getByRole('button', { name: 'Ещё действия' }).click();
  await page.getByRole('button', { name: 'Разбор партии' }).click();
  const dialog = page.getByRole('dialog', { name: 'Разбор партии' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Кварталов у руля')).toBeVisible();
  await expectNoSidewaysScroll(page);
  // Escape закрывает разбор; диалог подписывается на клавиатуру после открытия — нажимаем, пока не закроется
  await expect(async () => { await page.keyboard.press('Escape'); await expect(dialog).toBeHidden({ timeout: 1000 }); }).toPass({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('бот-Минфин показывает свои бюджетные ползунки: закупки, выплаты, инвестиции', async ({ page, isMobile }) => {
  const { errors } = await openApp(page);
  await startSoloGame(page);
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  if (isMobile) await page.getByText('Решения', { exact: true }).click();
  for (const label of ['Госзакупки и содержание государства', 'Социальные выплаты', 'Госинвестиции в инфраструктуру']) {
    await expect(page.getByRole('slider', { name: new RegExp(`^${label}: .*от -15 до 15`) })).toBeAttached();
  }
  await page.getByRole('slider', { name: /^Социальные выплаты:/ }).locator('xpath=ancestor::div[contains(@class,"ems-panel")][1]')
    .screenshot({ path: `test-results/bot-mof-${isMobile ? 'phone' : 'desktop'}.png` });
  expect(errors).toEqual([]);
});

test('бот-ЦБ показывает свои ползунки, когда играешь за Минфин', async ({ page, isMobile }) => {
  const { errors } = await openApp(page);
  await startSoloGame(page, 'Глава Министерства финансов');
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  if (isMobile) await page.getByText('Решения', { exact: true }).click();
  for (const label of ['Ключевая ставка', 'Норма резервирования', 'Операции с денежной массой', 'Валютные интервенции']) {
    await expect(page.getByRole('slider', { name: new RegExp(`^${label}: -?\\d`) })).toBeAttached();
  }
  await page.getByRole('slider', { name: /^Ключевая ставка:/ }).locator('xpath=ancestor::div[contains(@class,"ems-panel")][1]')
    .screenshot({ path: `test-results/bot-cb-${isMobile ? 'phone' : 'desktop'}.png` });
  expect(errors).toEqual([]);
});

test('карта: соседние страны на месте, Минфин запускает стройку, после квартала она идёт', async ({ page }) => {
  const { errors } = await openApp(page);
  await startSoloGame(page, 'Глава Министерства финансов');
  // «Карта» — отдельный экран, а не колонка: на телефоне вкладки колонок тут не нужны
  const openMap = () => page.getByRole('button', { name: 'Карта', exact: true }).click();
  await openMap();
  const map = page.locator('svg[aria-label="Карта областей страны"]');
  for (const nb of ['КОРОЛЕВСТВО НОРЛАНД', 'ВЕСТРАВСКАЯ РЕСПУБЛИКА', 'РЕСПУБЛИКА ДЕШТ']) await expect(map.getByText(nb)).toBeAttached();
  await page.getByRole('button', { name: 'Начать стройку' }).click();
  await expect(page.getByRole('button', { name: /Стройка начнётся в конце квартала/ })).toBeVisible();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  await openMap();
  await expect(page.getByText(/^ещё \d+ кв\.$/)).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('общество: после квартала видны группы, коалиция и их лидеры', async ({ page, isMobile }) => {
  const { errors } = await openApp(page);
  await startSoloGame(page, 'Глава Министерства финансов');
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  await page.getByRole('button', { name: 'Общество', exact: true }).click();
  await expect(page.getByText(/^Коалиция власти:/)).toBeVisible();
  for (const name of ['Пенсионеры', 'Силовики', 'Молодёжь']) await expect(page.getByLabel(new RegExp(`^${name}: \\d+ из 100`))).toBeVisible();
  await expect(page.getByText('Галина Воронцова,', { exact: false })).toBeVisible();
  // две бедности рядом — относительная и абсолютная, с пояснением разницы
  await expect(page.getByTestId('poverty')).toContainText('Относительная бедность');
  await expect(page.getByTestId('poverty')).toContainText('Абсолютная бедность');
  await page.screenshot({ path: `test-results/society-${isMobile ? 'phone' : 'desktop'}.png`, fullPage: true });
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('президент ведёт наступление на карте: цель, штурм, продвижение', async ({ page, isMobile }) => {
  test.skip(isMobile, 'сценарий проверяется на ширине компьютера');
  // жребий квартала фиксирован: случайное событие (соседи, кризис) не должно подменять проверяемый штурм
  await page.addInitScript(() => { let x = 42; Math.random = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; });
  const { errors } = await openApp(page);
  await startSoloGame(page, 'Президент');
  // войну объявляют на карте — из карточки Норланда
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await page.getByRole('button', { name: /^Норланд/ }).first().click();
  await page.getByRole('button', { name: /Объявить войну/ }).click();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  // полоса войны — на «Панели»: на вкладке карты операция видна в самой карте
  await page.getByRole('button', { name: 'Панель', exact: true }).click();
  await expect(page.getByText('Наступление: Норланд.')).toBeVisible();
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await page.getByRole('button', { name: /^Копи Хальвика: продвижение 0 из 100/ }).click();
  await page.getByRole('button', { name: /^Штурм/ }).click();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  if (await close.isVisible().catch(() => false)) await close.click();
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await expect(page.getByText(/^Прошлый квартал: штурм — Копи Хальвика, \+\d+/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Копи Хальвика: (продвижение [1-9]\d* из 100|взята)/ })).toBeAttached();
  await page.locator('svg[aria-label="Карта областей страны"]').locator('xpath=../..').screenshot({ path: 'test-results/war-operation.png' });
  expect(errors).toEqual([]);
});

test('детский режим «Мира»: без войны на карте и без вкладки «Война» у президента', async ({ page, isMobile }) => {
  test.skip(isMobile, 'логика та же, проверяется на ширине компьютера');
  await page.context().addInitScript((a) => { try { localStorage.setItem('ems-account', JSON.stringify(a)); } catch { /* нет хранилища */ } }, { ...ACCOUNT, kidsMode: true });
  const { errors } = await openApp(page);
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText('Президент', { exact: true }).click();
  // вместо «Только экономика» — пояснение детского режима
  await expect(page.getByTestId('kids-note')).toContainText('Без войн, переворотов');
  await expect(page.getByRole('checkbox', { name: /Только экономика/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /Обучение по экрану/ }).uncheck();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  await expect(page.getByRole('button', { name: 'Завершить квартал и применить решения' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Война', exact: true })).toHaveCount(0);
  await expect(page.getByText('Распустить парламент')).toHaveCount(0);
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await page.getByRole('button', { name: /^Норланд/ }).first().click();
  await expect(page.getByRole('button', { name: /Объявить войну/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('вызов дня: карточка в меню, общий старт и счётчик кварталов', async ({ page }) => {
  const { errors } = await openApp(page);
  await expect(page.getByTestId('daily-card')).toContainText('Вызов дня');
  await page.getByRole('button', { name: 'Таблица дня' }).click();
  await expect(page.getByText('Сегодня ещё никто не прошёл вызов — будьте первым.')).toBeVisible();
  await page.getByRole('button', { name: 'Принять вызов' }).click();
  await expect(page.getByText(/квартал 1 из 12/)).toBeVisible();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  await expect(page.getByText(/квартал 2 из 12/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('своё дело: старт из меню, время идёт, стройка, склад и вкладки', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByText('Своё дело', { exact: true }).click();
  await page.getByText('Лавка', { exact: true }).click();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  const cash = page.getByLabel('Деньги на счёте');
  await expect(cash).toBeVisible();
  // первый запуск — короткое вступление
  await page.getByRole('dialog', { name: 'Своё дело' }).getByRole('button', { name: 'Начать' }).click();
  await expect(page.getByText(/Задание 1 из/)).toBeVisible();
  await page.getByRole('button', { name: 'Скорость 4×' }).click();
  const before = await cash.textContent();
  await expect.poll(async () => cash.textContent(), { timeout: 10000 }).not.toBe(before);
  for (const name of ['Склад и рынок', 'Исследования', 'Финансы', 'Страна', 'Производство']) {
    await page.getByRole('tab', { name }).click();
  }
  await expect(page.getByText('Хлебозавод').first()).toBeVisible();
  await expect(page.getByText(/автосохранение/)).toBeVisible();
  await expectNoSidewaysScroll(page);
  // перезагрузка страницы открывает то же дело, а не меню
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Деньги на счёте')).toBeVisible();
  expect(errors).toEqual([]);
});

test('оборонительная война: фронт на карте и приказ армии', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const e = { ...makeInitialEconomy(), warQuartersLeft: 3, warType: 'defensive', warElapsed: 2, activeCrises: ['war'], regime: 'war',
    defenseCampaign: { pressure: { agri: 72, periphery: 30 }, occupied: [], morale: 70, next: 'agri', last: { target: 'periphery', stance: 'defend', hit: 'agri', gain: 14, pushed: 0 } } };
  const snap = { app: 'economic-panel', v: 99, setup: { role: 'president', difficulty: 'medium', goal: 'living_standards', scenario: 'sandbox', cbPersona: 'pragmatic', mofPersona: 'technocrat', president: { enabled: false, persona: 'technocrat' } },
    economy: e, history: [{ q: 0, label: 'x', ...e }], decisions: defaultDecisions(e), quarterIndex: 5 };
  await page.addInitScript((s) => { localStorage.setItem('ems-autosave-v1', JSON.stringify({ ...s, v: 1 })); }, snap);
  await gotoApp(page);
  await expect(page.getByText(/Республика Дешт наступает/).first()).toBeVisible();
  await page.getByText(/Республика Дешт наступает/).first().click();
  await expect(page.getByLabel('Оборонительная война')).toBeVisible();
  await page.getByLabel('Оборонительная война').getByRole('button', { name: /Контрудар/ }).click();
  await expect(page.getByLabel('Оборонительная война').getByRole('button', { name: /Контрудар/ })).toHaveCSS('color', /./);
  expect(errors).toEqual([]);
});

test('своё дело: дерево технологий, команда и сохранение в слот на сервере', async ({ page }) => {
  const { makeTycoon, snapshotTycoon } = await import('../src/lib/tycoon.js');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let saved = null;
  await page.route('**/api/**', (r) => {
    const req = r.request();
    if (req.url().includes('/api/solo') && req.method() === 'POST') {
      saved = JSON.parse(req.postData());
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ slots: [{ savedAt: new Date().toISOString(), buildings: 3, cash: 4, quarterIndex: 1 }, null, null, null] }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ slots: [null, null, null, null] }) });
  });
  const save = { ...snapshotTycoon(makeTycoon({ start: 'farm' })), introSeen: true };
  await page.addInitScript((s) => { localStorage.setItem('ems-tycoon-v1', JSON.stringify({ ...s, savedAt: Date.now() })); }, save);
  await gotoApp(page);
  await page.getByText('Продолжить', { exact: true }).click();
  await expect(page.getByText(/Задание 1 из/)).toBeVisible();
  // таблица рекордов открывается; вход выполнен — рекорд записывается сам
  await page.getByRole('button', { name: 'Рекорды' }).click();
  const recs = page.getByRole('dialog', { name: 'Рекорды «Своего дела»' });
  await expect(recs.getByText(/Рекорд записывается сам/)).toBeVisible();
  await recs.getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('tab', { name: 'Исследования' }).click();
  await page.getByRole('button', { name: /Кадровое агентство/ }).click();
  await expect(page.getByText('Люди на новые здания набираются вдвое быстрее.')).toBeVisible();
  await page.getByRole('tab', { name: 'Команда' }).click();
  await expect(page.getByText('Управляющий производством')).toBeVisible();
  await page.getByRole('button', { name: 'Партии' }).click();
  await page.getByRole('button', { name: 'Сохранить сюда' }).first().click();
  await expect.poll(() => saved && saved.kind).toBe('tycoon');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

const accountApi = (req) => {
  let body = null; try { body = req.postDataJSON(); } catch { body = null; }
  const profile = { login: 'anna', name: 'Анна', emblem: 'star', playerId: 'p1', createdAt: Date.now(), stats: { rooms: 3, quarters: 12, leaves: 1 } };
  if (body && body.action === 'register') return JSON.stringify({ token: 'sess', profile, recoveryCode: 'ABCD-EFGH-JKMN' });
  if (body && body.action === 'recover') return JSON.stringify({ token: 'sess2', profile, recoveryCode: 'PQRS-TUVW-XYZ2' });
  if (body && body.action === 'login') return JSON.stringify({ token: 'sess', profile });
  if (body && body.action === 'me') return JSON.stringify({ profile });
  if (body && body.action === 'update') return JSON.stringify({ profile: { ...profile, emblem: body.emblem || 'star' } });
  // один друг, бывший в сети вчера, — для экранов «Друзья» и «Профиль друга»
  if (body && body.action === 'friends') {
    const at = Date.now() - 86400000;
    return JSON.stringify({ me: 'tester', friends: [{ login: 'boris', name: 'Борис', emblem: 'crown', since: at,
      card: { at, wear: {}, streak: 3, xp: 120, level: 'start', league: 'bronze', seals: ['first'], album: 1, months: [], xpDays: {}, events: [] } }], incoming: [], outgoing: [], races: [] });
  }
  return '{}';
};
/* Гостевой старт: после цели — сразу первый урок без аккаунта. Выйти из урока и с Пути
   открыть регистрацию («Сохраните прогресс»). */
async function guestToRegister(page) {
  await expect(page.getByTestId('lesson')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  const ask = page.getByRole('dialog', { name: 'Выйти из урока?' });
  if (await ask.isVisible().catch(() => false)) await ask.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByTestId('guest-save').getByTestId('guest-register').click();
  await expect(page.getByTestId('welcome-register')).toBeVisible();
  return page.getByTestId('welcome-register');
}
// без аккаунта не открыто ничего, кроме приветствия, входа и регистрации
async function expectGateOnly(page) {
  for (const id of ['bottom-nav', 'shell', 'path', 'tasks', 'learn-profile', 'world', 'lesson', 'learn-book']) await expect(page.getByTestId(id)).toHaveCount(0);
}

test('вход: первый запуск — приветствие, цель, урок гостем, «Сохраните прогресс», регистрация; выход, вход и восстановление', async ({ page }) => {
  test.setTimeout(120_000);
  await withTestFlag(page);
  const { errors, external } = await openApp(page, '/', accountApi, { tab: null });
  // приветствие: три обещания и мини-задача с ответом сразу
  await expect(page.getByTestId('welcome-values').locator('li')).toHaveCount(3);
  await page.getByTestId('welcome-try').getByRole('button', { name: 'Станет меньше' }).click();
  await expect(page.getByTestId('welcome-try-say')).toContainText('закон спроса');
  const hello = page.getByTestId('welcome');
  await expect(hello).toBeVisible();
  await expect(hello.getByTestId('mascot').first()).toHaveAttribute('data-mood', 'wave');
  await expectGateOnly(page);
  // у первого экрана «назад» нет, у остальных — один
  await expect(page.locator('[data-nav="back"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Начать' }).click();
  const goal = page.getByTestId('welcome-goal');
  await expect(goal.locator('[data-nav="back"]')).toHaveCount(1);
  await expect(goal.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
  await goal.getByRole('group', { name: 'Цель' }).getByRole('button', { name: 'Поступление в вуз' }).click();
  await goal.getByRole('group', { name: 'Минут в день' }).getByRole('button', { name: '10 минут' }).click();
  await goal.getByRole('group', { name: 'Знания' }).getByRole('button', { name: 'Начинаю с нуля' }).click();
  await goal.getByRole('button', { name: 'Продолжить' }).click();
  // гостевой старт: сразу первый урок, без аккаунта; после урока — «Сохраните прогресс»
  await expect(page.getByTestId('lesson')).toBeVisible();
  await playLesson(page);
  const save = page.getByTestId('lesson-result').getByTestId('guest-save');
  await expect(save).toContainText('Сохраните прогресс');
  await save.getByTestId('guest-register').click();
  const reg = page.getByTestId('welcome-register');
  await expect(reg).toContainText('Сохраните прогресс');
  await expect(reg.locator('[data-nav="back"]')).toHaveCount(1);
  await expectNoSidewaysScroll(page);
  await reg.getByLabel('Логин').fill('anna');
  await reg.getByLabel('Пароль').fill('secret1');
  await reg.getByLabel('Имя').fill('Анна');
  // год рождения: до 16 лет «Мир» — в детском режиме, подсказка говорит об этом сразу
  await reg.getByTestId('birth-year').fill('2013');
  await expect(reg.getByText(/детском режиме/)).toBeVisible();
  await reg.getByTestId('birth-year').fill('2000');
  // две отдельные отметки: «ознакомлен со страницей» и «согласие на обработку данных»; без обеих аккаунт не создать
  await expect(reg.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
  await reg.getByTestId('consent-privacy').click();
  await expect(page.getByTestId('privacy')).toContainText('Что мы храним');
  await expect(page.getByTestId('privacy')).toContainText('Upstash');
  await expect(page.getByTestId('privacy')).toContainText('за пределами России');
  await page.getByTestId('privacy').getByRole('button', { name: 'Закрыть' }).click();
  await reg.getByTestId('consent-terms').click();
  await expect(page.getByTestId('terms')).toContainText('Учебная игра, не финансовый совет');
  await page.getByTestId('terms').getByRole('button', { name: 'Закрыть' }).click();
  await reg.getByTestId('consent-page').check();
  await expect(reg.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
  await reg.getByTestId('consent-pd').check();
  await reg.getByRole('button', { name: 'Создать аккаунт' }).click();
  // почты нет — код восстановления показывается один раз
  await expect(page.getByTestId('recovery-code')).toHaveText('ABCD-EFGH-JKMN');
  await expectGateOnly(page);
  await page.getByRole('button', { name: 'Я сохранил код' }).click();
  // Путь; цель дня — минуты занятий (10 минут); урок гостя перешёл в аккаунт и засчитан
  await expect(page.getByTestId('path')).toBeVisible();
  await expect(page.getByTestId('goal')).toContainText('/10');
  await expect(page.getByTestId('guest-save')).toHaveCount(0);
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('ems-textbook-v1')).learn.lessons['sc-i1'] || {}).runs)).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('ems-guest'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ems-onboarding')))).toEqual({ goal: 'exam', minutes: 10, knows: false });

  // аккаунт — в профиле, под шестерёнкой; выход возвращает на приветствие
  await openTab(page, 'profile');
  await page.getByTestId('prof-settings-open').click();
  await page.getByTestId('prof-account').click();
  const prof = page.getByRole('dialog', { name: 'Профиль' });
  await expect(prof.getByText('Кварталов по сети')).toBeVisible();
  await prof.getByRole('button', { name: 'Корона' }).click();
  await expect(prof.getByText('Сохранено')).toBeVisible();
  await prof.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expectGateOnly(page);

  // «У меня уже есть аккаунт» → вход
  await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
  const login = page.getByTestId('welcome-login');
  await login.getByLabel('Логин').fill('anna');
  await login.getByLabel('Пароль').fill('secret1');
  await login.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByTestId('path')).toBeVisible();

  // забыли пароль: логин, код и новый пароль → новый код → Путь
  await openTab(page, 'profile');
  await page.getByTestId('prof-settings-open').click();
  await page.getByTestId('prof-account').click();
  await page.getByRole('dialog', { name: 'Профиль' }).getByRole('button', { name: 'Выйти' }).click();
  await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
  await page.getByRole('button', { name: 'Забыли пароль?' }).click();
  const rec = page.getByTestId('welcome-recover');
  await rec.getByLabel('Логин').fill('anna');
  await rec.getByLabel('Код восстановления').fill('abcd-efgh-jkmn');
  await rec.getByLabel('Новый пароль').fill('fresh12');
  await rec.getByRole('button', { name: 'Задать пароль' }).click();
  await expect(page.getByTestId('recovery-code')).toHaveText('PQRS-TUVW-XYZ2');
  await page.getByRole('button', { name: 'Я сохранил код' }).click();
  await expect(page.getByTestId('path')).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('вход: до 14 лет — отдельный шаг «Подтверждение родителя», сервер получает отметку и имя', async ({ page }) => {
  let sent = null;
  await openApp(page, '/', (req) => {
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    if (body && body.action === 'register') sent = body;
    return accountApi(req);
  }, { tab: null });
  await page.getByRole('button', { name: 'Начать' }).click();
  const goal = page.getByTestId('welcome-goal');
  for (const g of ['Цель', 'Минут в день', 'Знания']) await goal.getByRole('group', { name: g }).getByRole('button').first().click();
  await goal.getByRole('button', { name: 'Продолжить' }).click();
  const reg = await guestToRegister(page);
  await reg.getByLabel('Логин').fill('kid');
  await reg.getByLabel('Пароль').fill('secret1');
  await reg.getByTestId('birth-year').fill(String(new Date().getFullYear() - 12));
  await reg.getByTestId('consent-page').check();
  await reg.getByTestId('consent-pd').check();
  await reg.getByRole('button', { name: 'Дальше: подтверждение родителя' }).click();
  const parent = page.getByTestId('welcome-parent');
  await expect(parent.getByRole('heading', { name: 'Подтверждение родителя' })).toBeVisible();
  await expect(parent.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
  await parent.getByTestId('parent-name').fill('Ольга Петрова');
  await expect(parent.getByRole('button', { name: 'Создать аккаунт' })).toBeDisabled();
  await parent.getByTestId('parent-consent').check();
  // «назад» возвращает к форме, ответы не теряются
  await parent.locator('[data-nav="back"]').click();
  await expect(page.getByTestId('welcome-register').getByTestId('consent-pd')).toBeChecked();
  await page.getByRole('button', { name: 'Дальше: подтверждение родителя' }).click();
  await page.getByTestId('welcome-parent').getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByTestId('recovery-code')).toBeVisible();
  expect(sent).toMatchObject({ consentPage: true, consentPd: true, parentConsent: true, parentName: 'Ольга Петрова' });
});

test('вход: без аккаунта закрыто всё — и приглашение в сетевую комнату', async ({ page }) => {
  const { errors } = await openApp(page, '/?room=E2E', '{}', { tab: null });
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expectGateOnly(page);
  await expect(page.getByText('Минфин', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('обучение: практика «требование пенсионеров» решается уступкой', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(() => localStorage.setItem('ems-course-progress', JSON.stringify({ basics: true, budget: true, fx: true, expectations: true, crisis: true, stabilization: true, pr_capital: true, pr_reforms: true, pr_regime: true })));
  await gotoApp(page);
  await page.getByText('Как играть', { exact: true }).click();
  await page.getByText('Экономическая политика', { exact: true }).first().click();
  await page.getByText('Общество: семь групп вместо одного рейтинга', { exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByText('Тест: общество')).toBeVisible();
  // ответы теста перемешаны — отвечаем по тексту верного варианта
  for (const t of ['Силовики в оппозиции', 'Сначала поддержка немного подрастёт', 'Бизнес: дорогой кредит']) await page.getByText(t, { exact: false }).first().click();
  await page.getByRole('button', { name: 'Проверить ответы' }).click();
  await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByText('Практика: требование пенсионеров')).toBeVisible();
  // у задачи есть инструменты — ответ лидеру, соцвыплаты и ставка — и видна экономика целиком
  await expect(page.getByText(/Соцвыплаты|Социальные выплаты/).first()).toBeVisible();
  await expect(page.getByText(/Ключевая ставка/).first()).toBeVisible();
  await expect(page.getByTestId('practice-economy')).toContainText('Безработица');
  await page.getByRole('button', { name: /Проиндексировать пенсии/ }).click();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Завершить квартал' }).click();
  await expect(page.getByRole('button', { name: /^Далее/ })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('обучение: практика обороны от Дешта — контрудар удерживает фронт', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(() => localStorage.setItem('ems-course-progress', JSON.stringify({ pr_capital: true, society: true, pr_reforms: true, pr_regime: true })));
  await gotoApp(page);
  await page.getByText('Как играть', { exact: true }).click();
  await page.getByText('Президент', { exact: true }).first().click();
  await page.getByText('Война, мир и реванш', { exact: true }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^Далее/ }).click();
  for (const t of ['Сначала нужно взять Ледяной перевал', 'Действуют партизаны', 'Признание новой границы', 'Доля обороны держится на новом уровне']) await page.getByText(t, { exact: false }).first().click();
  await page.getByRole('button', { name: 'Проверить ответы' }).click();
  await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByText('Практика: отбить наступление Дешта')).toBeVisible();
  await page.getByRole('button', { name: /Контрудар/ }).click();
  for (let i = 0; i < 6; i++) {
    const btn = page.getByRole('button', { name: 'Завершить квартал' });
    if (!(await btn.isVisible())) break;
    await btn.click();
  }
  await expect(page.getByRole('button', { name: /^Далее/ })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('дипломатия: президент отвечает на инцидент с Дештом и отправляет помощь', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const e = { ...makeInitialEconomy(), deshtMobilized: 3, relations: { north: 50, west: 64, southwest: 18 },
    neighborEvent: { id: 'border_incident', country: 'southwest', q: 5, deadline: 6 } };
  const snap = { app: 'economic-panel', v: 99, setup: { role: 'president', difficulty: 'medium', goal: 'living_standards', scenario: 'sandbox', cbPersona: 'pragmatic', mofPersona: 'technocrat', president: { enabled: false, persona: 'technocrat' } },
    economy: e, history: [{ q: 0, label: 'x', ...e }], decisions: defaultDecisions(e), quarterIndex: 5 };
  await page.addInitScript((s) => { localStorage.setItem('ems-autosave-v1', JSON.stringify({ ...s, v: 1 })); }, snap);
  await gotoApp(page);
  await page.getByText(/Пограничный инцидент с Дештом/).first().click();
  await page.getByRole('button', { name: /Пограничный инцидент/ }).click();
  await page.getByRole('button', { name: /Замять тихо/ }).click();
  await page.getByRole('button', { name: /Помощь/ }).click();
  await expect(page.getByRole('button', { name: /Помощь/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  // скрытая панель не перерисовывается, пока открыта карта: новости — после возврата на неё
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  await page.getByRole('button', { name: 'Панель', exact: true }).click();
  await expect(page.getByText(/ПОМОЩЬ ДЕШТУ/i).first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('своё дело: конкуренты — доля рынка, карточки компаний и поглощение', async ({ page }) => {
  const T = await import('../src/lib/tycoon.js');
  const { withSeededRandom } = await import('../src/lib/catalog.js');
  let st = T.makeTycoon({ start: 'retail' });
  st = withSeededRandom(3, () => T.tick(st, 60 * 7 + 20));
  st = { ...st, cash: 500, rivals: st.rivals.map((c) => (c.id === 'kolos' ? { ...c, distress: 1 } : c)) };
  const save = { ...T.snapshotTycoon(st), introSeen: true };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"slots":[null,null,null,null]}' }));
  await page.addInitScript((s) => { localStorage.setItem('ems-tycoon-v1', JSON.stringify({ ...s, savedAt: Date.now() })); }, save);
  await gotoApp(page);
  await page.getByText('Продолжить', { exact: true }).click();
  await page.getByRole('button', { name: 'Пауза' }).click();
  await page.getByRole('tab', { name: 'Конкуренты' }).click();
  await expect(page.getByText('Доля рынка')).toBeVisible();
  await expect(page.getByText('Хлебный дом «Колос»')).toBeVisible();
  await page.getByRole('button', { name: /^Купить/ }).first().click();
  await expect(page.getByText('куплен вами')).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('война на карте: президент объявляет войну Дешту из карточки страны', async ({ page, isMobile }) => {
  test.skip(isMobile, 'сценарий проверяется на ширине компьютера');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { let x = 42; Math.random = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; });
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await gotoApp(page);
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText('Президент', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Обучение по экрану/ }).uncheck();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await page.getByRole('button', { name: /^Дешт/ }).first().click();
  await page.getByRole('button', { name: /Объявить войну/ }).click();
  await expect(page.getByText('Война будет объявлена в конце квартала.')).toBeVisible();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  await page.waitForTimeout(2500);
  if (await close.isVisible().catch(() => false)) await close.click();
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await expect(page.getByText(/Наступление: Дешт/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Приграничные степи: продвижение/ })).toBeAttached();
  expect(errors).toEqual([]);
});

test('обучение по экрану: включено в первой партии, проходит все шаги и повторяется из меню', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText('Глава Центрального банка', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Обучение по экрану/ })).toBeChecked();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  const tour = page.getByRole('dialog', { name: /Обучение/ });
  await expect(tour).toBeVisible();
  await expect(tour.getByText('Первая партия')).toBeVisible();
  for (let i = 0; i < 20; i++) {
    const done = tour.getByRole('button', { name: 'Понятно, играть' });
    if (await done.isVisible().catch(() => false)) { await done.click(); break; }
    await tour.getByRole('button', { name: 'Далее' }).click();
  }
  await expect(tour).toBeHidden();
  await page.getByRole('button', { name: 'Ещё действия' }).click();
  await page.getByText('Обучение по экрану').click();
  await expect(page.getByRole('dialog', { name: /Обучение/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Обучение/ })).toBeHidden();
  expect(errors).toEqual([]);
});

// кнопка квартала всегда под рукой: закреплена внизу экрана, листать к ней не нужно
test('кнопка квартала закреплена внизу экрана', async ({ page }) => {
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await gotoApp(page);
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText('Глава Центрального банка', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Обучение по экрану/ }).uncheck();
  await page.getByRole('button', { name: 'Принять полномочия' }).click();
  const btn = page.getByRole('button', { name: 'Завершить квартал и применить решения' });
  await expect(btn).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const box = await btn.boundingBox();
  const vh = page.viewportSize().height;
  expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
  expect(box.y).toBeGreaterThan(vh - 140);
});

test('лаборатория: один рычаг, четыре графика разницы с базой', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByText('Лаборатория', { exact: true }).first().click();
  const charts = page.getByTestId('lab-charts');
  await expect(charts).toBeVisible();
  // четыре показателя и ставка: по умолчанию шок ставки живёт в правиле Тейлора
  await expect(charts.locator('.recharts-line')).toHaveCount(5);
  await expect(page.getByText(/пик .* на \d+-м кв\./).first()).toBeVisible();
  await expect(page.getByTestId('lab-cb-note')).toContainText('правилу Тейлора');
  await page.getByRole('button', { name: 'держит ставку выше' }).click();
  await expect(page.getByTestId('lab-cb-note')).toContainText('сама почти не возвращается');
  await page.getByRole('button', { name: 'НДС', exact: true }).click();
  await expect(page.getByText(/НДС сразу поднимает уровень цен/)).toBeVisible();
  await page.getByRole('button', { name: 'ставка стоит' }).click();
  await expect(charts.locator('.recharts-line')).toHaveCount(4);
  // темп расходов: по умолчанию разовый сдвиг, уровень расходов — около +0,5%, а не +2%
  await page.getByRole('button', { name: 'Госзакупки и содержание государства', exact: true }).click();
  await expect(page.getByRole('button', { name: 'расходы разово выше навсегда' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('lab-level')).toContainText('через квартал +0.5%');
  // фон: без шумов или на фоне шумов с полосой
  await page.getByRole('button', { name: /на фоне шумов/ }).click();
  await expect(page.getByTestId('lab-cb-note').locator('..')).toContainText('медиана');
  // казино — не игра, а расчёт: пять гостей сходятся к матожиданию, ставок и наград нет
  const casino = page.getByTestId('lab-casino');
  await expect(casino).toContainText('Почему казино всегда в плюсе');
  await expect(casino.getByTestId('lab-casino-chart').locator('.recharts-line')).toHaveCount(5);
  await expect(casino.getByTestId('lab-casino-table').locator('tbody tr')).toHaveCount(3);
  await expect(casino.getByTestId('lab-casino-table')).toContainText('27,0 кр.');
  await casino.getByRole('button', { name: 'бинарный опцион' }).click();
  await expect(casino.getByTestId('lab-casino-table')).toContainText('75,0 кр.');
  await expect(casino.getByTestId('lab-casino-binary')).toContainText('−7,5%');
  await expect(casino.getByRole('button', { name: /ставк/i })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('после квартала: «а если бы вы ничего не делали» показывает вклад решения', async ({ page, isMobile }) => {
  test.skip(isMobile, 'рычаги на телефоне в отдельной вкладке — логика та же');
  const { errors } = await openApp(page);
  await startSoloGame(page);
  const slider = page.getByRole('slider', { name: /^Ключевая ставка, текущее значение/ });
  await slider.focus();
  for (let i = 0; i < 4; i++) await slider.press('ArrowRight');
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  const card = page.getByTestId('counterfactual');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Вы изменили: ключевая ставка');
  await expect(card).toContainText('ваш вклад');
  // накопленное сравнение: вся партия в мире без ваших решений
  await expect(page.getByTestId('counterfactual-cum')).toContainText('С начала партии');
  await expect(page.getByTestId('counterfactual-cum')).toContainText('Средняя инфляция за партию');
  expect(errors).toEqual([]);
});

test('учебник: оглавление, формулы KaTeX, график с ползунком, задача и повторение, без внешних запросов', async ({ page }) => {
  const { errors, external } = await openApp(page);
  await openBook(page);
  const toc = page.getByTestId('textbook');
  // главы — по уровням курса; недописанные — свёрнутым списком «Готовятся» в конце
  await expect(toc.getByTestId('tb-level-group')).toHaveCount(5);
  await expect(toc.getByText('Уровень 2 · Базовый')).toBeVisible();
  await expect(toc.locator('[data-status="ready"]')).toHaveCount(17);
  await expect(toc.getByTestId('tb-planned')).toContainText('ещё 5 глав');
  await expectNoSidewaysScroll(page);

  await toc.getByRole('button', { name: /Спрос и предложение/ }).click();
  const ch = page.getByTestId('chapter');
  await expect(ch.locator('h1')).toHaveText('Спрос и предложение');
  // оглавление главы по разделам ведёт к заголовку
  await expect(ch.getByTestId('tb-box-goals')).toContainText('После главы вы сможете');
  await expect(ch.getByTestId('tb-section-progress')).toContainText('пройдено разделов: 0 из 4');
  await ch.getByTestId('tb-sections').getByRole('button', { name: 'Равновесие и его сдвиги' }).click();
  await expect(ch.locator('h2', { hasText: 'Равновесие' })).toBeInViewport();
  // формулы отрисованы KaTeX, шрифты KaTeX — из сборки, а не с CDN
  await expect(ch.locator('.katex').first()).toBeVisible();
  expect(await ch.locator('.katex').count()).toBeGreaterThan(10);
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  expect(families.some((f) => f.startsWith('KaTeX'))).toBe(true);

  // ползунок сдвигает спрос: равновесная цена 20 → 25 при сдвиге на 30
  const chart = ch.getByTestId('tb-chart').filter({ has: page.getByRole('slider', { name: 'Сдвиг спроса', exact: true }) }).first();
  await expect(chart.getByTestId('tb-readout')).toContainText('Равновесная цена: 20');
  await chart.getByRole('slider', { name: 'Сдвиг спроса', exact: true }).fill('30');
  await expect(chart.getByTestId('tb-readout')).toContainText('Равновесная цена: 25');
  await expect(chart.getByTestId('tb-readout')).toContainText('Равновесное количество: 80');

  // задача: подсказка перед решением; неверный ответ уходит на повторение, верный засчитывается
  const prob = ch.locator('[data-problem="sd-equilibrium"]');
  await expect(prob.getByTestId('tb-level')).toHaveText('базовый');
  await prob.getByRole('button', { name: /^Подсказка/ }).click();
  await expect(prob.getByTestId('tb-hints')).toContainText('приравняйте');
  await prob.getByRole('textbox').fill('29');
  // уверенность — по желанию: без отметки ответ всё равно проверяется
  await prob.getByRole('button', { name: 'Проверить' }).click();
  await expect(prob.getByTestId('tb-verdict')).toContainText('Пока неверно');
  // единицу из подписи можно дописать к ответу
  await prob.getByRole('textbox').fill('30 руб.');
  await prob.getByRole('button', { name: 'Не уверен', exact: true }).click();
  await prob.getByRole('button', { name: 'Проверить' }).click();
  await expect(prob.getByTestId('tb-verdict')).toContainText('Верно: 30 руб.');
  await expect(prob.getByTestId('tb-verdict')).not.toContainText('руб..');
  // ошибся, потом ответил верно — повторение остаётся через два дня, и решённой задача не считается
  await expect(prob.getByTestId('tb-verdict')).toContainText('вернётся через 2 дня');
  await expect(prob).toContainText('была ошибка · повтор через 2 дня');
  await prob.getByRole('button', { name: 'Решение' }).click();
  await expect(prob).toContainText('Приравниваем объёмы');
  // задача в несколько шагов: засчитывается, только если верны все шаги
  const multi = ch.locator('[data-problem="sd-read"]');
  await multi.getByRole('textbox', { name: 'Задача 1, шаг а)' }).fill('24');
  await multi.getByRole('textbox', { name: 'Задача 1, шаг б)' }).fill('20');
  await multi.getByRole('textbox', { name: 'Задача 1, шаг в)' }).fill('24');
  await multi.getByRole('button', { name: 'Уверен', exact: true }).click();
  await multi.getByRole('button', { name: 'Проверить' }).click();
  await expect(multi.getByTestId('tb-verdict')).toContainText('Не сошлось: в)');
  await multi.getByRole('textbox', { name: 'Задача 1, шаг в)' }).fill('39');
  await multi.getByRole('button', { name: 'Уверен', exact: true }).click();
  await multi.getByRole('button', { name: 'Проверить' }).click();
  await expect(multi.getByTestId('tb-verdict')).toContainText('Верно: а) 24 ед.; б) 20 руб.; в) 39 ед.');
  // калькулятор задачи: корень и скобки; результат — в поле, где стоял курсор
  await multi.getByRole('textbox', { name: 'Задача 1, шаг б)' }).fill('');
  await multi.getByTestId('tb-calc-open').click();
  await multi.getByRole('textbox', { name: 'Выражение для калькулятора' }).fill('√(300+100)');
  await expect(multi.getByTestId('tb-calc-value')).toHaveText('= 20');
  // «=» — как в калькуляторе урока: выражение заменяется результатом, с ним можно считать дальше
  const tbCalc = multi.getByTestId('tb-calc');
  await tbCalc.locator('[data-calc="="]').click();
  await expect(tbCalc.getByRole('textbox', { name: 'Выражение для калькулятора' })).toHaveValue('20');
  for (const k of ['×', '2', '⌫', '1']) await tbCalc.locator(`[data-calc="${k}"]`).click();
  await expect(multi.getByTestId('tb-calc-value')).toHaveText('= 20');
  await multi.getByTestId('tb-calc-use').click();
  await expect(multi.getByRole('textbox', { name: 'Задача 1, шаг б)' })).toHaveValue('20');
  // ловушка: типичный неверный ответ получает объяснение ошибки
  const floor = ch.locator('[data-problem="sd-floor"]');
  await floor.getByRole('textbox').fill('70');
  await floor.getByRole('button', { name: 'Не уверен', exact: true }).click();
  await floor.getByRole('button', { name: 'Проверить' }).click();
  await expect(floor.getByTestId('tb-trap')).toContainText('разница между предложением и спросом');
  // задачи свёрнуты по уровням: базовый открыт, семинарский — по нажатию
  await expect(ch.locator('[data-problem="sd-tf-law"]')).toHaveCount(0);
  await ch.locator('[data-testid="tb-level-group"][data-level="Семинарский уровень"]').getByRole('button').first().click();
  // «верно или неверно»: сначала объяснение, потом выбор, потом сверка с ключевыми пунктами
  const tf = ch.locator('[data-problem="sd-tf-law"]');
  await expect(tf.getByRole('button', { name: 'Неверно', exact: true })).toBeDisabled();
  await tf.getByRole('textbox').fill('сдвинулась сама кривая спроса вправо');
  await tf.getByRole('button', { name: 'Уверен', exact: true }).click();
  await tf.getByRole('button', { name: 'Неверно', exact: true }).click();
  await expect(tf.getByTestId('tb-points')).toContainText('сдвиг кривой спроса вправо');
  await expect(tf.getByTestId('tb-verdict')).toContainText('Теперь сверьте объяснение');
  await tf.getByRole('button', { name: 'Совпало', exact: true }).click();
  await expect(tf.getByTestId('tb-verdict')).toContainText('Засчитано');
  await expect(tf).toContainText('Закон спроса при этом выполняется');
  // графическая: сначала прогноз, потом сдвиг; не та кривая или не тот прогноз — неверно
  const gr = ch.locator('[data-problem="sd-graph-flour"]');
  await expect(gr.getByRole('button', { name: 'Уверен', exact: true })).toHaveCount(0);
  await gr.getByRole('button', { name: 'Проверить прогноз' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Сначала отметьте прогноз');
  await gr.getByRole('button', { name: 'цена: растёт' }).click();
  await gr.getByRole('button', { name: 'количество: растёт' }).click();
  await gr.getByRole('button', { name: 'Проверить прогноз' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Теперь сдвиньте');
  await gr.getByRole('slider', { name: 'Сдвиг спроса', exact: true }).fill('-20');
  await gr.getByRole('button', { name: 'Проверить прогноз' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Пока неверно');
  await gr.getByRole('slider', { name: 'Сдвиг спроса', exact: true }).fill('0');
  await gr.getByRole('slider', { name: 'Сдвиг предложения' }).fill('-20');
  await gr.getByRole('button', { name: 'Проверить прогноз' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Сдвиг верный, а прогноз — нет: количество падает, а не растёт');
  await gr.getByRole('button', { name: 'количество: падает' }).click();
  await gr.getByRole('button', { name: 'Проверить прогноз' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Верно: цена растёт, количество падает');
  await ch.getByRole('button', { name: 'Отметить главу прочитанной' }).click();
  await expect(ch.getByRole('button', { name: /Глава прочитана/ })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // ссылка на другую главу — и «Назад» туда, где читали, на то же место
  const link = ch.getByRole('button', { name: '«Провалы рынка и налоги»' }).first();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const y0 = await page.evaluate(() => window.scrollY);
  expect(y0).toBeGreaterThan(500);
  await link.click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'market-failures');
  await page.waitForTimeout(400);
  await bookBack(page);
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'supply-demand');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(Math.max(0, y0 - 400));
  // крупнее текст — и ничего не уезжает вбок
  await page.getByRole('button', { name: 'Крупнее текст' }).click();
  await page.getByRole('button', { name: 'Крупнее текст' }).click();
  await expect(page.getByTestId('tb-reader-bar')).toContainText('130%');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Мельче текст' }).click();
  await page.getByRole('button', { name: 'Мельче текст' }).click();

  await toToc(page);
  await expect(page.getByTestId('tb-stats')).toContainText('Глав прочитано: 1 из 17');
  // уверенные ответы — на странице «Мой прогресс»: два из трёх верны (включая задачу в несколько шагов; ответ
  // без отметки в счёт не идёт), неуверенный — верен; у задачи на графике вместо уверенности прогноз
  await page.getByTestId('tb-stats-link').click();
  await expect(page.getByTestId('stats-confidence')).toContainText('верно 2 из 3 (67%)');
  await expect(page.getByTestId('stats-confidence')).toContainText('неуверенные: верно 1 из 2');
  await toToc(page);
  // «На сегодня» больше нет: «Вспомните» в конце раздела — вопросы с вариантами, писать ничего не нужно
  await toc.getByRole('button', { name: /Спрос и предложение/ }).click();
  const recall = page.getByTestId('chapter').getByTestId('tb-recall').first();
  await recall.scrollIntoViewIfNeeded();
  await expect(recall.getByRole('textbox')).toHaveCount(0);
  const rightKeys = JSON.parse(await recall.getAttribute('data-answer'));
  const parts = recall.getByTestId('tb-recall-part');
  // ошибка: почему вариант неверен, разбор, «Ещё раз»
  await parts.nth(0).locator(`[data-key]:not([data-key="${rightKeys[0]}"])`).first().click();
  await expect(parts.nth(0).getByTestId('tb-recall-why')).toBeVisible();
  for (let i = 1; i < rightKeys.length; i += 1) await parts.nth(i).locator(`[data-key="${rightKeys[i]}"]`).click();
  await expect(recall.getByTestId('tb-recall-answer')).toBeVisible();
  await expect(recall.getByTestId('tb-recall-verdict')).toContainText('вернётся на повторение');
  await recall.getByTestId('tb-recall-again').click();
  await expect(recall.getByTestId('tb-recall-answer')).toHaveCount(0);
  // тут же верно — раздел засчитан, а вопрос остаётся в повторении: вернётся в свой день, чтобы закрепить
  for (let i = 0; i < rightKeys.length; i += 1) await parts.nth(i).locator(`[data-key="${rightKeys[i]}"]`).click();
  await expect(recall.getByTestId('tb-recall-verdict')).toContainText('Раздел пройден');
  await expect(recall.getByTestId('tb-recall-verdict')).toContainText('вернётся на повторение');
  // следующий раздел: всё верно с первого раза — раздел пройден
  const recall2 = page.getByTestId('chapter').getByTestId('tb-recall').nth(1);
  await recall2.scrollIntoViewIfNeeded();
  const rightKeys2 = JSON.parse(await recall2.getAttribute('data-answer'));
  for (let i = 0; i < rightKeys2.length; i += 1) await recall2.getByTestId('tb-recall-part').nth(i).locator(`[data-key="${rightKeys2[i]}"]`).click();
  await expect(recall2.getByTestId('tb-recall-verdict')).toContainText('Раздел пройден');
  await expectNoSidewaysScroll(page);
  await toToc(page);
  await expect(toc.locator('.tb-toc-row', { hasText: 'Спрос и предложение' }).locator('[data-testid=tb-ch-sections][data-done="2"][data-total="4"]')).toHaveCount(1);
  // ни «На сегодня», ни «Оглавления» на страницах: один «назад» вверху
  await expect(page.getByTestId('today-card')).toHaveCount(0);

  // IS-LM: переключатель «ЦБ держит ставку» на графике, ссылка в Лабораторию с настройками
  await toc.getByRole('button', { name: /Модель IS-LM/ }).click();
  const islm = page.locator('[data-chart="is-lm"]').first();
  await expect(islm.getByTestId('tb-readout')).toContainText('Выпуск Y: 1100');
  await islm.getByRole('slider', { name: 'Госрасходы G' }).fill('150');
  await expect(islm.getByTestId('tb-readout')).toContainText('Выпуск Y: 1200');
  await islm.getByRole('button', { name: 'ЦБ держит ставку' }).click();
  await expect(islm.getByTestId('tb-readout')).toContainText('Выпуск Y: 1300');
  // кейнсианский крест: те же 1100, госзакупки +50 — выпуск +200
  const cross = page.locator('[data-chart="cross"]');
  await expect(cross.getByTestId('tb-readout')).toContainText('Выпуск Y: 1100');
  await cross.getByRole('slider', { name: 'Госзакупки G' }).fill('150');
  await expect(cross.getByTestId('tb-readout')).toContainText('Выпуск Y: 1300');
  // схема «ставка → … → цены» переключается вверх и вниз
  const flow = page.getByTestId('tb-flow');
  await expect(flow.getByTestId('tb-flow-step')).toHaveCount(6);
  await expect(flow).toContainText('кредиты дорожают');
  await flow.getByRole('button', { name: 'Ставка ЦБ: вниз' }).click();
  await expect(flow).toContainText('кредиты дешевеют');
  // «Как это устроено в игре» — коротко, подробности по кнопке
  const game = page.getByTestId('tb-box-game');
  await expect(game.getByTestId('tb-more')).toHaveCount(0);
  await game.getByRole('button', { name: /Подробнее/ }).click();
  await expect(game.getByTestId('tb-more')).toContainText('расходы разово выше навсегда');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Лаборатория: госзакупки при неподвижной ставке' }).click();
  await expect(page.getByTestId('lab-charts')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ставка стоит' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'расходы разово выше навсегда' })).toHaveAttribute('aria-pressed', 'true');
  // назад — в ту же главу учебника, а не в меню
  await page.getByRole('button', { name: '← Назад в меню' }).click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'is-lm');

  // AD-AS: кривая AD из IS-LM, те же числа; шок издержек — стагфляция
  await toToc(page);
  await toc.getByRole('button', { name: /Совокупный спрос и совокупное предложение/ }).click();
  const adas = page.locator('[data-chart="ad-as"]').nth(1);
  await expect(adas.getByTestId('tb-readout')).toContainText('Выпуск Y: 1100');
  await adas.getByRole('slider', { name: 'Ожидаемые цены Pᵉ' }).fill('2.2');
  await expect(adas.getByTestId('tb-readout')).toContainText('Выпуск Y: 1081,2');
  await expect(adas.getByTestId('tb-readout')).toContainText('Уровень цен P: 2,16');
  await expectNoSidewaysScroll(page);

  // монополия: график с ползунком издержек и правило Лернера в числах
  await toToc(page);
  await toc.getByRole('button', { name: /Совершенная конкуренция и монополия/ }).click();
  const mono = page.locator('[data-chart="monopoly"]').first();
  await expect(mono.getByTestId('tb-readout')).toContainText('Цена: 60');
  await mono.getByRole('slider', { name: 'Предельные издержки MC' }).fill('30');
  await expect(mono.getByTestId('tb-readout')).toContainText('Цена: 65');
  await expect(page.getByRole('button', { name: 'Своё дело: правило Лернера' })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // издержки: огибающая LRAC и ссылка на производную в приложении «Математика для экономиста»
  await toToc(page);
  await toc.getByRole('button', { name: /Издержки и прибыль/ }).click();
  const lrac = page.locator('[data-chart="lrac"]');
  await expect(lrac.getByTestId('tb-readout')).toContainText('положительный эффект масштаба');
  await lrac.getByRole('slider').fill('60');
  await expect(lrac.getByTestId('tb-readout')).toContainText('минимально эффективный масштаб');
  // производная — во вставке «Вы знаете, что такое производная?»: «Нет, объясните» раскрывает объяснение со ссылкой
  const ask = page.getByTestId('chapter').locator('[data-testid=tb-ask][data-ask="derivative"]');
  await expect(ask.getByTestId('tb-ask-body')).toHaveCount(0);
  await ask.getByTestId('tb-ask-learn').click();
  await expect(ask.getByTestId('tb-ask-body')).toContainText('Сначала без формул');
  await ask.getByRole('button', { name: 'приложении «Математика для экономиста»' }).click();
  await expect(page.getByTestId('appendix')).toHaveAttribute('data-appendix', 'math');
  await expect(page.locator('#derivative')).toBeInViewport();
  await bookBack(page);
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'costs');

  // приложения: «игра ↔ учебник» с кнопками в Лабораторию, ограничения модели и словарь
  await toToc(page);
  await toc.getByRole('button', { name: /Игра ↔ учебник/ }).click();
  const cards = page.getByTestId('appendix-cards');
  await expect(cards.getByText('Закон Оукена', { exact: true })).toBeVisible();
  await expect(cards.getByRole('button', { name: 'Открыть в Лаборатории' })).toHaveCount(8);
  await expect(cards.getByRole('button', { name: 'Задача: Реальная ставка при инфляции 25%' })).toBeVisible();
  await page.getByRole('button', { name: /Чем модель не похожа на настоящую/ }).click();
  await expect(page.getByTestId('appendix-limits').getByText('Адаптивные ожидания', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Словарь/ }).click();
  await page.getByRole('textbox', { name: 'Поиск по словарю' }).fill('эластичн');
  await expect(page.getByTestId('appendix-glossary')).toContainText('Эластичность спроса по цене');

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('игра → учебник: «Подробнее в учебнике» открывает раздел и возвращает в ту же партию', async ({ page, isMobile }) => {
  test.skip(isMobile, 'рычаги на телефоне в отдельной вкладке — логика та же');
  // на Пути уже уровень «Средний» — компас ставки и IS-LM открыты с первого квартала
  await page.addInitScript(() => { try { localStorage.setItem('ems-learn-level', '2'); } catch { /* нет хранилища */ } });
  const { errors, external } = await openApp(page);
  await startSoloGame(page);
  // у ставки — ссылки на IS-LM и AD-AS
  await expect(page.getByTestId('book-link').filter({ hasText: 'IS-LM' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (!(await close.isVisible().catch(() => false))) await page.getByRole('button', { name: /Газета/ }).first().click();
  await close.click();
  await page.getByRole('button', { name: /Почему это произошло/ }).first().click();
  const why = page.locator('.ems-panel-raised', { hasText: 'Почему это произошло?' });
  await why.getByRole('button', { name: 'Инфляция', exact: true }).click();
  await why.getByTestId('book-link').click();
  // учебник поверх партии: нужный раздел на экране
  const ch = page.getByTestId('chapter');
  await expect(ch).toHaveAttribute('data-chapter', 'phillips');
  await expect(ch.locator('#expectations')).toBeInViewport();
  // в новой главе работает свой график: ожидания сдвигают кривую Филлипса
  const ph = page.locator('[data-chart="phillips"]').first();
  await ph.getByRole('slider', { name: /Ожидаемая инфляция/ }).fill('6');
  await expect(ph.getByTestId('tb-readout')).toContainText('Инфляция π, %: 6');
  await page.getByRole('button', { name: '← Назад в игру' }).click();
  // та же партия, то же окно «Почему это произошло?», квартал не сбросился
  await expect(why).toBeVisible();
  await expect(page.getByRole('button', { name: 'Завершить квартал и применить решения' })).toBeVisible();
  // «Компас ставки» ведёт к правилу Тейлора
  await why.getByRole('button').first().click();
  await expect(why).toBeHidden();
  const compass = page.getByTestId('rate-compass');
  await compass.getByTestId('book-link').click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'policy');
  await expect(page.locator('#taylor')).toBeInViewport();
  await page.getByRole('button', { name: '← Назад в игру' }).click();
  await expect(compass).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('учебник: кругооборот в «ВВП» и балансы банков по шагам в «Деньгах и банках»', async ({ page }) => {
  const { errors } = await openApp(page);
  await openBook(page);
  const toc = page.getByTestId('textbook');
  await toc.locator('.tb-toc-row', { hasText: 'ВВП и система национальных счетов' }).click();
  const circ = page.locator('[data-diagram="circular"]');
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('потратили');
  await circ.getByRole('button', { name: 'По добавленной стоимости' }).click();
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('300 + 400 + 300 = 1000');
  await circ.getByRole('button', { name: 'По доходам' }).click();
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('вместе 1000');
  await expectNoSidewaysScroll(page);
  await toToc(page);
  await toc.locator('.tb-toc-row', { hasText: 'Деньги и банки' }).click();
  const bal = page.locator('[data-diagram="balance"]');
  await expect(bal.getByTestId('tb-money')).toContainText('1000');
  await bal.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(bal.getByTestId('tb-money')).toContainText('1900');
  await expect(bal.getByTestId('tb-bank')).toContainText('Вклад Бориса');
  await bal.getByRole('button', { name: /Итог/ }).click();
  await expect(bal.getByTestId('tb-money')).toContainText('10000');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('нижняя панель: «Мир» без учебных карточек; «Задания»: повторение, итоговая проверка, вперемешку; «Мой прогресс» в учебнике', async ({ page }) => {
  const { errors, external } = await openApp(page);
  await expect(page.locator('.menu-section-label', { hasText: 'Модель в действии' })).toBeVisible();
  await expect(page.locator('.menu-section-label', { hasText: 'Играть' })).toBeVisible();
  await expect(page.locator('[data-mode="tutorial"]')).toContainText('Как играть');
  // учебник — своя вкладка внизу; «На сегодня» больше нет
  await expect(page.getByTestId('menu-study')).toHaveCount(0);
  await expect(page.locator('[data-mode="textbook"]')).toHaveCount(0);
  await expect(page.locator('[data-mode="lab"]')).toBeVisible();
  // Мир открыт — «⋯» подписана его именем
  await expect(page.getByTestId('bottom-nav').locator('[data-tab]')).toHaveText(['Путь', 'Учебник', 'Лиги', 'Лавка', 'Мир']);
  await openTasks(page);
  await expect(page.getByTestId('practice-today')).toHaveCount(0);
  // повторять пока нечего — кнопка выключена
  await expect(page.getByTestId('practice-review')).toBeDisabled();
  await expect(page.getByTestId('practice-review')).toContainText('Сегодня повторять нечего');
  // вперемешку: пока ни одна глава не начата — не из чего выбирать
  await page.getByTestId('practice-mixed').click();
  await expect(page.getByTestId('mixed')).toContainText('Пока не из чего выбирать');
  await expectNoSidewaysScroll(page);
  await bookBack(page);
  // итоговая проверка: без подсказок и решений до конца, в конце — счёт по темам
  await page.getByTestId('practice-exam').click();
  const exam = page.getByTestId('exam');
  await expect(exam.getByTestId('exam-problem')).toHaveCount(18);
  await expect(exam.getByRole('button', { name: /^Подсказка/ })).toHaveCount(0);
  await expect(exam.getByRole('button', { name: 'Решение' })).toHaveCount(0);
  await exam.getByRole('textbox', { name: 'Проверка, ответ к задаче 1' }).or(exam.getByRole('textbox', { name: 'Проверка, задача 1, шаг а)' })).first().fill('1');
  await exam.getByRole('button', { name: 'Завершить проверку' }).click();
  await expect(exam.getByTestId('exam-result')).toContainText('Верно 0 из 18');
  await expect(exam.getByTestId('exam-weak')).toContainText('Слабое место');
  await expect(exam.getByRole('button', { name: 'Решение' })).toHaveCount(18);
  await expectNoSidewaysScroll(page);
  // пересдача — те же темы, новые числа
  const before = await exam.getByTestId('exam-problem').allInnerTexts();
  await exam.getByRole('button', { name: 'Пересдать с новыми числами' }).click();
  await expect(exam.getByTestId('exam-result')).toHaveCount(0);
  await expect(exam.getByTestId('exam-problem')).toHaveCount(18);
  const after = await exam.getByTestId('exam-problem').allInnerTexts();
  expect(after.filter((t, i) => t === before[i]).length).toBeLessThan(3);
  await exam.getByRole('button', { name: 'Завершить проверку' }).click();
  await bookBack(page);
  // «Мой прогресс» — внизу оглавления учебника: слабые темы со ссылками и журнал
  await openBook(page);
  await page.getByTestId('tb-stats-link').click();
  const stats = page.getByTestId('stats');
  await expect(stats.getByTestId('stats-weak').getByRole('button')).toHaveCount(3);
  await expect(stats.getByTestId('tb-journal')).toContainText('За четыре недели');
  await stats.getByTestId('stats-weak').getByRole('button').first().click();
  await expect(page.getByTestId('chapter')).toBeVisible();
  await page.getByTestId('chapter').getByRole('button', { name: 'Отметить главу прочитанной' }).click();
  // вперемешку: теперь глава прочитана — сначала выбор модели, потом задача
  await openTasks(page);
  await page.getByTestId('practice-mixed').click();
  const item = page.getByTestId('mixed-item').first();
  await expect(item).toContainText('какая модель нужна');
  await item.getByRole('group').getByRole('button').first().click();
  await expect(item.getByTestId('mixed-model')).toBeVisible();
  await expect(item.getByTestId('tb-problem')).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('учебник: на телефоне ни одна блочная формула не шире 1,2 экрана', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'ширина формул важна на узком экране');
  // самый узкий распространённый телефон: колонка текста около 343 px
  await page.setViewportSize({ width: 375, height: 800 });
  await openApp(page);
  await openBook(page);
  await page.getByTestId('textbook').getByRole('button', { name: /Спрос и предложение/ }).click();
  const ch = page.getByTestId('chapter');
  await expect(ch.locator('.katex').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // все блочные формулы всех глав и приложений, включая разборы задач, — в той же колонке текста, с теми же шрифтами
  const files = ['src/textbook/chapters', 'src/textbook/appendices'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`));
  const formulas = files.flatMap((f) => collectBlocks(parseChapter(fs.readFileSync(f, 'utf8')), (b) => b.type === 'math').map((b) => ({ where: f.replace(/^.*\//, ''), tex: b.tex })));
  expect(formulas.length).toBeGreaterThan(50);
  const html = formulas.map((m, i) => `<div class="tb-math" data-i="${i}">${katex.renderToString(m.tex, { displayMode: true, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' })}</div>`).join('');
  const widths = await ch.locator('.tb-body').first().evaluate((body, h) => {
    const box = document.createElement('div');
    box.innerHTML = h;
    body.appendChild(box);
    const out = [...box.querySelectorAll('.tb-math')].map((el) => el.scrollWidth);
    box.remove();
    return { out, column: body.clientWidth };
  }, html);
  // «экран» — колонка текста, в которой формула прокручивается
  const limit = 1.2 * widths.column;
  const wide = formulas.map((m, i) => ({ ...m, w: widths.out[i] })).filter((m) => m.w > limit);
  expect(wide, `колонка ${widths.column} px, предел ${Math.round(limit)} px`).toEqual([]);
});

test('учебник → «Своё дело»: задание открывает нужную вкладку и висит плашкой', async ({ page }) => {
  const { errors } = await openApp(page);
  await openBook(page);
  await page.getByTestId('textbook').getByRole('button', { name: /Эластичность/ }).first().click();
  await page.getByRole('button', { name: 'Своё дело: измерить эластичность хлеба' }).click();
  // сохранённой компании нет — анкета с выбранной лавкой
  await page.getByRole('button', { name: /Начать|Открыть дело|Принять/ }).last().click();
  const lesson = page.getByTestId('tycoon-lesson');
  await expect(lesson).toContainText('Измерьте эластичность спроса на свой товар');
  // новая «Лавка» печёт хлеб — задание про хлеб с его эластичностью
  await expect(lesson).toContainText('«Хлеб»');
  await expect(lesson).toContainText('1,2');
  await expect(page.getByRole('tab', { name: /Склад и рынок/ })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('учебник: прогресс уходит в профиль и приходит с другого устройства', async ({ page }) => {
  const sent = [];
  const api = (req) => {
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* GET */ }
    if (body.action === 'progress') {
      sent.push(body.progress);
      // на другом устройстве уже прочитана глава про КПВ
      return JSON.stringify({ profile: { ...body.progress, textbook: { read: { scarcity: 1000 }, problems: {}, last: null, lastAt: 0 } } });
    }
    return '{}';
  };
  const { errors } = await openApp(page, '/', api);
  await openBook(page);
  const toc = page.getByTestId('textbook');
  await expect(toc.getByRole('button', { name: /Ограниченность и выбор/ }).locator('[aria-label="прочитана"]')).toHaveCount(1);
  await toc.getByRole('button', { name: /Спрос и предложение/ }).click();
  await page.getByTestId('chapter').getByRole('button', { name: 'Отметить главу прочитанной' }).click();
  // отметка уходит на сервер вместе с тем, что пришло с другого устройства
  await expect.poll(() => sent.some((p) => p.textbook && p.textbook.read['supply-demand'] && p.textbook.read.scarcity), { timeout: 8000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('урок, пройденный на другом устройстве, появляется сам — при возвращении на вкладку, без перезагрузки', async ({ page }) => {
  await page.clock.install();
  let other = false;
  const api = (req) => {
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* GET */ }
    if (body.action !== 'progress') return '{}';
    const tb = body.progress.textbook || {};
    // на телефоне тем временем пройден первый урок
    const learn = other ? { ...tb.learn, lessons: { ...tb.learn?.lessons, 'sc-i1': { at: Date.now() - 60000, runs: 1, best: 90 } } } : tb.learn;
    return JSON.stringify({ profile: { ...body.progress, textbook: { ...tb, learn } } });
  };
  const { errors } = await openApp(page, '/', api, { tab: 'path' });
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-state', 'open');
  other = true;
  await page.clock.fastForward(30000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-state', 'done');
  expect(errors).toEqual([]);
});

test('задача на 10 минут: цель на экране, прогноз записывается, в конце разбор', async ({ page, isMobile }) => {
  test.skip(isMobile, 'восемь кварталов подряд — достаточно одного экрана');
  test.setTimeout(120_000);
  const { errors } = await openApp(page);
  await page.getByText('Задачи на 10 минут', { exact: true }).first().click();
  await expect(page.getByTestId('drills').getByRole('button', { name: 'Начать' })).toHaveCount(10);
  await page.getByTestId('drills').getByRole('button', { name: 'Начать' }).first().click();
  await expect(page.getByTestId('drill-banner')).toContainText('Инфляция с 12% до 4%');
  await page.getByRole('textbox', { name: 'Прогноз инфляции через четыре квартала' }).fill('8');
  const finish = page.getByRole('button', { name: 'Завершить квартал и применить решения' });
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  for (let q = 1; q <= 8; q++) {
    await expect(finish).toBeEnabled({ timeout: 10_000 });
    await finish.click();
    if (await close.isVisible().catch(() => false)) await close.click();
    if (q === 1) await expect(page.getByTestId('forecast')).toContainText('Ждут проверки: 1');
  }
  const result = page.getByTestId('drill-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Инфляция с 12% до 4%');
  await expect(result).toContainText('Слепой прогноз');
  await result.getByRole('button', { name: 'Посмотреть графики' }).click();
  await expect(page.getByRole('button', { name: 'Разбор' })).toBeVisible();
  expect(errors).toEqual([]);
});

/* ------------------------------ ПУТЬ УРОКОВ ------------------------------
   Правильный ответ упражнения приложение отдаёт в data-answer только при флаге теста. */
async function answerExercise(page, { wrong = false, skipOpen = false } = {}) {
  const ex = page.getByTestId('ex');
  const kind = await ex.getAttribute('data-kind');
  const ans = JSON.parse(await ex.getAttribute('data-answer'));
  if (kind === 'choice' || kind === 'gap') {
    await ex.locator(wrong ? `[data-key]:not([data-key="${ans}"])` : `[data-key="${ans}"]`).first().click();
  } else if (kind === 'tf') await ex.locator(`[data-key="${wrong ? !ans : ans}"]`).click();
  else if (kind === 'shift') await ex.locator(wrong ? `[data-key]:not([data-key="${ans}"])` : `[data-key="${ans}"]`).first().click();
  else if (kind === 'calc') {
    // рядом с полем — единица измерения, а не имя главы латиницей
    const unitEl = ex.getByTestId('calc-unit');
    if (await unitEl.count()) expect(await unitEl.innerText()).not.toMatch(/^[a-z_-]+$/i);
    // цифры — с экранной клавиатуры, как на телефоне
    for (const ch of wrong ? '99999' : ans) {
      if (ch === '-') await ex.getByRole('button', { name: 'Минус' }).click();
      else await ex.getByRole('group', { name: 'Цифровая клавиатура' }).getByRole('button', { name: ch, exact: true }).click();
    }
  } else if (kind === 'match') {
    const keys = Object.keys(ans);
    for (const [i, l] of keys.entries()) {
      const r = wrong ? keys[(i + 1) % keys.length] : ans[l];
      await ex.locator(`[data-side=left][data-key="${l}"]`).click();
      await ex.locator(`[data-side=right][data-key="${r}"]`).click();
    }
  } else if (kind === 'sort') {
    const bins = await ex.locator('[data-bin]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.bin))]);
    for (const [it, b] of Object.entries(ans)) await ex.locator(`[data-item="${it}"][data-bin="${wrong ? bins.find((x) => x !== b) : b}"]`).click();
  } else if (kind === 'news') {
    for (const [v, d] of Object.entries(ans)) await ex.locator(`[data-var="${v}"][data-dir="${wrong ? (d === '+' ? '-' : '+') : d}"]`).click();
  } else if (kind === 'tiles') {
    for (const k of wrong ? [...ans].reverse() : ans) await ex.locator(`[data-tile="${k}"]`).click();
  } else if (kind === 'curve') {
    await ex.locator(`[data-curve="${ans[0]}"][data-dir="${wrong === (ans[1] === '+') ? '-' : '+'}"]`).click();
  } else if (kind === 'price') {
    await ex.getByRole('slider', { name: 'Цена' }).fill(String(wrong ? ans + 1 : ans));
  } else if (kind === 'point') {
    // точка по координатам графика: поле графика — в data-plot, в единицах viewBox
    const svg = ex.getByTestId('market-chart');
    const pl = JSON.parse(await svg.getAttribute('data-plot'));
    const box = await svg.boundingBox();
    const q = wrong ? pl.qMax * 0.1 : ans.q; const pr = wrong ? pl.pMax * 0.9 : ans.p;
    await svg.click({ position: { x: ((pl.x0 + (q / pl.qMax) * pl.w) / pl.vw) * box.width, y: ((pl.y0 + pl.h - (pr / pl.pMax) * pl.h) / pl.vh) * box.height } });
  } else if (kind === 'swipe' || kind === 'rush') {
    await playRound(page, () => wrong);
  } else if (kind === 'wallet') {
    await playWallet(page, { wrong });
  } else if (kind === 'open') {
    // открытый вопрос: неверного ответа нет — пишем свой и читаем разбор; или пропускаем — разбор откроется и так
    if (skipOpen) await page.getByTestId('open-skip').click();
    else await ex.getByTestId('open-answer').fill('Я бы не вводил потолок, а помог студентам адресно.');
  } else if (kind === 'domino') {
    // «Домино»: звенья по порядку; ошибка — ложная карточка роняет домино, дальше — с верного места
    const dom = ex.getByTestId('domino');
    await dom.locator(`[data-key="${ans[0]}"]`).click();
    if (wrong) { await dom.locator('[data-testid="domino-card"][data-key^="f"]').first().click(); await expect(dom.getByTestId('domino-why')).toBeVisible(); }
    for (const k of ans.slice(1)) await dom.locator(`[data-key="${k}"]`).click();
  }
  // мини-игра и «Домино» проверяются сами, когда доиграны
  if (!['swipe', 'rush', 'wallet', 'domino'].includes(kind) && !(kind === 'open' && skipOpen)) await page.getByRole('button', { name: kind === 'open' ? 'Ответить' : 'Проверить' }).click();
  const fb = page.getByTestId('ex-feedback');
  await expect(fb).toHaveAttribute('data-ok', String(!wrong || kind === 'open'));
  if (kind === 'open' && skipOpen) { await expect(page.getByTestId('lesson-foot')).toContainText('Вопрос пропущен'); await expect(page.getByTestId('open-review')).toBeVisible(); }
  return kind;
}
// пройти урок до экрана итогов; wrongAt — номера упражнений, где ошибиться нарочно
async function playLesson(page, { wrongAt = [], skipOpen = false } = {}) {
  const kinds = new Set();
  let retries = 0;
  let cards = 0;
  for (let i = 0; i < 70; i += 1) {
    if (await page.getByTestId('lesson-result').isVisible()) break;
    // карточки перед упражнением: шаг, слово (перевернуть), пункт итогов — прочитать и дальше
    cards += await passCards(page);
    if (await page.getByTestId('ex-retry').isVisible()) retries += 1;
    kinds.add(await answerExercise(page, { wrong: wrongAt.includes(i), skipOpen }));
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  return { kinds, retries, cards };
}
const withTestFlag = (page) => page.addInitScript(() => { window.__INFLATIA_TEST__ = true; });
// «Откройте сами»: четыре разные цены — четыре дня в «Зерне», точки на графике, линия, «Дальше»
async function playDiscover(page, prices = [12, 18, 26, 33]) {
  const d = page.getByTestId('discover');
  for (const p of prices) {
    await d.getByTestId('discover-price').fill(String(p));
    await expect(d.getByTestId('discover-open')).toBeEnabled({ timeout: 4000 });
    await d.getByTestId('discover-open').click();
  }
  await expect(d.getByTestId('discover-infla')).toBeVisible();
  await expect(page.getByTestId('discover-next')).toBeEnabled({ timeout: 4000 });
  await page.getByTestId('discover-next').click();
}
async function passCards(page) {
  let n = 0;
  const card = page.getByTestId('lesson-card');
  // подпись карточки: вид и номер слова в «Словах» — по ней видно, что нажатие сработало
  // читается одним вызовом в странице: карточка может смениться между шагами, и тогда
  // getAttribute по исчезнувшему элементу ждал бы бесконечно
  const sig = () => page.evaluate(() => {
    const c = document.querySelector('[data-testid="lesson-card"]');
    if (!c || !c.checkVisibility()) return 'gone';
    const kind = c.querySelector('.ln-kind'); const word = c.querySelector('[data-word]');
    return `${c.dataset.style}|${kind ? kind.innerText : ''}|${word ? word.dataset.word : ''}`;
  });
  while (await card.isVisible()) {
    n += 1;
    // «Откройте сами»: четыре дня с разными ценами — потом «Дальше»
    if (await card.getAttribute('data-style') === 'discover') { await playDiscover(page); continue; }
    const before = await sig();
    // в «Словах» в подвале две кнопки — «Назад» и «Дальше»: берём последнюю
    await page.getByTestId('lesson').locator('.ln-foot button').last().click();
    await expect.poll(sig).not.toBe(before);
  }
  return n;
}

const pathNode = (page, id) => page.getByTestId('path').getByTestId('path-lesson').and(page.locator(`[data-lesson="${id}"]`));
const UNIT_OF = { sc: 'scarcity', sd: 'supply-demand', el: 'elasticity', mf: 'market-failures', mb: 'money-banks', in: 'inflation', cs: 'consumer', ct: 'costs', cm: 'competition-monopoly', mc: 'monopolistic' };
const LEVEL_OF = { scarcity: 'start', 'supply-demand': 'basic', elasticity: 'basic', 'market-failures': 'basic', 'money-banks': 'basic', inflation: 'basic', consumer: 'middle', costs: 'middle', 'competition-monopoly': 'middle', monopolistic: 'middle' };
// на Пути юниты одного уровня: уровень нужного юнита — через плашку и список уровней, если юнита ещё нет на экране
async function showUnit(page, id) {
  const unit = page.getByTestId('path').locator(`[data-testid="path-unit"][data-unit="${id}"]`);
  // повторное касание вкладки «Путь» возвращает к текущему уровню — даём ему отработать
  await page.waitForTimeout(150);
  if (await unit.count()) return unit;
  await page.getByTestId('level-switch-open').click();
  await page.getByTestId('level-picker').locator(`[data-testid=level-pick][data-level="${LEVEL_OF[id]}"]`).click();
  await expect(unit).toBeVisible();
  return unit;
}
// карточка урока → «Начать» (или «Продолжить»)
async function startLesson(page, id, button = /Начать|Повторить/) {
  await showUnit(page, UNIT_OF[id.split('-')[0]]);
  await pathNode(page, id).click();
  const sheet = page.getByTestId('lesson-sheet');
  await expect(sheet).toHaveAttribute('data-lesson', id);
  await sheet.getByRole('button', { name: button }).click();
  await expect(page.getByTestId('lesson')).toBeVisible();
}

test('путь: карточка урока, «Знакомство» шагами, ошибка и её повтор, итоги, замок следующего урока', async ({ page }) => {
  await withTestFlag(page);
  const { errors, external } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  await expect(path).toBeVisible();
  await expect(page.getByTestId('bottom-nav').getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('bottom-nav').getByRole('button', { name: 'Теория' })).toHaveCount(0);
  await expect(page.getByTestId('streak')).toHaveText('0');
  await expect(page.getByTestId('streak-chip')).toHaveAttribute('data-today', 'false');
  // на Пути — юниты одного уровня: Начальный, в нём юнит 1 (14 уроков); плашка «Уровень 1 из 5»,
  // назад некуда, следующий уровень закрыт; будущих уровней на экране нет
  await expect(path.getByTestId('path-unit')).toHaveCount(1);
  await expect(path.getByTestId('path-unit')).toHaveAttribute('data-unit', 'scarcity');
  await expect(path.getByTestId('level-switch')).toContainText('Уровень 1 из 5');
  await expect(path.getByTestId('level-switch')).toContainText('Начальный');
  await expect(path.getByTestId('level-prev')).toBeDisabled();
  await expect(path.getByTestId('level-next')).toHaveAttribute('data-locked', 'true');
  await expect(path.getByTestId('path-lesson')).toHaveCount(14);
  await expect(path.getByTestId('path-level')).toContainText('основные термины');
  // строится — «Рынок труда»: он в Начальном уровне (по пять юнитов на уровень), пока в планах
  await expect(path.getByTestId('path-soon')).toHaveCount(1);
  // в списке уровней: Начальный открыт, Базовый — с тестом (по Начальному), Средний — после него,
  // Продвинутый и Профессиональный строятся
  await path.getByTestId('level-switch-open').click();
  const picker = page.getByTestId('level-picker');
  expect(await picker.getByTestId('level-pick').evaluateAll((els) => els.map((e) => `${e.dataset.level}:${e.dataset.state}`)))
    .toEqual(['start:open', 'basic:locked', 'middle:locked', 'advanced:soon', 'pro:soon']);
  await expect(picker.getByTestId('level-pick-test')).toHaveCount(1);
  await expect(picker.locator('[data-testid=level-pick][data-level="basic"]')).toContainText('тест по уровню «Начальный»');
  await expect(picker.locator('[data-testid=level-pick][data-level="basic"]')).toContainText('Рынок · Кофейня · Порт · Банк · Гастроном');
  await expect(picker.locator('[data-testid=level-pick][data-level="middle"]')).toContainText('сначала откройте уровень «Базовый»');
  await expect(picker.locator('[data-testid=level-pick][data-level="advanced"]')).toContainText('строится');
  await expectNoSidewaysScroll(page);
  await picker.locator('[data-nav="back"]').click();
  await expect(picker).toHaveCount(0);
  await expect(path.locator('[data-state="open"]')).toHaveCount(1);
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-state', 'open');
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-kind', 'intro');
  await expectNoSidewaysScroll(page);

  // нажатие на кружок — только карточка урока: название, вид, минуты и опыт
  await pathNode(page, 'sc-i1').click();
  const sheet = page.getByTestId('lesson-sheet');
  await expect(sheet).toContainText('Знакомство');
  await expect(sheet).toContainText(/≈\d+ мин/);
  await expect(sheet).toContainText(/до \d+ опыта/);
  await sheet.getByRole('button', { name: 'Закрыть' }).click();
  await expect(sheet).toHaveCount(0);
  // урок открывается и нажатием на название; до первого ответа выйти можно молча — ничего не засчитано
  await path.getByTestId('path-lesson-title').and(path.locator('[data-lesson="sc-i1"]')).click();
  await page.getByTestId('lesson-start').click();
  const card = page.getByTestId('lesson-card');
  await expect(card).toContainText('Ресурсов');
  await expect(card.locator('svg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await expect(page.getByText('Выйти из урока?')).toHaveCount(0);
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  await openTab(page, 'profile');
  await expect(page.getByTestId('prof-lessons')).toHaveText('0');
  await openTab(page, 'path');

  // «Знакомство»: шаг — вопрос — шаг — вопрос; первое упражнение неверно
  await startLesson(page, 'sc-i1');
  await page.getByRole('button', { name: 'Понятно' }).click();
  await answerExercise(page, { wrong: true });
  await expect(page.getByTestId('lesson-foot')).toContainText('Правильно:');
  await expect(page.getByTestId('lesson-foot')).toContainText('вернётся в конце урока');
  await expect(page.getByTestId('lesson-foot')).not.toHaveClass(/ds-flash/);
  await expectNoSidewaysScroll(page);
  // встряска после ошибки не даёт ползунка: у тела урока прокрутка только по вертикали и только по делу
  const body = page.getByTestId('lesson').locator('.ln-body').first();
  expect(await body.evaluate((el) => [getComputedStyle(el).overflowX, el.scrollWidth <= el.clientWidth])).toEqual(['hidden', true]);
  expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  const { retries, cards } = await playLesson(page);
  expect(retries, 'ошибка вернулась в конце урока').toBe(1);
  expect(cards, 'перед каждым вопросом — свой шаг').toBeGreaterThanOrEqual(4);
  const result = page.getByTestId('lesson-result');
  await expect(result).toContainText('Урок пройден');
  await expect(page.getByTestId('coins')).toHaveCount(1);
  await expect(result.getByTestId('result-xp').locator('[data-value]')).toHaveText(/^\+\d+$/);
  await expect(result.getByTestId('result-acc')).not.toContainText('100%');
  await expect(result).not.toContainText('Урок уже был пройден');
  // первый урок дня — серия на итогах: огонёк вспыхивает, счётчик дней перещёлкивается (без надписи)
  await expect(result.getByTestId('result-streak')).toHaveAttribute('data-days', '1');
  await expect(result.getByTestId('result-streak')).toHaveAttribute('aria-label', 'Серия: 1 день подряд');
  await expect(result).not.toContainText('Огонёк сохранён');
  await expect(result.getByTestId('mascot')).toHaveAttribute('data-mood', 'party');
  // на итогах выход один
  await expect(page.getByTestId('lesson').locator('[data-nav="back"]')).toHaveCount(1);
  await result.getByRole('button', { name: 'Дальше', exact: true }).click();

  // путь: урок пройден, у следующего открывается замок, серия и цель дня засчитаны
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-state', 'done');
  await expect(pathNode(page, 'sc-l1')).toHaveAttribute('data-state', 'open');
  await expect(pathNode(page, 'sc-l1').getByTestId('unlock-anim')).toHaveCount(1);
  await expect(pathNode(page, 'sc-l1').getByTestId('unlock-anim')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByTestId('streak-chip')).toHaveAttribute('data-today', 'true');
  // цель дня — минуты занятий (по умолчанию 10)
  await expect(page.getByTestId('goal')).toContainText(/\d+\/10\s*мин/);
  // ошибка ушла в практику (экран «Задания» с Пути), статистика — в «Профиль»
  await openTasks(page);
  await expect(page.getByTestId('practice-mistakes')).toBeEnabled();
  await openTab(page, 'profile');
  // «Мои четыре недели»: календарь и уроки; разбивки по типам упражнений нет
  await expect(page.getByTestId('prof-lessons')).toHaveText('1');
  await expect(page.getByTestId('prof-calendar').locator('.today')).toHaveCount(1);
  await expect(page.getByTestId('prof-types')).toHaveCount(0);
  // повтор пройденного урока — «Подробнее в учебнике» открывает главу, «назад» — снова итоги
  await openTab(page, 'path');
  await startLesson(page, 'sc-i1', 'Повторить');
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Урок уже был пройден');
  await page.getByTestId('result-theory').click();
  await expect(page.getByTestId('learn-book')).toBeVisible();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'scarcity');
  await bookBack(page);
  await expect(page.getByTestId('learn-book')).toHaveCount(0);
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(path).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('путь: выход после первого ответа — урок продолжается с того же места; брошенный за сутки — в статистике', async ({ page }) => {
  // урок «Практика» играется целиком дважды — дольше минуты под нагрузкой
  test.setTimeout(120_000);
  await withTestFlag(page);
  // уроки юнита 2 до второй «Практики» уже пройдены (прогресс кладётся один раз — перезагрузка его не стирает)
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const lessons = Object.fromEntries(['sd-i1', 'sd-l1', 'sd-w', 'sd-i2'].map((id) => [id, { at, runs: 1, best: 90 }]));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  await showUnit(page, 'supply-demand');
  await expect(pathNode(page, 'sd-l3')).toHaveAttribute('data-state', 'open');
  // открыть и сразу закрыть — не считается
  await startLesson(page, 'sd-l3');
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  // после первого ответа — вопрос с обещанием сохранить прогресс
  await startLesson(page, 'sd-l3');
  await answerExercise(page);
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  const ask = page.getByRole('dialog', { name: 'Выйти из урока?' });
  await expect(ask).toContainText('Прогресс урока сохранится');
  await ask.getByRole('button', { name: 'Продолжить урок' }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByTestId('ex')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await ask.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  await expect(path.locator('[data-unit="supply-demand"] .ln-pin')).toHaveText(/продолжить/i);
  // продолжить — с того же места: прогресс урока не с нуля
  await openTab(page, 'path');
  await startLesson(page, 'sd-l3', 'Продолжить');
  expect(Number(await page.getByTestId('lesson-progress').getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await page.getByRole('dialog', { name: 'Выйти из урока?' }).getByRole('button', { name: 'Выйти', exact: true }).click();
  // не продолжили за сутки — урок брошен: только теперь он в «не доведён до конца»
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('ems-learn-resume'));
    Object.values(m).forEach((r) => { r.at -= 25 * 3600 * 1000; });
    localStorage.setItem('ems-learn-resume', JSON.stringify(m));
  });
  await gotoApp(page, '/', 'profile');
  await expect(page.getByTestId('prof-calendar')).toBeVisible();

  // вторая «Практика» заново и целиком, с одной ошибкой; термины — с подсказкой
  await openTab(page, 'path');
  await startLesson(page, 'sd-l3', 'Начать');
  await expect(page.getByTestId('lesson-card')).toHaveCount(0);
  const term = page.getByTestId('ex').locator('.tb-term').first();
  if (await term.count()) {
    await term.click();
    // подсказка ничем не наказывается — и ни о каком штрафе не пишет
    await expect(page.getByTestId('term-sheet')).not.toContainText('опыта');
    await page.getByTestId('term-sheet').getByRole('button', { name: 'Понятно' }).click();
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
  }
  await playLesson(page, { wrongAt: [2] });
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  // практика: ошибка решается — и уходит из списка
  await openTasks(page);
  await page.getByTestId('practice-mistakes').click();
  await playLesson(page);
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('practice-mistakes')).toBeDisabled();

  // проверка юнита: сдана — все уроки открыты, но пройденными становятся только уроками
  await openTab(page, 'path');
  await (await showUnit(page, 'supply-demand')).getByTestId('unit-check').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'check');
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Проверка сдана');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(path.locator('[data-testid="path-unit"][data-unit="supply-demand"] [data-testid="path-lesson"][data-state="done"]')).toHaveCount(5);
  await expect(path.locator('[data-testid="path-unit"][data-unit="supply-demand"] [data-testid="path-lesson"][data-state="locked"]')).toHaveCount(0);
  // юнит не пройден — сундука нет, пока уроки не пройдены по-настоящему
  await expect(path.locator('[data-testid="path-unit"][data-unit="supply-demand"]').getByTestId('chest')).toHaveCount(0);
  // «уровня легенды» больше нет: пройденный урок берут на алмазном уровне — задачи и теория сложнее
  await expect(page.getByTestId('unit-legend')).toHaveCount(0);
  await pathNode(page, 'sd-i1').click();
  await expect(page.getByTestId('lesson-sheet').getByTestId('lesson-diamond-info')).toContainText('теория глубже');
  await expect(page.getByTestId('lesson-sheet').getByTestId('lesson-start')).toHaveText('Повторить без усложнения');
  // алмазный уровень — малиновый гранат из тёплой палитры, не холодный синий
  expect(await page.getByTestId('lesson-diamond').evaluate((el) => getComputedStyle(el).getPropertyValue('--u').trim().toLowerCase())).toBe('#b3123f');
  await page.getByTestId('lesson-diamond').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-diamond', 'true');
  // алмазные шаги — с формулами, плашкой «Запомнить» и строкой обозначений
  let legend = false; let remember = false;
  for (let i = 0; i < 40 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    if (await page.getByTestId('step-legend').isVisible()) legend = true;
    if (await page.getByTestId('step-remember').isVisible()) remember = true;
    if (await page.getByTestId('lesson-card').isVisible()) { await page.getByTestId('lesson').locator('.ln-foot button').click(); continue; }
    await answerExercise(page);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  expect(legend).toBe(true);
  expect(remember).toBe(true);
  await expect(page.getByTestId('result-diamond')).toContainText('Алмазный уровень взят');
  await expect(page.getByTestId('result-coins')).toContainText(/За урок\+(25|35)/);
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(pathNode(page, 'sd-i1')).toHaveAttribute('data-diamond', 'true');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

// алмазный урок на прошлом уровне: после итогов Путь остаётся на этом уровне, а не прыгает к текущему
test('путь: после алмазного урока на прошлом уровне Путь остаётся на нём', async ({ page }) => {
  test.setTimeout(120_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-w', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const sw = page.getByTestId('level-switch');
  await expect(sw).toContainText('Базовый');
  // повторное касание «Пути» до урока — оно не должно сбрасывать выбранный потом уровень
  await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click();
  await startLesson(page, 'sc-i1', /Алмазный/);
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-diamond', 'true');
  for (let i = 0; i < 40 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    if (await page.getByTestId('lesson-card').isVisible()) { await page.getByTestId('lesson').locator('.ln-foot button').last().click(); continue; }
    await answerExercise(page);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  await expect(sw).toContainText('Начальный');
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-diamond', 'true');
  // уход на другую вкладку и обратно — тоже на нём; повторное касание «Пути» — к текущему уровню
  await openTab(page, 'shop');
  await openTab(page, 'path');
  await expect(sw).toContainText('Начальный');
  await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click();
  await expect(sw).toContainText('Базовый');
  // серия верных ответов не обнуляется между уроками: следующий урок начинается с неё
  await startLesson(page, 'sc-l1');
  expect(Number(await page.getByTestId('lesson-streak').getAttribute('data-streak'))).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

// урок не теряется: закрыли или перезагрузили страницу — «Продолжить» с того же места. Серия — одна на день:
// начатый раньше урок не возвращает серию, сбитую ошибкой в другом (жалоба на абуз)
test('урок: после перезагрузки продолжается с того же места; начатый урок не воскрешает сбитую серию', async ({ page }) => {
  test.setTimeout(150_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(['sc-i1', 'sc-l1', 'sc-l2'].map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  // серия дня — в сохранённом состоянии ученика
  const rc = () => page.evaluate(() => {
    const d = new Date(); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ((JSON.parse(localStorage.getItem('ems-textbook-v1')).learn.daily || {})[day] || {}).rc || 0;
  });
  const flame = page.getByTestId('lesson-streak');
  const leaveLesson = async () => {
    await page.getByRole('button', { name: 'Выйти из урока' }).click();
    await page.getByRole('dialog', { name: 'Выйти из урока?' }).getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page.getByTestId('lesson')).toHaveCount(0);
  };
  // первый урок: три верных подряд — огонёк «3»
  await startLesson(page, 'sc-l1');
  for (let k = 0; k < 3; k += 1) { await passCards(page); await answerExercise(page); await page.getByRole('button', { name: 'Дальше', exact: true }).click(); }
  await passCards(page);
  await expect(flame).toHaveAttribute('data-streak', '3');
  expect(await rc()).toBe(3);
  const ex = page.getByTestId('ex');
  const here = [await ex.getAttribute('data-kind'), await ex.getAttribute('data-answer')];
  // браузер закрыли посреди урока — после перезагрузки урок ждёт с того же места, с той же серией
  await page.reload({ waitUntil: 'networkidle' });
  await startLesson(page, 'sc-l1', /Продолжить/);
  await passCards(page);
  expect([await ex.getAttribute('data-kind'), await ex.getAttribute('data-answer')]).toEqual(here);
  await expect(flame).toHaveAttribute('data-streak', '3');
  // ушли в другой урок и ошиблись — серия дня гаснет
  await leaveLesson();
  await startLesson(page, 'sc-l2');
  await passCards(page);
  await answerExercise(page, { wrong: true });
  expect(await rc()).toBe(0);
  await leaveLesson();
  // вернулись в первый урок — серия не воскресает из сохранённого урока
  await startLesson(page, 'sc-l1', /Продолжить/);
  await passCards(page);
  await expect(flame).toHaveCount(0);
  expect(await rc()).toBe(0);
  expect(errors).toEqual([]);
});

test('путь: юнит «Спрос и предложение» — каждый вид урока проходится на телефоне', async ({ page }) => {
  test.setTimeout(180_000);
  await withTestFlag(page);
  // юнит пройден — любой урок открыт для повтора
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'supply-demand');
  // у каждого вида — свой значок на Пути
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  const kinds = await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind));
  expect(kinds).toEqual(['intro', 'practice', 'words', 'intro', 'practice', 'story', 'listen', 'game', 'review', 'summary']);
  const icons = await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.querySelector('svg').getAttribute('class')));
  expect(new Set(icons).size, 'восемь видов — восемь разных значков').toBe(8);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };

  // «Слова»: знакомство, а не проверка — значение и пример сразу, «Дальше» / «Назад»; потом плитки и пары на время
  await startLesson(page, 'sd-w');
  await expect(page.getByTestId('lesson-card')).toHaveAttribute('data-style', 'flash');
  const word = page.getByTestId('flash-card');
  await expect(word).toContainText('Новое слово 1 из 8');
  await expect(word.getByTestId('word-def')).toContainText('сколько покупатели готовы купить');
  await expect(page.getByTestId('word-tip')).toBeVisible();
  await expect(page.getByTestId('word-prev')).toHaveCount(0);
  // карточку тянут мышью: едет за курсором и наклоняется, сверху «Дальше»; отпустили — следующее слово
  const wb = await word.boundingBox();
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
  await page.mouse.down();
  await page.mouse.move(wb.x + wb.width / 2 - 70, wb.y + wb.height / 2, { steps: 6 });
  await expect(word).not.toHaveAttribute('data-dx', '0');
  expect(await word.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  await expect(word.locator('.lp-swipe-tag.next')).toBeVisible();
  await page.mouse.move(wb.x + wb.width / 2 - 170, wb.y + wb.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(word).toContainText('Новое слово 2 из 8');
  await expect(page.getByTestId('word-dots').locator('i.know')).toHaveCount(2);
  // смахнуть вправо — тоже дальше: направление запоминать не нужно
  const wb2 = await word.boundingBox();
  await page.mouse.move(wb2.x + wb2.width / 2, wb2.y + wb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(wb2.x + wb2.width / 2 + 70, wb2.y + wb2.height / 2, { steps: 6 });
  await expect(word.locator('.lp-swipe-tag')).toHaveText('Дальше');
  await page.mouse.move(wb2.x + wb2.width / 2 + 170, wb2.y + wb2.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(word).toContainText('Новое слово 3 из 8');
  // назад — кнопкой, к прошлому слову
  await page.getByTestId('word-prev').click();
  await expect(word).toContainText('Новое слово 2 из 8');
  for (let i = 0; i < 6; i += 1) await page.getByTestId('word-next').click();
  await expect(word).toContainText('Новое слово 8 из 8');
  await expect(page.getByTestId('word-next')).toHaveText('К упражнениям');
  const { kinds: wk } = await playLesson(page, { wrongAt: [0] });
  expect([...wk]).toEqual(expect.arrayContaining(['tiles', 'match', 'choice']));
  await finish();

  // «История»: герои с портретами, цена ползунком, точка равновесия, кривая пальцем
  await startLesson(page, 'sd-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'masha');
  const { kinds: sk } = await playLesson(page);
  expect([...sk]).toEqual(expect.arrayContaining(['price', 'curve', 'point']));
  await finish();

  // «Слушай»: голоса в браузере теста нет — текст на экране с подсветкой
  await startLesson(page, 'sd-l-radio');
  await expect(page.getByTestId('listen-card')).toBeVisible();
  await expect(page.getByTestId('listen-text')).toContainText('морозы');
  await playLesson(page);
  await finish();

  // «Мини-игра»: одна игра на время с графиком рынка; проверка — сама по окончании; неудачная не возвращается
  await startLesson(page, 'sd-g');
  await expect(page.getByTestId('ex').getByTestId('market-chart')).toBeVisible();
  const { kinds: gk, retries } = await playLesson(page, { wrongAt: [0] });
  expect([...gk]).toEqual(['rush']);
  expect(retries).toBe(0);
  await expect(page.getByTestId('lesson-result')).toContainText('Урок пройден, игра — без зачёта: не хватило');
  await finish();

  // «Повторение» и «Итоги юнита»: пункты-карточки, потом тест юнита
  await startLesson(page, 'sd-rev');
  await playLesson(page);
  await finish();
  await startLesson(page, 'sd-sum');
  await expect(page.getByTestId('lesson-card').locator('.ln-kind')).toHaveText(/Итоги юнита/i);
  const { cards } = await playLesson(page);
  expect(cards).toBe(6);
  await expect(page.getByTestId('lesson-result')).toContainText('Тест юнита');
  await finish();

  // новые взаимодействия вне историй: точка равновесия и сдвиг кривой в «Практиках»
  await startLesson(page, 'sd-l3');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('путь: юнит «Порт» (провалы рынка) — каждый урок проходится, игра — рынок на графике', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum',
      'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum',
      'el-i1', 'el-l1', 'el-i2', 'el-l2', 'el-w', 'el-s1', 'el-radio', 'el-g', 'el-rev', 'el-sum',
      'mf-i1', 'mf-l1', 'mf-i2', 'mf-l2', 'mf-w', 'mf-s1', 'mf-radio', 'mf-g', 'mf-rev', 'mf-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'market-failures');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  for (const id of ['mf-i1', 'mf-l1', 'mf-i2', 'mf-l2']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // «Слова»: на карточке излишка потребителя — пример
  await startLesson(page, 'mf-w');
  await expect(page.getByTestId('word-def')).toContainText('Пример:');
  await playLesson(page);
  await finish();
  // «История»: открывает Вера Павловна (крючок в универмаг и открытый вопрос проверяет course.test.js)
  await startLesson(page, 'mf-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'vera');
  await playLesson(page);
  await finish();
  await startLesson(page, 'mf-radio');
  await expect(page.getByTestId('listen-text')).toContainText('газировк');
  await playLesson(page);
  await finish();
  await startLesson(page, 'mf-g');
  await expect(page.getByTestId('ex').getByTestId('market-chart')).toBeVisible();
  await playLesson(page);
  await finish();
  for (const id of ['mf-rev', 'mf-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  expect(errors).toEqual([]);
});

test('путь: юнит «Банк» (деньги и банки) — каждый урок проходится, игра — рынок кредитов на графике', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum',
      'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum',
      'el-i1', 'el-l1', 'el-i2', 'el-l2', 'el-w', 'el-s1', 'el-radio', 'el-g', 'el-rev', 'el-sum',
      'mf-i1', 'mf-l1', 'mf-i2', 'mf-l2', 'mf-w', 'mf-s1', 'mf-radio', 'mf-g', 'mf-rev', 'mf-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'money-banks');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  for (const id of ['mb-i1', 'mb-l1', 'mb-i2', 'mb-l2']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // «Слова»: на карточке бартера — пример
  await startLesson(page, 'mb-w');
  await expect(page.getByTestId('word-def')).toContainText('Пример:');
  await playLesson(page);
  await finish();
  // «История»: очередь у «Златобанка» глазами Тимура
  await startLesson(page, 'mb-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'timur');
  await playLesson(page);
  await finish();
  await startLesson(page, 'mb-radio');
  await expect(page.getByTestId('listen-text')).toContainText('денежная масса');
  await playLesson(page);
  await finish();
  await startLesson(page, 'mb-g');
  await expect(page.getByTestId('ex').getByTestId('market-chart')).toBeVisible();
  await playLesson(page);
  await finish();
  for (const id of ['mb-rev', 'mb-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  expect(errors).toEqual([]);
});

test('путь: юнит «Инфляция» — каждый урок проходится, игра «Сбереги кошелёк» засчитывается', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum',
      'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum',
      'el-i1', 'el-l1', 'el-i2', 'el-l2', 'el-w', 'el-s1', 'el-radio', 'el-g', 'el-rev', 'el-sum',
      'mf-i1', 'mf-l1', 'mf-i2', 'mf-l2', 'mf-w', 'mf-s1', 'mf-radio', 'mf-g', 'mf-rev', 'mf-sum',
      'mb-i1', 'mb-l1', 'mb-i2', 'mb-l2', 'mb-w', 'mb-s1', 'mb-radio', 'mb-g', 'mb-rev', 'mb-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'inflation');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  for (const id of ['in-i1', 'in-l1', 'in-i2', 'in-l2', 'in-w']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // «История»: копилка Тимура — ноутбук подорожал
  await startLesson(page, 'in-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'timur');
  await playLesson(page);
  await finish();
  await startLesson(page, 'in-radio');
  await expect(page.getByTestId('listen-text')).toContainText('корзина');
  await playLesson(page);
  await finish();
  // «Сбереги кошелёк»: кошелёк и чашки, газета с прогнозом, шкала «прогноз — ставка», три решения
  await startLesson(page, 'in-g');
  const ex = page.getByTestId('ex');
  await expect(ex.getByTestId('game')).toHaveAttribute('data-kind', 'wallet');
  await expect(ex.getByTestId('game-howto')).toBeVisible();
  await expect(ex.getByTestId('wallet-cups')).toHaveAttribute('data-cups', '100');
  await page.evaluate(() => { window.__INFLATIA_GAME_SPEED__ = 6; });
  await ex.getByTestId('game-start').click();
  await expect(ex.getByTestId('wallet-news')).not.toBeEmpty();
  await expect(ex.getByTestId('wallet-scale')).toBeVisible();
  await expect(ex.getByTestId('wallet-opt')).toHaveCount(3);
  // первый год — наличными: лучшим он не бывает, кошелёк тот же, чашек меньше; разбор — полосками
  await ex.locator('[data-testid=wallet-opt][data-opt="cash"]').click();
  await expect(ex.getByTestId('wallet-verdict')).toHaveAttribute('data-ok', 'false');
  await expect(ex.getByTestId('wallet-sum')).toHaveText('10\u00A0000');
  expect(Number(await ex.getByTestId('wallet-cups').getAttribute('data-cups'))).toBeLessThan(100);
  await expect(ex.getByTestId('wallet-bars')).toBeVisible();
  await ex.getByTestId('wallet-next').click();
  // дальше — лучший выбор: 4 из 5, зачёт
  for (let k = 2; k <= 5; k += 1) {
    const year = ex.getByTestId('wallet-year');
    await expect(year).toHaveAttribute('data-year', String(k));
    await ex.locator(`[data-testid=wallet-opt][data-opt="${await year.getAttribute('data-best')}"]`).click();
    await expect(ex.getByTestId('wallet-verdict')).toHaveAttribute('data-ok', 'true');
    await ex.getByTestId('wallet-next').click();
  }
  await expect(ex.getByTestId('wallet-path')).toBeVisible();
  await expect(ex.getByTestId('game-verdict')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'true');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await finish();
  for (const id of ['in-rev', 'in-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // учебник: глава «Инфляция» в Базовом уровне, график «Цены и вклад» и словарь
  await openTab(page, 'book');
  await page.getByTestId('textbook').getByRole('button', { name: /Инфляция/ }).first().click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'inflation');
  await expect(page.getByTestId('chapter')).toContainText('Базовый уровень');
  await expect(page.getByTestId('chapter')).toContainText('потребительскую корзину');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('путь: юнит «Пекарня» (издержки) — каждый урок проходится, игра — кривые издержек на графике', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const units = { sc: ['i1', 'l1', 'l2', 'i2', 'l3', 'l4', 'l5', 'l6', 'w', 's1', 'radio', 'g', 'rev', 'sum'], sd: ['i1', 'l1', 'w', 'i2', 'l3', 's1', 'l-radio', 'g', 'rev', 'sum'] };
    for (const u of ['el', 'mf', 'mb', 'in', 'cs']) units[u] = ['i1', 'l1', 'i2', 'l2', 'w', 's1', 'radio', 'g', 'rev', 'sum'];
    const ids = Object.entries(units).flatMap(([u, ls]) => ls.map((l) => `${u}-${l}`));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'costs');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  for (const id of ['ct-i1', 'ct-l1', 'ct-i2', 'ct-l2']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // «Слова»: на карточке постоянных издержек — пример
  await startLesson(page, 'ct-w');
  await expect(page.getByTestId('word-def')).toContainText('Пример:');
  await playLesson(page);
  await finish();
  // «История»: пекарня Гриши — мука дорожает
  await startLesson(page, 'ct-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'grisha');
  await playLesson(page);
  await finish();
  await startLesson(page, 'ct-radio');
  await expect(page.getByTestId('listen-text')).toContainText('мука');
  await playLesson(page);
  await finish();
  // игра: постоянные или переменные — кривые средних и предельных издержек на графике
  await startLesson(page, 'ct-g');
  await expect(page.getByTestId('ex').getByTestId('game-chart')).toHaveAttribute('data-chart', 'costs');
  await playLesson(page);
  await finish();
  for (const id of ['ct-rev', 'ct-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  expect(errors).toEqual([]);
});

test('путь: юнит «Биржа» (конкуренция и монополия) — каждый урок проходится, игра — спрос на товар фирмы и наценка', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const units = { sc: ['i1', 'l1', 'l2', 'i2', 'l3', 'l4', 'l5', 'l6', 'w', 's1', 'radio', 'g', 'rev', 'sum'], sd: ['i1', 'l1', 'w', 'i2', 'l3', 's1', 'l-radio', 'g', 'rev', 'sum'] };
    for (const u of ['el', 'mf', 'mb', 'in', 'cs', 'ct']) units[u] = ['i1', 'l1', 'i2', 'l2', 'w', 's1', 'radio', 'g', 'rev', 'sum'];
    const ids = Object.entries(units).flatMap(([u, ls]) => ls.map((l) => `${u}-${l}`));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'competition-monopoly');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  for (const id of ['cm-i1', 'cm-l1', 'cm-i2', 'cm-l2']) { await startLesson(page, id); await playLesson(page); await finish(); }
  await startLesson(page, 'cm-w');
  await expect(page.getByTestId('word-def')).toContainText('Пример:');
  await playLesson(page);
  await finish();
  // «История»: одна мельница на область — Гриша и монополия «Колоса»
  await startLesson(page, 'cm-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'grisha');
  await playLesson(page);
  await finish();
  await startLesson(page, 'cm-radio');
  await expect(page.getByTestId('listen-text')).toContainText('бирже');
  await playLesson(page);
  await finish();
  // игра: ценополучатель или власть над ценой — спрос на товар фирмы и наценка на графике
  await startLesson(page, 'cm-g');
  await expect(page.getByTestId('ex').getByTestId('game-chart')).toHaveAttribute('data-chart', 'power');
  await playLesson(page);
  await finish();
  for (const id of ['cm-rev', 'cm-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  expect(errors).toEqual([]);
});

test('путь: юнит «Ярмарка» (монополистическая конкуренция) — каждый урок проходится, игра — наценка ниже или выше', async ({ page }) => {
  test.setTimeout(300_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const units = { sc: ['i1', 'l1', 'l2', 'i2', 'l3', 'l4', 'l5', 'l6', 'w', 's1', 'radio', 'g', 'rev', 'sum'], sd: ['i1', 'l1', 'w', 'i2', 'l3', 's1', 'l-radio', 'g', 'rev', 'sum'] };
    for (const u of ['el', 'mf', 'mb', 'in', 'cs', 'ct', 'cm']) units[u] = ['i1', 'l1', 'i2', 'l2', 'w', 's1', 'radio', 'g', 'rev', 'sum'];
    const ids = Object.entries(units).flatMap(([u, ls]) => ls.map((l) => `${u}-${l}`));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'monopolistic');
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  expect(await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind)))
    .toEqual(['intro', 'practice', 'intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };
  // «Знакомство»: спрос на свою чашку и правило MR = MC — на графике кофейни
  await startLesson(page, 'mc-i1');
  await expect(page.getByTestId('lesson-card')).toContainText('монополистическая конкуренция');
  await playLesson(page);
  await finish();
  for (const id of ['mc-l1', 'mc-i2', 'mc-l2', 'mc-w']) { await startLesson(page, id); await playLesson(page); await finish(); }
  // «История»: соседки «Зерна» — Маша, Тимур, Гриша и Вера Павловна
  await startLesson(page, 'mc-s1');
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'masha');
  await playLesson(page);
  await finish();
  await startLesson(page, 'mc-radio');
  await expect(page.getByTestId('listen-text')).toContainText('ярмарке');
  await playLesson(page);
  await finish();
  // игра: каждое событие сдвигает наценку шагом — график «наценка»
  await startLesson(page, 'mc-g');
  await expect(page.getByTestId('ex').getByTestId('game-chart')).toHaveAttribute('data-chart', 'markup');
  await playLesson(page);
  await finish();
  for (const id of ['mc-rev', 'mc-sum']) { await startLesson(page, id); await playLesson(page); await finish(); }
  expect(errors).toEqual([]);
});

test('лавка → сад: урожай с редкостью — продать или оставить, семена садятся за монеты, растение растёт без приложения', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const now = Date.now(); const H = 3600000;
    // ромашка посажена три часа назад (растёт два) — созрела; тюльпан — пять часов из восьми
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: now - 86400000, runs: 1, best: 90 } }, coins: { '2026-01-01': 500 },
      garden: { [now - 3 * H]: 'chamomile@0', [now - 5 * H]: 'tulip@1' } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'shop' });
  const shop = page.getByTestId('shop');
  await expect(shop.getByTestId('garden-ripe')).toHaveText('1');
  await shop.getByTestId('shop-switch').locator('[data-view="garden"]').click();
  await expect(shop).toHaveAttribute('data-view', 'garden');
  const garden = page.getByTestId('garden');
  await expect(garden.locator('[data-testid=garden-plot][data-plant="chamomile"]')).toHaveAttribute('data-stage', 'bloom');
  await expect(garden.locator('[data-testid=garden-plot][data-plant="tulip"]')).toHaveAttribute('data-stage', 'bud');
  await expect(garden.locator('[data-testid=garden-plot][data-plant="tulip"] [data-testid=garden-left]')).toContainText('3 ч');
  // шансов редкости на экране нет — только редкости и во сколько раз дороже урожай
  await expect(garden.getByTestId('garden-odds').first()).not.toContainText('%');
  await expect(garden.getByTestId('garden-grades')).toContainText('небывалый ×6');
  // на пакетике видно, можно ли купить: «Посадить» — или что мешает, и кнопка выключена
  const seedStates = await garden.getByTestId('garden-seed').evaluateAll((els) => els.map((e) => { const b = e.querySelector('[data-testid=garden-plant]'); return [e.dataset.state, b.textContent, b.disabled]; }));
  seedStates.forEach(([st, text, off]) => {
    if (st === 'ok') expect([text, off]).toEqual(['Посадить', false]);
    else { expect(off).toBe(true); expect(text).toMatch(/^(Не хватает \d+|Грядки заняты)$/); }
  });
  // собрать — урожай с редкостью, грядка свободна, ромашка в гербарии
  await garden.getByTestId('garden-harvest').click();
  const result = garden.getByTestId('garden-result');
  // редкость выпадает от времени посадки: у легендарного и небывалого заголовок — сама редкость
  await expect(result).toContainText(/Новое растение в гербарии|(Легендарный|Небывалый) урожай!/i);
  await expect(result.locator('[data-grade]').first()).toBeVisible();
  await expect(garden.locator('[data-testid=herb-item][data-plant="chamomile"]')).toHaveAttribute('data-kept', '1');
  await expect(garden.locator('[data-testid=herb-item][data-plant="orchid"]')).toHaveAttribute('data-got', 'false');
  await expect(garden.getByTestId('garden-crop')).toHaveCount(1);
  // в урожае — за сколько куплены семена, цена на рынке и разница
  await expect(garden.getByTestId('garden-crop-price')).toContainText(/семена — \d+ · на рынке — \d+/);
  await expect(garden.getByTestId('garden-crop').getByTestId('garden-profit')).toBeVisible();
  await expect(shop.getByTestId('garden-ripe')).toHaveCount(0);
  // продать — монеты в кошелёк, в коллекции пусто, но ромашка уже выращена
  const coins0 = Number(await garden.getByTestId('garden-balance').innerText());
  await result.getByTestId('garden-result-sell').click();
  await expect(garden.getByTestId('garden-msg')).toContainText('Продано: Ромашка');
  expect(Number(await garden.getByTestId('garden-balance').innerText())).toBeGreaterThan(coins0);
  await expect(garden.getByTestId('garden-crop')).toHaveCount(0);
  await expect(garden.locator('[data-testid=herb-item][data-plant="chamomile"]')).toHaveAttribute('data-got', 'true');
  await expect(garden.locator('[data-testid=herb-item][data-plant="chamomile"]')).toHaveAttribute('data-kept', '0');
  // посадить подсолнух: монеты списаны по курсу, на грядке — семечко
  const before = Number(await garden.getByTestId('garden-balance').innerText());
  await garden.locator('[data-testid=garden-seed][data-plant="sunflower"] [data-testid=garden-plant]').click();
  await expect(garden.getByTestId('garden-msg')).toContainText('Посадили: Подсолнух');
  await expect(garden.locator('[data-testid=garden-plot][data-plant="sunflower"]')).toHaveAttribute('data-stage', 'seed');
  expect(Number(await garden.getByTestId('garden-balance').innerText())).toBeLessThan(before);
  await expect(garden.getByTestId('garden-free')).toHaveText('4');
  // долгим растениям нужен полив: на пакетике — «поливать раз в 12 ч», на грядке — запас воды
  await expect(garden.locator('[data-testid=garden-seed][data-plant="peony"] [data-testid=garden-seed-water]')).toContainText('поливать раз в 12 ч');
  await expect(garden.locator('[data-testid=garden-seed][data-plant="sunflower"] [data-testid=garden-seed-water]')).toHaveCount(0);
  await garden.locator('[data-testid=garden-seed][data-plant="peony"] [data-testid=garden-plant]').click();
  await expect(garden.locator('[data-testid=garden-plot][data-plant="peony"] [data-testid=garden-water]')).toContainText('12 ч');
  await expect(garden.locator('[data-testid=garden-plot][data-plant="peony"] [data-testid=garden-pour]')).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  // посадка сохранена в профиле: после перезагрузки подсолнух на месте
  await page.reload({ waitUntil: 'networkidle' });
  await openTab(page, 'shop');
  await page.getByTestId('shop-switch').locator('[data-view="garden"]').click();
  await expect(page.locator('[data-testid=garden-plot][data-plant="sunflower"]')).toBeVisible();
  expect(errors).toEqual([]);
});

// лиги по минутам: темп лиги нигде не называется минутами — только «чем выше лига, тем сильнее соперники»
test('лиги: на вкладке нет «остаться хватит около N минут», в правилах — без минут', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    // утренний экран серии уже видели сегодня
    localStorage.setItem('ems-learn-morning', '2026-11-04');
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: Date.now() - 86400000, runs: 1, best: 90 } }, xp: { '2026-11-02': 20, '2026-11-03': 20 }, done: { '2026-11-02': 1, '2026-11-03': 1 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'league' });
  await expect(page.getByTestId('league')).toBeVisible();
  await expect(page.getByTestId('league-pace')).toHaveCount(0);
  await expect(page.getByTestId('league')).not.toContainText('минут уроков в день');
  await page.getByTestId('league-rules-toggle').click();
  await expect(page.getByTestId('league-rules')).toContainText('Чем выше лига, тем сильнее соперники');
  await expect(page.getByTestId('league-rules')).not.toContainText('минут');
  expect(errors).toEqual([]);
});

test('лиги: отдельная вкладка — медаль, что нужно сейчас, все лиги, три зоны, награда — окном и один раз', async ({ page }) => {
  // среда: неделя лиги идёт (понедельник — суббота), в воскресенье — перерыв
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00'));
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const day = (k) => { const d = new Date(Date.now() + k * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    // восемь дней назад — много опыта (первое место прошлой недели), сегодня — немного
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: Date.now() - 86400000, runs: 1, best: 90 } }, xp: { [day(-8)]: 3000, [day(0)]: 40 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'league' });
  const lg = page.getByTestId('league');
  await expect(lg).toHaveAttribute('data-league', 'silver');
  await expect(lg).toHaveAttribute('data-rest', 'false');
  await expect(lg.getByTestId('league-title')).toHaveText('Серебряная лига');
  await expect(lg.getByTestId('league-status')).toContainText('40 опыта');
  await expect(lg.getByTestId('league-when')).toContainText('4 дня до итогов');
  await expect(lg.getByTestId('league-goal')).toHaveAttribute('data-kind', /stay|down|up/);
  await expect(lg.getByTestId('league-note')).toContainText('боты');
  // все семь лиг: Бронзовая пройдена, Серебряная — здесь, дальше — закрыты
  await expect(lg.getByTestId('league-tier')).toHaveCount(7);
  await expect(lg.locator('[data-testid=league-tier][data-tier="bronze"]')).toHaveAttribute('data-state', 'passed');
  await expect(lg.locator('[data-testid=league-tier][data-tier="silver"]')).toHaveAttribute('data-state', 'now');
  await expect(lg.locator('[data-testid=league-tier][data-tier="diamond"]')).toHaveAttribute('data-state', 'locked');
  // таблица — вся группа, в трёх зонах: повышение, «остаётесь», понижение
  await expect(lg.getByTestId('league-row')).toHaveCount(20);
  await expect(lg.getByTestId('league-zone')).toHaveCount(3);
  await expect(lg.locator('[data-testid=league-zone][data-zone="stay"]')).toContainText('Остаётесь в лиге');
  await expect(lg.locator('[data-testid=league-zone][data-zone="up"] [data-testid=league-row]')).toHaveCount(5);
  await expect(lg.locator('[data-testid=league-row][data-me="true"]')).toHaveCount(1);
  // полоски опыта: дорожка одной длины во всех строках, и больше опыта — длиннее полоска
  const bars = await lg.getByTestId('league-row').evaluateAll((rows) => rows.map((r) => {
    const track = r.querySelector('.lg-xpbar'); const fill = track.firstElementChild;
    return { xp: Number(r.querySelector('.lg-xp').firstChild.textContent), track: Math.round(track.getBoundingClientRect().width), fill: fill.getBoundingClientRect().width };
  }));
  expect(new Set(bars.map((b) => b.track)).size).toBe(1);
  bars.forEach((b, k) => { if (k > 0 && b.xp < bars[k - 1].xp) expect(b.fill).toBeLessThanOrEqual(bars[k - 1].fill + 0.5); });
  // награда за первое место в Бронзовой — 50 монет: окно вручения, один раз
  await expect(lg.getByTestId('league-reward')).toContainText('1-е место в Бронзовой лиге');
  await lg.getByTestId('league-claim').click();
  const sheet = page.getByTestId('league-reward-sheet');
  await expect(sheet.getByTestId('league-msg')).toContainText('+50 монет');
  await expect(sheet).toContainText('Повышение');
  await sheet.getByTestId('league-reward-ok').click();
  await expect(lg.getByTestId('league-reward')).toHaveCount(0);
  await expect(lg.getByTestId('league-last')).toContainText('повышение в Серебряную');
  await expectNoSidewaysScroll(page);
  await page.reload({ waitUntil: 'networkidle' });
  await openTab(page, 'league');
  await expect(page.getByTestId('league').getByTestId('league-reward')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('лиги: в воскресенье перерыв — итоги недели, опыт в лигу не идёт', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00'));
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    // вся неделя с понедельника — много опыта: первое место и повышение
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: Date.now() - 86400000, runs: 1, best: 90 } }, xp: { '2026-10-12': 3000 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'league' });
  const lg = page.getByTestId('league');
  await expect(lg).toHaveAttribute('data-rest', 'true');
  await expect(lg.getByTestId('league-when')).toContainText('Перерыв');
  await expect(lg.getByTestId('league-goal')).toContainText('повышение в Серебряную лигу');
  await expect(lg.getByTestId('league-reward')).toContainText('1-е место в Бронзовой лиге');
  expect(errors).toEqual([]);
});

// юнит «Спрос и предложение» пройден — любой его урок открыт для повтора
const unitDone = (page) => page.addInitScript(() => {
  if (localStorage.getItem('ems-textbook-v1')) return;
  const at = Date.now() - 86400000;
  const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum'];
  localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
});
/* Мини-игра на время: в тесте игра короче (window.__INFLATIA_GAME_SECONDS__), каждая карточка —
   один раз, пока не кончится колода или время; wrong(i) — ошибиться на i-й. max — сколько карточек
   ответить (дальше — ждать конца времени). Проверка — сама по окончании игры. */
async function playRound(page, wrong = () => false, { seconds = 6, max = Infinity } = {}) {
  const ex = page.getByTestId('ex');
  const kind = await ex.getAttribute('data-kind');
  await page.evaluate((sec) => { window.__INFLATIA_GAME_SECONDS__ = sec; }, seconds);
  await ex.getByTestId('game-start').click();
  const card = ex.getByTestId('game-card');
  for (let i = 0; i < max && await card.count(); i += 1) {
    const side = await card.getAttribute('data-answer', { timeout: 1000 }).catch(() => null);
    if (!side) break;
    const pick = wrong(i) ? (side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'up' ? 'down' : 'up') : side;
    await ex.locator(`button[data-side="${pick}"]`).click({ timeout: 1500 }).catch(() => {});
  }
  await expect(ex.getByTestId('game-final')).toBeVisible({ timeout: (seconds + 5) * 1000 });
  return kind;
}

/* «Сбереги кошелёк»: пять лет — в каждом выбрать, где держать деньги; лучший вариант игра отдаёт
   в data-best только при флаге теста. wrong — каждый год «наличными дома» (лучшим он не бывает). */
async function playWallet(page, { wrong = false, speed = 6 } = {}) {
  const ex = page.getByTestId('ex');
  await page.evaluate((sp) => { window.__INFLATIA_GAME_SPEED__ = sp; }, speed);
  await ex.getByTestId('game-start').click();
  for (let k = 1; k <= 5; k += 1) {
    const year = ex.getByTestId('wallet-year');
    await expect(year).toHaveAttribute('data-year', String(k));
    const best = await year.getAttribute('data-best');
    await ex.locator(`[data-testid=wallet-opt][data-opt="${wrong ? 'cash' : best}"]`).click();
    await expect(ex.getByTestId('wallet-verdict')).toHaveAttribute('data-ok', String(!wrong));
    await ex.getByTestId('wallet-next').click();
  }
  await expect(ex.getByTestId('game-final')).toBeVisible();
  return 'wallet';
}

test('юнит 1 «Ограниченность и выбор»: все виды уроков, калькулятор в расчёте, повтор после ошибки — другой задачей', async ({ page }) => {
  test.setTimeout(180_000);
  await withTestFlag(page);
  await unitDone(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'scarcity');
  const kinds = await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind));
  expect(new Set(kinds)).toEqual(new Set(['intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary']));
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); };

  // «История» Гриши: первый вопрос — расчёт; калькулятор считает и вставляет ответ
  await startLesson(page, 'sc-s1');
  await expect(page.getByTestId('story-feed')).toBeVisible();
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'grisha');
  await passCards(page);
  const ex = page.getByTestId('ex');
  await expect(ex).toHaveAttribute('data-kind', 'calc');
  await ex.getByTestId('calc-open').click();
  // условие и калькулятор целиком — на одном экране урока: от начала условия до «В ответ» не выше области урока
  expect(await ex.evaluate((el) => {
    // на ПК урок увеличен (zoom): высоту области меряем так же, как и прямоугольники, — на экране
    const body = el.closest('.ln-body'); const p = el.querySelector('.ln-prompt').getBoundingClientRect(); const u = el.querySelector('[data-testid=calc-use]').getBoundingClientRect();
    return u.bottom - p.top <= body.getBoundingClientRect().height;
  })).toBe(true);
  for (const k of ['1', '0', '0', '÷', '5', '0']) await ex.locator(`[data-calc="${k}"]`).click();
  await expect(ex.getByTestId('calc-value')).toHaveText('= 2');
  await ex.getByTestId('calc-use').click();
  await expect(ex.getByRole('textbox', { name: 'Ответ числом' })).toHaveValue('2');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'true');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await playLesson(page);
  await finish();

  // «Слова», «Слушай», «Мини-игра», «Повторение», «Итоги юнита»
  for (const id of ['sc-w', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum']) {
    await startLesson(page, id);
    await playLesson(page);
    await finish();
  }

  // ошибка в «Практике» возвращается в конце урока новыми числами или похожим вопросом
  await startLesson(page, 'sc-l1');
  let fresh = null;
  for (let i = 0; i < 30 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    if (await page.getByTestId('ex-retry').isVisible()) fresh = await page.getByTestId('ex-retry').getAttribute('data-fresh');
    await answerExercise(page, { wrong: i === 0 });
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  expect(fresh).toBeTruthy();
  expect(fresh).not.toBe('same');
  expect(errors).toEqual([]);
});

test('мини-игра: одна игра на минуту — очки с множителем серии, график двигается, итог и рекорд', async ({ page }) => {
  test.setTimeout(120_000);
  await withTestFlag(page);
  await unitDone(page);
  await page.clock.install();
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sd-g');
  const ex = page.getByTestId('ex');
  await expect(ex).toHaveAttribute('data-kind', 'rush');
  await expect(ex.getByTestId('game')).toHaveAttribute('data-phase', 'ready');
  await expect(ex.getByTestId('game')).toContainText('зачёт — когда верных на 8 больше, чем ошибок');
  // до таймера — «Как играть» и пробный заголовок без очков: ответ с объяснением
  await expect(ex.getByTestId('game-howto')).toContainText('Как играть');
  await expect(ex.getByTestId('game-start')).toHaveText(/Сразу к игре/);
  const trialSide = await ex.locator('.lp-trial-card').getAttribute('data-answer');
  await ex.locator(`[data-trial="${trialSide}"]`).click();
  await expect(ex.getByTestId('game-trial-result')).toHaveAttribute('data-ok', 'true');
  await expect(ex.getByTestId('game-start')).toHaveText(/Старт/);
  await ex.getByTestId('game-start').click();
  const card = ex.getByTestId('game-card');
  // четыре верных, ошибка, шесть верных: 10+10+10+20, серия сброшена, 10+10+10+20+20+20
  for (let i = 0; i < 11; i += 1) {
    const side = await card.getAttribute('data-answer');
    await ex.locator(`button[data-side="${i === 4 ? (side === 'up' ? 'down' : 'up') : side}"]`).click();
    if (i === 2) await expect(ex.getByTestId('game-combo')).toHaveText('×2');
    if (i === 4) await expect(ex.getByTestId('game-combo')).toHaveCount(0);
  }
  await expect(ex.getByTestId('game-score')).toHaveText('140');
  // до зачёта — на виду: 10 верных и 1 ошибка — чистых 9, зачёт есть
  await expect(ex.getByTestId('game-pass')).toHaveAttribute('data-left', '0');
  await expect(ex.getByTestId('game-pass')).toContainText('зачёт есть');
  // каждая карточка двигает кривую: подпись сдвига и история цены
  await expect(ex.getByTestId('game-effect')).toBeVisible();
  await expect(ex.getByTestId('price-ticker')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(ex.getByTestId('game-final')).toContainText('140');
  await expect(ex.getByTestId('game-final')).toContainText('верно 10 из 11');
  await expect(ex.getByTestId('game-verdict')).toHaveText('Игра засчитана: верных 10, ошибок 1');
  await expect(page.getByTestId('game-result')).toContainText('Верно 10 из 11 · 140 очков');
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'true');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('lesson-result')).toContainText('Игра засчитана: верных 10, ошибок 1.');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();

  // заново: рекорд на старте; три верных — меньше планки, игра не засчитана
  await startLesson(page, 'sd-g');
  await expect(ex.getByTestId('game-best')).toContainText('рекорд: 140');
  await ex.getByTestId('game-start').click();
  for (let i = 0; i < 3; i += 1) await ex.locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
  await expect(ex.getByTestId('game-pass')).toHaveText('до зачёта: 5');
  await page.clock.fastForward(61_000);
  await expect(ex.getByTestId('game-final')).toContainText('верно 3 из 3');
  await expect(ex.getByTestId('game-verdict')).toContainText('Зачёта нет, не хватило 5');
  await expect(page.getByTestId('game-result')).toContainText('верных минус ошибок — не меньше 8');
  // плашка не говорит «не засчитано»: урок с игрой будет пройден в любом случае
  await expect(page.getByTestId('game-lesson-note')).toContainText('Урок это не отменяет');
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'false');
  expect(errors).toEqual([]);
});

test('мини-игра: каждая новость — один раз; колода разобрана раньше времени — секунды в запасе идут в очки', async ({ page }) => {
  await withTestFlag(page);
  await unitDone(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sd-g');
  const ex = page.getByTestId('ex');
  await expect(ex.getByTestId('game-howto')).toContainText('каждая по одному разу, всего 16');
  await ex.getByTestId('game-start').click();
  const card = ex.getByTestId('game-card');
  const seen = [];
  for (let i = 0; i < 16; i += 1) {
    seen.push(await card.innerText());
    await ex.locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
  }
  expect(new Set(seen).size).toBe(16);
  await expect(ex.getByTestId('game-final')).toContainText('Все новости разобраны!');
  await expect(ex.getByTestId('game-final')).toContainText('верно 16 из 16');
  await expect(ex.getByTestId('game-time-bonus')).toContainText('в запасе');
  // 16 верных подряд — 460 очков, сверху — бонус за секунды
  expect(Number(await ex.locator('.lp-game-final .ds-num').innerText())).toBeGreaterThan(460);
  expect(errors).toEqual([]);
});

test('лента «История»: сообщения по одному, вопросы между ними, прошлое остаётся в ленте', async ({ page }) => {
  await withTestFlag(page);
  await unitDone(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sd-s1');
  const feed = page.getByTestId('story-feed');
  await expect(feed).toBeVisible();
  // первое сообщение — от героини, с портретом; «Дальше» открывает следующее, прошлые остаются
  await expect(page.getByTestId('lesson-card').getByTestId('portrait')).toHaveAttribute('data-who', 'masha');
  await expect(feed.getByTestId('feed-msg')).toHaveCount(0);
  let msgs = 0;
  while (await page.getByTestId('lesson-card').isVisible()) {
    await page.getByTestId('lesson').locator('.ln-foot button').click();
    msgs += 1;
    await expect(feed.getByTestId('feed-msg')).toHaveCount(msgs);
  }
  // вопрос — прямо в ленте, ответ и плашка — там же; после «Дальше» вопрос остаётся в ленте
  await expect(feed.getByTestId('ex')).toBeVisible();
  await answerExercise(page);
  // плашка ответа — в нижней панели урока, её видно без прокрутки
  await expect(page.getByTestId('lesson-foot').getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('lesson-foot').getByTestId('ex-feedback')).toBeInViewport();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(feed.getByTestId('feed-q')).toHaveCount(1);
  await expect(feed.getByTestId('feed-msg')).toHaveCount(msgs);
  // отвеченный вопрос — репликой: ответ ученика с галочкой, без печати и без невыбранных вариантов
  await expect(feed.getByTestId('feed-q').getByTestId('feed-answer')).toHaveAttribute('data-ok', 'true');
  await expect(feed.locator('.ds-answer-stamp')).toHaveCount(0);
  await expect(feed.getByTestId('feed-q').locator('.ds-opt')).toHaveCount(0);
  // дальше — новые сообщения после вопроса; лента сама доехала до низа — новое сообщение видно целиком
  await expect(page.getByTestId('lesson-card')).toBeVisible();
  await expect.poll(() => page.locator('.ln-body').evaluate((sc) => {
    const card = sc.querySelector('[data-testid="lesson-card"]').getBoundingClientRect(); const box = sc.getBoundingClientRect();
    return card.bottom <= box.bottom + 1 || card.top <= box.top + 14;
  })).toBe(true);
  // шапка «Вестника» — без значка, название по центру
  await expect(feed.locator('.fd-mast-name svg')).toHaveCount(0);
  const mast = await feed.locator('.fd-mast-name').evaluate((el) => { const p = el.parentElement.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(el); const t = r.getBoundingClientRect(); return [t.left - p.left, p.right - t.right]; });
  expect(Math.abs(mast[0] - mast[1])).toBeLessThan(6);
  // портрет — погрудный, в медальоне: тело обрезано кругом, а не прямой линией
  await expect(feed.getByTestId('portrait').first().locator('clipPath')).toHaveCount(1);
  await expectNoSidewaysScroll(page);
  // второй вопрос встаёт в ленту под новыми сообщениями, первый — выше
  await passCards(page);
  await answerExercise(page);
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(feed.getByTestId('feed-q')).toHaveCount(2);
  // письменный вопрос в конце истории можно пропустить
  const { kinds } = await playLesson(page, { skipOpen: true });
  expect(kinds.has('open')).toBe(true);
  expect(errors).toEqual([]);
});

test('лента «Слушай»: текст скрыт, «прослушать» читает сообщение с подсветкой, после вопроса текст открыт', async ({ page }) => {
  await withTestFlag(page);
  await unitDone(page);
  // русский голос браузера — подмена: запоминаем, что читали, и сразу «дочитываем»
  await page.addInitScript(() => {
    window.__spoken = []; window.__heard = [];
    // три русских голоса: у ведущей Лады — женский, со своим темпом и высотой
    const voices = [{ lang: 'ru-RU', name: 'Тест', default: true }, { lang: 'ru-RU', name: 'Milena' }, { lang: 'ru-RU', name: 'Yuri' }];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => voices, addEventListener() {}, removeEventListener() {}, cancel() {},
      speak(u) { window.__spoken.push(u.text); window.__heard.push({ name: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch }); setTimeout(() => { if (u.onboundary) u.onboundary({ charIndex: 0 }); }, 50); setTimeout(() => u.onend && u.onend(), 400); },
    } });
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sd-l-radio');
  const feed = page.getByTestId('listen-card');
  await expect(feed).toHaveAttribute('data-voice', 'on');
  const live = page.getByTestId('lesson-card');
  // новое сообщение эфира читается само; текст скрыт до «показать текст»
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__spoken[0])).toContain('морозы');
  // эфир ведёт Лада: её голос (женский), темп и высота; под эфиром — подпись про синтез
  expect(await page.evaluate(() => window.__heard[0])).toEqual({ name: 'Milena', rate: 1.04, pitch: 1.12 });
  await expect(feed.getByTestId('voice-caption')).toHaveText('голос синтезирован браузером');
  await expect(live.getByTestId('feed-hidden')).toBeVisible();
  await live.getByTestId('feed-toggle').click();
  await expect(live.getByTestId('listen-text')).toContainText('морозы');
  await live.getByTestId('feed-toggle').click();
  await expect(live.getByTestId('feed-hidden')).toBeVisible();
  // «прослушать» ещё раз — то же сообщение
  await live.getByTestId('feed-play').click();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(1);
  while (await live.isVisible()) await page.getByTestId('lesson').locator('.ln-foot button').click();
  // вопрос про то, что прозвучало; после ответа текст прошлых сообщений открыт сам
  await expect(feed.getByTestId('feed-msg').first().getByTestId('feed-hidden')).toBeVisible();
  await answerExercise(page);
  await expect(feed.getByTestId('feed-msg').first().getByTestId('listen-text')).toContainText('морозы');
  // прошлое сообщение можно переслушать
  const before = await page.evaluate(() => window.__spoken.length);
  await feed.getByTestId('feed-msg').first().getByTestId('feed-play').click();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(before + 1);
  // «Не могу слушать»: голос выключен на час — текст открыт, эфир сам не читается; «Включить звук» возвращает
  await feed.getByTestId('no-listen').click();
  await expect(feed).toHaveAttribute('data-voice', 'off');
  await expect(feed.getByTestId('no-listen-on')).toContainText('Звук выключен на час');
  const until = await page.evaluate(() => Number(localStorage.getItem('ems-no-listen-until')));
  expect(until - Date.now()).toBeGreaterThan(50 * 60 * 1000);
  const spoken = await page.evaluate(() => window.__spoken.length);
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('lesson-card').getByTestId('listen-text')).toBeVisible();
  await expect(page.getByTestId('lesson-card').getByTestId('feed-hidden')).toHaveCount(0);
  expect(await page.evaluate(() => window.__spoken.length)).toBe(spoken);
  await feed.getByTestId('no-listen-off').click();
  await expect(feed).toHaveAttribute('data-voice', 'on');
  expect(await page.evaluate(() => localStorage.getItem('ems-no-listen-until'))).toBe(null);
  expect(errors).toEqual([]);
});

test('сообщить об ошибке: флажок на упражнении, причина и контекст уходят на сервер, урок продолжается', async ({ page, context }) => {
  await withTestFlag(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const sent = [];
  const reports = [
    { id: 'r1', at: Date.now() - 60000, login: 'kate', name: 'Катя', status: 'new', reason: 'answer', comment: 'должно быть 20', context: { exercise: 'sd-l1:x', answer: '25', correct: '20', build: 'abc' } },
    { id: 'r2', at: Date.now() - 120000, login: 'ivan', name: 'Иван', status: 'new', reason: 'typo', comment: '', context: { screen: 'step', lesson: 'sd-i1' } },
  ];
  const api = (req) => {
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    if (req.url().includes('/api/reports') && body) {
      if (body.action === 'send') { sent.push(body); return JSON.stringify({ ok: true, id: 'x' }); }
      if (body.action === 'me') return JSON.stringify({ owner: true });
      if (body.action === 'list') return JSON.stringify({ reports: body.status === 'done' ? [] : reports, counts: { new: 2, done: 0 } });
    }
    // аналитика: события уходят без логина и сессии; отчёт — владельцу
    if (req.url().includes('/api/events') && body) {
      if (body.action === 'report') {
        const day = (k) => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10);
        const daily = Array.from({ length: 30 }, (_, i) => ({ day: day(29 - i), welcome_start: i % 3, goal_done: 0, lesson_start: 4 + (i % 5), lesson_done: 2 + (i % 4), register_done: i % 7 === 0 ? 1 : 0, return_d1: 0, return_d7: 0, ex_first_try_ok: 10 + i, ex_first_try_fail: 5 }));
        return JSON.stringify({ funnel: [{ event: 'welcome_start', label: 'Нажали «Начать»', count: 40 }, { event: 'lesson_done', label: 'Прошли урок', count: 25 }],
          hardest: [{ id: 'sd-q2', total: 12, correct: 3, share: 0.25 }], daily,
          totals: { lessons: { now: 30, prev: 20, today: 4 }, starts: { now: 45, prev: 40, today: 6 }, accounts: { now: 3, prev: 4, today: 0 }, newcomers: { now: 9, prev: 7, today: 1 }, accuracy: { now: 0.7, prev: 0.65 } },
          lessons: [{ id: 'sd-i1', start: 20, done: 15, finish: 0.75, minutes: 4.2 }, { id: 'sd-l1', start: 8, done: 2, finish: 0.25, minutes: 6 }],
          reports: { fresh: 2, byReason: { answer: 1, typo: 1 } } });
      }
      events.push(body);
    }
    return '{}';
  };
  const events = [];
  const { errors } = await openApp(page, '/', api, { tab: 'path' });
  await startLesson(page, 'sc-i1');
  await page.getByRole('button', { name: 'Понятно' }).click();
  const ex = page.getByTestId('ex');
  const exId = await ex.getAttribute('data-kind');
  await answerExercise(page, { wrong: true });
  // флажок есть и после ответа
  await ex.getByTestId('report-flag').click();
  const sheet = page.getByTestId('report-sheet');
  await expect(sheet.getByTestId('report-send')).toBeDisabled();
  await sheet.locator('[data-reason="accept"]').click();
  // выбранная причина видна: подсвечена и с галочкой, остальные — нет
  const bg = (r) => sheet.locator(`[data-reason="${r}"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(sheet.locator('[data-reason="accept"]')).toHaveAttribute('aria-checked', 'true');
  expect(await bg('accept')).not.toBe(await bg('typo'));
  // у каждой причины круглый переключатель; выбранная — с точкой внутри
  await expect(sheet.locator('[data-reason] .rp-radio')).toHaveCount(await sheet.locator('[data-reason]').count());
  expect(await sheet.locator('[data-reason="accept"] .rp-radio').evaluate((el) => getComputedStyle(el, '::after').content)).not.toBe('none');
  expect(await sheet.locator('[data-reason="typo"] .rp-radio').evaluate((el) => getComputedStyle(el, '::after').content)).toBe('none');
  // нажатие на нижнюю причину не сдвигает верхние: шторка прижата к низу, а размеры кнопки при нажатии не меняются
  const reasons = sheet.locator('[data-reason]');
  const firstTop = async () => (await reasons.first().boundingBox()).y;
  const before = await firstTop();
  const last = await reasons.last().boundingBox();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  expect(Math.abs((await firstTop()) - before)).toBeLessThan(0.5);
  await page.mouse.up();
  await sheet.locator('[data-reason="accept"]').click();
  await sheet.getByLabel(/Комментарий/).fill('мне кажется, мой ответ верный');
  await sheet.getByTestId('report-send').click();
  await expect(page.getByTestId('report-thanks')).toContainText('Спасибо! Посмотрим');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ reason: 'accept', comment: 'мне кажется, мой ответ верный', session: 't' });
  expect(sent[0].context).toMatchObject({ screen: 'exercise', kind: exId, lesson: 'sc-i1', unit: 'scarcity' });
  expect(sent[0].context.exercise).toBeTruthy();
  expect(sent[0].context.answer).toBeTruthy();
  expect(sent[0].context.correct).toBeTruthy();
  expect(sent[0].context.build).toBeTruthy();
  expect(sent[0].context.device).toBeTruthy();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  // урок — с того же места: плашка ответа на месте
  await expect(page.getByTestId('report-sheet')).toHaveCount(0);
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'false');
  // флажок — и на шаге «Знакомства», и в учебнике, и на итогах
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('lesson-card').getByTestId('report-flag')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await page.getByRole('dialog', { name: 'Выйти из урока?' }).getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByTestId('unit-guide').first().click();
  await expect(page.getByTestId('learn-book').getByTestId('report-flag').first()).toBeVisible();
  // у каждой задачи учебника — своя кнопка «Сообщить об ошибке»
  expect(await page.getByTestId('learn-book').getByTestId('tb-report').count()).toBeGreaterThanOrEqual(3);
  // флажок страницы учебника — про теорию, а не про ответ
  await page.getByTestId('learn-book').getByTestId('report-flag').first().click();
  await expect(page.getByTestId('report-sheet').locator('[data-reason="theory"]')).toBeVisible();
  await expect(page.getByTestId('report-sheet').locator('[data-reason="accept"]')).toHaveCount(0);
  await page.getByTestId('report-sheet').getByRole('button', { name: 'Закрыть' }).click();
  // выделили фразу в тексте — внизу кнопка «Сообщить об ошибке в выделенном», цитата уходит с сообщением
  const quote = await page.getByTestId('learn-book').evaluate((root) => {
    const p = [...root.querySelectorAll('.ln-textbook p')].find((x) => x.textContent.trim().length > 40);
    const node = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim().length > 12);
    const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, 12);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    return sel.toString().replace(/\s+/g, ' ').trim();
  });
  await page.getByTestId('report-quote-btn').click();
  await expect(page.getByTestId('report-quote')).toContainText(quote);
  await page.getByTestId('report-sheet').locator('[data-reason="unclear"]').click();
  await page.getByTestId('report-send').click();
  await expect(page.getByTestId('report-thanks')).toBeVisible();
  expect(sent[1]).toMatchObject({ reason: 'unclear', context: { screen: 'textbook', quote } });
  await page.getByRole('button', { name: 'Продолжить' }).click();

  // владелец: список сообщений, фильтр и «скопировать всё» — в настройках профиля
  await openTab(page, 'profile');
  await page.getByTestId('prof-settings-open').click();
  await page.getByTestId('prof-reports').click();
  const view = page.getByTestId('reports');
  await expect(view.getByTestId('report-item')).toHaveCount(2);
  await view.getByTestId('reports-copy').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('Ошибка в ответе');
  expect(text).toContain('ответ ученика: 25');
  expect(text).toContain('правильный ответ: 20');
  expect(text).toContain('Опечатка');
  await view.locator('[data-filter="done"]').click();
  await expect(view.getByTestId('reports-empty')).toBeVisible();
  await view.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByTestId('settings')).toBeVisible();
  // аналитика без персональных данных: в событиях нет ни логина, ни сессии
  expect(events.some((e) => e.event === 'lesson_start' && e.lesson === 'sc-i1')).toBe(true);
  expect(events.some((e) => e.event === 'ex_first_try_fail' && e.exercise)).toBe(true);
  events.forEach((e) => { expect(e.session).toBeUndefined(); expect(e.login).toBeUndefined(); expect(e.playerId).toBeUndefined(); });
  await page.getByTestId('prof-analytics').click();
  const an = page.getByTestId('analytics');
  await expect(an.getByTestId('analytics-funnel').locator('[data-event]')).toHaveCount(2);
  // воронка с конверсией шага: 25 из 40 — 63%
  await expect(an.getByTestId('analytics-funnel').locator('[data-event="lesson_done"]')).toContainText('63%');
  await expect(an.getByTestId('analytics-hardest').locator('[data-exercise="sd-q2"]')).toContainText('25%');
  await expect(an.getByTestId('analytics-hardest').locator('[data-exercise="sd-q2"]')).toContainText('3 из 12');
  // сводка недели против прошлой: +50% уроков
  await expect(an.getByTestId('analytics-tile-lessons')).toContainText('+50%');
  await expect(an.getByTestId('analytics-tile-reports')).toContainText('2');
  // активность по дням: подсказка по наведению; уроки — популярные и «чаще бросают»
  await an.getByTestId('analytics-activity').locator('svg').hover({ position: { x: 200, y: 80 } });
  await expect(an.getByTestId('analytics-activity').locator('.an-tip')).toContainText('прошли');
  await expect(an.getByTestId('analytics-lessons').locator('tr[data-lesson]').first()).toHaveAttribute('data-lesson', 'sd-i1');
  await an.locator('[data-sort="drop"]').click();
  await expect(an.getByTestId('analytics-lessons').locator('tr[data-lesson]').first()).toHaveAttribute('data-lesson', 'sd-l1');
  await an.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByTestId('settings')).toBeVisible();
  expect(errors).toEqual([]);
});

/* Персональная программа и награды: регистрация с «Кое-что знаю» → вступительный тест
   открывает известный юнит → сундук, задания дня, монеты и лавка с курсом; назавтра —
   утренний экран серии. */
test('вход: программа — вступительный тест, сундук, задания дня, монеты, лавка, утренний экран серии', async ({ page }) => {
  test.setTimeout(150_000);
  await withTestFlag(page);
  const { errors, external } = await openApp(page, '/', accountApi, { tab: null });
  await page.getByRole('button', { name: 'Начать' }).click();
  const goal = page.getByTestId('welcome-goal');
  await goal.getByRole('group', { name: 'Цель' }).getByRole('button', { name: 'Олимпиада' }).click();
  await goal.getByRole('group', { name: 'Минут в день' }).getByRole('button', { name: '15 минут' }).click();
  await goal.getByRole('group', { name: 'Знания' }).getByRole('button', { name: 'Кое-что знаю' }).click();
  await goal.getByRole('button', { name: 'Продолжить' }).click();
  const reg = await guestToRegister(page);
  await reg.getByLabel('Логин').fill('anna');
  await reg.getByLabel('Пароль').fill('secret1');
  await reg.getByTestId('birth-year').fill('2000');
  await reg.getByTestId('consent-page').check();
  await reg.getByTestId('consent-pd').check();
  await reg.getByRole('button', { name: 'Создать аккаунт' }).click();
  await page.getByRole('button', { name: 'Я сохранил код' }).click();
  await expect(page.getByTestId('path')).toBeVisible();
  // ответы при регистрации — в программе ученика: цель дня — 15 минут занятий
  await expect(page.getByTestId('goal')).toContainText('0/15');
  // наверху Пути — уровень в курсе вместо опыта и монет: до первого урока — 0 ед. из 1000, без ступеней
  await expect(page.getByTestId('wallet-balance')).toHaveCount(0);
  await expect(page.getByTestId('course-level')).toHaveAttribute('data-done', '0');
  await expect(page.getByTestId('course-points')).toHaveText('0');
  await expect(page.getByTestId('course-level')).toContainText('из 1000 за весь курс');
  await expect(page.getByTestId('course-level')).not.toContainText('A1');
  await expect(page.getByTestId('chest')).toHaveCount(0);
  // задания дня и испытание месяца — экран «Задания» с карточки наверху Пути; испытание считается от цели в минутах
  await expect(page.getByTestId('quests')).toHaveCount(0);
  await openTasks(page);
  await expect(page.getByTestId('quests').getByTestId('quest')).toHaveCount(3);
  await expect(page.getByTestId('goal-row')).toContainText('Цель дня: 15 минут занятий');
  await expect(page.getByTestId('month')).toBeVisible();
  await expect(page.getByTestId('month-why')).toContainText('15 минут в день');
  await openTab(page, 'path');

  // вступительный тест: юнит 1 — без ошибок, юнит 2 — две ошибки подряд: тест заканчивается
  await expect(page.getByTestId('placement-card')).toBeVisible();
  await page.getByTestId('placement-start').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'placement');
  for (let i = 0; i < 5; i += 1) { await answerExercise(page); await page.getByRole('button', { name: 'Дальше', exact: true }).click(); }
  for (let i = 0; i < 2; i += 1) { await answerExercise(page, { wrong: true }); await page.getByRole('button', { name: 'Дальше', exact: true }).click(); }
  const result = page.getByTestId('lesson-result');
  await expect(result).toContainText('Тест пройден');
  await expect(result.getByTestId('result-text')).toContainText('«Мастерская»');
  await expect(result.getByTestId('result-text')).not.toContainText('«Рынок»');
  // тест ничего не раздаёт: ни монет, ни печатей
  await expect(result.getByTestId('result-coins')).toHaveCount(0);
  await result.getByRole('button', { name: 'Дальше', exact: true }).click();
  // уроки юнита 1 открыты, но не пройдены; юнит 2 открыт с начала; приглашения на тест больше нет
  await expect(page.getByTestId('placement-card')).toHaveCount(0);
  await expect(page.locator('[data-testid="path-unit"][data-unit="scarcity"] [data-testid="path-lesson"][data-state="open"]')).toHaveCount(14);
  await expect(page.locator('[data-testid="path-unit"][data-unit="scarcity"] [data-testid="path-lesson"][data-state="done"]')).toHaveCount(0);
  await expect(page.getByTestId('path-rec')).toHaveText(/рекомендуем/i);
  await showUnit(page, 'supply-demand');
  await expect(pathNode(page, 'sd-i1')).toHaveAttribute('data-state', 'open');
  // сундук — только за по-настоящему пройденный юнит
  await expect(page.getByTestId('chest')).toHaveCount(0);

  // первый урок юнита 2: монеты за урок и выполненные задания
  await startLesson(page, 'sd-i1');
  await playLesson(page);
  await expect(page.getByTestId('result-coins')).toContainText('За урок');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();

  // лавка — отдельная вкладка: курс дня и график, страховка серии по курсу, наряд Инфли (монеты — как будто накоплены)
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    p.learn.coins = { ...p.learn.coins, '2026-01-01': 500 };
    localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await openTab(page, 'shop');
  const shop = page.getByTestId('shop');
  await expect(shop.getByTestId('rate-value')).toContainText(/1 крона = \d,\d\d монеты/);
  // лавка короткая: график курса и «что такое кроны» — по касанию курса
  await expect(shop.getByTestId('rate-chart')).toHaveCount(0);
  await shop.getByTestId('rate-toggle').click();
  await expect(shop.getByTestId('coins-crowns')).toBeVisible();
  await expect(shop.getByTestId('rate-chart')).toBeVisible();
  // палец ведёт по графику — текст вокруг не выделяется
  expect(await shop.locator('.rw-rate-box').evaluate((el) => getComputedStyle(el).userSelect || getComputedStyle(el).webkitUserSelect)).toBe('none');
  // подсказка графика курса у правого края не расширяет страницу (иначе телефон перемасштабирует её и панель внизу «уезжает»)
  const chartBox = await shop.getByTestId('rate-chart').boundingBox();
  for (const fx of [0.02, 0.5, 0.9, 0.99]) {
    await shop.getByTestId('rate-chart').hover({ position: { x: Math.round(chartBox.width * fx), y: 30 } });
    await expect(shop.getByTestId('rate-tip')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `подсказка на ${fx}`).toBe(true);
  }
  // страховка серии — полис: первый взнос сразу, дальше по неделям; расторгнуть можно в любой момент
  await shopTab(page, 'useful');
  const coins = Number(await shop.getByTestId('shop-balance').innerText().then((t) => t.replace(/\D/g, '')));
  await shop.getByTestId('policy-take').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('Полис оформлен');
  await expect(shop.getByTestId('policy-on')).toBeVisible();
  await expect(shop.getByTestId('policy-stats')).toContainText('Всего взносов: 8');
  const premiums = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ems-textbook-v1')).learn.premiums || {}));
  expect(premiums).toEqual([8]);
  expect(coins).toBeGreaterThan(8);
  await shop.getByTestId('policy-cancel').click();
  await expect(shop.getByTestId('shop-freeze')).toHaveAttribute('data-policy', 'off');
  await expect(shop.getByTestId('policy-take')).toBeVisible();
  await expectNoSidewaysScroll(page);

  // профиль: программа с ответами регистрации — в настройках под шестерёнкой
  await openTab(page, 'profile');
  await page.getByTestId('prof-settings-open').click();
  const prog = page.getByTestId('prof-program');
  await expect(prog.getByRole('group', { name: 'Цель' }).getByRole('button', { name: 'Олимпиада' })).toHaveAttribute('aria-pressed', 'true');
  await expect(prog.getByRole('group', { name: 'Минут в день' }).getByRole('button', { name: /15 мин/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings').locator('[data-nav="back"]').click();
  // печати: в профиле — короткий ряд, «Все» — весь список
  await expect(page.getByTestId('prof-seals').getByTestId('ach-mini')).toHaveCount(4);
  await page.getByTestId('prof-seals-all').click();
  // печать «Знаток» — только за проверку юнита без ошибок, вступительный тест её не даёт
  await expect(page.locator('[data-testid=ach][data-ach="ace"]')).toHaveAttribute('data-got', 'false');
  await expect(page.locator('[data-testid=ach][data-ach="shop"]')).toHaveAttribute('data-got', 'true');
  // полученная печать — цветная, без мелкого текста по кругу; неполученная — отдельно, с замком; под ней — только название
  await expect(page.locator('[data-testid=ach][data-ach="shop"] svg[data-got="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid=ach][data-ach="ace"] svg[data-got="false"]')).toHaveCount(1);
  await expect(page.locator('.rw-stamps-locked [data-ach="ace"]')).toHaveText('Знаток');
  await expect(page.getByTestId('achievements').locator('textPath')).toHaveCount(0);
  // касание — печать крупно: «как получить» у неполученной, дата у полученной
  await page.locator('[data-testid=ach][data-ach="ace"]').click();
  await expect(page.getByTestId('item-how')).toContainText('Сдайте проверку юнита без единой ошибки');
  await page.getByTestId('item-sheet').getByRole('button', { name: 'Хорошо' }).click();
  await page.locator('[data-testid=ach][data-ach="shop"]').click();
  await expect(page.getByTestId('item-date')).toContainText(/Получена \d+ [а-я]+ \d{4}/);
  await page.getByTestId('item-sheet').getByRole('button', { name: 'Хорошо' }).click();
  await page.getByTestId('collection').locator('[data-nav="back"]').click();

  // назавтра: утренний экран серии — один раз в день. Состояние пишется до загрузки страницы:
  // правка из page.evaluate могла быть затёрта сохранением, которое приложение успевало сделать
  await page.addInitScript(() => {
    if (sessionStorage.getItem('morning-seeded')) return;
    sessionStorage.setItem('morning-seeded', '1');
    const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    const d = new Date(Date.now() - 86400000); const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    p.learn.done = { [y]: 2 }; p.learn.daily = {}; delete p.learn.done[today];
    localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
    localStorage.setItem('ems-learn-morning', y);
  });
  await page.reload({ waitUntil: 'networkidle' });
  const morning = page.getByTestId('morning');
  await expect(morning).toBeVisible();
  await expect(morning.getByTestId('morning-days')).toHaveAttribute('data-value', '1');
  await expect(morning).toContainText('день подряд');
  await expect(morning.getByTestId('morning-week').locator('.rw-dot')).toHaveCount(7);
  await page.getByTestId('morning-go').click();
  await expect(morning).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('path')).toBeVisible();
  await expect(page.getByTestId('morning')).toHaveCount(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

/* Навигация по карте экранов (src/learn/screens.js): на каждом экране не больше одного
   «назад» (у вкладок — ни одного), нет двух видимых переходов в одно место, а «назад» ведёт
   туда, откуда пришли. */
async function navState(page) {
  return page.evaluate(() => {
    const vis = (el) => el.checkVisibility() && !el.closest('[inert]');
    const targets = [...document.querySelectorAll('[data-nav-target]')].filter(vis).map((el) => el.dataset.navTarget);
    const backs = [...document.querySelectorAll('[data-nav="back"]')].filter(vis).length;
    return { targets, backs };
  });
}
async function expectScreen(page, name, seen) {
  const scr = SCREENS[name];
  await expect(page.getByTestId(scr.testid).first(), `экран «${scr.title}»`).toBeVisible();
  const { targets, backs } = await navState(page);
  const dup = targets.filter((t, i) => targets.indexOf(t) !== i);
  expect(dup, `«${scr.title}»: два пути в одно место`).toEqual([]);
  expect(backs, `«${scr.title}»: кнопок «назад»`).toBe(scr.root ? 0 : 1);
  seen.add(name);
}
// «назад» верхнего слоя: под шторкой и страницей поверх экран недоступен (inert) — его «назад» не в счёт
const clickBack = (page) => page.locator('[data-nav="back"]:not([inert] *)').filter({ visible: true }).click();

test('навигация: у каждого экрана один «назад» туда, откуда пришли, и нет двух путей в одно место', async ({ page }) => {
  await withTestFlag(page);
  // юнит 1 пройден — в конце его дороги сундук
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', accountApi, { tab: 'path' });
  const seen = new Set();
  await expectScreen(page, 'path', seen);
  // на Пути текущий уровень — Базовый; плашка уровня → список уровней → пройденный Начальный
  await expect(page.getByTestId('level-switch')).toHaveAttribute('data-level', 'basic');
  await page.getByTestId('level-switch-open').click();
  await expectScreen(page, 'levelPicker', seen);
  await page.locator('[data-testid=level-pick][data-level="start"]').click();
  await expect(page.getByTestId('level-picker')).toHaveCount(0);
  await expect(page.getByTestId('path-unit')).toHaveAttribute('data-unit', 'scarcity');
  await expectScreen(page, 'path', seen);
  // Путь → карточка урока → назад
  await pathNode(page, 'sc-i1').click();
  await expectScreen(page, 'lessonCard', seen);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // Путь → карточка → урок → назад (до первого ответа — сразу)
  await startLesson(page, 'sc-i1');
  await expectScreen(page, 'lesson', seen);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // Путь → гайд юнита → назад: у справочника поверх экрана один «назад», оглавления на странице нет
  await page.getByTestId('path-unit').first().getByTestId('unit-guide').click();
  await expectScreen(page, 'book', seen);
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'scarcity');
  await expect(page.getByTestId('tb-toc')).toHaveCount(0);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // лиги и лавка — вкладки нижней панели; Путь → сундук → назад
  await openTab(page, 'league');
  await expectScreen(page, 'league', seen);
  await openTab(page, 'shop');
  await expectScreen(page, 'shop', seen);
  await openTab(page, 'path');
  await expectScreen(page, 'path', seen);
  await page.getByTestId('chest').first().click();
  await expectScreen(page, 'chest', seen);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // Путь → Задания (карточка наверху) → задачи вперемешку → назад в Задания → назад на Путь
  await page.getByTestId('tasks-card').click();
  await expectScreen(page, 'tasks', seen);
  await page.getByTestId('practice-mixed').click();
  await expectScreen(page, 'book', seen);
  await clickBack(page);
  await expectScreen(page, 'tasks', seen);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // повторное нажатие на вкладку «Путь» тоже закрывает Задания
  await page.getByTestId('tasks-card').click();
  await openTab(page, 'path');
  await expectScreen(page, 'path', seen);
  // вкладка «Учебник»: оглавление без «назад», глава — один «назад» в оглавление
  await openTab(page, 'book');
  await expectScreen(page, 'bookTab', seen);
  // оглавление — по уровням курса и в его порядке; недописанные главы — свёрнутым списком в конце
  const groups = page.getByTestId('tb-level-group');
  await expect(groups.first()).toHaveAttribute('data-level', 'start');
  await expect(groups.nth(1)).toContainText('Базовый');
  expect(await groups.nth(1).locator('[data-chapter]').evaluateAll((els) => els.map((e) => e.dataset.chapter))).toEqual(['supply-demand', 'elasticity', 'market-failures', 'money-banks', 'inflation']);
  await expect(page.getByTestId('textbook').getByText('Производство: производственная функция')).toHaveCount(0);
  await page.getByTestId('tb-planned').getByRole('button').click();
  await expect(page.getByTestId('tb-planned-list')).toContainText('Производство: производственная функция');
  await page.getByTestId('textbook').getByRole('button', { name: /Спрос и предложение/ }).click();
  await expectScreen(page, 'bookPage', seen);
  await clickBack(page);
  await expectScreen(page, 'bookTab', seen);
  await expect(page.getByTestId('textbook')).toBeVisible();
  // Профиль → прогресс в учебнике → назад; Профиль → аккаунт → назад
  await openTab(page, 'profile');
  await expectScreen(page, 'profile', seen);
  await page.getByTestId('prof-book-stats').click();
  await expectScreen(page, 'book', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // Профиль → шестерёнка → настройки → аккаунт → назад в настройки → назад в профиль
  await page.getByTestId('prof-settings-open').click();
  await expectScreen(page, 'settings', seen);
  await page.getByTestId('prof-account').click();
  await expectScreen(page, 'account', seen);
  // в аккаунте нет счётчика, который стыдит
  await expect(page.getByTestId('account')).not.toContainText('Выходов из партий');
  await clickBack(page);
  await expectScreen(page, 'settings', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // Профиль → «Все» у печатей → весь список → печать крупно → назад в список → назад в профиль
  await page.getByTestId('prof-seals-all').click();
  await expectScreen(page, 'collection', seen);
  await page.getByTestId('collection').locator('[data-testid=ach]').first().click();
  await expectScreen(page, 'item', seen);
  await clickBack(page);
  await expectScreen(page, 'collection', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // марка из короткого ряда альбома — сразу крупно; колокольчик — уведомления; назад — в профиль
  await page.getByTestId('album-stamp').first().click();
  await expectScreen(page, 'item', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  await page.getByTestId('prof-bell').click();
  await expectScreen(page, 'notifications', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // Профиль → «Друзья» → профиль друга → назад в список → назад в профиль
  await page.getByTestId('prof-friends').click();
  await expectScreen(page, 'friends', seen);
  await page.getByTestId('friend-row').first().click();
  await expectScreen(page, 'friend', seen);
  await clickBack(page);
  await expectScreen(page, 'friends', seen);
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // Новости — вкладка под «⋯»; колокольчик на Пути — те же уведомления, «назад» — на Путь
  await openTab(page, 'news');
  await expectScreen(page, 'news', seen);
  await openTab(page, 'path');
  await page.getByTestId('bell').click();
  await expectScreen(page, 'notifications', seen);
  await clickBack(page);
  await expectScreen(page, 'path', seen);
  // Мир — корень без «назад»; профиль игрока — только во вкладке «Профиль»
  await openTab(page, 'world');
  await expectScreen(page, 'world', seen);
  await expect(page.getByRole('button', { name: /Войти в профиль|Профиль:/ })).toHaveCount(0);
  // смена вкладки закрывает подэкран: учебник не остаётся висеть под другой вкладкой
  await openTab(page, 'profile');
  await page.getByTestId('prof-book-stats').click();
  await openTab(page, 'path');
  await expect(page.getByTestId('learn-book')).toHaveCount(0);
  // учебник поверх профиля: внизу горит «Учебник», касание по нему — оглавление учебника, а не пустое нажатие
  await openTab(page, 'profile');
  await page.getByTestId('prof-book-stats').click();
  await page.getByTestId('bottom-nav').locator('[data-tab="book"]').click();
  await expect(page.getByTestId('learn-book')).toHaveCount(0);
  await expect(page.getByTestId('book-tab').getByTestId('textbook')).toBeVisible();
  // обойдены все экраны после входа
  expect([...seen].sort()).toEqual(Object.keys(SCREENS).filter((k) => !SCREENS[k].gate && !SCREENS[k].owner).sort());
  expect(errors).toEqual([]);
});

test('вход: экраны до входа — у каждого один «назад» туда, откуда пришли', async ({ page }) => {
  const { errors } = await openApp(page, '/', accountApi, { tab: null });
  const seen = new Set();
  await expectScreen(page, 'welcome', seen);
  await page.getByRole('button', { name: 'Начать' }).click();
  await expectScreen(page, 'welcome-goal', seen);
  for (const g of ['Цель', 'Минут в день', 'Знания']) await page.getByRole('group', { name: g }).getByRole('button').first().click();
  await clickBack(page);
  await expectScreen(page, 'welcome', seen);
  await page.getByRole('button', { name: 'Начать' }).click();
  for (const g of ['Цель', 'Минут в день', 'Знания']) await page.getByRole('group', { name: g }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  // гость: урок → Путь → «Сохраните прогресс» → регистрация; «назад» с неё — обратно на Путь
  await guestToRegister(page);
  await expectScreen(page, 'welcome-register', seen);
  await clickBack(page);
  await expect(page.getByTestId('path')).toBeVisible();
  await page.getByTestId('guest-register').click();
  await expectScreen(page, 'welcome-register', seen);
  // выйти из гостя нельзя кнопкой, но вход доступен: сбросим гостя и вернёмся к приветствию
  await page.evaluate(() => localStorage.removeItem('ems-guest'));
  await page.reload({ waitUntil: 'networkidle' });
  await expectScreen(page, 'welcome', seen);
  await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
  await expectScreen(page, 'welcome-login', seen);
  await page.getByRole('button', { name: 'Забыли пароль?' }).click();
  await expectScreen(page, 'welcome-recover', seen);
  await clickBack(page);
  await expectScreen(page, 'welcome-login', seen);
  await clickBack(page);
  await expectScreen(page, 'welcome', seen);
  expect([...seen].sort()).toEqual(Object.keys(SCREENS).filter((k) => SCREENS[k].gate).sort());
  expect(errors).toEqual([]);
});

test('анимации выключены, если в системе «уменьшить движение»', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await withTestFlag(page);
  // вчера занимался — утром экран серии
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const d = new Date(Date.now() - 86400000); const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { done: { [y]: 1 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const anim = (loc, pseudo = null) => loc.evaluate((el, p) => getComputedStyle(el, p).animationName, pseudo);
  await expect(page.getByTestId('morning')).toBeVisible();
  // билет не выезжает, огонёк-гравюра не колышется, печать не проставляется, цифры не падают — сразу на месте
  expect(await anim(page.locator('.rw-ticket'))).toBe('none');
  expect(await anim(page.locator('.rw-flame'))).toBe('none');
  expect(await anim(page.locator('.rw-flame path').first())).toBe('none');
  expect(await anim(page.locator('.rw-days span').first())).toBe('none');
  await expect(page.getByTestId('morning-days')).toHaveAttribute('data-value', '1');
  await page.getByTestId('morning-go').click();
  await expect(page.getByTestId('path')).toBeVisible();
  expect(await anim(pathNode(page, 'sc-i1'))).toBe('none');
  expect(await anim(pathNode(page, 'sc-i1'), '::after')).toBe('none');
  expect(await anim(page.locator('.ln-pin').first())).toBe('none');
  expect(await anim(page.locator('.infla-eyes').first())).toBe('none');
  await startLesson(page, 'sc-i1');
  await page.getByRole('button', { name: 'Понятно' }).click();
  await answerExercise(page, { wrong: true });
  expect(await anim(page.getByTestId('ex'))).toBe('none');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await playLesson(page);
  // без монет, опыт — сразу итоговым числом
  await expect(page.getByTestId('coins')).toHaveCount(0);
  const xp = page.getByTestId('result-xp').locator('[data-value]');
  await expect(xp).toHaveText(`+${await xp.getAttribute('data-value')}`);
  expect(errors).toEqual([]);
});

test.describe('офлайн', () => {
  test.use({ serviceWorkers: 'allow' });
  test('приложение ставится на экран: манифест, service worker, урок открывается без сети', async ({ page, context }) => {
    await context.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // со второго открытия страницей управляет service worker и складывает файлы в кэш
    await page.reload({ waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.getByTestId('path')).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('path')).toBeVisible();
    await page.getByTestId('path').getByTestId('path-lesson').first().click();
    await page.getByTestId('lesson-start').click();
    await expect(page.getByTestId('lesson-card')).toBeVisible();
    await context.setOffline(false);
  });
});

// «Мир»: выключенная музыка остаётся выключенной после перезагрузки страницы
test('мир: выключенная музыка не включается после перезагрузки', async ({ page }) => {
  const { errors } = await openApp(page);
  const soundBtn = page.locator('button[title^="Музыка"]');
  await soundBtn.click();
  const row = page.locator('div', { has: page.locator('span', { hasText: /^Музыка$/ }) }).last();
  await row.getByRole('button', { name: 'вкл' }).click();
  await expect(row.getByRole('button', { name: 'выкл' })).toBeVisible();
  await gotoApp(page);
  await page.locator('button[title^="Музыка"]').click();
  const row2 = page.locator('div', { has: page.locator('span', { hasText: /^Музыка$/ }) }).last();
  await expect(row2.getByRole('button', { name: 'выкл' })).toBeVisible();
  expect(errors).toEqual([]);
});

// «Открыть теорию» из карточки урока: учебник поверх Пути — внизу отмечен «Учебник», «Путь» возвращает на дорогу
test('теория из карточки урока: внизу отмечен «Учебник», вкладка «Путь» закрывает учебник', async ({ page }) => {
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum',
      'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum',
      'el-i1', 'el-l1', 'el-i2', 'el-l2', 'el-w', 'el-s1', 'el-radio', 'el-g', 'el-rev', 'el-sum', 'cs-i1', 'cs-l1', 'cs-i2', 'cs-l2', 'cs-w'];
    if (!localStorage.getItem('ems-textbook-v1')) localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await showUnit(page, 'consumer');
  await page.locator('[data-testid=path-lesson][data-lesson="cs-s1"]').click();
  await expect(page.getByTestId('theory-notice')).toBeVisible();
  await page.getByTestId('theory-open').click();
  await expect(page.getByTestId('learn-book')).toBeVisible();
  const nav = page.getByTestId('bottom-nav');
  await expect(nav.locator('[data-tab="book"]')).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[data-tab="path"]')).not.toHaveAttribute('aria-current', 'page');
  await nav.locator('[data-tab="path"]').click();
  await expect(page.getByTestId('learn-book')).toHaveCount(0);
  await expect(page.getByTestId('path')).toBeVisible();
  await expect(nav.locator('[data-tab="path"]')).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('новые глаголы: «Откройте сами», живая модель на Пути, «Домино» в практике, копилка Инфли и цена отказа', async ({ page }) => {
  test.setTimeout(180_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    // sc-l1 пройден со слабой точностью: «рекомендуем» над ним висеть не должно
    if (!localStorage.getItem('ems-textbook-v1')) localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: {
      lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])), topics: { 'sc-l1': { n: 5, ok: 1 } }, coins: { '2026-01-01': 400 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  // «рекомендуем сейчас» — над следующей остановкой, а не над пройденным слабым уроком; слабое место — строкой
  await expect(path.getByTestId('path-rec')).toHaveCount(1);
  await expect(pathNode(page, 'sd-i1').locator('xpath=..').getByTestId('path-rec')).toHaveCount(1);
  await expect(path).toContainText('Слабое место');
  // живая модель юнита пока пуста: первая деталь — в первом уроке; на телефоне модель свёрнута строкой
  const fold = path.getByTestId('model-fold').first();
  if (await fold.isVisible()) { await expect(fold).toContainText('Соберётся по ходу юнита'); await fold.click(); }
  const model = path.locator('[data-testid=unit-model]').first();
  await expect(model).toHaveAttribute('data-open', '0');
  await expect(model.getByTestId('model-empty')).toContainText('Знакомство: спрос');

  // «Откройте сами» — первый шаг первого урока юнита, до карточки-идеи
  await startLesson(page, 'sd-i1');
  // урок — слой поверх страницы: страница под ним не прокручивается и не показывает свой ползунок
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  const d = page.getByTestId('discover');
  await expect(d).toBeVisible();
  await expect(page.getByTestId('lesson-card')).toHaveAttribute('data-style', 'discover');
  await expect(page.getByTestId('discover-next')).toBeDisabled();
  // одна и та же цена дважды — одна точка исследования, дальше не пускает
  for (let k = 0; k < 2; k += 1) {
    await d.getByTestId('discover-price').fill('20');
    await expect(d.getByTestId('discover-open')).toBeEnabled({ timeout: 4000 });
    await d.getByTestId('discover-open').click();
  }
  await expect(d).toHaveAttribute('data-distinct', '1');
  await expect(d.getByTestId('discover-point')).toHaveCount(2);
  await expect(d.getByTestId('discover-line')).toHaveCount(0);
  await expect(page.getByTestId('discover-next')).toBeDisabled();
  await expect(page.getByTestId('street')).toBeVisible();
  // ещё четыре разные цены — проступает линия, Инфля называет её, можно дальше
  await playDiscover(page);
  await expect(page.getByTestId('lesson-card')).not.toHaveAttribute('data-style', 'discover');
  await expect(page.getByTestId('lesson-card').getByText('Спрос — это зависимость')).toBeVisible();
  await playLesson(page);
  await expect(page.getByTestId('result-model')).toContainText('«Спрос»');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');

  // модель на Пути: деталь открыта, на карте счётчика модели нет (лишний шум); закрытые — «откроется в уроке …»
  await expect(model).toHaveAttribute('data-open', '1');
  await expect(path.getByTestId('atlas-model')).toHaveCount(0);
  await expect(model.locator('[data-part="demand"]')).toHaveAttribute('data-open', 'true');
  await model.locator('[data-part="income"]').click();
  await expect(model.getByTestId('model-part-note')).toContainText('Откроется в уроке «Спрос: закон и сдвиги»');
  await model.locator('[data-part="elastic"]').click();
  await expect(model.getByTestId('model-part-note')).toContainText('юнит «Эластичность»');
  await model.getByTestId('model-price').fill('30');
  await expect(model.getByTestId('model-readout')).toContainText('При цене 30 кр. купят 30');
  await expect(model.getByTestId('model-stats')).toContainText('30');
  // ничего не трогали — «Вернуть как было» не нужна; сдвинули цену — появилась
  await expect(model.getByTestId('model-reset')).toBeVisible();
  await model.getByTestId('model-reset').click();
  await expect(model.getByTestId('model-readout')).toContainText('При цене 20 кр. купят 60');
  await expect(model.getByTestId('model-reset')).toHaveCount(0);

  // «Домино» в практике — всегда: неверная карточка роняет домино с разбором, задание не засчитано
  await startLesson(page, 'sd-l1');
  let met = false;
  for (let i = 0; i < 40 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    await passCards(page);
    const ex = page.getByTestId('ex');
    if (!met && await ex.getAttribute('data-kind') === 'domino') {
      met = true;
      const dom = ex.getByTestId('domino');
      const chain = JSON.parse(await ex.getAttribute('data-answer'));
      await expect(dom.getByTestId('domino-headline')).toHaveText('ЗАРПЛАТЫ В ВЕЛЕГРАДЕ ВЫРОСЛИ НА 10%');
      await expect(dom.getByTestId('domino-slot')).toHaveCount(chain.length);
      await expect(page.getByRole('button', { name: 'Проверить' })).toHaveCount(0);
      await dom.locator(`[data-key="${chain[0]}"]`).click();
      await expect(dom.locator('[data-testid="domino-slot"][data-on="true"]')).toHaveCount(1);
      // через звено — «есть в цепочке, но позже»
      await dom.locator(`[data-key="${chain[2]}"]`).click();
      await expect(dom.getByTestId('domino-why')).toContainText('позже');
      await dom.locator('[data-testid="domino-card"][data-key^="f"]').first().click();
      await expect(dom).toHaveAttribute('data-falls', '2');
      await expect(dom.locator('[data-testid="domino-card"][data-key^="f"]:disabled')).toHaveCount(1);
      for (const k of chain.slice(1)) await dom.locator(`[data-key="${k}"]`).click();
      // собранная цепочка — итог без оценки
      await expect(dom.getByTestId('domino-done')).toHaveText('Собрано, было падений: 2');
      await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'false');
      // после ошибки — тёплый нейтральный тон, а не красный: «Дальше» в туши выбора
      await expect(page.getByRole('button', { name: 'Дальше', exact: true })).toHaveClass(/ds-btn--warm/);
      const tone = await page.getByTestId('ex-feedback').evaluate((el) => {
        const bar = el.closest('.ds-answer');
        const probe = (v) => { const s = document.createElement('span'); s.style.color = `var(${v})`; bar.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
        return { top: getComputedStyle(bar).borderTopColor, warm: probe('--ds-sel-rule'), bad: probe('--ds-bad') };
      });
      expect(tone.top).toBe(tone.warm);
      expect(tone.top).not.toBe(tone.bad);
      await expect(page.getByTestId('ex-why')).toContainText('домино падало 2 раза');
      // сцена ожила: спрос сдвинулся вправо
      await expect(dom.getByTestId('domino-scene')).toHaveAttribute('data-da', '24');
    } else await answerExercise(page);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  expect(met, 'в практике sd-l1 не встретилось «Домино»').toBe(true);
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();

  // лавка: под ценой — цена отказа; копилка — положить, забрать раньше (процент сгорает)
  await openTab(page, 'shop');
  const shop = page.getByTestId('shop');
  await expect(shop.getByTestId('shop-forgone').first()).toHaveText(/≈ \d+ урок.* · копилка дала бы \+\d+/);
  await shopTab(page, 'useful');
  await expect(shop.getByTestId('shop-freeze')).toContainText('Страховка серии');
  const piggy = shop.getByTestId('shop-piggy');
  await expect(piggy).toHaveAttribute('data-open', 'false');
  const before = Number((await shop.getByTestId('shop-balance').innerText()).match(/\d+/)[0]);
  await piggy.getByTestId('piggy-amount').fill('100');
  await expect(piggy.getByTestId('piggy-chart')).toBeVisible();
  // ставка недели — на карточке копилки; честно про проценты («так не бывает», рядом реальные 8% годовых) — свёрнуто
  await expect(piggy.getByTestId('rate-week')).toBeVisible();
  await piggy.getByTestId('piggy-real').locator('summary').click();
  await expect(piggy.getByTestId('piggy-real')).toContainText(/\d+% годовых — в жизни так не бывает/);
  await piggy.getByTestId('piggy-put').click();
  // вклад — под ставку этой недели
  await expect(shop.getByTestId('shop-msg')).toContainText(/Срочный вклад: 100 монет под \d+(,\d)?% в день\. Через 7 дней станет 1[0-2]\d\./);
  await expect(piggy.getByTestId('piggy-kind')).toContainText('срочный');
  await expect(piggy.getByTestId('piggy-add-form')).toHaveCount(0);
  await expect(piggy.getByTestId('piggy-rate')).toHaveText(await piggy.getByTestId('rate-week-value').innerText() + ' в день');
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before - 100));
  await expect(piggy.getByTestId('piggy-state')).toContainText('День 0 из 7');
  await piggy.getByTestId('piggy-take').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('проценты не успели набежать');
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before));
  // пополняемый вклад: ставка ниже, докладывать можно в любой день
  await piggy.getByTestId('piggy-kind-topup').click();
  await piggy.getByTestId('piggy-amount').fill('50');
  await piggy.getByTestId('piggy-put').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('Пополняемый вклад: 50 монет');
  await expect(piggy.getByTestId('piggy-kind')).toContainText('пополняемый');
  await piggy.getByTestId('piggy-add-form').locator('input').fill('20');
  await piggy.getByTestId('piggy-add').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('Пополнено на 20 монет');
  await expect(piggy.getByTestId('piggy-amount-in')).toHaveText('70');
  // пополнение на графике — ступенька с подписью
  await expect(piggy.getByTestId('piggy-step')).toHaveText('+20');
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before - 70));
  await piggy.getByTestId('piggy-take').click();
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before));
  // вклад, пролежавший неделю: забрать с процентами
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    p.learn.piggy = { ...p.learn.piggy, [Date.now() - 8 * 86400000]: 100 };
    localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await openTab(page, 'shop');
  // созревший вклад — зелёная точка на вкладке «Полезное»
  await expect(page.getByTestId('shop-tabs').locator('[data-tab="useful"] .sh-dot')).toBeVisible();
  await shopTab(page, 'useful');
  await expect(page.getByTestId('shop-piggy').getByTestId('piggy-state')).toContainText('срок вышел');
  await page.getByTestId('shop-piggy').getByTestId('piggy-take').click();
  await expect(page.getByTestId('shop-msg')).toContainText(/Забрано 1[0-2]\d монет[аы]? — с процентами за неделю\./);
  // своя анимация «забрать»: свинка встряхивается, монеты вылетают, всплывает «+N»; потом всё уходит
  const art = page.getByTestId('shop-piggy').getByTestId('piggy-art');
  await expect(art).toHaveAttribute('data-taking', 'true');
  await expect(art.getByTestId('piggy-plus')).toHaveText(/^\+1[0-2]\d$/);
  await expect(art.locator('.rw-pig-out:not(.lost)')).not.toHaveCount(0);
  await expect(art.getByTestId('piggy-plus')).toHaveCount(0, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('учебник: калькулятор по полям а → б → в, решённые задачи свёрнуты, «Задачи» — к текущей, «назад» закреплён, «Учебник» ещё раз — оглавление', async ({ page }) => {
  const { errors } = await openApp(page);
  await openBook(page);
  await page.getByTestId('textbook').getByRole('button', { name: /Совершенная конкуренция и монополия/ }).click();
  const ch = page.getByTestId('chapter');
  const pr = ch.locator('[data-problem="pc-basic"]');
  await pr.scrollIntoViewIfNeeded();
  await pr.getByTestId('tb-calc-open').click();
  // результат калькулятора идёт в поля по очереди: а), потом б), потом в)
  const calc = pr.getByTestId('tb-calc');
  for (const [expr, field] of [['20/2', 'а)'], ['30*10', 'б)'], ['4*10', 'в)']]) {
    await expect(pr.getByTestId('tb-calc-use')).toHaveText(`В ответ ${field}`);
    await calc.getByRole('textbox', { name: 'Выражение для калькулятора' }).fill(expr);
    await pr.getByTestId('tb-calc-use').click();
  }
  const fields = pr.getByRole('textbox', { name: /шаг/ });
  await expect(fields.nth(0)).toHaveValue('10');
  await expect(fields.nth(1)).toHaveValue('300');
  await expect(fields.nth(2)).toHaveValue('40');
  // поле можно выбрать и вручную
  await pr.locator('[data-testid="tb-calc-target"][data-target="0"]').click();
  await expect(pr.getByTestId('tb-calc-use')).toHaveText('В ответ а)');
  await pr.getByRole('button', { name: 'Уверен', exact: true }).click();
  await pr.getByRole('button', { name: 'Проверить' }).click();
  await expect(pr.getByTestId('tb-verdict')).toContainText('Верно');
  await expect(pr).toHaveAttribute('data-solved', 'true');
  await expect(pr.getByTestId('tb-solved-chip')).toContainText('Решена');

  // «назад» закреплён сверху: из глубины главы он на виду; стрелка «наверх» — к началу главы
  await page.mouse.wheel(0, 2500);
  await expect(page.getByTestId('tb-topbar')).toBeInViewport();
  await expect(page.getByTestId('tb-to-top')).toBeVisible();
  await page.getByTestId('tb-to-top').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await expect(page.getByTestId('tb-to-top')).toHaveCount(0);
  await page.mouse.wheel(0, 2500);
  // повторное нажатие на «Учебник» — на главную страницу учебника
  await page.getByTestId('bottom-nav').locator('[data-tab="book"]').click();
  await expect(page.getByTestId('textbook')).toBeVisible();
  await expect(page.getByTestId('chapter')).toHaveCount(0);

  // решённая задача свёрнута в строку «решена»; «Задачи» в оглавлении главы — к текущей задаче
  await page.getByTestId('textbook').getByRole('button', { name: /Совершенная конкуренция и монополия/ }).click();
  const done = ch.locator('[data-problem="pc-basic"]');
  await expect(done).toHaveAttribute('data-collapsed', 'true');
  await expect(done).toContainText('решена');
  // решённая — заметна: зелёная кайма и отметка; в оглавлении главы — «решено N из M»
  await expect(done).toHaveAttribute('data-solved', 'true');
  await expect(done.locator('.tb-solved-mark')).toBeVisible();
  await expect(ch.getByTestId('tb-secnav-solved')).toContainText(/решено [1-9]\d* из \d+/);
  await ch.getByTestId('tb-sections').getByRole('button', { name: 'Задачи' }).click();
  const curId = await ch.locator('[data-testid="tb-problem"]:not([data-collapsed="true"])').first().getAttribute('data-problem');
  await expect(ch.locator(`[data-problem="${curId}"]`)).toBeInViewport();
  await done.getByTestId('tb-problem-expand').click();
  await expect(done).not.toHaveAttribute('data-collapsed', 'true');
  await expect(done.getByRole('textbox').first()).toBeVisible();
  // развёрнутую — и свернуть обратно: кнопкой вверху карточки и внизу, у «Решения»
  await done.getByTestId('tb-problem-collapse').click();
  await expect(done).toHaveAttribute('data-collapsed', 'true');
  await done.getByTestId('tb-problem-expand').click();
  await done.getByTestId('tb-problem-collapse-bottom').click();
  await expect(done).toHaveAttribute('data-collapsed', 'true');
  await expect(done).toBeInViewport();
  // и нерешённую можно свернуть — отложить на потом: строка говорит «не решена», без зелёной отметки
  const todo = ch.locator(`[data-problem="${curId}"]`);
  await todo.getByTestId('tb-problem-collapse').click();
  await expect(todo).toHaveAttribute('data-collapsed', 'true');
  await expect(todo).not.toHaveAttribute('data-solved', 'true');
  await expect(todo).toContainText(/не решена|была ошибка/);
  await todo.getByTestId('tb-problem-expand').click();
  await expect(todo.getByRole('button', { name: /Проверить/ }).first()).toBeVisible();
  // «назад» в верхней панели — из главы в оглавление
  await page.getByTestId('tb-topbar').locator('[data-nav="back"]').click();
  await expect(page.getByTestId('textbook')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Путь: открывается на рекомендованном уроке, юниты одного уровня и плашка уровня, пройденный юнит — строкой, место на карте ведёт к уроку, «К карте»', async ({ page, isMobile }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1', 'sd-l1'];
    if (!localStorage.getItem('ems-textbook-v1')) localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: {
      lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])), claimed: { 'c:scarcity': at }, coins: { '2026-01-01': 400 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  // сразу на рекомендованном уроке: он на экране, карта уехала вверх
  const rec = path.locator('[data-testid=path-lesson][data-rec="true"]');
  await expect(rec).toHaveAttribute('data-lesson', 'sd-w');
  await expect(rec).toBeInViewport();
  // на экране — юниты текущего уровня (Базовый: пять юнитов); плашка уровня закреплена наверху и видна рядом с уроком
  expect(await path.getByTestId('path-unit').evaluateAll((els) => els.map((e) => e.dataset.unit))).toEqual(['supply-demand', 'elasticity', 'market-failures', 'money-banks', 'inflation']);
  const plate = path.getByTestId('level-switch');
  await expect(plate).toBeInViewport();
  await expect(plate).toContainText('Базовый');
  expect((await plate.boundingBox()).y).toBeLessThan(4);
  await expect(path.getByTestId('level-next')).toHaveAttribute('data-locked', 'true');
  // уровень назад — Начальный: пройденный юнит с открытым сундуком — одна строка, не выше 80 px;
  // у узкого экрана название не наезжает на значки; «Уроки» разворачивает
  await path.getByTestId('level-prev').click();
  const sc = path.locator('[data-testid=path-unit][data-unit="scarcity"]');
  await expect(path.getByTestId('path-unit')).toHaveCount(1);
  await expect(sc).toHaveAttribute('data-folded', 'true');
  expect((await sc.boundingBox()).height).toBeLessThan(80);
  const titleBox = await sc.locator('.ln-mini-title').boundingBox();
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual((await sc.getByTestId('unit-guide').boundingBox()).x + 1);
  await sc.getByTestId('unit-fold').click();
  await expect(sc).toHaveAttribute('data-folded', 'false');
  await expect(sc.getByTestId('path-lesson')).toHaveCount(14);
  // и обратно — свернуть (ниже касание места на карте раскроет его само)
  await sc.getByTestId('unit-fold').click();
  await expect(sc).toHaveAttribute('data-folded', 'true');
  await expect(path.getByTestId('level-prev')).toBeDisabled();
  // вперёд — снова Базовый
  await path.getByTestId('level-next').click();
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'basic');
  // замок у следующего уровня — список уровней, у «Среднего» — тест по «Базовому»
  await path.getByTestId('level-next').click();
  const picker = page.getByTestId('level-picker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-testid=level-pick][data-level="middle"]').getByTestId('level-pick-test')).toBeVisible();
  await expect(picker.locator('[data-testid=level-pick][data-level="middle"]')).toContainText('тест по уровню «Базовый»');
  await expectNoSidewaysScroll(page);
  await picker.locator('[data-nav="back"]').click();
  await expect(picker).toHaveCount(0);
  // на карте места юнитов уровня на экране — в кольце
  await expect(path.locator('[data-testid=atlas-place][data-unit="supply-demand"]')).toHaveAttribute('data-selected', 'true');
  await expect(path.locator('[data-testid=atlas-place][data-unit="inflation"]')).toHaveAttribute('data-selected', 'true');
  await expect(path.locator('[data-testid=atlas-place][data-unit="scarcity"]')).toHaveAttribute('data-selected', 'false');
  // кнопка «К карте» — пока карта за верхом экрана; касание возвращает к карте
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByTestId('to-map')).toBeVisible();
  await page.getByTestId('to-map').click();
  await expect(path.getByTestId('atlas')).toBeInViewport();
  await expect(page.getByTestId('to-map')).toHaveCount(0);
  // место на карте — уровень этого юнита; у пройденного места дымит труба — оно всё время чуть
  // движется, поэтому без ожидания неподвижности (но после того, как плавная прокрутка закончилась)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // место — посреди экрана: на телефоне низ карты прячется под нижней панелью
  await path.locator('[data-testid=atlas-place][data-unit="scarcity"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await path.locator('[data-testid=atlas-place][data-unit="scarcity"]').click({ force: true });
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'start');
  // свёрнутый юнит касанием места на карте раскрывается
  await expect(path.locator('[data-testid=path-unit][data-unit="scarcity"]')).toHaveAttribute('data-folded', 'false');
  // на карте 25 мест — по пять на уровень: юниты и места под будущие юниты
  await expect(path.getByTestId('atlas-soon')).toHaveCount(3);
  await expect(path.locator('[data-testid=atlas-place], [data-testid=atlas-soon]')).toHaveCount(25);
  // повторное касание вкладки «Путь» — снова текущий уровень и рекомендованный урок
  await page.getByTestId('bottom-nav').locator('[data-tab="path"]').click();
  await expect(rec).toBeInViewport();
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'basic');
  // место закрытого уровня — список уровней с тестом
  await page.evaluate(() => window.scrollTo(0, 0));
  await path.locator('[data-testid=atlas-place][data-unit="consumer"]').click();
  await expect(picker).toBeVisible();
  await picker.locator('[data-nav="back"]').click();
  if (isMobile) {
    // телефон: живая модель — свёрнутой строкой, раскрывается касанием
    const fold = path.getByTestId('model-fold');
    await expect(fold).toHaveCount(1);
    expect((await fold.boundingBox()).height).toBeLessThan(80);
    await expect(path.getByTestId('unit-model')).toHaveCount(0);
    await fold.click();
    await expect(path.getByTestId('unit-model')).toBeVisible();
    await path.getByTestId('model-fold-close').click();
    await expect(path.getByTestId('unit-model')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('Путь: проверку пройденного юнита можно пройти ещё раз — уроки остаются пройденными', async ({ page }) => {
  test.setTimeout(120_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'scarcity');
  await unit.getByTestId('unit-check').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'check');
  await expect(page.getByTestId('lesson')).toHaveAttribute('aria-label', 'Проверка юнита');
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Юнит не забыт');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('path').locator('[data-testid="path-unit"][data-unit="scarcity"] [data-testid="path-lesson"]:not([data-state="done"])')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('время урока — только когда ученик на месте: три часа паузы не попадают в «Время»', async ({ page }) => {
  await page.clock.install();
  await withTestFlag(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sc-i1');
  // ученик ушёл: вкладка открыта, но три часа ни касания
  await page.clock.fastForward(3 * 3600 * 1000);
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  const [mm] = (await page.getByTestId('result-time').locator('.v').innerText()).split(':').map(Number);
  expect(mm).toBeLessThan(10);
  expect(errors).toEqual([]);
});

test('«Слушай» можно пропустить с билета урока: следующий урок открыт, пропущенный — с отметкой', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum',
      'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await showUnit(page, 'supply-demand');
  await expect(pathNode(page, 'sd-g')).toHaveAttribute('data-state', 'locked');
  await pathNode(page, 'sd-l-radio').click();
  const sheet = page.getByTestId('lesson-sheet');
  await sheet.getByTestId('lesson-skip').click();
  await expect(sheet).toHaveCount(0);
  await expect(pathNode(page, 'sd-l-radio')).toHaveAttribute('data-skipped', 'true');
  await expect(pathNode(page, 'sd-g')).toHaveAttribute('data-state', 'open');
  // на билете пропущенного — «Начать» и пояснение, кнопки пропуска больше нет
  await pathNode(page, 'sd-l-radio').click();
  await expect(sheet.getByTestId('lesson-skipped-note')).toBeVisible();
  await expect(sheet.getByTestId('lesson-skip')).toHaveCount(0);
  await expect(sheet.getByTestId('lesson-start')).toHaveText(/^Начать/);
  expect(errors).toEqual([]);
});

test('повторение: трудную задачу можно убрать — уходит и из учебника, и из ошибок Пути', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 3 * 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({
      problems: { 'mb-rounds': { tries: 1, ok: false, box: 0, due: Date.now() - 1000, lastAt: at } },
      learn: { mistakes: [{ id: 'auto:mb-rounds', at }, { id: 'auto:sc-oc', at }] },
    }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await openTasks(page);
  // многошаговая задача решается только в учебнике — в «Повторить ошибки» её не считаем
  await expect(page.getByTestId('practice-mistakes')).toContainText('1 упражнение');
  await page.getByTestId('practice-review').click();
  const review = page.getByTestId('review');
  const item = review.locator('[data-testid=review-item][data-item="mb-rounds"]');
  // ещё не отвечали — под карточкой «Не знаете, как решать? Убрать из повторения»
  await item.getByTestId('review-drop').click();
  await expect(item.getByTestId('review-badge')).toContainText('убрано');
  await expect(item).toHaveCount(0);
  await expect(review.getByTestId('review-tally')).toContainText('убрано: 1');
  await expect(review.getByTestId('review-empty')).toBeVisible();
  // одно повторение: ушла и ошибка той же задачи на Пути
  await bookBack(page);
  await expect(page.getByTestId('practice-mistakes')).toContainText('1 упражнение');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ems-textbook-v1')));
  expect(saved.problems['mb-rounds']).toMatchObject({ ok: false, due: null });
  expect(saved.learn.mistakes.map((m) => m.id)).toEqual(['auto:sc-oc']);
  expect(errors).toEqual([]);
});

// напоминание о повторении учебника — от пяти задач, днём; касание открывает «Повторение» учебника
test('уведомления: задачи учебника ждут повторения — напоминание от пяти задач, касание ведёт на «Повторение»', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T16:00:00'));
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 3 * 86400000;
    const ids = ['sc-inside', 'sc-oc', 'sc-hours', 'sc-ppf-cost', 'sc-terms', 'sc-gains'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({
      problems: Object.fromEntries(ids.map((id) => [id, { tries: 1, ok: true, box: 1, due: Date.now() - 1000, lastAt: at }])),
      learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 } }, done: { [new Date(at).toISOString().slice(0, 10)]: 1 } },
    }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await page.getByTestId('bell').first().click();
  const note = page.locator('[data-testid=notifications] [data-id^="book-review:"]');
  await expect(note).toHaveCount(1);
  await expect(note).toContainText('6 задач');
  await note.click();
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('review-item')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('повторение: ошибку не снять тут же, карточка уходит «вернётся» или «выучено», Путь и учебник — одно повторение', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 3 * 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({
      problems: {
        'pc-basic': { tries: 1, ok: false, box: 0, due: Date.now() - 1000, lastAt: at },
        'sc-oc': { tries: 2, ok: true, box: 2, due: Date.now() - 1000, lastAt: at },
      },
      learn: { mistakes: [{ id: 'auto:pc-basic', at }, { id: 'auto:sc-oc', at }] },
    }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await openTasks(page);
  // pc-basic — многошаговая: решается в учебнике, в «Повторить ошибки» её нет
  await expect(page.getByTestId('practice-mistakes')).toContainText('1 упражнение');
  await page.getByTestId('practice-review').click();
  const review = page.getByTestId('review');
  await expect(review.getByTestId('review-item')).toHaveCount(2);
  // термин в условии нажимается — определение прямо в тексте
  const pc = review.locator('[data-testid=review-item][data-item="pc-basic"]');
  await pc.locator('[data-term]').first().click();
  await expect(pc.locator('.tb-def').first()).toBeVisible();
  // ошибка — карточка остаётся; тут же верно — повторение не снято
  const solve = async (vals) => {
    const inputs = pc.getByRole('textbox');
    for (let k = 0; k < vals.length; k += 1) await inputs.nth(k).fill(vals[k]);
    await pc.getByRole('button', { name: 'Уверен', exact: true }).click();
    await pc.getByRole('button', { name: 'Проверить' }).click();
  };
  await solve(['1', '2', '3']);
  await expect(pc).toHaveAttribute('data-outcome', 'wrong');
  await solve(['10', '300', '40']);
  await expect(pc.getByTestId('tb-verdict')).toContainText('в этот раз была ошибка');
  await expect(pc).toHaveAttribute('data-outcome', 'wrong');
  await pc.getByTestId('review-dismiss').click();
  await expect(pc.getByTestId('review-badge')).toContainText('через 2 дня');
  await expect(pc).toHaveCount(0);
  // последний шаг расписания — «Выучено», и карточка исчезает
  const oc = review.locator('[data-testid=review-item][data-item="sc-oc"]');
  await oc.getByRole('textbox').fill('3');
  await oc.getByRole('button', { name: 'Уверен', exact: true }).click();
  await oc.getByRole('button', { name: 'Проверить' }).click();
  await expect(oc.getByTestId('review-badge')).toContainText('Выучено');
  await expect(oc).toHaveCount(0);
  await expect(review.getByTestId('review-tally')).toContainText('выучено: 1');
  await expect(review.getByTestId('review-tally')).toContainText('отложено до следующего раза: 1');
  await expect(review.getByTestId('review-empty')).toBeVisible();
  // одно повторение: решённая в учебнике задача ушла и из ошибок Пути, нерешённая — осталась (в учебнике)
  await bookBack(page);
  await expect(page.getByTestId('practice-mistakes')).toContainText('Ошибок нет');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ems-textbook-v1')));
  expect(saved.learn.mistakes.map((m) => m.id)).toEqual(['auto:pc-basic']);
  expect(errors).toEqual([]);
});

test('Путь: тест уровня — сдан, и Путь сразу на следующем уровне; уроки сданного уровня открыты', async ({ page }) => {
  test.setTimeout(150_000);
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'basic');
  await expect(path.locator('[data-testid=path-lesson][data-state="locked"]').first()).toBeVisible();
  // тест «Базового» из списка уровней — задачи всех четырёх юнитов уровня
  await path.getByTestId('level-next').click();
  const picker = page.getByTestId('level-picker');
  await picker.locator('[data-testid=level-pick][data-level="middle"]').getByTestId('level-pick-test').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'check');
  await expect(page.getByTestId('lesson')).toHaveAttribute('aria-label', 'Тест уровня «Базовый»');
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Проверка сдана');
  await expect(page.getByTestId('lesson-result')).toContainText('Уровень «Средний» открыт');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  // Путь — сразу на «Среднем»: прошлых уровней на экране нет
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'middle');
  expect(await path.getByTestId('path-unit').evaluateAll((els) => els.map((e) => e.dataset.unit))).toEqual(['consumer', 'costs', 'competition-monopoly', 'monopolistic']);
  await expect(pathNode(page, 'cs-i1')).toHaveAttribute('data-state', 'open');
  await path.getByTestId('level-switch-open').click();
  expect(await picker.getByTestId('level-pick').evaluateAll((els) => els.map((e) => `${e.dataset.level}:${e.dataset.state}`)))
    .toEqual(['start:done', 'basic:open', 'middle:open', 'advanced:soon', 'pro:soon']);
  await expect(picker.getByTestId('level-pick-test')).toHaveCount(0);
  await picker.locator('[data-nav="back"]').click();
  // уровень назад — уроки сданного «Базового» открыты, но пройденными не стали
  await path.getByTestId('level-prev').click();
  await expect(path.getByTestId('level-switch')).toHaveAttribute('data-level', 'basic');
  await expect(path.locator('[data-testid=path-lesson][data-state="locked"]')).toHaveCount(0);
  await expect(path.locator('[data-testid=path-lesson][data-state="done"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('память браузера: уведомление один раз — cookie нет, «Подробнее» ведёт на страницу данных', async ({ page }) => {
  await withTestFlag(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const note = page.getByTestId('storage-notice');
  await expect(note).toContainText('Cookie мы не используем');
  await note.getByTestId('storage-notice-more').click();
  await expect(page.getByTestId('privacy')).toContainText('Cookie и память браузера');
  await page.getByTestId('privacy').locator('[data-nav="back"]').click();
  await note.getByTestId('storage-notice-ok').click();
  await expect(note).toHaveCount(0);
  // после перезагрузки — не возвращается
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('path')).toBeVisible();
  await expect(page.getByTestId('storage-notice')).toHaveCount(0);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(errors).toEqual([]);
});

test('узкий телефон 320 px: Путь без бокового скролла, нижняя панель целиком на экране', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только телефон');
  await withTestFlag(page);
  await page.setViewportSize({ width: 320, height: 658 });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await expect(page.getByTestId('path')).toBeVisible();
  await expectNoSidewaysScroll(page);
  // последняя вкладка «⋯» целиком на экране; её меню — тоже
  const nav = await page.getByTestId('bottom-nav').locator('[data-tab="more"]').boundingBox();
  expect(nav.x + nav.width).toBeLessThanOrEqual(321);
  await page.getByTestId('bottom-nav').locator('[data-tab="more"]').click();
  const menu = await page.getByTestId('more-menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(321);
  await page.getByTestId('more-menu').locator('[data-tab="profile"]').click();
  await expect(page.getByTestId('learn-profile')).toBeVisible();
  await expect(page.getByTestId('bottom-nav').locator('[data-tab="more"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('bottom-nav').locator('[data-tab="more"]')).toContainText('Профиль');
  expect(errors).toEqual([]);
});

test('урок на ПК: увеличен, только если окно высокое — под шаг не меньше места, чем на телефоне', async ({ page, isMobile }) => {
  test.skip(isMobile, 'увеличение урока — только на ПК');
  await withTestFlag(page);
  await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sc-i1');
  const look = () => page.evaluate(() => { const b = document.querySelector('.ln-overlay .ln-body'); return { zoom: Number(getComputedStyle(b).zoom), h: b.getBoundingClientRect().height / Number(getComputedStyle(b).zoom) }; });
  // ноутбук 1920×1080 с масштабом Windows 125 %: окно 1536×730 — без увеличения, шрифт и так крупнее
  await page.setViewportSize({ width: 1536, height: 730 });
  let v = await look();
  expect(v.zoom).toBe(1);
  expect(v.h).toBeGreaterThan(540);
  // высокое окно — урок крупнее целиком, а под шаг по-прежнему не меньше, чем на телефоне
  for (const [width, height, zoom] of [[1440, 950, 1.2], [1920, 1080, 1.32]]) {
    await page.setViewportSize({ width, height });
    v = await look();
    expect(v.zoom).toBe(zoom);
    expect(v.h).toBeGreaterThan(540);
  }
});

test('урок на ПК: черновик на полях — включается кнопкой; ручка, маркер, ластик, отмена, «Стереть всё»', async ({ page, isMobile }) => {
  await withTestFlag(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sc-i1');
  const canvas = page.getByTestId('sketch-canvas');
  if (isMobile) {
    // телефон: полей у урока нет — и черновика нет
    await expect(canvas).toHaveCount(0);
    await expect(page.getByTestId('sketch-dock')).toHaveCount(0);
    return;
  }
  const lesson = page.getByTestId('lesson');
  const toggle = page.getByTestId('sketch-toggle');
  // непрозрачность холста в точке окна: есть ли там чернила
  const inkAt = (x, y) => page.evaluate(([px, py]) => {
    const c = document.querySelector('[data-testid=sketch-canvas]');
    const k = c.width / c.getBoundingClientRect().width;
    return c.getContext('2d').getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data[3];
  }, [x, y]);
  const draw = async (pts) => {
    await page.mouse.move(...pts[0]); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 8 });
    await page.mouse.up();
  };
  // режим выключен: обычный курсор, поле не рисует; кнопка «Черновик» и подсказка «Новое»
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('sketch-callout')).toBeVisible();
  await expect(lesson).not.toHaveAttribute('data-sketch', /./);
  await draw([[80, 300], [240, 300]]);
  await expect(canvas).toHaveAttribute('data-strokes', '0');
  // включили: сетка на полях, курсор-ручка, выбор запомнен на устройстве
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('sketch-callout')).toHaveCount(0);
  await expect(page.getByTestId('sketch-grid')).toHaveClass(/on/);
  await expect(lesson).toHaveAttribute('data-sketch', 'pen');
  expect(await page.evaluate(() => localStorage.getItem('ems-sketch-on'))).toBe('1');
  // левое поле: линия ручкой
  await draw([[80, 300], [240, 300]]);
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  expect(await inkAt(160, 300)).toBeGreaterThan(200);
  expect(await inkAt(160, 330)).toBe(0);
  // протянуть мышью по тексту урока — не рисует: это урок, а не поле
  const card = await page.getByTestId('lesson-card').boundingBox();
  await draw([[card.x + 40, card.y + 60], [card.x + 200, card.y + 60]]);
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  // маркер цвета юнита, толстый: полупрозрачная полоса
  await page.getByTestId('sketch-marker').click();
  await page.getByTestId('sketch-color-unit').click();
  await page.getByTestId('sketch-size-l').click();
  await expect(page.getByTestId('sketch-marker')).toHaveAttribute('aria-pressed', 'true');
  await expect(lesson).toHaveAttribute('data-sketch', 'marker');
  await draw([[80, 420], [240, 420]]);
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  const marker = await inkAt(160, 420);
  expect(marker).toBeGreaterThan(40);
  expect(marker).toBeLessThan(160);
  // ластик поперёк линии ручки; у ластика цветов нет — только толщина
  await page.getByTestId('sketch-eraser').click();
  await expect(page.getByTestId('sketch-color-ink')).toHaveCount(0);
  await draw([[160, 260], [160, 340]]);
  await expect(canvas).toHaveAttribute('data-strokes', '3');
  expect(await inkAt(160, 300)).toBe(0);
  expect(await inkAt(100, 300)).toBeGreaterThan(200);
  // «Отменить» и Ctrl+Z убирают последний штрих: линия снова целая, потом нет и маркера
  await page.getByTestId('sketch-undo').click();
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  expect(await inkAt(160, 300)).toBeGreaterThan(200);
  await page.keyboard.press('Control+z');
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  expect(await inkAt(160, 420)).toBe(0);
  // Ctrl+Y и «Повторить» возвращают отменённое по одному штриху; новый штрих стирает очередь повтора
  await page.keyboard.press('Control+y');
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  expect(await inkAt(160, 420)).toBeGreaterThan(40);
  await page.getByTestId('sketch-redo').click();
  await expect(canvas).toHaveAttribute('data-strokes', '3');
  await expect(page.getByTestId('sketch-redo')).toBeDisabled();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  // «Стереть всё» — холст чист, «Вернуть» возвращает стёртое
  await page.getByTestId('sketch-clear').click();
  await expect(canvas).toHaveAttribute('data-strokes', '0');
  expect(await inkAt(160, 300)).toBe(0);
  await page.getByTestId('sketch-restore').click();
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  expect(await inkAt(160, 300)).toBeGreaterThan(200);
  // выключили: записи видны, но поле больше не рисует и курсор обычный
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(lesson).not.toHaveAttribute('data-sketch', /./);
  await draw([[80, 500], [240, 500]]);
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  expect(await inkAt(160, 300)).toBeGreaterThan(200);
  expect(await page.evaluate(() => localStorage.getItem('ems-sketch-on'))).toBe(null);
  // урок идёт как обычно, черновик остаётся до конца урока
  await page.getByRole('button', { name: 'Понятно' }).click();
  await expect(page.getByTestId('ex')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  expect(errors).toEqual([]);
});

test('копилка: график вклада — подписи не налезают друг на друга, «сейчас» — плашкой над графиком, пополнения — ступеньками', async ({ page }) => {
  await withTestFlag(page);
  const D = 86400000;
  for (const [days, adds] of [[1, []], [5, []], [6, [[2, 60], [4, 300]]]]) {
    await page.addInitScript(({ days, adds, D }) => {
      const at = Date.now() - days * D - 3600000;
      const learn = { lessons: { 'sc-i1': { at: Date.now() - D, runs: 1, best: 90 } }, coins: { '2026-01-01': 900 }, piggy: { [at]: 100 } };
      if (adds.length) { learn.piggyTop = { [at]: 1 }; learn.piggyAdd = Object.fromEntries(adds.map(([d, n]) => [at + d * D, `${at}:${n}`])); }
      localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn }));
    }, { days, adds, D });
    await openApp(page, '/', '{}', { tab: 'shop' });
    await shopTab(page, 'useful');
    const chart = page.getByTestId('shop-piggy').getByTestId('piggy-chart');
    await expect(chart).toBeVisible();
    await expect(chart.getByTestId('piggy-now')).toHaveCount(1);
    // подписи графика попарно не пересекаются
    const boxes = await chart.evaluate((svg) => [...svg.querySelectorAll('text')].map((t) => { const r = t.getBoundingClientRect(); return { t: t.textContent, l: r.left, r: r.right, top: r.top, b: r.bottom }; }));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]; const b = boxes[j];
        const cross = a.l < b.r - 1 && b.l < a.r - 1 && a.top < b.b - 1 && b.top < a.b - 1;
        expect(cross, `«${a.t}» налезает на «${b.t}» (день ${days})`).toBe(false);
      }
    }
    if (adds.length) await expect(chart.getByTestId('piggy-step')).toHaveText(['+60', '+300']);
  }
});

test('новости: выпуск раскрывается и сворачивается плавно, после «Свернуть» — снова на экране и не прозрачный; на ПК поля ленты — черновик', async ({ page, isMobile }) => {
  await withTestFlag(page);
  // ученик с первого дня раньше выпусков — свежие выпуски с плашкой «Новое»
  await page.addInitScript(() => {
    if (!localStorage.getItem('ems-textbook-v1')) localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { done: { '2026-09-20': 1 }, xp: { '2026-09-20': 10 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await openTab(page, 'news');
  const issue = page.locator('[data-testid=news-issue][data-new=true]').first();
  await expect(issue).toBeVisible();
  // высота — по вёрстке: карточка ещё может доигрывать появление с лёгким масштабом
  const short = await issue.evaluate((el) => el.offsetHeight);
  await issue.getByTestId('news-more').click();
  await expect(issue).toHaveAttribute('data-open', 'true');
  await expect.poll(() => issue.evaluate((el) => el.offsetHeight)).toBeGreaterThan(short + 100);
  await issue.getByTestId('news-more').scrollIntoViewIfNeeded();
  await issue.getByTestId('news-more').click();
  await expect(issue).toHaveAttribute('data-open', 'false');
  // свернулся — снова короткий, его начало на экране; прозрачности и висящих анимаций появления нет
  await expect.poll(() => issue.evaluate((el) => el.offsetHeight)).toBe(short);
  await expect.poll(() => issue.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  const look = await issue.evaluate((el) => ({
    opacity: [el, ...el.querySelectorAll('*')].map((e) => Number(getComputedStyle(e).opacity)).filter((o) => o < 0.9).length,
    held: el.getAnimations({ subtree: true }).filter((a) => a.playState === 'finished').length,
  }));
  expect(look).toEqual({ opacity: 0, held: 0 });
  if (!isMobile) {
    // поля по бокам ленты — черновик: включить, провести линию слева
    const canvas = page.getByTestId('sketch-canvas');
    await page.getByTestId('sketch-toggle').click();
    await expect(page.getByTestId('sketch-toggle')).toHaveAttribute('aria-checked', 'true');
    await page.mouse.move(80, 300); await page.mouse.down(); await page.mouse.move(260, 320, { steps: 10 }); await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-strokes', '1');
    // кнопки ленты работают как раньше
    await page.getByTestId('news-more').first().click();
    await expect(page.getByTestId('news-issue').first()).toHaveAttribute('data-open', 'true');
    await expect(canvas).toHaveAttribute('data-strokes', '1');
  } else {
    await expect(page.getByTestId('sketch-canvas')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

// учебник на широком ПК: поля по бокам от учебника — черновик; сам учебник не рисуется (отчёт mvfapopm)
test('учебник на широком ПК: черновик на полях, учебник не закрывает', async ({ page, isMobile }) => {
  test.skip(isMobile, 'черновик — только с мышью на широком экране');
  await withTestFlag(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await openTab(page, 'book');
  // 1440 px: учебник занимает почти всю ширину — полей для записей нет
  await expect(page.getByTestId('sketch-dock')).toHaveCount(0);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.getByTestId('textbook').getByRole('button', { name: /Инфляция/ }).first().click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'inflation');
  const canvas = page.getByTestId('sketch-canvas');
  await page.getByTestId('sketch-toggle').click();
  await expect(page.getByTestId('sketch-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(280, 340, { steps: 10 }); await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-strokes', '1');
  // справа от учебника — тоже поле
  await page.mouse.move(1700, 400); await page.mouse.down(); await page.mouse.move(1820, 460, { steps: 8 }); await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  // по тексту главы — не рисует: учебник работает как обычно
  const main = page.locator('.tb-ch-main');
  const box = await main.boundingBox();
  await page.mouse.move(box.x + 200, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 400, box.y + 80, { steps: 8 }); await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  // в режиме рисования оглавление сбоку плавно уходит — места для записей больше
  await expect(page.getByTestId('tb-side-toc')).toBeHidden();
  // черновик выключили — оглавление вернулось и работает: нажатие открывает главу, записи на полях целы
  await page.getByTestId('sketch-toggle').click();
  await expect(page.getByTestId('sketch-toggle')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('tb-side-toc')).toBeVisible();
  await page.getByTestId('tb-side-toc').getByRole('button', { name: /Деньги и банки/ }).click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'money-banks');
  await expect(canvas).toHaveAttribute('data-strokes', '2');
  expect(errors).toEqual([]);
});

test('церемонии: юнит пройден — «Новая марка», «Марка месяца» и «Новая печать» по очереди; показанное не повторяется', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    localStorage.setItem('ems-celebrate-test', '1');
    if (localStorage.getItem('ems-textbook-v1')) return;
    // юнит 1 пройден час назад, печать «Место на карте» и марка этого месяца — ещё не праздновали
    localStorage.setItem('ems-celebrated', '{}');
    const at = Date.now() - 3600000; const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])), claimed: { 'a:unit': at, [`m:${ym}`]: at } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const scene = page.getByTestId('celebrate');
  // почтовая марка юнита со зданием; касание по сцене — сразу финал
  await expect(scene).toHaveAttribute('aria-label', 'Новая марка в альбоме: Мастерская');
  await expect(scene.getByTestId('celebrate-stamp')).toBeVisible();
  await expect(scene.getByTestId('celebrate-stamp').getByTestId('engraving')).toHaveAttribute('data-alive', 'true');
  await scene.click({ position: { x: 8, y: 8 } });
  await expect(scene.getByTestId('celebrate-done')).toBeVisible();
  await scene.getByTestId('celebrate-done').click();
  // марка месяца — с монетами испытания
  await expect(scene).toHaveAttribute('aria-label', /^Марка месяца: /);
  await expect(scene.getByTestId('celebrate-coins')).toHaveAttribute('data-value', '100');
  await scene.getByTestId('celebrate-done').click();
  // печать — сургуч и знак; Enter — «Дальше»
  await expect(scene).toHaveAttribute('aria-label', 'Новая печать: Место на карте');
  await expect(scene.getByTestId('celebrate-seal')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(scene).toHaveCount(0);
  await expect(page.getByTestId('path')).toBeVisible();
  // перезагрузка — показанное не повторяется
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('path')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('celebrate')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('церемонии: первое открытие не празднует уже полученное; печать за первую покупку — сценой сразу, «Все печати» ведёт в профиль', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    localStorage.setItem('ems-celebrate-test', '1');
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 3600000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 } }, claimed: { 'a:first': at }, coins: { '2026-01-01': 500 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await expect(page.getByTestId('path')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('celebrate')).toHaveCount(0);
  // покупка в лавке выдаёт печать «Первая покупка» — сцена сразу
  await openTab(page, 'shop');
  await page.getByTestId('shop-showcase').getByTestId('shop-item').getByRole('button', { name: 'Купить' }).first().click();
  const scene = page.getByTestId('celebrate');
  await expect(scene).toHaveAttribute('aria-label', 'Новая печать: Первая покупка');
  await scene.click({ position: { x: 8, y: 8 } });
  await scene.getByTestId('celebrate-go').click();
  // та же покупка выдала и «Пятьсот монет» (заработано 500) — следующая сцена, уже над профилем; Esc — закрыть
  await expect(scene).toHaveAttribute('aria-label', 'Новая печать: Пятьсот монет');
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
  await expect(page.getByTestId('learn-profile')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ПК от 1024 px: Путь в две колонки, у главы учебника оглавление сбоку', async ({ page, isMobile }) => {
  await withTestFlag(page);
  // юнит 1 пройден — на Пути «Рынок» с живой моделью
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (isMobile) {
    // телефон: одна колонка, карточка «Задания» наверху Пути, живая модель — под своим юнитом
    await expect(path).toHaveAttribute('data-layout', 'column');
    await expect(page.getByTestId('path-side')).toHaveCount(0);
    await expect(path.getByTestId('tasks-card')).toBeVisible();
  } else {
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(path).toHaveAttribute('data-layout', 'columns');
      const side = page.getByTestId('path-side');
      // справа: задания (карточка и задания дня) и живая модель юнита на экране — ровно одна на Пути
      await expect(side.getByTestId('tasks-card')).toBeVisible();
      await expect(side.getByTestId('side-quests').getByTestId('quest')).toHaveCount(3);
      await expect(side.getByTestId('unit-model')).toHaveCount(1);
      await expect(path.getByTestId('unit-model')).toHaveCount(1);
      await expect(path.getByTestId('tasks-card')).toHaveCount(1);
      // колонки рядом: правая начинается правее левой и не уезжает вбок
      const main = await path.locator('.ln-path-main').boundingBox();
      const box = await side.boundingBox();
      expect(box.x).toBeGreaterThan(main.x + main.width - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await noScroll()).toBe(true);
    }
    // живая модель на ПК сворачивается в строку и разворачивается обратно; выбор запоминается
    const side = page.getByTestId('path-side');
    await side.getByTestId('model-fold-close').click();
    await expect(side.getByTestId('unit-model')).toHaveCount(0);
    await expect(side.getByTestId('model-fold')).toBeVisible();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('path-side').getByTestId('model-fold')).toBeVisible();
    await page.getByTestId('path-side').getByTestId('model-fold').click();
    await expect(page.getByTestId('path-side').getByTestId('unit-model')).toHaveCount(1);
    // уже 1024 — одна колонка
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect(path).toHaveAttribute('data-layout', 'column');
    await expect(page.getByTestId('path-side')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  // учебник: у главы сбоку оглавление всех глав, открытая отмечена; переход — по клику
  await openTab(page, 'book');
  await page.getByTestId('textbook').getByRole('button', { name: /Спрос и предложение/ }).click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'supply-demand');
  const toc = page.getByTestId('tb-side-toc');
  if (isMobile) {
    await expect(toc).toHaveCount(0);
  } else {
    await expect(toc).toBeVisible();
    await expect(toc.locator('[aria-current="page"]')).toContainText('Спрос и предложение');
    const tb = await toc.boundingBox();
    const body = await page.locator('.tb-ch-main').boundingBox();
    expect(tb.x + tb.width).toBeLessThanOrEqual(body.x);
    await toc.getByRole('button', { name: /Эластичность/ }).click();
    await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'elasticity');
    await expect(toc.locator('[aria-current="page"]')).toContainText('Эластичность');
    expect(await noScroll()).toBe(true);
    // крупный текст: боковая панель не уходит за низ экрана, «В этой главе» докручивается до конца
    const plus = page.getByRole('button', { name: 'Крупнее текст' });
    while (await plus.isEnabled()) await plus.click();
    const aside = page.locator('.tb-ch-aside');
    // страницу прокрутили вниз — панель закреплена у верха и целиком на экране
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(200);
    await aside.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const last = page.getByTestId('tb-sections').locator('li').last();
    await expect(last).toBeInViewport();
    const ab = await aside.boundingBox();
    expect(ab.y + ab.height).toBeLessThanOrEqual(900 + 1);
  }
  expect(errors).toEqual([]);
});

test('«Мир» на компонентах дизайн-системы: тот же знак, шрифт и кнопки, что в обучении', async ({ page }) => {
  // приветствие (до входа) и «Мир» — один знак рядом с одним начертанием названия
  const brandOf = (loc) => loc.evaluate((el) => ({ font: getComputedStyle(el).fontFamily, mark: !!(el.querySelector('svg') || (el.parentElement && el.parentElement.parentElement && el.parentElement.parentElement.querySelector('svg[aria-hidden="true"]'))) }));
  const { errors } = await openApp(page, '/', '{}', { tab: 'world' });
  const world = page.getByTestId('world');
  await expect(world).toHaveAttribute('data-ds-theme', 'world');
  const w = await brandOf(world.getByTestId('brand'));
  expect(w.mark).toBe(true);
  // заголовки — PT Sans (docs/world.md, «Один облик»)
  expect(w.font).toContain('PT Sans');
  // кнопки меню — из ds.jsx; старая игровая кнопка осталась только у общего регулятора звука
  const old = await world.locator('button.ems-btn').count();
  expect(old).toBeLessThanOrEqual(1);
  expect(await world.locator('.ds-btn, .ds-card, .ds-chip').count()).toBeGreaterThan(4);
  // «Мир» по умолчанию светлый; основная кнопка на тёмном золоте — белый текст, читается
  await expect(world).not.toHaveClass(/ds-dark/);
  const daily = world.getByTestId('daily-card');
  if (await daily.count()) {
    const c = await daily.locator('.ds-btn').first().evaluate((el) => getComputedStyle(el).color);
    expect(c).toBe('rgb(255, 255, 255)');
  }
  // приветствие — тот же знак и шрифт
  const p2 = await page.context().newPage();
  await p2.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await p2.addInitScript(() => { try { localStorage.removeItem('ems-account'); } catch { /* нет хранилища */ } });
  await p2.goto('/', { waitUntil: 'networkidle' });
  const b = await brandOf(p2.getByTestId('welcome').getByTestId('brand'));
  expect(b.mark).toBe(true);
  expect(b.font).toBe(w.font);
  await p2.close();
  expect(errors).toEqual([]);
});

test('первый экран партии: компас ставки, Тейлор, IS-LM и риски — с 4-го квартала', async ({ page, isMobile }) => {
  test.skip(isMobile, 'рычаги на телефоне в отдельной вкладке — логика та же');
  const { errors } = await openApp(page);
  await startSoloGame(page);
  // 1-й квартал, на Пути уровня «Средний» нет: продвинутых панелей нет, вместо компаса — одна строка
  await expect(page.getByTestId('advanced-later')).toContainText('с 4-го квартала');
  await expect(page.getByTestId('rate-compass')).toHaveCount(0);
  await expect(page.getByTestId('summary-risks')).toHaveCount(0);
  await expect(page.getByTestId('book-link').filter({ hasText: 'IS-LM' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Риски', exact: true })).toHaveCount(0);
  await expect(page.getByText('Ставка по правилу Тейлора')).toHaveCount(0);
  // три квартала спустя — 4-й квартал: всё на месте
  const finish = page.getByRole('button', { name: 'Завершить квартал и применить решения' });
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  for (let q = 0; q < 3; q += 1) {
    await finish.click();
    // газета может открыться сама — закрываем, чтобы не заслоняла рычаги
    await close.waitFor({ state: 'visible', timeout: 2500 }).then(() => close.click()).catch(() => {});
    await expect(finish).toBeEnabled();
  }
  await expect(page.getByTestId('rate-compass')).toBeVisible();
  await expect(page.getByTestId('summary-risks')).toBeVisible();
  await expect(page.getByTestId('advanced-later')).toHaveCount(0);
  await expect(page.getByTestId('book-link').filter({ hasText: 'IS-LM' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('антистресс: после четырёх уроков — знакомство, каналы и меню, растягивание, кружок, любой угол; скрыть и вернуть в настройках', async ({ page, isMobile }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    localStorage.setItem('ems-antistress-test', '1');
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(['sc-i1', 'sc-l1', 'sc-l2'].map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const box = page.getByTestId('antistress');
  const exit = async () => {
    await page.getByRole('button', { name: 'Выйти из урока' }).click();
    await expect(page.getByTestId('lesson')).toHaveCount(0);
  };
  // три урока — окошка ещё нет
  await startLesson(page, 'sc-l1');
  await page.waitForTimeout(900);
  await expect(box).toHaveCount(0);
  await exit();
  // четвёртый пройден (середина первого юнита) — в следующем уроке окошко и знакомство
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    s.learn.lessons['sc-i2'] = { at: Date.now() - 3600000, runs: 1, best: 90 };
    localStorage.setItem('ems-textbook-v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await startLesson(page, 'sc-l3');
  if (isMobile) {
    // телефон: полей у урока нет — и окошка нет
    await page.waitForTimeout(900);
    await expect(box).toHaveCount(0);
    expect(errors).toEqual([]);
    return;
  }
  const intro = page.getByTestId('antistress-intro');
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('Антистресс');
  await expect(intro).not.toContainText(/фокус|стрим/i);
  await expect(box).toHaveAttribute('data-corner', 'br');
  await expect(box).toHaveAttribute('data-channel', 'ring');
  // окошко — на поле справа от урока, не на нём
  const col = await page.getByTestId('lesson').locator('.ln-body > .ln-inner').boundingBox();
  const vp = page.viewportSize();
  const b0 = await box.boundingBox();
  expect(b0.x).toBeGreaterThan(col.x + col.width);
  expect(b0.x + b0.width).toBeLessThanOrEqual(vp.width - 8);
  expect(b0.y + b0.height).toBeLessThanOrEqual(vp.height - 8);
  // Enter закрывает знакомство и не уходит уроку; второй раз его нет
  await page.keyboard.press('Enter');
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ems-antistress-intro'))).toBe('1');
  // канал живой: кадр за кадром картинка меняется
  const frame = () => page.getByTestId('antistress-canvas').evaluate((c) => c.toDataURL());
  const before = await frame();
  await expect.poll(frame).not.toBe(before);
  // стрелки — по кругу; название открывает меню всех каналов
  await page.getByTestId('antistress-next').click();
  await expect(box).toHaveAttribute('data-channel', 'rings');
  await expect(page.getByTestId('antistress-name')).toHaveText('Сквозь кольца');
  await page.getByTestId('antistress-name').click();
  const menu = page.getByTestId('antistress-menu');
  await expect(menu.getByTestId('antistress-pick')).toHaveCount(10);
  await menu.locator('[data-channel="sand"]').click();
  await expect(menu).toHaveCount(0);
  await expect(box).toHaveAttribute('data-channel', 'sand');
  // песок: зажали мышь на экране — сыплется оттуда, окошко при этом не едет
  const canvas = page.getByTestId('antistress-canvas');
  const cb = await canvas.boundingBox();
  // самая яркая точка около мыши: тёмный фон — около 120, песчинка — больше 300
  const sandAt = () => canvas.evaluate((c) => {
    const s = Math.round(c.width / 232 * 8); const d = c.getContext('2d').getImageData(Math.round(c.width * 0.2) - s, Math.round(c.height * 0.25) - s, 2 * s, 2 * s).data;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) max = Math.max(max, d[i] + d[i + 1] + d[i + 2]);
    return max;
  });
  expect(await sandAt()).toBeLessThan(250);
  await page.mouse.move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.25);
  await page.mouse.down();
  await expect.poll(sandAt).toBeGreaterThan(300);
  await expect(box).toHaveAttribute('data-player', 'you');
  await page.mouse.up();
  await expect(box).toHaveAttribute('data-corner', 'br');
  // поп-ит: сам себя не жмёт первые секунды; пупырку в середине нажали — она ваша
  await page.getByTestId('antistress-next').click();
  await expect(box).toHaveAttribute('data-channel', 'pop');
  await expect(box).toHaveAttribute('data-player', 'bot');
  await page.mouse.click(cb.x + cb.width / 2, cb.y + (cb.height / 164) * 83);
  await expect(box).toHaveAttribute('data-player', 'you');
  // змейка: играет бот, кнопка — и змейка ваша, урок стрелку не получает
  await page.getByTestId('antistress-next').click();
  await page.getByTestId('antistress-next').click();
  await expect(box).toHaveAttribute('data-channel', 'snake');
  await expect(box).toHaveAttribute('data-player', 'bot');
  await box.hover();
  await page.getByTestId('antistress-pad-up').click();
  await expect(box).toHaveAttribute('data-player', 'you');
  // тетрис — тоже можно перехватить, и буквами WASD (здесь A — влево)
  await page.getByTestId('antistress-prev').click();
  await expect(box).toHaveAttribute('data-channel', 'tetris');
  await box.hover();
  await page.keyboard.press('a');
  await expect(box).toHaveAttribute('data-player', 'you');
  // пауза и снова
  await page.getByTestId('antistress-play').click();
  await expect(box).toHaveAttribute('data-playing', 'false');
  await page.getByTestId('antistress-play').click();
  await expect(box).toHaveAttribute('data-playing', 'true');
  // растянуть за внутренний уголок: окошко растёт к уроку, прижатый угол стоит, на урок не заходит
  const grip = await page.getByTestId('antistress-grip').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 400, grip.y - 400, { steps: 8 });
  await page.mouse.up();
  const b1 = await box.boundingBox();
  expect(b1.width).toBeGreaterThan(b0.width * 1.15);
  expect(Math.round(b1.x + b1.width)).toBe(Math.round(b0.x + b0.width));
  expect(b1.x).toBeGreaterThan(col.x + col.width);
  expect(b1.height).toBeLessThanOrEqual(vp.height * 0.62 + 1);
  expect(Number(await page.evaluate(() => localStorage.getItem('ems-antistress-size')))).toBeGreaterThan(1.1);
  // ○ — живой кружок; нажатие разворачивает в прежнем размере
  await page.getByTestId('antistress-min').click();
  await expect(box).toHaveAttribute('data-min', 'true');
  await expect.poll(async () => (await box.boundingBox()).width).toBeLessThan(70);
  await page.getByTestId('antistress-expand').click();
  await expect(box).toHaveAttribute('data-min', 'false');
  await expect.poll(async () => Math.round((await box.boundingBox()).width)).toBe(Math.round(b1.width));
  // перетащили за название — окошко встаёт в ближайший угол и помнит его, меню не открылось; черновик при этом не рисует
  const b = await box.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 18);
  await page.mouse.down();
  await page.mouse.move(300, 200, { steps: 10 });
  await page.mouse.up();
  await expect(box).toHaveAttribute('data-corner', 'tl');
  await expect(page.getByTestId('antistress-menu')).toHaveCount(0);
  await expect.poll(async () => Math.round((await box.boundingBox()).x)).toBe(16);
  expect(await page.evaluate(() => localStorage.getItem('ems-antistress-corner'))).toBe('tl');
  await expect(page.getByTestId('sketch-canvas')).toHaveAttribute('data-strokes', '0');
  // × — скрыт, «Вернуть» — на месте
  await page.getByTestId('antistress-hide').click();
  await expect(box).toHaveCount(0);
  await expect(page.getByTestId('antistress-snack')).toContainText('вернуть можно в настройках');
  await page.getByTestId('antistress-restore').click();
  await expect(box).toHaveAttribute('data-channel', 'tetris');
  await page.getByTestId('antistress-hide').click();
  await expect(page.getByTestId('antistress-snack')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ems-antistress'))).toBe('off');
  await exit();
  // скрыт — в уроке его нет; включили в настройках — снова есть, без знакомства, в своём углу
  await openTab(page, 'profile');
  await page.getByTestId('prof-settings-open').click();
  const toggle = page.getByTestId('prof-antistress');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings').locator('[data-nav="back"]').click();
  await openTab(page, 'path');
  await startLesson(page, 'sc-l3');
  await expect(box).toBeVisible();
  await expect(box).toHaveAttribute('data-corner', 'tl');
  await page.waitForTimeout(900);
  await expect(intro).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* ------------------------------ ВЫПУСК 25 ОКТЯБРЯ ------------------------------ */
test('урок: назад ровно на одну карточку — прошлое задание с ответом и разбором, дальше назад нельзя', async ({ page }) => {
  await withTestFlag(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await startLesson(page, 'sc-i1');
  // на первом шаге назад некуда
  await expect(page.getByTestId('lesson-back')).toHaveCount(0);
  await page.getByTestId('lesson').locator('.ln-foot button').last().click();
  // со второго экрана — назад к прошлой карточке
  await expect(page.getByTestId('lesson-back')).toBeVisible();
  await answerExercise(page);
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await page.getByTestId('lesson-back').click();
  const peek = page.getByTestId('lesson-peek');
  await expect(peek).toHaveAttribute('data-type', 'ex');
  await expect(page.getByTestId('lesson-peek-verdict')).toContainText('Вы ответили верно');
  // назад — касанием отрезка полосы прогресса перед текущим, без отдельной кнопки-стрелки в шапке
  expect(await page.getByTestId('lesson').locator('.ln-head [data-testid=lesson-progress]').count()).toBe(1);
  // на прошлой карточке есть флажок «Сообщить об ошибке»: нажали «Дальше» на автомате — вернулись и пожаловались
  await peek.getByRole('button', { name: 'Сообщить об ошибке' }).click();
  await expect(page.getByTestId('report-sheet')).toBeVisible();
  await page.getByTestId('report-sheet-back').click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('report-sheet')).toHaveCount(0);
  // пока смотрим назад, второго шага назад нет
  await expect(page.getByTestId('lesson-back')).toHaveCount(0);
  await page.getByTestId('lesson-peek-return').click();
  await expect(peek).toHaveCount(0);
  await expect(page.getByTestId('lesson-back')).toBeVisible();
  expect(errors).toEqual([]);
});

test('уведомления: смахнуть в сторону — прочитано, ещё раз из «Ранее» — убрано; текст не выделяется', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T16:00:00'));
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 3 * 86400000;
    const ids = ['sc-inside', 'sc-oc', 'sc-hours', 'sc-ppf-cost', 'sc-terms', 'sc-gains'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({
      problems: Object.fromEntries(ids.map((id) => [id, { tries: 1, ok: true, box: 1, due: Date.now() - 1000, lastAt: at }])),
      learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 } }, done: { [new Date(at).toISOString().slice(0, 10)]: 1 } },
    }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await page.getByTestId('bell').first().click();
  const note = page.locator('[data-testid=notifications] [data-id^="book-review:"]');
  await expect(note).toHaveAttribute('data-unread', 'true');
  await expect(page.getByTestId('notify-swipe-hint')).toBeVisible();
  const swipeLeft = async (el) => {
    const box = await el.boundingBox();
    const y = box.y + box.height / 2;
    if (isMobile) {
      // пальцем: касание — тоже указатель
      await el.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: box.x + box.width / 2, clientY: y, isPrimary: true, button: 0 });
      for (let k = 1; k <= 8; k += 1) await el.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: box.x + box.width / 2 - k * 25, clientY: y, isPrimary: true });
      await el.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: box.x + box.width / 2 - 200, clientY: y, isPrimary: true });
    } else {
      await page.mouse.move(box.x + box.width / 2, y); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 200, y, { steps: 10 });
      // тянем мышью — текст уведомления не выделяется
      expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
      await page.mouse.up();
    }
  };
  await swipeLeft(note);
  // смахнутое — в «Ранее», непрочитанных больше нет; вкладка не сменилась
  await expect(page.locator('[data-testid=notifications] [data-id^="book-review:"][data-unread="true"]')).toHaveCount(0);
  const read = page.locator('[data-testid=notifications] [data-id^="book-review:"][data-unread="false"]');
  await expect(read).toHaveCount(1);
  await expect(page.getByTestId('review')).toHaveCount(0);
  // смахнули прочитанное в «Ранее» — оно уходит из списка, без пустого места; и не возвращается
  await swipeLeft(read);
  await expect(page.locator('[data-testid=notifications] [data-id^="book-review:"]')).toHaveCount(0);
  await page.getByTestId('notifications').locator('[data-nav="back"]').click();
  await page.getByTestId('bell').first().click();
  await expect(page.getByTestId('notifications')).toBeVisible();
  await expect(page.locator('[data-testid=notifications] [data-id^="book-review:"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('лига: до первого урока ученика в лиге нет — так и написано', async ({ page }) => {
  const { errors } = await openApp(page, '/', '{}', { tab: 'league' });
  const goal = page.getByTestId('league-goal');
  await expect(goal).toHaveAttribute('data-kind', 'first');
  await expect(goal).toContainText('Лига — после первого урока');
  await page.getByTestId('league-rules-toggle').click();
  await expect(page.getByTestId('league-rules')).toContainText('после первого урока');
  await expect(page.getByTestId('league-utc')).toContainText('всемирное');
  expect(errors).toEqual([]);
});

test('Путь: наверху — уровень в курсе числом условных единиц и шкала курса по уровням', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const grade = page.getByTestId('course-level');
  await expect(grade).toHaveAttribute('data-done', '4');
  /* 4 урока из 14 юнита «Мастерская» на 90%. Начальный уровень (100 ед.) — «Мастерская» и будущий «Рынок
     труда», по 50 ед.: 4 × 50/14 × 0,97 ≈ 14 ед. — числом, без ступеней A1…C2 */
  await expect(grade).toHaveAttribute('data-points', '14');
  await expect(page.getByTestId('course-points')).toHaveText('14');
  await expect(grade).toContainText('Ваш уровень в курсе экономики');
  await expect(grade).toContainText('4 из 104 уроков');
  await expect(page.getByTestId('course-next')).toHaveText('Начальный уровень курса: 14 из 100 ед.');
  await expect(grade.locator('.ln-scale-seg')).toHaveCount(5);
  await expect(grade.locator('.ln-scale-seg.on')).toHaveText('1');
  await expect(grade).not.toContainText(/\b[ABC][12]\b/);
  await expect(page.getByTestId('wallet-balance')).toHaveCount(0);
  // на узком телефоне подписи не вылезают за рамку
  // текст для чтения с экрана обрезан нарочно — его не считаем
  const over = await grade.evaluate((el) => [...el.querySelectorAll('*')].filter((x) => !x.classList.contains('ds-sr') && x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== 'visible').length);
  expect(over).toBe(0);
  const gb = await grade.boundingBox(); const vw = page.viewportSize().width;
  expect(gb.x + gb.width).toBeLessThanOrEqual(vw);
  expect(errors).toEqual([]);
});

test('живая модель: знакомство — карточка «Новое» на Пути, «Открыть модель», больше не показывается', async ({ page, isMobile }) => {
  // на ПК модель и так открыта в боковой колонке — знакомство нужно телефону
  test.skip(!isMobile, 'на ПК модель открыта сбоку');
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = await showUnit(page, 'supply-demand');
  const intro = page.getByTestId('model-intro').first();
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('Рынок, который можно покрутить');
  await intro.getByTestId('model-intro-open').click();
  await expect(page.getByTestId('model-open').first()).toBeVisible();
  await expect(page.getByTestId('model-intro')).toHaveCount(0);
  await gotoApp(page, '/', 'path');
  await showUnit(page, 'supply-demand');
  await expect(page.getByTestId('model-intro')).toHaveCount(0);
  await expect(unit.getByTestId('model-fold').or(page.getByTestId('path-side').getByTestId('model-fold')).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('ник: грубый — окно «Смените ник» со сроком; срок вышел — экран блокировки, смена ника открывает аккаунт', async ({ page }) => {
  // сервер отвечает по «фазе»: сначала срок на смену идёт, потом вышел; смена ника снимает всё
  let phase = 'rename';
  const profile = (extra) => JSON.stringify({ profile: { login: 'tester', name: 'Грубиян', emblem: 'star', kidsMode: false, nameNextAt: 0, ...extra } });
  const { errors } = await openApp(page, '/', (req) => {
    const body = JSON.parse(req.postData() || '{}');
    if (body.action === 'update') { phase = 'ok'; return profile({ name: body.name, renameBy: null, blocked: false }); }
    if (body.action === 'me') {
      if (phase === 'rename') return profile({ renameBy: Date.now() + 3 * 86400000, blocked: false });
      if (phase === 'blocked') return profile({ renameBy: Date.now() - 1000, blocked: true });
      return profile({ name: 'Тимур', renameBy: null, blocked: false });
    }
    return '{}';
  }, { tab: 'path' });
  const ask = page.getByTestId('name-rename');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('нарушает правила');
  await expect(ask).toContainText('иначе аккаунт будет заблокирован');
  // «Позже» — до следующего запуска; уведомление в колокольчике остаётся
  await ask.getByRole('button', { name: 'Позже' }).click();
  await expect(ask).toHaveCount(0);
  await page.getByTestId('bell').first().click();
  const note = page.locator('[data-testid=notifications] [data-id^="rename:"]');
  await expect(note).toContainText('Смените ник');
  await note.click();
  await expect(ask).toBeVisible();
  await page.getByLabel('Новый ник').fill('Тимур');
  await page.getByTestId('rename-save').click();
  await expect(ask).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ems-account')).renameBy)).toBe(null);
  // срок вышел (сервер ответил «заблокирован»): закрыть нельзя, только сменить ник или выйти
  phase = 'blocked';
  await page.evaluate(() => window.dispatchEvent(new Event('ems-blocked')));
  const blocked = page.getByTestId('name-blocked');
  await expect(blocked).toContainText('Аккаунт заблокирован');
  await expect(blocked.getByRole('button', { name: 'Позже' })).toHaveCount(0);
  await expect(blocked.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await page.getByLabel('Новый ник').fill('Тимур');
  await page.getByTestId('rename-save').click();
  await expect(blocked).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('учебник из гайда юнита: черновик на полях есть и там', async ({ page, isMobile }) => {
  test.skip(isMobile, 'черновик в учебнике — на широком экране с мышью');
  await page.setViewportSize({ width: 1600, height: 950 });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await page.getByTestId('unit-guide').first().click();
  await expect(page.locator('.ln-book .ln-textbook')).toBeVisible();
  await expect(page.getByTestId('sketch-toggle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('«Чтение» — урок на дороге юнита: после урока перед ним; цитаты, «найдите в цитате», полка и опыт один раз', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-w', 'sc-l4', 'sc-l5'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const card = page.locator('[data-testid=path-extra][data-extra="read"]');
  await expect(card).toHaveAttribute('data-id', 'read-choice');
  await expect(card).toHaveAttribute('data-state', 'open');
  // «Персоналии» юнита — тоже остановка дороги, открыта после второго урока
  await expect(page.locator('[data-testid=path-extra][data-extra="people"]')).toHaveAttribute('data-state', 'open');
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const reading = page.getByTestId('reading');
  await expect(reading).toBeVisible();
  for (let k = 1; k <= 3; k += 1) {
    const p = reading.getByTestId('reading-page');
    await expect(p).toHaveAttribute('data-page', String(k));
    await expect(page.getByTestId('reading-next')).toBeDisabled();
    // «найдите в цитате» — касание слова; выбор — вариант
    if (await p.getAttribute('data-kind') === 'mark') await p.locator('[data-testid=reading-word][data-hit="1"]').first().click();
    else await p.locator('[data-testid=reading-opt][data-ok]').click();
    await expect(page.getByTestId('reading-feedback')).toHaveAttribute('data-ok', 'true');
    await page.getByTestId('reading-next').click();
  }
  await expect(page.getByTestId('reading-done')).toContainText('Книга на полке');
  await expect(page.getByTestId('reading-done')).toContainText('+12 опыта');
  await expect(page.locator('[data-testid=reading-book][data-done="true"]')).toHaveCount(1);
  await expect(page.getByTestId('reading-keep')).toContainText('Роббинс');
  await page.getByTestId('reading-finish').click();
  await expect(reading).toHaveCount(0);
  await expect(card).toHaveAttribute('data-state', 'done');
  expect(await page.evaluate(() => !!JSON.parse(localStorage.getItem('ems-textbook-v1')).learn.read['read-choice'])).toBe(true);
  // перечитать можно, опыт — уже нет; «Найдите в цитате» с ошибкой — верные слова подчёркнуты
  await card.click();
  await reading.locator('[data-testid=reading-word]:not([data-hit])').first().click();
  await expect(page.getByTestId('reading-feedback')).toHaveAttribute('data-ok', 'false');
  await expect(page.getByTestId('reading-feedback')).toContainText('Нужные слова подчёркнуты');
  await page.getByTestId('reading-close').click();
  await expect(reading).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('украшения урока: своя витрина с живыми превью, покупка вешает вещицу в уроки, она отзывается на ответ', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: Date.now() - 86400000, runs: 1, best: 90 } }, coins: { '2026-01-01': 5000 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'shop' });
  // на витрине ювелира их нет — они во вкладке «Для урока»
  await shopTab(page, 'rare');
  await expect(page.getByTestId('shop-rare').getByTestId('shop-item').first()).toBeVisible();
  await expect(page.getByTestId('shop-rare').locator('[data-item^="desk-"]')).toHaveCount(0);
  await shopTab(page, 'lesson');
  const desk = page.getByTestId('shop-desk');
  await desk.scrollIntoViewIfNeeded();
  await expect(desk.getByTestId('shop-item')).toHaveCount(3);
  await expect(desk.getByTestId('decor-preview')).toHaveCount(3);
  // превью живое: оттянуть крайний шарик колыбели — шарики качаются
  const cradle = desk.locator('[data-testid=shop-item][data-item="desk-cradle"]');
  const prev = cradle.getByTestId('decor-preview');
  await expect(prev).toHaveAttribute('data-awake', 'false', { timeout: 5000 });
  const box = await prev.boundingBox();
  const cx = box.x + box.width / 2 - 2 * 14.6; const cy = box.y + 5 + (64 - 5 - 7 - 4);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy - 10, { steps: 5 });
  await expect(prev).toHaveAttribute('data-drag', 'true');
  await page.mouse.up();
  await expect(prev).toHaveAttribute('data-awake', 'true');
  // покупка — сразу в уроках
  await cradle.getByRole('button', { name: 'Купить' }).click();
  await expect(page.getByTestId('shop-msg')).toContainText('висит в уроках');
  await expect(cradle.getByTestId('desk-toggle')).toHaveText('Убрать из уроков');
  // в гардеробе их нет
  await shopTab(page, 'wardrobe');
  await expect(page.getByTestId('shop-wardrobe')).toBeVisible();
  await expect(page.getByTestId('shop-wardrobe').locator('[data-item^="desk-"]')).toHaveCount(0);
  // в уроке — полоса с колыбелью под шапкой; ответ её будит
  await openTab(page, 'path');
  await startLesson(page, 'sc-l1');
  const decor = page.getByTestId('lesson').getByTestId('lesson-decor');
  await expect(decor).toHaveAttribute('data-decor', 'desk-cradle');
  await expect(decor).toHaveAttribute('data-awake', 'false', { timeout: 5000 });
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1]);
  while (!(await page.getByTestId('ex').count())) await page.getByTestId('lesson').locator('.ln-foot button').last().click();
  await answerExercise(page);
  await expect(decor).toHaveAttribute('data-awake', 'true');
  // убрали в лавке — в уроке полосы нет
  await page.getByTestId('lesson').locator('[data-nav="back"]').first().click();
  const leave = page.getByRole('button', { name: 'Выйти', exact: true });
  if (await leave.count()) await leave.click();
  await openTab(page, 'shop');
  // лавка помнит вкладку, пока открыто приложение
  await expect(page.getByTestId('shop-panel')).toHaveAttribute('data-tab', 'wardrobe');
  await shopTab(page, 'lesson');
  await page.getByTestId('shop-desk').locator('[data-item="desk-cradle"]').getByTestId('desk-toggle').click();
  await openTab(page, 'path');
  await startLesson(page, 'sc-l1', /Начать|Продолжить|Повторить/);
  await expect(page.getByTestId('lesson')).toBeVisible();
  await expect(page.getByTestId('lesson-decor')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('темы урока: живые превью во вкладке «Для урока»; купленная тема меняет урок — фон, кнопки, отклик на ответ', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at: Date.now() - 86400000, runs: 1, best: 90 } }, coins: { '2026-01-01': 5000 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'shop' });
  await expect(page.getByTestId('shop-panel')).toHaveAttribute('data-tab', 'showcase');
  await shopTab(page, 'lesson');
  const themes = page.getByTestId('shop-themes');
  await expect(themes.getByTestId('shop-item')).toHaveCount(4);
  await expect(themes.getByTestId('skin-preview')).toHaveCount(4);
  // превью — тот же фон и те же кнопки, что в уроке
  const pv = themes.locator('[data-item="theme-exchange"]').getByTestId('skin-preview');
  await expect(pv).toHaveAttribute('data-skin', 'exchange');
  expect(await pv.locator('.ds-opt').first().evaluate((el) => getComputedStyle(el, '::before').content)).toContain('>');
  const item = themes.locator('[data-testid=shop-item][data-item="theme-exchange"]');
  await item.getByRole('button', { name: 'Купить' }).click();
  await expect(page.getByTestId('shop-msg')).toContainText('тема уже включена');
  await expect(item.getByTestId('theme-toggle')).toHaveText('Выключить');
  await expect(item).toHaveAttribute('data-on', 'true');
  // не на Инфле: ни в гардеробе, ни у ювелира
  await shopTab(page, 'wardrobe');
  await expect(page.getByTestId('shop-wardrobe').locator('[data-item^="theme-"]')).toHaveCount(0);
  await shopTab(page, 'rare');
  await expect(page.getByTestId('shop-rare').locator('[data-item^="theme-"]')).toHaveCount(0);
  // урок — в теме: тёмный терминал, варианты — строки «> …», ответ — свеча
  await openTab(page, 'path');
  await startLesson(page, 'sc-l1');
  const lesson = page.getByTestId('lesson');
  await expect(lesson).toHaveAttribute('data-skin', 'exchange');
  await expect(lesson).toHaveClass(/ds-dark/);
  await expect(lesson.getByTestId('lesson-skin')).toHaveAttribute('data-skin', 'exchange');
  while (!(await page.getByTestId('ex').count())) await lesson.locator('.ln-foot button').last().click();
  const fx = lesson.getByTestId('lesson-skin-fx');
  await expect(fx).toHaveAttribute('data-fired', '0');
  await answerExercise(page);
  await expect(fx).not.toHaveAttribute('data-fired', '0');
  // фон не ловит касаний и не расширяет страницу
  expect(await lesson.getByTestId('lesson-skin').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1]);
  // выключили в лавке — урок обычный
  await lesson.locator('[data-nav="back"]').first().click();
  const leave = page.getByRole('button', { name: 'Выйти', exact: true });
  if (await leave.count()) await leave.click();
  await openTab(page, 'shop');
  await shopTab(page, 'lesson');
  await page.getByTestId('shop-themes').locator('[data-item="theme-exchange"]').getByTestId('theme-toggle').click();
  await openTab(page, 'path');
  await startLesson(page, 'sc-l1', /Начать|Продолжить|Повторить/);
  await expect(page.getByTestId('lesson')).toBeVisible();
  await expect(page.getByTestId('lesson')).not.toHaveAttribute('data-skin', /.+/);
  await expect(page.getByTestId('lesson-skin')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* ------------------------------ ВЫПУСК 26 ОКТЯБРЯ ------------------------------ */
test('лига: неделя кончилась — церемония «Итоги недели»: кольцо мест, щит меняется на новую лигу, «К лиге»', async ({ page }) => {
  await withTestFlag(page);
  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('ems-celebrate-test', '1');
    if (localStorage.getItem('ems-textbook-v1')) return;
    localStorage.setItem('ems-celebrated', '{}');
    const at = Date.parse('2026-10-12T08:00:00Z');
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 } }, xp: { '2026-10-12': 900, '2026-10-13': 900 }, done: { '2026-10-12': 1, '2026-10-13': 1 } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const scene = page.getByTestId('celebrate');
  await expect(scene).toHaveAttribute('aria-label', 'Итоги недели: Повышение!');
  const lg = scene.getByTestId('celebrate-league');
  await expect(lg).toHaveAttribute('data-move', 'up');
  await expect(lg).toHaveAttribute('data-place', '1');
  await expect(scene.getByTestId('celebrate-shield')).toHaveAttribute('data-league', 'silver');
  await expect(scene.getByTestId('celebrate-place')).toHaveText('№ 1 из 20');
  await scene.click({ position: { x: 8, y: 8 } });
  await expect(scene.getByTestId('celebrate-coins')).toHaveAttribute('data-value', '50');
  await expect(scene).toContainText('1-е место из 20 в Бронзовой лиге — дальше Серебряная лига');
  await scene.getByTestId('celebrate-go').click();
  await expect(page.getByTestId('league')).toBeVisible();
  await expect(page.getByTestId('celebrate')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('«Персоналии» — урок на дороге юнита: три портрета, лента веков, вопрос; галерея и книжная полка в профиле', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 }, 'sc-l1': { at, runs: 1, best: 90 } } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const stop = page.locator('[data-testid=path-extra][data-extra="people"]');
  await expect(stop).toHaveAttribute('data-state', 'open');
  // «Чтение» ещё закрыто — касание объясняет, когда откроется
  await page.locator('[data-testid=path-extra][data-extra="read"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid=path-extra][data-extra="read"]').click();
  await expect(page.getByTestId('extra-locked')).toContainText('Откроется, когда пройдёте урок');
  await page.getByTestId('extra-locked').getByRole('button', { name: 'Понятно' }).click();
  await stop.scrollIntoViewIfNeeded();
  await stop.click();
  const view = page.getByTestId('people');
  await expect(view).toHaveAttribute('data-id', 'people-scarcity');
  for (const id of ['robbins', 'malthus', 'ricardo']) {
    const pg = view.getByTestId('people-page');
    await expect(pg).toHaveAttribute('data-person', id);
    await expect(pg.getByTestId('people-portrait')).toBeVisible();
    await expect(pg.getByTestId('people-era')).toBeVisible();
    await expect(page.getByTestId('people-next')).toBeDisabled();
    // сначала ошибка — объяснение и «попробуйте ещё», потом верный
    await pg.locator('[data-testid=people-opt][data-ok="false"]').first().click();
    await expect(page.getByTestId('people-feedback')).toHaveAttribute('data-ok', 'false');
    await pg.locator('[data-testid=people-opt][data-ok="true"]').click();
    await expect(page.getByTestId('people-feedback')).toHaveAttribute('data-ok', 'true');
    await page.getByTestId('people-next').click();
  }
  await expect(page.getByTestId('people-done')).toContainText('+12 опыта');
  await expect(page.getByTestId('people-wall').locator('figure')).toHaveCount(3);
  await page.getByTestId('people-finish').click();
  await expect(stop).toHaveAttribute('data-state', 'done');
  // профиль: в галерее — трое знакомых, на полке открылись «Богатство народов» и «Начала»
  await openTab(page, 'profile');
  const shelf = page.getByTestId('prof-shelf');
  await shelf.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('gallery-count')).toHaveText('3 из 30');
  await expect(shelf.locator('[data-testid=gallery-person][data-met="true"]')).toHaveCount(3);
  await expect(page.getByTestId('shelf-count')).toHaveText('2 из 9');
  await expect(page.getByTestId('shelf-read')).toHaveCount(0);
  await shelf.locator('[data-testid=shelf-book][data-book="smith-wealth"]').click();
  const book = page.getByTestId('book-reader');
  await expect(book).toBeVisible();
  await expect(book.getByTestId('book-passage')).toHaveCount(5);
  await expect(book).toContainText('Не от благожелательности мясника, пивовара или булочника');
  // дочитали — в конце «Отметить прочитанной»: штамп с датой, на полке — закладка
  await book.getByTestId('book-mark-read').click();
  await expect(book.getByTestId('book-read-stamp')).toContainText('Прочитано');
  await page.getByTestId('book-close').click();
  const smith = shelf.locator('[data-testid=shelf-book][data-book="smith-wealth"]');
  await expect(smith).toHaveAttribute('data-read', 'true');
  await expect(smith).toHaveAttribute('aria-label', /прочитана/);
  await expect(smith.locator('.lb-ribbon')).toHaveCount(1);
  await expect(page.getByTestId('shelf-read')).toHaveText('прочитано 1');
  await expect(shelf.locator('[data-testid=shelf-book][data-book="ricardo-principles"]')).toHaveAttribute('data-read', 'false');
  // закрытая книга — подсказка, что её откроет
  await shelf.locator('[data-testid=shelf-book][data-book="keynes-tract"]').click();
  await expect(page.getByTestId('shelf-locked')).toContainText('«Гастроном»');
  expect(errors).toEqual([]);
});

test('«Работа над ошибками»: много ошибок в юните — обязательный урок перед следующим, после него Путь открыт', async ({ page }) => {
  await withTestFlag(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2'];
    const mistakes = ['sc-e1-best', 'sc-e1-free', 'sc-e1-gap', 'sc-e1-uni', 'sc-e2-concert', 'sc-e2-project'].map((id, k) => ({ id, at: at + k }));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 60 }])), mistakes } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const fix = page.locator('[data-testid=path-extra][data-extra="fix"]');
  await expect(fix).toBeVisible();
  await expect(page.getByTestId('path-fix-count')).toHaveText('6');
  await expect(fix.locator('xpath=following-sibling::button[1]')).toContainText('сначала — ошибки юнита');
  // следующий урок закрыт — и сказано почему
  await pathNode(page, 'sc-i2').click();
  await expect(page.getByTestId('lesson-sheet-locked')).toContainText('Работа над ошибками');
  await page.getByTestId('lesson-sheet').getByRole('button', { name: 'Закрыть' }).click();
  await fix.click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('aria-label', 'Работа над ошибками');
  for (let i = 0; i < 30 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    await answerExercise(page);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  await expect(page.getByTestId('lesson-result')).toContainText('Ошибки разобраны — Путь открыт');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(fix).toHaveCount(0);
  await expect(pathNode(page, 'sc-i2')).toHaveAttribute('data-state', 'open');
  expect(await page.evaluate(() => !!JSON.parse(localStorage.getItem('ems-textbook-v1')).learn.fixed.scarcity)).toBe(true);
  expect(errors).toEqual([]);
});

test('открытия: новичку лиги, лавка, копилка и сад открываются по урокам; открытие — сцена «Открылось»', async ({ page }) => {
  // замки и церемонии в автотесте включаются явно
  await page.addInitScript(() => {
    localStorage.setItem('ems-unlock-test', '1');
    localStorage.setItem('ems-celebrate-test', '1');
    localStorage.setItem('ems-celebrated', JSON.stringify({}));
    if (localStorage.getItem('ems-textbook-v1')) return;
    // один урок пройден вчера: лиги открыты (сцена — давно позади), лавка — после второго
    const at = Date.now() - 5 * 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 } } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const nav = page.getByTestId('bottom-nav');
  await expect(nav.locator('[data-tab="league"] [data-testid=nav-lock]')).toHaveCount(0);
  await expect(nav.locator('[data-tab="shop"] [data-testid=nav-lock]')).toHaveCount(1);
  // закрытая лавка: что там будет и сколько уроков осталось
  await openTab(page, 'shop');
  const locked = page.getByTestId('feature-locked');
  await expect(locked).toHaveAttribute('data-feature', 'shop');
  await expect(locked).toContainText('Лавка — после 2-го урока');
  await expect(locked).toContainText('Осталось 1 урок');
  await locked.getByTestId('feature-locked-go').click();
  await expect(page.getByTestId('path')).toBeVisible();
  // второй урок пройден только что — лавка открылась: сцена «Открылось», «Заглянуть» ведёт в лавку
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    p.learn.lessons['sc-l1'] = { at: Date.now() - 60000, runs: 1, best: 90 };
    localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'networkidle' });
  const scene = page.getByTestId('celebrate');
  await expect(scene.getByTestId('celebrate-unlock')).toHaveAttribute('data-feature', 'shop');
  await expect(scene).toContainText('Открылось');
  await scene.getByTestId('celebrate-go').click();
  await expect(page.getByTestId('shop')).toBeVisible();
  await expect(nav.locator('[data-tab="shop"] [data-testid=nav-lock]')).toHaveCount(0);
  // внутри лавки копилка (после 4-го урока) и сад (после 6-го) пока закрыты
  await shopTab(page, 'useful');
  await expect(page.locator('[data-testid=feature-locked][data-feature="piggy"]')).toContainText('Осталось 2 урока');
  await expect(page.getByTestId('shop-piggy')).toHaveCount(0);
  await expect(page.getByTestId('shop-switch').getByTestId('garden-lock')).toHaveCount(1);
  await page.getByTestId('shop-switch').locator('[data-view="garden"]').click();
  await expect(page.locator('[data-testid=feature-locked][data-feature="garden"]')).toContainText('Сад — после 6-го урока');
  expect(errors).toEqual([]);
});

test('«Разбор графика» — остановка на дороге юнита: график собирается по шагам, вопрос, +10 опыта; кнопка на карточке урока', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3'];
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const stop = page.locator('[data-testid=path-extra][data-extra="graph"]');
  await expect(stop).toHaveAttribute('data-state', 'open');
  await stop.scrollIntoViewIfNeeded();
  await stop.click();
  const g = page.getByTestId('graph-lesson');
  await expect(g).toHaveAttribute('data-id', 'graph-ppf');
  // первый шаг — оси в фокусе; дальше на каждом шаге новое — подсвечено
  await expect(g.locator('[data-testid=graph-el][data-el="axes"]')).toHaveAttribute('data-on', 'true');
  await expect(g.getByTestId('graph-back')).toBeDisabled();
  await g.getByTestId('graph-next').click();
  await expect(g.locator('[data-testid=graph-el][data-el="PPF"]')).toHaveAttribute('data-on', 'true');
  await expect(g.getByTestId('graph-text')).toContainText('КПВ');
  await expect(g.getByTestId('graph-mark')).toHaveCount(2);
  await g.getByTestId('graph-next').click();
  await expect(g.locator('[data-testid=graph-el][data-el="pt:A"]')).toHaveAttribute('data-on', 'true');
  await expect(g.locator('[data-testid=graph-el][data-el="PPF"]')).toHaveAttribute('data-on', 'false');
  // назад — на шаг раньше
  await g.getByTestId('graph-back').click();
  await expect(g.getByTestId('graph-text')).toContainText('Шаг 2 из 8');
  for (let k = 2; k < 8; k += 1) await g.getByTestId('graph-next').click();
  await expect(g.getByTestId('graph-next')).toHaveText(/К вопросу/);
  await g.getByTestId('graph-next').click();
  // вопрос: сначала ошибка — объяснение, потом верно
  await expect(g).toHaveAttribute('data-phase', 'quiz');
  await expect(g.getByTestId('graph-next')).toBeDisabled();
  await g.locator('[data-testid=graph-opt][data-ok="false"]').first().click();
  await expect(g.getByTestId('graph-feedback')).toHaveAttribute('data-ok', 'false');
  await g.locator('[data-testid=graph-opt][data-ok="true"]').click();
  await expect(g.getByTestId('graph-feedback')).toHaveAttribute('data-ok', 'true');
  await g.getByTestId('graph-next').click();
  await expect(g.getByTestId('graph-done')).toContainText('+10 опыта');
  await g.getByTestId('graph-finish').click();
  await expect(stop).toHaveAttribute('data-state', 'done');
  // карточка урока с этим графиком — «Разобрать график по шагам»: разбор поверх урока, без опыта
  await page.locator('[data-testid=path-lesson][data-lesson="sc-i2"]').click();
  await page.getByTestId('lesson-start').click();
  const btn = page.getByTestId('lesson').getByTestId('graph-open');
  await expect(btn).toHaveAttribute('data-graph', 'graph-ppf');
  await btn.click();
  await expect(page.getByTestId('graph-lesson')).toBeVisible();
  await page.getByTestId('graph-close').click();
  await expect(page.getByTestId('graph-lesson')).toHaveCount(0);
  await expect(page.getByTestId('lesson')).toBeVisible();
  expect(errors).toEqual([]);
});

test('«Персоналии»: портреты с Википедии — только свободные файлы Commons с подписью автора; иначе медальон', async ({ page }) => {
  // Википедию подменяем: Роббинс — общественное достояние, Мальтус — fair use, Рикардо — локальный файл английской Википедии
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route('https://en.wikipedia.org/**', (r) => {
    const u = r.request().url();
    const src = u.includes('Robbins') ? 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Robbins.jpg'
      : u.includes('Malthus') ? 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Malthus.jpg' : 'https://upload.wikimedia.org/wikipedia/en/e/ef/Ricardo.jpg';
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ originalimage: { source: src } }) });
  });
  await page.route('https://commons.wikimedia.org/**', (r) => {
    const free = r.request().url().includes('Robbins');
    const name = free ? 'Robbins' : 'Malthus';
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ query: { pages: { 7: { imageinfo: [{
      thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/480px-${name}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
      extmetadata: { LicenseShortName: { value: free ? 'Public domain' : 'Fair use' }, Artist: { value: '<span>Elliott &amp; Fry</span>' } } }] } } } }) });
  });
  await page.route('https://upload.wikimedia.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.addInitScript(() => {
    localStorage.setItem('ems-portraits-test', '1');
    if (localStorage.getItem('ems-textbook-v1')) return;
    const at = Date.now() - 86400000;
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: { 'sc-i1': { at, runs: 1, best: 90 }, 'sc-l1': { at, runs: 1, best: 90 } } } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  await page.locator('[data-testid=path-extra][data-extra="people"]').click();
  const pg = page.getByTestId('people');
  await expect(pg.getByTestId('people-page')).toHaveAttribute('data-person', 'robbins');
  await expect(pg.getByTestId('people-portrait')).toHaveAttribute('data-photo', 'true');
  await expect(pg.getByTestId('people-portrait').locator('img')).toHaveAttribute('src', /upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/ab\/Robbins\.jpg/);
  await expect(pg.getByTestId('people-credit')).toContainText('Фото: Elliott & Fry · Public domain · Wikimedia Commons');
  await expect(pg.getByTestId('people-credit').locator('a')).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Robbins.jpg');
  // ответ запомнен устройством — без повторного запроса к Википедии
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ems-portraits-v1') || '{}')))).toContain('robbins');
  await pg.locator('[data-testid=people-opt][data-ok="true"]').click();
  await page.getByTestId('people-next').click();
  // Мальтус: fair use — медальон и без подписи
  await expect(pg.getByTestId('people-page')).toHaveAttribute('data-person', 'malthus');
  await expect(pg.getByTestId('people-portrait')).toHaveAttribute('data-photo', 'false');
  await expect(pg.getByTestId('people-credit')).toHaveCount(0);
  await pg.locator('[data-testid=people-opt][data-ok="true"]').click();
  await page.getByTestId('people-next').click();
  // Рикардо: файл не на Commons — медальон
  await expect(pg.getByTestId('people-page')).toHaveAttribute('data-person', 'ricardo');
  await expect(pg.getByTestId('people-portrait')).toHaveAttribute('data-photo', 'false');
  expect(errors).toEqual([]);
});
