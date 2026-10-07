/* ДИЗАЙН-СИСТЕМА ОБУЧЕНИЯ — иллюстрации и живые детали: гильош (узор денежной сетки),
   розетка-водяной знак, оттиск печати, почтовая марка для альбома, гравюры зданий юнитов,
   вырезка из «Вестника» для историй, полоса прогресса урока — линия графика, растущая
   вверх, Инфля, которая надувается с каждым верным ответом подряд, и монеты в конце урока.
   Всё — свой SVG, без библиотек. При «уменьшить движение» всё стоит на месте. */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Mascot, OutfitContext, mascotHeight } from './mascot.jsx';

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
  .ds-coins { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 400; perspective: 600px; }
  .ds-coins i { position: absolute; top: 0; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #F7DC8A, #C9971F 60%, #8E6612);
    box-shadow: inset 0 0 0 2px rgba(120,80,10,.55), inset 0 0 0 4px rgba(255,236,170,.6); animation: ds-fall var(--t) cubic-bezier(.3,.6,.45,1) var(--d) 1 forwards; }
  .ds-level { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
  .ds-level-track { flex: 1; display: flex; gap: 3px; height: 12px; }
  .ds-level-track i { flex: 1; border-radius: 3px; background: var(--ds-rule); transition: background .25s; }
  .ds-level-track i.ok { background: linear-gradient(180deg, color-mix(in srgb, var(--u) 75%, #fff) 0 35%, var(--u) 35%); }
  .ds-level-track i.bad { background: repeating-linear-gradient(135deg, var(--ds-bad) 0 3px, color-mix(in srgb, var(--ds-bad) 45%, var(--ds-card)) 3px 6px); }
  .ds-level-track i.cur { background: var(--ds-card); box-shadow: inset 0 0 0 1.5px var(--u-ink); }
  .ds-level-n { font-size: 12.5px; font-weight: 700; color: var(--ds-ink2); min-width: 34px; text-align: right; }
  .ds-infla { display: inline-block; transform-origin: 50% 90%; transition: transform .45s cubic-bezier(.34,1.45,.5,1); }
  .ds-infla.deflate { transition: transform 1s cubic-bezier(.25,.8,.3,1); }
  .ds-clip { position: relative; background: #F7F1E1; color: #1F1C17; padding: 18px 18px 20px; font-family: var(--ds-serif);
    clip-path: polygon(0 3%, 4% 0, 9% 2%, 15% 0, 22% 2.5%, 30% 0, 38% 2%, 47% 0, 55% 2.5%, 63% 0, 71% 2%, 79% 0, 87% 2.5%, 94% 0, 100% 2%,
      100% 97%, 95% 100%, 88% 97.5%, 80% 100%, 72% 98%, 64% 100%, 56% 97.5%, 48% 100%, 40% 98%, 31% 100%, 23% 97.5%, 15% 100%, 7% 98%, 0 100%); }
  .ds-dark .ds-clip { background: #2B2A25; color: #EDE6D3; }
  .ds-clip-mast { text-align: center; font: 700 12.5px/1.2 var(--ds-serif); letter-spacing: .22em; text-transform: uppercase; padding-bottom: 6px; border-bottom: 3px double currentColor; margin-bottom: 4px; }
  .ds-clip-meta { display: flex; justify-content: space-between; font: 12px/1.3 var(--ds-mono); opacity: .75; margin-bottom: 12px; }
  .ds-postage { display: inline-block; padding: 7px; background-color: var(--ds-card);
    background-image: radial-gradient(circle, var(--ds-paper) 3.2px, transparent 3.6px); background-size: 12px 12px; background-position: -6px -6px; filter: drop-shadow(0 1px 1px var(--ds-shade)); }
  .ds-postage-in { border: 1.5px solid var(--u); background: var(--ds-card); padding: 6px; text-align: center; position: relative; }
  @media (prefers-reduced-motion: reduce) { .ds-smoke, .ds-pulse, .ds-unlock, .ds-appear, .ds-coins i { animation: none !important; } .ds-coins { display: none; } .ds-infla { transition: none !important; } }
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

/* Оттиск печати: двойной круг, надпись по кругу, в середине — значок или короткий текст.
   Печати — награды и отметки «пройдено». */
/* Печать: двойное кольцо, надпись по кругу и знак в середине. Надпись растянута ровно на
   окружность (textLength): без обрыва на стыке и без наезда букв; при короткой надписи она
   повторяется через звёздочки. Поворот — внутри рисунка, а не CSS-поворотом всей картинки:
   так края букв и колец сглаживаются, а не идут лесенкой. Знак в середине — тоже SVG. */
const STAMP_R = 36.5;
const STAMP_C = 2 * Math.PI * STAMP_R;
export function Stamp({ text = 'ПРОЙДЕНО', center = null, color = 'var(--ds-bad)', size = 76, rotate = -12, style, testid }) {
  const id = `st${React.useId().replace(/:/g, '')}`;
  // ширина буквы жирной антиквы 11 px — около 7,4 px; повторов столько, чтобы буквы шли плотно
  const unit = `${text} ★ `;
  const reps = Math.max(1, Math.round(STAMP_C / (unit.length * 7.4)));
  // длинная надпись не помещается и одним разом — мельче шрифт, а не сжатые буквы без пробелов
  const fontSize = Math.min(11, (11 * STAMP_C) / (reps * unit.length * 7.4));
  return (
    <span style={{ display: 'inline-block', width: size, height: size, color, ...style }} data-testid={testid}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={text} shapeRendering="geometricPrecision" textRendering="geometricPrecision">
        <defs><path id={id} d={`M50,50 m-${STAMP_R},0 a${STAMP_R},${STAMP_R} 0 1,1 ${2 * STAMP_R},0 a${STAMP_R},${STAMP_R} 0 1,1 -${2 * STAMP_R},0`} /></defs>
        <g transform={`rotate(${rotate} 50 50)`} opacity="0.92">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="29.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <text fill="currentColor" fontFamily="var(--ds-serif)" fontWeight="700" fontSize={fontSize.toFixed(2)} dominantBaseline="middle">
            <textPath href={`#${id}`} startOffset="0" textLength={STAMP_C - 0.5} lengthAdjust="spacing">{unit.repeat(reps).trim()} ★</textPath>
          </text>
          {typeof center === 'string' || typeof center === 'number'
            ? <text x="50" y="51" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontFamily="var(--ds-mono)" fontWeight="700" fontSize="15">{center}</text>
            : center && <svg x="38" y="38" width="24" height="24" viewBox="0 0 24 24" overflow="visible" style={{ color: 'currentColor' }}><g transform="translate(2 2)">{center}</g></svg>}
        </g>
      </svg>
    </span>
  );
}
// почтовая марка для альбома: перфорация, рамка цвета юнита, номинал и подпись. Ещё не
// заработанная марка — блёклый серый рисунок, но подпись и номер читаются полным контрастом
export function PostStamp({ color, value, caption, children, dim = false, testid }) {
  const ink = dim ? 'var(--ds-ink2)' : 'var(--u-ink)';
  return (
    <span className="ds-postage" style={{ '--u': dim ? 'var(--ds-rule2)' : color }} data-testid={testid} data-dim={dim ? 'true' : undefined}>
      <span className="ds-postage-in" style={{ display: 'block', width: 92 }}>
        {value != null && <span className="ds-num" style={{ position: 'absolute', top: 3, left: 5, fontSize: 12, fontWeight: 700, color: ink }}>{value}</span>}
        <span style={{ display: 'block', minHeight: 62, opacity: dim ? 0.45 : 1, filter: dim ? 'grayscale(1)' : undefined }}>{children}</span>
        <span style={{ display: 'block', font: '700 12px/1.2 var(--ds-serif)', letterSpacing: '.04em', textTransform: 'uppercase', color: ink, marginTop: 2 }}>{caption}</span>
      </span>
    </span>
  );
}

/* Гравюры зданий юнитов. alive — юнит пройден: здание в цвете юнита, окна светятся, из
   трубы дым, флаг поднят; иначе — только контур тушью. Поле 120×90, земля на y = 82. */
const B = {
  market: (h) => (
    <>
      {[10, 44, 78].map((x, i) => (
        <g key={x}>
          <rect x={x} y="50" width="32" height="32" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
          <rect x={x + 4} y="60" width="24" height="10" fill={h.hatch} stroke="currentColor" strokeWidth=".6" />
          <path d={`M${x - 3},50 L${x + 35},50 L${x + 31},38 L${x + 1},38 Z`} fill={h.alive ? (i % 2 ? h.wash : h.accent) : 'none'} stroke="currentColor" strokeWidth="1.1" />
          {[0, 1, 2, 3].map((k) => <path key={k} d={`M${x - 3 + k * 9.5},50 q4.75,5 9.5,0`} fill={h.alive ? h.accent : 'none'} stroke="currentColor" strokeWidth=".9" />)}
          <line x1={x + 1} y1="38" x2={x + 1} y2="82" stroke="currentColor" strokeWidth=".8" /><line x1={x + 31} y1="38" x2={x + 31} y2="82" stroke="currentColor" strokeWidth=".8" />
        </g>
      ))}
      <circle cx="20" cy="76" r="3" fill={h.alive ? h.gold : 'none'} stroke="currentColor" strokeWidth=".7" /><circle cx="27" cy="77" r="3" fill={h.alive ? h.accent : 'none'} stroke="currentColor" strokeWidth=".7" />
    </>
  ),
  workshop: (h) => (
    <>
      <rect x="14" y="44" width="92" height="38" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <path d="M14,44 L14,30 L37,44 L37,30 L60,44 L60,30 L83,44 L83,30 L106,44" fill={h.alive ? h.wash : 'none'} stroke="currentColor" strokeWidth="1.1" />
      {[20, 43, 66, 89].map((x) => <rect key={x} x={x} y="52" width="12" height="12" fill={h.alive ? h.gold : h.hatch} stroke="currentColor" strokeWidth=".8" />)}
      <rect x="50" y="66" width="20" height="16" fill={h.hatch} stroke="currentColor" strokeWidth=".9" />
      <rect x="92" y="14" width="8" height="22" fill={h.body} stroke="currentColor" strokeWidth="1" />
      {h.smoke(96, 10)}
    </>
  ),
  bakery: (h) => (
    <>
      <rect x="22" y="46" width="70" height="36" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <path d="M16,48 L57,20 L98,48 Z" fill={h.alive ? h.wash : h.hatch} stroke="currentColor" strokeWidth="1.1" />
      <rect x="72" y="22" width="8" height="16" fill={h.body} stroke="currentColor" strokeWidth="1" />
      <rect x="30" y="56" width="22" height="16" fill={h.alive ? h.gold : 'none'} stroke="currentColor" strokeWidth=".9" /><line x1="30" y1="64" x2="52" y2="64" stroke="currentColor" strokeWidth=".6" />
      <rect x="62" y="58" width="14" height="24" fill={h.hatch} stroke="currentColor" strokeWidth=".9" />
      <line x1="92" y1="52" x2="104" y2="52" stroke="currentColor" strokeWidth="1" />
      <path d="M104,52 c-6,0 -6,10 0,10 c6,0 6,-10 0,-10 m-3,3 c2,3 4,3 6,0" fill={h.alive ? h.accent : 'none'} stroke="currentColor" strokeWidth="1" />
      {h.smoke(76, 18)}
    </>
  ),
  bank: (h) => (
    <>
      <path d="M12,82 L108,82 L104,76 L16,76 Z" fill={h.hatch} stroke="currentColor" strokeWidth="1" />
      <path d="M16,76 L104,76 L104,72 L16,72 Z" fill={h.body} stroke="currentColor" strokeWidth=".9" />
      {[24, 42, 60, 78, 96].map((x) => <g key={x}><rect x={x - 4} y="42" width="8" height="30" fill={h.alive ? h.wash : h.body} stroke="currentColor" strokeWidth=".9" /><line x1={x} y1="44" x2={x} y2="70" stroke="currentColor" strokeWidth=".4" /></g>)}
      <rect x="14" y="36" width="92" height="6" fill={h.body} stroke="currentColor" strokeWidth="1" />
      <path d="M12,36 L60,14 L108,36 Z" fill={h.alive ? h.accent : h.hatch} stroke="currentColor" strokeWidth="1.1" />
      <circle cx="60" cy="28" r="4" fill={h.alive ? h.gold : 'none'} stroke="currentColor" strokeWidth=".9" />
    </>
  ),
  exchange: (h) => (
    <>
      <rect x="10" y="52" width="100" height="30" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      {[34, 48, 62, 76].map((x) => <rect key={x} x={x - 3} y="54" width="6" height="28" fill={h.alive ? h.wash : h.body} stroke="currentColor" strokeWidth=".8" />)}
      {[16, 94].map((x) => <rect key={x} x={x} y="60" width="10" height="12" fill={h.alive ? h.gold : h.hatch} stroke="currentColor" strokeWidth=".8" />)}
      <rect x="28" y="46" width="64" height="6" fill={h.body} stroke="currentColor" strokeWidth="1" />
      <path d="M36,46 C36,24 84,24 84,46 Z" fill={h.alive ? h.accent : h.hatch} stroke="currentColor" strokeWidth="1.1" />
      <line x1="60" y1="28" x2="60" y2="16" stroke="currentColor" strokeWidth="1" />
      <path d="M60,16 L72,19 L60,22 Z" fill={h.alive ? h.flag : 'none'} stroke="currentColor" strokeWidth=".8" />
    </>
  ),
  ministry: (h) => (
    <>
      <rect x="8" y="40" width="104" height="42" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      {[14, 26, 38, 74, 86, 98].map((x) => [46, 60].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="7" height="9" fill={h.alive ? h.gold : h.hatch} stroke="currentColor" strokeWidth=".6" />))}
      <rect x="48" y="34" width="24" height="48" fill={h.alive ? h.wash : h.body} stroke="currentColor" strokeWidth="1" />
      <path d="M46,34 L60,24 L74,34 Z" fill={h.alive ? h.accent : h.hatch} stroke="currentColor" strokeWidth="1" />
      <rect x="55" y="64" width="10" height="18" fill={h.hatch} stroke="currentColor" strokeWidth=".8" />
      <line x1="60" y1="24" x2="60" y2="8" stroke="currentColor" strokeWidth="1" />
      <path d="M60,8 L74,11 L60,15 Z" fill={h.alive ? h.flag : 'none'} stroke="currentColor" strokeWidth=".8" />
    </>
  ),
  port: (h) => (
    <>
      <rect x="10" y="54" width="48" height="24" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <path d="M10,54 L34,44 L58,54 Z" fill={h.alive ? h.wash : h.hatch} stroke="currentColor" strokeWidth="1" />
      <rect x="26" y="62" width="16" height="16" fill={h.hatch} stroke="currentColor" strokeWidth=".8" />
      <path d="M74,78 L74,24 M74,24 L106,32 M74,30 L100,34 M80,24 L80,78" stroke="currentColor" strokeWidth="1.1" fill="none" />
      {[30, 40, 50, 60, 70].map((y) => <line key={y} x1="74" y1={y} x2="80" y2={y + 6} stroke="currentColor" strokeWidth=".6" />)}
      <line x1="102" y1="33" x2="102" y2="48" stroke="currentColor" strokeWidth=".7" /><rect x="97" y="48" width="10" height="8" fill={h.alive ? h.accent : 'none'} stroke="currentColor" strokeWidth=".8" />
      {[82, 86].map((y) => <path key={y} d={`M6,${y - 4} q6,-3 12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0 t12,0`} fill="none" stroke="currentColor" strokeWidth=".6" opacity=".7" />)}
    </>
  ),
  store: (h) => (
    <>
      <rect x="18" y="30" width="84" height="52" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <rect x="24" y="36" width="72" height="10" fill={h.alive ? h.accent : h.hatch} stroke="currentColor" strokeWidth=".9" />
      {[26, 44, 62, 80].map((x) => <rect key={x} x={x} y="50" width="14" height="10" fill={h.alive ? h.gold : 'none'} stroke="currentColor" strokeWidth=".7" />)}
      <path d="M14,64 L106,64 L100,70 L20,70 Z" fill={h.alive ? h.wash : 'none'} stroke="currentColor" strokeWidth="1" />
      <rect x="26" y="70" width="30" height="12" fill={h.hatch} stroke="currentColor" strokeWidth=".8" /><rect x="64" y="70" width="14" height="12" fill={h.hatch} stroke="currentColor" strokeWidth=".8" />
    </>
  ),
  factory: (h) => (
    <>
      <rect x="10" y="50" width="100" height="32" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <path d="M10,50 L30,40 L30,50 L50,40 L50,50 L70,40 L70,50" fill={h.alive ? h.wash : 'none'} stroke="currentColor" strokeWidth="1" />
      {[82, 96].map((x) => <rect key={x} x={x} y="18" width="8" height="32" fill={h.body} stroke="currentColor" strokeWidth="1" />)}
      {[16, 32, 48, 64].map((x) => <rect key={x} x={x} y="58" width="10" height="10" fill={h.alive ? h.gold : h.hatch} stroke="currentColor" strokeWidth=".7" />)}
      {h.smoke(86, 14)}{h.smoke(100, 14, 1.2)}
    </>
  ),
  tower: (h) => (
    <>
      <rect x="18" y="54" width="84" height="28" fill={h.body} stroke="currentColor" strokeWidth="1.1" />
      <rect x="46" y="22" width="28" height="60" fill={h.alive ? h.wash : h.body} stroke="currentColor" strokeWidth="1.1" />
      <path d="M44,22 L60,6 L76,22 Z" fill={h.alive ? h.accent : h.hatch} stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="34" r="8" fill={h.alive ? h.gold : 'none'} stroke="currentColor" strokeWidth="1" /><path d="M60,34 L60,29 M60,34 L64,36" stroke="currentColor" strokeWidth="1" />
      {[24, 36, 82, 94].map((x) => <rect key={x} x={x - 3} y="60" width="7" height="9" fill={h.hatch} stroke="currentColor" strokeWidth=".6" />)}
    </>
  ),
};
function useEngraving(kind, alive, color) {
  const reduced = useReducedMotion();
  const id = `hatch${React.useId().replace(/:/g, '')}`;
  const draw = B[kind] || B.store;
  const h = {
    alive, accent: color, gold: 'var(--ds-gold-soft)', flag: color,
    wash: `color-mix(in srgb, ${color} 22%, var(--ds-card))`, body: alive ? `color-mix(in srgb, ${color} 10%, var(--ds-card))` : 'var(--ds-card)', hatch: `url(#${id})`,
    smoke: (x, y, delay = 0) => (alive && !reduced ? (
      <g>{[0, 0.9, 1.8].map((d) => <circle key={d} className="ds-smoke" cx={x} cy={y} r="3.2" fill="var(--ds-ink3)" style={{ animationDelay: `${d + delay}s` }} />)}</g>
    ) : null),
  };
  const inner = (
    <>
      <defs>
        <pattern id={id} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3.2" stroke="currentColor" strokeWidth=".6" /></pattern>
      </defs>
      <path d="M2,82 L118,82" stroke="currentColor" strokeWidth="1.2" />
      {[6, 18, 30, 88, 100, 112].map((x) => <line key={x} x1={x} y1="84" x2={x + 5} y2="87" stroke="currentColor" strokeWidth=".6" opacity=".7" />)}
      {draw(h)}
    </>
  );
  return { inner, ink: alive ? 'var(--ds-ink)' : 'var(--ds-ink3)' };
}
export function Engraving({ kind = 'store', alive = false, size = 120, color = 'var(--u)', label }) {
  const { inner, ink } = useEngraving(kind, alive, color);
  return (
    <svg viewBox="0 0 120 90" width={size} height={(size * 90) / 120} role="img" aria-label={label || 'здание'} data-testid="engraving" data-kind={kind} data-alive={String(alive)}
      style={{ color: ink, display: 'block', flexShrink: 0 }}>{inner}</svg>
  );
}
// та же гравюра внутри другого рисунка (карта Инфлатии): x, y — левый верхний угол, scale — масштаб
export function EngravingG({ kind = 'store', alive = false, x = 0, y = 0, scale = 1, color = 'var(--u)' }) {
  const { inner, ink } = useEngraving(kind, alive, color);
  return <g transform={`translate(${x},${y}) scale(${scale})`} style={{ color: ink }} data-kind={kind} data-alive={String(alive)}>{inner}</g>;
}

// вырезка из «Вестника» — рамка истории: шапка газеты, номер и рубрика, текст
export function Clipping({ issue, rubric, children, testid }) {
  return (
    <div style={{ filter: 'drop-shadow(0 2px 3px var(--ds-shade))', transform: 'rotate(-.6deg)' }} data-testid={testid}>
      <div className="ds-clip">
        <div className="ds-clip-mast">Вестник Инфлатии</div>
        <div className="ds-clip-meta"><span>{issue}</span><span>{rubric}</span></div>
        {children}
      </div>
    </div>
  );
}

/* Полоса уровня — сколько упражнений урока пройдено: отрезок на каждое упражнение, верный
   ответ — в цвете юнита, ошибка — красной штриховкой, текущее — рамкой. pulse растёт с каждым
   верным ответом серии: последний отрезок коротко вспыхивает (около 0,5 с). Справа — счёт. */
export function ProgressChart({ answers = [], total, pulse = 0, testid = 'lesson-progress' }) {
  const n = Math.max(1, total);
  const done = Math.min(answers.length, n);
  const pct = Math.round((done / n) * 100);
  return (
    <div className="ds-level" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Пройдено ${done} из ${n}`}
      data-testid={testid} data-glow={pulse ? 'pulse' : 'off'}>
      <div className="ds-level-track">
        {Array.from({ length: n }, (_, i) => {
          const st = i < done ? (answers[i] ? 'ok' : 'bad') : i === done ? 'cur' : '';
          return <i key={i === done - 1 ? `p${pulse}` : i} className={`${st} ${i === done - 1 && answers[i] && pulse ? 'ds-pulse' : ''}`} />;
        })}
      </div>
      <span className="ds-num ds-level-n">{done}/{n}</span>
    </div>
  );
}

/* Инфля надувается с каждым верным ответом подряд (до пяти) и мягко сдувается после ошибки.
   Место под самую большую Инфлю (и под её шляпу) оставлено заранее — она не уходит за край. */
const INFLA_MAX = 1.3;
export function InflaMeter({ streak = 0, mood = 'hello', size = 40 }) {
  const k = 1 + 0.06 * Math.min(streak, 5);
  const prev = useRef(k);
  const deflate = k < prev.current;
  useEffect(() => { prev.current = k; });
  const outfit = useContext(OutfitContext);
  const h = mascotHeight(size, outfit);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', width: Math.ceil(size * INFLA_MAX) + 4, height: Math.ceil(h * INFLA_MAX) + 4, flexShrink: 0 }}>
      <span className={`ds-infla ${deflate ? 'deflate' : ''}`} style={{ transform: `scale(${k})` }} data-testid="infla" data-scale={k.toFixed(2)}>
        <Mascot mood={mood} size={size} />
      </span>
    </span>
  );
}

// монеты в конце урока — вместо конфетти; при «уменьшить движение» их нет
/* Сундук юнита: деревянный, с коваными полосами и замком. open — крышка откинута, внутри
   монеты и свечение; spent — уже открыт и пуст (крышка откинута, внутри темно). */
export function Chest({ size = 64, open = false, spent = false, label = 'Сундук' }) {
  const reduced = useReducedMotion();
  const id = useMemo(() => `chest${Math.random().toString(36).slice(2, 8)}`, []);
  const lid = open || spent;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={label} data-testid="chest-art" data-open={String(lid)} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#B4723A" /><stop offset="1" stopColor="#7A4420" /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#C98446" /><stop offset="1" stopColor="#8E5228" /></linearGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="60%" r="60%"><stop offset="0" stopColor="#FFF1B8" stopOpacity=".95" /><stop offset="1" stopColor="#FFD24A" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="32" cy="58.5" rx="25" ry="3.2" fill="#000" opacity=".12" />
      {/* короб */}
      <rect x="7" y="30" width="50" height="27" rx="3" fill={`url(#${id}w)`} stroke="#3B2210" strokeWidth="1.6" />
      <path d="M7 38 H57 M7 49 H57" stroke="#5C3416" strokeWidth=".9" opacity=".55" />
      {/* внутри — монеты и свет, когда открыт */}
      {lid && (
        <g>
          <path d="M9 31 H55 V35 H9 Z" fill={spent ? '#2A170A' : '#5A3212'} />
          {!spent && <>
            <ellipse cx="32" cy="27" rx="26" ry="16" fill={`url(#${id}g)`} className={reduced ? '' : 'ds-chest-glow'} />
            {[[18, 30], [24, 28.6], [30, 29.6], [36, 28.2], [42, 29.4], [47, 30.4], [27, 31], [39, 31]].map(([x, y], k) => (
              <ellipse key={k} cx={x} cy={y} rx="3.6" ry="1.9" fill="#E3B53C" stroke="#94700F" strokeWidth=".7" />
            ))}
          </>}
        </g>
      )}
      {/* кованые полосы и уголки */}
      <rect x="15" y="30" width="5" height="27" fill="#5E5A55" stroke="#2C2A27" strokeWidth=".8" />
      <rect x="44" y="30" width="5" height="27" fill="#5E5A55" stroke="#2C2A27" strokeWidth=".8" />
      {[[17.5, 34], [17.5, 53], [46.5, 34], [46.5, 53]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r=".9" fill="#C8C2B8" />)}
      {/* замок */}
      <rect x="27.5" y="31" width="9" height="10" rx="1.6" fill="#D9A92E" stroke="#6E4E0A" strokeWidth="1" />
      <path d="M32 34.4 a1.4 1.4 0 1 1 0.01 0 M32 35.6 V38.4" stroke="#3B2A08" strokeWidth="1.3" strokeLinecap="round" fill="#3B2A08" />
      {/* крышка: закрыта — сводом над коробом, открыта — откинута назад */}
      <g style={{ transformOrigin: '32px 30px', transform: lid ? 'translateY(-6px) scaleY(-.55)' : 'none', transition: reduced ? 'none' : 'transform .5s cubic-bezier(.3,1.5,.6,1)' }}>
        <path d="M7 30 V22 Q7 12 32 12 Q57 12 57 22 V30 Z" fill={`url(#${id}l)`} stroke="#3B2210" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 21 Q32 13 55 21" stroke="#E2A866" strokeWidth="1.2" fill="none" opacity=".6" />
        <path d="M15 30 V18.5 Q17 15 20 14.4 V30 Z M44 14.4 Q47 15 49 18.5 V30 H44 Z" fill="#5E5A55" stroke="#2C2A27" strokeWidth=".8" />
      </g>
    </svg>
  );
}

export function CoinShower({ n = 26, seed = 1 }) {
  const reduced = useReducedMotion();
  const [bits] = useState(() => {
    let x = seed * 9301 + 49297;
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    return Array.from({ length: n }, () => ({
      left: `${Math.round(rnd() * 96)}%`, dx: `${Math.round((rnd() - 0.5) * 120)}px`, spin: `${Math.round(360 + rnd() * 1080)}deg`,
      t: `${(1.5 + rnd() * 1.2).toFixed(2)}s`, d: `${(rnd() * 0.5).toFixed(2)}s`,
    }));
  });
  if (reduced) return null;
  return <div className="ds-coins" aria-hidden="true" data-testid="coins">{bits.map((b, i) => <i key={i} style={{ left: b.left, '--dx': b.dx, '--spin': b.spin, '--t': b.t, '--d': b.d }} />)}</div>;
}

// счёт с прокруткой до value; при «уменьшить движение» — сразу итог
export function CountUp({ value, prefix = '', duration = 900 }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame === 'undefined') { setShown(value); return undefined; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / duration); setShown(Math.round(value * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced, duration]);
  return <span data-value={value}>{prefix}{shown}</span>;
}
