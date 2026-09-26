// UI 输入与导航回归。仅使用内存存档和 SvgCtx，不访问设备/开发者工具数据。
// 运行：node test/ui-navigation.js
const assert = require('assert');
const { SvgCtx } = require('../preview/mini/svgctx');

const memory = Object.create(null);
global.wx = {
  getStorageSync: key => memory[key],
  setStorageSync: (key, value) => { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync: key => { delete memory[key]; }
};
global.requestAnimationFrame = () => {}; // frame() 只执行当前帧，不启动循环

const { app, ui } = require('../src/scenes');
const initialTab = app.tab;
const store = require('../utils/store');
store.load();
let passed = 0, failed = 0;
function test(name, run) {
  try {
    ui.touch = null; ui.pressedId = null;
    run();
    passed++;
    console.log('✓ ' + name);
  } catch (error) {
    failed++;
    console.error('✗ ' + name + '\n  ' + error.message);
  }
}
function begin() {
  ui.begin(new SvgCtx(375, 812), 375, 812, 1 / 30);
}
function tap(x, y) {
  ui.onTouchStart(x, y);
  ui.onTouchEnd(x, y);
}
function draw(height) {
  app.W = 375; app.H = height;
  app.ctx = new SvgCtx(app.W, app.H);
  app.last = Date.now();
  app.frame();
}
function clickId(id) {
  const hit = ui.hitAreas.find(area => area.id === id && area.cb);
  assert(hit, '缺少可点击入口：' + id);
  assert(hit.w > 0 && hit.h > 0, '入口没有可见面积：' + id);
  assert(hit.y >= 0 && hit.y + hit.h <= app.H, '入口超出屏幕：' + id);
  const x = hit.x + hit.w / 2, y = hit.y + hit.h / 2;
  assert.strictEqual(ui.hitAt(x, y).id, id, '入口被其他控件遮挡：' + id);
  tap(x, y);
}

test('在绘制弹窗后设置关闭回调也能关闭，面板内留白不关闭', () => {
  begin();
  let closed = 0;
  ui.modal('后注册回调', 40, 200, 295, 200);
  ui.setModalClose(() => closed++);
  tap(100, 250);
  assert.strictEqual(closed, 0);
  tap(20, 100);
  assert.strictEqual(closed, 1);
});

test('模拟广告阻挡底层点击和滚动，提前关闭不发奖', () => {
  const ads = require('../src/ads');
  begin();
  let clicked = 0, rewarded = 0;
  const scene = { scroll: { list: 40 } };
  ui.beginScroll(scene, 'list', 0, 0, 375, 812, 1200);
  ui.tap(0, 0, 375, 812, () => clicked++, 'under-ad');
  ui.endScroll();
  ads.showRewarded('idle2x', () => rewarded++);
  ads.frame(0.1);
  tap(10, 10);
  ui.onTouchStart(10, 100); ui.onTouchMove(10, 70); ui.onTouchEnd(10, 70);
  assert.strictEqual(clicked, 0);
  assert.strictEqual(scene.scroll.list, 40);
  const close = ui.hitAreas.find(a => a.id === 'ad-close');
  tap(close.x + 4, close.y + 4);
  assert.strictEqual(ads.state.mock, null);
  assert.strictEqual(rewarded, 0);
});

test('滚动后点击可见位置触发，旧位置不触发', () => {
  begin();
  const scene = { scroll: { list: 80 } };
  let count = 0;
  ui.beginScroll(scene, 'list', 20, 100, 200, 100, 400);
  ui.tap(40, 240, 100, 30, () => count++, 'scrolled-item');
  ui.endScroll();
  tap(80, 170);
  assert.strictEqual(count, 1);
  tap(80, 250);
  assert.strictEqual(count, 1);
});

test('部分可见控件只接受裁剪区域内的点击', () => {
  begin();
  const scene = { scroll: { list: 80 } };
  let count = 0;
  ui.beginScroll(scene, 'list', 20, 100, 200, 100, 400);
  ui.tap(10, 160, 240, 60, () => count++, 'clipped-top');
  ui.tap(40, 260, 100, 50, () => count++, 'clipped-bottom');
  ui.tap(40, 100, 100, 20, () => count++, 'invisible');
  ui.endScroll();
  tap(15, 110); tap(230, 110); tap(30, 95); tap(80, 210); tap(80, 30);
  assert.strictEqual(count, 0, '裁剪区域之外不能穿透点击');
  tap(30, 110); tap(80, 190);
  assert.strictEqual(count, 2);
});

test('列表筛选变短后滚动偏移归零，内容恢复可点击', () => {
  begin();
  const scene = { scroll: { list: 180 } };
  let count = 0;
  const offset = ui.beginScroll(scene, 'list', 20, 100, 200, 100, 90);
  ui.tap(40, 120, 100, 30, () => count++, 'short-item');
  ui.endScroll();
  assert.strictEqual(offset, 0);
  assert.strictEqual(scene.scroll.list, 0);
  tap(80, 130);
  assert.strictEqual(count, 1);
});

test('滚动区内 1px 手抖仍可点击且不改变滚动位置', () => {
  begin();
  const scene = { scroll: { list: 40 } };
  let count = 0;
  ui.beginScroll(scene, 'list', 20, 100, 200, 100, 400);
  ui.tap(40, 170, 100, 30, () => count++, 'jitter-item');
  ui.endScroll();
  ui.onTouchStart(80, 140);
  ui.onTouchMove(81, 141);
  ui.onTouchEnd(81, 141);
  assert.strictEqual(count, 1);
  assert.strictEqual(scene.scroll.list, 40);
});

test('真实拖动滚动列表，不误触按钮', () => {
  begin();
  const scene = { scroll: { list: 40 } };
  let count = 0;
  ui.beginScroll(scene, 'list', 20, 100, 200, 100, 400);
  ui.tap(40, 140, 100, 80, () => count++, 'drag-item');
  ui.endScroll();
  ui.onTouchStart(80, 140);
  ui.onTouchMove(80, 110);
  ui.onTouchEnd(80, 110);
  assert.strictEqual(scene.scroll.list, 70);
  assert.strictEqual(count, 0);
});

test('英雄列表和编队选将页在快速手势只触发起止事件时仍可滚动', () => {
  const roster = require('../utils/heroes').HEROES;
  roster.slice(5, 45).forEach(hero => store.grantCard(hero.id));

  app.switchTab('heroes'); draw(852);
  let area = ui.dragAreas.find(x => x.scene === app.scenes.heroes && x.key === 'grid');
  assert(area && area.scene.scrollReg.grid.contentH > area.h, '英雄列表应有可滚动内容');
  ui.onTouchStart(area.x + area.w / 2, area.y + area.h * 0.7);
  ui.onTouchEnd(area.x + area.w / 2, area.y + area.h * 0.35);
  assert(app.scenes.heroes.scroll.grid > 0, '英雄列表抬手时应提交最终滚动位移');

  app.switchTab('formation'); draw(852);
  const slot = ui.hitAreas.find(x => x.id === 'slot-0');
  assert(slot, '编队页面应有可选槽位');
  tap(slot.x + slot.w / 2, slot.y + slot.h / 2);
  draw(852);
  area = ui.dragAreas.find(x => x.scene === app.scenes.formation && x.key === 'picker');
  assert(area && area.scene.scrollReg.picker.contentH > area.h, '选将列表应有可滚动内容');
  ui.onTouchStart(area.x + area.w / 2, area.y + area.h * 0.7);
  ui.onTouchEnd(area.x + area.w / 2, area.y + area.h * 0.35);
  assert(app.scenes.formation.scroll.picker > 0, '编队选将页抬手时应提交最终滚动位移');
  app.switchTab('home');
});

[false, true].forEach(closable => test('弹窗隔离底层点击和滚动（可关闭=' + closable + '）', () => {
  begin();
  const scene = { scroll: { list: 40 } };
  let background = 0, foreground = 0, closed = 0;
  ui.beginScroll(scene, 'list', 0, 60, 375, 600, 1000);
  ui.tap(0, 60, 375, 1000, () => background++, 'background');
  ui.endScroll();
  ui.setModalClose(() => closed++);
  ui.modal('隔离测试', 40, 200, 295, 200, closable);
  ui.tap(80, 280, 120, 40, () => foreground++, 'foreground');
  tap(100, 300);
  assert.strictEqual(foreground, 1, '弹窗自己的按钮正常工作');
  tap(20, 100);
  assert.strictEqual(closed, closable ? 1 : 0);
  assert.strictEqual(background, 0);
  ui.onTouchStart(20, 150);
  ui.onTouchMove(20, 100);
  ui.onTouchEnd(20, 100);
  assert.strictEqual(scene.scroll.list, 40, '弹窗出现后背景不能滚动');
}));

test('无关闭回调的遮罩仍阻挡底层点击', () => {
  begin();
  let count = 0;
  ui.tap(0, 0, 375, 812, () => count++, 'background');
  ui.setModalClose(null);
  ui.modal('无回调', 40, 200, 295, 200);
  tap(20, 100);
  assert.strictEqual(count, 0);
});

test('五个底部入口已注册，首次打开默认战役', () => {
  assert.strictEqual(initialTab, 'campaign');
  assert.deepStrictEqual(app.TABS.map(tab => tab.key), ['home', 'journey', 'campaign', 'heroes', 'bag']);
  app.TABS.forEach(tab => assert(app.scenes[tab.key], '未注册场景：' + tab.key));
});

[812, 667, 568].forEach(height => {
  test(height + 'px 屏幕：首页三入口通过触摸跳转到对应页面', () => {
    ['summon', 'heroes', 'bag'].forEach(target => {
      app.switchTab('home');
      draw(height);
      clickId('home-' + target);
      assert.strictEqual(app.top(), app.scenes[target]);
      assert.strictEqual(app.tab, target);
      assert.strictEqual(app.stack.length, 0);
    });
  });

  test(height + 'px 屏幕：底栏逐项导航且无栈残留', () => {
    app.TABS.forEach(tab => {
      draw(height);
      clickId('tab-' + tab.key);
      assert.strictEqual(app.top(), app.scenes[tab.key]);
      assert.strictEqual(app.stack.length, 0);
    });
  });

  test(height + 'px 屏幕：背包军械入口进入共享图鉴，返回仍在背包', () => {
    app.switchTab('bag');
    draw(height);
    clickId('bag-armory');
    assert.strictEqual(app.top(), app.scenes.armory);
    assert.strictEqual(app.stack.length, 1);
    draw(height);
    clickId('armory-catalog');
    draw(height);
    assert(ui.hitAreas.some(area => area.id === 'armory-upgrade'), '图鉴页应显示部位升星入口');
    clickId('armory-item-weapon_r');
    draw(height);
    assert.strictEqual(app.scenes.armory.detailId, 'weapon_r', '触摸图鉴条目应打开该军械详情');
    clickId('back');
    assert.strictEqual(app.top(), app.scenes.bag);
    assert.strictEqual(app.tab, 'bag');
    assert.strictEqual(app.stack.length, 0);
  });
});

test('app 在弹窗打开时不注册底栏，关闭后底栏恢复', () => {
  const original = app.scenes.home.draw;
  try {
    app.switchTab('home');
    app.scenes.home.draw = () => ui.modal('覆盖底栏', 20, 120, 335, 200, false);
    draw(667);
    assert(ui.modalActive);
    assert(!ui.hitAreas.some(area => area.id.startsWith('tab-')));
    const before = app.tab;
    tap(110, 645);
    assert.strictEqual(app.tab, before);
    app.scenes.home.draw = original;
    draw(667);
    assert(!ui.modalActive);
    clickId('tab-bag');
    assert.strictEqual(app.tab, 'bag');
  } finally {
    app.scenes.home.draw = original;
  }
});

console.log('\nUI 导航回归：' + passed + ' 通过，' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
