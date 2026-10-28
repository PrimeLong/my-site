#!/usr/bin/env node
/* Инструкция для портретов «Персоналий»: people/README.md — кто, какое имя у файла и где взять фото;
   отмечает, у кого портрет уже лежит в public/people. Если нет people/credits.csv — пишет заготовку
   (строка на человека, автор и лицензия пустые); готовый файл не трогает.

   Запуск: npm run people:export */
import { writeFile, mkdir, access } from 'node:fs/promises';
import { PEOPLE } from '../src/learn/people.js';
import { listPeoplePhotos, readPhotoCredits } from './voice-files-plugin.js';

const out = new URL('../people/', import.meta.url);
const files = listPeoplePhotos();
const credits = readPhotoCredits();
const all = PEOPLE.flatMap((g) => g.people.map((p) => ({ ...p, group: g.title })));
let n = 0;
const rows = all.map((p) => {
  n += 1;
  const has = files[p.id];
  return `| ${n} | ${p.name} | ${p.years} | ${p.group} | \`${p.id}.jpg\` | [статья](https://en.wikipedia.org/wiki/${encodeURI(p.wiki).replace(/\(/g, '%28').replace(/\)/g, '%29')}) | ${has ? `✓ ${has}${credits[p.id] ? ', подпись есть' : ''}` : '—'} |`;
});
const done = all.filter((p) => files[p.id]).length;

await mkdir(out, { recursive: true });
const readme = `# Портреты «Персоналий»

У каждого человека в «Персоналиях» и в галерее профиля — портрет в рамке-арке. Пока фото нет,
вместо него гравированный медальон с инициалами. Чтобы появилось фото, положите картинку в папку
\`public/people/\` под именем из таблицы. После сборки на Vercel портрет появится сам —
сайт отдаёт его со своего адреса, поэтому Википедия ученику не нужна.

Сейчас лежит ${done} из ${all.length}. Этот файл пишет команда \`npm run people:export\`.

## Как добавить портрет

1. **Найдите фото.** Проще всего — через статью из таблицы. Нажмите на портрет в статье, затем
   «More details» («Подробнее») — откроется страница файла на Wikimedia Commons. Там же видна
   лицензия.
2. **Проверьте лицензию.** Подходят «Public domain», «CC0», «CC BY …», «CC BY-SA …». Если написано
   «Fair use», «Non-free» или лицензии нет — это фото брать нельзя, пусть остаётся медальон.
3. **Скачайте.** На Commons — «Download», размер около 500–800 px по ширине.
4. **Назовите файл** как в столбце «Имя файла» — например, \`robbins.jpg\`. Маленькие латинские
   буквы, как в таблице. Подходят \`.jpg\`, \`.png\` и \`.webp\`.
5. **Загрузите в \`public/people/\`.** На GitHub: откройте \`public/people\` → **Add file → Upload
   files** → перетащите картинки → **Commit changes**.
6. Vercel соберёт сайт сам — и вместо медальона появится фото.

**Как фото встанет в рамку.** Рамка вертикальная, примерно 4:5, верх — арка. Фото обрезается по
рамке, середина чуть выше центра: лицо лучше держать в верхней трети кадра. Хватит 400×500 px и
до 200 КБ на файл.

## Подпись: автор и лицензия

Для «CC BY» и «CC BY-SA» подпись обязательна. Откройте [\`credits.csv\`](credits.csv) и заполните
строку человека: \`id;автор;лицензия;ссылка\`. Например:

\`\`\`
robbins;Имя Фамилия автора;CC BY-SA 4.0;https://commons.wikimedia.org/wiki/File:Имя_файла.jpg
\`\`\`

Автор и лицензия — со страницы файла на Commons, ссылка — адрес этой страницы. Под портретом
появится «Фото: автор · лицензия · Wikimedia Commons». Для «Public domain» подпись можно не
заполнять.

## Кто есть

| № | Кто | Годы | Уроки | Имя файла | Где взять фото | Лежит |
|---:|---|---|---|---|---|---|
${rows.join('\n')}
`;
await writeFile(new URL('README.md', out), readme);
try {
  await access(new URL('credits.csv', out));
} catch {
  const lines = ['# Подписи к портретам «Персоналий» (инструкция — README.md рядом).', '# Формат: id;автор;лицензия;ссылка на страницу файла. Пустые строки и строки с # не читаются.', 'id;автор;лицензия;ссылка', ...all.map((p) => `${p.id};;;`)];
  await writeFile(new URL('credits.csv', out), `${lines.join('\n')}\n`);
}
console.log(`Людей: ${all.length}, портретов лежит: ${done}. Папка people/ обновлена.`);
