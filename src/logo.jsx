/* Логотип Инфляции: монета, надутая как воздушный шарик, — деньги, которые
   «надуваются», — с колонной «I» посередине. Те же контуры, что в public/favicon.svg
   (и в иконках, собранных из неё scripts/icons.mjs); меняя знак, меняйте оба. */
import React from 'react';

export function InflatiaMark({ size = 48, title = 'Инфляция' }) {
  // у каждого экземпляра свой id градиента: два логотипа на странице не должны делить один
  const gid = `inflatia-g-${React.useId().replace(/:/g, '')}`;
  return (
    // title={null} — знак рядом с надписью «Инфляция»: для чтения с экрана он лишний
    <svg viewBox="0 0 64 64" width={size} height={size} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })} style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <radialGradient id={gid} cx="36%" cy="28%" r="78%">
          <stop offset="0" stopColor="#FBE7A1" />
          <stop offset="0.5" stopColor="#D9B23A" />
          <stop offset="1" stopColor="#94700F" />
        </radialGradient>
      </defs>
      <path d="M32 50.2 C 28.8 53.6, 35.6 56.4, 31.8 60.4 C 30.6 61.6, 31.4 62.6, 32.6 63.4" fill="none" stroke="#D9B23A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M29.3 51.6 L32 47.6 L34.7 51.6 Q32 52.6 29.3 51.6 Z" fill="#A9841A" stroke="#3A2A08" strokeWidth="0.9" strokeLinejoin="round" />
      <ellipse cx="32" cy="25" rx="22" ry="23.2" fill={`url(#${gid})`} stroke="#3A2A08" strokeWidth="1.6" />
      <ellipse cx="32" cy="25" rx="18.2" ry="19.3" fill="none" stroke="#5A4210" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="1.2 2" />
      <path d="M25.2 14.6 H38.8 V17.4 H34.1 V32.6 H38.8 V35.4 H25.2 V32.6 H29.9 V17.4 H25.2 Z" fill="#2A1D05" />
      <path d="M17.4 18.6 C 18.6 13.6, 22.4 9.8, 27 8.8" fill="none" stroke="#FFF7DC" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* Заставка загрузки — в стиле знака: монета-шарик надувается, покачивается на нитке, вокруг
   медленно вращается розетка, как водяной знак купюры; под ней — подпись и три точки. Появляется
   с задержкой: быстрая загрузка не мигает заставкой. Без движения — при «уменьшить движение». */
const LOADER_CSS = `
  .bl { min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; animation: bl-in .3s ease-out .18s both; }
  .bl-stage { position: relative; width: 132px; height: 132px; display: grid; place-items: center; }
  .bl-ring { position: absolute; inset: 0; animation: bl-spin 14s linear infinite; }
  .bl-coin { position: relative; animation: bl-inflate .9s cubic-bezier(.3,1.5,.5,1) .2s both, bl-bob 2.6s ease-in-out 1.1s infinite; transform-origin: 50% 80%; }
  .bl-shadow { position: absolute; bottom: 4px; width: 46px; height: 7px; border-radius: 50%; background: currentColor; opacity: .12; animation: bl-shadow 2.6s ease-in-out 1.1s infinite; }
  .bl-text { font: 600 14px/1.3 'PT Sans', sans-serif; letter-spacing: .04em; opacity: .8; display: flex; align-items: baseline; gap: 2px; }
  .bl-dots i { display: inline-block; width: 4px; height: 4px; margin-left: 3px; border-radius: 50%; background: currentColor; animation: bl-dot 1.2s ease-in-out infinite; }
  .bl-dots i:nth-child(2) { animation-delay: .15s; } .bl-dots i:nth-child(3) { animation-delay: .3s; }
  @keyframes bl-in { from { opacity: 0 } }
  @keyframes bl-spin { to { transform: rotate(360deg) } }
  @keyframes bl-inflate { 0% { transform: scale(.45) translateY(18px); opacity: 0 } 60% { transform: scale(1.06) translateY(-4px); opacity: 1 } 100% { transform: none } }
  @keyframes bl-bob { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-7px) rotate(2deg) } }
  @keyframes bl-shadow { 0%, 100% { transform: scaleX(1); opacity: .12 } 50% { transform: scaleX(.8); opacity: .07 } }
  @keyframes bl-dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35 } 40% { transform: translateY(-4px); opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { .bl, .bl-ring, .bl-coin, .bl-shadow, .bl-dots i { animation: none !important; } }
`;
// розетка: два слоя лепестков-петель, как гильош на банкноте
const ROSETTE = Array.from({ length: 18 }, (_, k) => {
  const a = (k / 18) * Math.PI * 2;
  const x = 66 + Math.cos(a) * 44; const y = 66 + Math.sin(a) * 44;
  return `M66 66 Q ${(66 + Math.cos(a + 0.5) * 70).toFixed(1)} ${(66 + Math.sin(a + 0.5) * 70).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');
export function BrandLoader({ text = 'Надуваем Инфлю', background, color, compact = false }) {
  return (
    <div className="bl" role="status" aria-live="polite" style={{ background, color, ...(compact ? { minHeight: '45vh' } : {}) }} data-testid="brand-loader">
      <style>{LOADER_CSS}</style>
      <div className="bl-stage" aria-hidden="true">
        <svg className="bl-ring" viewBox="0 0 132 132" width="132" height="132">
          <circle cx="66" cy="66" r="60" fill="none" stroke="#C9A43A" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="2 4" />
          <path d={ROSETTE} fill="none" stroke="#C9A43A" strokeOpacity=".35" strokeWidth="1" />
          <circle cx="66" cy="66" r="50" fill="none" stroke="#C9A43A" strokeOpacity=".3" strokeWidth=".8" />
        </svg>
        <span className="bl-shadow" />
        <span className="bl-coin"><InflatiaMark size={76} title={null} /></span>
      </div>
      <div className="bl-text">{text}<span className="bl-dots"><i /><i /><i /></span></div>
    </div>
  );
}
