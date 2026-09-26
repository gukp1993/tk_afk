// 纯Node固定种子体验扫描。只使用内存存档，不触碰平台/设备数据。
const store = require('../utils/store');
const battle = require('../utils/battle');
const stages = require('../utils/stages');
const rng = require('../utils/rng');
const config = require('../utils/config');
store.load();
const initial = JSON.parse(JSON.stringify(store.getState()));
function restore(target, source) {
  Object.keys(target).forEach(k => { if (!(k in source)) delete target[k]; });
  Object.keys(source).forEach(k => {
    const v = source[k];
    target[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  });
}
function fight(mode, index, seed) {
  const ref = mode === 'campaign' ? stages.makeStageEnemies(index).units[0].level : store.playerLevel();
  const begin = store.beginBattle({ mode, index, referenceLevel: ref });
  if (!begin.ok) throw new Error(begin.msg);
  const def = mode === 'campaign' ? stages.makeStageEnemies(index) : stages.makePracticeEnemies(store.playerLevel(), seed);
  const engine = battle.createBattle({ team: store.playerUnits(), enemy: store.enemyUnits(def.units), seed });
  let ticks = 0, result;
  while (!engine.ended && ticks++ < 2000) engine.step(config.BATTLE.TICK);
  if (!engine.ended) throw new Error('battle tick limit');
  result = engine.result();
  const settled = store.settleBattle(begin.id, { win: result.winner === 'A', duration: result.duration });
  if (!settled.ok) throw new Error(settled.msg);
  return { win: result.winner === 'A', duration: result.duration, xp: settled.gainedXP, level: settled.levelAfter };
}
const trials = [];
for (const useFirstWinChoice of [false, true]) for (let seed = 1; seed <= 20; seed++) {
  const state = store.getState(); restore(state, initial);
  let random = rng.makeRng(seed * 7919); Math.random = () => random.next();
  let stage = 1, recoveryRounds = 0, trainingWins = 0, trainingLosses = 0, campaignWins = 0, totalXp = 0, simulatedSeconds = 0, stalledAt = null, ascendedFirstWin = false;
  let guard = 0;
  while (stage <= 20 && guard++ < 80) {
    const c = fight('campaign', stage, 1000 + stage * 13 + seed * 97);
    simulatedSeconds += c.duration / 4;
    totalXp += c.xp;
    if (c.win) {
      campaignWins += 1; recoveryRounds = 0;
      if (stage === 1 && useFirstWinChoice && store.firstWinChoice().available) {
        const picked = store.claimFirstWinChoice('liubei');
        if (picked.ok) ascendedFirstWin = store.getOwned('liubei').star === 1;
      }
      stage += 1; continue;
    }
    if (store.playerLevel() >= config.MAX_LEVEL || recoveryRounds >= config.AUTO_BATTLE.recoveryMaxRounds) { stalledAt = stage; break; }
    recoveryRounds += 1;
    const startLevel = store.playerLevel(); let wins = 0;
    while (wins < config.AUTO_BATTLE.recoveryMaxWins && store.playerLevel() < Math.min(config.MAX_LEVEL, startLevel + config.AUTO_BATTLE.recoveryLevelGain)) {
      const t = fight('training', 0, 70000 + seed * 101 + trainingWins);
      simulatedSeconds += t.duration / 4; totalXp += t.xp;
      if (!t.win || t.xp <= 0) { trainingLosses += 1; stalledAt = stage; break; }
      wins += 1; trainingWins += 1;
    }
    if (stalledAt) break;
  }
  trials.push({ variant: useFirstWinChoice ? 'first-win-liubei-ascended' : 'starter-no-gacha', seed, campaignWins, reachedStage: stage, stalledAt, recoveryRounds, trainingWins, trainingLosses, ascendedFirstWin, playerLevel: store.playerLevel(), gainedXP: totalXp, estimatedSeconds: Math.round(simulatedSeconds + (campaignWins + trainingWins) * config.AUTO_BATTLE.resultDelaySeconds) });
}
console.log(JSON.stringify({ seeds: trials.length, trials }, null, 2));
