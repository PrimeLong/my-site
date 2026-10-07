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
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: typeof apiBody === 'function' ? apiBody(r.request()) : apiBody }));
  await gotoApp(page, path, tab);
  return { errors, external };
}
/* Главный экран — Путь с нижней панелью; игровые тесты начинают с вкладки «Мир» (там
   прежнее меню). Если открылась партия из автосохранения, панели нет — ничего не жмём. */
async function gotoApp(page, path = '/', tab = 'world') {
  await page.goto(path, { waitUntil: 'networkidle' });
  if (tab && tab !== 'path' && await page.getByTestId('bottom-nav').isVisible()) await openTab(page, tab);
}
const openTab = (page, tab) => page.getByTestId('bottom-nav').locator(`[data-tab="${tab}"]`).click();
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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
  await expect(page.getByRole('heading', { name: 'Инфлатия' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  expect(families.map((f) => f.replace(/"/g, ''))).toContain('PT Serif');
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
  await expect(hello.getByTestId('mascot')).toHaveAttribute('data-mood', 'wave');
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

  // аккаунт — в профиле; выход возвращает на приветствие
  await openTab(page, 'profile');
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
  await expect(toc.getByText('Микроэкономика', { exact: true })).toBeVisible();
  await expect(toc.locator('[data-status="ready"]')).toHaveCount(15);
  await expect(toc.locator('[data-status="planned"]')).toHaveCount(6);
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
  // перед ответом — оценка уверенности
  await prob.getByRole('button', { name: 'Проверить' }).click();
  await expect(prob.getByTestId('tb-verdict')).toContainText('уверены ли вы');
  await prob.getByRole('button', { name: 'Уверен', exact: true }).click();
  await prob.getByRole('button', { name: 'Проверить' }).click();
  await expect(prob.getByTestId('tb-verdict')).toContainText('Пока неверно');
  // единицу из подписи можно дописать к ответу
  await prob.getByRole('textbox').fill('30 руб.');
  await prob.getByRole('button', { name: 'Не уверен', exact: true }).click();
  await prob.getByRole('button', { name: 'Проверить' }).click();
  await expect(prob.getByTestId('tb-verdict')).toContainText('Верно: 30 руб.');
  await expect(prob.getByTestId('tb-verdict')).not.toContainText('руб..');
  // ошибся, потом ответил верно — повторение остаётся через два дня, а не отодвигается
  await expect(prob.getByTestId('tb-verdict')).toContainText('по плану — через 2 дня');
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
  // графическая: сдвинуть не ту кривую — неверно, нужную — верно
  const gr = ch.locator('[data-problem="sd-graph-flour"]');
  await gr.getByRole('button', { name: 'Проверить сдвиг' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Сначала сдвиньте');
  await gr.getByRole('slider', { name: 'Сдвиг спроса', exact: true }).fill('-20');
  await gr.getByRole('button', { name: 'Уверен', exact: true }).click();
  await gr.getByRole('button', { name: 'Проверить сдвиг' }).click();
  await expect(gr.getByTestId('tb-verdict')).toContainText('Пока неверно');
  await gr.getByRole('slider', { name: 'Сдвиг спроса', exact: true }).fill('0');
  await gr.getByRole('slider', { name: 'Сдвиг предложения' }).fill('-20');
  await gr.getByRole('button', { name: 'Уверен', exact: true }).click();
  await gr.getByRole('button', { name: 'Проверить сдвиг' }).click();
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
  await expect(page.getByTestId('tb-stats')).toContainText('Глав прочитано: 1 из 15');
  // уверенные ответы — на странице «Мой прогресс»: три из шести верны (включая задачу в несколько шагов), неуверенный — верен
  await page.getByTestId('tb-stats-link').click();
  await expect(page.getByTestId('stats-confidence')).toContainText('верно 3 из 6 (50%)');
  await expect(page.getByTestId('stats-confidence')).toContainText('неуверенные: верно 1 из 2');
  await toToc(page);
  // «На сегодня» больше нет: вопрос на вспоминание — в конце раздела главы; ответ «совпало» проходит раздел
  await toc.getByRole('button', { name: /Спрос и предложение/ }).click();
  const recall = page.getByTestId('chapter').getByTestId('tb-recall').first();
  await recall.scrollIntoViewIfNeeded();
  // сначала свой ответ: без него эталон не открыть, кроме как через «Не помню»
  await expect(recall.getByRole('button', { name: 'Сверить с ответом' })).toBeDisabled();
  await expect(recall.getByRole('button', { name: 'Вспомнил' })).toHaveCount(0);
  await recall.getByRole('textbox').fill('при росте цены покупают меньше, при прочих равных');
  await recall.getByRole('button', { name: 'Сверить с ответом' }).click();
  await expect(recall.getByTestId('tb-recall-answer')).toBeVisible();
  await recall.getByRole('button', { name: 'Совпало', exact: true }).click();
  await expect(recall.getByTestId('tb-recall-verdict')).toContainText('Раздел пройден');
  await expectNoSidewaysScroll(page);
  await toToc(page);
  await expect(toc.locator('.tb-toc-row', { hasText: 'Спрос и предложение' }).locator('[aria-label="разделы 1/4"]')).toHaveCount(1);
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
  await page.getByRole('button', { name: 'приложение «Математика для экономиста»' }).click();
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
  await expect(page.getByTestId('bottom-nav').locator('[data-tab]')).toHaveText(['Путь', 'Учебник', 'Мир', 'Лавка', 'Профиль']);
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
  await expect(exam.getByTestId('exam-problem')).toHaveCount(16);
  await expect(exam.getByRole('button', { name: /^Подсказка/ })).toHaveCount(0);
  await expect(exam.getByRole('button', { name: 'Решение' })).toHaveCount(0);
  await exam.getByRole('textbox', { name: 'Проверка, ответ к задаче 1' }).or(exam.getByRole('textbox', { name: 'Проверка, задача 1, шаг а)' })).first().fill('1');
  await exam.getByRole('button', { name: 'Завершить проверку' }).click();
  await expect(exam.getByTestId('exam-result')).toContainText('Верно 0 из 16');
  await expect(exam.getByTestId('exam-weak')).toContainText('Слабое место');
  await expect(exam.getByRole('button', { name: 'Решение' })).toHaveCount(16);
  await expectNoSidewaysScroll(page);
  // пересдача — те же темы, новые числа
  const before = await exam.getByTestId('exam-problem').allInnerTexts();
  await exam.getByRole('button', { name: 'Пересдать с новыми числами' }).click();
  await expect(exam.getByTestId('exam-result')).toHaveCount(0);
  await expect(exam.getByTestId('exam-problem')).toHaveCount(16);
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
async function answerExercise(page, { wrong = false } = {}) {
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
  } else if (kind === 'open') {
    // открытый вопрос: неверного ответа нет — пишем свой и читаем разбор
    await ex.getByTestId('open-answer').fill('Я бы не вводил потолок, а помог студентам адресно.');
  } else if (kind === 'domino') {
    // «Домино»: звенья по порядку; ошибка — ложная карточка роняет домино, дальше — с верного места
    const dom = ex.getByTestId('domino');
    await dom.locator(`[data-key="${ans[0]}"]`).click();
    if (wrong) { await dom.locator('[data-testid="domino-card"][data-key^="f"]').first().click(); await expect(dom.getByTestId('domino-why')).toBeVisible(); }
    for (const k of ans.slice(1)) await dom.locator(`[data-key="${k}"]`).click();
  }
  // мини-игра и «Домино» проверяются сами, когда доиграны
  if (!['swipe', 'rush', 'domino'].includes(kind)) await page.getByRole('button', { name: kind === 'open' ? 'Ответить' : 'Проверить' }).click();
  const fb = page.getByTestId('ex-feedback');
  await expect(fb).toHaveAttribute('data-ok', String(!wrong || kind === 'open'));
  return kind;
}
// пройти урок до экрана итогов; wrongAt — номера упражнений, где ошибиться нарочно
async function playLesson(page, { wrongAt = [] } = {}) {
  const kinds = new Set();
  let retries = 0;
  let cards = 0;
  for (let i = 0; i < 40; i += 1) {
    if (await page.getByTestId('lesson-result').isVisible()) break;
    // карточки перед упражнением: шаг, слово (перевернуть), пункт итогов — прочитать и дальше
    cards += await passCards(page);
    if (await page.getByTestId('ex-retry').isVisible()) retries += 1;
    kinds.add(await answerExercise(page, { wrong: wrongAt.includes(i) }));
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
  // подпись карточки: вид, «Слово 2 из 8», перевёрнута ли — по ней видно, что нажатие сработало
  // читается одним вызовом в странице: карточка может смениться между шагами, и тогда
  // getAttribute по исчезнувшему элементу ждал бы бесконечно
  const sig = () => page.evaluate(() => {
    const c = document.querySelector('[data-testid="lesson-card"]');
    if (!c || !c.checkVisibility()) return 'gone';
    const kind = c.querySelector('.ln-kind'); const flip = c.querySelector('[data-flipped]');
    return `${c.dataset.style}|${kind ? kind.innerText : ''}|${flip ? flip.dataset.flipped : ''}`;
  });
  while (await card.isVisible()) {
    n += 1;
    // «Откройте сами»: четыре дня с разными ценами — потом «Дальше»
    if (await card.getAttribute('data-style') === 'discover') { await playDiscover(page); continue; }
    const before = await sig();
    // в «Словах» в подвале две кнопки — «Ещё раз» и «Знаю»: берём последнюю
    await page.getByTestId('lesson').locator('.ln-foot button').last().click();
    await expect.poll(sig).not.toBe(before);
  }
  return n;
}

const pathNode = (page, id) => page.getByTestId('path').getByTestId('path-lesson').and(page.locator(`[data-lesson="${id}"]`));
// карточка урока → «Начать» (или «Продолжить»)
async function startLesson(page, id, button = /Начать|Повторить/) {
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
  // Путь начинается с юнита 1; уроками — четыре юнита (14, 10, 10 и 10 уроков, все восемь видов), остальные свёрнуты в одну строку
  await expect(path.getByTestId('path-unit')).toHaveCount(4);
  await expect(path.getByTestId('path-unit').first()).toHaveAttribute('data-unit', 'scarcity');
  await expect(path.getByTestId('path-lesson')).toHaveCount(44);
  await expect(path.locator('[data-kind="intro"]')).toHaveCount(8);
  // юниты по уровням: Начальный, Базовый (спрос и предложение, эластичность), Средний (потребитель)
  await expect(path.getByTestId('path-level')).toHaveCount(3);
  await expect(path.getByTestId('path-level').nth(1)).toContainText('Базовый');
  await expect(path.getByTestId('path-unit').nth(2)).toHaveAttribute('data-unit', 'elasticity');
  await expect(path.locator('[data-state="open"]')).toHaveCount(1);
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-state', 'open');
  await expect(pathNode(page, 'sc-i1')).toHaveAttribute('data-kind', 'intro');
  const soon = path.getByTestId('path-soon');
  await expect(soon).toContainText('мест строятся');
  await expect(path.getByTestId('path-soon-list')).toHaveCount(0);
  await soon.getByRole('button').first().click();
  await expect(path.getByTestId('path-soon-list')).toContainText('Издержки');
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
  expect(Number(await page.getByTestId('lesson-progress').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
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
  await path.locator('[data-testid="path-unit"][data-unit="supply-demand"]').getByTestId('unit-check').click();
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
  // алмазный уровень — гранат из тёплой палитры, не холодный синий
  expect(await page.getByTestId('lesson-diamond').evaluate((el) => getComputedStyle(el).getPropertyValue('--u').trim().toLowerCase())).toBe('#8a2f45');
  await page.getByTestId('lesson-diamond').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-diamond', 'true');
  // алмазные шаги — с формулами и строкой обозначений
  let legend = false;
  for (let i = 0; i < 40 && !(await page.getByTestId('lesson-result').isVisible()); i += 1) {
    if (await page.getByTestId('step-legend').isVisible()) legend = true;
    if (await page.getByTestId('lesson-card').isVisible()) { await page.getByTestId('lesson').locator('.ln-foot button').click(); continue; }
    await answerExercise(page);
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  expect(legend).toBe(true);
  await expect(page.getByTestId('result-diamond')).toContainText('Алмазный уровень взят');
  await expect(page.getByTestId('result-coins')).toContainText(/За урок\+(25|35)/);
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(pathNode(page, 'sd-i1')).toHaveAttribute('data-diamond', 'true');
  await expectNoSidewaysScroll(page);
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
  const unit = page.locator('[data-testid="path-unit"][data-unit="supply-demand"]');
  // у каждого вида — свой значок на Пути
  await expect(unit.getByTestId('path-lesson')).toHaveCount(10);
  const kinds = await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.dataset.kind));
  expect(kinds).toEqual(['intro', 'practice', 'words', 'intro', 'practice', 'story', 'listen', 'game', 'review', 'summary']);
  const icons = await unit.getByTestId('path-lesson').evaluateAll((els) => els.map((e) => e.querySelector('svg').getAttribute('class')));
  expect(new Set(icons).size, 'восемь видов — восемь разных значков').toBe(8);
  const finish = async () => { await expect(page.getByTestId('lesson-result')).toBeVisible(); await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click(); await expect(page.getByTestId('lesson')).toHaveCount(0); };

  // «Слова»: колода — вспомнить, открыть значение, «Знаю» или «Ещё раз»; потом плитки и пары на время
  await startLesson(page, 'sd-w');
  await expect(page.getByTestId('lesson-card')).toHaveAttribute('data-style', 'flash');
  const word = page.getByTestId('flash-card');
  await expect(word).toHaveAttribute('data-flipped', 'false');
  await expect(word.getByTestId('word-def')).toHaveCount(0);
  await expect(word).toContainText('Слово 1 из 8');
  await page.getByTestId('word-show').click();
  await expect(word.getByTestId('word-def')).toContainText('сколько покупатели готовы купить');
  // «Ещё раз»: слово уходит в конец колоды и вернётся с пометкой
  await page.getByTestId('word-again').click();
  await expect(word).toContainText('Слово 2 из 8');
  await expect(page.getByTestId('word-dots').locator('i.again')).toHaveCount(1);
  // открыть можно и касанием карточки
  await word.click();
  await expect(word).toHaveAttribute('data-flipped', 'true');
  await page.getByTestId('word-know').click();
  await expect(page.getByTestId('word-dots').locator('i.know')).toHaveCount(1);
  for (let i = 0; i < 6; i += 1) { await page.getByTestId('word-show').click(); await page.getByTestId('word-know').click(); }
  // последнее — отложенное слово, с пометкой «ещё раз»
  await expect(word).toContainText('ещё раз');
  await expect(word).toContainText('Спрос');
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
  await expect(page.getByTestId('lesson-result')).toContainText('Игра не засчитана');
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

// юнит «Спрос и предложение» пройден — любой его урок открыт для повтора
const unitDone = (page) => page.addInitScript(() => {
  if (localStorage.getItem('ems-textbook-v1')) return;
  const at = Date.now() - 86400000;
  const ids = ['sc-i1', 'sc-l1', 'sc-l2', 'sc-i2', 'sc-l3', 'sc-l4', 'sc-l5', 'sc-l6', 'sc-w', 'sc-s1', 'sc-radio', 'sc-g', 'sc-rev', 'sc-sum', 'sd-i1', 'sd-l1', 'sd-w', 'sd-i2', 'sd-l3', 'sd-s1', 'sd-l-radio', 'sd-g', 'sd-rev', 'sd-sum'];
  localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons: Object.fromEntries(ids.map((id) => [id, { at, runs: 1, best: 90 }])) } }));
});
/* Мини-игра на время: в тесте игра короче (window.__INFLATIA_GAME_SECONDS__), карточки — по
   кругу, пока не выйдет время; wrong(i) — ошибиться на i-й. max — сколько карточек ответить
   (дальше — ждать конца времени). Проверка — сама по окончании игры. */
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

test('юнит 1 «Ограниченность и выбор»: все виды уроков, калькулятор в расчёте, повтор после ошибки — другой задачей', async ({ page }) => {
  test.setTimeout(180_000);
  await withTestFlag(page);
  await unitDone(page);
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const unit = page.locator('[data-testid="path-unit"][data-unit="scarcity"]');
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
    const body = el.closest('.ln-body'); const p = el.querySelector('.ln-prompt').getBoundingClientRect(); const u = el.querySelector('[data-testid=calc-use]').getBoundingClientRect();
    return u.bottom - p.top <= body.clientHeight;
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
  await expect(ex.getByTestId('game')).toContainText('засчитывается от 8 верных');
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
  // каждая карточка двигает кривую: подпись сдвига и история цены
  await expect(ex.getByTestId('game-effect')).toBeVisible();
  await expect(ex.getByTestId('price-ticker')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(ex.getByTestId('game-final')).toContainText('140');
  await expect(ex.getByTestId('game-final')).toContainText('верно 10 из 11');
  await expect(page.getByTestId('game-result')).toContainText('Верно 10 из 11 · 140 очков');
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'true');
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(page.getByTestId('lesson-result')).toContainText('Игра засчитана');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше', exact: true }).click();

  // заново: рекорд на старте; три верных — меньше планки, игра не засчитана
  await startLesson(page, 'sd-g');
  await expect(ex.getByTestId('game-best')).toContainText('рекорд: 140');
  await ex.getByTestId('game-start').click();
  for (let i = 0; i < 3; i += 1) await ex.locator(`button[data-side="${await card.getAttribute('data-answer')}"]`).click();
  await page.clock.fastForward(61_000);
  await expect(ex.getByTestId('game-final')).toContainText('верно 3 из 3');
  await expect(page.getByTestId('game-result')).toContainText('Нужно: не меньше 8 верных');
  await expect(page.getByTestId('ex-feedback')).toHaveAttribute('data-ok', 'false');
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
  await playLesson(page);
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
      if (body.action === 'report') return JSON.stringify({ funnel: [{ event: 'welcome_start', label: 'Нажали «Начать»', count: 40 }, { event: 'lesson_done', label: 'Прошли урок', count: 25 }],
        hardest: [{ id: 'sd-q2', total: 12, correct: 3, share: 0.25 }] });
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
  await expect(sheet.locator('[data-reason="accept"] svg')).toHaveCount(1);
  await expect(sheet.locator('[data-reason="typo"] svg')).toHaveCount(0);
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

  // владелец: список сообщений, фильтр и «скопировать всё»
  await openTab(page, 'profile');
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
  await expect(page.getByTestId('learn-profile')).toBeVisible();
  // аналитика без персональных данных: в событиях нет ни логина, ни сессии
  expect(events.some((e) => e.event === 'lesson_start' && e.lesson === 'sc-i1')).toBe(true);
  expect(events.some((e) => e.event === 'ex_first_try_fail' && e.exercise)).toBe(true);
  events.forEach((e) => { expect(e.session).toBeUndefined(); expect(e.login).toBeUndefined(); expect(e.playerId).toBeUndefined(); });
  await page.getByTestId('prof-analytics').click();
  const an = page.getByTestId('analytics');
  await expect(an.getByTestId('analytics-funnel').locator('[data-event]')).toHaveCount(2);
  await expect(an.getByTestId('analytics-hardest')).toContainText('sd-q2 — верно с первой попытки 25% (3 из 12)');
  await an.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByTestId('learn-profile')).toBeVisible();
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
  await expect(page.getByTestId('wallet-balance')).toHaveText('0');
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
  await expect(pathNode(page, 'sd-i1')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('path-rec')).toHaveText(/рекомендуем/i);
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
  await expect(shop.getByTestId('rate-chart')).toBeVisible();
  // подсказка графика курса у правого края не расширяет страницу (иначе телефон перемасштабирует её и панель внизу «уезжает»)
  const chartBox = await shop.getByTestId('rate-chart').boundingBox();
  for (const fx of [0.02, 0.5, 0.9, 0.99]) {
    await shop.getByTestId('rate-chart').hover({ position: { x: Math.round(chartBox.width * fx), y: 30 } });
    await expect(shop.getByTestId('rate-tip')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `подсказка на ${fx}`).toBe(true);
  }
  // страховка серии — полис: первый взнос сразу, дальше по неделям; расторгнуть можно в любой момент
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

  // профиль: программа с ответами регистрации и печати-достижения
  await openTab(page, 'profile');
  const prog = page.getByTestId('prof-program');
  await expect(prog.getByRole('group', { name: 'Цель' }).getByRole('button', { name: 'Олимпиада' })).toHaveAttribute('aria-pressed', 'true');
  await expect(prog.getByRole('group', { name: 'Минут в день' }).getByRole('button', { name: /15 мин/ })).toHaveAttribute('aria-pressed', 'true');
  // печать «Знаток» — только за проверку юнита без ошибок, вступительный тест её не даёт
  await expect(page.locator('[data-testid=ach][data-ach="ace"]')).toHaveAttribute('data-got', 'false');
  await expect(page.locator('[data-testid=ach][data-ach="shop"]')).toHaveAttribute('data-got', 'true');

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
  await expect(morning).toContainText('Вы на 1 день подряд');
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
const clickBack = (page) => page.locator('[data-nav="back"]').filter({ visible: true }).click();

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
  // лавка — вкладка нижней панели; Путь → сундук → назад
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
  await page.getByTestId('prof-account').click();
  await expectScreen(page, 'account', seen);
  // в аккаунте нет счётчика, который стыдит
  await expect(page.getByTestId('account')).not.toContainText('Выходов из партий');
  await clickBack(page);
  await expectScreen(page, 'profile', seen);
  // Мир — корень без «назад»; профиль игрока — только во вкладке «Профиль»
  await openTab(page, 'world');
  await expectScreen(page, 'world', seen);
  await expect(page.getByRole('button', { name: /Войти в профиль|Профиль:/ })).toHaveCount(0);
  // смена вкладки закрывает подэкран: учебник не остаётся висеть под другой вкладкой
  await openTab(page, 'profile');
  await page.getByTestId('prof-book-stats').click();
  await openTab(page, 'path');
  await expect(page.getByTestId('learn-book')).toHaveCount(0);
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
  expect(await anim(page.locator('.rw-flame'))).toBe('none');
  await expect(page.getByTestId('morning-days').locator('[data-value]')).toHaveText('1');
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

  // модель на Пути: деталь открыта, на карте — значок прогресса; закрытые — «откроется в уроке …»
  await expect(model).toHaveAttribute('data-open', '1');
  await expect(path.getByTestId('atlas-model').first()).toHaveText('модель 1/10');
  await model.getByTestId('model-toggle').click();
  await expect(model.locator('[data-part="demand"]')).toHaveAttribute('data-open', 'true');
  await expect(model.locator('[data-part="income"]')).toContainText('Откроется в уроке «Спрос: закон и сдвиги»');
  await expect(model.locator('[data-part="elastic"]')).toContainText('юнит «Эластичность»');
  await model.getByTestId('model-price').fill('30');
  await expect(model.getByTestId('model-readout')).toContainText('При цене 30 кр. купят 30');

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
  await expect(shop.getByTestId('shop-freeze')).toContainText('Страховка серии');
  const piggy = shop.getByTestId('shop-piggy');
  await expect(piggy).toHaveAttribute('data-open', 'false');
  const before = Number((await shop.getByTestId('shop-balance').innerText()).match(/\d+/)[0]);
  await piggy.getByTestId('piggy-amount').fill('100');
  await expect(piggy.getByTestId('piggy-chart')).toBeVisible();
  // честно про проценты: 730% годовых так не бывает, рядом — реальные 8% годовых
  await expect(piggy.getByTestId('piggy-real')).toContainText('730% годовых — в жизни так не бывает');
  await piggy.getByTestId('piggy-put').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('В копилке 100 монет. Через 7 дней станет 114.');
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before - 100));
  await expect(piggy.getByTestId('piggy-state')).toContainText('день 0 из 7');
  await piggy.getByTestId('piggy-take').click();
  await expect(shop.getByTestId('shop-msg')).toContainText('проценты не успели набежать');
  await expect(shop.getByTestId('shop-balance')).toContainText(String(before));
  // вклад, пролежавший неделю: забрать с процентами
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('ems-textbook-v1'));
    p.learn.piggy = { ...p.learn.piggy, [Date.now() - 8 * 86400000]: 100 };
    localStorage.setItem('ems-textbook-v1', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await openTab(page, 'shop');
  await expect(page.getByTestId('shop-piggy').getByTestId('piggy-state')).toContainText('срок вышел');
  await page.getByTestId('shop-piggy').getByTestId('piggy-take').click();
  await expect(page.getByTestId('shop-msg')).toContainText('Забрано 114 монет — с процентами за неделю.');
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

  // «назад» закреплён сверху: из глубины главы он на виду
  await page.mouse.wheel(0, 2500);
  await expect(page.getByTestId('tb-topbar')).toBeInViewport();
  // повторное нажатие на «Учебник» — на главную страницу учебника
  await page.getByTestId('bottom-nav').locator('[data-tab="book"]').click();
  await expect(page.getByTestId('textbook')).toBeVisible();
  await expect(page.getByTestId('chapter')).toHaveCount(0);

  // решённая задача свёрнута в строку «решена»; «Задачи» в оглавлении главы — к текущей задаче
  await page.getByTestId('textbook').getByRole('button', { name: /Совершенная конкуренция и монополия/ }).click();
  const done = ch.locator('[data-problem="pc-basic"]');
  await expect(done).toHaveAttribute('data-collapsed', 'true');
  await expect(done).toContainText('решена');
  await ch.getByTestId('tb-sections').getByRole('button', { name: 'Задачи' }).click();
  const curId = await ch.locator('[data-testid="tb-problem"]:not([data-collapsed="true"])').first().getAttribute('data-problem');
  await expect(ch.locator(`[data-problem="${curId}"]`)).toBeInViewport();
  await done.getByTestId('tb-problem-expand').click();
  await expect(done).not.toHaveAttribute('data-collapsed', 'true');
  await expect(done.getByRole('textbox').first()).toBeVisible();
  // «назад» в верхней панели — из главы в оглавление
  await page.getByTestId('tb-topbar').locator('[data-nav="back"]').click();
  await expect(page.getByTestId('textbook')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Путь: открывается на рекомендованном уроке, пройденный юнит — строкой, место на карте ведёт к уроку, «К карте»', async ({ page, isMobile }) => {
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
  // пройденный юнит с открытым сундуком — одна строка, не выше 80 px; «Уроки: N» разворачивает
  const sc = path.locator('[data-testid=path-unit][data-unit="scarcity"]');
  await expect(sc).toHaveAttribute('data-folded', 'true');
  expect((await sc.boundingBox()).height).toBeLessThan(80);
  // кнопка «К карте» — пока карта за верхом экрана; касание возвращает к карте
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByTestId('to-map')).toBeVisible();
  await page.getByTestId('to-map').click();
  await expect(path.getByTestId('atlas')).toBeInViewport();
  await expect(page.getByTestId('to-map')).toHaveCount(0);
  // место на карте — к уроку этого юнита, который советует Путь
  await path.locator('[data-testid=atlas-place][data-unit="supply-demand"]').click();
  await expect(rec).toBeInViewport();
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
  await sc.getByTestId('unit-fold').click();
  await expect(sc).toHaveAttribute('data-folded', 'false');
  await expect(sc.getByTestId('path-lesson')).toHaveCount(14);
  expect(errors).toEqual([]);
});

test('ПК от 1024 px: Путь в две колонки, у главы учебника оглавление сбоку', async ({ page, isMobile }) => {
  await withTestFlag(page);
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
      // справа: задания (карточка и задания дня) и живая модель текущего юнита — ровно одна на Пути
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
  expect(w.font).toContain('PT Serif');
  // кнопки меню — из ds.jsx; старая игровая кнопка осталась только у общего регулятора звука
  const old = await world.locator('button.ems-btn').count();
  expect(old).toBeLessThanOrEqual(1);
  expect(await world.locator('.ds-btn, .ds-card, .ds-chip').count()).toBeGreaterThan(4);
  // основная кнопка на золоте «Мира» — тёмный текст, читается
  const daily = world.getByTestId('daily-card');
  if (await daily.count()) {
    const c = await daily.locator('.ds-btn').first().evaluate((el) => getComputedStyle(el).color);
    expect(c).toBe('rgb(27, 18, 4)');
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
