// 核心逻辑冒烟测试（node test/smoke.js）
const store = require('../utils/store');
const battle = require('../utils/battle');
const stages = require('../utils/stages');
const heroes = require('../utils/heroes');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name); }
}

// 1. 数据完整性
heroes.HEROES.forEach(h => {
  ok(h.base && h.base.hp > 0 && h.ult && h.ult.effects && h.ult.effects.length, 'hero kit: ' + h.id);
  ok(h.passive && h.passive.name, 'hero passive: ' + h.id);
});

// 2. 存档与初始阵容
store.load();
const roster = store.allRoster();
ok(roster.length >= 4, 'starters exist');
const units = store.playerUnits();
ok(units.length >= 3, 'player units built, got ' + units.length);
const enemy = stages.makeStageEnemies(1);
const eUnits = store.enemyUnits(enemy.units);
ok(eUnits.length === 5, 'enemy units built');

// 3. 战斗可跑完
let b = battle.createBattle({ team: units, enemy: eUnits, seed: 42 });
let guard = 0, res = null, eventsSeen = 0;
while (!b.ended && guard < 3000) {
  const r = b.step(0.1);
  eventsSeen += r.events.length;
  guard++;
  if (r.done) { res = b.result(); break; }
}
ok(b.ended, 'battle finishes (guard=' + guard + ', events=' + eventsSeen + ')');
ok(res && (res.winner === 'A' || res.winner === 'B'), 'battle has winner');

// 4. 弱方必败
const weakTeam = units.slice(0, 1);
let b2 = battle.createBattle({ team: weakTeam, enemy: eUnits, seed: 7 });
let g2 = 0;
while (!b2.ended && g2 < 2000) { b2.step(0.1); g2++; }
ok(b2.result().winner === 'B', '1v5 loses');

// 5. 高等级碾压
const strongUnits = store.playerUnits().map(u => {
  const s = Object.assign({}, u);
  s.stats = { hp: u.stats.hp * 50, atk: u.stats.atk * 50, def: u.stats.def * 50, spd: u.stats.spd, crit: u.stats.crit };
  return s;
});
let b3 = battle.createBattle({ team: strongUnits, enemy: eUnits, seed: 9 });
let g3 = 0;
while (!b3.ended && g3 < 2000) { b3.step(0.1); g3++; }
ok(b3.result().winner === 'A', 'overpower wins, took ' + g3 + ' ticks');

// 6. 招募（四档固定概率，无保底）
store.getState().res.gem = 288000;
for (let i = 0; i < 30; i++) {
  const r = store.doSummon('gem10');
  ok(r.ok, 'summon ok ' + i);
  ok(r.results.every(x => x.rarity >= 1 && x.rarity <= 4), 'rarity in 1..4 ' + i);
}
ok(store.getState().summon.total === 300, 'summon counted');
// 概率分布：2 万次 roll 的占比应在理论值容差内（≥3σ）
const cc = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 0; i < 20000; i++) cc[store.rollRarity()]++;
ok(Math.abs(cc[4] / 20000 - 0.02) < 0.004, 'ssr rate ~2%: ' + (cc[4] / 20000).toFixed(4));
ok(Math.abs(cc[3] / 20000 - 0.10) < 0.006, 'sr rate ~10%: ' + (cc[3] / 20000).toFixed(4));
ok(Math.abs(cc[2] / 20000 - 0.28) < 0.008, 'r rate ~28%: ' + (cc[2] / 20000).toFixed(4));
ok(cc[1] > 0 && cc[1] / 20000 < 0.70, 'n rate ~60%: ' + (cc[1] / 20000).toFixed(4));

// 7. 升级/升阶/遣散
const s0 = store.getState();
s0.res.gold = 5e9; s0.res.exp = 5e9;
const someId = Object.keys(s0.roster)[0];
const lv0 = s0.roster[someId].lv;
store.levelUp(someId, 50);
ok(s0.roster[someId].lv > lv0, 'level up works: ' + lv0 + '->' + s0.roster[someId].lv);
ok(s0.roster[someId].lv <= 60, 'level cap respected: ' + s0.roster[someId].lv);

// 8. 挂机
s0.idle.last = Date.now() - 3 * 3600 * 1000;
s0.idle.gold = 0; s0.idle.exp = 0; s0.idle.scroll = 0;
store.idleTick();
const pend = store.idlePending();
ok(pend.gold > 0 && pend.hours <= 12.02, 'idle accrual: ' + JSON.stringify(pend.hours));
const claim = store.claimIdle();
ok(claim.gold > 0, 'idle claim: ' + claim.gold);

// 9. 装备（四品质 / 阵营加成 / 吃装备升星 / 分解 / v1 存档迁移）
const IT = require('../utils/items');
// 品质数值：SSR 满星 1.5 倍，阵营匹配再 ×1.3
ok(IT.equipStat(4, 'weapon', 5, false).atk === Math.floor(1150 * 1.5), 'SSR 5-star weapon atk');
ok(IT.equipStat(4, 'weapon', 5, true).atk === Math.floor(1150 * 1.5 * 1.3), 'SSR 5-star faction-matched atk');
ok(IT.starNeed(4, 0) === 500 && IT.starNeed(4, 4) === 7500 && IT.starNeed(1, 0) === 60, 'star point table');
ok(IT.fodderPoints({ q: 2, stars: 0 }) === 26 && IT.fodderPoints({ q: 3, stars: 2 }) === 140, 'fodder points');
{
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(IT.dropQuality(0));
  ok(seen.size >= 2 && [...seen].every(q => q >= 1 && q <= 4), 'dropQuality in range');
}
// 掉落入库：SR/SSR 自带阵营，N/R 无阵营
const eid = store.addEquip(3, 'weapon');
ok(store.getState().equips[eid].q === 3 && !!store.getState().equips[eid].faction, 'SR drop carries faction');
const plainId = store.addEquip(1, 'boots');
ok(store.getState().equips[plainId].faction === null, 'N drop has no faction');
// 穿戴加成
const before = JSON.stringify(store.calcHero(someId).stats);
store.equipTo(someId, 'weapon', eid);
ok(store.calcHero(someId).stats.atk > JSON.parse(before).atk, 'equip boosts atk');
// 升星：无狗粮拒绝 → 吃狗粮成功 → 狗粮被消耗、星级+1（SR +1 需 200 点）
s0.res.gold = 1e8;
ok(!store.enhanceEquip(eid, []).ok, 'enhance without fodder rejected');
const f1 = store.addEquip(1, 'weapon'), f2 = store.addEquip(3, 'helm'), f3 = store.addEquip(3, 'armor'), f4 = store.addEquip(3, 'weapon');
const goldBefore = s0.res.gold;
const enh = store.enhanceEquip(eid, [f1, f2, f3, f4]);
ok(enh.ok && enh.stars === 1, 'enhance with fodder works');
ok(!s0.equips[f1] && !s0.equips[f2] && !s0.equips[f3] && !s0.equips[f4], 'fodder consumed');
ok(s0.res.gold === goldBefore - IT.starGold(IT.starNeed(3, 0)), 'enhance gold deducted');
ok(!store.enhanceEquip(eid, [store.addEquip(1, 'weapon')]).ok, 'insufficient points rejected');
// 一键放入：由低到高凑满所需强化点（SR+2 需 500 点）
const need1 = IT.starNeed(3, 1);
const pool = [];
for (let i = 0; i < 2; i++) pool.push(store.addEquip(1, 'weapon'));
for (let i = 0; i < 5; i++) pool.push(store.addEquip(3, 'armor'));
pool.push(store.addEquip(4, 'weapon'));
const autoIds = store.fodderPickIds(eid, pool);
const autoPts = autoIds.reduce((s, id) => s + IT.fodderPoints(s0.equips[id]), 0);
ok(autoPts >= need1, 'fodderPickIds fills need: ' + autoPts + '/' + need1);
// 分解：返还铜钱、批量清白装
const sv = store.salvageEquip(plainId);
ok(sv.ok && sv.gold > 0, 'salvage returns gold');
store.salvageBatch(1);
ok(Object.keys(s0.equips).every(id => s0.equips[id].q !== 1 || s0.equips[id].stars > 0), 'batch salvage clears N');
// v1 → v2 存档迁移
{
  const oldSave = { v: 1, equips: {
    e1: { id: 'e1', tier: 6, slot: 'weapon', enh: 12 },
    e2: { id: 'e2', tier: 1, slot: 'helm', enh: 3 },
    e3: { id: 'e3', tier: 4, slot: 'armor', enh: 7 }
  } };
  store.migrateSaveV1(oldSave);
  ok(oldSave.v === 2, 'save version bumped');
  ok(oldSave.equips.e1.q === 4 && oldSave.equips.e1.stars === 5, 'v1 t6+12 → SSR 5-star');
  ok(oldSave.equips.e2.q === 1 && oldSave.equips.e2.stars === 1, 'v1 t1+3 → N 1-star');
  ok(oldSave.equips.e3.q === 2 && oldSave.equips.e3.stars === 3 && oldSave.equips.e3.faction === null, 'v1 t4+7 → R 3-star');
  ok(oldSave.equips.e1.tier === undefined && oldSave.equips.e1.enh === undefined, 'legacy fields removed');
}

// 10. 升阶（给同名卡+兵魂）
s0.roster[someId].cards = 5;
s0.res.gold = 1e8;
const st0 = s0.roster[someId].star;
const asc = store.ascend(someId);
ok(asc.ok, 'ascend ok: ' + JSON.stringify(asc));

// 11. 塔/演武/任务/商店
const tr = store.winTower(1);
ok(tr.gem > 0, 'tower reward');
const af = store.arenaFight(true, 1.0);
ok(af.tokens === 2, 'arena tokens');
const ql = store.questList();
ok(ql.every(q => typeof q.done === 'boolean'), 'quest list ok');
s0.res.gem = 100000;
const buy = store.buyGood('s_gold');
ok(buy.ok, 'shop buy ok');

// 12. 演武对手生成
const opp = stages.makeArenaEnemies(store.teamPower(), 123, 1.0);
ok(opp.units.length === 5, 'arena enemies ok');
const tw = stages.makeTowerEnemies(3);
ok(tw.units.length === 5, 'tower enemies ok');

// 13. 广告：每日计数、双倍领取、免费快速收获、复活血量
ok(store.adCount('fast') === 0, 'ad count init');
store.adBump('fast'); store.adBump('fast');
ok(store.adCount('fast') === 2, 'ad bump works');
s0.idle.gold = 500; s0.idle.exp = 400; s0.idle.scroll = 0; s0.idle.last = Date.now();
const c2 = store.claimIdle(true);
ok(c2.gold === 1000 && c2.exp === 800, 'claimIdle double: ' + JSON.stringify(c2));
const gemBefore = s0.res.gem;
const frf = store.fastReward(true);
ok(frf.ok && s0.res.gem === gemBefore, 'free fast reward skips gem');
const frp = store.fastReward(false);
ok(frp.ok && s0.res.gem === gemBefore - 50, 'paid fast reward costs gem');
// 复活：startHpPct 生效
const strongP = store.playerUnits();
const b4 = battle.createBattle({
  team: strongP.map(u => Object.assign({}, u, { startHpPct: 0.3 })),
  enemy: eUnits, seed: 5
});
const snapPct = b4.snapshot().filter(s => s.side === 'A');
ok(snapPct.every(s => s.hp <= s.maxHp * 0.3 + 1), 'revive startHpPct applied: ' + JSON.stringify(snapPct.map(s => s.hp + '/' + s.maxHp)));

// ---------- 14. 广告桥接层（src/ads/bridge）：统一契约与平台兼容 ----------
// platform.js 在首次 require 时定格 api：注入桩后清缓存重取，测完还原
const asyncChecks = [];
function fakeRewardedAd() {
  const ls = { close: [], error: [] };
  const calls = [];
  let showFn = null;
  return {
    calls,
    setShow(fn) { showFn = fn; },
    load() { calls.push('load'); return Promise.resolve(); },
    show() { calls.push('show'); return showFn ? showFn() : undefined; },
    onClose(f) { ls.close.push(f); },
    offClose(f) { const i = ls.close.indexOf(f); if (i >= 0) ls.close.splice(i, 1); },
    onError(f) { ls.error.push(f); },
    offError(f) { const i = ls.error.indexOf(f); if (i >= 0) ls.error.splice(i, 1); },
    fireClose(res) { ls.close.slice().forEach(f => f(res)); },
    fireError(e) { ls.error.slice().forEach(f => f(e)); },
    boundCount() { return ls.close.length + ls.error.length; }
  };
}
function withPlatform(globalName, stub, fn) {
  global[globalName] = stub;
  delete require.cache[require.resolve('../utils/platform')];
  delete require.cache[require.resolve('../src/ads/bridge')];
  try {
    fn(require('../src/ads/bridge'));
  } finally {
    delete global[globalName];
    delete require.cache[require.resolve('../utils/platform')];
    delete require.cache[require.resolve('../src/ads/bridge')];
  }
}
function asyncOk(promise, assertFn, name) {
  asyncChecks.push(promise.then(v => { ok(assertFn(v), name); }).catch(e => { ok(false, name + ': ' + (e && e.message)); }));
}
function asyncOkReject(promise, name) {
  asyncChecks.push(promise.then(() => { ok(false, name); }).catch(() => { ok(true, name); }));
}

// 微信（现代基础库）：show 返回 Promise，看完 → ended:true，终态后事件解绑、单例复用
{
  const ad = fakeRewardedAd();
  ad.setShow(() => Promise.resolve());
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    ok(bridge.available(), 'bridge available with rewarded stub');
    const inst = bridge.createRewarded('u_wechat');
    ok(bridge.createRewarded('u_wechat') === inst, 'bridge singleton per adUnitId');
    asyncOk(inst.show(), r => r.ended === true && ad.boundCount() === 0,
      'wechat: full watch resolves ended:true and unwires listeners');
    setTimeout(() => ad.fireClose({ isEnded: true }), 0);
  });
}
// 微信：show 失败 → 自动 load 重试一次 → 看完
{
  const ad = fakeRewardedAd();
  let n = 0;
  ad.setShow(() => { n += 1; return n === 1 ? Promise.reject(new Error('not loaded')) : Promise.resolve(); });
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_retry').show(),
      r => r.ended === true && ad.calls.join(',') === 'show,load,show',
      'wechat: show-fail auto reloads then retries once');
    setTimeout(() => ad.fireClose({ isEnded: true }), 0);
  });
}
// 微信：show 失败伴随的 onError 噪音不打断重试（失败判定只走 promise 链）
{
  const ad = fakeRewardedAd();
  let n = 0;
  ad.setShow(() => { n += 1; return n === 1 ? Promise.reject(new Error('not loaded')) : Promise.resolve(); });
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_noise').show(), r => r.ended === true,
      'wechat: onError noise does not break load retry');
    setTimeout(() => ad.fireError(new Error('not loaded')), 0);
    setTimeout(() => ad.fireClose({ isEnded: true }), 5);
  });
}
// 微信：提前关闭 → ended:false
{
  const ad = fakeRewardedAd();
  ad.setShow(() => Promise.resolve());
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_early').show(), r => r.ended === false,
      'wechat: early close resolves ended:false');
    setTimeout(() => ad.fireClose({ isEnded: false }), 0);
  });
}
// 老基础库（show 无返回值）：结果走事件；提前关闭
{
  const ad = fakeRewardedAd();
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_legacy').show(), r => r.ended === false,
      'legacy no-promise: event close carries ended:false');
    setTimeout(() => ad.fireClose({ isEnded: false }), 0);
  });
}
// 老基础库：show 后 onError → reject
{
  const ad = fakeRewardedAd();
  withPlatform('wx', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOkReject(bridge.createRewarded('u_err').show(), 'legacy no-promise: onError rejects');
    setTimeout(() => ad.fireError(new Error('no fill')), 0);
  });
}
// 抖音：load 在前 show 在后，看完 → ended:true
{
  const ad = fakeRewardedAd();
  ad.setShow(() => Promise.resolve());
  withPlatform('tt', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_douyin').show(),
      r => r.ended === true && ad.calls.join(',') === 'load,show',
      'douyin: loads before show, resolves ended:true');
    setTimeout(() => ad.fireClose({ isEnded: true }), 0);
  });
}
// 抖音老基础库：load/show 均无返回值，事件驱动
{
  const ad = fakeRewardedAd();
  ad.load = () => { ad.calls.push('load'); return undefined; };
  withPlatform('tt', { createRewardedVideoAd: () => ad }, (bridge) => {
    asyncOk(bridge.createRewarded('u_tt_legacy').show(), r => r.ended === true,
      'douyin legacy no-promise: event close resolves');
    setTimeout(() => ad.fireClose({ isEnded: true }), 0);
  });
}
// 平台无广告 API：available() 为 false
withPlatform('wx', {}, (bridge) => {
  ok(bridge.available() === false, 'bridge unavailable without rewarded API');
});

// 异步用例（广告桥接）全部 settle 后再汇总
Promise.all(asyncChecks).then(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
}).catch((e) => {
  fail += 1;
  console.log('FAIL: bridge suite: ' + (e && e.message));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(1);
});
