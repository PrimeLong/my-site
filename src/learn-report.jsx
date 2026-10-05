/* «СООБЩИТЬ ОБ ОШИБКЕ»: флажок на упражнении (и после ответа), на шаге урока, в учебнике
   и на итогах. Причина, комментарий по желанию — и контекст сам: упражнение и урок, числа
   варианта, ответ ученика и правильный ответ, версия сборки, экран, устройство. Хранится
   на сервере (api/reports.js); без входа отправить нельзя. После отправки — «Спасибо!
   Посмотрим» и урок дальше с того же места.
   ReportsView — список сообщений для владельцев (OWNER_LOGINS): новые / разобранные и
   «скопировать всё» — чтобы отдать их на исправление одним куском. */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, ArrowLeft, Check, Copy, RotateCcw, X, Trash2 } from 'lucide-react';
import { Audio } from './MacroSimulator.jsx';
import { Button, IconButton, Card, Sheet, TopBar, Heading } from './ds.jsx';
import { loadAccount } from './account.jsx';
import { sendReport, listReports, setReportStatus, deleteReport, eventsReport } from './lib/client.js';
import { isRude, RUDE_MESSAGE } from './lib/moderation.js';

export const REASONS = [
  ['answer', 'Ошибка в ответе'], ['accept', 'Мой ответ должен быть засчитан'], ['typo', 'Опечатка или ошибка в тексте'],
  ['unclear', 'Непонятно объяснено'], ['broken', 'Не работает'],
];
// «filter» — «Это ошибка фильтра» с экрана регистрации: в списке есть, в выборе причины — нет
const REASON_BY_ID = { ...Object.fromEntries(REASONS), filter: 'Фильтр не пропустил имя' };
// eslint-disable-next-line no-undef
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

// текст из дерева разметки: все text и math по порядку
export function flatText(x) {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (Array.isArray(x)) return x.map(flatText).filter(Boolean).join(' ');
  if (typeof x === 'object') {
    // текст, формула, термин со словарной подсказкой — всё, у чего есть строка v
    if (typeof x.v === 'string') return x.v;
    return Object.entries(x).filter(([k]) => k !== 'id' && k !== 'type' && k !== 't').map(([, v]) => (typeof v === 'object' ? flatText(v) : '')).filter(Boolean).join(' ');
  }
  return '';
}
const short = (v, n = 480) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s == null ? '' : s.replace(/\s+/g, ' ').trim().slice(0, n); };
const device = () => {
  try { return navigator.userAgent.slice(0, 200); } catch { return ''; }
};
const viewport = () => { try { return `${window.innerWidth}×${window.innerHeight}`; } catch { return ''; } };

// контекст упражнения: что именно видел ученик и что ответил
export function exerciseContext(inst, { lesson = null, resp = null, correct = '', mode = 'lesson' } = {}) {
  if (!inst) return {};
  const numbers = inst.market ? short(inst.market) : inst.variant ? short({ answer: inst.answer, tol: inst.tol, unit: inst.unit }) : '';
  return {
    screen: 'exercise', mode, kind: inst.kind, exercise: inst.id, lesson: inst.lesson || (lesson && lesson.id) || '', unit: inst.unitId || (lesson && lesson.unitId) || '',
    variant: inst.variant || '', prompt: short(flatText(inst.prompt), 1500), numbers, answer: resp == null ? '' : short(resp), correct: short(correct),
  };
}

function ReportSheet({ context, onClose }) {
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const account = loadAccount();
  const send = async () => {
    setState({ busy: true, done: false, error: '' });
    try {
      await sendReport(account.token, reason, comment, { ...context, build: BUILD, device: device(), viewport: viewport() });
      Audio.play('paper'); setState({ busy: false, done: true, error: '' });
    } catch (e) { setState({ busy: false, done: false, error: e.message }); }
  };
  return (
    <Sheet label="Сообщить об ошибке" onClose={onClose} testid="report-sheet">
      {state.done ? (
        <div style={{ textAlign: 'center' }} data-testid="report-thanks">
          <Heading level={2} title="Спасибо! Посмотрим" sub="Сообщение ушло вместе с упражнением и вашим ответом. Продолжаем с того же места." />
          <Button wide style={{ marginTop: 14 }} onClick={onClose} autoFocus>Продолжить</Button>
        </div>
      ) : !account ? (
        <div style={{ textAlign: 'center' }}>
          <Heading level={2} title="Нужен вход" sub="Сообщить об ошибке можно из профиля — так мы сможем ответить." />
          <Button wide style={{ marginTop: 14 }} onClick={onClose}>Понятно</Button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Heading level={2} title="Сообщить об ошибке" sub="Что не так? Упражнение, ваш ответ и устройство приложатся сами." />
            <IconButton label="Закрыть" icon={X} onClick={onClose} size={22} />
          </div>
          <div role="radiogroup" aria-label="Причина" style={{ display: 'grid', gap: 6, margin: '12px 0' }}>
            {REASONS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={reason === id} className="ds-opt" style={{ margin: 0 }} data-reason={id}
                onClick={() => { Audio.play('tick'); setReason(id); }}>{label}</button>
            ))}
          </div>
          <label className="ds-label">Комментарий — необязательно
            <textarea className="ds-field" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: в ответе 25, а должно быть 20" style={{ resize: 'vertical', minHeight: 72 }} />
          </label>
          {isRude(comment) && <div role="alert" data-testid="report-rude" style={{ color: 'var(--ds-bad)', fontSize: 14, margin: '6px 0' }}>{RUDE_MESSAGE}</div>}
          {state.error && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14, margin: '6px 0' }}>{state.error}</div>}
          <Button wide disabled={!reason || state.busy || isRude(comment)} onClick={send} data-testid="report-send" style={{ marginTop: 8 }}>{state.busy ? 'Отправляем…' : 'Отправить'}</Button>
        </>
      )}
    </Sheet>
  );
}

/* Флажок. context — функция: контекст собирается в момент нажатия (ответ уже введён). */
export function ReportFlag({ context, label = 'Сообщить об ошибке', style, withText = false }) {
  const [open, setOpen] = useState(null);
  const btn = useRef(null);
  /* шторка — в корень экрана дизайн-системы (там её цвета и шрифты): внутри анимированной
     карточки position: fixed отсчитывался бы от неё, а не от экрана */
  const root = btn.current && btn.current.closest('.ds');
  return (
    <>
      <button type="button" ref={btn} className="ln-flag" aria-label={label} title={label} data-testid="report-flag" style={style}
        onClick={(e) => { e.stopPropagation(); Audio.play('tick'); setOpen(context()); }}>
        <Flag size={16} aria-hidden="true" />{withText && <span className="ln-flag-text">{label}</span>}
      </button>
      {open && createPortal(<div className="ln-report-root"><ReportSheet context={open} onClose={() => setOpen(null)} /></div>, root || document.body)}
    </>
  );
}
export const REPORT_CSS = `
  .ln-flag { background: none; border: none; padding: 6px; margin: -6px; color: var(--ds-ink3); cursor: pointer; border-radius: 50%; line-height: 0; }
  .ln-flag:hover, .ln-flag:focus-visible { color: var(--ds-bad); background: var(--ds-card2); }
  .ln-flag:has(.ln-flag-text) { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 6px 10px; margin: 0; line-height: 1; }
  .ln-flag-text { font: 600 12.5px/1 var(--ds-sans); }
  .ln-report-root { text-transform: none; letter-spacing: normal; font: 400 16px/1.45 var(--ds-sans); color: var(--ds-ink); text-align: left; }
  .rp-item { border-top: 1px dotted var(--ds-rule2); padding: 10px 0; }
  .rp-item:first-of-type { border-top: none; }
  .rp-ctx { font: 12.5px/1.45 var(--ds-mono); color: var(--ds-ink2); white-space: pre-wrap; word-break: break-word; margin-top: 6px; }
`;

// одно сообщение текстом — для «скопировать всё»
const fmtDate = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const CTX_LABEL = { screen: 'экран', mode: 'режим', kind: 'вид', lesson: 'урок', unit: 'юнит', exercise: 'упражнение', variant: 'вариант', step: 'шаг', page: 'страница',
  prompt: 'условие', numbers: 'числа', answer: 'ответ ученика', correct: 'правильный ответ', build: 'сборка', device: 'устройство', viewport: 'экран, px' };
export function reportText(r) {
  const lines = [`[${r.status === 'done' ? 'разобрано' : 'новое'}] ${fmtDate(r.at)} · ${r.name || r.login} (${r.login}) · ${REASON_BY_ID[r.reason] || r.reason}`];
  if (r.comment) lines.push(`комментарий: ${r.comment}`);
  Object.entries(CTX_LABEL).forEach(([k, label]) => { if (r.context && r.context[k]) lines.push(`${label}: ${r.context[k]}`); });
  lines.push(`id: ${r.id}`);
  return lines.join('\n');
}

/* Аналитика для владельцев (api/events.js): воронка за 30 дней и 20 самых трудных упражнений —
   только счётчики, без логинов и адресов. */
export function AnalyticsView({ onBack }) {
  const account = loadAccount();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { eventsReport(account && account.token).then(setData).catch((e) => setErr(e.message)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const top = data ? Math.max(1, ...data.funnel.map((f) => f.count)) : 1;
  return (
    <div className="rw-page" data-testid="analytics" role="dialog" aria-label="Аналитика">
      <div className="rw-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Аналитика" />
        <div className="ds-sub" style={{ fontSize: 14, margin: '8px 0 12px' }}>Только счётчики: без логинов, имён и адресов. Данные — за последние 30 дней.</div>
        {err && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14 }}>{err}</div>}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Воронка</div>
          {!data ? <div className="ds-sub">Загружаем…</div> : (
            <div data-testid="analytics-funnel" style={{ display: 'grid', gap: 6 }}>
              {data.funnel.map((f) => (
                <div key={f.event} data-event={f.event} style={{ fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{f.label}</span><b className="ds-num">{f.count}</b></div>
                  <div style={{ height: 6, background: 'var(--ds-card2)', marginTop: 3 }}><div style={{ height: '100%', width: `${(f.count / top) * 100}%`, background: 'var(--u)' }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>20 самых трудных упражнений</div>
          {!data ? <div className="ds-sub">Загружаем…</div> : !data.hardest.length ? <div className="ds-sub" data-testid="analytics-empty">Пока мало ответов: в список попадают упражнения, где ответили хотя бы 5 раз.</div> : (
            <ol data-testid="analytics-hardest" style={{ margin: 0, paddingLeft: 22, fontSize: 14, display: 'grid', gap: 4 }}>
              {data.hardest.map((x) => <li key={x.id}><span className="ds-num">{x.id}</span> — верно с первой попытки {Math.round(x.share * 100)}% ({x.correct} из {x.total})</li>)}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

export function ReportsView({ onBack }) {
  const account = loadAccount();
  const [status, setStatus] = useState('new');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const load = () => { setErr(''); listReports(account && account.token, status).then(setData).catch((e) => setErr(e.message)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [status]);
  const mark = async (r, s) => { Audio.play('tick'); try { await setReportStatus(account.token, r.id, s); load(); } catch (e) { setErr(e.message); } };
  const remove = async (r) => { Audio.play('tick'); try { await deleteReport(account.token, r.id); load(); } catch (e) { setErr(e.message); } };
  const copyAll = async () => {
    const text = (data ? data.reports : []).map(reportText).join('\n\n———\n\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('Не удалось скопировать — браузер не дал доступа к буферу'); }
  };
  return (
    <div className="rw-page" data-testid="reports" role="dialog" aria-label="Сообщения об ошибках">
      <div className="rw-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBack} />} title="Сообщения об ошибках" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }} role="group" aria-label="Фильтр">
          {[['new', 'Новые'], ['done', 'Разобранные']].map(([id, label]) => (
            <button key={id} type="button" className="ds-chip" aria-pressed={status === id} onClick={() => setStatus(id)} data-filter={id}>
              {label}{data && data.counts ? ` · ${data.counts[id]}` : ''}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <Button small variant="secondary" icon={Copy} disabled={!data || !data.reports.length} onClick={copyAll} data-testid="reports-copy">{copied ? 'Скопировано' : 'Скопировать всё'}</Button>
        </div>
        {err && <div role="alert" style={{ color: 'var(--ds-bad)', fontSize: 14 }}>{err}</div>}
        <Card>
          {!data ? <div className="ds-sub">Загружаем…</div> : !data.reports.length ? <div className="ds-sub" data-testid="reports-empty">{status === 'new' ? 'Новых сообщений нет.' : 'Разобранных пока нет.'}</div>
            : data.reports.map((r) => (
              <div key={r.id} className="rp-item" data-testid="report-item" data-status={r.status}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b>{REASON_BY_ID[r.reason] || r.reason}</b>
                  <span className="ds-faint" style={{ fontSize: 12.5 }}>{fmtDate(r.at)} · {r.name || r.login}</span>
                  {r.rude && <span className="ds-chip" style={{ color: 'var(--ds-bad)', borderColor: 'var(--ds-bad)', fontSize: 12, padding: '1px 8px' }} data-testid="report-rude-mark">грубость</span>}
                </div>
                {r.comment && <div style={{ fontSize: 14.5, marginTop: 4 }}>{r.comment}</div>}
                <div className="rp-ctx">{Object.entries(CTX_LABEL).filter(([k]) => r.context && r.context[k] && k !== 'device').map(([k, label]) => `${label}: ${r.context[k]}`).join('\n')}</div>
                <div style={{ marginTop: 6 }}>
                  {r.status === 'done'
                    ? <Button small variant="ghost" icon={RotateCcw} onClick={() => mark(r, 'new')}>Вернуть в новые</Button>
                    : <Button small variant="secondary" icon={Check} onClick={() => mark(r, 'done')} data-testid="report-done">Разобрано</Button>}
                  <Button small variant="ghost" icon={Trash2} onClick={() => remove(r)} data-testid="report-delete" style={{ marginLeft: 6 }}>Удалить</Button>
                </div>
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}
