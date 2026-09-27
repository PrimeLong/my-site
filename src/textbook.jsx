/* УЧЕБНИК: оглавление, главы, приложения и повторение задач. Отдельный ленивый чанк
   вместе с KaTeX и текстами глав — в меню и в партии этот код не нужен.
   Тексты — src/textbook/chapters/*.md (разметка — src/textbook/markdown.js), порядок и
   ссылки на настоящие учебники — src/textbook/toc.js, прогресс — src/textbook/progress.js. */
import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BookOpenText, BookOpen, Calculator, Gamepad2, Play, Check, RotateCcw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { COLOR, Audio } from './MacroSimulator.jsx';
import { TrainerPage } from './trainer.jsx';
import { LEVERS, SCENARIOS } from './lib/engine.js';
import { LAB_LEVERS } from './lib/lab.js';
import { DRILLS, drillSetup } from './lib/drills.js';
import { GLOSSARY, GLOSSARY_KEYS } from './textbook/glossary.js';
import { GAME_CARDS, LIMITS } from './textbook/appendix.js';
import { PARTS, CHAPTERS, CHAPTER_BY_ID, APPENDICES, BOOKS, chapterNo } from './textbook/toc.js';
import { TYCOON_TASKS } from './textbook/tycoon-tasks.js';
import { CHAPTER_BLOCKS, PROBLEMS, problemsOf } from './textbook/content.js';
import { CHARTS, chartDefaults, checkGraph } from './textbook/charts.js';
import { actionOf, parseInline, checkAnswer } from './textbook/markdown.js';
import { loadProgress, saveProgress, markRead, unmarkRead, recordAnswer, reviewQueue, chapterScore, setLast, daysUntil } from './textbook/progress.js';

const LEVER_BY_ID = Object.fromEntries(LEVERS.map((l) => [l.id, l]));
const DRILL_BY_ID = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
const CARD_BY_ID = Object.fromEntries(GAME_CARDS.map((c) => [c.id, c]));
const APPENDIX_BY_ID = Object.fromEntries(APPENDICES.map((a) => [a.id, a]));
const fmtNum = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',').replace('-', '−');

const CSS = `
  .tb-body { font-size: 14.5px; line-height: 1.68; color: var(--c-text); }
  .tb-body p { margin: 0 0 12px; }
  .tb-body h2 { font-family: 'PT Serif', Georgia, serif; font-size: 20px; font-weight: 700; color: var(--c-gold-soft); margin: 28px 0 10px; }
  .tb-body h3 { font-size: 15px; font-weight: 700; margin: 18px 0 8px; }
  .tb-body ul, .tb-body ol { margin: 0 0 12px; padding-left: 22px; }
  .tb-body li { margin-bottom: 4px; }
  .tb-math { overflow-x: auto; overflow-y: hidden; max-width: 100%; margin: 10px 0 14px; padding: 2px 0; }
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
`;

/* ------------------------------ ФОРМУЛЫ ------------------------------ */
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
    case 'chapter': return () => ctx.go({ kind: 'chapter', id: n.target });
    case 'card': return () => ctx.go({ kind: 'appendix', id: 'cards', anchor: n.target });
    case 'appendix': return () => ctx.go({ kind: 'appendix', id: n.target });
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

function Inline({ nodes, ctx }) {
  return nodes.map((n, i) => {
    if (n.t === 'text') return <React.Fragment key={i}>{n.v}</React.Fragment>;
    if (n.t === 'math') return <Tex key={i} tex={n.v} />;
    if (n.t === 'b') return <b key={i}><Inline nodes={n.c} ctx={ctx} /></b>;
    if (n.t === 'i') return <i key={i}><Inline nodes={n.c} ctx={ctx} /></i>;
    if (n.t === 'link') return <Link key={i} n={n} ctx={ctx} />;
    return null;
  });
}

/* ------------------------------ БЛОКИ ------------------------------ */
const BOX = {
  model: { label: 'Учебная модель', icon: BookOpen, color: () => COLOR.blue },
  game: { label: 'Как это устроено в игре', icon: Gamepad2, color: () => COLOR.teal },
  example: { label: 'Разбор на числах', icon: Calculator, color: () => COLOR.gold },
  try: { label: 'Проверьте в игре', icon: Play, color: () => COLOR.rust },
  note: { label: 'Заметка', icon: Info, color: () => COLOR.muted },
};

function Blocks({ blocks, ctx }) {
  let problemNo = 0;
  return blocks.map((b, i) => {
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
      case 'h2': return <h2 key={i}><Inline nodes={b.inline} ctx={ctx} /></h2>;
      case 'h3': return <h3 key={i}><Inline nodes={b.inline} ctx={ctx} /></h3>;
      case 'p': return <p key={i}><Inline nodes={b.inline} ctx={ctx} /></p>;
      case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}><Inline nodes={it} ctx={ctx} /></li>)}</ul>;
      case 'ol': return <ol key={i}>{b.items.map((it, j) => <li key={j}><Inline nodes={it} ctx={ctx} /></li>)}</ol>;
      case 'math': return <Tex key={i} tex={b.tex} display />;
      case 'table': return (
        <div key={i} className="tb-table">
          <table>
            <thead><tr>{b.head.map((c, j) => <th key={j}><Inline nodes={c} ctx={ctx} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Inline nodes={c} ctx={ctx} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      case 'box': {
        const k = BOX[b.kind] || BOX.note; const Icon = k.icon; const color = k.color();
        return (
          <div key={i} className="tb-box" style={{ borderLeftColor: color }} data-testid={`tb-box-${b.kind}`}>
            <div className="tb-box-head" style={{ color }}><Icon size={13} />{b.title || k.label}</div>
            <Blocks blocks={b.children} ctx={ctx} />
          </div>
        );
      }
      case 'chart': return <ChartBox key={i} type={b.chart} attrs={b.attrs} caption={b.caption} ctx={ctx} />;
      case 'problem': problemNo += 1; return <ProblemCard key={b.id} block={b} no={problemNo} ctx={ctx} />;
      default: return null;
    }
  });
}

/* ------------------------------ ГРАФИК ------------------------------ */
const W = 560; const H = 330; const M = { l: 44, r: 18, t: 16, b: 34 };
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo; const raw = span / n; const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((x) => x >= raw) || 10 * pow;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const CURVE_COLOR = { blue: () => COLOR.blue, rust: () => COLOR.rust, teal: () => COLOR.teal, gold: () => COLOR.gold };

function ChartSvg({ scene }) {
  const [x0, x1] = scene.xDomain; const [y0, y1] = scene.yDomain;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - ((y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const clipId = useMemo(() => `tbclip${Math.random().toString(36).slice(2, 8)}`, []);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const inside = (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  const labelAt = (pts, pos) => {
    if (pos === 'start') return { x: sx(pts[0].x) + 6, y: sy(pts[0].y) - 6 };
    if (pos === 'mid') {
      const m = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
      return { x: sx(m.x) + 8, y: sy(m.y) - 8 };
    }
    const vis = pts.filter(inside);
    const p = vis[vis.length - 1] || pts[pts.length - 1];
    return { x: Math.min(W - M.r - 4, sx(p.x) + 4), y: Math.max(M.t + 10, sy(p.y) - 4) };
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="График" style={{ display: 'block', maxWidth: W, margin: '0 auto', fontFamily: 'inherit' }}>
      <defs><clipPath id={clipId}><rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} /></clipPath></defs>
      {niceTicks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} stroke={COLOR.border} strokeOpacity={0.45} />
          <text x={sx(t)} y={H - M.b + 14} fontSize={10.5} fill={COLOR.faint} textAnchor="middle">{fmtNum(t)}</text>
        </g>
      ))}
      {niceTicks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={COLOR.border} strokeOpacity={0.45} />
          <text x={M.l - 6} y={sy(t) + 3.5} fontSize={10.5} fill={COLOR.faint} textAnchor="end">{fmtNum(t)}</text>
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
              <text x={(sx(r.x0) + sx(r.x1)) / 2} y={(sy(r.y0) + sy(r.y1)) / 2 + 4} fontSize={11.5} fill={r.tone === 'rust' ? COLOR.rust : COLOR.goldSoft} textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
        {(scene.polys || []).map((g, i) => {
          const cx = g.points.reduce((a, pt) => a + sx(pt.x), 0) / g.points.length;
          const cy = g.points.reduce((a, pt) => a + sy(pt.y), 0) / g.points.length;
          return (
            <g key={`poly${i}`}>
              <polygon points={g.points.map((pt) => `${sx(pt.x).toFixed(1)},${sy(pt.y).toFixed(1)}`).join(' ')} fill={COLOR.rust} fillOpacity={0.22} stroke={COLOR.rust} strokeOpacity={0.5} />
              <text x={cx} y={cy + 4} fontSize={10.5} fill={COLOR.rust} textAnchor="middle">{g.label}</text>
            </g>
          );
        })}
        {scene.curves.map((c) => (
          <path key={c.id} d={path(c.points)} fill="none" stroke={(CURVE_COLOR[c.color] || CURVE_COLOR.gold)()}
            strokeWidth={c.ghost ? 1.5 : 2.4} strokeOpacity={c.ghost ? 0.35 : 1} strokeDasharray={c.ghost || c.dashed ? '5 4' : undefined} />
        ))}
        {(scene.segments || []).map((s, i) => (
          <g key={`s${i}`}>
            <line x1={sx(s.x0)} x2={sx(s.x1)} y1={sy(s.y)} y2={sy(s.y)} stroke={COLOR.gold} strokeWidth={5} strokeOpacity={0.8} />
            <text x={(sx(s.x0) + sx(s.x1)) / 2} y={sy(s.y) + 16} fontSize={11.5} fill={COLOR.goldSoft} textAnchor="middle">{s.label}</text>
          </g>
        ))}
        {scene.points.filter((p) => p.guide && inside(p)).map((p, i) => (
          <g key={`g${i}`} stroke={COLOR.muted} strokeDasharray="3 3" strokeOpacity={0.8}>
            <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={H - M.b} />
            <line x1={M.l} x2={sx(p.x)} y1={sy(p.y)} y2={sy(p.y)} />
          </g>
        ))}
      </g>
      {scene.curves.filter((c) => c.label && !c.ghost).map((c) => {
        const at = labelAt(c.points, c.labelPos);
        return <text key={`l${c.id}`} x={at.x} y={at.y} fontSize={12} fontWeight={600} fill={(CURVE_COLOR[c.color] || CURVE_COLOR.gold)()} textAnchor={at.x > W - 80 ? 'end' : 'start'}>{c.label}</text>;
      })}
      {scene.points.filter(inside).map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.small ? 3 : 5} fill={p.small ? COLOR.muted : COLOR.goldSoft} stroke={COLOR.bg} strokeWidth={1.5} />
          <text x={sx(p.x) + 8} y={sy(p.y) - 8} fontSize={p.small ? 10.5 : 12} fill={p.small ? COLOR.faint : COLOR.goldSoft} fontWeight={p.small ? 400 : 700}>{p.label}</text>
        </g>
      ))}
    </svg>
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
      {caption && <div style={{ fontSize: 12.5, color: COLOR.muted, marginTop: 8, lineHeight: 1.55 }}><Inline nodes={caption} ctx={ctx} /></div>}
    </div>
  );
}

/* ------------------------------ ЗАДАЧИ ------------------------------
   Три вида: ответ числом, «верно или неверно, объясните» и графическая (сдвиньте кривую —
   проверяется, куда пошли величины графика). Рамка, счёт и решение у всех общие. */
const DIR_WORD = { '+': 'растёт', '-': 'падает', 0: 'не меняется', '?': 'любое' };
const KIND_LABEL = { number: 'Задача', truefalse: 'Верно или неверно', graph: 'Графическая задача' };

function ProblemFrame({ block, no, ctx, from, children, verdict, answerText }) {
  const rec = ctx.progress.problems[block.id];
  // решение открыто по кнопке; у «верно или неверно» — само после ответа, пока его не скроют
  const [solMode, setSolMode] = useState(null);
  const status = rec ? (rec.ok ? 'решена' : 'не решена') : null;
  const open = solMode != null ? solMode : !!(verdict && verdict.reveal);
  return (
    <div className="ems-panel" style={{ padding: 14, margin: '12px 0' }} data-testid="tb-problem" data-problem={block.id} data-kind={block.kind}>
      <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <span className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft }}>{from ? `${from} · ` : ''}{KIND_LABEL[block.kind] || 'Задача'} · {no}</span>
        {status && <span className="tb-chip" style={{ color: rec.ok ? COLOR.teal : COLOR.rust, borderColor: rec.ok ? COLOR.teal : COLOR.rust }}>
          {status}{rec.due ? ` · повтор ${daysUntil(rec.due)}` : ''}</span>}
      </div>
      <div className="tb-body"><Blocks blocks={block.statement} ctx={ctx} /></div>
      {children}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ems-btn" style={{ padding: '6px 12px', fontSize: 12.5 }} aria-expanded={!!open}
          onClick={() => { Audio.play('click'); setSolMode(!open); }}>{open ? 'Скрыть решение' : 'Решение'}</button>
      </div>
      {verdict && (
        <div data-testid="tb-verdict" style={{ fontSize: 13, marginTop: 8, color: verdict.bad ? COLOR.muted : verdict.ok ? COLOR.teal : COLOR.rust }}>
          {verdict.ok && <Check size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{verdict.text}
        </div>
      )}
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

function NumberProblem({ block, no, ctx, from }) {
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState(null);
  const answer = `ответ ${fmtNum(block.answer)}${block.unit ? ` ${block.unit}` : ''}`;
  const submit = () => {
    const r = checkAnswer(input, block.answer, block.tol);
    if (r.value == null) { setVerdict({ bad: true, text: 'Введите число: например, 25 или −0,5.' }); return; }
    Audio.play(r.ok ? 'stamp' : 'tick');
    ctx.onAnswer(block.id, r.ok);
    setVerdict({ ok: r.ok, text: r.ok ? `Верно: ${fmtNum(block.answer)}${block.unit ? ` ${block.unit}` : ''}.` : WRONG });
  };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={answer}>
      <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input value={input} onChange={(e) => { setInput(e.target.value); setVerdict(null); }} inputMode="decimal" aria-label={`Ответ к задаче ${no}`}
          placeholder="ответ числом" style={{ ...inputStyle(), width: 150 }} />
        {block.unit && <span style={{ fontSize: 13, color: COLOR.muted }}>{block.unit}</span>}
        <button type="submit" className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 13 }}>Проверить</button>
      </form>
    </ProblemFrame>
  );
}

// «верно или неверно»: выбор проверяется сразу, объяснение пишется для себя и сверяется с решением
function TrueFalseProblem({ block, no, ctx, from }) {
  const [why, setWhy] = useState('');
  const [verdict, setVerdict] = useState(null);
  const pick = (v) => {
    const ok = v === block.answer;
    Audio.play(ok ? 'stamp' : 'tick');
    ctx.onAnswer(block.id, ok);
    setVerdict({ ok, reveal: true, text: ok ? `Верно: утверждение ${block.answer ? 'верно' : 'неверно'}. Сравните своё объяснение с разбором.` : WRONG });
  };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={block.answer ? 'утверждение верно' : 'утверждение неверно'}>
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} aria-label={`Объяснение к задаче ${no}`}
        placeholder="почему — в одну-две фразы (для себя: объяснение сверяется с разбором, а не автоматически)"
        style={{ ...inputStyle(), width: '100%', fontSize: 13, resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ems-btn primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => pick(true)}>Верно</button>
        <button type="button" className="ems-btn primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => pick(false)}>Неверно</button>
      </div>
    </ProblemFrame>
  );
}

// графическая: игрок двигает кривые, проверяются направления величин графика
function GraphProblem({ block, no, ctx, from }) {
  const def = CHARTS[block.chart];
  const [values, setValues] = useState(() => chartDefaults(block.chart, block.attrs));
  const [verdict, setVerdict] = useState(null);
  const names = def.measureNames || {};
  const answer = block.expect.filter((e) => e.dir !== '?').map((e) => `${names[e.key] || e.key}: ${DIR_WORD[e.dir]}`).join(', ');
  const submit = () => {
    const r = checkGraph(block.chart, block.attrs, values, { expect: block.expect, still: block.still });
    if (!r.moved) { setVerdict({ bad: true, text: 'Сначала сдвиньте кривую ползунком.' }); return; }
    const got = r.rows.map((x) => `${names[x.key] || x.key} ${DIR_WORD[x.got]}${x.ok ? '' : ' ✗'}`).join(', ');
    const extra = r.touched.length ? ` Условие не меняет: ${r.touched.map((k) => (def.controls(block.attrs).find((c) => c.id === k) || {}).label || k).join(', ')} — верните ползунок.` : '';
    Audio.play(r.ok ? 'stamp' : 'tick');
    ctx.onAnswer(block.id, r.ok);
    setVerdict({ ok: r.ok, text: r.ok ? `Верно: ${got}.` : `На графике: ${got}.${extra} ${WRONG}` });
  };
  return (
    <ProblemFrame block={block} no={no} ctx={ctx} from={from} verdict={verdict} answerText={answer}>
      <ChartBox type={block.chart} attrs={block.attrs} ctx={ctx} values={values} onValues={(v) => { setValues(v); setVerdict(null); }}
        only={block.controls} framed={false} />
      <button type="button" className="ems-btn primary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={submit}>Проверить сдвиг</button>
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
function ChapterPage({ id, ctx }) {
  const ch = CHAPTER_BY_ID[id];
  const blocks = CHAPTER_BLOCKS[id];
  const idx = CHAPTERS.findIndex((c) => c.id === id);
  const prev = CHAPTERS[idx - 1]; const next = CHAPTERS[idx + 1];
  const read = !!ctx.progress.read[id];
  return (
    <div data-testid="chapter" data-chapter={id}>
      <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12, marginBottom: 14 }} onClick={() => { Audio.play('click'); ctx.go({ kind: 'toc' }); }}>
        <ChevronLeft size={12} style={{ verticalAlign: -2 }} /> Оглавление
      </button>
      <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Глава {chapterNo(id)} · {PARTS.find((p) => p.id === ch.part).title}
      </div>
      <h1 className="ems-serif" style={{ fontSize: 26, color: COLOR.goldSoft, margin: '4px 0 14px', fontWeight: 700 }}>{ch.title}</h1>
      {blocks ? (
        <div className="tb-body"><Blocks blocks={blocks} ctx={ctx} /></div>
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

function CardsAppendix({ ctx, anchor }) {
  const chapterFor = (cardId) => CHAPTERS.find((c) => (c.cards || []).includes(cardId));
  React.useEffect(() => {
    if (!anchor) return;
    const el = document.getElementById(`card-${anchor}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, [anchor]);
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
      <button type="button" className="ems-btn" style={{ padding: '6px 11px', fontSize: 12, marginBottom: 14 }} onClick={() => { Audio.play('click'); ctx.go({ kind: 'toc' }); }}>
        <ChevronLeft size={12} style={{ verticalAlign: -2 }} /> Оглавление
      </button>
      <div style={{ fontSize: 12, color: COLOR.faint, letterSpacing: '.06em', textTransform: 'uppercase' }}>Приложение {String.fromCharCode(1040 + idx)}</div>
      <h1 className="ems-serif" style={{ fontSize: 24, color: COLOR.goldSoft, margin: '4px 0 8px', fontWeight: 700 }}>{a.title}</h1>
      <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 14, lineHeight: 1.55 }}>{a.summary}</div>
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

function ReviewPanel({ ctx }) {
  const { due, later } = reviewQueue(ctx.progress);
  if (!due.length && !later.length) return null;
  return (
    <div className="ems-panel" style={{ padding: 14, marginBottom: 16 }} data-testid="review">
      <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 4 }}>На повторение</div>
      <div style={{ fontSize: 12.5, color: COLOR.muted, lineHeight: 1.5, marginBottom: 6 }}>
        Задачи, в которых был неверный ответ, возвращаются через 2 дня; решили на повторении — следующий раз через 5, потом через 12 дней, и задача уходит из списка.
      </div>
      {due.length === 0 && <div style={{ fontSize: 13 }}>Сегодня повторять нечего.</div>}
      {due.filter((pid) => PROBLEMS[pid]).map((pid) => {
        const { chapter, block } = PROBLEMS[pid];
        const no = problemsOf(chapter).indexOf(pid) + 1;
        return <ProblemCard key={pid} block={block} no={no} from={CHAPTER_BY_ID[chapter].title} ctx={ctx} />;
      })}
      {later.length > 0 && (
        <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 6 }}>
          Ждут своего дня: {later.filter((x) => PROBLEMS[x.id]).map((x) => `${CHAPTER_BY_ID[PROBLEMS[x.id].chapter].title}, задача ${problemsOf(PROBLEMS[x.id].chapter).indexOf(x.id) + 1} — ${daysUntil(x.due)}`).join('; ')}.
        </div>
      )}
    </div>
  );
}

function TocPage({ ctx }) {
  const ready = CHAPTERS.filter((c) => c.status === 'ready');
  const readCount = ready.filter((c) => ctx.progress.read[c.id]).length;
  const allProblems = Object.keys(PROBLEMS);
  const solved = allProblems.filter((id) => ctx.progress.problems[id] && ctx.progress.problems[id].ok).length;
  const last = ctx.progress.last && ctx.progress.last.kind === 'chapter' && CHAPTER_BY_ID[ctx.progress.last.id] ? CHAPTER_BY_ID[ctx.progress.last.id] : null;
  let n = 0;
  return (
    <div data-testid="textbook">
      <div className="ems-panel" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        <span>Прочитано глав: <b>{readCount}</b> из {ready.length} готовых · задач решено: <b>{solved}</b> из {allProblems.length}</span>
        {last && <button type="button" className="ems-btn primary" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
          onClick={() => { Audio.play('click'); ctx.go({ kind: 'chapter', id: last.id }); }}>Продолжить: {last.title}</button>}
      </div>
      <ReviewPanel ctx={ctx} />
      {PARTS.map((p) => (
        <div key={p.id} className="ems-panel" style={{ padding: '12px 0 4px', marginBottom: 14 }}>
          <div className="ems-serif" style={{ fontSize: 17, color: COLOR.goldSoft, padding: '0 12px 8px' }}>{p.title}</div>
          {p.chapters.map((c) => {
            n += 1;
            const probs = problemsOf(c.id);
            const sc = chapterScore(ctx.progress, probs);
            const readMark = !!ctx.progress.read[c.id];
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
   resume — вернуться туда, где читали (после Лаборатории или тайкуна), иначе оглавление.
   onOpenLab({ lever, cb, mode, scenario }), onStartDrill(setup), onOpenTycoon(taskId),
   onOpenScenario(id) — выходы в игру. */
export function TextbookScreen({ onBack, resume = false, onOpenLab, onStartDrill, onOpenTycoon, onOpenScenario }) {
  const [progress, setProgress] = useState(loadProgress);
  const [page, setPage] = useState(() => (resume && progress.last ? progress.last : { kind: 'toc' }));
  const update = (fn) => setProgress((p) => saveProgress(fn(p)));
  const go = (next) => {
    setPage(next);
    update((p) => setLast(p, next.kind === 'toc' ? p.last : { kind: next.kind, id: next.id }));
    if (!next.anchor && typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  };
  const ctx = {
    progress, go, onOpenLab, onStartDrill, onOpenTycoon, onOpenScenario,
    onAnswer: (id, ok) => update((p) => recordAnswer(p, id, ok)),
    setRead: (id, on) => update((p) => (on ? markRead(p, id) : unmarkRead(p, id))),
  };
  const valid = page.kind === 'chapter' ? !!CHAPTER_BY_ID[page.id] : page.kind === 'appendix' ? !!APPENDIX_BY_ID[page.id] : true;
  const cur = valid ? page : { kind: 'toc' };
  return (
    <TrainerPage eyebrow="Учебник" title={cur.kind === 'toc' ? 'Учебник экономики' : 'Учебник'} icon={BookOpenText} onBack={onBack}
      lede={cur.kind === 'toc' ? 'Первый год экономического факультета: микро, потом макро. В каждой главе — теория с формулами и графиком, разбор на числах, задачи с решениями и «проверьте в игре»: где эту модель видно в Лаборатории, задачах на 10 минут или в «Своём деле». Учебная модель и то, как это устроено в игре, всегда разведены: в игре коэффициенты подобраны вручную, в учебнике — стандартные модели.' : null}>
      <style>{CSS}</style>
      {cur.kind === 'toc' && <TocPage ctx={ctx} />}
      {cur.kind === 'chapter' && <ChapterPage key={cur.id} id={cur.id} ctx={ctx} />}
      {cur.kind === 'appendix' && <AppendixPage key={cur.id} id={cur.id} anchor={cur.anchor} ctx={ctx} />}
    </TrainerPage>
  );
}
