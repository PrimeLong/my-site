/* ХЕЛЛОУИН на экране (docs/mechanics.md, «Хеллоуин»; правила — src/learn/halloween.js):
   карточка события «13 тыкв» на Пути — ночное небо с луной и летучими мышами, корзина из 13 тыкв
   (каждый урок сезона зажигает одну), «Забрать „Паутину“», когда собраны все; тыква и летучая
   мышь — значки для карточки и для дороги Пути. Карточка ночная в обеих темах. */
import React, { useState } from 'react';
import { Button } from './ds.jsx';
import { Mascot } from './mascot.jsx';
import { Audio } from './MacroSimulator.jsx';
import { halloween, claimHalloween, seasonLeftText, WEB_FRAME } from './learn/halloween.js';
import { plural } from './lib/plural.js';

export const HALLOWEEN_CSS = `
  .hw-card { position: relative; overflow: hidden; border-radius: 22px; padding: 16px 16px 14px; margin: 0 0 14px; color: #FFF6E5;
    background: radial-gradient(120% 90% at 85% 0%, #5B4380 0%, #33264A 45%, #1E1729 100%); border: 2px solid #4A3A63; box-shadow: 0 4px 0 #15101D;
    animation: hw-in .45s ease-out both; }
  @keyframes hw-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
  .hw-sky { position: absolute; inset: 0; pointer-events: none; }
  .hw-moon { position: absolute; top: 10px; right: 16px; width: 42px; height: 42px; border-radius: 50%; background: radial-gradient(circle at 38% 38%, #FFF8DA, #F3D98A 70%); box-shadow: 0 0 24px 6px rgba(255, 228, 150, .25); }
  .hw-moon::after { content: ''; position: absolute; width: 9px; height: 9px; border-radius: 50%; left: 22px; top: 12px; background: rgba(176, 140, 60, .35); box-shadow: -10px 12px 0 -2px rgba(176, 140, 60, .3); }
  .hw-star { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #FFF6E5; animation: hw-twinkle 2.6s ease-in-out infinite; }
  @keyframes hw-twinkle { 0%, 100% { opacity: .25 } 50% { opacity: 1 } }
  .hw-bat { position: absolute; animation: hw-fly 9s linear infinite; }
  .hw-bat svg { animation: hw-flap .34s ease-in-out infinite alternate; transform-origin: 50% 60%; }
  @keyframes hw-fly { 0% { transform: translate(-40px, 30px) } 50% { transform: translate(var(--fx, 160px), -6px) } 100% { transform: translate(calc(var(--fx, 160px) * 2.2), 26px) } }
  @keyframes hw-flap { from { transform: scaleY(1) } to { transform: scaleY(.45) } }
  .hw-top { position: relative; display: flex; align-items: center; gap: 12px; padding-right: 50px; }
  .hw-eyebrow { font: 700 12px var(--ds-sans); letter-spacing: .1em; text-transform: uppercase; color: #FFC46B; }
  .hw-title { font: 700 19px/1.2 var(--ds-head); margin-top: 2px; }
  .hw-text { font-size: 14px; line-height: 1.4; color: #E4DAF2; margin-top: 4px; }
  .hw-basket { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px 4px; justify-items: center; margin: 14px 0 4px; }
  .hw-pumpkin { width: 34px; height: 32px; }
  .hw-pumpkin.lit { animation: hw-pop .5s cubic-bezier(.3,1.7,.5,1) both; animation-delay: calc(var(--i, 0) * 45ms); }
  .hw-pumpkin.last { animation: hw-pop .5s cubic-bezier(.3,1.7,.5,1) both, hw-wobble 2.4s ease-in-out 1s infinite; }
  @keyframes hw-pop { from { transform: scale(0) rotate(-20deg) } to { transform: none } }
  @keyframes hw-wobble { 0%, 100% { transform: rotate(0) } 10% { transform: rotate(-8deg) } 20% { transform: rotate(6deg) } 30% { transform: rotate(0) } }
  .hw-count { position: relative; display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; color: #E4DAF2; margin-top: 6px; }
  .hw-count b { color: #FFC46B; font: 700 16px var(--ds-head); }
  .hw-done { position: relative; display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: rgba(255, 246, 229, .1); font-size: 14.5px; line-height: 1.4; }
  .hw-claim { position: relative; margin-top: 12px; }
  .hw-claim .ds-btn { --u: #E8701E; --u-ink: #B4500F; }
  .hw-glow { animation: hw-glow 1.8s ease-in-out infinite; }
  @keyframes hw-glow { 0%, 100% { opacity: 1 } 40% { opacity: .7 } 60% { opacity: .92 } 80% { opacity: .75 } }
  /* дорога Пути в сезон: тыквы мерцают, летучие мыши машут крыльями */
  .ln-prop .hw-wing { transform-box: fill-box; transform-origin: 50% 100%; animation: hw-flap .3s ease-in-out infinite alternate; }
  @media (prefers-reduced-motion: reduce) { .hw-card, .hw-star, .hw-bat, .hw-bat svg, .hw-pumpkin, .hw-glow, .ln-prop .hw-wing { animation: none !important; } .hw-bat { display: none; } }
`;

// тыква: lit — с зажжённой рожицей, иначе пустое место в корзине
export function Pumpkin({ lit = true, size = 34, className = '', style }) {
  return (
    <svg viewBox="0 0 34 32" width={size} height={size * 32 / 34} className={`hw-pumpkin ${lit ? 'lit' : ''} ${className}`} style={style} aria-hidden="true">
      {lit ? (
        <g stroke="#3A1A05" strokeWidth="1" strokeLinejoin="round">
          <path d="M17 7 Q16 3.6 18.6 1.6" fill="none" stroke="#4D7C0F" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="17" cy="18.5" rx="14.5" ry="12" fill="#E8701E" />
          <path d="M17 6.6 Q10.6 18.5 17 30.4 M17 6.6 Q23.4 18.5 17 30.4 M7.4 9.8 Q3.8 18.5 7.4 27.2 M26.6 9.8 Q30.2 18.5 26.6 27.2" fill="none" stroke="#B4500F" strokeWidth=".9" />
          <g className="hw-glow" fill="#FFE07A" stroke="#7A3A08" strokeWidth=".6">
            <path d="M9.6 16.6 L12.6 12.2 L14.6 16.6 Z" /><path d="M19.4 16.6 L21.4 12.2 L24.4 16.6 Z" />
            <path d="M8.6 20.6 L11 22.6 L13.2 20.8 L17 23.2 L20.8 20.8 L23 22.6 L25.4 20.6 Q23 26.4 17 26.6 Q11 26.4 8.6 20.6 Z" />
          </g>
        </g>
      ) : (
        <g fill="none" stroke="#9C8DBA" strokeWidth="1.4" strokeDasharray="2.6 2.4">
          <ellipse cx="17" cy="18.5" rx="13.5" ry="11" />
          <path d="M17 7.4 Q16.4 4.4 18.4 3" strokeDasharray="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
// летучая мышь: крылья машут (hw-wing), для дороги и неба
export function Bat({ size = 26, color = '#1B1424' }) {
  return (
    <svg viewBox="0 0 26 14" width={size} height={size * 14 / 26} aria-hidden="true">
      <path fill={color} d="M13 4 Q11.6 2 12 0.6 L13 2 L14 0.6 Q14.4 2 13 4 Q15 4.6 15.4 7 Q18 2.6 25.4 3.4 Q22.4 5 22.6 8.6 Q20.4 7.2 18.6 9.2 Q17.6 7.6 15.4 9 Q14 11.6 13 13 Q12 11.6 10.6 9 Q8.4 7.6 7.4 9.2 Q5.6 7.2 3.4 8.6 Q3.6 5 0.6 3.4 Q8 2.6 10.6 7 Q11 4.6 13 4 Z" />
    </svg>
  );
}

const STARS = [[58, 6], [66, 16], [76, 4], [94, 30], [88, 8], [70, 28]];
/* Карточка события на Пути: в сезон — всегда; до сезона и после — не показывается. */
export function HalloweenCard({ learn, update, now = Date.now() }) {
  const h = halloween(learn, now);
  const [just, setJust] = useState(false);
  if (!h.on) return null;
  const claim = () => {
    const r = claimHalloween(learn, now);
    if (!r.ok) return;
    Audio.play('register');
    update(() => r.s, { settle: true });
    setJust(true);
  };
  const state = h.claimed ? 'claimed' : h.ready ? 'ready' : 'collect';
  return (
    <section className="hw-card" data-testid="halloween" data-state={state} data-pumpkins={h.pumpkins} aria-label={`Хеллоуин: тыкв ${h.pumpkins} из ${h.goal}`}>
      <div className="hw-sky" aria-hidden="true">
        <span className="hw-moon" />
        {STARS.map(([x, y], k) => <span key={k} className="hw-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${k * 0.37}s` }} />)}
        <span className="hw-bat" style={{ top: 18, left: 0, '--fx': '150px' }}><Bat size={24} color="#120D19" /></span>
        <span className="hw-bat" style={{ top: 46, left: 0, '--fx': '120px', animationDelay: '-4s', animationDuration: '11s' }}><Bat size={16} color="#120D19" /></span>
      </div>
      <div className="hw-top">
        <Mascot mood={h.claimed ? 'party' : 'joy'} size={58} outfit={{ head: 'witch', ...(h.claimed || h.ready ? { frame: WEB_FRAME } : {}) }} label="Инфля в шляпе ведьмы" />
        <div style={{ minWidth: 0 }}>
          <div className="hw-eyebrow">Хеллоуин · {seasonLeftText(h)}</div>
          <div className="hw-title">{h.claimed ? '«Паутина» ваша' : `${h.goal} тыкв — рамка «Паутина»`}</div>
          <div className="hw-text">{h.claimed ? 'Рамка — в гардеробе лавки. Хеллоуинская витрина открыта до 2 ноября.' : 'Каждый урок — тыква в корзину. Рамку не купить — только собрать.'}</div>
        </div>
      </div>
      {!h.claimed && (
        <>
          <div className="hw-basket" data-testid="halloween-basket" role="img" aria-label={`Собрано тыкв: ${h.pumpkins} из ${h.goal}`}>
            {Array.from({ length: h.goal }, (_, k) => <Pumpkin key={k} lit={k < h.pumpkins} className={k === h.pumpkins - 1 ? 'last' : ''} style={{ '--i': k }} />)}
          </div>
          <div className="hw-count"><span><b>{h.pumpkins}</b> из {h.goal}</span><span>{h.ready ? 'Корзина полна!' : `ещё ${h.goal - h.pumpkins} ${plural(h.goal - h.pumpkins, 'урок', 'урока', 'уроков')}`}</span></div>
          {h.ready && <div className="hw-claim"><Button wide data-testid="halloween-claim" onClick={claim}>Забрать «Паутину»</Button></div>}
        </>
      )}
      {h.claimed && just && <div className="hw-done" role="status" data-testid="halloween-claimed">Паучок уже качается на нитке — Инфля в новой рамке.</div>}
    </section>
  );
}
