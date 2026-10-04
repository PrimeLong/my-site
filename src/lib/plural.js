// склонение по числу: plural(1, 'урок', 'урока', 'уроков') → «урок», 3 → «урока», 11 → «уроков»
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 10; const b = Math.abs(n) % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
