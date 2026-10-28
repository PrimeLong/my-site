/* ВОЗМОЖНОСТИ ОТКРЫВАЮТСЯ ПОСТЕПЕННО (docs/mechanics.md, «Открытия»): новичку не показываем всё сразу —
   лиги, лавка, копилка, сад и «Мир» открываются по мере пройденных уроков, каждое — своей церемонией-знакомством
   (как антистресс в уроке). До открытия вкладка на месте, но с замком: касание — что там будет и после
   какого урока откроется. Считаются пройденные уроки; юнит, сданный проверкой (вступительный тест или
   тест уровня), — за пять уроков: знающий курс не ждёт. Модуль чистый: его читают нижняя панель, лавка,
   церемонии (src/learn/celebrate.js) и тесты. */

export const TESTED_WEIGHT = 5;
export const UNLOCKS = [
  { id: 'league', lessons: 1, title: 'Лиги', icon: 'trophy', color: '#B8860B',
    text: 'Каждую неделю — группа из двадцати учеников. Опыт за уроки поднимает вас в таблице, первые пять переходят в лигу выше.' },
  { id: 'shop', lessons: 2, title: 'Лавка', icon: 'shop', color: '#C2490B',
    text: 'Монеты за уроки тратятся здесь: наряды для Инфли, украшения и темы урока, страховка серии.' },
  { id: 'piggy', lessons: 4, title: 'Копилка', icon: 'piggy', color: '#C2577A', where: 'в Лавке, отдел «Полезное»',
    text: 'Положите монеты на неделю — вернутся с процентами. Ставка своя каждую неделю.' },
  { id: 'garden', lessons: 6, title: 'Сад', icon: 'sprout', color: '#4D7C0F', where: 'в Лавке, переключатель «Сад»',
    text: 'Посадите семена и поливайте — урожай можно продать дороже, чем стоили семена. Цена урожая меняется.' },
  // «Мир» — экономическая игра: когда за плечами уже десяток уроков, решения в ней понятны
  { id: 'world', lessons: 10, title: 'Мир', icon: 'globe', color: '#2E5E8C', where: 'в меню «⋯»',
    text: 'Экономическая игра: управляйте страной, своим делом и рынками — то, что узнали на уроках, в деле.' },
];
export const UNLOCK_BY_ID = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

/* Когда что засчитано: пройденный урок — когда впервые пройден, юнит, сданный проверкой, — пятью
   «уроками» в момент сдачи. По времени — чтобы знать, когда открылась каждая возможность. */
function steps(learn) {
  const out = [];
  Object.values((learn && learn.lessons) || {}).forEach((l) => { if (l && l.runs > 0) out.push(l.at || 0); });
  Object.values((learn && learn.units) || {}).forEach((u) => { if (u && u.tested) for (let k = 0; k < TESTED_WEIGHT; k += 1) out.push(u.tested); });
  return out.sort((a, b) => a - b);
}
export const progressOf = (learn) => steps(learn).length;
export const isUnlocked = (learn, id) => !UNLOCK_BY_ID[id] || progressOf(learn) >= UNLOCK_BY_ID[id].lessons;
// сколько уроков осталось до открытия (0 — открыто)
export const lessonsLeft = (learn, id) => Math.max(0, ((UNLOCK_BY_ID[id] || {}).lessons || 0) - progressOf(learn));
// открытые возможности с моментом открытия — для церемоний
export function unlockedAt(learn) {
  const s = steps(learn);
  return UNLOCKS.filter((u) => s.length >= u.lessons).map((u) => ({ ...u, at: s[u.lessons - 1] }));
}
