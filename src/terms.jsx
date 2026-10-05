/* «ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ»: простыми словами, что такое Инфлатия и как ею пользоваться.
   Открывается из регистрации (рядом с согласиями) и из окна аккаунта. Текст юристом не
   проверялся — вопросы к нему в docs/legal-todo.md. Вёрстка — как у страницы данных
   (src/privacy.jsx). */
import React from 'react';
import { X } from 'lucide-react';

export const TERMS_TITLE = 'Пользовательское соглашение';
export const TERMS_CAVEAT = 'Учебная игра, не финансовый совет';
export const TERMS_SECTIONS = [
  { title: 'Что такое Инфлатия', items: [
    'Учебное приложение по экономике: уроки, учебник, задачи и игра «Мир», где страна живёт по упрощённой модели.',
    'Страна, герои, компании и новости выдуманы. Совпадения с реальными людьми и событиями случайны, кроме исторических сценариев и статистики учебника — у неё указан источник.',
  ] },
  { title: TERMS_CAVEAT, items: [
    'Ничто в Инфлатии — ни уроки, ни игра, ни фразы героев — не совет, как вкладывать, брать кредит или тратить настоящие деньги.',
    'Модель игры упрощена: в ней коэффициенты подобраны вручную, и реальная экономика ведёт себя иначе. Чем модель не похожа на настоящую — в приложении к учебнику.',
    'Монеты, кроны и награды существуют только внутри приложения, их нельзя купить, продать или обменять на деньги.',
  ] },
  { title: 'Аккаунт', items: [
    'Один человек — один аккаунт. Пароль и код восстановления храните сами: почты у игры нет.',
    'В имени и логине — без грубых слов, чужих имён и сведений о себе (фамилии, школы, адреса).',
    'Если вам меньше 14 лет, зарегистрироваться можно только вместе с родителем или другим законным представителем.',
  ] },
  { title: 'Сетевые партии', items: [
    'Играйте честно: не пытайтесь ломать игру, обходить ограничения сервера или мешать другим.',
    'Место в партии закреплено за аккаунтом; выйти и зайти другим игроком нельзя.',
  ] },
  { title: 'Изменения и ошибки', items: [
    'Приложение меняется: уроки, правила игры и это соглашение могут обновляться. Дата редакции — внизу страницы.',
    'Ошибки в уроках и игре случаются — сообщите о них кнопкой «Сообщить об ошибке», мы исправим.',
    'Удалить аккаунт и все данные можно в окне аккаунта в любой момент.',
  ] },
];

export function TermsPage({ onClose }) {
  return (
    <div role="dialog" aria-label={TERMS_TITLE} data-testid="terms"
      style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto', background: 'var(--ds-paper)', color: 'var(--ds-ink)', padding: '12px 16px calc(32px + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h1 className="ds-h1" style={{ flex: 1, fontSize: 26, margin: 0 }}>{TERMS_TITLE}</h1>
          <button type="button" className="ds-iconbtn" aria-label="Закрыть" data-nav="back" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 6 }}><X size={22} /></button>
        </div>
        <p className="ds-sub" style={{ fontSize: 15, lineHeight: 1.5, margin: '0 0 12px' }}>
          <b>{TERMS_CAVEAT}.</b> Регистрируясь, вы соглашаетесь с правилами ниже.
        </p>
        {TERMS_SECTIONS.map((s) => (
          <section key={s.title} style={{ margin: '14px 0' }}>
            <h2 className="ds-h3" style={{ margin: '0 0 6px' }}>{s.title}</h2>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.5 }}>
              {s.items.map((t) => <li key={t} style={{ margin: '4px 0' }}>{t}</li>)}
            </ul>
          </section>
        ))}
        <p className="ds-faint" style={{ fontSize: 13, marginTop: 18 }}>Редакция от 5 октября 2026 года.</p>
      </div>
    </div>
  );
}
