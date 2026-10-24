/* ДИЗАЙН-СИСТЕМА ОБУЧЕНИЯ — ядро: переменные темы, классы и общие компоненты. Все экраны
   обучения (Путь, карточка урока, уроки всех видов, итоги, справочник, профиль, практика,
   вызов дня, вход и регистрация) и «Мир» собираются только из этого и из
   src/ds-art.jsx (гравюры, гильош, печати, марки, график прогресса, Инфля).

   Облик — светлый и живой (docs/world.md, «Цвета» и «Форма»): кнопка объёмная — скругление,
   снизу кромка темнее цвета, нажатие опускает её; карточка белая со скруглением и мягкой
   тенью; плашка ответа — яркая полоса с отметкой. Шрифты — PT Sans (заголовки, кнопки,
   текст: --ds-head, --ds-sans), PT Mono (числа); PT Serif — только у газеты (--ds-news).
   Ядро лёгкое и едет в стартовом файле (нижняя панель, «Мир»); иллюстрации — отдельно. */
import React from 'react';
import { DS_THEMES, tokenVars, worldTokens } from './ds-tokens.js';

export const DS_CSS = `
  .ds { background: var(--ds-paper); color: var(--ds-ink); font-family: var(--ds-sans); font-size: 16px; line-height: 1.5; -webkit-tap-highlight-color: transparent; --u-ink: color-mix(in srgb, var(--u) 80%, #000); }
  /* цвет юнита как текст — чуть темнее самого цвета: на светлых подложках контраст не ниже 4,5:1 */
  .ds.ds-dark { --u-ink: color-mix(in srgb, var(--u) 42%, #fff); }
  .ds *, .ds *::before, .ds *::after { box-sizing: border-box; }
  /* фон страницы — ровная бумага: подсветка сверху растягивалась на всю высоту длинной страницы
     (глава учебника) и гасла к низу видимыми полосами */
  .ds-page { min-height: 100vh; background-color: var(--ds-paper); }
  .ds :focus-visible { outline: 3px solid var(--ds-sel-rule); outline-offset: 2px; }

  /* типографика */
  .ds-h1 { font-family: var(--ds-head); font-weight: 700; font-size: 28px; line-height: 1.15; margin: 0; letter-spacing: -.015em; }
  .ds-h2 { font-family: var(--ds-head); font-weight: 700; font-size: 22px; line-height: 1.2; margin: 0; letter-spacing: -.01em; }
  .ds-h3 { font-family: var(--ds-head); font-weight: 700; font-size: 18px; line-height: 1.25; margin: 0; }
  .ds-eyebrow { font: 700 12px/1.3 var(--ds-sans); letter-spacing: .14em; text-transform: uppercase; color: var(--u-ink); }
  .ds-sub { color: var(--ds-ink2); }
  .ds-faint { color: var(--ds-ink3); }
  .ds-num { font-family: var(--ds-mono); font-variant-numeric: tabular-nums; }
  .ds-text { font-size: 17px; line-height: 1.55; }
  .ds-text p { margin: 0 0 10px; }
  .ds-rule { border: none; border-top: 1px solid var(--ds-rule); margin: 12px 0; }

  /* кнопка — объёмная: снизу кромка темнее цвета, нажатие опускает кнопку на её высоту */
  .ds-btn { --b: var(--u); --edge: color-mix(in srgb, var(--b) 68%, #000); position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 12px 24px;
    border: none; border-radius: 14px; font: 700 16px/1.2 var(--ds-head); letter-spacing: .04em; text-transform: uppercase; color: #fff; background: var(--b); cursor: pointer;
    box-shadow: 0 4px 0 var(--edge); margin-bottom: 4px;
    transition: transform .08s ease, box-shadow .08s ease, filter .15s; }
  .ds-btn:hover:not(:disabled) { filter: brightness(1.06) saturate(1.05); }
  /* основная кнопка: при наведении по ней пробегает блик (в покое он за краем кнопки и не виден). Запускает
     его installShine ниже: только если мышь задержалась на кнопке, и, раз начавшись, блик доходит до
     конца — даже если мышь тут же ушла; провели мимо или туда-сюда — кнопка не мигает */
  .ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary)::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, .3) 50%, transparent 65%) no-repeat; background-size: 250% 100%; background-position: 130% 0; }
  .ds-btn.ds-shining::after { animation: ds-shine .75s ease-out; }
  @keyframes ds-shine { from { background-position: 130% 0 } to { background-position: -30% 0 } }
  .ds-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 0 0 var(--edge); }
  /* «Мир» в тёмной теме: основная кнопка — светлое золото, на нём белый текст не читается — тёмная тушь */
  .ds.ds-dark[data-ds-theme="world"] .ds-btn:not(.ds-btn--secondary):not(.ds-btn--ghost):not(.ds-btn--ok):not(.ds-btn--bad):not(:disabled) { color: #1B1204; }
  .ds-btn:disabled { background: var(--ds-card2); color: var(--ds-ink3); box-shadow: 0 4px 0 var(--ds-rule2); cursor: default; }
  .ds-btn--secondary { background: var(--ds-card); color: var(--u-ink); box-shadow: inset 0 0 0 2px var(--ds-rule2), 0 4px 0 var(--ds-rule2); }
  .ds-btn--secondary:active:not(:disabled) { box-shadow: inset 0 0 0 2px var(--ds-rule2), 0 0 0 var(--ds-rule2); }
  .ds-btn--ghost { background: none; color: var(--u-ink); box-shadow: none; min-height: 40px; padding: 8px 10px; margin-bottom: 0; border-radius: 10px;
    font: 700 15px/1.3 var(--ds-sans); letter-spacing: 0; text-transform: none; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
  .ds-btn--ghost:active:not(:disabled) { transform: none; box-shadow: none; }
  .ds-btn--ok { --b: var(--ds-ok-btn); }
  .ds-btn--bad { --b: var(--ds-bad-btn); }
  /* «Дальше» после ошибки — тёплый мандарин (не красный); в тёмной теме — светлая тушь выбора, текст тёмный */
  .ds-btn--warm { --b: var(--ds-warm-btn); }
  .ds-dark .ds-btn--warm { color: #2A1D05; }
  .ds-btn--wide { width: 100%; }
  .ds-btn--small { min-height: 38px; padding: 7px 16px; font-size: 13.5px; border-radius: 12px; box-shadow: 0 3px 0 var(--edge); margin-bottom: 3px; }
  .ds-btn--small:active:not(:disabled) { transform: translateY(3px); }
  .ds-btn--secondary.ds-btn--small { box-shadow: inset 0 0 0 2px var(--ds-rule2), 0 3px 0 var(--ds-rule2); }
  /* тихая кнопка остаётся тихой и маленькой: без объёмной кромки */
  .ds-btn--ghost.ds-btn--small { box-shadow: none; margin-bottom: 0; }
  .ds-btn--ghost.ds-btn--small:active:not(:disabled) { transform: none; opacity: .75; }
  .ds-icon-btn { background: none; border: none; color: var(--ds-ink2); width: 42px; height: 42px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .ds-icon-btn:hover { background: var(--ds-card2); }
  .ds-icon-btn { transition: background-color .15s, transform .1s; }
  .ds-icon-btn:active { transform: scale(.9); }

  /* карточка-документ, панель, строки */
  /* текст только для чтения с экрана: подписи к значкам и числам */
  .ds-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .ds-card { background: var(--ds-card); border: 2px solid var(--ds-rule); border-radius: 18px; padding: 16px;
    box-shadow: 0 2px 0 var(--ds-rule), 0 6px 18px -10px var(--ds-shade); }
  .ds-card--flat { box-shadow: 0 2px 0 var(--ds-rule); }
  .ds-card--button { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer; margin: 10px 0; }
  .ds-card--button { transition: transform .15s ease, box-shadow .15s ease, border-color .15s; }
  .ds-card--button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 0 var(--ds-rule), 0 10px 22px -12px var(--ds-shade); }
  .ds-card--button:hover:not(:disabled) > span:first-child { animation: ds-wiggle .5s ease-in-out .25s; }
  .ds-card--button:active:not(:disabled) { transform: translateY(1px); }
  .ds-card--button:disabled { opacity: .6; cursor: default; }
  .ds-panel { background: var(--ds-card2); border-radius: 14px; padding: 12px 14px; }
  .ds-row { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; padding: 6px 0; border-bottom: 1px dotted var(--ds-rule2); }
  .ds-row:last-child { border-bottom: none; }
  .ds-row > span:first-child { color: var(--ds-ink2); }
  .ds-row > b { font-family: var(--ds-mono); font-weight: 700; }
  .ds-badge { display: inline-flex; align-items: center; gap: 4px; font: 700 12px/1 var(--ds-sans); letter-spacing: .06em; text-transform: uppercase; padding: 5px 9px; border: none; border-radius: 999px;
    color: var(--u-ink); background: color-mix(in srgb, var(--u) 12%, var(--ds-card)); }

  /* варианты ответа, плитки, клавиши */
  .ds-opt { display: block; width: 100%; text-align: left; padding: 13px 16px; margin: 8px 0; font: 16px/1.45 var(--ds-sans); color: var(--ds-ink);
    background: var(--ds-card); border: 2px solid var(--ds-rule2); border-radius: 14px; cursor: pointer; transition: border-color .12s, background .12s, transform .06s, box-shadow .06s;
    --edge: var(--ds-rule2); box-shadow: 0 3px 0 var(--edge); }
  /* нажатие только сдвигает плитку и прячет кромку — размеры не меняются, соседи не прыгают
     (раньше утоньшалась нижняя рамка: в шторке, прижатой к низу, от этого «проседали» кнопки выше) */
  .ds-opt:hover:not(:disabled) { background: color-mix(in srgb, var(--u) 4%, var(--ds-card)); }
  .ds-opt:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--edge); }
  .ds-opt[aria-pressed="true"], .ds-opt[aria-checked="true"] { --edge: color-mix(in srgb, var(--u) 75%, var(--ds-card)); border-color: var(--edge); background: color-mix(in srgb, var(--u) 11%, var(--ds-card)); color: var(--ds-ink); }
  .ds-opt.right { --edge: var(--ds-ok); border-color: var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ink); }
  .ds-opt.wrong { --edge: var(--ds-sel-rule); border-color: var(--ds-sel-rule); background: color-mix(in srgb, var(--ds-sel-rule) 12%, var(--ds-card)); color: var(--ds-ink); }
  /* верно/неверно видно не только по цвету: значок справа (вместо пунктирной рамки) */
  .ds-opt.right, .ds-opt.wrong { position: relative; padding-right: 40px; }
  .ds-opt.right::after, .ds-opt.wrong::after { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font: 700 18px/1 var(--ds-sans); }
  .ds-opt.right::after { content: '✓'; color: var(--ds-ok); }
  .ds-opt.wrong::after { content: '✕'; color: var(--ds-sel-ink); }
  .ds-opt:disabled { cursor: default; }
  .ds-chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 44px; padding: 8px 13px; margin: 4px; font: 15px/1.3 var(--ds-sans); color: var(--ds-ink);
    background: var(--ds-card); border: 2px solid var(--ds-rule2); border-radius: 12px; cursor: pointer; --edge: var(--ds-rule2); box-shadow: 0 2px 0 var(--edge); transition: transform .06s, box-shadow .06s; }
  .ds-chip:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 0 0 var(--edge); }
  .ds-chip[aria-pressed="true"], .ds-opt[aria-pressed="true"], .ds-opt[aria-checked="true"] { animation: ds-pop .26s cubic-bezier(.3,1.6,.5,1); }
  .ds-chip[aria-pressed="true"] { --edge: color-mix(in srgb, var(--u) 75%, var(--ds-card)); border-color: var(--edge); background: color-mix(in srgb, var(--u) 11%, var(--ds-card)); color: var(--ds-ink); }
  .ds-chip.right { --edge: var(--ds-ok); border-color: var(--ds-ok); }
  .ds-key { padding: 13px 0; font: 20px var(--ds-mono); color: var(--ds-ink); background: var(--ds-card); border: 2px solid var(--ds-rule2); border-radius: 12px; cursor: pointer;
    box-shadow: 0 3px 0 var(--ds-rule2); transition: transform .06s, box-shadow .06s; }
  .ds-key:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--ds-rule2); }

  /* поля и переключатели */
  .ds-field { width: 100%; padding: 12px 14px; font: 16px var(--ds-sans); color: var(--ds-ink); background: var(--ds-card); border: 2px solid var(--ds-rule2); border-radius: 12px; }
  .ds-field:focus { outline: none; border-color: var(--u); background: color-mix(in srgb, var(--u) 5%, var(--ds-card)); }
  .ds-label { display: block; font: 700 13px/1.3 var(--ds-sans); letter-spacing: .04em; color: var(--ds-ink2); margin-bottom: 14px; }
  .ds-label > input { margin-top: 6px; }
  .ds-toggle { width: 48px; height: 28px; border-radius: 14px; border: 1px solid var(--ds-rule2); background: var(--ds-card2); position: relative; cursor: pointer; flex-shrink: 0; }
  .ds-toggle { transition: background-color .2s ease, border-color .2s ease; }
  .ds-toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ds-card); border: 1px solid var(--ds-rule2); transition: left .28s cubic-bezier(.3,1.5,.5,1), width .15s; }
  .ds-toggle:active::after { width: 24px; }
  .ds-toggle[aria-checked="true"]:active::after { left: 19px; }
  .ds-toggle[aria-checked="true"] { background: var(--u); border-color: var(--u); }
  .ds-toggle[aria-checked="true"]::after { left: 23px; }

  /* плашка ответа — яркая полоса снизу с отметкой */
  .ds-answer { padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 3px solid var(--ds-rule2); border-radius: 18px 18px 0 0; }
  .ds-answer.ok { background: var(--ds-ok-bg); border-top-color: var(--ds-ok); }
  /* после ошибки — тёплый нейтральный тон, а не красный (docs/mechanics.md, «Обратная связь») */
  .ds-answer.bad { background: color-mix(in srgb, var(--ds-sel-rule) 14%, var(--ds-card)); border-top-color: var(--ds-sel-rule); }
  .ds-answer-stamp { display: inline-block; font: 700 14px/1 var(--ds-head); letter-spacing: .1em; text-transform: uppercase; padding: 7px 12px 6px; border: 2.5px solid currentColor;
    border-radius: 999px; transform: rotate(-3deg); }
  .ds-answer.ok .ds-answer-stamp { color: var(--ds-ok-ink); }
  .ds-answer.bad .ds-answer-stamp { color: var(--ds-sel-ink); }
  .ds-answer-say { display: inline-block; font: 700 19px/1.3 var(--ds-head); animation: ds-stamp .32s ease-out 1 both; }
  /* на светлой плашке ответа — тёмные оттенки «верно/неверно»: контраст не ниже 4,5:1 */
  .ds-answer.ok .ds-answer-say { color: var(--ds-ok-ink); }
  .ds-answer.bad .ds-answer-say { color: var(--ds-sel-ink); }

  /* шторка снизу, верхняя панель, нижняя панель вкладок */
  .ds-sheet-back { position: fixed; inset: 0; z-index: 320; background: rgba(28,20,8,.48); display: flex; align-items: flex-end; justify-content: center; animation: ds-fade .2s ease-out; }
  .ds-sheet { width: 100%; max-width: 560px; background: var(--ds-card); border-radius: 24px 24px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
    box-shadow: 0 -10px 30px rgba(60,30,0,.18); }
  .ds-topbar { display: flex; align-items: center; gap: 8px; min-height: 52px; }
  .ds-topbar-title { font: 700 17px/1.2 var(--ds-head); flex: 1; min-width: 0; }
  .ds-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 120; background: var(--ds-card); border-top: 2px solid var(--ds-rule);
    padding-bottom: env(safe-area-inset-bottom); }
  .ds-nav-in { display: flex; max-width: 560px; margin: 0 auto; }
  .ds-nav button { flex: 1; min-width: 0; background: none; border: none; cursor: pointer; padding: 10px 2px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: var(--ds-ink3); font: 700 12px/1.1 var(--ds-sans); letter-spacing: .04em; position: relative; }
  .ds-nav button[aria-current="page"] { color: var(--u-ink); cursor: default; }
  @media (max-width: 380px) { .ds-nav button { font-size: 12px; letter-spacing: 0; } }
  .ds-nav button[aria-current="page"]::before { content: ''; position: absolute; top: 5px; width: 52px; height: 30px; border-radius: 10px; background: color-mix(in srgb, var(--u) 13%, transparent); }
  .ds-nav button > * { position: relative; }
  /* меню «⋯» над нижней панелью: выбор из двух — Мир или Профиль */
  .ds-nav .ds-more { position: absolute; bottom: calc(100% + 8px); right: max(8px, calc(50% - 272px)); z-index: 121; min-width: 200px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
    background: var(--ds-card); border: 2px solid var(--ds-rule); border-radius: 16px; box-shadow: 0 12px 30px rgba(60, 30, 0, .18); }
  .ds-nav .ds-more button { flex: none; flex-direction: row; justify-content: flex-start; gap: 12px; padding: 12px 14px; min-height: 48px; border-radius: 12px; color: var(--ds-ink); font: 700 15.5px var(--ds-sans); letter-spacing: 0; cursor: pointer; }
  .ds-nav .ds-more button:hover, .ds-nav .ds-more button:focus-visible { background: var(--ds-card2); }
  .ds-nav .ds-more button[aria-current="page"] { color: var(--u-ink); }
  .ds-nav .ds-more button[aria-current="page"]::before { display: none; }
  .ds-nav .ds-more small { display: block; font: 400 12.5px var(--ds-sans); color: var(--ds-ink3); }
  .ds-nav .ds-more button > span { text-align: left; }
  .ds-nav .ds-more { animation: ds-more-in .2s cubic-bezier(.2,1.2,.4,1) both; transform-origin: 90% 100%; }
  .ds-nav .ds-more button { animation: ds-rise .25s ease-out both; }
  .ds-nav .ds-more button:nth-child(2) { animation-delay: .04s; } .ds-nav .ds-more button:nth-child(3) { animation-delay: .08s; }
  @keyframes ds-more-in { from { opacity: 0; transform: translateY(8px) scale(.94) } to { opacity: 1; transform: none } }
  /* новое за вкладкой: точка на значке и плашка в меню «⋯» */
  /* точка — поверх значка: у детей кнопки position: relative, и без «button >» точка уезжала под подпись, в нижний угол */
  .ds-nav button > .ds-nav-dot { position: absolute; top: 7px; left: calc(50% + 8px); width: 9px; height: 9px; border-radius: 50%; background: var(--ds-bad-btn); box-shadow: 0 0 0 2px var(--ds-card); }
  .ds-new { display: inline-block; margin-left: 6px; padding: 2px 7px; border-radius: 999px; background: var(--ds-bad-btn); color: #fff; font: 700 12px/1.3 var(--ds-sans); letter-spacing: .04em; vertical-align: 1px; }
  /* значок вкладки чуть подпрыгивает, когда её выбрали */
  .ds-nav button[aria-current="page"] > svg { animation: ds-tab-hop .32s cubic-bezier(.3,1.6,.5,1) both; }
  @keyframes ds-tab-hop { 0% { transform: translateY(0) scale(1) } 45% { transform: translateY(-3px) scale(1.1) } 100% { transform: none } }
  /* подложка выбранной вкладки выпрыгивает с пружинкой; точка «новое» мягко зовёт кольцом */
  .ds-nav button[aria-current="page"]::before { animation: ds-pill .42s cubic-bezier(.3, 1.5, .5, 1) backwards; }
  @keyframes ds-pill { from { opacity: 0; transform: scale(.45, .6) } }
  .ds-nav-dot::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: inherit; animation: ds-ping 2.2s cubic-bezier(0, 0, .2, 1) 1s infinite; }
  @keyframes ds-ping { 0% { transform: scale(1); opacity: .7 } 70%, 100% { transform: scale(2.6); opacity: 0 } }
  .ds-new { animation: ds-badge .5s cubic-bezier(.3, 1.6, .5, 1) .15s backwards; }
  @keyframes ds-badge { from { transform: scale(.3) rotate(-12deg); opacity: 0 } }
  .ds-icon-btn svg { transition: transform .25s cubic-bezier(.3, 1.4, .5, 1); }
  .ds-icon-btn:hover svg { transform: scale(1.1) rotate(-6deg); }
  .ds-nav button:active > svg { transform: scale(.88); }

  /* короткие анимации по делу */
  @keyframes ds-shake { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 50% { transform: translateX(5px) } 75% { transform: translateX(-3px) } }
  @keyframes ds-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
  @keyframes ds-fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes ds-pop { 0% { transform: scale(1) } 45% { transform: scale(1.045) } 100% { transform: scale(1) } }
  @keyframes ds-wiggle { 0%, 100% { transform: rotate(0) } 30% { transform: rotate(-8deg) scale(1.06) } 65% { transform: rotate(5deg) } }
  @keyframes ds-stamp { 0% { transform: scale(1.7) rotate(-14deg); opacity: 0 } 60% { transform: scale(.94) rotate(-4deg); opacity: 1 } 100% { transform: scale(1) rotate(-4deg); opacity: 1 } }
  @keyframes ds-flash { 0% { box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--ds-ok) 22%, transparent) } 100% { box-shadow: inset 0 0 0 999px transparent } }
  .ds-shake { animation: ds-shake .36s ease-in-out 1; }
  .ds-rise { animation: ds-rise .22s ease-out 1; }
  .ds-flash { animation: ds-flash .5s ease-out 1; }
  .ds-answer .ds-answer-stamp { animation: ds-stamp .32s ease-out 1 both; }
  @media (prefers-reduced-motion: reduce) {
    .ds, .ds *, .ds *::before, .ds *::after { animation: none !important; transition: none !important; }
  }
`;

/* Блик на основных кнопках — по наведению мыши. Задержка SHINE.wait: провели мышью мимо — блика нет.
   Блик начался — доигрывает до конца (класс снимается по окончании анимации, а не когда мышь ушла);
   после него — пауза SHINE.rest, чтобы кнопка не мигала, если водить мышью туда-сюда. */
const SHINE = { wait: 220, run: 750, rest: 900 };
const SHINE_SEL = '.ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary):not(:disabled)';
let shineOn = false;
export function installShine(doc = typeof document !== 'undefined' ? document : null) {
  if (shineOn || !doc) return;
  shineOn = true;
  const st = new WeakMap();
  doc.addEventListener('pointerover', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const btn = e.target && e.target.closest ? e.target.closest(SHINE_SEL) : null;
    if (!btn) return;
    const s = st.get(btn) || {};
    if (s.timer || btn.classList.contains('ds-shining') || (s.until && Date.now() < s.until)) return;
    s.timer = setTimeout(() => {
      s.timer = null;
      if (!btn.isConnected || !btn.matches(':hover')) return;
      btn.classList.add('ds-shining');
      // на случай, если анимации нет (меньше движения) и её конец не наступит
      s.done = setTimeout(() => { btn.classList.remove('ds-shining'); s.until = Date.now() + SHINE.rest; }, SHINE.run + 80);
    }, SHINE.wait);
    st.set(btn, s);
  });
  doc.addEventListener('pointerout', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(SHINE_SEL) : null;
    if (!btn || (e.relatedTarget && btn.contains(e.relatedTarget))) return;
    // ушли раньше, чем блик начался, — его не будет; начавшийся доиграет сам
    const s = st.get(btn);
    if (s && s.timer) { clearTimeout(s.timer); s.timer = null; }
  });
  doc.addEventListener('animationend', (e) => {
    if (e.animationName !== 'ds-shine' || !e.target.classList) return;
    e.target.classList.remove('ds-shining');
    const s = st.get(e.target);
    if (s) { clearTimeout(s.done); s.until = Date.now() + SHINE.rest; }
  });
}

export function DsStyle() {
  React.useEffect(() => { installShine(); }, []);
  return <style>{DS_CSS}</style>;
}

/* Корень экрана: тема (paper | ink) или игровая тема «Мира» (world = COLOR),
   цвет юнита (accent). page — во весь экран с фоном бумаги. */
export function DsRoot({ theme = 'paper', world = null, accent, page = false, className = '', style, children, ...rest }) {
  const t = world ? worldTokens(world) : DS_THEMES[theme] || DS_THEMES.paper;
  return (
    <div className={`ds ${t.isDark ? 'ds-dark' : ''} ${page ? 'ds-page' : ''} ${className}`} style={{ ...tokenVars(t, accent), ...style }} data-ds-theme={world ? 'world' : theme} {...rest}>
      <DsStyle />
      {children}
    </div>
  );
}
// цвет юнита для части экрана: кнопки, подписи, линии внутри берут его
export const Accent = ({ color, children, style, ...rest }) => <div style={{ '--u': color, ...style }} {...rest}>{children}</div>;

const cx = (...list) => list.filter(Boolean).join(' ');
export function Button({ variant = 'primary', wide = false, small = false, icon: Icon = null, className, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={cx('ds-btn', variant !== 'primary' && `ds-btn--${variant}`, wide && 'ds-btn--wide', small && 'ds-btn--small', className)} {...rest}>
      {Icon && <Icon size={small ? 15 : 18} aria-hidden="true" />}{children}
    </button>
  );
}
export function IconButton({ label, icon: Icon, size = 24, className, ...rest }) {
  return <button type="button" className={cx('ds-icon-btn', className)} aria-label={label} {...rest}><Icon size={size} aria-hidden="true" /></button>;
}
export function Card({ flat = false, as: Tag = 'div', className, children, ...rest }) {
  return <Tag className={cx('ds-card', flat && 'ds-card--flat', className)} {...rest}>{children}</Tag>;
}
// карточка-кнопка: значок, заголовок, пояснение, стрелка
export function MenuCard({ icon: Icon, tone, title, text, right = null, className, disabled, ...rest }) {
  return (
    <button type="button" className={cx('ds-card', 'ds-card--button', className)} disabled={disabled} {...rest}>
      {Icon && (
        <span style={{ width: 44, height: 44, borderRadius: 12, background: tone || 'var(--u)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25)' }}><Icon size={22} aria-hidden="true" /></span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ds-h3" style={{ display: 'block' }}>{title}</span>
        {text && <span className="ds-sub" style={{ fontSize: 14 }}>{text}</span>}
      </span>
      {right}
    </button>
  );
}
export const Panel = ({ className, children, ...rest }) => <div className={cx('ds-panel', className)} {...rest}>{children}</div>;
// заголовок экрана: подпись капителью, заголовок, пояснение
export function Heading({ eyebrow, title, sub, level = 1, children, className, ...rest }) {
  const Tag = `h${level}`;
  return (
    <div className={className} {...rest}>
      {eyebrow && <div className="ds-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
      <Tag className={level === 1 ? 'ds-h1' : level === 2 ? 'ds-h2' : 'ds-h3'}>{title}</Tag>
      {sub && <div className="ds-sub" style={{ fontSize: 15, marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
export const Row = ({ label, value, ...rest }) => <div className="ds-row" {...rest}><span>{label}</span><b>{value}</b></div>;
export function Toggle({ on, label, onChange, ...rest }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="ds-toggle" onClick={() => onChange(!on)} {...rest} />;
}
export function Field({ label, ...rest }) {
  return <label className="ds-label">{label}<input className="ds-field" {...rest} /></label>;
}
// плашка ответа: отметка, заголовок и пояснение
// say — фраза Инфли (src/learn/voice.js) вместо штампа «Верно» / «Не совсем»
// plain — без печати: в переписке «Истории» штамп смотрится чужеродно, там — просто заголовок
export function AnswerBar({ ok, stamp, say = null, plain = false, children, className, ...rest }) {
  return (
    <div className={cx('ds-answer', ok ? 'ok' : 'bad', className)} {...rest}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {say && !stamp
          ? <span className="ds-answer-say" data-testid="infla-say">{say}</span>
          : <span className={plain ? 'ds-answer-say' : 'ds-answer-stamp'}>{stamp || (ok ? 'Верно' : 'Не совсем')}</span>}
        {children}
      </div>
    </div>
  );
}
export function Sheet({ label, onClose, children, testid, ...rest }) {
  return (
    <div className="ds-sheet-back" onClick={onClose} data-testid={testid ? `${testid}-back` : undefined}>
      <div className="ds-sheet ds-rise" role="dialog" aria-label={label} data-testid={testid} onClick={(e) => e.stopPropagation()} {...rest}>{children}</div>
    </div>
  );
}
export function TopBar({ back = null, title, right = null }) {
  return <div className="ds-topbar">{back}{title && <div className="ds-topbar-title">{title}</div>}{right}</div>;
}
// нижняя панель вкладок: открытая вкладка — не кнопка перехода
// onReselect — нажатие на уже открытую вкладку (например, «Учебник» — вернуться на его главную)
export function Tabs({ tabs, active, onTab, onReselect = null, label = 'Разделы', children = null }) {
  return (
    <nav aria-label={label} data-testid="bottom-nav" className="ds-nav">
      {children}
      <div className="ds-nav-in">
        {tabs.map((t) => {
          const on = active === t.id; const Icon = t.icon;
          return (
            <button key={t.id} type="button" aria-current={on ? 'page' : undefined} data-tab={t.id} data-nav-target={on || t.menu ? undefined : `tab:${t.id}`}
              aria-haspopup={t.menu ? 'menu' : undefined} aria-expanded={t.menu ? !!t.open : undefined}
              onClick={() => { if (!on) onTab(t.id); else if (onReselect) onReselect(t.id); }}>
              <Icon size={22} strokeWidth={on ? 2.2 : 1.7} aria-hidden="true" /><span>{t.label}</span>{t.dot && <i className="ds-nav-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
