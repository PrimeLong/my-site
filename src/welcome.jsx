/* ПЕРВЫЙ ЗАПУСК И ВХОД. Приветствие с Инфлей (три обещания и мини-задача) → «Начать» →
   цель и минуты в день → сразу первый урок, без аккаунта (гость, src/lib/guest.js). После
   урока — «Сохраните прогресс» → регистрация: аккаунт забирает прогресс устройства.
   «У меня уже есть аккаунт» → вход (и восстановление по коду, если забыт пароль).
   У каждого экрана один «назад» — стрелка вверху слева. */
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { authenticate, RecoveryCodeView, StorageWarning, NameRefused, ConsentBox, ParentStep, consentsReady, BirthYearField, birthYearOf } from './account.jsx';
import { validBirthYear, needsParent } from './lib/age.js';
import { RUDE_NAME } from './lib/moderation.js';
import { Mascot } from './mascot.jsx';
import { DsRoot, Button, IconButton, Heading } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette } from './ds-art.jsx';
import { dsThemeId } from './ds-tokens.js';
import { loadProgress, saveProgress } from './textbook/progress.js';
import { setGoal, setProfile, PROFILE_GOAL_LABEL, LESSONS_FOR_MINUTES } from './textbook/learn-state.js';
import { startGuest, endGuest } from './lib/guest.js';
import { track } from './lib/client.js';

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
`;

function Top({ onBack }) {
  return (
    <div className="wl-top">
      {onBack && <IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onBack(); }} />}
    </div>
  );
}

// три обещания приветствия и мини-задача: попробовать до любых вопросов о себе
export const VALUE_POINTS = [
  ['Пять минут в день', 'Короткие уроки: одна мысль, график, вопрос — и сразу ответ.'],
  ['Экономика вокруг вас', 'Кофейня у метро, пекарня, банк и министерство — герои одного города.'],
  ['Знания в деле', 'В «Мире» вы ведёте страну и видите, как работают ставка, бюджет и рынок.'],
];
const TRY = { q: 'Капучино у метро подорожал с 20 до 25 крон. Что будет с числом проданных чашек?',
  options: [['Станет меньше', true], ['Станет больше', false], ['Не изменится', false]],
  ok: 'Верно: чем дороже, тем меньше покупают. Это закон спроса — с него начинается первый юнит.',
  no: 'Не совсем: при более высокой цене часть гостей откажется от чашки. Это закон спроса — с него начинается первый юнит.' };
function TryTask() {
  const [pick, setPick] = useState(null);
  const right = pick != null && TRY.options[pick][1];
  return (
    <div className="ds-card" data-testid="welcome-try" style={{ textAlign: 'left', padding: '12px 14px', width: '100%', maxWidth: 380, margin: '0 auto' }}>
      <div className="ds-eyebrow" style={{ marginBottom: 4 }}>Попробуйте</div>
      <div style={{ fontSize: 15.5, lineHeight: 1.45, marginBottom: 10 }}>{TRY.q}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {TRY.options.map(([label], k) => (
          <button key={label} type="button" className="ds-opt" aria-pressed={pick === k} disabled={pick != null && pick !== k}
            onClick={() => { Audio.prime(); Audio.play(TRY.options[k][1] ? 'up' : 'click'); setPick(k); }} style={{ margin: 0 }}>{label}</button>
        ))}
      </div>
      {pick != null && <div role="status" data-testid="welcome-try-say" style={{ fontSize: 14.5, lineHeight: 1.45, marginTop: 10, color: right ? 'var(--ds-ok)' : 'var(--ds-ink2)' }}>{right ? TRY.ok : TRY.no}</div>}
    </div>
  );
}

function Hello({ go }) {
  return (
    <div className="wl" data-testid="welcome">
      {/* титул — как купюра: гильош, розетка-водяной знак, Инфля в середине */}
      <div className="wl-body" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Guilloche height={26} />
        <div style={{ margin: '12px 0 4px' }}><Rosette size={150} opacity={0.4}><Mascot mood="wave" size={92} /></Rosette></div>
        <h1 className="ds-h1" style={{ fontSize: 34, letterSpacing: '.02em' }}>Инфлатия</h1>
        <div className="ds-eyebrow" style={{ marginTop: 6 }}>экономика пять минут в день</div>
        <ul data-testid="welcome-values" style={{ listStyle: 'none', padding: 0, margin: '14px 0', textAlign: 'left', maxWidth: 380, display: 'grid', gap: 8 }}>
          {VALUE_POINTS.map(([t, d]) => (
            <li key={t} style={{ fontSize: 15, lineHeight: 1.4 }}><b>{t}.</b> <span className="ds-sub">{d}</span></li>
          ))}
        </ul>
        <TryTask />
        <div style={{ marginTop: 14, width: '100%' }}><Guilloche height={20} /></div>
      </div>
      <div className="wl-foot">
        <Button wide onClick={() => { Audio.prime(); Audio.play('click'); track('welcome_start'); go('goal'); }}>Начать</Button>
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
        <Button wide disabled={!ok} onClick={() => { Audio.play('click'); saveOnboarding(plan); applyPlan(plan); track('goal_done'); startGuest(); }}>Продолжить</Button>
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
    <DsRoot theme={dsThemeId()} page accent="#86461F">
      <ArtStyle />
      <style>{CSS}</style>
      {screen === 'hello' && <Hello go={go} />}
      {screen === 'goal' && <Goal go={go} plan={plan} setPlan={setPlan} />}
      {(screen === 'register' || screen === 'login' || screen === 'recover') && <AuthForm key={screen} mode={screen} go={go} plan={plan} onCancel={screen === initialScreen ? onCancel : null} />}
    </DsRoot>
  );
}
export default Welcome;
