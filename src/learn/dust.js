/* ПЫЛЬНАЯ ВИТРИНА — мини-игра лавки (docs/mechanics.md, «Лавка»). Стекло витрины запылилось: ученик
   протирает его мышью или пальцем, под пылью — Инфля в вещи с витрины дня. Протёр — немного монет:
   DUST.coins за витрину, до DUST.perDay витрин в день (ключи dust:<день>:<n> в learn.claimed — общие
   для всех устройств, второй раз ту же витрину не оплатить). Сверх того протирать можно просто так.

   Модель стекла — сетка клеток с уровнем пыли от 0 до 1. Тряпка — круг радиуса r: под ней пыль
   убывает в (1 − wipe·(1 − d/r)) раз, сильнее в середине — так же, как холст стирает пыль радиальной
   кистью. Чистая клетка — пыли меньше DUST.thr; витрина протёрта, когда чистых DUST.clean. За один
   проход середина ещё мутная — нужно пройтись дважды: в этом и есть «тереть». Модуль чистый. */
import { earn, hasClaim, shopDay } from './rewards.js';
import { dayOf } from '../textbook/learn-state.js';

export const DUST = { coins: 3, perDay: 3, clean: 0.9, wipe: 0.65, thr: 0.25 };

export const dustKey = (day, n) => `dust:${day}:${n}`;
// сколько витрин уже оплачено сегодня и сколько ещё можно
export function dustDone(s, now = Date.now()) {
  const day = dayOf(now);
  let n = 0;
  for (let k = 1; k <= DUST.perDay; k += 1) if (hasClaim(s, dustKey(day, k))) n += 1;
  return n;
}
export const dustLeft = (s, now = Date.now()) => DUST.perDay - dustDone(s, now);
// монеты за протёртую витрину — в первый свободный слот дня; все заняты — ничего
export function dustClaim(s, now = Date.now()) {
  const day = dayOf(now);
  for (let k = 1; k <= DUST.perDay; k += 1) if (!hasClaim(s, dustKey(day, k))) return earn(s, DUST.coins, dustKey(day, k), now);
  return s;
}
// что под пылью: n-я витрина дня — n-я вещь витрины дня; всё уже куплено — Инфля без обновки
export function dustItem(s, day, n = 0) {
  const list = shopDay(s, day).showcase;
  return list.length ? list[n % list.length] : null;
}

// сетка стекла: w×h — размер в точках, cell — сторона клетки; level(x, y) — пыль в точке (0…1)
export function dustGrid(w, h, cell, level = () => 1) {
  const cols = Math.max(1, Math.ceil(w / cell)); const rows = Math.max(1, Math.ceil(h / cell));
  const v = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) v[r * cols + c] = level((c + 0.5) * cell, (r + 0.5) * cell);
  return { cols, rows, cell, v };
}
// один мазок тряпки в точке (x, y)
export function wipeAt(g, x, y, r, strength = DUST.wipe) {
  const c0 = Math.max(0, Math.floor((x - r) / g.cell)); const c1 = Math.min(g.cols - 1, Math.floor((x + r) / g.cell));
  const r0 = Math.max(0, Math.floor((y - r) / g.cell)); const r1 = Math.min(g.rows - 1, Math.floor((y + r) / g.cell));
  for (let row = r0; row <= r1; row += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const d = Math.hypot((c + 0.5) * g.cell - x, (row + 0.5) * g.cell - y);
      if (d < r) g.v[row * g.cols + c] *= 1 - strength * (1 - d / r);
    }
  }
}
// мазки вдоль движения тряпки: через треть радиуса, без начальной точки (она уже протёрта)
export function stampsAlong(x0, y0, x1, y1, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (r / 3)));
  return Array.from({ length: n }, (_, k) => [x0 + ((x1 - x0) * (k + 1)) / n, y0 + ((y1 - y0) * (k + 1)) / n]);
}
// доля чистого стекла
export function cleanShare(g, thr = DUST.thr) {
  let n = 0;
  for (let i = 0; i < g.v.length; i += 1) if (g.v[i] < thr) n += 1;
  return n / g.v.length;
}
// что показать ученику: 100% — витрина протёрта (порог DUST.clean, а не всё до последней клетки)
export const shownPercent = (share) => Math.min(100, Math.floor((share / DUST.clean) * 100));
