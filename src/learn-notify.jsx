/* УВЕДОМЛЕНИЯ И НОВОСТИ (docs/mechanics.md, «Новости и уведомления»).

   Колокольчик на Пути и в профиле — сколько нового; центр уведомлений поверх экрана — «Новые» и
   «Ранее», касание ведёт туда, где можно действовать (урок, лига, сад, копилка, задания, новости).
   Всплывающая плашка сверху — когда что-то случилось, пока приложение открыто (обогнали в лиге,
   созрел урожай, цель дня выполнена). Напоминания в браузере — по желанию, из настроек: пока
   вкладка Инфляции открыта (пусть и в фоне), в выбранный час придёт напоминание о серии, а ещё —
   «вас обогнали», «созрело», «вклад готов».

   Лента «Новости» — вкладка под «⋯»: выпуски «Что нового» (src/learn/news.js), свежий — первым и
   развёрнутым, прочитанные — без отметки «новое». Список уведомлений выводит src/learn/notify.js. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, BellRing, ArrowLeft, ChevronRight, CheckCheck, X, Flame, Map as MapIcon, Target, Trophy, TrendingDown, ArrowDown, ArrowUp, Hourglass, Sprout, Droplet, PiggyBank,
  Package, Repeat, CalendarDays, ShieldCheck, ShieldAlert, Newspaper, Sparkles, Croissant, Stamp, Scale, Moon, Palette, MonitorSmartphone, Headphones, BookOpen, Landmark, BarChart3,
  Gauge, Store, Anchor, Shirt, WandSparkles, Settings,
  Ghost, Users, Flag, UserPlus, Gem,
  Wallet, MessageCircle, Lamp, Coins, TrendingUp, Gamepad2, Lock, Globe,
} from 'lucide-react';
import { IconButton, TopBar } from './ds.jsx';
import { useReducedMotion } from './ds-art.jsx';
import { Mascot } from './mascot.jsx';
import { Audio, useAccount } from './MacroSimulator.jsx';
import { notificationsOf, unreadOf, readSeen, markSeen, readPrefs, writePrefs, firstDayOf, agoText, readPushed, markPushed, readToasted, markToasted } from './learn/notify.js';
import { leagueState, LEAGUE_BY_ID } from './learn/league.js';
import { useFriends } from './lib/friends-store.js';
import { loadProgress, reviewQueue } from './textbook/progress.js';
import { markShown, shownWith } from './textbook/learn-state.js';

export const NOTIFY_CSS = `
  /* колокольчик: квадратная кнопка рядом со счётчиками; новое — точка-счётчик и лёгкое покачивание */
  .nt-bell { position: relative; flex: none; width: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ds-rule2); border-radius: 10px;
    background: var(--ds-card); color: var(--ds-ink2); cursor: pointer; padding: 0; min-height: 36px; transition: transform .12s ease, background .15s; }
  .nt-bell:hover { background: var(--ds-card2); }
  .nt-bell:active { transform: scale(.92); }
  .nt-bell[data-unread="true"] { color: var(--u-ink); border-color: color-mix(in srgb, var(--u) 45%, var(--ds-rule2)); }
  .nt-bell[data-unread="true"] svg { animation: nt-ring 2.6s ease-in-out 1s infinite; transform-origin: 50% 10%; }
  .nt-bell b { position: absolute; top: -6px; right: -6px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 10px; background: var(--ds-bad-btn); color: #fff;
    font: 700 12px/19px var(--ds-sans); text-align: center; box-shadow: 0 0 0 2px var(--ds-paper); animation: nt-pop .35s cubic-bezier(.3,1.6,.5,1) both; }
  @keyframes nt-ring { 0%, 70%, 100% { transform: rotate(0) } 74% { transform: rotate(14deg) } 79% { transform: rotate(-12deg) } 84% { transform: rotate(8deg) } 89% { transform: rotate(-5deg) } 94% { transform: rotate(2deg) } }
  @keyframes nt-pop { 0% { transform: scale(0) } 100% { transform: scale(1) } }

  /* страница поверх экрана: уведомления и всё, что открывается из профиля */
  /* страница — без transform (иначе fixed-шторки внутри неё прокручивались бы с ней); съезжает её содержимое */
  /* под нижней панелью вкладок (у неё z-index 120): вкладки остаются под рукой, касание вкладки закрывает страницу */
  .nt-page { position: fixed; inset: 0; z-index: 110; overflow-y: auto; background: var(--ds-paper); padding: 8px 16px calc(100px + env(safe-area-inset-bottom)); animation: nt-fade .22s ease-out; }
  /* под окном (марка, аккаунт): страница замирает — не прокручивается и не ловит фокус */
  .nt-page.nt-under { overflow: hidden; }
  .nt-page-in { max-width: 560px; margin: 0 auto; animation: nt-page-in .3s cubic-bezier(.2,.9,.3,1); }
  @keyframes nt-fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes nt-page-in { from { transform: translateY(18px) } to { transform: none } }
  .nt-readall { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border: none; border-radius: 12px; background: none; color: var(--u-ink); font: 700 14px var(--ds-sans); cursor: pointer; }
  .nt-readall:hover { background: var(--ds-card2); }
  .nt-group { font: 700 12px/1.3 var(--ds-sans); letter-spacing: .14em; text-transform: uppercase; color: var(--ds-ink3); margin: 16px 2px 8px; }
  .nt-item { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 2px 12px; align-items: center; width: 100%; text-align: left; font: inherit; color: inherit;
    background: var(--ds-card); border: 2px solid var(--ds-rule); border-radius: 16px; padding: 11px 12px; margin: 0 0 8px; cursor: pointer; position: relative;
    box-shadow: 0 2px 0 var(--ds-rule); animation: nt-in .38s ease-out backwards; animation-delay: calc(min(var(--i, 0), 10) * 45ms); transition: transform .12s ease, border-color .15s, translate .2s ease;
    touch-action: pan-y; }
  .nt-hint { font-size: 13px; text-align: center; margin: 2px 8px 6px; }
  .nt-item:hover { border-color: var(--ds-rule2); }
  .nt-item:active { transform: translateY(1px) scale(.995); }
  .nt-item[data-unread="true"] { border-color: color-mix(in srgb, var(--t) 40%, var(--ds-rule)); background: color-mix(in srgb, var(--t) 6%, var(--ds-card)); }
  .nt-item[data-unread="true"]::after { content: ''; position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--t); }
  .nt-ico { grid-row: span 2; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: var(--t);
    box-shadow: inset 0 -3px 0 rgba(0,0,0,.14), inset 0 0 0 2px rgba(255,255,255,.18); }
  .nt-title { font: 700 15.5px/1.25 var(--ds-head); padding-right: 14px; }
  .nt-text { font: 14px/1.4 var(--ds-sans); color: var(--ds-ink2); }
  .nt-when { grid-column: 2; font: 12px var(--ds-sans); color: var(--ds-ink3); margin-top: 2px; }
  .nt-go { grid-row: span 2; color: var(--ds-ink3); }
  @keyframes nt-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  .nt-empty { text-align: center; padding: 30px 10px 10px; }

  /* плашка сверху: съезжает вниз, через несколько секунд уезжает сама */
  /* смахивание — жест, а не выделение: текст строки и плашки не выделяется, пока тянешь */
  .nt-item, .nt-toast { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: pan-y; }
  .nt-toast { position: fixed; top: calc(10px + env(safe-area-inset-top)); left: 50%; z-index: 400; width: min(520px, calc(100vw - 24px)); transform: translateX(-50%);
    display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 0 10px; align-items: center; padding: 10px 8px 10px 10px; border-radius: 16px; cursor: pointer;
    background: var(--ds-card); border: 2px solid color-mix(in srgb, var(--t) 45%, var(--ds-rule)); box-shadow: 0 12px 30px -8px rgba(40,20,0,.35);
    animation: nt-drop .45s cubic-bezier(.2,1.3,.4,1) backwards; touch-action: pan-y; transition: translate .2s ease; }
  .nt-toast.out { animation: nt-lift .3s ease-in both; }
  .nt-toast .nt-ico { width: 38px; height: 38px; border-radius: 12px; grid-row: auto; }
  .nt-toast .nt-title { padding: 0; font-size: 15px; }
  .nt-toast .nt-text { font-size: 13.5px; line-height: 1.3; }
  .nt-toast-bar { position: absolute; left: 14px; right: 14px; bottom: 4px; height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--t) 30%, transparent); overflow: hidden; }
  .nt-toast-bar i { display: block; height: 100%; background: var(--t); animation: nt-time 5s linear both; transform-origin: left; }
  @keyframes nt-drop { from { opacity: 0; transform: translate(-50%, -120%) } to { opacity: 1; transform: translate(-50%, 0) } }
  @keyframes nt-lift { to { opacity: 0; transform: translate(-50%, -110%) } }
  @keyframes nt-time { from { transform: scaleX(1) } to { transform: scaleX(0) } }

  /* лента новостей: один поток по дням. Слева — пунктирная нить ленты, на ней аватары записей:
     значок выпуска в его цвете или Инфля друга. Выпуск — карточка с цветной кромкой, запись друга —
     лёгкая плашка-кнопка со значками событий. */
  .nw-hero { display: flex; align-items: center; gap: 12px; margin: 4px 0 8px; }
  .nw-day { position: relative; padding-left: 56px; }
  .nw-day::before { content: ''; position: absolute; left: 21px; top: 0; bottom: 0; width: 2px; background: repeating-linear-gradient(to bottom, var(--ds-rule2) 0 6px, transparent 6px 11px); }
  .nw-feed > .nw-day:first-child::before { top: 18px; }
  .nw-feed > .nw-day:last-child::before { bottom: auto; height: 40px; }
  .nw-day-label { position: relative; display: flex; align-items: center; margin: 8px 0 12px -56px; font: 700 12px/1 var(--ds-sans); letter-spacing: .14em; text-transform: uppercase; color: var(--ds-ink2); }
  .nw-day-label::before { content: ''; flex: none; width: 12px; height: 12px; margin: 0 22px 0 16px; border-radius: 50%; background: var(--ds-paper); box-shadow: 0 0 0 4px var(--ds-paper), inset 0 0 0 2.5px var(--ds-ink3); }
  .nw-day-label::after { content: ''; flex: 1; height: 1px; margin-left: 12px; background: var(--ds-rule); }
  .nw-day:first-child .nw-day-label { margin-top: 2px; }
  /* запись влетает пружинкой, аватар — щелчком; анимации появления — только «до» (backwards): кончившись,
     они не держат прозрачность и сдвиг, и раскрытие, наведение и сворачивание ничем не перебиваются */
  .nw-post { position: relative; margin: 0 0 12px; animation: nw-in .5s cubic-bezier(.2, .9, .3, 1.15) backwards; animation-delay: calc(min(var(--i, 0), 6) * 60ms); }
  @keyframes nw-in { from { opacity: 0; transform: translateY(18px) scale(.97) } }
  .nw-ava { position: absolute; left: -56px; top: 8px; z-index: 1; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
    box-shadow: 0 0 0 4px var(--ds-paper); animation: nw-ava .5s cubic-bezier(.3, 1.6, .5, 1) backwards; animation-delay: calc(min(var(--i, 0), 6) * 60ms + 120ms); }
  @keyframes nw-ava { from { transform: scale(.4) rotate(-20deg); opacity: 0 } }
  .nw-ava-issue { color: #fff; background: color-mix(in srgb, var(--t) 88%, #000); }
  .nw-ava-friend { top: 2px; background: var(--ds-card); box-shadow: 0 0 0 4px var(--ds-paper), inset 0 0 0 2px var(--ds-rule); overflow: hidden; }
  .ds-card.nw-issue { position: relative; overflow: hidden; padding: 0; margin: 0; border-top: 5px solid var(--t); transition: transform .25s cubic-bezier(.2, .9, .3, 1), box-shadow .25s; }
  @media (hover: hover) { .nw-issue:hover { transform: translateY(-3px); box-shadow: 0 6px 0 var(--ds-rule), 0 18px 32px -18px var(--ds-shade); } }
  /* подписи цветом выпуска — притемнённым: на карточке читаются с контрастом не ниже 4,5:1 */
  .nw-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px 0; font: 700 12px/1.2 var(--ds-sans); letter-spacing: .12em; text-transform: uppercase; color: color-mix(in srgb, var(--t) 72%, #000); }
  .ds-dark .nw-meta { color: color-mix(in srgb, var(--t) 40%, #fff); }
  .nw-new { display: inline-block; padding: 3px 8px; border-radius: 999px; background: color-mix(in srgb, var(--t) 85%, #000); color: #fff; font: 700 12px/1 var(--ds-sans); letter-spacing: .06em;
    animation: nt-pop .4s cubic-bezier(.3,1.6,.5,1) .2s backwards, nw-breathe 2.4s ease-out 1s infinite; }
  @keyframes nw-breathe { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--t) 45%, transparent) } 70%, 100% { box-shadow: 0 0 0 7px transparent } }
  .nw-issue .nw-title { margin: 6px 16px 0; font-size: 20px; line-height: 1.25; }
  .nw-lead { padding: 6px 16px 4px; font: 15px/1.5 var(--ds-sans); color: var(--ds-ink); }
  .nw-items { padding: 4px 16px 6px; }
  .nw-items.short { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; padding-bottom: 12px; }
  .nw-items.short .nw-item { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border: none; border-radius: 999px; background: color-mix(in srgb, var(--t) 9%, var(--ds-card)); }
  .nw-items.short .nw-item-ico { width: 24px; height: 24px; border-radius: 50%; background: var(--ds-card); }
  .nw-items.short .nw-item b { font: 600 13.5px/1.25 var(--ds-sans); }
  .nw-item-text { display: block; animation: nt-in .3s ease-out backwards; animation-delay: calc(min(var(--i, 0), 8) * 35ms + 60ms); }
  .nw-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 0 12px; padding: 10px 0; border-top: 1px dotted var(--ds-rule2); animation: nt-in .3s ease-out backwards; animation-delay: calc(min(var(--i, 0), 8) * 35ms); }
  .nw-items.open .nw-item-ico { animation: nw-ico .45s cubic-bezier(.3, 1.6, .5, 1) backwards; animation-delay: calc(min(var(--i, 0), 8) * 35ms + 80ms); }
  @keyframes nw-ico { from { transform: scale(.3) rotate(-25deg); opacity: 0 } }
  .nw-item-ico { transition: transform .25s cubic-bezier(.3, 1.5, .5, 1); }
  .nw-item:hover .nw-item-ico { transform: scale(1.1) rotate(-8deg); }
  .nw-item:first-child { border-top: none; }
  .nw-item-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: var(--t); background: color-mix(in srgb, var(--t) 13%, var(--ds-card)); }
  .ds-dark .nw-item-ico { color: color-mix(in srgb, var(--t) 45%, #fff); }
  .nw-item b { display: block; font: 700 15px/1.3 var(--ds-head); }
  .nw-item span { font: 14px/1.45 var(--ds-sans); color: var(--ds-ink2); }
  .nw-more { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px; border: none; border-top: 1px dotted var(--ds-rule2); background: none;
    font: 700 14px var(--ds-sans); color: var(--u-ink); cursor: pointer; transition: background .2s, letter-spacing .25s; }
  .nw-more:hover { background: color-mix(in srgb, var(--t) 7%, transparent); }
  .nw-more svg { transition: transform .35s cubic-bezier(.3, 1.5, .5, 1); }
  .nw-more:hover:not([aria-expanded="true"]) svg { transform: translateY(2px); }
  .nw-more[aria-expanded="true"] svg { transform: rotate(180deg); }
  /* запись друга: имя и время, ниже — события дня значками */
  .nw-friend { display: block; width: 100%; padding: 9px 14px 11px; border: 2px solid var(--ds-rule); border-radius: 16px; background: color-mix(in srgb, var(--ds-card) 60%, transparent);
    text-align: left; font: inherit; color: inherit; cursor: pointer; transition: border-color .2s, background .2s, transform .25s cubic-bezier(.2, .9, .3, 1); }
  @media (hover: hover) { .nw-friend:hover { border-color: color-mix(in srgb, var(--u) 45%, var(--ds-rule)); background: var(--ds-card); transform: translateX(3px); } }
  .nw-friend:focus-visible { outline: 3px solid var(--u); outline-offset: 2px; }
  .nw-who { display: flex; align-items: baseline; gap: 8px; font: 15px/1.3 var(--ds-sans); }
  .nw-who b { font: 700 16px/1.25 var(--ds-head); }
  .nw-who small { font-size: 12.5px; color: var(--ds-ink2); }
  .nw-evs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
  .nw-ev { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 8px; border-radius: 999px; background: color-mix(in srgb, var(--u) 11%, var(--ds-card)); font: 600 13.5px/1.25 var(--ds-sans); color: var(--ds-ink); }
  .nw-ev svg { flex: none; color: var(--u-ink); }
  .ds-dark .nw-ev svg { color: color-mix(in srgb, var(--u) 50%, #fff); }
  @media (max-width: 420px) { .nw-day { padding-left: 48px; } .nw-day-label { margin-left: -48px; } .nw-day-label::before { margin: 0 18px 0 14px; } .nw-day::before { left: 19px; } .nw-ava { left: -48px; width: 40px; height: 40px; } }
  @media (max-width: 360px) { .nt-bell { width: 34px; } }
  @media (prefers-reduced-motion: reduce) { .nt-bell svg, .nt-bell b, .nt-page, .nt-page-in, .nt-item, .nt-toast, .nt-toast-bar i, .nw-post, .nw-ava, .nw-item, .nw-item-text, .nw-item-ico, .nw-new { animation: none !important; } .nw-issue, .nw-item-ico, .nw-friend { transition: none; } }
`;

// значки уведомлений и новостей: имя → компонент
const ICON = {
  flame: Flame, map: MapIcon, target: Target, trophy: Trophy, 'trending-down': TrendingDown, 'arrow-down': ArrowDown, 'arrow-up': ArrowUp, hourglass: Hourglass,
  sprout: Sprout, droplet: Droplet, piggy: PiggyBank, chest: Package, repeat: Repeat, calendar: CalendarDays, shield: ShieldCheck, 'shield-alert': ShieldAlert, newspaper: Newspaper,
  sparkles: Sparkles, croissant: Croissant, stamp: Stamp, scale: Scale, moon: Moon, palette: Palette, devices: MonitorSmartphone, headphones: Headphones, book: BookOpen,
  landmark: Landmark, chart: BarChart3, gauge: Gauge, store: Store, anchor: Anchor, shirt: Shirt, wand: WandSparkles, bell: Bell, settings: Settings,
  pumpkin: Ghost, ghost: Ghost, fire: Flame, users: Users, flag: Flag, 'user-plus': UserPlus, gem: Gem, wallet: Wallet, message: MessageCircle,
  lamp: Lamp, coins: Coins, 'trending-up': TrendingUp, game: Gamepad2, lock: Lock, globe: Globe,
};
export const NIcon = ({ name, size = 20, ...rest }) => { const I = ICON[name] || Bell; return <I size={size} aria-hidden="true" {...rest} />; };

/* Уведомления для экранов: список к текущей минуте (обновляется раз в минуту и при возвращении на
   вкладку), непрочитанные, настройки. leaguePlace — место в лиге сейчас (для плашки «вы поднялись»). */
/* Прочитанное и показанное плашкой — и на устройстве (быстро), и в профиле (learn.shown, n: и t:):
   прочитали уведомление на ПК — на телефоне оно уже не «новое» и не всплывает второй раз. */
export function useNotify(learn, update = null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const tick = () => { if (!document.hidden) setNow(Date.now()); };
    const id = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  // прогресс поменялся (урок, покупка) — время тоже свежее: «созрело» и место в лиге — на сейчас
  useEffect(() => { setNow(Date.now()); }, [learn]);
  const [prefs, setPrefsState] = useState(readPrefs);
  const [seen, setSeen] = useState(readSeen);
  // друзья: заявки и забеги (src/lib/friends-store.js) — тоже уведомления
  const friends = useFriends();
  // учебник: сколько задач ждут повторения — прогресс учебника читаем на «сейчас» (раз в минуту и после уроков)
  const bookDue = useMemo(() => { try { return reviewQueue(loadProgress(), now).due.length; } catch { return 0; } }, [now]);
  // и какие главы прочитаны, когда открывали учебник — для редкого «Загляните в учебник»
  const book = useMemo(() => { try { const p = loadProgress(); return { read: p.read, days: p.days }; } catch { return null; } }, [now]);
  // ник под запретом — уведомление «Смените ник» (src/account.jsx)
  const account = useAccount();
  const rename = account && account.renameBy ? { renameBy: account.renameBy, name: account.name } : null;
  const renameKey = rename ? `${rename.renameBy}:${rename.name}` : '';
  const list = useMemo(() => notificationsOf(learn, now, { prefs, since: firstDayOf(learn, now), friends, bookDue, book, account: rename }), [learn, now, prefs, friends, bookDue, book, renameKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const syncedSeen = useMemo(() => shownWith(learn, 'n:'), [learn.shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const syncedToast = useMemo(() => shownWith(learn, 't:'), [learn.shown]); // eslint-disable-line react-hooks/exhaustive-deps
  // смахнутые из «Ранее» — убраны из списка (x:), и на других устройствах тоже
  const syncedGone = useMemo(() => shownWith(learn, 'x:'), [learn.shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const [gone, setGone] = useState({});
  const dismissed = useMemo(() => ({ ...gone, ...syncedGone }), [gone, syncedGone]);
  const allSeen = useMemo(() => ({ ...seen, ...syncedSeen }), [seen, syncedSeen]);
  const unread = useMemo(() => unreadOf(list, allSeen), [list, allSeen]);
  const share = (prefix, ids) => { if (update && ids.length) update((s) => markShown(s, ids.map((id) => `${prefix}${id}`))); };
  const leaguePlace = useMemo(() => {
    if (!Object.values(learn.xp || {}).some((x) => x > 0)) return null;
    const ls = leagueState(learn, now);
    return ls.rest || !ls.joined ? null : { place: ls.me.place, league: ls.league, week: ls.week };
  }, [learn, now]);
  return {
    list, unread, seen: allSeen, prefs, now, leaguePlace,
    markAll: () => { const ids = list.filter((n) => !allSeen[n.id]).map((n) => n.id); setSeen(markSeen(list.map((n) => n.id))); share('n:', ids); },
    markOne: (id) => { setSeen(markSeen([id])); if (!allSeen[id]) share('n:', [id]); },
    // убрать из списка насовсем: и прочитано, и больше не показывается в «Ранее»
    dismissed,
    dismiss: (id) => { setGone((g) => ({ ...g, [id]: Date.now() })); setSeen(markSeen([id])); share('x:', [id]); if (!allSeen[id]) share('n:', [id]); },
    // плашка уже всплывала — на этом устройстве или на другом
    toasted: (id) => !!(readToasted()[id] || syncedToast[id]),
    markToasted: (id) => { markToasted(id); share('t:', [id]); },
    setPrefs: (p) => { writePrefs(p); setPrefsState(readPrefs()); },
  };
}

export function BellButton({ count, onClick, testid = 'bell' }) {
  const Icon = count ? BellRing : Bell;
  return (
    <button type="button" className="nt-bell" data-testid={testid} data-unread={count ? 'true' : 'false'} data-nav-target="notifications"
      aria-label={count ? `Уведомления: новых ${count}` : 'Уведомления'} title="Уведомления" onClick={() => { Audio.play('paper'); onClick(); }}>
      <Icon size={19} />
      {count > 0 && <b key={count} aria-hidden="true">{count > 9 ? '9+' : count}</b>}
    </button>
  );
}

/* Смахнуть вбок — прочитано: строка едет за пальцем (или мышью), отпустили дальше порога — улетает
   и отмечается прочитанной; ближе — возвращается на место. Вертикальная прокрутка не мешает: жест
   начинается, только когда сдвиг вбок больше, чем вверх-вниз. После жеста нажатие не срабатывает. */
export function useSwipe(onCommit, { threshold = 80, axis = 'x' } = {}) {
  const st = useRef(null);
  const moved = useRef(false);
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(0);
  const reduced = useReducedMotion();
  const onPointerDown = (e) => {
    if (gone || (e.pointerType === 'mouse' && e.button !== 0)) return;
    st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
    moved.current = false;
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    const ddx = e.clientX - s.x; const ddy = e.clientY - s.y;
    const main = axis === 'x' ? ddx : Math.min(0, ddy);
    if (!s.on) {
      if (Math.abs(axis === 'x' ? ddx : ddy) < 8) return;
      if (axis === 'x' ? Math.abs(ddx) <= Math.abs(ddy) : ddy >= 0) { st.current = null; return; }
      s.on = true; moved.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
    }
    setDx(main);
  };
  const onPointerUp = (e) => {
    const s = st.current; st.current = null;
    if (!s || !s.on || e.pointerId !== s.id) return;
    if (Math.abs(dx) > threshold) {
      const dir = dx > 0 ? 1 : -1;
      setGone(dir);
      Audio.play('paper');
      setTimeout(onCommit, reduced ? 0 : 220);
    } else setDx(0);
  };
  // после смахивания нажатие (click) не открывает уведомление
  const onClickCapture = (e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } };
  // сдвиг — свойством translate: оно складывается с transform элемента (плашка центрируется через transform)
  const style = gone ? { translate: axis === 'x' ? `${gone * 110}% 0` : '0 -130%', opacity: 0, transition: 'translate .22s ease-in, opacity .22s ease-in' }
    : dx ? { translate: axis === 'x' ? `${dx}px 0` : `0 ${dx}px`, opacity: Math.max(0.35, 1 - Math.abs(dx) / 260), transition: 'none' } : null;
  return { handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture }, style, swiping: !!dx || !!gone };
}

function NoteRow({ n, unread, i, now, onGo, onRead }) {
  const swipe = useSwipe(() => onRead(n));
  return (
    <button type="button" className="nt-item" style={{ '--t': n.tone, '--i': i, ...swipe.style }} data-unread={String(unread)} data-testid="notify-item" data-kind={n.kind} data-id={n.id}
      {...swipe.handlers} onClick={() => { Audio.play('click'); onGo(n); }}>
      <span className="nt-ico"><NIcon name={n.icon} size={21} /></span>
      <span className="nt-title">{n.title}</span>
      <ChevronRight size={18} className="nt-go" aria-hidden="true" />
      <span className="nt-text">{n.text}<span className="nt-when" style={{ display: 'block' }}>{agoText(n.at, now)}</span></span>
    </button>
  );
}

/* Центр уведомлений: «Новые» — то, что не открывали; «Ранее» — прочитанное, но ещё актуальное.
   Всё, что было на экране, при закрытии становится прочитанным. */
export function NotifyCenter({ notify, onClose, onGo }) {
  const [fresh, setFresh] = useState(() => new Set(notify.unread.map((n) => n.id)));
  const ref = useRef(notify); ref.current = notify;
  useEffect(() => () => ref.current.markAll(), []);
  const shown = notify.list.filter((n) => !(notify.dismissed || {})[n.id]);
  const news = shown.filter((n) => fresh.has(n.id));
  const old = shown.filter((n) => !fresh.has(n.id));
  /* смахнули — уведомление убрано совсем: не переезжает в «Ранее» (жалоба), и на других устройствах
     тоже (x:); счётчик на колокольчике уменьшается сразу. Касание — открыть, «Прочитано» — всё в «Ранее» */
  const read = (n) => { if (notify.dismiss) notify.dismiss(n.id); else notify.markOne(n.id); setFresh((s) => { const t = new Set(s); t.delete(n.id); return t; }); };
  return (
    <div className="nt-page" data-testid="notifications" role="dialog" aria-label="Уведомления">
      <div className="nt-page-in">
        <TopBar back={<IconButton label="Назад" icon={ArrowLeft} data-nav="back" onClick={() => { Audio.play('paper'); onClose(); }} />} title="Уведомления"
          right={news.length > 0 ? <button type="button" className="nt-readall" data-testid="notify-read-all" onClick={() => { Audio.play('tick'); notify.markAll(); onClose(); }}><CheckCheck size={18} aria-hidden="true" />Прочитано</button> : null} />
        {!shown.length ? (
          <div className="nt-empty" data-testid="notify-empty">
            <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot mood="hello" size={84} /></div>
            <div className="ds-h3" style={{ marginTop: 10 }}>Пока тихо</div>
            <div className="ds-sub" style={{ fontSize: 14.5, marginTop: 4 }}>Здесь появятся напоминания о серии, новости лиги, урожай сада и вклады копилки.</div>
          </div>
        ) : (
          <>
            {news.length > 0 && <div className="nt-group">Новые · {news.length}</div>}
            {news.map((n, i) => <NoteRow key={n.id} n={n} unread i={i} now={notify.now} onGo={onGo} onRead={read} />)}
            {news.length > 0 && <div className="ds-faint nt-hint" data-testid="notify-swipe-hint">Смахните уведомление вбок — оно уйдёт из списка.</div>}
            {old.length > 0 && <div className="nt-group">Ранее</div>}
            {/* смахнули прочитанное — оно уходит из списка, а не оставляет пустое место */}
            {old.map((n, i) => <NoteRow key={`old:${n.id}`} n={n} unread={false} i={i + news.length} now={notify.now} onGo={onGo} onRead={() => notify.dismiss && notify.dismiss(n.id)} />)}
            {old.length > 0 && news.length === 0 && <div className="ds-faint nt-hint" data-testid="notify-swipe-hint-old">Смахните прочитанное вбок — оно уйдёт из списка.</div>}
          </>
        )}
        <div className="ds-faint" style={{ fontSize: 13, textAlign: 'center', margin: '16px 8px 0' }}>Какие уведомления приходят и напоминание в браузере — в профиле, под шестерёнкой.</div>
      </div>
    </div>
  );
}

/* Плашка сверху: одно событие, касание — туда, где можно действовать; сама уезжает через 5 секунд. */
export function NotifyToast({ n, onGo, onClose, onRead = () => {} }) {
  const [out, setOut] = useState(false);
  // смахнули плашку вбок — она прочитана и уходит (как в центре уведомлений)
  const swipe = useSwipe(() => { onRead(n); onClose(); });
  useEffect(() => {
    if (swipe.swiping) return undefined;
    const t1 = setTimeout(() => setOut(true), 5000);
    const t2 = setTimeout(onClose, 5300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [n.id, swipe.swiping]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`nt-toast${out ? ' out' : ''}`} style={{ '--t': n.tone, ...swipe.style }} role="status" aria-live="polite" data-testid="notify-toast" data-id={n.id} {...swipe.handlers}
      onClick={() => { Audio.play('click'); onGo(n); }}>
      <span className="nt-ico"><NIcon name={n.icon} size={19} /></span>
      <span style={{ minWidth: 0 }}><span className="nt-title" style={{ display: 'block' }}>{n.title}</span><span className="nt-text">{n.text}</span></span>
      <IconButton label="Скрыть" icon={X} size={18} onClick={(e) => { e.stopPropagation(); setOut(true); setTimeout(onClose, 250); }} />
      <span className="nt-toast-bar" aria-hidden="true"><i /></span>
    </div>
  );
}

/* Плашки «пока приложение открыто»: новое уведомление с toast или место в лиге выросло после урока.
   При первом показе экрана ничего не всплывает — для этого есть колокольчик. Во время урока
   плашка ждёт его конца. */
export function useToasts(notify, busy) {
  const known = useRef(null);
  const place = useRef(null);
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    const ids = notify.list.map((n) => n.id);
    if (known.current === null) { known.current = new Set(ids); return; }
    const fresh = notify.list.filter((n) => n.toast && !known.current.has(n.id) && !notify.seen[n.id] && !notify.toasted(n.id));
    ids.forEach((id) => known.current.add(id));
    if (fresh.length) setQueue((q) => [...q, ...fresh.filter((n) => !q.some((x) => x.id === n.id))]);
  }, [notify.list]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const lp = notify.leaguePlace;
    if (!lp) { place.current = null; return; }
    const was = place.current;
    place.current = lp;
    if (was && was.week === lp.week && was.league === lp.league && lp.place < was.place && !notify.toasted(`lg-up:${lp.week}:${lp.place}`)) {
      const lg = LEAGUE_BY_ID[lp.league];
      setQueue((q) => [...q, { id: `lg-up:${lp.week}:${lp.place}`, kind: 'league', icon: 'arrow-up', tone: '#147A45', go: 'league', at: Date.now(),
        title: `Вы поднялись на ${lp.place}-е место`, text: `${lg.title} лига: ${was.place - lp.place > 1 ? `сразу на ${was.place - lp.place} ${was.place - lp.place < 5 ? 'места' : 'мест'} выше` : 'на одно место выше'}.` }]);
    }
  }, [notify.leaguePlace]); // eslint-disable-line react-hooks/exhaustive-deps
  // пока плашка ждала конца урока, уведомление могло уйти из списка (место уже вернули) — такое не показываем
  const live = queue.filter((n) => n.id.startsWith('lg-up:') || notify.list.some((x) => x.id === n.id));
  const cur = !busy && live.length ? live[0] : null;
  // показали — запомнили: та же плашка больше не всплывёт, прочитана она или нет
  useEffect(() => { if (cur) notify.markToasted(cur.id); }, [cur && cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => setQueue((q) => q.filter((n) => n !== cur && live.includes(n)));
  return [cur, done];
}

/* Напоминания в браузере: включены в настройках и разрешены браузером — пока вкладка открыта (и в
   фоне), раз в минуту смотрим, не появилось ли важное (серия ждёт урока, обогнали, созрело,
   вклад готов, последний день лиги). Каждое уходит один раз (ems-notify-pushed). */
export const browserNotifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export function useBrowserReminders(notify) {
  const ref = useRef(notify); ref.current = notify;
  useEffect(() => {
    if (!browserNotifySupported()) return undefined;
    const check = () => {
      const nt = ref.current;
      if (!nt.prefs.browser || Notification.permission !== 'granted') return;
      if (typeof document !== 'undefined' && !document.hidden) return;
      const pushed = readPushed();
      const due = nt.unread.filter((n) => n.push && !pushed[n.id]);
      due.slice(0, 2).forEach((n) => {
        markPushed(n.id);
        const opts = { body: n.text, tag: n.id, icon: '/icon-192.png', badge: '/icon-192.png', lang: 'ru' };
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(n.title, opts)).catch(() => {});
          else new Notification(n.title, opts); // eslint-disable-line no-new
        } catch { /* браузер не дал показать */ }
      });
    };
    const id = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, []);
}

