/* КАРТА ЭКРАНОВ обучения: откуда экран открывается и куда ведёт его «назад». Корни — вкладки
   нижней панели (у них «назад» нет); у остальных ровно один «назад» (data-nav="back"), и он
   ведёт туда, откуда пришли. Переходы помечены data-nav-target: на одном экране нет двух
   путей в одно место (e2e «навигация» обходит эту карту и проверяет оба правила).
   testid — как экран узнаётся на странице. */
export const SCREENS = {
  // без аккаунта — эти экраны; после цели гость сразу попадает в первый урок (src/lib/guest.js),
  // а регистрация открывается с Пути или итогов урока — «Сохраните прогресс»
  welcome: { gate: true, root: true, title: 'Приветствие', testid: 'welcome' },
  'welcome-goal': { gate: true, from: ['welcome'], back: 'welcome', title: 'Цель и минуты', testid: 'welcome-goal' },
  'welcome-register': { gate: true, from: ['path', 'lesson'], back: 'path', title: 'Регистрация', testid: 'welcome-register' },
  'welcome-login': { gate: true, from: ['welcome'], back: 'welcome', title: 'Вход', testid: 'welcome-login' },
  'welcome-recover': { gate: true, from: ['welcome-login'], back: 'welcome-login', title: 'Новый пароль по коду', testid: 'welcome-recover' },
  // после входа: вкладки нижней панели
  path: { root: true, title: 'Путь', testid: 'path' },
  // вкладка «Учебник»: оглавление — корень; глава из оглавления — «назад» в оглавление
  bookTab: { root: true, title: 'Учебник', testid: 'book-tab' },
  shop: { root: true, title: 'Лавка', testid: 'shop' },
  world: { root: true, title: 'Мир', testid: 'world' },
  profile: { root: true, title: 'Профиль', testid: 'learn-profile' },
  // поверх вкладок
  // «Задания» — не вкладка, а экран поверх Пути: карточка наверху Пути
  tasks: { from: ['path'], back: 'path', title: 'Задания', testid: 'tasks' },
  lessonCard: { from: ['path'], back: 'path', title: 'Карточка урока', testid: 'lesson-sheet' },
  lesson: { from: ['lessonCard', 'path', 'tasks'], back: 'origin', title: 'Урок', testid: 'lesson' },
  bookPage: { from: ['bookTab'], back: 'bookTab', title: 'Страница учебника', testid: 'book-tab' },
  book: { from: ['path', 'tasks', 'profile', 'lesson', 'lessonCard'], back: 'origin', title: 'Учебник поверх экрана', testid: 'learn-book' },
  account: { from: ['profile'], back: 'profile', title: 'Аккаунт', testid: 'account' },
  chest: { from: ['path'], back: 'path', title: 'Сундук юнита', testid: 'chest-sheet' },
  // только у владельцев (OWNER_LOGINS): список сообщений об ошибках
  reports: { from: ['profile'], back: 'profile', owner: true, title: 'Сообщения об ошибках', testid: 'reports' },
  // и аналитика без персональных данных: воронка и трудные упражнения (api/events.js)
  analytics: { from: ['profile'], back: 'profile', owner: true, title: 'Аналитика', testid: 'analytics' },
};
export const TABS = Object.keys(SCREENS).filter((k) => SCREENS[k].root && !SCREENS[k].gate);
