// 自动战斗纯状态机回归；无需平台桩、存档或战斗引擎。
// 运行：node test/auto-battle.js
const assert = require('assert');
const { createState, transition } = require('../utils/auto-battle');

let passed = 0;
function test(name, fn) {
  fn(); passed += 1; console.log('✓ ' + name);
}
function send(state, event, cfg) { return transition(state, event, cfg); }
function started(state, battleId) {
  return send(state, { type: 'battleStarted', ok: true, battleId, sessionToken: state.sessionToken });
}
function settle(state, battleId, fields) {
  return send(state, Object.assign({ type: 'settled', ok: true, battleId, sessionToken: state.sessionToken }, fields));
}
function initial(mode, extra) {
  const result = send(createState(), Object.assign({ type: 'start', mode: mode || 'campaign', cleared: 0, level: 1 }, extra || {}));
  assert.equal(result.commands[0].type, 'startBattle');
  return result;
}

test('campaign win schedules one next stage after foreground delay', () => {
  let r = initial('campaign');
  assert.equal(r.commands[0].index, 1);
  r = started(r.state, 'b1');
  r = settle(r.state, 'b1', { outcome: 'win', levelAfter: 1, gainedXP: 150 });
  assert.equal(r.state.status, 'resultDelay');
  assert.equal(r.state.campaignIndex, 2);
  assert.equal(r.commands.length, 0);
  const dup = settle(r.state, 'b1', { outcome: 'win' });
  assert.equal(dup.ignored, 'stale-or-duplicate-settlement');
  assert.equal(dup.state.delayRemaining, r.state.delayRemaining);
  r = send(r.state, { type: 'tick', dt: 1.49 });
  assert.equal(r.commands.length, 0);
  r = send(r.state, { type: 'tick', dt: 0.01 });
  assert.equal(r.commands[0].type, 'startBattle');
  assert.equal(r.commands[0].index, 2);
});

test('loss uses bounded training rounds and stops after final retry loss', () => {
  let r = initial('campaign');
  r = started(r.state, 'c1');
  r = settle(r.state, 'c1', { outcome: 'loss', levelAfter: 1 });
  assert.equal(r.state.recoveryRounds, 1);
  assert.equal(r.commands[0].mode, 'training');
  r = started(r.state, 't1');
  r = settle(r.state, 't1', { outcome: 'win', levelAfter: 3, gainedXP: 100 });
  assert.equal(r.commands[0].mode, 'campaign');
  assert.equal(r.commands[0].index, 1);
  r = started(r.state, 'c2');
  r = settle(r.state, 'c2', { outcome: 'loss', levelAfter: 3 });
  assert.equal(r.state.recoveryRounds, 2);
  r = started(r.state, 't2');
  r = settle(r.state, 't2', { outcome: 'win', levelAfter: 5, gainedXP: 100 });
  r = started(r.state, 'c3');
  r = settle(r.state, 'c3', { outcome: 'loss', levelAfter: 5 });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'recovery-exhausted');
  assert.equal(r.commands[0].type, 'stopped');
});

test('training wins stop on level target or win cap, failures and zero XP stop immediately', () => {
  let r = initial('training', { level: 8 });
  r = started(r.state, 't1');
  r = settle(r.state, 't1', { outcome: 'win', levelAfter: 9, gainedXP: 100 });
  assert.equal(r.commands[0].mode, 'training');
  r = started(r.state, 't2');
  r = settle(r.state, 't2', { outcome: 'win', levelAfter: 10, gainedXP: 100 });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'training-level-target');

  r = initial('training', { level: 1 });
  r = started(r.state, 't3');
  r = settle(r.state, 't3', { outcome: 'loss', levelAfter: 1, gainedXP: 0 });
  assert.equal(r.state.reason, 'training-loss');
  r = initial('training', { level: 1 });
  r = started(r.state, 't4');
  r = settle(r.state, 't4', { outcome: 'win', levelAfter: 1, gainedXP: 0 });
  assert.equal(r.state.reason, 'training-no-xp');
});

test('independent training has finite win cap and maximum level guard', () => {
  let r = initial('training', { level: 1 });
  for (let i = 1; i <= 10; i += 1) {
    r = started(r.state, 'w' + i);
    r = settle(r.state, 'w' + i, { outcome: 'win', levelAfter: 1, gainedXP: 1 });
  }
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'training-win-limit');
  r = send(createState(), { type: 'start', mode: 'training', level: 200 });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'level-max');
});

test('settlement failure, start failure, stale ids and old sessions cannot launch work', () => {
  let r = initial('campaign');
  const stale = send(r.state, { type: 'battleStarted', ok: false, sessionToken: r.state.sessionToken - 1 });
  assert.equal(stale.ignored, 'stale-start');
  r = send(r.state, { type: 'battleStarted', ok: false, reason: 'no roster', sessionToken: r.state.sessionToken });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'no roster');
  r = initial('campaign');
  r = started(r.state, 's1');
  r = settle(r.state, 's1', { ok: false, reason: 'save failed' });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.state.reason, 'save failed');
  const old = send(r.state, { type: 'settled', battleId: 's1', sessionToken: r.state.sessionToken - 1, ok: true, outcome: 'win' });
  assert.equal(old.ignored, 'stale-session');
});

test('pause reasons compose and only matching resume restores prior state', () => {
  let r = initial('campaign');
  r = send(r.state, { type: 'pause', reason: 'background' });
  r = send(r.state, { type: 'pause', reason: 'story' });
  assert.equal(r.state.status, 'suspended');
  const wrong = send(r.state, { type: 'resume', reason: 'story' });
  assert.equal(wrong.state.status, 'suspended');
  r = send(wrong.state, { type: 'resume', reason: 'background' });
  assert.equal(r.state.status, 'fighting');
  assert.equal(Object.keys(r.state.pauseReasons).length, 0);
});

test('stop immediately invalidates the session; stop-after waits for current result', () => {
  let r = initial('campaign');
  r = started(r.state, 'stop1');
  r = send(r.state, { type: 'stopAfterBattle' });
  r = settle(r.state, 'stop1', { outcome: 'win', levelAfter: 1, gainedXP: 1 });
  assert.equal(r.state.status, 'stopped');
  assert.equal(r.commands.filter(x => x.type === 'startBattle').length, 0);
  r = initial('campaign');
  r = started(r.state, 'stop2');
  r = send(r.state, { type: 'stop', reason: 'navigate-away' });
  assert.equal(r.commands[0].type, 'interruptBattle');
  assert.equal(r.state.status, 'stopped');
  const late = settle(r.state, 'stop2', { outcome: 'win' });
  assert.equal(late.ignored, 'stale-or-duplicate-settlement');
});

console.log('auto-battle: ' + passed + '/7 passed');
