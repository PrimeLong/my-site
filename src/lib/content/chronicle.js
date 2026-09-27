/* Выделено из engine.js: content/chronicle.js. Точка входа по-прежнему engine.js — он всё реэкспортирует. */
import { CONFIG, POLITICAL_REGIME_INFO, quarterLabel } from '../catalog.js';
import { CRISIS_INFO, fmt1, fmtSigned1 } from '../engine.js';

/* =========================================================================================
   РАЗБОР ПАРТИИ

   В конце партии игрок видел приговор («ВОЕННЫЙ ПЕРЕВОРОТ», «ВЫБОРЫ
   ПРОИГРАНЫ») и графики, но не ответ на главный вопрос: где именно всё
   пошло не так — или так. Эта функция читает историю кварталов и находит
   переломные моменты: начало и конец кризисов, срыв инфляции и её возврат
   к цели, рецессию, выборы, смену режима, пересечение долговых порогов,
   лучший и худший квартал. К каждому плохому повороту она ищет решение,
   которое ему предшествовало, — резкий сдвиг ставки, налогов, бюджетного
   импульса или режима курса за один–три квартала до этого. Причину она не
   доказывает, а показывает соседство во времени: «вот что вы сделали прямо
   перед этим». Этого обычно хватает, чтобы увидеть свою ошибку.

   Функция чистая и работает на снимках истории, которые уже хранятся в
   партии (одиночной и сетевой): ни новых полей, ни новой памяти не нужно.
========================================================================================= */
export const TAX_FIELDS = [
  ['incomeTaxRate', 'подоходный налог'], ['vatRate', 'НДС'], ['profitTaxRate', 'налог на прибыль'],
  ['socialContribRate', 'социальные взносы'], ['exciseRate', 'акцизы'], ['capitalTaxRate', 'налог на капитал'],
];
export const crisisName = (id, e) => {
  const info = CRISIS_INFO[id];
  if (!info) return id;
  return typeof info.label === 'function' ? info.label(e || {}) : info.label;
};

// самое заметное решение в одном переходе prev → cur (или null)
export function policyMoveBetween(prev, cur) {
  const moves = [];
  const dr = (cur.keyRate || 0) - (prev.keyRate || 0);
  if (Math.abs(dr) >= 1.5) moves.push({ w: Math.abs(dr) / 1.5, text: `ставка ${dr > 0 ? 'поднята' : 'снижена'} с ${fmt1(prev.keyRate)} до ${fmt1(cur.keyRate)}%` });
  TAX_FIELDS.forEach(([k, name]) => {
    const d = (cur[k] || 0) - (prev[k] || 0);
    if (Math.abs(d) >= 2) moves.push({ w: Math.abs(d) / 2, text: `${name} ${d > 0 ? 'поднят' : 'снижен'} с ${fmt1(prev[k])} до ${fmt1(cur[k])}%` });
  });
  const fi = cur.fiscalImpulse || 0;
  if (Math.abs(fi) >= 1.2) moves.push({ w: Math.abs(fi) / 1.2, text: `бюджетный импульс ${fi > 0 ? '+' : ''}${fmt1(fi)} п.п. ВВП — ${fi > 0 ? 'резкая раздача' : 'резкое сокращение'} расходов` });
  if (prev.fxRegime && cur.fxRegime && prev.fxRegime !== cur.fxRegime) {
    const nm = { free: 'плавающий', managed: 'управляемый', peg: 'фиксированный' };
    moves.push({ w: 1.5, text: `режим курса сменён: ${nm[prev.fxRegime] || prev.fxRegime} → ${nm[cur.fxRegime] || cur.fxRegime}` });
  }
  if (!moves.length) return null;
  return moves.sort((a, b) => b.w - a.w)[0];
}

// решение, предшествовавшее повороту в квартале i: смотрим 1–3 квартала назад
export function precedingMove(hist, i) {
  let best = null;
  for (let back = 0; back < 3; back++) {
    const j = i - back;
    if (j < 1) break;
    const m = policyMoveBetween(hist[j - 1], hist[j]);
    if (m && (!best || m.w > best.w)) best = { ...m, back };
  }
  if (!best) return null;
  return best.back === 0 ? `В том же квартале: ${best.text}.` : `За ${best.back} кв. до этого: ${best.text}.`;
}

export function gameChronicle(history) {
  const hist = (history || []).filter((h) => h && Number.isFinite(h.gdpGrowth));
  const events = [];
  if (hist.length < 2) return { events, summary: null };
  const labelOf = (h, i) => h.label || h.qLabel || quarterLabel(Number.isFinite(h.q) ? h.q : i);
  const push = (i, ev) => events.push({ q: Number.isFinite(hist[i].q) ? hist[i].q : i, label: labelOf(hist[i], i), ...ev });
  const crisisStart = {};
  let inflationOut = false; let growthRun = 0; let debtHigh = false;
  // смену режима отмечаем, только когда страна опускается ниже, чем была, или
  // возвращается к демократии: колебания «конфликт ↔ авторитаризм» в разборе —
  // шум, который вытеснял бы из списка всё остальное
  const REGIME_RANK = { democracy: 0, crisis: 1, authoritarian: 2, totalitarian: 3 };
  let worstRank = REGIME_RANK[hist[0].politicalRegime] || 0;

  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1]; const cur = hist[i];
    const tgt = Number.isFinite(cur.inflationTarget) ? cur.inflationTarget : CONFIG.target.inflation;
    const why = () => precedingMove(hist, i);

    // кризисы: начало и конец
    const was = new Set(prev.activeCrises || []); const now = new Set(cur.activeCrises || []);
    now.forEach((c) => {
      if (was.has(c)) return;
      crisisStart[c] = i;
      // в первом квартале «начавшийся» кризис — это стартовые условия сценария
      if (i === 1) {
        push(i, { kind: 'crisis', tone: 'bad', weight: 7, title: `Партия началась в кризисе: ${crisisName(c, cur).toLowerCase()}`,
          text: 'Это стартовые условия, а не чьё-то решение.' });
        return;
      }
      push(i, { kind: 'crisis', tone: 'bad', weight: 8, title: `Начался кризис: ${crisisName(c, cur).toLowerCase()}`,
        text: why() || 'Резких решений прямо перед этим не было — кризис вырос из накопленного дисбаланса или пришёл извне.' });
    });
    was.forEach((c) => {
      if (now.has(c)) return;
      const len = crisisStart[c] !== undefined ? i - crisisStart[c] : null;
      if (len !== null && len < 2) return;
      push(i, { kind: 'crisis-end', tone: 'good', weight: 6, title: `Кризис преодолён: ${crisisName(c, prev).toLowerCase()}`,
        text: len !== null ? `Он длился ${len} кв.` : 'Он тянулся с начала партии.' });
    });

    // инфляция: срыв и возврат к цели
    if (!inflationOut && cur.inflation > tgt + 3 && prev.inflation <= tgt + 3) {
      inflationOut = true;
      push(i, { kind: 'inflation', tone: 'bad', weight: 7, title: `Инфляция вырвалась: ${fmt1(cur.inflation)}% при цели ${fmt1(tgt)}%`,
        text: why() || 'Резких решений прямо перед этим не было — цены разогнали ожидания, курс или шок извне.' });
    } else if (inflationOut && Math.abs(cur.inflation - tgt) <= 1) {
      inflationOut = false;
      push(i, { kind: 'inflation-back', tone: 'good', weight: 6, title: `Инфляция возвращена к цели: ${fmt1(cur.inflation)}%`,
        text: 'Цены снова под контролем — теперь важно не отпустить ожидания.' });
    }

    // рецессия после периода роста
    if (cur.gdpGrowth < 0 && prev.gdpGrowth >= 0 && growthRun >= 2 && !now.has('recession')) {
      push(i, { kind: 'recession', tone: 'bad', weight: 6, title: `Экономика ушла в минус: ${fmt1(cur.gdpGrowth)}% годовых`,
        text: why() || 'Резких решений прямо перед этим не было.' });
    }
    growthRun = cur.gdpGrowth >= 0 ? growthRun + 1 : 0;

    // выборы
    if (cur.electionResult) {
      const le = cur.lastElection || {};
      const honest = Number.isFinite(cur.electionVoteShare) ? cur.electionVoteShare : null;
      const won = cur.electionResult === 'incumbent';
      if (le.coup) {
        push(i, { kind: 'election', tone: 'bad', weight: 11, title: `Выборы проиграны — итог не признан`,
          text: `За власть проголосовали ${honest !== null ? `${fmt1(honest)}%` : 'меньшинство'}, но результат объявлен недействительным: парламент распущен, режим одним скачком стал авторитарным.` });
      } else if (le.rigged) {
        /* Разбор — это кабинет, а не газета: здесь можно сказать правду.
           Официальная цифра — нарисованная, честная — та, что была бы без
           подтасовки. Раньше разбор печатал «выиграны — 3.7% голосов». */
        const official = Number.isFinite(le.nationalShare) ? `официально ${fmt1(le.nationalShare)}%` : 'официально — уверенная победа';
        push(i, { kind: 'election', tone: 'neutral', weight: 10, title: `Выборы «выиграны»: ${official}`,
          text: honest !== null ? `При честном подсчёте за власть было бы ${fmt1(honest)}% — выборы при несвободном режиме считают голоса, а не решают исход.`
            : 'Выборы при несвободном режиме считают голоса, а не решают исход.' });
      } else {
        const share = honest !== null ? ` — ${fmt1(honest)}% голосов` : '';
        push(i, { kind: 'election', tone: won ? 'good' : 'bad', weight: 10,
          title: won ? `Выборы выиграны${share}` : cur.electionResult === 'landslide' ? `Разгромное поражение на выборах${share}` : `Выборы проиграны${share}`,
          text: won ? 'Избиратели продлили мандат — рейтинг к урне был достаточным.'
            : `Рейтинг власти к выборам — ${Math.round(cur.approval)} из 100.` });
      }
    }

    // смена политического режима
    const curRank = REGIME_RANK[cur.politicalRegime] || 0;
    const regimeNews = prev.politicalRegime !== cur.politicalRegime
      && (curRank > worstRank || (cur.politicalRegime === 'democracy' && prev.politicalRegime !== 'democracy'));
    if (cur.politicalRegime === 'democracy') worstRank = 0; else worstRank = Math.max(worstRank, curRank);
    if (regimeNews) {
      const info = POLITICAL_REGIME_INFO[cur.politicalRegime] || {};
      const better = cur.politicalRegime === 'democracy';
      push(i, { kind: 'regime', tone: better ? 'good' : 'bad', weight: 10, title: `Режим: ${info.label || cur.politicalRegime}`,
        text: better ? 'Институты вернулись — рынки и доверие это заметят не сразу, но заметят.'
          : `Напряжение ${Math.round(cur.politicalTension || 0)} из 100 при рейтинге ${Math.round(cur.approval)} — так демократия и ломается.` });
    }

    // стабилизационная программа: рынок поверил, программа сорвана, цены остановлены
    const sPrev = prev.stabilizationCred || 0; const sCur = cur.stabilizationCred || 0;
    if (sPrev < 0.5 && sCur >= 0.5 && !cur.stabilizationWon) {
      push(i, { kind: 'stab-credible', tone: 'good', weight: 7, title: 'Рынок поверил стабилизационной программе',
        text: `Доверие к программе ${Math.round(sCur * 100)} из 100: реальная ставка ${fmtSigned1(cur.keyRate - prev.inflationExpectations)} п.п.${(cur.fiscalImpulse || 0) <= -0.3 || (prev.budgetBalancePctGdp || 0) >= -3 ? ', бюджет держит свою часть' : ''} — ожидания начали падать быстрее самих цен.` });
    } else if (sPrev >= 0.5 && sCur < sPrev * 0.5 && !cur.stabilizationWon) {
      push(i, { kind: 'stab-broken', tone: 'bad', weight: 8, title: 'Стабилизационная программа сорвана',
        text: precedingMove(hist, i) || 'Денежные условия ослаблены раньше, чем инфляция побеждена.' });
    }
    if (cur.stabilizationWon && !prev.stabilizationWon) {
      push(i, { kind: 'prices-stopped', tone: 'good', weight: 10, title: `Цены остановлены: инфляция ${fmt1(cur.inflation)}%`,
        text: 'Стабилизационная программа доведена до конца. Рецессия — её цена, но страна готова простить её тем, кто вернул деньгам смысл.' });
    }

    // долговые пороги
    if (!debtHigh && cur.debtToGdp > 90 && prev.debtToGdp <= 90) {
      debtHigh = true;
      push(i, { kind: 'debt', tone: 'bad', weight: 5, title: `Долг перешёл 90% ВВП`, text: why() || 'Долг копился постепенно — квартал за кварталом дефицита.' });
    } else if (debtHigh && cur.debtToGdp < 60) {
      debtHigh = false;
      push(i, { kind: 'debt-down', tone: 'good', weight: 5, title: `Долг снижен ниже 60% ВВП`, text: 'Бюджетная консолидация дала результат.' });
    }
  }

  // лучший и худший квартал — только если партия длинная и разброс заметный
  if (hist.length >= 6) {
    let bi = 1; let wi = 1;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].wellbeing > hist[bi].wellbeing) bi = i;
      if (hist[i].wellbeing < hist[wi].wellbeing) wi = i;
    }
    if (hist[bi].wellbeing - hist[wi].wellbeing >= 10) {
      // «лучшим» оказался самый первый квартал — это не успех, а констатация
      push(bi, { kind: 'best', tone: bi === 1 ? 'neutral' : 'good', weight: 4, title: `Лучший квартал: благополучие ${Math.round(hist[bi].wellbeing)}`,
        text: bi === 1 ? 'Лучше, чем в самом начале, не стало ни разу.' : 'Здесь всё сходилось — стоит запомнить, какой была политика.' });
      push(wi, { kind: 'worst', tone: 'bad', weight: 4, title: `Худший квартал: благополучие ${Math.round(hist[wi].wellbeing)}`, text: precedingMove(hist, wi) || 'Сюда пришли постепенно, без одного резкого решения.' });
    }
  }

  // самое резкое решение по ставке и что было через год
  let mi = -1; let md = 0;
  for (let i = 1; i < hist.length; i++) {
    const d = (hist[i].keyRate || 0) - (hist[i - 1].keyRate || 0);
    if (Math.abs(d) > Math.abs(md)) { md = d; mi = i; }
  }
  if (mi > 0 && Math.abs(md) >= 2) {
    const later = hist[Math.min(hist.length - 1, mi + 4)];
    const after = later === hist[mi] ? '' : ` Через ${Math.min(hist.length - 1, mi + 4) - mi} кв.: инфляция ${fmt1(hist[mi].inflation)} → ${fmt1(later.inflation)}%, безработица ${fmt1(hist[mi].unemployment)} → ${fmt1(later.unemployment)}%.`;
    push(mi, { kind: 'decision', tone: 'neutral', weight: 3, title: `Самое резкое решение по ставке: ${md > 0 ? '+' : ''}${fmt1(md)} п.п.`,
      text: `Ставка ${fmt1(hist[mi - 1].keyRate)} → ${fmt1(hist[mi].keyRate)}%.${after}` });
  }

  // не больше десяти самых весомых, в хронологическом порядке
  const top = [...events].sort((a, b) => b.weight - a.weight).slice(0, 10)
    .sort((a, b) => a.q - b.q || b.weight - a.weight);

  const first = hist[0]; const last = hist[hist.length - 1];
  const quarters = hist.length - 1;
  const gdpChange = (last.gdp / Math.max(1e-9, first.gdp) - 1) * 100;
  const avgInfl = hist.slice(1).reduce((a, h) => a + h.inflation, 0) / quarters;
  const elections = events.filter((e) => e.kind === 'election');
  const crises = events.filter((e) => e.kind === 'crisis').length;
  const summary = {
    quarters, gdpChange, avgInflation: avgInfl, crises,
    elections: elections.length, electionsWon: elections.filter((e) => e.tone === 'good').length,
    wellbeingStart: first.wellbeing, wellbeingEnd: last.wellbeing,
    debtStart: first.debtToGdp, debtEnd: last.debtToGdp,
  };
  return { events: top, summary };
}

