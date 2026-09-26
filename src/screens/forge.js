// 铁匠铺：装备背包、强化、分解、穿戴
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

const SLOT_FILTERS = [
  { key: 'all', name: '全部' }, { key: 'weapon', name: '兵刃' }, { key: 'armor', name: '铠甲' },
  { key: 'helm', name: '头盔' }, { key: 'boots', name: '战靴' }
];

module.exports = {
  name: 'forge',
  scroll: {}, scrollReg: {},
  filter: 'all',
  showHero: false, wearId: null,

  onEnter() { this.refresh(); },
  refresh() {
    const inv = store.equipInventory().map(e => this.view(e));
    this.list = (this.filter === 'all' ? inv : inv.filter(x => x.slot === this.filter))
      .slice().sort((a, b) => b.tier - a.tier || b.enh - a.enh);
    this.gold = F.fmtNum(store.getState().res.gold);
  },
  view(e) {
    return {
      ...e,
      tierName: items.EQUIP_TIERS[e.tier - 1].name,
      color: items.EQUIP_TIERS[e.tier - 1].color,
      slotName: items.EQUIP_SLOTS[e.slot].name,
      icon: items.EQUIP_SLOTS[e.slot].icon,
      statText: this.statText(items.equipStat(e.tier, e.slot, e.enh)),
      nextCost: F.fmtNum(items.enhanceCost(e.tier, e.enh)),
      maxed: e.enh >= items.MAX_ENH,
      salvage: F.fmtNum(Math.floor(items.enhanceCost(e.tier, 0) * 0.4))
    };
  },
  statText(add) {
    const p = [];
    if (add.atk) p.push('攻+' + add.atk);
    if (add.hp) p.push('血+' + add.hp);
    if (add.def) p.push('防+' + add.def);
    return p.join(' ');
  },

  draw() {
    app.pageHeader('铁 匠 铺');
    app.resBar(48, ['gold']);
    let y = 74;
    let x = 8;
    SLOT_FILTERS.forEach(f => {
      const w = ui.textWidth(f.name, 11) + 20;
      ui.chipBtn(x, y, w, 20, f.name, this.filter === f.key, () => { this.filter = f.key; this.refresh(); }, 'ff-' + f.key);
      x += w + 6;
    });
    y += 28;

    const contentH = this.list.length * 62;
    ui.beginScroll(this, 'inv', 8, y, 359, app.H - y - 8, contentH);
    this.list.forEach((e, i) => {
      const ey = y + i * 62;
      ui.panel(8, ey, 359, 56);
      ui.text(e.icon, 20, ey + 8, { size: 18 });
      ui.text(e.tierName + ' ' + e.slotName, 50, ey + 8, { size: 13, color: e.color, bold: true });
      if (e.enh > 0) ui.text('+' + e.enh, 50 + ui.textWidth(e.tierName + ' ' + e.slotName, 13, true) + 8, ey + 9, { size: 12, color: T.GOLD });
      ui.text(e.statText, 50, ey + 27, { size: 10, color: T.DIM });
      // 三个操作
      const bw = 92;
      ui.btn(158, ey + 8, bw, 17, {
        text: e.maxed ? '已满级' : '强化 ' + e.nextCost, style: 'gold', size: 9, disabled: e.maxed,
        id: 'enh-' + e.id,
        cb: () => {
          const r = store.enhanceEquip(e.id);
          if (!r.ok) ui.toast(r.msg); else ui.toast('强化成功 +' + r.enh);
          this.refresh();
        }
      });
      ui.btn(158, ey + 30, bw, 17, {
        text: '穿戴', style: 'ghost', size: 9, id: 'wear-' + e.id,
        cb: () => { this.showHero = true; this.wearId = e.id; this.wearSlot = e.slot; }
      });
      ui.btn(256, ey + 8, 100, 17, {
        text: '分解 ' + e.salvage, style: 'ghost', size: 9, id: 'sal-' + e.id,
        cb: () => {
          const r = store.salvageEquip(e.id);
          if (!r.ok) ui.toast(r.msg); else ui.toast('分解得铜钱 ' + F.fmtNum(r.gold));
          this.refresh();
        }
      });
    });
    if (!this.list.length) ui.text('背包空空如也 · 出征战役可获装备', 187, y + 60, { size: 12, color: T.DIM, align: 'center' });
    ui.endScroll();

    if (this.showHero) this.drawHeroPicker();
  },
  drawHeroPicker() {
    const list = store.allRoster().slice().sort((a, b) => b.power - a.power);
    const box = ui.modal('穿 戴 给 谁', 40, 130, 295, 460);
    ui.setModalClose(() => { this.showHero = false; });
    ui.tap(0, 0, app.W, app.H, () => { this.showHero = false; }, 'wear-mask');
    const cols = 3, cw = (box.w - 16) / 3, chh = 104;
    const rows = Math.ceil(list.length / cols);
    ui.beginScroll(this, 'wearpick', box.x, box.y, box.w, box.h, rows * (chh + 8));
    list.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = box.x + col * (cw + 8);
      const y = box.y + row * (chh + 8);
      ui.panel(x, y, cw, chh, { ornate: h.rarity === 3 });
      ui.tap(x, y, cw, chh, () => {
        store.equipTo(h.id, this.wearSlot, this.wearId);
        this.showHero = false;
        ui.toast('已给 ' + h.name + ' 穿戴');
        this.refresh();
      }, 'wear-' + h.id);
      ui.heroFace(x + 5, y + 5, cw - 10, h, {});
      ui.text(h.name, x + 5, y + 62, { size: 12, bold: true });
      ui.text('Lv.' + h.level, x + 5, y + 78, { size: 10, color: T.GOLD });
      ui.text('战力 ' + F.fmtNum(h.power), x + cw - 5, y + 90, { size: 8, color: T.DIM, align: 'right' });
    });
    ui.endScroll();
  }
};
