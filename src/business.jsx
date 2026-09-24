/* Кабинет предпринимателя: решения компании на квартал с живым прогнозом и отчёт
   о том, чем закончился прошлый. Грузится отдельным чанком — он нужен только тем,
   кто выбрал эту роль. Модель самой компании — в src/lib/business.js. */
import React, { useMemo } from 'react';
import { Factory, Banknote, Users, TrendingUp, AlertTriangle, Handshake, Globe2 } from 'lucide-react';
import { COLOR, Audio } from './MacroSimulator.jsx';
import { Sparkline } from './game.jsx';
import { fmtMln, fmtMlnSigned, fmt1 } from './lib/engine.js';
import {
  SECTORS, companyPreview, companyValue, ownerWealth, creditLimit, totalDebt, marketShare,
} from './lib/business.js';

const pct = (v) => `${Math.round(v * 100)}%`;

function PlanSlider({ label, hint, value, min, max, step, onChange, format, disabled }) {
  const p = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const track = { background: `linear-gradient(90deg, ${COLOR.gold} 0%, ${COLOR.gold} ${p}%, ${COLOR.border} ${p}%, ${COLOR.border} 100%)` };
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.hairline}`, padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12.5 }}>{label}</span>
        <span className="ems-mono" style={{ fontSize: 12.5, color: COLOR.goldSoft, fontWeight: 600 }}>{format(value)}</span>
      </div>
      {hint && <div style={{ fontSize: 10.5, color: COLOR.faint, marginTop: 1, lineHeight: 1.4 }}>{hint}</div>}
      <input type="range" className="ems-slider" style={{ ...track, width: '100%', marginTop: 7 }} min={min} max={max} step={step}
        value={value} disabled={disabled} aria-label={`${label}: ${format(value)}`}
        onChange={(e) => { Audio.play('tick'); onChange(parseFloat(e.target.value)); }} />
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, label, hint, disabled }) {
  return (
    <button className="ems-btn" disabled={disabled} aria-pressed={on} onClick={() => { Audio.play('click'); onClick(); }}
      style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 10px', marginTop: 8,
        borderColor: on ? COLOR.gold : COLOR.border, background: on ? COLOR.goldDim : COLOR.panelAlt }}>
      <Icon size={14} color={on ? COLOR.gold : COLOR.muted} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, color: on ? COLOR.goldSoft : COLOR.text }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: COLOR.faint, marginTop: 2, lineHeight: 1.4 }}>{hint}</span>
      </span>
    </button>
  );
}

function Row({ k, v, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
      <span style={{ color: COLOR.muted }}>{k}</span>
      <span className="ems-mono" style={{ color: color || COLOR.text, fontWeight: strong ? 600 : 400 }}>{v}</span>
    </div>
  );
}

/* Решения компании. Всё, что меняется ползунками, сразу пересчитывается в прогноз
   квартала по нынешней экономике — без случайных событий: забастовка, проверка или
   госзаказ появятся уже в итоге. */
export function CompanyPanel({ company, plan, setPlan, economy, goalLabel, disabled }) {
  const sector = SECTORS.find((s) => s.id === company.sector) || SECTORS[0];
  const pv = useMemo(() => companyPreview(company, plan, economy), [company, plan, economy]);
  const set = (k) => (v) => setPlan((p) => ({ ...p, [k]: v }));
  const limit = creditLimit(company, economy);
  const debt = totalDebt(company, economy);
  const maxRepay = Math.max(0, Math.min(debt, company.cash));
  const hard = economy.politicalRegime === 'authoritarian' || economy.politicalRegime === 'totalitarian';
  const bottleneck = pv.output < pv.capacity * 0.98 ? 'люди' : 'мощности';
  const cashAfterColor = pv.cash < 0 ? COLOR.rust : pv.cash < 30 ? COLOR.gold : COLOR.teal;
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Factory size={14} />{sector.title}: решения на квартал
      </div>
      <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 6 }}>Цель: {goalLabel}</div>

      <PlanSlider label="Цена к рынку" value={plan.markup} min={-15} max={25} step={1} disabled={disabled}
        hint={`Дороже конкурентов — выше маржа, но покупатели уходят (чувствительность спроса у отрасли ${sector.id === 'retail' ? 'высокая' : sector.id === 'builder' ? 'низкая' : 'средняя'}).`}
        format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={set('markup')} />
      <PlanSlider label="Надбавка к рыночной зарплате" value={plan.wagePremium} min={-10} max={30} step={1} disabled={disabled}
        hint="Платите больше рынка — легче нанимать и выше выработка. Урезание при низкой безработице грозит забастовкой."
        format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={set('wagePremium')} />
      <PlanSlider label="Найм или сокращение" value={plan.hire} min={-25} max={25} step={1} disabled={disabled}
        hint={`Сейчас ${company.staff} чел. Сокращение стоит полквартала зарплаты уволенных; при безработице ${fmt1(economy.unemployment)}% нанять можно не больше ${Math.round(Math.min(25, Math.max(5, 25 * (economy.unemployment - 2) / 5)))}% штата${plan.wagePremium > 8 ? ' (+5% за высокую надбавку)' : ''}.`}
        format={(v) => `${v > 0 ? '+' : ''}${v}%`} onChange={set('hire')} />
      <PlanSlider label="Расширение мощностей" value={plan.expand} min={0} max={20} step={1} disabled={disabled}
        hint={`Строится два квартала. Сейчас мощность ${Math.round(pv.capacity)} ед. в квартал; ${plan.expand > 0 ? `это обойдётся в ${fmtMln(pv.capexCost)}` : 'часть оборудования импортная — дорожает вместе с курсом'}.`}
        format={(v) => `+${v}%`} onChange={set('expand')} />
      <PlanSlider label={plan.borrow >= 0 ? 'Взять кредит' : 'Погасить долг'} value={Math.max(-maxRepay, Math.min(limit, plan.borrow))}
        min={-Math.round(maxRepay)} max={Math.round(limit)} step={5} disabled={disabled || (limit < 5 && maxRepay < 5)}
        hint={`Банки готовы дать ещё ${fmtMln(limit)}${economy.creditCrunch ? ' — идёт кредитное сжатие' : ''}. Долг ${fmtMln(debt)}, средняя ставка ${fmt1(company.loanRate || economy.lendingRate)}%.`}
        format={(v) => (v >= 0 ? `+${fmtMln(v)}` : `−${fmtMln(-v)}`)} onChange={set('borrow')} />
      {company.sector === 'factory' && (
        <PlanSlider label="Доля выпуска на экспорт" value={plan.exportShare} min={0} max={70} step={5} disabled={disabled}
          hint={`Экспорт продаётся в валюте: слабый курс выгоден. Внешний спрос сейчас до ${Math.round(pv.expDemand)} ед.${(economy.sanctionsQuartersLeft || 0) > 0 ? ' Санкции закрыли часть рынков.' : ''}`}
          format={(v) => `${v}%`} onChange={set('exportShare')} />
      )}
      <PlanSlider label="Дивиденды владельцу" value={plan.dividend} min={0} max={100} step={5} disabled={disabled}
        hint="Доля чистой прибыли, которую вы забираете себе. Выплаченное уже не отнять — даже если компания потом разорится."
        format={(v) => `${v}%`} onChange={set('dividend')} />
      <Toggle on={plan.fxLoan} disabled={disabled} icon={Globe2} onClick={() => setPlan((p) => ({ ...p, fxLoan: !p.fxLoan }))}
        label={`Новые кредиты в валюте: ${plan.fxLoan ? 'да' : 'нет'}`}
        hint={`Валютная ставка ${fmt1((economy.worldRate ?? 3) + (economy.riskPremium ?? 1.4) + 2.5)}% против ${fmt1(economy.lendingRate)}% в рублях — но долг растёт вместе с курсом.`} />
      <Toggle on={plan.gr} disabled={disabled} icon={Handshake} onClick={() => setPlan((p) => ({ ...p, gr: !p.gr }))}
        label={`Работа с властями (GR): ${plan.gr ? 'ведётся' : 'нет'}`}
        hint={`1,2% выручки. Реже проверки${hard ? ' — при нынешнем режиме это важнее всего' : ''}, чаще госзаказы.`} />

      <div style={{ marginTop: 12, padding: '10px 11px', background: COLOR.panelAlt, border: `1px solid ${COLOR.border}` }}>
        <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 5 }}>Прогноз квартала при нынешней экономике</div>
        <Row k="Спрос / выпуск" v={`${Math.round(pv.domDemand + (company.sector === 'factory' ? Math.min(pv.expDemand, pv.output * plan.exportShare / 100) : 0))} / ${Math.round(pv.output)} ед.`} />
        <Row k="Загрузка мощностей" v={`${pct(pv.utilization)} · предел: ${bottleneck}`} />
        <Row k="Выручка" v={fmtMln(pv.revenue)} />
        <Row k="EBITDA" v={fmtMlnSigned(pv.ebitda)} color={pv.ebitda < 0 ? COLOR.rust : COLOR.text} />
        <Row k="Чистая прибыль" v={fmtMlnSigned(pv.netProfit)} color={pv.netProfit < 0 ? COLOR.rust : COLOR.teal} strong />
        <Row k="Деньги на конец квартала" v={fmtMln(pv.cash)} color={cashAfterColor} strong />
        {pv.cash < 0 && (
          <div style={{ fontSize: 11, color: COLOR.rust, marginTop: 5, display: 'flex', gap: 6, lineHeight: 1.4 }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />Денег не хватит. Банк закроет разрыв в пределах лимита — два квартала подряд без денег означают банкротство.
          </div>
        )}
      </div>
    </div>
  );
}

// отчёт компании: где она сейчас и чем закончился прошлый квартал
export function CompanyReport({ company, economy }) {
  const value = companyValue(company, economy);
  const wealth = ownerWealth(company, economy);
  const debt = totalDebt(company, economy);
  const share = marketShare(company, economy);
  const last = company.last;
  const series = company.history.map((h) => h.wealth).filter(Number.isFinite);
  const kpis = [
    ['Состояние владельца', fmtMln(wealth), 'в ценах старта: доля + выплаченное', COLOR.gold],
    ['Стоимость компании', fmtMln(value), 'оценка рынка за вычетом долга', COLOR.text],
    ['Деньги', fmtMln(company.cash), company.cash < 30 ? 'запас на исходе' : 'на счетах', company.cash < 30 ? COLOR.rust : COLOR.text],
    ['Долг', fmtMln(debt), company.debtFx > 0 ? `из них валютный ${fmtMln(company.debtFx * (economy.exchangeRate || 100) / 100)}` : 'весь в рублях', COLOR.text],
    ['Штат', `${company.staff} чел.`, `мощность ${Math.round(company.capacity)} ед.`, COLOR.text],
    ['Доля рынка', `${fmt1(share)}%`, `лояльность покупателей ${Math.round(company.brand * 100)}`, COLOR.text],
  ];
  return (
    <div className="ems-panel" style={{ padding: 14 }}>
      <div className="ems-serif" style={{ fontSize: 14, color: COLOR.goldSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <TrendingUp size={14} />Компания
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {kpis.map(([k, v, sub, color]) => (
          <div key={k} style={{ background: COLOR.panelAlt, border: `1px solid ${COLOR.border}`, padding: '8px 10px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: COLOR.faint }}>{k}</div>
            <div className="ems-mono" style={{ fontSize: 16, color, fontWeight: 600, marginTop: 2 }}>{v}</div>
            <div style={{ fontSize: 10, color: COLOR.faint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
          </div>
        ))}
      </div>
      {series.length >= 2 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10.5, color: COLOR.faint, marginBottom: 3 }}>Состояние владельца по кварталам</div>
          <Sparkline series={series} color={COLOR.gold} height={34} area />
        </div>
      )}
      {last ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: COLOR.faint, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Banknote size={12} />Итоги прошлого квартала
          </div>
          <Row k="Продано" v={`${Math.round(last.sold)} ед.${last.exported > 0 ? ` (экспорт ${Math.round(last.exported)})` : ''}`} />
          <Row k="Выручка" v={fmtMln(last.revenue)} />
          <Row k="Сырьё и комплектующие" v={`−${fmtMln(last.materials)}`} />
          <Row k="Зарплаты" v={`−${fmtMln(last.wages)}`} />
          <Row k="Аренда, содержание, прочее" v={`−${fmtMln(last.fixed)}`} />
          <Row k="Проценты по долгу" v={`−${fmtMln(last.interest)}`} />
          <Row k="Налог на прибыль" v={`−${fmtMln(last.tax)}`} />
          {last.fine > 0 && <Row k="Штрафы и «взносы»" v={`−${fmtMln(last.fine)}`} color={COLOR.rust} />}
          <Row k="Чистая прибыль" v={fmtMlnSigned(last.netProfit)} color={last.netProfit < 0 ? COLOR.rust : COLOR.teal} strong />
          {last.dividends > 0 && <Row k="Выплачено вам" v={fmtMln(last.dividends)} color={COLOR.gold} />}
          {last.log.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {last.log.map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: COLOR.muted, lineHeight: 1.45, paddingLeft: 8, borderLeft: `2px solid ${COLOR.border}` }}>{t}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 11.5, color: COLOR.muted, lineHeight: 1.5, display: 'flex', gap: 7 }}>
          <Users size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          Компания уже работает: штат подобран под нынешний спрос. Решите, что менять в первом квартале, — или оставьте как есть и посмотрите, куда её понесёт экономика.
        </div>
      )}
    </div>
  );
}
