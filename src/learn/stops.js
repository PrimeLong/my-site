/* ОСТАНОВКИ ДОРОГИ ЮНИТА (docs/mechanics.md, «Путь»): уроки юнита и между ними особые уроки —
   «Персоналии» (после второго урока), «Разбор графика» (после урока, где график появился), «Чтение» (на середине юнита) и «Работа над ошибками» (там,
   где её поставил pathState, src/learn/course.js). Особые уроки — такие же уроки на дороге, со своим
   значком: открываются, когда пройден урок перед ними, и пропустить их нельзя — следующий урок закрыт,
   пока особый не пройден (extraLocks читает pathState). «Работа над ошибками» — так же.
   Модуль чистый: его читают Путь и тесты. */
import { READING_BY_UNIT, isRead } from './reading.js';
import { PEOPLE_BY_UNIT, isMet } from './people.js';
import { GRAPH_BY_UNIT, isGraphDone } from './graphs.js';

export const EXTRA_KIND = { people: 'Персоналии', read: 'Чтение', graph: 'Разбор графика', fix: 'Работа над ошибками' };

// после какого урока встаёт особый урок: «Персоналии» — после второго, «Чтение» — на середине
export const peopleAfter = (n) => Math.min(1, n - 1);
export const readAfter = (n) => Math.max(peopleAfter(n) + 1, Math.floor(n / 2));
// «Разбор графика» — сразу после урока, где этот график появляется впервые (жалоба: «разбор графика
// встречается позже, чем график вводится»); если график в шагах уроков не встретился — после трети юнита
export const graphAfter = (n) => Math.min(n - 1, Math.max(2, Math.floor(n / 3)));
export function graphAt(lessons, chart) {
  const i = lessons.findIndex((l) => [l.idea, ...(l.inner || []).map((c) => c.idea)].some((b) => b && b.chart === chart));
  return i >= 0 ? i : graphAfter(lessons.length);
}

/* Особые уроки юнита: после какого урока стоят и пройдены ли — для замка следующего урока.
   unit — юнит курса (id и уроки). Ответ — { [номер урока]: [{ type, id, title, done }] } */
// автотест (Playwright) идёт по Пути без этого замка, если сам не попросил его (ems-extra-test=1)
const gateOff = () => {
  try { return typeof navigator !== 'undefined' && !!navigator.webdriver && localStorage.getItem('ems-extra-test') !== '1'; } catch { return false; }
};
export function extraLocks(unit, learn) {
  const out = {};
  if (gateOff()) return out;
  const unitId = unit.id; const n = unit.lessons.length;
  const add = (after, e) => { (out[after] = out[after] || []).push(e); };
  const pp = PEOPLE_BY_UNIT[unitId]; if (pp) add(peopleAfter(n), { type: 'people', id: pp.id, title: pp.title, done: isMet(learn, pp.id) });
  const rd = READING_BY_UNIT[unitId]; if (rd) add(Math.min(n - 1, readAfter(n)), { type: 'read', id: rd.id, title: rd.title, done: isRead(learn, rd.id) });
  const gr = GRAPH_BY_UNIT[unitId]; if (gr) add(graphAt(unit.lessons, gr.chart), { type: 'graph', id: gr.id, title: gr.title, done: isGraphDone(learn, gr.id) });
  return out;
}
export function unitStops(st, learn) {
  const n = st.lessons.length;
  const passed = (i) => !!st.tested || !!(st.lessons[i] && st.lessons[i].done);
  const extras = [];
  const pp = PEOPLE_BY_UNIT[st.course.id];
  if (pp) extras.push({ type: 'people', id: pp.id, title: pp.title, after: peopleAfter(n), done: isMet(learn, pp.id) });
  const rd = READING_BY_UNIT[st.course.id];
  if (rd) extras.push({ type: 'read', id: rd.id, title: rd.title, after: Math.min(n - 1, readAfter(n)), done: isRead(learn, rd.id) });
  const gr = GRAPH_BY_UNIT[st.course.id];
  if (gr) extras.push({ type: 'graph', id: gr.id, title: gr.title, after: graphAt(st.course.lessons, gr.chart), done: isGraphDone(learn, gr.id) });
  const fixStop = st.fix ? { type: 'fix', id: `fix:${st.fix.unitId}`, unitId: st.fix.unitId, title: EXTRA_KIND.fix, count: st.fix.count, open: true, done: false } : null;
  const out = [];
  st.lessons.forEach((l, i) => {
    if (fixStop && st.fix.at === i) out.push(fixStop);
    out.push({ type: 'lesson', id: l.id, l });
    extras.filter((e) => e.after === i).forEach((e) => out.push({ ...e, open: e.done || passed(e.after) }));
  });
  if (fixStop && st.fix.at >= n) out.push(fixStop);
  return out;
}
