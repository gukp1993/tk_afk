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
const CLASSES = require('./config').CLASSES;

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
