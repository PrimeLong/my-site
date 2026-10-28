/* ЗАПИСИ КНИГ ПОЛКИ (docs/mechanics.md, «Профиль»): одна запись на книгу — public/books/<id>.mp3.
   Список записанных считается при сборке (scripts/voice-files-plugin.js); тексты для озвучки выгружает
   npm run books:export (папка books/). Книгу без записи читает голос браузера по абзацам. */
import BOOK_FILES from 'virtual:book-audio';

const RECORDED = new Set(BOOK_FILES);
/* Автотест (Playwright) настоящих записей не слышит; со своим флагом (ems-book-audio-test=1) он считает
   записанной каждую книгу — так проверяется проигрыватель, без флага — голос браузера */
const testMode = () => {
  try { return typeof navigator !== 'undefined' && navigator.webdriver ? localStorage.getItem('ems-book-audio-test') === '1' : null; } catch { return null; }
};
export const hasBookAudio = (id) => { const t = testMode(); return t === null ? RECORDED.has(id) : t; };
export const bookAudioUrl = (id) => `/books/${id}.mp3`;
