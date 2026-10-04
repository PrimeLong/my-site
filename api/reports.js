/* «Сообщить об ошибке»: ученик отмечает упражнение, шаг, страницу учебника или итоги урока.
   Отправить можно только из профиля (сессия обязательна) и не чаще REPORTS_PER_HOUR в час
   с профиля и с адреса. К сообщению прикладывается контекст: упражнение и урок, числа
   варианта, ответ ученика и правильный ответ, версия сборки, экран, устройство.
   Читают и разбирают сообщения только владельцы — логины из переменной окружения
   OWNER_LOGINS (через запятую). */
import { getReports, setReport, deleteReport, hit, hasKv } from './_lib/store.js';
import { isRude, RUDE_MESSAGE } from '../src/lib/moderation.js';
import { userBySession } from './_lib/accounts.js';
import { randomBytes } from 'node:crypto';

export const REASONS = {
  answer: 'Ошибка в ответе',
  accept: 'Мой ответ должен быть засчитан',
  typo: 'Опечатка или ошибка в тексте',
  unclear: 'Непонятно объяснено',
  broken: 'Не работает',
};
export const REPORTS_PER_HOUR = 20;
const clientIp = (req) => String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local').split(',')[0].trim();
export const ownerLogins = () => String(process.env.OWNER_LOGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isOwner = (user) => !!user && ownerLogins().includes(String(user.login).toLowerCase());

// строка без управляющих символов, не длиннее max
const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? Array.from(String(v)).filter((ch) => ch === '\n' || ch.charCodeAt(0) >= 32).join('').trim().slice(0, max) : '');
// контекст — плоский словарь коротких строк: что именно видел ученик
const CTX_KEYS = { screen: 60, kind: 30, mode: 20, lesson: 64, unit: 64, exercise: 120, variant: 60, prompt: 1500, answer: 500, correct: 500,
  numbers: 500, page: 200, build: 60, device: 200, viewport: 30, step: 200 };
export function sanitizeReport(body) {
  const reason = typeof body.reason === 'string' && REASONS[body.reason] ? body.reason : null;
  if (!reason) return null;
  const c = body.context && typeof body.context === 'object' ? body.context : {};
  const context = {};
  Object.entries(CTX_KEYS).forEach(([k, max]) => { const v = str(c[k], max); if (v) context[k] = v; });
  return { reason, comment: str(body.comment, 1000), context };
}

async function handleRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  const user = await userBySession(body.session);
  if (!user) return res.status(401).json({ error: 'Сообщить об ошибке можно после входа в профиль' });
  const action = body.action || 'send';

  if (action === 'me') return res.status(200).json({ owner: isOwner(user) });

  if (action === 'send') {
    const r = sanitizeReport(body);
    if (!r) return res.status(400).json({ error: 'Выберите причину' });
    if (isRude(r.comment)) return res.status(400).json({ error: RUDE_MESSAGE });
    if (await hit(`report:${user.login}`, 3600) > REPORTS_PER_HOUR || await hit(`report-ip:${clientIp(req)}`, 3600) > REPORTS_PER_HOUR * 3) {
      return res.status(429).json({ error: 'Слишком много сообщений за час — спасибо, попробуйте чуть позже' });
    }
    const entry = { id: `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`, at: Date.now(), login: user.login, name: user.name, status: 'new', ...r };
    await setReport(entry);
    return res.status(200).json({ ok: true, id: entry.id, storage: hasKv() ? 'kv' : 'memory' });
  }

  // дальше — только владельцы
  if (!isOwner(user)) return res.status(403).json({ error: 'Сообщения видят только владельцы' });
  if (action === 'list') {
    const status = body.status === 'done' ? 'done' : body.status === 'all' ? 'all' : 'new';
    const all = (await getReports()).sort((a, b) => b.at - a.at);
    const counts = { new: all.filter((x) => x.status !== 'done').length, done: all.filter((x) => x.status === 'done').length };
    // грубые сообщения (присланные до модерации) помечены — их можно сразу удалить
    const shown = all.filter((x) => status === 'all' || (status === 'done' ? x.status === 'done' : x.status !== 'done')).map((x) => ({ ...x, rude: isRude(x.comment) || isRude(x.name) || isRude(x.login) }));
    return res.status(200).json({ reports: shown, counts });
  }
  if (action === 'status') {
    const all = await getReports();
    const r = all.find((x) => x.id === body.id);
    if (!r) return res.status(404).json({ error: 'Сообщение не найдено' });
    const next = { ...r, status: body.status === 'done' ? 'done' : 'new', doneBy: body.status === 'done' ? user.login : null, doneAt: body.status === 'done' ? Date.now() : null };
    await setReport(next);
    return res.status(200).json({ report: next });
  }
  if (action === 'delete') {
    if (typeof body.id !== 'string') return res.status(400).json({ error: 'Нет id' });
    await deleteReport(body.id);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'Неизвестное действие' });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('reports handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
