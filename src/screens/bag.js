// 背包：真实资源与闲置装备概览；穿戴、强化仍由铁匠铺统一处理。
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

const RESOURCES = [
  { key: 'gold', name: '铜钱', mark: '钱', color: T.GOLD, use: '英雄升级、升星与装备强化', action: '去培养英雄', tab: 'heroes' },
  { key: 'exp', name: '兵书', mark: '书', color: T.BLUE, use: '和铜钱一起用于英雄升级', action: '去培养英雄', tab: 'heroes' },
  { key: 'gem', name: '元宝', mark: '宝', color: T.GREEN, use: '召唤英雄、购买集市物资', action: '前往集市', page: 'shop' },
  { key: 'scroll', name: '招募令', mark: '令', color: T.GOLD_HI, use: '在召唤页面招募新英雄', action: '去召唤英雄', tab: 'summon' },
  { key: 'token', name: '演武令', mark: '武', color: T.RED_HI, use: '在集市兑换招募令、自选卡', action: '前往集市', page: 'shop' },
  { key: 'shard', name: '英雄碎片', mark: '魂', color: T.PURPLE, use: '在集市兑换英雄自选卡', action: '前往集市', page: 'shop' }
];

module.exports = {
  name: 'bag', section: 'resources', scroll: {}, scrollReg: {}, list: [], wornCount: 0,

  onEnter() {
    this.list = store.equipInventory().slice().sort((a, b) => b.q - a.q || b.stars - a.stars);
    this.wornCount = Object.keys(store.getState().equips).length - this.list.length;
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
      text: '装备 ' + this.list.length, style: this.section === 'equips' ? 'gold' : 'ghost', id: 'bag-equips',
      cb: () => { this.section = 'equips'; }
    });
    if (this.section === 'resources') this.drawResources();
    else this.drawEquips();
  },

  drawResources() {
    const y = 130, cardH = 118, gap = 10, w = (app.W - 42) / 2;
    const contentH = 3 * (cardH + gap) + 28;
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

  drawEquips() {
    const y = 130, w = app.W - 32;
    ui.panel(16, y, w, 84, { ornate: true });
    ui.text('闲置 ' + this.list.length + ' 件 · 已穿戴 ' + this.wornCount + ' 件', 28, y + 14, { size: 13, bold: true });
    ui.text('穿戴、强化和分解均在铁匠铺操作', 28, y + 58, { size: 11, color: T.DIM });
    ui.btn(app.W - 116, y + 10, 88, 34, {
      text: '去铁匠铺', style: 'gold', size: 12, id: 'bag-forge', cb: () => app.push('forge')
    });
    const listY = y + 98, viewH = Math.max(1, app.H - listY - 64);
    const contentH = this.list.length ? this.list.length * 76 : 180;
    ui.beginScroll(this, 'equips', 12, listY, app.W - 24, viewH, contentH);
    if (!this.list.length) {
      ui.panel(16, listY, w, 170);
      ui.text('暂无闲置装备', app.W / 2, listY + 28, { size: 17, color: T.GOLD_HI, align: 'center', bold: true });
      ui.text(this.wornCount ? '已穿戴的装备可在英雄详情中查看' : '出征战役，获胜后有机会掉落装备', app.W / 2, listY + 62, { size: 12, color: T.DIM, align: 'center' });
      ui.btn((app.W - 144) / 2, listY + 104, 144, 36, {
        text: this.wornCount ? '查看英雄' : '返回主城出征', style: 'ghost', id: 'bag-empty',
        cb: () => app.switchTab(this.wornCount ? 'heroes' : 'home')
      });
    }
    this.list.forEach((e, i) => {
      const cy = listY + i * 76, q = items.EQUIP_QUALITIES[e.q], slot = items.EQUIP_SLOTS[e.slot];
      const stats = items.equipStat(e.q, e.slot, e.stars, false);
      const statText = [stats.atk ? '攻击 +' + stats.atk : '', stats.hp ? '生命 +' + stats.hp : '', stats.def ? '防御 +' + stats.def : ''].filter(Boolean).join('  ');
      ui.panel(16, cy, w, 68);
      ui.text(q.name + ' ' + q.label + slot.name, 28, cy + 12, { size: 14, color: q.color, bold: true });
      ui.text((e.stars || 0) + ' 星', app.W - 28, cy + 12, { size: 12, color: T.GOLD, align: 'right' });
      ui.text(statText, 28, cy + 38, { size: 11, color: T.DIM });
      if (e.faction && T.FACTION[e.faction]) ui.text(T.FACTION[e.faction].name + '阵营', app.W - 28, cy + 38, { size: 11, color: T.FACTION[e.faction].color, align: 'right' });
    });
    ui.endScroll();
  }
};
