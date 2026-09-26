// 铁匠铺：装备背包、强化、分解、穿戴
const store = require('../../utils/store');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

const SLOT_FILTERS = [
  { key: 'all', name: '全部' },
  { key: 'weapon', name: '兵刃' },
  { key: 'armor', name: '铠甲' },
  { key: 'helm', name: '头盔' },
  { key: 'boots', name: '战靴' }
];

Page({
  data: {
    goldText: '',
    filter: 'all', filters: SLOT_FILTERS,
    list: [],
    showHero: false, wearId: '', heroes: [],
    toast: ''
  },
  onShow() { this.refresh(); },
  onHide() { store.save(); },

  refresh() {
    const s = store.getState();
    const inv = store.equipInventory().map(e => this.view(e));
    const filtered = this.data.filter === 'all' ? inv : inv.filter(x => x.slot === this.data.filter);
    this.setData({
      goldText: F.fmtNum(s.res.gold),
      list: filtered.sort((a, b) => b.tier - a.tier || b.enh - a.enh)
    });
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
  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key });
    this.refresh();
  },
  enhance(e) {
    const r = store.enhanceEquip(e.currentTarget.dataset.id);
    if (!r.ok) { this.toast(r.msg); return; }
    this.toast('强化成功 +' + r.enh);
    this.refresh();
  },
  salvage(e) {
    const r = store.salvageEquip(e.currentTarget.dataset.id);
    if (!r.ok) { this.toast(r.msg); return; }
    this.toast('分解得铜钱 ' + F.fmtNum(r.gold));
    this.refresh();
  },
  openWear(e) {
    const inst = store.getState().equips[e.currentTarget.dataset.id];
    if (!inst) return;
    this.setData({
      showHero: true, wearId: inst.id, wearSlot: inst.slot,
      heroes: store.allRoster().sort((a, b) => b.power - a.power)
    });
  },
  closeHero() { this.setData({ showHero: false }); },
  pickHero(e) {
    const hero = e.detail.hero;
    store.equipTo(hero.id, this.data.wearSlot, this.data.wearId);
    this.setData({ showHero: false });
    this.toast('已给 ' + hero.name + ' 穿戴');
    this.refresh();
  }
});
