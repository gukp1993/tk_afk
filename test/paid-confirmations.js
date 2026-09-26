// 招募点击只进入确认页；取消不扣费，确认事务成功后重复回调不重复消费。
const assert = require('assert');
const store = require('../utils/store');
const summon = require('../src/screens/summon');
store.load();
const state = store.getState();
state.res.gem = 5000;
state.res.scroll = 10;

summon.pull('scroll1');
assert.strictEqual(state.res.scroll, 10, 'initial tap never spends a summon scroll');
summon.cancelPull();
assert.strictEqual(state.res.scroll, 10, 'cancelling keeps resources intact');

summon.pull('gem10');
assert.strictEqual(state.res.gem, 5000, 'premium ten-pull requires a separate confirmation');
summon.executePull('gem10');
assert.strictEqual(state.res.gem, 5000 - require('../utils/config').GACHA.costTenGold);
assert.strictEqual(summon.result.length, 10);
summon.executePull('gem10');
assert.strictEqual(state.res.gem, 5000 - require('../utils/config').GACHA.costTenGold, 'a stale second confirmation is inert');
console.log('paid-confirmations: 6 assertions passed');
