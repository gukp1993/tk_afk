// @ts-nocheck
// Generated from utils/store.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_config from './config';
import * as __domain_heroes from './heroes';
import * as __domain_items from './items';
import * as __domain_fmt from './fmt';
import * as __domain_platform from './platform';
import * as __domain_battle from './battle';
import * as __domain_stages from './stages';
// 游戏状态管理：存档、武将养成、挂机、招募、任务、商店、演武
const C = __domain_config;
const H = __domain_heroes;
const IT = __domain_items;
const F = __domain_fmt;
const platform = __domain_platform;
const { buildUnit } = __domain_battle;

const SAVE_KEY = 'sanguo_afk_save_v1';
const api = platform.api;
const hasStorage = !!api && !!api.setStorageSync;
let memStore = {};

function rawGet(k) { return hasStorage ? api.getStorageSync(k) : memStore[k]; }
function rawSet(k, v) { if (hasStorage) api.setStorageSync(k, v); else memStore[k] = v; }

let state = null;

function defaultState() {
  const roster = {};
  C.BATTLE.STARTER.forEach(id => { roster[id] = newHero(id); });
  roster.mengda = newHero('mengda');
  return {
    v: 7, createdAt: Date.now(), name: '主公',
    player: { level: 1, exp: 0 },
    res: { gold: 100000, gem: 1888, scroll: 12, token: 20, shard: 0, iron: 60 },
    roster,
    formation: ['zhangfei', 'guanyu', 'liaohua', 'liubei', 'mengda'],
    campaign: { cleared: 0, storySeen: {}, milestones: {}, retroGrants: null, retroGrantsSeen: false, stars: {}, starChests: {} },
    tower: { best: 0 },
    arena: { points: 1000, wins: 0, losses: 0, attempts: C.ARENA.DAILY, rankReached: {} },
    equips: {}, nextEquip: 1,
    armory: createArmory(),
    idle: { last: Date.now(), gold: 0, gem: 0, scroll: 0, ironAcc: 0 },
    gemDay: { day: F.todayStr(), claimedGem: 0 },
    fast: { day: '', count: 0 },
    qualityShards: { 1: 0, 2: 0, 3: 0, 4: 0 },
    daily: { day: '', quests: {}, claimed: [], active: [] },
    summon: { total: 0, pity: { sinceSsr: 0 }, ticketStock: 2, ticketWeek: { week: '', used: 0 }, pointClaims: [], activeFocus: null },
    res: { gold: 100000, gem: 1888, scroll: 12, token: 20, shard: 0, iron: 60, univSsr: 0 },
    sevenDay: { start: F.todayStr(), claimed: [] },
    bounty: { day: '', list: [] },
    roamer: { day: '', ids: [], bought: {} },
    vouchers: { sr: 0, ssr: 0 },
    heroProgress: { starterMengdaGranted: true, firstWinChoiceGranted: false, firstWinChoicePending: false, chapterOneVoucherGranted: false },
    battle: { nextSeq: 1, pending: null, lastSettled: null },
    migrations: {},
    ads: { day: '', counts: {} },
    buyLog: { day: '', buys: {} },
    settings: { speed: 1 },
    return: { lastGrantTs: Date.now() },
    lastSeenTs: Date.now()
  };
}
function newHero(id) { return { id, star: 0, cards: 0, lockedCards: false, equip: { weapon: null, armor: null, helm: null, boots: null } }; }
function createArmory() {
  const unlocked = {}, selected = {}, slotStars = {};
  IT.ARMORY_SLOTS.forEach(s => {
    const starter = IT.CATALOG.find(x => x.slot === s.id && x.q === 0);
    unlocked[starter.id] = true; selected[s.id] = starter.id; slotStars[s.id] = 0;
  });
  return { schema: 1, unlocked, selected, slotStars, seen: {}, claimedMilestones: {}, boxes: { 1: 0, 2: 0, 3: 0 }, affixes: {}, freeRerolls: C.FORGE.freeRerolls };
}

// 旧档 v1（tier 1-6 / enh 0-12）→ v2（q 品质 1-4 / stars 星级 / faction 阵营）
// 导出供冒烟测试直测；映射保持战力大致连续（旧 t6+12 ≈ 新 SSR 5★）
const V1_TIER_TO_Q = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4 };
function migrateSaveV1(raw) {
  raw.v = 2;
  Object.keys(raw.equips || {}).forEach(k => {
    const e = raw.equips[k];
    if (e.q) return;
    e.q = V1_TIER_TO_Q[e.tier] || 1;
    e.stars = Math.min(IT.EQUIP_QUALITIES[e.q].maxStar, Math.round((e.enh || 0) / 2.4));
    e.faction = null;
    delete e.tier; delete e.enh;
  });
  return raw;
}

// 旧档 v2 → v3：补齐剧情关卡字段（storySeen 缺省安全，旧档 cleared 不动）
function migrateSaveV2(raw) {
  raw.v = 3;
  if (!raw.campaign) raw.campaign = { cleared: 0 };
  if (!raw.campaign.storySeen) raw.campaign.storySeen = {};
  return raw;
}

// v3兵书→铜钱、个人等级→玩家等级。只补偿旧档仍能重建的投入，迁移标记阻止重复返还。
function migrateSaveV3(raw) {
  if (raw.migrations && raw.migrations.playerLevelV2 && raw.migrations.playerLevelV2.applied) {
    raw.v = 4;
    return raw;
  }
  raw.res = raw.res || {};
  raw.roster = raw.roster || {};
  raw.campaign = raw.campaign || { cleared: 0 };
  raw.daily = raw.daily || { day: '', quests: {}, claimed: [], active: [] };
  raw.idle = raw.idle || { last: Date.now(), gold: 0, exp: 0, scroll: 0 };

  // 先按旧速率结算一次剩余离线收益，随后把挂机兵书一并折铜钱。
  const oldCleared = raw.campaign.cleared || 0;
  const oldRate = { gold: Math.floor(1800 + 260 * oldCleared), exp: Math.floor(1200 + 170 * oldCleared), scrollPerHour: 0.25 };
  const elapsed = Math.max(0, (Date.now() - (raw.idle.last || Date.now())) / 3600000);
  const hours = Math.min(C.IDLE_CAP_HOURS, elapsed);
  const idleGold = Math.min(C.IDLE_CAP_HOURS * oldRate.gold, (raw.idle.gold || 0) + hours * oldRate.gold);
  const idleExp = Math.min(C.IDLE_CAP_HOURS * oldRate.exp, (raw.idle.exp || 0) + hours * oldRate.exp);
  const idleScroll = Math.min(C.IDLE_CAP_HOURS * oldRate.scrollPerHour, (raw.idle.scroll || 0) + hours * oldRate.scrollPerHour);

  const ids = Object.keys(raw.roster).filter(id => H.getHero(id));
  const sorted = ids.slice().sort((a, b) => (raw.roster[b].lv || 1) - (raw.roster[a].lv || 1) || a.localeCompare(b));
  const anchor = sorted[0] || null;
  const level = anchor ? Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(raw.roster[anchor].lv || 1))) : 1;
  let refundGold = 0, refundBooks = 0;
  ids.forEach(id => {
    const own = raw.roster[id];
    if (!own) return;
    if (id !== anchor) {
      const lv = Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(own.lv || 1)));
      for (let n = 1; n < lv; n++) { refundGold += C.goldCost(n); refundBooks += C.expCost(n); }
    }
    delete own.lv;
  });

  const books = Math.floor((raw.res.exp || 0) + idleExp);
  raw.res.gold = Math.floor((raw.res.gold || 0) + refundGold + refundBooks + books);
  delete raw.res.exp;
  raw.player = { level, exp: 0 };
  raw.idle = { last: Date.now(), gold: idleGold, scroll: idleScroll };
  raw.vouchers = raw.vouchers || { sr: 0, ssr: 0 };
  raw.heroProgress = raw.heroProgress || { starterMengdaGranted: false, firstWinChoiceGranted: false, firstWinChoicePending: false, chapterOneVoucherGranted: false };
  raw.heroProgress.starterMengdaGranted = true;
  if (H.getHero('mengda') && !raw.roster.mengda) raw.roster.mengda = newHero('mengda');
  raw.formation = Array.isArray(raw.formation) ? raw.formation.slice(0, 5) : [];
  while (raw.formation.length < 5) raw.formation.push(null);
  if (!raw.formation[4] && raw.roster.mengda) raw.formation[4] = 'mengda';
  raw.battle = raw.battle || { nextSeq: 1, pending: null, lastSettled: null };
  raw.battle.nextSeq = Math.max(1, raw.battle.nextSeq || 1);
  raw.migrations = raw.migrations || {};
  raw.migrations.playerLevelV2 = { applied: true, anchorId: anchor, compensationGold: refundGold + refundBooks + books };
  raw.daily.quests = raw.daily.quests || {};
  if (raw.daily.quests.q_levelup) raw.daily.quests.q_battle1 = Math.max(raw.daily.quests.q_battle1 || 0, raw.daily.quests.q_levelup);
  delete raw.daily.quests.q_levelup;
  if (raw.campaign.cleared >= 1 && !raw.heroProgress.firstWinChoiceGranted) raw.heroProgress.firstWinChoicePending = true;
  if (raw.campaign.cleared >= 10 && !raw.heroProgress.chapterOneVoucherGranted) {
    raw.vouchers.sr += 1;
    raw.heroProgress.chapterOneVoucherGranted = true;
  }
  raw.v = 4;
  return raw;
}

// v4个人装备→v5共享图鉴。旧装备实体按唯一ID扫描一次，不按英雄引用重复计资产。
function migrateSaveV4(raw) {
  raw.res = raw.res || {}; raw.roster = raw.roster || {}; raw.campaign = raw.campaign || { cleared: 0 };
  const armory = createArmory(), old = raw.equips || {}, slotOrder = ['weapon','armor','helm','boots'];
  const selected = {}, targetStars = {}, bestQ = {}, seenIds = {};
  let investedIron = 0, investedGold = 0;
  Object.keys(old).forEach(id => {
    const e = old[id]; if (!e || seenIds[id]) return; seenIds[id] = true;
    const slot = slotOrder.includes(e.slot) ? e.slot : null;
    if (!slot) return;
    const q = Math.max(1, Math.min(4, Math.floor(e.q || 1)));
    const nq = q - 1;
    const item = IT.CATALOG.find(x => x.slot === slot && x.q === nq && (nq !== 3 || x.id.endsWith('_ssr_a')));
    if (!item) return;
    const stars = Math.max(0, Math.min(IT.EQUIP_QUALITIES[q].maxStar, Math.floor(e.stars || 0)));
    for (let n=0;n<stars;n++) { investedIron += IT.starNeed(q,n) || 0; investedGold += IT.starGold(IT.starNeed(q,n) || 0); }
    if (stars > (targetStars[slot] || 0)) targetStars[slot] = stars;
    if (q > (bestQ[slot] || 0)) { bestQ[slot] = q; selected[slot] = item.id; }
    if (!armory.unlocked[item.id]) armory.unlocked[item.id] = true;
    else raw.res.iron = (raw.res.iron || 0) + IT.GRADES[nq].duplicate;
  });
  let spentIron = 0, spentGold = 0;
  slotOrder.forEach(slot => {
    const stars = targetStars[slot] || 0;
    for (let n=0;n<stars;n++) {
      spentIron += IT.STAR_NEEDS[n]; spentGold += IT.STAR_GOLD[n];
      armory.slotStars[slot] = n + 1;
    }
  });
  raw.res.iron = Math.max(0, Math.floor((raw.res.iron || 0) + investedIron - spentIron));
  raw.res.gold = Math.max(0, Math.floor((raw.res.gold || 0) + investedGold - spentGold));
  Object.keys(selected).forEach(slot => { armory.selected[slot] = selected[slot]; });
  IT.ARMORY_SLOTS.forEach(s => { const item=IT.CATALOG.find(x=>x.slot===s.id&&x.q===0); if (!armory.unlocked[item.id]) armory.unlocked[item.id]=true; });
  [10,30,60].forEach((stage,i) => {
    const q=i+1;
    if ((raw.campaign.cleared || 0) >= stage) { armory.boxes[q] = 1; armory.claimedMilestones[q] = true; }
  });
  raw.armory = armory; raw.equips = {}; raw.nextEquip = 1;
  Object.keys(raw.roster).forEach(id => { if (raw.roster[id]) raw.roster[id].equip = { weapon:null,armor:null,helm:null,boots:null }; });
  raw.idle = raw.idle || { last: Date.now(), gold: 0, scroll: 0 };
  raw.idle.ironAcc = 0;
  raw.migrations = raw.migrations || {};
  raw.migrations.armoryV1 = { applied: true, investedIron, inheritedIron: spentIron, refundedIron: Math.max(0, investedIron-spentIron), investedGold, inheritedGold: spentGold, refundedGold: Math.max(0, investedGold-spentGold) };
  raw.v = 5;
  return raw;
}

// v5→v6：旧档中未用于手动升星的同名卡，按每张卡自动升一星；满星后余卡继续保留。
function migrateSaveV5(raw) {
  raw.roster = raw.roster || {};
  raw.migrations = raw.migrations || {};
  if (!(raw.migrations.autoStarDuplicatesV1 && raw.migrations.autoStarDuplicatesV1.applied)) {
    Object.keys(raw.roster).forEach(id => {
      const own = raw.roster[id], def = H.getHero(id);
      if (!own || !def || own.lockedCards) return;
      const maxStar = C.RARITIES[def.rarity].maxStar;
      own.star = Math.max(0, Math.min(maxStar, Math.floor(Number(own.star) || 0)));
      own.cards = Math.max(0, Math.floor(Number(own.cards) || 0));
      const used = Math.min(own.cards, maxStar - own.star);
      own.star += used;
      own.cards -= used;
    });
    raw.migrations.autoStarDuplicatesV1 = { applied: true };
  }
  raw.v = 6;
  return raw;
}

// v6→v7：经济改版。元宝挂机从迁移当刻起算（不追溯补发）；已通关新增里程碑的旧档
// 只补发一次第 40/90/100/110/120 关对应奖励；旧待领招募令、多余卡、保护标记与通用碎片原样保留。
const RETRO_MILESTONE_STAGES = [40, 90, 100, 110, 120];
function migrateSaveV6(raw) {
  raw.v = 7;
  raw.idle = raw.idle || { last: Date.now(), gold: 0, scroll: 0, ironAcc: 0 };
  raw.idle.gem = 0;
  // 元宝经济从迁移当刻起算：重置累计锚点，避免 load 时按离线时长追溯生成元宝
  // （旧档迁移前最后一小段离线的铜钱/精铁按旧口径本就微乎其微，一并从当刻起算）。
  raw.idle.last = Date.now();
  raw.gemDay = { day: F.todayStr(), claimedGem: 0 };
  raw.qualityShards = { 1: 0, 2: 0, 3: 0, 4: 0 };
  raw.campaign = raw.campaign || { cleared: 0, storySeen: {} };
  raw.campaign.milestones = raw.campaign.milestones || {};
  const grants = [];
  RETRO_MILESTONE_STAGES.forEach(stage => {
    if ((raw.campaign.cleared || 0) < stage || raw.campaign.milestones[stage]) return;
    const reward = C.CAMPAIGN_MILESTONES[stage];
    if (!reward) return;
    applyRewardToRaw(raw, reward);
    raw.campaign.milestones[stage] = 1;
    grants.push({ stage, label: reward.label || '里程碑奖励' });
  });
  raw.campaign.retroGrants = grants.length ? grants : null;
  raw.campaign.retroGrantsSeen = false;
  raw.migrations = raw.migrations || {};
  raw.migrations.economyV1 = { applied: true, retroGrants: grants.length };
  return raw;
}
// 迁移期直接对裸存档发奖（尚未进入 normalize 的 state 形态）。
function applyRewardToRaw(raw, r) {
  if (!r || typeof r !== 'object') return;
  raw.res = raw.res || {};
  if (r.gold) raw.res.gold = (raw.res.gold || 0) + r.gold;
  if (r.gem) raw.res.gem = (raw.res.gem || 0) + r.gem;
  if (r.scroll) raw.res.scroll = (raw.res.scroll || 0) + r.scroll;
  if (r.iron) raw.res.iron = (raw.res.iron || 0) + Math.floor(r.iron);
  if (r.srPick) raw.vouchers = Object.assign(raw.vouchers || {}, { sr: (raw.vouchers && raw.vouchers.sr || 0) + r.srPick });
  if (r.ssrPick) raw.vouchers = Object.assign(raw.vouchers || {}, { ssr: (raw.vouchers && raw.vouchers.ssr || 0) + r.ssrPick });
  if (r.armoryBox) {
    raw.armory = raw.armory || createArmory();
    raw.armory.boxes = raw.armory.boxes || { 1: 0, 2: 0, 3: 0 };
    raw.armory.boxes[r.armoryBox] = (raw.armory.boxes[r.armoryBox] || 0) + 1;
  }
}

// 回归补给：断签 ≥2 天且距上次 ≥7 天；每日上线玩家结构性拿不到
function checkReturnGrant() {
  const now = Date.now();
  const gap = now - (state.lastSeenTs || 0);
  const days = Math.floor(gap / 86400000);
  if (days < 2) return;
  const last = (state.return && state.return.lastGrantTs) || 0;
  if (now - last < 7 * 86400000) return;
  let tier = null;
  C.RETURN_GRANTS.forEach(t => { if (days >= t.minDays) tier = t; });
  if (!tier) return;
  applyReward(tier.reward);
  state.return = { lastGrantTs: now };
  state.returnPending = { days, label: tier.label };
}
function dismissReturnPending() {
  return withSavedMutation(() => {
    if (!state.returnPending) return { ok: true, changed: false };
    state.returnPending = null;
    return { ok: true, changed: true };
  });
}
function load() {
  const raw = rawGet(SAVE_KEY);
  if (raw && raw.v === 1) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(migrateSaveV5(migrateSaveV4(migrateSaveV3(migrateSaveV2(migrateSaveV1(raw))))));
    save();
  } else if (raw && raw.v === 2) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(migrateSaveV5(migrateSaveV4(migrateSaveV3(migrateSaveV2(raw)))));
    save();
  } else if (raw && raw.v === 3) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(migrateSaveV5(migrateSaveV4(migrateSaveV3(raw))));
    save();
  } else if (raw && raw.v === 4) {
    rawSet(SAVE_KEY + '.backup.v4', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(migrateSaveV5(migrateSaveV4(raw)));
    normalizeState(state);
    // Persist normalized fields and abandon any battle interrupted before this load.
    save();
  } else if (raw && raw.v === 5) {
    rawSet(SAVE_KEY + '.backup.v5', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(migrateSaveV5(raw));
    normalizeState(state);
    save();
  } else if (raw && raw.v === 6) {
    rawSet(SAVE_KEY + '.backup.v7', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV6(raw);
    normalizeState(state);
    save();
  } else if (raw && raw.v === 7) {
    state = raw;
    normalizeState(state);
    save();
  } else if (raw && raw.v > 7) {
    throw new Error('存档版本较新，停止加载以保护数据');
  } else if (raw) {
    throw new Error('存档版本无法识别，保留原数据并停止加载');
  } else {
    state = defaultState();
    save();
  }
  // 离线挂机结算
  idleTick();
  checkReturnGrant();
  return state;
}
function normalizeState(s) {
  s.player = s.player || { level: 1, exp: 0 };
  s.player.level = Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(s.player.level || 1)));
  s.player.exp = s.player.level >= C.MAX_LEVEL ? 0 : Math.max(0, Math.floor(s.player.exp || 0));
  s.res = s.res || {}; ['gold', 'gem', 'scroll', 'token', 'shard', 'iron', 'univSsr'].forEach(k => { if (!Number.isFinite(s.res[k])) s.res[k] = 0; s.res[k] = Math.max(0, Math.floor(s.res[k])); });
  if (!s.armory) s.armory = createArmory();
  const defaults = createArmory();
  s.armory.unlocked = s.armory.unlocked || defaults.unlocked;
  s.armory.selected = s.armory.selected || defaults.selected;
  s.armory.slotStars = s.armory.slotStars || defaults.slotStars;
  s.armory.seen = s.armory.seen || {};
  s.armory.claimedMilestones = s.armory.claimedMilestones || {};
  s.armory.boxes = s.armory.boxes || { 1: 0, 2: 0, 3: 0 };
  s.armory.affixes = s.armory.affixes || {};
  s.armory.motifs = s.armory.motifs || { active: null, unlocked: {} };
  s.armory.motifs.unlocked = s.armory.motifs.unlocked || {};
  s.armory.smeltStock = s.armory.smeltStock || {};
  s.armory.freeRerolls = s.armory.freeRerolls == null ? C.FORGE.freeRerolls : Math.max(0, Math.floor(s.armory.freeRerolls));
  [1,2,3].forEach(q => { s.armory.boxes[q] = Math.max(0, Math.floor(Number(s.armory.boxes[q]) || 0)); });
  IT.ARMORY_SLOTS.forEach(slot => {
    const starter = IT.CATALOG.find(x => x.slot === slot.id && x.q === 0);
    if (!s.armory.unlocked[starter.id]) s.armory.unlocked[starter.id] = true;
    if (!IT.CATALOG.some(x => x.id === s.armory.selected[slot.id] && x.slot === slot.id && s.armory.unlocked[x.id])) s.armory.selected[slot.id] = starter.id;
    s.armory.slotStars[slot.id] = Math.max(0, Math.min(5, Math.floor(s.armory.slotStars[slot.id] || 0)));
  });
  s.roster = s.roster || {}; s.vouchers = s.vouchers || { sr: 0, ssr: 0 };
  s.summon = s.summon || { total: 0 };
  s.summon.total = Math.max(0, Math.floor(s.summon.total || 0));
  // 保底计数为 v7 后增字段：旧档缺省从 0 起，不升存档版本号
  s.summon.pity = s.summon.pity || { sinceSsr: 0 };
  s.summon.pity.sinceSsr = Math.max(0, Math.min((C.GACHA.pity && C.GACHA.pity.ssrHard || 40) - 1, Math.floor(s.summon.pity.sinceSsr || 0)));
  s.summon.ticketStock = Math.max(0, Math.floor(s.summon.ticketStock || 0));
  s.summon.ticketWeek = s.summon.ticketWeek || { week: '', used: 0 };
  if (!Array.isArray(s.summon.pointClaims)) s.summon.pointClaims = [];
  s.summon.activeFocus = ['wei', 'shu', 'wu', 'qun'].includes(s.summon.activeFocus) ? s.summon.activeFocus : null;
  s.arena = s.arena || { points: 1000, wins: 0, losses: 0, attempts: C.ARENA.DAILY };
  s.arena.rankReached = s.arena.rankReached || {};
  s.sevenDay = s.sevenDay || { start: F.todayStr(), claimed: [] };
  if (!Array.isArray(s.sevenDay.claimed)) s.sevenDay.claimed = [];
  s.sevenDay.claimed = s.sevenDay.claimed.map(n => Math.floor(Number(n) || 0)).filter(n => n >= 1 && n <= 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.sevenDay.start || '')) s.sevenDay.start = F.todayStr();
  s.bounty = s.bounty || { day: '', list: [] };
  if (!Array.isArray(s.bounty.list)) s.bounty.list = [];
  s.bounty.unreadGrants = s.bounty.unreadGrants === null ? null : (s.bounty.unreadGrants || null);
  s.roamer = s.roamer || { day: '', ids: [], bought: {} };
  if (!Array.isArray(s.roamer.ids)) s.roamer.ids = [];
  s.roamer.bought = s.roamer.bought || {};
  s.return = s.return || { lastGrantTs: 0 };
  s.return.lastGrantTs = Math.max(0, Math.floor(Number(s.return.lastGrantTs) || 0));
  s.returnPending = s.returnPending || null;
  s.lastSeenTs = Math.max(0, Math.floor(Number(s.lastSeenTs) || 0));
  s.heroProgress = s.heroProgress || { starterMengdaGranted: true, firstWinChoiceGranted: false, firstWinChoicePending: false, chapterOneVoucherGranted: false };
  s.battle = s.battle || { nextSeq: 1, pending: null, lastSettled: null };
  s.idle = s.idle || { last: Date.now(), gold: 0, gem: 0, scroll: 0, ironAcc: 0 };
  if (!Number.isFinite(s.idle.ironAcc)) s.idle.ironAcc = 0;
  s.idle.ironAcc = Math.max(0, Math.min(C.IDLE_CAP_HOURS * C.ARMORY_IRON_PER_HOUR, s.idle.ironAcc));
  if (!Number.isFinite(s.idle.gem)) s.idle.gem = 0;
  s.idle.gem = Math.max(0, Math.min(C.GEM_IDLE.dailyCap, s.idle.gem));
  if (!Number.isFinite(s.idle.scroll)) s.idle.scroll = 0;
  s.gemDay = s.gemDay || { day: F.todayStr(), claimedGem: 0 };
  s.gemDay.claimedGem = Math.max(0, Math.min(C.GEM_IDLE.dailyCap, Math.floor(s.gemDay.claimedGem || 0)));
  s.qualityShards = Object.assign({ 1: 0, 2: 0, 3: 0, 4: 0 }, s.qualityShards || {});
  [1, 2, 3, 4].forEach(q => { s.qualityShards[q] = Math.max(0, Math.floor(Number(s.qualityShards[q]) || 0)); });
  s.campaign = s.campaign || { cleared: 0, storySeen: {} };
  s.campaign.milestones = s.campaign.milestones || {};
  // 三星评星：旧档回填已通关关卡 ★1（幂等），星宝箱领取记录兜底
  s.campaign.stars = s.campaign.stars || {};
  const clearedNow = Math.max(0, Math.floor(s.campaign.cleared || 0));
  for (let i = 1; i <= clearedNow; i++) { if (!s.campaign.stars[i]) s.campaign.stars[i] = 1; }
  s.campaign.starChests = s.campaign.starChests || {};
  if (!Array.isArray(s.campaign.retroGrants)) s.campaign.retroGrants = null;
  s.campaign.retroGrantsSeen = !!s.campaign.retroGrantsSeen;
  if (!Array.isArray(s.formation)) s.formation = [null, null, null, null, null];
  s.formation.length = 5;
  Object.keys(s.roster).forEach(id => {
    const h = s.roster[id]; if (!h) return;
    delete h.lv;
    if (!h.equip) h.equip = { weapon: null, armor: null, helm: null, boots: null };
    if (!Number.isFinite(h.star)) h.star = 0;
    if (!Number.isFinite(h.cards)) h.cards = 0;
  });
  if (s.battle.pending) {
    s.battle.lastSettled = { id: s.battle.pending.id, outcome: 'interrupted', gainedXP: 0, reward: null };
    s.battle.pending = null;
  }
}
function save() {
  if (state) {
    state.lastSeenTs = Math.max(state.lastSeenTs || 0, Date.now());
    idleTick();
  }
  rawSet(SAVE_KEY, state);
}
function withSavedMutation(mutate) {
  const original = state, backup = JSON.parse(JSON.stringify(state));
  try {
    const result = mutate();
    if (!result || result.ok === false) {
      state = original; mergeStateInPlace(original, backup);
      return result;
    }
    if (result.changed === false) return result;
    save();
    return result;
  } catch (err) {
    state = original; mergeStateInPlace(original, backup);
    return { ok: false, msg: '操作未保存，请重试', error: err && err.message };
  }
}
function getState() { return state; }

// ---------- 每日重置 ----------
function checkDailyReset() {
  // 时钟回拨防护：设备时间早于上次记录时当日不重置（挂机由 idleTick 的单调时钟兜底）。
  const now = Date.now();
  if (state.lastSeenTs && now + 1000 < state.lastSeenTs) return;
  const today = F.todayStr();
  if (state.daily.day !== today) {
    state.daily = { day: today, quests: {}, claimed: [], active: [] }; // trainingWins 练兵计数随日重置
    state.arena.attempts = C.ARENA.DAILY;
  }
  if (!state.bounty || state.bounty.day !== today) refreshBounties(today);
  if (!state.roamer || state.roamer.day !== today) refreshRoamer(today);
  if (state.fast.day !== today) state.fast = { day: today, count: 0 };
  if (state.buyLog.day !== today) state.buyLog = { day: today, buys: {} };
  if (state.ads.day !== today) state.ads = { day: today, counts: {} };
  // 元宝当日额度 00:00 重置；已积累的待领元宝跨天保留（待领总额封顶 5000）。
  if (!state.gemDay || state.gemDay.day !== today) state.gemDay = { day: today, claimedGem: 0 };
}

// ---------- 武将 ----------
function allRoster() {
  return Object.keys(state.roster).map(id => calcHero(id));
}
function getOwned(id) { return state.roster[id]; }
function addHeroCard(id) {
  const def = H.getHero(id);
  if (!def) return { id, isNew: false, autoStar: false, star: 0, cards: 0 };
  const before = state.roster[id] ? heroFeedback(id) : null;
  if (!state.roster[id]) {
    state.roster[id] = newHero(id);
    return { id, isNew: true, autoStar: false, fromStar: 0, star: 0, cards: 0, after: heroFeedback(id) };
  }
  const own = state.roster[id], fromStar = own.star || 0;
  const maxStar = C.RARITIES[def.rarity].maxStar;
  if (own.star < maxStar) {
    own.star += 1;
    const after = heroFeedback(id);
    return { id, isNew: false, autoStar: true, fromStar, star: own.star, maxStar, cards: own.cards || 0, before, after,
      powerDelta: after.power - before.power, statDelta: { hp: after.hp - before.hp, atk: after.atk - before.atk, def: after.def - before.def } };
  }
  // 满星后抽到同名卡：N/R 直接转铜钱（碎片对 N/R 无实用出口），SR/SSR 转对应品质碎片
  // （旧档已存同名卡原样保留）。
  if (def.rarity <= 2) {
    const goldGain = (C.DUPE_GOLD && C.DUPE_GOLD[def.rarity]) || 0;
    state.res.gold += goldGain;
    return { id, isNew: false, autoStar: false, fromStar, star: own.star, maxStar, cards: own.cards || 0,
      goldGain, overflow: true };
  }
  state.qualityShards[def.rarity] = (state.qualityShards[def.rarity] || 0) + 1;
  return { id, isNew: false, autoStar: false, fromStar, star: own.star, maxStar, cards: own.cards || 0,
    shardGain: 1, qualityShards: state.qualityShards[def.rarity], overflow: true };
}
// 品质碎片兑换：同品质 10 片换 1 张该品质任意武将卡（可解锁新将或给未满星将升星；
// 已满星武将不可兑换，避免"花 10 返 1"陷阱）。
function exchangeQualityShard(rarity, heroId) {
  return withSavedMutation(() => {
    const key = Math.floor(Number(rarity) || 0);
    if (![1, 2, 3, 4].includes(key)) return { ok: false, msg: '碎片品质无效' };
    const def = H.getHero(heroId);
    if (!def || def.rarity !== key) return { ok: false, msg: '请选择对应品质的武将' };
    if ((state.qualityShards[key] || 0) < 10) return { ok: false, msg: '碎片不足 10 片' };
    if (state.roster[heroId] && state.roster[heroId].star >= C.RARITIES[key].maxStar) {
      return { ok: false, msg: '该武将已满星，请选择未满星的武将' };
    }
    state.qualityShards[key] -= 10;
    const received = addHeroCard(heroId);
    return { ok: true, rarity: key, heroId, shards: state.qualityShards[key], spent: 10, ...received };
  });
}
function qualityShardInfo() {
  return { 1: state.qualityShards[1] || 0, 2: state.qualityShards[2] || 0, 3: state.qualityShards[3] || 0, 4: state.qualityShards[4] || 0, need: 10 };
}
function heroFeedback(id) {
  const h = calcHero(id);
  return { power: h.power, hp: h.stats.hp, atk: h.stats.atk, def: h.stats.def };
}
function crystalInfo() {
  return { top5: [], cap: state.player.level, count: Object.keys(state.roster).length };
}
function effectiveLevel(id) {
  return state.roster[id] ? state.player.level : 1;
}
function playerLevel() { return state.player.level; }
function playerXpNeeded(level) { return level >= C.MAX_LEVEL ? 0 : Math.floor(C.PLAYER_LEVEL.baseXP + C.PLAYER_LEVEL.stepXP * (level - 1)); }
function addPlayerXP(amount) {
  let gained = Math.max(0, Math.floor(Number(amount) || 0));
  if (state.player.level >= C.MAX_LEVEL) { state.player.exp = 0; return { gained: 0, before: C.MAX_LEVEL, after: C.MAX_LEVEL, exp: 0, need: 0 }; }
  const before = state.player.level;
  state.player.exp += gained;
  while (state.player.level < C.MAX_LEVEL && state.player.exp >= playerXpNeeded(state.player.level)) {
    state.player.exp -= playerXpNeeded(state.player.level);
    state.player.level += 1;
  }
  if (state.player.level >= C.MAX_LEVEL) state.player.exp = 0;
  return { gained, before, after: state.player.level, exp: state.player.exp, need: state.player.level >= C.MAX_LEVEL ? 0 : playerXpNeeded(state.player.level) };
}
function levelCap(id) {
  return C.MAX_LEVEL;
}
function calcHero(id) {
  const own = state.roster[id];
  const def = H.getHero(id);
  const lv = effectiveLevel(id);
  const star = own.star;
  const base = H.heroStatsStar(def, lv, star), bonus = getArmoryBonuses();
  // 战靴速度节点对基础速度只乘一次（1+spdPct）；行动时的速度光环在战斗内另行叠加，不在此重复。
  const stats = { hp: Math.floor(base.hp * (1 + bonus.hp)), atk: Math.floor(base.atk * (1 + bonus.atk)), def: Math.floor(base.def * (1 + bonus.def)), spd: Math.round(base.spd * (1 + (bonus.spdPct || 0)) * 1000) / 1000, crit: base.crit };
  const power = H.heroPower(def, lv, star) + Math.floor((stats.hp - base.hp) / 6 + (stats.atk - base.atk) * 2.2 + (stats.def - base.def) * 1.5);
  const passive = Object.assign({}, def.passive.mods || {});
  if (bonus.heal) passive.armoryHeal = bonus.heal;
  if (bonus.startShield) passive.armoryStartShield = bonus.startShield;
  if (bonus.startEnergy) passive.armoryStartEnergy = bonus.startEnergy;
  if (bonus.directDR) passive.armoryDirectDR = bonus.directDR;
  if (bonus.critDmg) passive.critDmg = (passive.critDmg || 0) + bonus.critDmg;
  if (bonus.energyGain) passive.energyGain = (passive.energyGain || 0) + bonus.energyGain;
  if (bonus.vamp) passive.vamp = (passive.vamp || 0) + bonus.vamp;
  if (bonus.thorns) passive.thorns = (passive.thorns || 0) + bonus.thorns;
  if (bonus.recvHeal) passive.recvHeal = bonus.recvHeal;
  return {
    id, name: def.name, surname: def.name.slice(0, 1), title: def.title, quote: def.quote,
    faction: def.faction, cls: def.cls,
    rarity: def.rarity, level: lv, realLevel: lv, star, cards: own.cards, ult: def.ult,
    passive, passiveDef: def.passive, stats, power, cap: levelCap(id),
    armory: bonus
  };
}
function getArmoryBonuses() {
  const empty = { hp: 0, atk: 0, def: 0, heal: 0, startShield: 0, startEnergy: 0, directDR: 0, spdPct: 0, nodes: {} };
  if (!state || !state.armory) return empty;
  const out = { hp: 0, atk: 0, def: 0, heal: 0, startShield: 0, startEnergy: 0, directDR: 0, spdPct: 0, nodes: {},
    critDmg: 0, energyGain: 0, vamp: 0, thorns: 0, recvHeal: 0 };
  IT.ARMORY_SLOTS.forEach(slot => {
    const id = state.armory.selected[slot.id], item = IT.CATALOG.find(x => x.id === id);
    if (!item || !state.armory.unlocked[id]) return;
    const mult = 1 + 0.1 * (state.armory.slotStars[slot.id] || 0);
    Object.keys(item.stats).forEach(k => { if (k === 'hp' || k === 'atk' || k === 'def') out[k] += item.stats[k] * mult; });
    if (item.effect === 'heal') out.heal = 0.08;
    if (item.effect === 'shield') out.startShield = 0.06;
    if (item.effect === 'energy') out.startEnergy = 10;
    if (item.effect === 'reduction') out.directDR = 0.03;
  });
  // 部位升星节点：只由部位星级决定，与所选军械无关；逐槽按百分点与名器固定效果相加。
  IT.ARMORY_SLOTS.forEach(slotDef => {
    const node = IT.slotNodeInfo(slotDef.id, state.armory.slotStars[slotDef.id]);
    out.nodes[slotDef.id] = node;
    if (!node || !node.current) return;
    if (node.stat === 'atk') out.atk += node.current;
    else if (node.stat === 'hp') out.hp += node.current;
    else if (node.stat === 'directDR') out.directDR += node.current;
    else if (node.stat === 'spd') out.spdPct += node.current;
    else if (node.stat === 'startShield') out.startShield += node.current;
    else if (node.stat === 'startEnergy') out.startEnergy += node.current;
  });
  // 锻造词条（六槽 5★ 后开启；方向互斥由 forgeSetDir 结构保证）
  Object.keys(state.armory.affixes || {}).forEach(slot => {
    const fx = state.armory.affixes[slot];
    if (!fx) return;
    fx.slots.forEach(a => {
      if (!a) return;
      out[a.stat] = (out[a.stat] || 0) + a.val;
    });
  });
  // 阵图（账号级三选一，已激活才生效）
  const motifActive = state.armory.motifs && state.armory.motifs.active;
  if (motifActive) {
    const m = C.MOTIFS.find(x => x.id === motifActive);
    if (m && state.armory.motifs.unlocked[m.id]) {
      const mb = motifBonusOf(m, motifPieces(m));
      Object.keys(mb).forEach(k => { out[k] = (out[k] || 0) + mb[k]; });
    }
  }
  return out;
}
function getArmoryState() {
  const a = state.armory;
  return { unlocked: Object.assign({}, a.unlocked), selected: Object.assign({}, a.selected), slotStars: Object.assign({}, a.slotStars), boxes: Object.assign({}, a.boxes), seen: Object.assign({}, a.seen), claimedMilestones: Object.assign({}, a.claimedMilestones), total: IT.CATALOG.length, unlockedCount: Object.keys(a.unlocked).filter(id => a.unlocked[id]).length, bonuses: getArmoryBonuses(), forgeOpen: forgeGateOpen() };
}
function armoryUnlock(itemId) {
  return withSavedMutation(() => {
    const item = IT.CATALOG.find(x => x.id === itemId);
    if (!item) return { ok:false, msg:'图鉴条目不存在' };
    if (state.armory.unlocked[item.id]) return { ok:false, msg:'图鉴已解锁' };
    const grade = IT.GRADES[item.q];
    if ((state.campaign.cleared || 0) < grade.unlockStage) return { ok:false, msg:'通关第' + grade.unlockStage + '关后开放' };
    if (item.q === 0) return { ok:false, msg:'凡铁军械已全部赠送' };
    if (state.res.iron < grade.cost) return { ok:false, msg:'精铁不足' };
    state.res.iron -= grade.cost; state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true;
    return { ok:true, itemId:item.id, cost:grade.cost };
  });
}
function armorySelect(slot, itemId) {
  return withSavedMutation(() => {
    const before = getArmoryBonuses(), item = IT.CATALOG.find(x => x.id === itemId);
    if (!IT.ARMORY_SLOTS.some(x => x.id === slot) || !item || item.slot !== slot) return { ok:false, msg:'部位或军械不匹配' };
    if (!state.armory.unlocked[itemId]) return { ok:false, msg:'请先解锁图鉴' };
    state.armory.selected[slot] = itemId;
    return { ok:true, selected:itemId, before, bonuses:getArmoryBonuses() };
  });
}
function applyArmoryRecommendations(recommendations) {
  const list = Array.isArray(recommendations) ? recommendations.slice() : [];
  if (!list.length) return { ok: false, msg: '当前没有可免费启用的军械' };
  return withSavedMutation(() => {
    const before = getArmoryBonuses(), applied = [];
    for (const rec of list) {
      const current = IT.CATALOG.find(x => x.id === state.armory.selected[rec.slot]);
      const next = IT.CATALOG.find(x => x.id === rec.toId);
      if (!current || !next || current.id !== rec.fromId || next.slot !== rec.slot || next.q >= 3 || !state.armory.unlocked[next.id]) return { ok: false, msg: '军械状态已变化，请重新查看建议' };
      const a = current.basePct || current.stats || {}, b = next.basePct || next.stats || {};
      const keys = new Set(Object.keys(a).concat(Object.keys(b)));
      let improved = false;
      for (const key of keys) { const av = Number(a[key]) || 0, bv = Number(b[key]) || 0; if (bv < av) return { ok: false, msg: '建议军械属性不再符合条件' }; if (bv > av) improved = true; }
      if (!improved || (current.effect || null) !== (next.effect || null)) return { ok: false, msg: '建议军械已不再提升属性' };
      state.armory.selected[rec.slot] = next.id;
      applied.push({ slot: rec.slot, fromId: current.id, toId: next.id });
    }
    const after = getArmoryBonuses();
    return { ok: true, applied, before, after };
  });
}
function armoryUpgrade(slot) {
  return withSavedMutation(() => {
    if (!IT.ARMORY_SLOTS.some(x => x.id === slot)) return { ok:false, msg:'部位不存在' };
    const before = getArmoryBonuses(), star = state.armory.slotStars[slot] || 0;
    if (star >= 5) return { ok:false, msg:'该部位已满星' };
    const iron = IT.STAR_NEEDS[star], gold = IT.STAR_GOLD[star];
    if (state.res.iron < iron) return { ok:false, msg:'精铁不足，还差' + (iron-state.res.iron) };
    if (state.res.gold < gold) return { ok:false, msg:'铜钱不足，还差' + (gold-state.res.gold) };
    const nodeBefore = IT.slotNodeInfo(slot, star);
    state.res.iron -= iron; state.res.gold -= gold; state.armory.slotStars[slot] = star + 1;
    const nodeAfter = IT.slotNodeInfo(slot, star + 1);
    const node = nodeAfter.tier > nodeBefore.tier
      ? { label: nodeAfter.label, from: nodeBefore.current, to: nodeAfter.current,
          unlocked: nodeBefore.tier === 0, enhanced: nodeBefore.tier === 1 }
      : null;
    return { ok:true, slot, stars:star+1, iron, gold, before, bonuses:getArmoryBonuses(), node };
  });
}
// 一键升到下个节点（0-2★→3★、3-4★→5★）：同一存档事务内检查全部费用，
// 不足时提示缺口且零扣款零升星；足够时一次扣款一次写档，返回节点解锁/增强与前后全军加成。
function armoryUpgradeToNode(slot) {
  return withSavedMutation(() => {
    if (!IT.ARMORY_SLOTS.some(x => x.id === slot)) return { ok:false, msg:'部位不存在' };
    const star = state.armory.slotStars[slot] || 0;
    const cost = IT.slotNodeCost(slot, star);
    if (!cost) return { ok:false, msg:'该部位已满星 · 节点已增强' };
    const lacks = [];
    if (state.res.iron < cost.iron) lacks.push('精铁还差 ' + (cost.iron - state.res.iron));
    if (state.res.gold < cost.gold) lacks.push('铜钱还差 ' + (cost.gold - state.res.gold));
    if (lacks.length) return { ok:false, msg:'材料不足：' + lacks.join('、'), need: cost };
    const before = getArmoryBonuses();
    const nodeBefore = IT.slotNodeInfo(slot, star);
    state.res.iron -= cost.iron; state.res.gold -= cost.gold;
    state.armory.slotStars[slot] = cost.to;
    const nodeAfter = IT.slotNodeInfo(slot, cost.to);
    return { ok:true, slot, fromStar: cost.from, toStar: cost.to, iron: cost.iron, gold: cost.gold,
      node: { label: nodeAfter.label, from: nodeBefore.current, to: nodeAfter.current,
        unlocked: nodeBefore.tier === 0, enhanced: nodeBefore.tier === 1 },
      before, bonuses: getArmoryBonuses() };
  });
}
// ---------- 锻造台 ----------
// 账号级门禁：六槽全部 5★ 后开启；词条值并入 getArmoryBonuses 单一出口。
function forgeGateOpen() {
  return IT.ARMORY_SLOTS.every(sl => (state.armory.slotStars[sl.id] || 0) >= 5);
}
function forgeInfo(slot) {
  const open = forgeGateOpen();
  const def = IT.ARMORY_SLOTS.find(x => x.id === slot);
  if (!def) return { ok: false, msg: '部位不存在' };
  const fx = (state.armory.affixes || {})[slot];
  const pools = C.FORGE.pools[slot];
  return {
    ok: true, slot, open,
    dir: fx ? fx.dir : null,
    slots: fx ? fx.slots : [null, null],
    pity: fx ? fx.pity : [0, 0],
    lock: fx ? fx.lock : [false, false],
    pools,
    freeRerolls: state.armory.freeRerolls == null ? C.FORGE.freeRerolls : state.armory.freeRerolls
  };
}
function forgeReroll(slot, idx) {
  return withSavedMutation(() => {
    if (!forgeGateOpen()) return { ok: false, msg: '锻造台尚未开启（六槽全部 5★ 后开启）' };
    if (idx !== 0 && idx !== 1) return { ok: false, msg: '词条位无效' };
    const fx = (state.armory.affixes || {})[slot];
    if (!fx || !fx.dir) return { ok: false, msg: '请先选择攻/守方向' };
    const cost = { gold: C.FORGE.reroll.gold, iron: C.FORGE.reroll.iron };
    if (fx.lock[1 - idx]) { cost.gold *= 2; cost.iron *= 2; } // 另一条已锁定：费用 ×2
    const freeLeft = state.armory.freeRerolls == null ? C.FORGE.freeRerolls : state.armory.freeRerolls;
    if (freeLeft <= 0) {
      if (state.res.gold < cost.gold) return { ok: false, msg: '铜钱不足，还差 ' + (cost.gold - state.res.gold) };
      if (state.res.iron < cost.iron) return { ok: false, msg: '精铁不足，还差 ' + (cost.iron - state.res.iron) };
      state.res.gold -= cost.gold;
      state.res.iron -= cost.iron;
    } else {
      state.armory.freeRerolls = freeLeft - 1;
    }
    // 50/50 定词条（另一词条位已占用的词条不重复出），再定档位；保底：连续 5 次未紫第 6 次必紫
    const pool = C.FORGE.pools[slot][idx === 0 ? fx.dir : (fx.dir === 'atk' ? 'def' : 'atk')].filter(a => {
      const other = fx.slots[1 - idx];
      return !(other && other.stat === a.stat);
    });
    const affix = pool[Math.floor(Math.random() * pool.length)];
    let tier;
    if (fx.pity[idx] >= C.FORGE.pity - 1) {
      tier = 2;
    } else {
      const r = Math.random();
      tier = r < C.FORGE.tiers.weights[2] ? 2 : r < C.FORGE.tiers.weights[2] + C.FORGE.tiers.weights[1] ? 1 : 0;
    }
    fx.pity[idx] = tier === 2 ? 0 : fx.pity[idx] + 1;
    fx.slots[idx] = { stat: affix.stat, name: affix.name, tier, val: affix.tiers[tier] };
    return { ok: true, slot, idx, affix: fx.slots[idx], pity: fx.pity[idx], freeUsed: freeLeft > 0 };
  });
}
function forgeSetDir(slot, dir) {
  return withSavedMutation(() => {
    if (!forgeGateOpen()) return { ok: false, msg: '锻造台尚未开启' };
    if (!['atk', 'def'].includes(dir)) return { ok: false, msg: '方向无效' };
    state.armory.affixes = state.armory.affixes || {};
    const prev = state.armory.affixes[slot];
    if (prev && prev.dir === dir) return { ok: true, changed: false };
    // 改向：第一词条位清空重选，第二位（另一池）同步作废；保底计数保留
    state.armory.affixes[slot] = {
      dir,
      slots: [null, null],
      pity: prev ? prev.pity : [0, 0],
      lock: [false, false]
    };
    return { ok: true, dir, changed: true };
  });
}
function forgeToggleLock(slot, idx) {
  return withSavedMutation(() => {
    if (!forgeGateOpen()) return { ok: false, msg: '锻造台尚未开启' };
    const fx = (state.armory.affixes || {})[slot];
    if (!fx || !fx.slots[idx]) return { ok: false, msg: '该词条位还没有词条' };
    fx.lock[idx] = !fx.lock[idx];
    return { ok: true, lock: fx.lock[idx] };
  });
}
function armoryClaimBox(q, itemId) {
  return withSavedMutation(() => armoryClaimBoxInternal(q, itemId));
}
function armoryClaimBoxInternal(q, itemId) {
  q = Number(q);
  if (![1,2,3].includes(q) || !(state.armory.boxes[q] > 0)) return { ok:false, msg:'没有可领取的自选箱' };
  const pool = IT.CATALOG.filter(x => x.q === q);
  if (itemId === 'convert') {
    if (pool.some(x => !state.armory.unlocked[x.id])) return { ok:false, msg:'仍有未解锁条目，请先选择军械' };
    const iron = IT.GRADES[q].duplicate; state.armory.boxes[q] -= 1; state.res.iron += iron;
    return { ok:true, iron, converted:true };
  }
  const item = pool.find(x => x.id === itemId);
  if (!item || state.armory.unlocked[item.id]) return { ok:false, msg:'请选择尚未解锁的对应品质军械' };
  state.armory.boxes[q] -= 1; state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true;
  return { ok:true, itemId:item.id };
}
function rollArmoryDrop(cleared) {
  const available = IT.GRADES.filter(g => g.q === 0 || cleared >= g.unlockStage);
  const total = available.reduce((sum,g) => sum + IT.DROP_QUALITY_WEIGHTS[g.q], 0);
  let roll = Math.random() * total, q = 0;
  for (const g of available) { roll -= IT.DROP_QUALITY_WEIGHTS[g.q]; if (roll < 0) { q = g.q; break; } }
  const pool = IT.CATALOG.filter(x => x.q === q);
  return grantArmoryItem(pool[Math.floor(Math.random()*pool.length)].id);
}
function levelUp(id, times) {
  return 0;
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
  if (!state.roster[id] || !H.getHero(id)) return { ok: false, msg: '未拥有该武将' };
  return { ok: false, msg: '抽到重复武将时会自动升星，无需手动操作或铜钱' };
}
function ascendPreview(id) {
  const own = state.roster[id];
  if (!own) return { ok: false, msg: '未拥有该武将' };
  const maxStar = C.RARITIES[H.getHero(id).rarity].maxStar;
  return { ok: true, from: own.star, to: Math.min(maxStar, own.star + 1), maxStar, cards: own.cards, level: state.player.level, can: false, auto: true };
}
function dismiss(id) {
  return { ok: false, msg: '武将本体永久保留；请在满星后兑换多余同名卡' };
}
function resetHero(id) {
  return { ok: false, msg: '所有武将共用玩家等级，无需重置' };
}

function convertCards(entries) {
  const rates = { 1: 1, 2: 3, 3: 15, 4: 60 };
  let total = 0, detail = [];
  (entries || []).forEach(x => {
    const own = state.roster[x.id], def = H.getHero(x.id), count = Math.floor(x.count || 0);
    if (!own || !def || own.lockedCards || count <= 0 || count > own.cards || own.star < C.RARITIES[def.rarity].maxStar || (def.rarity >= 3 && !x.confirmHigh)) return;
    total += count * rates[def.rarity]; own.cards -= count; detail.push({ id: x.id, count, shards: count * rates[def.rarity] });
  });
  if (!total) return { ok: false, msg: '没有可兑换的多余同名卡' };
  state.res.shard += total;
  return { ok: true, shards: total, detail };
}
function setCardsLocked(id, locked) {
  const own = state.roster[id];
  if (!own) return { ok: false, msg: '未拥有该武将' };
  own.lockedCards = !!locked;
  return { ok: true, locked: own.lockedCards };
}
function addChoiceVoucher(rarity, count) {
  const key = Number(rarity) === 4 || rarity === 'ssr' ? 'ssr' : 'sr';
  state.vouchers[key] = Math.max(0, state.vouchers[key] || 0) + Math.max(1, count || 1);
  return state.vouchers[key];
}
function useChoiceVoucher(rarity, id) {
  return withSavedMutation(() => {
    const key = Number(rarity) === 4 || rarity === 'ssr' ? 'ssr' : 'sr';
    const h = H.getHero(id);
    if (!h || h.rarity !== (key === 'ssr' ? 4 : 3)) return { ok: false, msg: '请选择对应稀有度的武将' };
    if (!(state.vouchers[key] > 0)) return { ok: false, msg: '自选券不足' };
    state.vouchers[key] -= 1;
    const received = addHeroCard(id);
    return { ok: true, ...received, level: state.player.level };
  });
}
function firstWinChoice() {
  return { available: !!state.heroProgress.firstWinChoicePending, claimed: !!state.heroProgress.firstWinChoiceGranted };
}
function claimFirstWinChoice(id) {
  return withSavedMutation(() => {
    if (!state.heroProgress.firstWinChoicePending || state.heroProgress.firstWinChoiceGranted || !['liubei', 'guanyu', 'zhangfei'].includes(id)) return { ok: false, msg: '当前不能领取该奖励' };
    const received = addHeroCard(id);
    state.heroProgress.firstWinChoicePending = false; state.heroProgress.firstWinChoiceGranted = true;
    return { ok: true, ...received };
  });
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
function applyFormation(ids) {
  if (!Array.isArray(ids) || ids.length !== 5) return { ok: false, msg: '编队数据无效' };
  const picked = ids.map(id => id || null), used = picked.filter(Boolean);
  if (new Set(used).size !== used.length || used.some(id => !state.roster[id] || !H.getHero(id))) return { ok: false, msg: '只能选择不重复的已拥有武将' };
  return withSavedMutation(() => { state.formation = picked; return { ok: true, formation: picked.slice() }; });
}
function setAutoBattleSpeed(speed) {
  const n = Number(speed);
  if (![1, 2, 4].includes(n)) return { ok: false, msg: '倍速无效' };
  return withSavedMutation(() => {
    state.settings = state.settings || {};
    state.settings.autoBattleSpeed = n;
    return { ok: true, speed: n };
  });
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
// 三国羁绊：编队同时上阵完整组合时，全军获得固定加成（注入各单元 passive，战斗内经 effStat 生效）
function activeBonds(formationIds = null) {
  const ids = new Set((formationIds || state.formation).filter(Boolean));
  return (H.BONDS || []).filter(b => b.heroes.every(h => ids.has(h)));
}
function bondMods() {
  const out = {};
  activeBonds().forEach(b => {
    Object.keys(b.mods).forEach(k => { out[k] = (out[k] || 0) + b.mods[k]; });
  });
  return out;
}
// 生成战斗用双方单元
function playerUnits() {
  const calc = getFormationCalc();
  const extra = bondMods();
  return calc.map((x, i) => {
    if (!x) return null;
    const u = buildUnit(x, 'A' + i, i <= 2 ? 0 : 1);
    if (Object.keys(extra).length) u.passive = Object.assign({}, u.passive, extra);
    return u;
  }).filter(Boolean);
}
function enemyUnits(units) {
  const H2 = __domain_heroes;
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
      level: u.level, star: u.star, stats, ult: u.hero.ult,
      passive: Object.assign({}, u.hero.passive.mods || {}, u.extraPassive || {}),
      isBoss: u.isBoss
    }, 'B' + i, u.row);
  });
}

// ---------- 装备 ----------
const FACTION_KEYS = ['wei', 'shu', 'wu', 'qun'];
function addEquip(q, slot) {
  const id = 'e' + (state.nextEquip++);
  const inst = { id, q, slot, stars: 0, faction: null };
  // SR/SSR 掉落自带阵营（对标 AFK 对属装备）
  if (q >= IT.FACTIONED_MIN_Q) inst.faction = FACTION_KEYS[Math.floor(Math.random() * FACTION_KEYS.length)];
  state.equips[id] = inst;
  if (Object.keys(state.equips).length > 300) {
    // 自动清理多余 N 品装备（R 及以上是升星狗粮，保留）
    const ids = Object.keys(state.equips).filter(x => !isEquipped(x) && state.equips[x].q === 1 && !state.equips[x].stars);
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
// 升星：吃掉 fodderIds 里的装备攒强化点 + 铜钱（对标 AFK 强化）
function enhanceEquip(instId, fodderIds) {
  const e = state.equips[instId];
  if (!e) return { ok: false, msg: '装备不存在' };
  const maxStar = IT.EQUIP_QUALITIES[e.q].maxStar;
  if (e.stars >= maxStar) return { ok: false, msg: '已满星' };
  const need = IT.starNeed(e.q, e.stars);
  const goldCost = IT.starGold(need);
  if (state.res.gold < goldCost) return { ok: false, msg: '铜钱不足' };
  const fodder = (fodderIds || [])
    .map(id => state.equips[id])
    .filter(x => x && x.id !== instId && !isEquipped(x.id));
  if (!fodder.length) return { ok: false, msg: '请选择要消耗的装备' };
  const pts = fodder.reduce((s, x) => s + IT.fodderPoints(x), 0);
  if (pts < need) return { ok: false, msg: '强化点不足 ' + pts + '/' + need };
  fodder.forEach(x => { delete state.equips[x.id]; });
  state.res.gold -= goldCost;
  e.stars += 1;
  return { ok: true, stars: e.stars };
}
// 一键放入：从可选狗粮里由低到高凑满强化点，返回建议消耗的 id 列表
function fodderPickIds(instId, ids) {
  const e = state.equips[instId];
  if (!e) return [];
  const maxStar = IT.EQUIP_QUALITIES[e.q].maxStar;
  if (e.stars >= maxStar) return [];
  const need = IT.starNeed(e.q, e.stars);
  const pool = (ids || [])
    .map(id => state.equips[id])
    .filter(x => x && x.id !== instId && !isEquipped(x.id))
    .sort((a, b) => IT.fodderPoints(a) - IT.fodderPoints(b));
  const picked = [];
  let pts = 0;
  for (const x of pool) {
    if (pts >= need) break;
    picked.push(x.id);
    pts += IT.fodderPoints(x);
  }
  return picked;
}
function salvageEquip(instId) {
  const e = state.equips[instId];
  if (!e || isEquipped(instId)) return { ok: false, msg: '无法分解' };
  const gold = Math.floor(IT.fodderPoints(e) * IT.GOLD_PER_POINT * 0.4);
  delete state.equips[instId];
  state.res.gold += gold;
  return { ok: true, gold };
}
// 批量分解：所有未穿戴的指定品质（默认 N）0 星装备
function salvageBatch(q) {
  const ids = Object.keys(state.equips)
    .filter(id => !isEquipped(id) && state.equips[id].q === (q || 1) && !state.equips[id].stars);
  let gold = 0, n = ids.length;
  ids.forEach(id => {
    gold += Math.floor(IT.fodderPoints(state.equips[id]) * IT.GOLD_PER_POINT * 0.4);
    delete state.equips[id];
  });
  state.res.gold += gold;
  return { ok: n > 0, count: n, gold };
}

// ---------- 挂机 ----------
// 元宝：固定 1000/小时，待领总额封顶 5000（跨天保留），当日可领受自然日 5 小时额度限制；
// 铜钱：随关卡线性，自然累计最多 12 小时；精铁：25/小时，自然累计最多 12 小时；
// 招募令：不再产出，旧档已积累的待领招募令原样保留、原样领取。
function idleTick() {
  // 把离线时间折算进累计（入 state.idle 缓存）；时钟回拨时按上次记录时间起算，不产生负收益
  const now = Math.max(state.lastSeenTs || 0, Date.now());
  const addH = Math.max(0, Math.min(C.IDLE_CAP_HOURS, (now - state.idle.last) / 3600000));
  const rate = C.idleRates(state.campaign.cleared);
  state.idle.gold += addH * rate.gold;
  if (state.idle.exp) { state.idle.gold += state.idle.exp; state.idle.exp = 0; }
  if (rate.scrollPerHour > 0) {
    state.idle.scroll += addH * rate.scrollPerHour;
    state.idle.scroll = Math.min(state.idle.scroll, C.IDLE_CAP_HOURS * rate.scrollPerHour);
  }
  state.idle.gem = Math.min(C.GEM_IDLE.dailyCap, (Number(state.idle.gem) || 0) + addH * C.GEM_IDLE.perHour);
  state.idle.ironAcc += addH * C.ARMORY_IRON_PER_HOUR;
  const capG = C.IDLE_CAP_HOURS * rate.gold;
  state.idle.gold = Math.min(state.idle.gold, capG);
  state.idle.ironAcc = Math.min(state.idle.ironAcc, C.IDLE_CAP_HOURS * C.ARMORY_IRON_PER_HOUR);
  state.idle.last = now;
}
function idlePending() {
  idleTick();
  const rate = C.idleRates(state.campaign.cleared);
  const gold = Math.floor(state.idle.gold), scroll = Math.floor(state.idle.scroll);
  const hours = rate.gold > 0 ? state.idle.gold / rate.gold : 0;
  const full = state.idle.gold >= C.IDLE_CAP_HOURS * rate.gold - 1;
  const quota = gemQuotaInfo();
  return { gold, exp: 0, scroll, iron: Math.floor(state.idle.ironAcc), hours, full, gem: quota };
}
// 当日元宝额度：自然领取与快速收获共用 5 小时／5000；待领元宝跨天保留。
function gemQuotaInfo() {
  checkDailyReset();
  const claimedGem = state.gemDay.claimedGem || 0;
  const remaining = Math.max(0, C.GEM_IDLE.dailyCap - claimedGem);
  const pending = Math.floor(state.idle.gem || 0);
  return {
    day: state.gemDay.day, claimedGem, remaining,
    claimable: Math.min(remaining, pending),
    pending, perHour: C.GEM_IDLE.perHour, cap: C.GEM_IDLE.dailyCap
  };
}
function claimIdleInternal(double) {
  idleTick();
  const rate = C.idleRates(state.campaign.cleared);
  const quota = gemQuotaInfo();
  let g = Math.floor(state.idle.gold), s = Math.floor(state.idle.scroll), iron = Math.floor(state.idle.ironAcc);
  // 元宝只按当日剩余额度领取，双倍不倍增元宝。
  const gem = Math.min(quota.remaining, Math.floor(state.idle.gem || 0));
  if (double) { g *= 2; }
  state.res.gold += g; state.res.scroll += s; state.res.iron += iron;
  state.res.gem += gem;
  state.idle.gold -= Math.floor(state.idle.gold); state.idle.scroll -= Math.floor(state.idle.scroll); state.idle.ironAcc -= iron;
  state.idle.gem = Math.max(0, (state.idle.gem || 0) - gem);
  state.gemDay.claimedGem = Math.min(C.GEM_IDLE.dailyCap, (state.gemDay.claimedGem || 0) + gem);
  const changed = !!(g || s || iron || gem);
  if (changed) bumpQuest('q_idle1', 1);
  return { ok: true, gold: g, exp: 0, scroll: s, iron, gem, gemClaimed: gem, double: !!double, changed, gemDay: gemQuotaInfo() };
}
function claimIdle(double) {
  return withSavedMutation(() => claimIdleInternal(double));
}
// 付费快速收获：只给铜钱／精铁（2 小时），不产生元宝、招募令。
function fastReward(free) {
  return withSavedMutation(() => fastRewardMutation(free));
}
function fastRewardMutation(free) {
  if (!free) {
    if (state.fast.count >= C.FAST_PAID.daily) return { ok: false, msg: '今日快速收获次数已用完' };
    if (state.res.gem < C.FAST_PAID.cost) return { ok: false, msg: '元宝不足' };
    state.res.gem -= C.FAST_PAID.cost;
    state.fast.count += 1;
    const rate = C.idleRates(state.campaign.cleared);
    const gold = Math.floor(C.FAST_PAID.hours * rate.gold), iron = Math.floor(C.FAST_PAID.hours * C.ARMORY_IRON_PER_HOUR);
    state.res.gold += gold; state.res.iron += iron;
    return { ok: true, gold, iron, paid: true };
  }
  return fastRewardAdMutation();
}
// 广告快速收获（在 adReward 事务内执行）：立即 1 小时收益——元宝 1000＋铜钱 1 小时＋精铁 25。
// 元宝占用当日 5 小时额度；铜钱／精铁直接入账，不占自然累计 12 小时。
function fastRewardAdMutation() {
  if (state.fast.count >= C.FAST_AD.daily) return { ok: false, msg: '今日快速收获次数已用完' };
  const quota = gemQuotaInfo();
  if (quota.remaining < C.FAST_AD.gem) return { ok: false, msg: '今日元宝额度不足，明天再来' };
  state.fast.count += 1;
  state.gemDay.claimedGem = Math.min(C.GEM_IDLE.dailyCap, (state.gemDay.claimedGem || 0) + C.FAST_AD.gem);
  state.res.gem += C.FAST_AD.gem;
  const rate = C.idleRates(state.campaign.cleared);
  const gold = Math.floor(C.FAST_AD.hours * rate.gold), iron = C.FAST_AD.iron;
  state.res.gold += gold; state.res.iron += iron;
  return { ok: true, gem: C.FAST_AD.gem, gold, iron, fastCount: state.fast.count, fastDaily: C.FAST_AD.daily };
}
// 广告成功次数与奖励的原子事务：次数已达上限→拒绝；grant 失败→回滚且不计次数；
// grant 成功→同一存档事务内发奖并记录次数，取代 UI 层先 adBump 再发奖。
function adReward(placement, grant) {
  return withSavedMutation(() => {
    const conf = C.AD.placements[placement];
    if (!conf) return { ok: false, msg: '未知的奖励入口' };
    if (adCount(placement) >= conf.limit) return { ok: false, msg: '今日该奖励次数已用完' };
    const result = grant ? grant() : null;
    if (!result || result.ok === false) return result || { ok: false, msg: '奖励发放失败，请重试' };
    adBump(placement);
    return Object.assign({ adCount: adCount(placement), adLimit: conf.limit }, result);
  });
}

// ---------- 广告 ----------
function adCount(placement) {
  if (!state.ads || state.ads.day !== F.todayStr()) return 0;
  return state.ads.counts[placement] || 0;
}
function adBump(placement) {
  if (!state.ads || state.ads.day !== F.todayStr()) state.ads = { day: F.todayStr(), counts: {} };
  state.ads.counts[placement] = (state.ads.counts[placement] || 0) + 1;
}

// ---------- 招募（四档固定概率 + 保底：十连必出 R+，40 抽必出 SSR）----------
function rollRarity(sinceSsr) {
  const g = C.GACHA.rates;
  const soft = C.GACHA.pity && C.GACHA.pity.soft;
  let ssrRate = g.ssr;
  const n = Math.floor(Number(sinceSsr) || 0) + 1; // 本抽是保底计数第 n 抽
  if (soft && n >= soft.from) ssrRate = Math.min(1, g.ssr + soft.step * (n - soft.from + 1));
  const r = Math.random();
  if (r < ssrRate) return 4;
  if (r < ssrRate + g.sr) return 3;
  if (r < ssrRate + g.sr + g.r) return 2;
  return 1;
}
function pickHeroOfRarity(rarity, focusFaction) {
  let pool = H.HEROES.filter(h => h.rarity === rarity);
  if (focusFaction && rarity >= 3 && Math.random() < C.SUMMON_TICKET.focusShare) {
    const sub = pool.filter(h => h.faction === focusFaction);
    if (sub.length) pool = sub;
  }
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function doSummon(type) {
  return withSavedMutation(() => doSummonMutation(type));
}
function doSummonMutation(type) {
  // type: scroll1 | scroll10 | gem1 | gem10（元宝单抽 100／十连 900，与招募令分开支付）
  const g = C.GACHA;
  const count = type === 'scroll1' || type === 'gem1' ? 1 : 10;
  let costOk = false;
  if (type === 'scroll1') {
    if (state.res.scroll >= 1) { state.res.scroll -= 1; costOk = true; }
  } else if (type === 'scroll10') {
    if (state.res.scroll >= 10) { state.res.scroll -= 10; costOk = true; }
  } else if (type === 'gem1') {
    if (state.res.gem >= g.singleGold) { state.res.gem -= g.singleGold; costOk = true; }
  } else {
    if (state.res.gem >= g.costTenGold) { state.res.gem -= g.costTenGold; costOk = true; }
  }
  if (!costOk) return { ok: false, msg: '招募令/元宝不足' };

  // 先定 rarity 再发卡：保底在 rarity 层生效（40 抽必出 SSR；十连无 R+ 时末位补 R）
  const pity = state.summon.pity || (state.summon.pity = { sinceSsr: 0 });
  const hard = (g.pity && g.pity.ssrHard) || 40;
  const rarities = [];
  for (let i = 0; i < count; i++) {
    state.summon.total += 1;
    let rarity;
    if (pity.sinceSsr >= hard - 1) {
      rarity = 4;
    } else {
      rarity = rollRarity(pity.sinceSsr);
    }
    if (rarity === 4) pity.sinceSsr = 0;
    else pity.sinceSsr += 1;
    rarities.push(rarity);
  }
  if (count === 10 && g.pity && g.pity.tenMinR && !rarities.some(r => r >= 2)) rarities[count - 1] = 2;
  // 定向招募券：十连且已激活阵营时消耗一张券，SR 以上 70% 落所选阵营
  let focusHit = 0;
  let focusUsed = null;
  const weekKey = F.isoWeekKey();
  if (count === 10 && state.summon.activeFocus &&
      (state.summon.ticketStock || 0) > 0 &&
      (state.summon.ticketWeek.week === weekKey ? state.summon.ticketWeek.used : 0) < C.SUMMON_TICKET.weeklyUseLimit) {
    state.summon.ticketStock -= 1;
    focusUsed = state.summon.activeFocus;
    state.summon.ticketWeek = { week: weekKey, used: (state.summon.ticketWeek.week === weekKey ? state.summon.ticketWeek.used : 0) + 1 };
    state.summon.activeFocus = null;
  }
  const results = rarities.map(rarity => {
    const id = pickHeroOfRarity(rarity, focusUsed);
    if (focusUsed && rarity >= 3 && id && H.getHero(id).faction === focusUsed) focusHit += 1;
    const received = addHeroCard(id);
    return { id, rarity, ...received };
  });
  // 每 10 抽赠 1 张定向券
  if (state.summon.total % C.SUMMON_TICKET.perPulls === 0) state.summon.ticketStock = (state.summon.ticketStock || 0) + 1;
  bumpQuest('q_summon1', 1);
  return { ok: true, results, pitySinceSsr: pity.sinceSsr, focusUsed, focusHit };
}
// ---------- 阵图（账号级三选一）----------
function motifPieces(m) {
  return m.slots.reduce((n, sl) => n + ((state.armory.slotStars[sl] || 0) >= 3 ? 1 : 0), 0);
}
function motifAllMaxed(m) {
  return m.slots.every(sl => (state.armory.slotStars[sl] || 0) >= 5);
}
function motifInfo() {
  const active = state.armory.motifs ? state.armory.motifs.active : null;
  const unlocked = (state.armory.motifs && state.armory.motifs.unlocked) || {};
  const list = C.MOTIFS.map(m => {
    const pieces = motifPieces(m);
    const isUnlocked = !!unlocked[m.id];
    return {
      id: m.id, name: m.name, desc: m.desc, slots: m.slots, pieces, need: 4,
      unlocked: isUnlocked, active: active === m.id,
      bonus: isUnlocked && active ? motifBonusOf(m, pieces) : null
    };
  });
  return { list, active };
}
function motifBonusOf(m, pieces) {
  const out = {};
  const merge = (mods) => Object.keys(mods || {}).forEach(k => { out[k] = (out[k] || 0) + mods[k]; });
  if (pieces >= 2) merge(m.two);
  if (pieces >= 4) merge(m.four);
  if (pieces >= 4 && motifAllMaxed(m)) merge(m.maxed);
  return out;
}
function motifActivate(id, payGold) {
  return withSavedMutation(() => {
    const m = C.MOTIFS.find(x => x.id === id);
    if (!m) return { ok: false, msg: '阵图不存在' };
    state.armory.motifs = state.armory.motifs || { active: null, unlocked: {} };
    if (state.armory.motifs.unlocked[id]) {
      state.armory.motifs.active = id; // 已解锁：免费切换
      return { ok: true, switched: true, name: m.name };
    }
    if (motifPieces(m) < 2) return { ok: false, msg: '指定部位至少 2 个达到 3★' };
    let iron = C.MOTIF_COST.iron, gold = 0;
    if (payGold) { gold = Math.min(iron, 20) * C.MOTIF_COST.goldPerIron; iron -= Math.min(iron, 20); gold += Math.max(0, iron - 20) * 0; }
    // 铜钱抵扣至多一半精铁（1 铁=40 铜钱）
    if (payGold) {
      const half = Math.floor(C.MOTIF_COST.iron / 2);
      gold = half * C.MOTIF_COST.goldPerIron; iron = C.MOTIF_COST.iron - half;
    }
    if (state.res.iron < iron) return { ok: false, msg: '精铁不足，还差 ' + (iron - state.res.iron) };
    if (state.res.gold < gold) return { ok: false, msg: '铜钱不足，还差 ' + (gold - state.res.gold) };
    state.res.iron -= iron; state.res.gold -= gold;
    state.armory.motifs.unlocked[id] = true;
    state.armory.motifs.active = id;
    return { ok: true, name: m.name, iron, gold };
  });
}
// ---------- 熔炉 ----------
function smeltInfo() {
  const stock = state.armory.smeltStock || {};
  const items = Object.keys(stock).map(itemId => {
    const cat = IT.CATALOG.find(x => x.id === itemId);
    return cat ? { id: itemId, name: cat.name, slot: cat.slot, q: cat.q, count: stock[itemId],
      meltIron: Math.floor(IT.GRADES[cat.q].duplicate * C.SMELT.meltRate) } : null;
  }).filter(Boolean);
  return { stock: items, recipes: C.SMELT.recipes };
}
function smeltMelt(itemId) {
  return withSavedMutation(() => {
    const stock = state.armory.smeltStock || {};
    const cat = IT.CATALOG.find(x => x.id === itemId);
    if (!cat || !stock[itemId]) return { ok: false, msg: '库存中没有该军械' };
    const iron = Math.floor(IT.GRADES[cat.q].duplicate * C.SMELT.meltRate);
    delete stock[itemId];
    state.res.iron += iron;
    return { ok: true, iron, name: cat.name };
  });
}
function smeltCombine(slot, q) {
  return withSavedMutation(() => {
    const recipe = C.SMELT.recipes[q];
    if (!recipe || q > 2) return { ok: false, msg: '该品质不可合成（SR/SSR 不可合成）' };
    const stock = state.armory.smeltStock = state.armory.smeltStock || {};
    const cand = Object.keys(stock).filter(id => {
      const cat = IT.CATALOG.find(x => x.id === id);
      return cat && cat.slot === slot && cat.q === q - 1; // 消耗低一档库存
    });
    const have = cand.reduce((n, id) => n + stock[id], 0);
    if (have < recipe.need) return { ok: false, msg: `同槽 ${q === 1 ? 'N' : 'R'} 军械不足（${have}/${recipe.need}）` };
    if (state.res.iron < recipe.iron) return { ok: false, msg: '精铁不足' };
    if (state.res.gold < recipe.gold) return { ok: false, msg: '铜钱不足' };
    let need = recipe.need;
    cand.forEach(id => {
      while (need > 0 && stock[id] > 0) { stock[id] -= 1; need -= 1; }
      if (stock[id] <= 0) delete stock[id];
    });
    state.res.iron -= recipe.iron; state.res.gold -= recipe.gold;
    // 产物=同槽随机未解锁条目；全解锁则自动折精铁
    const pool = IT.CATALOG.filter(x => x.slot === slot && x.q === q && !state.armory.unlocked[x.id]);
    if (pool.length) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true;
      return { ok: true, itemId: item.id, name: item.name };
    }
    const iron = IT.GRADES[q + 1].duplicate;
    state.res.iron += iron;
    return { ok: true, convertedIron: iron };
  });
}
// 重复掉落改入熔炉库存（图鉴未解锁仍直接解锁）
function grantArmoryItem(itemId) {
  const item = IT.CATALOG.find(x => x.id === itemId);
  if (!item) return { ok: false, msg: '军械奖励无效' };
  if (state.armory.unlocked[item.id]) {
    if ((state.campaign.cleared || 0) >= 25) {
      // 25 关后重复件入熔炉库存（可零损耗熔回 70% 或攒合成）
      const stock = state.armory.smeltStock = state.armory.smeltStock || {};
      stock[itemId] = Math.min(C.SMELT.stockCap, (stock[itemId] || 0) + 1);
      return { ok: true, duplicate: true, smelted: true, itemId };
    }
    const iron = IT.GRADES[item.q].duplicate;
    state.res.iron += iron;
    return { ok: true, duplicate: true, iron, itemId };
  }
  state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true;
  return { ok: true, duplicate: false, itemId };
}
// ---------- 定向招募券 / 招贤值 / 万能 SSR 卡 ----------
function setSummonFocus(f) {
  return withSavedMutation(() => {
    if (f === null) { state.summon.activeFocus = null; return { ok: true, focus: null }; }
    if (!['wei', 'shu', 'wu', 'qun'].includes(f)) return { ok: false, msg: '阵营无效' };
    if ((state.summon.ticketStock || 0) <= 0) return { ok: false, msg: '没有定向招募券' };
    const weekKey = F.isoWeekKey();
    const used = state.summon.ticketWeek.week === weekKey ? state.summon.ticketWeek.used : 0;
    if (used >= C.SUMMON_TICKET.weeklyUseLimit) return { ok: false, msg: '本周定向次数已用完（每周 2 张）' };
    if (state.summon.activeFocus === f) return { ok: false, msg: '已选定该阵营' };
    state.summon.activeFocus = f;
    return { ok: true, focus: f };
  });
}
function summonTicketInfo() {
  const weekKey = F.isoWeekKey();
  const used = state.summon.ticketWeek.week === weekKey ? state.summon.ticketWeek.used : 0;
  return { stock: state.summon.ticketStock || 0, used, limit: C.SUMMON_TICKET.weeklyUseLimit,
    activeFocus: state.summon.activeFocus || null, canArm: (state.summon.ticketStock || 0) > 0 && used < C.SUMMON_TICKET.weeklyUseLimit };
}
function summonPointsInfo() {
  const total = (state.summon && state.summon.total) || 0;
  const claimed = state.summon.pointClaims || [];
  const list = C.SUMMON_POINTS.map((t, i) => ({
    tier: i, need: t.need, label: t.label,
    claimed: claimed.indexOf(i) >= 0,
    claimable: claimed.indexOf(i) < 0 && total >= t.need
  }));
  return { total, list, canClaim: list.some(x => x.claimable) };
}
function claimSummonPoints(tier) {
  return withSavedMutation(() => {
    const info = summonPointsInfo();
    const entry = info.list[tier];
    if (!entry) return { ok: false, msg: '档位不存在' };
    if (entry.claimed) return { ok: false, msg: '已领取' };
    if (!entry.claimable) return { ok: false, msg: '招贤值尚未达标' };
    state.summon.pointClaims = state.summon.pointClaims || [];
    state.summon.pointClaims.push(tier);
    const def = C.SUMMON_POINTS[tier];
    applyReward(def.reward);
    return { ok: true, label: def.label };
  });
}
function useUniversalSsr(heroId) {
  return withSavedMutation(() => {
    if ((state.res.univSsr || 0) <= 0) return { ok: false, msg: '没有万能 SSR 卡' };
    const def = H.getHero(heroId);
    if (!def || def.rarity !== 4) return { ok: false, msg: '请选择 SSR 武将' };
    const own = state.roster[heroId];
    if (own && own.star >= C.RARITIES[4].maxStar) return { ok: false, msg: '该武将已满星' };
    state.res.univSsr -= 1;
    const received = addHeroCard(heroId);
    return { ok: true, heroId, ...received };
  });
}
// 点将台保底进度（供 UI 显示）
function summonPityInfo() {
  const pity = (state.summon && state.summon.pity) || { sinceSsr: 0 };
  const hard = (C.GACHA.pity && C.GACHA.pity.ssrHard) || 40;
  const soft = (C.GACHA.pity && C.GACHA.pity.soft) || null;
  return { sinceSsr: Math.min(pity.sinceSsr, hard - 1), ssrHard: hard, total: (state.summon && state.summon.total) || 0,
    soft, softActive: !!(soft && pity.sinceSsr + 1 > soft.from) };
}
function grantCard(id) {
  return withSavedMutation(() => ({ ok: true, ...addHeroCard(id) }));
}

// ---------- 战役 / 塔 / 演武 ----------
// 章末（每章第 10 关）与第一期里程碑在普通首通之外；预览与结算共用 campaignFirstReward。
const CHAPTER_CHEST = { gem: 100, scroll: 1 };
const LEGACY_BOX_STAGES = { 10: 1, 30: 2, 60: 3 };
const BOX_Q_NAME = { 1: 'R', 2: 'SR', 3: 'SSR' };

// 首通铜钱：一期线性（3000＋150×关），循环乱世（>120）沿用旧指数曲线。
function firstClearGold(stage) {
  return stage <= C.FIRST_STAGE_END
    ? 3000 + 150 * stage
    : Math.floor(2000 * Math.pow(1.05, stage)) + Math.floor(1400 * Math.pow(1.05, stage));
}
function repeatGold(stage) {
  // 重复通关改线性：与首通同量级，铜钱本身已严重溢出，不再指数放大
  return 800 + 12 * stage;
}

// 首通奖励统一计算，返回 base／chapter／milestones／randomDrop 结构供页面分区显示。
// 里程碑只列「尚未领取」的项；实际入账与打标在 winCampaign 内完成。
function campaignFirstReward(stageIdx) {
  const inFirst = stageIdx <= C.FIRST_STAGE_END;
  const isBoss = stageIdx % 10 === 0;
  const base = { gem: 30, gold: firstClearGold(stageIdx), scroll: 0 };
  let chapter = null;
  if (isBoss) {
    chapter = inFirst
      ? { gem: 100, scroll: 2, label: '章末奖励' }
      : { gem: CHAPTER_CHEST.gem, scroll: 1 + CHAPTER_CHEST.scroll, label: '章末宝箱' };
  }
  const milestones = [];
  if (inFirst) {
    const ms = C.CAMPAIGN_MILESTONES[stageIdx];
    if (ms && !state.campaign.milestones[stageIdx]) {
      milestones.push({ stage: stageIdx, kind: 'milestone', reward: ms, label: ms.label || '里程碑奖励' });
    }
    const legacyQ = LEGACY_BOX_STAGES[stageIdx] || 0;
    if (legacyQ && !state.armory.claimedMilestones[legacyQ]) {
      milestones.push({ stage: stageIdx, kind: 'armoryBox', boxQ: legacyQ, reward: { armoryBox: legacyQ },
        label: BOX_Q_NAME[legacyQ] + ' 军械自选箱 ×1' });
    }
    if (stageIdx >= 10 && !state.heroProgress.chapterOneVoucherGranted) {
      milestones.push({ stage: stageIdx, kind: 'srVoucher', reward: { srPick: 1 }, label: 'SR 武将自选券 ×1' });
    }
  }
  const totals = {
    gem: base.gem + (chapter ? chapter.gem : 0),
    gold: base.gold,
    scroll: base.scroll + (chapter ? chapter.scroll : 0) + milestones.reduce((s, m) => s + (m.reward.scroll || 0), 0)
  };
  return { stage: stageIdx, isBoss, base, chapter, milestones, randomDrop: { armoryChance: 0.65 }, totals,
    gold: totals.gold, gem: totals.gem, scroll: totals.scroll,
    finale: stageIdx === C.FIRST_STAGE_END };
}

function campaignRewardPreview(stageIdx) {
  stageIdx = Math.max(1, Math.floor(Number(stageIdx) || 1));
  const first = stageIdx === state.campaign.cleared + 1;
  const { isBoss } = __domain_stages.chapterOf(stageIdx);
  if (!first) {
    const gold = repeatGold(stageIdx);
    return { first: false, stage: stageIdx, gold, gem: 0, scroll: 0, armoryChance: 0, isBoss,
      base: { gem: 0, gold, scroll: 0 }, chapter: null, milestones: [], randomDrop: null,
      totals: { gem: 0, gold, scroll: 0 }, finale: false };
  }
  return Object.assign(campaignFirstReward(stageIdx), { first: true });
}

function winCampaign(stageIdx, result) {
  // stageIdx 从 1 开始；奖励入账与预览共用 campaignFirstReward，重复打关只给循环铜钱。
  // result: { stars, elite } 由 settleBattle 传入（评星与精锐标记）。
  const first = stageIdx === state.campaign.cleared + 1;
  const reward = { stage: stageIdx, first, gold: 0, gem: 0, scroll: 0, armory: null, armoryBox: null,
    chest: null, milestones: [], base: null, chapter: null, randomDrop: null, finale: false,
    stars: result && result.stars || 0, elite: !!(result && result.elite), eliteDrop: null, dailyChest: null };
  if (!first) {
    reward.gold = repeatGold(stageIdx);
    applyReward(reward);
    return reward;
  }
  // 精锐关首通：额外一次随机军械掉落（评审团波次 1，新增精铁经重复转化 ≤600/30 天红线内）
  if (reward.elite) reward.eliteDrop = rollArmoryDrop(stageIdx);
  // 今日目标关：每日首个精锐关胜利发日宝箱（铜钱+三选一随机）
  if (reward.elite && !state.daily.eliteChestClaimed) {
    state.daily.eliteChestClaimed = true;
    const pick = C.DAILY_ELITE_CHEST.pick[Math.floor(Math.random() * C.DAILY_ELITE_CHEST.pick.length)];
    applyReward(Object.assign({ gold: C.DAILY_ELITE_CHEST.gold }, pick));
    reward.dailyChest = { gold: C.DAILY_ELITE_CHEST.gold, pick };
  }
  state.campaign.cleared = stageIdx;
  const calc = campaignFirstReward(stageIdx);
  reward.base = calc.base; reward.chapter = calc.chapter; reward.milestones = calc.milestones;
  reward.randomDrop = calc.randomDrop;
  reward.gold = calc.totals.gold; reward.gem = calc.totals.gem; reward.scroll = calc.totals.scroll;
  // 基础＋章末＋里程碑资源一次入账
  applyReward({ gold: reward.gold, gem: reward.gem, scroll: reward.scroll });
  // 里程碑逐项打一次性标记并发放对应道具
  calc.milestones.forEach(m => {
    if (m.kind === 'milestone') {
      state.campaign.milestones[m.stage] = 1;
      if (m.reward.ssrPick) addChoiceVoucher('ssr', m.reward.ssrPick);
      if (m.reward.srPick) addChoiceVoucher('sr', m.reward.srPick);
      if (m.reward.armoryBox) {
        state.armory.boxes[m.reward.armoryBox] = (state.armory.boxes[m.reward.armoryBox] || 0) + 1;
        reward.armoryBox = m.reward.armoryBox;
      }
    } else if (m.kind === 'armoryBox') {
      state.armory.claimedMilestones[m.boxQ] = true;
      state.armory.boxes[m.boxQ] = (state.armory.boxes[m.boxQ] || 0) + 1;
      reward.armoryBox = m.boxQ;
    } else if (m.kind === 'srVoucher') {
      state.heroProgress.chapterOneVoucherGranted = true;
      state.vouchers.sr += 1;
    }
  });
  if (Math.random() < calc.randomDrop.armoryChance) {
    reward.armory = rollArmoryDrop(stageIdx);
  }
  reward.finale = calc.finale;
  return reward;
}

// ---------- 章节星宝箱 ----------
// 章程星 = 该章 10 关评星之和；10/20/30★ 三档宝箱（刻意不含精铁），可一键领取全部可达宝箱。
function chapterStarsOf(chIdx) {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (state.campaign.stars && state.campaign.stars[chIdx * 10 + i + 1]) || 0;
  return sum;
}
function campaignStarChestInfo() {
  const out = [];
  const chapters = Math.max(1, Math.ceil(Math.min(C.FIRST_STAGE_END, Math.max(1, state.campaign.cleared)) / 10));
  for (let ch = 0; ch < chapters; ch++) {
    const stars = chapterStarsOf(ch);
    const claimed = state.campaign.starChests[ch] || {};
    const chests = C.CHAPTER_STAR_CHESTS.map((t, tier) => ({
      tier, need: t.need, label: t.label, claimed: !!claimed[tier],
      claimable: !claimed[tier] && stars >= t.need
    }));
    out.push({ chapter: ch + 1, stars, chests });
  }
  return { chapters: out, claimable: out.some(c => c.chests.some(t => t.claimable)) };
}
function claimStarChests() {
  return withSavedMutation(() => {
    const info = campaignStarChestInfo();
    if (!info.claimable) return { ok: false, msg: '暂无可领取的星宝箱' };
    const got = [];
    info.chapters.forEach(c => c.chests.forEach(t => {
      if (!t.claimable) return;
      state.campaign.starChests[c.chapter - 1] = state.campaign.starChests[c.chapter - 1] || {};
      state.campaign.starChests[c.chapter - 1][t.tier] = true;
      const def = C.CHAPTER_STAR_CHESTS[t.tier];
      applyReward(def.reward);
      got.push(`第${c.chapter}章 ${def.label}`);
    }));
    return { ok: true, got };
  });
}

// ---------- 剧情关卡 ----------
// 旧档更新后的一次性补发摘要：读取后由页面展示，dismissRetroGrants 标记已读不再显示。
function retroGrants() {
  return Array.isArray(state.campaign.retroGrants) ? state.campaign.retroGrants : null;
}
function dismissRetroGrants() {
  return withSavedMutation(() => {
    if (!state.campaign.retroGrants || state.campaign.retroGrantsSeen) return { ok: true, changed: false };
    state.campaign.retroGrantsSeen = true;
    return { ok: true, changed: true };
  });
}
function markStorySeen(stageIdx) {
  if (!state.campaign.storySeen) state.campaign.storySeen = {};
  state.campaign.storySeen[stageIdx] = 1;
}
function isStorySeen(stageIdx) {
  return !!(state.campaign.storySeen && state.campaign.storySeen[stageIdx]);
}
function winTower(floor) {
  const first = floor === state.tower.best + 1;
  const reward = { gem: 0, scroll: 0, shard: 0, iron: 0 };
  if (first) {
    state.tower.best = floor;
    reward.gem = 30 + floor * 2;
    reward.iron = Math.floor(2 + floor / 3); // 塔是精铁副产线（60 层约 780，不动 30 天主口径）
    if (floor % 5 === 0) reward.scroll = 1;
    if (floor % 10 === 0) reward.shard = 10;
  }
  applyReward(reward);
  return reward;
}
function arenaFight(win, diff, reserved) {
  if (!reserved) state.arena.attempts = Math.max(0, state.arena.attempts - 1);
  let delta = 0, tokens = 0;
  if (win) {
    delta = Math.round(14 + 8 * diff);
    tokens = C.ARENA.winTokens ? C.ARENA.winTokens(diff) : C.ARENA.WIN_TOKENS;
    state.arena.wins += 1;
  } else {
    delta = -8;
    tokens = C.ARENA.LOSE_TOKENS;
    state.arena.losses += 1;
  }
  state.arena.points = Math.max(0, state.arena.points + delta);
  state.res.token += tokens;
  // 段位首次达成：一次性奖励（元宝+精铁），只发一次不重复
  let rankUp = null;
  const rank = IT.arenaRank(state.arena.points);
  if (!state.arena.rankReached[rank]) {
    state.arena.rankReached[rank] = 1;
    const bonus = C.ARENA.rankBonus;
    applyReward(bonus);
    rankUp = { name: rank, ...bonus };
  }
  bumpQuest('q_arena1', 1);
  return { delta, tokens, points: state.arena.points, rankUp };
}

// 每个对局开始时发ID并冻结等级/关卡；同一结算ID幂等，所有变化一次保存。
function beginBattle(spec) {
  spec = spec || {};
  if (state.battle.pending) {
    return { ok: false, msg: '已有未结束战斗，请先结束或中断' };
  }
  if (spec.mode === 'arena') {
    if (state.arena.attempts <= 0) return { ok: false, msg: '今日演武次数不足' };
    state.arena.attempts -= 1;
  }
  const original = state, backup = JSON.parse(JSON.stringify(state));
  const seq = state.battle.nextSeq++;
  const id = 'b' + seq;
  const mode = spec.mode || 'campaign', index = spec.index || 0;
  const first = mode === 'campaign' ? index === state.campaign.cleared + 1
    : mode === 'tower' ? index === state.tower.best + 1 : false;
  state.battle.pending = {
    id, mode, index,
    referenceLevel: Math.max(1, Math.floor(spec.referenceLevel || state.player.level)),
    levelAtStart: state.player.level, first,
    diff: spec.diff || 1, startedAt: Date.now()
  };
  try { save(); } catch (err) {
    state = original; mergeStateInPlace(original, backup);
    return { ok: false, msg: '战斗未能保存', error: err && err.message };
  }
  return { ok: true, ...state.battle.pending };
}

function interruptBattle(battleId, reason) {
  const pending = state.battle.pending;
  if (!pending || pending.id !== battleId) return { ok: false, msg: '战斗已失效' };
  const original = state, backup = JSON.parse(JSON.stringify(state));
  state.battle.pending = null;
  state.battle.lastSettled = { id: battleId, outcome: 'interrupted', gainedXP: 0, reward: null, reason: reason || 'interrupted' };
  try { save(); return { ok: true, id: battleId }; }
  catch (err) {
    state = original; mergeStateInPlace(original, backup);
    return { ok: false, msg: '中断状态未保存', error: err && err.message };
  }
}

function battleXP(pending, win) {
  const base = C.BATTLE_XP.base + C.BATTLE_XP.perEnemyLevel * pending.referenceLevel;
  // 败北也有少量经验：战役/塔按基础 25%，让"打不过也有进展"；练兵/演武败北不给。
  if (!win) {
    if (state.player.level >= C.MAX_LEVEL) return 0;
    if (pending.mode === 'campaign') return Math.floor(base * 0.25);
    if (pending.mode === 'tower') return Math.floor(base * 0.25);
    return 0;
  }
  if (state.player.level >= C.MAX_LEVEL) return 0;
  if (pending.mode === 'campaign') {
    if (pending.first) return Math.floor(base * C.BATTLE_XP.campaignFirst);
    const rate = Math.max(0.2, Math.min(1, pending.referenceLevel / Math.max(1, pending.levelAtStart)));
    return Math.floor(base * C.BATTLE_XP.campaignRepeat * rate);
  }
  if (pending.mode === 'tower') return pending.first ? Math.floor(base * C.BATTLE_XP.towerFirst) : 0;
  if (pending.mode === 'arena') return Math.floor(base * C.BATTLE_XP.arenaWin);
  if (pending.mode === 'training') {
    // 练兵经验每日上限：前 N 场全额，之后 0（切断"无限练兵=免费等级"）
    const done = (state.daily.trainingWins || 0);
    return done < C.TRAINING_DAILY_CAP ? Math.floor(base * C.BATTLE_XP.training) : 0;
  }
  return 0;
}

function settleBattle(battleId, outcome) {
  outcome = outcome || {};
  const last = state.battle.lastSettled;
  if (last && last.id === battleId) return { ok: true, alreadySettled: true, ...last.summary };
  const pending = state.battle.pending;
  if (!pending || pending.id !== battleId) return { ok: false, msg: '战斗已失效，未发放奖励' };

  const original = state, backup = JSON.parse(JSON.stringify(state));
  state = JSON.parse(JSON.stringify(state));
  try {
    checkDailyReset();
    const win = outcome.win === true;
    let reward = null;
    if (pending.mode === 'campaign') {
      if (win) {
        const stageStars = __domain_stages.stageStars(win, outcome.duration || 0,
          Number(outcome.aliveCount) || 0, __domain_stages.isEliteStage(pending.index));
        state.campaign.stars = state.campaign.stars || {};
        state.campaign.stars[pending.index] = Math.max(state.campaign.stars[pending.index] || 0, stageStars);
        reward = winCampaign(pending.index, { stars: stageStars, elite: __domain_stages.isEliteStage(pending.index) });
        reward.stars = stageStars;
        if (pending.index === 1 && !state.heroProgress.firstWinChoiceGranted && !state.heroProgress.firstWinChoicePending) state.heroProgress.firstWinChoicePending = true;
        if (pending.index >= 10 && !state.heroProgress.chapterOneVoucherGranted) {
          state.vouchers.sr += 1; state.heroProgress.chapterOneVoucherGranted = true;
        }
      }
    } else if (pending.mode === 'tower') {
      if (win) reward = winTower(pending.index);
    } else if (pending.mode === 'arena') {
      reward = arenaFight(win, pending.diff, true);
    }
    if (win) { bumpQuest('q_battle1', 1); bumpQuest('q_win3', 1); }
    if (pending.mode === 'tower') bumpQuest('q_tower1', 1);
    if (pending.mode === 'training' && win) state.daily.trainingWins = (state.daily.trainingWins || 0) + 1;
    const xp = battleXP(pending, win);
    const level = addPlayerXP(xp);
    state.battle.pending = null;
    const summary = {
      id: battleId, mode: pending.mode, outcome: win ? 'win' : 'loss',
      levelBefore: level.before, levelAfter: level.after, gainedXP: level.gained,
      playerExp: level.exp, needXP: level.need, reward, firstWinChoicePending: state.heroProgress.firstWinChoicePending
    };
    state.battle.lastSettled = { id: battleId, outcome: summary.outcome, gainedXP: level.gained, reward, summary };
    const committed = state;
    state = original;
    mergeStateInPlace(original, committed);
    save();
    return { ok: true, alreadySettled: false, ...summary };
  } catch (err) {
    state = original;
    mergeStateInPlace(original, backup);
    return { ok: false, msg: '结算未保存，请重试', error: err && err.message };
  }
}

function mergeStateInPlace(target, source) {
  Object.keys(target).forEach(k => { if (!(k in source)) delete target[k]; });
  Object.keys(source).forEach(k => {
    const a = target[k], b = source[k];
    if (Array.isArray(b)) target[k] = b.slice();
    else if (b && typeof b === 'object') {
      if (!a || typeof a !== 'object' || Array.isArray(a)) target[k] = {};
      mergeStateInPlace(target[k], b);
    } else target[k] = b;
  });
}

// ---------- 悬赏派遣 ----------
// 每日 4 单；gold 随主线进度最高翻倍，gem/scroll 固定（刻意不含精铁，保护 30 天满星日历）。
function bountyScaleReward(reward) {
  const scale = 1 + Math.min(1, (state.campaign.cleared || 0) / 120);
  const out = {};
  Object.keys(reward).forEach(k => {
    out[k] = k === 'gold' ? Math.floor(reward[k] * scale) : reward[k];
  });
  return out;
}
function pickBountyTask() {
  const pool = C.BOUNTY.pool;
  const total = pool.reduce((s, t) => s + t.weight, 0);
  let roll = Math.random() * total;
  for (const t of pool) { roll -= t.weight; if (roll < 0) return t; }
  return pool[pool.length - 1];
}
// 刷新时：到期未领的旧单自动补发；进行中单原样结转（不跨日作废）；已领丢弃；新单补足到 slots。
function refreshBounties(today) {
  const old = state.bounty && Array.isArray(state.bounty.list) ? state.bounty.list : [];
  const now = Date.now();
  const carried = [];
  const settled = [];
  old.forEach(b => {
    if (!b || !b.heroId || b.claimed) return;
    if (now - b.dispatchedAt >= b.hours * 3600000) { applyReward(b.reward); settled.push(b.name); }
    else carried.push(b);
  });
  if (settled.length) {
    state.bounty.unreadGrants = [today, (state.bounty.unreadGrants && state.bounty.unreadGrants[0]) || today,
      settled.length].slice(0, 3);
  }
  const list = carried.slice();
  // 前 3 单从池中不重复抽取，最后一单加权放回（池仅 3 种，允许 1 张重复）
  const pool = C.BOUNTY.pool;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  while (list.length < C.BOUNTY.slots) {
    const t = list.length < C.BOUNTY.slots - 1
      ? shuffled[list.length % shuffled.length]
      : pickBountyTask();
    list.push({ hours: t.hours, name: t.name, reward: bountyScaleReward(t.reward),
      heroId: null, dispatchedAt: 0, claimed: false });
  }
  state.bounty = { day: today, list };
}
function bountyInfo() {
  checkDailyReset();
  const now = Date.now();
  const list = (state.bounty.list || []).map((b, idx) => {
    const elapsed = b.heroId ? now - b.dispatchedAt : 0;
    const remainMs = b.heroId ? Math.max(0, b.hours * 3600000 - elapsed) : 0;
    return {
      idx, name: b.name, hours: b.hours, reward: b.reward, heroId: b.heroId,
      state: b.claimed ? 'claimed' : (b.heroId && remainMs <= 0 ? 'done' : b.heroId ? 'running' : 'open'),
      remainMs: Math.ceil(remainMs / 60000) * 60000
    };
  });
  const busy = {};
  list.forEach(b => { if (b.heroId && b.state !== 'claimed') busy[b.heroId] = true; });
  return { day: state.bounty.day, list, busyHeroIds: busy,
    canClaim: list.some(b => b.state === 'done'),
    idleCount: list.filter(b => b.state === 'open').length };
}
// 玩法页宽卡一次性读取离线结算提示（读后清除）
function takeBountyGrantsNotice() {
  checkDailyReset();
  const g = state.bounty && state.bounty.unreadGrants;
  if (g && g[0]) { state.bounty.unreadGrants = null; return g[2] || 0; }
  return 0;
}
function dispatchBounty(idx, heroId) {
  return withSavedMutation(() => {
    bountyInfo();
    const b = state.bounty.list[idx];
    if (!b) return { ok: false, msg: '悬赏不存在' };
    if (b.claimed) return { ok: false, msg: '该悬赏已完成' };
    if (b.heroId) return { ok: false, msg: '该悬赏已有人出征' };
    if (!state.roster[heroId] || !H.getHero(heroId)) return { ok: false, msg: '未拥有该武将' };
    const busy = state.bounty.list.some(x => x && x.heroId === heroId && !x.claimed);
    if (busy) return { ok: false, msg: '该武将已在悬赏途中' };
    b.heroId = heroId; b.dispatchedAt = Date.now();
    return { ok: true, idx, heroId, name: b.name };
  });
}
function claimBounty(idx) {
  return withSavedMutation(() => {
    bountyInfo();
    const b = state.bounty.list[idx];
    if (!b || !b.heroId) return { ok: false, msg: '没有可领取的悬赏' };
    if (b.claimed) return { ok: false, msg: '已领取' };
    if (Date.now() - b.dispatchedAt < b.hours * 3600000) return { ok: false, msg: '尚未归来' };
    b.claimed = true;
    applyReward(b.reward);
    return { ok: true, reward: b.reward, name: b.name, heroId: b.heroId };
  });
}

// ---------- 神秘商人 ----------
// 每日按（日期+建号日）确定性刷 2 件；当日有效、各限购 1；不上招募令折扣与精铁（护定价锚与满星日历）。
function refreshRoamer(today) {
  const seedStr = today + ':' + (state.createdAt || 0);
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pick = (salt) => {
    let x = (h ^ Math.imul(salt, 2654435761)) >>> 0;
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return x % C.ROAMER_POOL.length;
  };
  const a = pick(1);
  const bRaw = pick(2);
  const b = bRaw === a ? (bRaw + 1) % C.ROAMER_POOL.length : bRaw;
  state.roamer = { day: today, ids: [C.ROAMER_POOL[a].id, C.ROAMER_POOL[b].id], bought: {} };
}
function roamerInfo() {
  checkDailyReset();
  const r = state.roamer;
  const goods = (r.ids || []).map(id => C.ROAMER_POOL.find(g => g.id === id)).filter(Boolean)
    .map(g => Object.assign({}, g, { bought: !!r.bought[g.id] }));
  return { day: r.day, goods };
}
function buyRoamer(goodId) {
  return withSavedMutation(() => {
    roamerInfo();
    const r = state.roamer;
    if (r.day !== F.todayStr()) return { ok: false, msg: '商人已离开，明日请早' };
    const good = C.ROAMER_POOL.find(g => g.id === goodId);
    if (!good || !r.ids.includes(goodId)) return { ok: false, msg: '没有该商品' };
    if (r.bought[goodId]) return { ok: false, msg: '今日已购' };
    if (state.res[good.cur] < good.price) return { ok: false, msg: CURRENCY_NAME[good.cur] + '不足' };
    state.res[good.cur] -= good.price;
    r.bought[goodId] = 1;
    applyReward(good.give);
    if (good.give.armoryBox) {
      state.armory.boxes[good.give.armoryBox] = (state.armory.boxes[good.give.armoryBox] || 0) + 1;
    }
    return { ok: true, name: good.name };
  });
}

// ---------- 七日目标 ----------
// 以首日（存档创建或老档更新当日起算）为锚的 7 天任务轨；漏领可补（窗口内 day <= 当天均可领）。
function dayDiffStr(fromStr, toStr) {
  const p = s => { const a = String(s).split('-').map(Number); return new Date(a[0], (a[1] || 1) - 1, a[2] || 1).getTime(); };
  return Math.round((p(toStr) - p(fromStr)) / 86400000);
}
function sevenDayInfo() {
  checkDailyReset();
  const diff = dayDiffStr(state.sevenDay.start, F.todayStr());
  const cur = Math.min(7, diff + 1);
  const windowOpen = diff < 7; // 补领窗口：开服 7 天内，之后未领的作废
  const claimed = state.sevenDay.claimed || [];
  const list = C.SEVEN_DAY.map(d => ({
    day: d.day, label: d.label,
    claimed: claimed.indexOf(d.day) >= 0,
    claimable: windowOpen && d.day <= cur && claimed.indexOf(d.day) < 0,
    locked: d.day > cur
  }));
  return { start: state.sevenDay.start, cur, list, allDone: claimed.length >= 7, canClaim: list.some(x => x.claimable) };
}
function claimSevenDay(day) {
  return withSavedMutation(() => {
    const info = sevenDayInfo();
    const entry = info.list.find(x => x.day === day);
    if (!entry) return { ok: false, msg: '七日目标不存在' };
    if (entry.claimed) return { ok: false, msg: '已领取' };
    if (!entry.claimable) return { ok: false, msg: '尚未到领取日' };
    const def = C.SEVEN_DAY[day - 1];
    state.sevenDay.claimed.push(day);
    applyReward(def.reward);
    return { ok: true, reward: def.reward, label: def.label };
  });
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
  return withSavedMutation(() => {
    const q = IT.QUESTS.find(x => x.id === qid);
    if (!q) return { ok: false };
    if ((state.daily.quests[qid] || 0) < q.target) return { ok: false, msg: '任务未完成' };
    if (state.daily.claimed.indexOf(qid) >= 0) return { ok: false, msg: '已领取' };
    state.daily.claimed.push(qid); applyReward(q.reward);
    return { ok: true, reward: q.reward, act: q.act };
  });
}
function activePoints() {
  let pts = 0;
  IT.QUESTS.forEach(q => {
    if (state.daily.claimed.indexOf(q.id) >= 0) pts += q.act;
  });
  return pts;
}
function claimActiveChest(idx) {
  return withSavedMutation(() => {
    const chest = IT.ACTIVE_CHESTS[idx];
    if (!chest) return { ok: false };
    if (state.daily.active.indexOf(idx) >= 0) return { ok: false, msg: '已领取' };
    if (activePoints() < chest.need) return { ok: false, msg: '活跃度不足' };
    state.daily.active.push(idx); applyReward(chest.reward);
    return { ok: true, reward: chest.reward };
  });
}

function claimDailyRewards(includeIdle) {
  const original = state, backup = JSON.parse(JSON.stringify(state));
  state = JSON.parse(JSON.stringify(state));
  const before = Object.assign({}, state.res);
  const claimedQuestIds = [], claimedChestIds = [];
  try {
    checkDailyReset();
    const idle = includeIdle ? claimIdleInternal(false) : { gold: 0, scroll: 0, iron: 0, changed: false };
    IT.QUESTS.forEach(q => {
      if ((state.daily.quests[q.id] || 0) >= q.target && state.daily.claimed.indexOf(q.id) < 0) {
        state.daily.claimed.push(q.id); applyReward(q.reward); claimedQuestIds.push(q.id);
      }
    });
    IT.ACTIVE_CHESTS.forEach((chest, idx) => {
      if (activePoints() >= chest.need && state.daily.active.indexOf(idx) < 0) {
        state.daily.active.push(idx); applyReward(chest.reward); claimedChestIds.push(idx);
      }
    });
    const rewards = {};
    Object.keys(state.res).forEach(k => { const delta = (state.res[k] || 0) - (before[k] || 0); if (delta) rewards[k] = delta; });
    const changed = !!(idle.changed || claimedQuestIds.length || claimedChestIds.length);
    if (changed) save();
    const committed = state; state = original; mergeStateInPlace(original, committed);
    return { ok: true, changed, rewards, idle, claimedQuestIds, claimedChestIds };
  } catch (err) {
    state = original; mergeStateInPlace(original, backup);
    return { ok: false, changed: false, msg: '领取未保存，请重试', error: err && err.message };
  }
}
function claimAllDailyRewards() { return claimDailyRewards(false); }
function claimFreeRewards() { return claimDailyRewards(true); }
function applyReward(r) {
  if (!r || typeof r !== 'object') return;
  if (r.gold) state.res.gold += r.gold;
  // 兼容旧任务/奖励数据，但绝不把兵书当作玩家战斗经验。
  if (r.exp) state.res.gold += Math.floor(r.exp);
  if (r.gem) state.res.gem += r.gem;
  if (r.scroll) state.res.scroll += r.scroll;
  if (r.token) state.res.token += r.token;
  if (r.shard) state.res.shard += r.shard;
  if (r.iron) state.res.iron += Math.floor(r.iron);
  if (r.univSsr) state.res.univSsr = (state.res.univSsr || 0) + Math.floor(r.univSsr);
  if (r.srPick) addChoiceVoucher('sr', r.srPick);
  if (r.ssrPick) addChoiceVoucher('ssr', r.ssrPick);
}

// ---------- 商铺 ----------
function buyGood(goodId) {
  return withSavedMutation(() => buyGoodMutation(goodId));
}
function buyGoodMutation(goodId) {
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
const CURRENCY_NAME = { gold: '铜钱', gem: '元宝', scroll: '招募令', token: '演武令', shard: '英雄碎片', iron: '精铁' };

export {
  load, save, getState, checkDailyReset, SAVE_KEY,
  allRoster, getOwned, addHeroCard, grantCard, crystalInfo, effectiveLevel, playerLevel, playerXpNeeded, addPlayerXP, levelCap, calcHero,
  levelUp, ascend, ascendPreview, foodPoints, dismiss, resetHero, convertCards, setCardsLocked, addChoiceVoucher, useChoiceVoucher, firstWinChoice, claimFirstWinChoice,
  exchangeQualityShard, qualityShardInfo,
  getFormationCalc, setFormationSlot, applyFormation, formationFactionBonus, teamPower, playerUnits, enemyUnits, activeBonds, bondMods,
  getArmoryBonuses, getArmoryState, armoryUnlock, armorySelect, armoryUpgrade, armoryUpgradeToNode, armoryClaimBox, grantArmoryItem, applyArmoryRecommendations, forgeInfo, forgeReroll, forgeSetDir, forgeToggleLock, forgeGateOpen, motifInfo, motifActivate, smeltInfo, smeltMelt, smeltCombine,
  addEquip, equipInventory, equipTo, unequip, enhanceEquip, fodderPickIds, salvageEquip, salvageBatch, isEquipped,
  migrateSaveV1, migrateSaveV2, migrateSaveV3, migrateSaveV4, migrateSaveV5, migrateSaveV6, normalizeState,
  idlePending, idleTick, gemQuotaInfo, claimIdle, claimIdleInternal, fastReward, fastRewardMutation, fastRewardAdMutation, adReward,
  doSummon, rollRarity, pickHeroOfRarity, summonPityInfo, setSummonFocus, summonTicketInfo, summonPointsInfo, claimSummonPoints, useUniversalSsr,
  winCampaign, campaignRewardPreview, winTower, arenaFight, beginBattle, settleBattle, campaignStarChestInfo, claimStarChests,
  markStorySeen, isStorySeen, retroGrants, dismissRetroGrants, dismissReturnPending,
  questList, claimQuest, activePoints, claimActiveChest, claimAllDailyRewards, claimFreeRewards, bumpQuest, applyReward,
  sevenDayInfo, claimSevenDay, bountyInfo, dispatchBounty, claimBounty, roamerInfo, buyRoamer, takeBountyGrantsNotice,
  interruptBattle, setAutoBattleSpeed,
  buyGood, CURRENCY_NAME,
  adCount, adBump
};
