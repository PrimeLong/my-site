/* СЛЕПОЙ ПРОГНОЗ ИНФЛЯЦИИ. Перед ходом игрок записывает, какой будет инфляция через
   четыре квартала (в конце квартала q + 3, считая текущий), — до того как увидит, чем
   кончится его решение. Когда этот квартал наступает, прогноз сверяется с фактом.
   Рядом — наивный прогноз «инфляция останется как сейчас»: его на удивление трудно
   обыграть, и это само по себе урок про инерцию цен и адаптивные ожидания. */
export const FORECAST_HORIZON = 4;

// новый прогноз перед кварталом q; naive — инфляция, известная в момент прогноза
export function makeForecast(q, value, naive) {
  return { madeQ: q, targetQ: q + FORECAST_HORIZON - 1, value, naive };
}

// сверить прогнозы, чей квартал наступил; возвращает новый список и только что сверенные
export function resolveForecasts(list, q, actual) {
  const fresh = [];
  const next = (list || []).map((f) => {
    if (f.actual != null || f.targetQ !== q) return f;
    const r = { ...f, actual, error: f.value - actual, naiveError: f.naive - actual };
    fresh.push(r);
    return r;
  });
  return { list: next, fresh };
}

// средняя абсолютная ошибка: ваша и наивная
export function forecastStats(list) {
  const done = (list || []).filter((f) => f.actual != null);
  if (!done.length) return null;
  const mae = done.reduce((a, f) => a + Math.abs(f.error), 0) / done.length;
  const naiveMae = done.reduce((a, f) => a + Math.abs(f.naiveError), 0) / done.length;
  return { n: done.length, mae, naiveMae, beatNaive: done.filter((f) => Math.abs(f.error) < Math.abs(f.naiveError)).length };
}
