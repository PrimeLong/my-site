/* КАРТА ЭКРАНОВ обучения: откуда экран открывается и куда ведёт его «назад». Корни — вкладки
   нижней панели (у них «назад» нет); у остальных ровно один «назад» (data-nav="back"), и он
   ведёт туда, откуда пришли. Переходы помечены data-nav-target: на одном экране нет двух
   путей в одно место (e2e «навигация» обходит эту карту и проверяет оба правила).
   testid — как экран узнаётся на странице. */
export const SCREENS = {
  // без аккаунта — только эти экраны
  welcome: { gate: true, root: true, title: 'Приветствие', testid: 'welcome' },
  'welcome-goal': { gate: true, from: ['welcome'], back: 'welcome', title: 'Цель и минуты', testid: 'welcome-goal' },
  'welcome-register': { gate: true, from: ['welcome-goal'], back: 'welcome-goal', title: 'Регистрация', testid: 'welcome-register' },
  'welcome-login': { gate: true, from: ['welcome'], back: 'welcome', title: 'Вход', testid: 'welcome-login' },
  'welcome-recover': { gate: true, from: ['welcome-login'], back: 'welcome-login', title: 'Новый пароль по коду', testid: 'welcome-recover' },
  // после входа: вкладки нижней панели
  path: { root: true, title: 'Путь', testid: 'path' },
  tasks: { root: true, title: 'Задания', testid: 'tasks' },
  // вкладка «Учебник»: оглавление — корень; глава из оглавления — «назад» в оглавление
  bookTab: { root: true, title: 'Учебник', testid: 'book-tab' },
  shop: { root: true, title: 'Лавка', testid: 'shop' },
  world: { root: true, title: 'Мир', testid: 'world' },
  profile: { root: true, title: 'Профиль', testid: 'learn-profile' },
  // поверх вкладок
  lessonCard: { from: ['path'], back: 'path', title: 'Карточка урока', testid: 'lesson-sheet' },
  lesson: { from: ['lessonCard', 'path', 'tasks'], back: 'origin', title: 'Урок', testid: 'lesson' },
  bookPage: { from: ['bookTab'], back: 'bookTab', title: 'Страница учебника', testid: 'book-tab' },
  book: { from: ['path', 'tasks', 'profile', 'lesson', 'lessonCard'], back: 'origin', title: 'Учебник поверх экрана', testid: 'learn-book' },
  account: { from: ['profile'], back: 'profile', title: 'Аккаунт', testid: 'account' },
  chest: { from: ['path'], back: 'path', title: 'Сундук юнита', testid: 'chest-sheet' },
  // только у владельцев (OWNER_LOGINS): список сообщений об ошибках
  reports: { from: ['profile'], back: 'profile', owner: true, title: 'Сообщения об ошибках', testid: 'reports' },
};
export const TABS = Object.keys(SCREENS).filter((k) => SCREENS[k].root && !SCREENS[k].gate);
