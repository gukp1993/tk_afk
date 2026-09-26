// 铁匠铺：装备背包、升星强化（吃装备攒强化点）、分解、穿戴
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

const SLOT_FILTERS = [
  { key: 'all', name: '全部' }, { key: 'weapon', name: '兵刃' }, { key: 'armor', name: '铠甲' },
  { key: 'helm', name: '头盔' }, { key: 'boots', name: '战靴' }
];
const Q_FILTERS = [
  { key: 0, name: '全部' }, { key: 1, name: 'N' }, { key: 2, name: 'R' }, { key: 3, name: 'SR' }, { key: 4, name: 'SSR' }
];

module.exports = {
  name: 'forge',
  scroll: {}, scrollReg: {},
  filter: 'all', qFilter: 0,
  showHero: false, wearId: null, wearSlot: null,
  showFodder: false, targetId: null, picked: {}, fodderList: [],

  onEnter() { this.refresh(); },
  refresh() {
    const inv = store.equipInventory().map(e => this.view(e));
    this.list = inv
      .filter(x => this.filter === 'all' || x.slot === this.filter)
      .filter(x => !this.qFilter || x.q === this.qFilter)
      .sort((a, b) => b.q - a.q || b.stars - a.stars);
    this.gold = F.fmtNum(store.getState().res.gold);
    this.nCount = inv.filter(x => x.q === 1 && !x.stars).length;
    if (this.showFodder) this.refreshFodder();
  },
  view(e) {
    const Q = items.EQUIP_QUALITIES[e.q];
    const maxed = e.stars >= Q.maxStar;
    const need = maxed ? 0 : items.starNeed(e.q, e.stars);
    return {
      ...e,
      qName: Q.name, label: Q.label, color: Q.color, maxStar: Q.maxStar, maxed, need,
      goldCost: maxed ? 0 : items.starGold(need),
      fPts: items.fodderPoints(e),
      slotName: items.EQUIP_SLOTS[e.slot].name,
      icon: items.EQUIP_SLOTS[e.slot].icon,
      statText: this.statText(items.equipStat(e.q, e.slot, e.stars, false)),
      salvage: F.fmtNum(Math.floor(items.fodderPoints(e) * items.GOLD_PER_POINT * 0.4))
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
    y += 26;
    x = 8;
    Q_FILTERS.forEach(f => {
      const w = ui.textWidth(f.name, 11) + 20;
      ui.chipBtn(x, y, w, 20, f.name, this.qFilter === f.key, () => { this.qFilter = f.key; this.refresh(); }, 'qf-' + f.key);
      x += w + 6;
    });
    // 批量分解 N 品 0 星（减负：白装洪水的快速出口）
    const snName = '分解白装 ' + this.nCount;
    const snW = ui.textWidth(snName, 11) + 20;
    ui.chipBtn(367 - snW, y, snW, 20, snName, false, () => {
      if (!this.nCount) { ui.toast('没有可分解的白装'); return; }
      const r = store.salvageBatch(1);
      ui.toast('分解 ' + r.count + ' 件 · 得铜钱 ' + F.fmtNum(r.gold));
      this.refresh();
    }, 'salvage-n');
    y += 32;

    const contentH = this.list.length * 62;
    ui.beginScroll(this, 'inv', 8, y, 359, app.H - y - 8, contentH);
    this.list.forEach((e, i) => this.drawCard(e, y + i * 62));
    if (!this.list.length) ui.text('背包空空如也 · 出征战役可获装备', 187, y + 60, { size: 12, color: T.DIM, align: 'center' });
    ui.endScroll();

    if (this.showHero) this.drawHeroPicker();
    if (this.showFodder) this.drawFodderPicker();
  },
  drawCard(e, ey) {
    ui.panel(8, ey, 359, 56);
    ui.text(e.icon, 20, ey + 8, { size: 18 });
    // 名称道（品质色，限宽 ~100px）；阵营字固定右对齐 x150，不随名称/星数浮动
    ui.text(e.qName + ' ' + e.slotName, 50, ey + 8, { size: 13, color: e.color, bold: true });
    if (e.faction) ui.text(C.FACTIONS[e.faction].name, 150, ey + 9, { size: 11, color: C.FACTIONS[e.faction].color, align: 'right' });
    // 属性道：属性（灰）在前，星级（金）随后，互不挤压
    ui.text(e.statText, 50, ey + 27, { size: 10, color: T.DIM });
    if (e.stars > 0) ui.text('★'.repeat(e.stars), 50 + ui.textWidth(e.statText, 10) + 6, ey + 28, { size: 10, color: T.GOLD });
    // 操作：升星（吃装备）/ 穿戴 / 分解
    ui.btn(158, ey + 8, 92, 17, {
      text: e.maxed ? '已满星' : '升星 ' + F.fmtNum(e.goldCost), style: 'gold', size: 9, disabled: e.maxed,
      id: 'enh-' + e.id,
      cb: () => { this.openFodder(e.id); }
    });
    ui.btn(158, ey + 30, 92, 17, {
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
  },

  // ---- 升星弹窗：选狗粮攒强化点 ----
  openFodder(instId) {
    this.showFodder = true;
    this.targetId = instId;
    this.picked = {};
    this.refreshFodder();
  },
  refreshFodder() {
    const t = this.target();
    if (!t) { this.showFodder = false; this.targetId = null; this.fodderList = []; return; }
    this.fodderList = store.equipInventory()
      .filter(x => x.id !== this.targetId)
      .map(x => ({ ...x, pts: items.fodderPoints(x) }))
      .sort((a, b) => a.pts - b.pts || a.q - b.q);
  },
  target() {
    const e = store.getState().equips[this.targetId];
    return e ? this.view(e) : null;
  },
  pickedPts() {
    return this.fodderList.reduce((s, x) => s + (this.picked[x.id] ? x.pts : 0), 0);
  },
  drawFodderPicker() {
    const t = this.target();
    if (!t) { this.showFodder = false; return; }
    const box = ui.modal('升 星', 24, 140, 327, 560);
    ui.setModalClose(() => { this.showFodder = false; this.targetId = null; });
    ui.tap(0, 0, app.W, app.H, () => { this.showFodder = false; this.targetId = null; }, 'fodder-mask');

    const pts = this.pickedPts();
    const enough = pts >= t.need;
    // 目标与进度
    ui.text(t.qName + ' ' + t.slotName, box.x + 8, box.y + 2, { size: 14, color: t.color, bold: true });
    ui.text((t.stars ? '★'.repeat(t.stars) + ' ' : '') + '→ ★' + (t.stars + 1), box.x + box.w - 8, box.y + 4, { size: 12, color: T.GOLD, align: 'right' });
    ui.text('强化点 ' + pts + '/' + t.need + ' · 铜钱 ' + F.fmtNum(t.goldCost), box.x + 8, box.y + 24, { size: 11, color: enough ? T.GOLD : T.DIM });
    // 操作行
    ui.btn(box.x + 8, box.y + 44, 108, 22, {
      text: '一键放入', style: 'ghost', size: 11, id: 'fodder-auto',
      cb: () => {
        this.picked = {};
        store.fodderPickIds(this.targetId, this.fodderList.map(x => x.id)).forEach(id => { this.picked[id] = true; });
      }
    });
    ui.btn(box.x + box.w - 8 - 150, box.y + 44, 150, 22, {
      text: '确认强化', style: 'gold', size: 11, disabled: !enough, id: 'fodder-ok',
      cb: () => {
        const r = store.enhanceEquip(this.targetId, Object.keys(this.picked));
        if (!r.ok) ui.toast(r.msg);
        else ui.toast('升星成功 ★' + r.stars);
        this.showFodder = false; this.targetId = null;
        this.refresh();
      }
    });
    // 狗粮列表
    const ly = box.y + 74, lh = box.h - 82;
    ui.beginScroll(this, 'fodder', box.x + 4, ly, box.w - 8, lh, this.fodderList.length * 42);
    this.fodderList.forEach((e, i) => {
      const ry = ly + i * 42;
      const on = !!this.picked[e.id];
      ui.panel(box.x + 4, ry, box.w - 8, 38, on ? { fill: 'rgba(240,185,94,0.14)' } : {});
      ui.text(on ? '✓' : '·', box.x + 14, ry + 10, { size: 14, color: on ? T.GOLD : T.DIM, bold: true });
      const Q = items.EQUIP_QUALITIES[e.q];
      let tx = box.x + 32;
      const head = Q.name + ' ' + items.EQUIP_SLOTS[e.slot].name;
      ui.text(head, tx, ry + 10, { size: 12, color: Q.color, bold: true });
      tx += ui.textWidth(head, 12, true);
      if (e.stars > 0) {
        const st = ' ' + '★'.repeat(e.stars);
        ui.text(st, tx, ry + 11, { size: 10, color: T.GOLD });
        tx += ui.textWidth(st, 10);
      }
      if (e.faction) {
        ui.text(' ' + C.FACTIONS[e.faction].name, tx, ry + 11, { size: 10, color: C.FACTIONS[e.faction].color });
      }
      ui.text('+' + e.pts + '点', box.x + box.w - 16, ry + 11, { size: 11, color: T.DIM, align: 'right' });
      ui.tap(box.x + 4, ry, box.w - 8, 40, () => {
        if (this.picked[e.id]) delete this.picked[e.id];
        else this.picked[e.id] = true;
      }, 'fod-' + e.id);
    });
    if (!this.fodderList.length) ui.text('没有可消耗的装备 · 出征可得', box.x + box.w / 2, ly + 40, { size: 11, color: T.DIM, align: 'center' });
    ui.endScroll();
  },

  // ---- 穿戴选人 ----
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
      ui.panel(x, y, cw, chh, { ornate: h.rarity === 4 });
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
