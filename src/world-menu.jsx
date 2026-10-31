/* МЕНЮ «МИРА» — главное меню партии (MainMenu), экран новой партии (SetupScreen), вызов дня и окно
   достижений. Вынесены из MacroSimulator.jsx в ленивый модуль: на приветствии, Пути и в учебнике они не
   нужны, а весили около сотни килобайт стартового JS (docs/mechanics.md, «Приветствие и загрузка»).
   Грузится, когда открыта вкладка «Мир» или экран новой партии. */
import React, { useState, useEffect } from 'react';
import {
  fetchRoom, fetchSoloSlots, fetchSoloSlot, deleteSoloSlot, fetchDailyBoard, fetchTycoonSlots, fetchTycoonSlot, deleteTycoonSlot,
} from './lib/client.js';
import {
  Users, ChevronDown, X, Check, AlertTriangle, Bot, Target, Flag, Dices, Clock, Trophy, Lock,
  GraduationCap, FlaskConical, BookOpenText, Crown, Play, Calendar, Factory, Save, Landmark,
} from 'lucide-react';
import {
  CONFIG, ROLES, DIFFICULTIES, GOALS, SCENARIOS, CB_PERSONAS, MOF_PERSONAS, romanQ, quarterLabel, PRESIDENT_PERSONAS,
  dailyChallenge, dailyKey, dailySetup, SECTORS,
} from './lib/catalog.js';
import { seatRole } from './lib/seats.js';
import { InflatiaMark } from './logo.jsx';
import { AuthModal, ProfileModal, ProfileChip, useAccount, emblemIcon, accountKidsMode } from './account.jsx';
import { DsRoot, Button } from './ds.jsx';
import {
  Audio, ACHIEVEMENTS, AudioControls, COLOR, GlobalStyle, ROLE_ICON, SOLO_SLOT_COUNT, TYCOON_SAVE_KEY, WORLD_THEMES,
  clearNetworkSlotAt, getPlayerId, loadAutosave, loadNetworkSlots, loadRolesPlayed, loadTycoonSave, loadUnlockedAchievements,
  preloadGame, syncProfile, useEscapeClose, useNetworkSlotPreviews,
} from './MacroSimulator.jsx';
export function AchievementsModal({ onClose }) {
  useEscapeClose(onClose);
  const unlocked = loadUnlockedAchievements();
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 560, width: '100%', maxHeight: '82vh', overflow: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Trophy size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Коллекция достижений</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 14 }}>
          Открыто {count} из {ACHIEVEMENTS.length}. Привязано к профилю, а не к сохранению партии: «Начать заново»
          коллекцию не сбрасывает, а связанные устройства делят её на двоих.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const done = !!unlocked[a.id];
            const AchIcon = a.icon;
            return (
              <div key={a.id} className="ems-panel" style={{ padding: '9px 11px', display: 'flex', gap: 10, alignItems: 'flex-start',
                opacity: done ? 1 : 0.55, borderColor: done ? COLOR.gold : COLOR.border }}>
                <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done ? <AchIcon size={19} color={COLOR.goldSoft} /> : <Lock size={18} color={COLOR.faint} />}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: done ? COLOR.goldSoft : COLOR.text }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ============================ ВЫЗОВ ДНЯ ============================
   Карточка в меню, таблица результатов и то, что помнит само устройство: имя для
   таблицы и лучший свой балл за сегодня (чтобы карточка показывала его сразу, без
   запроса к серверу). Сам итог партии считает и отправляет экран партии. */
const DAILY_NAME_KEY = 'ems.daily.name';
const DAILY_BEST_KEY = 'ems.daily.best';
export function loadDailyName() {
  try { return localStorage.getItem(DAILY_NAME_KEY) || ''; } catch { return ''; }
}
export function saveDailyName(name) {
  try { localStorage.setItem(DAILY_NAME_KEY, name); } catch { /* приватный режим — имя просто не запомнится */ }
}
function loadDailyBest(day) {
  try {
    const v = JSON.parse(localStorage.getItem(DAILY_BEST_KEY) || 'null');
    return v && v.day === day && Number.isFinite(v.score) ? v : null;
  } catch { return null; }
}
export function recordDailyBest(day, score, defeated) {
  const prev = loadDailyBest(day);
  if (prev && prev.score >= score) return;
  try { localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ day, score, defeated: !!defeated })); } catch { /* см. выше */ }
}
export const dailyDateLabel = (day) => new Date(`${day}T12:00:00Z`)
  .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
// до полуночи по Москве — когда сменится вызов
function untilNextDaily(now = Date.now()) {
  const msk = now + 3 * 3600 * 1000;
  const left = 86400000 - (msk % 86400000);
  const h = Math.floor(left / 3600000); const m = Math.floor((left % 3600000) / 60000);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
const dailyRoleShort = (id) => (ROLES.find((r) => r.id === id) || {}).short || id;

/* Таблица дня. Если данные уже есть (ответ на отправку результата), показывает их,
   иначе запрашивает сама. playerId наружу не уходит — сервер помечает свою строку. */
export function DailyBoard({ day, data: given = null, limit = 10 }) {
  const [fetched, setFetched] = useState(null);
  const [err, setErr] = useState('');
  React.useEffect(() => {
    if (given) return undefined;
    let alive = true;
    setErr('');
    fetchDailyBoard(day, getPlayerId())
      .then((d) => { if (alive) setFetched(d); })
      .catch((e) => { if (alive) setErr(e.message || 'Таблица недоступна'); });
    return () => { alive = false; };
  }, [day, given]);
  const data = given || fetched;
  if (err) return <div style={{ fontSize: 12, color: COLOR.rust }}>{err}</div>;
  if (!data) return <div style={{ fontSize: 12, color: COLOR.faint }}>Загружаем таблицу…</div>;
  const rows = (data.rows || []).slice(0, limit);
  if (!rows.length) return <div style={{ fontSize: 12, color: COLOR.faint }}>Сегодня ещё никто не прошёл вызов — будьте первым.</div>;
  const you = data.you && !rows.some((r) => r.you) ? data.you : null;
  const row = (r) => (
    <div key={`${r.rank}-${r.name}`} style={{
      display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto auto', alignItems: 'center', gap: 8, padding: '6px 9px',
      background: r.you ? COLOR.goldDim : COLOR.panelAlt,
      border: `1px solid ${r.you ? COLOR.gold : COLOR.border}`, fontSize: 12 }}>
      <span className="ems-mono" style={{ color: r.rank <= 3 ? COLOR.gold : COLOR.faint, fontWeight: 600 }}>{r.rank}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.you ? COLOR.goldSoft : COLOR.text }}>
        {/* значок — у строк, записанных из профиля: имя за ними подтверждено */}
        {r.verified && (() => { const Em = emblemIcon(r.emblem); return <Em size={11} color={COLOR.gold} style={{ verticalAlign: -1, marginRight: 4 }} aria-label="профиль" />; })()}
        {r.name}{r.you ? ' (вы)' : ''}
      </span>
      <span style={{ fontSize: 12, color: r.defeated ? COLOR.rust : COLOR.faint, whiteSpace: 'nowrap' }}>
        {r.defeated ? `поражение, кв. ${r.quarters}` : dailyRoleShort(r.role)}
      </span>
      <span className="ems-mono" style={{ color: r.you ? COLOR.gold : COLOR.text, fontWeight: 600, minWidth: 34, textAlign: 'right' }}>
        {r.score.toFixed(1).replace('.', ',')}
      </span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(row)}
      {you && <div style={{ textAlign: 'center', color: COLOR.faint, fontSize: 12, lineHeight: 1 }}>⋯</div>}
      {you && row(you)}
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 3 }}>
        Всего участников: {data.total}. В таблице — лучший результат каждого за день.
      </div>
    </div>
  );
}

function DailyCard({ onStart }) {
  const ch = React.useMemo(() => dailyChallenge(dailyKey()), []);
  const [open, setOpen] = useState(false);
  const best = loadDailyBest(ch.day);
  const scenario = SCENARIOS.find((x) => x.id === ch.scenario) || SCENARIOS[0];
  const diff = DIFFICULTIES.find((x) => x.id === ch.difficulty) || DIFFICULTIES[1];
  const goal = GOALS.find((g) => g.id === ch.goal);
  const cbName = (CB_PERSONAS.find((x) => x.id === ch.cbPersona) || {}).name;
  const mofName = (MOF_PERSONAS.find((x) => x.id === ch.mofPersona) || {}).name;
  const presName = (PRESIDENT_PERSONAS.find((x) => x.id === ch.presPersona) || {}).name;
  const rivals = ch.role === 'central_bank' ? `Минфин: ${mofName} · президент: ${presName}`
    : ch.role === 'ministry_finance' ? `ЦБ: ${cbName} · президент: ${presName}`
      : ch.role === 'president' ? `ЦБ: ${cbName} · Минфин: ${mofName}` : 'обе ветви в ваших руках';
  const roleTitle = (ROLES.find((r) => r.id === ch.role) || {}).short;
  return (
    <div className="ds-card" style={{ marginBottom: 18 }} data-testid="daily-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Calendar size={18} color="var(--u-ink)" style={{ flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div className="ds-eyebrow">Вызов дня</div>
          <div className="ds-h3">{dailyDateLabel(ch.day)}</div>
          <div className="ds-sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {roleTitle} · {scenario.id === 'sandbox' ? 'спокойный старт' : scenario.title.toLowerCase()} · {diff.title.toLowerCase()} · {ch.quarters} кв.
            {best ? <> · ваш лучший <b className="ds-num" style={{ color: 'var(--u-ink)' }}>{best.score.toFixed(1).replace('.', ',')}</b></> : null}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Button small onClick={() => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onStart(ch); }}>
          {best ? 'Ещё раз' : 'Принять вызов'}
        </Button>
        <Button small variant="secondary" icon={Trophy} aria-expanded={open} onClick={() => { Audio.play('tab'); setOpen((v) => !v); }}>Таблица дня</Button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="ds-sub" style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }}>
            Одна партия на всех: тот же пост, тот же кризис и те же случайные события. Итог — пять оценок, где цель дня
            («{goal ? goal.label.toLowerCase() : '—'}») весит вдвое. Боты: {rivals}. Новый вызов через {untilNextDaily()}.
          </div>
          <DailyBoard day={ch.day} />
        </div>
      )}
    </div>
  );
}

/* Живая строка над меню: пустовавшая треть экрана стала биржевым табло страны.
   Числа — не из движка (меню не грузит его ради украшения), а лёгкое случайное
   блуждание вокруг стартовых значений партии: инфляция, ставка, рост, курс, индекс
   биржи и заголовки из жизни Инфляции и соседей. Мини-график — инфляция за
   последние «кварталы» табло. При «уменьшить движение» строка стоит на месте. */
const TICKER_HEADLINES = ['ЦБ сохранил ключевую ставку', 'Минфин разместил облигации на 40 млрд', 'Норланд наращивает рыбный экспорт',
  'Вестравия зовёт в торговый блок', 'Урожай в Приреченской выше ожиданий', 'Дешт снизил цены на нефть', 'Стройка метро в Велеграде идёт по графику',
  'Профсоюзы требуют индексации зарплат', 'Рудногорские копи увеличили добычу'];
const TICKER_BASE = [
  { id: 'inf', label: 'Инфляция', v: 4.0, step: 0.12, unit: '%', dec: 1, bad: true },
  { id: 'rate', label: 'Ставка ЦБ', v: 5.5, step: 0.05, unit: '%', dec: 2, grid: 0.25 },
  { id: 'gdp', label: 'Рост ВВП', v: 2.3, step: 0.1, unit: '%', dec: 1 },
  { id: 'unemp', label: 'Безработица', v: 5.0, step: 0.06, unit: '%', dec: 1, bad: true },
  { id: 'fx', label: 'Курс', v: 100, step: 0.4, unit: '', dec: 1, bad: true },
  { id: 'idx', label: 'Индекс ВБ', v: 1000, step: 6, unit: '', dec: 0 },
];
function MenuTicker() {
  const [rows, setRows] = useState(() => TICKER_BASE.map((r) => ({ ...r, prev: r.v })));
  const [infHist, setInfHist] = useState(() => Array.from({ length: 16 }, (_, i) => 4 + Math.sin(i / 2.3) * 0.5));
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setRows((list) => list.map((r) => {
        const base = TICKER_BASE.find((b) => b.id === r.id).v;
        // шаг к стартовому значению плюс шум: табло живое, но не уходит в абсурд
        let v = r.v + (base - r.v) * 0.08 + (Math.random() - 0.5) * 2 * r.step;
        if (r.grid) v = Math.round(v / r.grid) * r.grid;
        return { ...r, prev: r.v, v };
      }));
      setInfHist((h) => [...h.slice(1), h[h.length - 1] + (4 - h[h.length - 1]) * 0.1 + (Math.random() - 0.5) * 0.3]);
    }, 3500);
    return () => clearInterval(id);
  }, []);
  const lo = Math.min(...infHist) - 0.2; const hi = Math.max(...infHist) + 0.2;
  const pts = infHist.map((v, i) => `${(i / (infHist.length - 1)) * 120},${34 - ((v - lo) / (hi - lo)) * 30}`).join(' ');
  const cells = rows.map((r) => {
    const d = r.v - r.prev;
    const up = d > 1e-9; const down = d < -1e-9;
    const tone = !up && !down ? COLOR.faint : (up !== !!r.bad) ? COLOR.teal : COLOR.rust;
    return (
      <span key={r.id} className="menu-tick-cell">
        <span style={{ color: COLOR.muted }}>{r.label}</span>{' '}
        <span className="ems-mono" style={{ color: COLOR.text }}>{r.v.toFixed(r.dec).replace('.', ',')}{r.unit}</span>{' '}
        <span style={{ color: tone, fontSize: 12 }}>{up ? '▲' : down ? '▼' : '•'}</span>
      </span>
    );
  });
  const news = TICKER_HEADLINES.map((h) => <span key={h} className="menu-tick-cell" style={{ color: COLOR.goldSoft }}>◆ {h}</span>);
  return (
    <div className="ems-fade-in menu-ticker" aria-hidden="true">
      <div className="menu-ticker-spark">
        <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Инфляция, 4 года</div>
        <svg width="120" height="36" viewBox="0 0 120 36" style={{ display: 'block' }}>
          <polyline points={pts} fill="none" stroke={COLOR.gold} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="120" cy={34 - ((infHist[infHist.length - 1] - lo) / (hi - lo)) * 30} r="2.4" fill={COLOR.goldSoft} />
        </svg>
      </div>
      <div className="menu-ticker-band">
        <div className="menu-ticker-track">{cells}{news}{cells.map((c) => React.cloneElement(c, { key: `${c.key}b` }))}{news.map((c) => React.cloneElement(c, { key: `${c.key}b` }))}</div>
      </div>
    </div>
  );
}


export function MainMenu({ theme, setTheme, onNewGame, onNetwork, onTutorial, onLoad, onEnterNetwork, onDaily, onTycoon, onLab, onTextbook, onDrills, inShell = false }) {
  // профиль может смениться прямо здесь (связывание устройств), поэтому это
  // состояние, а не разовое чтение: после связывания список слотов перечитывается
  const [playerId, setPlayerIdState] = useState(getPlayerId);
  // экран партии подтягиваем в фоне, когда меню уже нарисовано
  React.useEffect(() => { const t = setTimeout(preloadGame, 1500); return () => clearTimeout(t); }, []);
  const [soloSlots, setSoloSlots] = useState(null);
  const [slotBusy, setSlotBusy] = useState(null);
  const [slotError, setSlotError] = useState('');
  const [storageMode, setStorageMode] = useState(null);
  const [showAch, setShowAch] = useState(false);
  // профиль игрока в шапке меню: вход, регистрация, статистика
  const account = useAccount();
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const switchPlayer = (id) => { setPlayerIdState(id); setSoloSlots(null); setSlotError(''); };
  const profileSlot = <ProfileChip account={account} onClick={() => { Audio.play('click'); if (account) setShowProfile(true); else setShowAuth(true); }} />;
  // партия из автосохранения обычно открывается сама, минуя меню (см. App()) —
  // сюда игрок попадает с ней «на руках» только если разбирался с крашем
  // («Вернуться в меню» не трогает автосохранение) или пришёл по ссылке-
  // приглашению в сетевую комнату. Карточка здесь — и подстраховка на этот
  // случай, и просто видимое подтверждение того, что автосохранение вообще есть.
  const [autosave] = useState(loadAutosave);
  // сетевая партия ничего не теряет при случайном закрытии вкладки (комната
  // живёт на сервере), но раньше, чтобы в неё вернуться, нужно было ещё
  // знать, что для этого нужно зайти в «Игра по сети» → «Ваши партии» —
  // не самый очевидный путь после случайной перезагрузки. Здесь та же
  // карточка «на видном месте», что и для одиночного автосохранения.
  const [networkSlots, setNetworkSlots] = useState(loadNetworkSlots);
  const networkSlotPreviews = useNetworkSlotPreviews(networkSlots);
  const [networkSlotBusy, setNetworkSlotBusy] = useState(null);
  const enterNetworkSlot = async (idx) => {
    const slot = networkSlots[idx];
    if (!slot) return;
    setNetworkSlotBusy(idx);
    try {
      const data = await fetchRoom(slot.id, undefined, slot.seat, slot.token);
      if (!data.room) throw new Error('Комната недоступна');
      Audio.prime(); Audio.play('stamp'); Audio.startMusic();
      onEnterNetwork({ id: slot.id, seat: slot.seat, token: slot.token, ownerToken: slot.ownerToken || null, room: data.room });
    } catch {
      clearNetworkSlotAt(idx); setNetworkSlots(loadNetworkSlots());
    } finally { setNetworkSlotBusy(null); }
  };
  React.useEffect(() => {
    fetchSoloSlots(playerId).then((d) => { setSoloSlots(d.slots); setStorageMode(d.storage || null); })
      .catch(() => setSoloSlots(Array(SOLO_SLOT_COUNT).fill(null)));
    if (onTycoon) fetchTycoonSlots(playerId).then((d) => setTycoonSlots(d.slots || [])).catch(() => setTycoonSlots([]));
    // заодно подтягиваем общий прогресс: со связанного устройства могли прийти
    // новые достижения и пройденные модули
    syncProfile(playerId);
  }, [playerId]);
  /* Меню — тоже часть игры, и тишины в нём быть не должно. Автозапуск звука
     браузер не разрешает до первого действия человека, поэтому заводим музыку
     либо сразу (если звук уже разбужен в этой сессии — например, игрок вернулся
     из обучения), либо по первому же клику или нажатию клавиши.
     Роль при выходе не сбрасываем: следом идёт экран новой партии, и обрывать
     музыку между двумя экранами меню было бы хуже, чем дать ей доиграть. */
  React.useEffect(() => {
    Audio.setRole('menu');
    const kick = () => { if (Audio.prime() && Audio.opts.music) Audio.startMusic(); };
    if (Audio.primed()) kick();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);
  const enterSlot = async (idx) => {
    setSlotBusy(idx); setSlotError('');
    try {
      const snap = await fetchSoloSlot(playerId, idx);
      Audio.prime(); Audio.play('stamp'); Audio.startMusic();
      onLoad({ ...snap, slotIdx: idx });
    } catch (e) { setSlotError(e.message); setSlotBusy(null); }
  };
  const removeSlot = async (idx) => {
    try { setSoloSlots(await deleteSoloSlot(playerId, idx)); } catch (e) { setSlotError(e.message); }
  };
  const hasSaves = !!(soloSlots && soloSlots.some(Boolean));
  const removeTycoonSlot = async (idx) => {
    if (!window.confirm(`Удалить сохранение «Своего дела» из слота ${idx + 1}?`)) return;
    try { setTycoonSlots(await deleteTycoonSlot(playerId, idx)); } catch (e) { setSlotError(e.message); }
  };
  // автосохранение «Своего дела» в браузере: удалить, чтобы начать с чистого листа
  const removeTycoonAutosave = () => {
    if (!window.confirm('Удалить автосохранение «Своего дела» в этом браузере? Слоты на сервере останутся.')) return;
    try { localStorage.removeItem(TYCOON_SAVE_KEY); } catch { /* приватный режим */ }
    setTycoonSave(null);
  };

  const [tycoonSave, setTycoonSave] = useState(loadTycoonSave);
  const [tycoonSlots, setTycoonSlots] = useState([]);
  const [tycoonBusy, setTycoonBusy] = useState(null);
  const [savesOpen, setSavesOpen] = useState(false);
  const [savesTab, setSavesTab] = useState('solo');
  const enterTycoonSlot = async (idx) => {
    setTycoonBusy(idx);
    try { const snap = await fetchTycoonSlot(playerId, idx); Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(snap); }
    catch (e) { setSlotError(e.message); setTycoonBusy(null); }
  };
  const roleShort = (id) => (ROLES.find((r) => r.id === id) || {}).short || id;
  const moneyShort = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} млрд` : v >= 1 ? `${v.toFixed(1)} млн` : `${Math.round(v * 1000)} тыс`);

  /* «Продолжить» — одна главная кнопка вместо трёх карточек с сохранениями подряд:
     самое свежее из одиночной партии и «Своего дела»; второе — строкой под ней. */
  const soloTime = autosave ? Date.parse(autosave.savedAt || 0) || 0 : 0;
  const tycoonTime = tycoonSave ? Number(tycoonSave.savedAt) || 0 : 0;
  const continues = [
    autosave && { id: 'solo', time: soloTime, icon: ROLE_ICON[(ROLES.find((r) => r.id === autosave.setup.role) || {}).icon] || Flag,
      title: roleShort(autosave.setup.role), sub: `${quarterLabel(autosave.quarterIndex || 1)}${autosave.setup.daily ? ' · вызов дня' : ''}`,
      go: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onLoad(autosave); } },
    tycoonSave && onTycoon && { id: 'tycoon', time: tycoonTime, icon: Factory, title: 'Своё дело', remove: removeTycoonAutosave,
      sub: `${tycoonSave.buildings.length} зданий · на счёте ${moneyShort(tycoonSave.cash || 0)}`,
      go: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(tycoonSave); } },
  ].filter(Boolean).sort((x, y) => y.time - x.time);
  const mainContinue = continues[0] || null;
  const savesCount = { solo: (soloSlots || []).filter(Boolean).length, tycoon: tycoonSlots.filter(Boolean).length, network: networkSlots.filter(Boolean).length };
  const savesTotal = savesCount.solo + savesCount.tycoon + savesCount.network;

  /* Меню в два блока: «Учиться» (учебник, задачи на 10 минут, лаборатория) и «Играть»
     (партия, «Своё дело», сеть, «Как играть» и вызов дня). */
  const LEARN = [
    ...(onTextbook ? [{ id: 'textbook', icon: BookOpenText, title: 'Учебник', tag: 'микро и макро · задачи · графики',
      desc: 'Главы первого курса экономфака с формулами, графиками и задачами — и в каждой главе: где эту модель видно в игре и чем игра от неё отличается.',
      action: () => { Audio.prime(); Audio.play('tab'); onTextbook(); } }] : []),
    ...(onDrills ? [{ id: 'drills', icon: Target, title: 'Задачи на 10 минут', tag: 'цель · кварталы · разбор',
      desc: 'Короткая партия с одной целью — например, инфляцию с 12% до 4% за восемь кварталов без рецессии. В конце — разбор и слепой прогноз.',
      action: () => { Audio.prime(); Audio.play('tab'); onDrills(); } }] : []),
    ...(onLab ? [{ id: 'lab', icon: FlaskConical, title: 'Лаборатория', tag: 'один рычаг — два мира',
      desc: 'Меняете один рычаг, шоки выключены: графики показывают чистый эффект на инфляцию, выпуск, безработицу и курс за 12 кварталов.',
      action: () => { Audio.prime(); Audio.play('tab'); onLab(); } }] : []),
  ];
  const PLAY = [
    { id: 'new', icon: Landmark, title: 'Партия у руля страны', tag: 'ЦБ · Минфин · президент · премьер · трейдер',
      desc: 'Выберите пост и проведите страну через кризисы, выборы и войны. Второй ветвью власти управляет бот со своим характером.',
      action: () => { Audio.prime(); Audio.play('stamp'); onNewGame(); } },
    ...(onTycoon ? [{ id: 'tycoon', icon: Factory, title: 'Своё дело', tag: 'тайкун в реальном времени',
      desc: 'Фермы, заводы, магазины и экспорт по всей стране. Экономика живёт сама — вы строите бизнес внутри неё.',
      action: () => { Audio.prime(); Audio.play('stamp'); Audio.startMusic(); onTycoon(tycoonSave); } }] : []),
    { id: 'network', icon: Users, title: 'По сети', tag: 'вдвоём или втроём',
      desc: 'ЦБ, Минфин и президент — разные люди на одной экономике. Комната по коду или из списка открытых.',
      action: () => { Audio.prime(); Audio.play('tab'); onNetwork(); } },
    { id: 'tutorial', icon: GraduationCap, title: 'Как играть', tag: 'курсы с практикой',
      desc: 'Как устроены экран партии, ставка, бюджет, рынок и власть — короткими уроками с тестами и экзаменами.',
      action: () => { Audio.prime(); Audio.play('tab'); onTutorial(); } },
  ];
  const renderModes = (list, delay = 0) => (
    <div className="menu-modes">
      {list.map((m, i) => {
        const Icon = m.icon;
        return (
          <div key={m.id} className="ds-card menu-mode" style={{ cursor: 'pointer', padding: 14 }} data-mode={m.id} data-delay={delay + i}
            role="button" tabIndex={0} onClick={m.action} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') m.action(); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--u)', color: 'var(--ds-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={19} aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="ds-h3">{m.title}</div>
                <div className="ds-eyebrow" style={{ fontSize: 12, letterSpacing: '.08em', marginTop: 2 }}>{m.tag}</div>
              </div>
            </div>
            <div className="menu-mode-desc ds-sub" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 9 }}>{m.desc}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <DsRoot world={COLOR} className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: inShell ? '28px 16px 104px' : '36px 16px 48px' }} data-testid="world">
      <GlobalStyle />
      <style>{menuCss()}</style>
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onDone={(pf, id) => switchPlayer(id)} />}
      {/* сохранения и достижения едут за профилем — «связать устройства» кодом больше не нужно */}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} onSwitched={switchPlayer} />}
      {/* margin: auto по вертикали — меню стоит по центру высокого экрана, а когда
          раскрыты сохранения и оно выше окна, просто прокручивается, не уезжая вверх */}
      <div style={{ maxWidth: 760, width: '100%', margin: 'auto 0' }}>
        <MenuTicker />
        {/* шапка: печать, название и одна строка о том, что это */}
        <div className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          <InflatiaMark size={54} title={null} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="ds-h1 menu-title" data-testid="brand">Инфляция</h1>
            {/* один слоган везде (docs/world.md); раздел — «Мир: страна, где знания проверяются в деле» */}
            <div className="ems-hero-eyebrow menu-eyebrow" style={{ textAlign: 'left', marginTop: 3 }}>экономика пять минут в день</div>
            <div className="menu-section-title" data-testid="world-title" style={{ fontSize: 14, color: COLOR.muted, marginTop: 4 }}>Мир: страна, где знания проверяются в деле</div>
          </div>
          {!inShell && profileSlot}
        </div>

        {storageMode === 'memory' && (
          <div className="ems-fade-in" style={{ fontSize: 12, color: COLOR.rust, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            Сервер без общего хранилища (Redis): сохранения на сервере могут пропадать. Это настройка развёртывания, не партии.
          </div>
        )}


        {/* 2. Учиться */}
        <div className="menu-section-label ds-eyebrow">{inShell ? 'Модель в действии' : 'Учиться'}</div>
        {renderModes(LEARN)}

        {/* 3. Играть: продолжить партию, режимы, вызов дня */}
        <div className="menu-section-label ds-eyebrow">Играть</div>
        {mainContinue && (
          <div className="ds-card menu-continue" role="button" tabIndex={0} onClick={mainContinue.go}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') mainContinue.go(); }}>
            <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 4, background: 'var(--ds-card2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><mainContinue.icon size={21} color={COLOR.gold} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ds-eyebrow">Продолжить</div>
              <div className="ds-h3" style={{ marginTop: 1 }}>{mainContinue.title}</div>
              <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>{mainContinue.sub}</div>
            </div>
            {mainContinue.remove && (
              <button className="menu-x" aria-label="Удалить автосохранение «Своего дела»" title="Удалить автосохранение"
                onClick={(e) => { e.stopPropagation(); mainContinue.remove(); }} onKeyDown={(e) => e.stopPropagation()}><X size={13} /></button>
            )}
            <Play size={22} color={COLOR.gold} style={{ flexShrink: 0 }} />
          </div>
        )}
        {continues[1] && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <button type="button" className="ds-card ds-card--button menu-continue-alt ems-fade-in" style={{ flex: 1 }} onClick={continues[1].go}>
              <span style={{ color: COLOR.faint }}>или</span> {continues[1].title} · <span style={{ color: COLOR.muted }}>{continues[1].sub}</span>
              <ChevronDown size={13} style={{ transform: 'rotate(-90deg)', marginLeft: 'auto' }} />
            </button>
            {continues[1].remove && (
              <button type="button" className="ds-card ds-card--button menu-continue-alt" style={{ width: 'auto', padding: '0 12px' }} aria-label="Удалить автосохранение «Своего дела»"
                title="Удалить автосохранение" onClick={continues[1].remove}><X size={13} /></button>
            )}
          </div>
        )}

        {renderModes(PLAY, 150)}
        {onDaily && <DailyCard onStart={(ch) => onDaily(dailySetup(ch))} />}

        {/* 4. Все сохранения — свёрнуты, чтобы не заслонять главное */}
        {savesTotal > 0 && (
          <div className="ds-card" style={{ padding: 0, marginBottom: 18, overflow: 'hidden' }}>
            <button className="menu-fold" aria-expanded={savesOpen} onClick={() => { Audio.play('tab'); setSavesOpen((v) => !v); }}>
              <Save size={14} color={COLOR.gold} />
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Все сохранения</span>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{savesTotal}</span>
              <ChevronDown size={14} color={COLOR.muted} style={{ marginLeft: 'auto', transform: savesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {savesOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <div role="group" aria-label="Какие сохранения" style={{ display: 'flex', margin: '0 -4px 10px' }}>
                  {[['solo', 'Партии'], ['tycoon', 'Своё дело'], ['network', 'По сети']].filter(([id]) => savesCount[id] > 0 || id === 'solo').map(([id, label]) => (
                    <button key={id} type="button" className="ds-chip" aria-pressed={savesTab === id} style={{ flex: 1, fontSize: 13 }}
                      onClick={() => setSavesTab(id)}>{label} · {savesCount[id]}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {savesTab === 'solo' && (hasSaves ? soloSlots.map((slot, idx) => (slot ? (
                    <div key={idx} className="ems-row-hover menu-slot">
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {slot.name && <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.name}</span>}
                        <span style={{ fontSize: 12, color: slot.name ? COLOR.faint : COLOR.text }}>
                          Слот {idx + 1} · {roleShort(slot.role)} · {quarterLabel(slot.quarterIndex || 1)}
                        </span>
                      </span>
                      <Button small variant="secondary" disabled={slotBusy === idx}
                        onClick={() => enterSlot(idx)}>{slotBusy === idx ? 'Загружаем…' : 'Играть'}</Button>
                      <button onClick={() => removeSlot(idx)} aria-label="Удалить сохранение" className="menu-x"><X size={12} /></button>
                    </div>
                  ) : null)) : <div style={{ fontSize: 12, color: COLOR.faint }}>Сохранённых партий на сервере нет — сохраняйте кнопкой «Партия» в игре.</div>)}
                  {savesTab === 'tycoon' && tycoonSlots.map((slot, idx) => (slot ? (
                    <div key={idx} className="ems-row-hover menu-slot">
                      <span style={{ flex: 1, minWidth: 0 }}>Слот {idx + 1} · {quarterLabel(slot.quarterIndex || 1)} · {slot.buildings} зданий</span>
                      <Button small variant="secondary" disabled={tycoonBusy === idx}
                        onClick={() => enterTycoonSlot(idx)}>{tycoonBusy === idx ? 'Загружаем…' : 'Играть'}</Button>
                      <button onClick={() => removeTycoonSlot(idx)} aria-label="Удалить сохранение" className="menu-x"><X size={12} /></button>
                    </div>
                  ) : null))}
                  {savesTab === 'network' && networkSlots.map((slot, idx) => {
                    if (!slot) return null;
                    const rd = seatRole(slot.seat);
                    const preview = networkSlotPreviews[idx];
                    return (
                      <div key={idx} className="ems-row-hover menu-slot">
                        <span style={{ flex: 1, minWidth: 0 }}>
                          Комната <b className="ems-mono">{slot.id}</b> · {rd.short}{preview && <span style={{ color: COLOR.faint }}> · {quarterLabel(preview.quarterIndex)}</span>}
                        </span>
                        <Button small variant="secondary" disabled={networkSlotBusy === idx}
                          onClick={() => enterNetworkSlot(idx)}>{networkSlotBusy === idx ? 'Входим…' : 'Войти'}</Button>
                      </div>
                    );
                  })}
                </div>
                {slotError && <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 8 }}>{slotError}</div>}
              </div>
            )}
          </div>
        )}

        {/* 5. Мелкое: достижения, устройства, оформление, звук */}
        <div className="menu-footer ems-fade-in">
          <Button small variant="ghost" icon={Trophy} onClick={() => { Audio.play('click'); setShowAch(true); }}>Достижения</Button>
          <label className="menu-chip menu-theme">
            <span style={{ fontSize: 12, color: COLOR.faint }}>Оформление</span>
            <select value={theme} onChange={(e) => { Audio.play('tab'); setTheme(e.target.value); }} aria-label="Оформление">
              {WORLD_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <AudioControls />
        </div>
      </div>
    </DsRoot>
  );
}

// функция, а не строка: цвета берутся из текущей темы при каждой отрисовке
const menuCss = () => `
  .menu-ticker { display: flex; align-items: center; gap: 14px; margin-bottom: 30px; padding: 10px 14px; border: 1px solid ${COLOR.border};
    border-radius: 12px; background: ${COLOR.panel}cc; overflow: hidden; }
  .menu-ticker-spark { flex-shrink: 0; padding-right: 14px; border-right: 1px solid ${COLOR.hairline}; }
  .menu-ticker-band { flex: 1; min-width: 0; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 3%, #000 94%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 3%, #000 94%, transparent); }
  .menu-ticker-track { display: inline-flex; white-space: nowrap; animation: menuTicker 70s linear infinite; }
  .menu-tick-cell { padding: 0 16px; font-size: 13px; }
  @keyframes menuTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (max-width: 560px) { .menu-ticker-spark { display: none; } .menu-ticker { margin-bottom: 22px; padding: 8px 10px; } }
  @media (prefers-reduced-motion: reduce) { .menu-ticker-track { animation: none; } }
  .menu-title { margin: 0; font-size: 30px; line-height: 1.05; font-weight: 700; letter-spacing: 0.02em; color: ${COLOR.goldSoft}; }
  @media (max-width: 560px) { .menu-title { font-size: 25px; } }
  .menu-profile { display: flex; align-items: center; gap: 7px; padding: 7px 11px; font-size: 13px; flex-shrink: 0; max-width: 170px; }
  .menu-profile-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 560px) { .menu-profile { padding: 7px 9px; max-width: 110px; } .menu-eyebrow { font-size: 12px; letter-spacing: 0.1em; } }
  .menu-continue { display: flex; align-items: center; gap: 14px; cursor: pointer; margin-bottom: 8px; }
  .menu-continue:focus-visible { outline: 3px solid var(--ds-sel-rule); outline-offset: 2px; }
  .menu-continue-alt { width: 100%; display: flex; align-items: center; gap: 6px; padding: 9px 14px; font-size: 13px; text-align: left; margin-bottom: 4px; }
  .menu-section-label { margin: 22px 0 10px; }
  .menu-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
  @media (max-width: 600px) { .menu-modes { grid-template-columns: minmax(0, 1fr); } }
  .menu-mode { display: flex; flex-direction: column; }
  @media (max-width: 600px) { .menu-mode-desc { display: none; } .menu-mode { padding: 12px 14px; } }
  .menu-fold { width: 100%; display: flex; align-items: center; gap: 8px; padding: 13px 15px; background: none; border: none; cursor: pointer; font: inherit; color: inherit; text-align: left; }
  .menu-slot { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: ${COLOR.panelAlt}; border: 1px solid ${COLOR.border}; font-size: 12px; color: ${COLOR.text}; }
  .menu-x { background: none; border: none; cursor: pointer; color: ${COLOR.faint}; padding: 2px; line-height: 0; }
  .menu-footer { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .menu-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; font-size: 12px; border-radius: 999px; }
  .menu-theme { border: 1px solid ${COLOR.border}; background: ${COLOR.panelAlt}; }
  .menu-theme select { background: transparent; color: ${COLOR.text}; border: none; font: inherit; font-size: 12px; cursor: pointer; }
  .menu-theme select option { background: ${COLOR.panel}; color: ${COLOR.text}; }
`;

/* ============================ ЭКРАН ВЫБОРА ============================ */
export function SetupScreen({ onStart, onBack, initialRole = null, initialScenario = null, initialSector = null }) {
  React.useEffect(preloadGame, []);
  const [role, setRole] = useState(initialRole);
  const [difficulty, setDifficulty] = useState('medium');
  const [goal, setGoalRaw] = useState('living_standards');
  const setGoal = (g) => setGoalRaw(g);
  React.useEffect(() => { setGoalRaw(role === 'trader' ? 'max_wealth' : role === 'entrepreneur' ? 'company_value' : 'living_standards'); }, [role]);
  // отрасль компании — только для предпринимателя
  const [sector, setSector] = useState(initialSector || 'farm');
  // из учебника можно прийти с уже выбранным сценарием
  const [scenario, setScenario] = useState(() => (initialScenario && SCENARIOS.some((x) => x.id === initialScenario) ? initialScenario : 'sandbox'));
  // сценарий, где роли нет (Греция в валютном союзе — без своего ЦБ), сбрасывается при смене роли
  React.useEffect(() => {
    const sc = SCENARIOS.find((x) => x.id === scenario);
    if (sc && (sc.noRoles || []).includes(role)) setScenario('sandbox');
  }, [role, scenario]);
  // обучение по экрану партии: у тех, кто ещё не играл ни одной ролью, включено само
  const [tour, setTour] = useState(() => loadRolesPlayed().length === 0);
  // «Только экономика»: война заморожена — ни нападений, ни указов о ней, ни кнопок на карте
  const [economyOnly, setEconomyOnly] = useState(false);
  // детский режим «Мира» (до 16 лет всегда, старше — в профиле): войн нет и так
  const kidsMode = accountKidsMode(useAccount());
  const [cbPersona, setCbPersona] = useState('pragmatic');
  const [mofPersona, setMofPersona] = useState('technocrat');
  /* Классика против настраиваемой партии. В классике характеры ведомств бросаются
     случайно, а президент включён — то есть игрок садится за пульт, не выбирая
     заранее, с кем ему иметь дело. Все эти ручки никуда не делись, они просто не
     вываливаются на человека, который хочет просто начать играть. */
  // сценарий выбирается только в настраиваемой партии — пришли со сценарием, значит, она
  const [mode, setMode] = useState(initialScenario ? 'custom' : 'classic');
  const [presEnabled, setPresEnabled] = useState(true);
  const [presPersona, setPresPersona] = useState('random');
  const roleDef = ROLES.find((r) => r.id === role);
  const botRole = roleDef ? roleDef.botRole : null;
  // президент-бот имеет смысл только там, где над игроком вообще кто-то стоит
  const presAvailable = role === 'central_bank' || role === 'ministry_finance' || role === 'trader' || role === 'entrepreneur';
  const custom = mode === 'custom';
  const personaBlocks = botRole === 'central_bank' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' }]
    : botRole === 'ministry_finance' ? [{ list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }]
      : botRole === 'both' ? [{ list: CB_PERSONAS, value: cbPersona, set: setCbPersona, title: 'Характер Центрального банка' },
        { list: MOF_PERSONAS, value: mofPersona, set: setMofPersona, title: 'Характер Минфина' }] : [];

  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 800, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 34 }}>
          <div className="ems-hero-eyebrow">Новая партия</div>
          <div className="ems-hero-title small">Вступление в должность</div>
          <div className="ems-hero-rule" />
          <span className="ems-hero-badge"><Clock size={11} color={COLOR.gold} />{romanQ(1)} кв. {CONFIG.startYear}</span>
          <div className="ems-hero-lede">
            Экономика работает как цепочка причин: ставка → рыночные ставки → кредит → спрос → выпуск → занятость → зарплаты → цены → ожидания. Второй ветвью власти управляет бот со своим характером, а над обоими ведомствами стоит президент — и требования будут у каждого из них.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>1</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Ваш пост</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 26 }}>
          {/* «Своё дело» — отдельная игра со своим входом в меню: среди постов «Партии у
              руля страны» предприниматель только путал. И наоборот, из меню «Своего дела»
              государственные посты не предлагаются. */}
          {ROLES.filter((r) => (initialRole === 'entrepreneur') === (r.id === 'entrepreneur')).map((r) => {
            const Icon = ROLE_ICON[r.icon]; const active = role === r.id;
            return (
              <div key={r.id} onClick={() => { Audio.prime(); Audio.play('click'); setRole(r.id); }} className="ems-card-btn"
                style={{ padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(r.id); }}>
                {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 14, right: 14 }} />}
                {/* иконка — рядом с названием, а не отдельной строкой над ним: на телефоне
                    пять карточек растягивались на два экрана */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 7, paddingRight: 18 }}>
                  <div className="ems-card-icon" style={{ width: 34, height: 34 }}>
                    <Icon size={16} color={COLOR.gold} />
                  </div>
                  <div className="ems-serif" style={{ fontSize: 15, color: active ? COLOR.goldSoft : COLOR.text }}>{r.title}</div>
                </div>
                <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            );
          })}
        </div>

        {role === 'entrepreneur' && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Ваша компания</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 10, marginBottom: 26 }}>
              {SECTORS.map((sc) => {
                const active = sector === sc.id;
                return (
                  <div key={sc.id} onClick={() => { Audio.play('click'); setSector(sc.id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} aria-pressed={active} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSector(sc.id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div className="ems-serif" style={{ fontSize: 14, color: active ? COLOR.goldSoft : COLOR.text }}>{sc.title}</div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '2px 0 5px' }}>{sc.short}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{sc.desc}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {role && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>2</span>
              <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Как настраивать партию</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: custom ? 22 : 26 }}>
              {[['classic', 'Классика', 'Открытая партия без стартового кризиса, характеры ведомств бросаются случайно, президент включён. Начать и разбираться по ходу — как и должно быть в первый раз.'],
                ['custom', 'Настраиваемая', 'Выбрать стартовую ситуацию — от открытой партии до гиперинфляции, — характер каждого ведомства и президента или отключить президента совсем.']].map(([id, title, note]) => {
                const active = mode === id;
                return (
                  <div key={id} onClick={() => { Audio.play('click'); setMode(id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMode(id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div className="ems-serif" style={{ fontSize: 14, marginBottom: 4, color: active ? COLOR.goldSoft : COLOR.text }}>{title}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{note}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {custom && presAvailable && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Президент</span>
              <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12,
                background: presEnabled ? COLOR.sel : COLOR.panelAlt, color: presEnabled ? COLOR.selText : COLOR.muted,
                borderColor: presEnabled ? COLOR.selBorder : COLOR.border }}
                onClick={() => { Audio.play('tick'); setPresEnabled((v) => !v); }}>
                {presEnabled ? 'включён' : 'выключен'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10, lineHeight: 1.45 }}>
              {role === 'trader' || role === 'entrepreneur'
                ? `Президент не управляет ставкой и бюджетом, но требует своего от обоих ведомств и тратит политический капитал на реформы — для ${role === 'trader' ? 'рынка' : 'бизнеса'} это ещё один источник новостей и риска.`
                : 'Над вашим ведомством стоит президент: он выдвигает требования, назначает руководителя соседнего ведомства и тратит политический капитал на реформы и указы. Требования можно игнорировать — но администрация ведёт счёт, и на нуле терпения следует отставка.'}
            </div>
            {presEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 22 }}>
                {PRESIDENT_PERSONAS.map((p) => {
                  const active = presPersona === p.id;
                  return (
                    <div key={p.id} onClick={() => { Audio.play('click'); setPresPersona(p.id); }} className="ems-card-btn"
                      style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                        borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPresPersona(p.id); }}>
                      {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Crown size={14} color={active ? COLOR.gold : COLOR.muted} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
                    </div>
                  );
                })}
                {(() => {
                  const active = presPersona === 'random';
                  return (
                    <div onClick={() => { Audio.play('click'); setPresPersona('random'); }} className="ems-card-btn"
                      style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                        borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPresPersona('random'); }}>
                      {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Dices size={14} color={active ? COLOR.gold : COLOR.muted} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>С кем придётся работать, выяснится уже в должности.</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {custom && personaBlocks.map((blk, bi) => (
          <React.Fragment key={blk.title}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{bi === 0 ? '' : ''}</span>
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>{blk.title}</span>
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10 }}>
              {role === 'president'
                ? (blk.list === CB_PERSONAS
                  ? 'С этим человеком вы начнёте срок. Сменить его можно и позже — но досрочная отставка главы ЦБ стоит доверия к денежной политике.'
                  : 'С этим министром вы начнёте срок. Заменить его дешевле, чем главу ЦБ, — но бюджет будет переписан под нового.')
                : botRole === 'both' ? 'Вы не управляете этим ведомством — но от его решений зависит стоимость ваших активов.'
                  : blk.list === CB_PERSONAS ? 'Ставкой будет управлять бот-ЦБ. От его характера зависит, насколько дорого вам обойдётся бюджетная экспансия.'
                    : 'Бюджетом будет управлять бот-Минфин. От его характера зависит, с какой инфляцией и каким долгом вам придётся иметь дело.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10, marginBottom: 22 }}>
              {blk.list.map((p) => {
                const active = blk.value === p.id;
                return (
                  <div key={p.id} onClick={() => { Audio.play('click'); blk.set(p.id); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') blk.set(p.id); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Bot size={14} color={active ? COLOR.gold : COLOR.muted} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{p.desc}</div>
                  </div>
                );
              })}
              {(() => {
                const active = blk.value === 'random';
                return (
                  <div onClick={() => { Audio.play('click'); blk.set('random'); }} className="ems-card-btn"
                    style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                      borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                    role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') blk.set('random'); }}>
                    {active && <Check size={13} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Dices size={14} color={active ? COLOR.gold : COLOR.muted} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: active ? COLOR.goldSoft : COLOR.text }}>Случайный</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLOR.faint, margin: '4px 0 5px' }}>Неизвестность</div>
                    <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>Характер определится в момент вступления в должность — не будете знать заранее, с кем имеете дело.</div>
                  </div>
                );
              })()}
            </div>
          </React.Fragment>
        ))}

        {/* сценарий задаёт не песочницу, а другую стартовую точку той же экономики:
            переопределяет часть начальных условий движка, а не превращает партию
            во что-то отдельное — сюжет, обучение и достижения работают как обычно.
            Выбор сценария — часть настраиваемой партии: классика всегда начинается
            с открытой партии, как и положено в первый раз, а кризисные старты —
            для тех, кто уже решил, с чем хочет иметь дело. */}
        {custom && (<>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>{role ? 3 : 2}</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Стартовая ситуация</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px,1fr))', gap: 10, marginBottom: 26 }}>
          {[...SCENARIOS].filter((sc) => !(sc.noRoles || []).includes(role)).sort((a, b) => (a.level || 0) - (b.level || 0)).map((sc) => {
            const active = scenario === sc.id;
            // от спокойного к опасному: бирюзовый → золотой → ржавый
            const levelColor = sc.level >= 4 ? COLOR.rust : sc.level === 3 ? COLOR.gold : sc.level === 2 ? COLOR.goldSoft : COLOR.teal;
            return (
              <div key={sc.id} onClick={() => { Audio.play('click'); setScenario(sc.id); }} className="ems-card-btn"
                style={{ padding: 13, flexDirection: 'column', alignItems: 'flex-start', gap: 0,
                  borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.panelRaised : COLOR.panel }}
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScenario(sc.id); }}>
                {active && <Check size={12} color={COLOR.gold} style={{ position: 'absolute', top: 12, right: 12 }} />}
                <div className="ems-serif" style={{ fontSize: 13, marginBottom: 4, color: active ? COLOR.goldSoft : COLOR.text }}>{sc.title}</div>
                {sc.level && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
                    aria-label={`Сложность: ${sc.levelLabel}, ${sc.level} из 4`}>
                    <span aria-hidden style={{ display: 'flex', gap: 3 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} style={{ width: 12, height: 4, borderRadius: 2, background: i <= sc.level ? levelColor : COLOR.borderStrong, opacity: i <= sc.level ? 1 : 0.55 }} />
                      ))}
                    </span>
                    <span className="ems-mono" style={{ fontSize: 12, color: levelColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{sc.levelLabel}</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{sc.desc}</div>
                {sc.levelNote && <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginTop: 6 }}>{sc.levelNote}</div>}
              </div>
            );
          })}
        </div>
        </>)}

        {/* сложность и приоритет — это быстрые настройки, а не решения того же веса,
            что роль: сводим в одну компактную секцию вместо двух полноразмерных
            сеток карточек, чтобы «пост» на экране визуально оставался главным */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span className="ems-mono" style={{ fontSize: 13, color: COLOR.faint }}>{2 + (role ? 1 : 0) + (custom ? 1 : 0)}</span>
          <span className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft }}>Сложность и приоритет</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 20, marginBottom: 30 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {DIFFICULTIES.map((dd) => {
                const active = difficulty === dd.id;
                return (
                  <button type="button" key={dd.id} className={`ems-tab ${active ? 'active' : ''}`} aria-pressed={active}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0', fontSize: 13 }}
                    onClick={() => { Audio.play('click'); setDifficulty(dd.id); }}>{dd.title}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>
              {(DIFFICULTIES.find((dd) => dd.id === difficulty) || {}).desc}
            </div>
          </div>
          {role !== 'entrepreneur' && (
            <div>
              <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 8 }}>По какой оценке подводить итог партии</div>
              <div style={{ position: 'relative' }}>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="ems-btn"
                  style={{ width: '100%', padding: '10px 36px 10px 12px', fontSize: 13, appearance: 'none', WebkitAppearance: 'none' }}>
                  {GOALS.filter((g) => (role === 'trader' ? g.trader : role === 'entrepreneur' ? g.entrepreneur : !g.trader && !g.entrepreneur)).map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
                </select>
                <ChevronDown size={14} color={COLOR.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}
        </div>

        {role !== 'entrepreneur' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', marginBottom: 12, borderRadius: 10,
            border: `1px solid ${tour ? COLOR.gold : COLOR.border}`, background: tour ? COLOR.goldDim : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={tour} onChange={(e) => { Audio.play('tick'); setTour(e.target.checked); }}
              style={{ marginTop: 3, accentColor: COLOR.gold }} />
            <span>
              <span style={{ fontSize: 13, color: COLOR.text, fontWeight: 600 }}>Обучение по экрану партии</span>
              <span style={{ display: 'block', fontSize: 12, color: COLOR.muted, marginTop: 2, lineHeight: 1.45 }}>
                Для первой партии: по шагам покажем, где рычаги, показатели, график, оценки и кнопка квартала. Всё доступно сразу — обучение ничего не прячет. Повторить можно из меню «⋯».
              </span>
            </span>
          </label>
        )}
        {role !== 'entrepreneur' && kidsMode && (
          <div data-testid="kids-note" style={{ padding: '11px 13px', marginBottom: 12, borderRadius: 10, border: `1px solid ${COLOR.border}`, fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>
            <span style={{ fontSize: 13, color: COLOR.text, fontWeight: 600 }}>Детский режим</span>
            <span style={{ display: 'block', marginTop: 2 }}>Без войн, переворотов и несвободных режимов: экономика, выборы, реформы и торговля. Меняется в профиле.</span>
          </div>
        )}
        {role !== 'entrepreneur' && !kidsMode && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', marginBottom: 12, borderRadius: 10,
            border: `1px solid ${economyOnly ? COLOR.gold : COLOR.border}`, background: economyOnly ? COLOR.goldDim : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={economyOnly} onChange={(e) => { Audio.play('tick'); setEconomyOnly(e.target.checked); }}
              style={{ marginTop: 3, accentColor: COLOR.gold }} />
            <span>
              <span style={{ fontSize: 13, color: COLOR.text, fontWeight: 600 }}>Только экономика</span>
              <span style={{ display: 'block', fontSize: 12, color: COLOR.muted, marginTop: 2, lineHeight: 1.45 }}>
                Без войн: соседи не нападают, военных указов и кнопок нет. Выборы, общество, дипломатия и торговля — как обычно.
              </span>
            </span>
          </label>
        )}
        <button disabled={!role} className="ems-btn primary" style={{ width: '100%', padding: '13px 0', fontSize: 14 }}
          onClick={() => {
            if (!role) return;
            Audio.prime(); Audio.play('stamp'); Audio.startMusic();
            const pick = (list) => list[Math.floor(Math.random() * list.length)].id;
            const cbWanted = custom ? cbPersona : 'random';
            const mofWanted = custom ? mofPersona : 'random';
            const presWanted = custom ? presPersona : 'random';
            // классика всегда начинается с открытой партии, даже если в
            // настраиваемом режиме до этого успели выбрать кризисный сценарий
            onStart({ role, difficulty, goal, scenario: custom ? scenario : 'sandbox', tour, economyOnly, kidsMode,
              ...(role === 'entrepreneur' ? { sector } : {}),
              cbPersona: cbWanted === 'random' ? pick(CB_PERSONAS) : cbWanted,
              mofPersona: mofWanted === 'random' ? pick(MOF_PERSONAS) : mofWanted,
              president: { enabled: presAvailable && (custom ? presEnabled : true),
                persona: presWanted === 'random' ? pick(PRESIDENT_PERSONAS) : presWanted } });
          }}>
          Принять полномочия
        </button>
      </div>
    </div>
  );
}

