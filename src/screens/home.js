// 主城首页：先看到下一步，再进入召唤、英雄、背包等独立功能。
const { app, ui } = require('../app');
const ads = require('../ads');
const T = require('../theme');
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

module.exports = {
  name: 'home',
  scroll: {}, scrollReg: {}, showQuests: false, showIdle: false,
  onEnter() {
    store.checkDailyReset();
    this.showQuests = false; this.showIdle = false;
    this.refresh();
  },
  refresh() {
    const s = store.getState();
    const stageNo = s.campaign.cleared + 1;
    const info = stages.chapterOf(stageNo);
    this.view = {
      stageNo, stageName: info.name, isBoss: info.isBoss,
      myPower: F.fmtNum(store.teamPower()),
      formation: store.getFormationCalc(),
      quests: store.questList(), activePts: store.activePoints(),
      chests: items.ACTIVE_CHESTS.map((c, i) => ({
        ...c, idx: i, can: store.activePoints() >= c.need,
        claimed: s.daily.active.indexOf(i) >= 0
      }))
    };
  },
  rewardText(r) {
    return [['gem', '元宝'], ['gold', '铜钱'], ['scroll', '招募令'], ['shard', '碎片']]
      .filter(([k]) => r[k]).map(([k, n]) => n + '×' + F.fmtNum(r[k])).join(' · ');
  },
  update() {
    if (!this.view) this.refresh();
    this.idle = store.idlePending();
  },
  draw() {
    const v = this.view, s = store.getState();
    const idle = this.idle || store.idlePending();
    ui.text('挂机定三国', 14, 14, { size: 22, color: T.GOLD_HI, bold: true });
    ui.text('主城 · 征途从这里开始', 15, 41, { size: 10, color: T.DIM });
    ui.text('总战力 ' + v.myPower, 361, 23, { size: 12, color: T.GOLD, align: 'right' });
    app.resBar(62, ['gold', 'gem', 'scroll']);

    ui.beginScroll(this, 'home', 0, 94, 375, Math.max(80, app.H - 150), 690);
    let y = 94;
    const level = store.playerLevel(), player = s.player;
    const needXP = store.playerXpNeeded(level);
    ui.panel(12, y, 351, 68);
    ui.text('主公等级 Lv.' + level, 26, y + 10, { size: 16, color: T.GOLD_HI, bold: true });
    ui.text(level >= C.MAX_LEVEL ? '已达等级上限' : '全体武将同步成长', 349, y + 12, { size: 10, color: T.DIM, align: 'right' });
    ui.bar(26, y + 31, 323, 8, level >= C.MAX_LEVEL ? 1 : player.exp / needXP, 'gold');
    ui.text(level >= C.MAX_LEVEL ? '已达上限' : '战斗经验 ' + F.fmtNum(player.exp) + ' / ' + F.fmtNum(needXP), 26, y + 46, { size: 10, color: T.DIM });
    y += 78;
    // 主任务保留一个醒目的行动按钮。
    ui.panel(12, y, 351, 156, { ornate: true });
    this.cityBackdrop(y);
    ui.text('主线战役', 26, y + 14, { size: 10, color: T.GOLD });
    ui.text(v.stageName, 26, y + 36, { size: 19, color: T.GOLD_HI, bold: true });
    ui.text('第 ' + v.stageNo + ' 关' + (v.isBoss ? ' · 名将镇守' : ' · 继续你的三国征途'), 26, y + 64, { size: 11, color: T.TEXT });
    ui.text('通关越多，挂机收益越高', 26, y + 84, { size: 10, color: T.DIM });
    ui.btn(26, y + 106, 192, 38, { text: '出征  ›', style: 'red', size: 16, id: 'go-battle', cb: () => app.push('battle', { mode: 'campaign' }) });
    ui.btn(226, y + 106, 123, 38, { text: '练兵', sub: '胜利得经验', style: 'gold', size: 13, id: 'go-training', cb: () => app.push('battle', { mode: 'training' }) });
    y += 170;
    const entries = [
      { key: 'summon', glyph: '召', name: '召唤', desc: '获得新武将', hint: '招募令 ' + F.fmtNum(s.res.scroll), color: T.GOLD_HI },
      { key: 'heroes', glyph: '将', name: '英雄', desc: '升级与培养', hint: '已拥有 ' + Object.keys(s.roster).length + ' 将', color: '#9ec7ad' },
      { key: 'bag', glyph: '囊', name: '背包', desc: '资源与装备', hint: '查看我的物品', color: '#a8bfdf' }
    ];
    entries.forEach((e, i) => {
      const x = 12 + i * 121;
      ui.panel(x, y, 109, 98, { ornate: i === 0 });
      ui.tap(x, y, 109, 98, () => app.switchTab(e.key), 'home-' + e.key);
      ui.text(e.glyph, x + 18, y + 13, { size: 23, color: e.color, bold: true });
      ui.text(e.name, x + 50, y + 17, { size: 16, color: T.GOLD_HI, bold: true });
      ui.text(e.desc, x + 12, y + 49, { size: 11, color: T.TEXT });
      ui.text(e.hint, x + 12, y + 73, { size: 9, color: T.DIM });
    });
    y += 112;
    ui.panel(12, y, 351, 98);
    ui.text('挂机收益', 26, y + 12, { size: 15, color: T.GOLD_HI, bold: true });
    const mins = Math.floor(idle.hours * 60);
    const time = idle.full ? '已满 ' + C.IDLE_CAP_HOURS + ' 小时' : '已积累 ' + Math.floor(mins / 60) + '时' + mins % 60 + '分';
    ui.text(time, 349, y + 15, { size: 10, color: T.DIM, align: 'right' });
    ui.text('铜钱 ' + F.fmtNum(idle.gold) + '   招募令 ' + idle.scroll, 26, y + 36, { size: 11, color: T.GOLD });
    ui.btn(26, y + 58, 196, 30, { text: '领取收益', style: 'gold', size: 12, id: 'idle-claim', disabled: !(idle.gold || idle.exp || idle.scroll), cb: () => this.claimIdle(false) });
    ui.btn(230, y + 58, 119, 30, { text: '加速 / 双倍', style: 'ghost', size: 11, id: 'idle-more', cb: () => { this.showIdle = true; } });
    y += 112;
    const rewardsReady = v.quests.some(q => q.done && !q.claimed) || v.chests.some(c => c.can && !c.claimed);
    const links = [
      { title: '编队', sub: '调整出战', cb: () => app.push('formation') },
      { title: '每日任务', sub: rewardsReady ? '有奖励可领' : '完成领资源', cb: () => { this.refresh(); this.showQuests = true; } },
      { title: '集市', sub: '兑换物资', cb: () => app.push('shop') },
      { title: '更多玩法', sub: '爬塔与演武', cb: () => app.switchTab('journey') }
    ];
    links.forEach((e, i) => ui.btn(12 + i * 90, y, 81, 52, { text: e.title, sub: e.sub, style: 'plain', size: 12, id: 'home-link-' + i, cb: e.cb }));
    y += 68;
    ui.text('我的出战阵容', 14, y, { size: 13, color: T.GOLD_HI, bold: true });
    ui.text('点击调整 ›', 361, y + 2, { size: 10, color: T.DIM, align: 'right' });
    y += 24;
    v.formation.forEach((h, i) => {
      const x = 12 + i * 72;
      ui.panel(x, y, 63, 76);
      ui.tap(x, y, 63, 76, () => app.push('formation'), 'qteam-' + i);
      if (h) {
        ui.heroFace(x + 11, y + 7, 41, h, {});
        ui.text(h.name, x + 31.5, y + 56, { size: 11, align: 'center' });
      } else {
        ui.text('+', x + 31.5, y + 15, { size: 25, align: 'center', color: T.DIM });
        ui.text('待上阵', x + 31.5, y + 56, { size: 10, align: 'center', color: T.DIM });
      }
    });
    y += 88;
    ui.text('召唤武将 → 培养编队 → 出征闯关 → 领取收益', 187.5, y, { size: 10, color: T.DIM, align: 'center' });
    ui.endScroll();
    if (this.showQuests) this.drawQuests();
    if (this.showIdle) this.drawIdle();
  },
  cityBackdrop(y) {
    // 原创程序化城楼剪影，仅为装饰，不承担点击控件。
    const ctx = ui.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(217,169,78,0.07)';
    ctx.beginPath(); ctx.arc(302, y + 40, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(217,169,78,0.10)';
    [250, 292, 334].forEach((x, i) => {
      const roof = y + (i === 1 ? 41 : 57);
      ctx.fillRect(x - 12, roof + 10, 24, y + 96 - roof - 10);
      ctx.beginPath(); ctx.moveTo(x - 23, roof + 13); ctx.lineTo(x, roof); ctx.lineTo(x + 23, roof + 13); ctx.closePath(); ctx.fill();
    });
    ctx.fillRect(231, y + 87, 118, 9);
    ctx.restore();
  },
  claimIdle(double) {
    const r = store.claimIdle(double);
    ui.toast((double ? '双倍收获：' : '已领取：') + this.rewardText(r));
    this.refresh(); this.update();
  },
  drawIdle() {
    const close = () => { this.showIdle = false; };
    ui.setModalClose(close);
    const h = 304, y = Math.max(12, (app.H - h) / 2);
    const b = ui.modal('挂机收益 · 加速', 20, y, 335, h);
    const s = store.getState(), left = ads.remaining('idle2x'), fast = ads.remaining('fast');
    const idle = this.idle || store.idlePending();
    ui.wrap('离线也会积累收益，最多储存 ' + C.IDLE_CAP_HOURS + ' 小时。', b.x, b.y + 2, b.w, 17, { size: 12 });
    ui.btn(b.x, b.y + 44, b.w, 42, { text: '看广告 · 双倍领取', sub: '今日剩余 ' + left + ' 次', style: 'gold', id: 'idle-ad2x', disabled: left <= 0 || !(idle.gold || idle.exp || idle.scroll), cb: () => ads.showRewarded('idle2x', () => this.claimIdle(true), msg => ui.toast(msg)) });
    ui.btn(b.x, b.y + 98, b.w, 42, { text: '立即收获 ' + C.FAST_REWARD_HOURS + ' 小时收益', sub: C.FAST_REWARD_COST + ' 元宝 · 今日 ' + s.fast.count + '/' + C.FAST_REWARD_DAILY, style: 'plain', id: 'idle-fast', disabled: s.fast.count >= C.FAST_REWARD_DAILY, cb: () => { const r = store.fastReward(false); ui.toast(r.ok ? '快速收获成功' : r.msg); this.refresh(); } });
    ui.btn(b.x, b.y + 152, b.w, 42, { text: '看广告 · 免费收获 ' + C.FAST_REWARD_HOURS + ' 小时', sub: '今日剩余 ' + fast + ' 次', style: 'ghost', id: 'idle-adfast', disabled: fast <= 0, cb: () => ads.showRewarded('fast', () => { const r = store.fastReward(true); ui.toast(r.ok ? '免费快速收获成功' : r.msg); this.refresh(); }, msg => ui.toast(msg)) });
    ui.btn(b.x, b.y + 208, b.w, 34, { text: '返回主城', id: 'idle-close', cb: close });
  },
  drawQuests() {
    const v = this.view, close = () => { this.showQuests = false; this.refresh(); };
    ui.setModalClose(close);
    const h = Math.min(580, app.H - 32), y = (app.H - h) / 2;
    const b = ui.modal('每日任务', 16, y, 343, h);
    const viewH = b.h - 44, contentH = v.quests.length * 60 + 126;
    ui.beginScroll(this, 'quests', b.x, b.y, b.w, viewH, contentH);
    let rowY = b.y;
    v.quests.forEach(q => {
      ui.text(q.name, b.x, rowY + 4, { size: 13 });
      ui.text(q.count + '/' + q.target, b.x + b.w - 82, rowY + 7, { size: 10, color: T.DIM, align: 'right' });
      ui.wrap(this.rewardText(q.reward), b.x, rowY + 26, b.w - 82, 13, { size: 9 });
      ui.btn(b.x + b.w - 68, rowY + 5, 64, 34, { text: q.claimed ? '已领取' : (q.done ? '领取' : '未完成'), style: q.done && !q.claimed ? 'gold' : 'ghost', size: 11, disabled: q.claimed || !q.done, id: 'q-' + q.id, cb: () => { const r = store.claimQuest(q.id); ui.toast(r.ok ? '已领取' : r.msg || '无法领取'); this.refresh(); } });
      rowY += 60;
    });
    ui.text('活跃度 ' + v.activePts + ' · 活跃宝箱', b.x, rowY + 2, { size: 13, color: T.GOLD });
    const w = (b.w - 16) / 3;
    v.chests.forEach((c, i) => {
      const x = b.x + i * (w + 8);
      ui.btn(x, rowY + 30, w, 44, { text: c.need + ' 活跃', sub: c.claimed ? '已领取' : c.can ? '领取宝箱' : '未达成', style: c.can && !c.claimed ? 'gold' : 'ghost', size: 12, disabled: c.claimed || !c.can, id: 'chest-' + i, cb: () => { const r = store.claimActiveChest(c.idx); ui.toast(r.ok ? '宝箱已开启' : r.msg || '无法领取'); this.refresh(); } });
      ui.wrap(this.rewardText(c.reward), x + 2, rowY + 80, w - 4, 12, { size: 9 });
    });
    ui.endScroll();
    ui.btn(b.x, y + h - 46, b.w, 34, { text: '返回主城', id: 'quests-close', cb: close });
  }
};
