/* ПЕРВЫЙ ЗАПУСК И ВХОД. Без аккаунта в приложении только эти экраны: приветствие с
   Инфлей → «Начать» → цель и минуты в день → регистрация → Путь. «У меня уже есть
   аккаунт» → вход (и восстановление по коду, если забыт пароль). Прогресс хранится в
   аккаунте: после входа устройство переходит на профиль (см. authenticate в account.jsx).
   У каждого экрана один «назад» — стрелка вверху слева. */
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { authenticate, RecoveryCodeView, StorageWarning, NameRefused, ConsentBox, BirthYearField, birthYearOf } from './account.jsx';
import { validBirthYear } from './lib/age.js';
import { RUDE_NAME } from './lib/moderation.js';
import { Mascot } from './mascot.jsx';
import { DsRoot, Button, IconButton, Heading } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette } from './ds-art.jsx';
import { dsThemeId } from './ds-tokens.js';
import { loadProgress, saveProgress } from './textbook/progress.js';
import { setGoal, setProfile, PROFILE_GOAL_LABEL, LESSONS_FOR_MINUTES } from './textbook/learn-state.js';

// ответы первого запуска: после регистрации они уходят в программу ученика (learn.profile)
const ONBOARD_KEY = 'ems-onboarding';
export const loadOnboarding = () => { try { return JSON.parse(localStorage.getItem(ONBOARD_KEY) || 'null'); } catch { return null; } };
const saveOnboarding = (v) => { try { localStorage.setItem(ONBOARD_KEY, JSON.stringify(v)); } catch { /* приватный режим */ } };

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

function Hello({ go }) {
  return (
    <div className="wl" data-testid="welcome">
      {/* титул — как купюра: гильош, розетка-водяной знак, Инфля в середине */}
      <div className="wl-body" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Guilloche height={26} />
        <div style={{ margin: '18px 0 6px' }}><Rosette size={210} opacity={0.4}><Mascot mood="wave" size={120} /></Rosette></div>
        <h1 className="ds-h1" style={{ fontSize: 36, letterSpacing: '.02em' }}>Инфлатия</h1>
        <div className="ds-eyebrow" style={{ marginTop: 6 }}>экономика пять минут в день</div>
        <div className="ds-sub" style={{ fontSize: 16.5, lineHeight: 1.5, maxWidth: 320, margin: '12px 0 18px' }}>
          Дорога по стране маленькими уроками — вместе с Инфлей.
        </div>
        <Guilloche height={26} />
      </div>
      <div className="wl-foot">
        <Button wide onClick={() => { Audio.prime(); Audio.play('click'); go('goal'); }}>Начать</Button>
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
        <Button wide disabled={!ok} onClick={() => { Audio.play('click'); saveOnboarding(plan); go('register'); }}>Продолжить</Button>
      </div>
    </div>
  );
}

/* Форма регистрации, входа или восстановления. После регистрации и восстановления
   показываем код восстановления — почты у игры нет, без кода забытый пароль не вернуть. */
function AuthForm({ mode, go, plan }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(null);
  const finish = () => {
    // программа ученика: цель, минуты (из них — цель дня и задание дня) и знания (вступительный тест)
    if (mode === 'register' && plan.minutes) {
      const p = loadProgress();
      saveProgress({ ...p, learn: setGoal(setProfile(p.learn, plan), LESSONS_FOR_MINUTES[plan.minutes] || 1) });
    }
    // аккаунт уже сохранён — приложение само перейдёт на Путь
    window.dispatchEvent(new Event('ems-account-ready'));
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await authenticate(mode, { login, password, name, code, consent, birthYear: birthYearOf(year) });
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
    && (mode !== 'register' || (consent && validBirthYear(birthYearOf(year))));
  return (
    <div className="wl" data-testid={`welcome-${mode}`}>
      <Top onBack={() => go(mode === 'register' ? 'goal' : mode === 'recover' ? 'login' : 'hello')} />
      <form className="wl-body" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Mascot mood={mode === 'register' ? 'joy' : 'hello'} size={52} />
          <Heading level={1} eyebrow={mode === 'register' ? 'Шаг 2 из 2' : 'Аккаунт'} title={title} />
        </div>
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
        {mode === 'register' && <div style={{ marginTop: 12 }}><ConsentBox on={consent} set={setConsent} /></div>}
        {error && (error === RUDE_NAME ? <NameRefused text={error} login={login} name={name} /> : <div className="wl-err" role="alert">{error}</div>)}
        <div style={{ flex: 1 }} />
        <div className="wl-foot">
          <Button type="submit" wide disabled={busy || !canSubmit}>
            {busy ? 'Минутку…' : mode === 'register' ? 'Создать аккаунт' : mode === 'recover' ? 'Задать пароль' : 'Войти'}
          </Button>
          {mode === 'login' && <Button variant="ghost" wide onClick={() => go('recover')}>Забыли пароль?</Button>}
        </div>
      </form>
    </div>
  );
}

export function Welcome() {
  const [screen, setScreen] = useState('hello');
  const [plan, setPlan] = useState(() => loadOnboarding() || { goal: null, minutes: null, knows: false });
  const go = (s) => { setScreen(s); window.scrollTo(0, 0); };
  return (
    <DsRoot theme={dsThemeId()} page accent="#86461F">
      <ArtStyle />
      <style>{CSS}</style>
      {screen === 'hello' && <Hello go={go} />}
      {screen === 'goal' && <Goal go={go} plan={plan} setPlan={setPlan} />}
      {(screen === 'register' || screen === 'login' || screen === 'recover') && <AuthForm key={screen} mode={screen} go={go} plan={plan} />}
    </DsRoot>
  );
}
export default Welcome;
