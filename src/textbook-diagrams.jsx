/* Схемы-иллюстрации учебника: кругооборот доходов и расходов и балансы банков по шагам.
   Числа — src/textbook/diagrams.js; здесь только рисунок. Едут в чанке учебника. */
import React, { useId, useState } from 'react';
import { COLOR, Audio } from './MacroSimulator.jsx';
import { circularFlow, balanceSteps } from './textbook/diagrams.js';

const num = (v) => String(v).replace('.', ',');

/* КРУГООБОРОТ. Фирмы сверху, домохозяйства снизу. Внутреннее кольцо — деньги (расходы
   идут к фирмам слева, доходы к семьям справа), внешнее пунктирное — товары и труд.
   Переключатель показывает, где измеряет ВВП каждый из трёх способов. */
const MODES = [
  { id: 'spend', label: 'По расходам' },
  { id: 'value', label: 'По добавленной стоимости' },
  { id: 'income', label: 'По доходам' },
];
export function CircularFlow({ total = 1000 }) {
  const f = circularFlow(total);
  const [mode, setMode] = useState('spend');
  const uid = useId().replace(/:/g, '');
  const on = (m) => mode === m;
  const money = (m) => ({ stroke: on(m) ? COLOR.gold : COLOR.goldSoft, strokeWidth: on(m) ? 3.2 : 1.6, opacity: on(m) ? 1 : 0.55 });
  const real = { stroke: COLOR.blue, strokeWidth: 1.4, strokeDasharray: '5 4', opacity: 0.8, fill: 'none' };
  const box = (y, label, hl) => (
    <g>
      <rect x={100} y={y} width={140} height={42} rx={3} fill={COLOR.panel} stroke={hl ? COLOR.gold : COLOR.border} strokeWidth={hl ? 2.6 : 1} />
      <text x={170} y={y + 26} textAnchor="middle" fontSize={14} fill={COLOR.text} fontFamily="'PT Serif', Georgia, serif">{label}</text>
    </g>
  );
  const vaSum = f.valueAdded.map(([, v]) => v).join(' + ');
  const note = {
    spend: <>Считаем на рынке товаров: сколько потратили на конечные товары и услуги — <b>{total}</b>.</>,
    value: <>Считаем в фирмах: выручка минус покупки у других фирм — {f.valueAdded.map(([w, v]) => `${w} ${v}`).join(', ')}: {vaSum} = <b>{total}</b>.</>,
    income: <>Считаем у получателей денег: {f.incomes.map(([w, v]) => `${w} ${v}`).join(', ')} — вместе <b>{total}</b>.</>,
  }[mode];
  return (
    <div data-testid="tb-diagram" data-diagram="circular">
      <svg viewBox="0 0 340 250" width="100%" style={{ maxWidth: 460, display: 'block', margin: '0 auto' }} role="img"
        aria-label={`Кругооборот: расходы ${total} идут к фирмам, доходы ${total} — к домохозяйствам`}>
        <defs>
          <marker id={`m-g-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={COLOR.gold} /></marker>
          <marker id={`m-b-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={COLOR.blue} /></marker>
        </defs>
        {/* внешнее кольцо: товары и услуги — к семьям, труд и капитал — к фирмам */}
        <path d="M100,26 L22,26 L22,224 L96,224" {...real} markerEnd={`url(#m-b-${uid})`} />
        <path d="M240,224 L318,224 L318,26 L244,26" {...real} markerEnd={`url(#m-b-${uid})`} />
        <text transform="translate(15,125) rotate(-90)" textAnchor="middle" fontSize={12} fill={COLOR.blue}>товары и услуги</text>
        <text transform="translate(326,125) rotate(90)" textAnchor="middle" fontSize={12} fill={COLOR.blue}>труд и капитал</text>
        {/* внутреннее кольцо: деньги */}
        <path d="M100,212 L62,212 L62,40 L96,40" fill="none" {...money('spend')} markerEnd={`url(#m-g-${uid})`} />
        <path d="M240,40 L278,40 L278,212 L244,212" fill="none" {...money('income')} markerEnd={`url(#m-g-${uid})`} />
        <g opacity={on('spend') ? 1 : 0.7}>
          <rect x={33} y={108} width={58} height={34} fill={COLOR.panelAlt} stroke={on('spend') ? COLOR.gold : 'none'} />
          <text x={62} y={122} textAnchor="middle" fontSize={12} fill={COLOR.text}>расходы</text>
          <text x={62} y={136} textAnchor="middle" fontSize={12} fill={COLOR.goldSoft} fontWeight={700}>{total}</text>
        </g>
        <g opacity={on('income') ? 1 : 0.7}>
          <rect x={249} y={108} width={58} height={34} fill={COLOR.panelAlt} stroke={on('income') ? COLOR.gold : 'none'} />
          <text x={278} y={122} textAnchor="middle" fontSize={12} fill={COLOR.text}>доходы</text>
          <text x={278} y={136} textAnchor="middle" fontSize={12} fill={COLOR.goldSoft} fontWeight={700}>{total}</text>
        </g>
        {box(6, 'Фирмы', on('value'))}
        {on('value') && <text x={170} y={66} textAnchor="middle" fontSize={12} fill={COLOR.goldSoft}>добавленная стоимость {vaSum}</text>}
        {box(202, 'Домохозяйства', false)}
        <text x={170} y={128} textAnchor="middle" fontSize={12} fill={COLOR.faint}>деньги — сплошные,</text>
        <text x={170} y={142} textAnchor="middle" fontSize={12} fill={COLOR.faint}>товары и труд — пунктир</text>
      </svg>
      <div className="ems-seg" role="group" aria-label="Способ счёта ВВП" style={{ display: 'flex', margin: '8px 0 6px' }}>
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={on(m.id)} style={{ flex: '1 1 0', whiteSpace: 'normal', lineHeight: 1.25, fontSize: 12 }}
            onClick={() => { Audio.play('click'); setMode(m.id); }}>{m.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }} data-testid="tb-diagram-note">{note}</div>
    </div>
  );
}

/* БАЛАНСЫ БАНКОВ. По шагам: вклад → кредит → платёж → второй кредит → итог. Слева в балансе
   активы, справа пассивы, суммы равны; строки, изменившиеся на этом шаге, подсвечены. */
function TAccount({ bank, changed }) {
  const sum = (rows) => rows.reduce((s, [, v]) => s + v, 0);
  const row = ([label, v]) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 4px', background: changed.includes(label) ? 'rgba(200,160,70,.16)' : 'none' }}>
      <span>{label}</span><span className="ems-mono">{num(v)}</span>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${COLOR.border}`, background: COLOR.panel, flex: '1 1 240px', minWidth: 0 }} data-testid="tb-bank">
      <div className="ems-serif" style={{ textAlign: 'center', fontSize: 14, padding: '5px 0', borderBottom: `1px solid ${COLOR.border}`, color: COLOR.goldSoft }}>{bank.name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 12.5 }}>
        <div style={{ borderRight: `1px solid ${COLOR.border}`, padding: 4 }}>
          <div style={{ fontSize: 12, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Активы</div>
          {bank.assets.map(row)}
        </div>
        <div style={{ padding: 4 }}>
          <div style={{ fontSize: 12, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Пассивы</div>
          {bank.liab.map(row)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 12, borderTop: `1px solid ${COLOR.border}`, color: COLOR.muted }}>
        <span style={{ padding: '2px 8px', borderRight: `1px solid ${COLOR.border}` }}>итого {num(sum(bank.assets))}</span>
        <span style={{ padding: '2px 8px' }}>итого {num(sum(bank.liab))}</span>
      </div>
    </div>
  );
}
export function BalanceSheets({ base = 1000, rr = 0.1 }) {
  const steps = balanceSteps(base, rr);
  const [k, setK] = useState(0);
  const s = steps[k];
  return (
    <div data-testid="tb-diagram" data-diagram="balance">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }} role="group" aria-label="Шаг">
        {steps.map((st, i) => (
          <button key={st.no} type="button" className="tb-pick" aria-pressed={i === k} onClick={() => { Audio.play('tick'); setK(i); }}>{st.no}. {st.title}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {s.banks.map((b) => <TAccount key={b.name} bank={b} changed={s.changed} />)}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, margin: '8px 0 4px' }} data-testid="tb-diagram-note">{s.text}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }} data-testid="tb-money">Денежная масса (наличные + вклады): <b className="ems-mono">{num(s.money)}</b></span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" className="ems-btn" style={{ padding: '5px 11px', fontSize: 12 }} disabled={k === 0} onClick={() => { Audio.play('click'); setK(k - 1); }}>Назад</button>
          <button type="button" className="ems-btn primary" style={{ padding: '5px 11px', fontSize: 12 }} disabled={k === steps.length - 1} onClick={() => { Audio.play('click'); setK(k + 1); }}>Дальше</button>
        </span>
      </div>
    </div>
  );
}
