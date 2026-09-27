// 生成微信开发者工具验收用的存档 fixtures（写入 test/fixtures/，随文件粘贴进模拟器存储）。
// 运行：node test/make-acceptance-save.js
const fs = require('fs');
const path = require('path');

const SAVE_KEY = 'sanguo_afk_save_v1';
const storageMap = new Map();
global.wx = { setStorageSync: (k, v) => storageMap.set(k, v), getStorageSync: k => storageMap.get(k) };

const C = require('../utils/config');
const IT = require('../utils/items');
const F = require('../utils/fmt');
const H = require('../utils/heroes');
const formation = require('../utils/formation');

function freshStore() {
  delete require.cache[require.resolve('../utils/store')];
  return require('../utils/store');
}
const outDir = path.join(__dirname, 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

// ---- Fixture 1：v7 强度存档，campaign.cleared=119（用于验收第 120 关首通/完成横幅/循环乱世）----
storageMap.clear();
let store = freshStore();
store.load();
const s = store.getState();
s.res.gem = 2000000;
for (let i = 0; i < 400 && s.res.gem >= C.GACHA.costTenGold; i++) store.doSummon('gem10');
s.res.scroll = 5;
s.player.level = 179; s.player.exp = 0;
IT.CATALOG.forEach(item => { s.armory.unlocked[item.id] = true; });
IT.ARMORY_SLOTS.forEach(slot => { s.armory.slotStars[slot.id] = 3; });
s.res.iron = 9000; s.res.gold = 900000;
s.campaign.cleared = 119;
[40, 90, 100, 110].forEach(stage => { s.campaign.milestones[stage] = 1; });
s.armory.claimedMilestones = { 1: true, 2: true, 3: true };
s.armory.boxes = { 1: 0, 2: 0, 3: 0 };
store.applyFormation(formation.recommendFormation(store.allRoster()));
s.res.gem = 5200; // 当日额度内的合理余额
s.gemDay = { day: F.todayStr(), claimedGem: 0 };
store.save();
const fixture1 = JSON.parse(JSON.stringify(s));
// 回读校验：能正常 load 且进度正确
storageMap.set(SAVE_KEY, fixture1);
store = freshStore(); store.load();
if (store.getState().v !== 7 || store.getState().campaign.cleared !== 119) throw new Error('fixture1 回读校验失败');
fs.writeFileSync(path.join(outDir, 'acceptance-stage120.json'), JSON.stringify(fixture1));
console.log('fixture1: acceptance-stage120.json（v7 · 已通关 119 · 满编 120 关待打）');

// ---- Fixture 2：v6 旧档（cleared=120，用于验收 v7 迁移一次性补发）----
storageMap.clear();
const armory = (() => {
  const unlocked = {}, selected = {}, slotStars = {};
  IT.ARMORY_SLOTS.forEach(sl => {
    const starter = IT.CATALOG.find(x => x.slot === sl.id && x.q === 0);
    unlocked[starter.id] = true; selected[sl.id] = starter.id; slotStars[sl.id] = 2;
  });
  return { schema: 1, unlocked, selected, slotStars, seen: {}, claimedMilestones: { 1: true, 2: true, 3: true }, boxes: { 1: 0, 2: 0, 3: 0 } };
})();
const v6 = {
  v: 6, createdAt: 1769000000000, name: '旧主公',
  player: { level: 150, exp: 0 },
  res: { gold: 500000, gem: 3000, scroll: 7, token: 0, shard: 5, iron: 40 },
  roster: {},
  formation: ['liubei', 'guanyu', 'zhangfei', null, null],
  campaign: { cleared: 120, storySeen: {} },
  tower: { best: 0 }, arena: { points: 1000, wins: 0, losses: 0, attempts: 5 },
  equips: {}, nextEquip: 1, armory,
  idle: { last: Date.now() - 2 * 3600000, gold: 8000, scroll: 4.5, ironAcc: 96 },
  fast: { day: '', count: 0 },
  daily: { day: '', quests: {}, claimed: [], active: [] },
  summon: { total: 0 }, vouchers: { sr: 0, ssr: 0 },
  heroProgress: { starterMengdaGranted: true, firstWinChoiceGranted: true, firstWinChoicePending: false, chapterOneVoucherGranted: true },
  battle: { nextSeq: 1, pending: null, lastSettled: null },
  migrations: {}, ads: { day: '', counts: {} }, buyLog: { day: '', buys: {} }, settings: { speed: 1 }
};
['liubei', 'guanyu', 'zhangfei', 'liaohua', 'mengda'].forEach(id => {
  v6.roster[id] = { id, star: 4, cards: 0, lockedCards: false, equip: { weapon: null, armor: null, helm: null, boots: null } };
});
storageMap.set(SAVE_KEY, v6);
store = freshStore(); store.load();
const migrated = store.getState();
if (migrated.v !== 7 || !Array.isArray(migrated.campaign.retroGrants) || migrated.campaign.retroGrants.length !== 5) {
  throw new Error('fixture2 迁移校验失败');
}
console.log('fixture2: migration-v6-cleared120.json（v6 旧档 · 预期补发 5 项新增里程碑）');
console.log('  预期补发内容：SSR券×2 · SSR军械箱×2 · 招募令+10（s.res.scroll =', 7 + 10, '）');

// 同时导出迁移后形态供对照
fs.writeFileSync(path.join(outDir, 'migration-v6-cleared120.json'), JSON.stringify(v6));
console.log('已写入 test/fixtures/');
