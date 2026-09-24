/* Казино, вынесенное из MacroSimulator.jsx в отдельный чанк: доступно только
   на «Рынке» у трейдера, а не с первого экрана, поэтому грузится лениво через
   React.lazy() в MacroSimulator.jsx — как и src/charts.jsx.

   COLOR/Audio/INSTRUMENTS/INSTR_BY_ID — тот же самый общий объект/массив, что
   и в MacroSimulator.jsx (экспортированы оттуда), а не копия. */
import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Dices } from 'lucide-react';
import { clamp, fmtMln, fmtMlnSigned } from './lib/engine.js';
import { COLOR, Audio } from './MacroSimulator.jsx';
import { INSTRUMENTS, INSTR_BY_ID } from './game.jsx';

const CASINO_GAMES = [
  { id: 'roulette', label: 'Рулетка', icon: '🎡' },
  { id: 'slots', label: 'Слоты', icon: '🎰' },
  { id: 'dice', label: 'Кости', icon: '🎲' },
  { id: 'blackjack', label: 'Блэкджек', icon: '🃏' },
  { id: 'binary', label: 'Бинарные опционы', icon: '📉' },
];

const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const rouletteColor = (n) => (n === 0 ? 'green' : ROULETTE_RED.has(n) ? 'red' : 'black');
// порядок секторов настоящего европейского колеса — от него зависит, где именно
// останавливается стрелка, а не только какое число «выпало» по RNG
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const WHEEL_SEG = 360 / WHEEL_ORDER.length;
const WHEEL_SIZE = 260;
const WHEEL_GRADIENT = (() => {
  const stops = WHEEL_ORDER.map((n, i) => {
    const c = n === 0 ? '#1F7A4D' : ROULETTE_RED.has(n) ? '#A4342A' : '#17181C';
    return `${c} ${(i * WHEEL_SEG).toFixed(3)}deg ${((i + 1) * WHEEL_SEG).toFixed(3)}deg`;
  }).join(', ');
  return `conic-gradient(${stops})`;
})();
const ROULETTE_BETS = [
  { id: 'red', label: 'Красное', mult: 2 }, { id: 'black', label: 'Чёрное', mult: 2 },
  { id: 'even', label: 'Чёт', mult: 2 }, { id: 'odd', label: 'Нечет', mult: 2 },
  { id: 'low', label: '1–18', mult: 2 }, { id: 'high', label: '19–36', mult: 2 },
  { id: 'straight', label: 'Число', mult: 36 },
];

// Мелкая ставка = процент от свободных денег, крупная = абсолютная сумма —
// общий контрол для всех игр казино, чтобы не плодить одну и ту же вёрстку пять раз
function CasinoBet({ amount, setAmount, cash }) {
  const setPct = (p) => setAmount(Math.max(0.01, Math.round(cash * p * 100) / 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>
        <span>Ставка</span><span className="ems-mono">{fmtMln(amount)}</span>
      </div>
      <input type="range" min={0.01} max={Math.max(0.01, cash)} step={0.01} value={Math.min(amount, Math.max(0.01, cash))}
        onChange={(e) => setAmount(parseFloat(e.target.value))} style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
        {[0.1, 0.25, 0.5, 1].map((p) => (
          <button key={p} className="ems-btn" style={{ flex: 1, padding: '4px 0', fontSize: 12 }} onClick={() => setPct(p)}>
            {p === 1 ? 'макс.' : `${p * 100}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
const CasinoResult = ({ net }) => (net === null ? null : (
  <div className="ems-mono" style={{ marginTop: 12, fontSize: 19, fontWeight: 700, color: net > 0 ? COLOR.teal : net < 0 ? COLOR.rust : COLOR.muted }}>
    {fmtMlnSigned(net)}
  </div>
));

function RouletteGame({ cash, onResult }) {
  const [betType, setBetType] = useState('red');
  const [number, setNumber] = useState(7);
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [spinning, setSpinning] = useState(false);
  const [spin, setSpin] = useState(null);
  const [rotation, setRotation] = useState(0);
  const SPIN_MS = 2200;
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || spinning) return;
    const n = Math.floor(Math.random() * 37);
    const color = rouletteColor(n);
    const b = ROULETTE_BETS.find((x) => x.id === betType);
    let win = false;
    if (betType === 'straight') win = n === number;
    else if (betType === 'red' || betType === 'black') win = color === betType;
    else if (betType === 'even') win = n !== 0 && n % 2 === 0;
    else if (betType === 'odd') win = n % 2 === 1;
    else if (betType === 'low') win = n >= 1 && n <= 18;
    else if (betType === 'high') win = n >= 19 && n <= 36;
    const net = win ? bet * (b.mult - 1) : -bet;
    // колесо реально останавливается на выпавшем секторе, а не крутится вслепую:
    // подгоняем итоговый угол под сектор n, всегда вперёд от текущего положения
    const idx = WHEEL_ORDER.indexOf(n);
    const targetMod = 360 - (idx * WHEEL_SEG + WHEEL_SEG / 2);
    const curMod = ((rotation % 360) + 360) % 360;
    let delta = targetMod - curMod;
    if (delta <= 0) delta += 360;
    const spins = 5 + Math.floor(Math.random() * 2);
    setSpinning(true); setSpin(null); Audio.play('tick');
    setRotation((r) => r + spins * 360 + delta);
    setTimeout(() => {
      onResult(net);
      Audio.play(win ? 'coin' : 'click');
      setSpin({ n, color, win, net });
      setSpinning(false);
    }, SPIN_MS);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 5 }}>Тип ставки</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {ROULETTE_BETS.map((b) => (
            <button type="button" key={b.id} className={`ems-tab ${betType === b.id ? 'active' : ''}`} aria-pressed={betType === b.id} style={{ padding: '4px 9px', fontSize: 12 }}
              onClick={() => { Audio.play('tab'); setBetType(b.id); }}>{b.label} <span style={{ color: COLOR.faint }}>×{b.mult}</span></button>
          ))}
        </div>
        {betType === 'straight' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Число (0–36)</div>
            <input type="number" min={0} max={36} value={number} onChange={(e) => setNumber(clamp(parseInt(e.target.value, 10) || 0, 0, 36))}
              style={{ width: '100%', padding: '7px 9px', fontSize: 13, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
          </div>
        )}
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={spinning || cash <= 0} onClick={play}>
          {spinning ? 'Крутится…' : 'Крутить'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE }}>
          <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
            borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: `18px solid ${COLOR.goldSoft}`, zIndex: 2 }} />
          <div className={!spinning && !spin ? 'ems-wheel-idle' : ''} style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: '50%',
            background: WHEEL_GRADIENT, border: `4px solid ${COLOR.borderStrong}`, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.4)',
            transform: `rotate(${rotation}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(0.12,0.67,0.1,0.99)` }}>
            {WHEEL_ORDER.map((n, i) => {
              const mid = i * WHEEL_SEG + WHEEL_SEG / 2;
              return (
                <div key={n} style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, transform: `rotate(${mid}deg)` }}>
                  <span style={{ position: 'absolute', left: -11, top: -(WHEEL_SIZE / 2 - 22), width: 22, textAlign: 'center',
                    fontSize: 13, fontWeight: 700, color: '#F4F1E8', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{n}</span>
                </div>
              );
            })}
          </div>
          <div className="ems-mono" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 80, height: 80, borderRadius: '50%', background: COLOR.panel, border: `3px solid ${COLOR.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700,
            color: !spin ? COLOR.faint : spin.color === 'red' ? COLOR.rust : spin.color === 'black' ? COLOR.text : COLOR.teal }}>
            {spinning ? '' : spin ? spin.n : '—'}
          </div>
        </div>
        {spin && !spinning && (
          <div className="ems-coin-pop" style={{ marginTop: 12, fontSize: 13, color: COLOR.muted }}>
            Выпало {spin.n} ({spin.color === 'red' ? 'красное' : spin.color === 'black' ? 'чёрное' : 'зеро'}) — {spin.win ? 'выигрыш' : 'проигрыш'}
          </div>
        )}
        <div className={spin && !spinning ? (spin.win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ borderRadius: 8 }}>
          <CasinoResult net={spin && !spinning ? spin.net : null} />
        </div>
      </div>
    </div>
  );
}

const SLOT_SYMBOLS = [
  { id: 'cherry', icon: '🍒', weight: 40, pay3: 4, pay2: 1.5 },
  { id: 'lemon', icon: '🍋', weight: 28, pay3: 6 },
  { id: 'bell', icon: '🔔', weight: 16, pay3: 12 },
  { id: 'gem', icon: '💎', weight: 8, pay3: 25 },
  { id: 'seven', icon: '7️⃣', weight: 3, pay3: 60 },
];
const SLOT_WEIGHT_TOTAL = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
const pickSlotSymbol = () => {
  let r = Math.random() * SLOT_WEIGHT_TOTAL;
  for (const s of SLOT_SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
  return SLOT_SYMBOLS[0];
};
function SlotsGame({ cash, onResult }) {
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [display, setDisplay] = useState([SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]]);
  const [spinningReels, setSpinningReels] = useState([false, false, false]);
  const [net, setNet] = useState(null);
  const [win, setWin] = useState(false);
  const timersRef = React.useRef([]);
  React.useEffect(() => () => timersRef.current.forEach(clearInterval), []);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || spinningReels.some(Boolean)) return;
    Audio.play('tick');
    const final = [pickSlotSymbol(), pickSlotSymbol(), pickSlotSymbol()];
    let mult = 0;
    if (final[0].id === final[1].id && final[1].id === final[2].id) mult = final[0].pay3;
    else if (final.filter((s) => s.id === 'cherry').length >= 2) mult = SLOT_SYMBOLS[0].pay2;
    const didWin = mult > 0;
    // «× N» в таблице выплат читается как «столько раз вернётся ваша ставка», та же
    // конвенция, что и в рулетке и костях (bet*(mult-1)) — раньше здесь выплачивался
    // весь mult сверху ставки, и с текущей таблицей это давало казино отрицательный
    // (в пользу игрока) матожидание вместо небольшого преимущества дома.
    const n = didWin ? bet * (mult - 1) : -bet;
    setNet(null); setWin(false);
    setSpinningReels([true, true, true]);
    timersRef.current.forEach(clearInterval); timersRef.current = [];
    // барабаны останавливаются не одновременно, а с задержкой друг за другом —
    // тот самый «дзынь-дзынь-дзынь» настоящего слот-автомата
    [0, 1, 2].forEach((i) => {
      const iv = setInterval(() => setDisplay((d) => { const nd = [...d]; nd[i] = pickSlotSymbol(); return nd; }), 65);
      timersRef.current.push(iv);
      setTimeout(() => {
        clearInterval(iv); Audio.play('tick');
        setDisplay((d) => { const nd = [...d]; nd[i] = final[i]; return nd; });
        setSpinningReels((s) => { const ns = [...s]; ns[i] = false; return ns; });
        if (i === 2) {
          onResult(n);
          Audio.play(didWin ? 'coin' : 'click');
          setNet(n); setWin(didWin);
        }
      }, 600 + i * 280);
    });
  };
  const anySpinning = spinningReels.some(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={anySpinning || cash <= 0} onClick={play}>
          {anySpinning ? 'Крутится…' : 'Крутить'}
        </button>
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 9, lineHeight: 1.5 }}>
          {SLOT_SYMBOLS.map((s) => (<div key={s.id}>{s.icon}{s.icon}{s.icon} × {s.pay3}</div>))}
          <div>🍒🍒 × {SLOT_SYMBOLS[0].pay2}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className={net !== null ? (win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ display: 'flex', gap: 16, fontSize: 66, padding: 10, borderRadius: 10 }}>
          {display.map((s, i) => (
            <div key={i} className={spinningReels[i] ? 'ems-reel-spin' : net !== null ? 'ems-coin-pop' : ''}
              style={{ width: 98, height: 98, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: COLOR.panelAlt, border: `2px solid ${spinningReels[i] ? COLOR.gold : COLOR.border}`, borderRadius: 6 }}>
              {s.icon}
            </div>
          ))}
        </div>
        <CasinoResult net={net} />
      </div>
    </div>
  );
}

const DICE_BETS = [
  { id: 'under', label: 'Меньше 7', mult: 2 }, { id: 'over', label: 'Больше 7', mult: 2 }, { id: 'seven', label: 'Ровно 7', mult: 5 },
];
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function DiceGame({ cash, onResult }) {
  const [betType, setBetType] = useState('over');
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [net, setNet] = useState(null);
  const [win, setWin] = useState(false);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || rolling) return;
    setRolling(true); setNet(null); Audio.play('tick');
    setTimeout(() => {
      const d1 = 1 + Math.floor(Math.random() * 6); const d2 = 1 + Math.floor(Math.random() * 6);
      const sum = d1 + d2;
      const b = DICE_BETS.find((x) => x.id === betType);
      let didWin = false;
      if (betType === 'under') didWin = sum < 7;
      else if (betType === 'over') didWin = sum > 7;
      else didWin = sum === 7;
      const n = didWin ? bet * (b.mult - 1) : -bet;
      onResult(n);
      Audio.play(didWin ? 'coin' : 'click');
      setDice([d1, d2, sum]); setNet(n); setWin(didWin);
      setRolling(false);
    }, 650);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 5 }}>Ставка на сумму двух костей</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {DICE_BETS.map((b) => (
            <button type="button" key={b.id} className={`ems-tab ${betType === b.id ? 'active' : ''}`} aria-pressed={betType === b.id} style={{ padding: '4px 9px', fontSize: 12 }}
              onClick={() => { Audio.play('tab'); setBetType(b.id); }}>{b.label} <span style={{ color: COLOR.faint }}>×{b.mult}</span></button>
          ))}
        </div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={rolling || cash <= 0} onClick={play}>
          {rolling ? 'Бросок…' : 'Бросить'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className={net !== null ? (win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ display: 'flex', gap: 16, padding: 10, borderRadius: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} className={rolling ? 'ems-dice-roll' : dice ? 'ems-coin-pop' : ''}
              style={{ width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, lineHeight: 1,
                color: COLOR.text, background: COLOR.panelAlt, border: `2px solid ${COLOR.border}`, borderRadius: 10 }}>
              {rolling ? '⚅' : dice ? DICE_FACES[dice[i]] : '—'}
            </div>
          ))}
        </div>
        {dice && !rolling && <div style={{ marginTop: 10, fontSize: 13, color: COLOR.muted }}>Сумма: {dice[2]}</div>}
        <CasinoResult net={rolling ? null : net} />
      </div>
    </div>
  );
}

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
// раньше каждая карта тянулась независимо (ранг и масть — отдельные случайные
// числа), поэтому в одной раздаче могли выпасть две одинаковые карты — то, чего
// в реальной колоде на 52 карты просто не бывает. Теперь раздача тасует полную
// колоду один раз и тянет карты из неё по очереди, без возврата.
const FULL_DECK = CARD_RANKS.flatMap((r) => CARD_SUITS.map((s) => r + s));
const shuffledDeck = () => {
  const d = [...FULL_DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};
const cardRank = (c) => c.slice(0, -1);
const cardSuit = (c) => c.slice(-1);
const cardValue = (c) => { const r = cardRank(c); return r === 'A' ? 11 : (r === 'J' || r === 'Q' || r === 'K') ? 10 : parseInt(r, 10); };
function handValue(cards) {
  let sum = cards.reduce((a, c) => a + cardValue(c), 0);
  let aces = cards.filter((c) => cardRank(c) === 'A').length;
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
const Card = ({ c, hidden, dealIndex, className }) => {
  const red = !hidden && (cardSuit(c) === '♥' || cardSuit(c) === '♦');
  return (
    <div className={`ems-mono ems-card-deal ${className || ''}`} style={{ width: 70, height: 98, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: hidden ? COLOR.panelRaised : '#F4F1E8', color: hidden ? COLOR.faint : red ? '#A4342A' : '#17181C', borderRadius: 7, fontSize: 22, fontWeight: 700, lineHeight: 1.2,
      border: `1px solid ${COLOR.border}`, boxShadow: '0 3px 8px rgba(0,0,0,0.35)', animationDelay: `${(dealIndex || 0) * 90}ms` }}>
      {hidden ? <span style={{ fontSize: 32 }}>🂠</span> : (<><span>{cardRank(c)}</span><span style={{ fontSize: 26 }}>{cardSuit(c)}</span></>)}
    </div>
  );
};
function BlackjackGame({ cash, onResult }) {
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [phase, setPhase] = useState('bet'); // bet | player | done
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [bet, setBet] = useState(0);
  const [outcome, setOutcome] = useState(null);
  // одна перетасованная колода на раздачу: тянем по очереди, без возврата и
  // без повторной перетасовки внутри того же раунда
  const shoeRef = React.useRef([]);
  const draw = () => shoeRef.current.pop();
  const resolve = (p, d, b) => {
    const pv = handValue(p); const dv = handValue(d);
    const pBJ = pv === 21 && p.length === 2; const dBJ = dv === 21 && d.length === 2;
    let net; let text;
    if (pv > 21) { net = -b; text = 'Перебор — вы проиграли.'; }
    else if (pBJ && !dBJ) { net = b * 1.5; text = 'Блэкджек! Выплата 3:2.'; }
    else if (dBJ && !pBJ) { net = -b; text = 'Блэкджек у дилера.'; }
    else if (dv > 21) { net = b; text = 'Дилер перебрал — вы выиграли.'; }
    else if (pv > dv) { net = b; text = 'Вы выиграли.'; }
    else if (pv < dv) { net = -b; text = 'Дилер выиграл.'; }
    else { net = 0; text = 'Ничья — ставка возвращена.'; }
    onResult(net);
    Audio.play(net > 0 ? 'coin' : net < 0 ? 'click' : 'tick');
    setDealer(d); setOutcome({ text, net }); setPhase('done');
  };
  const deal = () => {
    const b = clamp(amount, 0.01, cash);
    if (b <= 0) return;
    shoeRef.current = shuffledDeck();
    const p = [draw(), draw()]; const d = [draw(), draw()];
    setPlayer(p); setDealer(d); setBet(b); setOutcome(null);
    Audio.play('tick');
    if (handValue(p) === 21 || handValue(d) === 21) resolve(p, d, b);
    else setPhase('player');
  };
  const hit = () => {
    const p = [...player, draw()];
    setPlayer(p); Audio.play('tick');
    if (handValue(p) > 21) resolve(p, dealer, bet);
  };
  const stand = () => {
    let d = [...dealer];
    while (handValue(d) < 17) d = [...d, draw()];
    resolve(player, d, bet);
  };
  const again = () => { setPhase('bet'); setPlayer([]); setDealer([]); setOutcome(null); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        {phase === 'bet' ? (
          <>
            <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
            <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={cash <= 0} onClick={deal}>Сдать карты</button>
          </>
        ) : phase === 'player' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ems-btn" style={{ flex: 1, padding: '10px 0' }} onClick={hit}>Ещё карту</button>
            <button className="ems-btn primary" style={{ flex: 1, padding: '10px 0' }} onClick={stand}>Хватит</button>
          </div>
        ) : (
          <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} onClick={again}>Ещё раз</button>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>Дилер {phase !== 'bet' && phase !== 'player' && `— ${handValue(dealer)}`}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {dealer.map((c, i) => {
            const hidden = phase === 'player' && i === 1;
            return <Card key={i} c={c} hidden={hidden} dealIndex={i} className={!hidden && phase === 'done' && i === 1 ? 'ems-card-flip' : ''} />;
          })}
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>Вы {player.length > 0 && `— ${handValue(player)}`}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {player.map((c, i) => (<Card key={i} c={c} dealIndex={i} />))}
        </div>
        {outcome && (
          <div style={{ marginTop: 10, fontSize: 12, color: COLOR.muted }}>{outcome.text}</div>
        )}
        <div className={outcome ? (outcome.net > 0 ? 'ems-win-pulse' : outcome.net < 0 ? 'ems-lose-pulse' : '') : ''} style={{ borderRadius: 8 }}>
          <CasinoResult net={outcome ? outcome.net : null} />
        </div>
      </div>
    </div>
  );
}

function BinaryOptionGame({ cash, onResult }) {
  const [instrId, setInstrId] = useState('eq_broad');
  const [dir, setDir] = useState('up');
  const [amount, setAmount] = useState(Math.min(1, cash));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [path, setPath] = useState([50]);
  const tickRef = React.useRef(null);
  React.useEffect(() => () => clearInterval(tickRef.current), []);
  const play = () => {
    const bet = clamp(amount, 0.01, cash);
    if (bet <= 0 || busy) return;
    setBusy(true); setRes(null); setPath([50]); Audio.play('tick');
    const up = Math.random() < 0.5;
    const win = (dir === 'up' && up) || (dir === 'down' && !up);
    const net = win ? bet * 0.85 : -bet;
    // «живой» тик котировки — тянет к итоговому направлению, но с шумом,
    // а не прямая линия, чтобы разрешение пари не выглядело предрешённым сразу
    const drift = up ? 1.7 : -1.7;
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setPath((prev) => [...prev, clamp(prev[prev.length - 1] + drift + (Math.random() - 0.5) * 5.5, 4, 96)].slice(-26));
    }, 90);
    setTimeout(() => {
      clearInterval(tickRef.current);
      onResult(net);
      Audio.play(win ? 'coin' : 'click');
      setRes({ up, win, net });
      setBusy(false);
    }, 1450);
  };
  const instr = INSTR_BY_ID[instrId];
  const lineColor = busy ? COLOR.gold : res ? (res.win ? COLOR.teal : COLOR.rust) : COLOR.faint;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 26 }} className="ems-casino-grid">
      <div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 5 }}>Инструмент</div>
        <select value={instrId} onChange={(e) => setInstrId(e.target.value)}
          style={{ width: '100%', padding: '7px 9px', fontSize: 12, marginBottom: 10, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }}>
          {INSTRUMENTS.filter((i) => i.kind === 'spot').map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
        </select>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', background: dir === 'up' ? COLOR.tealDim : COLOR.panelAlt, borderColor: dir === 'up' ? COLOR.teal : COLOR.border, color: dir === 'up' ? COLOR.teal : COLOR.text }}
            onClick={() => setDir('up')}><ArrowUpRight size={13} style={{ verticalAlign: -2 }} /> Вверх</button>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', background: dir === 'down' ? COLOR.rustDim : COLOR.panelAlt, borderColor: dir === 'down' ? COLOR.rust : COLOR.border, color: dir === 'down' ? COLOR.rust : COLOR.text }}
            onClick={() => setDir('down')}><ArrowDownRight size={13} style={{ verticalAlign: -2 }} /> Вниз</button>
        </div>
        <CasinoBet amount={amount} setAmount={setAmount} cash={cash} />
        <button className="ems-btn primary" style={{ width: '100%', padding: '10px 0' }} disabled={busy || cash <= 0} onClick={play}>
          {busy ? 'Идёт торг…' : 'Заключить пари'}
        </button>
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 9 }}>Выплата 1.85× ставки при угадывании направления {instr ? instr.name.toLowerCase() : ''} — без плеча, без комиссии, чистое пари на монетку.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
        <div className={res && !busy ? (res.win ? 'ems-win-pulse' : 'ems-lose-pulse') : ''} style={{ width: '100%', maxWidth: 480, borderRadius: 10, padding: 8 }}>
          <svg width="100%" height="150" viewBox="0 0 100 90" preserveAspectRatio="none" style={{ display: 'block' }}>
            <line x1="0" y1="45" x2="100" y2="45" stroke={COLOR.hairline} strokeWidth="0.6" strokeDasharray="2,2" />
            <polyline points={path.map((v, i) => `${(i / Math.max(1, path.length - 1)) * 100},${90 - (v / 100) * 90}`).join(' ')}
              fill="none" stroke={lineColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        {res && !busy && (
          <div className="ems-coin-pop" style={{ marginTop: 4, fontSize: 12, color: COLOR.muted }}>
            {res.up ? <ArrowUpRight size={13} color={COLOR.teal} style={{ verticalAlign: -2 }} /> : <ArrowDownRight size={13} color={COLOR.rust} style={{ verticalAlign: -2 }} />} Рынок пошёл {res.up ? 'вверх' : 'вниз'} — {res.win ? 'вы угадали' : 'вы не угадали'}
          </div>
        )}
        <CasinoResult net={busy ? null : res ? res.net : null} />
      </div>
    </div>
  );
}

export function CasinoScreen({ book, onCasino }) {
  const [game, setGame] = useState('roulette');
  const cash = Math.max(0, book.cash);
  return (
      <div className="ems-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center', padding: '9px 13px',
          borderBottom: `1px solid ${COLOR.border}`, background: COLOR.panelAlt }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Dices size={13} color={COLOR.gold} />
            <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Казино</span>
          </span>
          <span style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'baseline' }}>
            <span style={{ color: COLOR.muted }}>Свободные деньги</span><span className="ems-mono" style={{ color: cash < 0.01 ? COLOR.rust : COLOR.text }}>{fmtMln(cash)}</span>
          </span>
          <span style={{ fontSize: 12, color: COLOR.faint, marginLeft: 'auto' }}>
            Матожидание отрицательное — это развлечение, а не стратегия
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '9px 13px', borderBottom: `1px solid ${COLOR.border}` }}>
          {CASINO_GAMES.map((g) => (
            <button type="button" key={g.id} className={`ems-tab ${game === g.id ? 'active' : ''}`} aria-pressed={game === g.id} style={{ padding: '5px 10px', fontSize: 12 }}
              onClick={() => { Audio.play('tab'); setGame(g.id); }}>{g.icon} {g.label}</button>
          ))}
        </div>
        {/* лёгкий зелёный отблеск поверх ФОНА ТЕМЫ, а не сплошной сукно-зелёный:
            текст внутри игр по-прежнему берёт цвета из COLOR.* — если сделать
            стол по-настоящему тёмным, он ломает контраст на светлой теме */}
        <div style={{ padding: 24, borderTop: `2px solid ${COLOR.gold}`,
          background: `radial-gradient(ellipse 480px 220px at 50% -10%, rgba(31,122,77,0.16) 0%, rgba(31,122,77,0) 62%), ${COLOR.panel}` }}>
          {cash <= 0 && (
            <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 12 }}>Свободных денег нет — освободите средства из позиций на «Рынке», чтобы сделать ставку.</div>
          )}
          {game === 'roulette' && <RouletteGame cash={cash} onResult={onCasino} />}
          {game === 'slots' && <SlotsGame cash={cash} onResult={onCasino} />}
          {game === 'dice' && <DiceGame cash={cash} onResult={onCasino} />}
          {game === 'blackjack' && <BlackjackGame cash={cash} onResult={onCasino} />}
          {game === 'binary' && <BinaryOptionGame cash={cash} onResult={onCasino} />}
        </div>
      </div>
  );
}
