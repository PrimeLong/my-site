/* «ПОЧЕМУ КАЗИНО ВСЕГДА В ПЛЮСЕ» — блок Лаборатории (src/trainer.jsx). Модуль чистый: его
   читают тесты. Ставок в игре нет: ученик не играет, а смотрит, что закон больших чисел делает
   с гостями казино на 10, 100 и 1000 ставках.

   Игры — с честными правилами и известной вероятностью:
   • рулетка, ставка на красное: 18 красных из 37 ячеек (есть зелёный ноль), выигрыш 1 к 1;
   • бинарный опцион «цена через минуту выше или ниже»: угадать — 50 на 50, а платят 85% от
     ставки при выигрыше и забирают 100% при проигрыше.
   Средний результат одной ставки (матожидание) у обеих отрицательный: −1/37 и −7,5%. */
import { seeded } from '../textbook/variants.js';

export const GAMES = {
  roulette: { id: 'roulette', title: 'Рулетка, ставка на красное', p: 18 / 37, win: 1, lose: -1 },
  binary: { id: 'binary', title: 'Бинарный опцион «выше или ниже»', p: 0.5, win: 0.85, lose: -1 },
};
export const SCALES = [10, 100, 1000];

// средний результат одной ставки в долях ставки: p·выигрыш + (1 − p)·проигрыш
export const expectedValue = (g) => g.p * g.win + (1 - g.p) * g.lose;

/* Один гость делает n ставок по 1 кроне. Путь — средний результат на ставку после каждой
   ставки: он скачет в начале и прижимается к матожиданию к концу. */
export function simulateGuest(g, n, rand) {
  let total = 0;
  const path = [];
  for (let k = 1; k <= n; k += 1) {
    total += rand() < g.p ? g.win : g.lose;
    path.push(total / k);
  }
  return { total, path };
}

/* Точки графика: несколько гостей (зёрна подряд от seed), x — номер ставки. Точек меньше, чем
   ставок: на 1000 ставках хватает 80 — дальше линия не меняется на глаз. */
export function convergence(g, n, guests = 5, seed = 1) {
  const runs = Array.from({ length: guests }, (_, i) => simulateGuest(g, n, seeded(seed * 101 + i + 1)).path);
  const step = Math.max(1, Math.ceil(n / 80));
  const xs = [];
  for (let k = 1; k <= n; k += (k < 10 ? 1 : step)) xs.push(k);
  if (xs[xs.length - 1] !== n) xs.push(n);
  return xs.map((k) => {
    const row = { k };
    runs.forEach((p, i) => { row[`g${i}`] = p[k - 1] * 100; });
    return row;
  });
}

// ln C(n, k) — для точной биномиальной суммы без переполнения на 1000 ставках
function lnChoose(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i += 1) s += Math.log((n - k + i) / i);
  return s;
}
/* Какая доля гостей после n ставок в плюсе — точно, по биномиальному закону: в плюсе, если
   выигрышей W столько, что W·выигрыш + (n − W)·проигрыш > 0. */
export function shareAhead(g, n) {
  let s = 0;
  for (let w = 0; w <= n; w += 1) {
    if (w * g.win + (n - w) * g.lose <= 1e-9) continue;
    s += Math.exp(lnChoose(n, w) + w * Math.log(g.p) + (n - w) * Math.log(1 - g.p));
  }
  return s;
}

/* Строка таблицы: сколько в среднем остаётся у казино со 100 крон ставок и какая доля гостей
   ещё в плюсе. */
export function scaleRow(g, n) {
  return { n, house: -expectedValue(g) * n, ahead: shareAhead(g, n) };
}
