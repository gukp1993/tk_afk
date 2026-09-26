// 集市：每日限购商品 + 自选卡兑换
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const heroes = require('../../utils/heroes');
const F = require('../../utils/fmt');

const CUR_ICON = { gold: '🪙', gem: '💵', scroll: '📜', token: '🎫', shard: '💠' };

module.exports = {
  name: 'shop',
  scroll: {}, scrollReg: {},
  pickList: null, pickRarity: 0,

  onEnter(params) {
    store.checkDailyReset();
    this.refresh();
    const rarity = params && Number(params.pickRarity);
    if ((rarity === 3 && store.getState().vouchers.sr > 0) || (rarity === 4 && store.getState().vouchers.ssr > 0)) this.openVoucher(rarity);
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
    ui.text('待用自选券：SR ' + store.getState().vouchers.sr + ' · SSR ' + store.getState().vouchers.ssr, 12, y, { size: 10, color: T.DIM });
    const vouchers = store.getState().vouchers;
    if (vouchers.sr || vouchers.ssr) {
      if (vouchers.sr) ui.btn(12, y + 17, 170, 28, { text: '使用 SR 自选券 ×' + vouchers.sr, style: 'gold', size: 10, id: 'use-sr-voucher', cb: () => this.openVoucher(3) });
      if (vouchers.ssr) ui.btn(190, y + 17, 173, 28, { text: '使用 SSR 自选券 ×' + vouchers.ssr, style: 'gold', size: 10, id: 'use-ssr-voucher', cb: () => this.openVoucher(4) });
    }
    y += vouchers.sr || vouchers.ssr ? 51 : 18;

    const contentH = this.goods.length * 56 + 30;
    ui.beginScroll(this, 'goods', 8, y, 359, app.H - y - 8, contentH);
    this.goods.forEach((g, i) => {
      const gy = y + i * 56;
      ui.panel(8, gy, 359, 50, {});
      const rarColor = g.give && g.give.ssrPick ? T.RARITY[4].color : (g.give && g.give.srPick ? T.RARITY[3].color : null);
      ui.text(g.name, 20, gy + 8, { size: 13, color: rarColor || undefined });
      if (g.isPick) ui.tag('自选', 20 + ui.textWidth(g.name, 13) + 8, gy + 8, T.GOLD);
      ui.text('限购 ' + g.bought + '/' + g.limit, 20, gy + 28, { size: 10, color: T.DIM });
      ui.btn(258, gy + 10, 98, 30, {
        text: g.soldOut ? '售罄' : CUR_ICON[g.cur] + ' ' + g.priceText,
        style: 'gold', size: 12, disabled: g.soldOut || !g.afford, id: 'buy-' + g.id,
        cb: () => this.buy(g)
      });
    });
    ui.wrap('满星后的同名卡可兑换碎片；演武令通过演武场切磋获得。关闭自选窗口不会消耗自选券。', 20, y + contentH, 340, 13, { size: 10 });
    ui.endScroll();

    if (this.pickList) this.drawPick();
  },
  buy(g) {
    const r = store.buyGood(g.id);
    if (!r.ok) { ui.toast(r.msg || '购买失败'); return; }
    if (g.give.ssrPick || g.give.srPick) {
      this.pickRarity = g.give.ssrPick ? 4 : 3;
      this.buildPickList();
    } else {
      ui.toast('购买成功');
    }
    this.refresh();
  },
  openVoucher(rarity) {
    const key = rarity === 4 ? 'ssr' : 'sr';
    if (!(store.getState().vouchers[key] > 0)) { ui.toast('自选券不足'); return; }
    this.pickRarity = rarity;
    this.buildPickList();
  },
  buildPickList() {
    this.pickList = heroes.HEROES.filter(h => h.rarity === this.pickRarity).map(h => ({
      id: h.id, name: h.name, surname: h.name.slice(0, 1), title: h.title,
      faction: h.faction, cls: h.cls, rarity: h.rarity, level: 1, star: 0, power: 0
    }));
  },
  drawPick() {
    const box = ui.modal(this.pickRarity === 4 ? '自 选 SSR 名 将' : '自 选 SR 名 将', 30, 130, 315, 460);
    ui.setModalClose(() => { this.pickList = null; });
    ui.tap(0, 0, app.W, app.H, () => { this.pickList = null; }, 'pick-mask');
    const cols = 3, cw = (box.w - 16) / 3, chh = 104;
    const rows = Math.ceil(this.pickList.length / cols);
    ui.beginScroll(this, 'ssrpick', box.x, box.y, box.w, box.h, rows * (chh + 8));
    this.pickList.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = box.x + col * (cw + 8);
      const y = box.y + row * (chh + 8);
      ui.panel(x, y, cw, chh, { ornate: h.rarity === 4 });
      ui.tap(x, y, cw, chh, () => {
      const picked = store.useChoiceVoucher(this.pickRarity, h.id);
      if (!picked.ok) { ui.toast(picked.msg); return; }
      this.pickList = null;
      ui.toast(picked.isNew ? '解锁 ' + h.name + '，共享 Lv.' + picked.level : picked.autoStar ? h.name + ' 自动升至 ★' + picked.star : h.name + ' 已满星，额外卡 +1');
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
