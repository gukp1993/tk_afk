// 演武场：每日 5 次机会，三名对手，胜负影响积分与段位
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const IT = require('../../utils/items');
const F = require('../../utils/fmt');

Page({
  data: {
    points: 0, rankName: '', wins: 0, losses: 0, attempts: 0,
    myPower: 0, myPowerText: '',
    opponents: []
  },
  onShow() {
    store.checkDailyReset();
    this.refresh();
  },
  onHide() { store.save(); },

  refresh() {
    const s = store.getState();
    const myPower = store.teamPower();
    this.setData({
      points: s.arena.points,
      rankName: IT.arenaRank(s.arena.points),
      wins: s.arena.wins, losses: s.arena.losses,
      attempts: s.arena.attempts,
      myPower, myPowerText: F.fmtNum(myPower),
      opponents: this.buildOpponents(myPower)
    });
  },
  buildOpponents(myPower) {
    const day = new Date();
    const daySeed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
    const defs = [
      { diff: 0.8, name: '守碉老卒' },
      { diff: 1.05, name: '游历侠客' },
      { diff: 1.35, name: '无名猛将' }
    ];
    return defs.map((d, i) => {
      const seed = daySeed * 97 + i * 13;
      const def = stages.makeArenaEnemies(myPower, seed, d.diff);
      const power = Math.floor(def.units.reduce((sum, u) => sum + require('../../utils/heroes').heroPower(u.hero, u.level, u.star), 0) * (d.diff > 1 ? d.diff * 0.98 : d.diff));
      return {
        seed, diff: d.diff, name: d.name + '·' + (i + 1) + '号',
        power: F.fmtNum(power),
        powerRaw: power,
        level: def.units[0].level,
        hard: d.diff > 1.2
      };
    });
  },
  fight(e) {
    const { seed, diff, name, power } = e.currentTarget.dataset;
    if (store.getState().arena.attempts <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
      return;
    }
    const opt = JSON.stringify({ seed: Number(seed), diff: Number(diff), name: String(name), power: Number(power) });
    wx.navigateTo({ url: '/pages/battle/battle?mode=arena&arenaOpt=' + encodeURIComponent(opt) });
  },
  goFormation() {
    wx.navigateTo({ url: '/pages/formation/formation' });
  }
});
