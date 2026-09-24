/* Логотип Inflatia: монета, надутая как воздушный шарик, — деньги, которые
   «надуваются», — с колонной «I» посередине. Те же контуры, что в public/favicon.svg
   (и в иконках, собранных из неё scripts/icons.mjs); меняя знак, меняйте оба. */
import React from 'react';

export function InflatiaMark({ size = 48, title = 'Inflatia' }) {
  // у каждого экземпляра свой id градиента: два логотипа на странице не должны делить один
  const gid = `inflatia-g-${React.useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={title} style={{ flexShrink: 0, display: 'block' }}>
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
