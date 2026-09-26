// 主城：战役入口、挂机收益、功能入口、编队快览、每日任务
const { app, ui } = require('../app');
const ads = require('../ads');
const T = require('../theme');
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

module.exports = {
  name: 'home',
  scroll: {}, scrollReg: {},
  showQuests: false,
  idleTimerText: '',

  onEnter() {
    store.checkDailyReset();
    this.refresh();
  },
  refresh() {
    const s = store.getState();
    const stageNo = s.campaign.cleared + 1;
    const info = stages.chapterOf(stageNo);
    const enemy = stages.makeStageEnemies(stageNo);
    this.view = {
      stageNo,
      stageName: info.name,
      isBoss: info.isBoss,
      enemyNames: enemy.units.map(u => u.hero.name).join(' '),
      myPower: F.fmtNum(store.teamPower()),
      enemyPower: F.fmtNum(Math.floor(enemy.units.reduce((sum, u) => sum + heroes.heroPower(u.hero, u.level, u.star) * u.scale, 0))),
      formation: store.getFormationCalc(),
      fast: s.fast,
      quests: store.questList().map(q => ({ ...q, rewardText: this.rewardText(q.reward) })),
      activePts: store.activePoints(),
      chests: items.ACTIVE_CHESTS.map((c, i) => ({
        need: c.need, idx: i, rewardText: this.rewardText(c.reward),
        can: store.activePoints() >= c.need,
        claimed: s.daily.active.indexOf(i) >= 0
      }))
    };
  },
  rewardText(r) {
    const p = [];
    if (r.gem) p.push('元宝×' + r.gem);
    if (r.gold) p.push('铜钱×' + F.fmtNum(r.gold));
    if (r.exp) p.push('兵书×' + F.fmtNum(r.exp));
    if (r.scroll) p.push('招募令×' + r.scroll);
    if (r.shard) p.push('碎片×' + r.shard);
    return p.join(' ');
  },
  update(dt) {
    if (!this.view) this.refresh();
    const idle = store.idlePending();
    const h = Math.floor(idle.hours), m = Math.floor((idle.hours % 1) * 60);
    this.idle = idle;
    this.idleTimerText = idle.full ? '已达上限 12 小时' : '累计 ' + (h > 0 ? h + '时' : '') + m + '分';
  },

  draw() {
    const v = this.view;
    app.resBar(10, ['gold', 'gem', 'scroll', 'exp']);
    let y = 40;

    // ---- 战役横幅 ----
    ui.panel(8, y, 359, 108, { ornate: true });
    ui.text(v.stageName, 20, y + 10, { size: 17, color: T.GOLD_HI, bold: true });
    ui.text('第 ' + v.stageNo + ' 关' + (v.isBoss ? ' · 名将镇守' : ''), 20, y + 32, { size: 11, color: T.DIM });
    ui.text('我军 ' + v.myPower, 350, y + 12, { size: 12, color: T.GOLD, align: 'right' });
    ui.text('敌军 ' + v.enemyPower, 350, y + 28, { size: 12, color: T.RED_HI, align: 'right' });
    ui.wrap('守军：' + v.enemyNames, 20, y + 50, 335, 14, { size: 11 });
    ui.btn(20, y + 74, 335, 26, { text: '⚔ 出  征', style: 'red', size: 15, id: 'go-battle', cb: () => app.push('battle', { mode: 'campaign' }) });
    y += 120;

    // ---- 挂机收益 ----
    ui.panel(8, y, 359, 116);
    ui.text('挂机收益', 20, y + 8, { size: 15, color: T.GOLD_HI, bold: true });
    ui.text(this.idleTimerText, 355, y + 11, { size: 10, color: T.DIM, align: 'right' });
    const idle = this.idle || { gold: 0, exp: 0, scroll: 0 };
    ui.text('🪙 ' + F.fmtNum(idle.gold), 20, y + 30, { size: 14, color: T.GOLD });
    ui.text('📕 ' + F.fmtNum(idle.exp), 100, y + 30, { size: 14, color: T.GOLD });
    ui.text('📜 ' + idle.scroll, 180, y + 30, { size: 14, color: T.GOLD });
    const hasIdle = idle.gold > 0 || idle.exp > 0;
    const idle2xLeft = ads.remaining('idle2x');
    const fastLeft = ads.remaining('fast');
    // 行1：领取
    ui.btn(20, y + 52, 168, 24, {
      text: '一键领取', style: 'gold', size: 12, id: 'idle-claim', disabled: !hasIdle,
      cb: () => {
        const r = store.claimIdle(false);
        ui.toast(r.gold || r.exp || r.scroll ? '收获 铜钱 ' + F.fmtNum(r.gold) + ' · 兵书 ' + F.fmtNum(r.exp) : '暂无收益');
        this.refresh();
      }
    });
    ui.btn(198, y + 52, 157, 24, {
      text: '📺 看广告 ×2（' + (3 - idle2xLeft) + '/3）', style: 'ghost', size: 10,
      id: 'idle-ad2x', disabled: !hasIdle || idle2xLeft <= 0,
      cb: () => {
        ads.showRewarded('idle2x', () => {
          const r = store.claimIdle(true);
          ui.toast('双倍收获！铜钱 ' + F.fmtNum(r.gold) + ' · 兵书 ' + F.fmtNum(r.exp));
          this.refresh();
        }, (msg) => ui.toast(msg));
      }
    });
    // 行2：快速收获
    ui.btn(20, y + 84, 168, 24, {
      text: '快速收获 +2h 50元宝（' + v.fast.count + '/6）', style: 'plain', size: 10,
      id: 'idle-fast', disabled: v.fast.count >= 6,
      cb: () => {
        const r = store.fastReward(false);
        if (!r.ok) ui.toast(r.msg); else ui.toast('快速收获成功');
        this.refresh();
      }
    });
    ui.btn(198, y + 84, 157, 24, {
      text: '📺 看广告 +2h 免费（' + (3 - fastLeft) + '/3）', style: 'ghost', size: 10,
      id: 'idle-adfast', disabled: fastLeft <= 0,
      cb: () => {
        ads.showRewarded('fast', () => {
          const r = store.fastReward(true);
          ui.toast(r.ok ? '免费快速收获成功' : r.msg);
          this.refresh();
        }, (msg) => ui.toast(msg));
      }
    });
    y += 126;

    // ---- 功能入口 ----
    const entries = [
      { t: '🎖', n: '编队', cb: () => app.push('formation') },
      { t: '📋', n: '任务', cb: () => { this.showQuests = true; this.refresh(); } },
      { t: '🗼', n: '群英塔', cb: () => app.push('tower') },
      { t: '🏟', n: '演武场', cb: () => app.push('arena') }
    ];
    const ew = (359 - 3 * 8) / 4;
    entries.forEach((e, i) => {
      const ex = 8 + i * (ew + 8);
      ui.panel(ex, y, ew, 54);
      ui.tap(ex, y, ew, 54, e.cb, 'entry-' + i);
      ui.text(e.t, ex + ew / 2, y + 8, { size: 20, align: 'center' });
      ui.text(e.n, ex + ew / 2, y + 34, { size: 11, align: 'center', color: T.TEXT });
    });
    y += 64;

    // ---- 出战阵容 ----
    this.sectionTitle('出战阵容', y);
    y += 26;
    const fw = (359 - 4 * 8) / 5;
    v.formation.forEach((c, i) => {
      const fx = 8 + i * (fw + 8);
      const has = !!c;
      ui.panel(fx, y, fw, 76, has ? {} : { fill: 'rgba(0,0,0,0.2)' });
      ui.tap(fx, y, fw, 76, () => app.push('formation'), 'qteam-' + i);
      if (has) {
        ui.heroFace(fx + 6, y + 5, fw - 12, c, {});
        ui.text(c.name, fx + fw / 2, y + 62, { size: 10, color: T.DIM, align: 'center' });
      } else {
        ui.text('+', fx + fw / 2, y + 24, { size: 20, color: T.DIM, align: 'center' });
        ui.text('空', fx + fw / 2, y + 58, { size: 10, color: T.DIM, align: 'center' });
      }
    });

    // ---- 任务弹窗 ----
    if (this.showQuests) this.drawQuests();
  },
  sectionTitle(title, y) {
    const ctx = ui.ctx;
    ctx.save();
    ctx.fillStyle = T.GOLD_DEEP;
    ctx.fillRect(8, y + 3, 3, 12);
    ui.text(title, 16, y + 2, { size: 13, color: T.GOLD, bold: true });
    ctx.strokeStyle = 'rgba(90,69,42,0.8)';
    ctx.beginPath();
    ctx.moveTo(16 + ui.textWidth(title, 13, true) + 8, y + 9);
    ctx.lineTo(367, y + 9);
    ctx.stroke();
    ctx.restore();
  },
  drawQuests() {
    const v = this.view;
    ui.setModalClose(() => { this.showQuests = false; this.refresh(); });
    const box = ui.modal('每 日 军 令', 40, 100, 295, 500);
    let y = box.y;
    v.quests.forEach((q, i) => {
      ui.text(q.name, box.x, y, { size: 13 });
      ui.text(q.count + '/' + q.target + ' · ' + q.rewardText, box.x, y + 17, { size: 10, color: T.DIM });
      ui.btn(box.x + box.w - 56, y + 2, 56, 24, {
        text: q.claimed ? '已领' : (q.done ? '领取' : '未成'),
        style: q.claimed ? 'plain' : (q.done ? 'gold' : 'ghost'),
        size: 11, disabled: q.claimed || !q.done, id: 'q-' + q.id,
        cb: () => {
          const r = store.claimQuest(q.id);
          if (!r.ok) ui.toast(r.msg || '无法领取'); else ui.toast('已领取');
          this.refresh();
        }
      });
      y += 40;
      if (i < v.quests.length - 1) {
        ui.ctx.save();
        ui.ctx.strokeStyle = 'rgba(90,69,42,0.35)';
        ui.ctx.setLineDash([2, 3]);
        ui.ctx.beginPath();
        ui.ctx.moveTo(box.x, y - 6); ui.ctx.lineTo(box.x + box.w, y - 6);
        ui.ctx.stroke();
        ui.ctx.restore();
      }
    });
    ui.text('活跃度 ' + v.activePts, box.x + box.w / 2, y, { size: 13, color: T.GOLD, align: 'center', bold: true });
    y += 22;
    const cw = (box.w - 16) / 3;
    v.chests.forEach((c, i) => {
      const cx = box.x + i * (cw + 8);
      ui.panel(cx, y, cw, 58, c.can && !c.claimed ? { ornate: true } : {});
      ui.tap(cx, y, cw, 58, () => {
        const r = store.claimActiveChest(c.idx);
        if (!r.ok) ui.toast(r.msg || '无法领取'); else ui.toast('宝箱已开启');
        this.refresh();
      }, 'chest-' + i);
      ui.text(c.claimed ? '📭' : (c.can ? '🎁' : '🔒'), cx + cw / 2, y + 6, { size: 18, align: 'center' });
      ui.text(c.need + '活跃', cx + cw / 2, y + 30, { size: 9, color: T.DIM, align: 'center' });
      ui.wrap(c.rewardText, cx + 4, y + 42, cw - 8, 10, { size: 8 });
    });
  }
};
