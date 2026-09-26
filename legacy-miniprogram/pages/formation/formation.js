// 编队：前 3 后 2 槽位，阵营加成，一键最强
const store = require('../../utils/store');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

Page({
  data: {
    slots: [],           // [{calc|null, row}]
    power: 0, powerText: '',
    bonus: { hp: 0, atk: 0 }, bonusText: '',
    showPicker: false, pickSlot: -1,
    candidates: [],
    toast: ''
  },
  onShow() {
    this.refresh();
  },
  onHide() { store.save(); },
  onUnload() { store.save(); },

  refresh() {
    const calc = store.getFormationCalc();
    const { bonus } = store.formationFactionBonus();
    const power = store.teamPower();
    const rows = [0, 1];
    this.setData({
      slots: calc.map((x, i) => ({ calc: x, row: i <= 2 ? 0 : 1, slot: i })),
      power,
      powerText: F.fmtNum(power),
      bonusText: bonus.atk > 0 ? '同阵营 ×' + (bonus.atk >= 0.18 ? 5 : bonus.atk >= 0.12 ? 4 : 3) + '：攻击/生命 +' + Math.round(bonus.atk * 100) + '%' : '同阵营 3/4/5 人可激活全队加成'
    });
  },
  toast(msg) {
    this.setData({ toast: msg });
    setTimeout(() => this.setData({ toast: '' }), 1600);
  },
  tapSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    const cur = store.getState().formation[slot];
    if (cur && this.data.pickSlot !== slot) {
      // 第一次点：卸下；长按/再点选择其他人 — 简化为弹出选择（含"卸下"）
      this.setData({ showPicker: true, pickSlot: slot, candidates: this.buildCandidates() });
      return;
    }
    this.setData({ showPicker: true, pickSlot: slot, candidates: this.buildCandidates() });
  },
  buildCandidates() {
    const s = store.getState();
    const formed = new Set(s.formation);
    return store.allRoster()
      .filter(h => !formed.has(h.id))
      .sort((a, b) => b.power - a.power)
      .map(h => ({ ...h, marked: '' }));
  },
  pickHero(e) {
    const id = e.detail.hero.id;
    store.setFormationSlot(this.data.pickSlot, id);
    this.setData({ showPicker: false, pickSlot: -1 });
    this.refresh();
  },
  emptySlot() {
    store.setFormationSlot(this.data.pickSlot, null);
    this.setData({ showPicker: false, pickSlot: -1 });
    this.refresh();
  },
  closePicker() { this.setData({ showPicker: false, pickSlot: -1 }); },
  autoBest() {
    // 按战力取前 5，猛将优先前排
    const all = store.allRoster().slice().sort((a, b) => b.power - a.power).slice(0, 5);
    const front = all.filter(h => h.cls === 'tank').slice(0, 3);
    const rest = all.filter(h => front.indexOf(h) < 0);
    const order = [];
    for (let i = 0; i < 3; i++) order.push(front[i] || rest.shift() || null);
    for (let i = 0; i < 2; i++) order.push(rest.shift() || null);
    order.forEach((h, i) => store.setFormationSlot(i, h ? h.id : null));
    this.toast('已一键布阵');
    this.refresh();
  }
});
