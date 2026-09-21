/* Газета («Газета и хроника»), вынесенная из MacroSimulator.jsx в отдельный
   чанк: открывается по клику из панели новостей, а не с первого экрана,
   поэтому грузится лениво через React.lazy() в MacroSimulator.jsx — как и
   src/charts.jsx и src/casino.jsx.

   COLOR/Audio/NEWS_CATEGORIES/catOf/ChainTrail — тот же самый общий
   объект/массив/функция/компонент, что и в MacroSimulator.jsx (экспортированы
   оттуда, используются и панелью новостей в игре), а не копия. */
import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { clamp, pctFmt, fmt1, fmtIndex, fmtSignedPct, fmtSigned1, quarterLabel, REGIME_INFO, regimeInfoText, POLITICAL_REGIME_INFO } from './lib/engine.js';
import { COLOR, Audio, NEWS_CATEGORIES, catOf, ChainTrail, StateSeal, useEscapeClose } from './MacroSimulator.jsx';

/* Политический режим красит газету: чем дальше от демократии, тем холоднее и темнее
   бумага — это должно читаться раньше, чем игрок разберёт хоть одно слово текста. */
const mixHex = (a, b, t) => {
  const c = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const m = (i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, '0');
  return `#${m(1)}${m(3)}${m(5)}`;
};
const hexLuminance = (hex) => {
  const c = (i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
};
const contrastRatio = (hexA, hexB) => {
  const a = hexLuminance(hexA); const b = hexLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
/* Тоталитарная бумага светлеет фоном и темнеет текстом (наоборот у демократии) —
   а линейная интерполяция между двумя такими концами на полпути неизбежно сводит
   и фон, и текст к одному и тому же блёклому серому: газета читалась ровно так,
   как её описал игрок, — серым по серому. Если смешанный текст на смешанном фоне
   не набирает читаемого контраста, дотягиваем его до чёрного или белого — смотря
   что дальше от фона в моменте — вместо того чтобы верить, что оба конца сами
   разойдутся к нужным крайностям. */
const ensureReadable = (bgHex, fgHex, minRatio) => {
  if (contrastRatio(bgHex, fgHex) >= minRatio) return fgHex;
  const toward = hexLuminance(bgHex) > 0.4 ? '#000000' : '#FFFFFF';
  let result = fgHex;
  for (let t = 0.05; t <= 1; t += 0.05) {
    result = mixHex(fgHex, toward, t);
    if (contrastRatio(bgHex, result) >= minRatio) break;
  }
  return result;
};
const POLITICAL_PAPER_TARGET = {
  crisis: { paper: '#E2D9BE', paperText: '#241C12', paperMuted: '#6B5A3E', paperRule: '#8C6B3E' },
  authoritarian: { paper: '#B5AF9C', paperText: '#1C1B15', paperMuted: '#4A483C', paperRule: '#6C6755' },
  totalitarian: { paper: '#22252A', paperText: '#B7B7AC', paperMuted: '#6B6D66', paperRule: '#48493F' },
};
function politicalPaperPalette(base, economy) {
  const regime = economy && economy.politicalRegime;
  const target = POLITICAL_PAPER_TARGET[regime];
  if (!target) return { ...base, k: 0, regime };
  const tension = clamp((economy.politicalTension || 0) / 100, 0, 1);
  const war = (economy.warQuartersLeft || 0) > 0;
  const k = regime === 'totalitarian' ? clamp(0.6 + tension * 0.3 + (war ? 0.1 : 0), 0.6, 1)
    : regime === 'authoritarian' ? clamp(0.6 + tension * 0.35, 0.6, 0.95)
      : clamp(0.18 + tension * 0.3, 0.18, 0.5); // crisis: тревожно, но ещё не мрачно
  const paper = mixHex(base.paper, target.paper, k);
  const paperRule = mixHex(base.paperRule, target.paperRule, k);
  return {
    paper,
    paperText: ensureReadable(paper, mixHex(base.paperText, target.paperText, k), 4.5),
    paperMuted: ensureReadable(paper, mixHex(base.paperMuted, target.paperMuted, k), 3.0),
    paperRule,
    k, regime,
  };
}
/* «Материальность» бумаги: зерно, лёгкое старение к краям и — для тоталитаризма —
   подпалённые углы. Интенсивность растёт вместе с k, так что демократическая
   бумага остаётся чистой и хрустящей, а тоталитарная выглядит так, будто её
   читали при свече и один раз чуть не сожгли. */
function PaperTexture({ k, burn }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05 + k * 0.16, mixBlendMode: 'multiply',
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        backgroundSize: '180px 180px' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(120% 90% at 50% 42%, transparent 52%, rgba(20,14,6,${0.06 + k * 0.24}) 100%)` }} />
      {/* сгиб — тонкая тень посередине листа, как от сложенной пополам газеты */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, pointerEvents: 'none',
        background: `linear-gradient(90deg, transparent, rgba(0,0,0,${0.05 + k * 0.08}), transparent)` }} />
      {burn > 0 && (
        <>
          <div style={{ position: 'absolute', top: -36, left: -36, width: 190, height: 190, pointerEvents: 'none', filter: 'blur(3px)', opacity: burn,
            background: 'radial-gradient(circle, rgba(18,9,3,0.95) 0%, rgba(46,24,8,0.55) 38%, transparent 72%)' }} />
          <div style={{ position: 'absolute', bottom: -46, right: -30, width: 230, height: 230, pointerEvents: 'none', filter: 'blur(4px)', opacity: burn,
            background: 'radial-gradient(circle, rgba(15,7,2,0.92) 0%, rgba(40,20,7,0.5) 40%, transparent 72%)' }} />
          <div style={{ position: 'absolute', top: -20, right: -50, width: 140, height: 140, pointerEvents: 'none', filter: 'blur(3px)', opacity: burn * 0.7,
            background: 'radial-gradient(circle, rgba(18,9,3,0.85) 0%, transparent 68%)' }} />
        </>
      )}
    </>
  );
}

/* Иконка «экономической погоды» на первой полосе — тот же REGIME_INFO, которым
   уже размечена авариная строка панели, только переведённый в один символ:
   свежий взгляд на состояние экономики, не изобретающий новую классификацию. */
const WEATHER_ICON = {
  normal: '☀️', overheating: '🌡️', recession: '☁️', stagflation: '🌪️',
  banking: '🌊', debt: '📉', currency: '💱', deflation: '❄️', pandemic: '🦠', war: '⚔️',
};
/* Девять рубрик NEWS_CATEGORIES на первой полосе выглядели бы как девять
   маленьких колонок ни о чём — читатель не понимает, где заканчивается одна
   тема и начинается другая. Разделы группируют их в тот же костяк, которым
   устроена любая деловая газета: политика, деньги, рынки, экономика, общество, мир. */
const NEWS_SECTION = {
  gov: 'ПОЛИТИКА И ПРАВИТЕЛЬСТВО', cb: 'ДЕНЬГИ И БАНКИ', markets: 'РЫНКИ',
  business: 'ЭКОНОМИКА', households: 'ОБЩЕСТВО', world: 'МИР',
};
const NEWS_SECTION_ORDER = ['gov', 'cb', 'markets', 'business', 'households', 'world'];

/* Строка тикера — курсив цифр наверху полосы, как в деловой прессе: значение
   и стрелка относительно предыдущего выпуска, без лишних слов. */
function TickerStat({ label, value, delta, pp }) {
  const arrow = !Number.isFinite(delta) || Math.abs(delta) < 1e-9 ? null : delta > 0 ? '▲' : '▼';
  return (
    <span className="ems-mono" style={{ fontSize: 10.5, color: pp.paperMuted, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      {label} <b style={{ color: pp.paperText }}>{value}</b>{arrow && <span style={{ fontSize: 8.5 }}>{arrow}</span>}
    </span>
  );
}

/* Газета: выпуск квартала, хроника страны и сюжетные линии */
export function NewspaperModal({ news, history, quarterIndex, onClose, economy }) {
  useEscapeClose(onClose);
  const [tab, setTab] = useState('issue');
  const [chronicleFilter, setChronicleFilter] = useState('all');
  const [chronicleSearch, setChronicleSearch] = useState('');
  const [chronicleShown, setChronicleShown] = useState(8);
  const quarters = useMemo(() => {
    const map = new Map();
    news.forEach((n) => { if (!map.has(n.q)) map.set(n.q, []); map.get(n.q).push(n); });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [news]);
  const latest = quarters.length ? quarters[0] : null;
  const issueItems = latest ? latest[1] : [];
  // мнение — колонка, а не главная тема: ведёт номер твёрдая новость, если она
  // вообще была, и только в совсем тихий квартал мнение остаётся единственным
  // кандидатом на первую полосу
  const lead = issueItems.find((n) => n.cat !== 'editorial' && n.cat !== 'opinion') || issueItems.find((n) => n.cat !== 'editorial');
  const editorial = issueItems.find((n) => n.cat === 'editorial');
  // «мнение» теперь одно на квартал (см. движок) — есть смысл дать ему
  // собственную колонку, а не смешивать с обычными заметками сетки
  const opinionItem = issueItems.find((n) => n.cat === 'opinion' && n !== lead);
  // кризисные заметки — не рубрика среди прочих, а тревога, которая должна
  // читаться раньше обычной сетки
  const urgentItems = issueItems.filter((n) => n !== lead && n !== editorial && n !== opinionItem && n.cat === 'crisis');
  const rest = issueItems.filter((n) => n !== lead && n !== editorial && n !== opinionItem && !urgentItems.includes(n));
  const sections = NEWS_SECTION_ORDER
    .map((cat) => ({ cat, label: NEWS_SECTION[cat], items: rest.filter((n) => n.cat === cat) }))
    .filter((s) => s.items.length > 0);
  const snapshot = latest ? history.find((h) => h.q === latest[0]) : null;
  const prevSnapshot = latest ? history.find((h) => h.q === latest[0] - 1) : null;
  const delta = (key) => (snapshot && prevSnapshot && Number.isFinite(snapshot[key]) && Number.isFinite(prevSnapshot[key]) ? snapshot[key] - prevSnapshot[key] : NaN);

  const stories = useMemo(() => {
    const map = new Map();
    news.slice().reverse().forEach((n) => {
      if (!n.storyId) return;
      const key = `${n.storyId}`;
      if (!map.has(key)) map.set(key, { id: key, title: n.storyTitle, steps: [] });
      map.get(key).steps.push(n);
    });
    return [...map.values()].reverse();
  }, [news]);

  const pp = politicalPaperPalette(COLOR, economy || {});
  const regimeId = economy && economy.politicalRegime;
  const econRegimeId = economy && economy.regime;
  const weatherIcon = WEATHER_ICON[econRegimeId] || WEATHER_ICON.normal;
  const weatherInfo = REGIME_INFO[econRegimeId] || REGIME_INFO.normal;
  const atWar = economy && (economy.warQuartersLeft || 0) > 0;
  // подпалины — только у тоталитаризма всерьёз («слегка сгоревшая», как и просили);
  // авторитаризм получает лёгкий намёк, чтобы переход не был внезапным
  const burnIntensity = pp.regime === 'totalitarian' ? pp.k : pp.regime === 'authoritarian' ? pp.k * 0.3 : 0;
  const PaperBox = ({ children, style }) => (
    <div style={{ position: 'relative', overflow: 'hidden', background: pp.paper, color: pp.paperText, border: `1px solid ${pp.paperRule}`,
      padding: '18px 20px', boxShadow: '0 18px 50px -18px rgba(0,0,0,0.65), 0 4px 14px rgba(0,0,0,0.35)',
      transition: 'background 1.2s ease, color 1.2s ease, border-color 1.2s ease', ...style }}>
      <PaperTexture k={pp.k || 0} burn={burnIntensity} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );

  // хроника: фильтр по рубрике + поиск по тексту + постраничная подгрузка —
  // без них лента через десяток-другой кварталов превращается в стену текста,
  // в которой ничего конкретного не найти
  const filteredQuarters = useMemo(() => {
    const q = chronicleSearch.trim().toLowerCase();
    return quarters
      .map(([qi, list]) => [qi, list.filter((n) => n.cat !== 'editorial'
        && (chronicleFilter === 'all' || n.cat === chronicleFilter)
        && (!q || n.headline.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)))])
      .filter(([, list]) => list.length > 0);
  }, [quarters, chronicleFilter, chronicleSearch]);
  const chronicleCats = NEWS_CATEGORIES.filter((c) => c.id !== 'editorial' && quarters.some(([, list]) => list.some((n) => n.cat === c.id)));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,14,0.82)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', overflowY: 'auto' }} onClick={onClose}>
      <div className="ems-fade-in" style={{ maxWidth: 940, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <PaperBox>
          <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 8, justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px double ${pp.paperRule}`, paddingBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              {/* На узком экране заголовок в две капслочных «стены» шириной под 30px
                  не влезает рядом с печатью и крестиком закрытия: без flexWrap выше
                  и уменьшения кегля здесь крестик просто выталкивало за край экрана —
                  не пропадал из DOM, но становился недостижимым. */}
              <div className="ems-serif" style={{ fontSize: 'clamp(20px, 7vw, 30px)', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.1 }}>ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div>
              <div className="ems-mono" style={{ fontSize: 10, color: pp.paperMuted, marginTop: 6, letterSpacing: '0.08em' }}>
                ЕЖЕКВАРТАЛЬНОЕ ИЗДАНИЕ · {latest ? latest[1][0].qLabel : quarterLabel(quarterIndex)} · ВЫПУСК № {latest ? latest[0] : 0}
              </div>
              {/* Газета не объявляет режим, в котором выходит: «АВТОРИТАРНЫЙ РЕЖИМ» в
                  собственной шапке не печатает ни одно издание. Про режим говорит сама
                  бумага, тон заголовков и вот эта служебная строка выходных данных —
                  теперь при демократии и конфликте ветвей власти тоже, а не только
                  тогда, когда свободу прессы уже отняли: контраст виден только если
                  показать обе стороны. */}
              {(regimeId === 'totalitarian' || regimeId === 'authoritarian') ? (
                <div className="ems-mono" style={{ fontSize: 9.5, marginTop: 5, letterSpacing: '0.1em', color: pp.paperMuted, fontWeight: 700 }}>
                  {regimeId === 'totalitarian'
                    ? '⚑ ГОСУДАРСТВЕННОЕ ИЗДАНИЕ · РАСПРОСТРАНЯЕТСЯ ПО ПОДПИСКЕ ОБЯЗАТЕЛЬНО'
                    : 'ВЫХОДИТ ПО РАЗРЕШЕНИЮ · МАТЕРИАЛЫ СОГЛАСОВАНЫ'}
                </div>
              ) : (
                <div className="ems-mono" style={{ fontSize: 9.5, marginTop: 5, letterSpacing: '0.1em', color: pp.paperMuted }}>
                  НЕЗАВИСИМОЕ ИЗДАНИЕ · РЕДАКЦИЯ НЕ СОГЛАСОВЫВАЕТ МАТЕРИАЛЫ С ВЛАСТЬЮ
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
              <StateSeal regime={regimeId} size={46} title={(POLITICAL_REGIME_INFO[regimeId] || {}).label} />
              <button className="ems-btn" style={{ padding: '4px 7px', background: 'transparent', color: pp.paperText, borderColor: pp.paperRule }} onClick={onClose}><X size={14} /></button>
            </div>
          </div>

          {snapshot && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px', borderBottom: `1px solid ${pp.paperRule}`, padding: '8px 0' }}>
              <TickerStat pp={pp} label="Ставка" value={pctFmt(snapshot.keyRate)} delta={delta('keyRate')} />
              <TickerStat pp={pp} label="Инфляция" value={pctFmt(snapshot.inflation)} delta={delta('inflation')} />
              <TickerStat pp={pp} label="Курс" value={fmt1(snapshot.exchangeRate)} delta={delta('exchangeRate')} />
              <TickerStat pp={pp} label="Индекс акций" value={fmtIndex(snapshot.stockIndex)} delta={delta('stockIndex')} />
              {/* Рейтинг власти и тем более его падение — не та строка, которую
                  печатает подконтрольная государству газета: там выходит
                  «всенародная поддержка» без цифры и без стрелки вниз */}
              {regimeId === 'authoritarian' || regimeId === 'totalitarian'
                ? <TickerStat pp={pp} label="Поддержка курса" value="всенародная" delta={NaN} />
                : <TickerStat pp={pp} label="Рейтинг власти" value={Math.round(snapshot.approval)} delta={delta('approval')} />}
              {atWar && <TickerStat pp={pp} label="До конца операции" value={`${economy.warQuartersLeft} кв.`} delta={NaN} />}
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${pp.paperRule}`, padding: '8px 0', marginBottom: 14 }}>
            {[['issue', 'Выпуск'], ['chronicle', 'Хроника страны'], ['stories', 'Сюжетные линии']].map(([id, label]) => (
              <span key={id} onClick={() => { Audio.play('paper'); setTab(id); }} style={{ cursor: 'pointer', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
                fontWeight: tab === id ? 700 : 400, color: tab === id ? pp.paperText : pp.paperMuted, borderBottom: tab === id ? `2px solid ${pp.paperText}` : '2px solid transparent', paddingBottom: 3 }}>{label}</span>
            ))}
          </div>

          {tab === 'issue' && (
            <div>
              {!lead && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Первый выпуск выйдет после завершения квартала.</div>}
              {lead && (
                <div style={{ borderBottom: `1px solid ${pp.paperRule}`, paddingBottom: 14, marginBottom: 14, borderLeft: `4px solid ${pp.paperText}`, paddingLeft: 14 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                    {catOf(lead.cat).icon} {catOf(lead.cat).label.toUpperCase()} · ГЛАВНАЯ ТЕМА
                  </div>
                  <div className="ems-serif" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>{lead.headline}</div>
                  <div className="ems-serif" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    <span style={{ float: 'left', fontSize: 40, lineHeight: 0.8, fontWeight: 700, padding: '4px 6px 0 0' }}>{lead.text.charAt(0)}</span>
                    {lead.text.slice(1)}
                  </div>
                  {lead.chain && <ChainTrail chain={lead.chain} />}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ flex: '1 1 260px', border: `1px solid ${pp.paperRule}`, padding: '10px 12px' }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{weatherIcon}</span> СОСТОЯНИЕ ЭКОНОМИКИ
                  </div>
                  {snapshot && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px' }}>
                      {[['ВВП', fmtSignedPct(snapshot.gdpGrowth)], ['Инфляция', pctFmt(snapshot.inflation)], ['Безработица', pctFmt(snapshot.unemployment)],
                        ['Ставка', pctFmt(snapshot.keyRate)], ['Курс', fmt1(snapshot.exchangeRate)], ['Долг/ВВП', pctFmt(snapshot.debtToGdp)]].map(([k, v]) => (
                          <span key={k} className="ems-mono" style={{ fontSize: 10.5, color: pp.paperMuted }}>{k}: <b style={{ color: pp.paperText }}>{v}</b></span>
                        ))}
                    </div>
                  )}
                  {econRegimeId && econRegimeId !== 'normal' && (
                    <div className="ems-serif" style={{ fontSize: 11, color: pp.paperMuted, marginTop: 7, lineHeight: 1.4 }}>{regimeInfoText(weatherInfo, economy)}</div>
                  )}
                </div>
              </div>

              {urgentItems.length > 0 && (
                <div style={{ border: `2px solid ${pp.paperText}`, padding: '10px 12px', marginBottom: 14 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, letterSpacing: '0.12em', marginBottom: 7, fontWeight: 700 }}>⚠ ТРЕВОГА НОМЕРА</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {urgentItems.map((n) => (
                      <div key={n.id}>
                        <div className="ems-serif" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{n.headline}</div>
                        <div className="ems-serif" style={{ fontSize: 12, lineHeight: 1.5 }}>{n.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sections.map((s) => (
                <div key={s.cat} style={{ marginBottom: 16 }}>
                  <div className="ems-mono" style={{ fontSize: 10, letterSpacing: '0.1em', borderBottom: `1px solid ${pp.paperRule}`, paddingBottom: 4, marginBottom: 10, color: pp.paperText, fontWeight: 700 }}>
                    {s.label}
                  </div>
                  <div style={{ columnCount: s.items.length > 1 ? 2 : 1, columnGap: 22, columnRule: `1px solid ${pp.paperRule}` }} className="ems-paper-cols">
                    {s.items.map((n) => (
                      <div key={n.id} style={{ breakInside: 'avoid', marginBottom: 14 }}>
                        <div className="ems-serif" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{n.headline}</div>
                        <div className="ems-serif" style={{ fontSize: 12, lineHeight: 1.55 }}>{n.text}</div>
                        {n.storyTitle && <div style={{ fontSize: 10, color: pp.paperMuted, marginTop: 4 }}>Сюжет «{n.storyTitle}», часть {n.step} из {n.steps}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {opinionItem && (
                <div style={{ borderTop: `1px solid ${pp.paperRule}`, borderBottom: `1px solid ${pp.paperRule}`, padding: '12px 4px', marginBottom: 14 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 6 }}>{catOf('opinion').icon} КОЛОНКА МНЕНИЙ</div>
                  <div className="ems-serif" style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{opinionItem.headline}</div>
                  <div className="ems-serif" style={{ fontSize: 12, color: pp.paperMuted, lineHeight: 1.5 }}>{opinionItem.text}</div>
                </div>
              )}

              {editorial && (
                <div style={{ borderTop: `3px double ${pp.paperRule}`, marginTop: 6, paddingTop: 12 }}>
                  <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, letterSpacing: '0.1em', marginBottom: 5 }}>ОТ РЕДАКЦИИ · СВОДКА КВАРТАЛА</div>
                  <div className="ems-serif" style={{ fontSize: 12.5, lineHeight: 1.65 }}>{editorial.text}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'chronicle' && (
            <div>
              {quarters.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Хроника начнётся с первого завершённого квартала.</div>}
              {quarters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <input value={chronicleSearch} onChange={(e) => { setChronicleSearch(e.target.value); setChronicleShown(8); }}
                    placeholder="Поиск по хронике…" className="ems-serif"
                    style={{ flex: '1 1 180px', padding: '5px 9px', fontSize: 12, background: 'transparent', color: pp.paperText, border: `1px solid ${pp.paperRule}` }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <span onClick={() => { setChronicleFilter('all'); setChronicleShown(8); }} className="ems-mono"
                      style={{ cursor: 'pointer', fontSize: 10, padding: '3px 8px', border: `1px solid ${pp.paperRule}`, fontWeight: chronicleFilter === 'all' ? 700 : 400,
                        background: chronicleFilter === 'all' ? pp.paperRule : 'transparent', color: pp.paperText }}>ВСЁ</span>
                    {chronicleCats.map((c) => (
                      <span key={c.id} onClick={() => { setChronicleFilter(c.id); setChronicleShown(8); }} className="ems-mono"
                        style={{ cursor: 'pointer', fontSize: 10, padding: '3px 8px', border: `1px solid ${pp.paperRule}`, fontWeight: chronicleFilter === c.id ? 700 : 400,
                          background: chronicleFilter === c.id ? pp.paperRule : 'transparent', color: pp.paperText }}>{c.icon} {c.short.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}
              {quarters.length > 0 && filteredQuarters.length === 0 && (
                <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>По такому запросу в хронике ничего не нашлось.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {filteredQuarters.slice(0, chronicleShown).map(([q, list]) => {
                  const snap = history.find((h) => h.q === q);
                  const top = list.slice(0, 4);
                  return (
                    <div key={q} style={{ display: 'flex', gap: 14, borderBottom: `1px solid ${pp.paperRule}`, padding: '11px 0' }}>
                      <div style={{ width: 92, flexShrink: 0 }}>
                        <div className="ems-mono ems-serif" style={{ fontSize: 12, fontWeight: 700 }}>{list[0].qLabel}</div>
                        {snap && (
                          <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, lineHeight: 1.5, marginTop: 3 }}>
                            ВВП {fmtSigned1(snap.gdpGrowth)}%<br />инфл. {fmt1(snap.inflation)}%<br />безр. {fmt1(snap.unemployment)}%<br />ставка {fmt1(snap.keyRate)}%
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {top.map((n) => (
                          <div key={n.id}>
                            <span style={{ fontSize: 10 }}>{catOf(n.cat).icon} </span>
                            <span className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700 }}>{n.headline}</span>
                            <div className="ems-serif" style={{ fontSize: 11.5, color: pp.paperMuted, lineHeight: 1.45 }}>{n.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredQuarters.length > chronicleShown && (
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button className="ems-btn" style={{ background: 'transparent', color: pp.paperText, borderColor: pp.paperRule }}
                    onClick={() => setChronicleShown((n) => n + 8)}>Показать ещё</button>
                </div>
              )}
            </div>
          )}

          {tab === 'stories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {stories.length === 0 && <div className="ems-serif" style={{ fontSize: 13, color: pp.paperMuted }}>Сюжетов пока нет. Они рождаются из шоков и ваших собственных решений — и разворачиваются несколько кварталов подряд.</div>}
              {stories.map((st) => {
                const total = st.steps[0].steps;
                const done = st.steps.length;
                return (
                  <div key={st.id} style={{ borderLeft: `2px solid ${pp.paperRule}`, paddingLeft: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <div className="ems-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Сюжет: {st.title}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {Array.from({ length: total }).map((_, i) => (
                          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < done ? pp.paperText : 'transparent', border: `1px solid ${pp.paperRule}`, display: 'inline-block' }} />
                        ))}
                      </div>
                      {done < total && <span className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted }}>продолжение следует</span>}
                    </div>
                    <div className="ems-mono" style={{ fontSize: 9.5, color: pp.paperMuted, marginBottom: 8 }}>
                      {st.steps[0].qLabel} — {st.steps[st.steps.length - 1].qLabel} · {done} из {total} частей
                    </div>
                    {st.steps.map((n, i) => (
                      <div key={n.id} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                        <div style={{ width: 74, flexShrink: 0 }} className="ems-mono">
                          <div style={{ fontSize: 9.5, color: pp.paperMuted }}>{n.qLabel}</div>
                          <div style={{ fontSize: 9, color: pp.paperMuted }}>часть {i + 1}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="ems-serif" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{n.headline}</div>
                          <div className="ems-serif" style={{ fontSize: 11.5, color: pp.paperMuted, lineHeight: 1.5 }}>{n.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </PaperBox>
      </div>
    </div>
  );
}
