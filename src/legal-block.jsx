/* Блок «Оператор и контакты» и знак возрастной маркировки — общий для страниц «Данные и конфиденциальность» и
   «Пользовательское соглашение». Значения — src/legal.js (пока заглушки). */
import React from 'react';
import { OPERATOR, AGE_RATING, operatorFilled } from './legal.js';

export function OperatorBlock() {
  const ready = operatorFilled();
  return (
    <section style={{ margin: '14px 0' }} data-testid="operator">
      <h2 className="ds-h3" style={{ margin: '0 0 6px' }}>Оператор и контакты</h2>
      {!ready && <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.5 }}>Данные оператора будут указаны здесь.</p>}
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.5 }}>
        <li style={{ margin: '4px 0' }}>Оператор: {OPERATOR.name}</li>
        <li style={{ margin: '4px 0' }}>Адрес для обращений: {OPERATOR.address}</li>
        <li style={{ margin: '4px 0' }}>E-mail: {OPERATOR.email}</li>
      </ul>
    </section>
  );
}
export const AgeRating = () => <span className="ds-faint" data-testid="age-rating" style={{ fontSize: 13 }}>Возрастная маркировка: {AGE_RATING}</span>;
