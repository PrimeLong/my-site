/* Элементы управления компанией: ползунок решения, переключатель, строка отчёта
   и маленький график. Родились в первой версии предпринимателя (решения на квартал),
   теперь ими собрана вкладка «Финансы» в тайкуне «Своё дело» (src/tycoon.jsx).
   Модель финансов и связь с макроэкономикой — в src/lib/business.js. */
import React from 'react';
import { COLOR, Audio } from './MacroSimulator.jsx';

export function PlanSlider({ label, hint, value, min, max, step, onChange, format, disabled }) {
  const p = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const track = { background: `linear-gradient(90deg, ${COLOR.gold} 0%, ${COLOR.gold} ${p}%, ${COLOR.border} ${p}%, ${COLOR.border} 100%)` };
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12.5 }}>{label}</span>
        <span className="ems-mono" style={{ fontSize: 12.5, color: COLOR.goldSoft, fontWeight: 600 }}>{format(value)}</span>
      </div>
      {hint && <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 1, lineHeight: 1.4 }}>{hint}</div>}
      <input type="range" className="ems-slider" style={{ ...track, width: '100%', marginTop: 7 }} min={min} max={max} step={step}
        value={value} disabled={disabled} aria-label={`${label}: ${format(value)}`}
        onChange={(e) => { Audio.play('tick'); onChange(parseFloat(e.target.value)); }} />
    </div>
  );
}

export function Toggle({ on, onClick, icon: Icon, label, hint, disabled }) {
  return (
    <button className="ems-btn" disabled={disabled} aria-pressed={on} onClick={() => { Audio.play('click'); onClick(); }}
      style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 10px', marginTop: 8,
        borderColor: on ? COLOR.gold : COLOR.border, background: on ? COLOR.goldDim : COLOR.panelAlt }}>
      <Icon size={14} color={on ? COLOR.gold : COLOR.muted} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, color: on ? COLOR.goldSoft : COLOR.text }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: COLOR.faint, marginTop: 2, lineHeight: 1.4 }}>{hint}</span>
      </span>
    </button>
  );
}

export function Row({ k, v, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
      <span style={{ color: COLOR.muted }}>{k}</span>
      <span className="ems-mono" style={{ color: color || COLOR.text, fontWeight: strong ? 600 : 400 }}>{v}</span>
    </div>
  );
}

// график без осей: только форма ряда — рост или спад заметен сразу
export function MiniSpark({ series, color, height = 34 }) {
  if (!series || series.length < 2) return null;
  const w = 100;
  const min = Math.min(...series); const max = Math.max(...series); const span = max - min || 1;
  const pts = series.map((v, i) => `${((i / (series.length - 1)) * w).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity={0.14} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
