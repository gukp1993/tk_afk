// 武将详情：属性/技能/装备/升星/上阵。等级统一由玩家经验提升。
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const heroes = require('../../utils/heroes');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

module.exports = {
  name: 'heroDetail',
  scroll: {}, scrollReg: {},
  pickEquipSlot: null,
  showConvertConfirm: false,

  onEnter() {
    this.scroll = this.scroll || {};
    this.scroll.page = this.params && this.params.focus === 'ascend' ? 410 : 0;
    this.refresh();
  },
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
      isTop5: false,
      effNote: '共享玩家等级',
      asc: store.ascendPreview(id),
      player: s.player
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
    ui.heroFace(18, y + 8, 80, calc, {});
    ui.text(def.name, 108, y + 8, { size: 20, bold: true });
    ui.text(T.RARITY[def.rarity].name, 108 + ui.textWidth(def.name, 20, true) + 8, y + 11, { size: 13, color: T.RARITY[def.rarity].color, bold: true });
    ui.text(def.title + ' · ' + T.FACTION[def.faction].name + ' · ' + ui.classNameOf(def.cls), 108, y + 34, { size: 11, color: T.DIM });
    ui.stars(108, y + 48, this.v.maxStar, own.star, 11);
    ui.text('全体共享 Lv.' + calc.level, 108, y + 62, { size: 12 });
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

    // 装备采用账号共享配置，新英雄立即获得整队军械属性。
    const armory = store.getArmoryBonuses();
    this.secTitle('全军共享军械', y); y += 24;
    ui.panel(8, y, 359, 64);
    ui.text('攻击 +' + Math.round(armory.atk * 100) + '%   生命 +' + Math.round(armory.hp * 100) + '%   防御 +' + Math.round(armory.def * 100) + '%', 20, y + 12, { size: 11, color: T.GOLD_HI, bold: true });
    ui.text('已享受当前军械，无需为武将单独配装', 20, y + 34, { size: 10, color: T.DIM });
    ui.btn(262, y + 9, 91, 38, { text: '军械图鉴 ›', style: 'ghost', size: 10, id: 'hero-armory', cb: () => app.push('armory') });
    y += 74;

    // 玩家等级由战斗成长；此页只管理武将个人星级。
    this.secTitle('成 长', y); y += 24;
    ui.panel(8, y, 359, 114);
    const xpNeed = store.playerXpNeeded(this.v.player.level);
    ui.text('玩家等级 Lv.' + this.v.player.level + ' · 全体武将共用', 20, y + 10, { size: 12, color: T.GOLD_HI, bold: true });
    ui.bar(20, y + 30, 332, 7, this.v.player.level >= C.MAX_LEVEL ? 1 : this.v.player.exp / xpNeed, 'gold');
    ui.text(this.v.player.level >= C.MAX_LEVEL ? '等级已达上限' : '战斗经验 ' + F.fmtNum(this.v.player.exp) + ' / ' + F.fmtNum(xpNeed), 20, y + 43, { size: 10, color: T.DIM });
    if (this.v.asc && this.v.asc.ok) {
      const a = this.v.asc;
      ui.text('升星 ' + a.from + ' → ' + a.to + ' · 同名卡 ' + a.cards + '/' + a.needCards + ' · 铜钱 ' + F.fmtNum(a.gold) + '/' + F.fmtNum(a.needGold), 20, y + 63, { size: 9, color: T.DIM });
      ui.btn(20, y + 78, 332, 28, { text: '升至 ★' + a.to + '（属性 +' + Math.round((C.STAR_MULT - 1) * 100) + '% / 星）', style: 'gold', size: 12, disabled: !a.can, id: 'asc', cb: () => this.doAscend() });
    } else {
      ui.text('已达最高星级 ★' + this.v.maxStar, 20, y + 72, { size: 11, color: T.DIM });
    }
    y += 122;
    if (own.cards > 0) {
      ui.panel(8, y, 359, 52);
      ui.text('同名卡 ' + own.cards + ' 张' + (own.lockedCards ? ' · 已保护' : ''), 18, y + 10, { size: 11, color: T.GOLD_HI });
      ui.btn(172, y + 9, 82, 30, { text: own.lockedCards ? '取消保护' : '保护', style: 'ghost', size: 10, id: 'card-lock', cb: () => {
        const r = store.setCardsLocked(this.params.id, !own.lockedCards); if (r.ok) this.refresh();
      } });
      const canConvert = own.star >= this.v.maxStar && !own.lockedCards;
      ui.btn(260, y + 9, 94, 30, { text: '换 1 张碎片', style: 'plain', size: 10, disabled: !canConvert, id: 'card-convert', cb: () => this.convertOne() });
      y += 60;
    }
    ui.btn(20, y + 8, 160, 30, {
      text: this.v.inFormation ? '下 阵' : '上 阵', style: this.v.inFormation ? 'ghost' : 'gold', size: 13,
      id: 'form', cb: () => this.toggleFormation()
    });
    y += 42;
    this.contentH = y + 20;

    ui.endScroll();

    if (this.showConvertConfirm) this.drawConvertConfirm();
  },
  secTitle(t, y) {
    const ctx = ui.ctx;
    ctx.save();
    ctx.fillStyle = T.GOLD_DEEP;
    ctx.fillRect(8, y + 3, 3, 12);
    ui.text(t, 16, y + 2, { size: 13, color: T.GOLD, bold: true });
    ctx.restore();
  },
  doAscend() {
    const preview = store.ascendPreview(this.params.id);
    if (!preview.ok || !preview.can) { ui.toast(preview.msg || '同名卡或铜钱不足'); return; }
    const beforePower = store.calcHero(this.params.id).power;
    const r = store.ascend(this.params.id);
    if (!r.ok) ui.toast(r.msg); else {
      const afterPower = store.calcHero(this.params.id).power;
      ui.toast('升至 ★' + r.star + ' · 战力 ' + F.fmtNum(beforePower) + '→' + F.fmtNum(afterPower));
    }
    this.refresh();
  },
  convertOne() {
    const h = this.v.def, own = this.v.own;
    if (own.star < this.v.maxStar || own.lockedCards || own.cards < 1) { ui.toast('仅可兑换未保护的满星多余卡'); return; }
    const run = confirmHigh => {
      const r = store.convertCards([{ id: h.id, count: 1, confirmHigh }]);
      if (!r.ok) { ui.toast(r.msg); return; }
      this.refresh(); ui.toast('获得英雄碎片 ×' + r.shards);
    };
    if (h.rarity >= 3) {
      this.showConvertConfirm = true;
    } else run(false);
  },
  drawConvertConfirm() {
    const h = this.v.def, shards = h.rarity === 4 ? 60 : 15;
    const box = ui.modal('兑换高稀有度同名卡？', 44, 244, 287, 160);
    ui.setModalClose(() => { this.showConvertConfirm = false; });
    ui.wrap('消耗 ' + h.name + ' 1 张，获得英雄碎片 ×' + shards + '。兑换后不能撤回。', box.x, box.y + 6, box.w, 14, { size: 10 });
    ui.btn(box.x, box.y + 78, 124, 30, { text: '取消', style: 'ghost', size: 12, id: 'convert-cancel', cb: () => { this.showConvertConfirm = false; } });
    ui.btn(box.x + 136, box.y + 78, 124, 30, { text: '确认兑换', style: 'red', size: 12, id: 'convert-confirm', cb: () => {
      this.showConvertConfirm = false;
      const r = store.convertCards([{ id: h.id, count: 1, confirmHigh: true }]);
      if (!r.ok) ui.toast(r.msg); else ui.toast('获得英雄碎片 ×' + r.shards);
      this.refresh();
    } });
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
};
