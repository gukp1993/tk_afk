// @ts-nocheck
// Generated from utils/stages.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_heroes from './heroes';
import * as __domain_config from './config';
import * as __domain_story from './story';
import * as __domain_fmt from './fmt';
import * as __domain_soldiers from './soldiers';
import * as __domain_rng from './rng';
// 战役章节与群英塔（敌方阵容生成）
// 前 12 章 × 10 关走 utils/story.js 演义剧情表（名称/敌阵/对白/名将关）；
// 超出剧情表的关卡进入循环乱世，用由 story 派生的兜底章节轮转生成（单一数据源，不维护第二份敌将表）。
const { getHero } = __domain_heroes;
const { FIRST_STAGE_END, CAMPAIGN_DIFFICULTY, ELITE_STAGE, STAR_RULES, CAMPAIGN_MODS, BOSS_MODS, HALL } = __domain_config;
const story = __domain_story;
const F = __domain_fmt;

const STAGES_PER_CH = 10;

// 词缀关：每章第 3/7 关（章内 index 2/6），≥minStage 启用；ch 序轮换保证相邻章不重样
function resolveMods(globalStage) {
  const n = Math.floor(Number(globalStage) || 0);
  // 二期与乱世循环（161+）均启用词缀轮转（研讨会六 A2：乱世三无地带治理）；
  // chIdx 随乱世章序自然递增，池长取模循环。
  if (n < CAMPAIGN_MODS.minStage) return [];
  const inCh = (n - 1) % 10;
  if (inCh !== 2 && inCh !== 6) return [];
  const chIdx = Math.floor((n - 1) / 10);
  const slot = inCh === 2 ? 0 : 1;
  return [CAMPAIGN_MODS.pool[(chIdx * 2 + slot) % CAMPAIGN_MODS.pool.length]];
}
// 精锐关：每章第 5 关（第 3/7 关预留给词缀、第 10 关名将），minStage 前不启用。
// 三星评星：★1 通关；★2 限时（精锐/词缀关放宽到 70 秒）；★3 我方存活≥4
function stageStars(win, duration, aliveCount, elite) {
  if (!win) return 0;
  let s = 1;
  if ((Number(duration) || 0) <= (elite ? STAR_RULES.eliteFastSeconds : STAR_RULES.fastSeconds)) s += 1;
  if ((Number(aliveCount) || 0) >= STAR_RULES.aliveNeed) s += 1;
  return s;
}
// 名人堂：按玩家战力反推敌等级（复用演武公式），成员固定阵容可带特质被动
function makeHallEnemies(lineup, playerPower, seat) {
  const H2 = __domain_heroes;
  const targetPower = playerPower * HALL.levelMult[seat] || playerPower;
  const lv = Math.max(1, Math.round(Math.pow(targetPower / 2600, 1 / 1.35)));
  const star = Math.min(2, Math.floor(lv / 60));
  const units = lineup.members.map((id, i) => {
    const h = H2.getHero(id);
    const base = H2.heroStatsStar(h, lv, star);
    const scale = i === 0 ? 1.05 : 0.95;
    return {
      hero: h, level: lv, star,
      scale,
      extraPassive: i === 0 && lineup.trait ? Object.assign({}, lineup.trait) : null,
      isBoss: false, row: i <= 2 ? 0 : 1
    };
  });
  // 敌方同阵营光环按 ENEMY_FACTION_AURA 同款折算（B 侧统一在 battle.js 处理，这里只给数据）
  return {
    name: '名人堂 · ' + lineup.name + '（' + ['一', '二', '三'][seat] + '席）',
    units, isBoss: false, mods: [], hall: { lineupId: lineup.id, seat }
  };
}
// 名人堂评星（比主线宽松：★2 ≤45 秒）
function hallStars(win, duration, aliveCount) {
  if (!win) return 0;
  let st = 1;
  if ((Number(duration) || 0) <= HALL.star.fast) st += 1;
  if ((Number(aliveCount) || 0) >= HALL.star.alive) st += 1;
  return st;
}
function hallWeeklyLineups(weekKey) {
  let h = 2166136261;
  for (const ch of String(weekKey)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const start = (h >>> 0) % HALL.pool.length;
  return [0, 1, 2].map(i => HALL.pool[(start + i) % HALL.pool.length]);
}
function isEliteStage(globalStage) {
  const n = Math.floor(Number(globalStage) || 0);
  return n >= ELITE_STAGE.minStage && ((n - 1) % STAGES_PER_CH) + 1 === ELITE_STAGE.every;
}

// 循环乱世兜底章节：名字/主将/敌阵取自剧情表（首关敌阵作轮转池）
const CHAPTERS = story.CHAPTERS.map(sc => ({
  name: sc.name,
  boss: sc.stages[STAGES_PER_CH - 1].foes[0],
  foes: sc.stages[0].foes
}));

// 敌方强度：全局关卡序号（从 1 开始）
function stageScale(globalStage) {
  const progress = Math.min(1, Math.max(0, (globalStage - 1) / (FIRST_STAGE_END - 1)));
  return 1 + (CAMPAIGN_DIFFICULTY.normalEndScale - 1) * progress;
}
function chapterOf(globalStage) {
  const idx = Math.floor((globalStage - 1) / STAGES_PER_CH); // 0-based
  const inCh = (globalStage - 1) % STAGES_PER_CH;
  const ch = idx < CHAPTERS.length ? CHAPTERS[idx] : CHAPTERS[CHAPTERS.length - 1];
  const loop = idx >= CHAPTERS.length ? idx - CHAPTERS.length + 1 : 0;
  const name = idx < CHAPTERS.length
    ? '第' + F.cnNum(idx + 1) + '章 · ' + ch.name
    : '乱世纷争 · ' + F.cnNum(loop + 1);
  return { ch, idx, inCh, name, isBoss: inCh === STAGES_PER_CH - 1 };
}

// 生成敌方阵容（5 人，slot 0-2 前排，3-4 后排）；剧情表内关卡附带 story 配置
function makeStageEnemies(globalStage) {
  const { ch, idx: chIdxTop, inCh, name, isBoss } = chapterOf(globalStage);
  // 乱世章末名将（161+ 每章第 10 关）合成剧情：对白轮换（研讨会六 C4），foes 仍走兜底
  const st = story.getStoryStage(globalStage)
    || (isBoss && globalStage > CHAPTERS.length * STAGES_PER_CH ? story.getChaosStory(globalStage) : null);
  const bossScale = CAMPAIGN_DIFFICULTY.bossOverrides[globalStage];
  const elite = isEliteStage(globalStage);
  const mods = resolveMods(globalStage);
  // 词缀关属性补偿 ×0.95；已有 normalOverrides 的关不叠乘（如 117 既有削峰）
  const modComp = mods.length && !CAMPAIGN_DIFFICULTY.normalOverrides[globalStage] ? CAMPAIGN_MODS.compensation : 1;
  const normalScale = stageScale(globalStage) * (CAMPAIGN_DIFFICULTY.normalOverrides[globalStage] || 1) * (elite ? ELITE_STAGE.scale : 1) * modComp;
  const lv = Math.max(1, Math.round(1 + (globalStage - 1) * CAMPAIGN_DIFFICULTY.levelSlope));
  // 乱世章末 Boss 按章序轮换（内容多样性：避免每章都是吕布）
  const chaosLoop = globalStage > CHAPTERS.length * STAGES_PER_CH
    ? Math.floor((globalStage - 1) / 10) - (CHAPTERS.length - 1) : 0;
  const chaosBoss = chaosLoop >= 1
    ? story.CHAOS_BOSS_ROTATION[(chaosLoop - 1) % story.CHAOS_BOSS_ROTATION.length] : null;
  // 小兵混编（用户指令 2026-10-01）：推进关（非名将/精锐/词缀）后排末位附带 1 名章主题小兵；
  // 核心关（5/7/10）保持全英雄，对应剧情人物不受影响
  const soldierType = (!isBoss && !elite && !mods.length)
    ? __domain_soldiers.troopOfChapter(chIdxTop + 1) : null;
  const soldierElite = globalStage > 120;
  const pick = (i) => {
    if (st && st.stage.foes) return st.stage.foes[i];
    if (isBoss && i === 0 && chaosBoss) return chaosBoss;
    if (isBoss && i === 0) return ch.boss;
    return ch.foes[(inCh + i) % ch.foes.length];
  };
  const units = [];
  const extraPassive = {};
  if (mods.includes('ironWall')) extraPassive.armoryStartShield = 0.3;
  if (mods.includes('gale')) { extraPassive.firstEnergy = 40; extraPassive.spd = 0.10; }
  const bossMod = isBoss && BOSS_MODS[globalStage] ? BOSS_MODS[globalStage] : null;
  for (let i = 0; i < 5; i++) {
    if (soldierType && i === 4) {
      units.push(__domain_soldiers.makeSoldier(soldierType, lv, soldierElite));
      continue;
    }
    const h = getHero(pick(i));
    units.push({
      hero: h,
      level: lv,
      star: Math.min(2, Math.floor((globalStage - 1) / 40)),
      scale: isBoss
        ? (i === 0 ? (bossScale ? bossScale.main : CAMPAIGN_DIFFICULTY.bossMainScale)
          : (bossScale ? bossScale.other : CAMPAIGN_DIFFICULTY.bossOtherScale))
        : normalScale * (i === 0 ? 1 : 0.92),
      isBoss: i === 0 && isBoss,
      row: mods.includes('allBack') ? 1 : (i <= 2 ? 0 : 1),
      extraPassive: i === 0 && bossMod ? bossMod.passive : (Object.keys(extraPassive).length ? Object.assign({}, extraPassive) : null)
    });
  }
  const label = st ? ' · ' + st.stage.name : (isBoss ? ' · 名将' : elite ? ' · 精锐' : mods.length ? ' · 机制' : ' · 第' + (inCh + 1) + '关');
  const foePool = st ? st.stage.foes : ch.foes;
  const out = { name: name + label, units, isBoss, elite, mods, bossMod, story: st };
  if (mods.includes('reinforce')) {
    out.reinforceUnits = buildReinforceUnits(globalStage, foePool, lv, Math.min(2, Math.floor((globalStage - 1) / 40)), normalScale);
  }
  return out;
}

// 群英塔：无限层，随机阵营混合，每 5 层一名将
function makeTowerEnemies(floor) {
  const heroes = __domain_heroes.HEROES;
  const rng = __domain_rng.makeRng(9000 + floor * 131);
  const pool = rng.shuffle(heroes.map(h => h.id));
  const scale = 1;
  const lv = Math.max(1, Math.round(2 + (floor - 1) * 1.8));
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = __domain_heroes.getHero(pool[i]);
    const isBoss = floor % 5 === 0 && i === 0;
    units.push({
      hero: h, level: lv, star: Math.min(3, Math.floor(floor / 25)),
      scale: (isBoss ? scale * 1.2 : scale * 0.9), isBoss, row: i <= 2 ? 0 : 1
    });
  }
  return { name: '群英塔 · 第' + floor + '层', units, isBoss: floor % 5 === 0 };
}

// 四方台（研讨会十二 A2）：阵营试炼塔敌阵。同阵营将池+阵营小兵，周键+层数确定性；
// 曲线锚定主线进度（anchor=clamp(cleared,10,120)），k 已计敌方满编同阵营光环 ≈13.5% 实效。
function makeQuadTowerEnemies(faction, weekId, anchor, floor) {
  const C = __domain_config;
  const cfg = C.QUAD_TOWER;
  const heroes = __domain_heroes;
  const soldiers = __domain_soldiers;
  const pool = heroes.HEROES.filter(h => h.faction === faction);
  const rng = __domain_rng.makeRng(String(weekId) + ':' + faction + ':' + floor);
  const lv = Math.max(1, cfg.levelOf ? cfg.levelOf(anchor, floor) : Math.round(2 + (anchor + floor - 1) * 1.8));
  const star = Math.min(3, Math.floor(floor / 10));
  const isBoss = floor % 10 === 0;
  const kMul = (cfg.overrides && cfg.overrides[floor]) || 1;
  const k = cfg.k * (isBoss ? 1.2 : 0.9) * kMul;
  const shuffled = rng.shuffle(pool.map(h => h.id));
  let picks;
  if (isBoss) {
    // 名将层：主将取该阵营最高稀有度，其余洗牌补满 5 将
    const top = pool.slice().sort((a, b) => b.rarity - a.rarity)[0];
    picks = [top.id].concat(shuffled.filter(id => id !== top.id).slice(0, 4));
  } else {
    picks = shuffled.slice(0, 4);
  }
  const units = [];
  picks.forEach((id, i) => {
    const h = heroes.getHero(id);
    units.push({
      hero: h, level: lv, star,
      scale: k * (isBoss && i === 0 ? 1.2 : 0.9),
      isBoss: isBoss && i === 0, row: i <= 2 ? 0 : 1,
      extraPassive: isBoss && i === 0 ? (cfg.bossPassives[floor] && cfg.bossPassives[floor].passive) || {} : {}
    });
  });
  if (!isBoss) {
    // 非名将层第 5 槽换本阵营小兵（后排末位）
    const sol = soldiers.makeSoldier(cfg.soldierOf[faction], lv, false);
    sol.row = 1;
    units.push(sol);
  }
  const boss = isBoss ? cfg.bossPassives[floor] : null;
  return {
    name: '四方 · ' + cfg.themes[faction] + ' · 第' + floor + '层' + (boss ? ' · ' + boss.name : ''),
    units, isBoss, faction
  };
}

// 周常 Boss（研讨会四 P3）：每周键哈希选一名 SSR 名将 ×bossScale 强度，单体镇场
function makeWeekBossEnemies(weekId, playerLevel) {
  const heroes = __domain_heroes.HEROES;
  // 池剔除硬控/自疗原型（张飞眩晕周会压伤害档，华佗自疗拉长战斗）
  const BLACKLIST = { zhangfei: 1, huatuo: 1, diaochan: 1 };
  const ssr = heroes.filter(h => h.rarity === 4 && !BLACKLIST[h.id]);
  let h = 5381;
  for (let i = 0; i < String(weekId).length; i++) h = ((h * 33) ^ String(weekId).charCodeAt(i)) >>> 0;
  const boss = ssr[h % ssr.length];
  const lv = Math.max(1, Math.round(playerLevel || 1));
  // 巨血公式（周Boss仿真 2026-09-30）：MaxHp = 350 × 同等星等级关羽体魄（≈锚档单场输出×20，K 可 15~25 微调）；攻防速保持 ×1
  const K = (__domain_config.WEEKBOSS && __domain_config.WEEKBOSS.hpK) || 350;
  const guanyuHp = __domain_heroes.heroStatsStar(__domain_heroes.getHero('guanyu'), lv, 5).hp;
  const hpOverride = Math.floor(guanyuHp * K);
  const units = [{ hero: boss, level: lv, star: 5, scale: 1, hpScale: hpOverride / Math.max(1, __domain_heroes.heroStatsStar(boss, lv, 5).hp), isBoss: true, row: 0 }];
  return { name: '本周魔王 · ' + boss.name, units, isBoss: true, weekBoss: { weekId }, bossMaxHp: hpOverride };
}

// 军屯双本（研讨会四 P2）：每日资源副本敌阵，敌力随玩家等级与层数缩放，随机 SSR 混编
function makeDungeonEnemies(kind, floor, playerLevel) {
  const heroes = __domain_heroes.HEROES;
  const C2 = __domain_heroes;
  const lv = Math.max(1, Math.round((playerLevel || 1) * (0.85 + 0.07 * Math.min(floor, 10))));
  const rng = __domain_rng.makeRng(7700 + floor * 17 + (kind === 'train' ? 500 : 0));
  const pool = rng.shuffle(heroes.map(h => h.id));
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = __domain_heroes.getHero(pool[i]);
    const isBoss = i === 0;
    units.push({ hero: h, level: lv, star: 1, scale: isBoss ? 1.08 : 0.9, isBoss, row: i <= 2 ? 0 : 1 });
  }
  return { name: (kind === 'train' ? '军屯 · 屯兵 ' : '军屯 · 屯金 ') + '第' + floor + '层', units, isBoss: true, dungeon: { kind, floor } };
}

// 无次数限制的练兵队：三名低稀有度武将，敌方弱于同等级常规守军。
function makePracticeEnemies(playerLevel, seed) {
  const H = __domain_heroes;
  const ids = ['liaohua', 'mengda', 'masu'];
  const lv = Math.max(1, Math.floor(playerLevel || 1) - 2);
  const units = ids.map((id, i) => ({
    hero: H.getHero(id), level: lv, star: 0,
    scale: 0.6, isBoss: false, row: i < 2 ? 0 : 1
  }));
  return { name: '练兵场 · 熟悉阵容', units, isBoss: false, seed: seed || 1, referenceLevel: lv };
}

// 演武场对手：按玩家战力缩放
function makeArenaEnemies(playerPower, seed, diff) {
  const heroes = __domain_heroes.HEROES;
  const rng = __domain_rng.makeRng(seed);
  const pool = rng.shuffle(heroes.map(h => h.id)).slice(0, 5);
  // 由目标战力反推等级
  const targetPower = playerPower * diff;
  const lv = Math.max(1, Math.round(Math.pow(targetPower / 2600, 1 / 1.35)));
  const units = pool.map((hid, i) => {
    const h = __domain_heroes.getHero(hid);
    return { hero: h, level: lv, star: Math.min(2, Math.floor(lv / 60)), scale: 1, isBoss: false, row: i <= 2 ? 0 : 1 };
  });
  return { name: '演武场 · 对阵', units, isBoss: false };
}

// 词缀 → createBattle 入参翻译（仿真与客户端同一条路径）；援军取本章第 6/7 号敌将 ×0.75
function stageBattleEffects(stageObj) {
  const mods = stageObj && stageObj.mods || [];
  if (!mods.length) return null;
  const cfgFrag = {};
  if (mods.includes('poisonFog')) cfgFrag.env = { pctPerSec: 0.005 };
  if (mods.includes('famine')) cfgFrag.healScale = { A: 0.5, B: 0.5 };
  if (mods.includes('ironWall')) cfgFrag.healScale = Object.assign({ B: 0.5 }, cfgFrag.healScale || {});
  if (mods.includes('reinforce') && Array.isArray(stageObj.reinforceUnits) && stageObj.reinforceUnits.length) {
    cfgFrag.reinforce = { at: [20, 40], units: stageObj.reinforceUnits };
  }
  return Object.keys(cfgFrag).length ? cfgFrag : null;
}
// 为词缀关构建援军单元（chapterFoes 为本章 foes 池，取第 6/7 名）；无效 id 跳过防崩
function buildReinforceUnits(globalStage, chapterFoes, lv, star, baseScale) {
  const H2 = __domain_heroes;
  const picks = [chapterFoes[5 % chapterFoes.length], chapterFoes[6 % chapterFoes.length]]
    .map(id => H2.getHero(id)).filter(Boolean);
  return picks.map((h, i) => {
    const base = H2.heroStatsStar(h, lv, star);
    const scale = baseScale * 0.75;
    return {
      uid: 'R' + i, heroId: h.id, name: h.name, faction: h.faction, cls: h.cls, level: lv, star,
      row: i === 0 ? 0 : 1,
      stats: { hp: Math.floor(base.hp * scale), atk: Math.floor(base.atk * scale), def: Math.floor(base.def * scale), spd: base.spd, crit: base.crit },
      ult: h.ult, passive: h.passive.mods || {}, isBoss: false
    };
  });
}
export { CHAPTERS, STAGES_PER_CH, stageScale, chapterOf, isEliteStage, stageStars, resolveMods, stageBattleEffects, buildReinforceUnits, makeHallEnemies, hallStars, hallWeeklyLineups, makeStageEnemies, makeTowerEnemies, makeArenaEnemies, makePracticeEnemies, makeDungeonEnemies, makeWeekBossEnemies, makeQuadTowerEnemies };
