// @ts-nocheck
// Generated from utils/progression.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_config from './config';
import * as __domain_heroes from './heroes';
import * as __domain_items from './items';
import * as __domain_stages from './stages';
// 只读近期目标与免费军械启用建议。所有结果均从传入的存档快照/API派生。
const C = __domain_config;
const H = __domain_heroes;
const IT = __domain_items;
const STAGES = __domain_stages;

const MILESTONE_BOX_Q = { 10: 1, 30: 2, 60: 3 };
const CHAPTER_CHEST = { gem: 100, scroll: 2 };

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
  // 与 store.firstClearGold / 章末奖励保持同一口径，避免主城目标卡与实际结算不符
  const gold = stageNo <= C.FIRST_STAGE_END
    ? 3000 + 150 * stageNo
    : Math.floor(2000 * Math.pow(1.05, stageNo)) + Math.floor(1400 * Math.pow(1.05, stageNo));
  const reward = { firstClear: { gem: 30, gold },
    bossReward: { scroll: 2 }, chapterChest: Object.assign({}, CHAPTER_CHEST), armoryBoxQ: 0, srChoiceVoucher: false };
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


// 今日军情主卡：第一层可领奖励 → 第二层成长事（getNextGoal 透传）。flags 由调用方计算。
function buildDailyBriefing(state, flags) {
  const f = flags || {};
  const subs = [];
  let main = null;
  const push = (flag, make) => { if (flag) { const item = make(); if (!main) main = item; else subs.push(item); } };
  push(f.bountyClaimable, () => ({ title: '悬赏可领赏', desc: '出征武将已有赏金待收', page: 'bounty' }));
  push(f.questsClaimable, () => ({ title: '每日任务可领', desc: '今日任务奖励待领取', page: 'quests' }));
  push(f.idleFull, () => ({ title: '挂机收益已满', desc: '回主城一键收获', page: 'campaign' }));
  push(f.sevenDayClaimable, () => ({ title: '七日目标可领', desc: '今天的厚礼还没拿', page: 'sevenDay' }));
  push(f.starChestClaimable, () => ({ title: '章节星宝箱可领', desc: '评星攒的宝箱待领取', page: 'campaign' }));
  push(f.retroGrants, () => ({ title: '旧档补发待读', desc: '有一份补发奖励待确认', page: 'campaign' }));
  if (!main) {
    const cleared = Math.max(0, Math.floor(Number(state.campaign && state.campaign.cleared) || 0));
    if (cleared < 120) main = { title: `继续征途 · 第 ${cleared + 1} 关`, desc: '通过本关提升挂机收益', page: 'stagePreview' };
    else main = { title: '第一期主线完成', desc: '群英塔与循环乱世继续开放', page: 'journey' };
  }
  if (f.arenaAttemptsLeft > 0) subs.push({ title: `演武还剩 ${f.arenaAttemptsLeft} 次`, page: 'journey' });
  if (f.bountyIdle > 0) subs.push({ title: `悬赏待派遣 ${f.bountyIdle} 单`, page: 'bounty' });
  return { main, subs: subs.slice(0, 2) };
}

// 本周必做聚合（2026-09-30 研讨会裁决 B）：远征周任务/活跃、名人堂周席、演武赛季、远征层，
// 只读派生不做任何状态变更；名人堂周键为 weekId:lunki-id，席位总数取本周阵容表长度。
function buildWeeklyBriefing(state, hallLineups) {
  const week = (state && state.week) || {};
  const counters = week.counters || {};
  const quests = (C.WEEKLY && C.WEEKLY.quests) || [];
  const questsDone = quests.filter(q => (counters[q.key] || 0) >= q.target).length;
  const seals = week.sealsEarned || 0;
  const nextActive = ((C.WEEKLY && C.WEEKLY.activeTiers) || []).find(t => seals < t.need);
  const trialBest = (week.trial && week.trial.best) || 0;
  const weekId = week.weekId || '';
  const hall = state.hall || {};
  const lineups = hallLineups || [];
  const hallCleared = lineups.filter(l => !!(hall.kills || {})[weekId + ':' + l.id]).length;
  const arena = state.arena || {};
  return {
    questsDone, questsTotal: quests.length, seals,
    nextActiveNeed: nextActive ? nextActive.need : null,
    trialBest, hallCleared, hallTotal: lineups.length,
    arenaRank: IT.arenaRank(arena.points || 0), arenaPoints: arena.points || 0
  };
}

// 卡关处方单（2026-09-30 研讨会二 P1）：败北归因 + 按当前资源可立即完成的养成处方。
// 全只读派生；api 传 store 的读取函数（questList/idlePending/bountyInfo/summonPityInfo），
// input={duration,snapshot,enemyFactions}。回退旋钮 config.DEFEAT_RX.enabled=false 时返回 null。
function buildDefeatPrescriptions(state, api, input) {
  const rx = C.DEFEAT_RX || { enabled: true, maxItems: 2 };
  if (!rx.enabled) return null;
  let borrowHint = null;
  try {
    const bi = api.borrowInfo ? api.borrowInfo() : null;
    if (bi && bi.enabled && bi.heroName && !bi.usedToday && (state.formation || []).indexOf(bi.heroId) < 0) {
      borrowHint = { key: 'borrow', tier: 2, gain: 5, cost: 0, text: `借${bi.heroName}助战一日`, page: 'formation' };
    }
  } catch (e) { /* 借将信息不可用时跳过 */ }
  const maxItems = rx.maxItems || 2;
  const inp = input || {};
  const duration = Number(inp.duration) || 0;
  const snapshot = inp.snapshot || [];
  const foes = snapshot.filter(u => u && u.side === 'B' && u.alive);
  const alliesAlive = snapshot.filter(u => u && u.side === 'A' && u.alive).length;
  const sorted = foes.slice().sort((a, b) => (b.hp / b.maxHp) - (a.hp / a.maxHp));
  const top = sorted[0];
  const topPct = top ? Math.round((top.hp / top.maxHp) * 100) : null;
  const timeLimit = (C.BATTLE && C.BATTLE.TIME_LIMIT) || 90;
  const timedOut = duration >= timeLimit;
  let attribution;
  if (topPct === null) attribution = { code: 'durability', text: '我方全灭 · 坦度不足，按处方补生存后再战' };
  else if (topPct <= 15) attribution = { code: 'close', text: `${top.name} 只剩 ${topPct}% 血 · 差一口气，强化后即可过关` };
  else if (timedOut && alliesAlive > 0) attribution = { code: 'output', text: '打满时限 · 输出不足，优先补攻击向养成' };
  else if (!alliesAlive && duration < 45) attribution = { code: 'durability', text: '开局即被击穿 · 前排坦度不足，优先补防御' };
  else attribution = { code: 'sustain', text: `${top.name} 仍剩 ${topPct}% 血 · 阵容强度不足，按处方提升后再战` };

  const items = [];
  const res = state.res || {};
  const iron = res.iron || 0, gold = res.gold || 0;
  // tier0 零成本即时项
  const recs = getArmoryRecommendations(state, IT);
  if (recs.length) items.push({ key: 'armory-free', tier: 0, gain: recs.length, cost: 0,
    text: `启用推荐军械 ×${recs.length}`, page: 'armory' });
  const boxes = (state.armory && state.armory.boxes) || {};
  const boxQ = [3, 2, 1].find(q => (boxes[q] || 0) > 0);
  if (boxQ) items.push({ key: 'armory-box', tier: 0, gain: boxQ, cost: 0,
    text: `开启${(IT.GRADES[boxQ] || {}).name || ''}自选箱`, page: 'armoryBox' });
  try {
    (api.questList() || []).forEach(q => {
      if (q.done && !q.claimed) items.push({ key: 'quest-' + q.id, tier: 0, gain: (q.reward && (q.reward.iron || 0) + (q.reward.gem || 0)) || 0, cost: 0,
        text: `领取：${(q.name || '').slice(0, 9)}`, page: 'quests' });
    });
  } catch (e) { /* 旧档缺 daily 字段时跳过 */ }
  try {
    const idle = api.idlePending() || {};
    if ((idle.gold || 0) > 0 || (idle.iron || 0) > 0) items.push({ key: 'idle-claim', tier: 0, gain: (idle.gold || 0) + (idle.iron || 0) * 40, cost: 0,
      text: '领取挂机收益', page: 'campaign' });
  } catch (e) { /* idlePending 带状态副作用，失败跳过 */ }
  try {
    if ((api.bountyInfo() || {}).canClaim) items.push({ key: 'bounty-claim', tier: 0, gain: 30, cost: 0,
      text: '悬赏可领赏', page: 'bounty' });
  } catch (e) { /* 同上 */ }
  // tier1 付费可完成项：最廉军械升星 / 碎片兑卡
  const slotStars = (state.armory && state.armory.slotStars) || {};
  const starCandidates = [];
  (IT.ARMORY_SLOTS || []).forEach((s, idx) => {
    const star = slotStars[s.id] || 0;
    if (star >= (IT.STAR_NEEDS || []).length) return;
    const needIron = IT.STAR_NEEDS[star] || 0, needGold = IT.STAR_GOLD[star] || 0;
    starCandidates.push({ key: 'armory-star', tier: 1, gain: -needIron, cost: needIron + needGold / 10,
      affordable: iron >= needIron && gold >= needGold,
      text: `${s.name}升 ${star + 1}★${iron >= needIron && gold >= needGold ? '' : '（铁不足）'}`, page: 'armory',
      order: idx });
  });
  starCandidates.sort((a, b) => a.cost - b.cost || a.order - b.order);
  if (starCandidates.length) items.push(starCandidates[0]);
  const shards = state.qualityShards || {};
  for (let q = 4; q >= 2; q--) {
    if ((shards[q] || 0) < 10) continue;
    const qName = (C.RARITIES[q] && C.RARITIES[q].name) || q;
    items.push({ key: 'shard-' + q, tier: 1, gain: q * 10, cost: 0,
      text: `碎片兑${qName}将（${shards[q]}/10）`, page: q === 4 ? 'shop' : 'heroes' });
    break;
  }
  // tier2 换人克制：敌多数阵营 → roster 里可上的克制阵营将
  const factions = (inp.enemyFactions || []).filter(Boolean);
  if (factions.length) {
    const count = {};
    factions.forEach(f => { count[f] = (count[f] || 0) + 1; });
    const dom = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    const beats = Object.keys(C.BEATS || {}).find(k => (C.BEATS || {})[k] === dom);
    const formation = Array.isArray(state.formation) ? state.formation : [];
    const rosterHasBeats = beats && Object.keys(state.roster || {}).some(id => {
      const h = H.getHero(id);
      return h && h.faction === beats && formation.indexOf(id) < 0;
    });
    if (dom && beats && rosterHasBeats) items.push({ key: 'counter-' + beats, tier: 2, gain: count[dom], cost: 0,
      text: `上阵${(C.FACTIONS[beats] || {}).name || ''}将克制`, page: 'formation' });
  }
  if (borrowHint) items.push(borrowHint);
  // 排序：tier asc → gain desc → cost asc → 原序；取前 maxItems
  items.forEach((it, i) => { it.order = i; });
  items.sort((a, b) => (a.tier - b.tier) || ((b.gain || 0) - (a.gain || 0)) || ((a.cost || 0) - (b.cost || 0)) || (a.order - b.order));
  if (!items.length) {
    const pity = api.summonPityInfo ? api.summonPityInfo() : {};
    items.push({ key: 'pity', tier: 3, gain: 0, cost: 0,
      text: `SSR 保底 ${(pity.sinceSsr || 0)}/${pity.ssrHard || 40} 抽`, page: 'summon' });
  }
  return { attribution, items: items.slice(0, maxItems) };
}

export { getNextGoal, getArmoryRecommendations, buildDailyBriefing, buildWeeklyBriefing, buildDefeatPrescriptions };
