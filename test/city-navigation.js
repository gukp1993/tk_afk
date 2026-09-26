// 建筑主城触摸回归：内存存档 + SVG 画布，不连接设备或读取真实玩家数据。
// 运行：node test/city-navigation.js
const assert = require('assert');
const { SvgCtx } = require('../preview/mini/svgctx');
const memory = Object.create(null);
global.wx = {
  getStorageSync: key => memory[key],
  setStorageSync: (key, value) => { memory[key] = JSON.parse(JSON.stringify(value)); },
  removeStorageSync: key => { delete memory[key]; }
};
global.requestAnimationFrame = () => {};

const { app, ui } = require('../src/scenes');
const store = require('../utils/store');
const city = require('../src/screens/city');
let passed = 0, failed = 0;

function draw(height = app.H) {
  app.W = 375; app.H = height;
  app.ctx = new SvgCtx(375, height);
  app.last = Date.now();
  app.frame();
}
function home(height) {
  app.switchTab('home');
  city.scroll.town = 0;
  draw(height);
}
function test(name, run) {
  try {
    Object.keys(memory).forEach(key => { delete memory[key]; });
    store.load();
    // 保证领取可用，便于验证拖动不会错误领取。
    store.getState().idle.gold = 100;
    ui.touch = null; ui.pressedId = null;
    run(); passed++;
    console.log('✓ ' + name);
  } catch (error) {
    failed++;
    console.error('✗ ' + name + '\n  ' + error.message);
  }
}
function hit(id) { return ui.hitAreas.find(area => area.id === id && area.cb); }
function visible(id) {
  const area = hit(id);
  assert(area, '缺少可点击入口：' + id);
  assert(area.w > 0 && area.h > 0, '入口没有可见面积：' + id);
  assert(area.x >= 0 && area.y >= 0 && area.x + area.w <= 375 && area.y + area.h <= app.H,
    '入口超出画布：' + id);
  assert.strictEqual(ui.hitAt(area.x + area.w / 2, area.y + area.h / 2).id, id,
    '入口被遮挡：' + id);
  return area;
}
function click(id) {
  const area = visible(id), x = area.x + area.w / 2, y = area.y + area.h / 2;
  ui.onTouchStart(x, y); ui.onTouchEnd(x, y);
}
function town() {
  const area = ui.dragAreas.find(area => area.scene === city && area.key === 'town');
  assert(area, '城市缺少可拖动的地图区域');
  return area;
}
function drag(x, fromY, toY) {
  ui.onTouchStart(x, fromY);
  ui.onTouchMove(x, toY);
  // 实际设备在按下和松开之间也会重绘。
  draw();
  ui.onTouchEnd(x, toY);
}
function reveal(id) {
  for (let i = 0; i < 8; i++) {
    if (hit(id) && hit(id).h >= 24) return visible(id);
    const area = town();
    drag(187, area.y + area.h - 16, area.y + 16);
    draw();
  }
  throw new Error('向上拖动城市后仍无法点击：' + id);
}
function rect(id) {
  const { x, y, w, h } = visible(id);
  return { x, y, w, h };
}

test('游戏默认战役首页，建筑主城仍独立注册并可进入', () => {
  assert.strictEqual(app.tab, 'campaign');
  assert.strictEqual(app.scenes.home, city);
  home(812);
  assert.strictEqual(app.top(), city);
});

[568, 667, 812].forEach(height => {
  test(height + 'px：召唤、英雄与背包通过真实触摸进入对应一级页', () => {
    ['summon', 'heroes', 'bag'].forEach(target => {
      home(height);
      if (target !== 'bag') reveal('home-' + target);
      click('home-' + target);
      assert.strictEqual(app.top(), app.scenes[target]);
      assert.strictEqual(app.tab, target);
      assert.strictEqual(app.stack.length, 0);
      draw(); click('tab-home'); draw();
      assert.strictEqual(app.top(), city);
    });
  });

  test(height + 'px：各建筑进入功能页，返回仍为主城', () => {
    ['arena', 'forge', 'shop', 'formation'].forEach(target => {
      home(height);
      reveal('city-' + target); click('city-' + target);
      assert.strictEqual(app.top(), app.scenes[target]);
      assert.strictEqual(app.stack.length, 1);
      assert.strictEqual(app.tab, 'home');
      draw(); click('back'); draw();
      assert.strictEqual(app.top(), city);
      assert.strictEqual(app.stack.length, 0);
      visible('go-battle');
    });
  });

  test(height + 'px：出征、领取、加速与底栏固定在可见范围，地图拖动不改变位置', () => {
    home(height);
    const ids = ['home-bag', 'go-battle', 'idle-claim', 'idle-more', ...app.TABS.map(tab => 'tab-' + tab.key)];
    if (store.playerLevel && store.settleBattle) ids.push('go-training');
    const before = ids.map(rect), area = town();
    ids.filter(id => id !== 'home-bag').forEach(id => {
      const a = visible(id);
      assert(a.y >= area.y + area.h, '固定操作与地图重叠：' + id);
    });
    drag(187, area.y + area.h - 16, area.y + 16); draw();
    assert.deepStrictEqual(ids.map(rect), before);
    if (height < 752) assert(city.scroll.town > 0, '短屏城市应该能向上拖动');
  });

  test(height + 'px：地图拖至固定按钮/底栏并松手，不出征、不领取、不切页', () => {
    ['go-battle', 'idle-claim', 'idle-more', 'tab-heroes', 'tab-bag'].forEach(id => {
      home(height);
      const area = town();
      drag(187, area.y + area.h - 16, area.y + 16); draw();
      const target = visible(id), beforeGold = store.getState().res.gold;
      drag(target.x + target.w / 2, area.y + 20, target.y + target.h / 2); draw();
      assert.strictEqual(app.top(), city, '拖动误触页面入口：' + id);
      assert.strictEqual(app.tab, 'home');
      assert.strictEqual(app.stack.length, 0);
      assert.strictEqual(store.getState().res.gold, beforeGold, '拖动错误领取收益');
      assert(!city.showIdle, '拖动错误打开收益弹窗');
      assert(!ui.modalActive, '拖动错误打开弹窗');
    });
  });

  test(height + 'px：每日任务及挂机弹窗可打开、阻挡底层并返回', () => {
    [['home-link-1', 'quests-close'], ['idle-more', 'idle-close']].forEach(([open, close]) => {
      home(height); reveal(open); click(open); draw();
      assert(ui.modalActive, '未打开弹窗：' + open);
      assert(!ui.hitAreas.some(area => area.id.startsWith('tab-')), '弹窗期间仍存在底栏入口');
      const before = city.scroll.town;
      drag(8, 96, 60); draw();
      assert.strictEqual(city.scroll.town, before, '弹窗拖动穿透城市');
      click(close); draw();
      assert(!ui.modalActive);
      visible('tab-home'); visible('go-battle');
    });
  });

  test(height + 'px：领取按钮实际增加资源，随后仍留在主城', () => {
    home(height);
    const before = store.getState().res.gold;
    click('idle-claim'); draw();
    assert(store.getState().res.gold >= before + 100);
    assert.strictEqual(app.top(), city);
    assert(store.getState().idle.gold < 1, '领取后未扣除已领取的累计收益');
  });

  test(height + 'px：出征与已支持的练兵按钮传递正确战斗模式', () => {
    const routes = [['go-battle', 'campaign']];
    if (store.playerLevel && store.settleBattle) routes.push(['go-training', 'training']);
    routes.forEach(([id, mode]) => {
      home(height); click(id);
      assert.strictEqual(app.top(), app.scenes.battle);
      assert.strictEqual(app.stack.length, 1);
      assert.strictEqual(app.top().params.mode, mode);
      // 不推进或结算战斗；这里只验证城市入口的路由契约。
      app.pop(); draw();
      assert.strictEqual(app.top(), city);
    });
  });
});

console.log('\n建筑主城回归：' + passed + ' 通过，' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
