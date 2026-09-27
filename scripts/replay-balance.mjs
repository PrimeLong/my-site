/* ============================================================================
   БАЛАНС НА ЖИВЫХ ПАРТИЯХ

   scripts/balance.mjs играет ботом против бота — стратегию живого человека,
   которая ломает игру, он не найдёт. Этот скрипт берёт журналы решений реальных
   партий (decisionLog в сохранении: рычаги ведомства игрока по кварталам) и
   переигрывает их на других случайных семенах: те же решения игрока, соседнее
   ведомство — бот. Рядом — та же партия целиком ботами. Разница показывает, где
   живая стратегия систематически лучше ботов (кандидат в эксплойт) или хуже
   (слишком сурово или непонятно).

   Оговорка: решения человека переигрываются как есть, без реакции на новый
   ход событий, — поэтому смотреть стоит на стратегии, которые выигрывают почти
   на всех семенах: они выигрывают не удачей, а устройством модели.

   Запуск:
     node scripts/replay-balance.mjs --dir saves/        — JSON-файлы сохранений
     node scripts/replay-balance.mjs --store             — все соло-слоты из хранилища
                                                           (нужны KV_REST_API_URL/TOKEN)
     BALANCE_SEEDS=24 node scripts/replay-balance.mjs …  — больше семян (по умолчанию 12)
============================================================================ */
import fs from 'fs';
import path from 'path';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry } from '../src/lib/engine.js';
import { withSeededRandom } from '../src/lib/catalog.js';

const SEEDS = Number(process.env.BALANCE_SEEDS || 12);
const MIN_LOG = 8;
const args = process.argv.slice(2);

async function loadSnapshots() {
  const out = [];
  const di = args.indexOf('--dir');
  if (di >= 0) {
    const dir = args[di + 1];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { /* не сохранение */ }
    }
  }
  if (args.includes('--store')) {
    const { scanSoloSlots } = await import('../api/_lib/store.js');
    for (const slots of await scanSoloSlots()) {
      (Array.isArray(slots) ? slots : []).forEach((sl) => { if (sl && sl.snapshot) out.push(sl.snapshot); });
    }
  }
  return out.filter((s) => s && s.setup && Array.isArray(s.decisionLog) && s.decisionLog.length >= MIN_LOG
    && ['central_bank', 'ministry_finance', 'full_control'].includes(s.setup.role));
}

// одна партия: human — журнал решений игрока или null (тогда обе ветви ведут боты)
function play(snap, seed, human) {
  const { setup } = snap;
  return withSeededRandom(seed, () => {
    let e = makeInitialEconomy(setup.scenario || 'sandbox');
    if (setup.economyOnly) e = { ...e, economyOnly: true };
    let pending = []; let cd = {}; let stories = [];
    const res = { lost: 0, landslide: 0, hyper: 0, autocracy: 0, crisisQ: 0, quarters: 0 };
    const log = snap.decisionLog;
    for (let i = 0; i < log.length; i++) {
      const cb = botCentralBank(e, setup.cbPersona || 'pragmatic', setup.difficulty || 'medium');
      const mof = botFinanceMinistry(e, setup.mofPersona || 'technocrat', setup.difficulty || 'medium');
      let d = { ...defaultDecisions(e), ...cb.decisions, ...mof.decisions };
      if (human) d = { ...d, ...log[i].d };
      const r = simulateQuarter({ economy: e, decisions: d, pendingImpulses: pending, eventCooldowns: cd, difficulty: setup.difficulty || 'medium',
        quarterIndex: i + 1, stories, botAction: cb, botActions: [mof] });
      e = r.economy; pending = r.pendingImpulses; cd = r.eventCooldowns; stories = r.stories;
      res.quarters += 1;
      if (e.electionResult === 'opposition' || e.electionResult === 'landslide') res.lost = 1;
      if (e.electionResult === 'landslide') res.landslide = 1;
      if (e.inflation > 50) res.hyper = 1;
      if (e.politicalRegime === 'authoritarian' || e.politicalRegime === 'totalitarian') res.autocracy = 1;
      if ((e.activeCrises || []).length) res.crisisQ += 1;
    }
    return { ...res, wellbeing: e.wellbeing, debt: e.debtToGdp, inflation: e.inflation };
  });
}

const avg = (list, k) => list.reduce((a, x) => a + x[k], 0) / Math.max(1, list.length);
const pct = (v) => `${Math.round(v * 100)}%`;

const snaps = await loadSnapshots();
if (!snaps.length) {
  console.log(`Нет партий с журналом решений (нужно ≥ ${MIN_LOG} кварталов, роли ЦБ / Минфин / премьер). Укажите --dir или --store.`);
  process.exit(0);
}
console.log(`Партий: ${snaps.length}, семян на партию: ${SEEDS}\n`);
console.log('| партия | роль | сценарий | кв. | выборы проиграны: игрок / боты | кризис: игрок / боты | благополучие: игрок / боты | вывод |');
console.log('|---|---|---|---:|---:|---:|---:|---|');
const flagged = [];
snaps.forEach((snap, n) => {
  const human = []; const bots = [];
  for (let sd = 1; sd <= SEEDS; sd++) { human.push(play(snap, sd * 7919 + n, true)); bots.push(play(snap, sd * 7919 + n, false)); }
  const hw = avg(human, 'wellbeing'); const bw = avg(bots, 'wellbeing');
  const hl = avg(human, 'lost'); const bl = avg(bots, 'lost');
  const hc = avg(human, 'crisisQ') / snap.decisionLog.length; const bc = avg(bots, 'crisisQ') / snap.decisionLog.length;
  // эксплойт-кандидат: почти никогда не проигрывает и заметно лучше ботов на всех семенах
  const winsEverywhere = human.every((h, i) => h.wellbeing >= bots[i].wellbeing);
  const verdict = hl <= 0.1 && hw - bw > 12 && winsEverywhere ? 'ЭКСПЛОЙТ?' : hw - bw < -12 ? 'сурово для человека' : 'в норме';
  if (verdict !== 'в норме') flagged.push({ n, snap, verdict, hw, bw });
  console.log(`| ${n + 1} | ${snap.setup.role} | ${snap.setup.scenario || 'sandbox'} | ${snap.decisionLog.length} | ${pct(hl)} / ${pct(bl)} | ${pct(hc)} / ${pct(bc)} | ${Math.round(hw)} / ${Math.round(bw)} | ${verdict} |`);
});
if (flagged.length) {
  console.log('\nНа что посмотреть:');
  flagged.forEach(({ n, snap, verdict }) => {
    const last = snap.decisionLog[snap.decisionLog.length - 1].d;
    console.log(`  ${n + 1}. ${verdict}: последние решения игрока — ${Object.entries(last).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  });
}
