// 章节关卡预览使用结算同一套固定奖励规则，并且不改存档或掷随机奖励。
const assert = require('assert');
const store = require('../utils/store');
store.load();
const state = store.getState();
const before = JSON.stringify({ res: state.res, cleared: state.campaign.cleared, armory: state.armory });
const first = store.campaignRewardPreview(1);
assert.strictEqual(first.first, true);
assert.strictEqual(first.gold, Math.floor(2000 * 1.05) + Math.floor(1400 * 1.05));
assert.strictEqual(first.gem, 30);
assert.strictEqual(first.scroll, 0);
assert.strictEqual(first.armoryChance, 0.65);
assert.strictEqual(JSON.stringify({ res: state.res, cleared: state.campaign.cleared, armory: state.armory }), before, 'first-stage preview leaves the save untouched');

state.campaign.cleared = 9;
state.armory.claimedMilestones[1] = false;
const boss = store.campaignRewardPreview(10);
assert.strictEqual(boss.isBoss, true);
assert.strictEqual(boss.gem, 130);
assert.strictEqual(boss.scroll, 2);
assert.strictEqual(boss.armoryBox, 1);
assert.strictEqual(state.res.gem, 1888, 'preview never grants its displayed reward');
console.log('campaign-reward-preview: 11 assertions passed');
