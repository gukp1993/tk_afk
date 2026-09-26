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
  return {
    v: 2, createdAt: Date.now(), name: '主公',
    res: { gold: 60000, exp: 40000, gem: 1888, scroll: 12, token: 20, shard: 0 },
    roster,
    formation: ['guanyu', 'zhangfei', 'liaohua', 'liubei', null],
    campaign: { cleared: 0 },
    tower: { best: 0 },
    arena: { points: 1000, wins: 0, losses: 0, attempts: C.ARENA.DAILY },
    equips: {}, nextEquip: 1,
    idle: { last: Date.now(), gold: 0, exp: 0, scroll: 0 },
    fast: { day: '', count: 0 },
    daily: { day: '', quests: {}, claimed: [], active: [] },
    summon: { total: 0, pity: 0, wish: 0, firstTen: false },
    ads: { day: '', counts: {} },
    buyLog: { day: '', buys: {} },
    settings: { speed: 1 }
  };
}
function newHero(id) { return { id, lv: 1, star: 0, cards: 0, equip: { weapon: null, armor: null, helm: null, boots: null } }; }

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

function load() {
  const raw = rawGet(SAVE_KEY);
  if (raw && raw.v === 1) {
    state = migrateSaveV1(raw);
    save();
  } else if (raw && raw.v === 2) {
    state = raw;
  } else {
    state = defaultState();
    save();
  }
  // 离线挂机结算
  idleTick();
  return state;
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
// 共鸣水晶：前 5 高等级决定共鸣等级
function crystalInfo() {
  const list = Object.keys(state.roster).map(id => ({ id, lv: state.roster[id].lv }));
  list.sort((a, b) => b.lv - a.lv);
  const top5 = list.slice(0, 5);
  const cap = top5.length >= 5 ? top5[4].lv : 1;
  return { top5, cap, count: list.length };
}
function effectiveLevel(id) {
  const own = state.roster[id];
  const info = crystalInfo();
  const inTop5 = info.top5.some(t => t.id === id);
  return inTop5 ? own.lv : Math.max(own.lv, info.cap) === info.cap ? info.cap : Math.min(own.lv, info.cap);
}
function levelCap(id) {
  const own = state.roster[id];
  const caps = C.LEVEL_CAPS;
  return caps[Math.min(own.star, caps.length - 1)];
}
function calcHero(id) {
  const own = state.roster[id];
  const def = H.getHero(id);
  const lv = Math.min(effectiveLevel(id), levelCap(id));
  const star = own.star;
  let stats = H.heroStatsStar(def, lv, star);
  // 装备加成
  for (const slot of Object.keys(own.equip || {})) {
    const instId = own.equip[slot];
    if (!instId) continue;
    const inst = state.equips[instId];
    if (!inst) continue;
    const add = IT.equipStat(inst.q, inst.slot, inst.stars, !!inst.faction && inst.faction === def.faction);
    stats = {
      hp: stats.hp + (add.hp || 0),
      atk: stats.atk + (add.atk || 0),
      def: stats.def + (add.def || 0),
      spd: stats.spd, crit: stats.crit
    };
  }
  const power = H.heroPower(def, lv, star) + Math.floor((stats.hp - H.heroStatsStar(def, lv, star).hp) / 6 + (stats.atk - H.heroStatsStar(def, lv, star).atk) * 2.2 + (stats.def - H.heroStatsStar(def, lv, star).def) * 1.5);
  return {
    id, name: def.name, surname: def.name.slice(0, 1), title: def.title, quote: def.quote,
    faction: def.faction, cls: def.cls,
    rarity: def.rarity, level: lv, realLevel: own.lv, star, cards: own.cards, ult: def.ult,
    passive: def.passive.mods || {}, passiveDef: def.passive, stats, power, cap: levelCap(id),
    equip: own.equip
  };
}
function levelUp(id, times) {
  const own = state.roster[id];
  let done = 0;
  for (let i = 0; i < (times || 1); i++) {
    if (own.lv >= levelCap(id)) break;
    const g = C.goldCost(own.lv), e = C.expCost(own.lv);
    if (state.res.gold < g || state.res.exp < e) break;
    state.res.gold -= g; state.res.exp -= e;
    own.lv += 1; done += 1;
  }
  if (done > 0) bumpQuest('q_levelup', 1);
  return done;
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
  const maxStar = C.RARITIES[H.getHero(id).rarity].maxStar;
  if (own.star >= maxStar) return { ok: false, msg: '已达最高品阶' };
  const cost = C.ASCEND_COST[own.star];
  if (own.cards < cost.same) return { ok: false, msg: '同名武将卡不足' };
  if (foodPoints(id) < cost.food) return { ok: false, msg: '同阵营兵魂点不足' };
  if (state.res.gold < cost.gold) return { ok: false, msg: '铜钱不足' };
  own.cards -= cost.same;
  let need = cost.food;
  // 优先消耗低品质卡
  const order = [1, 2, 3];
  for (const r of order) {
    if (need <= 0) break;
    for (const hid of Object.keys(state.roster)) {
      if (hid === id || need <= 0) continue;
      const h = H.getHero(hid);
      if (!h || h.faction !== H.getHero(id).faction || C.FOOD_VALUE[h.rarity] !== r) continue;
      while (state.roster[hid].cards > 0 && need > 0) {
        state.roster[hid].cards -= 1; need -= 1;
      }
    }
  }
  state.res.gold -= cost.gold;
  own.star += 1;
  return { ok: true, star: own.star };
}
function dismiss(id) {
  const own = state.roster[id];
  if (!own) return { ok: false, msg: '未拥有' };
  if (state.formation.indexOf(id) >= 0) return { ok: false, msg: '编队中的武将无法遣散' };
  const r = H.getHero(id).rarity;
  const gain = r === 3 ? { shard: 40, gold: 100000 } : r === 2 ? { shard: 15, gold: 20000 } : { shard: 5, gold: 5000 };
  // 返还装备
  for (const slot of Object.keys(own.equip || {})) {
    if (own.equip[slot]) delete state.equips[own.equip[slot]];
  }
  delete state.roster[id];
  state.formation = state.formation.map(x => (x === id ? null : x));
  state.res.shard += gain.shard; state.res.gold += gain.gold;
  return { ok: true, gain };
}
function resetHero(id) {
  // 重置等级，返还七成资源
  const own = state.roster[id];
  if (!own || own.lv <= 1) return { ok: false, msg: '无需重置' };
  const info = crystalInfo();
  if (info.top5.slice(0, 5).some(t => t.id === id)) return { ok: false, msg: '共鸣核心武将暂不可重置' };
  let gold = 0, exp = 0;
  for (let lv = 1; lv < own.lv; lv++) { gold += C.goldCost(lv); exp += C.expCost(lv); }
  state.res.gold += Math.floor(gold * 0.7);
  state.res.exp += Math.floor(exp * 0.7);
  own.lv = 1;
  return { ok: true, gold: Math.floor(gold * 0.7), exp: Math.floor(exp * 0.7) };
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
  const gold = Math.floor(state.idle.gold), exp = Math.floor(state.idle.exp), scroll = Math.floor(state.idle.scroll);
  const hours = rate.gold > 0 ? state.idle.gold / rate.gold : 0;
  const full = state.idle.gold >= C.IDLE_CAP_HOURS * rate.gold - 1;
  return { gold, exp, scroll, hours, full };
}
function idleTick() {
  // 把离线时间折算进累计（入 state.idle 缓存）
  const now = Date.now();
  const addH = Math.min(C.IDLE_CAP_HOURS, (now - state.idle.last) / 3600000);
  const rate = C.idleRates(state.campaign.cleared);
  state.idle.gold += addH * rate.gold;
  state.idle.exp += addH * rate.exp;
  state.idle.scroll += addH * rate.scrollPerHour;
  const capG = C.IDLE_CAP_HOURS * rate.gold, capE = C.IDLE_CAP_HOURS * rate.exp;
  state.idle.gold = Math.min(state.idle.gold, capG);
  state.idle.exp = Math.min(state.idle.exp, capE);
  state.idle.scroll = Math.min(state.idle.scroll, C.IDLE_CAP_HOURS * rate.scrollPerHour);
  state.idle.last = now;
}
function claimIdle(double) {
  idleTick();
  let g = Math.floor(state.idle.gold), e = Math.floor(state.idle.exp), s = Math.floor(state.idle.scroll);
  if (double) { g *= 2; e *= 2; s *= 2; }
  state.res.gold += g; state.res.exp += e; state.res.scroll += s;
  state.idle.gold = 0; state.idle.exp = 0; state.idle.scroll = 0;
  bumpQuest('q_idle1', 1);
  return { gold: g, exp: e, scroll: s, double: !!double };
}
function fastReward(free) {
  if (state.fast.count >= C.FAST_REWARD_DAILY) return { ok: false, msg: '今日快速收获次数已用完' };
  if (!free) {
    if (state.res.gem < C.FAST_REWARD_COST) return { ok: false, msg: '元宝不足' };
    state.res.gem -= C.FAST_REWARD_COST;
    state.fast.count += 1;
  }
  const rate = C.idleRates(state.campaign.cleared);
  const g = Math.floor(C.FAST_REWARD_HOURS * rate.gold), e = Math.floor(C.FAST_REWARD_HOURS * rate.exp);
  const s = Math.floor(C.FAST_REWARD_HOURS * rate.scrollPerHour);
  state.res.gold += g; state.res.exp += e; state.res.scroll += s;
  return { ok: true, gold: g, exp: e, scroll: s, free: !!free };
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

// ---------- 招募 ----------
function rollRarity(forceSSR) {
  const g = C.GACHA;
  if (forceSSR) return 3;
  const r = Math.random();
  if (r < g.rates.ssr) return 3;
  if (r < g.rates.ssr + g.rates.sr) return 2;
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
  let guaranteed = false;
  if (count === 10 && !state.summon.firstTen) { guaranteed = true; state.summon.firstTen = true; }
  for (let i = 0; i < count; i++) {
    state.summon.pity += 1;
    state.summon.wish += 1;
    state.summon.total += 1;
    let force = false;
    if (state.summon.pity >= g.hardPity) { force = true; state.summon.pity = 0; }
    if (state.summon.wish >= g.wishMax) { force = true; state.summon.wish = 0; }
    if (guaranteed && i === count - 1 && !results.some(x => x.rarity === 3)) force = true;
    const rarity = rollRarity(force);
    if (rarity === 3) { state.summon.pity = 0; state.summon.wish = 0; }
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
function winCampaign(stageIdx) {
  // stageIdx 从 1 开始
  const first = stageIdx === state.campaign.cleared + 1;
  const reward = { gold: 0, exp: 0, gem: 0, scroll: 0, equip: null };
  if (first) {
    state.campaign.cleared = stageIdx;
    reward.gem = 30;
    reward.gold = Math.floor(2000 * Math.pow(1.05, stageIdx));
    reward.exp = Math.floor(1400 * Math.pow(1.05, stageIdx));
    const { isBoss } = require('./stages').chapterOf(stageIdx);
    if (isBoss) reward.scroll = 1;
    if (Math.random() < 0.65) {
      const q = IT.dropQuality(stageIdx);
      const slot = IT.DROP_SLOTS[Math.floor(Math.random() * IT.DROP_SLOTS.length)];
      const eqId = addEquip(q, slot);
      reward.equip = { q, slot, faction: state.equips[eqId].faction };
    }
  } else {
    // 重复挑战仍给小额奖励
    reward.gold = Math.floor(600 * Math.pow(1.05, stageIdx) * 0.3);
    reward.exp = Math.floor(400 * Math.pow(1.05, stageIdx) * 0.3);
  }
  bumpQuest('q_win3', 1);
  return reward;
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
  return reward;
}
function arenaFight(win, diff) {
  state.arena.attempts = Math.max(0, state.arena.attempts - 1);
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
  if (r.gold) state.res.gold += r.gold;
  if (r.exp) state.res.exp += r.exp;
  if (r.gem) state.res.gem += r.gem;
  if (r.scroll) state.res.scroll += r.scroll;
  if (r.token) state.res.token += r.token;
  if (r.shard) state.res.shard += r.shard;
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
const CURRENCY_NAME = { gold: '铜钱', exp: '兵书', gem: '元宝', scroll: '招募令', token: '演武令', shard: '英雄碎片' };

module.exports = {
  load, save, getState, checkDailyReset, SAVE_KEY,
  allRoster, getOwned, addHeroCard, grantCard, crystalInfo, effectiveLevel, levelCap, calcHero,
  levelUp, ascend, foodPoints, dismiss, resetHero,
  getFormationCalc, setFormationSlot, formationFactionBonus, teamPower, playerUnits, enemyUnits,
  addEquip, equipInventory, equipTo, unequip, enhanceEquip, fodderPickIds, salvageEquip, salvageBatch, isEquipped,
  migrateSaveV1,
  idlePending, idleTick, claimIdle, fastReward,
  doSummon, rollRarity, pickHeroOfRarity,
  winCampaign, winTower, arenaFight,
  questList, claimQuest, activePoints, claimActiveChest, bumpQuest, applyReward,
  buyGood, CURRENCY_NAME,
  adCount, adBump
};
