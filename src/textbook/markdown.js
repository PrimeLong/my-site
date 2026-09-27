/* РАЗМЕТКА ГЛАВ УЧЕБНИКА: небольшой markdown со вставками. Главы — обычные текстовые
   файлы (chapters/*.md), этот модуль превращает их в дерево блоков, а textbook.jsx
   рисует дерево. Модуль чистый: без React и без DOM — его же читают тесты ссылок.

   Блоки:
     ## Заголовок, ### Подзаголовок
     абзацы (строки подряд), списки «- …» и «1. …», таблицы «| a | b |»
     $$ формула $$ — выключная формула KaTeX (можно на нескольких строках)
     :::model Заголовок … :::      — «учебная модель» (стандартная, как в учебнике)
     :::game Заголовок … :::       — «как это устроено в игре» (коэффициенты подобраны руками)
     :::example Заголовок … :::    — разобранный числовой пример
     :::try Заголовок … :::        — «проверьте в игре»; абзац из одной ссылки становится кнопкой
     :::note Заголовок … :::       — врезка
     :::chart тип ключ=значение … ::: — интерактивный график; текст внутри — подпись
     :::problem id=… answer=… tol=… unit=… условие --- решение :::   — ответ числом
     :::truefalse id=… answer=true|false утверждение --- ключевые пункты (список) --- разбор :::
        — «верно или неверно»: сначала объяснение, потом сверка с ключевыми пунктами
     В любой задаче строки «?? …» — подсказки, они открываются по одной перед решением.
     :::graph id=… chart=тип <параметры графика> expect="P:+ Q:-" still="…" controls="…"
        solution="dC:-20" условие --- решение :::                    — сдвиньте кривую на графике;
        ответ — направления величин (+, −, 0, ? — любое), solution — эталонный сдвиг для тестов

   В строке: $формула$, **жирный**, *курсив* и ссылки [[вид:цель?параметры|текст]]:
     lever — рычаг (LEVERS), term — термин словаря, drill — задача на 10 минут,
     scenario — сценарий партии, lab — рычаг в Лаборатории (?cb=fixed&mode=hold&scenario=…),
     tycoon — задание в «Своём деле», chapter — глава, card — карточка «игра ↔ учебник»,
     appendix — приложение (cards, limits, glossary). */

export const LINK_KINDS = ['lever', 'term', 'drill', 'scenario', 'lab', 'tycoon', 'chapter', 'card', 'appendix'];
// ссылки-действия: абзац из одной такой ссылки рисуется кнопкой
export const ACTION_KINDS = ['lab', 'drill', 'scenario', 'tycoon'];
export const BOX_KINDS = ['model', 'game', 'example', 'try', 'note'];

/* ------------------------------ СТРОКА ------------------------------ */
function parseLink(inner) {
  const bar = inner.indexOf('|');
  const spec = bar >= 0 ? inner.slice(0, bar) : inner;
  const label = bar >= 0 ? inner.slice(bar + 1).trim() : null;
  const colon = spec.indexOf(':');
  const kind = colon >= 0 ? spec.slice(0, colon).trim() : spec.trim();
  const rest = colon >= 0 ? spec.slice(colon + 1).trim() : '';
  const q = rest.indexOf('?');
  const target = q >= 0 ? rest.slice(0, q) : rest;
  const params = {};
  if (q >= 0) {
    rest.slice(q + 1).split('&').filter(Boolean).forEach((pair) => {
      const [k, v = ''] = pair.split('=');
      params[k] = v;
    });
  }
  return { t: 'link', kind, target, params, label };
}

export function parseInline(src) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && (src[i + 1] === '$' || src[i + 1] === '*' || src[i + 1] === '[')) { buf += src[i + 1]; i += 2; continue; }
    if (ch === '$') {
      const end = src.indexOf('$', i + 1);
      if (end > i + 1) { flush(); out.push({ t: 'math', v: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (ch === '[' && src[i + 1] === '[') {
      const end = src.indexOf(']]', i + 2);
      if (end > 0) { flush(); out.push(parseLink(src.slice(i + 2, end))); i = end + 2; continue; }
    }
    if (ch === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2);
      if (end > i + 2) { flush(); out.push({ t: 'b', c: parseInline(src.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if (ch === '*' && src[i + 1] !== ' ') {
      const end = src.indexOf('*', i + 1);
      if (end > i + 1 && src[end - 1] !== ' ') { flush(); out.push({ t: 'i', c: parseInline(src.slice(i + 1, end)) }); i = end + 1; continue; }
    }
    buf += ch; i += 1;
  }
  flush();
  return out;
}

/* ------------------------------ БЛОКИ ------------------------------ */
// «слова» и «ключ=значение» после имени вставки; значения можно брать в кавычки
export function parseAttrs(s) {
  const attrs = {}; const words = [];
  const re = /(\S+?)=("([^"]*)"|\S+)|("([^"]*)")|(\S+)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) attrs[m[1]] = m[3] != null ? m[3] : m[2];
    else if (m[4]) words.push(m[5]);
    else words.push(m[6]);
  }
  return { attrs, words };
}

const isBlockStart = (line) => /^(#{2,3}\s|:::|\$\$|-\s|\d+\.\s|\|)/.test(line);

export function parseBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i += 1; continue; }

    // вставка :::имя … :::
    const dir = /^:::(\w+)\s*(.*)$/.exec(trimmed);
    if (dir) {
      const name = dir[1];
      const { attrs, words } = parseAttrs(dir[2]);
      const body = [];
      i += 1;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) { body.push(lines[i]); i += 1; }
      if (i >= lines.length) throw new Error(`Вставка :::${name} не закрыта`);
      i += 1;
      if (name === 'chart') {
        const caption = body.join(' ').trim();
        blocks.push({ type: 'chart', chart: words[0], attrs, caption: caption ? parseInline(caption) : null });
      } else if (name === 'problem' || name === 'truefalse' || name === 'graph') {
        // подсказки — строки «?? …» в условии: открываются по одной перед решением
        const hints = body.filter((l) => l.trim().startsWith('??')).map((l) => parseInline(l.trim().replace(/^\?\?\s*/, '')));
        const lines2 = body.filter((l) => !l.trim().startsWith('??'));
        const seps = lines2.map((l, k) => (l.trim() === '---' ? k : -1)).filter((k) => k >= 0);
        if (!seps.length) throw new Error(`В задаче ${attrs.id} нет решения (строка ---)`);
        const part = (a, b) => parseBlocks(lines2.slice(a, b).join('\n'));
        const base = { type: 'problem', id: attrs.id, hints, statement: part(0, seps[0]), solution: part(seps[seps.length - 1] + 1) };
        if (name === 'problem') {
          blocks.push({ ...base, kind: 'number', answer: Number(attrs.answer), tol: attrs.tol != null ? Number(attrs.tol) : null, unit: attrs.unit || '' });
        } else if (name === 'truefalse') {
          if (attrs.answer !== 'true' && attrs.answer !== 'false') throw new Error(`В задаче ${attrs.id} ответ должен быть true или false`);
          // утверждение --- ключевые пункты объяснения (список) --- полный разбор
          if (seps.length !== 2) throw new Error(`В задаче ${attrs.id} нужны три части: утверждение, ключевые пункты, разбор`);
          const pts = part(seps[0] + 1, seps[1]);
          const list = pts.find((b) => b.type === 'ul' || b.type === 'ol');
          if (!list) throw new Error(`В задаче ${attrs.id} ключевые пункты — списком`);
          blocks.push({ ...base, kind: 'truefalse', answer: attrs.answer === 'true', points: list.items });
        } else {
          const { id: _id, chart, expect, still, controls, solution, ...chartAttrs } = attrs;
          const split = (x) => (x ? x.split(/\s+/).filter(Boolean) : []);
          // эталонный сдвиг для тестов: «dC:-20 dA:10»
          const ref = Object.fromEntries(split(solution).map((t) => { const [k, v] = t.split(':'); return [k, Number(v)]; }));
          blocks.push({ ...base, kind: 'graph', chart, attrs: chartAttrs, expect: split(expect).map((t) => { const [key, dir] = t.split(':'); return { key, dir }; }),
            still: split(still), controls: controls ? split(controls) : null, reference: ref });
        }
      } else if (BOX_KINDS.includes(name)) {
        blocks.push({ type: 'box', kind: name, title: words.join(' '), children: parseBlocks(body.join('\n')) });
      } else {
        throw new Error(`Неизвестная вставка :::${name}`);
      }
      continue;
    }

    // выключная формула
    if (trimmed.startsWith('$$')) {
      let tex = trimmed.slice(2);
      if (tex.trim().endsWith('$$') && tex.trim().length >= 2) {
        blocks.push({ type: 'math', tex: tex.trim().slice(0, -2).trim() });
        i += 1; continue;
      }
      i += 1;
      const acc = [tex];
      while (i < lines.length && !lines[i].trim().endsWith('$$')) { acc.push(lines[i]); i += 1; }
      if (i >= lines.length) throw new Error('Формула $$ не закрыта');
      acc.push(lines[i].trim().slice(0, -2));
      i += 1;
      blocks.push({ type: 'math', tex: acc.join('\n').trim() });
      continue;
    }

    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (h) { blocks.push({ type: h[1].length === 2 ? 'h2' : 'h3', inline: parseInline(h[2]) }); i += 1; continue; }

    // список: пункты подряд, продолжение пункта — строка с отступом
    const li = /^(-|\d+\.)\s+(.*)$/.exec(trimmed);
    if (li) {
      const ordered = li[1] !== '-';
      // нумерация продолжается с того номера, с которого начат список (после таблицы — «5.»)
      const start = ordered ? parseInt(li[1], 10) : 1;
      const items = [];
      while (i < lines.length) {
        const m = /^(-|\d+\.)\s+(.*)$/.exec(lines[i].trim());
        if (m && (m[1] !== '-') === ordered) { items.push(m[2]); i += 1; continue; }
        if (items.length && /^\s{2,}\S/.test(lines[i])) { items[items.length - 1] += ` ${lines[i].trim()}`; i += 1; continue; }
        break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items: items.map(parseInline), ...(ordered && start !== 1 ? { start } : {}) });
      continue;
    }

    // таблица: шапка, разделитель |---|, строки
    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i += 1; }
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()));
      const body = rows.slice(1).filter((r) => !/^\|?\s*:?-{3,}/.test(r));
      blocks.push({ type: 'table', head: cells(rows[0]), rows: body.map(cells) });
      continue;
    }

    // абзац: строки подряд до пустой или до начала другого блока
    const acc = [];
    while (i < lines.length && lines[i].trim() && (acc.length === 0 || !isBlockStart(lines[i].trim()))) { acc.push(lines[i].trim()); i += 1; }
    blocks.push({ type: 'p', inline: parseInline(acc.join(' ')) });
  }
  return blocks;
}

export const parseChapter = (text) => parseBlocks(text);

/* ------------------------------ ОБХОД ------------------------------ */
// все блоки дерева, включая вложенные (врезки, условия и решения задач)
export function walkBlocks(blocks, fn) {
  blocks.forEach((b) => {
    fn(b);
    if (b.children) walkBlocks(b.children, fn);
    if (b.statement) walkBlocks(b.statement, fn);
    if (b.solution) walkBlocks(b.solution, fn);
  });
}
const inlinesOf = (b) => [
  ...(b.inline ? [b.inline] : []), ...(b.items || []), ...(b.head || []), ...((b.rows || []).flat()), ...(b.caption ? [b.caption] : []),
];
function walkInline(nodes, fn) {
  nodes.forEach((n) => { fn(n); if (n.c) walkInline(n.c, fn); });
}
export function collectInline(blocks, pred) {
  const out = [];
  walkBlocks(blocks, (b) => inlinesOf(b).forEach((line) => walkInline(line, (n) => { if (pred(n)) out.push(n); })));
  return out;
}
export const collectLinks = (blocks) => collectInline(blocks, (n) => n.t === 'link');
// все формулы: строчные и выключные
export function collectMath(blocks) {
  const out = collectInline(blocks, (n) => n.t === 'math').map((n) => n.v);
  walkBlocks(blocks, (b) => { if (b.type === 'math') out.push(b.tex); });
  return out;
}
export function collectBlocks(blocks, pred) {
  const out = [];
  walkBlocks(blocks, (b) => { if (pred(b)) out.push(b); });
  return out;
}
// абзац из одной ссылки-действия — это кнопка
export const actionOf = (b) => (b.type === 'p' && b.inline.length === 1 && b.inline[0].t === 'link' && ACTION_KINDS.includes(b.inline[0].kind)
  ? b.inline[0] : null);

/* ------------------------------ ОТВЕТЫ ------------------------------ */
// «1 150», «−0,5», «2.22», «30%», «2/3», «292 руб.» → число; не число → null.
// unit — подпись задачи рядом с полем («руб.», «тыс. руб.», «%»): её можно дописать к ответу.
const NUM = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
export function parseNumber(input, unit = '') {
  if (input == null) return null;
  let s = String(input).trim().toLowerCase().replace(/[\s  ]/g, '').replace(/[−–—]/g, '-').replace(/,/g, '.');
  const u = String(unit || '').toLowerCase().replace(/[\s  ]/g, '').replace(/,/g, '.').replace(/\.$/, '');
  if (u && u !== '%') {
    if (s.endsWith(`${u}.`)) s = s.slice(0, -(u.length + 1));
    else if (s.endsWith(u)) s = s.slice(0, -u.length);
  }
  s = s.replace(/%$/, '');
  // дробь «a/b»
  const frac = /^([-+]?[\d.]+)\/([\d.]+)$/.exec(s);
  if (frac) {
    if (!NUM.test(frac[1]) || !NUM.test(frac[2])) return null;
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!NUM.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
// допуск: только тот, что задан в задаче; без него — точное совпадение (с поправкой на
// двоичную запись дробей). Поэтому у каждой задачи с дробным ответом допуск задан явно.
export const EXACT = 1e-9;
export function checkAnswer(input, answer, tol = null, unit = '') {
  const v = parseNumber(input, unit);
  if (v == null) return { ok: false, value: null };
  const t = tol != null && Number.isFinite(tol) ? tol : 0;
  return { ok: Math.abs(v - answer) <= t + EXACT * Math.max(1, Math.abs(answer)), value: v };
}
