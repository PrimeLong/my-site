/* Файлы логотипа для скачивания (папка logo/): знак 1024 px на прозрачном фоне и
   горизонтальный логотип для тёмного и светлого фона. Источник — public/favicon.svg.
   Запуск: node scripts/logo-export.mjs (путь к Chromium — переменная PW_CHROMIUM). */
import { chromium } from '@playwright/test';
import { readFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(`${root}/public/favicon.svg`, 'utf8');
const mark = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const f = (n, w) => `url(data:font/woff2;base64,${readFileSync(`${root}/node_modules/@fontsource/${n}/files/${n}-cyrillic-${w}-normal.woff2`).toString('base64')})`;
const latin = (n, w) => `url(data:font/woff2;base64,${readFileSync(`${root}/node_modules/@fontsource/${n}/files/${n}-latin-${w}-normal.woff2`).toString('base64')})`;
const fonts = `@font-face{font-family:'PT Serif';font-weight:700;src:${latin('pt-serif', 700)};}
  @font-face{font-family:'PT Serif';font-weight:700;src:${f('pt-serif', 700)};unicode-range:U+0400-04FF;}
  @font-face{font-family:'PT Sans';font-weight:400;src:${f('pt-sans', 400)};}`;
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const shot = async (html, w, h, out) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<html><head><style>${fonts} html,body{margin:0;background:transparent}</style></head><body>${html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${root}/logo/${out}`, omitBackground: true });
  await p.close();
};
await shot(`<img src="${mark}" style="width:1024px;height:1024px;display:block">`, 1024, 1024, 'inflatia-mark-1024.png');
const lockup = (color, sub) => `<div style="width:1600px;height:480px;display:flex;align-items:center;gap:48px;padding:0 60px;box-sizing:border-box">
  <img src="${mark}" style="width:380px;height:380px">
  <div><div style="font-family:'PT Serif';font-weight:700;font-size:200px;line-height:1;color:${color}">Inflatia</div>
  <div style="margin-top:22px;font-family:'PT Sans';font-size:38px;letter-spacing:0.22em;text-transform:uppercase;color:${sub}">Симулятор государства и бизнеса</div></div></div>`;
await shot(lockup('#E8C766', '#C9A227'), 1600, 480, 'inflatia-logo-dark-bg.png');
await shot(lockup('#1B1204', '#8A6D12'), 1600, 480, 'inflatia-logo-light-bg.png');
await b.close();
copyFileSync(`${root}/public/favicon.svg`, `${root}/logo/inflatia-mark.svg`);
copyFileSync(`${root}/public/icon-512.png`, `${root}/logo/inflatia-icon-512.png`);
copyFileSync(`${root}/public/og-image.png`, `${root}/logo/inflatia-og-1200x630.png`);
