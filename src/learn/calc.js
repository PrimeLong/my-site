/* КАЛЬКУЛЯТОР для расчётных упражнений: разбор выражения без eval.
   Числа с запятой или точкой, + − × ÷, скобки, унарный минус, степень ^ (для x²), корень √
   (перед числом или скобкой: √16, √(9+16) — или, как на обычном калькуляторе, после числа:
   набрали 16, нажали √ — получили 4; см. pressRoot).
   evalExpr возвращает число или null, если выражение неполное или делится на ноль. */
const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', ':': '/', '^': '^', '√': '√', '(': '(', ')': ')' };
export function tokenize(src) {
  const out = []; let i = 0;
  const s = String(src).replace(/\s+/g, '');
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.,]/.test(ch)) {
      let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j += 1;
      const n = Number(s.slice(i, j).replace(',', '.'));
      if (!Number.isFinite(n) || (s.slice(i, j).match(/[.,]/g) || []).length > 1) return null;
      out.push({ t: 'n', v: n }); i = j;
    } else if (OPS[ch]) { out.push({ t: OPS[ch] }); i += 1; } else return null;
  }
  return out;
}
export function evalExpr(src) {
  const toks = tokenize(src);
  if (!toks || !toks.length) return null;
  let p = 0;
  const peek = () => toks[p] && toks[p].t;
  const expr = () => {
    let v = term(); if (v == null) return null;
    while (peek() === '+' || peek() === '-') { const op = toks[p++].t; const r = term(); if (r == null) return null; v = op === '+' ? v + r : v - r; }
    return v;
  };
  const term = () => {
    let v = power(); if (v == null) return null;
    while (peek() === '*' || peek() === '/') { const op = toks[p++].t; const r = power(); if (r == null) return null; if (op === '/' && r === 0) return null; v = op === '*' ? v * r : v / r; }
    return v;
  };
  const power = () => {
    const b = unary(); if (b == null) return null;
    if (peek() === '^') { p += 1; const e = power(); if (e == null) return null; const v = b ** e; return Number.isFinite(v) ? v : null; }
    return b;
  };
  const unary = () => {
    if (peek() === '-') { p += 1; const v = unary(); return v == null ? null : -v; }
    if (peek() === '+') { p += 1; return unary(); }
    // корень из отрицательного числа не берётся — выражение неполное, как деление на ноль
    if (peek() === '√') { p += 1; const v = unary(); return v == null || v < 0 ? null : Math.sqrt(v); }
    if (peek() === 'n') return toks[p++].v;
    if (peek() === '(') { p += 1; const v = expr(); if (v == null || peek() !== ')') return null; p += 1; return v; }
    return null;
  };
  const v = expr();
  return v == null || p !== toks.length || !Number.isFinite(v) ? null : v;
}
// число для поля ответа: до четырёх знаков после запятой, запятая, лишние нули убраны
export const fmtResult = (v) => String(Math.round(v * 10000) / 10000).replace('.', ',').replace('-', '−');
/* Кнопка √ как на обычном калькуляторе: если выражение кончается числом — корень из этого
   числа сразу (16 → 4, 9+16 → 9+4); кончается скобкой — корень из скобки (… (9+16) → …√(9+16));
   иначе (пусто или после знака) — знак корня перед следующим числом, как раньше. */
export function pressRoot(expr) {
  const s = String(expr);
  // число в конце (с уже стоящими перед ним знаками корня: √16 и ещё √ → 2)
  const m = s.match(/(√*)(\d+(?:[.,]\d+)?)$/);
  if (m) {
    let v = Number(m[2].replace(',', '.'));
    for (let k = 0; k <= m[1].length; k += 1) v = Math.sqrt(v);
    return s.slice(0, -m[0].length) + fmtResult(v).replace('−', '-');
  }
  if (s.endsWith(')')) {
    let depth = 0;
    for (let i = s.length - 1; i >= 0; i -= 1) {
      if (s[i] === ')') depth += 1;
      if (s[i] === '(') { depth -= 1; if (depth === 0) return `${s.slice(0, i)}√${s.slice(i)}`; }
    }
  }
  return `${s}√`;
}
