/* ТЕМЫ УРОКА (docs/mechanics.md, «Темы урока»): покупаются в лавке («Для урока») и меняют урок целиком —
   живой фон за заданием, свои кнопки вариантов и главной кнопки и свой отклик на ответ (событие
   ems-answer из урока, src/learn-decor.jsx):
   • «Биржа» — тёмный терминал: сетка, графики котировок плывут, лента тикеров; варианты — строки
     терминала «> …»; верный ответ — зелёная свеча «▲», ошибка — красная «▼»;
   • «Монетный двор» — гильош-розетка медленно вращается, золотая пыль поднимается; варианты —
     банкноты с гильошированной рамкой; верный ответ — падает и звенит монета;
   • «Чертёж» — синька: сетка, циркуль и кривые чертятся сами; варианты — чертёжные надписи с
     засечками; верный ответ — карандашная галочка;
   • «Северное сияние» — ночное небо, звёзды и переливы сияния; варианты — матовое стекло; верный
     ответ — падающая звезда.
   У темы своя палитра (тёмная или светлая) независимо от темы приложения — подписи остаются
   контрастными; верный и неверный ответ подсвечены в любой теме. «Уменьшить движение» —
   фон неподвижен, без отклика. Фон — слой под содержимым урока, касаний не ловит. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from './ds-art.jsx';
import { ANSWER_EVENT } from './learn-decor.jsx';
import { THEMES } from './MacroSimulator.jsx';

export const SKINS = {
  'theme-exchange': { id: 'theme-exchange', key: 'exchange', title: 'Биржа', dark: true },
  'theme-mint': { id: 'theme-mint', key: 'mint', title: 'Монетный двор', dark: false },
  'theme-blueprint': { id: 'theme-blueprint', key: 'blueprint', title: 'Чертёж', dark: true },
  'theme-aurora': { id: 'theme-aurora', key: 'aurora', title: 'Северное сияние', dark: true },
};

/* своя палитра темы: урок с тёмной темой — тёмный при светлом приложении, «Монетный двор» — светлый
   при тёмном. Учебные тексты внутри урока берут цвета приложения (--c-text и др.) — их тема
   переопределяет на корне урока, вместе с палитрой дизайн-системы (theme у DsRoot). */
const kebab = (k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export const skinTheme = (s) => (s.dark ? 'ink' : 'paper');
export function skinVars(s) {
  const c = (s.dark ? THEMES.learnDark : THEMES.learn).colors;
  return Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === 'string').map(([k, v]) => [`--c-${kebab(k)}`, v]));
}

// случайное блуждание цены — для графиков «Биржи» (постоянное: из номера точки)
const walk = (n, seed, amp) => { let y = 50; let x = seed; return Array.from({ length: n }, (_, i) => { x = (x * 9301 + 49297) % 233280; y = Math.max(12, Math.min(88, y + ((x / 233280) - 0.48) * amp)); return `${(i / (n - 1)) * 200},${y.toFixed(1)}`; }).join(' '); };
const TICKER = 'НФТ ▲ 2,31% · ЗРН ▼ 0,84% · КФЕ ▲ 1,12% · СТЛ ▲ 0,40% · КРН/МОН 1,04 · ИНФЛ 4,1% · СТАВКА 2,0% · ЗЛТ ▲ 0,95% · ХЛБ ▼ 0,22% · ';

export const SKIN_CSS = `
  .ln-skin { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
  .ln-skin-fx { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }

  /* ---------- Биржа ---------- */
  .sk-on[data-skin="exchange"] { background: #06120D; }
  .sk-ex { background: radial-gradient(120% 80% at 50% 0%, #0D2A1E 0%, #06120D 60%);
    background-image: linear-gradient(rgba(25,195,125,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(25,195,125,.07) 1px, transparent 1px), radial-gradient(120% 80% at 50% 0%, #0D2A1E 0%, #06120D 60%);
    background-size: 100% 44px, 44px 100%, auto; }
  .sk-ex-chart { position: absolute; left: 0; width: 200%; height: 46%; animation: sk-pan 46s linear infinite; }
  .sk-ex-chart.b { top: 44%; opacity: .5; animation-duration: 70s; }
  .sk-ex-chart.a { top: 20%; opacity: .35; }
  @keyframes sk-pan { to { transform: translateX(-50%) } }
  .sk-ex-tape { position: absolute; left: 0; bottom: 92px; white-space: nowrap; font: 700 12px var(--ds-mono); color: rgba(25,195,125,.55); letter-spacing: .06em; animation: sk-pan 38s linear infinite; }
  .sk-on[data-skin="exchange"] .ds-opt { background: rgba(8,26,18,.9); border: 1px solid #1E5A3E; border-radius: 6px; color: #D7F5E6; font-family: var(--ds-mono); font-size: 15px; --edge: #0B2418; }
  .sk-on[data-skin="exchange"] .ds-opt::before { content: '> '; color: #19C37D; font-weight: 700; }
  .sk-on[data-skin="exchange"] .ds-opt:hover:not(:disabled) { background: rgba(14,44,30,.95); border-color: #19C37D; }
  .sk-on[data-skin="exchange"] .ds-opt[aria-pressed="true"], .sk-on[data-skin="exchange"] .ds-opt[aria-checked="true"], .sk-on[data-skin="exchange"] .ds-opt.is-sel { border-color: #19C37D; background: rgba(25,195,125,.14); box-shadow: 0 0 0 1px #19C37D, 0 0 22px rgba(25,195,125,.3); }
  .sk-on[data-skin="exchange"] .ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary):not(:disabled) { --b: #19C37D; color: #04140C; border-radius: 6px; font-family: var(--ds-mono); }
  .sk-on[data-skin="exchange"] .ln-foot { background: rgba(6,18,13,.94); border-top-color: #1E5A3E; }
  .sk-candle { position: absolute; width: 14px; border-radius: 2px; animation: sk-candle 1.6s cubic-bezier(.2, .9, .3, 1) forwards; }
  .sk-candle::before { content: ''; position: absolute; left: 6px; top: -14px; bottom: -14px; width: 2px; background: inherit; opacity: .7; }
  .sk-candle b { position: absolute; left: 50%; top: -38px; transform: translateX(-50%); font: 700 15px var(--ds-mono); white-space: nowrap; }
  .sk-candle.up { background: #19C37D; height: 90px; } .sk-candle.up b { color: #19C37D; }
  .sk-candle.down { background: #F0505A; height: 70px; } .sk-candle.down b { color: #F0505A; top: auto; bottom: -40px; }
  @keyframes sk-candle { 0% { transform: scaleY(0); opacity: 0 } 25% { transform: scaleY(1); opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0; transform: translateY(-30px) } }

  /* ---------- Монетный двор ---------- */
  .sk-on[data-skin="mint"] { background: #FBF5E6; }
  .sk-mint { background: radial-gradient(90% 70% at 80% 20%, #FFF4D6 0%, #FBF5E6 55%, #F2E6C8 100%); }
  .sk-mint-rose { position: absolute; right: -18vmin; top: 6vmin; width: 78vmin; height: 78vmin; opacity: .16; animation: sk-spin 140s linear infinite; }
  .sk-mint-rose.b { right: auto; left: -30vmin; top: auto; bottom: -26vmin; width: 60vmin; height: 60vmin; opacity: .1; animation-direction: reverse; animation-duration: 180s; }
  @keyframes sk-spin { to { transform: rotate(360deg) } }
  .sk-dust { position: absolute; bottom: -10px; width: 4px; height: 4px; border-radius: 50%; background: radial-gradient(circle, #FFE9A3, #C99417); box-shadow: 0 0 6px #F7DC8A;
    animation: sk-rise var(--t, 14s) linear var(--d, 0s) infinite; opacity: 0; }
  @keyframes sk-rise { 0% { opacity: 0; transform: translate(0, 0) } 10% { opacity: .9 } 90% { opacity: .7 } 100% { opacity: 0; transform: translate(var(--x, 20px), -105vh) } }
  .sk-on[data-skin="mint"] .ds-opt { border-radius: 4px; border: 2px solid #C9A548; color: #2A2112; --edge: #B38A2E;
    background: repeating-linear-gradient(45deg, rgba(201,165,72,.07) 0 2px, transparent 2px 7px), linear-gradient(#FFFDF5, #FAF0D4);
    box-shadow: inset 0 0 0 4px #FFFDF5, inset 0 0 0 5px rgba(154,116,19,.38), 0 3px 0 var(--edge); padding-left: 36px; position: relative; }
  .sk-on[data-skin="mint"] .ds-opt::before { content: '❖'; position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #B38A2E; font-size: 13px; }
  .sk-on[data-skin="mint"] .ds-opt[aria-pressed="true"], .sk-on[data-skin="mint"] .ds-opt[aria-checked="true"], .sk-on[data-skin="mint"] .ds-opt.is-sel { background: linear-gradient(#FCEFC4, #F3DE9A); border-color: #9A7413; }
  .sk-on[data-skin="mint"] .ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary):not(:disabled) { --b: #9A7413; background-image: linear-gradient(180deg, rgba(255,255,255,.22), transparent 55%); }
  .sk-on[data-skin="mint"] .ln-foot { background: rgba(251,245,230,.95); }
  .sk-coin { position: absolute; top: -70px; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font: 700 22px var(--ds-news, Georgia, serif); color: #7A5A0A;
    background: radial-gradient(circle at 35% 35%, #FFF1B8, #E0AE2E 55%, #9A7413); box-shadow: inset 0 0 0 4px rgba(255,255,255,.35), 0 10px 18px -6px rgba(90,60,0,.5);
    animation: sk-coin 1.7s cubic-bezier(.3, .7, .4, 1) forwards; }
  @keyframes sk-coin { 0% { transform: translateY(0) rotateY(0) } 55% { transform: translateY(46vh) rotateY(900deg) } 70% { transform: translateY(42vh) rotateY(1000deg) } 85% { transform: translateY(46vh) rotateY(1080deg); opacity: 1 } 100% { transform: translateY(46vh) rotateY(1080deg); opacity: 0 } }
  .sk-coin.miss { animation-name: sk-roll; }
  @keyframes sk-roll { 0% { transform: translate(0, 46vh) rotate(0); opacity: 0 } 15% { opacity: 1 } 100% { transform: translate(60vw, 46vh) rotate(540deg); opacity: 0 } }

  /* ---------- Чертёж ---------- */
  .sk-on[data-skin="blueprint"] { background: #11406E; }
  .sk-bp { background-color: #11406E;
    background-image: linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px),
      linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px; }
  .sk-bp svg { position: absolute; right: -4vmin; bottom: 8vh; width: min(70vmin, 520px); height: auto; opacity: .55; }
  .sk-bp .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: sk-draw 12s ease-in-out infinite; }
  .sk-bp .draw.b { animation-delay: 1.5s; } .sk-bp .draw.c { animation-delay: 3s; } .sk-bp .draw.d { animation-delay: 4.5s; }
  @keyframes sk-draw { 0% { stroke-dashoffset: 1 } 35%, 80% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -1 } }
  .sk-on[data-skin="blueprint"] .ds-opt { background: rgba(17,64,110,.86); border: 1.5px solid rgba(234,244,255,.75); border-radius: 2px; color: #EAF4FF; --edge: rgba(0,0,0,.25);
    font-family: var(--ds-mono); font-size: 15px; letter-spacing: .02em;
    background-image: linear-gradient(#EAF4FF, #EAF4FF), linear-gradient(#EAF4FF, #EAF4FF), linear-gradient(#EAF4FF, #EAF4FF), linear-gradient(#EAF4FF, #EAF4FF);
    background-size: 10px 2px, 2px 10px, 10px 2px, 2px 10px; background-position: -2px -2px, -2px -2px, calc(100% + 2px) calc(100% + 2px), calc(100% + 2px) calc(100% + 2px); background-repeat: no-repeat; }
  .sk-on[data-skin="blueprint"] .ds-opt:hover:not(:disabled) { background-color: rgba(30,90,150,.9); }
  .sk-on[data-skin="blueprint"] .ds-opt[aria-pressed="true"], .sk-on[data-skin="blueprint"] .ds-opt[aria-checked="true"], .sk-on[data-skin="blueprint"] .ds-opt.is-sel { border-color: #FFD166; background-color: rgba(255,209,102,.16); color: #FFF; }
  .sk-on[data-skin="blueprint"] .ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary):not(:disabled) { --b: #EAF4FF; color: #11406E; border-radius: 2px; font-family: var(--ds-mono); }
  .sk-on[data-skin="blueprint"] .ln-foot { background: rgba(13,52,92,.95); border-top-color: rgba(234,244,255,.3); }
  .sk-tick { position: absolute; width: 120px; height: 90px; animation: sk-fade 1.8s ease forwards; }
  .sk-tick path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: sk-pen .5s ease-out forwards; }
  @keyframes sk-pen { to { stroke-dashoffset: 0 } }
  @keyframes sk-fade { 0%, 70% { opacity: 1 } 100% { opacity: 0 } }

  /* ---------- Северное сияние ---------- */
  .sk-on[data-skin="aurora"] { background: #070B1F; }
  .sk-au { background: linear-gradient(180deg, #050816 0%, #0B1235 55%, #1A1450 100%); }
  .sk-au-stars { position: absolute; inset: 0; background-image: radial-gradient(1.2px 1.2px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 32% 8%, #fff, transparent),
    radial-gradient(1.4px 1.4px at 54% 24%, #fff, transparent), radial-gradient(1px 1px at 72% 12%, #fff, transparent), radial-gradient(1.2px 1.2px at 88% 30%, #fff, transparent),
    radial-gradient(1px 1px at 22% 42%, #fff, transparent), radial-gradient(1px 1px at 64% 46%, #fff, transparent), radial-gradient(1.3px 1.3px at 8% 70%, #fff, transparent),
    radial-gradient(1px 1px at 44% 64%, #fff, transparent), radial-gradient(1.2px 1.2px at 92% 66%, #fff, transparent); animation: sk-twinkle 5s ease-in-out infinite alternate; }
  @keyframes sk-twinkle { to { opacity: .55 } }
  .sk-au-band { position: absolute; left: -20%; width: 140%; height: 34%; filter: blur(46px); opacity: .34; mix-blend-mode: screen; border-radius: 50%;
    animation: sk-wave 16s ease-in-out infinite alternate; }
  .sk-au-band.a { top: 4%; background: linear-gradient(90deg, transparent, #2BE3A0 30%, #22C1E8 60%, transparent); }
  .sk-au-band.b { top: 18%; background: linear-gradient(90deg, transparent, #7B5CFF 35%, #2BE3A0 70%, transparent); animation-duration: 22s; animation-delay: -6s; opacity: .28; }
  .sk-au-band.c { top: 30%; background: linear-gradient(90deg, transparent, #22C1E8 40%, #C95CFF 75%, transparent); animation-duration: 28s; animation-delay: -12s; opacity: .22; }
  @keyframes sk-wave { 0% { transform: translateX(-6%) skewY(-4deg) scaleY(.8) } 50% { transform: translateX(4%) skewY(3deg) scaleY(1.15) } 100% { transform: translateX(8%) skewY(-2deg) scaleY(.9) } }
  .sk-on[data-skin="aurora"] .ds-opt { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 18px; color: #EEF2FF; --edge: rgba(0,0,0,.3);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
  .sk-on[data-skin="aurora"] .ds-opt:hover:not(:disabled) { background: rgba(255,255,255,.12); }
  .sk-on[data-skin="aurora"] .ds-opt[aria-pressed="true"], .sk-on[data-skin="aurora"] .ds-opt[aria-checked="true"], .sk-on[data-skin="aurora"] .ds-opt.is-sel { border-color: #2BE3A0; background: rgba(43,227,160,.14); box-shadow: 0 0 24px rgba(43,227,160,.28); }
  .sk-on[data-skin="aurora"] .ds-btn:not(.ds-btn--ghost):not(.ds-btn--secondary):not(:disabled) { --b: #2BE3A0; color: #05231A; border-radius: 18px; }
  .sk-on[data-skin="aurora"] .ln-foot { background: rgba(7,11,31,.82); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-top-color: rgba(255,255,255,.12); }
  .sk-star { position: absolute; top: 12%; width: 160px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,0), #fff);
    box-shadow: 0 0 10px #fff; animation: sk-shoot 1.1s ease-out forwards; }
  @keyframes sk-shoot { from { transform: translate(-30vw, 0) rotate(18deg); opacity: 0 } 20% { opacity: 1 } to { transform: translate(70vw, 22vh) rotate(18deg); opacity: 0 } }

  /* ---------- во всех темах: проверенный ответ — зелёный или красный, поверх стиля темы ---------- */
  .sk-on[data-skin] .ds-opt.right { border-color: #2BD67B; background-color: rgba(43,214,123,.16); box-shadow: 0 0 0 1px #2BD67B; color: var(--sk-ink); }
  .sk-on[data-skin] .ds-opt.wrong { border-color: #F0505A; background-color: rgba(240,80,90,.14); box-shadow: 0 0 0 1px #F0505A; color: var(--sk-ink); }
  .sk-on[data-skin="mint"] .ds-opt.right { border-color: #2E8B57; background-image: none; background-color: #E3F4E1; box-shadow: inset 0 0 0 4px #F4FBF3, 0 3px 0 #2E8B57; }
  .sk-on[data-skin="mint"] .ds-opt.wrong { border-color: #B8423A; background-image: none; background-color: #FBE7E3; box-shadow: inset 0 0 0 4px #FDF4F2, 0 3px 0 #B8423A; }
  .sk-on[data-skin] .ds-opt.right::after { color: #2BD67B; } .sk-on[data-skin] .ds-opt.wrong::after { color: #F0505A; }
  .sk-on[data-skin="mint"] .ds-opt.right::after { color: #2E8B57; } .sk-on[data-skin="mint"] .ds-opt.wrong::after { color: #B8423A; }
  /* свеча «Биржи» растёт у края, вне текста: на телефоне — у края экрана, на широком — рядом с колонкой урока */
  .sk-candle.l { left: max(6px, calc(50% - 420px)); } .sk-candle.r { right: max(6px, calc(50% - 420px)); }
  .sk-candle.l b { left: 0; transform: none; } .sk-candle.r b { left: auto; right: 0; transform: none; }

  /* ---------- превью в лавке: тот же фон и те же кнопки, в карточке ---------- */
  .sk-on[data-skin="exchange"] { --sk-ink: #D7F5E6; } .sk-on[data-skin="mint"] { --sk-ink: #2A2112; }
  .sk-on[data-skin="blueprint"] { --sk-ink: #EAF4FF; } .sk-on[data-skin="aurora"] { --sk-ink: #EEF2FF; }
  .sk-preview { position: relative; isolation: isolate; overflow: hidden; width: 100%; height: 148px; border-radius: 10px; text-align: left; box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
  .sk-pv-body { position: relative; display: grid; gap: 6px; padding: 11px 12px; }
  .sk-pv-q { font: 700 12.5px/1.3 var(--ds-sans); color: var(--sk-ink); }
  .sk-on.sk-preview .ds-opt { margin: 0; padding: 6px 10px; font-size: 12px; line-height: 1.3; pointer-events: none; animation: none; }
  .sk-preview[data-skin="mint"] .ds-opt { padding-left: 26px; } .sk-preview[data-skin="mint"] .ds-opt::before { left: 9px; font-size: 11px; }
  .sk-on.sk-preview .ds-btn { justify-self: end; min-height: 0; padding: 5px 14px; font-size: 12px; border-radius: 9px; box-shadow: 0 2px 0 var(--edge); pointer-events: none; }
  .sk-preview[data-skin="exchange"] .ds-btn, .sk-preview[data-skin="blueprint"] .ds-btn { border-radius: 4px; }
  .sk-preview .sk-ex-tape { bottom: 4px; font-size: 12px; }
  .sk-preview .sk-mint-rose { width: 230px; height: 230px; right: -80px; top: -50px; opacity: .22; }
  .sk-preview .sk-mint-rose.b { width: 150px; height: 150px; left: -70px; right: auto; top: auto; bottom: -70px; }
  .sk-preview .sk-bp svg { width: 64%; right: -8px; bottom: 2px; }
  .sk-preview .sk-au-band { filter: blur(18px); }

  @media (prefers-reduced-motion: reduce) { .ln-skin *, .ln-skin { animation: none !important; } .ln-skin-fx { display: none; } }
`;

function Rosette({ color = '#9A7413' }) {
  // гильош: двадцать четыре эллипса вокруг центра — как на банкноте
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => <ellipse key={i} cx="0" cy="0" rx="92" ry="34" fill="none" stroke={color} strokeWidth=".6" transform={`rotate(${i * 7.5})`} />)}
      {Array.from({ length: 12 }, (_, i) => <ellipse key={`b${i}`} cx="0" cy="0" rx="58" ry="20" fill="none" stroke={color} strokeWidth=".5" transform={`rotate(${i * 15 + 3})`} />)}
      <circle r="96" fill="none" stroke={color} strokeWidth="1.2" /><circle r="99" fill="none" stroke={color} strokeWidth=".5" />
    </svg>
  );
}

function Backdrop({ k, preview = false }) {
  const dust = useMemo(() => Array.from({ length: preview ? 8 : 18 }, (_, i) => ({ left: `${(i * 37) % 100}%`, t: `${11 + (i % 5) * 2}s`, d: `${-(i * 1.7)}s`, x: `${((i % 3) - 1) * 40}px` })), []);
  if (k === 'exchange') {
    return (
      <div className="ln-skin sk-ex" data-testid={preview ? undefined : 'lesson-skin'} data-skin="exchange">
        <svg className="sk-ex-chart a" viewBox="0 0 200 100" preserveAspectRatio="none"><polyline points={walk(80, 7, 14)} fill="none" stroke="#19C37D" strokeWidth=".5" vectorEffect="non-scaling-stroke" /></svg>
        <svg className="sk-ex-chart b" viewBox="0 0 200 100" preserveAspectRatio="none"><polyline points={walk(60, 91, 18)} fill="none" stroke="#F0505A" strokeWidth=".5" vectorEffect="non-scaling-stroke" /></svg>
        <div className="sk-ex-tape">{TICKER.repeat(6)}</div>
      </div>
    );
  }
  if (k === 'mint') {
    return (
      <div className="ln-skin sk-mint" data-testid={preview ? undefined : 'lesson-skin'} data-skin="mint">
        <div className="sk-mint-rose"><Rosette /></div>
        <div className="sk-mint-rose b"><Rosette /></div>
        {dust.map((d, i) => <i key={i} className="sk-dust" style={{ left: d.left, '--t': d.t, '--d': d.d, '--x': d.x }} />)}
      </div>
    );
  }
  if (k === 'blueprint') {
    return (
      <div className="ln-skin sk-bp" data-testid={preview ? undefined : 'lesson-skin'} data-skin="blueprint">
        <svg viewBox="0 0 300 220" fill="none" stroke="#EAF4FF" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <path className="draw" pathLength="1" d="M30 200 V20 M30 200 H290" />
          <path className="draw b" pathLength="1" d="M45 40 C110 80 170 140 270 190" />
          <path className="draw c" pathLength="1" d="M45 190 C110 150 170 90 270 35" />
          <path className="draw d" pathLength="1" d="M157 112 V200 M30 112 H157" strokeDasharray="4 4" />
          <circle className="draw d" pathLength="1" cx="157" cy="112" r="30" />
          <text x="270" y="30" fill="#EAF4FF" stroke="none" fontFamily="monospace" fontSize="11">S</text>
          <text x="270" y="206" fill="#EAF4FF" stroke="none" fontFamily="monospace" fontSize="11">D</text>
        </svg>
      </div>
    );
  }
  return (
    <div className="ln-skin sk-au" data-testid={preview ? undefined : 'lesson-skin'} data-skin="aurora">
      <div className="sk-au-stars" />
      <div className="sk-au-band a" /><div className="sk-au-band b" /><div className="sk-au-band c" />
    </div>
  );
}

// отклик на ответ: короткий эффект поверх урока, сам исчезает
function Fx({ k, preview }) {
  const [list, setList] = useState([]);
  const [fired, setFired] = useState(0);
  const reduced = useReducedMotion();
  const seq = useRef(0);
  useEffect(() => {
    if (preview || reduced) return undefined;
    const on = (e) => {
      const ok = !!(e.detail && e.detail.ok);
      const id = (seq.current += 1);
      const x = 15 + Math.random() * 70;
      setList((l) => [...l.slice(-3), { id, ok, x }]);
      setFired((n) => n + 1);
      setTimeout(() => setList((l) => l.filter((f) => f.id !== id)), 1900);
    };
    window.addEventListener(ANSWER_EVENT, on);
    return () => window.removeEventListener(ANSWER_EVENT, on);
  }, [preview, reduced]);
  return (
    <div className="ln-skin-fx" aria-hidden="true" data-testid="lesson-skin-fx" data-count={list.length} data-fired={fired}>
      {list.map((f) => {
        if (k === 'exchange') return <span key={f.id} className={`sk-candle ${f.ok ? 'up' : 'down'} ${f.x < 50 ? 'l' : 'r'}`} style={{ bottom: `${22 + (f.x % 30)}%` }}><b>{f.ok ? '▲ +2' : '▼'}</b></span>;
        if (k === 'mint') return <span key={f.id} className={`sk-coin${f.ok ? '' : ' miss'}`} style={{ left: `calc(${f.x}% - 32px)` }}>₭</span>;
        if (k === 'blueprint') return f.ok ? <svg key={f.id} className="sk-tick" viewBox="0 0 120 90" style={{ left: `calc(${f.x}% - 60px)`, top: '18%' }}><path pathLength="1" d="M12 50 L44 78 L110 10" fill="none" stroke="#FF6B4A" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg> : null;
        return f.ok ? <span key={f.id} className="sk-star" style={{ left: `${f.x - 30}%` }} /> : null;
      })}
    </div>
  );
}

export function LessonSkin({ id, preview = false }) {
  const s = SKINS[id];
  if (!s) return null;
  return <><Backdrop k={s.key} preview={preview} /><Fx k={s.key} preview={preview} /></>;
}

/* превью темы на витрине: живой фон и «урок в миниатюре» — вопрос, два варианта (один выбран)
   и главная кнопка в стиле темы; ничего не нажимается. Стили (SKIN_CSS) кладёт тот, кто показывает превью. */
export function SkinPreview({ id }) {
  const s = SKINS[id];
  if (!s) return null;
  return (
    <div className="sk-on sk-preview" data-skin={s.key} data-testid="skin-preview" aria-hidden="true">
      <Backdrop k={s.key} preview />
      <div className="sk-pv-body">
        <div className="sk-pv-q">Цена кофе выросла. Спрос…</div>
        <span className="ds-opt">вырастет</span>
        <span className="ds-opt is-sel">упадёт</span>
        <span className="ds-btn">Проверить</span>
      </div>
    </div>
  );
}
