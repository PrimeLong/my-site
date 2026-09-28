import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import katex from 'katex';
import { parseChapter, collectBlocks } from '../src/textbook/markdown.js';
import { freshRoom, resolveQuarter, publicView } from '../api/room.js';
import { makeInitialEconomy, defaultDecisions } from '../src/lib/engine.js';

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

test('меню открывается, шрифты свои, внешних запросов нет', async ({ page }) => {
  const { errors, external } = await openApp(page);
  await expect(page.getByRole('heading', { name: 'Inflatia' })).toBeVisible();
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
    if (body && body.action === 'register') {
      return JSON.stringify({ token: 'sess', profile: { login: body.login, name: body.name, emblem: 'star', playerId: body.playerId, stats: {} } });
    }
    if (body && body.action === 'join') {
      if (body.session !== 'sess') return JSON.stringify({ error: 'нет сессии' });
      joined = true; return JSON.stringify({ token: 'tok', seat: 'ministry_finance', storage: 'memory', room });
    }
    if (body && body.action === 'submit') submitted = body;
    return JSON.stringify({ room: joined ? room : lobby, storage: 'memory' });
  });

  await page.getByText('Минфин', { exact: true }).first().click();
  // по сети — только с профилем: без него кнопка ведёт в регистрацию
  await page.getByRole('button', { name: 'Войти в профиль и в партию' }).click();
  const auth = page.getByRole('dialog', { name: 'Профиль игрока' });
  await auth.getByLabel('Логин').fill('boris');
  await auth.getByLabel('Пароль').fill('secret1');
  await auth.getByLabel('Имя в игре').fill('Борис');
  await auth.getByRole('button', { name: 'Создать профиль' }).click();
  await expect(auth).toBeHidden();
  await expect(page.getByText('@boris')).toBeVisible();
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
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
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

test('вызов дня: карточка в меню, общий старт и счётчик кварталов', async ({ page }) => {
  const { errors } = await openApp(page);
  await expect(page.getByText(/Вызов дня ·/)).toBeVisible();
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
  // таблица рекордов открывается и зовёт войти в профиль
  await page.getByRole('button', { name: 'Рекорды' }).click();
  const recs = page.getByRole('dialog', { name: 'Рекорды «Своего дела»' });
  await expect(recs.getByText(/войдите в профиль/)).toBeVisible();
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

test('профиль: регистрация из меню, профиль со статистикой и выход', async ({ page }) => {
  const { errors } = await openApp(page, '/', (req) => {
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    const profile = { login: 'anna', name: 'Анна', emblem: 'star', playerId: 'p1', createdAt: Date.now(), stats: { rooms: 3, quarters: 12, leaves: 1 } };
    if (body && body.action === 'register') return JSON.stringify({ token: 'sess', profile, recoveryCode: 'ABCD-EFGH-JKMN' });
    if (body && body.action === 'recover') return JSON.stringify({ token: 'sess2', profile, recoveryCode: 'PQRS-TUVW-XYZ2' });
    if (body && body.action === 'login') return JSON.stringify({ token: 'sess', profile });
    if (body && body.action === 'me') return JSON.stringify({ profile });
    if (body && body.action === 'update') return JSON.stringify({ profile: { ...profile, emblem: body.emblem || 'star' } });
    return '{}';
  });
  await page.getByRole('button', { name: 'Войти в профиль' }).click();
  const auth = page.getByRole('dialog', { name: 'Профиль игрока' });
  await auth.getByLabel('Логин').fill('anna');
  await auth.getByLabel('Пароль').fill('secret1');
  await auth.getByRole('button', { name: 'Создать профиль' }).click();
  // почты нет — код восстановления показывается один раз, до закрытия окна
  await expect(page.getByTestId('recovery-code')).toHaveText('ABCD-EFGH-JKMN');
  await page.getByRole('button', { name: 'Я сохранил код' }).click();
  await page.getByRole('button', { name: 'Профиль: Анна' }).click();
  const prof = page.getByRole('dialog', { name: 'Профиль' });
  await expect(prof.getByText('Кварталов по сети')).toBeVisible();
  await expect(prof.getByText('12', { exact: true })).toBeVisible();
  await prof.getByRole('button', { name: 'Корона' }).click();
  await expect(prof.getByText('Сохранено')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await prof.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('button', { name: 'Войти в профиль' })).toBeVisible();

  // забыли пароль: логин, код и новый пароль → новый код
  await page.getByRole('button', { name: 'Войти в профиль' }).click();
  await auth.getByRole('tab', { name: 'У меня есть профиль' }).click();
  await auth.getByRole('button', { name: 'Забыли пароль?' }).click();
  await auth.getByLabel('Логин').fill('anna');
  await auth.getByLabel('Код восстановления').fill('abcd-efgh-jkmn');
  await auth.getByLabel('Новый пароль').fill('fresh12');
  await auth.getByRole('button', { name: 'Задать новый пароль' }).click();
  await expect(page.getByTestId('recovery-code')).toHaveText('PQRS-TUVW-XYZ2');
  await page.getByRole('button', { name: 'Я сохранил код' }).click();
  await expect(page.getByRole('button', { name: 'Профиль: Анна' })).toBeVisible();
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
  await openTab(page, 'theory');
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
  await expect(multi.getByTestId('tb-verdict')).toContainText('в) неверно');
  await multi.getByRole('textbox', { name: 'Задача 1, шаг в)' }).fill('39');
  await multi.getByRole('button', { name: 'Уверен', exact: true }).click();
  await multi.getByRole('button', { name: 'Проверить' }).click();
  await expect(multi.getByTestId('tb-verdict')).toContainText('Верно: а) 24 ед.; б) 20 руб.; в) 39 ед.');
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
  await page.getByTestId('tb-back').click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'supply-demand');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(Math.max(0, y0 - 400));
  // крупнее текст — и ничего не уезжает вбок
  await page.getByRole('button', { name: 'Крупнее текст' }).click();
  await page.getByRole('button', { name: 'Крупнее текст' }).click();
  await expect(page.getByTestId('tb-reader-bar')).toContainText('130%');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Мельче текст' }).click();
  await page.getByRole('button', { name: 'Мельче текст' }).click();

  await ch.getByRole('button', { name: /Оглавление/ }).first().click();
  await expect(toc.getByText(/прочитано глав/)).toContainText('прочитано глав: 1');
  // уверенные ответы: три из шести верны (включая задачу в несколько шагов), неуверенный — верен
  await expect(page.getByTestId('tb-confidence')).toContainText('верно 3 из 6 (50%)');
  await expect(page.getByTestId('tb-confidence')).toContainText('неуверенные: верно 1 из 2');
  // «на сегодня»: первый раздел главы, где остановились, с вопросом на вспоминание; повторение ждёт своего дня
  await expect(page.getByTestId('today-card')).toContainText('раздел «Спрос»');
  await page.getByTestId('today-card').getByRole('button', { name: 'Начать занятие' }).click();
  const today = page.getByTestId('today');
  await expect(today.getByTestId('today-section')).toContainText('Спрос и предложение');
  const recall = today.getByTestId('tb-recall').first();
  // сначала свой ответ: без него эталон не открыть, кроме как через «Не помню»
  await expect(recall.getByRole('button', { name: 'Сверить с ответом' })).toBeDisabled();
  await expect(recall.getByRole('button', { name: 'Вспомнил' })).toHaveCount(0);
  await recall.getByRole('textbox').fill('при росте цены покупают меньше, при прочих равных');
  await recall.getByRole('button', { name: 'Сверить с ответом' }).click();
  await expect(recall.getByTestId('tb-recall-answer')).toBeVisible();
  await recall.getByRole('button', { name: 'Совпало', exact: true }).click();
  await expect(recall.getByTestId('tb-recall-verdict')).toContainText('Раздел пройден');
  await expect(today.getByTestId('review')).toContainText('через 2 дня');
  await expectNoSidewaysScroll(page);
  await today.getByRole('button', { name: /Оглавление/ }).first().click();
  await expect(toc.locator('.tb-toc-row', { hasText: 'Спрос и предложение' })).toContainText('разделы 1/4');

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
  await page.getByTestId('chapter').getByRole('button', { name: /Оглавление/ }).first().click();
  await toc.getByRole('button', { name: /Совокупный спрос и совокупное предложение/ }).click();
  const adas = page.locator('[data-chart="ad-as"]').nth(1);
  await expect(adas.getByTestId('tb-readout')).toContainText('Выпуск Y: 1100');
  await adas.getByRole('slider', { name: 'Ожидаемые цены Pᵉ' }).fill('2.2');
  await expect(adas.getByTestId('tb-readout')).toContainText('Выпуск Y: 1081,2');
  await expect(adas.getByTestId('tb-readout')).toContainText('Уровень цен P: 2,16');
  await expectNoSidewaysScroll(page);

  // монополия: график с ползунком издержек и правило Лернера в числах
  await page.getByTestId('chapter').getByRole('button', { name: /Оглавление/ }).first().click();
  await toc.getByRole('button', { name: /Совершенная конкуренция и монополия/ }).click();
  const mono = page.locator('[data-chart="monopoly"]').first();
  await expect(mono.getByTestId('tb-readout')).toContainText('Цена: 60');
  await mono.getByRole('slider', { name: 'Предельные издержки MC' }).fill('30');
  await expect(mono.getByTestId('tb-readout')).toContainText('Цена: 65');
  await expect(page.getByRole('button', { name: 'Своё дело: правило Лернера' })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // издержки: огибающая LRAC и ссылка на производную в приложении «Математика для экономиста»
  await page.getByTestId('chapter').getByRole('button', { name: /Оглавление/ }).first().click();
  await toc.getByRole('button', { name: /Издержки и прибыль/ }).click();
  const lrac = page.locator('[data-chart="lrac"]');
  await expect(lrac.getByTestId('tb-readout')).toContainText('положительный эффект масштаба');
  await lrac.getByRole('slider').fill('60');
  await expect(lrac.getByTestId('tb-readout')).toContainText('минимально эффективный масштаб');
  await page.getByRole('button', { name: 'приложение «Математика для экономиста»' }).click();
  await expect(page.getByTestId('appendix')).toHaveAttribute('data-appendix', 'math');
  await expect(page.locator('#derivative')).toBeInViewport();
  await page.getByTestId('tb-back').click();
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'costs');

  // приложения: «игра ↔ учебник» с кнопками в Лабораторию, ограничения модели и словарь
  await page.getByTestId('chapter').getByRole('button', { name: /Оглавление/ }).first().click();
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
  await openTab(page, 'theory');
  const toc = page.getByTestId('textbook');
  await toc.locator('.tb-toc-row', { hasText: 'ВВП и система национальных счетов' }).click();
  const circ = page.locator('[data-diagram="circular"]');
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('потратили');
  await circ.getByRole('button', { name: 'По добавленной стоимости' }).click();
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('300 + 400 + 300 = 1000');
  await circ.getByRole('button', { name: 'По доходам' }).click();
  await expect(circ.getByTestId('tb-diagram-note')).toContainText('вместе 1000');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: /Оглавление/ }).first().click();
  await toc.locator('.tb-toc-row', { hasText: 'Деньги и банки' }).click();
  const bal = page.locator('[data-diagram="balance"]');
  await expect(bal.getByTestId('tb-money')).toContainText('1000');
  await bal.getByRole('button', { name: 'Дальше' }).click();
  await expect(bal.getByTestId('tb-money')).toContainText('1900');
  await expect(bal.getByTestId('tb-bank')).toContainText('Вклад Бориса');
  await bal.getByRole('button', { name: /Итог/ }).click();
  await expect(bal.getByTestId('tb-money')).toContainText('10000');
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('нижняя панель: «Мир» без учебных карточек, «На сегодня» в практике ведёт в занятие; итоговая проверка, вперемешку и «Мой прогресс»', async ({ page }) => {
  const { errors, external } = await openApp(page);
  await expect(page.locator('.menu-section-label', { hasText: 'Модель в действии' })).toBeVisible();
  await expect(page.locator('.menu-section-label', { hasText: 'Играть' })).toBeVisible();
  await expect(page.locator('[data-mode="tutorial"]')).toContainText('Как играть');
  // учебник и «Продолжить учиться» переехали в «Теорию» и «Практику»
  await expect(page.getByTestId('menu-study')).toHaveCount(0);
  await expect(page.locator('[data-mode="textbook"]')).toHaveCount(0);
  await expect(page.locator('[data-mode="lab"]')).toBeVisible();
  // «На сегодня»: одно нажатие открывает раздел и повторение
  await openTab(page, 'practice');
  const study = page.getByTestId('practice-today');
  await expect(study).toContainText('на повторение: 0');
  // минуты — те же, что покажет учебник: одна функция и один расчёт
  const minutes = (await study.innerText()).match(/≈(\d+) мин/)[1];
  await study.click();
  await expect(page.getByTestId('shell')).toHaveAttribute('data-tab', 'theory');
  await expect(page.getByTestId('today-section')).toContainText(`≈${minutes} мин`);
  await expectNoSidewaysScroll(page);

  await openTab(page, 'theory');
  const check = page.getByTestId('tb-check');
  // вперемешку: пока ни одна глава не начата — не из чего выбирать
  await check.getByRole('button', { name: /Задачи вперемешку/ }).click();
  await expect(page.getByTestId('mixed')).toContainText('Пока не из чего выбирать');
  await page.getByRole('button', { name: /Оглавление/ }).first().click();
  // итоговая проверка: без подсказок и решений до конца, в конце — счёт по темам
  await check.getByRole('button', { name: /Итоговая проверка: Микро/ }).click();
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
  // «Мой прогресс»: слабые темы со ссылками и журнал
  await page.getByRole('button', { name: /Оглавление/ }).first().click();
  await check.getByRole('button', { name: /Мой прогресс/ }).click();
  const stats = page.getByTestId('stats');
  await expect(stats.getByTestId('stats-weak').getByRole('button')).toHaveCount(3);
  await expect(stats.getByTestId('tb-journal')).toContainText('За четыре недели');
  await stats.getByTestId('stats-weak').getByRole('button').first().click();
  await expect(page.getByTestId('chapter')).toBeVisible();
  await page.getByTestId('chapter').getByRole('button', { name: 'Отметить главу прочитанной' }).click();
  // вперемешку: теперь глава прочитана — сначала выбор модели, потом задача
  await page.getByRole('button', { name: /Оглавление/ }).first().click();
  await page.getByTestId('tb-check').getByRole('button', { name: /Задачи вперемешку/ }).click();
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
  await openTab(page, 'theory');
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
  await openTab(page, 'theory');
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
  await openTab(page, 'theory');
  const toc = page.getByTestId('textbook');
  await expect(toc.getByRole('button', { name: /Ограниченность и выбор/ })).toContainText('прочитана');
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
    // цифры — с экранной клавиатуры, как на телефоне
    for (const ch of wrong ? '99999' : ans) {
      if (ch === '-') await ex.getByRole('button', { name: 'Минус' }).click();
      else await ex.getByRole('group', { name: 'Цифровая клавиатура' }).getByRole('button', { name: ch, exact: true }).click();
    }
  } else if (kind === 'order') {
    const seq = wrong ? [...ans].reverse() : ans;
    for (const k of seq) await ex.locator(`button[data-key="${k}"]`).click();
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
  }
  await page.getByRole('button', { name: 'Проверить' }).click();
  const fb = page.getByTestId('ex-feedback');
  await expect(fb).toHaveAttribute('data-ok', String(!wrong));
  return kind;
}
// пройти урок до экрана итогов; wrongAt — номера упражнений, где ошибиться нарочно
async function playLesson(page, { wrongAt = [] } = {}) {
  const kinds = new Set();
  let retries = 0;
  for (let i = 0; i < 40; i += 1) {
    if (await page.getByTestId('lesson-result').isVisible()) break;
    if (await page.getByTestId('ex-retry').isVisible()) retries += 1;
    kinds.add(await answerExercise(page, { wrong: wrongAt.includes(i) }));
    await page.getByRole('button', { name: 'Дальше' }).click();
  }
  await expect(page.getByTestId('lesson-result')).toBeVisible();
  return { kinds, retries };
}
const withTestFlag = (page) => page.addInitScript(() => { window.__INFLATIA_TEST__ = true; });

test('путь: урок целиком на телефоне — идея, ошибка и её повтор, итоги, следующий урок открыт', async ({ page }) => {
  await withTestFlag(page);
  const { errors, external } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  await expect(path).toBeVisible();
  await expect(page.getByTestId('bottom-nav').getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('streak')).toHaveText('0');
  // пилотный юнит — уроками, остальные главы — «скоро» со ссылкой в «Теорию»
  await expect(path.getByTestId('path-lesson')).toHaveCount(6);
  await expect(path.locator('[data-state="open"]')).toHaveCount(1);
  await expect(path.getByTestId('path-soon').first()).toContainText('скоро');
  await expectNoSidewaysScroll(page);

  await path.locator('[data-lesson="sd-l1"]').click();
  await expect(page.getByTestId('lesson-idea')).toContainText('Закон спроса');
  await expect(page.getByTestId('lesson-idea').locator('svg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Начать' }).click();
  // первое упражнение — неверно: красная плашка с правильным ответом и обещанием повтора
  await answerExercise(page, { wrong: true });
  await expect(page.getByTestId('lesson-foot')).toContainText('Правильно:');
  await expect(page.getByTestId('lesson-foot')).toContainText('вернётся в конце урока');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Дальше' }).click();
  const { retries } = await playLesson(page);
  expect(retries, 'ошибка вернулась в конце урока').toBe(1);
  const result = page.getByTestId('lesson-result');
  await expect(result).toContainText('Урок пройден');
  await expect(result.getByTestId('result-xp')).toContainText('+');
  await expect(result.getByTestId('result-acc')).not.toContainText('100%');
  await expect(result).not.toContainText('Урок уже был пройден');
  await expect(result.getByTestId('mascot')).toHaveAttribute('data-mood', 'party');
  await result.getByRole('button', { name: 'Дальше' }).click();

  // путь: урок пройден, следующий открыт, серия и цель дня засчитаны
  await expect(path.locator('[data-lesson="sd-l1"]')).toHaveAttribute('data-state', 'done');
  await expect(path.locator('[data-lesson="sd-l2"]')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByTestId('goal')).toContainText('1/1');
  // ошибка ушла в «Практику», статистика — в «Профиль»
  await openTab(page, 'practice');
  await expect(page.getByTestId('practice-mistakes')).toBeEnabled();
  await openTab(page, 'profile');
  await expect(page.getByTestId('prof-completion')).toContainText('100%');
  await expect(page.getByTestId('prof-types')).toContainText('Выбор ответа');
  // повтор пройденного урока — «Подробнее в теории» ведёт в раздел главы
  await openTab(page, 'path');
  await path.locator('[data-lesson="sd-l1"]').click();
  await page.getByRole('button', { name: 'Начать' }).click();
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Урок уже был пройден');
  await page.getByTestId('result-theory').click();
  await expect(page.getByTestId('shell')).toHaveAttribute('data-tab', 'theory');
  await expect(page.getByTestId('chapter')).toHaveAttribute('data-chapter', 'supply-demand');
  await expect(page.locator('#demand')).toBeInViewport();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('путь: газета и «куда сдвинется?», выход из урока, практика ошибок, проверка юнита и легенда', async ({ page }) => {
  await withTestFlag(page);
  // первые четыре урока уже пройдены
  await page.addInitScript(() => {
    const at = Date.now() - 86400000;
    const lessons = Object.fromEntries(['sd-l1', 'sd-l2', 'sd-l3', 'sd-l4'].map((id) => [id, { at, runs: 1, best: 90 }]));
    localStorage.setItem('ems-textbook-v1', JSON.stringify({ learn: { lessons } }));
  });
  const { errors } = await openApp(page, '/', '{}', { tab: 'path' });
  const path = page.getByTestId('path');
  await expect(path.locator('[data-lesson="sd-l5"]')).toHaveAttribute('data-state', 'open');
  // выйти посреди урока — мягкий вопрос, без наказаний
  await path.locator('[data-lesson="sd-l5"]').click();
  await page.getByRole('button', { name: 'Начать' }).click();
  await answerExercise(page);
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Выйти из урока' }).click();
  await expect(page.getByText('Выйти из урока?')).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByTestId('lesson')).toHaveCount(0);
  await openTab(page, 'profile');
  await expect(page.getByTestId('prof-quits')).toContainText('прерывали');
  await expect(page.getByTestId('prof-completion')).toContainText('0%');

  // урок 5 целиком: газета и сдвиг кривой, с одной ошибкой
  await openTab(page, 'path');
  await path.locator('[data-lesson="sd-l5"]').click();
  await page.getByRole('button', { name: 'Начать' }).click();
  const { kinds } = await playLesson(page, { wrongAt: [2] });
  expect([...kinds]).toEqual(expect.arrayContaining(['news', 'shift']));
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше' }).click();
  // практика: ошибка решается — и уходит из списка
  await openTab(page, 'practice');
  await page.getByTestId('practice-mistakes').click();
  await playLesson(page);
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByTestId('practice-mistakes')).toBeDisabled();

  // проверка юнита: сдана — все уроки открыты, юнит пройден, открывается «уровень легенды»
  await openTab(page, 'path');
  await page.getByTestId('unit-check').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'check');
  await playLesson(page);
  await expect(page.getByTestId('lesson-result')).toContainText('Проверка сдана');
  await page.getByTestId('lesson-result').getByRole('button', { name: 'Дальше' }).click();
  await expect(path.locator('[data-state="done"]')).toHaveCount(6);
  await page.getByTestId('unit-legend').click();
  await expect(page.getByTestId('lesson')).toHaveAttribute('data-mode', 'legend');
  await expect(page.getByTestId('ex')).toBeVisible();
  await expectNoSidewaysScroll(page);
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
    await page.getByTestId('path').locator('[data-lesson="sd-l1"]').click();
    await expect(page.getByTestId('lesson-idea')).toBeVisible();
    await context.setOffline(false);
  });
});
