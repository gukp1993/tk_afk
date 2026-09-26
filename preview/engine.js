window.__mods = {};
function _def(name, fn){ const m = {exports:{}}; fn(m, m.exports); window.__mods[name] = m.exports; }
function _req(name){ return window.__mods[name]; }
_def('config', function(module, exports){
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
  1: { key: 1, name: 'R', color: '#9db8d8', maxStar: 3, mult: 0.85 },
  2: { key: 2, name: 'SR', color: '#c99af0', maxStar: 4, mult: 1.0 },
  3: { key: 3, name: 'SSR', color: '#f0b95e', maxStar: 5, mult: 1.18 }
};

// 每星属性倍率与等级上限
const STAR_MULT = 1 + 0.12; // per star
const LEVEL_CAPS = [60, 80, 100, 130, 160, 200]; // index = star
const MAX_LEVEL = 200;

// 升阶消耗：同名卡 + 同阵营兵魂点(R=1/SR=2/SSR=4) + 铜钱
const ASCEND_COST = [
  { same: 1, food: 0,  gold: 2000 },
  { same: 1, food: 6,  gold: 8000 },
  { same: 2, food: 12, gold: 25000 },
  { same: 2, food: 20, gold: 70000 },
  { same: 3, food: 30, gold: 160000 }
];
const FOOD_VALUE = { 1: 1, 2: 2, 3: 4 };

// 等级消耗
function goldCost(lv) { return Math.floor(90 * Math.pow(lv, 1.35)); }
function expCost(lv) { return Math.floor(70 * Math.pow(lv, 1.35)); }

// 挂机收益（按已通关最高关卡）
function idleRates(cleared) {
  return {
    gold: Math.floor(1800 + 260 * cleared),
    exp: Math.floor(1200 + 170 * cleared),
    scrollPerHour: 0.25
  };
}
const IDLE_CAP_HOURS = 12;
const FAST_REWARD_HOURS = 2;
const FAST_REWARD_COST = 50;
const FAST_REWARD_DAILY = 6;

// 招募
const GACHA = {
  costScroll: 1,
  costTenGold: 2880,
  singleGold: 300,
  rates: { ssr: 0.025, sr: 0.12 },
  hardPity: 60,     // 累计 60 抽必出 SSR
  wishMax: 30,      // 心愿值满 30 必出 SSR（十连池）
  firstTenSSR: true // 首个十连必出 SSR
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

module.exports = {
  FACTIONS, BEATS, FACTION_ADV, CLASSES, RARITIES,
  LEVEL_CAPS, MAX_LEVEL, ASCEND_COST, FOOD_VALUE,
  goldCost, expCost, idleRates, IDLE_CAP_HOURS,
  FAST_REWARD_HOURS, FAST_REWARD_COST, FAST_REWARD_DAILY,
  GACHA, factionBonus, FORMATION_ROWS, BATTLE, ARENA
};

});

_def('fmt', function(module, exports){
// 数字与文案格式化
function fmtNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return '' + n;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  return pad2(m) + ':' + pad2(s);
}
function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
function cnNum(n) {
  if (n <= 20) return NUM_CN[n - 1] || '' + n;
  return '' + n;
}
module.exports = { fmtNum, fmtDur, todayStr, cnNum, pad2 };

});

_def('rng', function(module, exports){
// 可播种随机数（mulberry32），保证战斗可复现
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const f = mulberry32(seed || 1);
  return {
    next: f,
    int(min, max) { return min + Math.floor(f() * (max - min + 1)); },
    range(min, max) { return min + f() * (max - min); },
    chance(p) { return f() < p; },
    pick(arr) { return arr[Math.floor(f() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };
}
module.exports = { makeRng, mulberry32 };

});

_def('heroes', function(module, exports){
// 武将图鉴（三国背景，原创设计）
// 效果指令 schema：
//  dmg:    { t:'dmg', tgt, mult, hits?, ls?, execute? }  tgt: single|allEnemies|frontRow|backRow|rand2|rand3|randEach|lowestEnemy|strongestEnemy
//  heal:   { t:'heal', tgt, mult }   tgt: self|allAllies|lowestAlly
//  hot:    { t:'hot', tgt, mult, dur }
//  shield: { t:'shield', tgt, mult } tgt: self|allAllies|lowestAlly
//  buff:   { t:'buff', stat, pct, dur, tgt }  stat: atk|def|spd|crit  tgt: self|allAllies
//  debuff: { t:'debuff', stat, pct, dur, tgt } tgt: single|frontRow|allEnemies
//  cc:     { t:'cc', kind, dur, tgt }  kind: stun|freeze|silence
//  dot:    { t:'dot', kind, mult, dur, tgt }  kind: burn|poison|bleed
//  energy: { t:'energy', tgt:'allAllies', amt }
const CLASSES = _req('config').CLASSES;

// 职业基础成长（每级）
const GROWTH = {
  warrior: { hp: 0.062, atk: 0.058, def: 0.052 },
  tank:    { hp: 0.070, atk: 0.050, def: 0.058 },
  mage:    { hp: 0.056, atk: 0.062, def: 0.048 },
  archer:  { hp: 0.054, atk: 0.064, def: 0.046 },
  support: { hp: 0.058, atk: 0.052, def: 0.050 }
};

const HEROES = [
  // ================= 魏 =================
  {
    id: 'caocao', name: '曹操', title: '乱世奸雄', faction: 'wei', cls: 'mage', rarity: 3,
    quote: '宁教我负天下人，休教天下人负我。',
    base: { hp: 2200, atk: 320, def: 112, spd: 0.95, crit: 0.08 },
    ult: { name: '乱世号令', desc: '号令三军，对全体敌军造成170%攻击伤害，并令我方全体攻击提升15%，持续10秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.7 },
      { t: 'buff', stat: 'atk', pct: 0.15, dur: 10, tgt: 'allAllies' }
    ]},
    passive: { name: '奸雄之略', desc: '我方全体攻击+8%，自身暴击率+10%。', mods: { auraAtk: 0.08, crit: 0.10 } }
  },
  {
    id: 'simayi', name: '司马懿', title: '冢虎', faction: 'wei', cls: 'mage', rarity: 3,
    quote: '善败者不亡。',
    base: { hp: 2350, atk: 305, def: 118, spd: 0.9, crit: 0.05 },
    ult: { name: '鹰视狼顾', desc: '对全体敌军造成160%攻击伤害，并冰冻其中随机2人2秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.6 },
      { t: 'cc', kind: 'freeze', dur: 2, tgt: 'rand2' }
    ]},
    passive: { name: '忍略', desc: '自身攻击+12%，受到伤害降低8%。', mods: { atk: 0.12, dmgReduce: 0.08 } }
  },
  {
    id: 'zhangliao', name: '张辽', title: '前将军', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '威震逍遥津。',
    base: { hp: 2900, atk: 232, def: 158, spd: 1.05, crit: 0.08 },
    ult: { name: '突袭斩', desc: '对单体造成260%攻击伤害，若目标生命低于35%，伤害提升至1.8倍。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.6, execute: 0.35 }
    ]},
    passive: { name: '威震逍遥', desc: '自身攻击+10%，击杀敌人后额外获得20点怒气。', mods: { atk: 0.10, rageOnKill: 20 } }
  },
  {
    id: 'xuchu', name: '许褚', title: '虎痴', faction: 'wei', cls: 'tank', rarity: 2,
    quote: '虎侯在此！',
    base: { hp: 4300, atk: 150, def: 262, spd: 0.85, crit: 0.05 },
    ult: { name: '裸衣奋战', desc: '为自己生成相当于攻击180%的护盾，并削弱敌方前排防御20%，持续8秒。', effects: [
      { t: 'shield', tgt: 'self', mult: 1.8 },
      { t: 'debuff', stat: 'def', pct: 0.2, dur: 8, tgt: 'frontRow' }
    ]},
    passive: { name: '虎侯', desc: '自身生命+15%，反弹12%所受伤害。', mods: { hp: 0.15, thorns: 0.12 } }
  },
  {
    id: 'guojia', name: '郭嘉', title: '鬼才', faction: 'wei', cls: 'mage', rarity: 2,
    quote: '兵贵神速。',
    base: { hp: 2280, atk: 288, def: 108, spd: 0.95, crit: 0.1 },
    ult: { name: '遗计定辽', desc: '对随机2名敌军各造成200%攻击伤害，并使其中毒，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 2.0 },
      { t: 'dot', kind: 'poison', mult: 0.35, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '奇佐', desc: '自身暴击率+12%，暴击伤害+30%。', mods: { crit: 0.12, critDmg: 0.3 } }
  },
  {
    id: 'xiahouddun', name: '夏侯惇', title: '独目苍狼', faction: 'wei', cls: 'warrior', rarity: 1,
    quote: '父精母血，不可弃也！',
    base: { hp: 2760, atk: 208, def: 150, spd: 1.0, crit: 0.05 },
    ult: { name: '拔矢啖睛', desc: '对单体造成220%攻击伤害并附加流血，持续5秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.2 },
      { t: 'dot', kind: 'bleed', mult: 0.3, dur: 5, tgt: 'single' }
    ]},
    passive: { name: '刚烈', desc: '自身攻击+8%，生命+8%。', mods: { atk: 0.08, hp: 0.08 } }
  },
  {
    id: 'zhenji', name: '甄姬', title: '洛神', faction: 'wei', cls: 'support', rarity: 1,
    quote: '翩若惊鸿，婉若游龙。',
    base: { hp: 2500, atk: 196, def: 122, spd: 1.0, crit: 0.05 },
    ult: { name: '洛水清波', desc: '治疗全体友军，回复量相当于攻击的160%。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.6 }
    ]},
    passive: { name: '惠心', desc: '自身治疗效果+12%，生命+8%。', mods: { heal: 0.12, hp: 0.08 } }
  },
  // ================= 蜀 =================
  {
    id: 'liubei', name: '刘备', title: '昭烈帝', faction: 'shu', cls: 'support', rarity: 2,
    quote: '惟贤惟德，能服于人。',
    base: { hp: 2680, atk: 210, def: 128, spd: 1.0, crit: 0.05 },
    ult: { name: '仁德布世', desc: '治疗全体友军（攻击的150%），并令我方全体攻击+12%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.5 },
      { t: 'buff', stat: 'atk', pct: 0.12, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '汉室正统', desc: '我方全体防御+8%。', mods: { auraDef: 0.08 } }
  },
  {
    id: 'guanyu', name: '关羽', title: '武圣', faction: 'shu', cls: 'warrior', rarity: 3,
    quote: '青龙偃月，忠义千秋。',
    base: { hp: 3050, atk: 250, def: 172, spd: 1.05, crit: 0.08 },
    ult: { name: '青龙偃月斩', desc: '对敌方前排造成250%攻击伤害，并使其流血，持续6秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.5 },
      { t: 'dot', kind: 'bleed', mult: 0.4, dur: 6, tgt: 'frontRow' }
    ]},
    passive: { name: '武圣威严', desc: '自身攻击+15%，生命+10%。', mods: { atk: 0.15, hp: 0.10 } }
  },
  {
    id: 'zhaoyun', name: '赵云', title: '常山赵子龙', faction: 'shu', cls: 'warrior', rarity: 3,
    quote: '七进七出，浑身是胆！',
    base: { hp: 2950, atk: 246, def: 165, spd: 1.1, crit: 0.12 },
    ult: { name: '七进七出', desc: '对随机敌人连续突刺4次，每段造成85%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'randEach', mult: 0.85, hits: 4 }
    ]},
    passive: { name: '龙胆', desc: '自身暴击+15%，且每场战斗可免疫一次致命伤害（保留1点生命）。', mods: { crit: 0.15, cheatDeath: 1 } }
  },
  {
    id: 'zhugeliang', name: '诸葛亮', title: '卧龙', faction: 'shu', cls: 'mage', rarity: 3,
    quote: '淡泊明志，宁静致远。',
    base: { hp: 2250, atk: 318, def: 110, spd: 0.95, crit: 0.06 },
    ult: { name: '八阵图', desc: '对全体敌军造成180%攻击伤害并附加灼烧，持续8秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.8 },
      { t: 'dot', kind: 'burn', mult: 0.35, dur: 8, tgt: 'allEnemies' }
    ]},
    passive: { name: '神机', desc: '我方全体攻击+6%，自身怒气获取提升20%。', mods: { auraAtk: 0.06, energyGain: 0.2 } }
  },
  {
    id: 'zhangfei', name: '张飞', title: '万人敌', faction: 'shu', cls: 'tank', rarity: 2,
    quote: '燕人张飞在此！',
    base: { hp: 4450, atk: 148, def: 270, spd: 0.85, crit: 0.05 },
    ult: { name: '燕人咆哮', desc: '对敌方前排造成200%攻击伤害并眩晕3秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.0 },
      { t: 'cc', kind: 'stun', dur: 3, tgt: 'frontRow' }
    ]},
    passive: { name: '据水断桥', desc: '自身生命+18%，受到伤害降低8%。', mods: { hp: 0.18, dmgReduce: 0.08 } }
  },
  {
    id: 'huangzhong', name: '黄忠', title: '老当益壮', faction: 'shu', cls: 'archer', rarity: 2,
    quote: '宝刀未老！',
    base: { hp: 2260, atk: 302, def: 102, spd: 1.15, crit: 0.15 },
    ult: { name: '百步穿杨', desc: '对生命最低的敌军造成300%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'lowestEnemy', mult: 3.0 }
    ]},
    passive: { name: '烈弓', desc: '自身暴击率+10%，暴击伤害+40%。', mods: { crit: 0.10, critDmg: 0.4 } }
  },
  {
    id: 'machao', name: '马超', title: '锦马超', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '西凉铁骑，踏破山川！',
    base: { hp: 2850, atk: 238, def: 156, spd: 1.12, crit: 0.08 },
    ult: { name: '铁骑冲锋', desc: '冲锋陷阵，对随机3名敌军各造成150%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand3', mult: 1.5 }
    ]},
    passive: { name: '西凉铁骑', desc: '自身攻速+10%，攻击+8%。', mods: { spd: 0.10, atk: 0.08 } }
  },
  {
    id: 'liaohua', name: '廖化', title: '蜀中先锋', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '蜀中无大将，廖化作先锋。',
    base: { hp: 2650, atk: 200, def: 145, spd: 1.0, crit: 0.05 },
    ult: { name: '先锋突刺', desc: '对单体造成200%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.0 }
    ]},
    passive: { name: '老练', desc: '自身生命+10%。', mods: { hp: 0.10 } }
  },
  // ================= 吴 =================
  {
    id: 'zhouyu', name: '周瑜', title: '美周郎', faction: 'wu', cls: 'mage', rarity: 3,
    quote: '谈笑间，樯橹灰飞烟灭。',
    base: { hp: 2220, atk: 325, def: 108, spd: 0.95, crit: 0.12 },
    ult: { name: '赤壁炎劫', desc: '对全体敌军造成200%攻击伤害并附加灼烧，持续6秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 2.0 },
      { t: 'dot', kind: 'burn', mult: 0.4, dur: 6, tgt: 'allEnemies' }
    ]},
    passive: { name: '儒将风流', desc: '自身暴击率+12%，攻击+8%。', mods: { crit: 0.12, atk: 0.08 } }
  },
  {
    id: 'sunshangxiang', name: '孙尚香', title: '弓腰姬', faction: 'wu', cls: 'archer', rarity: 3,
    quote: '巾帼不让须眉。',
    base: { hp: 2300, atk: 308, def: 104, spd: 1.18, crit: 0.1 },
    ult: { name: '枭姬连弩', desc: '对生命值最高的敌军连射3箭，每箭造成110%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'strongestEnemy', mult: 1.1, hits: 3 }
    ]},
    passive: { name: '枭姬', desc: '自身攻击+12%，攻速+8%。', mods: { atk: 0.12, spd: 0.08 } }
  },
  {
    id: 'luxun', name: '陆逊', title: '儒生雄才', faction: 'wu', cls: 'mage', rarity: 2,
    quote: '书生亦可拜将。',
    base: { hp: 2320, atk: 292, def: 112, spd: 0.95, crit: 0.06 },
    ult: { name: '火烧连营', desc: '对敌方后排造成230%攻击伤害并附加灼烧，持续6秒。', effects: [
      { t: 'dmg', tgt: 'backRow', mult: 2.3 },
      { t: 'dot', kind: 'burn', mult: 0.35, dur: 6, tgt: 'backRow' }
    ]},
    passive: { name: '沉稳', desc: '自身受到伤害降低10%。', mods: { dmgReduce: 0.10 } }
  },
  {
    id: 'ganning', name: '甘宁', title: '锦帆贼', faction: 'wu', cls: 'warrior', rarity: 2,
    quote: '百骑劫魏营。',
    base: { hp: 2880, atk: 236, def: 152, spd: 1.1, crit: 0.1 },
    ult: { name: '锦帆奇袭', desc: '对随机2名敌军各造成180%攻击伤害并使其流血，持续5秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.8 },
      { t: 'dot', kind: 'bleed', mult: 0.3, dur: 5, tgt: 'rand2' }
    ]},
    passive: { name: '游侠', desc: '自身攻速+12%，并带有8%吸血。', mods: { spd: 0.12, vamp: 0.08 } }
  },
  {
    id: 'daqiao', name: '大乔', title: '国色', faction: 'wu', cls: 'support', rarity: 1,
    quote: '曲有误，周郎顾。',
    base: { hp: 2520, atk: 198, def: 120, spd: 1.0, crit: 0.05 },
    ult: { name: '江东安抚', desc: '治疗生命最低的友军（攻击的240%），并为其附加攻击120%的护盾。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 2.4 },
      { t: 'shield', tgt: 'lowestAlly', mult: 1.2 }
    ]},
    passive: { name: '温婉', desc: '自身治疗效果+10%，生命+10%。', mods: { heal: 0.10, hp: 0.10 } }
  },
  {
    id: 'taishici', name: '太史慈', title: '信义笃烈', faction: 'wu', cls: 'archer', rarity: 1,
    quote: '大丈夫当带三尺剑，立不世之功！',
    base: { hp: 2240, atk: 296, def: 100, spd: 1.15, crit: 0.08 },
    ult: { name: '酣斗', desc: '对单体造成240%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.4 }
    ]},
    passive: { name: '神射', desc: '自身暴击率+8%。', mods: { crit: 0.08 } }
  },
  {
    id: 'lvmeng', name: '吕蒙', title: '白衣渡江', faction: 'wu', cls: 'warrior', rarity: 1,
    quote: '士别三日，当刮目相看。',
    base: { hp: 2700, atk: 204, def: 148, spd: 1.0, crit: 0.05 },
    ult: { name: '白衣奇袭', desc: '对敌方后排造成180%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'backRow', mult: 1.8 }
    ]},
    passive: { name: '刮目相看', desc: '自身攻击+10%。', mods: { atk: 0.10 } }
  },
  // ================= 群 =================
  {
    id: 'lvbu', name: '吕布', title: '飞将', faction: 'qun', cls: 'warrior', rarity: 3,
    quote: '人中吕布，马中赤兔！',
    base: { hp: 3200, atk: 268, def: 175, spd: 1.08, crit: 0.1 },
    ult: { name: '方天画戟', desc: '对单体造成320%攻击伤害并眩晕2秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 3.2 },
      { t: 'cc', kind: 'stun', dur: 2, tgt: 'single' }
    ]},
    passive: { name: '无双', desc: '自身攻击+18%，并带有10%吸血。', mods: { atk: 0.18, vamp: 0.10 } }
  },
  {
    id: 'diaochan', name: '貂蝉', title: '闭月', faction: 'qun', cls: 'support', rarity: 3,
    quote: '一舞倾城，再舞倾国。',
    base: { hp: 2450, atk: 226, def: 118, spd: 1.02, crit: 0.05 },
    ult: { name: '倾国倾城', desc: '对全体敌军造成140%攻击伤害，并削弱其攻击20%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.4 },
      { t: 'debuff', stat: 'atk', pct: 0.2, dur: 8, tgt: 'allEnemies' }
    ]},
    passive: { name: '惊鸿舞', desc: '我方全体攻速+6%，自身生命+8%。', mods: { auraSpd: 0.06, hp: 0.08 } }
  },
  {
    id: 'huatuo', name: '华佗', title: '神医', faction: 'qun', cls: 'support', rarity: 2,
    quote: '对症下药，药到病除。',
    base: { hp: 2580, atk: 214, def: 126, spd: 1.0, crit: 0.05 },
    ult: { name: '青囊济世', desc: '治疗全体友军（攻击的190%），并附加持续回复，每秒回复攻击的30%，持续5秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.9 },
      { t: 'hot', tgt: 'allAllies', mult: 0.3, dur: 5 }
    ]},
    passive: { name: '妙手回春', desc: '自身治疗效果+15%。', mods: { heal: 0.15 } }
  },
  {
    id: 'dongzhuo', name: '董卓', title: '魔王', faction: 'qun', cls: 'tank', rarity: 2,
    quote: '吾为天下计，岂惜小民哉！',
    base: { hp: 4550, atk: 145, def: 258, spd: 0.82, crit: 0.05 },
    ult: { name: '酒池烈焰', desc: '为自己生成攻击220%的护盾，并对敌方前排造成120%攻击伤害。', effects: [
      { t: 'shield', tgt: 'self', mult: 2.2 },
      { t: 'dmg', tgt: 'frontRow', mult: 1.2 }
    ]},
    passive: { name: '暴虐', desc: '自身生命+20%，反弹10%所受伤害。', mods: { hp: 0.20, thorns: 0.10 } }
  },
  {
    id: 'zhangjiao', name: '张角', title: '大贤良师', faction: 'qun', cls: 'mage', rarity: 1,
    quote: '苍天已死，黄天当立！',
    base: { hp: 2180, atk: 262, def: 102, spd: 0.92, crit: 0.05 },
    ult: { name: '黄天符咒', desc: '对随机2名敌军各造成160%攻击伤害并使其中毒，持续5秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.6 },
      { t: 'dot', kind: 'poison', mult: 0.3, dur: 5, tgt: 'rand2' }
    ]},
    passive: { name: '符水济人', desc: '自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'huaxiong', name: '华雄', title: '都督骁将', faction: 'qun', cls: 'warrior', rarity: 1,
    quote: '斩将搴旗，威震虎牢。',
    base: { hp: 2720, atk: 206, def: 150, spd: 1.0, crit: 0.05 },
    ult: { name: '悍勇斩', desc: '对单体造成210%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.1 }
    ]},
    passive: { name: '骁勇', desc: '自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'yanliang', name: '颜良', title: '河北名将', faction: 'qun', cls: 'warrior', rarity: 1,
    quote: '吾有万夫不当之勇！',
    base: { hp: 2780, atk: 202, def: 152, spd: 0.98, crit: 0.05 },
    ult: { name: '雷霆一刀', desc: '对单体造成215%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.15 }
    ]},
    passive: { name: '河北骁勇', desc: '自身生命+10%。', mods: { hp: 0.10 } }
  }
];

const HERO_MAP = {};
HEROES.forEach(h => { HERO_MAP[h.id] = h; });
function getHero(id) { return HERO_MAP[id]; }
function heroName(id) { return HERO_MAP[id] ? HERO_MAP[id].name : id; }

// 某等级下的裸属性（不含装备/升阶）
function heroStats(h, lv) {
  const g = GROWTH[h.cls];
  const m = 1 + g.hp * (lv - 1), a = 1 + g.atk * (lv - 1), d = 1 + g.def * (lv - 1);
  return {
    hp: Math.floor(h.base.hp * m),
    atk: Math.floor(h.base.atk * a),
    def: Math.floor(h.base.def * d),
    spd: h.base.spd,
    crit: h.base.crit || 0.05
  };
}
// 含升阶倍率
function heroStatsStar(h, lv, star) {
  const s = heroStats(h, lv);
  const m = 1 + 0.12 * star;
  return { hp: Math.floor(s.hp * m), atk: Math.floor(s.atk * m), def: Math.floor(s.def * m), spd: s.spd, crit: s.crit };
}
// 战力估算
function heroPower(h, lv, star) {
  const s = heroStatsStar(h, lv, star);
  return Math.floor((s.hp / 6 + s.atk * 2.2 + s.def * 1.5) * (1 + 0.05 * star));
}
module.exports = { HEROES, GROWTH, getHero, heroName, heroStats, heroStatsStar, heroPower };

});

_def('stages', function(module, exports){
// 战役章节与群英塔（敌方阵容生成）
const { getHero } = _req('heroes');

// 12 章战役，每章 10 关（第 10 关为名将首领关），之后进入循环乱世
const CHAPTERS = [
  { name: '黄巾之乱', theme: 'qun', boss: 'zhangjiao', foes: ['huaxiong', 'yanliang', 'liaohua', 'zhangjiao', 'huatuo'] },
  { name: '虎牢关', theme: 'qun', boss: 'lvbu', foes: ['huaxiong', 'yanliang', 'dongzhuo', 'zhangjiao', 'zhenji'] },
  { name: '群雄割据', theme: 'qun', boss: 'dongzhuo', foes: ['yanliang', 'huaxiong', 'xiahouddun', 'daqiao', 'zhangjiao'] },
  { name: '官渡之战', theme: 'wei', boss: 'simayi', foes: ['xiahouddun', 'zhangliao', 'xuchu', 'guojia', 'zhenji'] },
  { name: '三顾茅庐', theme: 'shu', boss: 'zhugeliang', foes: ['liaohua', 'machao', 'huangzhong', 'liubei', 'zhaoyun'] },
  { name: '赤壁之战', theme: 'wu', boss: 'zhouyu', foes: ['lvmeng', 'ganning', 'taishici', 'luxun', 'daqiao'] },
  { name: '南征北战', theme: 'shu', boss: 'machao', foes: ['liaohua', 'zhangfei', 'huangzhong', 'zhaoyun', 'liubei'] },
  { name: '汉中之战', theme: 'shu', boss: 'huangzhong', foes: ['machao', 'zhaoyun', 'zhangfei', 'zhugeliang', 'liaohua'] },
  { name: '荆州风云', theme: 'wu', boss: 'sunshangxiang', foes: ['lvmeng', 'ganning', 'luxun', 'daqiao', 'taishici'] },
  { name: '五丈原', theme: 'shu', boss: 'simayi', foes: ['zhangliao', 'xuchu', 'guojia', 'caocao', 'zhenji'] },
  { name: '北伐中原', theme: 'wei', boss: 'caocao', foes: ['simayi', 'zhangliao', 'xuchu', 'guojia', 'zhenji'] },
  { name: '天下归一', theme: 'wei', boss: 'lvbu', foes: ['lvbu', 'simayi', 'caocao', 'zhouyu', 'zhugeliang'] }
];
const STAGES_PER_CH = 10;

// 敌方强度：全局关卡序号（从 1 开始）
function stageScale(globalStage) {
  return Math.pow(1.05, globalStage - 1);
}
function chapterOf(globalStage) {
  const idx = Math.floor((globalStage - 1) / STAGES_PER_CH); // 0-based
  const inCh = (globalStage - 1) % STAGES_PER_CH;
  const ch = idx < CHAPTERS.length ? CHAPTERS[idx] : CHAPTERS[CHAPTERS.length - 1];
  const loop = idx >= CHAPTERS.length ? idx - CHAPTERS.length + 1 : 0;
  const name = idx < CHAPTERS.length
    ? '第' + _req('fmt').cnNum(idx + 1) + '章 · ' + ch.name
    : '乱世纷争 · ' + _req('fmt').cnNum(loop + 1);
  return { ch, idx, inCh, name, isBoss: inCh === STAGES_PER_CH - 1 };
}

// 生成敌方阵容（5 人，slot 0-2 前排，3-4 后排）
function makeStageEnemies(globalStage) {
  const { ch, inCh, name, isBoss } = chapterOf(globalStage);
  const scale = stageScale(globalStage) * (isBoss ? 1.25 : 1);
  const lv = Math.max(1, Math.round(1 + (globalStage - 1) * 1.6));
  const pick = (i) => {
    let hid;
    if (isBoss && i === 0) hid = ch.boss;
    else hid = ch.foes[(inCh + i) % ch.foes.length];
    return hid;
  };
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = getHero(pick(i));
    units.push({
      hero: h,
      level: lv,
      star: Math.min(2, Math.floor((globalStage - 1) / 40)),
      scale: i === 0 && isBoss ? scale : scale * 0.92,
      isBoss: i === 0 && isBoss,
      row: i <= 2 ? 0 : 1
    });
  }
  return { name: name + (isBoss ? ' · 名将' : ' · 第' + (inCh + 1) + '关'), units, isBoss };
}

// 群英塔：无限层，随机阵营混合，每 5 层一名将
function makeTowerEnemies(floor) {
  const heroes = _req('heroes').HEROES;
  const rng = _req('rng').makeRng(9000 + floor * 131);
  const pool = rng.shuffle(heroes.map(h => h.id));
  const scale = Math.pow(1.075, floor - 1);
  const lv = Math.max(1, Math.round(2 + (floor - 1) * 1.8));
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = _req('heroes').getHero(pool[i]);
    const isBoss = floor % 5 === 0 && i === 0;
    units.push({
      hero: h, level: lv, star: Math.min(3, Math.floor(floor / 25)),
      scale: (isBoss ? scale * 1.2 : scale * 0.9), isBoss, row: i <= 2 ? 0 : 1
    });
  }
  return { name: '群英塔 · 第' + floor + '层', units, isBoss: floor % 5 === 0 };
}

// 演武场对手：按玩家战力缩放
function makeArenaEnemies(playerPower, seed, diff) {
  const heroes = _req('heroes').HEROES;
  const rng = _req('rng').makeRng(seed);
  const pool = rng.shuffle(heroes.map(h => h.id)).slice(0, 5);
  // 由目标战力反推等级
  const targetPower = playerPower * diff;
  const lv = Math.max(1, Math.round(Math.pow(targetPower / 2600, 1 / 1.35)));
  const units = pool.map((hid, i) => {
    const h = _req('heroes').getHero(hid);
    return { hero: h, level: lv, star: Math.min(2, Math.floor(lv / 60)), scale: 1, isBoss: false, row: i <= 2 ? 0 : 1 };
  });
  return { name: '演武场 · 对阵', units, isBoss: false };
}

module.exports = { CHAPTERS, STAGES_PER_CH, stageScale, chapterOf, makeStageEnemies, makeTowerEnemies, makeArenaEnemies };

});

_def('items', function(module, exports){
// 装备、商店、每日任务定义
// 装备槽：weapon 兵刃(atk) armor 铠甲(hp) helm 头盔(def) boots 战靴(hp+atk小)
const EQUIP_SLOTS = {
  weapon: { key: 'weapon', name: '兵刃', icon: '⚔', stat: 'atk' },
  armor:  { key: 'armor',  name: '铠甲', icon: '🛡', stat: 'hp' },
  helm:   { key: 'helm',   name: '头盔', icon: '⛑', stat: 'def' },
  boots:  { key: 'boots',  name: '战靴', icon: '👟', stat: 'hp2' }
};
const EQUIP_TIERS = [
  { t: 1, name: '凡铁', color: '#9aa4ad', base: { atk: 18, hp: 120, def: 10 } },
  { t: 2, name: '精铜', color: '#6cc79a', base: { atk: 42, hp: 300, def: 24 } },
  { t: 3, name: '百炼', color: '#7fb0e8', base: { atk: 96, hp: 720, def: 56 } },
  { t: 4, name: '陨铁', color: '#c99af0', base: { atk: 220, hp: 1700, def: 130 } },
  { t: 5, name: '天工', color: '#f0b95e', base: { atk: 500, hp: 4000, def: 300 } },
  { t: 6, name: '神兵', color: '#f06a5a', base: { atk: 1150, hp: 9400, def: 690 } }
];
const MAX_ENH = 12;
function equipStat(tier, slot, enh) {
  const b = EQUIP_TIERS[tier - 1].base;
  const m = 1 + 0.08 * (enh || 0);
  if (slot === 'weapon') return { atk: Math.floor(b.atk * m) };
  if (slot === 'armor') return { hp: Math.floor(b.hp * m) };
  if (slot === 'helm') return { def: Math.floor(b.def * m) };
  return { hp: Math.floor(b.hp * 0.6 * m), atk: Math.floor(b.atk * 0.4 * m) };
}
function enhanceCost(tier, enh) {
  return Math.floor(600 * Math.pow(tier, 1.6) * Math.pow(1.35, enh));
}
// 关卡掉落装备品阶概率（随进度提升）
function dropTier(globalStage) {
  const r = Math.random();
  const adv = Math.min(0.5, globalStage * 0.006); // 高关卡向高阶偏移
  if (r < 0.05 + adv * 0.10) return 6;
  if (r < 0.16 + adv * 0.18) return 5;
  if (r < 0.34 + adv * 0.24) return 4;
  if (r < 0.60 + adv * 0.22) return 3;
  if (r < 0.85) return 2;
  return 1;
}
const DROP_SLOTS = ['weapon', 'armor', 'helm', 'boots'];

// ---- 商铺（每日刷新） ----
// cur: gold 铜钱 / gem 元宝 / scroll 招募卷 / token 演武令 / shard 英雄碎片
const SHOP_GOODS = [
  { id: 's_scroll1', name: '招募令 ×1', cur: 'gem', price: 300, give: { scroll: 1 }, limit: 3 },
  { id: 's_scroll5', name: '招募令 ×5', cur: 'gem', price: 1350, give: { scroll: 5 }, limit: 1 },
  { id: 's_gold', name: '铜钱 ×20万', cur: 'gem', price: 80, give: { gold: 200000 }, limit: 3 },
  { id: 's_exp', name: '兵书 ×15万', cur: 'gem', price: 80, give: { exp: 150000 }, limit: 3 },
  { id: 't_scroll', name: '招募令 ×1', cur: 'token', price: 40, give: { scroll: 1 }, limit: 5 },
  { id: 't_sr', name: 'SR 自选卡', cur: 'token', price: 300, give: { srPick: 1 }, limit: 1 },
  { id: 'h_ssr', name: 'SSR 自选卡', cur: 'shard', price: 500, give: { ssrPick: 1 }, limit: 1 },
  { id: 'h_sr', name: 'SR 自选卡', cur: 'shard', price: 150, give: { srPick: 1 }, limit: 2 }
];

// ---- 每日任务 ----
const QUESTS = [
  { id: 'q_win3', name: '征战胜利 3 次', target: 3, reward: { gem: 20 }, act: 15 },
  { id: 'q_summon1', name: '点将 1 次', target: 1, reward: { gem: 15 }, act: 20 },
  { id: 'q_levelup', name: '升级武将 1 次', target: 1, reward: { gold: 20000 }, act: 15 },
  { id: 'q_idle1', name: '领取挂机收益 1 次', target: 1, reward: { gold: 10000 }, act: 15 },
  { id: 'q_arena1', name: '演武切磋 1 次', target: 1, reward: { gem: 15 }, act: 20 },
  { id: 'q_tower1', name: '群英塔挑战 1 次', target: 1, reward: { exp: 30000 }, act: 15 }
];
const ACTIVE_CHESTS = [
  { need: 40, reward: { gem: 30 } },
  { need: 70, reward: { scroll: 2 } },
  { need: 100, reward: { shard: 30 } }
];

// 演武场积分段位
const ARENA_RANKS = [
  { min: 0, name: '新兵' }, { min: 800, name: '校尉' }, { min: 1000, name: '都尉' },
  { min: 1200, name: '偏将军' }, { min: 1400, name: '裨将军' }, { min: 1600, name: '四征将军' },
  { min: 1800, name: '车骑将军' }, { min: 2000, name: '大将军' }
];
function arenaRank(points) {
  let r = ARENA_RANKS[0];
  for (const x of ARENA_RANKS) if (points >= x.min) r = x;
  return r.name;
}

module.exports = {
  EQUIP_SLOTS, EQUIP_TIERS, MAX_ENH, equipStat, enhanceCost, dropTier, DROP_SLOTS,
  SHOP_GOODS, QUESTS, ACTIVE_CHESTS, ARENA_RANKS, arenaRank
};

});

_def('battle', function(module, exports){
// 回合制实时战斗引擎（tick 模拟，纯 JS 可独立测试）
const { BEATS, FACTION_ADV, factionBonus, BATTLE } = _req('config');
const { makeRng } = _req('rng');

// unit spec: { uid, heroId, name, faction, cls, level, star, stats:{hp,atk,def,spd,crit}, ult:{name,desc,effects}, passive:{mods...}, row, isBoss }
function createBattle(cfg) {
  const seed = cfg.seed || 1;
  const rng = makeRng(seed);
  const limit = cfg.timeLimit || BATTLE.TIME_LIMIT;
  const stats = {}; // uid -> {dmg, heal}
  const sides = { A: buildSide(cfg.team, 'A'), B: buildSide(cfg.enemy, 'B') };
  let time = 0;
  let ended = false;
  let winner = null;

  function buildSide(list, tag) {
    const units = list.map((u, i) => ({
      uid: u.uid || (tag + i),
      side: tag, slot: i, row: u.row !== undefined ? u.row : (i <= 2 ? 0 : 1),
      name: u.name, heroId: u.heroId, faction: u.faction, cls: u.cls, level: u.level,
      isBoss: !!u.isBoss,
      base: Object.assign({}, u.stats),
      ult: u.ult || { name: '奋击', effects: [{ t: 'dmg', tgt: 'single', mult: 2 }] },
      passive: u.passive || {},
      // 运行时
      hp: u.stats.hp, maxHp: u.stats.hp, shield: 0, energy: 0,
      alive: true, actTimer: rng.range(0.2, 0.9),
      buffs: [], dots: [], hots: [], cc: null,
      cheat: (u.passive && u.passive.cheatDeath) || 0
    }));
    // 光环 + 阵营加成
    const fcount = {};
    units.forEach(u => { fcount[u.faction] = (fcount[u.faction] || 0) + 1; });
    const fb = factionBonus(Math.max.apply(null, Object.keys(fcount).map(k => fcount[k])));
    let auraAtk = 0, auraDef = 0, auraSpd = 0;
    units.forEach(u => {
      const p = u.passive;
      auraAtk += p.auraAtk || 0; auraDef += p.auraDef || 0; auraSpd += p.auraSpd || 0;
    });
    units.forEach(u => {
      u.auraAtk = auraAtk + fb.atk;
      u.auraDef = auraDef;
      u.auraSpd = auraSpd;
      u.fbHp = fb.hp;
      u.maxHp = Math.floor(u.maxHp * (1 + fb.hp));
      u.hp = u.maxHp;
      u.energy = (u.passive.firstEnergy || 0);
      stats[u.uid] = { dmg: 0, heal: 0 };
    });
    return units;
  }

  function aliveOf(side) { return sides[side].filter(u => u.alive); }
  function foesOf(u) { return aliveOf(u.side === 'A' ? 'B' : 'A'); }
  function alliesOf(u) { return aliveOf(u.side); }

  function effStat(u, stat) {
    let pct = u.passive[stat] || 0;
    for (const b of u.buffs) if (b.stat === stat) pct += b.pct;
    let v = u.base[stat] * (1 + pct);
    if (stat === 'atk') v *= (1 + u.auraAtk);
    if (stat === 'def') v *= (1 + u.auraDef);
    if (stat === 'spd') v *= (1 + u.auraSpd);
    return v;
  }
  function critChance(u) {
    let c = (u.base.crit || 0.05) + (u.passive.crit || 0);
    for (const b of u.buffs) if (b.stat === 'crit') c += b.pct;
    return Math.min(0.95, c);
  }

  // ---- 目标选择 ----
  function pickBy(u, pred) {
    const fs = foesOf(u);
    if (!fs.length) return null;
    const sorted = fs.slice().sort((a, b) => (a.slot - b.slot));
    const hit = sorted.find(pred);
    return hit || null;
  }
  function defaultTarget(u) {
    const cls = u.cls;
    if (cls === 'archer') {
      return pickBy(u, x => x.row === 1) || pickBy(u, () => true);
    }
    if (cls === 'mage') {
      const fs = foesOf(u);
      return fs.length ? fs[Math.floor(rng.next() * fs.length)] : null;
    }
    return pickBy(u, x => x.row === 0) || pickBy(u, () => true);
  }
  function lowest(units, key) {
    return units.slice().sort((a, b) => a[key] - b[key])[0] || null;
  }
  function resolveTargets(src, tgt) {
    const foes = foesOf(src);
    const allies = alliesOf(src);
    switch (tgt) {
      case 'self': return [src];
      case 'allEnemies': return foes;
      case 'allAllies': return allies;
      case 'frontRow': return foes.filter(x => x.row === 0);
      case 'backRow': return foes.filter(x => x.row === 1);
      case 'rand2': return rng.shuffle(foes).slice(0, 2);
      case 'rand3': return rng.shuffle(foes).slice(0, 3);
      case 'randEach': return foes.length ? [foes[Math.floor(rng.next() * foes.length)]] : [];
      case 'lowestEnemy': return lowest(foes, 'hp') ? [lowest(foes, 'hp')] : [];
      case 'strongestEnemy': return lowest(foes, 'maxHp') ? [lowest(foes, 'maxHp')] : [];
      case 'lowestAlly': return lowest(allies, 'hp') ? [lowest(allies, 'hp')] : [];
      case 'single': default: { const t = defaultTarget(src); return t ? [t] : []; }
    }
  }

  // ---- 伤害/治疗 ----
  function emit(ev) { events.push(ev); }
  function gainEnergy(u, amt) {
    u.energy = Math.min(BATTLE.ENERGY_MAX, u.energy + amt * (1 + (u.passive.energyGain || 0)));
  }
  function applyDamage(src, tgt, raw, opts) {
    opts = opts || {};
    if (!tgt.alive) return;
    let dmg = raw;
    const K = BATTLE.DEF_K(src.level || 1);
    const defF = K / (K + effStat(tgt, 'def'));
    const fac = BEATS[src.faction] === tgt.faction ? FACTION_ADV : 1;
    let crit = false;
    if (!opts.noCrit) crit = rng.chance(critChance(src));
    const critM = crit ? (BATTLE.CRIT_BASE_DMG + (src.passive.critDmg || 0)) : 1;
    const exec = opts.execute && (tgt.hp / tgt.maxHp < opts.execute) ? 1.8 : 1;
    dmg = dmg * defF * fac * critM * exec * rng.range(0.92, 1.08);
    dmg *= (1 - (src === tgt ? 0 : (tgt.passive.dmgReduce || 0)));
    dmg = Math.max(1, Math.floor(dmg));
    // 护盾吸收
    if (tgt.shield > 0) {
      const absorbed = Math.min(tgt.shield, dmg);
      tgt.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) emit({ e: 'shieldHit', uid: tgt.uid, amount: absorbed });
    }
    if (dmg > 0) {
      tgt.hp -= dmg;
      tgt.hp = Math.max(0, tgt.hp);
      stats[src.uid].dmg += dmg;
      emit({ e: 'hit', uid: tgt.uid, src: src.uid, amount: dmg, crit, kind: opts.kind || 'atk' });
      gainEnergy(tgt, BATTLE.ENERGY_HIT);
      // 吸血
      const ls = (opts.ls || 0) + (src.passive.vamp || 0);
      if (ls > 0 && src.alive) healHp(src, dmg * ls);
      // 反弹
      const th = tgt.passive.thorns || 0;
      if (th > 0 && src.alive && !opts.isReflect) {
        const r = Math.max(1, Math.floor(dmg * th));
        dealRaw(src, r, 'reflect');
      }
    }
    if (tgt.hp <= 0) handleDeath(tgt, src);
  }
  function dealRaw(u, amount, kind) {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - amount);
    emit({ e: 'hit', uid: u.uid, src: null, amount, crit: false, kind });
    if (u.hp <= 0) handleDeath(u, null);
  }
  function healHp(u, amount) {
    if (!u.alive || amount <= 0) return;
    const real = Math.min(u.maxHp - u.hp, Math.floor(amount));
    if (real > 0) {
      u.hp += real;
      stats[u.uid].heal += real;
      emit({ e: 'heal', uid: u.uid, amount: real });
    }
  }
  function handleDeath(u, killer) {
    if (u.cheat > 0) {
      u.cheat--;
      u.hp = 1;
      emit({ e: 'cheat', uid: u.uid });
      return;
    }
    u.alive = false;
    u.buffs = []; u.dots = []; u.hots = []; u.cc = null; u.shield = 0;
    emit({ e: 'death', uid: u.uid });
    if (killer && killer.alive) {
      gainEnergy(killer, BATTLE.ENERGY_KILL);
      const rk = killer.passive.rageOnKill;
      if (rk) gainEnergy(killer, rk);
    }
    checkEnd();
  }

  // ---- 效果执行 ----
  function castUlt(u) {
    u.energy = 0;
    const fx = u.ult.effects || [];
    const scope = fx.some(f => f.tgt === 'allEnemies') ? 'all'
      : fx.some(f => f.tgt === 'frontRow' || f.tgt === 'backRow') ? 'row' : 'single';
    emit({ e: 'ult', uid: u.uid, skill: u.ult.name, scope });
    for (const f of fx) applyEffect(u, f);
  }
  function applyEffect(src, fx) {
    const tgts = resolveTargets(src, fx.tgt);
    switch (fx.t) {
      case 'dmg': {
        const hits = fx.hits || 1;
        for (let i = 0; i < hits; i++) {
          let list = tgts.filter(x => x.alive);
          if (fx.tgt === 'randEach') list = resolveTargets(src, 'randEach');
          if (fx.tgt === 'lowestEnemy') { const t = resolveTargets(src, 'lowestEnemy')[0]; list = t ? [t] : []; }
          if (fx.tgt === 'strongestEnemy') { const t = resolveTargets(src, 'strongestEnemy')[0]; list = t ? [t] : []; }
          if (!list.length) break;
          for (const t of list) {
            if (!t.alive) continue;
            applyDamage(src, t, effStat(src, 'atk') * fx.mult, { ls: fx.ls || 0, execute: fx.execute, kind: 'ult' });
          }
        }
        break;
      }
      case 'heal': {
        for (const t of tgts) healHp(t, effStat(src, 'atk') * fx.mult * (1 + (src.passive.heal || 0)));
        break;
      }
      case 'hot': {
        for (const t of tgts) t.hots.push({ perTick: effStat(src, 'atk') * fx.mult * (1 + (src.passive.heal || 0)), remaining: fx.dur, acc: 0 });
        break;
      }
      case 'shield': {
        for (const t of tgts) {
          t.shield += Math.floor(effStat(src, 'atk') * fx.mult);
          emit({ e: 'shield', uid: t.uid, amount: Math.floor(effStat(src, 'atk') * fx.mult) });
        }
        break;
      }
      case 'buff': {
        for (const t of tgts) addBuff(t, fx.stat, fx.pct, fx.dur);
        break;
      }
      case 'debuff': {
        for (const t of tgts) addBuff(t, fx.stat, -fx.pct, fx.dur);
        break;
      }
      case 'cc': {
        for (const t of tgts) {
          if (!t.alive) continue;
          t.cc = { kind: fx.kind, remaining: fx.dur };
          emit({ e: 'cc', uid: t.uid, kind: fx.kind, dur: fx.dur });
        }
        break;
      }
      case 'dot': {
        for (const t of tgts) {
          if (!t.alive) continue;
          t.dots.push({ kind: fx.kind, perTick: effStat(src, 'atk') * fx.mult, remaining: fx.dur, acc: 0, src: src.uid });
        }
        break;
      }
      case 'energy': {
        for (const t of tgts) gainEnergy(t, fx.amt);
        break;
      }
    }
  }
  function addBuff(u, stat, pct, dur) {
    if (!u.alive) return;
    const ex = u.buffs.find(b => b.stat === stat);
    if (ex) { ex.pct = pct; ex.remaining = dur; }
    else u.buffs.push({ stat, pct, remaining: dur });
  }

  function normalAttack(u) {
    const t = defaultTarget(u);
    if (!t) return;
    emit({ e: 'act', uid: u.uid, type: 'atk', tgt: t.uid });
    applyDamage(u, t, effStat(u, 'atk'), { kind: 'atk' });
  }

  function checkEnd() {
    if (ended) return;
    if (!aliveOf('A').length) { ended = true; winner = 'B'; emit({ e: 'end', winner: 'B', duration: time }); }
    else if (!aliveOf('B').length) { ended = true; winner = 'A'; emit({ e: 'end', winner: 'A', duration: time }); }
  }

  const events = [];
  function step(dt) {
    if (ended) return { events: [], done: true, winner };
    const out = [];
    // swap & clear
    events.length = 0;
    time += dt;
    for (const tag of ['A', 'B']) {
      for (const u of sides[tag]) {
        if (!u.alive) continue;
        // buff/cc/dot 计时
        for (const b of u.buffs) b.remaining -= dt;
        u.buffs = u.buffs.filter(b => b.remaining > 0);
        if (u.cc) {
          u.cc.remaining -= dt;
          if (u.cc.remaining <= 0) { u.cc = null; emit({ e: 'ccEnd', uid: u.uid }); }
          continue; // 被控不能行动
        }
        // hot/dot 每秒结算
        for (const h of u.hots) { h.acc += dt; while (h.acc >= 1) { h.acc -= 1; healHp(u, h.perTick); } }
        u.hots = u.hots.filter(h => h.remaining - dt > -1);
        for (const h of u.hots) h.remaining -= dt;
        u.hots = u.hots.filter(h => h.remaining > 0);
        for (const d of u.dots) {
          d.acc += dt;
          while (d.acc >= 1 && u.alive) {
            d.acc -= 1;
            dealRaw(u, Math.max(1, Math.floor(d.perTick)), 'dot:' + d.kind);
          }
        }
        u.dots = u.dots.filter(d => d.remaining - dt > -1 && u.alive);
        for (const d of u.dots) d.remaining -= dt;
        u.dots = u.dots.filter(d => d.remaining > 0);
        if (!u.alive) continue;
        // 行动
        u.actTimer -= dt;
        if (u.actTimer <= 0) {
          const interval = BATTLE.BASE_ATTACK_INTERVAL / Math.max(0.3, effStat(u, 'spd'));
          if (u.energy >= BATTLE.ENERGY_MAX && !u.cc) {
            if (u.passive && hasSilence(u)) { normalAttack(u); }
            else castUlt(u);
          } else {
            normalAttack(u);
          }
          u.actTimer = interval;
        }
      }
    }
    if (time >= limit && !ended) {
      ended = true; winner = 'B';
      emit({ e: 'end', winner: 'B', duration: time, timeout: true });
    }
    checkEnd();
    return { events: events.slice(), done: ended, winner, time };
  }
  function hasSilence(u) { return u.cc && u.cc.kind === 'silence'; }

  function snapshot() {
    const out = [];
    for (const tag of ['A', 'B']) {
      for (const u of sides[tag]) {
        out.push({
          uid: u.uid, side: tag, slot: u.slot, name: u.name, hp: Math.floor(u.hp), maxHp: u.maxHp,
          shield: Math.floor(u.shield), energy: Math.floor(u.energy), alive: u.alive,
          cc: u.cc ? u.cc.kind : null, dots: u.dots.length
        });
      }
    }
    return out;
  }
  function result() {
    return { winner, duration: Math.round(time * 10) / 10, stats };
  }
  return { step, snapshot, result, get ended() { return ended; } };
}

// 由武将定义+等级+星+装备生成战斗单元
function buildUnit(calc, uid, row) {
  return {
    uid, heroId: calc.id, name: calc.name, faction: calc.faction, cls: calc.cls,
    level: calc.level, star: calc.star, row: row !== undefined ? row : calc.row,
    stats: calc.stats, ult: calc.ult, passive: calc.passive, isBoss: calc.isBoss || false
  };
}
module.exports = { createBattle, buildUnit };

});

_def('store', function(module, exports){
// 游戏状态管理：存档、武将养成、挂机、招募、任务、商店、演武
const C = _req('config');
const H = _req('heroes');
const IT = _req('items');
const F = _req('fmt');
const { buildUnit } = _req('battle');

const SAVE_KEY = 'sanguo_afk_save_v1';
const hasWx = typeof wx !== 'undefined' && !!wx.setStorageSync;
let memStore = {};

function rawGet(k) { return hasWx ? wx.getStorageSync(k) : memStore[k]; }
function rawSet(k, v) { if (hasWx) wx.setStorageSync(k, v); else memStore[k] = v; }

let state = null;

function defaultState() {
  const roster = {};
  C.BATTLE.STARTER.forEach(id => { roster[id] = newHero(id); });
  return {
    v: 1, createdAt: Date.now(), name: '主公',
    res: { gold: 60000, exp: 40000, gem: 1888, scroll: 12, token: 20, shard: 0 },
    roster,
    formation: ['guanyu', 'zhangfei', 'liaohua', 'liubei', null],
    campaign: { cleared: 0 },
    tower: { best: 0 },
    arena: { points: 1000, wins: 0, losses: 0, attempts: C.ARENA.DAILY },
    equips: {}, nextEquip: 1,
    idle: { last: Date.now(), gold: 0, exp: 0, scroll: 0 },
    fast: { day: '', count: 0 },
    daily: { day: '', quests: {}, claimed: [], active: [] },
    summon: { total: 0, pity: 0, wish: 0, firstTen: false },
    buyLog: { day: '', buys: {} },
    settings: { speed: 1 }
  };
}
function newHero(id) { return { id, lv: 1, star: 0, cards: 0, equip: { weapon: null, armor: null, helm: null, boots: null } }; }

function load() {
  const raw = rawGet(SAVE_KEY);
  if (raw && raw.v === 1) {
    state = raw;
  } else {
    state = defaultState();
    save();
  }
  // 离线挂机结算
  idleTick();
  return state;
}
function save() {
  if (state) idleTick();
  rawSet(SAVE_KEY, state);
}
function getState() { return state; }

// ---------- 每日重置 ----------
function checkDailyReset() {
  const today = F.todayStr();
  if (state.daily.day !== today) {
    state.daily = { day: today, quests: {}, claimed: [], active: [] };
    state.arena.attempts = C.ARENA.DAILY;
  }
  if (state.fast.day !== today) state.fast = { day: today, count: 0 };
  if (state.buyLog.day !== today) state.buyLog = { day: today, buys: {} };
}

// ---------- 武将 ----------
function allRoster() {
  return Object.keys(state.roster).map(id => calcHero(id));
}
function getOwned(id) { return state.roster[id]; }
function addHeroCard(id) {
  if (state.roster[id]) state.roster[id].cards += 1;
  else state.roster[id] = newHero(id);
}
// 共鸣水晶：前 5 高等级决定共鸣等级
function crystalInfo() {
  const list = Object.keys(state.roster).map(id => ({ id, lv: state.roster[id].lv }));
  list.sort((a, b) => b.lv - a.lv);
  const top5 = list.slice(0, 5);
  const cap = top5.length >= 5 ? top5[4].lv : 1;
  return { top5, cap, count: list.length };
}
function effectiveLevel(id) {
  const own = state.roster[id];
  const info = crystalInfo();
  const inTop5 = info.top5.some(t => t.id === id);
  return inTop5 ? own.lv : Math.max(own.lv, info.cap) === info.cap ? info.cap : Math.min(own.lv, info.cap);
}
function levelCap(id) {
  const own = state.roster[id];
  const caps = C.LEVEL_CAPS;
  return caps[Math.min(own.star, caps.length - 1)];
}
function calcHero(id) {
  const own = state.roster[id];
  const def = H.getHero(id);
  const lv = Math.min(effectiveLevel(id), levelCap(id));
  const star = own.star;
  let stats = H.heroStatsStar(def, lv, star);
  // 装备加成
  for (const slot of Object.keys(own.equip || {})) {
    const instId = own.equip[slot];
    if (!instId) continue;
    const inst = state.equips[instId];
    if (!inst) continue;
    const add = IT.equipStat(inst.tier, inst.slot, inst.enh);
    stats = {
      hp: stats.hp + (add.hp || 0),
      atk: stats.atk + (add.atk || 0),
      def: stats.def + (add.def || 0),
      spd: stats.spd, crit: stats.crit
    };
  }
  const power = H.heroPower(def, lv, star) + Math.floor((stats.hp - H.heroStatsStar(def, lv, star).hp) / 6 + (stats.atk - H.heroStatsStar(def, lv, star).atk) * 2.2 + (stats.def - H.heroStatsStar(def, lv, star).def) * 1.5);
  return {
    id, name: def.name, surname: def.name.slice(0, 1), title: def.title, quote: def.quote,
    faction: def.faction, cls: def.cls,
    rarity: def.rarity, level: lv, realLevel: own.lv, star, cards: own.cards, ult: def.ult,
    passive: def.passive.mods || {}, passiveDef: def.passive, stats, power, cap: levelCap(id),
    equip: own.equip
  };
}
function levelUp(id, times) {
  const own = state.roster[id];
  let done = 0;
  for (let i = 0; i < (times || 1); i++) {
    if (own.lv >= levelCap(id)) break;
    const g = C.goldCost(own.lv), e = C.expCost(own.lv);
    if (state.res.gold < g || state.res.exp < e) break;
    state.res.gold -= g; state.res.exp -= e;
    own.lv += 1; done += 1;
  }
  if (done > 0) bumpQuest('q_levelup', 1);
  return done;
}
// 兵魂点：同阵营其他武将的卡
function foodPoints(exceptId) {
  let pts = 0;
  Object.keys(state.roster).forEach(id => {
    if (id === exceptId) return;
    const h = H.getHero(id);
    if (!h) return;
    if (h.faction === H.getHero(exceptId).faction) {
      pts += (C.FOOD_VALUE[h.rarity] || 1) * state.roster[id].cards;
    }
  });
  return pts;
}
function ascend(id) {
  const own = state.roster[id];
  const maxStar = C.RARITIES[H.getHero(id).rarity].maxStar;
  if (own.star >= maxStar) return { ok: false, msg: '已达最高品阶' };
  const cost = C.ASCEND_COST[own.star];
  if (own.cards < cost.same) return { ok: false, msg: '同名武将卡不足' };
  if (foodPoints(id) < cost.food) return { ok: false, msg: '同阵营兵魂点不足' };
  if (state.res.gold < cost.gold) return { ok: false, msg: '铜钱不足' };
  own.cards -= cost.same;
  let need = cost.food;
  // 优先消耗低品质卡
  const order = [1, 2, 3];
  for (const r of order) {
    if (need <= 0) break;
    for (const hid of Object.keys(state.roster)) {
      if (hid === id || need <= 0) continue;
      const h = H.getHero(hid);
      if (!h || h.faction !== H.getHero(id).faction || C.FOOD_VALUE[h.rarity] !== r) continue;
      while (state.roster[hid].cards > 0 && need > 0) {
        state.roster[hid].cards -= 1; need -= 1;
      }
    }
  }
  state.res.gold -= cost.gold;
  own.star += 1;
  return { ok: true, star: own.star };
}
function dismiss(id) {
  const own = state.roster[id];
  if (!own) return { ok: false, msg: '未拥有' };
  if (state.formation.indexOf(id) >= 0) return { ok: false, msg: '编队中的武将无法遣散' };
  const r = H.getHero(id).rarity;
  const gain = r === 3 ? { shard: 40, gold: 100000 } : r === 2 ? { shard: 15, gold: 20000 } : { shard: 5, gold: 5000 };
  // 返还装备
  for (const slot of Object.keys(own.equip || {})) {
    if (own.equip[slot]) delete state.equips[own.equip[slot]];
  }
  delete state.roster[id];
  state.formation = state.formation.map(x => (x === id ? null : x));
  state.res.shard += gain.shard; state.res.gold += gain.gold;
  return { ok: true, gain };
}
function resetHero(id) {
  // 重置等级，返还七成资源
  const own = state.roster[id];
  if (!own || own.lv <= 1) return { ok: false, msg: '无需重置' };
  const info = crystalInfo();
  if (info.top5.slice(0, 5).some(t => t.id === id)) return { ok: false, msg: '共鸣核心武将暂不可重置' };
  let gold = 0, exp = 0;
  for (let lv = 1; lv < own.lv; lv++) { gold += C.goldCost(lv); exp += C.expCost(lv); }
  state.res.gold += Math.floor(gold * 0.7);
  state.res.exp += Math.floor(exp * 0.7);
  own.lv = 1;
  return { ok: true, gold: Math.floor(gold * 0.7), exp: Math.floor(exp * 0.7) };
}

// ---------- 编队 ----------
function getFormationCalc() {
  return state.formation.map(id => (id && state.roster[id]) ? calcHero(id) : null);
}
function setFormationSlot(slot, heroId) {
  // 唯一性
  if (heroId) {
    state.formation = state.formation.map((x, i) => (x === heroId && i !== slot ? null : x));
  }
  state.formation[slot] = heroId || null;
}
function formationFactionBonus() {
  const calc = getFormationCalc();
  const count = {};
  calc.forEach(x => { if (x) count[x.faction] = (count[x.faction] || 0) + 1; });
  const maxC = Math.max.apply(null, [0].concat(Object.keys(count).map(k => count[k])));
  return { bonus: C.factionBonus(maxC), count: maxC };
}
function teamPower() {
  const calc = getFormationCalc();
  return calc.reduce((s, x) => s + (x ? x.power : 0), 0);
}
// 生成战斗用双方单元
function playerUnits() {
  const calc = getFormationCalc();
  return calc.map((x, i) => x ? buildUnit(x, 'A' + i, i <= 2 ? 0 : 1) : null).filter(Boolean);
}
function enemyUnits(units) {
  const H2 = _req('heroes');
  const { heroStatsStar } = H2;
  return units.map((u, i) => {
    const base = heroStatsStar(u.hero, u.level, u.star);
    const stats = {
      hp: Math.floor(base.hp * u.scale),
      atk: Math.floor(base.atk * u.scale),
      def: Math.floor(base.def * u.scale),
      spd: base.spd, crit: base.crit
    };
    return buildUnit({
      id: u.hero.id, name: u.hero.name, faction: u.hero.faction, cls: u.hero.cls,
      level: u.level, star: u.star, stats, ult: u.hero.ult, passive: u.hero.passive.mods || {},
      isBoss: u.isBoss
    }, 'B' + i, u.row);
  });
}

// ---------- 装备 ----------
function addEquip(tier, slot) {
  const id = 'e' + (state.nextEquip++);
  state.equips[id] = { id, tier, slot, enh: 0 };
  if (Object.keys(state.equips).length > 300) {
    // 自动分解多余低阶装备
    const ids = Object.keys(state.equips).filter(x => !isEquipped(x) && state.equips[x].tier <= 2);
    ids.sort((a, b) => state.equips[a].tier - state.equips[b].tier);
    for (const i of ids.slice(0, ids.length - 300 + 60)) delete state.equips[i];
  }
  return id;
}
function isEquipped(instId) {
  return Object.keys(state.roster).some(id => Object.keys(state.roster[id].equip || {}).some(s => state.roster[id].equip[s] === instId));
}
function equipInventory() {
  return Object.keys(state.equips).map(k => state.equips[k]).filter(e => !isEquipped(e.id));
}
function equipTo(heroId, slot, instId) {
  const own = state.roster[heroId];
  if (!own) return;
  if (own.equip[slot]) {
    // 旧装备卸下（保留在背包）
  }
  // 若目标装备已被他人穿戴则先卸下
  for (const hid of Object.keys(state.roster)) {
    for (const s of Object.keys(state.roster[hid].equip || {})) {
      if (state.roster[hid].equip[s] === instId) state.roster[hid].equip[s] = null;
    }
  }
  own.equip[slot] = instId;
}
function unequip(heroId, slot) {
  const own = state.roster[heroId];
  if (own) own.equip[slot] = null;
}
function enhanceEquip(instId) {
  const e = state.equips[instId];
  if (!e || e.enh >= IT.MAX_ENH) return { ok: false, msg: '已满级' };
  const cost = IT.enhanceCost(e.tier, e.enh);
  if (state.res.gold < cost) return { ok: false, msg: '铜钱不足' };
  state.res.gold -= cost;
  e.enh += 1;
  return { ok: true, enh: e.enh };
}
function salvageEquip(instId) {
  const e = state.equips[instId];
  if (!e || isEquipped(instId)) return { ok: false, msg: '无法分解' };
  const gold = Math.floor(IT.enhanceCost(e.tier, 0) * 0.4);
  delete state.equips[instId];
  state.res.gold += gold;
  return { ok: true, gold };
}

// ---------- 挂机 ----------
function idlePending() {
  idleTick();
  const rate = C.idleRates(state.campaign.cleared);
  const gold = Math.floor(state.idle.gold), exp = Math.floor(state.idle.exp), scroll = Math.floor(state.idle.scroll);
  const hours = rate.gold > 0 ? state.idle.gold / rate.gold : 0;
  const full = state.idle.gold >= C.IDLE_CAP_HOURS * rate.gold - 1;
  return { gold, exp, scroll, hours, full };
}
function idleTick() {
  // 把离线时间折算进累计（入 state.idle 缓存）
  const now = Date.now();
  const addH = Math.min(C.IDLE_CAP_HOURS, (now - state.idle.last) / 3600000);
  const rate = C.idleRates(state.campaign.cleared);
  state.idle.gold += addH * rate.gold;
  state.idle.exp += addH * rate.exp;
  state.idle.scroll += addH * rate.scrollPerHour;
  const capG = C.IDLE_CAP_HOURS * rate.gold, capE = C.IDLE_CAP_HOURS * rate.exp;
  state.idle.gold = Math.min(state.idle.gold, capG);
  state.idle.exp = Math.min(state.idle.exp, capE);
  state.idle.scroll = Math.min(state.idle.scroll, C.IDLE_CAP_HOURS * rate.scrollPerHour);
  state.idle.last = now;
}
function claimIdle() {
  idleTick();
  const g = Math.floor(state.idle.gold), e = Math.floor(state.idle.exp), s = Math.floor(state.idle.scroll);
  state.res.gold += g; state.res.exp += e; state.res.scroll += s;
  state.idle.gold = 0; state.idle.exp = 0; state.idle.scroll = 0;
  bumpQuest('q_idle1', 1);
  return { gold: g, exp: e, scroll: s };
}
function fastReward() {
  if (state.fast.count >= C.FAST_REWARD_DAILY) return { ok: false, msg: '今日快速收获次数已用完' };
  if (state.res.gem < C.FAST_REWARD_COST) return { ok: false, msg: '元宝不足' };
  state.res.gem -= C.FAST_REWARD_COST;
  state.fast.count += 1;
  const rate = C.idleRates(state.campaign.cleared);
  const g = Math.floor(C.FAST_REWARD_HOURS * rate.gold), e = Math.floor(C.FAST_REWARD_HOURS * rate.exp);
  const s = Math.floor(C.FAST_REWARD_HOURS * rate.scrollPerHour);
  state.res.gold += g; state.res.exp += e; state.res.scroll += s;
  return { ok: true, gold: g, exp: e, scroll: s };
}

// ---------- 招募 ----------
function rollRarity(forceSSR) {
  const g = C.GACHA;
  if (forceSSR) return 3;
  const r = Math.random();
  if (r < g.rates.ssr) return 3;
  if (r < g.rates.ssr + g.rates.sr) return 2;
  return 1;
}
function pickHeroOfRarity(rarity) {
  const pool = H.HEROES.filter(h => h.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function doSummon(type) {
  // type: scroll1 | scroll10 | gem10
  const g = C.GACHA;
  const count = type === 'scroll1' ? 1 : 10;
  let costOk = false;
  if (type === 'scroll1') {
    if (state.res.scroll >= 1) { state.res.scroll -= 1; costOk = true; }
  } else if (type === 'scroll10') {
    if (state.res.scroll >= 10) { state.res.scroll -= 10; costOk = true; }
  } else {
    if (state.res.gem >= g.costTenGold) { state.res.gem -= g.costTenGold; costOk = true; }
  }
  if (!costOk) return { ok: false, msg: '招募令/元宝不足' };

  const results = [];
  let guaranteed = false;
  if (count === 10 && !state.summon.firstTen) { guaranteed = true; state.summon.firstTen = true; }
  for (let i = 0; i < count; i++) {
    state.summon.pity += 1;
    state.summon.wish += 1;
    state.summon.total += 1;
    let force = false;
    if (state.summon.pity >= g.hardPity) { force = true; state.summon.pity = 0; }
    if (state.summon.wish >= g.wishMax) { force = true; state.summon.wish = 0; }
    if (guaranteed && i === count - 1 && !results.some(x => x.rarity === 3)) force = true;
    const rarity = rollRarity(force);
    if (rarity === 3) { state.summon.pity = 0; state.summon.wish = 0; }
    const id = pickHeroOfRarity(rarity);
    const isNew = !state.roster[id];
    addHeroCard(id);
    results.push({ id, rarity, isNew, star: 0 });
  }
  bumpQuest('q_summon1', 1);
  return { ok: true, results };
}
function grantCard(id) {
  addHeroCard(id);
}

// ---------- 战役 / 塔 / 演武 ----------
function winCampaign(stageIdx) {
  // stageIdx 从 1 开始
  const first = stageIdx === state.campaign.cleared + 1;
  const reward = { gold: 0, exp: 0, gem: 0, scroll: 0, equip: null };
  if (first) {
    state.campaign.cleared = stageIdx;
    reward.gem = 30;
    reward.gold = Math.floor(2000 * Math.pow(1.05, stageIdx));
    reward.exp = Math.floor(1400 * Math.pow(1.05, stageIdx));
    const { isBoss } = _req('stages').chapterOf(stageIdx);
    if (isBoss) reward.scroll = 1;
    if (Math.random() < 0.65) {
      const tier = IT.dropTier(stageIdx);
      const slot = IT.DROP_SLOTS[Math.floor(Math.random() * IT.DROP_SLOTS.length)];
      reward.equip = { tier, slot };
      addEquip(tier, slot);
    }
  } else {
    // 重复挑战仍给小额奖励
    reward.gold = Math.floor(600 * Math.pow(1.05, stageIdx) * 0.3);
    reward.exp = Math.floor(400 * Math.pow(1.05, stageIdx) * 0.3);
  }
  bumpQuest('q_win3', 1);
  return reward;
}
function winTower(floor) {
  const first = floor === state.tower.best + 1;
  const reward = { gem: 0, scroll: 0, shard: 0 };
  if (first) {
    state.tower.best = floor;
    reward.gem = 25 + floor * 2;
    if (floor % 5 === 0) reward.scroll = 1;
    if (floor % 10 === 0) reward.shard = 10;
  }
  bumpQuest('q_tower1', 1);
  return reward;
}
function arenaFight(win, diff) {
  state.arena.attempts = Math.max(0, state.arena.attempts - 1);
  let delta = 0, tokens = 0;
  if (win) {
    delta = Math.round(14 + 8 * diff);
    tokens = C.ARENA.WIN_TOKENS;
    state.arena.wins += 1;
  } else {
    delta = -8;
    tokens = C.ARENA.LOSE_TOKENS;
    state.arena.losses += 1;
  }
  state.arena.points = Math.max(0, state.arena.points + delta);
  state.res.token += tokens;
  bumpQuest('q_arena1', 1);
  return { delta, tokens, points: state.arena.points };
}

// ---------- 任务 ----------
function bumpQuest(qid, n) {
  if (!state.daily.quests) state.daily.quests = {};
  state.daily.quests[qid] = Math.min((state.daily.quests[qid] || 0) + n, (IT.QUESTS.find(q => q.id === qid) || {}).target || 99);
}
function questList() {
  return IT.QUESTS.map(q => ({
    ...q, count: state.daily.quests[q.id] || 0,
    done: (state.daily.quests[q.id] || 0) >= q.target,
    claimed: state.daily.claimed.indexOf(q.id) >= 0
  }));
}
function claimQuest(qid) {
  const q = IT.QUESTS.find(x => x.id === qid);
  if (!q) return { ok: false };
  if ((state.daily.quests[qid] || 0) < q.target) return { ok: false, msg: '任务未完成' };
  if (state.daily.claimed.indexOf(qid) >= 0) return { ok: false, msg: '已领取' };
  state.daily.claimed.push(qid);
  state.res.active = state.res.active || 0;
  applyReward(q.reward);
  return { ok: true, reward: q.reward, act: q.act };
}
function activePoints() {
  let pts = 0;
  IT.QUESTS.forEach(q => {
    if (state.daily.claimed.indexOf(q.id) >= 0) pts += q.act;
  });
  return pts;
}
function claimActiveChest(idx) {
  const chest = IT.ACTIVE_CHESTS[idx];
  if (!chest) return { ok: false };
  if (state.daily.active.indexOf(idx) >= 0) return { ok: false, msg: '已领取' };
  if (activePoints() < chest.need) return { ok: false, msg: '活跃度不足' };
  state.daily.active.push(idx);
  applyReward(chest.reward);
  return { ok: true, reward: chest.reward };
}
function applyReward(r) {
  if (r.gold) state.res.gold += r.gold;
  if (r.exp) state.res.exp += r.exp;
  if (r.gem) state.res.gem += r.gem;
  if (r.scroll) state.res.scroll += r.scroll;
  if (r.token) state.res.token += r.token;
  if (r.shard) state.res.shard += r.shard;
}

// ---------- 商铺 ----------
function buyGood(goodId) {
  const good = IT.SHOP_GOODS.find(g => g.id === goodId);
  if (!good) return { ok: false };
  const bought = state.buyLog.buys[goodId] || 0;
  if (bought >= good.limit) return { ok: false, msg: '今日已售罄' };
  if (state.res[good.cur] < good.price) return { ok: false, msg: CURRENCY_NAME[good.cur] + '不足' };
  state.res[good.cur] -= good.price;
  state.buyLog.buys[goodId] = bought + 1;
  applyReward(good.give);
  return { ok: true };
}
const CURRENCY_NAME = { gold: '铜钱', exp: '兵书', gem: '元宝', scroll: '招募令', token: '演武令', shard: '英雄碎片' };

module.exports = {
  load, save, getState, checkDailyReset, SAVE_KEY,
  allRoster, getOwned, addHeroCard, grantCard, crystalInfo, effectiveLevel, levelCap, calcHero,
  levelUp, ascend, foodPoints, dismiss, resetHero,
  getFormationCalc, setFormationSlot, formationFactionBonus, teamPower, playerUnits, enemyUnits,
  addEquip, equipInventory, equipTo, unequip, enhanceEquip, salvageEquip, isEquipped,
  idlePending, idleTick, claimIdle, fastReward,
  doSummon, rollRarity, pickHeroOfRarity,
  winCampaign, winTower, arenaFight,
  questList, claimQuest, activePoints, claimActiveChest, bumpQuest, applyReward,
  buyGood, CURRENCY_NAME
};

});