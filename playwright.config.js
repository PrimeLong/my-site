import { defineConfig, devices } from '@playwright/test';

/* Браузерные smoke-тесты: проверяют то, что юнит-тесты движка не видят, —
   что приложение открывается, партия играется, газета закрывается, карта
   рисуется, а на телефоне ничего не уезжает вбок. Тесты гоняются по
   собранному сайту (vite preview), как его увидит игрок. Серверных функций
   (api/) в preview нет — тесты подставляют ответы сами. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.js$/,
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // в облачной песочнице разработки Chromium уже лежит рядом с Playwright
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 950 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
