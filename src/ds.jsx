/* ДИЗАЙН-СИСТЕМА ОБУЧЕНИЯ — ядро: переменные темы, классы и общие компоненты. Все экраны
   обучения (Путь, карточка урока, уроки всех видов, итоги, справочник, профиль, практика,
   вызов дня, вход и регистрация) и тёмный «Мир» собираются только из этого и из
   src/ds-art.jsx (гравюры, гильош, печати, марки, график прогресса, Инфля).

   Язык — деньги и печать. Кнопка — тиснёный билет: вырезы по бокам, перфорация внутри,
   нажатие вдавливает. Карточка — документ с двойной линейкой. Плашка ответа — оттиск
   штампа. Шрифты — PT Serif (заголовки и кнопки), PT Sans (текст), PT Mono (числа).
   Ядро лёгкое и едет в стартовом файле (нижняя панель, «Мир»); иллюстрации — отдельно. */
import React from 'react';
import { DS_THEMES, tokenVars, worldTokens } from './ds-tokens.js';

export const DS_CSS = `
  .ds { background: var(--ds-paper); color: var(--ds-ink); font-family: var(--ds-sans); font-size: 16px; line-height: 1.5; -webkit-tap-highlight-color: transparent; --u-ink: var(--u); }
  .ds.ds-dark { --u-ink: color-mix(in srgb, var(--u) 42%, #fff); }
  .ds *, .ds *::before, .ds *::after { box-sizing: border-box; }
  .ds-page { min-height: 100vh; background-color: var(--ds-paper);
    background-image: radial-gradient(ellipse 120% 60% at 50% 0%, color-mix(in srgb, var(--ds-card) 70%, transparent), transparent 70%); }
  .ds :focus-visible { outline: 3px solid var(--ds-sel-rule); outline-offset: 2px; }

  /* типографика */
  .ds-h1 { font-family: var(--ds-serif); font-weight: 700; font-size: 28px; line-height: 1.15; margin: 0; letter-spacing: -.005em; }
  .ds-h2 { font-family: var(--ds-serif); font-weight: 700; font-size: 22px; line-height: 1.2; margin: 0; }
  .ds-h3 { font-family: var(--ds-serif); font-weight: 700; font-size: 18px; line-height: 1.25; margin: 0; }
  .ds-eyebrow { font: 700 12px/1.3 var(--ds-sans); letter-spacing: .14em; text-transform: uppercase; color: var(--u-ink); }
  .ds-sub { color: var(--ds-ink2); }
  .ds-faint { color: var(--ds-ink3); }
  .ds-num { font-family: var(--ds-mono); font-variant-numeric: tabular-nums; }
  .ds-text { font-size: 17px; line-height: 1.55; }
  .ds-text p { margin: 0 0 10px; }
  .ds-rule { border: none; border-top: 1px solid var(--ds-rule); margin: 12px 0; }

  /* кнопка — тиснёный билет */
  .ds-btn { --b: var(--u); position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 12px 24px;
    border: none; border-radius: 3px; font: 700 15px/1.2 var(--ds-serif); letter-spacing: .07em; text-transform: uppercase; color: #fff; background: var(--b); cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.22), 0 1px 0 var(--ds-shade), 0 3px 8px var(--ds-shade);
    -webkit-mask: radial-gradient(circle 8px at 0 50%, transparent 7.5px, #000 8px) left / 51% 100% no-repeat, radial-gradient(circle 8px at 100% 50%, transparent 7.5px, #000 8px) right / 51% 100% no-repeat;
    mask: radial-gradient(circle 8px at 0 50%, transparent 7.5px, #000 8px) left / 51% 100% no-repeat, radial-gradient(circle 8px at 100% 50%, transparent 7.5px, #000 8px) right / 51% 100% no-repeat;
    transition: transform .08s ease, box-shadow .08s ease, filter .15s; }
  .ds-btn::after { content: ''; position: absolute; inset: 5px 14px; border: 1px dashed rgba(255,255,255,.55); border-radius: 2px; pointer-events: none; }
  .ds-btn:hover:not(:disabled) { filter: brightness(1.07); }
  .ds-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 2px 6px rgba(0,0,0,.38), inset 0 0 0 1px rgba(0,0,0,.3); }
  .ds-btn:focus-visible { -webkit-mask: none; mask: none; }
  /* «Мир»: основная кнопка — золото тёмной темы, на нём белый текст не читается — тёмная тушь */
  .ds[data-ds-theme="world"] .ds-btn:not(.ds-btn--secondary):not(.ds-btn--ghost):not(.ds-btn--ok):not(.ds-btn--bad):not(:disabled) { color: #1B1204; }
  .ds[data-ds-theme="world"] .ds-btn:not(.ds-btn--secondary):not(.ds-btn--ghost):not(.ds-btn--ok):not(.ds-btn--bad)::after { border-color: rgba(27,18,4,.45); }
  .ds-btn:disabled { background: var(--ds-card2); color: var(--ds-ink3); box-shadow: inset 0 0 0 1px var(--ds-rule2); cursor: default; }
  .ds-btn:disabled::after { border-color: var(--ds-rule2); }
  .ds-btn--secondary { background: var(--ds-card); color: var(--u-ink); box-shadow: inset 0 0 0 1.5px var(--u-ink), 0 1px 0 var(--ds-shade); }
  .ds-btn--secondary::after { border-color: color-mix(in srgb, var(--u-ink) 45%, transparent); }
  .ds-btn--ghost { background: none; color: var(--u-ink); box-shadow: none; -webkit-mask: none; mask: none; min-height: 40px; padding: 8px 10px;
    font: 700 15px/1.3 var(--ds-sans); letter-spacing: 0; text-transform: none; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
  .ds-btn--ghost::after { display: none; }
  .ds-btn--ghost:active:not(:disabled) { transform: none; box-shadow: none; }
  .ds-btn--ok { --b: var(--ds-ok-btn); }
  .ds-btn--bad { --b: var(--ds-bad-btn); }
  .ds-btn--wide { width: 100%; }
  .ds-btn--small { min-height: 38px; padding: 7px 16px; font-size: 13px; }
  .ds-btn--small::after { inset: 4px 10px; }
  .ds-icon-btn { background: none; border: none; color: var(--ds-ink2); width: 42px; height: 42px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .ds-icon-btn:hover { background: var(--ds-card2); }

  /* карточка-документ, панель, строки */
  /* текст только для чтения с экрана: подписи к значкам и числам */
  .ds-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .ds-card { background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 6px; padding: 16px;
    box-shadow: inset 0 0 0 3px var(--ds-card), inset 0 0 0 4px var(--ds-rule), 0 1px 2px var(--ds-shade); }
  .ds-card--flat { box-shadow: 0 1px 2px var(--ds-shade); }
  .ds-card--button { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; font: inherit; color: inherit; cursor: pointer; margin: 10px 0; }
  .ds-card--button:active:not(:disabled) { transform: translateY(1px); }
  .ds-card--button:disabled { opacity: .6; cursor: default; }
  .ds-panel { background: var(--ds-card2); border-radius: 6px; padding: 12px 14px; }
  .ds-row { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; padding: 6px 0; border-bottom: 1px dotted var(--ds-rule2); }
  .ds-row:last-child { border-bottom: none; }
  .ds-row > span:first-child { color: var(--ds-ink2); }
  .ds-row > b { font-family: var(--ds-mono); font-weight: 700; }
  .ds-badge { display: inline-flex; align-items: center; gap: 4px; font: 700 12px/1 var(--ds-sans); letter-spacing: .08em; text-transform: uppercase; padding: 4px 7px; border: 1px solid currentColor; border-radius: 2px; color: var(--u-ink); }

  /* варианты ответа, плитки, клавиши */
  .ds-opt { display: block; width: 100%; text-align: left; padding: 13px 14px 13px 16px; margin: 8px 0; font: 16px/1.45 var(--ds-sans); color: var(--ds-ink);
    background: var(--ds-card); border: 1px solid var(--ds-rule2); border-left: 4px solid var(--ds-rule2); border-radius: 3px; cursor: pointer; transition: border-color .12s, background .12s, transform .06s; }
  .ds-opt:active:not(:disabled) { transform: translateY(1px); }
  .ds-opt[aria-pressed="true"] { border-color: var(--ds-sel-rule); border-left-color: var(--u); background: var(--ds-sel); color: var(--ds-sel-ink); }
  .ds-opt.right { border-color: var(--ds-ok); background: var(--ds-ok-bg); color: var(--ds-ink); }
  .ds-opt.wrong { border-color: var(--ds-bad); background: var(--ds-bad-bg); color: var(--ds-ink); }
  .ds-opt:disabled { cursor: default; }
  .ds-chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 44px; padding: 8px 12px; margin: 4px; font: 15px/1.3 var(--ds-sans); color: var(--ds-ink);
    background: var(--ds-card); border: 1px solid var(--ds-rule2); border-bottom-width: 2px; border-radius: 3px; cursor: pointer; }
  .ds-chip[aria-pressed="true"] { border-color: var(--ds-sel-rule); background: var(--ds-sel); color: var(--ds-sel-ink); }
  .ds-chip.right { border-color: var(--ds-ok); }
  .ds-key { padding: 13px 0; font: 20px var(--ds-mono); color: var(--ds-ink); background: var(--ds-card); border: 1px solid var(--ds-rule2); border-bottom-width: 3px; border-radius: 4px; cursor: pointer; }
  .ds-key:active:not(:disabled) { transform: translateY(2px); border-bottom-width: 1px; }

  /* поля и переключатели */
  .ds-field { width: 100%; padding: 12px 14px; font: 16px var(--ds-sans); color: var(--ds-ink); background: var(--ds-card); border: 1px solid var(--ds-rule2); border-bottom: 2px solid var(--ds-ink2); border-radius: 3px 3px 0 0; }
  .ds-field:focus { outline: none; border-bottom-color: var(--u); background: var(--ds-sel); }
  .ds-label { display: block; font: 700 13px/1.3 var(--ds-sans); letter-spacing: .04em; color: var(--ds-ink2); margin-bottom: 14px; }
  .ds-label > input { margin-top: 6px; }
  .ds-toggle { width: 48px; height: 28px; border-radius: 14px; border: 1px solid var(--ds-rule2); background: var(--ds-card2); position: relative; cursor: pointer; flex-shrink: 0; }
  .ds-toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ds-card); border: 1px solid var(--ds-rule2); transition: left .15s; }
  .ds-toggle[aria-checked="true"] { background: var(--u); border-color: var(--u); }
  .ds-toggle[aria-checked="true"]::after { left: 23px; }

  /* плашка ответа — оттиск штампа */
  .ds-answer { padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 2px solid var(--ds-rule2); }
  .ds-answer.ok { background: var(--ds-ok-bg); border-top-color: var(--ds-ok); }
  .ds-answer.bad { background: var(--ds-bad-bg); border-top-color: var(--ds-bad); }
  .ds-answer-stamp { display: inline-block; font: 700 15px/1 var(--ds-serif); letter-spacing: .16em; text-transform: uppercase; padding: 6px 10px 5px; border: 2.5px solid currentColor;
    border-radius: 3px; transform: rotate(-4deg); box-shadow: inset 0 0 0 2px transparent, inset 0 0 0 3px currentColor; }
  .ds-answer.ok .ds-answer-stamp { color: var(--ds-ok-ink); }
  .ds-answer.bad .ds-answer-stamp { color: var(--ds-bad-ink); }
  .ds-answer-say { display: inline-block; font: 700 18px/1.3 var(--ds-serif); animation: ds-stamp .32s ease-out 1 both; }
  /* на светлой плашке ответа — тёмные оттенки «верно/неверно»: контраст не ниже 4,5:1 */
  .ds-answer.ok .ds-answer-say { color: var(--ds-ok-ink); }
  .ds-answer.bad .ds-answer-say { color: var(--ds-bad-ink); }

  /* шторка снизу, верхняя панель, нижняя панель вкладок */
  .ds-sheet-back { position: fixed; inset: 0; z-index: 320; background: rgba(28,20,8,.48); display: flex; align-items: flex-end; justify-content: center; }
  .ds-sheet { width: 100%; max-width: 560px; background: var(--ds-card); border-radius: 12px 12px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
    box-shadow: inset 0 4px 0 var(--ds-card), inset 0 5px 0 var(--ds-rule), 0 -10px 30px rgba(0,0,0,.25); border-top: 1px solid var(--ds-rule2); }
  .ds-topbar { display: flex; align-items: center; gap: 8px; min-height: 52px; }
  .ds-topbar-title { font: 700 17px/1.2 var(--ds-serif); flex: 1; min-width: 0; }
  .ds-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 120; background: var(--ds-card); border-top: 1px solid var(--ds-rule2);
    box-shadow: inset 0 3px 0 var(--ds-card), inset 0 4px 0 var(--ds-rule); padding-bottom: env(safe-area-inset-bottom); }
  .ds-nav-in { display: flex; max-width: 560px; margin: 0 auto; }
  .ds-nav button { flex: 1; min-width: 0; background: none; border: none; cursor: pointer; padding: 10px 2px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: var(--ds-ink3); font: 700 12px/1.1 var(--ds-sans); letter-spacing: .04em; position: relative; }
  .ds-nav button[aria-current="page"] { color: var(--u-ink); cursor: default; }
  @media (max-width: 380px) { .ds-nav button { font-size: 12px; letter-spacing: 0; } }
  .ds-nav button[aria-current="page"]::before { content: ''; position: absolute; top: 5px; width: 30px; height: 3px; border-radius: 1px; background: var(--u-ink); }

  /* короткие анимации по делу */
  @keyframes ds-shake { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 50% { transform: translateX(5px) } 75% { transform: translateX(-3px) } }
  @keyframes ds-rise { 0% { transform: translateY(14px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
  @keyframes ds-stamp { 0% { transform: scale(1.7) rotate(-14deg); opacity: 0 } 60% { transform: scale(.94) rotate(-4deg); opacity: 1 } 100% { transform: scale(1) rotate(-4deg); opacity: 1 } }
  @keyframes ds-flash { 0% { box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--ds-ok) 22%, transparent) } 100% { box-shadow: inset 0 0 0 999px transparent } }
  .ds-shake { animation: ds-shake .36s ease-in-out 1; }
  .ds-rise { animation: ds-rise .22s ease-out 1; }
  .ds-flash { animation: ds-flash .5s ease-out 1; }
  .ds-answer .ds-answer-stamp { animation: ds-stamp .32s ease-out 1 both; }
  @media (prefers-reduced-motion: reduce) {
    .ds, .ds *, .ds *::before, .ds *::after { animation: none !important; transition: none !important; }
  }
`;

export function DsStyle() { return <style>{DS_CSS}</style>; }

/* Корень экрана: тема (paper | ink) или тёмная игровая тема «Мира» (world = COLOR),
   цвет юнита (accent). page — во весь экран с фоном бумаги. */
export function DsRoot({ theme = 'paper', world = null, accent, page = false, className = '', style, children, ...rest }) {
  const t = world ? worldTokens(world) : DS_THEMES[theme] || DS_THEMES.paper;
  return (
    <div className={`ds ${t.isDark ? 'ds-dark' : ''} ${page ? 'ds-page' : ''} ${className}`} style={{ ...tokenVars(t, accent), ...style }} data-ds-theme={world ? 'world' : theme} {...rest}>
      <DsStyle />
      {children}
    </div>
  );
}
// цвет юнита для части экрана: кнопки, подписи, линии внутри берут его
export const Accent = ({ color, children, style, ...rest }) => <div style={{ '--u': color, ...style }} {...rest}>{children}</div>;

const cx = (...list) => list.filter(Boolean).join(' ');
export function Button({ variant = 'primary', wide = false, small = false, icon: Icon = null, className, children, type = 'button', ...rest }) {
  return (
    <button type={type} className={cx('ds-btn', variant !== 'primary' && `ds-btn--${variant}`, wide && 'ds-btn--wide', small && 'ds-btn--small', className)} {...rest}>
      {Icon && <Icon size={small ? 15 : 18} aria-hidden="true" />}{children}
    </button>
  );
}
export function IconButton({ label, icon: Icon, size = 24, className, ...rest }) {
  return <button type="button" className={cx('ds-icon-btn', className)} aria-label={label} {...rest}><Icon size={size} aria-hidden="true" /></button>;
}
export function Card({ flat = false, as: Tag = 'div', className, children, ...rest }) {
  return <Tag className={cx('ds-card', flat && 'ds-card--flat', className)} {...rest}>{children}</Tag>;
}
// карточка-кнопка: значок, заголовок, пояснение, стрелка
export function MenuCard({ icon: Icon, tone, title, text, right = null, className, disabled, ...rest }) {
  return (
    <button type="button" className={cx('ds-card', 'ds-card--button', className)} disabled={disabled} {...rest}>
      {Icon && (
        <span style={{ width: 44, height: 44, borderRadius: 4, background: tone || 'var(--u)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.25)' }}><Icon size={22} aria-hidden="true" /></span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ds-h3" style={{ display: 'block' }}>{title}</span>
        {text && <span className="ds-sub" style={{ fontSize: 14 }}>{text}</span>}
      </span>
      {right}
    </button>
  );
}
export const Panel = ({ className, children, ...rest }) => <div className={cx('ds-panel', className)} {...rest}>{children}</div>;
// заголовок экрана: подпись капителью, заголовок PT Serif, пояснение
export function Heading({ eyebrow, title, sub, level = 1, children, className, ...rest }) {
  const Tag = `h${level}`;
  return (
    <div className={className} {...rest}>
      {eyebrow && <div className="ds-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
      <Tag className={level === 1 ? 'ds-h1' : level === 2 ? 'ds-h2' : 'ds-h3'}>{title}</Tag>
      {sub && <div className="ds-sub" style={{ fontSize: 15, marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
export const Row = ({ label, value, ...rest }) => <div className="ds-row" {...rest}><span>{label}</span><b>{value}</b></div>;
export function Toggle({ on, label, onChange, ...rest }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="ds-toggle" onClick={() => onChange(!on)} {...rest} />;
}
export function Field({ label, ...rest }) {
  return <label className="ds-label">{label}<input className="ds-field" {...rest} /></label>;
}
// плашка ответа: оттиск штампа, заголовок и пояснение
// say — фраза Инфли (src/learn/voice.js) вместо штампа «Верно» / «Не совсем»
export function AnswerBar({ ok, stamp, say = null, children, className, ...rest }) {
  return (
    <div className={cx('ds-answer', ok ? 'ok' : 'bad', className)} {...rest}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {say && !stamp
          ? <span className="ds-answer-say" data-testid="infla-say">{say}</span>
          : <span className="ds-answer-stamp">{stamp || (ok ? 'Верно' : 'Не совсем')}</span>}
        {children}
      </div>
    </div>
  );
}
export function Sheet({ label, onClose, children, testid, ...rest }) {
  return (
    <div className="ds-sheet-back" onClick={onClose} data-testid={testid ? `${testid}-back` : undefined}>
      <div className="ds-sheet ds-rise" role="dialog" aria-label={label} data-testid={testid} onClick={(e) => e.stopPropagation()} {...rest}>{children}</div>
    </div>
  );
}
export function TopBar({ back = null, title, right = null }) {
  return <div className="ds-topbar">{back}{title && <div className="ds-topbar-title">{title}</div>}{right}</div>;
}
// нижняя панель вкладок: открытая вкладка — не кнопка перехода
// onReselect — нажатие на уже открытую вкладку (например, «Учебник» — вернуться на его главную)
export function Tabs({ tabs, active, onTab, onReselect = null, label = 'Разделы' }) {
  return (
    <nav aria-label={label} data-testid="bottom-nav" className="ds-nav">
      <div className="ds-nav-in">
        {tabs.map((t) => {
          const on = active === t.id; const Icon = t.icon;
          return (
            <button key={t.id} type="button" aria-current={on ? 'page' : undefined} data-tab={t.id} data-nav-target={on ? undefined : `tab:${t.id}`}
              onClick={() => { if (!on) onTab(t.id); else if (onReselect) onReselect(t.id); }}>
              <Icon size={22} strokeWidth={on ? 2.2 : 1.7} aria-hidden="true" /><span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
