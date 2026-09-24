import { test, expect } from '@playwright/test';
import { freshRoom, resolveQuarter, publicView } from '../api/room.js';
import { makeInitialEconomy, defaultDecisions } from '../src/lib/engine.js';

/* Общая подготовка каждой страницы: серверные функции подменены, внешние
   запросы и ошибки страницы собираются — тест падает, если сайт полез за
   чем-то наружу (шрифты должны быть свои) или упал JavaScript. */
async function openApp(page, path = '/', apiBody = '{}') {
  const errors = []; const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) external.push(r.url()); });
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: typeof apiBody === 'function' ? apiBody(r.request()) : apiBody }));
  await page.goto(path, { waitUntil: 'networkidle' });
  return { errors, external };
}

// ничего на странице не шире окна — ровно та жалоба «сайт можно увести вбок»
async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'страницу можно прокрутить вбок').toBeLessThanOrEqual(1);
}

async function startSoloGame(page, role = 'Глава Центрального банка') {
  await page.getByText('Партия у руля страны', { exact: true }).click();
  await page.getByText(role, { exact: true }).click();
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
  }
  expect(errors).toEqual([]);
});

test('обучение: хаб и программа курса открываются', async ({ page }) => {
  const { errors } = await openApp(page);
  await page.getByText('Обучение', { exact: true }).click();
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
  await page.screenshot({ path: `test-results/society-${isMobile ? 'phone' : 'desktop'}.png`, fullPage: true });
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test('президент ведёт наступление на карте: цель, штурм, продвижение', async ({ page, isMobile }) => {
  test.skip(isMobile, 'сценарий проверяется на ширине компьютера');
  const { errors } = await openApp(page);
  await startSoloGame(page, 'Президент');
  await page.getByText('Война', { exact: true }).first().click();
  await page.getByRole('button', { name: /^Начать военную операцию/ }).click();
  await page.getByRole('button', { name: 'Завершить квартал и применить решения' }).click();
  const close = page.getByRole('button', { name: 'Закрыть газету' });
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.getByText('Наступление на Норланд.')).toBeVisible();
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
  await expectNoSidewaysScroll(page);
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
  await page.goto('/', { waitUntil: 'networkidle' });
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
  await page.goto('/', { waitUntil: 'networkidle' });
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
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByText('Обучение', { exact: true }).click();
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
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByText('Обучение', { exact: true }).click();
  await page.getByText('Президент', { exact: true }).first().click();
  await page.getByText('Война, мир и реванш', { exact: true }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^Далее/ }).click();
  for (const t of ['Сначала нужно взять Ледяной перевал', 'Действуют партизаны', 'Признание новой границы', 'Доля обороны держится на новом уровне']) await page.getByText(t, { exact: false }).first().click();
  await page.getByRole('button', { name: 'Проверить ответы' }).click();
  await page.getByRole('button', { name: /^Далее/ }).click();
  await expect(page.getByText('Практика: отбить наступление Дешта')).toBeVisible();
  await page.getByRole('button', { name: /Контрудар/ }).click();
  for (let i = 0; i < 5; i++) {
    const btn = page.getByRole('button', { name: 'Завершить квартал' });
    if (!(await btn.isVisible())) break;
    await btn.click();
  }
  await expect(page.getByRole('button', { name: /^Далее/ })).toBeEnabled();
  expect(errors).toEqual([]);
});
