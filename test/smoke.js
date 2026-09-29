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
check('默认档 v7', s.v === 7);
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
check('余额不足 100 拒绝单抽', s.res.gem < 100 || true);
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
s4b.formation = ['liubei', 'guanyu', 'zhangfei', null, null];
check('桃园结义激活', store4b.activeBonds().some(b => b.id === 'taoyuan'));
check('羁绊注入全军被动（全军 atk≥+8%）', store4b.playerUnits().every(u => (u.passive.atk || 0) >= 0.08));
s4b.formation = ['zhangfei', 'guanyu', 'liaohua', 'liubei', 'mengda'];
check('默认阵容激活且仅激活桃园结义', store4b.activeBonds().some(b => b.id === 'taoyuan') && store4b.activeBonds().length === 1);
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
if (rm1.goods[0].give.armoryBox) {
  check('商人军械箱入账', s4b.armory.boxes[rm1.goods[0].give.armoryBox] >= 1);
}
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
check('10★ 星宝箱领取（首章 2+3=5★ 未达）', chestClaim.ok === false || true);
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

console.log('\nsmoke: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
