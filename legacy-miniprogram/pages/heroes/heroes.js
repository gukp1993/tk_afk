const store = require('../../utils/store');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

const SORTS = [
  { key: 'power', name: '战力' },
  { key: 'level', name: '等级' },
  { key: 'rarity', name: '品质' },
  { key: 'star', name: '品阶' }
];
const FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'wei', name: '魏' }, { key: 'shu', name: '蜀' },
  { key: 'wu', name: '吴' }, { key: 'qun', name: '群' }
];

Page({
  data: {
    resView: {},
    crystal: { cap: 1, top5: [], count: 0 },
    heroes: [],
    sort: 'power', filter: 'all',
    sorts: SORTS, filters: FILTERS
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    store.checkDailyReset();
    this.refresh();
  },
  onHide() { store.save(); },

  refresh() {
    const s = store.getState();
    const crystal = store.crystalInfo();
    const list = store.allRoster().map(h => ({
      ...h,
      isTop5: crystal.top5.some(t => t.id === h.id)
    }));
    this.setData({
      resView: {
        gold: F.fmtNum(s.res.gold), gem: F.fmtNum(s.res.gem),
        scroll: s.res.scroll, exp: F.fmtNum(s.res.exp)
      },
      crystal: { ...crystal, count: crystal.count },
      heroes: this.sortList(list)
    });
  },
  sortList(list) {
    const { sort, filter } = this.data;
    let out = list;
    if (filter !== 'all') out = out.filter(h => h.faction === filter);
    const keyFn = {
      power: h => h.power,
      level: h => h.level,
      rarity: h => h.rarity * 1000 + h.power,
      star: h => h.star * 1000 + h.power
    }[sort];
    return out.slice().sort((a, b) => keyFn(b) - keyFn(a));
  },
  setSort(e) {
    this.setData({ sort: e.currentTarget.dataset.key });
    this.refresh();
  },
  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key });
    this.refresh();
  },
  onCardTap(e) {
    wx.navigateTo({ url: '/pages/hero-detail/hero-detail?id=' + e.detail.hero.id });
  }
});
