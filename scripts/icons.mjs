/* Иконки и картинка для ссылок из public/favicon.svg — единого источника знака Inflatia.
   Запуск: node scripts/icons.mjs (нужен Chromium для Playwright; путь можно задать
   переменной PW_CHROMIUM). Пишет в public/: icon-192.png, icon-512.png,
   apple-touch-icon.png и og-image.png. */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
const mark = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const font = (name, w) => `url(data:font/woff2;base64,${readFileSync(path.join(root, `node_modules/@fontsource/${name}/files/${name}-cyrillic-${w}-normal.woff2`)).toString('base64')})`;
const fonts = `
  @font-face { font-family: 'PT Serif'; font-weight: 700; src: ${font('pt-serif', 700)}; }
  @font-face { font-family: 'PT Sans'; font-weight: 400; src: ${font('pt-sans', 400)}; }`;

// квадратная иконка: тёмный фон во весь квадрат (маска на Android обрежет углы сама),
// знак — в безопасной зоне ~62% стороны
const iconPage = (size) => `<html><head><style>${fonts} html,body{margin:0}</style></head>
  <body style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 40%, #1A2436 0%, #0B0F17 72%)">
    <img src="${mark}" style="width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.62)}px;margin-top:${Math.round(size * 0.04)}px">
  </body></html>`;

const ogPage = `<html><head><style>${fonts} html,body{margin:0}</style></head>
  <body style="width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;
    background:radial-gradient(ellipse at 28% 45%, #1C2740 0%, #0B0F17 62%);color:#E8E2D0;font-family:'PT Sans'">
    <img src="${mark}" style="width:300px;height:300px;flex-shrink:0">
    <div>
      <div style="font-family:'PT Serif';font-weight:700;font-size:118px;line-height:1;color:#E8C766;letter-spacing:0.01em">Inflatia</div>
      <div style="margin-top:18px;font-size:25px;letter-spacing:0.22em;text-transform:uppercase;color:#C9A227">Симулятор государства и бизнеса</div>
      <div style="margin-top:34px;font-size:27px;line-height:1.45;color:#B9B3A2;max-width:640px">
        Ставка, бюджет, выборы, войны и общество — или своё дело внутри живой экономики.
      </div>
    </div>
  </body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const shoot = async (html, w, h, out) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'public', out) });
  await page.close();
  console.log('public/' + out);
};
await shoot(iconPage(192), 192, 192, 'icon-192.png');
await shoot(iconPage(512), 512, 512, 'icon-512.png');
await shoot(iconPage(180), 180, 180, 'apple-touch-icon.png');
await shoot(ogPage, 1200, 630, 'og-image.png');
await browser.close();
