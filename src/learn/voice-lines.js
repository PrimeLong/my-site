/* ЗАПИСАННЫЕ ГОЛОСА (docs/world.md, «Голоса»): сюжеты эфира «Слушай» можно озвучить заранее —
   например, на FreeTTS — и положить файлами в public/voice/<id>.mp3. Тогда урок играет запись, а где
   записи нет, читает голосом браузера, как раньше («История» — лента для чтения, её голос не читает).
   id зависит от героя и текста реплики: поправили текст — у реплики новый id, и старая запись сама
   перестаёт играть (устаревшее не звучит).
   Тексты для озвучки выгружает npm run voice:export (папка voice/), список записанных файлов
   считается при сборке (scripts/voice-files-plugin.js). Модуль чистый: его читают урок
   (src/learn-feed.jsx), скрипт выгрузки и тесты. */
import { speechText } from './voices.js';
import VOICE_FILES from 'virtual:voice-files';

// FNV-1a, 32 бита
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// текст реплики без лишних пробелов — две одинаковые фразы получают один id
const norm = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();
// имя файла: герой и 7 знаков от текста (masha-0k3x9qa) — коротко, чтобы удобно было называть записи
export const voiceId = (who, text) => `${who}-${fnv(`${who}\n${norm(text)}`).toString(36).padStart(7, '0')}`;
// текст для сервиса озвучки: разряды склеены, «кр.» — «крон», без знаков ударения (их сервисы пишут по-своему)
export const ttsText = (text) => speechText(norm(text)).say.replace(/\u0301/g, '');

const RECORDED = new Set(VOICE_FILES);
/* Автотест (Playwright) настоящих записей не слышит — у него голос браузера, как и без записей; со
   своим флагом (ems-voice-test=1) он считает записанным каждый сюжет — так проверяется проигрыватель */
const testMode = () => {
  try { return typeof navigator !== 'undefined' && navigator.webdriver ? localStorage.getItem('ems-voice-test') === '1' : null; } catch { return null; }
};
export const hasRecording = (id) => { const t = testMode(); return t === null ? RECORDED.has(id) : t; };
export const anyRecordings = () => { const t = testMode(); return t === null ? RECORDED.size > 0 : t; };
export const recordingUrl = (id) => `/voice/${id}.mp3`;

/* Реплики эфиров «Слушай» (с алмазными): урок, герой и текст — по порядку курса, без повторов. Уроки,
   «текст карточки» и голос ведущей по умолчанию передаются снаружи (так модуль не тянет за собой курс). */
export function voiceLines(lessons, plain, host) {
  const seen = new Set(); const out = [];
  lessons.filter((l) => l.kind === 'listen').forEach((l) => {
    l.inner.forEach((c) => {
      const who = c.idea.who || host;
      const text = norm(plain(c.idea.text || []));
      if (!text) return;
      const id = voiceId(who, text);
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, who, lesson: l.id, text, tts: ttsText(text) });
    });
  });
  return out;
}

// подсветка слова под записью: доля прослушанного → доля текста → слово, на котором сейчас голос
export function wordAt(starts, length, fraction) {
  const pos = Math.max(0, Math.min(1, fraction)) * length;
  let k = 0;
  starts.forEach((p, i) => { if (p <= pos) k = i; });
  return k;
}
