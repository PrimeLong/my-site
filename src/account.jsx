/* Профиль игрока: вход, регистрация, восстановление доступа, окно профиля и кнопка
   в шапке меню. Вынесено из MacroSimulator.jsx; общие вещи (тема, звук, playerId
   устройства и синхронизация прогресса) — оттуда же, те же объекты. */
import React, { useState } from 'react';
import { Star, Crown, Landmark, Coins, Shield, Anchor, Factory, Wheat, User, LogIn, LogOut, KeyRound, X, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  accountRegister, accountLogin, accountMe, accountUpdate, accountPassword, accountLogout, accountRecover, accountRecoveryNew,
} from './lib/client.js';
import {
  COLOR, Audio, useEscapeClose, getPlayerId, syncProfile, readLocalProgress, writeLocalProgress, PLAYER_ID_KEY,
} from './MacroSimulator.jsx';

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
  saveAccount({ token, login: profile.login, name: profile.name, emblem: profile.emblem });
  syncProfile(profile.playerId || cur);
  return profile.playerId || cur;
};

// выход: сессия гасится на сервере, устройство возвращается к своему профилю
const leaveProfile = async () => {
  const a = loadAccount();
  if (a) accountLogout(a.token).catch(() => { /* сессия и так протухнет */ });
  saveAccount(null);
  try {
    const prev = JSON.parse(localStorage.getItem(ACCOUNT_PREV_KEY) || 'null');
    if (prev && prev.playerId) {
      localStorage.setItem(PLAYER_ID_KEY, prev.playerId);
      writeLocalProgress(prev.progress);
    }
    localStorage.removeItem(ACCOUNT_PREV_KEY);
  } catch { /* приватный режим */ }
  return getPlayerId();
};

const fieldStyle = () => ({ width: '100%', padding: '9px 11px', fontSize: 13, background: COLOR.panelAlt,
  border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text });

function ModalShell({ title, icon: Icon, onClose, children, label }) {
  useEscapeClose(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div role="dialog" aria-label={label || title} className="ems-panel-raised ems-fade-in" style={{ maxWidth: 420, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>{title}</span>
          <button className="ems-btn" aria-label="Закрыть" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// предупреждение, когда сервер работает без общего хранилища: профиль там не выживет
function StorageWarning() {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: COLOR.rust, lineHeight: 1.5, marginBottom: 10 }}>
      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
      Сервер работает без общего хранилища (Redis): профили и сессии могут пропадать. Это настройка развёртывания —
      нужны переменные KV_REST_API_URL и KV_REST_API_TOKEN.
    </div>
  );
}

/* Код восстановления показываем один раз: почты у игры нет, и без кода забытый
   пароль не вернуть. Кнопка «Я сохранил» — нарочно отдельное действие. */
function RecoveryCodeView({ code, onDone, doneLabel = 'Я сохранил код' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* код виден на экране */ }
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.55, marginBottom: 10 }}>
        Это код восстановления. Если забудете пароль, по нему можно задать новый. Сохраните его где-нибудь вне игры:
        показываем его только сейчас.
      </div>
      <div className="ems-mono" data-testid="recovery-code" style={{ fontSize: 20, letterSpacing: '0.12em', textAlign: 'center', padding: '12px 8px',
        background: COLOR.panelAlt, border: `1px dashed ${COLOR.gold}`, color: COLOR.goldSoft, marginBottom: 10 }}>{code}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="ems-btn" style={{ padding: '9px 12px', fontSize: 12 }} onClick={copy}>
          {copied ? <Check size={12} style={{ verticalAlign: -2, marginRight: 5 }} /> : <Copy size={12} style={{ verticalAlign: -2, marginRight: 5 }} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
        <button type="button" className="ems-btn primary" style={{ flex: 1, padding: '9px 0', fontSize: 13 }} onClick={onDone}>{doneLabel}</button>
      </div>
    </div>
  );
}

/* Вход, регистрация и восстановление доступа. reason — зачем просим войти (например,
   перед сетевой игрой). */
export function AuthModal({ onClose, onDone, reason }) {
  const [tab, setTab] = useState('register');   // register | login | recover
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageMemory, setStorageMemory] = useState(false);
  // после регистрации или восстановления сначала показываем новый код, потом закрываемся
  const [shownCode, setShownCode] = useState(null);
  const [finish, setFinish] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const lg = login.trim().toLowerCase();
      const r = tab === 'register' ? await accountRegister(lg, password, name.trim(), getPlayerId())
        : tab === 'recover' ? await accountRecover(lg, code, password)
          : await accountLogin(lg, password);
      if (!r || !r.token || !r.profile) throw new Error('Сервер не ответил');
      const playerId = adoptProfile(r.token, r.profile);
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
  const canSubmit = login.trim().length >= 3 && password.length >= 6 && (tab !== 'recover' || code.replace(/[^A-Za-z0-9]/g, '').length >= 12);
  return (
    <ModalShell title={titles[tab]} label="Профиль игрока" icon={User} onClose={onClose}>
      {reason && <div style={{ fontSize: 12, color: COLOR.text, marginBottom: 12, lineHeight: 1.5 }}>{reason}</div>}
      {tab !== 'recover' && (
        <div className="ems-seg" role="tablist" style={{ display: 'flex', marginBottom: 14 }}>
          {[['register', 'Новый профиль'], ['login', 'У меня есть профиль']].map(([id, lbl]) => (
            <button key={id} type="button" role="tab" aria-pressed={tab === id} style={{ flex: 1, padding: '7px 8px', fontSize: 12 }}
              onClick={() => { setTab(id); setError(''); }}>{lbl}</button>
          ))}
        </div>
      )}
      {tab === 'recover' && (
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Введите логин, код восстановления, который вы получили при регистрации, и новый пароль. Все прежние входы в профиль
          на других устройствах закроются.
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 12 }}>Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none"
            placeholder="латиница, цифры, _" style={{ ...fieldStyle(), marginTop: 5 }} />
        </label>
        {tab === 'recover' && (
          <label style={{ fontSize: 12 }}>Код восстановления
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX"
              className="ems-mono" style={{ ...fieldStyle(), marginTop: 5, letterSpacing: '0.08em' }} />
          </label>
        )}
        <label style={{ fontSize: 12 }}>{tab === 'recover' ? 'Новый пароль' : 'Пароль'}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'} placeholder="не короче 6 символов"
            style={{ ...fieldStyle(), marginTop: 5 }} />
        </label>
        {tab === 'register' && (
          <label style={{ fontSize: 12 }}>Имя в игре
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="как вас видят партнёры" maxLength={24}
              style={{ ...fieldStyle(), marginTop: 5 }} />
          </label>
        )}
        {tab === 'register' && (
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.5 }}>
            Сохранения, достижения и пройденные курсы с этого устройства перейдут в профиль — войдите с ним на другом
            устройстве, и они будут там.
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: COLOR.rust }}>{error}</div>}
        <button type="submit" className="ems-btn primary" disabled={busy || !canSubmit} style={{ padding: '11px 0', marginTop: 2 }}>
          {busy ? 'Минутку…' : tab === 'register' ? 'Создать профиль' : tab === 'recover' ? 'Задать новый пароль' : 'Войти'}
        </button>
        {tab === 'login' && (
          <button type="button" className="ems-btn ghost" style={{ padding: '6px 0', fontSize: 12, background: 'none', border: 'none', color: COLOR.muted }}
            onClick={() => { setTab('recover'); setError(''); setPassword(''); }}>Забыли пароль?</button>
        )}
        {tab === 'recover' && (
          <button type="button" className="ems-btn ghost" style={{ padding: '6px 0', fontSize: 12, background: 'none', border: 'none', color: COLOR.muted }}
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
  const [panel, setPanel] = useState(null);     // null | 'password' | 'recovery'
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [shownCode, setShownCode] = useState(null);
  React.useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    accountMe(account.token).then((r) => {
      if (!alive || !r || !r.profile) return;
      setProfile(r.profile); setName(r.profile.name); setStorageMemory(r.storage === 'memory');
      saveAccount({ ...account, name: r.profile.name, emblem: r.profile.emblem });
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
      saveAccount({ ...account, name: r.profile.name, emblem: r.profile.emblem });
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
        <div className="ems-card-icon" style={{ width: 50, height: 50 }}><Icon size={24} color={COLOR.gold} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="ems-serif" style={{ fontSize: 18, color: COLOR.text }}>{account.name}</div>
          <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>@{account.login}
            {profile && profile.createdAt ? ` · с ${new Date(profile.createdAt).toLocaleDateString('ru-RU')}` : ''}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
        {[['Комнат', st && st.rooms], ['Кварталов по сети', st && st.quarters], ['Выходов из партий', st && st.leaves]].map(([lbl, v]) => (
          <div key={lbl} style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, padding: '8px 6px', textAlign: 'center' }}>
            <div className="ems-mono" style={{ fontSize: 17, color: COLOR.goldSoft }}>{v == null ? '—' : v}</div>
            <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>
      {profile && !profile.hasRecovery && (
        <div style={{ fontSize: 12, color: COLOR.goldSoft, lineHeight: 1.5, marginBottom: 12 }}>
          У профиля нет кода восстановления — без него забытый пароль не вернуть. Получите его кнопкой «Код восстановления» ниже.
        </div>
      )}
      <div style={{ fontSize: 12, marginBottom: 5 }}>Имя в игре</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} style={fieldStyle()} />
        <button className="ems-btn" disabled={busy || name.trim() === account.name || name.trim().length < 2}
          style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => save({ name: name.trim() })}>Сохранить</button>
      </div>
      <div style={{ fontSize: 12, marginBottom: 5 }}>Значок</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {EMBLEMS.map((em) => {
          const EI = em.icon; const on = account.emblem === em.id;
          return (
            <button key={em.id} className="ems-btn" aria-label={em.label} aria-pressed={on} disabled={busy}
              style={{ padding: 8, lineHeight: 0, borderColor: on ? COLOR.gold : COLOR.border, background: on ? COLOR.panelAlt : undefined }}
              onClick={() => { if (!on) save({ emblem: em.id }); }}><EI size={16} color={on ? COLOR.gold : COLOR.muted} /></button>
          );
        })}
      </div>
      {panel === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <input type="password" placeholder="Старый пароль" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" style={fieldStyle()} />
          <input type="password" placeholder="Новый пароль" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" style={fieldStyle()} />
          <button className="ems-btn" disabled={busy || newPw.length < 6 || !oldPw} style={{ padding: '7px 0', fontSize: 12 }} onClick={changePw}>Сменить пароль</button>
        </div>
      )}
      {panel === 'recovery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>Новый код заменит прежний. Для этого нужен пароль.</div>
          <input type="password" placeholder="Пароль" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" style={fieldStyle()} />
          <button className="ems-btn" disabled={busy || !oldPw} style={{ padding: '7px 0', fontSize: 12 }} onClick={newCode}>Получить новый код</button>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 8 }}>{error}</div>}
      {note && <div style={{ fontSize: 12, color: COLOR.teal, marginBottom: 8 }}>{note}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="ems-btn" aria-pressed={panel === 'password'} style={{ padding: '6px 10px', fontSize: 12 }}
          onClick={() => { setOldPw(''); setPanel(panel === 'password' ? null : 'password'); }}><KeyRound size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Пароль</button>
        <button className="ems-btn" aria-pressed={panel === 'recovery'} style={{ padding: '6px 10px', fontSize: 12 }}
          onClick={() => { setOldPw(''); setPanel(panel === 'recovery' ? null : 'recovery'); }}>Код восстановления</button>
        <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={logout}><LogOut size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Выйти</button>
      </div>
    </ModalShell>
  );
}

// кнопка профиля в шапке меню: имя со значком или приглашение войти
export function ProfileChip({ account, onClick }) {
  const Icon = account ? emblemIcon(account.emblem) : LogIn;
  return (
    <button className="ems-btn menu-profile" onClick={onClick} aria-label={account ? `Профиль: ${account.name}` : 'Войти в профиль'}>
      <Icon size={15} color={COLOR.gold} />
      <span className="menu-profile-name">{account ? account.name : 'Войти'}</span>
    </button>
  );
}
