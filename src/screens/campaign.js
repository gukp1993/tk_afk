// 战役首页：地形/军旗/营地是可替换的原创占位；导航与奖励复用现有业务。
const home = require('./home');
const { app, ui } = require('../app');
const art = require('../campaign-art');
const store = require('../../utils/store');
const stages = require('../../utils/stages');
const story = require('../../utils/story');
const C = require('../../utils/config');
const F = require('../../utils/fmt');
const T = require('../theme');

const INK = '#3d4337', PAPER = '#eee3bf', GOLD = '#edcf88';
const POINTS = art.ROUTE;
function stageTitle(n) {
  const entry = story.getStoryStage(n);
  return entry ? entry.stage.name : (stages.chapterOf(n).isBoss ? '名将镇守' : '乱世征途');
}

module.exports = {
  ...home,
  name: 'campaign', scroll: {}, scrollReg: {}, showMap: false, showStagePreview: false,
  onEnter() {
    home.onEnter.call(this);
    this.showMap = false;
    this.showStagePreview = false;
  },
  draw() {
    const s = store.getState(), v = this.view, ctx = ui.ctx;
    const chapter = stages.chapterOf(v.stageNo);
    const mapY = 112, mapH = Math.max(160, app.H - 386);
    const campY = app.H - 274;
    ctx.save(); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 375, app.H); ctx.restore();
    art.drawMap(ctx, 0, mapY, 375, mapH);

    // 每章分两段展示，旗帜严格对应真实关卡；完整十关可由“征途”查看。
    const chapterStart = chapter.idx * stages.STAGES_PER_CH + 1;
    const segmentStart = chapterStart + (chapter.inCh < 5 ? 0 : 5);
    POINTS.forEach(([nx, ny], i) => {
      const n = segmentStart + i, x = nx * 375, y = mapY + ny * mapH;
      const state = n < v.stageNo ? 'cleared' : n === v.stageNo ? 'current' : 'locked';
      const scale = mapH < 250 ? .76 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      art.drawBanner(ctx, 0, 0, { state, label: '' + n }); ctx.restore();
      ui.tap(x - 17, y - 37 * scale, 47 * scale, 48 * scale, () => {
        if (state === 'current') this.showStagePreview = true;
        else ui.toast('第 ' + n + ' 关 · ' + stageTitle(n) + (state === 'cleared' ? ' · 已通关' : ' · 通关前一关后开放'));
      }, 'campaign-node-' + n);
      if (state === 'current') {
        const labelY = Math.min(y + 9, campY - 22);
        ui.panel(x - 39, labelY, 97, 20, { fill: '#3c6255', r: 3 });
        ui.text('当前 · 第 ' + n + ' 关', x + 9, labelY + 4, { size: 10, color: '#fff0c4', align: 'center', bold: true });
      }
    });

    this.drawHeader(s, v, chapter);
    const ready = v.quests.some(q => q.done && !q.claimed) || v.chests.some(c => c.can && !c.claimed);
    const shortcutY = mapY + (mapH < 250 ? 0 : 34);
    const gap = mapH < 250 ? 44 : 57;
    this.shortcut(shortcutY, '令', '任务', 'campaign-quests', () => { this.refresh(); this.showQuests = true; }, ready);
    this.shortcut(shortcutY + gap, '召', '召唤', 'campaign-summon', () => app.switchTab('summon'));
    this.shortcut(shortcutY + gap * 2, '囊', '背包', 'campaign-bag', () => app.switchTab('bag'));
    this.shortcut(shortcutY + gap * 3, '械', '军械', 'campaign-armory', () => app.push('armory'));

    // 前景仅展示实际出战编队，不在首页虚构战斗或发放战斗收益。
    art.drawCamp(ctx, 0, campY, 375, 89, v.formation);
    ui.text('出战阵容', 16, campY + 3, { size: 10, bold: true, color: '#f4e8bf' });
    ui.text('调整编队 ›', 247, campY + 3, { size: 10, color: '#f4e8bf', align: 'right' });
    ui.tap(8, campY, 248, 85, () => app.push('formation'), 'campaign-formation');
    this.drawHarvest(campY, ready);
    this.drawActions(v);
    if (this.showQuests) this.drawQuests();
    else if (this.showIdle) this.drawIdle();
    else if (this.showStagePreview) this.drawStagePreview();
    else if (this.showMap) this.drawMapOverview(chapter);
  },
  drawHeader(s, v, chapter) {
    ui.panel(0, 0, 375, 82, { fill: '#2d3c35', r: 0 });
    ui.panel(11, 11, 48, 49, { fill: '#5b7057', ornate: true, r: 8 });
    ui.text('汉', 35, 17, { size: 29, bold: true, color: GOLD, align: 'center' });
    ui.text(s.name || '主公', 69, 12, { size: 16, bold: true, color: '#f5e8c9' });
    ui.text('Lv.' + store.playerLevel(), 70, 35, { size: 11, color: '#c7cdac' });
    const resources = [['gold', '铜钱'], ['gem', '元宝']];
    resources.forEach(([key, label], i) => {
      const x = 165 + i * 101;
      ui.panel(x, 12, 95, 29, { fill: '#24352e', r: 5 });
      ui.text(label, x + 7, 22, { size: 9, color: '#c6bc98' });
      ui.text(F.fmtNum(s.res[key]), x + 87, 20, { size: 13, bold: true, color: GOLD, align: 'right' });
    });
    const level = store.playerLevel(), need = store.playerXpNeeded(level);
    ui.bar(165, 49, 196, 5, level >= C.MAX_LEVEL ? 1 : s.player.exp / need, 'gold');
    ui.text('战力 ' + v.myPower, 13, 65, { size: 11, bold: true, color: GOLD });
    ui.text(level >= C.MAX_LEVEL ? '主公等级已满' : '战斗经验 ' + F.fmtNum(s.player.exp) + '/' + F.fmtNum(need), 360, 63, { size: 9, color: '#c7cdac', align: 'right' });
    ui.panel(0, 82, 375, 30, { fill: '#d9cda7', r: 0 });
    ui.text(chapter.name, 14, 90, { size: 13, bold: true, color: INK });
    ui.text(chapter.inCh + '/' + stages.STAGES_PER_CH + ' 关', 360, 92, { size: 10, color: '#6c6b4c', align: 'right' });
  },
  shortcut(y, glyph, label, id, cb, ready) {
    ui.panel(320, y, 45, 40, { fill: '#e5d5ad', ornate: true, r: 5 });
    ui.text(glyph, 342.5, y + 2, { size: 21, color: '#536957', bold: true, align: 'center' });
    ui.text(label, 342.5, y + 25, { size: 11, color: INK, bold: true, align: 'center' });
    ui.tap(317, y, 50, 42, cb, id);
    if (ready) ui.tag('!', 355, y - 4, '#b34e36');
  },
  drawHarvest(campY, dailyReady) {
    const idle = this.idle || store.idlePending();
    const canClaim = !!(idle.gold || idle.scroll || idle.iron || dailyReady);
    art.drawChest(ui.ctx, 286, campY + 14, 60, { ready: canClaim });
    ui.text('挂机宝箱', 316, campY + 70, { size: 11, bold: true, align: 'center', color: '#f4e8bf' });
    ui.tap(266, campY + 8, 98, 75, () => canClaim ? this.claimFreeRewards() : ui.toast('挂机收益积累中'), 'campaign-chest');
    const y = app.H - 194;
    ui.panel(10, y, 355, 52, { fill: '#ded2ae', r: 5 });
    const minutes = Math.floor(idle.hours * 60);
    ui.text(idle.full ? '挂机收益已满' : '积累 ' + Math.floor(minutes / 60) + '时' + minutes % 60 + '分', 21, y + 6, { size: 11, color: INK, bold: true });
    ui.text('铜钱 ' + F.fmtNum(idle.gold) + ' · 精铁 ' + idle.iron + ' · 招募令 ' + idle.scroll, 21, y + 26, { size: 9, color: '#74684a' });
    const rateNow = C.idleRates(store.getState().campaign.cleared), rateNext = C.idleRates(store.getState().campaign.cleared + 1);
    const rateGain = Math.max(0, rateNext.gold - rateNow.gold);
    ui.text(rateGain ? '本关通关后挂机铜钱/时 +' + F.fmtNum(rateGain) : '当前挂机速率已按关卡结算', 21, y + 40, { size: 8, color: '#74684a' });
    ui.btn(230, y + 6, 125, 32, { text: canClaim ? '一键收获' : '收益积累中', style: 'gold', size: 13, disabled: !canClaim, id: 'idle-claim', cb: () => this.claimFreeRewards() });
  },
  drawActions(v) {
    const y = app.H - 135;
    ui.btn(10, y, 53, 48, { text: '征途', sub: '本章地图', style: 'plain', size: 13, id: 'campaign-map', cb: () => { this.showMap = true; } });
    ui.btn(72, y, 231, 48, { text: v.isBoss ? '自动出征 · 挑战名将' : '自动出征', sub: '第 ' + v.stageNo + ' 关 · ' + stageTitle(v.stageNo), subColor: '#e5e5bf', style: 'jade', size: 20, r: 10, id: 'go-battle', cb: () => app.push('battle', { mode: 'campaign', auto: true }) });
    ui.btn(312, y, 53, 48, { text: '练兵', sub: '最多10胜', style: 'plain', size: 13, id: 'go-training', cb: () => app.push('battle', { mode: 'training', auto: true }) });
    ui.panel(0, app.H - 81, 375, 29, { fill: '#344438', r: 0 });
    const title = this.goal ? this.goal.title : '通关越多，挂机收益越高';
    ui.text('目标  ' + title, 12, app.H - 72, { size: 10, color: '#e9ddba' });
    ui.tap(6, app.H - 81, 255, 29, () => {
      if (this.goal && this.goal.action && this.goal.action.type !== 'campaign') this.openGoal(this.goal);
      else this.showMap = true;
    }, 'campaign-goal');
    ui.btn(282, app.H - 78, 82, 23, { text: '加速 / 双倍', style: 'ghost', size: 10, id: 'idle-more', cb: () => { this.showIdle = true; } });
  },
  drawMapOverview(chapter) {
    const close = () => { this.showMap = false; };
    ui.setModalClose(close);
    const h = Math.min(544, app.H - 28), y = (app.H - h) / 2;
    const b = ui.modal(chapter.name, 16, y, 343, h);
    const start = chapter.idx * stages.STAGES_PER_CH + 1;
    ui.text('本章征途 · 已通关 ' + chapter.inCh + '/' + stages.STAGES_PER_CH, b.x, b.y + 1, { size: 11, color: GOLD });
    ui.beginScroll(this, 'chapter-map', b.x, b.y + 23, b.w, b.h - 75, stages.STAGES_PER_CH * 39);
    for (let i = 0; i < stages.STAGES_PER_CH; i++) {
      const n = start + i, yy = b.y + 23 + i * 39;
      const cleared = n < this.view.stageNo, current = n === this.view.stageNo;
      ui.panel(b.x, yy, b.w, 34, { fill: current ? '#375c4b' : '#302b1c', r: 3 });
      ui.text(String(n).padStart(2, '0') + '  ' + stageTitle(n), b.x + 9, yy + 10, { size: 12, color: current ? '#fff0c4' : T.TEXT });
      ui.text(cleared ? '已通关' : current ? '当前' : '未开放', b.x + b.w - 9, yy + 12, { size: 10, color: current ? GOLD : T.DIM, align: 'right' });
      if (current) ui.tap(b.x, yy, b.w, 34, () => { this.showMap = false; this.showStagePreview = true; }, 'chapter-current-stage');
    }
    ui.endScroll();
    ui.btn(b.x, y + h - 43, b.w, 31, { text: '返回战役', style: 'gold', id: 'campaign-map-close', cb: close });
  },
  drawStagePreview() {
    const stageNo = store.getState().campaign.cleared + 1;
    const def = stages.makeStageEnemies(stageNo), reward = store.campaignRewardPreview(stageNo);
    const close = () => { this.showStagePreview = false; };
    const h = Math.min(408, app.H - 40), y = Math.max(20, (app.H - h) / 2);
    ui.setModalClose(close);
    const b = ui.modal('第 ' + stageNo + ' 关 · ' + stageTitle(stageNo), 16, y, 343, h);
    ui.text(def.isBoss ? '名将镇守 · 首通奖励' : '敌阵与首通奖励', b.x, b.y + 2, { size: 11, color: GOLD, bold: true });
    const names = def.units.map(u => u.hero.name + ' Lv.' + u.level + (u.isBoss ? ' · 首领' : '')).slice(0, 5);
    names.forEach((name, i) => ui.text(name, b.x, b.y + 25 + i * 20, { size: 10, color: '#e4d5ae' }));
    const rewardY = b.y + 132;
    ui.panel(b.x, rewardY, b.w, 87, { fill: '#302a1c', r: 4 });
    ui.text('确定奖励：铜钱 +' + F.fmtNum(reward.gold) + ' · 元宝 +' + F.fmtNum(reward.gem) + ' · 招募令 +' + reward.scroll, b.x + 9, rewardY + 9, { size: 9, color: T.TEXT });
    ui.text(reward.first ? '首通：65% 概率获得随机军械' : '重复挑战奖励 · 不重复领取首通奖励', b.x + 9, rewardY + 32, { size: 9, color: T.DIM });
    ui.text(reward.armoryBox ? '里程碑：军械自选箱 ×1' : '挂机铜钱/时：通关后 +' + Math.max(0, C.idleRates(stageNo).gold - C.idleRates(stageNo - 1).gold), b.x + 9, rewardY + 55, { size: 9, color: T.GOLD_HI });
    const team = store.getFormationCalc().filter(Boolean).slice(0, 5).map(u => u.name);
    ui.text('出战：' + (team.length ? team.join(' · ') : '尚未编队'), b.x, rewardY + 100, { size: 9, color: T.DIM });
    ui.btn(b.x, y + h - 44, b.w, 32, { text: '自动出征', style: 'jade', size: 14, id: 'stage-preview-deploy', disabled: !team.length, cb: () => { close(); app.push('battle', { mode: 'campaign', auto: true }); } });
  }
};
