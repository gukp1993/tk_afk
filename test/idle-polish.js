// 轻负担玩法资产语义：日常聚合、有效战斗计数与批量编队事务。
const assert = require('assert');
const store = require('../utils/store');
const items = require('../utils/items');
store.load();
store.checkDailyReset();
let s = store.getState();

// 核心任务权重和旧ID保持稳定；零收益领取不计任务。
const weights = Object.fromEntries(items.QUESTS.map(q => [q.id, q.act]));
assert.deepStrictEqual([weights.q_idle1, weights.q_battle1, weights.q_win3], [30, 30, 40]);
s.idle.last = Date.now(); s.idle.gold = 0; s.idle.scroll = 0; s.idle.ironAcc = 0;
const empty = store.claimIdle(false);
assert.strictEqual(empty.changed, false);
assert.strictEqual(s.daily.quests.q_idle1 || 0, 0);

// 一次有效练兵胜利统一推进任意1胜与任意3胜进度，不依赖战役。
const training = store.beginBattle({ mode: 'training', referenceLevel: 1 });
assert.ok(training.ok);
const result = store.settleBattle(training.id, { win: true, duration: 1 });
assert.ok(result.ok);
assert.strictEqual(s.daily.quests.q_battle1, 1);
assert.strictEqual(s.daily.quests.q_win3, 1);
// 战斗隔日结算检查及重复提交不能重复计数。
store.settleBattle(training.id, { win: true, duration: 1 });
assert.strictEqual(s.daily.quests.q_win3, 1);

// 群英塔有效败北也计塔战挑战，但不计胜利任务。
const tower = store.beginBattle({ mode: 'tower', index: 1, referenceLevel: 1 });
assert.ok(tower.ok);
store.settleBattle(tower.id, { win: false, duration: 1 });
assert.strictEqual(s.daily.quests.q_tower1, 1);
assert.strictEqual(s.daily.quests.q_win3, 1);

// 领取挂机后先领任务再发达标宝箱，重复领取不重复发放。
s.daily.quests.q_win3 = 3;
s.idle.last = Date.now() - 3600 * 1000;
s.idle.gold = 0; s.idle.scroll = 0; s.idle.ironAcc = 0;
const claim = store.claimFreeRewards();
assert.ok(claim.ok && claim.changed);
assert.ok(claim.claimedQuestIds.includes('q_idle1') && claim.claimedQuestIds.includes('q_battle1') && claim.claimedQuestIds.includes('q_win3'));
assert.deepStrictEqual(claim.claimedChestIds, [0, 1, 2]);
assert.strictEqual(store.activePoints(), 115);
assert.strictEqual(store.getState().res.iron >= 12, true);
const again = store.claimFreeRewards();
assert.strictEqual(again.changed, false);

// 编队批量入口先整体验证；无效数组不产生部分变化。
const old = store.getState().formation.slice();
assert.strictEqual(store.applyFormation(['liubei', 'liubei', null, null, null]).ok, false);
assert.deepStrictEqual(store.getState().formation, old);
const applied = store.applyFormation(['liubei', 'guanyu', 'zhangfei', 'liaohua', 'mengda']);
assert.ok(applied.ok);
assert.deepStrictEqual(store.getState().formation, ['liubei', 'guanyu', 'zhangfei', 'liaohua', 'mengda']);
console.log('idle-polish: 19 assertions passed');
