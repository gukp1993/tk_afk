// 集市：每日限购商品 + 自选武将卡兑换
const store = require('../../utils/store');
const items = require('../../utils/items');
const heroes = require('../../utils/heroes');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

Page({
  data: {
    resView: {},
    goods: [],
    curNames: store.CURRENCY_NAME,
    showPick: false, pickRarity: 0, pickTitle: '', pickList: [],
    toast: ''
  },
  onShow() {
    store.checkDailyReset();
    this.refresh();
  },
  onHide() { store.save(); },

  refresh() {
    const s = store.getState();
    this.setData({
      resView: {
        gold: F.fmtNum(s.res.gold), gem: F.fmtNum(s.res.gem),
        scroll: s.res.scroll, token: s.res.token, shard: s.res.shard,
        exp: F.fmtNum(s.res.exp)
      },
      goods: items.SHOP_GOODS.map(g => {
        const bought = s.buyLog.buys[g.id] || 0;
        return {
          ...g,
          priceText: F.fmtNum(g.price),
          soldOut: bought >= g.limit,
          bought,
          afford: s.res[g.cur] >= g.price,
          isPick: !!(g.give.srPick || g.give.ssrPick)
        };
      })
    });
  },
  toast(msg) {
    this.setData({ toast: msg });
    setTimeout(() => this.setData({ toast: '' }), 1600);
  },
  buy(e) {
    const goodId = e.currentTarget.dataset.id;
    const good = items.SHOP_GOODS.find(g => g.id === goodId);
    const r = store.buyGood(goodId);
    if (!r.ok) { this.toast(r.msg || '购买失败'); return; }
    if (good.give.ssrPick || good.give.srPick) {
      const rarity = good.give.ssrPick ? 3 : 2;
      this.setData({
        showPick: true, pickRarity: rarity,
        pickTitle: rarity === 3 ? '自 选 SSR 名 将' : '自 选 SR 名 将',
        pickList: heroes.HEROES.filter(h => h.rarity === rarity).map(h => ({
          id: h.id, name: h.name, title: h.title, faction: h.faction, cls: h.cls,
          rarity: h.rarity, level: 1, star: 0, power: 0
        }))
      });
    } else {
      this.toast('购买成功');
    }
    this.refresh();
  },
  closePick() { this.setData({ showPick: false }); },
  choosePick(e) {
    store.grantCard(e.detail.hero.id);
    this.setData({ showPick: false });
    this.toast('已获得 ' + e.detail.hero.name + ' 卡一张');
    this.refresh();
  }
});
