const assert = require('assert');
const progression = require('../utils/progression');
const items = require('../utils/items');
const stages = require('../utils/stages');

let passed = 0;
function check(value, message) { assert.ok(value, message); passed += 1; }

function snapshot() {
  return {
    campaign: { cleared: 9 }, formation: ['guanyu', 'liubei', null, null, null],
    roster: { liubei: { star: 0 }, guanyu: { star: 0 } },
    heroProgress: { chapterOneVoucherGranted: false }, vouchers: { sr: 0, ssr: 0 },
    armory: { unlocked: { weapon_n: true, armor_n: true, helm_n: true, boots_n: true, jade_n: true, seal_n: true },
      selected: { weapon: 'weapon_n', armor: 'armor_n', helm: 'helm_n', boots: 'boots_n', jade: 'jade_n', seal: 'seal_n' },
      slotStars: {}, boxes: { 1: 0, 2: 0, 3: 0 }, claimedMilestones: {} }
  };
}

// 首胜状态以真实 store API 为准，不能仅由 campaign.cleared 推断。
{
  const s = snapshot();
  const api = { firstWinChoice: () => ({ available: false }), ascendPreview: () => ({ ok: false }) };
  check(progression.getNextGoal(s, api).id === 'chapter-10', '未首胜/不可领时不展示首胜领取目标');
  api.firstWinChoice = () => ({ available: true });
  const goal = progression.getNextGoal(s, api);
  check(goal.id === 'first-win-choice' && goal.action.focusFirstWin, '真实首胜API可领时排第一并聚焦入口');
  check(JSON.stringify(s).indexOf('first-win') < 0 && s.campaign.cleared === 9, '读取目标不改存档');
}

// 可升星只采用当前阵容槽位顺序的首个真实可升星候选。
{
  const s = snapshot();
  const api = { firstWinChoice: () => ({ available: false }), ascendPreview: id => id === 'guanyu'
    ? { ok: true, can: true, from: 1, to: 2, cards: 2, needCards: 2 }
    : { ok: true, can: true, from: 0, to: 1, cards: 1, needCards: 1 } };
  const goal = progression.getNextGoal(s, api);
  check(goal.id === 'ascend-guanyu', '升星同分时按上阵槽位优先');
  check(goal.action.focus === 'ascend' && goal.action.id === 'guanyu', '升星目标含定位路由');
  api.ascendPreview = () => ({ ok: true, can: false });
  check(progression.getNextGoal(s, api).id === 'chapter-10', '资源不足不能显示为可升星目标');
}

// 待选奖励优先级：低品质军械箱先、SR券先于SSR券。
{
  const s = snapshot(); s.armory.boxes[2] = 1; s.armory.boxes[1] = 1;
  s.vouchers.sr = 1; s.vouchers.ssr = 1;
  const api = { firstWinChoice: () => ({ available: false }), ascendPreview: () => ({ ok: false }) };
  check(progression.getNextGoal(s, api).action.boxQ === 1, '多个军械箱先推荐较低品质');
  s.armory.boxes[1] = 0;
  check(progression.getNextGoal(s, api).action.boxQ === 2, '无低品质箱时推荐下一品质箱');
  s.armory.boxes = { 1: 0, 2: 0, 3: 0 };
  check(progression.getNextGoal(s, api).action.pickRarity === 3, '武将自选券先推荐SR');
  s.vouchers.sr = 0;
  check(progression.getNextGoal(s, api).action.pickRarity === 4, '没有SR券时推荐SSR券');
}

// 军械建议严格非劣、至少一项提升，不能建议SSR槽，也不能建议花费解锁。
{
  const s = snapshot();
  s.armory.unlocked.weapon_r = true;
  s.armory.unlocked.weapon_sr = true;
  s.armory.unlocked.armor_r = true;
  s.armory.selected.armor = 'armor_ssr_a';
  s.armory.unlocked.armor_ssr_a = true;
  const suggestions = progression.getArmoryRecommendations(s);
  const weapon = suggestions.find(x => x.slot === 'weapon');
  check(weapon && weapon.toId === 'weapon_sr' && weapon.toQ === 2, '同槽采用最高已解锁的合格N/R/SR军械');
  check(!suggestions.some(x => x.slot === 'armor'), 'SSR槽保持玩家选择');
  check(!suggestions.some(x => x.slot === 'helm'), '未解锁军械不进入免费建议');
  const current = JSON.stringify(s.armory);
  progression.getArmoryRecommendations(s);
  check(JSON.stringify(s.armory) === current, '军械建议只读');
}

// 近期目标使用当前里程碑状态，120关后继续按每10关章末循环。
{
  const api = { firstWinChoice: () => ({ available: false }), ascendPreview: () => ({ ok: false }) };
  const s = snapshot();
  let goal = progression.getNextGoal(s, api);
  check(goal.id === 'chapter-10' && goal.progress.remaining === 1, '目标指向最近章末关');
  check(goal.rewardPreview.firstClear.gem === 30 && goal.rewardPreview.chapterChest.gem === 100
    && goal.rewardPreview.bossReward.scroll === 1 && goal.rewardPreview.chapterChest.scroll === 1,
  '奖励预览区分首通Boss招募令与章末宝箱招募令');
  check(goal.rewardPreview.armoryBoxQ === 1 && goal.rewardPreview.srChoiceVoucher, '第10关包含R军械箱和SR自选券');
  s.campaign.cleared = 10;
  s.heroProgress.chapterOneVoucherGranted = false;
  goal = progression.getNextGoal(s, api);
  check(goal.id === 'chapter-20' && goal.rewardPreview.srChoiceVoucher && goal.rewardPreview.armoryBoxQ === 0,
    '适配实际settleBattle规则：遗留未发放的SR券会在下一次战役胜利补发');
  s.heroProgress.chapterOneVoucherGranted = true;
  check(stages.chapterOf(130).isBoss && progression.getNextGoal(Object.assign({}, s, { campaign: { cleared: 129 } }), api).id === 'chapter-130',
    '第120关后按循环章节继续显示章末目标');
  s.campaign.cleared = 29;
  goal = progression.getNextGoal(s, api);
  check(goal.id === 'chapter-30' && goal.rewardPreview.armoryBoxQ === 2, '第30关显示SR品质军械箱');
  s.campaign.cleared = 59;
  goal = progression.getNextGoal(s, api);
  check(goal.id === 'chapter-60' && goal.rewardPreview.armoryBoxQ === 3, '第60关显示SSR品质军械箱');
}

console.log(passed + ' progression assertions passed');
