// 三十天主线离线仿真：参考玩家（每天上线一次、领满挂机、三场胜利、自动召唤/推荐军械，
// 不看广告、不打塔与演武）在多个随机种子下的主线推进分布。
// 运行：node test/simulation.js [种子数=200] [天数=30]
const path = require('path');
const fs = require('fs');

const SEEDS = Math.max(1, Number(process.argv[2]) || 200);
const DAYS = Math.max(1, Number(process.argv[3]) || 30);
const BATTLES_PER_DAY = 12;      // 10~15 分钟会话的战斗次数上限
const CONSECUTIVE_LOSS_STOP = 2; // 连败两场停止推图，改为练兵补满三胜

const { makeRng } = require('../utils/rng');
const IT = require('../utils/items');
const H = require('../utils/heroes');

// ---- 可控时钟：劫持 Date，使存档的 00:00 重置与挂机按仿真时间推进 ----
const REAL_DATE = Date;
let simNow = Date.parse('2026-01-05T08:00:00+08:00');
// 测试专用全局时钟替换
global.Date = class extends REAL_DATE {
  constructor(...args) { if (args.length === 0) super(simNow); else super(...args); }
  static now() { return simNow; }
};
const REAL_RANDOM = Math.random;
let rng = makeRng(1);
// 用种子化随机替换全局 Math.random，使招募/掉落可复现
Math.random = () => rng.next();

// 微信存储桩（内含可清空的 Map）
const storageMap = new Map();
global.wx = {
  setStorageSync: (k, v) => storageMap.set(k, v),
  getStorageSync: k => storageMap.get(k)
};

const C = require('../utils/config');
const stages = require('../utils/stages');
const battleRules = require('../utils/battle');
const progression = require('../utils/progression');

let store = null; // 当前种子run的存档模块实例（runSeed 内赋值）
let debugRun = false; // 当前种子是否为 SIM_DEBUG 指定的诊断对象
const SAVE_KEY = require('../utils/store').SAVE_KEY;

function freshStore() {
  delete require.cache[require.resolve('../utils/store')];
  return require('../utils/store');
}

function fightBattle(stage, battleSeed) {
  const enemy = stages.makeStageEnemies(stage);
  const begin = store.beginBattle({ mode: 'campaign', index: stage, referenceLevel: enemy.units[0]?.level || 1 });
  if (!begin.ok) return { win: false, stage };
  const fighting = battleRules.createBattle({
    team: store.playerUnits(), enemy: store.enemyUnits(enemy.units), seed: battleSeed
  });
  let done = null;
  for (let i = 0; i < 1200 && !done; i++) {
    const step = fighting.step(0.1);
    if (step.done) done = step;
  }
  const win = done ? done.winner === 'A' : false;
  store.settleBattle(begin.id, { win });
  if (debugRun && !win) {
    const r = fighting.result();
    const alive = fighting.snapshot().filter(u => u.alive).length;
    console.log(`  第${stage}关败 duration=${r.duration} 存活${alive} timeout=${r.duration >= 90}`);
    const my = store.playerUnits(), foe = store.enemyUnits(stages.makeStageEnemies(stage).units);
    my.forEach(u => console.log(`    我 ${u.name} atk=${u.stats.atk} hp=${u.stats.hp}`));
    foe.forEach(u => console.log(`    敌 ${u.name} atk=${u.stats.atk} hp=${u.stats.hp} def=${u.stats.def} boss=${u.isBoss}`));
    const hpPct = fighting.snapshot().map(u => `${u.name}:${Math.round(u.hp / u.maxHp * 100)}%`).join(' ');
    console.log(`    终局血量 ${hpPct}`);
  }
  return { win, stage };
}

function fightPractice(battleSeed) {
  const enemy = stages.makePracticeEnemies(store.playerLevel(), battleSeed);
  const begin = store.beginBattle({ mode: 'training', index: 0, referenceLevel: enemy.units[0]?.level || 1 });
  if (!begin.ok) return { win: false };
  const fighting = battleRules.createBattle({
    team: store.playerUnits(), enemy: store.enemyUnits(enemy.units), seed: battleSeed
  });
  let done = null;
  for (let i = 0; i < 1200 && !done; i++) {
    const step = fighting.step(0.1);
    if (step.done) done = step;
  }
  const win = done ? done.winner === 'A' : false;
  store.settleBattle(begin.id, { win });
  return { win };
}

function bestTarget(rarity) {
  const state = store.getState();
  const pool = H.HEROES.filter(h => h.rarity === rarity);
  const unowned = pool.filter(h => !state.roster[h.id])
    .sort((a, b) => H.heroPower(b, 1, 0) - H.heroPower(a, 1, 0));
  if (unowned.length) return unowned[0].id;
  const notMax = pool.filter(h => state.roster[h.id] && state.roster[h.id].star < C.RARITIES[rarity].maxStar)
    .sort((a, b) => (state.roster[a.id]?.star || 0) - (state.roster[b.id]?.star || 0));
  return notMax.length ? notMax[0].id : null;
}

function autoSummon() {
  let ops = 0, guard = 0;
  for (;;) {
    const s = store.getState();
    if (guard++ > 400) break;
    if (s.res.gem >= C.GACHA.costTenGold) { store.doSummon('gem10'); ops++; continue; }
    if (s.res.gem >= C.GACHA.singleGold) { store.doSummon('gem1'); ops++; continue; }
    if (s.res.scroll >= 10) { store.doSummon('scroll10'); ops++; continue; }
    if (s.res.scroll >= 1) { store.doSummon('scroll1'); ops++; continue; }
    break;
  }
  return ops;
}

function autoVouchersAndBoxes() {
  let ops = 0, guard = 0;
  for (;;) {
    const s = store.getState();
    if (guard++ > 60) break;
    if (s.vouchers.ssr > 0) { const id = bestTarget(4); if (!id || !store.useChoiceVoucher(4, id).ok) break; ops++; continue; }
    if (s.vouchers.sr > 0) { const id = bestTarget(3); if (!id || !store.useChoiceVoucher(3, id).ok) break; ops++; continue; }
    break;
  }
  for (const q of [3, 2, 1]) {
    let guard2 = 0;
    for (;;) {
      const s = store.getState();
      if (guard2++ > 40 || !(s.armory.boxes[q] > 0)) break;
      const locked = IT.CATALOG.filter(x => x.q === q && !s.armory.unlocked[x.id]);
      const r = locked.length ? store.armoryClaimBox(q, locked[0].id) : store.armoryClaimBox(q, 'convert');
      if (!r.ok) break;
      ops++;
    }
  }
  return ops;
}

function autoFormation() {
  // 参考玩家使用游戏内的“推荐布阵”
  const ids = require('../utils/formation').recommendFormation(store.allRoster());
  store.applyFormation(ids);
}

function autoArmory() {
  let ops = 0;
  const recs = progression.getArmoryRecommendations(store.getState(), IT);
  if (recs.length) { store.applyArmoryRecommendations(recs); ops++; }
  for (;;) {
    const s = store.getState();
    const slots = IT.ARMORY_SLOTS.slice().sort((a, b) =>
      (IT.STAR_NEEDS[s.armory.slotStars[a.id]] || 1e9) - (IT.STAR_NEEDS[s.armory.slotStars[b.id]] || 1e9));
    let upgraded = false;
    for (const slot of slots) {
      const star = s.armory.slotStars[slot.id];
      if (star >= 5) continue;
      const iron = IT.STAR_NEEDS[star], gold = IT.STAR_GOLD[star];
      if (s.res.iron >= iron && s.res.gold >= gold && store.armoryUpgrade(slot.id).ok) { ops++; upgraded = true; break; }
    }
    if (!upgraded) break;
  }
  return ops;
}

function runSeed(seed) {
  rng = makeRng((seed * 2654435761 >>> 0) || 1);
  debugRun = String(seed) === process.env.SIM_DEBUG;
  storageMap.clear();
  store = freshStore();
  simNow = Date.parse('2026-01-05T08:00:00+08:00');
  store.load();
  store.getState().res.scroll = 0; // 参考玩家从零开始；开局 12 令计入首日召唤
  const checkpoints = {};
  const stuckBossDays = {};
  for (let day = 1; day <= DAYS; day++) {
    if (day > 1) simNow += 24 * 3600000;
    store.checkDailyReset();
    if (String(seed) === process.env.SIM_DEBUG) {
      const st = store.getState();
      const next = stages.makeStageEnemies(st.campaign.cleared + 1);
      const myPower = store.teamPower();
      const foePower = store.enemyUnits(next.units).reduce((s, u) => s + u.stats.hp / 6 + u.stats.atk * 2.2 + u.stats.def * 1.5, 0);
      console.log(`[d${day}] lv${st.player.level} 关${st.campaign.cleared} 我方战力${Math.round(myPower)} 敌方战力${Math.round(foePower)} 敌方等级${next.units[0].level}`);
    }
    store.claimIdle(false); // 离线一晚后领满挂机（元宝额度/铜钱/精铁）
    let ops = 1;
    autoFormation();
    ops += autoSummon();
    ops += autoVouchersAndBoxes();
    ops += autoArmory();
    let wins = 0, battles = 0, lossStreak = 0;
    while (battles < BATTLES_PER_DAY) {
      const stage = store.getState().campaign.cleared + 1;
      const r = fightBattle(stage, (seed * 7919 + day * 104729 + battles * 13) >>> 0);
      battles++; ops++;
      if (r.win) { wins++; lossStreak = 0; }
      else {
        lossStreak++;
        if (stage % 10 === 0) stuckBossDays[stage] = (stuckBossDays[stage] || 0) + 1;
        if (lossStreak >= CONSECUTIVE_LOSS_STOP) break;
      }
    }
    while (wins < 3 && battles < BATTLES_PER_DAY + 3) {
      const r = fightPractice((seed * 104729 + day * 7919 + battles * 17) >>> 0);
      battles++; ops++;
      if (r.win) wins++;
    }
    store.claimAllDailyRewards(); // 三件套任务 + 活跃宝箱
    ops++;
    autoSummon(); // 日常奖励的元宝当日再转化
    if ([7, 14, 21, 30, DAYS].includes(day)) {
      const s2 = store.getState();
      checkpoints[day] = {
        cleared: s2.campaign.cleared, gem: s2.res.gem, iron: s2.res.iron, scroll: s2.res.scroll,
        roster: Object.keys(s2.roster).length, ops,
        armoryStars: IT.ARMORY_SLOTS.reduce((sum, sl) => sum + (s2.armory.slotStars[sl.id] || 0), 0)
      };
    }
  }
  const final = store.getState();
  return {
    seed, cleared: final.campaign.cleared, checkpoints, stuckBossDays,
    gem: final.res.gem, iron: final.res.iron, scroll: final.res.scroll,
    roster: Object.keys(final.roster).length,
    armoryStars: IT.ARMORY_SLOTS.reduce((sum, sl) => sum + (final.armory.slotStars[sl.id] || 0), 0)
  };
}

function stat(arr, p) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }

function main() {
  const runs = [];
  const t0 = REAL_DATE.now();
  for (let i = 1; i <= SEEDS; i++) runs.push(runSeed(i));
  const elapsed = ((REAL_DATE.now() - t0) / 1000).toFixed(1);
  const dayRows = [7, 14, 21, DAYS].filter(d => d <= DAYS);
  console.log(`\n== 三十天主线仿真：${SEEDS} 种子 × ${DAYS} 天（耗时 ${elapsed}s，每日≤${BATTLES_PER_DAY}战） ==`);
  console.log('day | 通关120占比 | 中位关卡 | P10 | P90 | min/max');
  for (const d of dayRows) {
    const cleared = runs.map(r => r.checkpoints[d]?.cleared ?? 0);
    const done = cleared.filter(x => x >= C.FIRST_STAGE_END).length;
    console.log(
      String(d).padStart(3) + ' | ' +
      String(Math.round(done / SEEDS * 100)).padStart(3) + '% | ' +
      String(stat(cleared, 0.5)).padStart(4) + ' | ' +
      String(stat(cleared, 0.1)).padStart(4) + ' | ' +
      String(stat(cleared, 0.9)).padStart(4) + ' | ' +
      Math.min(...cleared) + '/' + Math.max(...cleared)
    );
  }
  const finalCleared = runs.map(r => r.cleared);
  const done30 = finalCleared.filter(x => x >= C.FIRST_STAGE_END).length;
  console.log(`\n第 ${DAYS} 天通关第 120 关：${done30}/${SEEDS}（${Math.round(done30 / SEEDS * 100)}%）· 目标 ≥80%`);
  const finalDist = {};
  finalCleared.forEach(x => { const bucket = Math.floor(x / 10) * 10; finalDist[bucket] = (finalDist[bucket] || 0) + 1; });
  console.log('最终关卡分布（按 10 关分桶）:', JSON.stringify(finalDist));
  const bossDays = {};
  runs.forEach(r => Object.entries(r.stuckBossDays || {}).forEach(([k, v]) => { bossDays[k] = (bossDays[k] || 0) + v; }));
  const topStuck = Object.entries(bossDays).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('卡关最多名将关（种子×败北日）:', topStuck.map(([k, v]) => `第${k}关×${v}`).join(' · ') || '无');
  const avg = (f) => (runs.reduce((s, r) => s + f(r), 0) / SEEDS).toFixed(0);
  console.log(`第 ${DAYS} 天均值：元宝 ${avg(r => r.gem)} · 精铁 ${avg(r => r.iron)} · 招募令 ${avg(r => r.scroll)} · 武将 ${avg(r => r.roster)} · 军械总星 ${avg(r => r.armoryStars)}`);
  const json = { seeds: SEEDS, days: DAYS, battlesPerDay: BATTLES_PER_DAY, doneRate: done30 / SEEDS,
    dayRows: dayRows.map(d => ({ day: d, doneRate: runs.filter(r => (r.checkpoints[d]?.cleared ?? 0) >= C.FIRST_STAGE_END).length / SEEDS,
      median: stat(runs.map(r => r.checkpoints[d]?.cleared ?? 0), 0.5) })),
    topStuck };
  const outDir = path.join(__dirname, '..', 'docs', 'reviews');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '30d-sim-latest.json'), JSON.stringify(json, null, 2));
  console.log('结果已写入 docs/reviews/30d-sim-latest.json');
}

main();
