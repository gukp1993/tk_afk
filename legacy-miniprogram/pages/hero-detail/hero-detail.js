// 武将详情：属性、技能、升级、升阶、装备、上阵、遣散、重置
const store = require('../../utils/store');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

Page({
  data: {
    id: '', v: null,
    starArr: [],
    asc: null,            // 升阶消耗视图
    foodPts: 0,
    equipViews: [],       // 四槽
    showPick: false, pickSlot: '', pickList: [],
    showPickHero: false, pickHeroList: [], pickRarity: 0,
    toast: ''
  },
  onLoad(options) {
    this.setData({ id: options.id });
  },
  onShow() { this.refresh(); },
  onHide() { store.save(); },
  onUnload() { store.save(); },

  refresh() {
    const id = this.data.id;
    const calc = store.calcHero(id);
    if (!calc) { wx.navigateBack(); return; }
    const def = heroes.getHero(id);
    const own = store.getState().roster[id];
    const maxStar = C.RARITIES[def.rarity].maxStar;
    const cost = own.star < maxStar ? C.ASCEND_COST[own.star] : null;
    const s = store.getState();
    this.setData({
      v: {
        ...calc,
        rarityName: C.RARITIES[def.rarity].name,
        campName: C.FACTIONS[def.faction].name,
        clsName: C.CLASSES[def.cls].name,
        critText: Math.round((calc.stats.crit || 0.05) * 100) + '%',
        inFormation: s.formation.indexOf(id) >= 0,
        isTop5: store.crystalInfo().top5.some(t => t.id === id),
        effNote: calc.level > own.lv ? '共鸣等级生效中' : '',
        realLv: own.lv
      },
      starArr: [1, 2, 3, 4, 5].map(i => (i <= own.star ? 2 : (i <= maxStar ? 1 : 0))),
      asc: cost ? {
        same: cost.same, food: cost.food, gold: F.fmtNum(cost.gold),
        hasSame: own.cards >= cost.same,
        hasFood: store.foodPoints(id) >= cost.food,
        hasGold: s.res.gold >= cost.gold,
        foodPts: store.foodPoints(id)
      } : null,
      foodPts: store.foodPoints(id),
      equipViews: ['weapon', 'armor', 'helm', 'boots'].map(slot => {
        const instId = own.equip[slot];
        const inst = instId ? s.equips[instId] : null;
        return {
          slot, name: items.EQUIP_SLOTS[slot].name, icon: items.EQUIP_SLOTS[slot].icon,
          inst: inst ? {
            ...inst,
            tierName: items.EQUIP_TIERS[inst.tier - 1].name,
            color: items.EQUIP_TIERS[inst.tier - 1].color,
            statText: this.statText(items.equipStat(inst.tier, inst.slot, inst.enh))
          } : null
        };
      })
    });
  },
  statText(add) {
    const parts = [];
    if (add.atk) parts.push('攻+' + add.atk);
    if (add.hp) parts.push('血+' + add.hp);
    if (add.def) parts.push('防+' + add.def);
    return parts.join(' ');
  },
  toast(msg) {
    this.setData({ toast: msg });
    setTimeout(() => this.setData({ toast: '' }), 1600);
  },

  levelUp1() { this.doLevel(1); },
  levelUp10() { this.doLevel(10); },
  doLevel(n) {
    const done = store.levelUp(this.data.id, n);
    if (done === 0) {
      const own = store.getState().roster[this.data.id];
      if (own.lv >= store.levelCap(this.data.id)) this.toast('已达品阶等级上限，先升阶吧');
      else this.toast('铜钱或兵书不足');
    } else {
      this.toast('升级 ×' + done);
    }
    this.refresh();
  },
  ascend() {
    const r = store.ascend(this.data.id);
    if (!r.ok) { this.toast(r.msg); return; }
    this.toast('升阶成功！当前 ★' + r.star);
    this.refresh();
  },
  formationToggle() {
    const id = this.data.id;
    const f = store.getState().formation;
    const idx = f.indexOf(id);
    if (idx >= 0) {
      // 下阵：保证至少一人
      if (f.filter(x => x).length <= 1) { this.toast('至少保留一名上阵武将'); return; }
      store.setFormationSlot(idx, null);
      this.toast('已下阵');
    } else {
      const empty = f.indexOf(null);
      if (empty < 0) { this.toast('编队已满，请先调整'); wx.navigateTo({ url: '/pages/formation/formation' }); return; }
      store.setFormationSlot(empty, id);
      this.toast('已上阵');
    }
    this.refresh();
  },
  resetHero() {
    const r = store.resetHero(this.data.id);
    if (!r.ok) { this.toast(r.msg); return; }
    this.toast('已重置，返还铜钱 ' + F.fmtNum(r.gold));
    this.refresh();
  },
  openDismiss() { this.setData({ showDismiss: true }); },
  closeDismiss() { this.setData({ showDismiss: false }); },
  confirmDismiss() {
    const r = store.dismiss(this.data.id);
    if (!r.ok) { this.toast(r.msg); return; }
    this.setData({ showDismiss: false });
    this.toast('遣散成功');
    setTimeout(() => wx.navigateBack(), 600);
  },

  // 装备
  tapEquip(e) {
    const slot = e.currentTarget.dataset.slot;
    const own = store.getState().roster[this.data.id];
    if (own.equip[slot]) {
      store.unequip(this.data.id, slot);
      this.toast('已卸下');
      this.refresh();
      return;
    }
    const list = store.equipInventory().filter(x => x.slot === slot);
    if (!list.length) { this.toast('背包暂无该部位装备，出征可得'); return; }
    this.setData({
      showPick: true, pickSlot: slot,
      pickList: list.map(x => ({
        ...x,
        tierName: items.EQUIP_TIERS[x.tier - 1].name,
        color: items.EQUIP_TIERS[x.tier - 1].color,
        statText: this.statText(items.equipStat(x.tier, x.slot, x.enh))
      })).sort((a, b) => b.tier - a.tier)
    });
  },
  closePick() { this.setData({ showPick: false }); },
  pickEquip(e) {
    store.equipTo(this.data.id, this.data.pickSlot, e.currentTarget.dataset.id);
    this.setData({ showPick: false });
    this.toast('已装备');
    this.refresh();
  },

  toastFix() {},
  noop() {}
});
