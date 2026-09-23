/* Сетевая партия: лобби (создать комнату, войти по коду, открытые комнаты),
   вход в комнату и сам экран партии на двоих-троих. Вынесено из
   MacroSimulator.jsx в отдельный чанк и грузится лениво — как обучение,
   газета и торговый терминал. Общие компоненты, тема (COLOR), звук и
   помощники сохранений — те же объекты, что в MacroSimulator.jsx
   (экспортированы оттуда), а не копии. */
import { AlertTriangle, BookOpen, Check, ChevronDown, Clock, Copy, Crown, Dices, Info, Map as MapIcon, Megaphone, Newspaper, RotateCcw, Share2, ShieldAlert, Star, TrendingUp, Trophy, Users, X } from 'lucide-react';
import { CB_PERSONAS, SCENARIOS, DIFFICULTIES, FX_REGIMES, GOALS, LEVERS, MOF_PERSONAS, POLITICAL_REGIME_INFO, PRESIDENT_PERSONAS, clamp, defaultDecisions, fmtSignedPct, leverPreview, pctFmt, pickPressQuestion, pressSpeakerSeat, quarterLabel, scaleLever } from './lib/engine.js';
import React, { Suspense, useMemo, useState } from 'react';
import { cancelSubmission, createRoom, fetchRoom, joinRoom, kickFromRoom, leaveRoom, listPublicRooms, reportPortfolioValue, sendChatMessage, setRoomDifficulty, submitDecisions, watchRoom } from './lib/client.js';
import {
  ALL_METRICS, AchievementToast, AchievementsModal, Atmosphere, Audio, AudioControls, COLOR, CabinetZone,
  CasinoScreen, ChartFallback, ChartPanel, ColumnResizeHandle, CountryMap, CrisisBar, DEFAULT_COLUMN_ORDER, GameOverBar,
  ChronicleModal, GameOverModal, Gauge, GlobalStyle, HeaderOverflowMenu, INDICATOR_TABS, INSTR_BY_ID, KpiTile, LeverSlider,
  MAX_PINS, MetricRow, NETWORK_SLOT_COUNT, NewsTerminal, NewspaperModal, PortfolioSummary, PresidentPanel, PresidentWatchPanel,
  PressConferencePanel, PromisesPanel, QuarterStamp, ROLE_ICON, RegimeBanner, ResultCardModal, RiskBadge, ScorePanel,
  FiscalLeverReadout, MonetaryLeverReadout, RegionEventStrip, Segmented, StateSeal, StateZone, TradingTerminal, ViewSettings, WhyModal, bookValue, buildResultCard,
  casinoAchievementIds, checkDefeat, clearNetworkSlotAt, clearNetworkSlotFor, emptyBook, haptic, initDashboards, loadAutoPaper,
  loadNetworkPortfolio, loadNetworkSlots, makeDashboardActions, markNetworkPlayed, priceOf, questProgressAchievementIds, recordRolePlayed, roomCodeFromUrl,
  saveAutoPaper, saveNetworkPortfolio, saveNetworkSlot, seatRole, seatsForMode, settleQuarter, tradeBook, unlockAchievements,
  useAchievementToasts, useChartView, useLayoutColumns, useNetworkSlotPreviews, usePinnedStrip,
} from './MacroSimulator.jsx';
import { stingerFor } from './audio/engine.js';

const CRISIS_SHORT = { banking: 'банковский кризис', debt: 'долговой кризис', currency: 'валютный кризис',
  stagflation: 'стагфляция', overheating: 'перегрев', recession: 'рецессия', deflation: 'дефляция',
  pandemic: 'пандемия', war: 'война' };

function NetworkLobby({ onEnter }) {
  const linkedCode = useMemo(roomCodeFromUrl, []);
  const [tab, setTab] = useState(linkedCode ? 'join' : 'create');
  const [seat, setSeat] = useState('central_bank');
  const [name, setName] = useState('');
  const [code, setCode] = useState(linkedCode);
  const [difficulty, setDifficulty] = useState('medium');
  const [mode, setMode] = useState('policy');
  /* Те же две настройки, что и в одиночной игре: «классика» бросает характеры
     ведомств случайно и включает президента, «настраиваемая» открывает всё это
     руками. До этого сетевая комната всегда собиралась с одними и теми же
     ботами и вообще без президента. */
  const [setupMode, setSetupMode] = useState('classic');
  // стартовая ситуация — только в настраиваемой партии, классика всегда открытая
  const [netScenario, setNetScenario] = useState('sandbox');
  const [cbPersona, setCbPersona] = useState('random');
  const [mofPersona, setMofPersona] = useState('random');
  const [presEnabled, setPresEnabled] = useState(true);
  const [presPersona, setPresPersona] = useState('random');
  // приватная (по умолчанию) — только по коду/ссылке; общедоступная попадает
  // в браузер комнат ниже, и войти в неё можно без кода вообще
  const [isPublicRoom, setIsPublicRoom] = useState(false);
  const [publicRooms, setPublicRooms] = useState(null);
  const [publicRoomsError, setPublicRoomsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [createdOwnerToken, setCreatedOwnerToken] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [slots, setSlots] = useState(loadNetworkSlots);
  const slotPreviews = useNetworkSlotPreviews(slots);
  const [slotBusy, setSlotBusy] = useState(null);
  const [roomPreview, setRoomPreview] = useState(null);
  // если сервер не подключён к Redis (нет KV_REST_API_URL/KV_REST_API_TOKEN),
  // комната живёт только в памяти одного serverless-вызова — партнёр или сам
  // игрок при следующем запросе почти наверняка получит «комната не найдена».
  // Ловим это здесь, чтобы не гадать по симптому, а сказать прямо.
  const [storageMode, setStorageMode] = useState(null);

  // подглядываем занятость мест ДО входа, чтобы не отправлять игрока на
  // «место уже занято» после того, как он уже заполнил форму. Опрашиваем
  // не один раз при вводе кода, а периодически, пока экран открыт: партнёр
  // мог занять место уже ПОСЛЕ того, как код был напечатан, — иначе кнопка
  // остаётся разблокированной до первой неудачной попытки входа
  React.useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setRoomPreview(null); return undefined; }
    let cancelled = false;
    const fetchPreview = async () => {
      try {
        const data = await fetchRoom(trimmed);
        if (!cancelled) { setRoomPreview(data.room); setStorageMode(data.storage || null); }
      } catch { if (!cancelled) setRoomPreview(null); }
    };
    const t = setTimeout(fetchPreview, 400);
    const iv = setInterval(fetchPreview, 3000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(iv); };
  }, [code]);
  React.useEffect(() => {
    if (!roomPreview) return;
    // переключаем выбранное место, если оно занято ИЛИ вообще не существует в
    // режиме этой комнаты (например, код привёл в «рыночную» комнату, а по
    // умолчанию выбран ЦБ — место из другого режима)
    const validSeats = previewSeats(roomPreview);
    const occ = roomPreview.occupied || {};
    if (!validSeats.includes(seat) || occ[seat]) {
      const free = validSeats.find((sx) => !occ[sx]) || validSeats[0];
      setSeat(free);
    }
  }, [roomPreview]);
  // браузер комнат: список общедоступных партий, куда можно войти без кода —
  // обновляем при открытии вкладки и затем периодически, пока она открыта
  React.useEffect(() => {
    if (tab !== 'browse') return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const rooms = await listPublicRooms();
        if (!cancelled) { setPublicRooms(rooms); setPublicRoomsError(''); }
      } catch (e) { if (!cancelled) setPublicRoomsError(e.message); }
    };
    load();
    const iv = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tab]);
  const joinPublicRoom = (rid) => {
    setCode(rid); setTab('join');
  };
  /* Место президента существует только там, где президент в комнате включён —
     иначе его незачем и показывать. */
  const previewSeats = (r) => seatsForMode(r ? r.mode : mode)
    // в «классике» президент включён — значит и место за него есть
    .filter((sx) => sx !== 'president' || !!(r ? r.president : (setupMode === 'classic' || presEnabled)));
  const allSeatsTaken = !!(roomPreview && roomPreview.occupied
    && previewSeats(roomPreview).every((sx) => roomPreview.occupied[sx]));

  const enterSlot = async (idx) => {
    const slot = slots[idx];
    if (!slot) return;
    setSlotBusy(idx); setError('');
    try {
      const data = await fetchRoom(slot.id, undefined, slot.seat, slot.token);
      if (!data.room) throw new Error('Комната недоступна');
      onEnter({ id: slot.id, seat: slot.seat, token: slot.token, ownerToken: slot.ownerToken || null, room: data.room });
    } catch (e) {
      setError(e.message);
      clearNetworkSlotAt(idx); setSlots(loadNetworkSlots());
    } finally { setSlotBusy(null); }
  };
  const removeSlot = (idx) => {
    const slot = slots[idx];
    if (slot && !window.confirm('Забыть эту партию? Ваше место освободится — партнёру вместо вас будет играть бот.')) return;
    if (slot) leaveRoom(slot.id, slot.seat, slot.token).catch(() => {}); // освобождаем место партнёру, раз партия забыта насовсем
    clearNetworkSlotAt(idx); setSlots(loadNetworkSlots());
  };

  const shareLink = (id) => `${window.location.origin}${window.location.pathname}?room=${id}`;
  const copyLink = (id) => {
    try {
      navigator.clipboard.writeText(shareLink(id));
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800);
    } catch { /* буфер обмена недоступен — код всё равно виден рядом */ }
  };
  const doCreate = async () => {
    setBusy(true); setError('');
    try {
      const custom = setupMode === 'custom';
      const asId = (v) => (v === 'random' ? undefined : v);
      const r = await createRoom({ difficulty, mode, public: isPublicRoom,
        cbPersona: custom ? asId(cbPersona) : undefined,
        mofPersona: custom ? asId(mofPersona) : undefined,
        president: custom && !presEnabled ? null : { persona: custom ? asId(presPersona) : undefined },
        scenario: custom ? netScenario : 'sandbox' });
      setCreated(r.id); setCreatedOwnerToken(r.ownerToken || null); setCode(r.id); setTab('join'); setStorageMode(r.storage || null);
      setSeat(seatsForMode(mode)[0]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const doJoin = async () => {
    if (!code.trim()) { setError('Введите код комнаты.'); return; }
    setBusy(true); setError('');
    try {
      const r = await joinRoom(code.trim().toUpperCase(), seat, name.trim() || 'игрок');
      setStorageMode(r.storage || null);
      Audio.play('stamp'); Audio.prime();
      const trimmedCode = code.trim().toUpperCase();
      // ownerToken есть только у того, кто сам только что создал ЭТУ комнату в этой
      // же сессии лобби — у всех остальных, кто просто вошёл по коду/ссылке, его нет
      const ownerToken = trimmedCode === created ? createdOwnerToken : null;
      const net = { id: trimmedCode, seat, token: r.token, ownerToken, room: r.room };
      saveNetworkSlot(net);
      // убираем ?room= из адресной строки, чтобы обновление страницы не пыталось
      // «войти по ссылке» повторно поверх уже сохранённой сессии
      if (typeof window !== 'undefined' && window.history && window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      onEnter(net);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      {slots.some(Boolean) && (
        <div className="ems-panel" style={{ padding: 14, marginBottom: 16 }}>
          <div className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft, marginBottom: 9 }}>Ваши партии ({slots.filter(Boolean).length}/{NETWORK_SLOT_COUNT})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((slot, idx) => {
              const rd = slot && seatRole(slot.seat);
              const SlotIcon = rd && ROLE_ICON[rd.icon];
              const preview = slotPreviews[idx];
              return (
                <div key={idx} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12 }}>
                  {slot ? (
                    <>
                      {SlotIcon && <SlotIcon size={14} color={COLOR.muted} />}
                      <span style={{ flex: 1, minWidth: 0, color: COLOR.text }}>
                        Комната <b className="ems-mono">{slot.id}</b> · {rd.short}
                        {preview && (
                          <span style={{ color: COLOR.faint }}> · {quarterLabel(preview.quarterIndex)}</span>
                        )}
                      </span>
                      <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 11 }} disabled={slotBusy === idx}
                        onClick={() => enterSlot(idx)}>{slotBusy === idx ? 'Входим…' : 'Войти'}</button>
                      <button onClick={() => removeSlot(idx)} aria-label="Забыть эту партию"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <span style={{ color: COLOR.faint }}>слот {idx + 1}: пусто</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {storageMode === 'memory' && (
        <div className="ems-panel" style={{ padding: 12, marginBottom: 16, borderColor: COLOR.rust }}>
          <div style={{ fontSize: 12, color: COLOR.rust, lineHeight: 1.5 }}>
            Сервер не подключён к общему хранилищу (Redis) — комната живёт только в памяти одного случайного запроса
            и может пропасть при следующем же обращении с ошибкой «комната не найдена». Это настройка развёртывания
            (нужны переменные окружения <b className="ems-mono">KV_REST_API_URL</b>/<b className="ems-mono">KV_REST_API_TOKEN</b> —
            подключаются через Upstash в Vercel Marketplace), а не баг в самой партии.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {[['create', 'Создать комнату'], ['join', 'Войти по коду'], ['browse', 'Открытые комнаты']].map(([id, label]) => (
          <span key={id} className={`ems-tab ${tab === id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setTab(id); setError(''); }}>{label}</span>
        ))}
      </div>

      {tab === 'create' && (
        <div className="ems-panel" style={{ padding: 18 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 10 }}>Новая сетевая партия</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Режим партии</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['policy', 'Политика', 'ЦБ и Минфин делят экономику'], ['trader', 'Рынок', 'два трейдера на одной экономике']].map(([id, title]) => (
                <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: mode === id ? COLOR.gold : COLOR.panelAlt, color: mode === id ? COLOR.ink : COLOR.text,
                  borderColor: mode === id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setMode(id); }}>{title}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 14, lineHeight: 1.5 }}>
            {mode === 'trader'
              ? 'Оба игрока — частные инвесторы на одной и той же экономике: ставку ведёт бот-ЦБ, бюджет — бот-Минфин, а вы независимо друг от друга распределяете капитал между активами. Квартал наступает, когда готовы оба.'
              : 'Один из вас ведёт Центральный банк, второй — Минфин, на одной и той же экономике; если включён президент — его тоже может занять живой игрок, третьим. Квартал наступает, когда решения пришлют все подключившиеся; за не занятое место временно решает бот.'}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Сложность партии</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICULTIES.map((d) => (
                <button key={d.id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: difficulty === d.id ? COLOR.gold : COLOR.panelAlt, color: difficulty === d.id ? COLOR.ink : COLOR.text,
                  borderColor: difficulty === d.id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setDifficulty(d.id); }}>{d.title}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Доступ к комнате</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[[false, 'По коду'], [true, 'Общедоступная']].map(([val, title]) => (
                <button key={String(val)} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: isPublicRoom === val ? COLOR.gold : COLOR.panelAlt, color: isPublicRoom === val ? COLOR.ink : COLOR.text,
                  borderColor: isPublicRoom === val ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setIsPublicRoom(val); }}>{title}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>
              {isPublicRoom
                ? 'Комната появится во вкладке «Открытые комнаты» у всех — войти сможет кто угодно, без кода. Как только все места заняты, она пропадает из списка сама.'
                : 'Войти можно только по коду комнаты или по ссылке-приглашению — как раньше.'}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Как настраивать партию</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['classic', 'Классика'], ['custom', 'Настраиваемая']].map(([id, title]) => (
                <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 12,
                  background: setupMode === id ? COLOR.gold : COLOR.panelAlt, color: setupMode === id ? COLOR.ink : COLOR.text,
                  borderColor: setupMode === id ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('click'); setSetupMode(id); }}>{title}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>
              {setupMode === 'classic'
                ? 'Открытая партия без стартового кризиса, характеры ведомств бросаются случайно, президент включён — как в одиночной классике.'
                : 'Выбрать стартовую ситуацию, характер каждого ведомства и президента — или обойтись без президента.'}
            </div>
          </div>

          {setupMode === 'custom' && (
            <div style={{ marginBottom: 14 }}>
              {/* те же сценарии и те же метки сложности, что и в одиночной игре */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Стартовая ситуация</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...SCENARIOS].sort((a, b) => (a.level || 0) - (b.level || 0)).map((sc) => {
                    const active = netScenario === sc.id;
                    const levelColor = sc.level >= 4 ? COLOR.rust : sc.level === 3 ? COLOR.gold : sc.level === 2 ? COLOR.goldSoft : COLOR.teal;
                    return (
                      <button key={sc.id} className="ems-btn" style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12,
                        background: active ? COLOR.goldDim : COLOR.panelAlt, borderColor: active ? COLOR.gold : COLOR.border, color: COLOR.text,
                        display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={() => { Audio.play('click'); setNetScenario(sc.id); }}>
                        <span style={{ flex: 1 }}>{sc.title}</span>
                        <span aria-hidden style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4].map((i) => (
                            <span key={i} style={{ width: 9, height: 3, borderRadius: 2, background: i <= sc.level ? levelColor : COLOR.borderStrong, opacity: i <= sc.level ? 1 : 0.55 }} />
                          ))}
                        </span>
                        <span className="ems-mono" style={{ fontSize: 9.5, color: levelColor, textTransform: 'uppercase', minWidth: 92, textAlign: 'right' }}>{sc.levelLabel}</span>
                      </button>
                    );
                  })}
                </div>
                {(() => { const sc = SCENARIOS.find((x) => x.id === netScenario); return sc && sc.levelNote
                  ? <div style={{ fontSize: 11, color: COLOR.faint, marginTop: 6, lineHeight: 1.4 }}>{sc.levelNote}</div> : null; })()}
              </div>
              {[['Характер Центрального банка', CB_PERSONAS, cbPersona, setCbPersona,
                mode === 'trader' ? 'Ставку ведёт бот — от его характера зависит весь рынок.' : 'Действует, пока место ЦБ пустует или игрок не успел с решением.'],
              ['Характер Минфина', MOF_PERSONAS, mofPersona, setMofPersona,
                mode === 'trader' ? 'Бюджет тоже ведёт бот: его щедрость — ваш долговой рынок.' : 'Действует, пока место Минфина пустует или игрок не успел с решением.']]
                .map(([title, list, value, set, note]) => (
                  <div key={title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 6, lineHeight: 1.4 }}>{note}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[...list, { id: 'random', name: 'Случайный' }].map((pp) => (
                        <button key={pp.id} className="ems-btn" style={{ flex: '1 1 30%', padding: '7px 0', fontSize: 11.5,
                          background: value === pp.id ? COLOR.gold : COLOR.panelAlt, color: value === pp.id ? COLOR.ink : COLOR.text,
                          borderColor: value === pp.id ? COLOR.gold : COLOR.border }}
                          onClick={() => { Audio.play('click'); set(pp.id); }}>{pp.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>Президент</span>
                <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 11,
                  background: presEnabled ? COLOR.gold : COLOR.panelAlt, color: presEnabled ? COLOR.ink : COLOR.muted,
                  borderColor: presEnabled ? COLOR.gold : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setPresEnabled((v) => !v); }}>
                  {presEnabled ? 'включён' : 'выключен'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 6, lineHeight: 1.4 }}>
                Над обоими ведомствами стоит президент: он требует своего от каждого из вас, меняет руководителя
                ведомства, за которым никто не сидит, и тратит политический капитал на реформы и указы.
              </div>
              {presEnabled && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...PRESIDENT_PERSONAS, { id: 'random', name: 'Случайный' }].map((pp) => (
                    <button key={pp.id} className="ems-btn" style={{ flex: '1 1 30%', padding: '7px 0', fontSize: 11.5,
                      background: presPersona === pp.id ? COLOR.gold : COLOR.panelAlt, color: presPersona === pp.id ? COLOR.ink : COLOR.text,
                      borderColor: presPersona === pp.id ? COLOR.gold : COLOR.border }}
                      onClick={() => { Audio.play('click'); setPresPersona(pp.id); }}>{pp.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="ems-btn primary" disabled={busy} style={{ width: '100%', padding: '11px 0' }} onClick={doCreate}>
            {busy ? 'Создаём…' : 'Создать комнату'}
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div className="ems-panel" style={{ padding: 18 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 10 }}>Войти в комнату</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Код комнаты</div>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="например, DA9X6"
              className="ems-mono" style={{ width: '100%', padding: '9px 11px', fontSize: 14, letterSpacing: '0.08em',
                background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
            {created && created === code.trim().toUpperCase() && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: COLOR.teal }}>
                <div>Комната ваша — отправьте партнёру код выше или ссылку ниже, по ней комната откроется автоматически.</div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 6 }}>
                  <input readOnly value={shareLink(created)} className="ems-mono" onClick={(e) => e.target.select()}
                    style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 11, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.muted }} />
                  <button className="ems-btn" style={{ padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => copyLink(created)}>
                    {linkCopied ? <Check size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> : <Copy size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                    {linkCopied ? 'Скопировано' : 'Копировать ссылку'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Ваше имя</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="как вас видит партнёр"
              style={{ width: '100%', padding: '9px 11px', fontSize: 13,
                background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>Ваша роль</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {previewSeats(roomPreview).map((sx) => {
                const rd = seatRole(sx); const RoleIcon = ROLE_ICON[rd.icon];
                const taken = !!(roomPreview && roomPreview.occupied && roomPreview.occupied[sx]);
                return (
                  <button key={sx} className="ems-btn" disabled={taken}
                    style={{ flex: 1, padding: '10px 6px', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      background: seat === sx ? COLOR.gold : COLOR.panelAlt, color: seat === sx ? COLOR.ink : COLOR.text,
                      borderColor: seat === sx ? COLOR.gold : COLOR.border, opacity: taken ? 0.4 : 1, cursor: taken ? 'not-allowed' : 'pointer' }}
                    onClick={() => { if (taken) return; Audio.play('click'); setSeat(sx); }}>
                    <RoleIcon size={15} />{rd.short}
                    {taken && <span style={{ fontSize: 9, letterSpacing: '0.03em' }}>занято</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="ems-btn primary" disabled={busy || allSeatsTaken} style={{ width: '100%', padding: '11px 0' }} onClick={doJoin}>
            {busy ? 'Входим…' : allSeatsTaken ? 'Все места заняты' : 'Войти в партию'}
          </button>
        </div>
      )}

      {tab === 'browse' && (
        <div className="ems-panel" style={{ padding: 18 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 4 }}>Открытые комнаты</div>
          <div style={{ fontSize: 11.5, color: COLOR.muted, marginBottom: 12, lineHeight: 1.45 }}>
            Партии, которые их создатели сделали общедоступными, — войти можно сразу, без кода.
          </div>
          {publicRoomsError && <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 10 }}>{publicRoomsError}</div>}
          {publicRooms === null ? (
            <div style={{ fontSize: 12, color: COLOR.faint }}>Загрузка…</div>
          ) : publicRooms.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR.faint }}>Сейчас открытых комнат нет — создайте свою на вкладке «Создать комнату» и включите «Общедоступная».</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {publicRooms.map((r) => (
                <div key={r.id} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                  background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, fontSize: 12 }}>
                  <span className="ems-mono" style={{ color: COLOR.goldSoft }}>{r.id}</span>
                  <span style={{ color: COLOR.text }}>{r.mode === 'trader' ? 'Рынок' : 'Политика'}{r.president ? ' · с президентом' : ''}</span>
                  {r.scenario && r.scenario !== 'sandbox' && (() => {
                    const sc = SCENARIOS.find((x) => x.id === r.scenario);
                    return sc ? <span style={{ color: sc.level >= 4 ? COLOR.rust : COLOR.gold }} title={sc.levelNote}>{sc.title} · {sc.levelLabel.toLowerCase()}</span> : null;
                  })()}
                  <span style={{ color: COLOR.faint }}>{DIFFICULTIES.find((d) => d.id === r.difficulty)?.title || r.difficulty}</span>
                  <span style={{ color: COLOR.faint }}>{quarterLabel(r.quarterIndex)}</span>
                  {(r.activeCrises || []).length > 0 ? (
                    <span style={{ color: COLOR.rust, fontSize: 10.5 }} title={r.activeCrises.map((c) => CRISIS_SHORT[c] || c).join(', ')}>
                      ⚠ {CRISIS_SHORT[r.activeCrises[0]] || r.activeCrises[0]}{r.activeCrises.length > 1 ? ` +${r.activeCrises.length - 1}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: COLOR.teal, fontSize: 10.5 }}>спокойно</span>
                  )}
                  <span style={{ marginLeft: 'auto', color: COLOR.muted }}>{r.seatsTotal - r.seatsFree}/{r.seatsTotal}</span>
                  <button className="ems-btn" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => joinPublicRoom(r.id)}>Войти</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div style={{ marginTop: 10, fontSize: 12.5, color: COLOR.rust }}>{error}</div>}
    </div>
  );
}

export function NetworkEntryScreen({ onEnter, onBack }) {
  return (
    <div className="ems-root ems-hero-bg" style={{ display: 'flex', justifyContent: 'center', padding: '44px 16px' }}>
      <GlobalStyle />
      <div style={{ maxWidth: 640, width: '100%' }}>
        <button className="ems-btn" style={{ marginBottom: 22, padding: '7px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); onBack(); }}>
          ← Назад в меню
        </button>
        <div className="ems-fade-in" style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="ems-hero-eyebrow">Мультиплеер</div>
          <div className="ems-hero-title small">Сетевая партия</div>
          <div className="ems-hero-rule" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NetworkLobby onEnter={onEnter} />
        </div>
      </div>
    </div>
  );
}

const QUARTER_TIMEOUT_MS = 5 * 60 * 1000; // держим в синхроне с QUARTER_TIMEOUT_MS в api/room.js

export function NetworkGameScreen({ network, theme, setTheme, onExit }) {
  const { id, seat, token, ownerToken } = network;
  const isOwner = !!ownerToken;
  const [kickBusy, setKickBusy] = useState(null);
  const [room, setRoom] = useState(network.room);
  const [decisions, setDecisions] = useState(() => defaultDecisions(network.room.economy));
  const [portfolio, setPortfolio] = useState(() => loadNetworkPortfolio(id, seat) || emptyBook());
  React.useEffect(() => { saveNetworkPortfolio(id, seat, portfolio); }, [id, seat, portfolio]);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();
  const [showAch, setShowAch] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [defeat, setDefeat] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  /* Откат на 3 хода назад, как в соло-игре, здесь возможен только для трейдера:
     его портфель — локальное состояние этого клиента, а не общая с партнёром
     серверная экономика (room.economy/history). Откатить саму экономику
     означало бы отменить чужие уже принятые решения — для ЦБ/Минфина/президента
     в сетевой игре это не сделать без сервера и без риска обидеть партнёра. */
  const portfolioHistoryRef = React.useRef([]);
  const onTrade = (instrId, amt, side, liveQuotes) => {
    if (instrId === 'cds_sovereign') pushAch(unlockAchievements(['cds_trade']));
    setPortfolio((b) => {
      const nb = tradeBook(b, instrId, amt, side, room.economy, liveQuotes);
      const instr = INSTR_BY_ID[instrId];
      return { ...nb, trades: [...(b.trades || []), { q: room.quarterIndex, id: instrId, side, amt, price: priceOf(instr, room.economy, liveQuotes) }].slice(-120) };
    });
  };
  const onCasino = (net) => {
    const casinoNet = (portfolio.casinoNet || 0) + net;
    setPortfolio((b) => ({ ...b, cash: Math.max(0, b.cash + net), realized: (b.realized || 0) + net, casinoNet: (b.casinoNet || 0) + net }));
    pushAch(unlockAchievements(casinoAchievementIds({ net, casinoNet })));
  };
  const [marketTab, setMarketTab] = useState('market');
  // та же временная подмена плейлиста, что и в соло-игре — см. комментарий там.
  // room.mode напрямую, а не isTraderRoom: та объявляется ниже по компоненту
  React.useEffect(() => {
    if (room.mode !== 'trader' || marketTab !== 'casino') return undefined;
    const prevLocked = Audio.nowPlaying().locked;
    Audio.setPlaylist('casino');
    return () => { Audio.setPlaylist(prevLocked); };
  }, [room.mode, marketTab]);
  // соперник должен видеть стоимость портфеля не только в момент «готов», а
  // вскоре после каждой сделки — иначе до конца квартала список эталонов
  // выглядит так, будто ничего не пишется, хотя сделка уже прошла
  React.useEffect(() => {
    if (room.mode !== 'trader') return undefined;
    const value = bookValue(portfolio, room.economy, null);
    const t = setTimeout(() => {
      reportPortfolioValue(id, seat, token, value).then((r) => setRoom(r.room)).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [portfolio, room.mode]);
  const [chatText, setChatText] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  React.useEffect(() => { const iv = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(iv); }, []);
  /* Таймер квартала отсчитывается от серверного времени, а часы на устройствах
     расходятся на минуты: у двух игроков на экране были разные цифры, а иногда и
     давно истёкший срок. Держим поправку «сервер минус мы» и считаем по ней. */
  const [skew, setSkew] = useState(0);
  React.useEffect(() => {
    if (Number.isFinite(room.now)) setSkew(room.now - Date.now());
  }, [room.now]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = React.useRef(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const [showPaper, setShowPaper] = useState(false);
  const [autoPaper, setAutoPaperState] = useState(loadAutoPaper);
  const setAutoPaper = (v) => { saveAutoPaper(v); setAutoPaperState(v); };
  // watchRoom подписывается один раз на монтирование (эффект ниже завязан на
  // id/seat/token, а не на autoPaper) — обычная переменная в его колбэке
  // навсегда осталась бы тем autoPaper, что был на момент подписки. Ref читает
  // актуальное значение, не заставляя пересоздавать подписку на каждый тумблер.
  const autoPaperRef = React.useRef(autoPaper);
  React.useEffect(() => { autoPaperRef.current = autoPaper; }, [autoPaper]);
  const [mobileCol, setMobileCol] = useState('center');
  const [narrow, setNarrow] = useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const prevQuarter = React.useRef(room.quarterIndex);
  // экономика прошлого квартала — чтобы понять, какая заставка положена новому
  const prevEconomyRef = React.useRef(room.economy);
  const [stampKey, setStampKey] = useState(0);

  React.useEffect(() => watchRoom(id, (r) => {
    setRoom(r);
    if (r.quarterIndex !== prevQuarter.current) {
      prevQuarter.current = r.quarterIndex;
      // в одиночной игре печать оттискивается по клику «Завершить квартал» —
      // здесь квартал резолвит сервер асинхронно (когда все сдали решения),
      // так что тот же переход играет по приходу нового r.quarterIndex с опроса,
      // а не по локальному клику
      setStampKey((k) => k + 1);
      setSent(false);
      setDecisions((d) => defaultDecisions(r.economy, d));
      if (autoPaperRef.current) setShowPaper(true);
      Audio.quarterSequence({ wellbeingDelta: 0, newCrisis: false, bigNews: r.news.some((n) => n.priority >= 8),
        stinger: stingerFor(prevEconomyRef.current, r.economy) });
      markNetworkPlayed();
      pushAch(unlockAchievements(questProgressAchievementIds({
        quarterIndex: r.quarterIndex, economy: r.economy, history: r.history,
        rolesPlayed: recordRolePlayed(seat), networkPlayed: true, role: seatRole(seat).id,
        presActionsThisQuarter: presActionsRef.current, isPublicRoom: !!r.isPublic,
      })));
      // «Своими руками» — вернуть парламент, распущенный указом, а не тот, который
      // распустил кризис: decreeRule ДО этого квартала (когда решение принималось)
      // и есть признак «был распущен указом». Экономика в комнате общая и меняется
      // на сервере, поэтому «до» берём из рефа, обновляя его сразу после проверки.
      if (seat === 'president' && presActionsRef.current.includes('restore_parliament') && prevDecreeRuleRef.current) {
        pushAch(unlockAchievements(['own_hands']));
      }
      prevDecreeRuleRef.current = r.economy.decreeRule;
      // «Слово держат» — подводится сервером в новости квартала, где наступили
      // выборы (см. resolveQuarter в api/room.js); достижения — локальные для
      // игрока, поэтому разбираем ту же новость здесь, а не полагаемся на сервер
      if (seat === 'president') {
        const promisesMatch = r.news.find((n) => n.q === r.quarterIndex - 1 && n.headline.startsWith('ОБЕЩАНИЯ У УРНЫ'))
          ?.headline.match(/СДЕРЖАНО (\d+) ИЗ (\d+)/);
        if (promisesMatch && promisesMatch[1] === promisesMatch[2]) pushAch(unlockAchievements(['promises_kept']));
      }
      const roleForDefeat = seatRole(seat).id;
      // расчёт по портфелю (переоценка, экспирация опционов, маржин-колл) —
      // тем же способом, что и в соло-игре трейдера, только экономику берём
      // из ответа сервера, а не считаем сами
      if (r.mode === 'trader') {
        setPortfolio((b) => {
          const withBench = b.benchStart ? b : { ...b, benchStart: { stockIndex: r.economy.stockIndex, bondIndex: r.economy.bondIndex,
            depositIndex: r.economy.depositIndex, priceLevel: r.economy.priceLevel } };
          const nb = settleQuarter(withBench, r.economy);
          const marginCalled = (nb.lastEvents || []).some((ev) => ev.kind === 'call');
          if (marginCalled) { Audio.play('alarm'); haptic([60, 80, 60]); pushAch(unlockAchievements(['margin_call'])); }
          const nextDefeat = checkDefeat({ role: roleForDefeat, economy: r.economy, history: r.history, bookVal: bookValue(nb, r.economy, null) });
          if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
          portfolioHistoryRef.current = [...portfolioHistoryRef.current, { quarterIndex: r.quarterIndex, book: nb }].slice(-8);
          return nb;
        });
      } else {
        const nextDefeat = checkDefeat({ role: roleForDefeat, economy: r.economy, history: r.history, bookVal: null });
        if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
      }
    }
    prevEconomyRef.current = r.economy;
    Audio.setMood(r.economy);
  }, (e) => failWithError(e), 2500, seat, token), [id, seat, token]);
  // у президентского кресла своя тема, у трейдерской комнаты — репертуар торгового зала
  React.useEffect(() => {
    Audio.setRole(seat === 'president' ? 'president' : room.mode === 'trader' ? 'trader' : null);
    return () => Audio.setRole(null);
  }, [seat, room.mode]);
  // новый квартал — новый ход президента: прошлые указы уже оплачены и применены
  React.useEffect(() => {
    setPresActions([]); setPresAppointCb(null); setPresAppointMof(null);
    setPresDirective(null); setPresDirStrength(1);
  }, [room.quarterIndex]);

  const isTraderRoom = room.mode === 'trader';
  const portfolioRollbackTarget = isTraderRoom
    ? portfolioHistoryRef.current.find((e) => e.quarterIndex === room.quarterIndex - 3) : null;
  const handlePortfolioRollback = () => {
    if (!portfolioRollbackTarget) return;
    setPortfolio(portfolioRollbackTarget.book);
    setDefeat(null); setShowGameOver(false);
  };
  const roleDef = seatRole(seat);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  /* Мест теперь может быть три: ЦБ, Минфин и президент. «Партнёр» по-прежнему один —
     второе ведомство (для президента это ЦБ, чьи цифры и показываем рядом), но ждём
     квартала мы от всех занятых мест, а не от одного. */
  const roomSeats = seatsForMode(room.mode).filter((sx) => sx !== 'president' || !!room.president);
  const isPresidentSeat = seat === 'president';
  // стройки и ответы округам — дело Минфина и президента, у ЦБ и трейдера карта только показывает
  const canPlanMap = seat === 'ministry_finance' || seat === 'president';
  const DEPT_PAIR = { central_bank: 'ministry_finance', ministry_finance: 'central_bank' };
  const otherSeat = isTraderRoom ? (roomSeats[0] === seat ? roomSeats[1] : roomSeats[0])
    : (DEPT_PAIR[seat] || 'central_bank');
  const otherSeats = roomSeats.filter((sx) => sx !== seat);
  const otherRole = seatRole(otherSeat);
  const OtherRoleIcon = ROLE_ICON[otherRole.icon];
  const otherAccent = otherSeat === 'central_bank' ? COLOR.blue : otherSeat === 'ministry_finance' ? COLOR.teal
    : otherSeat === 'president' ? COLOR.gold : COLOR.blue;
  const levers = LEVERS.filter((l) => roleDef.groups.includes(l.group)).filter((l) => !l.onlyIf || l.onlyIf(decisions));
  const economy = room.economy;
  const prevEcon = room.history.length >= 2 ? room.history[room.history.length - 2] : economy;
  const setLever = (id2, v) => setDecisions((d) => ({ ...d, [id2]: v }));
  const pressSpeaker = isTraderRoom ? null : pressSpeakerSeat(room.occupied);
  const pressQuestion = pressSpeaker ? pickPressQuestion(economy, room.quarterIndex) : null;
  // карта страны в сетевой партии — отдельный вид центральной колонки
  const [centerView, setCenterView] = useState('news');
  const shareKey = (lid) => (lid === 'shareHealth' ? 'health' : lid === 'shareEducation' ? 'education' : lid === 'shareScience' ? 'science' : lid === 'shareDefense' ? 'defense' : 'admin');
  const leverDisplay = (l) => (l.subgroup === 'budget' ? economy.budgetShares[shareKey(l.id)] : economy[l.id]);
  const { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries } = useChartView();
  const [activeTab, setActiveTab] = useState('economy');
  // ход живого президента: указы и реформы, кадры, одно указание и его сила
  const [presActions, setPresActions] = useState([]);
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  // watchRoom подписывается один раз (см. эффект выше, завязан на id/seat/token) —
  // обычные переменные в его колбэке навсегда остались бы тем, чем были на момент
  // подписки. presActionsRef — то же решение, что и autoPaperRef.
  const presActionsRef = React.useRef(presActions);
  React.useEffect(() => { presActionsRef.current = presActions; }, [presActions]);
  const prevDecreeRuleRef = React.useRef(room.economy.decreeRule);
  const [dense, setDense] = useState(false);
  const [dashboards, setDashboards] = useState(() => initDashboards());
  const dashActions = useMemo(() => makeDashboardActions(setDashboards), []);
  const { pinned, setPinned, activeDash, setActiveDash } = usePinnedStrip(null, null, dashActions);
  const layout = useLayoutColumns();
  const togglePin = (key) => setPinned((ps) => (ps.includes(key) ? ps.filter((x) => x !== key) : (ps.length >= MAX_PINS ? ps : [...ps, key])));
  const movePin = (key, dir) => setPinned((ps) => {
    const i = ps.indexOf(key); const j = i + dir;
    if (i < 0 || j < 0 || j >= ps.length) return ps;
    const next = [...ps]; next[i] = ps[j]; next[j] = ps[i]; return next;
  });
  const [dragPin, setDragPin] = useState(null);
  const reorderPin = (from, to) => setPinned((ps) => {
    if (from === to) return ps;
    const fromIdx = ps.indexOf(from); const toIdx = ps.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return ps;
    const next = [...ps]; next.splice(fromIdx, 1); next.splice(toIdx, 0, from); return next;
  });
  const applyDash = (did) => { const d = dashboards.find((x) => x.id === did); if (d) { setPinned(d.pins); setActiveDash(did); } };
  const saveDash = () => dashActions.saveDash(pinned, setActiveDash);
  const { deleteDash, renameDash, resetDash } = dashActions;
  const kpiDelta = (key) => economy[key] - prevEcon[key];
  const goalDef = GOALS.find((g) => g.id === room.goals[seat]);

  // держим слот в актуальном состоянии (перекладывает savedAt наверх LRU) и на
  // случай, если сюда попали в обход NetworkLobby (например, через ?room=)
  React.useEffect(() => { saveNetworkSlot({ id, seat, token }); }, [id, seat, token]);
  const failWithError = (e) => {
    setError(e.message);
    // токен отозван или комната истекла — восстанавливать в ней больше нечего
    if (/неверный токен|не найдена/i.test(e.message || '')) clearNetworkSlotFor(id, seat);
  };
  const send = async () => {
    setBusy(true); setError('');
    try {
      // стоимость портфеля сообщаем только в «рыночной» комнате — сервер не
      // знает позиций трейдера (они клиентские), только текущую сумму, чтобы
      // соперник видел её в своём списке эталонов (см. PortfolioSummary);
      // основной канал — report_portfolio после каждой сделки (см. выше), это
      // просто подстраховка на случай, если тот эффект ещё не успел отправиться
      const portfolioValue = isTraderRoom ? bookValue(portfolio, room.economy, null) : undefined;
      // президент шлёт не рычаги, а решения: сервер разберёт их тем же кодом, что и
      // ход бота-президента в одиночной игре
      const president = isPresidentSeat
        ? { actions: presActions, appointCb: presAppointCb, appointMof: presAppointMof,
          directive: presDirective, directiveStrength: presDirStrength,
          region: { startProject: decisions.startProject || null, regionResponse: decisions.regionResponse || null } }
        : undefined;
      const r = await submitDecisions(id, seat, token, decisions, null, portfolioValue, president);
      setRoom(r.room); setSent(true); Audio.play('stamp');
    } catch (e) { failWithError(e); } finally { setBusy(false); }
  };
  const retract = async () => {
    setBusy(true); setError('');
    try { const r = await cancelSubmission(id, seat, token); setRoom(r.room); setSent(false); Audio.play('click'); }
    catch (e) { failWithError(e); } finally { setBusy(false); }
  };
  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatBusy(true); setError('');
    try { const r = await sendChatMessage(id, seat, token, text); setRoom(r.room); setChatText(''); Audio.play('click'); }
    catch (e) { failWithError(e); } finally { setChatBusy(false); }
  };
  React.useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [room.chat?.length]);

  const pendingSeats = otherSeats.filter((sx) => room.occupied[sx] && !room.ready[sx]);
  const waitingForOther = sent && pendingSeats.length > 0;
  // сколько времени осталось до того, как сервер решит за отсутствующего игрока
  // ботом (см. QUARTER_TIMEOUT_MS/maybeForceResolve в api/room.js) — держим в поле
  // зрения, чтобы «квартал стоит» не выглядело так, будто ничего не произойдёт
  const timeLeftMs = room.quarterStartedAt
    ? Math.max(0, room.quarterStartedAt + QUARTER_TIMEOUT_MS - (nowTick + skew)) : null;
  const timeLeftLabel = timeLeftMs === null ? null
    : `${Math.floor(timeLeftMs / 60000)}:${String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0')}`;
  /* Таймер отсчитывает не «время на ход», а срок, после которого сервер решит за
     МОЛЧАЩЕГО ПАРТНЁРА ботом. Пока второе место пустует, подгонять некого: квартал
     считается ровно в тот момент, когда я нажму «готов», — и часы над пустой
     комнатой только создавали ощущение, что кто-то торопит. Своего собственного
     «ещё не отправил» таймер тоже не касается. */
  const quarterPending = pendingSeats.length > 0;
  /* Президент комнаты приходит с сервера «плоским» (в хранилище нельзя класть
     объекты просьб с функциями) — собираем из него то, что ждёт панель. Чьё
     требование «ко мне», зависит от места, за которым сижу я. */
  const myBranch = seat === 'central_bank' ? 'monetary' : seat === 'ministry_finance' ? 'fiscal' : null;
  const presState = room.president || null;
  const presPlan = presState && presState.plan ? {
    ...presState.plan,
    persona: { name: presState.plan.personaName, title: presState.plan.personaTitle },
    directive: presState.plan.directive
      ? { ...presState.plan.directive, toPlayer: presState.plan.directive.branch === myBranch } : null,
  } : null;
  const presLast = presState && presState.last
    ? { ...presState.last, toPlayer: presState.last.branch === myBranch } : null;
  // требование живого президента: оно выдвинуто в прошлом квартале и исполняется
  // в этом — у ведомства есть на него ход, а не «претензия задним числом»
  const presDemand = presState && presState.human ? presState.demand : null;
  const otherAction = room.lastActions ? room.lastActions[otherSeat] : null;
  const disconnectedSeat = otherSeats.find((sx) => room.occupied[sx] && room.connected && !room.connected[sx]) || null;
  const otherDisconnected = !!disconnectedSeat;
  const myLastAction = room.lastActions ? room.lastActions[seat] : null;
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false);
  React.useEffect(() => { setWelcomeBackDismissed(false); }, [room.quarterIndex]);
  // выход в меню — это не уход из комнаты: место и сохранённая сессия остаются,
  // партия появится в лобби («Ваши партии») и в неё можно вернуться позже;
  // насовсем комнату покидают через «Забыть эту партию» в лобби
  const exit = () => onExit();
  const [difficultyBusy, setDifficultyBusy] = useState(false);
  const changeDifficulty = async (next) => {
    if (next === room.difficulty) return;
    setDifficultyBusy(true); setError('');
    try { const r = await setRoomDifficulty(id, seat, token, next); setRoom(r.room); }
    catch (e) { failWithError(e); } finally { setDifficultyBusy(false); }
  };
  const kickSeat = async (targetSeat) => {
    if (!window.confirm(`Убрать ${seatRole(targetSeat).short} из комнаты? Место освободится, партнёр сможет войти заново.`)) return;
    setKickBusy(targetSeat); setError('');
    try { const r = await kickFromRoom(id, ownerToken, targetSeat); setRoom(r.room); Audio.play('click'); }
    catch (e) { setError(e.message); } finally { setKickBusy(null); }
  };
  // владелец кикнул вас самого (или ваше место освободили как-то иначе, пока вы
  // были в комнате) — своё же место внезапно снова «пустое» означает именно это
  const [kickedOut, setKickedOut] = useState(false);
  React.useEffect(() => { if (!room.occupied[seat]) setKickedOut(true); }, [room.occupied, seat]);

  if (kickedOut) {
    return (
      <div className="ems-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <GlobalStyle />
        <div className="ems-panel" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <AlertTriangle size={28} color={COLOR.rust} style={{ marginBottom: 10 }} />
          <div className="ems-serif" style={{ fontSize: 16, color: COLOR.rust, marginBottom: 8 }}>Вас убрали из комнаты</div>
          <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 18, lineHeight: 1.5 }}>
            Владелец лобби освободил ваше место. Вернуться в эту партию так же нельзя — при желании войдите заново по коду.
          </div>
          <button className="ems-btn primary" style={{ padding: '10px 20px' }}
            onClick={() => { clearNetworkSlotFor(id, seat); onExit(); }}>В меню</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ems-root">
      <GlobalStyle />
      <Atmosphere regime={economy.regime}
        intensity={clamp((economy.inflationRisk * 0.25 + economy.bankingRisk * 0.3 + economy.debtRisk * 0.2 + economy.recessionRisk * 0.25) / 100, 0, 1)} />
      <QuarterStamp stampKey={stampKey} regime={economy.politicalRegime} />
      {showWhy && room.reasons && <WhyModal reasons={room.reasons} onClose={() => setShowWhy(false)} />}
      {showPaper && (
        <Suspense fallback={null}>
          <NewspaperModal news={room.news} history={room.history} quarterIndex={room.quarterIndex} economy={room.economy} onClose={() => setShowPaper(false)} />
        </Suspense>
      )}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} leaving={achLeaving} />
      {defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={room.quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={exit} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }} restartLabel="В меню"
        onChronicle={() => { setShowGameOver(false); setShowChronicle(true); }}
        onRollback={portfolioRollbackTarget ? handlePortfolioRollback : null} />}
      {showChronicle && <ChronicleModal history={room.history} onClose={() => setShowChronicle(false)} />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: seatRole(seat).id, quarterIndex: room.quarterIndex, economy: room.economy,
        startEconomy: room.history && room.history[0], portfolio, defeat,
      })} />}

      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, background: COLOR.panel,
        padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StateSeal regime={economy.politicalRegime} size={36}
            title={(POLITICAL_REGIME_INFO[economy.politicalRegime] || {}).label} />
          <div className="ems-card-icon" style={{ width: 40, height: 40 }}>
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            <div className="ems-serif" style={{ fontSize: 18 }}>Сетевая партия · комната {room.id}</div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              вы — {roleDef.title} · {otherSeats.map((sx) => {
                const rd = seatRole(sx);
                const who = room.occupied[sx] ? (room.names[sx] || 'игрок') : (isTraderRoom ? 'место свободно' : 'бот');
                return `${who} за ${rd.short}`;
              }).join(' · ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: COLOR.muted }}>Текущий период</div>
            <div className="ems-mono ems-serif" style={{ fontSize: 15, fontWeight: 600 }}>{room.quarterLabel}</div>
          </div>
          <div style={{ width: 1, height: 34, background: COLOR.hairline }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: COLOR.muted, marginBottom: 2 }}>Благополучие</div>
            <Gauge value={economy.wellbeing} size={68} />
          </div>
          <div style={{ position: 'relative' }}>
            <select value={room.difficulty} disabled={difficultyBusy} onChange={(e) => changeDifficulty(e.target.value)}
              title="Сложность партии" className="ems-btn"
              style={{ padding: '7px 26px 7px 9px', fontSize: 11.5, appearance: 'none', WebkitAppearance: 'none', cursor: difficultyBusy ? 'wait' : 'pointer' }}>
              {DIFFICULTIES.map((d) => (<option key={d.id} value={d.id}>{d.title}</option>))}
            </select>
            <ChevronDown size={12} color={COLOR.muted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <ViewSettings theme={theme} setTheme={setTheme} dense={dense} setDense={setDense}
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash}
            deleteDash={deleteDash} renameDash={renameDash} resetDash={resetDash}
            layoutEditMode={layout.layoutEditMode} setLayoutEditMode={layout.setLayoutEditMode}
            columnOrder={layout.columnOrder} moveColumn={layout.moveColumn}
            resetLayout={layout.resetLayout} layoutIsDefaultNow={layout.layoutIsDefaultNow}
            autoPaper={autoPaper} setAutoPaper={setAutoPaper} />
          <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowAch(true); }} title="Коллекция достижений">
            <Trophy size={14} color={COLOR.gold} />
          </button>
          <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { Audio.play('paper'); setShowPaper(true); }} title="Экономический вестник">
            <Newspaper size={14} />Газета
          </button>
          <AudioControls />
          <HeaderOverflowMenu items={[
            { icon: Share2, label: 'Карточка результата', onClick: () => setShowCard(true) },
            { icon: BookOpen, label: 'Разбор партии', onClick: () => setShowChronicle(true) },
            { icon: RotateCcw, label: 'Выйти в меню', danger: true, onClick: () => exit() },
          ]} />
        </div>
      </div>

      <CrisisBar economy={economy} botAction={otherAction} />

      <div style={{ padding: '14px 18px 4px' }}>
        <div className="ems-kpi-strip">
          {pinned.map((key, idx) => {
            const m = ALL_METRICS[key];
            if (!m) return null;
            const val = economy[key];
            return (
              <div key={key} draggable
                onDragStart={(e) => { setDragPin(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from) reorderPin(from, key); setDragPin(null); }}
                onDragEnd={() => setDragPin(null)}
                style={{ position: 'relative', opacity: dragPin === key ? 0.4 : 1, cursor: 'grab' }}>
                <KpiTile label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'} delta={kpiDelta(key)} invert={m.invert} series={room.history.slice(-8).map((h) => h[key]).filter(Number.isFinite)} hero={idx === 0} />
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <button onClick={() => { Audio.play('tick'); movePin(key, -1); }} aria-label="Левее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>◀</button>
                  <button onClick={() => { Audio.play('tick'); movePin(key, 1); }} aria-label="Правее"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0, fontSize: 10 }}>▶</button>
                  <button onClick={() => { Audio.play('tick'); togglePin(key); }} aria-label={`Убрать ${m.label} с полосы`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 1, lineHeight: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              </div>
            );
          })}
          {pinned.length < MAX_PINS && (
            <div className="ems-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed' }}>
              <span style={{ fontSize: 10.5, color: COLOR.faint, textAlign: 'center', lineHeight: 1.4 }}>
                <Star size={12} style={{ verticalAlign: -2 }} /> закрепите любой показатель<br />звёздочкой в таблице справа
              </span>
            </div>
          )}
        </div>
        <div className="ems-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10, padding: '9px 13px' }}>
          <RiskBadge label="Инфляционный" value={economy.inflationRisk} />
          <RiskBadge label="Банковский" value={economy.bankingRisk} />
          <RiskBadge label="Долговой" value={economy.debtRisk} />
          <RiskBadge label="Рецессии" value={economy.recessionRisk} />
          <RiskBadge label="Валютный" value={economy.currencyRisk} />
        </div>
      </div>

      <div style={{ margin: '10px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {myLastAction && myLastAction.timedOut && !welcomeBackDismissed && (
          <div className="ems-fade-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: COLOR.goldDim, border: `1px solid ${COLOR.gold}`, borderRadius: 3, padding: '9px 12px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.gold} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}><b style={{ color: COLOR.gold }}>С возвращением.</b> <span style={{ color: COLOR.muted }}>
              Пока вас не было, прошлый квартал за вас решал бот — вы не отправили решение вовремя. Место осталось вашим, продолжайте с этого квартала.</span></div>
            <button onClick={() => setWelcomeBackDismissed(true)} aria-label="Закрыть"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0, flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>
        )}
        {otherDisconnected && (
          <div className="ems-fade-in" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '9px 12px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><b style={{ color: COLOR.rust }}>{(disconnectedSeat && room.names[disconnectedSeat]) || 'Партнёр'} не на связи.</b> <span style={{ color: COLOR.muted }}>
              Больше 12 секунд нет ответа от его вкладки — возможно, партнёр закрыл игру. {isTraderRoom
                ? 'Если решение не придёт в течение 5 минут с начала квартала, квартал наступит без него — место останется за партнёром.'
                : 'Если решение не придёт в течение 5 минут с начала квартала, за это ведомство один раз решит бот, а место останется за партнёром.'}</span></div>
          </div>
        )}
        <RegimeBanner economy={economy} />
        {economy.regionEvent && centerView !== 'map' && (
          <RegionEventStrip event={economy.regionEvent} answered={!!decisions.regionResponse} canAnswer={canPlanMap}
            onOpen={() => { Audio.play('tab'); setCenterView('map'); }} />
        )}
      </div>

      {narrow && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0' }}>
          {[['left', isTraderRoom ? 'Капитал' : 'Решения'], ['center', isTraderRoom ? 'Рынок и новости' : 'Новости и графики'], ['right', 'Показатели']].map(([id, label]) => (
            <button key={id} className="ems-btn" style={{ flex: 1, padding: '8px 0', fontSize: 11.5,
              background: mobileCol === id ? COLOR.gold : COLOR.panelAlt, color: mobileCol === id ? COLOR.ink : COLOR.text,
              borderColor: mobileCol === id ? COLOR.gold : COLOR.border }}
              onClick={() => { Audio.play('tab'); setMobileCol(id); }}>{label}</button>
          ))}
        </div>
      )}

      {(() => {
      const leftNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isTraderRoom ? (
            <Suspense fallback={<ChartFallback height={120} />}>
              <PortfolioSummary book={portfolio} economy={economy} live={null} goal="max_wealth"
                prevValue={portfolio.history && portfolio.history.length > 1 ? portfolio.history[portfolio.history.length - 2] : null}
                opponent={{ label: room.names[otherSeat] || otherRole.short, value: (room.portfolioValues || {})[otherSeat] }} />
            </Suspense>
          ) : isPresidentSeat ? (
            <>
              {/* у президента нет ни одного рычага: его ход — кадры, указания,
                  реформы и публичная политика, ровно как в одиночной игре */}
              <PresidentPanel economy={economy} cooldowns={room.presCooldowns || {}}
                selected={presActions} setSelected={setPresActions}
                cbPersonaId={(room.personas || {}).central_bank || 'pragmatic'}
                mofPersonaId={(room.personas || {}).ministry_finance || 'technocrat'}
                appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                directive={presDirective} setDirective={setPresDirective}
                lastDirective={presState && presState.last && presState.last.status
                  ? { status: presState.last.status, text: `Указание «${presState.last.label}».` } : null}
                directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              <PromisesPanel promises={room.promises} economy={economy} />
              {presState && presState.demand && (
                <div className="ems-panel" style={{ padding: 12, borderColor: COLOR.gold }}>
                  <div style={{ fontSize: 10, color: COLOR.faint, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                    Требование в силе
                  </div>
                  <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.45 }}>
                    {presState.demand.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: «{presState.demand.ask}»
                  </div>
                  <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4, lineHeight: 1.4 }}>
                    Ведомство отвечает решениями этого квартала — итог будет в новостях, когда квартал закроется.
                    Новое указание встанет в силу со следующего.
                  </div>
                </div>
              )}
              <div className="ems-panel" style={{ padding: 13 }}>
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.blue, marginBottom: 8 }}>Ведомства</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[['Ключевая ставка', pctFmt(economy.keyRate)],
                    ['Баланс бюджета', fmtSignedPct(economy.budgetBalancePctGdp)],
                    ['Долг', pctFmt(economy.debtToGdp)],
                    ['За ЦБ', room.occupied.central_bank ? (room.names.central_bank || 'игрок') : 'бот'],
                    ['За Минфин', room.occupied.ministry_finance ? (room.names.ministry_finance || 'игрок') : 'бот']].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                        <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="ems-panel" style={{ padding: 14 }}>
                <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <RoleIcon size={14} />Ваши полномочия
                </div>
                {['monetary', 'fiscal'].filter((g) => roleDef.groups.includes(g)).map((g) => (
                  <React.Fragment key={g}>
                    {['core', 'macropru', 'taxes', 'budget', 'debt'].map((sub) => {
                      const set = levers.filter((l) => l.group === g && l.subgroup === sub);
                      if (!set.length) return null;
                      return (
                        <React.Fragment key={sub}>
                          {sub === 'debt' && (
                            <div style={{ fontSize: 10.5, color: COLOR.faint, margin: '2px 0 8px', lineHeight: 1.4 }}>
                              Дефицит финансируется сам — рынок и так занимает за вас ровно столько, сколько не хватает. Здесь — добровольное решение занять сверх этого: долг растёт сразу, а деньги идут в резерв на будущее.
                            </div>
                          )}
                          {set.map((l) => (
                            <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={leverDisplay(l)} value={decisions[l.id]}
                              onChange={(v) => setLever(l.id, v)} preview={leverPreview(l.id, decisions[l.id], economy, room.difficulty)} />
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {g === 'monetary' && <Segmented label="Режим валютного курса" options={FX_REGIMES} value={decisions.fxRegime} onChange={(v) => setLever('fxRegime', v)} />}
                  </React.Fragment>
                ))}
              </div>

              {roleDef.groups.includes('fiscal') && (economy.activeCrises || []).includes('debt') && economy.imfActive && (
                <div className="ems-panel" style={{ padding: '9px 11px', borderColor: COLOR.gold, fontSize: 11.5, color: COLOR.text, lineHeight: 1.45 }}>
                  <b style={{ color: COLOR.goldSoft }}>Программа МВФ действует ещё {economy.imfQuartersLeft} кв.</b> Расходы и выплаты обязаны сокращаться — это условие программы, не ваше решение на этот квартал.
                </div>
              )}
              {roleDef.groups.includes('fiscal') && (economy.activeCrises || []).includes('debt')
                && !(economy.marketLockoutQuartersLeft > 0) && !economy.imfActive && (
                <div className="ems-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <button className="ems-btn" style={{ width: '100%', background: COLOR.panelAlt, color: COLOR.text, borderColor: COLOR.rust }}
                      onClick={() => {
                        if (!window.confirm('Объявить дефолт по государственному долгу? Часть долга спишется разом, но рынок закроется для новых займов на несколько кварталов, а доверие резко упадёт. Отменить это решение будет нельзя.')) return;
                        Audio.play('alarm'); setLever('sovereignDefault', true);
                      }}>
                      <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Объявить дефолт по госдолгу
                    </button>
                    <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>
                      Спишет часть долга разом вместо очередного секвестра, но закроет рынок для новых займов на несколько кварталов и сильно ударит по доверию. Разовое и необратимое решение.
                    </div>
                  </div>
                  <div>
                    <button className="ems-btn" style={{ width: '100%', background: COLOR.panelAlt, color: COLOR.text, borderColor: COLOR.gold }}
                      onClick={() => {
                        if (!window.confirm('Запросить экстренное финансирование МВФ? Ставка по долгу и премия за риск снизятся сразу, но на два года бюджет обязан сокращать расходы и выплаты — это условие программы, отменить его будет нельзя, не разорвав саму программу.')) return;
                        Audio.play('alarm'); setLever('imfProgram', true);
                      }}>
                      <ShieldAlert size={13} style={{ verticalAlign: -2 }} /> Запросить помощь МВФ
                    </button>
                    <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>
                      Альтернатива дефолту: долг не списывается, доступ к рынкам не закрывается, ставка сразу дешевле. Взамен — обязательная консолидация на два года, которую нельзя будет отменить по своему усмотрению.
                    </div>
                  </div>
                </div>
              )}

              {/* без этой панели игрок видел только собственные рычаги — о том, что
                  сейчас установлено у партнёра (ставка ЦБ, налоги/бюджет Минфина),
                  приходилось либо спрашивать в чате, либо искать по всем вкладкам
                  «Показателей экономики»; ниже — сводка его последних решённых
                  значений, как в соло-игре у бота-оппонента */}
              <div className="ems-panel" style={{ padding: 13, borderLeft: `3px solid ${otherAccent}` }}>
                <div className="ems-serif" style={{ fontSize: 13, color: otherAccent, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <OtherRoleIcon size={13} />{otherRole.title}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{room.occupied[otherSeat] ? (room.names[otherSeat] || 'игрок') : 'бот'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {(otherSeat === 'central_bank' ? [
                    ['Ключевая ставка', pctFmt(economy.keyRate)],
                    ['Норма резервирования', pctFmt(economy.reserveReq)],
                    ['Режим курса', (FX_REGIMES.find((r) => r.id === economy.fxRegime) || {}).label || economy.fxRegime],
                  ] : [
                    ['Баланс бюджета', fmtSignedPct(economy.budgetBalancePctGdp)],
                    ['Долг', pctFmt(economy.debtToGdp)],
                    ['НДС', pctFmt(economy.vatRate)],
                    ['Налог на прибыль', pctFmt(economy.profitTaxRate)],
                  ]).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, color: COLOR.muted, marginBottom: 2 }}>
                    {otherSeat === 'ministry_finance' ? 'Бюджетные потоки, темп роста' : 'Решения прошлого квартала'}
                  </div>
                  {otherSeat === 'ministry_finance'
                    ? <FiscalLeverReadout levers={otherAction ? otherAction.levers : null} accent={otherAccent} economy={economy} />
                    : <MonetaryLeverReadout levers={otherAction ? otherAction.levers : null} accent={otherAccent} economy={economy} />}
                </div>
                {otherAction && otherAction.note && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLOR.faint, borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7, lineHeight: 1.4 }}>{otherAction.note}</div>
                )}
              </div>
            </>
          )}

          {presPlan && !isPresidentSeat && <PresidentWatchPanel economy={economy} plan={presPlan} last={presLast} branch={myBranch} />}
          {presDemand && !isPresidentSeat && (
            <div className="ems-panel" style={{ padding: 13, borderColor: presDemand.branch === myBranch ? COLOR.rust : COLOR.borderStrong }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <Crown size={14} color={COLOR.gold} />
                <span className="ems-serif" style={{ fontSize: 13.5, color: COLOR.goldSoft }}>Президент</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: COLOR.faint }}>{room.names.president || 'игрок'}</span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, paddingLeft: 9, color: COLOR.text,
                borderLeft: `2px solid ${presDemand.branch === myBranch ? COLOR.rust : COLOR.blue}` }}>
                <span style={{ color: presDemand.branch === myBranch ? COLOR.rust : COLOR.blue, fontWeight: 600 }}>
                  {presDemand.branch === myBranch ? 'Требование к вам: ' : `Указание ${presDemand.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: `}
                </span>
                {presDemand.ask}
                {presDemand.branch === myBranch && (
                  <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 4 }}>
                    Выполнить — значит сдвинуть свои рычаги в эту сторону в этом квартале. Отказать можно, но администрация ведёт счёт.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Пресс-конференция в комнате: власть отвечает одним голосом —
              президентом, без него Минфином, без обоих ЦБ (pressSpeakerSeat).
              Остальным вопрос виден, но отвечает не их место: так понятно, что
              прозвучит от имени власти, и можно договориться в чате. */}
          {!isTraderRoom && pressSpeaker && (pressSpeaker === seat
            ? <PressConferencePanel question={pressQuestion} answer={decisions.pressAnswer}
                setAnswer={(v) => setLever('pressAnswer', v)} />
            : pressQuestion && (
              <div className="ems-panel" style={{ padding: 13 }}>
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Megaphone size={13} />Пресс-конференция
                </div>
                <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.45, marginBottom: 6 }}>«{pressQuestion.prompt}»</div>
                <div style={{ fontSize: 10.5, color: COLOR.faint, lineHeight: 1.4 }}>
                  Отвечает {(room.names && room.names[pressSpeaker]) || seatRole(pressSpeaker).short} — {seatRole(pressSpeaker).short}: от имени власти в квартал звучит один голос.
                </div>
              </div>
            ))}

          <div className="ems-panel" style={{ padding: 13 }}>
            <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 7 }}>Чат с партнёром</div>
            <div className="ems-scroll" style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
              {(!room.chat || room.chat.length === 0) && (
                <div style={{ fontSize: 11.5, color: COLOR.faint }}>Пока тишина — напишите первым.</div>
              )}
              {(room.chat || []).map((m, i) => {
                const mine = m.seat === seat;
                const nm = mine ? 'вы' : (room.names[m.seat] || seatRole(m.seat).short);
                // подряд отправленные сообщения одного собеседника сливаются в одну
                // группу: заголовок с именем и увеличенный отступ — только перед новым
                // отправителем, а не перед каждым сообщением
                const grouped = i > 0 && room.chat[i - 1].seat === m.seat;
                const time = m.at ? new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', textAlign: mine ? 'right' : 'left', marginTop: i === 0 ? 0 : grouped ? 2 : 10 }}>
                    {!grouped && <div style={{ fontSize: 9.5, color: mine ? COLOR.gold : COLOR.blue, marginBottom: 2 }}>{nm}</div>}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                      <div style={{ fontSize: 12, color: COLOR.text, background: COLOR.panelAlt, padding: '6px 10px', borderRadius: 3, display: 'inline-block', wordBreak: 'break-word' }}>{m.text}</div>
                      {time && <span className="ems-mono" style={{ fontSize: 9, color: COLOR.faint, flexShrink: 0 }}>{time}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={chatText} onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="написать партнёру…"
                style={{ flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 12, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
              <button className="ems-btn" disabled={chatBusy || !chatText.trim()} onClick={sendChat} style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
                {chatBusy ? '…' : 'Отпр.'}
              </button>
            </div>
            {otherAction && otherAction.quote && (
              <div style={{ marginTop: 8, fontSize: 11.5, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 8, color: COLOR.muted }}>
                <span style={{ color: COLOR.faint }}>{otherRole.short} (бот): </span>«{otherAction.quote}»
              </div>
            )}
          </div>
        </div>
      );
      const centerNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* Та же карта, что в одиночной игре: округа, их напряжение и итоги
              последних выборов. Данные для неё уже приходят с сервера — движок
              хранит lastElection в экономике комнаты, — не хватало только вида. */}
          <div style={{ display: 'flex', gap: 4 }} role="tablist" aria-label="Вид центральной колонки">
            {[['news', 'Вестник', Newspaper], ['map', 'Карта страны', MapIcon]].map(([vid, label, Icon]) => (
              <span key={vid} role="tab" aria-selected={centerView === vid} tabIndex={0}
                className={`ems-tab ${centerView === vid ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { Audio.play('tab'); setCenterView(vid); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCenterView(vid); } }}>
                <Icon size={13} />{label}
              </span>
            ))}
          </div>
          {centerView === 'map' ? <Suspense fallback={<ChartFallback />}>
            <CountryMap economy={economy}
              plan={{ startProject: decisions.startProject || null, regionResponse: decisions.regionResponse || null }}
              onPlan={canPlanMap && !sent ? (pl) => setDecisions((d) => ({ ...d, ...pl })) : null}
              planner={room.president && room.president.human
                ? `президент${room.occupied.ministry_finance ? ` и Минфин (${room.names.ministry_finance || 'игрок'})` : ' и бот-Минфин'}`
                : room.occupied.ministry_finance ? `Минфин (${room.names.ministry_finance || 'игрок'})` : 'Минфин (бот)'} />
          </Suspense> : (<>
          {isTraderRoom && (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['market', 'Рынок', TrendingUp], ['casino', 'Казино', Dices]].map(([tid, label, Icon]) => (
                  <span key={tid} className={`ems-tab ${marketTab === tid ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => { Audio.play('tab'); setMarketTab(tid); }}><Icon size={13} />{label}</span>
                ))}
              </div>
              {marketTab === 'market'
                ? <Suspense fallback={<ChartFallback />}><TradingTerminal economy={economy} prev={prevEcon} history={room.history} book={portfolio} onTrade={onTrade} /></Suspense>
                : <Suspense fallback={<ChartFallback />}><CasinoScreen book={portfolio} onCasino={onCasino} /></Suspense>}
            </>
          )}
          <NewsTerminal items={room.news} onOpenPaper={() => setShowPaper(true)} />
          <Suspense fallback={<ChartFallback />}>
            <ChartPanel history={room.history} chartGroup={chartGroup} setChartGroup={setChartGroup}
              hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
          </Suspense>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Квартальный отчёт</span>
              {room.report && room.reasons && (
                <button className="ems-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setShowWhy(true)}>
                  <Info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Почему это произошло?
                </button>
              )}
            </div>
            {/* официальный бюллетень, но в палитре кабинета, а не полноцветной «Газеты»:
                двойная линейка сохраняет жанр, фон и текст остаются тёмными */}
            <div style={{ background: COLOR.panelRaised, color: COLOR.text, padding: '16px 18px',
              borderTop: `3px double ${COLOR.gold}`, borderLeft: `1px solid ${COLOR.border}`,
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              <div className="ems-mono" style={{ fontSize: 9, color: COLOR.gold, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Бюллетень квартала</div>
              {room.report ? (
                <div className="ems-serif" style={{ fontSize: 13, lineHeight: 1.65 }}>{room.report}</div>
              ) : (
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.muted }}>
                  {isTraderRoom ? 'Совершайте сделки слева и нажмите «готов» — квартал наступит, когда готовы оба трейдера.'
                    : `Настройте свои решения слева и отправьте их — квартал наступит, когда решения пришлют ${roomSeats.length > 2 ? 'все игроки' : 'оба игрока'}.`}
                </div>
              )}
            </div>
          </div>
          </>)}
        </div>
      );
      const rightNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isTraderRoom && <ScorePanel economy={economy} prev={prevEcon} goalDef={goalDef} />}
          <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <Users size={13} color={COLOR.blue} />
              <span className="ems-serif" style={{ fontSize: 13, color: COLOR.blue }}>Статус партии</span>
              {isOwner && <span title="Вы создали эту комнату" className="ems-mono" style={{ marginLeft: 'auto', fontSize: 9.5, color: COLOR.faint, letterSpacing: '0.04em' }}>ВЛАДЕЛЕЦ</span>}
            </div>
            {roomSeats.map((sx) => {
              const rd = seatRole(sx); const Icon = ROLE_ICON[rd.icon];
              const isMe = sx === seat;
              const canKick = isOwner && !isMe && room.occupied[sx];
              return (
                <div key={sx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${COLOR.hairline}` }}>
                  <Icon size={13} color={isMe ? COLOR.gold : COLOR.muted} />
                  <span style={{ flex: 1, color: isMe ? COLOR.text : COLOR.muted }}>
                    {rd.short}{isMe ? ' (вы)' : ''} — {room.occupied[sx] ? (room.names[sx] || 'игрок') : (isTraderRoom ? 'свободно' : 'бот')}
                  </span>
                  <span className="ems-mono" style={{ fontSize: 10.5, color: room.ready[sx] ? COLOR.teal : COLOR.faint }}>
                    {room.ready[sx] ? 'готово' : 'думает'}
                  </span>
                  {canKick && (
                    <button onClick={() => kickSeat(sx)} disabled={kickBusy === sx} title="Убрать из комнаты"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 8, lineHeight: 1.4 }}>
              Код комнаты для второго игрока: <b className="ems-mono" style={{ color: COLOR.text }}>{room.id}</b>
            </div>
          </div>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 9 }}>Показатели экономики</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 11 }} className="ems-scroll">
              {INDICATOR_TABS.map((t) => {
                const TabIcon = t.icon;
                return (<span key={t.id} className={`ems-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => { Audio.play('tab'); setActiveTab(t.id); }}>{TabIcon && <TabIcon size={12} />}{t.label}</span>);
              })}
            </div>
            {(INDICATOR_TABS.find((t) => t.id === activeTab) || INDICATOR_TABS[0]).rows.map((row, i, arr) => {
              const val = row.get ? row.get(economy) : economy[row.key];
              const prevVal = row.get ? row.get(prevEcon) : prevEcon[row.key];
              const delta = Number.isFinite(prevVal) && Number.isFinite(val) ? val - prevVal : 0;
              if (row.text) {
                return (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${COLOR.hairline}` : 'none' }}>
                    <span style={{ color: COLOR.muted }}>{row.label}</span>
                    <span className="ems-mono">{(row.map && row.map[val]) || String(val || '—')}</span>
                  </div>
                );
              }
              return (
                <MetricRow key={row.label || row.key} row={row} delta={delta} last={i === arr.length - 1}
                  value={Number.isFinite(val) ? row.fmt(val) : '—'}
                  pinnable={!!ALL_METRICS[row.key]} pinned={pinned.includes(row.key)} onPin={() => togglePin(row.key)} />
              );
            })}
          </div>
        </div>
      );
      const nodes = {
        left: <CabinetZone hidden={narrow && mobileCol !== 'left'}>{leftNode}</CabinetZone>,
        center: <StateZone label="Экономический вестник" hidden={narrow && mobileCol !== 'center'}>{centerNode}</StateZone>,
        right: <StateZone label="Показатели страны" hidden={narrow && mobileCol !== 'right'}>{rightNode}</StateZone>,
      };
      const order = layout.wide ? layout.columnOrder : DEFAULT_COLUMN_ORDER;
      const colWidthFor = (id) => (id === 'center' ? 'minmax(0,1fr)' : `${layout.columnWidths[id]}px`);
      const gridStyle = { padding: 18, ...(layout.wide ? { gridTemplateColumns: order.map(colWidthFor).join(' ') } : null) };
      return (
        <div className="ems-grid" style={gridStyle}>
          {order.map((id, i) => (
            <div key={id} style={{ position: 'relative', minWidth: 0 }}>
              {nodes[id]}
              {layout.wide && layout.layoutEditMode && i < order.length - 1 && (
                <ColumnResizeHandle leftId={id} rightId={order[i + 1]} widths={layout.columnWidths}
                  onResize={layout.setColumnWidthsLive} onCommit={layout.commitWidths} />
              )}
            </div>
          ))}
        </div>
      );
      })()}

      {defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={exit} restartLabel="В меню"
          onRollback={portfolioRollbackTarget ? handlePortfolioRollback : null} />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: '14px 18px',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
          boxShadow: '0 -6px 20px -10px rgba(0,0,0,0.4)' }}>
          {error && <span style={{ color: COLOR.rust, fontSize: 12, marginRight: 'auto' }}>{error}</span>}
          {!error && (
            <span style={{ fontSize: 11.5, color: COLOR.faint, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
              {isTraderRoom
                ? (!room.occupied[otherSeat]
                  ? 'Второе место свободно: квартал наступит сразу, как только вы будете готовы.'
                  : (waitingForOther ? 'Вы готовы — ждём партнёра.' : 'Квартал наступит, когда готовы оба трейдера.'))
                : (otherSeats.every((sx) => !room.occupied[sx])
                  ? (otherSeats.length > 1 ? 'Остальные места свободны: за них решают боты, квартал наступит сразу после ваших решений.'
                    : 'Второе место свободно: за него решает бот, квартал наступит сразу после ваших решений.')
                  : (waitingForOther
                    ? (pendingSeats.length > 1 ? 'Решения отправлены — ждём остальных.' : 'Решения отправлены — ждём партнёра.')
                    : (otherSeats.length > 1 ? 'Квартал наступит, когда решения пришлют все игроки.' : 'Квартал наступит, когда решения пришлют оба игрока.')))}
              {quarterPending && timeLeftLabel && (
                <span className="ems-mono" title={isTraderRoom ? 'Если оба не будут готовы вовремя, квартал наступит сам собой' : 'Если решение не придёт вовремя, за отсутствующего один раз решит бот'}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: timeLeftMs < 60000 ? COLOR.rust : COLOR.muted }}>
                  <Clock size={11} />{timeLeftLabel}
                </span>
              )}
            </span>
          )}
          {waitingForOther ? (
            <button className="ems-btn" style={{ padding: '12px 22px', fontSize: 13 }} disabled={busy} onClick={retract}>{isTraderRoom ? 'Отменить готовность' : 'Отозвать решения'}</button>
          ) : (
            <button className="ems-btn primary" style={{ padding: '12px 26px', fontSize: 13.5 }} disabled={busy} onClick={send}>
              {busy ? 'Отправка…' : isTraderRoom ? 'Готов к следующему кварталу'
                : isPresidentSeat ? 'Подписать и завершить квартал' : 'Отправить решения квартала'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ ГЛАВНОЕ МЕНЮ ============================ */
// Первый экран после запуска: выбор направления (новая партия / сеть /
// продолжить / достижения), а не сразу детальная анкета — её показывает
// SetupScreen отдельным шагом, только для новой одиночной партии.
// Витринные классы (.ems-hero-*, .ems-card-btn, .ems-theme-*) определены в
// GlobalStyle и переиспользуются на всех входных экранах (меню, новая партия,
// обучение, сеть) — не только здесь.
