/* УРОВНИ курса: пять ступеней, от терминов до полноценного анализа. По ним идёт Путь
   (src/learn/course.js) и сгруппировано оглавление учебника (src/textbook/toc.js): глава учебника
   и юнит Пути — одно и то же место, на одном уровне и в одном порядке. */
export const LEVELS = [
  { id: 'start', title: 'Начальный', text: 'Вы знаете основные термины: деньги, цена, доход, расход.' },
  { id: 'basic', title: 'Базовый', text: 'Вы понимаете спрос, предложение, рынок, налоги, инфляцию.' },
  { id: 'middle', title: 'Средний', text: 'Вы умеете анализировать графики, бюджет, прибыль и экономические ситуации.' },
  { id: 'advanced', title: 'Продвинутый', text: 'Вы понимаете экономические модели, статистику и сложные процессы.' },
  { id: 'pro', title: 'Профессиональный', text: 'Вы умеете проводить полноценный экономический анализ.' },
];
export const UNIT_LEVEL = {
  scarcity: 'start',
  'supply-demand': 'basic', elasticity: 'basic', 'market-failures': 'basic', 'money-banks': 'basic', inflation: 'basic',
  consumer: 'middle', production: 'middle', costs: 'middle', 'competition-monopoly': 'middle', monopolistic: 'middle', labor: 'middle',
  oligopoly: 'advanced', gdp: 'advanced', 'is-lm': 'advanced', 'ad-as': 'advanced', phillips: 'advanced',
  policy: 'pro', growth: 'pro', 'open-economy': 'pro', 'public-debt': 'pro', inequality: 'pro',
};
