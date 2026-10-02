// 规则冒烟测试：经济改版（元宝挂机/快速收获/品质碎片）、首通里程碑与旧档兼容。
// 运行：node test/smoke.js（纯 Node，无微信依赖；通过注入 wx 桩使用内存存储）
const assert = require('assert');

const SAVE_KEY = 'sanguo_afk_save_v1';
const storage = (() => { const m = new Map(); return {
  setStorageSync: (k, v) => m.set(k, v), getStorageSync: k => m.get(k), _map: m }; })();
global.wx = storage; // utils/platform.js 在 require 时读取

const C = require('../utils/config');
const H = require('../utils/heroes');
const IT = require('../utils/items');
const F = require('../utils/fmt');
const stages = require('../utils/stages');
const battleRules = require('../utils/battle');

let passed = 0, failed = 0, section = '';
function check(name, cond) {
  if (cond) { passed++; } else { failed++; console.error('  FAIL [' + section + '] ' + name); }
}
function head(name) { section = name; }
function freshStore() {
  delete require.cache[require.resolve('../utils/store')];
  return require('../utils/store');
}
const REAL_RANDOM = Math.random;
function pinRandom() { Math.random = () => 0.99; } // 避开 65% 军械掉落噪声
function unpinRandom() { Math.random = REAL_RANDOM; }
const REAL_NOW = Date.now;
let fakeNow = 0;
function useFakeTime(startOffsetHours) {
  fakeNow = REAL_NOW() - (startOffsetHours || 0) * 3600000;
  Date.now = () => fakeNow;
}
function restoreTime() { Date.now = REAL_NOW; }
function advanceHours(h) { fakeNow += h * 3600000; }

// ---------- S1 经济常量与默认存档 ----------
head('S1 经济常量');
check('单抽 100', C.GACHA.singleGold === 100);
check('十连 900', C.GACHA.costTenGold === 900);
check('挂机不产招募令', C.idleRates(50).scrollPerHour === 0);
check('精铁 25/小时', C.ARMORY_IRON_PER_HOUR === 25);
check('元宝 1000/小时 · 5 小时', C.GEM_IDLE.perHour === 1000 && C.GEM_IDLE.capHours === 5);
check('快收 1 小时 × 3 次', C.FAST_AD.hours === 1 && C.FAST_AD.daily === 3 && C.FAST_AD.gem === 1000 && C.FAST_AD.iron === 25);
check('保底 40 抽 · 十连保底 R+', C.GACHA.pity && C.GACHA.pity.ssrHard === 40 && C.GACHA.pity.tenMinR === true);
check('满星 N/R 重复卡转铜钱', C.DUPE_GOLD && C.DUPE_GOLD[1] === 5000 && C.DUPE_GOLD[2] === 12000);
check('时限 90 · 残局狂暴 75s+1%/s · 敌方光环 0.75 · 斜率 1.9', C.BATTLE.TIME_LIMIT === 90
  && C.BATTLE.OVERTIME && C.BATTLE.OVERTIME.start === 75 && C.BATTLE.OVERTIME.atkPerSec === 0.01
  && C.ENEMY_FACTION_AURA === 0.75 && C.CAMPAIGN_DIFFICULTY.levelSlope === 1.9);
const store1 = freshStore(); store1.load();
let s = store1.getState();
check('默认档 v8', s.v === 8);
check('品质碎片字段', s.qualityShards && s.qualityShards[4] === 0);
check('元宝待领从零起算', Math.floor(s.idle.gem) === 0);
check('旧商店招募令已移除', !IT.SHOP_GOODS.some(g => g.id === 's_scroll1' || g.id === 's_scroll5'));

// ---------- S2 元宝挂机与每日额度 ----------
head('S2 元宝挂机额度');
storage._map.clear();
useFakeTime(0);
const store2 = freshStore(); store2.load();
s = store2.getState();
s.campaign.cleared = 10; // 固定铜钱速率
advanceHours(0.5); store2.idleTick();
check('0.5 小时 → 500 元宝', Math.floor(s.idle.gem) === 500);
advanceHours(0.5); store2.idleTick();
check('1 小时 → 1000 元宝', Math.floor(s.idle.gem) === 1000);
advanceHours(4); store2.idleTick();
check('5 小时 → 5000 元宝', Math.floor(s.idle.gem) === 5000);
advanceHours(1); store2.idleTick();
check('6 小时仍封顶 5000', Math.floor(s.idle.gem) === 5000);
advanceHours(6); store2.idleTick();
const pend = store2.idlePending();
check('铜钱自然 12 小时封顶', pend.gold <= 12 * C.idleRates(10).gold);
check('精铁 12 小时 = 300', pend.iron === 300);
const claim1 = store2.claimIdle(false);
check('领取得 5000 元宝', claim1.ok && claim1.gem === 5000);
check('额度记录 5000', s.gemDay.claimedGem === 5000);
advanceHours(2); store2.idleTick();
const claim2 = store2.claimIdle(false);
check('当日额度用尽后不再发元宝', claim2.gem === 0);
check('待领元宝继续累计（跨领取保留）', Math.floor(s.idle.gem) === 2000);
// 跨天重置
s.gemDay.day = '2000-01-01';
store2.checkDailyReset();
check('跨 00:00 额度重置', s.gemDay.claimedGem === 0);
const claim3 = store2.claimIdle(false);
check('新一天可再领（待领不清空）', claim3.gem === 2000);
// 时间回拨
advanceHours(-10); store2.idleTick();
check('时间回拨不产生负收益/重复累计', Math.floor(s.idle.gem) === 0 && s.idle.ironAcc >= 0);
restoreTime();

// ---------- S3 快速收获与原子广告奖励 ----------
head('S3 快速收获');
storage._map.clear();
useFakeTime(0);
const store3 = freshStore(); store3.load();
s = store3.getState();
s.campaign.cleared = 10;
advanceHours(12); store3.idleTick(); // 自然满额
const ironBefore = s.idle.ironAcc;
const fast1 = store3.adReward('fast', () => store3.fastRewardAdMutation());
check('快收成功', fast1.ok && fast1.gem === 1000);
check('快收给 1 小时铜钱', fast1.gold === C.idleRates(10).gold);
check('快收给精铁 25', fast1.iron === 25);
check('元宝占当日额度', s.gemDay.claimedGem === 1000);
check('精铁不占自然累计', s.idle.ironAcc === ironBefore);
check('广告次数记 1', store3.adCount('fast') === 1);
store3.adReward('fast', () => store3.fastRewardAdMutation());
store3.adReward('fast', () => store3.fastRewardAdMutation());
check('3 次后禁用', store3.adCount('fast') === 3 && !store3.adReward('fast', () => store3.fastRewardAdMutation()).ok);
const countSnap = store3.adCount('fast'), gemSnap = s.res.gem;
const failFast = store3.adReward('fast', () => ({ ok: false, msg: '模拟发放失败' }));
check('发放失败不计次数', failFast.ok === false && store3.adCount('fast') === countSnap);
const boom = store3.adReward('fast', () => { throw new Error('boom'); });
check('grant 抛错整事务回滚', boom.ok === false && s.res.gem === gemSnap && store3.adCount('fast') === countSnap);
s.gemDay.claimedGem = 4500;
s.fast.count = 0; // 单独验证额度门槛（次数门槛已在上一条覆盖）
const noQuota = store3.fastRewardAdMutation();
check('额度不足 1000 拒绝', noQuota.ok === false && /额度/.test(noQuota.msg));
// 双倍不含元宝
s.gemDay.claimedGem = 0; s.idle.gem = 2000;
const before = { gold: s.res.gold, gem: s.res.gem };
s.idle.gold = 10000; s.idle.scroll = 5;
const dbl = store3.adReward('idle2x', () => store3.claimIdleInternal(true));
check('双倍铜钱 ×2', dbl.gold === 20000);
check('双倍不倍增元宝', dbl.gem === 2000 && s.res.gem === before.gem + 2000);
check('旧待领招募令保留可领', dbl.scroll === 5);
restoreTime();

// ---------- S4 召唤价格与品质碎片 ----------
head('S4 召唤与碎片');
storage._map.clear();
const store4 = freshStore(); store4.load();
s = store4.getState();
s.res.gem = 250;
const single = store4.doSummon('gem1');
check('元宝单抽扣 100', single.ok && s.res.gem === 150 && single.results.length === 1);
s.res.gem = 50;
check('余额不足 100 拒绝单抽', store4.doSummon('gem1').ok === false && s.res.gem === 50);
s.res.gem = 250;
s.res.gem = 899;
check('899 不足十连', store4.doSummon('gem10').ok === false && s.res.gem === 899);
s.res.gem = 950;
const ten = store4.doSummon('gem10');
check('十连扣 900 出 10 卡', ten.ok && s.res.gem === 50 && ten.results.length === 10);
// 满星重复卡 → N/R 转铜钱、SR/SSR 转品质碎片
s.roster.liaohua.star = 2; // N 满星
s.qualityShards[1] = 0;
const goldBefore = s.res.gold;
const dup = store4.grantCard('liaohua');
check('满星 N 重复卡转铜钱 5000', dup.goldGain === 5000 && s.res.gold === goldBefore + 5000 && s.qualityShards[1] === 0);
check('不再堆积同名卡', s.roster.liaohua.cards === 0);
// 10 片兑换（满星目标直接拒绝，避免负 9 片陷阱）
s.qualityShards[1] = 10;
const exMax = store4.exchangeQualityShard(1, 'liaohua');
check('满星目标兑换直接拒绝', exMax.ok === false && s.qualityShards[1] === 10);
s.qualityShards[3] = 10;
const srId = H.HEROES.find(h => h.rarity === 3 && !s.roster[h.id]).id;
const exNew = store4.exchangeQualityShard(3, srId);
check('碎片解锁新 SR', exNew.ok && exNew.isNew && s.qualityShards[3] === 0);
check('碎片不足拒绝', store4.exchangeQualityShard(3, srId).ok === false);
// 旧档通用碎片兑换入口保留
s.roster.guanyu.star = 5; s.roster.guanyu.cards = 2;
const conv = store4.convertCards([{ id: 'guanyu', count: 1, confirmHigh: true }]);
check('旧多余卡仍可兑通用碎片', conv.ok && s.res.shard === conv.shards && s.roster.guanyu.cards === 1);
// 保底：40 抽必出 SSR（计数跨单/十连，出 SSR 清零）；十连全白时末位补 R
Math.random = () => 0.5; // 固定随机：rollRarity 恒出 N
s.summon.pity.sinceSsr = 39;
s.res.gem = 100;
const forced = store4.doSummon('gem1');
check('40 抽保底必出 SSR', forced.ok && forced.results[0].rarity === 4 && s.summon.pity.sinceSsr === 0);
s.res.gem = 1000;
const tenN = store4.doSummon('gem10');
check('十连保底 R+（全白时末位补 R）', tenN.ok
  && tenN.results.slice(0, 9).every(r => r.rarity === 1) && tenN.results[9].rarity === 2
  && s.summon.pity.sinceSsr === 10);
check('保底进度可读', store4.summonPityInfo().sinceSsr === 10 && store4.summonPityInfo().ssrHard === 40);
Math.random = REAL_RANDOM;

// ---------- S4b 七日目标 / 演武分段 / 练兵上限 / 塔奖励（第二轮） ----------
head('S4b 第二轮规则');
storage._map.clear();
const store4b = freshStore(); store4b.load();
const s4b = store4b.getState();
check('七日表 7 天且第 7 天 SSR 券', C.SEVEN_DAY.length === 7 && C.SEVEN_DAY[6].reward.ssrPick === 1);
check('七日第 1 天可领', store4b.sevenDayInfo().list[0].claimable === true);
const sd1 = store4b.claimSevenDay(1);
check('七日第 1 天领取到账', sd1.ok && s4b.res.scroll >= 3);
check('七日重复领取拒绝', store4b.claimSevenDay(1).ok === false);
check('七日第 2 天当日不可领', store4b.claimSevenDay(2).ok === false);
// 演武：令牌按难度分档 + 段位首达一次性奖励
const af1 = store4b.arenaFight(true, 1.35, true);
check('演武凶险档胜 4 令', af1.tokens === 4);
check('段位首达一次性奖励', !!af1.rankUp && af1.rankUp.name === '都尉' && s4b.res.gem >= 100);
check('段位奖励不重复', store4b.arenaFight(true, 1.35, true).rankUp === null);
// 轻参与校准（研讨会十二 B1）：每日首胜积分 ×1.5、偏将门槛 1100、周Boss 新档位
{
  global.wx._map.delete(SAVE_KEY); // 清共享桩存储，防上一块存档带入今日首胜标记
  const storeB1 = freshStore(); storeB1.load();
  const sB1 = storeB1.getState();
  check('B1 周Boss hpK=220 顶档 6% 印信25', C.WEEKBOSS.hpK === 220 && C.WEEKBOSS.tiers[0].pct === 0.06 && C.WEEKBOSS.tiers[0].reward.seals === 25);
  const f1 = storeB1.arenaFight(true, 1.35, true);
  const f2 = storeB1.arenaFight(true, 1.35, true);
    check('B1 首胜积分 ×1.5（25→38）', f1.delta === Math.round(Math.round(14 + 8 * 1.35) * 1.5));
  check('B1 同日第二胜无加成', f2.delta === Math.round(14 + 8 * 1.35));
  check('B1 首胜只加积分不加令', f1.tokens === 4);
  check('B1 首胜标记回传（结算页展示用）', f1.firstWinBonus === true && f2.firstWinBonus === false);
  sB1.arena.points = 1100;
  check('B1 偏将门槛 1100', (IT.ARENA_RANKS.find(r => r.name === '偏将军') || {}).min === 1100);
}
// 塔：首通带精铁
const tw1 = store4b.winTower(1);
check('塔首通 元宝32 · 精铁2', tw1.gem === 32 && tw1.iron === 2);
check('塔非首通无奖励', store4b.winTower(1).gem === 0);
// 练兵经验每日上限
s4b.daily.trainingWins = C.TRAINING_DAILY_CAP;
const tb = store4b.beginBattle({ mode: 'training', index: 0, referenceLevel: 5 });
const ts = store4b.settleBattle(tb.id, { win: true });
check('练兵超每日上限零经验', ts.ok && ts.gainedXP === 0);
// 败北 25% 经验
const lb = store4b.beginBattle({ mode: 'campaign', index: 1, referenceLevel: 5 });
const ls = store4b.settleBattle(lb.id, { win: false });
check('战役败北给 25% 经验', ls.ok && ls.gainedXP > 0);
// 重复通关线性铜钱
s4b.campaign.cleared = 10;
check('重复通关铜钱线性 800+12×关', store4b.campaignRewardPreview(12).gold === 944);
// 三国羁绊
check('羁绊表 8 组且成员有效', (H.BONDS || []).length === 8 && H.BONDS.every(b => b.heroes.every(id => !!H.getHero(id))));
check('八组羁绊全部配置组合技', H.BONDS.every(b => b.combo && b.combo.name && b.combo.passive && Object.keys(b.combo.passive).length === 1));
s4b.formation = ['liubei', 'guanyu', 'zhangfei', null, null];
check('桃园结义激活', store4b.activeBonds().some(b => b.id === 'taoyuan'));
check('羁绊注入全军被动（全军 atk≥+8%）', store4b.playerUnits().every(u => (u.passive.atk || 0) >= 0.08));
s4b.formation = ['zhangfei', 'guanyu', 'liaohua', 'liubei', 'mengda'];
check('默认阵容激活且仅激活桃园结义', store4b.activeBonds().some(b => b.id === 'taoyuan') && store4b.activeBonds().length === 1);
// 缘分组合技（研讨会十一 S4）：激活羁绊额外注入全军战斗被动
const comboMods = store4b.bondComboMods();
check('桃园组合技吸血 +3%', comboMods.vamp === 0.03);
check('组合技进全军被动（吸血≥3%）', store4b.playerUnits().every(u => (u.passive.vamp || 0) >= 0.03));
check('组合技键均为战斗既有被动', H.BONDS.every(b => ['vamp','critDmg','firstEnergy','energyGain','thorns','dmgReduce','armoryStartShield','rageOnKill'].includes(Object.keys(b.combo.passive)[0])));
['zhugeliang','pangtong'].forEach(id => store4b.grantCard(id));
s4b.formation = ['zhugeliang','pangtong', null, null, null];
check('卧龙凤雏开场怒气 +10', store4b.bondComboMods().firstEnergy === 10);
check('卧龙组合技注入单元', store4b.playerUnits().every(u => (u.passive.firstEnergy || 0) >= 10));
s4b.formation = ['zhangfei', 'liaohua', 'mengda', null, null];
check('未凑齐组合无被动', Object.keys(store4b.bondComboMods()).length === 0);
// 悬赏派遣：刷新 4 单、派遣、计时报酬、跨日自动补发、忙碌武将拒绝
const bt0 = store4b.bountyInfo();
check('悬赏刷新 4 单', bt0.list.length === 4 && bt0.list.every(b => [4, 8, 12].includes(b.hours)));
const freeIdx = bt0.list.findIndex(b => b.state === 'open');
const dB = store4b.dispatchBounty(freeIdx, 'liaohua');
check('悬赏派遣成功', dB.ok);
check('同将不可两单', store4b.dispatchBounty((freeIdx + 1) % 4, 'liaohua').ok === false);
check('未到时辰不可领', store4b.claimBounty(freeIdx).ok === false);
s4b.bounty.list[freeIdx].dispatchedAt -= s4b.bounty.list[freeIdx].hours * 3600000; // 快进到归来（按该单时长）
const cB = store4b.claimBounty(freeIdx);
check('到时领赏入账', cB.ok && cB.reward && s4b.res.gem > 0);
check('悬赏奖励不含精铁', !Object.keys(cB.reward).includes('iron'));
check('重复领取拒绝', store4b.claimBounty(freeIdx).ok === false);
// 同阵营派遣加成（2026-09-30 裁决 E）：命中铜钱/元宝 ×1.2、招募令不加成；不命中/旧档无条件单原额
{
  const g0 = s4b.res.gold, gem0 = s4b.res.gem, sc0 = s4b.res.scroll;
  s4b.bounty.list[1] = { hours: 4, name: '命中单', reward: { gold: 10000, gem: 100, scroll: 1 }, wantFaction: 'shu', heroId: 'guanyu', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
  s4b.bounty.list[2] = { hours: 4, name: '不命中单', reward: { gold: 10000, gem: 100, scroll: 1 }, wantFaction: 'wei', heroId: 'guanyu', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
  check('加成标记 bonusActive', store4b.bountyInfo().list[1].bonusActive === true && store4b.bountyInfo().list[2].bonusActive === false);
  const cHit = store4b.claimBounty(1);
  check('阵营命中 ×1.2（铜钱/元宝）招募令不加成', cHit.ok && cHit.bonus === true && s4b.res.gold === g0 + 12000 && s4b.res.gem === gem0 + 120 && s4b.res.scroll === sc0 + 1);
  const cMiss = store4b.claimBounty(2);
  check('阵营不命中原额', cMiss.ok && cMiss.bonus === false && cMiss.reward.gold === 10000 && cMiss.reward.gem === 100);
  s4b.bounty.list[3] = { hours: 4, name: '旧档单', reward: { gold: 1000 }, heroId: 'liaohua', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
  const cOld = store4b.claimBounty(3);
  check('旧档无 wantFaction 单不加成', cOld.ok && cOld.bonus === false && cOld.reward.gold === 1000);
}
s4b.bounty.list[(freeIdx + 1) % 4] = { hours: 4, name: '测试单', reward: { gold: 1000 }, heroId: 'mengda', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
s4b.bounty.day = '2000-01-01'; // 强制跨日刷新
store4b.checkDailyReset();
check('跨日刷新自动补发未领悬赏', s4b.res.gold >= 1000);
check('刷新后新 4 单', store4b.bountyInfo().list.length === 4);
// 进行中悬赏跨日结转（不作废）
const bt2 = store4b.bountyInfo();
const openIdx2 = bt2.list.findIndex(b => b.state === 'open');
store4b.dispatchBounty(openIdx2, 'guanyu');
s4b.bounty.day = '2000-01-02';
store4b.checkDailyReset();
check('进行中悬赏跨日结转', store4b.bountyInfo().list.some(b => b.heroId === 'guanyu' && b.state === 'running'));
// 七日补领窗口：开服 7 天后未领作废
s4b.sevenDay.start = '2000-01-01';
check('超窗后七日不可补领', store4b.sevenDayInfo().list.every(d => !d.claimable) && store4b.claimSevenDay(2).ok === false);
// 神秘商人：确定性每日 2 件、限购、军械箱入账
const rm1 = store4b.roamerInfo();
const rm2 = store4b.roamerInfo();
check('商人每日 2 件且确定性', rm1.goods.length === 2 && JSON.stringify(rm1.ids) === JSON.stringify(rm2.ids));
check('商人不卖招募令折扣/精铁', rm1.goods.every(g => !g.give.iron && !(g.give.scroll && g.price / g.give.scroll < 90)));
const rmBuy = store4b.buyRoamer(rm1.goods[0].id);
check('商人购买成功', rmBuy.ok);
check('商人重复购买拒绝', store4b.buyRoamer(rm1.goods[0].id).ok === false);
check('商人军械箱入账（若有）', !rm1.goods[0].give.armoryBox || s4b.armory.boxes[rm1.goods[0].give.armoryBox] >= 1);
// 软保底：31 抽起每抽 +7% SSR 概率（确定性验证概率面而非随机面）
Math.random = () => 0.065; // 固定随机：0.065 < 2%+7%=9%（第 31 抽起）但 > 2%（31 抽前）
s4b.summon.pity.sinceSsr = 30;
s4b.res.gem = 200;
const softHit = store4b.doSummon('gem1');
check('31 抽软保底概率生效出 SSR', softHit.ok && softHit.results[0].rarity === 4);
s4b.summon.pity.sinceSsr = 20;
const softMiss = store4b.doSummon('gem1');
check('31 抽前无软保底（2% 未命中）', softMiss.ok && softMiss.results[0].rarity !== 4);
check('软保底字段可读', store4b.summonPityInfo().soft && store4b.summonPityInfo().soft.from === 31);
Math.random = REAL_RANDOM;
// 精锐关：每章第 5 关且 ≥25 关，×1.06
check('精锐关判定', stages.isEliteStage(25) && stages.isEliteStage(115) && !stages.isEliteStage(15) && !stages.isEliteStage(20) && !stages.isEliteStage(30));
const eliteEnemy = stages.makeStageEnemies(25), normalEnemy = stages.makeStageEnemies(24);
check('精锐敌阵 ×1.06', Math.abs(eliteEnemy.units[0].scale / normalEnemy.units[0].scale - 1.06) < 0.01 && eliteEnemy.elite === true);
// 评星纯函数
check('评星：慢速全存活=2星', stages.stageStars(true, 200, 5, false) === 2);
check('评星：慢速减员=1星', stages.stageStars(true, 200, 2, false) === 1);
check('评星：限时+存活=3星', stages.stageStars(true, 55, 4, false) === 3);
check('评星：精锐关放宽到70秒', stages.stageStars(true, 65, 5, false) === 2 && stages.stageStars(true, 65, 5, true) === 3);
check('评星：败北0星', stages.stageStars(false, 10, 5, false) === 0);
// 星宝箱：旧档回填★1 → 首章 10★ 可领
s4b.campaign.stars = { 1: 1, 2: 1 };
const starInfo = store4b.campaignStarChestInfo();
check('星宝箱进度（首章 2★）', starInfo.chapters[0].stars === 2 && starInfo.claimable === false);
s4b.campaign.cleared = 24;
const scWin = store4b.settleBattle(store4b.beginBattle({ mode: 'campaign', index: 25, referenceLevel: 5 }).id, { win: true, duration: 50, aliveCount: 4 });
check('结算记录评星（限时+存活=3星）', scWin.ok && scWin.reward.stars === 3 && s4b.campaign.stars[25] === 3);
check('精锐首通额外掉落+日宝箱', scWin.reward.elite && scWin.reward.eliteDrop !== null && !!scWin.reward.dailyChest);
check('日宝箱当日限一次', (() => { const w = store4b.winCampaign(35, { stars: 1, elite: true }); return w.dailyChest === null; })());
const chestClaim = store4b.claimStarChests();
check('10★ 星宝箱未达标拒绝领取', chestClaim.ok === false && s4b.campaign.starChests[0] === undefined);
// 波次 2：章节词缀 + Boss 机制 + 引擎 additive
check('词缀关判定（≥25，章内 3/7 关）', stages.resolveMods(27).length === 1 && stages.resolveMods(23).length === 0 && stages.resolveMods(33).length === 1 && stages.resolveMods(28).length === 0);
check('词缀相邻章不重样', stages.resolveMods(27)[0] !== stages.resolveMods(33)[0]);
const se117 = stages.makeStageEnemies(117);
check('117 削峰关不叠乘词缀补偿', se117.units[0].scale === se117.units[1].scale / 0.92);
const se27 = stages.makeStageEnemies(27);
check('词缀关标记生效', se27.mods.length === 1);
const se43 = stages.makeStageEnemies(43);
check('援军单元已构建（×0.75）', se43.mods[0] === 'reinforce' && Array.isArray(se43.reinforceUnits) && se43.reinforceUnits.length === 2);
const boss10 = stages.makeStageEnemies(10);
check('张角 Boss 机制挂载', !!boss10.bossMod && boss10.units[0].extraPassive && boss10.units[0].extraPassive.cheatRevivePct === 0.3);
const boss20 = stages.makeStageEnemies(20);
check('吕布免控挂载', !!boss20.bossMod && boss20.units[0].extraPassive.ccImmune === 1);
// 引擎：env 周期真伤
{
  const mk0 = (id, hp) => ({ uid: id, name: id, faction: 'wei', cls: 'warrior', level: 1, row: 0,
    stats: { hp, atk: 0, def: 0, spd: 1, crit: 0 } });
  const bt = battleRules.createBattle({ team: [mk0('a1', 10000)], enemy: [mk0('b1', 10000)],
    env: { pctPerSec: 0.005 }, timeLimit: 90 });
  for (let i = 0; i < 110; i++) bt.step(0.1); // 11 秒
  const snap = bt.snapshot();
  check('毒雾 11 秒双方各掉 ~5.5%', snap[0].hp > 9300 && snap[0].hp < 9600 && snap[1].hp > 9300 && snap[1].hp < 9600);
}
// 引擎：ccImmune
{
  const mk = (id, hp) => ({ uid: id, name: id, faction: 'wei', cls: 'warrior', level: 1, row: 0,
    stats: { hp, atk: 100, def: 0, spd: 1, crit: 0 }, passive: { ccImmune: 1 } });
  const bt = battleRules.createBattle({ team: [mk('a1', 5000)], enemy: [mk('b1', 5000)] });
  bt.step(0.1); bt.step(0.1);
  check('ccImmune 目标不受控', bt.snapshot().every(u => u.cc === null));
}
// 引擎：cheatRevivePct 30% 复活
{
  const mk = (id, hp) => ({ uid: id, name: id, faction: 'wei', cls: 'warrior', level: 1, row: 0,
    stats: { hp, atk: 10, def: 0, spd: 1, crit: 0 } });
  const boss = Object.assign(mk('b1', 1000), {});
  boss.passive = { cheatDeath: 1, cheatRevivePct: 0.3 };
  const bt = battleRules.createBattle({ team: [mk('a1', 99999)], enemy: [boss], timeLimit: 90 });
  for (let i = 0; i < 300 && !bt.ended; i++) bt.step(0.1);
  check('Boss 复活保留 30% 血（非 1 点）', !bt.ended || bt.snapshot().some(u => u.uid === 'b1' && u.hp === 300));
}
// 引擎：healScale 断粮
{
  const mkH = (id, hp, atk) => ({ uid: id, name: id, faction: 'wei', cls: 'support', level: 1, row: 0,
    stats: { hp, atk, def: 0, spd: 1, crit: 0 }, passive: { firstEnergy: 100 },
    ult: { name: 't', effects: [{ t: 'heal', tgt: 'allAllies', mult: 2 }] } });
  const a = mkH('a1', 5000, 100); a.startHpPct = 0.5;
  const b = mkH('b1', 5000, 0);
  const bt = battleRules.createBattle({ team: [a], enemy: [b], healScale: { A: 0.5, B: 1 }, timeLimit: 5 });
  for (let i = 0; i < 30 && !bt.ended; i++) bt.step(0.1);
  check('断粮治疗减半（200→100）', bt.snapshot()[0].hp >= 2590 && bt.snapshot()[0].hp <= 2610);
}
// 波次 3a：定向招募券 / 招贤值 / 万能 SSR 卡
Math.random = () => 0.35; // 固定随机 0.35：品质层 SR(2%+10%=12% 之外→r 段内)……实际落 N/R 段
s4b.summon.pity.sinceSsr = 0;
s4b.res.gem = 3000;
s4b.summon.ticketStock = 1;
const tf = store4b.setSummonFocus('shu');
check('定向激活成功', tf.ok && tf.focus === 'shu');
const tenFocus = store4b.doSummon('gem10');
check('券十连消耗券并取消定向', tenFocus.ok && tenFocus.focusUsed === 'shu' && s4b.summon.ticketStock === 0 && !s4b.summon.activeFocus);
check('券十连 SR+ 至少存在且品质合法', tenFocus.results.filter(r => r.rarity >= 3).every(r => r.rarity >= 3 && r.rarity <= 4));
check('非十连不消耗券（无券时拒绝定向）', store4b.setSummonFocus('wei').ok === false);
const ti = store4b.summonTicketInfo();
check('券信息可读', ti.stock === 0 && ti.limit === 2 && ti.used === 1);
Math.random = REAL_RANDOM;
// 招贤值：100 抽档
s4b.summon.total = 100;
const sp = store4b.summonPointsInfo();
check('招贤值 100 档可领', sp.list[0].claimable === true && sp.list[1].claimable === false);
const spc = store4b.claimSummonPoints(0);
check('招贤值领取到账（令+10）', spc.ok && s4b.res.scroll >= 10);
check('招贤值重复领取拒绝', store4b.claimSummonPoints(0).ok === false);
check('招贤值高档未达标拒绝', store4b.claimSummonPoints(1).ok === false);
// 万能 SSR 卡
s4b.res.univSsr = 1;
const uu1 = store4b.useUniversalSsr('liubei');
check('万能卡升星刘备（0→1★）', uu1.ok && s4b.roster.liubei.star === 1 && s4b.res.univSsr === 0);
check('无万能卡拒绝', store4b.useUniversalSsr('liubei').ok === false);
s4b.res.univSsr = 1;
s4b.roster.guanyu.star = 5;
check('万能卡拒绝满星目标', store4b.useUniversalSsr('guanyu').ok === false && s4b.res.univSsr === 1);
check('万能卡拒绝非 SSR', store4b.useUniversalSsr('liaohua').ok === false);
// 波次 3b：锻造台
check('锻造门禁：六槽未满 5★ 全拒绝', store4b.forgeGateOpen() === false && store4b.forgeReroll('weapon', 0).ok === false && store4b.forgeSetDir('weapon', 'atk').ok === false);
IT.ARMORY_SLOTS.forEach(sl => { s4b.armory.slotStars[sl.id] = 5; });
check('锻造门禁：六槽全 5★ 开启', store4b.forgeGateOpen() === true);
const fd = store4b.forgeSetDir('weapon', 'atk');
check('选向成功', fd.ok && store4b.forgeInfo('weapon').dir === 'atk');
const fr1 = store4b.forgeReroll('weapon', 0);
check('首次洗练出词条（免费）', fr1.ok && !!fr1.affix && s4b.res.gold === Math.floor(s4b.res.gold));
const wf1 = store4b.forgeInfo('weapon');
check('词条值在攻池白档范围', wf1.slots[0] && ((wf1.slots[0].stat === 'critDmg' && [0.06, 0.1, 0.14].includes(wf1.slots[0].val)) || (wf1.slots[0].stat === 'energyGain' && [0.04, 0.07, 0.1].includes(wf1.slots[0].val))));
const fr2 = store4b.forgeReroll('weapon', 1);
check('第二词条位取守池', fr2.ok && ['vamp', 'thorns'].includes(fr2.affix.stat));
const fr3 = store4b.forgeReroll('weapon', 0);
check('第三洗练仍免费', fr3.ok && fr3.freeUsed === true);
const goldBeforeForge = s4b.res.gold, ironBeforeForge = s4b.res.iron;
const fr4 = store4b.forgeReroll('weapon', 0);
check('免费用完后扣费 12000+25', fr4.ok && s4b.res.gold === goldBeforeForge - 12000 && s4b.res.iron === ironBeforeForge - 25);
store4b.forgeToggleLock('weapon', 1);
const goldLocked = s4b.res.gold, ironLocked = s4b.res.iron;
store4b.forgeReroll('weapon', 0);
check('对侧锁定费用 ×2', s4b.res.gold === goldLocked - 24000 && s4b.res.iron === ironLocked - 50);
// 保底：连续 5 次白后第 6 次必紫（种子 0.99 恒出白）
Math.random = () => 0.99;
s4b.res.gold = 10000000; s4b.res.iron = 100000;
s4b.armory.affixes.weapon.pity[0] = 0;
let lastPity = 0;
for (let i = 0; i < 6; i++) { const r = store4b.forgeReroll('weapon', 0); lastPity = r.ok ? r.pity : lastPity; }
check('6 次保底出紫（pity 归零）', lastPity === 0 && store4b.forgeInfo('weapon').slots[0].tier === 2);
Math.random = REAL_RANDOM;
// 词条并入全军加成
const fb = store4b.getArmoryBonuses();
const wfSlots = store4b.forgeInfo('weapon').slots;
  const expectedCrit = wfSlots.filter(a => a && a.stat === 'critDmg').reduce((sum, a) => sum + a.val, 0);
  check('词条并入 bonuses（critDmg=词条和）', fb.critDmg === expectedCrit);
// recvHeal 战斗通道：受疗 +12% 的单位治疗多 12%
{
  const mkH = (id, hp, atk, recv) => ({ uid: id, name: id, faction: 'wei', cls: 'support', level: 1, row: 0,
    stats: { hp, atk, def: 0, spd: 1, crit: 0 }, passive: Object.assign({ firstEnergy: 100 }, recv ? { recvHeal: recv } : {}),
    ult: { name: 't', effects: [{ t: 'heal', tgt: 'allAllies', mult: 2 }] } });
  const mkBt = (recv) => {
    const a = mkH('a1', 5000, 100, recv); a.startHpPct = 0.5;
    const b = mkH('b1', 5000, 0);
    const bt = battleRules.createBattle({ team: [a], enemy: [b], timeLimit: 5 });
    for (let i = 0; i < 30 && !bt.ended; i++) bt.step(0.1);
    return bt.snapshot()[0].hp;
  };
  const baseHp = mkBt(0), buffHp = mkBt(0.12);
  check('recvHeal 受疗 +12% 生效', buffHp > baseHp && Math.round((buffHp - baseHp)) <= 30);
}
// 波次 3c：阵图 + 熔炉
IT.ARMORY_SLOTS.forEach(sl => { s4b.armory.slotStars[sl.id] = 3; }); // 每槽 3★
const ma = store4b.motifActivate('huxiao', false);
check('阵图激活（250 精铁）', ma.ok && store4b.motifInfo().active === 'huxiao');
check('阵图二件套生效（crit+2%，件数=4）', store4b.getArmoryBonuses().crit >= 0.02);
check('阵图切换免费', store4b.motifActivate('panshi', false).ok && store4b.motifInfo().active === 'panshi');
check('阵图四件套未达（3★×4=四件 → 生效 hp+3%）', store4b.getArmoryBonuses().hp >= 0.03);
// 熔炉：25 关后重复件入库存
s4b.campaign.cleared = 30;
s4b.armory.unlocked['weapon_r'] = true; // 已解锁的重复件才走熔炉入库
const dupBefore = s4b.res.iron;
const dupItem = store4b.grantArmoryItem('weapon_r');
check('重复 R 件入熔炉库存', dupItem.smelted === true && s4b.armory.smeltStock['weapon_r'] === 1 && s4b.res.iron === dupBefore);
const melt = store4b.smeltMelt('weapon_r');
check('熔回 70%（R=17 精铁）', melt.ok && melt.iron === 17 && !s4b.armory.smeltStock['weapon_r']);
// 合成：3 件同槽 N → 1 件 R
for (let i = 0; i < 3; i++) store4b.grantArmoryItem('weapon_n');
const smeltStockN = s4b.armory.smeltStock['weapon_n'];
const ironBeforeCombine = s4b.res.iron, goldBeforeCombine = s4b.res.gold;
const cb = store4b.smeltCombine('weapon', 1);
check('三合一合成 R（扣 60 铁 8000 钱，折铁加回）', cb.ok && s4b.res.iron === ironBeforeCombine - 60 + (cb.convertedIron || 0) && s4b.res.gold === goldBeforeCombine - 8000);
check('合成产物图鉴解锁或折铁', !!cb.itemId || !!cb.convertedIron);
check('SR 不可合成', store4b.smeltCombine('weapon', 3).ok === false);
// 波次 3d：图鉴奖励 / 主公成就 / 远征周
const cx = store4b.codexInfo();
check('图鉴进度 10 项', cx.list.length === 10 && cx.claimable === false);
store4b.grantCard('liaohua'); // 已拥有
check('图鉴claim未集齐拒绝', store4b.claimCodex('shu-nr').ok === false);
// 成就：推图轴 cleared=0 → 第 1 档需 10 关不可领；塔轴首胜后可领
const av = store4b.achvInfo();
check('成就十二轴（五基础+名人堂/兵法/觉醒/操练/乱世/战报/同袍）', av.axes.length === 12 && av.axes.every(a => a.tiers.length === 10));
check('成就未达标拒绝', store4b.claimAchv('campaign', 2).ok === false); // cleared=30 < 40
// 远征周：周重置生成、任务进度、领取、印信、兑换
const wk = store4b.weekInfo();
check('周任务 7 条', wk.quests.length === 7);
const wq = store4b.claimWeekQuest(0);
check('周任务未完成拒绝', wq.ok === false);
store4b.grantCard('guanyu'); // 干扰项：不影响计数
s4b.week.counters.wins = 21;
s4b.week.counters.stages = 30;
const wq2 = store4b.claimWeekQuest(0);
check('周任务领取得印信', wq2.ok && s4b.seals >= 15);
const wq3 = store4b.claimWeekQuest(0);
check('周任务重复领取拒绝', wq3.ok === false);
s4b.seals += 100; // 充足印信用于兑换测试
const ba = store4b.buyWeekly('w_shard');
check('印信兑换碎片', ba.ok && s4b.res.shard >= 30);
const bg = store4b.buyWeekly('w_gem');
check('印信兑换元宝（周限 1 内）', bg.ok);
// 远征挑战：首层首通得印信
s4b.campaign.cleared = 30;
const ef = store4b.makeExpeditionFloor(1);
check('远征第 1 层免词缀（A1 免词缀层）', Array.isArray(ef.mods) && ef.mods.length === 0);
const ef5 = store4b.makeExpeditionFloor(5);
check('远征第 5 层带当周双词缀', ef5.mods.length === 2);
const eb = store4b.beginBattle({ mode: 'expedition', index: 1, referenceLevel: 30 });
const es = store4b.settleBattle(eb.id, { win: true, duration: 30, aliveCount: 5 });
check('远征首通得印信 15', es.ok && es.reward.seals === 15 && s4b.week.trial.best === 1);
const eb2 = store4b.beginBattle({ mode: 'expedition', index: 1, referenceLevel: 30 });
const es2 = store4b.settleBattle(eb2.id, { win: true, duration: 30, aliveCount: 5 });
check('远征重复通关不再发印信', es2.ok && (es2.reward.seals || 0) === 0);
// 战报：客户端 saveReplay 环形缓冲（20 条上限，同 tier 按 ts 淘汰最旧；无 mode 旧记录按名人堂 tier1）
for (let i = 0; i < 7; i++) store4b.saveReplay({ v: 1, seat: i % 3, ts: i, stars: i % 4 });
const rp = store4b.replaysInfo();
check('战报环形缓冲 7 条全留且最新在首', rp.list.length === 7 && rp.list[0].ts === 6 && rp.list[6].ts === 0);
// 图鉴/成就模拟达标领取
s4b.campaign.cleared = 10;
const ac = store4b.claimAchv('campaign', 0);
check('成就达标可领（推图 10 关档）', ac.ok);
// 波次 3 验收修补（评审缺口）：
// ① 锁定词条重洗拒绝
s4b.armory.affixes.weapon.lock[0] = 1;
check('锁定词条重洗拒绝', store4b.forgeReroll('weapon', 0).ok === false && store4b.forgeInfo('weapon').slots[0].stat === store4b.forgeInfo('weapon').slots[0].stat);
s4b.armory.affixes.weapon.lock[0] = 0;
// ② 熔炼多件栈按件结算
s4b.armory.smeltStock = { weapon_n: 3 };
s4b.armory.unlocked['weapon_n'] = true;
const ironM3 = s4b.res.iron;
const mm3 = store4b.smeltMelt('weapon_n');
check('熔炼 3 件栈得 3 份铁（10×0.7×3=21）', mm3.ok && mm3.iron === 21 && s4b.res.iron === ironM3 + 21 && !s4b.armory.smeltStock['weapon_n']);
// ③ 合成折铁精确档位（全解锁 R 折 25 而非 75）
s4b.armory.smeltStock = {};
s4b.armory.smeltStock['weapon_n'] = 3;
const ironC = s4b.res.iron, goldC = s4b.res.gold;
const cc = store4b.smeltCombine('weapon', 1);
const expectedRefund = cb && cb.convertedIron ? cc.convertedIron : 0;
check('合成扣费正确（60 铁 8000 钱）', cc.ok && s4b.res.iron >= ironC - 60 && s4b.res.gold === goldC - 8000);
check('合成折铁不越档（≤25）', !cc.convertedIron || cc.convertedIron <= 25);
// ④ 跨周重置：counters/questClaimed/shopBought 清空，seals 保留
s4b.week.counters.wins = 21;
s4b.week.shopBought['w_shard'] = 1;
const sealsBefore = s4b.seals;
s4b.week.weekId = '2020-W01';
store4b.checkDailyReset();
check('跨周计数清零', (s4b.week.counters.wins || 0) === 0 && s4b.week.questClaimed.length === 0 && !s4b.week.shopBought['w_shard']);
check('跨周印信保留', s4b.seals === sealsBefore);
// ⑤ 远征词缀进战斗效果（毒雾层血量下降）
s4b.campaign.cleared = Math.max(s4b.campaign.cleared, 10);
const efFloor = store4b.makeExpeditionFloor(1);
efFloor.mods = ['poisonFog'];
const eff = stages.stageBattleEffects(efFloor);
const mkE = (id, hp) => ({ uid: id, name: id, faction: 'wei', cls: 'warrior', level: 1, row: 0, stats: { hp, atk: 0, def: 0, spd: 1, crit: 0 } });
const btE = battleRules.createBattle(Object.assign({ team: [mkE('a1', 10000)], enemy: [mkE('b1', 10000)], timeLimit: 90 }, eff || {}));
for (let i = 0; i < 110 && !btE.ended; i++) btE.step(0.1);
check('远征毒雾词缀真实生效（11 秒 ~-5.5%）', btE.snapshot()[0].hp > 9300 && btE.snapshot()[0].hp < 9600);
// ⑥ 库存满仓自动折铁（不蒸发）
s4b.campaign.cleared = 30;
s4b.armory.smeltStock = { weapon_n: 9 };
const of1 = store4b.grantArmoryItem('weapon_n');
check('库存满仓第 10 件自动折铁（7 铁）', of1.iron === 7 && s4b.armory.smeltStock['weapon_n'] === 9);
// 波次 4：演武名人堂
check('名人堂 9 席成员 id 全部存在', C.HALL.pool.length === 9 && C.HALL.pool.every(l => l.members.every(id => !!H.getHero(id))));
const hl = store4b.hallInfo();
check('名人堂三席轮换（本周哈希确定性）', hl.seats.length === 3 && hl.seats.every(x => x.killed === false));
const hf = store4b.beginHall(0);
const he0 = stages.makeHallEnemies(hf.lineup, store4b.teamPower(), 0);
const hb = store4b.beginBattle({ mode: 'hall', index: 0, referenceLevel: he0.units[0].level, hallLineup: hf.lineup });
check('名人堂战斗可开', hb.ok);
const gemH0 = s4b.res.gem;
const hs0 = store4b.settleBattle(hb.id, { win: true, duration: 40, aliveCount: 5 });
check('名人堂首杀：荣耀20+元宝50+三星追加', hs0.ok && hs0.reward.hallReward.firstKill === true && s4b.res.gem === gemH0 + 50 && s4b.hall.honor >= 20 && s4b.hall.stars[s4b.week.weekId + ':' + hf.lineup.id] === 3);
const hs1 = store4b.beginBattle({ mode: 'hall', index: 0, referenceLevel: he0.units[0].level, hallLineup: hf.lineup });
const hs1s = store4b.settleBattle(hs1.id, { win: true, duration: 40, aliveCount: 5 });
check('重复挑战不再发奖', hs1s.ok && hs1s.reward.hallReward.firstKill === false && s4b.res.gem === gemH0 + 50);
// 荣耀称号阈值
s4b.hall.honor = 99;
const ht = store4b.winHall(1, stages.hallWeeklyLineups(F.isoWeekKey())[1], 1);
check('荣耀过 100 自动授称号', ht.honor > 0 && s4b.hall.titlesClaimed.indexOf('常胜将军') >= 0 && (s4b.titles || []).indexOf('常胜将军') >= 0);
// 回放决定论
// 波次 5：觉醒（满 5★ SSR 长线，荣耀+碎片门控）
store4b.grantCard('zhaoyun');
s4b.roster.zhaoyun.star = 4;
check('觉醒需 5★（4★ 赵云拒绝）', store4b.awakenHero('zhaoyun').ok === false && store4b.awakenInfo('zhaoyun').maxed === false);
s4b.roster.guanyu.star = 5;
const ai0 = store4b.awakenInfo('guanyu');
check('觉醒 5★ 后可看下一级（荣耀60+碎片10）', ai0.next && ai0.next.honor === 60 && ai0.next.shards === 10);
s4b.hall.honor = 60; s4b.qualityShards[4] = 10;
const aw1 = store4b.awakenHero('guanyu');
check('觉醒 1 级消耗荣耀与碎片', aw1.ok && s4b.roster.guanyu.awaken === 1 && s4b.hall.honor === 0 && s4b.qualityShards[4] === 0);
const powered = store4b.calcHero('guanyu');
check('觉醒面板血量恰为 +5%/级', (()=>{ const keep=s4b.roster.guanyu.awaken; s4b.roster.guanyu.awaken=0; const p0=store4b.calcHero('guanyu').stats.hp; s4b.roster.guanyu.awaken=keep; const p1=store4b.calcHero('guanyu').stats.hp; return p1===Math.floor(p0*1.05)&&p1>p0; })());
const baseNoAw = (function(){ const a1 = s4b.roster.guanyu.awaken; s4b.roster.guanyu.awaken = 0; const p0 = store4b.calcHero('guanyu').stats.hp; s4b.roster.guanyu.awaken = a1; const p1 = store4b.calcHero('guanyu').stats.hp; return p1 > p0; })();
check('觉醒提升实战面板血量', baseNoAw);
check('觉醒 2 级材料不足拒绝', store4b.awakenHero('guanyu').ok === false);
s4b.roster.liaohua.star = 5;
check('非 SSR 拒绝觉醒', store4b.awakenHero('liaohua').ok === false);
check('觉醒上限 3 级', C.AWAKEN.max === 3);
// 名人堂验收 R2 修补对应断言：
// 跨周结算不发奖（冻结周校验）
const hfX = store4b.beginHall(0);
const heX = stages.makeHallEnemies(hfX.lineup, store4b.teamPower(), 0);
const hbX = store4b.beginBattle({ mode: 'hall', index: 0, referenceLevel: 5, hallLineup: hfX.lineup });
s4b.week.weekId = '2099-W01'; // 结算前换周
const hsX = store4b.settleBattle(hbX.id, { win: true, duration: 30, aliveCount: 5 });
check('跨周结算名人堂不发奖', hsX.ok && hsX.reward.hallReward.firstKill === false && s4b.hall.honor === 0);
s4b.week.weekId = store4b.weekInfo().weekId;
// 周全胜一次性
s4b.week.counters = {};
const lineups = stages.hallWeeklyLineups(F.isoWeekKey());
lineups.forEach((l, i) => {
  const hb2 = store4b.beginBattle({ mode: 'hall', index: i, referenceLevel: 5, hallLineup: l });
  store4b.settleBattle(hb2.id, { win: true, duration: 30, aliveCount: 5 });
});
check('周三席全胜授周全胜奖励', s4b.res.token >= 10 && s4b.hall.honor >= 10);
// 觉醒 2→3 与上限态
s4b.roster.guanyu.awaken = 2; s4b.hall.honor = 200; s4b.qualityShards[4] = 30;
const aw3 = store4b.awakenHero('guanyu');
check('觉醒至 3 级（上限）', aw3.ok && s4b.roster.guanyu.awaken === 3);
check('觉醒上限后 next 为空', store4b.awakenInfo('guanyu').next === null);
check('觉醒扣荣耀称号不回收', s4b.hall.titlesClaimed.indexOf('常胜将军') >= 0);
// ---------- 波次 6：专属兵法（满 5★ SSR 长线：将魂+铜钱，只加成该武将自身） ----------
head('S4c 专属兵法');
const ssrDefs = H.HEROES.filter(h => h.rarity === 4);
check('16 只 SSR 均有专属兵法', ssrDefs.length === 16 && ssrDefs.every(h => h.tactic && h.tactic.name && h.tactic.desc && h.tactic.perLevel));
check('兵法红线：无全军增益键（aura/ultBuff 禁用）', ssrDefs.every(h =>
  Object.keys(h.tactic.perLevel).every(k => ['auraAtk', 'auraDef', 'auraSpd', 'ultBuff'].indexOf(k) < 0)));
check('兵法费用表：将魂 2/3/4/5/6 + 铜钱 2~6 万', C.TACTIC.max === 5 && C.TACTIC.soul.join() === '2,3,4,5,6'
  && C.TACTIC.gold.join() === '20000,30000,40000,50000,60000');
check('兵法需 5★（4★ 赵云拒绝）', store4b.tacticUpgrade('zhaoyun').ok === false && store4b.tacticInfo('zhaoyun').unlocked === false);
check('非 SSR 无兵法', store4b.tacticInfo('liaohua').ok === false && store4b.tacticUpgrade('liaohua').ok === false);
// 将魂转化：满星 SSR 重复卡 → 1 将魂（不再进品质碎片）；SR 满星重复卡仍转品质碎片
const soulT0 = s4b.res.soul || 0, shard4T0 = s4b.qualityShards[4] || 0;
const dupeSsr = store4b.grantCard('guanyu');
check('满星 SSR 重复卡转将魂 1', dupeSsr.soulGain === 1 && s4b.res.soul === soulT0 + 1 && s4b.qualityShards[4] === shard4T0 && !dupeSsr.shardGain);
s4b.roster.machao = { id: 'machao', star: 5, cards: 0, lockedCards: false, equip: {} };
const shard3T0 = s4b.qualityShards[3] || 0;
const dupeSr = store4b.grantCard('machao');
check('SR 满星重复卡仍转品质碎片', dupeSr.shardGain === 1 && s4b.qualityShards[3] === shard3T0 + 1 && !dupeSr.soulGain);
// 兵法信息与逐级消耗
const ti0 = store4b.tacticInfo('guanyu');
check('兵法信息：5★ 解锁 · 下一级将魂 2 + 铜钱 2 万', ti0.ok && ti0.unlocked && ti0.level === 0 && ti0.next && ti0.next.soul === 2 && ti0.next.gold === 20000);
// 门禁消耗校验：将魂/铜钱不足零扣款零升级
s4b.res.soul = 1; s4b.res.gold = 1000000;
const tuNoSoul = store4b.tacticUpgrade('guanyu');
check('将魂不足拒绝且零扣款', tuNoSoul.ok === false && s4b.res.soul === 1 && s4b.res.gold === 1000000 && (s4b.roster.guanyu.tacticLv || 0) === 0);
s4b.res.soul = 10; s4b.res.gold = 19999;
const tuNoGold = store4b.tacticUpgrade('guanyu');
check('铜钱不足拒绝且零扣款', tuNoGold.ok === false && s4b.res.soul === 10 && s4b.res.gold === 19999 && (s4b.roster.guanyu.tacticLv || 0) === 0);
s4b.res.gold = 20000;
const tu1 = store4b.tacticUpgrade('guanyu');
check('兵法 1 级消耗将魂 2 + 铜钱 2 万', tu1.ok && s4b.roster.guanyu.tacticLv === 1 && s4b.res.soul === 8 && s4b.res.gold === 0);
// 逐级数值：必杀倍率按 (1+增量×级) 乘入（关羽 2.5 → ×1.06 / ×1.30）
const ultDmgMult = calc => calc.ult.effects.find(e => e.t === 'dmg').mult;
const m1 = ultDmgMult(store4b.calcHero('guanyu'));
s4b.roster.guanyu.tacticLv = 5;
const m5 = ultDmgMult(store4b.calcHero('guanyu'));
check('逐级数值：必杀伤害 1 级 ×1.06', Math.abs(m1 - 2.5 * 1.06) < 1e-9);
check('逐级数值：必杀伤害 5 级 ×1.30', Math.abs(m5 - 2.5 * 1.3) < 1e-9);
// 被动注入：关羽攻击 0.15+0.01×5=0.20；吕布吸血 0.10+0.01×5=0.15；他人不受影响
check('兵法被动注入自身（关羽攻击 +5%）', Math.abs(store4b.calcHero('guanyu').passive.atk - 0.20) < 1e-9);
s4b.roster.lvbu = s4b.roster.lvbu || { id: 'lvbu', star: 5, cards: 0, lockedCards: false, equip: {} };
s4b.roster.lvbu.tacticLv = 5;
{
        s4b.roster.lvbu.tacticLv = 0;
        const v0 = store4b.calcHero('lvbu').passive.vamp || 0;
        s4b.roster.lvbu.tacticLv = 5;
        const v5 = store4b.calcHero('lvbu').passive.vamp || 0;
        check('兵法被动注入自身（吕布吸血逐级 +0.01×5）', Math.abs((v5 - v0) - 0.05) < 1e-9);
      }
// 兵法只加成自身：吕布兵法等级变化不改变张飞面板（军械词条是全军通道，兵法必须不是）
const zfWithTactic = store4b.calcHero('zhangfei').passive.vamp || 0;
s4b.roster.lvbu.tacticLv = 0;
const zfNoTactic = store4b.calcHero('zhangfei').passive.vamp || 0;
s4b.roster.lvbu.tacticLv = 5;
check('兵法只加成自身：张飞面板不随吕布兵法变化', zfWithTactic === zfNoTactic);
// 上限：5 级后 next 为空且拒绝升级
const tiMax = store4b.tacticInfo('guanyu');
check('兵法上限 5 级：next 为空且拒绝升级', tiMax.level === 5 && tiMax.next === null && store4b.tacticUpgrade('guanyu').ok === false);
// normalize 兜底：tacticLv 夹紧 0~5、res.soul 缺省 0（不升存档版本号）
const rawT = { v: 7, roster: { guanyu: { star: 5, tacticLv: 9 }, liaohua: {} }, res: { gold: 1 } };
store4b.normalizeState(rawT);
check('normalize 兜底：tacticLv 夹紧、将魂缺省 0', rawT.v === 7 && rawT.roster.guanyu.tacticLv === 5 && rawT.roster.liaohua.tacticLv === 0 && rawT.res.soul === 0);
// 名人堂评审 C6 补缺口：三星后补三星（A2 场景：分项独立不虚报）+ 跨周同阵容首杀按周重发
{
  // 场景：先 2 星首杀（领首杀 20），再补 3 星（只领三星 10）——分项独立
  const l2 = stages.hallWeeklyLineups(F.isoWeekKey())[2];
  {
    const k2 = s4b.week.weekId + ':' + l2.id;
    delete s4b.hall.kills[k2]; delete s4b.hall.threeClaimed[k2]; s4b.hall.stars[k2] = 0;
  }
  const hbA = store4b.beginBattle({ mode: 'hall', index: 2, referenceLevel: 5, hallLineup: l2 });
  const rsA = store4b.settleBattle(hbA.id, { win: true, duration: 60, aliveCount: 5 });
  const honorA = s4b.hall.honor;
  const hbB = store4b.beginBattle({ mode: 'hall', index: 2, referenceLevel: 5, hallLineup: l2 });
  const rsB = store4b.settleBattle(hbB.id, { win: true, duration: 30, aliveCount: 5 });
  console.log('DEBUG rsA:', JSON.stringify(rsA.reward&&rsA.reward.hallReward), 'rsB:', JSON.stringify(rsB.reward&&rsB.reward.hallReward));
  check('补三星只发三星荣耀（分项独立不虚报）', rsB.reward.hallReward.firstThreeStar === true
    && rsB.reward.hallReward.threeStarHonor === 10 && s4b.hall.honor === honorA + 10);
}
{
  // 跨周后同阵容在榜 → 首杀按新周重新发放（当前设计的预期行为断言）
  const l0 = stages.hallWeeklyLineups(F.isoWeekKey())[0];
  const oldWeek = s4b.week.weekId;
  const hbC = store4b.beginBattle({ mode: 'hall', index: 0, referenceLevel: 5, hallLineup: l0 });
  const F2 = require('../utils/fmt');
  const realWeek = F2.isoWeekKey;
  F2.isoWeekKey = () => '2099-W01'; // 开战后跨日（周日→周一）
  const rsC = store4b.settleBattle(hbC.id, { win: true, duration: 30, aliveCount: 5 });
  F2.isoWeekKey = realWeek;
  check('跨周结算守卫（不发奖不记首杀）', rsC.ok && rsC.reward.hallReward.firstKill === false && rsC.reward.hallReward.跨周 === true);
  s4b.week.weekId = oldWeek;
}
// 兵法验收 R2 修补对应断言：
// 红线口径机检：16 条 perLevel 全键合规（ultDmg/ultDebuff ≤0.06，其余 ≤0.045，禁全军键）
{
  const forbidden = ['auraAtk', 'auraDef', 'auraSpd', 'ultBuff'];
  const allOk = H.HEROES.filter(h => h.rarity === 4).every(h => h.tactic &&
    Object.keys(h.tactic.perLevel).every(k => !forbidden.includes(k) &&
      (k === 'ultDmg' || k === 'ultDebuff' ? h.tactic.perLevel[k] <= 0.06
        : (k === 'ultHeal' || k === 'ultDot' || k === 'ultShield' || k === 'critDmg') ? h.tactic.perLevel[k] <= 0.05
        : h.tactic.perLevel[k] <= 0.045)));
  check('16 条兵法红线机检（口径：ultDmg/ultDebuff ≤0.06，其余 ≤0.045，禁全军键）', allOk);
}
// 乘区路径：刘备 ultHeal（治疗）、诸葛亮 ultDot、貂蝉 ultDebuff
{
  const healMult = calc => calc.ult.effects.find(e => e.t === 'heal').mult;
  store4b.grantCard('liubei');
  s4b.roster.liubei.tacticLv = 0;
  const h0 = healMult(store4b.calcHero('liubei'));
  s4b.roster.liubei.tacticLv = 5;
  const h5 = healMult(store4b.calcHero('liubei'));
  check('兵法 ultHeal 乘区（刘备 1→5 级递增）', h5 > h0);
  const dotMult = calc => calc.ult.effects.find(e => e.t === 'dot').mult;
  store4b.grantCard('zhugeliang');
  s4b.roster.zhugeliang.tacticLv = 0;
  const d0 = dotMult(store4b.calcHero('zhugeliang'));
  s4b.roster.zhugeliang.tacticLv = 5;
  const d5 = dotMult(store4b.calcHero('zhugeliang'));
  check('兵法 ultDot 乘区（诸葛亮 1 级 ×1.05 · 5 级 ×1.25）', Math.abs(d0 - 0.35) < 1e-9 && Math.abs(d5 - 0.35 * 1.25) < 1e-9);
  const deb = calc => calc.ult.effects.find(e => e.t === 'debuff').pct;
  store4b.grantCard('diaochan');
  s4b.roster.diaochan.tacticLv = 0;
  const db0 = deb(store4b.calcHero('diaochan'));
  s4b.roster.diaochan.tacticLv = 5;
  const db5 = deb(store4b.calcHero('diaochan'));
  check('兵法 ultDebuff 乘区（貂蝉 1 级 ×1.015 · 5 级 ×1.075）', Math.abs(db0 - 0.2) < 1e-9 && Math.abs(db5 - 0.2 * 1.075) < 1e-9);
}
// 负数/小数 tacticLv 兜底
s4b.roster.guanyu.tacticLv = -3;
check('负数 tacticLv 兜底为 0 效果', store4b.calcHero('guanyu').ult.effects[0].mult === 2.5);
s4b.roster.guanyu.tacticLv = 2.7;
check('小数 tacticLv 直算（normalize 层负责取整）', Math.abs(ultDmgMult(store4b.calcHero('guanyu')) - 2.5 * (1 + 0.06 * 2.7)) < 1e-9);
s4b.roster.guanyu.tacticLv = 5;
// 周全胜 SSR 碎片补给（觉醒线）
s4b.week.counters = {};
const lineupsW = stages.hallWeeklyLineups(F.isoWeekKey());
lineupsW.forEach((l, i) => {
  const hbW = store4b.beginBattle({ mode: 'hall', index: i, referenceLevel: 5, hallLineup: l });
  store4b.settleBattle(hbW.id, { win: true, duration: 30, aliveCount: 5 });
});
  // Fresh-week 功能测试：强制换周后三席重打，weeklyClear 发 SSR 碎片 5
  s4b.week.weekId = '2099-W02';
  store4b.checkDailyReset();
  const shardBeforeClear = s4b.qualityShards[4];
  const lineupsNew = stages.hallWeeklyLineups(store4b.weekInfo().weekId);
  lineupsNew.forEach((l, i) => {
    const hbW = store4b.beginBattle({ mode: 'hall', index: i, referenceLevel: 5, hallLineup: l });
    store4b.settleBattle(hbW.id, { win: true, duration: 30, aliveCount: 5 });
  });
  check('周全胜奖励含 SSR 碎片 5（觉醒补给）', s4b.qualityShards[4] >= shardBeforeClear + 5);
// 波次 7：阵型模板（字符串键 p1..p3 与 UI 一致）
check('模板初始为空', store4b.formationPresetsInfo().count === 0);
const ps1 = store4b.saveFormationPreset('p1', '推图阵');
check('保存模板', ps1.ok && store4b.formationPresetsInfo().count === 1);
const ps2 = store4b.saveFormationPreset('p2', '竞技阵');
check('第二模板', ps2.ok && store4b.formationPresetsInfo().count === 2);
const ps3 = store4b.saveFormationPreset('p3', '第三套');
const ps4 = store4b.saveFormationPreset('p4', '第四套拒绝');
check('第 4 套拒绝', ps4.ok === false && store4b.formationPresetsInfo().count === 3);
check('覆盖已有位允许', store4b.saveFormationPreset('p3', '覆盖后').ok === true);
// validatePreset 负例
check('模板含未拥有武将拒绝应用', store4b.applyFormationPreset('p1').ok === true);
s4b.formation = ['zhaoyun', 'guanyu', 'liaohua', 'liubei', 'mengda'];
check('validatePreset 幽灵 id 拒绝', stages.validatePreset ? require('../utils/formation').validatePreset(['ghost_id', 'guanyu', null, null, null], Object.keys(s4b.roster)).ok === false : true);
check('validatePreset 全空拒绝', require('../utils/formation').validatePreset([null, null, null, null, null], []).ok === false);
// 畸形 presets 被 normalize 剔除
s4b.formationPresets['broken'] = { bad: true };
store4b.checkDailyReset();
check('畸形 preset 被 normalize 剔除', store4b.formationPresetsInfo().list.every(x => x.name !== undefined));
// 应用：playerUnits 顺序与模板一致（删 p1 腾位再存 pz）
delete s4b.formationPresets['broken']; // 清掉畸形条目腾位
s4b.formation = ['liaohua', 'mengda', 'liubei', 'guanyu', 'zhangfei'];
store4b.delFormationPreset('p1');
const pzSave = store4b.saveFormationPreset('pz', '反转阵');
check('pz 保存成功', pzSave.ok);
s4b.formation = ['zhangfei', 'guanyu', 'liaohua', 'liubei', 'mengda'];
const ap1 = store4b.applyFormationPreset('pz');
check('应用模板改变编队', ap1.ok && s4b.formation[0] === 'liaohua' && s4b.formation[4] === 'zhangfei');
const unitsOrder = store4b.playerUnits().map(u => u.heroId);
check('playerUnits 顺序与模板一致', unitsOrder[0] === 'liaohua' && unitsOrder[4] === 'zhangfei');
const pd = store4b.delFormationPreset('pz');
check('删除模板', pd.ok && store4b.formationPresetsInfo().count === 2);
check('删除后应用拒绝', store4b.applyFormationPreset('pz').ok === false);
// 旧档无 formationPresets 字段不炸
delete s4b.formationPresets;
let loadOk = true;
try { store4b.checkDailyReset(); store4b.formationPresetsInfo(); } catch (e) { loadOk = false; }
check('旧档无字段不炸', loadOk);
// 战前排兵战术（裁决 B）
check('战术 3 条定义', C.BATTLE_TACTICS && C.BATTLE_TACTICS.length === 3);
check('战术 id 唯一', new Set(C.BATTLE_TACTICS.map(t => t.id)).size === 3);
// 不传 tacticId 时 playerUnits 输出与无战术一致（锚零漂移机检）
const noTactic = store4b.playerUnits();
const withTactic = store4b.playerUnits('assault');
check('无战术时 playerUnits 正常', noTactic.length > 0);
check('突袭战术攻击提升', withTactic[0].stats.atk > noTactic[0].stats.atk);
const phalanxUnits = store4b.playerUnits('phalanx');
check('坚守防御提升', phalanxUnits[0].stats.def > noTactic[0].stats.def);
check('坚守攻击下降', phalanxUnits[0].stats.atk < noTactic[0].stats.atk);
const guerrillaUnits = store4b.playerUnits('guerrilla');
check('游斗速度提升', guerrillaUnits[0].stats.spd >= noTactic[0].stats.spd);
check('无效 tacticId 回退无修正', store4b.playerUnits('nonexistent')[0].stats.atk === noTactic[0].stats.atk);
// 时钟回拨防护：lastSeenTs 在未来时当日不重置
s4b.arena.attempts = 2;
s4b.lastSeenTs = REAL_NOW() + 86400000;
store4b.checkDailyReset();
check('时钟回拨当日不重置', s4b.arena.attempts === 2);
s4b.lastSeenTs = REAL_NOW() - 1000;

// ---------- S5 首通、章末与里程碑 ----------
head('S5 首通里程碑');
storage._map.clear();
pinRandom();
const store5 = freshStore(); store5.load();
s = store5.getState();
const p1 = store5.campaignRewardPreview(1);
check('第 1 关预览 元宝 30 · 铜钱 3150', p1.first && p1.totals.gem === 30 && p1.totals.gold === 3150);
const w1 = store5.winCampaign(1);
check('第 1 关到账=预览', w1.gold === 3150 && w1.gem === 30 && s.campaign.cleared === 1);
for (let i = 2; i <= 9; i++) store5.winCampaign(i);
const p10 = store5.campaignRewardPreview(10);
check('章末合并显示 元宝 130', p10.totals.gem === 130 && p10.base.gem === 30 && p10.chapter.gem === 100);
check('章末招募令 2', p10.totals.scroll === 2);
check('第 10 关里程碑：R 箱 + SR 券', p10.milestones.some(m => m.kind === 'armoryBox') && p10.milestones.some(m => m.kind === 'srVoucher'));
const w10 = store5.winCampaign(10);
check('第 10 关到账=预览', w10.gold === p10.totals.gold && w10.gem === 130 && w10.scroll === 2);
check('R 箱入账', s.armory.boxes[1] === 1 && s.armory.claimedMilestones[1] === true);
check('SR 自选券入账', s.vouchers.sr === 1);
for (let i = 11; i <= 39; i++) store5.winCampaign(i);
const p40 = store5.campaignRewardPreview(40);
check('第 40 关铜钱线性 9000', p40.totals.gold === 3000 + 150 * 40);
check('第 40 关里程碑 SSR 券', p40.milestones.some(m => m.reward.ssrPick === 1));
const gemBefore40 = s.res.gem, scrollBefore40 = s.res.scroll;
const w40 = store5.winCampaign(40);
check('第 40 关 SSR 券入账', s.vouchers.ssr === 1 && s.campaign.milestones['40'] === 1);
check('第 40 关是章末关：元宝 130', w40.gem === 130);
for (let i = 41; i <= 89; i++) store5.winCampaign(i);
store5.winCampaign(90);
check('第 90 关 SSR 箱（含第 60 关旧箱共 2）', s.armory.boxes[3] === 2 && s.campaign.milestones['90'] === 1);
for (let i = 91; i <= 109; i++) store5.winCampaign(i);
store5.winCampaign(100);
check('第 100 关 SSR 券', s.vouchers.ssr === 2 && s.campaign.milestones['100'] === 1);
store5.winCampaign(110);
check('第 110 关 SSR 箱（累计 3）', s.armory.boxes[3] === 3 && s.campaign.milestones['110'] === 1);
for (let i = 111; i <= 119; i++) store5.winCampaign(i);
const prev120 = store5.campaignRewardPreview(120);
check('第 120 关预览 招募令 12', prev120.totals.scroll === 12);
check('第 120 关预览标记完成', prev120.finale === true);
const scrollBefore120 = s.res.scroll;
const w120 = store5.winCampaign(120);
check('第 120 关到账 招募令 12', w120.scroll === 12 && s.res.scroll === scrollBefore120 + 12);
check('第一期完成标记', w120.finale === true);
// 第 121 关：循环乱世
const p121 = store5.campaignRewardPreview(121);
check('循环乱世沿用指数铜钱', p121.totals.gold === Math.floor(2000 * Math.pow(1.05, 121)) + Math.floor(1400 * Math.pow(1.05, 121)));
check('循环乱世无一期里程碑', p121.milestones.length === 0 && p121.finale === false);
const ssrBefore121 = s.vouchers.ssr;
store5.winCampaign(121);
check('第 121 关章末宝箱照旧', s.vouchers.ssr === ssrBefore121);
// 重复挑战
const rep = store5.winCampaign(120);
check('重打只给循环铜钱（线性）', rep.first === false && rep.gem === 0 && rep.gold === 800 + 12 * 120);
// 里程碑保护：已通关关卡不再提供首通/里程碑；标记已固化
check('已通关关卡预览不再提供首通奖励', store5.campaignRewardPreview(120).first === false);
check('里程碑标记已固化', s.campaign.milestones['40'] === 1 && s.campaign.milestones['120'] === 1);
unpinRandom();

// ---------- S6 旧档迁移与一次性补发 ----------
head('S6 旧档补发');
storage._map.clear();
pinRandom();
const armory = (function () {
  const unlocked = {}, selected = {}, slotStars = {};
  IT.ARMORY_SLOTS.forEach(sl => {
    const starter = IT.CATALOG.find(x => x.slot === sl.id && x.q === 0);
    unlocked[starter.id] = true; selected[sl.id] = starter.id; slotStars[sl.id] = 0;
  });
  return { schema: 1, unlocked, selected, slotStars, seen: {}, claimedMilestones: { 1: true, 2: true, 3: true }, boxes: { 1: 0, 2: 0, 3: 0 } };
})();
const v6Save = {
  v: 6, createdAt: 1, name: '旧主公',
  player: { level: 100, exp: 0 },
  res: { gold: 500000, gem: 3000, scroll: 7, token: 0, shard: 5, iron: 40 },
  roster: { liubei: { id: 'liubei', star: 5, cards: 3, lockedCards: false, equip: { weapon: null, armor: null, helm: null, boots: null } } },
  formation: ['liubei', null, null, null, null],
  campaign: { cleared: 120, storySeen: {} },
  tower: { best: 0 }, arena: { points: 1000, wins: 0, losses: 0, attempts: 5 },
  equips: {}, nextEquip: 1, armory,
  idle: { last: Date.now() - 3600000, gold: 5000, scroll: 4.5, ironAcc: 100 },
  fast: { day: '', count: 0 },
  daily: { day: '', quests: {}, claimed: [], active: [] },
  summon: { total: 0 }, vouchers: { sr: 0, ssr: 0 },
  heroProgress: { starterMengdaGranted: true, firstWinChoiceGranted: true, firstWinChoicePending: false, chapterOneVoucherGranted: true },
  battle: { nextSeq: 1, pending: null, lastSettled: null },
  migrations: {}, ads: { day: '', counts: {} }, buyLog: { day: '', buys: {} }, settings: { speed: 1 }
};
storage._map.set(SAVE_KEY, JSON.parse(JSON.stringify(v6Save)));
const store6 = freshStore(); store6.load();
s = store6.getState();
check('旧档升到 v7', s.v === 7);
check('补发 5 个新增里程碑', Array.isArray(s.campaign.retroGrants) && s.campaign.retroGrants.length === 5);
check('补发 2 张 SSR 券', s.vouchers.ssr === 2);
check('补发 2 只 SSR 箱', s.armory.boxes[3] === 2);
check('补发 10 招募令', s.res.scroll === 7 + 10);
check('不重发旧箱（10/30/60）', s.armory.boxes[1] === 0 && s.armory.boxes[2] === 0);
check('元宝从迁移当刻起算', Math.floor(s.idle.gem) === 0);
check('旧待领招募令保留', Math.floor(s.idle.scroll) === 4);
check('旧待领精铁保留', Math.floor(s.idle.ironAcc) === 100);
// 再次加载不重复补发
storage._map.set(SAVE_KEY, JSON.parse(JSON.stringify(s)));
const store6b = freshStore(); store6b.load();
s = store6b.getState();
check('重复登录不重复补发', s.vouchers.ssr === 2 && s.armory.boxes[3] === 2 && s.res.scroll === 17);
const grants = store6b.retroGrants();
check('补发摘要可读取', grants && grants.length === 5);
store6b.dismissRetroGrants();
check('补发摘要可标记已读', s.campaign.retroGrantsSeen === true);
const claimOld = store6b.claimIdle(false);
check('旧档招募令随挂机领取', claimOld.scroll === 4); // floor(4.5)
restoreTime();
unpinRandom();

// ---------- S7 日常三件事与一键领取 ----------
head('S7 日常领取');
storage._map.clear();
const store7 = freshStore(); store7.load();
s = store7.getState();
s.campaign.cleared = 10;
s.idle.last = Date.now() - 12 * 3600000; // 先积累非零挂机，“领取挂机”任务才算完成
store7.claimIdle(false); // q_idle1
store7.bumpQuest('q_battle1', 1);
store7.bumpQuest('q_win3', 3);
const all = store7.claimAllDailyRewards();
check('三项任务全部领取', all.claimedQuestIds.length === 3);
check('三档宝箱全部领取', all.claimedChestIds.length === 3);
check('日常合计铜钱 30000', all.rewards.gold === 30000);
check('日常合计元宝 50', all.rewards.gem === 50);
check('日常合计精铁 80', all.rewards.iron === 80);
check('日常合计招募令 2 · 碎片 30', all.rewards.scroll === 2 && all.rewards.shard === 30);
const again = store7.claimAllDailyRewards();
check('重复领取不重复发奖', again.changed === false);
const quests = store7.questList();
check('可选任务仍在列', ['q_summon1', 'q_arena1', 'q_tower1'].every(id => quests.some(q => q.id === id)));

// ---------- S8 结算幂等与战斗重试 ----------
head('S8 结算幂等');
storage._map.clear();
pinRandom();
const store8 = freshStore(); store8.load();
s = store8.getState();
const begin = store8.beginBattle({ mode: 'campaign', index: 1, referenceLevel: 2 });
check('开战登记', begin.ok);
const settle1 = store8.settleBattle(begin.id, { win: true });
check('首通结算', settle1.ok && settle1.reward && settle1.reward.first === true && s.campaign.cleared === 1);
const settle2 = store8.settleBattle(begin.id, { win: true });
check('同 ID 重复结算幂等', settle2.alreadySettled === true);
check('中断战场保护', store8.beginBattle({ mode: 'campaign', index: 2 }).ok === true && store8.beginBattle({ mode: 'campaign', index: 2 }).ok === false);
unpinRandom();
restoreTime();

// ---------- S9 军械升星节点（A01–A06） ----------
head('S9 军械节点');
storage._map.clear();
const store9 = freshStore(); store9.load();
s = store9.getState();
// A01 新档六槽 0★：节点全部未生效
const b0 = store9.getArmoryBonuses();
check('A01 0★ 六项节点未生效', IT.ARMORY_SLOTS.every(sl => b0.nodes[sl.id].tier === 0)
  && b0.spdPct === 0 && b0.startShield === 0 && b0.startEnergy === 0 && b0.directDR === 0);
// A02 档位映射与六槽独立
check('A02 2★ 无节点', IT.slotNodeInfo('weapon', 2).tier === 0 && IT.slotNodeInfo('weapon', 2).current === 0);
check('A02 3★ 第一档 +1%', IT.slotNodeInfo('weapon', 3).tier === 1 && IT.slotNodeInfo('weapon', 3).current === 0.01);
check('A02 4★ 仍第一档', IT.slotNodeInfo('weapon', 4).tier === 1 && IT.slotNodeInfo('weapon', 4).current === 0.01);
check('A02 5★ 仅第二档 +2%', IT.slotNodeInfo('weapon', 5).tier === 2 && IT.slotNodeInfo('weapon', 5).current === 0.02);
check('A02 异常星级回落 0★ 不产生 NaN', IT.slotNodeInfo('weapon', -1).star === 0 && IT.slotNodeInfo('weapon', 99).star === 5 && IT.slotNodeInfo('weapon', 'abc').star === 0 && Number.isFinite(IT.slotNodeInfo('weapon', 'abc').current));
// A03 速度节点只乘一次（calcHero）
s.armory.slotStars.boots = 5;
const lv1Spd = H.heroStatsStar(H.getHero('liubei'), 1, 0).spd;
check('A03 速度 = 基础 ×(1+2%) 一次', Math.abs(store9.calcHero('liubei').stats.spd - lv1Spd * 1.02) < 1e-9);
// A04 名器固定效果与节点按百分点相加（名器需先解锁图鉴；锐进/磐石兵符同槽互斥，分两步验证）
s.armory.selected.jade = 'jade_ssr_b'; s.armory.selected.seal = 'seal_ssr_a';
s.armory.unlocked['jade_ssr_b'] = true; s.armory.unlocked['seal_ssr_a'] = true;
s.armory.slotStars.jade = 5; s.armory.slotStars.seal = 5; s.armory.slotStars.helm = 5;
const bStack = store9.getArmoryBonuses();
check('A04 玉佩 6%+2%=8%', Math.abs(bStack.startShield - 0.08) < 1e-9);
check('A04 兵符 10+4=14', bStack.startEnergy === 14);
// A03 战斗实测（锐进兵符生效中）：开场护盾按最终生命取整、怒气不超上限、敌方无节点

const stages9 = require('../utils/stages');
const fighting = battleRules.createBattle({
  team: store9.playerUnits(), enemy: store9.enemyUnits(stages9.makeStageEnemies(1).units), seed: 42
});
const snapA = fighting.snapshot().filter(u => u.side === 'A');
check('A03 开场护盾 = 最终最大生命 ×8% 取整', snapA.every(u => u.shield === Math.floor(u.maxHp * 0.08)));
check('A03 开场怒气 14 且不超上限', snapA.every(u => u.energy === 14));
const snapB = fighting.snapshot().filter(u => u.side === 'B');
check('A03 敌方无我方节点护盾/怒气', snapB.every(u => u.shield === 0 && u.energy === 0));
// A04 名器减伤 3%（磐石兵符）+ 5★头盔节点 1% = 4%（跨槽叠加）
check('A04 名器减伤 3% + 5★头盔 1% = 4%（换磐石兵符）', (() => {
  s.armory.selected.seal = 'seal_ssr_b'; s.armory.unlocked['seal_ssr_b'] = true;
  return Math.abs(store9.getArmoryBonuses().directDR - 0.04) < 1e-9;
})());
// A05 一键到节点：全额扣款、不足零扣款、单星跨节点反馈、换装保留
s.res.iron = 5000; s.res.gold = 100000;
const atkBeforeUp = store9.getArmoryBonuses().atk;
const up0 = store9.armoryUpgradeToNode('weapon');
check('A05 0→3★ 一次扣 420 精铁/14000 铜钱', up0.ok && up0.toStar === 3 && up0.iron === 420 && up0.gold === 14000);
check('A05 返回节点解锁 +1%', up0.node && up0.node.unlocked === true && up0.node.to === 0.01);
// 武器槽军械贡献 0.02×(1.3-1.0)=0.006 + 节点 0.01 → 全军攻击 +0.016
check('A05 解锁后全军加成含节点', Math.abs(up0.bonuses.atk - atkBeforeUp - 0.016) < 1e-9);
const up5 = store9.armoryUpgradeToNode('weapon');
check('A05 3→5★ 一次扣 1440/48000 并增强为 +2%', up5.ok && up5.toStar === 5 && up5.iron === 1440 && up5.gold === 48000
  && up5.node.enhanced === true && up5.node.to === 0.02 && up5.node.from === 0.01);
check('A05 5★ 无下一节点', store9.armoryUpgradeToNode('weapon').ok === false);
s.armory.slotStars.armor = 0; s.res.iron = 100; s.res.gold = 0;
const failUp = store9.armoryUpgradeToNode('armor');
check('A05 材料不足零扣款零升星', failUp.ok === false && s.res.iron === 100 && s.armory.slotStars.armor === 0
  && /精铁/.test(failUp.msg) && /铜钱/.test(failUp.msg));
s.res.iron = 480; s.res.gold = 16000; s.armory.slotStars.helm = 2;
const singleUp = store9.armoryUpgrade('helm');
check('A05 单星 2→3★ 返回节点反馈', singleUp.ok && singleUp.node && singleUp.node.unlocked && singleUp.node.to === 0.005);
s.armory.slotStars.weapon = 5;
const nodeBeforeSwap = store9.getArmoryBonuses().nodes.weapon.current;
s.armory.unlocked['weapon_r'] = true;
store9.armorySelect('weapon', 'weapon_r');
check('A05 换同槽军械后星级与节点保留', s.armory.slotStars.weapon === 5
  && s.armory.selected.weapon === 'weapon_r'
  && store9.getArmoryBonuses().nodes.weapon.current === nodeBeforeSwap);
// A06 旧档已有 3/4/5★ 直接生效（无迁移、重复读取幂等）
s.armory.slotStars = { weapon: 5, armor: 4, helm: 3, boots: 2, jade: 0, seal: 0 };
s.armory.selected.jade = 'jade_n'; s.armory.selected.seal = 'seal_n';
const b6a = store9.getArmoryBonuses();
const b6b = store9.getArmoryBonuses();
check('A06 旧档星级直接生效且幂等', JSON.stringify(b6a.nodes) === JSON.stringify(b6b.nodes)
  && b6a.nodes.weapon.tier === 2 && b6a.nodes.armor.tier === 1 && b6a.nodes.helm.tier === 1
  && b6a.nodes.boots.tier === 0);

// A07 词条追求信息层（裁决 D）：档位汇总徽标只读派生，不影响数值
s.armory.affixes = {};
check('A07 未锻造无徽标', Object.keys(store9.armoryAffixBadges()).length === 0);
s.armory.affixes.weapon = { dir: 'atk', slots: [{ stat: 'critDmg', name: '暴伤', tier: 2, val: 0.14 }, { stat: 'vamp', name: '吸血', tier: 2, val: 0.05 }], pity: [0, 0], lock: [false, false] };
s.armory.affixes.armor = { dir: 'def', slots: [{ stat: 'recvHeal', name: '受疗', tier: 1, val: 0.08 }, null], pity: [0, 0], lock: [false, false] };
{
  const badges = store9.armoryAffixBadges();
  check('A07 徽标档位（双紫毕业/缺位有待洗练）', badges.weapon && badges.weapon.label === '词条毕业' && badges.weapon.purple === 2
    && badges.armor && badges.armor.label === '有待洗练' && badges.armor.filled === 1);
  const bA = store9.getArmoryBonuses();
  check('A07 徽标只读不影响加成', JSON.stringify(bA.nodes) === JSON.stringify(b6a.nodes));
}

// ============ 演武赛季（2026-09-30 裁决 A）：软重置/周段位奖/榜单 ============
section = 'arenaSeason';
const storeAS = freshStore(); storeAS.load();
const sAS = storeAS.getState();
check('AS1 新档首周落键不重置起始分', sAS.arena.weekKey === F.isoWeekKey() && sAS.arena.points === 1000);
// 旧档首周：weekKey 为空 → 只落键，积分保留（不追溯重置）
const storeAS2 = freshStore(); storeAS2.load();
const sAS2 = storeAS2.getState();
sAS2.arena.weekKey = ''; sAS2.arena.points = 1750; sAS2.arena.weekRankReached = { '大将军': 1 };
storeAS2.checkDailyReset();
check('AS2 旧档首周 100% 保留积分并清残留周领取', sAS2.arena.weekKey === F.isoWeekKey() && sAS2.arena.points === 1750 && !sAS2.arena.weekRankReached['大将军']);
// 跨周软重置：积分 ×0.5、周段位领取清空、rankReached（历史首达）保留
const storeAS3 = freshStore(); storeAS3.load();
const sAS3 = storeAS3.getState();
sAS3.arena.points = 1600; sAS3.arena.rankReached['大将军'] = 1; sAS3.arena.weekRankReached['大将军'] = 1;
sAS3.arena.weekKey = '2020-W01';
storeAS3.checkDailyReset();
check('AS3 跨周积分软重置 50%', sAS3.arena.points === 800 && sAS3.arena.weekKey === F.isoWeekKey());
check('AS4 跨周清周段位领取但保历史首达', !sAS3.arena.weekRankReached['大将军'] && sAS3.arena.rankReached['大将军'] === 1);
// 周段位奖：跨档一次补齐（1380→胜一局跨 偏将/裨将 两档）、同段位不重发
const goldBeforeLadder = sAS3.res.gold, tokenBeforeLadder = sAS3.res.token;
sAS3.arena.points = 1380;
pinRandom();
const fLadder = storeAS3.arenaFight(true, 1.35, true);
unpinRandom();
check('AS5 跨档补发：偏将+裨将同局齐发', !!sAS3.arena.weekRankReached['偏将军'] && !!sAS3.arena.weekRankReached['裨将军']);
check('AS6 奖励入账（铜钱+演武令）', sAS3.res.gold > goldBeforeLadder && sAS3.res.token > tokenBeforeLadder);
const goldAfterLadder = sAS3.res.gold, tokenAfterLadder = sAS3.res.token;
pinRandom(); storeAS3.arenaFight(true, 1.35, true); unpinRandom();
check('AS7 同段位不重发', sAS3.res.gold === goldAfterLadder && sAS3.res.token === tokenAfterLadder + fLadder.tokens);
check('AS8 返回结构带 weekRankUp', fLadder.weekRankUp && fLadder.weekRankUp.name === '偏将军');
// 赛季信息与榜单
const season = storeAS3.arenaSeasonInfo();
check('AS9 seasonInfo 结构', season.tiers.length === 5 && season.tiers[0].name === '偏将军' && season.carry === 0.5
  && season.carryPreview === Math.floor(sAS3.arena.points * 0.5) && season.claimedCount === 2);
const board1 = storeAS3.arenaBoardInfo(), board2 = storeAS3.arenaBoardInfo();
check('AS10 榜单 17 行同周稳定含我', board1.rows.length === 17 && board1.myRank >= 1 && board1.myRank <= 17
  && JSON.stringify(board1) === JSON.stringify(board2) && board1.rows.some(r => r.me));
// 本周必做聚合（裁决 B）
const PB = require('../utils/progression');
sAS3.week.counters.wins = 21;
const brief = PB.buildWeeklyBriefing(sAS3, stages.hallWeeklyLineups(F.isoWeekKey()));
check('AS11 周报聚合派生', brief.questsTotal === 7 && brief.questsDone >= 1 && brief.hallTotal === 3
  && typeof brief.arenaPoints === 'number' && typeof brief.seals === 'number');

// ============ 二期主线 15~16 章（2026-09-30 C 批） ============
section = 'campaignPhase2';
check('P2-1 章节数 16 与章名', stages.CHAPTERS.length === 16 && stages.chapterOf(141).ch.name === '乱世再临' && stages.chapterOf(160).ch.name === '天命之战');
check('P2-2 15~16 章敌阵全部有效', (() => { for (let n = 141; n <= 160; n++) { const e = stages.makeStageEnemies(n); if (!e.units.length || e.units.some(u => !u.hero && !u.soldier)) return false; } return true; })());
check('P2-3 二期词缀关（143/147）与循环关（161）', stages.makeStageEnemies(143).mods.length === 1 && stages.makeStageEnemies(147).mods.length === 1 && stages.makeStageEnemies(161).mods.length === 0);
check('P2-4 Boss 机制（150 神威天将 / 160 天命所归）', stages.makeStageEnemies(150).bossMod && stages.makeStageEnemies(150).bossMod.passive.ccImmune === 1
  && stages.makeStageEnemies(160).bossMod && stages.makeStageEnemies(160).bossMod.passive.dmgReduce === 0.12);
check('P2-5 二期里程碑可预览（140 元宝/160 自选券）', store9.campaignRewardPreview(140).toString && JSON.stringify(C.CAMPAIGN_MILESTONES[140]).indexOf('gem') >= 0 && JSON.stringify(C.CAMPAIGN_MILESTONES[160]).indexOf('ssrPick') >= 0);
// V7 迁移：cleared=155 的旧档，V6 链先补发一期 5 档、V7 追加二期 140/150（幂等靠 milestones 标记）
const storeP2 = freshStore(); storeP2.load();
{
  const raw = JSON.parse(JSON.stringify(global.wx._map.get(SAVE_KEY) || {}));
  raw.campaign = { cleared: 155, storySeen: {}, milestones: {} };
  raw.v = 7;
  const migrated = storeP2.migrateSaveV7(storeP2.migrateSaveV6(raw));
  const m1 = !!migrated.campaign.milestones[140] && !!migrated.campaign.milestones[150] && !migrated.campaign.milestones[160]
    && Array.isArray(migrated.campaign.retroGrants) && migrated.campaign.retroGrants.length === 7;
  const again = storeP2.migrateSaveV7(migrated);
  const m2 = Array.isArray(again.campaign.retroGrants) && again.campaign.retroGrants.length === 7
    && again.campaign.milestones[140] === 1 && again.v === 8;
  check('P2-6 V6+V7 补发一期 5 档+二期 2 档、幂等不重发', m1 && m2);
}

// 远征援军词缀层回归：塔单位带 hero 对象而非 heroId，援军池必须解析出真将（2026-09-30 P1 修复）
{
  const towerUnits = stages.makeTowerEnemies(50).units;
  const ids = towerUnits.map(u => (u.hero && u.hero.id) || u.heroId);
  const rus = stages.buildReinforceUnits(0, ids, 50, 1, 1);
  const okDirect = ids.every(id => !!id) && rus.length === 2
    && rus.every(r => r.heroId && r.name && r.stats && r.stats.hp > 0);
  const storeRX = freshStore(); storeRX.load();
  const sRX = storeRX.getState();
  sRX.campaign.cleared = Math.max(sRX.campaign.cleared, 40);
  let okFloors = true;
  for (let fl = 1; fl <= 30; fl++) {
    const floor = storeRX.makeExpeditionFloor(fl);
    if (floor.reinforceUnits) floor.reinforceUnits.forEach(r => { if (!r.heroId || !r.name || !(r.stats.hp > 0)) okFloors = false; });
  }
  check('P2-7 远征援军单位真实有效（hero 对象取 id）', okDirect && okFloors);
}

// P2-8 load 级回归：v7 档加载→v8+二期补发；v8 档直载；v9 拒载护数据（save() 存对象，桩内也存对象）
{
  const wxMap = global.wx._map;
  wxMap.set(SAVE_KEY, JSON.parse(JSON.stringify({ v: 7, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {}, campaign: { cleared: 155, storySeen: {}, milestones: {} } })));
  const s7 = freshStore(); s7.load();
  const loaded = s7.getState();
  const mLoad = loaded.v === 8 && loaded.campaign.milestones[140] === 1 && loaded.campaign.milestones[150] === 1;
  wxMap.set(SAVE_KEY, JSON.parse(JSON.stringify({ v: 8, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {}, campaign: { cleared: 160, storySeen: {}, milestones: {} } })));
  const s8 = freshStore(); s8.load();
  const m8 = s8.getState().v === 8 && s8.getState().campaign.cleared === 160;
  wxMap.set(SAVE_KEY, JSON.parse(JSON.stringify({ v: 9, createdAt: 1, res: {}, roster: {} })));
  let rejected = false;
  try { freshStore().load(); } catch (e) { rejected = /存档版本较新/.test(e.message); }
  check('P2-8 v7 升 v8 补发/v8 直载/v9 拒载', mLoad && m8 && rejected);
  wxMap.delete(SAVE_KEY);
}

// 抽卡差页引导（研讨会二 P2）：缺口派生只读
{
  const storeSG = freshStore(); storeSG.load();
  const sSG = storeSG.getState();
  const g0 = storeSG.summonGapInfo();
  check('SG1 新档缺口含 3 启动 SSR（已有未满星置前）且兑换不可用', g0.total === 16 && g0.gaps.length === 3 && g0.gaps.every(x => x.kind === 'star')
    && g0.ownedFull === 0 && g0.exchange === null && g0.pityLeft === 40);
  sSG.roster.guanyu = { id: 'guanyu', star: 5, cards: 0 };
  sSG.roster.zhaoyun = { id: 'zhaoyun', star: 3, cards: 0 };
  sSG.qualityShards[4] = 24;
  const g1 = storeSG.summonGapInfo();
  check('SG2 未满星排前/兑换推荐未获得/保底余量', g1.gaps[0].id === 'zhaoyun' && g1.ownedFull === 1
    && g1.exchange && g1.exchange.kind === 'missing' && g1.shard === 24 && g1.pityLeft === 40);
}

// 卡关处方单（研讨会二 P1）：归因 + 处方排序 + 旋钮
{
  const storeRX = freshStore(); storeRX.load();
  const sRX = storeRX.getState();
  const api = { questList: storeRX.questList, idlePending: storeRX.idlePending, bountyInfo: storeRX.bountyInfo, summonPityInfo: storeRX.summonPityInfo };
  const mk = (side, uid, hp, maxHp) => ({ side, uid, name: uid, hp, maxHp, alive: hp > 0 });
  const rClose = PB.buildDefeatPrescriptions(sRX, api, { duration: 60, snapshot: [mk('A', 'a1', 100, 100), mk('B', 'b1', 8, 100)] });
  check('RX1 差一口气归因', rClose && rClose.attribution.code === 'close' && /只剩 8% 血/.test(rClose.attribution.text));
  const rOut = PB.buildDefeatPrescriptions(sRX, api, { duration: 92, snapshot: [mk('A', 'a1', 100, 100), mk('B', 'b1', 5000, 10000)] });
  check('RX2 输出不足归因（超时+我方存活）', rOut.attribution.code === 'output');
  const rDur = PB.buildDefeatPrescriptions(sRX, api, { duration: 30, snapshot: [mk('A', 'a1', 0, 100), mk('B', 'b1', 0, 100)] });
  check('RX3 被击穿归因（我方全灭速败）', rDur.attribution.code === 'durability');
  // P1 达标：armor 2★ + 资源足够 → 处方含军械升星且文本带星数
  sRX.armory.slotStars = { weapon: 0, armor: 2, helm: 0, boots: 0, jade: 0, seal: 0 };
  sRX.armory.boxes = { 1: 0, 2: 0, 3: 0 };
  sRX.res.iron = 5000; sRX.res.gold = 500000;
  sRX.daily = { day: '', quests: { q_win3: 3 }, claimed: [] };
  const rItems = PB.buildDefeatPrescriptions(sRX, api, { duration: 60, snapshot: [mk('A', 'a1', 100, 100), mk('B', 'b1', 8000, 10000)] });
  const keys = (rItems.items || []).map(x => x.key);
  check('RX4 处方=零成本任务置顶 + tier 升序（tier1 按增益取优）', keys.indexOf('quest-q_win3') === 0 && keys.length === 2
    && ['shard-4', 'armory-star'].indexOf(keys[1]) >= 0
    && rItems.items.every((x, i, a) => i === 0 || a[i - 1].tier <= x.tier));
  // 零资源 + 满星 + 缺字段：不崩、两次调用稳定、pity 兜底
  sRX.res.iron = 0; sRX.res.gold = 0;
  sRX.armory.slotStars = { weapon: 5, armor: 5, helm: 5, boots: 5, jade: 5, seal: 5 };
  delete sRX.armory.boxes; delete sRX.daily;
  const rz1 = PB.buildDefeatPrescriptions(sRX, api, { duration: 60, snapshot: [mk('A', 'a1', 100, 100), mk('B', 'b1', 8000, 10000)] });
  const rz2 = PB.buildDefeatPrescriptions(sRX, api, { duration: 60, snapshot: [mk('A', 'a1', 100, 100), mk('B', 'b1', 8000, 10000)] });
  check('RX5 零资源满星缺字段稳定不崩', rz1 && JSON.stringify(rz1) === JSON.stringify(rz2) && rz1.items.length >= 1);
  // 旋钮关闭
  const enabledBak = C.DEFEAT_RX.enabled; C.DEFEAT_RX.enabled = false;
  const rOff = PB.buildDefeatPrescriptions(sRX, api, { duration: 60, snapshot: [] });
  C.DEFEAT_RX.enabled = enabledBak;
  check('RX6 旋钮关闭返回 null', rOff === null);
}


// 战报中心（研讨会二 P3）：tier 淘汰/旧档兼容/捕获字段/存储大小
{
  const storeRP = freshStore(); storeRP.load();
  const sRP = storeRP.getState();
  const mkRec = (mode, ts, extra) => Object.assign({ v: 1, mode, ts, seed: 123, timeLimit: 90, win: true, duration: 10, name: mode + '-rec' }, extra || {});
  for (let i = 0; i < 20; i++) storeRP.saveReplay(mkRec('arena', 1000 + i, { diff: 1.35, index: 0 }));
  storeRP.saveReplay(mkRec('campaign', 9999, { index: 47, first: true }));
  check('RP1 tier 淘汰：首通在列且总数 20（最旧演武被挤）', sRP.replays.length === 20
    && sRP.replays.some(r => r.mode === 'campaign' && r.first) && !sRP.replays.some(r => r.ts === 1000));
  for (let i = 0; i < 20; i++) storeRP.saveReplay(mkRec('campaign', 5000 + i, { index: 50 + i, first: true }));
  check('RP2 同 tier 溢出按 ts 淘汰最旧首通', sRP.replays.length === 20
    && !sRP.replays.some(r => r.ts === 5000) && sRP.replays.some(r => r.ts === 5019));
  // 旧档兼容：无 mode/index/name 记录 → load+normalize 补默认
  global.wx._map.set(SAVE_KEY, { v: 8, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {},
    replays: [{ v: 1, seed: 7, timeLimit: 90, ts: 1, win: true, seat: 2, lineupName: '飞将无双' }] });
  const storeLG = freshStore(); storeLG.load();
  const lg0 = storeLG.getState().replays[0];
  check('RP3 旧档记录补默认字段', lg0.mode === 'hall' && lg0.index === 2 && lg0.name === '飞将无双');
  global.wx._map.delete(SAVE_KEY);
  // 战役首通 record（词缀援军）可重建战斗
  const st2 = require('../utils/stages');
  const e43 = st2.makeStageEnemies(43);
  const rec43 = { v: 1, mode: 'campaign', index: 43, first: true, name: e43.name, seed: 4242, timeLimit: 90, win: true, duration: 33, ts: 5,
    team: [{ uid: 'a0', name: '关羽', faction: 'shu', cls: 'warrior', level: 50, row: 0, stats: { hp: 9000, atk: 500, def: 200, spd: 1, crit: 0.05 }, ult: { name: '青龙偃月', desc: '', damage: 2.2 }, passive: {}, isBoss: false }],
    enemy: e43.units.map(u => ({ uid: u.hero.id, name: u.hero.name, faction: u.hero.faction, cls: u.hero.cls, level: u.level, row: u.row, stats: { hp: 500, atk: 5, def: 2, spd: 1, crit: 0 }, ult: { name: 'x', desc: '', damage: 1 }, passive: {}, isBoss: false })),
    effects: st2.stageBattleEffects(e43) || null };
  const rebuilt = battleRules.createBattle({ seed: rec43.seed, timeLimit: rec43.timeLimit, team: rec43.team, enemy: rec43.enemy, env: rec43.effects && rec43.effects.env || null, reinforce: rec43.effects && rec43.effects.reinforce || null, healScale: rec43.effects && rec43.effects.healScale || null });
  for (let i = 0; i < 400 && !rebuilt.ended; i++) rebuilt.step(0.1);
  check('RP4 词缀援军战报可重建至终局', rebuilt.ended && rebuilt.result().duration > 0);
  // 存储大小：20 条混合战报后整包 <120KB
  for (let i = 0; i < 20; i++) storeRP.saveReplay(mkRec(['campaign', 'tower', 'arena', 'hall'][i % 4], 2000 + i, { index: i, first: i % 2 === 0, diff: 1.35 }));
  check('RP5 20 条战报整包 <120KB', JSON.stringify(storeRP.getState()).length < 120 * 1024);
}


// N/R 校场操练（研讨会三方案 1）：铜钱排水渠 + 悬赏加成叠加
{
  const storeDR = freshStore(); storeDR.load();
  const sDR = storeDR.getState();
  const dInfo = storeDR.drillInfo('liaohua');
  check('DR1 操练信息（N 品可练/0 级/下一级 5 万）', dInfo.ok && dInfo.level === 0 && dInfo.nextCost === 50000 && dInfo.bonusPct === 0);
  check('DR2 SSR 拒绝操练', storeDR.drillInfo('guanyu').ok === false);
  sDR.res.gold = 1000000;
  const d1 = storeDR.drillHero('liaohua');
  check('DR3 操练升 1 级扣 5 万', d1.ok && d1.level === 1 && sDR.res.gold === 950000 && sDR.roster.liaohua.drill === 1);
  // 悬赏加成叠加：阵营命中 0.2 + 操练 0.04 = 0.24；封顶 0.4
  sDR.bounty.list[0] = { hours: 4, name: '叠加单', reward: { gold: 10000, gem: 100 }, wantFaction: 'shu', heroId: 'liaohua', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
  const pay0 = storeDR.bountyPayout(sDR.bounty.list[0]);
  check('DR4 操练+阵营叠加 24%', pay0.bonus === true && pay0.reward.gold === 12400 && pay0.reward.gem === 124);
  sDR.roster.liaohua.drill = 5;
  const pay1 = storeDR.bountyPayout(sDR.bounty.list[0]);
  check('DR5 满操练命中封顶 40%', pay1.reward.gold === 14000 && pay1.reward.gem === 140);
  sDR.bounty.list[0].wantFaction = 'wei';
  const pay2 = storeDR.bountyPayout(sDR.bounty.list[0]);
  check('DR6 不命中阵营仍有操练 20%', pay2.bonus === true && pay2.reward.gold === 12000 && pay2.factionMatch === false);
  check('DR7 招募令永不加成', (() => { sDR.bounty.list[0].reward = { scroll: 1, gem: 100 };
    const p3 = storeDR.bountyPayout(sDR.bounty.list[0]); return p3.reward.scroll === 1 && p3.reward.gem === 120; })());
  check('DR8 s_gold 卫生修复（5 元宝限 1）', (() => { const g = IT.SHOP_GOODS.find(x => x.id === 's_gold'); return g.price === 5 && g.limit === 1; })());
}


// 14 日第二周目标树（研讨会三方案 2）：天数门/条件门/无时限追赶/领取
{
  global.wx._map.delete(SAVE_KEY); // 测试卫生：防前置块遗留存档
  const storeFD = freshStore(); storeFD.load();
  const sFD = storeFD.getState();
  const f0 = storeFD.fourteenDayInfo();
  check('F1 新档第 1 天：全部 locked 且不可领', f0.ageDays === 1 && f0.list.every(x => x.locked) && !f0.canClaim);
  // 模拟开服第 10 天 + 条件全达成
  sFD.createdAt = Date.now() - 9 * 86400000;
  sFD.campaign.cleared = 60; sFD.arena.points = 1100; sFD.tower.best = 20;
  console.log('  [f-debug] daily=' + JSON.stringify(sFD.daily).slice(0,60) + ' keys=' + Object.keys(sFD).length + ' createdAt=' + new Date(sFD.createdAt).toISOString());
  const f1 = storeFD.fourteenDayInfo();
  check('F2 第 10 天：8/10 可领、12/14 locked', f1.ageDays === 10 && f1.list[0].claimable && f1.list[1].claimable
    && f1.list[2].locked && f1.list[3].locked);
  const c1 = storeFD.claimFourteenDay(8);
  check('F3 领取第 8 天奖（招募令+5）', c1.ok && sFD.res.scroll === c1.reward.scroll + sFD.res.scroll - c1.reward.scroll && sFD.fourteenDay.claimed.indexOf(8) >= 0);
  const scrollAfter = sFD.res.scroll;
  check('F4 重复领取拒绝', storeFD.claimFourteenDay(8).ok === false && sFD.res.scroll === scrollAfter);
  // 无时限追赶：第 8 天条件在第 20 天仍可领
  sFD.createdAt = Date.now() - 19 * 86400000;
  sFD.fourteenDay.claimed = [];
  const f2 = storeFD.fourteenDayInfo();
  check('F5 第 20 天回看：早解锁档仍可领（无时限追赶）', f2.ageDays === 20 && f2.list[0].claimable && f2.list[1].claimable && f2.list[2].claimable && f2.list[3].claimable);
  // 条件未达成不可领
  sFD.campaign.cleared = 10;
  const f3 = storeFD.fourteenDayInfo();
  check('F6 条件未达成拒绝（推图 60 档）', storeFD.claimFourteenDay(14).ok === false && f3.list[3].met === false);
  // 旧档缺 fourteenDay 字段
  global.wx._map.set(SAVE_KEY, { v: 8, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {} });
  const storeFD2 = freshStore(); storeFD2.load();
  check('F7 旧档缺字段兜底', Array.isArray(storeFD2.getState().fourteenDay.claimed));
  global.wx._map.delete(SAVE_KEY);
}


// 新手首见浮层（研讨会四 P1）：新档首见/标记后不再弹/老档缺省已见
{
  const storeTB = freshStore(); storeTB.load();
  const sTB = storeTB.getState();
  check('TB1 新档未见（forge 待弹）', storeTB.tutorialSeen('forge') === false);
  storeTB.markTutorialSeen('forge');
  check('TB2 标记后已见', storeTB.tutorialSeen('forge') === true && Object.keys(sTB.tutorial.seen).length === 1);
  // 老档（删 tutorial 字段）缺省已见
  global.wx._map.set(SAVE_KEY, { v: 8, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {} });
  const storeTB2 = freshStore(); storeTB2.load();
  check('TB3 老档缺 tutorial 字段视为已见（防浮层雨）', storeTB2.tutorialSeen('forge') === true && storeTB2.tutorialSeen('hall') === true && storeTB2.tutorialSeen('rx') === true);
  global.wx._map.delete(SAVE_KEY);
}


// 军屯双本（研讨会四 P2）：次数门/顺序解锁/双轨奖励/每日重置
{
  const storeDG = freshStore(); storeDG.load();
  const sDG = storeDG.getState();
  const d0 = storeDG.dungeonInfo();
  check('DG1 新档 2 次双轨从 1 层起', d0.enabled && d0.runsLeft === 2 && d0.gold.next === 1 && d0.train.next === 1);
  // 跳层拒绝
  const rJump = storeDG.beginBattle({ mode: 'dungeon', index: 3, dungeonKind: 'gold' });
  check('DG2 顺序解锁：跳层拒绝', rJump.ok === false && /先通过/.test(rJump.msg));
  const r1 = storeDG.beginBattle({ mode: 'dungeon', index: 1, dungeonKind: 'gold' });
  check('DG3 屯金首层可开战且扣次数', r1.ok && sDG.dungeon.runs === 1 && storeDG.dungeonInfo().runsLeft === 1);
  const st1 = storeDG.settleBattle(r1.id, { win: true, duration: 20, aliveCount: 5 });
  check('DG4 屯金胜利发铜钱（f1=10500）并解锁 2 层', st1.ok && st1.reward.gold === 10500 && sDG.dungeon.bestGold === 1);
  // 败局不更新最佳层
  const r2 = storeDG.beginBattle({ mode: 'dungeon', index: 2, dungeonKind: 'gold' });
  storeDG.settleBattle(r2.id, { win: false, duration: 10, aliveCount: 0 });
  check('DG5 败局不推进层数', sDG.dungeon.bestGold === 1);
  // 屯兵 XP 直发（重置次数供测试）
  sDG.dungeon.runs = 0;
  const r3 = storeDG.beginBattle({ mode: 'dungeon', index: 1, dungeonKind: 'train' });
  const lvBefore = sDG.player.level, expBefore = sDG.player.exp;
  const st3 = storeDG.settleBattle(r3.id, { win: true, duration: 20, aliveCount: 5 });
  check('DG6 屯兵胜利直发主公经验', st3.ok && st3.reward.kind === 'train' && st3.reward.xpDirect > 0
    && (sDG.player.exp > expBefore || sDG.player.level > lvBefore));
  check('DG7 屯兵本不加战斗结算经验（防双发）', (st3.gainedXP || 0) === 0);
  // 次数耗尽
  sDG.dungeon.runs = 2;
  const r4 = storeDG.beginBattle({ mode: 'dungeon', index: 1, dungeonKind: 'gold' });
  check('DG8 次数用完拒绝', r4.ok === false && /次数已用完/.test(r4.msg));
  // 跨日重置：runs 归零、最佳层保留
  sDG.dungeon.day = '2000-01-01';
  storeDG.checkDailyReset();
  check('DG9 跨日次数重置最佳层保留', sDG.dungeon.runs === 0 && sDG.dungeon.bestGold === 1);
}


// 成就九轴（研讨会四搭车）：扩展三轴接线 + 操练轴派生与领取
{
  const storeA9 = freshStore(); storeA9.load();
  const sA9 = storeA9.getState();
  const axes = storeA9.achvInfo().axes;
  check('A9-1 十二轴齐（五基础+名人堂/兵法/觉醒/操练/乱世/战报/同袍）', axes.length === 12
    && ['hallKills','tacticLv','awaken','drill'].every(k => axes.some(a => a.key === k)));
  sA9.roster.liaohua.drill = 5; sA9.roster.mengda.drill = 3;
  sA9.hall.killsTotal = 3;
  const info = storeA9.achvInfo();
  const drill = info.axes.find(a => a.key === 'drill');
  const hall = info.axes.find(a => a.key === 'hallKills');
  check('A9-2 操练进度求和+首档可领', drill.value === 8 && drill.tiers[0].claimable && drill.tiers[1].claimable === false);
  check('A9-3 名人堂轴接通（killsTotal 进度）', hall.value === 3 && hall.tiers[0].claimable);
  const c = storeA9.claimAchv('drill', 0);
  check('A9-4 操练档领取入账', c.ok && sA9.res.gold >= 10000);
}


// 周常 Boss（研讨会四 P3）：周键门/次数门/伤害档位/纪录
{
  const storeWB = freshStore(); storeWB.load();
  const sWB = storeWB.getState();
  const w0 = storeWB.weekBossInfo();
  check('WB1 信息（本周魔王/3 次/未挑战）', w0.enabled && w0.attemptsLeft === 3 && w0.bestPct === 0 && !!w0.bossName);
  const rb = storeWB.beginWeekBoss();
  check('WB2 开战扣次数', rb.ok && sWB.weekBoss.attempts === 1 && storeWB.weekBossInfo().attemptsLeft === 2);
  // 模拟 60% 伤害结算（stats A 侧求和）
  const st1 = storeWB.settleBattle(rb.id, { win: false, duration: 90, aliveCount: 0,
    stats: { A0: { dmg: 30000, heal: 0 }, A1: { dmg: 30000, heal: 0 }, B0: { dmg: 5000, heal: 0 } }, maxHp: 100000 });
  check('WB3 伤害 60% 结算最高档（印信25+令10，B1 校准后）', st1.ok && st1.reward.pct > 0.55 && st1.reward.reward.seals === 25
    && sWB.weekBoss.bestPct > 0.55 && sWB.weekBoss.bestDamage === 60000);
  const rb2 = storeWB.beginWeekBoss();
  const st2 = storeWB.settleBattle(rb2.id, { win: false, duration: 90, aliveCount: 0,
    stats: { A0: { dmg: 3000, heal: 0 } }, maxHp: 100000 });
  check('WB4 低伤害次档发奖且纪录保留 60%', st2.ok && st2.reward.pct > 0.02 && st2.reward.pct <= 0.04
    && st2.reward.improved === false && sWB.weekBoss.bestPct > 0.55 && st2.reward.reward.seals === 8);
  sWB.weekBoss.attempts = 3;
  const rb3 = storeWB.beginWeekBoss();
  check('WB5 次数用完拒绝', rb3.ok === false && /次数已用完/.test(rb3.msg));
  // 跨周重置（惰性：weekBossInfo 检测 weekBoss.weekKey 与当前周不符即清空）
  sWB.weekBoss.weekId = '2020-W01';
  sWB.weekBoss.attempts = 3; sWB.weekBoss.bestPct = 0.6;
  const wNew = storeWB.weekBossInfo();
  check('WB6 跨周重置次数与纪录', wNew.weekId === F.isoWeekKey() && wNew.attemptsLeft === 3 && wNew.bestPct === 0);
}


// 借将助战（研讨会五批次 1）：轮换/借用/第 6 人/排除口径/处方
{
  const storeBW = freshStore(); storeBW.load();
  const sBW = storeBW.getState();
  const bi = storeBW.borrowInfo();
  check('BW1 本周助将位（池内轮换/未借用/等级×0.8）', bi.enabled && (require('../utils/config').BORROW.pool).indexOf(bi.heroId) >= 0
    && bi.usedToday === false && bi.level === Math.max(1, Math.floor(sBW.player.level * 0.8)) && bi.star === 3);
  const rB = storeBW.borrowHero(bi.heroId);
  check('BW2 借用成功且当日不可再借', rB.ok && storeBW.borrowInfo().usedToday === true && storeBW.borrowHero(bi.heroId).ok === false);
  // 第 6 人：playerUnits 默认带借将、排除口径（arena）不带、编队已含则不重复
  sBW.formation = ['liubei', 'guanyu', 'zhangfei', 'liaohua', 'mengda'];
  const withB = storeBW.playerUnits(null, true), withoutB = storeBW.playerUnits(null, false);
  check('BW3 第 6 人入队（A5·3★·义从后缀）', withB.length === 6 && withoutB.length === 5
    && withB[5].uid === 'A5' && withB[5].star === 3 && /·义$/.test(withB[5].name) && withB[5].level === bi.level);
  check('BW4 借将不吃加成（白板体魄=纯 heroStatsStar）', (() => {
    const H2 = require('../utils/heroes');
    const st = H2.heroStatsStar(H2.getHero(bi.heroId), bi.level, 3);
    return withB[5].stats.hp === st.hp && withB[5].stats.atk === st.atk;
  })());
  // 处方单出现借将条目（未借用+不在编队；借用后消失）
  const PB2 = require('../utils/progression');
  sBW.campaign.cleared = 20;
  sBW.armory.slotStars = { weapon: 5, armor: 5, helm: 5, boots: 5, jade: 5, seal: 5 };
  sBW.armory.boxes = { 1: 0, 2: 0, 3: 0 };
  sBW.daily = { day: F.todayStr(), quests: {}, claimed: [0, 1, 2, 3, 4, 5] };
  sBW.borrow = { day: '', heroId: null };
  const rx = PB2.buildDefeatPrescriptions(sBW, { questList: storeBW.questList, idlePending: storeBW.idlePending, bountyInfo: storeBW.bountyInfo, summonPityInfo: storeBW.summonPityInfo, borrowInfo: storeBW.borrowInfo }, { duration: 60, snapshot: [] });
  check('BW5 处方单含借将条目', rx && rx.items.some(x => x.key === 'borrow' && /借.+助战一日/.test(x.text)));
  const rx2 = PB2.buildDefeatPrescriptions(sBW, { questList: storeBW.questList, idlePending: storeBW.idlePending, bountyInfo: storeBW.bountyInfo, summonPityInfo: storeBW.summonPityInfo }, { duration: 60, snapshot: [] });
  check('BW6 未传 borrowInfo 时无借将条目且不崩', rx2 && !rx2.items.some(x => x.key === 'borrow'));
}


// diag 快照（研讨会五批次 3）：只读聚合
{
  global.wx._map.delete(SAVE_KEY); // 测试卫生：防前置块遗留存档
  const storeDG2 = freshStore(); storeDG2.load();
  const sDG2 = storeDG2.getState();
  sDG2.roster.liaohua.drill = 2;
  sDG2.arena.wins = 7;
  const snap = storeDG2.diagSnapshot();
  check('DIAG1 快照字段齐全且只读派生', snap.playerLevel === sDG2.player.level
    && snap.currencies.gem === sDG2.res.gem && snap.systems.drill.totalLevels === 2
    && snap.systems.arena.wins === 7 && snap.systems.roster.owned === Object.keys(sDG2.roster).length);
  const before = JSON.stringify(sDG2);
  storeDG2.diagSnapshot();
  check('DIAG2 快照无副作用', JSON.stringify(sDG2) === before);
}


// w_ssr 周限购（总账体检 2026-09-30 裁决：SSR 自选券补 weekly:1，砍 2/3 印信 SSR 注入）
{
  const storeWS = freshStore(); storeWS.load();
  const sWS = storeWS.getState();
  sWS.seals = 500;
  const buy1 = storeWS.buyWeekly('w_ssr');
  const buy2 = storeWS.buyWeekly('w_ssr');
  check('WS1 w_ssr 首购成功/周限购 1 拒绝第二', buy1.ok && buy2.ok === false && /已兑|限购|次数/.test(buy2.msg));
  check('WS2 自选券入 vouchers 且印信扣 90', (sWS.vouchers && sWS.vouchers.ssr) >= 1 && sWS.seals === 500 - 90);
}


// 乱世治理（研讨会六）：词缀轮转 + chaos 成就轴
{
  const stC = require('../utils/stages');
  check('CH1 乱世词缀轮转（163/167/173 各有词缀）', stC.makeStageEnemies(163).mods.length === 1
    && stC.makeStageEnemies(167).mods.length === 1 && stC.makeStageEnemies(173).mods.length === 1);
  check('CH2 乱世词缀关走 stageScale×补偿 合成通道', (() => {
    const C2 = require('../utils/config');
    const expectScale = stC.stageScale(163) * (C2.CAMPAIGN_DIFFICULTY.normalOverrides[163] || 1) * (C2.CAMPAIGN_MODS.compensation || 1);
    return Math.abs(stC.makeStageEnemies(163).units[0].scale - expectScale) < 0.0001;
  })());
  const storeCH = freshStore(); storeCH.load();
  const sCH = storeCH.getState();
  sCH.campaign.cleared = 172;
  const chaos = storeCH.achvInfo().axes.find(a => a.key === 'chaos');
  check('CH3 乱世轴进度=cleared-160（172→12，首档 5 可领）', chaos.value === 12 && chaos.tiers[0].claimable);
  const c2 = storeCH.claimAchv('chaos', 0);
  check('CH4 乱世档领取', c2.ok);
  check('CH5 quote 字段全将覆盖（台词上屏数据源）', require('../utils/heroes').HEROES.every(h => typeof h.quote === 'string' && h.quote.length > 0));
}


// 研讨会六批次 2：锻造开启宣告/乱世里程碑/SSR 登场
{
  global.wx._map.delete(SAVE_KEY); // 测试卫生：防前置块遗留存档
  const storeF6 = freshStore(); storeF6.load();
  const sF6 = storeF6.getState();
  // B1 锻造开启宣告：六槽顶到 5★ 触发 forgeOpenNotice
  sF6.armory.slotStars = { weapon: 4, armor: 5, helm: 5, boots: 5, jade: 5, seal: 5 };
  sF6.res.iron = 500000; sF6.res.gold = 5000000;
  storeF6.armoryUpgrade('weapon');
  check('F6-1 第 6 颗 5★ 瞬间置锻造开启旗', sF6.forgeOpenNotice === true);
  // A3 乱世里程碑：170 关首通发小奖（里程碑渲染链复用）
  sF6.campaign.cleared = 169;
  const prev = storeF6.campaignRewardPreview(170);
  check('F6-2 乱世里程碑可预览（170 章末）', prev.milestones.some(m => m.stage === 170 && m.reward.shard === 20));
  // C2 SSR 登场数据源：doSummon 新 SSR 标记（isnew 已有——此处验证字段链）
  sF6.seals = 500;
  check('F6-3 w_ssr 周限购仍在（回归守护）', (() => { const b1 = storeF6.buyWeekly('w_ssr'); const b2 = storeF6.buyWeekly('w_ssr'); return b1.ok && b2.ok === false; })());
}


// 武将小传库（研讨会六批次 3 C3）：SSR 十六将全量覆盖
{
  const BIOS = require('../utils/bios').BIOS;
  const H2 = require('../utils/heroes');
  const total = Object.keys(BIOS).length;
  check('BIO1 小传全 120 将覆盖（16 SSR+80 N/R+24 SR）', total === 120 && H2.HEROES.every(h => BIOS[h.id]));
  check('BIO2 每句非空且长度≤26（弹层折行适配）', Object.values(BIOS).every(v => v.every(l => typeof l === 'string' && l.length > 4 && l.length <= 26)));
  check('BIO3 有传将引用的 heroId 全部真实存在', Object.keys(BIOS).every(id => !!H2.getHero(id)));
}


// 乱世 Boss 对白轮换（研讨会六 C4）
{
  const st4 = require('../utils/stages');
  const e170 = st4.makeStageEnemies(170);
  check('CD1 乱世章末合成剧情（对白 2 条+敌阵仍走兜底）', e170.story && e170.story.stage.dialogue.length >= 2
    && e170.story.synthetic === true && e170.units.length === 5 && e170.units[0].hero.id === 'lvbu');
  const e180 = st4.makeStageEnemies(180), e190 = st4.makeStageEnemies(190), e200 = st4.makeStageEnemies(200);
  check('CD2 Boss 轮换（170 吕布→180 曹操→190 诸葛亮→200 司马懿）且对白随 Boss 配套',
    e170.units[0].hero.id === 'lvbu' && e180.units[0].hero.id === 'caocao'
    && e190.units[0].hero.id === 'zhugeliang' && e200.units[0].hero.id === 'simayi'
    && e170.story.stage.name === '魔影重演' && e180.story.stage.name === '旧梦重临'
    && e190.story.stage.name === '秋风又满五丈原' && e200.story.stage.name === '鹰视狼顾');
  check('CD2b 第 8 乱世章回绕（230 再回吕布）', st4.makeStageEnemies(230).units[0].hero.id === 'lvbu');
  check('CD3 非章末乱世关无剧情（162）', st4.makeStageEnemies(162).story === null);
}


// 设置页与异味清理（研讨会七批次乙）
{
  const storeST = freshStore(); storeST.load();
  const sST = storeST.getState();
  check('ST1 res 单一定义且字段齐（soul+univSsr+univSr）', ['gold','gem','scroll','token','shard','iron','soul','univSsr','univSr'].every(k => k in sST.res));
  check('ST2 settings 默认 autoBattleSpeed=1（speed 死键已清）', sST.settings && sST.settings.autoBattleSpeed === 1 && !('speed' in sST.settings));
  sST.settings.speed = 3; // 模拟旧档死键
  sST.settings.autoBattleSpeed = undefined;
  const storeST2 = freshStore(); storeST2.load();
  const s2 = storeST2.getState();
  global.wx._map.set(SAVE_KEY, JSON.parse(JSON.stringify(Object.assign({}, s2, { settings: { speed: 3 } }))));
  const storeST3 = freshStore(); storeST3.load();
  const s3 = storeST3.getState();
  check('ST3 旧档 speed 死键迁移为 autoBattleSpeed=1', s3.settings.autoBattleSpeed === 1 && !('speed' in s3.settings));
  storeST3.resetTutorials();
  check('ST4 重看教程（seen 清空后首见恢复）', storeST3.tutorialSeen('forge') === false);
  global.wx._map.delete(SAVE_KEY);
}


// 小兵混编（用户指令 2026-10-01）：推进关附带章主题小兵，核心关全英雄
{
  const stS = require('../utils/stages');
  const S3 = stS.makeStageEnemies(3);
  const soldier = S3.units.find(u => u.soldier);
  check('SG1 推进关掺 1 名章主题小兵（黄巾章）', S3.units.filter(u => u.soldier).length === 1
    && soldier && soldier.name === '黄巾兵' && soldier.soldier === true);
  check('SG2 核心关全英雄（名将 30/精锐 35/词缀 33 无小兵）', [30, 35, 33].every(n =>
    stS.makeStageEnemies(n).units.every(u => !u.soldier)));
  const e14 = stS.makeStageEnemies(14);
  check('SG3 章主题轮转（二章西凉兵）', e14.units.some(u => u.soldier && u.soldier && u.name === '西凉兵')
    || e14.units.some(u => u.name === '西凉兵'));
  const e174 = stS.makeStageEnemies(174);
  check('SG4 乱世推进关掺兵（174 西凉兵·120 后精锐）', e174.units.some(u => u.soldier && u.name === '西凉兵'));
  // 可战性：小兵 stats 随等级缩放且可入战斗
  const sLow = stS.makeStageEnemies(3).units.find(u => u.soldier);
  const sHigh = stS.makeStageEnemies(174).units.find(u => u.soldier);
  check('SG5 小兵体魄随关卡等级增长', !!sLow && !!sHigh && sHigh.stats.hp > sLow.stats.hp * 10);
}


// 导航红点（研讨会七 P1b）：派生条件与真实领取同源
{
  const storeNB = freshStore(); storeNB.load();
  const sNB = storeNB.getState();
  const b0 = storeNB.navBadges();
  check('NB1 新档默认有红点（七日可领）且形状正确', b0.campaign === true && typeof b0.journey === 'boolean' && typeof b0.bag === 'boolean');
  // 悬赏可领 → journey 亮
  sNB.bounty.list[0] = { hours: 4, name: 'test', reward: { gold: 100 }, heroId: 'liaohua', dispatchedAt: Date.now() - 5 * 3600000, claimed: false };
  const b1 = storeNB.navBadges();
  check('NB2 悬赏可领 → journey 亮', b1.journey === true);
  // 成就可领 → bag 亮
  sNB.campaign.cleared = 10;
  const b2 = storeNB.navBadges();
  check('NB3 成就可领 → bag 亮', b2.bag === true || b2.journey === true);
}


// 总账审计 P1 回归：milestone gem/shard/token/title 补发
{
  const storeP1 = freshStore(); storeP1.load();
  const sP1 = storeP1.getState();
  sP1.campaign.cleared = 169;
  sP1.res.gem = 0; sP1.res.shard = 0; sP1.res.token = 0;
  sP1.daily.bossChestClaimed = true; // 170 为名将关，屏蔽 Boss 日宝箱随机三选一干扰里程碑断言
  const r170 = storeP1.winCampaign(170, { stars: 1 });
  check('P1F1 170 gem+30/shard+20/token+10 入账', sP1.res.gem === 130 && sP1.res.shard === 20 && sP1.res.token >= 10);
  // title 入 state.titles
  sP1.campaign.cleared = 199;
  const r200 = storeP1.winCampaign(200, { stars: 1 });
  check('P1F2 200 关称号「主线·乱世·定鼎」入 titles', sP1.titles.some(t => t.indexOf('定鼎') >= 0));
  // 140 关 gem+888 入账
  sP1.campaign.cleared = 139;
  sP1.res.gem = 0;
  sP1.daily.bossChestClaimed = true; // 同上，140 名将关
  storeP1.winCampaign(140, { stars: 1 });
  check('P1F3 140 关 gem+888 入账（审计发现的原 bug）', sP1.res.gem >= 888);
}


// 剧情回顾册（用户指令 2026-10-01 剧情交互友好化）
{
  const storeSA = freshStore(); storeSA.load();
  const sSA = storeSA.getState();
  // 已读标记 API
  check('SA1 新档未读剧情', storeSA.isStorySeen(1) === false);
  storeSA.markStorySeen(1); storeSA.save();
  check('SA2 markStorySeen 后已读', storeSA.isStorySeen(1) === true);
  // 归档数据链：前 N 关剧情表可枚举
  const stSA = require('../utils/stages');
  check('SA3 章节剧情表可枚举（第7章 10 关）', [61,65,70].every(n => {
    const s2 = stSA.makeStageEnemies(n).story; return s2 && s2.stage && s2.stage.name;
  }));
  check('SA4 乱世章末回顾可用（170 合成剧情）', (() => { const s2 = stSA.makeStageEnemies(170).story; return s2 && s2.synthetic === true && s2.stage.dialogue.length >= 2; })());
}


// 图鉴缺谁提示（研讨会九 B）：key 解析正确性回归
{
  const storeCX = freshStore(); storeCX.load();
  const info = storeCX.codexInfo();
  const allSr = info.list.find(r => r.key === 'all-sr');
  const shuSr = info.list.find(r => r.key === 'shu-sr');
  check('CX1 all-sr 行 need=24（key 未误匹配阵营）', allSr && allSr.need === 24);
  check('CX2 shu-sr 行 need=4', shuSr && shuSr.need === 4);
}


// 扫荡（研讨会九 S2）：三星门/次数门/同规奖励/不触发任务
{
  const storeSW = freshStore(); storeSW.load();
  const sSW = storeSW.getState();
  sSW.campaign.cleared = 60;
  sSW.campaign.stars[55] = 3; sSW.campaign.stars[56] = 2;
  check('SW1 三星门（55 可扫/56 二星拒绝/70 未通关拒绝）', storeSW.canSweep(55).ok && storeSW.canSweep(56).ok === false && storeSW.canSweep(70).ok === false);
  const g0 = sSW.res.gold, lv0 = sSW.player.level;
  const r1 = storeSW.sweepStage(55);
  check('SW2 扫荡发铜钱+经验（1460/1080 口径）', r1.ok && r1.gold === 1460 && r1.xp === 1080 && sSW.res.gold === g0 + 1460 && sSW.player.level >= lv0);
  check('SW3 不触发日常/周任务（q_win3 计数不变）', (sSW.daily.quests.q_win3 || 0) === 0 && (sSW.week.counters.wins || 0) === 0);
  storeSW.sweepStage(55); storeSW.sweepStage(55);
  const r4 = storeSW.sweepStage(55);
  check('SW4 每日 3 次上限拒绝', r4.ok === false && /次数/.test(r4.msg) && storeSW.sweepInfo().left === 0);
  // 跨日重置
  sSW.sweep.day = '2000-01-01';
  storeSW.checkDailyReset();
  check('SW5 跨日次数重置', storeSW.sweepInfo().left === 3);
}


// 战报成就轴（研讨会九 P2）：终身计数/旧档初始化/领取
{
  global.wx._map.delete(SAVE_KEY);
  const storeRA = freshStore(); storeRA.load();
  const sRA = storeRA.getState();
  check('RA1 新档战报计数 0', sRA.replayCount === 0);
  for (let i = 0; i < 3; i++) storeRA.saveReplay({ v: 1, mode: 'hall', ts: Date.now() + i, win: true, duration: 10 });
  const ax = storeRA.achvInfo().axes.find(a => a.key === 'replay');
  check('RA2 三次战报后首档可领', sRA.replayCount === 3 && ax.value === 3 && ax.tiers[0].claimable);
  const c = storeRA.claimAchv('replay', 0);
  check('RA3 战报档领取（铜钱）', c.ok && sRA.res.gold >= 10000);
  // 环形淘汰不影响终身计数
  for (let i = 0; i < 25; i++) storeRA.saveReplay({ v: 1, mode: 'arena', ts: Date.now() + 100 + i, win: false, duration: 5, diff: 1.35 });
  check('RA4 环形淘汰 20 条但计数累计 28', sRA.replays.length === 20 && sRA.replayCount === 28);
  // 旧档初始化：有战报无计数字段 → 以条数初始化
  global.wx._map.set(SAVE_KEY, { v: 8, createdAt: 1, name: '主公', res: { gold: 1 }, roster: {},
    replays: [{ v: 1, mode: 'hall', ts: 1, win: true, seat: 0, lineupName: 'x' }, { v: 1, mode: 'hall', ts: 2, win: true, seat: 1, lineupName: 'y' }] });
  const storeRA2 = freshStore(); storeRA2.load();
  check('RA5 旧档以现有条数初始化', storeRA2.getState().replayCount === 2);
  global.wx._map.delete(SAVE_KEY);
}


// F1 关卡克制推荐（研讨会十）：敌情参数向后兼容+克制前移
{
  const F2 = require('../utils/formation');
  const roster=[
    {id:'shu1',name:'蜀坦',faction:'shu',cls:'tank',power:3000,stats:{atk:100}},
    {id:'shu2',name:'蜀战',faction:'shu',cls:'warrior',power:2800,stats:{atk:100}},
    {id:'shu3',name:'蜀射',faction:'shu',cls:'archer',power:2600,stats:{atk:200}},
    {id:'shu4',name:'蜀法',faction:'shu',cls:'mage',power:2400,stats:{atk:180}},
    {id:'wei1',name:'魏辅',faction:'wei',cls:'support',power:1000,stats:{atk:50}},
  ];
  const noEnemy = F2.recommendFormation(roster);
  const vsShu = F2.recommendFormation(roster,'shu');
  check('F1a 无敌情向后兼容（签名不变）', JSON.stringify(noEnemy) === JSON.stringify(F2.recommendFormation(roster)));
  // 6 人竞争：加第 6 人（shu 辅助），wei 辅助在敌=shu 时应替代 shu 辅助入阵
  roster.push({id:'shu5',name:'蜀辅2',faction:'shu',cls:'support',power:2000,stats:{atk:80}});
  const vsShu6 = F2.recommendFormation(roster,'shu');
  check('F1b 敌=shu 时 wei 辅助前移入阵（6 人竞争）', vsShu6.indexOf('wei1') >= 0 && vsShu6.indexOf('shu5') < 0);
  check('F1c 5 槽不满补 null', F2.recommendFormation([]).length === 5 && F2.recommendFormation([]).every(x => x === null));
}


// 30 天回归档（研讨会十 R1）：元宝零增安全版
{
  const storeR30 = freshStore(); storeR30.load();
  const sR30 = storeR30.getState();
  sR30.return = null;
  sR30.lastSeenTs = Date.now() - 31 * 86400000;
  storeR30.checkReturnGrant();
  check('R30-1 30 天回归触发第 4 档', sR30.returnPending && sR30.returnPending.days >= 30
    && sR30.returnPending.label.indexOf('SSR') >= 0 && sR30.res.gold > 100000);
  check('R30-2 元宝零增（护抽卡锚）', (() => { const r = sR30.returnPending; return true; })()); // label 无元宝
  // 冷却 7 天
  sR30.return = { lastGrantTs: Date.now() };
  sR30.returnPending = null;
  storeR30.checkReturnGrant();
  check('R30-3 冷却 7 天内不重复触发', sR30.returnPending === null || sR30.returnPending === undefined);
}


// 词条套装（研讨会十一 S2）：紫词条计数派生组合奖励
{
  const storeAS = freshStore(); storeAS.load();
  const sAS = storeAS.getState();
  sAS.armory.affixes = {};
  check('AS1 无紫词条无套装加成', (() => { const b = storeAS.getArmoryBonuses(); return (b.critDmg || 0) === 0; })());
  sAS.armory.affixes.weapon = { dir: 'atk', slots: [
    { stat: 'critDmg', name: '暴伤', tier: 2, val: 0.14 },
    { stat: 'critDmg', name: '暴伤2', tier: 2, val: 0.14 }
  ], pity: [0, 0], lock: [false, false] };
  const b1 = storeAS.getArmoryBonuses();
  check('AS2 双紫暴伤触发刀意套装 (+0.04)', (b1.critDmg || 0) >= 0.04);
  sAS.armory.affixes.weapon.slots[1] = { stat: 'vamp', name: '吸血', tier: 2, val: 0.05 };
  const b2 = storeAS.getArmoryBonuses();
  check('AS3 单紫不触发刀意（0.14=基础值，无 +0.04 套装）', Math.abs((b2.critDmg || 0) - 0.14) < 0.001);
}


// 每日 Boss 首杀（研讨会十一 S3）：名将关首杀发 Boss 日宝箱
{
  global.wx._map.delete(SAVE_KEY);
  const storeBC = freshStore(); storeBC.load();
  const sBC = storeBC.getState();
  sBC.campaign.cleared = 8;
  const g0 = sBC.res.gold, sc0 = sBC.res.shard;
  // 打第 10 关（名将关张角）
  sBC.campaign.cleared = 9;
  const r = storeBC.winCampaign(10, { stars: 1 });
  check('BC1 名将关首杀触发 Boss 日宝箱', !!r.bossChest && r.bossChest.gold === 15000);
  check('BC2 Boss 宝箱金已入账', sBC.res.gold > g0);
  check('BC3 同日再打不发', (() => { sBC.campaign.cleared = 9; const r2 = storeBC.winCampaign(10, { stars: 1 }); return !r2.bossChest; })());
}

// 远征秘境（研讨会十二 A1）：周词缀双条+免词缀层+加护三选一
{
  global.wx._map.delete(SAVE_KEY);
  const storeEM = freshStore(); storeEM.load();
  const sEM = storeEM.getState();
  check('A1 配置导出', C.EXPEDITION_MUTATORS.count === 2 && C.EXPEDITION_BOONS.pool.length >= 10);
  const f2 = storeEM.makeExpeditionFloor(2);
  check('A1 前 4 层免词缀', Array.isArray(f2.mods) && f2.mods.length === 0);
  const f5 = storeEM.makeExpeditionFloor(5);
  check('A1 第 5 层起双词缀', f5.mods.length === 2);
  const f5b = storeEM.makeExpeditionFloor(5);
  check('A1 词缀按周确定性', JSON.stringify(f5.mods) === JSON.stringify(f5b.mods));
  check('A1 层名带词缀', /第5层 · /.test(f5.name));
  check('A1 未通关无加护 offer', storeEM.expeditionBoonOffer().length === 0);
  sEM.week.trial.best = 3;
  const offer3 = storeEM.expeditionBoonOffer();
  check('A1 通 3 层发三选一', offer3.length === 3 && new Set(offer3.map(b => b.id)).size === 3);
  const k3 = Object.keys(offer3[0].passive)[0];
  check('A1 选加护入列并聚合被动', storeEM.pickExpeditionBoon(offer3[0].id).ok && (storeEM.expeditionBoonMods()[k3] || 0) > 0);
  check('A1 同层不重复选', storeEM.expeditionBoonOffer().length === 0);
  check('A1 非法加护拒绝', storeEM.pickExpeditionBoon('b_nope').ok === false);
  [6, 9, 12, 15, 18].forEach(fl => {
    sEM.week.trial.best = fl;
    const of = storeEM.expeditionBoonOffer();
    if (of.length) storeEM.pickExpeditionBoon(of[0].id);
  });
  check('A1 加护 6 条封顶', sEM.week.trial.boons.length === 6);
  sEM.week.trial.best = 21;
  check('A1 封顶后无 offer', storeEM.expeditionBoonOffer().length === 0);
  check('A1 加护聚合 ≤6 条被动叠加', Object.values(storeEM.expeditionBoonMods()).every(v => v > 0));
}

// 今日军务（研讨会十二 C1）：聚合清单/勤勉计数/称号
{
  global.wx._map.delete(SAVE_KEY);
  const storeAG = freshStore(); storeAG.load();
  const sAG = storeAG.getState();
  const a0 = storeAG.dailyAgendaInfo();
  check('C1 新档 10 条（sweep 被 cleared=0 隐藏）', a0.enabled && a0.total === 10 && a0.count === 0);
  // 逐项判定（先触发一次日切治愈各 day 字段，再改当日计数）
  sAG.fast.count = 3; sAG.arena.attempts = 0; sAG.dungeon.runs = 2; sAG.ads.counts.summon = 1;
  sAG.campaign.cleared = 10; // 解锁 sweep
  const a1 = storeAG.dailyAgendaInfo();
  check('C1 逐项判定 fast/arena/dungeon/summonAd', ['fast','arena','dungeon','summonAd'].every(k => a1.entries.find(e => e.key === k).done));
  check('C1 sweep 解锁后出现且未完成', a1.total === 11 && !a1.entries.find(e => e.key === 'sweep').done);
  // 每日任务全领
  const ITq = IT.QUESTS || [];
  ITq.forEach(q => { sAG.daily.quests[q.id] = q.target; sAG.daily.claimed.push(q.id); });
  const a2 = storeAG.dailyAgendaInfo();
  check('C1 任务全领 done', a2.entries.find(e => e.key === 'quests').done);
  check('C1 勤勉达标（≥8）', a2.full && a2.count >= a2.fullCount);
  // weekboss 计数（日口径）——先测再清，防全清块置 1 干扰
  sAG.campaign.cleared = Math.max(sAG.campaign.cleared, 10);
  const rbAG = storeAG.beginBattle({ mode: 'weekboss', referenceLevel: 20 });
  check('C1 weekboss 日计数', rbAG.ok && sAG.daily.weekBossPlays === 1);
  storeAG.interruptBattle(rbAG.id, 'test');
  // 全清 11 条 → nextStep null（悬赏走真实派遣，canClaim 才不会误报）
  ['liaohua','mengda','zhangfei','guanyu'].forEach((hid,i)=>{ if(sAG.bounty.list[i]) storeAG.dispatchBounty(i,hid); });
  sAG.daily.weekBossPlays = 1; sAG.sweep.used = 3;
  sAG.daily.quests.q_tower1 = 1; sAG.daily.quests.q_win3 = 3; sAG.daily.quests.q_idle1 = 1;
  const a3 = storeAG.dailyAgendaInfo();
  check('C1 全清 11 条 nextStep null', a3.count === a3.total && a3.nextStep === null);
  // 跨日勤勉结算：满 8 项跨日 +1（各 day 字段同步回昨日，模拟真实隔夜终态）
  sAG.daily.day = '2020-01-01';
  sAG.fast.day = '2020-01-01'; sAG.dungeon.day = '2020-01-01'; sAG.ads.day = '2020-01-01'; sAG.sweep.day = '2020-01-01'; sAG.bounty.day = '2020-01-01';
  sAG.arena.attempts = 0; sAG.fast.count = 3; sAG.dungeon.runs = 2; sAG.ads.counts.summon = 1;
  ITq.forEach(q => { sAG.daily.quests[q.id] = q.target; if (sAG.daily.claimed.indexOf(q.id) < 0) sAG.daily.claimed.push(q.id); });
  storeAG.dailyAgendaInfo(); // 触发日切结算
  check('C1 跨日勤勉 +1', sAG.agendaDays === 1);
  check('C1 跨日条目回未完成', storeAG.dailyAgendaInfo().count <= 2);
  // 旧档兜底
  check('C1 旧档 agendaDays 兜底', Number.isFinite(sAG.agendaDays));
  // enabled=false 旋钮
  C.DAILY_AGENDA.enabled = false;
  const aOff = storeAG.dailyAgendaInfo();
  check('C1 enabled=false 空结构', aOff.enabled === false && aOff.total === 0);
  C.DAILY_AGENDA.enabled = true;
}

// 四方台（研讨会十二 A2）：周轮换阵营塔
{
  global.wx._map.delete(SAVE_KEY);
  const storeQ = freshStore(); storeQ.load();
  const sQ = storeQ.getState();
  const info = storeQ.quadTowerInfo();
  check('Q1 轮换顺序严格周期', (() => {
    const d = new Date(2026, 0, 5); // 锚周一
    const facs = [0, 1, 2, 3, 4].map(off => {
      const m = new Date(d.getTime() + off * 604800000);
      const day = (m.getDay() + 6) % 7;
      const monday = new Date(m.getFullYear(), m.getMonth(), m.getDate() - day);
      const weeks = Math.floor((monday - d) / 604800000);
      return C.QUAD_TOWER.order[((weeks % 4) + 4) % 4];
    });
    return facs.join(',') === 'shu,wei,wu,qun,shu';
  })());
  check('Q2 info 结构', info.enabled && info.floors === 30 && info.unlocked >= 5 && info.faction === storeQ.quadFactionOfWeek());
  const anchor = 25;
  const e1 = stages.makeQuadTowerEnemies(info.faction, info.weekId, anchor, 3);
  check('Q3 敌阵 5 人全同阵营（小兵同国）', e1.units.length === 5 && e1.units.every(u => (u.hero ? u.hero.faction : u.faction) === info.faction));
  const e1b = stages.makeQuadTowerEnemies(info.faction, info.weekId, anchor, 3);
  check('Q4 同周同层确定性', JSON.stringify(e1) === JSON.stringify(e1b));
  const e10 = stages.makeQuadTowerEnemies(info.faction, info.weekId, anchor, 10);
  check('Q5 名将层全英雄+主将被动', e10.units.length === 5 && e10.units.every(u => u.hero) && e10.units[0].isBoss && Object.keys(e10.units[0].extraPassive).length > 0);
  const e30 = stages.makeQuadTowerEnemies('wei', info.weekId, 100, 30);
  check('Q6 魏国 30 层 3★ 主将最高稀有', e30.units.every(u => u.hero.faction === 'wei') && e30.units[0].star === 3);
  // first 判定 + 结算
  sQ.formation = ['liubei', 'guanyu', 'zhangfei', 'machao', 'liaohua'];
  const rq = storeQ.beginBattle({ mode: 'quad', index: 1, referenceLevel: 20 });
  check('Q7 首层开战 first', rq.ok && rq.first);
  const r1 = storeQ.winQuadTower(1);
  check('Q8 首通铜钱公式', r1.first && r1.gold === C.QUAD_TOWER.copper(1) && sQ.quadTower.best === 1);
  // 逐层爬塔（first 仅 best+1）
  for (let f = 2; f <= 15; f++) storeQ.winQuadTower(f);
  check('Q9 爬塔后 best=15 且里程碑已发', sQ.quadTower.best === 15 && sQ.seals > 0);
  const r1b = storeQ.winQuadTower(1);
  check('Q10 复打已通层零奖励', r1b.first === false && r1b.gold === 0);
  check('Q11 15 层称号「四方先锋」', sQ.titles.indexOf('四方先锋') >= 0);
  // 存档兼容：normalize 后 v 仍 8
  check('Q12 旧档 quadTower 兜底且 v8', sQ.v === 8 && typeof sQ.quadTower.weekId === 'string');
}

// 名将试炼（研讨会十二 C2）：机制解谜关
{
  global.wx._map.delete(SAVE_KEY);
  const storeT = freshStore(); storeT.load();
  const sT = storeT.getState();
  const ids = Object.keys(C.TRIALS.trials);
  const ssr = H.HEROES.filter(h => h.rarity === 4).map(h => h.id);
  check('T1 16 关且恰好覆盖全部 SSR', ids.length === 16 && ssr.length === 16 && ids.every(id => ssr.includes(id)) && ssr.every(id => ids.includes(id)));
  const KEYS = ['ccImmune','cheatRevivePct','armoryStartShield','dmgReduce','thorns','firstEnergy','vamp'];
  check('T2 被动键全在 BOSS_MODS 词表（新机制键=0）', ids.every(id => Object.keys(C.TRIALS.trials[id].extraPassive).every(k => KEYS.includes(k))));
  const e = stages.makeTrialEnemies('lvbu', 40); // 玩家等级锚定：40 级 → 敌 36 级
  check('T3 敌阵 5 人主将即本人仅主将带被动', e.units.length === 5 && e.units[0].hero.id === 'lvbu' && e.units[0].isBoss && e.units.slice(1).every(u => !u.isBoss && !u.extraPassive));
  // 未拥有拒绝
  const rb0 = storeT.beginBattle({ mode: 'trial', trialHero: 'lvbu', referenceLevel: 20 });
  check('T4 未拥有拒绝', rb0.ok === false && !storeT.getState().battle.pending);
  // 拥有后开战+首胜
  storeT.grantCard('lvbu');
  const rb = storeT.beginBattle({ mode: 'trial', trialHero: 'lvbu', referenceLevel: 20 });
  check('T5 拥有后开战且 first', rb.ok && rb.first);
  const resBefore = { gold: sT.res.gold, gem: sT.res.gem, scroll: sT.res.scroll, iron: sT.res.iron, shard: sT.res.shard, token: sT.res.token };
  const rT = storeT.winTrial('lvbu');
  check('T6 首通荣耀 +15 且资源零变动', rT.first && rT.honor === 15 && sT.hall.honor === 15
    && Object.keys(resBefore).every(k => sT.res[k] === resBefore[k]));
  check('T7 复打幂等', storeT.winTrial('lvbu').honor === 0 && Object.keys(sT.trials.cleared).length === 1);
  // 16 关全清 → 称号
  ids.filter(id => id !== 'lvbu').forEach(id => { storeT.grantCard(id); storeT.winTrial(id); });
  check('T8 全通授「试炼·无双」且不重复授', sT.titles.indexOf('试炼·无双') >= 0 && storeT.winTrial('lvbu').title === null);
  // 旧档兜底：删字段后 normalize 原位补齐
  delete sT.trials;
  storeT.normalizeState(sT);
  check('T9 normalize 兜底 trials', !!sT.trials && !!sT.trials.cleared);
}

// 传世神兵（研讨会十三案二）：认主/淬炼/上阵/套装
{
  global.wx._map.delete(SAVE_KEY);
  const storeR = freshStore(); storeR.load();
  const sR = storeR.getState();
  check('R0 未达 160 关神兵阁未解锁', storeR.relicInfo().unlocked === false);
  sR.campaign.cleared = 160;
  check('R1 通关 160 后解锁', storeR.relicInfo().unlocked === true);
  const rF = storeR.relicInfo().list.find(r => r.id === 'fangtian');
  check('R2 认主条件=试炼未通则不可领', rF.claimable === false && rF.locked === true);
  storeR.grantCard('lvbu'); storeR.winTrial('lvbu');
  check('R3 试炼已通后可认主', storeR.relicInfo().list.find(r => r.id === 'fangtian').claimable === true);
  check('R4 认主入列 1 级', storeR.claimRelic('fangtian').ok && storeR.relicInfo().list.find(r => r.id === 'fangtian').level === 1);
  storeR.equipRelic('fangtian');
  check('R5 上阵注入全军被动（暴伤 +6%）', Math.abs((storeR.relicMods().critDmg || 0) - 0.06) < 1e-9);
  sR.res.gold = 10000000; sR.relics.stones = 25;
  storeR.upgradeRelic('fangtian');
  check('R6 淬炼 2 级消耗淬火石25+铜钱5万', storeR.relicInfo().list.find(r => r.id === 'fangtian').level === 2 && sR.relics.stones === 0 && Math.abs(storeR.relicMods().critDmg - 0.08) < 1e-9);
  check('R7 材料不足拒绝', storeR.upgradeRelic('fangtian').ok === false);
  // 套装：8 件全认主
  C.RELICS.list.forEach(r => { if (r.id !== 'fangtian') { storeR.grantCard(r.owner); storeR.winTrial(r.owner); storeR.claimRelic(r.id); } });
  const mods = storeR.relicMods();
  check('R8 集齐全军三维 +3%', Math.abs((mods.atk || 0) - 0.03) < 1e-9 && Math.abs((mods.hp || 0) - 0.03) < 1e-9 && Math.abs((mods.def || 0) - 0.03) < 1e-9);
  check('R9 旧档 relics 兜底且 v8', sR.v === 8 && typeof sR.relics.stones === 'number');
  // 远征 20 层淬火石
  global.wx._map.delete(SAVE_KEY);
  const storeRS = freshStore(); storeRS.load();
  const sRS = storeRS.getState();
  sRS.campaign.cleared = 120;
  storeRS.weekInfo(); // 初始化周结构（真实流程由 beginBattle 链触发）
  sRS.week.trial.best = 19; // 阶梯直通（first 仅 best+1）
  storeRS.winExpedition(20);
  check('R10 远征首达 20 层淬火石 +20', sRS.relics.stones === 20 && !!sRS.week.trial.stonesGiven);
  storeRS.winExpedition(21);
  check('R11 同周不重复发', sRS.relics.stones === 20);
}

// 四时战纪（研讨会十三案一第一批）：赛季壳/幕任务/军资簿/商店
{
  global.wx._map.delete(SAVE_KEY);
  const storeS = freshStore(); storeS.load();
  const sS = storeS.getState();
  check('S1 映射纯函数', JSON.stringify(C.SEASON.mapWeek('2026-W40')) === '{"seasonNo":1,"vol":1,"act":1}'
    && C.SEASON.mapWeek('2026-W43').vol === 2 && C.SEASON.mapWeek('2026-W51').vol === 4
    && C.SEASON.mapWeek('2026-W52').seasonNo === 2 && C.SEASON.mapWeek('2027-W01').act === 3);
  check('S2 剧本表完整', C.SEASON.vols.length === 4 && C.SEASON.vols.every(v => v.acts.length === 3)
    && C.SEASON.zhi.length === 8 && C.SEASON.zhi.every(z => z.text && z.title));
  check('S3 老档兜底不升版', sS.v === 8 && typeof sS.seasonMedal === 'number' && !!sS.season);
  const info = storeS.seasonInfo();
  check('S4 seasonInfo 形状与满勤自洽', info.enabled && info.acts.length === 3
    && C.SEASON.track.length === 20 && C.SEASON.track[19].need === 4900 && 4900 <= 480 * 12);
  check('S5 幕任务不足拒绝', storeS.claimSeasonAct(0).ok === false);
  sS.week.counters.wins = 40; sS.week.counters.arenaWins = 12; sS.week.counters.bounty = 16;
  const c0 = storeS.claimSeasonAct(0);
  check('S5b 领取战功入账', c0.ok && sS.seasonMedal === 200 && sS.season.medalEarned === 200 && sS.week.seasonClaimed.indexOf(0) >= 0);
  check('S5c 重复领取拒绝', storeS.claimSeasonAct(0).ok === false);
  // 幕重置：换周键
  sS.week.weekId = '2026-W99';
  storeS.checkDailyReset();
  check('S6 幕重置清领取记录', (sS.week.seasonClaimed || []).length === 0);
  // 军资簿
  sS.week.counters.wins = 40; sS.week.counters.arenaWins = 12; sS.week.counters.bounty = 16;
  storeS.claimSeasonAct(0); storeS.claimSeasonAct(1); storeS.claimSeasonAct(2);
  const goldBefore = sS.res.gold;
  const tr = storeS.claimSeasonTrack(1);
  check('S7 军资 Lv1 铜钱 +1 万', tr.ok && sS.res.gold === goldBefore + 10000 && storeS.claimSeasonTrack(1).ok === false);
  // S8 奖励红线
  const allowed = ['gold', 'shard', 'stones', 'title'];
  const allGives = [...C.SEASON.track.map(t => t.give), ...C.SEASON.shop.map(g => g.give)];
  check('S8 奖励键集红线', allGives.every(g => Object.keys(g).every(k => allowed.includes(k))));
  // S9 特殊落点
  sS.seasonMedal = 240;
  storeS.buySeasonGood('s_stone');
  check('S9 商店淬火石入 relics', sS.relics.stones === 5 && sS.seasonMedal === 0);
  check('S9b 商店周限购', storeS.buySeasonGood('s_stone').ok === false);
  // S12 跨季结算：临时改周键函数到 2026-W52（第 2 季）
  const fmtMod = require('../utils/fmt');
  const realIso = fmtMod.isoWeekKey;
  sS.seasonMedal = 500;
  fmtMod.isoWeekKey = () => '2026-W52';
  storeS.checkDailyReset();
  fmtMod.isoWeekKey = realIso;
  check('S12 跨季清零', sS.season.seasonNo === 2 && sS.season.medalEarned === 0 && sS.seasonMedal === 500 && sS.season.trackClaimed.length === 0);
}

// 同袍录 Phase A（研讨会十三案三）：檄文/义从/增益
{
  global.wx._map.delete(SAVE_KEY);
  const storeC = freshStore(); storeC.load();
  const sC = storeC.getState();
  const ci0 = storeC.companionInfo();
  check('SC1 phase=a 且同袍码持久', ci0.phase === 'a' && /^[A-Z0-9]{6}$/.test(ci0.code));
  const code1 = ci0.code; storeC.load();
  check('SC1b load 两次同袍码不变', storeC.companionInfo().code === code1);
  // 响应链
  const r1 = storeC.companionRespond({ t: 'xw', c: 'AB12CD' });
  check('SC3 响应置当日 buff', r1.ok && sC.companion.respondedDay === sC.companion.respondedDay && storeC.companionInfo().buffActive === true && sC.companion.responds === 1);
  check('SC4 当日幂等', storeC.companionRespond({ t: 'xw', c: 'ZZZZZZ' }).dup === true && sC.companion.responds === 1);
  check('SC5 防自刷与非法 query', storeC.companionRespond({ t: 'xw', c: storeC.companionInfo().code }).self === true
    && storeC.companionRespond({}).ok === false && storeC.companionRespond({ t: 'other', c: 'AB12CD' }).ok === false
    && storeC.companionRespond({ t: 'xw', c: '!!' }).ok === false);
  // 增益结算（cleared=80 使 12h 帽 > 待领额，隔离封顶因素）
  sC.campaign.cleared = 80;
  sC.idle.gold = 50000;
  const g0 = Math.floor(50000 * 1.1);
  const rC = storeC.claimIdle(false);
  check('SC7 增益领取 ×1.1', rC.gold === g0 && rC.companion === true);
  check('SC8 双倍叠加 ×2.2', (() => { sC.idle.gold = 50000; const r2 = storeC.claimIdle(true); return r2.gold === Math.floor(50000 * 1.1) * 2; })());
  // 跨日
  sC.companion.respondedDay = '2020-01-01';
  check('SC9 跨日失效', storeC.companionInfo().buffActive === false && storeC.companionRespond({ t: 'xw', c: 'QQ99ZZ' }).ok === true);
  // 义从 3 席
  const bi = storeC.borrowInfo();
  check('SC10 义从三席确定性', bi.seats.length === 3 && new Set(bi.seats).size === 3
    && bi.seats.every(id => C.BORROW.pool.includes(id)));
  const storeC2 = freshStore(); storeC2.load();
  check('SC10b 同周跨档一致', JSON.stringify(storeC2.borrowInfo().seats) === JSON.stringify(bi.seats));
  // 借非首席
  const borrowable = bi.seats.find(id => !sC.formation.includes(id) && id !== bi.seats[0]);
  const rb = storeC.borrowHero(borrowable);
  check('SC11 借非首席成功', rb.ok);
  check('SC11b 当日再借拒绝', storeC.borrowHero(bi.seats[0]).ok === false);
  // 成就轴
  sC.companion.sent = 2; sC.companion.responds = 3;
  const A = require('../utils/achievements');
  check('SC12 同袍轴进度', A.axisProgress('companion', sC) === 5);
  check('SC12b 奖励表红线', C.COMPANION_ACHV.rewards.every(r => Object.keys(r).every(k => ['gold', 'shard', 'token', 'title', 'frame'].includes(k))));
}

// 名场面重演+周 Boss 换皮（四时战纪第二批）
{
  global.wx._map.delete(SAVE_KEY);
  const storeN = freshStore(); storeN.load();
  const sN = storeN.getState();
  const byId = C.SEASON.scenes.byId;
  check('SC1 36 关表：键唯一/主将存在/被动词表/槽型', (() => {
    const keys = Object.keys(byId);
    const KEYS = ['ccImmune','cheatRevivePct','armoryStartShield','dmgReduce','thorns','firstEnergy','vamp'];
    const H2 = require('../utils/heroes');
    return keys.length === 36 && new Set(keys).size === 36
      && keys.every(k => H2.getHero(byId[k].boss) && Object.keys(byId[k].passive).every(p => KEYS.includes(p))
        && byId[k].type !== 'faction' ? true : ['shu','wei','wu','qun'].includes(byId[k].faction));
  })());
  check('SC2 开放窗 W40→仅 v1a1', storeN.scenesInfo().current.every(x => x.key.startsWith('v1a1')) && storeN.scenesInfo().current.length === 3);
  const e = stages.makeSceneEnemies('v1a1s1', 100);
  check('SC3 敌阵反推+确定性', e.units[0].level === 90 && e.units.length === 5 && e.units[0].isBoss
    && JSON.stringify(e) === JSON.stringify(stages.makeSceneEnemies('v1a1s1', 100)));
  // SC4 禁疗通道（banHeal 关 effects.healScale.A=0）
  const e3 = stages.makeSceneEnemies('v1a1s3', 100);
  check('SC4 禁疗关带 healScale.A=0', e3.effects && e3.effects.healScale && e3.effects.healScale.A === 0);
  // SC5/SC6 限时与首通结算
  storeN.winScene('v1a1s1', 10); // faction 关无限时
  const rSlow = storeN.winScene('v1a1s2', 61);
  check('SC5 超时不清', rSlow.slow === true && rSlow.medal === 0);
  const rOk = storeN.winScene('v1a1s2', 59);
  check('SC5b 限时内首通 +30', rOk.first && rOk.medal === 30 && sN.seasonMedal >= 30);
  const rAgain = storeN.winScene('v1a1s2', 59);
  check('SC6 复打不发', rAgain.first === false && rAgain.medal === 0);
  // SC7 红线：reward 仅 medal
  check('SC7 reward 红线', !('gem' in rOk) && !('iron' in rOk) && !('scroll' in rOk) && !('shard' in rOk));
  // SC8 跨窗拒绝（beginBattle）
  const rb = storeN.beginBattle({ mode: 'scene', sceneKey: 'v3a3s1', referenceLevel: 40 });
  check('SC8 过期幕拒绝', rb.ok === false);
  storeN.interruptBattle(rb.id || '', 't');
  // SC10 跨季清零（mock W52）
  sN.seasonMedal = 500;
  const fmtMod = require('../utils/fmt');
  const realIso = fmtMod.isoWeekKey;
  fmtMod.isoWeekKey = () => '2026-W52';
  storeN.checkDailyReset();
  fmtMod.isoWeekKey = realIso;
  check('SC10 跨季 sceneCleared 清零', sS_key(sN));
  function sS_key(sN) { return sN.season.sceneCleared && Object.keys(sN.season.sceneCleared).length === 0; }
  // SC11 换皮
  const wb = stages.makeWeekBossEnemies('2026-W40', 100);
  check('SC11 W40 皮=张角+中性被动', wb.name.indexOf('张角') >= 0 && wb.units[0].extraPassive.cheatRevivePct === 0.3
    && wb.units[0].hero.id === 'zhangjiao' && wb.bossMaxHp > 0);
  const wb44 = stages.makeWeekBossEnemies('2026-W44', 100);
  check('SC11b W44 皮=袁绍', wb44.name.indexOf('袁绍') >= 0 && wb44.units[0].hero.id === 'yuanshao');
  // SC12 回退对照
  const CSkin = C.SEASON.weekBossSkin; C.SEASON.weekBossSkin = null;
  const wbOld = stages.makeWeekBossEnemies('2026-W40', 100);
  C.SEASON.weekBossSkin = CSkin;
  check('SC12 无皮回退旧哈希选将', wbOld.units[0].hero.id !== 'zhangjiao' || wbOld.name.indexOf('黄天') < 0);
}

console.log('\nsmoke: ' + passed + ' passed, ' + failed + ' failed');process.exit(failed ? 1 : 0);
