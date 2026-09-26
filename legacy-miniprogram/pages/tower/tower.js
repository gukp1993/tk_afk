// 群英塔：无限层挑战
const store = require('../../utils/store');

Page({
  data: { best: 0, next: 1, myPower: 0, list: [] },
  onShow() {
    const s = store.getState();
    this.setData({
      best: s.tower.best,
      next: s.tower.best + 1,
      myPower: store.teamPower(),
      list: this.buildFloors(s.tower.best)
    });
  },
  onHide() { store.save(); },
  buildFloors(best) {
    // 展示已通关最后 3 层 + 之后 5 层
    const start = Math.max(1, best - 2);
    const out = [];
    for (let f = start; f <= best + 5; f++) {
      out.push({
        floor: f,
        cleared: f <= best,
        isNext: f === best + 1,
        boss: f % 5 === 0
      });
    }
    return out;
  },
  goFight() {
    wx.navigateTo({ url: '/pages/battle/battle?mode=tower&floor=' + (store.getState().tower.best + 1) });
  },
  goFloor(e) {
    wx.navigateTo({ url: '/pages/battle/battle?mode=tower&floor=' + e.currentTarget.dataset.floor });
  }
});
