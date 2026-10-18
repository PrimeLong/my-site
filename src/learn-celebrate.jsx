/* ЦЕРЕМОНИИ — сцена во весь экран на большой момент (docs/mechanics.md, «Церемонии»; что и когда
   показывать — src/learn/celebrate.js). Три постановки:
   - «Новая марка в альбоме» (юнит пройден) и «Марка месяца»: почтовая марка с перфорацией вылетает
     из глубины, гравюра здания (рисунок месяца) прорисовывается на ней линия за линией, сверху с
     ударом ложится почтовый штемпель с датой, и марка встаёт в своё окошко альбома. Марку можно
     наклонять мышью или пальцем — по ней бежит голографический блик.
   - «Новая печать»: на лист грамоты опускается латунная печать на деревянной ручке, удар — сургуч
     растекается и брызгает, печать поднимается — под ней тиснёный знак с блеском и искрами.
   Касание по сцене до конца постановки — сразу к финалу. «Уменьшить движение» — сразу финал.
   Отдельный ленивый чанк: грузится, только когда есть что праздновать. */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Award, Gift } from 'lucide-react';
import { Engraving, Medal, Stamp, CountUp, useReducedMotion } from './ds-art.jsx';
import { ACH_ICON, MONTH_ART, MONTH_ABBR } from './award-art.js';
import { albumItems, monthItems } from './learn/collections.js';
import { coinsWord } from './learn/rewards.js';
import { Audio } from './MacroSimulator.jsx';

// раскадровка, мс: когда что происходит в сцене марки и в сцене печати
const POST = { fly: 0, draw: 650, fill: 1900, mark: 2450, text: 2850, album: 3250, buttons: 3700 };
// печать: ручка опускается с 450 мс, удар — на середине её пути (1400), подъём — с 1700
const SEAL = { paper: 100, tool: 450, slam: 1400, lift: 1750, text: 2500, buttons: 3150 };

const CSS = `
  .cb { position: fixed; inset: 0; z-index: 450; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; overflow: hidden;
    padding: calc(20px + env(safe-area-inset-top)) 20px calc(22px + env(safe-area-inset-bottom)); color: #fff; text-align: center; outline: none;
    background: radial-gradient(120% 85% at 50% 36%, color-mix(in srgb, var(--cb) 62%, #0d0b09) 0%, color-mix(in srgb, var(--cb) 20%, #08070b) 52%, #050407 100%);
    animation: cb-in .5s ease-out backwards; font-family: var(--ds-sans); }
  @keyframes cb-in { from { opacity: 0 } }
  .cb-rays { position: absolute; left: 50%; top: 38%; width: 170vmax; height: 170vmax; margin: -85vmax 0 0 -85vmax; pointer-events: none;
    background: repeating-conic-gradient(from 0deg, rgba(255,255,255,.075) 0deg 5deg, transparent 5deg 15deg);
    -webkit-mask-image: radial-gradient(circle, #000 0, transparent 46%); mask-image: radial-gradient(circle, #000 0, transparent 46%);
    animation: cb-spin 60s linear infinite, cb-fade 1.4s ease-out .2s backwards; }
  @keyframes cb-spin { to { transform: rotate(360deg) } }
  @keyframes cb-fade { from { opacity: 0 } }
  .cb-glow { position: absolute; left: 50%; top: 38%; width: 520px; height: 520px; margin: -260px 0 0 -260px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, color-mix(in srgb, var(--cb) 55%, #fff) 0%, color-mix(in srgb, var(--cb) 40%, transparent) 30%, transparent 64%);
    opacity: .5; filter: blur(8px); animation: cb-breathe 3.6s ease-in-out infinite, cb-fade 1s ease-out backwards; }
  @keyframes cb-breathe { 50% { transform: scale(1.08); opacity: .62 } }
  /* зерно плёнки — чтобы тёмный фон не был плоским */
  .cb-grain { position: absolute; inset: -50%; pointer-events: none; opacity: .09; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: cb-grain .6s steps(3) infinite; }
  @keyframes cb-grain { 33% { transform: translate(-3%, 2%) } 66% { transform: translate(2%, -3%) } }

  .cb-stage { position: relative; display: grid; place-items: center; width: 300px; height: 300px; flex-shrink: 0; touch-action: none; }
  .cb-shaker { position: relative; flex-shrink: 0; }
  .cb-shake { animation: cb-shake .42s cubic-bezier(.36, .07, .19, .97) var(--at) both; }
  @keyframes cb-shake { 10%, 90% { transform: translate(-1px, 1px) } 20%, 80% { transform: translate(3px, -2px) } 30%, 50%, 70% { transform: translate(-5px, 3px) } 40%, 60% { transform: translate(5px, -1px) } }

  /* почтовая марка: перфорация — маской, наклон и блик — от указателя */
  .cb-fly { animation: cb-fly 1s cubic-bezier(.17, .89, .32, 1.2) backwards; }
  @keyframes cb-fly { from { opacity: 0; transform: translateY(46vh) rotateX(70deg) rotateZ(-18deg) scale(.5) } 60% { opacity: 1 } }
  .cb-float { animation: cb-float 6s ease-in-out 1.2s infinite; }
  @keyframes cb-float { 50% { transform: translateY(-6px) rotate(.6deg) } }
  .cb-tilt { transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) rotate(-3deg); transition: transform .25s ease-out; filter: drop-shadow(0 26px 30px rgba(0,0,0,.45)); }
  .cb-post { position: relative; width: 206px; padding: 9px; background: #FFFBF1; color: #2A221C;
    -webkit-mask: linear-gradient(#000 0 0) content-box, radial-gradient(circle 5px, #0000 96%, #000) -9px -9px / 18px 18px round;
    mask: linear-gradient(#000 0 0) content-box, radial-gradient(circle 5px, #0000 96%, #000) -9px -9px / 18px 18px round; }
  .cb-post-in { position: relative; border: 2px solid var(--cb); padding: 8px 10px 10px; overflow: hidden;
    background: repeating-radial-gradient(circle at 50% 118%, color-mix(in srgb, var(--cb) 10%, transparent) 0 1px, transparent 1px 7px), #FFFBF1; }
  .cb-post-top { display: flex; justify-content: space-between; align-items: baseline; font: 700 11px var(--ds-head); letter-spacing: .14em; color: var(--cb); }
  .cb-post-top b { font: 700 20px var(--ds-mono); letter-spacing: 0; }
  .cb-post-art { display: grid; place-items: center; height: 136px; color: var(--cb); }
  .cb-post-cap { font: 700 15px/1.15 var(--ds-head); letter-spacing: .1em; text-transform: uppercase; color: var(--cb); border-top: 1.5px solid var(--cb); padding-top: 7px; }
  .cb-holo { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: soft-light; opacity: .9;
    background: linear-gradient(115deg, transparent 22%, rgba(255,255,255,.85) 38%, rgba(255,190,235,.6) 44%, rgba(160,225,255,.6) 50%, rgba(255,245,170,.55) 56%, transparent 70%);
    background-size: 260% 260%; background-position: var(--mx, 40%) var(--my, 40%); transition: background-position .25s ease-out; }
  .cb-holo-in { animation: cb-sweep 1.4s ease-in-out var(--at) backwards; }
  @keyframes cb-sweep { from { background-position: 100% 100% } to { background-position: 40% 40% } }
  /* почтовый штемпель: круг с датой и волны гашения — ложится с ударом */
  .cb-mark { position: absolute; right: -86px; top: 26px; display: flex; align-items: center; color: rgba(28, 22, 40, .82); mix-blend-mode: multiply; pointer-events: none;
    animation: cb-mark .38s cubic-bezier(.2, 1.4, .4, 1) var(--at) backwards; transform: rotate(-14deg); }
  @keyframes cb-mark { from { opacity: 0; transform: scale(2.3) rotate(-34deg) } 55% { opacity: 1 } }
  .cb-waves { margin-left: -6px; }

  /* лента альбома: окошки соседних марок, новая встаёт в своё */
  .cb-strip { display: flex; gap: 8px; justify-content: center; margin-top: 18px; animation: cb-rise .5s ease-out var(--at) backwards; }
  .cb-slot { width: 36px; height: 42px; border-radius: 4px; border: 1.5px dashed rgba(255,255,255,.35); display: grid; place-items: center; overflow: hidden; color: rgba(255,255,255,.4); }
  .cb-slot svg { display: block; }
  .cb-slot.got, .cb-slot.new { border: none; background: #FFFBF1; color: var(--c); box-shadow: inset 0 0 0 2px var(--c); }
  .cb-slot.new { box-shadow: inset 0 0 0 2px var(--c), 0 0 0 2px #fff, 0 0 24px 6px color-mix(in srgb, var(--cb) 70%, #fff);
    animation: cb-slot .6s cubic-bezier(.2, 1.6, .4, 1) calc(var(--at) + .25s) backwards; }
  @keyframes cb-slot { from { transform: translateY(-60px) scale(1.8) rotate(-12deg); opacity: 0 } }

  /* сцена печати: лист грамоты, латунная печать на ручке, сургуч и брызги, тиснёный знак */
  .cb-paper { position: absolute; width: 236px; height: 236px; border-radius: 14px; background: #FFFBF1;
    box-shadow: 0 30px 50px -20px rgba(0,0,0,.6), inset 0 0 0 10px #FFFBF1, inset 0 0 0 11.5px color-mix(in srgb, var(--cb) 55%, #fff), inset 0 0 0 15px #FFFBF1, inset 0 0 0 16px color-mix(in srgb, var(--cb) 35%, #fff);
    background-image: repeating-radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--cb) 7%, transparent) 0 1px, transparent 1px 9px);
    animation: cb-paper .7s cubic-bezier(.2, .9, .3, 1.1) var(--at) backwards; }
  @keyframes cb-paper { from { opacity: 0; transform: translateY(80px) rotate(4deg) scale(.9) } }
  .cb-tool { position: absolute; left: 50%; top: 50%; width: 120px; margin: -168px 0 0 -60px; pointer-events: none; z-index: 3;
    animation: cb-tool 1.9s cubic-bezier(.5, 0, .5, 1) var(--at) both; }
  @keyframes cb-tool {
    0% { opacity: 0; transform: translateY(-140px) rotate(-6deg) }
    25% { opacity: 1; transform: translateY(-60px) rotate(3deg) }
    42% { transform: translateY(-74px) rotate(-1deg) }
    50% { transform: translateY(0) rotate(0) scaleY(1); animation-timing-function: ease-out }
    55% { transform: translateY(4px) scaleY(.94) }
    66% { transform: translateY(0) scaleY(1); opacity: 1 }
    100% { opacity: 0; transform: translateY(-220px) rotate(12deg) }
  }
  .cb-tool-shadow { position: absolute; left: 50%; top: 50%; width: 110px; height: 26px; margin: -13px 0 0 -55px; border-radius: 50%; background: rgba(0,0,0,.35); filter: blur(6px); z-index: 2;
    animation: cb-tool-sh 1.9s cubic-bezier(.5, 0, .5, 1) var(--at) both; }
  @keyframes cb-tool-sh { 0% { opacity: 0; transform: scale(.4) } 50% { opacity: .9; transform: scale(1) } 66% { opacity: .9 } 100% { opacity: 0; transform: scale(.3) } }
  .cb-wax { position: absolute; z-index: 1; animation: cb-wax .7s cubic-bezier(.2, 1.7, .4, 1) var(--at) backwards; }
  @keyframes cb-wax { from { transform: scale(.15); opacity: 0 } 20% { opacity: 1 } }
  .cb-drop { position: absolute; left: 50%; top: 50%; width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2); border-radius: 50%; background: var(--cb);
    animation: cb-drop .7s cubic-bezier(.15, .7, .3, 1) var(--at) backwards; transform: translate(var(--x), var(--y)); }
  @keyframes cb-drop { from { transform: translate(0, 0) scale(.3); opacity: 0 } 20% { opacity: 1 } }
  .cb-medal { position: absolute; z-index: 2; animation: cb-medal .6s cubic-bezier(.2, 1.5, .4, 1) var(--at) backwards; }
  @keyframes cb-medal { from { opacity: 0; transform: scale(.82); filter: brightness(1.6) } }
  .cb-shine { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; overflow: hidden; -webkit-mask: radial-gradient(circle, #000 64%, transparent 66%); mask: radial-gradient(circle, #000 64%, transparent 66%); }
  .cb-shine::after { content: ''; position: absolute; inset: -20%; background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.75) 50%, transparent 60%);
    transform: translateX(-120%); animation: cb-shine 1.1s ease-in-out var(--at) both; }
  @keyframes cb-shine { to { transform: translateX(120%) } }
  .cb-spark { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; color: #FFE7A3; z-index: 4;
    animation: cb-spark .9s ease-out var(--at) both; transform: translate(var(--x), var(--y)) scale(0); }
  @keyframes cb-spark { 0% { transform: translate(0, 0) scale(0) rotate(0) } 40% { transform: translate(var(--x), var(--y)) scale(1.1) rotate(45deg) } 100% { transform: translate(var(--x), var(--y)) scale(0) rotate(90deg) } }

  /* текст: строка-подпись, имя награды по буквам, пояснение, монеты */
  .cb-text { position: relative; margin-top: 8px; max-width: 420px; }
  .cb-eyebrow { font: 700 12.5px var(--ds-sans); letter-spacing: .26em; text-transform: uppercase; color: color-mix(in srgb, var(--cb) 30%, #fff); opacity: .9;
    animation: cb-rise .5s ease-out var(--at) backwards; }
  .cb-title { font: 800 36px/1.08 var(--ds-head); margin: 8px 0 6px; letter-spacing: -.01em; text-shadow: 0 4px 24px rgba(0,0,0,.4); }
  .cb-title span { display: inline-block; white-space: pre; animation: cb-letter .55s cubic-bezier(.2, 1.4, .4, 1) calc(var(--at) + var(--i) * 32ms) backwards; }
  @keyframes cb-letter { from { opacity: 0; transform: translateY(18px) rotate(6deg) scale(.8); filter: blur(4px) } }
  .cb-sub { font: 16px/1.45 var(--ds-sans); color: rgba(255,255,255,.82); animation: cb-rise .5s ease-out calc(var(--at) + .25s) backwards; }
  @keyframes cb-rise { from { opacity: 0; transform: translateY(12px) } }
  .cb-coins { display: inline-flex; align-items: center; gap: 8px; margin-top: 14px; padding: 7px 16px 7px 8px; border-radius: 999px; font: 700 17px var(--ds-mono);
    background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    animation: cb-pop .5s cubic-bezier(.2, 1.6, .4, 1) calc(var(--at) + .45s) backwards; }
  .cb-coins i { width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #F7DC8A, #C9971F 60%, #8E6612); box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); }
  @keyframes cb-pop { from { opacity: 0; transform: scale(.4) } }
  .cb-hint { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; font: 600 14px var(--ds-sans); color: rgba(255,255,255,.75); animation: cb-rise .5s ease-out calc(var(--at) + .45s) backwards; }
  .cb-btns { position: relative; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 24px; animation: cb-rise .5s ease-out var(--at) backwards; }
  .cb-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 26px; border: none; border-radius: 999px; cursor: pointer;
    font: 700 16px var(--ds-head); letter-spacing: .03em; color: #1B1612; background: #fff; box-shadow: 0 10px 30px -10px rgba(0,0,0,.6); transition: transform .15s, box-shadow .2s; }
  .cb-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -12px rgba(0,0,0,.7); }
  .cb-btn:active { transform: scale(.96); }
  .cb-btn.ghost { color: #fff; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); }
  .cb-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--cb) 40%, #fff); outline-offset: 3px; }

  /* конфетти: бумажки, кружки и крошечные марки с зубцами */
  .cb-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; perspective: 700px; }
  .cb-confetti i { position: absolute; top: -24px; left: var(--x); width: var(--w); height: var(--h); background: var(--c); border-radius: var(--r);
    animation: cb-fall var(--t) cubic-bezier(.25, .6, .45, 1) var(--d) backwards; opacity: 0; }
  .cb-confetti i.stamp { background: #FFFBF1; box-shadow: inset 0 0 0 2px var(--c); outline: 2px dotted #FFFBF1; outline-offset: -1px; }
  @keyframes cb-fall { 0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) rotateY(0) } 85% { opacity: 1 }
    100% { opacity: 0; transform: translate3d(var(--dx), 108vh, 0) rotate(var(--rot)) rotateY(900deg) } }
  /* на ПК сцена крупнее: на большом экране марка и печать терялись */
  .cb-body { position: relative; display: flex; flex-direction: column; align-items: center; }
  @media (min-width: 900px) and (min-height: 760px) { .cb-body { zoom: 1.3; } }
  @media (min-width: 1300px) and (min-height: 900px) { .cb-body { zoom: 1.45; } }
  @media (max-height: 700px) { .cb-stage { transform: scale(.8); margin: -30px 0; } .cb-title { font-size: 30px; } .cb-btns { margin-top: 16px; } }
  @media (prefers-reduced-motion: reduce) { .cb *, .cb { animation: none !important; transition: none !important; } .cb-confetti, .cb-tool, .cb-tool-shadow { display: none; } }
`;

// предсказуемый «случай» — у одной и той же награды один и тот же рисунок конфетти
function seeded(seed) { let x = seed % 233280 || 7; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
const hashOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);

function Confetti({ seed, at, n = 40 }) {
  const bits = useMemo(() => {
    const rnd = seeded(seed);
    const colors = ['var(--cb)', '#E3B23C', '#FFFBF1', 'color-mix(in srgb, var(--cb) 50%, #fff)'];
    return Array.from({ length: n }, (_, i) => {
      const kind = rnd() < 0.22 ? 'stamp' : rnd() < 0.3 ? 'dot' : 'bit';
      const w = kind === 'stamp' ? 12 : kind === 'dot' ? 8 : 6 + rnd() * 6;
      return { i, kind, x: `${Math.round(rnd() * 100)}%`, w, h: kind === 'bit' ? 10 + rnd() * 8 : w, c: colors[Math.floor(rnd() * colors.length)],
        r: kind === 'dot' ? '50%' : '2px', t: `${(2.2 + rnd() * 1.6).toFixed(2)}s`, d: `${(at / 1000 + rnd() * 0.9).toFixed(2)}s`,
        dx: `${Math.round((rnd() - 0.5) * 220)}px`, rot: `${Math.round((rnd() - 0.5) * 900)}deg` };
    });
  }, [seed, at, n]);
  return (
    <div className="cb-confetti" aria-hidden="true">
      {bits.map((b) => <i key={b.i} className={b.kind === 'stamp' ? 'stamp' : undefined}
        style={{ '--x': b.x, '--w': `${b.w}px`, '--h': `${b.h}px`, '--c': b.c, '--r': b.r, '--t': b.t, '--d': b.d, '--dx': b.dx, '--rot': b.rot }} />)}
    </div>
  );
}
// имя награды по буквам: буквы выпрыгивают по очереди
const Letters = ({ text, at }) => (
  <div className="cb-title" style={{ '--at': `${at}ms` }} aria-label={text}>
    {[...text].map((ch, i) => <span key={i} aria-hidden="true" style={{ '--i': i }}>{ch}</span>)}
  </div>
);
const dateOf = (t) => { const d = new Date(t || Date.now()); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };

/* Гравюра прорисовывается: каждая линия рисунка проводится по своей длине, по очереди; заливки
   (окна, крыши, флаг) проступают следом. Работает с любым SVG внутри — здание или значок месяца. */
function useDrawing(ref, at, fillAt, off) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || off || !root.animate) return undefined;
    const els = [...root.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse')];
    const anims = [];
    els.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const k = els.length > 1 ? i / (els.length - 1) : 0;
      if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && el.getTotalLength) {
        let len = 0;
        try { len = el.getTotalLength(); } catch { len = 0; }
        if (len > 0) anims.push(el.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }], { duration: 700, delay: at + k * 1100, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'backwards' }));
      }
      if (cs.fill !== 'none' && cs.fillOpacity !== '0') anims.push(el.animate([{ fillOpacity: 0 }, { fillOpacity: Number(cs.fillOpacity) || 1 }], { duration: 500, delay: fillAt + k * 450, fill: 'backwards' }));
    });
    return () => anims.forEach((a) => a.cancel());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
// наклон марки за указателем: поворот и голографический блик
function useTilt() {
  const [v, setV] = useState(null);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setV({ '--rx': `${((0.5 - y) * 16).toFixed(1)}deg`, '--ry': `${((x - 0.5) * 20).toFixed(1)}deg`, '--mx': `${Math.round(x * 100)}%`, '--my': `${Math.round(y * 100)}%` });
  };
  return { style: v || undefined, onPointerMove: move, onPointerLeave: () => setV(null) };
}

/* Почтовая марка: перфорация, рамка цвета, номер, рисунок, подпись; штемпель с датой. */
function PostCard({ no, art, caption, date, reduced }) {
  const artRef = useRef(null);
  useDrawing(artRef, POST.draw, POST.fill, reduced);
  const tilt = useTilt();
  return (
    <div className="cb-fly"><div className="cb-float">
      <div className="cb-tilt" {...tilt} data-testid="celebrate-stamp">
        <div className="cb-post">
          <div className="cb-post-in">
            <div className="cb-post-top"><b>{no}</b></div>
            <div className="cb-post-art" ref={artRef}>{art}</div>
            <div className="cb-post-cap">{caption}</div>
            <div className="cb-holo cb-holo-in" style={{ '--at': `${POST.mark + 300}ms` }} />
          </div>
        </div>
        <div className="cb-mark" style={{ '--at': `${POST.mark}ms` }} aria-hidden="true">
          <Stamp text="ПОЧТА ИНФЛЯЦИИ" center={date} color="currentColor" size={92} rotate={0} />
          <svg className="cb-waves" width="78" height="56" viewBox="0 0 78 56" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            {[10, 20, 30, 40].map((y) => <path key={y} d={`M2 ${y} q9 -7 18 0 t18 0 t18 0 t18 0`} />)}
          </svg>
        </div>
      </div>
    </div></div>
  );
}

function Scene({ tone, label, seed, confettiAt, stage, shakeAt, eyebrow, title, textAt, sub, extra, buttonsAt, primary, secondary, onDone, onGo, testid }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  // фокус — на сцене: Enter — «Дальше», Esc — закрыть
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  // касание до конца постановки — сразу финал (бесконечные движения — блик, лучи — остаются)
  const skip = (e) => {
    if (e.target.closest('button')) return;
    const root = ref.current;
    if (!root || !root.getAnimations) return;
    root.getAnimations({ subtree: true }).forEach((a) => { try { if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish(); } catch { /* уже кончилась */ } });
  };
  return (
    <div className="cb" ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ '--cb': tone }} data-testid={testid}
      onClick={skip} onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && e.target === ref.current)) { e.preventDefault(); onDone(); } }}>
      <style>{CSS}</style>
      <div className="cb-glow" aria-hidden="true" />
      <div className="cb-rays" aria-hidden="true" />
      <div className="cb-grain" aria-hidden="true" />
      {!reduced && <Confetti seed={seed} at={confettiAt} />}
      <div className="cb-body">
      <div className={`cb-shaker ${shakeAt != null ? 'cb-shake' : ''}`} style={{ '--at': `${shakeAt || 0}ms` }}><div className="cb-stage">{stage}</div></div>
      <div className="cb-text">
        <div className="cb-eyebrow" style={{ '--at': `${textAt}ms` }}>{eyebrow}</div>
        <Letters text={title} at={textAt + 120} />
        <div className="cb-sub" style={{ '--at': `${textAt + 120}ms` }}>{sub}</div>
        <div style={{ '--at': `${textAt + 120}ms` }}>{extra}</div>
      </div>
      <div className="cb-btns" style={{ '--at': `${buttonsAt}ms` }}>
        {secondary && <button type="button" className="cb-btn ghost" data-testid="celebrate-go" onClick={() => { Audio.play('tab'); onGo(); }}>{secondary}</button>}
        <button type="button" className="cb-btn" data-testid="celebrate-done" onClick={() => { Audio.play('paper'); onDone(); }}>{primary}<ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      </div>
    </div>
  );
}
// монеты считаются, когда плашка уже видна
function Coins({ n, at }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), at); return () => clearTimeout(t); }, [at]);
  if (!n) return null;
  return <div className="cb-coins" data-testid="celebrate-coins" data-value={n}><i aria-hidden="true" /><span>+{go ? <CountUp value={n} duration={1100} /> : 0} {coinsWord(n)}</span></div>;
}
// звуки сцены — по раскадровке
function useCues(cues) {
  useEffect(() => {
    const ts = cues.map(([t, s]) => setTimeout(() => Audio.play(s), t));
    return () => ts.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/* Окошки альбома вокруг новой марки: полученные — с рисунком, пустые — пунктиром; новая влетает в своё. */
function Strip({ items, idx, at, mini }) {
  const from = Math.max(0, Math.min(idx - 3, items.length - 7));
  const win = items.slice(from, from + 7);
  return (
    <div className="cb-strip" style={{ '--at': `${at}ms` }} aria-hidden="true">
      {win.map((x, k) => {
        const on = from + k === idx || x.got;
        return <span key={x.id} className={`cb-slot ${from + k === idx ? 'new' : x.got ? 'got' : ''}`} style={{ '--c': x.color || 'var(--cb)' }}>{on ? mini(x) : null}</span>;
      })}
    </div>
  );
}

function AlbumScene({ m, learn, onDone, onGo }) {
  const reduced = useReducedMotion();
  const it = m.it;
  const items = useMemo(() => albumItems(learn), [learn]);
  const idx = Math.max(0, items.findIndex((x) => x.id === it.id));
  useCues([[POST.mark, 'stamp'], [POST.album + 250, 'coin']]);
  return (
    <Scene tone={it.color} label={`Новая марка в альбоме: ${it.title}`} seed={hashOf(m.key)} confettiAt={POST.mark} shakeAt={POST.mark} testid="celebrate" onDone={onDone} onGo={onGo}
      stage={<PostCard no={it.no} caption={it.title} date={dateOf(m.at)} reduced={reduced}
        art={<Engraving kind={it.building} alive size={168} color={it.color} label={it.title} />} />}
      eyebrow="Новая марка в альбоме" title={it.title} textAt={POST.text}
      sub={`Юнит ${it.no} «${it.sub}» пройден`}
      extra={<><Strip items={items} idx={idx} at={POST.album} mini={(x) => <Engraving kind={x.building} alive size={32} color={x.color} label={x.title} />} /><div className="cb-hint"><Gift size={17} aria-hidden="true" />Сундук юнита ждёт вас на Пути</div></>}
      buttonsAt={POST.buttons} primary="Дальше" secondary="Открыть альбом" />
  );
}

function MonthScene({ m, learn, onDone, onGo }) {
  const reduced = useReducedMotion();
  const it = m.it;
  const [Icon, color] = MONTH_ART[it.month - 1];
  const items = useMemo(() => monthItems(learn).map((x) => ({ ...x, color: MONTH_ART[x.month - 1][1] })), [learn]);
  const idx = Math.max(0, items.findIndex((x) => x.id === it.id));
  useCues([[POST.mark, 'stamp'], [POST.text + 600, 'coin']]);
  return (
    <Scene tone={color} label={`Марка месяца: ${it.title} ${it.year}`} seed={hashOf(m.key)} confettiAt={POST.mark} shakeAt={POST.mark} testid="celebrate" onDone={onDone} onGo={onGo}
      stage={<PostCard no={MONTH_ABBR[it.month - 1]} caption={`${it.title} ${it.year}`} date={dateOf(m.at)} reduced={reduced}
        art={<Icon size={104} strokeWidth={1.6} aria-hidden="true" />} />}
      eyebrow="Марка месяца" title={`${it.title} ${it.year}`} textAt={POST.text}
      sub="Испытание месяца выполнено — марка месяца в альбоме"
      extra={<><Coins n={it.coins} at={POST.text + 570} /><Strip items={items} idx={idx} at={POST.album} mini={(x) => { const I = MONTH_ART[x.month - 1][0]; return <I size={20} strokeWidth={2} />; }} /></>}
      buttonsAt={POST.buttons} primary="Дальше" secondary="Открыть альбом" />
  );
}

/* Латунная печать на деревянной ручке — рисунок для сцены печати. */
const Tool = () => (
  <svg viewBox="0 0 120 190" width="120" height="190" aria-hidden="true">
    <defs>
      <radialGradient id="cbWood" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#C98B55" /><stop offset=".55" stopColor="#8A4F25" /><stop offset="1" stopColor="#4A2610" /></radialGradient>
      <linearGradient id="cbBrass" x1="0" x2="1"><stop offset="0" stopColor="#7A5612" /><stop offset=".3" stopColor="#F4D47C" /><stop offset=".55" stopColor="#C9971F" /><stop offset="1" stopColor="#6B4A0E" /></linearGradient>
      <linearGradient id="cbNeck" x1="0" x2="1"><stop offset="0" stopColor="#5A3216" /><stop offset=".4" stopColor="#A86A38" /><stop offset="1" stopColor="#4A2610" /></linearGradient>
    </defs>
    <ellipse cx="60" cy="34" rx="30" ry="30" fill="url(#cbWood)" />
    <ellipse cx="50" cy="22" rx="10" ry="6" fill="#fff" opacity=".25" transform="rotate(-25 50 22)" />
    <path d="M47 58 Q60 66 73 58 L70 112 Q60 118 50 112 Z" fill="url(#cbNeck)" />
    <rect x="34" y="110" width="52" height="14" rx="4" fill="url(#cbBrass)" />
    <path d="M26 124 h68 l6 44 a6 6 0 0 1 -6 6 h-68 a6 6 0 0 1 -6 -6 z" fill="url(#cbBrass)" />
    <rect x="22" y="168" width="76" height="10" rx="3" fill="#2A1A0C" />
    <path d="M32 132 h10 l-3 34 h-9 z" fill="#fff" opacity=".22" />
  </svg>
);
// сургуч: неровная клякса с волнистым краем
const WAX = (() => {
  const pts = [];
  for (let k = 0; k < 120; k += 1) {
    const a = (k / 120) * Math.PI * 2;
    const r = 47 + 3.2 * Math.sin(a * 5) + 2.4 * Math.cos(a * 9 + 1) + 1.6 * Math.sin(a * 17);
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
})();
const DROPS = [[-118, -40, 12], [112, -58, 9], [-96, 72, 8], [124, 46, 13], [-30, -124, 7], [40, 118, 10], [-138, 8, 6], [86, 102, 7]];
const SPARKS = [[-104, -96], [108, -86], [-122, 30], [120, 18], [-60, 118], [72, 112], [0, -138]];
const Star4 = () => <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="currentColor" /></svg>;

function SealScene({ m, onDone, onGo }) {
  const it = m.it;
  const Icon = ACH_ICON[it.icon] || Award;
  useCues([[SEAL.slam, 'stamp'], [SEAL.text + 500, 'coin']]);
  return (
    <Scene tone="var(--u)" label={`Новая печать: ${it.title}`} seed={hashOf(m.key)} confettiAt={SEAL.slam} shakeAt={SEAL.slam} testid="celebrate" onDone={onDone} onGo={onGo}
      stage={(
        <>
          <div className="cb-paper" style={{ '--at': `${SEAL.paper}ms` }} />
          {DROPS.map(([x, y, s], k) => <span key={k} className="cb-drop" style={{ '--x': `${x}px`, '--y': `${y}px`, '--s': `${s}px`, '--at': `${SEAL.slam + k * 15}ms` }} aria-hidden="true" />)}
          <svg className="cb-wax" viewBox="0 0 120 120" width="196" height="196" style={{ '--at': `${SEAL.slam}ms` }} aria-hidden="true">
            <path d={WAX} fill="var(--u)" /><path d={WAX} fill="#000" opacity=".18" transform="translate(2 3)" style={{ mixBlendMode: 'multiply' }} /><path d={WAX} fill="var(--u)" transform="scale(.97) translate(1.8 1.8)" />
          </svg>
          <div className="cb-medal" style={{ '--at': `${SEAL.slam + 40}ms` }} data-testid="celebrate-seal">
            <Medal icon={<Icon size={24} strokeWidth={2.2} />} got color="color-mix(in srgb, var(--u) 88%, #000)" size={150} label={it.title} />
            <span className="cb-shine" style={{ '--at': `${SEAL.lift + 350}ms` }} aria-hidden="true" />
          </div>
          {SPARKS.map(([x, y], k) => <span key={k} className="cb-spark" style={{ '--x': `${x}px`, '--y': `${y}px`, '--at': `${SEAL.lift + 250 + k * 70}ms` }} aria-hidden="true"><Star4 /></span>)}
          <span className="cb-tool-shadow" style={{ '--at': `${SEAL.tool}ms` }} aria-hidden="true" />
          <div className="cb-tool" style={{ '--at': `${SEAL.tool}ms` }} aria-hidden="true"><Tool /></div>
        </>
      )}
      eyebrow="Новая печать" title={it.title} textAt={SEAL.text} sub={it.text}
      extra={<Coins n={it.coins} at={SEAL.text + 570} />}
      buttonsAt={SEAL.buttons} primary="Дальше" secondary="Все печати" />
  );
}

export default function Celebration({ moment, learn, onDone, onGo }) {
  if (moment.kind === 'seal') return <SealScene key={moment.key} m={moment} onDone={onDone} onGo={onGo} />;
  if (moment.kind === 'month') return <MonthScene key={moment.key} m={moment} learn={learn} onDone={onDone} onGo={onGo} />;
  return <AlbumScene key={moment.key} m={moment} learn={learn} onDone={onDone} onGo={onGo} />;
}
