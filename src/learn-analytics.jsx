/* АНАЛИТИКА ДЛЯ ВЛАДЕЛЬЦЕВ (api/events.js): только счётчики — без логинов, имён и адресов.
   Сверху — сводка недели против прошлой (уроки, новые аккаунты, точность, новые сообщения об
   ошибках), дальше — активность и точность по дням за 30 дней (наведите или коснитесь столбика —
   подсказка с числами), воронка с конверсией шагов, уроки (популярные и те, что чаще бросают)
   и самые трудные упражнения с началом условия. Старый сервер отдаёт только воронку и трудные
   упражнения — остальные блоки тогда просто не показываются. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IconButton, Card, TopBar } from './ds.jsx';
import { loadAccount } from './account.jsx';
import { eventsReport } from './lib/client.js';
import { LESSON_BY_ID, EXERCISES } from './learn/course.js';
import { plainText } from './textbook/content.js';

export const ANALYTICS_CSS = `
  .an-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  @media (min-width: 720px) { .an-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .an-tile { background: var(--ds-card); border: 1.5px solid var(--ds-rule); border-radius: 16px; padding: 12px 14px; min-width: 0; }
  .an-tile-label { font: 600 12.5px/1.3 var(--ds-sans); color: var(--ds-ink2); }
  .an-tile-value { font: 700 28px/1.15 var(--ds-sans); color: var(--ds-ink); margin-top: 4px; font-variant-numeric: tabular-nums; }
  .an-tile-delta { margin-top: 3px; font: 12px/1.35 var(--ds-sans); color: var(--ds-ink3); }
  .an-tile-delta b { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; font-size: 13px; color: var(--ds-ink2); margin-right: 4px; }
  .an-tile-delta b.up { color: var(--ds-ok); } .an-tile-delta b.down { color: var(--ds-bad); }
  .an-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .an-h b { font-size: 15.5px; }
  .an-legend { display: inline-flex; gap: 12px; font: 12.5px var(--ds-sans); color: var(--ds-ink2); }
  .an-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .an-chart { position: relative; }
  .an-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
  .an-chart .grid { stroke: var(--ds-rule); stroke-width: 1; }
  .an-chart .ax { font: 11px var(--ds-sans); fill: var(--ds-ink3); }
  .an-tip { position: absolute; top: 0; transform: translateX(-50%); pointer-events: none; background: var(--ds-ink); color: var(--ds-paper); border-radius: 10px; padding: 6px 9px;
    font: 12.5px/1.4 var(--ds-sans); white-space: nowrap; box-shadow: 0 6px 16px rgba(0,0,0,.18); z-index: 2; }
  .an-tip b { font-weight: 700; }
  .an-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: baseline; font-size: 14px; padding: 6px 0; }
  .an-row + .an-row { border-top: 1px solid var(--ds-rule); }
  .an-bar { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: var(--ds-card2); overflow: hidden; }
  .an-bar > span { display: block; height: 100%; border-radius: 3px; background: var(--u); }
  .an-conv { font: 600 12px var(--ds-sans); color: var(--ds-ink2); margin-left: 6px; }
  .an-sub { font-size: 12.5px; color: var(--ds-ink3); }
  .an-tabs { display: inline-flex; gap: 6px; }
  .an-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .an-table th { text-align: left; font: 600 12px var(--ds-sans); color: var(--ds-ink2); padding: 0 6px 6px 0; }
  .an-table td { padding: 6px 6px 6px 0; border-top: 1px solid var(--ds-rule); vertical-align: top; }
  .an-table td.num, .an-table th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .an-chips { display: flex; flex-wrap: wrap; gap: 6px; }
`;

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const dayLabel = (d) => { const [, m, dd] = d.split('-'); return `${Number(dd)}.${m}`; };
const REASON_LABEL = {
  answer: 'Ошибка в ответе', accept: 'Засчитать ответ', typo: 'Опечатка', unclear: 'Непонятно', theory: 'Теория',
  formula: 'Формула или график', visual: 'Выглядит не так', broken: 'Не работает', filter: 'Фильтр имён',
};
const lessonTitle = (id) => (LESSON_BY_ID[id] ? LESSON_BY_ID[id].title : id);
const exerciseText = (id) => {
  const ex = EXERCISES[id] || EXERCISES[`auto:${id}`];
  if (!ex || !ex.prompt) return '';
  const t = plainText((ex.prompt || []).flatMap((b) => b.inline || [])).replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 88)}…` : t;
};

// ширина контейнера: графики рисуются в настоящих пикселях, чтобы подписи на телефоне не мельчали
function useWidth(fallback = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => setW(Math.max(260, Math.round(el.clientWidth || fallback)));
    upd();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}
// подписи дней — каждый седьмой, считая от сегодняшнего: последний день подписан всегда
const labelled = (i, n) => (n - 1 - i) % 7 === 0;

// карточка-сводка: число за 7 дней и изменение против прошлых 7 дней
function Tile({ label, value, now, prev, share = false, testid }) {
  const d = now == null || prev == null ? null : share ? Math.round((now - prev) * 100) : prev ? Math.round(((now - prev) / prev) * 100) : now ? 100 : 0;
  const Icon = d == null || d === 0 ? Minus : d > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="an-tile" data-testid={testid}>
      <div className="an-tile-label">{label}</div>
      <div className="an-tile-value">{value}</div>
      {d != null && <div className="an-tile-delta"><b className={d > 0 ? 'up' : d < 0 ? 'down' : ''}><Icon size={13} aria-hidden="true" />{d > 0 ? '+' : ''}{d}{share ? ' п.' : '%'}</b>к прошлой неделе</div>}
    </div>
  );
}

/* Столбики по дням: светлый — начали урок, цветной поверх — прошли. Подсказка — по наведению
   и касанию (зона касания — весь день, а не только столбик). */
function ActivityChart({ daily }) {
  const [hover, setHover] = useState(null);
  const [box, W] = useWidth();
  const H = 170; const L = 30; const R = 6; const T = 10; const B = 22;
  const top = Math.max(4, ...daily.map((d) => Math.max(d.lesson_start, d.lesson_done)));
  const nice = top <= 5 ? 5 : top <= 10 ? 10 : Math.ceil(top / 10) * 10;
  const step = (W - L - R) / daily.length; const bw = Math.max(3, step * 0.62);
  const y = (v) => H - B - (v / nice) * (H - T - B);
  const at = (i) => L + i * step + step / 2;
  const pick = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.floor(((e.clientX - r.left) / r.width * W - L) / step); setHover(i >= 0 && i < daily.length ? i : null); };
  const h = hover != null ? daily[hover] : null;
  return (
    <div className="an-chart" data-testid="analytics-activity" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Уроки по дням за 30 дней: всего прошли ${daily.reduce((a, d) => a + d.lesson_done, 0)}`}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((k) => <g key={k}><line className="grid" x1={L} x2={W - R} y1={y(nice * k)} y2={y(nice * k)} /><text className="ax" x={L - 6} y={y(nice * k) + 4} textAnchor="end">{Math.round(nice * k)}</text></g>)}
        {daily.map((d, i) => (
          <g key={d.day} opacity={hover == null || hover === i ? 1 : 0.55}>
            {d.lesson_start > 0 && <rect x={at(i) - bw / 2} y={y(d.lesson_start)} width={bw} height={H - B - y(d.lesson_start)} rx={Math.min(4, bw / 2)} fill="var(--ds-rule2)" />}
            {d.lesson_done > 0 && <rect x={at(i) - bw / 2 + 1.5} y={y(d.lesson_done)} width={Math.max(1, bw - 3)} height={H - B - y(d.lesson_done)} rx={Math.min(4, bw / 2)} fill="var(--u)" />}
          </g>
        ))}
        {daily.map((d, i) => labelled(i, daily.length) && <text key={`l${d.day}`} className="ax" x={at(i)} y={H - 6} textAnchor="middle">{dayLabel(d.day)}</text>)}
      </svg>
      {h && (
        <div className="an-tip" style={{ left: `${Math.min(80, Math.max(20, (at(hover) / W) * 100))}%` }} role="status">
          <b>{dayLabel(h.day)}</b> · начали {h.lesson_start} · прошли {h.lesson_done}
          {h.welcome_start ? ` · новых ${h.welcome_start}` : ''}{h.register_done ? ` · аккаунтов ${h.register_done}` : ''}
        </div>
      )}
    </div>
  );
}

// точность с первой попытки по дням: одна линия, дни без ответов — разрыв
function AccuracyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const [box, W] = useWidth();
  const H = 130; const L = 34; const R = 14; const T = 10; const B = 22;
  const pts = daily.map((d) => { const all = d.ex_first_try_ok + d.ex_first_try_fail; return all ? d.ex_first_try_ok / all : null; });
  const x = (i) => L + (i / Math.max(1, daily.length - 1)) * (W - L - R);
  const y = (v) => H - B - v * (H - T - B);
  const segs = []; let cur = [];
  pts.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]); });
  if (cur.length) segs.push(cur);
  const pick = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width * W - L) / ((W - L - R) / Math.max(1, daily.length - 1))); setHover(i >= 0 && i < daily.length ? i : null); };
  const h = hover != null ? daily[hover] : null;
  return (
    <div className="an-chart" data-testid="analytics-accuracy" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Доля верных с первой попытки по дням"
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((k) => <g key={k}><line className="grid" x1={L} x2={W - R} y1={y(k)} y2={y(k)} /><text className="ax" x={L - 6} y={y(k) + 4} textAnchor="end">{k * 100}%</text></g>)}
        {segs.map((sg, k) => <polyline key={k} points={sg.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--u)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        {segs.filter((sg) => sg.length === 1).map((sg, k) => <circle key={`d${k}`} cx={sg[0][0]} cy={sg[0][1]} r="3" fill="var(--u)" />)}
        {h && pts[hover] != null && <><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ds-ink3)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(pts[hover])} r="4.5" fill="var(--u)" stroke="var(--ds-card)" strokeWidth="2" /></>}
        {daily.map((d, i) => labelled(i, daily.length) && <text key={d.day} className="ax" x={x(i)} y={H - 6} textAnchor="middle">{dayLabel(d.day)}</text>)}
      </svg>
      {h && (
        <div className="an-tip" style={{ left: `${Math.min(80, Math.max(20, (x(hover) / W) * 100))}%` }} role="status">
          <b>{dayLabel(h.day)}</b> · {pts[hover] == null ? 'ответов не было' : `верно с первой попытки ${pct(pts[hover])} (${h.ex_first_try_ok} из ${h.ex_first_try_ok + h.ex_first_try_fail})`}
        </div>
      )}
    </div>
  );
}

export function AnalyticsView({ onBack }) {
  const account = loadAccount();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [lessonSort, setLessonSort] = useState('top');
  useEffect(() => { eventsReport(account && account.token).then(setData).catch((e) => setErr(e.message)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = data && data.funnel.length ? Math.max(1, data.funnel[0].count) : 1;
  const lessons = useMemo(() => {
    if (!data || !data.lessons) return [];
    const list = lessonSort === 'top' ? data.lessons : data.lessons.filter((l) => l.start >= 5).sort((a, b) => a.finish - b.finish);
    return list.slice(0, 12);
  }, [data, lessonSort]);
  const t = data && data.totals;
  return (
    <div className="rw-page" data-testid="analytics" role="dialog" aria-label="Аналитика">
      <style>{ANALYTICS_CSS}</style>
      <div className="rw-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Аналитика" />
        <div className="ds-sub" style={{ fontSize: 14, margin: '8px 0 12px' }}>Только счётчики: без логинов, имён и адресов. Сводка — за последние 7 дней против прошлых 7, графики — за 30 дней.</div>
        {err && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14 }}>{err}</div>}
        {!data && !err && <div className="ds-sub">Загружаем…</div>}
        {t && (
          <div className="an-tiles" data-testid="analytics-tiles">
            <Tile label="Уроков пройдено" value={t.lessons.now} now={t.lessons.now} prev={t.lessons.prev} testid="analytics-tile-lessons" />
            <Tile label="Новых аккаунтов" value={t.accounts.now} now={t.accounts.now} prev={t.accounts.prev} testid="analytics-tile-accounts" />
            <Tile label="Верно с первой попытки" value={pct(t.accuracy.now)} now={t.accuracy.now} prev={t.accuracy.prev} share testid="analytics-tile-accuracy" />
            <div className="an-tile" data-testid="analytics-tile-reports">
              <div className="an-tile-label">Новых сообщений об ошибках</div>
              <div className="an-tile-value">{data.reports ? data.reports.fresh : '—'}</div>
              <div className="an-tile-delta">уроков начато за неделю: {t.starts.now}</div>
            </div>
          </div>
        )}
        {data && data.daily && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h">
              <b>Уроки по дням</b>
              <span className="an-legend"><span><i style={{ background: 'var(--ds-rule2)' }} />начали</span><span><i style={{ background: 'var(--u)' }} />прошли</span></span>
            </div>
            <ActivityChart daily={data.daily} />
          </Card>
        )}
        {data && data.daily && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h"><b>Верно с первой попытки</b><span className="an-sub">доля по дням</span></div>
            <AccuracyChart daily={data.daily} />
          </Card>
        )}
        {data && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h"><b>Воронка</b><span className="an-sub">30 дней · справа — доля от предыдущего шага</span></div>
            <div data-testid="analytics-funnel">
              {data.funnel.map((f, k) => {
                const prev = k ? data.funnel[k - 1].count : null;
                return (
                  <div key={f.event} className="an-row" data-event={f.event}>
                    <span>{f.label}</span>
                    <span><b className="ds-num">{f.count}</b>{prev != null && <span className="an-conv">{prev ? pct(f.count / prev) : '—'}</span>}</span>
                    <div className="an-bar"><span style={{ width: `${(f.count / first) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        {data && data.features && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h"><b>Разделы</b><span className="an-sub">устройств в день, сумма за 7 дней · 30 дней</span></div>
            <div data-testid="analytics-features">
              {data.features.map((f) => (
                <div key={f.event} className="an-row" data-event={f.event}>
                  <span>{f.label}</span>
                  <span><b className="ds-num">{f.now}</b><span className="an-conv">{f.prev ? `${f.now >= f.prev ? '+' : '−'}${pct(Math.abs(f.now - f.prev) / f.prev)}` : '—'} · {f.month}</span></span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {data && data.lessons && data.lessons.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h">
              <b>Уроки</b>
              <span className="an-tabs" role="group" aria-label="Порядок">
                {[['top', 'Популярные'], ['drop', 'Чаще бросают']].map(([id, label]) => (
                  <button key={id} type="button" className="ds-chip" aria-pressed={lessonSort === id} onClick={() => setLessonSort(id)} data-sort={id}>{label}</button>
                ))}
              </span>
            </div>
            {!lessons.length ? <div className="an-sub">Пока мало данных: здесь уроки, которые начинали хотя бы 5 раз.</div> : (
              <table className="an-table" data-testid="analytics-lessons">
                <thead><tr><th>Урок</th><th className="num">Начали</th><th className="num">Дошли</th><th className="num">Минут</th></tr></thead>
                <tbody>
                  {lessons.map((l) => (
                    <tr key={l.id} data-lesson={l.id}>
                      <td>{lessonTitle(l.id)} <span className="an-sub">{l.id}</span></td>
                      <td className="num">{l.start}</td>
                      <td className="num">{pct(l.finish)}</td>
                      <td className="num">{l.minutes == null ? '—' : l.minutes.toFixed(1).replace('.', ',')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
        {data && (
          <Card style={{ marginBottom: 12 }}>
            <div className="an-h"><b>Самые трудные упражнения</b><span className="an-sub">верно с первой попытки, от 5 ответов</span></div>
            {!data.hardest.length ? <div className="ds-sub" data-testid="analytics-empty">Пока мало ответов: в список попадают упражнения, где ответили хотя бы 5 раз.</div> : (
              <div data-testid="analytics-hardest">
                {data.hardest.map((x) => {
                  const txt = exerciseText(x.id);
                  return (
                    <div key={x.id} className="an-row" data-exercise={x.id}>
                      <span><span className="ds-num">{x.id}</span>{txt && <div className="an-sub">{txt}</div>}</span>
                      <span style={{ whiteSpace: 'nowrap' }}><b className="ds-num">{pct(x.share)}</b> <span className="an-sub">{x.correct} из {x.total}</span></span>
                      <div className="an-bar"><span style={{ width: `${Math.max(2, x.share * 100)}%`, background: x.share < 0.4 ? 'var(--ds-bad)' : 'var(--u)' }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
        {data && data.reports && data.reports.fresh > 0 && (
          <Card>
            <div className="an-h"><b>Новые сообщения об ошибках</b><span className="an-sub">по причинам</span></div>
            <div className="an-chips" data-testid="analytics-reports">
              {Object.entries(data.reports.byReason).sort((a, b) => b[1] - a[1]).map(([r, n]) => <span key={r} className="ds-chip" style={{ cursor: 'default' }}>{REASON_LABEL[r] || r} · {n}</span>)}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
