// 王庭：玩法枢纽
const store = require('../../utils/store');
const IT = require('../../utils/items');
const F = require('../../utils/fmt');

Page({
  data: {
    resView: {},
    towerBest: 0, arena: {}, arenaRank: '', attempts: 0,
    equipCount: 0
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    store.checkDailyReset();
    const s = store.getState();
    this.setData({
      resView: {
        gold: F.fmtNum(s.res.gold), gem: F.fmtNum(s.res.gem),
        scroll: s.res.scroll, exp: F.fmtNum(s.res.exp),
        token: s.res.token, shard: s.res.shard
      },
      towerBest: s.tower.best,
      arena: s.arena,
      arenaRank: IT.arenaRank(s.arena.points),
      attempts: s.arena.attempts,
      equipCount: store.equipInventory().length
    });
  },
  onHide() { store.save(); },
  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  }
});
