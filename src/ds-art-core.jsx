/* Основа иллюстраций дизайн-системы: медиазапросы, стили анимаций, гильош и розетка. Отдельно от
   src/ds-art.jsx (гравюры, печати, марки, Инфля в уроке), чтобы приветствие не тянуло весь набор
   (docs/mechanics.md, «Приветствие и загрузка»). ds-art.jsx реэкспортирует всё отсюда. */
import React, { useEffect, useMemo, useState } from 'react';

// медиазапрос как состояние: меняется вместе с окном или настройкой системы
export function useMedia(query) {
  const q = useMemo(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null), [query]);
  const [on, setOn] = useState(() => !!(q && q.matches));
  useEffect(() => {
    if (!q) return undefined;
    const f = () => setOn(q.matches);
    f();
    if (q.addEventListener) q.addEventListener('change', f);
    return () => { if (q.removeEventListener) q.removeEventListener('change', f); };
  }, [q]);
  return on;
}
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
// ПК: от 1024 px Путь — в две колонки, у учебника оглавление сбоку
export const WIDE_QUERY = '(min-width: 1024px)';
export const useWide = () => useMedia(WIDE_QUERY);

export const ART_CSS = `
  @keyframes ds-smoke { 0% { transform: translate(0, 0) scale(.6); opacity: 0 } 25% { opacity: .55 } 100% { transform: translate(6px, -22px) scale(1.5); opacity: 0 } }
  @keyframes ds-ring { 0% { transform: scale(.9); opacity: .55 } 100% { transform: scale(1.35); opacity: 0 } }
  @keyframes ds-pulse { 0% { filter: drop-shadow(0 0 0 transparent) } 35% { filter: drop-shadow(0 0 5px var(--ds-gold)) } 100% { filter: drop-shadow(0 0 0 transparent) } }
  @keyframes ds-fall { 0% { transform: translate3d(0, -10vh, 0) rotateY(0) } 100% { transform: translate3d(var(--dx), 108vh, 0) rotateY(var(--spin)) } }
  @keyframes ds-unlock { 0% { transform: rotate(0) } 25% { transform: rotate(-14deg) } 50% { transform: rotate(12deg) scale(1.1) } 100% { transform: scale(0); opacity: 0 } }
  @keyframes ds-appear { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
  .ds-smoke { transform-box: fill-box; transform-origin: center; animation: ds-smoke 2.6s ease-out infinite; }
  .ds-pulse { animation: ds-pulse .5s ease-out 1; }
  .ds-unlock { animation: ds-unlock .8s ease-in 1 forwards; }
  .ds-appear { animation: ds-appear .4s ease-out 1; }
  .ds-chest-glow { animation: ds-chest-glow 1.6s ease-in-out infinite alternate; transform-origin: 32px 30px; }
  @keyframes ds-chest-glow { from { opacity: .6; } to { opacity: 1; } }
  /* открытие: закрытая крышка складывается к петлям, откинутая встаёт за коробом, монеты подскакивают */
  .ds-lid-off { transform-origin: 32px 30px; animation: ds-lid-off .22s ease-in 1 both; }
  .ds-lid-on { transform-origin: 32px 30px; animation: ds-lid-on .38s cubic-bezier(.3,1.5,.6,1) .18s 1 both; }
  .ds-coin-pop { animation: ds-coin-pop .45s cubic-bezier(.3,1.6,.6,1) var(--d, .3s) 1 both; }
  @keyframes ds-lid-off { from { transform: scaleY(1); } to { transform: scaleY(0); opacity: 0; } }
  @keyframes ds-lid-on { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes ds-coin-pop { from { transform: translateY(7px); opacity: 0; } to { transform: none; opacity: 1; } }
  .ds-coins { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 400; perspective: 600px; }
  .ds-coins i { position: absolute; top: 0; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #F7DC8A, #C9971F 60%, #8E6612);
    box-shadow: inset 0 0 0 2px rgba(120,80,10,.55), inset 0 0 0 4px rgba(255,236,170,.6); animation: ds-fall var(--t) cubic-bezier(.3,.6,.45,1) var(--d) 1 forwards; }
  .ds-level { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
  .ds-level-track { flex: 1; display: flex; gap: 3px; height: 12px; }
  .ds-level-track i { flex: 1; min-width: 0; border-radius: 3px; background: var(--ds-rule); transition: background .25s; }
  /* полоса — окном: пройденное раньше уходит за левый край, затухая */
  .ds-level-track.cut { -webkit-mask-image: linear-gradient(90deg, transparent, #000 22px); mask-image: linear-gradient(90deg, transparent, #000 22px); }
  .ds-level-track i.ok { background: linear-gradient(180deg, color-mix(in srgb, var(--u) 75%, #fff) 0 35%, var(--u) 35%); }
  .ds-level-track i.bad { background: repeating-linear-gradient(135deg, var(--ds-bad) 0 3px, color-mix(in srgb, var(--ds-bad) 45%, var(--ds-card)) 3px 6px); }
  .ds-level-track i.cur { background: var(--ds-card); box-shadow: inset 0 0 0 1.5px var(--u-ink); }
  /* отрезок перед текущим — кнопка «назад на карточку»: стрелка «‹» внутри, зона касания шире самого отрезка */
  .ds-level-track button { flex: 1; position: relative; border: 0; padding: 0; margin: 0; min-width: 0; border-radius: 3px; background: var(--ds-rule); cursor: pointer; font: inherit; color: inherit; }
  .ds-level-track button.ok { background: linear-gradient(180deg, color-mix(in srgb, var(--u) 75%, #fff) 0 35%, var(--u) 35%); }
  .ds-level-track button.bad { background: repeating-linear-gradient(135deg, var(--ds-bad) 0 3px, color-mix(in srgb, var(--ds-bad) 45%, var(--ds-card)) 3px 6px); }
  .ds-level-track button.cur { background: var(--ds-card); box-shadow: inset 0 0 0 1.5px var(--u-ink); }
  .ds-level-back::before { content: ''; position: absolute; inset: -16px -4px; }
  .ds-level-back::after { content: '‹'; position: absolute; inset: 0; display: grid; place-items: center; font: 700 13px/1 var(--ds-sans); color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.55); }
  .ds-level-back.cur::after { color: var(--u-ink); text-shadow: none; }
  .ds-level-back:hover, .ds-level-back:focus-visible { outline: 2px solid var(--u-ink); outline-offset: 2px; }
  .ds-level-n { font-size: 12.5px; font-weight: 700; color: var(--ds-ink2); min-width: 34px; text-align: right; }
  .ds-infla { display: inline-block; transform-origin: 50% 90%; transition: transform .45s cubic-bezier(.34,1.45,.5,1); }
  .ds-infla.deflate { transition: transform 1s cubic-bezier(.25,.8,.3,1); }
  .ds-infla-stack { display: inline-grid; }
  .ds-infla-stack > span { grid-area: 1 / 1; display: inline-block; transform-origin: 50% 90%; }
  .ds-infla-out { animation: ds-infla-out .3s ease forwards; pointer-events: none; }
  .ds-infla-in { animation: ds-infla-in .3s cubic-bezier(.3,1.3,.5,1) both; }
  @keyframes ds-infla-out { to { opacity: 0; transform: translateY(1px) scale(.97); } }
  @keyframes ds-infla-in { from { opacity: 0; transform: translateY(2px) scale(.96); } }
  .ds-clip { position: relative; background: #F7F1E1; color: #1F1C17; padding: 18px 18px 20px; font-family: var(--ds-news);
    clip-path: polygon(0 3%, 4% 0, 9% 2%, 15% 0, 22% 2.5%, 30% 0, 38% 2%, 47% 0, 55% 2.5%, 63% 0, 71% 2%, 79% 0, 87% 2.5%, 94% 0, 100% 2%,
      100% 97%, 95% 100%, 88% 97.5%, 80% 100%, 72% 98%, 64% 100%, 56% 97.5%, 48% 100%, 40% 98%, 31% 100%, 23% 97.5%, 15% 100%, 7% 98%, 0 100%); }
  .ds-dark .ds-clip { background: #2B2A25; color: #EDE6D3; }
  .ds-clip-mast { text-align: center; font: 700 12.5px/1.2 var(--ds-news); letter-spacing: .22em; text-transform: uppercase; padding-bottom: 6px; border-bottom: 3px double currentColor; margin-bottom: 4px; }
  .ds-clip-meta { display: flex; justify-content: space-between; font: 12px/1.3 var(--ds-mono); opacity: .75; margin-bottom: 12px; }
  .ds-postage { display: inline-block; padding: 7px; background-color: var(--ds-card);
    background-image: radial-gradient(circle, var(--ds-paper) 3.2px, transparent 3.6px); background-size: 12px 12px; background-position: -6px -6px; filter: drop-shadow(0 1px 1px var(--ds-shade)); }
  .ds-postage-in { border: 1.5px solid var(--u); background: var(--ds-card); padding: 6px; text-align: center; position: relative; }
  /* тёмная тема: поля марки светлее страницы — иначе дырки перфорации того же цвета, что и поля, и
     зубцов не видно (жалоба «огранку марки почти не видно»); тонкая светлая кромка по зубцам */
  .ds-dark .ds-postage, .ds-dark .pf-stamp { background-color: color-mix(in srgb, #EDE6D3 30%, var(--ds-card));
    filter: drop-shadow(0 0 .6px rgba(237, 230, 211, .55)) drop-shadow(0 2px 3px rgba(0, 0, 0, .45)); }
  @media (prefers-reduced-motion: reduce) { .ds-smoke, .ds-pulse, .ds-unlock, .ds-appear, .ds-coins i { animation: none !important; } .ds-coins { display: none; } .ds-infla { transition: none !important; } .ds-infla-out { display: none; } .ds-infla-in { animation: none; } }
`;
export const ArtStyle = () => <style>{ART_CSS}</style>;

/* Гильош — полоса переплетённых волн, как сетка на купюре. preserveAspectRatio="none":
   полоса тянется на любую ширину, толщина линии от этого не меняется. */
export function Guilloche({ height = 24, lines = 7, period = 30, color = 'var(--u-ink)', opacity = 0.5, style, className }) {
  const W = 480;
  const paths = useMemo(() => Array.from({ length: lines }, (_, k) => {
    let d = '';
    for (let x = 0; x <= W; x += 2) {
      const env = 0.55 + 0.45 * Math.sin(((x / (period * 3.2)) * 2 + k * 0.28) * Math.PI);
      const y = height / 2 + (height / 2 - 1.2) * env * Math.sin((x / period) * 2 * Math.PI + (k * 2 * Math.PI) / lines);
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(2)}`;
    }
    return d;
  }), [height, lines, period]);
  return (
    <svg className={className} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true" style={{ display: 'block', ...style }}>
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth="0.8" opacity={opacity} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
// розетка — водяной знак и печать сертификата: несколько эпитрохоид с поворотом
export function Rosette({ size = 96, color = 'var(--u-ink)', opacity = 0.7, children, style }) {
  const curves = useMemo(() => [[6, 0.9, 0], [8, 0.7, 11], [10, 0.55, 23]].map(([lobes, dk, rot]) => {
    const R = 30; const r = R / lobes; const d = r * (1 + dk * 2.2);
    let p = '';
    for (let i = 0; i <= 720; i += 1) {
      const t = (i / 720) * 2 * Math.PI;
      const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
      const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
      const a = (rot * Math.PI) / 180;
      p += `${i ? 'L' : 'M'}${(50 + (x * Math.cos(a) - y * Math.sin(a)) * 1.1).toFixed(2)},${(50 + (x * Math.sin(a) + y * Math.cos(a)) * 1.1).toFixed(2)}`;
    }
    return p;
  }), []);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        {curves.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth="0.6" opacity={opacity} />)}
        <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
      </svg>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</span>
    </span>
  );
}
