// 背包：资源与军械图鉴入口。装备已改为账号共享解锁，不再生成个人物品。
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const F = require('../../utils/fmt');

const RESOURCES = [
  { key: 'gold', name: '铜钱', mark: '钱', color: T.GOLD, use: '英雄升星与军械部位升星', action: '去培养英雄', tab: 'heroes' },
  { key: 'iron', name: '精铁', mark: '铁', color: T.GOLD_HI, use: '解锁军械图鉴、培养部位', action: '去军械图鉴', page: 'armory' },
  { key: 'gem', name: '元宝', mark: '宝', color: T.GREEN, use: '召唤英雄、购买集市物资', action: '前往集市', page: 'shop' },
  { key: 'scroll', name: '招募令', mark: '令', color: T.GOLD_HI, use: '在召唤页面招募新英雄', action: '去召唤英雄', tab: 'summon' },
  { key: 'token', name: '演武令', mark: '武', color: T.RED_HI, use: '在集市兑换招募令、自选卡', action: '前往集市', page: 'shop' },
  { key: 'shard', name: '英雄碎片', mark: '魂', color: T.PURPLE, use: '在集市兑换英雄自选卡', action: '前往集市', page: 'shop' }
];

module.exports = {
  name: 'bag', section: 'resources', scroll: {}, scrollReg: {},

  onEnter() {
    this.armory = store.getArmoryState();
  },

  draw() {
    ui.text('背包', 16, 20, { size: 24, color: T.GOLD_HI, bold: true });
    ui.text('查看物资 · 了解用途 · 管理装备', 16, 54, { size: 12, color: T.DIM });
    const w = (app.W - 40) / 2;
    ui.btn(16, 82, w, 34, {
      text: '资源道具', style: this.section === 'resources' ? 'gold' : 'ghost', id: 'bag-resources',
      cb: () => { this.section = 'resources'; }
    });
    ui.btn(24 + w, 82, w, 34, {
      text: '军械图鉴', style: 'ghost', id: 'bag-armory',
      cb: () => app.push('armory')
    });
    this.drawResources();
  },

  drawResources() {
    const y = 130, cardH = 118, gap = 10, w = (app.W - 42) / 2;
    const contentH = Math.ceil(RESOURCES.length / 2) * (cardH + gap) + 28;
    ui.beginScroll(this, 'resources', 12, y, app.W - 24, Math.max(1, app.H - y - 64), contentH);
    const res = store.getState().res;
    RESOURCES.forEach((r, i) => {
      const x = 16 + (i % 2) * (w + gap), cy = y + Math.floor(i / 2) * (cardH + gap);
      ui.panel(x, cy, w, cardH);
      ui.panel(x + 10, cy + 12, 32, 32, { fill: 'rgba(217,169,78,0.08)', r: 6 });
      ui.text(r.mark, x + 26, cy + 18, { size: 20, color: r.color, bold: true, align: 'center' });
      ui.text(r.name, x + 50, cy + 12, { size: 13, bold: true });
      ui.text(F.fmtNum(res[r.key] || 0), x + 50, cy + 31, { size: 16, color: r.color, bold: true });
      ui.wrap(r.use, x + 10, cy + 57, w - 20, 14, { size: 10, color: T.DIM });
      ui.text(r.action + ' ›', x + 10, cy + 96, { size: 11, color: T.GOLD });
      ui.tap(x, cy, w, cardH, () => {
        if (r.tab) app.switchTab(r.tab);
        else app.push(r.page);
      }, 'bag-resource-' + r.key);
    });
    ui.text('点击物资卡片，前往对应功能使用', 16, y + contentH - 23, { size: 11, color: T.DIM });
    ui.endScroll();
  },

};
