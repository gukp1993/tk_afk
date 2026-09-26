// 王庭：玩法枢纽
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

module.exports = {
  name: 'journey',
  scroll: {}, scrollReg: {},

  onEnter() {
    store.checkDailyReset();
    const s = store.getState();
    this.view = {
      towerBest: s.tower.best,
      arena: s.arena,
      rank: items.arenaRank(s.arena.points),
      attempts: s.arena.attempts,
      equips: store.equipInventory().length
    };
  },

  draw() {
    app.resBar(10, ['gold', 'gem', 'scroll', 'token', 'shard']);
    let y = 42;
    ui.text('王 庭 诸 玩 法', 12, y, { size: 14, color: T.GOLD, bold: true });
    y += 26;

    const hubs = [
      { icon: '🗼', name: '群英塔', desc: '无限挑战，节节高升', stat: '已登 ' + this.view.towerBest + ' 层', cb: () => app.push('tower') },
      { icon: '🏟', name: '演武场', desc: '切磋武艺，争锋排名', stat: this.view.rank + ' · 今日剩 ' + this.view.attempts + ' 次', cb: () => app.push('arena') },
      { icon: '⚒', name: '铁匠铺', desc: '穿戴强化，分解换钱', stat: '背包 ' + this.view.equips + ' 件', cb: () => app.push('forge') },
      { icon: '🏪', name: '集市', desc: '每日刷新，奇货可居', stat: '每日刷新', cb: () => app.push('shop') }
    ];
    const w = (359 - 10) / 2, h = 92;
    hubs.forEach((hb, i) => {
      const x = 8 + (i % 2) * (w + 10);
      const hy = y + Math.floor(i / 2) * (h + 10);
      ui.panel(x, hy, w, h, { ornate: true });
      ui.tap(x, hy, w, h, hb.cb, 'hub-' + i);
      ui.text(hb.icon, x + 12, hy + 12, { size: 24 });
      ui.text(hb.name, x + 48, hy + 16, { size: 15, color: T.GOLD_HI, bold: true });
      ui.text(hb.desc, x + 12, hy + 44, { size: 10, color: T.DIM });
      ui.text(hb.stat, x + 12, hy + 66, { size: 11, color: T.GOLD });
    });
    y += h * 2 + 30;

    ui.text('「挂机定三国」放置卡牌 · v2.0.0', 187, y, { size: 10, color: T.DIM, align: 'center' });
    ui.wrap('玩法闭环：挂机收益 → 养成武将 → 推进战役 → 解锁更强玩法', 40, y + 18, 295, 13, { size: 10 });
  }
};
