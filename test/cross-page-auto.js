// 跨页自动出征：切页保留唯一战斗实例，回到战役继续查看；其他战斗先冲突保护。
const assert = require('assert');
const store = require('../utils/store');
const registry = require('../src/scenes');
const app = registry.app;
store.load();
app.switchTab('campaign');
app.push('battle', { mode: 'campaign', auto: true });
const session = app.autoSession;
assert.ok(session && session.autoState.status === 'fighting');
const originalBattleId = store.getState().battle.pending.id;
assert.ok(originalBattleId);

app.switchTab('heroes');
assert.strictEqual(session.autoState.status, 'fighting');
assert.strictEqual(store.getState().battle.pending.id, originalBattleId);
for (let i = 0; i < 4; i++) session.update(0.05);
assert.ok(session.autoState.status === 'fighting' || session.autoState.status === 'resultDelay');
app.switchTab('campaign');
assert.strictEqual(app.top(), session, 'campaign tab returns to the existing battle scene');
assert.strictEqual(store.getState().battle.pending.id, originalBattleId, 'return does not begin a duplicate battle');

app.switchTab('journey');
app.push('battle', { mode: 'tower', floor: 1 });
assert.ok(app.battleConflict, 'another battle is deferred behind an explicit conflict choice');
assert.strictEqual(store.getState().battle.pending.id, originalBattleId, 'conflict prompt preserves current pending battle');
app.resolveBattleConflict(true);
assert.strictEqual(app.battleConflict, null);
assert.notStrictEqual(store.getState().battle.pending.id, originalBattleId, 'the old battle is stopped before the new battle starts');
assert.strictEqual(store.getState().battle.pending.mode, 'tower');
app.pop();
assert.strictEqual(store.getState().battle.pending, null, 'leaving the test battle cleans up its pending entry');
console.log('cross-page-auto: 11 assertions passed');
