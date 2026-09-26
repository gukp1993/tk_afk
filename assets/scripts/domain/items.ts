// @ts-nocheck
// Generated from utils/items.js by scripts/cocos-sync-domain.js. Do not edit here.

// 军械图鉴、商店、每日任务定义
// 下方 EQUIP_* 保留为v1旧档格式转换表；新玩法只使用 ARMORY_* 图鉴配置。
// 装备槽：weapon 兵刃(atk) armor 铠甲(hp) helm 头盔(def) boots 战靴(hp+atk小)
const EQUIP_SLOTS = {
  weapon: { key: 'weapon', name: '兵刃', icon: '⚔', stat: 'atk' },
  armor:  { key: 'armor',  name: '铠甲', icon: '🛡', stat: 'hp' },
  helm:   { key: 'helm',   name: '头盔', icon: '⛑', stat: 'def' },
  boots:  { key: 'boots',  name: '战靴', icon: '👟', stat: 'hp2' }
};

// 全军共用军械图鉴。品质 q: 0=N, 1=R, 2=SR, 3=SSR。
const ARMORY_SLOTS = [
  { id: 'weapon', name: '兵刃', stat: 'atk' }, { id: 'armor', name: '铠甲', stat: 'hp' },
  { id: 'helm', name: '头盔', stat: 'def' }, { id: 'boots', name: '战靴', stat: 'mixed' },
  { id: 'jade', name: '玉佩', stat: 'hp' }, { id: 'seal', name: '兵符', stat: 'atk' }
];
const GRADES = [
  { q: 0, name: '凡铁', short: 'N', color: '#c8ccd4', unlockStage: 0, cost: 0, duplicate: 10 },
  { q: 1, name: '精钢', short: 'R', color: '#6f9fe8', unlockStage: 10, cost: 100, duplicate: 25 },
  { q: 2, name: '百炼', short: 'SR', color: '#b07fe0', unlockStage: 30, cost: 300, duplicate: 75 },
  { q: 3, name: '名器', short: 'SSR', color: '#f0a83e', unlockStage: 60, cost: 900, duplicate: 225 }
];
const CATALOG = [
  ['weapon_n','weapon',0,'练兵短刀',{atk:0.02}], ['weapon_r','weapon',1,'精钢长刀',{atk:0.04}], ['weapon_sr','weapon',2,'百炼战刃',{atk:0.06}],
  ['weapon_ssr_a','weapon',3,'破阵长锋',{atk:0.08}], ['weapon_ssr_b','weapon',3,'护军重剑',{atk:0.06,hp:0.02}],
  ['armor_n','armor',0,'练兵布甲',{hp:0.02}], ['armor_r','armor',1,'精钢锁甲',{hp:0.04}], ['armor_sr','armor',2,'百炼战铠',{hp:0.06}],
  ['armor_ssr_a','armor',3,'虎贲重铠',{hp:0.08}], ['armor_ssr_b','armor',3,'磐山铁甲',{hp:0.06,def:0.04}],
  ['helm_n','helm',0,'练兵皮盔',{def:0.02}], ['helm_r','helm',1,'精钢战盔',{def:0.04}], ['helm_sr','helm',2,'百炼兜鍪',{def:0.06}],
  ['helm_ssr_a','helm',3,'镇岳重盔',{def:0.08}], ['helm_ssr_b','helm',3,'守义战冠',{def:0.06,hp:0.02}],
  ['boots_n','boots',0,'练兵布履',{hp:0.01,atk:0.01}], ['boots_r','boots',1,'精钢战靴',{hp:0.02,atk:0.02}], ['boots_sr','boots',2,'百炼行靴',{hp:0.03,atk:0.03}],
  ['boots_ssr_a','boots',3,'逐锋战履',{hp:0.04,atk:0.04}], ['boots_ssr_b','boots',3,'固阵重靴',{hp:0.06,atk:0.02}],
  ['jade_n','jade',0,'平安木佩',{hp:0.01}], ['jade_r','jade',1,'青纹玉佩',{hp:0.02}], ['jade_sr','jade',2,'温润玉璧',{hp:0.03}],
  ['jade_ssr_a','jade',3,'济世青玉',{hp:0.04,effect:'heal'}], ['jade_ssr_b','jade',3,'守心玄玉',{hp:0.04,effect:'shield'}],
  ['seal_n','seal',0,'行军木符',{atk:0.01}], ['seal_r','seal',1,'青铜兵符',{atk:0.02}], ['seal_sr','seal',2,'虎纹兵符',{atk:0.03}],
  ['seal_ssr_a','seal',3,'锐进兵符',{atk:0.04,effect:'energy'}], ['seal_ssr_b','seal',3,'磐石兵符',{atk:0.04,effect:'reduction'}]
].map(([id,slot,q,name,stats]) => {
  const effect = stats.effect || null;
  const basePct = Object.assign({}, stats); delete basePct.effect;
  return { id,slot,q,name,stats:basePct,basePct,effect };
});
const STAR_NEEDS = [60,120,240,480,960];
const STAR_GOLD = [2000,4000,8000,16000,32000];
const DROP_QUALITY_WEIGHTS = [50,30,15,5];

// 品质：maxStar 为星级上限（对标 AFK 稀有度越高星上限越高）；base 为 0 星基础属性
const EQUIP_QUALITIES = {
  1: { key: 1, name: 'N',  label: '凡铁', color: '#aab4c0', maxStar: 1, base: { atk: 42,   hp: 300,  def: 24 } },
  2: { key: 2, name: 'R',  label: '精钢', color: '#5f9fe8', maxStar: 3, base: { atk: 150,  hp: 1150, def: 85 } },
  3: { key: 3, name: 'SR', label: '百炼', color: '#b57ce8', maxStar: 4, base: { atk: 500,  hp: 4000, def: 300 } },
  4: { key: 4, name: 'SSR', label: '神兵', color: '#f0913c', maxStar: 5, base: { atk: 1150, hp: 9400, def: 690 } }
};
const MAX_STAR = 5;
const STAR_PCT = 0.10;          // 每星属性 +10%，满星 1.5 倍（对标 AFK 强化满 1.5x）
const FACTION_MATCH_MULT = 1.3; // 阵营匹配 +30%（对标 AFK 对属加成）
const FACTIONED_MIN_Q = 3;      // SR 及以上掉落自带阵营

// 升到下一星所需强化点（品质 → 下标=当前星数）
const STAR_POINTS = {
  1: [60],
  2: [80, 200, 450],
  3: [200, 500, 1050, 2000],
  4: [500, 1150, 2300, 4200, 7500]
};
const GOLD_PER_POINT = 40; // 每点强化点的铜钱开销
// 被吃装备提供的基础强化点（自带星数按半星折算，见 fodderPoints）
const FODDER_POINTS = { 1: 10, 2: 26, 3: 70, 4: 190 };

function starNeed(q, stars) {
  const row = STAR_POINTS[q];
  return row ? row[stars] : undefined;
}
function starGold(need) { return need * GOLD_PER_POINT; }
function fodderPoints(e) {
  return Math.floor((FODDER_POINTS[e.q] || 0) * (1 + 0.5 * (e.stars || 0)));
}

// 品质 × 槽位 × 星级（×阵营匹配）→ 属性加成
function equipStat(q, slot, stars, matchFaction) {
  const b = EQUIP_QUALITIES[q].base;
  let m = 1 + STAR_PCT * (stars || 0);
  if (matchFaction) m *= FACTION_MATCH_MULT;
  if (slot === 'weapon') return { atk: Math.floor(b.atk * m) };
  if (slot === 'armor') return { hp: Math.floor(b.hp * m) };
  if (slot === 'helm') return { def: Math.floor(b.def * m) };
  return { hp: Math.floor(b.hp * 0.6 * m), atk: Math.floor(b.atk * 0.4 * m) };
}

// 关卡掉落品质（随进度向高品质偏移）
function dropQuality(globalStage) {
  const r = Math.random();
  const adv = Math.min(0.5, globalStage * 0.006);
  if (r < 0.04 + adv * 0.06) return 4; // SSR 4%→7%
  if (r < 0.16 + adv * 0.20) return 3; // SR 12%→19%
  if (r < 0.46 + adv * 0.30) return 2; // R 30%→35%
  return 1;                            // N 为其余（含强化狗粮）
}
const DROP_SLOTS = ['weapon', 'armor', 'helm', 'boots'];

// ---- 商铺（每日刷新） ----
// cur: gold 铜钱 / gem 元宝 / scroll 招募卷 / token 演武令 / shard 英雄碎片
const SHOP_GOODS = [
  { id: 's_scroll1', name: '招募令 ×1', cur: 'gem', price: 300, give: { scroll: 1 }, limit: 3 },
  { id: 's_scroll5', name: '招募令 ×5', cur: 'gem', price: 1350, give: { scroll: 5 }, limit: 1 },
  { id: 's_gold', name: '铜钱 ×20万', cur: 'gem', price: 80, give: { gold: 200000 }, limit: 3 },
  { id: 't_scroll', name: '招募令 ×1', cur: 'token', price: 40, give: { scroll: 1 }, limit: 5 },
  { id: 't_sr', name: 'SR 自选卡', cur: 'token', price: 300, give: { srPick: 1 }, limit: 1 },
  { id: 'h_ssr', name: 'SSR 自选卡', cur: 'shard', price: 500, give: { ssrPick: 1 }, limit: 1 },
  { id: 'h_sr', name: 'SR 自选卡', cur: 'shard', price: 150, give: { srPick: 1 }, limit: 2 }
];

// ---- 每日任务 ----
const QUESTS = [
  { id: 'q_win3', name: '任意战斗胜利 3 次', target: 3, reward: { gem: 20, iron: 80 }, act: 40 },
  { id: 'q_summon1', name: '点将 1 次', target: 1, reward: { gem: 15 }, act: 20 },
  { id: 'q_battle1', name: '任意战斗胜利 1 次', target: 1, reward: { gold: 20000 }, act: 30 },
  { id: 'q_idle1', name: '领取非零挂机收益 1 次', target: 1, reward: { gold: 10000 }, act: 30 },
  { id: 'q_arena1', name: '演武切磋 1 次', target: 1, reward: { gem: 15 }, act: 20 },
  { id: 'q_tower1', name: '群英塔完成战斗 1 次', target: 1, reward: { gold: 30000 }, act: 15 }
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

export {
  ARMORY_SLOTS, GRADES, CATALOG, STAR_NEEDS, STAR_GOLD, DROP_QUALITY_WEIGHTS,
  EQUIP_SLOTS, EQUIP_QUALITIES, MAX_STAR, STAR_PCT, FACTION_MATCH_MULT, FACTIONED_MIN_Q,
  STAR_POINTS, GOLD_PER_POINT, FODDER_POINTS,
  starNeed, starGold, fodderPoints, equipStat, dropQuality, DROP_SLOTS,
  SHOP_GOODS, QUESTS, ACTIVE_CHESTS, ARENA_RANKS, arenaRank
};
