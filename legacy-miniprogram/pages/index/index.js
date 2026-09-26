const store = require('../../utils/store');
const stages = require('../../utils/stages');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

Page({
  data: {
    resView: {}, name: '',
    stageName: '', stageNo: 1, isBoss: false,
    enemyNames: [], myPower: 0, enemyPower: 0,
    idleView: { gold: '0', exp: '0', scroll: '0', timeText: '', has: false },
    fast: { count: 0, max: C.FAST_REWARD_DAILY, cost: C.FAST_REWARD_COST },
    formation: [],
    showQuests: false, quests: [], activePts: 0, chests: [],
    toast: ''
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    store.checkDailyReset();
    this.refresh();
    this.idleTimer = setInterval(() => this.refreshIdle(), 1000);
  },
  onHide() { clearInterval(this.idleTimer); store.save(); },
  onUnload() { clearInterval(this.idleTimer); store.save(); },

  refresh() {
    const s = store.getState();
    const stageNo = s.campaign.cleared + 1;
    const info = stages.chapterOf(stageNo);
    const enemy = stages.makeStageEnemies(stageNo);
    const myPower = store.teamPower();
    const enemyPower = Math.floor(enemy.units.reduce((sum, u) => {
      return sum + heroes.heroPower(u.hero, u.level, u.star) * u.scale;
    }, 0));
    this.setData({
      resView: {
        gold: F.fmtNum(s.res.gold), gem: F.fmtNum(s.res.gem),
        scroll: s.res.scroll, exp: F.fmtNum(s.res.exp),
        token: s.res.token, shard: s.res.shard
      },
      name: s.name,
      stageName: info.name, stageNo, isBoss: info.isBoss,
      enemyNames: enemy.units.map(u => u.hero.name),
      myPower: F.fmtNum(myPower), enemyPower: F.fmtNum(enemyPower),
      formation: store.getFormationCalc(),
      fast: { count: s.fast.count, max: C.FAST_REWARD_DAILY, cost: C.FAST_REWARD_COST },
      quests: this.questViews(),
      activePts: store.activePoints(),
      chests: items.ACTIVE_CHESTS.map((c, i) => ({
        need: c.need, idx: i,
        rewardText: this.rewardText(c.reward),
        can: store.activePoints() >= c.need,
        claimed: s.daily.active.indexOf(i) >= 0
      }))
    });
    this.refreshIdle();
  },
  questViews() {
    return store.questList().map(q => ({ ...q, rewardText: this.rewardText(q.reward) }));
  },
  refreshIdle() {
    const idle = store.idlePending();
    const h = Math.floor(idle.hours), m = Math.floor((idle.hours % 1) * 60);
    this.setData({
      idleView: {
        gold: F.fmtNum(idle.gold), exp: F.fmtNum(idle.exp), scroll: idle.scroll,
        timeText: idle.full ? '已达上限 12 小时' : '累计 ' + (h > 0 ? h + ' 小时 ' : '') + m + ' 分钟',
        has: idle.gold > 0 || idle.exp > 0
      }
    });
  },
  rewardText(r) {
    const parts = [];
    if (r.gem) parts.push('元宝×' + r.gem);
    if (r.gold) parts.push('铜钱×' + F.fmtNum(r.gold));
    if (r.exp) parts.push('兵书×' + F.fmtNum(r.exp));
    if (r.scroll) parts.push('招募令×' + r.scroll);
    if (r.shard) parts.push('碎片×' + r.shard);
    if (r.token) parts.push('演武令×' + r.token);
    return parts.join(' ');
  },
  toast(msg) {
    this.setData({ toast: msg });
    setTimeout(() => this.setData({ toast: '' }), 1800);
  },

  goBattle() { wx.navigateTo({ url: '/pages/battle/battle?mode=campaign' }); },
  goFormation() { wx.navigateTo({ url: '/pages/formation/formation' }); },
  goTower() { wx.navigateTo({ url: '/pages/tower/tower' }); },
  goArena() { wx.navigateTo({ url: '/pages/arena/arena' }); },

  claimIdle() {
    const r = store.claimIdle();
    if (r.gold === 0 && r.exp === 0 && r.scroll === 0) {
      this.toast('暂无收益，稍后再来');
    } else {
      this.toast('收获：铜钱 ' + F.fmtNum(r.gold) + ' · 兵书 ' + F.fmtNum(r.exp) + (r.scroll ? ' · 招募令×' + r.scroll : ''));
    }
    this.refresh();
  },
  fastReward() {
    const r = store.fastReward();
    if (!r.ok) { this.toast(r.msg); return; }
    this.toast('快速收获：铜钱 ' + F.fmtNum(r.gold) + ' · 兵书 ' + F.fmtNum(r.exp));
    this.refresh();
  },
  openQuests() { this.setData({ showQuests: true, quests: this.questViews(), activePts: store.activePoints() }); },
  closeQuests() { this.setData({ showQuests: false }); this.refresh(); },
  claimQuest(e) {
    const r = store.claimQuest(e.currentTarget.dataset.id);
    if (!r.ok) { this.toast(r.msg || '无法领取'); return; }
    this.toast('已领取奖励');
    this.setData({ quests: this.questViews(), activePts: store.activePoints() });
  },
  claimChest(e) {
    const r = store.claimActiveChest(e.currentTarget.dataset.idx);
    if (!r.ok) { this.toast(r.msg || '无法领取'); return; }
    this.toast('宝箱已开启');
    const s = store.getState();
    this.setData({
      chests: this.data.chests.map((c, i) => ({
        ...c, claimed: s.daily.active.indexOf(i) >= 0, can: store.activePoints() >= c.need
      })),
      activePts: store.activePoints()
    });
  },
  onCardTap(e) {
    wx.navigateTo({ url: '/pages/hero-detail/hero-detail?id=' + e.detail.hero.id });
  }
});
