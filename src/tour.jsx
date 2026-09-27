/* Обучение по экрану партии: пошаговая экскурсия поверх настоящего интерфейса.
   Ничего не прячет и не упрощает — ползунки, графики, таблица и риски на месте с
   первого квартала, просто по очереди подсвечивается, что где и зачем. Включается
   галочкой при создании партии (для тех, кто играет впервые, она стоит сама), а
   повторить можно из меню «⋯» в любой момент.

   Шаг — { target, title, text, col }: target — значение data-tour у элемента,
   col — какую колонку открыть на телефоне, чтобы элемент был виден. Не нашёлся
   элемент (у роли нет такого блока) — шаг показывается карточкой по центру. */
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { COLOR, Audio } from './MacroSimulator.jsx';

const findTarget = (id) => {
  if (!id) return null;
  const list = [...document.querySelectorAll(`[data-tour="${id}"]`)];
  // видимый: у скрытой колонки (display:none) нет размеров
  return list.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
};

export function GameTour({ role, goalLabel, onClose, onStep }) {
  const [steps] = useState(() => tourSteps({ role, goalLabel }));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // открыть нужную колонку/экран и доскроллить до элемента
  useLayoutEffect(() => { if (onStep) onStep(step); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let stop = false; let tries = 0; let raf = 0;
    setRect(null);
    const locate = () => {
      if (stop) return;
      const el = findTarget(step.target);
      if (!el) { if (step.target && tries++ < 20) raf = requestAnimationFrame(locate); return; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    raf = requestAnimationFrame(locate);
    // позиция подсветки — пока идёт плавная прокрутка и при изменении окна
    const track = setInterval(() => {
      const el = findTarget(step.target);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect((p) => (p && Math.abs(p.top - r.top) < 1 && Math.abs(p.left - r.left) < 1 && Math.abs(p.width - r.width) < 1 && Math.abs(p.height - r.height) < 1
        ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
    }, 120);
    return () => { stop = true; cancelAnimationFrame(raf); clearInterval(track); };
  }, [i, step.target]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (last) onClose(); else setI((x) => x + 1); }
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const narrow = vw < 640;
  const pad = 6;
  const hl = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  // карточка — под элементом, если снизу есть место, иначе над ним; на телефоне — внизу экрана
  const cardW = Math.min(360, vw - 24);
  let cardPos;
  if (!hl || narrow) cardPos = narrow ? { left: 12, right: 12, bottom: 12 } : { left: (vw - cardW) / 2, top: Math.max(24, vh / 2 - 120) };
  else {
    const below = hl.top + hl.height + 12;
    const above = hl.top - 244;
    if (below + 232 < vh) cardPos = { top: below, left: Math.min(Math.max(12, hl.left), vw - cardW - 12), width: cardW };
    else if (above > 12) cardPos = { top: above, left: Math.min(Math.max(12, hl.left), vw - cardW - 12), width: cardW };
    // высокий блок (колонка ползунков): карточка сбоку, чтобы не закрывать его верх
    else if (vw - (hl.left + hl.width) > cardW + 24) cardPos = { top: Math.max(12, Math.min(hl.top, vh - 260)), left: hl.left + hl.width + 12, width: cardW };
    else if (hl.left > cardW + 24) cardPos = { top: Math.max(12, Math.min(hl.top, vh - 260)), left: hl.left - cardW - 12, width: cardW };
    else cardPos = { left: (vw - cardW) / 2, bottom: 12, width: cardW };
  }
  const next = () => { Audio.play('tick'); if (last) onClose(); else setI(i + 1); };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Обучение: ${step.title}`} style={{ position: 'fixed', inset: 0, zIndex: 120 }}>
      {/* затемнение с «окном» над подсвеченным блоком; без цели — просто затемнение */}
      <div style={{ position: 'fixed', inset: 0 }} onClick={(e) => e.stopPropagation()} />
      {hl ? (
        <div style={{ position: 'fixed', ...hl, borderRadius: 12, border: `2px solid ${COLOR.gold}`,
          boxShadow: '0 0 0 9999px rgba(6,9,14,0.62)', pointerEvents: 'none', transition: 'top .2s, left .2s, width .2s, height .2s' }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.62)', pointerEvents: 'none' }} />
      )}
      <div className="ems-panel-raised" style={{ position: 'fixed', ...cardPos, maxWidth: cardW, padding: '14px 16px', borderColor: COLOR.gold,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <GraduationCap size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, flex: 1 }}>{step.title}</span>
          <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{i + 1}/{steps.length}</span>
          <button className="ems-btn ghost" aria-label="Закрыть обучение" onClick={onClose} style={{ padding: 3, lineHeight: 0 }}><X size={14} /></button>
        </div>
        <div style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.55 }}>{step.text}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button className="ems-btn ghost" style={{ fontSize: 12, padding: '5px 8px' }} onClick={onClose}>{last ? 'Закрыть' : 'Пропустить'}</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="ems-btn" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { Audio.play('tick'); setI(i - 1); }}>Назад</button>}
          <button className="ems-btn primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={next}>{last ? 'Понятно, играть' : 'Далее'}</button>
        </div>
      </div>
    </div>
  );
}

const MAIN_LEVER = {
  central_bank: 'Начните с одного — ключевой ставки: она дороже или дешевле делает кредит, а через него — спрос и цены. Остальные рычаги подключайте, когда освоитесь.',
  ministry_finance: 'Начните с одного-двух: госрасходы и НДС. Расходы разгоняют спрос, налоги его сдерживают и наполняют бюджет. Остальное подключайте, когда освоитесь.',
  full_control: 'Здесь и ставка ЦБ, и бюджет. Для начала хватит ключевой ставки и госрасходов — остальные рычаги подключайте по мере освоения.',
};

// шаги для роли: что где на экране и зачем
export function tourSteps({ role, goalLabel }) {
  const lever = role === 'president'
    ? { target: 'left', col: 'left', title: 'Ваши полномочия',
      text: 'У президента нет ползунков. Вы тратите политический капитал: даёте указания ЦБ и Минфину, запускаете реформы, меняете кадры и ведёте внешнюю политику. Капитал копится от рейтинга и роста.' }
    : role === 'trader'
      ? { target: 'left', col: 'left', title: 'Ваш капитал',
        text: 'Здесь портфель и его стоимость. Сама торговля — на вкладке «Рынок»: цены там меняются в реальном времени, а экономика страны двигает их квартал за кварталом.' }
      : { target: 'levers', col: 'left', title: 'Ваши рычаги',
        text: `Каждый ползунок — решение на этот квартал. Под ним видно, кому из групп общества оно понравится и как отзовётся в экономике, а кнопка «реакция» покажет прогноз. ${MAIN_LEVER[role] || ''}` };
  return [
    { title: 'Первая партия', text: 'Коротко пройдёмся по экрану — все инструменты уже на месте, ничего не спрятано. Можно пропустить в любой момент, а повторить — в меню «⋯» → «Обучение по экрану».' },
    { target: 'status', title: 'Период, выборы и благополучие', text: 'Сколько кварталов до выборов и какой рейтинг у власти. Шкала справа — благополучие: сводная оценка жизни в стране. Провалите рейтинг к выборам — партия может закончиться досрочно.' },
    { target: 'kpi', title: 'Главные показатели', text: 'Цифра — значение сейчас, стрелка — изменение за квартал, линия — последние два года. Набор можно менять: звёздочкой в таблице показателей, порядок — перетаскиванием.' },
    lever,
    { target: 'request', col: 'left', title: 'Соседнее ведомство', text: 'Другую ветвь политики ведёт бот со своим характером. Его можно попросить о чём-то — он согласится, частично пойдёт навстречу или откажет, смотря по ситуации.' },
    { target: 'news', col: 'center', title: 'Новости', text: 'Что случилось за квартал и почему. Полный выпуск — в «Газете»: там же хроника страны и сюжетные линии.' },
    { target: 'chart', col: 'center', title: 'График', text: 'В открытой партии слева от старта — три года до вашего прихода, когда страну вели боты: видно, куда шла экономика. Пять главных вкладок видны сразу, остальные — в списке «ещё». Можно включить прогноз на 8 кварталов и сравнить два момента, протянув мышью по графику.' },
    { target: 'scores', col: 'right', title: 'Пять оценок', text: `Из них складывается итог партии. Ваш приоритет — «${goalLabel}»: эта оценка весит больше остальных.` },
    { target: 'table', col: 'right', title: 'Все показатели', text: 'Полная таблица по разделам. Звёздочка у строки закрепляет показатель в верхней полосе.' },
    { target: 'screens', title: 'Другие экраны', text: 'Карта — области, стройки, выборы и соседние страны. Общество — группы и их требования. Рынок — цены активов. Сюда стоит заглядывать, когда что-то происходит в регионах.' },
    { target: 'finish', title: 'Завершить квартал', text: 'Когда решения готовы — завершите квартал. Решения применятся, боты ответят своими, выйдет газета с итогами. Удачи!' },
  ];
}
