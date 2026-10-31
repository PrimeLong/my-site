/* ПЕРВЫЙ ЗАПУСК И ВХОД. Приветствие с Инфлей (три обещания и мини-задача) → «Начать» →
   цель и минуты в день → сразу первый урок, без аккаунта (гость, src/lib/guest.js). После
   урока — «Сохраните прогресс» → регистрация: аккаунт забирает прогресс устройства.
   «У меня уже есть аккаунт» → вход (и восстановление по коду, если забыт пароль).
   У каждого экрана один «назад» — стрелка вверху слева. */
import React, { useState } from 'react';
import { ArrowLeft, Timer, Coffee, Globe2, Check, X } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { authenticate, RecoveryCodeView, StorageWarning, NameRefused, ConsentBox, ParentStep, consentsReady, BirthYearField, birthYearOf } from './account.jsx';
import { validBirthYear, needsParent } from './lib/age.js';
import { RUDE_NAME } from './lib/moderation.js';
import { Mascot } from './mascot.jsx';
import { InflatiaMark } from './logo.jsx';
import { DsRoot, Button, IconButton, Heading } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette } from './ds-art-core.jsx';
import { dsThemeId } from './ds-tokens.js';
import { loadProgress, saveProgress } from './textbook/progress.js';
import { setGoal, setProfile, PROFILE_GOAL_LABEL, LESSONS_FOR_MINUTES } from './textbook/learn-state.js';
import { startGuest, endGuest } from './lib/guest.js';
import { track, trackOnce } from './lib/client.js';

// ответы первого запуска: после регистрации они уходят в программу ученика (learn.profile)
const ONBOARD_KEY = 'ems-onboarding';
export const loadOnboarding = () => { try { return JSON.parse(localStorage.getItem(ONBOARD_KEY) || 'null'); } catch { return null; } };
const saveOnboarding = (v) => { try { localStorage.setItem(ONBOARD_KEY, JSON.stringify(v)); } catch { /* приватный режим */ } };

// программа ученика: цель, минуты (из них — цель дня и задание дня) и знания (вступительный тест)
function applyPlan(plan) {
  if (!plan || !plan.minutes) return;
  const p = loadProgress();
  saveProgress({ ...p, learn: setGoal(setProfile(p.learn, plan), LESSONS_FOR_MINUTES[plan.minutes] || 1) });
}

export const GOALS = Object.entries(PROFILE_GOAL_LABEL).map(([id, label]) => ({ id, label }));
export const MINUTES = [5, 10, 15, 20];

const CSS = `
  .wl { max-width: 460px; margin: 0 auto; padding: calc(18px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; box-sizing: border-box; }
  .wl-top { display: flex; align-items: center; min-height: 44px; }
  .wl-body { flex: 1; display: flex; flex-direction: column; }
  .wl-foot { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
  .wl-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .wl-opts .ds-opt { margin: 0; text-align: center; font-weight: 700; }
  .wl-err { color: var(--ds-bad); font-size: 14px; margin: 4px 0 8px; }
  /* приветствие оживает по шагам: гильош, Инфля, название, обещания, мини-урок */
  .wl-hello .wl-g1, .wl-hello .wl-g2 { animation: wl-wipe .9s cubic-bezier(.3,.8,.4,1) both; width: 100%; }
  .wl-hello .wl-g2 { animation-delay: .9s; }
  @keyframes wl-wipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
  .wl-hero { margin: 12px 0 4px; animation: wl-pop .6s cubic-bezier(.3,1.5,.5,1) .15s both; }
  .wl-bob { display: inline-block; animation: wl-bob 3s ease-in-out .8s infinite; }
  @keyframes wl-pop { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
  @keyframes wl-bob { 0%, 100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-6px) rotate(-2deg) } }
  .wl-brand { animation: wl-up .5s ease-out .35s both; }
  .wl-slogan { animation: wl-up .5s ease-out .45s both; }
  @keyframes wl-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .wl-values { list-style: none; padding: 0; margin: 16px 0; text-align: left; max-width: 380px; display: grid; gap: 10px; }
  .wl-values li { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: start; font-size: 15px; line-height: 1.4; animation: wl-up .45s ease-out both; animation-delay: calc(.55s + var(--i) * .12s); }
  .wl-v-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: var(--u-ink); background: color-mix(in srgb, var(--u) 13%, var(--ds-card)); }
  .wl-try { text-align: left; padding: 12px 14px 14px; width: 100%; max-width: 380px; margin: 0 auto; animation: wl-up .5s ease-out .95s both; }
  .wl-try-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .wl-try-bar { flex: 1; height: 8px; border-radius: 4px; background: var(--ds-rule); overflow: hidden; }
  .wl-try-bar i { display: block; height: 100%; border-radius: 4px; background: var(--ds-ok); transition: width .6s cubic-bezier(.3,.8,.4,1); }
  .wl-scene { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--ds-card2); margin-bottom: 10px; }
  .wl-cup { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: #7A4A1E; background: color-mix(in srgb, #C2490B 14%, var(--ds-card)); animation: wl-steam 2.4s ease-in-out infinite; }
  .ds-dark .wl-cup { color: #F2B27A; }
  @keyframes wl-steam { 0%, 100% { transform: rotate(0) } 50% { transform: rotate(-4deg) } }
  .wl-tag { position: relative; flex: none; white-space: nowrap; display: inline-flex; align-items: baseline; gap: 6px; padding: 4px 10px; border-radius: 8px; background: var(--ds-card); border: 1.5px dashed var(--ds-rule2); font: 700 15px var(--ds-mono); }
  .wl-tag s { color: var(--ds-ink2); font-weight: 400; animation: wl-strike .4s ease-out 1.6s both; }
  .wl-tag b { color: var(--ds-bad-ink, #9B2C1F); animation: wl-price .55s cubic-bezier(.3,1.6,.5,1) 1.8s both; }
  @keyframes wl-strike { from { text-decoration-color: transparent; } to { text-decoration-color: currentColor; } }
  @keyframes wl-price { from { opacity: 0; transform: translateY(-8px) scale(1.4) } to { opacity: 1; transform: none } }
  .wl-scene-note { font-size: 13px; color: var(--ds-ink2); line-height: 1.3; }
  .wl-q { font-size: 16px; line-height: 1.45; margin-bottom: 10px; font-weight: 600; }
  .wl-opt { display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: transform .15s, opacity .3s; }
  .wl-opt.ok { box-shadow: 0 3px 0 var(--ds-ok); border-color: var(--ds-ok); background: var(--ds-ok-bg, color-mix(in srgb, var(--ds-ok) 12%, var(--ds-card))); color: var(--ds-ok-ink); animation: wl-yes .5s cubic-bezier(.3,1.6,.5,1) both; }
  .wl-opt.bad { box-shadow: 0 3px 0 var(--ds-warm-btn); border-color: var(--ds-warm-btn); color: var(--ds-ink); animation: wl-no .4s ease-in-out both; }
  .wl-opt.off { opacity: .5; }
  .wl-opt[disabled] { cursor: default; }
  @keyframes wl-yes { 40% { transform: scale(1.04) } }
  @keyframes wl-no { 20%, 60% { transform: translateX(-5px) } 40%, 80% { transform: translateX(5px) } }
  .wl-answer { margin-top: 12px; animation: wl-up .45s ease-out both; }
  .wl-say { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 10px; align-items: center; }
  .wl-say-ava { animation: wl-pop .5s cubic-bezier(.3,1.5,.5,1) both; }
  .wl-say > div { position: relative; padding: 10px 12px; border-radius: 14px; background: var(--ds-card2); font-size: 14.5px; line-height: 1.45; }
  .wl-say > div.ok { background: color-mix(in srgb, var(--ds-ok) 12%, var(--ds-card)); color: var(--ds-ok-ink); }
  .wl-demand { display: block; width: 100%; max-width: 280px; margin: 8px auto 2px; }
  .wl-demand .ax { stroke: var(--ds-ink3); stroke-width: 1.4; }
  .wl-demand .lab { font: 700 12px var(--ds-sans); fill: var(--ds-ink2); }
  .wl-demand .now-t { fill: var(--ds-ink); }
  .wl-demand .curve { fill: none; stroke: #3E6FA8; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 220; animation: wl-draw .8s ease-out both; }
  .wl-demand .was line { stroke: var(--ds-ink3); stroke-dasharray: 3 3; } .wl-demand .was circle { fill: var(--ds-card); stroke: var(--ds-ink3); stroke-width: 2; }
  .wl-demand .now line { stroke: var(--u-ink); stroke-dasharray: 3 3; animation: wl-fade .4s ease-out .9s both; }
  .wl-demand .now circle { fill: var(--u); stroke: var(--ds-card); stroke-width: 2; animation: wl-slide .7s cubic-bezier(.3,.8,.4,1) .6s both; }
  .wl-demand .arrow { fill: none; stroke: var(--u-ink); stroke-width: 1.6; animation: wl-fade .4s ease-out 1.1s both; } .wl-demand .arrow-h { fill: var(--u-ink); }
  @keyframes wl-draw { from { stroke-dashoffset: 220 } to { stroke-dashoffset: 0 } }
  @keyframes wl-slide { from { transform: translate(35px, 16px) } to { transform: none } }
  @keyframes wl-fade { from { opacity: 0 } }
  .wl-next { font-size: 14px; line-height: 1.45; color: var(--ds-ink2); text-align: center; margin-top: 4px; }
  .wl-cta-go { animation: wl-cta 1.8s ease-in-out .4s infinite; }
  @keyframes wl-cta { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--u) 45%, transparent) } 50% { box-shadow: 0 0 0 8px transparent } }
  @media (prefers-reduced-motion: reduce) { .wl-hello *, .wl-hello { animation: none !important; } .wl-try-bar i { transition: none; } .wl-demand .curve { stroke-dasharray: none; } }
  /* ПК: две колонки — слева знак, обещания и кнопки, справа «Урок за 30 секунд» (docs/mechanics.md, «Приветствие и
     загрузка»). Разметка та же, что на телефоне: .wl-body растворяется (display: contents), и её дети встают в
     сетку; внизу — место под уведомление о памяти браузера, чтобы оно не легло на кнопки */
  @media (min-width: 1024px) {
    .wl.wl-hello { max-width: 1120px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 460px); column-gap: 64px;
      align-content: center; padding: 32px 32px 220px; }
    .wl-hello > .wl-body { display: contents; }
    .wl-hello > .wl-body > * { grid-column: 1; justify-self: center; }
    .wl-hello > .wl-body > .wl-g1, .wl-hello > .wl-body > .wl-g2 { justify-self: stretch; }
    .wl-hello > .wl-body > .wl-try { grid-column: 2; grid-row: 1 / span 7; align-self: center; max-width: none; margin: 0; }
    .wl-hello > .wl-foot { grid-column: 1; width: 100%; max-width: 380px; justify-self: center; }
    .wl-hello .wl-hero { margin-top: 4px; }
  }
`;

function Top({ onBack }) {
  return (
    <div className="wl-top">
      {onBack && <IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />}
    </div>
  );
}

// три обещания приветствия и мини-урок: попробовать до любых вопросов о себе
export const VALUE_POINTS = [
  ['Пять минут в день', 'Короткие уроки: одна мысль, график, вопрос — и сразу ответ.', Timer],
  ['Экономика вокруг вас', 'Кофейня у метро, пекарня, банк и министерство — герои одного города.', Coffee],
  ['Знания в деле', 'В «Мире» вы ведёте страну и видите, как работают ставка, бюджет и рынок.', Globe2],
];
const TRY = { q: 'Капучино у метро подорожал. Что будет с числом проданных чашек?',
  options: [['Станет меньше', true], ['Станет больше', false], ['Не изменится', false]],
  ok: 'Верно! Чем дороже, тем меньше покупают — это закон спроса. С него начинается Путь.',
  no: 'Не совсем: при цене повыше часть гостей откажется от чашки. Это закон спроса — с него начинается Путь.' };
/* Мини-график спроса: точка едет вниз по кривой — цена выше, чашек меньше. Рисуется после ответа. */
function DemandMini() {
  return (
    <svg className="wl-demand" viewBox="0 0 220 116" role="img" aria-label="Цена выросла с 20 до 25 крон — чашек продают меньше">
      <line x1="30" y1="96" x2="210" y2="96" className="ax" /><line x1="30" y1="96" x2="30" y2="8" className="ax" />
      <text x="34" y="14" className="lab">цена</text><text x="210" y="112" className="lab" textAnchor="end">чашек</text>
      <path d="M44 18 C 90 44, 140 66, 200 88" className="curve" />
      <g className="was"><line x1="30" y1="54" x2="118" y2="54" /><line x1="118" y1="54" x2="118" y2="96" /><circle cx="118" cy="54" r="4.5" /></g>
      <text x="22" y="58" className="lab" textAnchor="end">20</text>
      <g className="now"><line x1="30" y1="38" x2="83" y2="38" /><line x1="83" y1="38" x2="83" y2="96" /><circle cx="83" cy="38" r="6" /></g>
      <text x="22" y="42" className="lab now-t" textAnchor="end">25</text>
      <path d="M112 50 L 89 41" className="arrow" markerEnd="url(#wl-arr)" />
      <defs><marker id="wl-arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 Z" className="arrow-h" /></marker></defs>
    </svg>
  );
}
/* «Урок за 30 секунд»: что такое урок — показать, а не рассказать. Ценник на глазах дорожает
   с 20 до 25 кр., вопрос, ответ — один раз (варианты закрываются), Инфля отвечает, мини-график
   показывает почему, и кнопка «Начать» зовёт дальше. Раньше выбранный вариант можно было жать
   без конца, а зачем этот вопрос — было непонятно. */
function TryTask({ onDone }) {
  const [pick, setPick] = useState(null);
  const right = pick != null && TRY.options[pick][1];
  const choose = (k) => {
    if (pick != null) return;
    Audio.prime(); Audio.play(TRY.options[k][1] ? 'up' : 'down');
    setPick(k); onDone();
  };
  return (
    <div className="ds-card wl-try" data-testid="welcome-try" data-answered={String(pick != null)}>
      <div className="wl-try-head">
        <span className="ds-eyebrow">Урок за 30 секунд</span>
        <span className="wl-try-bar" aria-hidden="true"><i style={{ width: pick != null ? '100%' : '35%' }} /></span>
      </div>
      <div className="wl-scene" aria-hidden="true">
        <span className="wl-cup"><Coffee size={30} /></span>
        <span className="wl-tag"><s>20 кр.</s><b>25 кр.</b></span>
        <span className="wl-scene-note">капучино у метро «Торговая»</span>
      </div>
      <div className="wl-q">{TRY.q}</div>
      <div style={{ display: 'grid', gap: 6 }} role="group" aria-label="Варианты ответа">
        {TRY.options.map(([label, ok], k) => {
          const state = pick == null ? '' : ok ? 'ok' : pick === k ? 'bad' : 'off';
          return (
            <button key={label} type="button" className={`ds-opt wl-opt ${state}`} aria-pressed={pick === k} disabled={pick != null}
              onClick={() => choose(k)} style={{ margin: 0, '--i': k }}>
              <span>{label}</span>{state === 'ok' && <Check size={18} aria-hidden="true" />}{state === 'bad' && <X size={18} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {pick != null && (
        <div className="wl-answer">
          <div className="wl-say">
            <span className="wl-say-ava"><Mascot mood={right ? 'party' : 'cheer'} size={46} /></span>
            <div role="status" data-testid="welcome-try-say" className={right ? 'ok' : ''}>{right ? TRY.ok : TRY.no}</div>
          </div>
          <DemandMini />
          <div className="wl-next" data-testid="welcome-try-next">Так устроен каждый урок: вопрос — ответ — разбор. Дальше — 5 минут в день и целый город экономики.</div>
        </div>
      )}
    </div>
  );
}

function Hello({ go }) {
  const [tried, setTried] = useState(false);
  return (
    <div className="wl wl-hello" data-testid="welcome">
      {/* титул — как купюра: гильош, розетка-водяной знак, Инфля в середине */}
      <div className="wl-body" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className="wl-g1"><Guilloche height={26} /></div>
        <div className="wl-hero"><Rosette size={150} opacity={0.4}><span className="wl-bob"><Mascot mood="wave" size={92} /></span></Rosette></div>
        {/* один знак и одно начертание названия с «Миром» (src/logo.jsx) */}
        <h1 className="ds-h1 wl-brand" style={{ fontSize: 34, letterSpacing: '.02em', display: 'flex', alignItems: 'center', gap: 10 }} data-testid="brand"><InflatiaMark size={40} title={null} />Инфляция</h1>
        <div className="ds-eyebrow wl-slogan" style={{ marginTop: 6 }}>экономика пять минут в день</div>
        <ul data-testid="welcome-values" className="wl-values">
          {VALUE_POINTS.map(([t, d, Icon], k) => (
            <li key={t} style={{ '--i': k }}><span className="wl-v-ico"><Icon size={19} aria-hidden="true" /></span><span><b>{t}.</b> <span className="ds-sub">{d}</span></span></li>
          ))}
        </ul>
        <TryTask onDone={() => setTried(true)} />
        <div style={{ marginTop: 14, width: '100%' }} className="wl-g2"><Guilloche height={20} /></div>
      </div>
      <div className="wl-foot">
        <Button wide className={tried ? 'wl-cta-go' : ''} onClick={() => { Audio.prime(); Audio.play('click'); trackOnce('welcome_start'); go('goal'); }}>{tried ? 'Начать — первый урок' : 'Начать'}</Button>
        <Button variant="secondary" wide onClick={() => { Audio.prime(); Audio.play('click'); go('login'); }}>У меня уже есть аккаунт</Button>
      </div>
    </div>
  );
}

function Goal({ go, plan, setPlan }) {
  const ok = plan.goal && plan.minutes;
  const pick = (patch) => { Audio.play('tick'); setPlan((p) => ({ ...p, ...patch })); };
  return (
    <div className="wl" data-testid="welcome-goal">
      <Top onBack={() => go('hello')} />
      <div className="wl-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Mascot mood="hello" size={56} />
          <Heading level={2} eyebrow="Шаг 1 из 2" title="Зачем вам экономика?" />
        </div>
        <div className="wl-opts" role="group" aria-label="Цель">
          {GOALS.map((g) => <button key={g.id} type="button" className="ds-opt" aria-pressed={plan.goal === g.id} onClick={() => pick({ goal: g.id })}>{g.label}</button>)}
        </div>
        <h2 className="ds-h3" style={{ margin: '22px 0 10px' }}>Сколько минут в день?</h2>
        <div className="wl-opts" role="group" aria-label="Минут в день">
          {MINUTES.map((m) => <button key={m} type="button" className="ds-opt" aria-pressed={plan.minutes === m} onClick={() => pick({ minutes: m })}>{m} минут</button>)}
        </div>
        <h2 className="ds-h3" style={{ margin: '22px 0 10px' }}>Уже знакомы с экономикой?</h2>
        <div className="wl-opts" role="group" aria-label="Знания">
          {[[false, 'Начинаю с нуля'], [true, 'Кое-что знаю']].map(([v, l]) => (
            <button key={l} type="button" className="ds-opt" aria-pressed={plan.knows === v} onClick={() => pick({ knows: v })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="wl-foot">
        <Button wide disabled={!ok} onClick={() => { Audio.play('click'); saveOnboarding(plan); applyPlan(plan); trackOnce('goal_done'); startGuest(); }}>Продолжить</Button>
      </div>
    </div>
  );
}

/* Форма регистрации, входа или восстановления. После регистрации и восстановления
   показываем код восстановления — почты у игры нет, без кода забытый пароль не вернуть. */
function AuthForm({ mode, go, plan, onCancel = null }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [consents, setConsents] = useState({});
  const [year, setYear] = useState('');
  const [parentStep, setParentStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(null);
  const finish = () => {
    if (mode === 'register' && plan.minutes) applyPlan(plan);
    if (mode === 'register') track('register_done');
    // аккаунт уже сохранён и забрал прогресс гостя (тот же playerId) — гостем больше не считаем
    endGuest();
    window.dispatchEvent(new Event('ems-account-ready'));
  };
  const kidYear = mode === 'register' && validBirthYear(birthYearOf(year)) && needsParent(birthYearOf(year));
  const submit = async (e) => {
    e.preventDefault();
    // до 14 лет — сначала отдельный шаг «Подтверждение родителя»
    if (kidYear && !parentStep) { setParentStep(true); window.scrollTo(0, 0); return; }
    setBusy(true); setError('');
    try {
      const r = await authenticate(mode, { login, password, name, code, consents, birthYear: birthYearOf(year) });
      Audio.play('up');
      if (r.recoveryCode) setShown(r); else finish();
    } catch (err) { setError(err.message); Audio.play('down'); setBusy(false); }
  };
  if (shown) {
    return (
      <div className="wl" data-testid="welcome-code">
        <Top />
        <div className="wl-body">
          <Heading level={2} title="Сохраните код восстановления" style={{ marginBottom: 12 }} />
          {shown.storage === 'memory' && <StorageWarning />}
          <RecoveryCodeView code={shown.recoveryCode} onDone={finish} />
        </div>
      </div>
    );
  }
  const title = { register: 'Создайте аккаунт', login: 'Вход', recover: 'Новый пароль по коду' }[mode];
  const canSubmit = login.trim().length >= 3 && password.length >= 6 && (mode !== 'recover' || code.replace(/[^A-Za-z0-9]/g, '').length >= 12)
    && (mode !== 'register' || (validBirthYear(birthYearOf(year)) && consents.page && consents.pd && (!parentStep || consentsReady(consents, birthYearOf(year)))));
  return (
    <div className="wl" data-testid={parentStep ? 'welcome-parent' : `welcome-${mode}`}>
      <Top onBack={() => (parentStep ? setParentStep(false) : onCancel && mode === 'register' ? onCancel() : go(mode === 'register' ? 'goal' : mode === 'recover' ? 'login' : 'hello'))} />
      <form className="wl-body" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Mascot mood={mode === 'register' ? 'joy' : 'hello'} size={52} />
          <Heading level={1} eyebrow={mode === 'register' ? (onCancel ? 'Сохраните прогресс' : 'Шаг 2 из 2') : 'Аккаунт'} title={parentStep ? 'Подтверждение родителя' : title} />
        </div>
        {parentStep ? <ParentStep value={consents} set={setConsents} /> : (<>
          {mode === 'register' && <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>Прогресс, серия и опыт хранятся в аккаунте — войдите на другом устройстве, и всё будет там.</div>}
          {mode === 'recover' && <div className="ds-sub" style={{ fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>Логин, код восстановления из регистрации и новый пароль.</div>}
          <label className="ds-label">Логин
            <input className="ds-field" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="латиница, цифры, _" />
          </label>
          {mode === 'recover' && (
            <label className="ds-label">Код восстановления
              <input className="ds-field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" />
            </label>
          )}
          <label className="ds-label">{mode === 'recover' ? 'Новый пароль' : 'Пароль'}
            <input className="ds-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="не короче 6 символов" />
          </label>
          {mode === 'register' && (
            <label className="ds-label">Имя
              <input className="ds-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="как вас называть" />
            </label>
          )}
          {mode === 'register' && <BirthYearField value={year} set={setYear} />}
          {mode === 'register' && <div style={{ marginTop: 12 }}><ConsentBox value={consents} set={setConsents} /></div>}
        </>)}
        {error && (error === RUDE_NAME ? <NameRefused text={error} login={login} name={name} /> : <div className="wl-err" role="alert">{error}</div>)}
        <div style={{ flex: 1 }} />
        <div className="wl-foot">
          <Button type="submit" wide disabled={busy || !canSubmit}>
            {busy ? 'Минутку…' : mode === 'register' ? (kidYear && !parentStep ? 'Дальше: подтверждение родителя' : 'Создать аккаунт') : mode === 'recover' ? 'Задать пароль' : 'Войти'}
          </Button>
          {mode === 'login' && <Button variant="ghost" wide onClick={() => go('recover')}>Забыли пароль?</Button>}
        </div>
      </form>
    </div>
  );
}

export function Welcome({ initialScreen = 'hello', onCancel = null }) {
  const [screen, setScreen] = useState(initialScreen);
  const [plan, setPlan] = useState(() => loadOnboarding() || { goal: null, minutes: null, knows: false });
  const go = (s) => { setScreen(s); window.scrollTo(0, 0); };
  return (
    <DsRoot theme={dsThemeId()} page accent="#C2490B">
      <ArtStyle />
      <style>{CSS}</style>
      {screen === 'hello' && <Hello go={go} />}
      {screen === 'goal' && <Goal go={go} plan={plan} setPlan={setPlan} />}
      {(screen === 'register' || screen === 'login' || screen === 'recover') && <AuthForm key={screen} mode={screen} go={go} plan={plan} onCancel={screen === initialScreen ? onCancel : null} />}
    </DsRoot>
  );
}
export default Welcome;
