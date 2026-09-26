// 武将图鉴（三国演义 120 将，原创设计）
// 稀有度四档（按演义知名度）：1=白N · 2=蓝R · 3=紫SR · 4=橙SSR
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
  // ================= 蜀 =================
  {
    id: 'liubei', name: '刘备', title: '昭烈帝', faction: 'shu', cls: 'support', rarity: 4,
    quote: '惟贤惟德，能服于人。',
    base: { hp: 2680, atk: 210, def: 128, spd: 1.0, crit: 0.05 },
    ult: { name: '仁德布世', desc: '以仁义感召三军：治疗全体友军（攻击的150%），并令我方全体攻击+12%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.5 },
      { t: 'buff', stat: 'atk', pct: 0.12, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '汉室正统', desc: '中山靖王之后，我方全体防御+8%。', mods: { auraDef: 0.08 } }
  },
  {
    id: 'guanyu', name: '关羽', title: '武圣', faction: 'shu', cls: 'warrior', rarity: 4,
    quote: '青龙偃月，忠义千秋。',
    base: { hp: 3050, atk: 250, def: 172, spd: 1.05, crit: 0.08 },
    ult: { name: '青龙偃月斩', desc: '温酒斩将之威：对敌方前排造成250%攻击伤害，并使其流血，持续6秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.5 },
      { t: 'dot', kind: 'bleed', mult: 0.4, dur: 6, tgt: 'frontRow' }
    ]},
    passive: { name: '武圣威严', desc: '斩颜良诛文丑，威震华夏：自身攻击+15%，生命+10%。', mods: { atk: 0.15, hp: 0.10 } }
  },
  {
    id: 'zhangfei', name: '张飞', title: '万人敌', faction: 'shu', cls: 'tank', rarity: 4,
    quote: '燕人张翼德在此！',
    base: { hp: 4450, atk: 148, def: 270, spd: 0.85, crit: 0.05 },
    ult: { name: '当阳断喝', desc: '长坂桥头一声吼，喝断桥梁水倒流：对敌方前排造成200%攻击伤害并眩晕3秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.0 },
      { t: 'cc', kind: 'stun', dur: 3, tgt: 'frontRow' }
    ]},
    passive: { name: '万人敌', desc: '据水断桥，曹军莫敢近：自身生命+18%，反弹10%所受伤害。', mods: { hp: 0.18, thorns: 0.10 } }
  },
  {
    id: 'zhaoyun', name: '赵云', title: '常山赵子龙', faction: 'shu', cls: 'warrior', rarity: 4,
    quote: '七进七出，浑身是胆！',
    base: { hp: 2950, atk: 246, def: 165, spd: 1.1, crit: 0.12 },
    ult: { name: '七进七出', desc: '长坂坡单骑救主：对随机敌人连续突刺4次，每段造成85%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'randEach', mult: 0.85, hits: 4 }
    ]},
    passive: { name: '龙胆', desc: '一身是胆，浑身解数：自身暴击+15%，且每场战斗可免疫一次致命伤害。', mods: { crit: 0.15, cheatDeath: 1 } }
  },
  {
    id: 'zhugeliang', name: '诸葛亮', title: '卧龙', faction: 'shu', cls: 'mage', rarity: 4,
    quote: '淡泊明志，宁静致远。',
    base: { hp: 2250, atk: 318, def: 110, spd: 0.95, crit: 0.06 },
    ult: { name: '八阵图', desc: '按遁甲分成休生伤杜景死惊开：对全体敌军造成180%攻击伤害并附加灼烧，持续8秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.8 },
      { t: 'dot', kind: 'burn', mult: 0.35, dur: 8, tgt: 'allEnemies' }
    ]},
    passive: { name: '神机', desc: '未出茅庐已知三分天下：我方全体攻击+6%，自身怒气获取提升20%。', mods: { auraAtk: 0.06, energyGain: 0.2 } }
  },
  {
    id: 'huangzhong', name: '黄忠', title: '老当益壮', faction: 'shu', cls: 'archer', rarity: 4,
    quote: '宝刀未老，弓马犹强！',
    base: { hp: 2400, atk: 318, def: 106, spd: 1.15, crit: 0.15 },
    ult: { name: '百步穿杨', desc: '定军山一箭定乾坤：对生命最低的敌军造成300%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'lowestEnemy', mult: 3.0 }
    ]},
    passive: { name: '烈弓', desc: '能开二石之弓，百发百中：自身暴击率+10%，暴击伤害+40%。', mods: { crit: 0.10, critDmg: 0.4 } }
  },
  {
    id: 'machao', name: '马超', title: '锦马超', faction: 'shu', cls: 'warrior', rarity: 3,
    quote: '西凉铁骑，踏破山川！',
    base: { hp: 2850, atk: 238, def: 156, spd: 1.12, crit: 0.08 },
    ult: { name: '铁骑冲锋', desc: '潼关杀得曹操割须弃袍：对随机3名敌军各造成150%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand3', mult: 1.5 }
    ]},
    passive: { name: '西凉铁骑', desc: '神威天将军，羌人敬若神明：自身攻速+10%，攻击+8%。', mods: { spd: 0.10, atk: 0.08 } }
  },
  {
    id: 'pangtong', name: '庞统', title: '凤雏', faction: 'shu', cls: 'mage', rarity: 3,
    quote: '连环之计，正合天时。',
    base: { hp: 2280, atk: 296, def: 108, spd: 0.95, crit: 0.06 },
    ult: { name: '连环锁敌', desc: '铁索连环，火攻可借：对全体敌军造成130%攻击伤害，并削弱其防御20%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.3 },
      { t: 'debuff', stat: 'def', pct: 0.2, dur: 8, tgt: 'allEnemies' }
    ]},
    passive: { name: '凤雏献策', desc: '卧龙凤雏，得一可安天下：战斗开始即获得30点怒气，自身暴击率+8%。', mods: { firstEnergy: 30, crit: 0.08 } }
  },
  {
    id: 'jiangwei', name: '姜维', title: '麒麟儿', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '臣等正欲死战，陛下何故先降！',
    base: { hp: 2760, atk: 214, def: 146, spd: 1.0, crit: 0.07 },
    ult: { name: '麒麟之志', desc: '文武双全，志继武侯：对单体造成240%攻击伤害，并为自己生成攻击100%的护盾。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.4 },
      { t: 'shield', tgt: 'self', mult: 1.0 }
    ]},
    passive: { name: '继承遗志', desc: '九伐中原，矢志不渝：自身怒气获取提升20%。', mods: { energyGain: 0.2 } }
  },
  {
    id: 'weiyan', name: '魏延', title: '反骨骁将', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '若曹操举天下而来，请为大王拒之！',
    base: { hp: 2800, atk: 212, def: 148, spd: 1.02, crit: 0.06 },
    ult: { name: '子午谷奇袭', desc: '兵行险着，直取长安：对单体造成270%攻击伤害，并使自身攻击+20%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.7 },
      { t: 'buff', stat: 'atk', pct: 0.2, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '反骨', desc: '天生反骨，唯勇是争：自身攻击+12%，击杀敌人后额外获得15点怒气。', mods: { atk: 0.12, rageOnKill: 15 } }
  },
  {
    id: 'guanping', name: '关平', title: '少将承志', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '愿随父亲征战，万死不辞！',
    base: { hp: 2720, atk: 208, def: 146, spd: 1.0, crit: 0.06 },
    ult: { name: '承志斩', desc: '虎父无犬子：对单体造成225%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.25 }
    ]},
    passive: { name: '将门虎子', desc: '随父征战，恪尽孝勇：自身攻击+9%，生命+8%。', mods: { atk: 0.09, hp: 0.08 } }
  },
  {
    id: 'guanxing', name: '关兴', title: '小关', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '父仇不共戴天！',
    base: { hp: 2700, atk: 212, def: 144, spd: 1.02, crit: 0.07 },
    ult: { name: '斩将复仇', desc: '兴兵伐吴，斩将夺旗：对生命最低的敌军造成235%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'lowestEnemy', mult: 2.35 }
    ]},
    passive: { name: '虎翼', desc: '与张苞结为兄弟，同生共死：自身暴击率+10%。', mods: { crit: 0.10 } }
  },
  {
    id: 'zhangbao', name: '张苞', title: '小张', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '吾父燕人张翼德，谁敢与吾一战！',
    base: { hp: 2820, atk: 206, def: 148, spd: 1.0, crit: 0.06 },
    ult: { name: '蛇矛破阵', desc: '家传丈八蛇矛，重现沙场：对敌方前排造成200%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.0 }
    ]},
    passive: { name: '虎头', desc: '小关张联袂，锐不可当：自身攻击+8%，生命+8%。', mods: { atk: 0.08, hp: 0.08 } }
  },
  {
    id: 'madai', name: '马岱', title: '西凉副将', faction: 'shu', cls: 'warrior', rarity: 2,
    quote: '兄长之仇，岱必报之。',
    base: { hp: 2680, atk: 210, def: 142, spd: 1.0, crit: 0.07 },
    ult: { name: '隐刃一击', desc: '锦囊暗藏，后发制人：对单体造成230%攻击伤害，并使其中毒，持续4秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.3 },
      { t: 'dot', kind: 'poison', mult: 0.25, dur: 4, tgt: 'single' }
    ]},
    passive: { name: '沉毅', desc: '依锦囊而行，斩反骨于阵前：自身攻击+9%。', mods: { atk: 0.09 } }
  },
  {
    id: 'wangping', name: '王平', title: '无当飞军', faction: 'shu', cls: 'tank', rarity: 2,
    quote: '街亭之失，平早有谏言。',
    base: { hp: 3900, atk: 158, def: 232, spd: 0.9, crit: 0.05 },
    ult: { name: '无当结阵', desc: '统领无当飞军，结阵御敌：对敌方前排造成150%攻击伤害，并使自身攻击+18%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.5 },
      { t: 'buff', stat: 'atk', pct: 0.18, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '谨严', desc: '遵法度、明进退：自身生命+10%，受到伤害降低6%。', mods: { hp: 0.10, dmgReduce: 0.06 } }
  },
  {
    id: 'liaohua', name: '廖化', title: '蜀中先锋', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '蜀中无大将，廖化作先锋。',
    base: { hp: 2600, atk: 195, def: 138, spd: 1.0, crit: 0.05 },
    ult: { name: '先锋突刺', desc: '虽无奇计，冲锋在前：对单体造成200%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.0 }
    ]},
    passive: { name: '老练', desc: '历经百战，经验老到：自身生命+10%。', mods: { hp: 0.10 } }
  },
  {
    id: 'zhouchang', name: '周仓', title: '扛刀义士', faction: 'shu', cls: 'tank', rarity: 2,
    quote: '仓愿为将军执鞭坠镫！',
    base: { hp: 3850, atk: 152, def: 228, spd: 0.88, crit: 0.05 },
    ult: { name: '义胆护主', desc: '青龙偃月刀由仓所扛：为自己生成攻击190%的护盾，并对单体造成140%攻击伤害。', effects: [
      { t: 'shield', tgt: 'self', mult: 1.9 },
      { t: 'dmg', tgt: 'single', mult: 1.4 }
    ]},
    passive: { name: '铁背', desc: '两臂有千斤之力，板肋虬髯：自身生命+12%，反弹8%所受伤害。', mods: { hp: 0.12, thorns: 0.08 } }
  },
  {
    id: 'yanyan', name: '严颜', title: '断头老将', faction: 'shu', cls: 'tank', rarity: 2,
    quote: '我州但有断头将军，无降将军！',
    base: { hp: 3950, atk: 150, def: 236, spd: 0.86, crit: 0.05 },
    ult: { name: '断头之勇', desc: '宁断头，不折节：对敌方前排造成160%攻击伤害，并使自身受到伤害降低20%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.6 },
      { t: 'buff', stat: 'def', pct: 0.2, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '老将之风', desc: '巴郡老将，义释归汉：自身生命+11%。', mods: { hp: 0.11 } }
  },
  {
    id: 'fazheng', name: '法正', title: '奇画策算', faction: 'shu', cls: 'mage', rarity: 3,
    quote: '孝直若在，必能制主上东行。',
    base: { hp: 2320, atk: 290, def: 112, spd: 0.96, crit: 0.07 },
    ult: { name: '定军奇策', desc: '定军山声东击西：对随机2名敌军各造成190%攻击伤害，并削弱其攻击15%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.9 },
      { t: 'debuff', stat: 'atk', pct: 0.15, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '恩怨分明', desc: '一饭之德必偿，睚眦之怨必报：自身暴击率+9%。', mods: { crit: 0.09 } }
  },
  {
    id: 'huangyueying', name: '黄月英', title: '机巧夫人', faction: 'shu', cls: 'support', rarity: 3,
    quote: '妾身虽丑，机巧无双。',
    base: { hp: 2480, atk: 224, def: 120, spd: 1.0, crit: 0.05 },
    ult: { name: '木牛流马', desc: '造木牛流马，运粮不歇：治疗全体友军（攻击的150%），并令我方全体攻速+10%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.5 },
      { t: 'buff', stat: 'spd', pct: 0.10, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '巧思', desc: '传诸葛连弩八阵图，皆得其助：我方全体攻击+4%，自身治疗效果+10%。', mods: { auraAtk: 0.04, heal: 0.10 } }
  },
  {
    id: 'malang', name: '马良', title: '白眉最良', faction: 'shu', cls: 'support', rarity: 1,
    quote: '马氏五常，白眉最良。',
    base: { hp: 2450, atk: 186, def: 116, spd: 1.0, crit: 0.05 },
    ult: { name: '白眉献策', desc: '眉中有白毛，才思敏捷：治疗生命最低的友军（攻击的200%），并使其攻击+15%，持续8秒。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 2.0 },
      { t: 'buff', stat: 'atk', pct: 0.15, dur: 8, tgt: 'lowestAlly' }
    ]},
    passive: { name: '五常', desc: '兄弟五人并有才名：自身治疗效果+9%。', mods: { heal: 0.09 } }
  },
  {
    id: 'masu', name: '马谡', title: '言过其实', faction: 'shu', cls: 'mage', rarity: 1,
    quote: '某自幼熟读兵书，颇知兵法。',
    base: { hp: 2240, atk: 242, def: 100, spd: 0.94, crit: 0.05 },
    ult: { name: '纸上谈兵', desc: '熟读兵书，胸藏韬略：对随机2名敌军各造成150%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.5 }
    ]},
    passive: { name: '攻心为上', desc: '用兵之道，攻心为上：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'jianyong', name: '简雍', title: '雍容讽议', faction: 'shu', cls: 'support', rarity: 1,
    quote: '主公，雍有一言相劝。',
    base: { hp: 2420, atk: 182, def: 114, spd: 1.0, crit: 0.05 },
    ult: { name: '从容进言', desc: '谈笑之间化解危机：治疗全体友军（攻击的120%）。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.2 }
    ]},
    passive: { name: '诙谐', desc: '简雍善讽议，谈笑用兵：自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'sunqian', name: '孙乾', title: '干练之才', faction: 'shu', cls: 'support', rarity: 1,
    quote: '乾愿为使，说于公前。',
    base: { hp: 2400, atk: 180, def: 112, spd: 1.0, crit: 0.05 },
    ult: { name: '周旋使命', desc: '为使四方，不辱君命：治疗生命最低的友军（攻击的190%）。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.9 }
    ]},
    passive: { name: '敦厚', desc: '谦雅敦厚，随主周旋：自身生命+8%。', mods: { hp: 0.08 } }
  },
  {
    id: 'mizhu', name: '糜竺', title: '倾家助主', faction: 'shu', cls: 'support', rarity: 1,
    quote: '竺愿以家资相助，共图大业。',
    base: { hp: 2440, atk: 178, def: 116, spd: 1.0, crit: 0.05 },
    ult: { name: '散财聚义', desc: '以千金家资养军：治疗全体友军（攻击的115%），并使我方全体防御+10%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.15 },
      { t: 'buff', stat: 'def', pct: 0.10, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '殷富', desc: '徐州巨富，资费军需：自身生命+9%。', mods: { hp: 0.09 } }
  },
  {
    id: 'mengda', name: '孟达', title: '反复之将', faction: 'shu', cls: 'archer', rarity: 1,
    quote: '达观天下大势，择主而事。',
    base: { hp: 2260, atk: 240, def: 98, spd: 1.1, crit: 0.06 },
    ult: { name: '反戈一击', desc: '临阵倒戈，出其不意：对随机2名敌军各造成145%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.45 }
    ]},
    passive: { name: '观望', desc: '首鼠两端，静待其变：自身攻速+7%。', mods: { spd: 0.07 } }
  },
  {
    id: 'liufeng', name: '刘封', title: '义子猛将', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '封虽义子，勇力过人。',
    base: { hp: 2660, atk: 198, def: 140, spd: 1.0, crit: 0.05 },
    ult: { name: '猛锐之击', desc: '性刚猛，武力过人：对单体造成195%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 1.95 }
    ]},
    passive: { name: '刚猛', desc: '随军征战，所向克捷：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'futong', name: '傅彤', title: '忠烈校尉', faction: 'shu', cls: 'tank', rarity: 1,
    quote: '吴狗！何汉将也有降者！',
    base: { hp: 3880, atk: 144, def: 230, spd: 0.86, crit: 0.05 },
    ult: { name: '死战不退', desc: '彝陵断后，吐血死战：对敌方前排造成145%攻击伤害，并使自身生命+12%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.45 },
      { t: 'buff', stat: 'def', pct: 0.12, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '忠烈', desc: '宁死不降，骂声不绝：自身生命+10%，反弹8%所受伤害。', mods: { hp: 0.10, thorns: 0.08 } }
  },
  {
    id: 'zhangyi', name: '张嶷', title: '无援之将', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '嶷虽残躯，犹堪一战！',
    base: { hp: 2650, atk: 196, def: 138, spd: 1.0, crit: 0.05 },
    ult: { name: '带伤奋击', desc: '扶病出征，以死报国：对单体造成192%攻击伤害，并使自身攻击+10%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 1.92 },
      { t: 'buff', stat: 'atk', pct: 0.10, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '带伤之勇', desc: '身带箭伤犹自力战：自身生命+8%。', mods: { hp: 0.08 } }
  },
  {
    id: 'wuban', name: '吴班', title: '后部督', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '班愿为前部，讨伐国贼！',
    base: { hp: 2640, atk: 194, def: 138, spd: 1.0, crit: 0.05 },
    ult: { name: '列阵叫战', desc: '陈兵耀武，引敌出战：对随机2名敌军各造成135%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.35 }
    ]},
    passive: { name: '稳重', desc: '随军征战，累有功勋：自身防御+8%。', mods: { def: 0.08 } }
  },
  {
    id: 'chenshi', name: '陈式', title: '先锋偏将', faction: 'shu', cls: 'warrior', rarity: 1,
    quote: '式愿领兵，先取箕谷！',
    base: { hp: 2620, atk: 192, def: 136, spd: 1.0, crit: 0.05 },
    ult: { name: '突击陷阵', desc: '率军突进，直入敌阵：对单体造成188%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 1.88 }
    ]},
    passive: { name: '先锋', desc: '逢山开路，遇水搭桥：自身攻速+7%。', mods: { spd: 0.07 } }
  },
  // ================= 魏 =================
  {
    id: 'caocao', name: '曹操', title: '乱世奸雄', faction: 'wei', cls: 'mage', rarity: 4,
    quote: '宁教我负天下人，休教天下人负我。',
    base: { hp: 2200, atk: 320, def: 112, spd: 0.95, crit: 0.08 },
    ult: { name: '乱世号令', desc: '挟天子以令诸侯：对全体敌军造成170%攻击伤害，并令我方全体攻击提升15%，持续10秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.7 },
      { t: 'buff', stat: 'atk', pct: 0.15, dur: 10, tgt: 'allAllies' }
    ]},
    passive: { name: '奸雄之略', desc: '治世之能臣，乱世之奸雄：我方全体攻击+8%，自身暴击率+10%。', mods: { auraAtk: 0.08, crit: 0.10 } }
  },
  {
    id: 'simayi', name: '司马懿', title: '冢虎', faction: 'wei', cls: 'mage', rarity: 4,
    quote: '善败者不亡。',
    base: { hp: 2350, atk: 305, def: 118, spd: 0.9, crit: 0.05 },
    ult: { name: '鹰视狼顾', desc: '隐忍待机，一击致命：对全体敌军造成160%攻击伤害，并冰冻其中随机2人2秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.6 },
      { t: 'cc', kind: 'freeze', dur: 2, tgt: 'rand2' }
    ]},
    passive: { name: '忍略', desc: '十年磨剑，一朝亮剑：自身攻击+12%，受到伤害降低8%。', mods: { atk: 0.12, dmgReduce: 0.08 } }
  },
  {
    id: 'dianwei', name: '典韦', title: '古之恶来', faction: 'wei', cls: 'tank', rarity: 4,
    quote: '主公速行，典韦在此断后！',
    base: { hp: 4250, atk: 170, def: 262, spd: 0.88, crit: 0.05 },
    ult: { name: '恶来死战', desc: '宛城血战，双戟杀敌：对单体造成290%攻击伤害，并为自己生成攻击120%的护盾。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.9 },
      { t: 'shield', tgt: 'self', mult: 1.2 }
    ]},
    passive: { name: '逐虎过涧', desc: '单手擎旗，逐虎过涧：自身生命+15%，反弹12%所受伤害。', mods: { hp: 0.15, thorns: 0.12 } }
  },
  {
    id: 'guojia', name: '郭嘉', title: '鬼才', faction: 'wei', cls: 'mage', rarity: 3,
    quote: '兵贵神速。',
    base: { hp: 2280, atk: 288, def: 108, spd: 0.95, crit: 0.1 },
    ult: { name: '遗计定辽', desc: '身死犹留遗计，助主平辽：对随机2名敌军各造成200%攻击伤害，并使其中毒，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 2.0 },
      { t: 'dot', kind: 'poison', mult: 0.35, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '奇佐', desc: '十胜十败论，算无遗策：自身暴击率+12%，暴击伤害+30%。', mods: { crit: 0.12, critDmg: 0.3 } }
  },
  {
    id: 'zhangliao', name: '张辽', title: '止啼名将', faction: 'wei', cls: 'warrior', rarity: 4,
    quote: '威震逍遥津。',
    base: { hp: 2950, atk: 244, def: 164, spd: 1.05, crit: 0.08 },
    ult: { name: '威震逍遥', desc: '八百破十万，江东小儿不敢夜啼：对单体造成280%攻击伤害，若目标生命低于35%，伤害提升至1.8倍。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.8, execute: 0.35 }
    ]},
    passive: { name: '突袭', desc: '兵贵神速，一战破敌：自身攻击+10%，击杀敌人后额外获得20点怒气。', mods: { atk: 0.10, rageOnKill: 20 } }
  },
  {
    id: 'xuchu', name: '许褚', title: '虎痴', faction: 'wei', cls: 'tank', rarity: 3,
    quote: '虎侯在此！',
    base: { hp: 4300, atk: 150, def: 262, spd: 0.85, crit: 0.05 },
    ult: { name: '裸衣奋战', desc: '赤膊上阵，虎痴之勇：为自己生成相当于攻击180%的护盾，并削弱敌方前排防御20%，持续8秒。', effects: [
      { t: 'shield', tgt: 'self', mult: 1.8 },
      { t: 'debuff', stat: 'def', pct: 0.2, dur: 8, tgt: 'frontRow' }
    ]},
    passive: { name: '虎侯', desc: '力能扛鼎，倒曳牛尾：自身生命+15%，防御+12%。', mods: { hp: 0.15, def: 0.12 } }
  },
  {
    id: 'xunyu', name: '荀彧', title: '王佐之才', faction: 'wei', cls: 'support', rarity: 3,
    quote: '奉天子以令不臣。',
    base: { hp: 2500, atk: 220, def: 122, spd: 0.98, crit: 0.05 },
    ult: { name: '居中持重', desc: '坐镇后方，调度有方：治疗全体友军（攻击的140%），并使我方全体防御+12%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.4 },
      { t: 'buff', stat: 'def', pct: 0.12, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '王佐', desc: '迎奉天子，举贤任能：我方全体防御+5%，自身治疗效果+10%。', mods: { auraDef: 0.05, heal: 0.10 } }
  },
  {
    id: 'jiaxu', name: '贾诩', title: '毒士', faction: 'wei', cls: 'mage', rarity: 3,
    quote: '文和乱武，算无遗策。',
    base: { hp: 2260, atk: 294, def: 108, spd: 0.94, crit: 0.07 },
    ult: { name: '乱武', desc: '一计可乱天下：对全体敌军造成140%攻击伤害，并使其混乱（沉默），持续3秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.4 },
      { t: 'cc', kind: 'silence', dur: 3, tgt: 'allEnemies' }
    ]},
    passive: { name: '自保之道', desc: '阖门自守，智不招祸：自身受到伤害降低10%。', mods: { dmgReduce: 0.10 } }
  },
  {
    id: 'xiahoudun', name: '夏侯惇', title: '独目苍狼', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '父精母血，不可弃也！',
    base: { hp: 2760, atk: 208, def: 150, spd: 1.0, crit: 0.05 },
    ult: { name: '拔矢啖睛', desc: '矢贯左目，啖之再战：对单体造成220%攻击伤害并附加流血，持续5秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.2 },
      { t: 'dot', kind: 'bleed', mult: 0.3, dur: 5, tgt: 'single' }
    ]},
    passive: { name: '刚烈', desc: '刚烈勇猛，视死如归：自身攻击+8%，生命+8%。', mods: { atk: 0.08, hp: 0.08 } }
  },
  {
    id: 'xiahouyuan', name: '夏侯渊', title: '疾行虎步', faction: 'wei', cls: 'archer', rarity: 3,
    quote: '三日五百，六日一千！',
    base: { hp: 2340, atk: 288, def: 104, spd: 1.18, crit: 0.10 },
    ult: { name: '千里奔袭', desc: '典军校尉，行军神速：对生命最高的敌军连射3箭，每箭造成105%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'strongestEnemy', mult: 1.05, hits: 3 }
    ]},
    passive: { name: '虎步关右', desc: '平陇右，定汉中：自身攻速+10%，暴击率+8%。', mods: { spd: 0.10, crit: 0.08 } }
  },
  {
    id: 'caoren', name: '曹仁', title: '铁壁天将', faction: 'wei', cls: 'tank', rarity: 3,
    quote: '守城之固，仁之功也。',
    base: { hp: 4150, atk: 152, def: 258, spd: 0.86, crit: 0.05 },
    ult: { name: '铁壁坚守', desc: '守樊城，水淹不退：为自己生成攻击200%的护盾，并使我方全体防御+10%，持续8秒。', effects: [
      { t: 'shield', tgt: 'self', mult: 2.0 },
      { t: 'buff', stat: 'def', pct: 0.10, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '固若金汤', desc: '矢石交加，意气自若：自身生命+14%，受到伤害降低7%。', mods: { hp: 0.14, dmgReduce: 0.07 } }
  },
  {
    id: 'pangde', name: '庞德', title: '抬榇决死', faction: 'wei', cls: 'warrior', rarity: 3,
    quote: '吾受魏王厚恩，誓以死报！',
    base: { hp: 2760, atk: 230, def: 152, spd: 1.0, crit: 0.07 },
    ult: { name: '抬榇决死战', desc: '抬榇赴敌，不破关羽誓不还：对单体造成260%攻击伤害，并附加流血，持续5秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.6 },
      { t: 'dot', kind: 'bleed', mult: 0.3, dur: 5, tgt: 'single' }
    ]},
    passive: { name: '决死之志', desc: '白袍银铠，箭无虚发：自身攻击+12%，暴击率+6%。', mods: { atk: 0.12, crit: 0.06 } }
  },
  {
    id: 'zhenji', name: '甄姬', title: '洛神', faction: 'wei', cls: 'support', rarity: 3,
    quote: '翩若惊鸿，婉若游龙。',
    base: { hp: 2500, atk: 200, def: 122, spd: 1.0, crit: 0.05 },
    ult: { name: '洛水清波', desc: '洛水之神，泽被三军：治疗全体友军（攻击的160%）。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.6 }
    ]},
    passive: { name: '惠心', desc: '慈心惠质，抚慰将士：自身治疗效果+12%，生命+8%。', mods: { heal: 0.12, hp: 0.08 } }
  },
  {
    id: 'xuhuang', name: '徐晃', title: '长驱直入', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '长驱直入，破敌围解！',
    base: { hp: 2700, atk: 204, def: 144, spd: 1.0, crit: 0.06 },
    ult: { name: '长驱直入', desc: '破十重围，直捣敌后：对敌方后排造成220%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'backRow', mult: 2.2 }
    ]},
    passive: { name: '治军严整', desc: '周亚夫之风，令行禁止：自身攻击+7%，受到伤害降低6%。', mods: { atk: 0.07, dmgReduce: 0.06 } }
  },
  {
    id: 'zhanghe', name: '张郃', title: '巧变之将', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '郃识变数，善处营陈。',
    base: { hp: 2720, atk: 206, def: 146, spd: 1.02, crit: 0.06 },
    ult: { name: '巧变游斗', desc: '料地形，善巧变：对随机2名敌军各造成170%攻击伤害，并使自身攻击+12%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.7 },
      { t: 'buff', stat: 'atk', pct: 0.12, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '识变数', desc: '以巧变为称，量敌而进：自身攻速+8%。', mods: { spd: 0.08 } }
  },
  {
    id: 'yujin', name: '于禁', title: '毅重之将', faction: 'wei', cls: 'tank', rarity: 2,
    quote: '禁奉法守令，不苟一时。',
    base: { hp: 3820, atk: 150, def: 228, spd: 0.88, crit: 0.05 },
    ult: { name: '持重结营', desc: '最号毅重，整军经武：对敌方前排造成140%攻击伤害，并使我方全体防御+10%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.4 },
      { t: 'buff', stat: 'def', pct: 0.10, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '毅重', desc: '军法严明，威震军中：自身生命+10%。', mods: { hp: 0.10 } }
  },
  {
    id: 'yuejin', name: '乐进', title: '先登骁将', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '每战先登，骁果冠军！',
    base: { hp: 2680, atk: 212, def: 142, spd: 1.06, crit: 0.07 },
    ult: { name: '先登陷阵', desc: '容貌短小，胆烈过人：对单体造成235%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.35 }
    ]},
    passive: { name: '骁果', desc: '每战先登，摧坚陷阵：自身暴击率+9%。', mods: { crit: 0.09 } }
  },
  {
    id: 'caopi', name: '曹丕', title: '魏文帝', faction: 'wei', cls: 'mage', rarity: 2,
    quote: '文章经国之大业，不朽之盛事。',
    base: { hp: 2300, atk: 268, def: 110, spd: 0.95, crit: 0.06 },
    ult: { name: '受禅立威', desc: '代汉立魏，君临天下：对随机2名敌军各造成160%攻击伤害，并削弱其攻击12%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.6 },
      { t: 'debuff', stat: 'atk', pct: 0.12, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '文韬', desc: '八岁能文，下笔成章：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'caozhi', name: '曹植', title: '七步成诗', faction: 'wei', cls: 'support', rarity: 2,
    quote: '本自同根生，相煎何太急？',
    base: { hp: 2460, atk: 198, def: 118, spd: 1.0, crit: 0.05 },
    ult: { name: '七步成诗', desc: '才高八斗，出口成章：治疗生命最低的友军（攻击的210%），并为其附加攻击90%的护盾。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 2.1 },
      { t: 'shield', tgt: 'lowestAlly', mult: 0.9 }
    ]},
    passive: { name: '才高八斗', desc: '谢灵运云：天下才共一石，子建独得八斗：自身治疗效果+10%。', mods: { heal: 0.10 } }
  },
  {
    id: 'caohong', name: '曹洪', title: '舍马献主', faction: 'wei', cls: 'tank', rarity: 2,
    quote: '天下可无洪，不可无公！',
    base: { hp: 3860, atk: 148, def: 230, spd: 0.88, crit: 0.05 },
    ult: { name: '舍身护主', desc: '荥阳之战，让马救主：对敌方前排造成135%攻击伤害，并使自身受到伤害降低18%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.35 },
      { t: 'buff', stat: 'def', pct: 0.18, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '忠悫', desc: '家富而性俭，忠心护主：自身生命+10%。', mods: { hp: 0.10 } }
  },
  {
    id: 'guohuai', name: '郭淮', title: '方策精详', faction: 'wei', cls: 'archer', rarity: 2,
    quote: '淮策敌深入，料战不差。',
    base: { hp: 2320, atk: 274, def: 104, spd: 1.12, crit: 0.08 },
    ult: { name: '料敌设伏', desc: '深谋远虑，预判敌踪：对随机2名敌军各造成155%攻击伤害，并使其中毒，持续4秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.55 },
      { t: 'dot', kind: 'poison', mult: 0.2, dur: 4, tgt: 'rand2' }
    ]},
    passive: { name: '方策', desc: '方策精详，垂问秦雍：自身暴击率+8%。', mods: { crit: 0.08 } }
  },
  {
    id: 'wenpin', name: '文聘', title: '守御名将', faction: 'wei', cls: 'warrior', rarity: 2,
    quote: '聘愿守江夏，以拒吴军！',
    base: { hp: 2740, atk: 202, def: 150, spd: 0.98, crit: 0.06 },
    ult: { name: '御敌坚守', desc: '坚壁清野，守御有方：对敌方前排造成180%攻击伤害，并使自身防御+15%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.8 },
      { t: 'buff', stat: 'def', pct: 0.15, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '持重', desc: '在江夏数十年，威恩并施：自身生命+9%。', mods: { hp: 0.09 } }
  },
  {
    id: 'lidian', name: '李典', title: '儒雅之将', faction: 'wei', cls: 'archer', rarity: 2,
    quote: '典好学问，贵儒雅。',
    base: { hp: 2300, atk: 272, def: 104, spd: 1.1, crit: 0.07 },
    ult: { name: '儒将风仪', desc: '不与诸将争功，颇有长者之风：对随机2名敌军各造成150%攻击伤害，并治疗自身（攻击的100%）。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.5 },
      { t: 'heal', tgt: 'self', mult: 1.0 }
    ]},
    passive: { name: '长者之风', desc: '义忘私隙，国尔忘家：自身生命+7%，受到伤害降低5%。', mods: { hp: 0.07, dmgReduce: 0.05 } }
  },
  {
    id: 'haozhao', name: '郝昭', title: '陈仓守将', faction: 'wei', cls: 'tank', rarity: 2,
    quote: '昭守城，敌不能克！',
    base: { hp: 3900, atk: 146, def: 236, spd: 0.86, crit: 0.05 },
    ult: { name: '金城汤池', desc: '千余人守陈仓，拒诸葛数万：为自己生成攻击210%的护盾，并对敌方前排造成120%攻击伤害。', effects: [
      { t: 'shield', tgt: 'self', mult: 2.1 },
      { t: 'dmg', tgt: 'frontRow', mult: 1.2 }
    ]},
    passive: { name: '坚壁', desc: '深沟高垒，以待敌疲：自身生命+12%，反弹8%所受伤害。', mods: { hp: 0.12, thorns: 0.08 } }
  },
  {
    id: 'manchong', name: '满宠', title: '执法严明', faction: 'wei', cls: 'mage', rarity: 2,
    quote: '宠执法不避强御。',
    base: { hp: 2280, atk: 264, def: 108, spd: 0.95, crit: 0.06 },
    ult: { name: '严刑峻法', desc: '不避权贵，令行禁止：对随机2名敌军各造成150%攻击伤害，并削弱其防御12%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.5 },
      { t: 'debuff', stat: 'def', pct: 0.12, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '酷烈', desc: '断狱考究，一郡肃然：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'wanglang', name: '王朗', title: '皓首匹夫', faction: 'wei', cls: 'support', rarity: 1,
    quote: '天数有变，神器更易。',
    base: { hp: 2430, atk: 184, def: 116, spd: 0.96, crit: 0.05 },
    ult: { name: '巧言游说', desc: '凭三寸不烂之舌游说敌将：治疗全体友军（攻击的115%），并削弱敌方全体攻击8%，持续6秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.15 },
      { t: 'debuff', stat: 'atk', pct: 0.08, dur: 6, tgt: 'allEnemies' }
    ]},
    passive: { name: '经学', desc: '以经学进身，位至三公：自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'jianggan', name: '蒋干', title: '盗书说客', faction: 'wei', cls: 'support', rarity: 1,
    quote: '干到江东，必要说降周瑜！',
    base: { hp: 2400, atk: 180, def: 114, spd: 1.0, crit: 0.05 },
    ult: { name: '过江说降', desc: '自告奋勇渡江劝降：治疗生命最低的友军（攻击的180%）。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.8 }
    ]},
    passive: { name: '自荐', desc: '布衣葛巾，自请赴敌：自身生命+7%。', mods: { hp: 0.07 } }
  },
  {
    id: 'chengyu', name: '程昱', title: '胆略过人', faction: 'wei', cls: 'support', rarity: 1,
    quote: '昱有胆略，善处大事。',
    base: { hp: 2420, atk: 186, def: 115, spd: 0.98, crit: 0.05 },
    ult: { name: '运筹决胜', desc: '设伏截杀，算无遗策：治疗全体友军（攻击的118%），并使自身攻击+10%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.18 },
      { t: 'buff', stat: 'atk', pct: 0.10, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '胆略', desc: '匹夫之勇非真勇，昱之胆略在决断：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'liuye', name: '刘晔', title: '佐命之略', faction: 'wei', cls: 'mage', rarity: 1,
    quote: '晔之奇谋，每与计合。',
    base: { hp: 2230, atk: 238, def: 100, spd: 0.94, crit: 0.05 },
    ult: { name: '霹雳车计', desc: '献霹雳车以破高橹：对随机2名敌军各造成148%攻击伤害，并使其中毒，持续4秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.48 },
      { t: 'dot', kind: 'poison', mult: 0.2, dur: 4, tgt: 'rand2' }
    ]},
    passive: { name: '献图', desc: '献计献策，常中机要：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'simashi', name: '司马师', title: '废立之权', faction: 'wei', cls: 'warrior', rarity: 1,
    quote: '眼疾如裂，犹自运筹。',
    base: { hp: 2680, atk: 196, def: 142, spd: 1.0, crit: 0.05 },
    ult: { name: '废立之威', desc: '废黜天子，权倾朝野：对单体造成192%攻击伤害，并削弱其攻击10%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 1.92 },
      { t: 'debuff', stat: 'atk', pct: 0.10, dur: 6, tgt: 'single' }
    ]},
    passive: { name: '沉着', desc: '目瘤迸裂，咬牙忍痛：自身生命+8%。', mods: { hp: 0.08 } }
  },
  {
    id: 'simazhao', name: '司马昭', title: '司马之心', faction: 'wei', cls: 'mage', rarity: 1,
    quote: '司马昭之心，路人皆知。',
    base: { hp: 2250, atk: 240, def: 102, spd: 0.94, crit: 0.05 },
    ult: { name: '路人皆知', desc: '弑君夺权，篡魏在即：对随机2名敌军各造成146%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.46 }
    ]},
    passive: { name: '夺权', desc: '总揽朝政，代魏自立的野心路人皆知：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'caozhen', name: '曹真', title: '大将军', faction: 'wei', cls: 'tank', rarity: 1,
    quote: '真以亲旧之勤，夹辅王室。',
    base: { hp: 3800, atk: 142, def: 226, spd: 0.86, crit: 0.05 },
    ult: { name: '都督诸军', desc: '统帅大军，拒诸葛于祁山：对敌方前排造成135%攻击伤害，并使自身防御+15%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.35 },
      { t: 'buff', stat: 'def', pct: 0.15, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '夹辅', desc: '曹氏宗亲，国之柱石：自身生命+9%。', mods: { hp: 0.09 } }
  },
  {
    id: 'caimao', name: '蔡瑁', title: '水军都督', faction: 'wei', cls: 'archer', rarity: 1,
    quote: '瑁深谙水战之法。',
    base: { hp: 2240, atk: 236, def: 100, spd: 1.08, crit: 0.06 },
    ult: { name: '水师布阵', desc: '操练水军，排布战船：对随机2名敌军各造成142%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.42 }
    ]},
    passive: { name: '水战', desc: '荆州水师，皆出其手：自身攻速+7%。', mods: { spd: 0.07 } }
  },
  {
    id: 'huaxin', name: '华歆', title: '助纣为虐', faction: 'wei', cls: 'support', rarity: 1,
    quote: '歆奉魏王之命，入宫索玺。',
    base: { hp: 2390, atk: 178, def: 113, spd: 0.98, crit: 0.05 },
    ult: { name: '威逼宫闱', desc: '仗剑入宫，威慑臣下：治疗生命最低的友军（攻击的175%），并削弱单体防御10%，持续6秒。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.75 },
      { t: 'debuff', stat: 'def', pct: 0.10, dur: 6, tgt: 'single' }
    ]},
    passive: { name: '趋附', desc: '依附权势，步步高升：自身攻击+6%。', mods: { atk: 0.06 } }
  },
  {
    id: 'chendeng', name: '陈登', title: '湖上蛟龙', faction: 'wei', cls: 'support', rarity: 1,
    quote: '登阴合以图吕布。',
    base: { hp: 2400, atk: 182, def: 114, spd: 1.0, crit: 0.05 },
    ult: { name: '里应外合', desc: '暗中布局，内外呼应：治疗全体友军（攻击的116%）。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.16 }
    ]},
    passive: { name: '湖山之谋', desc: '有文武胆志，扶危济困：自身治疗效果+7%。', mods: { heal: 0.07 } }
  },
  // ================= 吴 =================
  {
    id: 'zhouyu', name: '周瑜', title: '美周郎', faction: 'wu', cls: 'mage', rarity: 4,
    quote: '谈笑间，樯橹灰飞烟灭。',
    base: { hp: 2220, atk: 325, def: 108, spd: 0.95, crit: 0.12 },
    ult: { name: '赤壁炎劫', desc: '万事俱备，只欠东风：对全体敌军造成200%攻击伤害并附加灼烧，持续6秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 2.0 },
      { t: 'dot', kind: 'burn', mult: 0.4, dur: 6, tgt: 'allEnemies' }
    ]},
    passive: { name: '儒将风流', desc: '曲有误，周郎顾：自身暴击率+12%，攻击+8%。', mods: { crit: 0.12, atk: 0.08 } }
  },
  {
    id: 'sunce', name: '孙策', title: '小霸王', faction: 'wu', cls: 'warrior', rarity: 4,
    quote: '以江东基业付弟，快意纵横天下！',
    base: { hp: 3000, atk: 262, def: 166, spd: 1.1, crit: 0.08 },
    ult: { name: '霸王卸甲', desc: '挟死一将喝死一将，如霸王再世：对单体造成280%攻击伤害，并削弱其防御25%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.8 },
      { t: 'debuff', stat: 'def', pct: 0.25, dur: 6, tgt: 'single' }
    ]},
    passive: { name: '江东小霸王', desc: '扫平江东六郡，所向披靡：自身攻击+12%，击杀敌人后额外获得15点怒气。', mods: { atk: 0.12, rageOnKill: 15 } }
  },
  {
    id: 'luxun', name: '陆逊', title: '儒生雄才', faction: 'wu', cls: 'mage', rarity: 4,
    quote: '书生亦可拜将。',
    base: { hp: 2260, atk: 312, def: 110, spd: 0.95, crit: 0.06 },
    ult: { name: '火烧连营', desc: '彝陵一把火，七百里连营化为灰烬：对敌方后排造成230%攻击伤害并附加灼烧，持续6秒。', effects: [
      { t: 'dmg', tgt: 'backRow', mult: 2.3 },
      { t: 'dot', kind: 'burn', mult: 0.35, dur: 6, tgt: 'backRow' }
    ]},
    passive: { name: '沉稳', desc: '忍辱负重，静待战机：自身受到伤害降低10%。', mods: { dmgReduce: 0.10 } }
  },
  {
    id: 'lvmeng', name: '吕蒙', title: '白衣渡江', faction: 'wu', cls: 'warrior', rarity: 3,
    quote: '士别三日，当刮目相看。',
    base: { hp: 2800, atk: 226, def: 148, spd: 1.05, crit: 0.06 },
    ult: { name: '白衣渡江', desc: '商船白衣，奇袭荆州：对敌方后排造成200%攻击伤害，并使自身攻击+15%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'backRow', mult: 2.0 },
      { t: 'buff', stat: 'atk', pct: 0.15, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '刮目相看', desc: '笃志力学，非复吴下阿蒙：自身攻击+10%。', mods: { atk: 0.10 } }
  },
  {
    id: 'ganning', name: '甘宁', title: '锦帆贼', faction: 'wu', cls: 'warrior', rarity: 3,
    quote: '百骑劫魏营。',
    base: { hp: 2880, atk: 236, def: 152, spd: 1.1, crit: 0.1 },
    ult: { name: '锦帆奇袭', desc: '百骑劫营，全身而退：对随机2名敌军各造成180%攻击伤害并使其流血，持续5秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.8 },
      { t: 'dot', kind: 'bleed', mult: 0.3, dur: 5, tgt: 'rand2' }
    ]},
    passive: { name: '游侠', desc: '少为锦帆贼，轻侠杀人：自身攻速+12%，并带有8%吸血。', mods: { spd: 0.12, vamp: 0.08 } }
  },
  {
    id: 'taishici', name: '太史慈', title: '信义笃烈', faction: 'wu', cls: 'archer', rarity: 3,
    quote: '大丈夫当带三尺剑，立不世之功！',
    base: { hp: 2300, atk: 286, def: 102, spd: 1.15, crit: 0.08 },
    ult: { name: '酣斗', desc: '神亭酣斗小霸王，不分胜负：对单体造成245%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.45 }
    ]},
    passive: { name: '神射', desc: '猿臂善射，弦不虚发：自身暴击率+8%。', mods: { crit: 0.08 } }
  },
  {
    id: 'sunshangxiang', name: '孙尚香', title: '弓腰姬', faction: 'wu', cls: 'archer', rarity: 2,
    quote: '巾帼不让须眉。',
    base: { hp: 2300, atk: 300, def: 106, spd: 1.16, crit: 0.1 },
    ult: { name: '枭姬连弩', desc: '房中兵器森然，婢女皆佩刀：对生命值最高的敌军连射3箭，每箭造成110%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'strongestEnemy', mult: 1.1, hits: 3 }
    ]},
    passive: { name: '枭姬', desc: '才捷刚猛，有诸兄之风：自身攻击+12%，攻速+8%。', mods: { atk: 0.12, spd: 0.08 } }
  },
  {
    id: 'sunjian', name: '孙坚', title: '江东猛虎', faction: 'wu', cls: 'warrior', rarity: 3,
    quote: '坚披坚执锐，当先破敌！',
    base: { hp: 2840, atk: 232, def: 154, spd: 1.06, crit: 0.07 },
    ult: { name: '猛虎破关', desc: '汜水关前率先破敌：对敌方前排造成210%攻击伤害，并使自身攻击+12%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.1 },
      { t: 'buff', stat: 'atk', pct: 0.12, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '猛虎', desc: '兵锋所指，勇冠三军：自身攻击+9%，生命+6%。', mods: { atk: 0.09, hp: 0.06 } }
  },
  {
    id: 'huanggai', name: '黄盖', title: '苦肉老将', faction: 'wu', cls: 'tank', rarity: 3,
    quote: '受吴王三世厚恩，虽肝脑涂地，亦无怨悔！',
    base: { hp: 4050, atk: 152, def: 248, spd: 0.86, crit: 0.05 },
    ult: { name: '火船突击', desc: '诈降曹操，火船直入曹营：对敌方前排造成185%攻击伤害并附加灼烧，持续5秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.85 },
      { t: 'dot', kind: 'burn', mult: 0.3, dur: 5, tgt: 'frontRow' }
    ]},
    passive: { name: '苦肉之计', desc: '周瑜打黄盖，一个愿打一个愿挨：自身生命+12%，反弹8%所受伤害。', mods: { hp: 0.12, thorns: 0.08 } }
  },
  {
    id: 'lusu', name: '鲁肃', title: '榻上策', faction: 'wu', cls: 'support', rarity: 3,
    quote: '汉室不可复兴，曹操不可卒除。',
    base: { hp: 2520, atk: 212, def: 122, spd: 0.98, crit: 0.05 },
    ult: { name: '榻上之策', desc: '为吴划鼎足之计：治疗全体友军（攻击的145%），并使我方全体攻击+10%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.45 },
      { t: 'buff', stat: 'atk', pct: 0.10, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '敦厚', desc: '家有两囷米，指一囷以赠周瑜：自身治疗效果+10%。', mods: { heal: 0.10 } }
  },
  {
    id: 'zhoutai', name: '周泰', title: '血战护主', faction: 'wu', cls: 'tank', rarity: 3,
    quote: '泰身被十二创，救主于危难。',
    base: { hp: 4100, atk: 150, def: 250, spd: 0.86, crit: 0.05 },
    ult: { name: '舍身蔽主', desc: '以身蔽主，疮痍遍体而救孙权：为自己生成攻击200%的护盾，并反击敌方前排130%攻击伤害。', effects: [
      { t: 'shield', tgt: 'self', mult: 2.0 },
      { t: 'dmg', tgt: 'frontRow', mult: 1.3 }
    ]},
    passive: { name: '金疮', desc: '皮肉粗砺，伤痛不侵：自身生命+13%，反弹9%所受伤害。', mods: { hp: 0.13, thorns: 0.09 } }
  },
  {
    id: 'daqiao', name: '大乔', title: '国色', faction: 'wu', cls: 'support', rarity: 2,
    quote: '曲有误，周郎顾。',
    base: { hp: 2520, atk: 198, def: 120, spd: 1.0, crit: 0.05 },
    ult: { name: '江东安抚', desc: '国色贤淑，安定军心：治疗生命最低的友军（攻击的240%），并为其附加攻击120%的护盾。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 2.4 },
      { t: 'shield', tgt: 'lowestAlly', mult: 1.2 }
    ]},
    passive: { name: '温婉', desc: '温良恭俭，泽被三军：自身治疗效果+10%，生命+10%。', mods: { heal: 0.10, hp: 0.10 } }
  },
  {
    id: 'xiaoqiao', name: '小乔', title: '倾城', faction: 'wu', cls: 'support', rarity: 2,
    quote: '东风不与周郎便，铜雀春深锁二乔。',
    base: { hp: 2450, atk: 192, def: 116, spd: 1.02, crit: 0.05 },
    ult: { name: '红袖添香', desc: '为夫君焚香助阵：治疗生命最低的友军（攻击的160%），并使我方全体获得25点怒气。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.6 },
      { t: 'energy', tgt: 'allAllies', amt: 25 }
    ]},
    passive: { name: '国色', desc: '江东二乔，闻名天下：自身治疗效果+12%，生命+6%。', mods: { heal: 0.12, hp: 0.06 } }
  },
  {
    id: 'chengpu', name: '程普', title: '三世老将', faction: 'wu', cls: 'tank', rarity: 2,
    quote: '普历事孙氏三世，德望素重。',
    base: { hp: 3840, atk: 148, def: 232, spd: 0.88, crit: 0.05 },
    ult: { name: '老将督军', desc: '德望素重，诸将皆服：对敌方前排造成145%攻击伤害，并使我方全体防御+9%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.45 },
      { t: 'buff', stat: 'def', pct: 0.09, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '德望', desc: '历事三世，功勋卓著：自身生命+9%。', mods: { hp: 0.09 } }
  },
  {
    id: 'handang', name: '韩当', title: '石城侯', faction: 'wu', cls: 'archer', rarity: 2,
    quote: '当便弓马，有膂力。',
    base: { hp: 2310, atk: 268, def: 104, spd: 1.12, crit: 0.07 },
    ult: { name: '骑射突袭', desc: '便弓马，善突袭：对随机2名敌军各造成152%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.52 }
    ]},
    passive: { name: '膂力', desc: '膂力过人，随军征伐：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'lingtong', name: '凌统', title: '国士之风', faction: 'wu', cls: 'warrior', rarity: 2,
    quote: '统不忘父仇，更念国事。',
    base: { hp: 2700, atk: 210, def: 146, spd: 1.04, crit: 0.07 },
    ult: { name: '血仇之击', desc: '为父报仇，力战甘宁：对单体造成228%攻击伤害，并使自身攻击+10%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.28 },
      { t: 'buff', stat: 'atk', pct: 0.10, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '国士', desc: '轻财重义，有国士之风：自身暴击率+8%。', mods: { crit: 0.08 } }
  },
  {
    id: 'dingfeng', name: '丁奉', title: '雪中奋刀', faction: 'wu', cls: 'warrior', rarity: 2,
    quote: '奉匹马单刀，雪中奋短兵！',
    base: { hp: 2680, atk: 214, def: 142, spd: 1.06, crit: 0.07 },
    ult: { name: '雪中奋短兵', desc: '大雪之中，短兵相接：对单体造成230%攻击伤害，并附加流血，持续4秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.3 },
      { t: 'dot', kind: 'bleed', mult: 0.25, dur: 4, tgt: 'single' }
    ]},
    passive: { name: '骁勇', desc: '累从征伐，战斗常冠军中：自身攻速+8%。', mods: { spd: 0.08 } }
  },
  {
    id: 'xusheng', name: '徐盛', title: '疑城退敌', faction: 'wu', cls: 'warrior', rarity: 2,
    quote: '盛建疑城，魏军自退。',
    base: { hp: 2660, atk: 206, def: 144, spd: 1.0, crit: 0.06 },
    ult: { name: '疑城之计', desc: '沿江建疑城，吓退曹丕：对敌方前排造成165%攻击伤害，并削弱其攻击10%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.65 },
      { t: 'debuff', stat: 'atk', pct: 0.10, dur: 6, tgt: 'frontRow' }
    ]},
    passive: { name: '临阵', desc: '以少御众，镇定自若：自身防御+8%。', mods: { def: 0.08 } }
  },
  {
    id: 'zhugejin', name: '诸葛瑾', title: '谨厚使者', faction: 'wu', cls: 'support', rarity: 2,
    quote: '瑾以弘雅之量，处吴蜀之间。',
    base: { hp: 2460, atk: 196, def: 118, spd: 1.0, crit: 0.05 },
    ult: { name: '折冲樽俎', desc: '外交斡旋，不辱使命：治疗全体友军（攻击的130%），并使我方全体防御+8%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.3 },
      { t: 'buff', stat: 'def', pct: 0.08, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '弘雅', desc: '弘雅慎重，孙权敬重：自身治疗效果+9%。', mods: { heal: 0.09 } }
  },
  {
    id: 'panzhang', name: '潘璋', title: '擒龙都尉', faction: 'wu', cls: 'warrior', rarity: 2,
    quote: '璋部下司马马忠擒得关羽。',
    base: { hp: 2690, atk: 208, def: 145, spd: 1.02, crit: 0.06 },
    ult: { name: '设伏擒龙', desc: '临沮设伏，擒获武圣：对生命最低的敌军造成225%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'lowestEnemy', mult: 2.25 }
    ]},
    passive: { name: '截击', desc: '善于设伏，断敌退路：自身暴击率+8%。', mods: { crit: 0.08 } }
  },
  {
    id: 'zhangzhao', name: '张昭', title: '内事之托', faction: 'wu', cls: 'support', rarity: 2,
    quote: '内事不决问张昭。',
    base: { hp: 2440, atk: 190, def: 117, spd: 0.98, crit: 0.05 },
    ult: { name: '安邦定国', desc: '辅佐内政，安定江东：治疗全体友军（攻击的126%），并使自身治疗效果提升，攻击+8%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.26 },
      { t: 'buff', stat: 'atk', pct: 0.08, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '谋主', desc: '孙策之托，内事之决：自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'kanze', name: '阚泽', title: '献书之士', faction: 'wu', cls: 'support', rarity: 1,
    quote: '泽胆气壮，献诈降书。',
    base: { hp: 2390, atk: 180, def: 113, spd: 1.0, crit: 0.05 },
    ult: { name: '密献降书', desc: '过江献书，面不改色：治疗生命最低的友军（攻击的172%）。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.72 }
    ]},
    passive: { name: '胆气', desc: '处变不惊，口若悬河：自身生命+7%。', mods: { hp: 0.07 } }
  },
  {
    id: 'lvfan', name: '吕范', title: '持节都督', faction: 'wu', cls: 'support', rarity: 1,
    quote: '范守典纪，知人善任。',
    base: { hp: 2380, atk: 178, def: 112, spd: 1.0, crit: 0.05 },
    ult: { name: '整肃军纪', desc: '严明军纪，井然有序：治疗全体友军（攻击的114%）。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.14 }
    ]},
    passive: { name: '守典', desc: '性好威仪，勤事奉法：自身防御+7%。', mods: { def: 0.07 } }
  },
  {
    id: 'yufan', name: '虞翻', title: '直言狂士', faction: 'wu', cls: 'mage', rarity: 1,
    quote: '翻直言忤旨，谪居交州。',
    base: { hp: 2220, atk: 236, def: 100, spd: 0.95, crit: 0.05 },
    ult: { name: '直言折冲', desc: '一言可退敌兵：对随机2名敌军各造成140%攻击伤害，并削弱其攻击8%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.4 },
      { t: 'debuff', stat: 'atk', pct: 0.08, dur: 6, tgt: 'rand2' }
    ]},
    passive: { name: '忠直', desc: '直言敢谏，忠言逆耳：自身攻击+6%。', mods: { atk: 0.06 } }
  },
  {
    id: 'buzhi', name: '步骘', title: '交州牧', faction: 'wu', cls: 'support', rarity: 1,
    quote: '骘宽弘得众，威震交州。',
    base: { hp: 2370, atk: 176, def: 112, spd: 0.98, crit: 0.05 },
    ult: { name: '镇抚之略', desc: '平定交州，抚绥有方：治疗全体友军（攻击的112%），并使自身生命+8%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.12 },
      { t: 'buff', stat: 'def', pct: 0.08, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '宽弘', desc: '宽宏大量，海纳百川：自身生命+6%。', mods: { hp: 0.06 } }
  },
  {
    id: 'xuezong', name: '薛综', title: '儒林才士', faction: 'wu', cls: 'support', rarity: 1,
    quote: '综依章句而谏，词义灿然。',
    base: { hp: 2360, atk: 174, def: 111, spd: 1.0, crit: 0.05 },
    ult: { name: '引经据典', desc: '援引古义，驳倒来使：治疗全体友军（攻击的112%）。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.12 }
    ]},
    passive: { name: '文章', desc: '依章句而作赋，才思敏捷：自身治疗效果+6%。', mods: { heal: 0.06 } }
  },
  {
    id: 'zhuran', name: '朱然', title: '临川太守', faction: 'wu', cls: 'warrior', rarity: 1,
    quote: '然守江陵，名震敌国。',
    base: { hp: 2620, atk: 192, def: 136, spd: 1.0, crit: 0.05 },
    ult: { name: '固守城垣', desc: '坚守孤城，名震敌国：对单体造成185%攻击伤害，并使自身防御+10%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 1.85 },
      { t: 'buff', stat: 'def', pct: 0.10, dur: 8, tgt: 'self' }
    ]},
    passive: { name: '胆守', desc: '遇敌能守，临危不乱：自身生命+7%。', mods: { hp: 0.07 } }
  },
  // ================= 群 =================
  {
    id: 'lvbu', name: '吕布', title: '飞将', faction: 'qun', cls: 'warrior', rarity: 4,
    quote: '人中吕布，马中赤兔！',
    base: { hp: 3200, atk: 268, def: 175, spd: 1.08, crit: 0.1 },
    ult: { name: '方天画戟', desc: '辕门射戟，虎牢无双：对单体造成320%攻击伤害并眩晕2秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 3.2 },
      { t: 'cc', kind: 'stun', dur: 2, tgt: 'single' }
    ]},
    passive: { name: '无双', desc: '三英战吕布，全身而退：自身攻击+18%，并带有10%吸血。', mods: { atk: 0.18, vamp: 0.10 } }
  },
  {
    id: 'diaochan', name: '貂蝉', title: '闭月', faction: 'qun', cls: 'support', rarity: 4,
    quote: '一舞倾城，再舞倾国。',
    base: { hp: 2450, atk: 226, def: 118, spd: 1.02, crit: 0.05 },
    ult: { name: '倾国倾城', desc: '连环计中枢，一舞乱心神：对全体敌军造成140%攻击伤害，并削弱其攻击20%，持续8秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.4 },
      { t: 'debuff', stat: 'atk', pct: 0.2, dur: 8, tgt: 'allEnemies' }
    ]},
    passive: { name: '惊鸿舞', desc: '歌舞倾城，乱敌军心：我方全体攻速+6%，自身生命+8%。', mods: { auraSpd: 0.06, hp: 0.08 } }
  },
  {
    id: 'dongzhuo', name: '董卓', title: '魔王', faction: 'qun', cls: 'tank', rarity: 4,
    quote: '吾为天下计，岂惜小民哉！',
    base: { hp: 4550, atk: 145, def: 258, spd: 0.82, crit: 0.05 },
    ult: { name: '酒池烈焰', desc: '郿坞醉生梦死，暴行震世：为自己生成攻击220%的护盾，并对敌方前排造成120%攻击伤害。', effects: [
      { t: 'shield', tgt: 'self', mult: 2.2 },
      { t: 'dmg', tgt: 'frontRow', mult: 1.2 }
    ]},
    passive: { name: '暴虐', desc: '倒行逆施，恶贯满盈：自身生命+20%，反弹10%所受伤害。', mods: { hp: 0.20, thorns: 0.10 } }
  },
  {
    id: 'huatuo', name: '华佗', title: '神医', faction: 'qun', cls: 'support', rarity: 3,
    quote: '对症下药，药到病除。',
    base: { hp: 2580, atk: 214, def: 126, spd: 1.0, crit: 0.05 },
    ult: { name: '青囊济世', desc: '青囊书传世，刮骨可疗毒：治疗全体友军（攻击的190%），并附加持续回复，每秒回复攻击的30%，持续5秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.9 },
      { t: 'hot', tgt: 'allAllies', mult: 0.3, dur: 5 }
    ]},
    passive: { name: '妙手回春', desc: '医术通神，起死回生：自身治疗效果+15%。', mods: { heal: 0.15 } }
  },
  {
    id: 'yuanshao', name: '袁绍', title: '四世三公', faction: 'qun', cls: 'mage', rarity: 3,
    quote: '吾南据河，北阻燕代，争天下可也。',
    base: { hp: 2380, atk: 278, def: 115, spd: 0.94, crit: 0.05 },
    ult: { name: '盟主号令', desc: '十八路诸侯会盟，共同讨董：使我方全体攻击+18%，持续8秒，并对全体敌军造成110%攻击伤害。', effects: [
      { t: 'buff', stat: 'atk', pct: 0.18, dur: 8, tgt: 'allAllies' },
      { t: 'dmg', tgt: 'allEnemies', mult: 1.1 }
    ]},
    passive: { name: '四世三公', desc: '门生故吏遍天下：自身生命+10%，我方全体攻击+5%。', mods: { hp: 0.10, auraAtk: 0.05 } }
  },
  {
    id: 'zhangjiao', name: '张角', title: '大贤良师', faction: 'qun', cls: 'mage', rarity: 2,
    quote: '苍天已死，黄天当立！',
    base: { hp: 2180, atk: 262, def: 102, spd: 0.92, crit: 0.05 },
    ult: { name: '黄天符咒', desc: '呼风唤雨，符水济人：对随机2名敌军各造成160%攻击伤害并使其中毒，持续5秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.6 },
      { t: 'dot', kind: 'poison', mult: 0.3, dur: 5, tgt: 'rand2' }
    ]},
    passive: { name: '符水济人', desc: '以符水咒说疗病，徒众数十万：自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'menghuo', name: '孟获', title: '南蛮王', faction: 'qun', cls: 'tank', rarity: 2,
    quote: '七纵七擒，吾方知天威！',
    base: { hp: 4300, atk: 148, def: 252, spd: 0.84, crit: 0.05 },
    ult: { name: '蛮王冲阵', desc: '象兵蛮军，势不可当：对敌方前排造成190%攻击伤害，并为自己生成攻击100%的护盾。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 1.9 },
      { t: 'shield', tgt: 'self', mult: 1.0 }
    ]},
    passive: { name: '南蛮不屈', desc: '屡败屡战，终得心服：自身生命+16%，反弹10%所受伤害。', mods: { hp: 0.16, thorns: 0.10 } }
  },
  {
    id: 'zhurong', name: '祝融', title: '火神后裔', faction: 'qun', cls: 'archer', rarity: 3,
    quote: '妾乃火神祝融氏之后，飞刀百发百中！',
    base: { hp: 2340, atk: 284, def: 104, spd: 1.14, crit: 0.09 },
    ult: { name: '飞刀夺命', desc: '捻枪飞刀，百发百中：对随机2名敌军各造成170%攻击伤害，并附加灼烧，持续4秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.7 },
      { t: 'dot', kind: 'burn', mult: 0.25, dur: 4, tgt: 'rand2' }
    ]},
    passive: { name: '蛮族女王', desc: '南蛮第一女将：自身攻击+10%，生命+6%。', mods: { atk: 0.10, hp: 0.06 } }
  },
  {
    id: 'chengong', name: '陈宫', title: '忠谋之士', faction: 'qun', cls: 'mage', rarity: 3,
    quote: '今日之事，乃宫之罪也。',
    base: { hp: 2270, atk: 290, def: 106, spd: 0.96, crit: 0.06 },
    ult: { name: '明策破敌', desc: '献计献策，算无遗策：对单体造成220%攻击伤害，并削弱其防御15%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.2 },
      { t: 'debuff', stat: 'def', pct: 0.15, dur: 6, tgt: 'single' }
    ]},
    passive: { name: '捉放之义', desc: '弃官相随，义字当头：自身攻击+8%，暴击率+6%。', mods: { atk: 0.08, crit: 0.06 } }
  },
  {
    id: 'liru', name: '李儒', title: '鸩毒谋士', faction: 'qun', cls: 'mage', rarity: 3,
    quote: '毒酒一杯，了断废立之事。',
    base: { hp: 2250, atk: 286, def: 104, spd: 0.95, crit: 0.06 },
    ult: { name: '鸩酒之计', desc: '以鸩酒鸩杀少帝：对全体敌军造成130%攻击伤害，并使全体中毒，持续5秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.3 },
      { t: 'dot', kind: 'poison', mult: 0.3, dur: 5, tgt: 'allEnemies' }
    ]},
    passive: { name: '酷谋', desc: '为董卓谋主，算计狠辣：自身攻击+9%，受到伤害降低5%。', mods: { atk: 0.09, dmgReduce: 0.05 } }
  },
  {
    id: 'yanliang', name: '颜良', title: '河北名将', faction: 'qun', cls: 'warrior', rarity: 2,
    quote: '吾有万夫不当之勇！',
    base: { hp: 2720, atk: 212, def: 146, spd: 0.98, crit: 0.05 },
    ult: { name: '雷霆一刀', desc: '河北第一猛将，连斩宋宪魏续：对单体造成215%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.15 }
    ]},
    passive: { name: '河北骁勇', desc: '袁绍麾下头号猛将：自身生命+10%。', mods: { hp: 0.10 } }
  },
  {
    id: 'wenchou', name: '文丑', title: '河北双雄', faction: 'qun', cls: 'warrior', rarity: 2,
    quote: '河北文丑，来取你首级！',
    base: { hp: 2700, atk: 214, def: 144, spd: 0.98, crit: 0.05 },
    ult: { name: '盘河突骑', desc: '界桥之战，大破白马：对随机2名敌军各造成185%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.85 }
    ]},
    passive: { name: '双雄', desc: '与颜良并称河北双雄：自身攻击+10%。', mods: { atk: 0.10 } }
  },
  {
    id: 'gaoshun', name: '高顺', title: '陷阵营', faction: 'qun', cls: 'tank', rarity: 2,
    quote: '陷阵之志，有死无生！',
    base: { hp: 3900, atk: 150, def: 238, spd: 0.88, crit: 0.05 },
    ult: { name: '陷阵冲锋', desc: '七百陷阵营，攻无不克：对敌方前排造成200%攻击伤害，并为自己生成攻击80%的护盾。', effects: [
      { t: 'dmg', tgt: 'frontRow', mult: 2.0 },
      { t: 'shield', tgt: 'self', mult: 0.8 }
    ]},
    passive: { name: '陷阵之志', desc: '每所攻击，无不破者：自身生命+10%，受到伤害降低7%。', mods: { hp: 0.10, dmgReduce: 0.07 } }
  },
  {
    id: 'huaxiong', name: '华雄', title: '都督骁将', faction: 'qun', cls: 'warrior', rarity: 2,
    quote: '斩将搴旗，威震虎牢。',
    base: { hp: 2720, atk: 206, def: 150, spd: 1.0, crit: 0.05 },
    ult: { name: '悍勇斩', desc: '汜水关前连斩数将，诸侯莫敢当：对单体造成210%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.1 }
    ]},
    passive: { name: '骁勇', desc: '身长九尺，虎体狼腰：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'jiling', name: '纪灵', title: '三尖刀将', faction: 'qun', cls: 'warrior', rarity: 2,
    quote: '吾乃纪灵，五十斤三尖刀取汝首级！',
    base: { hp: 2700, atk: 208, def: 146, spd: 1.0, crit: 0.05 },
    ult: { name: '三尖刀势', desc: '五十斤三尖两刃刀，重斩敌将：对单体造成218%攻击伤害，并附加流血，持续4秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.18 },
      { t: 'dot', kind: 'bleed', mult: 0.2, dur: 4, tgt: 'single' }
    ]},
    passive: { name: '淮南骁将', desc: '袁术麾下第一大将：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'zuoci', name: '左慈', title: '乌角先生', faction: 'qun', cls: 'mage', rarity: 2,
    quote: '掷杯戏曹操，鹤发童颜仙。',
    base: { hp: 2200, atk: 258, def: 100, spd: 0.96, crit: 0.06 },
    ult: { name: '掷杯化鹤', desc: '掷杯于空，化鹤飞去：对全体敌军造成125%攻击伤害，并使其沉默，持续2.5秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.25 },
      { t: 'cc', kind: 'silence', dur: 2.5, tgt: 'allEnemies' }
    ]},
    passive: { name: '仙风道骨', desc: '遁甲奇书，仙术傍身：自身受到伤害降低8%，怒气获取提升15%。', mods: { dmgReduce: 0.08, energyGain: 0.15 } }
  },
  {
    id: 'yuji', name: '于吉', title: '太平道人', faction: 'qun', cls: 'mage', rarity: 2,
    quote: '贫道祈雨救民，何罪之有？',
    base: { hp: 2190, atk: 256, def: 100, spd: 0.95, crit: 0.05 },
    ult: { name: '咒杀之术', desc: '怒杀小霸王的诅咒之力：对单体造成230%攻击伤害，并使其中毒，持续5秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.3 },
      { t: 'dot', kind: 'poison', mult: 0.3, dur: 5, tgt: 'single' }
    ]},
    passive: { name: '符水', desc: '修道符水，普济众生：自身治疗效果+10%。', mods: { heal: 0.10 } }
  },
  {
    id: 'caiwenji', name: '蔡文姬', title: '胡笳才女', faction: 'qun', cls: 'support', rarity: 2,
    quote: '胡笳十八拍，声声诉离殇。',
    base: { hp: 2440, atk: 190, def: 116, spd: 1.02, crit: 0.05 },
    ult: { name: '胡笳十八拍', desc: '笳声绕梁，抚慰三军：治疗全体友军（攻击的135%），并使我方全体获得20点怒气。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.35 },
      { t: 'energy', tgt: 'allAllies', amt: 20 }
    ]},
    passive: { name: '博学', desc: '博学多才，音律通神：自身治疗效果+10%。', mods: { heal: 0.10 } }
  },
  {
    id: 'yuanshu', name: '袁术', title: '僭越称帝', faction: 'qun', cls: 'mage', rarity: 1,
    quote: '袁氏四世三公，百姓所归，吾应天顺人！',
    base: { hp: 2240, atk: 238, def: 102, spd: 0.94, crit: 0.05 },
    ult: { name: '称帝儆天', desc: '僭越称帝，众叛亲离：对全体敌军造成120%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.2 }
    ]},
    passive: { name: '冢中枯骨', desc: '骄奢淫逸，终成枯骨：自身攻击+6%，生命+6%。', mods: { atk: 0.06, hp: 0.06 } }
  },
  {
    id: 'liubiao', name: '刘表', title: '荆襄之主', faction: 'qun', cls: 'support', rarity: 1,
    quote: '表坐拥荆州，观望天下。',
    base: { hp: 2430, atk: 180, def: 115, spd: 0.98, crit: 0.05 },
    ult: { name: '坐观成败', desc: '拥兵自重，静观其变：治疗全体友军（攻击的120%），并为自己生成攻击80%的护盾。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.2 },
      { t: 'shield', tgt: 'self', mult: 0.8 }
    ]},
    passive: { name: '八骏', desc: '名列江夏八俊：自身生命+8%。', mods: { hp: 0.08 } }
  },
  {
    id: 'liuzhang', name: '刘璋', title: '益州牧', faction: 'qun', cls: 'support', rarity: 1,
    quote: '璋暗弱，守成而已。',
    base: { hp: 2420, atk: 176, def: 114, spd: 1.0, crit: 0.05 },
    ult: { name: '开仓抚民', desc: '开仓济民，恩泽西川：治疗生命最低的友军（攻击的180%）。', effects: [
      { t: 'heal', tgt: 'lowestAlly', mult: 1.8 }
    ]},
    passive: { name: '守成', desc: '据险守益州，不思进取：自身生命+8%。', mods: { hp: 0.08 } }
  },
  {
    id: 'gongsunzan', name: '公孙瓒', title: '白马将军', faction: 'qun', cls: 'archer', rarity: 1,
    quote: '白马义从，天下骑射无双！',
    base: { hp: 2270, atk: 240, def: 100, spd: 1.12, crit: 0.07 },
    ult: { name: '白马义从', desc: '白马义从，突骑破阵：对随机2名敌军各造成150%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.5 }
    ]},
    passive: { name: '骑射', desc: '善骑射，纵马北疆：自身攻速+9%。', mods: { spd: 0.09 } }
  },
  {
    id: 'taoqian', name: '陶谦', title: '三让徐州', faction: 'qun', cls: 'support', rarity: 1,
    quote: '谦三让徐州，唯贤是付。',
    base: { hp: 2400, atk: 176, def: 113, spd: 1.0, crit: 0.05 },
    ult: { name: '让贤安民', desc: '让徐州于刘备，保全百姓：治疗全体友军（攻击的118%），并使我方全体防御+8%，持续8秒。', effects: [
      { t: 'heal', tgt: 'allAllies', mult: 1.18 },
      { t: 'buff', stat: 'def', pct: 0.08, dur: 8, tgt: 'allAllies' }
    ]},
    passive: { name: '恭让', desc: '温厚恭让，得民之心：自身治疗效果+8%。', mods: { heal: 0.08 } }
  },
  {
    id: 'wangyun', name: '王允', title: '连环司徒', faction: 'qun', cls: 'mage', rarity: 1,
    quote: '连环计成，董贼授首！',
    base: { hp: 2230, atk: 236, def: 100, spd: 0.95, crit: 0.05 },
    ult: { name: '连环巧计', desc: '以貂蝉为引，离间董吕：对单体造成205%攻击伤害，并削弱其攻击12%，持续6秒。', effects: [
      { t: 'dmg', tgt: 'single', mult: 2.05 },
      { t: 'debuff', stat: 'atk', pct: 0.12, dur: 6, tgt: 'single' }
    ]},
    passive: { name: '除贼安汉', desc: '巧计诛董卓，匡扶汉室：自身攻击+7%。', mods: { atk: 0.07 } }
  },
  {
    id: 'yangxiu', name: '杨修', title: '恃才放旷', faction: 'qun', cls: 'mage', rarity: 1,
    quote: '鸡肋者，食之无味，弃之可惜。',
    base: { hp: 2210, atk: 242, def: 98, spd: 0.96, crit: 0.06 },
    ult: { name: '点破心机', desc: '一眼看破曹丞相心思：对随机2名敌军各造成145%攻击伤害。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.45 }
    ]},
    passive: { name: '恃才', desc: '才思敏捷，锋芒毕露：自身暴击率+9%。', mods: { crit: 0.09 } }
  },
  {
    id: 'xuyou', name: '许攸', title: '乌巢献策', faction: 'qun', cls: 'mage', rarity: 1,
    quote: '阿瞒，汝不得我，安能入此门耶？',
    base: { hp: 2220, atk: 240, def: 99, spd: 0.96, crit: 0.05 },
    ult: { name: '乌巢火计', desc: '献火烧乌巢之计，曹军夜袭：对全体敌军造成115%攻击伤害，并附加灼烧，持续4秒。', effects: [
      { t: 'dmg', tgt: 'allEnemies', mult: 1.15 },
      { t: 'dot', kind: 'burn', mult: 0.2, dur: 4, tgt: 'allEnemies' }
    ]},
    passive: { name: '贪功', desc: '恃功自傲，招祸之因：自身攻击+8%。', mods: { atk: 0.08 } }
  },
  {
    id: 'zhangsong', name: '张松', title: '献图之士', faction: 'shu', cls: 'mage', rarity: 1,
    quote: '松暗绘西川地理图，献于明公。',
    base: { hp: 2200, atk: 238, def: 98, spd: 0.96, crit: 0.05 },
    ult: { name: '暗献地图', desc: '过目不忘，暗献西川：对随机2名敌军各造成144%攻击伤害，并使其中毒，持续4秒。', effects: [
      { t: 'dmg', tgt: 'rand2', mult: 1.44 },
      { t: 'dot', kind: 'poison', mult: 0.2, dur: 4, tgt: 'rand2' }
    ]},
    passive: { name: '过目不忘', desc: '一览成诵，倒背如流：自身攻击+7%。', mods: { atk: 0.07 } }
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
