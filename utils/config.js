// 全局配置：数值、阵营、职业、品质
const FACTIONS = {
  wei: { key: 'wei', name: '魏', color: '#7fb0e8', cls: 'bg-wei' },
  shu: { key: 'shu', name: '蜀', color: '#6cc79a', cls: 'bg-shu' },
  wu:  { key: 'wu',  name: '吴', color: '#f08a6a', cls: 'bg-wu' },
  qun: { key: 'qun', name: '群', color: '#c39af0', cls: 'bg-qun' }
};
// 阵营克制环：魏→蜀→吴→群→魏，克制方伤害 +25%
const BEATS = { wei: 'shu', shu: 'wu', wu: 'qun', qun: 'wei' };
const FACTION_ADV = 1.25;

const CLASSES = {
  warrior: { key: 'warrior', name: '武将', icon: '⚔' },
  tank:    { key: 'tank',    name: '猛将', icon: '🛡' },
  mage:    { key: 'mage',    name: '军师', icon: '✦' },
  archer:  { key: 'archer',  name: '神射', icon: '🏹' },
  support: { key: 'support', name: '辅助', icon: '☯' }
};

const RARITIES = {
  1: { key: 1, name: 'N', color: '#c8ccd4', maxStar: 2, mult: 0.8 },
  2: { key: 2, name: 'R', color: '#6f9fd8', maxStar: 3, mult: 0.9 },
  3: { key: 3, name: 'SR', color: '#b07fe0', maxStar: 4, mult: 1.0 },
  4: { key: 4, name: 'SSR', color: '#f0a83e', maxStar: 5, mult: 1.15 }
};

// 每星属性倍率；英雄等级上限统一由玩家等级决定。
const STAR_MULT = 1 + 0.12; // per star
const LEVEL_CAPS = [200, 200, 200, 200, 200, 200]; // 兼容旧调用，个人星级不限制等级
const MAX_LEVEL = 200;

// 账号统一等级：英雄共用玩家等级，升级经验只由战斗结算发放。
const PLAYER_LEVEL = { max: MAX_LEVEL, baseXP: 100, stepXP: 20 };
const BATTLE_XP = { base: 40, perEnemyLevel: 10, campaignFirst: 3, campaignRepeat: 1, towerFirst: 2, arenaWin: 1, training: 0.6 };
// 前台自动出征会话参数；连续运行有明确上限，不影响单场手动战斗。
const AUTO_BATTLE = {
  defaultSpeed: 4,
  resultDelaySeconds: 1.5,
  recoveryLevelGain: 2,
  recoveryMaxWins: 10,
  recoveryMaxRounds: 2,
  trainingBatchMaxWins: 10,
  trainingBatchLevelGain: 2
};

const FOOD_VALUE = { 1: 1, 2: 2, 3: 4, 4: 8 };

// 等级消耗
function goldCost(lv) { return Math.floor(90 * Math.pow(lv, 1.35)); }
function expCost(lv) { return Math.floor(70 * Math.pow(lv, 1.35)); }

// 挂机收益（按已通关最高关卡）
function idleRates(cleared) {
  // v3 及旧版本的挂机兵书价值并入铜钱；在线状态不再生成兵书。
  return {
    gold: Math.floor((1800 + 260 * cleared) + (1200 + 170 * cleared)),
    exp: 0,
    scrollPerHour: 0.25
  };
}
const IDLE_CAP_HOURS = 12;
const ARMORY_IRON_PER_HOUR = 12;
const FAST_REWARD_HOURS = 2;
const FAST_REWARD_COST = 50;
const FAST_REWARD_DAILY = 6;

// 招募
const GACHA = {
  costScroll: 1,
  costTenGold: 2880,
  singleGold: 300,
  // 白/蓝/紫/橙 四档固定概率，无保底
  rates: { ssr: 0.02, sr: 0.10, r: 0.28, n: 0.60 }
};

// 阵型加成（同阵营人数）
function factionBonus(count) {
  if (count >= 5) return { hp: 0.18, atk: 0.18 };
  if (count >= 4) return { hp: 0.12, atk: 0.12 };
  if (count >= 3) return { hp: 0.08, atk: 0.08 };
  return { hp: 0, atk: 0 };
}

// 阵型槽位：0-2 前排，3-4 后排
const FORMATION_ROWS = [0, 0, 0, 1, 1];

// 战斗
const BATTLE = {
  TICK: 0.1,
  TIME_LIMIT: 90,
  BASE_ATTACK_INTERVAL: 2.2,
  ENERGY_MAX: 100,
  ENERGY_ATK: 10,
  ENERGY_HIT: 5,
  ENERGY_KILL: 15,
  DEF_K: (lv) => 300 + 16 * lv,
  CRIT_BASE_DMG: 1.5,
  STARTER: ['liubei', 'guanyu', 'zhangfei', 'liaohua']
};

// 演武场
const ARENA = { DAILY: 5, WIN_TOKENS: 2, LOSE_TOKENS: 1 };

// 激励视频广告：按平台配置广告位 ID（微信 wechat / 抖音 douyin）
// 对应平台为空时使用内置模拟广告（测试模式，流程完整可验证）
// 正式变现：微信开通流量主 / 抖音开通星图变现后，把各自广告位 ID 填入对应字段即切换为真广告
const AD = {
  rewardedUnitIds: { wechat: '', douyin: '' },
  placements: {
    idle2x: { limit: 3, name: '双倍领取挂机收益' },
    fast:   { limit: 3, name: '免费快速收获 +2小时' },
    summon: { limit: 1, name: '免费招募令' },
    revive: { limit: 1, name: '战败复活再战' }
  }
};

module.exports = {
  FACTIONS, BEATS, FACTION_ADV, CLASSES, RARITIES,
  LEVEL_CAPS, MAX_LEVEL, PLAYER_LEVEL, BATTLE_XP, AUTO_BATTLE, FOOD_VALUE,
  goldCost, expCost, idleRates, IDLE_CAP_HOURS, ARMORY_IRON_PER_HOUR,
  FAST_REWARD_HOURS, FAST_REWARD_COST, FAST_REWARD_DAILY,
  GACHA, factionBonus, FORMATION_ROWS, BATTLE, ARENA, AD
};
