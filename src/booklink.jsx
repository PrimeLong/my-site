/* «Подробнее в учебнике» из партии. Корень приложения кладёт в контекст функцию, которая
   открывает учебник поверх партии (партия не размонтируется) и возвращает обратно; вне
   партии контекста нет — и кнопки нет. */
import React, { useContext } from 'react';
import { BookOpenText } from 'lucide-react';
import { COLOR, Audio } from './MacroSimulator.jsx';
import { BookLinkContext } from './booklink-context.js';


export function BookLink({ to, compact = false }) {
  const open = useContext(BookLinkContext);
  if (!open || !to) return null;
  return (
    <button type="button" className="ems-btn ghost" data-testid="book-link" title={to.label}
      style={{ padding: compact ? '2px 6px' : '4px 9px', fontSize: 12, color: COLOR.goldSoft, display: 'inline-flex', alignItems: 'center', gap: 5 }}
      onClick={(e) => { e.stopPropagation(); Audio.play('click'); open({ kind: 'chapter', id: to.chapter, anchor: to.anchor }); }}>
      <BookOpenText size={12} />{compact ? to.label : <>Подробнее в учебнике: {to.label}</>}
    </button>
  );
}
