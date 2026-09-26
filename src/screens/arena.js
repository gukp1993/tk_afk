// 演武场：每日 5 次，三名对手
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

module.exports = {
  name: 'arena',
  scroll: {}, scrollReg: {},

  onEnter() {
    store.checkDailyReset();
    const s = store.getState();
    const myPower = store.teamPower();
    const day = new Date();
    const daySeed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
    const defs = [
      { diff: 0.8, name: '守碉老卒·1号' },
      { diff: 1.05, name: '游历侠客·2号' },
      { diff: 1.35, name: '无名猛将·3号' }
    ];
    this.opponents = defs.map((d, i) => {
      const seed = daySeed * 97 + i * 13;
      const def = stages.makeArenaEnemies(myPower, seed, d.diff);
      const power = Math.floor(def.units.reduce((sum, u) => sum + heroes.heroPower(u.hero, u.level, u.star), 0) * (d.diff > 1 ? d.diff * 0.98 : d.diff));
      return { seed, diff: d.diff, name: d.name, powerText: F.fmtNum(power), level: def.units[0].level, hard: d.diff > 1.2 };
    });
    this.view = {
      points: s.arena.points,
      rank: items.arenaRank(s.arena.points),
      wins: s.arena.wins, losses: s.arena.losses,
      attempts: s.arena.attempts,
      myPower: F.fmtNum(myPower)
    };
  },

  draw() {
    app.pageHeader('演 武 场');
    let y = 52;
    ui.panel(8, y, 359, 62, { ornate: true });
    ui.text(this.view.rank + ' · ' + this.view.points + ' 分', 20, y + 10, { size: 16, color: T.GOLD_HI, bold: true });
    ui.text('战绩 ' + this.view.wins + ' 胜 ' + this.view.losses + ' 负 · 今日剩 ' + this.view.attempts + ' 次', 20, y + 36, { size: 10, color: T.DIM });
    ui.text('我军战力', 280, y + 12, { size: 10, color: T.DIM, align: 'right' });
    ui.text(this.view.myPower, 350, y + 26, { size: 15, color: T.GOLD, align: 'right' });
    ui.text('调整编队 ›', 350, y + 46, { size: 10, color: T.DIM, align: 'right' });
    ui.tap(260, y, 100, 62, () => app.push('formation'), 'arena-form');
    y += 72;

    ui.text('今 日 对 手', 12, y, { size: 13, color: T.GOLD, bold: true });
    y += 22;

    this.opponents.forEach((o, i) => {
      const oy = y + i * 72;
      ui.panel(8, oy, 359, 64, o.hard ? { ornate: true } : {});
      ui.text(o.name, 20, oy + 10, { size: 14, color: T.GOLD });
      ui.tag(o.hard ? '凶险' : '寻常', 330, oy + 10, o.hard ? T.RED_HI : T.DIM);
      ui.text('守军约 Lv.' + o.level + ' · 战力 ' + o.powerText, 20, oy + 34, { size: 10, color: T.DIM });
      ui.btn(258, oy + 26, 98, 28, {
        text: '切 磋', style: 'red', size: 13, disabled: this.view.attempts <= 0, id: 'arena-' + i,
        cb: () => {
          if (store.getState().arena.attempts <= 0) { ui.toast('今日次数已用完'); return; }
          app.push('battle', {
            mode: 'arena',
            arenaOpt: { seed: o.seed, diff: o.diff, name: o.name, diffLabel: o.hard ? '凶险' : '寻常' }
          });
        }
      });
    });
    y += 72 * 3 + 10;
    ui.wrap('胜得积分与演武令×2，败亦得演武令×1；演武令可在集市兑换招募令与自选卡。', 24, y, 330, 13, { size: 10 });
  }
};
