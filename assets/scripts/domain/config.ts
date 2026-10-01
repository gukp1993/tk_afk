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
  1: { key: 1, name: 'N', color: '#c8ccd4', maxStar: 2, },
  2: { key: 2, name: 'R', color: '#6f9fd8', maxStar: 3, },
  3: { key: 3, name: 'SR', color: '#b07fe0', maxStar: 4, mult: 1.0 },
  4: { key: 4, name: 'SSR', color: '#f0a83e', maxStar: 5, }
};

// 每星属性倍率；英雄等级上限统一由玩家等级决定。
const STAR_MULT = 1 + 0.12; // per star
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

// 卡关处方单（2026-09-30 研讨会二 P1）：战役败北页按终局快照归因 + 按资源可完成度生成 2 条养成处方。
// enabled=false 时败北页回退旧提示与旧两按钮（推荐布阵/升级军械）。
const DEFEAT_RX = { enabled: true, maxItems: 2 };

// 战报中心（2026-09-30 研讨会二 P3）：全模式战报环形 20 条，按 tier 淘汰（越小越保留）：
// 0=战役首通挑战(含名将) 1=名人堂 2=塔里程碑 3=演武高危 4=其余。
// capture.* 四开关置 false 即关闭对应捕获；全 false 回到仅名人堂行为（旧数据仍兼容展示）。
const REPLAYS = { max: 20, arenaHighDiff: 1.2,
  capture: { hall: true, campaignFirst: true, towerMilestone: true, arenaHigh: true } };

// 周常 Boss（2026-09-30 研讨会四 P3）：每周一 SSR 名将（按周键轮换、×3 强度），每日共用 3 次挑战，
// 取最高伤害占 Boss 血量百分比定 5 档奖（只发印信/演武令，零新货币）。周键切换重置。
// HP/阈值待专项仿真校准（docs/reviews/周Boss仿真-*.md），当前为草案值。回退：enabled=false。
const WEEKBOSS = {
  enabled: true, attempts: 3,
  // 巨血口径：MaxHp = hpK × 同等星等级关羽体魄；阈值 >6/4.5/3/1.5/0%
  // （研讨会十二 B1 轻参与校准 2026-10-02：97% 挑战落 0%/2% 档→阈值前移+顶部印信平移中间档，
  //   hpK 350→220 让中练度玩家当周可升档；回退：hpK/tiers 单字段还原）
  hpK: 220,
  tiers: [
    { pct: 0.06, reward: { seals: 25, token: 10 } },
    { pct: 0.045, reward: { seals: 18, token: 8 } },
    { pct: 0.03, reward: { seals: 12, token: 5 } },
    { pct: 0.015, reward: { seals: 8, token: 3 } },
    { pct: 0, reward: { seals: 5, token: 2 } }
  ]
};

// 军屯双本（2026-09-30 研讨会四 P2）：每日资源副本。屯金（铜钱）+ 屯兵（玩家经验）各每日 2 次，
// 10 层顺序解锁、敌力按层爬升（敌人等级随玩家等级与层数缩放）。掉落只发铜钱/玩家经验——
// 禁碎片/精铁/招募令/元宝/军械箱（护 SSR 数量锚、军械 30 天锚、抽卡锚）。回退：enabled=false 隐入口。
const DUNGEON = {
  enabled: true, daily: 2, maxFloor: 10,
  goldReward: (f) => 6000 + 4500 * f,
  xpReward: (enemyLevel) => 60 + 15 * enemyLevel,
  enemyLevel: (f, playerLevel) => Math.max(1, Math.round((playerLevel || 1) * (0.85 + 0.07 * Math.min(f, 10))))
};

// 借将助战（2026-09-30 研讨会五批次 1 改判先行；专项仿真 5100 场定稿参数）
// NPC SSR 第 6 人助战 PVE（禁演武/名人堂/周Boss），等级=玩家全局等级×0.8 向下取整、固定 3★、
// 不吃军械/觉醒/兵法/羁绊加成；每日 1 次（跨日重置）；助将位按周键轮换。回退：enabled=false。
const BORROW = {
  enabled: true, levelFactor: 0.8, star: 3,
  pool: ['lvbu', 'zhaoyun', 'zhugeliang', 'zhouyu', 'sunce', 'simayi'],
  excludedModes: ['arena', 'hall', 'weekboss']
};

// 乱世里程碑（2026-09-30 研讨会六 A3）：每乱世章末一次性小奖（禁精铁/招募令），
// 200 关（乱世四章）给称号收官。走 campaignFirstReward 里程碑渲染链，旧档无需迁移（cleared 尚不可能超 160）。
const CHAOS_MILESTONES = {
  170: { shard: 20, token: 10, label: '乱世 · 一章肃清' },
  180: { shard: 25, token: 12, label: '乱世 · 二章肃清' },
  190: { shard: 30, token: 15, label: '乱世 · 三章肃清' },
  200: { shard: 40, token: 20, title: '乱世·定鼎', label: '乱世 · 四章定鼎（称号）' }
};

// 借将助战（2026-09-30 研讨会五批次 1 改判先行；专项仿真 5100 场定稿参数）
// NPC SSR 每日 1 次第 6 人助战，仅 PVE（演武/名人堂/周Boss 排除）。
// 等级=玩家等级×0.8、固定 3★、白板体魄（heroStatsStar 纯净值）；周键轮换助将位。
// 回退：enabled=false 全链隐匿。

// 扫荡（2026-10-01 研讨会九 S2）：★3 已通关卡免战斗结算，与重复通关同规（铜钱+经验），
// 每日 3 次；不产元宝/精铁/招募令/碎片/军械，不计首通/战报/日常任务。回退：enabled=false。
const SWEEP = { enabled: true, daily: 3 };

// 每日 Boss 首杀（2026-10-01 研讨会十一 S3）：每日首个 Boss 系内容（名将/精锐/Boss/周Boss）胜利
// 发固定小额铜钱+三选一（碎片3/招募令1/元宝30），量级对齐精锐日宝箱。
// 无精铁、无每胜元宝；各模式共享每日一次。回退：enabled=false。
// 四方台 · 阵营试炼塔（研讨会十二候选池 A2，规格代理定稿）：周轮换蜀→魏→吴→群，
// 仅本周阵营武将可上阵（战斗时过滤编队，不动玩家阵型），30 层/周每日解锁 5 层。
// 奖励只发铜钱+印信小额+两永久称号——0 精铁/0 招募令/0 元宝/0 SSR 卡（铜钱满清 ≈周收入 6.7%<10% 自查）。
// 回退旋钮：enabled=false 三处收口（beginBattle 门/玩法页入口/试炼页）。
const QUAD_TOWER = {
  enabled: true,
  order: ['shu', 'wei', 'wu', 'qun'],
  themes: { shu: '汉中之战', wei: '官渡之战', wu: '赤壁之战', qun: '虎牢关' },
  floors: 30,
  dailyUnlock: 5,
  k: 0.80,
  overrides: {},
  copper: (f) => 4000 + 700 * f,
  // 敌等级：楼层数主导的爬梯 + 进度锚轻偏置（旧公式 2+(anchor+floor)*1.8 会让 30 层达 Lv270 全员不可通，
  //   k 校准 2026-10-02：改为 5+anchor×0.35+floor×3.5——日14 Lv100 第 15 层 ≈对半、毕业 Lv160 第 30 层落目标带）
  levelOf: (anchor, floor) => Math.round(5 + anchor * 0.35 + floor * 3.5),
  smallMilestone: { every: 5, seals: 6 },
  bigMilestone: { every: 10, seals: 12, gold: 80000 },
  titles: { 15: '四方先锋', 30: '四方都督' },
  bossPassives: {
    10: { name: '虎卫结阵', passive: { armoryStartShield: 0.25 } },
    20: { name: '先登陷阵', passive: { firstEnergy: 40 } },
    30: { name: '不死再起', passive: { cheatRevivePct: 0.3 } }
  },
  soldierOf: { wei: 'weiwu', shu: 'baier', wu: 'jingzhou', qun: 'huangjin' }
};

// 今日军务（研讨会十二 Top3-C1）：只读聚合清单+勤勉计数。零经济：仅 30 天称号，不动任何数值锚。
// 回退旋钮：enabled=false 隐入口（store 返回空结构、UI 不渲染）。
const DAILY_AGENDA = {
  enabled: true,
  fullCount: 8,
  titleDays: 30,
  titleName: '勤勉·恪尽军务',
  entries: [
    { key: 'idle', label: '领取挂机收益', page: 'campaign', prio: 1 },
    { key: 'fast', label: '快速收获 ×3', page: 'campaign', prio: 2 },
    { key: 'bounty', label: '悬赏派遣 4 单', page: 'bounty', prio: 3 },
    { key: 'dungeon', label: '军屯双本 ×2', page: 'dungeon', prio: 4 },
    { key: 'arena', label: '演武切磋 ×5', page: 'arena', prio: 5 },
    { key: 'weekboss', label: '魔王讨伐 1 次', page: 'weekboss', prio: 6 },
    { key: 'sweep', label: '扫荡 ×3', page: 'campaign', prio: 7 },
    { key: 'tower', label: '群英塔 1 战', page: 'tower', prio: 8 },
    { key: 'wins3', label: '任意三胜', page: 'campaign', prio: 9 },
    { key: 'summonAd', label: '免费招募令', page: 'summon', prio: 10 },
    { key: 'quests', label: '每日任务全领', page: 'quests', prio: 11 }
  ]
};
const DAILY_BOSS_CHEST = {
  enabled: true, gold: 15000,
  pick: [{ shard: 3 }, { scroll: 1 }, { gem: 30 }]
};

// 新手首见浮层（2026-09-30 研讨会四 P1）：每场景首次进入弹一次图文说明。
// 老档（无 tutorial 字段）视为全部已见，防浮层雨；TUTORIAL_OFF=true 全局关闭。
const TUTORIAL_OFF = false;
const TUTORIALS = {
  forge: { title: '锻造台 · 词条洗练', lines: ['六槽全部 5★ 后开启', '先选攻/守方向，再洗练两条词条', '白→蓝→紫三档，5 次未出紫必出紫', '锁定词条可保底洗另一条（费用翻倍）'] },
  drill: { title: '校场操练 · 编外将价值', lines: ['仅 N/R 品质可操练，消耗铜钱', '每级 +4% 该将悬赏派遣加成', '满级 +20%，与阵营加成叠加封顶 +40%', '不影响战斗数值——后期铜钱正好用在这'] },
  hall: { title: '名人堂 · 每周三席', lines: ['本周三套名阵容，挑战获取荣耀', '首杀 +20 荣耀，三星再 +10 与碎片', '三席全胜有周奖；荣耀解锁觉醒与称号', '下方战报可回放最近对局'] },
  bounty: { title: '悬赏派遣 · 编外将就业', lines: ['每日 4 单，派 1 将出征按时领赏', '派同阵营将该单铜钱元宝 +20%', '操练过的 N/R 将加成更高（封顶 +40%）', '到时未领也不亏——跨日自动补发'] },
  agenda: { title: '今日军务 · 每日清单', lines: ['一条清单看全今天该做的事', '按「下一步」推荐逐项清掉', '满 8 项记 1 天勤勉，累计 30 天得称号', '红点亮起 = 有收益可领'] },
  expedition: { title: '远征 · 周循环中心', lines: ['无限层挑战：难度与印信随层数上涨', '周任务 7 条+活跃宝箱，印信主要来源', '印信商店可换 SSR 自选券与限定称号', '每周一刷新词缀与任务'] },
  rx: { title: '卡关处方单', lines: ['败北不再只给一句提示', '按失败原因给出 2 条「现在就能做」的强化', '点处方按钮直达对应养成页', '做完再战——大多数卡关差的就是一步'] },
  dungeon: { title: '军屯双本 · 每日刷本', lines: ['屯金得铜钱，屯兵得主公经验', '每日 2 次双轨共用，层数顺序解锁', '敌方等级随主公等级与层数缩放', '掉落不含精铁与碎片——资源锚不冲突'] },
  weekboss: { title: '魔王讨伐 · 每周结算', lines: ['本周魔王全服同敌，每日 3 次机会', '伤害占魔王血量比例越高档位越高', '档位奖发印信与演武令，周日刷新', '打不满 100% 也没关系，逐周变强'] },
  borrow: { title: '借将助战 · 第 6 人', lines: ['本周可借一位 NPC 名将随军出征', '借将等级为主公等级八折、固定 3★', '仅 PVE 生效——演武与名人堂不带', '编队满员时作为第 6 人补强短板'] }
};

// 14 日第二周目标树（2026-09-30 研讨会三方案 2）：第 8~14 天一次性里程碑（非每日清单）。
// 条件绑定既有模式；无时限——达成后随时可领（追赶友好，无需漏领补偿）。
// 毕业奖避开 SSR 券与大额元宝，护 SSR P50 口径与抽卡锚。
const FOURTEEN_DAY = [
  { day: 8, kind: 'campaign', need: 35, cond: '推图 35 关', reward: { scroll: 5 }, label: '招募令 ×5' },
  { day: 10, kind: 'arena', need: 1100, cond: '演武上将军', reward: { gem: 300 }, label: '元宝 ×300' },
  { day: 12, kind: 'tower', need: 20, cond: '群英塔 20 层', reward: { shard: 30 }, label: '通用碎片 ×30' },
  { day: 14, kind: 'campaign', need: 60, cond: '推图 60 关', reward: { shard: 50, scroll: 10, gem: 200 }, label: '碎片50 令10 宝200' }
];

// N/R 校场操练（2026-09-30 研讨会三方案 1）：铜钱排水渠。N/R 武将操练升级，
// 每级 +4% 该将悬赏派遣加成（5 级 +20%），与阵营加成叠加、总封顶 40%；不碰战斗数值。
const DRILL = { maxLevel: 5, pctPerLevel: 0.04, totalCap: 0.4,
  costs: [50000, 120000, 250000, 450000, 700000] };

// 演武场：每日 5 次；令牌按对手难度分档（胜），败给 1；段位首次达成发一次性奖励。
// 赛季（2026-09-30 研讨会裁决 A）：每周一软重置，新周积分=上周×WEEK_CARRY；
// 周段位奖按本周达到的最高段位一次性发放（偏将及以上），只发铜钱/演武令/元宝/印信——禁精铁与招募令直发。
// rankReached 保持「历史最高段位」语义，首达奖励永不重发。
const ARENA = {
  DAILY: 5,
  LOSE_TOKENS: 1,
  // 每日首胜积分 ×1.5（研讨会十二 B1：只动积分不动令牌，让 1~2 场/日的轻参与玩家 2~3 周内够到偏将周奖门槛）
  FIRST_WIN_POINTS_BONUS: 1.5,
  winTokens: (diff) => (diff > 1.2 ? 4 : diff >= 1 ? 3 : 2),
  rankBonus: { gem: 100, iron: 50 },
  WEEK_CARRY: 0.5,
  weekRankBonus: {
    '偏将军': { gold: 80000 },
    '裨将军': { token: 8 },
    '四征将军': { gem: 120 },
    '车骑将军': { gem: 200, gold: 100000 },
    '大将军': { seals: 20, gem: 300 }
  }
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
// SR 兵法（裁决 A）：24 只 SR 各一条，3 级上限，SR 品质碎片+铜钱门控
const TACTIC_SR = { max: 3, shard3: [2, 3, 4], gold: [15000, 25000, 40000] };

const BATTLE_TACTICS = [
  { id: 'assault', name: '全军突袭', desc: '全军攻击 +10% · 防御 -5%', mods: { atkPct: 0.10, defPct: -0.05 } },
  { id: 'phalanx', name: '坚守阵地', desc: '全军防御 +10% · 攻击 -5%', mods: { defPct: 0.10, atkPct: -0.05 } },
  { id: 'guerrilla', name: '游斗袭扰', desc: '全军速度 +5% · 生命 -4%', mods: { spdPct: 0.05, hpPct: -0.04 } }
];

// 悬赏派遣：每日刷新 4 单，派闲置武将出征，时辰到领赏（编外武将就业 + 次日回访钩子）。
// 刻意不含精铁：可重复的精铁来源会砸穿"六槽约 30 天满星"日历锚，精铁副产线只留给群英塔。
// gold 随主线进度最高翻倍（铜钱本就富余，作爽点数字）；gem/scroll 固定。
const BOUNTY = {
  slots: 4,
  // 同阵营派遣加成（2026-09-30 研讨会备选 E，AFK 悬赏条件本地化单将版）：
  // 派出与悬赏单 wantFaction 同阵营的武将，该单铜钱与元宝 +20%；招募令永不加成（护抽卡经济锚）。
  factionBonus: { pct: 0.2 },
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
    summon: { limit: 1, name: '免费招募令' }
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
  normalOverrides: { 47: 0.95, 72: 0.95, 89: 0.95, 99: 0.95, 117: 0.95, 155: 1.15 },
  bossMainScale: 1.18,
  bossOtherScale: 1.08,
  bossOverrides: {
    50: { main: 1.08, other: 0.99 },
    80: { main: 1.08, other: 0.99 },
    110: { main: 1.08, other: 0.99 },
    // 二期末段张力（2026-09-30 校准代理建议，docs/reviews/二期校准-121-160.md）：
    // 满级档 121~160 全程 100% 胜率、Boss 机制无感，末段抬 155 普通关与 160 名将制造终局挑战；
    // 预期顶配档 160 胜率降至 70~90%，160 里程碑（SSR 自选券）仍可达。
    160: { main: 1.42, other: 1.24 }
  }
};
// 一期固定里程碑（在普通首通与章末奖励之外，只发一次；旧档通关后补发一次）。
// 140/150/160 为二期（13~16 章）里程碑：同样一次性、旧档通关补发，不碰精铁/招募令红线。
const CAMPAIGN_MILESTONES = {
  40:  { ssrPick: 1, label: 'SSR 武将自选券 ×1' },
  90:  { armoryBox: 3, label: 'SSR 军械自选箱 ×1' },
  100: { ssrPick: 1, label: 'SSR 武将自选券 ×1' },
  110: { armoryBox: 3, label: 'SSR 军械自选箱 ×1' },
  120: { scroll: 10, label: '招募令 ×10 · 第一期主线完成' },
  140: { gem: 888, label: '元宝 ×888 · 群英梦影完成' },
  150: { armoryBox: 3, label: 'SSR 军械自选箱 ×1' },
  160: { ssrPick: 1, label: 'SSR 武将自选券 ×1 · 二期主线完成' }
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
// 远征秘境（研讨会十二 A1）：周词缀双条（前 4 层免词缀护新手）+ 局内加护三选一
// 词缀复用 CAMPAIGN_MODS 六通道（只作用敌侧）；加护全走既有被动键，局内叠加、周重置清空。
const EXPEDITION_MUTATORS = {
  enabled: true, freeFloors: 4, count: 2,
  pool: ['poisonFog', 'allBack', 'reinforce', 'ironWall', 'gale', 'famine']
};
const EXPEDITION_BOONS = {
  enabled: true, every: 3, choices: 3, maxStack: 6,
  pool: [
    { id: 'b_atk1', name: '锋锐', passive: { atk: 0.04 }, desc: '全军攻击 +4%' },
    { id: 'b_atk2', name: '破军', passive: { atk: 0.07 }, desc: '全军攻击 +7%' },
    { id: 'b_hp1', name: '坚韧', passive: { hp: 0.05 }, desc: '全军生命 +5%' },
    { id: 'b_hp2', name: '磐石', passive: { hp: 0.08 }, desc: '全军生命 +8%' },
    { id: 'b_shield', name: '龟甲', passive: { armoryStartShield: 0.08 }, desc: '开战获 8% 生命护盾' },
    { id: 'b_vamp', name: '噬血', passive: { vamp: 0.04 }, desc: '全军吸血 +4%' },
    { id: 'b_thorns', name: '荆棘', passive: { thorns: 0.06 }, desc: '反伤 6%' },
    { id: 'b_crit', name: '锋芒', passive: { critDmg: 0.10 }, desc: '暴击伤害 +10%' },
    { id: 'b_energy', name: '奔雷', passive: { energyGain: 0.06 }, desc: '怒气获取 +6%' },
    { id: 'b_first', name: '先声', passive: { firstEnergy: 8 }, desc: '开场怒气 +8' },
    { id: 'b_dr', name: '铁壁', passive: { dmgReduce: 0.025 }, desc: '受到伤害 -2.5%' },
    { id: 'b_heal', name: '甘露', passive: { recvHeal: 0.08 }, desc: '受疗 +8%' }
  ]
};
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
  120: { name: '群英梦影', desc: '吕布免疫控制，且倒地后会以 30% 血量再起', passive: { ccImmune: 1, cheatRevivePct: 0.3 } },
  150: { name: '神威天将', desc: '马超免疫控制，且开场获得 25% 护盾', passive: { ccImmune: 1, armoryStartShield: 0.25 } },
  160: { name: '天命所归', desc: '吕布免疫控制，且受到的伤害降低 12%', passive: { ccImmune: 1, dmgReduce: 0.12 } }
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
// 词条套装（2026-10-01 研讨会十一 S2）：紫词条计数派生组合奖励（不动单条数值）。
// 量级 ≤ 一条紫词条的 1/3（沿 MOTIFS『套装>一切』防线）；只读派生不改存档。
const AFFIX_SETS = [
  { id: 'daoyi', name: '刀意', need: 2, stat: 'critDmg', bonus: 0.04,
    desc: '任意槽位 2 条暴伤紫词条 → 全军暴伤 +4%' },
  { id: 'budong', name: '不动', need: 2, stat: 'directDR', bonus: 0.05,
    desc: '任意槽位 2 条直接减伤紫词条 → 全军受疗 +5%' },
  { id: 'benlei', name: '奔雷', need: 2, stat: 'energyGain', bonus: 0.02,
    desc: '任意槽位 2 条怒气获取紫词条 → 开场怒气 +2' }
];

// 每日 Boss 首杀（2026-10-01 研讨会十一 S3）：每日首个 Boss 系内容（名将/精锐/Boss/周Boss）胜利
// 发固定小额铜钱+三选一（碎片3/招募令1/元宝30），量级对齐精锐日宝箱。
// 无精铁、无每胜元宝；各模式共享每日一次。回退：enabled=false。

// 新手首见浮层（2026-09-30 研讨会四 P1）
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
  replayCap: 5, // 已由 REPLAYS.max(20) 接管，保留字段仅供旧档迁移参考
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
// 名人堂/兵法/觉醒三轴扩展（评审 R2 裁决：独立轻量奖励表，全表禁 shard4/精铁/招募令直发）
const HALL_ACHV = { name: '名人堂', tiers: [3, 9, 18, 30, 45, 63, 84, 108, 135, 165],
  rewards: [{gold:10000,shard:5},{gold:15000,shard:8},{gold:20000,shard:10},{gold:30000,shard:12},{gold:40000,shard:14},{gold:50000,shard:15},{shard:20,token:30,title:'名人堂·名家'},{shard:30,token:30,title:'名人堂·豪杰'},{gem:2000,title:'名人堂·传奇'},{gem:3000,frame:1}] };
const TACTIC_ACHV = { name: '兵法', tiers: [1, 3, 6, 10, 15, 22, 30, 42, 60, 80],
  rewards: [{gold:10000,shard:5},{gold:15000,shard:8},{gold:20000,shard:10},{gold:30000,shard:12},{gold:40000,shard:14},{gold:50000,shard:15},{shard:20,token:30,title:'兵法·研习者'},{shard:30,token:30,title:'兵法·大师'},{gem:2000,title:'兵法·宗师'},{gem:3000,frame:1}] };
// 乱世成就轴（研讨会六 A1）：进度 = 161 关起的主线推进深度（cleared-160），
// 奖励沿扩展轴 R2 裁决（禁 shard4/精铁/招募令直发）
// 战报轴（研讨会九 P2）：终身战报数（环形缓冲清淘汰前的累计），旧档以当前条数初始化。
// 沿『资源从简』裁决：只发称号/头像框为主，低档点缀小额铜钱。
const REPLAY_ACHV = { name: '战报', tiers: [3, 10, 25, 50, 80, 120, 170, 230, 300, 400],
  rewards: [{gold:10000},{gold:15000},{gold:20000},{gold:30000,title:'战报·录史'},{gold:40000},{shard:20,token:30,title:'战报·藏锋'},{shard:30,token:30,title:'战报·百战'},{gem:2000,title:'战报·千机'},{gem:3000,title:'战报·武库'},{gem:5000,frame:1}] };
const CHAOS_ACHV = { name: '乱世', tiers: [5, 20, 45, 80, 130, 190, 260, 330, 380, 400],
  rewards: [{gold:10000,shard:5},{gold:15000,shard:8},{gold:20000,shard:10},{gold:30000,shard:12},{gold:40000,shard:14},{gold:50000,shard:15},{shard:20,token:30,title:'乱世·破军'},{shard:30,token:30,title:'乱世·伏虎'},{gem:2000,title:'乱世·天罡'},{gem:3000,frame:1}] };
const DRILL_ACHV = { name: '操练', tiers: [5, 20, 45, 80, 130, 190, 260, 330, 380, 400],
  rewards: [{gold:10000,shard:5},{gold:15000,shard:8},{gold:20000,shard:10},{gold:30000,shard:12},{gold:40000,shard:14},{gold:50000,shard:15},{shard:20,token:30,title:'操练·什长'},{shard:30,token:30,title:'操练·都伯'},{gem:2000,title:'操练·校尉'},{gem:3000,frame:1}] };
const AWAKEN_ACHV = { name: '觉醒', tiers: [1, 2, 4, 6, 9, 12, 16, 22, 30, 40],
  rewards: [{gold:10000,shard:5},{gold:15000,shard:8},{gold:20000,shard:10},{gold:30000,shard:12},{gold:40000,shard:14},{gold:50000,shard:15},{shard:20,token:30,title:'觉醒·开窍'},{shard:30,token:30,title:'觉醒·通达'},{gem:2000,title:'觉醒·化境'},{gem:3000,frame:1}] };

const ACHV_REWARDS = [
  { gold: 10000, shard: 5, token: 10 }, { gold: 15000, shard: 8, token: 10 }, { gold: 20000, shard: 10, token: 10 },
  { gold: 30000, shard: 12, token: 10 }, { gold: 40000, shard: 14, token: 10 }, { gold: 50000, shard: 15, token: 10 },
  { shard: 20, token: 30, title: '名家', shard4: 15 }, { shard: 30, token: 30, title: '豪杰', shard4: 15 },
  { gem: 2000, title: '传奇' }, { gem: 3000, frame: 1 }
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
  // 远征无限层：难度与印信按层数递增，milestones 一次性奖励
  trial: { scaleBase: 1.0, scaleStep: 0.12, scaleCap: 2.6, sealBase: 15, sealStep: 5, sealFloor: 10,
    milestones: [{ floor: 5, seals: 30 }, { floor: 10, seals: 50 }, { floor: 20, seals: 80 }, { floor: 30, seals: 120 }] },
  shop: [
    { id: 'w_shard', name: '通用碎片 ×30', seals: 20, give: { shard: 30 }, weekly: 0 },
    { id: 'w_token', name: '演武令 ×10', seals: 15, give: { token: 10 }, weekly: 0 },
    { id: 'w_gem', name: '元宝 ×800', seals: 40, give: { gem: 800 }, weekly: 1 },
    { id: 'w_ssr', name: 'SSR 自选券', seals: 90, give: { ssrPick: 1 }, weekly: 1 },
    { id: 'w_title', name: '称号 · 远征名将', seals: 120, give: { title: '远征名将' }, weekly: 0 }
  ]
};

// 回归补给（断签梯度）：lastSeenTs 间隔 ≥48h 触发，7 天窗口至多一次；每日上线玩家结构性拿不到
const RETURN_GRANTS = [
  { minDays: 2, reward: { scroll: 3, gem: 300 }, label: '招募令 ×3 · 元宝 ×300' },
  { minDays: 4, reward: { scroll: 5, gem: 800, shard: 20 }, label: '招募令 ×5 · 元宝 ×800 · 碎片 ×20' },
  { minDays: 7, reward: { ssrPick: 1, gem: 1500 }, label: 'SSR 自选券 ×1 · 元宝 ×1500' },
  // 第 4 档（研讨会十 R1）：30 天未登录大回归——元宝零增（护抽卡锚），铜钱×12h 帽 3 倍+碎片+自选箱
  { minDays: 30, reward: { gold: 1600000, shard: 50, ssrPick: 1 }, label: '铜钱 ×160 万 · 碎片 ×50 · SSR 自选券 ×1' }
];

// 今日目标关（每日首个精锐关胜利）日宝箱：铜钱+三选一随机
const DAILY_ELITE_CHEST = { gold: 20000, pick: [{ scroll: 1 }, { gem: 50 }, { shard: 5 }] };

export {
  FACTIONS, BEATS, FACTION_ADV, ENEMY_FACTION_AURA, CLASSES, RARITIES,
  MAX_LEVEL, PLAYER_LEVEL, BATTLE_XP, AUTO_BATTLE, FOOD_VALUE, DUPE_GOLD,
  goldCost, expCost, idleRates, IDLE_CAP_HOURS, GEM_IDLE, ARMORY_IRON_PER_HOUR,
  FAST_AD, FAST_PAID,
  GACHA, factionBonus, FORMATION_ROWS, BATTLE, ARENA, DEFEAT_RX, REPLAYS, DRILL, SEVEN_DAY, FOURTEEN_DAY, DUNGEON, WEEKBOSS, BORROW, SWEEP, REPLAY_ACHV, TUTORIAL_OFF, TUTORIALS, TRAINING_DAILY_CAP, BOUNTY, ROAMER_POOL, AD,
  FIRST_STAGE_END, CAMPAIGN_DIFFICULTY, CAMPAIGN_MILESTONES, ELITE_STAGE, STAR_RULES, CHAPTER_STAR_CHESTS, DAILY_ELITE_CHEST, DAILY_BOSS_CHEST, DAILY_AGENDA, QUAD_TOWER,
  CAMPAIGN_MODS, BOSS_MODS, RETURN_GRANTS, SUMMON_TICKET, SUMMON_POINTS, FORGE, MOTIFS, MOTIF_COST, SMELT,
  CODEX_REWARDS, ACHV_AXES, ACHV_REWARDS, WEEKLY, HALL, AWAKEN, FORMATION_PRESETS_MAX, TACTIC, BATTLE_TACTICS, TACTIC_SR, HALL_ACHV, TACTIC_ACHV, AWAKEN_ACHV, DRILL_ACHV, CHAOS_ACHV, CHAOS_MILESTONES, AFFIX_SETS, EXPEDITION_MUTATORS, EXPEDITION_BOONS
};
