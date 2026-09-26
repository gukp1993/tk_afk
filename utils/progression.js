// 只读近期目标与免费军械启用建议。所有结果均从传入的存档快照/API派生。
const C = require('./config');
const H = require('./heroes');
const IT = require('./items');
const STAGES = require('./stages');

const MILESTONE_BOX_Q = { 10: 1, 30: 2, 60: 3 };
const CHAPTER_CHEST = { gem: 100, scroll: 1 };

function own(obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }

function getArmoryRecommendations(state, items) {
  const catalog = items || IT;
  const armory = state && state.armory;
  if (!armory || !armory.unlocked || !armory.selected) return [];
  const byId = {};
  (catalog.CATALOG || []).forEach(item => { byId[item.id] = item; });
  const slots = catalog.ARMORY_SLOTS || [];
  const result = [];
  slots.forEach(slotDef => {
    const slot = slotDef.id;
    const currentId = armory.selected[slot];
    const current = byId[currentId];
    // 已启用SSR的槽位由玩家自行比较特殊效果，不参与建议。
    if (!current || current.q >= 3) return;
    const currentStats = current.basePct || current.stats || {};
    const candidates = (catalog.CATALOG || []).filter(item => {
      if (item.slot !== slot || item.q > 2 || item.q <= current.q || !armory.unlocked[item.id]) return false;
      // N/R/SR不应引入特殊效果；同时要求替换前后效果完全相同。
      if ((item.effect || null) !== (current.effect || null)) return false;
      const stats = item.basePct || item.stats || {};
      const keys = new Set(Object.keys(currentStats).concat(Object.keys(stats)));
      let improved = false;
      for (const key of keys) {
        const before = Number(currentStats[key]) || 0;
        const after = Number(stats[key]) || 0;
        if (after < before) return false;
        if (after > before) improved = true;
      }
      return improved;
    }).sort((a, b) => b.q - a.q || String(a.id).localeCompare(String(b.id)));
    if (!candidates.length) return;
    const next = candidates[0], nextStats = next.basePct || next.stats || {};
    const keys = new Set(Object.keys(currentStats).concat(Object.keys(nextStats)));
    const delta = {};
    keys.forEach(key => {
      const amount = (Number(nextStats[key]) || 0) - (Number(currentStats[key]) || 0);
      if (amount > 0) delta[key] = amount;
    });
    result.push({ slot, slotName: slotDef.name, fromId: current.id, toId: next.id,
      fromName: current.name, toName: next.name, fromQ: current.q, toQ: next.q, delta });
  });
  return result;
}

function firstAvailableAscension(state, storeApi) {
  if (!storeApi || typeof storeApi.ascendPreview !== 'function') return null;
  const roster = state.roster || {};
  const formation = Array.isArray(state.formation) ? state.formation : [];
  const ordered = [];
  formation.forEach(id => { if (id && roster[id] && ordered.indexOf(id) < 0) ordered.push(id); });
  Object.keys(roster).sort().forEach(id => { if (ordered.indexOf(id) < 0) ordered.push(id); });
  for (const id of ordered) {
    const preview = storeApi.ascendPreview(id);
    if (preview && preview.ok && preview.can) return { id, hero: H.getHero(id), preview };
  }
  return null;
}

function firstWinAvailable(storeApi) {
  if (!storeApi || typeof storeApi.firstWinChoice !== 'function') return false;
  const choice = storeApi.firstWinChoice();
  return !!(choice && choice.available === true);
}

function nextChapterGoal(state, stages) {
  const cleared = Math.max(0, Math.floor(Number(state.campaign && state.campaign.cleared) || 0));
  const stageNo = (Math.floor(cleared / (stages.STAGES_PER_CH || 10)) + 1) * (stages.STAGES_PER_CH || 10);
  const reward = { firstClear: { gem: 30,
    gold: Math.floor(2000 * Math.pow(1.05, stageNo)) + Math.floor(1400 * Math.pow(1.05, stageNo)),
    }, bossReward: { scroll: 1 }, chapterChest: Object.assign({}, CHAPTER_CHEST), armoryBoxQ: 0, srChoiceVoucher: false };
  const milestoneQ = MILESTONE_BOX_Q[stageNo] || 0;
  if (milestoneQ && !(state.armory && state.armory.claimedMilestones && state.armory.claimedMilestones[milestoneQ])) {
    reward.armoryBoxQ = milestoneQ;
  }
  const progress = state.heroProgress || {};
  // 当前 settleBattle 的实际发放条件是任意战役胜利关号 >=10 时补发一次。
  if (stageNo >= 10 && !progress.chapterOneVoucherGranted) reward.srChoiceVoucher = true;
  return { id: 'chapter-' + stageNo, title: '再过' + (stageNo - cleared) + '关，获得章末奖励',
    progress: { current: cleared, target: stageNo, remaining: stageNo - cleared },
    rewardPreview: reward, action: { type: 'campaign', stage: cleared + 1 } };
}

function getNextGoal(state, storeApi, deps) {
  if (!state) return null;
  const d = deps || {};
  const stages = d.stages || STAGES;
  if (firstWinAvailable(storeApi)) {
    return { id: 'first-win-choice', title: '首胜奖励可领', progress: null,
      rewardPreview: { choice: ['liubei', 'guanyu', 'zhangfei'] }, action: { type: 'heroes', focusFirstWin: true } };
  }
  const ascension = firstAvailableAscension(state, storeApi);
  if (ascension) {
    return { id: 'ascend-' + ascension.id, title: '可升星：' + (ascension.hero ? ascension.hero.name : ascension.id),
      progress: { current: ascension.preview.cards, target: ascension.preview.needCards },
      rewardPreview: { starFrom: ascension.preview.from, starTo: ascension.preview.to },
      action: { type: 'heroDetail', id: ascension.id, focus: 'ascend' } };
  }
  const boxes = state.armory && state.armory.boxes || {};
  for (const q of [1, 2, 3]) {
    if ((Number(boxes[q]) || 0) > 0) return { id: 'armory-box-' + q, title: '有军械自选箱待选择', progress: null,
      rewardPreview: { boxQ: q }, action: { type: 'armory', boxQ: q } };
  }
  const vouchers = state.vouchers || {};
  for (const [key, rarity] of [['sr', 3], ['ssr', 4]]) {
    if ((Number(vouchers[key]) || 0) > 0) return { id: 'hero-voucher-' + key, title: '有武将自选券待选择', progress: null,
      rewardPreview: { rarity, count: Math.floor(vouchers[key]) }, action: { type: 'shop', pickRarity: rarity } };
  }
  const recommendations = getArmoryRecommendations(state, d.items);
  if (recommendations.length) return { id: 'armory-upgrade', title: '可启用新军械', progress: null,
    rewardPreview: { replacements: recommendations }, action: { type: 'armory', recommendations } };
  return nextChapterGoal(state, stages);
}

module.exports = { getNextGoal, getArmoryRecommendations };
