/* РАЗМЕТКА ГЛАВ УЧЕБНИКА: небольшой markdown со вставками. Главы — обычные текстовые
   файлы (chapters/*.md), этот модуль превращает их в дерево блоков, а textbook.jsx
   рисует дерево. Модуль чистый: без React и без DOM — его же читают тесты ссылок.

   Блоки:
     ## Заголовок, ### Подзаголовок; ## Заголовок {#якорь} — раздел, на который можно сослаться
     абзацы (строки подряд), списки «- …» и «1. …», таблицы «| a | b |»
     $$ формула $$ — выключная формула KaTeX (можно на нескольких строках)
     :::model Заголовок … :::      — «учебная модель» (стандартная, как в учебнике)
     :::game Заголовок … :::       — «как это устроено в игре» (коэффициенты подобраны руками)
     :::example Заголовок … :::    — разобранный числовой пример
     :::try Заголовок … :::        — «проверьте в игре»; абзац из одной ссылки становится кнопкой
     :::note Заголовок … :::       — врезка
     :::goals … :::                — «после главы вы сможете» (список целей в начале главы)
     :::summary … :::              — «Главное» в конце главы
     :::mistakes … :::             — «Типичные ошибки»
     Во врезке строка «+++» отделяет основное от раскрывающегося «Подробнее».
     :::recall id=… вопрос --- ответ ::: — вопрос на вспоминание в конце раздела
     :::flow Заголовок — схема-цепочка: пункты «- Звено | если вверх | если вниз», ниже — подпись
     :::chart тип ключ=значение … ::: — интерактивный график; текст внутри — подпись
     :::diagram circular|balance … ::: — схема: кругооборот доходов и расходов, балансы банков по шагам
     :::problem id=… level=1|2|3 answer=… tol=… unit=… условие --- решение :::   — ответ числом;
        задача в несколько шагов: answer="15;20" (tol, unit и parts — подписи шагов — тоже через «;»).
        level: 1 — базовый, 2 — семинарский, 3 — олимпиадный
     :::truefalse id=… answer=true|false утверждение --- ключевые пункты (список) --- разбор :::
        — «верно или неверно»: сначала объяснение, потом сверка с ключевыми пунктами
     В любой задаче строки «?? …» — подсказки, они открываются по одной перед решением.
     Строки «!! неверный ответ | почему так получается» — ловушки: если ответ совпал с ловушкой,
        вместо «неверно» показывается объяснение ошибки. В задаче с шагами — «!! б) 30 | …»;
        в «верно или неверно» — «!! true | …» (объяснение для неверного выбора);
        в графической — «!! dD | …» (объяснение, если сдвинут этот ползунок).
     news="ЗАГОЛОВОК" у задачи любого вида — задача по газете: сначала заголовок из игровой
        газеты, потом вопрос, что он значит для спроса, выпуска, цен и курса.
     :::graph id=… chart=тип <параметры графика> expect="P:+ Q:-" still="…" controls="…"
        solution="dC:-20" условие --- решение :::                    — сдвиньте кривую на графике;
        ответ — направления величин (+, −, 0, ? — любое), solution — эталонный сдвиг для тестов

   В строке: $формула$, **жирный**, *курсив* и ссылки [[вид:цель?параметры|текст]]:
     lever — рычаг (LEVERS), term — термин словаря, drill — задача на 10 минут,
     scenario — сценарий партии, lab — рычаг в Лаборатории (?cb=fixed&mode=hold&scenario=…),
     tycoon — задание в «Своём деле», chapter — глава, card — карточка «игра ↔ учебник»,
     appendix — приложение (cards, limits, glossary). */
import { DIAGRAM_KINDS } from './diagrams.js';

export const LINK_KINDS = ['lever', 'term', 'drill', 'scenario', 'lab', 'tycoon', 'chapter', 'card', 'appendix'];
// ссылки-действия: абзац из одной такой ссылки рисуется кнопкой
export const ACTION_KINDS = ['lab', 'drill', 'scenario', 'tycoon'];
// numbers — короткий пример на числах сразу после вывода новой формулы (example — большой разбор главы)
export const BOX_KINDS = ['model', 'game', 'example', 'numbers', 'try', 'note', 'goals', 'summary', 'mistakes'];
export const LEVELS = { 1: 'базовый', 2: 'семинарский', 3: 'олимпиадный' };
const PART_LABELS = ['а)', 'б)', 'в)', 'г)', 'д)', 'е)'];

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
      if (name === 'idea') {
        // карточка новой идеи урока: :::idea id=… title="…" chart=тип <параметры графика> auto="задачи" variants="типы";
        // со словом more — вторая карточка того же урока: встаёт перед следующим упражнением
        // kind=intro — урок «Знакомство» (эта карточка — его первый шаг), иначе урок-практика без карточки;
        // pic=… — картинка шага вместо графика (значок из набора src/learn.jsx);
        // kind — вид урока (LESSON_KINDS); who=… — кто говорит в шаге «Истории» (src/learn/cast.js);
        // в уроке «Слова» строки «- термин: короткое определение» — слова урока;
        // со словом diamond — шаг алмазного уровня: его и упражнения после него видно только
        // при повторном, усложнённом прохождении урока
        // hard="задачи var:тип" — задачи семинарского и олимпиадного уровня на тему этого урока: из них
        // берутся усложнения (алмазный уровень, сильному ученику) в этом уроке и дальше по юниту
        // discover=demand — шаг «Откройте сами» (со словом more): ученик сам исследует модель; встаёт
        // первым шагом урока, до карточки-идеи (DISCOVER_KINDS)
        const { id: _id, title, chart, auto, variants, kind, pic, who, hard, discover, ...chartAttrs } = attrs;
        if (discover && !DISCOVER_KINDS.includes(discover)) throw new Error(`Неизвестный шаг «Откройте сами» ${discover} в ${attrs.id}`);
        if (discover && !words.includes('more')) throw new Error(`Шаг «Откройте сами» ${attrs.id} — со словом more`);
        const split = (x) => (x ? x.split(/\s+/).filter(Boolean) : []);
        if (kind && !LESSON_KINDS.includes(kind)) throw new Error(`Неизвестный вид урока ${kind} в ${attrs.id}`);
        const wordLines = kind === 'words' ? body.filter((l) => /^-\s/.test(l.trim())) : [];
        // «- термин: определение | пример» — пример только на карточке колоды, не в плитках и парах
        const terms = wordLines.map((l) => {
          const t = l.trim().slice(2); const k = t.indexOf(':'); const def = t.slice(k + 1); const bar = def.indexOf('|');
          return { term: t.slice(0, k).trim(), text: (bar < 0 ? def : def.slice(0, bar)).trim(), ...(bar < 0 ? {} : { example: def.slice(bar + 1).trim() }) };
        });
        blocks.push({ type: 'idea', id: attrs.id, title: title || '', chart: chart || null, attrs: chartAttrs, auto: split(auto), variants: split(variants), hard: split(hard),
          text: parseInline(body.filter((l) => !wordLines.includes(l)).join(' ').trim()),
          kind: kind || 'practice', pic: pic || null, who: who || null, ...(terms.length ? { terms } : {}), ...(discover ? { discover } : {}),
          ...(words.includes('more') ? { inner: true } : {}), ...(words.includes('diamond') ? { diamond: true } : {}) });
      } else if (name === 'ex') {
        blocks.push(parseExercise(words[0], attrs, body));
      } else if (name === 'round') {
        blocks.push(parseRound(words[0], attrs, body));
      } else if (name === 'diagram') {
        // схема-иллюстрация: :::diagram circular|balance ключ=значение, внутри — подпись
        if (!DIAGRAM_KINDS.includes(words[0])) throw new Error(`Неизвестная схема :::diagram ${words[0]}`);
        const caption = body.join(' ').trim();
        blocks.push({ type: 'diagram', diagram: words[0], attrs, caption: caption ? parseInline(caption) : null });
      } else if (name === 'chart') {
        const caption = body.join(' ').trim();
        blocks.push({ type: 'chart', chart: words[0], attrs, caption: caption ? parseInline(caption) : null });
      } else if (name === 'recall') {
        const sep = body.findIndex((l) => l.trim() === '---');
        if (sep < 0) throw new Error(`В вопросе ${attrs.id} нет ответа (строка ---)`);
        blocks.push({ type: 'recall', id: attrs.id, question: parseBlocks(body.slice(0, sep).join('\n')), answer: parseBlocks(body.slice(sep + 1).join('\n')) });
      } else if (name === 'flow') {
        const steps = []; const rest = [];
        body.forEach((l) => {
          const m = /^-\s+(.*)$/.exec(l.trim());
          if (m) { const [title, up = '', down = ''] = m[1].split('|').map((x) => x.trim()); steps.push({ title: parseInline(title), up: parseInline(up), down: parseInline(down) }); } else rest.push(l);
        });
        const caption = rest.join(' ').trim();
        blocks.push({ type: 'flow', title: words.join(' '), steps, caption: caption ? parseInline(caption) : null });
      } else if (name === 'problem' || name === 'truefalse' || name === 'graph') {
        // подсказки — строки «?? …» в условии: открываются по одной перед решением
        const hints = body.filter((l) => l.trim().startsWith('??')).map((l) => parseInline(l.trim().replace(/^\?\?\s*/, '')));
        // ловушки — строки «!! ответ | объяснение»
        const trapLines = body.filter((l) => l.trim().startsWith('!!')).map((l) => {
          const t = l.trim().replace(/^!!\s*/, ''); const bar = t.indexOf('|');
          if (bar < 0) throw new Error(`В задаче ${attrs.id} ловушка без объяснения: ${t}`);
          return { key: t.slice(0, bar).trim(), text: parseInline(t.slice(bar + 1).trim()) };
        });
        const lines2 = body.filter((l) => !l.trim().startsWith('??') && !l.trim().startsWith('!!'));
        const seps = lines2.map((l, k) => (l.trim() === '---' ? k : -1)).filter((k) => k >= 0);
        if (!seps.length) throw new Error(`В задаче ${attrs.id} нет решения (строка ---)`);
        const part = (a, b) => parseBlocks(lines2.slice(a, b).join('\n'));
        const level = attrs.level != null ? Number(attrs.level) : null;
        // news="ЗАГОЛОВОК" — задача по газете: условие начинается с заголовка игровой газеты
        const base = { type: 'problem', id: attrs.id, level, hints, news: attrs.news || null, statement: part(0, seps[0]), solution: part(seps[seps.length - 1] + 1) };
        if (name === 'problem') {
          // шаги задачи: ответы, допуски, единицы и подписи — через «;», по порядку
          const list = (x) => (x == null ? [] : String(x).split(';').map((v) => v.trim()));
          const answers = list(attrs.answer); const tols = list(attrs.tol); const units = list(attrs.unit); const labels = list(attrs.parts);
          const parts = answers.map((a, k) => ({
            label: answers.length > 1 ? (labels[k] || PART_LABELS[k]) : '',
            answer: Number(a),
            tol: tols[k] != null && tols[k] !== '' ? Number(tols[k]) : null,
            unit: units[k] != null ? units[k] : (units.length === 1 ? units[0] : ''),
          }));
          const one = parts.length === 1 ? parts[0] : null;
          // «б) 30» — ловушка шага б; просто «30» — первого (или единственного) шага
          const traps = trapLines.map((tr) => {
            const m = tr.key.match(/^(\S+\))\s*(.+)$/);
            const k = m ? parts.findIndex((pt) => pt.label === m[1]) : 0;
            const v = parseNumber(m ? m[2] : tr.key);
            if (k < 0 || v == null) throw new Error(`В задаче ${attrs.id} ловушка «${tr.key}» не разобрана`);
            return { part: k, value: v, text: tr.text };
          });
          blocks.push({ ...base, kind: 'number', traps, parts, answer: one ? one.answer : parts.map((x) => x.answer), tol: one ? one.tol : null, unit: one ? one.unit : '' });
        } else if (name === 'truefalse') {
          if (attrs.answer !== 'true' && attrs.answer !== 'false') throw new Error(`В задаче ${attrs.id} ответ должен быть true или false`);
          // утверждение --- ключевые пункты объяснения (список) --- полный разбор
          if (seps.length !== 2) throw new Error(`В задаче ${attrs.id} нужны три части: утверждение, ключевые пункты, разбор`);
          const pts = part(seps[0] + 1, seps[1]);
          const list = pts.find((b) => b.type === 'ul' || b.type === 'ol');
          if (!list) throw new Error(`В задаче ${attrs.id} ключевые пункты — списком`);
          const traps = trapLines.map((tr) => {
            if (tr.key !== 'true' && tr.key !== 'false') throw new Error(`В задаче ${attrs.id} ловушка — true или false`);
            return { value: tr.key === 'true', text: tr.text };
          });
          blocks.push({ ...base, kind: 'truefalse', answer: attrs.answer === 'true', points: list.items, traps });
        } else {
          const { id: _id, chart, expect, still, controls, solution, news: _news, level: _level, ...chartAttrs } = attrs;
          const split = (x) => (x ? x.split(/\s+/).filter(Boolean) : []);
          // эталонный сдвиг для тестов: «dC:-20 dA:10»
          const ref = Object.fromEntries(split(solution).map((t) => { const [k, v] = t.split(':'); return [k, Number(v)]; }));
          blocks.push({ ...base, kind: 'graph', chart, attrs: chartAttrs, expect: split(expect).map((t) => { const [key, dir] = t.split(':'); return { key, dir }; }),
            still: split(still), controls: controls ? split(controls) : null, reference: ref, traps: trapLines.map((tr) => ({ control: tr.key, text: tr.text })) });
        }
      } else if (BOX_KINDS.includes(name)) {
        // «+++» — дальше подробности, они раскрываются по кнопке «Подробнее»
        const cut = body.findIndex((l) => l.trim() === '+++');
        const main = cut >= 0 ? body.slice(0, cut) : body;
        const more = cut >= 0 ? parseBlocks(body.slice(cut + 1).join('\n')) : null;
        blocks.push({ type: 'box', kind: name, title: words.join(' '), children: parseBlocks(main.join('\n')), ...(more ? { more } : {}) });
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
    if (h) {
      const anchor = /\s*\{#([\w-]+)\}\s*$/.exec(h[2]);
      const text = anchor ? h[2].slice(0, anchor.index) : h[2];
      blocks.push({ type: h[1].length === 2 ? 'h2' : 'h3', inline: parseInline(text), ...(anchor ? { anchor: anchor[1] } : {}) });
      i += 1; continue;
    }

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

/* ------------------------------ УПРАЖНЕНИЯ УРОКОВ ------------------------------
   :::ex вид id=… — упражнение урока (путь «как в Дуолинго»). Виды:
     choice / gap — вопрос (в gap пропуск «___»), строки «+ верный вариант» и «- неверный | почему»;
     tf answer=true|false — утверждение;
     match — пары «- слева ↔ справа»; sort bins="А|Б" — «- пункт >> А»;
     calc answer=… tol=… unit=… или variant=тип — быстрый расчёт, ловушки «!! значение | почему»;
     shift chart=тип answer="S-" options="D+ D- S+ S-" — «куда сдвинется?», ловушки «!! D+ | почему»;
     news headline="…" vars="P:цена Q:количество" expect="P:+ Q:-" — «газета».
   Всё после строки «---» — объяснение, которое показывается после ответа.
   context="…" — то, что ученик услышал в «Слушай»: в самом радиоуроке вопрос его не повторяет,
   а в повторении, практике и проверке (вне эфира) context встаёт перед условием.
   Новые взаимодействия (рынок Q_D = a − bP, Q_S = c + dP; dA, dC — сдвиги кривых):
     tiles — «+ плитка | плитка | …» — верное определение из плиток, «- плитка | …» — лишние плитки;
     curve a b c d answer="D+" only=D — сдвинуть кривую пальцем (only — на графике одна кривая), ловушки «!! S+ | почему»;
     price a b c d start=10 — двигать цену, пока не исчезнут дефицит и избыток;
     point a b c d dA=… dC=… — поставить точку (нового) равновесия;
     у match — seconds=… — пары на время.
   «Домино» (domino headline="…") — цепочка причин: новость «Вестника» сверху, строки «+ звено [эффект]»
     — верные звенья по порядку (событие → что меняется → какая кривая и куда → цена → количество → кого
     коснётся), «!! карточка | почему не следует» — правдоподобные ложные карточки с объяснением, как у
     ловушек. Звеньев 4–5, всего карточек 7–8. Эффект — что звено делает со сценой: D+ D- S+ S- (кривая
     сдвигается), P и Q (стрелка цены и количества), ceil (потолок цены 15 крон), street (люди на улице). */
export const LESSON_KINDS = ['intro', 'practice', 'words', 'story', 'listen', 'game', 'review', 'summary'];
// шаги «Откройте сами»: demand — день в кофейне, точки «цена — сколько купили» складываются в кривую спроса
export const DISCOVER_KINDS = ['demand'];
const EX_KINDS = ['choice', 'gap', 'tf', 'match', 'sort', 'calc', 'shift', 'news', 'tiles', 'curve', 'price', 'point', 'open', 'domino'];
export const DOMINO_EFFECTS = ['D+', 'D-', 'S+', 'S-', 'P', 'Q', 'ceil', 'street'];
const MARKET = ['a', 'b', 'c', 'd', 'dA', 'dC'];
const market = (attrs) => Object.fromEntries(MARKET.map((k) => [k, attrs[k] != null ? Number(attrs[k]) : (k === 'dA' || k === 'dC' ? 0 : NaN)]));
function parseExercise(kind, attrs, body) {
  if (!EX_KINDS.includes(kind)) throw new Error(`Неизвестное упражнение :::ex ${kind}`);
  if (!attrs.id) throw new Error(`У упражнения ${kind} нет id`);
  const sep = body.findIndex((l) => l.trim() === '---');
  const main = sep >= 0 ? body.slice(0, sep) : body;
  const explain = sep >= 0 ? parseBlocks(body.slice(sep + 1).join('\n')) : null;
  const isOpt = (l) => /^[+-]\s/.test(l.trim());
  const isTrap = (l) => l.trim().startsWith('!!');
  const special = (l) => isOpt(l) || isTrap(l);
  const prompt = parseBlocks(main.filter((l) => !special(l)).join('\n'));
  // «|» внутри формулы ($|E|$) — модуль, а не разделитель «вариант | почему»
  const bar = (t) => { let m = false; for (let k = 0; k < t.length; k += 1) { if (t[k] === '$' && t[k - 1] !== '\\') m = !m; else if (t[k] === '|' && !m) return k; } return -1; };
  const why = (t) => { const k = bar(t); return k < 0 ? [t.trim(), null] : [t.slice(0, k).trim(), parseInline(t.slice(k + 1).trim())]; };
  const ex = { type: 'ex', kind, id: attrs.id, attrs, prompt, explain, ...(attrs.context ? { context: parseInline(attrs.context) } : {}) };
  const opts = main.filter(isOpt).map((l) => { const t = l.trim(); const [text, w] = why(t.slice(1).trim()); return { raw: text, correct: t[0] === '+', why: w }; });
  const traps = main.filter(isTrap).map((l) => { const [v, w] = why(l.trim().replace(/^!!\s*/, '')); return { key: v, why: w }; });
  if (kind === 'choice' || kind === 'gap') ex.options = opts.map((o) => ({ text: parseInline(o.raw), raw: o.raw, correct: o.correct, why: o.why }));
  if (kind === 'tf') {
    if (attrs.answer !== 'true' && attrs.answer !== 'false') throw new Error(`В упражнении ${attrs.id} answer — true или false`);
    ex.answer = attrs.answer === 'true';
  }
  if (kind === 'open' && !explain) throw new Error(`У открытого вопроса ${attrs.id} нет разбора после ---`);
  if (kind === 'match' && attrs.seconds) ex.seconds = Number(attrs.seconds);
  if (kind === 'tiles') {
    const tiles = (o) => o.raw.split(/\s\|\s/).map((x) => x.trim()).filter(Boolean);
    const right = opts.filter((o) => o.correct);
    if (right.length !== 1) throw new Error(`В плитках ${attrs.id} должна быть одна строка «+ …»`);
    ex.solution = tiles(right[0]); ex.extra = opts.filter((o) => !o.correct).flatMap(tiles);
  }
  if (kind === 'curve' || kind === 'price' || kind === 'point') {
    ex.market = market(attrs);
    if (MARKET.slice(0, 4).some((k) => !Number.isFinite(ex.market[k]))) throw new Error(`В упражнении ${attrs.id} нужны a, b, c, d`);
    if (kind === 'curve') { ex.answer = attrs.answer; ex.only = attrs.only || null; ex.traps = traps.map((t) => ({ key: t.key, why: t.why })); }
    if (kind === 'price') ex.start = Number(attrs.start || 0);
  }
  if (kind === 'match') ex.pairs = opts.map((o) => { const [l, r] = o.raw.split(/\s↔\s/); return [{ raw: l.trim(), text: parseInline(l.trim()) }, { raw: (r || '').trim(), text: parseInline((r || '').trim()) }]; });
  if (kind === 'sort') {
    ex.bins = (attrs.bins || '').split('|').map((x) => x.trim()).filter(Boolean);
    ex.items = opts.map((o) => { const [t, bin] = o.raw.split(/\s>>\s/); return { raw: t.trim(), text: parseInline(t.trim()), bin: (bin || '').trim() }; });
  }
  if (kind === 'calc') {
    ex.variant = attrs.variant || null;
    if (!ex.variant) {
      ex.answer = Number(attrs.answer); ex.tol = attrs.tol != null ? Number(attrs.tol) : null; ex.unit = attrs.unit || '';
      ex.traps = traps.map((t) => ({ value: parseNumber(t.key), why: t.why }));
    }
  }
  if (kind === 'shift') {
    const { id: _i, chart, answer, options, ...chartAttrs } = attrs;
    ex.chart = chart; ex.chartAttrs = chartAttrs; ex.answer = answer;
    ex.choices = options ? options.split(/\s+/).filter(Boolean) : null;
    ex.traps = traps.map((t) => ({ key: t.key, why: t.why }));
  }
  if (kind === 'domino') {
    if (!attrs.headline) throw new Error(`В «Домино» ${attrs.id} нет новости (headline)`);
    ex.headline = attrs.headline;
    // scene=demand — на сцене только спрос и цена кофейни (предложения ученик ещё не знает)
    ex.scene = attrs.scene || 'market';
    if (!['market', 'demand'].includes(ex.scene)) throw new Error(`В «Домино» ${attrs.id}: сцена ${ex.scene} — market или demand`);
    ex.links = main.filter((l) => /^\+\s/.test(l.trim())).map((l) => {
      const m = /^(.*?)\s*(?:\[([^\]]+)\])?\s*$/.exec(l.trim().slice(1).trim());
      const effects = m[2] ? m[2].split(/\s+/) : [];
      effects.forEach((e) => { if (!DOMINO_EFFECTS.includes(e)) throw new Error(`В «Домино» ${attrs.id}: неизвестный эффект ${e}`); });
      if (m[1].includes('|')) throw new Error(`В «Домино» ${attrs.id}: у верного звена не бывает «почему»`);
      return { raw: m[1], text: parseInline(m[1]), effects };
    });
    ex.decoys = traps.map((t) => {
      if (!t.why) throw new Error(`В «Домино» ${attrs.id}: у ложной карточки «${t.key}» нет объяснения`);
      return { raw: t.key, text: parseInline(t.key), why: t.why };
    });
    if (main.some((l) => /^-\s/.test(l.trim()))) throw new Error(`В «Домино» ${attrs.id} ложные карточки — строками «!! карточка | почему»`);
    if (ex.links.length < 4 || ex.links.length > 5) throw new Error(`В «Домино» ${attrs.id} звеньев ${ex.links.length}, нужно 4–5`);
    const total = ex.links.length + ex.decoys.length;
    if (total < 7 || total > 8) throw new Error(`В «Домино» ${attrs.id} карточек ${total}, нужно 7–8`);
  }
  if (kind === 'news') {
    ex.headline = attrs.headline || '';
    ex.vars = (attrs.vars || '').split(/\s+(?=\w+:)/).map((v) => { const k = v.indexOf(':'); return { key: v.slice(0, k), label: v.slice(k + 1).trim() }; }).filter((v) => v.key);
    ex.expect = Object.fromEntries((attrs.expect || '').split(/\s+/).filter(Boolean).map((t) => t.split(':')));
  }
  return ex;
}

/* :::round вид id=… title="…" chart=market|ppf|budget — мини-игра урока, одна на урок, на время:
     swipe left="…" right="…" — карточки «- текст >> left|right [эффект]» смахнуть влево или вправо;
     rush up="…" down="…" — заголовки «- текст >> up|down [эффект]».
   seconds — сколько длится игра (по умолчанию 60). Эффект — что карточка делает с графиком игры:
   на рынке (chart=market a b c d — как у упражнений с графиком) — сдвиг кривой D+ D- S+ S-;
   на КПВ (chart=ppf) — out / in (кривая наружу или внутрь), ox / oy и ix / iy (наружу или внутрь
   только по оси хлеба или станков), x / y (точка едет по кривой к хлебу или к станкам);
   на бюджетной линии (chart=budget) — out / in (доход вырос или упал: сдвиг параллельно),
   ox / ix и oy / iy (товар X или Y подешевел или подорожал: поворот);
   на эластичности (chart=elastic) — in / el (спрос неэластичный: кривая крутая, выручка от
   подорожания растёт; эластичный: кривая пологая, выручка падает).
   Текст до пунктов — условие игры. */
const ROUND_KINDS = ['swipe', 'rush'];
export const ROUND_EFFECTS = { market: ['D+', 'D-', 'S+', 'S-'], ppf: ['out', 'in', 'ox', 'oy', 'ix', 'iy', 'x', 'y'], budget: ['out', 'in', 'ox', 'ix', 'oy', 'iy'], elastic: ['in', 'el'] };
function parseRound(kind, attrs, body) {
  if (!ROUND_KINDS.includes(kind)) throw new Error(`Неизвестный раунд :::round ${kind}`);
  if (!attrs.id) throw new Error(`У игры ${kind} нет id`);
  const chart = attrs.chart || null;
  if (chart && !ROUND_EFFECTS[chart]) throw new Error(`В игре ${attrs.id} неизвестный график ${chart}`);
  const item = (l) => /^-\s/.test(l.trim());
  const g = { type: 'round', kind, id: attrs.id, title: attrs.title || '', chart, ...(chart === 'market' ? { market: market(attrs) } : {}), prompt: parseBlocks(body.filter((l) => !item(l)).join('\n')), seconds: attrs.seconds ? Number(attrs.seconds) : null };
  const sides = kind === 'swipe' ? ['left', 'right'] : ['up', 'down'];
  g.labels = Object.fromEntries(sides.map((k) => [k, attrs[k] || k]));
  g.items = body.filter(item).map((l) => {
    const [t, tail = ''] = l.trim().slice(2).split(/\s>>\s/);
    const [side, effect] = tail.trim().split(/\s+/);
    if (!sides.includes(side)) throw new Error(`В игре ${attrs.id}: «${t}» — сторона ${sides.join(' или ')}`);
    if (effect && (!chart || !ROUND_EFFECTS[chart].includes(effect))) throw new Error(`В игре ${attrs.id}: «${t}» — неизвестный эффект ${effect}`);
    if (chart && !effect) throw new Error(`В игре ${attrs.id}: у «${t}» нет эффекта для графика`);
    return { raw: t.trim(), text: parseInline(t.trim()), side, ...(effect ? { effect } : {}) };
  });
  if (g.items.length < 3) throw new Error(`В игре ${attrs.id} меньше трёх пунктов`);
  return g;
}

/* ------------------------------ ОБХОД ------------------------------ */
// все блоки дерева, включая вложенные (врезки, условия и решения задач)
export function walkBlocks(blocks, fn) {
  blocks.forEach((b) => {
    fn(b);
    if (b.children) walkBlocks(b.children, fn);
    if (b.statement) walkBlocks(b.statement, fn);
    if (b.solution) walkBlocks(b.solution, fn);
    if (b.more) walkBlocks(b.more, fn);
    if (b.question) walkBlocks(b.question, fn);
    if (b.type === 'ex' || b.type === 'round') { walkBlocks(b.prompt, fn); if (b.explain) walkBlocks(b.explain, fn); }
    if (b.type === 'recall') walkBlocks(b.answer, fn);
  });
}
const inlinesOf = (b) => [
  ...(b.inline ? [b.inline] : []), ...(b.type === 'ex' || b.type === 'round' ? [] : b.items || []), ...(b.head || []), ...((b.rows || []).flat()), ...(b.caption ? [b.caption] : []),
  ...(b.steps || []).flatMap((st) => [st.title, st.up, st.down]), ...(b.hints || []), ...(b.points || []),
  ...(b.traps || []).map((t) => t.text || t.why).filter(Boolean),
  ...(b.type === 'idea' ? [b.text] : []),
  ...(b.type === 'ex' || b.type === 'round' ? [...(b.options || []).flatMap((o) => [o.text, o.why]), ...(b.items || []).map((x) => x.text), ...(b.pairs || []).flat().map((x) => x.text),
    ...(b.links || []).map((x) => x.text), ...(b.decoys || []).flatMap((x) => [x.text, x.why])].filter(Boolean) : []),
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

// ловушки числовой задачи, в которые попали ответы шагов (неверные шаги, совпавшие с ловушкой)
export function matchTraps(block, inputs) {
  return (block.traps || []).filter((tr) => {
    const pt = block.parts[tr.part];
    const input = inputs[tr.part];
    // ловушка ловит и округлённый ответ: допуск — не меньше 1% её значения
    const tol = Math.max(pt.tol || 0, 0.01 * Math.abs(tr.value));
    return !checkAnswer(input, pt.answer, pt.tol, pt.unit).ok && checkAnswer(input, tr.value, tol, pt.unit).ok;
  });
}
