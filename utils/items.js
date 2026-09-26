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
