/* Профиль игрока: вход, регистрация, восстановление доступа, окно профиля и кнопка
   в шапке меню. Вынесено из MacroSimulator.jsx; общие вещи (тема, звук, playerId
   устройства и синхронизация прогресса) — оттуда же, те же объекты. */
import React, { useState } from 'react';
import { Star, Crown, Landmark, Coins, Shield, Anchor, Factory, Wheat, User, LogIn, LogOut, KeyRound, X, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  accountRegister, accountLogin, accountMe, accountUpdate, accountPassword, accountLogout, accountRecover, accountRecoveryNew, reportFilter, accountExport, accountDelete,
} from './lib/client.js';
import { PrivacyPage, PRIVACY_TITLE } from './privacy.jsx';
import { TermsPage, TERMS_TITLE } from './terms.jsx';
import { RUDE_NAME } from './lib/moderation.js';
import { validBirthYear, isKid, needsParent, KIDS_AGE, PARENT_AGE } from './lib/age.js';
import {
  COLOR, Audio, useEscapeClose, getPlayerId, syncProfile, readLocalProgress, writeLocalProgress, PLAYER_ID_KEY,
} from './MacroSimulator.jsx';
import { DsRoot } from './ds.jsx';

/* ================================ ПРОФИЛЬ ================================
   Логин и пароль, имя и значок. Главное, ради чего он заведён, — сетевая игра:
   место в комнате закрепляется за профилем, и выйти из партии, чтобы тут же
   зайти «другим игроком», больше нельзя (см. api/room.js). Заодно профиль
   переносит сохранения: при входе на новом устройстве оно переходит на
   playerId профиля, как при связывании устройств. На клиенте хранится только
   токен сессии и то, что нужно показать в шапке. */
const ACCOUNT_KEY = 'ems-account';
// идентификатор и прогресс устройства до входа в чужой (заведённый не здесь)
// профиль: «выйти» возвращает устройство к ним
const ACCOUNT_PREV_KEY = 'ems-account-prev';
const accountListeners = new Set();

export const loadAccount = () => {
  try { const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); return a && a.token && a.login ? a : null; }
  catch { return null; }
};
const saveAccount = (a) => {
  try { if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a)); else localStorage.removeItem(ACCOUNT_KEY); } catch { /* приватный режим */ }
  accountListeners.forEach((f) => f());
};

// сессия протухла на сервере — забываем её, устройство остаётся на своём профиле
export const forgetAccount = () => saveAccount(null);

/* Детский режим «Мира» (src/lib/age.js): его считает сервер, на устройстве лежит последний
   ответ. Пока ответа нет (профиль заведён до этого правила или нет сети) — режим включён. */
export const accountKidsMode = (a = loadAccount()) => !a || a.kidsMode !== false;
const fromProfile = (profile) => ({ name: profile.name, emblem: profile.emblem, kidsMode: profile.kidsMode !== false, leaguePublic: profile.leaguePublic === true });
// при запуске: подтянуть с сервера имя, значок и детский режим
export const refreshAccount = async () => {
  const a = loadAccount();
  if (!a) return;
  try {
    const r = await accountMe(a.token);
    if (r && r.profile && loadAccount()) saveAccount({ ...loadAccount(), ...fromProfile(r.profile) });
  } catch { /* нет сети или сессия протухла — разберётся окно профиля */ }
};

// меню, лобби и шапка видят вход и выход сразу, без перезагрузки
export function useAccount() {
  const [account, setAccount] = useState(loadAccount);
  React.useEffect(() => {
    const f = () => setAccount(loadAccount());
    accountListeners.add(f);
    return () => { accountListeners.delete(f); };
  }, []);
  return account;
}

export const EMBLEMS = [
  { id: 'star', icon: Star, label: 'Звезда' }, { id: 'crown', icon: Crown, label: 'Корона' },
  { id: 'landmark', icon: Landmark, label: 'Здание' }, { id: 'coins', icon: Coins, label: 'Монеты' },
  { id: 'shield', icon: Shield, label: 'Щит' }, { id: 'anchor', icon: Anchor, label: 'Якорь' },
  { id: 'factory', icon: Factory, label: 'Завод' }, { id: 'wheat', icon: Wheat, label: 'Колос' },
];
export const emblemIcon = (id) => (EMBLEMS.find((e) => e.id === id) || EMBLEMS[0]).icon;

/* Вход в профиль: запоминаем сессию и переводим устройство на playerId профиля.
   Возвращает playerId, с которым теперь работает устройство. */
const adoptProfile = (token, profile) => {
  const cur = getPlayerId();
  if (profile.playerId && profile.playerId !== cur) {
    try {
      if (!localStorage.getItem(ACCOUNT_PREV_KEY)) {
        localStorage.setItem(ACCOUNT_PREV_KEY, JSON.stringify({ playerId: cur, progress: readLocalProgress() }));
      }
      localStorage.setItem(PLAYER_ID_KEY, profile.playerId);
    } catch { /* приватный режим */ }
  }
  saveAccount({ token, login: profile.login, ...fromProfile(profile) });
  syncProfile(profile.playerId || cur);
  return profile.playerId || cur;
};

/* Регистрация, вход и восстановление одной функцией — для окна профиля и для экранов
   первого запуска (src/welcome.jsx). mode: register | login | recover. Возвращает
   { profile, playerId, recoveryCode, storage }. */
export async function authenticate(mode, { login, password, name = '', code = '', consents = {}, birthYear = null }) {
  const lg = String(login || '').trim().toLowerCase();
  // consents: { page, pd, parent, parentName } — см. ConsentBox и ParentStep
  const r = mode === 'register' ? await accountRegister({ login: lg, password, name: String(name).trim(), playerId: getPlayerId(), birthYear,
    consentPage: !!consents.page, consentPd: !!consents.pd, parentConsent: !!consents.parent, parentName: consents.parentName || '' })
    : mode === 'recover' ? await accountRecover(lg, code, password)
      : await accountLogin(lg, password);
  if (!r || !r.token || !r.profile) throw new Error('Сервер не ответил');
  const playerId = adoptProfile(r.token, r.profile);
  return { profile: r.profile, playerId, recoveryCode: r.recoveryCode || null, storage: r.storage || null };
}

// выход: сессия гасится на сервере, устройство возвращается к своему профилю
export const leaveProfile = async () => {
  const a = loadAccount();
  if (a) accountLogout(a.token).catch(() => { /* сессия и так протухнет */ });
  saveAccount(null);
  try {
    const prev = JSON.parse(localStorage.getItem(ACCOUNT_PREV_KEY) || 'null');
    if (prev && prev.playerId) {
      localStorage.setItem(PLAYER_ID_KEY, prev.playerId);
      writeLocalProgress(prev.progress, { replace: true });
    }
    localStorage.removeItem(ACCOUNT_PREV_KEY);
  } catch { /* приватный режим */ }
  return getPlayerId();
};


function ModalShell({ title, icon: Icon, onClose, children, label }) {
  useEscapeClose(onClose);
  return (
    <DsRoot world={COLOR} style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,6,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div role="dialog" aria-label={label || title} className="ds-card ds-rise" style={{ maxWidth: 420, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon size={17} color="var(--u-ink)" aria-hidden="true" />
          <span className="ds-h3" style={{ flex: 1 }}>{title}</span>
          <button type="button" className="ds-icon-btn" aria-label="Закрыть" data-nav="back" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </DsRoot>
  );
}

// предупреждение, когда сервер работает без общего хранилища: профиль там не выживет
export function StorageWarning() {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: 'var(--ds-bad)', lineHeight: 1.5, marginBottom: 10 }}>
      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
      Сервер работает без общего хранилища (Redis): профили и сессии могут пропадать. Это настройка развёртывания —
      нужны переменные KV_REST_API_URL и KV_REST_API_TOKEN.
    </div>
  );
}

/* Код восстановления показываем один раз: почты у игры нет, и без кода забытый
   пароль не вернуть. Кнопка «Я сохранил» — нарочно отдельное действие. */
export function RecoveryCodeView({ code, onDone, doneLabel = 'Я сохранил код' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* код виден на экране */ }
  };
  return (
    <div>
      <div style={{ fontSize: 15, color: 'var(--ds-ink)', lineHeight: 1.55, marginBottom: 10 }}>
        Это код восстановления. Если забудете пароль, по нему можно задать новый. Сохраните его где-нибудь вне игры:
        показываем его только сейчас.
      </div>
      <div className="ds-num" data-testid="recovery-code" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'center', padding: '12px 8px',
        background: 'var(--ds-card2)', border: '1.5px dashed var(--u-ink)', color: 'var(--ds-ink)', marginBottom: 12 }}>{code}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="ds-btn ds-btn--secondary ds-btn--small"  onClick={copy}>
          {copied ? <Check size={12} style={{ verticalAlign: -2, marginRight: 5 }} /> : <Copy size={12} style={{ verticalAlign: -2, marginRight: 5 }} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
        <button type="button" className="ds-btn" style={{ flex: 1, }} onClick={onDone}>{doneLabel}</button>
      </div>
    </div>
  );
}

/* Вход, регистрация и восстановление доступа. reason — зачем просим войти (например,
   перед сетевой игрой). */
/* Согласия при регистрации — две отдельные отметки (docs/legal-todo.md, п. 4):
   1) «ознакомлен(а)» со страницей «Данные и конфиденциальность» и пользовательским соглашением;
   2) «согласие на обработку персональных данных» — что именно и зачем, одной фразой.
   value: { page, pd }, set — новое значение целиком. */
const linkStyle = { background: 'none', border: 'none', padding: 0, color: 'var(--u-ink)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' };
const boxStyle = { width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: 'var(--u)' };
export const consentsReady = (c, birthYear) => !!(c && c.page && c.pd && (!validBirthYear(birthYear) || !needsParent(birthYear) || (c.parent && String(c.parentName || '').trim().length >= 2)));
export function ConsentBox({ value, set }) {
  const [open, setOpen] = useState(null); // null | 'privacy' | 'terms'
  const v = value || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--ds-ink2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input type="checkbox" id="consent-page" checked={!!v.page} onChange={(e) => set({ ...v, page: e.target.checked })} data-testid="consent-page" style={boxStyle} />
        <label htmlFor="consent-page">
          Ознакомлен(а) со страницей <button type="button" onClick={() => setOpen('privacy')} data-testid="consent-privacy" style={linkStyle}>«{PRIVACY_TITLE}»</button> и{' '}
          <button type="button" onClick={() => setOpen('terms')} data-testid="consent-terms" style={linkStyle}>«{TERMS_TITLE}»</button>: это учебная игра, не финансовый совет.
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input type="checkbox" id="consent-pd" checked={!!v.pd} onChange={(e) => set({ ...v, pd: e.target.checked })} data-testid="consent-pd" style={boxStyle} />
        <label htmlFor="consent-pd">
          Согласие на обработку персональных данных: данных аккаунта, года рождения и прогресса учёбы — чтобы вести аккаунт, прогресс и сетевые партии.
        </label>
      </div>
      {open === 'privacy' && <PrivacyPage onClose={() => setOpen(null)} />}
      {open === 'terms' && <TermsPage onClose={() => setOpen(null)} />}
    </div>
  );
}

/* Подтверждение родителя — отдельный шаг регистрации до 14 лет: отметка и имя родителя или
   другого законного представителя. Сервер хранит время подтверждения (parentConsentAt) и имя. */
export function ParentStep({ value, set }) {
  const v = value || {};
  return (
    <div data-testid="parent-step" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--ds-ink2)' }}>
      <div style={{ fontSize: 15, color: 'var(--ds-ink)' }}>
        Вам меньше {PARENT_AGE} лет — попросите родителя или другого законного представителя прочитать страницу данных и
        подтвердить регистрацию.
      </div>
      <label className="ds-label">Имя родителя
        <input className="ds-field" value={v.parentName || ''} onChange={(e) => set({ ...v, parentName: e.target.value.slice(0, 60) })}
          placeholder="как к вам обращаться" maxLength={60} data-testid="parent-name" style={{ marginTop: 5 }} />
      </label>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input type="checkbox" id="parent-consent" checked={!!v.parent} onChange={(e) => set({ ...v, parent: e.target.checked })} data-testid="parent-consent" style={boxStyle} />
        <label htmlFor="parent-consent">Я родитель или законный представитель, прочитал(а) страницу данных и согласен(на) на регистрацию ребёнка и обработку его данных.</label>
      </div>
    </div>
  );
}

/* Год рождения при регистрации: только год, без даты. До 16 лет «Мир» — в детском режиме
   (docs/world.md). value — строка из поля, birthYearOf превращает её в число или null. */
export const birthYearOf = (v) => (/^\d{4}$/.test(String(v).trim()) ? Number(String(v).trim()) : null);
export function BirthYearField({ value, set }) {
  const y = birthYearOf(value);
  const bad = String(value).trim().length >= 4 && !validBirthYear(y);
  return (
    <label className="ds-label">Год рождения
      <input className="ds-field" value={value} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
        inputMode="numeric" autoComplete="bday-year" placeholder="например, 2010" aria-invalid={bad || undefined}
        data-testid="birth-year" style={{ marginTop: 5 }} />
      <span style={{ display: 'block', fontSize: 13, color: bad ? 'var(--ds-bad)' : 'var(--ds-ink3)', marginTop: 4, fontWeight: 400 }}>
        {bad ? 'Проверьте год' : y && isKid(y) ? `До ${KIDS_AGE} лет «Мир» работает в детском режиме: без войн и переворотов.` : 'Нужен для детского режима «Мира» — точную дату не спрашиваем.'}
      </span>
    </label>
  );
}

/* Имя или логин не прошли фильтр грубых слов. Текст отказа нейтральный; если человек уверен,
   что фильтр ошибся, — «Это ошибка фильтра» отправляет сообщение владельцам (без аккаунта). */
export function NameRefused({ text, login, name, screen = 'register' }) {
  const [state, setState] = useState('idle'); // idle | busy | sent
  const appeal = async () => {
    setState('busy');
    try { await reportFilter(login, name, screen); } catch { /* сообщение не ушло — не мешаем регистрации */ }
    setState('sent');
  };
  return (
    <div role="alert" data-testid="name-refused" style={{ fontSize: 14, color: 'var(--ds-ink)', lineHeight: 1.45 }}>
      <div style={{ color: 'var(--ds-bad)' }}>{text}</div>
      {state === 'sent'
        ? <div style={{ marginTop: 6, color: 'var(--ds-ink2)' }} data-testid="name-appeal-sent">Спасибо, проверим. Пока можно выбрать другое имя.</div>
        : <button type="button" className="ds-chip" style={{ marginTop: 8 }} disabled={state === 'busy'} onClick={appeal} data-testid="name-appeal">Это ошибка фильтра</button>}
    </div>
  );
}

export function AuthModal({ onClose, onDone, reason }) {
  const [tab, setTab] = useState('register');   // register | login | recover
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [consents, setConsents] = useState({});
  const [year, setYear] = useState('');
  const [parentStep, setParentStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageMemory, setStorageMemory] = useState(false);
  // после регистрации или восстановления сначала показываем новый код, потом закрываемся
  const [shownCode, setShownCode] = useState(null);
  const [finish, setFinish] = useState(null);
  const kidYear = tab === 'register' && validBirthYear(birthYearOf(year)) && needsParent(birthYearOf(year));
  const submit = async (e) => {
    e.preventDefault();
    // до 14 лет — сначала отдельный шаг «Подтверждение родителя»
    if (kidYear && !parentStep) { setParentStep(true); return; }
    setBusy(true); setError('');
    try {
      const r = await authenticate(tab, { login, password, name, code, consents, birthYear: birthYearOf(year) });
      const playerId = r.playerId;
      Audio.play('up');
      const done = () => { if (onDone) onDone(r.profile, playerId); onClose(); };
      if (r.recoveryCode) { setStorageMemory(r.storage === 'memory'); setShownCode(r.recoveryCode); setFinish(() => done); }
      else done();
    } catch (err) { setError(err.message); Audio.play('down'); } finally { setBusy(false); }
  };
  const titles = { register: 'Регистрация', login: 'Вход в профиль', recover: 'Восстановление доступа' };
  if (shownCode) {
    return (
      <ModalShell title="Код восстановления" label="Профиль игрока" icon={KeyRound} onClose={() => finish && finish()}>
        {storageMemory && <StorageWarning />}
        <RecoveryCodeView code={shownCode} onDone={() => finish && finish()} />
      </ModalShell>
    );
  }
  const canSubmit = login.trim().length >= 3 && password.length >= 6 && (tab !== 'recover' || code.replace(/[^A-Za-z0-9]/g, '').length >= 12)
    && (tab !== 'register' || (validBirthYear(birthYearOf(year)) && consents.page && consents.pd && (!parentStep || consentsReady(consents, birthYearOf(year)))));
  return (
    <ModalShell title={titles[tab]} label="Профиль игрока" icon={User} onClose={onClose}>
      {reason && <div style={{ fontSize: 14, color: 'var(--ds-ink)', marginBottom: 12, lineHeight: 1.5 }}>{reason}</div>}
      {tab !== 'recover' && (
        <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['register', 'Новый профиль'], ['login', 'У меня есть профиль']].map(([id, lbl]) => (
            <button key={id} type="button" role="tab" className="ds-chip" aria-pressed={tab === id} style={{ flex: 1, margin: 0 }}
              onClick={() => { setTab(id); setError(''); }}>{lbl}</button>
          ))}
        </div>
      )}
      {tab === 'recover' && (
        <div style={{ fontSize: 14, color: 'var(--ds-ink2)', lineHeight: 1.5, marginBottom: 12 }}>
          Введите логин, код восстановления, который вы получили при регистрации, и новый пароль. Все прежние входы в профиль
          на других устройствах закроются.
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="ds-label">Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none"
            placeholder="латиница, цифры, _" className="ds-field" style={{ marginTop: 5 }} />
        </label>
        {tab === 'recover' && (
          <label className="ds-label">Код восстановления
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX"
              className="ds-field ds-num" style={{ marginTop: 5, letterSpacing: '0.08em' }} />
          </label>
        )}
        <label className="ds-label">{tab === 'recover' ? 'Новый пароль' : 'Пароль'}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'} placeholder="не короче 6 символов"
            className="ds-field" style={{ marginTop: 5 }} />
        </label>
        {tab === 'register' && (
          <label className="ds-label">Имя в игре
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="как вас видят партнёры" maxLength={24}
              className="ds-field" style={{ marginTop: 5 }} />
          </label>
        )}
        {tab === 'register' && <BirthYearField value={year} set={setYear} />}
        {tab === 'register' && (
          <div style={{ fontSize: 14, color: 'var(--ds-ink3)', lineHeight: 1.5 }}>
            Сохранения, достижения и пройденные курсы с этого устройства перейдут в профиль — войдите с ним на другом
            устройстве, и они будут там.
          </div>
        )}
        {tab === 'register' && !parentStep && <ConsentBox value={consents} set={setConsents} />}
        {tab === 'register' && parentStep && <ParentStep value={consents} set={setConsents} />}
        {error && (error === RUDE_NAME ? <NameRefused text={error} login={login} name={name} /> : <div style={{ fontSize: 14, color: 'var(--ds-bad)' }}>{error}</div>)}
        <button type="submit" className="ds-btn" disabled={busy || !canSubmit} style={{ marginTop: 2 }}>
          {busy ? 'Минутку…' : tab === 'register' ? (kidYear && !parentStep ? 'Дальше: подтверждение родителя' : 'Создать профиль') : tab === 'recover' ? 'Задать новый пароль' : 'Войти'}
        </button>
        {tab === 'login' && (
          <button type="button" className="ds-btn ds-btn--ghost" 
            onClick={() => { setTab('recover'); setError(''); setPassword(''); }}>Забыли пароль?</button>
        )}
        {tab === 'recover' && (
          <button type="button" className="ds-btn ds-btn--ghost" 
            onClick={() => { setTab('login'); setError(''); }}>← Ко входу</button>
        )}
      </form>
    </ModalShell>
  );
}

/* Профиль: значок, имя, статистика сетевых партий, пароль, код восстановления и выход. */
export function ProfileModal({ onClose, onSwitched }) {
  const account = useAccount();
  const [profile, setProfile] = useState(null);
  const [storageMemory, setStorageMemory] = useState(false);
  const [name, setName] = useState(account ? account.name : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [panel, setPanel] = useState(null);     // null | 'password' | 'recovery' | 'delete'
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [shownCode, setShownCode] = useState(null);
  const [privacy, setPrivacy] = useState(false);
  // «Скачать мои данные»: всё о профиле с сервера — одним файлом JSON
  const download = async () => {
    setBusy(true); setError('');
    try {
      const data = await accountExport(account.token);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `inflatia-${account.login}-data.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote('Файл с вашими данными скачан.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // «Удалить аккаунт и все данные»: с паролем; потом устройство возвращается к гостевому профилю
  const removeAll = async () => {
    setBusy(true); setError('');
    try {
      await accountDelete(account.token, oldPw);
      const id = await leaveProfile();
      Audio.play('down'); onSwitched(id); onClose();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  React.useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    accountMe(account.token).then((r) => {
      if (!alive || !r || !r.profile) return;
      setProfile(r.profile); setName(r.profile.name); setStorageMemory(r.storage === 'memory');
      saveAccount({ ...account, ...fromProfile(r.profile) });
    }).catch((e) => {
      if (!alive) return;
      // сессия протухла или стёрта — честно выходим, а не делаем вид, что вошли
      if (/заново/.test(e.message)) { leaveProfile().then((id) => { onSwitched(id); onClose(); }); } else setError(e.message);
    });
    return () => { alive = false; };
  }, []);
  if (!account) return null;
  const save = async (patch) => {
    setBusy(true); setError(''); setNote('');
    try {
      const r = await accountUpdate(account.token, patch);
      setProfile(r.profile);
      saveAccount({ ...account, ...fromProfile(r.profile) });
      setNote('Сохранено'); Audio.play('click');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const changePw = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const r = await accountPassword(account.token, oldPw, newPw);
      // смена пароля закрыла все сессии — этому устройству сервер выдал новую
      if (r && r.token) saveAccount({ ...account, token: r.token });
      setOldPw(''); setNewPw(''); setPanel(null); setNote('Пароль изменён, входы на других устройствах закрыты');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const newCode = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const r = await accountRecoveryNew(account.token, oldPw);
      setOldPw(''); setPanel(null); setShownCode(r.recoveryCode); setProfile(r.profile);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const logout = async () => {
    const id = await leaveProfile();
    Audio.play('click'); onSwitched(id); onClose();
  };
  const Icon = emblemIcon(account.emblem);
  const st = profile ? profile.stats : null;
  if (shownCode) {
    return (
      <ModalShell title="Новый код восстановления" icon={KeyRound} onClose={() => setShownCode(null)}>
        <RecoveryCodeView code={shownCode} onDone={() => setShownCode(null)} doneLabel="Готово" />
      </ModalShell>
    );
  }
  return (
    <ModalShell title="Профиль" icon={User} onClose={onClose}>
      {storageMemory && <StorageWarning />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div className="ds-panel" style={{ width: 50, height: 50, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={'var(--u-ink)'} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="ds-h3" style={{ fontSize: 18, color: 'var(--ds-ink)' }}>{account.name}</div>
          <div className="ds-num" style={{ fontSize: 14, color: 'var(--ds-ink3)' }}>@{account.login}
            {profile && profile.createdAt ? ` · с ${new Date(profile.createdAt).toLocaleDateString('ru-RU')}` : ''}</div>
        </div>
      </div>
      {/* только то, что сыграно; «выходы из партий» не показываем: счётчик, который стыдит */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
        {[['Комнат', st && st.rooms], ['Кварталов по сети', st && st.quarters]].map(([lbl, v]) => (
          <div key={lbl} style={{ background: 'var(--ds-card2)', border: '1px solid var(--ds-rule2)', padding: '8px 6px', textAlign: 'center' }}>
            <div className="ds-num" style={{ fontSize: 17, color: 'var(--u-ink)' }}>{v == null ? '—' : v}</div>
            <div style={{ fontSize: 14, color: 'var(--ds-ink3)', marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>
      {profile && !profile.hasRecovery && (
        <div style={{ fontSize: 12, color: 'var(--u-ink)', lineHeight: 1.5, marginBottom: 12 }}>
          У профиля нет кода восстановления — без него забытый пароль не вернуть. Получите его кнопкой «Код восстановления» ниже.
        </div>
      )}
      <label htmlFor="account-name" style={{ display: 'block', fontSize: 12, marginBottom: 5 }}>Имя в игре</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="ds-field" />
        <button className="ds-btn ds-btn--secondary ds-btn--small" disabled={busy || name.trim() === account.name || name.trim().length < 2}
          style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => save({ name: name.trim() })}>Сохранить</button>
      </div>
      <div style={{ fontSize: 12, marginBottom: 5 }}>Значок</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {EMBLEMS.map((em) => {
          const EI = em.icon; const on = account.emblem === em.id;
          return (
            <button key={em.id} className="ds-btn ds-btn--secondary ds-btn--small" aria-label={em.label} aria-pressed={on} disabled={busy}
              style={{ padding: 8, lineHeight: 0, borderColor: on ? 'var(--u-ink)' : 'var(--ds-rule2)', background: on ? 'var(--ds-card2)' : undefined }}
              onClick={() => { if (!on) save({ emblem: em.id }); }}><EI size={16} color={on ? 'var(--u-ink)' : 'var(--ds-ink2)'} /></button>
          );
        })}
      </div>
      {profile && <KidsModeBox profile={profile} busy={busy} save={save} />}
      {profile && <LeagueNameBox profile={profile} busy={busy} save={save} />}
      {panel === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <input type="password" placeholder="Старый пароль" aria-label="Старый пароль" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" className="ds-field" />
          <input type="password" placeholder="Новый пароль" aria-label="Новый пароль" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" className="ds-field" />
          <button className="ds-btn ds-btn--secondary ds-btn--small" disabled={busy || newPw.length < 6 || !oldPw}  onClick={changePw}>Сменить пароль</button>
        </div>
      )}
      {panel === 'recovery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--ds-ink2)', lineHeight: 1.5 }}>Новый код заменит прежний. Для этого нужен пароль.</div>
          <input type="password" placeholder="Пароль" aria-label="Пароль" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" className="ds-field" />
          <button className="ds-btn ds-btn--secondary ds-btn--small" disabled={busy || !oldPw}  onClick={newCode}>Получить новый код</button>
        </div>
      )}
      {panel === 'delete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }} data-testid="account-delete-panel">
          <div style={{ fontSize: 14, color: 'var(--ds-bad)', lineHeight: 1.5 }}>
            Удалятся профиль, прогресс, сохранения, рекорды и ваши сообщения об ошибках. Отменить это нельзя. Введите пароль, чтобы подтвердить.
          </div>
          <input type="password" placeholder="Пароль" aria-label="Пароль" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" className="ds-field" data-testid="account-delete-password" />
          <button className="ds-btn ds-btn--small" style={{ background: 'var(--ds-bad-btn)', borderColor: 'var(--ds-bad-btn)' }} disabled={busy || !oldPw} onClick={removeAll} data-testid="account-delete-confirm">Удалить навсегда</button>
        </div>
      )}
      {error && (error === RUDE_NAME ? <div style={{ marginBottom: 8 }}><NameRefused text={error} name={name} screen="profile" /></div> : <div style={{ fontSize: 14, color: 'var(--ds-bad)', marginBottom: 8 }}>{error}</div>)}
      {note && <div style={{ fontSize: 14, color: 'var(--ds-ok)', marginBottom: 8 }}>{note}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="ds-btn ds-btn--secondary ds-btn--small" aria-pressed={panel === 'password'} 
          onClick={() => { setOldPw(''); setPanel(panel === 'password' ? null : 'password'); }}><KeyRound size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Пароль</button>
        <button className="ds-btn ds-btn--secondary ds-btn--small" aria-pressed={panel === 'recovery'} 
          onClick={() => { setOldPw(''); setPanel(panel === 'recovery' ? null : 'recovery'); }}>Код восстановления</button>
        <button className="ds-btn ds-btn--secondary ds-btn--small" style={{ marginLeft: 'auto' }} onClick={logout}><LogOut size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Выйти</button>
      </div>
      <div style={{ borderTop: '1px dotted var(--ds-rule2)', marginTop: 14, paddingTop: 10 }} data-testid="account-data">
        <div style={{ fontSize: 13, color: 'var(--ds-ink3)', marginBottom: 6 }}>Ваши данные</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button className="ds-btn ds-btn--secondary ds-btn--small" disabled={busy} onClick={download} data-testid="account-export">Скачать мои данные</button>
          <button className="ds-btn ds-btn--secondary ds-btn--small" aria-pressed={panel === 'delete'} data-testid="account-delete"
            onClick={() => { setOldPw(''); setPanel(panel === 'delete' ? null : 'delete'); }}>Удалить аккаунт и все данные</button>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--small" onClick={() => setPrivacy(true)} data-testid="account-privacy">{PRIVACY_TITLE}</button>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--small" onClick={() => setPrivacy('terms')} data-testid="account-terms">{TERMS_TITLE}</button>
        </div>
      </div>
      {privacy === true && <PrivacyPage onClose={() => setPrivacy(false)} />}
      {privacy === 'terms' && <TermsPage onClose={() => setPrivacy(false)} />}
    </ModalShell>
  );
}

/* Детский режим «Мира» в профиле: до 16 — включён, переключателя нет; старше — переключатель;
   год рождения не указан (профиль заведён до этого правила) — поле, чтобы указать его один раз. */
function KidsModeBox({ profile, busy, save }) {
  const [year, setYear] = useState('');
  const kid = profile.birthYear && isKid(profile.birthYear);
  return (
    <div data-testid="kids-mode" style={{ background: 'var(--ds-card2)', border: '1px solid var(--ds-rule2)', padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ds-ink)', marginBottom: 4 }}>Детский режим «Мира»</div>
      <div style={{ fontSize: 13, color: 'var(--ds-ink2)', lineHeight: 1.5, marginBottom: 8 }}>
        В партии нет войн, присоединения земель, переворотов и несвободных режимов — только экономика, выборы, реформы и торговля.
      </div>
      {!profile.birthYear ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><BirthYearField value={year} set={setYear} /></div>
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--small" disabled={busy || !validBirthYear(birthYearOf(year))}
            onClick={() => save({ birthYear: birthYearOf(year) })} style={{ marginBottom: 26 }}>Сохранить</button>
        </div>
      ) : kid ? (
        <div style={{ fontSize: 13, color: 'var(--u-ink)' }} data-testid="kids-mode-forced">Включён: до {KIDS_AGE} лет режим не выключается.</div>
      ) : (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--ds-ink)' }}>
          <input type="checkbox" checked={!!profile.kidsMode} disabled={busy} data-testid="kids-mode-toggle"
            onChange={(e) => save({ kidsMode: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--u)' }} />
          Включить детский режим
        </label>
      )}
      {!profile.birthYear && <div style={{ fontSize: 13, color: 'var(--ds-ink3)', marginTop: 2 }}>Пока год не указан, режим включён. Год задаётся один раз.</div>}
    </div>
  );
}

/* Имя в лигах недели (src/learn/league.js): по умолчанию выключено; с 16 лет — переключатель.
   Честно пишем, что будет: имя может появиться у других учеников на месте бота с выдуманным опытом. */
function LeagueNameBox({ profile, busy, save }) {
  const allowed = profile.birthYear && !isKid(profile.birthYear);
  return (
    <div data-testid="league-name" style={{ background: 'var(--ds-card2)', border: '1px solid var(--ds-rule2)', padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ds-ink)', marginBottom: 4 }}>Имя в лигах недели</div>
      <div style={{ fontSize: 13, color: 'var(--ds-ink2)', lineHeight: 1.5, marginBottom: 8 }}>
        Соперники в лигах — ученики-боты. Если включить, ваше имя из профиля может появиться у других учеников на месте бота — с выдуманным опытом. Логин и значок не показываются.
      </div>
      {allowed ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--ds-ink)' }}>
          <input type="checkbox" checked={!!profile.leaguePublic} disabled={busy} data-testid="league-name-toggle"
            onChange={(e) => save({ leaguePublic: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--u)' }} />
          Показывать моё имя в лигах
        </label>
      ) : <div style={{ fontSize: 13, color: 'var(--ds-ink3)' }} data-testid="league-name-locked">Доступно с {KIDS_AGE} лет.</div>}
    </div>
  );
}

// кнопка профиля в шапке меню: имя со значком или приглашение войти
export function ProfileChip({ account, onClick }) {
  const Icon = account ? emblemIcon(account.emblem) : LogIn;
  return (
    <button className="ems-btn menu-profile" onClick={onClick} aria-label={account ? `Профиль: ${account.name}` : 'Войти в профиль'}>
      <Icon size={15} color={'var(--u-ink)'} />
      <span className="menu-profile-name">{account ? account.name : 'Войти'}</span>
    </button>
  );
}
