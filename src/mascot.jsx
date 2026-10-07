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
  /* редкие вещи лавки — живые: шар дышит, орден качается, камни вспыхивают, огранка плывёт */
  @keyframes infla-breathe { 0%, 100% { transform: scale(.78) } 50% { transform: scale(1.12) } }
  @keyframes infla-swing { 0%, 100% { transform: rotate(-9deg) } 50% { transform: rotate(9deg) } }
  @keyframes infla-spark { 0%, 62%, 100% { opacity: 0; transform: scale(.3) } 76% { opacity: 1; transform: scale(1.25) } 88% { opacity: .6; transform: scale(.8) } }
  @keyframes infla-spin { to { transform: rotate(360deg) } }
  .infla-balloon { transform-box: fill-box; transform-origin: 50% 100%; animation: infla-breathe 4.2s ease-in-out infinite; }
  .infla-swing { transform-box: fill-box; transform-origin: 50% 0; animation: infla-swing 2.6s ease-in-out infinite; }
  .infla-spark { transform-box: fill-box; transform-origin: center; animation: infla-spark 2.4s ease-in-out infinite; opacity: 0; }
  .infla-spin { transform-box: view-box; transform-origin: 32px 25px; animation: infla-spin 24s linear infinite; }
  @media (prefers-reduced-motion: reduce) { .infla-bob, .infla-hop, .infla-eyes, .infla-hand, .infla-sway, .infla-balloon, .infla-swing, .infla-spin { animation: none; } .infla-spark { animation: none; opacity: 1; } }
`;

/* Наряды из лавки (src/learn/rewards.js): голова, лицо, шея. Рисуются поверх монеты тушью и
   одним цветом; для головного убора поле рисунка чуть выше. */
const INK = '#2A1D05';
// блик-звёздочка: вспыхивает с задержкой d секунд
const spark = (x, y, d, r = 2.4) => <path key={`${x}-${y}`} className="infla-spark" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill="#FFFDF2" stroke="#E3B53C" strokeWidth=".3" />;
const OUTFIT = {
  cap: <g><path d="M13 13 Q32 -6 51 13 Q32 9 13 13 Z" fill="#3E6FA8" stroke={INK} strokeWidth="1.1" /><path d="M42 11.6 Q55 10 60 14.6 Q51 15.6 42 14 Z" fill="#2E568A" stroke={INK} strokeWidth="1" /><circle cx="32" cy="2.6" r="1.6" fill="#2E568A" stroke={INK} strokeWidth=".8" /></g>,
  beret: <g><ellipse cx="29" cy="5.5" rx="18" ry="6.4" fill="#A0372A" stroke={INK} strokeWidth="1.1" transform="rotate(-8 29 5.5)" /><path d="M29 -0.8 l1 -3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" /></g>,
  bowler: <g><path d="M18 9.5 Q18 -8 32 -8 Q46 -8 46 9.5 Z" fill="#3A3530" stroke={INK} strokeWidth="1.1" /><ellipse cx="32" cy="9.5" rx="20" ry="3.4" fill="#2A2622" stroke={INK} strokeWidth="1" /><path d="M18.6 5.6 Q32 8 45.4 5.6" fill="none" stroke="#86461F" strokeWidth="1.8" /></g>,
  tophat: <g><rect x="21" y="-11" width="22" height="19" rx="1.5" fill="#22201E" stroke={INK} strokeWidth="1.1" /><rect x="21" y="3" width="22" height="3.4" fill="#A0372A" /><ellipse cx="32" cy="8" rx="19" ry="3.2" fill="#22201E" stroke={INK} strokeWidth="1" /></g>,
  glasses: <g fill="none" stroke={INK} strokeWidth="1.5"><circle cx="24.5" cy="23" r="5.6" fill="#DDEBF7" fillOpacity=".35" /><circle cx="39.5" cy="23" r="5.6" fill="#DDEBF7" fillOpacity=".35" /><path d="M30.1 22.4 Q32 21 33.9 22.4 M18.9 22 L12.5 20.5 M45.1 22 L51.5 20.5" /></g>,
  monocle: <g fill="none" stroke={INK} strokeWidth="1.4"><circle cx="39.5" cy="23" r="6.2" fill="#DDEBF7" fillOpacity=".35" stroke="#94700F" strokeWidth="1.8" /><path d="M44 27.6 Q49 36 45 44" strokeDasharray="1.4 1.6" stroke="#94700F" /></g>,
  bowtie: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M24 45.5 L32 49 L24 52.5 Z" fill="#A0372A" /><path d="M40 45.5 L32 49 L40 52.5 Z" fill="#A0372A" /><rect x="30.3" y="47.3" width="3.4" height="3.4" rx=".8" fill="#7A2A20" /></g>,
  scarf: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M13 40 Q32 53 51 40 L51.5 45 Q32 58 12.5 45 Z" fill="#356653" /><path d="M42 47 L47 60 L42 61 L38.5 49 Z" fill="#2B5343" /><path d="M20 44 L21 48.5 M26 46.5 L26.6 51 M44 44 L43 48.5" stroke="#A9C7B8" strokeWidth="1.2" /></g>,
  tie: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M29.5 45.6 L34.5 45.6 L33.6 49 L30.4 49 Z" fill="#2C5A8E" /><path d="M30.4 49 L33.6 49 L35.6 61 L32 64.5 L28.4 61 Z" fill="#3E6FA8" /><path d="M29.6 53 L34.4 55.5 M29 58 L35 60.6" stroke="#9FB3C8" strokeWidth="1" /></g>,
  // новые вещи лавки: голова, лицо, шея
  ushanka: <g stroke={INK} strokeWidth="1.1" strokeLinejoin="round"><path d="M14 10 Q32 -9 50 10 L50 13 Q32 6 14 13 Z" fill="#6B4E32" /><path d="M14 10 Q32 4 50 10 L50 14.5 Q32 9 14 14.5 Z" fill="#E9DDC7" /><path d="M13.5 13 L11 27 Q14.5 28.5 17 25 L17.5 13.5 Z M50.5 13 L53 27 Q49.5 28.5 47 25 L46.5 13.5 Z" fill="#E9DDC7" /><circle cx="32" cy="2.5" r="2.4" fill="#A0372A" /></g>,
  crown: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M17 10 L19 -6 L25.5 3 L32 -9 L38.5 3 L45 -6 L47 10 Z" fill="#E3B53C" /><path d="M17 10 L47 10 L47 6.8 L17 6.8 Z" fill="#B88A1A" /><circle cx="32" cy="-4.5" r="1.9" fill="#2E8FB8" /><circle cx="24" cy="5" r="1.5" fill="#A0372A" /><circle cx="40" cy="5" r="1.5" fill="#A0372A" /><circle cx="19" cy="-6" r="1.2" fill="#FBE7A1" /><circle cx="45" cy="-6" r="1.2" fill="#FBE7A1" />{spark(32, -4.5, 0, 3)}{spark(24, 5, .8)}{spark(40, 5, 1.6)}</g>,
  pince: <g fill="none" stroke={INK} strokeWidth="1.3"><ellipse cx="25.5" cy="23.5" rx="4.6" ry="4" fill="#DDEBF7" fillOpacity=".35" /><ellipse cx="38.5" cy="23.5" rx="4.6" ry="4" fill="#DDEBF7" fillOpacity=".35" /><path d="M30.1 22.8 Q32 20.5 33.9 22.8" /><path d="M43 25 Q49 33 46 43" strokeDasharray="1.2 1.6" stroke="#94700F" /></g>,
  medal: <g className="infla-swing"><g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M26 44 L30 52 L34 52 L38 44 Z" fill="#A0372A" /><path d="M30 44 L32 50 L34 44 Z" fill="#3E6FA8" /><circle cx="32" cy="56" r="5.2" fill="#E3B53C" /><path d="M32 52.2 L33.1 54.9 L36 55.1 L33.8 56.9 L34.5 59.7 L32 58.2 L29.5 59.7 L30.2 56.9 L28 55.1 L30.9 54.9 Z" fill="#FBE7A1" strokeWidth=".6" /></g>{spark(35.4, 53.4, .4, 2.6)}</g>,
  // в руке: справа, у края монеты
  paper: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><circle cx="54" cy="39" r="3.2" fill="#E8C766" /><path d="M50 26 L62 28.5 L59.5 46 L47.5 43.5 Z" fill="#F4ECD8" /><path d="M51 29.5 L60 31.4 M50.6 32.6 L59.4 34.5 M50.2 35.7 L58.9 37.6 M49.8 38.8 L58.4 40.7" stroke="#8A7A5C" strokeWidth=".8" /><path d="M51.2 27.6 L56 28.6" stroke="#A0372A" strokeWidth="1.6" /></g>,
  abacus: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><rect x="49" y="29" width="13" height="17" rx="1.5" fill="#B9874E" /><rect x="50.6" y="30.6" width="9.8" height="13.8" fill="#F4ECD8" />{[33.5, 37.5, 41.5].map((y) => <g key={y}><path d={`M50.6 ${y} H60.4`} stroke="#6B4E32" strokeWidth=".7" /><circle cx="52.6" cy={y} r="1.1" fill="#A0372A" strokeWidth=".5" /><circle cx="55" cy={y} r="1.1" fill="#A0372A" strokeWidth=".5" /><circle cx="58.6" cy={y} r="1.1" fill="#3E6FA8" strokeWidth=".5" /></g>)}<circle cx="51" cy="44.5" r="3" fill="#E8C766" /></g>,
  briefcase: <g stroke={INK} strokeWidth="1" strokeLinejoin="round"><path d="M52.5 35 Q52.5 31.5 55.5 31.5 Q58.5 31.5 58.5 35" fill="none" strokeWidth="1.4" /><rect x="48" y="35" width="15" height="12" rx="1.6" fill="#7A4A2A" /><path d="M48 39.5 H63" stroke="#4E2E18" /><rect x="54.3" y="38.4" width="2.4" height="2.4" fill="#E3B53C" strokeWidth=".6" /><circle cx="55.5" cy="33" r="2.6" fill="#E8C766" /></g>,
  /* трость: лакированное древко с бликом, металлический наконечник, литой набалдашник-«луковица»
     с воротничком; рука держит древко ниже набалдашника — не путается с ним */
  cane: <g stroke={INK} strokeWidth="1" strokeLinejoin="round">
    <path d="M56.3 29 L59.3 63" stroke={INK} strokeWidth="3.6" strokeLinecap="round" /><path d="M56.3 29 L59.3 63" stroke="#7A4A26" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M56.6 33 L58.9 59" stroke="#C08A5A" strokeWidth=".7" strokeLinecap="round" />
    <path d="M58.9 60.6 L59.4 64.2" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /><path d="M58.9 60.6 L59.4 64.2" stroke="#C9CDD2" strokeWidth="1.9" strokeLinecap="round" />
    <path d="M53.4 24.6 Q53 19.6 56 18.6 Q59 19.6 58.6 24.6 Q58.2 27 56 27.4 Q53.8 27 53.4 24.6 Z" fill="#E3B53C" />
    <path d="M54.2 27.2 L57.8 27.2 L57.6 29.4 L54.4 29.4 Z" fill="#94700F" strokeWidth=".8" />
    <path d="M55 20.6 Q54.4 22.6 54.7 24.6" fill="none" stroke="#FBE7A1" strokeWidth="1" strokeLinecap="round" />
    <circle cx="57.6" cy="41" r="3" fill="#E8C766" />
  </g>,
  // шар «Инфляция» на нитке: то надувается, то сдувается — как цены
  balloon: <g stroke={INK} strokeLinejoin="round"><path d="M54.5 41 Q51 33 56 26 Q60 20 57 15.5" fill="none" strokeWidth=".9" /><circle cx="54.5" cy="42" r="3.2" fill="#E8C766" strokeWidth="1" /><g className="infla-balloon"><ellipse cx="57" cy="3.5" rx="9.5" ry="11" fill="#C8442F" strokeWidth="1.1" /><path d="M55.4 14.3 L57 16 L58.6 14.3 Z" fill="#A0372A" strokeWidth=".8" /><path d="M51 -2 Q52.5 -5.5 56 -6" fill="none" stroke="#FFD9CC" strokeWidth="1.8" strokeLinecap="round" /><text x="57" y="7.8" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="sans-serif" fill="#FFF3E6" stroke="none">%</text></g></g>,
  // рамки — кольцо вокруг монеты
  'frame-guilloche': <g fill="none"><circle cx="32" cy="25" r="28.5" stroke="#5A4E80" strokeWidth="1.2" /><circle cx="32" cy="25" r="26.6" stroke="#5A4E80" strokeWidth="1" strokeDasharray="1.6 1.4" /><circle cx="32" cy="25" r="30.4" stroke="#5A4E80" strokeWidth=".8" strokeDasharray="4 2 1 2" /></g>,
  'frame-gold': <g fill="none"><circle cx="32" cy="25" r="29.5" stroke="#B88A1A" strokeWidth="3.4" /><circle cx="32" cy="25" r="29.5" stroke="#FBE7A1" strokeWidth="1" strokeDasharray="2 3" /><circle cx="32" cy="25" r="27" stroke="#94700F" strokeWidth=".8" /></g>,
  'frame-diamond': <g><circle cx="32" cy="25" r="29.5" fill="none" stroke="#2E8FB8" strokeWidth="2.6" /><g className="infla-spin">{Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; const x = 32 + Math.cos(a) * 29.5; const y = 25 + Math.sin(a) * 29.5; return <path key={k} d={`M${x} ${y - 2.6} L${x + 2} ${y} L${x} ${y + 2.6} L${x - 2} ${y} Z`} fill="#BFE9F7" stroke="#1D6A8E" strokeWidth=".7" />; })}</g>{spark(32, -4.5, 0, 3)}{spark(61.5, 25, .8, 3)}{spark(2.5, 25, 1.6, 3)}</g>,
};
OUTFIT.goldbar = OUTFIT.balloon; // старое имя шара: наряд с ним рисуется до первого сохранения
export const OUTFIT_IDS = Object.keys(OUTFIT);
/* Наряд ученика для всех Инфль внутри обучения (урок, итоги, Путь, профиль): его задаёт корень
   обучения, а явный outfit (витрина лавки) — важнее. */
export const OutfitContext = React.createContext(null);
// высота рисунка с учётом головного убора — чтобы место под Инфлю оставляли заранее
export const mascotHeight = (size, outfit) => size * (70 - (outfit && outfit.head && OUTFIT[outfit.head] ? -12 : 0)) / 64;

export function Mascot({ mood = 'hello', size = 56, label, outfit = null }) {
  const ctxOutfit = React.useContext(OutfitContext);
  const m = MOUTH[mood] ? mood : 'hello';
  const gid = `infla-g-${React.useId().replace(/:/g, '')}`;
  const ink = '#2A1D05';
  const wear = outfit || ctxOutfit || {};
  // головной убор выше монеты — поле рисунка растёт вверх
  const top = wear.head && OUTFIT[wear.head] ? -12 : 0;
  const motion = m === 'joy' || m === 'party' ? 'infla-hop' : m === 'sleep' ? '' : m === 'wave' ? 'infla-sway' : 'infla-bob';
  return (
    <span style={{ display: 'inline-block', lineHeight: 0 }} data-testid="mascot" data-mood={m}>
      <style>{CSS}</style>
      <svg viewBox={`0 ${top} 64 ${70 - top}`} width={size} height={size * (70 - top) / 64} role="img" aria-label={label || `Инфля: ${({ hello: 'привет', wave: 'машет', joy: 'радуется', cheer: 'подбадривает', party: 'празднует', sleep: 'спит', think: 'думает' })[m]}`}
        className={`infla ${motion}`} key={m} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={gid} cx="36%" cy="28%" r="78%">
            <stop offset="0" stopColor="#FBE7A1" /><stop offset="0.5" stopColor="#D9B23A" /><stop offset="1" stopColor="#94700F" />
          </radialGradient>
        </defs>
        <path d="M32 50.2 C 28.8 53.6, 35.6 56.4, 31.8 60.4 C 30.6 61.6, 31.4 62.6, 32.6 63.4" fill="none" stroke="#D9B23A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M29.3 51.6 L32 47.6 L34.7 51.6 Q32 52.6 29.3 51.6 Z" fill="#A9841A" stroke="#3A2A08" strokeWidth="0.9" strokeLinejoin="round" />
        {wear.frame && OUTFIT[wear.frame] && <g data-outfit={wear.frame}>{OUTFIT[wear.frame]}</g>}
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
        {['neck', 'face', 'head', 'hand'].map((sl) => (wear[sl] && OUTFIT[wear[sl]] ? <g key={sl} data-outfit={wear[sl]}>{OUTFIT[wear[sl]]}</g> : null))}
        {m === 'sleep' && <text x="46" y="9" fontSize="9" fill="#9FB3C8" fontFamily="sans-serif">z z</text>}
        {m === 'think' && <><circle cx="52" cy="9" r="1.6" fill="#9FB3C8" /><circle cx="56.5" cy="4.5" r="2.4" fill="#9FB3C8" /></>}
        {m === 'cheer' && <path d="M52 30 l2 -4 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 z" fill="#FBE7A1" stroke="#94700F" strokeWidth="0.6" />}
      </svg>
    </span>
  );
}
