/* Печать режима — знак политического режима страны в «Мире» (газета, партия, сетевая партия). Отдельным
   модулем: справочник режимов (src/lib/catalog.js) не нужен на приветствии и в обучении. */
import React from 'react';
import { POLITICAL_REGIME_INFO } from './lib/catalog.js';
import { COLOR, starPath } from './MacroSimulator.jsx';

/* Государственная печать — единственный сквозной визуальный образ страны:
   не карта и не герб конкретного государства (их у безымянной страны панели
   нет и не может быть), а абстрактная эмблема власти, которая грубеет вместе
   с политическим режимом — то же самое, что уже делает газета своим тоном,
   но как знак, а не текст. Democracy: тонкие линии, разомкнутые насечки,
   контурная звезда. Totalitarian: двойное кольцо, сплошные насечки-клинья,
   залитая звезда. Один компонент на все режимы — только веса и заливки
   разные, чтобы получить не четыре разных значка, а один и тот же символ,
   который явно тяжелеет. */
export function StateSeal({ regime = 'democracy', size = 40, title }) {
  const info = POLITICAL_REGIME_INFO[regime] || POLITICAL_REGIME_INFO.democracy;
  const color = COLOR[info.color] || COLOR.gold;
  const hard = regime === 'authoritarian' || regime === 'totalitarian';
  const heavy = regime === 'totalitarian';
  const cx = 50; const cy = 50;
  const rOuter = 46; const rInner = hard ? 34 : 37;
  const tickInner = hard ? 38 : 40.5; const tickOuter = 45;
  const ticks = 16;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title || info.label} style={{ flexShrink: 0 }}>
      {heavy && <circle cx={cx} cy={cy} r={rOuter - 4.5} fill="none" stroke={color} strokeWidth={1.3} opacity={0.65} />}
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={color} strokeWidth={hard ? 3 : 1.6} />
      {Array.from({ length: ticks }).map((_, i) => {
        const a = (i / ticks) * Math.PI * 2;
        return (
          <line key={i} x1={(cx + Math.cos(a) * tickInner).toFixed(2)} y1={(cy + Math.sin(a) * tickInner).toFixed(2)}
            x2={(cx + Math.cos(a) * tickOuter).toFixed(2)} y2={(cy + Math.sin(a) * tickOuter).toFixed(2)}
            stroke={color} strokeWidth={hard ? 3.2 : 1.2} strokeLinecap={hard ? 'square' : 'round'} opacity={hard ? 0.9 : 0.55} />
        );
      })}
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={color} strokeWidth={hard ? 2.4 : 1.3} />
      <path d={starPath(cx, cy, hard ? 21 : 18, hard ? 9.5 : 7.5)} fill={hard ? color : 'none'} stroke={color} strokeWidth={hard ? 0 : 1.5} strokeLinejoin="round" />
    </svg>
  );
}
