// 群英塔：无限层挑战
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const F = require('../../utils/fmt');

module.exports = {
  name: 'tower',
  scroll: {}, scrollReg: {},

  onEnter() {
    const s = store.getState();
    this.best = s.tower.best;
    this.myPower = F.fmtNum(store.teamPower());
    const start = Math.max(1, this.best - 2);
    this.list = [];
    for (let f = start; f <= this.best + 8; f++) {
      this.list.push({ floor: f, cleared: f <= this.best, isNext: f === this.best + 1, boss: f % 5 === 0 });
    }
  },

  draw() {
    app.pageHeader('群 英 塔');
    let y = 52;
    ui.panel(8, y, 359, 60, { ornate: true });
    ui.text('已登第 ' + this.best + ' 层', 20, y + 10, { size: 16, color: T.GOLD_HI, bold: true });
    ui.text('我军战力 ' + this.myPower + ' · 每 5 层一名将坐镇', 20, y + 34, { size: 10, color: T.DIM });
    ui.btn(268, y + 14, 88, 32, {
      text: '挑战 ' + (this.best + 1) + ' 层', style: 'red', size: 12, id: 'tower-next',
      cb: () => app.push('battle', { mode: 'tower', floor: this.best + 1 })
    });
    y += 70;

    const contentH = this.list.length * 58;
    ui.beginScroll(this, 'floors', 8, y, 359, app.H - y - 8, contentH);
    this.list.forEach((f, i) => {
      const fy = y + i * 58;
      ui.panel(8, fy, 359, 52, f.isNext ? { ornate: true } : {});
      ui.tap(8, fy, 359, 52, () => app.push('battle', { mode: 'tower', floor: f.floor }), 'floor-' + f.floor);
      // 层数圆章
      const ctx = ui.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(40, fy + 26, 17, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
      ctx.strokeStyle = f.isNext ? T.GOLD : T.LINE_HI;
      ctx.stroke();
      ctx.font = T.font(13, true);
      ctx.fillStyle = f.isNext ? T.GOLD_HI : T.GOLD;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('' + f.floor, 40, fy + 26.5);
      ctx.restore();
      ui.text(f.boss ? '👑 名将层' : '寻常守军', 68, fy + 8, { size: 13 });
      ui.text(f.cleared ? '已通关（可重复挑战）' : (f.isNext ? '当前可挑战' : '暂无首通奖励'), 68, fy + 28, { size: 10, color: T.DIM });
      ui.text(f.cleared ? '复盘' : '挑战', 350, fy + 18, { size: 12, color: T.GOLD, align: 'right' });
    });
    ui.endScroll();
  }
};
