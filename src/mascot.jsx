/* ИНФЛЯ — талисман пути уроков: монета-шарик с логотипа, только вместо колонны «I» — лицо.
   Семь настроений: wave (машет на приветствии), hello (привет), joy (радость после верного ответа), cheer (подбадривание
   после ошибки), party (праздник в конце урока), sleep (сон, если день пропущен),
   think (задумчивость на подсказке). Реакции короткие: лёгкое покачивание, без звука и без
   всплывающих окон; при «меньше движения» в системе — стоит на месте. */
import React from 'react';

const EYES = {
  hello: (c) => <><circle cx="24.5" cy="23" r="2.6" fill={c} /><circle cx="39.5" cy="23" r="2.6" fill={c} /></>,
  joy: (c) => <><path d="M21.5 24 Q24.5 19.8 27.5 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" /><path d="M36.5 24 Q39.5 19.8 42.5 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" /></>,
  party: (c) => <><path d="M21.5 23.5 Q24.5 19 27.5 23.5" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" /><path d="M36.5 23.5 Q39.5 19 42.5 23.5" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" /></>,
  cheer: (c) => <><circle cx="24.5" cy="23.5" r="2.5" fill={c} /><circle cx="39.5" cy="23.5" r="2.5" fill={c} /><path d="M21 18.4 L27.4 17.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><path d="M43 18.4 L36.6 17.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>,
  sleep: (c) => <><path d="M21.5 24 Q24.5 26.2 27.5 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" /><path d="M36.5 24 Q39.5 26.2 42.5 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" /></>,
  think: (c) => <><circle cx="26" cy="21.5" r="2.5" fill={c} /><circle cx="41" cy="21.5" r="2.5" fill={c} /><path d="M22 17 L28.5 16.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>,
};
EYES.wave = EYES.hello;
const MOUTH = {
  wave: (c) => <path d="M24.5 29.5 Q32 38.5 39.5 29.5 Z" fill={c} />,
  hello: (c) => <path d="M26 31 Q32 35.6 38 31" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" />,
  joy: (c) => <path d="M24.5 29.5 Q32 38.5 39.5 29.5 Z" fill={c} />,
  party: (c) => <path d="M23.5 29 Q32 40 40.5 29 Z" fill={c} />,
  cheer: (c) => <path d="M26.5 31 Q32 34.6 37.5 31" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" />,
  sleep: (c) => <ellipse cx="32" cy="32" rx="2.2" ry="1.6" fill={c} />,
  think: (c) => <path d="M27.5 32.5 L36 31.2" stroke={c} strokeWidth="2.2" strokeLinecap="round" />,
};
export const MOODS = Object.keys(MOUTH);
const CSS = `
  @keyframes infla-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
  @keyframes infla-hop { 0% { transform: translateY(0) scale(1) } 40% { transform: translateY(-6px) scale(1.04) } 100% { transform: translateY(0) scale(1) } }
  .infla { transform-origin: 50% 90%; }
  .infla-bob { animation: infla-bob 3.2s ease-in-out infinite; }
  .infla-hop { animation: infla-hop .45s ease-out 1; }
  /* моргает раз в несколько секунд; машет рукой на приветствии */
  @keyframes infla-blink { 0%, 92%, 100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
  @keyframes infla-wave { 0%, 100% { transform: rotate(0) } 25% { transform: rotate(-28deg) } 75% { transform: rotate(18deg) } }
  @keyframes infla-sway { 0%, 100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
  .infla-eyes { transform-box: fill-box; transform-origin: center; animation: infla-blink 4.2s ease-in-out infinite; }
  .infla-hand { transform-box: fill-box; transform-origin: 20% 90%; animation: infla-wave 1.1s ease-in-out infinite; }
  .infla-sway { animation: infla-sway 3.6s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .infla-bob, .infla-hop, .infla-eyes, .infla-hand, .infla-sway { animation: none; } }
`;

export function Mascot({ mood = 'hello', size = 56, label }) {
  const m = MOUTH[mood] ? mood : 'hello';
  const gid = `infla-g-${React.useId().replace(/:/g, '')}`;
  const ink = '#2A1D05';
  const motion = m === 'joy' || m === 'party' ? 'infla-hop' : m === 'sleep' ? '' : m === 'wave' ? 'infla-sway' : 'infla-bob';
  return (
    <span style={{ display: 'inline-block', lineHeight: 0 }} data-testid="mascot" data-mood={m}>
      <style>{CSS}</style>
      <svg viewBox="0 0 64 70" width={size} height={size * 70 / 64} role="img" aria-label={label || `Инфля: ${({ hello: 'привет', wave: 'машет', joy: 'радуется', cheer: 'подбадривает', party: 'празднует', sleep: 'спит', think: 'думает' })[m]}`}
        className={`infla ${motion}`} key={m}>
        <defs>
          <radialGradient id={gid} cx="36%" cy="28%" r="78%">
            <stop offset="0" stopColor="#FBE7A1" /><stop offset="0.5" stopColor="#D9B23A" /><stop offset="1" stopColor="#94700F" />
          </radialGradient>
        </defs>
        <path d="M32 50.2 C 28.8 53.6, 35.6 56.4, 31.8 60.4 C 30.6 61.6, 31.4 62.6, 32.6 63.4" fill="none" stroke="#D9B23A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M29.3 51.6 L32 47.6 L34.7 51.6 Q32 52.6 29.3 51.6 Z" fill="#A9841A" stroke="#3A2A08" strokeWidth="0.9" strokeLinejoin="round" />
        <ellipse cx="32" cy="25" rx="22" ry="23.2" fill={`url(#${gid})`} stroke="#3A2A08" strokeWidth="1.6" />
        <ellipse cx="32" cy="25" rx="18.2" ry="19.3" fill="none" stroke="#5A4210" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="1.2 2" />
        <path d="M17.4 18.6 C 18.6 13.6, 22.4 9.8, 27 8.8" fill="none" stroke="#FFF7DC" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
        {(m === 'joy' || m === 'party' || m === 'hello') && <><ellipse cx="20" cy="29.5" rx="2.6" ry="1.6" fill="#E07A5F" opacity="0.45" /><ellipse cx="44" cy="29.5" rx="2.6" ry="1.6" fill="#E07A5F" opacity="0.45" /></>}
        {m === 'sleep' ? EYES[m](ink) : <g className="infla-eyes">{EYES[m](ink)}</g>}
        {m === 'wave' && (
          <g className="infla-hand">
            <path d="M52 34 Q57 30 58 24" fill="none" stroke="#3A2A08" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="58.5" cy="21.5" r="4" fill="#E8C766" stroke="#3A2A08" strokeWidth="1.2" />
          </g>
        )}
        {MOUTH[m](ink)}
        {m === 'party' && <>
          <path d="M26 3.5 L32 -4 L38 3.5 Z" fill="#4FA38F" stroke="#3A2A08" strokeWidth="0.8" transform="translate(0 4)" />
          {[[8, 12, '#E07A5F'], [56, 10, '#6FA8DC'], [5, 34, '#4FA38F'], [59, 32, '#E07A5F'], [12, 4, '#D9B23A']].map(([x, y, c], i) => <rect key={i} x={x} y={y} width="3" height="3" fill={c} transform={`rotate(${i * 37} ${x + 1.5} ${y + 1.5})`} />)}
        </>}
        {m === 'sleep' && <text x="46" y="9" fontSize="9" fill="#9FB3C8" fontFamily="sans-serif">z z</text>}
        {m === 'think' && <><circle cx="52" cy="9" r="1.6" fill="#9FB3C8" /><circle cx="56.5" cy="4.5" r="2.4" fill="#9FB3C8" /></>}
        {m === 'cheer' && <path d="M52 30 l2 -4 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 z" fill="#FBE7A1" stroke="#94700F" strokeWidth="0.6" />}
      </svg>
    </span>
  );
}
