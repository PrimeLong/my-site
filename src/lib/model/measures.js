/* ОДНА МЕРА ДЛЯ МОДЕЛИ И ИСТОРИИ. Модель считает темпы роста ВВП и цен за квартал в
   годовом выражении (квартал к кварталу, ×4 в сложных процентах) — так их видит ЦБ
   каждый квартал. Реальная статистика в исторической тени — год к году. Сравнивать их
   напрямую нельзя: квартальный темп дёргается, годовой сглажен и запаздывает.
   yoyFromAnnualized переводит ряд модели в «год к году»: произведение четырёх
   последних квартальных темпов. Пока истории меньше года — годовой темп по тем
   кварталам, что есть. */
export const YOY_KEYS = ['gdpGrowth', 'inflation', 'coreInflation'];

export function yoyFromAnnualized(values) {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - 3), i + 1).filter(Number.isFinite);
    if (!win.length) return null;
    const prod = win.reduce((a, v) => a * Math.pow(Math.max(1e-6, 1 + v / 100), 0.25), 1);
    return (Math.pow(prod, 4 / win.length) - 1) * 100;
  });
}
