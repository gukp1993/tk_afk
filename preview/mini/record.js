// 离屏渲染驱动：mock wx 环境 + 逐场景截图（SVG）
const fs = require('fs');
const path = require('path');
const { SvgCtx } = require('./svgctx');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

// ---------- mock wx ----------
let clock = Date.now();
const rafQueue = [];
const storage = {};
global.requestAnimationFrame = (cb) => rafQueue.push(cb);
global.wx = {
  createCanvas() {
    const ctx = new SvgCtx(750, 1624);
    wx.__ctx = ctx;
    return { width: 750, height: 1624, getContext: () => ctx };
  },
  getWindowInfo() { return { screenWidth: 375, screenHeight: 812, pixelRatio: 2 }; },
  getSystemInfoSync() { return { screenWidth: 375, screenHeight: 812, pixelRatio: 2 }; },
  onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
  onHide() {},
  setStorageSync(k, v) { storage[k] = JSON.parse(JSON.stringify(v)); },
  getStorageSync(k) { return storage[k]; },
  removeStorageSync(k) { delete storage[k]; }
};
// 每“帧”推进 33ms
function frames(n) {
  for (let i = 0; i < n; i++) {
    clock += 33;
    const realNow = Date.now;
    Date.now = () => clock;
    wx.__ctx.newFrame();
    const cb = rafQueue.shift();
    if (cb) cb();
    Date.now = realNow;
  }
}

// ---------- 载入游戏 ----------
require('../../src/scenes'); // 场景注册表（与平台入口 game.js 共用）
const { app } = require('../../src/app');
const store = require('../../utils/store');
app.init(); // 平台入口 game.js 的启动序列：init + 默认 tab
app.switchTab('home');

// ---------- 丰富预览数据 ----------
const s = store.getState();
s.res.gem = 18888; s.res.scroll = 88; s.res.gold = 520000; s.res.exp = 480000; s.res.shard = 120;
['zhaoyun', 'zhugeliang', 'zhouyu', 'lvbu', 'huatuo', 'guojia', 'huangzhong', 'sunshangxiang', 'daqiao', 'zhangjiao', 'zhenji', 'taishici', 'lvmeng', 'yanliang', 'dongzhuo', 'luxun', 'ganning', 'machao', 'xuchu', 'simayi', 'caocao', 'diaochan']
  .forEach(id => store.addHeroCard(id));
s.roster.guanyu.lv = 32; s.roster.guanyu.star = 2; s.roster.guanyu.cards = 1;
s.roster.zhaoyun.lv = 30; s.roster.zhangfei.lv = 28; s.roster.liubei.lv = 26;
s.roster.zhugeliang.lv = 25; s.roster.zhouyu.lv = 22;
s.res.gold = 5e6; s.res.exp = 5e6;
store.levelUp('guanyu', 10);
s.roster.guanyu.lv = Math.min(s.roster.guanyu.lv, 60);
// 装备
const e1 = store.addEquip(4, 'weapon'); const e2 = store.addEquip(3, 'armor');
store.equipTo('guanyu', 'weapon', e1);
store.equipTo('guanyu', 'armor', e2);
store.addEquip(5, 'helm'); store.addEquip(2, 'boots'); store.addEquip(3, 'weapon');
s.campaign.cleared = 23;
s.tower.best = 17;

const shots = [];
function snap(name) {
  frames(3);
  const svg = app.ctx.takeSVG ? '' : '';
  shots.push([name, app.canvas.getContext().takeSVG()]);
}

// 1. 主城
app.switchTab('home');
snap('home');
// 1b. 模拟广告覆盖层（showRewarded 未配置广告位时自动进入内置模拟广告）
const ads = require('../../src/ads');
ads.showRewarded('idle2x', () => {});
snap('ad-mock');
ads.showRewarded('idle2x', () => {});
frames(120); // 播放完成，出现领取按钮
snap('ad-mock-done');
ads.state.mock = null;
// 2. 任务弹窗
app.scenes.home.showQuests = true;
snap('home-quests');
app.scenes.home.showQuests = false;

// 3. 群英
app.switchTab('heroes');
snap('heroes');

// 4. 武将详情
app.push('heroDetail', { id: 'guanyu' });
snap('hero-detail');
app.pop();

// 5. 编队
app.push('formation');
snap('formation');
app.scenes.formation.pickSlot = 0;
snap('formation-picker');
app.scenes.formation.pickSlot = -1;
app.pop();

// 6. 点将台
app.switchTab('summon');
snap('summon');
app.scenes.summon.pull('scroll10');
frames(70); // 揭示完成
snap('summon-result');

// 7. 王庭
app.switchTab('journey');
snap('journey');

// 8. 群英塔
app.push('tower');
snap('tower');
app.pop();

// 9. 演武场
app.push('arena');
snap('arena');
app.pop();

// 10. 铁匠铺
app.push('forge');
snap('forge');
app.pop();

// 11. 集市
app.push('shop');
snap('shop');
app.pop();

// 12. 战斗（进行中）
app.switchTab('home');
app.push('battle', { mode: 'campaign' });
frames(140);
snap('battle-live');
frames(1200);
snap('battle-result');
app.pop();

// ---------- 输出 ----------
shots.forEach(([name, svg]) => {
  fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
  console.log('shot:', name, (svg.length / 1024).toFixed(1) + 'KB');
});
let html = '<html><head><meta charset="utf-8"><title>小游戏离屏渲染审查</title></head>';
html += '<body style="background:#333;display:flex;flex-wrap:wrap;gap:10px;padding:10px">';
shots.forEach(([name, svg]) => {
  html += '<div style="text-align:center"><div style="color:#fff;font-size:12px">' + name + '</div>';
  html += '<div style="width:375px;height:812px;overflow:hidden;border:1px solid #000">' + svg.replace('width="750" height="1624"', 'width="375" height="812"') + '</div></div>';
});
html += '</body></html>';
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('DONE ->', OUT);
