// 主公成就与图鉴收集进度：全部从存档实时派生，不落计数字段
const C = require('./config');
const H = require('./heroes');

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
    default: return 0;
  }
}

// 五轴成就总览：tiers 达标即 claimable（一次性）
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

module.exports = { axisProgress, achvInfo, codexProgress };
