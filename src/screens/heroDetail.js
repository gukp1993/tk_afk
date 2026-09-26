// 武将详情：属性/技能/装备/升级/升阶/上阵/遣散/重置
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

module.exports = {
  name: 'heroDetail',
  scroll: {}, scrollReg: {},
  pickEquipSlot: null,
  showDismiss: false,

  onEnter() { this.refresh(); },
  refresh() {
    const id = this.params.id;
    const calc = store.calcHero(id);
    if (!calc) { app.pop(); return; }
    const def = heroes.getHero(id);
    const own = store.getState().roster[id];
    const maxStar = C.RARITIES[def.rarity].maxStar;
    const s = store.getState();
    this.v = {
      calc, def, own, maxStar,
      critText: Math.round((calc.stats.crit || 0.05) * 100) + '%',
      inFormation: s.formation.indexOf(id) >= 0,
      isTop5: store.crystalInfo().top5.some(t => t.id === id),
      effNote: calc.level > own.lv ? '共鸣等级生效中' : '',
      asc: own.star < maxStar ? C.ASCEND_COST[own.star] : null,
      foodPts: store.foodPoints(id)
    };
  },

  update() { if (!this.v) this.refresh(); },

  draw() {
    app.pageHeader('武 将');
    if (!this.v) return;
    const { calc, def, own } = this.v;
    const scrollId = 'page';
    ui.beginScroll(this, scrollId, 0, 42, app.W, app.H - 42, this.contentH || 800);
    let y = 54;

    // 头部名片
    ui.panel(8, y, 359, 96, { ornate: true });
    ui.heroFace(18, y + 8, 80, calc, { mark: this.v.isTop5 ? '共鸣' : null });
    ui.text(def.name, 108, y + 8, { size: 20, bold: true });
    ui.text(T.RARITY[def.rarity].name, 108 + ui.textWidth(def.name, 20, true) + 8, y + 11, { size: 13, color: T.RARITY[def.rarity].color, bold: true });
    ui.text(def.title + ' · ' + T.FACTION[def.faction].name + ' · ' + ui.classNameOf(def.cls), 108, y + 34, { size: 11, color: T.DIM });
    ui.stars(108, y + 48, this.v.maxStar, own.star, 11);
    ui.text('Lv.' + calc.level + (this.v.effNote ? '  (' + this.v.effNote + ')' : ''), 108, y + 62, { size: 12 });
    ui.text('战力 ' + F.fmtNum(calc.power), 108, y + 78, { size: 12, color: T.GOLD });
    y += 104;

    // 属性
    this.secTitle('属 性', y); y += 24;
    ui.panel(8, y, 359, 62);
    const stats = [['生命', calc.stats.hp], ['攻击', calc.stats.atk], ['防御', calc.stats.def],
      ['攻速', calc.stats.spd], ['暴击', this.v.critText], ['同名卡', own.cards + '张']];
    stats.forEach((st, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const sx = 20 + col * 118, sy = y + 10 + row * 26;
      ui.text(st[0], sx, sy, { size: 12, color: T.DIM });
      ui.text('' + st[1], sx + 44, sy, { size: 12 });
    });
    y += 72;

    // 技能
    this.secTitle('技 能', y); y += 24;
    ui.panel(8, y, 359, 54);
    ui.tag('必杀', 20, y + 8, T.GOLD_HI);
    ui.text(def.ult.name, 56, y + 8, { size: 13, color: T.GOLD, bold: true });
    ui.wrap(def.ult.desc, 20, y + 26, 330, 12, { size: 10 });
    y += 62;
    ui.panel(8, y, 359, 54);
    ui.tag('被动', 20, y + 8, T.DIM);
    ui.text(def.passive.name, 56, y + 8, { size: 13, color: T.GOLD, bold: true });
    ui.wrap(def.passive.desc, 20, y + 26, 330, 12, { size: 10 });
    y += 62;

    // 装备
    this.secTitle('装 备（点穿戴/卸下）', y); y += 24;
    const ew = (359 - 3 * 8) / 4;
    ['weapon', 'armor', 'helm', 'boots'].forEach(slot => {
      const instId = own.equip[slot];
      const inst = instId ? store.getState().equips[instId] : null;
      const ex = 8 + ['weapon', 'armor', 'helm', 'boots'].indexOf(slot) * (ew + 8);
      ui.panel(ex, y, ew, 58, inst ? {} : { fill: 'rgba(0,0,0,0.2)' });
      ui.tap(ex, y, ew, 58, () => this.tapEquip(slot), 'eq-' + slot);
      const names = { weapon: '兵刃⚔', armor: '铠甲🛡', helm: '头盔⛑', boots: '战靴👟' };
      if (inst) {
        const tier = items.EQUIP_TIERS[inst.tier - 1];
        ui.text(names[slot].slice(-1), ex + ew / 2, y + 4, { size: 16, align: 'center' });
        ui.text(tier.name + (inst.enh > 0 ? '+' + inst.enh : ''), ex + ew / 2, y + 26, { size: 10, color: tier.color, align: 'center', bold: true });
        const stText = this.statText(items.equipStat(inst.tier, inst.slot, inst.enh));
        ui.text(stText, ex + ew / 2, y + 40, { size: 9, color: T.DIM, align: 'center' });
      } else {
        ui.text(names[slot].slice(-1), ex + ew / 2, y + 4, { size: 16, color: T.DIM, align: 'center' });
        ui.text(names[slot].slice(0, -1), ex + ew / 2, y + 26, { size: 10, color: T.DIM, align: 'center' });
        ui.text('空', ex + ew / 2, y + 40, { size: 9, color: T.DIM, align: 'center' });
      }
    });
    y += 68;

    // 养成
    this.secTitle('养 成', y); y += 24;
    ui.panel(8, y, 359, 150);
    ui.btn(20, y + 10, 108, 30, { text: '升 级', style: 'gold', size: 13, id: 'lv1', cb: () => this.doLevel(1) });
    ui.btn(136, y + 10, 108, 30, { text: '升级 ×10', style: 'gold', size: 13, id: 'lv10', cb: () => this.doLevel(10) });
    ui.btn(252, y + 10, 100, 30, { text: '重 置', style: 'ghost', size: 13, disabled: own.lv < 2, id: 'reset', cb: () => this.doReset() });
    if (this.v.asc) {
      const a = this.v.asc;
      ui.wrap('升阶至 ★' + (own.star + 1) + '：同名卡 ' + a.same + ' 张 · 兵魂点 ' + this.v.foodPts + '/' + a.food + ' · 铜钱 ' + F.fmtNum(a.gold), 20, y + 50, 330, 12, { size: 10 });
      ui.btn(20, y + 76, 332, 30, {
        text: '升  阶', style: 'gold', size: 14, id: 'asc',
        disabled: !(own.cards >= a.same && this.v.foodPts >= a.food && store.getState().res.gold >= a.gold),
        cb: () => {
          const r = store.ascend(this.params.id);
          if (!r.ok) ui.toast(r.msg); else ui.toast('升阶成功！当前 ★' + r.star);
          this.refresh();
        }
      });
    } else {
      ui.text('已达最高品阶 ★' + this.v.maxStar, 20, y + 56, { size: 11, color: T.DIM });
    }
    ui.btn(20, y + 114, 160, 28, {
      text: this.v.inFormation ? '下 阵' : '上 阵', style: this.v.inFormation ? 'ghost' : 'gold', size: 13,
      id: 'form', cb: () => this.toggleFormation()
    });
    ui.btn(192, y + 114, 160, 28, { text: '遣 散', style: 'red', size: 13, id: 'dismiss', cb: () => { this.showDismiss = true; } });
    y += 160;
    this.contentH = y + 20;

    ui.endScroll();

    // 装备选择弹窗
    if (this.pickEquipSlot) this.drawEquipPicker();
    if (this.showDismiss) this.drawDismiss();
  },
  secTitle(t, y) {
    const ctx = ui.ctx;
    ctx.save();
    ctx.fillStyle = T.GOLD_DEEP;
    ctx.fillRect(8, y + 3, 3, 12);
    ui.text(t, 16, y + 2, { size: 13, color: T.GOLD, bold: true });
    ctx.restore();
  },
  statText(add) {
    const p = [];
    if (add.atk) p.push('攻+' + add.atk);
    if (add.hp) p.push('血+' + add.hp);
    if (add.def) p.push('防+' + add.def);
    return p.join(' ') || '—';
  },
  doLevel(n) {
    const done = store.levelUp(this.params.id, n);
    if (!done) {
      const own = store.getState().roster[this.params.id];
      ui.toast(own.lv >= store.levelCap(this.params.id) ? '已达品阶等级上限，先升阶' : '铜钱或兵书不足');
    } else ui.toast('升级 ×' + done);
    this.refresh();
  },
  doReset() {
    const r = store.resetHero(this.params.id);
    if (!r.ok) ui.toast(r.msg);
    else ui.toast('已重置，返还铜钱 ' + F.fmtNum(r.gold));
    this.refresh();
  },
  toggleFormation() {
    const id = this.params.id;
    const f = store.getState().formation;
    const idx = f.indexOf(id);
    if (idx >= 0) {
      if (f.filter(x => x).length <= 1) { ui.toast('至少保留一名上阵武将'); return; }
      store.setFormationSlot(idx, null);
      ui.toast('已下阵');
    } else {
      const empty = f.indexOf(null);
      if (empty < 0) { ui.toast('编队已满，请先调整'); app.push('formation'); return; }
      store.setFormationSlot(empty, id);
      ui.toast('已上阵');
    }
    this.refresh();
  },
  tapEquip(slot) {
    const own = store.getState().roster[this.params.id];
    if (own.equip[slot]) {
      store.unequip(this.params.id, slot);
      ui.toast('已卸下');
      this.refresh();
      return;
    }
    const list = store.equipInventory().filter(x => x.slot === slot);
    if (!list.length) { ui.toast('背包暂无该部位装备，出征可得'); return; }
    this.pickEquipSlot = slot;
    this.pickList = list.slice().sort((a, b) => b.tier - a.tier);
  },
  drawEquipPicker() {
    const box = ui.modal('选 择 装 备', 50, 160, 275, 380);
    ui.setModalClose(() => { this.pickEquipSlot = null; });
    ui.tap(0, 0, app.W, app.H, () => { this.pickEquipSlot = null; }, 'eq-mask');
    ui.beginScroll(this, 'eqpick', box.x, box.y, box.w, box.h, this.pickList.length * 36);
    this.pickList.forEach((e, i) => {
      const tier = items.EQUIP_TIERS[e.tier - 1];
      const y = box.y + i * 36;
      ui.text(tier.name + (e.enh > 0 ? ' +' + e.enh : ''), box.x, y, { size: 12, color: tier.color, bold: true });
      ui.text(this.statText(items.equipStat(e.tier, e.slot, e.enh)), box.x + box.w, y, { size: 11, color: T.DIM, align: 'right' });
      ui.tap(box.x, y - 4, box.w, 34, () => {
        store.equipTo(this.params.id, this.pickEquipSlot, e.id);
        this.pickEquipSlot = null;
        ui.toast('已装备');
        this.refresh();
      }, 'eqpick-' + e.id);
    });
    ui.endScroll();
  },
  drawDismiss() {
    const box = ui.modal('遣 散 武 将', 50, 220, 275, 150);
    ui.setModalClose(() => { this.showDismiss = false; });
    ui.wrap('遣散后该武将离队（编队中不可遣散），按品质返还英雄碎片与铜钱。确定？', box.x, box.y, box.w, 14, { size: 11 });
    ui.btn(box.x, box.y + 62, 120, 28, { text: '取消', style: 'ghost', size: 13, id: 'dk-no', cb: () => { this.showDismiss = false; } });
    ui.btn(box.x + 130, box.y + 62, 120, 28, {
      text: '确定遣散', style: 'red', size: 13, id: 'dk-yes',
      cb: () => {
        const r = store.dismiss(this.params.id);
        if (!r.ok) { ui.toast(r.msg); return; }
        this.showDismiss = false;
        ui.toast('遣散成功');
        app.pop();
      }
    });
  }
};
