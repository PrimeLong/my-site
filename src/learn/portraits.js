/* ПОРТРЕТЫ «ПЕРСОНАЛИЙ» — только со своего адреса (docs/mechanics.md, «Персоналии»). Браузер ученика в
   Википедию и на Wikimedia Commons не ходит: ни за фото, ни за подписью (CSP в vercel.json эти адреса не
   пускает). Фото — файл public/people/<id>.jpg: положенный руками (список считается при сборке,
   scripts/voice-files-plugin.js; подписи — people/credits.csv; инструкция — people/README.md) или скачанный
   при сборке (src/learn/people-photos.js, пишет scripts/fetch-portraits.mjs — только свободные лицензии с
   Commons). Файла нет — гравированный медальон с инициалами (src/learn-people.jsx). */
import { PHOTOS } from './people-photos.js';
import PEOPLE_FILES from 'virtual:people-files';
import { commonsFile, photoFromCommons, isFreeLicense, FREE_LICENSE, NONFREE_LICENSE } from './commons.js';

export { commonsFile, photoFromCommons, isFreeLicense, FREE_LICENSE, NONFREE_LICENSE };

// прежний кеш ответов Википедии на устройстве (ems-portraits-v1): в нём адреса upload.wikimedia.org — стираем
try { if (typeof localStorage !== 'undefined') localStorage.removeItem('ems-portraits-v1'); } catch { /* приватный режим */ }

// фото из public/people: подпись — из скачанных при сборке или из people/credits.csv (может и не быть)
export function localPhoto(id) {
  const file = (PEOPLE_FILES.files || {})[id];
  if (!file) return null;
  const c = PHOTOS[id] || (PEOPLE_FILES.credits || {})[id] || {};
  return { file: `/people/${file}`, author: c.author || '', license: c.license || '', source: c.source || '' };
}
// сразу, без сети: положенный руками или скачанный при сборке; иначе null — медальон
export function cachedPhoto(p) {
  const local = localPhoto(p.id);
  if (local) return local;
  const built = PHOTOS[p.id];
  // скачанное при сборке лежит у нас (/people/…); чужой адрес не показываем
  return built && String(built.file || '').startsWith('/people/') ? built : null;
}
// то же обещанием — для экрана, который ждёт фото (сети нет, ответ сразу)
export const loadPhoto = (p) => Promise.resolve(cachedPhoto(p));
