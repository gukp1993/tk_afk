// 点将台：招募令单抽/十连、元宝十连，硬保底 60 抽、心愿值 30 抽必出 SSR
const store = require('../../utils/store');
const heroes = require('../../utils/heroes');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

Page({
  data: {
    resView: {},
    pity: 0, wish: 0, total: 0,
    pityPct: 0, wishPct: 0,
    rateText: 'SSR 2.5% · SR 12%',
    showResult: false, results: [], revealAll: false,
    pulling: false,
    toast: ''
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },
  onHide() { store.save(); },

  refresh() {
    const s = store.getState();
    const sm = s.summon;
    this.setData({
      resView: {
        gem: F.fmtNum(s.res.gem), scroll: s.res.scroll,
        gold: F.fmtNum(s.res.gold), exp: F.fmtNum(s.res.exp)
      },
      pity: sm.pity, wish: sm.wish, total: sm.total,
      pityPct: Math.min(100, Math.round(sm.pity / C.GACHA.hardPity * 100)),
      wishPct: Math.min(100, Math.round(sm.wish / C.GACHA.wishMax * 100))
    });
  },
  toast(msg) {
    this.setData({ toast: msg });
    setTimeout(() => this.setData({ toast: '' }), 1600);
  },

  pull(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.pulling) return;
    const r = store.doSummon(type);
    if (!r.ok) { this.toast(r.msg); return; }
    const results = r.results.map(x => {
      const def = heroes.getHero(x.id);
      return {
        ...x,
        name: def.name, faction: def.faction, rarity: def.rarity,
        title: def.title, rarityName: C.RARITIES[def.rarity].name
      };
    });
    this.setData({
      showResult: true, results, revealAll: false, pulling: true
    });
    // 逐张揭示
    const step = results.length > 1 ? 160 : 400;
    results.forEach((_, i) => {
      setTimeout(() => {
        this.setData({ [`results[${i}].revealed`]: true });
      }, 150 + i * step);
    });
    setTimeout(() => {
      this.setData({ revealAll: true, pulling: false });
      this.refresh();
    }, 150 + results.length * step + 300);
  },
  closeResult() {
    if (this.data.pulling) return;
    this.setData({ showResult: false, results: [] });
    this.refresh();
  },
  goHeroes() {
    this.setData({ showResult: false });
    wx.switchTab({ url: '/pages/heroes/heroes' });
  }
});
