// @ts-nocheck
// Generated from utils/config.js by scripts/cocos-sync-domain.js. Do not edit here.

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
// 敌方同阵营光环折减系数：剧情敌阵普遍同阵营 4-5 人吃满 +18%，玩家看不见也难以对位，
// B 侧（敌方/塔/演武对手）按 0.75 折算，缓解"表观战力达标却打不过"的隐性墙。
const ENEMY_FACTION_AURA = 0.75;

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

// 挂机收益（按已通关最高关卡）。gold=铜钱/小时；gem 与铜钱、精铁分账计算。
// 元宝固定 1000/小时，不受关卡影响；自然日（00:00 重置）最多领取 5 小时／5000 元宝，
// 快速收获广告占用同一额度；铜钱、精铁仍各自最多自然累计 12 小时。
function idleRates(cleared) {
  // v3 及旧版本的挂机兵书价值并入铜钱；在线状态不再生成兵书。
  // scrollPerHour 归零：挂机不再产出招募令，旧档已积累的待领招募令原样保留。
  return {
    gold: Math.floor((1800 + 260 * cleared) + (1200 + 170 * cleared)),
    exp: 0,
    scrollPerHour: 0
  };
}
const IDLE_CAP_HOURS = 12;
const GEM_IDLE = { perHour: 1000, capHours: 5, dailyCap: 5000 };
const ARMORY_IRON_PER_HOUR = 25;
// 快速收获：广告版每次立即给 1 小时收益（元宝 1000＋铜钱 1 小时＋精铁 25），每日 3 次；
// 元宝占用当日 5 小时额度，铜钱／精铁不占自然累计。付费版只给铜钱／精铁，不产生元宝。
const FAST_AD = { hours: 1, daily: 3, gem: 1000, iron: 25 };
const FAST_PAID = { hours: 2, cost: 50, daily: 3 };

// 招募
const GACHA = {
  costScroll: 1,
  costTenGold: 900,
  singleGold: 100,
  // 白/蓝/紫/橙 四档固定概率；叠加保底：十连至少 1 张 R+；31 抽起软保底每抽 +7% SSR 概率；40 抽必出 SSR。
  rates: { ssr: 0.02, sr: 0.10, r: 0.28, n: 0.60 },
  pity: { ssrHard: 40, tenMinR: true, soft: { from: 31, step: 0.07 } }
};

// 满星后抽到重复卡的转化：N/R 直接转铜钱（碎片对 N/R 无实用出口），SR/SSR 仍转对应品质碎片。
const DUPE_GOLD = { 1: 5000, 2: 12000 };

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
  // 残局狂暴：75 秒后双方攻击每秒 +1%，让"互相打不动"的僵局有决出迹象，但不显著翻转胜负。
  OVERTIME: { start: 75, atkPerSec: 0.01 },
  BASE_ATTACK_INTERVAL: 2.2,
  ENERGY_MAX: 100,
  ENERGY_ATK: 10,
  ENERGY_HIT: 5,
  ENERGY_KILL: 15,
  DEF_K: (lv) => 300 + 16 * lv,
  CRIT_BASE_DMG: 1.5,
  STARTER: ['liubei', 'guanyu', 'zhangfei', 'liaohua']
};

// 演武场：每日 5 次；令牌按对手难度分档（胜），败给 1；段位首次达成发一次性奖励
const ARENA = {
  DAILY: 5,
  LOSE_TOKENS: 1,
  winTokens: (diff) => (diff > 1.2 ? 4 : diff >= 1 ? 3 : 2),
  rankBonus: { gem: 100, iron: 50 }
};

// 七日目标：新档（或老档更新后）首日起 7 天，每天可领一份，第 7 天发 SSR 自选券
const SEVEN_DAY = [
  { day: 1, reward: { scroll: 3, gem: 100 }, label: '招募令 ×3 · 元宝 ×100' },
  { day: 2, reward: { gem: 300 }, label: '元宝 ×300' },
  { day: 3, reward: { scroll: 5 }, label: '招募令 ×5' },
  { day: 4, reward: { iron: 200 }, label: '精铁 ×200' },
  { day: 5, reward: { srPick: 1 }, label: 'SR 武将自选券 ×1' },
  { day: 6, reward: { gem: 888 }, label: '元宝 ×888' },
  { day: 7, reward: { ssrPick: 1 }, label: 'SSR 武将自选券 ×1' }
];
// 练兵经验每日上限（场数）：前 N 场全额，之后 0，切断"无限练兵=免费等级"
const TRAINING_DAILY_CAP = 20;

// 战前排兵战术（裁决 B）：主线/群英塔开战前三选一，可选可不选（不选=无修正）。
const BATTLE_TACTICS = [
  { id: 'assault', name: '全军突袭', mods: { atkPct: 0.10, defPct: -0.05 } },
  { id: 'phalanx', name: '坚守阵地', mods: { defPct: 0.10, atkPct: -0.05 } },
  { id: 'guerrilla', name: '游斗袭扰', mods: { spdPct: 0.05, hpPct: -0.04 } }
];

// 悬赏派遣：每日刷新 4 单，派闲置武将出征，时辰到领赏（编外武将就业 + 次日回访钩子）。
// 刻意不含精铁：可重复的精铁来源会砸穿"六槽约 30 天满星"日历锚，精铁副产线只留给群英塔。
// gold 随主线进度最高翻倍（铜钱本就富余，作爽点数字）；gem/scroll 固定。
const BOUNTY = {
  slots: 4,
  pool: [
    { hours: 4, weight: 40, name: '短途运粮', reward: { gold: 20000, gem: 50 } },
    { hours: 8, weight: 35, name: '州郡剿匪', reward: { gold: 50000, gem: 150 } },
    { hours: 12, weight: 25, name: '千里传檄', reward: { scroll: 1, gem: 250 } }
  ]
};

// 集市神秘商人：每日按（日期+建号日）确定性刷 2 件，当日有效、各限购 1。
// 不上招募令折扣（保"单抽 100/十连 900"定价锚）、不上精铁（保 30 天满星日历）。
const ROAMER_POOL = [
  { id: 'r_scroll5', name: '招募令 ×5', cur: 'gem', price: 450, give: { scroll: 5 } },
  { id: 'r_srbox', name: 'SR 军械自选箱', cur: 'gem', price: 300, give: { armoryBox: 2 } },
  { id: 'r_ssrbox', name: 'SSR 军械自选箱', cur: 'gem', price: 900, give: { armoryBox: 3 } },
  { id: 'r_shard30', name: '通用碎片 ×30', cur: 'gem', price: 150, give: { shard: 30 } },
  { id: 'r_token10', name: '演武令 ×10', cur: 'gem', price: 100, give: { token: 10 } }
];

// 激励视频广告：按平台配置广告位 ID（微信 wechat / 抖音 douyin）
// 对应平台为空时使用内置模拟广告（测试模式，流程完整可验证）
// 正式变现：微信开通流量主 / 抖音开通星图变现后，把各自广告位 ID 填入对应字段即切换为真广告
const AD = {
  rewardedUnitIds: { wechat: '', douyin: '' },
  placements: {
    idle2x: { limit: 3, name: '双倍领取挂机收益' },
    fast:   { limit: 3, name: '快速收获 · 立即 1 小时收益' },
    summon: { limit: 1, name: '免费招募令' },
    revive: { limit: 1, name: '战败复活再战' }
  }
};

// 第一期主线：12 章 × 10 关；第 121 关起为循环乱世，不套用一期里程碑。
const FIRST_STAGE_END = 120;
// 主线难度曲线：普通关随第一期进度平滑增长；名将关按阵容整体倍率突出。
// 个别敌阵技能组合会形成异常超时墙，单独削峰，避免用全局降难度加速全程。
const CAMPAIGN_DIFFICULTY = {
  levelSlope: 1.9,
  normalEndScale: 1.08,
  // 这些普通关的敌阵技能组合明显强于相邻关，轻微校准后仍保留阵容特点。
  normalOverrides: { 47: 0.95, 72: 0.95, 89: 0.95, 99: 0.95, 117: 0.95 },
  bossMainScale: 1.18,
  bossOtherScale: 1.08,
  bossOverrides: {
    50: { main: 1.08, other: 0.99 },
    80: { main: 1.08, other: 0.99 },
    110: { main: 1.08, other: 0.99 }
  }
};
// 一期固定里程碑（在普通首通与章末奖励之外，只发一次；旧档通关后补发一次）。
const CAMPAIGN_MILESTONES = {
  40:  { ssrPick: 1, label: 'SSR 武将自选券 ×1' },
  90:  { armoryBox: 3, label: 'SSR 军械自选箱 ×1' },
  100: { ssrPick: 1, label: 'SSR 武将自选券 ×1' },
  110: { armoryBox: 3, label: 'SSR 军械自选箱 ×1' },
  120: { scroll: 10, label: '招募令 ×10 · 第一期主线完成' }
};

// 会话段落化（评审团波次 1）：每章第 5 关为精锐关（第 3/7 关预留给词缀、第 10 关名将）。
// 前 25 关不做精锐，保护新手期（第 15 关是首个团灭墙）。
const ELITE_STAGE = { every: 5, minStage: 25, scale: 1.06 };
// 三星评星：★1 通关；★2 限时；★3 我方存活≥4。章节星数宝箱 10/20/30（刻意不含精铁）。
const STAR_RULES = { fastSeconds: 60, eliteFastSeconds: 70, aliveNeed: 4 };
const CHAPTER_STAR_CHESTS = [
  { need: 10, reward: { gem: 100 }, label: '元宝 ×100' },
  { need: 20, reward: { shard: 15 }, label: '通用碎片 ×15' },
  { need: 30, reward: { scroll: 3 }, label: '招募令 ×3' }
];
// 章节词缀（评审团波次 2）：每章第 3/7 关（章内 index 2/6）带机制词缀，≥25 关启用。
// 补偿 ×0.95；已有 normalOverrides 的关（如 117）不叠乘。词缀与精锐不叠同关。
const CAMPAIGN_MODS = {
  compensation: 1.0,
  minStage: 25,
  pool: ['poisonFog', 'allBack', 'reinforce', 'ironWall', 'gale', 'famine'],
  meta: {
    poisonFog: { name: '毒雾', desc: '每秒双方全体损失 0.5% 最大生命' },
    allBack:   { name: '风筝', desc: '敌军全员撤至后排' },
    reinforce: { name: '援军', desc: '战斗第 20/40 秒敌军各获一支援军' },
    ironWall:  { name: '铁壁', desc: '敌军开场获得 30% 护盾，受疗减半' },
    gale:      { name: '疾风', desc: '敌军先手 40 怒气，攻速 +10%' },
    famine:    { name: '断粮', desc: '双方治疗效果减半' }
  }
};
// 名将 Boss 机制（复用现有被动通道 + ccImmune/cheatRevivePct），全部有剧情对应
const BOSS_MODS = {
  10:  { name: '黄天再起', desc: '张角倒地后会以 30% 血量再起一次', passive: { cheatRevivePct: 0.3, firstEnergy: 50 } },
  20:  { name: '飞将无双', desc: '吕布免疫控制', passive: { ccImmune: 1 } },
  30:  { name: '飞将无双', desc: '吕布免疫控制', passive: { ccImmune: 1 } },
  40:  { name: '四世三公', desc: '袁绍家底厚实，开场获得 25% 护盾', passive: { armoryStartShield: 0.25 } },
  50:  { name: '八门金锁', desc: '曹仁受到的伤害降低 15%', passive: { dmgReduce: 0.15 } },
  60:  { name: '虎痴裸衣', desc: '许褚反弹 12% 所受伤害', passive: { thorns: 0.12 } },
  70:  { name: '横槊赋诗', desc: '曹操开场即有 40 怒气', passive: { firstEnergy: 40 } },
  80:  { name: '亲征汉中', desc: '曹操开场获得 25% 护盾与 40 怒气', passive: { armoryStartShield: 0.25, firstEnergy: 40 } },
  90:  { name: '白衣绞杀', desc: '吕蒙的攻击附带 15% 吸血', passive: { vamp: 0.15 } },
  100: { name: '书生拜将', desc: '陆逊开场即有 50 怒气', passive: { firstEnergy: 50 } },
  110: { name: '七擒七纵', desc: '孟获倒地后会以 30% 血量再起一次', passive: { cheatRevivePct: 0.3 } },
  120: { name: '群英梦影', desc: '吕布免疫控制，且倒地后会以 30% 血量再起', passive: { ccImmune: 1, cheatRevivePct: 0.3 } }
};
// 定向招募券（评审团裁决版）：每 10 抽赠 1 张、每周限用 2 张；券激活下一组十连，
// 该十连 SR 以上 70% 落所选阵营（阵营内均匀，无该品质回落全池）。概率/定价/硬保底全部不动。
const SUMMON_TICKET = { perPulls: 10, weeklyUseLimit: 2, focusShare: 0.7 };
// 招贤值：终身累计抽数的五档一次性奖励；万能 SSR 在 2500 档（约第 40 天，30 天不可得）
const SUMMON_POINTS = [
  { need: 100, reward: { scroll: 10 }, label: '招募令 ×10' },
  { need: 400, reward: { gem: 888 }, label: '元宝 ×888' },
  { need: 900, reward: { ssrPick: 1 }, label: 'SSR 自选券 ×1' },
  { need: 1600, reward: { ssrPick: 1 }, label: 'SSR 自选券 ×1' },
  { need: 2500, reward: { univSsr: 1 }, label: '万能 SSR 卡 ×1' }
];

// 锻造台（评审团裁决版）：六槽全部 5★ 后开启（gate 在事务内校验，锚数学封闭）。
// 每槽 2 词条位：第一词条位玩家在攻/守两池二选一，第二位自动取另一池（任何部位不可能双攻或双守）。
// 洗练档位 白 58%/蓝 30%/紫 12%，值=档位表；每槽位独立 6 次保底紫；锁定免费，洗另一条费用 ×2。
const FORGE = {
  reroll: { gold: 12000, iron: 25 },
  freeRerolls: 3,
  pity: 6,
  tiers: { weights: [0.58, 0.30, 0.12] },
  // 每槽攻/守两池：tiers=[白,蓝,紫]
  pools: {
    weapon: { atk: [{ stat: 'critDmg', name: '暴伤', tiers: [0.06, 0.10, 0.14] }, { stat: 'energyGain', name: '怒气获取', tiers: [0.04, 0.07, 0.10] }],
              def: [{ stat: 'vamp', name: '吸血', tiers: [0.02, 0.035, 0.05] }, { stat: 'thorns', name: '反弹', tiers: [0.06, 0.10, 0.15] }] },
    armor:  { atk: [{ stat: 'thorns', name: '反弹', tiers: [0.06, 0.10, 0.15] }, { stat: 'energyGain', name: '怒气获取', tiers: [0.04, 0.07, 0.10] }],
              def: [{ stat: 'recvHeal', name: '受疗', tiers: [0.05, 0.08, 0.12] }, { stat: 'directDR', name: '直接减伤', tiers: [0.01, 0.015, 0.02] }] },
    helm:   { atk: [{ stat: 'critDmg', name: '暴伤', tiers: [0.06, 0.10, 0.14] }, { stat: 'vamp', name: '吸血', tiers: [0.02, 0.035, 0.05] }],
              def: [{ stat: 'directDR', name: '直接减伤', tiers: [0.01, 0.015, 0.02] }, { stat: 'recvHeal', name: '受疗', tiers: [0.05, 0.08, 0.12] }] },
    boots:  { atk: [{ stat: 'energyGain', name: '怒气获取', tiers: [0.04, 0.07, 0.10] }, { stat: 'critDmg', name: '暴伤', tiers: [0.06, 0.10, 0.14] }],
              def: [{ stat: 'recvHeal', name: '受疗', tiers: [0.05, 0.08, 0.12] }, { stat: 'thorns', name: '反弹', tiers: [0.06, 0.10, 0.15] }] },
    jade:   { atk: [{ stat: 'energyGain', name: '怒气获取', tiers: [0.04, 0.07, 0.10] }, { stat: 'critDmg', name: '暴伤', tiers: [0.06, 0.10, 0.14] }],
              def: [{ stat: 'recvHeal', name: '受疗', tiers: [0.05, 0.08, 0.12] }, { stat: 'vamp', name: '吸血', tiers: [0.02, 0.035, 0.05] }] },
    seal:   { atk: [{ stat: 'critDmg', name: '暴伤', tiers: [0.06, 0.10, 0.14] }, { stat: 'vamp', name: '吸血', tiers: [0.02, 0.035, 0.05] }],
              def: [{ stat: 'directDR', name: '直接减伤', tiers: [0.01, 0.015, 0.02] }, { stat: 'thorns', name: '反弹', tiers: [0.06, 0.10, 0.15] }] }
  }
};

// 阵图（评审团裁决版）：账号级三选一、切换免费；件数=指定部位中 3★ 数（5★ 计满档）。
// 激活 250/张（铜钱可抵 50%，1 精铁=40 铜钱）；效果量级 ≤ 名器单件，防"套装>一切"。
const MOTIFS = [
  { id: 'huxiao', name: '虎啸阵', slots: ['weapon', 'seal', 'helm', 'jade'],
    two: { crit: 0.02 }, four: { atk: 0.03 }, maxed: { critDmg: 0.10 },
    desc: '二件套暴击+2% · 四件套全军攻击+3% · 全 5★ 追加暴伤+10%' },
  { id: 'panshi', name: '磐石阵', slots: ['armor', 'helm', 'jade', 'seal'],
    two: { recvHeal: 0.06 }, four: { hp: 0.03 }, maxed: { startShield: 0.02 },
    desc: '二件套受疗+6% · 四件套全军生命+3% · 全 5★ 追加开场护盾+2%' },
  { id: 'jifeng', name: '疾风阵', slots: ['boots', 'seal', 'weapon', 'jade'],
    two: { energyGain: 0.05 }, four: { spdPct: 0.02 }, maxed: { startEnergy: 3 },
    desc: '二件套怒气获取+5% · 四件套全军速度+2% · 全 5★ 追加开场怒气+3' }
];
const MOTIF_COST = { iron: 250, goldPerIron: 40 };

// 熔炉：重复掉落入库存（条目上限 9），熔回 70%，3 件同槽 N/R 合成上一档（SR/SSR 不可合成）
const SMELT = {
  stockCap: 9,
  meltRate: 0.7,
  recipes: { 1: { need: 3, iron: 60, gold: 8000 }, 2: { need: 3, iron: 150, gold: 20000 } }
};

// 觉醒（裁决 C 精简版）：满 5★ SSR 专属长线；每级全军可感战力 +5% 三维，荣耀+SSR 碎片门控。
// 30 天内玩家最多到 1~2 级（荣耀来自名人堂周全胜/称号），不影响任何 30 天锚。
const AWAKEN = {
  max: 3,
  multPerLevel: 0.05,
  honor: [60, 120, 200],
  shards: [10, 20, 30]
};

// 专属兵法（裁决 C 方向余量）：满 5★ SSR 专属被动长线，1~5 级，只加成该武将自身。
// 将魂来源：满星 SSR 重复卡每张转 1 将魂（addHeroCard 满星 SSR 分支）。
// SSR 品质碎片（觉醒材料）补给：名人堂周全胜 5 片/周 + 主公成就 7~8 档各 15 片——除此之外无来源，觉醒线节奏受名人堂参与度门控。
// 每级费用：将魂 2/3/4/5/6 + 铜钱 2万/3万/4万/5万/6万；逐级增量见 utils/heroes.js 各 SSR 的 tactic.perLevel。
const TACTIC = {
  max: 5,
  soul: [2, 3, 4, 5, 6],
  gold: [20000, 30000, 40000, 50000, 60000]
};

// 阵型模板上限（保存位）
const FORMATION_PRESETS_MAX = 3;

// 演武名人堂（裁决 D）：9 席名阵容，每周按周 ID 哈希轮换 3 席；不限次挑战，重复只刷评星不发资源。
// 奖励纪律：无精铁、无招募令、无每胜元宝（一次性首杀元宝 50 除外）——锚保护同悬赏/商人。
const HALL = {
  weeklySeats: 3,
  levelMult: [0.85, 1.0, 1.15],
  star: { fast: 45, alive: 4 },
  firstKill: { honor: 20, gem: 50 },
  firstThreeStar: { honor: 10, shard: 5 },
  weeklyClear: { token: 10, honor: 10, shard4: 5 }, // SSR 碎片：觉醒线补给
  titles: [{ honor: 100, title: '常胜将军' }, { honor: 300, title: '武圣传说' }],
  replayCap: 5,
  pool: [
    { id: 'wuhu', name: '五虎上将', faction: 'shu', trait: null,
      members: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'] },
    { id: 'wolong', name: '卧龙凤雏', faction: 'shu', trait: { firstEnergy: 40 },
      members: ['zhugeliang', 'pangtong', 'liubei', 'huatuo', 'zhaoyun'] },
    { id: 'huwei', name: '虎卫铁壁', faction: 'wei', trait: { armoryStartShield: 0.25 },
      members: ['caocao', 'simayi', 'zhangliao', 'dianwei', 'huaxiong'] },
    { id: 'huoshao', name: '火烧连营', faction: 'wu', trait: null,
      members: ['zhouyu', 'luxun', 'sunce', 'diaochan', 'dongzhuo'] },
    { id: 'feijiang', name: '飞将无双', faction: 'qun', trait: { ccImmune: 1 },
      members: ['lvbu', 'diaochan', 'zuoci', 'yuji', 'jiling'] },
    { id: 'wuzi', name: '五子良将', faction: 'wei', trait: null,
      members: ['zhangliao', 'zhanghe', 'xuhuang', 'yujin', 'yuejin'] },
    { id: 'jiangdong', name: '江东十二臣', faction: 'wu', trait: { energyGain: 0.15 },
      members: ['sunce', 'ganning', 'taishici', 'zhouyu', 'luxun'] },
    { id: 'huxi', name: '虎痴恶来', faction: 'wei', trait: { thorns: 0.12 },
      members: ['xuchu', 'dianwei', 'caocao', 'guojia', 'xunyu'] },
    { id: 'nanyman', name: '南蛮象兵', faction: 'qun', trait: { hp: 0.15 },
      members: ['menghuo', 'dongzhuo', 'huaxiong', 'jiling', 'yuji'] }
  ]
};

// 图鉴章节收集奖励（裁决版：全 SSR 不发卡改荣耀；全 SR 送 SR 万能卡仅喂未满星 SR）
const CODEX_REWARDS = [
  { key: 'shu-nr', name: '蜀·N+R 集齐', reward: { gem: 500, scroll: 10 } },
  { key: 'wei-nr', name: '魏·N+R 集齐', reward: { gem: 500, scroll: 10 } },
  { key: 'wu-nr', name: '吴·N+R 集齐', reward: { gem: 500, scroll: 10 } },
  { key: 'qun-nr', name: '群·N+R 集齐', reward: { gem: 500, scroll: 10 } },
  { key: 'shu-sr', name: '蜀·SR 集齐', reward: { scroll: 10 }, srShards: 5 },
  { key: 'wei-sr', name: '魏·SR 集齐', reward: { scroll: 10 }, srShards: 5 },
  { key: 'wu-sr', name: '吴·SR 集齐', reward: { scroll: 10 }, srShards: 5 },
  { key: 'qun-sr', name: '群·SR 集齐', reward: { scroll: 10 }, srShards: 5 },
  { key: 'all-sr', name: '全 SR 集齐', reward: {}, univSr: 1 },
  { key: 'all-ssr', name: '全 SSR 集齐 · 收集天下', reward: { gem: 3000 }, title: '收集天下' }
];

// 主公成就（去元宝版）：五轴各 10 档，1~6 档铜钱/碎片/演武令，7~8 档加称号，9~10 档（60~90 天）才发元宝
const ACHV_AXES = {
  codex: { name: '图鉴', tiers: [10, 20, 30, 50, 70, 90, 105, 115, 119, 120] },
  bonds: { name: '羁绊', tiers: [1, 2, 3, 4, 5, 6, 7, 8, 8, 8] },
  campaign: { name: '推图', tiers: [10, 20, 40, 60, 80, 100, 110, 115, 118, 120] },
  tower: { name: '登塔', tiers: [5, 10, 20, 30, 45, 60, 80, 100, 130, 160] },
  arena: { name: '演武', tiers: [3, 8, 15, 25, 40, 60, 90, 130, 200, 300] }
};
const ACHV_REWARDS = [
  { gold: 10000, shard: 5, token: 10 }, { gold: 15000, shard: 8, token: 10 }, { gold: 20000, shard: 10, token: 10 },
  { gold: 30000, shard: 12, token: 10 }, { gold: 40000, shard: 14, token: 10 }, { gold: 50000, shard: 15, token: 10 },
  { shard: 20, token: 30, title: '名家', shard4: 15 }, { shard: 30, token: 30, title: '豪杰', shard4: 15 },
  { gem: 2000, title: 'name' }, { gem: 3000, frame: 1 }
];

// 远征周系统（合并 C-P5+D-P1）：ISO 周重置；周任务零新行为聚合；印信兑换禁精铁/招募令直发
const WEEKLY = {
  quests: [
    { key: 'wins', target: 21, reward: { seals: 15 }, label: '本周任意战斗胜利 21 场' },
    { key: 'stages', target: 30, reward: { seals: 15 }, label: '本周推图推进 30 关' },
    { key: 'tower', target: 15, reward: { seals: 10 }, label: '本周群英塔登 15 层' },
    { key: 'arenaWins', target: 5, reward: { seals: 10 }, label: '本周演武获胜 5 场' },
    { key: 'bounty', target: 12, reward: { seals: 10 }, label: '本周派遣悬赏 12 单' },
    { key: 'summons', target: 30, reward: { seals: 10 }, label: '本周召唤 30 次' },
    { key: 'idle', target: 5, reward: { seals: 10 }, label: '本周领取挂机 5 天' }
  ],
  activeTiers: [{ need: 40, reward: { seals: 10 } }, { need: 70, reward: { seals: 15 } }, { need: 100, reward: { seals: 20 } }],
  trialFloors: [1.0, 1.15, 1.3],
  trialSeals: [15, 20, 35],
  shop: [
    { id: 'w_shard', name: '通用碎片 ×30', seals: 20, give: { shard: 30 }, weekly: 0 },
    { id: 'w_token', name: '演武令 ×10', seals: 15, give: { token: 10 }, weekly: 0 },
    { id: 'w_gem', name: '元宝 ×800', seals: 40, give: { gem: 800 }, weekly: 1 },
    { id: 'w_ssr', name: 'SSR 自选券', seals: 90, give: { ssrPick: 1 }, weekly: 0 },
    { id: 'w_title', name: '称号 · 远征名将', seals: 120, give: { title: '远征名将' }, weekly: 0 }
  ]
};

// 回归补给（断签梯度）：lastSeenTs 间隔 ≥48h 触发，7 天窗口至多一次；每日上线玩家结构性拿不到
const RETURN_GRANTS = [
  { minDays: 2, reward: { scroll: 3, gem: 300 }, label: '招募令 ×3 · 元宝 ×300' },
  { minDays: 4, reward: { scroll: 5, gem: 800, shard: 20 }, label: '招募令 ×5 · 元宝 ×800 · 碎片 ×20' },
  { minDays: 7, reward: { ssrPick: 1, gem: 1500 }, label: 'SSR 自选券 ×1 · 元宝 ×1500' }
];

// 今日目标关（每日首个精锐关胜利）日宝箱：铜钱+三选一随机
const DAILY_ELITE_CHEST = { gold: 20000, pick: [{ scroll: 1 }, { gem: 50 }, { shard: 5 }] };

export {
  FACTIONS, BEATS, FACTION_ADV, ENEMY_FACTION_AURA, CLASSES, RARITIES,
  LEVEL_CAPS, MAX_LEVEL, PLAYER_LEVEL, BATTLE_XP, AUTO_BATTLE, FOOD_VALUE, DUPE_GOLD,
  goldCost, expCost, idleRates, IDLE_CAP_HOURS, GEM_IDLE, ARMORY_IRON_PER_HOUR,
  FAST_AD, FAST_PAID,
  GACHA, factionBonus, FORMATION_ROWS, BATTLE, ARENA, SEVEN_DAY, TRAINING_DAILY_CAP, BOUNTY, ROAMER_POOL, AD,
  FIRST_STAGE_END, CAMPAIGN_DIFFICULTY, CAMPAIGN_MILESTONES, ELITE_STAGE, STAR_RULES, CHAPTER_STAR_CHESTS, DAILY_ELITE_CHEST,
  CAMPAIGN_MODS, BOSS_MODS, RETURN_GRANTS, SUMMON_TICKET, SUMMON_POINTS, FORGE, MOTIFS, MOTIF_COST, SMELT,
  CODEX_REWARDS, ACHV_AXES, ACHV_REWARDS, WEEKLY, HALL, AWAKEN, FORMATION_PRESETS_MAX, TACTIC, BATTLE_TACTICS
};
