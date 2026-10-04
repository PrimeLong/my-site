/* ГЕРОИ «ИСТОРИЙ» И «СЛУШАЙ» — по библии мира (docs/world.md): одни и те же люди проходят
   через юниты. Шаг истории с who=… говорит голосом героя, от первого лица; шаг без who —
   авторский текст рассказчика (narrator), в эфире — голос ведущей Лады (host). Портрет рисует
   src/learn-play.jsx (цвет, значок, причёска); у рассказчика вместо лица — перо. */
export const CAST = {
  masha: { name: 'Маша', role: 'кофейня «Зерно»', color: '#C2410C', icon: 'coffee', hair: '#5B3A1E' },
  grisha: { name: 'Гриша', role: 'пекарня на углу', color: '#B7791F', icon: 'croissant', hair: '#2F2A24' },
  oleg: { name: 'Олег', role: 'кредитный отдел «Златобанка»', color: '#1D4ED8', icon: 'landmark', hair: '#1F2937' },
  vera: { name: 'Вера Павловна', role: 'министерство экономики', color: '#6D28D9', icon: 'scroll-text', hair: '#9CA3AF' },
  timur: { name: 'Тимур', role: 'абитуриент, бариста по выходным', color: '#0F766E', icon: 'graduation', hair: '#1C1917' },
  host: { name: 'Лада Звонарёва', role: 'радио «Волна Велеграда»', color: '#BE185D', icon: 'radio', hair: '#7C2D12' },
  narrator: { name: 'Рассказчик', role: 'истории Велеграда', color: '#57534E', icon: 'feather', hair: null, nofs: true },
};
// голос по умолчанию: в истории шаг без героя — рассказчик, в эфире — ведущая
export const DEFAULT_VOICE = { story: 'narrator', listen: 'host' };
