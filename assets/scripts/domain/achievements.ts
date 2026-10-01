// @ts-nocheck
// Generated from utils/achievements.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_config from './config';
import * as __domain_heroes from './heroes';
// 主公成就与图鉴收集进度：全部从存档实时派生，不落计数字段
const C = __domain_config;
const H = __domain_heroes;

// 五轴进度（state 快照 → 数值）
function axisProgress(axis, state) {
  switch (axis) {
    case 'codex': return Object.keys(state.roster || {}).length;
    case 'bonds': {
      const ids = new Set(Object.keys(state.roster || {}));
      return (H.BONDS || []).filter(b => b.heroes.every(h => ids.has(h))).length;
    }
    case 'campaign': return Math.min(C.FIRST_STAGE_END, (state.campaign && state.campaign.cleared) || 0);
    case 'tower': return (state.tower && state.tower.best) || 0;
    case 'arena': return (state.arena && state.arena.wins) || 0;
    case 'hallKills': return (state.hall && state.hall.killsTotal) || 0;
    case 'tacticLv': {
      let sum = 0;
      Object.values(state.roster || {}).forEach((r) => { sum += (r.tacticLv || 0); });
      return sum;
    }
    case 'awaken': {
      let sum = 0;
      Object.values(state.roster || {}).forEach((r) => { sum += (r.awaken || 0); });
      return sum;
    }
    case 'drill': {
      let sum = 0;
      Object.values(state.roster || {}).forEach((r) => { sum += (r.drill || 0); });
      return sum;
    }
    case 'chaos': {
      const cleared = (state.campaign && state.campaign.cleared) || 0;
      return Math.max(0, cleared - 160); // 乱世推进深度（161 关起计）
    }
    case 'replay': return (state.replayCount) || 0; // 战报轴：终身战报计数
    case 'companion': return ((state.companion && state.companion.sent) || 0) + ((state.companion && state.companion.responds) || 0) + ((state.companion && state.companion.invoked) || 0);
    default: return 0;
  }
}

// 成就总览（九轴）：五基础轴（统一奖励表）+ 名人堂/兵法/觉醒/操练扩展轴（各自奖励表）。
// 扩展轴此前只导出未接线（2026-09-30 发现并修复）；tiers 达标即 claimable（一次性）。
const EXTENDED_AXES = [
  { key: 'hallKills', def: () => C.HALL_ACHV },
  { key: 'tacticLv', def: () => C.TACTIC_ACHV },
  { key: 'awaken', def: () => C.AWAKEN_ACHV },
  { key: 'drill', def: () => C.DRILL_ACHV },
  { key: 'chaos', def: () => C.CHAOS_ACHV },
  { key: 'replay', def: () => C.REPLAY_ACHV },
  { key: 'companion', def: () => C.COMPANION_ACHV }
];
function achvInfo(state) {
  const claimed = (state.achv && state.achv.claimed) || {};
  const axes = Object.keys(C.ACHV_AXES).map(key => {
    const def = C.ACHV_AXES[key];
    const value = axisProgress(key, state);
    const tiers = def.tiers.map((need, i) => ({
      tier: i, need, reward: C.ACHV_REWARDS[i],
      claimed: !!claimed[key + '-' + i],
      claimable: !claimed[key + '-' + i] && value >= need
    }));
    return { key, name: def.name, value, tiers };
  });
  EXTENDED_AXES.forEach(({ key, def }) => {
    const d = def();
    if (!d) return;
    const value = axisProgress(key, state);
    const tiers = d.tiers.map((need, i) => ({
      tier: i, need, reward: d.rewards[i],
      claimed: !!claimed[key + '-' + i],
      claimable: !claimed[key + '-' + i] && value >= need
    }));
    axes.push({ key, name: d.name, value, tiers });
  });
  return { axes, claimable: axes.some(a => a.tiers.some(t => t.claimable)) };
}

// 图鉴收集：四阵营 N+R/SR 与全 SR/全 SSR 进度
function codexProgress(state) {
  const owned = new Set(Object.keys(state.roster || {}));
  const done = (ids) => ids.every(id => owned.has(id));
  const prog = [];
  ['shu', 'wei', 'wu', 'qun'].forEach(f => {
    const nr = H.HEROES.filter(h => h.faction === f && h.rarity <= 2).map(h => h.id);
    const sr = H.HEROES.filter(h => h.faction === f && h.rarity === 3).map(h => h.id);
    prog.push({ key: f + '-nr', name: C.FACTIONS[f].name + '·N+R 集齐', have: nr.filter(id => owned.has(id)).length, need: nr.length, done: done(nr) });
    prog.push({ key: f + '-sr', name: C.FACTIONS[f].name + '·SR 集齐', have: sr.filter(id => owned.has(id)).length, need: sr.length, done: done(sr) });
  });
  const allSr = H.HEROES.filter(h => h.rarity === 3).map(h => h.id);
  const allSsr = H.HEROES.filter(h => h.rarity === 4).map(h => h.id);
  prog.push({ key: 'all-sr', name: '全 SR 集齐', have: allSr.filter(id => owned.has(id)).length, need: allSr.length, done: done(allSr) });
  prog.push({ key: 'all-ssr', name: '全 SSR 集齐', have: allSsr.filter(id => owned.has(id)).length, need: allSsr.length, done: done(allSsr) });
  return prog;
}

export { axisProgress, achvInfo, codexProgress };
