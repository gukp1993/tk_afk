// 游戏状态管理：存档、武将养成、挂机、招募、任务、商店、演武
const C = require('./config');
const H = require('./heroes');
const IT = require('./items');
const F = require('./fmt');
const platform = require('./platform');
const { buildUnit } = require('./battle');

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
    v: 5, createdAt: Date.now(), name: '主公',
    player: { level: 1, exp: 0 },
    res: { gold: 100000, gem: 1888, scroll: 12, token: 20, shard: 0, iron: 60 },
    roster,
    formation: ['zhangfei', 'guanyu', 'liaohua', 'liubei', 'mengda'],
    campaign: { cleared: 0, storySeen: {} },
    tower: { best: 0 },
    arena: { points: 1000, wins: 0, losses: 0, attempts: C.ARENA.DAILY },
    equips: {}, nextEquip: 1,
    armory: createArmory(),
    idle: { last: Date.now(), gold: 0, scroll: 0, ironAcc: 0 },
    fast: { day: '', count: 0 },
    daily: { day: '', quests: {}, claimed: [], active: [] },
    summon: { total: 0 },
    vouchers: { sr: 0, ssr: 0 },
    heroProgress: { starterMengdaGranted: true, firstWinChoiceGranted: false, firstWinChoicePending: false, chapterOneVoucherGranted: false },
    battle: { nextSeq: 1, pending: null, lastSettled: null },
    migrations: {},
    ads: { day: '', counts: {} },
    buyLog: { day: '', buys: {} },
    settings: { speed: 1 }
  };
}
function newHero(id) { return { id, star: 0, cards: 0, lockedCards: false, equip: { weapon: null, armor: null, helm: null, boots: null } }; }
function createArmory() {
  const unlocked = {}, selected = {}, slotStars = {};
  IT.ARMORY_SLOTS.forEach(s => {
    const starter = IT.CATALOG.find(x => x.slot === s.id && x.q === 0);
    unlocked[starter.id] = true; selected[s.id] = starter.id; slotStars[s.id] = 0;
  });
  return { schema: 1, unlocked, selected, slotStars, seen: {}, claimedMilestones: {}, boxes: { 1: 0, 2: 0, 3: 0 } };
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

function load() {
  const raw = rawGet(SAVE_KEY);
  if (raw && raw.v === 1) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV4(migrateSaveV3(migrateSaveV2(migrateSaveV1(raw))));
    save();
  } else if (raw && raw.v === 2) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV4(migrateSaveV3(migrateSaveV2(raw)));
    save();
  } else if (raw && raw.v === 3) {
    rawSet(SAVE_KEY + '.backup.v3', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV4(migrateSaveV3(raw));
    save();
  } else if (raw && raw.v === 4) {
    rawSet(SAVE_KEY + '.backup.v4', JSON.parse(JSON.stringify(raw)));
    state = migrateSaveV4(raw);
    normalizeState(state);
    // Persist normalized fields and abandon any battle interrupted before this load.
    save();
  } else if (raw && raw.v === 5) {
    state = raw;
    normalizeState(state);
    save();
  } else if (raw && raw.v > 5) {
    throw new Error('存档版本较新，停止加载以保护数据');
  } else if (raw) {
    throw new Error('存档版本无法识别，保留原数据并停止加载');
  } else {
    state = defaultState();
    save();
  }
  // 离线挂机结算
  idleTick();
  return state;
}
function normalizeState(s) {
  s.player = s.player || { level: 1, exp: 0 };
  s.player.level = Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(s.player.level || 1)));
  s.player.exp = s.player.level >= C.MAX_LEVEL ? 0 : Math.max(0, Math.floor(s.player.exp || 0));
  s.res = s.res || {}; ['gold', 'gem', 'scroll', 'token', 'shard', 'iron'].forEach(k => { if (!Number.isFinite(s.res[k])) s.res[k] = 0; s.res[k] = Math.max(0, Math.floor(s.res[k])); });
  if (!s.armory) s.armory = createArmory();
  const defaults = createArmory();
  s.armory.unlocked = s.armory.unlocked || defaults.unlocked;
  s.armory.selected = s.armory.selected || defaults.selected;
  s.armory.slotStars = s.armory.slotStars || defaults.slotStars;
  s.armory.seen = s.armory.seen || {};
  s.armory.claimedMilestones = s.armory.claimedMilestones || {};
  s.armory.boxes = s.armory.boxes || { 1: 0, 2: 0, 3: 0 };
  [1,2,3].forEach(q => { s.armory.boxes[q] = Math.max(0, Math.floor(Number(s.armory.boxes[q]) || 0)); });
  IT.ARMORY_SLOTS.forEach(slot => {
    const starter = IT.CATALOG.find(x => x.slot === slot.id && x.q === 0);
    if (!s.armory.unlocked[starter.id]) s.armory.unlocked[starter.id] = true;
    if (!IT.CATALOG.some(x => x.id === s.armory.selected[slot.id] && x.slot === slot.id && s.armory.unlocked[x.id])) s.armory.selected[slot.id] = starter.id;
    s.armory.slotStars[slot.id] = Math.max(0, Math.min(5, Math.floor(s.armory.slotStars[slot.id] || 0)));
  });
  s.roster = s.roster || {}; s.vouchers = s.vouchers || { sr: 0, ssr: 0 };
  s.heroProgress = s.heroProgress || { starterMengdaGranted: true, firstWinChoiceGranted: false, firstWinChoicePending: false, chapterOneVoucherGranted: false };
  s.battle = s.battle || { nextSeq: 1, pending: null, lastSettled: null };
  s.idle = s.idle || { last: Date.now(), gold: 0, scroll: 0 };
  if (!Number.isFinite(s.idle.ironAcc)) s.idle.ironAcc = 0;
  s.idle.ironAcc = Math.max(0, Math.min(C.IDLE_CAP_HOURS * C.ARMORY_IRON_PER_HOUR, s.idle.ironAcc));
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
  if (state) idleTick();
  rawSet(SAVE_KEY, state);
}
function getState() { return state; }

// ---------- 每日重置 ----------
function checkDailyReset() {
  const today = F.todayStr();
  if (state.daily.day !== today) {
    state.daily = { day: today, quests: {}, claimed: [], active: [] };
    state.arena.attempts = C.ARENA.DAILY;
  }
  if (state.fast.day !== today) state.fast = { day: today, count: 0 };
  if (state.buyLog.day !== today) state.buyLog = { day: today, buys: {} };
  if (state.ads.day !== today) state.ads = { day: today, counts: {} };
}

// ---------- 武将 ----------
function allRoster() {
  return Object.keys(state.roster).map(id => calcHero(id));
}
function getOwned(id) { return state.roster[id]; }
function addHeroCard(id) {
  if (state.roster[id]) state.roster[id].cards += 1;
  else state.roster[id] = newHero(id);
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
  const stats = { hp: Math.floor(base.hp * (1 + bonus.hp)), atk: Math.floor(base.atk * (1 + bonus.atk)), def: Math.floor(base.def * (1 + bonus.def)), spd: base.spd, crit: base.crit };
  const power = H.heroPower(def, lv, star) + Math.floor((stats.hp - base.hp) / 6 + (stats.atk - base.atk) * 2.2 + (stats.def - base.def) * 1.5);
  const passive = Object.assign({}, def.passive.mods || {});
  if (bonus.heal) passive.armoryHeal = bonus.heal;
  if (bonus.startShield) passive.armoryStartShield = bonus.startShield;
  if (bonus.startEnergy) passive.armoryStartEnergy = bonus.startEnergy;
  if (bonus.directDR) passive.armoryDirectDR = bonus.directDR;
  return {
    id, name: def.name, surname: def.name.slice(0, 1), title: def.title, quote: def.quote,
    faction: def.faction, cls: def.cls,
    rarity: def.rarity, level: lv, realLevel: lv, star, cards: own.cards, ult: def.ult,
    passive, passiveDef: def.passive, stats, power, cap: levelCap(id),
    armory: bonus
  };
}
function getArmoryBonuses() {
  if (!state || !state.armory) return { hp: 0, atk: 0, def: 0, heal: 0, startShield: 0, startEnergy: 0, directDR: 0 };
  const out = { hp: 0, atk: 0, def: 0, heal: 0, startShield: 0, startEnergy: 0, directDR: 0 };
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
  return out;
}
function getArmoryState() {
  const a = state.armory;
  return { unlocked: Object.assign({}, a.unlocked), selected: Object.assign({}, a.selected), slotStars: Object.assign({}, a.slotStars), boxes: Object.assign({}, a.boxes), seen: Object.assign({}, a.seen), claimedMilestones: Object.assign({}, a.claimedMilestones), total: IT.CATALOG.length, unlockedCount: Object.keys(a.unlocked).filter(id => a.unlocked[id]).length, bonuses: getArmoryBonuses() };
}
function armoryUnlock(itemId) {
  const item = IT.CATALOG.find(x => x.id === itemId);
  if (!item) return { ok:false, msg:'图鉴条目不存在' };
  if (state.armory.unlocked[item.id]) return { ok:false, msg:'图鉴已解锁' };
  const grade = IT.GRADES[item.q];
  if ((state.campaign.cleared || 0) < grade.unlockStage) return { ok:false, msg:'通关第' + grade.unlockStage + '关后开放' };
  if (item.q === 0) return { ok:false, msg:'凡铁军械已全部赠送' };
  if (state.res.iron < grade.cost) return { ok:false, msg:'精铁不足' };
  state.res.iron -= grade.cost; state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true; save();
  return { ok:true, itemId:item.id, cost:grade.cost };
}
function armorySelect(slot, itemId) {
  const item = IT.CATALOG.find(x => x.id === itemId);
  if (!IT.ARMORY_SLOTS.some(x => x.id === slot) || !item || item.slot !== slot) return { ok:false, msg:'部位或军械不匹配' };
  if (!state.armory.unlocked[itemId]) return { ok:false, msg:'请先解锁图鉴' };
  state.armory.selected[slot] = itemId; save();
  return { ok:true, selected:itemId, bonuses:getArmoryBonuses() };
}
function armoryUpgrade(slot) {
  if (!IT.ARMORY_SLOTS.some(x => x.id === slot)) return { ok:false, msg:'部位不存在' };
  const star = state.armory.slotStars[slot] || 0;
  if (star >= 5) return { ok:false, msg:'该部位已满星' };
  const iron = IT.STAR_NEEDS[star], gold = IT.STAR_GOLD[star];
  if (state.res.iron < iron) return { ok:false, msg:'精铁不足，还差' + (iron-state.res.iron) };
  if (state.res.gold < gold) return { ok:false, msg:'铜钱不足，还差' + (gold-state.res.gold) };
  state.res.iron -= iron; state.res.gold -= gold; state.armory.slotStars[slot] = star + 1; save();
  return { ok:true, slot, stars:star+1, iron, gold, bonuses:getArmoryBonuses() };
}
function armoryClaimBox(q, itemId) {
  q = Number(q);
  if (![1,2,3].includes(q) || !(state.armory.boxes[q] > 0)) return { ok:false, msg:'没有可领取的自选箱' };
  const pool = IT.CATALOG.filter(x => x.q === q);
  if (itemId === 'convert') {
    if (pool.some(x => !state.armory.unlocked[x.id])) return { ok:false, msg:'仍有未解锁条目，请先选择军械' };
    const iron = IT.GRADES[q].duplicate; state.armory.boxes[q] -= 1; state.res.iron += iron; save();
    return { ok:true, iron, converted:true };
  }
  const item = pool.find(x => x.id === itemId);
  if (!item || state.armory.unlocked[item.id]) return { ok:false, msg:'请选择尚未解锁的对应品质军械' };
  state.armory.boxes[q] -= 1; state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true; save();
  return { ok:true, itemId:item.id };
}
function grantArmoryItem(itemId) {
  const item = IT.CATALOG.find(x => x.id === itemId);
  if (!item) return { ok:false, msg:'军械奖励无效' };
  if (state.armory.unlocked[item.id]) { const iron=IT.GRADES[item.q].duplicate; state.res.iron += iron; return { ok:true, duplicate:true, iron, itemId }; }
  state.armory.unlocked[item.id] = true; state.armory.seen[item.id] = true;
  return { ok:true, duplicate:false, itemId };
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
  const own = state.roster[id];
  if (!own || !H.getHero(id)) return { ok: false, msg: '未拥有该武将' };
  const maxStar = C.RARITIES[H.getHero(id).rarity].maxStar;
  if (own.star >= maxStar) return { ok: false, msg: '已达最高星级' };
  const cost = [{ same: 1, gold: 2000 }, { same: 1, gold: 8000 }, { same: 2, gold: 25000 }, { same: 2, gold: 70000 }, { same: 3, gold: 160000 }][own.star];
  if (own.cards < cost.same) return { ok: false, msg: '同名武将卡不足' };
  if (state.res.gold < cost.gold) return { ok: false, msg: '铜钱不足' };
  own.cards -= cost.same;
  state.res.gold -= cost.gold;
  own.star += 1;
  return { ok: true, star: own.star };
}
function ascendPreview(id) {
  const own = state.roster[id];
  if (!own) return { ok: false, msg: '未拥有该武将' };
  const maxStar = C.RARITIES[H.getHero(id).rarity].maxStar;
  if (own.star >= maxStar) return { ok: false, msg: '已达最高星级' };
  const costs = [{ same: 1, gold: 2000 }, { same: 1, gold: 8000 }, { same: 2, gold: 25000 }, { same: 2, gold: 70000 }, { same: 3, gold: 160000 }];
  const cost = costs[own.star];
  return { ok: true, from: own.star, to: own.star + 1, cards: own.cards, needCards: cost.same, gold: state.res.gold, needGold: cost.gold, level: state.player.level, can: own.cards >= cost.same && state.res.gold >= cost.gold };
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
  const key = Number(rarity) === 4 || rarity === 'ssr' ? 'ssr' : 'sr';
  const h = H.getHero(id);
  if (!h || h.rarity !== (key === 'ssr' ? 4 : 3)) return { ok: false, msg: '请选择对应稀有度的武将' };
  if (!(state.vouchers[key] > 0)) return { ok: false, msg: '自选券不足' };
  state.vouchers[key] -= 1;
  const isNew = !state.roster[id];
  addHeroCard(id);
  return { ok: true, id, isNew, level: state.player.level, cards: state.roster[id].cards };
}
function firstWinChoice() {
  return { available: !!state.heroProgress.firstWinChoicePending, claimed: !!state.heroProgress.firstWinChoiceGranted };
}
function claimFirstWinChoice(id) {
  if (!state.heroProgress.firstWinChoicePending || state.heroProgress.firstWinChoiceGranted || !['liubei', 'guanyu', 'zhangfei'].includes(id)) return { ok: false, msg: '当前不能领取该奖励' };
  addHeroCard(id);
  state.heroProgress.firstWinChoicePending = false; state.heroProgress.firstWinChoiceGranted = true;
  return { ok: true, id, cards: state.roster[id].cards };
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
// 生成战斗用双方单元
function playerUnits() {
  const calc = getFormationCalc();
  return calc.map((x, i) => x ? buildUnit(x, 'A' + i, i <= 2 ? 0 : 1) : null).filter(Boolean);
}
function enemyUnits(units) {
  const H2 = require('./heroes');
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
      level: u.level, star: u.star, stats, ult: u.hero.ult, passive: u.hero.passive.mods || {},
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
function idlePending() {
  idleTick();
  const rate = C.idleRates(state.campaign.cleared);
  const gold = Math.floor(state.idle.gold), scroll = Math.floor(state.idle.scroll);
  const hours = rate.gold > 0 ? state.idle.gold / rate.gold : 0;
  const full = state.idle.gold >= C.IDLE_CAP_HOURS * rate.gold - 1;
  return { gold, exp: 0, scroll, iron: Math.floor(state.idle.ironAcc), hours, full };
}
function idleTick() {
  // 把离线时间折算进累计（入 state.idle 缓存）
  const now = Date.now();
  const addH = Math.max(0, Math.min(C.IDLE_CAP_HOURS, (now - state.idle.last) / 3600000));
  const rate = C.idleRates(state.campaign.cleared);
  state.idle.gold += addH * rate.gold;
  if (state.idle.exp) { state.idle.gold += state.idle.exp; state.idle.exp = 0; }
  state.idle.scroll += addH * rate.scrollPerHour;
  state.idle.ironAcc += addH * C.ARMORY_IRON_PER_HOUR;
  const capG = C.IDLE_CAP_HOURS * rate.gold;
  state.idle.gold = Math.min(state.idle.gold, capG);
  state.idle.scroll = Math.min(state.idle.scroll, C.IDLE_CAP_HOURS * rate.scrollPerHour);
  state.idle.ironAcc = Math.min(state.idle.ironAcc, C.IDLE_CAP_HOURS * C.ARMORY_IRON_PER_HOUR);
  state.idle.last = now;
}
function claimIdle(double) {
  idleTick();
  let g = Math.floor(state.idle.gold), s = Math.floor(state.idle.scroll), iron = Math.floor(state.idle.ironAcc);
  if (double) { g *= 2; s *= 2; }
  state.res.gold += g; state.res.scroll += s; state.res.iron += iron;
  state.idle.gold -= Math.floor(state.idle.gold); state.idle.scroll -= Math.floor(state.idle.scroll); state.idle.ironAcc -= iron;
  bumpQuest('q_idle1', 1);
  return { gold: g, exp: 0, scroll: s, iron, double: !!double };
}
function fastReward(free) {
  if (state.fast.count >= C.FAST_REWARD_DAILY) return { ok: false, msg: '今日快速收获次数已用完' };
  if (!free) {
    if (state.res.gem < C.FAST_REWARD_COST) return { ok: false, msg: '元宝不足' };
    state.res.gem -= C.FAST_REWARD_COST;
    state.fast.count += 1;
  }
  const rate = C.idleRates(state.campaign.cleared);
  const g = Math.floor(C.FAST_REWARD_HOURS * rate.gold);
  const s = Math.floor(C.FAST_REWARD_HOURS * rate.scrollPerHour);
  state.res.gold += g; state.res.scroll += s;
  return { ok: true, gold: g, exp: 0, scroll: s, free: !!free };
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

// ---------- 招募（白/蓝/紫/橙 四档固定概率，无保底）----------
function rollRarity() {
  const g = C.GACHA.rates;
  const r = Math.random();
  if (r < g.ssr) return 4;
  if (r < g.ssr + g.sr) return 3;
  if (r < g.ssr + g.sr + g.r) return 2;
  return 1;
}
function pickHeroOfRarity(rarity) {
  const pool = H.HEROES.filter(h => h.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)].id;
}
function doSummon(type) {
  // type: scroll1 | scroll10 | gem10
  const g = C.GACHA;
  const count = type === 'scroll1' ? 1 : 10;
  let costOk = false;
  if (type === 'scroll1') {
    if (state.res.scroll >= 1) { state.res.scroll -= 1; costOk = true; }
  } else if (type === 'scroll10') {
    if (state.res.scroll >= 10) { state.res.scroll -= 10; costOk = true; }
  } else {
    if (state.res.gem >= g.costTenGold) { state.res.gem -= g.costTenGold; costOk = true; }
  }
  if (!costOk) return { ok: false, msg: '招募令/元宝不足' };

  const results = [];
  for (let i = 0; i < count; i++) {
    state.summon.total += 1;
    const rarity = rollRarity();
    const id = pickHeroOfRarity(rarity);
    const isNew = !state.roster[id];
    addHeroCard(id);
    results.push({ id, rarity, isNew, star: 0 });
  }
  bumpQuest('q_summon1', 1);
  return { ok: true, results };
}
function grantCard(id) {
  addHeroCard(id);
}

// ---------- 战役 / 塔 / 演武 ----------
// 章末宝箱：每章第 10 关（名将关）首通额外发放
const CHAPTER_CHEST = { gem: 100, scroll: 1 };
function winCampaign(stageIdx) {
  // stageIdx 从 1 开始
  const first = stageIdx === state.campaign.cleared + 1;
  const reward = { gold: 0, gem: 0, scroll: 0, armory: null, armoryBox: null, chest: null };
  if (first) {
    state.campaign.cleared = stageIdx;
    reward.gem = 30;
    reward.gold = Math.floor(2000 * Math.pow(1.05, stageIdx));
    reward.gold += Math.floor(1400 * Math.pow(1.05, stageIdx)); // 旧兵书奖励并入铜钱
    const { isBoss } = require('./stages').chapterOf(stageIdx);
    if (isBoss) {
      reward.scroll = 1;
      reward.chest = { gem: CHAPTER_CHEST.gem, scroll: CHAPTER_CHEST.scroll };
    }
    const milestoneQ = stageIdx === 10 ? 1 : stageIdx === 30 ? 2 : stageIdx === 60 ? 3 : 0;
    if (milestoneQ && !state.armory.claimedMilestones[milestoneQ]) {
      state.armory.claimedMilestones[milestoneQ] = true;
      state.armory.boxes[milestoneQ] = (state.armory.boxes[milestoneQ] || 0) + 1;
      reward.armoryBox = milestoneQ;
    }
    if (Math.random() < 0.65) {
      reward.armory = rollArmoryDrop(stageIdx);
    }
  } else {
    // 重复挑战仍给小额奖励
    reward.gold = Math.floor(600 * Math.pow(1.05, stageIdx) * 0.3);
    reward.gold += Math.floor(400 * Math.pow(1.05, stageIdx) * 0.3);
  }
  // 奖励入账（首通含章末宝箱；此前 gold/exp/gem/scroll 只展示未入账）
  applyReward(reward);
  if (reward.chest) applyReward(reward.chest);
  bumpQuest('q_win3', 1);
  return reward;
}

// ---------- 剧情关卡 ----------
function markStorySeen(stageIdx) {
  if (!state.campaign.storySeen) state.campaign.storySeen = {};
  state.campaign.storySeen[stageIdx] = 1;
}
function isStorySeen(stageIdx) {
  return !!(state.campaign.storySeen && state.campaign.storySeen[stageIdx]);
}
function winTower(floor) {
  const first = floor === state.tower.best + 1;
  const reward = { gem: 0, scroll: 0, shard: 0 };
  if (first) {
    state.tower.best = floor;
    reward.gem = 25 + floor * 2;
    if (floor % 5 === 0) reward.scroll = 1;
    if (floor % 10 === 0) reward.shard = 10;
  }
  bumpQuest('q_tower1', 1);
  applyReward(reward);
  return reward;
}
function arenaFight(win, diff, reserved) {
  if (!reserved) state.arena.attempts = Math.max(0, state.arena.attempts - 1);
  let delta = 0, tokens = 0;
  if (win) {
    delta = Math.round(14 + 8 * diff);
    tokens = C.ARENA.WIN_TOKENS;
    state.arena.wins += 1;
  } else {
    delta = -8;
    tokens = C.ARENA.LOSE_TOKENS;
    state.arena.losses += 1;
  }
  state.arena.points = Math.max(0, state.arena.points + delta);
  state.res.token += tokens;
  bumpQuest('q_arena1', 1);
  return { delta, tokens, points: state.arena.points };
}

// 每个对局开始时发ID并冻结等级/关卡；同一结算ID幂等，所有变化一次保存。
function beginBattle(spec) {
  spec = spec || {};
  if (state.battle.pending) {
    state.battle.lastSettled = { id: state.battle.pending.id, outcome: 'interrupted', gainedXP: 0, reward: null };
    state.battle.pending = null;
  }
  if (spec.mode === 'arena') {
    if (state.arena.attempts <= 0) return { ok: false, msg: '今日演武次数不足' };
    state.arena.attempts -= 1;
  }
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
  save();
  return { ok: true, ...state.battle.pending };
}

function battleXP(pending, win) {
  if (!win || state.player.level >= C.MAX_LEVEL) return 0;
  const base = C.BATTLE_XP.base + C.BATTLE_XP.perEnemyLevel * pending.referenceLevel;
  if (pending.mode === 'campaign') {
    if (pending.first) return Math.floor(base * C.BATTLE_XP.campaignFirst);
    const rate = Math.max(0.2, Math.min(1, pending.referenceLevel / Math.max(1, pending.levelAtStart)));
    return Math.floor(base * C.BATTLE_XP.campaignRepeat * rate);
  }
  if (pending.mode === 'tower') return pending.first ? Math.floor(base * C.BATTLE_XP.towerFirst) : 0;
  if (pending.mode === 'arena') return Math.floor(base * C.BATTLE_XP.arenaWin);
  if (pending.mode === 'training') return Math.floor(base * C.BATTLE_XP.training);
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
    const win = outcome.win === true;
    let reward = null;
    if (pending.mode === 'campaign') {
      if (win) {
        reward = winCampaign(pending.index);
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
    if (win) bumpQuest('q_battle1', 1);
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
  const q = IT.QUESTS.find(x => x.id === qid);
  if (!q) return { ok: false };
  if ((state.daily.quests[qid] || 0) < q.target) return { ok: false, msg: '任务未完成' };
  if (state.daily.claimed.indexOf(qid) >= 0) return { ok: false, msg: '已领取' };
  state.daily.claimed.push(qid);
  state.res.active = state.res.active || 0;
  applyReward(q.reward);
  return { ok: true, reward: q.reward, act: q.act };
}
function activePoints() {
  let pts = 0;
  IT.QUESTS.forEach(q => {
    if (state.daily.claimed.indexOf(q.id) >= 0) pts += q.act;
  });
  return pts;
}
function claimActiveChest(idx) {
  const chest = IT.ACTIVE_CHESTS[idx];
  if (!chest) return { ok: false };
  if (state.daily.active.indexOf(idx) >= 0) return { ok: false, msg: '已领取' };
  if (activePoints() < chest.need) return { ok: false, msg: '活跃度不足' };
  state.daily.active.push(idx);
  applyReward(chest.reward);
  return { ok: true, reward: chest.reward };
}
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
  if (r.srPick) addChoiceVoucher('sr', r.srPick);
  if (r.ssrPick) addChoiceVoucher('ssr', r.ssrPick);
}

// ---------- 商铺 ----------
function buyGood(goodId) {
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

module.exports = {
  load, save, getState, checkDailyReset, SAVE_KEY,
  allRoster, getOwned, addHeroCard, grantCard, crystalInfo, effectiveLevel, playerLevel, playerXpNeeded, addPlayerXP, levelCap, calcHero,
  levelUp, ascend, ascendPreview, foodPoints, dismiss, resetHero, convertCards, setCardsLocked, addChoiceVoucher, useChoiceVoucher, firstWinChoice, claimFirstWinChoice,
  getFormationCalc, setFormationSlot, formationFactionBonus, teamPower, playerUnits, enemyUnits,
  getArmoryBonuses, getArmoryState, armoryUnlock, armorySelect, armoryUpgrade, armoryClaimBox, grantArmoryItem,
  addEquip, equipInventory, equipTo, unequip, enhanceEquip, fodderPickIds, salvageEquip, salvageBatch, isEquipped,
  migrateSaveV1, migrateSaveV2, migrateSaveV3, migrateSaveV4, normalizeState,
  idlePending, idleTick, claimIdle, fastReward,
  doSummon, rollRarity, pickHeroOfRarity,
  winCampaign, winTower, arenaFight, beginBattle, settleBattle,
  markStorySeen, isStorySeen,
  questList, claimQuest, activePoints, claimActiveChest, bumpQuest, applyReward,
  buyGood, CURRENCY_NAME,
  adCount, adBump
};
