// 战斗场景与真实内存战斗/存档集成回归。
const assert = require('assert');
const store = require('../utils/store');
const scene = require('../src/screens/battle');
store.load();
scene.onEnter({ mode: 'training', auto: true });
let frames = 0;
while (scene.autoState.status !== 'stopped' && frames++ < 12000) scene.update(0.1);
assert.strictEqual(scene.autoState.status, 'stopped');
assert.ok(['training-level-target', 'training-win-limit'].includes(scene.autoState.reason));
assert.ok(scene.autoSummary.wins > 0);
assert.strictEqual(store.getState().battle.pending, null);

// 自动战役首关结算保存后等待，再开启下一关；停止能清理ID匹配的pending。
scene.onEnter({ mode: 'campaign', auto: true });
frames = 0;
while (!(store.getState().campaign.cleared >= 1 && store.getState().battle.pending && store.getState().battle.pending.index === 2) && frames++ < 20000) scene.update(0.1);
assert.ok(store.getState().campaign.cleared >= 1, 'campaign first stage is committed');
assert.strictEqual(store.getState().battle.pending.index, 2, 'next battle opens only after prior settlement');
scene.sendAuto({ type: 'stop', reason: 'test-stop' });
assert.strictEqual(scene.autoState.status, 'stopped');
assert.strictEqual(store.getState().battle.pending, null, 'stop interrupts current pending battle');
console.log('auto-battle-integration: 7 assertions passed');
