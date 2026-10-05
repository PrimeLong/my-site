/* ВИТРИНА ДИЗАЙН-СИСТЕМЫ — внутренняя страница #ds: все токены и компоненты обучения в
   светлой и тёмной теме рядом, чтобы разнобой был виден сразу. Экраны строятся только из
   того, что здесь показано. Открывается по адресу …/#ds (без входа: это страница для
   разработки, данных ученика на ней нет). */
import React, { useState } from 'react';
import { Coins, BookOpenText, Flame, Target, ArrowLeft, Sparkles, Check, Landmark, Dumbbell, BookOpen } from 'lucide-react';
import { DS_THEMES, PLACES, DS_FONT } from './ds-tokens.js';
import { DsRoot, Button, IconButton, Card, MenuCard, Panel, Heading, Row, Toggle, Field, AnswerBar, TopBar, Tabs } from './ds.jsx';
import { ArtStyle, Guilloche, Rosette, Stamp, PostStamp, Engraving, Clipping, ProgressChart, InflaMeter, CountUp } from './ds-art.jsx';
import { Mascot } from './mascot.jsx';

const BUILDINGS = ['market', 'workshop', 'bakery', 'bank', 'exchange', 'ministry', 'port', 'store', 'factory', 'tower'];
const TOKENS = ['paper', 'card', 'card2', 'ink', 'ink2', 'ink3', 'rule', 'rule2', 'ok', 'okBg', 'bad', 'badBg', 'gold', 'sel', 'selRule'];

function Section({ title, children }) {
  return (
    <section style={{ margin: '26px 0' }}>
      <div className="ds-eyebrow" style={{ borderBottom: '1px solid var(--ds-rule2)', paddingBottom: 4, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function Sheetlike() {
  return (
    <div className="ds-sheet" style={{ position: 'relative', borderRadius: 12, maxWidth: 420 }}>
      <Heading level={2} title="Шторка снизу" sub="Карточка урока, вопрос «Выйти из урока?»" />
      <div style={{ marginTop: 12 }}><Button wide>Начать</Button></div>
    </div>
  );
}

function Showcase({ theme }) {
  const [on, setOn] = useState(true);
  const [pressed, setPressed] = useState('b');
  const [streak, setStreak] = useState(2);
  const t = DS_THEMES[theme];
  return (
    <DsRoot theme={theme} accent={PLACES['supply-demand'].color} page style={{ padding: '20px 16px 60px' }} data-testid={`ds-${theme}`}>
      <ArtStyle />
      <style>{'.ds-showcase .ds-nav { position: static; }'}</style>
      <div className="ds-showcase" style={{ maxWidth: 560, margin: '0 auto' }}>
        <Heading eyebrow={`Тема «${theme === 'paper' ? 'бумага' : 'тушь'}»`} title="Дизайн-система обучения" sub="Деньги и печать: бумага, тушь, гильош, гравюра, штамп." />

        <Section title="Токены цвета">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {TOKENS.map((k) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{ height: 34, background: t[k], border: '1px solid var(--ds-rule2)', borderRadius: 3 }} />
                <div className="ds-num ds-faint" style={{ fontSize: 10.5 }}>{k}</div>
              </div>
            ))}
          </div>
          <div className="ds-sub" style={{ fontSize: 13.5, margin: '12px 0 6px' }}>Цвета юнитов — как купюры своего достоинства:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(PLACES).map(([id, p]) => (
              <span key={id} title={id} style={{ background: p.color, color: '#fff', font: '700 11px var(--ds-sans)', padding: '5px 7px', borderRadius: 2 }}>{p.place}</span>
            ))}
          </div>
        </Section>

        <Section title="Шрифты и размеры">
          <div className="ds-h1">PT Serif — заголовок 28</div>
          <div className="ds-h2">PT Serif — заголовок 22</div>
          <div className="ds-h3">PT Serif — заголовок 18</div>
          <div className="ds-text">PT Sans — текст урока 17: спрос — это вся зависимость между ценой и количеством.</div>
          <div className="ds-num" style={{ fontSize: 20 }}>PT Mono — числа 1 234,5 ₽ · 83%</div>
          <div className="ds-eyebrow">Подпись капителью</div>
          <div className="ds-faint ds-num" style={{ fontSize: 11 }}>{DS_FONT.serif.split(',')[0]} · {DS_FONT.sans.split(',')[0]} · {DS_FONT.mono.split(',')[0]}</div>
        </Section>

        <Section title="Кнопки — тиснёный билет">
          <div style={{ display: 'grid', gap: 8 }}>
            <Button wide>Главная</Button>
            <Button wide variant="secondary" icon={BookOpenText}>Второстепенная</Button>
            <Button wide variant="ok">Верно — дальше</Button>
            <Button wide variant="bad">Неверно — дальше</Button>
            <Button wide disabled>Недоступна</Button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button small icon={Sparkles}>Маленькая</Button>
              <Button small variant="secondary">Вторая</Button>
              <Button variant="ghost">Ссылка-кнопка</Button>
              <IconButton label="Назад" icon={ArrowLeft} />
            </div>
          </div>
        </Section>

        <Section title="Карточки, панели, строки">
          <Card>
            <Heading level={3} title="Карточка-документ" sub="Двойная линейка по краю, как у бланка." />
            <Row label="Серия сейчас" value="3 дн." />
            <Row label="Всего опыта" value="120" />
          </Card>
          <MenuCard icon={BookOpenText} tone="#3E6FA8" title="Карточка-кнопка" text="Значок, заголовок, пояснение" />
          <Panel>Панель — утопленный фон для вторичного.</Panel>
          <div className="ds-row" style={{ alignItems: 'center', marginTop: 8 }}><span>Переключатель</span><Toggle on={on} label="Переключатель" onChange={setOn} /></div>
          <div style={{ marginTop: 10 }}><Field label="Поле ввода" placeholder="латиница, цифры, _" /></div>
          <span className="ds-badge">повторение</span>
        </Section>

        <Section title="Ответы">
          {['a', 'b', 'c'].map((k) => (
            <button key={k} type="button" className={`ds-opt ${k === 'a' ? 'right' : k === 'c' ? 'wrong' : ''}`} aria-pressed={pressed === k} onClick={() => setPressed(k)}>
              {k === 'a' ? 'Верный вариант после проверки' : k === 'b' ? 'Выбранный вариант' : 'Неверный вариант после проверки'}
            </button>
          ))}
          <div>
            <button type="button" className="ds-chip" aria-pressed="true">плитка выбрана</button>
            <button type="button" className="ds-chip">плитка</button>
            <button type="button" className="ds-key" style={{ width: 60 }}>7</button>
          </div>
          <div style={{ margin: '12px -16px 0' }}>
            <AnswerBar ok><div style={{ marginTop: 8 }}>Плашка верного ответа — оттиск штампа.</div></AnswerBar>
            <AnswerBar ok={false}><div style={{ marginTop: 8 }}>Правильно: <b>Дефицит</b>. Объяснение ошибки.</div></AnswerBar>
          </div>
        </Section>

        <Section title="Урок: график прогресса и Инфля">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProgressChart answers={[true, true, false, true, true, true]} total={10} pulse={0} testid="ds-progress" />
            <InflaMeter streak={streak} size={36} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button small variant="secondary" onClick={() => setStreak((s) => s + 1)}>Верно подряд: {streak}</Button>
            <Button small variant="ghost" onClick={() => setStreak(0)}>Ошибка — сдуться</Button>
          </div>
          <div className="ln-tickets" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            {[['Опыт', <CountUp key="x" value={23} prefix="+" />], ['Точность', '83%'], ['Время', '3:12']].map(([k, v]) => (
              <div key={k} style={{ border: '1px dashed var(--ds-rule2)', borderRadius: 3, padding: '8px 4px', textAlign: 'center', background: 'var(--ds-card)' }}>
                <div className="ds-eyebrow" style={{ fontSize: 10.5 }}>{k}</div><div className="ds-num" style={{ fontWeight: 700, fontSize: 21 }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Гильош, розетка, печать, марка">
          <Guilloche height={26} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '12px 0' }}>
            <Rosette size={96}><Mascot mood="party" size={48} /></Rosette>
            <Stamp text="ПРОЙДЕНО" center={<Check size={20} />} />
            <Stamp text="ПЕЧАТЬ ЮНИТА" center="№1" color="var(--u-ink)" rotate={8} />
            <PostStamp color={PLACES.scarcity.color} value={1} caption="Мастерская"><Engraving kind="workshop" alive size={78} color={PLACES.scarcity.color} /></PostStamp>
            <PostStamp color={PLACES['supply-demand'].color} value={2} caption="Рынок" dim><Engraving kind="market" size={78} color={PLACES['supply-demand'].color} /></PostStamp>
          </div>
        </Section>

        <Section title="Гравюры зданий: контур и «ожившее»">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {BUILDINGS.flatMap((b) => [false, true].map((alive) => (
              <div key={`${b}${alive}`} style={{ textAlign: 'center' }}>
                <Engraving kind={b} alive={alive} size={80} color={PLACES['money-banks'].color} />
                <div className="ds-num ds-faint" style={{ fontSize: 10.5 }}>{b}{alive ? ' · жив' : ''}</div>
              </div>
            )))}
          </div>
        </Section>

        <Section title="Вырезка из «Вестника» — история">
          <Clipping issue="№ 012" rubric="кофейня «Зерно»">
            <div className="ds-h2" style={{ marginBottom: 8 }}>Маша двигает цену</div>
            <div className="ds-text" style={{ fontFamily: 'var(--ds-serif)' }}><b>Маша.</b> Ищу цену, при которой и очереди нет, и стаканы не остаются.</div>
          </Clipping>
        </Section>

        <Section title="Верхняя панель, шторка, вкладки">
          <TopBar back={<IconButton label="Назад" icon={ArrowLeft} />} title="Учебник · Спрос и предложение" />
          <Sheetlike />
          <div style={{ marginTop: 12, border: '1px solid var(--ds-rule2)' }}>
            <Tabs tabs={[{ id: 'path', icon: Landmark, label: 'Путь' }, { id: 'practice', icon: Dumbbell, label: 'Практика' }, { id: 'book', icon: BookOpen, label: 'Мир' }, { id: 'p', icon: Coins, label: 'Профиль' }]}
              active="path" onTab={() => {}} label="Пример вкладок" />
          </div>
          <div className="ds-sub" style={{ fontSize: 13, marginTop: 8, display: 'flex', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flame size={15} />серия</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Coins size={15} />опыт</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Target size={15} />цель дня</span>
          </div>
        </Section>
      </div>
    </DsRoot>
  );
}

export default function DsShowcase() {
  return (
    <div data-testid="ds-showcase">
      <Showcase theme="paper" />
      <Showcase theme="ink" />
    </div>
  );
}
