// 装备、商店、每日任务定义
// 装备系统对标剑与远征（AFK Arena）：
//   四品质 白N/蓝R/紫SR/橙SSR → 强化改为"吃其他装备攒强化点 + 铜钱"逐星升星
//   SR/SSR 掉落自带阵营，穿戴阵营匹配的武将属性 +30%
// 装备槽：weapon 兵刃(atk) armor 铠甲(hp) helm 头盔(def) boots 战靴(hp+atk小)
const EQUIP_SLOTS = {
  weapon: { key: 'weapon', name: '兵刃', icon: '⚔', stat: 'atk' },
  armor:  { key: 'armor',  name: '铠甲', icon: '🛡', stat: 'hp' },
  helm:   { key: 'helm',   name: '头盔', icon: '⛑', stat: 'def' },
  boots:  { key: 'boots',  name: '战靴', icon: '👟', stat: 'hp2' }
};

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
  EQUIP_SLOTS, EQUIP_QUALITIES, MAX_STAR, STAR_PCT, FACTION_MATCH_MULT, FACTIONED_MIN_Q,
  STAR_POINTS, GOLD_PER_POINT, FODDER_POINTS,
  starNeed, starGold, fodderPoints, equipStat, dropQuality, DROP_SLOTS,
  SHOP_GOODS, QUESTS, ACTIVE_CHESTS, ARENA_RANKS, arenaRank
};
