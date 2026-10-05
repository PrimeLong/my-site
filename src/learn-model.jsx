/* ЖИВАЯ МОДЕЛЬ И «ОТКРОЙ САМ»: улица у метро «Торговая» с кофейнями и прохожими, день в
   «Зерне» (ученик ставит цену — точки на графике складываются в кривую спроса) и модель рынка
   капучино, которая собирается по ходу юнита. Логика — src/learn/model.js.
   Подача — как у всего обучения: бумага, тушь, гравюра, PT Serif; фигурки — тушью, без
   мультяшности. Движение короткое (около полутора секунд) и не мешает читать; при «уменьшить
   движение» — без анимации, только смена состояний. */
import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RotateCcw, Newspaper } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Inline } from './textbook.jsx';
import { Mascot } from './mascot.jsx';
import { useReducedMotion, Stamp } from './ds-art.jsx';
import { Button } from './ds.jsx';
import { plural } from './lib/plural.js';
import {
  DAY, dayResult, distinctPrices, lineShown, discoverDone, fitDemand,
  MODEL_AXES, MODEL_NEWS, MODEL_DEFAULT, modelParts, modelProgress, modelReadout, mqd, mqs, BASE,
} from './learn/model.js';

export const MODEL_CSS = `
  .lm-street { width: 100%; display: block; margin: 4px 0 8px; border: 1px solid var(--ds-rule2); border-radius: 4px; background: var(--ds-card); }
  .lm-street text { font-family: var(--ds-serif); }
  .lm-chart { width: 100%; max-width: 380px; display: block; margin: 4px auto 6px; }
  .lm-chart text { font: 700 12px var(--ds-mono); fill: var(--ds-ink2); }
  .lm-chart .lm-ax { font: 600 12px var(--ds-sans); fill: var(--ds-ink3); }
  .lm-range { width: 100%; accent-color: var(--u); height: 30px; }
  .lm-read { font-size: 15px; text-align: center; min-height: 22px; margin: 2px 0 6px; }
  .lm-read b { font-family: var(--ds-mono); }
  .lm-days { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; font: 12.5px var(--ds-mono); color: var(--ds-ink2); margin: 2px 0 6px; }
  .lm-say { display: flex; gap: 10px; align-items: center; border: 1px solid var(--u); border-radius: 6px; background: color-mix(in srgb, var(--u) 7%, var(--ds-card)); padding: 10px 12px; margin: 8px 0; font-size: 15.5px; line-height: 1.4; }
  .lm-line { stroke-dasharray: 420; stroke-dashoffset: 420; animation: lm-draw 1.1s ease-out forwards; }
  @keyframes lm-draw { to { stroke-dashoffset: 0; } }
  .lm-parts { display: grid; gap: 8px; margin-top: 8px; }
  .lm-part { border: 1px solid var(--ds-rule2); border-radius: 5px; padding: 8px 10px; background: var(--ds-card); }
  .lm-part.locked { border-style: dashed; background: none; color: var(--ds-ink3); }
  .lm-part-head { display: flex; align-items: baseline; gap: 8px; font: 700 14.5px var(--ds-serif); }
  .lm-part-text { font-size: 13.5px; line-height: 1.35; color: var(--ds-ink2); margin-top: 2px; }
  .lm-part.locked .lm-part-text { color: var(--ds-ink3); }
  .lm-scale { display: flex; justify-content: space-between; font-size: 12px; color: var(--ds-ink3); margin-top: -4px; }
  .lm-pips { display: inline-flex; gap: 3px; vertical-align: middle; }
  .lm-pips i { width: 9px; height: 9px; border-radius: 2px; border: 1.5px solid var(--u); }
  .lm-pips i.on { background: var(--u); }
  .lm-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; margin: 4px 0; }
  .lm-board div { border: 1px solid var(--ds-rule2); border-radius: 3px; padding: 4px 2px; background: var(--ds-card2); }
  .lm-board b { display: block; font: 700 17px var(--ds-mono); color: var(--u-ink); }
  .lm-board span { font-size: 12px; color: var(--ds-ink3); }
  @media (prefers-reduced-motion: reduce) { .lm-line { animation: none !important; stroke-dashoffset: 0 !important; } }
`;

/* ------------------------------ УЛИЦА ------------------------------
   Улица у «Торговой»: вход в метро, «Зерно» посередине и две соседние кофейни (на рынке их
   несколько — без имён, у библии мира их нет). queue — сколько фигурок стоит у дверей «Зерна»,
   short — из них не досталось (дефицит), walkers — прохожие идут мимо; t — ход дня от 0 до 1. */
const SW = 320; const SH = 124; const GROUND = 104; const DOOR = 166;
const hashN = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
function Figure({ x, y = GROUND, k, tone = 'var(--ds-ink2)', fill = 'var(--ds-card)', opacity = 1 }) {
  const h = 15 + hashN(k) * 4; const hat = hashN(k + 7) > 0.66; const coat = hashN(k + 3) > 0.5;
  return (
    <g transform={`translate(${x.toFixed(1)},${y})`} opacity={opacity} stroke={tone} fill={fill} strokeWidth="1.1" strokeLinejoin="round">
      <line x1="-1.6" y1="0" x2="-1.2" y2={-h * 0.38} /><line x1="1.6" y1="0" x2="1.2" y2={-h * 0.38} />
      <path d={coat ? `M-4,${-h * 0.32} L-3,${-h * 0.82} L3,${-h * 0.82} L4,${-h * 0.32} Z` : `M-3,${-h * 0.36} L-3,${-h * 0.82} L3,${-h * 0.82} L3,${-h * 0.36} Z`} />
      <circle cx="0" cy={-h - 1.5} r="3" />
      {hat && <path d={`M-3.6,${-h - 2.6} L3.6,${-h - 2.6} M-2.2,${-h - 2.6} L-1.8,${-h - 5.6} L1.8,${-h - 5.6} L2.2,${-h - 2.6}`} fill="none" />}
    </g>
  );
}
function Cafe({ x, w, name, lit, price = null, testid }) {
  return (
    <g data-testid={testid}>
      <rect x={x} y="34" width={w} height={GROUND - 34} fill={lit ? 'color-mix(in srgb, var(--u) 9%, var(--ds-card))' : 'var(--ds-card)'} stroke="var(--ds-ink2)" strokeWidth="1.1" />
      <path d={`M${x - 4},48 L${x + w + 4},48 L${x + w},40 L${x},40 Z`} fill={lit ? 'color-mix(in srgb, var(--u) 30%, var(--ds-card))' : 'none'} stroke="var(--ds-ink2)" strokeWidth="1" />
      {Array.from({ length: Math.floor((w + 8) / 9) }, (_, k) => <path key={k} d={`M${x - 4 + k * 9},48 q4.5,4 9,0`} fill="none" stroke="var(--ds-ink2)" strokeWidth=".8" />)}
      <text x={x + w / 2} y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ds-ink)">{name}</text>
      <rect x={x + 6} y="58" width={w * 0.42} height="22" fill={lit ? 'var(--ds-gold-soft)' : 'none'} stroke="var(--ds-ink2)" strokeWidth=".9" />
      {price == null && <line x1={x + 6} y1="69" x2={x + 6 + w * 0.42} y2="69" stroke="var(--ds-ink2)" strokeWidth=".6" />}
      <rect x={x + w - 20} y="62" width="13" height={GROUND - 62} fill="var(--ds-card2)" stroke="var(--ds-ink2)" strokeWidth=".9" />
      {/* цена — мелом на витрине */}
      {price != null && (
        <g data-testid="street-price">
          <text x={x + 6 + w * 0.21} y="66.5" textAnchor="middle" fontSize="6" fill="var(--ds-ink)">капучино</text>
          <text x={x + 6 + w * 0.21} y="77" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--ds-ink)" style={{ fontFamily: 'var(--ds-mono)' }}>{price} кр.</text>
        </g>
      )}
    </g>
  );
}
export function Street({ queue = 0, short = 0, walkers = 0, t = 1, price = null, cafes = 1, label }) {
  // фигурки: стоящие в очереди — у двери «Зерна», прохожие — по тротуару слева направо
  const figs = [];
  const q = Math.min(queue, 13);
  for (let k = 0; k < q; k += 1) {
    const u = Math.max(0, Math.min(1, t * 1.6 - (k / Math.max(1, q)) * 0.6));
    const end = DOOR - 6 - k * 6.5; const x = -10 + (end + 10) * u;
    figs.push(<Figure key={`q${k}`} k={k} x={x} tone={k >= q - Math.min(short, q) ? 'var(--ds-bad)' : 'var(--ds-ink2)'} />);
  }
  for (let k = 0; k < Math.min(walkers, 10); k += 1) {
    const u = Math.max(0, Math.min(1, t * 1.5 - (k / 10) * 0.5));
    if (u <= 0 || u >= 1) continue;
    figs.push(<Figure key={`w${k}`} k={k + 40} x={-10 + (SW + 20) * u} y={GROUND + 9} opacity={0.75} />);
  }
  return (
    <svg className="lm-street" viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={label || 'Улица у метро «Торговая»'} data-testid="street" data-queue={q}>
      {/* вход в метро слева */}
      <g>
        <rect x="8" y="64" width="44" height={GROUND - 64} fill="var(--ds-card2)" stroke="var(--ds-ink2)" strokeWidth="1" />
        <path d="M8,64 L30,52 L52,64" fill="none" stroke="var(--ds-ink2)" strokeWidth="1" />
        <circle cx="30" cy="40" r="8" fill="none" stroke="var(--u)" strokeWidth="1.6" />
        <text x="30" y="44" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--u-ink)">М</text>
        <text x="30" y="26" textAnchor="middle" fontSize="8.5" fill="var(--ds-ink2)">«Торговая»</text>
      </g>
      <Cafe x={60} w={46} name={cafes > 1 ? 'кофейня' : ''} lit={cafes > 1} testid="street-cafe" />
      <Cafe x={114} w={66} name="«Зерно»" lit price={price} testid="street-zerno" />
      <Cafe x={200} w={58} name={cafes > 2 ? 'кофейня' : ''} lit={cafes > 2} testid="street-cafe" />
      {/* фонарь и скамейка справа */}
      <path d={`M286,${GROUND} L286,46 q0,-6 8,-6`} fill="none" stroke="var(--ds-ink2)" strokeWidth="1.2" />
      <circle cx="296" cy="44" r="3.5" fill="var(--ds-gold-soft)" stroke="var(--ds-ink2)" strokeWidth=".9" />
      <path d={`M268,${GROUND - 9} L310,${GROUND - 9} M272,${GROUND - 9} L272,${GROUND} M306,${GROUND - 9} L306,${GROUND}`} stroke="var(--ds-ink2)" strokeWidth="1.1" />
      <line x1="0" y1={GROUND} x2={SW} y2={GROUND} stroke="var(--ds-ink2)" strokeWidth="1.2" />
      {Array.from({ length: 16 }, (_, k) => <line key={k} x1={6 + k * 20} y1={GROUND + 3} x2={11 + k * 20} y2={GROUND + 6} stroke="var(--ds-ink3)" strokeWidth=".6" />)}
      {figs}
    </svg>
  );
}

// ход дня: t от 0 до 1 за полторы секунды; при «уменьшить движение» — сразу конец
function useDayClock(key, reduced) {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (!key) return undefined;
    if (reduced) { setT(1); return undefined; }
    let raf = 0; const start = performance.now();
    const step = (now) => { const v = Math.min(1, (now - start) / 1500); setT(v); if (v < 1) raf = requestAnimationFrame(step); };
    setT(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced]);
  return t;
}

/* ------------------------------ ГРАФИК ------------------------------ */
const CW = 320; const CH = 218; const L = 38; const R = 12; const T = 20; const B = 34;
const PWc = CW - L - R;
function Frame({ qMax, pMax, qStep, pStep, qLabel = 'чашек в день', pLabel = 'цена, кр.', children, label, testid, ch = CH }) {
  const PHc = ch - T - B;
  const x = (q) => L + (q / qMax) * PWc; const y = (p) => T + PHc - (p / pMax) * PHc;
  const ticksP = []; for (let p = 0; p <= pMax; p += pStep) ticksP.push(p);
  const ticksQ = []; for (let q = 0; q <= qMax; q += qStep) ticksQ.push(q);
  return (
    <svg className="lm-chart" viewBox={`0 0 ${CW} ${ch}`} role="img" aria-label={label} data-testid={testid}>
      {ticksP.map((p) => <g key={`p${p}`}><line x1={L} x2={L + PWc} y1={y(p)} y2={y(p)} stroke="var(--ds-rule)" /><text x={L - 5} y={y(p) + 3.5} textAnchor="end">{p}</text></g>)}
      {ticksQ.map((q) => <text key={`q${q}`} x={x(q)} y={T + PHc + 14} textAnchor="middle">{q}</text>)}
      <line x1={L} y1={T} x2={L} y2={T + PHc} stroke="var(--ds-ink2)" strokeWidth="2" />
      <line x1={L} y1={T + PHc} x2={L + PWc} y2={T + PHc} stroke="var(--ds-ink2)" strokeWidth="2" />
      <text className="lm-ax" x={L - 4} y={T - 9}>{pLabel}</text>
      <text className="lm-ax" x={L + PWc} y={T + PHc + 28} textAnchor="end">{qLabel}</text>
      {children({ x, y, base: T + PHc })}
    </svg>
  );
}
// отрезок прямой Q = a − bP (или Q = c + dP) в пределах поля графика
function linePts(fq, qMax, pMax, x, y) {
  const pts = [];
  for (let k = 0; k <= 60; k += 1) { const p = (pMax * k) / 60; const q = fq(p); if (q >= 0 && q <= qMax) pts.push(`${x(q).toFixed(1)},${y(p).toFixed(1)}`); }
  return pts.length > 1 ? `M${pts.join('L')}` : '';
}

/* ------------------------------ ОТКРОЙ САМ ------------------------------
   День в «Зерне»: цена ползунком, «Открыть день» — по улице идут люди, часть заходит; точка на
   графике. С четырёх разных цен из точек проступает линия, и Инфля её называет. body/foot —
   обёртки урока (как у колоды «Слов»): кнопка «Дальше» — в нижней панели. */
export function DiscoverDay({ card, onDone, body, foot }) {
  const reduced = useReducedMotion();
  const [price, setPrice] = useState(DAY.start);
  const [days, setDays] = useState([]);
  const last = days[days.length - 1] || null;
  const t = useDayClock(days.length, reduced);
  const running = t < 1;
  const shown = lineShown(days);
  const done = discoverDone(days);
  const fit = shown ? fitDemand(days) : null;
  const left = DAY.need - distinctPrices(days);
  const open = () => {
    if (running) return;
    Audio.play('register');
    setDays((d) => [...d, dayResult(price)]);
  };
  const queue = last ? Math.round((last.bought / DAY.passers) * 12) : 0;
  return (
    <>
      {body(
        <div data-testid="discover" data-days={days.length} data-distinct={distinctPrices(days)} data-line={String(shown)}>
          <h2 className="ds-h1" style={{ fontSize: 25 }}>{card.title}</h2>
          <div className="ds-text" style={{ marginTop: 8 }}><Inline nodes={card.text} /></div>
          <Street queue={last ? queue : 0} walkers={last ? 12 - queue : 0} t={last ? t : 1} price={price} label={last ? `День ${days.length}: при цене ${last.price} кр. зашли ${last.bought} человек` : 'Улица у метро «Торговая»: день ещё не начался'} />
          <div className="lm-read" data-testid="discover-day" aria-live="polite">
            {last ? (running ? `День ${days.length}: идут прохожие…` : <>День {days.length}: при цене <b>{last.price} кр.</b> зашли <b>{last.bought}</b> из {DAY.passers}</>) : 'Поставьте цену и откройте день'}
          </div>
          <label className="ds-sub" style={{ fontSize: 14, display: 'block' }} htmlFor="discover-price">Цена капучино: <b style={{ fontFamily: 'var(--ds-mono)' }}>{price} кр.</b></label>
          <input id="discover-price" type="range" className="lm-range" min={DAY.min} max={DAY.max} step={1} value={price} data-testid="discover-price"
            onChange={(e) => { Audio.play('tick'); setPrice(Number(e.target.value)); }} />
          <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 8px' }}>
            <Button variant="secondary" data-testid="discover-open" disabled={running} onClick={open}>Открыть день {days.length + 1}</Button>
          </div>
          <Frame qMax={DAY.passers} pMax={40} qStep={20} pStep={10} qLabel="сколько купили" label="Точки: цена — сколько купили" testid="discover-chart">
            {({ x, y }) => (
              <>
                {fit && <path className="lm-line" d={linePts((p) => fit.a - fit.b * p, DAY.passers, 40, x, y)} stroke="#3E6FA8" strokeWidth="3.5" fill="none" strokeLinecap="round" data-testid="discover-line" />}
                {days.map((d, k) => (
                  <circle key={k} cx={x(d.bought)} cy={y(d.price)} r={k === days.length - 1 ? 5.5 : 4.5} fill={k === days.length - 1 ? 'var(--u)' : 'var(--ds-card)'} stroke="var(--u-ink)" strokeWidth="1.6"
                    opacity={k === days.length - 1 && running ? t : 1} data-testid="discover-point" />
                ))}
                {fit && <text x={x(Math.min(DAY.passers - 6, Math.max(4, fit.a - fit.b * 7))) + 4} y={y(7) - 6} style={{ fill: '#3E6FA8' }}>D</text>}
              </>
            )}
          </Frame>
          {days.length > 0 && <div className="lm-days" aria-label="Дни">{days.map((d, k) => <span key={k}>д{k + 1}: {d.price} кр. → {d.bought}</span>)}</div>}
          {shown ? (
            <div className="lm-say ds-rise" data-testid="discover-infla">
              <Mascot mood="joy" size={40} />
              <span><b>То, что вы нашли, — кривая спроса.</b> Чем дороже чашка, тем меньше её покупают. Точки чуть разбросаны: каждый день немного другой, но линия видна.</span>
            </div>
          ) : (
            <div className="ds-sub" style={{ fontSize: 14, textAlign: 'center' }} data-testid="discover-left">
              {days.length === 0 ? 'Каждый день — точка на графике.' : `Разных цен: ${distinctPrices(days)} из ${DAY.need}. Попробуйте ещё ${left} ${plural(left, 'цену', 'цены', 'цен')}.`}
            </div>
          )}
        </div>,
      )}
      {foot(<Button wide data-testid="discover-next" disabled={!done || running} onClick={() => { Audio.play('paper'); onDone(days); }}>
        {done ? 'Дальше' : `Ещё ${left} ${plural(left, 'цена', 'цены', 'цен')}`}
      </Button>)}
    </>
  );
}

/* ------------------------------ ЖИВАЯ МОДЕЛЬ ------------------------------
   Рынок капучино у «Торговой» в текущем состоянии юнита: улица, график, табло и детали.
   Открытые детали крутятся ползунками, закрытые — силуэтом «откроется в уроке …». compact —
   на Пути: улица, график и полоска деталей, ползунки — по кнопке. */
const SCALE3 = { income: ['ниже', 'как обычно', 'выше'], tea: ['дешевле', 'как обычно', 'дороже'], grain: ['дешевле', 'как обычно', 'дороже'] };
function Slider({ id, value, min, max, step = 1, onChange, scale, label }) {
  return (
    <div>
      <input type="range" className="lm-range" min={min} max={max} step={step} value={value} aria-label={label} data-testid={`model-${id}`}
        onChange={(e) => { Audio.play('tick'); onChange(Number(e.target.value)); }} />
      {scale && <div className="lm-scale">{scale.map((s) => <span key={s}>{s}</span>)}</div>}
    </div>
  );
}
export function ModelChart({ r, open, st }) {
  const { m } = r; const { qMax, pMax } = MODEL_AXES;
  const base = { ...BASE, dA: 0, dC: 0 };
  const trace = open.has('trace') && st.trace !== false;
  return (
    <Frame qMax={qMax} pMax={pMax} qStep={20} pStep={10} label="Рынок капучино у «Торговой»" testid="model-chart">
      {({ x, y }) => (
        <>
          {trace && <path d={linePts((p) => mqd(base, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
          {trace && open.has('supply') && <path d={linePts((p) => mqs(base, p), qMax, pMax, x, y)} stroke="#C0602A" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
          <path d={linePts((p) => mqd(m, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeWidth="3.5" fill="none" strokeLinecap="round" data-curve-line="D" />
          {open.has('supply') && <path d={linePts((p) => mqs(m, p), qMax, pMax, x, y)} stroke="#C0602A" strokeWidth="3.5" fill="none" strokeLinecap="round" data-curve-line="S" />}
          {r.mode === 'demand' && (
            <g data-testid="model-price-line">
              <line x1={L} x2={L + PWc} y1={y(r.p)} y2={y(r.p)} stroke="var(--u)" strokeWidth="1.6" strokeDasharray="4 4" />
              <circle cx={x(r.qd)} cy={y(r.p)} r="5.5" fill="#3E6FA8" />
            </g>
          )}
          {r.mode === 'ceiling' && (
            <g data-testid="model-ceiling">
              <line x1={L} x2={L + PWc} y1={y(r.p)} y2={y(r.p)} stroke="var(--ds-bad)" strokeWidth="2" strokeDasharray="5 4" />
              <line x1={x(r.qs)} x2={x(r.qd)} y1={y(r.p)} y2={y(r.p)} stroke="var(--ds-bad)" strokeWidth="6" opacity=".6" strokeLinecap="round" />
              <text x={L + PWc - 2} y={y(r.p) - 5} textAnchor="end" style={{ fill: 'var(--ds-bad)' }}>потолок</text>
            </g>
          )}
          {r.eq && <circle cx={x(r.eq.q)} cy={y(r.eq.p)} r="5.5" fill="var(--ds-ink)" opacity={r.mode === 'ceiling' ? 0.35 : 1} data-testid="model-eq" />}
          {trace && r.eq && open.has('supply') && (() => { const e0 = { p: 20, q: 60 }; return Math.abs(r.eq.p - 20) + Math.abs(r.eq.q - 60) > 1 ? <circle cx={x(e0.q)} cy={y(e0.p)} r="4" fill="none" stroke="var(--ds-ink3)" strokeWidth="1.5" /> : null; })()}
          <text x={x(Math.min(qMax - 8, Math.max(4, mqd(m, 6)))) + 4} y={y(6) - 6} style={{ fill: '#3E6FA8' }}>D</text>
          {open.has('supply') && <text x={x(Math.min(qMax - 10, Math.max(4, mqs(m, 34)))) + 6} y={y(34) + 4} style={{ fill: '#C0602A' }}>S</text>}
        </>
      )}
    </Frame>
  );
}
const r1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
export function MarketModel({ unitId, learn, compact = false, testid = 'unit-model' }) {
  const parts = useMemo(() => modelParts(unitId, learn), [unitId, learn]);
  const prog = modelProgress(unitId, learn);
  const open = useMemo(() => new Set(parts.filter((p) => p.open).map((p) => p.id)), [parts]);
  const [st, setSt] = useState(MODEL_DEFAULT);
  const [controls, setControls] = useState(!compact);
  const [news, setNews] = useState(null);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));
  const r = modelReadout(st, open);
  const sold = r.mode === 'demand' ? r.qd : r.sold;
  const queue = Math.round(sold / 8);
  const short = r.mode === 'ceiling' ? Math.round(r.shortage / 8) : 0;
  const assembled = open.has('seal');
  const control = (p) => {
    switch (p.id) {
      case 'demand': return open.has('supply')
        ? <div className="lm-part-text">Цену теперь находит рынок — там, где спрос встречает предложение.</div>
        : <Slider id="price" label="Цена чашки" value={st.price} min={10} max={35} onChange={(v) => set({ price: v })} scale={['10 кр.', '35 кр.']} />;
      case 'income': case 'tea': case 'grain': return <Slider id={p.id} label={p.title} value={st[p.id]} min={-2} max={2} onChange={(v) => set({ [p.id]: v })} scale={SCALE3[p.id]} />;
      case 'ceiling': return (
        <div>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={st.ceiling != null} data-testid="model-ceiling-on" onChange={(e) => { Audio.play('tick'); set({ ceiling: e.target.checked ? 15 : null }); }} /> Ввести потолок{st.ceiling != null ? `: ${st.ceiling} кр.` : ''}
          </label>
          {st.ceiling != null && <Slider id="ceiling" label="Потолок цены" value={st.ceiling} min={10} max={30} onChange={(v) => set({ ceiling: v })} scale={['10 кр.', '30 кр.']} />}
        </div>
      );
      case 'news': return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {MODEL_NEWS.map((n) => (
            <button key={n.id} type="button" className="ds-chip" style={{ margin: 0, fontSize: 13.5, padding: '6px 9px' }} aria-pressed={news === n.id} data-testid={`model-news-${n.id}`}
              onClick={() => { Audio.play('paper'); setNews(n.id); setSt({ ...MODEL_DEFAULT, trace: st.trace, elastic: st.elastic, ...n.set }); }}>
              <Newspaper size={14} aria-hidden="true" /> {n.title}
            </button>
          ))}
        </div>
      );
      case 'trace': return (
        <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={st.trace !== false} onChange={(e) => set({ trace: e.target.checked })} /> Пунктиром — рынок без сдвигов
        </label>
      );
      case 'elastic': return <Slider id="elastic" label="Чувствительность покупателей" value={st.elastic} min={1} max={6} step={0.5} onChange={(v) => set({ elastic: v })} scale={['слабо реагируют', 'сильно']} />;
      default: return null;
    }
  };
  return (
    <div data-testid={testid} data-open={prog.open} data-total={prog.total} data-assembled={String(assembled)}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-eyebrow">Живая модель юнита</div>
          <div className="ds-h3">Рынок капучино у «Торговой»</div>
        </div>
        <span className="ds-sub" style={{ fontSize: 13 }} data-testid="model-progress">
          <span className="lm-pips" aria-hidden="true">{parts.filter((p) => !p.outside).map((p) => <i key={p.id} className={p.open ? 'on' : ''} />)}</span> {prog.open} из {prog.total}
        </span>
      </div>
      {prog.open === 0 ? (
        <div className="ds-sub" style={{ fontSize: 14, margin: '8px 0' }} data-testid="model-empty">Модель соберётся по ходу юнита: каждый урок добавит деталь. Первая — в уроке «{parts[0].where}».</div>
      ) : (
        <>
          <Street queue={queue} short={short} cafes={open.has('supply') ? 3 : 1} price={Math.round(r.p)} label={`Улица: продают ${Math.round(sold)} чашек в день по ${r1(r.p)} кр.`} />
          <ModelChart r={r} open={open} st={st} />
          <div className="lm-read" data-testid="model-readout">
            {r.mode === 'demand' ? <>При цене <b>{r.p} кр.</b> купят <b>{Math.round(r.qd)}</b> чашек в день</>
              : r.mode === 'ceiling' ? <>Потолок <b>{r.p} кр.</b>: хотят <b>{Math.round(r.qd)}</b>, продают <b>{Math.round(r.qs)}</b> — <b style={{ color: 'var(--ds-bad)' }}>дефицит {Math.round(r.shortage)}</b></>
                : <>Равновесие: <b>{r1(r.eq.p)} кр.</b> и <b>{Math.round(r.eq.q)}</b> чашек в день</>}
          </div>
          {open.has('board') && r.mode !== 'demand' && (
            <div className="lm-board" data-testid="model-board">
              <div><b>{r1(r.p)}</b><span>цена, кр.</span></div>
              <div><b>{Math.round(r.sold)}</b><span>чашек в день</span></div>
              <div><b>{Math.round(r.p * r.sold)}</b><span>выручка, кр.</span></div>
            </div>
          )}
          {assembled && <div style={{ display: 'flex', justifyContent: 'center' }} data-testid="model-seal"><Stamp text="МОДЕЛЬ СОБРАНА" size={64} color="var(--u-ink)" rotate={-6} /></div>}
          {compact && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <Button variant="ghost" small data-testid="model-toggle" aria-expanded={controls} onClick={() => { Audio.play('paper'); setControls((v) => !v); }}>
                {controls ? 'Свернуть детали' : 'Крутить модель'}
              </Button>
            </div>
          )}
        </>
      )}
      {controls && (
        <div className="lm-parts" data-testid="model-parts">
          {parts.map((p) => (
            <div key={p.id} className={`lm-part ${p.open ? '' : 'locked'}`} data-testid="model-part" data-part={p.id} data-open={String(p.open)}>
              <div className="lm-part-head">{!p.open && <Lock size={13} aria-hidden="true" />}{p.title}</div>
              {p.open ? <>{p.id !== 'demand' || !open.has('supply') ? <div className="lm-part-text">{p.text}</div> : null}{control(p)}</>
                : <div className="lm-part-text">Откроется в уроке «{p.where}»{p.outside ? ` — юнит «${p.outside}»` : ''}.</div>}
            </div>
          ))}
          {prog.open > 0 && (
            <Button variant="ghost" small icon={RotateCcw} style={{ justifySelf: 'center' }} data-testid="model-reset" onClick={() => { Audio.play('paper'); setNews(null); setSt(MODEL_DEFAULT); }}>
              Вернуть как было
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
// маленький значок прогресса модели — для карты Пути у остановки
export const modelBadge = (unitId, learn) => { const p = modelProgress(unitId, learn); return p.total ? `модель ${p.open}/${p.total}` : null; };

/* ------------------------------ ДОМИНО ------------------------------
   Сверху новость «Вестника», ниже — сцена (график и улица), пустые звенья и колода. Ученик
   выкладывает цепочку: верное звено встаёт на место и оживляет сцену (кривая сдвигается,
   стрелка цены или количества, люди на улице); неверное — домино падает с этого места, под
   цепочкой разбор, почему звено не следует из предыдущего, и ученик продолжает с верного места.
   Когда цепочка собрана, задание проверяется само (onSubmit). */
export const DOMINO_CSS = `
  /* сцена «Домино» прилипает к верху: выкладывая звенья внизу, ученик видит, что они делают */
  .lm-scene { position: sticky; top: 0; z-index: 1; background: var(--ds-paper); padding-bottom: 2px; }
  .lm-scene .lm-chart { max-width: 290px; margin-bottom: 0; }
  .lm-scene .lm-street { max-width: 260px; margin: 0 auto 4px; }
  .lm-news { border: 1px solid var(--ds-rule2); background: var(--ds-card); padding: 8px 12px 10px; text-align: center; margin-bottom: 8px; }
  .lm-news-mast { font: 700 12px var(--ds-serif); letter-spacing: .22em; text-transform: uppercase; border-bottom: 3px double var(--ds-ink2); padding-bottom: 4px; margin-bottom: 6px; color: var(--ds-ink2); }
  .lm-news-head { font: 700 19px/1.25 var(--ds-serif); }
  .lm-chain { display: grid; gap: 6px; margin: 8px 0; counter-reset: dom; }
  .lm-slot { position: relative; display: flex; align-items: stretch; min-height: 44px; border: 1.5px dashed var(--ds-rule2); border-radius: 5px; background: none; overflow: visible; }
  .lm-slot .n { width: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font: 700 14px var(--ds-mono); color: var(--ds-ink3); border-right: 1.5px dashed var(--ds-rule2); }
  .lm-slot .t { flex: 1; padding: 8px 10px; font-size: 15px; line-height: 1.35; color: var(--ds-ink3); display: flex; align-items: center; }
  .lm-slot.on { border: 1.5px solid var(--ds-ink2); background: var(--ds-card); box-shadow: 0 2px 0 var(--ds-shade); }
  .lm-slot.on .n { color: var(--u-ink); border-right: 1.5px solid var(--ds-ink2); }
  .lm-slot.on .t { color: var(--ds-ink); }
  .lm-slot.on.fresh { animation: lm-set .32s ease-out; }
  @keyframes lm-set { from { transform: translateY(-8px) rotate(-2deg); opacity: .4 } to { transform: none; opacity: 1 } }
  .lm-fall { position: absolute; inset: -1.5px; display: flex; align-items: center; border: 1.5px solid var(--ds-bad); border-radius: 5px; background: var(--ds-card); padding: 8px 10px 8px 44px; font-size: 15px;
    transform-origin: 0% 100%; animation: lm-fall .7s ease-in forwards; pointer-events: none; z-index: 2; }
  @keyframes lm-fall { 0% { transform: none; opacity: 1 } 45% { transform: rotate(-14deg) translateY(4px); opacity: 1 } 100% { transform: rotate(-70deg) translateY(30px); opacity: 0 } }
  .lm-deck { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 6px; }
  .lm-card { font: 14.5px/1.3 var(--ds-sans); text-align: left; padding: 9px 11px; border-radius: 4px; border: 1px solid var(--ds-rule2); border-bottom-width: 2px; background: var(--ds-card); color: var(--ds-ink); cursor: pointer; max-width: 100%; }
  .lm-card:disabled { cursor: default; }
  .lm-card.gone { text-decoration: line-through; color: var(--ds-ink3); background: none; border-style: dashed; }
  .lm-done { border-left: 3px solid var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ok-ink); font-weight: 700; padding: 8px 10px; font-size: 15px; margin: 6px 0; }
  .lm-why { border-left: 3px solid var(--ds-sel-rule); background: color-mix(in srgb, var(--ds-sel-rule) 12%, var(--ds-card)); padding: 8px 10px; font-size: 14.5px; line-height: 1.4; margin: 6px 0; }
  @media (prefers-reduced-motion: reduce) { .lm-slot.on.fresh, .lm-fall { animation: none !important; } .lm-fall { display: none; } }
`;
// сцена «Домино»: что сделали звенья, выложенные до сих пор
function dominoScene(inst, placed) {
  const effects = placed.flatMap((k) => (inst.deck.find((c) => c.key === k) || {}).effects || []);
  const has = (e) => effects.includes(e);
  const dA = (has('D+') ? 24 : 0) - (has('D-') ? 24 : 0);
  const dC = (has('S+') ? 24 : 0) - (has('S-') ? 24 : 0);
  return { dA, dC, P: has('P'), Q: has('Q'), ceil: has('ceil'), street: has('street') };
}
function DominoScene({ inst, sc }) {
  const { qMax, pMax } = MODEL_AXES;
  const m0 = { ...BASE, dA: 0, dC: 0 }; const m = { ...BASE, dA: sc.dA, dC: sc.dC };
  const demandOnly = inst.scene === 'demand';
  const eq = (mm) => { const p = (mm.a + mm.dA - mm.c - mm.dC) / (mm.b + mm.d); return { p, q: mm.a + mm.dA - mm.b * p }; };
  const e0 = eq(m0); const e1 = eq(m);
  const price = demandOnly ? 20 : sc.ceil ? 15 : e1.p;
  const qd = Math.max(0, mqd(m, price)); const qs = Math.max(0, mqs(m, price));
  const sold = demandOnly ? qd : sc.ceil ? Math.min(qd, qs) : e1.q;
  const short = sc.ceil ? Math.max(0, qd - qs) : 0;
  return (
    <div className="lm-scene" data-testid="domino-scene" data-da={sc.dA} data-dc={sc.dC}>
      <Frame qMax={qMax} pMax={pMax} qStep={20} pStep={10} label="Сцена: рынок капучино" testid="domino-chart" ch={160}>
        {({ x, y, base }) => (
          <>
            {sc.dA !== 0 && <path d={linePts((p) => mqd(m0, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            {sc.dC !== 0 && !demandOnly && <path d={linePts((p) => mqs(m0, p), qMax, pMax, x, y)} stroke="#C0602A" strokeOpacity=".4" strokeWidth="2.2" strokeDasharray="5 5" fill="none" />}
            <path d={linePts((p) => mqd(m, p), qMax, pMax, x, y)} stroke="#3E6FA8" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {!demandOnly && <path d={linePts((p) => mqs(m, p), qMax, pMax, x, y)} stroke="#C0602A" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
            {sc.dA !== 0 && <text x={x(mqd(m, 30)) + (sc.dA > 0 ? 4 : -16)} y={y(30) - 4} style={{ fill: '#3E6FA8', fontSize: 15 }} data-testid="domino-arrow-d">{sc.dA > 0 ? '→' : '←'}</text>}
            {sc.dC !== 0 && !demandOnly && <text x={x(mqs(m, 30)) + (sc.dC > 0 ? 4 : -16)} y={y(30) + 14} style={{ fill: '#C0602A', fontSize: 15 }} data-testid="domino-arrow-s">{sc.dC > 0 ? '→' : '←'}</text>}
            {(demandOnly || sc.ceil) && <line x1={L} x2={L + PWc} y1={y(price)} y2={y(price)} stroke={sc.ceil ? 'var(--ds-bad)' : 'var(--u)'} strokeWidth="1.8" strokeDasharray="4 4" />}
            {sc.ceil && <line x1={x(qs)} x2={x(qd)} y1={y(price)} y2={y(price)} stroke="var(--ds-bad)" strokeWidth="6" opacity=".55" strokeLinecap="round" />}
            {demandOnly ? <circle cx={x(qd)} cy={y(price)} r="5.5" fill="#3E6FA8" /> : <circle cx={x(e1.q)} cy={y(e1.p)} r="5.5" fill="var(--ds-ink)" opacity={sc.ceil ? 0.35 : 1} />}
            {sc.P && Math.abs(e1.p - e0.p) > 0.5 && <path d={`M${L + 7},${y(e0.p)} L${L + 7},${y(e1.p) + (e1.p > e0.p ? 6 : -6)}`} stroke="var(--u-ink)" strokeWidth="2.5" markerEnd="url(#lm-arr)" data-testid="domino-arrow-p" />}
            {sc.Q && (() => {
              // количество: на рынке — от старого равновесия к новому, на сцене спроса — при той же цене
              const q0 = demandOnly ? mqd(m0, price) : e0.q; const q1 = demandOnly ? mqd(m, price) : e1.q;
              return Math.abs(q1 - q0) > 0.5 ? <path d={`M${x(q0)},${base - 7} L${x(q1) + (q1 > q0 ? -6 : 6)},${base - 7}`} stroke="var(--u-ink)" strokeWidth="2.5" markerEnd="url(#lm-arr)" data-testid="domino-arrow-q" /> : null;
            })()}
            <text x={x(Math.min(qMax - 8, Math.max(4, mqd(m, 6)))) + 4} y={y(6) - 5} style={{ fill: '#3E6FA8' }}>D</text>
            {!demandOnly && <text x={x(Math.min(qMax - 10, Math.max(4, mqs(m, 34)))) + 6} y={y(34) + 4} style={{ fill: '#C0602A' }}>S</text>}
            <defs><marker id="lm-arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="var(--u-ink)" /></marker></defs>
          </>
        )}
      </Frame>
      <Street queue={Math.round(sold / 8) + Math.round(short / 8)} short={sc.street || sc.ceil ? Math.round(short / 8) : 0} cafes={demandOnly ? 1 : 3} price={Math.round(price)}
        label={`Улица: ${Math.round(sold)} чашек в день по ${Math.round(price)} кр.`} />
    </div>
  );
}
export function DominoEx({ inst, resp, setResp, locked, fb, onSubmit, prompt }) {
  const r = resp || { placed: [], falls: [], done: false };
  const [fall, setFall] = useState(null);
  const [fresh, setFresh] = useState(-1);
  const byKey = Object.fromEntries(inst.deck.map((c) => [c.key, c]));
  const at = r.placed.length;
  const placedSet = new Set(r.placed);
  const goneSet = new Set(r.falls.map((f) => f.key).filter((k) => byKey[k].link == null));
  const shown = locked && fb ? inst.chain : r.placed;
  const sc = dominoScene(inst, shown);
  const tap = (card) => {
    if (locked || r.done) return;
    const want = inst.chain[at];
    if (card.key === want) {
      const placed = [...r.placed, card.key];
      const nr = { ...r, placed, done: placed.length === inst.chain.length };
      Audio.play('tick'); setFall(null); setFresh(at); setResp(nr);
      if (nr.done) onSubmit(nr);
      return;
    }
    const prev = at === 0 ? `новости «${inst.headline}»` : `«${byKey[r.placed[at - 1]].raw}»`;
    const why = card.link == null ? card.why : [{ t: 'text', v: card.link > at
      ? `Это звено в цепочке есть, но позже: из ${prev} оно прямо не следует — сначала нужен шаг между ними.`
      : `Это звено уже было бы раньше: после ${prev} нужен следующий шаг.` }];
    const nr = { ...r, falls: [...r.falls, { key: card.key, at }] };
    Audio.play('down');
    setFall({ key: card.key, at, why, n: nr.falls.length });
    setResp(nr);
  };
  return (
    <div data-testid="domino" data-placed={r.placed.length} data-falls={r.falls.length}>
      <div className="lm-news"><div className="lm-news-mast">Вестник Инфлатии</div><div className="lm-news-head" data-testid="domino-headline">{inst.headline}</div></div>
      {prompt}
      <DominoScene inst={inst} sc={sc} />
      <div className="lm-chain" aria-label="Цепочка">
        {inst.chain.map((k, i) => {
          const on = i < shown.length;
          const card = on ? byKey[shown[i]] : null;
          return (
            <div key={k} className={`lm-slot ${on ? 'on' : ''} ${on && i === fresh ? 'fresh' : ''}`} data-testid="domino-slot" data-on={String(on)}>
              <span className="n">{i + 1}</span>
              <span className="t">{card ? <Inline nodes={card.text} /> : i === at && !locked ? 'Что из этого следует?' : '…'}</span>
              {fall && fall.at === i && !on && <span className="lm-fall" key={fall.n} aria-hidden="true"><Inline nodes={byKey[fall.key].text} /></span>}
            </div>
          );
        })}
      </div>
      {r.placed.length === inst.chain.length && (
        <div className="lm-done" data-testid="domino-done" data-falls={r.falls.length} aria-live="polite">Собрано, было падений: {r.falls.length}</div>
      )}
      {fall && !locked && (
        <div className="lm-why" data-testid="domino-why" aria-live="polite">
          <b>Домино упало на звене {fall.at + 1}.</b> «{byKey[fall.key].raw}» — не следующее звено. <Inline nodes={fall.why} /> Продолжайте с этого места.
        </div>
      )}
      {!locked && (
        <div className="lm-deck" aria-label="Колода">
          {inst.deck.filter((c) => !placedSet.has(c.key)).map((c) => (
            <button key={c.key} type="button" className={`lm-card ${goneSet.has(c.key) ? 'gone' : ''}`} data-testid="domino-card" data-key={c.key}
              disabled={goneSet.has(c.key)} onClick={() => tap(c)}><Inline nodes={c.text} /></button>
          ))}
        </div>
      )}
    </div>
  );
}
