/* ОФОРМЛЕНИЕ ОБУЧЕНИЯ: светлая яркая тема (тёмная — по выбору), крупный округлый шрифт
   заголовков (Nunito), объёмные кнопки с «нажатием», цвета юнитов и анимации — вспышка,
   встряска, свечение серии, конфетти, счёт опыта, прыжки кружков и замок. Всё своё, без
   библиотек и внешних запросов. При «уменьшить движение» в системе анимации выключены
   и в CSS, и в коде (useReducedMotion). Экран приветствия, Путь, урок, практика, профиль
   и учебник-справочник берут стили отсюда; тёмная «канцелярия» остаётся только в «Мире». */
import React, { useEffect, useRef, useState } from 'react';

const DARK_KEY = 'ems-learn-dark';
export const learnDark = () => { try { return localStorage.getItem(DARK_KEY) === '1'; } catch { return false; } };
export const setLearnDark = (on) => { try { if (on) localStorage.setItem(DARK_KEY, '1'); else localStorage.removeItem(DARK_KEY); } catch { /* приватный режим */ } };
export const learnThemeId = () => (learnDark() ? 'learnDark' : 'learn');

// цвет юнита: кружки Пути, шапка юнита, главная кнопка урока (белый текст — контраст не ниже 3:1)
export const UNIT_COLORS = { scarcity: '#1784C7', 'supply-demand': '#2E9A3C' };
export const unitColor = (id) => UNIT_COLORS[id] || '#8A4FD1';

export function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [reduced, setReduced] = useState(() => !!(q && q.matches));
  useEffect(() => {
    if (!q) return undefined;
    const f = () => setReduced(q.matches);
    if (q.addEventListener) q.addEventListener('change', f);
    return () => { if (q.removeEventListener) q.removeEventListener('change', f); };
  }, [q]);
  return reduced;
}

export const LEARN_FONT = "'Nunito','PT Sans',-apple-system,'Segoe UI',Roboto,sans-serif";

export const LEARN_CSS = `
  .lx { background: var(--c-bg); color: var(--c-text); min-height: 100vh; font-family: 'PT Sans', -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
  .lx-h { font-family: ${LEARN_FONT}; font-weight: 800; letter-spacing: -0.01em; line-height: 1.15; }
  .lx-sub { color: var(--c-muted); }
  .lx-btn { --b: var(--u, #2E9A3C); --bd: color-mix(in srgb, var(--b) 72%, #000);
    font-family: ${LEARN_FONT}; font-weight: 800; font-size: 16px; letter-spacing: .03em;
    border: none; border-radius: 16px; padding: 14px 18px; color: #fff; background: var(--b);
    box-shadow: 0 4px 0 var(--bd); cursor: pointer; transition: transform .06s ease, box-shadow .06s ease, filter .15s; }
  .lx-btn:hover:not(:disabled) { filter: brightness(1.06); }
  .lx-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 0 0 var(--bd); }
  .lx-btn:disabled { background: var(--c-border); box-shadow: 0 4px 0 var(--c-border-strong); color: var(--c-faint); cursor: default; }
  .lx-btn:focus-visible, .lx-opt:focus-visible, .lx-chip:focus-visible, .lx-node:focus-visible { outline: 3px solid var(--c-blue); outline-offset: 3px; }
  .lx-btn.secondary { background: var(--c-panel); color: var(--b); box-shadow: 0 4px 0 var(--c-border); border: 2px solid var(--c-border); }
  .lx-btn.ghost { background: none; box-shadow: none; color: var(--b); border: none; }
  .lx-btn.ghost:active:not(:disabled) { transform: none; }
  .lx-btn.wide { width: 100%; }
  .lx-icon-btn { background: none; border: none; color: var(--c-faint); padding: 6px; border-radius: 12px; cursor: pointer; display: inline-flex; }
  .lx-icon-btn:hover { background: var(--c-panel-alt); }
  .lx-card { background: var(--c-panel); border: 2px solid var(--c-border); border-radius: 18px; box-shadow: 0 3px 0 var(--c-border); }
  .lx-opt { display: block; width: 100%; text-align: left; padding: 13px 14px; margin: 9px 0; font: inherit; font-size: 15.5px; color: var(--c-text);
    background: var(--c-panel); border: 2px solid var(--c-border); border-bottom-width: 4px; border-radius: 14px; cursor: pointer; transition: transform .06s, border-color .12s, background .12s; }
  .lx-opt:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 2px; margin-bottom: 11px; }
  .lx-opt[aria-pressed="true"] { border-color: var(--c-sel-border); background: var(--c-sel); color: var(--c-sel-text); }
  .lx-opt.right { border-color: var(--c-teal); background: var(--c-teal-dim); }
  .lx-opt.wrong { border-color: var(--c-rust); background: var(--c-rust-dim); }
  .lx-opt:disabled { cursor: default; }
  .lx-chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 46px; padding: 9px 13px; margin: 4px; font: inherit; font-size: 15px;
    color: var(--c-text); background: var(--c-panel); border: 2px solid var(--c-border); border-bottom-width: 4px; border-radius: 12px; cursor: pointer; }
  .lx-chip[aria-pressed="true"] { border-color: var(--c-sel-border); background: var(--c-sel); color: var(--c-sel-text); }
  .lx-chip.right { border-color: var(--c-teal); }
  .lx-field { width: 100%; box-sizing: border-box; padding: 13px 14px; font: inherit; font-size: 16px; color: var(--c-text); background: var(--c-panel-alt);
    border: 2px solid var(--c-border); border-radius: 14px; }
  .lx-field:focus { outline: none; border-color: var(--c-sel-border); }
  .lx-label { display: block; font-weight: 700; font-size: 14px; margin-bottom: 12px; }
  .lx-label > input { margin-top: 6px; }

  /* анимации: всё одноразовое, кроме покачивания текущего кружка */
  @keyframes lx-shake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-9px) } 40% { transform: translateX(9px) } 60% { transform: translateX(-6px) } 80% { transform: translateX(5px) } }
  @keyframes lx-flash { 0% { box-shadow: inset 0 0 0 999px rgba(88,204,2,.28) } 100% { box-shadow: inset 0 0 0 999px rgba(88,204,2,0) } }
  @keyframes lx-pop { 0% { transform: scale(.92); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: scale(1) } }
  @keyframes lx-rise { 0% { transform: translateY(40%); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
  @keyframes lx-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,200,0,0) } 50% { box-shadow: 0 0 14px 4px rgba(255,200,0,.75) } }
  @keyframes lx-shine { 0% { background-position: -120px 0 } 100% { background-position: 320px 0 } }
  @keyframes lx-bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
  @keyframes lx-unlock { 0% { transform: rotate(0) } 18% { transform: rotate(-16deg) } 36% { transform: rotate(14deg) } 54% { transform: rotate(-8deg) scale(1.12) } 100% { transform: scale(0); opacity: 0 } }
  @keyframes lx-appear { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } }
  @keyframes lx-fall { 0% { transform: translate3d(0, -12vh, 0) rotate(0) } 100% { transform: translate3d(var(--dx), 108vh, 0) rotate(var(--rot)) } }
  .lx-shake { animation: lx-shake .42s ease-in-out 1; }
  .lx-flash { animation: lx-flash .6s ease-out 1; }
  .lx-pop { animation: lx-pop .28s ease-out 1; }
  .lx-rise { animation: lx-rise .22s ease-out 1; }
  .lx-bounce { animation: lx-bounce 1.6s ease-in-out infinite; }
  .lx-unlock { animation: lx-unlock .9s ease-in 1 forwards; }
  .lx-appear { animation: lx-appear .45s ease-out 1; }
  .lx-confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 400; }
  .lx-confetti i { position: absolute; top: 0; width: 9px; height: 14px; border-radius: 2px; animation: lx-fall var(--t) cubic-bezier(.25,.6,.4,1) var(--d) 1 forwards; }
  @media (prefers-reduced-motion: reduce) {
    .lx, .lx *, .lx *::before, .lx *::after, .lx-confetti, .lx-confetti * { animation: none !important; transition: none !important; }
    .lx-confetti { display: none; }
  }
`;

/* Конфетти в конце урока: полсотни бумажек разных цветов падают один раз. Не рисуются,
   если в системе включено «уменьшить движение». */
const CONFETTI_COLORS = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#CE82FF', '#FF9600'];
export function Confetti({ n = 48, seed = 1 }) {
  const reduced = useReducedMotion();
  const [bits] = useState(() => {
    let x = seed * 9301 + 49297;
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    return Array.from({ length: n }, (_, i) => ({
      left: `${Math.round(rnd() * 100)}%`, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      dx: `${Math.round((rnd() - 0.5) * 180)}px`, rot: `${Math.round(360 + rnd() * 720)}deg`,
      t: `${(1.6 + rnd() * 1.4).toFixed(2)}s`, d: `${(rnd() * 0.5).toFixed(2)}s`,
    }));
  });
  if (reduced) return null;
  return (
    <div className="lx-confetti" aria-hidden="true" data-testid="confetti">
      {bits.map((b, i) => <i key={i} style={{ left: b.left, background: b.color, '--dx': b.dx, '--rot': b.rot, '--t': b.t, '--d': b.d }} />)}
    </div>
  );
}

// счёт с прокруткой: от нуля до value за ~0,9 с; при «уменьшить движение» — сразу итог
export function CountUp({ value, prefix = '', duration = 900 }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame === 'undefined') { setShown(value); return undefined; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced, duration]);
  return <span data-value={value}>{prefix}{shown}</span>;
}

// общий корень экранов обучения: стили один раз
export function LearnStyle() {
  return <style>{LEARN_CSS}</style>;
}
