// 集市：每日限购商品 + 自选卡兑换
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const heroes = require('../../utils/heroes');
const F = require('../../utils/fmt');

const CUR_ICON = { gold: '🪙', gem: '💵', scroll: '📜', token: '🎫', shard: '💠', exp: '📕' };

module.exports = {
  name: 'shop',
  scroll: {}, scrollReg: {},
  pickList: null, pickRarity: 0,

  onEnter() {
    store.checkDailyReset();
    this.refresh();
  },
  refresh() {
    const s = store.getState();
    this.goods = items.SHOP_GOODS.map(g => {
      const bought = s.buyLog.buys[g.id] || 0;
      return {
        ...g,
        priceText: F.fmtNum(g.price),
        soldOut: bought >= g.limit,
        bought,
        afford: s.res[g.cur] >= g.price,
        isPick: !!(g.give.srPick || g.give.ssrPick)
      };
    });
  },

  draw() {
    app.pageHeader('集 市');
    app.resBar(48, ['gold', 'gem', 'scroll', 'token', 'shard']);
    let y = 76;
    ui.text('今 日 商 品（每日刷新）', 12, y, { size: 13, color: T.GOLD, bold: true });
    y += 22;

    const contentH = this.goods.length * 56 + 30;
    ui.beginScroll(this, 'goods', 8, y, 359, app.H - y - 8, contentH);
    this.goods.forEach((g, i) => {
      const gy = y + i * 56;
      ui.panel(8, gy, 359, 50, {});
      ui.text(g.name, 20, gy + 8, { size: 13 });
      if (g.isPick) ui.tag('自选', 20 + ui.textWidth(g.name, 13) + 8, gy + 8, T.GOLD);
      ui.text('限购 ' + g.bought + '/' + g.limit, 20, gy + 28, { size: 10, color: T.DIM });
      ui.btn(258, gy + 10, 98, 30, {
        text: g.soldOut ? '售罄' : CUR_ICON[g.cur] + ' ' + g.priceText,
        style: 'gold', size: 12, disabled: g.soldOut || !g.afford, id: 'buy-' + g.id,
        cb: () => this.buy(g)
      });
    });
    ui.wrap('遣散多余武将可获得英雄碎片；演武令通过演武场切磋获得。', 20, y + contentH, 340, 13, { size: 10 });
    ui.endScroll();

    if (this.pickList) this.drawPick();
  },
  buy(g) {
    const r = store.buyGood(g.id);
    if (!r.ok) { ui.toast(r.msg || '购买失败'); return; }
    if (g.give.ssrPick || g.give.srPick) {
      this.pickRarity = g.give.ssrPick ? 3 : 2;
      this.pickList = heroes.HEROES.filter(h => h.rarity === this.pickRarity).map(h => ({
        id: h.id, name: h.name, surname: h.name.slice(0, 1), title: h.title,
        faction: h.faction, cls: h.cls, rarity: h.rarity, level: 1, star: 0, power: 0
      }));
    } else {
      ui.toast('购买成功');
    }
    this.refresh();
  },
  drawPick() {
    const box = ui.modal(this.pickRarity === 3 ? '自 选 SSR 名 将' : '自 选 SR 名 将', 30, 130, 315, 460);
    ui.setModalClose(() => { this.pickList = null; });
    ui.tap(0, 0, app.W, app.H, () => { this.pickList = null; }, 'pick-mask');
    const cols = 3, cw = (box.w - 16) / 3, chh = 104;
    const rows = Math.ceil(this.pickList.length / cols);
    ui.beginScroll(this, 'ssrpick', box.x, box.y, box.w, box.h, rows * (chh + 8));
    this.pickList.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = box.x + col * (cw + 8);
      const y = box.y + row * (chh + 8);
      ui.panel(x, y, cw, chh, { ornate: h.rarity === 3 });
      ui.tap(x, y, cw, chh, () => {
        store.grantCard(h.id);
        this.pickList = null;
        ui.toast('已获得 ' + h.name + ' 卡一张');
        this.refresh();
      }, 'ssrpick-' + h.id);
      ui.heroFace(x + 5, y + 5, cw - 10, h, {});
      ui.text(h.name, x + 5, y + 62, { size: 12, bold: true });
      ui.text(h.title, x + 5, y + 78, { size: 9, color: T.DIM });
      ui.text(T.FACTION[h.faction].name, x + cw - 5, y + 78, { size: 10, color: T.FACTION[h.faction].color, align: 'right' });
    });
    ui.endScroll();
  }
};
