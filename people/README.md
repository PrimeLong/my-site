# Портреты «Персоналий»

У каждого человека в «Персоналиях» и в галерее профиля — портрет в рамке-арке. Пока фото нет,
вместо него гравированный медальон с инициалами. Чтобы появилось фото, положите картинку в папку
`public/people/` под именем из таблицы. После сборки на Vercel портрет появится сам —
сайт отдаёт его со своего адреса, поэтому Википедия ученику не нужна.

Сейчас лежит 0 из 30. Этот файл пишет команда `npm run people:export`.

## Как добавить портрет

1. **Найдите фото.** Проще всего — через статью из таблицы. Нажмите на портрет в статье, затем
   «More details» («Подробнее») — откроется страница файла на Wikimedia Commons. Там же видна
   лицензия.
2. **Проверьте лицензию.** Подходят «Public domain», «CC0», «CC BY …», «CC BY-SA …». Если написано
   «Fair use», «Non-free» или лицензии нет — это фото брать нельзя, пусть остаётся медальон.
3. **Скачайте.** На Commons — «Download», размер около 500–800 px по ширине.
4. **Назовите файл** как в столбце «Имя файла» — например, `robbins.jpg`. Маленькие латинские
   буквы, как в таблице. Подходят `.jpg`, `.png` и `.webp`.
5. **Загрузите в `public/people/`.** На GitHub: откройте `public/people` → **Add file → Upload
   files** → перетащите картинки → **Commit changes**.
6. Vercel соберёт сайт сам — и вместо медальона появится фото.

**Как фото встанет в рамку.** Рамка вертикальная, примерно 4:5, верх — арка. Фото обрезается по
рамке, середина чуть выше центра: лицо лучше держать в верхней трети кадра. Хватит 400×500 px и
до 200 КБ на файл.

## Подпись: автор и лицензия

Для «CC BY» и «CC BY-SA» подпись обязательна. Откройте [`credits.csv`](credits.csv) и заполните
строку человека: `id;автор;лицензия;ссылка`. Например:

```
robbins;Имя Фамилия автора;CC BY-SA 4.0;https://commons.wikimedia.org/wiki/File:Имя_файла.jpg
```

Автор и лицензия — со страницы файла на Commons, ссылка — адрес этой страницы. Под портретом
появится «Фото: автор · лицензия · Wikimedia Commons». Для «Public domain» подпись можно не
заполнять.

## Кто есть

| № | Кто | Годы | Уроки | Имя файла | Где взять фото | Лежит |
|---:|---|---|---|---|---|---|
| 1 | Лайонел Роббинс | 1898–1984 | Люди выбора | `robbins.jpg` | [статья](https://en.wikipedia.org/wiki/Lionel_Robbins,_Baron_Robbins) | — |
| 2 | Томас Мальтус | 1766–1834 | Люди выбора | `malthus.jpg` | [статья](https://en.wikipedia.org/wiki/Thomas_Robert_Malthus) | — |
| 3 | Давид Рикардо | 1772–1823 | Люди выбора | `ricardo.jpg` | [статья](https://en.wikipedia.org/wiki/David_Ricardo) | — |
| 4 | Адам Смит | 1723–1790 | Люди рынка | `smith.jpg` | [статья](https://en.wikipedia.org/wiki/Adam_Smith) | — |
| 5 | Флеминг Дженкин | 1833–1885 | Люди рынка | `jenkin.jpg` | [статья](https://en.wikipedia.org/wiki/Fleeming_Jenkin) | — |
| 6 | Альфред Маршалл | 1842–1924 | Люди рынка | `marshall.jpg` | [статья](https://en.wikipedia.org/wiki/Alfred_Marshall) | — |
| 7 | Грегори Кинг | 1648–1712 | Люди чисел | `king.jpg` | [статья](https://en.wikipedia.org/wiki/Gregory_King) | — |
| 8 | Эрнст Энгель | 1821–1896 | Люди чисел | `engel.jpg` | [статья](https://en.wikipedia.org/wiki/Ernst_Engel) | — |
| 9 | Роберт Гиффен | 1837–1910 | Люди чисел | `giffen.jpg` | [статья](https://en.wikipedia.org/wiki/Robert_Giffen) | — |
| 10 | Артур Пигу | 1877–1959 | Люди общего | `pigou.jpg` | [статья](https://en.wikipedia.org/wiki/Arthur_Cecil_Pigou) | — |
| 11 | Рональд Коуз | 1910–2013 | Люди общего | `coase.jpg` | [статья](https://en.wikipedia.org/wiki/Ronald_Coase) | — |
| 12 | Элинор Остром | 1933–2012 | Люди общего | `ostrom.jpg` | [статья](https://en.wikipedia.org/wiki/Elinor_Ostrom) | — |
| 13 | Джон Ло | 1671–1729 | Люди денег | `law.jpg` | [статья](https://en.wikipedia.org/wiki/John_Law_%28economist%29) | — |
| 14 | Уолтер Бэджет | 1826–1877 | Люди денег | `bagehot.jpg` | [статья](https://en.wikipedia.org/wiki/Walter_Bagehot) | — |
| 15 | Сергей Витте | 1849–1915 | Люди денег | `witte.jpg` | [статья](https://en.wikipedia.org/wiki/Sergei_Witte) | — |
| 16 | Ирвинг Фишер | 1867–1947 | Люди цен | `fisher.jpg` | [статья](https://en.wikipedia.org/wiki/Irving_Fisher) | — |
| 17 | Милтон Фридман | 1912–2006 | Люди цен | `friedman.jpg` | [статья](https://en.wikipedia.org/wiki/Milton_Friedman) | — |
| 18 | Пол Волкер | 1927–2019 | Люди цен | `volcker.jpg` | [статья](https://en.wikipedia.org/wiki/Paul_Volcker) | — |
| 19 | Уильям Стэнли Джевонс | 1835–1882 | Люди пользы | `jevons.jpg` | [статья](https://en.wikipedia.org/wiki/William_Stanley_Jevons) | — |
| 20 | Жюль Дюпюи | 1804–1866 | Люди пользы | `dupuit.jpg` | [статья](https://en.wikipedia.org/wiki/Jules_Dupuit) | — |
| 21 | Даниэль Канеман | 1934–2024 | Люди пользы | `kahneman.jpg` | [статья](https://en.wikipedia.org/wiki/Daniel_Kahneman) | — |
| 22 | Генри Форд | 1863–1947 | Люди производства | `ford.jpg` | [статья](https://en.wikipedia.org/wiki/Henry_Ford) | — |
| 23 | Фредерик Тейлор | 1856–1915 | Люди производства | `taylor.jpg` | [статья](https://en.wikipedia.org/wiki/Frederick_Winslow_Taylor) | — |
| 24 | Якоб Винер | 1892–1970 | Люди производства | `viner.jpg` | [статья](https://en.wikipedia.org/wiki/Jacob_Viner) | — |
| 25 | Антуан Огюстен Курно | 1801–1877 | Люди власти рынка | `cournot.jpg` | [статья](https://en.wikipedia.org/wiki/Antoine_Augustin_Cournot) | — |
| 26 | Джон Д. Рокфеллер | 1839–1937 | Люди власти рынка | `rockefeller.jpg` | [статья](https://en.wikipedia.org/wiki/John_D._Rockefeller) | — |
| 27 | Йозеф Шумпетер | 1883–1950 | Люди власти рынка | `schumpeter.jpg` | [статья](https://en.wikipedia.org/wiki/Joseph_Schumpeter) | — |
| 28 | Эдвард Чемберлин | 1899–1967 | Люди бренда | `chamberlin.jpg` | [статья](https://en.wikipedia.org/wiki/Edward_Chamberlin) | — |
| 29 | Джоан Робинсон | 1903–1983 | Люди бренда | `robinson.jpg` | [статья](https://en.wikipedia.org/wiki/Joan_Robinson) | — |
| 30 | Гарольд Хотеллинг | 1895–1973 | Люди бренда | `hotelling.jpg` | [статья](https://en.wikipedia.org/wiki/Harold_Hotelling) | — |
