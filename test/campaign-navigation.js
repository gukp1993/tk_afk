// 战役首页的触摸与路由回归。只使用内存存档，不读取任何设备玩家数据。
// 运行：node test/campaign-navigation.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
const initialTab = app.tab;
const campaign = app.scenes.campaign;
store.load();
let passed = 0, failed = 0;

function test(name, run) {
  try {
    // 先结束上个用例的页面会话，再替换内存存档。
    if (campaign) app.switchTab('campaign');
    Object.keys(memory).forEach(key => { delete memory[key]; });
    store.load();
    store.getState().idle.gold = 100;
    ui.touch = null; ui.pressedId = null;
    run(); passed++;
    console.log('✓ ' + name);
  } catch (error) {
    failed++;
    console.error('✗ ' + name + '\n  ' + error.message);
  }
}
function draw(height = app.H) {
  app.W = 375; app.H = height;
  app.ctx = new SvgCtx(375, height);
  app.last = Date.now();
  app.frame();
}
function enter(height) { app.switchTab('campaign'); draw(height); }
function visible(id) {
  const a = ui.hitAreas.find(area => area.id === id && area.cb);
  assert(a, '缺少可点击入口：' + id);
  assert([a.x, a.y, a.w, a.h].every(Number.isFinite), '入口坐标无效：' + id);
  assert(a.w > 0 && a.h > 0 && a.x >= 0 && a.y >= 0 && a.x + a.w <= app.W && a.y + a.h <= app.H,
    '入口超出画布：' + id);
  assert.strictEqual(ui.hitAt(a.x + a.w / 2, a.y + a.h / 2).id, id, '入口被遮挡：' + id);
  return a;
}
function tap(x, y) { ui.onTouchStart(x, y); ui.onTouchEnd(x, y); }
function click(id) {
  const a = visible(id);
  tap(a.x + a.w / 2, a.y + a.h / 2);
}

test('游戏和双平台入口默认战役，底栏战役居中且全部场景可用', () => {
  assert(campaign, '未注册战役首页');
  assert.strictEqual(initialTab, 'campaign');
  assert.deepStrictEqual(app.TABS.map(tab => tab.key), ['home', 'journey', 'campaign', 'heroes', 'bag']);
  app.TABS.forEach(tab => assert(app.scenes[tab.key], '未注册底栏页面：' + tab.key));
  ['wechat', 'douyin'].forEach(platform => {
    const entry = fs.readFileSync(path.join(__dirname, '..', platform, 'game.js'), 'utf8');
    assert(/app\.switchTab\(['"]campaign['"]\)/.test(entry), platform + ' 启动页应为战役');
  });
});

[568, 667, 812].forEach(height => {
  test(height + 'px：主要操作与全部底栏入口可见可点', () => {
    enter(height);
    ['campaign-summon', 'campaign-bag', 'campaign-quests', 'campaign-armory', 'campaign-formation',
      'campaign-map', 'go-battle', 'go-training', 'idle-claim', 'idle-more',
      ...app.TABS.map(tab => 'tab-' + tab.key)].forEach(visible);
    app.TABS.forEach(tab => {
      click('tab-' + tab.key); draw();
      assert.strictEqual(app.top(), app.scenes[tab.key]);
      assert.strictEqual(app.stack.length, 0);
    });
  });

  test(height + 'px：召唤和背包快捷入口可进入并回到战役', () => {
    ['summon', 'bag'].forEach(target => {
      enter(height); click('campaign-' + target); draw();
      assert.strictEqual(app.top(), app.scenes[target]);
      assert.strictEqual(app.stack.length, 0);
      click('tab-campaign'); draw();
      assert.strictEqual(app.top(), campaign);
    });
  });

  test(height + 'px：军械和编队返回时保留战役首页', () => {
    ['armory', 'formation'].forEach(target => {
      enter(height); click('campaign-' + target); draw();
      assert.strictEqual(app.top(), app.scenes[target]);
      assert.strictEqual(app.tab, 'campaign');
      assert.strictEqual(app.stack.length, 1);
      click('back'); draw();
      assert.strictEqual(app.top(), campaign);
      assert.strictEqual(app.stack.length, 0);
      visible('go-battle');
    });
  });

  test(height + 'px：任务、挂机、地图弹窗隔离首页点击并可关闭', () => {
    [['campaign-quests', 'quests-close'], ['idle-more', 'idle-close'], ['campaign-map', 'campaign-map-close']]
      .forEach(([open, close]) => {
        enter(height);
        visible('go-battle');
        const beforeGold = store.getState().res.gold;
        click(open); draw();
        assert(ui.modalActive, '未打开弹窗：' + open);
        assert(!ui.hitAreas.some(a => a.id.startsWith('tab-')), '弹窗仍注册底栏');
        assert(!ui.hitAreas.some(a => a.id === 'go-battle' || a.id === 'idle-claim'), '弹窗仍注册底层操作');
        // 点按原底栏位置，不能穿透切换页面。
        tap(37, app.H - 8);
        assert.strictEqual(app.top(), campaign);
        assert.strictEqual(store.getState().res.gold, beforeGold);
        // 遮罩允许关闭；如已关闭则重新打开，单独验证显式关闭按钮。
        draw();
        if (!ui.modalActive) { click(open); draw(); }
        click(close); draw();
        assert(!ui.modalActive);
        visible('go-battle'); visible('tab-campaign');
      });
  });

  test(height + 'px：一键收获领取实际累计资源且保持首页', () => {
    enter(height);
    const before = store.getState().res.gold;
    click('idle-claim'); draw();
    assert(store.getState().res.gold >= before + 100, '累计铜钱未到账');
    assert(store.getState().idle.gold < 1, '已领取累计铜钱未清空');
    assert.strictEqual(app.top(), campaign);
    const after = store.getState().res.gold;
    const again = ui.hitAreas.find(a => a.id === 'idle-claim');
    assert(again, '领取后仍应展示收获按钮');
    tap(again.x + again.w / 2, again.y + again.h / 2);
    assert.strictEqual(store.getState().res.gold, after, '重复点击不应重复发奖');
  });

  test(height + 'px：战役和练兵使用自动模式，停止返回战役且不结算中断对局', () => {
    [['go-battle', 'campaign'], ['go-training', 'training']].forEach(([id, mode]) => {
      enter(height);
      const cleared = store.getState().campaign.cleared;
      click(id); draw();
      assert.strictEqual(app.top(), app.scenes.battle);
      assert.strictEqual(app.top().params.mode, mode);
      assert.strictEqual(app.top().params.auto, true);
      click('auto-stop'); draw();
      click('auto-home'); draw();
      assert.strictEqual(app.top(), campaign);
      assert.strictEqual(app.tab, 'campaign');
      assert.strictEqual(app.stack.length, 0);
      assert.strictEqual(store.getState().campaign.cleared, cleared);
      visible('go-battle');
    });
  });

  test(height + 'px：当前关卡节点查看不会开战或修改进度', () => {
    enter(height);
    const stageNo = store.getState().campaign.cleared + 1;
    const before = JSON.stringify(store.getState().campaign);
    click('campaign-node-' + stageNo); draw();
    assert.strictEqual(app.top(), campaign);
    assert.strictEqual(app.stack.length, 0);
    assert.strictEqual(JSON.stringify(store.getState().campaign), before);
  });

  test(height + 'px：首胜待领奖励入口前往英雄选择页', () => {
    store.getState().heroProgress.firstWinChoicePending = true;
    enter(height); click('campaign-goal'); draw();
    assert.strictEqual(app.top(), app.scenes.heroes);
    assert(store.firstWinChoice().available, '查看目标不应直接消费首胜权益');
  });
});

test('已有章节进度与循环章节都展示当前可挑战节点，查看不推进存档', () => {
  [4, 9, 10, 119, 120].forEach(cleared => {
    store.getState().campaign.cleared = cleared;
    enter(812);
    click('campaign-node-' + (cleared + 1)); draw();
    assert.strictEqual(store.getState().campaign.cleared, cleared);
    assert.strictEqual(app.top(), campaign);
    visible('go-battle');
  });
});

console.log('\n战役首页回归：' + passed + ' 通过，' + failed + ' 失败');
process.exitCode = failed ? 1 : 0;
