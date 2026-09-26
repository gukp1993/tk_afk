// 编队：前3后2槽位、阵营加成、一键布阵
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const F = require('../../utils/fmt');
const { recommendFormation } = require('../../utils/formation');

module.exports = {
  name: 'formation',
  scroll: {}, scrollReg: {},
  pickSlot: -1,
  recommendOpen: false,

  onEnter() { this.refresh(); },
  refresh() {
    const calc = store.getFormationCalc();
    const { bonus } = store.formationFactionBonus();
    this.slots = calc.map((x, i) => ({ calc: x, row: i <= 2 ? 0 : 1, slot: i }));
    this.power = F.fmtNum(store.teamPower());
    this.bonusText = bonus.atk > 0
      ? '同阵营 ×' + (bonus.atk >= 0.18 ? 5 : bonus.atk >= 0.12 ? 4 : 3) + '：攻击/生命 +' + Math.round(bonus.atk * 100) + '%'
      : '同阵营 3/4/5 人激活全队加成';
  },

  draw() {
    app.pageHeader('编 队');
    let y = 52;
    ui.panel(8, y, 359, 62, { ornate: true });
    ui.text('出征编队', 20, y + 8, { size: 15, color: T.GOLD_HI, bold: true });
    ui.text('总战力 ' + this.power, 20, y + 30, { size: 15, color: T.GOLD });
    ui.text(this.bonusText, 20, y + 48, { size: 10, color: T.DIM });
    ui.btn(272, y + 16, 84, 28, { text: '推荐布阵', style: 'gold', size: 11, id: 'auto', cb: () => { this.recommended = recommendFormation(store.allRoster()); this.recommendOpen = true; } });
    y += 72;

    // 后排
    ui.text('后 排（远程输出 / 辅助）', 187, y, { size: 10, color: T.DIM, align: 'center' });
    y += 16;
    y = this.drawRow(y, 1);
    // 分界线
    const ctx = ui.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(217,169,78,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(60, y + 10); ctx.lineTo(315, y + 10);
    ctx.stroke();
    ctx.restore();
    y += 22;
    ui.text('前 排（承伤 / 近战）', 187, y, { size: 10, color: T.DIM, align: 'center' });
    y += 16;
    y = this.drawRow(y, 0);

    ui.wrap('点击已上阵武将可更换；阵营克制：魏→蜀→吴→群→魏，克制方伤害 +25%。', 24, y + 8, 330, 13, { size: 10 });

    if (this.pickSlot >= 0) this.drawPicker();
    if (this.recommendOpen) this.drawRecommendConfirm();
  },
  drawRow(y, row) {
    const slots = this.slots.filter(s => s.row === row);
    const sw = 96;
    const total = slots.length * sw + (slots.length - 1) * 12;
    let x = (app.W - total) / 2;
    slots.forEach(s => {
      ui.panel(x, y, sw, 86, {});
      ui.tap(x, y, sw, 86, () => { this.pickSlot = s.slot; this.pickerScroll = 0; }, 'slot-' + s.slot);
      if (s.calc) {
        ui.heroFace(x + 8, y + 8, sw - 16, s.calc, {});
        ui.text(s.calc.name, x + sw / 2, y + 58, { size: 12, align: 'center' });
        ui.text('Lv.' + s.calc.level, x + sw / 2, y + 72, { size: 9, color: T.DIM, align: 'center' });
      } else {
        ui.text('+', x + sw / 2, y + 26, { size: 24, color: T.DIM, align: 'center' });
        ui.text('点击上阵', x + sw / 2, y + 60, { size: 10, color: T.DIM, align: 'center' });
      }
      x += sw + 12;
    });
    return y + 94;
  },
  candidates() {
    const formed = new Set(store.getState().formation);
    return store.allRoster().filter(h => !formed.has(h.id)).sort((a, b) => b.power - a.power);
  },
  drawRecommendConfirm() {
    const list = store.allRoster(), byId = {};
    list.forEach(h => { byId[h.id] = h; });
    const ids = this.recommended || [];
    const box = ui.modal('均衡推荐编队', 30, Math.max(90, (app.H - 300) / 2), 315, 300);
    ui.setModalClose(() => { this.recommendOpen = false; });
    ui.wrap('按职业与战力生成建议，可直接应用；不会因抽到新将自动换阵。', box.x, box.y + 2, box.w, 14, { size: 10, color: T.DIM });
    ids.forEach((id, i) => {
      const h = id && byId[id], row = i < 3 ? '前排' : '后排';
      ui.text((i + 1) + '号位 · ' + row + ' · ' + (h ? h.name + '（战力 ' + F.fmtNum(h.power) + '）' : '空位'), box.x + 4, box.y + 54 + i * 28, { size: 10, color: h ? T.TEXT : T.DIM });
    });
    ui.btn(box.x, box.y + 249, 122, 30, { text: '保留当前阵容', style: 'ghost', size: 10, id: 'formation-rec-cancel', cb: () => { this.recommendOpen = false; } });
    ui.btn(box.x + 134, box.y + 249, 170, 30, { text: '应用推荐编队', style: 'gold', size: 10, id: 'formation-rec-apply', disabled: !ids.some(Boolean), cb: () => {
      const r = store.applyFormation(ids);
      if (!r.ok) { ui.toast(r.msg || '推荐应用失败'); return; }
      this.recommendOpen = false; this.refresh(); ui.toast('均衡推荐编队已应用');
    } });
  },
  drawPicker() {
    const list = this.candidates();
    const box = ui.modal('选 择 武 将（' + (this.pickSlot + 1) + '号位）', 30, 120, 315, 470);
    ui.setModalClose(() => { this.pickSlot = -1; });
    ui.tap(0, 0, app.W, app.H, () => { this.pickSlot = -1; }, 'slot-mask');
    ui.btn(box.x, box.y, box.w, 26, {
      text: '卸下该位置', style: 'ghost', size: 12, id: 'slot-empty',
      cb: () => {
        store.setFormationSlot(this.pickSlot, null);
        this.pickSlot = -1;
        this.refresh();
      }
    });
    const cols = 3, cw = (box.w - 16) / 3, chh = 104;
    const rows = Math.ceil(list.length / cols);
    ui.beginScroll(this, 'picker', box.x, box.y + 34, box.w, box.h - 34, rows * (chh + 8));
    list.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = box.x + col * (cw + 8);
      const y = box.y + 34 + row * (chh + 8);
      const maxStar = [0, 2, 3, 4, 5][h.rarity];
      ui.panel(x, y, cw, chh, { ornate: h.rarity === 4 });
      ui.tap(x, y, cw, chh, () => {
        store.setFormationSlot(this.pickSlot, h.id);
        this.pickSlot = -1;
        this.refresh();
      }, 'pick-' + h.id);
      ui.heroFace(x + 5, y + 5, cw - 10, h, {});
      ui.text(h.name, x + 5, y + 62, { size: 12, bold: true });
      ui.text(T.RARITY[h.rarity].name, x + cw - 5, y + 63, { size: 10, color: T.RARITY[h.rarity].color, align: 'right', bold: true });
      ui.text('Lv.' + h.level, x + 5, y + 78, { size: 10, color: T.GOLD });
      ui.text('战力 ' + F.fmtNum(h.power), x + cw - 5, y + 90, { size: 8, color: T.DIM, align: 'right' });
    });
    if (!list.length) ui.text('没有可上阵的武将了', box.x + box.w / 2, box.y + 60, { size: 12, color: T.DIM, align: 'center' });
    ui.endScroll();
  }
};
