/* УЧЕБНИК: оглавление, главы, приложения и повторение задач. Отдельный ленивый чанк
   вместе с KaTeX и текстами глав — в меню и в партии этот код не нужен.
   Тексты — src/textbook/chapters/*.md (разметка — src/textbook/markdown.js), порядок и
   ссылки на настоящие учебники — src/textbook/toc.js, прогресс — src/textbook/progress.js. */
import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowLeft, BookOpenText, BookOpen, Calculator, Gamepad2, Play, Check, RotateCcw, ChevronLeft, ChevronRight, Info, Target, ListChecks, TriangleAlert, Brain, ChevronDown, ArrowDown } from 'lucide-react';
import { COLOR, Audio, AudioControls, getPlayerId, syncProfile } from './MacroSimulator.jsx';
import { TrainerPage } from './trainer.jsx';
import { TopBar, IconButton } from './ds.jsx';
import { LEVERS, SCENARIOS } from './lib/engine.js';
import { LAB_LEVERS } from './lib/lab.js';
import { DRILLS, drillSetup } from './lib/drills.js';
import { GLOSSARY, GLOSSARY_KEYS } from './textbook/glossary.js';
import { GAME_CARDS, LIMITS } from './textbook/appendix.js';
import { PARTS, CHAPTERS, CHAPTER_BY_ID, APPENDICES, BOOKS, chapterNo } from './textbook/toc.js';
import { TYCOON_TASKS } from './textbook/tycoon-tasks.js';
import { CHAPTER_BLOCKS, APPENDIX_BLOCKS, CHAPTER_SECTIONS, PROBLEMS, RECALLS, problemsOf } from './textbook/content.js';
import { sectionDone, sectionProgress, dueItems } from './textbook/study.js';
import { CHARTS, chartDefaults, checkGraph, captionVars } from './textbook/charts.js';
import { actionOf, parseInline, checkAnswer, matchTraps, LEVELS } from './textbook/markdown.js';
import { loadProgress, saveProgress, markRead, unmarkRead, recordAnswer, scheduleAfter, reviewQueue, chapterScore, setLast, daysUntil, confidenceStats, addStudyMinute } from './textbook/progress.js';
import { EXAMS, examSet, examTemplates, examResult, mixedSet, mixedChapters, weakTopics, journalWeeks, journalSummary } from './textbook/check.js';
import { CircularFlow, BalanceSheets } from './textbook-diagrams.jsx';
import { evalExpr, fmtResult, pressRoot } from './learn/calc.js';
import { formulaSymbols } from './textbook/symbols.js';
import { plural } from './lib/plural.js';

const LEVER_BY_ID = Object.fromEntries(LEVERS.map((l) => [l.id, l]));
const DRILL_BY_ID = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
const CARD_BY_ID = Object.fromEntries(GAME_CARDS.map((c) => [c.id, c]));
const APPENDIX_BY_ID = Object.fromEntries(APPENDICES.map((a) => [a.id, a]));
const fmtNum = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',').replace('-', '−');

export const TEXTBOOK_CSS = `
  .tb-body { font-size: 14.5px; line-height: 1.68; color: var(--c-text); }
  .tb-body p { margin: 0 0 12px; }
  .tb-body h2 { font-family: 'PT Serif', Georgia, serif; font-size: 20px; font-weight: 700; color: var(--c-gold-soft); margin: 28px 0 10px; }
  .tb-body h3 { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }
  .tb-body ul, .tb-body ol { margin: 0 0 12px; padding-left: 22px; }
  .tb-body li { margin-bottom: 4px; }
  .tb-math { overflow-x: auto; overflow-y: hidden; max-width: 100%; margin: 10px 0 14px; padding: 2px 0 6px; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  .tb-math .katex-display { margin: 0; }
  .tb-body .katex { font-size: 1.08em; }
  .tb-table { overflow-x: auto; max-width: 100%; margin: 0 0 14px; }
  .tb-table table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
  .tb-table th, .tb-table td { border: 1px solid var(--c-border); padding: 6px 10px; text-align: left; vertical-align: top; }
  .tb-table th { color: var(--c-gold-soft); font-weight: 600; background: var(--c-panel-alt); }
  .tb-box { border: 1px solid var(--c-border); border-left-width: 3px; padding: 12px 14px 4px; margin: 16px 0; background: var(--c-panel-alt); }
  .tb-box-head { display: flex; align-items: center; gap: 7px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
  .tb-link { background: none; border: none; padding: 0; font: inherit; color: var(--c-gold-soft); cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
  .tb-term { border-bottom: 1px dashed var(--c-gold); cursor: help; color: var(--c-gold-soft); }
  .tb-def { display: block; margin: 6px 0; padding: 8px 11px; background: var(--c-panel); border: 1px solid var(--c-border); font-size: 12.5px; line-height: 1.55; color: var(--c-muted); }
  .tb-slider { width: 100%; accent-color: var(--c-gold); }
  .tb-toc-row { display: flex; align-items: baseline; gap: 10px; width: 100%; text-align: left; padding: 10px 12px; background: none; border: none; border-top: 1px solid var(--c-hairline); color: var(--c-text); font: inherit; cursor: pointer; }
  .tb-toc-row:hover { background: var(--c-panel-alt); }
  .tb-toc-row[disabled] { cursor: pointer; }
  .tb-chip { font-size: 11.5px; padding: 1px 7px; border: 1px solid var(--c-border); border-radius: 10px; color: var(--c-muted); white-space: nowrap; }
  .tb-legend { font-size: 13px; line-height: 1.6; color: var(--c-muted); margin: -6px 0 14px; padding-left: 10px; border-left: 2px solid var(--c-hairline); }
  .tb-calc { margin: 10px 0 4px; max-width: 300px; border: 1px solid var(--c-border); border-radius: 4px; padding: 8px; background: var(--c-panel-alt, rgba(0,0,0,.03)); }
  .tb-calc-screen { text-align: right; font-family: var(--ds-mono, monospace); padding: 4px 6px 6px; }
  .tb-calc-keys { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .tb-calc-keys button { font: 600 15px/1 var(--ds-mono, monospace); padding: 9px 0; border: 1px solid var(--c-border); border-radius: 3px; background: var(--c-panel, #fff); color: inherit; cursor: pointer; }
  .tb-calc-keys button.op { color: var(--c-gold, #9C7218); }
  .tb-pick { font-size: 12px; padding: 4px 10px; border: 1px solid var(--c-border); border-radius: 12px; background: none; color: var(--c-muted); cursor: pointer; font-family: inherit; }
  .tb-pick[aria-pressed="true"] { border-color: var(--c-gold); color: var(--c-gold-soft); background: var(--c-panel); }
  .tb-flow-step { border: 1px solid var(--c-border); background: var(--c-panel); padding: 8px 12px; }
  .tb-news { background: #E8DFC6; color: #241C12; border: 1px solid #8C6B3E; padding: 8px 12px 10px; margin: 6px 0 10px; }
  .tb-news-mast { font-size: 10px; letter-spacing: .12em; color: #6B5A3E; border-bottom: 3px double #8C6B3E; padding-bottom: 4px; margin-bottom: 6px; }
  .tb-news-head { font-size: 17px; font-weight: 700; line-height: 1.2; }
  .tb-bar { height: 4px; background: var(--c-hairline); border-radius: 2px; overflow: hidden; }
  .tb-bar > span { display: block; height: 100%; background: var(--c-teal); }
  /* разделы главы: строка = номер, название, минуты; на телефоне ничего не «плывёт» */
  .tb-secnav { border: 1px solid var(--c-border); background: var(--c-panel-alt); padding: 10px 12px 6px; margin: 0 0 16px; }
  .tb-secnav-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--c-muted); margin-bottom: 6px; }
  .tb-secnav-head [data-testid="tb-section-progress"] { text-transform: none; letter-spacing: 0; }
  .tb-secnav-list { list-style: none; margin: 6px 0 0; padding: 0; }
  .tb-secnav-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%; padding: 7px 2px; background: none; border: none; border-top: 1px solid var(--c-hairline);
    color: var(--c-text); font: inherit; font-size: 13.5px; line-height: 1.35; text-align: left; cursor: pointer; }
  .tb-secnav-list li:first-child .tb-secnav-row { border-top: none; }
  .tb-secnav-no { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--c-border); display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; color: var(--c-muted); }
  .tb-secnav-no.done { background: var(--c-teal); border-color: var(--c-teal); color: #fff; }
  .tb-secnav-min { font-size: 11.5px; color: var(--c-faint); white-space: nowrap; }
  /* учебник внутри обучения: оглавление в стиле дизайн-системы */
  .tbl-continue { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer; padding: 14px 16px; margin: 0 0 12px; border-radius: 6px;
    background: var(--u); color: #fff; border: 1px solid color-mix(in srgb, var(--u) 70%, #000); border-bottom-width: 3px; font: inherit; }
  .tbl-continue small { display: block; font: 700 11px/1.2 var(--ds-sans); letter-spacing: .1em; text-transform: uppercase; opacity: .85; }
  .tbl-continue b { display: block; font: 700 18px/1.25 var(--ds-serif); margin-top: 2px; }
  .tbl-stats { display: flex; gap: 6px 14px; flex-wrap: wrap; align-items: center; font-size: 13.5px; color: var(--ds-ink2); margin: 0 0 14px; }
  .tbl-stats b { color: var(--ds-ink); }
  .tbl-parts { display: grid; gap: 14px; }
  .tbl-part { background: var(--ds-card); border: 1px solid var(--ds-rule2); border-radius: 6px; padding: 10px 0 4px; }
  .tbl-part-title { font: 700 13px/1.2 var(--ds-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--u-ink); margin: 0; padding: 0 14px 8px; }
  .tbl-ch { display: grid; grid-template-columns: 28px minmax(0, 1fr) 54px; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; background: none; border: none;
    border-top: 1px solid var(--ds-rule); color: var(--ds-ink); font: inherit; text-align: left; cursor: pointer; }
  .tbl-ch:hover { background: var(--ds-card2); }
  .tbl-ch[data-status="draft"] { color: var(--ds-ink3); }
  .tbl-no { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--ds-rule2); display: inline-flex; align-items: center; justify-content: center; font: 700 12px/1 var(--ds-sans); color: var(--ds-ink2); }
  .tbl-no.done { background: var(--ds-ok); border-color: var(--ds-ok); color: #fff; }
  .tbl-ch-title { font: 600 15px/1.3 var(--ds-sans); }
  .tbl-ch-title small { font-weight: 500; color: var(--ds-ink3); }
  .tbl-ch-bar { height: 5px; border-radius: 3px; background: var(--ds-rule); overflow: hidden; }
  .tbl-ch-bar i { display: block; height: 100%; background: var(--ds-ok); }
  .tbl-more { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  /* ПК: учебник во весь экран — оглавление в две колонки, у главы слева закреплённый список разделов */
  @media (min-width: 1100px) {
    .ln-textbook.wide { max-width: 1240px !important; }
    .ln-textbook.wide .tbl-parts { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
    .ln-textbook.wide .tb-ch-grid { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 36px; align-items: start; }
    .ln-textbook.wide .tb-ch-aside { position: sticky; top: 12px; max-height: calc(100vh - 110px); overflow: auto; }
    .ln-textbook.wide .tb-ch-main { max-width: 860px; }
    .ln-textbook.wide .tb-body { font-size: 16px; }
  }
`;

/* ------------------------------ СХЕМЫ ------------------------------ */
// кругооборот и балансы банков (src/textbook-diagrams.jsx); подпись — как у графика
function DiagramBox({ b, ctx }) {
  const n = (k, d) => (b.attrs[k] != null && Number.isFinite(Number(b.attrs[k])) ? Number(b.attrs[k]) : d);
  return (
    <div className="ems-panel" style={{ padding: 14, margin: '16px 0' }}>
      {b.diagram === 'circular' && <CircularFlow total={n('total', 1000)} />}
      {b.diagram === 'balance' && <BalanceSheets base={n('base', 1000)} rr={n('rr', 0.1)} />}
      {b.caption && <div style={{ fontSize: 12.5, color: COLOR.muted, lineHeight: 1.55, marginTop: 8 }} data-testid="tb-caption"><Inline nodes={b.caption} ctx={ctx} /></div>}
    </div>
  );
}

/* ------------------------------ ФОРМУЛЫ ------------------------------ */
// «где P — цена, …» под выключной формулой главы: только буквы из этой формулы
function SymbolLegend({ tex, chapter }) {
  const list = formulaSymbols(tex, chapter);
  if (!list.length) return null;
  return (
    <div className="tb-legend" data-testid="tb-legend">
      <span style={{ fontStyle: 'italic' }}>где </span>
      {list.map((x, k) => <span key={x.key}>{k > 0 && '; '}<Tex tex={x.key} /> — {x.text}</span>)}
    </div>
  );
}
function Tex({ tex, display = false }) {
  const html = useMemo(() => {
    try { return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }); }
    catch { return tex; }
  }, [tex, display]);
  if (display) return <div className="tb-math" dangerouslySetInnerHTML={{ __html: html }} />;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ------------------------------ ССЫЛКИ ------------------------------ */
function TermLink({ id, label }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[id];
  if (!g) return <>{label}</>;
  return (
    <span>
      <span className="tb-term" role="button" tabIndex={0} title={`${g.title} — ${g.text}`}
        onClick={() => { Audio.play('tick'); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}>{label || g.title.toLowerCase()}</span>
      {open && <span className="tb-def"><b style={{ color: COLOR.goldSoft }}>{g.title}</b> — {g.text}</span>}
    </span>
  );
}

// подпись ссылки по умолчанию — из того, на что она указывает
function defaultLabel(n) {
  switch (n.kind) {
    case 'lever': return (LEVER_BY_ID[n.target] || {}).label || n.target;
    case 'drill': return `Задача: ${(DRILL_BY_ID[n.target] || {}).title || n.target}`;
    case 'scenario': return `Сценарий: ${(SCENARIOS.find((s) => s.id === n.target) || {}).title || n.target}`;
    case 'lab': return `Лаборатория: ${(LEVER_BY_ID[n.target] || {}).label || n.target}`;
    case 'tycoon': return `Своё дело: ${(TYCOON_TASKS[n.target] || {}).title || n.target}`;
    case 'chapter': return `«${(CHAPTER_BY_ID[n.target] || {}).title || n.target}»`;
    case 'card': return (CARD_BY_ID[n.target] || {}).title || n.target;
    case 'appendix': return `«${(APPENDIX_BY_ID[n.target] || {}).title || n.target}»`;
    default: return n.target;
  }
}
const labelOf = (n, ctx) => (n.label ? <Inline nodes={parseInline(n.label)} ctx={ctx} /> : defaultLabel(n));

// что делает ссылка: переход внутри учебника или выход в игру
function linkAction(n, ctx) {
  switch (n.kind) {
    case 'chapter': return () => ctx.go({ kind: 'chapter', id: n.target, ...(n.params.at ? { anchor: n.params.at } : {}) });
    case 'card': return () => ctx.go({ kind: 'appendix', id: 'cards', anchor: n.target });
    case 'appendix': return () => ctx.go({ kind: 'appendix', id: n.target, ...(n.params.at ? { anchor: n.params.at } : {}) });
    case 'lab': return ctx.onOpenLab ? () => ctx.onOpenLab({ lever: n.target, ...n.params }) : null;
    case 'drill': return ctx.onStartDrill && DRILL_BY_ID[n.target] ? () => { Audio.prime(); Audio.play('stamp'); ctx.onStartDrill(drillSetup(DRILL_BY_ID[n.target])); } : null;
    case 'tycoon': return ctx.onOpenTycoon && TYCOON_TASKS[n.target] ? () => ctx.onOpenTycoon(n.target, TYCOON_TASKS[n.target]) : null;
    case 'scenario': return ctx.onOpenScenario ? () => ctx.onOpenScenario(n.target) : null;
    case 'lever': return ctx.onOpenLab && LAB_LEVERS.some((l) => l.id === n.target) ? () => ctx.onOpenLab({ lever: n.target }) : null;
    default: return null;
  }
}

function Link({ n, ctx }) {
  if (n.kind === 'term') return <TermLink id={n.target} label={n.label} />;
  const act = linkAction(n, ctx);
  const lever = n.kind === 'lever' ? LEVER_BY_ID[n.target] : null;
  if (!act) return <span title={lever ? lever.hint : undefined}>{labelOf(n, ctx)}</span>;
  return (
    <button type="button" className="tb-link" title={lever ? `${lever.label}${lever.hint ? ` — ${lever.hint}` : ''}` : undefined}
      onClick={() => { Audio.play('click'); act(); }}>{labelOf(n, ctx)}</button>
  );
}

export function Inline({ nodes, ctx }) {
  return nodes.map((n, i) => {
    if (n.t === 'text') return <React.Fragment key={i}>{n.v}</React.Fragment>;
    if (n.t === 'math') return <Tex key={i} tex={n.v} />;
    if (n.t === 'b') return <b key={i}><Inline nodes={n.c} ctx={ctx} /></b>;
    if (n.t === 'i') return <i key={i}><Inline nodes={n.c} ctx={ctx} /></i>;
    if (n.t === 'link') return <Link key={i} n={n} ctx={ctx} />;
    // термин с подсказкой (упражнения Пути): нажатие открывает определение из словаря
    if (n.t === 'term') {
      return ctx && ctx.onTerm
        ? <button key={i} type="button" className="tb-term" data-term={n.id} onClick={(e) => { e.stopPropagation(); ctx.onTerm(n.id); }}>{n.v}</button>
        : <React.Fragment key={i}>{n.v}</React.Fragment>;
    }
    return null;
  });
}

/* ------------------------------ БЛОКИ ------------------------------ */
const BOX = {
  model: { label: 'Учебная модель', icon: BookOpen, color: () => COLOR.blue },
  game: { label: 'Как это устроено в игре', icon: Gamepad2, color: () => COLOR.teal },
  example: { label: 'Разбор на числах', icon: Calculator, color: () => COLOR.gold },
  numbers: { label: 'Пример', icon: Calculator, color: () => COLOR.goldSoft },
  try: { label: 'Проверьте в игре', icon: Play, color: () => COLOR.rust },
  note: { label: 'Заметка', icon: Info, color: () => COLOR.muted },
  goals: { label: 'После главы вы сможете', icon: Target, color: () => COLOR.gold },
  summary: { label: 'Главное', icon: ListChecks, color: () => COLOR.teal },
  mistakes: { label: 'Типичные ошибки', icon: TriangleAlert, color: () => COLOR.rust },
};

// врезка; строка «+++» в тексте прячет подробности под кнопку «Подробнее»
function BoxView({ b, ctx }) {
  const [more, setMore] = useState(false);
  const k = BOX[b.kind] || BOX.note; const Icon = k.icon; const color = k.color();
  return (
    <div className="tb-box" style={{ borderLeftColor: color }} data-testid={`tb-box-${b.kind}`}>
      <div className="tb-box-head" style={{ color }}><Icon size={13} />{b.title || k.label}</div>
      <Blocks blocks={b.children} ctx={ctx} />
      {b.more && (
        <>
          <button type="button" className="tb-link" style={{ fontSize: 13, marginBottom: 10 }} aria-expanded={more}
            onClick={() => { Audio.play('click'); setMore((v) => !v); }}>
            {more ? 'Скрыть подробности' : 'Подробнее'} <ChevronDown size={12} style={{ verticalAlign: -2, transform: more ? 'rotate(180deg)' : 'none' }} />
          </button>
          {more && <div data-testid="tb-more"><Blocks blocks={b.more} ctx={ctx} /></div>}
        </>
      )}
    </div>
  );
}

/* Вопрос на вспоминание в конце раздела: сначала короткий ответ своими словами, потом
   эталон и честная сверка «совпало / не совпало». Без своего ответа эталон открывается только
   через «Не помню» — это засчитывается как «не совпало»: вопрос вернётся через два дня,
   раздел пока не пройден. */
const MIN_RECALL = 12;
function RecallCard({ b, ctx, from }) {
  const rec = ctx.progress.problems[b.id];
  const [text, setText] = useState('');
  const [stage, setStage] = useState('write'); // write → check → done
  const [said, setSaid] = useState(null);
  const ready = text.replace(/\s+/g, '').length >= MIN_RECALL;
  const mark = (ok) => {
    Audio.play(ok ? 'stamp' : 'tick');
    ctx.onAnswer(b.id, ok, {});
    setSaid(ok); setStage('done');
  };
  return (
    <div className="tb-box" style={{ borderLeftColor: COLOR.blue }} data-testid="tb-recall" data-recall={b.id}>
      <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <div className="tb-box-head" style={{ color: COLOR.blue, marginBottom: 6 }}><Brain size={13} />{from ? `${from} · ` : ''}Вспомните</div>
        {rec && said == null && <span className="tb-chip" style={{ color: rec.ok ? COLOR.teal : COLOR.rust, borderColor: rec.ok ? COLOR.teal : COLOR.rust }}>
          {rec.ok ? 'совпало' : 'не совпало'}{rec.due ? ` · повтор ${daysUntil(rec.due)}` : ''}</span>}
      </div>
      <Blocks blocks={b.question} ctx={ctx} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={stage !== 'write'}
        aria-label="Ваш ответ на вопрос раздела" placeholder="Ответьте своими словами, одна-две фразы"
        style={{ ...inputStyle(), width: '100%', fontSize: 13, resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
      {stage === 'write' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <button type="button" className="ems-btn primary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={!ready}
            onClick={() => { Audio.play('click'); setStage('check'); }}>Сверить с ответом</button>
          <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => mark(false)}>Не помню</button>
          {!ready && <span style={{ fontSize: 12, color: COLOR.faint }}>сначала свой ответ</span>}
        </div>
      )}
      {stage !== 'write' && (
        <>
          <div style={{ borderTop: `1px solid ${COLOR.hairline}`, paddingTop: 8 }} data-testid="tb-recall-answer">
            <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 4 }}>Ответ учебника</div>
            <Blocks blocks={b.answer} ctx={ctx} />
          </div>
          {stage === 'check' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>Ваш ответ говорит о том же?</span>
              <button type="button" className="ems-btn primary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => mark(true)}>Совпало</button>
              <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => mark(false)}>Не совпало</button>
            </div>
          ) : (
            <div data-testid="tb-recall-verdict" style={{ fontSize: 13, marginBottom: 10, color: said ? COLOR.teal : COLOR.rust }}>
              {said ? 'Раздел пройден.' : 'Вопрос вернётся на повторение через два дня. Перечитайте раздел — и дальше.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Схема-цепочка: звенья сверху вниз, у каждого — что происходит, если первое звено идёт вверх
   или вниз. Переключатель меняет направление всей цепочки. */
function FlowView({ b, ctx }) {
  const [dir, setDir] = useState('up');
  const first = b.steps[0] ? plainTitle(b.steps[0].title) : '';
  return (
    <div className="ems-panel" style={{ padding: 14, margin: '16px 0' }} data-testid="tb-flow">
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8 }}>{b.title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['up', `${first}: вверх`], ['down', `${first}: вниз`]].map(([k, label]) => (
          <button key={k} type="button" className="tb-pick" aria-pressed={dir === k} onClick={() => { Audio.play('click'); setDir(k); }}>{label}</button>
        ))}
      </div>
      <div style={{ maxWidth: 460 }}>
        {b.steps.map((st, k) => (
          <React.Fragment key={k}>
            {k > 0 && <div style={{ textAlign: 'center', color: COLOR.faint, lineHeight: 1 }}><ArrowDown size={16} /></div>}
            <div className="tb-flow-step" data-testid="tb-flow-step">
              <div style={{ fontSize: 13.5, fontWeight: 600 }}><Inline nodes={st.title} ctx={ctx} /></div>
              <div style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.5 }}><Inline nodes={dir === 'up' ? st.up : st.down} ctx={ctx} /></div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {b.caption && <div style={{ fontSize: 12.5, color: COLOR.muted, marginTop: 10, lineHeight: 1.55 }}><Inline nodes={b.caption} ctx={ctx} /></div>}
    </div>
  );
}

// простой текст строки — для подписей
const plainTitle = (nodes) => nodes.map((n) => (n.t === 'text' || n.t === 'math' ? n.v : n.c ? plainTitle(n.c) : n.label || n.target || '')).join('');

/* Задачи главы сворачиваются по уровням: базовый открыт сразу, семинарский и олимпиадный —
   по нажатию. Уровень — подзаголовок «… уровень» и всё до следующего заголовка. */
const isLevelHead = (b) => b.type === 'h3' && plainTitle(b.inline).trim().toLowerCase().endsWith('уровень');
function groupLevels(blocks) {
  const out = [];
  let g = null;
  blocks.forEach((b) => {
    if (isLevelHead(b)) { g = { type: 'levels', title: plainTitle(b.inline).trim(), blocks: [] }; out.push(g); return; }
    if (b.type === 'h2' || b.type === 'h3') g = null;
    if (g) g.blocks.push(b); else out.push(b);
  });
  return out;
}
function LevelGroup({ g, ctx, startNo }) {
  const basic = g.title.toLowerCase().startsWith('базов');
  const [open, setOpen] = useState(basic);
  const n = g.blocks.filter((b) => b.type === 'problem').length;
  const solved = g.blocks.filter((b) => b.type === 'problem' && ctx.progress.problems[b.id] && ctx.progress.problems[b.id].ok).length;
  return (
    <div data-testid="tb-level-group" data-level={g.title}>
      <button type="button" className="ems-btn" aria-expanded={open} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', margin: '14px 0 6px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => { Audio.play('click'); setOpen((v) => !v); }}>
        <ChevronDown size={14} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        <b style={{ flex: 1 }}>{g.title}</b>
        <span style={{ fontSize: 12, color: COLOR.muted }}>{n} {n === 1 ? 'задача' : n < 5 ? 'задачи' : 'задач'}{solved ? ` · решено ${solved}` : ''}</span>
      </button>
      {open && <Blocks blocks={g.blocks} ctx={ctx} startNo={startNo} />}
    </div>
  );
}

export function Blocks({ blocks: raw, ctx, top = false, startNo = 0 }) {
  let problemNo = startNo;
  let h2No = 0;
  const blocks = top ? groupLevels(raw) : raw;
  return blocks.map((b, i) => {
    if (b.type === 'levels') {
      const from = problemNo;
      problemNo += b.blocks.filter((x) => x.type === 'problem').length;
      return <LevelGroup key={`lv${i}`} g={b} ctx={ctx} startNo={from} />;
    }
    const action = actionOf(b);
    if (action) {
      const act = linkAction(action, ctx);
      return (
        <div key={i} style={{ margin: '4px 0 12px' }}>
          <button type="button" className="ems-btn" style={{ padding: '7px 13px', fontSize: 13 }} disabled={!act}
            onClick={() => { Audio.play('click'); if (act) act(); }}>
            <Play size={12} style={{ verticalAlign: -1, marginRight: 6 }} />{labelOf(action, ctx)}
          </button>
        </div>
      );
    }
    switch (b.type) {
      case 'h2': h2No += 1; return <h2 key={i} id={top ? b.anchor || `sec-${h2No}` : undefined} style={{ scrollMarginTop: 12 }}><Inline nodes={b.inline} ctx={ctx} /></h2>;
      case 'h3': return <h3 key={i}><Inline nodes={b.inline} ctx={ctx} /></h3>;
      case 'p': return <p key={i}><Inline nodes={b.inline} ctx={ctx} /></p>;
      case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}><Inline nodes={it} ctx={ctx} /></li>)}</ul>;
      case 'ol': return <ol key={i} start={b.start}>{b.items.map((it, j) => <li key={j}><Inline nodes={it} ctx={ctx} /></li>)}</ol>;
      case 'math': return <React.Fragment key={i}><Tex tex={b.tex} display />{ctx && ctx.chapter && <SymbolLegend tex={b.tex} chapter={ctx.chapter} />}</React.Fragment>;
      case 'table': return (
        <div key={i} className="tb-table">
          <table>
            <thead><tr>{b.head.map((c, j) => <th key={j}><Inline nodes={c} ctx={ctx} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Inline nodes={c} ctx={ctx} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      case 'box': return <BoxView key={i} b={b} ctx={ctx} />;
      case 'recall': return <RecallCard key={b.id} b={b} ctx={ctx} />;
      case 'flow': return <FlowView key={i} b={b} ctx={ctx} />;
      case 'chart': return <ChartBox key={i} type={b.chart} attrs={b.attrs} caption={b.caption} ctx={ctx} />;
      case 'diagram': return <DiagramBox key={i} b={b} ctx={ctx} />;
      case 'problem': problemNo += 1; return <ProblemCard key={b.id} block={b} no={problemNo} ctx={ctx} />;
      default: return null;
    }
  });
}

// {{имя}} в подписи графика → число из модели при текущих ползунках
const fillVars = (nodes, vars) => nodes.map((n) => {
  // в формуле десятичная запятая — {,}, иначе KaTeX ставит после неё пробел
  if ((n.t === 'text' || n.t === 'math') && n.v.includes('{{')) return { ...n, v: n.v.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? (n.t === 'math' ? vars[k].replace(',', '{,}') : vars[k]) : m)) };
  if (n.c) return { ...n, c: fillVars(n.c, vars) };
  return n;
});

/* ------------------------------ ГРАФИК ------------------------------ */
/* Размер графика в единицах SVG подстраивается под ширину экрана: на телефоне холст
   уже, поэтому надписи в 12 единиц остаются 12 пикселями, а не сжимаются до восьми. */
const M = { l: 44, r: 18, t: 16, b: 34 };
function useWidth(ref, fallback = 560) {
  const [w, setW] = useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => setW(el.clientWidth || fallback);
    upd();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo; const raw = span / n; const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((x) => x >= raw) || 10 * pow;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const CURVE_COLOR = { blue: () => COLOR.blue, rust: () => COLOR.rust, teal: () => COLOR.teal, gold: () => COLOR.gold };

export function ChartSvg({ scene }) {
  const box = React.useRef(null);
  const width = useWidth(box);
  const W = Math.round(Math.max(300, Math.min(560, width)));
  const H = W < 480 ? Math.round(W * 0.82) : 330;
  const [x0, x1] = scene.xDomain; const [y0, y1] = scene.yDomain;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const clipId = useMemo(() => `tbclip${Math.random().toString(36).slice(2, 8)}`, []);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const inside = (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  const labelAt = (pts, pos) => {
    if (pos === 'start') return { x: sx(pts[0].x) + 6, y: sy(pts[0].y) - 6 };
    // доля пути по кривой: 0,3 — треть от начала
    if (typeof pos === 'number') {
      // между вершинами — по прямой, а не прыжком к ближайшей; и подпись не вылезает за поле графика
      const f = Math.max(0, Math.min(1, pos)) * (pts.length - 1); const k = Math.min(pts.length - 2, Math.floor(f)); const t = f - k;
      const a = pts[Math.max(0, k)]; const b = pts[Math.min(pts.length - 1, k + 1)];
      const x = sx(a.x + (b.x - a.x) * t) + 6; const y = sy(a.y + (b.y - a.y) * t) - 10;
      return { x: Math.min(W - M.r - 4, x), y: Math.min(H - M.b - 8, Math.max(M.t + 12, y)) };
    }
    if (pos === 'mid') {
      const m = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
      return { x: sx(m.x) + 8, y: sy(m.y) - 8 };
    }
    const vis = pts.filter(inside);
    const p = vis[vis.length - 1] || pts[pts.length - 1];
    // в стороне от линии и не на оси
    return { x: Math.min(W - M.r - 4, sx(p.x) + 6), y: Math.min(H - M.b - 8, Math.max(M.t + 12, sy(p.y) - 8)) };
  };
  // надпись с подложкой цвета фона: читается, даже если легла на линию
  const halo = { stroke: COLOR.panel, strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' };
  return (
    <div ref={box} style={{ width: '100%' }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="График" style={{ display: 'block', maxWidth: 560, margin: '0 auto', fontFamily: 'inherit' }}>
      <defs><clipPath id={clipId}><rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} /></clipPath></defs>
      {niceTicks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={COLOR.border} strokeOpacity={0.45} />
          <text x={sx(t)} y={H - M.b + 14} fontSize={11} fill={COLOR.faint} textAnchor="middle">{fmtNum(t)}</text>
        </g>
      ))}
      {niceTicks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={COLOR.border} strokeOpacity={0.45} />
          {/* у самого верха стоит подпись оси — число там не пишем, чтобы они не слиплись */}
          {sy(t) - M.t > 9 && <text x={M.l - 6} y={sy(t) + 3.5} fontSize={11} fill={COLOR.faint} textAnchor="end">{fmtNum(t)}</text>}
        </g>
      ))}
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={COLOR.muted} />
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke={COLOR.muted} />
      <text x={W - M.r} y={H - 6} fontSize={12} fill={COLOR.muted} textAnchor="end" fontStyle="italic">{scene.xLabel}</text>
      <text x={M.l - 30} y={M.t + 4} fontSize={12} fill={COLOR.muted} fontStyle="italic">{scene.yLabel}</text>
      <g clipPath={`url(#${clipId})`}>
        {(scene.rects || []).map((r, i) => {
          const tone = r.tone === 'rust' ? COLOR.rust : COLOR.gold;
          return (
            <g key={`r${i}`}>
              <rect x={sx(r.x0)} y={sy(r.y1)} width={Math.max(0, sx(r.x1) - sx(r.x0))} height={Math.max(0, sy(r.y0) - sy(r.y1))} fill={tone} fillOpacity={0.16} stroke={tone} strokeOpacity={0.5} />
              <text x={(sx(r.x0) + sx(r.x1)) / 2} y={(sy(r.y0) + sy(r.y1)) / 2 + 4} fontSize={12} {...halo} fill={r.tone === 'rust' ? COLOR.rust : COLOR.goldSoft} textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
        {(scene.polys || []).map((g, i) => (
          <polygon key={`poly${i}`} points={g.points.map((pt) => `${sx(pt.x).toFixed(1)},${sy(pt.y).toFixed(1)}`).join(' ')}
            fill={(CURVE_COLOR[g.tone] || CURVE_COLOR.rust)()} fillOpacity={0.2} stroke={(CURVE_COLOR[g.tone] || CURVE_COLOR.rust)()} strokeOpacity={0.45} />
        ))}
        {scene.curves.map((c) => (
          <path key={c.id} d={path(c.points)} fill="none" stroke={(CURVE_COLOR[c.color] || CURVE_COLOR.gold)()}
            strokeWidth={c.ghost ? 1.5 : 2.4} strokeOpacity={c.ghost ? 0.35 : 1} strokeDasharray={c.ghost || c.dashed ? '5 4' : undefined} />
        ))}
        {(scene.segments || []).map((s, i) => (
          <g key={`s${i}`}>
            <line x1={sx(s.x0)} x2={sx(s.x1)} y1={sy(s.y)} y2={sy(s.y)} stroke={COLOR.gold} strokeWidth={5} strokeOpacity={0.8} />
            <text x={(sx(s.x0) + sx(s.x1)) / 2} y={sy(s.y) + 16} fontSize={12} {...halo} fill={COLOR.goldSoft} textAnchor="middle">{s.label}</text>
          </g>
        ))}
        {scene.points.filter((p) => p.guide && inside(p)).map((p, i) => (
          <g key={`g${i}`} stroke={COLOR.muted} strokeDasharray="3 3" strokeOpacity={0.8}>
            <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={H - M.b} />
            <line x1={M.l} x2={sx(p.x)} y1={sy(p.y)} y2={sy(p.y)} />
          </g>
        ))}
      </g>
      {(scene.polys || []).map((g, i) => {
        // подпись области — в её центре, но целиком внутри графика; у крошечных областей её нет
        const P = g.points.map((pt) => [sx(pt.x), sy(pt.y)]);
        const area = Math.abs(P.reduce((a, [x, y], k) => { const [x2, y2] = P[(k + 1) % P.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
        if (!g.label || area < 900) return null;
        const w = g.label.length * 6.4;
        const cx = Math.min(W - M.r - w / 2 - 2, Math.max(M.l + w / 2 + 4, P.reduce((a, [x]) => a + x, 0) / P.length));
        const cy = P.reduce((a, [, y]) => a + y, 0) / P.length;
        return <text key={`pl${i}`} x={cx} y={cy + 4} fontSize={11.5} {...halo} fill={(CURVE_COLOR[g.tone] || CURVE_COLOR.rust)()} textAnchor="middle">{g.label}</text>;
      })}
      {scene.curves.filter((c) => c.label && !c.ghost).map((c) => {
        const at = labelAt(c.points, c.labelPos);
        return <text key={`l${c.id}`} x={at.x} y={at.y} fontSize={12.5} fontWeight={600} {...halo} fill={(CURVE_COLOR[c.color] || CURVE_COLOR.gold)()} textAnchor={at.x > W - 90 ? 'end' : 'start'}>{c.label}</text>;
      })}
      {scene.points.filter(inside).map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.small ? 3 : 5} fill={p.small ? COLOR.muted : COLOR.goldSoft} stroke={COLOR.bg} strokeWidth={1.5} />
          <text x={Math.min(sx(p.x) + 8, W - M.r - 2)} y={p.below ? sy(p.y) + 17 : sy(p.y) - 8} fontSize={p.small ? 11 : 12.5} {...halo} textAnchor={sx(p.x) > W - 70 ? 'end' : 'start'}
            fill={p.small ? COLOR.muted : COLOR.goldSoft} fontWeight={p.small ? 400 : 700}>{p.label}</text>
        </g>
      ))}
    </svg>
    </div>
  );
}

/* График с ползунками. Сам хранит положение ползунков, если его не ведёт задача:
   в графической задаче values/onValues приходят снаружи, only — какие ползунки показать. */
function ChartBox({ type, attrs, caption, ctx, values: outer = null, onValues = null, only = null, framed = true }) {
  const def = CHARTS[type];
  const [own, setOwn] = useState(() => (def ? chartDefaults(type, attrs) : {}));
  if (!def) return null;
  const values = outer || own;
  const setValues = (fn) => { const next = typeof fn === 'function' ? fn(values) : fn; if (onValues) onValues(next); else setOwn(next); };
  const controls = def.controls(attrs).filter((c) => !only || only.includes(c.id));
  const scene = def.build(attrs, values);
  const set = (id, v) => setValues((s) => ({ ...s, [id]: v }));
  return (
    <div className={framed ? 'ems-panel' : undefined} style={{ padding: framed ? 14 : 0, margin: framed ? '16px 0' : '8px 0' }} data-testid="tb-chart" data-chart={type}>
      <div className="row-between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>{def.title}</span>
        <button type="button" className="ems-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => { Audio.play('click'); setValues(chartDefaults(type, attrs)); }}>
          <RotateCcw size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Сбросить
        </button>
      </div>
      <ChartSvg scene={scene} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '8px 16px', marginTop: 8 }}>
        {controls.map((c) => {
          if (c.button) {
            return (
              <button key={c.id} type="button" className="ems-btn" style={{ padding: '6px 10px', fontSize: 12, alignSelf: 'end' }}
                onClick={() => { Audio.play('click'); setValues((s) => def.onButton(attrs, s)); }}>{c.label}</button>
            );
          }
          if (c.toggle) {
            return (
              <button key={c.id} type="button" className="ems-btn" aria-pressed={!!values[c.id]} style={{ padding: '6px 10px', fontSize: 12, alignSelf: 'end',
                borderColor: values[c.id] ? COLOR.gold : undefined, color: values[c.id] ? COLOR.goldSoft : undefined }}
                onClick={() => { Audio.play('click'); set(c.id, !values[c.id]); }}>{values[c.id] ? '✓ ' : ''}{c.label}</button>
            );
          }
          return (
            <label key={c.id} style={{ fontSize: 12, color: COLOR.muted }}>
              <span className="row-between"><span>{c.label}</span><span className="ems-mono" style={{ color: COLOR.text }}>{c.fmt(values[c.id])}</span></span>
              <input type="range" className="tb-slider" aria-label={c.label} min={c.min} max={c.max} step={c.step} value={values[c.id]}
                onChange={(e) => set(c.id, Number(e.target.value))} />
            </label>
          );
        })}
      </div>
      <div data-testid="tb-readout" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginTop: 10, fontSize: 12.5 }}>
        {scene.readout.map((r) => (
          <span key={r.label} style={{ color: COLOR.muted }}>{r.label}: <b className="ems-mono" style={{ color: COLOR.text }}>{r.value}</b></span>
        ))}
      </div>
      {caption && <div style={{ fontSize: 12.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.55 }} data-testid="tb-caption"><Inline nodes={fillVars(caption, captionVars(type, attrs, values))} ctx={ctx} /></div>}
    </div>
  );
}

/* ------------------------------ ЗАДАЧИ ------------------------------
   Три вида: ответ числом, «верно или неверно, объясните» и графическая (сдвиньте кривую —
   проверяется, куда пошли величины графика). Рамка, счёт и решение у всех общие. */
const DIR_WORD = { '+': 'растёт', '-': 'падает', 0: 'не меняется', '?': 'любое' };
const KIND_LABEL = { number: 'Задача', truefalse: 'Верно или неверно', graph: 'Графическая задача' };

// контекст для «Сообщить об ошибке»: задача, условие, что ввёл ученик и правильный ответ
const problemContext = (block, given, answerText) => ({
  screen: 'textbook-problem', kind: block.kind, exercise: block.id, unit: block.chapter || '',
  prompt: flatProblem(block.statement).slice(0, 1500), answer: given == null ? '' : String(given).slice(0, 480), correct: String(answerText || '').slice(0, 480),
});
function flatProblem(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(flatProblem).filter(Boolean).join(' ');
  if (typeof x === 'object') return Object.entries(x).filter(([k]) => k !== 'id' && k !== 'type' && k !== 't').map(([, v]) => flatProblem(v)).filter(Boolean).join(' ');
  return '';
}
function ProblemFrame({ block, no, ctx, from, children, verdict, answerText, onSolutionOpen, given = null }) {
  const rec = ctx.progress.problems[block.id];
  // решение открыто по кнопке; после ответа, если задача его открывает, — само, пока его не скроют
  const [solMode, setSolMode] = useState(null);
  const [hintsShown, setHintsShown] = useState(0);
  const hints = block.hints || [];
  const status = rec ? (rec.ok ? 'решена' : 'не решена') : null;
  const open = solMode != null ? solMode : !!(verdict && verdict.reveal);
  return (
    <div className="ems-panel" style={{ padding: 14, margin: '12px 0' }} data-testid="tb-problem" data-problem={block.id} data-kind={block.kind}>
      <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>{from ? `${from} · ` : ''}{KIND_LABEL[block.kind] || 'Задача'} · {no}</span>
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {block.news && <span className="tb-chip">по газете</span>}
          {LEVELS[block.level] && <span className="tb-chip" data-testid="tb-level">{LEVELS[block.level]}</span>}
          {block.parts && block.parts.length > 1 && <span className="tb-chip">{block.parts.length} {block.parts.length < 5 ? 'пункта' : 'пунктов'}</span>}
          {status && <span className="tb-chip" style={{ color: rec.ok ? COLOR.teal : COLOR.rust, borderColor: rec.ok ? COLOR.teal : COLOR.rust }}>
            {status}{rec.due ? ` · повтор ${daysUntil(rec.due)}` : ''}</span>}
        </span>
      </div>
      {block.news && (
        <div className="tb-news" data-testid="tb-news">
          <div className="ems-mono tb-news-mast">ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div>
          <div className="ems-serif tb-news-head">{block.news}</div>
        </div>
      )}
      <div className="tb-body"><Blocks blocks={block.statement} ctx={ctx} /></div>
      {children}
      {verdict && (
        <div data-testid="tb-verdict" style={{ fontSize: 13, marginTop: 8, color: verdict.bad ? COLOR.muted : verdict.ok ? COLOR.teal : COLOR.rust }}>
          {verdict.ok && <Check size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{verdict.text}
        </div>
      )}
      {verdict && verdict.traps && verdict.traps.length > 0 && (
        <div className="tb-box" style={{ borderLeftColor: COLOR.rust, margin: '8px 0 0' }} data-testid="tb-trap">
          <div className="tb-box-head" style={{ color: COLOR.rust }}>Похоже на типичную ошибку</div>
          {verdict.traps.map((tr, k) => (
            <p key={k} style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 8px' }}>
              {tr.label && <b className="ems-mono">{tr.label} </b>}<Inline nodes={tr.text} ctx={ctx} />
            </p>
          ))}
        </div>
      )}
      {hintsShown > 0 && (
        <div data-testid="tb-hints" style={{ marginTop: 8 }}>
          {hints.slice(0, hintsShown).map((h, k) => (
            <div key={k} style={{ fontSize: 13, color: COLOR.muted, lineHeight: 1.55, marginBottom: 4 }}>
              <b style={{ color: COLOR.goldSoft }}>Подсказка {k + 1}.</b> <Inline nodes={h} ctx={ctx} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {hintsShown < hints.length && (
          <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }}
            onClick={() => { Audio.play('click'); setHintsShown((n) => n + 1); }}>Подсказка{hints.length > 1 ? ` ${hintsShown + 1} из ${hints.length}` : ''}</button>
        )}
        <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }} aria-expanded={!!open}
          onClick={() => { Audio.play('click'); if (!open && onSolutionOpen) onSolutionOpen(); setSolMode(!open); }}>{open ? 'Скрыть решение' : 'Решение'}</button>
        {ctx.reportFlag && <span style={{ marginLeft: 'auto' }} data-testid="tb-report">{ctx.reportFlag(() => problemContext(block, given, answerText))}</span>}
      </div>
      {open && (
        <div className="tb-box" style={{ borderLeftColor: COLOR.gold, marginBottom: 0 }}>
          <div className="tb-box-head" style={{ color: COLOR.gold }}>Решение · {answerText}</div>
          <div className="tb-body"><Blocks blocks={block.solution} ctx={ctx} /></div>
        </div>
      )}
    </div>
  );
}
const WRONG = 'Пока неверно. Задача вернётся в список «на повторение» через два дня — загляните в решение.';
const inputStyle = () => ({ padding: '7px 10px', fontSize: 14, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text });
// «292 руб.» + точка в конце фразы не даёт «руб..»
const endDot = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
const partText = (pt) => `${pt.label ? `${pt.label} ` : ''}${fmtNum(pt.answer)}${pt.unit ? ` ${pt.unit}` : ''}`;
const withUnit = (block) => block.parts.map(partText).join('; ');

/* Уверенность — до ответа: «уверен» или «не уверен». В прогрессе потом видно, насколько
   уверенные ответы оказываются верными. */
function SurePick({ value, onChange, disabled = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }} role="group" aria-label="Уверенность в ответе">
      <span style={{ fontSize: 12, color: COLOR.faint }}>Уверенность:</span>
      {[[true, 'Уверен'], [false, 'Не уверен']].map(([v, label]) => (
        <button key={label} type="button" className="tb-pick" aria-pressed={value === v} disabled={disabled}
          onClick={() => { Audio.play('tick'); onChange(v); }}>{label}</button>
      ))}
    </div>
  );
}
const NEED_SURE = 'Сначала отметьте, уверены ли вы в ответе.';
// что будет с повторением после верного ответа — словами (см. scheduleAfter)
function okText(ctx, id, head, sawSolution) {
  const s = scheduleAfter(ctx.progress.problems[id], true, Date.now(), { sawSolution });
  if (s.why === 'solution') return `${endDot(head)} Решение было открыто, поэтому задача вернётся на повторение через два дня — попробуйте тогда сами.`;
  if (s.why === 'early') return `${endDot(head)} Повторение остаётся по плану — ${daysUntil(s.due)}: ответ до срока расписание не меняет.`;
  if (s.why === 'advance') return `${endDot(head)} Следующее повторение — ${daysUntil(s.due)}.`;
  if (s.why === 'done') return `${endDot(head)} Задача ушла из повторения.`;
  return endDot(head);
}

/* Калькулятор задач учебника: выражение с клавиатуры или кнопками (+ − × ÷, степень, корень,
   скобки), результат — по ходу набора; «В ответ» вставляет его в поле, где стоял курсор
   (или в первое пустое). Подсказкой не считается: считать в уме никто не просит. */
const TB_KEYS = ['7', '8', '9', '÷', '(', '4', '5', '6', '×', ')', '1', '2', '3', '−', '^', '0', ',', 'C', '+', '√'];
function TbCalc({ onUse, label = 'В ответ' }) {
  const [expr, setExpr] = useState('');
  const v = evalExpr(expr);
  const press = (k) => { Audio.play('tick'); if (k === 'C') setExpr(''); else if (k === '√') setExpr((e) => pressRoot(e)); else setExpr((e) => (e.length < 40 ? e + ({ '÷': '/', '×': '*', '−': '-' }[k] || k) : e)); };
  return (
    <div className="tb-calc" data-testid="tb-calc">
      <input value={expr} onChange={(e) => setExpr(e.target.value.replace(/[^0-9.,+\-−*/×÷:^√()\s]/g, '').slice(0, 40))} aria-label="Выражение для калькулятора" placeholder="например, (120−60)/2"
        style={{ ...inputStyle(), width: '100%', boxSizing: 'border-box', fontFamily: 'var(--ds-mono, monospace)' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (v != null) onUse(fmtResult(v).replace('−', '-')); } }} />
      <div className="tb-calc-screen" data-testid="tb-calc-value" style={{ fontSize: 18, fontWeight: 700 }}>{v != null ? `= ${fmtResult(v)}` : expr ? '…' : '0'}</div>
      <div className="tb-calc-keys" role="group" aria-label="Калькулятор">
        {TB_KEYS.map((k) => (
          <button key={k} type="button" className={'÷×−+^√()'.includes(k) ? 'op' : ''} data-calc={k} onClick={() => press(k)}
            aria-label={({ '÷': 'Разделить', '×': 'Умножить', '−': 'Вычесть', '+': 'Прибавить', '^': 'Степень', '√': 'Квадратный корень', C: 'Очистить' })[k] || k}>{k}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" className="ems-btn" style={{ padding: '6px 10px', fontSize: 12.5 }} aria-label="Стереть символ" onClick={() => { Audio.play('tick'); setExpr((e) => e.slice(0, -1)); }}>⌫</button>
        <button type="button" className="ems-btn primary" style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }} disabled={v == null} data-testid="tb-calc-use"
          onClick={() => { Audio.play('click'); onUse(fmtResult(v).replace('−', '-')); }}>{label}</button>
      </div>
    </div>
  );
}
// кнопка «Калькулятор» и сам калькулятор под полями ответа; at — поле, куда пойдёт результат
function CalcToggle({ onUse }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ems-btn" style={{ padding: '7px 12px', fontSize: 13 }} aria-expanded={open} data-testid="tb-calc-open"
        onClick={() => { Audio.play('click'); setOpen((x) => !x); }}><Calculator size={14} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />Калькулятор</button>
      {open && <div style={{ flexBasis: '100%' }}><TbCalc onUse={(x) => onUse(x)} /></div>}
    </>
  );
}

/* Числовая задача: одно поле или несколько шагов (а, б, в…). Засчитывается, только если
   верны все шаги; в ответе видно, какой шаг не сошёлся. */
function NumberProblem({ block, no, ctx, from }) {
  const parts = block.parts;
  const multi = parts.length > 1;
  const [inputs, setInputs] = useState(() => parts.map(() => ''));
  const [verdict, setVerdict] = useState(null);
  const [saw, setSaw] = useState(false);
  const [sure, setSure] = useState(null);
  const submit = () => {
    const rs = parts.map((pt, k) => checkAnswer(inputs[k], pt.answer, pt.tol, pt.unit));
    if (rs.some((r) => r.value == null)) { setVerdict({ bad: true, text: multi ? 'Заполните все шаги числами: например, 25, −0,5 или 2/3.' : 'Введите число: например, 25, −0,5 или 2/3.' }); return; }
    if (sure == null) { setVerdict({ bad: true, text: NEED_SURE }); return; }
    const ok = rs.every((r) => r.ok);
    Audio.play(ok ? 'stamp' : 'tick');
    // какие пункты сошлись, а какие нет: «верно/неверно» здесь не пишем — выбора «верно или неверно» в задаче нет
    const bad = parts.filter((pt, k) => !rs[k].ok).map((pt) => pt.label);
    const good = parts.filter((pt, k) => rs[k].ok).map((pt) => pt.label);
    const marks = multi ? ` ${good.length ? `Сошлось: ${good.join(' ')}. ` : ''}Не сошлось: ${bad.join(' ')} — разберите ${bad.length > 1 ? 'эти пункты' : 'этот пункт'} в решении.` : '';
    const text = ok ? okText(ctx, block.id, `Верно: ${withUnit(block)}`, saw) : `${multi ? `Ответ засчитывается, когда сходятся все пункты.${marks}` : 'Пока неверно.'} ${WRONG.replace(/^Пока неверно\. /, '').replace(/ — загляните в решение\./, '.')}`;
    ctx.onAnswer(block.id, ok, { sawSolution: saw, confident: sure });
    const traps = ok ? [] : matchTraps(block, inputs).map((tr) => ({ label: multi ? parts[tr.part].label : '', text: tr.text }));
    setVerdict({ ok, text, traps });
    setSure(null);
  };
  const setAt = (k, v) => { setInputs((xs) => xs.map((x, j) => (j === k ? v : x))); setVerdict(null); };
  // результат калькулятора — в поле, где был курсор, иначе в первое пустое
  const [focus, setFocus] = useState(null);
  const useCalc = (v) => { const k = focus != null ? focus : Math.max(0, inputs.findIndex((x) => !String(x).trim())); setAt(k, v); };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={`ответ ${withUnit(block)}`} onSolutionOpen={() => setSaw(true)}
      given={parts.map((pt, k) => `${pt.label ? `${pt.label} ` : ''}${inputs[k]}`).join('; ')}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div style={{ display: 'flex', gap: '8px 14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {parts.map((pt, k) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: COLOR.muted }}>
              {pt.label && <span className="ems-mono" style={{ color: COLOR.text }}>{pt.label}</span>}
              <input value={inputs[k]} onChange={(e) => setAt(k, e.target.value)} inputMode="decimal" onFocus={() => setFocus(k)}
                aria-label={multi ? `Задача ${no}, шаг ${pt.label}` : `Ответ к задаче ${no}`}
                placeholder="ответ числом" style={{ ...inputStyle(), width: multi ? 120 : 150 }} />
              {pt.unit && <span>{pt.unit}</span>}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <SurePick value={sure} onChange={(v) => { setSure(v); setVerdict(null); }} />
          <button type="submit" className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 13 }}>Проверить</button>
          <CalcToggle onUse={useCalc} />
        </div>
      </form>
    </ProblemFrame>
  );
}

/* «Верно или неверно, объясните». Сначала пишется объяснение, потом выбор. Неверный выбор —
   сразу на повторение. Верный — объяснение сверяется с ключевыми пунктами разбора, и
   засчитывается задача, только если объяснение с ними совпало. */
const MIN_WHY = 12;
function TrueFalseProblem({ block, no, ctx, from }) {
  const [why, setWhy] = useState('');
  const [stage, setStage] = useState('write'); // write → check → done
  const [verdict, setVerdict] = useState(null);
  const [saw, setSaw] = useState(false);
  const [sure, setSure] = useState(null);
  const ready = why.replace(/\s+/g, '').length >= MIN_WHY;
  const finish = (ok, text) => {
    Audio.play(ok ? 'stamp' : 'tick');
    const t = ok ? okText(ctx, block.id, text, saw) : text;
    ctx.onAnswer(block.id, ok, { sawSolution: saw, confident: sure }); setStage('done'); setVerdict({ ok, reveal: true, text: t });
  };
  const pick = (v) => {
    if (!ready) return;
    if (sure == null) { setVerdict({ bad: true, text: NEED_SURE }); return; }
    if (v !== block.answer) {
      finish(false, `Утверждение ${block.answer ? 'верно' : 'неверно'}. ${WRONG}`);
      setVerdict((vd) => ({ ...vd, traps: (block.traps || []).filter((tr) => tr.value === v) }));
      return;
    }
    setStage('check');
    setVerdict({ ok: true, text: `Выбор верный: утверждение ${block.answer ? 'верно' : 'неверно'}. Теперь сверьте объяснение.` });
  };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={block.answer ? 'утверждение верно' : 'утверждение неверно'}
      onSolutionOpen={() => { if (stage === 'write') setSaw(true); }} given={why}>
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} aria-label={`Объяснение к задаче ${no}`} disabled={stage !== 'write'}
        placeholder="Почему? Одна-две фразы"
        style={{ ...inputStyle(), width: '100%', fontSize: 13, resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
      {stage === 'write' && <SurePick value={sure} onChange={(v) => { setSure(v); setVerdict(null); }} />}
      {stage === 'write' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="ems-btn primary" style={{ padding: '7px 16px', fontSize: 13 }} disabled={!ready} onClick={() => pick(true)}>Верно</button>
          <button type="button" className="ems-btn primary" style={{ padding: '7px 16px', fontSize: 13 }} disabled={!ready} onClick={() => pick(false)}>Неверно</button>
          {!ready && <span style={{ fontSize: 12, color: COLOR.faint }}>сначала объяснение</span>}
        </div>
      )}
      {stage !== 'write' && (
        <div className="tb-box" style={{ borderLeftColor: COLOR.teal, marginBottom: 0 }} data-testid="tb-points">
          <div className="tb-box-head" style={{ color: COLOR.teal }}>Ключевые пункты объяснения</div>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {block.points.map((pt, k) => <li key={k}><Inline nodes={pt} ctx={ctx} /></li>)}
          </ul>
          {stage === 'check' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Ваше объяснение говорит о том же?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" className="ems-btn primary" style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => finish(true, 'Засчитано: и выбор, и объяснение')}>Совпало</button>
                <button type="button" className="ems-btn" style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => finish(false, 'Выбор верный, но объяснение неполное — задача вернётся на повторение через два дня.')}>Не совпало</button>
              </div>
            </>
          )}
        </div>
      )}
    </ProblemFrame>
  );
}

// графическая: игрок двигает кривые, проверяются направления величин графика
function GraphProblem({ block, no, ctx, from }) {
  const def = CHARTS[block.chart];
  const [values, setValues] = useState(() => chartDefaults(block.chart, block.attrs));
  const [verdict, setVerdict] = useState(null);
  const [saw, setSaw] = useState(false);
  const [sure, setSure] = useState(null);
  const names = def.measureNames || {};
  const answer = block.expect.filter((e) => e.dir !== '?').map((e) => `${names[e.key] || e.key}: ${DIR_WORD[e.dir]}`).join(', ');
  const submit = () => {
    const r = checkGraph(block.chart, block.attrs, values, { expect: block.expect, still: block.still });
    if (!r.moved) { setVerdict({ bad: true, text: 'Сначала сдвиньте кривую ползунком.' }); return; }
    if (sure == null) { setVerdict({ bad: true, text: NEED_SURE }); return; }
    const got = r.rows.map((x) => `${names[x.key] || x.key} ${DIR_WORD[x.got]}${x.ok ? '' : ' ✗'}`).join(', ');
    const extra = r.touched.length ? ` Условие не меняет: ${r.touched.map((k) => (def.controls(block.attrs).find((c) => c.id === k) || {}).label || k).join(', ')} — верните ползунок.` : '';
    Audio.play(r.ok ? 'stamp' : 'tick');
    const text = r.ok ? okText(ctx, block.id, `Верно: ${got}`, saw) : `На графике: ${got}.${extra} ${WRONG}`;
    ctx.onAnswer(block.id, r.ok, { sawSolution: saw, confident: sure });
    // ловушка графической задачи — сдвинут «не тот» ползунок
    const d0 = chartDefaults(block.chart, block.attrs);
    const traps = r.ok ? [] : (block.traps || []).filter((tr) => Math.abs((values[tr.control] || 0) - (d0[tr.control] || 0)) > 1e-9);
    setVerdict({ ok: r.ok, text, traps });
    setSure(null);
  };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={answer} onSolutionOpen={() => setSaw(true)} given={JSON.stringify(values)}>
      <ChartBox type={block.chart} attrs={block.attrs} ctx={ctx} values={values} onValues={(v) => { setValues(v); setVerdict(null); }}
        only={block.controls} framed={false} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SurePick value={sure} onChange={(v) => { setSure(v); setVerdict(null); }} />
        <button type="button" className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={submit}>Проверить сдвиг</button>
      </div>
    </ProblemFrame>
  );
}

function ProblemCard(props) {
  const k = props.block.kind;
  if (k === 'truefalse') return <TrueFalseProblem {...props} />;
  if (k === 'graph') return <GraphProblem {...props} />;
  return <NumberProblem {...props} />;
}

/* ------------------------------ СТРАНИЦЫ ------------------------------ */
// «Назад» — туда, откуда пришли по ссылке; «Оглавление» — всегда
const PAGE_TITLE = { toc: 'Оглавление', review: 'Повторение', mixed: 'Задачи вперемешку', stats: 'Мой прогресс' };
const pageTitle = (pg) => (!pg ? '' : PAGE_TITLE[pg.kind] || (pg.kind === 'exam' ? (EXAMS[pg.id] || {}).title : pg.kind === 'chapter' ? (CHAPTER_BY_ID[pg.id] || {}).title : (APPENDIX_BY_ID[pg.id] || {}).title));
/* Внутри обучения (embedded) у учебника ОДИН «назад» — кнопка в верхней панели: на прошлую
   страницу, а с первой — в оглавление (вкладка «Учебник») или туда, откуда учебник открыли.
   Ни «Назад: …», ни «Оглавление» на странице не дублируют её. */
function PageNav({ ctx }) {
  if (ctx.embedded) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {ctx.prev && ctx.prev.kind !== 'toc' && (
        <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} data-testid="tb-back" onClick={() => { Audio.play('click'); ctx.back(); }}>
          <ChevronLeft size={12} style={{ verticalAlign: -2 }} /> Назад: {pageTitle(ctx.prev)}
        </button>
      )}
      <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => { Audio.play('click'); ctx.go({ kind: 'toc' }); }}>
        {!(ctx.prev && ctx.prev.kind !== 'toc') && <ChevronLeft size={12} style={{ verticalAlign: -2 }} />} Оглавление
      </button>
    </div>
  );
}

const scrollToId = (id, smooth = true) => { const el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }); return !!el; };

/* Оглавление главы по разделам: сколько минут читать каждый и пройден ли он (ответ
   «совпало» на вопрос в конце раздела). Сверху — прогресс главы по разделам. */
function SectionNav({ sections, ctx }) {
  if (!sections || sections.length < 3) return null;
  const study = sections.filter((x) => x.recall);
  const done = study.filter((x) => sectionDone(ctx.progress, x)).length;
  return (
    <nav className="tb-secnav" aria-label="Разделы главы" data-testid="tb-sections">
      <div className="tb-secnav-head">
        <span>В этой главе</span>
        {study.length > 0 && <span data-testid="tb-section-progress">пройдено разделов: {done} из {study.length}</span>}
      </div>
      {study.length > 0 && <div className="tb-bar"><span style={{ width: `${(done / study.length) * 100}%` }} /></div>}
      <ol className="tb-secnav-list">
        {sections.map((x, k) => {
          const ok = x.recall && sectionDone(ctx.progress, x);
          return (
            <li key={x.id}>
              <button type="button" className="tb-secnav-row" onClick={() => scrollToId(x.id)}>
                <span className={`tb-secnav-no${ok ? ' done' : ''}`} aria-hidden="true">{ok ? <Check size={12} /> : k + 1}</span>
                <span>{x.title}</span>
                {x.recall ? <span className="tb-secnav-min">≈{x.minutes} мин</span> : <span />}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ChapterPage({ id, ctx }) {
  const ch = CHAPTER_BY_ID[id];
  const blocks = CHAPTER_BLOCKS[id];
  const idx = CHAPTERS.findIndex((c) => c.id === id);
  const prev = CHAPTERS[idx - 1]; const next = CHAPTERS[idx + 1];
  const read = !!ctx.progress.read[id];
  return (
    <div data-testid="chapter" data-chapter={id}>
      <PageNav ctx={ctx} />
      <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Глава {chapterNo(id)} · {PARTS.find((p) => p.id === ch.part).title}
      </div>
      <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 14px', fontWeight: 700 }}>{ch.title}</h1>
      {blocks ? (
        <div className="tb-ch-grid">
          <aside className="tb-ch-aside"><SectionNav sections={CHAPTER_SECTIONS[id]} ctx={ctx} /></aside>
          <div className="tb-ch-main tb-body"><Blocks blocks={blocks} ctx={{ ...ctx, chapter: id }} top /></div>
        </div>
      ) : (
        <div className="ems-panel" style={{ padding: 14, fontSize: 13.5, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 6 }}><b>Глава в работе.</b> {ch.summary}</div>
          {(ch.cards || []).length > 0 && (
            <div style={{ color: COLOR.muted }}>
              Пока можно прочитать короткую карточку из приложения «Игра ↔ учебник»:{' '}
              {ch.cards.map((c, i) => (
                <React.Fragment key={c}>{i ? ', ' : ''}<button type="button" className="tb-link" onClick={() => ctx.go({ kind: 'appendix', id: 'cards', anchor: c })}>{CARD_BY_ID[c].title}</button></React.Fragment>
              ))}.
            </div>
          )}
        </div>
      )}
      {ch.refs && (
        <div className="tb-box" style={{ borderLeftColor: COLOR.muted }} data-testid="tb-refs">
          <div className="tb-box-head" style={{ color: COLOR.muted }}><BookOpenText size={13} />В настоящем учебнике</div>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {ch.refs.map((r) => <li key={r.book + r.chapter}>{BOOKS[r.book]}: глава {r.chapter}.</li>)}
          </ul>
          <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 8 }}>Номера глав меняются от издания к изданию, поэтому главы названы по заголовку.</div>
        </div>
      )}
      {blocks && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '18px 0' }}>
          <button type="button" className={`ems-btn${read ? '' : ' primary'}`} style={{ padding: '8px 14px', fontSize: 13 }} aria-pressed={read}
            onClick={() => { Audio.play(read ? 'click' : 'stamp'); ctx.setRead(id, !read); }}>
            {read ? <><Check size={13} style={{ verticalAlign: -2 }} /> Глава прочитана</> : 'Отметить главу прочитанной'}
          </button>
        </div>
      )}
      <div className="row-between" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {prev ? <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => ctx.go({ kind: 'chapter', id: prev.id })}>
          <ChevronLeft size={12} style={{ verticalAlign: -2 }} /> {prev.title}</button> : <span />}
        {next ? <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => ctx.go({ kind: 'chapter', id: next.id })}>
          {next.title} <ChevronRight size={12} style={{ verticalAlign: -2 }} /></button>
          : <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => ctx.go({ kind: 'appendix', id: APPENDICES[0].id })}>
            Приложения <ChevronRight size={12} style={{ verticalAlign: -2 }} /></button>}
      </div>
    </div>
  );
}

const APPENDIX_SECTIONS = {};
const sectionsOfAppendix = (id) => {
  if (!APPENDIX_SECTIONS[id]) APPENDIX_SECTIONS[id] = APPENDIX_BLOCKS[id].filter((b) => b.type === 'h2').map((b, k) => ({ id: b.anchor || `sec-${k + 1}`, title: plainTitle(b.inline), recall: null }));
  return APPENDIX_SECTIONS[id];
};

function CardsAppendix({ ctx, anchor }) {
  const chapterFor = (cardId) => CHAPTERS.find((c) => (c.cards || []).includes(cardId));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="appendix-cards">
      {GAME_CARDS.map((t) => {
        const ch = chapterFor(t.id);
        return (
          <div key={t.id} id={`card-${t.id}`} className="ems-panel" style={{ padding: 14, outline: anchor === t.id ? `1px solid ${COLOR.gold}` : 'none' }}>
            <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <span className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft }}>{t.title}</span>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.text, overflowWrap: 'anywhere' }}>{t.formula}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginTop: 8, fontSize: 13, lineHeight: 1.55 }}>
              <div><div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 2 }}>Как устроено в модели</div>{t.model}</div>
              <div><div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 2 }}>Где увидеть в игре</div>{t.where}
                <div style={{ color: COLOR.muted, marginTop: 6, fontSize: 12 }}>Попробуйте: {t.try}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {ctx.onOpenLab && t.lab && (
                    <button type="button" className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => { Audio.play('click'); ctx.onOpenLab({ lever: t.lab }); }}>Открыть в Лаборатории</button>
                  )}
                  {ctx.onStartDrill && DRILLS.filter((d) => d.topic === t.id).map((d) => (
                    <button key={d.id} type="button" className="ems-btn" style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => { Audio.prime(); Audio.play('stamp'); ctx.onStartDrill(drillSetup(d)); }}>Задача: {d.title}</button>
                  ))}
                </div>
                {ch && <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 8 }}>Глава учебника: <button type="button" className="tb-link" onClick={() => ctx.go({ kind: 'chapter', id: ch.id })}>{ch.title}</button>{ch.status === 'ready' ? '' : ' (в работе)'}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LimitsAppendix() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="appendix-limits">
      {LIMITS.map((l) => (
        <div key={l.title} className="ems-panel" style={{ padding: 14 }}>
          <div className="ems-serif" style={{ fontSize: 15, color: COLOR.goldSoft, marginBottom: 4 }}>{l.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>{l.text}</div>
        </div>
      ))}
    </div>
  );
}

function GlossaryAppendix() {
  const [q, setQ] = useState('');
  const norm = q.trim().toLowerCase();
  const list = GLOSSARY_KEYS.map((k) => GLOSSARY[k])
    .filter((g) => !norm || g.title.toLowerCase().includes(norm) || g.text.toLowerCase().includes(norm))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  return (
    <div data-testid="appendix-glossary">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по словарю" aria-label="Поиск по словарю"
        style={{ width: '100%', padding: '9px 11px', fontSize: 13, marginBottom: 12, background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, borderRadius: 3, color: COLOR.text }} />
      {list.map((g) => (
        <div key={g.title} className="ems-panel" style={{ padding: '10px 12px', marginBottom: 7 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLOR.goldSoft, marginBottom: 3 }}>{g.title}</div>
          <div style={{ fontSize: 12.5, color: COLOR.muted, lineHeight: 1.55 }}>{g.text}</div>
        </div>
      ))}
      {!list.length && <div style={{ fontSize: 12, color: COLOR.faint }}>Ничего не нашлось.</div>}
    </div>
  );
}

function AppendixPage({ id, anchor, ctx }) {
  const a = APPENDIX_BY_ID[id];
  const idx = APPENDICES.findIndex((x) => x.id === id);
  return (
    <div data-testid="appendix" data-appendix={id}>
      <PageNav ctx={ctx} />
      <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '.06em', textTransform: 'uppercase' }}>Приложение {String.fromCharCode(1040 + idx)}</div>
      <h1 className="ems-serif" style={{ fontSize: 24, color: COLOR.goldSoft, margin: '4px 0 8px', fontWeight: 700 }}>{a.title}</h1>
      <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 14, lineHeight: 1.55 }}>{a.summary}</div>
      {APPENDIX_BLOCKS[id] && (
        <>
          <SectionNav sections={sectionsOfAppendix(id)} ctx={ctx} />
          <div className="tb-body" data-testid="appendix-text"><Blocks blocks={APPENDIX_BLOCKS[id]} ctx={ctx} top /></div>
        </>
      )}
      {id === 'cards' && <CardsAppendix ctx={ctx} anchor={anchor} />}
      {id === 'limits' && <LimitsAppendix />}
      {id === 'glossary' && <GlossaryAppendix />}
      <div className="row-between" style={{ flexWrap: 'wrap', marginTop: 16 }}>
        {idx > 0 ? <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => ctx.go({ kind: 'appendix', id: APPENDICES[idx - 1].id })}>
          <ChevronLeft size={12} style={{ verticalAlign: -2 }} /> {APPENDICES[idx - 1].title}</button> : <span />}
        {idx < APPENDICES.length - 1 && <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => ctx.go({ kind: 'appendix', id: APPENDICES[idx + 1].id })}>
          {APPENDICES[idx + 1].title} <ChevronRight size={12} style={{ verticalAlign: -2 }} /></button>}
      </div>
    </div>
  );
}

// что это за вопрос в списке повторения: задача главы или вопрос раздела
const itemName = (id) => {
  if (PROBLEMS[id]) return `${CHAPTER_BY_ID[PROBLEMS[id].chapter].title}, задача ${problemsOf(PROBLEMS[id].chapter).indexOf(id) + 1}`;
  if (RECALLS[id]) { const r = RECALLS[id]; const sec = CHAPTER_SECTIONS[r.chapter].find((x) => x.id === r.section); return `${CHAPTER_BY_ID[r.chapter].title}, «${sec ? sec.title : ''}»`; }
  return id;
};
function ReviewPanel({ ctx, due }) {
  const { later } = reviewQueue(ctx.progress);
  const waiting = later.filter((x) => PROBLEMS[x.id] || RECALLS[x.id]);
  return (
    <div className="ems-panel" style={{ padding: 14, marginBottom: 16 }} data-testid="review">
      <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 4 }}>На повторение{due.length ? ` · ${due.length}` : ''}</div>
      <div style={{ fontSize: 12.5, color: COLOR.muted, lineHeight: 1.5, marginBottom: 6 }}>
        Задачи с неверным ответом и вопросы разделов, где ответ не совпал, возвращаются через 2 дня; верно на повторении — следующий раз через 5, потом через 12 дней, и вопрос уходит из списка.
      </div>
      {due.length === 0 && <div style={{ fontSize: 13 }}>Сегодня повторять нечего.</div>}
      {due.map((id) => {
        if (RECALLS[id]) return <RecallCard key={id} b={RECALLS[id].block} ctx={ctx} from={itemName(id)} />;
        const { chapter, block } = PROBLEMS[id];
        return <ProblemCard key={id} block={block} no={problemsOf(chapter).indexOf(id) + 1} from={CHAPTER_BY_ID[chapter].title} ctx={ctx} />;
      })}
      {waiting.length > 0 && (
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 6 }}>
          Ждут своего дня: {waiting.map((x) => `${itemName(x.id)} — ${daysUntil(x.due)}`).join('; ')}.
        </div>
      )}
    </div>
  );
}

/* ПОВТОРЕНИЕ: только то, чему подошёл срок, — задачи глав с неверным ответом и вопросы
   разделов. Новой теории здесь нет (её читают в главах), и список не пополняется на глазах:
   он собирается при входе. */
function ReviewPage({ ctx }) {
  const [due] = useState(() => dueItems(ctx.progress));
  return (
    <div data-testid="review-page">
      <PageNav ctx={ctx} />
      {!ctx.embedded && <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 12px', fontWeight: 700 }}>Повторение</h1>}
      <ReviewPanel ctx={ctx} due={due} />
    </div>
  );
}

/* ИТОГОВАЯ ПРОВЕРКА БЛОКА: задачи из всех глав вперемешку, без подсказок и решений. Ответы
   проверяются только по «Завершить»: счёт по темам, слабые места со ссылками на главы, разбор
   каждой задачи. Неверные ответы уходят в повторение — вернутся через два дня. */
function ExamPage({ id, ctx }) {
  const exam = EXAMS[id];
  // каждая попытка — новые числа: зерно выбирается при входе и при пересдаче
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 2 ** 30));
  const blocks = useMemo(() => examSet(id, seed), [id, seed]);
  const byId = useMemo(() => Object.fromEntries(blocks.map((b) => [b.id, b])), [blocks]);
  const ids = blocks.map((b) => b.id);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState({});
  const setAt = (pid, k, v) => setAnswers((a) => { const cur = (a[pid] || byId[pid].parts.map(() => '')).slice(); cur[k] = v; return { ...a, [pid]: cur }; });
  const retake = () => {
    Audio.play('click'); setSeed((x) => x + 1); setAnswers({}); setResult(null); setOpen({});
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  };
  const finish = () => {
    const r = examResult(blocks, answers);
    // пустой ответ — тоже ошибка: на повторение уходит задача главы того же типа
    r.rows.forEach((row) => ctx.onAnswer(row.source, row.ok, {}));
    Audio.play(r.ok >= r.total / 2 ? 'stamp' : 'tick');
    setResult(r);
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  };
  const filled = ids.filter((pid) => (answers[pid] || []).some((x) => String(x || '').trim())).length;
  return (
    <div data-testid="exam">
      <PageNav ctx={ctx} />
      <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 6px', fontWeight: 700 }}>{exam.title}</h1>
      {!result && (
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 14, lineHeight: 1.55 }}>
          {ids.length} задач из всех глав блока вперемешку — какая модель нужна, решаете вы. Задачи того же типа, что в главах, но с новыми числами: при каждой пересдаче они другие. Подсказок и решений до конца нет. В конце — счёт по темам и слабые места; ошибки отправят на повторение задачи глав того же типа.
        </div>
      )}
      {result && (
        <div className="ems-panel" style={{ padding: 14, marginBottom: 16 }} data-testid="exam-result">
          <div className="ems-serif" style={{ fontSize: 18, color: COLOR.goldSoft, marginBottom: 6 }}>Верно {result.ok} из {result.total}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '3px 12px', fontSize: 13, marginBottom: 8 }}>
            {result.topics.map((t) => (
              <React.Fragment key={t.chapter}>
                <span>{CHAPTER_BY_ID[t.chapter].title}</span>
                <span className="ems-mono" style={{ color: t.ok === t.total ? COLOR.teal : t.ok / t.total < 0.5 ? COLOR.rust : COLOR.text }}>{t.ok}/{t.total}</span>
              </React.Fragment>
            ))}
          </div>
          {result.weak.length > 0 ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }} data-testid="exam-weak">
              Слабое место: {result.weak.map((t, k) => (
                <React.Fragment key={t.chapter}>{k > 0 && ', '}
                  <button type="button" className="tb-link" onClick={() => ctx.go({ kind: 'chapter', id: t.chapter })}>{CHAPTER_BY_ID[t.chapter].title.toLowerCase()}</button>
                </React.Fragment>
              ))}. Перечитайте главу и решите её задачи.
            </div>
          ) : <div style={{ fontSize: 13.5 }} data-testid="exam-weak">Слабых мест нет: в каждой теме верно хотя бы половина.</div>}
          {result.ok < result.total && <div style={{ fontSize: 12.5, color: COLOR.muted, marginTop: 6 }}>Задачи глав того же типа ушли на повторение и вернутся в «На сегодня» через два дня.</div>}
          <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5, marginTop: 8 }} onClick={retake}>Пересдать с новыми числами</button>
        </div>
      )}
      {ids.map((pid, i) => {
        const b = byId[pid];
        const row = result && result.rows.find((r) => r.id === pid);
        const multi = b.parts.length > 1;
        return (
          <div key={pid} className="ems-panel" style={{ padding: 14, margin: '12px 0' }} data-testid="exam-problem" data-problem={pid}>
            <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
              <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>Задача {i + 1}</span>
              {row && <span className="tb-chip" style={{ color: row.ok ? COLOR.teal : COLOR.rust, borderColor: row.ok ? COLOR.teal : COLOR.rust }}>{row.ok ? 'верно' : 'неверно'}</span>}
            </div>
            <div className="tb-body"><Blocks blocks={b.statement} ctx={ctx} /></div>
            <div style={{ display: 'flex', gap: '8px 14px', flexWrap: 'wrap', alignItems: 'center' }}>
              {b.parts.map((pt, k) => (
                <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: COLOR.muted }}>
                  {pt.label && <span className="ems-mono" style={{ color: COLOR.text }}>{pt.label}</span>}
                  <input value={(answers[pid] || [])[k] || ''} onChange={(e) => setAt(pid, k, e.target.value)} inputMode="decimal" disabled={!!result}
                    aria-label={multi ? `Проверка, задача ${i + 1}, шаг ${pt.label}` : `Проверка, ответ к задаче ${i + 1}`}
                    placeholder="ответ числом" style={{ ...inputStyle(), width: multi ? 120 : 150 }} />
                  {pt.unit && <span>{pt.unit}</span>}
                </label>
              ))}
              {!result && <CalcToggle onUse={(v) => { const cur = answers[pid] || []; const k = Math.max(0, b.parts.findIndex((_, j) => !String(cur[j] || '').trim())); setAt(pid, k, v); }} />}
            </div>
            {row && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, color: row.ok ? COLOR.teal : COLOR.rust }}>
                  Ответ: {withUnit(b)} · глава «<button type="button" className="tb-link" onClick={() => ctx.go({ kind: 'chapter', id: b.chapter })}>{CHAPTER_BY_ID[b.chapter].title}</button>»
                </div>
                {!row.ok && matchTraps(b, answers[pid] || []).map((tr, k) => (
                  <p key={k} style={{ fontSize: 13, lineHeight: 1.55, margin: '6px 0 0' }} data-testid="tb-trap"><Inline nodes={tr.text} ctx={ctx} /></p>
                ))}
                <button type="button" className="ems-btn" style={{ padding: '5px 11px', fontSize: 12, marginTop: 6 }} aria-expanded={!!open[pid]}
                  onClick={() => setOpen((o) => ({ ...o, [pid]: !o[pid] }))}>{open[pid] ? 'Скрыть решение' : 'Решение'}</button>
                {open[pid] && <div className="tb-body" style={{ marginTop: 8 }}><Blocks blocks={b.solution} ctx={ctx} /></div>}
              </div>
            )}
          </div>
        );
      })}
      {!result && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ems-btn primary" style={{ padding: '8px 16px', fontSize: 13.5 }} onClick={finish}>Завершить проверку</button>
          <span style={{ fontSize: 12.5, color: COLOR.faint }}>заполнено {filled} из {ids.length}; пустые ответы считаются ошибкой</span>
        </div>
      )}
    </div>
  );
}

/* ЗАДАЧИ ВПЕРЕМЕШКУ: параллельные варианты задач из пройденных глав без названия главы.
   Сначала — какая модель нужна (три варианта), потом сама задача. Ответ засчитывается задаче
   главы того же типа: ошибка отправит на повторение её. Набор выбирается при входе. */
function MixedItem({ item, no, ctx }) {
  const [pick, setPick] = useState(null);
  const b = item.block;
  const src = ctx.progress.problems[item.source];
  const vctx = { ...ctx, progress: { ...ctx.progress, problems: { ...ctx.progress.problems, ...(src ? { [b.id]: src } : {}) } },
    onAnswer: (_id, ok, opts) => ctx.onAnswer(item.source, ok, opts) };
  return (
    <div className="ems-panel" style={{ padding: 14, margin: '12px 0' }} data-testid="mixed-item" data-problem={item.id}>
      {pick == null ? (
        <>
          <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 4 }}>Задача {no} · какая модель нужна?</div>
          {b.news && <div className="tb-news"><div className="ems-mono tb-news-mast">ЭКОНОМИЧЕСКІЙ ВѢСТНИКЪ</div><div className="ems-serif tb-news-head">{b.news}</div></div>}
          <div className="tb-body"><Blocks blocks={b.statement} ctx={ctx} /></div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Прежде чем решать: из какой главы здесь модель?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={`Модель для задачи ${no}`}>
            {item.options.map((c) => (
              <button key={c} type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }}
                onClick={() => { Audio.play(c === item.chapter ? 'stamp' : 'tick'); setPick(c); }}>{CHAPTER_BY_ID[c].title}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div data-testid="mixed-model" style={{ fontSize: 13, marginBottom: 4, color: pick === item.chapter ? COLOR.teal : COLOR.rust }}>
            {pick === item.chapter ? `Верно: это модель из главы «${CHAPTER_BY_ID[item.chapter].title}».` : `Нет: здесь нужна глава «${CHAPTER_BY_ID[item.chapter].title}», а не «${CHAPTER_BY_ID[pick].title}». Теперь решите.`}
          </div>
          <ProblemCard block={b} no={no} ctx={vctx} />
        </>
      )}
    </div>
  );
}
function MixedPage({ ctx }) {
  const [set] = useState(() => mixedSet(ctx.progress, 5));
  const [round, setRound] = useState(0);
  const [items, setItems] = useState(set);
  const chapters = mixedChapters(ctx.progress);
  return (
    <div data-testid="mixed">
      <PageNav ctx={ctx} />
      <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 6px', fontWeight: 700 }}>Задачи вперемешку</h1>
      <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 14, lineHeight: 1.55 }}>
        Задачи из глав, которые вы начали{chapters.length ? ` (${chapters.length})` : ''}, без названия главы — как на экзамене и в жизни. Сначала решите, какая модель нужна, потом решайте.
      </div>
      {items.length === 0 && <div className="ems-panel" style={{ padding: 14, fontSize: 13.5 }}>Пока не из чего выбирать: пройдите хотя бы один раздел или отметьте главу прочитанной.</div>}
      {items.map((it, k) => <MixedItem key={`${round}-${it.id}`} item={it} no={k + 1} ctx={ctx} />)}
      {items.length > 0 && (
        <button type="button" className="ems-btn" style={{ padding: '7px 14px', fontSize: 13 }}
          onClick={() => { Audio.play('click'); setItems(mixedSet(ctx.progress, 5)); setRound((r) => r + 1); if (window.scrollTo) window.scrollTo(0, 0); }}>Ещё пять задач</button>
      )}
    </div>
  );
}

/* МОЙ ПРОГРЕСС: разделы, точность уверенных и неуверенных ответов, три слабые темы со
   ссылками и журнал занятий — дни и минуты за четыре недели, без серий и штрафов. */
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
function Journal({ days }) {
  const weeks = journalWeeks(days);
  const sum = journalSummary(days);
  const shade = (m) => (m <= 0 ? 'transparent' : m < 10 ? 'rgba(80,160,150,.35)' : m < 30 ? 'rgba(80,160,150,.65)' : COLOR.teal);
  return (
    <div data-testid="tb-journal">
      <div style={{ fontSize: 13, marginBottom: 8 }}>За четыре недели: занимались <b>{sum.days}</b> {plural(sum.days, 'день', 'дня', 'дней')}, всего <b>{sum.minutes}</b> мин.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 36px))', gap: 4 }}>
        {WEEKDAYS.map((d) => <span key={d} style={{ fontSize: 10.5, color: COLOR.faint, textAlign: 'center' }}>{d}</span>)}
        {weeks.flat().map((c) => (
          <span key={c.key} title={`${c.key}: ${c.minutes} мин`} data-minutes={c.minutes}
            style={{ height: 26, border: `1px solid ${c.future ? 'transparent' : COLOR.hairline}`, background: shade(c.minutes), fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.minutes >= 30 ? COLOR.bg : COLOR.muted }}>
            {c.minutes > 0 ? c.minutes : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
function StatsPage({ ctx }) {
  const ready = CHAPTERS.filter((c) => c.status === 'ready');
  const secs = ready.reduce((acc, c) => { const sp = sectionProgress(ctx.progress, c.id); return { done: acc.done + sp.done, total: acc.total + sp.total }; }, { done: 0, total: 0 });
  const conf = confidenceStats(ctx.progress, Object.keys(PROBLEMS));
  const weak = weakTopics(ctx.progress);
  const pct = (x) => (x.n ? `${Math.round((x.ok / x.n) * 100)}%` : '—');
  return (
    <div data-testid="stats">
      <PageNav ctx={ctx} />
      <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 12px', fontWeight: 700 }}>Мой прогресс</h1>
      <div className="ems-panel" style={{ padding: 14, marginBottom: 14, fontSize: 13.5, lineHeight: 1.65 }}>
        <div>Разделов пройдено: <b>{secs.done}</b> из {secs.total}</div>
        <div data-testid="stats-confidence">
          Уверенные ответы: {conf.sure.n ? <>верно <b>{conf.sure.ok}</b> из {conf.sure.n} ({pct(conf.sure)})</> : 'пока нет'}
          {' · '}неуверенные: {conf.unsure.n ? <>верно <b>{conf.unsure.ok}</b> из {conf.unsure.n} ({pct(conf.unsure)})</> : 'пока нет'}
        </div>
        {conf.sure.n >= 5 && conf.sure.ok / conf.sure.n < 0.7 && <div style={{ color: COLOR.muted, fontSize: 12.5 }}>Уверенные ответы верны реже чем в 70% случаев — стоит чаще открывать решения и перечитывать разделы.</div>}
      </div>
      <div className="ems-panel" style={{ padding: 14, marginBottom: 14 }} data-testid="stats-weak">
        <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 6 }}>Слабые темы</div>
        {weak.length === 0 && <div style={{ fontSize: 13 }}>Пока не видно: нужно хотя бы по два ответа в главе, и среди них ошибки.</div>}
        {weak.map((t) => (
          <div key={t.chapter} style={{ fontSize: 13.5, marginBottom: 4 }}>
            <button type="button" className="tb-link" onClick={() => ctx.go({ kind: 'chapter', id: t.chapter })}>{CHAPTER_BY_ID[t.chapter].title}</button>
            <span style={{ color: COLOR.muted }}> — неверно {t.wrong} из {t.tried}</span>
          </div>
        ))}
      </div>
      <div className="ems-panel" style={{ padding: 14 }}>
        <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 6 }}>Журнал занятий</div>
        <Journal days={ctx.progress.days} />
      </div>
    </div>
  );
}

// «Проверить себя» в оглавлении
function CheckPanel({ ctx }) {
  const rows = [
    { page: { kind: 'exam', id: 'micro' }, title: EXAMS.micro.title, text: `${examTemplates('micro').length} задач из всех глав микро вперемешку, с новыми числами при каждой попытке, без подсказок; в конце — счёт по темам и слабые места.` },
    { page: { kind: 'mixed' }, title: 'Задачи вперемешку', text: 'Задачи из начатых глав без названия главы: сначала понять, какая модель нужна.' },
    { page: { kind: 'stats' }, title: 'Мой прогресс', text: 'Разделы, точность уверенных ответов, слабые темы и журнал занятий.' },
  ];
  return (
    <div className="ems-panel" style={{ padding: '12px 0 4px', marginBottom: 14 }} data-testid="tb-check">
      <div className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft, padding: '0 12px 8px' }}>Проверить себя</div>
      {rows.map((r) => (
        <button key={r.title} type="button" className="tb-toc-row" onClick={() => { Audio.play('click'); ctx.go(r.page); }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14 }}>{r.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: COLOR.faint, lineHeight: 1.45 }}>{r.text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* Оглавление внутри обучения: «продолжить чтение», две цифры прогресса и главы по частям —
   номер (или галочка, если глава прочитана), название, полоска пройденных разделов. Описания
   глав, уверенность ответов и «проверить себя» здесь лишние: проверки — во вкладке «Задания»,
   прогресс — по ссылке внизу. */
function LearnToc({ ctx }) {
  const ready = CHAPTERS.filter((c) => c.status === 'ready');
  const readCount = ready.filter((c) => ctx.progress.read[c.id]).length;
  const allProblems = Object.keys(PROBLEMS);
  const solved = allProblems.filter((id) => ctx.progress.problems[id] && ctx.progress.problems[id].ok).length;
  const due = dueItems(ctx.progress).length;
  const last = ctx.progress.last && ctx.progress.last.kind === 'chapter' && CHAPTER_BY_ID[ctx.progress.last.id] ? CHAPTER_BY_ID[ctx.progress.last.id] : null;
  let n = 0;
  return (
    <div data-testid="textbook" className="tbl">
      {last && (
        <button type="button" className="tbl-continue" data-testid="tb-continue" aria-label={`Продолжить чтение главы ${chapterNo(last.id)}`} onClick={() => { Audio.play('click'); ctx.go({ kind: 'chapter', id: last.id }); }}>
          <BookOpen size={26} aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0 }}><small>Продолжить чтение</small><b>{last.title}</b></span>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      )}
      <div className="tbl-stats" data-testid="tb-stats">
        <span>Глав прочитано: <b>{readCount}</b> из {ready.length}</span>
        <span>Задач решено: <b>{solved}</b> из {allProblems.length}</span>
        {due > 0 && <button type="button" className="tb-link" data-testid="tb-review-link" onClick={() => { Audio.play('click'); ctx.go({ kind: 'review' }); }}>На повторение: {due}</button>}
      </div>
      <div className="tbl-parts">
        {PARTS.map((p) => (
          <section key={p.id} className="tbl-part">
            <h2 className="tbl-part-title">{p.title}</h2>
            {p.chapters.map((c) => {
              n += 1;
              const readMark = !!ctx.progress.read[c.id];
              const sp = sectionProgress(ctx.progress, c.id);
              return (
                <button key={c.id} type="button" className="tbl-ch tb-toc-row" data-status={c.status} onClick={() => { Audio.play('click'); ctx.go({ kind: 'chapter', id: c.id }); }}>
                  <span className={`tbl-no${readMark ? ' done' : ''}`} aria-label={readMark ? 'прочитана' : undefined}>{readMark ? <Check size={14} aria-hidden="true" /> : n}</span>
                  <span className="tbl-ch-title">{c.title}{c.status !== 'ready' && <small> · скоро</small>}</span>
                  {sp.total > 0 ? <span className="tbl-ch-bar" title={`разделы ${sp.done}/${sp.total}`} aria-label={`разделы ${sp.done}/${sp.total}`}><i style={{ width: `${(sp.done / sp.total) * 100}%` }} /></span> : <span />}
                </button>
              );
            })}
          </section>
        ))}
        <section className="tbl-part">
          <h2 className="tbl-part-title">Приложения</h2>
          {APPENDICES.map((a, i) => (
            <button key={a.id} type="button" className="tbl-ch tb-toc-row" onClick={() => { Audio.play('click'); ctx.go({ kind: 'appendix', id: a.id }); }}>
              <span className="tbl-no">{String.fromCharCode(1040 + i)}</span>
              <span className="tbl-ch-title">{a.title}</span>
              <span />
            </button>
          ))}
        </section>
      </div>
      <div className="tbl-more">
        <button type="button" className="ems-btn" data-testid="tb-stats-link" onClick={() => { Audio.play('click'); ctx.go({ kind: 'stats' }); }}>Мой прогресс в учебнике</button>
      </div>
    </div>
  );
}

function TocPage({ ctx }) {
  if (ctx.embedded) return <LearnToc ctx={ctx} />;
  const ready = CHAPTERS.filter((c) => c.status === 'ready');
  const readCount = ready.filter((c) => ctx.progress.read[c.id]).length;
  const allProblems = Object.keys(PROBLEMS);
  const solved = allProblems.filter((id) => ctx.progress.problems[id] && ctx.progress.problems[id].ok).length;
  const secs = ready.reduce((acc, c) => { const sp = sectionProgress(ctx.progress, c.id); return { done: acc.done + sp.done, total: acc.total + sp.total }; }, { done: 0, total: 0 });
  const conf = confidenceStats(ctx.progress, allProblems);
  const pct = (x) => `${Math.round((x.ok / x.n) * 100)}%`;
  const last = ctx.progress.last && ctx.progress.last.kind === 'chapter' && CHAPTER_BY_ID[ctx.progress.last.id] ? CHAPTER_BY_ID[ctx.progress.last.id] : null;
  let n = 0;
  return (
    <div data-testid="textbook">
      <div className="ems-panel" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ flex: 1, minWidth: 220, lineHeight: 1.6 }}>
          Разделов пройдено: <b>{secs.done}</b> из {secs.total} · прочитано глав: <b>{readCount}</b> из {ready.length} готовых · задач решено: <b>{solved}</b> из {allProblems.length}
          <span style={{ display: 'block', color: COLOR.muted }} data-testid="tb-confidence">
            {conf.sure.n ? <>Уверенные ответы: верно <b style={{ color: COLOR.text }}>{conf.sure.ok}</b> из {conf.sure.n} ({pct(conf.sure)})</> : 'Уверенных ответов пока нет'}
            {conf.unsure.n ? <> · неуверенные: верно {conf.unsure.ok} из {conf.unsure.n} ({pct(conf.unsure)})</> : ''}
          </span>
        </span>
        {last && <button type="button" className="ems-btn primary" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); ctx.go({ kind: 'chapter', id: last.id }); }}>Продолжить: {last.title}</button>}
      </div>
      <CheckPanel ctx={ctx} />
      {PARTS.map((p) => (
        <div key={p.id} className="ems-panel" style={{ padding: '12px 0 4px', marginBottom: 14 }}>
          <div className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft, padding: '0 12px 8px' }}>{p.title}</div>
          {p.chapters.map((c) => {
            n += 1;
            const probs = problemsOf(c.id);
            const sc = chapterScore(ctx.progress, probs);
            const readMark = !!ctx.progress.read[c.id];
            const sp = sectionProgress(ctx.progress, c.id);
            return (
              <button key={c.id} type="button" className="tb-toc-row" data-status={c.status} onClick={() => { Audio.play('click'); ctx.go({ kind: 'chapter', id: c.id }); }}>
                <span className="ems-mono" style={{ color: COLOR.faint, minWidth: 22 }}>{n}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: c.status === 'ready' ? COLOR.text : COLOR.muted }}>{c.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: COLOR.faint, lineHeight: 1.45 }}>{c.summary}</span>
                </span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {c.status !== 'ready' && <span className="tb-chip">в работе</span>}
                  {readMark && <span className="tb-chip" style={{ color: COLOR.teal, borderColor: COLOR.teal }}><Check size={10} style={{ verticalAlign: -1 }} /> прочитана</span>}
                  {sp.total > 0 && <span className="tb-chip" style={sp.done === sp.total ? { color: COLOR.teal, borderColor: COLOR.teal } : undefined}>разделы {sp.done}/{sp.total}</span>}
                  {probs.length > 0 && <span className="tb-chip">задачи {sc.solved}/{sc.total}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="ems-panel" style={{ padding: '12px 0 4px' }}>
        <div className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft, padding: '0 12px 8px' }}>Приложения</div>
        {APPENDICES.map((a, i) => (
          <button key={a.id} type="button" className="tb-toc-row" onClick={() => { Audio.play('click'); ctx.go({ kind: 'appendix', id: a.id }); }}>
            <span className="ems-mono" style={{ color: COLOR.faint, minWidth: 22 }}>{String.fromCharCode(1040 + i)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>{a.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: COLOR.faint, lineHeight: 1.45 }}>{a.summary}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ ЭКРАН ------------------------------
   resume — вернуться туда, где читали (после Лаборатории или тайкуна), иначе оглавление;
   startPage — открыть сразу нужную страницу (из меню — «на сегодня», из игры — раздел главы).
   onOpenLab({ lever, cb, mode, scenario }), onStartDrill(setup), onOpenTycoon(taskId),
   onOpenScenario(id) — выходы в игру. */
/* Где остановились в каждой странице: прокрутка запоминается и восстанавливается при
   возврате (и после Лаборатории, задачи или тайкуна). Размер текста — удобство этого
   устройства. Оба — в localStorage, отдельно от прогресса: пишутся часто. */
const SCROLL_KEY = 'ems-textbook-scroll';
const SCALE_KEY = 'ems-textbook-scale';
const SCALES = [0.9, 1, 1.15, 1.3, 1.5];
const pageKey = (pg) => (pg.kind === 'toc' ? 'toc' : `${pg.kind}:${pg.id}`);
const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
const saveScroll = (key) => { const m = readJSON(SCROLL_KEY, {}); m[key] = Math.round(window.scrollY); writeJSON(SCROLL_KEY, m); };

function ReaderBar({ scale, setScale }) {
  const i = SCALES.indexOf(scale);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }} data-testid="tb-reader-bar">
      <span style={{ fontSize: 12, color: COLOR.faint }}>Текст</span>
      <button type="button" className="ems-btn" style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Мельче текст" disabled={i <= 0}
        onClick={() => setScale(SCALES[Math.max(0, i - 1)])}>A−</button>
      <span className="ems-mono" style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
      <button type="button" className="ems-btn" style={{ padding: '4px 10px', fontSize: 15 }} aria-label="Крупнее текст" disabled={i >= SCALES.length - 1}
        onClick={() => setScale(SCALES[Math.min(SCALES.length - 1, i + 1)])}>A+</button>
      <AudioControls />
    </div>
  );
}

export function TextbookScreen({ onBack, onExit = null, resume = false, startPage = null, backLabel, onOpenLab, onStartDrill, onOpenTycoon, onOpenScenario, reportSlot = null, reportFlag = null, asTab = false }) {
  const [progress, setProgress] = useState(loadProgress);
  const [page, setPage] = useState(() => startPage || (resume && progress.last ? progress.last : { kind: 'toc' }));
  const [stack, setStack] = useState([]);
  const [scale, setScaleRaw] = useState(() => { const v = readJSON(SCALE_KEY, 1); return SCALES.includes(v) ? v : 1; });
  const setScale = (v) => { setScaleRaw(v); writeJSON(SCALE_KEY, v); };
  /* Прогресс уходит в профиль, как курсы обучения: при входе в учебник подтягиваем сделанное
     на другом устройстве, после изменений отправляем своё (не чаще раза в пару секунд) и
     ещё раз — при выходе. */
  const playerId = useMemo(getPlayerId, []);
  const syncTimer = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    syncProfile(playerId).then((profile) => { if (alive && profile) setProgress(loadProgress()); });
    return () => {
      alive = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncProfile(playerId);
    };
  }, [playerId]);
  const update = (fn) => {
    setProgress((p) => { const next = fn(p); return next === p ? p : saveProgress(next); });
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => { syncTimer.current = null; syncProfile(playerId); }, 2000);
  };
  /* Журнал занятий: раз в минуту, если экран на виду и за последние две минуты человек
     что-то делал (прокрутка, нажатие, ввод), — ещё минута в сегодняшний день. */
  React.useEffect(() => {
    let lastAct = Date.now();
    const act = () => { lastAct = Date.now(); };
    const evs = ['scroll', 'pointerdown', 'keydown'];
    evs.forEach((e) => window.addEventListener(e, act, { passive: true }));
    const t = setInterval(() => {
      const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (visible && Date.now() - lastAct < 120000) update((p) => addStudyMinute(p));
    }, 60000);
    return () => { evs.forEach((e) => window.removeEventListener(e, act)); clearInterval(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // прокрутка текущей страницы — запоминается на ходу (не чаще раза в 300 мс)
  const pageRef = React.useRef(page);
  pageRef.current = page;
  React.useEffect(() => {
    let t = null;
    const onScroll = () => {
      if (t) return;
      // ключ страницы — тот, где прокрутили, а не тот, что откроется к моменту записи
      const key = pageKey(pageRef.current);
      t = setTimeout(() => { t = null; if (key !== pageKey(pageRef.current)) return; saveScroll(key); }, 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (t) clearTimeout(t); };
  }, []);
  // ссылка на раздел или карточку — прокрутить к ней, когда она отрисуется
  React.useEffect(() => {
    if (!page.anchor || typeof document === 'undefined') return undefined;
    let n = 0; let raf = 0;
    const tick = () => { n += 1; if (!scrollToId(page.anchor, false) && !scrollToId(`card-${page.anchor}`, false) && n < 30) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [page]);
  // открыли страницу — вернуть туда, где остановились (у якоря своё место)
  React.useEffect(() => {
    if (page.anchor || typeof window === 'undefined' || !window.scrollTo) return undefined;
    const y = readJSON(SCROLL_KEY, {})[pageKey(page)] || 0;
    let n = 0; let raf = 0;
    // графики и формулы дорисовываются не сразу — несколько кадров догоняем нужную высоту
    const tick = () => { window.scrollTo(0, y); n += 1; if (n < 20 && Math.abs(window.scrollY - y) > 2) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [page]);
  const go = (next, { push = true } = {}) => {
    // уходя, запомнить, где остановились на этой странице
    if (typeof window !== 'undefined') saveScroll(pageKey(page));
    if (push && pageKey(next) !== pageKey(page)) setStack((st) => [...st, page].slice(-30));
    if (pageKey(next) !== pageKey(page)) Audio.play('paper');
    setPage(next);
    // «продолжить» — глава или приложение; оглавление и «на сегодня» место чтения не меняют
    update((p) => setLast(p, next.kind === 'chapter' || next.kind === 'appendix' ? { kind: next.kind, id: next.id } : p.last));
  };
  const back = () => {
    const prev = stack[stack.length - 1];
    if (!prev) { go({ kind: 'toc' }, { push: false }); return; }
    setStack((st) => st.slice(0, -1));
    go(prev, { push: false });
  };
  // в обучении (вкладка «Учебник» или справочник поверх урока) — дизайн-система и один «назад»
  const embedded = !!onExit || asTab;
  const ctx = {
    progress, go, back, embedded, prev: stack[stack.length - 1] || null, onOpenLab, onStartDrill, onOpenTycoon, onOpenScenario,
    onAnswer: (id, ok, opts) => update((p) => recordAnswer(p, id, ok, Date.now(), opts)),
    setRead: (id, on) => update((p) => (on ? markRead(p, id) : unmarkRead(p, id))),
    reportFlag,
  };
  // «На сегодня» больше нет: старые ссылки на него ведут в повторение
  const pg = page.kind === 'today' ? { kind: 'review' } : page;
  const valid = pg.kind === 'chapter' ? !!CHAPTER_BY_ID[pg.id] : pg.kind === 'appendix' ? !!APPENDIX_BY_ID[pg.id] : pg.kind === 'exam' ? !!EXAMS[pg.id]
    : ['toc', 'review', 'mixed', 'stats'].includes(pg.kind);
  const cur = valid ? pg : { kind: 'toc' };
  const pages = (
    <>
      <style>{TEXTBOOK_CSS}</style>
      {!(embedded && cur.kind === 'toc') && <ReaderBar scale={scale} setScale={setScale} />}
      <div style={{ zoom: scale }} data-testid="tb-content">
        {cur.kind === 'toc' && <TocPage ctx={ctx} />}
        {cur.kind === 'review' && <ReviewPage ctx={ctx} />}
        {cur.kind === 'exam' && <ExamPage key={cur.id} id={cur.id} ctx={ctx} />}
        {cur.kind === 'mixed' && <MixedPage ctx={ctx} />}
        {cur.kind === 'stats' && <StatsPage ctx={ctx} />}
        {cur.kind === 'chapter' && <ChapterPage key={cur.id} id={cur.id} ctx={ctx} />}
        {cur.kind === 'appendix' && <AppendixPage key={cur.id} id={cur.id} anchor={cur.anchor} ctx={ctx} />}
      </div>
    </>
  );
  /* В обучении учебник — справочник в дизайн-системе обучения: верхняя панель с одним
     «назад» (на прошлую страницу, с первой — туда, откуда открыли) и название страницы. */
  if (embedded) {
    /* вкладка: «назад» есть только вне оглавления — на прошлую страницу или в оглавление;
       справочник поверх урока: на прошлую страницу, с первой — обратно в урок */
    const canBack = asTab ? cur.kind !== 'toc' : true;
    const onBackTap = () => { Audio.play('paper'); if (stack.length || asTab) back(); else onExit(); };
    return (
      <div className="ln-textbook wide" style={{ maxWidth: 760, margin: '0 auto', padding: '6px 16px 40px' }}>
        <TopBar back={canBack ? <IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={onBackTap} /> : null}
          title={<><span className="ds-eyebrow" style={{ display: 'block' }}>Учебник</span>{cur.kind === 'toc' ? 'Оглавление' : pageTitle(cur)}</>}
          right={reportSlot ? reportSlot(cur) : null} />
        {pages}
      </div>
    );
  }
  return (
    <TrainerPage eyebrow="Учебник" title={cur.kind === 'toc' ? 'Учебник экономики' : 'Учебник'} icon={BookOpenText}
      onBack={onBack} backLabel={backLabel}
      lede={cur.kind === 'toc' ? 'Первый год экономического факультета: микро, потом макро. В каждой главе — теория с формулами и графиком, разбор на числах, задачи с решениями и «проверьте в игре»: где эту модель видно в Лаборатории, задачах на 10 минут или в «Своём деле». Учебная модель и то, как это устроено в игре, всегда разведены: в игре коэффициенты подобраны вручную, в учебнике — стандартные модели.' : null}>
      {pages}
    </TrainerPage>
  );
}
