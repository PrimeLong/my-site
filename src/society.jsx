/* Общество: на ком держится власть. Рейтинг — взвешенная сумма поддержки семи
   социальных групп (см. SOCIAL_GROUPS в движке); здесь видно, кто в коалиции,
   кто колеблется, кого уже потеряли, что каждую группу двигает сейчас и какие
   решения она помнит. Грузится лениво, как и карта. */
import { AlertTriangle, Briefcase, HardHat, Heart, MapPin, Megaphone, Shield, Stethoscope, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { SOCIAL_GROUPS, groupStatus, coalitionOf, fmt1, fmtMoney, QUINTILES, FIRMS, FIRM_MODE_LABEL } from './lib/engine.js';
import { Audio, COLOR } from './MacroSimulator.jsx';

const GROUP_ICON = { pensioners: Heart, workers: HardHat, business: Briefcase, siloviki: Shield, public: Stethoscope, youth: Megaphone, regions: MapPin };
const statusColor = (v) => (v >= 50 ? COLOR.teal : v >= 35 ? COLOR.gold : COLOR.rust);
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt1(Math.abs(v))}`;

/* plan/onPlan — ответ на требование группы в этом квартале ({ groupResponse });
   без onPlan требование только показывается, отвечает planner. */
export function SocietyView({ economy, plan, onPlan, planner }) {
  const base = Number.isFinite(economy.approval) ? economy.approval : 50;
  // до первого квартала групп ещё нет: все стартуют с общего рейтинга
  const support = economy.groupSupport || Object.fromEntries(SOCIAL_GROUPS.map((g) => [g.id, base]));
  const prev = economy.groupSupportPrev || null;
  const coalition = coalitionOf(support);
  const lost = SOCIAL_GROUPS.filter((g) => support[g.id] < 35);
  const unfree = economy.politicalRegime === 'authoritarian' || economy.politicalRegime === 'totalitarian';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {economy.groupDemand && <DemandPanel demand={economy.groupDemand} economy={economy} plan={plan} onPlan={onPlan} planner={planner} />}
      {!economy.groupDemand && economy.lastGroupResolution && (
        <div style={{ fontSize: 12, color: COLOR.muted }}>
          Последнее требование — {economy.lastGroupResolution.title.toLowerCase()}: {economy.lastGroupResolution.byDefault
            ? 'ответа не было, это сочли отказом' : `ответ «${economy.lastGroupResolution.label.toLowerCase()}»`}.
        </div>
      )}
      <div className="ems-panel" style={{ padding: 16 }} aria-label="Коалиция власти">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, flexWrap: 'wrap' }}>
          <Users size={17} color={COLOR.gold} />
          <span className="ems-serif" style={{ fontSize: 16 }}>Общество: на ком держится власть</span>
          <span className="ems-mono" style={{ marginLeft: 'auto', fontSize: 12, color: COLOR.muted }}>рейтинг {Math.round(base)} из 100</span>
        </div>
        <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.55, marginBottom: 12 }}>
          Рейтинг — взвешенная сумма поддержки семи групп. Любое решение выигрывает у одних и проигрывает у других,
          а группы помнят решения кварталами. Выборы, протесты и перевороты вырастают из того, кого вы потеряли.
          {unfree && ' При несвободном режиме это закрытые данные: публичные опросы о них молчат.'}
        </div>
        {/* полоса коалиции: ширина — вес группы, цвет — её отношение к власти. На узком
            экране подписи в сегменты не помещаются и налезают друг на друга — там их нет,
            названия идут строкой ниже */}
        <style>{'.soc-seg-label { overflow: hidden; text-overflow: ellipsis; max-width: 100%; } .soc-legend { display: none; } @media (max-width: 720px) { .soc-seg-label { display: none; } .soc-legend { display: flex; } }'}</style>
        <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: `1px solid ${COLOR.border}`, marginBottom: 6 }}>
          {SOCIAL_GROUPS.map((g) => (
            <div key={g.id} title={`${g.name}: ${Math.round(support[g.id])} — ${groupStatus(support[g.id])}`}
              style={{ width: `${g.weight * 100}%`, background: `${statusColor(support[g.id])}${support[g.id] >= 50 ? 'cc' : '55'}`,
                borderRight: `1px solid ${COLOR.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <span className="soc-seg-label" style={{ fontSize: 12, color: support[g.id] >= 50 ? COLOR.ink : COLOR.text, whiteSpace: 'nowrap', padding: '0 3px' }}>{g.name}</span>
            </div>
          ))}
        </div>
        <div className="soc-legend" style={{ flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, marginBottom: 8 }}>
          {SOCIAL_GROUPS.map((g) => (
            <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: COLOR.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: statusColor(support[g.id]) }} />
              {g.name} <b className="ems-mono" style={{ color: COLOR.text }}>{Math.round(support[g.id])}</b>
            </span>
          ))}
        </div>
        <div style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.5 }}>
          Коалиция власти: <b style={{ color: coalition.weight >= 0.5 ? COLOR.teal : COLOR.rust }}>{Math.round(coalition.weight * 100)}% политического веса</b>
          {coalition.members.length ? ` — ${coalition.members.map((id) => SOCIAL_GROUPS.find((g) => g.id === id).name.toLowerCase()).join(', ')}` : ' — ни одной группы'}.
          {coalition.weight < 0.5 && (
            <span style={{ color: COLOR.rust }}> Коалиция в меньшинстве: власть держится не на поддержке, а на {unfree ? 'силе' : 'инерции'}.</span>
          )}
        </div>
        {lost.length > 0 && (
          <div style={{ fontSize: 12, color: COLOR.rust, marginTop: 6, lineHeight: 1.5 }}>
            В оппозиции: {lost.map((g) => g.name.toLowerCase()).join(', ')} — их лидеры переходят к делу.
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
        {SOCIAL_GROUPS.map((g) => (
          <GroupCard key={g.id} g={g} v={support[g.id]} prevV={prev ? prev[g.id] : null}
            drivers={(economy.groupDriversNow || {})[g.id] || []}
            memory={(economy.groupMemory || []).filter((m) => m.group === g.id)} />
        ))}
      </div>
      <IncomePanel economy={economy} />
      <FirmsPanel economy={economy} />
    </div>
  );
}

function DemandPanel({ demand, economy, plan, onPlan, planner }) {
  const g = SOCIAL_GROUPS.find((x) => x.id === demand.group);
  const chosen = plan && plan.groupResponse;
  const Icon = GROUP_ICON[demand.group] || Users;
  return (
    <div className="ems-panel" style={{ padding: 14, borderLeft: `3px solid ${COLOR.rust}` }} aria-label="Требование группы">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={15} color={COLOR.rust} />
        <span className="ems-serif" style={{ fontSize: 15 }}>{demand.title}</span>
        <Icon size={14} color={COLOR.muted} style={{ marginLeft: 'auto' }} />
        <span style={{ fontSize: 12, color: COLOR.faint }}>{g ? g.name : ''}</span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.text, lineHeight: 1.55, marginBottom: 9 }}>
        <b>{demand.leader.name}</b>, {demand.leader.title}: {demand.text}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 6 }}>
        {demand.options.map((o) => {
          const active = chosen === o.id;
          const cost = o.spend ? `~${fmtMoney(economy.nominalGdp * o.spend / 100)}` : 'без затрат';
          const pick = () => { Audio.play('tick'); onPlan({ ...plan, groupResponse: active ? null : o.id }); };
          return (
            <div key={o.id} role={onPlan ? 'button' : undefined} tabIndex={onPlan ? 0 : undefined} aria-pressed={onPlan ? active : undefined}
              className={onPlan ? 'ems-card-btn' : undefined}
              onClick={onPlan ? pick : undefined} onKeyDown={onPlan ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
              style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, borderRadius: 3,
                cursor: onPlan ? 'pointer' : 'default', border: `1px solid ${active ? COLOR.gold : COLOR.border}`, background: active ? COLOR.goldDim : COLOR.panelAlt }}>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? COLOR.goldSoft : COLOR.text }}>{o.label}</span>
              <span className="ems-mono" style={{ fontSize: 12, color: COLOR.faint }}>
                {cost} · {g ? g.name.toLowerCase() : 'группа'} <span style={{ color: o.support >= 0 ? COLOR.teal : COLOR.rust }}>{o.support > 0 ? '+' : '−'}{Math.abs(o.support)}</span>
              </span>
              <span style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.4 }}>{o.effect}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginTop: 8 }}>
        {onPlan ? (chosen ? 'Ответ применится в конце квартала.' : 'Без ответа это будет отказ.') : `Отвечает ${planner || 'Минфин'}.`}
      </div>
    </div>
  );
}

function GroupCard({ g, v, prevV, drivers, memory }) {
  const Icon = GROUP_ICON[g.id] || Users;
  const c = statusColor(v);
  const delta = Number.isFinite(prevV) ? v - prevV : null;
  const top = [...drivers].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  // одно и то же решение могло оставить память по нескольким поводам — складываем по подписи
  const mem = Object.values(memory.reduce((acc, m) => {
    const k = m.text;
    acc[k] = acc[k] || { text: k, amount: 0, left: m.left };
    acc[k].amount += (m.amount * m.left) / m.total;
    acc[k].left = Math.max(acc[k].left, m.left);
    return acc;
  }, {})).filter((m) => Math.abs(m.amount) >= 0.5).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 3);
  return (
    <div className="ems-panel" style={{ padding: 14, borderLeft: `3px solid ${c}` }} aria-label={`${g.name}: ${Math.round(v)} из 100, ${groupStatus(v)}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={16} color={c} />
        <span className="ems-serif" style={{ fontSize: 15 }}>{g.name}</span>
        <span style={{ fontSize: 12, color: COLOR.faint }}>вес {Math.round(g.weight * 100)}%</span>
        <span className="ems-numeral" style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, color: c }}>{Math.round(v)}</span>
        {delta != null && Math.abs(delta) >= 0.5 && (delta > 0
          ? <TrendingUp size={14} color={COLOR.teal} aria-label={`за квартал ${signed(delta)}`} />
          : <TrendingDown size={14} color={COLOR.rust} aria-label={`за квартал ${signed(delta)}`} />)}
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: COLOR.panelAlt, marginBottom: 4 }}>
        <div style={{ width: `${v}%`, height: '100%', borderRadius: 3, background: c }} />
        {[35, 50].map((m) => <span key={m} style={{ position: 'absolute', left: `${m}%`, top: -2, bottom: -2, width: 1.5, background: COLOR.text, opacity: 0.55 }} />)}
      </div>
      <div style={{ display: 'flex', fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: c, fontWeight: 600 }}>{groupStatus(v)}</span>
        {delta != null && <span className="ems-mono" style={{ marginLeft: 'auto', color: COLOR.faint }}>за квартал {signed(delta)}</span>}
      </div>
      <div style={{ fontSize: 12, color: COLOR.text, marginBottom: 4 }}>{g.leader.name}, <span style={{ color: COLOR.muted }}>{g.leader.title}</span></div>
      <div style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45, marginBottom: 8 }}>Хотят: {g.wants}</div>
      <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 3 }}>Сейчас двигает</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {top.length ? top.map(([k, val]) => (
          <span key={k} className="ems-mono" style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, border: `1px solid ${COLOR.border}`,
            color: val >= 0 ? COLOR.teal : COLOR.rust }}>{k} {signed(val)}</span>
        )) : <span style={{ fontSize: 12, color: COLOR.faint }}>ничего сверх общего фона</span>}
      </div>
      {mem.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: COLOR.faint, marginBottom: 3 }}>Помнят</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            {mem.map((m) => (
              <div key={m.text} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                <span style={{ color: COLOR.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</span>
                <span className="ems-mono" style={{ color: m.amount >= 0 ? COLOR.teal : COLOR.rust }}>{signed(m.amount)}</span>
                <span style={{ color: COLOR.faint }}>ещё {m.left} кв.</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 12, lineHeight: 1.45, padding: v < 35 ? '6px 8px' : 0, borderRadius: 3,
        background: v < 35 ? COLOR.rustDim : 'none', color: v < 35 ? COLOR.rust : COLOR.faint }}>
        {v < 35 ? 'Потеряны: ' : 'Если потерять: '}{g.lost}
      </div>
    </div>
  );
}

/* Доходы по слоям: пять квинтилей от беднейших 20% до богатейших. Показывает то, чего
   не видно в средних цифрах: у кого реальные доходы растут, у кого падают, чья
   инфляция выше и на кого как ложатся налоги. */
function IncomePanel({ economy }) {
  const d = economy.distribution;
  if (!d || !Array.isArray(d.quintiles)) return null;
  const maxTax = Math.max(...d.quintiles.map((q) => q.taxBurden), 1);
  const giniTone = d.gini > 0.42 ? COLOR.rust : d.gini > 0.37 ? COLOR.gold : COLOR.teal;
  return (
    <div className="ems-panel" style={{ padding: 16 }} aria-label="Доходы по слоям">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <span className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft }}>Доходы по слоям</span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>неравенство (Джини) <b className="ems-mono" style={{ color: giniTone }}>{d.gini.toFixed(3).replace('.', ',')}</b></span>
        <span style={{ fontSize: 12, color: COLOR.muted }}>за чертой бедности <b className="ems-mono" style={{ color: COLOR.text }}>{fmt1(d.povertyRate)}%</b></span>
      </div>
      <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.5, marginBottom: 10 }}>
        Пять групп по 20% населения. Инфляция у бедных выше — в их корзине больше еды и коммуналки. НДС ложится на тех, кто тратит весь доход,
        подоходный — на зарплаты, налог на капитал — на верхний слой. Трансферты — больше половины дохода беднейших.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 1.2fr) repeat(3, minmax(0, 1fr))', gap: '6px 10px', fontSize: 12, alignItems: 'center' }}>
        <span style={{ color: COLOR.faint }}>Слой</span>
        <span style={{ color: COLOR.faint }}>Реальный доход за год</span>
        <span style={{ color: COLOR.faint }}>Своя инфляция</span>
        <span style={{ color: COLOR.faint }}>Налоги, % дохода</span>
        {d.quintiles.map((q, i) => (
          <Row key={q.id} name={QUINTILES[i].name} q={q} maxTax={maxTax} />
        ))}
      </div>
    </div>
  );
}
function Row({ name, q, maxTax }) {
  const up = q.realYoY >= 0;
  return (
    <>
      <span style={{ color: COLOR.text }}>{name}</span>
      <span className="ems-mono" style={{ color: Math.abs(q.realYoY) < 0.05 ? COLOR.muted : up ? COLOR.teal : COLOR.rust }}>
        {up ? '+' : '−'}{fmt1(Math.abs(q.realYoY))}%
      </span>
      <span className="ems-mono" style={{ color: COLOR.text }}>{fmt1(q.inflation)}%</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 3, background: COLOR.border, overflow: 'hidden', minWidth: 30 }}>
          <span style={{ display: 'block', height: '100%', width: `${(q.taxBurden / maxTax) * 100}%`, background: COLOR.gold }} />
        </span>
        <span className="ems-mono" style={{ color: COLOR.muted, minWidth: 30, textAlign: 'right' }}>{Math.round(q.taxBurden)}</span>
      </span>
    </>
  );
}

/* Крупный бизнес: те же компании, что в «Своём деле». Их здоровье — от ставки, налога
   на прибыль, спроса, курса и мирового рынка; сокращают людей — неспокойно в их областях. */
function FirmsPanel({ economy }) {
  const firms = economy.firms;
  if (!firms) return null;
  return (
    <div className="ems-panel" style={{ padding: 16 }} aria-label="Крупный бизнес">
      <div className="ems-serif" style={{ fontSize: 16, color: COLOR.goldSoft, marginBottom: 4 }}>Крупный бизнес</div>
      <div style={{ fontSize: 12, color: COLOR.faint, lineHeight: 1.5, marginBottom: 10 }}>
        Дорогой кредит и высокий налог на прибыль давят на всех, слабый курс помогает экспортёрам и бьёт по ритейлу.
        Ниже 30 компания сокращает людей, выше 70 — расширяется.
      </div>
      {FIRMS.map((f) => {
        const x = firms[f.id] || { health: 60, mode: 'steady' };
        const tone = x.mode === 'gone' ? COLOR.faint : x.health < 30 ? COLOR.rust : x.health > 70 ? COLOR.teal : COLOR.gold;
        return (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(60px,1fr) auto', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${COLOR.hairline}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: COLOR.faint }}>{f.sector}</div>
            </div>
            <span style={{ height: 5, borderRadius: 3, background: COLOR.border, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${x.health}%`, background: tone }} />
            </span>
            <span style={{ fontSize: 12, color: tone, whiteSpace: 'nowrap' }}>{FIRM_MODE_LABEL[x.mode] || x.mode}</span>
          </div>
        );
      })}
    </div>
  );
}
