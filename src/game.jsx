import React, { useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { fetchSoloSlots, fetchSoloSlot, saveSoloSlot, renameSoloSlot, deleteSoloSlot, submitDailyResult } from './lib/client.js';
import { withSeededRandom, hashSeed, dailyScore, DAILY_SCORE_KEYS } from './lib/catalog.js';
import {
  Landmark, Coins, Globe2, TrendingUp, Users, Activity, Newspaper, Factory, Scale, Banknote,
  ShieldAlert, ChevronDown, ChevronUp, Info, RotateCcw, ArrowUpRight, ArrowDownRight, X, Check,
  AlertTriangle, Bot, Gauge as GaugeIcon, Target, Zap, Save, Copy, Star, Flag, Megaphone, Sliders,
  Dices, Trophy, Share2, Download, Crown, Gavel, Hammer, BookOpen, Map as MapIcon,
} from 'lucide-react';
import {
  ROLES, DIFFICULTIES, GOALS, SCENARIOS, FX_REGIMES, LEVERS, CB_PERSONAS, MOF_PERSONAS, REQUESTS,
  REGIME_INFO, CRISIS_INFO, MANDATE_LABEL, regimeInfoText, regimeInfoLabel, POLITICAL_REGIME_INFO,
  gameChronicle, clamp, fmt1, fmt2, fmtSigned1, pctFmt, fmtSignedPct, fmtMoney, fmtMoneySigned,
  fmtIndex, fmtMln, fmtMlnSigned, quarterLabel, defaultDecisions, getCbPersona, personaAfterElection,
  getMofPersona, MAP_REGIONS, botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction,
  redescribeMofAction, simulateQuarter, makeInitialEconomy, leverPreview, pickPromises,
  evaluatePromise, pickPressQuestion, PRESIDENT_ACTIONS, PRES_BY_ID, PRES_GROUP_LABEL, reformShare,
  REFORM_RAMP, processPresidentialDirective, PRES_DIRECTIVE_COST, APPOINT_COST, CB_FULL_TERM,
  makeImpulse, askText, getPresPersona, botWarOrder, botCampaignPlan, electionForecast,
  botDefenseOrder, botFrontOrder, DEF_ENEMY, botTreaty, botDiplomacy, neighborEventView, WAR_TARGETS, warTargetOf, SOCIAL_GROUPS, ACTION_GROUP_EFFECTS, leverGroupEffects, botPresident,
  directiveProgress, directiveVerdict, militaryCoupRisk, parliamentBlocksReform, scaleLever,
} from './lib/engine.js';
import { Audio, stingerFor } from './audio/engine.js';
import {
  ACHIEVEMENTS, ACHIEVEMENTS_KEY, AchievementsModal, AUTOSAVE_KEY, loadUnlockedAchievements,
  loadRolesPlayed, validateSnapshot, SAVE_VERSION, SOLO_SLOT_COUNT, AudioControls, COLOR, FONT,
  GlobalStyle, THEMES, StateSeal, ROLE_ICON, NETWORK_PLAYED_KEY, loadNetworkSlots, writeNetworkSlots,
  isNetworkPlayed, ROLES_PLAYED_KEY, getPlayerId, useEscapeClose, useExclusiveDropdown, useAccount,
  DailyBoard, loadDailyName, saveDailyName, recordDailyBest, dailyDateLabel, loadFold, saveFold,
} from './MacroSimulator.jsx';

/* Экран партии (одиночная игра): панели ролей, показатели, новости, карта,
   общество, биржа, сохранения, итоги. Вынесен из MacroSimulator.jsx в отдельный
   файл, который подгружается лениво, когда игрок начинает или загружает партию —
   главное меню открывается быстрее, потому что не ждёт движок и весь интерфейс
   партии. Общие вещи (тема, звук, достижения, профиль) живут в MacroSimulator.jsx. */

const SIZE = { xs: 12, sm: 12, base: 13, md: 15, lg: 18, xl: 24, xxl: 32, hero: 36 };

const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 28, 7: 40 };

/* =========================================================================================
   8. МЕЛКИЕ КОМПОНЕНТЫ
========================================================================================= */
function DeltaTag({ value, invert, suffix = '', pill }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return <span style={{ color: COLOR.muted, fontSize: 12 }}>—</span>;
  const good = invert ? value < 0 : value > 0;
  const color = good ? COLOR.teal : COLOR.rust;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  // в плитках — «таблеткой» на цветной подложке: изменение читается с одного взгляда
  const pillStyle = pill ? { background: good ? COLOR.tealDim : COLOR.rustDim, padding: '1px 7px 1px 5px', borderRadius: 999, fontWeight: 600 } : null;
  return (
    <span style={{ color, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2, ...pillStyle }}>
      <Icon size={11} />{fmtSigned1(value)}{suffix}
    </span>
  );
}

export function Gauge({ value, size = 110 }) {
  const v = clamp(value, 0, 100);
  const angle = -90 + (v / 100) * 180;
  const color = v >= 65 ? COLOR.teal : v >= 40 ? COLOR.gold : COLOR.rust;
  // всё в долях размера: в компактной шапке деления не обрезаются, цифра не теснится
  const k = size / 110;
  const stroke = Math.max(5, 8 * k);
  const r = size / 2 - 10 * k - 1;
  const cx = size / 2; const cy = size / 2;
  const rad = (Math.PI / 180) * angle;
  const x2 = cx + r * Math.sin(rad); const y2 = cy - r * Math.cos(rad);
  const arc = (from, to) => {
    const rf = (Math.PI / 180) * from; const rt = (Math.PI / 180) * to;
    const x1 = cx + r * Math.sin(rf); const y1 = cy - r * Math.cos(rf);
    const x2b = cx + r * Math.sin(rt); const y2b = cy - r * Math.cos(rt);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2b} ${y2b}`;
  };
  const ticks = [0, 25, 50, 75, 100].map((t) => {
    const a = -90 + (t / 100) * 180;
    const ra = (Math.PI / 180) * a;
    const r1 = r + 5 * k; const r2 = r + (t % 50 === 0 ? 9 : 7) * k;
    return { x1: cx + r1 * Math.sin(ra), y1: cy - r1 * Math.cos(ra), x2: cx + r2 * Math.sin(ra), y2: cy - r2 * Math.cos(ra) };
  });
  return (
    <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6 + 4}`}>
      {ticks.map((t, i) => (<line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={COLOR.faint} strokeWidth={1} />))}
      <path d={arc(-90, 90)} stroke={COLOR.border} strokeWidth={stroke} fill="none" strokeLinecap="round" />
      <path d={arc(-90, angle)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={Math.max(1.5, 2 * k)} />
      <circle cx={cx} cy={cy} r={Math.max(2.2, 3 * k)} fill={color} />
      <text x={cx} y={cy - 12 * k} textAnchor="middle" fontSize={Math.max(13, 20 * k)} fontWeight={700} fill={COLOR.text} fontFamily={FONT.serif}>{Math.round(v)}</text>
    </svg>
  );
}

// мини-график последних значений прямо в плитке: число говорит «сколько сейчас»,
// а один взгляд на форму линии — «а раньше как было», без похода к графику ниже
export function Sparkline({ series, color, height = 16, area }) {
  const gradId = React.useId();
  if (!series || series.length < 2) return null;
  const w = 100; // виртуальные единицы viewBox — реальную ширину задаёт CSS (width:100%),
  // поэтому плитке неважно, узкая она или широкая: переполнения по горизонтали не будет
  const min = Math.min(...series); const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = height - ((v - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* под линией — мягкая заливка, растворяющаяся книзу */}
      {area && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={`url(#${gradId})`} />
        </>
      )}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiTile({ label, value, delta, invert, icon: Icon, series, hero }) {
  const good = Number.isFinite(delta) && Math.abs(delta) >= 0.05 ? (invert ? delta < 0 : delta > 0) : null;
  const barColor = good === null ? COLOR.border : good ? COLOR.teal : COLOR.rust;
  return (
    <div className={`${hero ? 'ems-panel-raised' : 'ems-panel'} ems-kpi-tile${hero ? ' hero' : ''}`}
      style={{ padding: hero ? '12px 16px 12px 20px' : '10px 12px 10px 14px', position: 'relative', overflow: 'hidden', height: '100%',
        borderColor: hero ? COLOR.gold : undefined }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: hero ? 4 : 3, background: hero ? COLOR.gold : barColor }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hero ? COLOR.goldSoft : COLOR.muted, fontSize: hero ? 12 : SIZE.xs, marginBottom: hero ? 9 : 7 }}>
        {Icon && <Icon size={hero ? 13 : 12} />}<span className="ems-kpi-label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 2 }}>
        {/* «2.01 трлн» переносился на две строки, и единица налезала на число:
            единица — мельче и на той же строке */}
        {(() => {
          const unit = hero && typeof value === 'string' ? value.match(/^(.*\d)\s+([^\d\s][^\d]*)$/) : null;
          return (
            <span className={hero ? 'ems-numeral ems-serif ems-kpi-hero-val' : 'ems-mono ems-serif ems-kpi-val'}
              style={{ fontSize: hero ? SIZE.hero : SIZE.xl - 3, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
              {unit ? <>{unit[1]}<span style={{ fontSize: '0.42em', marginLeft: '0.22em', letterSpacing: 0 }}>{unit[2]}</span></> : value}
            </span>
          );
        })()}
        <DeltaTag value={delta} invert={invert} pill />
      </div>
      {/* спарклайн — под цифрой, во всю ширину плитки: так его не приходится
          втискивать в один ряд с числом на узких мобильных плитках (2 в ряд) */}
      {series && series.length >= 2 && (
        <div className="ems-kpi-spark" style={{ marginTop: 8, marginLeft: -2, marginRight: -2 }}>
          <Sparkline series={series} color={hero ? COLOR.gold : barColor === COLOR.border ? COLOR.faint : barColor} height={hero ? 24 : 18} area />
        </div>
      )}
    </div>
  );
}

/* Радикальный пункт дизайн-ревизии: разделить «кабинет игрока» (решения, которые
   он лично принимает) и «состояние страны» (то, что ему докладывают) на два разных
   визуальных плана — не перекрашивая заново каждую внутреннюю панель (это отдельный,
   куда более рискованный рефакторинг всей темизации), а обрамляя одну и ту же
   колонку разной атмосферой снаружи: тёплый кабинетный свет слева, казённая рамка
   досье справа. */
/* Сворачиваемый блок кабинета: справочное (решения бота, бюджетная арифметика,
   президент) можно убрать в одну строку со сводкой — колонка перестаёт быть
   бесконечной лентой. Состояние каждого блока запоминается и переезжает с профилем. */
export function Fold({ id, title, icon: Icon, summary, defaultOpen = true, children }) {
  const [open, setOpen] = useState(() => loadFold(id, defaultOpen));
  const toggle = () => {
    Audio.play('tick');
    setOpen((o) => { const n = !o; saveFold(id, n); return n; });
  };
  if (!open) {
    return (
      <button className="ems-fold" onClick={toggle} aria-expanded={false} aria-label={`Развернуть: ${title}`}>
        {Icon && <Icon size={14} color={COLOR.goldSoft} style={{ flexShrink: 0 }} />}
        <span className="ems-serif" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{title}</span>
        {summary && <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{summary}</span>}
        <ChevronDown size={14} color={COLOR.faint} style={{ flexShrink: 0, marginLeft: summary ? 0 : 'auto' }} />
      </button>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <button className="ems-fold-close" onClick={toggle} aria-expanded aria-label={`Свернуть: ${title}`}>
        <ChevronUp size={11} />свернуть
      </button>
    </div>
  );
}

/* Однажды открытая вкладка (карта) остаётся смонтированной и просто прячется.
   Раньше каждое открытие карты строило весь svg с нуля, а закрытие — разбирало его:
   на телефоне это и были подвисания «открыл карту — закрыл карту». Пока вкладка
   скрыта, отдаём React тот же самый элемент, что и в прошлый раз, — он узнаёт его и
   не перерисовывает скрытую карту на каждое движение ползунка; свежие данные она
   получит, когда её снова откроют. */
export function KeepAlive({ active, style, children }) {
  const last = useRef(null);
  if (active) last.current = children;
  if (!last.current) return null;
  return <div style={{ ...style, display: active ? undefined : 'none' }}>{last.current}</div>;
}

// сводка пяти оценок для свёрнутого блока: средний балл
export function scoreSummary(economy) {
  const vals = SCORE_DEFS.map((d) => economy[d.id]).filter(Number.isFinite);
  return vals.length ? `в среднем ${Math.round(vals.reduce((a, v) => a + v, 0) / vals.length)} из 100` : '';
}

/* Колонка на широком экране «прилипает» при прокрутке: короткие колонки
   (вестник, показатели) больше не оставляют пустоту рядом с длинным кабинетом.
   Если колонка сама выше экрана, она сначала прокручивается до своего низа и
   только потом останавливается — ничего не обрезается. 84 — место под липкой
   панелью «Завершить квартал». */
function StickyColumn({ enabled, children }) {
  const ref = React.useRef(null);
  const [top, setTop] = useState(12);
  React.useEffect(() => {
    if (!enabled || !ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const el = ref.current;
    const update = () => setTop(Math.min(12, window.innerHeight - el.offsetHeight - 84));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [enabled]);
  return (
    <div ref={ref} style={{ position: enabled ? 'sticky' : 'relative', top: enabled ? top : undefined, alignSelf: 'start', minWidth: 0 }}>
      {children}
    </div>
  );
}

export function CabinetZone({ children, hidden }) {
  return (
    <div className={hidden ? 'ems-col-hidden' : ''} style={{ position: 'relative', borderRadius: 13, padding: `${SPACE[4]}px ${SPACE[3]}px ${SPACE[3]}px`,
      background: `radial-gradient(130% 85% at 12% -6%, ${COLOR.goldDim} 0%, transparent 58%), ${COLOR.bg}`,
      border: `1px solid ${COLOR.borderStrong}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <div className="ems-hero-eyebrow" style={{ marginBottom: SPACE[3], display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.gold, display: 'inline-block' }} />Кабинет
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

export function StateZone({ children, label, hidden }) {
  return (
    <div className={hidden ? 'ems-col-hidden' : ''} style={{ position: 'relative', borderRadius: 13, padding: `${SPACE[4]}px ${SPACE[3]}px ${SPACE[3]}px`,
      background: COLOR.bg, border: `1px solid ${COLOR.paperRule}4a` }}>
      {/* COLOR.paperRule как цвет ТЕКСТА здесь раньше проваливал контраст в
          светлой теме («Дневная канцелярия» — 1.5:1, tan на почти белом): это
          цвет линовки бумаги, не читаемого текста. COLOR.muted проверен на
          контраст во всех темах и остаётся приглушённым. Бордюр (paperRule
          с альфой) — декоративная линия, а не текст, на неё это не распространяется. */}
      <div className="ems-hero-eyebrow" style={{ marginBottom: SPACE[3], color: COLOR.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 9, height: 6, background: COLOR.muted, opacity: 0.7, display: 'inline-block', borderRadius: '1px 1px 0 0' }} />{label || 'Состояние страны'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/* Карта страны вынесена в src/countrymap.jsx и грузится лениво: её открывают
   вкладкой, а геометрия округов и береговой линии первому экрану не нужна. */
export const CountryMap = React.lazy(() => import('./countrymap.jsx').then((m) => ({ default: m.CountryMap })));

// экран «Общество» — тоже отдельным чанком: группы, коалиция, память о решениях
export const SocietyView = React.lazy(() => import('./society.jsx').then((m) => ({ default: m.SocietyView })));

export function LeverSlider({ lever, currentDisplay, value, onChange, preview, onIRF, infTarget }) {
  const delta = lever.type === 'level' ? value - currentDisplay : value;
  // кому из групп общества нравится это значение, а кому нет (см. «Общество»)
  const groupFx = leverGroupEffects(lever.id, value, infTarget);
  const [open, setOpen] = useState(false);
  const pct = clamp(((value - lever.min) / (lever.max - lever.min)) * 100, 0, 100);
  const trackStyle = { background: `linear-gradient(90deg, ${COLOR.gold} 0%, ${COLOR.gold} ${pct}%, ${COLOR.border} ${pct}%, ${COLOR.border} 100%)` };
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>{lever.label}</span>
        {lever.type === 'level' && (
          <span className="ems-mono" style={{ fontSize: 12, color: COLOR.muted }}>{currentDisplay.toFixed(2)}{lever.suffix}</span>
        )}
        {lever.type === 'flow' && !lever.persistent && (
          <span className="ems-mono" style={{ fontSize: 12, color: COLOR.muted }}>тек. 0{lever.suffix}</span>
        )}
      </div>
      {lever.hint && <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 1 }}>{lever.hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
        <input type="range" className="ems-slider" style={trackStyle} min={lever.min} max={lever.max} step={lever.step}
          aria-label={`${lever.label}, текущее значение ${value}${lever.suffix}, допустимо от ${lever.min} до ${lever.max}, шаг ${lever.step}`}
          value={value} onChange={(e) => { Audio.play('tick'); onChange(parseFloat(e.target.value)); }} />
        <span className="ems-mono" style={{ fontSize: 13, width: 62, textAlign: 'right', color: COLOR.goldSoft, fontWeight: 600 }}>
          {lever.type === 'level' ? `${value.toFixed(2)}${lever.suffix}` : `${value >= 0 ? '+' : ''}${value.toFixed(1)}${lever.suffix}`}
        </span>
      </div>
      {/* границы рычага нигде не были написаны: упереться в предел можно было
          только перетащив ползунок до конца, а сравнить свои возможности с
          решениями бота — вообще никак */}
      <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
        <span>{lever.type === 'level' ? '' : 'за квартал: '}от {lever.min}{lever.suffix} до {lever.max}{lever.suffix}</span>
        <span>шаг {lever.step}{lever.suffix}</span>
      </div>
      {groupFx.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 4, color: COLOR.muted }}>
          Группы при этом значении:{' '}
          {groupFx.map(([g, v], i) => (
            <span key={g}>{i ? ', ' : ''}<span style={{ color: v > 0 ? COLOR.teal : COLOR.rust }}>
              {(SOCIAL_GROUPS.find((x) => x.id === g) || {}).name.toLowerCase()} {v > 0 ? '+' : '−'}{Math.abs(v).toFixed(1)}</span></span>
          ))}
        </div>
      )}
      {Math.abs(delta) > 0.001 && (
        <div className="ems-fade-in" style={{ marginTop: 8, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: '8px 9px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 6 }}>
            {preview.items.map((it, i) => (
              <span key={i} style={{ fontSize: 12 }}><span style={{ color: COLOR.muted }}>{it.label}:</span> <span className="ems-mono">{it.text}</span></span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button className="ems-btn" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setOpen((o) => !o)}>
              {open ? 'Скрыть детали' : 'Плюсы и минусы'} {open ? <ChevronUp size={11} style={{ verticalAlign: -1 }} /> : <ChevronDown size={11} style={{ verticalAlign: -1 }} />}
            </button>
            {onIRF && (
              <button className="ems-btn" style={{ padding: '3px 8px', fontSize: 12, borderColor: COLOR.blue, color: COLOR.blue }}
                onClick={() => { Audio.play('click'); onIRF(lever, value, lever.type === 'level' ? currentDisplay : 0); }}>
                <Activity size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Реакция экономики
              </button>
            )}
          </div>
          {open && (
            <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.55 }}>
              <div style={{ color: COLOR.teal }}>+ {preview.pros.join('; ')}</div>
              <div style={{ color: COLOR.rust, marginTop: 2 }}>− {preview.cons.join('; ')}</div>
              <div style={{ color: COLOR.muted, marginTop: 4 }}>Неопределённость: {preview.uncertainty}{preview.delayNote ? ` · ${preview.delayNote}` : ''}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ ГРАФИКИ ============================ */
/* ChartPanel/MemoChart/IRFModal живут в отдельном чанке (src/charts.jsx) вместе
   с recharts (~104 KB gzip) — эта библиотека нужна только внутри уже запущенной
   партии, а не в меню/анкете/обучении, поэтому не должна грузиться заранее.
   React.lazy() подгружает файл по требованию; ChartFallback — что видно, пока
   он грузится (обычно доли секунды, но экран не должен оставаться пустым). */
export const ChartFallback = ({ height = 250 }) => (
  <div className="ems-panel" style={{ padding: 14, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.faint, fontSize: 12 }}>
    Загрузка графика…
  </div>
);

export const ChartPanel = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.ChartPanel })));

export const MemoChart = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.MemoChart })));

const IRFModal = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.IRFModal })));

export const InstrumentChart = React.lazy(() => import('./charts.jsx').then((m) => ({ default: m.InstrumentChart })));

export function WhyModal({ reasons, onClose }) {
  useEscapeClose(onClose);
  const [tab, setTab] = useState('gdpGrowth');
  const TABS = [
    { id: 'gdpGrowth', label: 'ВВП' }, { id: 'outputGap', label: 'Разрыв выпуска' }, { id: 'inflation', label: 'Инфляция' },
    { id: 'unemployment', label: 'Безработица' }, { id: 'exchangeRate', label: 'Курс валюты' },
    { id: 'budget', label: 'Бюджет' }, { id: 'banking', label: 'Банки' }, { id: 'potential', label: 'Потенциал' },
  ];
  const list = reasons[tab] || [];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.7)', backdropFilter: 'blur(2px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 480, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, display: 'flex', alignItems: 'center', gap: 8 }}><Info size={16} />Почему это произошло?</span>
          <button className="ems-btn" style={{ padding: '4px 7px' }} onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: `1px solid ${COLOR.hairline}`, marginBottom: 12, paddingBottom: 10 }}>
          {TABS.map((t) => (<button type="button" key={t.id} className={`ems-tab ${tab === t.id ? 'active' : ''}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>))}
        </div>
        {list.length === 0 && <div style={{ color: COLOR.muted, fontSize: 13 }}>В этом квартале не было значимых отдельных факторов — динамика определялась общей инерцией экономики.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 320, overflowY: 'auto' }} className="ems-scroll">
          {list.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.4 }}>
              <span style={{ color: r.amount >= 0 ? COLOR.teal : COLOR.rust, marginTop: 1, flexShrink: 0 }}>{r.amount >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>
              <span>{r.reasonText}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Второстепенные действия шапки (карточка результата, выход в меню) — раньше висели
   в ряд такими же квадратными иконками, что и «Газета»/«Достижения», хотя пользуются
   ими на порядок реже. Прячем их за один «⋯», оставляя на виду только то, что имеет
   самостоятельный смысл прямо по ходу партии. */
export function HeaderOverflowMenu({ items }) {
  const DD_WIDTH = 220;
  const { open, setOpen, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="ems-btn ghost" style={{ padding: '7px 10px', fontSize: 16, lineHeight: 1 }}
        title="Ещё" aria-label="Ещё действия" onClick={() => { Audio.play('click'); toggle(); }}>⋯</button>
      {open && (
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: DD_WIDTH, padding: SPACE[2], zIndex: 60 }}>
          {items.map((it) => (
            <button key={it.label} className="ems-btn ghost" style={{ width: '100%', textAlign: 'left', padding: `${SPACE[2]}px ${SPACE[3]}px`, fontSize: SIZE.base, display: 'flex', alignItems: 'center', gap: SPACE[2], color: it.danger ? COLOR.rust : COLOR.text }}
              onClick={() => { setOpen(false); it.onClick(); }}>
              <it.icon size={13} />{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ НОВОСТНАЯ ПОДСИСТЕМА ============================ */
export const NEWS_CATEGORIES = [
  { id: 'cb', label: 'Центральный банк', short: 'ЦБ', icon: '🏦', color: COLOR.blue },
  { id: 'gov', label: 'Правительство', short: 'Правительство', icon: '🏛', color: COLOR.gold },
  { id: 'markets', label: 'Рынки', short: 'Рынки', icon: '📊', color: COLOR.teal },
  { id: 'business', label: 'Бизнес', short: 'Бизнес', icon: '🏭', color: '#8E7CC3' },
  { id: 'households', label: 'Население', short: 'Население', icon: '👥', color: COLOR.goldSoft },
  { id: 'world', label: 'Мир', short: 'Мир', icon: '🌍', color: '#6FA8A0' },
  { id: 'opinion', label: 'Мнения', short: 'Мнения', icon: '💬', color: '#C08A6B' },
  { id: 'crisis', label: 'Кризис', short: 'Кризис', icon: '⚠️', color: COLOR.rust },
  { id: 'editorial', label: 'Сводка', short: 'Сводка', icon: '📰', color: COLOR.muted },
];

const CATMAP = {};

NEWS_CATEGORIES.forEach((c) => { CATMAP[c.id] = c; });

export const catOf = (id) => CATMAP[id] || CATMAP.markets;

export function ChainTrail({ chain }) {
  if (!chain || !chain.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 7 }}>
      {chain.map((step, i) => (
        <React.Fragment key={i}>
          <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 2,
            background: i === 0 ? COLOR.goldDim : COLOR.panelAlt, border: `1px solid ${i === 0 ? COLOR.gold : COLOR.border}`,
            color: i === 0 ? COLOR.goldSoft : COLOR.muted, whiteSpace: 'nowrap' }}>{step}</span>
          {i < chain.length - 1 && <span style={{ color: COLOR.faint, fontSize: 12 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function NewsItem({ item, showQuarter }) {
  const c = catOf(item.cat);
  const [open, setOpen] = useState(false);
  const hasChain = item.chain && item.chain.length > 0;
  return (
    <div style={{ borderLeft: `2px solid ${c.color}`, paddingLeft: 10, paddingBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12 }}>{c.icon}</span>
        <span style={{ fontSize: 12, color: c.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.short}</span>
        {showQuarter && item.qLabel && <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{item.qLabel}</span>}
        {item.storyTitle && (
          <span style={{ fontSize: 12, color: COLOR.faint, border: `1px solid ${COLOR.border}`, borderRadius: 2, padding: '0 4px' }}>
            сюжет «{item.storyTitle}» · {item.step}/{item.steps}
          </span>
        )}
      </div>
      <div className="ems-serif" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, margin: '3px 0 3px', color: COLOR.text, letterSpacing: '0.01em' }}>
        {item.headline}
      </div>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>{item.text}</div>
      {hasChain && (
        <>
          <button className="ems-btn" style={{ padding: '2px 7px', fontSize: 12, marginTop: 6 }} onClick={() => { Audio.play('tick'); setOpen((o) => !o); }}>
            {open ? 'Скрыть цепочку' : 'Цепочка последствий'} {open ? <ChevronUp size={10} style={{ verticalAlign: -1 }} /> : <ChevronDown size={10} style={{ verticalAlign: -1 }} />}
          </button>
          {open && <ChainTrail chain={item.chain} />}
        </>
      )}
    </div>
  );
}

export function NewsTerminal({ items, onOpenPaper }) {
  const [filter, setFilter] = useState('all');
  const present = NEWS_CATEGORIES.filter((c) => items.some((i) => i.cat === c.id));
  const list = (filter === 'all' ? items : items.filter((i) => i.cat === filter)).slice(0, 60);
  // лента растёт вставкой новых записей В НАЧАЛО массива, но скролл-позиция
  // блока сама не сбрасывается — если читали и проскроллили вниз, свежая
  // новость наверху оказывается выше видимой области и выглядит пропавшей
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = 0;
    // сброс scrollTop не помогает, если сама панель уехала за пределы видимой
    // области страницы (на телефоне «Завершить квартал» — внизу длинной
    // страницы, и после клика страница остаётся там же) — довозим панель
    // в поле зрения, но мягко: 'nearest' ничего не делает, если она и так видна
    scrollRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [items[0] && items[0].id]);
  // переключение рубрики тоже должно возвращать список наверх: список
  // отфильтрованных записей короче общего, и старая позиция прокрутки
  // могла указывать на середину этого нового, более короткого списка —
  // человек видел бы старые записи там, где ждал самые свежие
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filter]);
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <Newspaper size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Экономический терминал</span>
        <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: 12 }} onClick={() => { Audio.play('paper'); onOpenPaper(); }}>
          Газета и хроника
        </button>
      </div>
      {present.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
          <button type="button" className={`ems-tab ${filter === 'all' ? 'active' : ''}`} aria-pressed={filter === 'all'} style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => { Audio.play('tab'); setFilter('all'); }}>Всё</button>
          {present.map((c) => (
            <button type="button" key={c.id} className={`ems-tab ${filter === c.id ? 'active' : ''}`} aria-pressed={filter === c.id} style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => { Audio.play('tab'); setFilter(c.id); }}>
              {c.icon} {c.short}
            </button>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="ems-scroll" style={{ maxHeight: 430, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {list.length === 0 && <div style={{ fontSize: 12, color: COLOR.muted }}>Лента пуста — завершите первый квартал, и экономика начнёт рассказывать о себе сама.</div>}
        {/* новости шли сплошным потоком без границы между кварталами — метка
            квартала в каждой строке терялась среди заголовков и не читалась
            как раздел. Заголовок раздела перед первой новостью нового квартала
            разбивает ленту на понятные блоки — по одному на квартал. */}
        {list.map((n, i) => (
          <React.Fragment key={n.id}>
            {(i === 0 || n.q !== list[i - 1].q) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: i === 0 ? '0 0 -5px' : '3px 0 -5px' }}>
                <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {n.qLabel || quarterLabel(n.q)}
                </span>
                <div style={{ flex: 1, height: 1, background: COLOR.hairline }} />
              </div>
            )}
            <NewsItem item={n} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* Газета («Газета и хроника») подгружается лениво через React.lazy() — см.
   комментарий в начале src/newspaper.jsx. */
export const NewspaperModal = React.lazy(() => import('./newspaper.jsx').then((m) => ({ default: m.NewspaperModal })));

/* Торговый терминал и сводка портфеля подгружаются лениво через React.lazy() —
   см. комментарий в начале src/trading.jsx. */
export const TradingTerminal = React.lazy(() => import('./trading.jsx').then((m) => ({ default: m.TradingTerminal })));

export const PortfolioSummary = React.lazy(() => import('./trading.jsx').then((m) => ({ default: m.PortfolioSummary })));

/* ============================ АТМОСФЕРА ============================ */
const ATMOSPHERE = {
  normal: { tint: 'rgba(201,162,39,0.012)', vig: 0.16, accent: COLOR.gold, breathe: 0, grain: 0, label: 'спокойствие', urgent: false },
  overheating: { tint: 'rgba(214,146,42,0.030)', vig: 0.20, accent: '#D68E2A', breathe: 0.10, grain: 0, label: 'перегрев', urgent: false },
  recession: { tint: 'rgba(70,105,150,0.026)', vig: 0.24, accent: COLOR.blue, breathe: 0, grain: 0, label: 'спад', urgent: false },
  stagflation: { tint: 'rgba(138,120,48,0.034)', vig: 0.26, accent: '#A8913A', breathe: 0.12, grain: 0.02, label: 'стагфляция', urgent: true },
  banking: { tint: 'rgba(150,42,30,0.042)', vig: 0.30, accent: COLOR.rust, breathe: 0.20, grain: 0.035, label: 'банковский кризис', urgent: true },
  debt: { tint: 'rgba(150,42,30,0.036)', vig: 0.28, accent: COLOR.rust, breathe: 0.16, grain: 0.03, label: 'долговой кризис', urgent: true },
  currency: { tint: 'rgba(165,60,25,0.042)', vig: 0.30, accent: '#C2531F', breathe: 0.20, grain: 0.035, label: 'валютный кризис', urgent: true },
  deflation: { tint: 'rgba(120,150,175,0.024)', vig: 0.22, accent: '#7FA3B8', breathe: 0, grain: 0, label: 'дефляция', urgent: false },
};

export function Atmosphere({ regime, intensity, flashKey }) {
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const k = clamp(intensity, 0, 1);
  const vig = a.vig * (0.6 + 0.5 * k);
  return (
    <>
      {/* мягкий объём по краям вместо тяжёлой виньетки */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3, transition: 'background 3.2s ease',
        background: `radial-gradient(130% 105% at 50% 45%, transparent 58%, rgba(0,0,0,${vig.toFixed(3)}) 100%), ${a.tint}` }} />
      {a.breathe > 0 && (
        <div className="ems-breathe" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4,
          '--p': (a.breathe * (0.4 + 0.7 * k)).toFixed(3),
          background: `radial-gradient(150% 120% at 50% 118%, ${a.accent}22 0%, transparent 45%)` }} />
      )}
      {a.grain > 0 && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4, opacity: a.grain * (0.5 + 0.7 * k),
          background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 4px)' }} />
      )}
      {a.urgent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, pointerEvents: 'none', zIndex: 9, overflow: 'hidden', background: `${a.accent}33` }}>
          <div className="ems-sweep" style={{ height: '100%', width: '45%', background: `linear-gradient(90deg, transparent, ${a.accent}, transparent)` }} />
        </div>
      )}
      {flashKey ? (
        <div key={flashKey} className="ems-flash" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10,
          background: `radial-gradient(circle at 50% 40%, ${a.accent}55, transparent 70%)` }} />
      ) : null}
    </>
  );
}

/* Радикальный пункт ревизии: смена квартала — самое частое действие в игре —
   раньше происходила без единого визуального акцента, только смена цифр.
   Печать здесь и до этого жила только в газете (StateSeal/ProceduralNewspaper);
   расширяем её же мотив на сам момент перехода — «оттиск» ложится на экран и
   тут же тает, отмечая закрытие квартала, как отметка в гроссбухе. */
export function QuarterStamp({ stampKey, regime }) {
  if (!stampKey) return null;
  return (
    <div key={stampKey} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 55 }}>
      <div className="ems-quarter-stamp"><StateSeal regime={regime} size={132} /></div>
    </div>
  );
}

/* Аварийная строка: ощущение, что вы внутри события, а не читаете отчёт о нём */
export function CrisisBar({ economy, botAction }) {
  const regime = economy.regime;
  if (regime === 'normal' || regime === 'deflation') return null;
  const a = ATMOSPHERE[regime] || ATMOSPHERE.normal;
  const info = REGIME_INFO[regime] || REGIME_INFO.normal;
  const metrics = [];
  if (regime === 'banking') metrics.push(['Просрочка', pctFmt(economy.bankNPL)], ['Капитал банков', pctFmt(economy.bankCapitalAdequacy)], ['Ликвидность', Math.round(economy.bankLiquidity)]);
  else if (regime === 'currency') metrics.push(['Курс', `${fmtSigned1(economy.fxDeprAnnual)}% год.`], ['Резервы', fmtMoney(economy.reserves)], ['Цены импорта', pctFmt(economy.importPriceInflation)]);
  else if (regime === 'debt') metrics.push(['Долг', pctFmt(economy.debtToGdp)], ['Спред', `${Math.round(economy.sovereignSpread)} б.п.`], ['Проценты к доходам', pctFmt(economy.interestToRevenue)]);
  else if (regime === 'stagflation') metrics.push(['Инфляция', pctFmt(economy.inflation)], ['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Ожидания', pctFmt(economy.inflationExpectations)]);
  else if (regime === 'recession') metrics.push(['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Безработица', pctFmt(economy.unemployment)], ['Инвестиции', fmtSignedPct(economy.investmentGrowth)]);
  else metrics.push(['Разрыв выпуска', fmtSignedPct(economy.outputGap)], ['Инфляция', pctFmt(economy.inflation)], ['Рынок труда', `${fmtSigned1(economy.tightness)} п.п.`]);
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 8, borderTop: `1px solid ${a.accent}`, borderBottom: `1px solid ${a.accent}`,
      background: `linear-gradient(90deg, ${a.accent}22, ${COLOR.panel} 48%)`, padding: '7px 18px',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} role="status" aria-live="polite">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={a.urgent ? 'ems-blink' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: a.accent, display: 'inline-block' }} />
        <span className="ems-mono" style={{ fontSize: 12, color: a.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{regimeInfoLabel(info, economy)}</span>
        <span style={{ fontSize: 12, color: COLOR.faint }}>{economy.regimeStreak}-й квартал</span>
      </span>
      {metrics.map(([l, v]) => (
        <span key={l} style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'baseline' }}>
          <span style={{ color: COLOR.muted }}>{l}</span>
          <span className="ems-mono" style={{ color: COLOR.text }}>{v}</span>
        </span>
      ))}
      {botAction && botAction.demand && (
        <span style={{ fontSize: 12, color: a.accent, marginLeft: 'auto', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {botAction.demand}
        </span>
      )}
    </div>
  );
}

/* ============================ ФИНАНСОВЫЙ РЫНОК ============================ */
function Spark({ data, color, height = 30, fill }) {
  const vals = data.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return <div style={{ height }} />;
  const min = Math.min(...vals); const max = Math.max(...vals);
  const rng = max - min || 1;
  const w = 100;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${height - ((v - min) / rng) * (height - 3) - 1.5}`);
  return (
    <svg className="ems-visual" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} aria-hidden="true">
      {fill && <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity={0.12} />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Quote({ label, value, change, unit, color, big }) {
  const c = change === undefined ? COLOR.text : change > 0.001 ? COLOR.teal : change < -0.001 ? COLOR.rust : COLOR.muted;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: COLOR.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div className="ems-mono" style={{ fontSize: big ? 21 : 14, color: color || COLOR.text, lineHeight: 1.15, marginTop: 1 }}>
        {value}{unit ? <span style={{ fontSize: 12, color: COLOR.faint }}>{unit}</span> : null}
      </div>
      {change !== undefined && (
        <div className="ems-mono" style={{ fontSize: 12, color: c }}>{change > 0 ? '▲' : change < 0 ? '▼' : '■'} {fmtSigned1(change)}%</div>
      )}
    </div>
  );
}

/* Живые котировки: между кварталами цены дышат вокруг расчётных значений */
export function useLiveQuotes(economy) {
  const keys = ['stockIndex', 'bondIndex', 'sectorBanks', 'sectorIndustry', 'sectorConsumer', 'sectorResources',
    'exchangeRate', 'yield10y', 'yield2y', 'sovereignSpread', 'corporateSpread', 'marketCap',
    'corpBondIndex', 'fxIndex', 'goldIndex', 'depositIndex', 'reitIndex',
    'bondShortIndex', 'linkerIndex', 'moneyMarketIndex', 'worldEquityIndex'];
  const base = {};
  keys.forEach((k) => { base[k] = economy[k]; });
  const [live, setLive] = useState(base);
  React.useEffect(() => {
    const b = {}; keys.forEach((k) => { b[k] = economy[k]; });
    setLive(b);
    const vol = clamp(economy.volatilityIndex / 100, 0.05, 1);
    const id = setInterval(() => {
      setLive((prev) => {
        const next = {};
        keys.forEach((k) => {
          const target = b[k];
          const amp = target * vol * 0.0045;
          const pull = (target - (prev[k] || target)) * 0.18;
          next[k] = (prev[k] || target) + pull + (Math.random() - 0.5) * amp * 2;
        });
        return next;
      });
    }, 1200);
    return () => clearInterval(id);
  }, [economy]);
  return live;
}

/* Бегущая строка держит живые котировки внутри себя, чтобы не перерисовывать экран целиком */
function LiveTicker({ economy, prev }) {
  const live = useLiveQuotes(economy);
  const chg = (k) => (prev && prev[k] ? (economy[k] / prev[k] - 1) * 100 : 0);
  const items = [
    ['ИНДЕКС', live.stockIndex, chg('stockIndex'), 0], ['БАНКИ', live.sectorBanks, chg('sectorBanks'), 0],
    ['ПРОМ', live.sectorIndustry, chg('sectorIndustry'), 0], ['ПОТРЕБ', live.sectorConsumer, chg('sectorConsumer'), 0],
    ['СЫРЬЁ', live.sectorResources, chg('sectorResources'), 0], ['НЕДВИЖ', live.reitIndex, chg('reitIndex'), 0],
    ['ОБЛИГ', live.bondIndex, chg('bondIndex'), 0], ['10Y', live.yield10y, 0, 2],
    ['КУРС', live.exchangeRate, chg('exchangeRate'), 1], ['СПРЕД', live.sovereignSpread, 0, 0],
  ];
  return (
    <div className="ems-panel" style={{ padding: '7px 12px', marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ems-mono" style={{ fontSize: 12, color: COLOR.gold, letterSpacing: '0.1em' }}>ТОРГИ</span>
        {items.map(([label, val, ch, dec]) => (
          <span key={label} className="ems-mono" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: COLOR.faint }}>{label}</span>
            <span style={{ color: COLOR.text }}>{Number.isFinite(val) ? val.toFixed(dec) : '—'}</span>
            <span style={{ color: ch > 0.01 ? COLOR.teal : ch < -0.01 ? COLOR.rust : COLOR.faint, fontSize: 12 }}>
              {ch > 0.01 ? '▲' : ch < -0.01 ? '▼' : '·'}{Math.abs(ch) > 0.01 ? `${Math.abs(ch).toFixed(1)}%` : ''}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MarketScreen({ economy, prev, history, book, onTrade }) {
  const live = null;
  const q = (k) => (live && Number.isFinite(live[k]) ? live[k] : economy[k]);
  const hist = useMemo(() => history.slice(-28), [history]);
  const seriesCache = useMemo(() => {
    const keys = ['stockIndex', 'bondIndex', 'sectorBanks', 'sectorIndustry', 'sectorConsumer', 'sectorResources', 'reitIndex', 'exchangeRate'];
    const out = {};
    keys.forEach((k) => { out[k] = hist.map((h) => h[k]); });
    return out;
  }, [hist]);
  const ser = (k) => seriesCache[k] || hist.map((h) => h[k]);
  const chg = (k) => (prev && prev[k] ? (economy[k] / prev[k] - 1) * 100 : 0);
  const Panel = ({ title, icon: Icon, children, accent }) => (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        {Icon && <Icon size={13} color={accent || COLOR.goldSoft} />}
        <span className="ems-serif" style={{ fontSize: 13, color: accent || COLOR.goldSoft }}>{title}</span>
      </div>
      {children}
    </div>
  );
  const curve = [['3м', economy.yield3m], ['1г', economy.yield1y], ['2г', economy.yield2y], ['5л', economy.yield5y], ['10л', economy.yield10y]];
  const curvePrev = prev ? [prev.yield3m, prev.yield1y, prev.yield2y, prev.yield5y, prev.yield10y] : null;
  const yMin = Math.min(...curve.map((c) => c[1]), ...(curvePrev || [99])) - 0.6;
  const yMax = Math.max(...curve.map((c) => c[1]), ...(curvePrev || [0])) + 0.6;
  const cx = (i) => 8 + i * (184 / (curve.length - 1));
  const cy = (v) => 76 - ((v - yMin) / Math.max(0.5, yMax - yMin)) * 62;

  return (
    <div style={{ padding: '0 18px 18px' }}>
      <LiveTicker economy={economy} prev={prev} />

      {book && (
        <div style={{ marginBottom: 12 }}>
          <Suspense fallback={<ChartFallback height={190} />}>
            <TradingTerminal economy={economy} prev={prev} history={history} book={book} onTrade={onTrade} />
          </Suspense>
        </div>
      )}

      <div className="ems-market-grid">
        <Panel title="Фондовый рынок" icon={TrendingUp}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
            <Quote label="Сводный индекс" value={fmtIndex(q('stockIndex'))} change={chg('stockIndex')} big />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: COLOR.muted }}>Капитализация</div>
              <div className="ems-mono" style={{ fontSize: 14 }}>{fmtMoney(economy.marketCap)}</div>
              <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>{fmt1(economy.marketCapPctGdp)}% ВВП</div>
            </div>
          </div>
          <div style={{ margin: '6px 0 4px' }}>
            <Suspense fallback={<ChartFallback height={64} />}>
              <MemoChart data={ser('stockIndex')} color={COLOR.gold} height={64} label="Индекс акций" fmt={fmtIndex} />
            </Suspense>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 12px', marginTop: 8 }}>
            {[['Банки', 'sectorBanks', COLOR.blue], ['Промышленность', 'sectorIndustry', COLOR.teal],
              ['Потребительский', 'sectorConsumer', COLOR.goldSoft], ['Сырьевой', 'sectorResources', '#8E7CC3']].map(([label, key, col]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: COLOR.muted }}>{label}</span>
                    <span className="ems-mono" style={{ color: chg(key) >= 0 ? COLOR.teal : COLOR.rust }}>{fmtSigned1(chg(key))}%</span>
                  </div>
                  <Spark data={ser(key)} color={col} height={22} />
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 9, fontSize: 12, color: COLOR.muted, flexWrap: 'wrap' }}>
            <span>P/E <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.stockPE)}</b></span>
            <span>справедливый <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.fairPE)}</b></span>
            <span>премия за риск акций <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(economy.equityRiskPremium)}%</b></span>
          </div>
        </Panel>

        <Panel title="Кривая доходности" icon={Activity} accent={economy.curveInverted ? COLOR.rust : COLOR.goldSoft}>
          <svg viewBox="0 0 200 90" style={{ width: '100%', height: 108 }}>
            {[0, 1, 2, 3].map((i) => (<line key={i} x1={8} y1={14 + i * 20} x2={192} y2={14 + i * 20} stroke={COLOR.hairline} strokeWidth={0.6} />))}
            {curvePrev && <polyline points={curvePrev.map((v, i) => `${cx(i)},${cy(v)}`).join(' ')} fill="none" stroke={COLOR.faint} strokeWidth={1} strokeDasharray="3 3" />}
            <polyline points={curve.map((c, i) => `${cx(i)},${cy(c[1])}`).join(' ')} fill="none"
              stroke={economy.curveInverted ? COLOR.rust : COLOR.gold} strokeWidth={1.8} />
            {curve.map((c, i) => (
              <g key={c[0]}>
                <circle cx={cx(i)} cy={cy(c[1])} r={2.2} fill={economy.curveInverted ? COLOR.rust : COLOR.gold} />
                <text x={cx(i)} y={88} textAnchor="middle" fontSize={7.5} fill={COLOR.faint}>{c[0]}</text>
                <text x={cx(i)} y={cy(c[1]) - 6} textAnchor="middle" fontSize={7.5} fill={COLOR.muted}>{fmt1(c[1])}</text>
              </g>
            ))}
          </svg>
          <div style={{ fontSize: 12, color: economy.curveInverted ? COLOR.rust : COLOR.muted, lineHeight: 1.45, marginTop: 4 }}>
            {economy.curveInverted
              ? `Кривая инвертирована на ${fmt1(-economy.curveSlope)} п.п. Рынок закладывает, что нынешняя жёсткость сломает спрос и ставку придётся снижать — исторически это сигнал рецессии.`
              : `Наклон ${fmtSigned1(economy.curveSlope)} п.п. Длинные ставки выше коротких: рынок не ждёт скорого разворота политики.`}
          </div>
        </Panel>

        <Panel title="Облигации и риск-премии" icon={Landmark}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Quote label="Индекс облигаций" value={Number.isFinite(q('bondIndex')) ? q('bondIndex').toFixed(1) : '—'} change={chg('bondIndex')} />
            <Quote label="Доходность 10 лет" value={fmt2(economy.yield10y)} unit="%" />
            <Quote label="Ставка нового долга" value={fmt2(economy.effectiveDebtRate)} unit="%" />
          </div>
          <div style={{ margin: '6px 0' }}>
            <Suspense fallback={<ChartFallback height={54} />}>
              <MemoChart data={ser('bondIndex')} color={COLOR.blue} height={54} label="Индекс облигаций" fmt={fmtIndex} />
            </Suspense>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Суверенный спред', economy.sovereignSpread, 800], ['Корпоративный спред', economy.corporateSpread, 1200],
              ['Премия за риск страны', economy.riskPremium * 100, 900]].map(([label, v, max]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: COLOR.muted, flex: '0 1 132px', minWidth: 0 }}>{label}</span>
                  <span style={{ flex: 1, height: 4, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${clamp(v / max * 100, 0, 100)}%`,
                      background: v > max * 0.5 ? COLOR.rust : v > max * 0.25 ? COLOR.gold : COLOR.teal }} />
                  </span>
                  <span className="ems-mono" style={{ minWidth: 62, textAlign: 'right', whiteSpace: 'nowrap' }}>{Math.round(v)} б.п.</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Банковский сектор" icon={ShieldAlert} accent={economy.bankingRisk > 60 ? COLOR.rust : COLOR.goldSoft}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <Quote label="Индекс банков" value={Number.isFinite(q('sectorBanks')) ? q('sectorBanks').toFixed(0) : '—'} change={chg('sectorBanks')} />
            <Quote label="Цена к капиталу" value={fmt2(economy.bankPB)} />
            <Quote label="Рентабельность" value={fmt1(economy.bankROE)} unit="%" color={economy.bankROE < 0 ? COLOR.rust : COLOR.text} />
          </div>
          <Suspense fallback={<ChartFallback height={48} />}>
            <MemoChart data={ser('sectorBanks')} color={COLOR.blue} height={48} label="Индекс банков" fmt={(v) => v.toFixed(0)} />
          </Suspense>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginTop: 9, fontSize: 12 }}>
            {[['Процентная маржа', `${fmt2(economy.netInterestMargin)} п.п.`], ['Просрочка', pctFmt(economy.bankNPL)],
              ['Достаточность капитала', pctFmt(economy.bankCapitalAdequacy)], ['Норматив', pctFmt(economy.capitalRequirement)],
              ['Кредитный портфель', fmtMoney(economy.creditVolume)], ['Рост кредита', fmtSignedPct(economy.creditGrowth)]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{b}</span>
                </div>
              ))}
          </div>
          {economy.creditCrunch && (
            <div style={{ marginTop: 8, fontSize: 12, color: COLOR.rust, lineHeight: 1.4 }}>
              Капитал упёрся в норматив: банки физически не могут выдавать новые кредиты, сколько бы ни стоили деньги.
            </div>
          )}
        </Panel>

        <Panel title="Валютный рынок" icon={Globe2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Quote label="Курс (выше — слабее)" value={Number.isFinite(q('exchangeRate')) ? q('exchangeRate').toFixed(2) : '—'} change={chg('exchangeRate')} big />
            <Quote label="Реальный курс" value={fmt1(economy.realExchangeRate)} />
          </div>
          <div style={{ margin: '6px 0' }}>
            <Suspense fallback={<ChartFallback height={54} />}>
              <MemoChart data={ser('exchangeRate')} color={COLOR.rust} height={54} label="Курс" fmt={(v) => v.toFixed(2)} />
            </Suspense>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 12 }}>
            {[['Режим', economy.fxRegime === 'free' ? 'плавающий' : economy.fxRegime === 'managed' ? 'управляемый' : 'фиксированный'],
              ['Ориентир', economy.fxRegime === 'free' ? '—' : fmt1(economy.fxTarget)],
              ['Резервы', fmtMoney(economy.reserves)], ['Интервенции', fmtMoneySigned(economy.defenseIntervention || 0)],
              ['Волатильность', fmt1(economy.fxVolatility)], ['Текущий счёт', fmtMoneySigned(economy.currentAccount)]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{b}</span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Настроение рынка" icon={Zap} accent={economy.volatilityIndex > 45 ? COLOR.rust : COLOR.goldSoft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Gauge value={clamp(100 - economy.volatilityIndex, 0, 100)} size={86} />
            <div style={{ flex: 1 }}>
              <Quote label="Индекс страха" value={fmt1(economy.volatilityIndex)}
                color={economy.volatilityIndex > 45 ? COLOR.rust : economy.volatilityIndex > 28 ? COLOR.gold : COLOR.teal} big />
              <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 6, lineHeight: 1.45 }}>
                {economy.volatilityIndex > 55 ? 'Рынок в панике: цены двигаются быстрее, чем поступают новости.'
                  : economy.volatilityIndex > 32 ? 'Нервозность повышена — инвесторы требуют премию за неопределённость.'
                    : 'Рынок спокоен, премии за риск сжаты. Именно в такие периоды копятся дисбалансы.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginTop: 10, fontSize: 12 }}>
            {[['Ставка дисконтирования', `${fmt1(economy.discountRate)}%`], ['Премия за риск акций', `${fmt1(economy.equityRiskPremium)}%`],
              ['Прибыль корпораций', fmtMoney(economy.earnings)], ['Доходность облигаций 2 года', `${fmt2(economy.yield2y)}%`]].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: COLOR.muted }}>{a}</span><span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{b}</span>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================ НОВЫЕ КОМПОНЕНТЫ ============================ */
const SCORE_DEFS = [
  { id: 'scoreStability', label: 'Макростабильность', short: 'Стабильность', color: COLOR.gold, hint: 'Инфляция у цели, заякоренные ожидания, закрытый разрыв выпуска.' },
  { id: 'scoreWelfare', label: 'Благосостояние населения', short: 'Люди', color: COLOR.teal, hint: 'Реальные доходы, занятость, уверенность, человеческий капитал.' },
  { id: 'scoreFinancial', label: 'Финансовая устойчивость', short: 'Финансы', color: COLOR.blue, hint: 'Капитал банков, просрочка, кредитный разрыв, резервы.' },
  { id: 'scoreFiscal', label: 'Бюджетная устойчивость', short: 'Бюджет', color: COLOR.rust, hint: 'Долг, дефицит, стоимость обслуживания, собираемость налогов.' },
  { id: 'scorePotential', label: 'Долгосрочный потенциал', short: 'Потенциал', color: '#8E7CC3', hint: 'Производительность, образование, инфраструктура, капитал.' },
];

function ScoreRadar({ economy, prev, size = 190 }) {
  const cx = size / 2; const cy = size / 2 + 6; const R = size / 2 - 34;
  const n = SCORE_DEFS.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (getter) => SCORE_DEFS.map((d, i) => pt(i, R * clamp(getter(d.id), 0, 100) / 100).join(',')).join(' ');
  const grid = [25, 50, 75, 100].map((g) => SCORE_DEFS.map((d, i) => pt(i, R * g / 100).join(',')).join(' '));
  return (
    <svg className="ems-visual" width="100%" viewBox={`0 0 ${size} ${size + 12}`} style={{ maxWidth: size }} aria-hidden="true">
      {grid.map((g, i) => (<polygon key={i} points={g} fill="none" stroke={COLOR.hairline} strokeWidth={1} />))}
      {SCORE_DEFS.map((dd, i) => { const [x, y] = pt(i, R); return <line key={dd.id} x1={cx} y1={cy} x2={x} y2={y} stroke={COLOR.hairline} strokeWidth={1} />; })}
      {prev && <polygon points={poly((id) => prev[id])} fill="none" stroke={COLOR.faint} strokeWidth={1} strokeDasharray="3 3" />}
      <polygon points={poly((id) => economy[id])} fill="rgba(201,162,39,0.16)" stroke={COLOR.gold} strokeWidth={1.7} />
      {SCORE_DEFS.map((dd, i) => {
        const [x, y] = pt(i, R + 17);
        return (
          <g key={dd.id}>
            <text x={x} y={y} textAnchor="middle" fontSize={8.5} fill={COLOR.muted}>{dd.short}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize={10} fontWeight={700} fill={dd.color}>{Math.round(economy[dd.id])}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ScorePanel({ economy, prev, goalDef }) {
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Target size={14} />Пять оценок вашей политики
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 8, lineHeight: 1.45 }}>Максимизировать все пять одновременно невозможно: каждая политика что-то отнимает у остальных.</div>
      <div style={{ display: 'flex', justifyContent: 'center' }}><ScoreRadar economy={economy} prev={prev} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
        {SCORE_DEFS.map((dd) => {
          const v = clamp(economy[dd.id] || 0, 0, 100); const delta = (economy[dd.id] || 0) - (prev ? prev[dd.id] || 0 : 0);
          const isGoal = goalDef && goalDef.score && `score${goalDef.score.charAt(0).toUpperCase()}${goalDef.score.slice(1)}` === dd.id;
          return (
            <div key={dd.id} title={dd.hint} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
              <span style={{ color: isGoal ? COLOR.goldSoft : COLOR.muted, width: 92, fontWeight: isGoal ? 600 : 400 }}>{dd.short}{isGoal ? ' ★' : ''}</span>
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${v}%`, height: '100%', background: dd.color }} />
              </span>
              <span className="ems-mono" style={{ width: 22, textAlign: 'right', color: dd.color, fontWeight: 600 }}>{Math.round(v)}</span>
              <DeltaTag value={delta} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RegimeBanner({ economy, crisisOnly = false }) {
  const info = REGIME_INFO[economy.regime] || REGIME_INFO.normal;
  const c = info.color === 'teal' ? COLOR.teal : info.color === 'gold' ? COLOR.gold : info.color === 'blue' ? COLOR.blue : COLOR.rust;
  const dim = info.color === 'teal' ? COLOR.tealDim : info.color === 'gold' ? COLOR.goldDim : info.color === 'blue' ? COLOR.blueDim : COLOR.rustDim;
  // баннер не должен висеть на экране постоянно: в нормальном режиме показываем
  // его недолго (только что зашли / кризис только закончился), а не бессрочно;
  // сам кризис — другое дело, его показываем, пока он активен
  const [visible, setVisible] = useState(true);
  React.useEffect(() => {
    setVisible(true);
    if (economy.regime !== 'normal') return undefined;
    const t = setTimeout(() => setVisible(false), 45000);
    return () => clearTimeout(t);
  }, [economy.regime]);
  if (!visible || (crisisOnly && economy.regime === 'normal')) return null;
  // кризисный режим должен ощутимо «весить» тяжелее нормального — иначе баннер
  // «всё спокойно» и баннер «валютный кризис» выглядят одинаково важными
  const isCrisis = economy.regime !== 'normal';
  return (
    <div className="ems-fade-in" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: dim,
      border: `1px solid ${c}`, borderLeft: `${isCrisis ? 4 : 1}px solid ${c}`, borderRadius: 3,
      padding: isCrisis ? '11px 14px' : '9px 12px', fontSize: 12 }}>
      <Activity size={isCrisis ? 17 : 15} color={c} style={{ flexShrink: 0, marginTop: 1 }} />
      <div><b style={{ color: c, fontSize: isCrisis ? 13 : 12 }}>Режим экономики: {regimeInfoLabel(info, economy)}.</b> <span style={{ color: COLOR.muted }}>{regimeInfoText(info, economy)}</span></div>
    </div>
  );
}

function StanceBar({ value, leftLabel, rightLabel }) {
  const v = clamp(value, -1, 1);
  const pos = (v + 1) / 2 * 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ position: 'relative', height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${COLOR.teal} 0%, ${COLOR.border} 50%, ${COLOR.rust} 100%)` }}>
        <span style={{ position: 'absolute', left: `calc(${pos}% - 4px)`, top: -2.5, width: 8, height: 10, borderRadius: 2, background: COLOR.text, border: `1px solid ${COLOR.bg}` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLOR.faint, marginTop: 3 }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
    </div>
  );
}

/* Решения чужого ведомства — бота или партнёра — теми же ползунками, что у игрока
   на этом месте, только для чтения. Раньше карточка бота показывала лишь несколько
   итоговых показателей, а сами решения (закупки, выплаты, инвестиции у Минфина;
   ставка, резервы, операции с деньгами, интервенции у ЦБ) проскакивали одной фразой
   в тексте: сравнить, насколько бот жёстче или мягче, чем мог бы быть, было не с чем.
   Пределы берутся через scaleLever — те же, что игрок видит у себя прямо сейчас. */
const FISCAL_FLOW_IDS = ['govSpending', 'transfers', 'govInvestment'];

const MONETARY_READOUT_IDS = ['keyRate', 'inflationTarget', 'reserveReq', 'capitalRequirement', 'moneySupplyOp', 'fxIntervention', 'liquidity'];

export function LeverReadout({ ids, levers, economy, accent }) {
  const color = accent || COLOR.teal;
  return (
    <div>
      {ids.map((id) => {
        const base = LEVERS.find((l) => l.id === id);
        if (!base) return null;
        const lever = economy ? scaleLever(base, economy) : base;
        const known = levers && Number.isFinite(levers[id]);
        const value = known ? levers[id] : (lever.type === 'level' ? lever.min : 0);
        const pct = clamp(((value - lever.min) / (lever.max - lever.min)) * 100, 0, 100);
        const digits = lever.step < 0.5 ? 2 : lever.step < 1 ? 1 : 0;
        const shown = lever.type === 'level' ? `${value.toFixed(digits)}${lever.suffix}` : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${lever.suffix}`;
        return (
          <div key={id} style={{ padding: '5px 0', borderBottom: `1px solid ${COLOR.hairline}` }}
            title={`${lever.type === 'level' ? '' : 'за квартал: '}от ${lever.min}${lever.suffix} до ${lever.max}${lever.suffix}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12 }}>{lever.label}</span>
              <span className="ems-mono" style={{ fontSize: 12, color: known ? color : COLOR.faint, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {known ? shown : '—'}
              </span>
            </div>
            {/* пределы по краям ползунка, а не отдельной строкой: у ЦБ их семь подряд */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, minWidth: 22 }}>{lever.min}</span>
              <input type="range" className="ems-slider" tabIndex={-1} aria-readonly="true"
                aria-label={`${lever.label}: ${known ? `${value}${lever.suffix}` : 'решения ещё не было'}, допустимо от ${lever.min} до ${lever.max}`}
                min={lever.min} max={lever.max} step={lever.step} value={value} onChange={() => {}}
                style={{ pointerEvents: 'none', flex: 1, opacity: known ? 1 : 0.45,
                  background: `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, ${COLOR.border} ${pct}%, ${COLOR.border} 100%)` }} />
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, minWidth: 22, textAlign: 'right' }}>{lever.max}{lever.suffix.trim() === '%' ? '%' : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const FiscalLeverReadout = ({ levers, accent, economy }) => (
  <LeverReadout ids={FISCAL_FLOW_IDS} levers={levers} accent={accent} economy={economy} />
);

// у ЦБ кроме ползунков — режим курса и, если курс не плавает, его целевой уровень
export function MonetaryLeverReadout({ levers, accent, economy }) {
  const regime = levers && levers.fxRegime ? FX_REGIMES.find((r) => r.id === levers.fxRegime) : null;
  const ids = levers && levers.fxRegime && levers.fxRegime !== 'free' ? [...MONETARY_READOUT_IDS, 'fxTarget'] : MONETARY_READOUT_IDS;
  return (
    <div>
      <LeverReadout ids={ids} levers={levers} accent={accent} economy={economy} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0' }}>
        <span>Режим курса</span>
        <span className="ems-mono" style={{ color: regime ? (accent || COLOR.blue) : COLOR.faint, fontWeight: 600 }}>{regime ? regime.label : '—'}</span>
      </div>
      {levers && levers.emergency && (
        <div style={{ fontSize: 12, color: COLOR.rust }}>Включена экстренная поддержка банков</div>
      )}
    </div>
  );
}

/* Панель ведомства, которым управляет бот */
function BotPanel({ botRole, persona, lastAction, coordination, economy }) {
  if (!botRole) return null;
  const isCb = botRole === 'central_bank';
  // ЦБ и Минфин раньше делили один и тот же синий заголовок панели — в плотной
  // колонке не читалось, чьё это решение, без чтения подписи целиком. Синий
  // остаётся за ЦБ (уже сложившаяся ассоциация в интерфейсе), Минфину — тил.
  const accent = isCb ? COLOR.blue : COLOR.teal;
  const Icon = isCb ? Landmark : Coins;
  const row = (l, v) => (
    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '1.5px 0', color: l.startsWith('·') ? COLOR.muted : COLOR.text }}>
      <span>{l}</span><span className="ems-mono">{v}</span>
    </div>
  );
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong, borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <Icon size={14} color={accent} />
        <span className="ems-serif" style={{ fontSize: 14, color: accent }}>{isCb ? 'Центральный банк' : 'Министерство финансов'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={11} />бот</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{persona.name}</b> · {persona.title}
      </div>
      <StanceBar value={lastAction ? lastAction.stance : 0} leftLabel={isCb ? 'мягкая политика' : 'консолидация'} rightLabel={isCb ? 'жёсткая политика' : 'стимулирование'} />
      {lastAction && (
        <div style={{ marginTop: 9, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${accent}`, paddingLeft: 9, color: COLOR.text }}>
          {lastAction.note}
        </div>
      )}
      {lastAction && lastAction.quote && (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9, color: COLOR.muted, fontStyle: 'italic' }}>
          «{lastAction.quote}»
        </div>
      )}
      {lastAction && lastAction.demand && (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.rust}`, paddingLeft: 9, color: COLOR.muted }}>
          <span style={{ color: COLOR.rust, fontWeight: 600 }}>Требование: </span>{lastAction.demand}
        </div>
      )}
      {economy && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${COLOR.hairline}` }}>
          {isCb ? (
            <>
              <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 2 }}>Решения прошлого квартала</div>
              <MonetaryLeverReadout levers={lastAction ? lastAction.decisions : null} accent={accent} economy={economy} />
              <div style={{ height: 7 }} />
              {row('Ликвидность банков', pctFmt(economy.bankLiquidity))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 2 }}>Бюджетные потоки, темп роста</div>
              <FiscalLeverReadout levers={lastAction ? lastAction.decisions : null} accent={accent} economy={economy} />
              <div style={{ height: 7 }} />
              {row('Расходы всего', `${fmtMoney(economy.govSpendingTotal)} · ${fmt1(economy.govSpendingTotal / economy.nominalGdp * 100)}% ВВП`)}
              {row('· госзакупки', fmtMoney(economy.govPurchasesNominal))}
              {row('   из них оборона', `${fmtMoney(economy.govPurchasesNominal * (economy.budgetShares.defense || 0) / 100)} · ${fmt1(economy.budgetShares.defense || 0)}%`)}
              {row('· выплаты', fmtMoney(economy.transfersNominal))}
              {row('· инвестиции', fmtMoney(economy.govInvestmentNominal))}
              {row('· обслуживание долга', `${fmtMoney(economy.interestPayment)} · ставка ${fmt1(economy.effectiveDebtRate)}%`)}
              {row('Госдолг', `${pctFmt(economy.debtToGdp)} ВВП`)}
            </>
          )}
        </div>
      )}
      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLOR.muted }}>
        <span>Согласованность политики</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${clamp(coordination, 0, 100)}%`, height: '100%', background: coordination > 60 ? COLOR.teal : coordination > 35 ? COLOR.gold : COLOR.rust }} />
        </span>
        <span className="ems-mono">{Math.round(coordination)}</span>
      </div>
    </div>
  );
}

/* Пресс-конференция: один вопрос за квартал, выбранный вариант ответа — а не
   цифры политики — сам двигает доверие и рейтинг. Отдельно от обещаний: те
   подводят итог по факту на выборах, здесь решает само слово. Не показывается
   трейдеру — у него нет мандата, за который отвечают перед прессой. */
export function PressConferencePanel({ question, answer, setAnswer }) {
  if (!question) return null;
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Megaphone size={13} />Пресс-конференция
      </div>
      <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.45, marginBottom: 9 }}>«{question.prompt}»</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {question.options.map((opt) => {
          const active = answer === opt.id;
          return (
            <div key={opt.id} role="button" tabIndex={0} className="ems-card-btn"
              onClick={() => { Audio.play('tick'); setAnswer(active ? null : opt.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAnswer(active ? null : opt.id); } }}
              style={{ padding: '8px 10px', flexDirection: 'column', alignItems: 'flex-start', gap: 2, cursor: 'pointer',
                borderColor: active ? COLOR.gold : COLOR.border, background: active ? COLOR.goldDim : COLOR.panelAlt }}>
              <span style={{ fontSize: 12, color: active ? COLOR.goldSoft : COLOR.text, fontWeight: active ? 600 : 400 }}>{opt.label}</span>
              {active && <span style={{ fontSize: 12, color: COLOR.muted, fontStyle: 'italic', marginTop: 2 }}>«{opt.quote}»</span>}
            </div>
          );
        })}
      </div>
      {!answer && <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 7 }}>Можно не отвечать — тогда ответ никак не скажется на доверии и рейтинге.</div>}
    </div>
  );
}

/* Президент глазами ведомства: чей он характер, чего требует прямо сейчас, и
   насколько администрация вами довольна. Последнее — не косметика: из нуля
   довольства вырастает отставка, и полоса должна быть видна заранее, а не
   объявляться постфактум вместе с увольнением. */
/* Чем кончилось прошлое требование, одним словом. Доля выполнения может прийти
   и булевой (старые сохранения), и дробной, и вовсе отсутствовать; у указания
   боту вместо неё — ответ ведомства. */
const lastDirectiveWord = (last) => {
  if (last.status) {
    return last.status === 'accepted' ? 'исполнено' : last.status === 'partial' ? 'исполнено частично' : 'отклонено';
  }
  const raw = last.directiveMet;
  const p = raw === true ? 1 : raw === false ? 0 : Number.isFinite(raw) ? raw : null;
  const verdict = directiveVerdict(p);
  return verdict === 'met' ? 'выполнено' : verdict === 'partial' ? 'выполнено частично'
    : verdict === 'ignored' ? 'проигнорировано' : 'передано ведомству';
};

export function PresidentWatchPanel({ economy, plan, last, branch }) {
  if (!plan) return null;
  const P = plan.persona;
  const sat = clamp(Number.isFinite(economy.presidentSatisfaction) ? economy.presidentSatisfaction : 60, 0, 100);
  const satColor = sat >= 55 ? COLOR.teal : sat >= 25 ? COLOR.gold : COLOR.rust;
  const dir = plan.directive;
  const mine = dir && dir.toPlayer;
  return (
    <div className="ems-panel" style={{ padding: 13, borderColor: sat < 25 ? COLOR.rust : COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <Crown size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Президент</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={11} />бот</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 7 }}>
        <b style={{ color: COLOR.text }}>{P.name}</b> · {P.title}
      </div>
      {/* его капитал виден и вам: и требование, и указ, и реформа стоят денег,
          а без счётчика казалось, что президент тратит из воздуха */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLOR.muted, marginBottom: 6 }}>
        <span>Политический капитал</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${clamp(economy.politicalCapital || 0, 0, 100)}%`, height: '100%', background: COLOR.gold }} />
        </span>
        <span className="ems-mono" style={{ color: COLOR.goldSoft }}>{Math.floor((economy.politicalCapital || 0) + 1e-9)}</span>
      </div>
      {/* у трейдера президента не за что увольнять — «отношение к вам» там не про что */}
      {branch && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLOR.muted, marginBottom: 8 }}>
        <span>Отношение к вам</span>
        <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${sat}%`, height: '100%', background: satColor }} />
        </span>
        <span className="ems-mono" style={{ color: satColor }}>{plan.mood}</span>
      </div>
      )}
      {dir ? (
        <div style={{ fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${mine ? COLOR.rust : COLOR.blue}`, paddingLeft: 9, color: COLOR.text }}>
          <span style={{ color: mine ? COLOR.rust : COLOR.blue, fontWeight: 600 }}>
            {mine ? 'Требование к вам: ' : `Указание ${dir.branch === 'monetary' ? 'ЦБ' : 'Минфину'}: `}
          </span>
          {dir.ask || askText(dir.req, 1, 'president', economy.politicalRegime)}
          {mine && (
            <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 4 }}>
              Выполнить — значит сдвинуть свои ползунки в эту сторону в этом квартале. Отказ никто не запрещает,
              но администрация его запомнит.
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.45, color: COLOR.muted, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9 }}>
          В этом квартале требований нет.
        </div>
      )}
      {last && !!(last.label || (last.actions || []).length) && (
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 8, lineHeight: 1.45 }}>
          В прошлый раз: {last.label
            ? `${last.toPlayer ? 'требование' : 'указание'} «${last.label}» — ${lastDirectiveWord(last)}`
            : 'без требований'}
          {last.actions && last.actions.length ? `; сам занялся: ${last.actions.join(', ').toLowerCase()}` : ''}.
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9, color: COLOR.muted }}>
        «{plan.quote}»
      </div>
      {branch && sat < 25 && (
        <div style={{ marginTop: 8, fontSize: 12, color: COLOR.rust, lineHeight: 1.45 }}>
          Администрация всерьёз рассматривает вопрос о вашей отставке. Выполненное требование поднимает
          отношение заметно быстрее, чем хорошие цифры{branch === 'monetary' ? ' по инфляции' : ' по бюджету'}.
        </div>
      )}
    </div>
  );
}

/* ============================ ПРЕЗИДЕНТ ============================
   У президента нет ни одного ползунка: вместо непрерывных величин — набор
   дискретных решений, каждое со своей ценой в политическом капитале. Панель
   поэтому устроена не как список слайдеров, а как ведомость: сколько капитала
   есть, сколько уже забронировано выбранными на этот квартал решениями и
   сколько останется. Пока квартал не завершён, любое решение можно снять. */
const PRES_GROUP_ICON = { public: Megaphone, reform: Hammer, power: Gavel, war: ShieldAlert, diplomacy: Globe2 };

const PRES_TABS = [
  { id: 'public', label: 'Указы' },
  { id: 'reform', label: 'Реформы' },
  // война — отдельная вкладка: это единственный рычаг президента, который меняет
  // не проценты, а саму рамку, в которой считают все остальные
  { id: 'war', label: 'Война' },
  { id: 'staff', label: 'Кадры' },
  { id: 'directive', label: 'Указания' },
];

function CapitalBar({ value, reserved, gain }) {
  const v = clamp(value, 0, 100);
  const res = clamp(reserved, 0, v);
  const left = v - res;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        {/* вниз, а не до ближайшего: капитал дробный, и «26 свободно» при 25,6 обещало
            решение за 26, которое на деле недоступно */}
        <span className="ems-mono" style={{ fontSize: 25, color: COLOR.gold, fontWeight: 600, lineHeight: 1 }}>{Math.floor(left + 1e-9)}</span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>из {Math.floor(v + 1e-9)} свободно</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: gain >= 0 ? COLOR.teal : COLOR.rust }}>
          {gain >= 0 ? '+' : ''}{fmt1(gain)} за квартал
        </span>
      </div>
      <div style={{ display: 'flex', height: 7, borderRadius: 3, overflow: 'hidden', background: COLOR.border }}>
        <span style={{ width: `${left}%`, background: COLOR.gold }} />
        <span style={{ width: `${res}%`, background: COLOR.goldDim, borderLeft: res > 0 ? `1px solid ${COLOR.gold}` : 'none' }} />
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 4, lineHeight: 1.4 }}>
        {res > 0
          ? `${Math.round(res)} забронировано решениями этого квартала — списание произойдёт при завершении квартала.`
          : 'Копится рейтингом и ростом, тает в кризисах. Без него ни одно решение президента не проходит.'}
      </div>
    </div>
  );
}

/* Лестница режимов: где вы сейчас и что нужно, чтобы шагнуть выше или вернуться
   вниз. Без этой строки путь к авторитаризму и тем более к тоталитаризму был
   чистой догадкой — пороги живут в движке, а игрок видел только результат. */
function RegimeLadder({ economy }) {
  const regime = economy.politicalRegime || 'democracy';
  const tension = Math.round(economy.politicalTension || 0);
  const info = POLITICAL_REGIME_INFO[regime] || {};
  const next = regime === 'democracy'
    ? { label: 'конфликт ветвей власти', need: 'напряжённость ≥ 62', at: 62 }
    : regime === 'crisis'
      ? { label: 'авторитарный режим', need: 'напряжённость ≥ 70 (или указ о роспуске парламента)', at: 70 }
      : regime === 'authoritarian'
        ? { label: 'тоталитарный режим', need: 'указ «Полный контроль над институтами» во время войны или напряжённость ≥ 80', at: 80 }
        : null;
  const bar = clamp(tension, 0, 100);
  return (
    <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${COLOR.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: COLOR.muted }}>Режим</span>
        {/* ярлыки авторитаризма и тоталитаризма сами заканчиваются на «режим»
            («Авторитарный режим») — рядом с меткой поля получалась тавтология
            «Режим: Авторитарный режим» */}
        <span style={{ color: COLOR.text }}>{(info.label || regime).replace(/\s*режим$/i, '')}</span>
        <span className="ems-mono" style={{ marginLeft: 'auto', color: tension >= 62 ? COLOR.rust : tension >= 40 ? COLOR.gold : COLOR.teal }}>
          напряжённость {tension}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${bar}%`, height: '100%',
          background: tension >= 62 ? COLOR.rust : tension >= 40 ? COLOR.gold : COLOR.teal }} />
        {next && <span style={{ position: 'absolute', left: `${next.at}%`, top: -2, width: 2, height: 8, background: COLOR.goldSoft }} />}
      </div>
      {(regime === 'authoritarian' || regime === 'totalitarian') && (() => {
        /* Риск, о котором нельзя узнать заранее, — это лотерея, а не механика.
           Показываем его прямо: чем выше напряжение, безработица, инфляция и чем
           меньше политического капитала, тем ближе армия. Пока он пренебрежимо
           мал, строка только шумит — ноль полезной информации при каждом взгляде
           на панель, — поэтому ниже 1% в квартал её просто нет. */
        const risk = militaryCoupRisk(economy);
        // словом и числом — по одной и той же величине: «низкий · 3%» рядом с
        // порогом в 3% читался бы как ошибка
        const pct = Math.round(risk * 1000) / 10;
        if (pct < 1) return null;
        const color = pct >= 8 ? COLOR.rust : COLOR.gold;
        return (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 12, marginTop: 6 }}>
            <span style={{ color: COLOR.muted }}>Риск военного переворота</span>
            <span style={{ marginLeft: 'auto', color }} className="ems-mono">
              {pct >= 8 ? 'высокий' : 'заметный'} · {pct}% за квартал
            </span>
          </div>
        );
      })()}
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 5, lineHeight: 1.45 }}>
        {next
          ? <>Следующая ступень — <b style={{ color: COLOR.muted }}>{next.label}</b>: {next.need}. Напряжённость растёт от низкого рейтинга, кризисов, безработицы и инфляции.</>
          : 'Дальше по этой лестнице идти некуда: выборов нет, голосованием власть не сменить. Остаётся армия — чем выше напряжённость, безработица и инфляция, тем вероятнее переворот. Спуститься можно только так или вернуть парламент по своей воле.'}
      </div>
    </div>
  );
}

/* Кто выиграет и кто проиграет от решения — группы общества (см. «Общество»):
   они запомнят его на несколько лет. */
function GroupStakes({ effects }) {
  const name = (id) => (SOCIAL_GROUPS.find((g) => g.id === id) || {}).name || id;
  const pro = Object.entries(effects).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const con = Object.entries(effects).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  if (!pro.length && !con.length) return null;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
      {pro.length > 0 && <span style={{ color: COLOR.teal }}>За: {pro.map(([id, v]) => `${name(id).toLowerCase()} +${v}`).join(', ')}</span>}
      {pro.length > 0 && con.length > 0 && <span style={{ color: COLOR.faint }}> · </span>}
      {con.length > 0 && <span style={{ color: COLOR.rust }}>Против: {con.map(([id, v]) => `${name(id).toLowerCase()} −${-v}`).join(', ')}</span>}
    </div>
  );
}

function PresActionCard({ action, economy, cooldowns, selected, affordable, onToggle }) {
  // у выбранного решения его цена уже вычтена из свободного капитала — проверять
  // «хватает ли» по остатку без него значит объявлять нехватку на ровном месте
  const canAfford = selected || affordable;
  const label = typeof action.label === 'function' ? action.label(economy) : action.label;
  const desc = typeof action.desc === 'function' ? action.desc(economy) : action.desc;
  const cdLeft = cooldowns[`pres:${action.id}`] || 0;
  const done = action.once && (economy.reforms || {})[action.id] !== undefined;
  const blockedByReq = !!(action.requires && !action.requires(economy));
  const disabled = done || cdLeft > 0 || blockedByReq || !canAfford;
  const share = done ? reformShare(economy.reforms, action.id) : 0;
  const why = done ? (REFORM_RAMP[action.id]
    ? `Проведена · внедрена на ${Math.round(share * 100)}%`
    : 'Уже проведена')
    : cdLeft > 0 ? `Повторно через ${cdLeft} кв.`
      : blockedByReq ? (action.reqText || 'Сейчас недоступно')
        : !canAfford ? 'Не хватает капитала' : null;
  // реформа — это законопроект, а не указ: пока парламент жив, при таком
  // напряжении или таком провальном рейтинге он гарантированно его отклонит,
  // и капитал уйдёт на лоббирование впустую, без всякого эффекта
  const willBeBlocked = action.group === 'reform' && !done && parliamentBlocksReform(economy);
  // необратимые решения (война, роспуск парламента, тоталитарный контроль)
  // получают ржавый акцент вместо обычного золотого — интерфейс сам должен
  // сигналить о разнице в весе решения, а не полагаться на то, что игрок
  // дочитает описание до конца
  const severe = !!action.severe && !done;
  // недоступное решение не расписывает, что оно дало бы: причина и цена важнее
  const hideDesc = blockedByReq || cdLeft > 0 || done || !canAfford;
  const selectedColor = severe ? COLOR.rust : COLOR.gold;
  const selectedDim = severe ? COLOR.rustDim : COLOR.goldDim;
  return (
    <div className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) { Audio.play('tick'); onToggle(); } }}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(); } }}
      style={{ padding: '9px 11px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 6,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled && !selected ? 0.5 : 1,
        borderColor: selected ? selectedColor : severe ? COLOR.rustDim : COLOR.border,
        background: selected ? selectedDim : COLOR.panelAlt }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {/* необратимое решение скрепляется печатью вместо обычной галочки —
            тот же оттиск, что и в переходе между кварталами, только маленький
            и постоянный: не мигает и не тает, отмечает решение до конца партии */}
        {selected && severe && <StateSeal regime={economy.politicalRegime} size={14} title="Скреплено печатью" />}
        {selected && !severe && <Check size={12} color={selectedColor} style={{ alignSelf: 'center', flexShrink: 0 }} />}
        {!selected && severe && !blockedByReq && <AlertTriangle size={12} color={COLOR.rust} style={{ alignSelf: 'center', flexShrink: 0 }} />}
        <span style={{ fontSize: 13, color: selected ? (severe ? COLOR.rust : COLOR.goldSoft) : COLOR.text, fontWeight: 600, flex: 1 }}>{label}</span>
        <span className="ems-mono" style={{ fontSize: 12, color: selected ? (severe ? COLOR.rust : COLOR.goldSoft) : COLOR.muted, flexShrink: 0 }}>{action.cost} ПК</span>
      </div>
      {severe && !blockedByReq && (
        <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 3, fontWeight: 600 }}>Необратимое решение</div>
      )}
      {/* Решение, которое сейчас взять нельзя — заперто условием, стоит на
          перезарядке или уже проведено, — показывает только причину: абзац
          описания в этом случае лишь растягивает список вниз. Исключение —
          «не хватает капитала»: на такое решение копят, и чтобы копить
          осознанно, надо знать, на что именно. */}
      {!hideDesc && <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45, marginTop: 4 }}>{desc}</div>}
      {!hideDesc && ACTION_GROUP_EFFECTS[action.id] && <GroupStakes effects={ACTION_GROUP_EFFECTS[action.id]} />}
      {!hideDesc && willBeBlocked && (
        <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 3 }}>
          Парламент отклонит: слишком высокое напряжение или провальный рейтинг. Капитал спишется впустую.
        </div>
      )}
      {done && REFORM_RAMP[action.id] && (
        <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${share * 100}%`, height: '100%', background: COLOR.teal }} />
        </div>
      )}
      {why && <div style={{ fontSize: 12, color: done ? COLOR.teal : COLOR.faint, marginTop: 4 }}>{why}</div>}
    </div>
  );
}

export function PresidentPanel({ economy, cooldowns, selected, setSelected, cbPersonaId, mofPersonaId,
  appointCb, setAppointCb, appointMof, setAppointMof, directive, setDirective, lastDirective,
  directiveStrength, setDirectiveStrength }) {
  const [tab, setTab] = useState('public');
  const capital = Number.isFinite(economy.politicalCapital) ? economy.politicalCapital : 55;
  const reserved = selected.reduce((sum, id) => sum + ((PRES_BY_ID[id] || {}).cost || 0), 0)
    + (appointCb ? APPOINT_COST.central_bank : 0) + (appointMof ? APPOINT_COST.ministry_finance : 0)
    + (directive ? PRES_DIRECTIVE_COST : 0);
  const free = capital - reserved;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const groupActions = (g) => PRESIDENT_ACTIONS.filter((a) => a.group === g);
  const cbP = getCbPersona(cbPersonaId); const mofP = getMofPersona(mofPersonaId);

  const staffBlock = (kind, list, current, pending, setPending, tenure) => {
    const cost = APPOINT_COST[kind];
    const canPay = free + (pending ? cost : 0) >= cost;
    const early = kind === 'central_bank' && tenure < CB_FULL_TERM;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
          <span className="ems-serif" style={{ fontSize: 13, color: COLOR.blue }}>
            {kind === 'central_bank' ? 'Глава Центрального банка' : 'Министр финансов'}
          </span>
          <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint }}>{cost} ПК за смену</span>
        </div>
        <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 6, lineHeight: 1.45 }}>
          Действующий — <b style={{ color: COLOR.text }}>{current.name}</b>, {tenure} кв. в должности.
          {kind === 'central_bank' && (early
            ? ` Полный срок — ${CB_FULL_TERM} кв.: досрочная отставка обойдётся доверием к ЦБ и премией за риск тем дороже, чем раньше она случится.`
            : ' Срок отработан полностью — смена будет выглядеть плановой.')}
        </div>
        {list.map((p) => {
          const isCur = p.id === current.id;
          const isPending = pending === p.id;
          const disabled = isCur || (!isPending && !canPay);
          // досрочная отставка главы ЦБ — необратимое и дорогое по доверию
          // решение, а не рутинная кадровая рокировка: тот же ржавый акцент,
          // что и у severe-указов президента, вместо обычного золотого
          const pendingColor = isPending && early ? COLOR.rust : COLOR.gold;
          const pendingDim = isPending && early ? COLOR.rustDim : COLOR.goldDim;
          return (
            <div key={p.id} className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
              onClick={() => { if (!disabled) { Audio.play('tick'); setPending(isPending ? null : p.id); } }}
              onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setPending(isPending ? null : p.id); } }}
              style={{ padding: '7px 10px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 5,
                cursor: disabled ? 'default' : 'pointer', opacity: disabled && !isCur ? 0.5 : 1,
                borderColor: isPending ? pendingColor : isCur ? COLOR.blue : COLOR.border,
                background: isPending ? pendingDim : isCur ? COLOR.blueDim : COLOR.panelAlt }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: isPending ? (early ? COLOR.rust : COLOR.goldSoft) : COLOR.text }}>{p.name}</span>
                {/* должность режем в одну строку: иначе она переносится и утаскивает
                    вниз метку «действующий», разрывая строку карточки надвое */}
                <span style={{ fontSize: 12, color: COLOR.faint, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                {isCur && <span style={{ fontSize: 12, color: COLOR.blue, flexShrink: 0 }}>действующий</span>}
                {isPending && <span style={{ fontSize: 12, color: pendingColor, flexShrink: 0 }}>{early ? 'досрочная отставка' : 'назначить'}</span>}
              </div>
              <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.4, marginTop: 3 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const directiveList = (toCb) => REQUESTS.filter((r) => !r.retired && (r.from === 'ministry_finance') === toCb);
  const canDirective = free + (directive ? PRES_DIRECTIVE_COST : 0) >= PRES_DIRECTIVE_COST;

  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Crown size={14} />Политический капитал
      </div>
      <CapitalBar value={capital} reserved={reserved} gain={economy.politicalCapitalGain || 0} />
      <RegimeLadder economy={economy} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '12px 0 10px' }}>
        {PRES_TABS.map((t) => (
          <button type="button" key={t.id} className={`ems-tab ${tab === t.id ? 'active' : ''}`} aria-pressed={tab === t.id} style={{ fontSize: 12, padding: '4px 9px' }}
            onClick={() => { Audio.play('tab'); setTab(t.id); }}>{t.label}</button>
        ))}
      </div>

      {tab === 'public' && (
        <div>
          {['public', 'diplomacy', 'power'].map((g) => {
            const Icon = PRES_GROUP_ICON[g];
            return (
              <React.Fragment key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLOR.faint,
                  letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 6px' }}>
                  <Icon size={11} />{PRES_GROUP_LABEL[g]}
                </div>
                {groupActions(g).map((a) => (
                  <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
                    selected={selected.includes(a.id)} affordable={free >= a.cost} onToggle={() => toggle(a.id)} />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {tab === 'war' && (
        <div>
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Война — не рычаг экономики, а смена рамки: рейтинг первые кварталы растёт на сплочении,
            чрезвычайные полномочия становятся доступны, газеты меняют язык. Платят за это торговля,
            инвестиции, капитал и люди — и платят дольше, чем идёт сама война.
          </div>
          {/* войну объявляют только на карте — из карточки страны, которой её объявляют */}
          {!((economy.warQuartersLeft || 0) > 0) && (
            <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.45, marginBottom: 9, padding: '8px 10px', border: `1px dashed ${COLOR.rust}`, borderRadius: 4 }}>
              Объявить войну можно на вкладке «Карта»: выберите страну — Норланд, Вестравию или Дешт — и нажмите «Объявить войну» в её карточке.
            </div>
          )}
          {PRESIDENT_ACTIONS.filter((a) => a.group === 'war' && a.id !== 'war_start').map((a) => (
            <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
              selected={selected.includes(a.id)} affordable={free >= a.cost}
              onToggle={() => toggle(a.id)} />
          ))}
        </div>
      )}

      {tab === 'reform' && (
        <div>
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
            Реформы не действуют в квартале объявления: каждая разворачивается годами, а платить рейтингом
            приходится сразу. Это единственные решения в игре, которые двигают потенциальный ВВП, а не спрос.
          </div>
          {groupActions('reform').map((a) => (
            <PresActionCard key={a.id} action={a} economy={economy} cooldowns={cooldowns}
              selected={selected.includes(a.id)} affordable={free >= a.cost} onToggle={() => toggle(a.id)} />
          ))}
        </div>
      )}

      {tab === 'staff' && (
        <div>
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Вы не задаёте ставку и бюджет — вы выбираете тех, кто их задаёт. Характер руководителя определяет
            политику ведомства на годы вперёд, поэтому назначение работает медленнее указа, но действует дольше.
          </div>
          {staffBlock('central_bank', CB_PERSONAS, cbP, appointCb, setAppointCb, economy.cbTenure || 0)}
          {staffBlock('ministry_finance', MOF_PERSONAS, mofP, appointMof, setAppointMof, economy.mofTenure || 0)}
        </div>
      )}

      {tab === 'directive' && (
        <div>
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 9 }}>
            Одно указание за квартал, {PRES_DIRECTIVE_COST} ПК. Ведомство может и отказать: шанс зависит от того,
            насколько просьба соответствует ситуации, от характера руководителя и от политического режима — чем
            меньше в стране институтов, тем меньше у ведомства возможности сказать «нет».
            {' '}Выполненное указание ЦБ стоит доверия к нему: управляемый центральный банк рынок оценивает дешевле.
          </div>
          {[[true, 'Центральному банку'], [false, 'Минфину']].map(([toCb, title]) => (
            <React.Fragment key={title}>
              <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 6px' }}>{title}</div>
              {directiveList(toCb).map((r) => {
                const isSel = directive === r.id;
                const disabled = !isSel && !canDirective;
                return (
                  <div key={r.id} className="ems-card-btn" role="button" tabIndex={disabled ? -1 : 0}
                    onClick={() => { if (!disabled) { Audio.play('tick'); setDirective(isSel ? null : r.id); } }}
                    onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDirective(isSel ? null : r.id); } }}
                    style={{ padding: '7px 10px', flexDirection: 'column', alignItems: 'stretch', gap: 0, marginBottom: 5,
                      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
                      borderColor: isSel ? COLOR.gold : COLOR.border, background: isSel ? COLOR.goldDim : COLOR.panelAlt }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      {isSel && <Check size={11} color={COLOR.gold} />}
                      <span style={{ fontSize: 12, color: isSel ? COLOR.goldSoft : COLOR.text }}>{r.label}</span>
                    </div>
                    {isSel && <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.4, marginTop: 4 }}>«{askText(r, r.scale ? (directiveStrength || 1) : 1, 'president', economy.politicalRegime)}»</div>}
                    {/* «снизить ставку» без указания насколько — это не указание:
                        один пункт для ставки очень много, и просить можно меньше */}
                    {isSel && r.scale && (
                      <div style={{ marginTop: 7 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: COLOR.muted }}>Насколько</span>
                          <span className="ems-mono" style={{ color: COLOR.goldSoft }}>
                            {fmt2(r.scale.base * (directiveStrength || 1))}{r.scale.unit}
                          </span>
                        </div>
                        <input type="range" className="ems-slider"
                          min={r.scale.min / r.scale.base} max={r.scale.max / r.scale.base}
                          step={r.scale.step / r.scale.base} value={directiveStrength || 1}
                          onChange={(e) => { Audio.play('tick'); setDirectiveStrength(Number(e.target.value)); }} />
                        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 3, lineHeight: 1.4 }}>
                          Чем больше просите, тем охотнее ведомство откажет.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {lastDirective && (
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, paddingLeft: 9,
              borderLeft: `2px solid ${lastDirective.status === 'rejected' ? COLOR.rust : lastDirective.status === 'partial' ? COLOR.gold : COLOR.teal}`,
              color: COLOR.muted }}>
              <span style={{ color: COLOR.faint }}>Ответ на прошлое указание: </span>{lastDirective.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// формат текущего/целевого значения под конкретное обещание — target/value это
// голые числа (см. pickPromises/evaluatePromise в engine.js), единицы тут же рядом с текстом
const PROMISE_FMT = {
  inflation_tame: (v) => `${fmt1(v)}%`, jobs_for_all: (v) => `${fmt1(v)}%`,
  debt_discipline: (v) => `${fmt1(v)}%`, growth_promise: (v) => `${fmtSigned1(v)}%`,
  strong_currency: (v) => `${fmtSigned1(v)}%`, budget_control: (v) => `${fmt1(v)}%`,
  living_standards_promise: (v) => fmt1(v), reserves_promise: (v) => fmtMoney(v),
};

/* У премьер-министра и президента нет бота-оппонента с требованиями — три случайных
   обещания на срок до выборов создают то же ощутимое давление, что остальным
   ролям даёт партнёр по власти. met/value считаются на лету от текущей
   экономики (evaluatePromise), а не хранятся — иначе они бы не обновлялись
   при откате/загрузке сохранения. */
export function PromisesPanel({ promises, economy }) {
  if (!promises || !promises.length) return null;
  /* Выборов нет — нет и предвыборных обещаний: при тоталитаризме панель висела
     со счётчиком «до выборов», которых не будет, и с итогом, который никто
     никогда не подведёт. Одна строка вместо неё честнее. */
  if (economy.noElections) {
    return (
      <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <Flag size={14} color={COLOR.faint} />
          <span className="ems-serif" style={{ fontSize: 14, color: COLOR.muted }}>Предвыборные обещания</span>
        </div>
        <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45 }}>
          Выборы отменены — обещания больше не подводятся. Власть удерживают не у урны.
        </div>
      </div>
    );
  }
  const kept = promises.filter((p) => evaluatePromise(p, economy).met).length;
  return (
    <Fold id="promises" title="Предвыборные обещания" icon={Flag}
      summary={`выполняется ${kept} из ${promises.length} · до выборов ${economy.quartersToElection} кв.`}>
    <div className="ems-panel" style={{ padding: 13, borderColor: COLOR.borderStrong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <Flag size={14} color={COLOR.blue} />
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.blue }}>Предвыборные обещания</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.faint }}>
          {economy.noElections ? 'выборы отменены' : `до выборов ${economy.quartersToElection} кв.`}</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
        Каждое сдержанное обещание добавляет около 2 п.п. голосов на выборах, каждое проваленное — столько же отнимает.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {promises.map((p) => {
          const { met, value, direction } = evaluatePromise(p, economy);
          const fmtFn = PROMISE_FMT[p.id] || fmt1;
          const color = met ? COLOR.teal : COLOR.rust;
          return (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {met ? <Check size={13} color={color} style={{ marginTop: 2, flexShrink: 0 }} /> : <AlertTriangle size={13} color={color} style={{ marginTop: 2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: met ? COLOR.text : COLOR.muted }}>{p.label}</span>
                  {/* «36.2% / 35.3%» без подписей читалось наоборот: игрок
                      принимал вторую цифру за текущую и не понимал, почему
                      обещание провалено. Теперь видно, где факт, а где порог,
                      и в какую сторону он должен выполняться */}
                  <span className="ems-mono" style={{ fontSize: 12, color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    сейчас {fmtFn(value)} · надо {direction === 'above' ? '≥' : '≤'} {fmtFn(p.target)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLOR.faint }}>{p.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </Fold>
  );
}

export function Segmented({ options, value, onChange, label, hint }) {
  const cur = options.find((o) => o.id === value);
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '11px 0' }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => (
          <button key={o.id} className="ems-btn" onClick={() => { Audio.play('click'); onChange(o.id); }}
            style={{ flex: 1, padding: '5px 6px', fontSize: 12, background: value === o.id ? COLOR.sel : COLOR.panelAlt, color: value === o.id ? COLOR.selText : COLOR.text, borderColor: value === o.id ? COLOR.selBorder : COLOR.border }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>{cur ? cur.hint : hint}</div>
    </div>
  );
}

function makeSnapshot(state) {
  // в истории не храним разложение налоговой базы — оно пересчитывается и раздувает файл
  const slim = (state.history || []).map((h) => { const { revenueParts: _revenueParts, ...rest } = h; return rest; });
  return { app: 'economic-panel', v: SAVE_VERSION, savedAt: new Date().toISOString(), ...state, history: slim };
}

const saveAutosave = (data) => { try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data)); } catch { /* квота или приватный режим — просто не автосохраняем */ } };

// «Газета сама открывается» — настройка на устройство, а не на партию: игрок,
// которому нравится читать сводку каждый квартал, хочет этого во всех своих играх.
const AUTO_PAPER_KEY = 'ems-auto-paper';

export const loadAutoPaper = () => { try { return localStorage.getItem(AUTO_PAPER_KEY) === '1'; } catch { return false; } };

export const saveAutoPaper = (v) => { try { localStorage.setItem(AUTO_PAPER_KEY, v ? '1' : '0'); } catch { /* ignore */ } };

const ALL_ROLE_IDS = ['central_bank', 'ministry_finance', 'full_control', 'president', 'trader'];

const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const markNetworkPlayed = () => { try { localStorage.setItem(NETWORK_PLAYED_KEY, '1'); } catch { /* приватный режим */ } };

export const recordRolePlayed = (role) => {
  const arr = loadRolesPlayed();
  if (!role || arr.includes(role)) return arr;
  const next = [...arr, role];
  try { localStorage.setItem(ROLES_PLAYED_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
  return next;
};

// помечает переданные id разблокированными (если ещё не были) и возвращает
// только реально НОВЫЕ разблокировки — этот список идёт в тост
export function unlockAchievements(ids) {
  if (!ids || !ids.length) return [];
  const cur = loadUnlockedAchievements();
  const fresh = [];
  ids.forEach((id) => { if (!cur[id] && ACH_BY_ID[id]) { cur[id] = Date.now(); fresh.push(ACH_BY_ID[id]); } });
  if (fresh.length) { try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(cur)); } catch { /* приватный режим */ } }
  return fresh;
}

// сколько кварталов подряд (считая с конца истории) инфляция была в пределах ±0.5 п.п. от цели
function inflationOnTargetStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.inflation == null || h.inflationTarget == null) break;
    if (Math.abs(h.inflation - h.inflationTarget) <= 0.5) streak++; else break;
  }
  return streak;
}

// кризисный режим был активен где-то в истории партии, а сейчас — нет
function survivedCrisis(history) {
  if (!history || history.length < 2) return false;
  const last = history[history.length - 1];
  if ((last.activeCrises || []).length > 0) return false;
  return history.slice(0, -1).some((h) => (h.activeCrises || []).length > 0);
}

export function questProgressAchievementIds({ quarterIndex, economy, history, rolesPlayed, networkPlayed, lastEvents, role, presActionsThisQuarter, isPublicRoom }) {
  const ids = [];
  if (quarterIndex >= 1) ids.push('first_quarter');
  if (quarterIndex >= 20) ids.push('survivor_20');
  if (quarterIndex >= 40) ids.push('survivor_40');
  if (role === 'central_bank' && inflationOnTargetStreak(history) >= 8) ids.push('inflation_target');
  if (history && history.length > 1 && history[0].gdp > 0 && economy.gdp >= history[0].gdp * 2) ids.push('gdp_double');
  if (economy.unemployment < 4) ids.push('low_unemployment');
  if (role === 'ministry_finance' && economy.debtToGdp < 35) ids.push('debt_control');
  if (role === 'ministry_finance' && economy.imfActive) ids.push('imf_bailout');
  if (survivedCrisis(history)) ids.push('survived_crisis');
  if (economy.stabilizationWon) ids.push('prices_stopped');
  // мандат спасения задаёт только сценарий «Гиперинфляция» — по нему и узнаём
  // сценарий, не протаскивая его отдельным полем через все экраны
  const unfree = (h) => h.politicalRegime === 'authoritarian' || h.politicalRegime === 'totalitarian';
  if (quarterIndex >= 16 && (economy.crisisMandateTotal || 0) > 0 && !unfree(economy)
    && (history || []).every((h) => !unfree(h))) ids.push('hardest_way_out');
  if (economy.electionResult === 'incumbent') ids.push('won_election');
  if (rolesPlayed && ALL_ROLE_IDS.every((r) => rolesPlayed.includes(r))) ids.push('all_roles');
  if (networkPlayed) ids.push('network_played');
  if (isPublicRoom) ids.push('public_room_played');
  if ((lastEvents || []).some((e) => e.kind === 'call')) ids.push('margin_call');
  if (role === 'president') {
    if ((presActionsThisQuarter || []).includes('sanctions_impose')) ids.push('diplomacy_sanctions');
    if ((presActionsThisQuarter || []).includes('trade_bloc')) ids.push('trade_bloc_join');
    // объявить реформу — не то же самое, что провести её: у судебной или
    // пенсионной реформы эффект разворачивается 8-12 кварталов, и указ,
    // подписанный минуту назад, до сих пор не изменил в стране ничего
    const completedReforms = Object.keys(economy.reforms || {})
      .filter((id) => reformShare(economy.reforms, id) >= 1).length;
    if (completedReforms >= 3) ids.push('reformer');
    if (economy.politicalRegime === 'totalitarian') ids.push('iron_president');
  }
  return ids;
}

export function casinoAchievementIds({ net, casinoNet }) {
  const ids = [];
  if (net > 0) ids.push('casino_win');
  if (net >= 30) ids.push('casino_jackpot');
  if (casinoNet >= 50) ids.push('casino_ahead');
  return ids;
}

// очередь тостов «достижение открыто» — общая для соло- и сетевого экрана
export function useAchievementToasts() {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const queueRef = React.useRef([]);
  const showingRef = React.useRef(false);
  const showTimerRef = React.useRef(null);
  const leaveTimerRef = React.useRef(null);
  const advance = React.useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      showingRef.current = true;
      setToast(next); setLeaving(false);
      Audio.play('coin');
      showTimerRef.current = setTimeout(() => {
        setLeaving(true);
        leaveTimerRef.current = setTimeout(advance, 450); // время на анимацию исчезновения
      }, 3800);
    } else {
      showingRef.current = false;
      setToast(null); setLeaving(false);
    }
  }, []);
  React.useEffect(() => () => { clearTimeout(showTimerRef.current); clearTimeout(leaveTimerRef.current); }, []);
  const push = React.useCallback((list) => {
    if (!list || !list.length) return;
    queueRef.current.push(...list);
    if (!showingRef.current) advance();
  }, [advance]);
  return { toast, leaving, push };
}

// Конфетти — фиксированный набор мелких прямоугольников с разлётом наружу через
// CSS-переменные; пересоздаётся только когда меняется само достижение (по toast.id),
// а не на каждый ре-рендер, иначе разлёт «дёргался» бы при любом обновлении родителя.
const CONFETTI_COLORS = ['#C9A227', '#E8C766', '#4E9A82', '#B0503A', '#5B7FA6', '#EDE7D6'];

function useConfettiPieces(seed, count = 26) {
  return React.useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 40 + Math.random() * 58;
    return {
      key: i,
      dx: `${(Math.cos(angle) * dist).toFixed(1)}px`,
      dy: `${(Math.sin(angle) * dist - 14 - Math.random() * 18).toFixed(1)}px`,
      rot: `${Math.round((Math.random() - 0.5) * 520)}deg`,
      delay: `${(Math.random() * 0.12).toFixed(2)}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 5 + Math.round(Math.random() * 4),
      h: 8 + Math.round(Math.random() * 6),
    };
  }), [seed, count]);
}

export const AchievementToast = ({ toast, leaving }) => {
  const pieces = useConfettiPieces(toast ? toast.id : null);
  if (!toast) return null;
  const ToastIcon = toast.icon;
  return (
    <div className={`ems-panel-raised ${leaving ? 'ems-toast-out' : 'ems-fade-in'}`} style={{ position: 'fixed', bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', right: 18, zIndex: 90, maxWidth: 'min(350px, calc(100vw - 36px))',
      padding: '13px 17px', display: 'flex', alignItems: 'center', gap: 12, borderColor: COLOR.gold, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', overflow: 'visible' }}>
      <span style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <ToastIcon size={26} color={COLOR.gold} />
        {!leaving && pieces.map((p) => (
          <span key={p.key} className="ems-confetti-piece" style={{
            position: 'absolute', top: '50%', left: '50%', width: p.w, height: p.h, background: p.color,
            '--dx': p.dx, '--dy': p.dy, '--rot': p.rot, animationDelay: p.delay,
          }} />
        ))}
      </span>
      <div>
        <div style={{ fontSize: 12, color: COLOR.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Достижение открыто</div>
        <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginTop: 2 }}>{toast.title}</div>
      </div>
    </div>
  );
};

/* Условия поражения. Без них достижения «Ветеран»/«Долгожитель» ничего не
   значат — партию нельзя не пройти, значит нечем гордиться, продержавшись.
   Гиперинфляция касается любой роли (страна одна на всех); поражение на
   выборах — только тех, кто реально отвечает перед избирателем; банкротство —
   только трейдера, который вне политики. Порог ЦБ (только при landslide) и
   Минфина (при любом исходе) намеренно разный: так же асимметрично уже
   работает смена персон бота после выборов в finishQuarter — независимость
   центробанка переживает обычное поражение партии власти, а министерский
   портфель нет. */
export function checkDefeat({ role, economy, history, bookVal, presidentActive }) {
  // трейдер — не власть: гиперинфляция, переворот и выборы его не снимают с должности
  const privateRole = role === 'trader';
  // гиперинфляция — провал денежной/бюджетной политики; трейдер её не проводит и
  // повлиять на неё не может, так что и мандата за неё лишаться ему не за что
  if (!privateRole && history && history.length >= 4) {
    const last4 = history.slice(-4);
    if (last4.every((h) => h.inflation != null && h.inflation >= 40)) {
      return { id: 'hyperinflation', title: 'Гиперинфляционный коллапс',
        text: `Инфляция держится выше 40% четыре квартала подряд (сейчас ${fmt1(economy.inflation)}%). Деньги теряют смысл быстрее, чем правительство успевает отреагировать — экономика срывается в неуправляемую спираль, а вместе с ней и ваш мандат.` };
    }
  }
  /* Импичмент — поражение, доступное только президенту: у него нет ползунков,
     которыми можно было бы отыграться, зато есть политический капитал. Когда он
     обнулён, а рейтинг третий квартал подряд ниже 30, парламент отстраняет
     президента, не дожидаясь выборов. При распущенном парламенте отстранять
     некому — там страну ждёт другой сценарий. */
  if (role === 'president' && history && history.length >= 3 && !economy.parliamentDissolved) {
    const last3 = history.slice(-3);
    if (last3.every((h) => (h.politicalCapital != null && h.politicalCapital <= 2) && h.approval < 30)) {
      return { id: 'impeachment', title: 'Импичмент',
        text: `Политический капитал исчерпан, рейтинг ${Math.round(economy.approval)} из 100 третий квартал подряд. Парламент отстраняет президента от должности: власть, которая ничего не может предложить и ничем не может заплатить, перестаёт быть властью раньше, чем наступают выборы.` };
    }
  }
  /* Отставка по решению президента: доступна только там, где президент вообще есть.
     Два квартала на нуле — чтобы увольнение не прилетало от одного неудачного
     квартала, а полоса отношения успела побыть красной. */
  if (presidentActive && history && history.length >= 2 && (role === 'central_bank' || role === 'ministry_finance')) {
    const last2 = history.slice(-2);
    if (last2.every((h) => Number.isFinite(h.presidentSatisfaction) && h.presidentSatisfaction <= 4)) {
      return { id: 'dismissal', title: 'Отставка по решению президента',
        text: `Администрация исчерпала терпение: требования президента игнорировались, а результат их не оправдал. ${role === 'central_bank' ? 'Главу Центрального банка' : 'Министра финансов'} освобождают от должности — формально «по собственному желанию».` };
    }
  }
  /* Потеря власти не у урны: восстание или армия. При тоталитарном режиме выборов
     нет вовсе, и это единственный способ проиграть — зато настоящий. Трейдера это
     не касается: он не власть. */
  if (!privateRole && economy.powerLost) {
    return economy.powerLost === 'military'
      ? { id: 'military_coup', title: 'Военный переворот',
        text: `Армия заняла правительственные здания при напряжённости ${Math.round(economy.politicalTension || 0)} из 100 и рейтинге ${Math.round(economy.approval)}. Власть, отменившую выборы, снимают с должности не голосованием — и не спрашивая.` }
      : { id: 'uprising', title: 'Режим пал',
        text: `Массовые протесты и раскол элит вынудили власть отступить. Напряжённость ${Math.round(economy.politicalTension || 0)} из 100: удерживать страну силой дороже, чем управлять ею.` };
  }
  const er = economy.electionResult;
  if (er && er !== 'incumbent' && (role === 'full_control' || role === 'president' || role === 'ministry_finance' || (role === 'central_bank' && er === 'landslide'))) {
    return { id: 'election_defeat', title: er === 'landslide' ? 'Сокрушительное поражение на выборах' : 'Поражение на выборах',
      text: `Рейтинг власти упал до ${Math.round(economy.approval)} из 100. ${er === 'landslide' ? 'Оппозиция побеждает с разгромным перевесом — вместе с прежним курсом уходите и вы.' : 'Избиратели выбрали другой курс, и вместе с ним приходит другое руководство.'}` };
  }
  // settleQuarter сам не даёт капиталу уйти ниже 0.05 (сбрасывает счёт на этот
  // минимум) — поэтому банкротство проверяем по <=, а не по <: иначе порог
  // никогда не сработает, ведь bookVal после расчёта всегда достанет до пола
  if (role === 'trader' && bookVal != null && bookVal <= 0.05) {
    return { id: 'bankruptcy', title: 'Банкротство', text: 'Капитал исчерпан, обеспечения для новых позиций больше нет — играть не на что.' };
  }
  return null;
}

export function GameOverModal({ defeat, quarterIndex, onClose, onRestart, onOpenAch, onShare, onRollback, onChronicle, restartLabel = 'Начать заново' }) {
  useEscapeClose(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 460, width: '100%', padding: 26, textAlign: 'center', borderColor: COLOR.rust }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
        <div className="ems-serif" style={{ fontSize: 19, color: COLOR.rust, marginBottom: 10 }}>{defeat.title}</div>
        <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.6 }}>{defeat.text}</div>
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 12 }}>Партия окончена на {quarterLabel(quarterIndex)} — {quarterIndex} кв. у руля.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button className="ems-btn" onClick={onShare}><Share2 size={13} color={COLOR.gold} style={{ verticalAlign: -2, marginRight: 5 }} />Поделиться</button>
          {onChronicle && <button className="ems-btn" onClick={onChronicle}><BookOpen size={13} color={COLOR.gold} style={{ verticalAlign: -2, marginRight: 5 }} />Разбор партии</button>}
          <button className="ems-btn" onClick={onOpenAch}><Trophy size={13} color={COLOR.gold} style={{ verticalAlign: -2, marginRight: 5 }} />Коллекция</button>
          {onRollback && (
            <button className="ems-btn" style={{ borderColor: COLOR.teal, color: COLOR.teal }} onClick={onRollback}>
              <RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Откатить на 3 хода назад
            </button>
          )}
          <button className="ems-btn primary" onClick={onRestart}>{restartLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Разбор партии: переломные моменты по истории кварталов (gameChronicle в
   движке). Открывается с экрана поражения и в любой момент из меню «⋯» —
   открытая партия может идти бесконечно, и разбор нужен не только в конце.
   Это кабинет, а не газета: здесь пишется правда, включая честный итог
   подтасованных выборов. */
const CHRONICLE_TONE = { good: 'teal', bad: 'rust', neutral: 'faint' };

export function ChronicleModal({ history, onClose }) {
  useEscapeClose(onClose);
  const { events, summary } = useMemo(() => gameChronicle(history), [history]);
  const fmtSign = (v) => `${v > 0 ? '+' : ''}${fmt1(v)}`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in ems-scroll" role="dialog" aria-label="Разбор партии"
        style={{ maxWidth: 620, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span className="ems-serif" style={{ fontSize: 19, color: COLOR.goldSoft, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={17} />Разбор партии
          </span>
          <button className="ems-btn ghost" style={{ padding: '4px 8px' }} onClick={onClose} aria-label="Закрыть разбор" title="Закрыть (Esc)"><X size={15} /></button>
        </div>
        {!summary ? (
          <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.6, marginTop: 8 }}>
            Разбирать пока нечего: сыграйте хотя бы пару кварталов.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.6, marginBottom: 14 }}>
              Переломные моменты партии и решения, которые им предшествовали. Соседство во времени — ещё не доказательство причины, но обычно именно здесь видно, где всё пошло не так — или так.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 18 }}>
              {[
                ['Кварталов у руля', String(summary.quarters)],
                ['ВВП за партию', `${fmtSign(summary.gdpChange)}%`],
                ['Средняя инфляция', `${fmt1(summary.avgInflation)}%`],
                ['Кризисов', String(summary.crises)],
                ['Выборы', summary.elections ? `${summary.electionsWon} из ${summary.elections}` : 'не было'],
                ['Благополучие', `${Math.round(summary.wellbeingStart)} → ${Math.round(summary.wellbeingEnd)}`],
              ].map(([k, v]) => (
                <div key={k} className="ems-panel" style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 2 }}>{k}</div>
                  <div className="ems-mono" style={{ fontSize: 14, color: COLOR.text }}>{v}</div>
                </div>
              ))}
            </div>
            {events.length === 0 ? (
              <div style={{ fontSize: 13, color: COLOR.muted }}>Ровная партия: ни кризисов, ни выборов, ни резких поворотов.</div>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
                {events.map((ev, i) => {
                  const c = COLOR[CHRONICLE_TONE[ev.tone] || 'faint'];
                  return (
                    <li key={`${ev.q}-${ev.kind}-${i}`} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 10, paddingBottom: i === events.length - 1 ? 0 : 14 }}>
                      <span aria-hidden style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, marginTop: 4, zIndex: 1 }} />
                        {i < events.length - 1 && <span style={{ position: 'absolute', top: 16, bottom: -12, width: 1, background: COLOR.border }} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ems-mono" style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '0.04em' }}>{ev.label}</div>
                        <div className="ems-serif" style={{ fontSize: 14, color: ev.tone === 'bad' ? COLOR.rust : ev.tone === 'good' ? COLOR.teal : COLOR.text, margin: '1px 0 3px' }}>{ev.title}</div>
                        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>{ev.text}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const GameOverBar = ({ defeat, onReopen, onRestart, onRollback, restartLabel = 'Начать заново' }) => (
  <div style={{ borderTop: `2px solid ${COLOR.rust}`, background: COLOR.panel, padding: '14px 18px',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
    boxShadow: '0 -6px 20px -8px rgba(0,0,0,0.45)', flexWrap: 'wrap' }}>
    <span style={{ fontSize: 12, color: COLOR.rust, marginRight: 'auto', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
      <AlertTriangle size={14} />Партия окончена: {defeat.title}
    </span>
    <button className="ems-btn" style={{ padding: '10px 16px', fontSize: 13 }} onClick={onReopen}>Подробнее</button>
    {onRollback && (
      <button className="ems-btn" style={{ padding: '10px 16px', fontSize: 13, borderColor: COLOR.teal, color: COLOR.teal }} onClick={onRollback}>
        <RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Откатить на 3 хода назад
      </button>
    )}
    <button className="ems-btn primary" style={{ padding: '10px 20px', fontSize: 13 }} onClick={onRestart}>{restartLabel}</button>
  </div>
);

/* ============================ ВЫЗОВ ДНЯ: ИТОГ ============================
   Жребий движка в вызове дня берётся из зерна дня, причём заново на каждый квартал
   (зерно + номер квартала) — см. dailyChallenge в lib/catalog.js. */
function runSeeded(daily, salt, fn) {
  return daily ? withSeededRandom(hashSeed(`${daily.seed}:${salt}`), fn) : fn();
}

const dailyPlayed = (daily, quarterIndex) => Math.max(0, Math.min(daily.quarters, quarterIndex - 1));
const dailyScoreFmt = (v) => v.toFixed(1).replace('.', ',');

function DailyResultModal({ daily, goalId, economy, defeat, quarterIndex, role, board, setBoard, onClose, onMenu }) {
  useEscapeClose(onClose);
  const score = dailyScore(economy, goalId, !!defeat);
  const played = dailyPlayed(daily, quarterIndex);
  const goal = GOALS.find((g) => g.id === goalId);
  const [name, setName] = useState(() => loadDailyName() || `Игрок ${getPlayerId().slice(-4).toUpperCase()}`);
  // с профилем таблица подписывается его именем — поле ввода не нужно
  const account = useAccount();
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const send = React.useCallback(async (nm) => {
    setSending(true); setErr('');
    try {
      const scores = {};
      DAILY_SCORE_KEYS.forEach((k) => { scores[k] = economy[`score${k.charAt(0).toUpperCase()}${k.slice(1)}`]; });
      const res = await submitDailyResult({ playerId: getPlayerId(), day: daily.day, name: nm, score, role,
        quarters: played, defeated: !!defeat, scores, session: account ? account.token : undefined });
      setBoard(res);
    } catch (e) { setErr(e.message || 'Не удалось отправить результат'); }
    setSending(false);
  }, [daily.day, economy, score, role, played, defeat, setBoard, account]);
  // результат уходит в таблицу сам, как только партия закончилась: имя можно
  // поменять и отправить ещё раз — сервер заменит подпись, а балл оставит лучший
  React.useEffect(() => {
    recordDailyBest(daily.day, score, !!defeat);
    if (!board) send(name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 85, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" role="dialog" aria-label="Итог вызова дня"
        style={{ maxWidth: 480, width: '100%', padding: 22, marginTop: 24, borderColor: defeat ? COLOR.rust : COLOR.gold }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Trophy size={16} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Вызов дня · {dailyDateLabel(daily.day)}</span>
          <button onClick={onClose} aria-label="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>
        {defeat && (
          <div style={{ fontSize: 12, color: COLOR.rust, lineHeight: 1.5, marginBottom: 10 }}>
            <b>{defeat.title}.</b> {defeat.text} Партия оборвалась на {played}-м квартале из {daily.quarters} — итог делится пополам.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span className="ems-mono" style={{ fontSize: 40, color: defeat ? COLOR.rust : COLOR.gold, fontWeight: 600, lineHeight: 1 }}>{dailyScoreFmt(score)}</span>
          <span style={{ fontSize: 12, color: COLOR.muted }}>баллов из 100{!defeat ? ` · ${daily.quarters} кварталов пройдено` : ''}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {SCORE_DEFS.map((dd) => {
            const v = clamp(economy[dd.id] || 0, 0, 100);
            const isGoal = goal && `score${goal.score.charAt(0).toUpperCase()}${goal.score.slice(1)}` === dd.id;
            return (
              <div key={dd.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                <span style={{ width: 122, whiteSpace: 'nowrap', color: isGoal ? COLOR.goldSoft : COLOR.muted, fontWeight: isGoal ? 600 : 400 }}>{dd.short}{isGoal ? ' ★×2' : ''}</span>
                <span style={{ flex: 1, height: 4, borderRadius: 2, background: COLOR.border, overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${v}%`, height: '100%', background: dd.color }} />
                </span>
                <span className="ems-mono" style={{ width: 24, textAlign: 'right', color: dd.color, fontWeight: 600 }}>{Math.round(v)}</span>
              </div>
            );
          })}
        </div>
        {account ? (
          <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 12 }}>
            В таблице — под профилем <b style={{ color: COLOR.text }}>{account.name}</b>.
          </div>
        ) : (<>
        <label style={{ display: 'block', fontSize: 12, color: COLOR.faint, marginBottom: 4 }} htmlFor="daily-name">Имя в таблице</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <input id="daily-name" className="ems-input" value={name} maxLength={24}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: '7px 9px', fontSize: 13, background: COLOR.panelAlt, color: COLOR.text, border: `1px solid ${COLOR.border}` }} />
          <button className="ems-btn" disabled={sending || !name.trim()} style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => { saveDailyName(name.trim()); send(name.trim()); }}>
            {sending ? 'Отправляем…' : board ? 'Обновить' : 'Отправить'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 12 }}>Войдите в профиль в главном меню — и результат запишется под вашим именем со значком.</div>
        </>)}
        {err && <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 8 }}>{err}</div>}
        {board && board.you && (
          <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 8 }}>
            Ваше место: <b style={{ color: COLOR.gold }}>{board.you.rank}</b> из {board.total}
            {board.improved === false ? ` · в таблице остаётся ваш лучший результат (${dailyScoreFmt(board.you.score)})` : ''}
          </div>
        )}
        {board ? <DailyBoard day={daily.day} data={board} /> : !err && <div style={{ fontSize: 12, color: COLOR.faint }}>Отправляем результат…</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
          <button className="ems-btn" onClick={onClose}>Посмотреть партию</button>
          <button className="ems-btn primary" onClick={onMenu}>В меню</button>
        </div>
      </div>
    </div>
  );
}

const DailyBar = ({ score, defeat, onReopen, onMenu }) => (
  <div style={{ borderTop: `2px solid ${defeat ? COLOR.rust : COLOR.gold}`, background: COLOR.panel, padding: '14px 18px',
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
    boxShadow: '0 -6px 20px -8px rgba(0,0,0,0.45)', flexWrap: 'wrap' }}>
    <span style={{ fontSize: 12, color: defeat ? COLOR.rust : COLOR.goldSoft, marginRight: 'auto', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
      <Trophy size={14} />Вызов дня завершён: {dailyScoreFmt(score)} баллов{defeat ? ` (${defeat.title.toLowerCase()})` : ''}
    </span>
    <button className="ems-btn" style={{ padding: '10px 16px', fontSize: 13 }} onClick={onReopen}>Итоги и таблица</button>
    <button className="ems-btn primary" style={{ padding: '10px 20px', fontSize: 13 }} onClick={onMenu}>В меню</button>
  </div>
);

/* Карточка результата: не только на конце партии (поражение), но и в любой
   момент по кнопке в шапке — так шансов поделиться и позвать друга в сеть
   больше, чем ждать финала. Рисуется на canvas и скачивается/копируется как
   текст: ни бэкенда, ни аккаунтов для «шаринга» этой игре не требуется. */
const RESULT_CARD_EMOJI = { central_bank: '🏛️', ministry_finance: '💰', full_control: '👑', president: '🎖️', trader: '📈', entrepreneur: '🏭' };

function ruPlural(n, one, few, many) {
  const n10 = n % 10; const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

const countUnlockedAchievements = () => { const u = loadUnlockedAchievements(); return ACHIEVEMENTS.filter((a) => u[a.id]).length; };

export function buildResultCard({ role, quarterIndex, economy, startEconomy, portfolio, defeat, promises }) {
  const roleLabel = (ROLES.find((r) => r.id === role) || {}).short || role;
  const isTrader = role === 'trader';
  const stats = [];
  if (isTrader && portfolio) {
    const val = bookValue(portfolio, economy, null);
    const start = portfolio.startValue || 10;
    const ret = ((val / start) - 1) * 100;
    stats.push(['Капитал', fmtMln(val)]);
    stats.push(['Доходность', `${ret >= 0 ? '+' : ''}${ret.toFixed(0)}%`]);
    stats.push(['Сделок на рынке', String((portfolio.trades || []).length)]);
    stats.push(['Итог казино', fmtMlnSigned(portfolio.casinoNet || 0)]);
  } else {
    const gdpChange = startEconomy && startEconomy.gdp > 0 ? ((economy.gdp / startEconomy.gdp) - 1) * 100 : null;
    stats.push(['ВВП с начала партии', gdpChange != null ? `${gdpChange >= 0 ? '+' : ''}${gdpChange.toFixed(0)}%` : '—']);
    stats.push(['Инфляция', `${fmt1(economy.inflation)}%`]);
    stats.push(['Безработица', `${fmt1(economy.unemployment)}%`]);
    if (role === 'full_control' && promises && promises.length) {
      const keptCount = promises.filter((p) => evaluatePromise(p, economy).met).length;
      stats.push(['Обещания сдержаны', `${keptCount} из ${promises.length}`]);
    } else {
      stats.push(['Долг к ВВП', `${fmt1(economy.debtToGdp)}%`]);
    }
  }
  return {
    roleLabel, emoji: RESULT_CARD_EMOJI[role] || '🏛️',
    quarterIndex, quarterWord: ruPlural(quarterIndex, 'квартал', 'квартала', 'кварталов'),
    years: (quarterIndex / 4).toFixed(1),
    outcome: defeat ? defeat.title : 'Партия продолжается',
    isDefeat: !!defeat, stats, unlockedCount: countUnlockedAchievements(),
    regime: economy.politicalRegime || 'democracy',
  };
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Тот же оттиск, что StateSeal рисует в SVG для шапки/газеты/перехода между
   кварталами, — здесь его canvas-версия для карточки результата: она уходит
   за пределы приложения (сохраняется, репостится), и печать в углу — это то,
   что делает её «официальным документом», а не просто скриншотом статистики. */
function canvasSeal(ctx, cx, cy, r, regime) {
  const info = POLITICAL_REGIME_INFO[regime] || POLITICAL_REGIME_INFO.democracy;
  const color = COLOR[info.color] || COLOR.gold;
  const hard = regime === 'authoritarian' || regime === 'totalitarian';
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = hard ? 2.4 : 1.3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  const ticks = 16;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const inner = r * (hard ? 0.82 : 0.86); const outer = r * 0.98;
    ctx.globalAlpha = hard ? 0.9 : 0.55;
    ctx.lineWidth = hard ? 2.6 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = hard ? 2 : 1.1;
  ctx.beginPath(); ctx.arc(cx, cy, r * (hard ? 0.68 : 0.74), 0, Math.PI * 2); ctx.stroke();
  // пятиконечная звезда в центре — контурная в демократии, залитая в жёстких режимах
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r * 0.42 : r * 0.18;
    const a = -Math.PI / 2 + i * (Math.PI / 5);
    const px = cx + Math.cos(a) * rr; const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (hard) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

function drawResultCard(canvas, data) {
  const W = 1000; const H = 625; const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;
  // размер на экране задаёт CSS (width:100%, height:auto на самом <canvas>) —
  // если продублировать его тут через canvas.style, эффект перетрёт инлайн-стиль
  // React и картинка перестанет вписываться в модалку при её ширине < 1000px
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.fillStyle = COLOR.bg; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 700);
  grad.addColorStop(0, COLOR.bgVignette); grad.addColorStop(1, COLOR.bg);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLOR.gold; ctx.fillRect(0, 0, W, 4);
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  canvasSeal(ctx, W - 60, 60, 34, data.regime);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.goldSoft;
  ctx.font = `600 14px ${FONT.sans}`;
  ctx.fillText('I N F L A T I A', W / 2, 46);

  ctx.fillStyle = COLOR.text;
  ctx.font = `700 38px ${FONT.serif}`;
  ctx.fillText(`${data.emoji}  ${data.roleLabel}`, W / 2, 106);

  ctx.fillStyle = COLOR.gold;
  ctx.font = `800 112px ${FONT.serif}`;
  ctx.fillText(String(data.quarterIndex), W / 2, 246);
  ctx.fillStyle = COLOR.muted;
  ctx.font = `500 17px ${FONT.sans}`;
  ctx.fillText(`${data.quarterWord} у руля  ·  ${data.years} лет`, W / 2, 278);

  ctx.font = `700 18px ${FONT.sans}`;
  const outcomeW = Math.min(820, ctx.measureText(data.outcome).width + 56);
  ctx.fillStyle = data.isDefeat ? COLOR.rustDim : COLOR.tealDim;
  canvasRoundRect(ctx, W / 2 - outcomeW / 2, 304, outcomeW, 44, 9); ctx.fill();
  ctx.fillStyle = data.isDefeat ? COLOR.rust : COLOR.teal;
  ctx.fillText(data.outcome, W / 2, 332);

  const cellW = 440; const cellH = 80; const gapX = 20; const gridTop = 384;
  const startX = W / 2 - cellW - gapX / 2;
  ctx.textAlign = 'left';
  data.stats.forEach((s, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = startX + col * (cellW + gapX); const y = gridTop + row * (cellH + 14);
    ctx.fillStyle = COLOR.panelAlt; canvasRoundRect(ctx, x, y, cellW, cellH, 8); ctx.fill();
    ctx.strokeStyle = COLOR.border; canvasRoundRect(ctx, x, y, cellW, cellH, 8); ctx.stroke();
    ctx.fillStyle = COLOR.muted; ctx.font = `500 14px ${FONT.sans}`;
    ctx.fillText(s[0], x + 22, y + 30);
    ctx.fillStyle = COLOR.text; ctx.font = `700 25px ${FONT.mono}`;
    ctx.fillText(s[1], x + 22, y + 62);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.faint;
  ctx.font = `500 14px ${FONT.sans}`;
  ctx.fillText(`🏆 Открыто ${data.unlockedCount} из ${ACHIEVEMENTS.length} достижений`, W / 2, H - 30);
}

export function ResultCardModal({ data, onClose }) {
  useEscapeClose(onClose);
  const canvasRef = React.useRef(null);
  const [copied, setCopied] = useState(false);
  React.useEffect(() => { if (canvasRef.current) drawResultCard(canvasRef.current, data); }, [data]);
  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `inflatia-${data.quarterIndex}kv.png`;
    a.click();
    Audio.play('click');
  };
  const copyText = async () => {
    const lines = [
      'Inflatia — симулятор государства и бизнеса',
      `Роль: ${data.roleLabel}`,
      `Отыграно: ${data.quarterIndex} ${data.quarterWord} (${data.years} лет)`,
      `Итог: ${data.outcome}`,
      ...data.stats.map(([k, v]) => `${k}: ${v}`),
      `Достижений: ${data.unlockedCount} из ${ACHIEVEMENTS.length}`,
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); Audio.play('click'); setTimeout(() => setCopied(false), 1800); }
    catch { /* буфер обмена недоступен — нет разрешения или не https */ }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.85)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 620, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Share2 size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Карточка результата</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6, border: `1px solid ${COLOR.border}` }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="ems-btn" style={{ flex: 1, padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={copyText}>
            <Copy size={13} />{copied ? 'Скопировано' : 'Скопировать текст'}
          </button>
          <button className="ems-btn primary" style={{ flex: 1, padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={download}>
            <Download size={13} />Скачать картинку
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveLoadModal({ mode, snapshot, onClose, onLoad, onSaved, activeSlot }) {
  useEscapeClose(onClose);
  const [tab, setTab] = useState(mode || 'save');
  const [error, setError] = useState('');
  const [slots, setSlots] = useState(null); // null = ещё загружаются
  const [busyIdx, setBusyIdx] = useState(null);
  const [storageMode, setStorageMode] = useState(null);
  const playerId = useMemo(getPlayerId, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchSoloSlots(playerId).then((d) => { if (!cancelled) { setSlots(d.slots); setStorageMode(d.storage || null); } })
      .catch((e) => { if (!cancelled) { setSlots(Array.from({ length: SOLO_SLOT_COUNT }, () => null)); setError(e.message); } });
    return () => { cancelled = true; };
  }, [playerId]);

  // подпись слота: роль и квартал — то, по чему партию узнают, если ей не дали имени.
  // quarterIndex в сохранении — это уже тот квартал, на который партия откроется при
  // загрузке, а не последний сыгранный: подпись должна показывать именно его, иначе
  // список сохранений называет квартал на один раньше того, что откроется по «Играть».
  const slotLabel = (s) => {
    const roleTitle = (ROLES.find((r) => r.id === s.role) || {}).short || s.role;
    return `${roleTitle} · ${quarterLabel(s.quarterIndex || 1)}`;
  };
  const saveToSlot = async (idx) => {
    if (!snapshot) return;
    // в свой же слот — это просто сохранить текущую партию, спрашивать не о чем
    if (slots[idx] && idx !== activeSlot && !window.confirm(`Перезаписать «${slots[idx].name || `слот ${idx + 1}`}»?`)) return;
    setBusyIdx(idx); setError('');
    try {
      validateSnapshot(snapshot);
      setSlots(await saveSoloSlot(playerId, idx, snapshot));
      Audio.play('stamp');
      // партия отныне привязана к этому слоту — дальнейшие автосохранения
      // должны обновлять именно его, а не только анонимную копию в браузере
      if (onSaved) onSaved(idx);
    } catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };
  const renameSlot = async (idx) => {
    const cur = slots[idx];
    if (!cur) return;
    const next = window.prompt('Название сохранения (пусто — вернуть подпись по умолчанию):', cur.name || '');
    if (next === null) return;
    setBusyIdx(idx); setError('');
    try { setSlots(await renameSoloSlot(playerId, idx, next)); Audio.play('tick'); }
    catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };
  const loadFromSlot = async (idx) => {
    if (!slots[idx]) return;
    setBusyIdx(idx); setError('');
    try {
      const snap = validateSnapshot(await fetchSoloSlot(playerId, idx));
      Audio.play('stamp');
      onLoad({ ...snap, slotIdx: idx });
    } catch (e) { setError(e.message); setBusyIdx(null); }
  };
  const deleteSlot = async (idx) => {
    setBusyIdx(idx); setError('');
    try { setSlots(await deleteSoloSlot(playerId, idx)); }
    catch (e) { setError(e.message); }
    finally { setBusyIdx(null); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.8)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="ems-panel-raised ems-fade-in" style={{ maxWidth: 480, width: '100%', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Save size={15} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Сохранения</span>
          <button className="ems-btn" style={{ marginLeft: 'auto', padding: '4px 7px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[['save', 'Сохранить'], ['load', 'Загрузить']].map(([id, label]) => (
            <button type="button" key={id} className={`ems-tab ${tab === id ? 'active' : ''}`} aria-pressed={tab === id} onClick={() => { Audio.play('tab'); setTab(id); setError(''); }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10, lineHeight: 1.5 }}>
          {tab === 'save'
            ? `Партия хранится на сервере — как и сетевые комнаты. ${SOLO_SLOT_COUNT} слота на это устройство, каждому можно дать своё название.`
            : 'Выберите слот, чтобы вернуться в сохранённую партию. Текущая партия будет заменена.'}
        </div>
        {/* где вы сейчас играете: раньше слот текущей партии ничем не выделялся */}
        {slots !== null && (
          <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.45, color: Number.isFinite(activeSlot) ? COLOR.teal : COLOR.gold }}>
            {Number.isFinite(activeSlot)
              ? `Сейчас вы играете в слоте ${activeSlot + 1}${slots[activeSlot] && slots[activeSlot].name ? ` — «${slots[activeSlot].name}»` : ''}: каждый квартал он обновляется сам.`
              : 'Текущая партия ещё не привязана к слоту: сохраните её, чтобы она не пропала при очистке браузера.'}
          </div>
        )}
        {storageMode === 'memory' && (
          <div style={{ fontSize: 12, color: COLOR.rust, marginBottom: 10, lineHeight: 1.4 }}>
            Сервер не подключён к общему хранилищу — сохранение может пропасть между запросами.
          </div>
        )}

        {slots === null ? (
          <div style={{ fontSize: 12, color: COLOR.muted }}>Загружаем слоты…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slots.map((slot, idx) => {
              const current = idx === activeSlot;
              return (
              <div key={idx} aria-current={current ? 'true' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: current ? COLOR.goldDim : COLOR.panelAlt, border: `1px solid ${current ? COLOR.gold : COLOR.border}`, borderRadius: 8, fontSize: 12 }}>
                <span style={{ flex: 1, minWidth: 0, color: slot ? COLOR.text : COLOR.faint }}>
                  {slot ? (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.name || `Слот ${idx + 1}`}</span>
                        {current && (
                          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: COLOR.ink, background: COLOR.gold,
                            borderRadius: 999, padding: '1px 7px' }}>СЕЙЧАС ИГРАЕТЕ</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: COLOR.faint }}>{slotLabel(slot)}</span>
                    </>
                  ) : `Слот ${idx + 1}: пусто`}
                </span>
                {slot && (
                  <button className="ems-btn" title="Переименовать сохранение" aria-label={`Переименовать слот ${idx + 1}`}
                    style={{ padding: '3px 7px', fontSize: 12, color: COLOR.faint }}
                    disabled={busyIdx === idx} onClick={() => renameSlot(idx)}>✎</button>
                )}
                {tab === 'save' && snapshot && (
                  <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12 }} disabled={busyIdx === idx} onClick={() => saveToSlot(idx)}>
                    {busyIdx === idx ? 'Сохраняем…' : current ? 'Сохранить' : (slot ? 'Перезаписать' : 'Сохранить')}
                  </button>
                )}
                {tab === 'load' && slot && (
                  <>
                    <button className="ems-btn" style={{ padding: '4px 9px', fontSize: 12 }} disabled={busyIdx === idx} onClick={() => loadFromSlot(idx)}>
                      {busyIdx === idx ? 'Загружаем…' : 'Загрузить'}
                    </button>
                    <button onClick={() => deleteSlot(idx)} aria-label={`Удалить слот ${idx + 1}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR.faint, padding: 2, lineHeight: 0 }}>
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
              );
            })}
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}

/* Бюджетная арифметика: почему баланс такой, какой он есть */
function FiscalMath({ economy, decisions }) {
  const growth = (v) => `${fmtSigned1(v)}%`;
  const rows = [
    ['Доходы бюджета', fmtMoney(economy.govRevenue), `${fmt1(economy.revenuePctGdp)}% ВВП`],
    ['Расходы всего', fmtMoney(economy.govSpendingTotal), `${fmt1(economy.govSpendingTotal / economy.nominalGdp * 100)}% ВВП`],
    ['· госзакупки', fmtMoney(economy.govPurchasesNominal), growth(economy.govPurchasesGrowth)],
    ['   из них оборона', fmtMoney(economy.govPurchasesNominal * (economy.budgetShares.defense || 0) / 100), `${fmt1(economy.budgetShares.defense || 0)}% закупок`],
    ['· выплаты', fmtMoney(economy.transfersNominal), growth(economy.transfersGrowth)],
    ['· инвестиции', fmtMoney(economy.govInvestmentNominal), growth(economy.govInvestmentGrowth)],
    ['· обслуживание долга', fmtMoney(economy.interestPayment), `ставка ${fmt1(economy.effectiveDebtRate)}%`],
  ];
  const bal = economy.budgetBalancePctGdp;
  const limit = economy.maxDeficitPct;
  const plan = decisions.govSpending * 0.62 + decisions.transfers * 0.27 + decisions.govInvestment * 0.11;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Scale size={13} />Бюджетная арифметика
      </div>
      {rows.map(([a, b, c]) => (
        <div key={a} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '3px 0', color: a.startsWith('·') ? COLOR.muted : COLOR.text }}>
          <span>{a}</span>
          <span style={{ display: 'flex', gap: 9 }}>
            <span className="ems-mono">{b}</span>
            <span className="ems-mono" style={{ color: COLOR.faint, width: 68, textAlign: 'right' }}>{c}</span>
          </span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${COLOR.hairline}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Баланс</span>
        <span className="ems-mono" style={{ color: bal >= 0 ? COLOR.teal : COLOR.rust, fontWeight: 600 }}>{fmtSigned1(bal)}% ВВП</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 7, lineHeight: 1.45 }}>
        Рычаги задают <b style={{ color: COLOR.muted }}>реальный рост сверх тренда</b>: ноль означает, что расходы растут вместе с экономикой, а не заморожены. Ваш текущий набор решений — {growth(plan)} к тренду.
        {Number.isFinite(limit) && <> Рынок готов финансировать дефицит до {fmt1(limit)}% ВВП; сверх этого начинается секвестр.</>}
        {economy.sequesterFactor < 0.995 && <span style={{ color: COLOR.rust }}> Сейчас расходы принудительно урезаны на {fmt1((1 - economy.sequesterFactor) * 100)}%.</span>}
      </div>
    </div>
  );
}

/* Сводка по ведомству, которым управляет бот */
const SUMMARY_TABS = {
  central_bank: { id: 'summary_cb', label: 'Сводка ЦБ', icon: Landmark, rows: [
    // ставка ходит шагом 0.25 п.п., а pctFmt округлял до десятых: 5.25% и 5.5%
    // выглядели как «5.3%» и «5.5%», то есть разный шаг казался одинаковым
    { key: 'keyRate', label: 'Ключевая ставка', fmt: (v) => `${fmt2(v)}%` },
    { key: 'inflationTarget', label: 'Цель ЦБ по инфляции', fmt: pctFmt },
    { key: 'inflation', label: 'Инфляция', fmt: pctFmt },
    { key: 'inflationExpectations', label: 'Ожидания', fmt: pctFmt },
    { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: (v) => v.toFixed(0),
      hint: 'Растёт медленно, кварталами, когда инфляция держится у цели, а решения соответствуют ситуации. Падает от смены цели, экстренной эмиссии, крупных QE и любого отклонения инфляции от цели.' },
    { key: 'stabilizationCred', label: 'Доверие к стабилизации', fmt: (v) => (v > 0 ? `${Math.round(v * 100)} из 100` : '—'),
      hint: 'Включается при инфляции выше цели на 8 п.п. Копится, пока реальная ставка не ниже 3 п.п., ЦБ не печатает деньги, а дефицит бюджета не больше 3% ВВП (или сокращается); управляемый курс при достаточных резервах ускоряет. Одна ставка без бюджета копит доверие втрое медленнее, ослабление денег раньше времени обрушивает его сразу. Чем выше доверие, тем быстрее падают ожидания и тем мягче рецессия.' },
    { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
    { key: 'rStar', label: 'Нейтральная ставка r*', fmt: pctFmt,
      hint: 'Условный уровень реальной ставки, при котором экономика растёт ровно на потенциал — не разгоняясь и не тормозя. Ориентир для сравнения, а не рычаг.' },
    { key: 'rateGap', label: 'Жёсткость условий', fmt: (v) => `${fmtSigned1(v)} п.п.`,
      hint: 'Насколько фактическая ставка жёстче или мягче нейтральной r*. Положительный — политика сдерживает экономику, отрицательный — стимулирует.' },
    { key: 'capitalRequirement', label: 'Норматив капитала банков', fmt: pctFmt },
    { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
    { key: 'bankCapitalAdequacy', label: 'Достаточность капитала', fmt: pctFmt },
    { key: 'reserves', label: 'Резервы', fmt: fmtMoney },
    { label: 'Режим курса', get: (e) => e.fxRegime, text: true, map: { free: 'плавающий', managed: 'управляемый', peg: 'фиксированный' } },
  ] },
  ministry_finance: { id: 'summary_mof', label: 'Сводка Минфина', icon: Coins, rows: [
    { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
    { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
    { key: 'budgetBalancePctGdp', label: 'Баланс бюджета', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'structuralBalancePctGdp', label: 'Структурный баланс', fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      hint: 'Баланс бюджета, очищенный от влияния экономического цикла. Показывает, дефицитна ли бюджетная политика сама по себе, а не только из-за текущего спада или подъёма.' },
    { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
    { key: 'interestToRevenue', label: 'Проценты к доходам', fmt: pctFmt },
    { key: 'fiscalImpulse', label: 'Бюджетный импульс', fmt: (v) => `${fmtSigned1(v)} п.п.`,
      hint: 'Изменение бюджетного стимула за квартал. Положительный — бюджет разгоняет спрос сверх прошлого квартала, отрицательный — сдерживает.' },
    { key: 'vatRate', label: 'НДС', fmt: pctFmt },
    { key: 'incomeTaxRate', label: 'Подоходный налог', fmt: pctFmt },
    { key: 'profitTaxRate', label: 'Налог на прибыль', fmt: pctFmt },
    { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt,
      hint: 'Доля экономики вне налогообложения. Растёт вместе с налоговой нагрузкой, снижается при её облегчении.' },
    { label: 'Доля образования', get: (e) => e.budgetShares.education, fmt: pctFmt },
    { label: 'Доля науки', get: (e) => e.budgetShares.science, fmt: pctFmt },
    { label: 'Доля здравоохранения', get: (e) => e.budgetShares.health, fmt: pctFmt },
    { label: 'Доля обороны', get: (e) => e.budgetShares.defense, fmt: pctFmt,
      hint: 'Сила армии в войне и то, насколько тяжёлым будет удар, если война придёт извне.' },
    { label: 'Расходы на оборону', get: (e) => (e.govPurchasesNominal || 0) * (e.budgetShares.defense || 0) / 100, fmt: fmtMoney },
    { label: 'Доля госуправления', get: (e) => e.budgetShares.admin, fmt: pctFmt },
  ] },
};

/* «Показатели экономики» — единственное место, где смотрят на ставку, норматив
   капитала, баланс бюджета и прочие цифры ведомств: раньше те же три-четыре
   значения ещё раз печатались прямо в карточке бота (см. BotPanel), и правка
   там неизбежно расходилась с тем, что показывала эта вкладка. При «обоих ботах»
   (президент, трейдер) нужны сразу обе сводки, а не только одна. */
const tabsForBotRole = (botRole) => (botRole === 'both' ? [...INDICATOR_TABS, SUMMARY_TABS.central_bank, SUMMARY_TABS.ministry_finance]
  : botRole && SUMMARY_TABS[botRole] ? [...INDICATOR_TABS, SUMMARY_TABS[botRole]] : INDICATOR_TABS);

/* scaleLever («какой ползунок на самом деле доступен игроку при этой экономике»)
   переехал в движок: по тем же границам теперь ходят и боты, и стенд длинных
   партий. Пока правило жило здесь, бот-ЦБ мог выдать норматив капитала 10,8%
   при шаге ползунка 0,5 — интерфейс о боте не знал, а бот не знал о ползунке.
   Реэкспорт оставлен, чтобы обучение и панели импортировали как раньше. */
export { scaleLever };

/* ============================ ТОРГОВЫЙ ТЕРМИНАЛ ============================ */
// доля госдолга (в тех же единицах, что и книга инвестора — млн), которую
// разрешено выкупить одному инвестору в гособлигации: остальное держат другие
// участники рынка, о которых игра просто не рассказывает
export const GOV_BOND_INVESTOR_SHARE = 0.05;

export const INSTRUMENTS = [
  { id: 'eq_broad', name: 'Индекс акций', ticker: 'IDX', group: 'Акции', color: COLOR.gold, key: 'stockIndex', fee: 0.0015, kind: 'spot',
    note: 'Весь рынок целиком. Растёт на дешёвых деньгах и прибылях, падает на ставке и риске.' },
  { id: 'eq_banks', name: 'Банки (ETF)', ticker: 'BNK', group: 'Акции', color: COLOR.blue, key: 'sectorBanks', fee: 0.002, kind: 'spot',
    note: 'Живёт процентной маржой, умирает от просрочки и нормативов капитала.' },
  { id: 'eq_industry', name: 'Промышленность (ETF)', ticker: 'IND', group: 'Акции', color: COLOR.teal, key: 'sectorIndustry', fee: 0.002, kind: 'spot',
    note: 'Чувствительна к инвестиционному циклу и стоимости кредита.' },
  { id: 'eq_consumer', name: 'Потребительский (ETF)', ticker: 'CNS', group: 'Акции', color: COLOR.goldSoft, key: 'sectorConsumer', fee: 0.002, kind: 'spot',
    note: 'Зависит от реальных зарплат и уверенности домохозяйств.' },
  { id: 'eq_resources', name: 'Сырьевой (ETF)', ticker: 'RES', group: 'Акции', color: '#8E7CC3', key: 'sectorResources', fee: 0.002, kind: 'spot',
    note: 'Выигрывает от дорогого сырья и слабой валюты.' },
  { id: 'reit', name: 'Фонды недвижимости', ticker: 'RET', group: 'Акции', color: '#C08A6B', key: 'reitIndex', fee: 0.0025, kind: 'spot',
    note: 'Недвижимость переоценивается вслед за ставкой по кредитам и реальными доходами. Самый процентно-чувствительный актив.' },
  { id: 'eq_world', name: 'Мировые акции (ETF)', ticker: 'WLD', group: 'Акции', color: '#6BA9C0', key: 'worldEquityIndex', fee: 0.0025, kind: 'spot',
    note: 'Чужой экономический цикл, пересчитанный в местную валюту. Единственная позиция, которой всё равно на вашу ставку и ваш бюджет: растёт на мировом спросе и на девальвации.' },
  { id: 'bond_gov', name: 'Гособлигации 10 лет', ticker: 'GOV', group: 'Облигации', color: COLOR.blue, key: 'bondIndex', fee: 0.001, kind: 'spot',
    note: 'Индекс полной доходности: купон уже внутри цены и реинвестируется, отдельной выплаты нет, бумага не гасится. Дюрация 7,4: доходность +1 п.п. отнимает около 7% цены.' },
  { id: 'bond_short', name: 'Короткие ОФЗ 2 года', ticker: 'GOV2', group: 'Облигации', color: '#7FA3B8', key: 'bondShortIndex', fee: 0.0008, kind: 'spot',
    note: 'Тот же госдолг, но дюрация 1,9 вместо 7,4: разворот ставки почти не двигает цену. Место, где пережидают неопределённость, не выходя из бумаг.' },
  { id: 'bond_linker', name: 'Инфляционные линкеры', ticker: 'LNK', group: 'Облигации', color: '#C2A15A', key: 'linkerIndex', fee: 0.0012, kind: 'spot',
    note: 'Номинал индексируется на фактическую инфляцию, сверху — реальная доходность. Единственная бумага, которой скачок цен помогает, а не вредит.' },
  { id: 'bond_corp', name: 'Корпоративные облигации', ticker: 'CRP', group: 'Облигации', color: COLOR.teal, key: 'corpBondIndex', fee: 0.0015, kind: 'spot',
    note: 'То же самое, но с кредитным спредом: доходность выше, а в кризис спред расширяется и цена падает сильнее государственной. Дюрация 4,1.' },
  { id: 'dep', name: 'Банковский депозит', ticker: 'DEP', group: 'Деньги', color: COLOR.teal, key: 'depositIndex', fee: 0, kind: 'spot',
    note: 'Ставка по депозитам. Безопасно ровно до тех пор, пока реальная ставка не уйдёт в минус.' },
  { id: 'mm', name: 'Денежный рынок (РЕПО)', ticker: 'MMF', group: 'Деньги', color: '#9AA79B', key: 'moneyMarketIndex', fee: 0.0002, kind: 'spot',
    note: 'Овернайт по ключевой ставке. Номинально безрисковый и ровно настолько же беззащитный перед инфляцией: при отрицательной реальной ставке теряет медленно, но неизбежно.' },
  { id: 'fx', name: 'Иностранная валюта', ticker: 'FX', group: 'Деньги', color: COLOR.rust, key: 'fxIndex', fee: 0.003, kind: 'spot',
    note: 'Курс плюс мировая ставка. Страховка от девальвации и от собственного правительства.' },
  { id: 'gold', name: 'Сырьевой контракт', ticker: 'CMD', group: 'Товары', color: '#C08A6B', key: 'goldIndex', fee: 0.0025, kind: 'spot',
    note: 'Мировая цена сырья в местной валюте: защищает и от инфляции, и от слабого курса.' },
  { id: 'fut_idx', name: 'Фьючерс на индекс', ticker: 'F-IDX', group: 'Производные', color: COLOR.gold, key: 'stockIndex', fee: 0.0008, kind: 'fut', lev: 5,
    note: 'Плечо 5:1. Вы вносите только ГО; прибыль и убыток начисляются на всю позицию и попадают на счёт при закрытии.' },
  { id: 'fut_fx', name: 'Фьючерс на валюту', ticker: 'F-FX', group: 'Производные', color: COLOR.rust, key: 'fxIndex', fee: 0.0008, kind: 'fut', lev: 8,
    note: 'Плечо 8:1. Вы вносите только ГО; движение курса на 1% меняет ваши деньги на 8%.' },
  { id: 'fut_bond', name: 'Фьючерс на облигации', ticker: 'F-GOV', group: 'Производные', color: COLOR.blue, key: 'bondIndex', fee: 0.0006, kind: 'fut', lev: 10,
    note: 'Плечо 10:1. Ставка на разворот денежной политики. Движение цены на 1% — это 10% вашего ГО.' },
  { id: 'fut_cmd', name: 'Фьючерс на сырьё', ticker: 'F-CMD', group: 'Производные', color: '#C08A6B', key: 'goldIndex', fee: 0.0009, kind: 'fut', lev: 6,
    note: 'Плечо 6:1 на мировую цену сырья в местной валюте. Двойная ставка сразу: и на сырьевой цикл, и на курс.' },
  { id: 'opt_call', name: 'Опцион call на индекс', ticker: 'CALL', group: 'Опционы', color: COLOR.teal, key: 'stockIndex', fee: 0.004, kind: 'opt', optType: 'call', life: 2,
    note: 'Право купить индекс по текущей цене через 2 квартала. Убыток ограничен премией, прибыль — нет.' },
  { id: 'opt_put', name: 'Опцион put на индекс', ticker: 'PUT', group: 'Опционы', color: COLOR.rust, key: 'stockIndex', fee: 0.004, kind: 'opt', optType: 'put', life: 2,
    note: 'Право продать индекс по текущей цене через 2 квартала. Страховка портфеля от обвала.' },
  { id: 'cds_sovereign', name: 'Своп на дефолт (CDS)', ticker: 'CDS', group: 'Производные', color: '#B0503A', key: 'sovereignSpread', fee: 0.003, kind: 'spot',
    note: 'Не индекс, а сама премия за риск по гособлигациям в базисных пунктах: растёт вместе с долговым риском и подскакивает при первых признаках кризиса. Прямая ставка на то, что Минфин не удержит долг под контролем, а не на то, что будет с производством или спросом.' },
];

export const INSTR_BY_ID = {};

INSTRUMENTS.forEach((x) => { INSTR_BY_ID[x.id] = x; });

export const MAINTENANCE = 0.25;

     // ниже этого уровня приходит маржин-колл
const TARGET_MARGIN = 0.38;

   // до этого уровня принудительно закрывают
export const BORROW_FEE = 0.02;

      // годовая плата за короткую позицию

export const emptyBook = () => ({ cash: 10, pos: {}, avg: {}, opts: [], realized: 0, history: [10],
  startValue: 10, benchStart: null, marginCalls: 0, lastEvents: [], casinoNet: 0 });

export const priceOf = (instr, economy, live) => {
  const v = (live && Number.isFinite(live[instr.key])) ? live[instr.key] : economy[instr.key];
  return Number.isFinite(v) && v > 0 ? v : 1;
};

const normCdf = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};

export function optionValue(type, S, K, volAnnual, quartersLeft) {
  const T = Math.max(0.02, quartersLeft / 4);
  const vol = clamp(volAnnual, 0.08, 1.6);
  const sT = vol * Math.sqrt(T);
  const d1 = (Math.log(Math.max(1e-6, S / K)) + 0.5 * sT * sT) / sT;
  const d2 = d1 - sT;
  if (type === 'call') return Math.max(0, S * normCdf(d1) - K * normCdf(d2));
  return Math.max(0, K * normCdf(-d2) - S * normCdf(-d1));
}

export const impliedVol = (economy) => clamp(economy.volatilityIndex / 100 * 1.5, 0.12, 1.4);

export function bookParts(book, economy, live) {
  let spot = 0; let futPnl = 0; let optVal = 0; let gross = 0;
  INSTRUMENTS.forEach((i) => {
    const q = book.pos[i.id] || 0;
    if (!q) return;
    const pr = priceOf(i, economy, live);
    if (i.kind === 'fut') { futPnl += q * (pr - (book.avg[i.id] || pr)) / 1000; gross += Math.abs(q) * pr / 1000; }
    else { spot += q * pr / 1000; gross += Math.abs(q) * pr / 1000; }
  });
  (book.opts || []).forEach((lot) => {
    const instr = INSTR_BY_ID[lot.instr];
    if (!instr) return;
    const S = priceOf(instr, economy, live);
    const v = optionValue(lot.type, S, lot.strike, impliedVol(economy), lot.left) * lot.qty / 1000;
    optVal += v;
    gross += Math.abs(lot.qty) * S / 1000 * 0.4;
  });
  return { spot, futPnl, optVal, gross };
}

export const bookValue = (book, economy, live) => {
  const p = bookParts(book, economy, live);
  return book.cash + p.spot + p.futPnl + p.optVal;
};

const marginLevel = (book, economy, live) => {
  const p = bookParts(book, economy, live);
  const eq = book.cash + p.spot + p.futPnl + p.optVal;
  return p.gross > 0.01 ? eq / p.gross : 9;
};

/* amountMln — деньги для спота и опционов, гарантийное обеспечение для фьючерса */
export function tradeBook(book, instrId, amountMln, side, economy, live) {
  const instr = INSTR_BY_ID[instrId];
  if (!instr || !(amountMln > 0.0001)) return book;
  const price = priceOf(instr, economy, live);
  const dir = side === 'buy' ? 1 : -1;
  // подстраховка на случай, если запрос пришёл с устаревшим лимитом (например,
  // «макс.» был нажат за мгновение до того, как госдолг подрос или сократился) —
  // сама UI уже не даёт запросить больше, но здесь тот же потолок применяется
  // ещё раз, чтобы позиция никогда не превысила долю рынка ни при каких гонках
  if (instrId === 'bond_gov' && side === 'buy') {
    const held0 = book.pos[instrId] || 0;
    const heldVal0 = held0 * price / 1000;
    const room = Math.max(0, (economy.govDebt || 0) * 1000 * GOV_BOND_INVESTOR_SHARE - Math.max(0, heldVal0));
    amountMln = Math.min(amountMln, room);
    if (!(amountMln > 0.0001)) return book;
  }

  if (instr.kind === 'opt') {
    const vol = impliedVol(economy);
    if (side === 'buy') {
      const prem = optionValue(instr.optType, price, price, vol, instr.life) * (1 + instr.fee);
      if (prem <= 0.0001) return book;
      const qty = amountMln * 1000 / prem;
      return { ...book, cash: book.cash - amountMln,
        opts: [...(book.opts || []), { id: `o${Math.random().toString(36).slice(2, 8)}`, instr: instrId, type: instr.optType,
          strike: price, qty, left: instr.life, premium: prem }] };
    }
    // продажа = закрытие имеющихся контрактов этого типа
    let remain = amountMln; let cash = book.cash; let realized = book.realized;
    const opts = [];
    (book.opts || []).forEach((lot) => {
      if (lot.instr !== instrId || remain <= 0.0001) { opts.push(lot); return; }
      const S = priceOf(INSTR_BY_ID[lot.instr], economy, live);
      const v = optionValue(lot.type, S, lot.strike, vol, lot.left) * (1 - instr.fee);
      const lotVal = v * lot.qty / 1000;
      if (lotVal <= remain + 1e-9) {
        cash += lotVal; realized += lotVal - lot.premium * lot.qty / 1000; remain -= lotVal;
      } else {
        const part = remain / Math.max(1e-9, lotVal);
        cash += remain; realized += remain - lot.premium * lot.qty * part / 1000;
        opts.push({ ...lot, qty: lot.qty * (1 - part) }); remain = 0;
      }
    });
    return { ...book, cash, realized, opts };
  }

  const held = book.pos[instrId] || 0;
  if (instr.kind === 'fut') {
    const notional = amountMln * (instr.lev || 1);
    const qty = notional * 1000 / price;
    const fees = notional * instr.fee;
    if (held === 0 || Math.sign(held) === dir) {           // открытие или наращивание
      const newQty = held + dir * qty;
      const prevAvg = book.avg[instrId] || price;
      return { ...book, cash: book.cash - fees, pos: { ...book.pos, [instrId]: newQty },
        avg: { ...book.avg, [instrId]: (prevAvg * Math.abs(held) + price * qty) / Math.max(1e-9, Math.abs(newQty)) } };
    }
    const closeQty = Math.min(Math.abs(held), qty);
    const pnl = Math.sign(held) * closeQty * (price - (book.avg[instrId] || price)) / 1000;
    const rest = Math.abs(held) - closeQty;
    return { ...book, cash: book.cash + pnl - fees, realized: book.realized + pnl,
      pos: { ...book.pos, [instrId]: Math.sign(held) * rest } };
  }

  // спот: покупка, продажа, короткая позиция
  const feeMul = side === 'buy' ? 1 + instr.fee : 1 - instr.fee;
  const qty = amountMln * 1000 / (price * feeMul);
  if (side === 'buy') {
    if (held < 0) {                                        // закрытие шорта
      const closeQty = Math.min(-held, qty);
      const pnl = closeQty * ((book.avg[instrId] || price) - price) / 1000;
      const rest = qty - closeQty;
      const newQty = held + closeQty + rest;
      const cash = book.cash - closeQty * price * feeMul / 1000 - rest * price * feeMul / 1000;
      return { ...book, cash, realized: book.realized + pnl,
        pos: { ...book.pos, [instrId]: newQty },
        avg: rest > 0 ? { ...book.avg, [instrId]: price } : book.avg };
    }
    const prevAvg = book.avg[instrId] || price;
    const newQty = held + qty;
    return { ...book, cash: book.cash - amountMln, pos: { ...book.pos, [instrId]: newQty },
      avg: { ...book.avg, [instrId]: (prevAvg * held + price * qty) / Math.max(1e-9, newQty) } };
  }
  if (held > 0) {                                          // продажа длинной позиции
    const sellQty = Math.min(held, qty);
    const proceeds = sellQty * price * feeMul / 1000;
    const pnl = sellQty * (price - (book.avg[instrId] || price)) / 1000;
    const rest = qty - sellQty;
    let nb = { ...book, cash: book.cash + proceeds, realized: book.realized + pnl,
      pos: { ...book.pos, [instrId]: held - sellQty } };
    if (rest > 0.0001) {                                   // остаток уходит в шорт
      nb = { ...nb, cash: nb.cash + rest * price * feeMul / 1000, pos: { ...nb.pos, [instrId]: -rest },
        avg: { ...nb.avg, [instrId]: price } };
    }
    return nb;
  }
  // открытие или наращивание шорта
  const prevAvg = book.avg[instrId] || price;
  const newQty = held - qty;
  return { ...book, cash: book.cash + amountMln, pos: { ...book.pos, [instrId]: newQty },
    avg: { ...book.avg, [instrId]: (prevAvg * Math.abs(held) + price * qty) / Math.max(1e-9, Math.abs(newQty)) } };
}

/* Закрытие квартала: экспирация опционов, плата за шорт и плечо, маржин-колл */
export function settleQuarter(book, economy) {
  const events = [];
  let b = { ...book, pos: { ...book.pos }, avg: { ...book.avg }, opts: [...(book.opts || [])] };
  // опционы: экспирация и списание временной стоимости
  const keep = [];
  b.opts.forEach((lot) => {
    const instr = INSTR_BY_ID[lot.instr];
    const S = priceOf(instr, economy, null);
    if (lot.left <= 1) {
      const payoff = (lot.type === 'call' ? Math.max(0, S - lot.strike) : Math.max(0, lot.strike - S)) * lot.qty / 1000;
      b.cash += payoff;
      b.realized += payoff - lot.premium * lot.qty / 1000;
      events.push({ kind: payoff > lot.premium * lot.qty / 1000 ? 'ok' : 'loss',
        text: `Опцион ${lot.type === 'call' ? 'call' : 'put'} со страйком ${lot.strike.toFixed(0)} исполнен: выплата ${fmtMln(payoff)} при уплаченной премии ${fmtMln(lot.premium * lot.qty / 1000)}.` });
    } else keep.push({ ...lot, left: lot.left - 1 });
  });
  b.opts = keep;
  // плата за короткие позиции и проценты по плечу
  let borrow = 0;
  INSTRUMENTS.forEach((i) => {
    const q = b.pos[i.id] || 0;
    if (i.kind === 'spot' && q < 0) borrow += -q * priceOf(i, economy, null) / 1000 * BORROW_FEE / 4;
  });
  const margin = b.cash < 0 ? -b.cash : 0;
  const interest = margin * economy.lendingRate / 400;
  b.cash -= borrow + interest;
  if (borrow > 0.005) events.push({ kind: 'info', text: `Плата за короткие позиции: ${fmtMln(borrow)} за квартал.` });
  // маржин-колл
  let lvl = marginLevel(b, economy, null);
  if (lvl < MAINTENANCE) {
    const parts = bookParts(b, economy, null);
    const eq = b.cash + parts.spot + parts.futPnl + parts.optVal;
    const targetGross = Math.max(0, eq / TARGET_MARGIN);
    const cut = clamp(1 - targetGross / Math.max(0.001, parts.gross), 0, 1);
    let closedValue = 0;
    INSTRUMENTS.forEach((i) => {
      const q = b.pos[i.id] || 0;
      if (!q) return;
      const pr = priceOf(i, economy, null);
      const closeQty = q * cut;
      closedValue += Math.abs(closeQty) * pr / 1000;
      if (i.kind === 'fut') {
        const pnl = closeQty * (pr - (b.avg[i.id] || pr)) / 1000;
        b.cash += pnl; b.realized += pnl;
      } else {
        const pnl = closeQty * (pr - (b.avg[i.id] || pr)) / 1000;
        b.cash += closeQty * pr / 1000 * (1 - 0.005);
        b.realized += pnl;
      }
      b.pos[i.id] = q - closeQty;
    });
    b.opts = b.opts.map((l) => ({ ...l, qty: l.qty * (1 - cut) }));
    b.marginCalls = (b.marginCalls || 0) + 1;
    events.push({ kind: 'call', text: `Маржин-колл: уровень обеспечения упал до ${(lvl * 100).toFixed(0)}% при минимуме ${MAINTENANCE * 100}%. Брокер принудительно закрыл ${(cut * 100).toFixed(0)}% позиций (${fmtMln(closedValue)}) по рынку со штрафом 0,5%.` });
    lvl = marginLevel(b, economy, null);
  }
  const val = bookValue(b, economy, null);
  if (val <= 0.05) {
    b = { ...emptyBook(), cash: Math.max(0.05, val), startValue: b.startValue, benchStart: b.benchStart,
      history: b.history, marginCalls: (b.marginCalls || 0) + 1 };
    events.push({ kind: 'call', text: 'Счёт обнулён: убытки съели весь капитал. Позиции закрыты, торговля начинается заново с тем, что осталось.' });
  }
  b.history = [...(b.history || []), bookValue(b, economy, null)].slice(-80);
  b.lastEvents = events;
  return b;
}

/* =========================================================================================
   КАЗИНО: отдельная вкладка для частного инвестора — рулетка, слоты, кости,
   блэкджек и бинарные опционы. Играет на тот же капитал портфеля (book.cash),
   выигрыш/проигрыш — через onResult(net), тем же путём, что и обычная сделка,
   поэтому сразу видны в общей стоимости портфеля и в сравнении с соперником.
========================================================================================= */
export const CasinoScreen = React.lazy(() => import('./casino.jsx').then((m) => ({ default: m.CasinoScreen })));

/* Панель ведомств для инвестора: только наблюдаемые факты и публичные заявления */
function InstitutionsPanel({ economy, cbAction, mofAction }) {
  const row = (l, v) => (
    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
      <span style={{ color: COLOR.muted }}>{l}</span><span className="ems-mono">{v}</span>
    </div>
  );
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Landmark size={13} />Что видно со стороны
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginBottom: 8 }}>
        Вы не в кабинете: намерений ведомств вам никто не сообщает. Есть только их решения, цифры и публичные заявления — по ним и приходится догадываться, что будет дальше.
      </div>
      <div style={{ fontSize: 12, color: COLOR.blue, marginBottom: 3 }}>Центральный банк</div>
      {row('Ключевая ставка', pctFmt(economy.keyRate))}
      {row('Объявленная цель по инфляции', pctFmt(economy.inflationTarget))}
      {row('Инфляция / ожидания', `${fmt1(economy.inflation)}% / ${fmt1(economy.inflationExpectations)}%`)}
      {row('Норматив капитала банков', pctFmt(economy.capitalRequirement))}
      <div style={{ fontSize: 12, color: COLOR.teal, margin: '8px 0 3px' }}>Минфин</div>
      {row('Баланс бюджета', `${fmtSigned1(economy.budgetBalancePctGdp)}% ВВП`)}
      {row('Госдолг', pctFmt(economy.debtToGdp))}
      {row('НДС / прибыль', `${fmt1(economy.vatRate)}% / ${fmt1(economy.profitTaxRate)}%`)}
      {[['Заявление ЦБ', cbAction], ['Заявление Минфина', mofAction]].map(([title, act]) => (act && act.quote ? (
        <div key={title} style={{ marginTop: 9, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.border}`, paddingLeft: 9, color: COLOR.muted }}>
          <span style={{ color: COLOR.faint }}>{title}: </span>«{act.quote}»
        </div>
      ) : null))}
    </div>
  );
}

/* ============================ МЕЖВЕДОМСТВЕННЫЕ ЗАПРОСЫ ============================ */
function RequestPanel({ role, botRole, pending, setPending, lastResponse }) {
  if (!botRole || botRole === 'both') return null;
  const options = REQUESTS.filter((r) => r.from === role && !r.presidentOnly && !r.retired);
  if (!options.length) return null;
  const cur = options.find((r) => r.id === pending);
  const target = botRole === 'central_bank' ? 'Центральному банку' : 'Минфину';
  return (
    <div className="ems-panel" style={{ padding: 13 }}>
      <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Megaphone size={13} />Официальный запрос {target}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <button type="button" className={`ems-tab ${!pending ? 'active' : ''}`} aria-pressed={!pending} style={{ fontSize: 12, padding: '3px 8px' }}
          onClick={() => { Audio.play('tick'); setPending(null); }}>без запроса</button>
        {options.map((r) => (
          <button type="button" key={r.id} className={`ems-tab ${pending === r.id ? 'active' : ''}`} aria-pressed={pending === r.id} style={{ fontSize: 12, padding: '3px 8px' }}
            onClick={() => { Audio.play('click'); setPending(r.id); }}>{r.label}</button>
        ))}
      </div>
      {cur && (
        <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.gold}`, paddingLeft: 9 }}>
          «{askText(cur, 1)}»
          <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 4 }}>Запрос уйдёт вместе с вашими решениями. Ответ зависит от характера ведомства и от того, насколько просьба соответствует ситуации.</div>
        </div>
      )}
      {lastResponse && (
        <div style={{ marginTop: 9, fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${lastResponse.status === 'accepted' ? COLOR.teal : lastResponse.status === 'partial' ? COLOR.gold : COLOR.rust}`, paddingLeft: 9 }}>
          <span style={{ color: lastResponse.status === 'accepted' ? COLOR.teal : lastResponse.status === 'partial' ? COLOR.gold : COLOR.rust, fontWeight: 600 }}>
            {lastResponse.status === 'accepted' ? 'Запрос удовлетворён: ' : lastResponse.status === 'partial' ? 'Частично удовлетворён: ' : 'Отказано: '}
          </span>
          <span style={{ color: COLOR.muted }}>{lastResponse.text}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ ПРЕДСТАВЛЕНИЕ И ДОСТУПНОСТЬ ============================ */
const DASHBOARD_PRESETS = [
  { id: 'overview', name: 'Обзор', pins: ['gdp', 'outputGap', 'inflation', 'unemployment', 'debtToGdp', 'approval'] },
  { id: 'prices', name: 'Цены и ставки', pins: ['inflation', 'inflationExpectations', 'cbCredibility', 'keyRate', 'lendingRate', 'rStar', 'wageGrowth'] },
  { id: 'budget', name: 'Бюджет', pins: ['budgetBalancePctGdp', 'debtToGdp', 'interestToRevenue', 'revenuePctGdp', 'shadowShare', 'sovereignFund'] },
  { id: 'market', name: 'Рынок', pins: ['stockIndex', 'bondIndex', 'yield10y', 'curveSlope', 'sovereignSpread', 'volatilityIndex'] },
  { id: 'crisis', name: 'Кризис', pins: ['bankNPL', 'bankCapitalAdequacy', 'bankingRisk', 'reserves', 'exchangeRate', 'unemployment'] },
];

/* Пользовательские наборы дашборда хранятся на устройстве (как достижения), а не
   только внутри конкретного сохранения — «Сохранить текущий набор» должен пережить
   и «Начать заново», и переход в другую партию. */
/* Настройка графика — категория, период и выключенные линии — тоже запоминается
   на устройстве. Раньше каждая новая партия (и каждое возвращение в меню) начиналась
   с «Выпуск» и всеми включёнными линиями, хотя человек уже настроил себе вид. */
const CHART_VIEW_KEY = 'ems-chart-view';

const loadChartView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CHART_VIEW_KEY) || '{}');
    return {
      group: typeof v.group === 'string' ? v.group : 'output',
      period: typeof v.period === 'string' ? v.period : '5y',
      hidden: Array.isArray(v.hidden) ? v.hidden.filter((x) => typeof x === 'string') : [],
    };
  } catch { return { group: 'output', period: '5y', hidden: [] }; }
};

const persistChartView = (v) => {
  try { localStorage.setItem(CHART_VIEW_KEY, JSON.stringify(v)); } catch { /* приватный режим */ }
};

/* Хук на три связанных значения: и в одиночной партии, и в сетевой — один и тот же
   вид графика, потому что настраивает его один и тот же человек. */
export function useChartView() {
  const init = React.useRef(null);
  if (!init.current) init.current = loadChartView();
  const [chartGroup, setChartGroup] = useState(init.current.group);
  const [period, setPeriod] = useState(init.current.period);
  const [hiddenSeries, setHiddenSeries] = useState(init.current.hidden);
  React.useEffect(() => { persistChartView({ group: chartGroup, period, hidden: hiddenSeries }); },
    [chartGroup, period, hiddenSeries]);
  return { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries };
}

const CUSTOM_DASHBOARDS_KEY = 'ems-custom-dashboards';

const HIDDEN_PRESETS_KEY = 'ems-hidden-dashboards';

const loadCustomDashboards = () => {
  try { const arr = JSON.parse(localStorage.getItem(CUSTOM_DASHBOARDS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};

const persistCustomDashboards = (list) => {
  try { localStorage.setItem(CUSTOM_DASHBOARDS_KEY, JSON.stringify(list)); } catch { /* приватный режим */ }
};

/* Свои наборы дашбордов лежат и в localStorage устройства, и — снимком на момент
   сохранения — в каждой партии. Без надгробного списка удалённый набор молча
   возвращался: загрузка более старой партии видела его в своём снимке, не
   находила среди актуальных (loadCustomDashboards уже без него) и решала, что
   это забытый набор из прошлого, который надо вернуть. */
const DELETED_CUSTOM_KEY = 'ems-deleted-dashboards';

const loadDeletedCustomIds = () => {
  try { const arr = JSON.parse(localStorage.getItem(DELETED_CUSTOM_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};

const persistDeletedCustomIds = (list) => {
  try { localStorage.setItem(DELETED_CUSTOM_KEY, JSON.stringify(list.slice(-200))); } catch { /* приватный режим */ }
};

/* Встроенные наборы («Обзор», «Цены и ставки»…) удалить насовсем нельзя — иначе
   их было бы не вернуть; вместо этого запоминаем, какие из них скрыты, и «Сбросить»
   возвращает список к заводскому виду. */
const PRESET_NAMES_KEY = 'ems-dashboard-names';

const loadHiddenPresets = () => {
  try { const arr = JSON.parse(localStorage.getItem(HIDDEN_PRESETS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};

const persistHiddenPresets = (list) => {
  try { localStorage.setItem(HIDDEN_PRESETS_KEY, JSON.stringify(list)); } catch { /* приватный режим */ }
};

const loadPresetNames = () => {
  try { const o = JSON.parse(localStorage.getItem(PRESET_NAMES_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
  catch { return {}; }
};

const persistPresetNames = (map) => {
  try { localStorage.setItem(PRESET_NAMES_KEY, JSON.stringify(map)); } catch { /* приватный режим */ }
};

// Сохранение может нести свои собственные наборы (например, сделанные до появления
// этой возможности) — подмешиваем их к общеустройственным и заодно закрепляем там же.
export function initDashboards(savedDashboards) {
  const stored = loadCustomDashboards();
  const deleted = loadDeletedCustomIds();
  const extra = (savedDashboards || []).filter((d) => d && d.custom
    && !stored.some((s) => s.id === d.id) && !deleted.includes(d.id));
  const merged = [...stored, ...extra];
  if (extra.length) persistCustomDashboards(merged);
  const hidden = loadHiddenPresets();
  const names = loadPresetNames();
  const presets = DASHBOARD_PRESETS.filter((d) => !hidden.includes(d.id))
    .map((d) => (names[d.id] ? { ...d, name: names[d.id] } : d));
  return [...presets, ...merged];
}

// «Сбросить» имеет смысл показывать, только если со встроенными наборами что-то
// сделали: убрали из списка или переименовали. Свои наборы кнопка не трогает.
const presetsAreDefault = (list) => DASHBOARD_PRESETS.every((p) => list.some((d) => d.id === p.id && d.name === p.name));

/* Что закреплено на верхней полосе и какой набор выбран — это тоже настройка вида,
   а не часть партии: раньше она жила только в памяти вкладки, и любое изменение
   пропадало, если его не сохранить кнопкой отдельным набором. */
const PINS_KEY = 'ems-pins';

const loadPinView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PINS_KEY) || '{}');
    const pins = Array.isArray(v.pinned) ? v.pinned.filter((k) => typeof k === 'string' && ALL_METRICS[k]) : [];
    return { pinned: pins.length ? pins.slice(0, MAX_PINS) : null,
      activeDash: typeof v.activeDash === 'string' ? v.activeDash : null };
  } catch { return { pinned: null, activeDash: null }; }
};

const persistPinView = (pinned, activeDash) => {
  try { localStorage.setItem(PINS_KEY, JSON.stringify({ pinned, activeDash })); } catch { /* приватный режим */ }
};

/* Закреплённые показатели: своя память на устройстве, плюс автосохранение в свой
   набор, если сейчас выбран именно он. Партия, загруженная из сохранения, важнее:
   в ней полоса была своя. */
export function usePinnedStrip(initialPins, initialDash, dashActions) {
  const saved = React.useRef(null);
  if (!saved.current) saved.current = loadPinView();
  const [activeDash, setActiveDash] = useState(initialDash || saved.current.activeDash || 'overview');
  const [pinned, setPinned] = useState(initialPins || saved.current.pinned || DEFAULT_PINS);
  React.useEffect(() => {
    persistPinView(pinned, activeDash);
    dashActions.syncActive(activeDash, pinned);
    // dashActions пересоздаётся каждый рендер — в зависимостях ему делать нечего
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, activeDash]);
  return { pinned, setPinned, activeDash, setActiveDash };
}

/* Ширина и порядок трёх столбцов панели («Решения»/«Новости и графики»/«Показатели») —
   настройка устройства, общая для одиночной и сетевой партии. Ниже 1241px CSS сама
   переводит сетку в адаптивный режим (см. .ems-grid) — там своя ширина и порядок не
   к месту, поэтому в этом диапазоне хук отдаёт исходный порядок и не трогает шаблон. */
export function useLayoutColumns() {
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [columnOrder, setColumnOrderState] = useState(() => loadColumnOrder());
  const [columnWidths, setColumnWidthsState] = useState(() => loadColumnWidths());
  const [wide, setWide] = useState(true);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1241px)');
    const upd = () => setWide(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const moveColumn = (id, dir) => setColumnOrderState((prev) => {
    const idx = prev.indexOf(id); const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev]; [next[idx], next[j]] = [next[j], next[idx]];
    persistColumnOrder(next);
    return next;
  });
  const setColumnWidthsLive = (w) => setColumnWidthsState(w);
  const commitWidths = (w) => { setColumnWidthsState(w); persistColumnWidths(w); };
  const resetLayout = () => {
    setColumnOrderState([...DEFAULT_COLUMN_ORDER]);
    setColumnWidthsState({ ...DEFAULT_COLUMN_WIDTHS });
    persistColumnOrder([...DEFAULT_COLUMN_ORDER]);
    persistColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
  };
  return { layoutEditMode, setLayoutEditMode, columnOrder, columnWidths, wide, moveColumn,
    setColumnWidthsLive, commitWidths, resetLayout, layoutIsDefaultNow: layoutIsDefault(columnOrder, columnWidths) };
}

/* Действия над наборами одинаковы в соло- и сетевом экране, а правила хранения
   нетривиальны (свои наборы лежат целиком, у встроенных хранятся только отличия) —
   поэтому логика одна на оба экрана, а не две расходящиеся копии. */
export function makeDashboardActions(setDashboards) {
  const syncCustom = (next) => { persistCustomDashboards(next.filter((d) => d.custom)); return next; };
  return {
    saveDash: (pins, setActive) => {
      const id = `custom${Date.now()}`;
      setDashboards((ds) => {
        const name = `Мой набор ${ds.filter((d) => d.custom).length + 1}`;
        return syncCustom([...ds, { id, name, pins: [...pins], custom: true }]);
      });
      setActive(id);
    },
    /* Правка полосы при выбранном своём наборе пишется прямо в него: отдельная
       кнопка «сохранить» для этого не нужна — набор и есть то, что сейчас на
       экране. Встроенные наборы так не меняются: их правят «поверх», а вернуть
       исходный вид можно кнопкой сброса. */
    syncActive: (id, pins) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (!target || !target.custom) return ds;
      if (target.pins.length === pins.length && target.pins.every((k, i) => k === pins[i])) return ds;
      return syncCustom(ds.map((d) => (d.id === id ? { ...d, pins: [...pins] } : d)));
    }),
    deleteDash: (id) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (target && !target.custom) persistHiddenPresets([...loadHiddenPresets().filter((x) => x !== id), id]);
      // надгробие нужно только своим наборам: встроенные и так не возвращаются
      // из старых партий (initDashboards пересобирает их заново из HIDDEN_PRESETS_KEY)
      if (target && target.custom) persistDeletedCustomIds([...loadDeletedCustomIds().filter((x) => x !== id), id]);
      return syncCustom(ds.filter((d) => d.id !== id));
    }),
    renameDash: (id) => setDashboards((ds) => {
      const target = ds.find((d) => d.id === id);
      if (!target) return ds;
      const raw = window.prompt('Новое название набора', target.name);
      if (raw === null) return ds;
      const name = raw.trim().slice(0, 28);
      if (!name || name === target.name) return ds;
      if (!target.custom) persistPresetNames({ ...loadPresetNames(), [id]: name });
      return syncCustom(ds.map((d) => (d.id === id ? { ...d, name } : d)));
    }),
    resetDash: () => setDashboards((ds) => {
      persistHiddenPresets([]); persistPresetNames({});
      return [...DASHBOARD_PRESETS, ...ds.filter((d) => d.custom)];
    }),
  };
}

export const haptic = (pattern) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch { /* не поддерживается */ } };

/* Макет трёх столбцов панели («Решения» / «Новости и графики» / «Показатели») —
   какой из них слева, в центре, справа, и насколько широки крайние. Устройство,
   а не партия: хранится напрямую в localStorage, как тема, а не в сохранении игры. */
const LAYOUT_ORDER_KEY = 'ems-layout-order';

const LAYOUT_WIDTHS_KEY = 'ems-layout-widths';

export const DEFAULT_COLUMN_ORDER = ['left', 'center', 'right'];

const DEFAULT_COLUMN_WIDTHS = { left: 300, right: 300 };

const COLUMN_LABELS = { left: 'Решения', center: 'Новости и графики', right: 'Показатели' };

const loadColumnOrder = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(LAYOUT_ORDER_KEY) || 'null');
    if (Array.isArray(arr) && arr.length === 3 && ['left', 'center', 'right'].every((k) => arr.includes(k))) return arr;
  } catch { /* приватный режим */ }
  return [...DEFAULT_COLUMN_ORDER];
};

const persistColumnOrder = (order) => { try { localStorage.setItem(LAYOUT_ORDER_KEY, JSON.stringify(order)); } catch { /* приватный режим */ } };

const loadColumnWidths = () => {
  try {
    const o = JSON.parse(localStorage.getItem(LAYOUT_WIDTHS_KEY) || 'null');
    if (o && Number.isFinite(o.left) && Number.isFinite(o.right)) return { left: clamp(o.left, 220, 520), right: clamp(o.right, 220, 520) };
  } catch { /* приватный режим */ }
  return { ...DEFAULT_COLUMN_WIDTHS };
};

const persistColumnWidths = (w) => { try { localStorage.setItem(LAYOUT_WIDTHS_KEY, JSON.stringify(w)); } catch { /* приватный режим */ } };

const layoutIsDefault = (order, widths) => DEFAULT_COLUMN_ORDER.every((v, i) => order[i] === v)
  && widths.left === DEFAULT_COLUMN_WIDTHS.left && widths.right === DEFAULT_COLUMN_WIDTHS.right;

/* Перетаскиваемая граница между двумя столбцами: «резиновый» (center, 1fr) сосед
   ширину не хранит — тянется тот, у кого она вообще есть. Если по обе стороны
   от границы стоят два фиксированных столбца (после перестановки), двигаются оба
   разом, как в обычном сплиттере. */
export function ColumnResizeHandle({ leftId, rightId, widths, onResize, onCommit }) {
  const dragRef = React.useRef(null);
  const onPointerDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidths: { ...widths } };
    const move = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const next = { ...dragRef.current.startWidths };
      if (leftId !== 'center') next[leftId] = clamp(dragRef.current.startWidths[leftId] + dx, 220, 520);
      if (rightId !== 'center') next[rightId] = clamp(dragRef.current.startWidths[rightId] - dx, 220, 520);
      dragRef.current.last = next;
      onResize(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragRef.current && dragRef.current.last) onCommit(dragRef.current.last);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div onPointerDown={onPointerDown} title="Потяните, чтобы изменить ширину столбцов"
      style={{ position: 'absolute', top: 0, bottom: 0, right: -11, width: 14, cursor: 'col-resize', zIndex: 5 }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 6, width: 2, borderRadius: 1,
        background: COLOR.gold, opacity: 0.55 }} />
    </div>
  );
}

export function ViewSettings({ theme, setTheme, dense, setDense, dashboards, activeDash, applyDash, saveDash, deleteDash, renameDash, resetDash,
  layoutEditMode, setLayoutEditMode, columnOrder, moveColumn, resetLayout, layoutIsDefaultNow, autoPaper, setAutoPaper }) {
  const DD_WIDTH = 250;
  const { open, setOpen, toggle, btnRef, pos } = useExclusiveDropdown(DD_WIDTH);
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className="ems-btn" style={{ padding: '7px 9px' }} title="Вид, тема и доступность" aria-label="Настройки вида"
        onClick={() => { Audio.play('click'); toggle(); }}>
        <Sliders size={14} />
      </button>
      {open && (
        <div className="ems-panel-raised ems-fade-in" style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: DD_WIDTH, padding: 13, zIndex: 60, maxHeight: pos.maxHeight, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft }}>Тема оформления</span>
            <button className="ems-btn" style={{ marginLeft: 'auto', padding: '3px 5px', lineHeight: 0 }} aria-label="Закрыть"
              onClick={() => { Audio.play('click'); setOpen(false); }}><X size={12} /></button>
          </div>
          {Object.values(THEMES).map((t) => (
            <button key={t.id} className="ems-btn" style={{ width: '100%', textAlign: 'left', padding: '6px 9px', fontSize: 12, marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 7,
              background: theme === t.id ? COLOR.sel : COLOR.panelAlt, color: theme === t.id ? COLOR.selText : COLOR.text,
              borderColor: theme === t.id ? COLOR.selBorder : COLOR.border }}
              onClick={() => { Audio.play('tab'); setTheme(t.id); }}>
              <span className="ems-theme-dot" style={{ background: t.colors.gold }} />
              {t.name}{t.id === 'contrast' ? ' · доступность' : ''}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 12, color: dense ? COLOR.text : COLOR.muted, flex: 1 }}>Только цифры</span>
            <button className="ems-btn" style={{ padding: '2px 9px', fontSize: 12, background: dense ? COLOR.sel : COLOR.panelAlt, color: dense ? COLOR.selText : COLOR.muted, borderColor: dense ? COLOR.selBorder : COLOR.border }}
              onClick={() => { Audio.play('tick'); setDense(!dense); }}>{dense ? 'вкл' : 'выкл'}</button>
          </div>
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.4, marginBottom: 10 }}>
            Скрывает графики, шкалы и декоративные слои — остаются только таблицы и текст.
          </div>
          {setAutoPaper && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: autoPaper ? COLOR.text : COLOR.muted, flex: 1 }}>Газета сама открывается</span>
                <button className="ems-btn" style={{ padding: '2px 9px', fontSize: 12, background: autoPaper ? COLOR.sel : COLOR.panelAlt, color: autoPaper ? COLOR.selText : COLOR.muted, borderColor: autoPaper ? COLOR.selBorder : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setAutoPaper(!autoPaper); }}>{autoPaper ? 'вкл' : 'выкл'}</button>
              </div>
              <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.4, marginBottom: 10 }}>
                При включении «Газета и хроника» открывается сама после каждого нового квартала — не нужно нажимать кнопку.
              </div>
            </>
          )}
          <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, marginBottom: 6 }}>Дашборды</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 7 }}>
            {dashboards.map((d) => (
              <div key={d.id} className="ems-row-hover"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 7px', borderRadius: 4,
                  background: activeDash === d.id ? COLOR.goldDim : 'transparent',
                  borderLeft: `2px solid ${activeDash === d.id ? COLOR.gold : 'transparent'}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, cursor: 'pointer', color: activeDash === d.id ? COLOR.text : COLOR.muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { Audio.play('tab'); applyDash(d.id); }}>{d.name}</span>
                <button className="ems-btn" title="Переименовать набор" aria-label={`Переименовать ${d.name}`}
                  style={{ padding: '1px 5px', fontSize: 12, lineHeight: 1.5, color: COLOR.faint }}
                  onClick={() => { Audio.play('tick'); renameDash(d.id); }}>✎</button>
                <button className="ems-btn" title={d.custom ? 'Удалить набор' : 'Убрать встроенный набор из списка'}
                  aria-label={`Убрать ${d.name}`}
                  style={{ padding: '1px 5px', fontSize: 12, lineHeight: 1.5, color: COLOR.faint }}
                  onClick={() => { Audio.play('tick'); deleteDash(d.id); }}>×</button>
              </div>
            ))}
            {dashboards.length === 0 && (
              <div style={{ fontSize: 12, color: COLOR.faint, padding: '4px 0' }}>Все наборы убраны — сохраните свой или сбросьте список.</div>
            )}
          </div>
          <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 12 }}
            onClick={() => { Audio.play('stamp'); saveDash(); }}>Сохранить текущий набор</button>
          {!presetsAreDefault(dashboards) && (
            <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 12, marginTop: 4, color: COLOR.rust, borderColor: COLOR.rust }}
              onClick={() => { Audio.play('click'); resetDash(); }}>Вернуть встроенные наборы</button>
          )}
          <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.4, marginTop: 6 }}>
            Свои наборы хранятся на этом устройстве и доступны во всех партиях, а не только в текущей.
            Встроенные наборы можно убрать из списка и переименовать — «Сбросить» вернёт их обратно.
          </div>
          {moveColumn && (
            <>
              <div className="ems-serif" style={{ fontSize: 13, color: COLOR.goldSoft, margin: '12px 0 6px' }}>Макет столбцов</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: layoutEditMode ? COLOR.text : COLOR.muted, flex: 1 }}>Растягивание столбцов</span>
                <button className="ems-btn" aria-label="Переключить растягивание столбцов" style={{ padding: '2px 9px', fontSize: 12, background: layoutEditMode ? COLOR.sel : COLOR.panelAlt, color: layoutEditMode ? COLOR.selText : COLOR.muted, borderColor: layoutEditMode ? COLOR.selBorder : COLOR.border }}
                  onClick={() => { Audio.play('tick'); setLayoutEditMode(!layoutEditMode); }}>{layoutEditMode ? 'вкл' : 'выкл'}</button>
              </div>
              <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.4, marginBottom: 9 }}>
                Включите и потяните за границу между столбцами панели — ширина запомнится. Выключение прячет
                рамки для перетаскивания, но не сбрасывает уже подобранную ширину.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 7 }}>
                {columnOrder.map((id, i) => (
                  <div key={id} className="ems-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 7px', borderRadius: 4 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: COLOR.muted }}>{COLUMN_LABELS[id]}</span>
                    <button className="ems-btn" title="Сдвинуть влево" aria-label={`Сдвинуть «${COLUMN_LABELS[id]}» влево`}
                      disabled={i === 0} style={{ padding: '1px 6px', fontSize: 12, lineHeight: 1.5, color: i === 0 ? COLOR.faint : COLOR.text }}
                      onClick={() => { Audio.play('tick'); moveColumn(id, -1); }}>◀</button>
                    <button className="ems-btn" title="Сдвинуть вправо" aria-label={`Сдвинуть «${COLUMN_LABELS[id]}» вправо`}
                      disabled={i === columnOrder.length - 1} style={{ padding: '1px 6px', fontSize: 12, lineHeight: 1.5, color: i === columnOrder.length - 1 ? COLOR.faint : COLOR.text }}
                      onClick={() => { Audio.play('tick'); moveColumn(id, 1); }}>▶</button>
                  </div>
                ))}
              </div>
              {!layoutIsDefaultNow && (
                <button className="ems-btn" style={{ width: '100%', padding: '5px 0', fontSize: 12, color: COLOR.rust, borderColor: COLOR.rust }}
                  onClick={() => { Audio.play('click'); resetLayout(); }}>Сбросить макет столбцов</button>
              )}
              <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.4, marginTop: 6 }}>
                Порядок и ширина столбцов — на широком экране (шире 1240px); на узком панель уже адаптивна.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
   СЕТЕВАЯ ИГРА: лобби (создать/войти) и экран партии, синхронизированный с сервером.
   Сервер (api/room.js) считает квартал, когда решения прислали оба места; здесь — только
   отображение состояния комнаты и отправка своих решений.
========================================================================================= */
const NETWORK_SEATS = ['central_bank', 'ministry_finance', 'president'];

const TRADER_SEATS = ['trader1', 'trader2'];

export const seatsForMode = (mode) => (mode === 'trader' ? TRADER_SEATS : NETWORK_SEATS);

// сохраняем/обновляем сессию в слотах: та же комната+место обновляет свой слот,
// иначе — в первый свободный, а если все заняты — вытесняем самый старый (LRU)
export const saveNetworkSlot = (net) => {
  const slots = loadNetworkSlots();
  const entry = { id: net.id, seat: net.seat, token: net.token, ownerToken: net.ownerToken || null, savedAt: Date.now() };
  let idx = slots.findIndex((s) => s && s.id === net.id && s.seat === net.seat);
  if (idx === -1) idx = slots.findIndex((s) => !s);
  if (idx === -1) {
    idx = 0;
    slots.forEach((s, i) => { if ((s ? s.savedAt : -Infinity) < (slots[idx] ? slots[idx].savedAt : -Infinity)) idx = i; });
  }
  slots[idx] = entry;
  writeNetworkSlots(slots);
};

export const clearNetworkSlotFor = (id, seat) => writeNetworkSlots(loadNetworkSlots().map((s) => ((s && s.id === id && s.seat === seat) ? null : s)));

// портфель трейдера в сетевой «рыночной» комнате — целиком на клиенте: сделки
// одного трейдера никак не задевают другого (независимые позиции на одной и той
// же экономике), поэтому синхронизировать их через сервер незачем — только
// экономика (котировки/квартал) общая и приходит через room. Ключ на комнату+
// место, чтобы каждое место партии имело свой портфель и он пережил обновление
// страницы.
const netPortfolioKey = (id, seat) => `ems-net-portfolio:${id}:${seat}`;

export const loadNetworkPortfolio = (id, seat) => {
  try {
    const raw = JSON.parse(localStorage.getItem(netPortfolioKey(id, seat)) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch { return null; }
};

export const saveNetworkPortfolio = (id, seat, book) => {
  try { localStorage.setItem(netPortfolioKey(id, seat), JSON.stringify(book)); }
  catch { /* приватный режим/квота — не критично, портфель просто не переживёт обновление */ }
};

/* ============================ ТАБЛИЦЫ ПОКАЗАТЕЛЕЙ ============================ */
const idx0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');

// в узкой строке показателя полные названия реформ не помещаются
const REFORM_SHORT = { labor: 'труд', pension: 'пенсии', courts: 'суды', deregulation: 'дерегулирование', education: 'образование' };

export const INDICATOR_TABS = [
  { id: 'economy', label: 'Выпуск', icon: TrendingUp, rows: [
    { key: 'gdp', label: 'ВВП (реальный)', fmt: fmtMoney },
    { key: 'gdpGrowth', label: 'Темп роста ВВП', fmt: fmtSignedPct },
    { key: 'potentialGdp', label: 'Потенциальный ВВП', fmt: fmtMoney },
    { key: 'potentialGrowth', label: 'Рост потенциала', fmt: fmtSignedPct },
    { key: 'outputGap', label: 'Разрыв выпуска', fmt: fmtSignedPct,
      hint: 'Насколько ВВП отклонился от потенциального. Отрицательный — экономика недогружена, безработица выше нормы. Положительный — перегрев, риск ускорения инфляции.' },
    { key: 'gdpPerCapita', label: 'ВВП на душу населения', fmt: (v) => `${Math.round(v).toLocaleString('ru-RU')} у.е.` },
    { key: 'consumption', label: 'Потребление', fmt: fmtMoney },
    { key: 'businessInvestment', label: 'Инвестиции бизнеса', fmt: fmtMoney },
    { key: 'fiscalImpulse', label: 'Бюджетный импульс', fmt: (v) => `${fmtSigned1(v)} п.п.`,
      hint: 'Изменение бюджетного стимула за квартал. Положительный — бюджет разгоняет спрос сверх прошлого квартала, отрицательный — сдерживает.' },
  ] },
  { id: 'prices', label: 'Цены', icon: Coins, rows: [
    { key: 'inflation', label: 'Инфляция (ИПЦ)', fmt: pctFmt },
    { key: 'coreInflation', label: 'Базовая инфляция', fmt: pctFmt },
    { key: 'inflationExpectations', label: 'Инфляционные ожидания', fmt: pctFmt },
    { key: 'cbCredibility', label: 'Доверие к ЦБ', fmt: idx0,
      hint: 'Растёт медленно, кварталами, когда инфляция держится у цели, а решения соответствуют ситуации. Падает от смены цели, экстренной эмиссии, крупных QE и любого отклонения инфляции от цели.' },
    { key: 'stabilizationCred', label: 'Доверие к стабилизации', fmt: (v) => (v > 0 ? `${Math.round(v * 100)} из 100` : '—'),
      hint: 'Включается при инфляции выше цели на 8 п.п. Копится, пока реальная ставка не ниже 3 п.п., ЦБ не печатает деньги, а дефицит бюджета не больше 3% ВВП (или сокращается); управляемый курс при достаточных резервах ускоряет. Одна ставка без бюджета копит доверие втрое медленнее, ослабление денег раньше времени обрушивает его сразу. Чем выше доверие, тем быстрее падают ожидания и тем мягче рецессия.' },
    { key: 'importPriceInflation', label: 'Инфляция цен импорта', fmt: pctFmt },
    { key: 'unitLaborCostGrowth', label: 'Удельные издержки труда', fmt: fmtSignedPct },
    { key: 'moneySupply', label: 'Денежная масса (индекс)', fmt: fmt1 },
  ] },
  { id: 'money', label: 'Ставки', icon: Banknote, rows: [
    // ставка ходит шагом 0.25 п.п.: округление до десятых схлопывает соседние
    // значения (8.75% и 9.0% выглядели бы одинаково как «8.8%» и «9.0%» —
    // то есть разный шаг казался бы одинаковым или вовсе пропадал)
    { key: 'keyRate', label: 'Ключевая ставка', fmt: (v) => `${fmt2(v)}%` },
    { key: 'lendingRate', label: 'Ставка по кредитам', fmt: pctFmt },
    { key: 'depositRate', label: 'Ставка по депозитам', fmt: pctFmt },
    { key: 'realLendingRate', label: 'Реальная ставка по кредитам', fmt: pctFmt },
    { key: 'rStar', label: 'Нейтральная реальная ставка r*', fmt: pctFmt,
      hint: 'Условный уровень реальной ставки, при котором экономика растёт ровно на потенциал — не разгоняясь и не тормозя. Ориентир для сравнения, а не рычаг.' },
    { key: 'rateGap', label: 'Жёсткость условий', fmt: (v) => `${fmtSigned1(v)} п.п.`,
      hint: 'Факт минус нейтраль: насколько фактическая ставка жёстче или мягче нейтральной r*. Положительный — политика сдерживает экономику, отрицательный — стимулирует.' },
    { key: 'riskPremium', label: 'Премия за риск страны', fmt: pctFmt,
      hint: 'Надбавка к стоимости займов, которую требуют кредиторы за риск. Растёт от высокого долга, дефолтов и политической нестабильности — удорожает займы не только государству, но и бизнесу.' },
  ] },
  { id: 'banking', label: 'Банки', icon: ShieldAlert, rows: [
    { key: 'creditVolume', label: 'Кредитный портфель', fmt: fmtMoney },
    { key: 'creditGrowth', label: 'Рост кредитования', fmt: fmtSignedPct },
    { key: 'creditGap', label: 'Кредитный разрыв (бум/сжатие)', fmt: (v) => `${fmtSigned1(v)} п.п. ВВП`,
      hint: 'Объём кредита относительно долгосрочного тренда. Сильно положительный — кредитный бум и риск пузыря, отрицательный — сжатие кредитования.' },
    { key: 'bankNPL', label: 'Просроченные кредиты', fmt: pctFmt },
    { key: 'bankCapital', label: 'Капитал банков', fmt: fmtMoney },
    { key: 'bankCapitalAdequacy', label: 'Достаточность капитала', fmt: pctFmt },
    // норматив задаётся рычагом, но смотреть на него игроку тоже нужно: рядом с
    // фактической достаточностью видно, есть ли у банков запас над требованием
    { key: 'capitalRequirement', label: 'Норматив достаточности', fmt: pctFmt, noDelta: true },
    { key: 'bankProfit', label: 'Прибыль банков за квартал', fmt: fmtMoneySigned },
    { key: 'bankLiquidity', label: 'Ликвидность банков', fmt: idx0 },
    { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
  ] },
  { id: 'government', label: 'Бюджет', icon: Landmark, rows: [
    { key: 'govRevenue', label: 'Доходы бюджета', fmt: fmtMoney },
    { key: 'revenuePctGdp', label: 'Доходы к ВВП', fmt: pctFmt },
    { key: 'govSpendingTotal', label: 'Расходы бюджета', fmt: fmtMoney },
    { key: 'interestPayment', label: 'Обслуживание долга', fmt: fmtMoney },
    { key: 'interestToRevenue', label: 'Обслуживание к доходам', fmt: pctFmt },
    { key: 'budgetBalancePctGdp', label: 'Баланс бюджета', fmt: (v) => `${fmtSignedPct(v)} ВВП` },
    { key: 'structuralBalancePctGdp', label: 'Структурный баланс', fmt: (v) => `${fmtSignedPct(v)} ВВП`,
      hint: 'Баланс бюджета, очищенный от влияния экономического цикла. Показывает, дефицитна ли бюджетная политика сама по себе, а не только из-за текущего спада или подъёма.' },
    { key: 'govDebt', label: 'Государственный долг', fmt: fmtMoney },
    { key: 'debtToGdp', label: 'Долг к ВВП', fmt: pctFmt },
    { key: 'effectiveDebtRate', label: 'Средняя ставка по долгу', fmt: pctFmt,
      hint: 'Средняя ставка по уже выпущенному долгу целиком, а не по новым займам. Меняется медленно — только по мере того, как старые выпуски гасятся и замещаются новыми по текущей ставке.' },
    { key: 'sovereignFund', label: 'Суверенный фонд', fmt: fmtMoney,
      hint: 'Профицит бюджета сначала гасит госдолг, а после того как долг обнулился, идёт сюда, а не исчезает. Фонд, в свою очередь, приносит доход в бюджет. Дефицит сначала тратит фонд и только потом занимает.' },
    { key: 'shadowShare', label: 'Теневая экономика', fmt: pctFmt,
      hint: 'Доля экономики вне налогообложения. Растёт вместе с налоговой нагрузкой, снижается при её облегчении.' },
  ] },
  { id: 'labor', label: 'Труд', icon: Users, rows: [
    { key: 'unemployment', label: 'Безработица', fmt: pctFmt },
    { key: 'nairu', label: 'Естественный уровень безработицы', fmt: pctFmt },
    { key: 'tightness', label: 'Напряжённость рынка труда', fmt: (v) => `${fmtSigned1(v)} п.п.` },
    { key: 'vacancyRate', label: 'Доля вакансий', fmt: pctFmt },
    { key: 'wageGrowth', label: 'Рост зарплат', fmt: fmtSignedPct },
    { key: 'employment', label: 'Занятость', fmt: pctFmt },
  ] },
  { id: 'external', label: 'Внешний сектор', icon: Globe2, rows: [
    { key: 'exports', label: 'Экспорт', fmt: fmtMoney },
    { key: 'imports', label: 'Импорт', fmt: fmtMoney },
    { key: 'currentAccount', label: 'Счёт текущих операций', fmt: fmtMoneySigned },
    { key: 'netCapitalFlow', label: 'Чистый приток капитала', fmt: fmtMoneySigned },
    { key: 'reserves', label: 'Золотовалютные резервы', fmt: fmtMoney },
    { key: 'exchangeRate', label: 'Курс (выше = слабее)', fmt: fmt1 },
    { key: 'realExchangeRate', label: 'Реальный курс', fmt: fmt1 },
    { key: 'fdi', label: 'Прямые иностранные инвестиции', fmt: fmtMoneySigned },
    { key: 'worldGdpGrowth', label: 'Рост мировой экономики', fmt: fmtSignedPct },
  ] },
  { id: 'potential', label: 'Потенциал', icon: Factory, rows: [
    { key: 'productivity', label: 'Производительность (TFP)', fmt: fmt1 },
    { key: 'tfpGrowth', label: 'Рост производительности', fmt: fmtSignedPct },
    { key: 'humanCapitalIndex', label: 'Человеческий капитал', fmt: fmt1 },
    { key: 'infrastructureIndex', label: 'Инфраструктура', fmt: fmt1 },
    { key: 'capitalStock', label: 'Основной капитал', fmt: fmtMoney },
    { key: 'supplyScar', label: 'Шрамы предложения', fmt: (v) => `${fmtSigned1(v)}%`,
      hint: 'Постоянная потеря потенциального выпуска от прошлых кризисов. Сама не восстанавливается — только через рост инвестиций и производительности.' },
  ] },
  { id: 'market', label: 'Рынок', icon: TrendingUp, rows: [
    { key: 'stockIndex', label: 'Индекс акций', fmt: fmt1 },
    { key: 'marketCapPctGdp', label: 'Капитализация к ВВП', fmt: pctFmt },
    { key: 'stockPE', label: 'P/E рынка', fmt: fmt1 },
    { key: 'equityRiskPremium', label: 'Премия за риск акций', fmt: pctFmt },
    { key: 'bondIndex', label: 'Индекс облигаций', fmt: fmt1 },
    { key: 'yield2y', label: 'Доходность 2 года', fmt: pctFmt },
    { key: 'yield10y', label: 'Доходность 10 лет', fmt: pctFmt },
    { key: 'curveSlope', label: 'Наклон кривой', fmt: (v) => `${fmtSigned1(v)} п.п.`,
      hint: 'Разница доходностей 10 лет и 2 года. Инверсия (отрицательное значение) — рынок закладывает будущую рецессию.' },
    { key: 'sovereignSpread', label: 'Суверенный спред', fmt: (v) => `${Math.round(v)} б.п.`,
      hint: 'Надбавка в базисных пунктах, которую государство платит сверх безрискового уровня за заём. Индикатор доверия рынка к платёжеспособности страны.' },
    { key: 'corporateSpread', label: 'Корпоративный спред', fmt: (v) => `${Math.round(v)} б.п.`,
      hint: 'То же самое для бизнеса: надбавка сверх безрискового уровня, которую компании платят по своим облигациям.' },
    { key: 'volatilityIndex', label: 'Индекс страха', fmt: fmt1 },
    { key: 'bankPB', label: 'Банки: цена к капиталу', fmt: fmt2 },
    { key: 'bankROE', label: 'Банки: рентабельность', fmt: pctFmt },
    { key: 'netInterestMargin', label: 'Процентная маржа', fmt: (v) => `${fmt2(v)} п.п.` },
    { key: 'fxVolatility', label: 'Волатильность курса', fmt: fmt1 },
  ] },
  { id: 'politics', label: 'Политика', icon: Flag, rows: [
    { key: 'approval', label: 'Рейтинг власти', fmt: (v) => v.toFixed(0) },
    { key: 'quartersToElection', label: 'Кварталов до выборов', fmt: (v) => v.toFixed(0), noDelta: true },
    { key: 'term', label: 'Срок правительства', fmt: (v) => `${v}-й` },
    { key: 'govTrust', label: 'Доверие к правительству', fmt: (v) => v.toFixed(0),
      hint: 'Отдельно от рейтинга власти: реакция на последовательность и предсказуемость курса, а не на сиюминутные успехи или неудачи.' },
    { key: 'policyCoordination', label: 'Согласованность политики', fmt: (v) => v.toFixed(0),
      hint: 'Насколько решения ЦБ и Минфина тянут экономику в одну сторону, а не работают друг против друга — например, бюджетный стимул при ужесточении ставки его гасит.' },
    { label: 'Мандат власти', get: (e) => e.mandate, text: true, map: MANDATE_LABEL },
    { label: 'Линия правительства', get: (e) => e.governmentLine, text: true, map: { centrist: 'центристская', populist: 'популистская', austerity: 'консервативная', technocrat: 'технократическая' } },
    { label: 'Политический режим', get: (e) => e.politicalRegime, text: true,
      map: Object.fromEntries(Object.entries(POLITICAL_REGIME_INFO).map(([id, info]) => [id, info.label])) },
    { key: 'politicalTension', label: 'Политическое напряжение', fmt: (v) => v.toFixed(0) },
    { key: 'crisisMandateLeft', label: 'Мандат спасения', fmt: (v) => (v > 0 ? `ещё ${v} кв.` : '—'),
      hint: 'Кредит доверия правительству национального спасения — есть только в сценарии «Гиперинфляция». Пока он действует, рейтинг держится выше, а напряжение ниже, чем говорит экономика. Полную силу даёт, только пока стабилизационная программа работает; при бездействии — треть силы и сгорает вдвое быстрее.' },
    { label: 'Беспорядки в стране', get: (e) => !!e.unrestActive, text: true, map: { true: 'да', false: 'нет' } },
    { label: 'Парламент', get: (e) => !!e.parliamentDissolved, text: true, map: { true: 'распущен', false: 'работает' } },
    { key: 'politicalCapital', label: 'Политический капитал', fmt: (v) => v.toFixed(0) },
    { key: 'cbTenure', label: 'Глава ЦБ в должности, кв.', fmt: (v) => v.toFixed(0), noDelta: true },
    { key: 'mofTenure', label: 'Министр финансов в должности, кв.', fmt: (v) => v.toFixed(0), noDelta: true },
    { label: 'Проведённые реформы', text: true,
      get: (e) => {
        const ids = Object.keys(e.reforms || {});
        if (!ids.length) return 'нет';
        return ids.map((id) => `${REFORM_SHORT[id] || id} ${Math.round(reformShare(e.reforms, id) * 100)}%`).join(', ');
      } },
  ] },
  { id: 'risks', label: 'Риски', icon: AlertTriangle, rows: [
    { key: 'inflationRisk', label: 'Инфляционный риск', fmt: idx0 },
    { key: 'bankingRisk', label: 'Банковский риск', fmt: idx0 },
    { key: 'debtRisk', label: 'Долговой риск', fmt: idx0 },
    { key: 'recessionRisk', label: 'Риск рецессии', fmt: idx0 },
    { key: 'currencyRisk', label: 'Валютный риск', fmt: idx0 },
    { key: 'financialStability', label: 'Финансовая стабильность', fmt: idx0 },
    { key: 'consumerConfidence', label: 'Доверие населения', fmt: idx0 },
    { key: 'businessConfidence', label: 'Доверие бизнеса', fmt: idx0 },
    { key: 'govTrust', label: 'Доверие к правительству', fmt: idx0,
      hint: 'Отдельно от рейтинга власти: реакция на последовательность и предсказуемость курса, а не на сиюминутные успехи или неудачи.' },
  ] },
];

/* Реестр показателей: всё, что можно закрепить в верхнюю полосу */
const METRIC_INVERT = new Set(['inflation', 'coreInflation', 'inflationExpectations', 'importPriceInflation',
  'unitLaborCostGrowth', 'sovereignSpread', 'corporateSpread', 'volatilityIndex', 'equityRiskPremium', 'discountRate',
  'taxWedgeValue', 'keyRate', 'depositRate', 'effectiveDebtRate', 'unemployment', 'debtToGdp', 'bankNPL', 'bankingRisk',
  'inflationRisk', 'debtRisk', 'recessionRisk', 'currencyRisk', 'shadowShare', 'interestToRevenue', 'effectiveDebtRate',
  'riskPremium', 'exchangeRate', 'importPriceInflation', 'lendingRate', 'nairu', 'creditGap', 'rateGap', 'quartersToElection',
  'politicalTension']);

export const ALL_METRICS = (() => {
  const m = {};
  INDICATOR_TABS.forEach((t) => t.rows.forEach((r) => {
    if (r.key && !r.text && !m[r.key]) m[r.key] = { key: r.key, label: r.label, fmt: r.fmt, group: t.label, invert: METRIC_INVERT.has(r.key) };
  }));
  [['wellbeing', 'Благополучие'], ['scoreStability', 'Оценка: стабильность'], ['scoreWelfare', 'Оценка: благосостояние'],
    ['scoreFinancial', 'Оценка: финансы'], ['scoreFiscal', 'Оценка: бюджет'], ['scorePotential', 'Оценка: потенциал']].forEach(([k, l]) => {
      m[k] = { key: k, label: l, fmt: (v) => v.toFixed(0), group: 'Оценки', invert: false };
    });
  return m;
})();

// шесть: главная плитка на две ячейки + пять — ровные ряды и на компьютере, и на телефоне (2 в ряд)
const DEFAULT_PINS = ['gdp', 'outputGap', 'inflation', 'unemployment', 'keyRate', 'debtToGdp'];

export const MAX_PINS = 8;

function PinButton({ active, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); Audio.play('tick'); onClick(); }} title={active ? 'Открепить с верхней полосы' : 'Закрепить в верхнюю полосу'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, color: active ? COLOR.gold : COLOR.faint, opacity: active ? 1 : 0.55 }}>
      <Star size={11} fill={active ? COLOR.gold : 'none'} />
    </button>
  );
}

/* Строка показателя. Пояснение к термину раньше жило только в атрибуте title —
   то есть открывалось наведением мыши, которого на телефоне нет: значок «i»
   там был виден, а прочитать за ним было нечего. Теперь по нему (и по самому
   названию) можно нажать — подсказка раскрывается прямо под строкой, а title
   остаётся для мыши. */
export function MetricRow({ row, value, delta, pinnable, pinned, onPin, last }) {
  const [openHint, setOpenHint] = useState(false);
  const hint = row.hint;
  return (
    <div style={{ padding: '6px 0', borderBottom: last ? 'none' : `1px solid ${COLOR.hairline}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, gap: 10 }}>
        <span style={{ color: COLOR.muted, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {pinnable && <PinButton active={pinned} onClick={onPin} />}
          {hint ? (
            <span role="button" tabIndex={0} title={hint} aria-expanded={openHint}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'help', color: openHint ? COLOR.text : undefined }}
              onClick={() => { Audio.play('tick'); setOpenHint((o) => !o); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenHint((o) => !o); } }}>
              {row.label}<Info size={10} color={openHint ? COLOR.gold : COLOR.faint} />
            </span>
          ) : row.label}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="ems-mono" style={{ whiteSpace: 'nowrap' }}>{value}</span>
          {row.noDelta ? <span style={{ width: 34 }} /> : <DeltaTag value={delta} invert={METRIC_INVERT.has(row.key)} />}
        </span>
      </div>
      {hint && openHint && (
        <div className="ems-fade-in" style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.45, marginTop: 4, paddingRight: 18 }}>{hint}</div>
      )}
    </div>
  );
}

/* Полоса требований: то, чего от вас прямо сейчас хотят */
/* Событие в округе поверх любого экрана: на карту заглядывают не каждый квартал,
   а без ответа сработает «переждать». */
export function RegionEventStrip({ event, answered, canAnswer, onOpen }) {
  // ответ уже выбран — напоминать не о чем: решение видно на карте. Тому, кто
  // отвечать не может (ЦБ, трейдер), полоса сверху ни к чему — событие видно на карте
  if (!canAnswer || answered) return null;
  const region = MAP_REGIONS.find((r) => r.id === event.region);
  return (
    <div role="button" tabIndex={0} className="ems-fade-in" onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`,
        borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
      <MapIcon size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
      <span><b style={{ color: COLOR.rust }}>{region ? region.name : 'Округ'}: {event.title.toLowerCase()}.</b>{' '}
        <span style={{ color: COLOR.muted }}>{canAnswer
          ? (answered ? 'Ответ выбран — применится в конце квартала.' : 'Нужен ответ правительства — откройте карту.')
          : 'Отвечает Минфин — подробности на карте.'}</span></span>
    </div>
  );
}

export function demandItems({ botAction, botAction2, botRole, economy, president }) {
  const items = [];
  if (president) items.push({ who: `Президент (${president.persona.name})`, text: president.directive.ask || askText(president.directive.req, 1, 'president', economy.politicalRegime), color: COLOR.gold });
  if (economy.mandate) items.push({ who: 'Мандат власти', text: `Новое правительство пришло с задачей: ${MANDATE_LABEL[economy.mandate] || economy.mandate}.`, color: COLOR.gold });
  if (botAction && botAction.demand) items.push({ who: botRole === 'central_bank' ? 'Центральный банк' : 'Минфин', text: botAction.demand, color: COLOR.blue });
  // у президента оба ведомства — боты, и требования к нему идут с обеих сторон
  if (botAction2 && botAction2.demand) items.push({ who: 'Минфин', text: botAction2.demand, color: COLOR.blue });
  (economy.demands || []).slice(0, 3).forEach((d) => items.push({ who: d.actor, text: d.text + (d.quartersActive >= 3 ? ` (${d.quartersActive}-й квартал подряд)` : ''), color: COLOR.rust }));
  return items;
}

/* Строка сводки над колонками. Раньше здесь стояли три отдельные полосы во всю
   ширину — риски, требования и «Режим экономики» — и каждая была одинаково
   громкой: вместе с плитками показателей они сдвигали рычаги ниже первого экрана.
   Теперь это одна панель: режим (в кризис его всё равно подробно показывает
   RegimeBanner), пять рисков и, если есть, требования второй строкой. */
export function SummaryBar({ economy, demands = [] }) {
  const info = REGIME_INFO[economy.regime] || REGIME_INFO.normal;
  const c = info.color === 'teal' ? COLOR.teal : info.color === 'gold' ? COLOR.gold : info.color === 'blue' ? COLOR.blue : COLOR.rust;
  const risks = [['Инфляционный', economy.inflationRisk], ['Банковский', economy.bankingRisk], ['Долговой', economy.debtRisk],
    ['Рецессии', economy.recessionRisk], ['Валютный', economy.currencyRisk]];
  return (
    <div className="ems-panel ems-summary" style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 18px' }}>
        <span title={regimeInfoText(info, economy)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>
          <Activity size={14} />{regimeInfoLabel(info, economy)}
        </span>
        <span className="ems-summary-sep" aria-hidden="true" />
        <span className="ems-eyebrow">Риски</span>
        {risks.map(([l, v]) => <RiskBadge key={l} label={l} value={v} />)}
      </div>
      {demands.length > 0 && (
        <div className="ems-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', alignItems: 'baseline', borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLOR.goldSoft, letterSpacing: '0.06em', textTransform: 'uppercase', alignSelf: 'center' }}>
            <Megaphone size={13} />Требования
          </span>
          {demands.map((it, i) => (
            <span key={i} style={{ fontSize: 13, lineHeight: 1.45 }}>
              <span style={{ color: it.color, fontWeight: 700 }}>{it.who}:</span>{' '}
              <span style={{ color: COLOR.muted }}>{it.text}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Полоса закреплённых показателей. На «Панели» — плитки; на карте, в обществе и
   на рынке — одна строка-тикер: показатели под рукой, но экран отдан вкладке.
   Кнопки порядка (◀ ▶ ✕) видны при наведении или фокусе, на сенсорных экранах —
   только в режиме настройки макета: иначе они спорят с самой цифрой. */
export function KpiStrip({ pinned, economy, history, kpiDelta, dragPin, setDragPin, reorderPin, movePin, togglePin, maxPins, editMode, ticker }) {
  if (ticker) {
    return (
      <div className="ems-panel ems-kpi-ticker" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 22px', padding: '9px 14px' }}>
        {pinned.map((key) => {
          const m = ALL_METRICS[key];
          if (!m) return null;
          const val = economy[key];
          return (
            // длинное название переносится внутри себя, а не растягивает страницу вправо
            <span key={key} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
              <span style={{ fontSize: 13, color: COLOR.muted, overflowWrap: 'anywhere' }}>{m.label}</span>
              <span className="ems-mono" style={{ fontSize: 15, color: COLOR.text }}>{Number.isFinite(val) ? m.fmt(val) : '—'}</span>
              <DeltaTag value={kpiDelta(key)} invert={m.invert} />
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`ems-kpi-strip${editMode ? ' ems-kpi-edit' : ''}`}>
      {pinned.map((key, idx) => {
        const m = ALL_METRICS[key];
        if (!m) return null;
        const val = economy[key];
        return (
          <div key={key} draggable className={`ems-kpi-cell${idx === 0 ? ' hero' : ''}`}
            onDragStart={(e) => { setDragPin(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from) reorderPin(from, key); setDragPin(null); }}
            onDragEnd={() => setDragPin(null)}
            style={{ position: 'relative', opacity: dragPin === key ? 0.4 : 1, cursor: 'grab' }}>
            <KpiTile label={m.label} value={Number.isFinite(val) ? m.fmt(val) : '—'} delta={kpiDelta(key)} invert={m.invert}
              series={history.slice(-8).map((h) => h[key]).filter(Number.isFinite)} hero={idx === 0} />
            <div className="ems-kpi-ctl">
              <button type="button" onClick={() => { Audio.play('tick'); movePin(key, -1); }} aria-label={`${m.label}: левее`}>◀</button>
              <button type="button" onClick={() => { Audio.play('tick'); movePin(key, 1); }} aria-label={`${m.label}: правее`}>▶</button>
              <button type="button" onClick={() => { Audio.play('tick'); togglePin(key); }} aria-label={`Убрать ${m.label} с полосы`}><X size={12} /></button>
            </div>
          </div>
        );
      })}
      {pinned.length < maxPins && (
        /* подсказка растягивается до конца ряда: главная плитка занимает две ячейки,
           и без этого последний ряд оставался с дыркой */
        <div className="ems-panel ems-kpi-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderStyle: 'dashed', gridColumn: 'auto / -1', minHeight: 64 }}>
          <span style={{ fontSize: 12, color: COLOR.faint, textAlign: 'center', lineHeight: 1.4 }}>
            <Star size={12} style={{ verticalAlign: -2 }} /> закрепите любой показатель<br />звёздочкой в таблице справа
          </span>
        </div>
      )}
    </div>
  );
}

export function RiskBadge({ label, value }) {
  const v = clamp(value || 0, 0, 100);
  const color = v >= 65 ? COLOR.rust : v >= 35 ? COLOR.gold : COLOR.teal;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
      <span style={{ color: COLOR.muted, whiteSpace: 'nowrap' }}>{label}</span>
      {/* дорожка размечена самими зонами (спокойно/тревожно/опасно), а не только
          закрашена до текущего значения — так видно не просто «24», а «24 — это
          насколько близко к жёлтой зоне», без сверки с легендой в голове */}
      <span className="ems-risk-track" style={{ position: 'relative', width: 46, height: 4, borderRadius: 2, flexShrink: 0,
        background: `linear-gradient(90deg, ${COLOR.tealDim} 0%, ${COLOR.tealDim} 35%, ${COLOR.goldDim} 35%, ${COLOR.goldDim} 65%, ${COLOR.rustDim} 65%, ${COLOR.rustDim} 100%)` }}>
        <span style={{ position: 'absolute', left: `calc(${v}% - 1.5px)`, top: -2, width: 3, height: 8, borderRadius: 1, background: color }} />
      </span>
      <span className="ems-mono" style={{ color, fontWeight: 600, minWidth: 18 }}>{Math.round(v)}</span>
    </div>
  );
}

function DemandsPanel({ demands }) {
  if (!demands || demands.length === 0) return null;
  return (
    <div className="ems-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <Users size={14} color={COLOR.gold} />
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Общественное давление</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {demands.map((dd) => (
          <div key={dd.id} style={{ fontSize: 12, lineHeight: 1.45, borderLeft: `2px solid ${COLOR.rust}`, paddingLeft: 9 }}>
            <span style={{ color: COLOR.rust, fontWeight: 600 }}>{dd.actor}: </span>
            <span style={{ color: COLOR.text }}>{dd.text}</span>
            {dd.quartersActive >= 3 && <span style={{ color: COLOR.faint }}> ({dd.quartersActive}-й квартал подряд)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ ГЛАВНЫЙ ЭКРАН ============================ */
export function GameScreen({ setup, initial, onRestart, onLoadState, theme, setTheme }) {
  const roleDef = ROLES.find((r) => r.id === setup.role);
  const RoleIcon = ROLE_ICON[roleDef.icon];
  const goalDef = GOALS.find((g) => g.id === setup.goal);
  const botRole = roleDef.botRole;
  const isTrader = setup.role === 'trader';
  // президент делит с трейдером устройство «оба ведомства — боты», но не его
  // информационную закрытость: он в кабинете и видит намерения ведомств
  const isPresident = setup.role === 'president';
  // трейдер видит экономику снаружи: без кабинета и его закрытых сводок
  const isPublic = isTrader;
  const canPlanMap = setup.role === 'ministry_finance' || isPresident;
  // оборону приказывает президент, а там, где его нет (премьер — вся власть целиком), — премьер
  const canCommandDefense = isPresident || setup.role === 'full_control';
  const bothBots = isTrader || isPresident;
  /* Президент-бот стоит НАД ведомством игрока: он ничего не считает сам, но требует,
     назначает и тратит политический капитал. За саму роль президента его, понятно,
     нет, а у премьера игрок и так вся власть целиком. */
  const presEnabled = !!(setup.president && setup.president.enabled)
    && (setup.role === 'central_bank' || setup.role === 'ministry_finance' || setup.role === 'trader');
  const playerBranch = setup.role === 'central_bank' ? 'monetary' : setup.role === 'ministry_finance' ? 'fiscal' : null;
  const [difficulty, setDifficulty] = useState(setup.difficulty);
  // вызов дня: общий для всех жребий, фиксированная длина, итог в таблицу
  const daily = setup.daily || null;

  const initEconomy = useMemo(() => (initial ? initial.economy
    : runSeeded(daily, 'start', () => makeInitialEconomy(setup.scenario))), []);
  const [economy, setEconomy] = useState(initEconomy);
  const [history, setHistory] = useState(initial ? initial.history : [{ q: 0, label: quarterLabel(1) + ' (старт)', ...initEconomy }]);
  // сохранения из прошлых версий игры не знают о рычагах, добавленных позже
  // (например, «Размещение облигаций»/дефолт/МВФ) — без подстраховки открытие
  // вкладки с новым рычагом падало на undefined.toFixed()
  const [decisions, setDecisions] = useState(initial ? { ...defaultDecisions(initEconomy), ...initial.decisions } : defaultDecisions(initEconomy));
  const [pendingImpulses, setPendingImpulses] = useState(initial ? initial.pendingImpulses || [] : []);
  const [eventCooldowns, setEventCooldowns] = useState(initial ? initial.eventCooldowns || {} : {});
  const [quarterIndex, setQuarterIndex] = useState(initial ? initial.quarterIndex : 1);
  const [newsFeed, setNewsFeed] = useState(initial ? initial.newsFeed || [] : []);
  const [stories, setStories] = useState(initial ? initial.stories || [] : []);
  const [showPaper, setShowPaper] = useState(false);
  const [saveModal, setSaveModal] = useState(null);
  // слот, с которым сейчас связана партия: пришла из «Продолжить», была
  // сохранена вручную в конкретный слот, либо восстановлена из автосохранения,
  // унаследовавшего эту связь. Пока слота нет (совсем новая партия), автосохранение
  // остаётся анонимным — как раньше.
  const [activeSlot, setActiveSlot] = useState(initial && Number.isFinite(initial.slotIdx) ? initial.slotIdx : null);
  const [showAch, setShowAch] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const { toast: achToast, leaving: achLeaving, push: pushAch } = useAchievementToasts();
  const [defeat, setDefeat] = useState(initial && initial.defeat ? initial.defeat : null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [view, setView] = useState(setup.role === 'trader' ? 'market' : 'dash');
  // на вкладке «Казино» музыка временно переключается на лаунж-плейлист
  // независимо от режима экономики, а при выходе возвращается к тому, что
  // играло (в том числе к ручному выбору игрока, если он был) — а не всегда
  // к «по режиму экономики»
  React.useEffect(() => {
    if (view !== 'casino') return undefined;
    const prevLocked = Audio.nowPlaying().locked;
    Audio.setPlaylist('casino');
    return () => { Audio.setPlaylist(prevLocked); };
  }, [view]);
  const [flashKey, setFlashKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [dense, setDense] = useState(initial ? !!initial.dense : false);
  const [irf, setIrf] = useState(null);
  const [mobileCol, setMobileCol] = useState('center');
  const [narrow, setNarrow] = useState(false);
  const [dashboards, setDashboards] = useState(() => initDashboards(initial && initial.dashboards));
  const dashActions = useMemo(() => makeDashboardActions(setDashboards), []);
  const initialDash = initial ? initial.activeDash || null : null;
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 860px)');
    const upd = () => setNarrow(mq.matches);
    upd();
    if (mq.addEventListener) { mq.addEventListener('change', upd); return () => mq.removeEventListener('change', upd); }
    mq.addListener(upd); return () => mq.removeListener(upd);
  }, []);
  const { pinned, setPinned, activeDash, setActiveDash } = usePinnedStrip(
    initial && initial.pinned ? initial.pinned : null, initialDash, dashActions);
  const layout = useLayoutColumns();
  const [pendingRequest, setPendingRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(initial ? initial.lastResponse || null : null);
  const [botAction2, setBotAction2] = useState(initial ? initial.botAction2 || null : null);
  const [portfolio, setPortfolio] = useState(initial && initial.portfolio ? initial.portfolio : emptyBook());
  const [cbPersonaId, setCbPersonaId] = useState(initial && initial.cbPersonaId ? initial.cbPersonaId : setup.cbPersona);
  const [presPersonaId] = useState(() => (initial && initial.presPersonaId)
    || ((setup.president && setup.president.persona) || 'technocrat'));
  // план президента на ближайший квартал: требование должно быть видно ДО решений
  const [presidentPlan, setPresidentPlan] = useState(() => (presEnabled
    ? runSeeded(daily, `plan${initial ? initial.quarterIndex : 1}`, () => botPresident(initEconomy, presPersonaId, setup.difficulty,
      { playerBranch, cooldowns: {}, cbPersonaId: setup.cbPersona, mofPersonaId: setup.mofPersona }))
    : null));
  const [presidentLast, setPresidentLast] = useState(initial ? initial.presidentLast || null : null);
  // сколько кварталов назад президент требовал в прошлый раз и чего именно —
  // чтобы он не повторял одно и то же слово в слово каждый квартал
  const [presDirMemo, setPresDirMemo] = useState({ lastReqId: null, ago: 99 });
  // решения на начало квартала — по ним проверяется, выполнено ли требование
  const [decisionsBaseline, setDecisionsBaseline] = useState(() => defaultDecisions(initEconomy));
  const [mofPersonaId, setMofPersonaId] = useState(initial && initial.mofPersonaId ? initial.mofPersonaId : setup.mofPersona);
  // предвыборные обещания — у премьера и президента: у них нет бота-оппонента
  // с требованиями, и это единственные роли без встречного давления по политике
  const [promises, setPromises] = useState(() => (setup.role !== 'full_control' && setup.role !== 'president' ? null
    : initial && initial.promises ? initial.promises : runSeeded(daily, 'promises', () => pickPromises(initEconomy))));
  // пакет решений президента на текущий квартал: списывается движком при завершении
  const [presActions, setPresActions] = useState(initial ? initial.presActions || [] : []);
  // кому объявляется война (выбрано на карте, в карточке страны); без выбора — Норланду
  const [warTarget, setWarTarget] = useState(null);
  const planWar = (t) => {
    setWarTarget(t);
    setPresActions((list) => (t ? (list.includes('war_start') ? list : [...list, 'war_start']) : list.filter((x) => x !== 'war_start')));
  };
  const [presAppointCb, setPresAppointCb] = useState(null);
  const [presAppointMof, setPresAppointMof] = useState(null);
  const [presDirective, setPresDirective] = useState(null);
  const [presDirStrength, setPresDirStrength] = useState(1);
  /* Решения на карте: стройка и ответ на событие в округе. Принимают их Минфин и
     президент; за остальных это делает бот-Минфин. Живут квартал. */
  const [regionPlan, setRegionPlan] = useState({ startProject: null, regionResponse: null });
  // приказ армии на квартал в наступательной войне — отдаёт его президент
  const [warOrder, setWarOrder] = useState(null);
  // штабы кампании по областям на этот квартал — их расставляет президент
  const [campaignPlan, setCampaignPlan] = useState({});
  // условия мира, которые президент предложит Норланду в этом квартале
  const [treatyPlan, setTreatyPlan] = useState(null);
  // дипломатия на квартал: действие президента и ответ на событие соседа
  const [diploPlan, setDiploPlan] = useState(null);
  const [lastDirective, setLastDirective] = useState(initial ? initial.lastDirective || null : null);
  const [lastReasons, setLastReasons] = useState(initial && initial.lastReasons ? initial.lastReasons
    : { gdpGrowth: [], inflation: [], exchangeRate: [], budget: [], unemployment: [], banking: [], potential: [] });
  const [lastReport, setLastReport] = useState(initial ? initial.lastReport || '' : '');
  const [botAction, setBotAction] = useState(initial ? initial.botAction || null : null);
  const [showWhy, setShowWhy] = useState(false);
  const [activeTab, setActiveTab] = useState('economy');
  const { chartGroup, setChartGroup, period, setPeriod, hiddenSeries, setHiddenSeries } = useChartView();
  const [busy, setBusy] = useState(false);
  // короткая заморозка кнопки после обработки квартала: без неё нетерпеливый
  // клик по уже отпущенной кнопке прогонял несколько кварталов подряд быстрее,
  // чем успевала прочитаться лента новостей
  const [finishCooldown, setFinishCooldown] = useState(0);
  React.useEffect(() => {
    if (finishCooldown <= 0) return undefined;
    const t = setTimeout(() => setFinishCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [finishCooldown]);

  const activeBotPersona = botRole === 'central_bank' ? getCbPersona(cbPersonaId) : botRole === 'ministry_finance' ? getMofPersona(mofPersonaId) : null;
  const onTrade = (id, amt, side, live) => {
    if (id === 'cds_sovereign') pushAch(unlockAchievements(['cds_trade']));
    setPortfolio((b) => {
      const nb = tradeBook(b, id, amt, side, economy, live);
      const instr = INSTR_BY_ID[id];
      return { ...nb, trades: [...(b.trades || []), { q: quarterIndex, id, side, amt, price: priceOf(instr, economy, live) }].slice(-120) };
    });
  };
  const onCasino = (net) => {
    const casinoNet = (portfolio.casinoNet || 0) + net;
    setPortfolio((b) => ({ ...b, cash: Math.max(0, b.cash + net), realized: (b.realized || 0) + net, casinoNet: (b.casinoNet || 0) + net }));
    pushAch(unlockAchievements(casinoAchievementIds({ net, casinoNet })));
  };
  const prevEcon = history.length >= 2 ? history[history.length - 2] : initEconomy;
  const groups = roleDef.groups;
  const levers = LEVERS.filter((l) => groups.includes(l.group)).filter((l) => !l.onlyIf || l.onlyIf(decisions));
  // «Ваши полномочия» разбиты на вкладки по подгруппам, а не одним длинным списком:
  // при роли «оба ведомства» все ~22 ползунка подряд растягивали левую колонку
  // намного выше центральной и правой, оставляя под ними пустое место на странице
  const LEVER_TABS = [
    groups.includes('monetary') && { id: 'monetary-core', label: 'Ставка и курс' },
    groups.includes('monetary') && { id: 'monetary-macropru', label: 'Макропруденциальная' },
    groups.includes('fiscal') && { id: 'fiscal-core', label: 'Расходы' },
    groups.includes('fiscal') && { id: 'fiscal-taxes', label: 'Налоги' },
    groups.includes('fiscal') && { id: 'fiscal-budget', label: 'Бюджет' },
    groups.includes('fiscal') && { id: 'fiscal-debt', label: 'Долг' },
  ].filter(Boolean);
  const [levTab, setLevTab] = useState(LEVER_TABS[0] ? LEVER_TABS[0].id : null);
  const tabs = useMemo(() => tabsForBotRole(botRole), [botRole]);
  const snapshot = () => makeSnapshot({ setup: { ...setup, difficulty }, economy, history, decisions, pendingImpulses, eventCooldowns,
    quarterIndex, newsFeed, stories, lastReport, lastReasons, botAction, botAction2, pinned, cbPersonaId, mofPersonaId,
    portfolio, lastResponse, dense, dashboards, activeDash, defeat, promises, presActions, lastDirective,
    presPersonaId, presidentLast, slotIdx: activeSlot });
  // история снимков для отката после поражения: три хода назад решение ещё можно
  // было принять иначе, а начинать партию заново с нуля — обидно. Снимок делаем
  // тем же способом, что и ручное сохранение, — чтобы восстановление не забыло
  // ни одного поля состояния. Держим с запасом (8, а не 3) на случай, если между
  // кварталами эффект сработает не идеально ровно.
  const rollbackHistoryRef = React.useRef([]);
  // короткая вспышка «автосохранено» — единственное подтверждение того, что
  // автосохранение вообще происходит: раньше оно было полностью незаметным,
  // и со стороны выглядело так, будто его нет вовсе
  const [autosaveFlash, setAutosaveFlash] = useState(false);
  React.useEffect(() => {
    const snap = snapshot();
    rollbackHistoryRef.current = [...rollbackHistoryRef.current, { quarterIndex, snap }].slice(-8);
    saveAutosave(snap);
    // партия, у которой уже есть свой слот (пришла из «Продолжить» или была
    // сохранена вручную), автосохраняется прямо в него на сервере — иначе слот
    // застревал на моменте последнего ручного сохранения, а свежий прогресс
    // был виден только анонимной карточке в меню, отдельно от него
    if (Number.isFinite(activeSlot)) saveSoloSlot(getPlayerId(), activeSlot, snap).catch(() => {});
    setAutosaveFlash(true);
    const t = setTimeout(() => setAutosaveFlash(false), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarterIndex]);
  // в вызове дня отката нет: иначе итог в таблице ничего бы не значил
  const rollbackTarget = daily ? null : rollbackHistoryRef.current.find((e) => e.quarterIndex === quarterIndex - 3);
  const handleRollback = () => { if (rollbackTarget) onLoadState(rollbackTarget.snap); };
  const [autoPaper, setAutoPaperState] = useState(loadAutoPaper);
  const setAutoPaper = (v) => { saveAutoPaper(v); setAutoPaperState(v); };
  // «сама открывается» — это про КАЖДЫЙ СЛЕДУЮЩИЙ квартал, а не про открытие
  // на старте партии: первый рендер (новая игра или загруженное сохранение)
  // эффект тоже проходит, и его нужно явно пропустить
  const firstQuarterRef = React.useRef(true);
  React.useEffect(() => {
    if (firstQuarterRef.current) { firstQuarterRef.current = false; return; }
    if (autoPaper) { setShowPaper(true); Audio.play('paper'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarterIndex]);
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
  const applyDash = (id) => { const d = dashboards.find((x) => x.id === id); if (d) { setPinned(d.pins); setActiveDash(id); } };
  const saveDash = () => dashActions.saveDash(pinned, setActiveDash);
  const { deleteDash, renameDash, resetDash } = dashActions;
  const crisisActive = (economy.activeCrises || []).includes('banking') || economy.bankingRisk > 60;
  const debtCrisisActive = (economy.activeCrises || []).includes('debt') && !(economy.marketLockoutQuartersLeft > 0);

  const finishQuarter = useCallback(() => runSeeded(setup.daily, `q${quarterIndex}`, () => {
    if (defeat) return;
    if (setup.daily && quarterIndex > setup.daily.quarters) return;
    setBusy(true);
    let eff = { ...decisions };
    let extraImpulses = [];
    const cbAction0 = (botRole === 'central_bank' || bothBots) ? botCentralBank(economy, cbPersonaId, difficulty) : null;
    const mofAction0 = (botRole === 'ministry_finance' || bothBots) ? botFinanceMinistry(economy, mofPersonaId, difficulty) : null;
    let cbAction = cbAction0; let mofAction = mofAction0;
    if (cbAction) eff = { ...eff, ...cbAction.decisions };
    if (mofAction) eff = { ...eff, ...mofAction.decisions };

    /* Решения президента. Указы, реформы и назначения списывает и применяет сам
       движок (decisions.presidentActions / appointCb / appointMof) — а вот указание
       ведомству разбирается здесь, потому что ему нужны уже посчитанные решения
       ботов; стоимость и последствия возвращаются движку отдельными каналами. */
    let dirResult = null;
    if (isPresident) {
      eff = { ...eff, presidentActions: presActions, appointCb: presAppointCb, appointMof: presAppointMof, warTarget };
      if (presDirective) {
        dirResult = processPresidentialDirective(presDirective, economy, cbPersonaId, mofPersonaId, eff, presDirStrength);
      }
      if (dirResult) {
        eff = { ...dirResult.decisions, presidentExtraSpend: PRES_DIRECTIVE_COST };
        if (dirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
        else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
        if (dirResult.credibilityHit) {
          extraImpulses.push(makeImpulse('cbCredibilityPush', dirResult.credibilityHit,
            'Центральный банк исполнил указание президента', 'fast', difficulty, 'other'));
        }
        if (dirResult.tension) {
          extraImpulses.push(makeImpulse('tensionPush', dirResult.tension,
            'Ведомство отклонило указание президента', 'fast', difficulty, 'other'));
        }
      }
    }
    /* Президент-бот. Его собственные решения (указы, реформы, назначения) движок
       разбирает тем же кодом, что и решения игрока-президента; указание ведомству
       игрока проверяется здесь, потому что «выполнено» — это про то, что игрок
       сделал с ползунками, а не про то, что получилось в экономике. */
    let presDirResult = null;
    let directiveMet = null;
    if (presEnabled && presidentPlan) {
      const presPersona = presidentPlan.persona;
      eff = { ...eff, presidentActive: true, presidentActions: presidentPlan.actions,
        presidentPatience: presPersona.patience };
      if (presidentPlan.appointBot) {
        const ap = presidentPlan.appointBot;
        eff = { ...eff, [ap.kind === 'central_bank' ? 'appointCb' : 'appointMof']: ap.persona };
      }
      const dir = presidentPlan.directive;
      if (dir && dir.toPlayer) {
        directiveMet = directiveProgress(dir.reqId, decisionsBaseline, decisions, economy);
        // требование стоит президенту капитала — иначе давить можно бесконечно
        eff = { ...eff, presidentDirectiveMet: directiveMet, presidentExtraSpend: PRES_DIRECTIVE_COST };
      } else if (dir) {
        presDirResult = processPresidentialDirective(dir.reqId, economy, cbPersonaId, mofPersonaId, eff);
        if (presDirResult) {
          eff = { ...presDirResult.decisions, presidentActive: true,
            presidentActions: presidentPlan.actions, presidentPatience: presPersona.patience,
            presidentExtraSpend: PRES_DIRECTIVE_COST,
            ...(presidentPlan.appointBot
              ? { [presidentPlan.appointBot.kind === 'central_bank' ? 'appointCb' : 'appointMof']: presidentPlan.appointBot.persona }
              : {}) };
          if (presDirResult.toCb) cbAction = redescribeCbAction(economy, cbPersonaId, eff);
          else mofAction = redescribeMofAction(economy, mofPersonaId, eff);
          if (presDirResult.credibilityHit) {
            extraImpulses.push(makeImpulse('cbCredibilityPush', presDirResult.credibilityHit,
              'Центральный банк исполнил указание президента', 'fast', difficulty, 'other'));
          }
        }
      }
    }
    // война: приказ игрока-президента или бота-президента по характеру
    if (economy.warType === 'offensive' && (economy.warQuartersLeft || 0) > 0) {
      eff = { ...eff, warOrder: isPresident ? warOrder : presEnabled ? botWarOrder(economy, presPersonaId) : null };
    }
    // война за новые земли: тот же приказ, только оборонительный
    if (economy.warType === 'revanche' && (economy.warQuartersLeft || 0) > 0) {
      eff = { ...eff, warOrder: canCommandDefense ? warOrder : presEnabled ? botDefenseOrder(economy, presPersonaId) : null };
    }
    // оборонительная война с Дештом: тот же приказ, фронт — юго-запад страны
    if (economy.warType === 'defensive' && (economy.warQuartersLeft || 0) > 0) {
      eff = { ...eff, warOrder: canCommandDefense ? warOrder : botFrontOrder(economy, presEnabled ? presPersonaId : 'technocrat') };
    }
    // переговоры с Норландом: условия президента-игрока, иначе — бота по характеру
    if (economy.peaceTalks) {
      eff = { ...eff, treaty: isPresident ? treatyPlan : botTreaty(economy, presEnabled ? presPersonaId : 'technocrat') };
    }
    // соседи: решения президента-игрока, иначе — бота по характеру; без президента МИД только отвечает
    eff = { ...eff, diplomacy: isPresident ? diploPlan
      : botDiplomacy(economy, presEnabled ? presPersonaId : 'technocrat', presEnabled ? (Number.isFinite(economy.politicalCapital) ? economy.politicalCapital : 55) : 0) };
    // кампания: штабы президента-игрока, иначе — штаб власти по опросам
    eff = { ...eff, campaignPlan: isPresident ? campaignPlan : botCampaignPlan(economy) };
    // карта: игрок за Минфин или президент решает сам — поверх бота-Минфина
    if (canPlanMap) {
      eff = { ...eff, startProject: regionPlan.startProject || null, regionResponse: regionPlan.regionResponse || null,
        groupResponse: regionPlan.groupResponse || null,
        // программа интеграции новых земель: не трогали — продолжается прошлая
        integrate: Array.isArray(regionPlan.integrate) ? regionPlan.integrate : null };
    }
    let action = botRole === 'central_bank' ? cbAction : botRole === 'ministry_finance' ? mofAction : cbAction;
    // официальный запрос второму ведомству
    let reqResult = null;
    if (pendingRequest && botRole && botRole !== 'both') {
      reqResult = processRequest(pendingRequest, economy, botRole, botRole === 'central_bank' ? cbPersonaId : mofPersonaId, eff);
      if (reqResult) {
        eff = reqResult.decisions;
        // новость должна описывать то, что реально произошло после запроса,
        // а не изначальное намерение бота до вмешательства (иначе текст
        // расходится с тем, что реально применяется к экономике)
        action = botRole === 'central_bank' ? redescribeCbAction(economy, cbPersonaId, eff)
          : redescribeMofAction(economy, mofPersonaId, eff);
      }
    }

    const cbStance = clamp((eff.keyRate - economy.inflationExpectations - economy.rStar) / 3, -1, 1);
    const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6
      - (eff.vatRate - economy.vatRate + eff.incomeTaxRate - economy.incomeTaxRate) * 0.3, -1, 1);

    // обещания считает движок в момент голосования: от них зависит доля голосов,
    // а не только строчка в новостях постфактум
    if (promises) eff = { ...eff, promises };
    const result = simulateQuarter({
      economy: { ...economy, cbStance, mofStance,
        policyCoordination: clamp(economy.policyCoordination + (reqResult ? reqResult.coordination : 0), 0, 100) },
      decisions: eff, pendingImpulses: extraImpulses.length ? [...pendingImpulses, ...extraImpulses] : pendingImpulses,
      eventCooldowns,
      difficulty, quarterIndex, stories, botAction: action,
      botActions: bothBots ? [mofAction] : [], publicMode: isPublic,
    });
    if (dirResult) {
      const who = dirResult.toCb ? 'ПРЕЗИДЕНТ → ЦБ' : 'ПРЕЗИДЕНТ → МИНФИН';
      result.newsEntries.unshift({ id: `dir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${dirResult.req.label.toUpperCase()} — ${dirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : dirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${dirResult.ask}» ${dirResult.text}${dirResult.credibilityHit
          ? (economy.politicalRegime === 'authoritarian' || economy.politicalRegime === 'totalitarian'
            // при авторитаризме и тем более тоталитаризме государственная пресса не станет
            // сама признавать, что независимость ЦБ пострадала, — она подаёт исполнение
            // указа как слаженную работу ветвей власти, а не как её потерю
            ? ' Государственная пресса подаёт это как слаженную работу ветвей власти.'
            : ' Исполненное политическое указание ЦБ рынок читает как потерю независимости — доверие к денежной политике снижается.')
          : dirResult.status === 'rejected' ? ' Публичный отказ ведомства добавляет напряжения в отношения ветвей власти.' : ''}` });
      setLastDirective({ status: dirResult.status, text: dirResult.text });
    }
    if (reqResult) {
      // botRole — роль бота, а не того, кто послал запрос: запрос всегда шлёт
      // игрок, и его направление задаёт req.from, а не то, кем управляет бот.
      // Раньше при botRole === 'ministry_finance' (игрок — ЦБ) стрелка всё
      // равно указывала «МИНФИН → ЦБ», будто ответ вёл бот, а не игрок.
      const who = reqResult.req.from === 'central_bank' ? 'ЦБ → МИНФИН' : 'МИНФИН → ЦБ';
      result.newsEntries.unshift({ id: `req${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `${who}: ${reqResult.req.label.toUpperCase()} — ${reqResult.status === 'accepted' ? 'СОГЛАСОВАНО' : reqResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
        text: `«${reqResult.ask}» ${reqResult.text} Согласованность политики ${reqResult.coordination > 0 ? 'выросла' : 'снизилась'} на ${Math.abs(reqResult.coordination)} пункта.` });
      setLastResponse({ status: reqResult.status, text: reqResult.text });
      setPendingRequest(null);
    }
    let traderEvents = [];
    let bookVal = null;
    if (isTrader) {
      const withBench = portfolio.benchStart ? portfolio : { ...portfolio, benchStart: { stockIndex: economy.stockIndex, bondIndex: economy.bondIndex,
        depositIndex: economy.depositIndex, priceLevel: economy.priceLevel } };
      const nb = settleQuarter(withBench, result.economy);
      traderEvents = nb.lastEvents || [];
      traderEvents.forEach((ev, i) => {
        if (ev.kind === 'call') { Audio.play('alarm'); haptic([60, 80, 60]); }
        result.newsEntries.unshift({ id: `trd${quarterIndex}_${i}`, cat: ev.kind === 'call' ? 'crisis' : 'markets',
          priority: ev.kind === 'call' ? 9 : 5, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: ev.kind === 'call' ? 'МАРЖИН-КОЛЛ: ПОЗИЦИИ ЗАКРЫТЫ ПРИНУДИТЕЛЬНО' : 'РАСЧЁТЫ ПО ВАШИМ ПОЗИЦИЯМ',
          text: ev.text });
      });
      setPortfolio(nb);
      bookVal = bookValue(nb, result.economy, null);
    }
    setEconomy(result.economy);
    const newHistory = [...history, { q: quarterIndex, label: quarterLabel(quarterIndex), ...result.economy }];
    setHistory(newHistory);
    pushAch(unlockAchievements(questProgressAchievementIds({
      quarterIndex, economy: result.economy, history: newHistory, lastEvents: traderEvents,
      rolesPlayed: recordRolePlayed(setup.role), networkPlayed: isNetworkPlayed(), role: setup.role,
      presActionsThisQuarter: presActions,
    })));
    const nextDefeat = checkDefeat({ role: setup.role, economy: result.economy, history: newHistory, bookVal,
      presidentActive: presEnabled });
    if (nextDefeat) { setDefeat(nextDefeat); setShowGameOver(true); }
    setPendingImpulses(result.pendingImpulses);
    setEventCooldowns(result.eventCooldowns);
    setLastReasons(result.reasons);
    setLastReport(result.report);
    if (presEnabled && presidentPlan) {
      const dir = presidentPlan.directive;
      if (dir && dir.toPlayer) {
        const verdict = directiveVerdict(directiveMet);
        const pct = Number.isFinite(directiveMet) ? Math.round(directiveMet * 100) : null;
        const word = verdict === 'met' ? 'ВЫПОЛНЕНО' : verdict === 'partial' ? 'ВЫПОЛНЕНО ЧАСТИЧНО'
          : verdict === 'ignored' ? 'ПРОИГНОРИРОВАНО' : 'БЕЗ ОТВЕТА';
        result.newsEntries.unshift({ id: `presdir${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: `${presDirMemo.lastReqId === dir.reqId
            ? `ПРЕЗИДЕНТ ВНОВЬ ТРЕБУЕТ ОТ ${playerBranch === 'monetary' ? 'ЦБ' : 'МИНФИНА'}`
            : `ПРЕЗИДЕНТ → ${playerBranch === 'monetary' ? 'ЦБ' : 'МИНФИН'}`}: ${dir.req.label.toUpperCase()} — ${word}`,
          text: `«${dir.ask || askText(dir.req, 1, 'president', economy.politicalRegime)}» ${verdict === 'met'
            ? 'Ведомство пошло навстречу — администрация это отметила.'
            : verdict === 'partial'
              ? `Ведомство сделало примерно ${pct}% запрошенного. В администрации это считают полумерой.`
              : verdict === 'ignored'
                ? 'Ведомство поступило по-своему. В администрации президента это запомнят.'
                : 'Требование осталось без внятного ответа.'}` });
      } else if (presDirResult) {
        result.newsEntries.unshift({ id: `presdir${quarterIndex}`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: `ПРЕЗИДЕНТ → ${presDirResult.toCb ? 'ЦБ' : 'МИНФИН'}: ${presDirResult.req.label.toUpperCase()} — ${presDirResult.status === 'accepted' ? 'ИСПОЛНЕНО' : presDirResult.status === 'partial' ? 'ЧАСТИЧНО' : 'ОТКАЗ'}`,
          text: `«${presDirResult.ask}» ${presDirResult.text}` });
      }
      if (presidentPlan.appointBot) {
        const ap = presidentPlan.appointBot;
        if (ap.kind === 'central_bank') setCbPersonaId(ap.persona); else setMofPersonaId(ap.persona);
      }
      // в тихий квартал не затираем прошлую запись: иначе строка «в прошлый раз»
      // мигает и исчезает, хотя требование как раз и остаётся в силе
      if (presidentPlan.directive || presidentPlan.actions.length) {
        setPresidentLast({ directiveMet, label: presidentPlan.directive ? presidentPlan.directive.req.label : null,
          toPlayer: !!(presidentPlan.directive && presidentPlan.directive.toPlayer),
          // указание соседнему ведомству тоже имеет исход — ответ бота, а не «передано»
          status: presDirResult ? presDirResult.status : null,
          actions: presidentPlan.actions.map((id) => {
            const a = PRES_BY_ID[id]; if (!a) return null;
            return typeof a.label === 'function' ? a.label(economy) : a.label;
          }).filter(Boolean) });
      }
      const nextCb = presidentPlan.appointBot && presidentPlan.appointBot.kind === 'central_bank' ? presidentPlan.appointBot.persona : cbPersonaId;
      const nextMof = presidentPlan.appointBot && presidentPlan.appointBot.kind === 'ministry_finance' ? presidentPlan.appointBot.persona : mofPersonaId;
      const memo = presidentPlan.directive
        ? { lastReqId: presidentPlan.directive.reqId, ago: 0 }
        : { lastReqId: presDirMemo.lastReqId, ago: Math.min(99, presDirMemo.ago + 1) };
      setPresDirMemo(memo);
      setPresidentPlan(botPresident(result.economy, presPersonaId, difficulty,
        { playerBranch, cooldowns: result.eventCooldowns, cbPersonaId: nextCb, mofPersonaId: nextMof,
          lastReqId: memo.lastReqId, lastDirectiveAgo: memo.ago }));
    }
    setDecisionsBaseline(defaultDecisions(result.economy, decisions));
    setBotAction(action);
    setBotAction2(bothBots ? mofAction : null);
    if (isPresident) {
      // назначение вступает в силу со следующего квартала: решение уже оплачено
      // и объявлено, дальше ведомство ведёт новый человек
      if (presAppointCb) setCbPersonaId(presAppointCb);
      if (presAppointMof) setMofPersonaId(presAppointMof);
      // «Своими руками» — именно вернуть парламент, распущенный указом, а не тот,
      // который распустил кризис: decreeRule до квартала как раз это и означает
      if (presActions.includes('restore_parliament') && economy.decreeRule) pushAch(unlockAchievements(['own_hands']));
      setPresActions([]); setPresAppointCb(null); setPresAppointMof(null); setPresDirective(null); setPresDirStrength(1); setWarTarget(null);
    }
    // стройка и ответ — на один квартал, программа интеграции действует дальше
    setRegionPlan((p) => ({ startProject: null, regionResponse: null, groupResponse: null, integrate: p.integrate }));
    setCampaignPlan({});
    setTreatyPlan(null);
    setDiploPlan(null);
    setStories(result.stories);
    setNewsFeed((f) => [...result.newsEntries, ...f].slice(0, 220));
    // после проигранных выборов новая власть меняет руководство ведомства
    const er = result.economy.electionResult;
    if (er && er !== 'incumbent' && botRole) {
      const changeCb = botRole === 'central_bank' && er === 'landslide';
      const changeMof = botRole === 'ministry_finance';
      if (changeMof) {
        const np = personaAfterElection('ministry_finance', result.economy);
        if (np !== mofPersonaId) {
          setMofPersonaId(np);
          result.newsEntries.unshift({ id: `pers${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
            headline: `НОВЫЙ МИНИСТР ФИНАНСОВ: ${getMofPersona(np).name.toUpperCase()}`,
            text: `${getMofPersona(np).title}. ${getMofPersona(np).desc} Вам предстоит работать с другим бюджетом и другой логикой расходов.` });
        }
      }
      if (changeCb) {
        const np = personaAfterElection('central_bank', result.economy);
        if (np !== cbPersonaId) {
          setCbPersonaId(np);
          result.newsEntries.unshift({ id: `pers${quarterIndex}`, cat: 'cb', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
            headline: `СМЕНА ГЛАВЫ ЦЕНТРАЛЬНОГО БАНКА: ${getCbPersona(np).name.toUpperCase()}`,
            text: `${getCbPersona(np).title}. ${getCbPersona(np).desc} Смена руководства ЦБ после выборов — всегда вопрос к независимости политики и к тому, чего стоят её обещания.` });
        }
      }
    }
    // «обещания у урны» на первом же голосовании были для игрока полной
    // неожиданностью: их выбирает pickPromises при старте партии, без единого
    // решения игрока, и до сих пор про них узнавали только из маленькой панели
    // в кабинете — если пропустить её в первом квартале, следующая весть о них
    // приходила через много кварталов сразу приговором «сдержано/провалено»
    if (quarterIndex === 1 && promises && promises.length) {
      result.newsEntries.unshift({ id: `promisesstart`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: 'ПРИНЯТА ПРИСЯГА: ОБЪЯВЛЕНЫ ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ',
        text: `На этот срок заявлено: ${promises.map((p) => `«${p.label}» — ${p.text.toLowerCase()}`).join('; ')}. К дню голосования по каждому подведут итог — сдержано оно или нет.` });
    }
    // предвыборные обещания подводятся в тот же квартал, когда выборы наступили
    // (quartersToElection обнулился и сформировал electionResult) — не раньше:
    // формально срок ещё не закончился, пока не наступил сам день голосования
    if (promises && er) {
      const kept = promises.map((p) => evaluatePromise(p, result.economy).met);
      const keptCount = Number.isFinite(result.economy.promisesKept) ? result.economy.promisesKept : kept.filter(Boolean).length;
      const broken = promises.length - keptCount;
      result.newsEntries.unshift({ id: `promises${quarterIndex}`, cat: 'gov', priority: 9, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
        headline: `ОБЕЩАНИЯ У УРНЫ: СДЕРЖАНО ${keptCount} ИЗ ${promises.length}`,
        text: `${promises.map((p, i) => `«${p.label}» — ${kept[i] ? 'сдержано' : 'провалено'}`).join('; ')}. ${
          keptCount > broken ? `Это добавило власти примерно ${fmt1((keptCount - broken) * 2.2)} п.п. голосов.`
            : keptCount < broken ? `Это стоило власти примерно ${fmt1((broken - keptCount) * 2.2)} п.п. голосов.`
              : 'На итог голосования обещания в сумме не повлияли.'}` });
      if (keptCount === promises.length) pushAch(unlockAchievements(['promises_kept']));
      if (er === 'incumbent') {
        // старые обещания подведены итогом выше — но откуда взяться новым,
        // если их никто не объявил? Без этой новости обещания в шапке менялись
        // молча, и на следующий день после выборов было не понять, что вообще
        // изменилось в условиях игры
        const nextPromises = pickPromises(result.economy);
        setPromises(nextPromises);
        result.newsEntries.unshift({ id: `newpromises${quarterIndex}`, cat: 'gov', priority: 8, q: quarterIndex, qLabel: quarterLabel(quarterIndex),
          headline: 'НОВЫЙ СРОК: ОБЪЯВЛЕНЫ ПРЕДВЫБОРНЫЕ ОБЕЩАНИЯ',
          text: `На новый срок заявлено: ${nextPromises.map((p) => `«${p.label}» — ${p.text.toLowerCase()}`).join('; ')}.` });
      }
    }
    const newCrisis = (result.economy.activeCrises || []).some((c) => !(economy.activeCrises || []).includes(c));
    if (newCrisis) { setFlashKey(quarterIndex); setShake(true); haptic([45, 70, 45, 70, 90]); setTimeout(() => setShake(false), 950); }
    else if (result.economy.regime !== economy.regime) { setFlashKey(quarterIndex); haptic([28, 60, 28]); }
    else haptic(14);
    Audio.quarterSequence({
      wellbeingDelta: result.economy.wellbeing - economy.wellbeing,
      newCrisis,
      bigNews: result.newsEntries.some((n) => n.priority >= 8),
      // выборы, переворот, падение режима, остановленные цены — у каждого своя музыкальная заставка
      stinger: stingerFor(economy, result.economy),
    });
    // без этого directiveProgress следующего квартала сравнивал бы решения с
    // тем, какими они были в САМОМ ПЕРВОМ квартале партии: базовая точка ни разу
    // не обновлялась, и «выполнено ли требование» проверялось не с начала этого
    // квартала, а с начала игры — там, где давнее ручное вмешательство игрока
    // уже само по себе считалось «движением», а свежее совпадало с базой и
    // засчитывалось как отказ, даже при максимальном ответе на директиву
    const nextDecisions = defaultDecisions(result.economy, decisions);
    setDecisions(nextDecisions);
    setDecisionsBaseline(nextDecisions);
    setQuarterIndex((q) => q + 1);
    setStampKey((k) => k + 1);
    setBusy(false);
    setFinishCooldown(3);
  }), [economy, decisions, pendingImpulses, eventCooldowns, setup, quarterIndex, botRole, stories, cbPersonaId, mofPersonaId,
    pendingRequest, portfolio, isTrader, isPresident, bothBots, history, pushAch, defeat, promises,
    presActions, presAppointCb, presAppointMof, presDirective, presDirStrength, warTarget,
    presEnabled, presidentPlan, presPersonaId, playerBranch, decisionsBaseline, presDirMemo, regionPlan, canPlanMap, warOrder, campaignPlan, treatyPlan, diploPlan,
    isPublic, canCommandDefense]);

  const setLever = (id, val) => setDecisions((dd) => ({ ...dd, [id]: val }));

  // музыка следует за режимом экономики и уровнем рисков
  React.useEffect(() => { Audio.setMood(economy); },
    [economy.regime, economy.inflationRisk, economy.bankingRisk, economy.debtRisk, economy.recessionRisk, economy.gdpGrowth,
      economy.inflation, economy.politicalRegime, economy.campaignActive, economy.stabilizationCred, economy.stabilizationWon]);
  React.useEffect(() => {
    Audio.setRole(setup.role === 'trader' ? 'trader' : setup.role === 'president' ? 'president' : null);
  }, [setup.role]);
  React.useEffect(() => () => Audio.stopMusic(), []);
  // вызов дня окончен: пройдены все кварталы или партия оборвалась поражением
  const dailyDone = !!daily && (quarterIndex > daily.quarters || !!defeat);
  const [showDaily, setShowDaily] = useState(false);
  const [dailyBoard, setDailyBoard] = useState(null);
  React.useEffect(() => {
    if (!dailyDone) return;
    setShowDaily(true);
    if (!defeat) pushAch(unlockAchievements(['daily_done']));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyDone]);
  const kpiDelta = (key) => economy[key] - prevEcon[key];
  const shareKey = (id) => (id === 'shareHealth' ? 'health' : id === 'shareEducation' ? 'education' : id === 'shareScience' ? 'science' : id === 'shareDefense' ? 'defense' : 'admin');

  return (
    <div className={`ems-root${shake ? ' ems-shake' : ''}${dense ? ' ems-dense' : ''}`} lang="ru">
      <GlobalStyle />
      {irf && (
        <Suspense fallback={(
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ems-panel-raised" style={{ padding: 18, color: COLOR.faint, fontSize: 12 }}>Загрузка графика…</div>
          </div>
        )}>
          <IRFModal economy={economy} decisions={decisions} lever={irf.lever} value={irf.value} baseValue={irf.base}
            difficulty={difficulty} onClose={() => setIrf(null)} />
        </Suspense>
      )}
      <Atmosphere regime={economy.regime} flashKey={flashKey}
        intensity={clamp((economy.inflationRisk * 0.25 + economy.bankingRisk * 0.3 + economy.debtRisk * 0.2 + economy.recessionRisk * 0.25) / 100, 0, 1)} />
      <QuarterStamp stampKey={stampKey} regime={economy.politicalRegime} />
      {showWhy && <WhyModal reasons={lastReasons} onClose={() => setShowWhy(false)} />}
      {showPaper && (
        <Suspense fallback={null}>
          <NewspaperModal news={newsFeed} history={history} quarterIndex={quarterIndex} economy={economy} onClose={() => setShowPaper(false)} />
        </Suspense>
      )}
      {saveModal && <SaveLoadModal mode={saveModal} snapshot={snapshot()} activeSlot={activeSlot} onClose={() => setSaveModal(null)}
        onLoad={(d) => { setSaveModal(null); onLoadState(d); }} onSaved={setActiveSlot} />}
      {showAch && <AchievementsModal onClose={() => setShowAch(false)} />}
      <AchievementToast toast={achToast} leaving={achLeaving} />
      {daily && dailyDone && showDaily && (
        <DailyResultModal daily={daily} goalId={setup.goal} economy={economy} defeat={defeat} quarterIndex={quarterIndex}
          role={setup.role} board={dailyBoard} setBoard={setDailyBoard}
          onClose={() => setShowDaily(false)} onMenu={onRestart} />
      )}
      {!daily && defeat && showGameOver && <GameOverModal defeat={defeat} quarterIndex={quarterIndex} onClose={() => setShowGameOver(false)}
        onRestart={onRestart} onOpenAch={() => setShowAch(true)} onShare={() => { setShowGameOver(false); setShowCard(true); }}
        onChronicle={() => { setShowGameOver(false); setShowChronicle(true); }}
        onRollback={rollbackTarget ? handleRollback : null} />}
      {showChronicle && <ChronicleModal history={history} onClose={() => setShowChronicle(false)} />}
      {showCard && <ResultCardModal onClose={() => setShowCard(false)} data={buildResultCard({
        role: setup.role, quarterIndex, economy, startEconomy: history[0], portfolio, defeat, promises,
      })} />}

      {/* Шапка в две строки: наверху — кто вы и инструменты, ниже — статус партии и
          переключатель экранов. Раньше всё жалось в одну строку и переносилось как придётся. */}
      <div style={{ borderTop: `2px solid ${COLOR.gold}`, borderBottom: `1px solid ${COLOR.hairline}`, padding: narrow ? '12px 16px' : '14px 22px',
        background: `linear-gradient(180deg, ${COLOR.panelRaised} 0%, ${COLOR.panel} 100%)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StateSeal regime={economy.politicalRegime} size={36}
            title={(POLITICAL_REGIME_INFO[economy.politicalRegime] || {}).label} />
          <div className="ems-card-icon" style={{ width: 40, height: 40 }}>
            <RoleIcon size={18} color={COLOR.gold} />
          </div>
          <div>
            {/* «Страна — экономическая панель» тут была раньше как заголовок —
                название приложения, а не игры: игроку это ни о чём не говорит
                на экране, где он уже внутри партии. Пост и его контекст —
                единственное, что имеет смысл заявлять здесь. */}
            <div className="ems-serif" style={{ fontSize: 18 }}>{roleDef.title}</div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
              сложность: {(DIFFICULTIES.find((x) => x.id === difficulty) || {}).title}
              {setup.scenario && setup.scenario !== 'sandbox' ? ` · сценарий: ${(SCENARIOS.find((sc) => sc.id === setup.scenario) || {}).title}` : ''}
              {activeBotPersona ? ` · вторая ветвь: ${activeBotPersona.name} (бот)`
                : isPresident ? ` · ЦБ: ${getCbPersona(cbPersonaId).name} (бот) · Минфин: ${getMofPersona(mofPersonaId).name} (бот)`
                  : setup.role === 'trader' ? '' : ' · без ботов'}
            </div>
            {daily && (
              <div style={{ fontSize: 12, color: COLOR.gold, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trophy size={11} />Вызов дня · {dailyDateLabel(daily.day)} · квартал {Math.min(quarterIndex, daily.quarters)} из {daily.quarters}
              </div>
            )}
          </div>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: narrow ? 0 : 'auto' }}>
          <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { Audio.play('click'); setSaveModal('save'); }} title="Сохранить или загрузить партию">
            <Save size={14} />Партия
          </button>
          {!narrow && <span style={{ fontSize: 12, color: autosaveFlash ? COLOR.teal : COLOR.faint, display: 'flex', alignItems: 'center', gap: 4, marginRight: 4, transition: 'color 0.6s ease' }}
            title={Number.isFinite(activeSlot)
              ? `Партия в слоте ${activeSlot + 1}: каждый квартал автосохраняется туда же (и параллельно в этот браузер).`
              : 'Партия не привязана ни к одному слоту сохранений: автосохраняется только в этом браузере и пропадёт при его очистке. Сохраните вручную («Партия»), чтобы закрепить её за слотом и не потерять при смене устройства.'}>
            <Check size={11} color={autosaveFlash ? COLOR.teal : COLOR.faint} />
            {Number.isFinite(activeSlot) ? `слот ${activeSlot + 1}` : 'только в браузере'}
          </span>}
          {/* на телефоне сложность, достижения и газета уходят в меню «⋯»: три ряда
              кнопок занимали треть экрана */}
          {!narrow && <div style={{ position: 'relative' }}>
            <select value={difficulty} onChange={(e) => { Audio.play('tab'); setDifficulty(e.target.value); }}
              disabled={!!daily} title={daily ? 'В вызове дня сложность у всех одна' : 'Сложность партии'} className="ems-btn"
              style={{ padding: '7px 26px 7px 9px', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}>
              {DIFFICULTIES.map((d) => (<option key={d.id} value={d.id}>{d.title}</option>))}
            </select>
            <ChevronDown size={12} color={COLOR.muted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>}
          <ViewSettings theme={theme} setTheme={setTheme} dense={dense} setDense={setDense}
            dashboards={dashboards} activeDash={activeDash} applyDash={applyDash} saveDash={saveDash}
            deleteDash={deleteDash} renameDash={renameDash} resetDash={resetDash}
            layoutEditMode={layout.layoutEditMode} setLayoutEditMode={layout.setLayoutEditMode}
            columnOrder={layout.columnOrder} moveColumn={layout.moveColumn}
            resetLayout={layout.resetLayout} layoutIsDefaultNow={layout.layoutIsDefaultNow}
            autoPaper={autoPaper} setAutoPaper={setAutoPaper} />
          {!narrow && (
            <button className="ems-btn" style={{ padding: '7px 9px' }} onClick={() => { Audio.play('click'); setShowAch(true); }} title="Коллекция достижений">
              <Trophy size={14} color={COLOR.gold} />
            </button>
          )}
          {!narrow && (
            <button className="ems-btn" style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { Audio.play('paper'); setShowPaper(true); }} title="Экономический вестник">
              <Newspaper size={14} />Газета
            </button>
          )}
          <AudioControls />
          <HeaderOverflowMenu items={[
            ...(narrow ? [
              { icon: Newspaper, label: 'Газета', onClick: () => { Audio.play('paper'); setShowPaper(true); } },
              { icon: Trophy, label: 'Достижения', onClick: () => setShowAch(true) },
              ...(daily ? [] : [{ icon: ChevronDown, label: `Сложность: ${(DIFFICULTIES.find((x) => x.id === difficulty) || {}).title} — сменить`, onClick: () => {
                const i = DIFFICULTIES.findIndex((x) => x.id === difficulty);
                setDifficulty(DIFFICULTIES[(i + 1) % DIFFICULTIES.length].id);
              } }]),
            ] : []),
            { icon: Share2, label: 'Карточка результата', onClick: () => setShowCard(true) },
            { icon: BookOpen, label: 'Разбор партии', onClick: () => setShowChronicle(true) },
            { icon: RotateCcw, label: 'Выйти в меню', danger: true, onClick: () => {
              if (window.confirm('Выйти в меню? Несохранённый прогресс партии будет потерян — при необходимости сохраните её кнопкой «Партия».')) { Audio.play('click'); onRestart(); }
            } },
          ]} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
          {/* статус партии — одной плашкой: период, выборы и рейтинг, благополучие */}
          {/* на телефоне колонки плашки сжимаются (minWidth 0), а шкала — нет: раньше на
              узком экране благополучие выталкивалось за правый край */}
          <div className="ems-status" style={narrow ? { width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', gap: 8, padding: '6px 10px', minWidth: 0 } : undefined}>
            <div style={{ whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
              <div className="ems-eyebrow" style={narrow ? { letterSpacing: '0.04em', fontSize: 11 } : undefined}>Период</div>
              <div className="ems-mono ems-serif" style={{ fontSize: narrow ? 13 : 15, fontWeight: 600, marginTop: 2, ...(narrow ? { letterSpacing: '-0.02em' } : {}) }}>{quarterLabel(quarterIndex)}</div>
            </div>
            <span className="sep" />
            <div style={{ whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
              <div className="ems-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 5, ...(narrow ? { letterSpacing: '0.04em', fontSize: 11 } : {}) }}>
                <Flag size={10} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{economy.noElections ? 'Выборов нет' : `Выборы${narrow ? '' : ' ·'} ${economy.quartersToElection} кв.`}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 3 }}>
                <span style={{ color: COLOR.muted }}>рейтинг </span>
                <span className="ems-mono" style={{ color: economy.approval >= 50 ? COLOR.teal : economy.approval >= 40 ? COLOR.gold : COLOR.rust, fontWeight: 700 }}>{Math.round(economy.approval)}</span>
              </div>
            </div>
            <span className="sep" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} title="Благополучие: сводная оценка жизни в стране">
              {!narrow && <div className="ems-eyebrow" style={{ lineHeight: 1.3 }}>Благо-<br />получие</div>}
              <Gauge value={economy.wellbeing} size={narrow ? 48 : 58} />
            </div>
          </div>
          {/* вкладки экрана — сегментированный переключатель; на телефоне во всю ширину */}
          <div className="ems-seg" role="group" aria-label="Экран" style={narrow ? { width: '100%' } : { marginLeft: 'auto' }}>
            {[['dash', 'Панель', GaugeIcon], ['map', 'Карта', MapIcon], ['society', 'Общество', Users], ['market', 'Рынок', TrendingUp], ...(isTrader ? [['casino', 'Казино', Dices]] : [])].map(([id, label, Icon]) => (
              <button key={id} aria-pressed={view === id} style={narrow ? { flex: 1, padding: '7px 4px', gap: 4, minWidth: 0 } : undefined}
                onClick={() => { Audio.play('tab'); setView(id); }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CrisisBar economy={economy} botAction={botAction} />

      {/* Показатели: на «Панели» — плитки, на остальных вкладках — строка-тикер,
          чтобы карта, общество и рынок начинались сразу под шапкой. */}
      <div style={{ padding: '12px 18px 0' }}>
        <KpiStrip pinned={pinned} economy={economy} history={history} kpiDelta={kpiDelta} dragPin={dragPin} setDragPin={setDragPin}
          reorderPin={reorderPin} movePin={movePin} togglePin={togglePin} maxPins={MAX_PINS} editMode={layout.layoutEditMode}
          ticker={view !== 'dash'} />
      </div>

      <div style={{ margin: '10px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SummaryBar economy={economy} demands={isPublic ? [] : demandItems({ botAction, botAction2: isPresident ? botAction2 : null,
          botRole: isPresident ? 'central_bank' : botRole, economy,
          president: presEnabled && presidentPlan && presidentPlan.directive && presidentPlan.directive.toPlayer ? presidentPlan : null })} />
        <RegimeBanner economy={economy} crisisOnly />
        {economy.regionEvent && view !== 'map' && (
          <RegionEventStrip event={economy.regionEvent} answered={!!regionPlan.regionResponse} canAnswer={canPlanMap}
            onOpen={() => { Audio.play('tab'); setView('map'); }} />
        )}
        {/* событие от соседа — напоминание только президенту: отвечает он */}
        {isPresident && economy.neighborEvent && view !== 'map' && !(diploPlan && diploPlan.reply) && (() => {
          const ev = neighborEventView(economy);
          if (!ev) return null;
          return (
            <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('map'); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('map'); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.goldDim, border: `1px solid ${COLOR.gold}`,
                borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
              <Globe2 size={15} color={COLOR.gold} style={{ flexShrink: 0 }} />
              <span><b style={{ color: COLOR.goldSoft }}>{ev.title}.</b>{' '}
                <span style={{ color: COLOR.muted }}>{ev.deadline - quarterIndex > 1 ? 'Срок ответа — до следующего квартала.' : 'Ответьте в этом квартале'} — на карте, в карточке страны.</span></span>
            </div>
          );
        })()}
        {/* требование группы — только тому, кто на него отвечает (Минфин, президент) */}
        {economy.groupDemand && view !== 'society' && canPlanMap && !regionPlan.groupResponse && (
          <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('society'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('society'); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`,
              borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
            <Users size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>{economy.groupDemand.title}.</b>{' '}
              <span style={{ color: COLOR.muted }}>{canPlanMap
                ? (regionPlan.groupResponse ? 'Ответ выбран — изменить можно на вкладке «Общество».' : 'Ответьте на вкладке «Общество», иначе это сочтут отказом.')
                : 'Отвечает Минфин — подробности на вкладке «Общество».'}</span></span>
          </div>
        )}
        {isPresident && economy.warType === 'offensive' && (economy.warQuartersLeft || 0) > 0 && view !== 'map' && (
          <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('map'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('map'); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`,
              borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
            <MapIcon size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>Наступление: {WAR_TARGETS[warTargetOf(economy)].name}.</b>{' '}
              <span style={{ color: COLOR.muted }}>{warOrder ? 'Приказ армии действует — его можно сменить на карте.' : economy.warCampaign && economy.warCampaign.last ? 'Армия выполняет прошлый приказ — сменить его можно на карте.' : 'Отдайте первый приказ армии на карте: цель и способ действий.'}</span></span>
          </div>
        )}
        {isPresident && view !== 'map' && electionForecast(economy) && !electionForecast(economy).closed && (() => {
          const f = electionForecast(economy, campaignPlan);
          const used = Object.values(campaignPlan).reduce((a, b) => a + b, 0);
          const swing = f.byRegion.filter((r) => r.label === 'колеблется').length;
          return (
            <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('map'); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('map'); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.goldDim, border: `1px solid ${COLOR.gold}`,
                borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
              <MapIcon size={15} color={COLOR.gold} style={{ flexShrink: 0 }} />
              <span><b style={{ color: COLOR.gold }}>Выборы через {f.quartersToElection} кв.: опрос {fmt1(f.national)}% ±{fmt1(f.margin)}.</b>{' '}
                <span style={{ color: COLOR.muted }}>Колеблющихся областей — {swing}. {used
                  ? `Штабов расставлено: ${used} — изменить можно на карте.`
                  : 'Штабы кампании не расставлены — сделайте это на карте, слой «Опросы».'}</span></span>
            </div>
          );
        })()}
        {canCommandDefense && view !== 'map' && economy.warType === 'defensive' && (economy.warQuartersLeft || 0) > 0 && (
          <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('map'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('map'); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`,
              borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
            <MapIcon size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>{DEF_ENEMY} наступает{economy.defenseCampaign && economy.defenseCampaign.occupied.length ? ' — часть страны под оккупацией' : ''}.</b>{' '}
              <span style={{ color: COLOR.muted }}>Где держать оборону, куда нанести контрудар или просить перемирия — на карте.</span></span>
          </div>
        )}
        {canCommandDefense && view !== 'map' && ((economy.warType === 'revanche' && (economy.warQuartersLeft || 0) > 0) || (isPresident && economy.peaceTalks)) && (
          <div role="button" tabIndex={0} className="ems-fade-in" onClick={() => { Audio.play('tab'); setView('map'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('map'); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: economy.peaceTalks ? COLOR.goldDim : COLOR.rustDim,
              border: `1px solid ${economy.peaceTalks ? COLOR.gold : COLOR.rust}`, borderRadius: 3, padding: '8px 11px', fontSize: 12, cursor: 'pointer' }}>
            <MapIcon size={15} color={economy.peaceTalks ? COLOR.gold : COLOR.rust} style={{ flexShrink: 0 }} />
            {economy.peaceTalks
              ? <span><b style={{ color: COLOR.gold }}>Переговоры с Норландом.</b>{' '}
                <span style={{ color: COLOR.muted }}>{treatyPlan && treatyPlan.propose ? 'Договор будет предложен в конце квартала.' : `Позиция страны ${Math.round(economy.peaceTalks.leverage)} и тает с каждым кварталом — условия мира задаются на карте.`}</span></span>
              : <span><b style={{ color: COLOR.rust }}>Норланд наступает на новые земли.</b>{' '}
                <span style={{ color: COLOR.muted }}>Какую область укрепить и как — на карте.</span></span>}
          </div>
        )}
        {(economy.activeCrises || []).filter((c) => c !== economy.regime).map((c) => (
          <div key={c} className="ems-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 3, padding: '8px 11px', fontSize: 12 }}>
            <AlertTriangle size={15} color={COLOR.rust} style={{ flexShrink: 0 }} />
            <span><b style={{ color: COLOR.rust }}>{CRISIS_INFO[c] ? regimeInfoLabel(CRISIS_INFO[c], economy) : c}.</b> <span style={{ color: COLOR.muted }}>{CRISIS_INFO[c] ? regimeInfoText(CRISIS_INFO[c], economy) : ''}</span></span>
          </div>
        ))}
      </div>

      <KeepAlive active={view === 'map'} style={{ padding: '14px 18px 18px' }}>
        <Suspense fallback={<ChartFallback />}>
          <CountryMap economy={economy} plan={regionPlan} onPlan={canPlanMap && !defeat ? setRegionPlan : null}
            planner={`Минфин (бот, ${getMofPersona(mofPersonaId).name.toLowerCase()})`}
            warOrder={warOrder} onWarOrder={!defeat && (isPresident || (canCommandDefense && economy.warType !== 'offensive')) ? setWarOrder : null}
            warPlanner={presEnabled ? `президент (бот, ${getPresPersona(presPersonaId).name.toLowerCase()})` : 'Генштаб по уставу'}
            campaignPlan={campaignPlan} onCampaignPlan={isPresident && !defeat ? setCampaignPlan : null}
            campaignPlanner={presEnabled ? `президент (бот, ${getPresPersona(presPersonaId).name.toLowerCase()})` : 'штаб власти'}
            treatyPlan={treatyPlan} onTreatyPlan={isPresident && !defeat ? setTreatyPlan : null}
            treatyPlanner={presEnabled ? `президент (бот, ${getPresPersona(presPersonaId).name.toLowerCase()})` : 'МИД по поручению правительства'}
            diploPlan={diploPlan} onDiploPlan={isPresident && !defeat ? setDiploPlan : null}
            warPlan={presActions.includes('war_start') ? (warTarget || 'north') : null} onWarPlan={isPresident && !defeat ? planWar : null}
            diploPlanner={presEnabled ? `президент (бот, ${getPresPersona(presPersonaId).name.toLowerCase()})` : 'МИД по поручению правительства'} />
        </Suspense>
      </KeepAlive>

      {view === 'society' && (
        <div style={{ padding: '14px 18px 18px' }}><Suspense fallback={<ChartFallback />}>
          <SocietyView economy={economy} plan={regionPlan} onPlan={canPlanMap && !defeat ? setRegionPlan : null}
            planner={`Минфин (бот, ${getMofPersona(mofPersonaId).name.toLowerCase()})`} />
        </Suspense></div>
      )}
      {view === 'market' && (
        <MarketScreen economy={economy} prev={prevEcon} history={history}
          book={isTrader ? portfolio : null} onTrade={onTrade} />
      )}

      {view === 'casino' && isTrader && (
        <div style={{ padding: '0 18px 18px' }}>
          <Suspense fallback={<ChartFallback />}><CasinoScreen book={portfolio} onCasino={onCasino} /></Suspense>
        </div>
      )}


      {(() => {
      /* ЛЕВАЯ ПАНЕЛЬ */
      const leftNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isTrader && (
            <Suspense fallback={<ChartFallback height={120} />}>
              <PortfolioSummary book={portfolio} economy={economy} live={null} goal={setup.goal}
                prevValue={portfolio.history && portfolio.history.length > 1 ? portfolio.history[portfolio.history.length - 2] : null} />
            </Suspense>
          )}
          {isTrader && (
            <div className="ems-panel" style={{ padding: 12, fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
              Торговля идёт на вкладке <b style={{ color: COLOR.text }}>«Рынок»</b>: там терминал с ценами, которые
              меняются в реальном времени. Сделки исполняются мгновенно по текущей котировке, плечо ограничено 60% капитала
              и стоит ставку по кредитам.
            </div>
          )}
          {isPresident && (
            <>
              <PresidentPanel economy={economy} cooldowns={eventCooldowns}
                selected={presActions} setSelected={setPresActions}
                cbPersonaId={cbPersonaId} mofPersonaId={mofPersonaId}
                appointCb={presAppointCb} setAppointCb={setPresAppointCb}
                appointMof={presAppointMof} setAppointMof={setPresAppointMof}
                directive={presDirective} setDirective={setPresDirective} lastDirective={lastDirective}
                directiveStrength={presDirStrength} setDirectiveStrength={setPresDirStrength} />
              <div className="ems-panel" style={{ padding: 12, fontSize: 12, color: COLOR.muted, lineHeight: 1.5 }}>
                Приоритет: <b style={{ color: COLOR.text }}>{goalDef.label}</b>. Ставку ведёт бот-ЦБ, бюджет — бот-Минфин;
                их решения и заявления ниже. Вы влияете на экономику только через людей, которых назначаете, указания,
                которые они могут не выполнить, и реформы, которые окупятся уже при следующем президенте.
              </div>
            </>
          )}
          {!isPublic && !isPresident && (
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
              <RoleIcon size={14} />Ваши полномочия
            </div>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 10 }}>Приоритет: {goalDef.label}</div>

            {crisisActive && (
              <div style={{ paddingBottom: 10 }}>
                <button className="ems-btn" style={{ width: '100%', background: decisions.emergency ? COLOR.rust : COLOR.panelAlt, color: decisions.emergency ? '#fff' : COLOR.text, borderColor: COLOR.rust }}
                  onClick={() => { Audio.play(decisions.emergency ? 'click' : 'alarm'); setLever('emergency', !decisions.emergency); }}>
                  {decisions.emergency ? <Check size={13} style={{ verticalAlign: -2 }} /> : <ShieldAlert size={13} style={{ verticalAlign: -2 }} />} Экстренная поддержка банков
                </button>
                <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>Спасёт капитал банков, но ударит по доверию к ЦБ и добавит инфляции.</div>
              </div>
            )}

            {groups.includes('fiscal') && economy.imfActive && (
              <div style={{ paddingBottom: 10 }}>
                <div className="ems-panel" style={{ padding: '9px 11px', borderColor: COLOR.gold, fontSize: 12, color: COLOR.text, lineHeight: 1.45 }}>
                  <b style={{ color: COLOR.goldSoft }}>Программа МВФ действует ещё {economy.imfQuartersLeft} кв.</b> Расходы и выплаты обязаны сокращаться — это условие программы, не ваше решение на этот квартал.
                </div>
              </div>
            )}
            {groups.includes('fiscal') && debtCrisisActive && !economy.imfActive && (
              <div style={{ paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <button className="ems-btn" style={{ width: '100%', background: COLOR.panelAlt, color: COLOR.text, borderColor: COLOR.rust }}
                    onClick={() => {
                      if (!window.confirm('Объявить дефолт по государственному долгу? Часть долга спишется разом, но рынок закроется для новых займов на несколько кварталов, а доверие резко упадёт. Отменить это решение будет нельзя.')) return;
                      Audio.play('alarm'); setLever('sovereignDefault', true);
                    }}>
                    <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Объявить дефолт по госдолгу
                  </button>
                  <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>
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
                  <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 5, lineHeight: 1.4 }}>
                    Альтернатива дефолту: долг не списывается, доступ к рынкам не закрывается, ставка сразу дешевле. Взамен — обязательная консолидация на два года, которую нельзя будет отменить по своему усмотрению.
                  </div>
                </div>
              </div>
            )}

            {LEVER_TABS.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
                {LEVER_TABS.map((t) => (
                  <button type="button" key={t.id} className={`ems-tab ${levTab === t.id ? 'active' : ''}`} aria-pressed={levTab === t.id} style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => { Audio.play('tab'); setLevTab(t.id); }}>{t.label}</button>
                ))}
              </div>
            )}

            {levTab === 'monetary-core' && (
              <div>
                {levers.filter((l) => l.group === 'monetary' && l.subgroup === 'core').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
                <Segmented label="Режим валютного курса" options={FX_REGIMES} value={decisions.fxRegime} onChange={(v) => setLever('fxRegime', v)} />
              </div>
            )}
            {levTab === 'monetary-macropru' && (
              <div>
                {levers.filter((l) => l.group === 'monetary' && l.subgroup === 'macropru').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-core' && (
              <div>
                {economy.sequesterFactor < 0.995 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: COLOR.rustDim, border: `1px solid ${COLOR.rust}`, borderRadius: 4, padding: '8px 10px', marginBottom: 10 }}>
                    <AlertTriangle size={14} color={COLOR.rust} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.45 }}>
                      <b>Секвестр действует.</b> Рынок не финансирует дефицит сверх {fmt1(economy.maxDeficitPct)}% ВВП — реальные расходы урезаны на {fmt1((1 - economy.sequesterFactor) * 100)}% от плана независимо от того, что задано ползунками ниже.
                    </div>
                  </div>
                )}
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'core').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-taxes' && (
              <div>
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'taxes').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} onIRF={(lv, val, base) => setIrf({ lever: lv, value: val, base })}
                    preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-budget' && (
              <div>
                <div style={{ fontSize: 12, color: COLOR.faint, margin: '2px 0 8px', lineHeight: 1.4 }}>Доли нормализуются к 100%. Образование и здравоохранение растят человеческий капитал, наука — производительность. Эффект — годы, не кварталы.</div>
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'budget').map((l) => (
                  <LeverSlider key={l.id} lever={l} currentDisplay={economy.budgetShares[shareKey(l.id)]}
                    value={decisions[l.id]} onChange={(v) => setLever(l.id, v)} preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
              </div>
            )}
            {levTab === 'fiscal-debt' && (
              <div>
                <div style={{ fontSize: 12, color: COLOR.faint, margin: '2px 0 8px', lineHeight: 1.4 }}>
                  Дефицит финансируется сам — рынок и так занимает за вас ровно столько, сколько не хватает. Здесь — добровольное решение занять сверх этого: долг растёт сразу, а деньги идут в резерв на будущее, а не в расходы этого квартала.
                </div>
                {levers.filter((l) => l.group === 'fiscal' && l.subgroup === 'debt').map((l) => (
                  <LeverSlider key={l.id} lever={scaleLever(l, economy)} currentDisplay={economy[l.id]} value={decisions[l.id]}
                    onChange={(v) => setLever(l.id, v)} preview={leverPreview(l.id, decisions[l.id], economy, difficulty)} infTarget={decisions.inflationTarget} />
                ))}
              </div>
            )}
          </div>
          )}
          <Fold id="request" title="Запрос другому ведомству" icon={Megaphone} summary={pendingRequest ? 'запрос выбран' : 'без запроса'}>
            <RequestPanel role={setup.role} botRole={botRole} pending={pendingRequest} setPending={setPendingRequest} lastResponse={lastResponse} />
          </Fold>
          {groups.includes('fiscal') && (
            <Fold id="fiscal" title="Бюджетная арифметика" icon={Scale}
              summary={`баланс ${fmtSigned1(economy.budgetBalancePctGdp)}% ВВП · долг ${fmt1(economy.debtToGdp)}%`}>
              <FiscalMath economy={economy} decisions={decisions} />
            </Fold>
          )}
          {isPublic ? (
            <InstitutionsPanel economy={economy} cbAction={botAction} mofAction={botAction2} />
          ) : isPresident ? (
            <>
              <PromisesPanel promises={promises} economy={economy} />
              <Fold id="bot-cb" title="Центральный банк · бот" icon={Landmark}
                summary={`${getCbPersona(cbPersonaId).name} · ставка ${fmt2(economy.keyRate)}%`}>
                <BotPanel botRole="central_bank" persona={getCbPersona(cbPersonaId)} lastAction={botAction} coordination={economy.policyCoordination} economy={economy} />
              </Fold>
              <Fold id="bot-mof" title="Минфин · бот" icon={Coins}
                summary={`${getMofPersona(mofPersonaId).name} · баланс ${fmtSigned1(economy.budgetBalancePctGdp)}% ВВП`}>
                <BotPanel botRole="ministry_finance" persona={getMofPersona(mofPersonaId)} lastAction={botAction2} coordination={economy.policyCoordination} economy={economy} />
              </Fold>
            </>
          ) : botRole ? (
            <Fold id={`bot-${botRole}`} title={botRole === 'central_bank' ? 'Центральный банк · бот' : 'Минфин · бот'}
              icon={botRole === 'central_bank' ? Landmark : Coins}
              summary={activeBotPersona ? `${activeBotPersona.name} · ${botRole === 'central_bank' ? `ставка ${fmt2(economy.keyRate)}%` : `баланс ${fmtSigned1(economy.budgetBalancePctGdp)}% ВВП`}` : ''}>
              <BotPanel botRole={botRole} persona={activeBotPersona} lastAction={botAction} coordination={economy.policyCoordination} economy={economy} />
            </Fold>
          ) : (
            <PromisesPanel promises={promises} economy={economy} />
          )}
          {!isPublic && pickPressQuestion(economy, quarterIndex) && (
            <Fold id="press" title="Пресс-конференция" icon={Megaphone} summary={decisions.pressAnswer ? 'ответ выбран' : 'ждут вашего ответа'}>
              <PressConferencePanel question={pickPressQuestion(economy, quarterIndex)} answer={decisions.pressAnswer}
                setAnswer={(id) => setLever('pressAnswer', id)} />
            </Fold>
          )}
          {presEnabled && (
            <Fold id="president" title="Президент" icon={Crown} defaultOpen={false}
              summary={`${getPresPersona(presPersonaId).name} · ${presidentPlan && presidentPlan.directive && presidentPlan.directive.toPlayer ? 'есть требование к вам' : 'требований к вам нет'}`}>
              <PresidentWatchPanel economy={economy} plan={presidentPlan} last={presidentLast} branch={playerBranch} />
            </Fold>
          )}
        </div>
      );
      /* ЦЕНТР */
      const centerNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <NewsTerminal items={newsFeed} onOpenPaper={() => setShowPaper(true)} />
          <Suspense fallback={<ChartFallback />}>
            <ChartPanel history={history} chartGroup={chartGroup} setChartGroup={setChartGroup} hiddenSeries={hiddenSeries} setHiddenSeries={setHiddenSeries} period={period} setPeriod={setPeriod} />
          </Suspense>
          <Fold id="report" title="Квартальный отчёт" icon={Newspaper} summary={history[history.length - 1].label}>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Квартальный отчёт</span>
              {lastReport && <button className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { Audio.play('click'); setShowWhy(true); }}><Info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Почему это произошло?</button>}
            </div>
            {/* официальный бюллетень, но в палитре кабинета, а не полноцветной «Газеты»:
                двойная линейка сохраняет жанр, фон и текст остаются тёмными */}
            <div style={{ background: COLOR.panelRaised, color: COLOR.text, padding: '16px 18px',
              borderTop: `3px double ${COLOR.gold}`, borderLeft: `1px solid ${COLOR.border}`,
              borderRight: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` }}>
              {lastReport ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${COLOR.border}`, paddingBottom: 8, marginBottom: 10 }}>
                    <span className="ems-serif" style={{ fontSize: 14, fontWeight: 700 }}>{history[history.length - 1].label}</span>
                    <span className="ems-mono" style={{ fontSize: 12, color: COLOR.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>бюллетень · {roleDef.short}</span>
                  </div>
                  <div className="ems-serif" style={{ fontSize: 13, lineHeight: 1.65 }} role="status" aria-live="polite">{lastReport}</div>
                </>
              ) : (
                <div className="ems-serif" style={{ fontSize: 13, color: COLOR.muted }}>Настройте политику слева и завершите первый квартал. Помните: между решением и результатом стоит цепочка — ставка меняет стоимость кредита, кредит меняет спрос, спрос меняет цены.</div>
              )}
            </div>
          </div>
          </Fold>
        </div>
      );
      /* ПРАВАЯ ПАНЕЛЬ */
      const rightNode = (
        <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fold id="scores" title="Пять оценок вашей политики" icon={Trophy} summary={scoreSummary(economy)}>
            <ScorePanel economy={economy} prev={prevEcon} goalDef={goalDef} />
          </Fold>
          <div className="ems-panel" style={{ padding: 14 }}>
            <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 9 }}>Показатели экономики</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 11 }} className="ems-scroll">
              {tabs.map((t) => {
                const TabIcon = t.icon;
                return (
                  <button type="button" key={t.id} className={`ems-tab ${activeTab === t.id ? 'active' : ''}`} aria-pressed={activeTab === t.id} onClick={() => { Audio.play('tab'); setActiveTab(t.id); }}>
                    {TabIcon && <TabIcon size={12} />}{t.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(tabs.find((t) => t.id === activeTab) || tabs[0]).rows.map((row, i, arr) => {
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
          {!isPublic && <DemandsPanel demands={economy.demands} />}
        </div>
      );
      const nodes = {
        left: <CabinetZone hidden={narrow && mobileCol !== 'left'}>{leftNode}</CabinetZone>,
        center: <StateZone label="Экономический вестник" hidden={narrow && mobileCol !== 'center'}>{centerNode}</StateZone>,
        right: <StateZone label="Показатели страны" hidden={narrow && mobileCol !== 'right'}>{rightNode}</StateZone>,
      };
      const order = layout.wide ? layout.columnOrder : DEFAULT_COLUMN_ORDER;
      const colWidthFor = (id) => (id === 'center' ? 'minmax(0,1fr)' : `${layout.columnWidths[id]}px`);
      const gridStyle = { padding: 18,
        ...(layout.wide ? { gridTemplateColumns: order.map(colWidthFor).join(' ') } : null) };
      // пока открыта карта или другая вкладка, спрятанная панель не перерисовывается (см. KeepAlive)
      return (
        <KeepAlive active={view === 'dash'}>
        <div className="ems-grid" style={gridStyle}>
          {order.map((id, i) => (
            <StickyColumn key={id} enabled={layout.wide}>
              {nodes[id]}
              {layout.wide && layout.layoutEditMode && i < order.length - 1 && (
                <ColumnResizeHandle leftId={id} rightId={order[i + 1]} widths={layout.columnWidths}
                  onResize={layout.setColumnWidthsLive} onCommit={layout.commitWidths} />
              )}
            </StickyColumn>
          ))}
        </div>
        </KeepAlive>
      );
      })()}

      {/* колонки на телефоне — в нижней панели над кнопкой квартала: всегда под пальцем
          и никогда не прячутся за ней (сверху на коротком экране кнопка их закрывала) */}
      <div style={narrow ? { position: 'sticky', bottom: 0, zIndex: 6 } : undefined}>
      {narrow && view === 'dash' && (
        <div style={{ padding: '8px 12px 0', background: COLOR.panel, borderTop: `1px solid ${COLOR.hairline}` }}>
          <div className="ems-seg" role="group" aria-label="Колонка" style={{ width: '100%', display: 'flex' }}>
          {[['left', setup.role === 'trader' ? 'Капитал' : 'Решения'], ['center', 'Новости и графики'], ['right', 'Показатели']].map(([id, label]) => (
            <button key={id} aria-pressed={mobileCol === id} style={{ flex: 1, padding: '8px 4px', fontSize: 12 }}
              onClick={() => { Audio.play('tab'); setMobileCol(id); }}>{label}</button>
          ))}
          </div>
        </div>
      )}
      {daily && dailyDone ? (
        <DailyBar score={dailyScore(economy, setup.goal, !!defeat)} defeat={defeat}
          onReopen={() => setShowDaily(true)} onMenu={onRestart} />
      ) : defeat ? (
        <GameOverBar defeat={defeat} onReopen={() => setShowGameOver(true)} onRestart={onRestart}
          onRollback={rollbackTarget ? handleRollback : null} />
      ) : (
        <div style={{ borderTop: `1px solid ${COLOR.hairline}`, background: COLOR.panel, padding: narrow ? '10px 16px' : '14px 18px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0,
          zIndex: 5, boxShadow: '0 -6px 20px -10px rgba(0,0,0,0.4)' }}>
          {/* на телефоне пояснение съедало половину панели и переносилось в две строки */}
          <span className="ems-hide-narrow" style={{ fontSize: 12, color: COLOR.faint, marginRight: 'auto' }}>
            {botRole === 'both' ? 'Центральный банк и Минфин примут решения без вашего участия'
              : botRole ? `${botRole === 'central_bank' ? 'Центральный банк' : 'Минфин'} примет своё решение одновременно с вами`
                : 'Обе ветви политики под вашим контролем'}
          </span>
          <button className="ems-btn primary" style={{ padding: narrow ? '12px 16px' : '12px 26px', fontSize: 14, width: narrow ? '100%' : undefined }} disabled={busy || finishCooldown > 0} onClick={finishQuarter}
            aria-label="Завершить квартал и применить решения">
            {busy ? 'Обработка…' : finishCooldown > 0 ? `Подождите ${finishCooldown}с` : 'Завершить квартал'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
