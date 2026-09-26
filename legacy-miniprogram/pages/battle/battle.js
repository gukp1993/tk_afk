// 战斗页：战役 / 群英塔 / 演武场 三种模式共用
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const F = require('../../utils/fmt');
const IT = require('../../utils/items');

Page({
  data: {
    ready: false,
    over: false, win: false, skipped: false,
    resultLines: [],
    mode: 'campaign',
    nextLabel: ''
  },
  onLoad(options) {
    this.mode = options.mode || 'campaign';
    this.arenaOpt = options.arenaOpt ? JSON.parse(options.arenaOpt) : null;
    this.setData({ mode: this.mode });
  },
  onReady() {
    this.bv = this.selectComponent('#bv');
    this.startBattle();
  },
  onUnload() { store.save(); },

  buildCfg() {
    const team = store.playerUnits();
    if (this.mode === 'tower') {
      const floor = this.floor || (store.getState().tower.best + 1);
      this.floor = floor;
      const def = stages.makeTowerEnemies(floor);
      return {
        title: def.name, team,
        enemy: store.enemyUnits(def.units),
        seed: 55000 + floor * 77
      };
    }
    if (this.mode === 'arena') {
      const opt = this.arenaOpt;
      const def = stages.makeArenaEnemies(store.teamPower(), opt.seed, opt.diff);
      this.arenaName = opt.name;
      return {
        title: '演武场 · 对阵 ' + opt.name,
        team,
        enemy: store.enemyUnits(def.units),
        seed: opt.seed
      };
    }
    const stage = this.stage || (store.getState().campaign.cleared + 1);
    this.stage = stage;
    const def = stages.makeStageEnemies(stage);
    return {
      title: def.name + (def.isBoss ? ' ⚔' : ''),
      team,
      enemy: store.enemyUnits(def.units),
      seed: 1000 + stage * 13 + (this.retryCount || 0)
    };
  },
  startBattle() {
    if (store.playerUnits().length === 0) {
      wx.showModal({ title: '无可用武将', content: '请先在编队中上阵武将', showCancel: false, complete: () => wx.navigateBack() });
      return;
    }
    this.cfg = this.buildCfg();
    this.setData({ ready: true, over: false, win: false, resultLines: [] });
    const bv = this.selectComponent('#bv');
    bv.start(this.cfg);
  },
  retry() { this.retryCount = (this.retryCount || 0) + 1; this.startBattle(); },
  onFinish(e) {
    const { winner, duration } = e.detail;
    const win = winner === 'A';
    const lines = [];
    if (this.mode === 'campaign') {
      const r = store.winCampaign(this.stage);
      lines.push('首通奖励：元宝 ' + r.gem);
      lines.push('铜钱 +' + F.fmtNum(r.gold) + ' · 兵书 +' + F.fmtNum(r.exp));
      if (r.scroll) lines.push('招募令 ×' + r.scroll);
      if (r.equip) lines.push('获得 ' + IT.EQUIP_TIERS[r.equip.tier - 1].name + ' · ' + IT.EQUIP_SLOTS[r.equip.slot].name);
    } else if (this.mode === 'tower') {
      const r = store.winTower(this.floor);
      if (r.gem) {
        lines.push('首通奖励：元宝 ' + r.gem);
        if (r.scroll) lines.push('招募令 ×' + r.scroll);
        if (r.shard) lines.push('英雄碎片 ×' + r.shard);
        this.towerFirst = true;
      } else {
        lines.push('已通关过此层，无首通奖励');
        this.towerFirst = false;
      }
    } else {
      const diff = this.arenaOpt.diff;
      const r = store.arenaFight(win, diff);
      lines.push('演武积分 ' + (r.delta >= 0 ? '+' : '') + r.delta + '（当前 ' + r.points + ' · ' + IT.arenaRank(r.points) + '）');
      lines.push('获得演武令 ×' + r.tokens);
    }
    lines.push('用时 ' + duration + ' 秒');
    let nextLabel = '';
    if (win) {
      if (this.mode === 'campaign') nextLabel = '进军下一关';
      if (this.mode === 'tower') nextLabel = '挑战下一层';
    }
    this.setData({ over: true, win, resultLines: lines, nextLabel, skipped: !!e.detail.skipped });
    store.save();
  },
  onNext() {
    if (!this.data.nextLabel) return;
    if (this.mode === 'campaign') this.stage = this.stage + 1;
    if (this.mode === 'tower') this.floor = this.floor + 1;
    this.startBattle();
  },
  onRetreat() {
    wx.navigateBack();
  },
  onExit() {
    wx.navigateBack();
  }
});
